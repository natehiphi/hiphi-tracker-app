# Staff v6 wayfinding walk (R-365): how hard it is to know what to do next, to find a bill or an issue, and to tell where you
# are. Staff say v6 is overwhelming; this script turns that into numbers, once now (the baseline) and again after the
# redesign (`--flow 2`), so the two runs are comparable and nobody has to argue from feel.
#
# WHAT IT DOES. On the practice copy (demo, Mon 16 Mar 2026) it walks eleven tasks (T1-T11, docs/requests/R-365/METHOD.md in
# the backend repo) as Kevin (KV), Saya (SY), Patti (PH), Jess (JS) and Nate (NT), on a laptop (1440x900) and a phone
# (390x844). Each task starts in a fresh browser (so one task's changes never leak into the next) and is walked by visible
# words and roles, never CSS classes, the way staff6_journeys.py does. For every task it records:
#   clicks · dead ends (a click, or a whole attempt, that did not move toward the goal) · back-outs (clicks spent returning
#   to where the attempt began) · reached (yes/no)
# and, on EVERY screen the walk lands on, three "where you are" signs, 0-3 (one point each):
#   1 title      a visible title that names the screen (the page's h1; on a phone, the top bar's title)
#   2 highlight  the current place lit (aria-current) in the sidebar, the phone's bar or the header's Help / Inbox
#   3 back       a visible Back link whose words name where it goes ("Hearings", "Back to Bills"; "Close review" does not)
# plus how many controls sit above the first item on that screen, how many words are in its first screen, and a screenshot.
#
# WHY THE NUMBERS CAN BE TRUSTED (and where they cannot). The walk is a script, not a person: it never gets bored or lucky,
# so a rerun gives the same numbers. Where a real first-time staffer would choose, the script uses one fixed, written-down
# rule (ROUTE_ORDER below: the places a newcomer tries for a bill, in the sidebar's order) and says so in the row's note.
# Those rules are assumptions; the Sonnet fresh-eyes walks (METHOD step 2) test them. Search counts two clicks (click the
# box, click the suggestion); typing is not a click. A top-level place (Today, Hearings...) has nowhere "back" to go, yet
# METHOD wants 3 of 3 signs everywhere: the raw score is kept as METHOD words it, and the summary also shows the score with
# top-level places excused from Back, so the redesign's choice (give them a Back, or not) is visible either way.
#
#   python3 tests/staff6_wayfind.py --out wayfind.json --shots shots/      the whole walk
#   --only T1,T4        some tasks            --who KV,NT      some people        --phone / --laptop   one device
#   --flow 2            appends &vb=1 to every address, so the walk measures version B (R-365; the option keeps its name, and no other value changes anything)
#   --host URL          where the practice copy is served (or set HOST / V4_ROOT as staff6_lib does; default :8832)
# T9 (and T10) are walked on the laptop, T11 is the same two on the phone's bar; each is walked only on its own device. T10/T11's
# Back walk stands on the screens the other tasks landed on, so run it with the others (`--only T10` alone has nothing to stand on).
# It reports misses and always exits 0: this is a measurement, not a gate (yet).
import argparse, json, os, re, statistics, sys, time

HERE = os.path.dirname(os.path.abspath(__file__))
import tempfile
SCRATCH = os.environ.get('WAYFIND_DIR') or os.path.join(tempfile.gettempdir(), 'staff6-wayfind')  # outside the repo: 1,000+ screenshots
ap = argparse.ArgumentParser(description=__doc__.splitlines()[0] if __doc__ else '')
ap.add_argument('--only', default=''); ap.add_argument('--who', default='KV,SY,PH,JS,NT')
ap.add_argument('--phone', action='store_true'); ap.add_argument('--laptop', action='store_true')
ap.add_argument('--flow', default=''); ap.add_argument('--host', default='')
ap.add_argument('--shots', default=os.path.join(SCRATCH, 'wayfind-shots')); ap.add_argument('--out', default='')
ARGS = ap.parse_args()
if ARGS.host: os.environ['HOST'] = ARGS.host
sys.path.insert(0, HERE)
import staff6_lib as L

FLOWX = '&vb=1' if ARGS.flow == '2' else (f'&flow={ARGS.flow}' if ARGS.flow else '')
ONLY = {t.strip().upper() for t in ARGS.only.split(',') if t.strip()}
WHO = [w.strip().upper() for w in ARGS.who.split(',') if w.strip()]
SHOTS = ARGS.shots
OUT = ARGS.out or os.path.join(SHOTS, 'scorecard.json')
DEVICES = [d for d, on in (('laptop', ARGS.laptop or not ARGS.phone), ('phone', ARGS.phone or not ARGS.laptop)) if on]
SIZE = {'laptop': (1440, 900), 'phone': (390, 844)}
rx = lambda s: re.compile(s, re.I)

# The places a newcomer tries, in the sidebar's order, when asked to find a bill (a written assumption, see the header).
# A route is the clicks from the start; a name is a place or tab as the screen words it.
# Version B (--flow 2) names Issues "My issues" and Hearings "Calendar"; Testimony and Outreach live in Today and the issue's tabs.
B_PLACE = {'Issues': 'My issues', 'Hearings': 'Calendar'}
TOPLEVEL = {'today', 'hearings', 'testimony', 'outreach', 'issues', 'more', 'tools', 'legislators', 'inbox', 'help', 'team', 'people', 'partners', 'setup', 'me'}
ROUTE_ORDER = [['Hearings'], ['Testimony'], ['Issues', 'Bills'], ['Issues', 'All issues'], ['Outreach']]
HB1562 = 'HB1562'

# ---- what the page says: scripts run in the browser ----
JS_PREP = r"""async () => { try { await Promise.all([document.fonts.load('16px Poppins'), document.fonts.load('600 16px Poppins'), document.fonts.load('16px Lato'), document.fonts.ready]); } catch (e) {}
  await Promise.all([...document.images].map(i => i.complete ? 1 : new Promise(r => { i.onload = i.onerror = r; setTimeout(r, 1500); }))); scrollTo(0, 0); }"""

