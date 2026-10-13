# Staff v5: the ease-of-use review's "How we'll know" checks (R-277), one block per batch. Served like staff5_people.py
# (it borrows that test's router, so Patti and Julie are in the practice data), laptop 1440x900 unless a check says.
# Exits 1 when a check misses.
#   python3 tests/staff5_checks.py                  against http://localhost:8832 (CI serves the repo there)
#   V4_ROOT=/path/to/worktree python3 tests/staff5_checks.py    serves that folder straight into the browser
import os, re, sys
from urllib.parse import urlparse, unquote
from urllib.request import urlopen
from playwright.sync_api import sync_playwright
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from staff5_people import router, HOST, ROOT   # one way to serve the practice copy for every staff5 test

# ---- batch e: the practice data at session volume (R-277 fix 18, V-1..V-10) ----
# The review measured the screens with the practice data doubled and quadrupled (166 -> 332 -> 664 live tracked bills,
# 35 -> 70 -> 140 hearings in 7 days). grow() does that to the snapshot as it is served: each copy of a bill gets a new id
# and a number 4000 higher (HB1523 -> HB5523, 9523 for the third copy...), with its hearings, drafts, owner, coalition,
# issues and history copied to match, so every list has that many more rows doing the same things at the same times.
def grow(raw, times):
  import json
  if times <= 1: return raw
  s = json.loads(raw)
  rid = lambda x, n: f'{x}-x{n}'
  num = lambda bn, n: re.sub(r'(\d+)', lambda m: str(int(m.group(1)) + 4000 * n), bn, count=1)
  add = {k: [] for k in ('bills', 'activity', 'hearings', 'outcomes', 'assignments', 'billCampaigns', 'billIssues', 'drafts')}
  dh = {}
  for n in range(1, times):
    hid = {h['id']: rid(h['id'], n) for h in s['hearings']}
    for b in s['bills']: add['bills'].append({**b, 'id': rid(b['id'], n), 'bill_number': num(b['bill_number'], n)})
    for k in ('activity', 'assignments', 'billCampaigns', 'billIssues'):
      add[k] += [{**x, 'bill_id': rid(x['bill_id'], n)} for x in s[k]]
    add['hearings'] += [{**h, 'id': hid[h['id']], 'bill_id': rid(h['bill_id'], n)} for h in s['hearings']]
    add['outcomes'] += [{**o, 'bill_id': rid(o['bill_id'], n), 'hearing_id': hid.get(o['hearing_id'], o['hearing_id'])} for o in s['outcomes']]
    add['drafts'] += [{**d, 'id': rid(d['id'], n), 'bill_id': rid(d['bill_id'], n), 'hearing_id': rid(d['hearing_id'], n) if d.get('hearing_id') else None,
                       'doc_url': (d.get('doc_url') or '') and d['doc_url'] + f'-x{n}'} for d in s['drafts']]
    for k, v in s['draftHearings'].items(): dh[rid(k, n)] = {**v, 'id': rid(k, n), 'bill_id': rid(v['bill_id'], n)}
  for k, v in add.items(): s[k] += v
  s['draftHearings'].update(dh)
  return json.dumps(s).encode()

def router_times(times):
  # staff5_people.py's router (Patti and Julie added, the clock movable), with the snapshot grown `times` over.
  import staff5_people as P
  def r(route):
    rel = unquote(urlparse(route.request.url).path).lstrip('/') or 'index.html'
    if rel != 'demo/snapshot.json' or times <= 1: return router(route)
    raw = open(os.path.join(ROOT, rel), 'rb').read() if ROOT else route.fetch().body()
    route.fulfill(status=200, body=grow(P.body_for(rel, raw), times), headers={'content-type': 'application/json'})
  return r

results = []
def check(name, ok, detail=''):
  results.append((name, bool(ok), detail)); print(('ok   ' if ok else 'FAIL ') + name + (f'  ({detail})' if detail else ''))

# ---- batch b (fixes 2, 3, 7, 9, 21): one word per thing ----
# Wordings the word pass retired (C-15 as amended by R-277). Each is looked for in the visible text of every main screen,
# as three people: Nate (admin), Jess (second approver) and Patti (helper, owns nothing).
RETIRED = [
  ('under an hour', r'\bunder an hour\b'), ('"7h left"', r'\b\d+h left\b'), ('"<1h"', r'<1h'), ('"in 59m"', r'\bin \d+m\b'),
  ('"In review"', r'\b[Ii]n review\b'), ('"To review"', r'\bTo review\b'), ('"Submit for review"', r'\b[Ss]ubmit for review\b'),
  ('"Resubmit for review"', r'\bResubmit for review\b'), ('"Request changes"', r'\b[Rr]equest changes\b'), ('"Nothing to review"', r'\bNothing to review\b'),
  ('"Follow-up"', r'\bFollow-ups?\b'), ('"Add a task"', r'\b[Aa]dd a task\b'), ('"Also to do"', r'\bAlso to do\b'), ('"To do" (not to-do)', r'\bTo do\b'),
  ('"Practise"', r'\bPractis'), ('"Needs you" (Inbox tab)', r'\bNeeds you\b(?! today)'), ('"Nudges"', r'\b[Nn]udges?\b'),
  ('"reminder" (staff alerts)', r'\b[Rr]eminders?\b'), ('"I support <coalition>"', r'\bI support\b'), ('"You support"', r'\bYou support\b'),
  ('unlabelled "Day 27 of 58"', r'(?<!Legislative )\b[Dd]ay \d+ of \d+'), ('"Where things live"', r'\bWhere things live\b'),
]
SCREENS = ['/', '/?scope=team', '/?view=week', '/bills', '/bill/HB2121', '/review', '/inbox', '/my-issues', '/my-issues/coalitions',
           '/outreach', '/outreach/partners', '/help', '/me', '/legislators']

# ---- batch c (fixes 1, 4, 10, 13, 14): rows, look and frame ----
PEOPLE = ['NT', 'JS', 'KR', 'PH', 'KV', 'SY', 'LR', 'JMM']   # the eight of staff5_people.py (Kevin is KV in the practice data)
# A row's part is cut when its text runs past its box (an ellipsis or a hidden overflow). A bill's plain summary beside its
# number (.td-rn) may be cut on purpose: the open item says it in full. The step, the time and the person never are.
CUT_ROWS = r"""() => { const out = []; let n = 0; for (const r of document.querySelectorAll('.td-root .td-row')) { if (!r.offsetParent) continue; n++;
  const cut = [...r.querySelectorAll('*')].filter(e => { if (!e.offsetParent || e.closest('.td-rn')) return false; const cs = getComputedStyle(e);
    if (cs.position === 'absolute' && cs.clip !== 'auto') return false;
    return (e.scrollWidth > e.clientWidth + 1 && cs.overflowX !== 'visible') || cs.textOverflow === 'ellipsis' && e.scrollWidth > e.clientWidth
      || (e.scrollHeight > e.clientHeight + 2 && cs.overflowY === 'hidden'); });
  if (cut.length) out.push(r.innerText.replace(/\s+/g, ' ').slice(0, 70)); } return [n, out]; }"""

