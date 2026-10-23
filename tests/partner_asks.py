# R-328 batch G, the public side (backend migration 185): HIPHI's partners' asks in the 4:30 pm email.
#   1. You > Your alerts (#/alerts): "Asks from HIPHI's partners" with A few (checked to start), As they come and None, each saved
#      the moment it is picked ("Saved.", kept after a reload), hidden while HIPHI's updates by email are off (B-12), the partners
#      the person stopped with Start again and its Undo (B-5); only for an account with an email (nothing new signed out, nor for
#      an account with no email); the practice copy's account comes with the partner switch (?demo=1&partner=1).
#   2. unsubscribe.html?partner=<slug>&pt=<token>: opening it changes nothing, it names the partner (or "this HIPHI partner"),
#      one button calls partner_asks_stop with the token, Done and Undo, the refusals and a failure in plain words, never
#      "Stop all email"; a link with a bad token is incomplete; the old ?u= link is as it was; &demo=1 answers with no network.
#   3. Follow on a partner's issue page (#/from/<slug>/<issue>): Follow, Following, its line, kept, Stop with Undo; signed out
#      "Sign in to follow", which keeps the page for the way back.
#   4. The partner corner's "Your asks": counts from 10 people (rule 3), "Counts show once 10 people are counted.", "Going out at
#      4:30 pm today", "HIPHI took this ask back.", an ended ask, some counts under 10, a member's view.
# Every page at 390x844 and 1280x800: no sideways scroll, one h1, 44px targets on a phone, no console errors.
# Pictures go to tests/out/partner-asks/ (look at them).
# Run: python3 tests/partner_asks.py http://localhost:8871 [--live]   (a server on the frontend folder; --live also presses
#      the real stop link's button against production with a made-up token, which finds no account and changes nothing)
import sys, os, re, json, asyncio
from playwright.async_api import async_playwright
ARGS = [a for a in sys.argv[1:] if not a.startswith('--')]
LIVE = '--live' in sys.argv
BASE = (ARGS[0] if ARGS else 'http://localhost:8871').rstrip('/').replace('/track.html', '')
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out', 'partner-asks'); os.makedirs(OUT, exist_ok=True)
CLEAN = """(() => { if (sessionStorage.getItem('__set')) return; sessionStorage.setItem('__set', '1');
  for (const s of ['_demo', '']) { localStorage.setItem('hiphi_wiz' + s, JSON.stringify({ done: true, issues: [] }));
  localStorage.setItem('hiphi_tour_home' + s, '{}'); localStorage.setItem('hiphi_tour_bill' + s, '{}'); } })();"""
TOK = '0b1c2d3e-4f50-4a6b-8c7d-9e0f1a2b3c4d'
FAILS = []; N = [0]
def check(ok, msg):
    N[0] += 1; print(('ok   ' if ok else 'FAIL ') + msg)
    if not ok: FAILS.append(msg)
SMALL = """(() => { const out = []; for (const el of document.querySelectorAll('#main a, #main button, #main summary, #main label.check, #toast .toastundo')) {
  const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue; if (el.closest('p') && el.tagName === 'A' && !el.classList.contains('btn')) continue;
  if (r.height < 43.5) out.push((el.className || el.tagName) + ' ' + Math.round(r.height) + ' ' + (el.innerText || '').slice(0, 30)); } return out; })()"""
async def page(b, route, q='partner=1', w=390, h=844, wait='#main .rc', init=''):
    ctx = await b.new_context(viewport={'width': w, 'height': h}, has_touch=w < 900, is_mobile=w < 900)
    await ctx.add_init_script(CLEAN + init)
    pg = await ctx.new_page(); pg.errs = []
    pg.on('pageerror', lambda e: pg.errs.append('pageerror ' + str(e)))
    pg.on('console', lambda m: pg.errs.append(m.type + ' ' + m.text) if m.type == 'error' else None)
    await pg.goto(f'{BASE}/track.html?demo=1{"&" + q if q else ""}{route}')
    await pg.wait_for_selector(wait, timeout=30000, state='attached'); await pg.wait_for_timeout(900)
    return ctx, pg
