# The first visit ends on the calm Home (R-248, Nate 10/11: "Yes, queue it"). The calm Home used to hand the whole tab to
# the old Home after the first visit, so every new person's first Home was the old one, its wins card included.
# python3 tests/r248_calm_end.py [base]   (base defaults to http://localhost:8832; a phone at 390x844)
# Checks, in the sandbox (March, in session) and on the live path (no ?demo=1, today's real season): the first visit's
# last button lands on the calm Home (#main .cm), not the old one (.hm-fin2); it says "Mahalo for joining in!" (or the
# name) once, with the row of what they did today; no wins card (.hm-wins); the petals play once; after a reload the same
# tab says "Aloha" with no ticks. No page errors.
import os, sys
from playwright.sync_api import sync_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832'
if not BASE.split('?')[0].endswith('.html'): BASE = BASE.rstrip('/') + '/track.html'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out', 'r248'); os.makedirs(OUT, exist_ok=True)
passes, fails, errors = [], [], []
def ok(c, m): (passes if c else fails).append(('PASS ' if c else 'FAIL ') + m)

def ctx(b, w=390, h=844):
    c = b.new_context(viewport={'width': w, 'height': h}, is_mobile=w < 600, has_touch=w < 600, device_scale_factor=2)
    p = c.new_page(); p.on('pageerror', lambda e: errors.append(f'{w}: {e}'))
    return c, p

# From a restart through the first visit to Home, by whatever the screens offer (a topic, Next, Skip, the story's
# first choice); the version that ends on Home (?end=home, everyone's ending) and today's plan.
def walk(p, q):
    p.goto(BASE + q); p.wait_for_selector('.st-tile', timeout=30000); p.wait_for_timeout(800)
    p.locator('.st-tile').first.click(); p.wait_for_timeout(200)
    for _ in range(20):
        if p.locator('#main .cm, #main .hm').count() and p.evaluate("location.hash.replace('#', '') in {'': 1, '/': 1}"): break
        if p.locator('.lx-doors [data-lx-pick]').count() and not p.locator('.lx-doors [aria-pressed="true"]').count(): p.locator('.lx-doors [data-lx-pick]').first.click(); p.wait_for_timeout(700)
        if p.locator('.st-alertspage [data-stskip]').count(): p.click('.st-alertspage [data-stskip]')
        elif p.locator('[data-stnext]:visible').count(): p.locator('[data-stnext]:visible').first.click()
        elif p.locator('[data-stskip]:visible').count(): p.locator('[data-stskip]:visible').first.click()
        p.wait_for_timeout(1300)
    p.wait_for_timeout(1500)

PETALS = "() => { window.__pet = 0; new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => { if (n.classList?.contains('hm-petalfx')) window.__pet++; }))).observe(document, { childList: true, subtree: true }); }"

with sync_playwright() as pw:
    b = pw.chromium.launch()
    for tag, q in (('sandbox', '?demo=1&restart&end=home'), ('live', '?restart&end=home')):
        c, p = ctx(b)
        p.add_init_script(f'({PETALS})()')   # a script's source, so the function is called
        walk(p, q)
        main = p.inner_text('main') if p.locator('main').count() else ''
        ok(p.locator('#main .cm').count() == 1 and p.locator('#main .hm-fin2').count() == 0, f'{tag}: the first visit ends on the calm Home, not the old one')
        h1 = p.locator('#main .cm-head h1').inner_text() if p.locator('#main .cm-head h1').count() else ''
        ok(main.count('Mahalo') == 1 and h1.startswith('Mahalo'), f'{tag}: the greeting says Mahalo, once ({h1!r})')
        ok(p.locator('#main .cm-head .hm-did li').count() >= 1, f'{tag}: with the row of what they did today ({p.locator("#main .hm-did li").count()} ticks)')
        ok(p.locator('#main .hm-wins').count() == 0, f'{tag}: no wins card')
        ok(p.evaluate('window.__pet') == 1, f'{tag}: the petals play once ({p.evaluate("window.__pet")})')
        p.screenshot(path=os.path.join(OUT, f'{tag}_mahalo.png'), full_page=True)
        # A redraw in the same page load (data landing) keeps the greeting and does not replay the petals.
        p.evaluate("window.dispatchEvent(new HashChangeEvent('hashchange'))"); p.wait_for_timeout(800)
        ok(p.evaluate('window.__pet') == 1, f'{tag}: a redraw does not replay the petals')
        p.reload(); p.wait_for_selector('#main .cm, #main .hm', timeout=30000); p.wait_for_timeout(1500)
        # On the slide Home (R-295) the page's h1 is the slide's goal; the greeting is one line above it.
        h1 = p.locator('#main .cm-head :is(h1, .cm-hi)').first.inner_text() if p.locator('#main .cm-head :is(h1, .cm-hi)').count() else ''
        ok(h1.startswith('Aloha') and p.locator('#main .hm-did').count() == 0 and 'Mahalo' not in p.inner_text('main'), f'{tag}: after a reload the same tab says Aloha, no ticks ({h1!r})')
        ok(p.locator('#main .hm-wins').count() == 0 and p.locator('#main .hm-fin2').count() == 0, f'{tag}: still the calm Home after the reload')
        p.screenshot(path=os.path.join(OUT, f'{tag}_reload.png'), full_page=True)
        c.close()
    b.close()

for line in passes + fails: print(line)
for e in errors: print('ERROR', e)
print(f'{len(passes)} passed, {len(fails)} failed, {len(errors)} page errors')
sys.exit(1 if fails or errors else 0)
