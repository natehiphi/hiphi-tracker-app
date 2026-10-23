# Staff v5: Help answers the twelve questions staff ask in everyday words, and the top search finds a coalition by its
# short name (R-316 W29, L-3, S-9), and a Capitol word ("sine die", "deferred") shows what it means first, opening Help's
# Capitol words at that word (L-15). On the practice copy as Kris. Exits 1 when a check fails.
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

  # R-316 W29 (L-15): a Capitol word in the top search shows what it means first, from Help's glossary, and opens
  # Capitol words at that word; the bills with the word still follow.
  errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
  for q, term in [('sine die', 'Sine die'), ('deferred', 'Deferred'), ('joint referral', 'Joint referral'), ('decking', 'Decking'), ('second lateral', 'Lateral'), ('HD2', 'HD1, SD1, CD1')]:
    pg.goto(HOST + '/staff5.html?demo=1&as=KR#/search?q=' + q); pg.wait_for_timeout(1800)
    lead = pg.evaluate("(() => { const s = document.querySelector('#lg-sres > section'); return s ? s.className : ''; })()")
    rows = pg.locator('#lg-sres .lg-wdrow')
    t = rows.first.inner_text() if rows.count() else ''
    check('lg-words' in lead and t.startswith(term), f'search "{q}": the first row is {term} and its meaning ({t.replace(chr(10), " · ")[:70]})')
    if q in ('deferred', 'decking'):
      n = pg.locator('#lg-sres .lg-grp:not(.lg-words) .row, #lg-sres .lg-urow').count()
      check(n > 0, f'search "{q}": its bills still show below the meaning ({n} rows)')
    if rows.count():
      rows.first.click(); pg.wait_for_timeout(1000)
      m = pg.evaluate("""(() => { const e = document.querySelector('#st-wmark'); if (!e) return null; const r = e.getBoundingClientRect();
        return { word: (e.querySelector('mark') || {}).innerText || '', seen: r.top >= 0 && r.bottom <= innerHeight, focus: document.activeElement === e, hash: location.hash }; })()""")
      check(m and m['hash'].startswith('#/help/words?w=') and m['word'] == term and m['seen'], f'search "{q}": the row opens Capitol words in Help at {term}, marked and in view ({m})')
  pg.goto(HOST + '/staff5.html?demo=1&as=KR#/search?q=ate'); pg.wait_for_timeout(1500)
  check(pg.locator('#lg-sres .lg-wdrow').count() == 0, '"ate" offers no Capitol word (a word must start where a word starts)')
  # The header's suggestions on any page
  pg.goto(HOST + '/staff5.html?demo=1&as=KR#/'); pg.wait_for_timeout(1500)
  for q, term in [('deferred', 'Deferred'), ('sine die', 'Sine die')]:
    hq = pg.locator('#hq'); hq.fill(''); hq.type(q); pg.wait_for_timeout(1500)
    box = pg.inner_text('.sg') if pg.locator('.sg').count() else ''
    first_opt = pg.locator('.sg [role="option"]').first.inner_text() if pg.locator('.sg [role="option"]').count() else ''
    check(box.startswith('Capitol words') and first_opt.startswith(term), f'header suggestions for "{q}": {term} and its meaning first ({box.replace(chr(10), " | ")[:110]})')
    if q == 'deferred': check('Not tracked yet' in box or 'Bills' in box, 'header suggestions for "deferred": the bills follow')
    # fresh-eyes: the meaning to the end of its first sentence, whole (one line cut it mid-thought, "...that almost always…")
    sub = pg.evaluate("(() => { const e = document.querySelector('.sg [role=\"option\"] .sg-s'); return e ? { t: e.textContent, cut: e.scrollWidth > e.clientWidth + 1 } : null; })()")
    want = {'deferred': 'The committee held the bill.', 'sine die': 'The last day of the session.'}[q]
    check(sub and sub['t'] == want and not sub['cut'], f'header suggestions for "{q}": the meaning\'s first sentence, whole: "{want}" ({sub})')
  pg.locator('#hq').press('ArrowDown'); pg.locator('#hq').press('Enter'); pg.wait_for_timeout(1000)
  check(pg.evaluate('location.hash').startswith('#/help/words?w=Sine'), f'Enter on the header row opens Capitol words at Sine die ({pg.evaluate("location.hash")})')
  check(not errs, f'no page errors ({errs[:1]})')
  br.close()
print('\nall passed' if not fails else f'\n{len(fails)} failed'); sys.exit(1 if fails else 0)
