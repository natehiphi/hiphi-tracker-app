# Picking which versions of each A/B test are live, and the practice copy following the switches (R-192, Nate 10/6:
# "pick that only option A is running, or only option B, or option C, or all of the above, or a combination ... These
# changes should impact how the experience is for public users in the sandbox"; his answers: the real switches, a random
# pick per practice visit).
#   1. Staff v2 > Session setup > Tests in the practice copy (sample switches) on a phone and a laptop: the list, one line per
#      test grouped by place, its filter; each test's own page with its versions side by side as pictures (R-201); a switch
#      per version on every test and no "Test it on new visitors"; what runs said above them; one off leaves the other for everyone,
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
   ('home', ['by-day', 'by-issue']), ('onb', ['today', 'p1', 'p2', 'p3', 'p4', 'p5']), ('join', ['shown', 'watch']), ('save', ['profile', 'alerts']), ('layout', ['calm', 'today', 'a'])]]

def card(pg, key): return pg.locator(f'.ab-card[data-abtest="{key}"]')
def live(pg, key): return card(pg, key).locator('legend.ab-live').inner_text()
def flip(pg, key, arm):
    pg.locator(f'label[for="ab-arm-{key}-{arm}"]').click(); pg.wait_for_timeout(700)

with sync_playwright() as p:
    br = p.chromium.launch()
    # ================= 1. the Tests page =================
    # R-201 (Nate 10/7): the page is a short list, one line per test, grouped by where it shows; each test opens on its own
    # page (#/setup/test?t=<key>) with its versions side by side as pictures, each with its name, switch, numbers and buttons.
    for w, h, tag in [(1280, 800, 'laptop'), (390, 844, 'phone')]:
        ctx = br.new_context(viewport={'width': w, 'height': h}, is_mobile=w < 500, has_touch=w < 500)
        pg = ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(f'{BASE}/staff.html?demo=1#/setup/tests'); pg.wait_for_selector('.ab-row', timeout=60000); pg.wait_for_timeout(700)
        keys = pg.eval_on_selector_all('.ab-row', 'rs => rs.map(r => r.dataset.abrow)')
        groups = pg.eval_on_selector_all('.ab-gt', 'hs => hs.map(h => h.textContent)')
        ok(len(keys) >= 9 and len(set(keys)) == len(keys) and groups[:2] == ['The first visit', 'Home'] and 'Test it on new visitors' not in pg.locator('main').inner_text(),
           f'{tag}: the list has one line per test ({len(keys)}), grouped by place ({groups})')
        ok(pg.evaluate("[...document.querySelectorAll('.ab-row')].every(r => r.querySelector('.ab-thumb img') && r.querySelector('.chip') && r.getAttribute('href').startsWith('#/setup/test?t='))"),
           f'{tag}: every line has a small picture, its state in a word and opens its own page')
        ok('practice copy' in pg.locator('.ab-intro').inner_text().lower() and 'samples' in pg.locator('.ab-intro').inner_text(), f'{tag}: the practice copy says its switches are samples, with the way to the real ones')
        ok('running' in pg.locator('main').inner_text().lower(), f'{tag}: the page counts the tests running')
        # The filter: Running shows only the tests on; All brings back every line, in the same order
        pg.locator('[data-seg="abf"][data-val="running"]').click(); pg.wait_for_timeout(300)
        run = pg.eval_on_selector_all('.ab-row', 'rs => rs.map(r => r.dataset.abrow)')
        ok(0 < len(run) < len(keys) and all(k in keys for k in run), f'{tag}: Running shows only the tests on ({run})')
        pg.locator('[data-seg="abf"][data-val="all"]').click(); pg.wait_for_timeout(300)
        ok(pg.eval_on_selector_all('.ab-row', 'rs => rs.map(r => r.dataset.abrow)') == keys, f'{tag}: All brings every line back, in the same order')
        ok(pg.evaluate(f"document.documentElement.scrollWidth <= {w} + 1"), f'{tag}: the list is no wider than the screen')
        pg.screenshot(path=os.path.join(OUT, f'versions_list_{tag}.png'))

        def go(key):
            pg.evaluate(f"location.hash = '#/setup/test?t={key}'"); pg.wait_for_selector(f'.ab-card[data-abtest="{key}"]', timeout=30000); pg.wait_for_timeout(500)
        # Every test's page: today's first, a picture per version, a switch, a Try it link into the practice copy, the
        # rows lined up across the versions, nothing wider than the screen
        bad = []
        for k in keys:
            go(k)
            c = card(pg, k)
            n_sw = c.locator('[data-abarm-on]').count(); n_try = c.locator('a[target="_blank"][href*="track.html"]').count()
            n_pick = c.locator('[data-abpick]').count(); why = c.locator('.ab-why').count()
            first = c.locator('.ab-ver').first.inner_text()
            rows = pg.evaluate("[...document.querySelectorAll('.ab-ver')].map(v => [...v.children].map(c => Math.round(c.getBoundingClientRect().top)))")
            level = len({len(r) for r in rows}) == 1 and all(len({r[i] for r in rows}) == 1 for i in range(len(rows[0])))
            if n_sw < 2: bad.append(f'{k}: {n_sw} switches')
            if n_try != n_sw: bad.append(f'{k}: {n_try} Try it for {n_sw} versions')
            if not (why and n_pick == 0) and not (not why and n_pick == n_sw): bad.append(f'{k}: {n_pick} Pick, why={why}')
            if not first.startswith('Today’s'): bad.append(f'{k}: today’s is not first ({first[:30]!r})')
            if c.locator('.ab-shot img').count() < n_sw: bad.append(f'{k}: {c.locator(".ab-shot img").count()} pictures for {n_sw} versions')
            if not level: bad.append(f'{k}: the versions do not line up {rows}')
            if pg.evaluate(f"document.documentElement.scrollWidth > {w} + 1"): bad.append(f'{k}: wider than the screen')
            if re.search(r'version [A-Z]\b|\bB: ', c.inner_text()): bad.append(f'{k}: a version letter in the words')
        ok(not bad, f'{tag}: every test page has today’s first, a picture, switch and Try it per version, Pick or the words why, lined up, no letters {bad[:3]}')
        # Picks (fresh-eyes review, 10/10): no Pick on a test nobody has met, none on the email ask held for the lawyer
        whyof = lambda k: card(pg, k).locator('.ab-why').inner_text() if card(pg, k).locator('.ab-why').count() else ''
        go('join'); ok(card(pg, 'join').locator('[data-abpick]').count() == 0 and 'Pick once people have seen it' in whyof('join'), f'{tag}: the sign-up test nobody has met offers no Pick ({whyof("join")!r})')
        go('email'); ok(card(pg, 'email').locator('[data-abpick]').count() == 0 and re.search(r'Waits for the lawyer.s check', whyof('email')) is not None, f'{tag}: the email ask, held for the lawyer, has no Pick and says why ({whyof("email")!r})')
        # Trust it: the end test's Home version does better (52% against 41%, 640 each)
        go('end'); better = card(pg, 'end').locator('.ab-ver', has=pg.locator('.chip', has_text='Does better')).inner_text()
        ok('Ends on Home' in better, f'{tag}: the version that does better says so ({better[:40]!r})')
        # The switches
        go('share')
        ok(live(pg, 'share').startswith('Running: today’s against “'), f'{tag}: the share message says what runs ({live(pg, "share")[:60]})')
        flip(pg, 'share', 'deadline')
        t = pg.locator('#toast').inner_text()
        ok(live(pg, 'share').startswith('Not testing: everyone sees today’s') and 'nothing is counted' in t, f'{tag}: the other off leaves today’s for everyone, said in the toast ({t[:70]})')
        flip(pg, 'share', 'summary')
        ok(live(pg, 'share').startswith('Not testing: everyone sees today’s') and 'the only version on' in pg.locator('#toast').inner_text(), f'{tag}: the last one on refuses to go off, saying why')
        flip(pg, 'share', 'deadline'); pg.locator('#toast button', has_text='Undo').first.click(); pg.wait_for_timeout(700)
        ok(live(pg, 'share').startswith('Not testing'), f'{tag}: Undo takes back the last change ({live(pg, "share")[:40]})')
        flip(pg, 'share', 'deadline')
        ok(live(pg, 'share').startswith('Running: today’s against'), f'{tag}: switched back on, it runs again')
        ok(pg.evaluate("document.activeElement?.id || ''").startswith('ab-arm-share-'), f'{tag}: focus stays on the switch just flipped ({pg.evaluate("document.activeElement?.id || null")})')
        flip(pg, 'share', 'summary')
        ok(live(pg, 'share').startswith('Not testing: everyone sees “'), f'{tag}: only the other: everyone sees it, by name ({live(pg, "share")[:50]})')
        links = card(pg, 'share').locator('a[target="_blank"]').evaluate_all("as => as.map(a => a.getAttribute('href'))")
        ok(len(links) == 2 and all('abrest=today' in l for l in links), f'{tag}: each version’s Try it keeps every other test at today’s ({links[:1]})')
        # Tap a picture: full screen, the arrows flip the versions at the same spot
        card(pg, 'share').locator('.ab-shot').first.click(); pg.wait_for_selector('dialog[open] .ab-zoom', timeout=5000); pg.wait_for_timeout(300)
        z1 = pg.locator('dialog[open] .ab-zname').inner_text(); pg.locator('dialog[open] [data-zv="1"]').click(); pg.wait_for_timeout(200)
        z2 = pg.locator('dialog[open] .ab-zname').inner_text()
        ok(z1.startswith('Today’s') and z1 != z2 and 'Version 2 of 2' in z2 and pg.locator('dialog[open] .ab-zfig img').count() == 1, f'{tag}: a picture opens full screen and Next version flips to the other ({z2[:40]!r})')
        pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
        # A note asks first (the email ask waits on a lawyer), and the consent warning shows
        go('email'); flip(pg, 'email', 'after')
        ok(pg.locator('dialog[open]').count() == 1, f'{tag}: switching on the email ask’s other version asks first (its note)')
        pg.locator('dialog[open] button', has_text='Switch it on').click(); pg.wait_for_timeout(800)
        ok(live(pg, 'email').startswith('Running: today’s against') and 'lawyer' in card(pg, 'email').inner_text().lower(), f'{tag}: then it runs, with the lawyer warning')
        # The first-visit test: any mix of its six, compared screen by screen
        go('onb')
        for a in ('p2', 'p4'):
            flip(pg, 'onb', a)
            if pg.locator('dialog[open]').count(): pg.locator('dialog[open] button', has_text='Switch it on').click(); pg.wait_for_timeout(800)
        ok(live(pg, 'onb').startswith('Running: today’s, Plan 2 and Plan 4'), f'{tag}: the first visit runs any mix, named by plan ({live(pg, "onb")[:50]})')
        flip(pg, 'onb', 'today'); flip(pg, 'onb', 'p4')
        ok(live(pg, 'onb').startswith('Not testing: everyone sees Plan 2'), f'{tag}: or one plan for everyone ({live(pg, "onb")[:50]})')
        src0 = card(pg, 'onb').locator('.ab-shot img').first.get_attribute('src')
        pg.locator('[data-seg="abstep"][data-val="1"]').click(); pg.wait_for_timeout(400)
        ok(card(pg, 'onb').locator('.ab-shot img').first.get_attribute('src') != src0, f'{tag}: Screen 2 moves every picture to the next screen')
        # Pick: the picked one is left on alone
        go('fv'); card(pg, 'fv').locator('[data-abpick][data-abarm="short"]').click(); pg.wait_for_timeout(800)
        ok(live(pg, 'fv').startswith('Not testing: everyone sees “') and card(pg, 'fv').locator('#ab-arm-fv-short').is_checked() and not card(pg, 'fv').locator('#ab-arm-fv-full').is_checked(), f'{tag}: Pick leaves only that version on')
        ok(pg.locator('dialog[open]').count() == 0, f'{tag}: a pick needs no sheet (the switch’s way: saved, with Undo)')
        # Back on the list, the lines keep their order whatever was switched
        pg.evaluate("location.hash = '#/setup/tests'"); pg.wait_for_selector('.ab-row', timeout=30000); pg.wait_for_timeout(400)
        ok(pg.eval_on_selector_all('.ab-row', 'rs => rs.map(r => r.dataset.abrow)') == keys, f'{tag}: the lines keep their order after switches are flipped')
        go('share'); pg.screenshot(path=os.path.join(OUT, f'versions_tests_{tag}.png'))
        # the tester sheet's links
        pg.goto(f'{BASE}/staff.html?demo=1#/setup/room'); pg.wait_for_selector('.rm-group', timeout=60000); pg.wait_for_timeout(600)
        u = pg.eval_on_selector_all('[data-rmqr]', 'bs => bs.map(b => b.dataset.url)')
        ok(u and all('demo=1&restart&abrest=today&' in x and '&ab=' in x for x in u), f'{tag}: the tester sheet’s practice links keep every other test at today’s ({u[0] if u else None})')
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
    ok(arms(pg, 'end') == 'today' and arms(pg, 'layout') == 'calm', 'and every test left at its first version shows it')
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
    ok(arms(pg, 'share') == 'summary' and arms(pg, 'layout') == 'calm' and arms(pg, 'end') == 'home', '&abrest=today: the link’s own version, today’s for the rest, whatever the switches'); ctx.close()
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
