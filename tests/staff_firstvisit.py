# Staff v2, the first visit (R-023; backend migrations 066-068): Outreach > Issues > First visit (its numbers) and Make a
# link (a link with a QR code for a partner or an event), the issue page's "Show in the first visit" switch, and the
# index's mark for an issue that is left out. Sandbox only: nothing reaches Supabase (checked).
#   python3 -m http.server 8832   (in this folder, once)
#   python3 tests/staff_firstvisit.py
import os, re, sys
from playwright.sync_api import sync_playwright

BASE = 'http://localhost:8832/staff.html?demo=1'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out', 'firstvisit')
os.makedirs(OUT, exist_ok=True)
ISSUE = '05e0d6a9-4ea7-456c-b219-e3632ade358b'   # Free school meals for every student (in the snapshot)
passed = failed = 0
def ok(cond, msg):
    global passed, failed
    print(('PASS ' if cond else 'FAIL ') + msg)
    if cond: passed += 1
    else: failed += 1

def visit(p, h, wait=2600):
    p.goto(BASE + '#' + h.lstrip('#')); p.reload(); p.wait_for_timeout(wait)
H1 = "[...document.querySelectorAll('h1, [role=heading][aria-level=\"1\"]')].filter(e => getComputedStyle(e).display !== 'none' && e.getAttribute('aria-hidden') !== 'true').length"
OVER = "document.documentElement.scrollWidth > innerWidth + 1"
SMALL = """(() => [...document.querySelectorAll('main button, main a, main input, main [role=switch]')].filter(e => e.offsetParent && !e.closest('.fv-table, .le-deskback'))
  .map(e => { const t = e.matches('input[role=switch]') ? e.closest('label') : e; const r = t.getBoundingClientRect(); return [t.textContent.trim().slice(0, 30) || t.getAttribute('aria-label') || t.id, Math.round(r.height)]; })
  .filter(([, h]) => h < 44))()"""

