# Getting around (R-238: the A4 picks, Nate 10/10). Public tracker, sandbox, phone and laptop.
#   A4-1 a first visit that arrived on a friend's link: the bill page's Back and the logo lead to Find, the browse
#        page, never into the sign-up; a returning person's Back from a bill opened first goes Home
#   A4-3 search finds a legislator or a committee by name: the header's list ("People and committees") and Find's results
#   A4-4 "/" puts the cursor in the header's box on a laptop (the page stays), in Find's own box on a phone; Find shows one box
#   A4-5 the bill page's Back names the screen behind it (Home, Find, an issue's name)
#   python3 -m http.server 8832   (in this folder, once)
#   python3 tests/getting_around.py [host]
import os, sys
from playwright.sync_api import sync_playwright
TOUR_SEEN = "try{localStorage.setItem('hiphi_tour_bill','1');localStorage.setItem('hiphi_tour_bill_demo','1');localStorage.setItem('hiphi_tour_home','1')}catch(e){}"
HOST = sys.argv[1] if len(sys.argv) > 1 else os.environ.get('HOST', 'http://localhost:8832')
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out', 'getting_around'); os.makedirs(OUT, exist_ok=True)
passes, fails, errors = [], [], []
def ok(c, m): (passes if c else fails).append(('PASS ' if c else 'FAIL ') + m)
def h(p): return p.evaluate('location.hash')
def ctx(b, w, hh):
    c = b.new_context(viewport={'width': w, 'height': hh}, is_mobile=w < 600, has_touch=w < 600)
    c.add_init_script(TOUR_SEEN)
    p = c.new_page(); p.on('pageerror', lambda e: errors.append(f'{w}: {e}'))
    return c, p
def back_text(p): return p.locator('[data-bl-back] span').first.inner_text().strip()

