# Staff v2, Session setup > Tests > Tester sheet (R-185): a room of testers, each group on the versions Nate picks, a
# link and a QR code per group, side by side, and a sheet to print. In the staff sandbox at five sizes, then the links
# opened on the practice copy to prove each forces what its card says.
#   python3 tests/room.py [base] [shots]      base defaults to http://localhost:8832/staff.html?demo=1
import sys, os, re
from playwright.sync_api import sync_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832/staff.html?demo=1'
SHOTS = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out')
ROOT = BASE.split('staff.html')[0]
res = []
def ok(c, m): res.append(bool(c)); print('PASS' if c else 'FAIL', m)
# printHtml calls print() in a hidden frame; this keeps the page it would print instead of opening the dialog.
CATCH_PRINT = """() => { window.__printed = null; new MutationObserver((ms, o) => { for (const m of ms) for (const n of m.addedNodes)
  if (n.tagName === 'IFRAME') { n.contentWindow.print = () => { window.__printed = n.contentDocument.documentElement.outerHTML; }; o.disconnect(); } })
  .observe(document.body, { childList: true }); }"""
urls = lambda pg: pg.eval_on_selector_all('[data-rmqr]', 'bs => bs.map(b => b.dataset.url)')
def pick(pg, sel, val):
    pg.locator(sel).click(); pg.wait_for_timeout(350)
    pg.locator(f'dialog [data-pv="{val}"]').click(); pg.wait_for_timeout(500)
def sheet_values(pg):
    return pg.eval_on_selector_all('dialog [data-pv]', 'bs => bs.map(b => b.dataset.pv)')
def close_sheet(pg):
    pg.keyboard.press('Escape'); pg.wait_for_timeout(350)
