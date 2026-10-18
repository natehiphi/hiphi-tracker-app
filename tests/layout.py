# The layout test (R-187, pub/variant.js 'layout', backend migrations 149 and 169). Since 11 Oct (R-222, Nate: "This becomes
# the default home, while the other home screens become other testable home pages") it has three versions: 'calm', the calm
# Home (pub/calm/home.js, Direction 1, today's bill page and tabs), first and everyone's while the test is off; 'today', the
# Home before 11 Oct; 'a', R-071's week view from September (pub/a/: its Home, bill page and tabs).
#   1. the practice copy, each version forced, a returning follower (Kai, as compare.html sets him up) on a phone and a
#      laptop: each Home, its bill page and tabs; Your session stays today's; the old address and the compare page (three
#      buttons) lead to them; nothing wider than the screen; no page errors
#   2. "Next day": right after the first visit Home keeps its welcome shape in both versions; Next day is Tuesday, with
#      the calm Home's everyday shape, and the layout test is met there, never on the welcome Home or a bill page
#   3. the counting, every database request intercepted: the toss spreads new browsers over the three, the switch off gives
#      the calm Home, a page-swapping test keeps its version for the page load, and Home's-top test is counted only on the
#      Home before 11 Oct
#   4. Staff v2: the Tests card, its See it links, and the tester sheet: a group on the Home before 11 Oct, Home's top
#      replaced on the others, the links, and every group told to press Next day
#   python3 -m http.server 8832   (in this folder, once)
#   python3 tests/layout.py [base]     base defaults to http://localhost:8832
import sys, json, re, os
from playwright.sync_api import sync_playwright
BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832').rstrip('/')
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'tests', 'out'); os.makedirs(OUT, exist_ok=True)
res = []
def ok(c, m): res.append(bool(c)); print('PASS' if c else 'FAIL', m)
def ready(pg): pg.wait_for_function("() => !!document.querySelector('main') && !document.querySelector('.skelpage')", timeout=60000); pg.wait_for_timeout(900)
# Kai, as compare.html sets him up: three issues, the first visit done, last here the evening before (the sandbox's own
# storage names end in _demo; the shim in kernel.js reads them there).
MON = '2026-03-16T09:00:00-10:00'
KAI = """() => { try { const set = (k, v) => localStorage.setItem(k + '_demo', typeof v === 'string' ? v : JSON.stringify(v));
  if (localStorage.getItem('hiphi_wiz_demo')) return;
  set('hiphi_issue_follows', ['66a32660-b0a7-4a90-a71f-231963619b44', '1dcec7ca-ed94-4a19-9c9c-235514ca7491', '2616613e-a363-418b-ae19-4add60957cd8']);
  set('hiphi_watch_ids', []); set('hiphi_cat_follows', []); set('hiphi_skips', []); set('hiphi_wiz', { done: true, issues: ['tobacco', 'food', 'around'], name: 'Kai' });
  set('hiphi_onb', { lastVisit: new Date(Date.parse('2026-03-15T19:00:00-10:00')).toISOString() }); set('hiphi_done', []); set('hiphi_done_at', {}); set('hiphi_stances', {});
  set('hiphi_demo_seeded', '0'); localStorage.setItem('hiphi_tour_bill_demo', '{"how":"test"}'); localStorage.setItem('hiphi_tour_home_demo', '{"how":"test"}'); } catch {} }"""
tabs = lambda pg: [t.strip() for t in pg.eval_on_selector_all('nav.tabs a', 'as => as.map(a => a.innerText)')]
seen = lambda pg: pg.evaluate("() => (JSON.parse(localStorage.getItem('hiphi_ab_demo') || '{}').seen || {})")

