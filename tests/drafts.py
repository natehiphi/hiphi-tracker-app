# What each draft of a bill changed (R-060; backend migration 120): the public bill page's "How it has changed" and Staff
# v2's notes on a bill's Public tab, in the sandbox (demo/drafts.json), phone and laptop.
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
        # SB 2175 in the sandbox is at SD2 (16 March): SD2 leads, SD1 is folded, April's House and conference drafts never show
        pg.goto(BASE + '/track.html?demo=1#/bill/SB2175'); pg.wait_for_selector('.bl-head', timeout=60000); pg.wait_for_timeout(2500)
        sec = pg.locator('.bl-drafts'); t = sec.inner_text() if sec.count() else ''
        ok(sec.count() == 1 and 'Senate draft 2, the latest:' in t, f'{tag}: "How it has changed" leads with the current draft, in plain words')
        ok('Earlier drafts (1)' in t and 'Conference' not in t and 'House draft' not in t, f'{tag}: earlier drafts folded; none after the current one')
        ok(pg.locator('.bl-drafts details[open]').count() == 0, f'{tag}: the earlier ones start folded')
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