def batch_c(b, page, go):
  # 1. Rows on Today and Team show their second line whole, for all eight people, at 1280 and 1440 (fix 1, W-1)
  for W in (1280, 1440):
    total, cut = 0, []
    for who in PEOPLE:
      pg = page(who, W, 900)
      for i, r in enumerate(['/', '/?scope=team']):
        if i == 0: go(pg, r, 3000)
        else: pg.evaluate(f"location.hash = '#{r}'"); pg.wait_for_timeout(1500)
        n, c = pg.evaluate(CUT_ROWS); total += n; cut += [f'{who} {r}: {x}' for x in c]
      pg.context.close()
    check(f'Today and Team at {W}: no row cut short, all eight people ({total} rows)', total and not cut, '; '.join(cut[:3]))
  batch_c_looks(b, page, go)
  batch_c_frame(b, page, go)
  batch_c_whose(b, page, go)
  batch_c_small(b, page, go)

# One look per action (fix 4, U-4, U-8): every "I'm going", Doc, "Mark filed" and "Show all" on a page (sheets aside, where
# the confirm button is the sheet's own) is drawn by ui.js: its class, its words, its icons, and the same colour and weight
# for the quiet (text) ones. The Doc is the step's one filled or outlined button where it IS the step (Patti's Today).
LOOKS = r"""() => { const out = []; const vis = e => e.offsetParent && !e.closest('dialog');
  const say = e => (e.innerText || '').replace(/\s+/g, ' ').trim();
  const add = (act, e) => { const cs = getComputedStyle(e), svgs = e.querySelectorAll('svg, .ic').length;
    out.push({ act, text: say(e), cls: e.className || '', kind: /\bprimary\b/.test(e.className) ? 'primary' : /\bsecondary\b/.test(e.className) ? 'secondary' : 'text',
      color: cs.color, weight: cs.fontWeight, icons: svgs }); };
  for (const e of document.querySelectorAll('main button, main a')) { if (!vis(e)) continue; const s = say(e); if (!s) continue;   // folded away
    if (/^(I’m going|You’re going|Take me off|I’m not going)/.test(s) && e.tagName === 'BUTTON') add('going', e);
    else if (/docs\.google\.com/.test(e.getAttribute('href') || '') || /Google Doc/.test(s)) add('doc', e);
    else if (s === 'Mark filed') add('filed', e);
    else if (/^Show all \d/.test(s) && !e.closest('.lg-sg')) add('all', e); }
  return out; }"""
LOOK_SCREENS = [('NT', '/'), ('NT', '/bill/HB1562'), ('NT', '/bill/SB3234'), ('NT', '/hearing/9ebffb71-69c2-4868-8956-e624cac16d30'), ('NT', '/bill/HB2121'),
                ('PH', '/'), ('JS', '/review'), ('KR', '/'), ('NT', '/coalition'), ('NT', '/legislators')]
WANT = {'going': ('sv-going', r'^(I’m going|You’re going)$'), 'doc': ('sv-doc', r'^Open Doc$'), 'filed': ('sv-filed', r'^Mark filed$'), 'all': ('sv-showall', r'^Show all \d+( \w+)?$')}

# One page frame (fix 10, U-5, U-12): every main page opens with one heading row (.sv-phead) holding its h1, at the same
# top and the same left edge, the frame's search box shown (Bills too), and the page's "…" the last control in the row.
FRAME_ROUTES = ['/', '/?scope=team', '/?view=week', '/bills', '/legislators', '/outreach', '/outreach/partners', '/outreach/emails',
                '/outreach/supporters', '/my-issues', '/outreach/issues', '/coalition', '/review', '/inbox', '/help', '/me', '/setup', '/setup/coalitions']
FRAME = r"""() => { const rows = [...document.querySelectorAll('main .sv-phead')].filter(e => e.getClientRects().length); const r = rows[0];
  const q = r && r.getBoundingClientRect(), h = r && r.querySelector('h1');
  const s = document.querySelector('.sv-hdr .sv-search'); const search = !!(s && s.getClientRects().length && getComputedStyle(s).visibility !== 'hidden');
  const more = r ? [...r.querySelectorAll('.iconbtn')].filter(e => /^More/.test(e.getAttribute('aria-label') || '')) : [];
  const last = r ? [...r.querySelectorAll('button, a, input')].filter(e => e.getClientRects().length).pop() : null;
  const h1s = [...document.querySelectorAll('main h1')].filter(e => e.getClientRects().length).length;
  return { rows: rows.length, top: q ? Math.round(q.top + scrollY) : null, left: q ? Math.round(q.left) : null, h1: !!h, h1s, search, moreLast: !more.length || more[more.length - 1] === last }; }"""

def batch_c_frame(b, page, go):
  for W in (1440, 1280):
    pg = page('NT', W, 900); got = {}
    for i, r in enumerate(FRAME_ROUTES):
      if i == 0: go(pg, r, 3000)
      else: pg.evaluate(f"location.hash = '#{r}'"); pg.wait_for_timeout(1400)
      pg.evaluate('scrollTo(0, 0)'); got[r] = pg.evaluate(FRAME)
    pg.context.close()
    tops, lefts = {g['top'] for g in got.values()}, {g['left'] for g in got.values()}
    check(f'{W}: every main page has one heading row with its h1 ({len(FRAME_ROUTES)} pages)', all(g['rows'] >= 1 and g['h1'] and g['h1s'] == 1 for g in got.values()),
          ', '.join(r for r, g in got.items() if not (g['rows'] >= 1 and g['h1'] and g['h1s'] == 1)))
    check(f'{W}: the heading row starts at one height and one left edge on every main page', len(tops) == 1 and len(lefts) == 1,
          '; '.join(f"{r} {g['left']},{g['top']}" for r, g in got.items()) if len(tops) > 1 or len(lefts) > 1 else f'{lefts} {tops}')
    check(f'{W}: the top search box is on every main page, Bills too', all(g['search'] for g in got.values()), ', '.join(r for r, g in got.items() if not g['search']))
    check(f'{W}: a page\'s "…" menu is the last thing in its heading row', all(g['moreLast'] for g in got.values()), ', '.join(r for r, g in got.items() if not g['moreLast']))

# "Whose work" the same everywhere (fix 14, U-9): Mine | My coalitions | Team, those words, that order, on every list with such
# a switch; no "Every coalition", "The team's" or "Everyone" switch; the partner update's audience is "For: Partners / Staff".
WHOSE_ROUTES = ['/', '/?scope=team', '/bills', '/outreach', '/outreach/partners']
WHOSE_JS = r"""() => { const segs = [...document.querySelectorAll('main .sv-seg, main [role=group]')].filter(e => e.getClientRects().length);
  const whose = segs.filter(s => s.querySelector('[data-whose]')).map(s => [...s.querySelectorAll('button')].map(b => b.innerText.trim()));
  const stray = segs.filter(s => !s.querySelector('[data-whose]')).map(s => [...s.querySelectorAll('button, a')].map(b => b.innerText.trim()))
    .filter(l => l.some(x => /^(Mine|Team|The team’s|Everyone|Every coalition|My coalitions)$/.test(x)));
  const sw = [...document.querySelectorAll('main .sv-switchrow')].filter(e => /Every coalition/.test(e.innerText)).length;
  const aud = [...document.querySelectorAll('[data-seg="memoaud"]')].map(b => b.innerText.trim());
  return { whose, stray, sw, aud }; }"""
ORDER = ['Mine', 'My coalitions', 'Team']

