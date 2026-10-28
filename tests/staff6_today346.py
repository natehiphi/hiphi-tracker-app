# Staff v6: Today after R-352 (Nate's go 27 Oct; it undoes R-346's moderate rows and the week in the page). No week on
# Today: no calendar, no day strip, one quiet "See the week on Hearings" line at the end of Coming up (the calendar is
# Hearings' only). Rows are a name and one line again, the job first ("File testimony · State program to forgive medical
# debt" with "SB 3025" small after, then the status), no quiet line above, no time column, no issue chip, no links inside
# the words; one small neutral icon for the kind of job (A-18 on v6); at most one button, only on the viewer's own step due
# now (A-3, D16). The next-step card as it was. The Team lines short, with no heading; on a phone they come last. Kevin's
# Email the chair on his first laptop screen (B-2). On the practice copy (Mon 16 Mar 2026). (The file keeps its name, so
# tools/tests_for.mjs still finds it for staff6/today.js.)
#
#   HOST=http://localhost:9447 python3 tests/staff6_today346.py     exits 1 when a check fails
import os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import staff6_lib as L

R = L.Results()
def overflow(pg): return pg.page.evaluate('document.documentElement.scrollWidth - innerWidth')

ROWS = """sel => [...document.querySelectorAll(sel + ' .v6-row')].map(r => ({
  name: r.querySelector('.v6-row-name')?.textContent.trim() || '', num: !!r.querySelector('.v6-row-top .v6-row-num'),
  line: r.querySelectorAll('.v6-row-line').length, kind: !!r.querySelector('.v6-row-lead.t6-kind'), tile: !!r.querySelector('.v6-at'),
  old: !!r.querySelector('.t6-jeye, .t6-jt, .t6-iss, .t6-jsay'), links: [...r.querySelectorAll('a')].filter(a => !a.closest('.v6-row-act')).length,
  btns: r.querySelectorAll('.v6-row-act .btn').length, cls: r.className }))"""
TODAY, SOON = 'section[aria-labelledby="t6-g-today"]', 'section[aria-labelledby="t6-g-soon"]'

