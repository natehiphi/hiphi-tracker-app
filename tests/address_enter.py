# R-212 #21, after the fresh-eyes review of 19 Oct: on the street-address steps (#/next/legs and the first visit's "you"
# step), a town and Enter must save nothing and say what to type; a street address and Enter still finds the two.
# python3 tests/address_enter.py [base]   (base: a server root, default http://localhost:8832/)
import sys, json
from playwright.sync_api import sync_playwright

BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832/').rstrip('/') + '/track.html'
ok = bad = 0
def check(name, cond, got=''):
    global ok, bad
    if cond: ok += 1; print('PASS', name)
    else: bad += 1; print('FAIL', name, got)

with sync_playwright() as p:
    br = p.chromium.launch(); errs = []
    for live in [False, True]:
        tag = 'live' if live else 'practice'
        pg = br.new_page(viewport={'width': 390, 'height': 844}); pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(BASE + ('' if live else '?demo=1') + '#/next/legs'); pg.wait_for_timeout(3000)
        box = pg.locator('[data-nxaddr]')
        if not box.count(): check(f'{tag}: the address step opens', False, pg.url); pg.close(); continue
        box.fill('Kailua'); box.press('Enter'); pg.wait_for_timeout(3500)
        saved = pg.evaluate("localStorage.getItem('hiphi_districts')")
        check(f'{tag}: a town and Enter saves nothing', not saved, saved)
        check(f'{tag}: and says to add the house number', 'Add your house number and street' in pg.inner_text('body'))
        box = pg.locator('[data-nxaddr]'); box.fill('415 S Beretania St'); box.press('Enter'); pg.wait_for_timeout(6000)
        saved = json.loads(pg.evaluate("localStorage.getItem('hiphi_districts')") or 'null')
        check(f'{tag}: a street address and Enter finds the districts', bool(saved and saved.get('senate') and saved.get('house')), saved)
        pg.close()
    check('no page errors', not errs, errs)
    br.close()
print(f'\n{ok} passed, {bad} failed'); sys.exit(1 if bad else 0)
