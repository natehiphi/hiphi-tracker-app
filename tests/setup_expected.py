# Staff v2, R-180 wave 3, Z1-6: a session-start step that is not due yet reads "Expected from <date>", is not counted as a problem,
# and the opening-weeks wording says "4 more syncs a day". Sandbox.   python3 tests/setup_expected.py [origin/staff.html]
import sys
from playwright.sync_api import sync_playwright
BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832/staff.html').split('#')[0]
passes, fails, errors = [], [], []
def ok(c, m): (passes if c else fails).append(('PASS ' if c else 'FAIL ') + m)
with sync_playwright() as pw:
    b = pw.chromium.launch()
    for W, H in ((1100, 900), (390, 844)):
        tag = f'@{W}'; c = b.new_context(viewport={'width': W, 'height': H}); p = c.new_page()
        p.on('pageerror', lambda e: errors.append(str(e)[:160]) if 'Failed to fetch' not in str(e) else None)
        p.goto(BASE + '?demo=1#/setup'); p.reload(); p.wait_for_selector('.st-ready', timeout=30000); p.wait_for_timeout(1500)
        t = p.inner_text('main')
        ok('Expected from Jan 10' in t and 'Expected from Jan 22' in t, f'{tag}: the dated steps say "Expected from Jan 10" and "Expected from Jan 22"')
        summ = p.inner_text('.st-sum')
        ok('not due yet' in summ, f'{tag}: the summary counts them apart ({summ!r})')
        rows = p.locator('.st-rrow').all_inner_texts()
        tod = [k for k, r in enumerate(rows) if r.startswith('To do')]; exp = [k for k, r in enumerate(rows) if r.startswith('Expected')]
        ok(tod and exp and min(exp) > max(tod), f'{tag}: they rank after every real to-do')
        i = exp[0]
        ok('Fix' not in rows[i] and 'Mark done' not in rows[i], f'{tag}: no Fix button on a step that is not due')
        p.goto(BASE + '?demo=1#/setup/sync'); p.wait_for_timeout(1200)
        s = p.inner_text('main')
        ok('4 more syncs a day until' in s and 'Sync every hour' not in s, f'{tag}: the sync page says "4 more syncs a day until"')
        # "Sort new bills": a bill with a hearing still ahead goes first (the page's own ordering, given a made-up queue)
        got = p.evaluate("""async () => { const m = await import('./staff/data.js'), t = await import('./staff/triage.js'); const S = m.S;
          S.hearings = [{ id: 'z', bill_id: 'B2', status: 'scheduled', scheduled_at: new Date(Date.now() + 864e5).toISOString() }, { id: 'y', bill_id: 'B3', status: 'scheduled', scheduled_at: new Date(Date.now() - 864e5).toISOString() }];
          return t.order([{ id: 'B1', bill_number: 'HB1', lookalike: { id: 1 } }, { id: 'B2', bill_number: 'HB2' }, { id: 'B3', bill_number: 'HB3' }]).map(r => r.id); }""")
        ok(got[0] == 'B2' and got[1:] == ['B1', 'B3'], f'{tag}: a new bill with a hearing ahead is sorted first, a past hearing does not count ({got})')
        c.close()
    b.close()
for l in passes + fails: print(l)
if errors: print('PAGE ERRORS', errors[:3]); sys.exit(1)
sys.exit(1 if fails else 0)