with L.browser() as B:
  for w, h in [(1440, 900), (1280, 800)]:
    pg = B.page('NT', w, h); pg.open('/')
    R.check(f'{w}: no Today | Calendar tabs, no List | Calendar or Mine | Team switch', not pg.page.query_selector('.t6-caltabs, [data-tview], .t6-ways, [data-seg="tview"], [data-seg="tcwho"]'))
    R.check(f'{w}: no week on Today: no calendar and no day strip', not pg.page.query_selector('main #t6-week, main .t6-wk, main .hc-cal'))
    wk = pg.page.evaluate("(() => { const a = [...document.querySelectorAll('.t6-col a')].find(x => /See the week on Hearings/.test(x.textContent)); const c = document.querySelector('" + SOON + "'); return a ? { href: a.getAttribute('href'), after: !c || (c.compareDocumentPosition(a) & Node.DOCUMENT_POSITION_FOLLOWING) > 0 || c.contains(a) } : null; })()")
    R.check(f'{w}: Coming up ends with one quiet line to the week on Hearings', bool(wk) and wk['href'].startswith('#/hearings/week') and wk['after'], wk)
    rows = pg.page.evaluate(ROWS, TODAY)
    R.check(f'{w}: Do today has rows', len(rows) >= 3, len(rows))
    R.check(f'{w}: Do today keeps "In the order they are due"', 'In the order they are due' in pg.text(TODAY))
    soon = pg.page.evaluate(ROWS, SOON)
    allr = rows + soon
    R.check(f'{w}: every row is a name and one line', all(r['name'] and r['line'] == 1 for r in allr), [r['name'][:30] for r in allr if r['line'] != 1])
    R.check(f'{w}: a bill row names the job first, then the bill, its number small after', all(' · ' in r['name'] and r['num'] for r in allr if r['num']), [r['name'][:40] for r in allr if r['num'] and ' · ' not in r['name']])
    R.check(f'{w}: "File testimony · ..." leads a filing row', any(re.match(r'^File testimony · ', r['name']) for r in allr), [r['name'][:30] for r in allr])
    R.check(f'{w}: no quiet line above, no time column, no issue chip (R-346 gone)', not any(r['old'] for r in allr))
    R.check(f'{w}: no links inside the words: the whole row opens the item', all(r['links'] == 1 for r in allr), [(r['name'][:30], r['links']) for r in allr if r['links'] != 1])
    R.check(f'{w}: each row starts with one small neutral kind-of-job icon, no coloured tile (A-18)', all(r['kind'] and not r['tile'] for r in allr))
    R.check(f'{w}: at most one button a row (D16)', all(r['btns'] <= 1 for r in allr))
    R.check(f'{w}: in Coming up only a chair ask in its window has a button (own step due now, A-3)', all(r['btns'] == 0 or re.search(r't6-k-(chair|followask)\b', r['cls']) for r in soon), [r['name'][:30] for r in soon if r['btns']])
    R.check(f'{w}: no partner group in the list', not pg.page.query_selector('#t6-g-pq') and 'Partner words to approve' not in pg.text('.t6-col'))
    doors = pg.page.evaluate("[...document.querySelectorAll('.t6-aside .t6-doors .t6-line')].map(a => a.textContent.replace(/\\s+/g, ' ').trim())")
    R.check(f'{w}: the Team lines are short lines with no heading of their own', bool(doors) and not pg.page.query_selector('.t6-teamh, .t6-teamc') and any(re.match(r'^\d+ slipping on the team', d) for d in doors) and any(d.startswith('Waiting on others · ') for d in doors), doors)
    R.check(f'{w}: the next step card is first, with its one filled button', pg.page.evaluate("(() => { const n = document.querySelector('.t6-col').firstElementChild; return !!n?.querySelector('.t6-next, .t6-nexth') && n.querySelectorAll('.btn.primary').length === 1; })()"))
    R.check(f'{w}: no link inside a link', pg.page.evaluate("document.querySelectorAll('a a').length") == 0)
    R.check(f'{w}: no sideways scroll', overflow(pg) <= 0, overflow(pg))
    pick = pg.page.query_selector(f'{TODAY} .v6-row-main[data-v6pick]')
    pick.click(); pg.page.wait_for_timeout(600)
    R.check(f'{w}: a row still opens beside the list, the bill linked from the open item', bool(pg.page.query_selector('.t6-ld.open .v6-item a.v6-item-open, .t6-ld.open .v6-item a[href*="/bill/"]')))
    R.check(f'{w}: no page errors', not pg.errors, pg.errors[:2]); pg.close()

  # an old calendar address on Today opens the week's one home, Hearings
  pg = B.page('NT', 1440, 900); pg.open('/?view=cal'); pg.page.wait_for_timeout(600)
  R.check('an old #/?view=cal opens the week on Hearings', '#/hearings/week' in pg.page.url, pg.page.url); pg.close()

  # Kevin: asking a chair for a hearing starts on his first laptop screen (B-2)
  pg = B.page('KV', 1440, 900); pg.open('/')
  top = pg.page.evaluate("(() => { const b = [...document.querySelectorAll('main .btn')].find(x => /^\\s*Email the chairs?\\b/.test(x.textContent)); return b ? b.getBoundingClientRect().top : null; })()")
  R.check("Kevin 1440: Email the chair is on his first screen (B-2)", top is not None and top < 900, top); pg.close()

  # ---- a phone: the next step, Do today, Coming up, then the Team lines ----
  for who in ('NT', 'KV'):
    pg = B.page(who, 390, 844, mobile=True); pg.open('/')
    order = pg.page.evaluate("""(() => { const q = s => document.querySelector(s), F = Node.DOCUMENT_POSITION_FOLLOWING;
      const n = q('.t6-nextcol, .t6-hday-ph'), d = q('section[aria-labelledby="t6-g-today"]'), c = q('section[aria-labelledby="t6-g-soon"]'), t = q('.t6-col .t6-doors:not(.t6-later)');
      const after = (a, b) => !a || !b || (a.compareDocumentPosition(b) & F) > 0;
      return { ok: !!n && !!d && after(n, d) && after(d, c) && after(c || d, t), first: d?.querySelector('.v6-row')?.getBoundingClientRect().top ?? null }; })()""")
    R.check(f'390 {who}: the next step, Do today, Coming up, then the Team lines', order['ok'], order)
    R.check(f'390 {who}: the next step and the first Do today row are on the first screen', order['first'] is not None and order['first'] < 844, order['first'])
    R.check(f'390 {who}: no sideways scroll', overflow(pg) <= 0, overflow(pg))
    R.check(f'390 {who}: no page errors', not pg.errors, pg.errors[:2]); pg.close()

R.done()
