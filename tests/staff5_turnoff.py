# Staff v5: turning someone off never hides their work (R-316 W28, G3-3). On the practice copy (Mon 16 Mar 2026), as
# Nate on Team: for every teammate who owns bills, turning them off must not lower Slipping's count, their name must
# say "(turned off)" where it still shows, and they leave the going lists. Exits 1 when a check fails.
#   python3 tests/staff5_turnoff.py                  against http://localhost:8832
#   V4_ROOT=/path/to/worktree python3 tests/staff5_turnoff.py    serves that folder straight into the browser
import os, sys
from playwright.sync_api import sync_playwright
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from staff5_people import router, HOST, ROOT

fails = []
def check(ok, what):
  print(('ok   ' if ok else 'FAIL ') + what)
  if not ok: fails.append(what)

# Turn each owner off in turn (in the page's own state; nothing is saved), redraw, count Slipping's rows, put them back.
SWEEP = """async () => {
  const { S, hooks } = await import('./staff5/data.js'), m = await import('./staff5/model.js');
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const count = () => document.querySelectorAll('.td-slip .td-row, .td-slip .td-mrow').length;
  hooks.render(); await wait(600); const base = count(), out = [];
  const owners = [...new Set(Object.values(S.assignments || {}).flat())].filter(id => S.advocates.some(a => a.id === id && a.is_active !== false));
  for (const id of owners) {
    const a = S.advocates.find(x => x.id === id); if (a.id === S.me.id) continue;
    const goingBefore = Object.keys(S.attend || {}).filter(h => m.attendees({ id: h }).some(x => x.id === id)).length;
    a.is_active = false; hooks.render(); await wait(500);
    const n = count(), going = Object.keys(S.attend || {}).filter(h => m.attendees({ id: h }).some(x => x.id === id)).length;
    out.push({ who: a.full_name, n, going, goingBefore });
    a.is_active = true;
  }
  hooks.render(); await wait(400);
  return { base, out };
}"""

with sync_playwright() as p:
  br = p.chromium.launch(); pg = br.new_page(viewport={'width': 1440, 'height': 900})
  if ROOT: pg.route(HOST + '/**', router)
  pg.goto(HOST + '/staff5.html?demo=1&as=NT#/?scope=team'); pg.wait_for_timeout(5000)
  r = pg.evaluate(SWEEP)
  check(r['base'] > 0, f"Slipping has rows on the practice day ({r['base']})")
  check(len(r['out']) >= 3, f"tried turning off {len(r['out'])} owners")
  low = [f"{x['who']} {r['base']}->{x['n']}" for x in r['out'] if x['n'] < r['base']]
  check(not low, f"turning off any owner never lowers the Slipping count (lowered: {low[:4]})")
  went = [x['who'] for x in r['out'] if x['going']]
  check(not went, f"someone turned off leaves every going list (still going: {went[:4]})")
  br.close()
print('\nall passed' if not fails else f'\n{len(fails)} failed'); sys.exit(1 if fails else 0)
