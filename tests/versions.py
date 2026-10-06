# Picking which versions of each A/B test are live, and the practice copy following the switches (R-192, Nate 10/6:
# "pick that only option A is running, or only option B, or option C, or all of the above, or a combination ... These
# changes should impact how the experience is for public users in the sandbox"; his answers: the real switches, a random
# pick per practice visit).
#   1. Staff v2 > Session setup > Tests in the practice copy (sample switches) on a phone and a laptop: a switch per version
#      on every card and no "Test it on new visitors"; what runs said above them; one off leaves the other for everyone,
#      with Undo; the last one on refuses; a note asks first; the consent warning; the first-visit test's versions; Pick the
#      winner leaves only the winner on; the practice copy's line saying its switches are samples
#   2. The public practice copy follows the switches (every request but the switches' own blocked): one version on shows
#      it; two on gives a random pick per practice visit (both seen over fresh visits); &abrest=today keeps everything a
#      link does not name at today's; a link still wins; an automated browser keeps today's; nothing is sent
#   3. The links that promise a fixed path carry &abrest=today: the tester sheet's, Tests' See it, the compare page's
#   python3 -m http.server 8832   (in this folder, once)
#   python3 tests/versions.py [base]     base defaults to http://localhost:8832
import sys, json, re, os
from playwright.sync_api import sync_playwright
BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832').rstrip('/')
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'tests', 'out'); os.makedirs(OUT, exist_ok=True)
res = []
def ok(c, m): res.append(bool(c)); print('PASS' if c else 'FAIL', m)
def ready(pg): pg.wait_for_function("() => !!document.querySelector('main') && !document.querySelector('.skelpage')", timeout=60000); pg.wait_for_timeout(900)
SKIP = "() => { try { if (localStorage.getItem('hiphi_wiz_demo')) return; localStorage.setItem('hiphi_wiz_demo', JSON.stringify({ done: true, step: 99 })); localStorage.setItem('hiphi_tour_bill_demo', '{\"how\":\"test\"}'); localStorage.setItem('hiphi_tour_home_demo', '{\"how\":\"test\"}'); } catch {} }"
snap = json.load(open(os.path.join(ROOT, 'demo', 'snapshot.json')))
HB1780 = next(b for b in snap['bills'] if b['bill_number'] == 'HB1780')['id']
ROWS = lambda **over: [dict({'key': k, 'arms': a, 'is_on': False, 'fallback': a[0], 'arms_on': None}, **over.get(k, {})) for k, a in
  [('end', ['today', 'home']), ('fv', ['full', 'short']), ('rank', ['today', 'ranked']), ('email', ['finale', 'after']), ('share', ['summary', 'deadline']),
   ('home', ['by-day', 'by-issue']), ('onb', ['today', 'p1', 'p2', 'p3', 'p4', 'p5']), ('join', ['shown', 'watch']), ('save', ['profile', 'alerts']), ('layout', ['today', 'a'])]]

def card(pg, key): return pg.locator('.ab-card', has=pg.locator(f'#ab-h-{key}'))
def live(pg, key): return card(pg, key).locator('legend.ab-live').inner_text()
def flip(pg, key, arm):
    pg.locator(f'label[for="ab-arm-{key}-{arm}"]').click(); pg.wait_for_timeout(700)

