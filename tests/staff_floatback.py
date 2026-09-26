# R-005 (plan wave 6a): on a laptop, a page's own back link comes back pinned under the header once it has scrolled
# away, and pressing it does what the page's link does. Never on a phone. Sandbox; the pages reached by clicking, so
# real Back has somewhere to go.
import sys
from playwright.sync_api import sync_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832/staff.html?demo=1'
ok = fail = 0
def check(c, m):
    global ok, fail
    print('PASS' if c else 'FAIL', m); ok += bool(c); fail += (not c)
FB = "(() => { const f = document.getElementById('sv-floatback'); if (!f || f.hidden) return null; const r = f.getBoundingClientRect(); const h = document.querySelector('.sv-hdr').getBoundingClientRect(); return { text: f.textContent.trim(), top: r.top, hdr: h.bottom, left: r.left }; })()"
# (start page, link to click to reach the page, what the page's back link is)
PAGES = [
    ('#/legislators', 'a[href^="#/legislator/"]', '.lg-deskback'),
    ('#/outreach/issues', 'a[href^="#/issue/"]', '.le-deskback'),
    ('#/outreach/lists', 'a[href^="#/list/"]', '.le-deskback'),
    ('#/coalition', 'a[href^="#/coalition/"]', '.co-deskback'),
    ('#/outreach', 'a[href^="#/person/"]', '.sp-deskback'),
    ('#/', 'a[href^="#/hearing/"]', '.hr-deskback'),
]
# (Help and Session setup are two panes on a laptop: the topic list stays beside the page, so there is no back link.)
with sync_playwright() as p:
    br = p.chromium.launch()
    for w, h in [(1280, 800), (1024, 768)]:
        pg = br.new_page(viewport={'width': w, 'height': h}); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(BASE + '#/'); pg.reload(); pg.wait_for_timeout(3000)
        for start, link, back in PAGES:
            pg.evaluate(f"location.hash = '{start}'"); pg.wait_for_timeout(900)
            a = pg.locator(f'main {link}').first
            if not a.count(): check(False, f'{w} {start}: no link {link}'); continue
            a.scroll_into_view_if_needed(); a.click(); pg.wait_for_timeout(1000)
            page = pg.evaluate('location.hash')
            src = pg.locator(f'main {back}').first
            if not src.count() or not src.is_visible(): check(False, f'{w} {page}: its back link {back} is not shown'); continue
            label = src.inner_text().strip()
            check(pg.evaluate(FB) is None, f'{w} {page}: at the top, only the page\'s own back link')
            tall = pg.evaluate('document.documentElement.scrollHeight - innerHeight')
            if tall < 120: check(True, f'{w} {page}: page too short to scroll, nothing to pin'); continue
            pg.mouse.wheel(0, 2000); pg.wait_for_timeout(500)
            f = pg.evaluate(FB)
            check(f is not None and f['text'] == label, f'{w} {page}: scrolled, "{label}" is pinned ({f and f["text"]})')
            if f: check(f['top'] >= f['hdr'] - 1, f'{w} {page}: pinned under the header, not over it')
            pg.screenshot(path=f'tests/out/floatback_{w}_{start.strip("#/").replace("/", "_")}.png')
            pg.locator('#sv-floatback').click(); pg.wait_for_timeout(1000)
            check(pg.evaluate('location.hash') != page, f'{w} {page}: pressing it leaves the page ({pg.evaluate("location.hash")})')
            check(pg.evaluate(FB) is None, f'{w} {page}: and it goes away there')
        check(not errs, f'{w}: no page errors ' + '; '.join(errs))
        pg.close()
    ctx = br.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True); pg = ctx.new_page()
    pg.goto(BASE + '#/legislators'); pg.reload(); pg.wait_for_timeout(3000)
    pg.locator('main a[href^="#/legislator/"]').first.click(); pg.wait_for_timeout(900)
    pg.mouse.wheel(0, 2000); pg.wait_for_timeout(500)
    check(pg.evaluate(FB) is None, '390: never on a phone (the header has its own back arrow)')
    br.close()
print(f'\n{ok} passed, {fail} failed')
