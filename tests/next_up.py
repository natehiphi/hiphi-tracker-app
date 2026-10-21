# "Next: HB 2300, due tomorrow" after a letter (R-212 #29, the walk's Tier 2). In the practice copy (Mon 16 Mar 2026), someone
# who follows the issues of HB 1523, HB 1780 and HB 2300 sends testimony on HB 1523, on a phone and a laptop:
#   - the thank-you has one "Next:" card under "What happens next", naming the soonest other open testimony in plain words,
#     when it closes, "Another bill you follow closes soon too", and one outlined "Write testimony" button (the bar keeps
#     the only filled button);
#   - "Write testimony" closes this one and opens the letter helper on that bill's hearing;
#   - a bill they said they oppose is never offered, nor one they already acted on; with nothing left, no card;
#   - no card while the first visit is under way (its plan has its own next step);
#   - no page errors.
#   python3 tests/next_up.py [base]     base defaults to http://localhost:8832/track.html?demo=1&codes=0
import sys, os, re
from playwright.sync_api import sync_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832/track.html?demo=1&codes=0'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out', 'next_up'); os.makedirs(OUT, exist_ok=True)
res = []
def ok(c, m): res.append(bool(c)); print('PASS' if c else 'FAIL', m)
def ready(pg): pg.wait_for_function("() => !!document.querySelector('main') && !document.querySelector('.skelpage')", timeout=60000); pg.wait_for_timeout(600)
def text(pg, sel): return pg.locator(sel).first.inner_text() if pg.locator(sel).count() else ''
SKIP = "() => { try { for (const k of ['hiphi_wiz', 'hiphi_wiz_demo']) { const w = JSON.parse(localStorage.getItem(k) || '{}'); localStorage.setItem(k, JSON.stringify({ ...w, done: true, step: 99 })); } for (const k of ['hiphi_tour_bill', 'hiphi_tour_home', 'hiphi_tour_bill_demo', 'hiphi_tour_home_demo']) localStorage.setItem(k, '{\"how\":\"test\"}'); } catch {} }"
# Follow the issues of these bills; return each one's next hearing.
FOLLOW = """async (nums) => { const c = await import('./pub/core.js'); const out = {};
  for (const n of nums) { const b = c.D.bills.find(x => x.bill_number === n);
    const h = c.D.hearings.filter(x => x.bill_id === b.id && new Date(x.scheduled_at) > Date.now()).sort((a, z) => a.scheduled_at.localeCompare(z.scheduled_at))[0];
    await c.setFollows({ issuesOn: c.issuesOf(b).map(i => i.id) }); out[n] = { b: b.id, h: h.id }; }
  c.saveLocal(); await c.loadBills(); c.app.render(); return out; }"""
def letter(pg, b, h):
    pg.evaluate("async ([b, h]) => { const c = await import('./pub/core.js'); c.app.openHelper(b, h); }", [b, h])
    pg.wait_for_selector('#hp-dlg', timeout=15000); pg.wait_for_timeout(800)
    walk(pg)
def walk(pg):
    for _ in range(4):
        if pg.locator('#hp-form').count(): break
        st = pg.locator('#hp-dlg [data-hp="stance"][data-v="support"]')
        if st.count(): st.first.click(); pg.wait_for_timeout(500); continue
        pg.locator('#hp-dlg .hp-foot .hp-main').first.click(); pg.wait_for_timeout(600)
    if pg.locator('#hp-name').count() and not pg.input_value('#hp-name'): pg.fill('#hp-name', 'Malia Test')
def to_done(pg):
    for _ in range(6):
        if pg.locator('#hp-done-t').count(): break
        b = pg.locator('#hp-dlg [data-hp="sent"], #hp-dlg [data-hp="acct-yes"]')
        if not b.count(): b = pg.locator('#hp-dlg .hp-foot .hp-main')
        if not b.count(): break
        b.first.click(); pg.wait_for_timeout(900)
    return pg.locator('#hp-done-t').count() == 1
def close(pg):
    pg.evaluate("""async () => { const c = await import('./pub/core.js'); c.S.helper = null; try { const m = JSON.parse(localStorage.getItem('hiphi_me_demo') || '{}');
      delete m.mail; delete m.drafts; localStorage.setItem('hiphi_me_demo', JSON.stringify(m)); } catch {} document.body.classList.remove('hp-lock'); c.app.render(); }""")
    pg.wait_for_timeout(400)

