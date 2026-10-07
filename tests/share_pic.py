# The share picture test in the browser (R-183; backend migration 155; pub/variant.js 'pic', pub/sharepic.js), on a plain page
# with every database request intercepted: nothing reaches production, and a request to anything but public_ab_tests or log_ab
# fails the run.
#   1. a share picks among the versions that are on AND have a page for that ask (share-fit.json): spread evenly over them,
#      never one that has no page, today's picture when nothing fits, the test is off, or the manifest has not come
#   2. the address it shares: p/<version>/<the page's path>, today's carrying &pic=today, the query kept
#   3. what is counted: the share (the version and the ask, once per bill and version), the friend's arrival from &pic=, the
#      friend's action within 14 days; a tester's link counts apart
#   python3 -m http.server 8832   (in this folder, once)
#   python3 tests/share_pic.py [base]     base defaults to http://localhost:8832
import sys, json, re, collections
from playwright.sync_api import sync_playwright
BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832').rstrip('/')
res = []
def ok(c, m): res.append(bool(c)); print('PASS' if c else 'FAIL', m)
ARMS = ['today', 'issue', 'sign', 'calendar', 'letter', 'text', 'neighbors', 'islands', 'before', 'here', 'ticket', 'crowd', 'stand', 'postcard']
def rows(on=True, arms_on=('today', 'issue', 'letter')):
    return [{'key': 'pic', 'arms': ARMS, 'is_on': on, 'fallback': 'today', 'arms_on': list(arms_on)}]
FIT = {'b/2026/HB1573-testify': 'issue,letter,calendar,sign', 'b/2026/HB1573-follow': 'issue,stand', 'i/fda-proof-to-sell-e-cigarettes': 'stand', 'b/2026/HB9-testify': 'sign'}

