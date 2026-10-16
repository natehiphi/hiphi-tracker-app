# The first name is back in the first visit (R-294, Nate 15 Oct): an optional box above the number on the visit's one
# sign-up, in today's version and in every plan (pub/firstname.js).
# python3 tests/r294_join_name.py [base]   (sandbox; base defaults to http://localhost:8832)
# Checks: today's sign-up has "First name (optional, to greet you)" above the number, at 375x667 and 390x664 the small print still ends
# above the pinned button and nothing scrolls (D1-6, R-265); Enter in the name box goes to the number without sending;
# a name and a number give "Mahalo, Leilani!" and the name is kept on this device (hiphi_me) and greets on the last page;
# "Not now" keeps a typed name too; no name gives the plain "Mahalo!" and saves nothing; with codes on the code step hides
# the box and the name survives it; Coming up asks for no name any more; Plans 2 to 5 have the box and Plan 5's
# "Mahalo!" greets by name; a name already known fills the box. No page errors.
import sys, json
from playwright.sync_api import sync_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832'
if not BASE.split('?')[0].endswith('.html'): BASE = BASE.rstrip('/') + '/track.html'
passes, fails, errors = [], [], []
def ok(c, m): (passes if c else fails).append(('PASS ' if c else 'FAIL ') + m)

def ctx(b, w=390, h=844):
    c = b.new_context(viewport={'width': w, 'height': h}, is_mobile=w < 600, has_touch=w < 600)
    p = c.new_page(); p.on('pageerror', lambda e: errors.append(f'{w}x{h}: {e}'))
    return c, p
def me(p): return p.evaluate("JSON.parse(localStorage.getItem('hiphi_me') || '{}').name ?? null")
# Today's version, from a restart to the sign-up (topic Food, its ticked issues followed); alerts_ask.py's walk.
def to_alerts(p, extra=''):
    p.goto(BASE + '?demo=1&restart' + extra); p.wait_for_selector('.st-tile', timeout=20000); p.wait_for_timeout(800)
    p.locator('.st-tile', has_text='Food').first.click(); p.wait_for_timeout(200)
    p.click('[data-stnext]'); p.wait_for_selector('[data-stpick]', timeout=10000); p.wait_for_timeout(800)
    p.click('[data-stnext]'); p.wait_for_selector('.st-alertspage #st-aform', timeout=10000); p.wait_for_timeout(700)
# A plan, from a restart to its sign-up (plans_join.py's walk).
def to_join(p, plan):
    p.goto(f'{BASE}?demo=1&codes=0&restart&ab=onb.{plan}'); p.wait_for_selector('.st-tile, .st-btns', timeout=30000); p.wait_for_timeout(800)
    for _ in range(14):
        if p.locator('#st-aform').count(): break
        if p.title().startswith('What do you care about') and p.locator('.st-tile').count(): p.locator('.st-tile').first.click(); p.wait_for_timeout(200)
        if p.locator('[data-obnot]').count(): p.click('[data-obnot]'); p.wait_for_timeout(1200); continue
        if p.locator('[data-stnext]').count(): p.click('[data-stnext]')
        elif p.locator('[data-stskip]').count(): p.click('[data-stskip]')
        p.wait_for_timeout(1200)
    p.wait_for_timeout(600)
GEOM = """() => { const r = s => { const e = document.querySelector(s); return e ? e.getBoundingClientRect() : null; };
  const n = r('#st-a-name'), ph = r('#st-a-phone'), f = r('.al-fine'), bar = r('.st-bar');
  return { above: !!(n && ph && n.bottom <= ph.top), fine: f && Math.round(f.bottom), bar: bar && Math.round(bar.top), h: Math.round(n ? n.height : 0),
    scroll: document.scrollingElement.scrollHeight - innerHeight }; }"""

