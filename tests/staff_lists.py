# Staff v2, Session setup > Advanced > People's lists (migration 103), in the staff sandbox: paste a link, confirm, see it
# under Turned off, turn it back on. Desktop and phone.
#   python3 tests/staff_lists.py [base] [shots]      base defaults to http://localhost:8832/staff.html?demo=1
import sys, os
from playwright.sync_api import sync_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832/staff.html?demo=1'
SHOTS = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out')
res = []
def ok(c, m): res.append(bool(c)); print('PASS' if c else 'FAIL', m)
with sync_playwright() as p:
    br = p.chromium.launch()
    for w, h, tag in [(1280, 900, 'desk'), (390, 844, 'phone')]:
        ctx = br.new_context(viewport={'width': w, 'height': h}, is_mobile=(w < 500), has_touch=(w < 500))
        pg = ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(BASE + '#/setup/lists'); pg.wait_for_function("() => !!document.querySelector('#st-ul-link')", timeout=60000); pg.wait_for_timeout(400)
        ok('People’s lists' in pg.locator('h1').first.inner_text(), f'{tag}: the page opens: {pg.locator("h1").first.inner_text()}')
        pg.locator('[data-stsave]').click(); pg.wait_for_timeout(300)
        ok(pg.locator('#st-ul-link-err').count() == 1, f'{tag}: an empty link is refused in words')
        pg.locator('#st-ul-link').fill('https://natehiphi.github.io/hiphi-tracker-app/track.html#/l/' + 'a' * 40)
        pg.locator('#st-ul-why').fill('Testing')
        pg.locator('[data-stsave]').click(); pg.wait_for_timeout(500)
        dlg = pg.locator('[data-yes]')
        ok(dlg.count() == 1, f'{tag}: it asks first')
        dlg.click(); pg.wait_for_timeout(700)
        txt = pg.locator('main').inner_text()
        ok('Turned off' in txt and 'A list from the sandbox' in txt and 'Testing' in txt, f'{tag}: the list shows under Turned off, with the reason')
        pg.screenshot(path=f'{SHOTS}/staff_ul_{tag}.png')
        pg.locator('[data-ulon]').first.click(); pg.wait_for_timeout(400); pg.locator('[data-yes]').click(); pg.wait_for_timeout(700)
        ok(pg.locator('[data-ulon]').count() == 0, f'{tag}: Turn back on takes it off the list')
        ok(pg.evaluate("document.documentElement.scrollWidth") <= w, f'{tag}: nothing wider than the screen')
        ok(not errs, f'{tag}: no page errors {errs[:2]}')
        ctx.close()
    br.close()
print(f"\n{sum(res)} passed, {len(res) - sum(res)} failed")
