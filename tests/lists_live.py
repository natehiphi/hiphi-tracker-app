# R-013 on the live data path (no sandbox), signed out: the sheet asks for an email instead of making a list and says the
# person comes back to the bill; "Add my email" keeps the place and the sign-in page says so; once signed in the place is
# taken once; a link that leads nowhere says so (the real shared_user_list function, as the public key).
#   python3 tests/lists_live.py [base]      base defaults to http://localhost:8832/track.html (live data, signed out; nothing is written)
import sys
from playwright.sync_api import sync_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832/track.html'
res = []
def ok(c, m): res.append(bool(c)); print('PASS' if c else 'FAIL', m)
with sync_playwright() as p:
    br = p.chromium.launch(); ctx = br.new_context(viewport={'width': 1280, 'height': 900})
    ctx.add_init_script("() => { try { localStorage.setItem('hiphi_wiz', JSON.stringify({ done: true, step: 99 })); localStorage.setItem('hiphi_tour_bill', '1'); localStorage.setItem('hiphi_tour_home', '1'); } catch {} }")
    pg = ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(BASE + '#/bill/HB10'); pg.wait_for_function("() => !!document.querySelector('[data-bl-addto]')", timeout=60000)
    pg.locator('[data-bl-addto]').first.click(); pg.wait_for_timeout(400)
    d = pg.locator('dialog.ul-sheet[open]')
    ok(d.count() == 1 and d.locator('[data-ulsignin]').count() == 1, 'signed out, the sheet asks for an email: ' + (d.inner_text()[:120].replace('\n', ' ') if d.count() else ''))
    ok('come back to this bill' in d.inner_text(), 'and says the link brings them back to this bill')
    d.locator('[data-ulsignin]').click(); pg.wait_for_timeout(500)
    a = pg.evaluate("JSON.parse(localStorage.getItem('hiphi_after_signin') || 'null')")
    ok(a and a.get('hash') == '#/bill/HB10' and a.get('then', {}).get('addto'), f'Add my email keeps the place: {a and a.get("hash")}, then add to a list')
    ok(pg.url.endswith('#/signin') and pg.locator('.mr-back').count() == 1, 'the sign-in page says they come back to where they were: ' + (pg.locator('.mr-back').inner_text() if pg.locator('.mr-back').count() else ''))
    got = pg.evaluate("async () => { const c = await import('./pub/core.js'); const m = await import('./pub/mylists.js'); const was = c.S.user; c.S.user = { id: 'test' }; const a = m.takePlace(); const again = m.takePlace(); c.S.user = was; return [a && a.hash, again]; }")
    ok(got[0] == '#/bill/HB10' and got[1] is None, f'once signed in the place is taken, once: {got}')
    pg.goto(BASE + '#/l/' + '0' * 40); pg.wait_for_function("() => !document.querySelector('.skelpage') && !!document.querySelector('main h1')", timeout=60000)
    ok('isn’t available' in pg.locator('main').inner_text(), 'a link to no list says it is not available (the real function, as the public)')
    ok(not errs, f'no page errors {errs[:2]}')
    br.close()
print(f"\n{sum(res)} passed, {len(res) - sum(res)} failed")
