# Density / "is this overwhelming?" measurements behind DESIGN.md rules D-1..D-4.
#   python3 tests/density.py            both apps, phone + desktop, printed table
#   python3 tests/density.py --json     machine-readable, for the design-review skill
#
# The one number that matters is ARRIVAL: how far down the screen the thing a person
# came for actually starts. There is no way to infer that from the DOM, because it is a
# product question, not a markup question - on Bills they came for the list, on a bill
# page they came for the plain summary. So every screen NAMES what it is for (`want`),
# and a screen nobody can write a `want` for is a screen that does not know its job.
# Thresholds live in DESIGN.md, not here: a budget change is a documentation change.
import json, os, sys
from playwright.sync_api import sync_playwright
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import checks

HOST = 'http://localhost:8832'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out', 'density')
os.makedirs(OUT, exist_ok=True)

# A returning visitor. Without this the public app redirects home to the first-visit
# wizard and every reading describes onboarding instead of the screen asked for.
# These four must be bills that are still MOVING in the frozen demo session. An earlier set was
# picked by id order and every one of them was `dead`, so My bills correctly drew its
# end-of-session empty state and the tool reported 427px of "chrome" that was nothing of the kind.
# If the snapshot is rebuilt, re-pick these: any four public bills whose stage is not dead/law.
FOLLOWS = ["f707d3fd-f830-491c-8f46-06dcfd847cbf", "5aa2ef38-47b1-4376-a41d-39983afe15d3",
           "4cd8463b-a73c-4bc8-b6ef-55a285ecc388", "7d6caa6e-9e33-4cda-a45b-43b94e2c6dc4"]
SEED = ("try { localStorage.setItem('hiphi_watch_ids_demo', %s);"
        "localStorage.setItem('hiphi_wiz', JSON.stringify({done:true, issues:['vaping']})); } catch (e) {}"
        % json.dumps(json.dumps(FOLLOWS)))

# screen, route, what the person came for, selector for it
PUB = [
  ('start',       '/start/1',      'the first question',   '.st-rrow, .st1 button, .st1 .row'),
  ('home',        '/',             'what needs you',       '.acard, .hm-quiet, .hm-card, .hm .row, .mwrow'),
  ('mybills',     '/bills',        'a bill you follow',    '.mb-row, .mb-main'),
  ('find',        '/find',         'a way in',             '.fd-row, .fd .row, .fd-issue'),
  ('bill',        '/bill/HB1563',  'what the bill does',   '.bl-head .lede'),
  ('legislators', '/legislators',  'your island',          '.pp-isle'),
  ('more',        '/more',         'the first choice',     '.mwrow, .mr .row'),
]
SV = [
  ('today',       '/',             'the first thing due',  '.td-card, .td-root .row'),
  # the Week view exists from 1100px; a phone opening the same address gets the list, so its first card counts there
  ('week',        '/?view=week',   'the week\'s first entry', '.wk-blk, .wk-timed, .td-card'),
  ('bills',       '/bills',        'the first bill',       '.bl-prow, .bl-grp .row, .bl-table tbody tr'),
  ('bill',        '/bill/HB1562',  'the bill status',      '.bw-ribwrap, .sv-rib, .bw-page .card'),
  ('legislators', '/legislators',  'the first legislator', '.lg-row, .lg-page .row, main tbody tr'),
  ('outreach',    '/outreach',     'the first person',     '.sp-page .row, .sp-page tbody tr'),
]

TOP_JS = """(sel) => { for (const e of document.querySelectorAll(sel)) {
  if (e.offsetParent === null) continue; const r = e.getBoundingClientRect();
  if (r.height < 12) continue; return Math.round(r.top); } return null; }"""

