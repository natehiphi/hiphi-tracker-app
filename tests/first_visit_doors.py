# The first visit's doors (R-212 #46, the power users' walk: anyone who is not a newcomer needed about 5 taps to reach Home).
#   python3 -m http.server 8832   (in this folder, once)
#   python3 tests/first_visit_doors.py [base] [out]   base defaults to http://localhost:8832
# In the practice copy, today's version. Since R-377 (Nate 12 Nov 2026, reversing R-212 #46) the visit has no way out
# but through it:
#   - the welcome has one door, Let's begin: no "Just look around" (at 320, 375 and 1280 wide, and between sessions);
#   - no "Leave, go to Home" on any step (topics, issues, alerts, the story, Coming up; the short version's page; a shared
#     bill's "Follow this issue?"); the topics' bar is Next alone, and Next with nothing picked asks for a pick;
#   - "Skip this part" is still the bar's word on each later step and goes on inside the visit, to the finale on Home;
#   - a plan (practice only) keeps its own screens and its Skip;
#   - every write to the database is refused and must not even be tried; no page errors.
import json, os, re, sys
from playwright.sync_api import sync_playwright
BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832').rstrip('/')
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out', 'first_visit_doors')
os.makedirs(OUT, exist_ok=True)
res = []
def ok(c, m): res.append(bool(c)); print('PASS' if c else 'FAIL', m)

# The sandbox prints each count it would have sent when the address has `debug` (pub/visitlog.js); counting is switched on
# for this page only (window.__hiphiCountTests, as tests/visitlog.py does), and the printout is kept here to read.
INIT = """window.__hiphiCountTests = true; window.__fv = [];
(() => { const d = console.debug.bind(console);
  console.debug = (...a) => { if (a[0] === 'first visit (sandbox, not sent):') { try { window.__fv.push(JSON.parse(JSON.stringify(a[1]))); } catch (e) {} } return d(...a); }; })();"""
writes, errs = [], []

def ctx(br, w, h=None, reduce=True):
    m = w < 700
    c = br.new_context(viewport={'width': w, 'height': h or (812 if m else 800)}, is_mobile=m, has_touch=m, reduced_motion='reduce' if reduce else 'no-preference')
    c.add_init_script(INIT)
    # Reads of public data may go through; anything else to the database is refused and noted (nothing may be written).
    def guard(route):
        r = route.request
        if r.method in ('GET', 'HEAD', 'OPTIONS'): route.continue_(); return
        writes.append(f'{r.method} {r.url[:100]}'); route.abort()
    c.route(re.compile(r'.*supabase\.co/.*'), guard)
    p = c.new_page()
    p.on('pageerror', lambda e: errs.append(f'{w}: {e}'))
    return c, p

H = lambda p: p.evaluate('location.hash')
screen = lambda p: p.evaluate('document.body.dataset.screen')
h1 = lambda p: p.evaluate("document.querySelector('main h1')?.innerText || ''")
fv = lambda p: p.evaluate('window.__fv || []')
wiz = lambda p: p.evaluate("JSON.parse(localStorage.getItem('hiphi_wiz') || '{}')")
follows = lambda p: p.evaluate("(JSON.parse(localStorage.getItem('hiphi_issue_follows_demo') || '[]').length) + (JSON.parse(localStorage.getItem('hiphi_cat_follows_demo') || '[]').length)")

def begin(p, q=''):
    p.goto(f'{BASE}/track.html?demo=1&restart&debug{q}'); p.wait_for_selector('.st-hellopage', timeout=40000); p.wait_for_selector('.st-hellobar [data-stnext]', timeout=10000); p.wait_for_timeout(400)
def to_topics(p):
    p.click('.st-hellobar [data-stnext]'); p.wait_for_selector('.st-tile', timeout=30000); p.wait_for_timeout(400)
def to_issues(p):
    p.locator('.st-tile').nth(0).click(); p.click('.st-bar [data-stnext]')
    p.wait_for_selector('.st2 [data-stpick]', timeout=30000); p.wait_for_selector('.st-bar [data-stnext]:not([aria-busy="true"])', timeout=20000); p.wait_for_timeout(400)
