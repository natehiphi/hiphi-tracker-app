# What testers do (R-193, Nate 10/6: "We also should start tracking testers actions beginning now"; his answers: only
# tester-sheet links, and each tester's path). pub/testerlog.js, backend migration 150.
#   1. The practice copy on a tester-sheet link (&t=<sheet>-<group>), every database request intercepted: a path is sent
#      under a random id with the sheet, group, versions, practice, device; the first visit's screens by their step names,
#      a bill page and the walkthrough by its step, with seconds; follows, an action, finishing the first visit and Next day
#      in its totals (Next day on the same path); the band says the screens are noted
#   2. Not recorded: the practice copy without a tester link, Tests' See it and compare.html (&abrest, no &t), the privacy
#      signal, an automated browser that has not asked; a link printed before (versions, no &abrest) is, with no group;
#      an ended link (R-204) goes to test-ended.html, with no way into the tracker, and is not recorded
#   3. Staff v2's tester sheet: each group's link carries &t=<sheet>-<group>; "What testers did" by group with sample paths
#      in the practice copy, "See their paths" in plain words, earlier links apart; the printed pages tell testers
#   python3 -m http.server 8832   (in this folder, once)
#   python3 tests/testers.py [base]     base defaults to http://localhost:8832
import sys, json, re, os
from playwright.sync_api import sync_playwright
BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832').rstrip('/')
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'tests', 'out'); os.makedirs(OUT, exist_ok=True)
res = []
def ok(c, m): res.append(bool(c)); print('PASS' if c else 'FAIL', m)
def ready(pg): pg.wait_for_function("() => !!document.querySelector('main') && !document.querySelector('.skelpage')", timeout=60000); pg.wait_for_timeout(900)

