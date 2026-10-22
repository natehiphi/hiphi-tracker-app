# R-328 batch C: a partner group's corner on the public tracker (pub/partner.js, pub/partners.js), in the practice copy's
# sample group (?demo=1&partner=1 and its states). Checks the statuses, the side set on HIPHI's bills, the editor's checks,
# hints and grade, Save draft and Send to HIPHI, the same-side refusal as the database words it, Remove with Undo, the
# terms, waiting and paused groups, a member's view, Add a bill, and on every page: no sideways scroll, one h1, labels,
# 44px targets on a phone, no console errors. Pictures go to tests/out/partner/ (look at them).
# Run: python3 tests/partner_corner.py http://localhost:8852   (a server on the frontend folder)
import sys, os, asyncio
from playwright.async_api import async_playwright
BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8852').rstrip('/')
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out', 'partner'); os.makedirs(OUT, exist_ok=True)
CLEAN = """(() => { for (const s of ['_demo', '']) { localStorage.setItem('hiphi_wiz' + s, JSON.stringify({ done: true, issues: [] }));
  localStorage.setItem('hiphi_tour_home' + s, '{}'); localStorage.setItem('hiphi_tour_bill' + s, '{}'); } })();"""
B1671='8e8609a7-0259-424e-a50c-235e15a4543c'; B1431='1b935416-9fe1-4c22-957b-cc0ddb3d9705'; B1779='3c6cf04d-1409-4a9b-baef-911952f124e1'; SB2073='e6ce282a-49ae-40eb-9869-9f84f243f893'
FAILS=[]; N=[0]
def check(ok, msg):
    N[0]+=1; print(('ok   ' if ok else 'FAIL ')+msg)
    if not ok: FAILS.append(msg)
SMALL = """(() => { const out = []; for (const el of document.querySelectorAll('#main .pt a, #main .pt button, #main .pt input:not([type=checkbox]):not([type=radio]), #main .pt label.pt-opt, #main .pt label.check, #main .pt summary, #main .pt-you')) {
  const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue; if (el.closest('p, li span.rc-rstat') && el.tagName === 'A' && !el.classList.contains('btn')) continue;
  if (r.height < 43.5) out.push((el.className || el.tagName) + ' ' + Math.round(r.height) + ' ' + (el.innerText || el.value || '').slice(0, 30)); } return out; })()"""
async def page(b, route, q='partner=1', w=390, h=844):
    ctx = await b.new_context(viewport={'width': w, 'height': h}, has_touch=w < 900, is_mobile=w < 900)
    await ctx.add_init_script(CLEAN)
    pg = await ctx.new_page(); pg.errs = []
    pg.on('pageerror', lambda e: pg.errs.append('pageerror '+str(e)))
    pg.on('console', lambda m: pg.errs.append(m.type+' '+m.text) if m.type == 'error' else None)
    await pg.goto(f'{BASE}/track.html?demo=1&{q}{route}')
    await pg.wait_for_selector('#main .pt, #main .pt-you, #main .yu-you', timeout=30000); await pg.wait_for_timeout(700)
    return ctx, pg
async def common(pg, tag, w):
    sw = await pg.evaluate('document.documentElement.scrollWidth')
    check(sw <= w, f'{tag}: no sideways scroll ({sw} at {w})')
    check(await pg.evaluate("document.querySelectorAll('h1').length") == 1, f'{tag}: one h1')
    if w < 900:
        small = await pg.evaluate(SMALL); check(not small, f'{tag}: 44px targets {small[:4]}')
    unl = await pg.evaluate("""[...document.querySelectorAll('#main .pt input, #main .pt textarea')].filter(i => i.type !== 'hidden' && !(i.labels && i.labels.length) && !i.getAttribute('aria-label')).map(i => i.id)""")
    check(not unl, f'{tag}: every field has a label {unl}')
    check(not pg.errs, f'{tag}: no console errors {pg.errs[:2]}')