# One screen's where-you-are signs, controls above its first item, and its kind. Every test is by role, aria and words.
JS_SCAN = r"""() => {
  const vis = e => !!e && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden' && (r => r.width > 0 && r.height > 0)(e.getBoundingClientRect());
  const clean = s => (s || '').replace(/\s+/g, ' ').trim();
  const main = document.querySelector('main') || document.body, header = document.querySelector('header');
  // 1 title: a visible h1, or (the phone hides the page's own h1) the top bar's title: header text that is not a link, button or form
  const h1 = [...document.querySelectorAll('h1, [role=heading][aria-level="1"]')].filter(vis).map(e => clean(e.innerText)).find(Boolean) || '';
  const bar = header ? [...header.querySelectorAll('[aria-hidden=true]')].filter(e => vis(e) && !e.closest('a, button, form')).map(e => clean(e.innerText)).find(Boolean) || '' : '';
  const title = h1 || bar;
  const titles = [h1, bar, document.title].filter(Boolean).join(' | ');
  // 2 highlight: a visible current place in the sidebar, the phone's bar or the header (not a tab strip inside the page)
  const cur = [...document.querySelectorAll('[aria-current]')].filter(e => vis(e) && !main.contains(e) && e.getAttribute('aria-current') !== 'false');
  const hl = cur.map(e => clean(e.getAttribute('aria-label') || e.innerText).replace(/\s*\d+(\s*,.*)?$/, '').replace(/^Inbox.*/, 'Inbox')).find(Boolean) || '';
  // 3 back: a visible Back (the app marks its own with data-back) and the words that say where it goes
  const backs = [...document.querySelectorAll('a, button')].filter(e => vis(e) && (e.hasAttribute('data-back') || (!e.closest('li') && (/^back\b/i.test(clean(e.innerText)) || /^back\b/i.test(e.getAttribute('aria-label') || '')))));
  const b = backs[0]; let back = '', backWords = '';
  if (b) { back = clean(b.getAttribute('aria-label') || b.innerText); backWords = back.replace(/^back( to)?\s*/i, '').trim(); }
  const backNamed = !!backWords && !/^(close|cancel|previous|return|go|up|home)\b/i.test(backWords);
  // controls above the first item (a link to a bill, issue, hearing, person... or the first list row), header and work column
  const ENT = /#\/(bill|issue|hearing|legislator|person|review|list|email|coalition)\//;
  const tops = [];
  main.querySelectorAll('a[href]').forEach(a => { if (vis(a) && ENT.test(a.getAttribute('href') || '') && !a.closest('nav, [role=tablist]')) tops.push(a.getBoundingClientRect().top); });
  main.querySelectorAll('li, article, tr, [role=listitem], [role=row]').forEach(e => { const r = e.getBoundingClientRect(); if (vis(e) && r.height >= 28 && r.width >= 180 && !e.closest('nav, [role=tablist], header, dialog') && e.querySelector('a[href], button')) tops.push(r.top); });
  const firstTop = tops.length ? Math.min(...tops) : Infinity;
  const CTRL = 'a[href], button, input:not([type=hidden]), select, textarea, summary, [role=button], [role=tab]';
  const ctrls = [...(header ? header.querySelectorAll(CTRL) : []), ...main.querySelectorAll(CTRL)].filter(e => vis(e) && !e.disabled && !e.closest('.sr') && e.getBoundingClientRect().top < firstTop - 2);
  const above = ctrls.filter((e, i) => ctrls.indexOf(e) === i).length;
  return { hash: location.hash, title, titles, hl, back, backWords, backNamed, hasBack: !!b, above, hasItem: tops.length > 0, dialog: document.querySelectorAll('dialog[open]').length,
    toast: clean(document.getElementById('toast')?.innerText || ''), text: clean(main.innerText).length, w: innerWidth, hscroll: document.documentElement.scrollWidth > innerWidth + 1 }; }"""

# (A row in a list that merely starts with the word Back, like More's "Back to Staff v5", is not a Back link: only the app's own data-back marks those.)
# Finders: tag one element by its words/position and return its words, so Playwright can click it. [data-wf] is the walk's own
# marker, removed before each search; no site class is read.
JS_FIND = {
 # the first thing to press in the "Your next step" card: not the bill's own link, not Open Doc, not a message or outside link
 'first_step': r"""() => { document.querySelectorAll('[data-wf]').forEach(e => e.removeAttribute('data-wf'));
   const m = document.querySelector('main'), h = [...m.querySelectorAll('h2')].find(x => /your next step/i.test(x.innerText)); if (!h) return null;
   const ok = e => e.getClientRects().length && !/^(https?:|mailto:|tel:)/.test(e.getAttribute('href') || '') && !/#\/(bill|hearing)\//.test(e.getAttribute('href') || '') && !/open doc|^message /i.test(e.innerText.trim()) && e.innerText.trim();
   let box = h.parentElement, els = [];
   for (let i = 0; i < 4 && box; i++) { els = [...box.querySelectorAll('button, a[href]')].filter(ok); if (els.length) break; box = box.parentElement; }
   const t = els[0]; if (!t) return null; t.setAttribute('data-wf', '1'); return t.innerText.replace(/\s+/g, ' ').trim(); }""",
 # the first button on a Do today (or, failing that, Coming up) row
 'row_button': r"""() => { document.querySelectorAll('[data-wf]').forEach(e => e.removeAttribute('data-wf'));
   const m = document.querySelector('main'), hs = [...m.querySelectorAll('h2')]; const h = hs.find(x => /^do today/i.test(x.innerText.trim())) || hs.find(x => /^coming up/i.test(x.innerText.trim())); if (!h) return null;
   const after = [...m.querySelectorAll('button')].filter(b => b.getClientRects().length && (h.compareDocumentPosition(b) & 4) && /^[A-Z]/.test(b.innerText.trim()) && !/^undo$/i.test(b.innerText.trim()) && !b.closest('dialog'));
   const t = after[0]; if (!t) return null; t.setAttribute('data-wf', '1'); return t.innerText.replace(/\s+/g, ' ').trim(); }""",
 # the screen's Back: the app marks its own with data-back; otherwise a link whose name starts with Back
 'back': r"""() => { document.querySelectorAll('[data-wf]').forEach(e => e.removeAttribute('data-wf'));
   const t = [...document.querySelectorAll('a, button')].find(e => e.getClientRects().length && (e.hasAttribute('data-back') || (!e.closest('li') && (/^back\b/i.test(e.innerText.trim()) || /^back\b/i.test(e.getAttribute('aria-label') || ''))))); if (!t) return null;
   t.setAttribute('data-wf', '1'); return t.innerText.replace(/\s+/g, ' ').trim() || t.getAttribute('aria-label'); }""",
 # the first press under "What's next" on a bill page
 'whats_next': r"""() => { document.querySelectorAll('[data-wf]').forEach(e => e.removeAttribute('data-wf'));
   const m = document.querySelector('main'), hs = [...m.querySelectorAll('h2, h3, h4, p, span, div')].filter(x => x.children.length < 3 && /^what.s next/i.test(x.innerText.trim())); const h = hs[0]; if (!h) return null;
   const after = [...m.querySelectorAll('button, a[href]')].filter(b => b.getClientRects().length && (h.compareDocumentPosition(b) & 4) && !/^(https?:|mailto:)/.test(b.getAttribute('href') || '') && !/#\/(bill|hearing|legislator)\//.test(b.getAttribute('href') || '') && !/open doc|^message |^add\b/i.test(b.innerText.trim()) && b.innerText.trim());
   const t = after[0]; if (!t) return null; t.setAttribute('data-wf', '1'); return t.innerText.replace(/\s+/g, ' ').trim(); }""",
}
# a link to a screen, found by where it goes (arg: a regex source for the address after #); tags the first visible one
JS_HREF = r"""(arg) => { document.querySelectorAll('[data-wf]').forEach(e => e.removeAttribute('data-wf'));
  const [src, nth] = Array.isArray(arg) ? arg : [arg, 0], re = new RegExp(src), vis = e => e.getClientRects().length > 0, seen = new Set();
  const a = [...document.querySelectorAll('a[href]')].filter(a => vis(a) && re.test((a.getAttribute('href') || '').replace(/^.*#/, '#')) && !a.closest('header, aside[aria-label=Sidebar], nav[aria-label=Places]'))
    .filter(a => { const h = a.getAttribute('href'); if (seen.has(h)) return false; seen.add(h); return true; });
  const inMain = a.filter(x => x.closest('main, dialog')); const t = (inMain.length ? inMain : a)[nth || 0]; if (!t) return null; t.setAttribute('data-wf', '1'); return t.innerText.replace(/\s+/g, ' ').trim().slice(0, 50); }"""