with sync_playwright() as p:
    br = p.chromium.launch()
    # ================= 1. both versions, forced, in the practice copy =================
    for mobile in (True, False):
        size = 'phone' if mobile else 'laptop'
        for arm in ('calm', 'today', 'a'):
            ctx = br.new_context(viewport={'width': 390, 'height': 844} if mobile else {'width': 1280, 'height': 800}, is_mobile=mobile, has_touch=mobile)
            ctx.add_init_script(f"({KAI})()")
            pg = ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
            pg.goto(f'{BASE}/track.html?demo=1&ab=layout.{arm}#/'); ready(pg)
            if arm == 'calm':
                ok(pg.locator('#main .cm.cm-met').count() == 1 and pg.locator('#main .ah').count() == 0 and 'Aloha, Kai' in pg.locator('#main .cm-hi').first.inner_text(), f'{size} calm: Home is the calm Home (“Aloha, Kai”)')
                ok(pg.locator('.cm-slide').count() == 1 and 'Write my testimony' in pg.locator('.cm-slide .btn.primary').inner_text(), f'{size} calm: one slide, the soonest testimony deadline (R-295)')
                ok(pg.locator('#cm-iss-h').count() == 1 and pg.locator('.cm-rows .cm-row').count() == 3, f'{size} calm: then Your issues, one row each ({pg.locator(".cm-rows .cm-row").count()})')
                ok(not pg.evaluate("document.body.classList.contains('va')") and not pg.evaluate("!!document.querySelector('link[href=\"pub/a/a.css\"]')"), f'{size} calm: the week view’s look is not loaded')
                if mobile: ok(tabs(pg) == ['Home', 'My issues', 'Find', 'More'], f'{size} calm: today’s tabs {tabs(pg)}')
                else: ok('More' in pg.locator('.hnav').inner_text(), f'{size} calm: the header’s tabs are today’s')
            elif arm == 'a':
                ok(pg.locator('#main .ah').count() == 1 and 'Aloha, Kai' in pg.locator('h1').first.inner_text(), f'{size} A: Home is the week view’s (“Aloha, Kai”)')
                ok(pg.locator('.a-now').count() == 1 and 'Write my testimony' in pg.locator('.a-now').inner_text(), f'{size} A: the Now card leads with the soonest testimony deadline')
                ok(pg.evaluate("document.body.classList.contains('va')") and pg.evaluate("!!document.querySelector('link[href=\"pub/a/a.css\"]')?.sheet"), f'{size} A: its look is on (body.va, pub/a/a.css)')
                if mobile: ok(tabs(pg) == ['Home', 'My issues', 'Find', 'You'], f'{size} A: the tabs are Home, My issues, Find, You {tabs(pg)}')
                else: ok('You' in pg.locator('.hnav').inner_text() and 'More' not in pg.locator('.hnav').inner_text(), f'{size} A: the header’s tabs end with You')
            else:
                ok(pg.locator('#main .ah').count() == 0 and pg.locator('#main .hm-follow').count() == 1, f'{size} today: Home is today’s')
                ok(not pg.evaluate("document.body.classList.contains('va')") and not pg.evaluate("!!document.querySelector('link[href=\"pub/a/a.css\"]')"), f'{size} today: version A’s look is never loaded')
                if mobile: ok(tabs(pg) == ['Home', 'My issues', 'Find', 'More'], f'{size} today: the tabs end with More {tabs(pg)}')
            ok(pg.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1"), f'{size} {arm}: Home has no sideways scroll')
            ok(seen(pg).get('layout', {}).get('arm') == arm, f'{size} {arm}: Home meets the layout test, as {arm} ({seen(pg).get("layout")})')
            pg.screenshot(path=os.path.join(OUT, f'layout_home_{arm}_{size}.png'))
            # the bill page
            pg.goto(f'{BASE}/track.html?demo=1&ab=layout.{arm}#/bill/HB1780'); pg.reload(); ready(pg); pg.wait_for_selector('.bl-head', timeout=30000)
            trk, stat = pg.locator('.a-track').count(), pg.locator('.bl-status').count()
            if arm == 'a': ok(trk == 1 and stat == 0 and 'step 3 of 6' in pg.locator('.a-track').inner_text(), f'{size} A: the bill page opens on where it is (“In the Senate, step 3 of 6”)')
            else: ok(trk == 0 and stat == 1, f'{size} {arm}: the bill page is today’s, with its status card')
            ok(pg.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1"), f'{size} {arm}: the bill page has no sideways scroll')
            pg.screenshot(path=os.path.join(OUT, f'layout_bill_{arm}_{size}.png'))
            if mobile:
                # a saved letter for the hearing the first card offers: one button for it, not two (the fresh-eyes review)
                pg.goto(f'{BASE}/track.html?demo=1&ab=layout.{arm}#/'); pg.reload(); ready(pg)
                hid = pg.get_attribute('.a-now [data-helper]' if arm == 'a' else '#main .cm-slide [data-helper]' if arm == 'calm' else '#main .acard [data-helper]', 'data-helper')
                pg.evaluate("hid => { const m = JSON.parse(localStorage.getItem('hiphi_me') || '{}'); m.drafts = { [hid]: { body: 'Aloha', at: new Date().toISOString() } }; localStorage.setItem('hiphi_me', JSON.stringify(m)); }", hid)
                pg.reload(); ready(pg)
                if arm == 'calm':
                    ok(pg.locator('#main .hm-draft').count() == 0 and 'Finish sending your testimony' in pg.locator('.cm-slide').inner_text(), 'calm: a saved letter shows once, as the slide’s “Finish sending your testimony”')
                elif arm == 'a':
                    ok(pg.locator('#main .hm-draft').count() == 0 and 'Finish sending your testimony' in pg.locator('.a-now').inner_text(), 'A: a saved letter shows once, as the Now card’s “Finish sending your testimony”')
                else:
                    ok(pg.locator('#main .hm-draft').count() == 0 and 'Finish sending your testimony' in pg.locator('#main .hm-now .acard').first.inner_text(), 'today: a saved letter shows once, as the first card’s “Finish sending your testimony” (R-189)')
                pg.evaluate("() => { const m = JSON.parse(localStorage.getItem('hiphi_me') || '{}'); delete m.drafts; localStorage.setItem('hiphi_me', JSON.stringify(m)); }")
                pg.goto(f'{BASE}/track.html?demo=1&ab=layout.{arm}#/bill/HB1780'); pg.reload(); ready(pg); pg.wait_for_selector('.bl-head', timeout=30000)
            if arm == 'calm' and mobile:
                # Your session stays today's
                pg.goto(f'{BASE}/track.html?demo=1&ab=layout.calm#/recap'); pg.reload(); ready(pg)
                ok(pg.locator('#main .cm').count() == 0 and pg.locator('#main .hm').count() == 1, 'calm: Your session (#/recap) is today’s page, not the calm Home')
                # Home's top test: never met on the calm Home
                pg.goto(f'{BASE}/track.html?demo=1&ab=layout.calm,home.by-issue#/'); pg.reload(); ready(pg)
                ok(pg.locator('.hm-byissue').count() == 0 and pg.locator('#main .cm').count() == 1 and 'home' not in seen(pg), 'calm: Home’s-top test is neither drawn nor met on the calm Home')
            ok(not errs, f'{size} {arm}: no page errors {errs[:2]}'); ctx.close()

    # the old address and the compare page lead to the test
    ctx = br.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True); ctx.add_init_script(f"({KAI})()")
    pg = ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(f'{BASE}/track-a.html?day=tue#/bill/HB1780'); pg.wait_for_url(re.compile(r'track\.html'), timeout=15000); ready(pg)
    q = pg.evaluate("location.search + location.hash")
    ok('ab=layout.a' in q.replace('%2C', ',').replace('%2E', '.') and 'day=tue' in q and 'demo=1' in q and re.search(r'#/bill/(2026/)?HB1780$', q), f'track-a.html opens track.html on the week view, keeping the day and the page: {q}')
    pg.goto(f'{BASE}/compare.html'); pg.locator('[data-layout="calm"]').click(); pg.wait_for_url(re.compile(r'track\.html'), timeout=15000); ready(pg)
    ok('ab=layout.calm' in pg.url and pg.locator('#main .cm').count() == 1, f'compare.html: Open the calm Home opens it: {pg.url}')
    pg.goto(f'{BASE}/compare.html'); pg.locator('[data-layout="a"]').click(); pg.wait_for_url(re.compile(r'track\.html'), timeout=15000); ready(pg)
    ok('ab=layout.a' in pg.url and pg.locator('#main .ah').count() == 1, f'compare.html: Open version A (September) opens the week view: {pg.url}')
    pg.goto(f'{BASE}/compare.html'); pg.locator('[data-layout="today"]').click(); pg.wait_for_url(re.compile(r'track\.html'), timeout=15000); ready(pg)
    ok('ab=layout.today' in pg.url and pg.locator('#main .hm-follow').count() == 1, f'compare.html: Open the Home before 11 Oct opens it: {pg.url}')
    pg.goto(f'{BASE}/compare.html?ab=layout.calm')
    b = pg.eval_on_selector_all('[data-open]', 'bs => bs.map(b => b.innerText.trim())')
    ok(b == ['Open it'], f'compare.html?ab=layout.calm (Tests’ See it): one button, for that version {b}')
    ok(not errs, f'old address and compare page: no page errors {errs[:2]}'); ctx.close()

    # ================= 2. Next day =================
    for arm in ('today', 'calm'):
        ctx = br.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True); ctx.add_init_script(f"({KAI})()")
        pg = ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(f'{BASE}/track.html?demo=1&ab=layout.{arm}#/'); ready(pg)
        # just finished the first visit: the welcome lasts the rest of the visit (start.js welcome())
        pg.evaluate("sessionStorage.setItem('hiphi_welcome', '1'); localStorage.removeItem('hiphi_ab_demo')"); pg.goto(f'{BASE}/track.html?demo=1&ab=layout.{arm}#/'); pg.reload(); ready(pg)
        ok((pg.locator('#main .hm-welcome').count() == 1 if arm == 'today' else pg.locator('#main .cm:not(.cm-met)').count() == 1) and pg.locator('#main .ah').count() == 0, f'{arm}: right after the first visit, Home keeps its welcome shape')
        ok('layout' not in seen(pg), f'{arm}: the welcome Home does not meet the layout test')
        nd = pg.locator('.band [data-nextday]')
        ok(nd.count() == 1 and 'day=tue' in nd.get_attribute('href') and 'later=1' in nd.get_attribute('href'), f'{arm}: the band offers Next day ({nd.get_attribute("href") if nd.count() else None})')
        box = nd.bounding_box(); ok(box and box['height'] >= 24, f'{arm}: Next day is at least 24px tall ({box and round(box["height"])})')
        nd.click(); pg.wait_for_url(re.compile(r'day=tue'), timeout=15000); ready(pg)
        ok('later' not in pg.url and 'Tue, Mar 17, 2026' in pg.locator('.band').inner_text(), f'{arm}: Next day is Tuesday 17 March, and “later” leaves the address ({pg.url[-40:]})')
        if arm == 'calm': ok(pg.locator('#main .cm.cm-met').count() == 1 and pg.locator('#main .cm-slide').count() == 1 and 'Aloha, Kai' in pg.locator('.cm-head .cm-hi').inner_text(), 'calm: on Tuesday, the calm Home’s everyday shape')
        else: ok(pg.locator('#main .hm-follow').count() == 1 and pg.locator('#main .hm-welcome').count() == 0, 'today: on Tuesday, today’s everyday Home')
        ok(seen(pg).get('layout', {}).get('arm') == arm, f'{arm}: that Home meets the layout test ({seen(pg).get("layout")})')
        ok(pg.locator('.band [data-nextday]').count() == 1 and 'day=wed' in pg.locator('.band [data-nextday]').get_attribute('href'), f'{arm}: then Next day is Wednesday')
        ok(not errs, f'{arm} next day: no page errors {errs[:2]}'); ctx.close()
    # no Next day during the first visit, or on Wednesday
    ctx = br.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True); pg = ctx.new_page()
    pg.goto(f'{BASE}/track.html?demo=1&restart#/'); ready(pg)
    ok(pg.locator('.band [data-nextday]').count() == 0, 'no Next day during the first visit')
    ctx.close()
    ctx = br.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True); ctx.add_init_script(f"({KAI})()"); pg = ctx.new_page()
    pg.goto(f'{BASE}/track.html?demo=1&day=wed#/'); ready(pg)
    ok(pg.locator('.band [data-nextday]').count() == 0 and 'Wed, Mar 18, 2026' in pg.locator('.band').inner_text(), 'no Next day on Wednesday, the last day with its decisions')
    ctx.close()

    # ================= 3. the counting =================
    ROWS = [{'key': 'home', 'arms': ['by-day', 'by-issue'], 'is_on': True, 'fallback': 'by-day'}, {'key': 'layout', 'arms': ['calm', 'today', 'a'], 'is_on': True, 'fallback': 'calm'}]
    # Three versions spread the way the first-visit test's are (multi): a number from the toss picks one, and u stands for it.
    U = {'calm': 0.1, 'today': 0.5, 'a': 0.9}
    def rig(rows):
        ctx = br.new_context(); sent = []; leak = []
        ctx.add_init_script("window.__hiphiTossTests = true; window.__hiphiCountTests = true;")
        ctx.route(re.compile(r'.*supabase\.co/rest/v1/public_ab_tests.*'), lambda r: r.fulfill(status=200, content_type='application/json', body=json.dumps(rows), headers={'access-control-allow-origin': '*'}))
        def log(r):
            sent.extend(json.loads(r.request.post_data or '{}').get('p', {}).get('e', [])); r.fulfill(status=204, body='', headers={'access-control-allow-origin': '*', 'access-control-allow-headers': '*'})
        ctx.route(re.compile(r'.*supabase\.co/rest/v1/rpc/log_ab.*'), log)
        ctx.route(re.compile(r'.*supabase\.co/(?!rest/v1/(rpc/log_ab|public_ab_tests)).*'), lambda r: (leak.append(r.request.url), r.abort()))
        pg = ctx.new_page(); pg.goto(BASE + '/tests/'); return ctx, pg, sent, leak
    ctx, pg, sent, leak = rig(ROWS)
    n = pg.evaluate("""async () => { const n = { calm: 0, today: 0, a: 0 }; for (let i = 0; i < 300; i++) { localStorage.clear(); const V = await import('/pub/variant.js?c=' + i); await V.abReady; n[V.armOf('layout')]++; } return n; }""")
    ok(all(60 <= n.get(k, 0) <= 140 for k in ('calm', 'today', 'a')), f'300 new browsers: about a third get each version ({n})')
    ok(not leak, 'the toss: nothing else reached the database: ' + '; '.join(leak[:2])); ctx.close()
    # one fresh page per case: the page's own copies, so visitlog.js hands variant.js its sender as on the real page
    for arm in ('calm', 'a', 'today'):
        ctx, pg, sent, leak = rig(ROWS)
        r = pg.evaluate("""async ([arm, u]) => { localStorage.clear(); localStorage.setItem('hiphi_ab', JSON.stringify({ v: 1, arms: { home: 'by-issue' }, u: { layout: u }, forced: {} }));
          await import('/pub/visitlog.js'); const V = await import('/pub/variant.js'); await V.abReady; const was = V.armOf('layout');
          V.abSeen('layout'); V.abSeen('home'); return [was, V.armOf('home')]; }""", [arm, U[arm]])
        pg.wait_for_timeout(1900)
        mine = [(e['t'], e['a'], e['k'], e['f']) for e in sent]
        ok(r[0] == arm and ('layout', arm, 'seen', False) in mine, f'tossed {arm}: shown and counted as {arm} {r} {mine}')
        ok((('home', 'by-issue', 'seen', False) in mine) == (arm == 'today'), f'tossed {arm}: Home’s-top test {"counted" if arm == "today" else "never counted"} {mine}')
        ok(not leak, f'tossed {arm}: nothing else reached the database: ' + '; '.join(leak[:2])); ctx.close()
    # switched off: the calm Home for everyone, nothing counted
    ctx, pg, sent, leak = rig([dict(ROWS[1], is_on=False)])
    r = pg.evaluate("""async () => { localStorage.clear(); localStorage.setItem('hiphi_ab', JSON.stringify({ v: 1, arms: {}, u: { layout: 0.9 }, forced: {} }));
      await import('/pub/visitlog.js'); const V = await import('/pub/variant.js'); await V.abReady; const a = V.armOf('layout'); V.abSeen('layout'); return a; }""")
    pg.wait_for_timeout(1900)
    ok(r == 'calm' and not [e for e in sent if e['t'] == 'layout'], f'switched off: the calm Home, and not counted ({r})')
    # the database not yet changed (before migration 169: two versions, the page has three): off, the calm Home
    ctx2, pg2, sent2, leak2 = rig([{'key': 'layout', 'arms': ['today', 'a'], 'is_on': True, 'fallback': 'today'}])
    r2 = pg2.evaluate("""async () => { localStorage.clear(); localStorage.setItem('hiphi_ab', JSON.stringify({ v: 1, arms: { layout: 'today' }, u: { layout: 0.5 }, forced: {} }));
      await import('/pub/visitlog.js'); const V = await import('/pub/variant.js'); await V.abReady; return V.armOf('layout'); }""")
    ok(r2 == 'calm', f'before migration 169 (the database lists two versions): the calm Home for everyone ({r2})'); ctx2.close()
    ok(not leak, 'switched off: nothing else reached the database: ' + '; '.join(leak[:2])); ctx.close()
    # kept for the page load: last visit's switches said on, the database now says off; the page drawn stays version A
    # until the next load (and that load is not counted), and the load after that is today's
    ctx, pg, sent, leak = rig([dict(ROWS[1], is_on=False)])
    r = pg.evaluate("""async () => { localStorage.clear(); localStorage.setItem('hiphi_ab', JSON.stringify({ v: 1, arms: {}, u: { layout: 0.9 }, forced: {} }));
      localStorage.setItem('hiphi_ab_cfg', JSON.stringify({ layout: { on: true, fallback: 'calm', arms: null } }));
      // variant.js first: visitlog.js imports it too, and the database's answer could land before the first look (a race)
      const V = await import('/pub/variant.js'); const first = V.armOf('layout'); await import('/pub/visitlog.js'); await V.abReady; const after = V.armOf('layout'); V.abSeen('layout');
      return [first, after, JSON.parse(localStorage.getItem('hiphi_ab_cfg')).layout.on]; }""")
    pg.wait_for_timeout(1900)
    ok(r == ['a', 'a', False] and not [e for e in sent if e['t'] == 'layout' and e['k'] == 'seen'], f'kept for the page load, not counted once the switch is off, and the next load has it ({r})')
    pg.reload(); r2 = pg.evaluate("async () => { const V = await import('/pub/variant.js'); return V.armOf('layout'); }")
    ok(r2 == 'calm', f'the next page load is the calm Home ({r2})')
    ok(not leak, 'nothing else reached the database: ' + '; '.join(leak[:2])); ctx.close()

    # ================= 4. Staff v2: Tests and the tester sheet =================
    for w, h, tag in [(1280, 800, 'laptop'), (390, 844, 'phone')]:
        ctx = br.new_context(viewport={'width': w, 'height': h}, is_mobile=w < 500, has_touch=w < 500)
        pg = ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        # R-201: each test on its own page (#/setup/test?t=<key>)
        pg.goto(f'{BASE}/staff.html?demo=1#/setup/test?t=layout'); pg.wait_for_selector('.ab-card', timeout=60000); pg.wait_for_timeout(600)
        card = pg.locator('.ab-card[data-abtest="layout"]')
        ok(card.count() == 1 and pg.locator('#ab-arm-layout-calm').is_checked() and not pg.locator('#ab-arm-layout-today').is_checked() and not pg.locator('#ab-arm-layout-a').is_checked(), f'{tag}: Tests has the layout card, off, the calm Home for everyone (R-192’s switches)')
        links = card.locator('a[target="_blank"]').evaluate_all("as => as.map(a => a.getAttribute('href'))")
        pg.goto(f'{BASE}/staff.html?demo=1#/setup/test?t=home'); pg.wait_for_selector('.ab-card[data-abtest="home"]', timeout=60000); pg.wait_for_timeout(600)
        homec = pg.locator('.ab-card[data-abtest="home"]').inner_text()
        ok(not pg.locator('#ab-arm-home-by-issue').is_checked() and 'Not testing' in homec and 'before 11 Oct' in homec and 'Keep it running' not in homec and 'paused' in homec.lower(), f'{tag}: Home’s top is off, saying why, and not told to keep running')
        # Each version’s link opens Home (track.html, forced to that version, three issues followed), not the compare page (R-187)
        ok(all(any('track.html' in l and f'ab=layout.{a}' in l and '#/follow/' in l for l in links) for a in ('calm', 'today', 'a')) and not any('compare.html' in l for l in links), f'{tag}: each version’s link opens Home on its own version, not the compare page {links}')
        pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
        # the tester sheet: Group 1 on the calm Home (the first version, everyone's), Group 2 on the Home before 11 Oct
        pg.goto(f'{BASE}/staff.html?demo=1#/setup/room'); pg.wait_for_selector('.rm-group', timeout=60000); pg.wait_for_timeout(600)
        pg.locator('[data-rmreset]').click(); pg.wait_for_timeout(500)
        pg.locator('[data-rmscreen="1"]').click(); pg.wait_for_timeout(350)
        v = pg.eval_on_selector_all('dialog [data-pv]', 'bs => bs.map(b => b.dataset.pv)')
        ok('layout' in v, f'{tag}: “Change another screen” offers Home {v}')
        pg.locator('dialog [data-pv="layout"]').click(); pg.wait_for_timeout(600)
        pg.locator('dialog [data-pv="today"]').click(); pg.wait_for_timeout(600)
        u = pg.eval_on_selector_all('[data-rmqr]', 'bs => bs.map(b => b.dataset.url)')
        ok(u[1].endswith('ab=onb.p1,layout.today'), f'{tag}: Group 2’s link opens the Home before 11 Oct: {u[1]}')
        g1 = pg.locator('.rm-group').nth(0).inner_text()
        ok('Home: the calm Home' in g1 and '(today’s)' in g1, f'{tag}: Group 1 shows the same row, at the calm Home, today’s')
        # Home's top: only the Home before 11 Oct meets it; on the calm Home it is replaced, and picking the week view takes it off
        pg.locator('[data-rmscreen="1"]').click(); pg.wait_for_timeout(350); pg.locator('dialog [data-pv="home"]').click(); pg.wait_for_timeout(600)
        pg.locator('dialog [data-pv="by-issue"]').click(); pg.wait_for_timeout(600)
        ok('Replaced by the new Home' in pg.locator('.rm-group').nth(0).inner_text(), f'{tag}: on the calm Home, Home’s top says “Replaced by the new Home”')
        pg.locator('[data-rmpick="1|layout"]').click(); pg.wait_for_timeout(350); pg.locator('dialog [data-pv="a"]').click(); pg.wait_for_timeout(900)
        t = pg.locator('#toast').inner_text()
        u = pg.eval_on_selector_all('[data-rmqr]', 'bs => bs.map(b => b.dataset.url)')
        ok('Version A replaces' in t and 'home.' not in u[1] and 'layout.a' in u[1], f'{tag}: picking the week view takes Home’s top off, with a word and Undo ({t[:70]}; {u[1][-40:]})')
        # the printed sheet tells every group how to reach the next day
        pg.evaluate("""() => { window.__printed = null; new MutationObserver((ms, o) => { for (const m of ms) for (const n of m.addedNodes)
          if (n.tagName === 'IFRAME') { n.contentWindow.print = () => { window.__printed = n.contentDocument.documentElement.outerHTML; }; o.disconnect(); } })
          .observe(document.body, { childList: true }); }""")
        pg.locator('[data-stsave]').click()
        pg.wait_for_function("() => !!window.__printed", timeout=20000)
        html = pg.evaluate("window.__printed")
        ok(html.count('press “Next day” at the very top') >= 3, f'{tag}: the sheet and each group’s page say to press Next day ({html.count("Next day")})')
        ok('Home, from the visit after the first one' in html, f'{tag}: the comparison page says where version A shows')
        pg.screenshot(path=os.path.join(OUT, f'layout_room_{tag}.png'))
        ok(not errs, f'{tag} staff: no page errors {errs[:2]}'); ctx.close()
    br.close()
print(f'\n{sum(res)}/{len(res)} passed')
sys.exit(0 if all(res) else 1)
