# R-005: the staff bill page's team note. Saving shows Undo, which puts the previous note back; a note typed and not
# saved makes the browser ask before a reload. Sandbox (nothing is saved), phone and laptop.
import sys
from playwright.sync_api import sync_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832/staff.html?demo=1'
ok = fail = 0
def check(c, m):
    global ok, fail
    print('PASS' if c else 'FAIL', m); ok += bool(c); fail += (not c)
def save(pg):
    pg.evaluate("document.querySelector('[data-savenote]').scrollIntoView({ block: 'center' })"); pg.locator('[data-savenote]').click()
with sync_playwright() as p:
    br = p.chromium.launch()
    for w, h, mob in [(390, 844, True), (1280, 800, False)]:
        ctx = br.new_context(viewport={'width': w, 'height': h}, is_mobile=mob, has_touch=mob); pg = ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(BASE + '#/bill/SB2175'); pg.reload(); pg.wait_for_timeout(3000)
        note = pg.locator('#bw-note'); note.scroll_into_view_if_needed()
        note.fill('First note'); save(pg); pg.wait_for_timeout(600)
        check(pg.locator('#bw-note').input_value() == 'First note', f'{w}: the first note is saved')
        pg.locator('#bw-note').fill('Second note'); save(pg); pg.wait_for_timeout(600)
        undo = pg.locator('.toastmsg .toastundo')
        check(undo.count() == 1 and 'Note saved' in pg.locator('.toastmsg').inner_text(), f'{w}: "Note saved." comes with Undo')
        undo.click(); pg.wait_for_timeout(700)
        check(pg.locator('#bw-note').input_value() == 'First note', f'{w}: Undo puts the previous note back ({pg.locator("#bw-note").input_value()!r})')
        check('put back' in pg.locator('.toastmsg').inner_text(), f'{w}: and says so')
        # unsaved text: a reload asks first
        pg.locator('#bw-note').fill('Typed, not saved')
        asked = []
        pg.on('dialog', lambda d: (asked.append(d.type), d.dismiss()))
        pg.evaluate('1'); pg.mouse.click(5, 300)   # a user gesture, which browsers need before they will ask
        try: pg.reload(timeout=4000)
        except Exception: pass
        pg.wait_for_timeout(800)
        check('beforeunload' in asked, f'{w}: a reload with an unsaved note asks first ({asked})')
        check(pg.locator('#bw-note').count() == 0 or pg.locator('#bw-note').input_value() == 'Typed, not saved', f'{w}: staying keeps the typed note')
        # saved: no question
        save(pg); pg.wait_for_timeout(600)
        asked.clear()
        pg.reload(); pg.wait_for_timeout(2500)
        check(not asked, f'{w}: once saved, a reload does not ask ({asked})')
        check(not errs, f'{w}: no page errors ' + '; '.join(errs))
        ctx.close()
    br.close()
print(f'\n{ok} passed, {fail} failed')
