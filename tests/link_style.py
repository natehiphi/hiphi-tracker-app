# One link style on the public page (DESIGN A-5, A-12, C-15; R-357 Light fixes c, Nate's yes 30 Oct 2026).
#   python3 tests/link_style.py [base_url]      (practice copy; a phone at 375x812; base defaults to http://localhost:8832)
# The rule: a link is underlined inside running text and plain when it stands alone as the action, both in the same blue.
# The returner walk found both on one screen (finding 6). Checks, on Home, a bill page, an issue page, You and Profile for a
# returner (Kai, three issues): (1) no link that is the whole of its line is underlined; (2) every link inside a sentence is;
# (3) a standalone text link is the page's link blue (--p700); (4) base.css, which Staff v2 loads too, scopes every rule of the
# link block to body:not(.staff2) so the staff app is unchanged. Not counted: the tab bar, the brand, the header band's white
# "Next day" link, definition lists' values (a companion bill's number in a dd), and rows (dark text by design).
import os, re, sys
from playwright.sync_api import sync_playwright

BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832').rstrip('/')
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
passes, fails, errors = [], [], []
def ok(c, m): (passes if c else fails).append(('PASS ' if c else 'FAIL ') + m)

src = open(os.path.join(ROOT, 'compare.html')).read()
WHO = src[src.index('const WHO = {'):src.index('const pick =')]   # the same people as the compare page (as tests/home_calm.py)
SCENE = f"""(() => {{ {WHO}
  if (sessionStorage.getItem('__set')) return; sessionStorage.setItem('__set', '1');
  const p = WHO['kai'], at = Date.parse('2026-03-16T09:00:00-10:00');
  for (const k of Object.keys(localStorage)) if (k.startsWith('hiphi_')) localStorage.removeItem(k);
  const set = (k, v) => localStorage.setItem(k + '_demo', typeof v === 'string' ? v : JSON.stringify(v));
  set('hiphi_issue_follows', p.issues); set('hiphi_watch_ids', []); set('hiphi_cat_follows', []); set('hiphi_skips', []);
  set('hiphi_wiz', {{ done: true, issues: p.cats, name: p.name }});
  set('hiphi_onb', {{ lastVisit: new Date(at - 14 * 36e5).toISOString() }});
  set('hiphi_done', Object.keys(p.done)); set('hiphi_done_at', p.done); set('hiphi_stances', {{}}); set('hiphi_demo_seeded', '0');
  localStorage.setItem('hiphi_tour_home_demo', '{{"how":"test"}}'); localStorage.setItem('hiphi_tour_bill_demo', '{{"how":"test"}}');
}})();"""
ROUTES = ['#/', '#/bill/HB1523', '#/issue/disposable-e-cigarette-ban', '#/more', '#/settings']
JS = """() => {
  const out = [];
  for (const a of document.querySelectorAll('#app a[href]')) {
    const r = a.getBoundingClientRect(); if (!r.width || !r.height) continue;
    if (a.closest('nav.tabs, .band, dl, .hdr') ) continue;
    const cs = getComputedStyle(a), par = a.parentElement;
    const around = [...par.childNodes].filter(n => n !== a && n.nodeType === 3).map(n => n.textContent.trim()).join(' ').trim();
    const lineOnly = !around && (a.textContent || '').trim().length > 0 && !par.matches('li, td') ;
    out.push({ t: (a.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 44), cls: a.className.toString().slice(0, 30), ul: cs.textDecorationLine.includes('underline'),
      color: cs.color, runs: around.length > 12, solo: lineOnly, row: /(^| )(rc-row|cm-row|mwrow|row|bl-who|bl-mem|yu-me)( |$)/.test(a.className.toString()) || /bl-ib/.test(par.className.toString()), btn: a.classList.contains('btn') });
  }
  return out;
}"""
BLUE = 'rgb(0, 105, 142)'   # --p700

with sync_playwright() as pw:
    b = pw.chromium.launch(); c = b.new_context(viewport={'width': 375, 'height': 812}, device_scale_factor=2, is_mobile=True, has_touch=True)
    c.add_init_script(SCENE); p = c.new_page(); p.on('pageerror', lambda e: errors.append(str(e)))
    p.goto(f'{BASE}/track.html?demo=1#/'); p.wait_for_timeout(2500)
    seen = 0
    for r in ROUTES:
        p.evaluate(f'location.hash = {r!r}'); p.wait_for_timeout(1800)
        links = p.evaluate(JS); seen += len(links)
        plain_but_underlined = [x for x in links if x['solo'] and not x['runs'] and x['ul'] and not x['row']]
        sentence_not_underlined = [x for x in links if x['runs'] and not x['ul'] and not x['row'] and not x['btn']]
        blue = [x for x in links if x['solo'] and not x['ul'] and not x['row'] and (x['btn'] or x['cls'] in ('', 'link')) and x['color'] != BLUE]
        ok(not plain_but_underlined, f"{r}: no standalone link is underlined {[(x['t'], x['cls']) for x in plain_but_underlined][:3]}")
        ok(not sentence_not_underlined, f"{r}: every link inside a sentence is underlined {[(x['t'], x['cls']) for x in sentence_not_underlined][:3]}")
        ok(not blue, f"{r}: standalone text links are the page's blue {[(x['t'], x['color']) for x in blue][:3]}")
    ok(seen > 20, f'the walk saw links to judge ({seen})')
    c.close(); b.close()

# Staff v2 loads base.css too: every rule of the block is scoped away from body.staff2.
css = open(os.path.join(ROOT, 'pub', 'base.css')).read()
at = css.find('/* One link style on the public page')
block = css[at:css.index('.btnrow', at)] if at >= 0 else ''
rules = [l for l in block.splitlines() if re.match(r'^\S.*\{', l) and not l.startswith('/*')]
ok(rules and all(l.startswith('body:not(.staff2) ') for l in rules), f'every rule of the link block is scoped to body:not(.staff2) ({len(rules)} rules)')

ok(not errors, f'no page errors {errors[:3]}')
print('\n'.join(passes + fails))
print(f'\n{len(passes)} passed, {len(fails)} failed')
sys.exit(1 if fails else 0)
