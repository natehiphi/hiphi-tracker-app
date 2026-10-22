# R-212 #38: the website table (embed.html) and the public page that makes its code (#/embed).
# Kept here while frontend tests/ is held by R-316; move it to tests/embed_page.py then.
# Run: python3 tests/embed_page.py http://localhost:8851   (a server on the frontend folder; live data for the embed's
# live cases, the practice data for the rest).
import sys, asyncio
from playwright.async_api import async_playwright

BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8851').rstrip('/')
FAILS, N = [], [0]
def check(ok, msg):
    N[0] += 1
    print(('ok   ' if ok else 'FAIL ') + msg)
    if not ok: FAILS.append(msg)
CLEAN = """(() => { for (const s of ['_demo', '']) { localStorage.setItem('hiphi_wiz' + s, JSON.stringify({ done: true, issues: [] }));
  localStorage.setItem('hiphi_tour_home' + s, '{}'); localStorage.setItem('hiphi_tour_bill' + s, '{}'); } })();"""
TXT = "[document.getElementById('title').textContent, document.getElementById('count').textContent, document.querySelector('#rows').innerText, document.documentElement.scrollWidth, document.querySelector('thead').innerText]"

async def table(b, q, w=900):
    pg = await b.new_page(viewport={'width': w, 'height': 900}); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.goto(f'{BASE}/embed.html{q}'); await pg.wait_for_function("!/Loading/.test(document.querySelector('#rows').innerText)", timeout=20000)
    return pg, errs

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for live in (True, False):
            d = '' if live else 'demo=1&'; tag = 'live' if live else 'practice'
            pg, errs = await table(b, f'?{d}coalition=ctfh')
            t, c, rows, sw, th = await pg.evaluate(TXT)
            check(t == 'Tobacco-Free Hawaiʻi: health bills', f'{tag}: the coalition by its full public name, not CTFH ({t!r})')
            check('HIPHI’S POSITION' in th.upper() and 'OUR POSITION' not in th.upper(), f'{tag}: the column says whose position ({th!r})')
            check('Comments' not in rows, f'{tag}: no "Comments" chip')
            n0 = int(c.split()[0]) if c else 0
            await pg.fill('#q', 'hb 1573'); await pg.wait_for_timeout(200)
            check('HB 1573' in await pg.inner_text('#rows'), f'{tag}: "hb 1573" with a space finds HB 1573')
            await pg.fill('#q', 'zzzz'); await pg.wait_for_timeout(200)
            check('No bills match' in await pg.inner_text('#rows'), f'{tag}: a search with no match says so')
            check(not errs, f'{tag}: no page errors {errs[:2]}'); await pg.close()
            # 320px: one block a bill, the chip says whose side, nothing sideways.
            pg, _ = await table(b, f'?{d}coalition=ctfh', 320)
            t, c, rows, sw, th = await pg.evaluate(TXT)
            check(sw <= 320, f'{tag}: 320px wide, no sideways scroll ({sw})')
            check('HIPHI strongly supports' in rows or 'HIPHI supports' in rows, f'{tag}: on a phone the chip says HIPHI')
            await pg.close()
            pg, _ = await table(b, f'?{d}coalition=ctfh&position=hide')
            check(await pg.evaluate("!document.querySelector('.chip') && !document.querySelector('.h-pos')"), f'{tag}: position=hide shows no position at all')
            await pg.close()
            pg, _ = await table(b, f'?{d}coalition=nope')
            rows = await pg.inner_text('#rows')
            check('isn’t available right now' in rows and 'get new code' in rows, f'{tag}: an unknown group says so, with the way to new code ({rows[:80]!r})')
            await pg.close()
            pg, _ = await table(b, f'?{d}issue=disposable-e-cigarette-ban')
            t, c, rows, sw, th = await pg.evaluate(TXT)
            check(t == 'Disposable e-cigarette ban' and 'SB 2175' in rows, f'{tag}: an issue table ({t!r}, {c!r})')
            check(await pg.evaluate("document.getElementById('all').href.includes('#/issue/disposable-e-cigarette-ban')"), f'{tag}: its foot link follows the issue')
            await pg.close()
            pg, _ = await table(b, f'?{d}category=tobacco&limit=10')
            t, c, rows, sw, th = await pg.evaluate(TXT)
            check(t.startswith('Tobacco') and c.startswith('Showing 10 of'), f'{tag}: a category table, cut at 10 ({t!r}, {c!r})')
            check(await pg.evaluate("[...document.querySelectorAll('a.num')].every(a => a.href.includes('via=embed') && a.href.includes('#/bill/'))"), f'{tag}: bill links go to the bill page, tagged via=embed')
            await pg.close()
        # The pasted code on a host page: the frame takes the content's height and shrinks after a search (no blank gap).
        ctx = await b.new_context(viewport={'width': 900, 'height': 900}); pg = await ctx.new_page()
        await pg.add_init_script(CLEAN)
        await pg.goto(f'{BASE}/track.html?demo=1#/embed'); await pg.wait_for_selector('#em-code')
        await pg.wait_for_function("document.querySelectorAll('#em-which optgroup').length >= 3", timeout=15000)
        groups = await pg.evaluate("[...document.querySelectorAll('#em-which optgroup')].map(g => g.label)")
        check(groups == ['A HIPHI coalition', 'A topic', 'One issue'], f'the page offers coalitions, topics and issues {groups}')
        await pg.select_option('#em-which', 'coalition:ctfh'); await pg.select_option('#em-limit', '10'); await pg.uncheck('#em-pos')
        code = await pg.input_value('#em-code')
        check('embed.html?coalition=ctfh&limit=10&position=hide' in code and 'demo' not in code, f'the code carries the choices and live data ({code[:120]!r})')
        check('min-height' not in code and 'data-hiphi-tracker' in code, 'the code has no min-height and matches its own frame')
        await pg.click('[data-em-copy]'); await pg.wait_for_timeout(200)
        check('Copied' in await pg.inner_text('.em-said') or 'Select' in await pg.inner_text('.em-said'), 'Copy the code answers')
        host = code.replace('embed.html?', 'embed.html?demo=1&').replace('loading="lazy"', '')
        await pg.goto(f'{BASE}/track.html')   # same origin for the host page
        await pg.evaluate("h => { document.open(); document.write(h); document.close(); }", f'<html><body style="margin:0"><p>Partner page</p>{host}</body></html>')
        await pg.wait_for_function("(() => { const f = document.querySelector('iframe'); return f && f.contentDocument?.querySelector('tr.row') && Math.abs(parseInt(f.style.height) - Math.ceil(f.contentDocument.body.getBoundingClientRect().height)) <= 4; })()", timeout=20000)
        fh = await pg.evaluate("parseInt(document.querySelector('iframe').style.height)")
        inner = await pg.evaluate("Math.ceil(document.querySelector('iframe').contentDocument.body.getBoundingClientRect().height)")
        check(abs(fh - inner) <= 4, f'the frame takes the table\'s own height ({fh} vs {inner})')
        fr = pg.frame_locator('iframe'); await fr.locator('#q').fill('hb 1573'); await pg.wait_for_timeout(600)
        fh2 = await pg.evaluate("parseInt(document.querySelector('iframe').style.height)")
        check(fh2 < fh and fh2 < 300, f'after a search with one result the frame shrinks, no blank gap ({fh} -> {fh2})')
        await ctx.close()
        # Ways in: Every bill HIPHI tracks and This week's asks link to the page.
        ctx = await b.new_context(viewport={'width': 375, 'height': 812}); await ctx.add_init_script(CLEAN); pg = await ctx.new_page()
        await pg.goto(f'{BASE}/track.html?demo=1#/allbills'); await pg.wait_for_timeout(3000)
        check(await pg.evaluate("!!document.querySelector('.ab-embed a[href=\"#/embed\"]')"), 'Every bill HIPHI tracks links to the page')
        await pg.goto(f'{BASE}/track.html?demo=1#/embed'); await pg.wait_for_selector('#em-code')
        check(await pg.evaluate('document.documentElement.scrollWidth') <= 375, 'the page fits a phone')
        await ctx.close(); await b.close()
    print(f'\n{N[0] - len(FAILS)}/{N[0]} passed')
    sys.exit(1 if FAILS else 0)
asyncio.run(main())
