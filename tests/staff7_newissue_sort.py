# Staff7 piece 10 part B (R-398): the New issue door from Sort new bills, on the practice copy. The link "No issue fits? New issue" under the Issue field; the form as a panel over the dimmed sort page
# (Close X, Escape, "For <bill>. It goes on the new issue once you track it."); saving picks the draft for the bill with the sort exactly where it was (list scroll, the open bill, the other picks),
# Track on, the draft helper line, the toast with Undo (Undo archives the draft and clears the pick); "Use that one" picks the clash and closes; words kept per bill; "(draft)" in the select.
#   python3 tests/staff7_newissue_sort.py [base] [shots folder]     base defaults to http://127.0.0.1:8857
import sys, os, re
from playwright.sync_api import sync_playwright
BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8857').rstrip('/')
SHOTS = sys.argv[2] if len(sys.argv) > 2 else ''
if SHOTS: os.makedirs(SHOTS, exist_ok=True)
res = []
def ok(c, m): res.append(bool(c)); print('PASS' if c else 'FAIL', m, flush=True)

TOAST = "() => { const t = document.getElementById('toast'); return t && t.classList.contains('on') ? { msg: t.querySelector('#toastMsg').innerText.trim(), undo: !t.querySelector('#toastUndo').hidden } : null; }"
NOSIDE = "() => document.documentElement.scrollWidth <= innerWidth"
MODEL = """async () => { const D = await import('/staff7/sort_data.js'), d = await import('/staff6/data.js'); const me = d.S.me, l = D.listFor(me, 'matching');
  return l.rows.map(m => ({ no: m.no, sg: !!D.suggestion(m) })); }"""
ISS = """() => { const s = document.getElementById('dIss'); return { text: s.selectedOptions[0]?.innerText || '', val: s.value, opts: [...s.options].map(o => o.innerText) }; }"""
PANEL = "() => { const p = document.querySelector('.nipanel'); if (!p) return null; const r = p.getBoundingClientRect(); return { x: Math.round(r.left), w: Math.round(r.width), h: Math.round(r.height), vw: innerWidth, vh: innerHeight, head: document.getElementById('niPanelH')?.innerText, inert: document.getElementById('app').hasAttribute('inert'), x2: !!document.getElementById('niPanelX'), txt: p.innerText }; }"
STATE = """() => { const w = document.querySelector('.wl'); return { open: document.querySelector('.wl a.sr3.sel')?.dataset.no || '', y: w ? Math.round(w.scrollTop) : -1, pos: document.getElementById('dPos')?.value, camp: document.getElementById('dCamp')?.value, lead: document.getElementById('dLead')?.value, hash: location.hash }; }"""

def open_as(br, who, w, h, hash):
    ctx = br.new_context(viewport={'width': w, 'height': h}); pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'Failed to load resource' not in m.text and 'ERR_FAILED' not in m.text else None)
    pg.goto(f'{BASE}/staff7.html?demo=1&as={who}' + hash); pg.wait_for_selector('.paper', timeout=60000)
    pg.evaluate("Promise.all([document.fonts.load('600 16px Poppins'), document.fonts.load('400 16px Lato'), document.fonts.load('700 16px Lato')])"); pg.wait_for_timeout(400)
    pg.errs = errs
    return pg
def go(pg, h): pg.evaluate("h => { window.__staff7TrailReset && window.__staff7TrailReset(); location.hash = h; }", h); pg.wait_for_timeout(450)
def snap(pg, name):
    if SHOTS: pg.screenshot(path=os.path.join(SHOTS, name + '.png'))
def fill_form(pg, name, desc, cat_idx=0):
    pg.fill('#niNameIn', name); pg.locator('.nipanel .nitop').nth(cat_idx).click(); pg.fill('#niDescIn', desc)

