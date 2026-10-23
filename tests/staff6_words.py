# Staff v6: the words on every screen (R-336 V19, V35, spec 5 and 7.6). Walks every route of the spec's map as the eight
# people (1440x900, the busiest practice day; each place's front page also on the prep day and in the opening weeks; Kris
# and Lauren on a phone on their hearing days) and reads the rendered text, not the code (words_test never read staff5/):
#   1. never "vape", "vapes", "vaping" (R-158) in anything HIPHI writes; the Legislature's own titles stay as written
#      (HB1248's "RELATING TO A VAPING STORE REGISTRY" is allowed, because the practice data's official text says it);
#   2. never a programmer's note: an item number ("R-316") or "//" outside a web address; the same for what the Copy
#      buttons put on the clipboard (the weekly memo once carried a code comment, model.js:462);
#   3. one wording per testimony state (spec 5: Writing · With an approver · Second look · Ready to file · Filed, and
#      Missed; "sent back" is a flag on Writing: "Writing · sent back by Kris"). Counted on items, not on page tabs, menus or
#      buttons ("To approve" and "Sent back" are Testimony's tabs). v5 had 10+ wordings of "sent back" alone (X8);
#   4. every place Help names (on Today, in My settings, under Outreach, a bold place name) exists in the app's navigation:
#      the sidebar, the phone's tab bar and More page, the account menu, each place's page tabs and More tools.
#
#   APP=staff6 python3 tests/staff6_words.py      exits 1 when a rule is broken
#   APP=staff5 python3 tests/staff6_words.py      the same reading of v5 (the baseline); prints only
#   V4_ROOT=/path/to/worktree ...                 serves that folder straight into the browser (otherwise HOST, :8832)
#   --workers 6
import json, os, re, sys, time
from concurrent.futures import ProcessPoolExecutor
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import staff6_lib as L
from staff6_budget import ROUTES

# ---- 3: the wordings of each testimony state; the first is v6's one wording (spec 5 testimonyState) ----
STATES = [   # a leading "=" keeps the case (a capitalised label); the rest ignore case. Verbs (Approve, Revise and resubmit)
             # are steps, not states, and are not counted.
  ('Writing', [r'=\bWriting\b', r'\bbeing written\b', r'\bdraft in progress\b', r'\bnot started\b', r'\bno (?:testimony )?draft(?: yet)?\b', r'=\bDraft\b(?! [a-z])']),
  ('sent back (a flag on Writing)', [r'=\b[Ss]ent back by [A-Z]', r'\bsent back\b(?! by)', r'\bneeds? changes\b', r'\bchanges (?:asked|requested)\b',
     r'\breturned to\b', r'=[A-Z]\w+’s to revise\b']),
  ('With an approver', [r'\bwith an approver\b', r'\bwaiting for (?:approval|an approver)\b', r'=\bwaiting for [A-Z]\w+’s approval\b', r'\bin review\b',
     r'\bawaiting approval\b', r'\bsubmitted for approval\b']),
  ('Second look', [r'\bsecond look\b', r'\bsecond approval\b', r'\b2nd approval\b', r'\bsecond review\b', r'\bfinal approval\b']),
  ('Ready to file', [r'\bready to file\b', r'=\bApproved\b(?! by)', r'\bready for filing\b']),
  ('Filed', [r'=\bFiled\b(?! under)', r'\bsubmitted to the capitol\b', r'\bmarked filed\b', r'\bsent to the capitol\b']),
  ('Missed', [r'=\bMissed\b', r'\bnot filed\b', r'\bwasn.t filed\b', r'\bno testimony filed\b']),
]
# ---- 4: the names of places a Help page might use, the v5 ones v6 retires included ----
# ("Review" is left out: it is a button and a mode opened from To approve, not a place.)
PLACES = ['Today', 'This week', 'Hearings', 'Get hearings', 'Testimony', 'To write', 'To approve', 'Sent back', 'Ready to file',
  'Outreach', 'This week’s asks', 'Partner update', 'Emails', 'Supporters', 'Lists', 'Bills', 'Sort new bills', 'Muted bills',
  'Legislators', 'Who to ask', 'Everyone', 'Holding our bills', 'My issues', 'Coalitions', 'All issues', 'Inbox', 'Messages', 'Updates',
  'Help', 'What moved', 'Team', 'People', 'Partners', 'Session setup', 'More tools', 'My settings', 'Weekly memo', 'Your menu', 'Tasks',
  'Team view', 'Mine', 'Each person’s list', 'Prep board', 'Next up', 'Next step', 'Team talk', 'Activity', 'deadline box', 'More']
