# Staff v6: All issues' week calendar, reached by More's Issues calendar row only (R-342; R-352 FIX-3, Nate 28 Oct: "keep the calendar
# view"); no week on Today, whose old calendar link opens Hearings' (R-352). R-342, Nate 26 Oct: "Can there be a calendar view for all issues,
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
  # ---- All issues (R-352 FIX-3, Nate 28 Oct: "keep the calendar view"): one way in (A-12 on v6), the Issues calendar row on More; no
  # Cards | Calendar switch; nothing over the title; #/issues/all?view=cal opens it again (no redirect to Hearings) ----
  pg = B.page('NT', 1440, 900); pg.page.on('pageerror', lambda e: errs.append(str(e))); pg.open('/issues/all')
  R.check('All issues shows its cards, no calendar', not pg.page.query_selector('.hc-cal') and bool(pg.page.query_selector('.ig6-grid')))
  tabs = pg.page.evaluate("[...document.querySelectorAll('.i6-head .sv-secnav a')].map(a => [a.textContent.trim(), a.getAttribute('href')])")
  R.check('the Issues tabs are My issues · All issues · Bills · Coalitions, with no Calendar tab', [t[0] for t in tabs] == ['My issues', 'All issues', 'Bills', 'Coalitions'], tabs)
  R.check('All issues has no Cards | Calendar switch (one way in, A-12)', not pg.page.query_selector('[data-seg="iview"], .is6-swap'))
  R.check('nothing sits above the page title', pg.page.evaluate("document.querySelector('main .is6-index')?.firstElementChild?.matches('header.i6-head')"))
  pg.open('/tools')
  R.check('More has an "Issues calendar" row that opens #/issues/all?view=cal', bool(pg.page.query_selector('main a[href="#/issues/all?view=cal"]')) and 'Issues calendar' in pg.text('main'))
  pg.page.click('main a[href="#/issues/all?view=cal"]'); pg.page.wait_for_timeout(900); pg.ready()
  R.check('the Issues calendar row opens the week on All issues, not Hearings', '#/issues/all?view=cal' in pg.page.url and bool(pg.page.query_selector('main .is6-cal .hc-cal')), pg.page.url)
  R.check('All issues is the current tab on the calendar', pg.page.evaluate("document.querySelector('.i6-head .sv-secnav a[aria-current=\"page\"]')?.textContent.trim()") == 'All issues')
  R.check("it says whose week: all the team's bills", 'team’s bills' in pg.text('main .is6-cal .hw-bar'), pg.text('main .is6-cal .hw-bar'))
  R.check('five weekday columns on a laptop', pg.page.evaluate(COLS) == 5, pg.page.evaluate(COLS))
  R.check("entries name their bills' issues (hearings.js issueTags)", pg.page.evaluate("document.querySelectorAll('main .is6-cal .hc-iss').length") > 0)
  # the same colour of time as Hearings (A-5 on v6, steps.js status): due today is plain, "· due today" in the body colour
  st = pg.page.evaluate("[...document.querySelectorAll('main .is6-cal .hc-st')].map(e => [e.className, e.textContent.trim(), getComputedStyle(e).color])")
  today = [x for x in st if ' today' in x[0]]
  # plain: the body or muted text colour (tokens.css), never the amber of Late or the red of overdue
  plain = pg.page.evaluate("['--v6-body', '--v6-muted', '--v6-ink'].map(v => { const e = document.createElement('span'); e.style.color = `var(${v})`; document.body.appendChild(e); const c = getComputedStyle(e).color; e.remove(); return c; })")
  R.check('due today reads "· due today", plain (body, muted or ink text, never amber or red)', bool(today) and all(x[1].endswith('· due today') and x[2] in plain for x in today), (today[:2], plain))
  hs = pg.page.evaluate("[...document.querySelectorAll('main .hc-st')].map(e => e.textContent.trim())")
  pg.page.goto(pg.url('/hearings/week?view=cal&scope=team')); pg.page.wait_for_timeout(1200); pg.ready()
  hh = pg.page.evaluate("[...document.querySelectorAll('main .hc-st')].map(e => e.textContent.trim())")
  R.check("one wording per state: All issues' calendar says what Hearings' team calendar says", sorted(set(hs)) == sorted(set(hh)), (sorted(set(hs))[:6], sorted(set(hh))[:6]))
  pg.page.goto(pg.url('/issues/all?view=cal&w=1')); pg.page.wait_for_timeout(1200); pg.ready()
  R.check('a link to another week keeps it (w=1), on All issues', '#/issues/all?view=cal&w=1' in pg.page.url and 'Next week' in pg.text('main .is6-cal .hw-bar'), pg.page.url)
  pg.page.click('[data-hweek="2"]'); pg.page.wait_for_timeout(900); pg.ready()
  R.check('Next week moves on and stays on All issues', '#/issues/all?view=cal&w=2' in pg.page.url, pg.page.url)
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
  for route in ['/?view=cal', '/issues/all?view=cal']:
    pg = B.page('NT', 390, 844, mobile=True); pg.open(route)
    R.check(f'{route} on a phone: one day with five day buttons', pg.page.evaluate(COLS) == 1 and len(pg.page.query_selector_all('[data-hcpick]')) == 5)
    R.check(f'{route} on a phone: nothing runs off the side', overflow(pg) <= 0, overflow(pg))
  R.check('no script errors', not errs, errs[:3])
R.done()
