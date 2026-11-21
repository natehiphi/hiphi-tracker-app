# R-398 piece 9 gap E: Track a bill from Search (Nate: "Track it, and you lead it"). python3 tests/staff7_gaps_track.py [base] [shotdir]
import sys, os, re
from playwright.sync_api import sync_playwright
BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832').rstrip('/')
SHOTS = sys.argv[2] if len(sys.argv) > 2 else ''
res = []
def ok(c, m): res.append(bool(c)); print('PASS' if c else 'FAIL', m)
errs = []
def open_as(br, who, w, h, hash=''):
    ctx = br.new_context(viewport={'width': w, 'height': h}); pg = ctx.new_page()
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'Failed to load resource' not in m.text and 'ERR_FAILED' not in m.text else None)
    pg.goto(f'{BASE}/staff7.html?demo=1&as={who}{hash}'); pg.wait_for_selector('html[data-ready="1"]', state='attached', timeout=60000)
    pg.evaluate("Promise.all([document.fonts.load('600 16px Poppins'), document.fonts.load('400 16px Lato'), document.fonts.load('700 16px Lato')])"); pg.wait_for_timeout(500)
    return pg
def settle(pg, ms=450): pg.wait_for_timeout(ms)
def shot(pg, name):
    if SHOTS: pg.mouse.move(2, 2); pg.wait_for_timeout(800); pg.screenshot(path=os.path.join(SHOTS, name))
def txt(pg): return pg.evaluate("document.getElementById('app').innerText")
def laterOpen(pg): pg.evaluate("() => { const b = document.getElementById('laterBtn'); if (b && b.getAttribute('aria-expanded') === 'false') b.click(); }")
def toast_text(pg): return pg.evaluate("document.getElementById('toast').classList.contains('on') ? document.getElementById('toastMsg').textContent : ''")
STATE = "() => { const n = 'HB100', b = (window.__S || null); return null; }"