async def common(pg, tag, w):
    sw = await pg.evaluate('document.documentElement.scrollWidth')
    check(sw <= w, f'{tag}: no sideways scroll ({sw} at {w})')
    check(await pg.evaluate("document.querySelectorAll('h1').length") == 1, f'{tag}: one h1')
    if w < 900:
        small = await pg.evaluate(SMALL); check(not small, f'{tag}: 44px targets {small[:4]}')
    check(not pg.errs, f'{tag}: no console errors {pg.errs[:2]}')
async def shot(pg, name, full=True): await pg.screenshot(path=f'{OUT}/{name}.png', full_page=full)
async def text(pg, sel='#main'): return await pg.inner_text(sel) if await pg.locator(sel).count() else ''
async def toast(pg): return await text(pg, '#toast')
SIGNED_IN = """async () => { const c = await import('./pub/core.js'); c.S.session = { user: { email: %s } };
  c.S.user = { id: 'u1', prefs: { hearing_alerts: true, action_alerts: true, consent_at: '2026-10-01T00:00:00Z' }, created_at: new Date().toISOString() };
  c.S.profile = { name: 'Lei', titles: [], interests: [], stories: {} }; c.app.go('#/more'); await new Promise(r => setTimeout(r, 300)); c.app.go('#/alerts'); }"""

