# Staff v6: the steps each job takes, counted as a person would take them (R-336 V06, spec section 8). Each journey is a
# click path that finds its controls by their visible words and roles (the spec's words for v6, v5's own for v5), never by
# CSS classes, presses them on the practice copy and counts the clicks until the job is done (a toast or the page says
# so). v6 must be at or under the spec 8 budget and at or under v5. Typing a note or a name is not a click.
#
# A journey whose v6 screens are not built yet says so and is skipped, not failed: when a step's control is missing and
# a screen it needs is still FRAME's placeholder (staff6/hearings.js, testimonyplace.js, team.js, people.js, tools.js,
# more.js, filing.js) or still v5's markup (no v6 parts: v6-step, v6-row, v6-hcard...), the line reads
# "SKIP ... not built yet: needs X". Once those screens land, a missing control is a FAIL.
#
#   APP=staff6 python3 tests/staff6_journeys.py    exits 1 when a built journey misses its budget or v5's count
#   APP=staff5 python3 tests/staff6_journeys.py    v5's clicks for each journey (the baseline), saved to tests/staff6_baseline_v5.json
#   V4_ROOT=/path/to/worktree ...                  serves that folder straight into the browser (otherwise HOST, :8832)
#   --only approve,file                            run some journeys
import os, re, sys, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import staff6_lib as L

V5 = L.V5
rx = lambda s: re.compile(s, re.I)

class Step:
  """One click. `names` are tried in turn (regexes on the accessible name, matched from its start unless they say
  otherwise). `fill` types into the open sheet's text box first (not a click). `optional`: skipped when not there.
  `unless`: skipped when that text is already on the page (the choice is already made). `in_view`: the control must be on
  the screen as it is, with no scrolling (0 clicks to find, no scroll on a phone). `wait`: ms before the click (Approve
  waits a second before it works)."""
  def __init__(self, *names, fill=None, optional=False, unless=None, in_view=False, wait=0, roles=None, note=''):
    self.names = [n if isinstance(n, re.Pattern) else rx(r'^\s*' + n) for n in names]
    self.fill, self.optional, self.unless, self.in_view, self.wait, self.roles, self.note = fill, optional, unless, in_view, wait, roles, note
  def label(self): return '/'.join(n.pattern.replace(r'^\s*', '') for n in self.names)[:60]

class J:
  def __init__(self, key, name, who, budget, steps6, done6, steps5=None, done5=None, start='/', extra='', size=(1440, 900),
               needs=(), v5=None, v5_note='', start5=None, extra5=None):
    self.key, self.name, self.who, self.budget, self.steps6, self.done6 = key, name, who, budget, steps6, done6
    self.steps5, self.done5 = steps5, done5 or done6
    self.start, self.extra, self.size, self.needs, self.v5, self.v5_note = start, extra, size, needs, v5, v5_note
    self.start5 = start5 if start5 is not None else start; self.extra5 = extra if extra5 is None else extra5

def said(pg):
  """What the person sees after a step: the toast, the open sheet, the page."""
  return pg.page.evaluate("""() => [document.getElementById('toast')?.innerText || '', [...document.querySelectorAll('dialog[open]')].map(d => d.innerText).join(' '),
    document.querySelector('main')?.innerText || ''].join(' \\n ')""")

def v6_parts(pg):
  return pg.page.evaluate("() => document.querySelectorAll('main [class*=\"v6-\"]').length")

def unmet(pg, needs):
  """The v6 screens this journey needs that are not built yet."""
  out = []
  for n in needs:
    if n.startswith('staff6/') and L.stub(n): out.append(f'{n} is a placeholder')
    elif n.startswith('#/'):
      here = pg.hash(); pg.nav(n[1:])
      if not v6_parts(pg): out.append(f'{n} has no v6 parts yet')
      pg.nav(here[1:] if here else '/')
  return out