def batch_c_whose(b, page, go):
  for who in ('SY', 'NT'):
    pg = page(who); bad = []; seen = 0; aud = []
    for i, r in enumerate(WHOSE_ROUTES):
      if i == 0: go(pg, r, 3000)
      else: pg.evaluate(f"location.hash = '#{r}'"); pg.wait_for_timeout(1400)
      g = pg.evaluate(WHOSE_JS); aud = g['aud'] or aud
      for l in g['whose']:
        seen += 1
        if not l or any(x not in ORDER for x in l) or [x for x in ORDER if x in l] != l or l[-1] != 'Team': bad.append(f'{r}: {" | ".join(l)}')
      bad += [f'{r}: stray switch {" | ".join(l)}' for l in g['stray']] + ([f'{r}: "Every coalition" switch'] if g['sw'] else [])
      if r == '/outreach/partners':   # the Staff audience shows the memo's own whose switch
        pg.locator('[data-seg="memoaud"][data-val="team"]').first.click(); pg.wait_for_timeout(900)
        g = pg.evaluate(WHOSE_JS)
        for l in g['whose']:
          seen += 1
          if [x for x in ORDER if x in l] != l or l[-1] != 'Team': bad.append(f'{r} (Staff): {" | ".join(l)}')
    check(f'{who}: one "whose work" switch, Mine | My coalitions | Team in that order, on every list ({seen} seen)', seen >= 4 and not bad, '; '.join(bad[:4]))
    check(f'{who}: the partner update is "For: Partners / Staff"', aud == ['Partners', 'Staff'], ' / '.join(aud))
    pg.context.close()

# Small things (fix 13): one bill-number size; key hints only after a key was used; the Inbox's mark-all-read off Shift+A;
# "Committee members" wraps on a phone; phone links in text are 44px targets; the issue chip does not repeat the bill's
# name; Julie's monitored hearing is named; an open group's heading does not count its rows.
def batch_c_small(b, page, go):
  pg = page('NT'); sizes = set()
  for i, r in enumerate(['/', '/bill/HB1562', '/hearing/9ebffb71-69c2-4868-8956-e624cac16d30', '/my-issues', '/outreach']):
    if i == 0: go(pg, r, 3000)
    else: pg.evaluate(f"location.hash = '#{r}'"); pg.wait_for_timeout(1400)
    sizes |= set(pg.evaluate("[...document.querySelectorAll('.bn-num')].filter(e => e.getClientRects().length).map(e => getComputedStyle(e).fontSize)"))
  check('A bill number beside its nickname is one size everywhere (13px)', sizes == {'13px'}, ', '.join(sorted(sizes)))
  go(pg, '/bill/HB1562', 2500)
  rep = pg.evaluate("[...document.querySelectorAll('main .bw-ichip')].map(e => e.innerText.trim())")
  check('Bill page: the issue chip does not repeat the bill\'s own name', rep and not any('Youth mental health app pilot' in x for x in rep), ' | '.join(rep))
  go(pg, '/my-issues', 2500)
  n = pg.evaluate("[...document.querySelectorAll('main .ist-sec .ist-h')].filter(h => /\\d/.test(h.innerText)).length")
  check('My issues: an open group\'s heading does not count its rows', n == 0, n)
  pg.context.close()
  # key hints: none on a device that never used a key; after J on Bills, Bills shows its line
  pg = page('NT'); hints = '.bl-keys, .td-keys, .ib-keys, .st-keys, .lk-keys'
  shown = []
  for i, r in enumerate(['/bills', '/review', '/inbox']):
    if i == 0: go(pg, r, 3000)
    else: pg.evaluate(f"location.hash = '#{r}'"); pg.wait_for_timeout(1400)
    if pg.evaluate(f"[...document.querySelectorAll('{hints}')].some(e => e.getClientRects().length)"): shown.append(r)
  check('Key hint lines hidden until someone uses a key (Bills, Review, Inbox)', not shown, ', '.join(shown))
  pg.evaluate("location.hash = '#/bills'"); pg.wait_for_timeout(1200); pg.evaluate("document.activeElement && document.activeElement.blur()")
  pg.keyboard.press('j'); pg.wait_for_timeout(300); pg.evaluate("location.hash = '#/inbox'"); pg.wait_for_timeout(1200)
  check('After a key is used, the Inbox shows its key line', pg.evaluate(f"[...document.querySelectorAll('.ib-keys')].some(e => e.getClientRects().length)"), '')
  txt = pg.inner_text('main'); pg.context.close()
  src = open(os.path.join(ROOT or '.', 'staff5/inbox.js')).read()
  check('Inbox: marking the list read is not Shift+A (Shift+A approves on Review)', "e.key === 'A' && e.shiftKey" not in src and 'Shift</kbd>+<kbd>M' in src, '')
  # phone: Committee members wraps; links inside text are 44px tall targets
  ctxs = []
  for who, r in [('NT', '/bill/HB1562'), ('NT', '/'), ('KR', '/'), ('PH', '/'), ('NT', '/hearing/9ebffb71-69c2-4868-8956-e624cac16d30'), ('NT', '/bills')]:
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True); ctx.route(HOST + '/**', router); pg = ctx.new_page(); pg.who = who
    go(pg, r, 3000)
    over = pg.evaluate("[...document.querySelectorAll('main .bw-cmfold')].filter(e => e.getBoundingClientRect().right > innerWidth + 1).length")
    small = pg.evaluate("[...document.querySelectorAll('main a, main button')].filter(e => { const q = e.getBoundingClientRect(); return q.width && q.height < 40 && !e.closest('dialog'); }).map(e => e.innerText.trim().slice(0, 30))")
    ctxs.append((who, r, over, small)); ctx.close()
  check('Phone: "Committee members" stays inside the screen', all(o == 0 for _, _, o, _ in ctxs), '')
  bad = [f'{w} {r}: {", ".join(s[:3])}' for w, r, _, s in ctxs if s]
  check('Phone: no target under 40px on Today, a bill, a hearing and Bills (A-6)', not bad, '; '.join(bad[:3]))
  pg = page('JMM'); go(pg, '/', 3000)
  line = pg.evaluate("(document.querySelector('.td-csub') || {}).innerText || ''")
  check('Julie: a week with only monitored hearings names them', re.search(r'We monitor [HS]B\d+', line), line[:120])
  pg.context.close()

def batch_c_looks(b, page, go):
  seen = {k: [] for k in WANT}
  for who, r in LOOK_SCREENS:
    pg = page(who); go(pg, r, 3000)
    for x in pg.evaluate(LOOKS): x['where'] = f'{who} {r}'; seen[x['act']].append(x)
    pg.context.close()
  for act, (cls, rx) in WANT.items():
    xs = seen[act]; bad = [f"{x['where']}: '{x['text']}' ({x['cls']})" for x in xs if cls not in x['cls'].split() or not re.match(rx, x['text'])]
    quiet = {(x['color'], x['weight'], x['icons']) for x in xs if x['kind'] == 'text'}
    icons = {x['icons'] for x in xs}
    check(f'One look for "{act}": {len(xs)} on {len(LOOK_SCREENS)} screens, one class, one name, one quiet style, one icon set',
          xs and not bad and len(quiet) <= 1 and len(icons) == 1, '; '.join(bad[:3]) or f'styles {quiet} icons {icons}')
  # status chips: drawn only by ui.js chip() (no hand-made "New", stance or "Today" badges), and no button wears the chip class
  # but the filter and pick toggles pub/base.css styles as button.chip
  src = {f: open(os.path.join(ROOT or '.', 'staff5', f)).read() for f in os.listdir(os.path.join(ROOT or '.', 'staff5')) if f.endswith('.js') and f != 'ui.js'}
  raw = [f for f, s in src.items() if re.search(r'<span class="chip[ "]|class="(bw-new|sp-st|td-now)[ "]|class="chip hr-gobtn', s)]
  check('Status chips: every one from ui.js chip(), none drawn by hand', not raw, ', '.join(raw))

