# Staff v6: how much is on each screen, for each person (R-336 V06, spec section 8). Every route of the spec's map (3.3) as
# Nate, Kevin, Kris, Jess, Saya, Lauren, Patti and Julie (Rick, May Rose, James and Patrick on Today and Bills), at
# 1280x800, 1440x900, 1024x768, 390x844 and 320x640, on the busiest practice day (Mon 16 Mar 2026) plus the prep day
# (&season=off&day=2026-11-05) and the opening weeks (&season=opening) for each place's front page. It counts instances,
# not kinds: controls in the work column (first screen and whole page), filled buttons, labelled buttons, words, Capitol
# codes (HD1/SD2, committee codes, P1), facts and buttons per row, text colours, bordered elements, the share of text at
# 14px or under and in bold, amber and red marks (and those with no word beside them), page height in screens, distinct
# corner radii and the sidebar's rows. The old budget test (staff5_budget.py) passed 48 of 48 while the pages overwhelmed,
# because it counted kinds on Nate's first screen only (X9).
#
#   APP=staff6 python3 tests/staff6_budget.py      prints a table; exits 1 when v6 misses a spec 8 target
#   APP=staff5 python3 tests/staff6_budget.py      measures v5 (the baseline): prints only, saves tests/staff6_baseline_v5.json
#   V4_ROOT=/path/to/worktree ...                  serves that folder straight into the browser (otherwise HOST, :8832)
#   --quick (1440 and 390, the busy day, NT KV PH)   --who NT,KV  --sizes 1440x900,390x844  --clocks busy,off  --routes today,bills
#   --workers 6   --table (every row)   --json out.json (every row's numbers)   --shots DIR (a first-screen picture per row)
#
# READING THE TABLE IN THE LOG. One line per screen and window size; each number is the most that any person or practice
# day reached there ("-": not measured on that screen). "First screen" is what shows before any scrolling.
#   screen  the place (the spec's map, 3.3): today, bills, a-bill (one bill's page), t-approve (Testimony › To approve)...
#   size    the window, wide x tall, in CSS pixels (1440x900 a laptop, 390x844 a phone)
#   n       how many people and days were measured for this line
#   ctl     things to press or type in (links, buttons, boxes, tabs) in the work column on the first screen, each one counted
#   page    the same over the whole page, scrolled to the end
#   fill    filled (solid teal) buttons on the first screen: at most one, for the step the person takes now
#   btns    buttons with words on them in view (icon-only buttons are not counted)
#   words   words in the work column on the first screen;  wpage: on the whole page
#   codes   Capitol codes in view (HD1, SD2, committee codes such as HHS, P1);  rowc: those inside list rows (always 0)
#   facts   the most facts on any one row (the pieces between dots or on their own lines): 4 at most
#   r/btn   the most buttons on any one row: 1 at most (D16)
#   col     text colours in view, status colours apart: 5 at most;  stat: the status colours shown (done, late, missed)
#   bord    things with a drawn border line in the window: 8 at most;  rad: different corner roundings: 3 at most
#   <=14    the share of the text, in %, at 14px or smaller: 30 at most
#   bold    the share of the text, in %, in bold, leaving out the page title, section headings, the filled button and the
#           open page tab: 25 at most
#   marks   amber or red marks in the window (none on a day when nothing is late);  bare: those with no word such as
#           "late" or "missed" beside them (always 0: never colour alone)
#   scr     the page's height in screens (1 = it fits the window)
#   net     Today only: its height in screens without the person's own rows (spec 13): 1.2 on a laptop, 2 on a phone
#   above   things to press or type in that sit above the first list item or card in the work column (R-356 round 3, Nate 31 Oct:
#           the page's tabs, then at most one row of controls, then the first item). Counted as ctl is (links, buttons, boxes),
#           the page's tabs and a switch counted by the rule below; the sidebar and the header's search box are not the work column.
#           Measured on today, hearings, get-hearings, testimony, my-issues, bills, outreach and team: 5 at most on a laptop
#           (1024 or wider), 3 on a phone (under 768). "-": no list item or card on that screen to count above.
#           The plan's rule, not a raw count: the place's tab rows (sectionNav, and Bills' sub-tab row) are not counted, and a
#           segmented switch (Mine | Team, Deadlines | Status | Topics | Spreadsheet, Rows | Spreadsheet) is ONE control.
#   ctl-n   Today only: first-screen controls without the person's own rows: 12 at most
#   grp     section headings on the page ("Your next step" aside): Today 4 at most
#   side    rows in the sidebar, shown from 768px wide: 7 for staff (5 places, More, You), up to 12 for leads (Team, People, Partners, Session setup)
# Below the table: the headline numbers, Staff v5's beside them (v5 -> v6), then each spec 8 target missed with its worst
# screens. The run fails (exit 1) when any target is missed or a screen could not be measured.
import json, os, re, sys, time
from concurrent.futures import ProcessPoolExecutor
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import staff6_lib as L