def walk(pg, steps, done):
  """Press each step's control; returns (clicks, ok, detail, the step that was missing or None)."""
  clicks = 0
  for i, s in enumerate(steps, 1):
    if s.unless and re.search(s.unless, pg.text('main') or '', re.I): continue
    if s.fill is not None:
      box = pg.page.locator('dialog[open] textarea, dialog[open] input[type=text], dialog[open] input:not([type]), dialog[open] input[type=search]').first
      if box.count() and box.is_visible(): box.fill(s.fill)
    el = L.find(pg.page, *s.names, **({'roles': s.roles} if s.roles else {}), in_view=s.in_view)
    if el is None:
      if s.optional: continue
      return clicks, False, f'step {i} ({s.label()}) not found' + (' on the first screen' if s.in_view else ''), s
    if s.wait: pg.page.wait_for_timeout(s.wait)
    try: el.click(timeout=5000)
    except Exception as e: return clicks, False, f'step {i} ({s.label()}) could not be pressed: {str(e).splitlines()[0][:80]}', s
    clicks += 1; pg.page.wait_for_timeout(450); pg.ready(4000)
  ok = done(pg) if callable(done) else bool(re.search(done, said(pg), re.I))
  return clicks, ok, '' if ok else f'after {clicks} clicks the job is not done (looked for {done if isinstance(done, str) else "its result"})', None

# ---- the journeys (spec 8 budgets; v5's words for the v5 path) ----
QR_SHOWN = lambda pg: pg.page.evaluate("() => !![...document.querySelectorAll('main [aria-label^=\"QR code\" i], main svg, main canvas, main img')].find(e => /qr/i.test((e.getAttribute('aria-label') || '') + (e.closest('[aria-label]')?.getAttribute('aria-label') || '') + (e.className?.baseVal ?? e.className ?? '')) && e.getClientRects().length)")
JOURNEYS = [
  J('approve', 'Approve testimony (Kris), from Today', 'KR', 2,
    [Step(r'^\s*(Review|Approve)\b', in_view=True), Step('Approve$', wait=1300)], r'Approved',
    [Step('Review$', in_view=True), Step('Approve$', wait=1300)], needs=('#/',)),
  J('send-back', 'Send testimony back with a note (Kris), from Today', 'KR', 3,
    [Step(r'^\s*(Review|Approve)\b', in_view=True), Step('Send back$'), Step(r'^\s*Send back', fill='Please add the 2024 survey numbers.')], r'Sent back',
    [Step('Review$', in_view=True), Step('Send back$'), Step(r'^\s*Send back', fill='Please add the 2024 survey numbers.')], needs=('#/',)),
  J('resubmit', 'Resubmit a sent-back draft (Patti), from Today', 'PH', 1,
    [Step('Resubmit', in_view=True)], r'for approval|resubmitted|sent to',
    [Step('Resubmit', in_view=True)], needs=('#/',)),
  J('ask-chair', 'Ask a chair for a hearing and record it (Kevin), from Today', 'KV', 2,
    [Step(r'^\s*Email the chairs?\b', in_view=True), Step('Yes, I sent it')], r'asked|Saved',
    [Step(r'^\s*Email the chairs?\b', in_view=True), Step('Yes, I sent it')], needs=('#/',)),
  # v6's practice copy seeds a chair ask with no reply for 4 days (spec 6, V33): its Follow up row is on Today. v5 had no
  # seeded ask, so its path asks first (not counted) and then records the reply from This week's deadline box.
  J('record-reply', "Record the chair's reply (Kevin), from Today", 'KV', 2,
    [Step(r'^\s*(They replied|Follow up|Record the reply|Asked by)\b'), Step(r'^\s*(Will schedule|They will schedule)')], r'will schedule',
    [Step('This week$'), Step(rx(r'bills? needs? a hearing')), Step('Asked by you'), Step('Will schedule')], needs=('#/', 'staff6/hearings.js')),
  # Kevin's HB2121 is approved and his to file on the busy day; v5 folded it under "+2 on this bill" (X22).
  J('file', 'File testimony: 0 clicks to find, at most 3 steps (Kevin), from Today', 'KV', 3,
    [Step(r'^\s*(File|File it|File at the Capitol|File testimony|Mark filed)\b', in_view=True), Step(r'^\s*Mark filed', optional=True), Step(r'^\s*(Mark filed|Yes, mark filed|Filed)\b', optional=True)],
    r'Filed\.|is done|marked filed',
    [Step(rx(r'\+\d+ on this bill'), in_view=True), Step(r'^\s*(Mark filed|File)\b'), Step('Mark filed')], needs=('#/', 'staff6/filing.js')),
  J('hearing-day-going', "Hearing day on a phone: I'm going in 1 tap (Kris, Fri 3/20)", 'KR', 1,
    [Step(r"^\s*I.m going", in_view=True)], r"Going: Kris|you.re going|You are going|You and|going",
    [Step(rx(r'^More for'), in_view=True), Step(r"^\s*I.m going")], extra=L.KRIS_DAY, size=(390, 844), needs=('#/',)),
  J('hearing-day-approve', 'Hearing day on a phone: my approval in 2 taps, no scroll (Kris, Fri 3/20)', 'KR', 2,
    [Step(r'^\s*(Review|Approve)\b', in_view=True), Step('Approve$', wait=1300, in_view=True)], r'Approved',
    [Step('Review$', in_view=True), Step('Approve$', wait=1300, in_view=True)], extra=L.KRIS_DAY, size=(390, 844), needs=('#/',)),
  J('see-slipping', 'See what is slipping (Nate), from Today', 'NT', 1,
    [Step(r'^\s*(Open Team|Team)\b', roles=('link', 'button'))], lambda pg: L.visible_text(pg.page, r'^\s*Slipping', 'main', True) is not None,
    [Step('Team$', roles=('button',))], needs=('staff6/team.js',)),
  J('turn-off', 'Turn someone off and hand over their work (Nate)', 'NT', 4,
    [Step('People$', roles=('link',)), Step('James'), Step(r'^\s*Leaving or away'), Step(r'^\s*Hand over and turn off')], r'turned off|handed|was James',
    None, needs=('staff6/people.js',), v5=13, v5_note='assessment X24: 13 clicks, 2 scrolls, 4 screens (not replayed)'),
  J('prep-issue', 'Prepare one 2027 issue (Kevin, 5 Nov)', 'KV', 8,
    [Step('My issues$', roles=('link',)), Step(rx(r'^(?!My issues).{6,}'), roles=('link',)),
     *[Step(r'^\s*(Looks right|Checked|Done|Keep|Save|Mark (it )?done)\b', optional=True) for _ in range(5)], Step(r'^\s*Mark ready')],
    r'ready|your part is done', None, extra=L.CLOCKS['off'], needs=('#/my-issues',), v5=14, v5_note='assessment X26: 14 clicks per issue (not replayed)'),
  J('sort-bill', 'Sort one new bill: pick its position and track it (Kevin, opening weeks), from Today', 'KV', 5,
    [Step(rx(r'sort new bills|new bills? to sort|^\s*Sort\b')), Step(r'^\s*(Monitor|Position|No position)\b'), Step('Support$'), Step(r'^\s*(Track|Save|Next)\b')], r'tracked|sorted',
    [Step(rx(r'sort new bills|new bills? to sort|^\s*Sort\b')), Step(r'^\s*Monitor\b'), Step('Support$'), Step('Track$')], r'tracked',
    extra=L.CLOCKS['opening'], needs=('#/bills/new',)),
  J('save-group', 'Save a group of supporters (Saya), from Supporters', 'SY', 5,
    [Step(r'^\s*(Filter|More filters)\b', unless=r'Oʻahu\s*\d'), Step(r'^\s*O.?ahu'), Step(r'^\s*(Show \d+|Done|Apply)\b', optional=True),
     Step(r'^\s*Save as a group'), Step(r'^\s*Save\b', fill='Oʻahu supporters (test)')], r'Saved',
    [Step('Filter'), Step(r'^\s*O.?ahu'), Step(r'^\s*Show \d+ people'), Step('More actions'), Step('Save as segment'), Step(r'^\s*Save segment', fill='Oʻahu supporters (test)')], r'Saved',
    start='/outreach/supporters', needs=('#/outreach/supporters',)),
  J('qr-link', 'Make a partner QR link (Saya)', 'SY', 2,
    [Step(r'^\s*More tools', roles=('link', 'button')), Step(r'^\s*Make a link')], QR_SHOWN,
    [Step('My issues$', roles=('link',)), Step('All issues'), Step(rx(r'^More')), Step(r'^\s*First visit'), Step(r'^\s*Make a link')], QR_SHOWN,
    needs=('staff6/tools.js',)),
]

