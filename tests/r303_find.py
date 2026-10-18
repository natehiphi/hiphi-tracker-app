# Find, search, Every bill HIPHI tracks and My issues in the calm redesign (R-303), behind ?rec=1 until Nate's look.
#   python3 tests/r303_find.py [base]      base defaults to this folder, served from disk as http://wt.local (no server)
# On the practice copy (16 Mar 2026), at phone and laptop size, as Kai (3 issues), Leilani (16) and a newcomer:
#   Find: the box, six topic rows with no counts, at most three issue rows that need voices (opening the rest in place), the
#     foot rows to Every bill and Committees; no action card, no HIPHI lists, no star, no filled button; the newcomer's line
#     only for a newcomer; Kai's phone page under 1,400px (3,284 before).
#   Search: issues once each (e-cigarettes named once, not three times), one follow control a row, committees without codes,
#     no governor's messages for "kim", the Places rows for "how to testify" and "my senator", "Part of" for HB1563, the link
#     to every bill, no headings with counts; Follow works from a row.
#   Every bill HIPHI tracks: Find's matching ("vape" and "keiki" find bills), "Waiting for a hearing", no header box on a
#     laptop, "Name or number" on a phone, the groups after the first closed on a phone.
#   My issues: Home's rows in Home's order, no chips, cards, counts or filled buttons, the two links, Edit with Stop following
#     and Undo; Leilani's phone page under 1,500px (4,146 before).
# No page errors and no sideways scroll anywhere; without ?rec the old pages still draw.
import sys, os, re, asyncio
from urllib.parse import urlparse, unquote
from playwright.async_api import async_playwright

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://wt.local').rstrip('/')
ok = fail = 0
def check(cond, what):
    global ok, fail
    if cond: ok += 1; print('PASS', what)
    else: fail += 1; print('FAIL', what)

src = open(os.path.join(HERE, 'compare.html')).read()
WHO = src[src.index('const WHO = {'):src.index('const pick =')]
def init(who):
    return f"""(() => {{ {WHO}
  if (sessionStorage.getItem('__set')) return; sessionStorage.setItem('__set', '1');
  for (const k of Object.keys(localStorage)) if (k.startsWith('hiphi_')) localStorage.removeItem(k);
  if ('{who}' === 'none') return;
  const p = WHO['{who}'], at = Date.parse('2026-03-16T09:00:00-10:00');
  const set = (k, v) => localStorage.setItem(k + '_demo', typeof v === 'string' ? v : JSON.stringify(v));
  set('hiphi_issue_follows', p.issues); set('hiphi_watch_ids', []); set('hiphi_cat_follows', []); set('hiphi_skips', []);
  set('hiphi_wiz', {{ done: true, issues: p.cats, name: p.name }});
  set('hiphi_onb', {{ lastVisit: new Date(at - 14 * 36e5).toISOString() }});
  set('hiphi_done', Object.keys(p.done)); set('hiphi_done_at', p.done); set('hiphi_stances', {{}}); set('hiphi_demo_seeded', '0');
  localStorage.setItem('hiphi_tour_home_demo', '{{"how":"test"}}'); localStorage.setItem('hiphi_tour_bill_demo', '{{"how":"test"}}');
}})();"""

async def serve(route):
    f = os.path.join(HERE, unquote(urlparse(route.request.url).path).lstrip('/'))
    if os.path.isdir(f): f = os.path.join(f, 'index.html')
    await (route.fulfill(path=f) if os.path.isfile(f) else route.fulfill(status=404, body='not found'))

async def ctx_for(br, who, w, h):
    ctx = await br.new_context(viewport={'width': w, 'height': h})
    await ctx.add_init_script(init(who))
    if BASE == 'http://wt.local': await ctx.route('http://wt.local/**', serve)
    pg = await ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    return ctx, pg, errs

async def go(pg, route, sel, rec=True):
    await pg.goto(f'{BASE}/track.html?demo=1{"&rec=1" if rec else ""}{route}')
    await pg.wait_for_selector(sel, timeout=60000)
    await pg.wait_for_timeout(700)