H1562 = '/bill/HB1562'
# key, v6 address, v5 address (None: v5 had no such place), who sees it (None: everyone), front page of a place (also
# measured on the prep day and in the opening weeks)
ROUTES = [
  ('today', '/', '/', None, True),
  ('hearings', '/hearings', '/?view=week', None, True),
  ('get-hearings', '/hearings/ask', '/legislators?view=holding', None, True),
  ('a-hearing', '/hearing/' + L.TRN_TUE, '/hearing/' + L.TRN_TUE, None, False),
  ('testimony', '/testimony', '/review', None, True),
  ('t-write', '/testimony?view=write', None, None, False),
  ('t-approve', '/testimony?view=approve', '/review', None, False),
  ('t-sent', '/testimony?view=sent', None, None, False),
  ('t-file', '/testimony?view=file', None, None, False),
  ('t-filed', '/testimony?view=filed', None, None, False),
  ('review', '/review', '/review', None, False),
  ('outreach', '/outreach', '/outreach', None, True),
  ('partner-update', '/outreach/partners', '/outreach/partners', None, False),
  ('emails', '/outreach/emails', '/outreach/emails', None, False),
  ('supporters', '/outreach/supporters', '/outreach/supporters', None, False),
  ('lists', '/outreach/lists', '/outreach/lists', None, False),
  ('a-supporter', '/person/' + L.SUPPORTER, '/person/' + L.SUPPORTER, None, False),
  ('composer', '/email/new', '/email/new', None, False),
  ('a-list', '/list/' + L.LIST, '/list/' + L.LIST, None, False),
  ('bills', '/issues/bills', '/bills', None, True),   # a tab of Issues since R-356 round 2 (decision 3)
  ('sort-new-bills', '/issues/bills/new', '/bills/new', None, False),
  ('muted', '/issues/bills/muted', '/bills/muted', None, False),
  ('a-bill', H1562, H1562, None, False),
  ('team-talk', H1562 + '/talk', H1562 + '/activity', None, False),
  ('bill-public', H1562 + '/public', H1562 + '/public', None, False),
  ('legislators', '/legislators', '/legislators', None, True),
  ('a-legislator', f'/legislator/{L.LEGISLATOR}', f'/legislator/{L.LEGISLATOR}', None, False),
  ('my-issues', '/issues', '/my-issues', None, True),
  ('coalitions', '/issues/coalitions', None, None, False),
  ('all-issues', '/issues/all', '/outreach/issues', None, False),
  ('an-issue', '/issue/' + L.ISSUE, '/issue/' + L.ISSUE, None, False),
  ('a-coalition', '/coalition/' + L.HEAL, '/coalition/' + L.HEAL, None, False),
  ('inbox', '/inbox', '/inbox', None, True),
  ('updates', '/inbox?view=updates', None, None, False),
  ('help', '/help', '/help', None, False),
  ('help-topic', '/help/file', '/help/file', None, False),
  ('what-moved', '/help/moved', None, None, False),
  ('team', '/team', '/?scope=team', L.LEADS, True),
  ('people', '/people', '/setup/team', L.ADMINS, False),
  ('partners', '/partners', '/partners', {'NT', 'JS'}, False),   # admins and partner approvers (R-328 B: Nate and Jess)
  ('setup', '/setup', '/setup', L.ADMINS, False),
  ('more-tools', '/tools', None, None, False),
  ('my-settings', '/me', '/me', None, False),
  ('search', '/search?q=tobacco', '/search?q=tobacco', None, False),
  ('more', '/more', None, None, False),          # the phone's More page (D2)
]
BY = {r[0]: r for r in ROUTES}
# Controls above the first item (R-356 round 3). The first item is the first row or card of the work column: the lib's row
# selector plus the cards (hearing, step, to-do). Everything pressable that starts above its top edge is counted once.
ABOVE_KEYS = {'today', 'hearings', 'get-hearings', 'testimony', 'my-issues', 'bills', 'outreach', 'team'}
ABOVE = r"""() => { const main = document.querySelector('main'); if (!main) return null;
  const vis = e => { const s = getComputedStyle(e); if (s.visibility === 'hidden' || s.display === 'none' || +s.opacity === 0) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const ok = e => vis(e) && !e.closest('.sr, .band, dialog, [hidden]') && !e.closest('details:not([open]) > :not(summary)');
  const ROW = '.row, .td-row, li, tr, article, [data-row], .sv-billrow, .v6-row, [role=row], [role=listitem], [class$="row"], [class*="row "], .v6-hcard, .hw-slot, .v6-step, .t6-card, .t6-step, .mi-card, .hg-chair, .i6-card, .ot-card';
  let rows = [...main.querySelectorAll(ROW)].filter(e => ok(e) && e.getBoundingClientRect().height >= 24 && e.getBoundingClientRect().width >= 200
    && !e.closest('nav, [role=tablist], [role=menu], .sv-secnav, .hw-nav, .hw-bar') && !e.querySelector('h1, nav, [role=tablist]'));
  if (!rows.length) return null;
  const y = Math.min(...rows.map(e => e.getBoundingClientRect().top + scrollY));
  const CTRL = 'a[href], button, input:not([type=hidden]), select, textarea, summary, [role=button], [role=tab], [role=switch], [role=checkbox], [tabindex="0"]';
  let c = [...main.querySelectorAll(CTRL)].filter(e => !e.disabled && ok(e) && e.getBoundingClientRect().top + scrollY < y - 1);
  c = c.filter(e => !c.some(o => o !== e && o.contains(e) && o.matches('a[href], button')));
  c = c.filter(e => !e.closest('.sv-secnav, .bl-subtabs, [role=tablist]'));   // the place's tabs are not controls here
  const segs = new Set(); c = c.filter(e => { const g = e.closest('.sv-seg'); if (!g) return true; if (segs.has(g)) return false; segs.add(g); return true; });   // a switch is one control
  return c.length; }"""