with sync_playwright() as p:
    br = p.chromium.launch()

    # ---------------------------------------------------------------- 1440 as Nate: the link, the panel, Escape, kept words
    pg = open_as(br, 'NT', 1440, 900, '#/issues/new'); pg.wait_for_selector('.wl a.sr3[data-no]', timeout=30000); pg.wait_for_timeout(400)
    rows = pg.evaluate(MODEL); ok(len(rows) > 12, f'the long list is there ({len(rows)} bills)')
    nosg = [r for r in rows[4:] if not r['sg']]; target = nosg[0]['no']
    go(pg, '#/issues/new/' + target); pg.wait_for_selector('#dIss')
    pg.evaluate("() => { document.querySelector('.wl').scrollTop = 420; }"); pg.wait_for_timeout(200)
    pg.select_option('#dPos', 'support'); camps = pg.evaluate("() => [...document.querySelectorAll('#dCamp option')].map(o => o.value)")
    pg.select_option('#dCamp', camps[1]); pg.wait_for_timeout(200)
    before = pg.evaluate(STATE); ok(before['open'] == target and before['y'] > 100 and before['pos'] == 'support' and before['camp'] == camps[1], f'set up: bill {target} open, list scrolled ({before["y"]}), picks made')
    link = pg.locator('#dNewIssue'); ok(link.count() == 1 and link.inner_text().strip() == 'No issue fits? New issue', 'the link reads "No issue fits? New issue"')
    sb, lb = pg.locator('#dIss').bounding_box(), link.bounding_box()
    ok(lb['y'] >= sb['y'] + sb['height'] - 2 and abs(lb['x'] - sb['x']) < 6, f'the link sits under the Issue field, at its left edge ({lb["x"]:.0f},{lb["y"]:.0f} vs {sb["x"]:.0f},{sb["y"]:.0f})')
    snap(pg, 'sort_door')
    link.click(); pg.wait_for_selector('.nipanel'); pg.wait_for_timeout(250)
    P = pg.evaluate(PANEL)
    ok(P and P['head'] == 'New issue' and P['x2'], 'the link opens a panel headed "New issue" with a Close X')
    ok(P['x'] + P['w'] == P['vw'] and P['h'] == P['vh'] and 500 < P['w'] < 700, f'the panel is on the right, full height ({P["w"]} wide of {P["vw"]})')
    ok(P['inert'] and pg.locator('#niScrim').count() == 1, 'the sort page behind is dimmed and cannot be reached (scrim, inert)')
    ok(re.search(r'^For .+ [A-Z]{2} \d+\. It goes on the new issue once you track it\.', P['txt'], re.M), f'the line "For <bill>. It goes on the new issue once you track it." ({P["txt"].splitlines()[1] if len(P["txt"].splitlines()) > 1 else ""!r})')
    ok(pg.evaluate("() => document.activeElement.id") == 'niNameIn', 'the Name field has the focus')
    snap(pg, 'sort_panel')
    pg.keyboard.press('Escape'); pg.wait_for_timeout(250)
    ok(pg.locator('.nipanel').count() == 0 and not pg.evaluate("() => document.getElementById('app').hasAttribute('inert')"), 'Escape closes the panel and the page is live again')
    ok(pg.evaluate("() => document.activeElement.id") == 'dNewIssue' and pg.evaluate(STATE)['hash'] == before['hash'], 'the focus goes back to the link; Escape did not leave the page')

    # kept words
    link.click(); pg.wait_for_selector('.nipanel')
    ok(pg.locator('#niKept').count() == 0, 'a first opening has no "words from before" note')
    fill_form(pg, 'Sample issue for sorting', 'Sample description for sorting.', 2)
    pg.evaluate("() => window.__staff7Render({ tick: true })"); pg.wait_for_timeout(300)
    ok(pg.locator('.nipanel').count() == 1 and pg.input_value('#niNameIn') == 'Sample issue for sorting', 'a redraw of the page behind leaves the panel open and its words in')
    pg.click('#niPanelX'); pg.wait_for_timeout(250); ok(pg.locator('.nipanel').count() == 0, 'Close X closes the panel')
    pg.evaluate("() => window.__staff7Render({ tick: true })"); pg.wait_for_timeout(300)
    pg.click('#dNewIssue'); pg.wait_for_selector('.nipanel')
    ok(pg.input_value('#niNameIn') == 'Sample issue for sorting' and pg.input_value('#niDescIn') == 'Sample description for sorting.' and pg.locator('.nitop input').nth(2).is_checked(), 'reopened after a redraw: name, topic and description are all still there')
    ok('Your words from before are still here.' in pg.locator('#niKept').inner_text(), 'and the note says "Your words from before are still here."')
    snap(pg, 'sort_panel_kept')
    # words are per bill: another bill's panel starts empty
    pg.keyboard.press('Escape'); pg.wait_for_timeout(200)
    other = next(r['no'] for r in rows if r['no'] != target); go(pg, '#/issues/new/' + other); pg.wait_for_selector('#dNewIssue'); pg.click('#dNewIssue'); pg.wait_for_selector('.nipanel')
    ok(pg.input_value('#niNameIn') == '' and pg.locator('#niKept').count() == 0, 'another bill\'s panel starts empty: the words are kept per bill')
    pg.keyboard.press('Escape'); pg.wait_for_timeout(200)
    go(pg, '#/issues/new/' + target); pg.wait_for_selector('#dNewIssue')

    # ---------------------------------------------------------------- the duplicate: Use that one
    ex = pg.evaluate("async () => { const d = await import('/staff6/data.js'); const i = d.S.issues.find(x => !x.archived_at && x.published_at); return { id: i.id, name: i.name }; }")
    pg.click('#dNewIssue'); pg.wait_for_selector('.nipanel'); pg.fill('#niNameIn', ex['name'].upper()); pg.locator('.nipanel .nitop').first.click(); pg.click('#niSave'); pg.wait_for_timeout(250)
    err = pg.locator('#niNameErr').inner_text()
    ok('There is already an issue called' in err and 'Use that one' in err, f'a name that differs only in case is refused with "Use that one" ({err[:70]!r})')
    pg.click('#niUse'); pg.wait_for_timeout(450)
    st = pg.evaluate(ISS)
    ok(pg.locator('.nipanel').count() == 0 and st['val'] == ex['id'], f'"Use that one" closes the panel and picks that issue for the bill ({st["text"]!r})')
    ok(pg.evaluate(STATE)['open'] == target and (TOAST and pg.evaluate(TOAST)), 'the same bill is open and a line says it is picked')
    pg.evaluate("() => { const p = document.getElementById('dIss'); }")

    # ---------------------------------------------------------------- save as draft: the sort stays where it was
    pg.select_option('#dIss', 'none'); pg.select_option('#dPos', 'support'); pg.select_option('#dLead', index=2);   # a Lead chosen by hand is a pick like the others (an untouched Lead follows the issue's owner, as before)
    pg.evaluate("() => { document.querySelector('.wl').scrollTop = 420; }"); pg.wait_for_timeout(200)
    before = pg.evaluate(STATE)
    pg.click('#dNewIssue'); pg.wait_for_selector('.nipanel')
    ok(pg.input_value('#niNameIn') == '', 'after "Use that one" the unwanted words were not kept')
    pg.fill('#niNameIn', 'Sample issue for sorting'); pg.locator('.nipanel .nitop').nth(1).click(); pg.fill('#niDescIn', 'Sample description for sorting.')
    pg.click('#niSave')   # a real click straight after typing in the field above it: the click must not be lost
    pg.wait_for_selector('.nipanel', state='detached', timeout=5000); pg.wait_for_timeout(450)
    after = pg.evaluate(STATE)
    ok(after['open'] == before['open'] and after['hash'] == before['hash'] and abs(after['y'] - before['y']) <= 2, f'the sort is where it was: bill {after["open"]}, list scroll {before["y"]} -> {after["y"]}')
    ok(after['pos'] == before['pos'] and after['camp'] == before['camp'] and after['lead'] == before['lead'], f'every other pick is as it was (Position, Coalition, Lead) {before} {after}')
    st = pg.evaluate(ISS)
    ok(st['text'] == 'Sample issue for sorting (draft)' and st['val'].startswith('demo-'), f'the Issue field shows "{st["text"]}" and has it picked')
    ok(pg.is_enabled('#sTrack') and pg.locator('#sTrack').get_attribute('aria-describedby') is None, 'Track is on')
    note = pg.locator('#dTrackNote').inner_text()
    ok(re.fullmatch(r'Sample issue for sorting is a draft: only the team sees it until you publish it\.', note), f'Nate is the admin who publishes, so the helper says "you": {note!r}')
    t = pg.evaluate(TOAST); ok(t and t['msg'] == 'Saved Sample issue for sorting as a draft. It is picked for this bill.' and t['undo'], f'the toast has Undo: {t and t["msg"]!r}')
    ok(pg.evaluate("() => document.activeElement.id") == 'dNewIssue', 'the focus is back on the link')
    snap(pg, 'sort_saved')
    ok('' == pg.evaluate("async () => { const d = await import('/staff6/data.js'); const i = d.S.issues.find(x => x.name === 'Sample issue for sorting'); return i && !i.published_at && !i.archived_at && i.owner_id === d.S.me.id ? '' : 'bad'; }"), 'the new issue is a draft led by the person who saved it')
    ok(pg.evaluate("async () => { const D = await import('/staff7/sort_data.js'); return Object.keys(D.U.words).length === 0 || !D.U.words[Object.keys(D.U.words).find(k => D.U.words[k].name)]; }"), 'the words typed are not kept once saved')
    # Undo
    pg.click('#toastUndo'); pg.wait_for_timeout(500)
    gone = pg.evaluate("async () => { const d = await import('/staff6/data.js'); const i = d.S.issues.find(x => x.name === 'Sample issue for sorting'); return !!(i && i.archived_at); }")
    st = pg.evaluate(ISS); after = pg.evaluate(STATE)
    ok(gone and not any('Sample issue for sorting' in o for o in st['opts']), 'Undo takes the draft away again (archived) and out of the Issue field')
    ok(st['val'] != '' and not st['val'].startswith('demo-') or st['val'] == '', f'and clears the pick ({st["text"]!r})')
    ok(after['open'] == before['open'] and after['pos'] == before['pos'] and abs(after['y'] - before['y']) <= 2, 'the sort is still where it was after Undo')
    t = pg.evaluate(TOAST); ok(t and re.fullmatch(r'Took the draft Sample issue for sorting away\. (No issue is picked for this bill\.|.+ is picked for this bill again\.|No issue yet is picked for this bill again\.)', t['msg']), f'Undo says what was put back: {t and t["msg"]!r}')
    # Fix Y 2 and 3: an earlier toast is gone when the panel opens, and "For <bill>" is the heading's name
    ok(pg.evaluate(TOAST) is not None, 'a toast is showing before the panel is opened')
    heading = pg.locator('.pbody ~ * h1, h1').first.inner_text().strip(); heading = pg.evaluate("() => document.querySelector('.hband h1').innerText.trim()")
    pg.click('#dNewIssue'); pg.wait_for_selector('.nipanel'); pg.wait_for_timeout(300)
    ok(pg.evaluate(TOAST) is None, 'opening the panel closes the earlier toast (it cannot cover Save)')
    ok(pg.evaluate("() => document.querySelector('.nipfor b').innerText.trim()") == heading, f'the panel\'s "For <bill>" is the page heading ({heading!r})')
    pg.keyboard.press('Escape'); pg.wait_for_selector('.nipanel', state='detached', timeout=5000)

    # ---------------------------------------------------------------- "(draft)" on every draft in the select
    pg.evaluate("""async () => { const d = await import('/staff6/data.js'); await d.DB.createIssue({ name: 'Sample draft in the list', description: 'Sample.', category: d.S.categories[0].key }); window.__staff7Render({ tick: true }); }"""); pg.wait_for_timeout(400)
    opts = pg.evaluate(ISS)['opts']
    ok('Sample draft in the list (draft)' in opts and not any(o.endswith('(draft)') for o in opts if o != 'Sample draft in the list (draft)'), 'every draft in the Issue field says "(draft)" and published issues do not')
    ok(pg.evaluate("() => !document.getElementById('dIss').innerHTML.includes('Sample issue for sorting')"), 'an archived draft is not listed')
    errs = pg.errs; pg.context.close()
    ok(not errs, f'no page errors at 1440 {errs[:2]}')

    # ---------------------------------------------------------------- 390: the panel on a phone
    pg = open_as(br, 'NT', 390, 844, '#/issues/new'); pg.wait_for_selector('.wl a.sr3[data-no], #dIss', timeout=30000); pg.wait_for_timeout(400)
    rows = pg.evaluate(MODEL); go(pg, '#/issues/new/' + rows[3]['no']); pg.wait_for_selector('#dNewIssue')
    ok(pg.locator('#dNewIssue').is_visible() and pg.evaluate(NOSIDE), 'at 390 the link shows and the page does not scroll sideways')
    pg.click('#dNewIssue'); pg.wait_for_selector('.nipanel'); pg.wait_for_timeout(250); P = pg.evaluate(PANEL)
    ok(P['w'] == P['vw'] and P['h'] == P['vh'] and P['x'] == 0, f'the panel fills the phone ({P["w"]}x{P["h"]})')
    ok(pg.evaluate(NOSIDE) and pg.evaluate("() => { const p = document.querySelector('.nipanel'); return p.scrollWidth <= p.clientWidth + 1; }"), 'no sideways scroll in the panel')
    small = pg.evaluate("() => [...document.querySelectorAll('.nipanel .btn, .nipanel .xbtn, .nipanel .nitop')].filter(e => e.getBoundingClientRect().height < 43.5).map(e => e.className)")
    ok(not small, f'every button and topic row in the panel is at least 44 tall {small}')
    fill_form(pg, 'Sample phone issue', 'Sample description.', 0); pg.fill('#niNameIn', '')
    pg.click('#niSave'); pg.wait_for_timeout(250)
    ok('Give the issue a name.' in pg.locator('#niNameErr').inner_text() and pg.evaluate("() => document.activeElement.id") == 'niNameIn', 'the Name error shows and the focus goes to Name')
    snap(pg, 'sort_panel_390')
    pg.keyboard.press('Escape'); pg.wait_for_timeout(200); ok(pg.locator('.nipanel').count() == 0, 'Escape closes the panel on the phone')
    pg.click('#dNewIssue'); pg.wait_for_selector('.nipanel')
    ok(pg.input_value('#niDescIn') == 'Sample description.' and 'still here' in pg.locator('#niKept').inner_text(), 'the words typed on the phone are kept too')
    pg.fill('#niNameIn', 'Sample phone issue'); pg.click('#niSave'); pg.wait_for_selector('.nipanel', state='detached', timeout=5000); pg.wait_for_timeout(400)
    ok('Sample phone issue (draft)' == pg.evaluate(ISS)['text'], 'saved on the phone: the Issue field shows it as a draft')
    errs = pg.errs; ok(not errs, f'no page errors at 390 {errs[:2]}')
    br.close()

print(f'{sum(res)}/{len(res)} passed')
sys.exit(0 if all(res) else 1)