# ---- batch d (fixes 5, 8, 11, 12, 15, 16): behaviour ----
def batch_d(b, page, go):
  # 5. Back after opening a side panel stays on the list, the panel closed, at the same scroll (fix 5, U-2, E-4)
  pg = page('NT'); go(pg, '/', 3000)
  pg.evaluate("window.scrollTo(0, 200)"); pg.wait_for_timeout(200)
  rows = pg.locator('.td-row .td-rsel'); n = rows.count()
  rows.nth(min(3, n - 1)).click(); pg.wait_for_timeout(500)
  x = pg.locator('#td-pane [data-pclose]').count(); y0 = pg.evaluate('scrollY')
  pg.go_back(); pg.wait_for_timeout(900)
  h, pane, y1 = pg.evaluate("location.hash"), pg.locator('#td-pane').count(), pg.evaluate('scrollY')
  check('Today: the open item has a close X', x == 1, x)
  check('Today: Back after opening an item stays on Today, the item closed, the same scroll', h in ('#/', '') and pane == 0 and abs(y1 - y0) <= 2, f'{h} pane {pane} y {y0}->{y1}')
  rows.nth(1).click(); pg.wait_for_timeout(400); pg.click('#td-pane [data-pclose]'); pg.wait_for_timeout(500)
  check('Today: its X closes it and Today stays', pg.locator('#td-pane').count() == 0 and pg.evaluate("location.hash") in ('#/', ''), '')
  go(pg, '/bills', 3000); pg.locator('[data-whose="team"]').first.click(); pg.wait_for_timeout(800)
  pg.evaluate("window.scrollTo(0, 400)"); pg.wait_for_timeout(200)
  pg.locator('tr[data-row] td.bl-ti').nth(6).click(); pg.wait_for_timeout(700)
  dock, y0 = pg.locator('.bl-dock').count(), pg.evaluate('scrollY')
  pg.go_back(); pg.wait_for_timeout(900)
  h, dk, y1 = pg.evaluate("location.hash"), pg.locator('.bl-dock').count(), pg.evaluate('scrollY')
  team = pg.locator('[data-whose="team"][aria-pressed="true"]').count()
  check('Bills: Back after docking a bill stays on Bills, the bill closed, Team kept, the same scroll', dock == 1 and h == '#/bills' and dk == 0 and team == 1 and abs(y1 - y0) <= 2, f'dock {dock} {h} after {dk} team {team} y {y0}->{y1}')

  # 11. Bills: At risk first, no open group over 25 rows, a quiet Sort new bills link (fix 11, V-2, F-10)
  heads = pg.evaluate("[...document.querySelectorAll('.bl-grb')].map(b => b.innerText.split('\\n')[0])")
  check('Bills (Team): the first group is "At risk: no hearing yet"', heads and heads[0].startswith('At risk'), heads[:2])
  big = pg.evaluate("[...document.querySelectorAll('tbody.bl-tg')].map(t => t.querySelectorAll('tr[data-row]').length).filter(n => n > 25)")
  more = pg.evaluate("[...document.querySelectorAll('.bl-morer .sv-showall')].map(e => e.innerText)")
  check('Bills (Team): no open group over 25 rows, a longer one ends "Show all N"', not big and more, f'{big} {more}')
  check('Bills: "Sort new bills (N)" link while bills wait', re.search(r'Sort new bills \(\d', pg.inner_text('main')), '')
  pg.evaluate("document.querySelector('[data-whose=\"mine\"]').click()"); pg.wait_for_timeout(600)
  pg.evaluate("[...document.querySelectorAll('[data-whose]')].find(e => e.dataset.whose === 'mine')?.click()"); pg.wait_for_timeout(600)
  owners = pg.evaluate("[...document.querySelectorAll('thead th')].map(t => t.innerText)")
  check('Bills (Mine): no Owner column when every row is the same person\'s', 'Owner' not in owners, owners)

  # 12. Undo filed beside Filed, on the bill page, the hearing page and Today's row menu (fix 12)
  go(pg, '/bill/HB2116', 2500)
  tb = pg.evaluate("[...document.querySelectorAll('.bw-tb .bw-acts')].map(e => e.innerText.replace(/\\s+/g, ' ')).join(' | ')")
  check('Bill page: "Undo filed" beside "Filed"', re.search(r'Filed\s*Undo filed', tb), tb)
  go(pg, '/hearing/5a71d2f7-2d0a-4f68-80b4-f2863edde848', 2500)
  check('Hearing page: "Undo filed" under the filed row', pg.locator('.hr-unf', has_text='Undo filed').count() == 1, '')
  pg.locator('.hr-unf button').click(); pg.wait_for_timeout(600)
  check('Hearing page: Undo filed undoes it', 'Testimony filed' not in pg.inner_text('main') and 'approved and ready to file again' in pg.inner_text('#toast'), '')
  go(pg, '/', 3000); found = ''
  # each row whose bill has testimony marked filed: open it and its "…" (beside the open item on a laptop)
  for num in pg.evaluate("[...document.querySelectorAll('.td-row[data-num]')].map(r => r.dataset.num)"):
    pg.locator(f'.td-row[data-num="{num}"] .td-rsel').first.click(); pg.wait_for_timeout(400)
    if not pg.locator('#td-pane [data-more]').count(): continue
    pg.locator('#td-pane [data-more]').first.click(); pg.wait_for_timeout(400)
    t = pg.inner_text('dialog[open]') if pg.locator('dialog[open]').count() else ''
    pg.keyboard.press('Escape'); pg.wait_for_timeout(400)
    if 'Undo filed' in t: found = num; break
  check("Today: a row's “…” offers Undo filed", found, found)

  # 8. Nothing typed is lost: the meeting note survives Esc and a reload; an error stays; offline is said (fix 8, E-5, E-9)
  go(pg, '/', 2500)
  lid = pg.evaluate("import('/staff5/data.js').then(m => (m.S.legislators || [])[0]?.id)")
  go(pg, f'/legislator/{lid}', 2500)
  def opennote():
    pg.locator('[data-lglog]').first.click(); pg.wait_for_timeout(600); return pg.locator('#cv-text')
  ta = opennote(); ta.fill('Met the chair: she wants the fiscal note first.'); pg.keyboard.press('Escape'); pg.wait_for_timeout(700)
  ta = opennote(); after_esc = ta.input_value(); pg.keyboard.press('Escape'); pg.wait_for_timeout(500)
  pg.reload(); pg.wait_for_timeout(3000); ta = opennote(); after_reload = ta.input_value(); pg.keyboard.press('Escape')
  check('Meeting note: survives Esc', 'fiscal note' in after_esc, after_esc[:40])
  check('Meeting note: survives a reload', 'fiscal note' in after_reload, after_reload[:40])
  pg.evaluate("import('/staff5/ui.js').then(m => m.toast('That did not save.', { err: true }))"); pg.wait_for_timeout(6500)
  check('An error message is still there after 6 s, with a close X', pg.locator('#toast .toastmsg.err .toastx').count() == 1, '')
  pg.context.set_offline(True); pg.wait_for_timeout(400); off = pg.locator('#sv-offline').count()
  pg.context.set_offline(False); pg.wait_for_timeout(400); on = pg.locator('#sv-offline').count()
  check('"You\'re offline" shows while offline and goes when back', off == 1 and on == 0, f'{off} {on}')
  check('No page errors on the batch d screens', not pg.errs, pg.errs[:1])
  pg.context.close()

  # 16. A phone on a hearing day: late and due-today items in one list, least time left first (fix 16)
  for who, asof in [('NT', '2026-03-17T08:00:00-10:00'), ('KR', '2026-03-20T08:00:00-10:00')]:
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True); ctx.route(HOST + '/**', router); pg = ctx.new_page()
    pg.goto(f"{HOST}/staff5.html?demo=1&as={who}&asof={asof}#/"); pg.wait_for_timeout(3500)
    heads = pg.evaluate("[...document.querySelectorAll('main h2')].map(h => h.innerText.split('\\n')[0])")
    left = pg.evaluate("[...document.querySelectorAll('.td-nowl .td-card')].map(c => { const t = (c.innerText.match(/^(\\d+)([hmd])/) || []); return t.length ? +t[1] * ({ m: 1 / 60, h: 1, d: 24 })[t[2]] : null; })")
    split = [x for x in heads if re.match(r'(Late testimony, still open|Overdue|Needs you today|Testimony and asks due today)', x)]
    vals = [x for x in left if x is not None]
    check(f'{who}, phone, hearing day: late and due today in one list, least time left first', any(x.startswith('Late or due today') for x in heads) and not split and vals == sorted(vals), f'{heads[:3]} {left}')
    ctx.close()

  # 15. First load asks for fewer modules: the screens not on Today load when opened, and staff5.html preloads the rest (fix 15, E-8)
  html = open(os.path.join(ROOT or '.', 'staff5.html')).read(); pre = re.findall(r'<link rel="modulepreload" href="([^"]+)"', html)
  app = open(os.path.join(ROOT or '.', 'staff5/app.js')).read()
  lazy = ['setup.js', 'supporters.js', 'person.js', 'list.js', 'emails.js', 'triage.js', 'me.js', 'devui.js', 'memo.js']
  static = [m for m in lazy if re.search(r"^import [^;]*from '\./" + re.escape(m) + "'", app, re.M)]
  missing = [p for p in pre if not os.path.isfile(os.path.join(ROOT or '.', p))]
  check('First load: Session setup, Outreach\'s supporters and emails, Sort new bills, the partner update and My settings load only when opened', not static and not any(p.endswith('/' + m) for p in pre for m in lazy), static)
  check(f'First load: staff5.html preloads {len(pre)} modules, each a real file', pre and not missing, missing[:3])
  ctx = b.new_context(viewport={'width': 1440, 'height': 900}); ctx.route(HOST + '/**', router); pg = ctx.new_page(); js = []
  pg.on('request', lambda r: js.append(r.url) if r.url.endswith('.js') else None)
  pg.goto(f"{HOST}/staff5.html?demo=1&as=NT#/"); pg.wait_for_selector('.td-root'); pg.wait_for_timeout(500)
  n0 = len(set(js)); got = [u for u in set(js) if any(u.endswith('/' + m) for m in lazy)]
  check(f'First load of Today: {n0} modules (56 before), none of the screens opened later', n0 < 56 and not got, got[:3])
  pg.evaluate("location.hash = '#/setup'"); pg.wait_for_timeout(2000)
  check('Session setup still opens (loaded on the way)', 'Session setup' in pg.inner_text('main') or 'Ready for session' in pg.inner_text('main'), pg.inner_text('main')[:60])
  ctx.close()