METRICS = ['above', 'controls', 'controls_page', 'filled', 'labelled_buttons', 'words', 'words_page', 'codes', 'row_codes', 'facts_max',
           'rows_over4', 'row_buttons_max', 'colors', 'bordered', 'radii', 'small_pct', 'px13_pct', 'bold_pct', 'marks',
           'marks_unworded', 'screens', 'groups', 'side_rows', 'hscroll', 'filter_controls', 'setup_parts', 'setup_part_screens',
           'colors_status', 'colors_all', 'bold_all_pct', 'controls_net', 'screens_net', 'own_step']

# Today's own rows (spec 13, R-274): every row of the person's own work is shown, even past the length target, so Today's
# screens and first-screen controls are held to the targets net of them: the Do today, Coming up and Partner words groups
# (.t6-group, with the "N more later" line), and a hearing card's row for the viewer's own step (the only card rows with a
# button, spec 12.2). What is left, the next-step card, tiles, doors and season card, is held to 1.2 laptop and 2 phone
# screens and 12 controls.
OWN_ROWS = '.t6-group, .t6-later, .v6-hcard-bill:has(.btn, button)'
NET_SCREENS = r"""(sel) => { const main = document.querySelector('main'); if (!main) return null;
  const els = [...main.querySelectorAll(sel)].filter(e => !e.parentElement.closest(sel)), was = els.map(e => e.style.display);
  els.forEach(e => { e.style.display = 'none'; });
  const v = Math.round(100 * document.documentElement.scrollHeight / innerHeight) / 100;
  els.forEach((e, i) => { e.style.display = was[i]; });
  return v; }"""

