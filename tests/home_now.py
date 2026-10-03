# Home's Now card and twin bills (R-131, the assessment's P7) in the sandbox: the first card counts the deadlines due the
# same day ("1 of 3 due today"), and a House bill with its Senate twin both open are one card naming the twin.
#   python3 tests/home_now.py [base]     base defaults to http://localhost:8832/track.html?demo=1
import sys, json, os
from playwright.sync_api import sync_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832/track.html?demo=1'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
res = []
def ok(c, m): res.append(bool(c)); print('PASS' if c else 'FAIL', m)
def ready(pg): pg.wait_for_function("() => !!document.querySelector('main') && !document.querySelector('.skelpage')", timeout=60000); pg.wait_for_timeout(600)
SKIP = "() => { try { const w = JSON.parse(localStorage.getItem('hiphi_wiz') || '{}'); localStorage.setItem('hiphi_wiz', JSON.stringify({ ...w, done: true, step: 99 })); localStorage.setItem('hiphi_tour_bill', '{\"how\":\"test\"}'); localStorage.setItem('hiphi_tour_home', '{\"how\":\"test\"}'); } catch {} }"
snap = json.load(open(os.path.join(ROOT, 'demo', 'snapshot.json')))
by = lambda n: next(b for b in snap['bills'] if b['bill_number'] == n)
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx = br.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True); ctx.add_init_script(f"({SKIP})()"); pg = ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    # 1. three bills with testimony due the sandbox's Monday: the first card says "1 of 3 due today"
    pg.goto(BASE + '#/'); ready(pg)
    pg.evaluate("async ids => { const c = await import('./pub/core.js'); for (const id of ids) c.S.direct.add(id); c.recomputeWatch(); c.saveLocal(); }", [by(n)['id'] for n in ('SB3234', 'SB3025', 'SB3076')])
    pg.goto(BASE + '#/'); pg.reload(); ready(pg)   # back to Home: the first visit had moved the address to its step 1
    ofn = pg.locator('.acard.focus .due .ofn, .hm-now .acard .due .ofn').first
    ok(ofn.count() == 1 and 'of 3 due today' in ofn.inner_text(), f'the first card counts the day: {ofn.inner_text() if ofn.count() else "no count"}')
    ok(pg.locator('.acard .due .ofn').count() == 1, 'only the first card carries the count')
    # 2. twins: HB 2121 and its Senate twin SB 2175 (the sandbox has no hearing for the twin: one is added for the check)
    pg.evaluate("""async nums => { const c = await import('./pub/core.js'); const hb = c.D.bills.find(b => b.bill_number === nums[0]), sb = c.D.bills.find(b => b.bill_number === nums[1]);
      const h = c.D.hearings.find(x => x.bill_id === hb.id && x.status === 'scheduled' && new Date(x.scheduled_at) > Date.now());
      const code = Object.keys(c.S.committees).find(k => c.S.committees[k].chamber === 'S') || 'HHS';
      c.D.hearings.push({ ...h, id: 'twin-test-hearing', bill_id: sb.id, committee: code, scheduled_at: new Date(new Date(h.scheduled_at).getTime() + 864e5).toISOString(), testimony_deadline: new Date(new Date(h.testimony_deadline).getTime() + 864e5).toISOString() });
      c.S.direct.clear(); c.S.direct.add(hb.id); c.S.direct.add(sb.id); c.recomputeWatch(); c.saveLocal(); }""", ['HB2121', 'SB2175'])
    pg.evaluate("async () => { const c = await import('./pub/core.js'); await c.loadBills(); c.app.render(); }"); pg.wait_for_timeout(1200)
    cards = pg.locator('.hm-now .acard'); n = cards.count()
    twin = pg.locator('.hm-now .acard .twin')
    ok(n == 1 and twin.count() == 1 and 'SB 2175' in twin.inner_text() and 'twin' in twin.inner_text().lower(), f'the twins are one card naming the other ({n} card(s); twin line: {twin.inner_text()[:80] if twin.count() else "none"})')
    ok(pg.locator('.hm-now .acard .achead').first.inner_text().strip() != '' and 'HB 2121' in pg.locator('.hm-now .acard').first.inner_text(), 'the sooner deadline, HB 2121, leads the card')
    ok(not errs, 'no page errors: ' + '; '.join(errs[:2]))
    br.close()
print(f'{sum(res)}/{len(res)} passed'); sys.exit(0 if all(res) else 1)
