# R-110: year-proof bill links, in the sandbox. Bill numbers start again at HB 1 every session, so the snapshot is
# served with one extra bill: a copy of a position bill under the same number, from the 2025 session. Checks that a
# number alone opens the current session's bill, that #/bill/2025/<n> opens the 2025 one, that the 2025 bill's own
# links carry its year, that a year with no such bill says so, that Find lists both, that an old #bill= link still
# opens the current bill, and that the share-page forwarder (404.html) keeps the year.
#   python3 tests/year_links.py [base]      base defaults to http://localhost:8832/track.html?demo=1
import sys, re, os
from playwright.sync_api import sync_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832/track.html?demo=1'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
res = []
def ok(c, m): res.append(bool(c)); print('PASS' if c else 'FAIL', m)
def ready(pg):
    pg.wait_for_function("() => !!document.querySelector('main') && !document.querySelector('.skelpage')", timeout=60000); pg.wait_for_timeout(500)
SKIP = "() => { try { const w = JSON.parse(localStorage.getItem('hiphi_wiz') || '{}'); localStorage.setItem('hiphi_wiz', JSON.stringify({ ...w, done: true, step: 99 })); localStorage.setItem('hiphi_tour_bill', '{\"how\":\"test\"}'); localStorage.setItem('hiphi_tour_home', '{\"how\":\"test\"}'); } catch {} }"
spaced = lambda n: re.sub(r'^([A-Z]+)(\d)', r'\1 \2', n)
state = {}
# The snapshot, with one bill from 2025 that shares its number with a 2026 position bill (the first one with a
# nickname and a companion, so the page has links to check). Nothing is written anywhere.
def patch(route):
    r = route.fetch(); data = r.json()
    src = next(b for b in data['bills'] if b.get('position') and b['position'] != 'monitor' and b.get('nickname') and (b.get('companions') or []))
    old = dict(src)
    old.update(id='r110-old-' + src['id'], session_year=2025, title='OLD SESSION COPY OF ' + (src.get('title') or ''),
               nickname='Old session copy', public_summary='A bill from the 2025 session that happens to share the number.')
    data['bills'].append(old)
    state['num'] = src['bill_number']; state['nick'] = src['nickname']
    state['only'] = next(b['bill_number'] for b in data['bills'] if b.get('position') and b['bill_number'] != src['bill_number'])
    route.fulfill(response=r, json=data)
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx = br.new_context(viewport={'width': 1280, 'height': 900})
    pg = ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.route(re.compile(r'.*/demo/snapshot\.json.*'), patch)
    pg.goto(BASE + '#/'); ready(pg); pg.evaluate(SKIP)
    num, sp = state['num'], spaced(state['num'])
    # 1. a number alone opens the current session's bill
    pg.goto(BASE + f'#/bill/{num}'); ready(pg); pg.wait_for_timeout(800)
    t = pg.locator('main').inner_text()
    ok('Old session copy' not in t and state['nick'] in t, f'#/bill/{num} opens the 2026 bill ({state["nick"]}), not the 2025 copy')
    ok(pg.locator('a[href^="#/bill/2025/"]').count() == 0, 'the 2026 bill links its companions without a year')
    # 2. the year opens that session's bill, and its links carry the year
    pg.goto(BASE + f'#/bill/2025/{num}'); ready(pg); pg.wait_for_timeout(800)
    t = pg.locator('main').inner_text()
    ok('Old session copy' in t, f'#/bill/2025/{num} opens the 2025 copy')
    ok(pg.locator('a[href^="#/bill/2025/"]').count() >= 1, 'the 2025 bill links its companions with the year')
    paths = pg.evaluate("async n => { const c = await import('./pub/core.js'); return c.D.bills.filter(b => b.bill_number === n).map(b => [b.session_year, c.billPath(b)]).sort(); }", num)
    ok(paths == [[2025, f'#/bill/2025/{num}'], [2026, f'#/bill/{num}']], f'billPath: the 2025 bill carries its year, the 2026 bill does not: {paths}')
    pg.goto(BASE + f'#/legislators?from=2025/{num}'); ready(pg)
    back = pg.locator('a.pp-back').first
    ok(back.count() == 1 and back.get_attribute('href') == f'#/bill/2025/{num}' and f'Back to {sp}' in back.inner_text(),
       'the legislators page goes back to the 2025 bill, named by its number: ' + (back.get_attribute('href') or '') + ' ' + (back.inner_text() if back.count() else ''))
    # 3. a year with no such bill says so
    only = state['only']
    pg.goto(BASE + f'#/bill/2025/{only}'); ready(pg); pg.wait_for_timeout(800)
    t = pg.locator('main').inner_text()
    ok(f'find {spaced(only)} from the 2025 session' in t, f'#/bill/2025/{only}: "We couldn’t find {spaced(only)} from the 2025 session"')
    # 4. an old #bill= link opens the current session's bill
    pg.goto(BASE + f'#bill={num}'); pg.reload(); ready(pg); pg.wait_for_timeout(800)   # an old link is rewritten at load, so load the page on it
    ok('Old session copy' not in pg.locator('main').inner_text() and pg.url.endswith(f'#/bill/{num}'), f'#bill={num} opens the current bill at #/bill/{num}')
    # 5. Find lists both, each under its own address
    pg.goto(BASE + f'#/find?q={num}'); ready(pg); pg.wait_for_timeout(1000)
    ok(pg.locator(f'a[href="#/bill/{num}"]').count() >= 1 and pg.locator(f'a[href="#/bill/2025/{num}"]').count() >= 1, 'Find lists both bills, each under its own address')
    # 6. the share-page forwarder (404.html, served by GitHub Pages for a page not built yet) keeps the year
    html = open(os.path.join(ROOT, '404.html'), encoding='utf-8').read()
    pg.route(re.compile(r'.*/(b|i)/.*'), lambda route: route.fulfill(status=404, content_type='text/html', body=html))
    pg.route(re.compile(r'.*/track\.html\?via=share.*'), lambda route: route.fulfill(status=200, content_type='text/html', body='<title>stub</title>'))
    origin = BASE.split('/track.html')[0]
    for path, want in [(f'/b/2025/{num}', f'#/bill/2025/{num}'), (f'/b/{num.lower()}', f'#/bill/{num}'), (f'/b/2025/{num}.html', f'#/bill/2025/{num}'), ('/i/vaping', '#/issue/vaping')]:
        pg.goto(origin + path); pg.wait_for_url(re.compile(r'track\.html'), timeout=15000)
        ok(pg.url == origin + '/track.html?via=share' + want, f'{path} forwards to track.html?via=share{want}: {pg.url}')
    ok(not errs, 'no page errors: ' + '; '.join(errs[:3]))
    br.close()
print(f'{sum(res)}/{len(res)} passed'); sys.exit(0 if all(res) else 1)
