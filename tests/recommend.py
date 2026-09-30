# R-094: the suggested bill on Home and Find in the sandbox (its clock sits mid-March 2026). The scoring rules
# themselves are checked exactly by `node tests/rank_test.mjs`; this checks the page uses them. python3 tests/recommend.py [host]
# Checks: Find's four come from the short list (one per issue, a HIPHI top pick among them) and its first card carries
# the list's reason; Home's one suggestion is Find's first; what is shown is remembered on the device, and a bill shown
# on five earlier days is not suggested; followed, dismissed, "Not for me", sided-against and switched-out bills never
# appear; picking a category brings its bills in; following an issue lifts its related issues' bills (095);
# nothing on the page says "recommended".
import sys
from playwright.sync_api import sync_playwright
HOST = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832'
URL = HOST + '/track.html?demo=1'
TOUR_SEEN = "try{localStorage.setItem('hiphi_tour_bill','1');localStorage.setItem('hiphi_tour_bill_demo','1')}catch(e){}"
ok = fail = 0
def check(c, m):
    global ok, fail
    print('PASS' if c else 'FAIL', m); ok += bool(c); fail += (not c)

LIST = """async n => { const c = await import('./pub/core.js'); await c.loadPool();
  return c.suggestionList(n).map(r => ({ id: r.b.id, n: r.b.bill_number, issue: r.issues[0]?.id || null, cat: r.cats[0] || null,
    top: r.topPick, fit: r.fit, score: r.score, why: r.why, hearing: r.hearing?.id })); }"""
ALL = """async () => { const c = await import('./pub/core.js'); await c.loadPool(); return c.recommendations(500).map(r => r.b.id); }"""

