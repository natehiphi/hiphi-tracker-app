# The bill page in layout 3 (R-302, Nate's pick 10/18), behind ?rec=1 until his look.
#   python3 tests/r302_rec.py [base]      base defaults to http://localhost:8832
# Checks, at phone and laptop size, on HB 1563 (waiting for a hearing) and HB 1780 (hearing Wednesday): the order (name,
# action card, Where it is now, three closed cards), the main button inside the action card, no page errors; on a phone the
# button docks only once the card has scrolled away, and a card opened stays open after a reload (hiphi_recfold). With
# ?rec=0 the page is the old one (the stance card is still there): the redesign is everyone's since 19 Oct (R-303), and
# ?rec=0 is the way back, so it stays guarded.
import sys, asyncio
from playwright.async_api import async_playwright

BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832').rstrip('/')
ok = fail = 0
def check(cond, what):
    global ok, fail
    if cond: ok += 1; print('PASS', what)
    else: fail += 1; print('FAIL', what)

ORDER = """() => { const q = s => document.querySelector(s); const els = ['.bl-rhead', '.bl-ract, .bl-act', '.bl-rwhere', '.bl-rfolds'].map(q);
  if (els.some(e => !e)) return 'missing: ' + els.map(e => !!e).join(',');
  for (let i = 1; i < els.length; i++) if (els[i - 1].compareDocumentPosition(els[i]) & Node.DOCUMENT_POSITION_PRECEDING) return 'out of order at ' + i;
  return 'ok'; }"""

async def main():
    async with async_playwright() as p:
        br = await p.chromium.launch()
        for w, h, tag in [(375, 812, 'phone'), (1280, 900, 'laptop')]:
            for num in ['HB1563', 'HB1780']:
                ctx = await br.new_context(viewport={'width': w, 'height': h})
                pg = await ctx.new_page(); errs = []
                pg.on('pageerror', lambda e: errs.append(str(e)))
                await pg.goto(f'{BASE}/track.html?demo=1&rec=1#/bill/{num}')
                await pg.wait_for_selector('.bl-rec .bl-rwhere', timeout=40000)
                await pg.wait_for_timeout(800)
                check(await pg.evaluate(ORDER) == 'ok', f'{tag} {num}: name, action, where it is, then the cards')
                check(await pg.evaluate("!!document.querySelector('.bl-ract .btn.primary, .bl-act .btn.primary')"), f'{tag} {num}: the main button is in the action card')
                # R-303: a fourth closed card, Others following this bill, when a group number reaches 10 people
                check(await pg.evaluate("[...document.querySelectorAll('.bl-rfold')].map(d => d.dataset.blRfold + (d.open ? '+' : '')).join()") in ('who,about,more', 'who,about,more,others'), f'{tag} {num}: three cards (four with Others following), closed on a first visit')
                check(await pg.evaluate("!document.querySelector('.bl-newbie') && ![...document.querySelectorAll('.bl-others')].some(e => !e.closest('.bl-rfold[data-bl-rfold=others]'))"), f'{tag} {num}: no New here card; Others following only inside its closed card')
                check(await pg.evaluate("(() => { const s = document.querySelector('.bl-rstance'), a = document.querySelector('.bl-ract, .bl-act'); return !!s && !!(a.compareDocumentPosition(s) & Node.DOCUMENT_POSITION_FOLLOWING); })()"), f'{tag} {num}: Where do you stand? comes after the action card (R-303)')
                if w < 800:
                    check(not await pg.evaluate("document.body.classList.contains('bl-docked')"), f'{num}: no docked button while the card is in view')
                    await pg.evaluate("window.scrollTo(0, 1200)"); await pg.wait_for_timeout(300)
                    check(await pg.evaluate("document.body.classList.contains('bl-docked') && !!document.querySelector('.actionbar .btn.primary')"), f'{num}: the button docks once the card has scrolled away')
                    await pg.evaluate("window.scrollTo(0, 0)")
                    await pg.click('.bl-rfold[data-bl-rfold=who] > summary'); await pg.wait_for_timeout(200)
                    await pg.reload(); await pg.wait_for_selector('.bl-rec .bl-rwhere', timeout=40000)
                    check(await pg.evaluate("document.querySelector('.bl-rfold[data-bl-rfold=who]').open && !document.querySelector('.bl-rfold[data-bl-rfold=about]').open"), f'{num}: Who decides next stays open on coming back')
                else:
                    check(await pg.evaluate("!!document.querySelector('.bl-side .bl-ract, .bl-side .bl-act')"), f'{num}: the action card is in the side panel')
                check(not errs, f'{tag} {num}: no page errors {errs[:2]}')
                await ctx.close()
        ctx = await br.new_context(viewport={'width': 375, 'height': 812}); pg = await ctx.new_page()
        await pg.goto(f'{BASE}/track.html?demo=1&rec=0#/bill/HB1780'); await pg.wait_for_selector('.bl-page .bl-head', timeout=40000)
        check(await pg.evaluate("!document.querySelector('.bl-rec') && !!document.querySelector('.bl-stance')"), 'with ?rec=0 the page is the old one')
        await br.close()
    print(f'\n{ok} passed, {fail} failed'); sys.exit(1 if fail else 0)
asyncio.run(main())