with sync_playwright() as p:
    br = p.chromium.launch()
    def rig(rows_, fit=FIT, query='', hash_=''):
        ctx = br.new_context(); sent = []; leak = []
        ctx.add_init_script("window.__hiphiTossTests = true; window.__hiphiCountTests = true;")
        ctx.route(re.compile(r'.*supabase\.co/rest/v1/public_ab_tests.*'), lambda r: r.fulfill(status=200, content_type='application/json', body=json.dumps(rows_), headers={'access-control-allow-origin': '*'}))
        def log(r):
            sent.extend(json.loads(r.request.post_data or '{}').get('p', {}).get('e', [])); r.fulfill(status=204, body='', headers={'access-control-allow-origin': '*', 'access-control-allow-headers': '*'})
        ctx.route(re.compile(r'.*supabase\.co/rest/v1/rpc/log_ab.*'), log)
        ctx.route(re.compile(r'.*supabase\.co/(?!rest/v1/(rpc/log_ab|public_ab_tests)).*'), lambda r: (leak.append(r.request.url), r.abort()))
        ctx.route(re.compile(r'.*/share-fit\.json.*'), lambda r: r.fulfill(status=200 if fit is not None else 404, content_type='application/json', body=json.dumps(fit or {}), headers={'access-control-allow-origin': '*'}))
        # A blank page at the site's root (the address the tracker builds share links from), so nothing else loads.
        ctx.route(re.compile(r'.*/blank\.html.*'), lambda r: r.fulfill(status=200, content_type='text/html', body='<!doctype html><title>blank</title>'))
        pg = ctx.new_page(); pg.goto(f'{BASE}/blank.html{query}{hash_}')
        pg.evaluate("async () => { await import('/pub/visitlog.js'); window.V = await import('/pub/variant.js'); window.P = await import('/pub/sharepic.js'); await V.abReady; P.loadFit(); await new Promise(r => setTimeout(r, 400)); }")
        return ctx, pg, sent, leak

    # ---- 1. the pick ----
    ctx, pg, sent, leak = rig(rows())
    picks = pg.evaluate("""() => { const out = {}; for (const key of ['issue,letter,calendar,sign', 'issue,stand', 'sign', '']) { const n = {};
        for (let i = 0; i < 300; i++) { localStorage.clear(); const s = { v: 1, arms: {}, forced: {}, u: { pic: Math.random() } }; localStorage.setItem('hiphi_ab', JSON.stringify(s));
          const r = V.picArm(key ? key.split(',') : []); const a = r ? r.arm : 'none'; n[a] = (n[a] || 0) + 1; } out[key || '(no page)'] = n; } return out; }""")
    a = picks['issue,letter,calendar,sign']
    ok(set(a) == {'today', 'issue', 'letter'} and all(70 <= v <= 130 for v in a.values()), f'on: today, issue, letter; fits: issue, letter, calendar, sign -> an even three-way spread, never the calendar or sign (switched off) {a}')
    ok(set(picks['issue,stand']) == {'today', 'issue'} and all(110 <= v <= 190 for v in picks['issue,stand'].values()), f'a page with only the issue version fitting: today or the issue, evenly {picks["issue,stand"]}')
    ok(picks['sign'] == {'none': 300} and picks['(no page)'] == {'none': 300}, 'a page where no version that is on fits, or with no versions: today’s picture, nothing counted')
    ctx.close()
    ctx, pg, sent, leak = rig(rows(on=False))
    ok(pg.evaluate("() => { localStorage.clear(); return V.picArm(['issue', 'letter']); }") is None, 'the test off: today’s picture')
    ctx.close()
    ctx, pg, sent, leak = rig(rows(arms_on=('today',)))
    ok(pg.evaluate("() => V.picArm(['issue', 'letter'])") is None, 'one version alone is nothing to compare: today’s')
    ctx.close()

    # ---- 2. the address ----
    ctx, pg, sent, leak = rig(rows(arms_on=('issue', 'letter')))
    url = f'{BASE}/b/2026/HB1573-testify'
    got = pg.evaluate("""(u) => { const out = {}; for (const f of [0.1, 0.9]) { localStorage.clear(); localStorage.setItem('hiphi_ab', JSON.stringify({ v: 1, arms: {}, forced: {}, u: { pic: f } })); out[f] = P.picShare(u + '?via=share-deadline', 'testify', 'bill1'); } return out; }""", url)
    ok(got['0.1']['url'] == f'{BASE}/p/issue/b/2026/HB1573-testify?via=share-deadline' and got['0.9']['url'] == f'{BASE}/p/letter/b/2026/HB1573-testify?via=share-deadline', f'a share goes to p/<version>/<same page>, its query kept: {got["0.1"]["url"]}')
    ok(got['0.1']['pic'] == {'bill': 'bill1', 'ask': 'testify', 'arm': 'issue'}, f'and says what to count: {got["0.1"]["pic"]}')
    ctx.close()
    ctx, pg, sent, leak = rig(rows(arms_on=('today', 'issue')))
    got = pg.evaluate("(u) => { localStorage.clear(); localStorage.setItem('hiphi_ab', JSON.stringify({ v: 1, arms: {}, forced: {}, u: { pic: 0.1 } })); return P.picShare(u, 'testify', 'bill1'); }", url)
    ok(got['url'] == f'{BASE}/b/2026/HB1573-testify?pic=today' and got['pic']['arm'] == 'today', f'today’s picture keeps today’s page and says so in the link: {got["url"]}')
    nf = pg.evaluate("(u) => P.picShare(u + 'x', 'testify', 'b')", url)
    ok(nf['url'] == url + 'x' and nf['pic'] is None, 'a page the manifest does not list: the link as it was')
    ctx.close()
    ctx, pg, sent, leak = rig(rows(arms_on=('issue', 'letter')), fit=None)
    ok(pg.evaluate("(u) => P.picShare(u, 'testify', 'b').pic", url) is None, 'no manifest (it failed to load): today’s picture, nothing counted')
    ctx.close()

    # ---- 3. what is counted ----
    ctx, pg, sent, leak = rig(rows(arms_on=('today', 'issue', 'letter')))
    pg.evaluate("""() => { localStorage.clear(); localStorage.setItem('hiphi_ab', JSON.stringify({ v: 1, arms: {}, forced: {}, u: { pic: 0.9 } }));
      const s = P.picShare('%s/b/2026/HB1573-testify', 'testify', 'bill1'); P.picSeen(s.pic); P.picSeen(s.pic);
      const t = P.picShare('%s/b/2026/HB1573-follow', 'follow', 'bill1'); P.picSeen(t.pic); }""" % (BASE, BASE))
    pg.wait_for_timeout(1900)
    seen = [e for e in sent if e['t'] == 'pic' and e['k'] == 'seen']
    ok(sorted((e['a'], e['x']) for e in seen) == [('issue', 'follow'), ('letter', 'testify')], f'a share counts for its version and its ask, once per bill: {[(e["a"], e["x"]) for e in seen]}')
    ok(all(e['f'] is False for e in seen), 'not forced')
    ok(not leak, 'nothing else reached the database: ' + '; '.join(leak[:2]))
    ctx.close()
    # a tester's link: the version it names, counted apart
    ctx, pg, sent, leak = rig(rows(arms_on=('issue', 'letter')), query='?ab=pic.calendar')
    r = pg.evaluate("""(u) => { const s = P.picShare(u, 'testify', 'billT'); P.picSeen(s.pic); return s; }""", url)
    pg.wait_for_timeout(1900)
    ok(r['url'] == f'{BASE}/p/calendar/b/2026/HB1573-testify' and [(e['a'], e['f']) for e in sent if e['k'] == 'seen'] == [('calendar', True)], 'a tester’s link names the version (even one that is switched off) and is counted apart')
    r = pg.evaluate("(u) => P.picShare(u, 'follow', 'billT').pic", f'{BASE}/b/2026/HB9-testify')
    ok(r is None, 'a tester’s version that has no page for this ask: today’s, not counted')
    ctx.close()
    # the friend: arrival, then an action
    ctx, pg, sent, leak = rig(rows(arms_on=('issue', 'letter')), query='?via=share&pic=letter', hash_='#/bill/2026/HB1573/testify')
    pg.wait_for_timeout(1900)
    ok([(e['t'], e['a'], e['k'], e['x']) for e in sent if e['t'] == 'pic'] == [('pic', 'letter', 'goal', 'testify')], f'a friend arriving by a letter-picture link: counted once for it, for the ask the link opened: {[e for e in sent if e["t"] == "pic"]}')
    pg.evaluate("() => { V.abEvent('acted'); V.abEvent('acted'); }"); pg.wait_for_timeout(1900)
    ok([e['k'] for e in sent if e['t'] == 'pic'] == ['goal', 'goal2'] and sent[-1]['x'] == 'testify', 'their first action counts once, for the same version and ask')
    pg.goto(f'{BASE}/blank.html?pic=issue#/issue/fda'); pg.evaluate("async () => { await import('/pub/visitlog.js'); window.V = await import('/pub/variant.js'); await V.abReady; }"); pg.wait_for_timeout(1900)
    ok(len([e for e in sent if e['t'] == 'pic' and e['k'] == 'goal']) == 1, 'a second link on the same browser is not another arrival')
    ctx.close()
    ctx, pg, sent, leak = rig(rows(), query='?pic=nonsense&via=share')
    pg.wait_for_timeout(1500)
    ok(not [e for e in sent if e['t'] == 'pic'], 'a made-up version in a link is ignored')
    ctx.close()
    br.close()
print(f'\n{sum(res)}/{len(res)} passed'); sys.exit(0 if all(res) else 1)