# Screens whose words are not testimony states: Help explains them; lists, emails, supporters and partner groups have
# states of their own ("Draft" list, an email "waiting for approval", a group "to approve").
NOT_STATES = {'help', 'help-topic', 'what-moved', 'lists', 'a-list', 'emails', 'composer', 'a-supporter', 'partners', 'supporters'}
CONTEXT = r'(?:on|in|from|under|open|opens|go to|tap|press|choose|see|use)\s+(?:the\s+|your\s+)?'

SCAN = r"""(arg) => {
  const vis = e => { const s = getComputedStyle(e); return s.visibility !== 'hidden' && s.display !== 'none' && e.getClientRects().length; };
  const official = arg.official, out = { vape: [], notes: [], states: {} };
  const tw = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n;
  const norm = s => s.replace(/\s+/g, ' ').replace(/[…]+$/, '').trim().toLowerCase();
  while ((n = tw.nextNode())) { const v = n.nodeValue; if (!v.trim() || !n.parentElement || !vis(n.parentElement) || n.parentElement.closest('script, style, .sr')) continue;
    if (/\bvap(e|es|ing|er|ers)\b/i.test(v) && !official.some(o => o.includes(norm(v)) || norm(v).includes(o))) out.vape.push(v.trim().slice(0, 100));
    if (/\bR-\d{3}\b/.test(v) || /(^|[^:\w])\/\/(?!\/)/.test(v)) out.notes.push(v.trim().slice(0, 100)); }
  // the testimony states: the words on items (rows, cards, status tags) about testimony, not page tabs, menus, buttons,
  // the sidebar or a guide's prose (Help is skipped: it explains the words)
  const main = document.querySelector('main'); if (!main || arg.prose) return out;
  const ITEM = 'li, tr, article, .card, [class*=card], [class*=row], .chip, .sv-chip, .v6-status, .v6-step, .v6-hcard, [role=listitem], [role=row]';
  const ABOUT = /testimon|draft|approv|revis|resubmit|second look|ready to file|\bfiled\b|writing/i;
  let items = [...main.querySelectorAll(ITEM)].filter(e => vis(e) && !e.closest('nav, [role=tablist], [role=menu], dialog, details:not([open]) > :not(summary)'));
  items = items.filter(e => !items.some(o => o !== e && o.contains(e)));
  const said = e => { let s = ''; const w = document.createTreeWalker(e, NodeFilter.SHOW_TEXT); let x;
    while ((x = w.nextNode())) { const el = x.parentElement; if (!el || !x.nodeValue.trim() || !vis(el) || el.closest('nav, [role=tablist], button, a.btn, summary, .sr, textarea, input, select')) continue; s += ' ' + x.nodeValue; }
    return s.replace(/\s+/g, ' ').trim(); };
  for (const it of items) { const text = said(it); if (!ABOUT.test(text)) continue;
    arg.states.forEach(([name, rxs]) => rxs.forEach(src => { const cs = src[0] === '=', body = cs ? src.slice(1) : src;
      const m = text.match(new RegExp(body, cs ? 'g' : 'gi')); if (!m) return;
      const e = ((out.states[name] ??= {})[src] ??= { n: 0, ex: '' }); e.n += m.length; if (!e.ex) { const i = text.search(new RegExp(body, cs ? '' : 'i')); e.ex = text.slice(Math.max(0, i - 30), i + 60); } })); }
  return out; }"""

def official_texts():
  try: s = json.loads(L._raw('demo/snapshot.json'))
  except Exception: return []
  out = []
  for b in s.get('bills', []):
    for k in ('title', 'description', 'status_text', 'last_action'):
      v = b.get(k) or ''
      if re.search(r'vap', v, re.I): out.append(re.sub(r'\s+', ' ', v).strip().lower())
  for h in s.get('hearings', []):
    v = h.get('description') or ''
    if re.search(r'vap', v, re.I): out.append(re.sub(r'\s+', ' ', v).strip().lower())
  return out

_B = None
def _init():
  global _B
  from playwright.sync_api import sync_playwright
  _B = L.Browser(sync_playwright().start())

def read_job(job):
  who, w, h, extra, keys = job; pg = _B.page(who, w, h); out = []
  try:
    first = True
    for key in keys:
      r = next(x for x in ROUTES if x[0] == key); route = r[2] if L.V5 else r[1]
      if route is None: continue
      if first: pg.open(route, extra); first = False
      else: pg.nav(route)
      x = pg.page.evaluate(SCAN, {'official': OFFICIAL, 'states': STATES, 'prose': key in NOT_STATES}); x.update(who=who, size=f'{w}x{h}', clock=extra, route=key, errors=pg.errors[-1:])
      out.append(x)
  finally: pg.close()
  return out

OFFICIAL = official_texts()

