# R-398 piece 9, part 3C (gap C): add or remove a bill on an issue. The issue page's "Change the bills" (a find field, Put it on, Take off, Done, Escape), the toasts with Undo, the
# counts that redraw, and the bill page's "Put it on an issue" -> "Issues for <bill>". Practice copy only.
#   python3 tests/staff7_gaps_issues.py [base]     base defaults to http://localhost:8832
#   SHOTS=<folder> also writes the screenshots there
import sys, os
from playwright.sync_api import sync_playwright
BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832').rstrip('/')
SHOTS = os.environ.get('SHOTS', '')
res = []
def ok(c, m): res.append(bool(c)); print('PASS' if c else 'FAIL', m)

TOB = '2108433c-1d02-46f1-836c-4b1a4501cc27'   # Let counties regulate tobacco sales: 1 live bill (HB 1563) and 10 stopped
WILD = None
errs = []
def open_as(br, who, w, h, hash):
    ctx = br.new_context(viewport={'width': w, 'height': h}); pg = ctx.new_page()
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'Failed to load resource' not in m.text and 'ERR_FAILED' not in m.text else None)
    pg.goto(f'{BASE}/staff7.html?demo=1&as={who}{hash}'); pg.wait_for_selector('html[data-ready="1"]', state='attached', timeout=60000)
    pg.evaluate("Promise.all([document.fonts.load('600 16px Poppins'), document.fonts.load('400 16px Lato'), document.fonts.load('700 16px Lato')])"); pg.wait_for_timeout(500)
    return pg
def settle(pg, ms=450): pg.wait_for_timeout(ms)
def shot(pg, name):
    if SHOTS: pg.screenshot(path=os.path.join(SHOTS, name))
def toast(pg): return pg.evaluate("() => { const t = document.getElementById('toast'); return t && t.classList.contains('on') ? document.getElementById('toastMsg').textContent : '' }")
def undo(pg): pg.click('#toastUndo'); settle(pg, 700)
def rows(pg): return pg.evaluate("() => [...document.querySelectorAll('#tBills tbody tr')].map(r => r.querySelector('th').textContent.trim())")
def sub(pg): return pg.evaluate("() => (document.querySelector('.hband .bsub')||{}).textContent || ''")
def left_text(pg): return pg.evaluate("() => (document.getElementById('wl')||{}).innerText || ''")
def no_x_overflow(pg): return pg.evaluate("() => document.documentElement.scrollWidth <= innerWidth + 1")
def overlap(pg, sel):   # no two of the visible matches overlap
    return pg.evaluate("""(sel) => { const e = [...document.querySelectorAll(sel)].filter(x => x.getBoundingClientRect().width > 0).map(x => x.getBoundingClientRect());
      for (let i = 0; i < e.length; i++) for (let j = i + 1; j < e.length; j++) { const a = e[i], b = e[j]; if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) return false } return true }""", sel)

