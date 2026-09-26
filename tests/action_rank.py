# R-005: ranking by weight with the committee, behind ?rank=1 until Nate says yes. After a step on a hearing, the
# strongest step still open leads (testimony, email the chair, go in person, share) and "More ways to help" follows the
# same order; a newcomer still starts with the quick email. Without the switch nothing changes. Sandbox, phone.
import sys
from playwright.sync_api import sync_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832/track.html?demo=1'
ok = fail = 0
def check(c, m):
    global ok, fail
    print('PASS' if c else 'FAIL', m); ok += bool(c); fail += (not c)
def setup(pg, url):
    pg.goto(url + '#/start/1'); pg.reload(); pg.wait_for_timeout(3000)
    pg.locator('[data-stissue]').first.click(); pg.locator('[data-stnext]').click(); pg.wait_for_timeout(1800)
    pg.locator('[data-stnext]').click(); pg.wait_for_timeout(1500); pg.locator('#fx-mgo').click(); pg.wait_for_timeout(1200)
    pg.evaluate("sessionStorage.clear()"); pg.goto(url + '#/'); pg.reload(); pg.wait_for_timeout(3500)
    if pg.evaluate("location.hash").startswith('#/start'): pg.evaluate("location.hash = '#/'"); pg.wait_for_timeout(1500)
    return pg.evaluate("[...document.querySelectorAll('[data-card]')].find(e => !e.closest('.hm-fold'))?.dataset.card")
def primary(pg, k):
    return pg.evaluate("""k => { const c = [...document.querySelectorAll('[data-card]')].find(e => e.dataset.card === k); const b = c?.querySelector('.btncol .btn.primary'); return b ? b.textContent.trim() : ''; }""", k)
def rows(pg, k):
    pg.evaluate("""k => { const c = [...document.querySelectorAll('[data-card]')].find(e => e.dataset.card === k); const m = c?.querySelector('[data-moreways]'); if (m && m.getAttribute('aria-expanded') !== 'true') m.click(); }""", k); pg.wait_for_timeout(500)
    return pg.evaluate("""k => { const c = [...document.querySelectorAll('[data-card]')].find(e => e.dataset.card === k); return [...(c?.querySelectorAll('.moreways .mwrow .title') || [])].map(e => e.textContent.trim()); }""", k)
def did(pg, k, kind):
    bid, hid = k.split('|')
    pg.evaluate("""async ([bid, hid, kind]) => { const c = await import('./pub/core.js'); await c.markDone(bid, hid, kind); }""", [bid, hid, kind])
    pg.evaluate("location.hash = '#/find'"); pg.wait_for_timeout(400); pg.evaluate("location.hash = '#/'"); pg.wait_for_timeout(1400)
with sync_playwright() as p:
    br = p.chromium.launch()
    def page():
        ctx = br.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True); return ctx.new_page()
    # 1. ranked, someone who has acted before (seed=1)
    pg = page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    k = setup(pg, BASE + '&seed=1&rank=1')
    check(primary(pg, k).startswith('Write my testimony'), f'ranked, experienced: testimony leads ({primary(pg, k)!r})')
    r = rows(pg, k); check(r[:3] == ['Send a quick email · 2 min', 'Go to the hearing', 'Share with a friend · 1 min'], f'"More ways to help" in order of weight ({r})')
    did(pg, k, 'testimony')
    check(primary(pg, k).startswith('Send a quick email'), f'after testimony, the email to the chair leads ({primary(pg, k)!r})')
    did(pg, k, 'email')
    check(primary(pg, k) == 'Go to the hearing', f'then going in person ({primary(pg, k)!r})')
    did(pg, k, 'attend')
    check(primary(pg, k).startswith('Share with a friend'), f'then sharing ({primary(pg, k)!r})')
    pg.screenshot(path='tests/out/rank_after.png')
    check(not errs, 'no page errors ' + '; '.join(errs))
    # 2. ranked, a newcomer: the quick email still comes first
    pg = page(); k = setup(pg, BASE + '&rank=1')
    check(primary(pg, k).startswith('Send a quick email'), f'ranked, newcomer: the quick email still leads ({primary(pg, k)!r})')
    # 3. without the switch: unchanged (after testimony the main button goes, as today)
    pg = page(); k = setup(pg, BASE + '&seed=1')
    r = rows(pg, k); check(r[:3] == ['Send a quick email · 2 min', 'Share with a friend · 1 min', 'Go to the hearing'], f'switch off: today\'s order ({r})')
    did(pg, k, 'testimony')
    check(primary(pg, k) == '', f'switch off: after testimony no main button, as today ({primary(pg, k)!r})')
    br.close()
print(f'\n{ok} passed, {fail} failed')
