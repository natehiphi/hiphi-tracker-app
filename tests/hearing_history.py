# R-033: a bill page keeps every hearing with its recording. Public: the live database (read-only, as anyone), since
# the sandbox has no videos; Staff v2: the sandbox's "Hearings" list on the Overview tab. Phone and laptop.
import sys, re
from playwright.sync_api import sync_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832/'
ok = fail = 0
def check(c, m):
    global ok, fail
    print('PASS' if c else 'FAIL', m); ok += bool(c); fail += (not c)
with sync_playwright() as p:
    br = p.chromium.launch()
    for w, h, mob in [(390, 844, True), (1280, 800, False)]:
        ctx = br.new_context(viewport={'width': w, 'height': h}, is_mobile=mob, has_touch=mob); pg = ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        # someone who has been here before, so the page is the bill and not the first visit
        pg.goto(BASE + 'track.html#/'); pg.evaluate("localStorage.setItem('hiphi_wiz', JSON.stringify({ done: true }))")
        pg.goto(BASE + 'track.html#/bill/HB1782'); pg.reload(); pg.wait_for_timeout(6000)
        rows = pg.locator('.bl-hr').count()
        watch = pg.locator('.bl-hr a[href*="youtube.com/watch"]')
        part = pg.locator('.bl-hr a', has_text='Watch this bill’s part')
        check(rows >= 7, f'{w} public HB1782: every hearing is listed ({rows}; the 30-day lists had none)')
        check(watch.count() >= 6, f'{w}: with its recording ({watch.count()})')
        check(part.count() >= 1 and re.search(r'[?&]t=\d+s', part.first.get_attribute('href') or ''), f'{w}: "Watch this bill’s part" opens at the minute ({part.count()}, {part.first.get_attribute("href") if part.count() else ""})')
        check(any('t=3308s' in (a.get_attribute('href') or '') for a in watch.all()), f'{w}: the CPC hearing of 19 Feb opens at 55:08, as checked by hand on 9/21')
        pg.screenshot(path=f'tests/out/history_public_{w}.png', full_page=True)
        # staff sandbox
        pg.goto(BASE + 'staff.html?demo=1#/bill/SB2175'); pg.reload(); pg.wait_for_timeout(3500)
        n = pg.locator('.bw-allh .bw-ah').count()
        check(n == 2, f'{w} staff SB2175: the Overview lists every hearing held by the sandbox date, 16 March ({n})')
        check('Hearings' in pg.inner_text('#bw-allh-h') if pg.locator('#bw-allh-h').count() else False, f'{w}: under a "Hearings" heading')
        check(not errs, f'{w}: no page errors ' + '; '.join(errs))
        ctx.close()
    br.close()
print(f'\n{ok} passed, {fail} failed')
