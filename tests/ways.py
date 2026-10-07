# The test 'act' (R-150, backend 151; pub/variant.js, pub/start-rest.js waysFor/stepWays): the page just before the end of
# the first visit offers three ways to help, one tap each, beside today's "Coming up on your issues".
#   python3 -m http.server 8832   (in this folder, once)
#   python3 tests/ways.py [base]   base defaults to http://localhost:8832
# Checks, on a phone and a laptop, in the practice copy (Monday 16 March 2026, and between sessions):
#   in session, following a topic with hearings: "Three ways to help this week", three cards on three different bills:
#   Write testimony (opens the testimony walkthrough), an email to the chair (Email the committee chair, or Ask the chair for
#   a hearing; opens the email walkthrough), Send it to a friend (shares, then says Done); between sessions with an address:
#   Say aloha to your two legislators (opens the hello letter), Send it to a friend, Why this matters to you (kept, then
#   says so); without an address the first card is Find your legislators, which goes back a step; today's version keeps
#   "Coming up on your issues"; the test is met on that page; Next still goes on; first-visit type sizes (C-14); no
#   sideways scroll; no page errors.
import os, sys
from playwright.sync_api import sync_playwright
BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832').rstrip('/')
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out', 'ways'); os.makedirs(OUT, exist_ok=True)
passes, fails, errors = [], [], []
def ok(c, m): (passes if c else fails).append(('PASS ' if c else 'FAIL ') + m)

def ctx(b, w=390, h=844):
    c = b.new_context(viewport={'width': w, 'height': h}, is_mobile=w < 600, has_touch=w < 600, device_scale_factor=2 if w < 600 else 1,
                      reduced_motion='reduce', permissions=['clipboard-read', 'clipboard-write'])
    p = c.new_page(); p.on('pageerror', lambda e: errors.append(f'{w}: {e}'))
    p.on('console', lambda m: errors.append(f'console {w}: {m.text[:160]}') if m.type == 'error' and 'favicon' not in m.text else None)
    return c, p

def walk(p, ab, extra='', topic='Tobacco', every=True, addr=False, end='today'):
    p.goto(f'{BASE}/track.html?demo=1&restart&ab={ab},end.{end},onb.today{extra}'); p.wait_for_selector('.st-tile', timeout=30000); p.wait_for_timeout(800)
    p.locator('.st-tile', has_text=topic).first.click(); p.wait_for_timeout(300)
    p.click('[data-stnext]'); p.wait_for_selector('[data-stpick]', timeout=15000); p.wait_for_timeout(800)
    if every:   # every issue the topic offers, so it has hearings to act on
        for el in p.locator('[data-stpick]').all():
            try:
                if el.get_attribute('aria-checked') == 'false' or el.get_attribute('aria-pressed') == 'false': el.click(); p.wait_for_timeout(50)
            except Exception: pass
    for _ in range(30):
        if p.locator('.st-soonpage').count(): return True
        if p.locator('#fx-mgo').count(): p.locator('#fx-mgo').click(); p.wait_for_timeout(1200); continue
        if addr and p.locator('#st-addr').count():
            box = p.locator('#st-addr'); box.click(); box.type('415 S Beretania', delay=30); p.wait_for_timeout(1500)
            pick = p.locator('[data-staddrpick]').first
            (pick if pick.count() else p.locator('[data-staddrtyped]').first).click(); p.wait_for_timeout(2500); addr = False; continue
        loc = p.locator('[data-stnext]') if p.locator('[data-stnext]').count() else p.locator('[data-stskip]')
        if loc.count(): loc.first.click()
        p.wait_for_timeout(1300)
    return False

cards = lambda p: p.eval_on_selector_all('.st-way', 'els => els.map(e => e.innerText.split("\\n").filter(Boolean))')
def back_to_page(p):
    # Close a walkthrough (Escape, else the browser's Back) and come back to the page.
    for _ in range(3):
        if p.locator('.st-wayspage').count() and not p.locator('#hp-dlg[open]').count(): return True
        p.keyboard.press('Escape'); p.wait_for_timeout(700)
        if not p.locator('.st-wayspage').count() or p.locator('#hp-dlg[open]').count(): p.go_back(); p.wait_for_timeout(1200)
    return p.locator('.st-wayspage').count() > 0

