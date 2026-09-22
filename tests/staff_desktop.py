# Staff v2: desktop and fix checks (9/19). python3 desk_e2e.py
import json, os, sys, re
from playwright.sync_api import sync_playwright
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import checks
BASE = 'http://localhost:8832/staff.html?demo=1'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out', 'desk_final'); os.makedirs(OUT, exist_ok=True)
ALLOWED = {13, 14, 16, 18, 22}
HEAL = '979b46c2-8bb8-44ee-a5e6-fca6235de48c'   # a coalition whose sandbox week has hearings (R-022)
passes, fails, errors = [], [], []
def ok(c, m): (passes if c else fails).append(('PASS ' if c else 'FAIL ') + m)
def ctx(b, w, h, **kw):
    c = b.new_context(viewport={'width': w, 'height': h}, is_mobile=w < 600, has_touch=w < 600, device_scale_factor=2 if w < 600 else 1, **kw)
    p = c.new_page(); p.on('pageerror', lambda e: errors.append(f'{w}: {e}'))
    p.on('console', lambda m: errors.append(f'console {w}: {m.text[:160]}') if m.type == 'error' and 'favicon' not in m.text else None)
    return c, p
def visit(p, h, wait=2600, extra=''):
    p.goto(BASE + extra + '#' + h.lstrip('#')); p.reload(); p.wait_for_timeout(wait)
H1 = "[...document.querySelectorAll('h1, [role=heading][aria-level=\"1\"]')].filter(e => getComputedStyle(e).display !== 'none' && e.getAttribute('aria-hidden') !== 'true').length"
OVER = "document.documentElement.scrollWidth > innerWidth + 1"
# how much of the page column the content really uses: the right edge of the rightmost visible block in <main>
USED = """(() => { const m = document.querySelector('main'); if (!m) return [0, 0]; const mr = m.getBoundingClientRect(); let right = 0;
  m.querySelectorAll('*').forEach(e => { if (e.offsetParent === null || e.closest('.actionbar')) return; const r = e.getBoundingClientRect(); if (r.width > 40 && r.height > 8 && r.right > right && r.right <= mr.right + 2) right = r.right; });
  return [Math.round(right - mr.left), Math.round(innerWidth)]; })()"""
ROUTES = ['/', '/review', '/bills', '/bills/new', '/bills/memo', '/bills/muted', '/bill/HB1562', '/bill/HB1562/activity', '/bill/HB1562/pathway', '/bill/HB1562/public', '/bill/HB2121',
          '/legislators', '/search?q=vaping', '/outreach', '/outreach/lists', '/outreach/emails', '/email/new', '/me', '/setup', '/help', '/help/keys',
          '/coalition', '/coalition/' + HEAL]
NARROW_OK = {'/review', '/me', '/help', '/help/keys', '/setup', '/bills/memo', '/bills/muted', '/email/new', '/search?q=vaping'}   # focused tasks, forms and reading: a column is right

