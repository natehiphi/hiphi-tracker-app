# R-414 (Nate 27 Nov 2026; backend 208): a start is counted when the testimony helper or an email to a chair opens, so staff can
# read started beside sent. Two halves, because the sandbox counts nothing:
#   A. the live path (a page that is not the sandbox, every Supabase request caught here, so nothing reaches production): what leaves
#      the browser for a start is its kind, the device class, the A/B version and the ?via= word, and nothing else; nothing leaves
#      under Global Privacy Control, Do Not Track, from a team browser, a crawler, a test run that has not opted in, or the sandbox.
#   B. the wiring (the sandbox with `debug` in its address, which prints the kind it would have counted): one start per opening of
#      the email walkthrough and of the testimony helper, not one per screen; a draft picked up again is the same start; the send
#      is counted once beside it; a helper opened by a team browser prints nothing; version 2's letter (?v2=1) counts its opening too.
#   python3 tests/count_starts.py [base]     base defaults to http://localhost:8832
import json, re, sys, os
from playwright.sync_api import sync_playwright

BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832').rstrip('/')
snap = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'demo', 'snapshot.json')))
ID = {b['bill_number']: b['id'] for b in snap['bills']}
passed = failed = 0
def ok(cond, msg):
    global passed, failed
    print(('PASS ' if cond else 'FAIL ') + msg)
    if cond: passed += 1
    else: failed += 1

OPT_IN = "window.__hiphiCountTests = true"   # R-100: a test run is never counted unless it says so (this suite catches every request)
IMPORT = "async () => { window.VL = await import('/pub/visitlog.js'); return true; }"
def rig(ctx, sent, opt_in=True):
    if opt_in: ctx.add_init_script(OPT_IN)
    def rpc(route):
        sent.append({'url': route.request.url, 'p': json.loads(route.request.post_data or '{}').get('p')})
        route.fulfill(status=204, body='', headers={'access-control-allow-origin': '*'})
    ctx.route(re.compile(r'.*supabase\.co/rest/v1/rpc/log_visit_count.*'), rpc)
    ctx.route(re.compile(r'.*supabase\.co/rest/v1/public_ab_tests.*'), lambda route: route.fulfill(status=200, content_type='application/json', body='[]', headers={'access-control-allow-origin': '*'}))
    ctx.route(re.compile(r'.*supabase\.co/(?!rest/v1/(rpc/log_visit_count|public_ab_tests)).*'), lambda route: (sent.append({'url': route.request.url, 'leak': True}), route.abort()))
counts = lambda sent: [s['p'] for s in sent if s.get('p')]
ALLOWED = {'kind', 'act', 'device', 'variant', 'via', 'share_path'}

