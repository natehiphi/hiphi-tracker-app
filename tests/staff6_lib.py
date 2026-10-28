# Shared parts of the Staff v6 tests (R-336 V06): serving the practice copy, the people, the clocks, the window sizes, and
# one measuring script, so staff6_budget, staff6_journeys, staff6_links, staff6_people and staff6_words count the same way.
#
# Served as tests/staff5_people.py does: V4_ROOT=<folder> serves that folder straight into the browser at https://v6.test
# (a secure context, so copy buttons work; nothing reaches the network); otherwise HOST (default http://localhost:8832,
# which CI serves). Patti (PH, follows HEAL) and Julie (JMM, follows HIAPA) join the practice data as it is served, unless
# the app's own data.js already seeds them (V33); &asof=<ISO time> moves the practice clock. APP=staff6 (default) or
# APP=staff5 picks the app, so every test measures v5 for the baseline from the same folder.
#
# The measuring script follows the R-336 assessment's own (scratchpad a/a-screens-laptop/data/measure.js and
# a/a-visual/scripts/measure.js), so v5's numbers here match the assessment's: Nate's laptop Today 33 controls in the work
# column's first screen, Bills 69, Legislators 67 with 450 words.
import json, mimetypes, os, re, sys, time, urllib.request
from contextlib import contextmanager
from urllib.parse import urlparse, unquote

TESTS = os.path.dirname(os.path.abspath(__file__))
ROOT = os.environ.get('V4_ROOT', '')
HOST = 'https://v6.test' if ROOT else os.environ.get('HOST', 'http://localhost:8832')
APP = os.environ.get('APP', 'staff6')
if APP not in ('staff6', 'staff5'): sys.exit(f'APP must be staff6 or staff5, not {APP}')
V5 = APP == 'staff5'
BASELINE = os.path.join(TESTS, 'staff6_baseline_v5.json')

# ---- the people (spec 10) ----
PEOPLE = ['NT', 'KV', 'KR', 'JS', 'SY', 'LR', 'PH', 'JMM']
MORE_PEOPLE = ['RK', 'MR', 'JM', 'PT']          # measured on Today and Bills only (assessment critic)
LEADS = {'NT', 'JS', 'JN'}                       # admins and second approvers: Team (spec 3.1)
ADMINS = {'NT'}                                  # People, Session setup
NAMES = {'NT': 'Nate', 'KV': 'Kevin', 'KR': 'Kris', 'JS': 'Jess', 'SY': 'Saya', 'LR': 'Lauren', 'PH': 'Patti', 'JMM': 'Julie',
         'RK': 'Rick', 'MR': 'May Rose', 'JM': 'James', 'PT': 'Patrick', 'JN': 'Jaylen'}
EXTRA = [('aaaaaaaa-0000-4000-8000-00000000a011', 'Patti', 'PH', '#8e5ea2', 'HEAL'),
         ('aaaaaaaa-0000-4000-8000-00000000a012', 'Julie', 'JMM', '#3b8d6e', 'HIAPA')]

# ---- window sizes (spec 10): laptop first, phones first-class ----
SIZES = [(1280, 800), (1440, 900), (1024, 768), (390, 844), (320, 640)]
PHONE = lambda w: w < 768                        # the phone frame is below 768px (spec 3.2)
# ---- practice clocks: the busiest practice day (Mon 16 Mar 2026), the prep day, the opening weeks ----
CLOCKS = {'busy': '', 'off': '&season=off&day=2026-11-05', 'opening': '&season=opening'}
LAUREN_DAY = '&asof=2026-03-17T08:00:00-10:00'   # Lauren's TRN hearing, Tue 3/17 9:30 AM, Room 430
KRIS_DAY = '&asof=2026-03-20T08:00:00-10:00'     # the HHS/CPN hearing, Fri 3/20 9:30 AM, Room 229
KEVIN_DAY = '&asof=2026-03-18T08:00:00-10:00'    # Kevin's deadline day

# ---- practice ids (demo/snapshot.json) ----
TRN_TUE = '16eeec38-adf0-43f7-954d-30e358b7eac8'      # SB3234, TRN Tue 3/17 9:30 AM, Rm 430 (HEAL)
HHSCPN_FRI = '9ebffb71-69c2-4868-8956-e624cac16d30'   # HB1573 and three more, HHS/CPN Fri 3/20 9:30 AM, Rm 229
ISSUE = '05e0d6a9-4ea7-456c-b219-e3632ade358b'        # Free school meals for every student
HEAL = '979b46c2-8bb8-44ee-a5e6-fca6235de48c'
LEGISLATOR = 130                                      # Rep. Gregg Takayama, chair of a committee holding SB2175
SUPPORTER = 'demo-p1'
LIST = '943dd21b-239f-4a9b-9b26-6f9f82bb0ba0'
SEGMENT = 'demo-s1'

