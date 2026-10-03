# The public page's A/B tests (R-135; backend migration 116, docs/AB-TESTS-PLAN.md; pub/variant.js).
#   1. each test's two versions, forced by ?ab= in the sandbox: the first visit's chapters (end, fv), the email ask on
#      "Coming up" (email), the card after testimony (rank), the share message and its link (share), Home by issue (home)
#   2. the coin toss, the switches and the counting, on a plain page with every database request intercepted: nothing
#      reaches production; a request to anything but public_ab_tests or log_ab fails the run
#   python3 -m http.server 8832   (in this folder, once)
#   python3 tests/abtests.py [base]     base defaults to http://localhost:8832
import sys, json, re, os
from playwright.sync_api import sync_playwright
BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832').rstrip('/')
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
res = []
def ok(c, m): res.append(bool(c)); print('PASS' if c else 'FAIL', m)
def ready(pg): pg.wait_for_function("() => !!document.querySelector('main') && !document.querySelector('.skelpage')", timeout=60000); pg.wait_for_timeout(700)
SKIP = "() => { try { const w = JSON.parse(localStorage.getItem('hiphi_wiz') || '{}'); localStorage.setItem('hiphi_wiz', JSON.stringify({ ...w, done: true, step: 99 })); localStorage.setItem('hiphi_tour_bill', '{\"how\":\"test\"}'); localStorage.setItem('hiphi_tour_home', '{\"how\":\"test\"}'); } catch {} }"
snap = json.load(open(os.path.join(ROOT, 'demo', 'snapshot.json')))
by = lambda n: next(b for b in snap['bills'] if b['bill_number'] == n)
ROWS = [{'key': 'end', 'arms': ['today', 'home'], 'is_on': True, 'fallback': 'today'}, {'key': 'fv', 'arms': ['full', 'short'], 'is_on': True, 'fallback': 'full'},
        {'key': 'rank', 'arms': ['today', 'ranked'], 'is_on': True, 'fallback': 'today'}, {'key': 'email', 'arms': ['finale', 'after'], 'is_on': False, 'fallback': 'finale'},
        {'key': 'share', 'arms': ['summary', 'deadline'], 'is_on': True, 'fallback': 'summary'}, {'key': 'home', 'arms': ['by-day', 'by-issue'], 'is_on': True, 'fallback': 'by-day'}]

