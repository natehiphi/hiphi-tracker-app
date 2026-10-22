# Staff v5: Help answers the twelve questions staff ask in everyday words, and the top search finds a coalition by its
# short name (R-316 W29, L-3, S-9). On the practice copy as Kris. Exits 1 when a check fails.
#   python3 tests/staff5_help_search.py                  against http://localhost:8832
#   V4_ROOT=/path/to/worktree python3 tests/staff5_help_search.py    serves that folder straight into the browser
import os, sys
from playwright.sync_api import sync_playwright
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from staff5_people import router, HOST, ROOT

fails = []
def check(ok, what):
  print(('ok   ' if ok else 'FAIL ') + what)
  if not ok: fails.append(what)

QUESTIONS = ['how do I write testimony', 'get testimony approved', 'file testimony', 'file late', 'say I am going',
  'ask the chair for a hearing', 'log a call with a legislator', 'who chairs a committee', 'send this week ask',
  'what I owe today', 'hand a draft to someone', 'turn off a ping']

with sync_playwright() as p:
  br = p.chromium.launch(); pg = br.new_page(viewport={'width': 1440, 'height': 900})
  if ROOT: pg.route(HOST + '/**', router)
  pg.goto(HOST + '/staff5.html?demo=1&as=KR#/help'); pg.wait_for_timeout(4000)
  def ask(q):
    pg.fill('#st-hq', q); pg.wait_for_timeout(250)
    return pg.inner_text('#st-hres')
  for q in QUESTIONS:
    t = ask(q)
    check('Nothing in Help mentions' not in t and t.strip() != '', f'Help answers "{q}" ({t.strip().splitlines()[0][:60] if t.strip() else "empty"})')
  t = ask('ready to file')
  check(not t.strip().startswith('Decision making'), f'"ready to file" no longer opens on Decision making ("already" holds "ready")')
  t = ask('agriculture')
  check('&amp;' not in t and '&quot;' not in t, 'results show no raw codes such as &amp;')
  pg.fill('#st-hq', ''); pg.goto(HOST + '/staff5.html?demo=1&as=KR#/search?q=HEAL'); pg.wait_for_timeout(2500)
  first = pg.locator('.lg-plrow').first.inner_text() if pg.locator('.lg-plrow').count() else ''
  check(first.startswith('HEAL'), f'the top search finds the HEAL coalition first (got "{first[:40]}")')
  br.close()
print('\nall passed' if not fails else f'\n{len(fails)} failed'); sys.exit(1 if fails else 0)
