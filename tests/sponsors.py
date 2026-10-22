# Sponsors cleaned, up top, clickable, and "Bills they introduced" (R-212 #41; the District Watcher's walk of 10/8), in the practice copy.
#   S1  a bill page says who introduced it under the bill's name: the first name links to their page, "and N others" (HB 1573)
#   S2  "N others" opens every name in place, each a link; the export's split initial ("LEE", "M.") is gone: Rep. Mike Lee, no "M."
#   S3  said once (A-14): the first step under See all steps keeps only its day, More details has no "Introduced by"
#   S4  a lawmaker's page has "Bills they introduced": the count in its preview, HIPHI's bills first, rows that open the bill
#   S5  phone: no sideways scroll, "N others" at least 44px tall
#   S6  no page errors
#   python3 tests/sponsors.py [base] [outdir]
import sys, os, re
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
    for w, h, tag in [(1366, 900, 'laptop'), (390, 844, 'phone')]:
        c = br.new_context(viewport={'width': w, 'height': h}); c.add_init_script(INIT)
        pg = c.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(f'{BASE}/track.html?demo=1#/bill/HB1573'); pg.wait_for_selector('.bl-rspons', timeout=90000); pg.wait_for_timeout(800)
        line = pg.locator('.bl-rspons')
        t = line.inner_text()
        first = line.locator('a').first
        if tag == 'laptop':
            ok(t.startswith('Introduced by Rep. ') and re.search(r'and \d+ others$', t), f'S1 the line under the name ({t!r})')
            ok(re.match(r'#/legislator/\d+\?from=', first.get_attribute('href') or ''), 'S1 the first name links to their page')
        else:
            bb = line.locator('[data-bl-spons]').bounding_box()
            ok(bb and bb['height'] >= 44, f'S5 "N others" is 44px tall on a phone ({bb and round(bb["height"])})')
            ok(pg.evaluate('document.documentElement.scrollWidth <= innerWidth'), 'S5 no sideways scroll on a phone')
            pg.screenshot(path=os.path.join(OUT, 'sponsors-bill-phone.png'))
        line.locator('[data-bl-spons]').click(); pg.wait_for_timeout(500)
        t = pg.locator('.bl-rspons').inner_text(); n = pg.locator('.bl-rspons a').count()
        if tag == 'laptop':
            ok('Rep. Mike Lee' in t and not re.search(r'\bM\.(,| and|$)', t), f'S2 every name, Rep. Mike Lee and no lone "M." ({t[:160]!r}...)')
            ok(n >= 8 and n == len(re.findall(r'Rep\. ', t)), f'S2 each name a link ({n})')
            pg.screenshot(path=os.path.join(OUT, 'sponsors-bill.png'))
            main = pg.locator('#main').inner_text()
            ok('By Rep.' not in main, 'S3 the first step does not repeat who introduced it')
            ok('Introduced by' not in pg.locator('.bl-rgrps, .bl-rfold').all_inner_texts().__str__(), 'S3 More details has no "Introduced by"')
            pg.goto(f'{BASE}/track.html?demo=1#/legislator/157'); pg.wait_for_selector('[data-rc-fold="pp-filed"]', timeout=30000)
            pg.wait_for_function("() => !/Looking them up/.test(document.querySelector('[data-rc-fold=\"pp-filed\"]').innerText)", timeout=30000)
            f = pg.locator('[data-rc-fold="pp-filed"]')
            prev = f.locator('summary').inner_text()
            ok(re.search(r'Introduced \d+ bills, \d+ of them HIPHI’s', prev), f'S4 the preview ({prev!r})')
            f.locator('summary').click(); pg.wait_for_timeout(400)
            rows = f.locator('.rc-rows').first.inner_text()
            ok(rows.split('\n')[1].find('HIPHI') > 0, f'S4 HIPHI\'s bills first ({rows[:80]!r})')
            ok('HIPHI bills they also signed' in f.inner_text() and 'that another lawmaker introduced' in f.inner_text(), 'S4 what they signed on to is said')
            pg.screenshot(path=os.path.join(OUT, 'sponsors-filed.png'), full_page=True)
            f.locator('.rc-rows a').first.click(); pg.wait_for_timeout(1500)
            ok('#/bill/' in pg.url, f'S4 a row opens the bill ({pg.url})')
        c.close()
    ok(not errs, f'S6 no page errors {errs[:3]}')
    br.close()
print(f'{sum(res)}/{len(res)} passed')
sys.exit(0 if all(res) else 1)