with sync_playwright() as pw:
    b = pw.chromium.launch()
    for W, H in ((1440, 900), (1280, 800), (1024, 768), (390, 844), (320, 640)):
        c, p = ctx(b, W, H)
        visit(p, '/', 3800)
        leg = p.evaluate("(()=>{ const a=document.querySelector('a[href^=\"#/legislator/\"]'); return a && a.getAttribute('href') })()")
        per = p.evaluate("(()=>{ const a=document.querySelector('a[href^=\"#/person/\"]'); return a && a.getAttribute('href') })()")
        # R-022: one hearing page. Hearing ids change when the snapshot is rebuilt, so take one from HEAL's week.
        visit(p, '/coalition/' + HEAL)
        hr = p.evaluate("(()=>{ const a=document.querySelector('a[href^=\"#/hearing/\"]'); return a && a.getAttribute('href').slice(1).split('?')[0] })()")
        ok(bool(hr), f'coalition@{W}: the HEAL coalition page links a hearing')
        for r in ROUTES + ([hr] if hr else []):
            visit(p, r)
            name = (r.strip('/').replace('/', '_').replace('?', '_').replace('=', '_') or 'today')
            if W in (1440, 390) or (W == 1280 and r in ('/', '/bill/HB1562', '/bills')): p.screenshot(path=f'{OUT}/{W}_{name}.png')
            ok(not p.evaluate(OVER), f'{name}@{W}: no sideways page scroll')
            ok(p.evaluate(H1) == 1, f'{name}@{W}: exactly one exposed h1 ({p.evaluate(H1)})')
            rep = checks.page_report(p, name)
            extra = [s for s in rep['font_sizes'] if round(s) not in ALLOWED]
            ok(not extra, f'{name}@{W}: type sizes {rep["font_sizes"]}')
            ok(not rep['emoji'], f'{name}@{W}: no emoji {rep["emoji"][:3]}')
            if W < 600: ok(not rep['small_targets'], f'{name}@{W}: targets >= 44 {rep["small_targets"][:3]}')
            if W >= 1280 and r not in NARROW_OK:
                used, win = p.evaluate(USED); ok(used >= 900, f'{name}@{W}: the page uses the width ({used}px of content in a {win}px window)')
        if W >= 1100:
            visit(p, '/')
            ok(p.evaluate("getComputedStyle(document.querySelector('.sv-side')).display") != 'none', f'sidebar shows at {W}')
            ok(p.evaluate("getComputedStyle(document.querySelector('.sv-tabs') || document.body).display") in ('none', 'block') and p.locator('.sv-side a[aria-current=page]').count() >= 1, f'sidebar marks the current section at {W}')
        elif W >= 900:
            visit(p, '/'); ok(p.evaluate("getComputedStyle(document.querySelector('.sv-side')).display") == 'none' and p.locator('.sv-hdr .sv-nav a').first.is_visible(), f'header tabs (no sidebar) at {W}')
        else:
            visit(p, '/'); ok(p.locator('.sv-tabs').is_visible() and p.evaluate("getComputedStyle(document.querySelector('.sv-side')).display") == 'none', f'phone frame at {W}')
        c.close()

    # ---- menus open where you clicked, with arrow keys ----
    c, p = ctx(b, 1440, 900); visit(p, '/bill/HB1562', 3000)
    pk = p.locator('.sv-pick').first; box = pk.bounding_box(); pk.click(); p.wait_for_timeout(500)
    d = p.evaluate("(()=>{ const d=document.querySelector('dialog[open]'); if(!d) return null; const r=d.getBoundingClientRect(); return {x:r.left,y:r.top,w:r.width,h:r.height,cls:d.className} })()")
    near = bool(d) and (abs(d['x'] - box['x']) < 40 or abs((d['x'] + d['w']) - (box['x'] + box['width'])) < 40)   # left edges line up, or right edges when it would run off the window
    touching = bool(d) and (0 <= d['y'] - (box['y'] + box['height']) < 40 or 0 <= box['y'] - (d['y'] + d['h']) < 40)   # just under it, or just above when there is no room below
    ok(bool(d) and 'sv-pop' in d['cls'] and near and touching, f'a picker opens against its button ({d})')
    f0 = p.evaluate("document.activeElement.innerText"); p.keyboard.press('ArrowDown'); f1 = p.evaluate("document.activeElement.innerText"); ok(f0 != f1, 'arrow keys move through a picker')
    p.keyboard.press('Escape'); p.wait_for_timeout(600); ok(p.locator('dialog[open]').count() == 0, 'Esc closes it')
    p.locator('[data-avatar]').click(); p.wait_for_timeout(500)
    d2 = p.evaluate("(()=>{ const d=document.querySelector('dialog[open]'); const r=d.getBoundingClientRect(); return {right: Math.round(innerWidth - r.right), top: Math.round(r.top)} })()")
    ok(d2['right'] < 80 and d2['top'] < 140, f'your menu opens by the avatar, not in the middle of the window ({d2})'); p.keyboard.press('Escape'); c.close()

    # ---- fix 1: Approve ----
    c, p = ctx(b, 390, 844); visit(p, '/review', 3000)
    bx = p.locator('[data-approve]').bounding_box(); x, y = bx['x'] + bx['width'] / 2, bx['y'] + bx['height'] / 2
    p.wait_for_timeout(1200); p.touchscreen.tap(x, y); p.wait_for_timeout(450); p.touchscreen.tap(x, y); p.wait_for_timeout(1500)
    ok('2 of 2' in p.inner_text('main'), 'fix 1: a second tap 450ms later approves nothing more'); ok(p.locator('.toastmsg .toastundo').count() == 1, 'fix 1: the approval has Undo')
    p.locator('.toastmsg .toastundo').first.click(); p.wait_for_timeout(1500); ok('1 of 2' in p.inner_text('main'), 'fix 1: Undo brings the item back'); c.close()
    c, p = ctx(b, 1440, 900); visit(p, '/review', 3000); p.keyboard.type('thanks, I can take a look at that', delay=35); p.wait_for_timeout(900)
    ok('1 of 2' in p.inner_text('main'), 'fix 1: a typed sentence approves nothing')
    if p.locator('dialog[open]').count(): p.keyboard.press('Escape'); p.wait_for_timeout(700)
    gap = p.evaluate("(() => { const c=document.querySelector('.td-rvcard').getBoundingClientRect(), a=document.querySelector('[data-approve]').getBoundingClientRect(); return Math.round(a.top - c.bottom) })()"); ok(gap < 140, f'fix 1: Approve sits {gap}px under the card'); c.close()

    # ---- a blocked module says so ----
    c, p = ctx(b, 390, 844); p.route('**/staff/memo.js', lambda r: r.abort()); p.goto(BASE); p.wait_for_timeout(2500)
    ok('could not load' in p.inner_text('#app').lower(), 'a module that never arrives shows "We could not load the tracker"'); c.close()
    b.close()

print('\n'.join(fails)); print(f'{len(fails)} failed, {len(passes)} passed'); print('errors:', errors[:12])
