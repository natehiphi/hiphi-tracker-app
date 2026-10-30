# The bill page's tour never opens by itself for someone who arrived on a link (R-114; R-357 Light fixes, b).
#   python3 tests/tour_link.py [base_url]      (sandbox; a phone at 375x812; base defaults to http://localhost:8832/track.html)
# Why: on the live site "Tip 1 of 3" darkened a bill page on its own in 2 of 3 fresh loads for a newcomer who opened
# #/bill/HB1523 directly. pub/tour.js set a 450 ms timer while the page was still a skeleton and never took it back when
# the redraw said no; it also asked only "has the first visit begun?", not "where did this page load begin?".
# Checks: (1) three fresh loads of the bill link show no tour within 4 s; (2) nor for someone who skipped the first visit
# and opens the link; (3) a render that wanted the tour followed by one that does not, inside the timer, shows none;
# (4) the control: past the first visit, from Home into a bill inside the app, the tour still opens (so 1-3 are not
# passing only because the tour is broken); (5) "Take the tour" asked for on a link arrival still works (startBill).
import sys
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832/track.html'
LINK = BASE + '?demo=1#/bill/HB1523'
PAST_START = "localStorage.setItem('hiphi_wiz', JSON.stringify({step:1,done:true,skipped:true}))"
passes, fails, errors = [], [], []
def ok(c, m): (passes if c else fails).append(('PASS ' if c else 'FAIL ') + m)

def phone(b):
    c = b.new_context(viewport={'width': 375, 'height': 812}, device_scale_factor=2, is_mobile=True, has_touch=True)
    p = c.new_page(); p.on('pageerror', lambda e: errors.append(str(e)))
    p.on('console', lambda m: errors.append(m.text[:140]) if m.type == 'error' and 'favicon' not in m.text else None)
    return c, p
def tour_within(p, ms):
    """True if a tour overlay shows at any moment in the next ms milliseconds."""
    for _ in range(ms // 100):
        if p.locator('.tr, .tr-tip').count(): return True
        p.wait_for_timeout(100)
    return False

with sync_playwright() as pw:
    b = pw.chromium.launch()
    # 1. A newcomer on a friend's link: three fresh loads, never the tour
    for i in range(3):
        c, p = phone(b); p.goto(LINK)
        p.wait_for_selector('.bl-page .bl-head', timeout=15000)
        ok(not tour_within(p, 4000), f'fresh load {i + 1}: no tour over a bill opened from a link')
        c.close()
    # 2. Someone who skipped the first visit, on a link
    c, p = phone(b); p.goto(BASE + '?demo=1'); p.wait_for_timeout(400); p.evaluate('localStorage.clear()'); p.evaluate(PAST_START)
    p.goto(LINK); p.reload(); p.wait_for_selector('.bl-page .bl-head', timeout=15000)
    ok(not tour_within(p, 4000), 'a link arrival who skipped the first visit: no tour either')
    c.close()
    # 3 + 4 + 5. Past the first visit, Home first, then into the app
    c, p = phone(b); p.goto(BASE + '?demo=1'); p.wait_for_timeout(400); p.evaluate('localStorage.clear()'); p.evaluate(PAST_START)
    p.goto(BASE + '?demo=1#/'); p.reload(); p.wait_for_timeout(1500)
    p.evaluate("localStorage.setItem('hiphi_tour_bill', '{}'); localStorage.setItem('hiphi__demo_hiphi_tour_bill', '{}')")   # seen: the app does not load the tour by itself
    p.evaluate("location.hash = '#/bill/HB1523'"); p.wait_for_selector('.bl-page .bl-head', timeout=15000); p.wait_for_timeout(1000)
    race = p.evaluate("""async () => {
      Object.keys(localStorage).filter(k => /tour_bill/.test(k)).forEach(k => localStorage.removeItem(k));
      const C = await import('/pub/core.js'), T = await import('/pub/tour.js'), S = C.S;
      S.billTourDone = false; S.blNew = new Set(); S.arrivedOn = 'home';
      T.default.after({ name: 'bill' });   // a render before anything is known: it wants the tour and sets a timer
      S.blNew.add('x');                    // the bill draws and records a newcomer
      T.default.after({ name: 'bill' });   // the redraw does not want one: the first timer must go
      await new Promise(r => setTimeout(r, 1000));
      return !!document.querySelector('.tr');
    }""")
    ok(not race, 'a timer set by a render that wanted the tour does not start it after a redraw that does not')
    c.close()
    c, p = phone(b); p.goto(BASE + '?demo=1'); p.wait_for_timeout(400); p.evaluate('localStorage.clear()'); p.evaluate(PAST_START)
    p.goto(BASE + '?demo=1#/'); p.reload(); p.wait_for_timeout(1500)
    p.evaluate("location.hash = '#/bill/HB1523'")
    ok(tour_within(p, 6000), 'control: from Home into a bill, past the first visit, the tour opens')
    c.close()
    c, p = phone(b); p.goto(LINK); p.wait_for_selector('.bl-page .bl-head', timeout=15000)
    p.evaluate("import('/pub/tour.js').then(t => t.default.startBill())")
    ok(tour_within(p, 3000), 'asked for ("Take the tour"), the tour opens on a link arrival')
    c.close()
    b.close()

ok(not errors, f'no console errors {errors[:3]}')
print('\n'.join(passes + fails))
print(f'\n{len(passes)} passed, {len(fails)} failed')
sys.exit(1 if fails else 0)
