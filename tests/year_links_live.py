# R-110 on live data, signed out: a 2026 bill opens with and without its year, a year with no such bill says so, and
# the share pages (b/<n> and b/2026/<n>) forward to the exact bill. Nothing is written; the visit is not counted.
#   python3 tests/year_links_live.py [base]   base defaults to https://natehiphi.github.io/hiphi-tracker-app/
import sys, re
from playwright.sync_api import sync_playwright
BASE = (sys.argv[1] if len(sys.argv) > 1 else 'https://natehiphi.github.io/hiphi-tracker-app/').rstrip('/') + '/'
NUM = 'SB2175'   # became law in 2026 (R-066), so it stays on the public page
res = []
def ok(c, m): res.append(bool(c)); print('PASS' if c else 'FAIL', m)
def ready(pg):
    pg.wait_for_function("() => !!document.querySelector('main') && !document.querySelector('.skelpage') && !document.querySelector('.bl-skel')", timeout=60000); pg.wait_for_timeout(500)
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx = br.new_context(viewport={'width': 1280, 'height': 900})
    ctx.add_init_script("Object.defineProperty(navigator, 'globalPrivacyControl', { value: true });")
    pg = ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(BASE + f'track.html#/bill/2026/{NUM}'); ready(pg)
    t = pg.locator('main').inner_text()
    ok('SB 2175' in t and 'couldn’t find' not in t, f'#/bill/2026/{NUM} opens the bill')
    ok(pg.locator('a[href^="#/bill/2026/"]').count() == 0, 'a current-session bill writes its links without the year')
    pg.goto(BASE + f'track.html#/bill/{NUM}'); ready(pg)
    ok('SB 2175' in pg.locator('main').inner_text(), f'#/bill/{NUM} opens the bill')
    pg.goto(BASE + f'track.html#/bill/2025/{NUM}'); ready(pg)
    ok('find SB 2175 from the 2025 session' in pg.locator('main').inner_text(), f'#/bill/2025/{NUM} says there is no such bill in the 2025 session')
    # Since R-169 a page opens its ask: a bill with a hearing ahead #/bill/2026/<n>/testify, a stopped one its issue. Either
    # way the page names the exact bill (the year) or its issue, and the browser goes where the page says.
    for path in [f'b/{NUM}', f'b/2026/{NUM}', f'b/2026/{NUM}-follow']:
        want = re.search(r'var t = "[^"#]*(#[^"]*)"', pg.request.get(BASE + path + '.html').text()).group(1)   # .html: any server
        ok(want.startswith(f'#/bill/2026/{NUM}') or want.startswith('#/issue/'), f'{path} names the exact bill or its issue: {want}')
        pg.goto(BASE + path + '.html'); pg.wait_for_url(re.compile(r'track\.html'), timeout=20000)
        ok(pg.url == BASE + 'track.html?via=share' + want, f'{path} forwards where it says: {pg.url}')
    ok(not errs, 'no page errors: ' + '; '.join(errs[:3]))
    br.close()
print(f'{sum(res)}/{len(res)} passed'); sys.exit(0 if all(res) else 1)
