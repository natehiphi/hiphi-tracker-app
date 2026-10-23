# R-328 batch D: what the public sees of HIPHI's partners, in the practice copy's sample group (Keiki Smiles Alliance, live
# words on HB 1671, which HIPHI strongly supports, and HB 1349, which HIPHI only monitors; one live issue of its own).
# The practice copy shows partner words only with ?partner (any value but 0) or ?via=keiki-smiles. Checks: the partner's
# page and its issue page (#/from/...), ?via= opening the partner's page first with its welcome line, a partner that is not
# on the tracker, and nothing of a partner's in HIPHI's blue chip; on every page no sideways scroll, one h1, 44px targets on
# a phone, no console errors. Pictures go to tests/out/partner-public/ (look at them).
# Run: python3 tests/partner_public.py http://localhost:8852   (a server on the frontend folder)
import sys, os, asyncio
from playwright.async_api import async_playwright
BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8852').rstrip('/')
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out', 'partner-public'); os.makedirs(OUT, exist_ok=True)
CLEAN = """(() => { for (const s of ['_demo', '']) { localStorage.setItem('hiphi_wiz' + s, JSON.stringify({ done: true, issues: [] }));
  localStorage.setItem('hiphi_tour_home' + s, '{}'); localStorage.setItem('hiphi_tour_bill' + s, '{}'); } })();"""
FAILS = []; N = [0]
def check(ok, msg):
    N[0] += 1; print(('ok   ' if ok else 'FAIL ') + msg)
    if not ok: FAILS.append(msg)
SMALL = """(() => { const out = []; for (const el of document.querySelectorAll('#main a, #main button, #main summary')) {
  const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue; if (el.closest('p') && el.tagName === 'A' && !el.classList.contains('btn')) continue; if (el.closest('.bl-rper')) continue;   /* the bill page's lawmaker rows: not this item's (R-212) */
  if (r.height < 43.5) out.push((el.className || el.tagName) + ' ' + Math.round(r.height) + ' ' + (el.innerText || '').slice(0, 30)); } return out; })()"""
# Nothing of a partner's may sit in HIPHI's blue chip: every .chip.info on the page must say "HIPHI".
BLUE = """[...document.querySelectorAll('#main .chip.info')].map(c => c.innerText.trim()).filter(t => !/HIPHI/.test(t))"""
async def page(b, route, q='partner=1', w=390, h=844, wait='#main .rc, #main .pp'):
    ctx = await b.new_context(viewport={'width': w, 'height': h}, has_touch=w < 900, is_mobile=w < 900)
    await ctx.add_init_script(CLEAN)
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
    blue = await pg.evaluate(BLUE); check(not blue, f'{tag}: no partner words in HIPHI’s blue chip {blue}')
    check(not pg.errs, f'{tag}: no console errors {pg.errs[:2]}')