WIDE = "document.documentElement.scrollWidth > innerWidth + 1"
HEIGHT = "document.documentElement.scrollHeight"
COUNTED = "[...document.querySelectorAll('#main h1, #main h2, #main summary .rc-ft')].map(e => e.innerText).filter(t => /\\d/.test(t))"
# A row's name without the words for a screen reader ("New since your last visit")
NAMES = "sel => [...document.querySelectorAll(sel)].map(e => { const c = e.cloneNode(true); c.querySelectorAll('.sr, .cm-new, .rc-new').forEach(x => x.remove()); return c.textContent.trim(); })"
ORDER = """sels => { const els = sels.map(s => document.querySelector(s)); if (els.some(e => !e)) return 'missing: ' + sels.filter((s, i) => !els[i]).join(', ');
  for (let i = 1; i < els.length; i++) if (els[i - 1].compareDocumentPosition(els[i]) & Node.DOCUMENT_POSITION_PRECEDING) return 'out of order at ' + sels[i];
  return 'ok'; }"""

async def search(pg, q):
    await pg.fill('#q', q); await pg.press('#q', 'Enter')
    await pg.wait_for_function("q => !document.querySelector('.fd-box.busy') && !document.querySelector('.fd-stale') && document.querySelector('#fd-results') && !document.querySelector('#fd-results .skelpage') && decodeURIComponent(location.hash).includes(q)", arg=q, timeout=30000)
    await pg.wait_for_timeout(300)

