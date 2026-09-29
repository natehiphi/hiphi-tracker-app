# R-094: the suggested bill on Home and Find, ranked by the same numbers as the first visit's issues (pub/core.js
# WEIGHT, billWeight, recommendations). python3 tests/recommend.py [host]   (sandbox; its clock sits mid-March 2026)
# Checks: only bills with testimony still due are suggested (no stuck-in-committee leftovers); bills on the person's own
# issues come first, then what HIPHI most wants, then the soonest; staff's silent pre-tick lifts a bill by 25; a bill in
# a top-priority issue carries the +30; followed bills, "Not for me" (on a suggestion or on an issue's bill) and bills the
# person sides against HIPHI on are never suggested; Find's first card is the top suggestion.
import sys
from playwright.sync_api import sync_playwright
HOST = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832'
URL = HOST + '/track.html?demo=1'
TOUR_SEEN = "try{localStorage.setItem('hiphi_tour_bill','1');localStorage.setItem('hiphi_tour_bill_demo','1')}catch(e){}"
ok = fail = 0
def check(c, m):
    global ok, fail
    print('PASS' if c else 'FAIL', m); ok += bool(c); fail += (not c)

RECS = """async () => { const c = await import('./pub/core.js'); await c.loadPool(); const now = Date.now();
  return c.recommendations(100).map(r => ({ id: r.b.id, n: r.b.bill_number, pos: r.b.hiphi_position, kind: r.kind, when: r.when,
    mine: r.mine, weight: r.weight, score: r.score, due: r.when > now, top: c.topPriorityBill(r.b), promo: c.promotedBill(r.b) })); }"""

def ordered(rs):
    return all((a['score'], -a['when']) >= (b['score'], -b['when']) for a, b in zip(rs, rs[1:]))

with sync_playwright() as p:
    br = p.chromium.launch(); errs = []
    def fresh():
        ctx = br.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True); ctx.add_init_script(TOUR_SEEN)
        pg = ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(URL + '#/find'); pg.wait_for_timeout(3500); return pg

    # 1. Someone new: nothing picked, nothing followed.
    pg = fresh(); rs = pg.evaluate(RECS)
    check(len(rs) >= 5, f'the sandbox has suggestions to rank ({len(rs)})')
    check(all(r['kind'] == 'testify' and r['due'] for r in rs), 'every suggestion has testimony still due (no stuck-in-committee leftovers)')
    check(ordered(rs), 'ordered by weight, then soonest due')
    check(not any(r['mine'] for r in rs), 'nothing counts as "your issues" for someone who picked nothing')
    tops = [r for r in rs if r['top']]
    check(bool(tops) and all(r['weight'] >= 50 for r in tops), f'a bill in a top-priority issue carries the +30 ({len(tops)} of them)')
    strong = [r for r in rs if r['pos'] == 'strongly_support']
    check(all(r['weight'] >= 40 for r in strong), 'a strongly supported bill starts at 40')
    first = pg.evaluate("document.querySelector('.fd-voices [data-card]')?.dataset.card || ''")
    check(bool(rs) and first.startswith(rs[0]['id'] + '|'), f"Find's first card is the top suggestion ({rs[0]['n'] if rs else '-'})")

    # 2. Staff pre-tick a plain bill near the bottom: it rises by exactly 25, silently.
    low = next((r for r in reversed(rs) if not r['top'] and not r['promo']), None)   # the last plain one: room to rise
    if low:
        rs2 = pg.evaluate("""async id => { const c = await import('./pub/core.js'); c.S.pool.bills.find(b => b.id === id).hiphi_recommended = true;
          return c.recommendations(100).map(r => ({ id: r.b.id, weight: r.weight, score: r.score, when: r.when })); }""", low['id'])
        after = next(r for r in rs2 if r['id'] == low['id'])
        check(after['weight'] == low['weight'] + 25, f"staff's pre-tick adds 25 ({low['n']}: {low['weight']} -> {after['weight']})")
        check([r['id'] for r in rs2].index(low['id']) < [r['id'] for r in rs].index(low['id']), 'and moves it up the list')
        check(pg.evaluate("!/recommend/i.test(document.body.innerText)"), 'nothing on the page says "recommended"')

    # 3. Leave-outs: followed, "Not for me" on a suggestion, "Not for me" on an issue's bill, and siding against HIPHI.
    pg = fresh(); rs = pg.evaluate(RECS)
    if len(rs) >= 4:
        ids = [r['id'] for r in rs[:4]]
        rs3 = pg.evaluate("""async ids => { const c = await import('./pub/core.js');
          c.S.direct.add(ids[0]); c.recomputeWatch(); c.dismiss(ids[1]); c.S.skips.add(ids[2]);
          const b = c.S.pool.bills.find(x => x.id === ids[3]); await c.setStance(ids[3], /support/.test(b.hiphi_position) ? 'oppose' : 'support');
          return c.recommendations(100).map(r => r.b.id); }""", ids)
        for i, what in enumerate(['a followed bill', 'a bill dismissed with "Not for me"', "an issue's bill marked Not for me", 'a bill the person sides against HIPHI on']):
            check(ids[i] not in rs3, f'{what} is never suggested')

    # 4. Someone who picked a category: its bills come first.
    pg = fresh()
    rs4 = pg.evaluate("""async () => { const c = await import('./pub/core.js'); await c.loadPool();
      const counts = {}; for (const b of c.S.pool.bills) for (const i of c.issuesOf(b)) for (const k of (i.categories || [i.category])) counts[k] = (counts[k] || 0) + 1;
      const pick = Object.entries(counts).sort((a, b) => a[1] - b[1])[0]?.[0]; c.wizSet({ issues: [pick] });
      return { pick, rs: c.recommendations(100).map(r => ({ n: r.b.bill_number, mine: r.mine, score: r.score, when: r.when })) }; }""")
    rs = rs4['rs']; mine = [r for r in rs if r['mine']]
    check(bool(mine), f"picking '{rs4['pick']}' marks some suggestions as on their issues ({len(mine)})")
    check(rs[:len(mine)] == mine, 'those come before every other suggestion')
    check(ordered(rs), 'and the whole list is still in order')

    check(not errs, f'no page errors ({errs[:2]})')
    br.close()
print(f'{ok} passed, {fail} failed'); sys.exit(1 if fail else 0)