with sync_playwright() as pw:
    b = pw.chromium.launch()
    for w, h in ((390, 844), (1440, 900)):
        tag = 'phone' if w < 600 else 'laptop'
        # ---- in session ----
        c, p = ctx(b, w, h)
        ok(walk(p, 'act.three'), f'{tag}: the first visit reaches the page before the end')
        ok(p.locator('.st-wayspage').count() == 1 and p.inner_text('#st-h') == 'Three ways to help this week', f'{tag}: "Three ways to help this week" ({p.inner_text("#st-h")})')
        cs = cards(p); titles = [x[0] for x in cs]
        ok(len(cs) == 3, f'{tag}: three cards ({titles})')
        ok(titles[0].startswith('Write testimony') and titles[1].startswith(('Email the committee chair', 'Ask the chair', 'Ask the chairs')) and titles[2].startswith('Ask a friend to speak up'),
           f'{tag}: testimony, an email to the chair, send to a friend ({titles})')
        bills = [x[1].split(':')[0].split(' needs a hearing')[0] for x in cs]
        ok(len(set(bills)) == 3, f'{tag}: three different bills ({bills})')
        ok(p.locator('.st-way .btn.primary').count() == 0 and p.locator('.st-bar [data-stnext]').count() == 1, f'{tag}: the cards are equal, and Next still goes on (A-3, P-5)')
        ok(p.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1"), f'{tag}: no sideways scroll')
        fs = p.evaluate("[...document.querySelectorAll('.st-way b, .st-way > span:nth-child(2) > span')].map(e => parseFloat(getComputedStyle(e).fontSize))")
        ok(min(fs) >= 16, f'{tag}: the cards read at 16px or more (C-14) ({sorted(set(fs))})')
        ok((p.evaluate("JSON.parse(localStorage.getItem('hiphi_ab') || '{}').seen || {}") or {}).get('act', {}).get('arm') == 'three', f'{tag}: the test is met on this page, as "three"')
        p.screenshot(path=os.path.join(OUT, f'{tag}_in.png'))
        if w < 600:
            p.locator('[data-stway="0"]').click(); p.wait_for_timeout(1500)
            ok(p.locator('#hp-dlg[open]').count() > 0 or 'testimony' in p.evaluate('document.body.innerText').lower()[:3000], f'{tag}: Write testimony opens the walkthrough')
            ok(back_to_page(p), f'{tag}: closing the walkthrough comes back to the page')
            p.locator('[data-stway="1"]').click(); p.wait_for_timeout(1500)
            ok(p.locator('#hp-dlg[open]').count() > 0, f'{tag}: the email card opens the email walkthrough')
            ok(back_to_page(p), f'{tag}: and comes back')
            # The share sheet (R-205): no share menu in a headless browser, so the box; Copy message, then Done.
            p.locator('[data-stway="2"]').click(); p.wait_for_selector('dialog.af-sheet[open]', timeout=8000); p.wait_for_timeout(600)
            p.locator('dialog.af-sheet [data-af="copy"]').click(); p.wait_for_timeout(500); p.locator('dialog.af-sheet [data-af="close"]').first.click(); p.wait_for_timeout(900)
            ok(p.locator('.st-way.done').count() == 1 and 'Copied. Paste it in a text or email.' in p.inner_text('.st-way.done'), f'{tag}: Ask a friend opens the share sheet; a copy there marks the card, and it says Copied, not "Sent"')
            p.locator('[data-stnext]').click(); p.wait_for_timeout(2500)
            ok(p.locator('[data-stdone]').count() == 1, f'{tag}: Next goes on to "You\'re all set!"')
            ok('You sent it to a friend' in p.inner_text('.st-did'), f'{tag}: and "Here\'s what you did today" lists it (C-7)')
        c.close()
        # ---- the version that ends on Home: tested beside today's ending only (the review: the same ways twice) ----
        c, p = ctx(b, w, h)
        walk(p, 'act.three', end='home')
        ok(p.locator('.st-wayspage').count() == 0 and p.inner_text('#st-h') == 'Coming up on your issues', f'{tag}: with the ending on Home, today\'s page (no three ways twice)')
        c.close()
        # ---- today's version ----
        c, p = ctx(b, w, h)
        walk(p, 'act.today')
        ok(p.locator('.st-wayspage').count() == 0 and p.inner_text('#st-h') == 'Coming up on your issues', f'{tag}: today\'s version keeps "Coming up on your issues"')
        ok((p.evaluate("JSON.parse(localStorage.getItem('hiphi_ab') || '{}').seen || {}") or {}).get('act', {}).get('arm') == 'today', f'{tag}: and meets the test as "today"')
        c.close()
        # ---- between sessions, with an address ----
        c, p = ctx(b, w, h)
        walk(p, 'act.three', '&season=off', addr=True)
        cs = cards(p); titles = [x[0] for x in cs]
        ok(p.inner_text('#st-h') == 'Three ways to help before January', f'{tag}: between sessions, "Three ways to help before January"')
        ok(titles[0].startswith('Say aloha to your legislators') and 'Sen.' in cs[0][1] and 'Rep.' in cs[0][1] and titles[1].startswith('Ask a friend to follow it') and titles[2] == 'Say why it matters to you',
           f'{tag}: a hello to their two legislators, send to a friend, why it matters ({cs})')
        p.screenshot(path=os.path.join(OUT, f'{tag}_off.png'))
        if w < 600:
            p.locator('[data-stway="0"]').click(); p.wait_for_timeout(1500)
            ok(p.locator('#hp-dlg[open]').count() > 0, f'{tag}: the hello opens the letter to their legislators')
            ok(back_to_page(p), f'{tag}: and comes back')
            p.locator('[data-stway="2"]').click(); p.wait_for_timeout(600)
            ok(p.locator('#st-story').count() == 1 and 'matter to you?' in p.inner_text('.st-waystory label'), f'{tag}: Why this matters opens its field, asking about the issue')
            p.fill('#st-story', 'My nephew started on e-cigarettes at 14.'); p.locator('[data-stway-save]').click(); p.wait_for_timeout(800)
            ok(p.locator('.st-way.done', has_text='Kept for January').count() == 1, f'{tag}: the sentence is kept, and the card says so')
            kept = p.evaluate("Object.values((JSON.parse(localStorage.getItem('hiphi_me_demo') || localStorage.getItem('hiphi_me') || '{}').stories) || {})")
            ok(any('nephew' in x for x in kept), f'{tag}: kept in the profile\'s stories on this device ({kept})')
        c.close()
        # ---- between sessions, no address ----
        c, p = ctx(b, w, h)
        walk(p, 'act.three', '&season=off')
        ok(cards(p)[0][0] == 'Find your legislators', f'{tag}: without an address the first card finds the legislators')
        ok('Pick one if you like' in p.inner_text('.st-wayspage .lede'), f'{tag}: between sessions too, it says none is needed (P-5)')
        if w < 600:
            # A sentence typed and not kept is kept on Next (C-9).
            p.locator('[data-stway="2"]').click(); p.wait_for_timeout(500); p.fill('#st-story', 'Our keiki deserve clean air.')
            p.locator('[data-stnext]').click(); p.wait_for_timeout(1500)
            kept = p.evaluate("Object.values((JSON.parse(localStorage.getItem('hiphi_me_demo') || localStorage.getItem('hiphi_me') || '{}').stories) || {})")
            ok(any('keiki' in x for x in kept), f'{tag}: a sentence typed and not kept is kept on Next (C-9) ({kept})')
            p.go_back(); p.wait_for_timeout(1500)
            p.locator('[data-stway="0"]').click(); p.wait_for_timeout(1500)
            ok(p.locator('#st-addr').count() == 1, f'{tag}: and goes back a step to "Who speaks for you"')
        c.close()
    print('\n'.join(fails) or 'all pass')
    print(f'{len(passes)}/{len(passes) + len(fails)} passed')
    print('errors:', errors[:8])
