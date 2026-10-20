"""Find's stopped bills say how far they got, and the last column is HIPHI's position (R-212 #3).

The Analyst's walk (10/8): "No hearing in House Finance by Mar 6" was said of bills two committees had passed, or that had
passed the whole other chamber, or that the committee had heard and put on hold in 2025 (6 of 25 rows), and the column over
the stopped bills was "Your stance" with "Not said yet" in every row. Runs on the live data path by default (the practice
copy's stopped bills differ); the bills named are 2026 bills, so the check means nothing after the 2027 session replaces them.

  python3 tests/stop_reasons.py [http://localhost:8832]
"""
import os, sys
from playwright.sync_api import sync_playwright

HOST = sys.argv[1] if len(sys.argv) > 1 else os.environ.get('HOST', 'http://localhost:8832')
fails = passes = 0

def check(ok, what):
    global fails, passes
    print(('PASS ' if ok else 'FAIL ') + what)
    if ok: passes += 1
    else: fails += 1

WANT = {
    'HB 380': 'Passed 2 committees; no hearing in House Finance by Mar 6',
    'HB 2256': 'Passed 1 committee; no hearing in House Finance by Mar 6',
    'HB 756': 'Passed the House; no hearing in its Senate committees by Mar 30',
    'SB 1525': 'Put on hold by Senate Commerce and Consumer Protection in 2025, not taken up again',
    'HB 1116': 'No hearing in House Health by Feb 11',
}

with sync_playwright() as p:
    br = p.chromium.launch(); errs = []
    pg = br.new_page(viewport={'width': 1366, 'height': 900})
    pg.on('pageerror', lambda e: errs.append(str(e)))
    # The old Find, which ?rec=0 brings back (R-303); the redesign's search is checked after it.
    pg.goto(f'{HOST}/track.html?rec=0#/find?q=e-cigarette')
    pg.wait_for_function("() => document.querySelectorAll('.mb-row.why').length > 10", timeout=30000)
    pg.wait_for_timeout(1500)   # the stopped bills' old hearings arrive after the list (ensureStopHistory)
    pg.evaluate("document.querySelectorAll('details').forEach(d => d.open = true)")
    rows = pg.evaluate("[...document.querySelectorAll('.mb-row.why')].map(r => [r.querySelector('.mb-num')?.textContent, r.querySelector('.mb-why')?.textContent, r.querySelector('.mb-who')?.textContent])")
    got = {n: (w, who) for n, w, who in rows}
    for num, words in WANT.items():
        check(got.get(num, ('',))[0] == words, f'{num} says "{words}" (got "{got.get(num, ("",))[0]}")')
    check(not any('Not said yet' in (who or '') for _, _, who in rows), 'no stopped row says "Not said yet"')
    check(any('HIPHI' in (who or '') for _, _, who in rows), "stopped rows show HIPHI's position")
    hdrs = pg.locator('.mb-row.why').first.locator('xpath=ancestor::div[contains(@class,"mb-list")]').locator('.mb-hdr').text_content() or ''
    check('HIPHI’s position' in hdrs and 'Your stance' not in hdrs, f'the stopped list\'s column is "HIPHI’s position" ({hdrs!r})')
    # R-303, the redesign (everyone's since 19 Oct): search's "Bills that did not advance" says the same reason after the
    # number ("HB 2256 · Passed 1 committee; no hearing in House Finance by Mar 6"; Nate 19 Oct), not "Did not advance". It
    # lists only the bills on no issue shown above it, so it checks the ones it lists.
    pg.goto(f'{HOST}/track.html#/find?q=e-cigarette')
    pg.wait_for_selector('[data-rc-fold=find-gone] .rc-row', timeout=30000, state='attached')
    pg.wait_for_timeout(2500)   # the stopped bills' old hearings arrive after the list (ensureStopHistory), and repaint it
    pg.evaluate("document.querySelectorAll('details').forEach(d => d.open = true)")
    said = pg.evaluate("[...document.querySelectorAll('[data-rc-fold=find-gone] .rc-rstat')].map(e => e.textContent.replace(/\\u00a0/g, ' '))")
    rgot = dict(x.split(' · ', 1) for x in said if ' · ' in x)
    both = [n for n in WANT if n in rgot]
    check(both, f'redesign: the search fold lists some of the bills checked above ({both})')
    for num in both:
        check(rgot[num] == WANT[num], f'redesign: {num} says "{WANT[num]}" in search (got "{rgot[num]}")')
    check(said and not any(x.endswith('· Did not advance') for x in said), f'redesign: no row in the fold says only "Did not advance" ({len(said)} rows)')
    pg.goto(f'{HOST}/track.html#/bill/HB380')
    pg.wait_for_timeout(6000)
    body = pg.locator('body').inner_text()
    check('It passed its first 2 House committees, but the next one, the House Finance Committee, never scheduled a hearing on it.' in body,
          'HB 380\'s bill page says it passed its first 2 House committees')
    check(not errs, f'no page errors {errs}')
    br.close()

print(f'\n{passes} passed, {fails} failed')
sys.exit(1 if fails else 0)
