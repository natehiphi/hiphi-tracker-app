# The public page's own error reports (R-111; pub/errlog.js, track.html's early catcher, backend migration 110). Every
# call to log_public_error is intercepted, so nothing reaches the database. Checks: a thrown error is reported once with
# the screen, the message, the file and the device; the same error again is not sent twice; a rejected promise is
# reported and a dropped connection is not; at most five reports a page load; a bill page names the bill and a shared
# list's link is never sent; nothing is sent with the privacy signal; the early catcher reports a page whose code never
# starts; the two addresses in track.html match pub/core.js's.
#   python3 tests/errlog.py [base]     base defaults to http://localhost:8832/track.html?demo=1
import sys, re, os, json
from playwright.sync_api import sync_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832/track.html?demo=1'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
res = []
def ok(c, m): res.append(bool(c)); print('PASS' if c else 'FAIL', m)
def ready(pg):
    pg.wait_for_function("() => !!document.querySelector('main') && !document.querySelector('.skelpage')", timeout=60000); pg.wait_for_timeout(500)
SKIP = "() => { try { const w = JSON.parse(localStorage.getItem('hiphi_wiz') || '{}'); localStorage.setItem('hiphi_wiz', JSON.stringify({ ...w, done: true, step: 99 })); localStorage.setItem('hiphi_tour_bill', '{\"how\":\"test\"}'); localStorage.setItem('hiphi_tour_home', '{\"how\":\"test\"}'); } catch {} }"
# A script of its own, served from the test machine, throws the error: an inline script has no file name, a real one does.
BOOMS = {}
def boom(pg, msg):
    BOOMS[len(BOOMS)] = msg
    pg.add_script_tag(url=f'/tests/boom-{len(BOOMS) - 1}.js')
    pg.wait_for_timeout(300)
def serve_boom(route):
    i = int(re.search(r'boom-(\d+)\.js', route.request.url).group(1))
    route.fulfill(status=200, content_type='text/javascript', body=f"setTimeout(() => {{ throw new Error('{BOOMS[i]}'); }}, 0)")
