# Staff v5: My issues and Bills say the same testimony step and the same due time for the same bill (R-316 W23, Nate 10/21).
# Both read model.js testStep; this checks the screens, as Nate, Kevin and Lauren on the practice copy (Mon 16 Mar 2026,
# 9:00 am HST), and with the clock moved to Thu 3/19 noon, when HB2121 and HB1573 are past their deadline but their Friday
# hearing is still ahead ("File late"). Also: Kevin's FDA issue says when HB1573's testimony is due (Wed 3/18), not the
# Friday hearing, and HB1562's late step stays on Nate's line. Nothing is written to the repo. Exits 1 when a check fails.
#   python3 tests/staff5_step_match.py                  against http://localhost:8832 (CI serves the repo there)
#   V4_ROOT=/path/to/worktree python3 tests/staff5_step_match.py    serves that folder straight into the browser
import mimetypes, os, sys
from urllib.parse import urlparse, unquote
from playwright.sync_api import sync_playwright

ROOT = os.environ.get('V4_ROOT', '')
HOST = 'https://v4.test' if ROOT else os.environ.get('HOST', 'http://localhost:8832')
# &asof moves the practice clock: both clocks are rewritten as they are served (as staff5_people.py does).
CLOCKS = {'staff5/data.js': "export const DEMO_ASOF = DEMO_OFF", 'pub/kernel.js': "export const DEMO_ASOF = SEASON_OFF"}
fails = []
def check(ok, what):
  print(('ok   ' if ok else 'FAIL ') + what)
  if not ok: fails.append(what)

def router(route):
  rel = unquote(urlparse(route.request.url).path).lstrip('/') or 'index.html'
  if ROOT:
    f = os.path.join(ROOT, rel)
    if not os.path.isfile(f): return route.fulfill(status=404, body='')
    raw = open(f, 'rb').read()
  else:
    if rel not in CLOCKS: return route.continue_()
    raw = route.fetch().body()
  if rel in CLOCKS:
    t = raw.decode(); old = CLOCKS[rel]
    if old in t: t = t.replace(old, "const T_ASOF = DEMO && new URLSearchParams(location.search).get('asof');\n" + old.replace('= ', '= T_ASOF ? T_ASOF : ', 1))
    raw = t.encode()
  ct = {'.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.json': 'application/json'}.get(os.path.splitext(rel)[1]) or mimetypes.guess_type(rel)[0] or 'application/octet-stream'
  route.fulfill(status=200, body=raw, headers={'content-type': ct})

MARKS = "l => l.map(e => ({ bill: e.dataset.bill, step: e.dataset.step, due: e.dataset.due, text: e.innerText.replace(/\\s+/g, ' ') }))"
CELLS = "l => l.map(e => ({ bill: e.closest('tr').querySelector('[data-bill]')?.dataset.bill, step: e.dataset.step, due: e.dataset.due, text: e.innerText.replace(/\\s+/g, ' ') }))"

with sync_playwright() as p:
  br = p.chromium.launch()
  def screens(who, asof=''):
    ctx = br.new_context(viewport={'width': 1440, 'height': 900}); ctx.route(HOST + '/**', router); pg = ctx.new_page()
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    q = f"demo=1&as={who}{'&asof=' + asof if asof else ''}"
    pg.goto(f'{HOST}/staff5.html?{q}#/my-issues'); pg.wait_for_selector('.ist-row', timeout=20000); pg.wait_for_timeout(600)
    marks = pg.eval_on_selector_all('.ist-hear[data-step]', MARKS)
    pg.goto(f'{HOST}/staff5.html?{q}#/bills'); pg.wait_for_selector('td[data-step]', timeout=20000); pg.wait_for_timeout(600)
    cells = {c['bill']: c for c in pg.eval_on_selector_all('td[data-step]', CELLS)}
    ctx.close(); return marks, cells, errs

  seen = {}
  for who, asof in [('NT', ''), ('KV', ''), ('LR', ''), ('NT', '2026-03-19T12:00:00-10:00')]:
    marks, cells, errs = screens(who, asof); tag = who + (' at 3/19 noon' if asof else '')
    check(not errs, f'{tag}: no page errors {errs[:1]}')
    check(len(marks) > 0, f'{tag}: My issues names {len(marks)} testimony steps')
    bad = [m for m in marks if m['bill'] not in cells or (cells[m['bill']]['step'], cells[m['bill']]['due']) != (m['step'], m['due'])]
    check(not bad, f'{tag}: each step and due time on My issues is the one in Bills\' Next column' + (f" (differs: {bad[0]['text']} vs {cells.get(bad[0]['bill'], {}).get('text')})" if bad else ''))
    seen[tag] = marks

  kv = next((m for m in seen['KV'] if 'HB1573' in m['text']), None)
  check(kv and kv['due'].startswith('2026-03-18') and 'testimony due Wed 3/18' in kv['text'] and 'Fri' not in kv['text'],
        f"Kevin's FDA issue says when HB1573's testimony is due, not the Friday hearing ({kv and kv['text']})")
  late = next((m for m in seen['NT'] if 'HB1562' in m['text']), None)
  check(late and late['step'] == 'File' and not late['due'] and 'File late' in late['text'], f"HB1562, past its deadline with the hearing ahead: File late ({late and late['text']})")
  moved = [m for m in seen['NT at 3/19 noon'] if 'HB2121' in m['text']]
  check(moved and 'late' in moved[0]['text'] and 'until the hearing' in moved[0]['text'], f"the clock moved to 3/19: HB2121 is late, until Friday's hearing ({moved and moved[0]['text']})")
  br.close()
print(f"\n{len(fails)} failed" if fails else '\nall passed'); sys.exit(1 if fails else 0)
