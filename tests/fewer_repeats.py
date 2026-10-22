# Fewer repeats (R-212 #30), in the practice copy served locally:
#   F1  a first letter's About you has the full blue box ("Anyone can send one"), no short line
#   F2  after testimony was sent once, About you has one quiet line instead, still saying it is posted publicly
#   python3 fewer_repeats.py [base] [outdir]
import sys, os
from playwright.sync_api import sync_playwright
BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832/').rstrip('/') + '/'
OUT = sys.argv[2] if len(sys.argv) > 2 else '.'
PUB = BASE + 'track.html?demo=1'
res = []
def ok(c, m): res.append(bool(c)); print('PASS' if c else 'FAIL', m)
def ready(pg):
    pg.wait_for_function("() => !!document.querySelector('main') && !document.querySelector('.skelpage') && !document.querySelector('.bl-skel')", timeout=60000); pg.wait_for_timeout(700)
SKIP = "() => { try { const w = JSON.parse(localStorage.getItem('hiphi_wiz') || '{}'); const v = JSON.stringify({ ...w, done: true, step: 99 }); localStorage.setItem('hiphi_wiz', v); localStorage.setItem('hiphi_tour_bill', '{\"how\":\"test\"}'); localStorage.setItem('hiphi_tour_home', '{\"how\":\"test\"}'); } catch {} }"
MARK = """async n => { const c = await import('./pub/core.js'); const b = [...c.S.bills, ...Object.values(c.S.extra || {})].find(x => x.bill_number.replace(/\\s/g, '') === n) || await c.ensureBill?.(n);
  const h = c.hearingsOf(b).find(x => new Date(x.scheduled_at) > Date.now()); if (!c.S.watch.has(b.id)) await c.toggleWatch(b.id); await c.markDone(b.id, h.id, 'testimony', true, { quiet: true }); }"""
def about(pg, num):
    pg.goto(PUB + '#/find'); pg.wait_for_timeout(300); pg.goto(PUB + f'#/bill/{num}/testify'); ready(pg)
    pg.wait_for_timeout(2000)
    if not pg.locator('#hp-dlg[open]').count(): pg.get_by_role('button', name='Help me write testimony').first.click()
    pg.wait_for_selector('#hp-dlg[open]', timeout=15000); pg.wait_for_timeout(800)
    for _ in range(4):
        if pg.locator('#hp-dlg #hp-name').count(): break
        if pg.locator('#hp-dlg [data-hp="stance"][aria-pressed="true"]').count() == 0 and pg.locator('#hp-dlg [data-hp="stance"]').count():
            pg.locator('#hp-dlg [data-hp="stance"]').first.click(); pg.wait_for_timeout(300)
        pg.locator('#hp-dlg .hp-foot button.primary').last.click(); pg.wait_for_timeout(700)
    return pg.locator('#hp-dlg .hp-body').inner_text()
with sync_playwright() as p:
    br = p.chromium.launch(); errs = []
    c = br.new_context(viewport={'width': 375, 'height': 812}, is_mobile=True, has_touch=True); pg = c.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(PUB + '#/'); ready(pg); pg.evaluate(SKIP); pg.goto(PUB + '#/find'); pg.goto(PUB + '#/'); ready(pg)
    t = about(pg, 'HB1523')
    ok('Anyone can send one' in t and pg.locator('#hp-dlg .hp-aboutnote').count() == 0, f'F1: a first letter has the full box ({t[:120]!r})')
    pg.screenshot(path=os.path.join(OUT, 'repeats_1_first.png'))
    pg.keyboard.press('Escape'); pg.wait_for_timeout(600)
    for n in ['HB2021', 'HB1965']: pg.evaluate(MARK, n)
    t = about(pg, 'HB1523')
    q = pg.locator('#hp-dlg .hp-aboutnote')
    ok('Anyone can send one' not in t and q.count() == 1 and 'posted on the Capitol website' in q.inner_text(), f'F2: after a letter, one quiet line ({q.inner_text() if q.count() else t[:120]!r})')
    pg.screenshot(path=os.path.join(OUT, 'repeats_2_again.png'))
    pg.keyboard.press('Escape'); pg.wait_for_timeout(600)
    ok(not errs, f'no page errors {errs[:2]}')
    br.close()
print(f'{sum(res)}/{len(res)} passed'); sys.exit(0 if all(res) else 1)