# suggestion / result links for a typed search (they sit beside the "See all results" link, or in the results page)
JS_PICK = r"""(src) => { document.querySelectorAll('[data-wf]').forEach(e => e.removeAttribute('data-wf'));
  const re = new RegExp(src, 'i'), vis = e => e.getClientRects().length > 0;
  // only the search's own links: the suggestion list (the one holding "See all results"), or the results page's work column; never the page behind the box
  const see = [...document.querySelectorAll('a[href]')].find(a => vis(a) && /^See all results/i.test(a.innerText.trim()));
  const root = see ? see.parentElement : (/^#\/search/.test(location.hash) ? document.querySelector('main') : null); if (!root) return null;
  const a = [...root.querySelectorAll('a[href]')].filter(a => vis(a) && !/^See all results/i.test(a.innerText.trim()) && (re.test((a.getAttribute('href') || '').replace(/^.*#/, '#')) || re.test(a.innerText.replace(/\s+/g, ' ').trim())));
  const t = a[0]; if (!t) return null; t.setAttribute('data-wf', '1'); return t.innerText.replace(/\s+/g, ' ').trim().slice(0, 50); }"""

def slug(s): return re.sub(r'[^a-z0-9]+', '-', (s or '').lower()).strip('-')[:36] or 'x'

class Walk:
  """One task's walk in a fresh browser: counts clicks, dead ends and back-outs, lands (scan + screenshot) on every new screen,
  and remembers the steps so a landing can be replayed for T10."""
  def __init__(s, br, who, dev, task, variant='', shots=True, start='/'):
    w, h = SIZE[dev]; s.br, s.who, s.dev, s.task, s.variant = br, who, dev, task, variant
    s.p = br.page(who, w, h); s.mobile = dev == 'phone'; s.shots = shots
    s.clicks = s.dead = s.back_outs = 0; s.steps, s.landings, s.notes, s.n = [], [], [], 0
    s.start = start; s.p.open(start, FLOWX); s.prep()
    if shots: s.land('start')
  def prep(s):
    try: s.p.page.evaluate(JS_PREP)
    except Exception: pass
  def close(s):
    try: s.p.close()
    except Exception: pass
  def note(s, t):
    if t not in s.notes: s.notes.append(t)
  def hash(s): return s.p.hash()
  def sig(s):
    try: return s.p.page.evaluate("() => [location.hash, document.querySelectorAll('dialog[open]').length, (document.getElementById('toast')?.innerText || '').length, (document.querySelector('main')?.innerText || '').length].join('|')")
    except Exception: return ''
  def scan(s):
    try: return s.p.page.evaluate(JS_SCAN)
    except Exception: return {}
  def land(s, why):
    """Record the screen the walk is on now: signs 0-3, controls above the first item, words, screenshot."""
    s.prep(); sc = s.scan()
    if not sc: return None
    signs = int(bool(sc['title'])) + int(bool(sc['hl'])) + int(bool(sc['backNamed']))
    try: words = s.p.measure()['words']
    except Exception: words = -1
    s.n += 1; shot = ''
    if s.shots:
      shot = os.path.join(SHOTS, f"{s.who}-{s.dev}-{s.task}{('-' + slug(s.variant)) if s.variant else ''}-{s.n:02d}-{slug(sc['title'] or sc['hash'])}.png")
      try: s.p.shot(shot)
      except Exception: shot = ''
    kind = (re.match(r'#/([a-z]+)', sc['hash'] or '#/') or [None, 'today'])[1] if sc['hash'] not in ('#/', '') else 'today'
    top = kind in TOPLEVEL and not sc['hasBack']        # a place with nowhere "back" to go (a screen that should have a Back and lacks one is not excused)
    rec = {'why': why, 'hash': sc['hash'], 'kind': kind, 'title': sc['title'], 'highlight': sc['hl'], 'back': sc['back'], 'signs': signs,
           'title_ok': bool(sc['title']), 'highlight_ok': bool(sc['hl']), 'back_named': bool(sc['backNamed']), 'back_present': bool(sc['hasBack']),
           'top_level': top, 'signs_applicable': signs if not top else int(bool(sc['title'])) + int(bool(sc['hl'])), 'max_applicable': 2 if top else 3,
           'above_first_item': sc['above'], 'has_item': sc['hasItem'], 'words': words, 'hscroll': sc['hscroll'], 'shot': shot,
           'steps': list(s.steps), 'start': s.start}
    s.landings.append(rec)
    if s.task not in ('prep', 'T10') and not s.variant.startswith('back'): POOL.setdefault((s.who, s.dev), []).append(rec)
    return rec

  # -- finding and pressing --
  def tag(s, js, arg=None):
    try: return s.p.page.evaluate(js, arg) if arg is not None else s.p.page.evaluate(js)
    except Exception: return None
  def place(s, name):
    """The sidebar's (or the phone bar's) link for a place, by its words."""
    # a place's name can carry its count ("Today 2"), so the name is matched from its start
    name = B_PLACE.get(name, name) if ARGS.flow == '2' else name    # version B renames two places; the route stays the same
    return L.find(s.p.page, rx(rf'^\s*{re.escape(name)}(\s*\d+.*)?$'), roles=('link', 'button'), scope='nav[aria-label="Places"], aside[aria-label="Sidebar"]')
  def resolve(s, step):
    t = step['t']
    if t == 'place': return s.place(step['name'])
    if t == 'name':
      names = [rx(n) if isinstance(n, str) else n for n in step['names']]
      return L.find(s.p.page, *names, roles=tuple(step.get('roles') or ('link', 'button', 'tab')), scope=step.get('scope'))
    if t in ('find', 'href', 'pick'):
      got = s.tag(JS_FIND[step['key']]) if t == 'find' else s.tag(JS_HREF if t == 'href' else JS_PICK, [step['rx'], step.get('nth', 0)] if t == 'href' else step['rx'])
      return s.p.page.locator('[data-wf]').first if got else None
    return None
  def act(s, step, why='', land=True):
    """Press one thing found by `step`; counts a click; lands when the address changed. False when it is not on the screen."""
    if step['t'] == 'search': return s.search(step)
    el = s.resolve(step)
    if el is None: return False
    before = s.sig(); h0 = s.hash()
    try: el.scroll_into_view_if_needed(timeout=2000)
    except Exception: pass
    try: el.click(timeout=4000)
    except Exception: s.note(f'could not press {why or step}'); return False
    s.clicks += 1; s.steps.append(step); s.p.page.wait_for_timeout(300); s.p.ready(4000)
    if land and s.hash() != h0: s.land(why or step.get('name') or step.get('key') or step['t'])
    return True
  def search(s, step):
    """Open the search (the box on a laptop, the Search button on a phone), type, press the matching suggestion/result: 2 clicks."""
    pg = s.p.page; q = step['q']
    if s.mobile:
      b = L.find(pg, 'Search', roles=('link', 'button'))
      if b is None: return False
      b.click(); s.p.ready(3000)
    box = pg.locator('input[type=search]')       # a search box is found by its kind (Playwright's searchbox role misses this form)
    el = None
    for i in range(box.count()):
      if box.nth(i).is_visible(): el = box.nth(i); break
    if el is None: return False
    if not s.mobile: el.click()
    el.fill(q); pg.wait_for_timeout(750)
    s.clicks += 1; s.steps.append({'t': 'search', 'q': q, 'pick': step['pick'], 'stage': 'box'})
    got = s.tag(JS_PICK, step['pick'])
    if not got:                       # nothing in the suggestions: press Enter, as a person would, and look in the results
      el.press('Enter'); pg.wait_for_timeout(700); s.p.ready(4000); s.land('search results')
      s.clicks += 1; s.note('no suggestion matched; used Enter and the results page')
      got = s.tag(JS_PICK, step['pick'])
      if not got: return False
    h0 = s.hash()
    try: pg.locator('[data-wf]').first.click(timeout=4000)
    except Exception: return False
    s.clicks += 1; s.steps[-1] = {'t': 'search', 'q': q, 'pick': step['pick'], 'stage': 'done'}
    pg.wait_for_timeout(300); s.p.ready(4000)
    if s.hash() != h0: s.land('search: ' + q)
    return True
  def at(s, hash_rx): return bool(re.search(hash_rx, s.hash()))
  def back_to_place(s, name):
    """Return to where an attempt began by the place's own link: a back-out (one click)."""
    if s.act({'t': 'place', 'name': name}, f'back out to {name}'): s.back_outs += 1; return True
    s.p.nav('/' if name == 'Today' else f'/{name.lower()}'); s.clicks += 1; s.back_outs += 1; s.note(f'{name} is not in this device\'s bar: backed out by address (counted as a click)'); return True

