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
    p.on('console', lambda m: errors.append(m.text[:160]) if m.type == 'error' and 'favicon' not in m.text and m.text != 'TypeError: Failed to fetch' else None)   # the switches' fetch, cut off when the check reloads right after arriving (not a page fault)
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
    # a later visit (a reload): right after saving, the page leads with the next step and keeps the fold for later (R-229)
    # R-303: with a number saved, the redesign's "Your alerts" (pub/rec/alerts.js yoursView) is the page: "Stop texts to this
    # phone" for this number, then the closed fold "Not your phone? Stop texts to another number" (consent: a stop must always be reachable). The old page's rules below
    # keep guarding the way back (?rec=0).
    p.goto(BASE + '?demo=1&codes=0#/alerts'); p.reload(); p.wait_for_timeout(1500)
    ok(p.locator('.ya [data-mr-alstop]').count() == 1, 'with a number saved, Your alerts has Stop texts to this phone')
    ok('Stop texts to this phone' in p.inner_text('.ya-foot') and 'Not your phone? Stop texts to another number' in p.inner_text('.ya .mr-stopnum summary'), 'Your alerts: the two stops are told apart (this phone; another number)')
    ok(p.locator('.ya .mr-stopnum').count() == 1 and not p.locator('#mr-sn-phone').is_visible(), 'the saved-number page (Your alerts) has the "Stop texts to a number" fold, closed')
    end = p.text_content('.ya-end')
    ok(end.count('every device') == 1 and 'every browser' not in end and 'Reply STOP to any text to end them.' in p.inner_text('.ya-foot'), 'Your alerts says once, in the fold, that a stop works on every device; the foot keeps only the STOP line')
    p.click('.ya .mr-stopnum summary'); p.fill('#mr-sn-phone', '(808) 555-0177'); p.click('#mr-sn-go'); p.wait_for_timeout(700)
    ok('stopped' in p.inner_text('#mr-sn-msg') and p.locator('.ya [data-mr-alstop]').count() == 1, 'Your alerts: another number is stopped and this one stays')
    p.click('.ya .mr-stopnum summary') if p.locator('.ya .mr-stopnum[open]').count() == 0 else None
    p.fill('#mr-sn-phone', '(808) 555-0199'); p.click('#mr-sn-go'); p.wait_for_timeout(900)
    ok(p.locator('[data-mr-alstop]').count() == 0 and p.locator('.mr-stopnum[open]').count() == 1 and '555-0199' in p.inner_text('#mr-sn-msg'),
       'Your alerts: stopping this device\'s own number redraws the page without it, the fold open with its answer')
    p.fill('#mr-al-phone', '808-555-0199') if p.locator('#mr-al-phone').count() else None
    if p.locator('#mr-al-send').count(): p.click('#mr-al-send'); p.wait_for_timeout(1200)
    p.goto(BASE + '?demo=1&codes=0&rec=0#/alerts'); p.reload(); p.wait_for_timeout(1500)
    if p.locator('.mr-stopnum').count() == 0: ok(False, 'the old saved-number page (?rec=0) has the fold')
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
