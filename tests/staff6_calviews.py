# Staff v6: the week calendar on All issues, and (R-352) none on Today, whose old calendar link opens Hearings' (R-342, Nate 26 Oct: "Can there be a calendar view for all issues,
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
  # R-346 after the fresh-eyes review: each entry says its issue as one quiet line (icon and name, muted, no pastel fill, A-5)
  R.check('each entry on our bills says its issue, a link that opens the issue', len(pg.page.query_selector_all(".hc-isl a.hc-iss[href^='#/issue/']")) >= 10, len(pg.page.query_selector_all(".hc-isl a.hc-iss")))
  R.check('the issue line is quiet: no fill, the muted colour, an icon', pg.page.evaluate("[...document.querySelectorAll('.hc-isl a.hc-iss')].every(e => /rgba\\(0, 0, 0, 0\\)|transparent/.test(getComputedStyle(e).backgroundColor) && e.querySelector('svg'))"))
  R.check('every entry is the same card: one background, radius and padding', pg.page.evaluate("new Set([...document.querySelectorAll('.hc-cal .hc-e, .hc-cal .hc-cap')].map(e => { const s = getComputedStyle(e); return [s.backgroundColor, s.borderTopLeftRadius, s.paddingTop, s.paddingLeft].join('|'); })).size") == 1)
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

  # ---- Today (R-352, Nate 27 Oct: "Calendar: Hearings only"): no week on Today, no calendar and no switch; Coming up ends
  # with one quiet line to the week on Hearings, and an old #/?view=cal link opens that calendar ----
  pg = B.page('NT', 1440, 900); pg.page.on('pageerror', lambda e: errs.append(str(e))); pg.open('/')
  R.check('Today has no week calendar and no Mine | Team switch', bool(pg.page.query_selector('.t6-ld')) and not pg.page.query_selector('main .hc-cal, #t6-week, [data-seg="tcwho"]'))
  R.check('no Today | Calendar tabs and no List | Calendar switch on Today', not pg.page.query_selector('.t6-caltabs, [data-tview], .t6-ways'))
  R.check('Today ends Coming up with "See the week on Hearings"', pg.page.evaluate("[...document.querySelectorAll('.t6-col a')].some(a => /See the week on Hearings/.test(a.textContent) && a.getAttribute('href').startsWith('#/hearings/week'))"))
  R.check('no link inside a link on Today', pg.page.evaluate("document.querySelectorAll('a a').length") == 0)
  pg.page.goto(pg.url('/?view=cal')); pg.page.wait_for_timeout(1200); pg.ready()
  R.check("an old #/?view=cal link opens the week's calendar on Hearings", '#/hearings/week' in pg.page.url and bool(pg.page.query_selector('main .hc-cal')), pg.page.url)
  pg.close()

  # ---- phones: one day at a time ----
  for route in ['/?view=cal', '/my-issues/all?view=cal']:
    pg = B.page('NT', 390, 844, mobile=True); pg.open(route)
    R.check(f'{route} on a phone: one day with five day buttons', pg.page.evaluate(COLS) == 1 and len(pg.page.query_selector_all('[data-hcpick]')) == 5)
    R.check(f'{route} on a phone: nothing runs off the side', overflow(pg) <= 0, overflow(pg))
  R.check('no script errors', not errs, errs[:3])
R.done()
