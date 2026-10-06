# The profile ask after acting or following from a shared link (R-184, Nate 10/6: "if people get a link to take action or
# to follow a bill ... Are they then immediately prompted to sign-up? It's crucially important that we encourage them to
# build a profile"; his answers: "Save your profile", no line on Home after a skip, replace the old ask and keep it as a
# backup to test later, the test 'save').
# python3 tests/profile_ask.py [base url]   (the sandbox; a phone at 390x844, an iPhone SE at 375x667, a laptop at 1280x800)
# Checks, as a newcomer arriving by a shared link:
#   1. an issue page's Follow (every live share card opens one until January): the sheet "Save your profile" with the
#      follow said over it and the line on what the profile keeps, its box and button on an iPhone SE's first screen; Not
#      now closes it, records the "Not now" (14 days quiet) and the follow's own toast comes after it, with Undo; a second
#      follow in the same visit asks nothing (one ask per visit, C-3); Home after it has no second ask (Nate: no line).
#   2. the same, saved: codes on (the code, then "Your profile is saved, and text alerts are on." in the toast); codes off
#      (the number kept, "Your profile is saved. We'll text ... to confirm").
#   3. a category's "Follow all": the sheet says "these issues".
#   4. between sessions, a stopped bill's main button "Follow the issue: ..." asks the same.
#   5. testimony from a shared link: on the "Mahalo" screen the ask is right under the thank-you, above "What happens
#      next", and its box is on the first phone screen above the Done bar; the line is the letter's (send it again).
#   6. a bill page's "New here?" Follow: the first visit's screen says "Save your profile".
#   7. someone who already gave a number is never asked.
#   8. the backup (?ab=save.alerts): no sheet after an issue's Follow (the toast only), "Get alerts on your issue" on the
#      first visit's screen, and the letter's ask under "What happens next", as before 6 Oct.
#   No page errors anywhere.
import json, os, sys, urllib.parse
from playwright.sync_api import sync_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832/track.html'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out', 'profile_ask'); os.makedirs(OUT, exist_ok=True)
ISSUE = 'fda-proof-to-sell-e-cigarettes'
TOUR_SEEN = "try{localStorage.setItem('hiphi_tour_bill','1');localStorage.setItem('hiphi_tour_bill_demo','1')}catch(e){}"
CATCH = """document.addEventListener('click', e => { const a = e.target.closest && e.target.closest('a.hp-send'); if (!a) return;
  e.preventDefault(); (window.__opened ||= []).push(a.href); }, true);"""
ok_n = fail_n = 0
errors = []
def ok(c, m):
    global ok_n, fail_n
    print('PASS' if c else 'FAIL', m); ok_n += bool(c); fail_n += (not c)
def shot(p, name): p.screenshot(path=os.path.join(OUT, name + '.png'))
def ctx(br, w=390, h=844):
    c = br.new_context(viewport={'width': w, 'height': h}, is_mobile=w < 600, has_touch=w < 600, device_scale_factor=2 if w < 600 else 1)
    c.add_init_script(TOUR_SEEN); c.add_init_script(CATCH)
    c.grant_permissions(['clipboard-read', 'clipboard-write'], origin=urllib.parse.urlsplit(BASE)._replace(path='').geturl().rstrip('/'))
    p = c.new_page(); p.on('pageerror', lambda e: errors.append(f'{w}: {str(e)[:160]}'))
    return c, p
def sheet(p): return p.evaluate("document.querySelector('dialog.al-sheet[open]')?.innerText || ''")
def toast(p): return p.evaluate("document.getElementById('toast')?.innerText || ''")
def onb(p): return p.evaluate("JSON.parse(localStorage.getItem('hiphi_onb') || '{}')")
def tap(p, rx, sel='#hp-dlg button, #hp-dlg a'):
    return p.evaluate("""([sel, rx]) => { const e = [...document.querySelectorAll(sel)].filter(x => x.offsetParent !== null).find(x => new RegExp(rx, 'i').test((x.innerText || '').trim()));
      if (!e) return false; e.click(); return true; }""", [sel, rx])
def issue(p, extra='', slug=ISSUE):
    p.goto(f'{BASE}?demo=1&restart&via=share{extra}#/issue/{slug}')
    p.wait_for_selector('[data-fdissue], [data-fdunissue]', timeout=20000); p.wait_for_timeout(500)
def follow(p):
    p.click('[data-fdissue]'); p.wait_for_timeout(900)