# Does this person have a step of their own on Today? Read as a person reads it: the "Your next step" heading is shown.
# A helper's all-clear Today ("Nothing needs you today", Julie) has none, and the helper's door ("Rick has 3 hearing asks ·
# Offer to help") is never filled (spec 13), so that Today may have no filled button at all.
OWN_STEP = r"""() => [...document.querySelectorAll('main h2, main [role=heading]')].some(h => h.getClientRects().length && /^\s*Your next step\b/i.test(h.innerText || ''))"""

def plan(args):
  """The jobs: one tab per (person, size, clock), each walking its routes in turn."""
  who = args.get('who') or (['NT', 'KV', 'PH'] if args.get('quick') else L.PEOPLE)
  sizes = args.get('sizes') or ([(1440, 900), (390, 844)] if args.get('quick') else L.SIZES)
  clocks = args.get('clocks') or (['busy'] if args.get('quick') else list(L.CLOCKS))
  only = set(args.get('routes') or [])
  jobs = []
  people = list(who) + ([] if args.get('quick') or args.get('who') else L.MORE_PEOPLE)
  for p in people:
    for (w, h) in sizes:
      for c in clocks:
        keys = []
        for key, r6, r5, gate, front in ROUTES:
          if only and key not in only: continue
          if p in L.MORE_PEOPLE and key not in ('today', 'bills'): continue
          if gate and p not in gate: continue
          if c != 'busy' and not front: continue
          if key == 'more' and not L.PHONE(w): continue
          if L.V5 and r5 is None: continue
          keys.append(key)
        if keys: jobs.append((p, w, h, c, keys))
  return jobs

_B = None
def _init():
  global _B, _PW
  from playwright.sync_api import sync_playwright
  _PW = sync_playwright().start(); _B = L.Browser(_PW)
def _restart():
  """A fresh browser for this worker, after its browser died (a busy machine can lose one mid-run)."""
  global _B
  try: _B.close()
  except Exception: pass
  _B = L.Browser(_PW)

def special(pg, key, m):
  """Two counts that need a press: the supporters filter's choices (V31), and Session setup's parts and their length (V28)."""
  if key == 'supporters' and not pg.mobile:
    b = L.find(pg.page, re.compile(r'^\s*(More )?filters?\b', re.I), roles=('button',))
    if b:
      try:
        b.click(); pg.page.wait_for_timeout(500)
        m['filter_controls'] = pg.page.evaluate("""() => { const d = [...document.querySelectorAll('dialog[open], [role=dialog]')].filter(e => e.getClientRects().length).pop(); if (!d) return null;
          return [...d.querySelectorAll('a[href], button, input:not([type=hidden]), select, textarea, summary, [role=button], [role=checkbox], [role=switch]')].filter(e => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden' && !e.closest('details:not([open]) > :not(summary)')).length; }""")
        pg.page.keyboard.press('Escape'); pg.page.wait_for_timeout(300)
      except Exception as e: m['filter_controls'] = None
  if key == 'setup' and not pg.mobile:
    parts = pg.page.evaluate("""() => [...new Set([...document.querySelectorAll('main a[href^="#/setup/"]')].filter(a => a.getClientRects().length).map(a => a.getAttribute('href').split('?')[0]))]""")
    m['setup_parts'] = len(parts); worst = 0
    for href in parts[:20]:
      pg.nav(href[1:]); worst = max(worst, pg.page.evaluate('document.documentElement.scrollHeight / innerHeight'))
    m['setup_part_screens'] = round(worst, 2); pg.nav('/setup')

