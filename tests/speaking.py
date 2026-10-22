# "Are you speaking? In person or Zoom" (R-212 #32; the Person Who Lived It walk: "nothing for speaking on Zoom, and ticking
# Zoom in the profile turns into In person"). In the practice copy (Mon 16 Mar 2026), on a phone and a laptop:
#   Z1  the hearing card's going panel has the Zoom line; with a neighbor-island district it names the island
#   Z2  the send step asks "Are you speaking at the hearing?" (three chips, none picked); On Zoom is kept for the hearing and
#       the form's step says Zoom
#   Z3  sent with Zoom: the last page has the Zoom checklist (Join, the same name, muted, interpreter), not the directions
#   Z4  a profile that ticked "Testify at a hearing, in person or on Zoom": nothing is picked for them, and no
#       "since you said you'd testify in person"
#   Z5  In person: the last page offers I plan to go; the directions say "You chose In person", the buses and an interpreter
#   Z6  written only: the directions' speak line says they can still ask at the room
#   Z7  Home on the hearing day (it leads the calm Home): "You're speaking on Zoom" with How to join on Zoom (opens the checklist) and Not speaking after all
#   no page errors
#   python3 tests/speaking.py [base] [outdir]     base defaults to http://localhost:8832/track.html?demo=1&codes=0
import sys, os
from playwright.sync_api import sync_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832/track.html?demo=1&codes=0'
OUT = sys.argv[2] if len(sys.argv) > 2 else '.'
res = []
def ok(c, m): res.append(bool(c)); print('PASS' if c else 'FAIL', m)
def ready(pg): pg.wait_for_function("() => !!document.querySelector('main') && !document.querySelector('.skelpage')", timeout=60000); pg.wait_for_timeout(600)
def text(pg, sel): return pg.locator(sel).first.inner_text() if pg.locator(sel).count() else ''
SKIP = "() => { try { for (const k of ['hiphi_wiz', 'hiphi_wiz_demo']) { const w = JSON.parse(localStorage.getItem(k) || '{}'); localStorage.setItem(k, JSON.stringify({ ...w, done: true, step: 99 })); } for (const k of ['hiphi_tour_bill', 'hiphi_tour_home', 'hiphi_tour_bill_demo', 'hiphi_tour_home_demo']) localStorage.setItem(k, '{\"how\":\"test\"}'); } catch {} }"
# Follow HB 2121's issue and return its next hearing; later=True moves that hearing to three hours from now, today (Z7).
PICK = """async ([n, later]) => { const c = await import('./pub/core.js'); const b = c.D.bills.find(x => x.bill_number === n);
  const h = c.D.hearings.filter(x => x.bill_id === b.id && new Date(x.scheduled_at) > Date.now()).sort((a, z) => a.scheduled_at.localeCompare(z.scheduled_at))[0];
  if (later) { const t = new Date(Date.now() + 3 * 36e5); h.scheduled_at = t.toISOString(); h.testimony_deadline = new Date(t - 864e5).toISOString(); }
  await c.setFollows({ issuesOn: c.issuesOf(b).map(i => i.id) }); c.saveLocal(); await c.loadBills(); c.app.render(); return { b: b.id, h: h.id }; }"""
def open_letter(pg, t):
    pg.evaluate("async ([b, h]) => { const c = await import('./pub/core.js'); c.app.openHelper(b, h); }", [t['b'], t['h']])
    pg.wait_for_selector('#hp-dlg', timeout=15000); pg.wait_for_timeout(800)
def to_send(pg):
    for _ in range(8):
        if pg.locator('#hp-dlg .hp-speak').count(): return True
        st = pg.locator('#hp-dlg [data-hp="stance"][data-v="support"]')
        if st.count(): st.first.click(); pg.wait_for_timeout(500); continue
        if pg.locator('#hp-name').count() and not pg.input_value('#hp-name'): pg.fill('#hp-name', 'Malia Test')
        b = pg.locator('#hp-dlg [data-hp="acct-yes"]')
        if not b.count(): b = pg.locator('#hp-dlg .hp-foot .hp-main')
        b.first.click(); pg.wait_for_timeout(800)
    return pg.locator('#hp-dlg .hp-speak').count() > 0