with sync_playwright() as pw:
    br = pw.chromium.launch()

    # ---- 1. an issue page's Follow, on an iPhone SE: the sheet, Not now, one ask per visit ----
    c, p = ctx(br, 375, 667)
    issue(p, '&codes=0'); follow(p)
    s = sheet(p)
    ok('Save your profile' in s and 'You’re following “FDA proof required to sell e-cigarettes”.' in s, f'1: Follow opens "Save your profile" with the follow said over it ({s[:90]!r})')
    ok('Nice start. Your profile keeps this issue with you, so you’re ready when it needs you.' in s and 'any phone or computer' not in s, '1: codes off: the line says what the profile keeps, and not "any phone or computer" (a number stays on this phone until codes are on)')
    ok(p.evaluate("document.activeElement?.id") == 'al-sh-h', f'1: on a touch screen the sheet opens on its heading, not the box (no keyboard over Not now) ({p.evaluate("document.activeElement?.id")!r})')
    ok('We’ll text you when a bill on your issues gets a hearing' in s and 'At most one text a day' in s, '1: the consent words are the same box’s (C-4)')
    vis = p.evaluate("""() => { const r = e => document.querySelector(e)?.getBoundingClientRect(); const i = r('#al-sh-phone'), b = r('#al-sh-send');
      return !!i && !!b && i.top >= 0 && b.bottom <= innerHeight; }""")
    ok(vis, '1: on an iPhone SE the number box and its button are on the first screen of the sheet')
    shot(p, '1_issue_follow_se')
    ok(toast(p) == '', '1: no toast hidden under the sheet')
    p.click('[data-alshno]'); p.wait_for_timeout(700)
    ok(sheet(p) == '' and 'Following FDA proof required to sell e-cigarettes. Its bills come to you' in toast(p), f'1: Not now closes it, then the follow’s toast ({toast(p)[:80]!r})')
    ok('Undo' in toast(p), '1: the toast keeps its Undo')
    ok(onb(p).get('nudgeNo') == 1, '1: "Not now" is recorded (quiet for 14 days)')
    p.evaluate("location.hash = '#/'"); p.wait_for_timeout(2500)
    ok(p.locator('.nudgecard').count() == 0, '1: Home asks nothing more this visit (Nate: no line after a skip)')
    c.close()
    # 1b. closed with Esc (no "Not now" recorded): a second follow in the same visit still asks nothing (C-3)
    c, p = ctx(br)
    issue(p, '&codes=0'); follow(p)
    p.keyboard.press('Escape'); p.wait_for_timeout(700)
    ok(sheet(p) == '' and 'Following' in toast(p) and not onb(p).get('nudgeNo'), '1b: Esc closes it, the toast follows, nothing recorded as "Not now"')
    p.evaluate("location.hash = '#/issue/cross-during-the-countdown'"); p.wait_for_selector('[data-fdissue], [data-fdunissue]', timeout=20000); p.wait_for_timeout(600)
    had = p.locator('[data-fdissue]').count()
    if had: follow(p)
    ok(had and sheet(p) == '' and 'Following' in toast(p), '1b: a second follow in the same visit asks nothing (C-3)')
    c.close()

    # ---- 2. saved: codes on, then codes off ----
    c, p = ctx(br)
    issue(p); follow(p)
    ok('Nice start. Your profile keeps this issue with you on any phone or computer, so you’re ready when it needs you.' in sheet(p), '2: codes on: A1 in full, "on any phone or computer"')
    p.fill('#al-sh-phone', '(808) 555-0123'); p.click('#al-sh-send'); p.wait_for_timeout(800)
    ok(p.locator('#al-sh-code').count() == 1 and 'Check your texts' in sheet(p), '2: codes on: the code step in the sheet')
    p.type('#al-sh-code', '123456'); p.wait_for_timeout(1500)
    ok(sheet(p) == '' and 'Your profile is saved, and text alerts are on.' in toast(p), f'2: six digits: the sheet closes, "Your profile is saved" ({toast(p)[:90]!r})')
    ok('Undo' not in toast(p) and 'Following' not in toast(p), '2: after a yes, no Undo (it would undo the follow, not the texts) and no third "Following"')
    shot(p, '2_saved_toast')
    c.close()
    c, p = ctx(br)
    issue(p, '&codes=0'); follow(p)
    p.fill('#al-sh-phone', '(808) 555-0124'); p.click('#al-sh-send'); p.wait_for_timeout(1200)
    ok('Your profile is saved. We’ll text (808) 555-0124 to confirm it’s your number.' in toast(p), f'2: codes off: kept, and the text that confirms it is said ({toast(p)[:100]!r})')
    ok('8085550124' in (p.evaluate("localStorage.getItem('hiphi_text')") or ''), '2: the number is kept (the sandbox copy)')
    c.close()

    # ---- 3. a category's Follow all ----
    c, p = ctx(br)
    p.goto(f'{BASE}?demo=1&restart&via=share#/find/category/tobacco'); p.wait_for_timeout(2500)
    if p.locator('[data-fdcat]').count():
        p.click('[data-fdcat]'); p.wait_for_timeout(900)
        ok('Save your profile' in sheet(p) and 'these issues' in sheet(p) and 'You’re following all of Tobacco, Nicotine & Alcohol.' in sheet(p), f'3: Follow all asks, for "these issues" ({sheet(p)[:80]!r})')
    else: ok(False, '3: the category page has its Follow all button')
    c.close()

    # ---- 4. between sessions: a stopped bill's main button ----
    c, p = ctx(br)
    # someone back for another look, who found their legislators (a newcomer's bar says "Find your legislators" instead)
    p.goto(f'{BASE}?demo=1&restart&season=off#/'); p.wait_for_timeout(800)
    p.evaluate("localStorage.setItem('hiphi_wiz', JSON.stringify({ step: 1, issues: [], done: true })); localStorage.setItem('hiphi_districts', JSON.stringify({ senate: 13, house: 25 }))")
    p.goto(f'{BASE}?demo=1&season=off#/bill/2026/HB1523'); p.wait_for_timeout(3500)
    b = p.locator('[data-bl-followissue]:visible').first
    if b.count():
        b.click(); p.wait_for_timeout(900)
        ok('Save your profile' in sheet(p) and 'You’re following' in sheet(p), f'4: a stopped bill’s "Follow the issue" asks ({sheet(p)[:80]!r})')
    else: ok(False, '4: a stopped bill shows "Follow the issue" to someone with their districts')
    c.close()

    # ---- 5. testimony from a shared link: the ask right under the thank-you ----
    def to_mahalo(extra=''):
        c, p = ctx(br)
        p.goto(f'{BASE}?demo=1&restart&via=share{extra}#/bill/2026/HB1573/testify'); p.wait_for_selector('#hp-dlg', timeout=20000); p.wait_for_timeout(900)
        if 'Where do you stand' in p.evaluate("document.getElementById('hp-dlg').innerText"): tap(p, '^I support it'); p.wait_for_timeout(600)
        tap(p, '^Next'); p.wait_for_timeout(600)
        p.fill('#hp-name', 'Kai Ho'); tap(p, '^See my letter'); p.wait_for_timeout(700)
        tap(p, '^Next'); p.wait_for_timeout(700)
        tap(p, '^Yes, I have an account'); p.wait_for_timeout(700)
        tap(p, '^I already sent it'); p.wait_for_timeout(1600)
        return c, p
    c, p = to_mahalo()
    d = p.evaluate("document.getElementById('hp-dlg')?.innerText || ''")
    ok('Mahalo, Kai!' in d and 'Save your profile' in d, '5: the Mahalo screen has "Save your profile"')
    order = p.evaluate("""() => { const a = document.querySelector('#hp-dlg .nudgecard'), n = document.querySelector('#hp-dlg .hp-next');
      return !!a && !!n && !!(a.compareDocumentPosition(n) & Node.DOCUMENT_POSITION_FOLLOWING); }""")
    ok(order, '5: the ask comes before "What happens next"')
    seen = p.evaluate("""() => { const i = document.querySelector('#hp-ng-phone')?.getBoundingClientRect();
      const done = [...document.querySelectorAll('#hp-dlg button')].find(b => b.innerText.trim() === 'Done')?.getBoundingClientRect();
      return !!i && !!done && i.bottom <= done.top && i.top >= 0; }""")
    ok(seen, '5: its number box is on the first phone screen, above the Done bar')
    ok('Bills often get more than one hearing. Your profile keeps what you wrote' in d, '5: the letter’s line (B1)')
    bar = p.evaluate("[...document.querySelectorAll('#hp-dlg .hp-foot button')].map(b => (b.classList.contains('primary') ? '*' : '') + b.innerText.trim())")
    ok(bar == ['Done', '*Text me a code'] and p.locator('#hp-dlg .nudgecard button[type=submit]').count() == 0, f'5: while it waits, the bar’s main button saves and Done is a text button ({bar})')
    shot(p, '5_mahalo_ask')
    p.fill('#hp-ng-phone', '(808) 555-0126'); p.click('#hp-dlg button[form="hp-ng-form"]'); p.wait_for_timeout(900)
    bar = p.evaluate("[...document.querySelectorAll('#hp-dlg .hp-foot button')].map(b => (b.classList.contains('primary') ? '*' : '') + b.innerText.trim())")
    ok(p.locator('#hp-ng-code').count() == 1 and bar[-1] == '*Confirm', f'5: the bar’s button texts the code, then says Confirm ({bar})')
    p.type('#hp-ng-code', '123456'); p.wait_for_timeout(1300)
    d = p.evaluate("document.getElementById('hp-dlg')?.innerText || ''")
    bar = p.evaluate("[...document.querySelectorAll('#hp-dlg .hp-foot button')].map(b => (b.classList.contains('primary') ? '*' : '') + b.innerText.trim())")
    ok('Your profile is saved.' in d and 'Text alerts are on' in d and bar == ['Tell a friend', '*Done'], f'5: saved, the card says so, and the bar is Tell a friend and Done again ({bar})')
    c.close()
    c, p = to_mahalo()
    p.click('#hp-dlg .nudgecard [data-nudgeno]'); p.wait_for_timeout(700)
    bar = p.evaluate("[...document.querySelectorAll('#hp-dlg .hp-foot button')].map(b => (b.classList.contains('primary') ? '*' : '') + b.innerText.trim())")
    ok(p.locator('#hp-dlg .nudgecard').count() == 0 and bar == ['Tell a friend', '*Done'], f'5: Not now: the card goes and the bar is as before ({bar})')
    c.close()

    # ---- 6. a bill page's "New here?" Follow: the first visit's screen ----
    c, p = ctx(br)
    p.goto(f'{BASE}?demo=1&restart&via=share#/bill/2026/HB1573'); p.wait_for_timeout(3000)
    if p.locator('#hp-dlg[open]').count(): p.evaluate("document.getElementById('hp-dlg').close()"); p.wait_for_timeout(400)
    p.click('[data-bl-newfollow]'); p.wait_for_timeout(1000)
    p.locator('#fx-moment button').first.click(); p.wait_for_timeout(1500)
    h = p.inner_text('#st-h') if p.locator('#st-h').count() else ''
    ok(h == 'Save your profile' and p.locator('#st-a-phone').count() == 1, f'6: the first visit’s screen says "Save your profile" ({h!r})')
    c.close()

    # ---- 7. a number already given: never asked ----
    c, p = ctx(br)
    p.goto(f'{BASE}?demo=1&restart#/'); p.wait_for_timeout(800)
    p.evaluate("localStorage.setItem('hiphi_text', JSON.stringify({ token: 't', phone: '8085550125', at: new Date().toISOString() }))")
    p.goto(f'{BASE}?demo=1&via=share#/issue/{ISSUE}'); p.wait_for_selector('[data-fdissue], [data-fdunissue]', timeout=20000); p.wait_for_timeout(500)
    if p.locator('[data-fdissue]').count(): follow(p)
    ok(sheet(p) == '' and 'Following' in toast(p), '7: with a number already given, Follow only says so')
    c.close()

    # ---- 8. the backup, ?ab=save.alerts: as before 6 Oct ----
    c, p = ctx(br)
    issue(p, '&ab=save.alerts'); follow(p)
    ok(sheet(p) == '' and 'Its bills come to you' in toast(p), '8: backup: an issue’s Follow asks nothing, the toast only')
    c.close()
    c, p = to_mahalo('&ab=save.alerts')
    d = p.evaluate("document.getElementById('hp-dlg')?.innerText || ''")
    order = p.evaluate("""() => { const a = document.querySelector('#hp-dlg .nudgecard'), n = document.querySelector('#hp-dlg .hp-next');
      return !!a && !!n && !!(n.compareDocumentPosition(a) & Node.DOCUMENT_POSITION_FOLLOWING); }""")
    ok(order and 'Get alerts on your issues' in d, '8: backup: the letter’s ask is "Get alerts", under "What happens next"')
    c.close()
    c, p = ctx(br)
    p.goto(f'{BASE}?demo=1&restart&via=share&ab=save.alerts#/bill/2026/HB1573'); p.wait_for_timeout(3000)
    if p.locator('#hp-dlg[open]').count(): p.evaluate("document.getElementById('hp-dlg').close()"); p.wait_for_timeout(400)
    p.click('[data-bl-newfollow]'); p.wait_for_timeout(1000)
    p.locator('#fx-moment button').first.click(); p.wait_for_timeout(1500)
    h = p.inner_text('#st-h') if p.locator('#st-h').count() else ''
    ok(h.startswith('Get alerts on your'), f'8: backup: the first visit’s screen says "Get alerts" ({h!r})')
    c.close()

    # ---- a laptop: the sheet sits in the middle ----
    c, p = ctx(br, 1280, 800)
    issue(p); follow(p)
    box = p.evaluate("(() => { const r = document.querySelector('dialog.al-sheet[open]')?.getBoundingClientRect(); return r ? [r.width, r.top] : null; })()")
    ok(bool(box) and 500 <= box[0] <= 540 and box[1] > 0, f'laptop: the sheet is 520px wide, in the middle ({box})')
    ok(p.evaluate("document.activeElement?.id") == 'al-sh-phone', '1: on a laptop the sheet starts in the box')
    shot(p, '9_laptop')
    c.close()
    br.close()

ok(not errors, f'no page errors {errors[:3]}')
print(f'\n{ok_n} passed, {fail_n} failed'); sys.exit(1 if fail_n else 0)
