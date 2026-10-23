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
# The assessment's critic asked for more than clicks (V06): a keyboard-only run of approve, file and the chair ask (Tab and
# Enter only, each control showing the focus ring); focus back on the row after Back (a panel's close, the browser's Back,
# a page's Back link); the Undo toast in an aria-live region that was on the page before it spoke; nothing lost at 200%
# zoom on a 1280x800 laptop (a 640x400 window at twice the pixels: no sideways scroll, no cut words, every control of the
# 100% page still there); and the landing of a link that names a card (#/outreach?bill=) with the card fully in view.
#
#   APP=staff6 python3 tests/staff6_journeys.py    exits 1 when a built journey misses its budget or v5's count
#   APP=staff5 python3 tests/staff6_journeys.py    v5's clicks for each journey (the baseline), saved to tests/staff6_baseline_v5.json
#   V4_ROOT=/path/to/worktree ...                  serves that folder straight into the browser (otherwise HOST, :8832)
#   --only approve,file                            run some journeys; also doors, tools, search, keyboard, focus, toast,
#                                                  zoom, landing (the sections below)
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

class Type:
  """Typing into boxes on the page (not a click): {css selector: text}. Each box must be there and visible."""
  def __init__(self, boxes, note=''): self.boxes, self.note, self.unless, self.optional = boxes, note, None, False
  def label(self): return 'type into ' + ', '.join(self.boxes)[:50]

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
    if isinstance(s, Type):
      for sel, txt in s.boxes.items():
        box = pg.page.locator(sel).first
        if not box.count() or not box.is_visible(): return clicks, False, f'step {i} ({s.label()}): {sel} is not on the page', s
        box.fill(txt); pg.page.wait_for_timeout(300)
      continue
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
# What the toast says after the step (the page's own words can say "approved" or "sent back" about other items, so the
# approve and send-back journeys read the toast only).
TOAST = lambda rx_: (lambda pg: bool(re.search(rx_, pg.page.evaluate("() => document.getElementById('toast')?.innerText || ''"), re.I)))
# Kris's testimony approval: the card's "Review and approve" first. A row's "Review" can be another approval (Kevin's
# supporter email on her Do today), so it is the fallback, and the toast must say the testimony was approved.
REVIEW6 = (r'^\s*Review and approve\s*$', r'^\s*(Review|Approve)\b')
JOURNEYS = [
  J('approve', 'Approve testimony (Kris), from Today', 'KR', 2,
    [Step(*REVIEW6, in_view=True), Step('Approve$', wait=1300)], TOAST(r'^\s*Approved\b'),
    [Step('Review$', in_view=True), Step('Approve$', wait=1300)], r'Approved', needs=('#/',)),
  J('send-back', 'Send testimony back with a note (Kris), from Today', 'KR', 3,
    [Step(*REVIEW6, in_view=True), Step('Send back$'), Step(r'^\s*Send back', fill='Please add the 2024 survey numbers.')], TOAST(r'^\s*Sent back'),
    [Step('Review$', in_view=True), Step('Send back$'), Step(r'^\s*Send back', fill='Please add the 2024 survey numbers.')], r'Sent back', needs=('#/',)),
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
  # The same reply recorded on the Get hearings board, with no help from Today (the critic: a reply on a follow-up row).
  J('record-reply-board', "Record the chair's reply on Get hearings (Kevin)", 'KV', 2,
    [Step(r'^\s*(Follow up|They replied)\b'), Step(r'^\s*(Will schedule|They will schedule)')], r'will schedule',
    None, start='/hearings/ask', needs=('staff6/hearings.js',), v5=4, v5_note="v5's This week deadline box: This week, the bill, Asked by you, Will schedule (as record-reply)"),
  # Kevin's HB2121 is approved and his to file on the busy day; v5 folded it under "+2 on this bill" (X22). With D16 a
  # filing due Wednesday is a Coming up row with no button: the row in view counts as found (12.7) and opens the item,
  # whose Mark filed opens the filing card (V25), whose Mark filed finishes it. File at the Capitol leaves the app.
  J('file', 'File testimony: 0 clicks to find, at most 3 steps (Kevin), from Today', 'KV', 3,
    [Step(r'^\s*(File|File it|File at the Capitol|File testimony|Mark filed)\b', rx(r'^\s*(Disposable e-cigarette ban|HB ?2121)\b.*\bFile by\b'), in_view=True),
     Step(r'^\s*Mark filed', optional=True), Step(r'^\s*(Mark filed|Yes, mark filed|Filed)\b', optional=True)],
    r'Filed\.|is done|marked filed|Filed by Kevin',
    [Step(rx(r'\+\d+ on this bill'), in_view=True), Step(r'^\s*(Mark filed|File)\b'), Step('Mark filed')], needs=('#/', 'staff6/filing.js')),
  J('hearing-day-going', "Hearing day on a phone: I'm going in 1 tap (Kris, Fri 3/20)", 'KR', 1,
    [Step(r"^\s*I.m going", in_view=True)], r"Going: Kris|you.re going|You are going|You and|going",
    [Step(rx(r'^More for'), in_view=True), Step(r"^\s*I.m going")], extra=L.KRIS_DAY, size=(390, 844), needs=('#/',)),
  J('hearing-day-approve', 'Hearing day on a phone: my approval in 2 taps, no scroll (Kris, Fri 3/20)', 'KR', 2,
    [Step(*REVIEW6, in_view=True), Step('Approve$', wait=1300, in_view=True)], TOAST(r'^\s*Approved\b'),
    [Step('Review$', in_view=True), Step('Approve$', wait=1300, in_view=True)], r'Approved', extra=L.KRIS_DAY, size=(390, 844), needs=('#/',)),
  J('see-slipping', 'See what is slipping (Nate), from Today', 'NT', 1,
    [Step(r'^\s*(Open Team|Team)\b', roles=('link', 'button'))], lambda pg: L.visible_text(pg.page, r'^\s*Slipping', 'main', True) is not None,
    [Step('Team$', roles=('button',))], needs=('staff6/team.js',)),
  J('turn-off', 'Turn someone off and hand over their work (Nate)', 'NT', 4,
    [Step('People$', roles=('link',)), Step('James'), Step(r'^\s*Leaving or away'), Step(r'^\s*Hand over and turn off')], r'turned off|handed|was James',
    None, needs=('staff6/people.js',), v5=13, v5_note='assessment X24: 13 clicks, 2 scrolls, 4 screens (not replayed)'),
  # The prep steps run inline (V30): two "Looks right", the goal and three talking points typed (the next step opens as
  # soon as what is typed would do it), top issue yes or no, keep it, then Mark ready. Typing is not a click.
  J('prep-issue', 'Prepare one 2027 issue (Kevin, 5 Nov)', 'KV', 8,
    [Step('My issues$', roles=('link',)), Step(rx(r'^\s*(Start|Next): '), roles=('link', 'button')),
     Step(r'^\s*Looks right'), Step(r'^\s*Looks right'),
     Type({'main [data-prauto=goal]': 'Keep large cigars out of the mail.',
           'main [data-prauto=points]': 'Cigars by mail reach kids.\nAge checks at the door fail.\nHawaiʻi already limits tobacco by mail.'}),
     Step(r'^\s*(Yes, a top issue|No)\s*$'), Step(r'^\s*Keep it'), Step(r'^\s*Mark ready')],
    r'Marked ready|your part is done', None, extra=L.CLOCKS['off'], needs=('#/my-issues',), v5=14, v5_note='assessment X26: 14 clicks per issue (not replayed)'),
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
# ("Practice copy" is listed in the live app only: these tests run in the practice copy, which does not link to itself.)
TOOLS = ['Holding our bills', 'Session calendar', 'Earlier testimony', 'How to file', 'Lists', r'Make a link|QR code', 'First visit numbers',
         r'Supporters.? groups', 'Sort new bills', 'Muted bills', 'Saved views', 'Bulk change', 'Export', 'Getting started',
         'What moved', 'Keyboard shortcuts', r'Someone else.s list|See as (a )?teammate|See a teammate.s list']
SEARCHES = [('inbox', r'Inbox'), ('QR code', r'QR|Make a link'), ('sort new bills', r'Sort new bills'), ('responding', r'respond|landing|First visit'),
            ('approve', r'approve|Testimony'), ('arrivals', r'arriv|First visit')]

# ---- accessibility (the assessment's critic, V06; spec 7.10) ----
# The focused control: its accessible name (aria-label, its label, its words) and whether it shows a focus ring (a 2px or
# wider outline, or a box-shadow ring, on it or on the row or card around it that :focus-within lights).
FOCUSED = r"""() => { const e = document.activeElement; if (!e || e === document.body || e === document.documentElement) return null;
  const s = getComputedStyle(e), lab = e.labels && e.labels[0] ? e.labels[0].innerText : '';
  const ringOf = x => { if (!x) return false; const t = getComputedStyle(x); return (t.outlineStyle !== 'none' && parseFloat(t.outlineWidth) >= 2) || (t.boxShadow && t.boxShadow !== 'none' && /\b[2-9]px|\b\d{2}px/.test(t.boxShadow.replace(/0px 0px 0px/g, ''))); };
  const r = e.getBoundingClientRect();
  return { name: (e.getAttribute('aria-label') || lab || e.innerText || e.value || e.getAttribute('placeholder') || e.getAttribute('title') || '').replace(/\s+/g, ' ').trim(),
    ring: ringOf(e) || ringOf(e.parentElement), seen: r.width > 0 && r.height > 0, inDialog: !!e.closest('dialog[open], [role=dialog]'), tag: e.tagName.toLowerCase() }; }"""

def kb_walk(pg, steps, done, max_tabs=70):
  """Tab and Enter only (Shift+Tab never): for each step, Tab until the focused control's name matches, then Enter.
  Returns (tabs, enters, ok, detail, controls focused with no visible ring)."""
  tabs = enters = 0; noring = []
  for i, s in enumerate(steps, 1):
    if s.unless and re.search(s.unless, pg.text('main') or '', re.I): continue
    hit = None
    for _ in range(max_tabs):
      pg.page.keyboard.press('Tab'); tabs += 1
      f = pg.page.evaluate(FOCUSED)
      if not f or not f['seen']: continue
      if not f['ring'] and f['name'] and f['name'][:40] not in noring: noring.append(f['name'][:40])
      if any(n.search(f['name']) for n in s.names): hit = f; break
    if hit is None:
      if s.optional: continue
      return tabs, enters, False, f'step {i} ({s.label()}) not reached in {max_tabs} Tab presses', noring
    if s.wait: pg.page.wait_for_timeout(s.wait)
    pg.page.keyboard.press('Enter'); enters += 1; pg.page.wait_for_timeout(500); pg.ready(4000)
  ok = done(pg) if callable(done) else bool(re.search(done, said(pg), re.I))
  return tabs, enters, ok, '' if ok else f'after {enters} Enter presses the job is not done', noring

KEYBOARD = [   # (key, name, who, steps, done, extra, size)
  ('approve', 'Approve testimony (Kris), from Today', 'KR',
   [Step(r'^\s*Review and approve\s*$'), Step('Approve$', wait=1300)], TOAST(r'^\s*Approved\b'), '', (1440, 900)),
  ('file', 'File testimony (Kevin), from Today', 'KV',
   [Step(r'^\s*(File|Mark filed)\s*$', rx(r'^\s*(Disposable e-cigarette ban|HB ?2121)\b.*\bFile by\b')), Step(r'^\s*Mark filed'), Step(r'^\s*(Mark filed|Yes, mark filed)\b')],
   r'Filed\.|is done|marked filed|Filed by Kevin', '', (1440, 900)),
  ('ask-chair', 'Ask a chair for a hearing and record it (Kevin), from Today', 'KV',
   [Step(r'^\s*Email the chairs?\b'), Step(r'^\s*Yes, I sent it')], r'asked|Saved', '', (1440, 900)),
]

def keyboard(b, R, only):
  print(f'\n{L.APP}: keyboard only (Tab and Enter; the focus ring on every control on the way)')
  out = {}
  for key, name, who, steps, done, extra, (w, h) in KEYBOARD:
    pg = b.page(who, w, h); pg.open('/', extra)
    tabs, enters, ok, detail, noring = kb_walk(pg, steps, done)
    out[key] = {'tabs': tabs, 'enters': enters, 'ok': ok}
    R.check(f'Keyboard only: {name}: {enters} Enter, {tabs} Tab', ok and not pg.errors, detail + (f' page error: {pg.errors[0][:80]}' if pg.errors else ''))
    R.check(f'Keyboard only: {name}: every control on the way shows its focus ring', not noring, ', '.join(f'"{n}"' for n in noring[:5]))
    pg.close()
  return out

# Where Back must put the focus: (place, who, size, route, how Back is pressed). A row opened beside the list closes with
# its own Back or X, or the browser's Back; below 1100px the item is a page of its own with "Back to the list"; a bill
# opened from Bills comes back with the browser's Back.
FOCUS_CASES = [
  ('Today, the item beside the list, its close button', 'NT', 1440, 900, '/', 'close'),
  ("Today, the item beside the list, the browser's Back", 'NT', 1440, 900, '/', 'browser'),
  ('Today below 1100px, the item as its own page, Back to the list', 'NT', 1024, 768, '/', 'close'),
  ('Testimony, the item beside the list, its close button', 'KR', 1440, 900, '/testimony?view=approve', 'close'),
  ("Bills, a bill's page, the browser's Back", 'KV', 1440, 900, '/bills', 'browser'),
  ("Bills on a phone, a bill's page, the top bar's Back", 'KV', 390, 844, '/bills', 'link'),
]
ROWKEY = r"""() => { const e = document.activeElement; if (!e) return null; const row = e.closest('.v6-row, [role=listitem], li, tr');
  return { key: e.dataset?.v6pick || e.getAttribute('href') || '', row: row ? (row.dataset.v6row || row.innerText.slice(0, 40)) : '', tag: e.tagName.toLowerCase(), name: (e.innerText || e.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim().slice(0, 50) }; }"""

def focus_back(b, R, only):
  print(f'\n{L.APP}: focus returns to the row after Back (spec 7.10)')
  out = {}
  for name, who, w, h, route, how in FOCUS_CASES:
    pg = b.page(who, w, h); pg.open(route)
    # the first row that opens an item and has no button of its own: on Today, Enter on a row with its own button does
    # that step (the keyboard shortcuts kept from v5, F69), and "o" opens the item; a row with no button opens on Enter
    # (a panel case needs a row that opens beside the list: [data-v6pick]; a page case a row that is a link)
    pg.page.evaluate("""(pick) => { const r = [...document.querySelectorAll('main .v6-row')].find(x => x.getClientRects().length && !x.querySelector('.v6-row-act .btn, .v6-row-act button')
      && x.querySelector(pick ? '.v6-row-main[data-v6pick]' : 'a.v6-row-main[href]')); r?.querySelector('.v6-row-main')?.setAttribute('data-t-row', '1'); }""", how != 'link' and route in ('/', '/testimony?view=approve'))
    row = pg.page.locator('[data-t-row]').first
    if not row.count() or not row.is_visible():
      R.check(f'Focus back: {name}', False, 'no row to open'); pg.close(); continue
    row.focus(); before = pg.page.evaluate(ROWKEY); h0 = pg.hash()
    pg.page.keyboard.press('Enter'); pg.page.wait_for_timeout(600); pg.ready(4000)
    opened = pg.page.evaluate("() => !!document.querySelector('.v6-ld.open')") or pg.hash() != h0
    if not opened:
      R.check(f'Focus back: {name}', False, 'Enter on the row opened nothing'); pg.close(); continue
    if how == 'browser': pg.page.go_back(); pg.page.wait_for_timeout(700); pg.ready(4000)
    else:
      sel = '.v6-ld.open .v6-ld-back, .v6-ld.open .v6-item-close, .v6-ld.open [data-v6ldclose]' if how == 'close' else 'a[data-back], .sv-back'
      ctl = [c for c in pg.page.locator(sel).all() if c.is_visible()]
      if not ctl: R.check(f'Focus back: {name}', False, f'no visible Back ({sel})'); pg.close(); continue
      ctl[0].focus(); pg.page.keyboard.press('Enter'); pg.page.wait_for_timeout(700); pg.ready(4000)
    after = pg.page.evaluate(ROWKEY) or {}
    ok = bool(after) and after.get('key') == before.get('key') and after.get('row') == before.get('row')
    out[name] = ok
    R.check(f'Focus back: {name}', ok and not pg.errors, '' if ok else f"focus on <{after.get('tag', 'nothing')}> \"{after.get('name', '')}\", not the row \"{before.get('name', '')}\"")
    pg.close()
  return out

LIVE0 = r"""() => { document.querySelectorAll('[aria-live], [role=status], [role=alert], [role=log]').forEach(e => e.dataset.live0 = '1'); }"""
TOASTED = r"""() => { const u = [...document.querySelectorAll('button, a')].find(e => /^\s*Undo\s*$/i.test(e.innerText || '') && e.getClientRects().length);
  if (!u) return { undo: false };
  const live = u.closest('[aria-live], [role=status], [role=alert], [role=log]');
  return { undo: true, live: !!live, polite: live ? (live.getAttribute('aria-live') || live.getAttribute('role')) : '', early: !!(live && live.dataset.live0), text: (live || u.parentElement).innerText.replace(/\s+/g, ' ').trim().slice(0, 80) }; }"""
TOAST_CASES = [('Resubmit (Patti)', 'PH', [Step('Resubmit')]), ("Approve (Kris, in Review)", 'KR', [Step(*REVIEW6), Step('Approve$', wait=1300)]),
               ('Looks right (Kevin, prep)', 'KV', [Step('My issues$', roles=('link',)), Step(rx(r'^\s*(Start|Next): '), roles=('link', 'button')), Step(r'^\s*Looks right')])]

def toasts(b, R, only):
  print(f'\n{L.APP}: the Undo toast is read aloud (an aria-live region that was on the page before it spoke)')
  for name, who, steps in TOAST_CASES:
    pg = b.page(who, 1440, 900); pg.open('/', L.CLOCKS['off'] if 'prep' in name else '')
    pg.page.evaluate(LIVE0)
    clicks, ok, detail, miss = walk(pg, steps, lambda p: True)
    t = pg.page.evaluate(TOASTED)
    good = ok and t.get('undo') and t.get('live') and t.get('early')
    R.check(f'Undo toast in a live region: {name}', good, detail or ('no Undo shown' if not t.get('undo') else '' if good else f"Undo in {'a live region added late' if t.get('live') else 'no live region'}: \"{t.get('text', '')}\""))
    pg.close()

# ---- 200% zoom at 1280 (WCAG 1.4.4): a 1280x800 window zoomed to 200% lays out as 640x400 CSS pixels at twice the
# pixels. Nothing may be lost: no sideways scroll, no words cut by a box that hides its overflow (or off the right edge),
# and every control the 100% page shows is still on the 200% page (its name, anywhere on the page). ----
ZOOM_ROUTES = [('today', '/', 'NT'), ('hearings', '/hearings', 'KV'), ('get-hearings', '/hearings/ask', 'KV'), ('testimony', '/testimony', 'KR'),
  ('review', '/review', 'KR'), ('outreach', '/outreach', 'SY'), ('supporters', '/outreach/supporters', 'SY'), ('bills', '/bills', 'KV'),
  ('a-bill', '/bill/HB1562', 'NT'), ('legislators', '/legislators', 'KV'), ('a-legislator', f'/legislator/{L.LEGISLATOR}', 'KV'),
  ('my-issues', '/my-issues', 'KV'), ('inbox', '/inbox', 'KV'), ('help', '/help', 'KV'), ('team', '/team', 'NT'), ('people', '/people', 'NT'),
  ('setup', '/setup', 'NT'), ('more-tools', '/tools', 'NT'), ('my-settings', '/me', 'KV'), ('search', '/search?q=tobacco', 'KV')]
CUT = r"""() => { const W = innerWidth, out = [], off = [];
  const clipper = el => { for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) { const s = getComputedStyle(a);
      if (/hidden|clip/.test(s.overflowX) || /hidden|clip/.test(s.overflowY)) return [a, s]; } return null; };
  const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n;
  while ((n = tw.nextNode())) { const v = n.nodeValue.replace(/\s+/g, ' ').trim(); if (!v || v.length < 2) continue; const el = n.parentElement;
    if (!el || el.closest('.sr, script, style, [aria-hidden=true], dialog:not([open]), .band, svg')) continue;
    const s = getComputedStyle(el); if (s.visibility === 'hidden' || s.display === 'none' || +s.opacity === 0) continue;
    const r = document.createRange(); r.selectNodeContents(n); const q = [...r.getClientRects()].filter(x => x.width > 1 && x.height > 1); if (!q.length) continue;
    const where = v.slice(0, 30) + ' (' + (String(el.className || el.tagName.toLowerCase()).split(' ')[0]) + ')';
    // past the window's right edge, part of it in view: cut (all of it past the edge is a drawer off the canvas)
    if (q.some(x => x.left < W - 1 && x.right > W + 1)) { out.push(where); continue; }
    // a box that hides its overflow cuts part of it (a box that hides all of it is a closed fold, not a cut)
    const c = clipper(el); if (c) { const [a, cs] = c, ar = a.getBoundingClientRect();
      const part = q.some(x => x.right > ar.left && x.left < ar.right && x.bottom > ar.top && x.top < ar.bottom) && q.some(x => x.right > ar.right + 1 || x.left < ar.left - 1 || (/hidden|clip/.test(cs.overflowY) && x.bottom > ar.bottom + 1));
      if (part && ar.width > 4 && ar.height > 4) { out.push(where); continue; } }
    if (s.textOverflow === 'ellipsis' && el.scrollWidth > el.clientWidth + 1) out.push(where + ' …'); }
  return { cut: [...new Set(out)].slice(0, 8), n: new Set(out).size, hscroll: document.documentElement.scrollWidth > innerWidth + 1 }; }"""
# each control as [name, address]: a link is the same control when it goes to the same address, whatever its words say at
# that width ("3 of your bills" / "3 bills"); a button when its name is in a 200% control's name (a row's name grows a line)
CONTROLS = r"""() => [...document.querySelectorAll('main a[href], main button, main input:not([type=hidden]), main select, main textarea, main [role=tab], main [role=switch]')]
  .filter(e => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden' && !e.closest('details:not([open]) > :not(summary), .sr'))
  .map(e => [(e.getAttribute('aria-label') || (e.labels && e.labels[0] ? e.labels[0].innerText : '') || e.innerText || e.getAttribute('placeholder') || '').replace(/\s+/g, ' ').replace(/\s*\d+$/, '').trim().toLowerCase(), e.getAttribute('href') || '',
    e.dataset.v6act ? (e.dataset.v6b || '') : '', e.dataset.v6b || e.closest('.v6-step')?.querySelector('[data-v6act][data-v6b]')?.dataset.v6b || ''])
  .filter(x => x[0] || x[1])"""
def short_of(a, b):
  """`a` is `b` said shorter: its words (two or more) appear in `b` in the same order ("3 bills" / "3 of your bills",
  "sorted by last active" / "sorted by last active, newest first")."""
  wa, wb = re.findall(r"[\w’']+", a), re.findall(r"[\w’']+", b)
  if len(wa) < 2 or len(wa) >= len(wb): return False
  it = iter(wb); return all(w in it for w in wa)
def kept(c, zoomed, back):
  """Is a control of the 100% page still on the 200% one? Same address, or its name inside a control's name; a Close or
  Back button is kept by the frame's Back (the phone layout's top bar); a bill's step card (its button, the Capitol link,
  Open Doc) is kept by any step button for the same bill (on a phone the hearing card's File opens the same filing card)."""
  name, href, _, bill = c
  if href and href != '#' and any(z[1] == href for z in zoomed): return True
  if name and any(name == z[0] or name in z[0] or short_of(z[0], name) for z in zoomed): return True
  if bill and any(z[2] == bill for z in zoomed): return True
  return bool(back and re.match(r'^(close|back)\b', name))

def zoom(b, R, only):
  print(f'\n{L.APP}: 200% zoom at 1280x800 (a 640x400 window, twice the pixels): nothing lost')
  out = {}
  for key, route, who in ZOOM_ROUTES:
    if key in ('team', 'people', 'setup') and who not in L.LEADS: continue
    a = b.page(who, 1280, 800); a.open(route); full = a.page.evaluate(CONTROLS); a.close()
    ctx = b.b.new_context(viewport={'width': 640, 'height': 400}, device_scale_factor=2, reduced_motion='reduce')
    if L.ROOT: ctx.route(lambda u: not u.startswith(L.HOST), lambda r: r.abort())
    ctx.route(L.HOST + '/**', L.router); ctx.add_init_script(L.INIT)
    pg = L.P(ctx, ctx.new_page(), who, 640, 400, False); pg.open(route)
    c = pg.page.evaluate(CUT)
    # a control may move into the frame at 200% (the phone's top bar or tab bar), so look for it on the whole page
    zoomed = pg.page.evaluate(CONTROLS.replace("main a[href], main button, main input:not([type=hidden]), main select, main textarea, main [role=tab], main [role=switch]", "a[href], button, input:not([type=hidden]), select, textarea, [role=tab], [role=switch]"))
    back = pg.page.evaluate("() => !![...document.querySelectorAll('a[data-back], .sv-back')].find(e => e.getClientRects().length)")
    lost = sorted({c[0] or c[1] for c in full if not kept(c, zoomed, back) and len(c[0] or c[1]) > 1})
    out[key] = {'cut': c['n'], 'hscroll': c['hscroll'], 'lost': len(lost)}
    ok = not c['hscroll'] and not c['cut'] and not lost and not pg.errors
    R.check(f'200% zoom at 1280: {key} ({who}) loses nothing', ok, '' if ok else '; '.join(x for x in [
      'sideways scroll' if c['hscroll'] else '', f"{c['n']} cut: " + ', '.join(c['cut'][:4]) if c['cut'] else '',
      f"{len(lost)} controls gone: " + ', '.join(f'"{x[:30]}"' for x in lost[:5]) if lost else '', pg.errors[0][:80] if pg.errors else ''] if x))
    pg.close()
  return out

# ---- a link that names a card lands with the card in full view (Outreach's #/outreach?bill=, the critic) ----
LANDINGS = [('#/outreach?bill=HB1573', 'SY', '.ot-card.hl')]
def landing(b, R, only):
  print(f'\n{L.APP}: a link that names a card lands with the card in view')
  for addr, who, sel in LANDINGS:
    for (w, h) in [(1440, 900), (1280, 800), (1024, 768), (390, 844), (320, 640)]:
      pg = b.page(who, w, h); pg.open(addr[1:])
      box = pg.page.evaluate(f"() => {{ const e = document.querySelector('{sel}'); if (!e) return null; const r = e.getBoundingClientRect(); return {{ top: Math.round(r.top), bottom: Math.round(r.bottom), h: innerHeight }}; }}")
      tall = box and box['bottom'] - box['top'] > box['h'] - 60
      # fully in view; a card taller than the window starts near the top instead (under the phone's top bar)
      ok = bool(box) and box['top'] >= 0 and (box['bottom'] <= box['h'] or (tall and box['top'] <= 140))
      R.check(f'{addr} as {L.NAMES[who]} at {w}x{h}: the card in view', ok and not pg.errors, '' if ok else (f"card at {box['top']}..{box['bottom']} of {box['h']}" if box else f'no {sel} on the page'))
      pg.close()

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
    # ---- accessibility and landings (v6 only: v5 is the before for clicks, not for these) ----
    if not V5:
      if not only or 'keyboard' in only: got['keyboard'] = keyboard(b, R, only)
      if not only or 'focus' in only: got['focus'] = focus_back(b, R, only)
      if not only or 'toast' in only: toasts(b, R, only)
      if not only or 'zoom' in only: got['zoom'] = zoom(b, R, only)
      if not only or 'landing' in only: landing(b, R, only)
  print(f'\n{round(time.time() - t0)} s')
  if V5:
    L.save_baseline('journeys', {**base, **got}); print(f'v5 baseline saved to {os.path.relpath(L.BASELINE)}')
  R.done(enforce=not V5)

if __name__ == '__main__':
  main()
