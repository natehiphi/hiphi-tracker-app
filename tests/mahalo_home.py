# The "Mahalo!" page's way to Home (W1-3, R-239): a returning regular can leave the first visit for Home in one tap.
# python3 tests/mahalo_home.py [base_url]   (sandbox; a phone at 390x844, an iPhone SE at 375x667 and a laptop at 1366x900)
# Checks: the page shows "Already know how bills move? Take me to Home" on its first screen, above the bar, whose one
# button is still "Next: A Bill's Story"; Next still goes to the story; "Take me to Home" lands on Home with the first visit done (a reload stays Home)
# and Home still offers the story; no console errors. Screenshots in tests/out/mahalo_home/.
import os, sys
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
def to_thanks(p):
    p.goto(BASE + '?demo=1&codes=0&restart'); past_welcome(p, 15000); p.wait_for_timeout(800)
    p.locator('.st-tile', has_text='Food').first.click(); p.wait_for_timeout(200)
    p.click('[data-stnext]'); p.wait_for_selector('[data-stpick]', timeout=10000); p.wait_for_timeout(800)
    p.click('[data-stnext]'); p.wait_for_selector('.st-alertspage', timeout=10000); p.wait_for_timeout(700)
    p.click('[data-stskip]'); p.wait_for_selector('.st-thanks #st-h', timeout=5000); p.wait_for_timeout(1200)

with sync_playwright() as pw:
    b = pw.chromium.launch()
    for (w, h, tag, dark) in [(390, 844, 'phone', False), (390, 844, 'phone-dark', True), (375, 667, 'se', False), (1366, 900, 'laptop', False)]:
        c, p = ctx(b, w, h, dark); to_thanks(p)
        home = p.locator('[data-sthome]').first
        nxt = p.locator('.st-bar [data-stnext]').first
        ok(home.count() == 1 and home.inner_text().strip() == 'Take me to Home', f'{tag}: the "Mahalo!" page offers "Take me to Home"')
        ok(nxt.inner_text().strip().startswith('Next:'), f'{tag}: Next still names the next part ({nxt.inner_text().strip()})')
        hb, nb = home.bounding_box(), nxt.bounding_box()
        ok(hb and nb and hb['y'] + hb['height'] <= nb['y'], f'{tag}: "Take me to Home" is on the first screen, above the bar')
        ok(p.evaluate("(() => { const e = document.querySelector('[data-sthome]'); return e.scrollWidth <= e.clientWidth + 1; })()"), f'{tag}: its words are not cut off')
        ok(p.locator('.st-bar [data-sthome]').count() == 0, f'{tag}: the bar keeps one button, Next (A-3)')
        p.screenshot(path=os.path.join(OUT, f'thanks-{tag}.png'))
        if tag == 'phone':
            nxt.click(); p.wait_for_timeout(1500)
            ok('/start/' in p.url and p.locator('.st-thanks').count() == 0, 'phone: Next goes on to the story')
            c.close(); c, p = ctx(b, w, h); to_thanks(p)
        if tag in ('phone', 'laptop'):
            p.click('[data-sthome]'); p.wait_for_timeout(1500)
            ok(p.url.endswith('#/') or p.url.endswith('track.html') or '#/' == p.url[-2:], f'{tag}: "Take me to Home" lands on Home ({p.url[-30:]})')
            ok(p.locator('.st').count() == 0, f'{tag}: the first visit is closed')
            p.screenshot(path=os.path.join(OUT, f'home-{tag}.png'))
            p.reload(); p.wait_for_timeout(2500)
            ok('/start/' not in p.url, f'{tag}: a reload stays on Home (the first visit is done)')
        c.close()
    b.close()
ok(not errors, 'no console errors' + (': ' + '; '.join(errors[:3]) if errors else ''))
print('\n'.join(passes + fails)); print(f'\n{len(passes)} passed, {len(fails)} failed'); sys.exit(1 if fails else 0)
