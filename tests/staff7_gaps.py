# R-398 piece 9, the four small gaps on pages already built (the practice copy). Part 1, gap A: "I'm going" on the File testimony step ("How we testify") and "Who is going" on the Calendar's hearing page,
# one attendance (hearing_attendance through DB.attend) read in both places; an admin may add a teammate; the 390-wide fault where "The approved testimony" overlapped "Download the PDF". Other parts add their own sections below.
#   python3 tests/staff7_gaps.py [base] [shots folder]     base defaults to http://127.0.0.1:8855
import sys, os, re
from playwright.sync_api import sync_playwright
BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8855').rstrip('/')
SHOTS = sys.argv[2] if len(sys.argv) > 2 else ''
if SHOTS: os.makedirs(SHOTS, exist_ok=True)
res = []
def ok(c, m): res.append(bool(c)); print('PASS' if c else 'FAIL', m, flush=True)

def open_as(br, who, w, h, hash='', errs=None):
    ctx = br.new_context(viewport={'width': w, 'height': h}); pg = ctx.new_page()
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'Failed to load resource' not in m.text and 'ERR_FAILED' not in m.text else None)
    pg.goto(f'{BASE}/staff7.html?demo=1&as={who}{hash}'); pg.wait_for_selector('html[data-ready="1"]', state='attached', timeout=60000)
    pg.evaluate("Promise.all([document.fonts.load('600 16px Poppins'), document.fonts.load('400 16px Lato'), document.fonts.load('700 16px Lato')])"); pg.wait_for_timeout(600)
    return pg
def settle(pg, ms=450): pg.wait_for_timeout(ms)
def goto(pg, h): pg.evaluate(f"() => {{ window.__staff7TrailReset && window.__staff7TrailReset(); location.hash = {h!r}; }}"); settle(pg)
def shot(pg, name):
    if SHOTS: pg.mouse.move(2, 2); pg.wait_for_timeout(800); pg.screenshot(path=os.path.join(SHOTS, name))   # mouse off every button, fades finished

# the first File testimony step, and the hearing it is for: found by the Calendar sitting whose "File testimony" button leads to the step
FIND = """async () => { const d = await import('/staff6/data.js'); const L = document.getElementById('laterBtn'); if (L && L.getAttribute('aria-expanded') === 'false') L.click();
  return [...document.querySelectorAll('a.sr3')].filter(a => /^File testimony/.test(a.innerText.trim())).map(a => a.getAttribute('href')); }"""
SITS = "() => [...new Set([...document.querySelectorAll('a[href^=\"#/calendar/sitting/\"]')].map(a => a.getAttribute('href')))]"
CLEAR = "async () => { const d = await import('/staff6/data.js'); d.S.attend = {}; window.__staff7Render({ tick: true }); }"
SETMATE = "async () => { const d = await import('/staff6/data.js'); const h = document.getElementById('going')?.dataset.h; const x = d.S.advocates.find(a => a.id !== d.S.me.id && a.is_active !== false); d.S.attend = { [h]: [x.id] }; window.__staff7Render({ tick: true }); return x.full_name.split(' ')[0]; }"
HEARING_OF = """async (step) => { const d = await import('/staff6/data.js'); const m = await import('/staff6/model.js'); return null; }"""
TOAST = "() => { const t = document.getElementById('toast'); return { on: t.classList.contains('on'), msg: document.getElementById('toastMsg').innerText, undo: !document.getElementById('toastUndo').hidden }; }"
CHOOSE = "() => { const r = [...document.querySelectorAll('.copyrow')].find(r => /How we testify/.test(r.innerText)); return r ? { val: r.querySelector('b').innerText, sub: r.querySelector('.sub')?.innerText || '', btn: r.querySelector('#goBtn')?.innerText || '' } : null; }"
GOING = "() => { const g = document.getElementById('going'); return g ? { who: g.querySelector('.gwho b').innerText, btns: [...g.querySelectorAll('.gact .btn')].map(b => b.innerText.trim()), h: g.dataset.h } : null; }"
def find_pair(pg):
    steps = pg.evaluate(FIND); goto(pg, '#/calendar'); sits = pg.evaluate(SITS)
    for s in sits:
        goto(pg, s)
        href = pg.evaluate("() => document.getElementById('rdyGo')?.getAttribute('href') || ''")
        if href in steps: return href, s
    return None, None
def clear_calendar_picks(pg): pass

