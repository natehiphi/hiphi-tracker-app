# A stop asked for by number, from any browser (D1-3, R-180 wave 2; backend migration 156).
# python3 tests/stop_number.py [base_url]   (sandbox)
# Checks: More > Get alerts has a quiet "Stop texts to a number" fold under the box, with and without a saved number; a bad number is
# refused in plain words and nothing is stopped; a good number says it is stopped (and that the sandbox sent nothing); stopping this
# device's own number clears it here and the page shows the box again with the answer kept; the text terms page says stopping works
# from every browser. No console errors.
import os, sys
from playwright.sync_api import sync_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832/track.html'
passes, fails, errors = [], [], []
def ok(c, m): (passes if c else fails).append(('PASS ' if c else 'FAIL ') + m)
with sync_playwright() as pw:
    b = pw.chromium.launch(); c = b.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True); p = c.new_page()
    p.on('pageerror', lambda e: errors.append(str(e)))
    p.on('console', lambda m: errors.append(m.text[:160]) if m.type == 'error' and 'favicon' not in m.text else None)
    p.goto(BASE + '?demo=1&codes=0&restart#/alerts'); p.wait_for_selector('#mr-al-phone', timeout=10000)
    ok(p.locator('.mr-stopnum').count() == 1 and not p.locator('#mr-sn-phone').is_visible(), 'the box with no number saved: a closed "Stop texts to a number" fold')
    p.click('.mr-stopnum summary'); p.wait_for_selector('#mr-sn-phone', state='visible')
    p.fill('#mr-sn-phone', '12345'); p.click('#mr-sn-go'); p.wait_for_timeout(500)
    ok('number' in p.inner_text('#mr-sn-msg').lower() and 'stopped' not in p.inner_text('#mr-sn-msg').lower(), 'a bad number is refused in plain words: ' + repr(p.inner_text('#mr-sn-msg')[:80]))
    p.fill('#mr-sn-phone', '(808) 555-0123'); p.click('#mr-sn-go'); p.wait_for_timeout(600)
    t = p.inner_text('#mr-sn-msg')
    ok('(808) 555-0123' in t and 'stopped' in t and 'sandbox' in t, 'a good number: says it is stopped, and that the sandbox sent nothing: ' + repr(t))
    # this device's own number
    p.fill('#mr-al-phone', '808-555-0199'); p.click('#mr-al-send'); p.wait_for_timeout(1200)
    p.goto(BASE + '?demo=1&codes=0#/alerts'); p.wait_for_timeout(1500)
    if p.locator('.mr-stopnum').count() == 0: ok(False, 'the saved-number page has the fold')
    else:
        ok(p.locator('.mr-alon').count() == 1 and 'every browser' in p.inner_text('.mr-alon'), 'with a number saved: the page says stopping ends it from every browser')
        p.click('.mr-stopnum summary'); p.fill('#mr-sn-phone', '(808) 555-0199'); p.click('#mr-sn-go'); p.wait_for_timeout(900)
        ok(p.locator('#mr-al-phone').count() == 1 and 'stopped' in p.inner_text('#mr-sn-msg'), 'stopping this device\'s own number shows the box again and keeps the answer')
    p.goto(BASE.rsplit('/', 1)[0] + '/text-terms.html'); p.wait_for_timeout(600)
    ok('every browser' in p.inner_text('body'), 'the text terms say a stop works from every browser')
    b.close()
ok(not errors, 'no console errors' + ('' if not errors else ': ' + ' | '.join(errors[:4])))
print('\n'.join(passes + fails)); print(f'\n{len(passes)} passed, {len(fails)} failed')
sys.exit(1 if fails else 0)
