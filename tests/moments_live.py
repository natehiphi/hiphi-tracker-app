# R-046 on the live data path (no sandbox), signed out: the session page, More's row, the privacy page's counts, and
# Home between sessions loading without errors (the public data now carries notice_posted_at).
#   python3 tests/moments_live.py [base]      base defaults to http://localhost:8832/track.html (live data, signed out)
import sys
from playwright.sync_api import sync_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832/track.html'
res = []
def ok(c, m): res.append(bool(c)); print('PASS' if c else 'FAIL', m)
with sync_playwright() as p:
    br = p.chromium.launch(); ctx = br.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
    ctx.add_init_script("() => { try { localStorage.setItem('hiphi_wiz', JSON.stringify({ done: true, step: 99 })); localStorage.setItem('hiphi_tour_bill', '1'); localStorage.setItem('hiphi_tour_home', '1'); } catch {} }")
    pg = ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    hdr = []; pg.on('response', lambda r: hdr.append(r.url) if 'public_all_hearings' in r.url and r.status >= 400 else None)
    pg.goto(BASE + '#/recap'); pg.wait_for_function("() => !!document.querySelector('main h1') && !document.querySelector('.skelpage')", timeout=60000); pg.wait_for_timeout(800)
    h1 = pg.locator('main h1').first.inner_text()
    ok('Your 2026 session' in h1, f'the session page loads on the real data: {h1}')
    ok('Your session adds up here' in pg.locator('main').inner_text(), 'someone with no history gets the plain start, not empty lists')
    pg.goto(BASE + '#/more'); pg.wait_for_timeout(1500)
    ok(pg.locator('a.row[href="#/recap"]').count() == 1, 'More has Your session')
    pg.goto(BASE + '#/privacy'); pg.wait_for_timeout(1500)
    ok('session page was opened' in pg.locator('main').inner_text(), 'the privacy page names the new counts')
    pg.goto(BASE + '#/'); pg.wait_for_timeout(3500)
    ok(pg.locator('main h1').count() >= 1 and not hdr, f'Home loads, and the hearings it reads answer ({len(hdr)} errors)')
    ok(not errs, f'no page errors {errs[:2]}')
    br.close()
print(f"\n{sum(res)} passed, {len(res) - sum(res)} failed")
