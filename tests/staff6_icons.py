# R-339 (Nate 10/26): "Make a robust check to see where else is missed." Opens every Staff v6 screen and view, finds every
# place an issue's, topic's or coalition's name stands on its own (a row, a card, a heading, a chip), and checks that one of
# the issue or topic icons sits beside it. Prose ("Archive X?", a sentence naming an issue) is not matched: only a text that
# is the whole name. Bill rows (a row that opens a bill) are counted on their own: they get their icon from the shared bill
# row in steps.js, and until that lands they are reported, not failed (BILL_ROWS = False).
#
#   V4_ROOT=<folder> python3 tests/staff6_icons.py [--shots <dir>] [--list]
#
# --list prints every spot missing an icon, by screen, which is how the 10/26 audit (docs/requests/R-339/AUDIT-2026-10-26.md
# in the backend repo) was made.
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import staff6_lib as L

R = L.Results()
LIST = '--list' in sys.argv
SHOTS = sys.argv[sys.argv.index('--shots') + 1] if '--shots' in sys.argv else ''
BILL_ROWS = os.environ.get('ICONS_BILL_ROWS') == '1'   # on once the shared bill row in steps.js carries the icon

# Every screen a person can reach from the sidebar or a row, with practice ids (demo/snapshot.json).
SCREENS = [('Today', '/'), ('Hearings', '/hearings'), ('Hearings, This week', '/hearings/week'), ('Hearings, Ask', '/hearings/ask'),
  ('Testimony', '/testimony'), ('Testimony, Filed', '/testimony?view=filed'), ('Testimony, Team', '/testimony?view=team'),
  ('Inbox', '/inbox'), ('All issues', '/my-issues/all'), ('Coalitions', '/my-issues/coalitions'), ('A coalition', f'/coalition/{L.HEAL}'),
  ('An issue', f'/issue/{L.ISSUE}'), ('Bills', '/bills'), ('A bill', '/bill/HB10'), ('Legislators', '/legislators'),
  ('A legislator', f'/legislator/{L.LEGISLATOR}'), ('Outreach', '/outreach'), ('Outreach, Partners', '/outreach/partners'),
  ('A supporter', f'/person/{L.SUPPORTER}'), ('Search', '/search?q=school'), ('Team', '/team'), ('Partners', '/partners'), ('Review', '/review')]
MY_VIEWS = ['deadlines', 'status', 'topics', 'sheet']

# Names and icons come from the app's own data, so a new issue or icon needs no change here.
SETUP = """import('./staff6/data.js').then(m => {
  const S = m.S, names = {}, ics = new Set(['tag']);
  for (const i of S.issues || []) if (!i.archived_at) { names[i.name.trim()] = 'issue'; if (i.icon) ics.add(i.icon); }
  for (const c of S.categories || []) { names[c.name.trim()] = 'topic'; if (c.icon) ics.add(c.icon); }
  for (const c of S.campaigns || []) { names[c.name.trim()] = 'coalition'; if (c.public_name) names[c.public_name.trim()] = 'coalition'; if (c.icon) ics.add(c.icon); }
  for (const k of ['salad', 'cigarette-off', 'heart-handshake']) ics.add(k);   // the staff-only swaps (bills.js STAFF_TOPIC_IC)
  window.__icn = { names, ics: [...ics] }; return Object.keys(names).length; })"""
