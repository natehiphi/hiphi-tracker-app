# Staff v6: (R-352) no week calendar on All issues or Today; their old calendar links open Hearings' (R-342, Nate 26 Oct: "Can there be a calendar view for all issues,
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
  # ---- All issues (R-352, Nate 27 Oct: "Calendar: Hearings only"): no Calendar tab, no Cards | Calendar switch, nothing over
  # the title; an old #/my-issues/all?view=cal link opens the team's week calendar on Hearings, on the same week ----
  pg = B.page('NT', 1440, 900); pg.page.on('pageerror', lambda e: errs.append(str(e))); pg.open('/my-issues/all')
  R.check('All issues shows its cards, no calendar', not pg.page.query_selector('.hc-cal') and bool(pg.page.query_selector('.ig6-grid')))
  R.check("My issues' tabs carry no Calendar", 'Calendar' not in pg.text('.i6-head .sv-secnav'), pg.text('.i6-head .sv-secnav'))
  R.check('All issues has no Cards | Calendar switch', not pg.page.query_selector('[data-seg="iview"], .is6-swap'))
  R.check('nothing sits above the page title', pg.page.evaluate("document.querySelector('main .is6-index')?.firstElementChild?.matches('header.i6-head')"))
  pg.page.goto(pg.url('/my-issues/all?view=cal')); pg.page.wait_for_timeout(1200); pg.ready()
  R.check("an old All issues calendar link opens the team's week calendar on Hearings", '#/hearings/week' in pg.page.url and 'view=cal' in pg.page.url and 'scope=team' in pg.page.url and bool(pg.page.query_selector('main .hc-cal')), pg.page.url)
  pg.page.goto(pg.url('/my-issues/all?view=cal&w=1')); pg.page.wait_for_timeout(1200); pg.ready()
  R.check('and keeps its week (w=1)', '#/hearings/week' in pg.page.url and 'w=1' in pg.page.url, pg.page.url)
  pg.close()

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
