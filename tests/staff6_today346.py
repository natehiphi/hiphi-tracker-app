# Staff v6: Today = moderate (R-346, Nate's pick 27 Oct), plus the week in the page ("allow the calendar to exist somewhere
# in the main section"). One page, no Today | Calendar and no List | Calendar switch (finding A); every row leads with the
# job and names the bill as a link inside the sentence (B, option E), with a time column and a quiet line that carries the
# issue's icon and name (E); Do today in time order, "Any time" last; partner words in the Team card, not the list; the
# week strip at the top of the side column from 1100px; the week calendar under Coming up, one entry per job (C). On the
# practice copy (Mon 16 Mar 2026), as Nate.
#
#   HOST=http://localhost:9447 python3 tests/staff6_today346.py     exits 1 when a check fails
import os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import staff6_lib as L

R = L.Results()
def overflow(pg): return pg.page.evaluate('document.documentElement.scrollWidth - innerWidth')
# minutes after midnight of a "10:00 AM" time column; None for "Any time"
def mins(t):
  m = re.match(r'^(\d{1,2}):(\d{2}) ([AP]M)$', t.strip())
  if not m: return None
  h = int(m.group(1)) % 12 + (12 if m.group(3) == 'PM' else 0)
  return h * 60 + int(m.group(2))

ROWS = """sel => [...document.querySelectorAll(sel + ' .v6-row')].map(r => ({
  when: r.querySelector('.t6-jt')?.textContent.trim() || '',
  eye: !!r.querySelector('.t6-jeye'), icon: !!r.querySelector('.t6-jeye .t6-iss svg'), bill: !!r.querySelector('.t6-jeye .v6-row-num'),
  say: r.querySelector('.t6-jsay')?.textContent.trim() || '', link: !!r.querySelector('.t6-jsay a.v6-step-in'),
  pick: !!r.querySelector('.t6-jmain'), btns: r.querySelectorAll('.v6-row-act .btn').length }))"""

