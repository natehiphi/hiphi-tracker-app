# pub/visitlog.js, the browser half of counting the first visit (R-023; backend migrations 067-068), in a real browser
# with every Supabase request intercepted: nothing reaches production, and a request to anything but log_first_visit or
# public_partners fails the run. Checks what leaves the browser (and what never does), the visit id, where the person came
# from, the 60-a-visit cap, the keepalive request for leaving, Global Privacy Control, the sandbox, and no network.
#   python3 -m http.server 8832   (in this folder, once)
#   python3 tests/visitlog.py
import json, re, sys
from playwright.sync_api import sync_playwright

BASE = 'http://localhost:8832'
passed = failed = 0
def ok(cond, msg):
    global passed, failed
    print(('PASS ' if cond else 'FAIL ') + msg)
    if cond: passed += 1
    else: failed += 1

def rig(ctx, sent, partners=None, fail_partners=False):
    def rpc(route):
        req = route.request
        body = json.loads(req.post_data or '{}')
        sent.append({'url': req.url, 'headers': req.headers, 'p': body.get('p'), 'method': req.method})
        route.fulfill(status=204, body='', headers={'access-control-allow-origin': '*'})
    ctx.route(re.compile(r'.*supabase\.co/rest/v1/rpc/log_first_visit.*'), rpc)
    def pp(route):
        sent.append({'url': route.request.url, 'partners': True})
        if fail_partners: route.abort(); return
        m = re.search(r'slug=eq\.([a-z0-9-]+)', route.request.url)
        rows = [r for r in (partners or []) if m and r['slug'] == m.group(1)]
        route.fulfill(status=200, content_type='application/json', body=json.dumps(rows[0] if rows and 'vnd.pgrst.object' in (route.request.headers.get('accept') or '') else rows),
                      headers={'access-control-allow-origin': '*'})
    ctx.route(re.compile(r'.*supabase\.co/rest/v1/public_partners.*'), pp)
    # anything else on supabase.co would be a leak: refuse it and note it
    def other(route):
        sent.append({'url': route.request.url, 'leak': True}); route.abort()
    ctx.route(re.compile(r'.*supabase\.co/(?!rest/v1/(rpc/log_first_visit|public_partners)).*'), other)

