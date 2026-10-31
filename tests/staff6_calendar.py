# Staff v6: Hearings > This week as a calendar (R-336, Nate 25 Oct walk 1: "There still needs to be a calendar view that's
# easily apparent and accessible"). R-352 (Nate 27 Oct): Hearings is the calendar's one home (B-13 on v6), with an issue
# filter (the All issues calendar's job) and old calendar addresses' words (who=, day=) read; the view is one plain link on
# the Filter button's sheet ("Show the week as" A list / A calendar; R-356 round 3, one row of controls: it was a link on the
# date line), never a second pill beside Mine | Team (A-12 on v6). Remembered per
# person and reachable by address (#/hearings/week?view=cal); Monday to Friday as five columns on a laptop, one day at a time with day buttons on a phone;
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
  # ---- the way to the calendar is in sight on This week, List first for someone who never picked ----
  pg = B.page('NT', 1440, 900); pg.open('/hearings/week')
  fb = pg.page.query_selector('.hw-bar [data-hwfilter]')
  R.check('This week has one Filter button, and no "See as calendar" link on the date line (R-356 round 3)', bool(fb) and fb.is_visible() and 'Filter' in fb.inner_text() and not pg.page.query_selector('a.hw-view'))
  def show_as(v):
    pg.page.click('[data-hwfilter]'); pg.page.wait_for_selector('[data-pview]'); pg.page.click(f'[data-pview="{v}"]'); pg.ready()
  R.check('one switch on the page: Mine | Team only, no List | Calendar pill (A-12 on v6)', pg.page.evaluate("document.querySelectorAll('.hw-bar .sv-seg').length") == 1 and not pg.page.query_selector('[data-seg="hview"]'))
  R.check('List is the view for someone who never picked', not pg.page.query_selector('.hc-cal'))
  pg.page.click('[data-hwfilter]'); pg.page.wait_for_selector('[data-pv="all"]')
  R.check('the Filter sheet holds the issues, All issues first, and the two ways to see the week (R-352, R-356 round 3)', pg.page.evaluate("document.querySelector('[data-pv=\"all\"]').getAttribute('aria-checked')") == 'true' and bool(pg.page.query_selector('[data-pview="cal"]')) and bool(pg.page.query_selector('[data-pview="list"]')))
  pg.page.keyboard.press('Escape'); pg.page.wait_for_timeout(300)
  # ---- picking Calendar: five day columns ----
  show_as('cal')
  R.check('Calendar shows five day columns on a laptop', pg.page.evaluate(COLS) == 5, pg.page.evaluate(COLS))
  R.check('the address says view=cal', 'view=cal' in pg.hash(), pg.hash())
  pg.page.click('[data-hwfilter]'); pg.page.wait_for_selector('[data-pview]')
  R.check('the calendar\'s Filter sheet says A calendar is the one picked', pg.page.evaluate("document.querySelector('[data-pview=\"cal\"]').getAttribute('aria-checked')") == 'true')
  pg.page.keyboard.press('Escape'); pg.page.wait_for_timeout(300)
  mon = day_text(pg, '2026-03-16')
  R.check("Nate's Monday: the Senate HHS hearing at 1:10 PM in Room 225 with HB 1562", all(x in mon for x in ['1:10 PM', 'Senate Health and Human Services', 'Room 225', 'HB 1562']), mon[:200])
  R.check('Monday is marked Today', 'Today' in mon and pg.page.query_selector(".hc-day[data-hcday='2026-03-16'][aria-current='date']") is not None)
  # R-346 finding D: one shape for every entry, the time then the kind ("1:00 PM Testimony due"), the job as the entry's link
  R.check('a testimony due entry, with its state', bool(pg.page.query_selector('.hc-due')) and re.search(r'\d{1,2}:\d{2} [AP]M\s*Testimony due', pg.text('.hc-cal')) is not None and re.search(r'Writing|With an approver|Second look|Ready to file', pg.text('.hc-cal')) is not None)
  R.check('the hearing block opens the sitting', bool(pg.page.query_selector(".hc-day[data-hcday='2026-03-16'] .hc-h a.hc-job[href^='#/hearing/']")))
  R.check('every entry has one shape: time, kind, job (R-346 D)', pg.page.evaluate("[...document.querySelectorAll('.hc-cal .hc-e')].every(e => e.querySelector('.hc-t') && e.querySelector('.hc-ek') && e.querySelector('a.hc-job'))"))
  # R-352 (H, A-18 on v6): the issue line is its whole name in words, no icon; a cell's bill leads with its name, number small
  R.check('each bill on an entry says its issue: its whole name, no icon (R-346 D, E; R-352)', pg.page.evaluate("[...document.querySelectorAll('.hc-cal .hc-iss')].length > 0 && [...document.querySelectorAll('.hc-cal .hc-iss')].every(c => !c.querySelector('svg') && c.textContent.trim() && !/…$/.test(c.textContent.trim()))"))
  R.check('a cell\'s bill leads with its name, its number small after it (R-352)', pg.page.evaluate("[...document.querySelectorAll('.hc-cal .hc-bills li')].length > 0 && [...document.querySelectorAll('.hc-cal .hc-bills li')].every(li => { const a = li.querySelector('a.hc-bl'), n = li.querySelector('.hc-bnum'); return a && n && !/^[HS][BRC]+ \\d/.test(a.textContent.trim()) && a.compareDocumentPosition(n) & 4; })"))
  R.check('no link inside a link', pg.page.evaluate("document.querySelectorAll('a a').length") == 0)
  thu = day_text(pg, '2026-03-19')
  R.check('Capitol deadline Triple filing on Thu 3/19', 'Triple filing' in thu, thu[:120])
  R.check('a follow-up to-do in the week', 'Follow up with' in pg.text('.hc-cal'))
  R.check('nothing runs off the side at 1440', overflow(pg) <= 0, overflow(pg))
  # ---- the colour of time (A-5 on v6, R-352): due today plain, never amber; red only for an overdue step ----
  R.check('due today is not amber in the calendar', pg.page.evaluate("[...document.querySelectorAll('.hc-st.today')].every(e => !/149, 90, 0/.test(getComputedStyle(e).color))"))   # late's amber, #955A00
  # ---- one issue's hearings: the picker narrows the week and says so in the address ----
  nh = pg.page.evaluate("document.querySelectorAll('.hc-cal .hc-h').length")
  pg.page.click('[data-hwfilter]'); pg.page.wait_for_selector('[data-pv]:not([data-pv="all"])')
  pick = pg.page.query_selector('[data-pv]:not([data-pv="all"])'); name = ' '.join(pick.inner_text().split()); pick.click(); pg.ready()
  R.check('picking an issue puts it in the address', 'issue=' in pg.hash() and 'view=cal' in pg.hash(), pg.hash())
  R.check('the page says the issue picked, beside Filter', name in pg.text('.hw-bar .hw-filt'), (name, pg.text('.hw-bar .hw-filt')))
  R.check('one issue shows no more hearings than all of them', pg.page.evaluate("document.querySelectorAll('.hc-cal .hc-h').length") <= nh)
  pg.page.click('[data-hwfilter]'); pg.page.wait_for_selector('[data-pv="all"]'); pg.page.click('[data-pv="all"]'); pg.ready()
  R.check('All issues again clears it', 'issue=' not in pg.hash() and pg.page.evaluate("document.querySelectorAll('.hc-cal .hc-h').length") == nh, pg.hash())
  # ---- remembered after a reload, with no view in the address ----
  pg.page.goto(pg.url('/hearings/week')); pg.page.wait_for_timeout(500); pg.ready()
  R.check('the pick is remembered after a reload', bool(pg.page.query_selector('.hc-cal')))
  # ---- next week's arrow keeps the calendar ----
  pg.page.click('[data-hweek="1"]'); pg.ready()
  R.check('Next week arrow works in the calendar', 'Next week' in pg.text('.hw-nav') and bool(pg.page.query_selector(".hc-day[data-hcday='2026-03-23']")), pg.hash())
  # ---- back to List, remembered too ----
  show_as('list')
  R.check('List can be picked again', not pg.page.query_selector('.hc-cal'))
  R.check('no page errors (Nate, laptop)', not pg.errors, pg.errors[:2]); pg.close()

  # ---- the address alone opens it; Lauren's TRN hearing ----
  pg = B.page('LR', 1280, 800); pg.open(CAL)
  tue = day_text(pg, '2026-03-17')
  R.check("?view=cal opens the calendar (Lauren)", bool(pg.page.query_selector('.hc-cal')))
  R.check("Lauren's Tuesday: SB 3234, Transportation 9:30 AM, Room 430", all(x in tue for x in ['9:30 AM', 'SB 3234', 'Room 430']), tue[:200])
  R.check('nothing runs off the side at 1280', overflow(pg) <= 0, overflow(pg))
  R.check('no page errors (Lauren)', not pg.errors, pg.errors[:2]); pg.close()

  # ---- old calendar addresses' words (Today's who=, day=), as app.js sends them here ----
  pg = B.page('NT', 390, 844); pg.open(CAL + '&who=team&day=2026-03-19')
  R.check('who=team opens the team\'s week', pg.page.get_attribute('[data-seg="hscope"][data-val="team"]', 'aria-pressed') == 'true')
  R.check('day= opens that day on a phone', pg.page.get_attribute('[data-hcpick="2026-03-19"]', 'aria-pressed') == 'true' and 'Triple filing' in pg.text('.hc-day.on'))
  R.check('no page errors (old address)', not pg.errors, pg.errors[:2]); pg.close()

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
