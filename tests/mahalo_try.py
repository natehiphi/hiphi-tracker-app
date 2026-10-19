# R-306: the first visit's celebration after the alerts ask (Nate 18 Oct, his pick of five, "Yes make it go live"): the
# whole window becomes the celebration, then folds into a band at the top of A bill's story. Everyone's, live site
# included; the old "Mahalo!" page stays reachable on the practice copy only (?demo=1&mahalo=old) for the review page.
# Checks the fold after Skip and after a number, the band, Back, Change, a tap, Reduce Motion, the old page, and that the
# live site (no demo) gets the fold and never the old page; takes phone pictures.
#   python3 tests/mahalo_try.py [http://localhost:8832/track.html] [out folder]
import sys, os
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832/track.html'
OUT = sys.argv[2] if len(sys.argv) > 2 else '/tmp/r306'
os.makedirs(OUT, exist_ok=True)
passes, fails, errors = [], [], []
def ok(c, m): (passes if c else fails).append(('PASS ' if c else 'FAIL ') + m)

def to_alerts(p, extra):
    p.goto(BASE + '?demo=1&fv=full' + extra); p.wait_for_timeout(400)
    p.evaluate('localStorage.clear(); sessionStorage.clear()')
    p.goto(BASE + '?demo=1&restart&fv=full' + extra); p.wait_for_selector('.st-hellopage, .st-tile', timeout=30000)
    if p.locator('.st-hellopage').count(): p.click('[data-stnext]'); p.wait_for_selector('.st-tile', timeout=30000)
    p.locator('.st-tile').first.click(); p.click('.actionbar [data-stnext]')
    p.wait_for_selector('.st2 [data-stpick]', timeout=30000); p.wait_for_timeout(500)
    p.click('.actionbar [data-stnext]'); p.wait_for_selector('#st-aform', timeout=30000); p.wait_for_timeout(500)

def by_phone(p):
    p.fill('#st-a-name', 'Leilani') if p.locator('#st-a-name').count() else None
    p.fill('#st-a-phone', '8085550123'); p.click('#st-send'); p.wait_for_timeout(900)
    if p.locator('#st-a-code').count():
        p.fill('#st-a-code', '123456'); p.wait_for_timeout(600)
        if p.locator('#st-send').count(): p.click('#st-send')
    p.wait_for_timeout(1800)

def strip_now(p): return p.evaluate("(document.querySelector('.st-chapters li.on .st-cl') || {}).textContent || ''")