with sync_playwright() as pw:
    br = pw.chromium.launch()

    # ---------------- A. the live path ----------------
    ctx = br.new_context(viewport={'width': 390, 'height': 844}); sent = []; rig(ctx, sent)
    page = ctx.new_page(); page.goto(BASE + '/tests/?via=Kokua-Kalihi'); page.evaluate(IMPORT)
    r = page.evaluate("() => Promise.all([VL.logAct('testimony_start'), VL.logAct('email_start'), VL.logAct('letter_start'), VL.logAct('legislators_start')])")
    page.wait_for_timeout(800)
    got = counts(sent)
    ok(r == [True, True, False, False], f'A: a testimony start and an email start are sent; a kind that is not one is not ({r})')
    ok([p.get('act') for p in got] == ['testimony_start', 'email_start'] and all(p.get('kind') == 'act' for p in got), f'A: two requests to log_visit_count, each an act of its kind ({[p.get("act") for p in got]})')
    ok(all(set(p) <= ALLOWED for p in got) and all(p.get('device') == 'phone' and p.get('via') == 'kokua-kalihi' for p in got),
       f'A: a start carries its kind, the device class, the version and the ?via= word, and nothing else ({[sorted(p) for p in got]})')
    blob = json.dumps(sent)
    ok(not re.search(r'"(visit|bill|bill_id|hearing|name|email|id|seconds|t0)"', blob), 'A: no visit id, bill, hearing, name, email or time in anything sent')
    ok(not any(s.get('leak') for s in sent), f'A: nothing else went to the database ({[s["url"][-60:] for s in sent if s.get("leak")]})')
    ctx.close()

    quiet_cases = (
        ('Global Privacy Control', "Object.defineProperty(navigator, 'globalPrivacyControl', { value: true })", None, True, ''),
        ('Do Not Track', "Object.defineProperty(navigator, 'doNotTrack', { value: '1' })", None, True, ''),
        ('a browser the team has signed in on', "localStorage.setItem('hiphi_team', '1')", None, True, ''),
        ('a crawler', '', 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)', True, ''),
        ('a test run that has not opted in', '', None, False, ''),
        ('the sandbox', '', None, True, '?demo=1'),
    )
    for name, init, ua, opt, q in quiet_cases:
        ctx = br.new_context(viewport={'width': 390, 'height': 844}, **({'user_agent': ua} if ua else {})); sent = []; rig(ctx, sent, opt_in=opt)
        if init: ctx.add_init_script(init)
        page = ctx.new_page(); page.goto(BASE + '/tests/' + q); page.evaluate(IMPORT)
        r = page.evaluate("() => Promise.all([VL.logAct('testimony_start'), VL.logAct('email_start')])"); page.wait_for_timeout(600)
        ok(r == [False, False] and not counts(sent), f'A: nothing is counted for {name} ({r}, {len(counts(sent))} sent)')
        ctx.close()

    # ---------------- B. the wiring, in the sandbox ----------------
    TOUR_SEEN = "try{localStorage.setItem('hiphi_tour_bill','1');localStorage.setItem('hiphi_tour_bill_demo','1');localStorage.setItem('hiphi_voice','first');localStorage.setItem('hiphi_voice_demo','first')}catch(e){}"
    CATCH = """document.addEventListener('click', e => { const a = e.target.closest && e.target.closest('a.hp-send'); if (!a) return;
      e.preventDefault(); (window.__opened ||= []).push(a.href); }, true);"""
    URL = BASE + '/track.html?demo=1&debug=1&ab=layout.today'
    def follower(team=False, extra=''):
        c = br.new_context(viewport={'width': 1440, 'height': 900}); sent = []; rig(c, sent)
        c.add_init_script(TOUR_SEEN); c.add_init_script(CATCH)
        c.grant_permissions(['clipboard-read', 'clipboard-write'], origin=BASE)
        p = c.new_page(); p.said = []; p.errs = []; p.sent = sent
        p.on('console', lambda m: p.said.append(m.text.split(': ', 1)[1].strip()) if m.text.startswith('count (sandbox, not sent):') else None)
        p.on('pageerror', lambda e: p.errs.append(str(e)[:160]))
        p.goto(URL + extra + '#/'); p.wait_for_timeout(600)
        p.evaluate(f"""localStorage.clear(); sessionStorage.clear(); localStorage.setItem('hiphi_voice', 'first'); localStorage.setItem('hiphi_voice_demo', 'first');
          localStorage.setItem('hiphi_watch_ids_demo', JSON.stringify({json.dumps([ID['HB1562'], ID['HB2121']])}));
          localStorage.setItem('hiphi_wiz', JSON.stringify({{step:1,done:true,skipped:true}})); {"localStorage.setItem('hiphi_team', '1');" if team else ''}""")
        p.goto(URL + extra + '#/'); p.reload(); p.wait_for_timeout(2800); p.said.clear()
        return c, p
    dlg = lambda p: p.evaluate("document.getElementById('hp-dlg')?.innerText || ''")
    def tap(p, rx, sel='#hp-dlg button, #hp-dlg a'):
        return p.evaluate("""([sel, rx]) => { const e = [...document.querySelectorAll(sel)].filter(x => x.offsetParent !== null).find(x => new RegExp(rx, 'i').test((x.innerText || '').trim()));
          if (!e) return false; e.click(); return true; }""", [sel, rx])
    n = lambda p, kind: p.said.count(kind)
    # Home's one action card for HB 2121: its main button writes testimony; "More ways to help" holds the quick email.
    VIS = "[...document.querySelectorAll('main button, main a')].filter(e => e.offsetParent)"
    def open_email(p):
        p.evaluate(f"({VIS}.find(e => /^More ways to help/i.test(e.innerText.trim())) || {{ click() {{}} }}).click()"); p.wait_for_timeout(600)
        p.evaluate(f"{VIS}.find(e => e.matches('.mwrow') && /quick email/i.test(e.innerText)).click()"); p.wait_for_timeout(900)
    def open_testimony(p):
        p.evaluate(f"{VIS}.find(e => /write testimony|sending your testimony/i.test(e.innerText)).click()"); p.wait_for_timeout(900)

    # 1. the quick email to a chair: one start for the whole walkthrough, the send once beside it
    c, p = follower()
    open_email(p)
    ok('Email about HB 2121' in dlg(p), 'B1: the quick email opens the walkthrough')
    ok(n(p, 'email_start') == 1, f'B1: opening it counts one email started ({p.said})')
    tap(p, '^I support it'); p.wait_for_timeout(500)
    pt = p.locator('#hp-dlg .hp-pt').first
    if pt.count(): pt.click(); p.wait_for_timeout(250)
    tap(p, '^Next'); p.wait_for_timeout(500); p.fill('#hp-name', 'Kai Ho'); tap(p, 'See my email'); p.wait_for_timeout(600)
    ok(p.locator('#hp-letter').count() == 1 and n(p, 'email_start') == 1, f'B1: four screens on, still one start ({n(p, "email_start")})')
    # leave with the draft kept, and come back to it: the same start
    tap(p, 'finish later'); p.wait_for_timeout(900)
    if p.locator('#hp-dlg').count(): p.locator('#hp-dlg [data-hp="close"]').first.click(); p.wait_for_timeout(900)
    ok(p.locator('#hp-dlg').count() == 0, 'B1: the walkthrough closes with the draft kept')
    open_email(p)
    ok('HB 2121' in dlg(p) and n(p, 'email_start') == 1, f'B1: the draft picked up again is the same start, not a second ({n(p, "email_start")})')
    if p.locator('#hp-letter').count() == 0: tap(p, 'See my email'); p.wait_for_timeout(600)
    tap(p, '^Next'); p.wait_for_timeout(900)
    p.locator('#hp-dlg .hp-send').first.click(); p.wait_for_timeout(1300)
    tap(p, '^Yes, I sent it'); p.wait_for_timeout(1500)
    ok('Mahalo' in dlg(p) and n(p, 'email') == 1 and n(p, 'email_start') == 1, f'B1: sent: one email started, one email sent ({p.said})')
    ok(not counts(p.sent) and not p.errs, f'B1: the sandbox sent nothing, and no page errors ({len(counts(p.sent))} sent, {p.errs})')
    c.close()

    # 2. the testimony helper: one start for the opening, none for its screens; opened again with nothing kept, a second
    c, p = follower()
    open_testimony(p)
    ok('Testimony on HB 2121' in dlg(p), f'B2: the testimony helper opens ({dlg(p)[:60]!r})')
    ok(n(p, 'testimony_start') == 1 and n(p, 'email_start') == 0, f'B2: opening it counts one testimony started ({p.said})')
    tap(p, '^I support it'); p.wait_for_timeout(500); tap(p, '^Next'); p.wait_for_timeout(500)
    ok(n(p, 'testimony_start') == 1, f'B2: its screens count nothing more ({n(p, "testimony_start")})')
    c.close()
    c, p = follower()
    open_testimony(p); p.locator('#hp-dlg [data-hp="close"]').first.click(); p.wait_for_timeout(900)
    ok(p.locator('#hp-dlg').count() == 0 and n(p, 'testimony_start') == 1, 'B2: opened and closed with nothing written: one start')
    open_testimony(p)
    ok(n(p, 'testimony_start') == 2, f'B2: opened again from nothing, it is a second start ({n(p, "testimony_start")})')
    ok(not counts(p.sent) and not p.errs, f'B2: the sandbox sent nothing, and no page errors ({p.errs})')
    c.close()

    # 3. a browser the team has signed in on: the helper opens, nothing is counted
    c, p = follower(team=True)
    open_testimony(p)
    ok('Testimony on HB 2121' in dlg(p) and not p.said, f'B3: a team browser opens the helper and counts nothing ({p.said})')
    c.close()

    # 4. version 2's letter in three screens (?v2=1, pub/v2/letter.js): its opening is one start too
    c, p = follower(extra='&v2=1')
    open_testimony(p)
    ok(p.locator('#hp-dlg').count() == 1 and n(p, 'testimony_start') == 1, f'B4: version 2: the letter opens and counts one testimony started ({p.said})')
    ok(not p.errs, f'B4: no page errors ({p.errs})')
    c.close()
    br.close()

print(f'\n{passed} passed, {failed} failed')
sys.exit(1 if failed else 0)
