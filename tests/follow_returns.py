# Follow from a shared bill returns to the bill (R-212 #47, Nate's fix of the power users' walk, 8 Oct: "Follow, Continue.
# Then 7 taps of first visit, and Home, not the bill").
#   python3 -m http.server 8832   (in this folder, once)
#   python3 tests/follow_returns.py [base] [out]   base defaults to http://localhost:8832
# In the practice copy, a newcomer from a friend's link (?demo=1&restart&via=share), at 375x812 and 1280x800:
#   - the old pages' "New here?" card (?rec=0, HB 2121): "Follow this issue" opens "Save your profile" over the bill with
#     "You're following ..." at its top (R-184, C-3); "Not now" closes it and the "Mahalo!" plays over the bill (C-7,
#     A-10) with today's words; the address is still the bill's, the card is gone, the follow shows as on, "New to this?
#     See how a bill becomes law, about a minute." shows once where the card was and the tips line does not (A-14); the
#     visit is counted (arrive/next and done/done, path link: read from the sandbox's own printout, ?debug, never sent)
#     and the first visit is done with the bill remembered; the story line opens #/learn/story/<bill id> and the lesson's
#     Back returns to the bill; Home stays Home (never #/start); a reload of the bill stays on it, with no card;
#   - a number given in the sheet (codes off, and codes on with the code): the moment's small line and, after it, a toast
#     that stays to be read both say the profile is saved;
#   - a bill on no issue (HB 1079, HIPHI only watches it) says "Follow this bill" and returns the same way;
#   - today's page (layout 3): a stopped bill's main "Follow the issue" for a newcomer (HB 10) returns the same way, the
#     line where the card would be, under the bill's name on a phone and atop the side panel on a laptop;
#   - the backup ?ab=save.alerts asks nothing and still returns to the bill;
#   - the line reads well at 320, 375 and 1280 (no sideways scroll, every line box inside the page), axe finds nothing
#     serious, and nothing is written to the database, nor tried.
# Pictures in [out] (default tests/out/follow_returns).
import json, os, re, sys
from playwright.sync_api import sync_playwright
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import checks
BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832').rstrip('/')
if BASE.endswith('.html'): BASE = BASE.rsplit('/', 1)[0]
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out', 'follow_returns')
os.makedirs(OUT, exist_ok=True)
res = []
def ok(c, m): res.append(bool(c)); print('PASS' if c else 'FAIL', m)

# The sandbox prints each count it would have sent when the address has `debug` (pub/visitlog.js); counting is switched on
# for this page only (window.__hiphiCountTests, as tests/first_visit_doors.py does), and the printout is kept to read.
INIT = """window.__hiphiCountTests = true; window.__fv = [];
(() => { const d = console.debug.bind(console);
  console.debug = (...a) => { if (a[0] === 'first visit (sandbox, not sent):') { try { window.__fv.push(JSON.parse(JSON.stringify(a[1]))); } catch (e) {} } return d(...a); }; })();"""
writes, errs = [], []

def ctx(br, w, h=None):
    m = w < 700
    c = br.new_context(viewport={'width': w, 'height': h or (812 if m else 800)}, is_mobile=m, has_touch=m, device_scale_factor=2 if m else 1)
    c.add_init_script(INIT)
    # Reads of public data may go through; anything else to the database is refused and noted (nothing may be written).
    def guard(route):
        r = route.request
        if r.method in ('GET', 'HEAD', 'OPTIONS'): route.continue_(); return
        writes.append(f'{r.method} {r.url[:100]}'); route.abort()
    c.route(re.compile(r'.*supabase\.co/.*'), guard)
    p = c.new_page()
    p.on('pageerror', lambda e: errs.append(f'{w}: {e}'))
    return c, p