# A spot has its icon when one of those icons shows (not hidden by a phone rule) inside it or up to three levels up, but
# not past its own row, card, heading or link.
SCAN = """(() => { const { names, ics } = window.__icn, I = new Set(ics), out = [];
  const w = document.createTreeWalker(document.getElementById('app') || document.body, NodeFilter.SHOW_TEXT); let n;
  while ((n = w.nextNode())) { const t = n.textContent.replace(/\\s+/g, ' ').trim(), kind = names[t]; if (!kind) continue;
    const el = n.parentElement; if (!el || !el.getClientRects().length || el.closest('[hidden], option, select, .sr, title, .sv-title, .bl-memo')) continue;   // .sv-title: the top bar repeats the page's heading; .bl-memo: the partner update, copied into an email as it is
    const hd = el.closest('h1, h2, h3'), stop = el.closest('header') || (hd ? (hd.parentElement?.parentElement || hd) : el.closest('a, button, summary, label, li, tr, .v6-row, .ig6-cell') || el.parentElement);
    let c = el, ok = false; for (let d = 0; c && d < 5 && !ok; d++) { ok = [...c.querySelectorAll('svg.ic')].some(s => s.getClientRects().length && [...s.classList].some(k => k.startsWith('ic-') && I.has(k.slice(3)))); if (c === stop) break; c = c.parentElement; }
    const box = el.closest('a, button, summary, label, li, h1, h2, h3, td, th') || el;
    out.push({ name: t, kind, ok, bill: !!el.closest('[data-bill], a[href*="#/bill/"], .v6-hcard-bl, .rv6-title'), where: box.tagName.toLowerCase() + [...box.classList].slice(0, 2).map(k => '.' + k).join('') }); }
  return out; })()"""

# Spots in files other builds held on 10/26 (R-344: issuegrid.js, bill.js, search.js; R-342: today.js): reported, not
# failed, until each lands. Remove a line when its fix is in.
LATER = {'button.lg6-jchip': 'All issues jump chips (issuegrid.js)', 'a.bw-inline': 'a bill\'s coalition link (bill.js)'}
LATER_SCREENS = {'Search': 'search.js', 'Coalitions': 'issuegrid.js', 'Today': 'today.js', 'Partners': 'partnerq.js'}
def check(pg, label, w):
  pg.page.wait_for_timeout(300)
  spots = pg.page.evaluate(SCAN)
  own = [s for s in spots if not s['bill']]; bills = [s for s in spots if s['bill']]
  miss = [s for s in own if not s['ok']]; bmiss = [s for s in bills if not s['ok']]
  later = [s for s in miss if s['where'] in LATER or label in LATER_SCREENS]; miss = [s for s in miss if s not in later]
  if later: print(f'  waiting for another build: {w}: {label}: {len(later)} ({", ".join(sorted({LATER.get(s["where"], LATER_SCREENS.get(label, "")) for s in later}))})')
  R.check(f'{w}: {label}: every issue, topic and coalition name has its icon ({len(own) - len(miss)} of {len(own)})', not miss,
          [(s['name'], s['where']) for s in miss[:4]])
  if BILL_ROWS: R.check(f'{w}: {label}: every bill row has its issue icon ({len(bills) - len(bmiss)} of {len(bills)})', not bmiss, [(s['name'], s['where']) for s in bmiss[:4]])
  elif bmiss: print(f'  waiting for steps.js: {w}: {label}: {len(bmiss)} of {len(bills)} bill rows without an icon')
  if LIST:
    for s in miss + bmiss: print(f'    {label}: {s["kind"]} "{s["name"]}" at {s["where"]}{" (bill row)" if s["bill"] else ""}')
  if SHOTS: pg.shot(os.path.join(SHOTS, f'icons-{label.lower().replace(",", "").replace(" ", "-")}-{w}.png'))

with L.browser() as B:
  for w, h in [(1440, 900), (390, 844)]:
    pg = B.page('NT', w, h); pg.open('/')
    R.check(f'{w}: the practice data names issues to look for', (pg.page.evaluate(SETUP) or 0) > 20)
    for label, route in SCREENS:
      pg.open(route); pg.page.evaluate(SETUP); check(pg, label, w)
    pg.open('/my-issues'); pg.page.evaluate(SETUP)
    for v in MY_VIEWS:
      pg.page.click(f'[data-miview="{v}"]' if w >= 768 else 'body', timeout=3000) if w >= 768 else pg.page.select_option('[data-misel]', v)
      pg.page.wait_for_timeout(600); pg.ready()
      pg.page.evaluate("document.querySelectorAll('#mi-g-stopped, .mi-stopped').forEach(d => d.open = true)")
      check(pg, f'My issues, {v}', w)
    R.check(f'{w}: no page errors', not pg.errors, pg.errors[:2])
    pg.close()

R.done()