async def main():
    async with async_playwright() as p:
        br = await p.chromium.launch()
        for w, h, tag in [(390, 844, 'phone'), (1440, 900, 'laptop')]:
            for who in ['kai', 'leilani', 'none']:
                ctx, pg, errs = await ctx_for(br, who, w, h)
                # ---- Find ----
                await go(pg, '#/find', '.rc-find #fd-iss-h')
                t = f'{tag} {who} Find'
                check(await pg.evaluate(ORDER, ['.rc-find .fd-h1', '#q', '#fd-iss-h', '.rc-foot']) == 'ok', f'{t}: the box, Browse by topic, then the foot')
                check(await pg.evaluate("document.querySelectorAll('.rc-topics > li').length") == 6, f'{t}: six topic rows')
                check(not await pg.evaluate("/\\d/.test(document.querySelector('.rc-topics').innerText)"), f'{t}: no counts on the topics')
                nv = await pg.evaluate("(() => { const s = document.getElementById('fd-voices-h')?.closest('section'); return s ? [...s.querySelectorAll('.rc-row')].filter(a => a.offsetParent).map(a => a.getAttribute('href')) : null; })()")
                if nv is not None:
                    check(0 < len(nv) <= 3 and all(re.match(r'^#/(issue|bill)/', x) for x in nv), f'{t}: at most three rows need voices, each to its issue (or bill) page {nv}')
                    check(await pg.evaluate("!!document.querySelector('[data-rc-showall=voices]')") or len(nv) < 3, f'{t}: "See more with a hearing this week" when there are more')
                check(await pg.evaluate("!document.querySelector('#main .acard, #fd-lists-h, #main .mb-star, #main .btn.primary')"), f'{t}: no action card, HIPHI lists, star or filled button')
                check(await pg.evaluate("!!document.querySelector('.rc-foot a[href=\"#/allbills\"]') && !!document.querySelector('.rc-foot a[href=\"#/committees\"]')"), f'{t}: Every bill HIPHI tracks and Committees at the foot')
                check(await pg.evaluate(COUNTED) == [], f'{t}: no headings with counts')
                newline = await pg.evaluate("!!document.querySelector('.rc-newhere[href=\"#/start/0\"]')")
                check(newline == (who == 'none'), f'{t}: "New here?" only for a newcomer from a link ({newline})')
                check(not await pg.evaluate(WIDE), f'{t}: no sideways scroll')
                if tag == 'phone' and who == 'kai':
                    hh = await pg.evaluate(HEIGHT); check(hh < 1400, f'{t}: under 1,400px on a phone ({hh}; 3,284 before)')
                if nv and await pg.evaluate("!!document.querySelector('[data-rc-showall=voices]')"):
                    await pg.click('[data-rc-showall=voices]'); await pg.wait_for_timeout(200)
                    check(await pg.evaluate("!document.getElementById('rc-rest-voices').hidden && location.hash === '#/find'"), f'{t}: See more opens in place')
                # ---- Search (one person is enough for the words; both sizes) ----
                if who == 'kai':
                    await search(pg, 'e-cigarettes')
                    s = f'{tag} search e-cigarettes'
                    txt = await pg.evaluate("document.getElementById('fd-results').innerText")
                    check(txt.count('Disposable e-cigarette ban') == 1, f'{s}: "Disposable e-cigarette ban" said once ({txt.count("Disposable e-cigarette ban")})')
                    check(await pg.evaluate("[...document.querySelectorAll('#fd-results .rc-frow')].every(li => li.querySelectorAll('button').length === 1) && document.querySelectorAll('#fd-results .rc-frow').length > 0"), f'{s}: one follow control on each issue row')
                    check(await pg.evaluate("!document.querySelector('#fd-results .mb-star, #fd-results .chip, #fd-results .btn.primary')"), f'{s}: no stars, chips or filled buttons')
                    check(await pg.evaluate(ORDER, ['#fd-qi-h', '#fd-results a[href="#/allbills"]']) == 'ok', f'{s}: Issues first, every bill HIPHI tracks at the foot')
                    check(await pg.evaluate(COUNTED) == [], f'{s}: no headings with counts')
                    btn = await pg.query_selector('#fd-results .rc-follow:not(.on)')
                    if btn:
                        iid = await btn.get_attribute('data-fdissue'); await btn.click(); await pg.wait_for_timeout(900)
                        if await pg.evaluate("!!document.querySelector('dialog[open]')"): await pg.keyboard.press('Escape'); await pg.wait_for_timeout(500)
                        check(await pg.evaluate(f"document.querySelector('[data-fdissue=\"{iid}\"]')?.getAttribute('aria-pressed') === 'true'"), f'{s}: Follow on a row follows the issue')
                    await search(pg, 'kim')
                    check(await pg.evaluate("!document.querySelector('#fd-results a[href*=\"/bill/GM\"]') && !!document.getElementById('fd-who-h')"), f"{tag} search kim: lawmakers, and no governor's messages")
                    await search(pg, 'health')
                    who_txt = await pg.evaluate("document.getElementById('fd-who-h')?.closest('section')?.innerText || ''")
                    check(who_txt and not re.search(r'\([A-Z]{2,4}\)', who_txt), f'{tag} search health: committees without their codes')
                    await search(pg, 'how to testify')
                    check(await pg.evaluate("!!document.querySelector('.rc-places a[href=\"#/help\"]') && !document.querySelector('#fd-results .rc-rows a[href^=\"#/bill/\"]')"), f'{tag} search how to testify: a row to Help, and no bills with only "how"')
                    await search(pg, 'my senator')
                    check(await pg.evaluate("!!document.querySelector('.rc-places a[href=\"#/legislators\"]')"), f'{tag} search my senator: a row to your lawmakers')
                    await search(pg, 'HB1563')
                    t1563 = await pg.evaluate("document.getElementById('fd-results').innerText")
                    check(t1563.count('Let counties regulate tobacco sales') == 1 and 'HB 1563' in t1563 and not await pg.evaluate("!!document.querySelector('#fd-results h2')"), f'{tag} search HB1563: the bill once (its issue has its name), no heading')
                    await search(pg, 'HB1803')
                    check((await pg.evaluate("document.querySelector('#fd-results .rc-rpart')?.innerText || ''")).startswith('Part of: Protect students from extreme heat'), f'{tag} search HB1803: the bill with the issue it is part of')
                    check(not await pg.evaluate(WIDE), f'{tag} search: no sideways scroll')
                if who == 'leilani':
                    await search(pg, 'e-cigarettes')
                    check(re.search(r'which you follow|You follow this issue', await pg.evaluate("document.getElementById('fd-results').innerText")) is not None, f'{tag} leilani search e-cigarettes: a bill on an issue she follows says so')
                # ---- My issues ----
                if who != 'none':
                    await go(pg, '#/', '#main .cm-rows, #main .cm')
                    home = await pg.evaluate(NAMES, '#main .cm-rows .cm-rname')
                    await go(pg, '#/bills', '.rc-mine')
                    m = f'{tag} {who} My issues'
                    mine = await pg.evaluate(NAMES, '.rc-mrows .rc-rname')
                    check(await pg.evaluate("document.querySelector('#main h1')?.innerText.trim()") == 'My issues', f'{m}: h1 My issues')
                    check(len(mine) > 0 and mine == home, f'{m}: Home\'s rows in Home\'s order ({len(mine)} rows){"" if mine == home else f" {mine[:4]} vs {home[:4]}"}')
                    check(await pg.evaluate("!document.querySelector('#main .fd-irow, #main .chip, #main .mb-cat, #main .btn.primary, #main .mb-star')"), f'{m}: no cards, chips, topic headings, stars or filled buttons')
                    check(await pg.evaluate("!!document.querySelector('.rc-links a[href=\"#/recap\"]') && !!document.querySelector('.rc-links a[href=\"#/find\"]')"), f'{m}: What you\'ve done this session and Follow more issues')
                    check(await pg.evaluate(COUNTED) == [], f'{m}: no headings with counts')
                    check(not await pg.evaluate(WIDE), f'{m}: no sideways scroll')
                    if tag == 'phone' and who == 'leilani':
                        hh = await pg.evaluate(HEIGHT); check(hh < 1500, f'{m}: under 1,500px on a phone ({hh}; 4,146 before)')
                    await pg.click('[data-rc-edit]'); await pg.wait_for_timeout(300)
                    n = await pg.evaluate("document.querySelectorAll('[data-rc-stop]').length")
                    check(n == len(mine), f'{m}: Edit puts Stop following on every row ({n})')
                    await pg.click('[data-rc-stop]'); await pg.wait_for_timeout(700)
                    check(await pg.evaluate("document.querySelectorAll('.rc-mrows > li').length") == len(mine) - 1, f'{m}: Stop following takes the row off')
                    undo = await pg.query_selector('.toastundo')
                    check(undo is not None, f'{m}: an Undo in the toast')
                    if undo:
                        await undo.click(); await pg.wait_for_timeout(700)
                        check(await pg.evaluate("document.querySelectorAll('.rc-mrows > li').length") == len(mine), f'{m}: Undo brings it back')
                check(not errs, f'{tag} {who}: no page errors {errs[:2]}')
                await ctx.close()
            # ---- Every bill HIPHI tracks ----
            ctx, pg, errs = await ctx_for(br, 'kai', w, h)
            await go(pg, '#/allbills', '#ab-q')
            a = f'{tag} Every bill'
            ph = await pg.get_attribute('#ab-q', 'placeholder')
            check(ph == ('Name or number' if tag == 'phone' else 'Search by name or number'), f'{a}: the placeholder ({ph})')
            check(await pg.evaluate("document.body.innerText.includes('Waiting for a hearing') && !document.body.innerText.includes('Waiting in committee')"), f'{a}: "Waiting for a hearing", one word')
            check(await pg.evaluate("!document.querySelector('.hdr .hsearch') || !document.querySelector('.hdr .hsearch').offsetParent"), f'{a}: no header search box')
            check(await pg.evaluate("document.querySelector('.ab .rc-back')?.innerText.trim() === 'Find' && [...document.querySelectorAll('[aria-current=page]')].some(x => x.offsetParent && /Find/.test(x.innerText))"), f'{a}: "← Find" and the Find tab lit')
            if tag == 'phone':
                check(await pg.evaluate("(() => { const f = [...document.querySelectorAll('#ab-list details.mb-fold')]; return f.length >= 2 && f.every(d => !d.open) && document.querySelector('#ab-list > :first-child').matches('section.ab-grp'); })()"), f'{a}: the first group open, the rest closed')
            for word, least in [('vape', 1), ('keiki', 3), ('kim', 0)]:
                await pg.fill('#ab-q', word); await pg.wait_for_timeout(600)
                n = await pg.evaluate("document.querySelectorAll('#ab-list .mb-row').length")
                check(n >= least, f'{a}: "{word}" finds {n} bills (Find\'s rules)')
            check(not await pg.evaluate(WIDE), f'{a}: no sideways scroll')
            check(not errs, f'{a}: no page errors {errs[:2]}')
            await ctx.close()
        # ---- a HIPHI list's page says where its back link goes ----
        ctx, pg, errs = await ctx_for(br, 'kai', 390, 844)
        await go(pg, '#/list/keiki-health', '.fd[data-page="list"]')
        check(await pg.evaluate("document.querySelector('.fd-back')?.innerText.trim()") == 'Find', 'a HIPHI list: the back link says Find')
        # ---- without ?rec the old pages still draw ----
        await go(pg, '#/find', '.fd[data-page="find"] #fd-iss-h', rec=False)
        check(await pg.evaluate("!document.querySelector('.rc-find') && document.getElementById('fd-iss-h').innerText.trim() === 'Browse issues'"), 'without ?rec: today\'s Find')
        await go(pg, '#/bills', '.mb[data-mbroot]', rec=False)
        check(await pg.evaluate("!document.querySelector('.rc-mine') && !!document.querySelector('.fd-irow')"), 'without ?rec: today\'s My issues')
        await go(pg, '#/allbills', '#ab-q', rec=False)
        check(await pg.evaluate("document.getElementById('ab-q').placeholder === 'Search by name or number' && document.body.innerText.includes('Waiting in committee')"), 'without ?rec: today\'s Every bill HIPHI tracks')
        check(not errs, f'old pages: no page errors {errs[:2]}')
        await ctx.close()
        await br.close()
    print(f'\n{ok} passed, {fail} failed'); sys.exit(1 if fail else 0)
asyncio.run(main())