def run_job(job):
  """One tab's routes; tried twice (a browser lost mid-run is restarted), then reported as not measured."""
  for attempt in (1, 2):
    try: return _run_job(job)
    except Exception as e:
      err = f'{type(e).__name__}: {str(e).splitlines()[0][:120]}'
      try: _restart()
      except Exception: pass
  p, w, h, clock, keys = job
  return [{'who': p, 'w': w, 'h': h, 'clock': clock, 'route': '-', 'failed': err, 'keys': keys}], 0

def _run_job(job):
  p, w, h, clock, keys = job
  out = []; t0 = time.time()
  pg = _B.page(p, w, h)
  try:
    first = True
    for key in keys:
      route = BY[key][2] if L.V5 else BY[key][1]
      if first: pg.open(route, L.CLOCKS[clock]); first = False
      else: pg.nav(route)
      errs0 = len(pg.errors)
      m = pg.measure(own=OWN_ROWS if key == 'today' else None); mf = pg.measure(full=True)
      row = {k: m.get(k) for k in METRICS if k in m}
      row.update(controls_page=mf['controls'], words_page=mf['words'], groups=mf['groups'], codes_page=mf['codes'])
      if key == 'today' and not L.V5:
        row.update(controls_net=m['controls'] - m['controls_own'], screens_net=pg.page.evaluate(NET_SCREENS, OWN_ROWS),
                   own_step=pg.page.evaluate(OWN_STEP))
      if key in ABOVE_KEYS and not L.V5: row['above'] = pg.page.evaluate(ABOVE)
      special(pg, key, row)
      row.update(h1=m['h1'], tabs=m['tabs'], worst_row=m['worst_row'], marks_list=m['marks_list'], labelled_list=m['labelled_list'][:12],
                 colors_list=m.get('colors_list'), colors_status_list=m.get('colors_status_list'), radii_where=m.get('radii_where'),
                 errors=pg.errors[errs0:][:2], hash=pg.hash())
      if SHOTS: pg.shot(os.path.join(SHOTS, f'{L.APP}-{p}-{w}x{h}-{clock}-{key}.png'))
      out.append({'who': p, 'w': w, 'h': h, 'clock': clock, 'route': key, 'm': row})
  finally:
    pg.close()
  return out, round(time.time() - t0, 1)

SHOTS = os.environ.get('BUDGET_SHOTS', '')