def replay(w, steps):
  """Redo a recorded click path in a fresh walk (T10 stands on a landing by walking to it, as a person does)."""
  for st in steps:
    if st['t'] == 'search':
      if st.get('stage') == 'box': continue
      if not w.search(st): return False
    elif not w.act(st, land=False): return False
  return True

def S(t, **k): return dict(t=t, **k)
def NAME(*n, **k): return S('name', names=list(n), **k)
def PLACE(n): return S('place', name=n)
def HREF(r, nth=0): return S('href', rx=r, nth=nth)

# ---- the people, their bills ----
SNAP = json.load(open(os.path.join(os.path.dirname(HERE), 'demo', 'snapshot.json'))) if os.path.exists(os.path.join(os.path.dirname(HERE), 'demo', 'snapshot.json')) else {}
def snap_facts(who):
  """From the demo snapshot: the person's advocate id, bills assigned to them, bills on any list, HB 1562's hearing and a bill they neither own nor list."""
  if not SNAP: return {}
  adv = next((a for a in SNAP['advocates'] if a['initials'] == who), None)
  bills = {b['id']: b for b in SNAP['bills']}; num = {b['bill_number']: b for b in SNAP['bills']}
  mine = {a['bill_id'] for a in SNAP['assignments'] if adv and a['advocate_id'] == adv['id']}
  listed = {lb.get('bill_id') for lb in SNAP.get('listBills', [])}
  hb = num.get(HB1562)
  hear = None
  if hb:
    hs = sorted([h for h in SNAP['hearings'] if h['bill_id'] == hb['id']], key=lambda h: h['scheduled_at'])
    hear = next((h for h in hs if h['scheduled_at'][:10] == '2026-03-16'), hs[0] if hs else None)
  strangers = {a['id'] for a in SNAP['advocates'] if a['initials'] in ('RK', 'JM', 'PT', 'MR')}
  theirs = {a['bill_id'] for a in SNAP['assignments'] if a['advocate_id'] in strangers}
  # one bill for everybody: tracked, named, assigned only to people outside the five we walk, on no list, not HB 1562
  owned5 = {a['bill_id'] for a in SNAP['assignments'] if a['advocate_id'] not in strangers}
  other = next((b for b in sorted(SNAP['bills'], key=lambda b: b['bill_number']) if b.get('tracked') and b['id'] in theirs and b['id'] not in owned5 and b['id'] not in listed
                and b.get('nickname') and b['bill_number'] != HB1562 and re.match(r'^[HS]B\d{3,4}$', b['bill_number'])), None)
  issue_of = {}
  for bi in SNAP.get('billIssues', []): issue_of.setdefault(bi['bill_id'], bi['issue_id'])
  return {'hb1562': hb, 'hearing': hear, 'other': other, 'mine': mine, 'issue_id': issue_of.get(hb['id']) if hb else None,
          'issue_name': next((i['name'] for i in SNAP['issues'] if hb and i['id'] == issue_of.get(hb['id'])), '')}
def billrx(num): return rf'#/bill/(\d{{4}}/)?{re.escape(num)}(\?.*)?$'
def pretty(num): return re.sub(r'^([A-Z]+)(\d+)$', r'\1 \2', num)

ROWS = []
POOL = {}      # (person, device) -> every screen landed on, with the clicks that led there (T10 walks back to them)
def record(w, task, variant='', reached=None, met=None, why='', extra=None, clicks=None, dead=None, back=None):
  ls = w.landings[1:] if len(w.landings) > 1 else w.landings        # the first landing is the start itself
  sg = [l['signs'] for l in ls] or [0]; ap_ = [l['signs_applicable'] for l in ls] or [0]; mx = [l['max_applicable'] for l in ls] or [3]
  last = ls[-1] if ls else {}
  row = {'who': w.who, 'device': w.dev, 'task': task, 'variant': variant, 'flow': ARGS.flow or '1',
         'clicks': w.clicks if clicks is None else clicks, 'dead_ends': w.dead if dead is None else dead, 'back_outs': w.back_outs if back is None else back,
         'reached': bool(reached), 'met_target': bool(met), 'target_note': why,
         'signs_min': min(sg), 'signs_mean': round(sum(sg) / len(sg), 2), 'signs_applicable_min': min(ap_), 'all_applicable_full': all(a == m for a, m in zip(ap_, mx)),
         'landing_count': len(ls), 'above_first_item': last.get('above_first_item'), 'words': last.get('words'),
         'landing': {k: last.get(k) for k in ('hash', 'title', 'highlight', 'back', 'signs', 'shot')}, 'landings': [{k: v for k, v in l.items() if k not in ('steps', 'start')} for l in ls],
         'notes': w.notes}
  if extra: row.update(extra)
  ROWS.append(row)
  tag = f"{w.who} {w.dev[:3]} {task}{(':' + variant) if variant else ''}"
  print(f"{tag:<26} clicks {row['clicks']:>2}  dead {row['dead_ends']}  back {row['back_outs']}  reached {'yes' if row['reached'] else 'NO ':<3}  signs {row['signs_min']}/3 (mean {row['signs_mean']})  above {row['above_first_item']}  words {row['words']}  {'ok' if row['met_target'] else 'MISS'}  {('| ' + '; '.join(w.notes)) if w.notes else ''}", flush=True)
  return row