# ---- doors: where Inbox, Help and each weekly place are, without opening any menu ----
WEEKLY = ['Today', 'Hearings', 'Testimony', 'Outreach', 'Bills', 'Legislators', 'My issues', 'Inbox', 'Help', 'Lists']
WEEKLY_V5 = {'Hearings': 'This week', 'Testimony': 'Review'}
PARENT = {'Lists': '/outreach'}                # a page tab one labelled tap inside a place (2 taps, in view)
PARENT_V5 = {'This week': '/', 'Team': '/', 'Lists': '/outreach'}
FRAME = """(name) => { const want = name.toLowerCase(); const main = document.querySelector('main');
  return [...document.querySelectorAll('a[href], button')].filter(e => !(main && main.contains(e)) && e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden'
    && !e.closest('dialog') && ((e.innerText || '').trim().split('\\n')[0].replace(/\\s*\\d+\\+?$/, '').trim().toLowerCase() === want || (e.getAttribute('aria-label') || '').toLowerCase().startsWith(want))).length; }"""
INMAIN = """(name) => { const want = name.toLowerCase(); return [...document.querySelectorAll('main a[href], main button, main [role=tab]')].filter(e => e.getClientRects().length
    && (e.innerText || '').trim().split('\\n')[0].replace(/\\s*\\d+\\+?$/, '').trim().toLowerCase() === want).length; }"""

