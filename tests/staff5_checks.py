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

def main():
  with sync_playwright() as p:
    b = p.chromium.launch()
    def page(who, W=1440, H=900):
      ctx = b.new_context(viewport={'width': W, 'height': H}); ctx.route(HOST + '/**', router); pg = ctx.new_page()
      pg.errs = []; pg.on('pageerror', lambda e: pg.errs.append(str(e))); pg.who = who; return pg
    def go(pg, route='/', wait=2500):
      pg.goto(f"{HOST}/staff5.html?demo=1&as={pg.who}#{route}"); pg.wait_for_timeout(wait)

    # ONLY=b or ONLY=c runs one batch's checks (the whole file runs both)
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
    b.close()
  bad = [r for r in results if not r[1]]
  print(f'{len(results) - len(bad)} of {len(results)} checks met')
  sys.exit(1 if bad else 0)

if __name__ == '__main__':
  main()