with sync_playwright() as pw:
    b = pw.chromium.launch()
    # ---- today's sign-up on small phones: the box fits with the small print above the button ----
    for w, h in ((375, 667), (390, 664)):
        c, p = ctx(b, w, h); to_alerts(p, '&codes=0'); g = p.evaluate(GEOM)
        lab = p.inner_text('label[for="st-a-name"]') if p.locator('label[for="st-a-name"]').count() else ''
        lh = p.evaluate("document.querySelector('label[for=\"st-a-name\"]').getBoundingClientRect().height")
        ok(lab.replace('\n', ' ') == 'First name (optional, to greet you)' and g['above'] and lh < 32, f'{w}x{h}: "First name (optional, to greet you)" sits above the number, on one line ({lh}px)')
        ok(g['fine'] is not None and g['bar'] is not None and g['fine'] <= g['bar'], f'{w}x{h}: the small print ends above the button ({g["fine"]} vs {g["bar"]})')
        ok(g['scroll'] <= 1, f'{w}x{h}: nothing to scroll ({g["scroll"]}px over)')
        ok(g['h'] >= 44, f'{w}x{h}: the name box is a full touch target ({g["h"]}px)')
        c.close()

    # ---- a name and a number: the "Mahalo!" greets them, the name is kept, the last page and Home use it ----
    c, p = ctx(b); to_alerts(p, '&codes=0&fv=full&end=today')
    ok(p.get_attribute('#st-a-name', 'autocomplete') == 'given-name', 'the box tells the phone it is a first name (autofill)')
    p.fill('#st-a-name', '  Leilani   Kahale '); p.press('#st-a-name', 'Enter'); p.wait_for_timeout(300)
    ok(p.evaluate("document.activeElement.id") == 'st-a-phone' and p.locator('.st-thanks').count() == 0 and p.inner_text('#st-a-err').strip() == '', 'Enter in the name box goes to the number, sends nothing and shows no error')
    p.fill('#st-a-phone', '8085550123'); p.click('#st-send'); p.wait_for_selector('.st-thanks #st-h', timeout=8000); p.wait_for_timeout(400)
    ok(p.inner_text('#st-h') == 'Mahalo, Leilani!', f'the "Mahalo!" greets them by first name ({p.inner_text("#st-h")!r})')
    ok(me(p) == 'Leilani Kahale', f'the name is kept on this device, tidied ({me(p)!r})')
    ok(p.evaluate("JSON.parse(localStorage.getItem('hiphi_wiz') || '{}').name") == 'Leilani Kahale', 'and the first visit has it, for the account at sign-in')
    p.click('.actionbar [data-stnext]'); p.wait_for_timeout(1500)
    for _ in range(12):   # through the story to Coming up, then the last page
        if p.locator('.st-soonpage').count(): break
        if p.locator('.lx-doors [data-lx-pick]').count(): p.locator('.lx-doors [data-lx-pick]').first.click(); p.wait_for_timeout(700)
        if p.locator('[data-stnext]').count(): p.click('[data-stnext]')
        p.wait_for_timeout(1200)
    ok(p.locator('.st-soonpage').count() == 1 and p.locator('#st-name, .st-namecard').count() == 0, 'Coming up asks for no name any more')
    p.click('[data-stnext]'); p.wait_for_timeout(2500)
    ok('Leilani' in p.inner_text('main'), 'the last page greets them by name')
    c.close()

    # ---- "Not now" keeps a typed name; no name gives the plain "Mahalo!" and saves nothing ----
    c, p = ctx(b); to_alerts(p, '&codes=0'); p.fill('#st-a-name', 'Kai'); p.click('[data-stskip]'); p.wait_for_timeout(1800)
    ok(me(p) == 'Kai' and p.inner_text('#st-h') == 'Mahalo, Kai!', '"Not now" keeps the name and greets by it')
    c.close()
    c, p = ctx(b); to_alerts(p, '&codes=0'); p.fill('#st-a-phone', '8085550123'); p.click('#st-send'); p.wait_for_selector('.st-thanks #st-h', timeout=8000)
    ok(p.inner_text('#st-h') == 'Mahalo!' and me(p) is None, 'no name: the plain "Mahalo!", and no name saved')
    c.close()

    # ---- codes on: the code step hides the box and the name survives it ----
    c, p = ctx(b); to_alerts(p)
    p.fill('#st-a-name', 'Noe'); p.fill('#st-a-phone', '8085550123'); p.click('#st-send'); p.wait_for_selector('#st-a-code', timeout=8000)
    ok(p.locator('#st-a-name').count() == 0, 'the code step shows only the code')
    p.fill('#st-a-code', '123456'); p.wait_for_timeout(300)
    if not p.locator('.st-thanks').count() and p.locator('#st-send').count(): p.click('#st-send')
    p.wait_for_selector('.st-thanks #st-h', timeout=8000)
    ok(p.inner_text('#st-h') == 'Mahalo, Noe!' and me(p) == 'Noe', 'after the code, the name typed before it greets them and is kept')
    c.close()

    # ---- the plans: the box on every plan's sign-up; Plan 5's "Mahalo!" greets by name ----
    for plan in ('p2', 'p3', 'p4', 'p5'):
        c, p = ctx(b, 375, 667); to_join(p, plan); g = p.evaluate(GEOM)
        ok(p.locator('#st-a-name').count() == 1 and g['above'], f'{plan}: the name box above the number')
        ok(g['fine'] is not None and g['fine'] <= g['bar'], f'{plan} at 375x667: the small print ends above the button ({g["fine"]} vs {g["bar"]})')
        if plan == 'p5':
            p.fill('#st-a-name', 'Malia'); p.fill('#st-a-phone', '8085550123'); p.click('#st-send'); p.wait_for_timeout(2000)
            ok(p.inner_text('#st-h') == 'Mahalo, Malia!' and me(p) == 'Malia', f'p5: "Mahalo, Malia!" and the name kept ({p.inner_text("#st-h")!r})')
        c.close()

    # ---- a name already known fills the box ----
    # (a restart clears the device, so the name is set on the sign-up and the box drawn again by "Use email instead")
    c, p = ctx(b); to_alerts(p, '&codes=0')
    p.evaluate("localStorage.setItem('hiphi_me', JSON.stringify({ name: 'Pua' }))"); p.click('[data-alswap="email"]'); p.wait_for_timeout(400)
    ok(p.input_value('#st-a-name') == 'Pua', 'a name already given fills the box')
    c.close()
    b.close()

print('\n'.join(passes + fails)); print(f'\n{len(passes)} passed, {len(fails)} failed')
if errors: print('errors:', errors[:5])
sys.exit(1 if fails or errors else 0)