def _clock_rewrite(t, old):
  return t.replace(old, "const T_ASOF = DEMO && new URLSearchParams(location.search).get('asof');\n" + old.replace('= ', '= T_ASOF ? T_ASOF : ', 1)) if old in t else t
CLOCK_LINES = {'staff6/data.js': "export const DEMO_ASOF = DEMO_OFF", 'staff5/data.js': "export const DEMO_ASOF = DEMO_OFF",
               'pub/kernel.js': "export const DEMO_ASOF = SEASON_OFF"}

def _raw(rel):
  if ROOT:
    f = os.path.join(ROOT, rel)
    return open(f, 'rb').read() if os.path.isfile(f) else None
  try: return urllib.request.urlopen(f'{HOST}/{rel}', timeout=20).read()
  except Exception: return None

_seeds = {}
def app_seeds_people(app=APP):
  """True when the app's own data.js already adds Patti and Julie in demo mode (spec 6, V33), so they are not added twice."""
  if app not in _seeds: _seeds[app] = bool(re.search(rb"'PH'|\"PH\"", _raw(f'{app}/data.js') or b''))
  return _seeds[app]

def body_for(rel, raw, app=APP):
  if rel == 'demo/snapshot.json' and not app_seeds_people(app):
    s = json.loads(raw); camp = {c['name']: c['id'] for c in s['campaigns']}; have = {a['initials'] for a in s['advocates']}
    for i, full, ini, col, co in EXTRA:
      if ini not in have: s['advocates'].append({'id': i, 'full_name': full, 'initials': ini, 'color': col, 'email': None, 'is_admin': False,
        'is_reviewer': False, 'can_approve': False, 'is_active': True, 'focus_areas': None, 'prefs': {'coalitions': [camp[co]]}})
    return json.dumps(s).encode()
  if rel in CLOCK_LINES: return _clock_rewrite(raw.decode(), CLOCK_LINES[rel]).encode()
  return raw

def router(route):
  rel = unquote(urlparse(route.request.url).path).lstrip('/') or 'index.html'
  if ROOT:
    f = os.path.join(ROOT, rel)
    if not os.path.isfile(f): return route.fulfill(status=404, body='')
    raw = open(f, 'rb').read()
  else:
    if rel not in CLOCK_LINES and rel != 'demo/snapshot.json': return route.continue_()
    raw = route.fetch().body()
  t = {'.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.json': 'application/json'}.get(os.path.splitext(rel)[1]) or mimetypes.guess_type(rel)[0] or 'application/octet-stream'
  route.fulfill(status=200, body=body_for(rel, raw), headers={'content-type': t})

_codes = None
def committee_codes():
  """The Capitol's committee codes (HHS, CPN, TRN...), from the practice data: a code counts only when it is a real one."""
  global _codes
  if _codes is None:
    try: _codes = sorted({c['code'] for c in json.loads(_raw('demo/snapshot.json'))['committees'] if c.get('code')})
    except Exception: _codes = []
  return _codes

def stub(path):
  """A foundation stub (FRAME's placeholder for a place not built yet): missing, tiny, or saying so."""
  raw = _raw(path)
  if raw is None: return True
  t = raw.decode('utf-8', 'replace')
  return len(t) < 1200 or bool(re.search(r'placeholder|not built yet|stub', t[:1500], re.I))

# ---- the browser ----
# External links (mailto:, tel:, Google Docs, the Capitol) are kept from leaving the page, and remembered, so a journey can
# press "Email the chair" and still see the app's "Did you send it?" sheet.
INIT = r"""(() => {
  window.__ext = [];
  addEventListener('click', e => { const a = e.target.closest && e.target.closest('a[href]'); if (!a) return; const h = a.getAttribute('href') || '';
    if (/^(mailto:|tel:|sms:)/.test(h) || (/^https?:/.test(h) && !a.href.startsWith(location.origin))) { e.preventDefault(); window.__ext.push(a.href); } }, true);
  const open = window.open; window.open = (u, ...r) => { window.__ext.push(String(u)); return null; };
})()"""

