# R-398 piece 9 gap B: the position changed after approval. A position change on a bill with approved testimony warns on the bill page, holds the File testimony step, and gives the writer
# the step "Check your testimony"; it ends by itself (position back, approved again, hearing passed). Practice copy only.
#   python3 tests/staff7_gaps_pos.py [base]     base defaults to http://localhost:8832
import sys, os
from playwright.sync_api import sync_playwright
BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832').rstrip('/')
SHOTS = os.environ.get('SHOTS', '')
res = []
def ok(c, m): res.append(bool(c)); print('PASS' if c else 'FAIL', m)
errs = []
HEAR = '6585adbd-60ab-4eb3-a0b7-303405b87be5'   # HB 2121's hearing (Kevin writes, approved)
HEAR2 = '62da6ef7-6c9a-4a03-975b-4b5155e564dc'  # HB 2300's hearing (another writer, approved)
CHK = f'#/do/ck-HB2121-{HEAR}'; FILE = f'#/do/t-HB2121-{HEAR}'; CHK2 = f'#/do/ck-HB2300-{HEAR2}'; FILE2 = f'#/do/t-HB2300-{HEAR2}'

def open_as(br, who, w, h, hash=''):
    ctx = br.new_context(viewport={'width': w, 'height': h}); pg = ctx.new_page()
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'Failed to load resource' not in m.text and 'ERR_FAILED' not in m.text else None)
    pg.goto(f'{BASE}/staff7.html?demo=1&as={who}{hash}'); pg.wait_for_selector('html[data-ready="1"]', state='attached', timeout=60000)
    pg.evaluate("Promise.all([document.fonts.load('600 16px Poppins'), document.fonts.load('400 16px Lato'), document.fonts.load('700 16px Lato')])"); pg.wait_for_timeout(500)
    return pg
def settle(pg, ms=500): pg.wait_for_timeout(ms)
def goto(pg, h): pg.evaluate(f"location.hash = {h!r}"); settle(pg)
def text(pg, sel): return pg.evaluate("s => { const e = document.querySelector(s); return e ? e.innerText.replace(/\\s+/g, ' ').trim() : null; }", sel)
def shot(pg, name):
    if SHOTS: pg.screenshot(path=os.path.join(SHOTS, name))
def set_pos(pg, bill, val):
    goto(pg, f'#/bill/{bill}'); pg.click('#bEditGo'); settle(pg, 250); pg.click(f'label.bs:has(#bp-{val})'); pg.click('#bSave'); settle(pg, 700)
def draft_status(pg, bill_no):
    return pg.evaluate("async no => { const m = await import('/staff6/data.js'); const b = m.S.bills.find(x => x.bill_number.replace(/\\s/g,'') === no); return (m.S.drafts[b.id]||[]).map(d => d.status).join(','); }", bill_no)
def rows(pg): return pg.evaluate("() => [...document.querySelectorAll('a.sr3')].map(a => a.innerText.replace(/\\s+/g,' ').trim())")
def step_rows(pg): return [r for r in rows(pg) if r.startswith('Check your testimony')]
def overflow(pg): return pg.evaluate("() => document.documentElement.scrollWidth <= innerWidth + 1")
def later_open(pg): pg.evaluate("() => { const b = document.getElementById('laterBtn'); if (b && b.getAttribute('aria-expanded') === 'false') b.click(); }"); settle(pg, 250)