def doors(b, who, w, h):
  """For each weekly place: 1 (a labelled control always in view), 2 (one labelled tap in: a page tab, or the phone's
  More page), or None (behind a menu or nowhere)."""
  pg = b.page(who, w, h); pg.open('/'); out = {}
  places = WEEKLY + (['Team'] if who in L.LEADS else [])
  more = None
  for p in places:
    name = WEEKLY_V5.get(p, p) if V5 else p
    if pg.page.evaluate(FRAME, name): out[p] = 1; continue
    par = (PARENT_V5 if V5 else PARENT).get(name)
    if par is not None:
      pg.nav(par)
      if pg.page.evaluate(INMAIN, name): out[p] = 1 if par == '/' else 2; pg.nav('/'); continue
      pg.nav('/')
    if not V5 and L.PHONE(w):
      if more is None:
        pg.nav('/more'); more = pg.page.evaluate("() => [...document.querySelectorAll('main a[href], main button')].filter(e => e.getClientRects().length).map(e => (e.innerText || '').trim().split('\\n')[0].toLowerCase())"); pg.nav('/')
      if name.lower() in more and pg.page.evaluate(FRAME, 'More'): out[p] = 2; continue
    out[p] = None
  pg.close(); return out

# ---- More tools: every rare tool listed by job, one click in (spec 3.5) ----
TOOLS = ['Holding our bills', 'Session calendar', 'Earlier testimony', 'How to file', 'Lists', r'Make a link|QR code', 'First visit numbers',
         r'Supporters.? groups', 'Sort new bills', 'Muted bills', 'Saved views', 'Bulk change', 'Export', 'Getting started', 'Practice copy',
         'What moved', 'Keyboard shortcuts', r'Someone else.s list|See as (a )?teammate']
SEARCHES = [('inbox', r'Inbox'), ('QR code', r'QR|Make a link'), ('sort new bills', r'Sort new bills'), ('responding', r'respond|landing|First visit'),
            ('approve', r'approve|Testimony'), ('arrivals', r'arriv|First visit')]

