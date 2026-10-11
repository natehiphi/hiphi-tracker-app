# What each draft of a bill changed (R-060; backend migration 120): the public bill page's "Draft history" and Staff
# v2's notes on a bill's Public tab, in the sandbox (demo/drafts.json), phone and laptop. Nate 10/5: the history sits last on
# the page, closed; opened, each note is under its plain draft name ("Senate draft 2"), newest first. The committee and date
# are not shown: the live public data does not carry them, so the practice copy must not show what live cannot.
#   python3 tests/drafts.py [base]     base defaults to http://localhost:8832
import sys
from playwright.sync_api import sync_playwright
BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832').rstrip('/')
res = []
def ok(c, m): res.append(bool(c)); print('PASS' if c else 'FAIL', m)
SKIP = "() => { try { localStorage.setItem('hiphi_wiz', JSON.stringify({ done: true, step: 99 })); localStorage.setItem('hiphi_tour_bill', '{\"how\":\"test\"}'); localStorage.setItem('hiphi_tour_home', '{\"how\":\"test\"}'); } catch {} }"
with sync_playwright() as p:
    br = p.chromium.launch()
    for w, h, tag in ((390, 844, 'phone'), (1280, 900, 'laptop')):
        ctx = br.new_context(viewport={'width': w, 'height': h}, is_mobile=(w < 600)); ctx.add_init_script(f"({SKIP})()"); pg = ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        # SB 2175 in the sandbox is at SD2 (16 March): SD2 leads, SD1 is below it, April's House and conference drafts never show
        pg.goto(BASE + '/track.html?demo=1#/bill/SB2175'); pg.wait_for_selector('.bl-head', timeout=60000); pg.wait_for_timeout(2500)
        sec = pg.locator('details.bl-drafts'); closed = sec.inner_text() if sec.count() else ''
        ok(sec.count() == 1 and 'Draft history' in closed and 'What each draft changed, newest first.' in closed and 'How committees' not in closed and 'Each note says' not in closed,
           f'{tag}: "Draft history" is one card with one line of explanation (R-060, 10/10)')
        ok(pg.evaluate("() => { const d = document.querySelector('details.bl-drafts'), m = document.querySelector('details.bl-more'); if (!d || !m) return false; const a = getComputedStyle(d), b = getComputedStyle(m); return a.borderTopColor === b.borderTopColor && a.borderRadius === b.borderRadius && a.boxShadow === b.boxShadow && a.paddingLeft === b.paddingLeft && a.marginTop === b.marginTop; }"),
           f'{tag}: the same card as More details (border, corners, shadow, gutter, space above)')
        ok(pg.evaluate("() => getComputedStyle(document.querySelector('details.bl-drafts > summary > .bl-drsum > span')).fontSize === '16px'"), f'{tag}: its heading is 16px, like its entries')
        ok(pg.locator('details.bl-drafts[open]').count() == 0 and 'Moved the ban' not in closed and 'Only wording' not in closed, f'{tag}: closed by default, no draft wording showing')
        ok(pg.evaluate("() => { const d = document.querySelector('details.bl-drafts'); return !!d && d.parentElement.lastElementChild === d && [...d.parentElement.children].slice(0, -1).every(k => k.getBoundingClientRect().bottom <= d.getBoundingClientRect().top + 1); }"),
           f'{tag}: it is the last thing on the page, below More details and the action area')
        ok(pg.evaluate("() => document.querySelector('details.bl-drafts').getBoundingClientRect().top + scrollY > innerHeight"), f'{tag}: not on the first screen (it starts below {h}px)')
        # opened: the committee and the date come first on each note, newest first, under the names the bill's reports give
        pg.locator('details.bl-drafts > summary').click(); pg.wait_for_timeout(400)
        t = sec.inner_text()
        ok('Senate draft 2' in t and 'Senate draft 1' in t and 'Only wording fixes.' in t and 'Moved the ban' in t,
           f'{tag}: opened, each draft is named and its note shows')
        ok(t.index('Senate draft 2') < t.index('Senate draft 1') and t.count('Latest') == 1 and t.index('Latest') < t.index('Senate draft 2'), f'{tag}: newest first, the current draft marked Latest')
        ok('Conference' not in t and 'House draft' not in t and 'Earlier drafts' not in t and 'Committee' not in t, f'{tag}: no draft after the current one, and no committee names')
        # a House bill: its reports are House committees, and its Senate draft is after the current House draft, so it is not shown
        pg.goto(BASE + '/track.html?demo=1#/bill/HB2121'); pg.wait_for_selector('.bl-head', timeout=60000); pg.wait_for_timeout(2000)
        pg.locator('details.bl-drafts > summary').click(); pg.wait_for_timeout(400)
        t = pg.locator('details.bl-drafts').inner_text()
        ok('House draft 2' in t and 'House draft 1' in t and 'Senate draft' not in t,
           f'{tag}: HB 2121 shows its House drafts; the Senate draft after its current one is not shown')
        # a Senate bill whose draft was reported by one committee in the Senate
        pg.goto(BASE + '/track.html?demo=1#/bill/SB2463'); pg.wait_for_selector('.bl-head', timeout=60000); pg.wait_for_timeout(2000)
        pg.locator('details.bl-drafts > summary').click(); pg.wait_for_timeout(400)
        ok('Senate draft 1' in pg.locator('details.bl-drafts').inner_text(), f'{tag}: SB 2463 shows its Senate draft')
        # the label is the plain draft name; no committee or date is taken from anywhere (the live data has none)
        ok(pg.evaluate("() => import('./pub/letters.js').then(m => m.draftLabel({ version: 'SD3' }) === 'Senate draft 3' && m.draftLabel({ version: 'HD2', committee: 'CPC', reported: '2026-03-06T18:00:00Z' }) === 'House draft 2')"),
           f'{tag}: a draft is named by its plain name, whatever committee data a note might carry')
        # a bill with no notes has no section
        pg.goto(BASE + '/track.html?demo=1#/bill/HB1780'); pg.reload(); pg.wait_for_selector('.bl-head', timeout=60000); pg.wait_for_timeout(2000)
        ok(pg.locator('.bl-drafts').count() == 0, f'{tag}: a bill with no notes shows no section')
        ok(not errs, f'{tag}: no page errors ' + '; '.join(errs[:2])); ctx.close()
        # staff: the notes on the Public tab, Claude's marked for checking; Edit, Save, Undo
        ctx = br.new_context(viewport={'width': w, 'height': h}, is_mobile=(w < 600)); pg = ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(BASE + '/staff.html?demo=1#/bill/SB2175/public'); pg.wait_for_selector('section[aria-labelledby=bw-dr-h] .bw-drrow', timeout=60000)
        rows = pg.locator('.bw-drrow'); n = rows.count()
        ok(n == 2 and 'Senate draft 2 (SD2)' in rows.first.inner_text() and 'please check it' in rows.first.inner_text(), f'{tag}: staff see the notes newest first, Claude’s marked for checking ({n})')
        rows.first.locator('[data-dredit]').click(); pg.wait_for_selector('#bw-drtxt')
        pg.fill('#bw-drtxt', 'Added a fine for selling disposable e-cigarettes; the amount is still to be decided.'); pg.click('[data-drsave]'); pg.wait_for_timeout(900)
        first = pg.locator('.bw-drrow').first.inner_text()
        ok('still to be decided' in first and 'please check it' not in first, f'{tag}: a staff edit saves and is no longer marked as Claude’s')
        ok(pg.locator('.toastmsg .toastundo').count() == 1, f'{tag}: the save offers Undo')
        pg.locator('.toastmsg .toastundo').click(); pg.wait_for_timeout(900)
        ok('Moved the ban' in pg.locator('.bw-drrow').first.inner_text(), f'{tag}: Undo puts the earlier wording back')
        # "Looks right" makes a checked Claude note the team's in one tap; each note links its committee report
        ok(pg.locator('.bw-drrow a[href*="CommReports"]').count() == 2, f'{tag}: each note links its committee report')
        pg.locator('.bw-drrow').nth(1).locator('[data-drok]').click(); pg.wait_for_timeout(900)
        ok('please check it' not in pg.locator('.bw-drrow').nth(1).inner_text() and pg.locator('.bw-drrow').nth(1).locator('[data-drok]').count() == 0, f'{tag}: "Looks right" clears the check mark in one tap')
        ok(not errs, f'{tag}: no page errors (staff) ' + '; '.join(errs[:2])); ctx.close()
    br.close()
print(f'{sum(res)}/{len(res)} passed'); sys.exit(0 if all(res) else 1)
