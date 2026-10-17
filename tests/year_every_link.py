# The year in every bill link made from now (R-212 #18; R-110 began it, tests/year_links.py). Bill numbers start again at
# HB 1 every January, so a link copied now must still open this bill after 20 Jan 2027. In the sandbox served locally.
# Checks: a bill opened by its short address shows its year in the address bar, in place (no new history entry, Back
# still leaves the page); /testify keeps its walkthrough; every bill link on Home, Find, My bills and the bill page names
# its year; a stopped bill's share opens the bill, not its issue; the staff apps' public links and the post preview name
# the year.
#   python3 tests/year_every_link.py [base]     base defaults to http://localhost:8832/
import sys, os, json
from playwright.sync_api import sync_playwright
BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832/').rstrip('/') + '/'
PUB = BASE + 'track.html?demo=1'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
res = []
def ok(c, m): res.append(bool(c)); print('PASS' if c else 'FAIL', m)
def ready(pg):
    pg.wait_for_function("() => !!document.querySelector('main') && !document.querySelector('.skelpage') && !document.querySelector('.bl-skel')", timeout=60000); pg.wait_for_timeout(600)
SKIP = "() => { try { const w = JSON.parse(localStorage.getItem('hiphi_wiz') || '{}'); localStorage.setItem('hiphi_wiz', JSON.stringify({ ...w, done: true, step: 99 })); localStorage.setItem('hiphi_tour_bill', '{\"how\":\"test\"}'); localStorage.setItem('hiphi_tour_home', '{\"how\":\"test\"}'); } catch {} }"
snap = json.load(open(os.path.join(ROOT, 'demo', 'snapshot.json')))
YR = max(int(b.get('session_year') or 0) for b in snap['bills'])
hs = {}
for h in snap['hearings']:
    if h.get('status') == 'scheduled' and h.get('testimony_deadline', '') > '2026-03-16T19:00:00' and h['scheduled_at'] < '2026-03-28':
        hs.setdefault(h['bill_id'], []).append(h)
heard = next(b for b in snap['bills'] if b.get('position') not in (None, 'monitor') and int(b.get('session_year') or 0) == YR and b['id'] in hs)
NUM = heard['bill_number'].replace(' ', '')
SHORT = "() => [...document.querySelectorAll('a[href^=\"#/bill/\"]')].map(a => a.getAttribute('href')).filter(h => !/^#\\/bill\\/\\d{4}\\//.test(h))"
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx = br.new_context(viewport={'width': 1280, 'height': 900}); pg = ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(PUB + '#/'); ready(pg); pg.evaluate(SKIP)
    # ---- 1. the address bar names the year, in place ----
    pg.goto(PUB + '#/find'); ready(pg)
    n0 = pg.evaluate('history.length')
    pg.evaluate(f"location.hash = '#/bill/{NUM}'"); ready(pg)
    ok(pg.evaluate('location.hash') == f'#/bill/{YR}/{NUM}', f"the short address becomes #/bill/{YR}/{NUM}: {pg.evaluate('location.hash')}")
    ok(pg.evaluate('history.length') == n0 + 1, 'one history entry for the visit, none for the year (replaced in place)')
    ok(pg.locator('.bl-head').count() == 1, 'the bill page is drawn')
    pg.go_back(); ready(pg)
    ok(pg.evaluate('location.hash').startswith('#/find'), f"Back leaves the bill: {pg.evaluate('location.hash')}")
    # ---- 2. /testify keeps its ask in the address and opens it ----
    pg.goto(PUB + f'#/bill/{NUM}/testify'); ready(pg); pg.wait_for_timeout(2500)
    ok(pg.evaluate('location.hash') == f'#/bill/{YR}/{NUM}/testify', f"the ask stays in the address: {pg.evaluate('location.hash')}")
    ok(pg.evaluate("async () => !!(await import('./pub/core.js')).S.helper"), 'the testimony steps opened')
    # ---- 3. every bill link the pages draw names its year ----
    for where in ['#/', '#/find', '#/bills', f'#/bill/{YR}/{NUM}']:
        pg.goto(PUB + where); ready(pg)
        n = pg.evaluate("() => document.querySelectorAll('a[href^=\"#/bill/\"]').length"); bad = pg.evaluate(SHORT)
        ok(not bad, f'{where}: all {n} bill links name their year ({len(bad)} without: {bad[:3]})')
    # ---- 4. a stopped bill's share opens the bill; one still moving shares its issue, as before ----
    r = pg.evaluate("""async () => { const c = await import('./pub/core.js');
      // A bill HIPHI only watches (no share page of its own), once moving and once stopped: the same bill, two stages.
      const base = [...c.D.bills, ...(c.D.index || [])].find(x => c.issuesOf(x).length);
      const stopped = { ...base, hiphi_position: null, stage: 'dead' }, moving = { ...base, hiphi_position: null, stage: 'committee' };
      return { num: base.bill_number, yr: base.session_year, url: c.billShareUrl(stopped, 'follow'), other: c.billShareUrl(moving, 'follow') }; }""")
    ok(r['url'] and f"#/bill/{r['yr']}/{str(r['num']).replace(' ', '')}" in r['url'] and '#/issue/' not in r['url'], f"a stopped bill's share opens the bill: {r['url']}")
    ok('#/issue/' in r['other'], f"a bill still moving shares its issue: {r['other']}")
    ok(not errs, f'no page errors: {errs[:2]}')
    ctx.close(); br.close()
# ---- 5. the staff apps' public links (from the source: this test signs nobody in) ----
for d in ('staff', 'staff5'):
    src = ''.join(open(os.path.join(ROOT, d, f), encoding='utf-8').read() for f in ('public.js', 'bill.js', 'composer.js'))
    ok('pubRoute(b)' in src and "'#bill=' + u.b.bill_number" not in src and '!== SESSION_YEAR ? `${b.session_year}/`' not in src, f'{d}: public bill links and the post preview name the year')
print(f"\n{sum(res)}/{len(res)} passed")
sys.exit(0 if all(res) else 1)