def main():
  argv = sys.argv[1:]; only = set(argv[argv.index('--only') + 1].split(',')) if '--only' in argv else None
  R = L.Results(); base = L.load_baseline().get('journeys', {}); got = {}; t0 = time.time()
  with L.browser() as b:
    print(f'{L.APP}: journeys (clicks; budget; v5)')
    for j in JOURNEYS:
      if only and j.key not in only: continue
      w, h = j.size; pg = b.page(j.who, w, h)
      if V5:
        if j.steps5 is None:
          got[j.key] = {'clicks': j.v5, 'note': j.v5_note}; print(f'v5   {j.name}: {j.v5} clicks ({j.v5_note})'); pg.close(); continue
        pg.open(j.start5, j.extra5)
        if j.key == 'record-reply':   # v5 had no seeded ask: ask first (not counted), then record the reply
          walk(pg, [Step(r'^\s*Email the chairs?\b'), Step('Yes, I sent it')], r'asked'); pg.nav('/')
        clicks, ok, detail, miss = walk(pg, j.steps5, j.done5)
        got[j.key] = {'clicks': clicks if ok else None, 'note': detail}
        R.check(f'{j.name}: {clicks} clicks in v5 (v6 budget {j.budget})', ok, detail)
        pg.close(); continue
      pg.open(j.start, j.extra)
      clicks, ok, detail, miss = walk(pg, j.steps6, j.done6)
      v5c = (base.get(j.key) or {}).get('clicks', j.v5)
      if not ok:
        nb = unmet(pg, j.needs)
        R.check(f'{j.name}', False, detail, skip=('not built yet: ' + '; '.join(nb) + f' ({detail})') if nb else None)
      else:
        within = clicks <= j.budget and (v5c is None or clicks <= v5c)
        R.check(f'{j.name}: {clicks} clicks (budget {j.budget}, v5 {v5c if v5c is not None else "-"})', within,
                '' if within else (f'over the budget of {j.budget}' if clicks > j.budget else f'more than v5\'s {v5c}'))
      got[j.key] = {'clicks': clicks if ok else None}
      pg.close()

    # ---- Inbox and Help in sight; weekly places never behind a menu (a More-page place counts as 2 taps) ----
    if not only or 'doors' in only:
      print(f'\n{L.APP}: doors (1 = always in view, 2 = one labelled tap in, - = behind a menu)')
      allv = {}
      for who in L.PEOPLE:
        for (w, h) in [(1440, 900), (1024, 768), (390, 844)]:
          d = doors(b, who, w, h); allv[f'{who}|{w}'] = d
          hidden = [p for p, v in d.items() if v is None]
          line = ' '.join(f"{p}:{v or '-'}" for p, v in d.items())
          if V5: print(f'  v5   {who} {w}: {len(hidden)} behind a menu  ({line})'); continue
          inbox = d.get('Inbox') == 1; help_ = d.get('Help') == 1 or (w < 768 and d.get('Help') == 2)
          R.check(f'{who} {w}: Inbox in one visible tap, Help in ' + ('one' if w >= 768 else 'one or two labelled taps') + ', no weekly place behind a menu',
                  inbox and help_ and not hidden, ('' if inbox else 'Inbox not in view; ') + ('' if help_ else 'Help not in view; ') + (f"behind a menu: {', '.join(hidden)}" if hidden else ''))
      got['doors'] = {k: sum(1 for v in d.values() if v is None) for k, d in allv.items()}

    # ---- More tools: each tool in its list, and each opens ----
    if not only or 'tools' in only:
      if V5: got['tools'] = {'note': 'v5 had no More tools page: rare tools sat in four "…" menus (X6)'}; print('\nv5   More tools: none (rare tools sat in four "…" menus, X6)')
      else:
        print(f'\n{L.APP}: More tools')
        pg = b.page('NT', 1440, 900); pg.open('/')
        door = L.find(pg.page, rx(r'^\s*More tools'), roles=('link', 'button'))
        if door is None or L.stub('staff6/tools.js'):
          R.check('More tools lists every rare tool', False, '', skip='not built yet: staff6/tools.js is a placeholder' if L.stub('staff6/tools.js') else None)
        else:
          door.click(); pg.ready()
          for t in TOOLS:
            el = L.find(pg.page, rx(r'^\s*(' + t + ')'), roles=('link', 'button'))
            if el is None: R.check(f'More tools: "{t}"', False, 'not on the page'); continue
            here = pg.hash(); errs = len(pg.errors); el.click(); pg.page.wait_for_timeout(500); pg.ready()
            broken = re.search(r'Something went wrong on this page', pg.text('main') or '')
            R.check(f'More tools: "{t}" opens in 2 clicks', not broken and len(pg.errors) == errs, pg.hash())
            pg.page.keyboard.press('Escape'); pg.nav(here[1:])
        pg.close()

    # ---- the search box finds places and actions (V32): always a second way, never the only one ----
    if not only or 'search' in only:
      print(f'\n{L.APP}: search finds places')
      pg = b.page('KV', 1440, 900); pg.open('/'); hits = {}
      for q, want in SEARCHES:
        box = pg.page.locator('header input[type=search], [role=search] input, #hq').first
        if not box.count(): R.check(f'search "{q}"', False, 'no search box'); continue
        box.fill(''); box.type(q, delay=20); pg.page.wait_for_timeout(900)
        items = pg.page.evaluate("() => [...document.querySelectorAll('[role=listbox] [role=option], [role=listbox] li, .sg-list li, .suggest li, [role=option]')].filter(e => e.getClientRects().length).map(e => e.innerText.replace(/\\s+/g, ' ').trim()).slice(0, 12)")
        items = [x for x in items if not re.match(r'(Look for|See all results)', x)]   # the "search everything" row is not a hit
        found = any(re.search(want, x, re.I) for x in items); hits[q] = found
        if V5: print(f"  v5   \"{q}\": {'found' if found else 'not found'}  ({'; '.join(items[:4])[:100]})")
        else: R.check(f'search "{q}" finds its place', found, '; '.join(items[:4])[:100])
        pg.page.keyboard.press('Escape')
      got['search'] = hits; pg.close()
  print(f'\n{round(time.time() - t0)} s')
  if V5:
    L.save_baseline('journeys', {**base, **got}); print(f'v5 baseline saved to {os.path.relpath(L.BASELINE)}')
  R.done(enforce=not V5)

if __name__ == '__main__':
  main()