def to_alerts(p):
    p.click('.st-bar [data-stnext]'); p.wait_for_selector('#st-aform', timeout=20000); p.wait_for_timeout(400)
def to_story(p):
    p.click('.st-bar [data-stskip]'); p.wait_for_selector('.st-lesson', timeout=20000); p.wait_for_timeout(600)
def to_soon(p):
    p.click('.st-bar [data-stskip]'); p.wait_for_selector('.st-soonpage', timeout=20000); p.wait_for_timeout(400)
def home(p):
    try: p.wait_for_function("document.body.dataset.screen === 'home'", timeout=8000)
    except Exception: pass
    p.wait_for_timeout(600)
    return H(p) in ('#/', '') and screen(p) == 'home'

# How a control sits: in view, its height, its words on one line or not, its box.
BOX = """(s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(), sp = e.querySelector('span');
  const lines = sp ? new Set([...sp.getClientRects()].map(x => Math.round(x.top))).size : 0;
  const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  return { x: r.left, y: r.top, r: r.right, b: r.bottom, h: r.height, w: r.width, lines, text: e.innerText.trim(), vw: innerWidth, vh: innerHeight,
    clipped: e.scrollWidth > e.clientWidth + 1, onTop: !!hit && (hit === e || e.contains(hit)), sideways: document.scrollingElement.scrollWidth > innerWidth + 1,
    primary: e.classList.contains('primary') }; }"""
box = lambda p, s: p.evaluate(BOX, s)
def seen(b, vw):
    return bool(b) and b['h'] >= 44 and b['x'] >= -1 and b['r'] <= vw + 1 and b['y'] >= 0 and b['b'] <= b['vh'] + 1 and not b['clipped'] and b['onTop'] and not b['sideways']

def last_leave(p):
    ev = [e for e in fv(p) if e.get('event') == 'leave']
    return ev