errs = []
with sync_playwright() as p:
    br = p.chromium.launch()
    pg = open_as(br, 'NT', 1440, 900, '', errs)
    step, sit = find_pair(pg)
    ok(step and sit, f'found a File testimony step and its hearing ({step}, {sit})')
    if not step: sys.exit(1)

    # ---- the hearing page first: nobody going, the buttons an admin sees
    goto(pg, sit); pg.evaluate(CLEAR); settle(pg)
    g = pg.evaluate(GOING)
    ok(g and g['who'] == 'Nobody yet' and g['btns'] == ['I’m going', 'Add a teammate'], f'calendar, admin, nobody going: "Who is going / Nobody yet", quiet I’m going and Add a teammate ({g})')
    ok(pg.evaluate("() => [...document.querySelectorAll('#going .btn')].every(b => b.classList.contains('quiet') && !b.classList.contains('filled'))"), 'calendar: both going buttons are quiet, never filled')
    shot(pg, 'going_calendar.png')
    # ---- the File step: nobody going
    goto(pg, step); pg.evaluate(CLEAR); settle(pg)
    c = pg.evaluate(CHOOSE)
    ok(c and c['val'] == 'Choose: Written testimony only' and c['sub'].startswith('Nobody is going yet. Someone speaking?') and c['btn'] == 'I’m going', f'file step, nobody going: Written testimony only, "Nobody is going yet", quiet I’m going ({c})')
    ok('quiet' in pg.locator('#goBtn').get_attribute('class') and pg.evaluate("() => document.querySelectorAll('.btn.filled').length") == 1, 'file step: I’m going is quiet; the one filled button is still Submit on the Capitol site')
    shot(pg, 'going_file.png')
    # ---- I'm going on the File step
    pg.click('#goBtn'); settle(pg)
    c = pg.evaluate(CHOOSE); t = pg.evaluate(TOAST)
    ok(c['val'] == 'Choose: In person' and c['sub'].startswith('You’re going. Speaking by video instead? Choose Remote.') and c['btn'] == 'Not going', f'file step after I’m going: Choose: In person, "You’re going.", quiet Not going ({c})')
    ok(pg.evaluate("() => getComputedStyle(document.querySelector('.copyrow .gnow')).fontWeight") in ('700', '600', 'bold'), 'file step: "You’re going." is bold')
    ok(t['on'] and t['undo'] and re.match(r'You’re going to the .+ hearing on (Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\.$', t['msg']), f'file step: the toast with Undo ({t["msg"]})')
    shot(pg, 'going_file_on.png')
    r = pg.evaluate("() => ({ b: document.getElementById('goBtn').getBoundingClientRect().bottom, t: document.querySelector('#toast .tin').getBoundingClientRect().top })")
    ok(r['b'] <= r['t'], f'file step 1440x900: the toast does not cover the How we testify row ({r})')
    # the change shows on the Calendar hearing page
    goto(pg, sit); g = pg.evaluate(GOING)
    ok(g['who'] == 'You' and g['btns'] == ['Not going', 'Add a teammate'], f'the same change shows on the Calendar hearing page: "You", Not going ({g})')
    # ---- Undo on the File step puts it back
    goto(pg, step); pg.click('#goBtn'); settle(pg); pg.click('#toastUndo'); settle(pg)
    c = pg.evaluate(CHOOSE)
    ok(c['val'] == 'Choose: In person' and c['btn'] == 'Not going', f'Undo on the toast for Not going puts "In person" back ({c})')
    pg.click('#goBtn'); settle(pg); t = pg.evaluate(TOAST)
    ok(re.match(r'You’re not going to the .+ hearing\.$', t['msg']) and t['undo'], f'Not going: its own toast with Undo ({t["msg"]})')
    c = pg.evaluate(CHOOSE)
    ok(c['val'] == 'Choose: Written testimony only' and c['btn'] == 'I’m going', f'Not going: back to Written testimony only ({c})')
    pg.click('#toastUndo'); settle(pg); c = pg.evaluate(CHOOSE)
    ok(c['val'] == 'Choose: In person', 'Undo of Not going puts "In person" back')
    pg.click('#goBtn'); settle(pg); pg.wait_for_timeout(100)
    # Undo of I'm going
    pg.click('#goBtn'); settle(pg); pg.click('#toastUndo'); settle(pg); c = pg.evaluate(CHOOSE)
    ok(c['val'] == 'Choose: Written testimony only', 'Undo of I’m going puts "Written testimony only" back')
    # ---- the other way round: on the Calendar, shows on the File step
    goto(pg, sit); pg.click('#goBtn'); settle(pg); t = pg.evaluate(TOAST); g = pg.evaluate(GOING)
    ok(g['who'] == 'You' and g['btns'][0] == 'Not going' and re.match(r'You’re going to the .+ hearing on \w+day\.$', t['msg']) and t['undo'], f'calendar I’m going: "You", Not going, toast with Undo ({g}, {t["msg"]})')
    goto(pg, step); c = pg.evaluate(CHOOSE)
    ok(c['val'] == 'Choose: In person' and 'You’re going.' in c['sub'], f'a change made on the Calendar shows on the File step ({c})')
    goto(pg, sit); pg.click('#goBtn'); settle(pg); g = pg.evaluate(GOING)
    ok(g['who'] == 'Nobody yet' and g['btns'][0] == 'I’m going', f'calendar Not going: back to Nobody yet ({g})')
    pg.click('#toastUndo'); settle(pg); ok(pg.evaluate(GOING)['who'] == 'You', 'calendar: Undo of Not going')
    # ---- admin: Add a teammate
    pg.click('#goAdd'); settle(pg, 200)
    ok(pg.locator('#goPick').is_visible() and pg.locator('#goPick button.pk').count() >= 2, 'admin: Add a teammate opens a small picker of staff')
    shot(pg, 'going_calendar_pick.png')
    pg.keyboard.press('Escape'); settle(pg, 200)
    ok(not pg.locator('#goPick').is_visible() and '#/calendar' in pg.url, 'the picker closes with Escape (the page stays)')
    pg.click('#goAdd'); pg.click('#goPickX'); settle(pg, 200)
    ok(not pg.locator('#goPick').is_visible(), 'the picker closes with its X')
    pg.click('#goAdd'); settle(pg, 200)
    ok(pg.locator('#goPick').get_attribute('aria-label') == 'Who is going?' and pg.locator('#goPick button.pk[aria-pressed="true"]').count() == 1 and pg.locator('#goPick button.pk[aria-pressed="true"]').inner_text().startswith(pg.locator('#goPick button.pk').first.inner_text().split(' ')[0]), 'picker: labelled "Who is going?", everyone listed as toggles, only me pressed (a tick)')
    other = pg.locator('#goPick button.pk[aria-pressed="false"]').first; wid = other.get_attribute('data-who'); name = other.inner_text().split(' ')[0]; other.click(); settle(pg)
    g = pg.evaluate(GOING); t = pg.evaluate(TOAST)
    ok(g['who'] == f'You and {name}' and t['on'] and t['undo'] and name in t['msg'] and 'is going to the' in t['msg'], f'Add a teammate: "You and {name}", toast with Undo ({g["who"]} / {t["msg"]})')
    pk = pg.locator(f'#goPick [data-who="{wid}"]')
    ok(pg.locator('#goPick').is_visible() and pk.get_attribute('aria-pressed') == 'true' and pk.locator('svg').count() == 1, 'picker stays open; the name just added is pressed with a tick')
    shot(pg, 'going_calendar_pick.png')
    pg.mouse.move(5, 5); pg.keyboard.press('Escape'); settle(pg, 900); shot(pg, 'going_calendar_on.png'); pg.click('#goAdd'); settle(pg, 200)
    pg.click('#toastUndo'); settle(pg)
    ok(pg.evaluate(GOING)['who'] == 'You', 'Undo of Add a teammate takes them off again')
    # anyone can be taken off again by pressing their name (not only by Undo)
    pg.locator(f'#goPick [data-who="{wid}"]').click(); settle(pg); pg.locator(f'#goPick [data-who="{wid}"]').click(); settle(pg)
    t = pg.evaluate(TOAST)
    ok(pg.evaluate(GOING)['who'] == 'You' and pg.locator(f'#goPick [data-who="{wid}"]').get_attribute('aria-pressed') == 'false' and re.search(r'is not going', t['msg']) and t['undo'], f'pressing a pressed name takes them off, with its own toast and Undo ({t["msg"]})')
    pg.click('#toastUndo'); settle(pg)
    ok(pg.evaluate(GOING)['who'] == f'You and {name}', 'Undo of taking them off puts them back')
    pg.locator(f'#goPick [data-who="{wid}"]').click(); settle(pg)
    ok(pg.evaluate(GOING)['who'] == 'You', 'taken off again')
    pg.keyboard.press('Escape'); settle(pg, 200)
    # someone else going, not the person filing
    mate = pg.evaluate(SETMATE); settle(pg)
    g = pg.evaluate(GOING)
    ok(g['who'] == mate and g['btns'][0] == 'I’m going', f'calendar: another person going is named, and I’m going is still offered ({g})')
    goto(pg, step); pg.evaluate("async (h) => { const d = await import('/staff6/data.js'); const x = d.S.advocates.find(a => a.id !== d.S.me.id && a.is_active !== false); d.S.attend = { [h]: [x.id] }; window.__staff7Render({ tick: true }); }", g['h']); settle(pg)
    c = pg.evaluate(CHOOSE)
    ok(c['val'] == 'Choose: In person' and c['sub'].startswith(f'{mate} is going.') and c['btn'] == 'I’m going', f'file step: someone else is going: "{c["sub"]}" and I’m going offered ({c})')
    pg.context.close()

    # ---- a non-admin sees no Add a teammate
    pg = open_as(br, 'KV', 1440, 900, '', errs)
    step2, sit2 = find_pair(pg)
    if sit2:
        goto(pg, sit2); g = pg.evaluate(GOING)
        ok(g and 'Add a teammate' not in g['btns'] and g['btns'][0] in ('I’m going', 'Not going') and pg.locator('#goAdd, #goPick').count() == 0, f'calendar, staff (not admin): no Add a teammate ({g})')
    else:
        # KV has no file step with a hearing of his own on Mine: any hearing page on his calendar will do
        goto(pg, '#/calendar'); s0 = pg.evaluate(SITS)
        goto(pg, s0[0]); g = pg.evaluate(GOING)
        ok(g and 'Add a teammate' not in g['btns'] and pg.locator('#goAdd, #goPick').count() == 0, f'calendar, staff (not admin): no Add a teammate ({g})')
    pg.context.close()

    # ---- 390 wide: the label never overlaps Download the PDF, and the going line fits
    pg = open_as(br, 'NT', 390, 844, '', errs)
    step, sit = find_pair(pg)
    goto(pg, step); pg.evaluate(CLEAR); settle(pg)
    BOX = """() => { const r = e => { const b = e.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom }; };
      const row = document.querySelector('.pdfrow'), lab = row.querySelector('.g b'), dl = document.getElementById('pdfBtn'), op = document.getElementById('openDoc');
      return { lab: r(lab), dl: r(dl), op: r(op), row: r(row), sx: document.documentElement.scrollWidth <= innerWidth }; }"""
    bx = pg.evaluate(BOX)
    inter = lambda a, b: not (a['r'] <= b['l'] or b['r'] <= a['l'] or a['b'] <= b['t'] or b['b'] <= a['t'])
    ok(not inter(bx['lab'], bx['dl']) and not inter(bx['lab'], bx['op']) and bx['lab']['b'] <= bx['dl']['t'] + 1, f'390 wide: "The approved testimony" is above the controls and overlaps neither ({bx})')
    ok(bx['dl']['r'] <= bx['row']['r'] + 1 and bx['op']['r'] <= bx['row']['r'] + 1 and bx['sx'], '390 wide: both controls inside the row, no sideways scroll')
    pg.evaluate("document.querySelector('#copyRows').scrollIntoView({block:'center'})"); settle(pg, 200)
    shot(pg, 'going_390_off.png')
    pg.click('#goBtn'); settle(pg)
    ok(pg.evaluate("() => document.documentElement.scrollWidth <= innerWidth") and pg.evaluate(CHOOSE)['val'] == 'Choose: In person', '390 wide: I’m going works and nothing scrolls sideways')
    pg.evaluate("document.querySelector('#copyRows').scrollIntoView({block:'center'})"); settle(pg, 200)
    shot(pg, 'going_390.png')
    # the hearing page at 390
    goto(pg, sit); g = pg.evaluate(GOING)
    ok(g and pg.evaluate("() => document.documentElement.scrollWidth <= innerWidth"), f'390 wide: the hearing page has its going row and no sideways scroll ({g})')
    shot(pg, 'going_calendar_390.png')
    pg.context.close()
    br.close()

ok(not errs, f'no page errors ({errs[:2]})')
print(f'{sum(res)} passed, {len(res) - sum(res)} failed')
sys.exit(0 if all(res) else 1)