# ---- finishing a step ----
FINISH = [rx(rf'^\s*{n}\b') for n in ('Approve', 'Resubmit', 'Mark filed', 'File', 'Send for approval', 'Submit', 'Save', 'Post', 'Publish', 'Mark done', 'Done', 'Confirm')]   # in the order a person would trust; never "Send back"
# Version B says a step is done with Today's "Done: … Next: …" banner (data-vbdone) in place of a toast: either counts.
def toast(w): return w.p.page.evaluate("() => (document.getElementById('toast')?.innerText || document.querySelector('[data-vbdone]')?.innerText || '').replace(/\\s+/g, ' ').trim()")
def finish(w, limit=3):
  """After the first press: if a sheet or page asks for more (a note, a Save), do the one obvious finishing press, and another only while a sheet stays open. Returns the toast or ''."""
  pg = w.p.page
  for _ in range(limit):
    pg.wait_for_timeout(600)               # a sheet can open a moment after the press
    dlg = pg.locator('dialog[open]'); root = dlg.last if dlg.count() else pg.locator('main')
    if toast(w) and not dlg.count(): break                  # the app has already said it is done
    for sel in ('textarea', 'input[type=text]'):
      loc = root.locator(sel)
      for i in range(min(loc.count(), 3)):
        e = loc.nth(i)
        try:
          if e.is_visible() and not e.input_value(): e.fill('Practice note from the wayfinding walk')
        except Exception: pass
    el = L.find(pg, *FINISH, roles=('button',), scope=None if dlg.count() else 'main')
    if el is None:
      names = [n.strip() for n in root.locator('button:visible').all_inner_texts() if n.strip()][:6]
      if dlg.count() and names: w.note('the sheet asks for a choice, not a press: ' + ' / '.join(names))
      break
    h0, was_open = w.hash(), bool(dlg.count())
    try:
      if re.match(r'\s*Approve', el.inner_text()): pg.wait_for_timeout(1200)       # the app's Approve takes a second to arm (the journeys wait too)
      el.click(timeout=4000)
    except Exception: break
    w.clicks += 1; w.steps.append({'t': 'name', 'names': [r'^\\s*(Approve|Resubmit|Mark filed|File|Send for approval|Submit|Save|Post|Publish|Mark done|Done|Confirm)\\b'], 'roles': ('button',), 'scope': None if was_open else 'main'}); pg.wait_for_timeout(500); w.p.ready(4000)
    if w.hash() != h0: w.land('finished')
    if not (was_open and pg.locator('dialog[open]').count()): break          # one finishing press; another only for a sheet that stayed open
  return toast(w)
def next_card(w):
  """Is Today's "Your next step" card in the first screen, and what does it say?"""
  return w.p.page.evaluate("""() => { const h = [...document.querySelectorAll('main h2')].find(x => /your next step/i.test(x.innerText)); if (!h) return {visible: false, title: ''};
    const r = h.getBoundingClientRect(); const t = (h.nextElementSibling?.innerText || h.parentElement?.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 90);
    return {visible: r.top < innerHeight && r.bottom > 0, title: t}; }""")

# ---- the tasks ----
def t1(br, who, dev):
  """T1 From Today, do the first step and land back on Today."""
  w = Walk(br, who, dev, 'T1'); before = next_card(w)
  first = w.tag(JS_FIND['first_step'])
  if not first:
    w.note('Today has no first step to press'); record(w, 'T1', reached=False, why='no first step'); return w.close()
  w.act(S('find', key='first_step'), first); w.dead += 0 if (w.hash() != '#/' or toast(w) or w.p.page.locator('dialog[open]').count()) else 1
  w.note(f'first step: "{first}"'); there0 = w.clicks
  done = finish(w); there = w.clicks
  fin = bool(done) or w.hash() != '#/' and w.clicks > there0 or (w.hash() == '#/' and not w.p.page.locator('dialog[open]').count() and w.clicks > 0)
  if not done: w.note('no confirmation shown after the finishing press')
  back = 0
  for _ in range(3):                      # to Today: its own link if the screen has one, otherwise the screen's Back / close
    if w.hash() == '#/': break
    c0 = w.clicks
    if w.act(PLACE('Today'), 'back to Today') or w.act(S('find', key='back'), 'Back / close'): back += w.clicks - c0
    else: w.note('no way back to Today on this screen'); break
  w.p.ready(3000); w.prep(); after = next_card(w)
  if w.hash() == '#/': w.land('Today again')
  on_today = w.hash() == '#/'
  reached = fin and on_today and after['visible']
  met = reached and there <= 2 and back <= 2 and w.dead == 0
  record(w, 'T1', reached=reached, met=met, why='<=2 clicks each way, finishing returns to Today with the next step in view',
         extra={'clicks_there': there, 'clicks_back': back, 'finished': fin, 'confirmation': done[:60], 'ended_on_today': on_today, 'next_step_visible': after['visible'],
                'next_step_changed': after['title'] != before['title'], 'next_step_now': after['title'][:70]}, clicks=there + back)
  w.close()

def first_step_bill(br, who, dev):
  """The bill number on the person's own first step (their "what to do next"), found on Today; None when Today has none."""
  w = Walk(br, who, dev, 'prep', shots=False)
  n = w.p.page.evaluate("""() => { const h = [...document.querySelectorAll('main h2')].find(x => /your next step/i.test(x.innerText)); if (!h) return null;
    const a = [...(h.parentElement?.parentElement || document).querySelectorAll('a[href*="#/bill/"]')][0]; return a ? a.getAttribute('href').replace(/^.*#\\/bill\\//, '').replace(/^\\d{4}\\//, '').split('/')[0].split('?')[0] : null; }""")
  w.close(); return n

def t2(br, who, dev, bill):
  """T2 From a bill page reached by search, find what you personally should do next."""
  if not bill: ROWS.append({'who': who, 'device': dev, 'task': 'T2', 'skipped': 'no first step on Today'}); return
  w = Walk(br, who, dev, 'T2'); ok = w.search(S('search', q=pretty(bill), pick=billrx(bill)))
  if not ok: w.dead += 1; record(w, 'T2', reached=False, why='reached the bill by search'); return w.close()
  found = w.p.page.evaluate("""(first) => { const m = document.querySelector('main'); const els = [...m.querySelectorAll('*')].filter(e => e.children.length < 3 && /^what.s next/i.test((e.innerText || '').trim().split('\\n')[0]) && e.getClientRects().length);
    if (!els.length) return {found: false}; const e = els[0]; const r = e.getBoundingClientRect(); const box = e.parentElement; const t = (box.innerText || '').replace(/\\s+/g, ' ');
    return {found: true, in_first_screen: r.top < innerHeight, y: Math.round(r.top + scrollY), line: t.slice(0, 140), personal: new RegExp('\\\\b(you|your|' + first + ')\\\\b', 'i').test(t.slice(0, 200))}; }""", {'NT': 'Nate', 'KV': 'Kevin', 'SY': 'Saya', 'PH': 'Patti', 'JS': 'Jess'}[who])
  reached = found.get('found') and found.get('personal')
  if not found.get('found'): w.note('no "What\'s next" block on the bill page')
  elif not found.get('personal'): w.note('"What\'s next" is there but does not say it is for you')
  record(w, 'T2', reached=reached, met=reached and found.get('in_first_screen') and w.dead == 0, why='next step for you is on the bill page\'s first screen',
         extra={'bill': bill, 'whats_next_found': found.get('found', False), 'whats_next_in_first_screen': found.get('in_first_screen', False), 'whats_next_line': found.get('line', '')})
  w.close()