READY = r"""async (max) => { const t0 = performance.now(); let last = -1, same = 0;
  while (performance.now() - t0 < max) { await new Promise(r => setTimeout(r, 120));
    const m = document.querySelector('main'); const busy = !m || m.querySelector('.skelpage, .skel');
    const n = m ? m.innerHTML.length : 0;
    if (!busy && n === last) { if (++same >= 3) return Math.round(performance.now() - t0); } else same = 0; last = n; }
  return -1; }"""

class P:
  """One tab as one person at one window size."""
  def __init__(self, ctx, page, who, w, h, mobile):
    self.ctx, self.page, self.who, self.w, self.h, self.mobile = ctx, page, who, w, h, mobile
    self.errors, self.extra, self.app = [], None, APP
    page.on('pageerror', lambda e: self.errors.append(str(e)))
  def url(self, route='/', extra='', app=None):
    return f"{HOST}/{app or self.app}.html?demo=1&as={self.who}{extra}#{route}"
  def open(self, route='/', extra='', app=None, max_wait=9000):
    self.extra, self.app = extra, app or self.app
    self.page.goto(self.url(route, extra, app)); self.page.wait_for_timeout(600); return self.ready(max_wait)
  def nav(self, route, max_wait=6000):
    """Go to another address in the same tab (as a link would): the app redraws without loading again."""
    self.page.evaluate("r => { location.hash = r; }", route); self.page.wait_for_timeout(120)
    r = self.ready(max_wait); self.page.evaluate('scrollTo(0, 0)'); return r
  def ready(self, max_wait=6000): return self.page.evaluate(READY, max_wait)
  def measure(self, full=False, own=None):
    """The numbers below; `own` (a CSS selector) also counts the controls inside those parts (Today's own rows, spec 13)."""
    return self.page.evaluate(MEASURE, {'codes': committee_codes(), 'full': full, 'own': own})
  def text(self, sel='main'):
    el = self.page.query_selector(sel) or self.page.query_selector('body'); return el.inner_text() if el else ''
  def hash(self): return self.page.evaluate('location.hash')
  def shot(self, path, full=False):
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True); self.page.screenshot(path=path, full_page=full); return path
  def close(self): self.ctx.close()

class Browser:
  def __init__(self, pw): self.b = pw.chromium.launch()
  def page(self, who, w=1440, h=900, mobile=None):
    mobile = PHONE(w) if mobile is None else mobile
    ctx = self.b.new_context(viewport={'width': w, 'height': h}, is_mobile=mobile, has_touch=mobile, device_scale_factor=1, reduced_motion='reduce')
    try: ctx.grant_permissions(['clipboard-read', 'clipboard-write'], origin=HOST)
    except Exception: pass
    if ROOT: ctx.route(lambda u: not u.startswith(HOST), lambda r: r.abort())
    ctx.route(HOST + '/**', router); ctx.add_init_script(INIT)
    return P(ctx, ctx.new_page(), who, w, h, mobile)
  def close(self): self.b.close()

@contextmanager
def browser():
  from playwright.sync_api import sync_playwright
  with sync_playwright() as pw:
    b = Browser(pw)
    try: yield b
    finally: b.close()

# ---- results ----
class Results:
  """ok / FAIL / SKIP lines, a count at the end, and the exit code (SKIP is "not built yet", never a failure)."""
  def __init__(self): self.rows = []
  def check(self, name, ok, detail='', skip=None):
    st = 'SKIP' if skip else ('ok' if ok else 'FAIL')
    self.rows.append((name, st, detail if not skip else skip)); d = detail if not skip else skip
    print(f"{st:<5}{name}" + (f'  ({d})' if d not in ('', None) else ''), flush=True)
    return ok
  def done(self, enforce=True):
    bad = [r for r in self.rows if r[1] == 'FAIL']; sk = [r for r in self.rows if r[1] == 'SKIP']
    print(f"\n{APP}: {len(self.rows) - len(bad) - len(sk)} of {len(self.rows)} met, {len(bad)} missed, {len(sk)} not built yet")
    sys.exit(1 if (bad and enforce) else 0)

def load_baseline():
  try: return json.load(open(BASELINE))
  except Exception: return {}
