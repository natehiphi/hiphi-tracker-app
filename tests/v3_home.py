# R-362 Part 3: version 3's Home (?v3=1), pub/v3/home.js and pub/v3/home.css. One module, two shapes (docs/requests/R-362/PLAN.md, backend repo):
#   The door, for someone who follows nothing yet:
#     - ?demo=1&v3=1&restart#/ draws the door on Home, never #/start/0 (the welcome it replaces); the arrival is counted as the welcome's was,
#       'arrive' / 'view' (visitlog.js; read here from the sandbox's debug line)
#     - exactly one filled button (.btn.primary, the card's, A-3); the card's heading starts within 400px at 390x844 (A-1); at most 15 kinds of
#       control on the first screenful (A-2, density.py's count)
#     - four issue rows, each opening #/issue/<slug>; "Choose your issues" (outlined) opens #/start/1; "See all issues" opens #/find
#     - Find, then the Home tab, comes back to #/ and the door
#   The returner, who follows issues (compare.html's Kai):
#     - "Aloha, Kai." and one line; the card; at most two plain lines (.v3h-line); "See this week" to #/bills; no pager (.cm-pager), no slide,
#       no Your issues block; one filled button
#     - &day=tue&later=1 (a later visit's first arrival) stays on Home: no nextask page (#/next/...)
#   Both: 320, 390, 1280 and 1440 wide with no sideways scroll; nothing in the console; between sessions (&season=off) the calm words and one
#   filled button.
#   python3 tests/v3_home.py [base]   base defaults to http://localhost:8832 (a server in the frontend folder); V3_HOME_OUT sets where the
#   screenshots go (default tests/out/v3_home)
import os, sys
from playwright.sync_api import sync_playwright

BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832').split('/track.html')[0].rstrip('/')
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.environ.get('V3_HOME_OUT') or os.path.join(ROOT, 'tests', 'out', 'v3_home'); os.makedirs(OUT, exist_ok=True)
fails = 0
def ok(c, m):
    global fails
    print(('PASS ' if c else 'FAIL ') + m)
    if not c: fails += 1

KAI = """(() => { if (sessionStorage.getItem('__set')) return; sessionStorage.setItem('__set', '1');
  for (const k of Object.keys(localStorage)) if (k.startsWith('hiphi_')) localStorage.removeItem(k);
  const set = (k, v) => localStorage.setItem(k + '_demo', typeof v === 'string' ? v : JSON.stringify(v));
  set('hiphi_issue_follows', ['66a32660-b0a7-4a90-a71f-231963619b44', '1dcec7ca-ed94-4a19-9c9c-235514ca7491', '2616613e-a363-418b-ae19-4add60957cd8']);
  set('hiphi_watch_ids', []); set('hiphi_cat_follows', []); set('hiphi_skips', []);
  set('hiphi_wiz', { done: true, issues: ['tobacco', 'food', 'around'], name: 'Kai' });
  set('hiphi_onb', { lastVisit: new Date(Date.now() - 30 * 36e5).toISOString() }); set('hiphi_demo_seeded', '0');
  localStorage.setItem('hiphi_tour_home_demo', '{"how":"test"}'); localStorage.setItem('hiphi_tour_bill_demo', '{"how":"test"}');
})();"""

def size(w, h): return dict(viewport={'width': w, 'height': h}, **({'is_mobile': True, 'has_touch': True} if w < 600 else {}))
def bad(m): return m.type == 'error' and 'favicon' not in m.text

def open_home(br, kw, returner=False, q='', errs=None):
    ctx = br.new_context(**kw)
    ctx.add_init_script("Object.defineProperty(Navigator.prototype,'globalPrivacyControl',{get:()=>true});")
    if returner: ctx.add_init_script(KAI)
    pg = ctx.new_page()
    if errs is not None:
        pg.on('pageerror', lambda e: errs.append('pageerror ' + str(e)))
        pg.on('console', lambda m: errs.append('console ' + m.text[:160]) if bad(m) else None)
    pg.goto(f"{BASE}/track.html?demo=1&v3=1{'' if returner else '&restart'}{q}#/")
    pg.wait_for_selector('#main .v3h', timeout=60000); pg.wait_for_timeout(1500)
    return ctx, pg