def t3(br, who, dev, bill):
  """T3 After finishing a step anywhere, where does the app leave you, and is the next step visible? Two places: a Today row, a bill page."""
  for variant, key in (('row', 'row_button'), ('bill', 'whats_next')):
    start = '/' if key == 'row_button' else (f'/bill/{bill}' if bill else None)
    if start is None: continue
    w = Walk(br, who, dev, 'T3', variant, start=start)
    btn = w.tag(JS_FIND[key])
    if not btn:
      w.note('no button to press here'); ROWS.append({'who': who, 'device': dev, 'task': 'T3', 'variant': variant, 'skipped': 'no step button on this screen'}); print(f'{who} {dev[:3]} T3:{variant}  skipped (no step button)'); w.close(); continue
    w.act(S('find', key=key), btn); w.note(f'pressed "{btn}"'); h_before = w.hash()
    done = finish(w); fin = bool(done) or w.hash() != h_before
    sc = w.scan(); nc = next_card(w) if sc.get('hash') == '#/' else {'visible': False}
    kind = 'Today card' if nc.get('visible') else ('the bill\'s own next step' if re.search(r'#/bill/', sc.get('hash', '')) and w.p.page.evaluate("() => /what.s next|next step/i.test(document.querySelector('main')?.innerText || '')") else 'none')
    w.land('after finishing')
    on_today = sc.get('hash') == '#/'
    record(w, 'T3', variant, reached=fin, met=fin and on_today and nc.get('visible', False) and w.dead == 0, why='finishing leaves you on Today with the next step in view',
           extra={'finished': fin, 'confirmation': done[:60], 'left_on': sc.get('title') or sc.get('hash'), 'left_on_hash': sc.get('hash'), 'left_on_today': on_today, 'next_step_visible': kind != 'none', 'next_step_kind': kind})
    w.close()

def route_to(w, name, first):
  """Press the first stop of a route: the place's own link, or on a phone (whose bar has five tabs) More and then the place."""
  if first:
    if w.act(PLACE(name), f'try {name}'): return True
    if w.mobile and name not in ('Today', 'Hearings', 'Testimony', 'Issues', 'More'):
      w.note(f'{name} is not in the phone bar: tried More'); return w.act(PLACE('More'), 'More') and w.act(NAME(name, scope='main'), f'try {name}')
    return False
  return w.act(NAME(name, scope='main'), f'try {name}')

def browse(w, goal_rx, start_name):
  """Look for the goal on this screen, then try each route in ROUTE_ORDER from the start place, backing out of the failures."""
  if w.act(HREF(goal_rx), 'goal link on the start screen'): return w.at(goal_rx)
  for route in ROUTE_ORDER:
    if route[0] == start_name: continue
    c0 = w.clicks; hit = False
    for k, name in enumerate(route):
      if not route_to(w, name, k == 0): w.note(f'no "{name}" control'); break
      if w.at(goal_rx): hit = True; break
      if w.act(HREF(goal_rx), 'goal link'): hit = w.at(goal_rx); break
    if hit: return True
    w.dead += w.clicks - c0                                            # every click of a route that did not get there
    if w.clicks > c0: w.back_to_place(start_name)
  return False

def find_bill(br, who, dev, task, variant, num, start_name):
  """Find a bill two ways from the same start: by browsing (ROUTE_ORDER) and by one search. Browse numbers fill the row; search's ride along."""
  start = '/' if start_name == 'Today' else '/' + start_name.lower()
  w = Walk(br, who, dev, task, variant, start=start)
  got = browse(w, billrx(num), start_name)
  if got: w.land('found')
  b_clicks, b_dead, b_back = w.clicks, w.dead, w.back_outs; w.close()
  s = Walk(br, who, dev, task, variant + '-search', start=start)
  sok = s.search(S('search', q=pretty(num), pick=billrx(num))) and s.at(billrx(num)); s_clicks = s.clicks; s.close()
  met = (got and b_clicks <= 3 and b_dead == 0) or sok
  w.note(f'search: {"reached" if sok else "NOT reached"} in {s_clicks} clicks (the box, the suggestion)')
  return record(w, task, variant, reached=got or sok, met=met, why='browse <=3 clicks with 0 dead ends, or one search', clicks=b_clicks, dead=b_dead, back=b_back,
                extra={'browse_reached': bool(got), 'browse_clicks': b_clicks, 'search_reached': bool(sok), 'search_clicks': s_clicks, 'bill': num, 'start': start_name})

def t4(br, who, dev):
  for start in ('Today', 'Hearings', 'Outreach'): find_bill(br, who, dev, 'T4', start, HB1562, start)

def t5(br, who, dev, f):
  """T5 Find the issue a bill belongs to, from the bill's page and from its hearing card."""
  if not f.get('hb1562') or not f.get('issue_id'):
    ROWS.append({'who': who, 'device': dev, 'task': 'T5', 'skipped': 'HB 1562 or its issue is not in the practice data'}); return
  goal = rf'#/issue/{f["issue_id"]}'; ISSUEWORD = r'\bissue\b'
  starts = [('bill page', f'/bill/{HB1562}')] + ([('hearing card', f'/hearing/{f["hearing"]["id"]}')] if f.get('hearing') else [])
  for variant, start in starts:
    w = Walk(br, who, dev, 'T5', variant, start=start)
    # a person looks for a way to the issue on this screen: where it goes, then the word "issue"
    ok = (w.act(HREF(goal), 'a link to the issue') or w.act(NAME(ISSUEWORD, roles=('link', 'button')), 'a control saying "issue"')) and w.at(goal)
    if not ok and variant == 'hearing card':
      if w.act(HREF(billrx(HB1562)), 'the bill, from the hearing card'):
        ok = (w.act(HREF(goal), 'the issue link') or w.act(NAME(ISSUEWORD, roles=('link', 'button')), 'a control saying "issue"')) and w.at(goal)
      else: w.note('the hearing card has no link to HB 1562')
    if not ok and w.clicks: w.dead += 1
    if ok: w.land('the issue')
    record(w, 'T5', variant, reached=ok, met=ok and w.clicks <= 3 and w.dead == 0, why='issue in <=3 clicks, 0 dead ends', extra={'issue': f.get('issue_name')})
    w.close()

def my_issue(w):
  """The first issue on the person's own list (Issues > My issues): its address and name; None when they own none."""
  w.p.nav('/issues'); w.prep()
  return w.p.page.evaluate("""() => { const a = [...document.querySelectorAll('main a[href*="#/issue/"]')].find(a => a.getClientRects().length); return a ? {href: a.getAttribute('href').replace(/^.*#/, ''), name: a.innerText.split('\\n')[0].replace(/\\s+/g, ' ').trim().slice(0, 60)} : null; }""")

SUBGOALS = [('bills', r'#/bill/', rx(r'\bbills?\b'), 'its bills'), ('hearing', r'#/hearing/', rx(r'\bhearing\b'), 'its next hearing'),
            ('testimony', r'#/(testimony|review)', rx(r'\btestimony\b'), 'its testimony'), ('outreach', r'#/(outreach|email|list|supporters)', rx(r'\b(outreach|supporters|public ask|action alert|email|rally)\b'), 'its outreach')]
if ARGS.flow == '2':   # in version B the issue's own tab (#/issue/<id>/hearings ...) lists that work with its actions: reaching it counts
  SUBGOALS = [(v, rf'{g}|#/issue/[^/?]+/{v}s?\b', w, l) for v, g, w, l in SUBGOALS]
