# Legislators by name and title (R-212 #40; the District Watcher's walk of 10/8), in the practice copy served locally.
#   N1  the header search: "Senator Chang" suggests Sen. Stanley Chang (and no representative); "Rep. Kila" Rep. Darius K. Kila;
#       "Chang" alone still finds him; "rep" alone suggests no person
#   N2  Find's results page for "Senator Chang" lists him under People and committees
#   N3  Your lawmakers (the finder): the label names all four ways in; "Senator Chang" suggests him and only senators;
#       "Senate 9" still finds the district
#   N4  no page errors
#   python3 tests/legislator_names.py [base] [outdir]
import sys, os
from playwright.sync_api import sync_playwright
BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832/').rstrip('/')
OUT = sys.argv[2] if len(sys.argv) > 2 else '.'
res = []
def ok(c, m): res.append(bool(c)); print('PASS' if c else 'FAIL', m)
INIT = """(() => { if (sessionStorage.getItem('__set')) return; sessionStorage.setItem('__set', '1');
  for (const k of Object.keys(localStorage)) if (k.startsWith('hiphi_')) localStorage.removeItem(k);
  localStorage.setItem('hiphi_wiz_demo', JSON.stringify({ done: true, issues: ['Tobacco & E-Cigarettes'] }));
  localStorage.setItem('hiphi_tour_home_demo', '{"how":"test"}'); localStorage.setItem('hiphi_tour_bill_demo', '{"how":"test"}'); })();"""
with sync_playwright() as p:
    br = p.chromium.launch(); errs = []
    c = br.new_context(viewport={'width': 1366, 'height': 900}); c.add_init_script(INIT)
    pg = c.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(f'{BASE}/track.html?demo=1#/'); pg.wait_for_selector('#hq', timeout=90000); pg.wait_for_timeout(1500)
    def sug(q):
        hq = pg.locator('#hq'); hq.fill(''); hq.click(); hq.type(q, delay=30); pg.wait_for_timeout(1500)
        return pg.locator('#hq-sg').inner_text() if pg.locator('#hq-sg').count() else ''
    t = sug('Senator Chang')
    ok('Sen. Stanley Chang' in t and 'Rep.' not in t, f'N1 "Senator Chang" suggests Sen. Stanley Chang ({t[:120]!r})')
    pg.screenshot(path=os.path.join(OUT, 'header-senator-chang.png'))
    t = sug('Rep. Kila'); ok('Rep. Darius K. Kila' in t, 'N1 "Rep. Kila" suggests Rep. Darius K. Kila')
    t = sug('Chang'); ok('Sen. Stanley Chang' in t, 'N1 "Chang" alone still finds him')
    t = sug('rep'); ok('Sen.' not in t and 'Rep. ' not in t, 'N1 "rep" alone suggests no person')
    pg.goto(f'{BASE}/track.html?demo=1#/find?q=Senator%20Chang'); pg.wait_for_timeout(3000)
    ok('Sen. Stanley Chang' in pg.locator('#main').inner_text(), 'N2 Find lists him for "Senator Chang"')
    pg.goto(f'{BASE}/track.html?demo=1#/legislators'); pg.wait_for_selector('#pp-q', timeout=30000); pg.wait_for_timeout(800)
    lab = pg.locator('label[for="pp-q"]').inner_text()
    ok(all(w in lab for w in ['street address', 'town', 'district', 'name']), f'N3 the finder\'s label names the ways in ({lab!r})')
    q = pg.locator('#pp-q'); q.fill('Senator Chang'); pg.wait_for_timeout(800)
    t = pg.locator('#pp-sug').inner_text()
    ok('Sen. Stanley Chang' in t and 'Rep.' not in t, f'N3 the finder takes "Senator Chang" ({t[:120]!r})')
    pg.screenshot(path=os.path.join(OUT, 'finder-senator-chang.png'))
    q.fill('Senate 9'); pg.wait_for_timeout(800)
    ok('Senate District 9' in pg.locator('#pp-sug').inner_text(), 'N3 "Senate 9" still finds the district')
    ok(not errs, f'N4 no page errors {errs[:3]}')
    br.close()
print(f'{sum(res)}/{len(res)} passed')
sys.exit(0 if all(res) else 1)