with sync_playwright() as p:
    br = p.chromium.launch()
    def context(gpc=False):
        ctx = br.new_context(viewport={'width': 1280, 'height': 900})
        ctx.add_init_script("window.__hiphiCountTests = true;")   # a test run reports nothing unless asked (visitlog.js)
        if gpc: ctx.add_init_script("Object.defineProperty(navigator, 'globalPrivacyControl', { value: true });")
        sent = []
        def rpc(route):
            try: sent.append((json.loads(route.request.post_data or '{}')).get('p') or {})
            except Exception: sent.append({'bad': True})
            route.fulfill(status=204, body='', headers={'access-control-allow-origin': '*'})
        ctx.route(re.compile(r'.*supabase\.co/rest/v1/rpc/log_public_error.*'), rpc)
        ctx.route(re.compile(r'.*/tests/boom-\d+\.js'), serve_boom)
        return ctx, sent
    # 1. a thrown error on Home: one report, with the screen, the message, the file and the device
    ctx, sent = context(); pg = ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(BASE + '#/'); ready(pg); pg.evaluate(SKIP); pg.goto(BASE + '#/'); pg.reload(); ready(pg)
    ok(pg.evaluate("() => !!window.__hiphiErrs && window.__hiphiErrs.handled === true && window.__hiphiErrs.booted === true"), 'a normal start: the early catcher is handed over and the app marked as booted')
    boom(pg, 'errlog test boom'); pg.wait_for_timeout(1200)
    r = sent[0] if sent else {}
    ok(len(sent) == 1, f'one report sent ({len(sent)})')
    ok(r.get('kind') == 'error' and 'errlog test boom' in r.get('message', ''), f'kind and message: {r.get("kind")} / {r.get("message")}')
    ok(r.get('place') == 'home', f'the place is the screen: {r.get("place")}')
    ok(r.get('device') == 'laptop' and r.get('sandbox') is True, f'device and sandbox: {r.get("device")} {r.get("sandbox")}')
    ok(re.match(r'^/tests/boom-0\.js:\d+:\d+$', r.get('source', '')) is not None, f'the source is the file and line, without the origin: {r.get("source")}')
    ok(set(r) <= {'kind', 'place', 'message', 'source', 'device', 'sandbox'}, f'nothing else is sent: {sorted(r)}')
    # 2. the same error again is not sent twice
    boom(pg, 'errlog test boom'); pg.wait_for_timeout(800)
    ok(len(sent) == 1, 'the same error is reported once')
    # 3. a rejected promise is reported; a dropped connection is not
    pg.evaluate("() => { Promise.reject(new Error('errlog rejection test')); }"); pg.wait_for_timeout(800)
    ok(len(sent) == 2 and sent[-1].get('kind') == 'rejection' and 'errlog rejection test' in sent[-1].get('message', ''), f'a rejected promise is reported: {sent[-1] if len(sent) > 1 else None}')
    pg.evaluate("() => { Promise.reject(new TypeError('Failed to fetch')); }"); pg.wait_for_timeout(800)
    ok(len(sent) == 2, 'a dropped connection is not reported (the page already says so)')
    pg.evaluate("async () => { const m = await import('./pub/errlog.js'); m.reportError('boot', new Error('timeout')); m.reportError('boot', new TypeError('Failed to fetch')); m.reportError('boot', new ReferenceError('errlog boot test')); }"); pg.wait_for_timeout(800)
    ok(len(sent) == 3 and sent[-1].get('kind') == 'boot' and 'errlog boot test' in sent[-1].get('message', ''), f'a start that fails on the code is reported, one that fails on the connection is not ({len(sent)})')
    # 4. at most five reports a page load
    for i in range(6): boom(pg, f'errlog cap {i}')
    pg.wait_for_timeout(1500)
    ok(len(sent) == 5, f'at most five reports a page load ({len(sent)})')
    ctx.close()
    # 5. a bill page names the bill; a shared list's link is never sent; a year-qualified bill keeps its year
    ctx, sent = context(); pg = ctx.new_page()
    pg.goto(BASE + '#/'); ready(pg); pg.evaluate(SKIP)
    for h, place in [('#/bill/HB1075?from=x', 'bill/HB1075'), ('#/l/abcdef0123456789', 'l'), ('#/bill/2026/HB1075', 'bill/2026/HB1075'), ('#/find?q=secret', 'find'), ('#/legislators?from=HB1075', 'legislators')]:
        pg.goto(BASE + h); pg.wait_for_timeout(400)
        boom(pg, f'errlog place {place}'); pg.wait_for_timeout(600)
    places = [x.get('place') for x in sent]
    ok(places == ['bill/HB1075', 'l', 'bill/2026/HB1075', 'find', 'legislators'], f'places: {places}')
    ok(not any('abcdef0123456789' in json.dumps(x) or 'secret' in json.dumps(x) for x in sent), 'a list link and a search never leave the browser')
    ctx.close()
    # 6. the privacy signal: nothing is sent
    ctx, sent = context(gpc=True); pg = ctx.new_page()
    pg.goto(BASE + '#/'); ready(pg); boom(pg, 'errlog gpc'); pg.wait_for_timeout(1000)
    ok(len(sent) == 0, 'nothing is sent with the privacy signal')
    ctx.close()
    # 7. the early catcher: the app's code never starts (pub/app.js blocked), so track.html reports it after 20 seconds
    ctx, sent = context(); pg = ctx.new_page()
    pg.route(re.compile(r'.*/pub/app\.js.*'), lambda route: route.abort())
    pg.goto(BASE); pg.wait_for_timeout(22000)
    ok(len(sent) == 1 and sent[0].get('kind') == 'boot' and 'did not start' in sent[0].get('message', '') and sent[0].get('sandbox') is True, f'a page whose code never starts is reported once, as a boot error: {sent}')
    ctx.close()
    # 8. the early catcher uses the same address and key as the app
    core = open(os.path.join(ROOT, 'pub', 'core.js'), encoding='utf-8').read(); html = open(os.path.join(ROOT, 'track.html'), encoding='utf-8').read()
    url = re.search(r"SUPABASE_URL\s*=\s*'([^']+)'", core).group(1); key = re.search(r"SUPABASE_KEY\s*=\s*'([^']+)'", core).group(1)
    ok(url + '/rest/v1/rpc/log_public_error' in html and html.count(key) >= 2, "track.html's early catcher uses the same address and key as pub/core.js")
    # 9. the privacy page says so
    ctx, sent = context(); pg = ctx.new_page(); pg.goto(BASE + '#/privacy'); ready(pg)
    t = pg.locator('main').inner_text()
    ok('If the page breaks' in t and 'never includes who you are' in t, 'the privacy page says what is reported and what never is')
    ctx.close()
    br.close()
print(f'{sum(res)}/{len(res)} passed'); sys.exit(0 if all(res) else 1)
