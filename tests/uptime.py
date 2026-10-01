# The published public page, loaded as a phone with the privacy signal set, once an hour from GitHub (uptime.yml,
# R-111): the app must draw within 30 seconds without the "couldn't load" card or a page error, and a bill page, Find and
# the legislators must open. Exit 1 fails the job, and GitHub emails the repository's owner. Nothing is counted.
#   python3 tests/uptime.py [base]      base defaults to https://natehiphi.github.io/hiphi-tracker-app/
import sys
from playwright.sync_api import sync_playwright
BASE = (sys.argv[1] if len(sys.argv) > 1 else 'https://natehiphi.github.io/hiphi-tracker-app/').rstrip('/') + '/'
DRAWN = "() => !!document.querySelector('main') && !document.querySelector('.boot0') && !document.querySelector('.skelpage') && !document.querySelector('.bl-skel')"
SCREENS = [('#/', None), ('#/bill/SB2175', 'SB 2175'), ('#/find?q=vaping', None), ('#/legislators', 'Your legislators')]
fails = []
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx = br.new_context(viewport={'width': 390, 'height': 844})
    ctx.add_init_script("Object.defineProperty(navigator, 'globalPrivacyControl', { value: true });")
    pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
    pg.on('console', lambda m: errs.append('console: ' + m.text[:200]) if m.type == 'error' and 'favicon' not in m.text else None)
    for h, want in SCREENS:
        try:
            pg.goto(BASE + 'track.html' + h); pg.wait_for_function(DRAWN, timeout=30000); pg.wait_for_timeout(500)
            t = pg.locator('main').inner_text()
            if 'couldn’t load' in t: fails.append(f'{h}: the "couldn’t load" card is showing')
            if want and want not in t: fails.append(f'{h}: "{want}" is not on the page')
        except Exception as e:
            fails.append(f'{h}: {str(e)[:200]}')
    if errs: fails.append('page errors: ' + '; '.join(errs[:5]))
    br.close()
print('\n'.join(fails) if fails else f'ok: the published page drew {len(SCREENS)} screens with no error')
sys.exit(1 if fails else 0)
