# Staff v6: Hearings > This week as a calendar (R-336, Nate 25 Oct walk 1: "There still needs to be a calendar view that's
# easily apparent and accessible"). A List | Calendar switch on This week, remembered per person and reachable by address
# (#/hearings/week?view=cal); Monday to Friday as five columns on a laptop, one day at a time with day buttons on a phone;
# hearings, testimony due times, Capitol deadlines and the person's own dated to-dos in each day. On the practice copy
# (Mon 16 Mar 2026).
#
#   V4_ROOT=/path/to/worktree python3 tests/staff6_calendar.py     exits 1 when a check fails
import os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import staff6_lib as L

R = L.Results()
CAL = '/hearings/week?view=cal'
COLS = "[...document.querySelectorAll('.hc-grid > .hc-day')].filter(e => e.offsetParent).length"
def day_text(pg, d): return ' '.join(pg.page.evaluate("d => document.querySelector(`.hc-day[data-hcday='${d}']`)?.innerText || ''", d).split())
def overflow(pg): return pg.page.evaluate('document.documentElement.scrollWidth - innerWidth')

with L.browser() as B:
  # ---- the switch is in sight on This week, List first for someone who never picked ----
  pg = B.page('NT', 1440, 900); pg.open('/hearings/week')
  sw = pg.page.query_selector('[data-seg="hview"][data-val="cal"]')
  R.check('This week shows a List | Calendar switch', bool(sw) and sw.is_visible() and pg.page.query_selector('[data-seg="hview"][data-val="list"]').get_attribute('aria-pressed') == 'true')
  R.check('List is the view for someone who never picked', not pg.page.query_selector('.hc-cal'))
  # ---- picking Calendar: five day columns ----
  sw.click(); pg.ready()
  R.check('Calendar shows five day columns on a laptop', pg.page.evaluate(COLS) == 5, pg.page.evaluate(COLS))
  R.check('the address says view=cal', 'view=cal' in pg.hash(), pg.hash())
  mon = day_text(pg, '2026-03-16')
  R.check("Nate's Monday: the Senate HHS hearing at 1:10 PM in Room 225 with HB 1562", all(x in mon for x in ['1:10 PM', 'Senate Health and Human Services', 'Room 225', 'HB 1562']), mon[:200])
  R.check('Monday is marked Today', 'Today' in mon and pg.page.query_selector(".hc-day[data-hcday='2026-03-16'][aria-current='date']") is not None)
  # R-346 finding D: one shape for every entry, the time then the kind ("1:00 PM Testimony due"), the job as the entry's link
  R.check('a testimony due entry, with its state', bool(pg.page.query_selector('.hc-due')) and re.search(r'\d{1,2}:\d{2} [AP]M\s*Testimony due', pg.text('.hc-cal')) is not None and re.search(r'Writing|With an approver|Second look|Ready to file', pg.text('.hc-cal')) is not None)
  R.check('the hearing block opens the sitting', bool(pg.page.query_selector(".hc-day[data-hcday='2026-03-16'] .hc-h a.hc-job[href^='#/hearing/']")))
  R.check('every entry has one shape: time, kind, job (R-346 D)', pg.page.evaluate("[...document.querySelectorAll('.hc-cal .hc-e')].every(e => e.querySelector('.hc-t') && e.querySelector('.hc-ek') && e.querySelector('a.hc-job'))"))
  R.check('each bill on an entry says its issue: icon and whole name (R-346 D, E)', pg.page.evaluate("[...document.querySelectorAll('.hc-cal .hc-iss')].length > 0 && [...document.querySelectorAll('.hc-cal .hc-iss')].every(c => c.querySelector('svg') && !/…$/.test(c.textContent.trim()))"))
  R.check('no link inside a link', pg.page.evaluate("document.querySelectorAll('a a').length") == 0)
  thu = day_text(pg, '2026-03-19')
  R.check('Capitol deadline Triple filing on Thu 3/19', 'Triple filing' in thu, thu[:120])
  R.check('a follow-up to-do in the week', 'Follow up with' in pg.text('.hc-cal'))
  R.check('nothing runs off the side at 1440', overflow(pg) <= 0, overflow(pg))
  # ---- remembered after a reload, with no view in the address ----
  pg.page.goto(pg.url('/hearings/week')); pg.page.wait_for_timeout(500); pg.ready()
  R.check('the pick is remembered after a reload', bool(pg.page.query_selector('.hc-cal')))
  # ---- next week's arrow keeps the calendar ----
  pg.page.click('[data-hweek="1"]'); pg.ready()
  R.check('Next week arrow works in the calendar', 'Next week' in pg.text('.hw-nav') and bool(pg.page.query_selector(".hc-day[data-hcday='2026-03-23']")), pg.hash())
  # ---- back to List, remembered too ----
  pg.page.click('[data-seg="hview"][data-val="list"]'); pg.ready()
  R.check('List can be picked again', not pg.page.query_selector('.hc-cal'))
  R.check('no page errors (Nate, laptop)', not pg.errors, pg.errors[:2]); pg.close()

  # ---- the address alone opens it; Lauren's TRN hearing ----
  pg = B.page('LR', 1280, 800); pg.open(CAL)
  tue = day_text(pg, '2026-03-17')
  R.check("?view=cal opens the calendar (Lauren)", bool(pg.page.query_selector('.hc-cal')))
  R.check("Lauren's Tuesday: SB 3234, Transportation 9:30 AM, Room 430", all(x in tue for x in ['9:30 AM', 'SB 3234', 'Room 430']), tue[:200])
  R.check('nothing runs off the side at 1280', overflow(pg) <= 0, overflow(pg))
  R.check('no page errors (Lauren)', not pg.errors, pg.errors[:2]); pg.close()

  # ---- 1024: still five columns, nothing overflows ----
  pg = B.page('NT', 1024, 768); pg.open(CAL)
  R.check('five columns at 1024', pg.page.evaluate(COLS) == 5)
  R.check('nothing runs off the side at 1024', overflow(pg) <= 0 and pg.page.evaluate("[...document.querySelectorAll('.hc-day')].every(d => d.scrollWidth <= d.clientWidth + 1)"))
  pg.close()

  # ---- phones: one day at a time, day buttons, no sideways scroll ----
  for w, h in [(390, 844), (320, 640)]:
    pg = B.page('NT', w, h); pg.open(CAL)
    btns = pg.page.query_selector_all('[data-hcpick]')
    R.check(f'{w}: five day buttons', len(btns) == 5 and all(b.is_visible() for b in btns), len(btns))
    R.check(f'{w}: one day shown, today first', pg.page.evaluate(COLS) == 1 and 'Today' in pg.text('.hc-day.on'))
    pg.page.click('[data-hcpick="2026-03-19"]'); pg.page.wait_for_timeout(150)
    R.check(f'{w}: a day button shows that day', 'Triple filing' in pg.text('.hc-day.on') and pg.page.get_attribute('[data-hcpick="2026-03-19"]', 'aria-pressed') == 'true')
    R.check(f'{w}: no sideways scroll', overflow(pg) <= 0, overflow(pg))
    R.check(f'{w}: no page errors', not pg.errors, pg.errors[:2]); pg.close()

R.done()
