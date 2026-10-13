# Staff v5 My issues and All issues (R-272, Nate 10/13): an issue is judged as a whole. At risk only when no bill on it is
# past the deadline its at-risk bill faces; "Safe, a bill dying" when another bill already cleared it; the page opens By
# deadline with This week first, flips By topic, and the search finds an issue by the words staff use, not only its name.
# On the practice copy (Mon 16 Mar 2026). Exits 1 when a check fails.
#   python3 tests/staff5_issue_stand.py                  against http://localhost:8832
#   V4_ROOT=/path/to/worktree python3 tests/staff5_issue_stand.py    serves that folder straight into the browser
import mimetypes, os, sys
from urllib.parse import urlparse, unquote
from playwright.sync_api import sync_playwright

ROOT = os.environ.get('V4_ROOT', '')
HOST = 'https://v4.test' if ROOT else os.environ.get('HOST', 'http://localhost:8832')
fails = []
def check(ok, what):
  print(('ok   ' if ok else 'FAIL ') + what)
  if not ok: fails.append(what)

def router(route):
  rel = unquote(urlparse(route.request.url).path).lstrip('/') or 'index.html'
  f = os.path.join(ROOT, rel)
  if not os.path.isfile(f): return route.fulfill(status=404, body='')
  route.fulfill(status=200, body=open(f, 'rb').read(), headers={'content-type': mimetypes.guess_type(f)[0] or 'application/octet-stream'})

# Builds four issues from real bills on the practice date: one bill at risk alone; the same with a bill already past that
# deadline; the past bill alone; and the at-risk bill on an issue HIPHI opposes.
CASES = r"""async () => {
  const { S } = await import('./staff5/data.js'), M = await import('./staff5/model.js'), T = await import('./staff5/issuestand.js');
  const pos = b => b.position && b.position !== 'monitor' && !/oppose/.test(b.position) && b.tracked !== false;
  const risky = S.bills.find(b => pos(b) && M.riskOf(b) && !M.hearingAhead(b));
  if (!risky) return { err: 'no at-risk bill on the practice date' };
  const d = M.riskOf(risky).deadline.date;
  const past = S.bills.find(b => pos(b) && !M.diedish(b) && (st => st.deadline && !st.deadline.missed && st.deadline.date > d)(M.stopOf(b)));
  const mk = (id, bills, stance = 'support') => { S.issues.push({ id, name: 'Test ' + id, category: S.categories[0].key, stance });
    for (const b of bills) S.billIssues.push({ issue_id: id, bill_id: b.id }); return T.standOf(S.issues.at(-1)); };
  const txt = x => { const e = document.createElement('div'); e.innerHTML = T.markHTML(x); return e.textContent; };
  const a = mk('t-risk', [risky]), b = mk('t-dying', [risky, past]), c = mk('t-safe', [past]), o = mk('t-opp', [risky], 'oppose');
  return { risky: risky.nickname || risky.bill_number, past: past.nickname || past.bill_number,
    a: [a.state, txt(a)], b: [b.state, txt(b)], c: [c.state, txt(c)], o: [o.state, txt(o)], weekB: T.thisWeek(b) };
}"""

# Ten words staff use, and the issue each must find first.
SEARCHES = [('1562', 'Youth mental health app pilot'), ('HB1562', 'Youth mental health app pilot'), ('vape', None),
  ('SNAP', None), ('local food buying', 'More local food in school meals'), ('medical debt', 'State program to forgive medical debt'),
  ('ICE', 'Safety for immigrant families'), ('kupuna', 'Make SNAP easier to get and keep'),
  ('pesticide buffer', 'Pesticide-free buffer zones'), ('drunk driving', 'Tougher consequences for drunk driving')]

with sync_playwright() as p:
  br = p.chromium.launch(); pg = br.new_page(viewport={'width': 1440, 'height': 900})
  if ROOT: pg.route(HOST + '/**', router)
  pg.goto(HOST + '/staff5.html?demo=1#/outreach/issues'); pg.wait_for_selector('.ist-row', timeout=20000)

  r = pg.evaluate(CASES)
  if r.get('err'): check(False, r['err'])
  else:
    check(r['a'][0] == 'risk' and 'At risk' in r['a'][1], f"one bill at risk, none past: At risk ({r['a'][1]})")
    check(r['b'][0] == 'dying' and 'Safe, a bill dying' in r['b'][1] and 'dies' in r['b'][1], f"a bill past the deadline: Safe, a bill dying, names the dying bill ({r['b'][1]})")
    check('At risk' not in r['b'][1], 'the issue with a bill past the deadline never says At risk')
    check(r['weekB'], 'Safe, a bill dying is in This week (Nate 10/13: for now, yes)')
    check(r['c'][0] in ('safe', 'ahead') and 'At risk' not in r['c'][1], f"only the bill past it: not at risk ({r['c'][1]})")
    check(r['o'][0] == 'oppose' and 'At risk' not in r['o'][1], f"an issue HIPHI opposes is never At risk ({r['o'][1]})")

  pg.goto(HOST + '/staff5.html?demo=1#/my-issues'); pg.wait_for_selector('.ist-row', timeout=20000)
  pg.evaluate("localStorage.removeItem('sv_issues_view')"); pg.reload(); pg.wait_for_selector('.ist-row', timeout=20000)
  heads = pg.eval_on_selector_all('.ist-sec > h2', 'l => l.map(h => h.innerText.split("\\n")[0])')
  check(heads[:1] == ['This week'], f'My issues opens By deadline, This week first ({heads[:3]})')
  pg.click('[data-isview="topic"]')
  topics = pg.eval_on_selector_all('.ist-topic > h2', 'l => l.map(h => h.innerText.split("\\n")[0])')
  check(len(topics) >= 3, f'By topic shows the topics ({topics[:3]})')
  pg.reload(); pg.wait_for_selector('.ist-row', timeout=20000)
  check(pg.locator('[data-isview="topic"][aria-pressed="true"]').count() == 1, 'the switch is remembered')
  pg.click('[data-isview="deadline"]')
  wk = pg.eval_on_selector_all('.ist-sec-week .ist-row', 'l => l.length')
  check(wk > 0, f'This week lists {wk} issues on 3/16')

  pg.goto(HOST + '/staff5.html?demo=1#/outreach/issues'); pg.wait_for_selector('#is-q', timeout=20000)
  for q, want in SEARCHES:
    pg.fill('#is-q', q); pg.wait_for_timeout(120)
    got = pg.eval_on_selector_all('#is-q-body .ist-row .ist-nm', 'l => l.map(e => e.textContent)')
    if want: check(got[:1] == [want], f'search "{q}" finds {want} first (got {got[:2]})')
    else:
      word = {'vape': 'e-cigarette', 'SNAP': 'snap'}[q]
      check(bool(got) and word in got[0].lower(), f'search "{q}" finds an {word} issue first (got {got[:2]})')
  br.close()
print(f"\n{len(fails)} failed" if fails else '\nall passed'); sys.exit(1 if fails else 0)