with sync_playwright() as pw:
    b = pw.chromium.launch()
    for w, hh in [(390, 844), (1280, 800)]:
        tag = f'{w}px'; phone = w < 600
        # ---- A4-1: a friend's link, first visit ----
        c, p = ctx(b, w, hh)
        p.goto(f'{HOST}/track.html?demo=1&via=share#/bill/HB1523'); p.wait_for_timeout(3500)
        ok(h(p).startswith('#/bill/HB1523') and p.locator('.bl-head').count() == 1, f'{tag}: the link opens the bill, not the sign-up ({h(p)})')
        ok(p.locator('a.brand').get_attribute('href') == '#/find', f'{tag}: for a link newcomer the logo leads to Find (the browse page)')
        ok(back_text(p) == 'Find', f'{tag}: and Back says Find ("{back_text(p)}")')
        if phone: p.screenshot(path=f'{OUT}/newcomer_bill_{w}.png')
        p.locator('[data-bl-back]').first.click(); p.wait_for_timeout(1200)
        ok(h(p) == '#/find' and p.locator('#q').count() == 1, f'{tag}: Back opens Find, never the sign-up ({h(p)})')
        ok(phone == (p.locator('.tabs').count() == 1 and p.locator('.tabs').is_visible()), f'{tag}: Find has the tab bar on a phone, so "just looking" is possible')
        p.go_back(); p.wait_for_timeout(1200)
        ok(h(p).startswith('#/bill/HB1523'), f'{tag}: the browser\'s Back returns to the bill ({h(p)})')
        p.locator('a.brand').click(); p.wait_for_timeout(1200)
        ok(h(p) == '#/find', f'{tag}: the logo opens Find for a link newcomer ({h(p)})')
        c.close()
        # ---- a returning person (seed=1 follows things): Back from a bill opened first goes Home, and says so ----
        c, p = ctx(b, w, hh)
        p.goto(f'{HOST}/track.html?demo=1&seed=1#/bill/HB1523'); p.wait_for_timeout(3500)
        ok(p.locator('a.brand').get_attribute('href') == '#/', f'{tag}: a returning person\'s logo is Home')
        ok(back_text(p) == 'Home', f'{tag}: Back from a bill opened first says Home ("{back_text(p)}")')
        p.locator('[data-bl-back]').first.click(); p.wait_for_timeout(1200)
        ok(h(p) == '#/' and p.locator('#st-h').count() == 0, f'{tag}: and goes Home ({h(p)})')
        # ---- A4-5: Back names the screen behind it ----
        p.goto(f'{HOST}/track.html?demo=1&seed=1#/'); p.reload(); p.wait_for_timeout(3000)
        p.evaluate("document.querySelector('a[href=\"#/find\"]').click()"); p.wait_for_timeout(900)
        bill = p.locator('#fd-results a[href^="#/bill/"]').first
        if bill.count():
            bill.scroll_into_view_if_needed(); bill.click(); p.wait_for_timeout(1500)
            ok(h(p).startswith('#/bill/') and back_text(p) == 'Find', f'{tag}: from Find, Back says Find ("{back_text(p)}", {h(p)})')
            ok(p.locator('[data-bl-back]').first.get_attribute('aria-label') == 'Back to Find', f'{tag}: a screen reader hears "Back to Find"')
            p.locator('[data-bl-back]').first.click(); p.wait_for_timeout(900)
            ok(h(p) == '#/find', f'{tag}: and returns to Find ({h(p)})')
        else: ok(False, f'{tag}: Find lists no bill to open')
        # an issue's page (Find -> a category -> an issue), then a bill on it: Back names the issue
        p.evaluate("location.hash = '#/find'"); p.wait_for_timeout(1000)
        cat = p.locator('#main a[href^="#/find/category/"]').first; cat.scroll_into_view_if_needed(); cat.click(); p.wait_for_timeout(1000)
        iss = p.locator('#main a[href^="#/issue/"], #main a[href^="#/find/issue/"]').first
        if iss.count():
            iss.scroll_into_view_if_needed(); iss.click(); p.wait_for_timeout(1200)
            name = p.locator('#main h1').first.inner_text().strip()
            bill = p.locator('#main a[href^="#/bill/"]').first
            if bill.count():
                bill.scroll_into_view_if_needed(); bill.click(); p.wait_for_timeout(1500)
                bt = back_text(p)
                ok(bt and bt != 'Back' and (name.startswith(bt.rstrip('…')) or bt in name or name in bt), f'{tag}: from an issue, Back names it ("{bt}" for "{name}")')
                fits = p.evaluate("(() => { const s = document.querySelector('[data-bl-back] span'); const r = s.getBoundingClientRect(); const n = document.querySelector('.bl-num').getBoundingClientRect(); return r.right <= n.left + 1; })()")
                ok(fits, f'{tag}: the name stays beside the number without pushing it')
                if phone: p.screenshot(path=f'{OUT}/back_issue_{w}.png')
                p.locator('[data-bl-back]').first.click(); p.wait_for_timeout(900)
                ok('/issue/' in h(p), f'{tag}: and returns to the issue ({h(p)})')
            else: ok(False, f'{tag}: the issue page lists no bill')
        else: ok(False, f'{tag}: the category lists no issue')
        # ---- A4-4: "/" and one box on Find ----
        p.goto(f'{HOST}/track.html?demo=1&seed=1#/'); p.reload(); p.wait_for_timeout(3000)
        p.keyboard.press('/'); p.wait_for_timeout(400)
        act = p.evaluate("document.activeElement && document.activeElement.id")
        if phone: ok(h(p) == '#/find' and act == 'q', f'{tag}: "/" opens Find with the cursor in its box ({h(p)}, focus {act})')
        else: ok(h(p) == '#/' and act == 'hq', f'{tag}: "/" puts the cursor in the header box and the page stays ({h(p)}, focus {act})')
        p.keyboard.press('Escape'); p.evaluate("document.activeElement.blur()")
        p.evaluate("location.hash = '#/find'"); p.wait_for_timeout(1000)
        ok(p.locator('#hq').count() == 0 and p.locator('#q').count() == 1, f'{tag}: Find shows one search box, its own')
        p.evaluate("document.activeElement.blur()"); p.keyboard.press('/'); p.wait_for_timeout(300)
        ok(p.evaluate("document.activeElement && document.activeElement.id") == 'q' and h(p) == '#/find', f'{tag}: on Find, "/" goes to its box')
        if not phone: p.screenshot(path=f'{OUT}/find_onebox_{w}.png')
        # ---- A4-3: people and committees by name ----
        p.locator('#q').fill('Iwamoto'); p.wait_for_timeout(1500)
        ok(p.locator('#fd-who-h').count() == 1 and p.locator('#fd-who-h').inner_text() == 'People and committees' and p.locator('.fd-who a[href="#/legislator/301"]').count() == 1,
           f'{tag}: Find: "Iwamoto" lists Rep. Kim Coco Iwamoto under People and committees')
        p.locator('#q').fill('TRS'); p.wait_for_timeout(1500)
        ok(p.locator('.fd-who a[href="#/committee/TRS"]').count() == 1, f'{tag}: Find: "TRS" finds the Transportation committee by its code')
        p.locator('#q').fill('health'); p.wait_for_timeout(1500)
        ok(p.locator('.fd-who a[href^="#/committee/"]').count() >= 2, f'{tag}: Find: "health" lists the Health committees ({p.locator(".fd-who a").count()})')
        who = p.locator('.fd-who').first.bounding_box(); mv = p.locator('#fd-mv-h, #fd-law-h').first.bounding_box()
        ok(who and (not mv or who['y'] < mv['y']), f'{tag}: the people come before the bills')
        if phone: p.screenshot(path=f'{OUT}/find_people_{w}.png')
        p.locator('.fd-who a[href^="#/committee/"]').first.click(); p.wait_for_timeout(1200)
        ok(h(p).startswith('#/committee/'), f'{tag}: a committee row opens its page ({h(p)})')
        p.locator('#q').fill('') if p.locator('#q').count() else None
        if not phone:
            p.evaluate("location.hash = '#/more'"); p.wait_for_timeout(1000)
            box = p.locator('#hq'); box.click(); box.fill(''); box.type('Iwamoto', delay=30); p.wait_for_timeout(800)
            groups = p.evaluate("[...document.querySelectorAll('.sg .sg-h')].map(x => x.textContent)")
            ok('People and committees' in groups and p.locator('.sg a[href="#/legislator/301"]').count() == 1, f'{tag}: header: "Iwamoto" suggests the legislator ({groups})')
            p.screenshot(path=f'{OUT}/header_people_{w}.png')
            box.fill(''); box.type('kim', delay=30); p.wait_for_timeout(800)
            opts = p.evaluate("[...document.querySelectorAll('.sg [role=option]')].map(o => o.getAttribute('href'))")
            ok(any(o.startswith('#/legislator/') for o in opts) and len(opts) <= 8, f'{tag}: header: "kim" offers a legislator within seven rows ({opts})')
            box.fill(''); box.type('TRS', delay=30); p.wait_for_timeout(800)
            ok(p.locator('.sg a[href="#/committee/TRS"]').count() == 1, f'{tag}: header: "TRS" suggests the committee')
            p.keyboard.press('ArrowDown'); p.keyboard.press('Enter'); p.wait_for_timeout(1000)
            ok(h(p).startswith('#/committee/') or h(p).startswith('#/issue/') or h(p).startswith('#/find/category/'), f'{tag}: Enter on the first row opens it ({h(p)})')
            box = p.locator('#hq'); box.click(); box.fill(''); box.type('zzqxw', delay=30); p.wait_for_timeout(800)
            ok(p.locator('.sg .sg-note').count() == 1 and p.locator('.sg .sg-note').inner_text().startswith('No issues, bills or legislators match'), f'{tag}: header: nothing matching says so, naming legislators too')
        c.close()
    b.close()
print('\n'.join(passes + fails))
print(f'\n{len(passes)} passed, {len(fails)} failed' + (f'; page errors: {errors}' if errors else ''))
sys.exit(1 if fails or errors else 0)
