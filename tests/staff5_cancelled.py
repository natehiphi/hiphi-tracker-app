# Staff v5: a hearing cancelled with no new date yet keeps its testimony row (R-316 W24, G1-1). On the practice copy (Mon 16
# Mar 2026, 9:00 am) as Nate, laptop 1440x900: the sitting of one of his late or due-today drafts is marked cancelled in the
# page's own state (nothing is saved), with no later sitting of that committee for the bill, and the screens redrawn.
# Today keeps the bill's row, saying "<committee> hearing cancelled, no new date yet", with no countdown and no File at the
# Capitol, under Coming up (never Late, Overdue or Needs you today, never in the badge); This week keeps it out of every
# day (fresh-eyes: in today's Other to-dos it read as today's work) and names the bill once under the grid, "Waiting for
# a new hearing date: SB3025", a link to its page; Slipping does not count it and says the same line; Review keeps an
# approval for such a sitting. A bill that has died drops it. Then the sitting is put back and the row is as it was.
# Exits 1 when a check fails.
#   python3 tests/staff5_cancelled.py                  against http://localhost:8832 (CI serves the repo there)
#   V4_ROOT=/path/to/worktree python3 tests/staff5_cancelled.py    serves that folder straight into the browser
import os, re, sys
from playwright.sync_api import sync_playwright
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from staff5_people import router, HOST, ROOT

fails = []
def check(ok, what, detail=''):
  print(('ok   ' if ok else 'FAIL ') + what + (f'  ({detail})' if detail and not ok else ''))
  if not ok: fails.append(what)

# Pick Nate's most pressing testimony step (late but open first, then due today) on a bill with nothing else on his list (a
# message on the same bill would lead its row), and cancel (or put back) every sitting of its committee for that bill, so
# hearingFor has no new sitting to move it to. Returns what the checks need.
PICK = """async () => { const T = await import('./staff5/today.js');
  const r = T.todayItems('mine'), want = ['file', 'write', 'submit', 'revise'];
  const c = ['lateopen', 'today', 'overdue'].flatMap(g => r.cards.filter(c => c.group === g)).find(c => c.b && c.tasks.length === 1 && want.includes(c.p.kind) && c.p.d && c.p.h);
  return c ? { num: c.b.bill_number, bid: c.b.id, cmte: c.p.d.committee, kind: c.p.kind, group: c.group, badge: r.dueNow } : null; }"""
SET = """async ([bid, cmte, status, back]) => { const { S, hooks } = await import('./staff5/data.js');
  const hs = S.hearings.filter(h => h.bill_id === bid && h.committee === cmte);
  for (const h of hs) { h._was ??= { status: h.status, at: h.scheduled_at }; h.status = status ?? h._was.status;
    h.scheduled_at = back ? new Date(new Date(h._was.at).getTime() - back * 864e5).toISOString() : h._was.at; }
  hooks.render(); await new Promise(r => setTimeout(r, 500)); return hs.length; }"""
# The row of a bill on Today (laptop rows), its group's heading, its words, its mark and its button.
ROW = """(num) => { const later = document.querySelector('[data-fold="later"]'); if (later && later.getAttribute('aria-expanded') !== 'true') later.click();
  return new Promise(res => setTimeout(() => { const r = document.querySelector(`.td-row[data-num="${num}"]`); if (!r) return res(null);
    const g = r.closest('section.td-group'), h = g && g.querySelector('h2');
    res({ group: h ? h.innerText.split('\\n')[0].trim() : '', text: r.innerText.replace(/\\s+/g, ' '), mark: (r.querySelector('.td-urg') || {}).innerText || '',
      none: !!r.querySelector('.sv-urg.none'), btn: (r.querySelector('.td-ract') || {}).innerText || '' }); }, 400)); }"""

# The "Waiting for a new hearing date" line under a selector: its words, and each bill number's link.
WAIT = """(sel) => { const e = document.querySelector(sel); if (!e) return null;
  return { text: e.innerText.replace(/\\s+/g, ' ').trim(), links: Object.fromEntries([...e.querySelectorAll('a')].map(a => [a.textContent.trim(), a.getAttribute('href')])) }; }"""

