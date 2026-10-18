# The calm redesign of the pages after the first visit (R-303), behind ?rec=1 until Nate's look.
#   python3 tests/r303_rec.py [base]
# base: a served copy (http://localhost:8832); without one the test serves this checkout from disk as http://wt.local.
# Checks, on the practice copy as Kai (who follows three issues), at phone (390x844) and laptop (1440x900):
#   The frame: tabs Home · My issues · Find · You; the header's box says it finds lawmakers; an issue and its bill light the
#   tab they were opened from (My issues, Find, Home).
#   The issue page in its three shapes (R-302 option A): let-counties-regulate-tobacco (one bill moving),
#   safety-for-immigrant-families (four), higher-tobacco-and-e-cigarette-taxes (none): the order of the blocks, one filled
#   button on the page, the first card's top under 400px on a phone, the card in the side panel on a laptop, no page errors,
#   no sideways scroll. One bill: "Where HB 1563 is now", the full record row, the closed did-not-advance card, the button
#   docks once the card scrolls away. Four: "Bills on this issue", the carded bill said once. None: "What happened" with
#   Follow as the filled button. A followed issue's "Following" opens the menu, Stop following has Undo.
#   The category page (tobacco): Back to Find, no counts, a Follow per issue row, "Follow all of it, and new ones" outlined
#   at the end, no filled button. An old coalition address opens its category.
#   Without ?rec the old issue and category pages (.fd-ihead) still draw, with today's tabs.
#   Across the pages (the wrap-up review, 10/18): the back row at one height on every page below a tab (phone, 1024, laptop);
#   one left edge for the h1 on a laptop; Find, My issues and Every bill's h1 at 28px; "More ways to help" as words in a
#   hearing card and behind a toggle in a committee's card; search's Follow is the topic page's pill; Tobacco's quiet issues
#   in one closed card (the page under 1,500px on a phone); a topic's rows say a deadline in Home's words.
import sys, os, asyncio
from urllib.parse import urlparse, unquote
from playwright.async_api import async_playwright

ARG = (sys.argv[1] if len(sys.argv) > 1 else '').rstrip('/')
BASE = ARG or 'http://wt.local'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ok = fail = 0
def check(cond, what):
    global ok, fail
    if cond: ok += 1; print('PASS', what)
    else: fail += 1; print('FAIL', what)

# Kai, as the practice copy's tester sheet sets him up (compare.html WHO.kai): three issues, a finished first visit.
KAI = """(() => { if (sessionStorage.getItem('__set')) return; sessionStorage.setItem('__set', '1');
  for (const k of Object.keys(localStorage)) if (k.startsWith('hiphi_')) localStorage.removeItem(k);
  const set = (k, v) => localStorage.setItem(k + '_demo', typeof v === 'string' ? v : JSON.stringify(v)), at = Date.parse('2026-03-16T09:00:00-10:00');
  set('hiphi_issue_follows', ['66a32660-b0a7-4a90-a71f-231963619b44', '1dcec7ca-ed94-4a19-9c9c-235514ca7491', '2616613e-a363-418b-ae19-4add60957cd8']);
  set('hiphi_watch_ids', []); set('hiphi_cat_follows', []); set('hiphi_skips', []); set('hiphi_wiz', { done: true, issues: ['tobacco', 'food', 'around'], name: 'Kai' });
  set('hiphi_onb', { lastVisit: new Date(at - 14 * 36e5).toISOString() }); set('hiphi_done', []); set('hiphi_done_at', {}); set('hiphi_stances', {}); set('hiphi_demo_seeded', '0');
  localStorage.setItem('hiphi_tour_home_demo', '{"how":"test"}'); localStorage.setItem('hiphi_tour_bill_demo', '{"how":"test"}');
})();"""

def serve(route, request=None):
    f = os.path.join(ROOT, unquote(urlparse(route.request.url).path).lstrip('/'))
    if os.path.isdir(f): f = os.path.join(f, 'index.html')
    return route.fulfill(path=f) if os.path.isfile(f) else route.fulfill(status=404, body='not found')

