# R-040: typing in the first visit's address box on a phone keeps the same box and the cursor where it was.
from playwright.sync_api import sync_playwright
import sys
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832/track.html?demo=1#/start/7'
ok = fail = 0
def check(c, m):
    global ok, fail
    print('PASS' if c else 'FAIL', m); ok += c; fail += (not c)
with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True, device_scale_factor=2)
    pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(URL); pg.reload(); pg.wait_for_timeout(2500)
    box = pg.locator('#st-addr')
    check(box.count() == 1, 'the address box is on screen')
    pg.evaluate("window.__box = document.getElementById('st-addr')")
    box.tap()
    pg.keyboard.type('45-600 Keaahala', delay=60)
    pg.wait_for_timeout(900)
    check(pg.evaluate("window.__box === document.getElementById('st-addr')"), 'the same box stays while typing (not rebuilt)')
    check(pg.evaluate("document.activeElement === document.getElementById('st-addr')"), 'focus stays in the box')
    check(box.input_value() == '45-600 Keaahala', 'every letter arrived: ' + box.input_value())
    n = pg.locator('[data-staddrpick]').count() + pg.locator('[data-staddrtyped]').count()
    check(n > 0, f'suggestions appear under the box ({n})')
    # edit in the middle: put the cursor after "45-6", type "1"
    pg.evaluate("document.getElementById('st-addr').setSelectionRange(4, 4)")
    pg.keyboard.type('1')
    pg.wait_for_timeout(500)
    check(box.input_value() == '45-6100 Keaahala', 'a letter typed mid-word lands there: ' + box.input_value())
    check(pg.evaluate("document.getElementById('st-addr').selectionStart") == 5, 'the cursor stays after it, not thrown to the end')
    pg.screenshot(path='tests/out/address_typing_phone.png')
    # picking a suggestion still works
    pg.evaluate("document.getElementById('st-addr').value=''")
    box.fill(''); box.type('415 S Beretania', delay=40); pg.wait_for_timeout(1200)
    first = pg.locator('[data-staddrpick]').first
    if first.count():
        first.tap(); pg.wait_for_timeout(2500)
        check(pg.locator('#st-legs li').count() >= 1, 'picking a suggestion finds the legislators')
    else:
        typedb = pg.locator('[data-staddrtyped]')
        check(typedb.count() == 1, 'the "look up as typed" row is offered')
        typedb.tap(); pg.wait_for_timeout(2500)
        check(pg.locator('#st-legs li').count() >= 1 or pg.locator('.st-info-small').count() >= 1, 'looking up as typed answers')
    pg.screenshot(path='tests/out/address_typing_found.png')
    check(not errs, 'no page errors ' + '; '.join(errs))
    b.close()
print(f'\n{ok} passed, {fail} failed')