def t6(br, who, dev):
  """T6 From an issue you own, reach its bills, its next hearing, its testimony and its outreach."""
  w0 = Walk(br, who, dev, 'prep', shots=False); iss = my_issue(w0); w0.close()
  if not iss:
    ROWS.append({'who': who, 'device': dev, 'task': 'T6', 'skipped': 'owns no issue in the practice data'}); print(f'{who} {dev[:3]} T6  skipped (owns no issue)'); return
  anybill = r'#/bill/(\d{4}/)?[A-Z]+\d+(\?.*)?$'
  for variant, goal, words, label in SUBGOALS:
    w = Walk(br, who, dev, 'T6', variant, start=iss['href']); w.note(f'issue: {iss["name"]}'); ok = False; route = ''
    # direct: a control on the issue page itself that goes there (by where it goes, then by its words)
    if w.act(HREF(goal), f'{label}, from the issue'): ok = w.at(goal); route = 'a link on the issue'
    if not ok and w.hash() == '#' + iss['href'] and w.act(NAME(words, roles=('link', 'button'), scope='main'), f'{label}, by its words'): ok = w.at(goal); route = 'a control named for it'
    if not ok and variant != 'bills':                          # via its bills: a person opens one, looks, and tries the next (up to three)
      for k in range(3):
        if w.hash() != '#' + iss['href']: w.back_outs += 1; w.clicks += 1; w.p.nav(iss['href']); w.prep()       # back out to the issue
        c0 = w.clicks
        if not w.act(HREF(anybill, k), f'bill {k + 1} of the issue'): break
        if w.act(HREF(goal), f'{label}, from the bill') or w.act(NAME(words, roles=('link', 'button', 'tab'), scope='main'), f'{label}, by words on the bill'):
          ok = w.at(goal); route = f'through bill {k + 1} of the issue'
        if not ok and variant == 'testimony' and w.at(r'#/bill/') and w.p.page.evaluate("() => /\\btestimony\\b/i.test(document.querySelector('main')?.innerText || '')"):
          ok, route = True, f'through bill {k + 1} (its page carries the testimony; a guess)'; w.note('testimony counted as reached on the bill page, which holds the testimony block')
        if ok: break
        w.dead += w.clicks - c0
      if not ok: w.note('no bill of the issue led to ' + label)
    record(w, 'T6', variant, reached=ok, met=ok and w.clicks <= 3 and w.dead == 0, why='<=3 clicks (1 is the redesign\'s aim), 0 dead ends',
           extra={'route': route, 'issue': iss['name'], 'one_click': bool(ok and w.clicks == 1)})
    w.close()

def t7(br, who, dev, f):
  """T7 Type a bill number, an issue name, a legislator and a committee into the search: does each open directly?"""
  qs = [('bill', 'HB 1562', billrx(HB1562)), ('issue', 'Free school meals for every student', rf'#/issue/{L.ISSUE}'), ('legislator', 'Takayama', rf'#/legislator/{L.LEGISLATOR}'),
        ('committee', 'House Transportation', r'^(House|Senate) Transportation\b|\bTransportation committee\b')]
  for variant, q, pick in qs:
    w = Walk(br, who, dev, 'T7', variant)
    ok = w.search(S('search', q=q, pick=pick))
    direct = ok and (w.at(pick) if variant != 'committee' else True)
    if variant == 'committee' and not ok: w.note('search lists legislators and bills with "Transportation" in them; it offers no committee to open')
    if not ok: w.dead += 1
    record(w, 'T7', variant, reached=direct, met=direct and w.dead == 0, why='opens the thing directly from one search', extra={'typed': q})
    w.close()

def t8(br, who, dev, f):
  """T8 Find a bill you do not own and are not on any list for (starting from Today)."""
  o = f.get('other')
  if not o: ROWS.append({'who': who, 'device': dev, 'task': 'T8', 'skipped': 'no such bill in the practice data'}); return
  row = find_bill(br, who, dev, 'T8', 'Today', o['bill_number'], 'Today'); row['extra_bill_title'] = o.get('nickname')

def path_clicks(w, steps):
  """Walk a fixed path and report whether every click moved."""
  for st in steps:
    if not w.act(st[0], st[1]): w.note(f'could not {st[1]}'); w.dead += 1; return False
  return True

def t9(br, who, dev, task):
  """T9 / T11 After three clicks deep from Today, name the place you are in from the screen alone (title, highlight, Back)."""
  paths = {'issues path': [(PLACE('Issues'), 'Issues'), (NAME('All issues', scope='main'), 'All issues'), (HREF(r'#/issue/'), 'first issue')],
           'hearings path': [(PLACE('Hearings'), 'Hearings'), (HREF(r'#/hearing/'), 'first hearing'), (HREF(r'#/bill/(\d{4}/)?[A-Z]+\d+$'), 'first bill')]}
  for variant, steps in paths.items():
    w = Walk(br, who, dev, task, variant); ok = path_clicks(w, steps)
    ls = w.landings[1:]
    full = bool(ls) and all(l['signs'] == 3 for l in ls)
    full_top = bool(ls) and all(l['signs'] == 3 or (l.get('top_level') and l['signs'] == 2) for l in ls)   # a top-level place needs no Back (baseline.md's 96% line)
    record(w, task, variant, reached=ok and len(ls) >= 3, met=ok and full and w.dead == 0, why='3 of 3 signs on every screen', extra={'path': ' > '.join(s[1] for s in steps), 'met_excusing_top_level': ok and full_top and w.dead == 0})
    w.close()

def t10(br, who, dev, task, pool):
  """T10 / T11 Press the app's Back from each kind of screen landed on so far: does it say where it goes, and go there?"""
  seen, picks = set(), []
  for l in pool:
    if l['kind'] in seen or l['kind'] == 'today' or l['top_level']: continue
    seen.add(l['kind']); picks.append(l)
  for l in picks[:7]:
    v = 'back from ' + l['kind']
    w = Walk(br, who, dev, task, v, start=l['start'])
    if l['steps'] and not replay(w, l['steps']):
      w.note('could not walk back to this screen'); record(w, task, v, reached=False, why='Back names and reaches where it goes', clicks=0); w.close(); continue
    sc = w.scan(); h0 = sc.get('hash'); label = sc.get('backWords') or sc.get('back')
    w.land('before Back')
    if not sc.get('hasBack'):
      w.note('this screen has no Back'); w.dead += 1
      record(w, task, v, reached=False, why='Back names and reaches where it goes', clicks=0, extra={'screen': sc.get('title'), 'back_label': ''}); w.close(); continue
    w.act(S('find', key='back'), 'Back')
    after = w.scan(); moved = after.get('hash') != h0
    said = (label or '').lower().strip('· '); where = ' '.join([after.get('titles') or '', after.get('title') or '', after.get('hl') or '', after.get('hash') or '']).lower()
    sq = lambda x: re.sub(r'\W+', '', x)          # "HB 1562", "HB1562" and "#/bill/HB1562" are the same words
    names_ok = bool(sc.get('backNamed')) and bool(said) and (sq(said) in sq(where) or any(len(tok) > 3 and tok in where for tok in re.split(r'\W+', said)))
    if not (moved and names_ok): w.dead += 1
    record(w, task, v, reached=moved and names_ok, met=moved and names_ok and w.dead == 0, why='Back names where it goes and goes there', clicks=1,
           extra={'screen': sc.get('title'), 'back_label': sc.get('back'), 'back_goes_to': after.get('title') or after.get('hash'), 'back_moved': moved, 'label_matches_destination': names_ok})
    w.close()

# ---- targets and the summary ----
TARGETS = {'T1': 'first step done and back on Today, <=2 clicks each way, 0 dead ends', 'T2': 'the bill page shows your own next step, in the first screen',
           'T3': 'finishing leaves you on Today with the next step in view', 'T4': 'HB 1562 in <=3 clicks (browse) or one search, 0 dead ends',
           'T5': 'issue in <=3 clicks', 'T6': 'bills, hearing, testimony, outreach each <=3 clicks (aim: 1)', 'T7': 'each thing opens directly from the search',
           'T8': 'a bill you do not own in <=3 clicks (browse) or one search', 'T9': '3 of 3 signs on every screen', 'T10': 'Back names where it goes and goes there',
           'T11': '3 of 3 signs and a Back that works, on the phone'}