with sync_playwright() as p:
    br = p.chromium.launch()
    # ---- 1. a change that crosses sides: Strongly support -> Oppose
    pg = open_as(br, 'KV', 1440, 900, '#/bill/HB2121')
    ok(pg.locator('#bPosHold').count() == 0, 'before the change there is no strip on the bill page')
    pg.click('#bEditGo'); settle(pg, 250); pg.click('label.bs:has(#bp-oppose)'); pg.click('#bSave'); settle(pg, 700)
    strip = text(pg, '#bPosHold') or ''
    ok('Position: Oppose. 1 approved testimony says Strongly support.' in strip, f'the amber strip names the position and the old side: {strip[:90]}')
    ok('Filing is held until you check the testimony.' in strip and 'You get a step to check it.' in strip and 'Open the testimony' in strip, 'the strip says filing is held, who gets the step, and offers Open the testimony')
    ok('held until it is checked' in (text(pg, '#bStat') or '') and 'ready to file' not in (text(pg, '#bStat') or ''), 'the bill page says filing is held, not ready to file')
    ok(pg.locator('#bStat a.ymove', has_text='Check your testimony').count() == 1, 'the bill page offers Your move · Check your testimony')
    shot(pg, 'pos_warn.png')
    # ---- 2. Home: the writer's step at the top, due today
    goto(pg, '#/')
    r = rows(pg)
    first_todo = next((x for x in r if 'HB 2121' in x or 'Check' in x), '')
    ok(len(step_rows(pg)) == 1 and r.index(step_rows(pg)[0]) == 0, f'Home lists Check your testimony first: {r[:2]}')
    ok('Today' in step_rows(pg)[0], 'its row says Today')
    ok(pg.locator('a.sr3', has_text='Check your testimony').count() == 1, 'one step only')
    shot(pg, 'pos_home.png')
    # ---- 3. its page: crosses sides, only Change the testimony
    pg.click('a.sr3:has-text("Check your testimony")'); settle(pg)
    ok(pg.evaluate('location.hash') == CHK, f'the step opens at {CHK}')
    body = text(pg, '#app') or ''
    ok('Approved when HIPHI’s position was Strongly support. It is now Oppose.' in body, 'the page says what changed')
    ok('cannot be filed as written' in body, 'a change across sides says it cannot be filed as written')
    ok(pg.locator('#chgBtn.filled').count() == 1 and pg.locator('#keepBtn').count() == 0, 'only the filled Change the testimony (no Keep it as written)')
    ok(pg.locator('#tbBack').count() == 1 and pg.locator('#tbClose').count() == 1 and pg.locator('#app a:has-text("Back to")').count() == 1, 'the page has the one top row (Back, Close) and no Back of its own')
    shot(pg, 'pos_check.png')
    # ---- 4. the File testimony step is held for its writer
    goto(pg, FILE); body = text(pg, '#app') or ''
    ok('Position changed' in body and 'The position changed to Oppose after this testimony was approved. It cannot be filed until it is checked.' in body, 'File testimony shows the amber box')
    ok(pg.locator('#chkGo.filled').count() == 1 and pg.locator('#subBtn').count() == 0 and pg.locator('#already').count() == 0 and pg.locator('#yesBtn').count() == 0, 'the writer sees a filled Check your testimony and no Submit')
    ok(pg.locator('#app .pn .btn.filled').count() == 1, 'it is the only filled button on the page')
    shot(pg, 'pos_file.png')
    pg.click('#chkGo'); settle(pg); ok(pg.evaluate('location.hash') == CHK, 'Check your testimony in the box opens the check page')
    # ---- 5. no filed-on-wrong-side path
    msg = pg.evaluate("""async () => { const m = await import('/staff6/data.js'), f = await import('/staff7/do_file.js'); const b = m.S.bills.find(x => x.bill_number.replace(/\\s/g,'') === 'HB2121'); const d = m.S.drafts[b.id].find(x => x.status === 'approved');
      try { await f.fileStep({ bill: b, draft: d }); return 'filed'; } catch (e) { return e.message + '|' + m.S.drafts[b.id].find(x => x.id === d.id).status; } }""")
    ok(msg.startswith('Filing is held') and msg.endswith('approved'), f'filing is refused while held and the draft stays approved: {msg}')
    # ---- 6. Change the testimony: back to writing, with Undo
    pg.click('#chgBtn'); settle(pg, 700)
    ok(pg.evaluate('location.hash') == FILE, 'Change the testimony opens its writing step')
    ok('draft' in draft_status(pg, 'HB2121'), 'the testimony is back to writing')
    ok(pg.locator('#bPosHold').count() == 0 and not step_rows(pg), 'the step and the hold are gone')
    ok(pg.locator('#toast .tin').count() > 0 and 'Undo' in (text(pg, '#toast') or ''), 'a toast with Undo')
    pg.click('#toast a, #toast button:has-text("Undo")'); settle(pg, 600)
    ok('approved' in draft_status(pg, 'HB2121') and len(step_rows(pg)) == 1, 'Undo puts the approved testimony and the step back')
    # ---- 7. it ends by itself: the position goes back
    set_pos(pg, 'HB2121', 'strongly_support'); goto(pg, '#/bill/HB2121')
    ok(pg.locator('#bPosHold').count() == 0, 'the position goes back: the strip goes')
    goto(pg, '#/'); ok(not step_rows(pg), 'the position goes back: the step goes')
    goto(pg, FILE); ok(pg.locator('#posHold').count() == 0 and pg.locator('#subBtn').count() == 1, 'the position goes back: the hold goes and Submit is offered again')
    # ---- 8. it ends by itself: approved again after the change; and when the hearing passes
    set_pos(pg, 'HB2121', 'oppose'); goto(pg, '#/'); ok(len(step_rows(pg)) == 1, 'held again after a new change')
    pg.evaluate("""async () => { const m = await import('/staff6/data.js'); const b = m.S.bills.find(x => x.bill_number.replace(/\\s/g,'') === 'HB2121'); const d = m.S.drafts[b.id].find(x => x.status === 'approved'); d.second_approved_at = new Date(Date.now() + 5000).toISOString(); }""")
    goto(pg, '#/bill/HB2121'); ok(pg.locator('#bPosHold').count() == 0, 'approved again after the change: the strip goes')
    goto(pg, '#/'); ok(not step_rows(pg), 'approved again after the change: the step goes')
    pg.evaluate("""async () => { const m = await import('/staff6/data.js'); const b = m.S.bills.find(x => x.bill_number.replace(/\\s/g,'') === 'HB2121'); const d = m.S.drafts[b.id].find(x => x.status === 'approved'); d.second_approved_at = '2026-03-16T13:00:00.000Z'; }""")
    goto(pg, '#/bill/HB2121'); ok(pg.locator('#bPosHold').count() == 1, 'the hold is back once the approval is older than the change')
    pg.evaluate("""async h => { const m = await import('/staff6/data.js'); m.S.hearings.filter(x => x.id === h).forEach(x => { x.scheduled_at = '2026-03-10T19:00:00.000Z'; }); }""", HEAR)
    goto(pg, '#/'); ok(not step_rows(pg), 'the hearing passed: the step goes')
    goto(pg, '#/bill/HB2121'); ok(pg.locator('#bPosHold').count() == 0, 'the hearing passed: the strip goes')
    pg.context.close()
    # ---- 9. same side: Strongly support -> Support, with Keep it as written
    pg = open_as(br, 'KV', 1440, 900, '')
    set_pos(pg, 'HB2121', 'support'); goto(pg, '#/'); ok(len(step_rows(pg)) == 1, 'a change on the same side still gives the step')
    pg.click('a.sr3:has-text("Check your testimony")'); settle(pg); body = text(pg, '#app') or ''
    ok('Approved when HIPHI’s position was Strongly support. It is now Support. The testimony still argues for the same side.' in body, 'the page says the testimony still argues for the same side')
    ok(pg.locator('#chgBtn.filled').count() == 1 and pg.locator('#keepBtn.quiet').count() == 1, 'the filled Change the testimony and the quiet Keep it as written')
    shot(pg, 'pos_check_same.png')
    pg.click('#keepBtn'); settle(pg, 700)
    ok(pg.evaluate('location.hash') in ('#/', '#'), 'Keep it as written goes Home')
    ok(not step_rows(pg) and 'Kept as written.' in (text(pg, '#toast') or '') and 'Undo' in (text(pg, '#toast') or ''), 'the step ends, with a toast and Undo')
    goto(pg, '#/bill/HB2121'); ok(pg.locator('#bPosHold').count() == 0, 'kept: no strip')
    goto(pg, FILE); ok(pg.locator('#posHold').count() == 0 and pg.locator('#subBtn').count() == 1, 'kept: File testimony is not held')
    goto(pg, '#/'); pg.evaluate("() => { const x = document.querySelector('#toast'); }")
    # Undo, from a fresh Keep
    set_pos(pg, 'HB2121', 'strongly_support'); set_pos(pg, 'HB2121', 'support'); goto(pg, '#/'); ok(len(step_rows(pg)) == 1, 'a new change after Keep holds again')
    pg.click('a.sr3:has-text("Check your testimony")'); settle(pg); pg.click('#keepBtn'); settle(pg, 700)
    pg.click('#toast a, #toast button:has-text("Undo")'); settle(pg, 600)
    ok(len(step_rows(pg)) == 1, 'Undo of Keep brings the step back')
    pg.context.close()
    # ---- 10. someone else's File step is held, with no filled button
    pg = open_as(br, 'NT', 1440, 900, '')
    pg.evaluate("""async () => { const m = await import('/staff6/data.js'); const b = m.S.bills.find(x => x.bill_number.replace(/\\s/g,'') === 'HB2300'); const kv = m.S.advocates.find(a => a.initials === 'KV'); m.S.assignments[b.id] = [kv.id]; }""")   # Kevin leads it and writes; Nate sent it and files it
    set_pos(pg, 'HB2300', 'oppose')
    ok(not step_rows(pg), 'the check step is the writer\'s, not the filer\'s')
    goto(pg, FILE2); body = text(pg, '#app') or ''
    ok('Position changed' in body and 'It cannot be filed until it is checked.' in body, 'the File step for another person shows the amber box')
    ok('Kevin is checking it. You will get the step File testimony again when it is approved.' in body, 'it names the writer and says what comes next')
    ok(pg.locator('#app .pn .btn.filled').count() == 0 and pg.locator('#subBtn').count() == 0 and pg.locator('#chkGo').count() == 0, 'no filled button and no Submit for anyone but the writer')
    shot(pg, 'pos_file_other.png')
    pg.context.close()
    # ---- 11. 390 wide
    pg = open_as(br, 'KV', 390, 844, '#/bill/HB2121')
    pg.click('#bEditGo'); settle(pg, 250); pg.click('label.bs:has(#bp-oppose)'); pg.click('#bSave'); settle(pg, 700)
    ok(pg.locator('#bPosHold').count() == 1 and overflow(pg), 'the bill page strip fits at 390')
    goto(pg, CHK); ok(pg.locator('#chgBtn').is_visible() and overflow(pg), 'the check page fits at 390 and its button shows'); shot(pg, 'pos_390.png')
    goto(pg, FILE); ok(pg.locator('#chkGo').is_visible() and overflow(pg), 'the held File step fits at 390'); shot(pg, 'pos_390_file.png')
    goto(pg, '#/'); ok(overflow(pg), 'Home fits at 390')
    pg.context.close(); br.close()
ok(not errs, f'no page errors {errs[:3]}')
print(f'{sum(res)} passed, {len(res) - sum(res)} failed'); sys.exit(0 if all(res) else 1)
