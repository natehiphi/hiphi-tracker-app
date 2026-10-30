# One profile ask per visit (DESIGN C-3; R-357 Light fixes h, Nate's yes 30 Oct 2026: "no second ask on Home after a skip").
#   python3 tests/ask_once.py [base_url]      (practice copy; a phone at 375x812; base defaults to http://localhost:8832)
# Why: the newcomer walk found "Save your profile" asked at step 3, then "Alerts are off · Turn on alerts" on "You're all set"
# a few taps later, and the sheet again after any follow. The mark that the ask was made lived only in the page (S.nudgedThisVisit),
# so a reload in the middle of the visit forgot it.
# Checks: (1) the first visit's ask is skipped: "You're all set" has no alerts row and no "Turn on alerts" button, and the tab's
# session remembers the skip; (2) a follow in the same visit, on a page that forgot (the in-page mark cleared), does not open the
# sheet, and Home's own line does not either; (3) the control: with the session's marks gone the same follow does open it, so (2) is
# the mark's doing; (4) the control for the ending: with no skip on record it still carries its alerts row.
import sys
from playwright.sync_api import sync_playwright

BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832').rstrip('/')
passes, fails, errors = [], [], []
def ok(c, m): (passes if c else fails).append(('PASS ' if c else 'FAIL ') + m)

def phone(b):
    c = b.new_context(viewport={'width': 375, 'height': 812}, device_scale_factor=2, is_mobile=True, has_touch=True)
    p = c.new_page(); p.on('pageerror', lambda e: errors.append(str(e)))
    return c, p
def to_alerts(p):
    p.goto(f'{BASE}/track.html?demo=1&restart'); p.wait_for_selector('.st-hellobar [data-stnext]', timeout=40000); p.wait_for_timeout(500)
    p.click('.st-hellobar [data-stnext]'); p.wait_for_selector('.st-tile', timeout=30000); p.wait_for_timeout(400)
    p.locator('.st-tile').nth(0).click(); p.click('.st-bar [data-stnext]')
    p.wait_for_selector('.st2 [data-stpick]', timeout=30000); p.wait_for_selector('.st-bar [data-stnext]:not([aria-busy="true"])', timeout=20000); p.wait_for_timeout(400)
    p.click('.st-bar [data-stnext]'); p.wait_for_selector('#st-aform', timeout=20000); p.wait_for_timeout(500)
def to_recap(p):
    for _ in range(8):
        if 'all set' in p.evaluate("document.querySelector('main h1')?.innerText || ''"): break
        sk, nx = p.locator('.st-bar [data-stskip]:visible'), p.locator('.st-bar [data-stnext]:visible')
        (sk if sk.count() else nx).first.click(); p.wait_for_timeout(1700)
    p.wait_for_timeout(1200)
ROW = "!!document.querySelector('[data-alrow]')"
ASK = """async () => { const A = await import('/pub/alerts.js'), K = await import('/pub/kernel.js');
  K.S.nudgedThisVisit = false; K.S.nudge = null; K.S.askSkipped = false;           // a page that forgot (a reload)
  const opened = A.followAsk('a test issue', () => {});
  const open = !!document.querySelector('dialog.al-sheet[open]'); document.querySelector('dialog.al-sheet')?.close();
  return { opened, open, asked: A.askedThisVisit() }; }"""

with sync_playwright() as pw:
    b = pw.chromium.launch()
    # 1 + 2 + 3. The ask is skipped
    c, p = phone(b); to_alerts(p)
    ok(p.evaluate("sessionStorage.getItem('hiphi_ask_asked')") == '1', 'the ask on screen counts as the visit\'s ask')
    p.click('.st-bar [data-stskip]'); p.wait_for_timeout(2000)
    ok(p.evaluate("sessionStorage.getItem('hiphi_ask_skipped')") == '1', 'Skip is remembered for the tab\'s session')
    to_recap(p)
    ok('all set' in p.evaluate("document.querySelector('main h1')?.innerText || ''"), 'the visit reaches "You\'re all set"')
    ok(not p.evaluate(ROW) and 'Turn on alerts' not in p.evaluate("document.querySelector('main').innerText"), '"You\'re all set" has no "Alerts are off · Turn on alerts" after the skip')
    r = p.evaluate(ASK)
    ok(r['opened'] is False and r['open'] is False and r['asked'], f'a follow in the same visit does not reopen "Save your profile" ({r})')
    p.evaluate("sessionStorage.removeItem('hiphi_ask_asked'); sessionStorage.removeItem('hiphi_ask_skipped')")
    r = p.evaluate(ASK)
    ok(r['opened'] is True and r['open'] is True, f'control: with the session\'s marks gone the same follow opens it ({r})')
    c.close()
    # 4. The control for the ending: with no skip on record (the marks cleared after the Skip) the ending still carries its alerts row
    c, p = phone(b); to_alerts(p)
    p.click('.st-bar [data-stskip]'); p.wait_for_timeout(1800)
    p.evaluate("sessionStorage.removeItem('hiphi_ask_skipped'); import('/pub/kernel.js').then(K => { K.S.askSkipped = false; })")
    to_recap(p)
    ok(p.evaluate(ROW), 'control: with no skip on record "You\'re all set" still carries the alerts row ("Turn on alerts")')
    c.close()
    b.close()

ok(not errors, f'no page errors {errors[:3]}')
print('\n'.join(passes + fails))
print(f'\n{len(passes)} passed, {len(fails)} failed')
sys.exit(1 if fails else 0)