with sync_playwright() as p:
    br = p.chromium.launch()
    # ================= 1. the versions, forced in the sandbox =================
    def sandbox(ab, path='', mobile=True, skip=True):
        ctx = br.new_context(viewport={'width': 390, 'height': 844} if mobile else {'width': 1280, 'height': 800}, is_mobile=mobile)
        if skip: ctx.add_init_script(f"({SKIP})()")
        pg = ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(f"{BASE}/track.html?demo=1{'&restart' if not skip else ''}&ab={ab}{path}"); ready(pg)
        return ctx, pg, errs
    # end and fv: the first visit's three parts name the versions
    for ab, want in (('end.today,fv.full', ['How a bill becomes law', 'Stay connected']), ('end.home,fv.short', ['Why your voice matters', 'Your home page'])):
        ctx, pg, errs = sandbox(ab, skip=False)
        txt = pg.locator('main').inner_text()
        ok(all(w in txt for w in want), f'{ab}: the first visit says {want}')
        ok(not errs, f'{ab}: no page errors ' + '; '.join(errs[:2])); ctx.close()
    # email: "Coming up on your issues" asks for an email (A) or only says it can be added later (B)
    for arm in ('finale', 'after'):
        ctx, pg, errs = sandbox(f'email.{arm}', skip=False)
        html = pg.evaluate("async () => { const r = await import('./pub/start-rest.js'); return r.renderStep('soon', 5) + '|BAR|' + r.barStep('soon', 5, false); }")
        form, quiet = 'st-eform' in html.split('|BAR|')[0], 'st-quietask' in html
        ok((form and not quiet) if arm == 'finale' else (quiet and not form), f'email.{arm}: {"the email form" if form else "the quiet line"} on Coming up')
        ok(('st-send' in html.split('|BAR|')[1]) == (arm == 'finale'), f'email.{arm}: the bottom button {"sends the email" if arm == "finale" else "goes on"}')
        ok(not errs, f'email.{arm}: no page errors ' + '; '.join(errs[:2])); ctx.close()
    # rank: after testimony on HB 1780, A has no main button; B offers the quick email to the chair
    for arm in ('today', 'ranked'):
        ctx, pg, errs = sandbox(f'rank.{arm}', '#/bill/HB1780')
        out = pg.evaluate("""async id => { const c = await import('./pub/core.js'), a = await import('./pub/actions.js');
          const b = c.S.bills.find(x => x.id === id) || c.D.bills.find(x => x.id === id), h = c.D.hearings.find(x => x.bill_id === id && new Date(x.scheduled_at) > Date.now());
          const before = a.actionCard(b, h); c.S.done.add(c.doneKey(b.id, h.id, 'testimony'));
          const after = a.actionCard(b, h), d = document.createElement('div'); d.innerHTML = after;
          return { before: before.includes('Write my testimony'), primary: [...d.querySelectorAll('.btncol > .btn.primary')].map(x => x.textContent.trim()) }; }""", by('HB1780')['id'])
        ok(out['before'], f'rank.{arm}: testimony leads before it is sent (both versions)')
        ok(out['primary'] == ([] if arm == 'today' else ['Send a quick email · 2 min']), f'rank.{arm}: after testimony, main button {out["primary"]}')
        ok(not errs, f'rank.{arm}: no page errors ' + '; '.join(errs[:2])); ctx.close()
    # share: the message leads with what the bill does (A) or the deadline (B), and the link says which
    for arm in ('summary', 'deadline'):
        ctx, pg, errs = sandbox(f'share.{arm}', '#/bill/HB1780')
        t = pg.evaluate("""async id => { const c = await import('./pub/core.js'), a = await import('./pub/actions.js');
          const b = c.D.bills.find(x => x.id === id), h = c.D.hearings.find(x => x.bill_id === id && new Date(x.scheduled_at) > Date.now()); return a.shareFor(b, h); }""", by('HB1780')['id'])
        ok(t['text'].startswith('Have you seen this?' if arm == 'summary' else 'Testimony on Free school bus passes (HB 1780) closes'), f'share.{arm}: {t["text"][:70]}…')
        ok(f'via=share-{arm}' in t['url'] and t['url'].index('via=') < t['url'].index('#'), f'share.{arm}: the link carries via=share-{arm} before the #: {t["url"][-60:]}')
        ok(t.get('ab') == by('HB1780')['id'], f'share.{arm}: the share is marked for counting')
        law = pg.evaluate("""async id => { const c = await import('./pub/core.js'), a = await import('./pub/actions.js'); const b = c.D.bills.find(x => x.id === id); return a.shareFor(b, null, { law: true }); }""", by('HB1780')['id'])
        ok('via=' not in law['url'] and not law.get('ab'), f'share.{arm}: a good-news share is not part of the test')
        ok(not errs, f'share.{arm}: no page errors ' + '; '.join(errs[:2])); ctx.close()
    # home: three bills on three issues; B groups Home's top by issue
    nums = ('SB3234', 'SB3025', 'HB1780', 'HB2121')
    for arm in ('by-day', 'by-issue'):
        for mobile in (True, False):
            ctx, pg, errs = sandbox(f'home.{arm}', '#/', mobile=mobile)
            pg.evaluate("async ids => { const c = await import('./pub/core.js'); for (const id of ids) c.S.direct.add(id); c.recomputeWatch(); c.saveLocal(); }", [by(n)['id'] for n in nums])
            pg.goto(f"{BASE}/track.html?demo=1&ab=home.{arm}#/"); pg.reload(); ready(pg)
            secs = pg.locator('.hm-byissue .hm-iss'); n = secs.count(); cards = pg.locator('.hm-now .acard').count()
            heads = [secs.nth(i).locator('.hm-isst').inner_text() for i in range(min(n, 4))]
            if arm == 'by-day': ok(n == 0 and cards >= 2, f'home.by-day ({"phone" if mobile else "laptop"}): two full cards, no issue sections ({cards} cards)')
            else:
                full = pg.locator('.hm-byissue .acard').count(); first = pg.locator('.hm-byissue .acard .achead').first.inner_text() if full else ''
                ok(n >= 2 and all(heads) and full == 2, f'home.by-issue ({"phone" if mobile else "laptop"}): {n} topic sections, the two soonest as full cards as in A ({full}): {heads}')
                ok('walking' in first.lower(), f'home.by-issue: the soonest deadline is the first full card ({first})')
                ok(pg.locator('.hm-byissue .hm-iss .acard .issueline').count() == 0, 'home.by-issue: the cards leave out the topic their heading names')
                ok(all(h not in first for h in heads[:1]), 'home.by-issue: the heading does not repeat the card title')
            w = pg.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1")
            ok(w, f'home.{arm} ({"phone" if mobile else "laptop"}): no sideways scroll')
            if arm == 'by-issue': pg.screenshot(path=os.path.join(ROOT, 'tests', 'out', f'abtests_home_byissue_{"phone" if mobile else "laptop"}.png'), full_page=False)
            ok(not errs, f'home.{arm}: no page errors ' + '; '.join(errs[:2])); ctx.close()

    # ================= 2. the toss, the switches and the counting =================
    def rig(rows, gpc=False):
        ctx = br.new_context(); sent = []; leak = []
        ctx.add_init_script("window.__hiphiTossTests = true; window.__hiphiCountTests = true;" + ("Object.defineProperty(navigator, 'globalPrivacyControl', { get: () => true });" if gpc else ''))
        ctx.route(re.compile(r'.*supabase\.co/rest/v1/public_ab_tests.*'), lambda r: r.fulfill(status=200, content_type='application/json', body=json.dumps(rows), headers={'access-control-allow-origin': '*'}))
        def log(r):
            sent.extend(json.loads(r.request.post_data or '{}').get('p', {}).get('e', [])); r.fulfill(status=204, body='', headers={'access-control-allow-origin': '*', 'access-control-allow-headers': '*'})
        ctx.route(re.compile(r'.*supabase\.co/rest/v1/rpc/log_ab.*'), log)
        ctx.route(re.compile(r'.*supabase\.co/(?!rest/v1/(rpc/log_ab|public_ab_tests)).*'), lambda r: (leak.append(r.request.url), r.abort()))
        pg = ctx.new_page(); pg.goto(BASE + '/tests/'); return ctx, pg, sent, leak
    ctx, pg, sent, leak = rig(ROWS)
    # 200 fresh browsers: every test gets its own toss, about half and half
    split = pg.evaluate("""async () => { const n = {}; for (let i = 0; i < 200; i++) { localStorage.clear(); const v = await import('/pub/variant.js?b=' + i);
        for (const [k, t] of Object.entries(v.TESTS)) { const a = JSON.parse(localStorage.getItem('hiphi_ab')).arms[k]; n[k] = (n[k] || 0) + (a === t.arms[1] ? 1 : 0); } } return n; }""")
    ok(all(60 <= v <= 140 for v in split.values()), f'200 browsers: the second version of each test about half the time {split}')
    pg.evaluate("localStorage.clear()"); pg.reload()
    # the page's own copies: visitlog.js hands variant.js its sender, as on the real page
    pg.evaluate("async () => { await import('/pub/visitlog.js'); window.V = await import('/pub/variant.js'); await V.abReady; }")
    st = pg.evaluate("() => JSON.parse(localStorage.getItem('hiphi_ab'))")
    ok(set(st['arms']) == {'end', 'fv', 'rank', 'email', 'share', 'home'} and not st['forced'], f'a new browser has a version of all six, none forced ({st["arms"]})')
    eff = pg.evaluate("() => Object.fromEntries(Object.keys(V.TESTS).map(k => [k, V.armOf(k)]))")
    ok(eff['email'] == 'finale', f'the email test is off: everyone gets A whatever the toss ({st["arms"]["email"]} tossed, finale shown)')
    ok(all(eff[k] == st['arms'][k] for k in ('end', 'fv', 'rank', 'share', 'home')), 'the tests that are on show the tossed version')
    pg.evaluate("() => V.lockFirstVisit()"); pg.wait_for_timeout(1900)
    seen = sorted(e['t'] for e in sent if e['k'] == 'seen')
    ok(seen == ['end', 'fv'], f'the first visit starting: met end and fv, not email (off) {seen}')
    ok(all(e['a'] == st['arms'][e['t']] and e['f'] is False for e in sent), 'each counted with the tossed version, not forced')
    pg.evaluate("() => { V.lockFirstVisit(); V.abEvent('finished'); V.abEvent('finished'); }"); pg.wait_for_timeout(1900)
    goals = sorted(e['t'] for e in sent if e['k'] == 'goal')
    ok(goals == ['end', 'fv'] and len([e for e in sent if e['k'] == 'seen']) == 2, f'finishing counts once per test, and meeting is never counted twice {goals}')
    pg.evaluate("() => { const s = JSON.parse(localStorage.getItem('hiphi_ab')); s.seen.end.day = s.seen.fv.day = new Date(Date.now() - 3 * 864e5).toLocaleDateString('en-CA', { timeZone: 'Pacific/Honolulu' }); localStorage.setItem('hiphi_ab', JSON.stringify(s)); V.abEvent('back'); V.abEvent('acted'); }")
    pg.wait_for_timeout(1900)
    g2 = sorted(e['t'] for e in sent if e['k'] == 'goal2')
    ok(g2 == ['end', 'fv'], f'three days later: came back (end) and acted (fv), the second measures {g2}')
    pg.evaluate("() => { V.abSeen('home'); V.abEvent('acted'); }"); pg.wait_for_timeout(1900)
    ok(len([e for e in sent if e['t'] == 'home']) == 2, 'home: met it, then acted the same day counts (its window is 7 days)')
    pg.evaluate("() => { V.abRankMet('h1'); V.abStep('h2', 'email'); V.abStep('h1', 'testimony'); }"); pg.wait_for_timeout(1900)
    ok([e['k'] for e in sent if e['t'] == 'rank'] == ['seen'], 'rank: another step on a different hearing, or testimony, is not its measure')
    pg.evaluate("() => V.abStep('h1', 'attend')"); pg.wait_for_timeout(1900)
    ok([e['k'] for e in sent if e['t'] == 'rank'] == ['seen', 'goal'], 'rank: another step on the hearing where it was met is')
    pg.evaluate("() => { V.abSeen('share', { bill: 'b1' }); V.abSeen('share', { bill: 'b1' }); V.abSeen('share', { bill: 'b2' }); }"); pg.wait_for_timeout(1900)
    ok(len([e for e in sent if e['t'] == 'share' and e['k'] == 'seen']) == 2, 'share: each bill shared counts once')
    ok(not leak, 'nothing else reached the database: ' + '; '.join(leak[:2]))
    ctx.close()
    # a test switched off with a winner: everyone gets the winner, even a browser tossed the other way
    rows = [dict(r, is_on=False, fallback='home') if r['key'] == 'end' else r for r in ROWS]
    ctx, pg, sent, leak = rig(rows)
    a = pg.evaluate("""async () => { localStorage.setItem('hiphi_ab', JSON.stringify({ v: 1, arms: { end: 'today' }, forced: {} })); await import('/pub/visitlog.js'); const V = await import('/pub/variant.js'); await V.abReady; V.lockFirstVisit(); return [V.armOf('end'), V.endHome()]; }""")
    pg.wait_for_timeout(1900)
    ok(a == ['home', True] and not any(e['t'] == 'end' for e in sent), f'end off with B picked: a browser tossed A gets B, and is not counted ({a})')
    ctx.close()
    # a version the database names differently: off, today's version, never an unknown screen
    rows = [dict(r, arms=['today', 'other']) if r['key'] == 'share' else r for r in ROWS]
    ctx, pg, sent, leak = rig(rows)
    a = pg.evaluate("""async () => { localStorage.setItem('hiphi_ab', JSON.stringify({ v: 1, arms: { share: 'deadline' }, forced: {} })); await import('/pub/visitlog.js'); const V = await import('/pub/variant.js'); await V.abReady; return [V.armOf('share'), V.shareTag()]; }""")
    ok(a == ['summary', ''], f'versions that do not match the code: the test is off ({a})')
    ctx.close()
    # a friend arriving by a shared link: credited once to the message that brought them
    ctx, pg, sent, leak = rig(ROWS)
    pg.goto(BASE + '/tests/?via=share-deadline')
    pg.evaluate("async () => { await import('/pub/visitlog.js'); window.V = await import('/pub/variant.js'); }"); pg.wait_for_timeout(1900)
    pg.evaluate("() => { V.abEvent('acted'); V.abEvent('acted'); }"); pg.wait_for_timeout(1900)
    ok([(e['t'], e['a'], e['k']) for e in sent] == [('share', 'deadline', 'goal'), ('share', 'deadline', 'goal2')], f'a friend by a deadline-first link: arrived, then acted, once each {[(e["t"], e["a"], e["k"]) for e in sent]}')
    ctx.close()
    # the privacy signal: nothing is sent at all
    ctx, pg, sent, leak = rig(ROWS, gpc=True)
    pg.evaluate("async () => { await import('/pub/visitlog.js'); const V = await import('/pub/variant.js'); await V.abReady; V.lockFirstVisit(); V.abEvent('finished'); }"); pg.wait_for_timeout(1900)
    ok(not sent, f'Global Privacy Control: nothing counted ({len(sent)})')
    ctx.close()
    br.close()
print(f'{sum(res)}/{len(res)} passed'); sys.exit(0 if all(res) else 1)
