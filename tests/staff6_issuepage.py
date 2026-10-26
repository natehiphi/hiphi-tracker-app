# Staff v6: an issue's page (R-336 walk 3, staff6/issuepage.js). Nate, 25 Oct: "going to this page should show everything
# that a staff member needs to know about what's going on with their bills". On the practice copy (Mon 16 Mar 2026), as Nate:
#   1. the health check, one plain sentence for each case: alive in both chambers ("On track: alive in both chambers. Next:
#      ..."), alive in one ("At risk: ... all in the Senate."), past both ("On track: HB 244 is through both chambers, in
#      conference."), every bill stopped ("Stopped: every bill on this issue stopped this session."), and no bills;
#   2. the bills House | Senate: both headings, a column with none alive says so ("No House bill alive"), alive bills carry
#      the slim stage bar, stopped ones say when and why ("Stopped 2/20: ...");
#   3. What to do next: the rows in date order, and on a laptop the health check, both columns and the first step are on
#      the first screen;
#   4. the timeline shows five events and folds the rest under "Earlier";
#   5. the prep card (walk 3 item 7): in session left out while nobody has started it, shown once a step is done, and back
#      between sessions;
#   6. on a phone the columns stack, House then Senate, with no sideways scroll; no codes in rows; no page errors.
#
#   V4_ROOT=/path/to/worktree python3 tests/staff6_issuepage.py     exits 1 when a check fails
import os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import staff6_lib as L

BOTH = '66a32660-b0a7-4a90-a71f-231963619b44'      # Disposable e-cigarette ban: House bill HB 2121 and Senate bill SB 2175, one name
ONE = 'a8690eec-3d30-4c19-9e15-ce5157c6b950'       # Safety for immigrant families: four House bills alive (all now in the Senate)
PAST = 'b636541e-aef7-46e8-8a99-fb4b0cf38b50'      # Funding for community nonprofits: HB 244 in conference
STOPPED = '2631c97b-91d1-4336-9d56-6f2678f5bc41'   # Single-payer health care: both bills stopped
SHOTS = os.environ.get('ISSUEPAGE_SHOTS', '')

R = L.Results()
def health(pg): return pg.page.evaluate("document.querySelector('.ip6-hs')?.innerText.replace(/\\s+/g, ' ').trim() || ''")
def in_view(pg, sel): return pg.page.evaluate("""s => { const e = document.querySelector(s); if (!e) return false; const r = e.getBoundingClientRect(); return r.top >= 0 && r.top < innerHeight && r.height > 0; }""", sel)
def shot(pg, name):
  if SHOTS: pg.shot(os.path.join(SHOTS, f'{name}-{pg.w}.png')); pg.shot(os.path.join(SHOTS, f'{name}-{pg.w}-full.png'), full=True)