# ---- batch e (fixes 17, 18, 19, 20): the Show me pieces ----
# 17. One open-bill panel (U-1): the same bill opens with the same parts, in the same order, with the same deadline line,
# hearing line and one filled button, from Today and from Bills; the "…" and the close X sit last on its top line.
BP_ORDER = ['bp-top', 'bp-name', 'bp-sum', 'bp-due', 'bp-hear', 'bp-step', 'bp-sec', 'bp-facts', 'bp-open']
BP = r"""(sel) => { const root = document.querySelector(sel); if (!root) return null;
  const parts = [...root.children].map(e => e.classList.contains('bp-facts') ? 'bp-facts' : [...e.classList].find(c => c.startsWith('bp-'))).filter(Boolean);
  const say = e => e ? e.innerText.replace(/\s+/g, ' ').trim() : '';
  const top = [...root.querySelectorAll('.bp-top button')].map(b => (b.getAttribute('aria-label') || '').split(' ')[0]);
  return { parts, top, due: say(root.querySelector('.bp-due')), hear: say(root.querySelector('.bp-hl')), step: say(root.querySelector('.bp-s')),
    filled: [...root.querySelectorAll('.btn.primary')].filter(b => b.getClientRects().length).map(say), name: say(root.querySelector('.bp-name')) }; }"""

def batch_e_panel(b, page, go):
  pg = page('NT'); go(pg, '/', 3500)
  nums = pg.evaluate("[...document.querySelectorAll('.td-row[data-num]')].slice(0, 4).map(r => r.dataset.num)")
  today = {}
  for n in nums:
    pg.locator(f'.td-row[data-num="{n}"] .td-rsel').first.click(); pg.wait_for_timeout(400)
    today[n] = pg.evaluate(BP, '#td-pane')
  go(pg, '/bills', 3000); pg.locator('[data-whose="team"]').first.click(); pg.wait_for_timeout(700)
  bad, seen = [], 0
  for n in nums:
    pg.fill('#bl-q', n); pg.wait_for_timeout(700)
    pg.locator('tr[data-row] td.bl-ti').first.click(); pg.wait_for_timeout(700)
    d, t = pg.evaluate(BP, '.bl-dock'), today[n]
    if not d or not t: bad.append(f'{n}: no panel'); continue
    seen += 1
    for k in ('parts', 'top', 'due', 'hear', 'step', 'filled', 'name'):
      if d[k] != t[k]: bad.append(f'{n} {k}: Today {t[k]} / Bills {d[k]}')
  check(f'Fix 17: the same bill opens with the same panel from Today and Bills ({seen} bills: parts, order, deadline line, hearing line, step, filled button)', seen >= 3 and not bad, '; '.join(bad[:3]))
  ok = all(t and [BP_ORDER.index(x) for x in t['parts']] == sorted(BP_ORDER.index(x) for x in t['parts']) and t['parts'][0] == 'bp-top' and t['parts'][-1] == 'bp-open' for t in today.values())
  check('Fix 17: the panel runs bill, deadline line, hearing line, step, the rest, Open the bill; "…" then the close X on its top line', ok and all(t['top'] == ['More', 'Close'] and len(t['filled']) <= 1 for t in today.values()), str(list(today.values())[0])[:200])
  # a bill with nothing to do on it opens in the same frame on Bills
  pg.fill('#bl-q', ''); pg.wait_for_timeout(500)
  pg.locator('tbody.bl-tg tr[data-row] td.bl-ti').first.click(); pg.wait_for_timeout(700)
  d = pg.evaluate(BP, '.bl-dock')
  check('Fix 17: a bill with no step opens in the same frame on Bills', d and d['parts'][0] == 'bp-top' and d['parts'][-1] == 'bp-open' and d['top'] == ['More', 'Close'] and 'bp-step' in d['parts'], str(d)[:160])
  check('Fix 17: no page errors on Today and Bills', not pg.errs, pg.errs[:1])
  pg.context.close()

