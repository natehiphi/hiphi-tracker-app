# R-306 (Nate 18 Oct: "Build all three options and let me choose between them after experiencing them"): the three ways
# for the first visit's "Mahalo!" not to read as the end, on the practice copy only (?demo=1&mahalo=a|b|c). Checks each one
# after Skip and after a number, that the live site (no demo) and plain ?demo=1 keep today's page, and takes phone pictures.
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

    # Today's page stays for plain ?demo=1 (and so for the live site, which never has demo).
    c, p = page(); to_alerts(p, ''); p.click('[data-stskip]'); p.wait_for_timeout(1500)
    t = p.inner_text('main')
    ok('You’ll find them on your Home page.' in t and not p.locator('.st-mhpeek, .st-mhauto, .st-mhband').count(), 'without mahalo= the page is today’s')
    p.screenshot(path=f'{OUT}/today.png'); c.close()

    # a: the bridge.
    c, p = page(); to_alerts(p, '&mahalo=a'); p.click('[data-stskip]'); p.wait_for_timeout(2200)
    t = p.inner_text('main')
    ok(p.locator('.st-mha .st-mhpeek').count() == 1 and 'up next' in t.lower() and 'Next, see what could happen' in t and 'Home page' not in p.inner_text('.st-thsub'), 'a: forward words and the story’s bill under them, no Home line')
    ok(strip_now(p) == 'A bill’s story', f'a: the strip marks A bill’s story as now ({strip_now(p)!r})')
    ok(p.evaluate('document.scrollingElement.scrollHeight <= innerHeight + 1'), 'a: the page fits the phone')
    p.screenshot(path=f'{OUT}/a-skip.png')
    p.click('.actionbar [data-stnext]'); p.wait_for_timeout(1500)
    ok(p.locator('.st-lesson').count() == 1, 'a: Next goes to the story')
    c.close()
    c, p = page(); to_alerts(p, '&mahalo=a'); by_phone(p)
    ok('Texts go to' in p.inner_text('main') and p.locator('.st-mhpeek').count() == 1, 'a: after a number, where texts go and the peek')
    p.screenshot(path=f'{OUT}/a-phone.png'); c.close()

    # b: no page; the band on the story.
    c, p = page(); to_alerts(p, '&mahalo=b'); p.click('[data-stskip]'); p.wait_for_timeout(2200)
    ok(p.locator('.st-lesson .st-mhband').count() == 1 and 'Mahalo!' in p.inner_text('.st-mhband'), 'b: Skip lands on the story with the Mahalo band')
    ok(p.evaluate("location.hash") == '#/start/4', f'b: the story’s own address ({p.evaluate("location.hash")})')
    p.screenshot(path=f'{OUT}/b-skip.png')
    p.click('.actionbar [data-stnext]'); p.wait_for_timeout(900)
    ok(p.locator('.st-mhband').count() == 0, 'b: the band leaves on the story’s first Next')
    p.click('[data-stback]'); p.wait_for_timeout(900); p.click('[data-stback]'); p.wait_for_timeout(1500)
    ok(p.locator('.st2').count() == 1, 'b: Back from the story passes the alerts screen to the issues')
    c.close()
    c, p = page(); to_alerts(p, '&mahalo=b'); by_phone(p)
    ok('Texts go to' in p.inner_text('.st-mhband') and 'Mahalo, Leilani!' in p.inner_text('.st-mhband'), 'b: after a number, the band greets them and says where texts go')
    p.screenshot(path=f'{OUT}/b-phone.png')
    p.click('[data-stbandchange]'); p.wait_for_timeout(1500)
    ok(p.locator('#st-aform').count() == 1, 'b: Change on the band opens the alerts box again')
    c.close()

    # c: moves on by itself; Stay here stops it.
    c, p = page(); to_alerts(p, '&mahalo=c'); p.click('[data-stskip]'); p.wait_for_timeout(1200)
    ok(p.locator('#st-mhcount').count() == 1 and strip_now(p) == 'A bill’s story', 'c: the count shows, the strip marks the story as now')
    p.screenshot(path=f'{OUT}/c-skip.png')
    p.wait_for_timeout(6500)
    ok(p.locator('.st-lesson').count() == 1, 'c: the page moves on to the story by itself')
    p.click('[data-stback]'); p.wait_for_timeout(1500)
    ok(p.locator('.st-mahalo').count() == 1 and p.locator('#st-mhcount').count() == 0, 'c: Back finds the page without a count')
    p.wait_for_timeout(7000); ok(p.locator('.st-mahalo').count() == 1, 'c: and it stays')
    c.close()
    c, p = page(); to_alerts(p, '&mahalo=c'); p.click('[data-stskip]'); p.wait_for_timeout(1500)
    p.click('[data-stmhstay]'); p.wait_for_timeout(7000)
    ok(p.locator('.st-mahalo').count() == 1 and p.locator('#st-mhauto').count() == 0, 'c: Stay here stops it')
    c.close()

    # d: no page; the full-screen moment over the story, gone on its own.
    c, p = page(); to_alerts(p, '&mahalo=d'); p.click('[data-stskip]'); p.wait_for_timeout(700)
    ok(p.locator('#fx-moment:not([hidden])').count() == 1 and 'Mahalo!' in p.inner_text('#fx-moment') and p.locator('.st-lesson').count() == 1,
       'd: Skip shows the moment over the story')
    p.screenshot(path=f'{OUT}/d-moment.png')
    p.wait_for_timeout(1800)
    ok(p.locator('#fx-moment:not([hidden])').count() == 0 and p.locator('.st-lesson').count() == 1 and p.locator('.st-mahalo, .st-mhband').count() == 0,
       'd: the moment is gone on its own and the story stays, with no page or band')
    p.screenshot(path=f'{OUT}/d-after.png')
    p.click('[data-stback]'); p.wait_for_timeout(1500)
    ok(p.locator('.st2').count() == 1, 'd: Back from the story passes the alerts screen to the issues')
    c.close()
    c, p = page(); to_alerts(p, '&mahalo=d'); by_phone(p)
    ok(p.locator('.st-lesson').count() == 1 and p.locator('.st-mahalo').count() == 0, 'd: after a number, the story (the moment has come and gone)')
    c.close()
    b.close()

for x in passes + fails: print(x)
for e in errors: print('ERROR', e)
print(f'{len(passes)} pass, {len(fails)} fail, {len(errors)} errors')
sys.exit(1 if fails or errors else 0)