CASES = [
  ('both chambers', BOTH, r'^On track: alive in both chambers\. Next: \S.+$'),
  ('one chamber', ONE, r'^At risk: 4 bills alive, all House bills\. Next: \S.+$'),
  ('past both chambers', PAST, r'^On track: HB 244 is in conference\. Next: \S.+$'),
  ('every bill stopped', STOPPED, r'^Stopped: every bill on this issue stopped this session\.$'),
]
with L.browser() as B:
  for (w, h) in [(1440, 900), (390, 844)]:
    pg = B.page('NT', w, h)
    first = True
    for name, iid, rx in CASES:
      if first: pg.open('/issue/' + iid); first = False
      else: pg.nav('/issue/' + iid)
      pg.page.wait_for_timeout(300)
      where = f'{name} {w}'
      t = health(pg)
      R.check(f'{where}: the health check says it in one sentence', re.match(rx, t) is not None, t)
      R.check(f'{where}: no colour alarm on the health check (no late or bad colour)', pg.measure()['marks'] == 0)
      cols = pg.page.evaluate("[...document.querySelectorAll('.ip6-colh')].map(e => e.innerText.split(/\\s/)[0])")
      R.check(f'{where}: House and Senate columns, in that order', cols == ['House', 'Senate'], cols)
      heads = pg.page.evaluate("[...document.querySelectorAll('.ip6-colh')].map(e => e.firstChild.textContent.trim())")
      R.check(f'{where}: the columns are "House bills" and "Senate bills"', heads == ['House bills', 'Senate bills'], heads)
      origin = pg.page.evaluate("[...document.querySelectorAll('.ip6-col')].map(c => [c.dataset.ipCol, [...c.querySelectorAll('.ip6-brow')].map(r => r.innerText.match(/\\b(HB|SB|HCR|SCR|HR|SR) \\d+/)?.[1] || '')])")
      R.check(f'{where}: each bill sits in the chamber it started in', all(all((n.startswith('H') if side == 'H' else n.startswith('S')) for n in ns) for side, ns in origin), origin)
      hl = pg.page.evaluate("(() => { const e = document.querySelector('.ip6-hs > span'); return e ? Math.round(e.getBoundingClientRect().height / parseFloat(getComputedStyle(e.parentElement).lineHeight)) : 0; })()")
      lim = 2 if w >= 768 else 4   # a laptop: the sentence and its Next on two lines; a phone: two short lines each
      R.check(f'{where}: the health check is at most {lim} lines', 1 <= hl <= lim, hl)
      m = pg.measure()
      R.check(f'{where}: no committee codes in rows', m['row_codes'] == 0, m['worst_row'])
      R.check(f'{where}: no sideways scroll', not m['hscroll'])
      R.check(f'{where}: at most one filled button in view', m['filled'] <= 1, m['filled'])
      R.check(f'{where}: bold at most 25%, small text at most 30%', m['bold_pct'] <= 25 and m['small_pct'] <= 30, (m['bold_pct'], m['small_pct']))
      if w == 1440:
        ok = all(in_view(pg, s) for s in ['.ip6-health', '[data-ip-col="H"]', '[data-ip-col="S"]', '.ip6-next h2'])
        first_row = in_view(pg, '.ip6-next .v6-row') or in_view(pg, '.ip6-next .ip6-quiet')
        R.check(f'{where}: the first laptop screen holds the health check, both columns and the first next step', ok and first_row)
      shot(pg, name.replace(' ', '-'))
    # alive in one chamber: the other column says so plainly; alive bills carry the bar
    pg.nav('/issue/' + ONE)
    none = pg.page.evaluate("document.querySelector('[data-ip-none=\"S\"]')?.innerText.trim()")
    R.check(f'one chamber {w}: "No Senate bill alive"', none == 'No Senate bill alive', none)
    bars = pg.page.evaluate("[...document.querySelectorAll('[data-ip-col=\"H\"] .ip6-brow:not(.is-stop)')].map(r => !!r.querySelector('.ip6-bar'))")
    R.check(f'one chamber {w}: each alive House bill has its stage bar', bars and all(bars), bars)
    now = pg.page.evaluate("[...document.querySelectorAll('[data-ip-col=\"H\"] .ip6-brow:not(.is-stop) .v6-row-line')].map(e => e.innerText.trim())")
    R.check(f'one chamber {w}: each alive bill says where it is now ("Now in Senate ...")', now and all(x.split('\n')[-1].startswith('Now in Senate') for x in now), now)
    # next steps in date order: each row's time, read from the model, never goes backwards
    order = pg.page.evaluate("document.querySelectorAll('.ip6-next .v6-row').length")
    R.check(f'one chamber {w}: What to do next lists its steps', order >= 3, order)
    # stopped bills say when and why
    pg.nav('/issue/' + STOPPED)
    lines = pg.page.evaluate("[...document.querySelectorAll('.ip6-brow.is-stop .v6-row-line')].map(e => e.innerText.trim())")
    R.check(f'every bill stopped {w}: stopped bills say when and why', lines and all(re.match(r'^Stopped( \d+/\d+)?: \S', x) for x in lines), lines)
    R.check(f'every bill stopped {w}: no "Next:" when nothing can move', 'Next:' not in health(pg))
    if w < 768:
      y = pg.page.evaluate("[...document.querySelectorAll('.ip6-col')].map(c => [c.getBoundingClientRect().top, c.getBoundingClientRect().bottom, c.getBoundingClientRect().left])")
      R.check('phone: the columns stack, House above Senate', len(y) == 2 and y[1][0] >= y[0][1] - 1 and abs(y[0][2] - y[1][2]) < 2, y)
    else:
      y = pg.page.evaluate("[...document.querySelectorAll('.ip6-col')].map(c => [c.getBoundingClientRect().top, c.getBoundingClientRect().left])")
      R.check('laptop: the columns sit side by side', len(y) == 2 and abs(y[0][0] - y[1][0]) < 2 and y[1][1] > y[0][1], y)
    # two bills with one name: the number leads each card
    pg.nav('/issue/' + BOTH)
    names = pg.page.evaluate("[...document.querySelectorAll('.ip6-brow .v6-row-name')].map(e => e.innerText.trim())")
    R.check(f'same name {w}: each card leads with its bill number', names and all(re.match(r'^(HB|SB) \d+$', n) for n in names), names)
    # the timeline: five events, then a fold labelled Earlier
    pg.nav('/issue/' + BOTH); pg.page.wait_for_timeout(500)
    tl = pg.page.evaluate("""() => { const sec = document.querySelector('[data-ip-late="tl"]'); const d = sec?.querySelector('details[data-fold="tl"]');
      return { shown: sec ? sec.querySelectorAll(':scope > ol > li').length : -1, fold: d ? d.querySelector('summary').innerText.trim() : '', open: d ? d.open : null, inside: d ? d.querySelectorAll('li').length : 0 }; }""")
    R.check(f'timeline {w}: five events shown, the rest folded under "Earlier"', tl['shown'] == 5 and tl['fold'].startswith('Earlier:') and tl['open'] is False and tl['inside'] > 0, tl)
    # newest first: this session's days ("Tue 3/10") read as month/day, falling down the list
    md = pg.page.evaluate("[...document.querySelectorAll('[data-ip-late=\"tl\"] > ol > .ip6-ev .ip6-evd')].map(e => e.innerText.trim())")
    nums = [tuple(int(x) for x in re.search(r'(\d+)/(\d+)', d).groups()) for d in md if re.fullmatch(r'\w{3} \d+/\d+', d)]
    R.check(f'timeline {w}: newest first', nums == sorted(nums, reverse=True) and len(nums) >= 2, md)
    # the prep card: in session, left out while nobody started it; shown once a step is done
    R.check(f'prep {w}: in session the unstarted "Getting ready for 2027" card is left out', pg.page.query_selector('.pr6-card') is None)
    pg.page.evaluate(f"""async () => {{ const D = await import('./staff6/data.js'); await D.DB.updateIssue('{BOTH}', {{ goal: 'Keep disposable e-cigarettes off the shelves.' }}); D.hooks.render(); }}""")
    pg.page.wait_for_timeout(400)
    R.check(f'prep {w}: once a step is done, the card comes back', pg.page.query_selector('.pr6-card') is not None)
    # an issue with no bills
    nid = pg.page.evaluate("""async () => { const D = await import('./staff6/data.js'); const i = await D.DB.createIssue({ name: 'Test issue with no bills', description: 'Nothing on it yet.', category: D.S.categories[0].key }); return i.id; }""")
    pg.nav('/issue/' + nid); pg.page.wait_for_timeout(300)
    t = health(pg)
    R.check(f'no bills {w}: the health check says so', t.startswith('No bills yet'), t)
    R.check(f'no bills {w}: the bill search is open to put one on', pg.page.query_selector('#is-bq') is not None)
    shot(pg, 'no-bills')
    R.check(f'{w}: no page errors', not pg.errors, pg.errors[:2])
    pg.close()
  # between sessions the card is back (the prep is the work again)
  pg = B.page('NT', 1440, 900); pg.open('/issue/' + BOTH, L.CLOCKS['off']); pg.page.wait_for_timeout(300)
  R.check('prep: between sessions the card is shown', pg.page.query_selector('.pr6-card') is not None)
  R.check('between sessions: no page errors', not pg.errors, pg.errors[:2]); pg.close()
R.done()
