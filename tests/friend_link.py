# A friend's link (R-212 #34), in the practice copy served locally: the link a friend sent (?via=share, the bill's share
# page) says "A friend asked you" with the deadline, and knows when the ask is done or has passed.
#   F1  a testimony link with testimony open: the card names the ask (the action card below leads with the deadline);
#       the walkthrough opens and says a friend asked, with the deadline
#   F2  the same link after they sent testimony: no walkthrough, and only the action card's "You sent testimony" (no second Mahalo)
#   F3  a testimony link on a bill whose hearing has passed: the card says testimony has closed, no toast, no walkthrough
#   F4  the committee email link: the card names the hearing day; the email walkthrough opens and says "A friend asked you"
#   F5  the same bill opened without ?via=share (an alert or a calendar link): no card, the walkthrough opens as before
#   F6  acting during the visit takes the card away (the Mahalo says it)
#   F7  a laptop: the card tops the side panel
#   python3 tests/friend_link.py [base] [outdir]
import sys, os
from playwright.sync_api import sync_playwright
BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832/').rstrip('/') + '/'
OUT = sys.argv[2] if len(sys.argv) > 2 else '.'
res = []
def ok(c, m): res.append(bool(c)); print('PASS' if c else 'FAIL', m)
def ready(pg):
    pg.wait_for_function("() => !!document.querySelector('main') && !document.querySelector('.skelpage') && !document.querySelector('.bl-skel')", timeout=60000); pg.wait_for_timeout(700)
SKIP = "() => { try { for (const k of ['hiphi_wiz', 'hiphi_wiz_demo']) { const w = JSON.parse(localStorage.getItem(k) || '{}'); localStorage.setItem(k, JSON.stringify({ ...w, done: true, step: 99 })); } for (const k of ['hiphi_tour_bill', 'hiphi_tour_home', 'hiphi_tour_bill_demo', 'hiphi_tour_home_demo']) localStorage.setItem(k, '{\"how\":\"test\"}'); } catch {} }"
MARK = """async ([n, k]) => { const c = await import('./pub/core.js'); const b = [...c.S.bills, ...Object.values(c.S.extra || {})].find(x => x.bill_number.replace(/\\s/g, '') === n);
  const h = c.hearingsOf(b).find(x => new Date(x.scheduled_at) > Date.now()); await c.markDone(b.id, h.id, k, true, { quiet: true }); }"""
OPEN, GONE = 'HB1573', 'HB1563'   # the practice copy's: testimony open over a day; heard, now waiting in the next step
CARD = '.bl-friend'
HP = '#hp-dlg[open]'
def go(pg, num, ask='', share=True):
    pg.goto(BASE + 'track.html?demo=1' + ('&via=share' if share else '') + '#/find'); pg.wait_for_timeout(200)
    pg.goto(BASE + 'track.html?demo=1' + ('&via=share' if share else '') + f'#/bill/{num}' + (f'/{ask}' if ask else '')); pg.reload(); ready(pg); pg.wait_for_timeout(1800)
card = lambda pg: pg.locator(CARD).first.inner_text() if pg.locator(CARD).count() else ''
with sync_playwright() as p:
    br = p.chromium.launch(); errs = []
    def ctx(phone=True):
        c = br.new_context(**({'viewport': {'width': 375, 'height': 812}, 'is_mobile': True, 'has_touch': True} if phone else {'viewport': {'width': 1366, 'height': 800}}))
        c.add_init_script(f"({SKIP})()"); return c
    c = ctx(); pg = c.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(BASE + 'track.html?demo=1#/'); ready(pg)
    go(pg, OPEN, 'testify')
    t = card(pg); hp = pg.locator(HP).count()
    ok(t.strip() == 'A friend asked you to send testimony.', f'F1: the card names the ask ({t!r})')
    ok(hp == 1 and 'A friend asked you to send this · Due' in pg.locator('#hp-dlg .hp-friend').inner_text(), 'F1: the walkthrough opens and says a friend asked, with the deadline')
    pg.screenshot(path=os.path.join(OUT, 'r212_34_walkthrough.png'))
    pg.locator('#hp-dlg [data-hp="close"]').first.click(); pg.wait_for_timeout(500)
    pg.screenshot(path=os.path.join(OUT, 'r212_34_phone_due.png'))
    pg.evaluate(MARK, [OPEN, 'testimony'])
    go(pg, OPEN, 'testify')
    t = card(pg)
    ok(t == '' and pg.locator(HP).count() == 0 and 'You sent testimony' in pg.locator('main').inner_text(), f'F2: after their testimony, no walkthrough and one Mahalo, the card\'s ({t!r})')
    pg.screenshot(path=os.path.join(OUT, 'r212_34_phone_done.png'))
    c.close()
    c = ctx(); pg = c.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
    if GONE:
        go(pg, GONE, 'testify')
        t = card(pg); toast = pg.locator('.toast').count()
        ok('has closed. The bill has moved on' in t and pg.locator(HP).count() == 0, f'F3: a passed hearing: testimony has closed, no walkthrough ({t!r}, toasts {toast})')
        pg.screenshot(path=os.path.join(OUT, 'r212_34_phone_closed.png'))
    else: ok(False, 'F3: no bill with only past hearings in the practice copy')
    go(pg, OPEN, 'email')
    t = card(pg)
    ok(t.startswith('A friend asked you to email the committee.') and 'hears it' in t, f'F4: the email link names the hearing day ({t!r})')
    ok(pg.locator(HP).count() == 1 and 'A friend asked you' in pg.locator('#hp-dlg .hp-friend').inner_text(), 'F4: the email walkthrough opens and says a friend asked')
    c.close()
    c = ctx(); pg = c.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
    go(pg, OPEN, 'testify', share=False)
    ok(card(pg) == '' and pg.locator(HP).count() == 1 and pg.locator('#hp-dlg .hp-friend').count() == 0, 'F5: without ?via=share, no card, the walkthrough opens as before')
    c.close()
    c = ctx(); pg = c.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
    go(pg, OPEN, 'testify')
    pg.locator('#hp-dlg [data-hp="close"]').first.click(); pg.wait_for_timeout(400)
    pg.evaluate(MARK, [OPEN, 'testimony']); pg.evaluate("async () => (await import('./pub/core.js')).app.render()"); pg.wait_for_timeout(500)
    ok(card(pg) == '', f'F6: acting during the visit takes the card away ({card(pg)!r})')
    c.close()
    c = ctx(False); pg = c.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
    go(pg, OPEN, 'testify')
    pg.locator('#hp-dlg [data-hp="close"]').first.click(); pg.wait_for_timeout(500)
    first = pg.evaluate("() => { const s = document.querySelector('.bl-side'); return s && s.firstElementChild && s.firstElementChild.className; }")
    ok('bl-friend' in (first or ''), f'F7: on a laptop the card tops the side panel ({first!r})')
    pg.screenshot(path=os.path.join(OUT, 'r212_34_laptop.png'))
    c.close()
    ok(not errs, f'no page errors ({errs[:2]})')
    br.close()
print(f'{sum(res)}/{len(res)} passed')
sys.exit(0 if all(res) else 1)