with sync_playwright() as p:
  br = p.chromium.launch(); pg = br.new_page(viewport={'width': 1440, 'height': 900}); errs = []
  pg.on('pageerror', lambda e: errs.append(str(e)))
  if ROOT: pg.route(HOST + '/**', router)
  pg.goto(HOST + '/staff5.html?demo=1&as=NT#/'); pg.wait_for_timeout(4000)
  t = pg.evaluate(PICK)
  check(t is not None, 'Practice data: Nate has a late or due-today testimony step to cancel', t)
  if t:
    num, bid, cmte = t['num'], t['bid'], t['cmte']
    print(f"   using {num}, its {cmte} sitting ({t['kind']}, {t['group']})")
    before = pg.evaluate(ROW, num)
    slip = lambda: pg.evaluate("document.querySelectorAll('.td-slip .td-row, .td-slip .td-mrow').length")
    pg.evaluate("location.hash = '#/?scope=team'"); pg.wait_for_timeout(1500); slip0 = slip()
    pg.evaluate("location.hash = '#/'"); pg.wait_for_timeout(1500)

    # Cancelled, no new date yet
    pg.evaluate(SET, [bid, cmte, 'cancelled', 0])
    row = pg.evaluate(ROW, num)
    words = f'{cmte} hearing cancelled, no new date yet'
    check(row is not None, f'Today: {num} keeps its row when its {cmte} sitting is cancelled')
    if row:
      check(words in row['text'], f'Today: the row says "{words}"', row['text'])
      check(row['none'] and not re.search(r'\d', row['mark']), 'Today: the row has no countdown', row['mark'])
      check(row['group'].startswith('Coming up'), 'Today: it waits under Coming up', row['group'])
      check(not re.match(r'(Late|Overdue|Needs you today)', row['group']), 'Today: not under Late testimony, Overdue or Needs you today', row['group'])
      check('File at the Capitol' not in row['btn'], 'Today: no File at the Capitol for a cancelled sitting', row['btn'])
    badge = pg.evaluate("import('./staff5/today.js').then(T => T.todayItems('mine').dueNow)")
    check(badge == t['badge'] - 1, 'Today: it leaves the badge count', f"{t['badge']} -> {badge}")
    pg.locator(f'.td-row[data-num="{num}"] .td-rsel').first.click(); pg.wait_for_timeout(500)
    pane = pg.inner_text('#td-pane') if pg.locator('#td-pane').count() else ''
    check(f'{cmte} hearing cancelled' in pane and 'no new date yet' in pane, 'Open item: the hearing line says cancelled, no new date yet', pane[:160].replace('\n', ' '))
    check('I’m going' not in pane and 'Nobody going yet' not in pane, 'Open item: no I\'m going for a cancelled sitting', '')

    pg.evaluate("location.hash = '#/?view=week'"); pg.wait_for_timeout(2000)
    days = pg.evaluate("[...document.querySelectorAll('.td-weekgrid .td-day')].map(d => d.innerText.replace(/\\s+/g, ' ')).join(' | ')")
    check('no new date yet' not in days, 'This week: the cancelled sitting\'s step is in no day (not today\'s Other to-dos)', days[:200])
    dl = pg.evaluate("(num) => [...document.querySelectorAll('.wk-dl')].filter(e => e.innerText.includes(num)).length", num)
    check(dl == 0, 'This week: no testimony deadline card for the cancelled sitting', dl)
    wait = pg.evaluate(WAIT, '.td-weekgrid + .td-waitdate')
    check(wait and wait['text'].startswith('Waiting for a new hearing date: ') and num in wait['links'], f'This week: under the grid, "Waiting for a new hearing date: {num}"', wait)
    check(wait and wait['links'].get(num, '').endswith('/' + num), f'This week: {num} there opens its bill page', wait and wait['links'])

    pg.evaluate("location.hash = '#/?scope=team'"); pg.wait_for_timeout(1500)
    slip1 = slip(); inslip = pg.locator(f'.td-slip [data-num="{num}"]').count()
    quiet = pg.evaluate(WAIT, '.td-slip .td-waitdate')
    check(inslip == 0, f'Slipping: {num} is not counted', f'{slip0} -> {slip1}')
    check(quiet and quiet['text'].startswith('Waiting for a new hearing date: ') and quiet['links'].get(num, '').endswith('/' + num), f'Slipping: one quiet line, "Waiting for a new hearing date: {num}", its number a link to the bill', quiet)

    # An old date says nothing for a cancelled sitting: five days back, it stays while the bill is alive; a dead bill drops it.
    pg.evaluate(SET, [bid, cmte, 'cancelled', 5]); pg.evaluate("location.hash = '#/'"); pg.wait_for_timeout(1500)
    check(pg.evaluate(ROW, num) is not None, 'Today: a sitting cancelled 5 days ago still keeps the row (no new date yet)')
    pg.evaluate("async (bid) => { const { S, hooks } = await import('./staff5/data.js'); const b = S.bills.find(x => x.id === bid); b._st = b.stage_override; b.stage_override = 'dead'; hooks.render(); }", bid)
    pg.wait_for_timeout(600)
    gone = pg.evaluate(ROW, num)
    check(gone is None or words not in gone['text'], 'Today: once the bill has died, the cancelled sitting\'s row goes', gone)
    pg.evaluate("async (bid) => { const { S, hooks } = await import('./staff5/data.js'); const b = S.bills.find(x => x.id === bid); b.stage_override = b._st; hooks.render(); }", bid)

    # Put back: the row is as it was
    pg.evaluate(SET, [bid, cmte, None, 0]); pg.evaluate("location.hash = '#/'"); pg.wait_for_timeout(1500)
    row = pg.evaluate(ROW, num)
    check(row is not None and row['group'] == before['group'] and 'cancelled' not in row['text'] and row['mark'] == before['mark'], 'Put back: the row returns to its group, words and countdown',
          f"{before and before['group']} / {row and row['group']}: {row and row['text'][:80]}")
    pg.evaluate("location.hash = '#/?scope=team'"); pg.wait_for_timeout(1500)
    check(slip() == slip0 and not pg.locator('.td-waitdate').count(), 'Put back: Slipping counts it again and the quiet line goes', f'{slip0} -> {slip()}')

  # Review keeps an approval for a cancelled sitting, saying so (it was dropped once the old date was two days past)
  pg.goto(HOST + '/staff5.html?demo=1&as=NT#/'); pg.wait_for_timeout(3500)
  rv = pg.evaluate("""async () => { const T = await import('./staff5/today.js'); const q = T.reviewQueue().filter(x => x.type === 'draft');
    return q.length ? { bid: q[0].b.id, num: q[0].b.bill_number, cmte: q[0].d.committee, n: q.length } : null; }""")
  check(rv is not None, 'Practice data: Nate has testimony to approve', rv)
  if rv:
    pg.evaluate(SET, [rv['bid'], rv['cmte'], 'cancelled', 5])
    q = pg.evaluate("async (bid) => { const T = await import('./staff5/today.js'); return T.reviewQueue().filter(x => x.type === 'draft' && x.b.id === bid).length; }", rv['bid'])
    check(q == 1, f"Review: {rv['num']}'s approval stays when its {rv['cmte']} sitting was cancelled 5 days ago", q)
    pg.evaluate("location.hash = '#/review'"); pg.wait_for_timeout(1500)
    txt = pg.inner_text('main')
    check(f"{rv['cmte']} hearing cancelled, no new date yet" in txt, 'Review: it says the hearing was cancelled, no new date yet', '')
  check(not errs, 'No page errors', errs[:1])
  br.close()
print('\nall passed' if not fails else f'\n{len(fails)} failed'); sys.exit(1 if fails else 0)
