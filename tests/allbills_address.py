# Every bill HIPHI tracks keeps its search and filters in the address (R-212 #43; the Analyst's walk of 10/8), in the
# practice copy, on a laptop and a phone:
#   A1  an address with filters opens the list already narrowed: the box and dropdowns say what was asked, the count follows
#   A2  choosing a filter or typing writes the address in place (no new history entries) and names the session
#   A3  a reload keeps the search and the filters
#   A4  a bill opened from the list, then Back, returns to the same narrowed list
#   A5  Clear filters (and clearing the box) gives back plain #/allbills and the whole list
#   A6  an old or mistyped address (unknown topic, position, stage, session) opens the whole list, never an empty one
#   A7  the line under the title says "45 of 734 bills" once narrowed (the critic: a shared link said 734)
#   A8  phone: a link with filters opens on the bills, not the dropdowns: what is set is a row of buttons (44px) that each
#       take one off, then "Show every bill"; the first bill within the first screen. Laptop: the dropdowns, no row
#   A9  an earlier session's link says which session it is and leads to this one's; Clear keeps that session in the address
#   A10 no page errors
#   python3 tests/allbills_address.py [base] [outdir]
import sys
from playwright.sync_api import sync_playwright
BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832/').rstrip('/')
res = []
def ok(c, m): res.append(bool(c)); print('PASS' if c else 'FAIL', m)
URL = f'{BASE}/track.html?demo=1#/allbills'
COUNT = "document.getElementById('ab-count').textContent.trim()"
ROWS = "document.querySelectorAll('#ab-list .mb-row').length"
SELS = "[...document.querySelectorAll('[data-ab-f]')].map(s => s.value).join(',')"
def n_of(pg): return int(pg.evaluate(COUNT).split()[0])
def ready(pg): pg.wait_for_selector('#ab-list .mb-row', timeout=90000); pg.wait_for_timeout(800)
with sync_playwright() as p:
    br = p.chromium.launch(); errs = []
    for w, h, tag in [(1366, 900, 'laptop'), (390, 844, 'phone')]:
        c = br.new_context(viewport={'width': w, 'height': h}); pg = c.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(URL); ready(pg); total = n_of(pg)
        ok(total > 100 and pg.evaluate('location.hash') == '#/allbills', f'{tag}: plain #/allbills is the whole list ({total})')
        # A1
        pg.goto(URL + '?topic=family&position=support&q=keiki'); ready(pg)
        ok(pg.evaluate(SELS) == 'family,support,' and pg.input_value('#ab-q') == 'keiki', f'{tag} A1: the box and dropdowns say what the address asked ({pg.evaluate(SELS)})')
        n1 = n_of(pg)
        ok(0 < n1 < total and pg.evaluate(ROWS) > 0, f'{tag} A1: the list is narrowed ({n1} of {total})')
        lede = pg.inner_text('#ab-lede')
        ok(lede == f'2026 session · {n1} of {total} bills', f'{tag} A7: the line under the title ({lede})')
        if tag == 'phone':
            ok(pg.evaluate("document.getElementById('ab-filters').classList.contains('shut')"), f'{tag} A8: the dropdowns stay behind Filters')
            chips = pg.evaluate("[...document.querySelectorAll('#ab-set .ab-chip')].map(b => b.innerText.trim() + '|' + Math.round(b.getBoundingClientRect().height))")
            ok(chips == ['Family & Economic Security|44', 'Supports|44'] or (len(chips) == 2 and all(int(c.split('|')[1]) >= 44 for c in chips)), f'{tag} A8: what is set, as buttons at least 44px ({chips})')
            top = pg.evaluate("document.querySelector('#ab-list .mb-row').getBoundingClientRect().top + scrollY")
            ok(top < 600, f'{tag} A8: the first bill starts within the first screen ({top:.0f}px)')
            pg.click('#ab-set [data-ab-unset=pos]'); pg.wait_for_timeout(400)
            ok(pg.evaluate(SELS) == 'family,,' and 'position' not in pg.evaluate('location.hash') and n_of(pg) > n1, f'{tag} A8: a button takes its filter off ({pg.evaluate("location.hash")})')
            pg.click('#ab-set [data-ab-every]'); pg.wait_for_timeout(400)
            ok(pg.evaluate('location.hash') == '#/allbills' and n_of(pg) == total and pg.input_value('#ab-q') == '' and not pg.evaluate("document.querySelector('#ab-set .ab-chip')"), f'{tag} A8: Show every bill clears the search and filters')
            pg.goto(URL + '?topic=family&position=support&q=keiki'); ready(pg)
            pg.click('[data-ab-fbtn]'); pg.wait_for_timeout(300)
        else:
            ok(pg.evaluate("!!document.getElementById('ab-f-topic').offsetParent && !document.querySelector('#ab-set')?.offsetParent"), f'{tag} A8: the dropdowns show, no row of buttons')
        # A2
        hl = pg.evaluate('history.length')
        pg.fill('#ab-q', ''); pg.wait_for_timeout(500)
        pg.select_option('#ab-f-stand', 'hear'); pg.wait_for_timeout(400)
        hs = pg.evaluate('location.hash')
        ok(hs == '#/allbills?topic=family&position=support&stands=hear&session=2026', f'{tag} A2: the address follows the filters and names the session ({hs})')
        num = pg.evaluate("document.querySelector('#ab-list .mb-row a').getAttribute('href').split('/').pop().replace(/^([A-Z]+)/, '$1 ')")
        pg.fill('#ab-q', num); pg.wait_for_timeout(500)
        hs = pg.evaluate('location.hash')
        ok('q=' + num.replace(' ', '%20') in hs and pg.evaluate('history.length') == hl, f'{tag} A2: typing writes the words in place, no new history entries ({hs})')
        # A3
        n3 = n_of(pg); pg.reload(); ready(pg)
        ok(n3 > 0 and pg.input_value('#ab-q') == num and pg.evaluate(SELS) == 'family,support,hear' and n_of(pg) == n3, f'{tag} A3: a reload keeps the search and filters ({n3})')
        # A4
        pg.fill('#ab-q', ''); pg.wait_for_timeout(500); n4 = n_of(pg)
        pg.click('#ab-list .mb-row a'); pg.wait_for_timeout(1500)
        ok(pg.evaluate('location.hash').startswith('#/bill/'), f'{tag} A4: a row opens its bill')
        pg.go_back(); ready(pg)
        ok(pg.evaluate(SELS) == 'family,support,hear' and n_of(pg) == n4 and 'stands=hear' in pg.evaluate('location.hash'), f'{tag} A4: Back returns to the same narrowed list ({n4})')
        # A5
        if tag == 'phone': pg.click('[data-ab-fbtn]'); pg.wait_for_timeout(300)   # the dropdowns wait behind Filters (A8)
        pg.click('[data-ab-fclear]'); pg.wait_for_timeout(400)
        ok(pg.evaluate('location.hash') == '#/allbills' and n_of(pg) == total, f'{tag} A5: Clear filters gives back #/allbills and every bill')
        # A6
        pg.goto(URL + '?topic=nope&position=foo&stands=bar&session=1999'); ready(pg)
        ok(n_of(pg) == total and pg.evaluate(SELS) == ',,' and pg.evaluate('location.hash') == '#/allbills', f'{tag} A6: a mistyped address opens the whole list and the address is cleaned ({pg.evaluate("location.hash")})')
        # A9 (the practice copy has 2026 bills only, so an earlier session is empty)
        pg.goto(URL + '?session=2025&topic=tobacco'); pg.wait_for_selector('#ab-lede', timeout=90000); pg.wait_for_timeout(800)
        t9 = pg.inner_text('.ab')
        ok('HIPHI didn’t track 2025 bills on this tracker.' in t9 and pg.evaluate("!!document.querySelector('.ab-newer a[href=\"#/allbills\"]')") and 'See the 2026 bills' in t9, f'{tag} A9: an earlier session says so and leads to 2026\'s bills')
        pg.click('.ab-newer a'); ready(pg)
        ok(n_of(pg) == total and pg.evaluate('location.hash') == '#/allbills', f'{tag} A9: the button opens this session\'s list')
        c.close()
    ok(not errs, f'A10: no page errors {errs[:2]}')
    br.close()
print(f'\n{sum(res)} passed, {len(res) - sum(res)} failed'); sys.exit(0 if all(res) else 1)