async def shot(pg, name, full=True): await pg.screenshot(path=f'{OUT}/{name}.png', full_page=full)

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for w, h in ((390, 844), (1280, 800)):
            t = f'{w}'
            # the partner's page
            ctx, pg = await page(b, '#/from/keiki-smiles', w=w, h=h, wait='#main .pp .rc-rows')
            txt = await pg.inner_text('#main')
            for s in ['A HIPHI partner', 'Keiki Smiles Alliance', 'Healthy teeth for every child in Hawaiʻi.', 'Their bills', 'HB 1671', 'HB 1349',
                      'They strongly support it · HIPHI supports it too', 'They support it · HIPHI hasn’t taken a position', 'Their issues', 'Healthy keiki teeth',
                      'It writes these words itself, and HIPHI looks over each one before it shows here.']:
                check(s.lower() in txt.lower(), f'{t} partner page says {s!r}')
            check('HB 1431' not in txt and 'HB 1779' not in txt, f'{t} partner page: words not yet approved stay off')
            await common(pg, f'{t} partner page', w); await shot(pg, f'from-{t}')
            # its issue page
            await pg.click('a[href="#/from/keiki-smiles/healthy-keiki-teeth"]'); await pg.wait_for_selector('#main .pp .pw-chip', timeout=8000); await pg.wait_for_timeout(500)
            txt = await pg.inner_text('#main')
            for s in ['A HIPHI partner’s issue', 'Healthy keiki teeth', 'Dental care every child in Hawaiʻi can reach', 'Keiki Smiles Alliance supports', 'Bills on this issue', 'HB 1671', 'HB 1349']:
                check(s.lower() in txt.lower(), f'{t} partner issue says {s!r}')
            chip = await pg.evaluate("(() => { const c = document.querySelector('#main .pw-chip'); return c ? getComputedStyle(c).backgroundColor : '' })()")
            info = await pg.evaluate("(() => { const c = document.createElement('span'); c.className = 'chip info'; document.body.append(c); const v = getComputedStyle(c).backgroundColor; c.remove(); return v; })()")
            check(chip and chip != info, f'{t} partner issue: its chip is plain grey, not HIPHI’s blue ({chip} vs {info})')
            await common(pg, f'{t} partner issue', w); await shot(pg, f'from-issue-{t}')
            await pg.go_back(); await pg.wait_for_selector('#main .pp .rc-rows', timeout=8000)
            check('#/from/keiki-smiles' in pg.url, f'{t} partner issue: Back goes to the partner')
            await ctx.close()
        # ?via= opens the partner's page first, with its welcome line, Home behind it
        ctx, pg = await page(b, '', q='via=keiki-smiles', wait='#main .pp .rc-rows')
        check(pg.url.endswith('#/from/keiki-smiles'), f'via: opens the partner’s page ({pg.url})')
        wl = await pg.inner_text('#main .pw-welcome') if await pg.locator('#main .pw-welcome').count() else ''
        check('Keiki Smiles Alliance asks you to speak up for healthy keiki teeth.' in wl, f'via: the welcome line ({wl!r})')
        await common(pg, 'via', 390); await shot(pg, 'via-390')
        await pg.go_back(); await pg.wait_for_timeout(1200)
        check(pg.url.split('#')[-1] in ('/', ''), f'via: Back goes Home ({pg.url})')
        await ctx.close()
        # a link-only partner (no words) and a mistyped slug: the page says so and offers Find
        ctx, pg = await page(b, '#/from/nobody-here', wait='#main .pp')
        txt = await pg.inner_text('#main')
        check('This group isn’t on the tracker right now.' in txt, 'gone: a group not on the tracker says so')
        await common(pg, 'gone', 390)
        await ctx.close()
        # without ?partner or ?via, the practice copy has no partner words: the page says the group is not there
        ctx, pg = await page(b, '#/from/keiki-smiles', q='', wait='#main .pp')
        check('This group isn’t on the tracker right now.' in await pg.inner_text('#main'), 'off: no sample partner without ?partner')
        await ctx.close()

        # ---- the bill page (bill.js) ----
        for w, h in ((390, 844), (1280, 800)):
            t = f'{w}'
            ctx, pg = await page(b, '#/bill/HB1671', w=w, h=h, wait='#main [data-bl-rfold="about"]')
            await pg.evaluate("document.querySelector('[data-bl-rfold=\"about\"]').open = true"); await pg.wait_for_timeout(300)
            ab = await pg.inner_text('[data-bl-rfold="about"]')
            for s in ['Why HIPHI strongly supports it', 'Why Keiki Smiles Alliance strongly supports it', 'They call it “Hygienists can fill keiki cavities”.', 'Keiki Smiles Alliance asks:', 'Keiki Smiles Alliance on House draft 2:', 'A HIPHI partner. These are its own words.', 'More from Keiki Smiles Alliance']:
                check(s in ab, f'{t} bill HB1671 about says {s!r}')
            check(ab.find('Why HIPHI strongly supports it') < ab.find('Why Keiki Smiles Alliance'), f'{t} bill HB1671: HIPHI’s reasons first')
            check('Until ' not in ab and 'On HD2' not in ab, f'{t} bill HB1671: no end date that reads as a deadline, no bare draft label')
            check(await pg.locator('#main .pw-noside').count() == 0, f'{t} bill HB1671: HIPHI has a side, so no partner chip in the head')
            await common(pg, f'{t} bill HB1671', w); await shot(pg, f'bill-HB1671-{t}')
            await ctx.close()
            ctx, pg = await page(b, '#/bill/HB1349', w=w, h=h, wait='#main .pw-noside')
            ns = await pg.inner_text('#main .pw-noside')
            check('Keiki Smiles Alliance supports' in ns and 'HIPHI hasn’t taken a position on this bill. Keiki Smiles Alliance, a group HIPHI works with, asks you to support it.' in ns, f'{t} bill HB1349: the grey chip and the no-position line ({ns!r})')
            await common(pg, f'{t} bill HB1349', w); await shot(pg, f'bill-HB1349-{t}', False)
            await ctx.close()
        ctx, pg = await page(b, '#/bill/HB1671', q='via=keiki-smiles', wait='#main .pw-welcome')
        check(await pg.locator('#main .pw-welcome').count() == 1, 'via bill: the welcome line once on the partner’s bill')
        wbg = await pg.evaluate("getComputedStyle(document.querySelector('#main .pw-welcome')).backgroundColor")
        check(wbg not in ('rgb(230, 243, 248)',) and 'Keiki Smiles Alliance' in await pg.inner_text('#main .pw-welcome'), f'via bill: the welcome names the partner, in grey ({wbg})')
        await ctx.close()
        ctx, pg = await page(b, '#/bill/HB1671', q='', wait='#main [data-bl-rfold="about"]')
        await pg.evaluate("document.querySelector('[data-bl-rfold=\"about\"]').open = true"); await pg.wait_for_timeout(300)
        check('Keiki Smiles Alliance' not in await pg.inner_text('#main'), 'off bill: no partner words without ?partner')
        await ctx.close()

        # ---- Find, search and the issue page (rec/find.js, rec/issue.js) ----
        for w, h in ((390, 844), (1280, 800)):
            t = f'{w}'
            ctx, pg = await page(b, '#/find', w=w, h=h, wait='#main .pw-fg')
            txt = await pg.inner_text('#main')
            check('From our partners' in txt and await pg.locator('#main a[href="#/from/keiki-smiles"]').count() >= 1, f'{t} find: From our partners, with the group’s page')
            await common(pg, f'{t} find', w); await shot(pg, f'find-{t}')
            await ctx.close()
            ctx, pg = await page(b, '#/find?q=HB1349', w=w, h=h, wait='#main .rc-rpart')
            check('From a partner: Keiki Smiles Alliance supports it' in await pg.inner_text('#main'), f'{t} search HB1349: the partner-only row says so')
            await common(pg, f'{t} search HB1349', w)
            await ctx.close()
            ctx, pg = await page(b, '#/find?q=HB1671', w=w, h=h, wait='#main .rc-rpart')
            check('Keiki Smiles Alliance supports it too' in await pg.inner_text('#main'), f'{t} search HB1671: the partner line beside HIPHI’s side')
            await ctx.close()
        ctx, pg = await page(b, '#/find', q='via=keiki-smiles', wait='#main .pw-fg')
        first_sec = await pg.evaluate("(() => { const s = document.querySelector('#main .pw-fg'); const all = [...document.querySelectorAll('#main h2, #main h3')]; return all.length ? all.indexOf(s.querySelector('h2, h3')) : -1; })()")
        check(first_sec in (0, 1), f'via find: the partner’s group comes first ({first_sec})')
        await ctx.close()
        ctx, pg = await page(b, '#/issue/hygienists-temporary-fillings', w=390, h=844, wait='#main .rc-rpart')
        check('Keiki Smiles Alliance supports it too' in await pg.inner_text('#main'), 'issue page: the partner line on its bill')
        await common(pg, 'issue page', 390)
        await ctx.close()

        # ---- the testimony walkthrough's points (helper.js) ----
        ctx, pg = await page(b, '#/bill/HB1671', wait='#main .btn.primary')
        main = pg.locator('main .btn.primary', has_text='Ask the chair for a hearing')
        if await main.count():
            await main.first.click(); await pg.wait_for_selector('#hp-dlg #hp-sh', timeout=15000); await pg.wait_for_timeout(600)
            await pg.locator('#hp-dlg .hp-choice[data-v="support"]').click(); await pg.wait_for_timeout(800)
            froms = await pg.evaluate("[...document.querySelectorAll('#hp-dlg .hp-pfrom .hp-pfh')].map(x => x.innerText.trim())")
            check(froms == ['From Keiki Smiles Alliance'], f'walkthrough: the partner’s points under its name ({froms})')
            check(await pg.locator('#hp-dlg .hp-pfrom [data-hp="point"]').count() == 3, 'walkthrough: each partner point has its Add button')
        else:
            check(False, 'walkthrough: the bill page offers its main button')
        await ctx.close()
        await b.close()
    print(f'\n{N[0] - len(FAILS)} of {N[0]} passed'); [print('FAIL', f) for f in FAILS]
    sys.exit(1 if FAILS else 0)

asyncio.run(main())
