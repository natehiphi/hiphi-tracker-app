# The first visit's doors (R-212 #46, the power users' walk: anyone who is not a newcomer needed about 5 taps to reach Home).
#   python3 -m http.server 8832   (in this folder, once)
#   python3 tests/first_visit_doors.py [base] [out]   base defaults to http://localhost:8832
# In the practice copy, today's version (an automated browser gets each test's first version):
#   - the welcome's "Just look around" reaches Home in one tap, a reload stays on Home, Back leaves the site, Home offers a
#     way back to pick issues (B-3), and the welcome still has one primary (A-3, C-2);
#   - "Leave, go to Home" on every step after the welcome (topics, issues, alerts, the story, Coming up; the short version's
#     page; a shared bill's "Follow this issue?") reaches Home in one tap, keeps what was followed before it and follows
#     nothing more, and a reload stays on Home; not on the finale, nor over the "Mahalo!" cover, nor in a plan;
#   - "Skip this part" is the bar's word on each step and still goes on to the next screen; on the topics, which have no Back,
#     Leave stands in Skip's place in the bar instead of a row of its own (the critic: the row pushed the cards 36px down);
#   - at 320, 375 and 1280 wide both new controls are in view, not clipped, at least 44px tall, and Leave shares its row
#     with Back without wrapping or touching it;
#   - the private counts get 'leave' for the step it was pressed on (and 'skip' for Skip): read from the sandbox's own
#     printout (?debug), never sent. Every write to the database is refused and must not even be tried (a link that names a
#     version carries &abrest, so the testers' path log stays off too).
#   - Back from Home after leaving returns to the step that was left (B-4, B-5); after "Just look around", to the welcome.
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
    p.click('.st-bar [data-stskip]'); p.wait_for_selector('.st-lesson [data-stleave]', timeout=20000); p.wait_for_timeout(600)
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

    # ---- 1. the welcome's "Just look around", at three widths ----
    for w in (320, 375, 1280):
        c, p = ctx(br, w); begin(p)
        b = box(p, '.st-hellobar [data-stleave]'); bn = box(p, '.st-hellobar [data-stnext]')
        ok(b and b['text'] == 'Just look around' and seen(b, w) and not b['primary'], f'{w}: the welcome offers "Just look around", in view, not clipped, {b and round(b["h"])}px tall, not a primary {b and (round(b["x"]), round(b["y"]))}')
        ok(bn and b and b['y'] >= bn['b'] - 1 and p.locator('.actionbar .btn.primary').count() == 1, f'{w}: it sits under Let’s begin, which stays the one primary (A-3, C-2)')
        p.screenshot(path=os.path.join(OUT, f'{w}_welcome.png'))
        p.click('.st-hellobar [data-stleave]')
        ok(home(p), f'{w}: one tap reaches Home ({H(p)}, {screen(p)})')
        ev = last_leave(p)
        ok(len(ev) == 1 and ev[0].get('step') == 'arrive' and ev[0].get('path') == 'in', f'{w}: counted as leave on the welcome, arrive ({ev})')
        ok(wiz(p).get('skipped') is True and not wiz(p).get('done'), f'{w}: the first visit is marked left, not done ({wiz(p)})')
        if w == 375:
            ok(p.locator('a[href="#/start/1"]').count() >= 1, 'Home offers a way back to pick issues (B-3): a link to the topics')
            p.screenshot(path=os.path.join(OUT, f'{w}_home_after_look.png'), full_page=True)
        p.reload(); p.wait_for_timeout(2500)
        ok(H(p) in ('#/', '') and screen(p) == 'home', f'{w}: a reload stays on Home, the welcome does not open again ({H(p)})')
        if w == 375:
            p.go_back(); p.wait_for_timeout(1800)
            ok(H(p) == '#/start/0' and p.locator('.st-hellobar [data-stleave]').count() == 1, f'Back from Home after "Just look around" returns to the welcome, both doors there (B-4) ({H(p)})')
        c.close()
    # between sessions too
    c, p = ctx(br, 375); begin(p, '&season=off'); p.click('.st-hellobar [data-stleave]')
    ok(home(p) and p.locator('a[href="#/start/1"]').count() >= 1, 'between sessions: Home, with "Pick the issues I care about" (B-3)')
    p.screenshot(path=os.path.join(OUT, '375_home_after_look_off.png'), full_page=True)
    c.close()

    # ---- 2. "Leave, go to Home" from each step, and "Skip this part" beside it ----
    WALK = [('topics', [to_topics]), ('issues', [to_topics, to_issues]), ('alerts', [to_topics, to_issues, to_alerts]),
            ('bill', [to_topics, to_issues, to_alerts, to_story]), ('soon', [to_topics, to_issues, to_alerts, to_story, to_soon])]
    for name, path in WALK:
        c, p = ctx(br, 375); begin(p)
        for f in path: f(p)
        step = H(p)
        b = box(p, '[data-stleave]'); sk = p.locator('.st-bar [data-stskip], .st-bar [data-stnext].secondary')
        ok(b and b['text'] == 'Leave, go to Home' and seen(b, 375) and not b['primary'], f'{name}: "Leave, go to Home" is there ({step}), in view, {b and round(b["h"])}px tall, a quiet text button')
        if name == 'topics':   # no Back here: Leave takes Skip's quiet place in the bar, no row of its own above the cards (A-1)
            ok(p.locator('.st-bar [data-stleave]').count() == 1 and p.locator('.st-steps [data-stleave], .st-chapters [data-stleave]').count() == 0 and sk.count() == 0,
               'topics: Leave is in the bar beside Next, in Skip\'s place; no Skip and no row above the cards')
        else:
            ok(p.locator('.st-chapters [data-stleave]').count() == 0 and p.locator('.st-steps [data-stleave]').count() == 1, f'{name}: in the row under the strip, not in the strip (A-12)')
        if name not in ('soon', 'topics'):   # Coming up has no Skip in today's version: its bar is Next
            ok(sk.count() == 1 and sk.first.inner_text().strip() == 'Skip this part', f'{name}: the bar says "Skip this part" ({sk.first.inner_text().strip() if sk.count() else None})')
        before, fv0 = follows(p), len(fv(p))
        if name == 'bill': p.screenshot(path=os.path.join(OUT, '375_story.png'))
        p.click('[data-stleave]')
        ok(home(p), f'{name}: one tap reaches Home ({H(p)})')
        ev = [e for e in fv(p)[fv0:] if e.get('event') == 'leave']
        ok(len(ev) == 1 and ev[0].get('step') == name, f'{name}: counted as leave on {name} ({ev})')
        ok(follows(p) == before and (name in ('topics', 'issues') or before >= 1), f'{name}: what was followed stays ({before} before, {follows(p)} after); nothing ticked is followed by leaving')
        ok(wiz(p).get('skipped') is True, f'{name}: the first visit is marked left')
        if name == 'alerts':
            p.screenshot(path=os.path.join(OUT, '375_home_after_leave.png'))
            # Back after leaving (B-4, B-5): the step that was left (Home is a new page in history), with Leave on it again.
            p.go_back(); p.wait_for_timeout(1800)
            ok(H(p) == '#/start/3' and p.locator('#st-aform').count() == 1 and p.locator('[data-stleave]').count() == 1, f'Back from Home after leaving the alerts returns to the alerts, with Leave there too ({H(p)})')
            p.click('[data-stleave]'); ok(home(p), 'and Leave from there is Home again')
        p.reload(); p.wait_for_timeout(2500)
        ok(H(p) in ('#/', '') and screen(p) == 'home' and follows(p) == before, f'{name}: a reload stays on Home, follows kept ({H(p)})')
        c.close()

    # "Skip this part" still goes on to the next screen; Next with nothing picked on the topics names the way out it has
    c, p = ctx(br, 375); begin(p); to_topics(p)
    p.click('.st-bar [data-stnext]'); p.wait_for_timeout(500)
    ok('Leave, go to Home' in p.locator('#st-alert').inner_text(), f'topics, Next with nothing picked: the message names "Leave, go to Home" ({p.locator("#st-alert").inner_text()!r})')
    c.close()
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
    p.click('.st-bar [data-stskip]'); p.wait_for_selector('.st-voicepage [data-stleave]', timeout=20000); p.wait_for_timeout(400)
    ok(p.locator('.st-bar [data-stskip]').inner_text().strip() == 'Skip this part' and seen(box(p, '[data-stleave]'), 375), 'the short version\'s page: Leave at the top, Skip this part in the bar')
    before, fv0 = follows(p), len(fv(p)); p.click('[data-stleave]')
    ev = [e for e in fv(p)[fv0:] if e.get('event') == 'leave']
    ok(home(p) and follows(p) == before and len(ev) == 1 and ev[0].get('step') == 'voice', f'the short version\'s page: one tap to Home, counted on voice ({ev})')
    c.close()
    c, p = ctx(br, 375); p.goto(f'{BASE}/track.html?demo=1&restart&debug#/'); p.wait_for_timeout(1500)
    p.evaluate("localStorage.setItem('hiphi_wiz', JSON.stringify({step:1, via:'HB2121', issues:[]}))"); p.goto(f'{BASE}/track.html?demo=1&debug#/start/1'); p.reload()
    p.wait_for_selector('.st-followask', timeout=30000); p.wait_for_timeout(600)
    b = box(p, '[data-stleave]')
    ok(seen(b, 375) and p.locator('.st-bar [data-stskip]').inner_text().strip() == 'Not now', f'a shared bill\'s "Follow this issue?": Leave at the top, and its own "Not now" kept ({b and round(b["h"])}px)')
    fv0 = len(fv(p)); p.click('[data-stleave]')
    ev = [e for e in fv(p)[fv0:] if e.get('event') == 'leave']
    ok(home(p) and len(ev) == 1 and ev[0].get('step') == 'followask' and ev[0].get('path') == 'link', f'"Follow this issue?": one tap to Home, counted on followask, path link ({ev})')
    c.close()

    # ---- 4. not over the "Mahalo!" cover, and never in a plan ----
    c, p = ctx(br, 375, reduce=False); begin(p); to_topics(p); to_issues(p); to_alerts(p)
    p.click('.st-bar [data-stskip]'); p.wait_for_selector('#st-cover', timeout=5000); p.wait_for_timeout(400)
    cov = p.evaluate("(() => { const l = document.querySelector('[data-stleave]'), cv = document.getElementById('st-cover'); if (!l || !cv) return null; const r = l.getBoundingClientRect(); const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!hit && cv.contains(hit); })()")
    ok(cov is True, f'under the "Mahalo!" cover Leave cannot be reached; the cover takes the tap ({cov})')
    p.wait_for_function("!document.getElementById('st-cover')", timeout=8000); p.wait_for_timeout(1500)
    # the story is moving (no Reduce Motion): Leave stops it on the way out, with no error
    p.click('.st-bar [data-stnext]'); p.wait_for_timeout(300); p.click('[data-stleave]')
    ok(home(p), 'Leave from a story that is moving: Home, and the story stopped')
    c.close()
    c, p = ctx(br, 375); p.goto(f'{BASE}/track.html?demo=1&restart&debug&ab=onb.p5&abrest=today'); p.wait_for_selector('.st-tile', timeout=40000); p.wait_for_timeout(600)
    sk = p.locator('.st-bar [data-stskip]')
    ok(p.locator('[data-stleave]').count() == 0 and sk.count() == 1 and sk.inner_text().strip() == 'Skip', 'a plan (practice only) keeps its own screens: no Leave, and its Skip says Skip')
    c.close()

    # ---- 5. the top row and the bar at 320, 375 and 1280 ----
    for w in (320, 375, 1280):
        c, p = ctx(br, w); begin(p); to_topics(p)
        b = box(p, '[data-stleave]')
        nx = box(p, '.st-bar [data-stnext]')
        ok(seen(b, w) and b['lines'] == 1 and nx and (b['r'] <= nx['x'] or b['x'] >= nx['r']), f'{w} topics: Leave in the bar, in view, on one line, beside Next, {b and round(b["h"])}px ({b and (round(b["x"]), round(b["r"]))})')
        if w in (320, 1280): p.screenshot(path=os.path.join(OUT, f'{w}_topics.png'))
        to_issues(p); to_alerts(p); to_story(p)
        b, bk, sk, nx = box(p, '[data-stleave]'), box(p, '.st-back'), box(p, '.st-bar [data-stskip]'), box(p, '.st-bar [data-stnext]')
        ok(seen(b, w) and b['lines'] == 1 and bk and abs(bk['y'] - b['y']) <= 2 and bk['r'] <= b['x'], f'{w} story: Back and Leave share one row, apart, Leave on one line (Back {bk and round(bk["r"])} | Leave {b and round(b["x"])})')
        ok(seen(sk, w) and sk['text'] == 'Skip this part' and sk['lines'] == 1 and nx and (sk['r'] <= nx['x'] or sk['x'] >= nx['r']), f'{w} story: "Skip this part" in view, on one line, {sk and round(sk["h"])}px, beside Next and not under it')
        p.screenshot(path=os.path.join(OUT, f'{w}_story.png'))
        c.close()

    br.close()

ok(not writes, f'nothing was written to the database, nor tried ({writes[:3]})')
ok(not errs, f'no page errors ({errs[:3]})')
print(f'\n{sum(res)} passed, {len(res) - sum(res)} failed')
sys.exit(0 if all(res) else 1)
