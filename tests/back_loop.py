# R-041: Back never traps a person between two pages. Public tracker, sandbox, phone and desktop.
# Walks the loops found 9/26: bill -> a committee member -> "Back to HB ..." -> the bill's Back; bill -> Find your
# legislators -> a legislator -> "Back to ..." -> Back; Find -> category -> issue -> back links, then the browser's Back.
import sys
from playwright.sync_api import sync_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832/track.html?demo=1&seed=1'
ok = fail = 0
def check(c, m):
    global ok, fail
    print('PASS' if c else 'FAIL', m); ok += bool(c); fail += (not c)
def h(pg): return pg.evaluate('location.hash')
with sync_playwright() as p:
    b = p.chromium.launch()
    for vw, vh, mob in [(390, 844, True), (1280, 800, False)]:
        tag = f'{vw}px'
        ctx = b.new_context(viewport={'width': vw, 'height': vh}, is_mobile=mob, has_touch=mob)
        pg = ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        # a returning visitor, so Home is Home (not the first visit)
        pg.goto(BASE + '#/'); pg.reload(); pg.wait_for_timeout(2500)
        pg.goto(BASE + '#/find'); pg.wait_for_timeout(800)
        pg.evaluate("location.hash = '#/bill/HB1782'"); pg.wait_for_timeout(1500)
        start = h(pg)
        # 1. bill -> a committee member (link carries ?from=) -> "Back to HB 1782" -> the bill's Back
        mem = pg.locator('a.bl-mem, a.bl-who').first
        if mem.count():
            mem.scroll_into_view_if_needed(); mem.click(); pg.wait_for_timeout(900)
            check('#/legislator/' in h(pg), f'{tag}: a committee member opens their page ({h(pg)})')
            pg.locator('.pp-back').first.click(); pg.wait_for_timeout(900)
            check(h(pg).startswith('#/bill/HB1782'), f'{tag}: "Back to HB 1782" returns to the bill ({h(pg)})')
            pg.locator('[data-bl-back]').first.click(); pg.wait_for_timeout(900)
            check('#/legislator/' not in h(pg), f'{tag}: the bill page\'s Back does not return to the legislator ({h(pg)})')
        else:
            check(False, f'{tag}: no committee member link on HB1782')
        # 2. the longer loop: bill -> Find your legislators -> a legislator -> "Back to HB ..." -> Back -> Back ...
        pg.evaluate("location.hash = '#/bill/HB1782'"); pg.wait_for_timeout(1200)
        fl = pg.locator('a[href="#/legislators?from=HB1782"]').first   # "Find your own senator and representative"
        if fl.count(): fl.scroll_into_view_if_needed(); fl.click()
        else: pg.evaluate("location.hash = '#/legislators?from=HB1782'")
        pg.wait_for_timeout(900)
        pg.locator('#pp-q').fill('Rhoads'); pg.wait_for_timeout(900)
        pg.locator('[data-pp-sug]').first.click(); pg.wait_for_timeout(900)
        check('#/legislator/' in h(pg), f'{tag}: from the list, a legislator opens ({h(pg)})')
        pg.locator('.pp-back').first.click(); pg.wait_for_timeout(900)
        check(h(pg).startswith('#/bill/HB1782'), f'{tag}: "Back to HB 1782" from a legislator opened via the list ({h(pg)})')
        seen = []
        for i in range(6):   # keep pressing each page's own Back; it must leave the bill/legislator pair
            before = h(pg); seen.append(before)
            if pg.locator('[data-bl-back]').count(): pg.locator('[data-bl-back]').first.click()
            elif pg.locator('[data-back]').count(): pg.locator('[data-back]').first.click()
            else: break
            pg.wait_for_timeout(900)
            if not (h(pg).startswith('#/bill/HB1782') or h(pg).startswith('#/legislator')): break
        seen.append(h(pg))
        check(not (h(pg).startswith('#/bill/HB1782') or h(pg).startswith('#/legislator/')), f'{tag}: pressing Back repeatedly gets out: ' + ' > '.join(seen))
        # 3. Find -> category -> issue -> category back link -> browser Back must not return to the issue page twice
        pg.evaluate("location.hash = '#/find'"); pg.wait_for_timeout(1200)
        cat = pg.locator('a[href^="#/find/category/"]').first; cat.scroll_into_view_if_needed(); cat.click(); pg.wait_for_timeout(1000)
        chref = h(pg)
        iss = pg.locator('a[href^="#/issue/"]').first; iss.scroll_into_view_if_needed(); iss.click(); pg.wait_for_timeout(1000)
        ihref = h(pg)
        pg.locator('.fd-back').first.click(); pg.wait_for_timeout(900)
        check(h(pg) == chref, f'{tag}: the issue page\'s back link returns to its category ({h(pg)})')
        pg.go_back(); pg.wait_for_timeout(900)
        check(h(pg) != ihref, f'{tag}: the browser\'s Back then does not bounce into the issue page again ({h(pg)})')
        check(not errs, f'{tag}: no page errors ' + '; '.join(errs))
        ctx.close()
    b.close()
print(f'\n{ok} passed, {fail} failed')