async def ctx_for(br, w, h):
    ctx = await br.new_context(viewport={'width': w, 'height': h})
    await ctx.add_init_script(KAI)
    if not ARG: await ctx.route('http://wt.local/**', serve)
    return ctx

async def open_page(ctx, hash_, rec=True, wait='#main'):
    pg = await ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.goto(f"{BASE}/track.html?demo=1{'&rec=1' if rec else ''}{hash_}")
    await pg.wait_for_selector(wait, timeout=60000)
    await pg.wait_for_timeout(700)
    return pg, errs

ORDER = """sels => { const els = sels.map(s => document.querySelector(s));
  if (els.some(e => !e)) return 'missing: ' + sels.filter((s, k) => !els[k]).join(' | ');
  for (let i = 1; i < els.length; i++) if (els[i - 1].compareDocumentPosition(els[i]) & Node.DOCUMENT_POSITION_PRECEDING) return 'out of order at ' + sels[i];
  return 'ok'; }"""
# Filled buttons a person can see on the page (the docked bar counts only once it shows).
FILLED = """() => [...document.querySelectorAll('#main .btn.primary')].filter(b => { const r = b.getBoundingClientRect(), cs = getComputedStyle(b);
  let v = b; while (v) { const s = getComputedStyle(v); if (s.visibility === 'hidden' || s.display === 'none' || +s.opacity === 0) return false; v = v.parentElement; }
  return r.width > 0 && r.height > 0; }).length"""
WIDE = "document.documentElement.scrollWidth > innerWidth + 1"
TABS = "[...document.querySelectorAll('nav.tabs a, nav.hnav a')].filter(a => a.offsetParent).map(a => a.textContent.trim())"
LIT = "(document.querySelector('nav.tabs a[aria-current=page]') || document.querySelector('nav.hnav a[aria-current=page]'))?.textContent.trim()"

ISSUES = [('let-counties-regulate-tobacco', 1), ('safety-for-immigrant-families', 2), ('higher-tobacco-and-e-cigarette-taxes', 3)]