def to_done(pg):
    for _ in range(6):
        if pg.locator('#hp-done-t').count(): break
        b = pg.locator('#hp-dlg [data-hp="sent"]')
        if not b.count(): b = pg.locator('#hp-dlg .hp-foot .hp-main')
        if not b.count(): break
        b.first.click(); pg.wait_for_timeout(900)
    return pg.locator('#hp-done-t').count() == 1
def steps(pg): return ' '.join(pg.locator('#hp-dlg .hp-steps li').all_inner_texts())
def fresh(br, vp, mob, init=''):
    c = br.new_context(viewport=vp, is_mobile=mob, has_touch=mob); c.add_init_script(f"({SKIP})()")
    if init: c.add_init_script("(() => { try { " + init + " } catch {} })()")
    return c

with sync_playwright() as p:
    br = p.chromium.launch()
    for name, vp, mob in (('phone', {'width': 390, 'height': 844}, True), ('laptop', {'width': 1280, 'height': 860}, False)):
        errs = []
        # Z1: the going panel's Zoom line, then a Maui district.
        c = fresh(br, vp, mob); pg = c.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(BASE + '#/bill/HB2121'); ready(pg)
        pg.locator('[data-moreways]').first.click(); pg.wait_for_timeout(400); pg.locator('.mwrow[data-go]').first.click(); pg.wait_for_timeout(400)
        z = text(pg, '.gopanel .gozoom')
        ok('Can’t get to the Capitol? You can speak on Zoom.' in z and 'Choose Zoom instead of In person' in z, f'{name} Z1: the going panel has the Zoom line ({z!r})')
        pg.evaluate("localStorage.setItem('hiphi_districts', JSON.stringify({ senate: 5, house: 8 }))"); pg.reload(); ready(pg)
        pg.locator('[data-moreways]').first.click(); pg.wait_for_timeout(400); pg.locator('.mwrow[data-go]').first.click(); pg.wait_for_timeout(400)
        z = text(pg, '.gopanel .gozoom')
        ok('In Maui County? You can speak on Zoom from home.' in z, f'{name} Z1: a Maui district is named first ({z[:60]!r})')
        if name == 'phone': pg.locator('.gopanel').first.screenshot(path=os.path.join(OUT, f'r212-32-panel-{name}.png'))
        c.close()
        # Z2, Z3: Zoom.
        c = fresh(br, vp, mob); pg = c.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(BASE + '#/'); ready(pg); t = pg.evaluate(PICK, ['HB2121', False]); open_letter(pg, t)
        ok(to_send(pg), f'{name} Z2: the send step is reached')
        pressed = pg.locator('#hp-dlg .hp-speak [aria-pressed="true"]').count()
        ok(pg.locator('#hp-dlg .hp-speak .chip').count() == 3 and pressed == 0 and 'Are you speaking at the hearing?' in text(pg, '#hp-dlg .hp-speak'), f'{name} Z2: three chips, none picked')
        pg.locator('#hp-spk-zoom').click(); pg.wait_for_timeout(500)
        kept = pg.evaluate("([h]) => JSON.parse(localStorage.getItem('hiphi_speak') || '{}')[h]", [t['h']])
        ok(pg.locator('#hp-spk-zoom[aria-pressed="true"]').count() == 1 and kept == 'zoom' and 'Individual · Zoom. On the day' in steps(pg) and pg.evaluate("document.activeElement?.id") == 'hp-spk-zoom',
           f'{name} Z2: On Zoom is picked, kept ({kept!r}), the step says Zoom, focus stays')
        if name == 'phone': pg.locator('#hp-dlg .hp-steps').screenshot(path=os.path.join(OUT, f'r212-32-send-{name}.png'))
        ok(to_done(pg), f'{name} Z3: sent')
        zl = text(pg, '#hp-dlg .zoomdir')
        ok('Speaking on Zoom' in zl and 'Join' in zl and 'same first and last name' in zl and 'Stay muted' in zl and 'interpreter' in zl and 'Ask to speak' not in zl and pg.locator('#hp-dlg .godir:not(.zoomdir)').count() == 0,
           f'{name} Z3: the last page has the Zoom checklist ({zl[:80]!r})')
        if name == 'phone': pg.locator('#hp-dlg .zoomdir').screenshot(path=os.path.join(OUT, f'r212-32-zoom-{name}.png'))
        c.close()
        # Z4, Z5: a profile that said it would testify, then In person.
        c = fresh(br, vp, mob, "for (const k of ['hiphi_me', 'hiphi_me_demo']) { const m = JSON.parse(localStorage.getItem(k) || '{}'); m.interests = ['testify']; m.name = 'Malia Test'; localStorage.setItem(k, JSON.stringify(m)); }")
        pg = c.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(BASE + '#/'); ready(pg); t = pg.evaluate(PICK, ['HB2121', False]); open_letter(pg, t); to_send(pg)
        s = steps(pg)
        ok(pg.locator('#hp-dlg .hp-speak [aria-pressed="true"]').count() == 0 and 'since you said' not in s and 'Written testimony only, unless you’re speaking.' in s, f'{name} Z4: nothing picked for a speaker, no "since you said"')
        pg.locator('#hp-spk-person').click(); pg.wait_for_timeout(400)
        ok('Individual · In person. At the room' in steps(pg), f'{name} Z5: the step says In person')
        to_done(pg)
        ok(pg.locator('#hp-dlg [data-hp="going"]').count() == 1, f'{name} Z5: the last page offers I plan to go')
        pg.locator('#hp-dlg [data-hp="going"]').click(); pg.wait_for_timeout(900)
        d = text(pg, '#hp-dlg .godir')
        ok('You chose In person' in d and 'TheBus routes A and 4' in d and 'interpreter' in d, f'{name} Z5: directions say In person, the buses, interpreters')
        c.close()
        # Z6: written only.
        c = fresh(br, vp, mob); pg = c.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(BASE + '#/'); ready(pg); t = pg.evaluate(PICK, ['HB2121', False]); open_letter(pg, t); to_send(pg)
        pg.locator('#hp-spk-written').click(); pg.wait_for_timeout(400); to_done(pg)
        pg.locator('#hp-dlg [data-hp="going"]').click(); pg.wait_for_timeout(900)
        d = text(pg, '#hp-dlg .godir')
        ok('written testimony only, and you can still ask' in d, f'{name} Z6: written only can still ask at the room')
        c.close()
        # Z7: Home on the day of a Zoom hearing.
        c = fresh(br, vp, mob); pg = c.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(BASE + '#/'); ready(pg); t = pg.evaluate(PICK, ['HB2121', True])
        pg.evaluate("""async ([b, h]) => { const a = await import('./pub/actions.js'), c = await import('./pub/core.js'); a.setSpeak(h, 'zoom');
          await c.markDone(b, h, 'testimony', true, { quiet: true }); c.app.render(); }""", [t['b'], t['h']]); pg.wait_for_timeout(900)
        g = text(pg, '.gocard')
        ok('You’re speaking on Zoom' in g and 'How to join on Zoom' in g and 'Not speaking after all' in g, f'{name} Z7: Home has the hearing-day card ({g[:90]!r})')
        pg.locator('.gocard [data-go^="hm:zm:"]').first.click(); pg.wait_for_timeout(500)
        ok('Join' in text(pg, '.gocard .zoomdir'), f'{name} Z7: How to join opens the checklist')
        if name == 'phone': pg.locator('.gocard').first.screenshot(path=os.path.join(OUT, f'r212-32-home-{name}.png'))
        pg.locator('.gocard [data-unspeak]').first.click(); pg.wait_for_timeout(700)
        ok(pg.locator('.gocard [data-unspeak]').count() == 0, f'{name} Z7: Not speaking after all takes it off')
        c.close()
        ok(not errs, f'{name}: no page errors {errs[:2]}')
    br.close()
print(f'{sum(res)}/{len(res)} passed'); sys.exit(0 if all(res) else 1)