def nav_labels(b):
  """Every name the app's navigation shows: sidebar, account menu, page tabs of each place, More tools; on a phone the tab
  bar and the More page."""
  names = set()
  def add(xs):
    for x in xs:
      x = re.sub(r'\s+\d+\+?$', '', (x or '').split('\n')[0]).strip()
      if x: names.add(x.lower().replace("'", '’'))
  pg = b.page('NT', 1440, 900); pg.open('/')
  grab_side = "() => [...document.querySelectorAll('aside a, aside button, header nav a')].filter(e => e.getClientRects().length).map(e => e.innerText)"
  add(pg.page.evaluate(grab_side))
  # the account menu (v6: "You" at the sidebar's foot; v5: the initials button)
  btn = pg.page.query_selector('.sv-avbtn') if L.V5 else None
  you = btn or L.find(pg.page, re.compile(r'^\s*You\b', re.I), roles=('button', 'link'))
  if you:
    try:
      you.click(); pg.page.wait_for_timeout(500)
      add(pg.page.evaluate("() => [...document.querySelectorAll('dialog[open] button, dialog[open] a, [role=menu] [role=menuitem]')].filter(e => e.getClientRects().length).map(e => e.innerText)"))
      pg.page.keyboard.press('Escape'); pg.page.wait_for_timeout(300)
    except Exception: pass
  tabs = "() => [...document.querySelectorAll('main nav a, main [role=tab], main .sv-secnav a, main .sv-seg button, main [role=radiogroup] button, main [class*=tabs] a, main [class*=tabrow] a')].filter(e => e.getClientRects().length).map(e => e.innerText)"
  for key, r6, r5, gate, front in ROUTES:
    route = r5 if L.V5 else r6
    if not route or (gate and 'NT' not in gate): continue
    if key in ('today', 'hearings', 'get-hearings', 'testimony', 'outreach', 'bills', 'legislators', 'my-issues', 'inbox', 'help', 'team', 'people', 'partners', 'setup', 'more-tools', 'a-bill', 'review'):
      pg.nav(route); add(pg.page.evaluate(tabs))
      if key == 'more-tools': add(pg.page.evaluate("() => [...document.querySelectorAll('main a, main button')].filter(e => e.getClientRects().length).map(e => e.innerText)"))
  pg.close()
  ph = b.page('KR', 390, 844); ph.open('/')
  add(ph.page.evaluate("() => [...document.querySelectorAll('nav a')].filter(e => e.getClientRects().length && !e.closest('main')).map(e => e.innerText)"))
  if not L.V5:
    ph.nav('/more'); add(ph.page.evaluate("() => [...document.querySelectorAll('main a, main button')].filter(e => e.getClientRects().length).map(e => e.innerText)"))
  ph.close()
  return names

def help_names(b):
  """The places each Help page names: its bold place names, and a place name after on / in / from / under / open."""
  pg = b.page('KV', 1440, 900); pg.open('/help')
  topics = pg.page.evaluate("() => [...new Set([...document.querySelectorAll('main a[href^=\"#/help/\"]')].map(a => a.getAttribute('href').split('?')[0]))]")
  topics = ['#/help'] + [t for t in topics if t != '#/help'] + ([] if L.V5 else ['#/help/moved'])
  named = {}
  for t in topics:
    pg.nav(t[1:])
    got = pg.page.evaluate("""([places, ctx]) => { const main = document.querySelector('main'); if (!main) return [];
      document.querySelectorAll('main details').forEach(d => d.open = true);
      const text = main.innerText, out = [];
      const bold = [...main.querySelectorAll('b, strong')].map(e => e.innerText.trim());
      for (const p of places) { const esc = p.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&');
        const inCtx = new RegExp('\\\\b' + ctx + esc + '\\\\b').test(text) || new RegExp(esc + '\\\\s*›|›\\\\s*' + esc).test(text);
        if (inCtx || bold.includes(p)) out.push(p); }
      return out; }""", [PLACES, CONTEXT])
    for p in got: named.setdefault(p, []).append(t)
  pg.close(); return named

