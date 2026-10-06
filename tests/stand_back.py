# R-166 (Nate 10/5): "Where do you stand?" in the testimony and email walkthroughs, after an answer. Choosing one moves on;
# Back to it showed the answer chosen with only Close under it, so the way on was to tap the chosen answer again. Now a
# chosen answer brings Next, which keeps it; with nothing chosen there is still no Next (the three answers are the buttons).
# Sandbox (HB 1523, no stance on the bill), phone and laptop.
#   python3 tests/stand_back.py [base]     base defaults to http://localhost:8832/track.html?demo=1
import sys
from playwright.sync_api import sync_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832/track.html?demo=1'
res = []
def ok(c, m): res.append(bool(c)); print('PASS' if c else 'FAIL', m)
SKIP = "() => { try { for (const s of ['', '_demo']) { localStorage.setItem('hiphi_wiz' + s, JSON.stringify({ done: true, step: 99 })); localStorage.setItem('hiphi_tour_bill' + s, '{\"how\":\"test\"}'); localStorage.setItem('hiphi_tour_home' + s, '{\"how\":\"test\"}'); } } catch {} }"
FIND = """async () => { const c = await import('./pub/core.js'); const b = c.D.bills.find(x => x.bill_number === 'HB1523');
  const h = c.D.hearings.filter(x => x.bill_id === b.id && new Date(x.scheduled_at) > Date.now()).sort((a, z) => a.scheduled_at.localeCompare(z.scheduled_at))[0];
  return { b: b.id, h: h.id }; }"""
OPEN = """async ([t, mode]) => { const c = await import('./pub/core.js'); c.S.helper = null; c.S.stances = {};
  try { const k = Object.keys(localStorage).find(k => /hiphi_me/.test(k)); if (k) { const m = JSON.parse(localStorage.getItem(k) || '{}'); delete m.mail; delete m.drafts; localStorage.setItem(k, JSON.stringify(m)); } } catch {}
  if (mode === 'testimony') c.app.openHelper(t.b, t.h); else c.app.openMail({ mode: 'email', hearing: t.h, bill: t.b }); }"""
head = lambda pg: pg.locator('#hp-dlg #hp-sh').inner_text() if pg.locator('#hp-dlg #hp-sh').count() else ''
nxt = lambda pg: pg.locator('#hp-dlg .hp-foot [data-hp="next"]')

with sync_playwright() as p:
    br = p.chromium.launch()
    for w, h, tag in ((390, 844, 'phone'), (1280, 900, 'laptop')):
        ctx = br.new_context(viewport={'width': w, 'height': h}, is_mobile=w < 600); ctx.add_init_script(f"({SKIP})()")
        pg = ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(BASE + '#/'); pg.wait_for_function("() => !!document.querySelector('main') && !document.querySelector('.skelpage')", timeout=60000)
        t = pg.evaluate(FIND)
        for mode in ('testimony', 'email'):
            k = f'{tag} {mode}:'
            pg.evaluate(OPEN, [t, mode]); pg.wait_for_selector('#hp-dlg #hp-sh', timeout=15000); pg.wait_for_timeout(500)
            ok('Where do you stand' in head(pg) and nxt(pg).count() == 0, f'{k} nothing chosen yet, so no Next (the answers are the buttons)')
            pg.locator('#hp-dlg [data-hp="stance"][data-v="support"]').click(); pg.wait_for_timeout(500)
            ok('Get to know the bill' in head(pg), f'{k} "I support it" moves on to the bill')
            pg.locator('#hp-dlg .hp-foot [data-hp="back"]').click(); pg.wait_for_timeout(500)
            chosen = pg.locator('#hp-dlg [data-hp="stance"][data-v="support"]').get_attribute('aria-pressed')
            ok('Where do you stand' in head(pg) and chosen == 'true', f'{k} Back shows "I support it" chosen')
            ok(nxt(pg).count() == 1 and nxt(pg).is_visible() and nxt(pg).is_enabled(), f'{k} and Next is there, in view')
            ok(pg.locator('#hp-dlg .hp-foot .btn.primary').count() == 1, f'{k} one main button in the footer (A-3)')
            nxt(pg).click(); pg.wait_for_timeout(500)
            ok('Get to know the bill' in head(pg) and pg.evaluate("async () => (await import('./pub/core.js')).S.helper.stance") == 'support', f'{k} Next keeps "support" and goes on to the bill')
            pg.locator('#hp-dlg .hp-foot [data-hp="back"]').click(); pg.wait_for_timeout(500)
            pg.locator('#hp-dlg [data-hp="stance"][data-v="oppose"]').click(); pg.wait_for_timeout(500)
            ok('Get to know the bill' in head(pg) and pg.evaluate("async () => (await import('./pub/core.js')).S.helper.stance") == 'oppose', f'{k} choosing another answer still moves on at once, with the new answer')
            pg.keyboard.press('Escape'); pg.wait_for_timeout(400)
        ok(not errs, f'{tag}: no page errors {errs[:2]}')
        ctx.close()
    br.close()
print(f'\n{sum(res)}/{len(res)} passed')
sys.exit(0 if all(res) else 1)
