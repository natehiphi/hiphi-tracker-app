# R-042: on a laptop the staff bill page pins only its slim top bar (Back, the bill's number once the heading has gone,
# Previous / Next) and the tab strip; the heading, ribbon and status sentence scroll away. Sandbox, four widths.
import sys
from playwright.sync_api import sync_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832/staff.html?demo=1'
ok = fail = 0
def check(c, m):
    global ok, fail
    print('PASS' if c else 'FAIL', m); ok += bool(c); fail += (not c)
M = """() => { const r = s => document.querySelector(s)?.getBoundingClientRect(); const hdr = r('.sv-hdr'), top = r('.bw-top'), tabs = r('.bw-tabs'),
  num = document.querySelector('.bw-topnum'), aside = r('.bw-aside .sv-stick'), th = [...document.querySelectorAll('.bw-pwt thead th')].map(e => e.getBoundingClientRect()).find(x => x.height > 0);
  const links = [...document.querySelectorAll('.bw-tabs a')].map(a => a.getBoundingClientRect());
  return { hdrB: hdr.bottom, topT: top.top, topB: top.bottom, tabsT: tabs.top, tabsB: tabs.bottom, vh: innerHeight,
    numOn: getComputedStyle(num).visibility === 'visible', asideT: aside ? aside.top : null, thT: th ? th.top : null,
    tabsShown: links.filter(l => l.height > 0 && l.bottom <= tabs.bottom + 1 && l.right <= tabs.right + 1).length }; }"""
with sync_playwright() as p:
    b = p.chromium.launch()
    for w, h in [(1024, 768), (1100, 800), (1280, 800), (1440, 900)]:
        pg = b.new_page(viewport={'width': w, 'height': h}); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(BASE + '#/bill/SB2175/activity'); pg.reload(); pg.wait_for_timeout(3000)
        a = pg.evaluate(M)
        check(not a['numOn'], f'{w}: at the top the top bar does not repeat the number (the heading shows it)')
        check(a['tabsShown'] == 5, f'{w}: all five tabs visible ({a["tabsShown"]})')
        pg.mouse.wheel(0, 1200); pg.wait_for_timeout(700)
        a = pg.evaluate(M)
        check(abs(a['topT'] - a['hdrB']) <= 1, f'{w}: the top bar pins right under the header ({a["topT"]:.0f} vs {a["hdrB"]:.0f})')
        check(abs(a['tabsT'] - a['topB']) <= 1, f'{w}: the tabs pin right under the top bar, no gap or overlap ({a["tabsT"]:.0f} vs {a["topB"]:.0f})')
        pinned = a['tabsB'] - a['hdrB']
        check(pinned <= 100, f'{w}: {pinned:.0f}px pinned under the header (was about 250)')
        check(a['numOn'], f'{w}: scrolled, the top bar names the bill')
        check(a['tabsShown'] == 5, f'{w}: scrolled, all five tabs still visible ({a["tabsShown"]})')
        check(a['asideT'] is None or a['asideT'] >= a['topB'] - 1, f'{w}: Next up docks under the top bar, not behind it ({a["asideT"]})')
        pg.screenshot(path=f'tests/out/billhead_{w}_activity.png')
        # Pathway: its table header row sticks under the tabs
        pg.locator('.bw-tabs [data-tab="pathway"]').click(); pg.wait_for_timeout(900)
        pg.mouse.wheel(0, 500); pg.wait_for_timeout(600)
        a = pg.evaluate(M)
        if a['thT'] is not None:
            check(a['thT'] >= a['tabsB'] - 1, f'{w}: the Pathway table header is never hidden behind the tabs ({a["thT"]:.0f} vs {a["tabsB"]:.0f})')
        pg.screenshot(path=f'tests/out/billhead_{w}_pathway.png')
        # back to the top: the number leaves the top bar again
        pg.evaluate('window.scrollTo(0, 0)'); pg.wait_for_timeout(500)
        check(not pg.evaluate(M)['numOn'], f'{w}: back at the top, the top bar drops the number')
        check(not errs, f'{w}: no page errors ' + '; '.join(errs))
        pg.close()
    b.close()
print(f'\n{ok} passed, {fail} failed')