def run(br, w, h, tag):
    # find an untracked bill number from the practice snapshot
    pg = open_as(br, 'KV', w, h, '#/search/other/HB100')
    pg.wait_for_selector('#trackGo', timeout=15000)
    t = txt(pg)
    ok('Nobody on the team tracks this bill.' in t and 'You become its lead. You then set its position and issue.' in t, f'{tag}: the untracked page has the words')
    ok(pg.locator('#trackGo.filled').count() == 1 and pg.locator('#trackGo').inner_text().strip() == 'Track this bill', f'{tag}: Track this bill is the one filled button')
    ok(pg.locator('#oCapitol').count() == 1, f'{tag}: the Capitol link stays')
    shot(pg, 'track.png' if w > 500 else 'track_390.png')
    # track it
    pg.click('#trackGo'); settle(pg, 700)
    t = txt(pg)
    ok('HIPHI now tracks HB 100. You lead it.' in t, f'{tag}: the done page says it')
    ok(not toast_text(pg) and pg.locator('#trackUndo').count() == 1 and 'for 10 seconds' in t and 'Undo takes it off the tracker again.' in t and pg.locator('#notTracked').count() == 0, f'{tag}: no toast, one page Undo for 10 seconds')
    ok(pg.locator('#placeGo.filled').count() == 1 and 'Set its position and issue' in t, f'{tag}: Set its position and issue is filled')
    shot(pg, 'track_done.png' if w > 500 else 'track_done_390.png')
    # the bill is tracked and I lead it
    st = pg.evaluate("() => import('/staff6/data.js').then(m => { const b = m.S.bills.find(x => x.bill_number.replace(/\\s/g,'') === 'HB100'); return { tracked: b && b.tracked, lead: b && (m.S.assignments[b.id] || []).includes(m.S.me.id), recs: (m.S.leadChanges || []).filter(r => b && r.bill_id === b.id).length }; })")
    ok(st['tracked'] and st['lead'], f'{tag}: HB 100 is tracked and Kevin leads it')
    ok(st['recs'] == 1, f'{tag}: the lead change is recorded for the admin')
    # Undo
    pg.click('#trackUndo'); settle(pg, 700)
    st = pg.evaluate("() => import('/staff6/data.js').then(m => { const b = m.S.bills.find(x => x.bill_number.replace(/\\s/g,'') === 'HB100'); return { has: !!b, recs: (m.S.leadChanges || []).filter(r => r.bill_id === (b && b.id)).length, left: (m.S.leadChanges||[]).length }; })")
    ok(not st['has'], f'{tag}: Undo takes it off the tracker')
    ok('Not tracked again.' in toast_text(pg) and pg.locator('#trackGo').count() == 1, f'{tag}: Undo says Not tracked again and the page is as before')
    # track again, then the place page
    pg.click('#trackGo'); settle(pg, 700)
    pg.wait_for_timeout(10600)
    ok(pg.locator('#trackUndo').count() == 0 and 'Undo' not in txt(pg) and pg.locator('#placeGo').count() == 1, f'{tag}: the page Undo is gone after 10 seconds')
    pg.click('#placeGo'); settle(pg, 700)
    ok(pg.evaluate('location.hash').startswith('#/do/pl-HB100'), f'{tag}: Set its position and issue opens the page')
    t = txt(pg)
    ok('Set HB 100’s position and issue' in t and 'Each pick saves at once.' in t and 'Not sure? Pick Monitor. An admin can change it later.' in t, f'{tag}: the page words')
    ok(pg.locator('#plPos input:checked').count() == 0 and pg.locator('#plChips [aria-pressed="true"]').count() == 0, f'{tag}: nothing is picked by default')
    labels = pg.evaluate("() => [...document.querySelectorAll('#plPos .bs span')].map(s => s.textContent.trim())")
    ok(labels == ['Strongly support', 'Support', 'Support with amendments', 'Monitor', 'Comments (neutral)', 'Oppose', 'Strongly oppose'], f'{tag}: positions read strong support to strong oppose {labels}')
    ok(pg.locator('#plDone.filled').count() == 1 and pg.locator('#tbBack').count() == 1, f'{tag}: filled Done and the one top row')
    shot(pg, 'track_set.png' if w > 500 else 'track_set_390.png')
    # Home has the step
    pg.evaluate("location.hash = '#/'"); settle(pg)
    ok('Set position and issue' in txt(pg), f'{tag}: Home has the step')
    shot(pg, 'track_home.png' if w > 500 else 'track_home_390.png')
    pg.evaluate("location.hash = '#/do/pl-HB100'"); settle(pg)
    # position pick saves at once
    pg.click('#plPos label.bs >> nth=3'); settle(pg, 500)
    ok('Position: Monitor' in toast_text(pg) and pg.evaluate("() => import('/staff6/data.js').then(m => m.S.bills.find(x => x.bill_number.replace(/\\s/g,'') === 'HB100').position)") == 'monitor', f'{tag}: a position pick saves at once with a toast')
    pg.evaluate("location.hash = '#/do/pl-HB100'"); settle(pg)
    ok(pg.locator('#pp-monitor:checked').count() == 1, f'{tag}: the pick shows')
    # Undo of the pick
    pg.click('#plPos label.bs >> nth=5'); settle(pg, 400); pg.click('#toastUndo'); settle(pg, 500)
    ok(pg.locator('#pp-monitor:checked').count() == 1, f'{tag}: Undo puts the position back')
    # still only position: step stays
    pg.evaluate("location.hash = '#/'"); settle(pg)
    ok('Set position and issue' in txt(pg), f'{tag}: with the position only the step stays')
    pg.evaluate("location.hash = '#/do/pl-HB100'"); settle(pg)
    # issue pick
    pg.fill('#plIn', 'a'); settle(pg, 200); pg.fill('#plIn', '')
    n = pg.locator('#plChips .bchip').count()
    ok(n > 0, f'{tag}: the issues are offered as choices')
    pg.click('#plChips .bchip >> nth=0'); settle(pg, 500)
    ok('is on' in toast_text(pg), f'{tag}: an issue pick saves at once with a toast: {toast_text(pg)}')
    pg.evaluate("location.hash = '#/'"); settle(pg); laterOpen(pg)
    ok('Set position and issue' not in txt(pg), f'{tag}: with both set the Home step is gone')
    # New bills sorting does not offer it
    pg.evaluate("location.hash = '#/issues/new'"); settle(pg, 900)
    t = txt(pg)
    ok(re.search(r'\b[HS]B ?\d+', t) is not None and not re.search(r'HB ?100(?!\d)', t), f'{tag}: New bills sorting shows bills but not HB 100')
    # Done goes back
    pg.evaluate("location.hash = '#/'"); settle(pg)
    pg.evaluate("location.hash = '#/do/pl-HB100'"); settle(pg)
    pg.click('#plDone'); settle(pg, 600)
    ok(pg.evaluate('location.hash') in ('#/', ''), f'{tag}: Done goes back to where the person came from')
    ok(pg.evaluate('document.documentElement.scrollWidth <= innerWidth'), f'{tag}: no sideways scroll')
    pg.context.close()

with sync_playwright() as p:
    br = p.chromium.launch()
    run(br, 1440, 900, '1440')
    run(br, 390, 844, '390')
    br.close()
ok(not errs, f'no page errors {errs[:2]}')
print(f'{sum(res)} passed, {len(res) - sum(res)} failed'); sys.exit(0 if all(res) else 1)