# 18. Calm at session volume (V-1..V-7), the practice data doubled as it is served (grow): each person's most urgent item
# is on the first screen at 1440x900, and no open list that grows with the session holds more than 25 rows. Legislators
# and Supporters are directories of fixed size, searched rather than worked through, and are left out.
URGENT = r"""() => { const e = [...document.querySelectorAll('.td-root .td-row, .td-root .td-card, .td-root .td-mine, .td-root [data-top]')].find(x => x.getClientRects().length);
  if (!e) return null; const q = e.getBoundingClientRect(); return { top: Math.round(q.top), bottom: Math.round(q.bottom), text: e.innerText.replace(/\s+/g, ' ').slice(0, 60) }; }"""
LONG = r"""() => { const vis = e => e.getClientRects().length && !e.closest('details:not([open])'); const out = [];
  for (const l of document.querySelectorAll('main ul, main ol, main .rows, main .td-rows, main .td-list, main .td-mrows, main .ib-list, main .wk-col')) {
    const n = l.matches('.wk-col') ? [...l.querySelectorAll('.wk-bills > li, .wk-others > li, a.wk-timed, details.wk-blk')].filter(vis).length : [...l.children].filter(vis).length;
    if (n > 25) out.push(`${l.className || l.tagName}: ${n}`); }
  for (const t of document.querySelectorAll('main tbody.bl-tg')) { const n = [...t.querySelectorAll('tr[data-row]')].filter(vis).length; if (n > 25) out.push(`Bills group: ${n}`); }
  return out; }"""
VOL_ROUTES = ['/', '/?scope=team', '/?view=week', '/bills', '/outreach', '/inbox', '/my-issues', '/coalition', '/review']

def batch_e_volume(b, times=2):
  first, long = [], []
  for who in PEOPLE:
    ctx = b.new_context(viewport={'width': 1440, 'height': 900}); ctx.route(HOST + '/**', router_times(times)); pg = ctx.new_page()
    pg.goto(f"{HOST}/staff5.html?demo=1&as={who}#/"); pg.wait_for_timeout(7000)
    u = pg.evaluate(URGENT)
    if not u or u['bottom'] > 900 or u['top'] < 0: first.append(f'{who}: {u}')
    for i, r in enumerate(VOL_ROUTES):
      if i: pg.evaluate(f"location.hash = '#{r}'"); pg.wait_for_timeout(2200)
      long += [f'{who} {r} {x}' for x in pg.evaluate(LONG)]
    # Bills on Team, where every bill is
    pg.evaluate("location.hash = '#/bills'"); pg.wait_for_timeout(1800); pg.locator('[data-whose="team"]').first.click(); pg.wait_for_timeout(1500)
    long += [f'{who} /bills (Team) {x}' for x in pg.evaluate(LONG)]
    ctx.close()
  check(f'Fix 18 at {times}x the practice data: each person\'s most urgent item is on their first screen at 1440 (8 people)', not first, '; '.join(first[:3]))
  check(f'Fix 18 at {times}x the practice data: no open list over 25 rows ({len(VOL_ROUTES) + 1} screens, 8 people)', not long, '; '.join(long[:4]))

def batch_e_volume_parts(b):
  # The pieces themselves, at double data: the asks (8, P1 first, the copy buttons above), the week's days (6, then "+N more",
  # the deadlines above the grid), Needs you today (10, then Show all), the phone's week (later days folded), phone Team (rows).
  ctx = b.new_context(viewport={'width': 1440, 'height': 900}); ctx.route(HOST + '/**', router_times(2)); pg = ctx.new_page()
  pg.goto(f"{HOST}/staff5.html?demo=1&as=KR#/outreach"); pg.wait_for_timeout(7000)
  a = pg.evaluate("""() => { const l = [...document.querySelectorAll('.td-asklist li')]; const c = document.querySelector('[data-wkasks]'), list = document.querySelector('.td-asklist');
    return { n: l.length, p1: l.map(x => /P1/.test(x.innerText)), above: !!(c && list && (c.compareDocumentPosition(list) & 4)), all: (document.querySelector('[data-asksall]') || {}).innerText || '' }; }""")
  p1 = a['p1']; p1ok = p1 == sorted(p1, reverse=True)
  check('Fix 18: This week\'s asks show 8, P1 first, the copy buttons above the list, then "Show all N"', a['n'] == 8 and p1ok and a['above'] and re.match(r'Show all \d+ asks', a['all']), str(a)[:160])
  pg.evaluate("location.hash = '#/?view=week'"); pg.wait_for_timeout(2500)
  w = pg.evaluate("""() => { const days = [...document.querySelectorAll('.wk-day')].map(d => [[...d.querySelectorAll('.wk-bills > li, .wk-others > li, a.wk-timed, details.wk-blk')].filter(e => e.getClientRects().length && !e.closest('details:not([open])')).length, (d.querySelector('.wk-dmore') || {}).innerText || '']);
    const dl = document.querySelector('.ah-top'), grid = document.querySelector('.td-weekgrid'); return { days, above: !!(dl && grid && (dl.compareDocumentPosition(grid) & 4)) }; }""")
  check('Fix 18: each day of This week shows at most 6 rows, then "+N more"; the deadlines sit above the grid', w['days'] and all(n <= 6 for n, _ in w['days']) and any(re.match(r'\+\d+ more', m) for _, m in w['days']) and w['above'], str(w)[:200])
  ctx.close()   # Needs you today at four times the data, where it holds more than 10 for Nate
  ctx = b.new_context(viewport={'width': 1440, 'height': 900}); ctx.route(HOST + '/**', router_times(4)); pg = ctx.new_page()
  pg.goto(f"{HOST}/staff5.html?demo=1&as=NT#/"); pg.wait_for_timeout(12000)
  g = pg.evaluate("""() => [...document.querySelectorAll('.td-group')].map(s => [(s.querySelector('h2') || {}).innerText || '', s.querySelectorAll('.td-rows > .td-row, .td-list > .td-card').length, !!s.querySelector('.td-gmore .sv-showall')])""")
  today = [[h.split('\n')[0], int((re.findall(r'\d+', h) or ['0'])[-1]), n, more] for h, n, more in g if h.startswith('Needs you today')]
  check('Fix 18: "Needs you today" shows 10, then "Show all N"', today and today[0][2] == min(10, today[0][1]) and (today[0][1] <= 10 or today[0][3]), str(today)[:120])
  ctx.close()
  for who, r, js, name in [('KR', '/?view=week', "[...document.querySelectorAll('.ah-day')].map(d => !!d.querySelector('details.ah-dfold:not([open])'))", 'phone week'),
                           ('NT', '/?scope=team', "[document.querySelectorAll('main .td-mrow').length, document.querySelectorAll('main .td-card').length]", 'phone Team')]:
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True); ctx.route(HOST + '/**', router_times(2)); pg = ctx.new_page()
    pg.goto(f"{HOST}/staff5.html?demo=1&as={who}#{r}"); pg.wait_for_timeout(7000); x = pg.evaluate(js); ctx.close()
    if name == 'phone week': check('Fix 18: the phone\'s week keeps today and tomorrow open and folds each later day', len(x) >= 3 and not any(x[:2]) and all(x[2:]), str(x))
    else: check('Fix 18: Team on a phone is rows, not cards', x[0] > 0 and x[1] == 0, str(x))