with sync_playwright() as p:
    br = p.chromium.launch()
    for w, h, tag in [(1440, 900, 'desk'), (1280, 800, 'desk1280'), (1024, 768, 'desk1024'), (390, 844, 'phone'), (320, 640, 'phone320')]:
        full = tag == 'desk' or tag == 'phone'
        ctx = br.new_context(viewport={'width': w, 'height': h}, is_mobile=(w < 500), has_touch=(w < 500))
        ctx.grant_permissions(['clipboard-read', 'clipboard-write'], origin=ROOT.rstrip('/'))
        pg = ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(BASE + '#/setup/room'); pg.wait_for_selector('.rm-group', timeout=60000); pg.wait_for_timeout(600)
        ok(pg.locator('h1').first.inner_text().strip() == 'Tester sheet', f'{tag}: the page opens')
        ok(pg.locator('.rm-group').count() == 2, f'{tag}: a new sheet has two groups (the first-visit versions switched on)')
        u = urls(pg)
        ok(u[0].endswith('track.html?demo=1&restart&abrest=today&ab=onb.today') and u[1].endswith('track.html?demo=1&restart&abrest=today&ab=onb.p1'), f'{tag}: today’s and Plan 1, on the practice copy, every other test at today’s (R-192): {u}')
        pg.wait_for_function("() => [...document.querySelectorAll('[data-rmqr]')].every(b => b.querySelector('svg'))", timeout=20000)
        ok(True, f'{tag}: every group’s QR code is drawn')
        top = pg.evaluate("() => Math.round(document.querySelector('.rm-group').getBoundingClientRect().top)")
        ok(top <= 400, f'{tag}: the first group starts at {top}px (A-1, limit 400)')
        ok(pg.evaluate("document.documentElement.scrollWidth") <= w, f'{tag}: nothing wider than the screen')
        if w >= 1100:
            ok(pg.locator('.st-nav2 a[aria-current="page"]').inner_text().strip() == 'Tests', f'{tag}: Tests stays marked in the list of parts')
        if w < 600:
            ok(pg.locator('.st-crumb, .hdr a').filter(has_text='Tests').count() >= 1, f'{tag}: the way back says Tests')
        if tag == 'desk':
            tops = pg.eval_on_selector_all('.rm-group', 'cs => cs.map(c => Math.round(c.getBoundingClientRect().top))')
            ok(len(set(tops)) == 1, f'{tag}: the groups sit side by side, level: {tops}')
        if not full:
            pg.screenshot(path=f'{SHOTS}/room_{tag}.png'); ok(not errs, f'{tag}: no page errors {errs[:2]}'); ctx.close(); continue

        # Add a group: on today's version of everything, focus on its heading
        pg.locator('[data-rmadd]').click(); pg.wait_for_timeout(500)
        ok(pg.locator('.rm-group').count() == 3, f'{tag}: Add a group adds Group 3')
        ok(pg.evaluate("document.activeElement?.id") == 'rm-h-2', f'{tag}: focus goes to the new group')
        ok('today’s version of everything' in pg.locator('.rm-group').nth(2).inner_text().lower(), f'{tag}: the new group says it is today’s version of everything')
        if tag == 'desk':
            tops = pg.eval_on_selector_all('.rm-group', 'cs => cs.map(c => Math.round(c.getBoundingClientRect().top))')
            ok(len(set(tops)) == 1, f'{tag}: three groups fit side by side on a laptop: {tops}')
        # On today's first visit, the other screens include the first visit's own tests and not the plans' sign-up
        pg.locator('[data-rmscreen="2"]').click(); pg.wait_for_timeout(350)
        v = sheet_values(pg); close_sheet(pg)
        ok({'end', 'fv', 'email', 'rank', 'share', 'home'} <= set(v) and 'join' not in v, f'{tag}: today’s first visit offers its own screens, not the plans’ sign-up: {v}')
        pick(pg, '[data-rmpick="2|onb"]', 'p2')
        ok(pg.evaluate("document.activeElement?.dataset?.rmpick") == '2|onb', f'{tag}: focus comes back to the chip')
        pg.locator('[data-rmscreen="2"]').click(); pg.wait_for_timeout(350)
        v = sheet_values(pg)
        ok('join' in v and not ({'end', 'fv', 'email'} & set(v)), f'{tag}: on a plan, the plans’ sign-up is offered and the screens it replaces are not: {v}')
        pg.locator('dialog [data-pv="share"]').click(); pg.wait_for_timeout(600)
        ok(sheet_values(pg)[0] == 'summary', f'{tag}: then the share message’s versions, today’s first')
        pg.locator('dialog [data-pv="deadline"]').click(); pg.wait_for_timeout(500)
        pg.locator('[data-rmscreen="2"]').click(); pg.wait_for_timeout(350); pg.locator('dialog [data-pv="join"]').click(); pg.wait_for_timeout(600)
        pg.locator('dialog [data-pv="watch"]').click(); pg.wait_for_timeout(500)
        c1 = pg.locator('.rm-group').nth(0).inner_text()
        ok('The share message' in c1 and '(today’s)' in c1 and 'Only met on a plan' in c1, f'{tag}: Group 1 shows the same rows, at today’s version or not met, so the cards compare line by line')
        u = urls(pg)
        ok(u[2].endswith('ab=onb.p2,share.deadline,join.watch'), f'{tag}: Group 3’s link forces Plan 2, the deadline message and the sign-up’s B: {u[2]}')
        card = pg.locator('.rm-group').nth(2).inner_text()
        ok('Plan 2' in card and 'Starts with the deadline' in card and 'today’s version of everything' not in card.lower(), f'{tag}: Group 3’s card says how it differs')
        # Back to today's first visit: the plans' sign-up no longer shows, so it leaves the link
        pick(pg, '[data-rmpick="2|onb"]', 'today')
        u = urls(pg)
        ok(u[2].endswith('ab=onb.today,share.deadline'), f'{tag}: back on today’s first visit, the sign-up choice is dropped: {u[2]}')
        pick(pg, '[data-rmpick="2|onb"]', 'p2')
        pick(pg, '[data-rmpick="2|share"]', 'summary')
        ok(pg.locator('[data-rmpick="2|share"]').count() == 0 and urls(pg)[2].endswith('ab=onb.p2'), f'{tag}: picking today’s version takes a screen off the card')
        pick(pg, '[data-rmpick="2|onb"]', 'p2')   # unchanged, a no-op
        pg.locator('[data-rmscreen="2"]').click(); pg.wait_for_timeout(350); pg.locator('dialog [data-pv="share"]').click(); pg.wait_for_timeout(600)
        pg.locator('dialog [data-pv="deadline"]').click(); pg.wait_for_timeout(500)
        # A plan replaces the first visit's own screens: the choice is taken off with a word and Undo
        pg.locator('[data-rmscreen="0"]').click(); pg.wait_for_timeout(350); pg.locator('dialog [data-pv="end"]').click(); pg.wait_for_timeout(600)
        pg.locator('dialog [data-pv="home"]').click(); pg.wait_for_timeout(500)
        pg.locator('[data-rmpick="0|onb"]').click(); pg.wait_for_timeout(350)
        ok('Four ways to help' in pg.locator('dialog').inner_text(), f'{tag}: the first-visit picker says what each plan is')
        pg.locator('dialog [data-pv="p4"]').click(); pg.wait_for_timeout(700)
        t = pg.locator('#toast').inner_text()
        ok('A plan replaces How the first visit ends' in t, f'{tag}: switching to a plan says which choice it took off: {t[:80]}')
        pg.locator('#toast button', has_text='Undo').click(); pg.wait_for_timeout(500)
        ok(urls(pg)[0].endswith('ab=onb.today,end.home'), f'{tag}: Undo puts today’s first visit and the choice back: {urls(pg)[0]}')
        pick(pg, '[data-rmpick="0|end"]', 'today')
        # Copy link
        pg.locator('[data-rmcopy="2"]').click(); pg.wait_for_timeout(400)
        clip = pg.evaluate("navigator.clipboard.readText()")
        ok(clip == urls(pg)[2], f'{tag}: Copy link copies Group 3’s link')
        pg.screenshot(path=f'{SHOTS}/room_{tag}.png', full_page=True)

        # The printed sheet: a page comparing the groups, then one page per group that never names its version
        pg.evaluate(CATCH_PRINT); pg.locator('[data-stsave]').click(); pg.wait_for_function('() => !!window.__printed', timeout=20000)
        html = pg.evaluate('window.__printed')
        heads = re.findall(r'<th scope="col">(Group \d)</th>', html)
        ok(heads == ['Group 1', 'Group 2', 'Group 3'], f'{tag}: the comparison has a column per group: {heads}')
        ok('First visit' in html and 'The share message' in html and 'Plan 2: A bill’s journey' in html and 'Starts with the deadline' in html, f'{tag}: its rows are the first visit and the share message')
        pages = re.findall(r'<div class="pg">([\s\S]*?)</div>', html)
        ok(len(pages) == 3 and all('<svg' in x for x in pages), f'{tag}: one page per group, each with its QR code ({len(pages)})')
        ok(not any(re.search(r'Plan \d|deadline|Today’s|ab=|track\.html', x) for x in pages), f'{tag}: the groups’ pages never say which version it is, nor show the link')
        ok(all('press Share' in x for x in pages) and 'Every group is also asked to' in html, f'{tag}: every group is told how to reach the share message, the same words for all')
        ok('>The link</th>' in html and html.count('track.html?demo=1&amp;restart') >= 3 and '>What we saw</th>' in html, f'{tag}: the comparison page has each group’s link and a "What we saw" row')
        if tag == 'desk':
            pp = ctx.new_page(); pp.set_content(html); pp.pdf(path=f'{SHOTS}/room_sheet.pdf', format='Letter'); pp.close()
            ok(True, f'{tag}: the sheet saved as tests/out/room_sheet.pdf to look at')

        # The live site: every test named, so no coin toss is left
        pg.locator('[data-seg="rmwhere"][data-val="live"]').click(); pg.wait_for_timeout(500)
        u = urls(pg)
        n = pg.evaluate("() => (window.__abN = document.querySelectorAll('[data-rmpick]').length)")
        ok(all('demo=1' not in x and '?ab=' in x for x in u), f'{tag}: live links leave the practice copy')
        ok(all(len(x.split('?ab=')[1].split(',')) == 10 for x in u), f'{tag}: each live link names all ten tests (with R-184\'s save and R-187\'s layout): {u[0]}')
        ok('testers’ links' in pg.locator('.rm-foot').inner_text(), f'{tag}: the page says where live visits are listed')
        pg.locator('[data-seg="rmwhere"][data-val="demo"]').click(); pg.wait_for_timeout(500)

        # Remove a group, Undo; Start over, Undo
        pg.locator('[data-rmmore="1"]').click(); pg.wait_for_timeout(350)
        pg.locator('dialog .sv-menu button', has_text='Remove this group').click(); pg.wait_for_timeout(500)
        ok(pg.locator('.rm-group').count() == 2 and 'moved up one' in pg.locator('#toast').inner_text(), f'{tag}: Remove takes Group 2 off and says the others moved up')
        pg.locator('#toast button', has_text='Undo').click(); pg.wait_for_timeout(500)
        ok(pg.locator('.rm-group').count() == 3 and urls(pg)[1].endswith('onb.p1'), f'{tag}: Undo puts it back')
        pg.locator('[data-rmreset]').click(); pg.wait_for_timeout(500)
        ok(pg.locator('.rm-group').count() == 2, f'{tag}: Start over goes back to two groups')
        pg.locator('#toast button', has_text='Undo').click(); pg.wait_for_timeout(500)
        ok(pg.locator('.rm-group').count() == 3 and 'share.deadline' in urls(pg)[2], f'{tag}: Undo brings the three groups back')
        # Kept: away to Tests and back
        pg.goto(BASE + '#/setup/tests'); pg.wait_for_selector('.ab-card', timeout=30000)
        link = pg.locator('[data-abroom]')
        ok(link.count() == 1, f'{tag}: the Tests page has the way to the tester sheet')
        link.click(); pg.wait_for_selector('.rm-group'); pg.wait_for_timeout(400)
        ok(pg.locator('.rm-group').count() == 3, f'{tag}: the groups are still there after leaving the page')
        ok(not errs, f'{tag}: no page errors {errs[:2]}')
        ctx.close()

    # Each link, opened as a tester: the practice copy starts fresh on the versions its card says
    ctx = br.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True); pg = ctx.new_page()
    for q, want in [('ab=onb.p2,share.deadline', {'onb': 'p2', 'share': 'deadline'}), ('ab=onb.today', {'onb': 'today'})]:
        pg.goto(ROOT + 'track.html?demo=1&restart&' + q); pg.wait_for_timeout(2500)
        st = pg.evaluate("JSON.parse(localStorage.getItem('hiphi_ab_demo') || '{}')")
        ok(all(st.get('arms', {}).get(k) == v and st.get('forced', {}).get(k) for k, v in want.items()), f'tester link {q}: forces {want}')
        ok('#/start/' in pg.url, f'tester link {q}: opens the first visit from the start ({pg.url.split("#")[-1]})')
    ctx.close()
    br.close()
print(f"\n{sum(res)} passed, {len(res) - sum(res)} failed")
