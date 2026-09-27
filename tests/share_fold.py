# R-005: on Home, a two-second Share no longer folds a card into "Done this week" while its testimony is still open;
# an email to the chair (a real step) still does. Sandbox with sample past actions (seed=1); phone.
import sys
from playwright.sync_api import sync_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832/track.html?demo=1&seed=1'
ok = fail = 0
def check(c, m):
    global ok, fail
    print('PASS' if c else 'FAIL', m); ok += bool(c); fail += (not c)
def home_again(pg):
    pg.evaluate("location.hash = '#/find'"); pg.wait_for_timeout(500); pg.evaluate("location.hash = '#/'"); pg.wait_for_timeout(1500)
def state(pg, k):
    return pg.evaluate("""k => ({ open: !!document.querySelector(`.hm-now [data-card="${k}"], .hm-now [data-rowcard="${k}"]`) || [...document.querySelectorAll('[data-card]')].some(e => e.dataset.card === k && !e.closest('.hm-fold')),
      folded: [...document.querySelectorAll('.hm-fold [data-card], .hm-fold a')].some(e => (e.dataset.card || '') === k || (e.getAttribute('href') || '').endsWith(k.split('|')[2] || '#none')) ,
      foldN: (document.querySelector('.hm-foldt')?.textContent || '').match(/\\((\\d+)\\)/)?.[1] || '0' })""", k)
with sync_playwright() as p:
    br = p.chromium.launch(); ctx = br.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True); pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    # Follow the first topic's top issues through the first visit, then come back as a returning visitor.
    pg.goto(BASE + '#/start/1'); pg.reload(); pg.wait_for_timeout(3000)
    pg.locator('[data-stissue]').first.click(); pg.locator('[data-stnext]').click(); pg.wait_for_timeout(1800)
    pg.locator('[data-stnext]').click(); pg.wait_for_timeout(1500); pg.locator('#fx-mgo').click(); pg.wait_for_timeout(1200)
    pg.evaluate("sessionStorage.clear()"); pg.goto(BASE + '#/'); pg.reload(); pg.wait_for_timeout(3500)
    if pg.evaluate("location.hash").startswith('#/start'):   # still inside the first visit: step out of it
        pg.evaluate("location.hash = '#/'"); pg.wait_for_timeout(1500)
    k = pg.evaluate("[...document.querySelectorAll('[data-card]')].find(e => !e.closest('.hm-fold'))?.dataset.card")
    check(bool(k), f'Home has an open card ({k})')
    bid, hid = k.split('|')
    late = pg.evaluate("""async ([bid, hid]) => { const c = await import('./pub/core.js'); const h = [...c.S.hearings].find(x => String(x.id) === hid); return !!c.dueInfo(h)?.late; }""", [bid, hid])
    check(not late, 'its testimony is still open')
    fold0 = state(pg, k)['foldN']
    pg.evaluate("""async ([bid, hid]) => { const c = await import('./pub/core.js'); await c.markDone(bid, hid, 'share'); }""", [bid, hid])
    home_again(pg)
    st = state(pg, k)
    check(st['open'] and st['foldN'] == fold0, f'after only a Share, the card stays open, not in "Done this week" ({st}, before {fold0})')
    check('Shared' in (pg.locator(f'[data-card="{k}"]').first.inner_text() if pg.locator(f'[data-card="{k}"]').count() else ''), 'and it still thanks them for sharing')
    pg.evaluate("""async ([bid, hid]) => { const c = await import('./pub/core.js'); await c.markDone(bid, hid, 'email'); }""", [bid, hid])
    home_again(pg)
    st = state(pg, k)
    check(int(st['foldN']) == int(fold0) + 1, f'after an email to the chair, it folds into "Done this week" ({st}, before {fold0})')
    check(not errs, 'no page errors ' + '; '.join(errs))
    br.close()
print(f'\n{ok} passed, {fail} failed')