H = lambda p: p.evaluate('location.hash')
screen = lambda p: p.evaluate('document.body.dataset.screen')
fv = lambda p: p.evaluate('window.__fv || []')
wiz = lambda p: p.evaluate("JSON.parse(localStorage.getItem('hiphi_wiz') || '{}')")
sheet = lambda p: p.evaluate("document.querySelector('dialog.al-sheet[open]')?.innerText || ''")
toast = lambda p: p.evaluate("document.getElementById('toast')?.innerText || ''")
moment = lambda p: p.evaluate("(() => { const m = document.getElementById('fx-moment'); return m && !m.hidden ? m.innerText : ''; })()")
on_bill = lambda p, num: re.fullmatch(rf'#/bill/(2026/)?{num}', H(p)) is not None
# Every visible "New to this?" line on the page (the story line, the tips line, the tour line after "Just looking").
NEWTO = "[...document.querySelectorAll('main p')].filter(e => e.offsetParent !== null && /^New to this\\?/.test(e.innerText.trim())).map(e => e.innerText.trim())"
STORY = 'New to this? See how a bill becomes law, about a minute.'

def arrive(p, num, q=''):
    p.goto(f'{BASE}/track.html?demo=1&restart&via=share&debug{q}#/bill/{num}')
    p.wait_for_selector('[data-bl-newfollow]', timeout=40000); p.wait_for_timeout(700)
def tap_follow(p):
    p.locator('[data-bl-newfollow]:visible').first.click()
def gone_moment(p):
    try: p.wait_for_selector('#fx-moment', state='hidden', timeout=4000)
    except Exception: pass
    p.wait_for_timeout(200)

# From the bill's Follow to the bill after it: the sheet, Not now, the moment, the page. Returns the bill's id.
def follow_flow(p, tag, num, name, label, q='', shots=''):
    vis = p.evaluate("[...document.querySelectorAll('[data-bl-newfollow]')].filter(e => e.offsetParent !== null).map(e => e.innerText.trim() || e.getAttribute('aria-label'))")
    ok(vis and vis[0] == label, f'{tag}: the newcomer\'s button says "{label}" ({vis})')
    tap_follow(p); p.wait_for_selector('dialog.al-sheet[open]', timeout=6000); p.wait_for_timeout(500)
    s = sheet(p)
    ok(f'You’re following “{name}”.' in s and 'Save your profile' in s, f'{tag}: "Save your profile" over the bill, "You’re following “{name}”." at its top ({s[:70]!r})')
    ok(on_bill(p, num) and screen(p) == 'bill' and p.locator('.bl-newbie').count() == 0 and moment(p) == '', f'{tag}: under the sheet, the bill after the follow (no #/start, the card gone), and no moment yet ({H(p)})')
    if shots: p.screenshot(path=os.path.join(OUT, f'{shots}_1_sheet.png'))
    p.click('[data-alshno]'); p.wait_for_timeout(250)
    mo = moment(p)
    ok(mo.startswith('Mahalo!') and f'You’re following {name}.' in mo and screen(p) == 'bill', f'{tag}: "Not now", then the "Mahalo!" plays over the bill ({mo[:90]!r})')
    if shots: p.screenshot(path=os.path.join(OUT, f'{shots}_2_moment.png'))
    gone_moment(p)
    return after_checks(p, tag, num, shots)

def after_checks(p, tag, num, shots=''):
    ok(moment(p) == '' and on_bill(p, num) and screen(p) == 'bill', f'{tag}: the moment leaves on its own, and the address is still the bill\'s ({H(p)})')
    ok(p.locator('.bl-newbie').count() == 0 and p.locator('[data-bl-newfollow]').count() == 0, f'{tag}: the "New here?" card and its Follow are gone')
    on = p.locator('[data-bl-unfollowissue][aria-pressed="true"]').count() + p.locator('[data-bl-star][aria-pressed="true"]').count()
    ok(on >= 1, f'{tag}: the follow shows as on ({on})')
    lines = p.evaluate(NEWTO)
    ok(lines == [STORY], f'{tag}: the story line once, and no tips line beside it (A-14) ({lines})')
    w = wiz(p)
    ok(w.get('done') is True and w.get('via') == num and w.get('viaFollowed') is True and not w.get('skipped'), f'{tag}: the first visit is done, the bill remembered ({ {k: w.get(k) for k in ("done", "via", "viaFollowed", "step")} })')
    ev = [(e.get('step'), e.get('event'), e.get('path')) for e in fv(p)]
    ok(('arrive', 'next', 'link') in ev and ('done', 'done', 'link') in ev and not any(s in ('followask', 'alerts', 'story', 'soon') for s, _, _ in ev),
       f'{tag}: counted as arrive/next and done/done on the link path, no first-visit screens ({ev})')
    if shots: p.screenshot(path=os.path.join(OUT, f'{shots}_3_after.png'))
    return p.evaluate("(async n => { const k = await import('./pub/kernel.js'); const S = k.S; return ([...S.bills, ...Object.values(S.extra || {})].find(b => b.bill_number === n) || {}).id || ''; })('%s')" % num)