# ---- the targets (spec 8; V-numbers from assessment.md) ----
LAPTOP = lambda r: r['w'] >= 1024
def targets(r):
  """Every spec 8 target this row is held to: (name, value, limit, ok)."""
  m, key, who, t = r['m'], r['route'], r['who'], []
  def T(name, v, lim, ok=None):
    if v is None: return
    t.append((name, v, lim, (v <= lim) if ok is None else ok))
  # Today's length (spec 13: R-274 wins over the target): each person's own rows are all shown, each with its one button, so
  # screens and first-screen controls are measured net of them (OWN_ROWS) and only the rest is held to the target. Nate's
  # Today is his own rows, so his screens, words and first-screen controls are not held to it; his whole page stays within
  # 30 controls like everyone's.
  own_today = who == 'NT'
  if key == 'today' and LAPTOP(r):
    T('Today laptop: controls on the whole page', m['controls_page'], 30)
    if not own_today:
      T('Today laptop: words on the whole page', m['words_page'], 250)
      T('Today laptop: screens, net of the person\'s own rows (spec 13)', m.get('screens_net', m['screens']), 1.2)
      T('Today laptop: controls in the work column\'s first screen, net of own rows (spec 13)', m.get('controls_net', m['controls']), 12)
    T('Today laptop: groups', m['groups'], 4)
    # spec 8's "1 filled button": at most one, and exactly one, the next step's, when the person has a step of their own
    own = m.get('own_step')
    if own is not None: T('Today laptop: at most 1 filled button, exactly 1 when the person has a step of their own', m['filled'], 1, m['filled'] == 1 if own else m['filled'] <= 1)
  if key == 'today' and not LAPTOP(r) and r['w'] < 768:
    if not own_today: T('Today phone: screens, net of the person\'s own rows (spec 13)', m.get('screens_net', m['screens']), 2)
    T('Today phone: controls on the whole page', m['controls_page'], 30)
  if key == 'today' and who == 'PH': T("Patti's Today: labelled buttons in view", m['labelled_buttons'], 4)
  if key in ABOVE_KEYS and not L.V5:
    if LAPTOP(r): T('controls above the first item (page tabs included): laptop', m.get('above'), 5)
    elif r['w'] < 768: T('controls above the first item (page tabs included): phone', m.get('above'), 3)
  if key == 'bills' and LAPTOP(r): T('Bills first laptop screen: controls', m['controls'], 25)
  if key == 'bills': T('Bills: codes in rows', m['row_codes'], 0)
  if key == 'legislators' and LAPTOP(r):
    T('Legislators first screen: controls', m['controls'], 25); T('Legislators first screen: words', m['words'], 180)
  if key == 'supporters' and LAPTOP(r):
    T('Supporters first screen: controls', m['controls'], 25); T('Supporters: filter choices shown', m.get('filter_controls'), 15)
  if key == 'setup' and LAPTOP(r):
    T('Session setup: groups', m.get('setup_parts'), 5, m.get('setup_parts') == 5); T('Session setup: longest part (screens)', m.get('setup_part_screens'), 1.5)
  # every screen
  T('facts per row (most)', m['facts_max'], 4)
  T('buttons per row (most, D16)', m['row_buttons_max'], 1)
  T('codes in rows (D15)', m['row_codes'], 0)
  T('text at 14px or under (%)', m['small_pct'], 30)
  T('bold text (%, beyond spec 12.1\'s title, section headings, filled button and open tab)', m['bold_pct'], 25)
  T('bordered elements on the first screen', m['bordered'], 8)
  T('distinct corner radii', m['radii'], 3)
  T('text colours in view (status colours apart, spec 13)', m['colors'], 5)
  T('filled buttons in the first screen (rule 1)', m['filled'], 1)
  T('amber/red marks with no word beside them (D3)', m['marks_unworded'], 0)
  if r['clock'] == 'off': T('amber/red marks on a day when nothing is late', m['marks'], 0)
  T('sideways scroll (rule 10)', int(bool(m['hscroll'])), 0)
  if r['w'] >= 768:   # the sidebar is always shown from 768px, every place labelled (3.1), and stays short
    lim = 12 if who in L.TEAM_SEERS else 8   # staff 8 (6 places, More, You); a lead or Sees Team 9 (Team); an admin 12 (People, Partners, Session setup)
    T('sidebar rows (always shown from 768px, 7 or more: Today, Testimony, Hearings, Issues, Outreach, More, You)', m['side_rows'], lim, 7 <= m['side_rows'] <= lim)
  else: T('phone tab bar: Today · Hearings · Testimony · Issues · More (D2)', ' · '.join(m['tabs']) or 'none', 'Today · Hearings · Testimony · Issues · More',
          [x.lower() for x in m['tabs']] == ['today', 'hearings', 'testimony', 'issues', 'more'])
  if m.get('errors'): T('page errors', len(m['errors']), 0)
  return t

def args_of(argv):
  a = {'quick': '--quick' in argv, 'table': '--table' in argv}
  def val(flag):
    return argv[argv.index(flag) + 1] if flag in argv and argv.index(flag) + 1 < len(argv) else None
  if val('--who'): a['who'] = val('--who').split(',')
  if val('--sizes'): a['sizes'] = [tuple(int(x) for x in s.split('x')) for s in val('--sizes').split(',')]
  if val('--clocks'): a['clocks'] = val('--clocks').split(',')
  if val('--routes'): a['routes'] = val('--routes').split(',')
  a['workers'] = int(val('--workers') or max(1, min(6, (os.cpu_count() or 4) - 2)))
  a['json'] = val('--json'); return a