async def shot(pg, name, full=False): await pg.screenshot(path=f'{OUT}/{name}.png', full_page=full)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for w, h in ((390, 844), (1440, 900)):
            t = f'{w}'
            # the corner
            ctx, pg = await page(b, '#/partner', w=w, h=h)
            txt = await pg.inner_text('#main')
            check('Keiki Smiles Alliance' in txt and 'You and 2 others from your group can write here.' in txt, f'{t} corner: the group and its line')
            for s in ['Live', 'Waiting for HIPHI', 'HIPHI asked for a change', '“Please say where the 40% figure comes from.”', 'Your edit from today waits for HIPHI.', 'Add a bill', 'Healthy keiki teeth', 'Invite a teammate', '140 visits came this way so far.']:
                check(s in txt, f'{t} corner says {s!r}')
            first = await pg.inner_text('#pt-bills-h + ul > li:first-child')
            check('HIPHI asked for a change' in first, f'{t} corner: what waits on them comes first')
            await common(pg, f'{t} corner', w); await shot(pg, f'corner-{t}'); await shot(pg, f'corner-{t}-full', True)
            # teammates in view
            await pg.evaluate("document.getElementById('pt-team-h').scrollIntoView()"); await pg.evaluate("window.scrollBy(0,-80)"); await shot(pg, f'teammates-{t}')
            await ctx.close()
            # You
            ctx, pg = await page(b, '#/more', w=w, h=h)
            await pg.wait_for_selector('.pt-you', timeout=8000)
            yt = await pg.inner_text('.pt-you')
            check('Your group' in yt.title() or 'YOUR GROUP' in yt.upper() and 'Keiki Smiles Alliance' in yt, f'{t} You: the card ({yt[:60]!r})')
            check('HIPHI asked for a change on one of your bills.' in yt, f'{t} You: what waits on them')
            await shot(pg, f'you-{t}'); await ctx.close()
            # the editor on a bill HIPHI supports: side locked
            ctx, pg = await page(b, f'#/partner/bill/{B1671}', w=w, h=h)
            d = await pg.evaluate("[...document.querySelectorAll('[data-f=fam]')].map(i => [i.value, i.checked, i.disabled])")
            check(d == [['support', True, False], ['oppose', False, True], ['neutral', False, True]], f'{t} editor HB1671: Support set, Oppose and Comments ruled out {d}')
            check('HIPHI supports this bill, so your side is Support. On HIPHI’s bills, partners add their voice on the same side.' in await pg.inner_text('#main'), f'{t} editor HB1671: says why')
            check(await pg.evaluate("document.querySelector('[data-f=side]:checked')?.value") == 'strongly_support', f'{t} editor HB1671: strength free within the family')
            await common(pg, f'{t} editor HB1671', w); await shot(pg, f'editor-locked-{t}'); await shot(pg, f'editor-locked-{t}-full', True)
            await ctx.close()
            # a bill HIPHI has no position on
            ctx, pg = await page(b, f'#/partner/bill/{SB2073}', w=w, h=h)
            d = await pg.evaluate("[...document.querySelectorAll('[data-f=fam]')].map(i => [i.checked, i.disabled])")
            check(d == [[False, False]] * 3, f'{t} editor SB2073: nothing picked, nothing ruled out {d}')
            await common(pg, f'{t} editor SB2073', w); await shot(pg, f'editor-free-{t}')
            await ctx.close()
            # the issue form
            ctx, pg = await page(b, '#/partner/issue/b7f1c2a0-0000-4000-8000-00000000a001', w=w, h=h)
            await common(pg, f'{t} issue form', w); await shot(pg, f'issue-{t}', True)
            await ctx.close()
            ctx, pg = await page(b, '#/partner/issue/new', w=w, h=h)
            await common(pg, f'{t} new issue', w); await shot(pg, f'issue-new-{t}')
            await ctx.close()
        # 320x640: the editor
        for bid, n in ((B1671, 'locked'), (B1431, 'free')):
            ctx, pg = await page(b, f'#/partner/bill/{bid}', w=320, h=640)
            await common(pg, f'320 editor {n}', 320); await shot(pg, f'editor-{n}-320'); await shot(pg, f'editor-{n}-320-full', True)
            await ctx.close()
        # the states: terms first, waiting, paused, a member
        ctx, pg = await page(b, '#/partner', q='partner=new')
        txt = await pg.inner_text('#main'); check('Before you write' in txt and 'No candidates, campaigns or parties.' in txt, 'terms: shown first')
        await common(pg, 'terms', 390); await shot(pg, 'terms-390')
        await pg.click('[data-pt-agree]'); await pg.wait_for_selector('.pt-corner', timeout=5000)
        check('Your bills' in await pg.inner_text('#main'), 'terms: I agree opens the corner'); await ctx.close()
        for mode, words in (('waiting', 'HIPHI is still looking over your group'), ('paused', 'HIPHI has paused your group for now')):
            ctx, pg = await page(b, '#/partner', q=f'partner={mode}')
            txt = await pg.inner_text('#main'); check(words in txt and 'Add a bill' not in txt, f'{mode}: says so and cannot write')
            check('Live' not in await pg.inner_text('#pt-bills-h + ul'), f'{mode}: no row says Live while nothing is public')
            await common(pg, mode, 390); await shot(pg, f'{mode}-390')
            await pg.goto(f'{BASE}/track.html?demo=1&partner={mode}#/partner/bill/{B1431}'); await pg.wait_for_selector('.pt-ed'); await pg.wait_for_timeout(400)
            check(await pg.evaluate("document.querySelector('.pt-all').disabled"), f'{mode}: the editor is read-only'); await ctx.close()
        ctx, pg = await page(b, '#/partner', q='partner=member')
        tt = await pg.inner_text('#pt-team-h + ul'); txt = await pg.inner_text('#main')
        check('malia@example.org' in tt and 'leilani@example.org' not in tt and 'Take off' not in txt and 'Leilani K., your group’s lead, invites teammates.' in txt, 'member: own email only, no invite, no Take off')
        await pg.evaluate("document.getElementById('pt-team-h').scrollIntoView()"); await shot(pg, 'teammates-member-390'); await ctx.close()
        # Add a bill
        ctx, pg = await page(b, '#/partner/add')
        await pg.fill('#pt-q', 'hb 1431'); await pg.wait_for_timeout(900)
        rt = await pg.inner_text('#pt-res'); check('HB 1431' in rt and 'On your list' in rt, f'add: a number finds the bill, on your list ({rt[:80]!r})')
        await pg.fill('#pt-q', 'fluoridation'); await pg.wait_for_timeout(1500)
        rt = await pg.inner_text('#pt-res'); check('SB 2073' in rt or 'Fluoridation' in rt, f'add: words find bills ({rt[:120]!r})')
        await common(pg, 'add', 390); await shot(pg, 'add-390')
        await pg.click('#pt-res a.rc-row >> nth=0'); await pg.wait_for_selector('.pt-ed'); await pg.wait_for_timeout(300)
        check(await pg.evaluate("location.hash.startsWith('#/partner/bill/')"), 'add: a result opens the editor'); await ctx.close()
        # writing: hints, a refusal shown as it comes, Save draft, Send to HIPHI
        ctx, pg = await page(b, f'#/partner/bill/{SB2073}')
        await pg.click('[data-pt-save="send"]'); await pg.wait_for_timeout(300)
        txt = await pg.inner_text('#main'); check('Pick your side.' in txt and 'Write the plain summary before sending.' in txt, 'send: the missing side and summary said next to them')
        check(await pg.evaluate("document.activeElement?.dataset?.f") == 'fam', 'send: focus goes to the side')
        await pg.click('label[for=pt-fam-oppose]'); await pg.wait_for_timeout(300)
        await pg.fill('#pt-summary', 'Stops fluoride in Hawaii water. Kids who vape need help too.'); await pg.wait_for_timeout(200)
        ht = await pg.inner_text('[data-hint-for=summary]'); check('e-cigarettes' in ht and 'ʻokina' in ht, f'hints: e-cigarettes and the ʻokina ({ht!r})')
        await pg.click('[data-hint-for=summary] [data-kind=ecig]'); await pg.click('[data-hint-for=summary] [data-kind=okina]'); await pg.wait_for_timeout(100)
        v = await pg.input_value('#pt-summary'); check('Hawaiʻi' in v and 'e-cigarette' in v, f'hints: one tap fixes ({v!r})')
        check(bool(await pg.inner_text('[data-grade-for=summary]')), 'the reading grade shows as they type')
        await pg.fill('#pt-ask', 'Write to your senator.'); await pg.click('[data-pt-save="draft"]'); await pg.wait_for_timeout(400)
        check('Pick the day the ask ends.' in await pg.inner_text('#main'), 'an ask needs its end date')
        await pg.fill('#pt-ask_until', '2026-04-01'); await pg.click('[data-pt-save="draft"]'); await pg.wait_for_timeout(900)
        txt = await pg.inner_text('#main'); check('Not sent to HIPHI yet.' in txt, f'save draft: status says Draft')
        await shot(pg, 'editor-draft-saved-390')
        await pg.click('[data-pt-save="send"]'); await pg.wait_for_timeout(1200)
        check(await pg.evaluate("location.hash") == '#/partner', 'send: back to the group')
        txt = await pg.inner_text('#main'); check('SB 2073' in txt and txt.count('Waiting for HIPHI') >= 2, 'send: the bill waits for HIPHI on the list')
        # a refusal from the (practice) database, as it comes
        r = await pg.evaluate("""import('./pub/partners.js').then(P => P.saveBill({ slug: 'keiki-smiles', bill_id: '%s', side: 'oppose', summary: 'x' }).then(() => 'saved', e => P.plainErr(e)))""" % B1671)
        check(r == 'HIPHI supports this bill, so a partner can only support it.', f'the same-side refusal reads as it comes ({r!r})')
        # remove with Undo
        await pg.goto(f'{BASE}/track.html?demo=1&partner=1#/partner/bill/{B1671}'); await pg.wait_for_selector('.pt-ed'); await pg.wait_for_timeout(300)
        await pg.click('[data-pt-do=remove]'); await pg.wait_for_timeout(900)
        check(await pg.evaluate("location.hash") == '#/partner' and 'is off your list' in await pg.inner_text('#toast'), 'remove: off the list with a toast')
        await shot(pg, 'removed-undo-390')
        await pg.click('#toast .toastundo'); await pg.wait_for_timeout(900)
        check('Taken off your list' not in await pg.inner_text('#main'), 'remove: Undo puts it back')
        # invite a teammate
        check(await pg.locator('#pt-inv-name').count() == 0, 'invite: one button until it is wanted')
        await pg.click('[data-pt-invopen]'); await pg.wait_for_timeout(200)
        check(await pg.evaluate("document.activeElement?.id") == 'pt-inv-name', 'invite: the button opens the two fields, Name first')
        await pg.evaluate("document.getElementById('pt-team-h').scrollIntoView()"); await shot(pg, 'invite-open-390')
        await pg.fill('#pt-inv-name', 'Noe K.'); await pg.fill('#pt-inv-email', 'noe@example.org'); await pg.click('[data-pt-invite] [type=submit]'); await pg.wait_for_timeout(900)
        txt = await pg.inner_text('#main'); check('Noe K. is in your group now.' in txt and 'noe@example.org' in txt, 'invite: added, with what to tell them')
        await pg.evaluate("document.getElementById('pt-team-h').scrollIntoView()"); await shot(pg, 'invited-390')
        check(not pg.errs, f'writing: no console errors {pg.errs[:2]}')
        await ctx.close()
        # the issues fold open
        ctx, pg = await page(b, f'#/partner/bill/{B1779}')
        txt = await pg.inner_text('#main'); check('HIPHI’s note: “Please say where the 40% figure comes from.”' in txt and txt.count('40% figure') == 1, 'changes: HIPHI’s note once, where the words are changed')
        await pg.click('[data-pt-fold=openIssues] summary'); await pg.fill('#pt-iq', 'sugary'); await pg.wait_for_timeout(300)
        await pg.evaluate("document.querySelector('[data-pt-fold=openIssues]').scrollIntoView()"); await shot(pg, 'editor-issues-390')
        await pg.evaluate("window.scrollTo(0,0)"); await shot(pg, 'editor-changes-390')
        await ctx.close()
        await b.close()
    print(f'\n{N[0] - len(FAILS)} of {N[0]} passed'); [print('FAIL', f) for f in FAILS]
    sys.exit(1 if FAILS else 0)
asyncio.run(main())