async def main():
    async with async_playwright() as p:
        br = await p.chromium.launch()
        for w, h, tag in [(390, 844, 'phone'), (1440, 900, 'laptop')]:
            phone = w < 800
            for slug, shape in ISSUES:
                ctx = await ctx_for(br, w, h)
                pg, errs = await open_page(ctx, f'#/issue/{slug}', wait='#main .rc-iss[data-shape]')
                t = f'{tag} {slug}'
                check(await pg.evaluate("document.querySelector('.rc-iss').dataset.shape") == str(shape), f'{t}: shape {shape}')
                card = '.rc-what' if shape == 3 else '.rc-iact .bl-ract, .rc-iact .bl-act'
                rest = {1: '.rc-irest .bl-rwhere', 2: '.rc-irest .rc-sec', 3: '.rc-irest .rc-folds'}[shape]
                check(await pg.evaluate(ORDER, ['.bl-rtop', '.rc-ihead h1', card, rest]) == 'ok', f'{t}: top row, name, the card, then the rest')
                check(await pg.evaluate("document.querySelectorAll('#main h1').length") == 1, f'{t}: one h1')
                check(await pg.evaluate(FILLED) == 1, f'{t}: one filled button on the page ({await pg.evaluate(FILLED)})')
                check(not await pg.evaluate(WIDE), f'{t}: no sideways scroll')
                top = await pg.evaluate(f"Math.round(document.querySelector('{'.rc-what' if shape == 3 else '.rc-iact .card'}').getBoundingClientRect().top)")
                if phone: check(top < 400, f'{t}: the first card starts at {top}px (under 400)')
                else: check(await pg.evaluate("!!document.querySelector('.bl-side .rc-iact .card, .bl-side .rc-what')"), f'{t}: the card is in the side panel')
                check(not await pg.evaluate("/\\(\\d+\\)|\\d+ (bills|issues)\\b/.test([...document.querySelectorAll('#main h1, #main h2, #main .rc-ft')].map(e => e.textContent).join('|'))"), f'{t}: no counts in headings')
                if shape == 1:
                    check(await pg.evaluate("document.getElementById('bl-rw-h')?.textContent") == 'Where HB 1563 is now', f'{t}: "Where HB 1563 is now"')
                    check(await pg.evaluate("!!document.querySelector('.rc-record a[href*=\"HB1563\"]')"), f'{t}: one row to HB 1563\'s full record')
                    check(await pg.evaluate("!!document.querySelector('.rc-alead a[href*=\"HB1563\"]')"), f'{t}: the card\'s first line names HB 1563')
                    check(await pg.evaluate("(d => d && !d.open)(document.querySelector('.rc-fold[data-rc-fold=issue-gone]'))"), f'{t}: the bills that did not advance, closed')
                    if phone:
                        check(not await pg.evaluate("document.body.classList.contains('bl-docked')"), f'{t}: no docked button while the card is in view')
                        # the page is short: open the closed card so there is room to scroll the button away
                        await pg.click('.rc-fold[data-rc-fold=issue-gone] > summary'); await pg.wait_for_timeout(200)
                        await pg.evaluate("window.scrollTo(0, 2000)"); await pg.wait_for_timeout(300)
                        check(await pg.evaluate("document.body.classList.contains('bl-docked') && !!document.querySelector('.actionbar .btn.primary')"), f'{t}: the button docks once the card has scrolled away')
                        check((await pg.evaluate("document.querySelector('.actionbar .rc-dfor')?.textContent") or '').startswith('HB 1563 · Needs a hearing by'), f'{t}: the docked button names its bill and its moment')
                        await pg.click('.rc-fold[data-rc-fold=issue-gone] > summary'); await pg.evaluate("window.scrollTo(0, 0)"); await pg.wait_for_timeout(200)
                        # the card's button opens the email walkthrough for this bill (not a bare mailto)
                        await pg.click('.rc-iact .btn.primary'); await pg.wait_for_timeout(2500)
                        check(await pg.evaluate("!!document.querySelector('dialog[open]')"), f'{t}: the card\'s button opens the walkthrough')
                if shape == 2:
                    rows = await pg.evaluate("[...document.querySelectorAll('.rc-sec .rc-row')].map(a => a.innerText)")
                    check(len(rows) == 4, f'{t}: four rows under "Bills on this issue"')
                    check(sum('In the card' in r for r in rows) == 1, f'{t}: the carded bill says so once')
                    check(all('In the card' in r or 'In the House' in r or 'In the Senate' in r for r in rows), f'{t}: each other row says where its bill is')
                if shape == 3:
                    check(await pg.evaluate("document.getElementById('rc-what-h')?.textContent") == 'Nothing is moving on this issue this year', f'{t}: "Nothing is moving on this issue this year"')
                    check(await pg.evaluate("!!document.querySelector('.rc-what .btn.primary[data-fdissue]') && !document.querySelector('.rc-ihead .rc-fpill')"), f'{t}: Follow is the card\'s filled button, no pill above')
                    check(await pg.evaluate("(d => d && d.open === " + ('false' if phone else 'true') + ")(document.querySelector('.rc-fold[data-rc-fold=issue-gone]'))"), f'{t}: the bills that did not advance, {"closed" if phone else "open"}')
                check(not errs, f'{t}: no page errors {errs[:2]}')
                await ctx.close()

            # A followed issue (Kai follows the disposable e-cigarette ban, two versions of one bill): Following opens its menu,
            # Stop following says so with Undo, and Undo follows again.
            ctx = await ctx_for(br, w, h)
            pg, errs = await open_page(ctx, '#/issue/disposable-e-cigarette-ban', wait='#main .rc-iss[data-shape]')
            t = f'{tag} disposable-e-cigarette-ban'
            check(await pg.evaluate("document.querySelector('.rc-sec .rc-note')?.textContent") == 'The House and the Senate each have a version. Either one can become law.', f'{t}: the two versions say so')
            await pg.click('[data-rc-fmenu]'); await pg.wait_for_timeout(200)
            check(await pg.evaluate("!document.getElementById('rc-fmenu').hidden && !!document.querySelector('#rc-fmenu [data-fdunissue]')"), f'{t}: Following opens a menu with Stop following')
            await pg.click('#rc-fmenu [data-fdunissue]'); await pg.wait_for_timeout(600)
            check(await pg.evaluate("!!document.querySelector('.rc-ihead .rc-fpill[data-fdissue]') && /no longer follow/.test(document.getElementById('toast')?.textContent || '')"), f'{t}: Stop following, with a toast')
            await pg.click('#toast .toastundo'); await pg.wait_for_timeout(600)
            check(await pg.evaluate("!!document.querySelector('.rc-ihead [data-rc-fmenu]')"), f'{t}: Undo follows it again')
            check(not errs, f'{t}: no page errors {errs[:2]}')
            await ctx.close()

            # The category page.
            ctx = await ctx_for(br, w, h)
            pg, errs = await open_page(ctx, '#/find/category/tobacco', wait='#main .rc-cat')
            t = f'{tag} category tobacco'
            check(await pg.evaluate("document.querySelector('.rc-cat .rc-back')?.textContent.trim()") == 'Find', f'{t}: Back says Find')
            check(await pg.evaluate("document.querySelector('.rc-cat h1')?.textContent") == 'Tobacco, Nicotine & Alcohol', f'{t}: the category\'s name')
            n = await pg.evaluate("document.querySelectorAll('.rc-irow').length")
            check(n >= 10 and await pg.evaluate("[...document.querySelectorAll('.rc-irow')].every(r => r.querySelector('[data-fdissue]') && r.querySelector('.rc-rstat'))"), f'{t}: {n} issue rows, each with its line and a Follow')
            check(await pg.evaluate("[...document.querySelectorAll('.rc-cat .rc-irows')].every(u => u.classList.contains('rc-box') === !u.closest('.rc-fold'))"), f'{t}: the moving issues in one white box (card 6), the quiet ones in their closed card')
            check(await pg.evaluate("!!document.querySelector('.rc-irow .rc-fpill.on[aria-pressed=true]') && [...document.querySelectorAll('.rc-irow .rc-rstat')].some(e => /HIPHI opposes/.test(e.textContent))"), f'{t}: a followed issue says Following, and a row says HIPHI opposes')
            check(await pg.evaluate("(b => !!b && b.classList.contains('secondary') && !b.closest('.rc-irows'))(document.querySelector('[data-fdcat]'))"), f'{t}: "Follow all of it, and new ones", outlined, at the end')
            check(await pg.evaluate(FILLED) == 0, f'{t}: no filled button')
            check(not await pg.evaluate("/\\d/.test([...document.querySelectorAll('#main h1, #main h2')].map(e => e.textContent).join(''))"), f'{t}: no counts')
            check(not await pg.evaluate(WIDE), f'{t}: no sideways scroll')
            check(not errs, f'{t}: no page errors {errs[:2]}')
            await ctx.close()

        # The frame: the tabs, the header's words, and the lit tab following where the person came from.
        ctx = await ctx_for(br, 390, 844)
        pg, errs = await open_page(ctx, '#/bills')
        check(await pg.evaluate(TABS) == ['Home', 'My issues', 'Find', 'You'], 'phone: the tabs are Home, My issues, Find, You')
        await pg.click('a[href="#/issue/free-bus-rides-for-kids"]'); await pg.wait_for_selector('.rc-iss[data-shape]', timeout=30000)
        check(await pg.evaluate(LIT) == 'My issues', 'an issue opened from My issues lights My issues')
        check(await pg.evaluate("document.querySelector('.rc-iss .bl-back')?.textContent.trim()") == 'My issues', 'its Back says My issues')
        await pg.click('.rc-alead a'); await pg.wait_for_selector('.bl-rec .bl-rwhere', timeout=30000)
        check(await pg.evaluate(LIT) == 'My issues', 'its bill keeps My issues lit')
        await pg.goto(f'{BASE}/track.html?demo=1&rec=1#/find/category/tobacco'); await pg.wait_for_selector('.rc-cat', timeout=60000); await pg.wait_for_timeout(500)
        await pg.click('a[href="#/issue/let-counties-regulate-tobacco"]'); await pg.wait_for_selector('.rc-iss[data-shape]', timeout=30000)
        check(await pg.evaluate(LIT) == 'Find', 'an issue opened from a category lights Find')
        await pg.goto(f'{BASE}/track.html?demo=1&rec=1#/'); await pg.wait_for_selector('#main .cm', timeout=60000); await pg.wait_for_timeout(500)
        if await pg.evaluate("!!document.querySelector('a.cm-row[href^=\"#/issue/\"]:not([data-cm-pick])')"):
            await pg.click('a.cm-row[href^="#/issue/"]:not([data-cm-pick])'); await pg.wait_for_selector('.rc-iss[data-shape]', timeout=30000)
            check(await pg.evaluate(LIT) == 'Home', 'an issue opened from Home lights Home')
        await pg.goto(f'{BASE}/track.html?demo=1&rec=1#/find/issue/ctfh'); await pg.wait_for_selector('.rc-cat', timeout=60000)
        check(await pg.evaluate("location.hash") == '#/find/category/tobacco', 'an old coalition address (ctfh) opens its category')
        check(not errs, f'frame: no page errors {errs[:2]}')
        await ctx.close()
        ctx = await ctx_for(br, 1440, 900)
        pg, errs = await open_page(ctx, '#/issue/let-counties-regulate-tobacco', wait='.rc-iss[data-shape]')
        check(await pg.evaluate("document.getElementById('hq')?.placeholder") == 'Search issues, bills, lawmakers', 'laptop: the header\'s box says it finds lawmakers')
        check(await pg.evaluate(TABS) == ['Home', 'My issues', 'Find', 'You'], 'laptop: the header\'s tabs are Home, My issues, Find, You')
        await ctx.close()

        # Across the pages (the wrap-up review of 10/18): one back row at the bill page's place, one left edge on a laptop, one
        # h1 size for the lists, "More ways to help" as words in every card, one Follow drawing, the quiet issues of a topic
        # folded, and one way of saying a deadline in a row.
        BACK = "(b => b ? Math.round(b.getBoundingClientRect().top + scrollY) : null)([...document.querySelectorAll('#main .rc-back, #main .bl-back')].find(e => e.getBoundingClientRect().height > 0))"
        H1X = "Math.round(document.querySelector('#main h1').getBoundingClientRect().left)"
        PAGES = ['#/bill/HB1563', '#/issue/let-counties-regulate-tobacco', '#/find/category/tobacco', '#/profile', '#/privacy', '#/legislators', '#/committee/EDU', '#/allbills']
        for w, h, tag in [(390, 844, 'phone'), (1024, 768, 'l1024'), (1440, 900, 'laptop')]:
            ctx = await ctx_for(br, w, h); tops, xs = {}, {}
            for r in PAGES + ['#/find', '#/bills', '#/more']:
                pg, errs = await open_page(ctx, r)
                await pg.wait_for_timeout(600)
                if r in PAGES: tops[r] = await pg.evaluate(BACK)
                xs[r] = await pg.evaluate(H1X)
                if r in ('#/find', '#/bills', '#/allbills') and w >= 1100: check(await pg.evaluate("getComputedStyle(document.querySelector('#main h1')).fontSize") == '28px', f'{tag} {r}: the h1 is 28px, as My issues and You')
                check(not errs, f'{tag} {r}: no page errors {errs[:1]}')
                await pg.close()
            check(len(set(tops.values())) == 1 and None not in tops.values(), f'{tag}: the back row sits at one height on every page below a tab ({tops})')
            if w >= 1100: check(len(set(v for k, v in xs.items() if k != '#/legislator/189')) == 1, f'{tag}: one left edge for the h1 ({xs})')
            await ctx.close()
        for w, h, tag in [(390, 844, 'phone'), (1440, 900, 'laptop')]:
            ctx = await ctx_for(br, w, h)
            pg, errs = await open_page(ctx, '#/issue/safety-for-immigrant-families', wait='.rc-iss[data-shape]')
            check(await pg.evaluate("(b => !!b && b.classList.contains('text') && !b.classList.contains('secondary'))(document.querySelector('.acard [data-moreways]'))"), f'{tag}: a hearing card\'s More ways to help is words, as on the bill page\'s other card and Home')
            await pg.goto(f'{BASE}/track.html?demo=1&rec=1#/committee/EDU'); await pg.wait_for_selector('.rc-act', timeout=60000); await pg.wait_for_timeout(500)
            check(await pg.evaluate("(d => !!d && d.tagName === 'DETAILS' && !d.open && /More ways to help/.test(d.querySelector('summary').textContent))(document.querySelector('.rc-act .rc-aways'))"), f'{tag}: a committee\'s card keeps its other ways behind More ways to help')
            if w >= 1100: check('In the card at the right' in await pg.inner_text('#main'), f'{tag}: the committee page says the card is at the right')
            await pg.goto(f'{BASE}/track.html?demo=1&rec=1#/find?q=e-cigarettes'); await pg.wait_for_selector('#fd-results .rc-irow', timeout=60000); await pg.wait_for_timeout(500)
            check(await pg.evaluate("[...document.querySelectorAll('#fd-results .rc-irow')].every(li => li.querySelector('button.rc-fpill[data-fdissue]'))"), f'{tag}: search draws Follow as the topic page\'s pill')
            await pg.goto(f'{BASE}/track.html?demo=1&rec=1#/find/category/tobacco'); await pg.wait_for_selector('.rc-cat', timeout=60000); await pg.wait_for_timeout(500)
            check(await pg.evaluate("(d => !!d && !d.open && d.querySelectorAll('.rc-irow').length >= 5)(document.querySelector('.rc-fold[data-rc-fold=cat-quiet]'))"), f'{tag}: Tobacco\'s issues with nothing moving wait in one closed card')
            stats = await pg.evaluate("[...document.querySelectorAll('.rc-irow .rc-rstat')].map(e => e.textContent).join('|')")
            check('Needs a hearing by Mon, Mar 30' in stats and 'Nothing moving' not in stats, f'{tag}: a topic\'s rows say a deadline in Home\'s words')
            if w < 800: check(await pg.evaluate('document.documentElement.scrollHeight') < 1500, f'{tag}: Tobacco is {await pg.evaluate("document.documentElement.scrollHeight")}px on a phone (1,972 before the fold)')
            check(not errs, f'{tag} cross-page: no page errors {errs[:2]}')
            await ctx.close()

        # Without ?rec: today's pages.
        ctx = await ctx_for(br, 390, 844)
        pg, errs = await open_page(ctx, '#/issue/let-counties-regulate-tobacco', rec=False, wait='#main .fd')
        await pg.wait_for_selector('.fd-ihead', timeout=30000)
        check(await pg.evaluate("!!document.querySelector('.fd-ihead h1') && !document.querySelector('.rc-iss')"), 'without ?rec the old issue page (.fd-ihead) still draws')
        check(await pg.evaluate(TABS) == ['Home', 'My issues', 'Find', 'More'], 'without ?rec the tabs are today\'s')
        await pg.goto(f'{BASE}/track.html?demo=1#/find/category/tobacco'); await pg.wait_for_selector('.fd .fd-ihead', timeout=60000)
        check(await pg.evaluate("!document.querySelector('.rc-cat') && !!document.querySelector('[data-fdcat]')"), 'without ?rec the old category page still draws')
        check(not errs, f'without rec: no page errors {errs[:2]}')
        await ctx.close()
        await br.close()
    print(f'\n{ok} passed, {fail} failed'); sys.exit(1 if fail else 0)
asyncio.run(main())