def fmt(v):
  if v is None: return '-'
  if isinstance(v, bool): return 'yes' if v else 'no'
  if isinstance(v, float): return f'{v:g}'
  return str(v)

def main():
  a = args_of(sys.argv[1:]); jobs = plan(a); rows = []; failed = []; t0 = time.time()
  print(f'{L.APP}: {len(jobs)} tabs, {sum(len(j[4]) for j in jobs)} screens, {a["workers"]} at once ({"served from " + L.ROOT if L.ROOT else L.HOST})', flush=True)
  with ProcessPoolExecutor(max_workers=a['workers'], initializer=_init) as ex:
    for i, (out, secs) in enumerate(ex.map(run_job, jobs), 1):
      failed += [r for r in out if r.get('failed')]; rows += [r for r in out if not r.get('failed')]
      if i % 10 == 0 or i == len(jobs): print(f'  {i}/{len(jobs)} tabs done ({round(time.time() - t0)} s)', flush=True)
  rows.sort(key=lambda r: ([x[0] for x in ROUTES].index(r['route']), r['w'], r['clock'], r['who']))
  if a['json']: json.dump(rows, open(a['json'], 'w'), indent=0)

  # ---- the table: per screen and window size, the most any person or clock reached ----
  cols = [('above', 'above'), ('ctl', 'controls'), ('page', 'controls_page'), ('fill', 'filled'), ('btns', 'labelled_buttons'), ('words', 'words'),
          ('wpage', 'words_page'), ('codes', 'codes'), ('rowc', 'row_codes'), ('facts', 'facts_max'), ('r/btn', 'row_buttons_max'),
          ('col', 'colors'), ('stat', 'colors_status'), ('bord', 'bordered'), ('rad', 'radii'), ('<=14', 'small_pct'), ('bold', 'bold_pct'), ('marks', 'marks'),
          ('bare', 'marks_unworded'), ('scr', 'screens'), ('net', 'screens_net'), ('ctl-n', 'controls_net'), ('grp', 'groups'), ('side', 'side_rows')]
  print(f"\n{'screen':15} {'size':9} {'n':>3} " + ' '.join(f'{c:>5}' for c, _ in cols) + '   (the most over people and clocks)')
  groups = {}
  for r in rows: groups.setdefault((r['route'], f"{r['w']}x{r['h']}"), []).append(r)
  for (route, size), rs in groups.items():
    def mx(k):
      vs = [r['m'].get(k) for r in rs if isinstance(r['m'].get(k), (int, float))]
      return max(vs) if vs else None
    print(f"{route:15} {size:9} {len(rs):>3} " + ' '.join(f'{fmt(mx(k)):>5}' for _, k in cols))
  if a['table']:
    print(f"\n{'who':4} {'size':9} {'clock':7} {'screen':15} " + ' '.join(f'{c:>5}' for c, _ in cols))
    for r in rows: print(f"{r['who']:4} {r['w']}x{r['h']:<4} {r['clock']:7} {r['route']:15} " + ' '.join(f"{fmt(r['m'].get(k)):>5}" for _, k in cols))

  # ---- the headline numbers (the assessment's targets) ----
  def pick(route, who, w, clock='busy'):
    return next((r['m'] for r in rows if r['route'] == route and r['who'] == who and r['w'] == w and r['clock'] == clock), None)
  heads = [("Nate's laptop Today, whole page: controls / words / screens / groups", 'today', 'NT', 1440, ['controls_page', 'words_page', 'screens', 'groups']),
           ("Today first laptop screen, controls in the work column: Nate / Kevin / Patti / Kris / Jess", None, None, 1440, None),
           ("Nate's phone Today: screens / controls (390)", 'today', 'NT', 390, ['screens', 'controls_page']),
           ("Nate's phone Today at 320: screens", 'today', 'NT', 320, ['screens']),
           ("Patti's Today: labelled buttons in view", 'today', 'PH', 1440, ['labelled_buttons']),
           ("Bills first laptop screen, Kris: controls / codes / codes in rows", 'bills', 'KR', 1440, ['controls', 'codes', 'row_codes']),
           ("Bills first laptop screen, Nate: controls / codes", 'bills', 'NT', 1440, ['controls', 'codes']),
           ("Legislators first screen: controls / words / codes", 'legislators', 'KV', 1440, ['controls', 'words', 'codes']),
           ("Supporters first screen (Saya): controls / filter choices", 'supporters', 'SY', 1440, ['controls', 'filter_controls']),
           ("Session setup: parts / longest part in screens", 'setup', 'NT', 1440, ['setup_parts', 'setup_part_screens'])]
  print('\nheadline (busy day, 1440 unless said):')
  headline = {}
  for label, route, who, w, ks in heads:
    if route is None:
      vals = [(pick('today', p, w) or {}).get('controls') for p in ['NT', 'KV', 'PH', 'KR', 'JS']]
    else:
      m = pick(route, who, w); vals = [m.get(k) if m else None for k in ks]
    headline[label] = vals; print(f'  {label}: ' + ' / '.join(fmt(v) for v in vals))

  if L.V5:
    L.save_baseline('budget', {'metrics': METRICS, 'headline': headline,
      'rows': {f"{r['who']}|{r['w']}x{r['h']}|{r['clock']}|{r['route']}": [r['m'].get(k) for k in METRICS] for r in rows}})
    print(f'\nv5 baseline saved to {os.path.relpath(L.BASELINE)} ({len(rows)} screens). Staff v5 is the before; it is not held to v6 targets.')
    sys.exit(0)

  # ---- v6: every target, with v5 beside it ----
  base = L.load_baseline().get('budget', {}); bm = base.get('metrics', METRICS); brow = base.get('rows', {})
  v5_of = lambda r, k: (lambda v: v[bm.index(k)] if v and k in bm else None)(brow.get(f"{r['who']}|{r['w']}x{r['h']}|{r['clock']}|{r['route']}"))
  missed = {}
  for r in rows:
    for name, v, lim, ok in targets(r):
      if not ok: missed.setdefault(name, []).append((r, v, lim))
  if base.get('headline'):
    print('\nv5 -> v6:')
    for label, vals in headline.items():
      print(f'  {label}: ' + ' / '.join(fmt(v) for v in base['headline'].get(label, [])) + ' -> ' + ' / '.join(fmt(v) for v in vals))
  print(f'\nspec 8 targets missed: {len(missed)} targets, {sum(len(v) for v in missed.values())} misses on {len({id(r) for v in missed.values() for r, _, _ in v})} of {len(rows)} screens')
  for name, hits in sorted(missed.items(), key=lambda x: -len(x[1])):
    worst = sorted(hits, key=lambda x: -(x[1] if isinstance(x[1], (int, float)) else 0))[:4]
    ex = '; '.join(f"{r['route']} {r['who']} {r['w']}x{r['h']} {r['clock']} = {fmt(v)}" for r, v, lim in worst)
    print(f'  {name} (limit {fmt(hits[0][2])}): {len(hits)} screens, e.g. {ex}')
  stats = [(r, x) for r in rows for x in [r['m'].get('errors')] if x]
  for r, x in stats[:8]: print(f"  page error on {r['route']} as {r['who']} {r['w']}x{r['h']}: {x[0][:140]}")
  for f in failed: print(f"  NOT MEASURED: {f['who']} {f['w']}x{f['h']} {f['clock']} ({', '.join(f['keys'][:6])}{' …' if len(f['keys']) > 6 else ''}): {f['failed']}")
  print(f'\n{len(rows)} screens measured in {round(time.time() - t0)} s' + (f'; {len(failed)} tabs could not be measured' if failed else ''))
  sys.exit(1 if missed or failed else 0)

if __name__ == '__main__':
  main()