async def alerts(b):
    for w, h in ((390, 844), (1280, 800)):
        t = f'alerts {w}'
        ctx, pg = await page(b, '#/alerts', w=w, h=h, wait='#main #ya-pa-t')
        txt = await text(pg)
        for s in ['Your alerts', 'Email to leilani@example.org', 'Asks from HIPHI’s partners', 'Groups HIPHI works with may ask you to speak up on bills you follow. HIPHI’s own asks come first.',
                  'A few', 'At most 1 in an email, and only when HIPHI has little to ask you. At most 1 a week from each partner.',
                  'As they come', 'Up to 2 in an email, after HIPHI’s own. At most 3 a week from each partner.',
                  'None', 'No partner asks. Hearing alerts on bills you follow still come.']:
            check(s in txt, f'{t}: says {s!r}')
        checked = await pg.evaluate("[...document.querySelectorAll('input[name=ya-pa]')].filter(r => r.checked).map(r => r.value)")
        check(checked == ['few'], f'{t}: everyone starts at A few ({checked})')
        check('You stopped asks from' not in txt, f'{t}: nothing stopped, no list')
        order = await pg.evaluate("(() => { const a = document.querySelector('#ya-lv-t'), b = document.querySelector('#ya-pa-t'), c = document.querySelector('.ya-end'); return !!(a && b && (a.compareDocumentPosition(b) & 4) && (!c || (b.compareDocumentPosition(c) & 4))); })()")
        check(order, f'{t}: after How much each issue sends, before the foot')
        await common(pg, t, w); await shot(pg, f'alerts-{w}')
        await pg.evaluate("document.querySelector('#ya-pa-t').scrollIntoView({ block: 'start' }); scrollBy(0, -80)"); await pg.wait_for_timeout(200); await shot(pg, f'alerts-section-{w}', False)
        if w == 390:
            await pg.check('#ya-pa-come'); await pg.wait_for_timeout(500)
            check('Saved.' in await text(pg, '#ya-past'), f'{t}: As they come says Saved.')
            await pg.reload(); await pg.wait_for_selector('#main #ya-pa-t', timeout=20000); await pg.wait_for_timeout(700)
            check(await pg.is_checked('#ya-pa-come'), f'{t}: As they come is kept (the practice copy’s sandbox)')
            await pg.check('#ya-pa-none'); await pg.wait_for_timeout(500)
            check('Saved.' in await text(pg, '#ya-past') and await pg.is_checked('#ya-pa-none'), f'{t}: None saves')
            # HIPHI's updates off: the choices wait, one line says why (B-12); on again, they are back
            await pg.uncheck('#ya-em-action'); await pg.wait_for_timeout(600)
            check(await pg.locator('#ya-pa').is_hidden() and await pg.locator('#ya-paoff').is_visible(), f'{t}: updates off, the choices wait')
            check('Partner asks come only with HIPHI’s updates by email, and those are off for you now.' in await text(pg), f'{t}: and the line says why')
            check(await text(pg, '#ya-past') == '', f'{t}: the earlier "Saved." goes, so the page says it once (A-14)')
            await pg.evaluate("document.querySelector('#ya-pa-t').scrollIntoView({ block: 'start' }); scrollBy(0, -80)"); await pg.wait_for_timeout(200)
            await shot(pg, 'alerts-updates-off-390', False)
            await pg.check('#ya-em-action'); await pg.wait_for_timeout(600)
            check(await pg.locator('#ya-pa').is_visible() and await pg.locator('#ya-paoff').is_hidden(), f'{t}: updates on, the choices are back')
            check(not pg.errs, f'{t}: no console errors after saving {pg.errs[:2]}')
        await ctx.close()
    # the partners stopped from an email's link, with Start again and Undo
    for w, h in ((390, 844), (1280, 800)):
        t = f'stopped {w}'
        ctx, pg = await page(b, '#/alerts', q='partner=stopped', w=w, h=h, wait='#main .ya-pastop')
        st = await text(pg, '#main .ya-pastop')
        check('You stopped asks from:' in st and 'Keiki Smiles Alliance' in st and 'Start again' in st, f'{t}: the stopped list ({st!r})')
        lab = await pg.get_attribute('[data-ya-pastart]', 'aria-label')
        check(lab == 'Start asks from Keiki Smiles Alliance again', f'{t}: Start again names the partner ({lab})')
        await common(pg, t, w); await shot(pg, f'alerts-stopped-{w}')
        await pg.evaluate("document.querySelector('#ya-pa-t').scrollIntoView({ block: 'start' }); scrollBy(0, -80)"); await pg.wait_for_timeout(200); await shot(pg, f'alerts-stopped-section-{w}', False)
        if w == 390:
            await pg.click('[data-ya-pastart]'); await pg.wait_for_timeout(600)
            check(await pg.locator('#main .ya-pastop').count() == 0, f'{t}: Start again takes it off the list')
            tt = await toast(pg)
            check('Asks from Keiki Smiles Alliance can come again.' in tt and 'Undo' in tt, f'{t}: its toast, with Undo ({tt!r})')
            small = await pg.evaluate(SMALL); check(not small, f'{t}: the toast’s Undo is 44px {small[:2]}')
            await pg.click('#toast .toastundo'); await pg.wait_for_timeout(700)
            check(await pg.locator('#main .ya-pastop').count() == 1, f'{t}: Undo stops them again')
            check(not pg.errs, f'{t}: no console errors {pg.errs[:2]}')
        await ctx.close()
    # nothing new without an account: the practice copy without its switch is the sign-up box, as before
    ctx, pg = await page(b, '#/alerts', q='', wait='#main h1')
    check('Asks from HIPHI’s partners' not in await text(pg) and await pg.locator('#ya-pa').count() == 0, 'signed out: no partner asks setting')
    await ctx.close()
    # a session (as other tests make one) without the switch: the setting is the account's own; saving updates its prefs
    ctx, pg = await page(b, '#/more', q='', wait='#main h1')
    await pg.evaluate(SIGNED_IN % "'lei@example.com'"); await pg.wait_for_selector('#main #ya-pa-t', timeout=10000); await pg.wait_for_timeout(500)
    check('Email to lei@example.com' in await text(pg), 'signed in: the account’s own email')
    await pg.check('#ya-pa-come'); await pg.wait_for_timeout(500)
    prefs = await pg.evaluate("async () => (await import('./pub/core.js')).S.user.prefs")
    check(prefs.get('partner_asks') == 'come' and 'Saved.' in await text(pg, '#ya-past'), f'signed in: As they come saves to the account ({prefs.get("partner_asks")})')
    check(not prefs.get('consent_source') or prefs.get('consent_at') == '2026-10-01T00:00:00Z', 'signed in: the setting stamps no consent (C-4)')
    await ctx.close()
    ctx, pg = await page(b, '#/more', q='', wait='#main h1')
    await pg.evaluate(SIGNED_IN % "''"); await pg.wait_for_timeout(1200)
    check(await pg.locator('#ya-pa').count() == 0, 'signed in with no email: no partner asks setting (they come only by email)')
    await ctx.close()