def summary(rows):
  out = []; print('\n== Summary against METHOD.md targets (rows meeting / rows walked) ==')
  for t in sorted({r['task'] for r in rows if r['task'] != 'ERR'}, key=lambda x: int(x[1:])):
    rs = [r for r in rows if r['task'] == t and 'skipped' not in r]
    if not rs: continue
    met = sum(r['met_target'] for r in rs); reached = sum(r['reached'] for r in rs); dead = sum(r['dead_ends'] for r in rs)
    cl = [r['clicks'] for r in rs if r['reached']]; med = statistics.median(cl) if cl else '-'
    sg = [r['signs_min'] for r in rs]; fullrows = sum(r['all_applicable_full'] for r in rs)
    if t in ('T4', 'T8'):                                # browsing and searching are different stories: never let search hide that browsing fails
      bro = [r for r in rs if r.get('browse_reached')]; sea = [r for r in rs if r.get('search_reached')]
      cl = [r['clicks'] for r in bro]; med = statistics.median(cl) if cl else '-'; spent = statistics.median([r['clicks'] for r in rs if not r.get('browse_reached')] or [0])
      dead = sum(r['dead_ends'] for r in rs); reached = len(bro)
      extra = f" · BROWSE reached {len(bro)}/{len(rs)} (median {med} clicks when it did; {spent} clicks spent when it did not) · SEARCH reached {len(sea)}/{len(rs)} in 2 clicks"
    else: extra = ''
    line = f"{t:<4} {met:>3}/{len(rs):<3} meet it · reached {reached}/{len(rs)} · median clicks {med} · dead ends {dead} · worst signs {min(sg)}/3 · screens with every applicable sign {fullrows}/{len(rs)}{extra}   [{TARGETS[t]}]"
    print(line); out.append({'task': t, 'rows': len(rs), 'met': met, 'reached': reached, 'median_clicks': med, 'dead_ends': dead, 'worst_signs': min(sg), 'rows_all_applicable_signs': fullrows, 'target': TARGETS[t], 'detail': extra.strip(' ·')})
  allland = [l for r in rows if 'landings' in r for l in r['landings']]
  if allland:
    n = len(allland); f3 = sum(l['signs'] == 3 for l in allland); fa = sum(l['signs_applicable'] == l['max_applicable'] for l in allland)
    print(f"All {n} landings: all three signs on {f3} ({round(100 * f3 / n)}%); all signs that apply (top-level places excused from Back) on {fa} ({round(100 * fa / n)}%); "
          f"title {sum(l['title_ok'] for l in allland)}, highlight {sum(l['highlight_ok'] for l in allland)}, named Back {sum(l['back_named'] for l in allland)}; median controls above the first item {statistics.median([l['above_first_item'] for l in allland])}")
  return out

def table(rows):
  print('\n== Scorecard ==')
  print(f"{'who':<3} {'dev':<3} {'task':<4} {'variant':<22} {'clk':>3} {'dead':>4} {'back':>4} {'reach':>5} {'signs':>5} {'above':>5} {'words':>5}  landed on")
  for r in rows:
    if 'skipped' in r: print(f"{r['who']:<3} {r['device'][:3]:<3} {r['task']:<4} {r.get('variant', ''):<22} skipped: {r['skipped']}"); continue
    print(f"{r['who']:<3} {r['device'][:3]:<3} {r['task']:<4} {r['variant'][:22]:<22} {r['clicks']:>3} {r['dead_ends']:>4} {r['back_outs']:>4} {(('srch' if r.get('search_reached') and not r.get('browse_reached') else 'yes') if r['reached'] else 'NO'):>5} {str(r['signs_min']) + '/3':>5} {str(r['above_first_item']):>5} {str(r['words']):>5}  {(r['landing'].get('title') or r['landing'].get('hash') or '')[:40]}")

# ---- the run ----
def want(t, dev):
  """T9 is the laptop's, T11 the phone's (the same walk on the phone bar); T10 is walked on both (a phone's is reported as T11)."""
  if t == 'T11': return dev == 'phone' and (not ONLY or bool(ONLY & {'T9', 'T10', 'T11'}))
  if t == 'T9': return dev == 'laptop' and (not ONLY or 'T9' in ONLY)
  if t == 'T10': return dev == 'laptop' and (not ONLY or 'T10' in ONLY)
  return not ONLY or t in ONLY

def main():
  t0 = time.time(); os.makedirs(SHOTS, exist_ok=True)
  print(f"Staff v6 wayfinding walk · {L.HOST} · people {','.join(WHO)} · {', '.join(DEVICES)} · flow {ARGS.flow or '1 (today)'} · shots {SHOTS}\n", flush=True)
  with L.browser() as br:
    for who in WHO:
      f = snap_facts(who)
      for dev in DEVICES:
        print(f'--- {who} on the {dev} ---', flush=True)
        def run(name, fn, *a):
          try: fn(br, who, dev, *a)
          except Exception as e:
            msg = f'{type(e).__name__}: {str(e).splitlines()[0][:110]}'; print(f'!! {who} {dev} {name}: {msg}', flush=True)
            ROWS.append({'who': who, 'device': dev, 'task': 'ERR', 'variant': name, 'skipped': msg})
        bill = None
        if want('T2', dev) or want('T3', dev):
          try: bill = first_step_bill(br, who, dev)
          except Exception as e: print(f'!! {who} {dev} first step: {e}', flush=True)
        if want('T1', dev): run('T1', t1)
        if want('T2', dev): run('T2', t2, bill)
        if want('T3', dev): run('T3', t3, bill)
        if want('T4', dev): run('T4', t4)
        if want('T5', dev): run('T5', t5, f)
        if want('T6', dev): run('T6', t6)
        if want('T7', dev): run('T7', t7, f)
        if want('T8', dev): run('T8', t8, f)
        if want('T9', dev): run('T9', t9, 'T9')
        if want('T11', dev): run('T11', t9, 'T11')
        if dev == 'laptop' and want('T10', dev): run('T10', t10, 'T10', list(POOL.get((who, dev), [])))
        if dev == 'phone' and want('T11', dev): run('T11 back', t10, 'T11', list(POOL.get((who, dev), [])))
  table(ROWS); sm = summary(ROWS)
  doc = {'about': 'Staff v6 wayfinding walk (R-365): the baseline, or the proof with --flow 2. See the header of tests/staff6_wayfind.py.', 'host': L.HOST, 'flow': ARGS.flow or '1',
         'asof': 'Mon 16 Mar 2026 (practice copy)', 'ran': time.strftime('%Y-%m-%d %H:%M'), 'seconds': round(time.time() - t0), 'sizes': {k: f'{v[0]}x{v[1]}' for k, v in SIZE.items()}, 'summary': sm, 'rows': ROWS}
  os.makedirs(os.path.dirname(os.path.abspath(OUT)), exist_ok=True); json.dump(doc, open(OUT, 'w'), indent=1, ensure_ascii=False)
  print(f'\nScorecard: {OUT}\nScreenshots: {SHOTS}\n{len(ROWS)} rows in {round(time.time() - t0)}s. Misses are reported, not failed (this is a baseline): exit 0.')
  sys.exit(0)

if __name__ == '__main__': main()
