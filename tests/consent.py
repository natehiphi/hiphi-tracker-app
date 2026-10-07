# R-101 rule 1 (Nate 10/1): the sign-in page's "Keep me updated" starts empty; a hearing-alert ask turns on only hearing
# alerts (C-4). Sandbox only: it sends nothing and keeps the choices in this browser.
#   python3 tests/consent.py [base]      base defaults to http://localhost:8832/track.html?demo=1
import sys
from playwright.sync_api import sync_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832/track.html?demo=1'
res = []
def ok(c, m): res.append(bool(c)); print('PASS' if c else 'FAIL', m)
with sync_playwright() as p:
    br = p.chromium.launch(); pg = br.new_page(viewport={'width': 390, 'height': 844}); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(BASE + '#/'); pg.wait_for_timeout(2500)
    pg.evaluate("() => { localStorage.setItem('hiphi_wiz', JSON.stringify({ done: true, step: 99 })); localStorage.setItem('hiphi_tour_bill', '1'); localStorage.setItem('hiphi_tour_home', '1'); }")
    pg.goto(BASE + '#/signin'); pg.reload(); pg.wait_for_function("() => !!document.querySelector('#mr-si-keep')", timeout=60000)
    ok(not pg.locator('#mr-si-keep').is_checked(), 'the sign-in page: "Keep me updated" starts empty')
    ok('Without it, your email only keeps your issues' in pg.locator('main').inner_text(), 'and says what leaving it empty means')
    pg.locator('#mr-email').fill('tester@example.com'); pg.locator('#mr-si-send').click(); pg.wait_for_timeout(800)
    c = pg.evaluate("JSON.parse(localStorage.getItem('hiphi_consent_pending') || 'null')")
    ok({k: c[k] for k in ('hearing_alerts', 'action_alerts')} == {'hearing_alerts': False, 'action_alerts': False} and c.get('source') == 'sign_in', f'sent with the box empty: no email choices, and the source is the sign-in page ({c})')
    got = pg.evaluate("async () => { const c = await import('./pub/core.js'); localStorage.removeItem('hiphi_consent_pending'); await c.sendEmailLink('tester@example.com', { hearing_alerts: true }); return JSON.parse(localStorage.getItem('hiphi_consent_pending')); }")
    ok({k: got[k] for k in ('hearing_alerts', 'action_alerts')} == {'hearing_alerts': True, 'action_alerts': False}, f'a hearing-alert ask turns on hearing alerts only ({got})')
    ok(not errs, f'no page errors {errs[:2]}')
    br.close()
print(f"\n{sum(res)} passed, {len(res) - sum(res)} failed")