async def unsub(b):
    def fake_ctx(stop_reply, name_reply=(200, '[{"name":"Keiki Smiles Alliance"}]'), w=390, h=844):
        return {'stop': stop_reply, 'name': name_reply, 'w': w, 'h': h}
    async def open_(cfg, q):
        ctx = await b.new_context(viewport={'width': cfg['w'], 'height': cfg['h']}, has_touch=cfg['w'] < 900, is_mobile=cfg['w'] < 900)
        pg = await ctx.new_page(); pg.errs = []; pg.calls = []
        pg.on('pageerror', lambda e: pg.errs.append(str(e)[:160]))
        pg.on('console', lambda m: pg.errs.append(m.text[:160]) if m.type == 'error' and 'Failed to load resource' not in m.text else None)
        async def stop(route):
            req = route.request; pg.calls.append((req.method, req.url, req.post_data))
            r = cfg['stop']
            if r == 'abort': await route.abort(); return
            await route.fulfill(status=r[0], content_type='application/json', headers={'access-control-allow-origin': '*'}, body=r[1])
        async def name(route):
            pg.calls.append(('NAME', route.request.url, None)); r = cfg['name']
            await route.fulfill(status=r[0], content_type='application/json', headers={'access-control-allow-origin': '*'}, body=r[1])
        await pg.route(re.compile(r'.*/rest/v1/rpc/partner_asks_stop.*'), stop)
        await pg.route(re.compile(r'.*/rest/v1/public_partners.*'), name)
        async def unsub_fn(route): pg.calls.append(('UNSUB', route.request.url, None)); await route.abort()
        async def fonts(route): await route.abort()
        await pg.route(re.compile(r'.*/functions/v1/unsubscribe.*'), unsub_fn)
        await pg.route(re.compile(r'.*(fonts\.googleapis|fonts\.gstatic).*'), fonts)
        await pg.goto(f'{BASE}/unsubscribe.html{q}'); await pg.wait_for_timeout(500)
        return ctx, pg
    stops = lambda pg: [c for c in pg.calls if c[0] == 'POST']
    q = f'?partner=keiki-smiles&pt={TOK}'
    for w, h in ((390, 844), (1280, 800)):
        t = f'unsub {w}'
        ctx, pg = await open_(fake_ctx((200, '{"ok":true,"partner":"keiki-smiles","partner_name":"Keiki Smiles Alliance","stopped":true}'), w=w, h=h), q)
        card = await pg.inner_text('#u-card')
        check(await pg.inner_text('#u-h') == 'Stop asks from Keiki Smiles Alliance?', f'{t}: the question names the partner ({await pg.inner_text("#u-h")!r})')
        check('HIPHI’s own emails still come.' in card and 'Nothing changes until you press the button.' in card, f'{t}: says HIPHI’s emails still come, and nothing changes yet')
        check(await pg.inner_text('#u-go') == 'Stop asks from this partner', f'{t}: one button, "Stop asks from this partner"')
        check(not stops(pg) and not [c for c in pg.calls if c[0] == 'UNSUB'], f'{t}: opening the link stopped nothing ({pg.calls})')
        check(not re.search(r'stop all|all email|unsubscribe from all', card, re.I), f'{t}: never offers to stop all email')
        sw = await pg.evaluate('document.documentElement.scrollWidth'); check(sw <= w, f'{t}: no sideways scroll ({sw})')
        small = await pg.evaluate("[...document.querySelectorAll('button, a.keep')].filter(e => e.offsetParent).map(e => [e.textContent.trim(), Math.round(e.getBoundingClientRect().height)]).filter(([, h]) => h < 44)")
        check(not small, f'{t}: 44px targets {small}')
        await pg.screenshot(path=f'{OUT}/unsub-ask-{w}.png')
        await pg.click('#u-go'); await pg.wait_for_timeout(500)
        posts = stops(pg); body = json.loads(posts[0][2]) if posts else {}
        check(len(posts) == 1 and body == {'p_partner': 'keiki-smiles', 'p_stop': True, 'p_token': TOK}, f'{t}: the button calls partner_asks_stop once, with the token ({body})')
        card = await pg.inner_text('#u-card')
        check(card.startswith('Done') and 'You won’t get asks from Keiki Smiles Alliance.' in card and 'HIPHI’s own emails still come.' in card, f'{t}: Done says what stopped ({card[:90]!r})')
        check(await pg.locator('#u-undo').is_visible() and await pg.locator('#u-go').is_hidden(), f'{t}: Undo, and no second stop button')
        check(await pg.get_attribute('#u-note a', 'href') == 'track.html#/alerts', f'{t}: how many partner asks: Your alerts')
        small = await pg.evaluate("[...document.querySelectorAll('button, a.keep')].filter(e => e.offsetParent).map(e => [e.textContent.trim(), Math.round(e.getBoundingClientRect().height)]).filter(([, h]) => h < 44)")
        check(not small, f'{t}: Undo is 44px {small}')
        await pg.screenshot(path=f'{OUT}/unsub-done-{w}.png')
        if w == 390:
            await pg.click('#u-undo'); await pg.wait_for_timeout(500)
            posts = stops(pg); body = json.loads(posts[-1][2]) if posts else {}
            check(len(posts) == 2 and body.get('p_stop') is False and body.get('p_token') == TOK, f'{t}: Undo starts them again ({body})')
            card = await pg.inner_text('#u-card')
            check('Undone. Asks from Keiki Smiles Alliance can come again.' in card and await pg.locator('#u-go').is_visible() and await pg.locator('#u-undo').is_hidden(), f'{t}: after Undo, it says so and offers the stop again')
            await pg.screenshot(path=f'{OUT}/unsub-undone-390.png')
        check(not pg.errs, f'{t}: no console errors {pg.errs[:2]}')
        await ctx.close()
    # the name read fails: "this HIPHI partner", and the answer names it
    ctx, pg = await open_(fake_ctx((200, '{"ok":true,"partner":"keiki-smiles","partner_name":"Keiki Smiles Alliance","stopped":true}'), name_reply=(500, '{}')), q)
    check(await pg.inner_text('#u-h') == 'Stop asks from this HIPHI partner?', f'no name yet: "this HIPHI partner" ({await pg.inner_text("#u-h")!r})')
    await pg.click('#u-go'); await pg.wait_for_timeout(500)
    check('You won’t get asks from Keiki Smiles Alliance.' in await pg.inner_text('#u-card'), 'no name yet: the answer names it')
    await ctx.close()
    for reply, words, tag in (((200, '{"ok":false,"why":"unknown"}'), 'We could not find that account', 'unknown'),
                              ((200, '{"ok":false,"why":"partner"}'), 'That partner isn’t on the tracker now', 'partner')):
        ctx, pg = await open_(fake_ctx(reply), q); await pg.click('#u-go'); await pg.wait_for_timeout(500)
        card = await pg.inner_text('#u-card')
        check(words in card and 'contact@hiphi.org' in card and await pg.locator('#u-go').is_hidden(), f'{tag}: says so in plain words, with the contact, no button')
        await ctx.close()
    ctx, pg = await open_(fake_ctx('abort'), q); await pg.click('#u-go'); await pg.wait_for_timeout(600)
    card = await pg.inner_text('#u-card')
    check('did not go through' in card and await pg.inner_text('#u-go') == 'Try again' and 'contact@hiphi.org' in card, 'failed: says so, Try again, the contact')
    await ctx.close()
    for bad in (f'?partner=keiki-smiles&pt=not-a-token', f'?partner=&pt={TOK}', '?partner=keiki-smiles'):
        ctx, pg = await open_(fake_ctx((200, '{}')), bad)
        check('looks incomplete' in await pg.inner_text('#u-h') and await pg.locator('#u-row').is_hidden() and not stops(pg), f'incomplete {bad}: no button, nothing sent')
        await ctx.close()
    # the old link is as it was
    ctx, pg = await open_(fake_ctx((200, '{}')), f'?u={TOK}&what=all')
    check(await pg.inner_text('#u-h') == 'Stop all email from the tracker?' and await pg.inner_text('#u-go') == 'Yes, unsubscribe', 'the ?u= link is unchanged')
    await ctx.close()
    # the practice copy's link: answers here, no network
    ctx, pg = await open_(fake_ctx('abort', name_reply=(500, '{}')), q + '&demo=1')
    check(await pg.inner_text('#u-h') == 'Stop asks from Keiki Smiles Alliance?', 'demo: names the sample partner')
    await pg.click('#u-go'); await pg.wait_for_timeout(700)
    card = await pg.inner_text('#u-card')
    check('You won’t get asks from Keiki Smiles Alliance.' in card and 'practice copy, so nothing changed' in card and not stops(pg) and not [c for c in pg.calls if c[0] == 'NAME'], 'demo: Done, says nothing changed, nothing sent')
    await ctx.close()
    if LIVE:
        # production, the public key, a made-up token: the real function finds no account and changes nothing
        ctx = await b.new_context(viewport={'width': 390, 'height': 844}); pg = await ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(f'{BASE}/unsubscribe.html?partner=keiki-smiles&pt=00000000-0000-4000-8000-000000000000'); await pg.wait_for_timeout(1500)
        await pg.click('#u-go'); await pg.wait_for_timeout(3000)
        card = await pg.inner_text('#u-card')
        check('We could not find that account' in card and not errs, f'live: a made-up token finds no account ({card[:60]!r})')
        await ctx.close()