with L.browser() as B:
  for w, h in [(1440, 900), (1280, 800)]:
    pg = B.page('NT', w, h); pg.open('/')
    R.check(f'{w}: no Today | Calendar tabs, no List | Calendar switch', not pg.page.query_selector('.t6-caltabs, [data-tview], .t6-ways, [data-seg="tview"]'))
    rows = pg.page.evaluate(ROWS, '#t6-g-today ~ .t6-list, section[aria-labelledby="t6-g-today"]')
    R.check(f'{w}: Do today has rows', len(rows) >= 3, len(rows))
    R.check(f'{w}: every Do today row has a time column ("10:00 AM" or "Any time")', all(r['when'] and (mins(r['when']) is not None or r['when'] == 'Any time') for r in rows), [r['when'] for r in rows])
    R.check(f'{w}: every Do today row has a quiet line with the bill number', all(r['eye'] and r['bill'] for r in rows))
    R.check(f'{w}: every Do today row on a bill with an issue shows the issue icon', sum(r['icon'] for r in rows) >= len(rows) - 1, [r['icon'] for r in rows])
    R.check(f'{w}: every Do today row leads with a sentence holding the bill as a link', all(r['say'] and r['link'] for r in rows), [r['say'][:40] for r in rows if not r['link']])
    R.check(f'{w}: each row has at most one button (D16)', all(r['btns'] <= 1 for r in rows))
    ts = [mins(r['when']) for r in rows]
    timed = [t for t in ts if t is not None]
    first_any = next((i for i, t in enumerate(ts) if t is None), len(ts))
    R.check(f'{w}: Do today runs in time order, "Any time" last', timed == sorted(timed) and all(t is None for t in ts[first_any:]), [r['when'] for r in rows])
    soon = pg.page.evaluate(ROWS, 'section[aria-labelledby="t6-g-soon"]')
    R.check(f'{w}: Coming up says the day in its time column', soon and all(re.match(r'^(Mon|Tue|Wed|Thu|Fri|Sat|Sun) \d{1,2}/\d{1,2}$', r['when']) for r in soon), [r['when'] for r in soon])
    R.check(f'{w}: no partner group in the list', not pg.page.query_selector('#t6-g-pq') and 'Partner words to approve' not in pg.text('.t6-col'))
    team = pg.text('.t6-aside .t6-teamc')
    R.check(f'{w}: the Team card has its heading and the partners line', team.startswith('Team') and re.search(r'Partners · \d+ sets? of words', team) is not None, team[:200])
    strip = pg.page.query_selector('.t6-aside .t6-wk')
    R.check(f'{w}: the week strip leads the side column', bool(strip) and strip.is_visible() and pg.page.evaluate("document.querySelector('.t6-aside').firstElementChild?.classList.contains('t6-wk')"))
    R.check(f'{w}: the strip has five days, today ringed', pg.page.evaluate("document.querySelectorAll('.t6-wk .t6-wkd').length") == 5 and bool(pg.page.query_selector('.t6-wk .t6-wkd.today[aria-current=date]')))
    R.check(f'{w}: the next step card is first', pg.page.evaluate("document.querySelector('.t6-col').firstElementChild?.querySelector('.t6-next, .t6-nexth') != null"))
    R.check(f'{w}: no link inside a link', pg.page.evaluate("document.querySelectorAll('a a').length") == 0)
    R.check(f'{w}: no sideways scroll', overflow(pg) <= 0, overflow(pg))
    # the calendar in the page, under Coming up, one entry per job
    R.check(f'{w}: the week calendar is in the page, after Coming up', pg.page.evaluate("(() => { const c = document.querySelector('section[aria-labelledby=\"t6-g-soon\"]'), k = document.querySelector('#t6-week .hc-cal'); return !!c && !!k && (c.compareDocumentPosition(k) & Node.DOCUMENT_POSITION_FOLLOWING) > 0; })()"))
    dup = pg.page.evaluate("""(() => { const out = [];
      for (const day of document.querySelectorAll('#t6-week .hc-day, #t6-week .hc-wkend')) {
        const step = new Set([...day.querySelectorAll('.hc-step a.hc-bl')].map(a => a.textContent.trim()));
        for (const a of day.querySelectorAll('.hc-due a.hc-bl')) if (step.has(a.textContent.trim())) out.push(a.textContent.trim()); }
      // a step at its sitting's start is said on the hearing's entry, not again as an entry of its own
      for (const e of document.querySelectorAll('#t6-week .hc-step')) { const t = e.querySelector('.hc-t').textContent, n = e.querySelector('a.hc-bl')?.textContent.trim();
        for (const h of e.closest('.hc-list').querySelectorAll('.hc-h')) if (h.querySelector('.hc-t').textContent === t && [...h.querySelectorAll('a.hc-bl')].some(a => a.textContent.trim() === n)) out.push(n + ' at ' + t); }
      return out; })()""")
    R.check(f'{w}: the calendar lists no job twice (finding C)', not dup, dup)
    R.check(f'{w}: no calendar entry name is cut short', pg.page.evaluate("![...document.querySelectorAll('#t6-week .hc-e')].some(e => /…/.test(e.textContent))"))
    # the strip's link goes to the week; a row still opens beside the list
    pg.page.click('.t6-wk [data-t6cal]'); pg.page.wait_for_timeout(900)
    R.check(f'{w}: "Open the calendar" goes to the week', pg.page.evaluate("Math.abs(document.querySelector('#t6-week').getBoundingClientRect().top) < innerHeight * 0.6"))
    pg.page.evaluate('scrollTo(0, 0)')
    pick = pg.page.query_selector('section[aria-labelledby="t6-g-today"] .t6-jmain[data-v6pick]')
    pick.click(); pg.page.wait_for_timeout(600)
    R.check(f'{w}: a row still opens beside the list', bool(pg.page.query_selector('.t6-ld.open .v6-item')))
    R.check(f'{w}: no page errors', not pg.errors, pg.errors[:2]); pg.close()

  # ---- a phone: nothing lost, nothing sideways ----
  pg = B.page('NT', 390, 844, mobile=True); pg.open('/')
  # (on a phone's hearing day the next step is inside its sitting's big card, V14: .t6-hday-ph)
  R.check('390: the next step, Do today, Coming up, the Team lines and the week are all there', all(pg.page.query_selector(s) for s in ['.t6-next, .t6-hday-ph .t6-hc-lead', 'section[aria-labelledby="t6-g-today"]', 'section[aria-labelledby="t6-g-soon"]', '.t6-edges .t6-teamc', '#t6-week .hc-cal']))
  R.check('390: rows keep the time and the sentence', pg.page.evaluate("[...document.querySelectorAll('section[aria-labelledby=\"t6-g-today\"] .v6-row')].every(r => r.querySelector('.t6-jt') && r.querySelector('.t6-jsay a'))"))
  R.check('390: no sideways scroll', overflow(pg) <= 0, overflow(pg))
  R.check('390: no page errors', not pg.errors, pg.errors[:2]); pg.close()

R.done()
