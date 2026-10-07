# The plans' alerts sign-up keeps the promise and the small print beside the button (D1-6, R-180 wave 2), and Plan 1 promises no reminder (D1-1).
# python3 tests/plans_join.py [base_url]   (sandbox; plan 5 forced by ?ab=onb.p5, plan 1 by onb.p1)
# Checks: at 375x667 and 390x844 the consent small print (message rates, STOP) ends above the pinned button, with the example under the box;
# on a laptop the example stays above; Plan 1's choice offers "Add the hearing to my calendar" (never "Remind me"), saves a calendar file and
# goes on; nothing on the join screen says "remind"; "Not now" leaves Home without the alerts ask for the rest of the visit.
import sys, re
from playwright.sync_api import sync_playwright
BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832/track.html')
passes, fails, errors = [], [], []
def ok(c, m): (passes if c else fails).append(('PASS ' if c else 'FAIL ') + m)
def to_join(p, plan='p5', extra=''):
    p.goto(f'{BASE}?demo=1&restart&ab=onb.{plan}{extra}'); p.wait_for_selector('.st-tile', timeout=30000); p.wait_for_timeout(800)
    for _ in range(12):
        t = p.title()
        if t.startswith('Stay in the loop'): break
        if t.startswith('What do you care about') and p.locator('.st-tile').count(): p.locator('.st-tile').first.click(); p.wait_for_timeout(200)
        if t.startswith('Your choice') and p.locator('[data-obnot]').count(): p.click('[data-obnot]'); p.wait_for_timeout(1200); continue
        if p.locator('[data-stnext]').count(): p.click('[data-stnext]')
        p.wait_for_timeout(1200)
    p.wait_for_timeout(800)
GEOM = """()=>{const q=s=>{const e=document.querySelector(s);if(!e)return null;const r=e.getBoundingClientRect();return [Math.round(r.top),Math.round(r.bottom)]};return {input:q('#st-a-phone'),fine:q('.al-fine'),bar:q('.st-bar'),sample:q('.ob-sample'),form:q('#st-aform'),ex:document.querySelector('.ob-sample')&&document.querySelector('#st-aform').compareDocumentPosition(document.querySelector('.ob-sample'))}}"""
with sync_playwright() as pw:
    b = pw.chromium.launch()
    for w, h in ((375, 667), (390, 844)):
        c = b.new_context(viewport={'width': w, 'height': h}, is_mobile=True, has_touch=True); p = c.new_page()
        p.on('pageerror', lambda e: errors.append(str(e))); p.on('console', lambda m: errors.append(m.text[:160]) if m.type == 'error' and 'favicon' not in m.text else None)
        to_join(p); g = p.evaluate(GEOM)
        ok(g['fine'] and g['bar'] and g['fine'][1] <= g['bar'][0], f'{w}x{h}: the small print ends above the button ({g["fine"]} vs bar {g["bar"]})')
        ok(g['input'] and g['input'][1] < g['bar'][0], f'{w}x{h}: the number box is above the button too')
        ok(g['ex'] is not None and g['ex'] & 4, f'{w}x{h}: the example is under the box')
        t = p.inner_text('main'); ok('rates' in t.lower() and 'STOP' in t, f'{w}x{h}: message rates and STOP are in the small print')
        c.close()
    c = b.new_context(viewport={'width': 1440, 'height': 900}); p = c.new_page(); to_join(p); g = p.evaluate(GEOM)
    ok(g['ex'] is not None and g['ex'] & 2, 'laptop: the example stays above the box'); c.close()
    # Plan 1: the choice, then Not now and Home
    c = b.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True, accept_downloads=True); p = c.new_page()
    p.on('pageerror', lambda e: errors.append(str(e)))
    p.goto(f'{BASE}?demo=1&restart&ab=onb.p1'); p.wait_for_selector('.st-tile', timeout=30000); p.wait_for_timeout(800)
    for _ in range(12):
        st = p.title().split(' · ')[0]
        if st == 'Your choice': break
        if st == 'What do you care about?': p.locator('[data-stissue]').nth(3).click(); p.click('[data-stnext]')
        elif st == 'Find a bill': p.click('[data-stnext]'); p.wait_for_timeout(300); p.locator('[data-obfind]').first.click(); p.click('[data-stnext]')
        elif p.locator('[data-stnext]').count(): p.click('[data-stnext]')
        p.wait_for_timeout(1200)
    t = p.inner_text('main')
    ok(p.locator('[data-obcal]').count() == 1 and 'Add the hearing to my calendar' in t and 'remind' not in t.lower(), 'Plan 1: the choice offers the hearing in their calendar and promises no reminder')
    with p.expect_download(timeout=8000) as dl: p.click('[data-obcal]')
    ok(dl.value.suggested_filename.endswith('.ics'), f'it saves a calendar file ({dl.value.suggested_filename})')
    p.wait_for_timeout(1500); ok(p.title().startswith('Stay in the loop'), 'and goes on to the sign-up')
    ok('remind' not in p.inner_text('main').lower(), 'the sign-up promises no reminder')
    p.click('[data-stskip]'); p.wait_for_timeout(1500)
    for _ in range(6):
        if p.locator('#fx-moment:not([hidden]) #fx-mgo').count(): p.click('#fx-moment #fx-mgo'); p.wait_for_timeout(800)
        elif p.locator('[data-stnext]').count(): p.click('[data-stnext]'); p.wait_for_timeout(1000)
    flag = p.evaluate("import('/pub/core.js').then(m => !!m.S.nudgedThisVisit)")   # the flag Home's "Get hearing alerts" reads (home.js askBtn)
    ok(flag is True, 'after the sign-up was shown and "Not now" pressed, Home is told the visit has had its alerts ask (S.nudgedThisVisit)')
    b.close()
ok(not errors, 'no console errors' + ('' if not errors else ': ' + ' | '.join(errors[:4])))
print('\n'.join(passes + fails)); print(f'\n{len(passes)} passed, {len(fails)} failed')
sys.exit(1 if fails else 0)