IMPORT = "async () => { window.VL = await import('/pub/visitlog.js'); return true; }"
with sync_playwright() as pw:
    br = pw.chromium.launch()
    # ---- 1. a partner link from Instagram, on a phone ----
    ctx = br.new_context(viewport={'width': 390, 'height': 844})
    sent = []; logs = []
    rig(ctx, sent, partners=[{'slug': 'kokua-kalihi', 'welcome': 'Welcome, friends of Kokua Kalihi Valley!'}])
    page = ctx.new_page(); page.on('console', lambda m: logs.append((m.type, m.text)))
    page.goto(BASE + '/tests/?via=Kokua-Kalihi&utm_source=Instagram&utm_medium=social&utm_campaign=Fall%202026', referer='https://l.instagram.com/?u=https%3A%2F%2Fexample')
    page.evaluate(IMPORT)
    r1 = page.evaluate("() => VL.logVisit('topics', 'view', { path: 'in', seconds: 0.4 })")
    r2 = page.evaluate("() => VL.logVisit('issues', 'next', { path: 'in', seconds: 40.6, counts: { cats: 2, issues: 3, stances: 99, name: 'Leilani', email: 'yes' }, issue_ids: ['a1', 'b2', 'a1', 5], email: 'someone@example.com', name: 'Leilani' })")
    r3 = page.evaluate("() => VL.logVisit('topics', 'next', { issue_ids: ['a1'], quiz: 'maybe', lesson_step: 12.2, seconds: 99999 })")
    page.wait_for_timeout(800)
    rpc = [s for s in sent if s.get('p')]
    ok(r1 is True and r2 is True and r3 is True, f'logVisit resolves true when sent ({r1}, {r2}, {r3})')
    ok(len(rpc) == 3, f'three events, three requests ({len(rpc)})')
    p0 = rpc[0]['p'] if rpc else {}
    ok(re.match(r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$', p0.get('visit', '')) is not None, 'a random v4 visit id: ' + p0.get('visit', ''))
    ok(all(s['p']['visit'] == p0.get('visit') for s in rpc), 'the same id on every event of the visit')
    ok(p0.get('via') == 'kokua-kalihi' and p0.get('utm_source') == 'instagram' and p0.get('utm_medium') == 'social', 'via and utm words, lower-cased: ' + json.dumps({k: p0.get(k) for k in ('via', 'utm_source', 'utm_medium')}))
    ok('utm_campaign' not in p0, 'a utm word with a space is dropped, not sent')
    ok(p0.get('ref_domain') == 'instagram.com', 'the referring site by name only, l.instagram.com -> instagram.com: ' + str(p0.get('ref_domain')))
    ok(p0.get('device') == 'phone', 'a 390px window is a phone')
    ok(p0.get('seconds') == 0 and p0.get('path') == 'in', 'seconds rounded, path kept')
    p1 = rpc[1]['p'] if len(rpc) > 1 else {}
    ok(set(p1.keys()) <= {'visit', 'step', 'event', 'via', 'utm_source', 'utm_medium', 'ref_domain', 'device', 'path', 'seconds', 'counts', 'issue_ids'}, 'only the allowed keys leave the browser: ' + ','.join(sorted(p1.keys())))
    ok('email' not in p1 and 'name' not in p1 and 'Leilani' not in json.dumps(p1) and 'someone@' not in json.dumps(p1), 'never an email or a name, even when a caller passes one')
    ok(p1.get('counts') == {'cats': 2, 'issues': 3}, 'counts: known keys only, a number out of range dropped: ' + json.dumps(p1.get('counts')))
    ok(p1.get('issue_ids') == ['a1', 'b2'] and p1.get('seconds') == 41, 'issue ids once each, strings only; seconds rounded')
    p2 = rpc[2]['p'] if len(rpc) > 2 else {}
    ok('issue_ids' not in p2 and 'quiz' not in p2 and 'lesson_step' not in p2 and p2.get('seconds') == 3600, 'issue ids only with the issue screen\'s Next; a bad answer and a lesson step of 12 dropped; seconds held to an hour')
    ok(all('authorization' not in {k.lower() for k in s['headers']} or s['headers'].get('authorization', '').startswith('Bearer ') for s in rpc), 'no account is attached beyond what supabase-js sends')
    ok(page.evaluate("() => VL.visitVia()") == 'kokua-kalihi', 'visitVia() gives the slug')
    # ---- leaving: a keepalive request straight to the endpoint ----
    n0 = len(rpc)
    page.evaluate("() => VL.logVisit('stand', 'leave', { seconds: 5 })")
    page.wait_for_timeout(500)
    rpc = [s for s in sent if s.get('p')]
    lv = rpc[-1] if len(rpc) > n0 else {}
    ok(lv.get('p', {}).get('event') == 'leave' and lv.get('url', '').endswith('/rest/v1/rpc/log_first_visit') and lv.get('headers', {}).get('apikey', '').startswith('sb_publishable_'),
       'leave goes as its own request with the public key only')
    ok('authorization' not in {k.lower() for k in lv.get('headers', {})}, 'and no account')
    # ---- the same visit after a reload; a new tab is a new visit ----
    vid = p0.get('visit')
    page.reload(); page.evaluate(IMPORT)
    page.evaluate("() => VL.logVisit('stand', 'view')"); page.wait_for_timeout(400)
    rpc = [s for s in sent if s.get('p')]
    ok(rpc[-1]['p']['visit'] == vid and rpc[-1]['p'].get('via') == 'kokua-kalihi', 'a reload keeps the visit and where it came from')
    p2page = ctx.new_page(); p2page.goto(BASE + '/tests/'); p2page.evaluate(IMPORT)
    p2page.evaluate("() => VL.logVisit('topics', 'view')"); p2page.wait_for_timeout(400)
    rpc = [s for s in sent if s.get('p')]
    ok(rpc[-1]['p']['visit'] != vid and 'via' not in rpc[-1]['p'] and 'ref_domain' not in rpc[-1]['p'], 'a new tab is a new visit, with nothing carried over')
    # ---- the cap: 60 a visit ----
    before = len([s for s in rpc if s['p']['visit'] == vid])
    res = page.evaluate("async () => { const r = []; for (let k = 0; k < 70; k++) r.push(await VL.logVisit('session', 'next', { lesson_step: k % 10 })); return r.filter(Boolean).length; }")
    page.wait_for_timeout(1200)
    mine = len([s for s in sent if s.get('p') and s['p']['visit'] == vid])
    ok(mine == 60, f'a visit sends 60 events at most ({before} before, {res} of 70 more sent, {mine} in all)')
    # ---- a wrong step name is a programming error: warned, never sent ----
    k0 = len(sent)
    bad = p2page.evaluate("() => VL.logVisit('tour', 'view')"); p2page.wait_for_timeout(200)
    ok(bad is False and len(sent) == k0, 'an unknown step is not sent')
    # ---- partners ----
    w1 = page.evaluate("() => VL.partnerWelcome('kokua-kalihi')"); w2 = page.evaluate("() => VL.partnerWelcome('kokua-kalihi')")
    asked = len([s for s in sent if s.get('partners')])
    ok(w1 == 'Welcome, friends of Kokua Kalihi Valley!' and w2 == w1 and asked == 1, f'partnerWelcome reads public_partners once per slug ({asked} request): {w1}')
    ok(page.evaluate("() => VL.partnerWelcome('nobody-here')") is None, 'an unknown partner: null')
    ok(page.evaluate("() => VL.partnerWelcome('Bad Slug!')") is None and len([s for s in sent if s.get('partners')]) == 2, 'a bad slug: null, without asking')
    ok(not [s for s in sent if s.get('leak')], 'no other request reached Supabase: ' + json.dumps([s['url'] for s in sent if s.get('leak')]))
    ok(not [l for l in logs if l[0] == 'error'], 'no console errors: ' + json.dumps([l for l in logs if l[0] == 'error'])[:300])
    ctx.close()

    # ---- 2. Global Privacy Control: nothing at all ----
    ctx = br.new_context(viewport={'width': 1440, 'height': 900})
    ctx.add_init_script("Object.defineProperty(navigator, 'globalPrivacyControl', { get: () => true })")
    sent = []; rig(ctx, sent)
    page = ctx.new_page(); page.goto(BASE + '/tests/?via=kokua-kalihi'); page.evaluate(IMPORT)
    r = page.evaluate("() => VL.logVisit('topics', 'view', { path: 'in' })"); page.wait_for_timeout(400)
    stored = page.evaluate("() => sessionStorage.getItem('hiphi_fv')")
    ok(r is False and not [s for s in sent if s.get('p')] and stored is None, 'with Global Privacy Control nothing is sent and nothing is kept')
    ok(page.evaluate("() => VL.visitVia()") == 'kokua-kalihi', 'but the welcome line still knows the partner (visitVia reads the address)')
    ctx.close()

    # ---- 3. the sandbox: nothing sent; the payload printed only with debug ----
    for url, want in ((BASE + '/tests/?demo=1&via=kokua-kalihi&debug', True), (BASE + '/tests/?demo=1', False)):
        ctx = br.new_context(viewport={'width': 1440, 'height': 900}); sent = []; logs = []; rig(ctx, sent)
        page = ctx.new_page(); page.on('console', lambda m: logs.append((m.type, m.text))); page.goto(url, referer=BASE + '/track.html'); page.evaluate(IMPORT)
        r = page.evaluate("() => VL.logVisit('topics', 'view', { path: 'in' })"); page.wait_for_timeout(300)
        dbg = [l for l in logs if l[0] == 'debug' and 'first visit' in l[1]]
        ok(r is False and not [s for s in sent if s.get('p')] and (bool(dbg) == want), f'sandbox{" with debug" if want else ""}: nothing sent, payload printed: {bool(dbg)}')
        if want: ok(page.evaluate("() => VL.partnerWelcome('kokua-kalihi')") == 'Welcome, friends of Kokua Kalihi!' and not [s for s in sent if s.get('partners')], 'sandbox welcome line is a made-up sample, no request')
        if want: ok('ref_domain' not in (dbg[0][1] if dbg else ''), 'the page\'s own site is not a referrer')
        ctx.close()

    # ---- 4. no network at all: never throws, never retries ----
    ctx = br.new_context(viewport={'width': 800, 'height': 900}); sent = []
    ctx.route(re.compile(r'.*(supabase\.co|jsdelivr\.net/npm/@supabase).*'), lambda route: (sent.append(route.request.url), route.abort()))
    page = ctx.new_page(); errs = []; page.on('pageerror', lambda e: errs.append(str(e))); page.goto(BASE + '/tests/'); page.evaluate(IMPORT)
    r = page.evaluate("() => VL.logVisit('topics', 'view')"); page.wait_for_timeout(1500)
    w = page.evaluate("() => VL.partnerWelcome('kokua-kalihi')")
    dev = page.evaluate("() => JSON.parse(sessionStorage.getItem('hiphi_fv')).src.device")
    ok(r is False and w is None and not errs, f'offline: false and null, no error thrown ({len(sent)} attempts, no retry loop)')
    ok(len([u for u in sent if 'rpc/log_first_visit' in u]) <= 1, 'one attempt at most for the event')
    ok(dev == 'tablet', 'an 800px window is a tablet')
    ctx.close()
    br.close()
print(f'\n{passed} passed, {failed} failed')
sys.exit(1 if failed else 0)