def save_baseline(key, value):
  """Merge one test's v5 numbers into tests/staff6_baseline_v5.json (each test owns its own key)."""
  b = load_baseline(); b[key] = value; b.setdefault('_about', 'Staff v5 measured by the staff6_* tests with APP=staff5 (R-336 V06); the before for the before-and-after.')
  # one row per line: a list of numbers is written on its own line, so a re-measure reads as a short diff
  s = re.sub(r'\[\s+([^\[\]{}"]*?)\s+\]', lambda m: '[' + re.sub(r'\s+', '', m.group(1)) + ']', json.dumps(b, indent=1, sort_keys=True, ensure_ascii=False))
  tmp = BASELINE + '.tmp'; open(tmp, 'w').write(s + '\n'); os.replace(tmp, BASELINE)

# ---- the measuring script ----
# Counted on the work column (<main>) unless a line says the whole window. "First screen" is what is in the window at the
# top of the page (0 .. innerHeight); `full` counts the whole page. A closed fold's insides are not in view; screen-reader-
# only words are not seen. Rows are the repeated items of a list (li, tr, .row, article, the v6-row...), outermost only.
# Text colours are counted apart from the status colours (spec 13): `colors` is the rest (ink, body, muted, action and white
# on the filled button: at most 5), `colors_status` the done / late / missed colours a status brings with it. Bold counts
# only what spec 12.1 does not set at 600+: the page title, section headings (h2), the filled button and the open page tab
# are left out of the bold share (`bold_pct`); `bold_all_pct` is every 600+ character, as before.
MEASURE = r"""(arg) => {
  const W = innerWidth, H = arg.full ? 1e7 : innerHeight, CODES = new Set(arg.codes || []);
  const main = document.querySelector('main') || document.body;
  const vis = e => { if (!e || !e.getBoundingClientRect) return false; const s = getComputedStyle(e); if (s.visibility === 'hidden' || s.display === 'none' || +s.opacity === 0) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const seen = r => r.bottom > (arg.full ? -1e7 : 30) && r.top < H && r.right > 0 && r.left < W && r.width > 0 && r.height > 0;
  const inView = e => vis(e) && seen(e.getBoundingClientRect()) && !e.closest('.sr, .band') && !e.closest('details:not([open]) > :not(summary)');
  const transparent = c => !c || /rgba\(0, 0, 0, 0\)|transparent/.test(c);
  const rgb = c => { const m = (c || '').match(/[\d.]+/g); return m ? m.map(Number) : null; };
  const strong = e => { const m = rgb(getComputedStyle(e).backgroundColor); if (!m) return false; const [r, g, b, al = 1] = m; return al > 0.5 && (r + g + b) / 3 < 160; };
  const sides = s => ['Top', 'Right', 'Bottom', 'Left'].filter(k => parseFloat(s['border' + k + 'Width']) > 0 && s['border' + k + 'Style'] !== 'none' && !transparent(s['border' + k + 'Color']) && (rgb(s['border' + k + 'Color'])[3] ?? 1) > 0.05).length;
  const all = [...main.querySelectorAll('*')].filter(inView);
  const body = [...document.body.querySelectorAll('*')].filter(inView);

  // ---- controls (instances, not kinds) ----
  const CTRL = 'a[href], button, input:not([type=hidden]), select, textarea, summary, [role=button], [role=tab], [role=menuitem], [role=switch], [role=checkbox], [tabindex="0"]';
  let ctrls = all.filter(e => e.matches(CTRL) && !e.disabled);
  ctrls = ctrls.filter(e => !ctrls.some(o => o !== e && o.contains(e) && o.matches('a[href], button')));
  const btnLike = e => e.matches('button, a.btn, [role=button], summary, input[type=button], input[type=submit]');
  const label = e => (e.innerText || e.value || '').replace(/\s+/g, ' ').trim();
  const filled = ctrls.filter(e => btnLike(e) && strong(e));
  // spec 12.1's own bold: 700 for the page title and the filled button, 600 for section headings, and the open page tab
  // (spec 13: bold with a teal bar). A switch's picked side (Mine | Team) and item names are not on the list: they count.
  const allowedBold = el => !!(el.closest('h1, h2, [role=heading][aria-level="1"], [role=heading][aria-level="2"]')
    || el.closest('.sv-secnav a[aria-current], [role=tablist] [aria-current], [role=tab][aria-selected=true]')
    || (() => { const b = el.closest('button, a.btn, [role=button], input[type=button], input[type=submit]'); return !!b && strong(b); })());
  const labelled = ctrls.filter(e => btnLike(e) && /[A-Za-z]{2}/.test(label(e)) && !e.matches('.iconbtn'));

  // ---- text: words, sizes, weight, colours ----
  let words = 0, chars = 0, small = 0, tiny = 0, bold = 0, boldAll = 0; const colors = new Set(), colorEx = new Map(); let text = '';
  const tw = document.createTreeWalker(main, NodeFilter.SHOW_TEXT); let n;
  while ((n = tw.nextNode())) { const v = n.nodeValue.replace(/\s+/g, ' ').trim(); if (!v) continue; const el = n.parentElement; if (!el || !inView(el) || el.closest('svg')) continue;
    const r = document.createRange(); r.selectNodeContents(n); const rects = [...r.getClientRects()].filter(q => q.width > 2 && q.height > 2 && q.top < H && q.bottom > (arg.full ? -1e7 : 30));
    if (!rects.length) continue; const s = getComputedStyle(el), frac = rects.filter(q => q.bottom <= H).length / rects.length;
    words += Math.round(v.split(/\s+/).filter(Boolean).length * frac); const c = Math.round(v.length * frac);
    chars += c; colors.add(s.color); if (!colorEx.has(s.color)) colorEx.set(s.color, v.slice(0, 24)); text += ' ' + v;
    const fs = parseFloat(s.fontSize); if (fs <= 14.5) small += c; if (fs < 13.9) tiny += c; if (+s.fontWeight >= 600) { boldAll += c; if (!allowedBold(el)) bold += c; } }

  // ---- codes: version codes, committee codes and P1-P3 (bill numbers are allowed: D15) ----
  const codesIn = t => { const vc = (t.match(/\b(HD|SD|CD)\d\b/g) || []).length, p = (t.match(/\bP[1-3]\b/g) || []).length;
    const cc = t.split(/[\s·,()–—:;.]+/).filter(w => w && w.split('/').every(x => /^[A-Z]{3}$/.test(x)) && w.split('/').some(x => CODES.has(x))).length;
    return { version: vc, committee: cc, p: p, total: vc + cc + p }; };
  const codes = codesIn(text);

  // ---- rows: facts and buttons per row ----
  const ROWSEL = '.row, .td-row, li, tr, article, [data-row], .sv-billrow, .v6-row, [role=row], [role=listitem], [class$="row"], [class*="row "]';
  let rows = all.filter(e => e.matches(ROWSEL) && e.parentElement && [...e.parentElement.children].filter(c => c.tagName === e.tagName).length >= 2
    && e.getBoundingClientRect().height >= 24 && e.getBoundingClientRect().width >= 200 && !e.closest('nav, [role=tablist], [role=menu], dialog, .sv-secnav'));
  rows = rows.filter(e => !rows.some(o => o !== e && o.contains(e)));
  // A row's own buttons are not its facts, whether or not the fold cuts them (a cut 'I help' is still a button's label).
  const BTN = 'button, a.btn, [role=button], summary, input, select, textarea';
  const rowText = (row, btns) => { const own = new Map(); const t = document.createTreeWalker(row, NodeFilter.SHOW_TEXT); let x;
    while ((x = t.nextNode())) { const v = x.nodeValue.replace(/\s+/g, ' ').trim(); if (!v) continue; let el = x.parentElement;
      if (!el || !vis(el) || el.closest('.sr, svg') || btns.some(b => b.contains(el))) continue;
      const ob = el.closest(BTN); if (ob && ob !== row && row.contains(ob)) continue;
      // an inline part of a sentence ("due <b>today 3:00 PM</b>") belongs to the sentence
      while (el !== row && el.parentElement && el.parentElement !== row.parentElement && getComputedStyle(el).display === 'inline' && [...el.parentElement.childNodes].some(c => c.nodeType === 3 && c.nodeValue.trim())) el = el.parentElement;
      own.set(el, (own.get(el) || '') + ' ' + v); }
    return [...own.values()]; };
  const rowInfo = rows.map(row => { const rr = row.getBoundingClientRect(), area = rr.width * rr.height;
    const btns = ctrls.filter(c => c !== row && row.contains(c) && (btnLike(c) || c.matches('input, select, textarea')) && (() => { const q = c.getBoundingClientRect(); return q.width * q.height < 0.6 * area; })());
    const parts = rowText(row, btns); const facts = parts.reduce((k, p) => k + p.split(/\s[·•|]\s|\s[·•]|[·•]\s|\s—\s/).filter(s => /[A-Za-z0-9]/.test(s)).length, 0);
    return { facts, buttons: btns.length, codes: codesIn(parts.join(' ')).total, text: parts.join(' | ').slice(0, 120) }; });
  const med = a => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };

  // ---- the whole window: bordered elements, corner radii, amber and red marks ----
  const bordered = body.filter(e => !e.closest('.band') && sides(getComputedStyle(e)) >= 1).length;
  const radii = new Set(), radEx = {};
  for (const e of body) { if (e.closest('.band') || e.matches('svg, svg *')) continue; const s = getComputedStyle(e), rad = parseFloat(s.borderTopLeftRadius) || 0; if (rad < 1) continue;
    const pb = e.parentElement ? getComputedStyle(e.parentElement).backgroundColor : '';
    const painted = sides(s) > 0 || (s.boxShadow && s.boxShadow !== 'none') || (!transparent(s.backgroundColor) && s.backgroundColor !== pb) || e.matches('img');
    if (!painted) continue; const r = e.getBoundingClientRect(); const k = rad >= Math.min(r.width, r.height) / 2 - 0.5 || /%/.test(s.borderTopLeftRadius) ? 'pill' : String(Math.round(rad)); radii.add(k);
    radEx[k] ??= (e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/).join('.') : '')).slice(0, 50); }
  // Amber and red, by their real colours (spec 12.8), plus any other strongly red or amber colour (coral, the celebration
  // colour, is not one). v6: the late and bad tokens' values only (--v6-late #955A00 and its wash, --v6-bad #AF3328 and its
  // wash, the pressed red): the frame turned v5's --warn-* names neutral on purpose (ink, wash, field), so a name says
  // nothing. v5 (the baseline): its warn / bad / late tokens, which there are amber and red.
  const probe = document.createElement('i'); document.body.appendChild(probe);
  const norm = v => { probe.style.color = ''; probe.style.color = v; return getComputedStyle(probe).color; };
  const bs = getComputedStyle(document.body), V6 = !!bs.getPropertyValue('--v6-late').trim();
  const toks = new Set(), soft = new Set(); let coral = null;
  if (V6) {
    for (const p of ['--v6-late', '--v6-late-wash', '--v6-bad', '--v6-bad-wash', '--bad-press']) { const v = bs.getPropertyValue(p).trim(); if (v) toks.add(norm(v)); }
    coral = norm(bs.getPropertyValue('--v6-coral').trim());
    // the celebration family (coral and its tints) is never a warning, though its darkest tint sits near red's hue
    for (const p of ['--o50', '--o200', '--o400', '--o600', '--o700']) { const v = bs.getPropertyValue(p).trim(); if (v) soft.add(norm(v)); }
  } else for (const sh of document.styleSheets) { let rules; try { rules = sh.cssRules; } catch { continue; }
    const walk = rs => { for (const r of rs) { if (r.cssRules) walk(r.cssRules); if (!r.style) continue; for (const p of r.style) if (/^--/.test(p)) {
      if (/(warn|bad|late|danger|overdue|alert|err)/i.test(p) && !/(ink|text-on|on-)/i.test(p)) { const v = bs.getPropertyValue(p).trim(); if (v && !/var\(|^\d/.test(v)) toks.add(norm(v)); }
      if (/coral/i.test(p)) coral = norm(bs.getPropertyValue(p).trim()); } } };
    walk(rules); }
  // The status colours (spec 13: counted apart from the text colours): done, late and missed with their washes and pressed
  // values. v6: the leaf, late and bad tokens. v5 (the baseline): its ok / warn / bad / late tokens.
  const STATUS = new Set();
  if (V6) { for (const p of ['--v6-leaf', '--v6-leaf-wash', '--v6-leaf-press', '--v6-late', '--v6-late-wash', '--v6-late-press', '--v6-bad', '--v6-bad-wash', '--v6-bad-press', '--bad-press', '--ok-text', '--ok-wash', '--bad-text', '--bad-wash'])
    { const v = bs.getPropertyValue(p).trim(); if (v) STATUS.add(norm(v)); } }
  else { toks.forEach(c => STATUS.add(c)); for (const p of ['--ok-text', '--ok', '--ok-wash', '--success', '--success-text', '--done']) { const v = bs.getPropertyValue(p).trim(); if (v && !/var\(/.test(v)) STATUS.add(norm(v)); } }
  probe.remove();
  const plainColors = [...colors].filter(c => !STATUS.has(c)), statusColors = [...colors].filter(c => STATUS.has(c));
  const hsl = c => { const m = rgb(c); if (!m || (m[3] ?? 1) < 0.3) return null; const [r, g, b] = m.map(x => x / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
    if (!d) return { h: 0, s: 0, l }; const s = d / (1 - Math.abs(2 * l - 1)); let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h = (h * 60 + 360) % 360; return { h, s, l }; };
  const hot = c => { if (!c || transparent(c) || c === coral || soft.has(c)) return false; if (toks.has(c)) return true; const q = hsl(c); return !!q && q.s > 0.55 && q.l > 0.2 && q.l < 0.6 && (q.h < 18 || q.h > 345 || (q.h > 28 && q.h < 48)); };
  const marked = body.filter(e => { if (e.closest('.band, .mark, .sv-brand, .sv-sbrand, .sv-lbrand') || e.matches('svg *')) return false; const s = getComputedStyle(e);
    const own = [...e.childNodes].some(c => c.nodeType === 3 && c.nodeValue.trim()) || e.matches('svg');
    return (own && hot(s.color)) || hot(s.backgroundColor) || ['Top', 'Right', 'Bottom', 'Left'].some(k => parseFloat(s['border' + k + 'Width']) > 0 && hot(s['border' + k + 'Color'])); });
  const marks = marked.filter(e => !marked.some(o => o !== e && o.contains(e)));
  // R-352 (Nate 27 Oct, amending R-344's Decision 2; A-5 on v6): amber is late, still accepted, and red overdue, so "today" no longer words a mark.
  const WORD = /\b(late|overdue|missed|past due|still accepted|not filed|didn.t file|failed|error|offline|could not|did not load)\b/i;
  const unworded = marks.filter(e => { const box = e.closest('li, tr, .row, .td-row, .v6-row, article, .card, .v6-hcard, .v6-step, [role=listitem], [role=alert], .notice') || e.parentElement || e; return !WORD.test((box.innerText || '') + ' ' + (e.getAttribute('aria-label') || '')); });

  // ---- the frame: sidebar rows, the phone's tab bar, sideways scroll ----
  const side = innerWidth < 768 ? null : [...document.querySelectorAll('aside, nav')].find(e => !main.contains(e) && vis(e) && e.getBoundingClientRect().height > 300 && e.getBoundingClientRect().left < 40 && e.getBoundingClientRect().width < 400 && !e.closest('dialog'));
  // Sidebar rows are the links to places (and You, the account door), not its furniture (spec 12.4): the Lead tools heading,
  // the Collapse (Narrow / Widen) button, the "More below" cue (hidden from screen readers), the brand and the live app's
  // stale-data line (its Refresh now button, .sv-sync) are not rows.
  const sideRows = side ? [...side.querySelectorAll('a[href], button')].filter(e => vis(e) && !/collapse|expand|narrow|widen|skip to|more (above|below)/i.test(e.innerText + ' ' + (e.getAttribute('aria-label') || '') + ' ' + (e.getAttribute('title') || ''))
    && e.getAttribute('aria-hidden') !== 'true' && !e.querySelector('.mark, svg.mark') && !e.matches('.sv-sbrand') && !e.closest('.sv-sync')).length : 0;
  const tabbar = [...document.querySelectorAll('nav')].find(e => !main.contains(e) && vis(e) && getComputedStyle(e).position === 'fixed' && Math.abs(e.getBoundingClientRect().bottom - innerHeight) < 4);
  const tabs = tabbar ? [...tabbar.querySelectorAll('a[href], button')].filter(vis).map(a => label(a).replace(/\s*\d+$/, '')) : [];
  const h2s = [...main.querySelectorAll('h2')].filter(e => vis(e) && seen(e.getBoundingClientRect())).map(e => label(e));
  const h1 = [...document.querySelectorAll('h1, [role=heading][aria-level="1"]')].filter(vis).map(label);
  return {
    controls: ctrls.length, filled: filled.length, labelled_buttons: labelled.length, labelled_list: labelled.map(label).slice(0, 40),
    words, chars, small_pct: chars ? Math.round(100 * small / chars) : 0, px13_pct: chars ? Math.round(100 * tiny / chars) : 0, bold_pct: chars ? Math.round(100 * bold / chars) : 0,
    bold_all_pct: chars ? Math.round(100 * boldAll / chars) : 0,
    colors: plainColors.length, colors_status: statusColors.length, colors_all: colors.size,
    colors_list: [...colorEx].filter(([c]) => !STATUS.has(c)).map(([c, t]) => `${c} ${t}`), colors_status_list: statusColors.map(c => `${c} ${colorEx.get(c)}`),
    controls_own: arg.own ? ctrls.filter(e => e.closest(arg.own)).length : 0,
    codes: codes.total, codes_detail: codes, rows: rowInfo.length,
    facts_max: rowInfo.length ? Math.max(...rowInfo.map(r => r.facts)) : 0, facts_med: med(rowInfo.map(r => r.facts)), rows_over4: rowInfo.filter(r => r.facts > 4).length,
    row_buttons_max: rowInfo.length ? Math.max(...rowInfo.map(r => r.buttons)) : 0, rows_multi_button: rowInfo.filter(r => r.buttons > 1).length,
    row_codes: rowInfo.reduce((k, r) => k + r.codes, 0), worst_row: rowInfo.sort((a, b) => b.facts - a.facts)[0]?.text || '',
    bordered, radii: radii.size, radii_list: [...radii].sort(), radii_where: radEx, marks: marks.length, marks_unworded: unworded.length,
    marks_list: marks.slice(0, 6).map(e => (e.innerText || e.getAttribute('aria-label') || e.tagName).replace(/\s+/g, ' ').trim().slice(0, 40)),
    groups: h2s.filter(t => !/your next step/i.test(t)).length, h2: h2s.slice(0, 12), h1: h1[0] || '',
    side_rows: sideRows, tabs, screens: Math.round(100 * document.documentElement.scrollHeight / innerHeight) / 100,
    page_height: document.documentElement.scrollHeight, hscroll: document.documentElement.scrollWidth > innerWidth + 1,
  };
}"""