with sync_playwright() as p:
    br = p.chromium.launch()
    def rig(count=True, gpc=False):
        ctx = br.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True); sent = []
        if count: ctx.add_init_script("window.__hiphiCountTests = true;")
        if gpc: ctx.add_init_script("Object.defineProperty(navigator, 'globalPrivacyControl', { get: () => true });")
        def log(r):
            try: sent.append(json.loads(r.request.post_data or '{}').get('p', {}))
            except Exception: pass
            r.fulfill(status=204, body='', headers={'access-control-allow-origin': '*', 'access-control-allow-headers': '*'})
        ctx.route(re.compile(r'.*supabase\.co/rest/v1/rpc/log_tester_path.*'), log)
        ctx.route(re.compile(r'.*supabase\.co/rest/v1/public_ab_tests.*'), lambda r: r.fulfill(status=200, content_type='application/json', body='[]', headers={'access-control-allow-origin': '*'}))
        ctx.route(re.compile(r'.*supabase\.co/(?!rest/v1/(rpc/log_tester_path|public_ab_tests)).*'), lambda r: r.abort())
        pg = ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        return ctx, pg, sent, errs
    leave = lambda pg: (pg.evaluate("window.dispatchEvent(new Event('pagehide'))"), pg.wait_for_timeout(600))
    steps = lambda sent: [s[0] for x in sent for s in (x.get('steps') or [])]
    did = lambda sent: (sent[-1].get('did') or {}) if sent else {}

    # ================= 1. a tester in the practice copy =================
    ctx, pg, sent, errs = rig()
    pg.goto(f'{BASE}/track.html?demo=1&restart&abrest=today&t=k7f2q3-a9&ab=onb.today'); ready(pg)
    ok('noted for this test' in pg.locator('.band').inner_text(), f'the band says the screens are noted ({pg.locator(".band").inner_text()[:80]})')
    pg.wait_for_timeout(2500)
    ok(sent and sent[0].get('sheet') == 'k7f2q3' and sent[0].get('grp') == 'a9' and sent[0].get('place') == 'practice' and sent[0].get('device') == 'phone' and 'onb.today' in sent[0].get('versions', ''),
       f'a path starts at once with its sheet, group, versions, place and device ({ {k: sent[0].get(k) for k in ("sheet", "grp", "versions", "place", "device")} if sent else None })')
    pid = sent[0].get('id') if sent else None
    ok(pid and re.match(r'^[0-9a-f-]{36}$', pid), f'under a random id ({pid})')
    # the first visit: pick a topic, then the issues screen
    tile = pg.locator('.st-tile').first
    if tile.count(): tile.click(); pg.wait_for_timeout(400)
    nxt = pg.locator('.actionbar .btn.primary, [data-st-next]').first
    if nxt.count(): nxt.click(); pg.wait_for_timeout(2200)
    leave(pg)
    st = steps(sent)
    ok(any(s.startswith('start:topics') for s in st), f'the first visit’s screens are named by their step ({st[:4]})')
    ok(all(isinstance(x[1], int) and x[1] >= 0 for y in sent for x in (y.get('steps') or [])), 'every screen has its seconds')
    # a bill, an action, Home
    pg.goto(f'{BASE}/track.html?demo=1&abrest=today&t=k7f2q3-a9&ab=onb.today#/bill/HB1780'); ready(pg); pg.wait_for_timeout(1500)
    pg.evaluate("async () => { const v = await import('./pub/visitlog.js'); v.logAct('share'); }")
    pg.evaluate("async () => { const c = await import('./pub/core.js'); const i = c.S.issues[0]; await c.setFollows({ issuesOn: [i.id] }); }"); pg.wait_for_timeout(1500)
    pg.evaluate("async () => { const v = await import('./pub/variant.js'); v.abEvent('finished'); v.abEvent('finished'); v.abEvent('email'); }")
    pg.wait_for_timeout(1200); leave(pg)
    ids = {x.get('id') for x in sent}
    ok(ids == {pid}, f'the same tester all along, through the reload ({len(ids)} ids)')
    ok('bill/hb1780' in steps(sent), f'a bill page is a step ({[s for s in steps(sent) if "bill" in s][:2]})')
    d = did(sent)
    ok(d.get('share') == 1 and d.get('followed', 0) >= 1 and d.get('finished') == 1 and d.get('contact') == 1, f'what they did, as totals: shared, followed, finished once, gave a number once ({d})')
    # the walkthrough by its step
    pg.evaluate("async () => { const c = await import('./pub/core.js'); const b = c.D.bills.find(x => x.bill_number === 'HB1780'); const h = c.D.hearings.find(x => x.bill_id === b.id && new Date(x.scheduled_at) > Date.now()); c.app.openHelper(b.id, h.id); }")
    pg.wait_for_timeout(2600); leave(pg)
    hp = [s for s in steps(sent) if ':testimony:' in s]
    ok(hp, f'the testimony walkthrough is a step, by its own step ({hp[:2]})')
    # Next day: the same path, one more day (the walkthrough closed first, so its reopening is not cut off mid-load)
    pg.keyboard.press('Escape'); pg.wait_for_timeout(1200)
    pg.evaluate("sessionStorage.removeItem('hiphi_helper_open')")
    pg.goto(f'{BASE}/track.html?demo=1&abrest=today&t=k7f2q3-a9&ab=onb.today&day=tue&later=1#/'); ready(pg); pg.wait_for_timeout(2500); leave(pg)
    ok({x.get('id') for x in sent} == {pid} and did(sent).get('nextday') == 1, f'Next day carries on the same path, counted once ({did(sent).get("nextday")})')
    ok(not errs, f'no page errors {errs[:2]}'); ctx.close()

    # ================= 2. not recorded, and the older links =================
    for name, url, kw in [('the practice copy on its own', '/track.html?demo=1#/', {}), ('Tests’ See it', '/track.html?demo=1&abrest=today&ab=share.deadline#/bill/HB1780', {}),
                          ('compare.html’s link', '/track.html?demo=1&abrest=today&ab=layout.a#/', {}), ('the privacy signal', '/track.html?demo=1&restart&abrest=today&t=k7f2q3-a9&ab=onb.today', {'gpc': True}),
                          ('an automated browser that has not asked', '/track.html?demo=1&restart&abrest=today&t=k7f2q3-a9&ab=onb.today', {'count': False})]:
        ctx, pg, sent, errs = rig(**kw); pg.goto(BASE + url); ready(pg); pg.wait_for_timeout(2500); leave(pg)
        ok(not sent and 'noted for this test' not in (pg.locator('.band').inner_text() if pg.locator('.band').count() else ''), f'not recorded: {name}')
        ctx.close()
    ctx, pg, sent, errs = rig(); pg.goto(f'{BASE}/track.html?demo=1&restart&ab=onb.p1'); ready(pg); pg.wait_for_timeout(2500); leave(pg)
    ok(sent and sent[0].get('sheet') is None and sent[0].get('versions') == 'onb.p1', f'a link printed before (versions, no &abrest) is recorded, with no group ({sent[0] if sent else None})')
    ctx.close()
    # R-204: an ended link (track.html's ENDED) goes to test-ended.html before the app loads: no way into the tracker, nothing
    # recorded; so does an address already marked &ended. The same versions on a tester sheet's link of today still record.
    for url in ['/track.html?demo=1&restart&ab=onb.today,end.home', '/track.html?demo=1&restart&ab=end.home,onb.today', '/track.html?demo=1&ended=1#/start/1']:
        ctx, pg, sent, errs = rig(); pg.goto(BASE + url)
        try: pg.wait_for_url('**/test-ended.html', timeout=20000)
        except Exception: pass
        pg.wait_for_timeout(2500)
        txt = pg.locator('body').inner_text()
        links = pg.eval_on_selector_all('a', 'as => as.map(a => a.getAttribute("href"))')
        ok(pg.url.endswith('/test-ended.html') and 'This test has ended' in txt, f'ended link {url[11:]}: lands on the page that says the test has ended ({pg.url[len(BASE):]})')
        ok(not links and not pg.locator('#app').count() and 'contact@' not in txt, f'ended link: no link at all, no way into the tracker, no email ({links})')
        ok(not sent, f'ended link: nothing recorded ({len(sent)} sent)')
        ok(not errs, f'ended link: no page errors {errs[:2]}')
        pg.go_back(); pg.wait_for_timeout(1500)
        ok('test-ended' in pg.url or not pg.locator('main').count() or 'ended' in pg.url, f'ended link: Back does not open the tracker ({pg.url[len(BASE):]})')
        if url == '/track.html?demo=1&restart&ab=onb.today,end.home': pg.goto(BASE + url); pg.wait_for_timeout(1500); pg.screenshot(path=os.path.join(OUT, 'test_ended_phone.png'))
        ctx.close()
    ctx, pg, sent, errs = rig(); pg.goto(f'{BASE}/track.html?demo=1&restart&abrest=today&t=k7f2q3-a9&ab=onb.today,end.home'); ready(pg); pg.wait_for_timeout(2500); leave(pg)
    ok(sent and sent[0].get('grp') == 'a9' and 'This test has ended' not in pg.locator('.band').inner_text(), 'the same versions on a tester sheet’s link still record, with no "ended"')
    ctx.close()

    # ================= 3. the tester sheet =================
    for w, h, tag in [(1280, 800, 'laptop'), (390, 844, 'phone')]:
        ctx = br.new_context(viewport={'width': w, 'height': h}, is_mobile=w < 500, has_touch=w < 500)
        pg = ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(f'{BASE}/staff.html?demo=1#/setup/room'); pg.wait_for_selector('.rm-group', timeout=60000); pg.wait_for_timeout(600)
        pg.locator('[data-rmreset]').click(); pg.wait_for_timeout(500)
        u = pg.eval_on_selector_all('[data-rmqr]', 'bs => bs.map(b => b.dataset.url)')
        tags = [re.search(r'[?&]t=([a-z0-9]+)-([a-z0-9]+)', x) for x in u]
        ok(all(tags) and len({t.group(1) for t in tags}) == 1 and len({t.group(2) for t in tags}) == len(u), f'{tag}: each group’s link names the sheet and its own group ({[t.group(0) for t in tags if t]})')
        pg.wait_for_selector('.rm-res .rm-resrow', timeout=20000)
        txt = pg.locator('.rm-res').inner_text()
        ok('What testers did' in txt and 'Group 1' in txt and 'finished the first visit' in txt and 'Earlier tester links' in txt, f'{tag}: what testers did, by group, and the earlier links apart')
        ok('Group 2 · Plan 1' in txt, f'{tag}: a group’s row names its versions')
        pg.locator('[data-rmpaths^="g0"]').first.click(); pg.wait_for_timeout(500)
        sheet = pg.locator('dialog[open]').inner_text()
        ok('First visit: What you care about' in sheet and 'Bill HB 1780' in sheet and 'Testimony: get to know the bill' in sheet and re.search(r'\d+s', sheet), f'{tag}: each tester’s path in plain words, with seconds')
        pg.locator('dialog[open]').screenshot(path=os.path.join(OUT, f'testers_paths_{tag}.png'))
        pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
        pg.locator('.rm-res').screenshot(path=os.path.join(OUT, f'testers_results_{tag}.png'))
        ok(pg.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1"), f'{tag}: nothing wider than the screen')
        # the printed pages tell testers
        pg.evaluate("""() => { window.__printed = null; new MutationObserver((ms, o) => { for (const m of ms) for (const n of m.addedNodes)
          if (n.tagName === 'IFRAME') { n.contentWindow.print = () => { window.__printed = n.contentDocument.documentElement.outerHTML; }; o.disconnect(); } })
          .observe(document.body, { childList: true }); }""")
        pg.locator('[data-stsave]').click(); pg.wait_for_function("() => !!window.__printed", timeout=20000)
        html = pg.evaluate("window.__printed")
        ok(html.count('which screens you visit') >= 2 and 'not your name, and nothing you type' in html, f'{tag}: every group’s printed page tells testers what is noted')
        ok(not errs, f'{tag}: no page errors {errs[:2]}'); ctx.close()
    br.close()
print(f'\n{sum(res)}/{len(res)} passed')
sys.exit(0 if all(res) else 1)