with sync_playwright() as p:
    br = p.chromium.launch()
    for name, vp, mob in (('phone', {'width': 390, 'height': 844}, True), ('laptop', {'width': 1280, 'height': 860}, False)):
        ctx = br.new_context(viewport=vp, is_mobile=mob, has_touch=mob); ctx.add_init_script(f"({SKIP})()")
        pg = ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(BASE + '#/'); ready(pg)
        t = pg.evaluate(FOLLOW, ['HB1523', 'HB1780', 'HB2300'])

        # 1. After testimony on HB 1523: the next one, its day, one more, one outlined button
        letter(pg, t['HB1523']['b'], t['HB1523']['h'])
        ok(to_done(pg), f'{name}: the letter on HB 1523 can be marked sent')
        card = pg.locator('#hp-dlg .hp-nextup')
        h3 = text(pg, '#hp-nu-t')
        nxt = pg.evaluate("async () => { const c = await import('./pub/core.js'); const b = document.querySelector('#hp-dlg [data-hp=\"nextup\"]')?.dataset.b; return b ? c.anyBill(b)?.bill_number || '' : ''; }")
        sp = f'{nxt[:2]} {nxt[2:]}'
        hl = pg.evaluate("async (n) => { const c = await import('./pub/core.js'); return c.headline(c.D.bills.find(x => x.bill_number === n), 90); }", nxt) if nxt else ''
        ok(card.count() == 1 and nxt in ('HB1780', 'HB2300') and h3 == f'Next: {hl}', f'{name}: one "Next:" card names the next bill in plain words ({h3!r})')
        body = text(pg, '#hp-dlg .hp-nextup p')
        ok(body == f'Testimony on {sp} closes tomorrow at 1:00 PM. Another bill you follow closes soon too. It’s on Home.', f'{name}: it says when testimony on {sp} closes, once, and that another waits ({body!r})')
        ok(pg.evaluate("() => { const n = document.querySelector('#hp-dlg .hp-next'), u = document.querySelector('#hp-dlg .hp-nextup'); return !!n && !!u && !!(n.compareDocumentPosition(u) & Node.DOCUMENT_POSITION_FOLLOWING); }"), f'{name}: it comes after "What happens next"')
        wb = pg.locator('#hp-dlg .hp-nextup [data-hp="nextup"]')
        ok(wb.count() == 1 and wb.inner_text().strip() == 'Write testimony' and wb.get_attribute('aria-label') == f'Write testimony on {sp}' and 'secondary' in (wb.get_attribute('class') or ''), f'{name}: its button is "Write testimony" (on {sp} for a screen reader), outlined')
        ok(pg.locator('#hp-dlg .btn.primary').count() == 1, f'{name}: the bar\'s main button is still the only filled one')
        card.scroll_into_view_if_needed(); pg.screenshot(path=os.path.join(OUT, f'done-{name}.png'))

        # 2. "Write on" opens the helper on that bill's hearing
        wb.click(); pg.wait_for_timeout(1500)
        key = pg.evaluate("async () => { const c = await import('./pub/core.js'); return c.S.helper ? [c.S.helper.b.bill_number, c.S.helper.h.id, c.S.helper.screen] : null; }")
        ok(key and key[0] == nxt and key[1] == t[nxt]['h'] and key[2] != 'done', f'{name}: "Write on" opens the letter on {nxt} ({key})')
        ok(pg.locator('#hp-dlg[open]').count() == 1, f'{name}: the helper is open')

        # 3. Oppose the other one: with the next one sent, nothing else is offered
        other = 'HB2300' if nxt == 'HB1780' else 'HB1780'
        walk(pg); ok(to_done(pg), f'{name}: the letter on {nxt} can be marked sent')
        ok(pg.locator('#hp-dlg .hp-nextup').count() == 1 and f'{other[:2]} {other[2:]}' in text(pg, '#hp-dlg .hp-nextup p') and 'on Home' not in text(pg, '#hp-dlg .hp-nextup p'), f'{name}: then the last one is next, with no "more" ({text(pg, "#hp-dlg .hp-nextup p")!r})')
        close(pg)
        pg.evaluate("async (b) => { const c = await import('./pub/core.js'); await c.setStance(b, 'oppose'); }", t[other]['b']); pg.wait_for_timeout(300)
        letter(pg, t['HB1523']['b'], t['HB1523']['h']); to_done(pg)
        ok(pg.locator('#hp-dlg .hp-nextup').count() == 0, f'{name}: a bill they oppose and bills they acted on are never offered: no card')
        close(pg)

        # 4. Not during a first visit
        pg.evaluate("async (b) => { const c = await import('./pub/core.js'); await c.setStance(b, null); const w = JSON.parse(localStorage.getItem('hiphi_wiz') || '{}'); localStorage.setItem('hiphi_wiz', JSON.stringify({ ...w, done: false, skipped: false, step: 2 })); }", t[other]['b'])
        letter(pg, t['HB1523']['b'], t['HB1523']['h']); to_done(pg)
        ok(pg.locator('#hp-dlg .hp-nextup').count() == 0, f'{name}: no "Next:" card in a first visit')
        close(pg)
        ok(not errs, f'{name}: no page errors {errs[:2]}')
        ctx.close()
    br.close()
print(f'{sum(res)}/{len(res)} passed'); sys.exit(0 if all(res) else 1)