# ---- finding controls by their words, as a person would ----
def find(page, *names, roles=('button', 'link', 'tab', 'menuitem', 'switch', 'checkbox', 'radio'), scope=None, in_view=False):
  """The first visible control whose accessible name matches one of `names` (strings are whole names, ignoring case; a
  compiled regex matches anywhere). Searched by role, then by visible text. None when nothing matches."""
  # an open sheet or dialog is where a person looks first (the page under it does not take clicks)
  if scope is None:
    try:
      if page.locator('dialog[open]').count():
        hit = find(page, *names, roles=roles, scope='dialog[open] >> nth=-1', in_view=in_view)
        if hit is not None: return hit
    except Exception: pass
  root = page.locator(scope) if scope else page
  for nm in names:
    rx = nm if isinstance(nm, re.Pattern) else re.compile(r'^\s*' + re.escape(nm) + r'\s*$', re.I)
    for role in roles:
      loc = root.get_by_role(role, name=rx)
      try: k = loc.count()
      except Exception: k = 0
      for i in range(min(k, 12)):
        el = loc.nth(i)
        try:
          if el.is_visible() and (not in_view or _in_view(page, el)): return el
        except Exception: pass
    # a fold's summary and other clickable parts with no role of their own, by their visible words
    loc = root.locator('summary, [role=button], label, [data-fold]').filter(has_text=rx if isinstance(nm, re.Pattern) else re.compile(re.escape(nm), re.I))
    try: k = loc.count()
    except Exception: k = 0
    for i in range(min(k, 12)):
      el = loc.nth(i)
      try:
        if el.is_visible() and (not in_view or _in_view(page, el)): return el
      except Exception: pass
  return None

def _in_view(page, el):
  try:
    b = el.bounding_box(); vh = page.viewport_size['height']
    return b is not None and b['y'] + b['height'] > 0 and b['y'] < vh
  except Exception: return False

def visible_text(page, rx, scope='main', in_view=True):
  """Where (y, px from the page top) the smallest visible element whose text matches `rx` sits; None when not shown."""
  return page.evaluate(r"""([src, flags, scope, inView]) => { const re = new RegExp(src, flags);
    const els = [...document.querySelectorAll(scope + ' *')].filter(e => e.offsetParent !== null && e.children.length < 6 && re.test(e.innerText || ''));
    const ok = els.filter(e => !e.closest('details:not([open]) > :not(summary)') && !e.closest('.sr'));
    if (!ok.length) return null; const e = ok.sort((a, b) => (a.innerText || '').length - (b.innerText || '').length)[0];
    const r = e.getBoundingClientRect(); if (inView && (r.top >= innerHeight || r.bottom <= 0)) return null; return Math.round(r.top + scrollY); }""",
    [rx.pattern if isinstance(rx, re.Pattern) else rx, 'i', scope, in_view])