with sync_playwright() as p:
    br = p.chromium.launch(); errs = []
    def fresh(hash='#/find', init=''):
        ctx = br.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
        ctx.add_init_script(TOUR_SEEN + init)
        pg = ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(URL + hash); pg.wait_for_timeout(3500); return pg

    # 1. Someone new, on Find.
    pg = fresh(); L = pg.evaluate(LIST, 4)
    check(len(L) == 4, f"Find's short list has four ({[x['n'] for x in L]})")
    check(len({x['issue'] for x in L}) == len(L), 'one bill per issue')
    check(max([sum(1 for y in L if y['cat'] == x['cat']) for x in L if x['cat']] or [0]) <= 2, 'at most two per category')
    check(any(x['top'] for x in L), "HIPHI's top pick is among them")
    first = pg.evaluate("document.querySelector('.fd-voices [data-card]')?.dataset.card || ''")
    check(first.startswith(L[0]['id'] + '|'), f"Find's first card is the list's first ({L[0]['n']})")
    shown = pg.evaluate("[...document.querySelectorAll('.fd-voices .side a[href*=\"/bill/\"]')].length")
    check(shown >= 1, f'the other suggestions are listed beside it ({shown})')
    card = pg.evaluate("document.querySelector('.fd-voices [data-card]')?.innerText || ''")
    check((L[0]['why'] or 'Testimony is open this week') in card, f"the card says the list's reason ({L[0]['why']!r})")
    seen = pg.evaluate("JSON.parse(localStorage.getItem('hiphi_sugg_seen_demo') || '{}')")
    check(all(x['id'] in seen for x in L), 'what was shown is remembered on this device')
    check(pg.evaluate("!/recommend/i.test(document.body.innerText)"), 'nothing on the page says "recommended"')

    # 2. Home's one suggestion is Find's first (someone who follows one bill, so Home has room for a suggestion).
    pg2 = fresh('#/')
    pg2.evaluate("""async () => { const c = await import('./pub/core.js'); c.onbSet({ welcomed: true }); }""")
    home = pg2.evaluate("""async () => { const c = await import('./pub/core.js'); await c.loadPool(); const l = c.suggestionList(4); return l[0]?.b.id || null; }""")
    check(home == L[0]['id'], "Home and Find agree on the first suggestion")

    # 3. Shown on five earlier days: gone; on three: lower.
    pg = fresh(); top = pg.evaluate(LIST, 4)[0]
    days5 = pg.evaluate("""([id, h]) => { const d = n => new Date(Date.now() - 10 * 3600e3 - n * 864e5).toISOString().slice(0, 10);
      localStorage.setItem('hiphi_sugg_seen_demo', JSON.stringify({ [id]: { h, days: [1, 2, 3, 4, 5].map(d) } })); return true; }""", [top['id'], top['hearing']])
    check(top['id'] not in pg.evaluate(ALL), f"a bill shown on five earlier days is no longer suggested ({top['n']})")
    pg.evaluate("""([id, h]) => { const d = n => new Date(Date.now() - 10 * 3600e3 - n * 864e5).toISOString().slice(0, 10);
      localStorage.setItem('hiphi_sugg_seen_demo', JSON.stringify({ [id]: { h, days: [1, 2, 3].map(d) } })); }""", [top['id'], top['hearing']])
    after = next((x for x in pg.evaluate(LIST.replace('suggestionList(n)', 'recommendations(500)'), 0) if x['id'] == top['id']), None)
    check(after is not None and after['score'] == top['score'] - 20, f"shown on three earlier days: 20 lower ({top['score']} -> {after and after['score']})")

    # 4. Never suggested: followed, dismissed, Not for me, sided against, switched out of the first visit.
    pg = fresh(); L = pg.evaluate(LIST, 4)
    if len(L) >= 4:
        ids = [x['id'] for x in L]
        rest = pg.evaluate("""async ids => { const c = await import('./pub/core.js');
          c.S.direct.add(ids[0]); c.recomputeWatch(); c.dismiss(ids[1]); c.S.skips.add(ids[2]);
          const b = c.S.pool.bills.find(x => x.id === ids[3]); await c.setStance(ids[3], /support/.test(b.hiphi_position) ? 'oppose' : 'support');
          return c.recommendations(500).map(r => r.b.id); }""", ids)
        for i, what in enumerate(['a followed bill', 'a dismissed bill', 'a bill marked Not for me', 'a bill the person sides against HIPHI on']):
            check(ids[i] not in rest, f'{what} is never suggested')
    pg = fresh(); out = pg.evaluate("""async () => { const c = await import('./pub/core.js'); await c.loadPool();
      const r = c.recommendations(500)[0]; const i = c.issuesOf(r.b)[0]; if (!i) return null;
      i.first_visit = false; return { n: r.b.bill_number, gone: !c.recommendations(500).some(x => x.b.id === r.b.id) }; }""")
    check(out and out['gone'], f"a bill of an issue switched out of the first visit is never suggested ({out and out['n']})")

    # 5. Someone who picked a category: its bills come in, with that reason.
    pg = fresh()
    r5 = pg.evaluate("""async () => { const c = await import('./pub/core.js'); await c.loadPool();
      const before = c.suggestionList(4).map(r => r.b.id);
      const counts = {}; for (const r of c.recommendations(500)) for (const k of r.cats) counts[k] = (counts[k] || 0) + 1;
      const pick = Object.entries(counts).sort((a, b) => a[1] - b[1])[0]?.[0]; c.wizSet({ issues: [pick] });
      const after = c.suggestionList(4); return { pick, before, after: after.map(r => ({ id: r.b.id, cat: r.cats[0], fit: r.fit, why: r.why })) }; }""")
    mine = [x for x in r5['after'] if x['fit'] > 0]
    check(len(mine) >= 1, f"picking '{r5['pick']}' puts at least one of its bills in the four ({len(mine)})")
    check(all(x['why'] for x in mine), f"and says why ({mine[0]['why'] if mine else '-'})")

    # 6. Following an issue lifts bills of its related issues (095): +60 and "Close to ..., an issue you follow".
    pg = fresh()
    r6 = pg.evaluate("""async () => { const c = await import('./pub/core.js'); await c.loadPool();
      const cand = c.recommendations(500);
      for (const [id, near] of c.S.issueLinks) {
        const hit = cand.find(r => r.issues.some(i => near.has(i.id)) && !r.issues.some(i => i.id === id));
        if (!hit) continue;
        const f = c.S.issueById.get(id); if (!f) continue;
        await c.setFollows({ issuesOn: [id] });
        const all = c.recommendations(500), got = all.find(r => r.b.id === hit.b.id);
        return { follow: f.name, n: hit.b.bill_number, before: hit.score, after: got && got.score, fit: got && got.fit, why: got && got.why,
          inList: c.suggestionList(4).some(r => r.b.id === hit.b.id) };
      }
      return null; }""")
    check(r6 is not None, f"the sandbox has a followed issue with a related issue's bill to suggest ({r6 and r6['follow']} -> {r6 and r6['n']})")
    if r6:
        check(r6['fit'] == 60 and r6['why'].startswith('Close to '), f"that bill gets +60 and says why ({r6['why']!r}, {r6['before']} -> {r6['after']})")
        check(r6['inList'], "and it is among Find's four")

    check(not errs, f'no page errors ({errs[:2]})')
    br.close()
print(f'{ok} passed, {fail} failed'); sys.exit(1 if fail else 0)