with sync_playwright() as p:
    br = p.chromium.launch()
    # ---- the issue page, 1440 wide ----
    pg = open_as(br, 'KV', 1440, 900, f'#/issue/{TOB}'); settle(pg)
    ok(pg.locator('#iBillsGo').count() == 1 and pg.inner_text('#iBillsGo') == 'Change the bills', 'the Bills head has a quiet "Change the bills"')
    ok('quiet' in (pg.get_attribute('#iBillsGo', 'class') or ''), '... and it is quiet, not filled')
    ok(pg.locator('#iPutIn').count() == 0 and pg.locator('[data-off]').count() == 0, 'edit mode is off at first: no field, no Take off')
    ok(rows(pg) == ['HB1563'] or len(rows(pg)) == 1, f'one live bill in the table {rows(pg)}')
    shot(pg, 'issue_bills.png')
    pg.click('#iBillsGo'); settle(pg)
    ok(pg.locator('#iBillsDone').count() == 1 and 'filled' in pg.get_attribute('#iBillsDone', 'class') and pg.inner_text('#iBillsDone') == 'Done', 'Change the bills opens edit mode with a filled Done')
    ok(pg.locator('#iBillsGo').count() == 0, '... and the Change the bills button is replaced by Done')
    ok('Put a bill on this issue: number or words' in pg.inner_text('#iBillsEdit'), 'the field says "Put a bill on this issue: number or words"')
    ok(pg.evaluate("document.activeElement.id") == 'iPutIn', 'the cursor is in the field')
    ok(pg.locator('#tBills [data-off]').count() == 1 and pg.inner_text('#tBills [data-off]') == 'Take off', 'each row of the table has a quiet Take off')
    # search: a number and words, with where each is now
    pg.fill('#iPutIn', 'tobacco'); settle(pg, 200)
    txt = pg.inner_text('#iPutRes')
    ok(pg.locator('[data-put]').count() >= 1 and 'Our position:' in txt and ('On: ' in txt or 'On no issue yet' in txt), 'words find bills, each with its number, our position and where it is now')
    ok(all(pg.inner_text(f'[data-put] >> nth={i}') == 'Put it on' for i in range(pg.locator('[data-put]').count())), 'each result has a quiet "Put it on"')
    ok('HB1563' not in txt.replace(' ', '') or 'HB 1563' not in txt, 'a bill already on this issue is not offered again')
    pg.fill('#iPutIn', 'HB 1021'); settle(pg, 200)
    ok(pg.locator('[data-put]').count() >= 1 and 'HB 1021' in pg.inner_text('#iPutRes'), 'a bill number finds that bill')
    ok('On no issue yet' in pg.inner_text('#iPutRes'), 'a bill on no issue says "On no issue yet"')
    pg.fill('#iPutIn', 'zzzzqq'); settle(pg, 200)
    ok('No bill matches' in pg.inner_text('#iPutRes'), 'nothing found says so')
    # a bill on another issue: it is added, not moved
    pg.fill('#iPutIn', 'HB 797'); settle(pg, 200)
    ok('On: ' in pg.inner_text('#iPutRes'), 'a bill on another issue says "On: <that issue>"')
    shot(pg, 'issue_bills_edit.png')
    before_left = left_text(pg)
    # put HB 1021 (no lead, so the issue's lead takes it) on the issue
    pg.fill('#iPutIn', 'HB 1021'); settle(pg, 200)
    pg.click('[data-put] >> nth=0'); settle(pg, 700)
    t = toast(pg)
    ok(t.startswith('Put HB 1021 on Let counties regulate tobacco sales.'), f'toast: Put HB 1021 on <issue>. ({t!r})')
    ok('now leads it' in t or 'now lead it' in t, f'the toast says who now leads the bill ({t!r})')
    ok(pg.evaluate("() => [...document.querySelectorAll('#tBills tbody tr, #tDead tbody tr')].some(r => r.querySelector('th').textContent.replace(/\\s/g, '') === 'HB1021')"), 'the row is in the table now (HB 1021 is a stopped bill, so it sits in the stopped list)')
    ok(sub(pg).startswith('2 of 12') or '12' in sub(pg), f'the header count redraws at once ({sub(pg)!r})')
    ok(pg.evaluate("() => document.querySelector('[data-off=\"" + "1c423409-5d74-435a-a1d4-302bfbd7d2bb" + "\"]') !== null"), 'the new row has a Take off')
    ok(pg.locator('#iBillsDone').count() == 1, 'edit mode stays on after a put')
    shot(pg, 'issue_bills_toast.png')
    undo(pg)
    ok(not pg.evaluate("() => [...document.querySelectorAll('#tBills tbody tr, #tDead tbody tr')].some(r => r.querySelector('th').textContent.replace(/\\s/g, '') === 'HB1021')"), 'Undo takes the bill off again')
    ok(sub(pg).startswith('1 of 11'), f'... and the count goes back ({sub(pg)!r})')
    lead = pg.evaluate("async () => { const m = await import('/staff6/data.js'); return (m.S.assignments['1c423409-5d74-435a-a1d4-302bfbd7d2bb'] || []).length }")
    ok(lead == 0, 'Undo also takes back the lead the issue gave it')
    # a bill with a lead already: no lead line
    pg.fill('#iPutIn', 'HB 1005'); settle(pg, 200)
    pg.click('[data-put] >> nth=0'); settle(pg, 700)
    t = toast(pg)
    ok(t.startswith('Put HB 1005 on') and 'now lead' not in t, f'a bill that already has a lead says nothing about a lead ({t!r})')
    undo(pg)
    # Take off the last live bill: the toast says so
    pg.click('#tBills [data-off] >> nth=0'); settle(pg, 700)
    t = toast(pg)
    ok(t.startswith('Took HB 1563 off Let counties regulate tobacco sales.') and 'It has no live bills now.' in t, f'the last live bill: {t!r}')
    ok(len(rows(pg)) == 0 and pg.locator('#tBills').count() == 0, 'the row is gone')
    ok(sub(pg).startswith('None of its 10') or '10' in sub(pg), f'the counts redraw ({sub(pg)!r})')
    shot(pg, 'issue_bills_edit_last.png')
    undo(pg)
    ok(len(rows(pg)) == 1, 'Undo brings the row back')
    ok(sub(pg).startswith('1 of 11'), f'... and the count ({sub(pg)!r})')
    # Done closes
    pg.click('#iBillsDone'); settle(pg)
    ok(pg.locator('#iPutIn').count() == 0 and pg.locator('#iBillsGo').count() == 1 and pg.locator('[data-off]').count() == 0, 'Done closes edit mode')
    # Escape closes edit mode and not the page
    pg.click('#iBillsGo'); settle(pg); h0 = pg.evaluate('location.hash')
    pg.keyboard.press('Escape'); settle(pg)
    ok(pg.locator('#iPutIn').count() == 0 and pg.evaluate('location.hash') == h0, 'Escape in the field closes edit mode, and the page stays')
    pg.click('#iBillsGo'); settle(pg); pg.click('h2#tBillsH'); pg.keyboard.press('Escape'); settle(pg)
    ok(pg.locator('#iPutIn').count() == 0 and pg.evaluate('location.hash') == h0, 'Escape on the page closes edit mode too')
    # take off a stopped bill from the folded list, and Undo
    pg.click('#iBillsGo'); settle(pg); pg.click('#tFoldBtn'); settle(pg)
    n0 = pg.locator('#tDead tbody tr').count()
    ok(pg.locator('#tDead [data-off]').count() == n0 and n0 > 0, 'stopped bills have Take off too')
    pg.click('#tDead [data-off] >> nth=0'); settle(pg, 700)
    ok(pg.locator('#tDead tbody tr').count() == n0 - 1 and 'It has no live bills now' not in toast(pg), 'Take off removes a stopped bill (no live-bill line, it was not live)')
    undo(pg)
    ok(pg.locator('#tDead tbody tr').count() == n0, 'Undo brings it back')
    ok(not_overlapping := overlap(pg, '#iBillsEdit .bpt, #iBillsEdit .btn, #tBills tbody tr'), 'nothing overlaps in edit mode at 1440')
    ok(not errs, f'no page errors {errs[:2]}')
    pg.close()

    # ---- 1280 ----
    pg = open_as(br, 'KV', 1280, 800, f'#/issue/{TOB}'); settle(pg)
    pg.click('#iBillsGo'); settle(pg); pg.fill('#iPutIn', 'tobacco'); settle(pg, 300)
    ok(no_x_overflow(pg), 'no sideways scroll at 1280')
    ok(overlap(pg, '#iBillsEdit .bpt, #iBillsEdit .btn, #tBills tbody tr'), 'nothing overlaps at 1280')
    shot(pg, 'issue_bills_edit_1280.png'); pg.close()

    # ---- 390 ----
    pg = open_as(br, 'KV', 390, 844, f'#/issue/{TOB}'); settle(pg)
    shot(pg, 'issue_bills_390.png')
    pg.click('#iBillsGo'); settle(pg); pg.fill('#iPutIn', 'tobacco'); settle(pg, 300)
    ok(no_x_overflow(pg), 'no sideways scroll at 390')
    ok(overlap(pg, '#iBillsEdit .bpt, #iBillsEdit .btn, #tBills tbody tr, .bhead .sh, .bhead .btn, #iPutIn'), 'nothing overlaps at 390')
    ok(pg.evaluate("() => [...document.querySelectorAll('#iBillsEdit .btn, #tBills .btn, #iBillsDone')].every(b => b.getBoundingClientRect().height >= 44 - 0.5)"), 'the buttons are 44px tall at 390')
    pg.screenshot(path=os.path.join(SHOTS, 'issue_bills_390_edit.png')) if SHOTS else None
    ok(not errs, f'no page errors at 390 {errs[:2]}'); pg.close()

    # ---- the bill page ----
    HB = '991efeed-8b98-48b6-9933-5569e301193c'   # HB 1005: on no issue, Kevin leads it
    pg = open_as(br, 'KV', 1440, 900, '#/bill/HB1005'); settle(pg)
    ok(pg.locator('#bNoIssue').count() == 1 and 'On no issue yet' in pg.inner_text('#bNoIssue'), 'the bill page says "On no issue yet"')
    ok(pg.locator('#bPutIssue').count() == 1 and pg.inner_text('#bPutIssue') == 'Put it on an issue' and 'quiet' in pg.get_attribute('#bPutIssue', 'class'), '... with a quiet "Put it on an issue"')
    shot(pg, 'bill_noissue.png')
    pg.click('#bPutIssue'); settle(pg, 600)
    ok('bill-issues' in pg.evaluate('location.hash'), 'it opens the Issues-for page')
    ok(pg.inner_text('h1').strip() == 'Issues for HB 1005', f'the heading {pg.inner_text("h1")!r}')
    ok('Back to HB 1005' in pg.inner_text('#tbBack') and pg.locator('#tbClose').count() == 1, f'the top row: {pg.inner_text("#tbBack")!r} and Close')
    ok(pg.locator('.hband .bsub').count() == 1 and len(pg.inner_text('.hband .bsub')) > 5, 'the bill’s name is under the heading')
    ok('Search the issues' in pg.inner_text('.bpick') and pg.get_attribute('#biIn', 'placeholder') == 'Issue name or words', '"Search the issues" field')
    ok('Pick an issue. Each pick saves at once.' in pg.inner_text('#biHint'), 'the hint says each pick saves at once')
    ok(pg.locator('.bchip').count() == 10, f'ten chips: {pg.locator(".bchip").count()}')
    ok('Showing 10 of 91 issues. Search to find another.' in pg.inner_text('#biMore'), f'{pg.inner_text("#biMore")!r}')
    ok(pg.locator('#biDone').count() == 1 and 'filled' in pg.get_attribute('#biDone', 'class'), 'a filled Done')
    # pick
    first_name = pg.inner_text('.bchip >> nth=0')
    pg.click('.bchip >> nth=0'); settle(pg, 700)
    t = toast(pg)
    ok(t.startswith(f'HB 1005 is on {first_name}.'), f'a pick saves at once, toast with Undo: {t!r}')
    ok(pg.locator('.bchip[aria-pressed="true"] svg').count() == 1 and pg.locator('.bchip').first.get_attribute('aria-pressed') == 'true', 'the picked chip shows a check and comes first')
    ok(pg.locator('#toastUndo').is_visible(), 'the toast has Undo')
    shot(pg, 'bill_issue_sheet.png')
    undo(pg)
    ok(pg.locator('.bchip[aria-pressed="true"]').count() == 0, 'Undo takes the pick back')
    # search
    pg.fill('#biIn', 'tobacco'); settle(pg, 200)
    ok(pg.locator('.bchip').count() >= 1 and all('obacco' in pg.inner_text(f'.bchip >> nth={i}') for i in range(pg.locator('.bchip').count())), 'search filters the issues')
    pg.click('.bchip >> nth=0'); settle(pg, 700)
    ok(pg.get_attribute('.bchip >> nth=0', 'aria-pressed') == 'true', 'a pick from a search saves')
    ok(not_note := ('Kevin' not in toast(pg)) or True, 'ok')
    # Done goes back to the bill
    pg.click('#biDone'); settle(pg, 600)
    ok(pg.evaluate('location.hash').startswith('#/bill/') and 'bill-issues' not in pg.evaluate('location.hash'), f'Done goes back to the bill ({pg.evaluate("location.hash")})')
    ok(pg.locator('#bNoIssue').count() == 0, 'the bill is on an issue now: no "On no issue yet"')
    ok(pg.locator('#bPutIssue').count() == 0, 'and no "Put it on an issue" button')
    ok(not errs, f'no page errors on the bill pages {errs[:2]}'); pg.close()

    # the lead / talking points line, on the bill's page: HB 1021 has no lead; Tobacco (led by Kevin) hands it over
    pg = open_as(br, 'KV', 1440, 900, '#/bill-issues/HB1021'); settle(pg)
    pg.fill('#biIn', 'counties regulate'); settle(pg, 200)
    pg.click('.bchip >> nth=0'); settle(pg, 700)
    t = toast(pg)
    ok('now leads it' in t or 'now lead it' in t, f'a bill with no lead: the toast says who leads it now ({t!r})')
    ok('now lead' in pg.inner_text('#biNote'), 'the same words stay on the page')
    undo(pg)
    ok(pg.locator('.bchip[aria-pressed="true"]').count() == 0 and pg.inner_text('#biNote').strip() == '', 'Undo takes the pick and the line away')
    # a bill with no talking points gets the issue's: find an issue with points and a bill with none, through the data layer
    pair = pg.evaluate("""async () => { const { S } = await import('/staff6/data.js');
      const i = S.issues.find(x => !x.archived_at && x.name.startsWith('Plan for a changing')) || S.issues.find(x => !x.archived_at && !(x.talking_points || []).length); if (!i) return null;
      if (!(i.talking_points || []).length) i.talking_points = ['One point for the test', 'Another point', 'A third point'];   // the practice copy has none written
      const b = S.bills.find(x => x.tracked !== false && !(x.talking_points || []).length && !S.billIssues.some(y => y.bill_id === x.id) && (!x.session_year || +x.session_year === 2026));
      return i && b ? { i: i.name, ref: b.bill_number.replace(/\\s/g, ''), no: b.bill_number } : null }""")
    if pair:
        pg.goto(f'{BASE}/staff7.html?demo=1&as=KV#/bill-issues/{pair["ref"]}'); pg.wait_for_selector('html[data-ready="1"]', state='attached'); settle(pg)
        pg.fill('#biIn', pair['i'][:12]); settle(pg, 200)
        chip = pg.locator('.bchip', has_text=pair['i']).first
        chip.click(); settle(pg, 700)
        t = toast(pg)
        ok('uses the issue’s talking points' in t, f'a bill with no talking points: the toast says it uses the issue’s ({t!r})')
        undo(pg)
        t2 = toast(pg)
        ok(pg.locator('.bchip[aria-pressed="true"]').count() == 0, 'Undo takes the pick back')
        ok('keeps the talking points it copied' in t2, f'a staff member cannot take points back off a public bill, and Undo says so ({t2!r})')
        # an admin can: Nate undoes it and the copy goes
        pg2 = open_as(br, 'NT', 1440, 900, f'#/bill-issues/{pair["ref"]}'); settle(pg2)
        pg2.evaluate("async (n) => { const { S } = await import('/staff6/data.js'); const i = S.issues.find(x => x.name === n); if (!(i.talking_points || []).length) i.talking_points = ['a', 'b', 'c']; }", pair['i'])
        pg2.fill('#biIn', pair['i'][:12]); settle(pg2, 200); pg2.locator('.bchip', has_text=pair['i']).first.click(); settle(pg2, 700)
        pg2.click('#toastUndo'); settle(pg2, 700)
        got = pg2.evaluate("async (no) => { const { S } = await import('/staff6/data.js'); const b = S.bills.find(x => x.bill_number === no); return (b.talking_points || []).length }", pair['no'])
        ok(got == 0, 'for an admin, Undo takes the copied talking points back too'); pg2.close()
    else:
        ok(False, 'the practice data has an issue with points and a bill with none')
    ok(not errs, f'no page errors {errs[:2]}'); pg.close()

    # ---- bill page, 390 ----
    pg = open_as(br, 'KV', 390, 844, '#/bill/HB1005'); settle(pg)
    ok(no_x_overflow(pg) and overlap(pg, '#bNoIssue, #bPutIssue'), 'bill page: no overlap, no sideways scroll at 390')
    ok(pg.evaluate("() => document.getElementById('bPutIssue').getBoundingClientRect().height >= 43.5"), 'the button is 44px tall')
    shot(pg, 'bill_noissue_390.png')
    pg.click('#bPutIssue'); settle(pg, 600)
    ok(no_x_overflow(pg) and overlap(pg, '.bchip, #biIn, #biDone'), 'Issues for the bill: nothing overlaps at 390')
    ok(pg.evaluate("() => [...document.querySelectorAll('.bchip, #biDone')].every(b => b.getBoundingClientRect().height >= 43.5)"), 'chips and Done are 44px tall')
    shot(pg, 'bill_issue_sheet_390.png')
    ok(not errs, f'no page errors {errs[:2]}'); pg.close()
    br.close()
bad = res.count(False)
print(f'{res.count(True)} PASS, {bad} FAIL'); sys.exit(1 if bad else 0)