# Every control pressable without scrolling. Hick's law: choosing takes longer the more
# options there are, so this is the nearest thing to a measurable "overwhelming".
CHOICES_JS = r"""(() => {
  // Three numbers, because they mean different things.
  //   all   - every control pressable without scrolling.
  //   kinds - how many DIFFERENT ones, inside the content region only. Twenty-five rows of a bill
  //           table are one decision repeated, not twenty-five decisions, and Hick's law is about
  //           competing alternatives. This is the number A-2's budget is set against.
  //   nav   - the persistent furniture: sidebar, header, tab bar. Counted separately because it is
  //           the SAME on every screen, learned once and then ignored; folding it into `kinds` made
  //           every desktop screen look 12 controls worse than it is and would have sent somebody
  //           to simplify a screen whose content was already fine. Navigation is judged by B-13
  //           (does a destination earn its place), not by this budget.
  const H = window.innerHeight, main = document.querySelector('main') || document.body;
  const kinds = new Set(), nav = new Set(); let all = 0;
  document.querySelectorAll('a[href], button, input:not([type=hidden]), select, textarea, summary, [role=button], [role=tab]').forEach(e => {
    if (e.offsetParent === null || e.closest('.skip')) return;
    const r = e.getBoundingClientRect();
    if (r.top >= H || r.bottom <= 0 || r.width < 8 || r.height < 8) return;
    if (getComputedStyle(e).visibility === 'hidden') return;
    all++;
    const row = e.closest('tr, li, .row, .bl-prow, .td-card, .mb-row');
    const key = row ? 'listitem:' + ((row.className || '') + '').split(' ')[0]
                    : (e.tagName + ':' + ((e.innerText || e.getAttribute('aria-label') || e.type || '') + '').trim().slice(0, 24));
    (main.contains(e) ? kinds : nav).add(key);
  });
  return { all, kinds: kinds.size, nav: nav.size }; })()"""

# Distinct text colours in view: how many signals compete for the eye at once.
COLOURS_JS = r"""(() => { const c = new Set(), m = document.querySelector('main') || document.body;
  const w = document.createTreeWalker(m, NodeFilter.SHOW_TEXT); let n;
  while ((n = w.nextNode())) { if (!n.nodeValue.trim()) continue; const el = n.parentElement;
    if (!el || el.offsetParent === null) continue;
    if (el.getBoundingClientRect().top >= window.innerHeight) continue;
    c.add(getComputedStyle(el).color); }
  return [...c].length; })()"""

def run(br, base, routes, app, W, H, tag, seed):
    rows = []
    c = br.new_context(viewport={'width': W, 'height': H}, is_mobile=W < 600,
                       has_touch=W < 600, device_scale_factor=1)
    if seed: c.add_init_script(SEED)
    p = c.new_page()
    p.goto(base + '#/'); p.reload(); p.wait_for_timeout(4000)
    for name, route, want, sel in routes:
        p.goto(base + '#' + route); p.reload(); p.wait_for_timeout(2500)
        top = p.evaluate(TOP_JS, sel)
        p.screenshot(path=f'{OUT}/{app}_{tag}_{name}.png')
        ch = p.evaluate(CHOICES_JS)
        rows.append({'app': app, 'width': W, 'screen': name, 'want': want,
                     'arrival': top, 'choices': ch['all'], 'kinds': ch['kinds'], 'nav': ch['nav'],
                     'type_sizes': len(p.evaluate(checks.FONTS_JS)['sizes']),
                     'colours': p.evaluate(COLOURS_JS)})
    c.close()
    return rows

def main():
    out = []
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        for W, H, tag in ((390, 844, 'phone'), (1440, 900, 'desktop')):
            out += run(b, f'{HOST}/track.html?demo=1', PUB, 'public', W, H, tag, True)
            out += run(b, f'{HOST}/staff.html?demo=1', SV, 'staff2', W, H, tag, False)
        b.close()
    if '--json' in sys.argv:
        print(json.dumps(out, indent=1)); return
    print(f'{"app":8} {"width":7} {"screen":12} {"they came for":22} {"arrival":>8} {"all":>5} {"kinds":>6} {"nav":>4} {"sizes":>6} {"colours":>8}')
    print('-' * 84)
    for r in out:
        a = 'NOT FOUND' if r['arrival'] is None else str(r['arrival'])
        print(f'{r["app"]:8} {r["width"]:<7} {r["screen"]:12} {r["want"]:22} {a:>8} '
              f'{r["choices"]:>5} {r["kinds"]:>6} {r["nav"]:>4} {r["type_sizes"]:>6} {r["colours"]:>8}')
    print(f'\nscreenshots: {OUT}')
    print('thresholds: DESIGN.md A-1 (arrival), A-2 (kinds), A-4 (sizes), A-5 (colours)')

main()