def main():
  argv = sys.argv[1:]; workers = int(argv[argv.index('--workers') + 1]) if '--workers' in argv else max(1, min(6, (os.cpu_count() or 4) - 2))
  R = L.Results(); t0 = time.time()
  jobs = []
  for who in L.PEOPLE:
    keys = [k for k, r6, r5, gate, front in ROUTES if not (gate and who not in gate) and k != 'more']
    jobs.append((who, 1440, 900, '', keys))
    for c in ('off', 'opening'):
      jobs.append((who, 1440, 900, L.CLOCKS[c], [k for k, r6, r5, gate, front in ROUTES if front and not (gate and who not in gate)]))
  jobs += [('KR', 390, 844, L.KRIS_DAY, ['today', 'hearings', 'testimony', 'more']), ('LR', 390, 844, L.LAUREN_DAY, ['today', 'hearings', 'testimony', 'more']),
           ('PH', 390, 844, '', ['today', 'hearings', 'testimony', 'bills', 'more'])]
  if L.V5: jobs = [(a, b_, c, d, [k for k in e if k != 'more']) for a, b_, c, d, e in jobs]
  reads = []
  print(f'{L.APP}: reading {sum(len(j[4]) for j in jobs)} screens', flush=True)
  with ProcessPoolExecutor(max_workers=workers, initializer=_init) as ex:
    for out in ex.map(read_job, jobs): reads += out

  # 1 and 2: "vape", item numbers and "//"
  vape = [(r, v) for r in reads for v in r['vape']]; notes = [(r, v) for r in reads for v in r['notes']]
  R.check('no "vape", "vapes" or "vaping" in HIPHI\'s own words (R-158)', not vape, '; '.join(f"{r['route']} as {r['who']}: \"{v[:60]}\"" for r, v in vape[:4]))
  R.check('no programmer notes on screen ("R-3xx", "//")', not notes, '; '.join(f"{r['route']} as {r['who']}: \"{v[:60]}\"" for r, v in notes[:4]))

  # 3: one wording per testimony state
  by = {}
  for r in reads:
    for state, hits in r['states'].items():
      for src, h in hits.items():
        e = by.setdefault(state, {}).setdefault(src, {'n': 0, 'where': set(), 'ex': h['ex']}); e['n'] += h['n']; e['where'].add(r['route'])
  print('\ntestimony state wordings seen on items (count, screens):')
  per_state = {}
  for state, rxs in STATES:
    seen = by.get(state, {}); per_state[state] = {src: seen[src]['n'] for src in seen}
    print(f'  {state}: {len(seen)} wording(s)')
    for src, e in sorted(seen.items(), key=lambda x: -x[1]['n']):
      print(f"    {e['n']:>5}  /{src.lstrip('=')}/  on {', '.join(sorted(e['where'])[:5])}{' …' if len(e['where']) > 5 else ''}   e.g. \"{e['ex'][:70]}\"")
    others = [s for s in seen if s != rxs[0]]
    if not L.V5: R.check(f'one wording for "{state}": /{rxs[0].lstrip("=")}/', not others, f"also: {', '.join('/' + s.lstrip('=') + '/ (' + str(seen[s]['n']) + ')' for s in others[:4])}" if others else '')

  # 4: every place Help names exists in the navigation
  with L.browser() as b:
    nav = nav_labels(b); named = help_names(b)
  missing = {p: ts for p, ts in named.items() if p.lower().replace("'", '’') not in nav}
  print(f'\nHelp names {len(named)} places: ' + ', '.join(sorted(named)))
  R.check('every place Help names is in the navigation (sidebar, tab bar, More, account menu, page tabs, More tools)', not missing,
          '; '.join(f'"{p}" on {", ".join(ts[:3])}' for p, ts in sorted(missing.items())))

  # 2 again: what the Copy buttons put on the clipboard (V35)
  with L.browser() as b:
    copied = []
    for who, route in [('LR', '/outreach/partners'), ('SY', '/outreach'), ('KV', '/bill/HB2121/public')]:
      pg = b.page(who, 1440, 900); pg.open(route)
      for i in range(8):
        btns = pg.page.get_by_role('button', name=re.compile(r'^\s*Copy', re.I))
        if btns.count() <= i: break
        try:
          btns.nth(i).click(); pg.page.wait_for_timeout(400)
          clip = pg.page.evaluate('navigator.clipboard.readText().catch(() => "")')
          copied.append((who, route, btns.nth(i).inner_text().strip()[:30], clip or ''))
          pg.page.keyboard.press('Escape'); pg.page.wait_for_timeout(200)
        except Exception: pass
      pg.close()
  bad = [(w, r, l, c) for w, r, l, c in copied if re.search(r'\bR-\d{3}\b|(^|[^:\w])//(?!/)', c) or re.search(r'\bvap(e|es|ing)\b', c, re.I)]
  R.check(f'copied text has no programmer notes or "vape" ({len(copied)} copies read)', not bad, '; '.join(f'{r} "{l}": "{re.search(r".{0,30}(R-[0-9]{3}|//|vap).{0,30}", c, re.I).group(0)}"' for w, r, l, c in bad[:3]))
  errs = [r for r in reads if r['errors']]
  R.check('no page errors while reading', not errs, '; '.join(f"{r['route']} as {r['who']}: {r['errors'][0][:80]}" for r in errs[:3]))
  print(f'\n{len(reads)} screens read in {round(time.time() - t0)} s')
  if L.V5:
    L.save_baseline('words', {'vape': len(vape), 'notes': len(notes), 'state_wordings': per_state, 'help_names_missing_from_nav': sorted(missing), 'copied': len(copied), 'copied_bad': len(bad)})
    print(f'v5 baseline saved to {os.path.relpath(L.BASELINE)}')
  R.done(enforce=not L.V5)

if __name__ == '__main__':
  main()