async def follow(b):
    for w, h in ((390, 844), (1280, 800)):
        t = f'follow {w}'
        ctx, pg = await page(b, '#/from/keiki-smiles/healthy-keiki-teeth', w=w, h=h, wait='#main [data-pp-follow]:not([disabled])')
        btn = pg.locator('#main [data-pp-follow]')
        check(await btn.get_attribute('aria-pressed') == 'false' and (await btn.inner_text()).strip() == 'Follow', f'{t}: Follow, not pressed')
        check(await text(pg, '#pp-fnote') == 'Follow it to get Keiki Smiles Alliance’s asks on these bills.', f'{t}: the line says what following brings')
        await common(pg, t, w); await shot(pg, f'follow-{w}')
        await btn.click(); await pg.wait_for_timeout(600)
        btn = pg.locator('#main [data-pp-follow]')
        check(await btn.get_attribute('aria-pressed') == 'true' and 'Following' in await btn.inner_text(), f'{t}: Following, pressed')
        check(await text(pg, '#pp-fnote') == 'You’ll get Keiki Smiles Alliance’s asks on these bills.', f'{t}: the line, followed')
        check('Following Healthy keiki teeth.' in await toast(pg), f'{t}: the toast')
        check(await pg.evaluate("document.activeElement?.matches('[data-pp-follow]')"), f'{t}: focus stays on the pill')
        await shot(pg, f'following-{w}', False)
        if w == 390:
            await pg.reload(); await pg.wait_for_selector('#main [data-pp-follow]:not([disabled])', timeout=20000); await pg.wait_for_timeout(500)
            check(await pg.get_attribute('#main [data-pp-follow]', 'aria-pressed') == 'true', f'{t}: kept after a reload (the sandbox)')
            await pg.click('#main [data-pp-follow]'); await pg.wait_for_timeout(600)
            tt = await toast(pg)
            check(await pg.get_attribute('#main [data-pp-follow]', 'aria-pressed') == 'false' and 'You no longer follow Healthy keiki teeth.' in tt and 'Undo' in tt, f'{t}: Stop following, with Undo ({tt!r})')
            await pg.click('#toast .toastundo'); await pg.wait_for_timeout(700)
            check(await pg.get_attribute('#main [data-pp-follow]', 'aria-pressed') == 'true', f'{t}: Undo follows again')
        check(not pg.errs, f'{t}: no console errors {pg.errs[:2]}')
        await ctx.close()
    # signed out (the practice copy with only a partner's link): "Sign in to follow" keeps the place
    for w, h in ((390, 844), (1280, 800)):
        t = f'follow signed out {w}'
        ctx, pg = await page(b, '#/from/keiki-smiles/healthy-keiki-teeth', q='via=keiki-smiles', w=w, h=h, wait='#main [data-pp-signin]')
        check((await text(pg, '#main [data-pp-signin]')).strip() == 'Sign in to follow' and await pg.locator('#main [data-pp-follow]').count() == 0, f'{t}: "Sign in to follow"')
        await common(pg, t, w); await shot(pg, f'follow-signedout-{w}')
        if w == 390:
            await pg.click('#main [data-pp-signin]'); await pg.wait_for_timeout(800)
            kept = await pg.evaluate("JSON.parse(localStorage.getItem('hiphi_after_signin') || 'null')")
            check(pg.url.endswith('#/signin') and kept and kept.get('hash') == '#/from/keiki-smiles/healthy-keiki-teeth', f'{t}: goes to sign in, the page kept for the way back ({kept and kept.get("hash")})')
        await ctx.close()
    # the partner's own page has no Follow (it is the issue that is followed)
    ctx, pg = await page(b, '#/from/keiki-smiles', wait='#main .pp .rc-rows')
    check(await pg.locator('#main [data-pp-follow], #main [data-pp-signin]').count() == 0, 'the partner’s page: no Follow of its own')
    await ctx.close()

