# R-360 part 1: act.html, one bill and one action, in the practice copy (frozen 16 Mar 2026, when HB 2121 has a Senate
# hearing on Fri 20 Mar and testimony is open). Checks the bill screen at a phone's size, the one button, the words, and the
# not-found state; saves screenshots at 390x844 and 320x640.
#   python3 tests/act_screens.py [base] [shots_dir]   base defaults to http://127.0.0.1:8861/act.html?demo=1
import os, sys
from playwright.sync_api import sync_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8861/act.html?demo=1'
SHOTS = sys.argv[2] if len(sys.argv) > 2 else os.environ.get('ACT_SHOTS', '')
res = []
def ok(c, m): res.append(bool(c)); print('PASS' if c else 'FAIL', m)

# Pixel checks wait for the fonts (fonts.load, not fonts.check) and the drawing, or a fallback face measures wider.
FONTS = "async () => { await document.fonts.ready; await document.fonts.load('700 28px Poppins'); await document.fonts.load('400 16px Lato'); return document.fonts.check('700 28px Poppins'); }"
IMGS = "() => [...document.images].every(i => i.complete)"

def open_bill(pg, hash_):
    pg.goto(BASE + hash_)
    pg.wait_for_selector('#main:not([aria-busy]) h1', timeout=60000)
    poppins = pg.evaluate(FONTS)
    pg.wait_for_function(IMGS, timeout=20000)
    return poppins

with sync_playwright() as p:
    br = p.chromium.launch()
    pg = br.new_page(viewport={'width': 390, 'height': 844}); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    poppins = open_bill(pg, '#/HB2121')
    ok(poppins, 'Poppins loaded before measuring')
    h1 = pg.locator('h1')
    ok(h1.is_visible() and h1.inner_text().replace('\n', ' ').strip() == 'Disposable e-cigarette ban', f'the nickname is the heading ({h1.inner_text()!r})')
    ok(pg.locator('.num').inner_text() == 'HB 2121' and 'HIPHI supports' in pg.locator('.pos').inner_text(), 'number and position chip')
    ok(pg.locator('.primary').count() == 1, f'exactly one primary button ({pg.locator(".primary").count()})')
    ok(pg.locator('.primary').inner_text().strip() == 'Send testimony', 'the button is Send testimony while the deadline is open')
    ok(pg.locator('.hd img.art-issue').count() == 1, 'the issue drawing is the header')
    body = pg.locator('body').inner_text()
    ok('Testimony due' in body and 'Hearing Fri, Mar 20' in body, 'the hearing and its deadline are said')
    ok('vape' not in pg.content().lower(), 'the word "vape" is nowhere on the page')
    ok(not any(c in body for c in ('HD1', 'HD2', 'SD1', 'SD2', 'HHS', 'CPN')), 'no version or committee codes in the words')
    sw = pg.evaluate('() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]')
    ok(sw[0] <= sw[1], f'no sideways scroll at 390 ({sw})')
    btn = pg.locator('.primary').bounding_box()
    ok(btn and btn['y'] + btn['height'] <= 844, f'the button is in the first screen at 390x844 (bottom {btn and round(btn["y"] + btn["height"])})')
    if SHOTS: pg.screenshot(path=os.path.join(SHOTS, 'part1-390.png'))
    pg.locator('.primary').click(); pg.wait_for_function("() => location.hash === '#/HB2121/write' && /your letter/.test(document.querySelector('h1')?.textContent || '')", timeout=5000)
    ok(True, 'the button goes to #/HB2121/write and its stand-in')
    pg.go_back(); pg.wait_for_selector('.primary', timeout=5000)
    ok(pg.locator('h1').inner_text().replace('\n', ' ').strip() == 'Disposable e-cigarette ban', 'Back returns to the bill')

    # The tracker's own address form and lower case open the same bill.
    for h in ('#/hb2121', '#/bill/HB2121'):
        open_bill(pg, h); ok('Disposable e-cigarette ban' in pg.locator('h1').inner_text().replace('\n', ' '), f'{h} opens HB 2121')
    # A bill waiting for a hearing offers Email the chair; one that did not advance has no button and says so.
    open_bill(pg, '#/SB2175'); ok(pg.locator('.primary').inner_text().strip() == 'Email the chair', 'SB 2175, waiting for a hearing: Email the chair')
    open_bill(pg, '#/HB10'); ok(pg.locator('.primary').count() == 0 and 'This bill did not advance this year.' in pg.locator('body').inner_text(), 'HB 10, did not advance: no button, a plain line')

    # Not found.
    open_bill(pg, '#/XX0000')
    ok("We can’t find that bill" in pg.locator('h1').inner_text(), 'XX0000: "We can’t find that bill"')
    ok(pg.locator('a[href^="track.html"]').count() == 1, 'with a link to track.html')

    # 320x640.
    pg.set_viewport_size({'width': 320, 'height': 640}); open_bill(pg, '#/HB2121')
    sw = pg.evaluate('() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]')
    ok(sw[0] <= sw[1], f'no sideways scroll at 320 ({sw})')
    if SHOTS: pg.screenshot(path=os.path.join(SHOTS, 'part1-320.png'), full_page=True)
    ok(not errs, f'no page errors {errs[:2]}')
    br.close()

    # The failed load (B-8): the snapshot cannot be fetched, so the page says so and offers Try again.
    br = p.chromium.launch(); pg = br.new_page(viewport={'width': 390, 'height': 844})
    pg.route('**/demo/snapshot.json*', lambda r: r.abort())
    pg.goto(BASE + '#/HB2121'); pg.wait_for_selector('[data-retry]', timeout=20000)
    ok("We couldn’t load this bill" in pg.locator('h1').inner_text(), 'a failed load says "We couldn’t load this bill" with Try again, never "not found"')
    pg.unroute('**/demo/snapshot.json*'); pg.locator('[data-retry]').click(); pg.wait_for_selector('.primary:not([data-retry])', timeout=60000)
    ok('Disposable e-cigarette ban' in pg.locator('h1').inner_text().replace('\n', ' '), 'Try again loads the bill')
    br.close()
print(f"\n{sum(res)} passed, {len(res) - sum(res)} failed")
sys.exit(0 if all(res) else 1)