with sync_playwright() as pw:
    b = pw.chromium.launch()
    def page():
        c = b.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True, device_scale_factor=2)
        p = c.new_page(); p.on('pageerror', lambda e: errors.append(str(e))); return c, p

    # The old page: practice copy only, ?demo=1&mahalo=old.
    c, p = page(); to_alerts(p, '&mahalo=old'); p.click('[data-stskip]'); p.wait_for_timeout(1500)
    t = p.inner_text('main')
    ok(p.locator('.st-mahalo').count() == 1 and 'You’ll find them on your Home page.' in t and 'Mahalo!' in p.inner_text('#st-h')
       and not p.locator('#st-cover, .st-mhband').count(), 'mahalo=old: the old page, as it was')
    p.screenshot(path=f'{OUT}/old.png'); c.close()

    # Everyone's now: plain ?demo=1 (and the live site) has no page; the band on the story.
    c, p = page(); to_alerts(p, ''); p.click('[data-stskip]'); p.wait_for_timeout(3200)
    ok(p.locator('.st-lesson .st-mhband').count() == 1 and 'We’ll watch' in p.inner_text('.st-mhband') and p.locator('.st-mahalo').count() == 0,
       'Skip lands on the story with the band, no old page')
    ok('Home page' not in p.inner_text('.st-mhband'), 'the band never points to Home before the visit ends')
    ok(p.evaluate("location.hash") == '#/start/4', f'the story’s own address ({p.evaluate("location.hash")})')
    ok(strip_now(p) == 'A bill’s story', f'the strip marks A bill’s story as now ({strip_now(p)!r})')
    p.screenshot(path=f'{OUT}/band-skip.png')
    p.click('.actionbar [data-stnext]'); p.wait_for_timeout(900)
    ok(p.locator('.st-mhband').count() == 0, 'the band leaves on the story’s first Next')
    p.click('[data-stback]'); p.wait_for_timeout(900); p.click('[data-stback]'); p.wait_for_timeout(1500)
    ok(p.locator('.st2').count() == 1, 'Back from the story passes the alerts screen to the issues')
    c.close()
    c, p = page(); to_alerts(p, ''); by_phone(p); p.wait_for_timeout(1200)
    ok('Texts go to' in p.inner_text('.st-mhband') and 'We’ll watch these with\u00a0you, Leilani.' in p.inner_text('.st-mhband'),
       'after a number, the band greets them by name and says where texts go')
    p.screenshot(path=f'{OUT}/band-phone.png')
    p.click('[data-stbandchange]'); p.wait_for_timeout(1500)
    ok(p.locator('#st-aform').count() == 1, 'Change on the band opens the alerts box again')
    c.close()

    # The live site (no demo) gets the fold too, and ?mahalo=old does nothing there.
    c, p = page(); p.goto(BASE + '?mahalo=old'); p.wait_for_timeout(2500)
    live = p.evaluate("async () => { const m = await import(new URL('pub/start.js', location.href).href); return [m.coverOn(), m.mahaloOld()]; }")
    ok(live == [True, False], f'the live site: the fold is on and the old page is not reachable ({live})')
    c.close()

    # The whole window is the celebration, then it folds into the band on the story. Frames for the pictures Nate sees.
    corners = "() => [[2,2],[innerWidth-3,2],[2,innerHeight-3],[innerWidth-3,innerHeight-3],[innerWidth/2,innerHeight-30]].every(([x,y]) => !!document.elementFromPoint(x,y)?.closest('#st-cover'))"
    for w, h, tag in ((390, 844, 'phone'), (1280, 720, 'laptop')):
        c = b.new_context(viewport={'width': w, 'height': h}, is_mobile=w < 600, has_touch=w < 600, device_scale_factor=2 if w < 600 else 1)
        p = c.new_page(); p.on('pageerror', lambda e: errors.append(str(e)))
        to_alerts(p, ''); by_phone(p) if tag == 'laptop' else p.click('[data-stskip]')
        if tag != 'laptop':
            p.wait_for_timeout(900)
            ok(p.evaluate(corners), f'{tag}: the cover fills the whole window, header and bar too')
            p.screenshot(path=f'{OUT}/cover-1-{tag}.png')
            p.wait_for_timeout(950); p.screenshot(path=f'{OUT}/cover-2-folding-{tag}.png')
        p.wait_for_timeout(1500)
        ok(p.locator('#st-cover').count() == 0 and p.locator('.st-lesson .st-mhband:not(.st-mbhold)').count() == 1, f'{tag}: the cover has folded into the band on the story')
        p.screenshot(path=f'{OUT}/cover-3-landed-{tag}.png')
        c.close()
    c, p = page(); to_alerts(p, ''); p.click('[data-stskip]'); p.wait_for_timeout(500)
    p.touchscreen.tap(200, 400); p.wait_for_timeout(1000)
    ok(p.locator('#st-cover').count() == 0 and p.locator('.st-mhband:not(.st-mbhold)').count() == 1, 'a tap folds it at once')
    p.emulate_media(reduced_motion='reduce'); c.close()
    c = b.new_context(viewport={'width': 390, 'height': 844}, reduced_motion='reduce'); p = c.new_page()
    to_alerts(p, ''); p.click('[data-stskip]'); p.wait_for_timeout(600)
    ok(p.locator('#st-cover').count() == 0 and p.locator('.st-mhband:not(.st-mbhold)').count() == 1, 'under Reduce Motion, no cover, the band at once')
    c.close()
    b.close()

for x in passes + fails: print(x)
for e in errors: print('ERROR', e)
print(f'{len(passes)} pass, {len(fails)} fail, {len(errors)} errors')
sys.exit(1 if fails or errors else 0)