# 19. Places in the top search box (F-1): "qr", "pings" and "inbox" show a place first, at most 3, in the header's
# suggestions and on the search page.
def batch_e_places(b, page, go):
  pg = page('NT'); go(pg, '/', 3000); bad = []
  for q, want in [('qr', 'QR code'), ('pings', 'My settings: alerts'), ('inbox', 'Inbox'), ('notifications', 'My settings: alerts'), ('partner update', 'Partner update'), ('sort new bills', 'Sort new bills'), ('file', 'How to file at the Capitol')]:
    inp = pg.locator('#hq'); inp.fill(''); inp.type(q, delay=20); pg.wait_for_timeout(900)
    g = pg.evaluate("() => [...document.querySelectorAll('.sg .sg-g')].map(g => [g.querySelector('.sg-h').innerText, [...g.querySelectorAll('.sg-l')].map(x => x.innerText)])")
    if not g or g[0][0] != 'Places' or len(g[0][1]) > 3 or g[0][1][0] != want: bad.append(f'{q}: {g[:1]}')
  inp.fill(''); pg.keyboard.press('Escape')
  check('Fix 19: the top search box shows a Places group first, the right place first, at most 3 (qr, pings, inbox and 4 more)', not bad, '; '.join(bad[:3]))
  go(pg, '/search?q=qr', 2500)
  s = pg.evaluate("() => { const f = document.querySelector('#lg-sres > *'); return [f && f.className, [...document.querySelectorAll('#lg-sres .lg-places .title')].map(x => x.innerText)]; }")
  check('Fix 19: the search page shows Places above the results ("qr")', s[0] and 'lg-places' in s[0] and s[1][:1] == ['QR code'], str(s))
  pg.context.close()
  pg = page('KR'); go(pg, '/', 3000); inp = pg.locator('#hq'); inp.type('session setup', delay=20); pg.wait_for_timeout(900)
  t = pg.evaluate("() => [...document.querySelectorAll('.sg .sg-l')].map(x => x.innerText)"); pg.context.close()
  check('Fix 19: Session setup is a place for admins only', 'Session setup' not in t, str(t[:4]))

# 20. Tabs look like tabs, pills only show a list another way, one Filter button on every list that filters (U-3).
TABLOOK = r"""() => { const st = e => { const c = getComputedStyle(e), a = getComputedStyle(e, '::after'); return [c.fontSize, c.fontWeight, c.color, c.backgroundColor, c.borderTopLeftRadius, a.content !== 'none' ? a.height + ' ' + a.backgroundColor : '-'].join('|'); };
  const vis = e => e.getClientRects().length;
  const tabs = [...document.querySelectorAll('main .sv-tabrow > a, main .sv-tabrow > button')].filter(vis).map(e => [e.matches('[aria-current="page"], [aria-pressed="true"]') ? 'on' : 'off', st(e)]);
  const pills = [...document.querySelectorAll('main .sv-seg > button')].filter(vis).map(e => [e.getAttribute('aria-pressed') === 'true' ? 'on' : 'off', st(e)]);
  const navPills = [...document.querySelectorAll('main .sv-seg')].filter(e => vis(e) && (e.tagName === 'NAV' || e.querySelector('a'))).length;
  const f = [...document.querySelectorAll('main .sv-filter, main button')].filter(e => vis(e) && /^Filter\b/.test(e.innerText.trim()));
  const head = document.querySelector('main .sv-phead');
  const ctrls = head ? [...head.querySelectorAll('button, a, input')].filter(vis) : [];
  const fi = f.length === 1 ? ctrls.indexOf(f[0]) : -2, last = ctrls[ctrls.length - 1], more = last && /^More/.test(last.getAttribute('aria-label') || '');
  const fl = f[0] ? (q => [Math.round(q.height), getComputedStyle(f[0]).fontSize, f[0].className])(f[0].getBoundingClientRect()) : null;
  return { tabs, pills, navPills, filters: f.length, filterInHead: fi >= 0 && (fi === ctrls.length - 1 || (more && fi === ctrls.length - 2)), fl }; }"""
TAB_ROUTES = ['/outreach', '/outreach/partners', '/outreach/emails', '/outreach/supporters', '/my-issues', '/outreach/issues', '/coalition', '/inbox', '/', '/?view=week', '/bills', '/legislators', '/help']
FILTER_ROUTES = ['/bills', '/legislators', '/outreach/supporters', '/inbox']

def batch_e_tabs(b, page, go):
  pg = page('NT'); on_t, off_t, on_p, off_p, nav, fl, bad = set(), set(), set(), set(), [], set(), []
  for i, r in enumerate(TAB_ROUTES):
    if i == 0: go(pg, r, 3000)
    else: pg.evaluate(f"location.hash = '#{r}'"); pg.wait_for_timeout(1500)
    x = pg.evaluate(TABLOOK)
    for k, s in x['tabs']: (on_t if k == 'on' else off_t).add(s)
    for k, s in x['pills']: (on_p if k == 'on' else off_p).add(s)
    if x['navPills']: nav.append(r)
    if r in FILTER_ROUTES:
      if x['filters'] != 1 or not x['filterInHead']: bad.append(f"{r}: {x['filters']} Filter, in the heading row's end: {x['filterInHead']}")
      else: fl.add(tuple(x['fl'][:2]))
    elif x['filters']: bad.append(f"{r}: a Filter button on a page that is not a filtered list")
  check('Fix 20: tabs have one look (one for the open tab, one for the rest), with the bar under the open one', len(on_t) == 1 and len(off_t) == 1 and '-' not in next(iter(on_t)).split('|')[-1:], f'{on_t} {off_t}'[:200])
  check('Fix 20: pill switches have one look, and none of them moves between pages', len(on_p) == 1 and len(off_p) == 1 and not nav and on_t.isdisjoint(on_p), f'{len(on_p)} {len(off_p)} {nav}')
  check(f'Fix 20: every list page that filters has one Filter button, at the end of its heading row, one size ({", ".join(FILTER_ROUTES)})', not bad and len(fl) == 1, '; '.join(bad[:3]) or str(fl))
  go(pg, '/bill/HB2121', 2500)
  ic = pg.evaluate("[...document.querySelectorAll('main .bw-ichip')].map(e => [e.tagName, e.className])")
  check('Fix 20: the bill page\'s issue is a link, not drawn as a chip', ic and all(t == 'A' and 'chip' not in c.split() for t, c in ic), str(ic))
  src = ''.join(open(os.path.join(ROOT or '.', 'staff5', f)).read() for f in ('css/today.css', 'css/legislators.css', 'css/conversation.css'))
  check('Fix 20: no screen redraws a status chip at its own size (one small size, ui.js chip({ sm }))', not re.search(r'\.sv-chip\s*\{[^}]*(min-height|font-size|padding)', src), '')
  pg.evaluate("location.hash = '#/bills'"); pg.wait_for_timeout(1500); pg.locator('[data-whose="team"]').first.click(); pg.wait_for_timeout(900)
  cut = pg.evaluate("[...document.querySelectorAll('.bl-noword')].filter(e => e.getClientRects().length).map(e => { const c = e.closest('td'); return c.scrollWidth > c.clientWidth + 1 || e.getBoundingClientRect().right > c.getBoundingClientRect().right + 1; })")
  check('Fix 20: Bills\' "No owner" is never cut', cut and not any(cut), str(cut[:5]))
  pg.context.close()

def batch_e(b, page, go):
  batch_e_panel(b, page, go)
  batch_e_places(b, page, go)
  batch_e_tabs(b, page, go)
  batch_e_volume_parts(b)
  batch_e_volume(b, 2)

