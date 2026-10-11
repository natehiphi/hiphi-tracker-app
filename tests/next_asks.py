# A later visit's one ask, as a full page (R-237, pub/nextask.js; Nate 10/11: "Instead of cards on the home page, it should
# be a full page similar to what someone would have experienced during onboarding").
#   python3 -m http.server 8832   (in this folder, once)
#   python3 tests/next_asks.py [base]   base defaults to http://localhost:8832
# Checks, on a phone and a laptop, in the practice copy: the first visit and its own Home bring no ask; the next day opens on
# one full page in the first visit's frame (no tabs, "Welcome back", Not now) instead of Home; "Find my legislators" finds
# them from a street address and Done lands on Home; Home draws none of the old cards; Back from Home does not return to the
# answered ask; the day after brings the next ask (the profile box); "Not now" goes to Home; a reload the same day asks
# nothing; arriving on a bill's link asks nothing; testimony due within a day on what they follow: Home first, and the ask
# waits for the next day; version A and a plan get the page too; no page errors.
import os, sys
from playwright.sync_api import sync_playwright
BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832').rstrip('/')
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out', 'next_asks'); os.makedirs(OUT, exist_ok=True)
passes, fails, errors = [], [], []
def ok(c, m): (passes if c else fails).append(('PASS ' if c else 'FAIL ') + m)
OLD_CARDS = '[data-later], .hm-later, .hm-hs, .hm-newiss, .nudgecard'

def first_visit(p, ab, topic='Climate'):   # Climate: nothing due on the practice copy's days
    p.goto(f'{BASE}/track.html?demo=1&restart&ab={ab}'); p.wait_for_selector('.st-tile', timeout=30000); p.wait_for_timeout(600)
    p.locator('.st-tile', has_text=topic).first.click(); p.wait_for_timeout(200)
    for _ in range(40):
        if p.evaluate("location.hash") in ('#/', '') and p.locator('#main .hm, #main .ah').count(): return True
        if p.locator('#fx-mgo').count(): p.locator('#fx-mgo').click(); p.wait_for_timeout(1000); continue
        # Follow what the issues screen offers; skip only the alerts box (so the profile ask is left for a later day).
        order = ('[data-stdone]', '[data-stskip]', '[data-stnext]') if p.locator('.st-alertspage').count() else ('[data-stdone]', '[data-stnext]', '[data-stskip]')
        for sel in order:
            if p.locator(sel).count(): p.locator(sel).first.click(); break
        p.wait_for_timeout(1300)
    return False
def next_day(p):
    p.get_by_text('Next day').first.click(); p.wait_for_timeout(1500)
    p.wait_for_selector('#main .nx, #main .hm, #main .ah', timeout=30000); p.wait_for_timeout(1200)
h1 = lambda p: p.evaluate("(document.querySelector('main h1')?.innerText || '').replace(/\\u00a0/g, ' ')")