with sync_playwright() as pw:
    b = pw.chromium.launch()
    for W, H in ((1440, 900), (1024, 768), (390, 844), (320, 640)):
        c = b.new_context(viewport={'width': W, 'height': H}, accept_downloads=True)
        c.grant_permissions(['clipboard-read', 'clipboard-write'], origin='http://localhost:8832')
        leaks = []
        c.route(re.compile(r'.*supabase\.co/.*'), lambda route: (leaks.append(route.request.url), route.abort()))
        p = c.new_page(); errors = []
        p.on('console', lambda m: errors.append(m.text[:160]) if m.type == 'error' and 'favicon' not in m.text else None)
        p.on('pageerror', lambda e: errors.append(str(e)[:160]))
        tag = f'@{W}'

        # ---- the way in, from Outreach > Issues ----
        visit(p, '/outreach/issues')
        link = p.locator('a.is-fvlink')
        ok(link.count() == 1 and 'First visit' in link.inner_text(), f'issues{tag}: a link to the first visit under the top line')
        link.click(); p.wait_for_timeout(1200)
        ok(p.evaluate('location.hash') == '#/outreach/issues?view=first-visit', f'first visit{tag}: its address')
        ok(p.evaluate(H1) == 1 and p.locator('main h1').first.inner_text() == 'First visit', f'first visit{tag}: one h1, "First visit"')
        ok(p.locator('.sv-side a[aria-current="page"]').count() == 0 or 'Issues' in (p.locator('.sv-side a[aria-current="page"]').first.inner_text() or ''), f'first visit{tag}: the sidebar still shows Issues')
        ok('Sample numbers' in p.locator('main').inner_text(), f'first visit{tag}: the sandbox says its numbers are samples')
        ok(p.locator('.fv-tile').count() == 4, f'first visit{tag}: four numbers at the top')
        ok(p.locator('#fv-sh').count() == 1 and p.locator('#fv-lsh').count() == 1, f'first visit{tag}: screen by screen, and the shared-bill visits apart')
        names = p.locator('ol.fv-screens').first.locator('.fv-sname').all_inner_texts()
        ok(names[:3] == ['What you care about', 'Your issues', 'Where do you stand?'] and names[-1].startswith('You'), f'first visit{tag}: screens in the order a person meets them: {names[:3]} ... {names[-1:]}')
        first_pc = p.locator('ol.fv-screens').first.locator('.fv-rn').first.inner_text()
        ok(first_pc.endswith('100%'), f'first visit{tag}: every first visit reaches the first screen ({first_pc})')
        ok(p.locator('table.fv-table').count() == 2, f'first visit{tag}: where they came from, and by week')
        src = p.locator('table.fv-table').first.inner_text()
        ok('Keiki health fair (sample)' in src, f'first visit{tag}: a partner\'s visits are under its name')
        ok('spring-flyer' in src and 'no campaign word' in src, f'first visit{tag}: a partner\'s campaign words are rows under it, so two flyers can be told apart')
        order = p.evaluate("[...document.querySelectorAll('main h2')].map(h => h.textContent.trim())")
        ok(order[:2] == ['Where they came from', 'Screen by screen'], f'first visit{tag}: where they came from comes right after the numbers at the top: {order[:4]}')
        ok('of them on a bill someone shared' in p.locator('.fv-tile').first.inner_text() and 'began on the first screen' in p.locator('#fv-sh').locator('xpath=..').inner_text(), f'first visit{tag}: the two starting points are said, so the counts add up')
        ok('hearing question' in p.locator('.fv-tile').nth(3).inner_text(), f'first visit{tag}: the quiz is named by what it asks about')
        ok(not p.evaluate(OVER), f'first visit{tag}: no sideways scroll')
        if W < 900:
            small = p.evaluate(SMALL)
            ok(not small, f'first visit{tag}: every control is 44px or taller on a phone: {small}')
        # ---- a longer period ----
        p.locator('[data-seg="fvw"][data-val="12"]').click(); p.wait_for_timeout(500)
        ok(p.locator('[data-seg="fvw"][data-val="12"]').get_attribute('aria-pressed') == 'true', f'first visit{tag}: 12 weeks chosen')
        ok(p.locator('table.fv-table').nth(1).locator('tbody tr').count() == 12, f'first visit{tag}: 12 weeks, 12 rows by week')
        p.screenshot(path=os.path.join(OUT, f'numbers_{W}.png'), full_page=True)

        # ---- make a link: its own screen, from the numbers' top line ----
        p.locator('a.fv-golink').click(); p.wait_for_timeout(1200)
        ok(p.evaluate('location.hash') == '#/outreach/issues?view=links' and p.locator('main h1').first.inner_text() == 'Make a link' and p.evaluate(H1) == 1, f'link{tag}: Make a link is a screen of its own, one h1')
        ok(not p.evaluate(OVER), f'link{tag}: no sideways scroll')
        if W < 900:
            small = p.evaluate(SMALL)
            ok(not small, f'link{tag}: every control is 44px or taller on a phone: {small}')
        url = p.locator('#fv-url')
        ok(url.count() == 1 and url.inner_text() == 'https://natehiphi.github.io/hiphi-tracker-app/track.html?via=keiki-health-fair', f'link{tag}: the only partner is chosen and its link shown')
        p.wait_for_timeout(1500)
        ok(p.locator('#fv-qrbox svg').count() == 1, f'link{tag}: the QR code is drawn')
        p.locator('#fv-word').fill('Fall Flyer!'); p.wait_for_timeout(700)
        ok(p.locator('#fv-word').input_value() == 'fall-flyer', f'link{tag}: the campaign word is tidied as it is typed ({p.locator("#fv-word").input_value()})')
        ok(url.inner_text().endswith('?via=keiki-health-fair&utm_campaign=fall-flyer'), f'link{tag}: the link carries it: {url.inner_text()}')
        ok(p.locator('#fv-qrbox').get_attribute('data-for') == url.inner_text() and p.locator('#fv-qrbox svg').count() == 1, f'link{tag}: the QR code follows the link')
        p.locator('[data-fv="copy"]').click(); p.wait_for_timeout(500)
        clip = p.evaluate('navigator.clipboard.readText()')
        ok(clip == url.inner_text() and 'Link copied' in (p.locator('.toastmsg').first.inner_text() if p.locator('.toastmsg').count() else ''), f'link{tag}: Copy link copies it and says so')
        with p.expect_download() as dl:
            p.locator('[data-fv="png"]').click()
        d = dl.value; path = os.path.join(OUT, f'qr_{W}.png'); d.save_as(path)
        with open(path, 'rb') as f: head = f.read(8)
        ok(d.suggested_filename == 'hiphi-link-keiki-health-fair-fall-flyer.png' and head == b'\x89PNG\r\n\x1a\n' and os.path.getsize(path) > 2000, f'link{tag}: Download gives a PNG named for the link ({d.suggested_filename}, {os.path.getsize(path)} bytes)')
        p.evaluate("window.__printed = 0; const f = HTMLIFrameElement.prototype; const d = Object.getOwnPropertyDescriptor(f, 'contentWindow'); Object.defineProperty(f, 'contentWindow', { get() { const w = d.get.call(this); try { w.print = () => { window.__printed++; }; } catch (e) {} return w; } });")
        p.locator('[data-fv="print"]').click(); p.wait_for_timeout(800)
        frame = p.evaluate("(() => { const f = [...document.querySelectorAll('iframe')].pop(); return f ? { svg: !!f.contentDocument.querySelector('svg'), text: f.contentDocument.body.innerText } : null })()")
        ok(frame and frame['svg'] and 'utm_campaign=fall-flyer' in frame['text'] and p.evaluate('window.__printed') == 1, f'link{tag}: Print prints the code and the link from a frame of its own')

        # ---- a new partner, from the picker ----
        p.locator('[data-fv="pick"]').click(); p.wait_for_timeout(500)
        ok(p.locator('dialog[open] [data-pv="__new"]').count() == 1, f'partners{tag}: the picker offers a new partner')
        p.locator('dialog[open] [data-pv="__new"]').click(); p.wait_for_timeout(900)
        ok(p.locator('dialog[open] #fv-pname').count() == 1, f'partners{tag}: the new partner form opens')
        p.locator('#fv-pname').fill('Kōkua Kalihi Valley'); p.wait_for_timeout(200)
        ok(p.locator('#fv-pslug').input_value() == 'kokua-kalihi-valley', f'partners{tag}: the link word is made from the name ({p.locator("#fv-pslug").input_value()})')
        p.locator('#fv-pwel').fill('Welcome, friends of Kōkua Kalihi Valley!')
        p.locator('[data-fvsave]').click(); p.wait_for_timeout(1000)
        ok(p.locator('dialog[open]').count() == 0 and 'via=kokua-kalihi-valley' in p.locator('#fv-url').inner_text(), f'partners{tag}: added, chosen, and its link shown')
        ok('Welcome, friends of Kōkua Kalihi Valley!' in p.locator('.fv-welcome').inner_text(), f'partners{tag}: its welcome line is shown with it')
        ok(p.evaluate("document.activeElement && document.activeElement.id") == 'fv-word', f'partners{tag}: focus lands on the campaign word, the next thing to fill')
        # the same link word again is refused, in words, beside the field
        p.locator('[data-fv="pick"]').click(); p.wait_for_timeout(500); p.locator('dialog[open] [data-pv="__new"]').click(); p.wait_for_timeout(900)
        p.locator('#fv-pname').fill('Kokua Kalihi Valley'); p.locator('[data-fvsave]').click(); p.wait_for_timeout(400)
        err = p.locator('#fv-pslug-err').inner_text() if p.locator('#fv-pslug-err').count() else ''
        ok('is already in the link of' in err and p.locator('#fv-pslug').get_attribute('aria-invalid') == 'true', f'partners{tag}: a name already in another partner\'s link is refused beside the field: {err!r}')
        p.keyboard.press('Escape'); p.wait_for_timeout(600)
        # edit, then Undo
        p.locator('[data-fv="pedit"]').click(); p.wait_for_timeout(900)
        ok(p.locator('#fv-pslug').get_attribute('readonly') is not None, f'partners{tag}: the link word cannot change once links are out')
        p.locator('#fv-pwel').fill('Aloha, KKV friends!'); p.locator('[data-fvsave]').click(); p.wait_for_timeout(900)
        ok('Aloha, KKV friends!' in p.locator('.fv-welcome').inner_text(), f'partners{tag}: an edited welcome line shows at once')
        p.locator('.toastmsg .toastundo').click(); p.wait_for_timeout(700)
        ok('Welcome, friends of Kōkua Kalihi Valley!' in p.locator('.fv-welcome').inner_text(), f'partners{tag}: Undo puts it back')
        p.screenshot(path=os.path.join(OUT, f'link_{W}.png'), full_page=True)
        # Back returns to the numbers; coming back keeps the partner and the campaign word (B-4, B-6)
        back = p.locator('.le-deskback:visible, .sv-back:visible').filter(has_text='First visit').first
        back.click(); p.wait_for_timeout(1200)
        ok(p.evaluate('location.hash') == '#/outreach/issues?view=first-visit', f'link{tag}: back goes to First visit')
        p.locator('a.fv-golink').click(); p.wait_for_timeout(1200)
        ok(p.locator('#fv-word').input_value() == 'fall-flyer' and 'kokua-kalihi-valley' in p.locator('#fv-url').inner_text(), f'link{tag}: coming back keeps the partner and the word')

        # ---- the issue page: "Show in the first visit" ----
        visit(p, '/issue/' + ISSUE)
        sw = p.locator('#is-fv')
        ok(sw.count() == 1 and sw.get_attribute('role') == 'switch' and sw.is_checked(), f'issue{tag}: a switch, on by default')
        ok('Show in the first visit' in p.locator('label[for="is-fv"]').inner_text() and 'Newcomers can follow it on their first visit' in p.locator('label[for="is-fv"]').inner_text(), f'issue{tag}: labelled in plain words, saying what "on" means')
        ok(p.locator('.is-folcard a.btn', has_text='Public page').count() == 1, f'issue{tag}: the button beside the followers says it opens the public page')
        box = p.locator('label[for="is-fv"]').bounding_box()
        ok(box and box['height'] >= 44, f'issue{tag}: the switch row is a 44px target ({box and round(box["height"])}px)')
        p.locator('label[for="is-fv"]').click(); p.wait_for_timeout(600)
        ok(not p.locator('#is-fv').is_checked() and p.evaluate("document.activeElement && document.activeElement.id") == 'is-fv', f'issue{tag}: off, and focus stays on the switch')
        ok('People can still find and follow it' in p.locator('label[for="is-fv"]').inner_text(), f'issue{tag}: off, it says what "off" means')
        toast = p.locator('.toastmsg').first.inner_text() if p.locator('.toastmsg').count() else ''
        ok('Left out of the first visit' in toast and 'Undo' in toast, f'issue{tag}: it says what happened, with Undo')
        p.screenshot(path=os.path.join(OUT, f'issue_off_{W}.png'))
        p.evaluate("location.hash = '#/outreach/issues'"); p.wait_for_timeout(1200)
        row = p.locator('a.is-row', has_text='Free school meals for every student').first
        ok('Not in first visit' in row.inner_text(), f'issues{tag}: the index marks an issue that is left out')
        ok(not p.evaluate(OVER) or W == 320, f'issues{tag}: no sideways scroll (320 has an older overflow in the Outreach switcher)')
        p.screenshot(path=os.path.join(OUT, f'index_mark_{W}.png'))
        p.evaluate("location.hash = '#/issue/" + ISSUE + "'"); p.wait_for_timeout(1200)
        p.locator('label[for="is-fv"]').click(); p.wait_for_timeout(600)
        p.locator('.toastmsg .toastundo').click(); p.wait_for_timeout(600)
        ok(not p.locator('#is-fv').is_checked(), f'issue{tag}: Undo on switching it back on leaves it off again')

        ok(not leaks, f'all{tag}: nothing reached Supabase: {leaks[:2]}')
        ok(not errors, f'all{tag}: no console errors: {errors[:3]}')
        c.close()
    b.close()
print(f'\n{passed} passed, {failed} failed')
sys.exit(1 if failed else 0)