def main():
  with sync_playwright() as p:
    b = p.chromium.launch()
    def page(who, W=1440, H=900):
      ctx = b.new_context(viewport={'width': W, 'height': H}); ctx.route(HOST + '/**', router); pg = ctx.new_page()
      pg.errs = []; pg.on('pageerror', lambda e: pg.errs.append(str(e))); pg.who = who; return pg
    def go(pg, route='/', wait=2500):
      pg.goto(f"{HOST}/staff5.html?demo=1&as={pg.who}#{route}"); pg.wait_for_timeout(wait)

    # ONLY=b, ONLY=c, ONLY=d or ONLY=e runs one batch's checks (the whole file runs them all)
    only = os.environ.get('ONLY', '')
    def batch_b():
      # 1. No retired wording on any main screen, for three people
      for who in ['NT', 'JS', 'PH']:
        pg = page(who); found = {}
        for i, r in enumerate(SCREENS):
          if i == 0: go(pg, r, 3500)
          else: pg.evaluate(f"location.hash = '#{r}'"); pg.wait_for_timeout(1300)
          txt = pg.inner_text('body')
          for name, rx in RETIRED:
            if rx and re.search(rx, txt): found.setdefault(name, []).append(r)
        check(f'{who}: no retired wording on {len(SCREENS)} screens', not found, '; '.join(f'{k} on {", ".join(v[:3])}' for k, v in found.items()))
        check(f'{who}: no page errors on the main screens', not pg.errs, pg.errs[:1])

      # 2. The partner update speaks to partners: committee names, deadlines said plainly, no legislative day (fix 7)
      pg = page('LR'); go(pg, '/outreach/partners', 3500)
      memo = pg.inner_text('main')
      codes = pg.evaluate("Object.keys((window.S || {}).committees || {})") or []
      left = sorted({c for c in re.findall(r'\b[A-Z]{2,4}\b', memo) if c in codes}) if codes else re.findall(r'\b(?:HHS|CPN|HLT|FIN|WAM|TRN|EDN|JDC)\b', memo)
      check('Partner update: no committee codes', not left, ', '.join(left[:6]))
      check('Partner update: no Capitol deadline names (triple filing, lateral, decking)', not re.search(r'triple filing|\blateral\b|\bdecking\b', memo, re.I), '')
      check('Partner update: no legislative day', not re.search(r'[Ll]egislative day|\bDay \d+ of', memo), '')
      check('Partner update: says a committee by name', re.search(r'(Senate|House) [A-Z][a-z]+.* committee', memo), memo[:80].replace('\n', ' '))

      # 3. Time said one way: "due today 9:30 AM · 28 min" shape, no "under an hour" (fix 3); hearing rooms as "Room 430"
      pg = page('NT'); go(pg, '/bill/SB3234', 3500); txt = pg.inner_text('main')
      check('Bill page: a hearing room says "Room", not "Rm"', 'Rm ' not in txt and ('Room ' in txt or 'room' in txt), '')

      # 4. Help: opens on New here? for someone new, finds words one by one, has the filing steps and the alerts (fix 9)
      pg = page('PH'); go(pg, '/help', 3000)
      h1 = pg.evaluate("(document.querySelector('main h1') || {}).innerText || ''")
      first = pg.evaluate("(() => { const n = document.querySelector('.st-nav2 .st-navi, .st-help h2'); return n ? n.innerText : ''; })()")
      check('Help: opens on "New here?" for someone new', 'New here' in h1 or 'New here' in first, f'{h1} / {first}')
      def search(q):
        inp = pg.locator('#st-hq').first; inp.fill(''); inp.type(q); pg.wait_for_timeout(400)
        return pg.inner_text('#st-hres')
      for q, want in [('how do I file', 'How to file at the Capitol'), ('file testimony', 'How to file at the Capitol'), ('QR', 'QR code'),
                      ('qr code for a hearing', 'QR code'), ('pings', 'Which alerts you get'), ('where is the partner update', 'Outreach')]:
        res = search(q); top = pg.evaluate("[...document.querySelectorAll('#st-hres .row')].slice(0, 3).map(r => r.innerText).join(' | ')")
        check(f'Help search "{q}" finds {want} in its first three', want in top, top[:120].replace('\n', ' '))
      pg.evaluate("location.hash = '#/help/where'"); pg.wait_for_timeout(800)
      check('Help: "Where things live" is named for Drive and Slack', 'Drive, Slack' in pg.inner_text('main'), '')

      # 5. The Mark filed sheet links How to file at the Capitol (fix 9)
      src = open(os.path.join(ROOT or '.', 'staff5/bill.js')).read() + open(os.path.join(ROOT or '.', 'staff5/today.js')).read()
      check('Mark filed sheets (bill page and Today) link the filing steps', src.count("'#/help/file'") >= 2, '')

      # 6. Every link in the avatar menu and in Session setup opens a real page (fix 6, E-1, W-4)
      def real(url):
        u = urlparse(url); path = unquote(u.path).lstrip('/') or 'index.html'
        if ROOT: return os.path.isfile(os.path.join(ROOT, path))
        try: return urlopen(url, timeout=10).status == 200
        except Exception: return False
      pg = page('NT', 1024, 800); go(pg, '/', 3000)   # under 1100px, so the menu holds My settings, Session setup and Help too
      labels = pg.evaluate("(() => { document.querySelector('[data-avatar]').click(); return new Promise(r => setTimeout(() => r([...document.querySelectorAll('dialog[open] .sv-menu button .title')].map(e => e.innerText)), 500)); })()")
      bad = []
      for lab in labels:
        if lab in ('Refresh', 'Sign out') or lab.startswith('Practice as'): continue
        go(pg, '/', 2000); pg.click('[data-avatar]'); pg.wait_for_timeout(500)
        pg.locator('dialog[open] .sv-menu button', has_text=lab).first.click(); pg.wait_for_timeout(1500)
        url = pg.url; path = urlparse(url).path
        if not real(url): bad.append(f'{lab} -> {url}')
        elif lab.startswith('Open') and path.endswith('staff5.html'): bad.append(f'{lab} reloads v5')
        elif path.endswith('staff5.html') and not pg.inner_text('main').strip(): bad.append(f'{lab}: empty page')
      check(f'Avatar menu: all {len(labels)} items open a real page', labels and not bad, '; '.join(bad))
      go(pg, '/me', 2500)
      cur = pg.evaluate("[...document.querySelectorAll('main a')].filter(a => /current app/i.test(a.innerText)).map(a => a.href)")
      check('My settings: "Open the current app" opens a real page, not Staff v5 again', cur and all(real(u) and not urlparse(u).path.endswith('staff5.html') for u in cur), cur)
      hrefs = []
      for r in ['/setup', '/setup/tests', '/setup/room']:
        go(pg, r, 2500); hrefs += pg.evaluate("[...document.querySelectorAll('main a[href]')].map(a => a.href).filter(h => !h.includes('#') || !h.split('#')[0].endsWith('staff5.html'))")
      ext = [h for h in hrefs if urlparse(h).netloc == urlparse(HOST).netloc]
      miss = sorted({h for h in ext if not real(h)})
      check(f'Session setup: all {len(ext)} test and page links open a real page', ext and not miss, ', '.join(miss[:4]))
    if only in ('', 'b'): batch_b()
    if only in ('', 'c'): batch_c(b, page, go)
    if only in ('', 'd'): batch_d(b, page, go)
    if only in ('', 'e'): batch_e(b, page, go)
    b.close()
  bad = [r for r in results if not r[1]]
  print(f'{len(results) - len(bad)} of {len(results)} checks met')
  sys.exit(1 if bad else 0)

if __name__ == '__main__':
  main()