with sync_playwright() as pw:
    br = pw.chromium.launch()

    # ---- 1. the welcome: Let's begin is its one door (R-377), at three widths, and between sessions ----
    for w, q in ((320, ''), (375, ''), (1280, ''), (375, '&season=off')):
        c, p = ctx(br, w); begin(p, q)
        bn = box(p, '.st-hellobar [data-stnext]')
        ok(seen(bn, w) and bn['primary'], f'{w}{q}: Let’s begin is in view, {bn and round(bn["h"])}px tall, the primary')
        ok(p.locator('.st-hellobar .btn').count() == 1 and p.locator('[data-stleave]').count() == 0 and 'Just look around' not in p.inner_text('body'),
           f'{w}{q}: no "Just look around" and no other way out on the welcome ({p.locator(".st-hellobar .btn").count()} buttons)')
        if q == '': p.screenshot(path=os.path.join(OUT, f'{w}_welcome.png'))
        c.close()

    # ---- 2. no "Leave, go to Home" on any step; Skip this part still goes on inside the visit ----
    WALK = [('topics', [to_topics]), ('issues', [to_topics, to_issues]), ('alerts', [to_topics, to_issues, to_alerts]),
            ('bill', [to_topics, to_issues, to_alerts, to_story]), ('soon', [to_topics, to_issues, to_alerts, to_story, to_soon])]
    for name, path in WALK:
        c, p = ctx(br, 375); begin(p)
        for f in path: f(p)
        ok(p.locator('[data-stleave]').count() == 0 and 'Leave, go to Home' not in p.inner_text('body'), f'{name}: no "Leave, go to Home" ({H(p)})')
        sk = p.locator('.st-bar [data-stskip]')
        if name == 'topics':
            ok(sk.count() == 0 and p.locator('.st-bar .btn').count() == 1, 'topics: the bar is Next alone')
        elif name != 'soon':   # Coming up has no Skip in today's version: its bar is Next
            ok(sk.count() == 1 and sk.first.inner_text().strip() == 'Skip this part', f'{name}: the bar says "Skip this part"')
        if name in ('topics', 'bill'): p.screenshot(path=os.path.join(OUT, f'375_{name}.png'))
        c.close()

    # Next with nothing picked on the topics stays and asks for a pick
    c, p = ctx(br, 375); begin(p); to_topics(p)
    p.click('.st-bar [data-stnext]'); p.wait_for_timeout(500)
    msg = p.locator('#st-alert').inner_text()
    ok('Pick at least one issue to go on.' in msg and p.locator('.st-tile').count() >= 3, f'topics, Next with nothing picked: stays and asks for a pick ({msg!r})')
    c.close()
    # Skip this part goes on, through to the finale, which ends on Home
    c, p = ctx(br, 375); begin(p); to_topics(p); to_issues(p); to_alerts(p); fv0 = len(fv(p)); to_story(p)
    ok(h1(p) == 'A bill’s story' and any(e.get('step') == 'alerts' and e.get('event') == 'skip' for e in fv(p)[fv0:]), 'alerts: Skip this part goes on to the story')
    fv0 = len(fv(p)); to_soon(p)
    ok(p.locator('.st-soonpage').count() == 1 and any(e.get('step') == 'bill' and e.get('event') == 'skip' for e in fv(p)[fv0:]), f'the story: Skip this part goes on to Coming up ({h1(p)})')
    p.click('.st-bar [data-stnext]'); p.wait_for_selector('.st-done', timeout=20000); p.wait_for_timeout(500)
    ok(p.locator('[data-stleave]').count() == 0, 'the finale has no Leave: it ends on Home')
    c.close()
    # the issues screen: Skip this part follows nothing and goes on
    c, p = ctx(br, 375); begin(p); to_topics(p); to_issues(p)
    p.click('.st-bar [data-stskip]'); p.wait_for_selector('.st-lesson', timeout=20000)
    ok(h1(p) == 'A bill’s story' and follows(p) == 0, f'issues: Skip this part follows nothing and goes on to the story ({h1(p)})')
    c.close()

    # ---- 3. the short version's page, and a shared bill's "Follow this issue?" ----
    c, p = ctx(br, 375); begin(p, '&fv=short&abrest=today'); to_topics(p); to_issues(p); to_alerts(p)
    p.click('.st-bar [data-stskip]'); p.wait_for_selector('.st-voicepage', timeout=20000); p.wait_for_timeout(400)
    ok(p.locator('[data-stleave]').count() == 0 and p.locator('.st-bar [data-stskip]').inner_text().strip() == 'Skip this part', 'the short version\'s page: no Leave, Skip this part in the bar')
    c.close()
    c, p = ctx(br, 375); p.goto(f'{BASE}/track.html?demo=1&restart&debug#/'); p.wait_for_timeout(1500)
    p.evaluate("localStorage.setItem('hiphi_wiz', JSON.stringify({step:1, via:'HB2121', issues:[]}))"); p.goto(f'{BASE}/track.html?demo=1&debug#/start/1'); p.reload()
    p.wait_for_selector('.st-followask', timeout=30000); p.wait_for_timeout(600)
    ok(p.locator('[data-stleave]').count() == 0 and p.locator('.st-bar [data-stskip]').inner_text().strip() == 'Not now', 'a shared bill\'s "Follow this issue?": no Leave, its own "Not now" kept')
    c.close()

    # ---- 4. a plan (practice only) keeps its own screens and its Skip ----
    c, p = ctx(br, 375); p.goto(f'{BASE}/track.html?demo=1&restart&debug&ab=onb.p5&abrest=today'); p.wait_for_selector('.st-tile', timeout=40000); p.wait_for_timeout(600)
    sk = p.locator('.st-bar [data-stskip]')
    ok(p.locator('[data-stleave]').count() == 0 and sk.count() == 1 and sk.inner_text().strip() == 'Skip', 'a plan keeps its own screens: no Leave, and its Skip says Skip')
    c.close()

    br.close()

ok(not writes, f'nothing was written to the database, nor tried ({writes[:3]})')
ok(not errs, f'no page errors ({errs[:3]})')
print(f'\n{sum(res)} passed, {len(res) - sum(res)} failed')
sys.exit(0 if all(res) else 1)