with sync_playwright() as p:
    br = p.chromium.launch()
    # ================= 1. the Tests page =================
    for w, h, tag in [(1280, 800, 'laptop'), (390, 844, 'phone')]:
        ctx = br.new_context(viewport={'width': w, 'height': h}, is_mobile=w < 500, has_touch=w < 500)
        pg = ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(f'{BASE}/staff.html?demo=1#/setup/tests'); pg.wait_for_selector('.ab-card', timeout=60000); pg.wait_for_timeout(700)
        n_cards = pg.locator('.ab-card').count()
        n_sw = pg.evaluate("[...document.querySelectorAll('.ab-card')].every(c => c.querySelectorAll('[data-abarm-on]').length >= 2)")
        ok(n_cards >= 9 and n_sw and pg.locator('[data-abon]').count() == 0 and 'Test it on new visitors' not in pg.locator('main').inner_text(), f'{tag}: every card ({n_cards}) has a switch per version, and no “Test it on new visitors”')
        ok('practice copy' in pg.locator('.ab-intro').inner_text().lower() and 'samples' in pg.locator('.ab-intro').inner_text(), f'{tag}: the practice copy says its switches are samples, with the way to the real ones')
        ok(live(pg, 'share').startswith('Running: A against B'), f'{tag}: the share message says what runs ({live(pg, "share")})')
        # one off: the other for everyone, nothing counted; Undo
        flip(pg, 'share', 'deadline')
        t = pg.locator('#toast').inner_text()
        ok(live(pg, 'share').startswith('Not testing: everyone sees A') and 'nothing is counted' in t, f'{tag}: B off leaves A for everyone, said in the toast ({t[:70]})')
        ok('The only one on' in card(pg, 'share').inner_text(), f'{tag}: the version left on says it is the only one')
        flip(pg, 'share', 'summary')
        ok(live(pg, 'share').startswith('Not testing: everyone sees A') and 'At least one version stays on' in pg.locator('#toast').inner_text(), f'{tag}: the last one on refuses to go off')
        pg.locator('#toast button', has_text='Undo').first.click() if pg.locator('#toast button', has_text='Undo').count() else None
        pg.wait_for_timeout(300)
        flip(pg, 'share', 'deadline'); pg.locator('#toast button', has_text='Undo').first.click(); pg.wait_for_timeout(700)
        ok(live(pg, 'share').startswith('Not testing'), f'{tag}: Undo takes back the last change ({live(pg, "share")[:40]})')
        flip(pg, 'share', 'deadline')
        ok(live(pg, 'share').startswith('Running: A against B'), f'{tag}: switched back on, it runs again')
        # B only: A off once B is on
        flip(pg, 'share', 'summary')
        ok(live(pg, 'share').startswith('Not testing: everyone sees B'), f'{tag}: only B: everyone sees B ({live(pg, "share")[:40]})')
        # a note asks first (the email ask waits on a lawyer), and the consent warning shows
        flip(pg, 'email', 'after')
        ok(pg.locator('dialog[open]').count() == 1, f'{tag}: switching on the email ask’s B asks first (its note)')
        pg.locator('dialog[open] button', has_text='Switch on B').click(); pg.wait_for_timeout(800)
        ok(live(pg, 'email').startswith('Running: A against B') and 'lawyer' in card(pg, 'email').inner_text().lower(), f'{tag}: then it runs, with the lawyer warning')
        # the first-visit test: any mix of its six
        flip(pg, 'onb', 'p2')
        if pg.locator('dialog[open]').count(): pg.locator('dialog[open] button', has_text='Switch on C').click(); pg.wait_for_timeout(800)
        flip(pg, 'onb', 'p4')
        if pg.locator('dialog[open]').count(): pg.locator('dialog[open] button', has_text='Switch on E').click(); pg.wait_for_timeout(800)
        ok(live(pg, 'onb').startswith('Running: A, C and E'), f'{tag}: the first visit runs any mix ({live(pg, "onb")[:40]})')
        flip(pg, 'onb', 'today'); flip(pg, 'onb', 'p4')
        ok(live(pg, 'onb').startswith('Not testing: everyone sees C'), f'{tag}: or one plan for everyone ({live(pg, "onb")[:50]})')
        # Pick the winner: only the winner on
        card(pg, 'fv').locator('[data-abpick]').click(); pg.wait_for_timeout(400)
        pg.locator('dialog [data-pv="short"]').click(); pg.wait_for_timeout(800)
        ok(live(pg, 'fv').startswith('Not testing: everyone sees B') and card(pg, 'fv').locator('#ab-arm-fv-short').is_checked() and not card(pg, 'fv').locator('#ab-arm-fv-full').is_checked(), f'{tag}: Pick the winner leaves only the winner on')
        ok(pg.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1"), f'{tag}: nothing wider than the screen')
        pg.locator('#ab-h-share').scroll_into_view_if_needed(); pg.screenshot(path=os.path.join(OUT, f'versions_tests_{tag}.png'))
        ok('running' in pg.locator('main').inner_text(), f'{tag}: the page counts the tests running')
        # See it: the practice copy with every other test at today's
        card(pg, 'share').locator('[data-absee]').click(); pg.wait_for_timeout(400)
        links = pg.eval_on_selector_all('dialog a[href]', 'as => as.map(a => a.getAttribute("href"))')
        ok(links and all('abrest=today' in l for l in links), f'{tag}: See it keeps every other test at today’s ({links[0] if links else None})')
        pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
        # the tester sheet's links
        pg.goto(f'{BASE}/staff.html?demo=1#/setup/room'); pg.wait_for_selector('.rm-group', timeout=60000); pg.wait_for_timeout(600)
        u = pg.eval_on_selector_all('[data-rmqr]', 'bs => bs.map(b => b.dataset.url)')
        ok(u and all('demo=1&restart&abrest=today&ab=' in x for x in u), f'{tag}: the tester sheet’s practice links keep every other test at today’s ({u[0] if u else None})')
        ok(not errs, f'{tag}: no page errors {errs[:2]}'); ctx.close()

    # ================= 2. the public practice copy follows the switches =================
    def practice(rows, q='', path='#/', toss=True, kai=True):
        ctx = br.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True); sent = []; leak = []
        if toss: ctx.add_init_script("window.__hiphiTossTests = true;")
        if kai: ctx.add_init_script(f"({SKIP})()")
        ctx.route(re.compile(r'.*supabase\.co/rest/v1/public_ab_tests.*'), lambda r: r.fulfill(status=200, content_type='application/json', body=json.dumps(rows), headers={'access-control-allow-origin': '*'}))
        ctx.route(re.compile(r'.*supabase\.co/rest/v1/rpc/log_ab.*'), lambda r: (sent.append(r.request.post_data), r.fulfill(status=204, body='', headers={'access-control-allow-origin': '*'})))
        ctx.route(re.compile(r'.*supabase\.co/(?!rest/v1/(rpc/log_ab|public_ab_tests)).*'), lambda r: (leak.append(r.request.url), r.abort()))
        pg = ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(f'{BASE}/track.html?demo=1{q}{path}'); ready(pg)   # a fresh browser each time: a new practice visit
        return ctx, pg, sent, leak, errs
    arms = lambda pg, k: pg.evaluate("async k => { const V = await import('./pub/variant.js'); return V.armOf(k); }", k)
    share = lambda pg: pg.evaluate("""async id => { const c = await import('./pub/core.js'), a = await import('./pub/actions.js');
      const b = c.D.bills.find(x => x.id === id), h = c.D.hearings.find(x => x.bill_id === id && new Date(x.scheduled_at) > Date.now()); return a.shareFor(b, h).text; }""", HB1780)
    # only B of the share message: the practice copy shows B
    ctx, pg, sent, leak, errs = practice(ROWS(share={'fallback': 'deadline', 'arms_on': None}))
    ok(arms(pg, 'share') == 'deadline' and share(pg).startswith('Testimony on'), f'only B on: the practice copy’s share message is B ({share(pg)[:40]}…)')
    ok(arms(pg, 'end') == 'today' and arms(pg, 'layout') == 'today', 'and every test left at A shows A')
    ok(not sent and not leak and not errs, f'nothing counted or sent, no page errors {leak[:1]} {errs[:1]}'); ctx.close()
    # only A
    ctx, pg, sent, leak, errs = practice(ROWS())
    ok(arms(pg, 'share') == 'summary' and share(pg).startswith('Have you seen this?'), 'only A on: the practice copy shows A'); ctx.close()
    # both on: a random pick per practice visit, both seen over fresh visits; kept through the visit
    seen = set()
    for i in range(10):
        ctx, pg, sent, leak, errs = practice(ROWS(share={'is_on': True}))
        a = arms(pg, 'share'); seen.add(a)
        if i == 0:
            pg.reload(); ready(pg); ok(arms(pg, 'share') == a, f'both on: the pick is kept through the practice visit ({a})')
        ctx.close()
        if len(seen) == 2 and i >= 1: break
    ok(seen == {'summary', 'deadline'}, f'both on: fresh practice visits get either, at random ({sorted(seen)})')
    # the six-version test: any mix, and only those
    got = set()
    for i in range(12):
        ctx, pg, sent, leak, errs = practice(ROWS(onb={'is_on': True, 'arms_on': ['p2', 'p4']}), kai=False)
        got.add(arms(pg, 'onb')); ctx.close()
    ok(got <= {'p2', 'p4'} and len(got) == 2, f'the first visit with C and E on: only those, both seen ({sorted(got)})')
    # the week view only: Home is version A in the practice copy
    ctx, pg, sent, leak, errs = practice(ROWS(layout={'fallback': 'a'}))
    ok(arms(pg, 'layout') == 'a', 'only the week view on: the practice copy is on it'); ctx.close()
    # a link: &abrest=today keeps what it does not name at today's; what it names wins
    ctx, pg, sent, leak, errs = practice(ROWS(share={'fallback': 'deadline'}, layout={'fallback': 'a'}), q='&abrest=today&ab=end.home')
    ok(arms(pg, 'share') == 'summary' and arms(pg, 'layout') == 'today' and arms(pg, 'end') == 'home', '&abrest=today: the link’s own version, today’s for the rest, whatever the switches'); ctx.close()
    ctx, pg, sent, leak, errs = practice(ROWS(share={'fallback': 'deadline'}), q='&ab=share.summary')
    ok(arms(pg, 'share') == 'summary', 'a link naming a version still wins over the switches'); ctx.close()
    # an automated browser keeps today's (the other suites stay steady)
    ctx, pg, sent, leak, errs = practice(ROWS(share={'fallback': 'deadline'}), toss=False)
    ok(arms(pg, 'share') == 'summary', 'an automated browser keeps today’s version'); ctx.close()
    # compare.html carries &abrest=today
    ctx = br.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True); pg = ctx.new_page()
    pg.goto(f'{BASE}/compare.html'); pg.locator('[data-layout="a"]').click(); pg.wait_for_url(re.compile(r'track\.html'), timeout=30000)
    ok('abrest=today' in pg.url and 'layout.a' in pg.url, f'compare.html keeps everything else at today’s ({pg.url.split("?")[1][:60]})'); ctx.close()
    br.close()
print(f'\n{sum(res)}/{len(res)} passed')
sys.exit(0 if all(res) else 1)
