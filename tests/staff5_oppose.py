# Staff v5: HIPHI never asks a chair to hear a bill it opposes (R-316 W2, Nate's review of 21 Oct). Oppose and Strongly
# oppose bills get no "schedule a hearing" email, no chair-ask or thank-the-chair suggestion, and are not counted at risk;
# a bill HIPHI supports still gets all three. On the practice copy (Mon 16 Mar 2026), as Rick, who owns opposed bills.
# Exits 1 when a check fails.
#   python3 tests/staff5_oppose.py                  against http://localhost:8832
#   V4_ROOT=/path/to/worktree python3 tests/staff5_oppose.py    serves that folder straight into the browser
import os, sys
from urllib.parse import unquote
from playwright.sync_api import sync_playwright
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from staff5_people import router, HOST, ROOT   # one way to serve the practice copy for every staff5 test

fails = []
def check(ok, what):
  print(('ok   ' if ok else 'FAIL ') + what)
  if not ok: fails.append(what)

LOGIC = """async () => {
  const m = await import('./staff5/model.js'), { S } = await import('./staff5/data.js');
  const live = S.bills.filter(b => !m.diedish(b));
  const opp = live.filter(b => ['oppose', 'strongly_oppose'].includes(b.position)), sup = live.filter(b => ['strongly_support', 'support'].includes(b.position));
  const asks = l => m.suggestions(l, { cap: 999 }).filter(s => s.kind === 'chair' || s.kind === 'thank').map(s => s.b.bill_number);
  const gates = m.sessionGates(S.bills).flatMap(g => g.noHearing.map(x => x.b.position));
  return { opp: opp.length, oppAsks: asks(opp), oppRisk: opp.filter(m.atRisk).map(b => b.bill_number), supAsks: asks(sup).length,
    supRisk: sup.filter(m.atRisk).length, gateOpp: gates.filter(p => ['oppose', 'strongly_oppose'].includes(p)).length, gateAll: gates.length };
}"""
# Every hearing-request email on the page, with the bill it names.
MAILS = """() => [...document.querySelectorAll('a[href^="mailto:"]')].map(a => decodeURIComponent(a.getAttribute('href')))
  .filter(h => /schedule|hearing/i.test(h)).map(h => (/(?:HB|SB|HCR|SCR|HR|SR)\\s?\\d+/.exec(h) || [''])[0].replace(/\\s/, ''))"""

with sync_playwright() as p:
  br = p.chromium.launch(); pg = br.new_page(viewport={'width': 1440, 'height': 900})
  if ROOT: pg.route(HOST + '/**', router)
  pg.goto(HOST + '/staff5.html?demo=1&as=RK#/?view=week'); pg.wait_for_timeout(4000)
  r = pg.evaluate(LOGIC)
  check(r['opp'] > 0, f"the practice data has live opposed bills ({r['opp']})")
  check(not r['oppAsks'], f"no chair-ask or thank-the-chair suggestion on an opposed bill (got {r['oppAsks'][:5]})")
  check(not r['oppRisk'], f"no opposed bill counted at risk (got {r['oppRisk'][:5]})")
  check(r['gateOpp'] == 0 and r['gateAll'] > 0, f"no opposed bill among the deadlines' 'still need a hearing' ({r['gateOpp']} of {r['gateAll']})")
  check(r['supAsks'] > 0 and r['supRisk'] > 0, f"supported bills still get asks ({r['supAsks']}) and at-risk counts ({r['supRisk']})")
  opp = set(pg.evaluate("async () => { const { S } = await import('./staff5/data.js'); return S.bills.filter(b => ['oppose', 'strongly_oppose'].includes(b.position)).map(b => b.bill_number.replace(/\\s/, '')); }"))
  for route in ['/?view=week', '/', '/bills', '/bill/HB108']:
    pg.goto(HOST + f'/staff5.html?demo=1&as=RK#{route}'); pg.wait_for_timeout(3000)
    bad = [n for n in pg.evaluate(MAILS) if n in opp]
    check(not bad, f"{route}: no hearing-request email for an opposed bill (got {bad[:5]})")
  br.close()
print(f"\n{'all passed' if not fails else str(len(fails)) + ' failed'}")
sys.exit(1 if fails else 0)