def line_fits(p, tag):
    r = p.evaluate("""() => { const e = document.querySelector('.bl-storyline'); if (!e) return null; const pr = e.getBoundingClientRect();
      // The line boxes of the words themselves (a Range over each text node): the span is a flex item, one box however it
      // wraps, and the link's box is taller than its line by its padding.
      const rs = [], tw = document.createTreeWalker(e.querySelector('span'), NodeFilter.SHOW_TEXT);
      for (let t = tw.nextNode(); t; t = tw.nextNode()) { const g = document.createRange(); g.selectNodeContents(t); rs.push(...[...g.getClientRects()].filter(x => x.width > 0)); }
      const tops = []; rs.forEach(x => { if (!tops.some(y => Math.abs(y - x.top) < 4)) tops.push(x.top); });
      return { inside: rs.every(x => x.left >= pr.left - 1 && x.right <= pr.right + 1 && x.right <= innerWidth), sideways: document.scrollingElement.scrollWidth > innerWidth + 1,
        lines: tops.length, h: Math.round(pr.height) }; }""")
    ok(r and r['inside'] and not r['sideways'], f'{tag}: the story line\'s every line box sits inside the page, no sideways scroll ({r})')
    return r

with sync_playwright() as pw:
    br = pw.chromium.launch()

    # ---- 1. the "New here?" card's Follow this issue (?rec=0), on a phone and a laptop ----
    for w in (375, 1280):
        c, p = ctx(br, w)
        arrive(p, 'HB2121', '&rec=0')
        ok(p.locator('.bl-newbie').count() == 1, f'{w} card: a newcomer on a shared bill gets the "New here?" card')
        bid = follow_flow(p, f'{w} card', 'HB2121', 'Disposable e-cigarette ban', 'Follow this issue', '&rec=0', shots=f'{w}_card')
        r = checks.page_report(p, f'{w} after', do_axe=True)
        ok(not r['overflow'] and not r.get('axe'), f'{w} card: after, no sideways scroll and axe finds nothing serious ({r["overflow"]} {str(r.get("axe"))[:160]})')
        line_fits(p, f'{w} card')
        # where the card was: under the bill's name on a phone, atop the side panel on a laptop
        where = p.evaluate("(() => { const e = document.querySelector('.bl-storyline'); return e ? (e.closest('.bl-side') ? 'side' : 'main') : ''; })()")
        ok(where == ('main' if w < 700 else 'side'), f'{w} card: the line sits where the card was ({where})')
        # The story: opened from the line, learned, and its Back returns to the bill.
        href = p.evaluate("document.querySelector('.bl-storyline a')?.getAttribute('href') || ''")
        ok(href == f'#/learn/story/{bid}', f'{w} card: the line links to the story on this bill ({href})')
        p.click('.bl-storyline a'); p.wait_for_selector('[data-stlearnback]', timeout=20000); p.wait_for_timeout(900)
        intro = p.evaluate("(document.querySelector('main') || document.body).innerText")
        ok(H(p) == f'#/learn/story/{bid}' and 'HB 2121' in intro.replace('\xa0', ' '), f'{w} card: the story opens, on HB 2121 ({H(p)})')
        ok(wiz(p).get('viaLearned') is True, f'{w} card: opened is learned (as Home\'s line)')
        if w == 375: p.screenshot(path=os.path.join(OUT, f'{w}_card_4_story.png'))
        p.click('[data-stlearnback]'); p.wait_for_selector('.bl-head', timeout=20000); p.wait_for_timeout(900)
        ok(on_bill(p, 'HB2121') and p.evaluate(NEWTO) == [], f'{w} card: the lesson\'s Back returns to the bill, the line gone once learned, and no tips line this visit ({H(p)}, {p.evaluate(NEWTO)})')
        # Home stays Home; a reload of the bill stays on the bill.
        p.evaluate("location.hash = '#/'"); p.wait_for_timeout(2500)
        ok(H(p) in ('#/', '') and screen(p) == 'home', f'{w} card: Home is Home, not the first visit ({H(p)})')
        p.evaluate("location.hash = '#/bill/2026/HB2121'"); p.wait_for_selector('.bl-head', timeout=20000); p.reload(); p.wait_for_selector('.bl-head', timeout=40000); p.wait_for_timeout(1500)
        ok(on_bill(p, 'HB2121') and screen(p) == 'bill' and p.locator('.bl-newbie').count() == 0 and p.locator('[data-bl-newfollow]').count() == 0, f'{w} card: a reload stays on the bill, with no card ({H(p)})')
        c.close()

    # ---- 2. a number in the sheet: the profile-saved words stay readable ----
    for w, codes in ((375, False), (1280, True)):
        c, p = ctx(br, w)
        arrive(p, 'HB2121', '&rec=0' + ('' if codes else '&codes=0'))
        tap_follow(p); p.wait_for_selector('dialog.al-sheet[open]', timeout=6000); p.wait_for_timeout(400)
        p.fill('#al-sh-phone', '(808) 555-0155'); p.click('#al-sh-send')
        if codes: p.wait_for_selector('#al-sh-code', timeout=6000); p.type('#al-sh-code', '123456')
        want = 'Your profile is saved, and text alerts are on.' if codes else 'Your profile is saved. We’ll text (808) 555-0155 to confirm it’s your number.'
        p.wait_for_selector('#fx-moment:not([hidden])', timeout=8000); p.wait_for_timeout(200)
        mo = moment(p)
        ok(sheet(p) == '' and mo.startswith('Mahalo!') and 'You’re following Disposable e-cigarette ban.' in mo and want in mo, f'{w} saved{" (code)" if codes else ""}: the moment says it, as its small line ({mo[:150]!r})')
        if w == 375: p.screenshot(path=os.path.join(OUT, f'{w}_saved_moment.png'))
        gone_moment(p); p.wait_for_timeout(400)
        ok(want in toast(p) and on_bill(p, 'HB2121'), f'{w} saved: after the moment, a toast that says it, on the bill ({toast(p)[:100]!r})')
        p.wait_for_timeout(2000)
        ok(want in toast(p), f'{w} saved: still there 2 s later, to be read ({toast(p)[:60]!r})')
        ok(p.evaluate(NEWTO) == [STORY], f'{w} saved: the story line ({p.evaluate(NEWTO)})')
        c.close()
    # A tap on Continue ends the moment at once; the saved words still come after it.
    c, p = ctx(br, 375)
    arrive(p, 'HB2121', '&rec=0&codes=0')
    tap_follow(p); p.wait_for_selector('dialog.al-sheet[open]', timeout=6000); p.wait_for_timeout(400)
    p.fill('#al-sh-phone', '(808) 555-0156'); p.click('#al-sh-send'); p.wait_for_selector('#fx-mgo', timeout=8000); p.wait_for_timeout(200)
    p.click('#fx-mgo'); p.wait_for_timeout(600)
    ok(moment(p) == '' and 'Your profile is saved.' in toast(p), f'375 saved, Continue: the moment goes at once and the saved words follow ({toast(p)[:60]!r})')
    c.close()

    # ---- 3. a bill on no issue (HIPHI only watches it): "Follow this bill" ----
    for w in (375, 1280):
        c, p = ctx(br, w)
        arrive(p, 'HB1079', '&rec=0')
        name = p.evaluate("(async () => { const k = await import('./pub/kernel.js'); const b = [...k.S.bills, ...Object.values(k.S.extra || {})].find(x => x.bill_number === 'HB1079'); return k.nick(b) || k.spaced(b.bill_number); })()")
        follow_flow(p, f'{w} no issue', 'HB1079', name, 'Follow this bill', '&rec=0')
        ok(p.evaluate("(async () => { const k = await import('./pub/kernel.js'); const b = [...k.S.bills, ...Object.values(k.S.extra || {})].find(x => x.bill_number === 'HB1079'); return k.S.watch.has(b.id); })()"), f'{w} no issue: the bill itself is followed')
        c.close()

    # ---- 4. today's page (layout 3): a stopped bill's main "Follow the issue" ----
    for w in (375, 1280):
        c, p = ctx(br, w)
        arrive(p, 'HB10')
        follow_flow(p, f'{w} stopped', 'HB10', 'Cigars shipped by mail', 'Follow the issue', shots=f'{w}_stopped')
        where = p.evaluate("(() => { const e = document.querySelector('.bl-storyline'); if (!e) return ''; const h = document.querySelector('.bl-rhead'), a = document.querySelector('.bl-side');"
                           " return a && a.contains(e) ? (a.firstElementChild === e || e.previousElementSibling?.classList.contains('bl-friend') ? 'side top' : 'side') : h && (h.compareDocumentPosition(e) & Node.DOCUMENT_POSITION_FOLLOWING) ? 'under the name' : 'elsewhere'; })()")
        ok(where == ('under the name' if w < 700 else 'side top'), f'{w} stopped: the line under the bill\'s name on a phone, atop the side panel on a laptop ({where})')
        main = p.evaluate("[...document.querySelectorAll('.bl-ract .btn.primary, .actionbar .btn.primary')].filter(e => e.offsetParent !== null).map(e => e.innerText.trim())")
        ok(not any(m == 'Follow the issue' for m in main), f'{w} stopped: the main button no longer asks to follow ({main})')
        r = checks.page_report(p, f'{w} stopped', do_axe=True)
        ok(not r['overflow'] and not r.get('axe'), f'{w} stopped: no sideways scroll and axe finds nothing serious ({r["overflow"]} {str(r.get("axe"))[:160]})')
        line_fits(p, f'{w} stopped')
        c.close()

    # ---- 5. the backup ?ab=save.alerts: no sheet, and still back on the bill ----
    c, p = ctx(br, 375)
    arrive(p, 'HB2121', '&rec=0&ab=save.alerts&abrest=today')   # &abrest: a link naming a version is a tester's, whose path log would be sent
    tap_follow(p); p.wait_for_timeout(300)
    mo = moment(p)
    ok(sheet(p) == '' and mo.startswith('Mahalo!') and 'You’re following Disposable e-cigarette ban.' in mo, f'backup: no sheet, the "Mahalo!" at once ({mo[:80]!r})')
    gone_moment(p)
    after_checks(p, 'backup', 'HB2121')
    c.close()

    # ---- 6. the line at 320 wide ----
    for q, num in (('&rec=0', 'HB2121'), ('', 'HB10')):
        c, p = ctx(br, 320, 640)
        arrive(p, num, q)
        tap_follow(p); p.wait_for_selector('dialog.al-sheet[open]', timeout=6000); p.click('[data-alshno]'); gone_moment(p)
        r = line_fits(p, f'320 {num}')
        ok(r and r['lines'] <= 3 and p.evaluate(NEWTO) == [STORY], f'320 {num}: the line reads in at most three lines, once ({r and r["lines"]})')
        p.evaluate("document.querySelector('.bl-storyline')?.scrollIntoView({ block: 'center' })"); p.wait_for_timeout(200)
        p.screenshot(path=os.path.join(OUT, f'320_{num}_after.png'))
        c.close()

    br.close()

ok(not writes, f'nothing was written to the database, nor tried ({writes[:3]})')
ok(not errs, f'no page errors ({errs[:3]})')
print(f'\n{sum(res)} passed, {len(res) - sum(res)} failed')
sys.exit(0 if all(res) else 1)