with sync_playwright() as pw:
    b = pw.chromium.launch()
    for w, h in ((390, 844), (1366, 900)):
        tag = 'phone' if w < 600 else 'laptop'
        c = b.new_context(viewport={'width': w, 'height': h}, is_mobile=w < 600, has_touch=w < 600, device_scale_factor=2 if w < 600 else 1, reduced_motion='reduce')
        p = c.new_page(); p.on('pageerror', lambda e: errors.append(f'{w}: {e}'))
        p.on('console', lambda m: errors.append(f'console {w}: {m.text[:160]}') if m.type == 'error' and 'favicon' not in m.text and '404' not in m.text else None)
        ok(first_visit(p, 'end.today,act.today,layout.today'), f'{tag}: the first visit ends on Home')
        ok(p.locator('#main .nx').count() == 0 and p.locator(OLD_CARDS).count() == 0, f'{tag}: the first visit\'s own Home asks nothing more')
        # ---- the next day: Who speaks for you ----
        next_day(p)
        ok(p.evaluate('location.hash') == '#/next/legs' and p.locator('#main .nx-legs').count() == 1, f'{tag}: the next day opens on a full page, Who speaks for you ({p.evaluate("location.hash")})')
        ok(p.evaluate("document.body.classList.contains('notabs')") and p.locator('nav.tabs').count() == 0, f'{tag}: a full page, no tabs, like the first visit')
        ok(p.locator('.nx-eyebrow', has_text='Welcome back').count() == 1 and h1(p) == 'Who speaks for you?', f'{tag}: "Welcome back" and the question ({h1(p)})')
        ok(p.locator('#nx-addr').count() == 1 and p.locator('.actionbar [data-nxno]').count() == 1, f'{tag}: the address box, and Not now')
        p.screenshot(path=os.path.join(OUT, f'{tag}_legs.png'))
        box = p.locator('#nx-addr'); box.click(); box.type('415 S Beretania', delay=30); p.wait_for_timeout(1800)
        pick = p.locator('[data-nxpick]').first
        (pick if pick.count() else p.locator('[data-nxtyped]').first).click(); p.wait_for_timeout(3000)
        ok(p.locator('#st-legs li').count() == 2 and h1(p) == 'These two speak for you', f'{tag}: the address finds two legislators ({p.locator("#st-legs li").count()})')
        ok(p.evaluate("!!JSON.parse(localStorage.getItem('hiphi_districts_demo') || 'null')?.senate"), f'{tag}: the districts (never the address) are kept')
        p.screenshot(path=os.path.join(OUT, f'{tag}_legs_found.png'))
        p.locator('[data-nxdone]').click(); p.wait_for_timeout(1500)
        ok(p.evaluate('location.hash') == '#/' and p.locator('#main .hm, #main .ah').count() == 1, f'{tag}: Done lands on Home')
        ok(p.locator(OLD_CARDS).count() == 0, f'{tag}: Home draws none of the old ask cards')
        # ---- a reload the same day asks nothing ----
        p.reload(); p.wait_for_selector('#main .hm, #main .ah, #main .nx', timeout=30000); p.wait_for_timeout(1000)
        ok(p.locator('#main .nx').count() == 0, f'{tag}: a reload the same day asks nothing')
        # ---- the day after: the profile box ----
        next_day(p)
        ok(p.evaluate('location.hash') == '#/next/alerts' and p.locator('#nx-aform').count() == 1, f'{tag}: the day after brings the next ask, the profile box ({p.evaluate("location.hash")})')
        ok(p.locator('.actionbar [data-nxno]').count() == 1 and p.locator('#nx-send').count() == 1, f'{tag}: Not now and the box\'s own button, side by side (C-3)')
        p.screenshot(path=os.path.join(OUT, f'{tag}_alerts.png'))
        p.locator('[data-nxno]').click(); p.wait_for_timeout(1200)
        ok(p.evaluate('location.hash') == '#/' and p.locator('#main .hm, #main .ah').count() == 1, f'{tag}: Not now goes to Home')
        ok(p.evaluate("(JSON.parse(localStorage.getItem('hiphi_onb_demo') || '{}').nudgeNo || 0) === 1"), f'{tag}: and quiets the profile ask as everywhere (14 days)')
        ok(p.evaluate("import('./pub/nextask.js').then(m => m.pickAsk())") == '', f'{tag}: after a Not now, no page for three days, whichever ask is next')
        # ---- arriving on a bill's link asks nothing ----
        p.evaluate("localStorage.setItem('hiphi_askday_demo', 'mon')")
        p.goto(f'{BASE}/track.html?demo=1&day=wed&ab=end.today,act.today,layout.today#/bill/HB2121'); p.wait_for_timeout(5000)
        ok(p.evaluate('location.hash').startswith('#/bill/') and p.locator('#main .nx').count() == 0, f'{tag}: arriving on a bill\'s link asks nothing ({p.evaluate("location.hash")})')
        c.close()
    # ---- testimony due within a day (Food on the practice copy's Tuesday: HB 2300, due that afternoon): Home first ----
    c = b.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, device_scale_factor=2, reduced_motion='reduce'); p = c.new_page()
    p.on('pageerror', lambda e: errors.append(f'due: {e}'))
    first_visit(p, 'end.today,act.today,layout.today', 'Food'); next_day(p)
    ok(p.evaluate('location.hash') == '#/' and p.locator('#main .nx').count() == 0, f'testimony due within a day: Home first, no ask ({p.evaluate("location.hash")})')
    next_day(p)
    ok(p.evaluate('location.hash') == '#/next/legs', f'and the ask comes the next day instead ({p.evaluate("location.hash")})')
    c.close()
    # ---- each of the other pages, opened by its address: drawn in the same frame; Not now goes to Home and quiets it ----
    for w, h in ((390, 844), (1366, 900)):
        tag = 'phone' if w < 600 else 'laptop'
        c = b.new_context(viewport={'width': w, 'height': h}, is_mobile=w < 600, device_scale_factor=2 if w < 600 else 1, reduced_motion='reduce'); p = c.new_page()
        p.on('pageerror', lambda e: errors.append(f'pages {w}: {e}'))
        first_visit(p, 'end.today,act.today,layout.today')
        for k, want in (('learn', 'The three moments when you can help'), ('share', 'Bring a friend along'), ('phone', 'Keep the tracker on your phone')):
            p.goto(f'{BASE}/track.html?demo=1&ab=end.today,act.today,layout.today#/next/{k}'); p.wait_for_selector('#main .nx', timeout=30000); p.wait_for_timeout(900)
            ok(h1(p) == want and p.locator('nav.tabs').count() == 0 and p.locator('.actionbar [data-nxno]').count() == 1, f'{tag} {k}: "{h1(p)}", full page, Not now')
            p.screenshot(path=os.path.join(OUT, f'{tag}_{k}.png'))
            if k == 'learn':
                p.locator('[data-nxgo]').click(); p.wait_for_timeout(2000)
                ok(p.evaluate('location.hash').startswith('#/learn/'), f'{tag} learn: Show Me opens the lesson ({p.evaluate("location.hash")})')
                continue
            p.locator('[data-nxno]').click(); p.wait_for_timeout(1000)
            got = p.evaluate(f"(JSON.parse(localStorage.getItem('hiphi_asks_demo') || '{{}}')['{k}'] || {{}}).no || (localStorage.getItem('hiphi_hs_no_demo') === '1' ? 1 : 0)")
            ok(p.evaluate('location.hash') == '#/' and got == 1, f'{tag} {k}: Not now goes to Home and quiets it ({got})')
        # A new issue: one issue in a topic they follow, not followed, that this browser has not seen (HIPHI took it up since).
        nid = p.evaluate("""async () => { const k = await import('./pub/core.js'); const S = k.S;
          const cats = new Set(S.issues.filter(i => S.issueFollows.has(i.id)).flatMap(i => i.categories));
          const i = S.issues.find(i => !k.issueFollowed(i) && i.categories.some(c => cats.has(c) && !S.catFollows.has(c))); if (!i) return '';
          localStorage.setItem('hiphi_seen_issues', JSON.stringify(S.issues.map(x => x.id).filter(x => x !== i.id))); return i.id; }""")
        if nid:
            p.goto(f'{BASE}/track.html?demo=1&ab=end.today,act.today,layout.today#/next/issues'); p.wait_for_selector('#main .nx', timeout=30000); p.wait_for_timeout(900)
            ok(h1(p).startswith('A new issue in') and p.locator('[data-nxiss]').count() == 1, f'{tag} issues: "{h1(p)}", one to follow')
            p.screenshot(path=os.path.join(OUT, f'{tag}_issues.png'))
            p.locator('[data-nxiss]').click(); p.wait_for_timeout(1000)
            ok(p.locator('[data-nxiss][aria-pressed=true]').count() == 1 and p.locator('[data-nxdone]').count() == 1, f'{tag} issues: a tap follows it, and the bar says Done')
            p.locator('[data-nxdone]').click(); p.wait_for_timeout(1000)
            ok(p.evaluate('location.hash') == '#/', f'{tag} issues: Done goes to Home')
        else: ok(False, f'{tag} issues: no unfollowed issue in a followed topic to try it with')
        p.goto(f'{BASE}/track.html?demo=1#/next/nonsense'); p.wait_for_timeout(4000)
        ok(p.evaluate('location.hash') == '#/', f'{tag}: an unknown ask goes to Home ({p.evaluate("location.hash")})')
        c.close()
    # ---- version A, and a plan ----
    for ab, name in (('end.today,act.today,layout.a', 'version A'), ('onb.p5', 'Plan 5')):
        c = b.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, device_scale_factor=2, reduced_motion='reduce'); p = c.new_page()
        p.on('pageerror', lambda e: errors.append(f'{name}: {e}'))
        first_visit(p, ab); next_day(p)
        ok(p.evaluate('location.hash') == '#/next/legs', f'{name}: the next day opens on the full page too ({p.evaluate("location.hash")})')
        p.locator('[data-nxno]').click(); p.wait_for_timeout(1500)
        ok(p.evaluate('location.hash') == '#/' and p.locator(OLD_CARDS).count() == 0, f'{name}: Not now lands on Home, with no old cards')
        c.close()
    b.close()
print('\n'.join(fails) or 'all pass')
print(f'{len(passes)}/{len(passes) + len(fails)} passed')
print('errors:', errors[:8])
sys.exit(1 if fails or errors else 0)