async def corner(b):
    for w, h in ((390, 844), (1280, 800)):
        t = f'corner {w}'
        ctx, pg = await page(b, '#/partner', w=w, h=h, wait='#main #pt-asks-h')
        sec = await text(pg, '#main section[aria-labelledby="pt-asks-h"]')
        check('Your asks' in sec and 'HIPHI emails each ask it approves at 4:30 pm to people who follow the bill or your issue.' in sec, f'{t}: "Your asks" and its line')
        rows = await pg.evaluate("[...document.querySelectorAll('section[aria-labelledby=pt-asks-h] li')].map(li => li.innerText.replace(/\\u00a0/g, ' '))")
        check(len(rows) == 2 and rows[0].startswith('HB 1671') and 'Send testimony to the Senate Health committee before its hearing.' in rows[0]
              and 'Sent to 52 people · 31 opened · 14 clicked · 10 acted' in rows[0], f'{t}: HB 1671, every count from 10 ({rows[:1]})')
        check(len(rows) == 2 and rows[1].startswith('HB 1349') and 'Counts show once 10 people are counted.' in rows[1] and 'Sent to' not in rows[1], f'{t}: HB 1349, under 10: no counts')
        order = await pg.evaluate("(() => { const a = document.querySelector('#pt-bills-h'), b = document.querySelector('#pt-asks-h'), c = document.querySelector('#pt-issues-h'); return !!(a && b && c && (a.compareDocumentPosition(b) & 4) && (b.compareDocumentPosition(c) & 4)); })()")
        check(order, f'{t}: after Your bills, before your issues')
        href = await pg.get_attribute('section[aria-labelledby=pt-asks-h] li a', 'href')
        check(href == '#/partner/bill/8e8609a7-0259-424e-a50c-235e15a4543c', f'{t}: a row opens its bill’s words ({href})')
        nowrap = await pg.evaluate("(() => { const s = document.querySelector('section[aria-labelledby=pt-asks-h] li .rc-rstat'); return s ? s.textContent.includes('10\\u00a0acted') : false; })()")
        check(nowrap, f'{t}: a count stays with its word')
        await common(pg, t, w); await shot(pg, f'corner-{w}')
        await ctx.close()
    # the other states: written into the practice copy's kept sandbox, then the page reloaded
    ctx, pg = await page(b, '#/alerts', wait='#main #ya-pa-t')
    await pg.check('#ya-pa-come'); await pg.wait_for_timeout(400)   # any change keeps the sandbox in this tab
    await pg.evaluate("""() => { const k = 'hiphi_partner_sandbox', s = JSON.parse(sessionStorage.getItem(k)); const g = s.data.groups[0], day = s.day;
      g.asks[1].first_email = new Date(day + 'T16:30:00-10:00').toISOString(); g.asks[1].approved_at = new Date(day + 'T08:50:00-10:00').toISOString();
      g.asks[0].counts = { sent: 34, opened: 12, clicked: 5, acted: 2 };
      g.asks.push({ ...g.asks[0], id: 103, approved_at: new Date(day + 'T08:00:00-10:00').toISOString(), taken_back_at: new Date().toISOString() });
      sessionStorage.setItem(k, JSON.stringify(s)); }""")
    await pg.goto(f'{BASE}/track.html?demo=1&partner=1#/partner'); await pg.reload(); await pg.wait_for_selector('#main #pt-asks-h', timeout=20000); await pg.wait_for_timeout(700)
    rows = await pg.evaluate("[...document.querySelectorAll('section[aria-labelledby=pt-asks-h] li')].map(li => li.innerText.replace(/\\u00a0/g, ' '))")
    check(any('Going out at 4:30 pm today' in r and r.startswith('HB 1349') for r in rows), f'states: going out ({rows})')
    check(any('HIPHI took this ask back.' in r for r in rows), 'states: taken back')
    check(any('Sent to 34 people · 12 opened. Other counts show once 10 people are counted.' in r for r in rows), 'states: counts under 10 left out, said once')
    await shot(pg, 'corner-states-390')
    # an ask the partner ends: the row says it has ended, with its counts
    await pg.goto(f'{BASE}/track.html?demo=1&partner=1#/partner/bill/8e8609a7-0259-424e-a50c-235e15a4543c'); await pg.reload()
    await pg.wait_for_selector('[data-pt-do="endask"]', timeout=20000); await pg.wait_for_timeout(500)
    await pg.click('[data-pt-do="endask"]'); await pg.wait_for_timeout(800)
    await pg.goto(f'{BASE}/track.html?demo=1&partner=1#/partner'); await pg.reload(); await pg.wait_for_selector('#main #pt-asks-h', timeout=20000); await pg.wait_for_timeout(700)
    rows = await pg.evaluate("[...document.querySelectorAll('section[aria-labelledby=pt-asks-h] li')].map(li => li.innerText.replace(/\\u00a0/g, ' '))")
    check(any(r.startswith('HB 1671') and 'This ask has ended. Sent to 34 people' in r for r in rows), f'states: an ended ask ({rows})')
    check(not pg.errs, f'states: no console errors {pg.errs[:2]}')
    await ctx.close()
    # a member sees the same results
    ctx, pg = await page(b, '#/partner', q='partner=member', wait='#main #pt-asks-h')
    check('Sent to 52' in (await text(pg)).replace(' ', ' '), 'member: sees the group’s results')
    await ctx.close()
    # without the switch there is no group, and nothing is asked
    ctx, pg = await page(b, '#/partner', q='', wait='#main .rc')
    check(await pg.locator('#pt-asks-h').count() == 0, 'no group: no Your asks')
    await ctx.close()

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        await alerts(b); await unsub(b); await follow(b); await corner(b)
        await b.close()
    print(f'\n{N[0] - len(FAILS)} of {N[0]} passed'); [print('FAIL', f) for f in FAILS]
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