KINDS = r"""(() => { const H = innerHeight, main = document.querySelector('main') || document.body, kinds = new Set();
  document.querySelectorAll('a[href], button, input:not([type=hidden]), select, textarea, summary, [role=button], [role=tab]').forEach(e => {
    if (e.offsetParent === null || !main.contains(e)) return; const r = e.getBoundingClientRect();
    if (r.top >= H || r.bottom <= 0 || r.width < 8 || r.height < 8) return;
    const row = e.closest('tr, li, .row, .bl-prow, .td-card, .mb-row');
    kinds.add(row ? 'listitem:' + ((row.className || '') + '').split(' ')[0] : e.tagName + ':' + ((e.innerText || e.getAttribute('aria-label') || e.type || '') + '').trim().slice(0, 24)); });
  return kinds.size; })()"""
PRIMARY = "[...document.querySelectorAll('#main .btn.primary')].filter(e => e.offsetParent !== null).length"
SIDEWAYS = "document.documentElement.scrollWidth - innerWidth"

with sync_playwright() as p:
    br = p.chromium.launch()

    # ---- the door at 390x844 ----
    errs = []
    ctx, pg = open_home(br, size(390, 844), errs=errs)
    ok(pg.evaluate("location.hash") in ('#/', '') and pg.locator('#main .v3h-door').count() == 1, f"door: ?restart#/ draws the door on Home ({pg.evaluate('location.hash')!r}), not #/start/0")
    ok(pg.locator('#main .st').count() == 0, "door: no welcome step on the page")
    ok(pg.evaluate(PRIMARY) == 1, f"door: exactly one filled button ({pg.evaluate(PRIMARY)})")
    top = pg.evaluate("Math.round(document.querySelector('#main .v3c-h').getBoundingClientRect().top)")
    ok(top <= 400, f"door: the card's heading starts at {top}px at 390x844 (A-1 limit 400)")
    k = pg.evaluate(KINDS); ok(k <= 15, f"door: {k} kinds of control on the first screenful (A-2: 15)")
    rows = pg.eval_on_selector_all('#main .v3h-row', "els => els.map(e => e.getAttribute('href'))")
    ok(len(rows) == 4 and all(r.startswith('#/issue/') for r in rows), f"door: four issue rows to #/issue/... ({rows})")
    ok(pg.locator('#main .v3h-pick .btn.secondary[href="#/start/1"]').count() == 1, "door: Choose your issues is outlined and goes to #/start/1")
    ok(pg.locator('#main .v3h-all a[href="#/find"]').count() == 1, "door: See all issues goes to #/find")
    ok(pg.locator('#main .v3h-art svg.art-hello').count() == 1, "door: the HELLO drawing is drawn")
    pg.screenshot(path=os.path.join(OUT, 'door_390.png'), full_page=True)
    ctx.close()

    # the arrival counted ('arrive' / 'view'), read from the sandbox's debug line
    logs = []
    ctx = br.new_context(**size(390, 844)); ctx.add_init_script("window.__hiphiCountTests = true;")   # visitlog.js counts in this test; the sandbox prints, never sends
    pg = ctx.new_page()
    pg.on('console', lambda m: logs.append(m.args[1].json_value()) if 'first visit (sandbox' in m.text and len(m.args) > 1 else None)
    pg.goto(f"{BASE}/track.html?demo=1&v3=1&restart&debug#/"); pg.wait_for_selector('#main .v3h-door', timeout=60000); pg.wait_for_timeout(2500)
    arr = [l for l in logs if isinstance(l, dict) and l.get('step') == 'arrive']
    ok(any(l.get('event') == 'view' for l in arr), f"door: the arrival is counted as 'arrive' / 'view' ({[(l.get('step'), l.get('event'), l.get('path')) for l in arr]})")
    # an issue row opens its page; Choose your issues opens the topics
    pg.click('#main .v3h-row >> nth=0'); pg.wait_for_timeout(800)
    ok(pg.evaluate("location.hash").startswith('#/issue/'), f"door: an issue row opens {pg.evaluate('location.hash')}")
    pg.go_back(); pg.wait_for_selector('#main .v3h-door', timeout=20000)
    pg.click('#main [data-v3h-choose]'); pg.wait_for_timeout(800)
    ok(pg.evaluate("location.hash") == '#/start/1', f"door: Choose your issues opens {pg.evaluate('location.hash')}")
    ok(any(l.get('step') == 'arrive' and l.get('event') == 'next' for l in logs if isinstance(l, dict)), "door: Choose your issues is counted as 'arrive' / 'next'")
    ctx.close()

    # Find, then the Home tab, keeps #/ and the door
    ctx, pg = open_home(br, size(390, 844))
    pg.click('nav.tabs a[href="#/find"]'); pg.wait_for_timeout(1200)
    pg.click('nav.tabs a[href="#/"]'); pg.wait_for_selector('#main .v3h', timeout=20000); pg.wait_for_timeout(500)
    ok(pg.evaluate("location.hash") in ('#/', '') and pg.locator('#main .v3h-door').count() == 1, f"door: Find then Home stays on {pg.evaluate('location.hash')!r} with the door")
    ctx.close()

    # ---- the returner (Kai) ----
    errs2 = []
    ctx, pg = open_home(br, size(390, 844), returner=True, errs=errs2)
    ok(pg.locator('#main .v3h-back').count() == 1, "returner: Home draws the returner's shape")
    hi = pg.inner_text('#main .v3h-hi'); ok(hi.startswith('Aloha, Kai.'), f"returner: the greeting ({hi!r})")
    ok(pg.locator('#main .v3-card').count() == 1, "returner: one card")
    n = pg.locator('#main .v3h-line').count(); ok(n <= 2, f"returner: {n} plain lines under the card (at most 2)")
    ok(pg.locator('#main .cm-pager, #main .cm-slide, #main .cm-issues').count() == 0, "returner: no pager, no slide, no Your issues block")
    ok(pg.evaluate(PRIMARY) == 1, f"returner: exactly one filled button ({pg.evaluate(PRIMARY)})")
    ok(pg.locator('#main .v3h-week a[href="#/bills"]').count() == 1, "returner: See this week goes to #/bills")
    pg.screenshot(path=os.path.join(OUT, 'returner_390.png'), full_page=True)
    ctx.close()

    # a later visit's first arrival stays on Home under v3
    ctx, pg = open_home(br, size(390, 844), returner=True, q='&day=tue&later=1')
    ok(not pg.evaluate("location.hash").startswith('#/next'), f"returner: &day=tue&later=1 stays on Home ({pg.evaluate('location.hash')!r}), no nextask page")
    ok(pg.locator('#main .v3h-back').count() == 1, "returner: the later visit's Home is the returner's shape")
    ctx.close()

    # between sessions: the calm words, one filled button, both shapes
    for ret in (False, True):
        ctx, pg = open_home(br, size(390, 844), returner=ret, q='&season=off')
        ok(pg.locator('#main .v3h-off').count() == 1 and pg.evaluate(PRIMARY) == 1, f"{'returner' if ret else 'door'} between sessions: the break's card, one filled button")
        ok('on break' in pg.inner_text('#main .v3h'), f"{'returner' if ret else 'door'} between sessions: says the Legislature is on break")
        ctx.close()

    # ---- widths: no sideways scroll ----
    for w, h in [(320, 640), (390, 844), (1280, 800), (1440, 900)]:
        for ret in (False, True):
            ctx, pg = open_home(br, size(w, h), returner=ret, errs=errs2)
            s = pg.evaluate(SIDEWAYS); ok(s <= 0, f"{w}x{h} {'returner' if ret else 'door'}: no sideways scroll ({s}px)")
            ok(pg.evaluate(PRIMARY) == 1, f"{w}x{h} {'returner' if ret else 'door'}: one filled button")
            if w >= 1280 and not ret:
                side = pg.evaluate("(() => { const a = document.querySelector('#main .v3h-now').getBoundingClientRect(), b = document.querySelector('#main .v3h-care').getBoundingClientRect(); return Math.abs(a.top - b.top) < 4 && b.left > a.right; })()")
                ok(side, f"{w}x{h} door: the card stands beside the issues")
            pg.screenshot(path=os.path.join(OUT, f"{'returner' if ret else 'door'}_{w}.png"), full_page=True)
            ctx.close()

    ok(not errs and not errs2, f"nothing in the console ({(errs + errs2)[:3]})")
    br.close()

print(f"\n{'ALL PASS' if not fails else f'{fails} FAILED'}")
sys.exit(1 if fails else 0)
