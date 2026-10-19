# The old "Mahalo!" page after the alerts ask, kept on the practice copy as ?demo=1&mahalo=old since R-306 made the
# fold everyone's (Nate 18 Oct); the fold's own checks are tests/mahalo_try.py. (R-298, Nate 17 Oct: "a very warm animation" again, not "a cold page with way
# too much text"). It was W1-3's test of "Take me to Home" (R-239), which Nate dropped from the page on 17 Oct.
# python3 tests/mahalo_home.py [base_url]   (sandbox; a phone at 390x844, an iPhone SE at 375x667 and a laptop at 1366x900)
# Checks, after a number and its code and after Skip: the big flower and its drifting petals as the page arrives (none
# under Reduce Motion, and the petals gone by 3.4 s); "Mahalo, <name>!" or "Mahalo!", "You're following N issues." and at
# most one more sentence; "Texts go to <number> · Change" only when a number was given, and Change opens the box again;
# no "Take me to Home", no card, no sign-in or STOP lines; everything on the first screen above the bar, whose one button
# is "Next: A Bill's Story" and goes to the story; Back finds the page again without replaying the flower; no console
# errors. Screenshots in tests/out/mahalo_home/.
import os, re, sys
from playwright.sync_api import sync_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832/track.html'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out', 'mahalo_home'); os.makedirs(OUT, exist_ok=True)
passes, fails, errors = [], [], []
# R-297: a first visit opens on the welcome (#/start/0); Let's begin goes on to the topics.
def past_welcome(p, t=30000):
    p.wait_for_selector('.st-hellopage, .st-tile, .st-issue', timeout=t)
    if p.locator('.st-hellopage').count(): p.click('[data-stnext]'); p.wait_for_selector('.st-tile, .st-issue', timeout=t); p.wait_for_timeout(600)
def ok(c, m): (passes if c else fails).append(('PASS ' if c else 'FAIL ') + m)

def ctx(b, w, h, dark=False):
    c = b.new_context(viewport={'width': w, 'height': h}, is_mobile=w < 600, has_touch=w < 600, device_scale_factor=2 if w < 600 else 1,
                      color_scheme='dark' if dark else 'light')
    p = c.new_page(); p.on('pageerror', lambda e: errors.append(f'{w}: {e}'))
    p.on('console', lambda m: errors.append(f'console {w}: {m.text[:160]}') if m.type == 'error' and 'favicon' not in m.text else None)
    return c, p
def to_thanks(p, number=False):
    p.goto(BASE + '?demo=1&codes=1&restart&mahalo=old'); past_welcome(p, 15000); p.wait_for_timeout(800)
    p.locator('.st-tile', has_text='Food').first.click(); p.wait_for_timeout(200)
    p.click('[data-stnext]'); p.wait_for_selector('[data-stpick]', timeout=10000); p.wait_for_timeout(800)
    p.click('[data-stnext]'); p.wait_for_selector('.st-alertspage', timeout=10000); p.wait_for_timeout(700)
    if number:
        if p.locator('#st-a-name').count(): p.fill('#st-a-name', 'Leilani')
        p.fill('#st-a-phone', '(808) 555-0123'); p.click('#st-send'); p.wait_for_selector('#st-a-code', timeout=5000)
        p.type('#st-a-code', '123456')
    else: p.click('[data-stskip]')
    p.wait_for_selector('.st-mahalo #st-h', timeout=6000)
words = lambda p: p.inner_text('.st-mahalo .st-intro').replace('\xa0', ' ')

with sync_playwright() as pw:
    b = pw.chromium.launch()
    for (w, h, tag, dark) in [(390, 844, 'phone', False), (390, 844, 'phone-dark', True), (375, 667, 'se', False), (1366, 900, 'laptop', False)]:
        for number in (True, False):
            k = f'{tag}{"" if number else " (Skip)"}'
            c, p = ctx(b, w, h, dark); to_thanks(p, number)
            ok(p.locator('.st-mahalo.st-thanksnew .fx-bloom').count() == 1 and p.locator('.fx-drift svg').count() == 6, f'{k}: the flower opens and six petals drift as the page arrives')
            p.wait_for_timeout(3800)
            ok(p.evaluate("[...document.querySelectorAll('.fx-drift svg')].every(e => getComputedStyle(e).opacity === '0')"), f'{k}: the petals are gone by 3.4 s; the flower rests')
            t = words(p)
            ok(p.inner_text('#st-h') == ('Mahalo, Leilani!' if number else 'Mahalo!'), f'{k}: the heading ({p.inner_text("#st-h")!r})')
            ok(re.search(r'You’re following \d+ issues?\.', t), f'{k}: "You’re following N issues."')
            for gone in ('Take me to Home', 'sign in', 'STOP', 'sandbox', 'bills this session', 'profile is saved'):
                ok(gone.lower() not in t.lower(), f'{k}: no "{gone}" on the page')
            ok(p.locator('.st-mahalo .card, [data-sthome]').count() == 0, f'{k}: no card and no way to Home on the page')
            if number:
                ok('Texts go to (808) 555-0123' in t and p.locator('.st-mhwhere [data-stalchange]', has_text='Change').count() == 1, f'{k}: one small line, "Texts go to (808) 555-0123 · Change"')
            else:
                ok(p.locator('.st-mhwhere').count() == 0, f'{k}: no number line after Skip')
            nxt = p.locator('.actionbar [data-stnext]').first
            ok(nxt.inner_text().strip() == 'Next: A Bill’s Story', f'{k}: the one button is "Next: A Bill’s Story"')
            last = p.locator('.st-mahalo .st-intro > *').last.bounding_box(); nb = nxt.bounding_box()
            ok(last and nb and last['y'] + last['height'] <= nb['y'] + 1, f'{k}: everything is on the first screen, above the button')
            ok(p.evaluate("document.documentElement.scrollWidth <= innerWidth"), f'{k}: nothing wider than the screen')
            p.screenshot(path=os.path.join(OUT, f'thanks-{tag}{"" if number else "-skip"}.png'))
            if tag == 'phone' and number:
                p.click('.st-mhwhere [data-stalchange]'); p.wait_for_timeout(600)
                ok(p.locator('#st-a-phone').count() == 1, f'{k}: Change opens the number box again')
                c.close(); c, p = ctx(b, w, h); to_thanks(p, True); p.wait_for_timeout(1500)
                p.locator('.actionbar [data-stnext]').click(); p.wait_for_selector('.lx-count', timeout=10000); p.wait_for_timeout(600)
                ok(p.url.endswith('#/start/4'), f'{k}: Next goes on to the story')
                p.click('[data-stback]'); p.wait_for_selector('.st-mahalo', timeout=5000); p.wait_for_timeout(400)
                ok(p.locator('.st-thanksnew').count() == 0 and p.locator('.fx-drift').count() == 0, f'{k}: Back finds the page with the flower open, nothing replayed')
            c.close()
    c = b.new_context(viewport={'width': 390, 'height': 844}, reduced_motion='reduce'); p = c.new_page(); to_thanks(p, True)
    ok(p.evaluate("[...document.querySelectorAll('.fx-drift')].every(e => getComputedStyle(e).display === 'none')"), 'Reduce Motion: no drifting petals')
    c.close(); b.close()
ok(not errors, 'no console errors' + (': ' + '; '.join(errors[:3]) if errors else ''))
print('\n'.join(passes + fails)); print(f'\n{len(passes)} passed, {len(fails)} failed'); sys.exit(1 if fails else 0)
