# Staff v6: the week calendar on All issues and on Today (R-342, Nate 26 Oct: "Can there be a calendar view for all issues,
# and for the today page?"; his picks: All issues a week grid by issue; Today My week or the team's with a switch; both a
# List | Calendar switch and a Calendar tab "for now"). The same calendar as Hearings (hearings.js weekCalHTML). On the
# practice copy (Mon 16 Mar 2026).
#
#   V4_ROOT=/path/to/worktree python3 tests/staff6_calviews.py     exits 1 when a check fails
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import staff6_lib as L

R = L.Results()
COLS = "[...document.querySelectorAll('.hc-grid > .hc-day')].filter(e => e.offsetParent).length"
def overflow(pg): return pg.page.evaluate('document.documentElement.scrollWidth - innerWidth')
def day(pg, d): return ' '.join(pg.page.evaluate("d => document.querySelector(`.hc-day[data-hcday='${d}']`)?.innerText || ''", d).split())

with L.browser() as B:
  errs = []
  # ---- All issues: a Calendar tab and a Cards | Calendar switch; Cards for someone who never picked ----
  pg = B.page('NT', 1440, 900); pg.page.on('pageerror', lambda e: errs.append(str(e))); pg.open('/my-issues/all')
  R.check('All issues opens on its cards for someone who never picked', not pg.page.query_selector('.hc-cal') and bool(pg.page.query_selector('.ig6-grid')))
  R.check("My issues' tabs carry Calendar", 'Calendar' in pg.text('.i6-head .sv-secnav'))
  R.check('All issues shows a Cards | Calendar switch', bool(pg.page.query_selector('[data-seg="iview"][data-val="cal"]')))
  pg.page.click('[data-seg="iview"][data-val="cal"]'); pg.ready()
  R.check('the switch opens the week: five day columns', pg.page.evaluate(COLS) == 5, pg.page.evaluate(COLS))
  R.check('the Calendar tab is the current one', pg.page.evaluate("document.querySelector('.i6-head .sv-secnav [aria-current=page]')?.textContent.trim()") == 'Calendar')
  mon = day(pg, '2026-03-16')
  R.check("Monday's Senate HHS hearing with HB 1562 and its issue", all(x in mon for x in ['Senate Health and Human Services', 'HB 1562', 'Youth mental health app pilot']), mon[:200])
  R.check('each bill carries its issue as a chip that opens the issue', len(pg.page.query_selector_all(".hc-iss[href^='#/issue/']")) >= 10)
  R.check('a chip wears its topic tint', pg.page.evaluate("[...document.querySelectorAll('.hc-iss')].every(e => /ig6-tint\\d/.test(e.className))"))
  R.check('no Your step entries on All issues (they are Today\'s own)', not pg.page.query_selector('.hc-step'))
  R.check('no link inside a link', pg.page.evaluate("document.querySelectorAll('a a').length") == 0)
  R.check('Capitol deadline Triple filing on Thu 3/19', 'Triple filing' in day(pg, '2026-03-19'))
  R.check('nothing runs off the side at 1440', overflow(pg) <= 0, overflow(pg))
  pg.page.goto(pg.url('/my-issues/all')); pg.page.wait_for_timeout(500); pg.ready()
  R.check('the pick is remembered after a reload', bool(pg.page.query_selector('.hc-cal')))
  pg.page.click('[aria-label="Next week"]'); pg.ready()
  R.check('next week keeps the calendar and says it in the address', bool(pg.page.query_selector('.hc-cal')) and 'w=1' in pg.hash(), pg.hash())
  pg.page.click('.i6-head .sv-secnav a:has-text("All issues")'); pg.ready()
  R.check('the All issues tab goes back to the cards', bool(pg.page.query_selector('.ig6-grid')) and not pg.page.query_selector('.hc-cal'))

  # ---- Today: Today | Calendar tabs and a List | Calendar switch; Mine | Team inside ----
  pg = B.page('NT', 1440, 900); pg.page.on('pageerror', lambda e: errs.append(str(e))); pg.open('/')
  R.check('Today opens on its list for someone who never picked', not pg.page.query_selector('.hc-cal') and bool(pg.page.query_selector('.t6-ld')))
  R.check('Today shows Today | Calendar tabs', 'Calendar' in pg.text('.t6-caltabs'))
  R.check('Today shows a List | Calendar switch', bool(pg.page.query_selector('[data-tview="cal"]')))
  pg.page.click('.t6-caltabs a:has-text("Calendar")'); pg.ready()
  R.check('the Calendar tab opens the week', pg.page.evaluate(COLS) == 5)
  R.check('Mine is the start', pg.page.get_attribute('[data-seg="tcwho"][data-val="mine"]', 'aria-pressed') == 'true')
  mine = pg.text('.hc-cal')
  R.check("Mine has Nate's 1:10 PM hearing and his follow-up", '1:10 PM' in mine and 'Follow up with' in mine)
  steps = [' '.join(e.inner_text().split()) for e in pg.page.query_selector_all('.hc-step')]
  R.check("Mine's own steps keep Today's times: Approve HB 1523 by 11:00 AM, Resubmit HB 2116 by 4:00 PM", any('By 11:00 AM' in x and 'Approve' in x and 'HB 1523' in x for x in steps) and any('By 4:00 PM' in x and 'Resubmit' in x for x in steps), steps[:4])
  R.check('a late step says late, not a dangling "until today"', not any('until today' in x for x in steps), steps[:4])
  R.check('Mine draws no issue chips (Today is about the person)', not pg.page.query_selector('.hc-iss'))
  pg.page.click('[data-seg="tcwho"][data-val="team"]'); pg.ready()
  team = pg.text('.hc-cal')
  R.check('Team says whose each to-do is', 'For ' in team, team[:80])
  R.check('Team has more hearings than Mine', team.count('Hearing') >= mine.count('Hearing'), (team.count('Hearing'), mine.count('Hearing')))
  R.check('the address says who=team, not scope= (which opens Team)', 'who=team' in pg.hash() and 'scope=' not in pg.hash(), pg.hash())
  R.check('nothing runs off the side at 1440', overflow(pg) <= 0, overflow(pg))
  pg.page.goto(pg.url('/')); pg.page.wait_for_timeout(500); pg.ready()
  R.check('Today remembers Calendar after a reload', bool(pg.page.query_selector('.hc-cal')))
  pg.page.click('[data-tview="list"]'); pg.ready()
  R.check('List goes back to the day', bool(pg.page.query_selector('.t6-ld')) and not pg.page.query_selector('.hc-cal'))

  # ---- phones: one day at a time ----
  for route in ['/?view=cal', '/my-issues/all?view=cal']:
    pg = B.page('NT', 390, 844, mobile=True); pg.open(route)
    R.check(f'{route} on a phone: one day with five day buttons', pg.page.evaluate(COLS) == 1 and len(pg.page.query_selector_all('[data-hcpick]')) == 5)
    R.check(f'{route} on a phone: nothing runs off the side', overflow(pg) <= 0, overflow(pg))
  R.check('no script errors', not errs, errs[:3])
R.done()
