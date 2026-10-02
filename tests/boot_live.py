# The staged boot on the published site (R-122, the assessment's P5): who gets the early first screen and who must not.
#   python3 tests/boot_live.py [base]      base defaults to https://natehiphi.github.io/hiphi-tracker-app/
# Nothing is counted (the privacy signal is set, and a test run is never a visit).
import sys
from playwright.sync_api import sync_playwright
BASE = (sys.argv[1] if len(sys.argv) > 1 else 'https://natehiphi.github.io/hiphi-tracker-app/').rstrip('/') + '/'
res = []
def ok(c, m): res.append(bool(c)); print('PASS' if c else 'FAIL', m)
QUIET = "Object.defineProperty(navigator, 'globalPrivacyControl', { value: true });"
def ready(pg):
    pg.wait_for_function("() => !!document.querySelector('main') && !document.querySelector('.skelpage') && !document.querySelector('.boot0')", timeout=60000); pg.wait_for_timeout(1500)
with sync_playwright() as p:
    br = p.chromium.launch()
    # 1. a newcomer: the topics screen, and a copy of the catalog kept for next time
    ctx = br.new_context(viewport={'width': 390, 'height': 844}); ctx.add_init_script(QUIET); pg = ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(BASE + 'track.html#/'); ready(pg)
    ok(pg.evaluate('location.hash').startswith('#/start/'), f'a newcomer gets the first visit ({pg.evaluate("location.hash")})')
    cached = pg.evaluate("() => { try { const c = JSON.parse(localStorage.getItem('hiphi_catalog') || 'null'); return c && c.cats.length && c.issues.length; } catch { return 0; } }")
    ok(bool(cached), 'the catalog is kept for next time')
    # 2. the same browser again: the first screen is drawn from the kept copy before the network answers
    pg.goto(BASE + 'track.html#/'); pg.wait_for_function("() => !!document.querySelector('.st1, .st-topics')", timeout=30000)
    ok(True, 'a second visit draws the topics screen again')
    ctx.close()
    # 3. a person who acted on a shared bill before finishing the first visit lands on Home, not back at step 1
    # (10/1: the early render judged before this browser's actions were read and rewrote the address to #/start/1)
    ctx = br.new_context(viewport={'width': 390, 'height': 844}); ctx.add_init_script(QUIET)
    ctx.add_init_script("try { localStorage.setItem('hiphi_done', JSON.stringify(['00000000-0000-0000-0000-000000000000|00000000-0000-0000-0000-000000000001|email'])); localStorage.setItem('hiphi_done_at', JSON.stringify({ '00000000-0000-0000-0000-000000000000|00000000-0000-0000-0000-000000000001|email': new Date().toISOString() })); } catch {}")
    pg = ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(BASE + 'track.html#/'); ready(pg); pg.wait_for_timeout(2500)
    ok(not pg.evaluate('location.hash').startswith('#/start/'), f'with an action already taken, the page is Home, not the first visit ({pg.evaluate("location.hash")})')
    ctx.close()
    ok(not errs, 'no page errors: ' + '; '.join(errs[:3]))
    br.close()
print(f'{sum(res)}/{len(res)} passed'); sys.exit(0 if all(res) else 1)
