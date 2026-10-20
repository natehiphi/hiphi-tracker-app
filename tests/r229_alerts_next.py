# R-229 (Nate 10/10): after "Text alerts are on" the page leads with one way on, not only the two ways to undo it.
# python3 tests/r229_alerts_next.py [base url]   (sandbox, a phone)
#   follows nothing: the code turns alerts on, the main button is "Pick your issues" (to the guided picker), Change number and Stop texts
#     are a quiet row, the page says there is nothing to text about yet, and the extra boxes are gone; leaving and coming back from More shows the page as it was
#   follows a bill: the main button is "Go to Home"
#   codes off: "Alerts almost set" also leads with a way on
# R-303: the calm redesign is the default, so this checks "Your alerts" (pub/rec/alerts.js yoursView): the moment after saving is
#   the .ya-just block at the top (its status line, the why, one main button), and Change and Stop all texts are always quiet
#   text buttons further down. The old page (?rec=0) keeps the same R-229 rules in pub/more.js alertsView.
import json, os, sys
from playwright.sync_api import sync_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832/track.html'
snap = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'demo', 'snapshot.json')))
ID = {b['bill_number']: b['id'] for b in snap['bills']}
ok = fail = 0
def check(c, m):
    global ok, fail
    print('PASS' if c else 'FAIL', m); ok += bool(c); fail += (not c)
PANEL = "document.querySelector('.ya-just')?.innerText || ''"
def primary(p): return p.evaluate("[...document.querySelectorAll('.mr-alerts .btn.primary')].map(b => (b.innerText.trim() + '|' + (b.getAttribute('href') || '')))")
def kind(p, attr): return p.evaluate(f"document.querySelector('[{attr}]')?.className || ''")

def signup(br, extra, follows):
    c = br.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
    p = c.new_page(); p.errs = []; p.on('pageerror', lambda e: p.errs.append(str(e)[:160]))
    p.goto(BASE + '?demo=1' + extra + '#/more'); p.wait_for_timeout(600)
    p.evaluate(f"""localStorage.clear(); sessionStorage.clear(); localStorage.setItem('hiphi_watch_ids_demo', JSON.stringify({json.dumps(follows)}));
      localStorage.setItem('hiphi_wiz', JSON.stringify({{step:1,done:true,skipped:true}}));""")
    p.goto(BASE + '?demo=1' + extra + '#/alerts'); p.reload(); p.wait_for_timeout(2500)
    p.fill('#mr-al-phone', '(808) 555-0142'); p.locator('#mr-al-send').click(); p.wait_for_timeout(1200)
    if p.locator('#mr-al-code').count():
        p.fill('#mr-al-code', '123456'); p.wait_for_timeout(400)   # six digits may submit on their own
        if p.locator('#mr-al-send').count(): p.locator('#mr-al-send').click()
        p.wait_for_timeout(1500)
    return c, p

with sync_playwright() as pw:
    br = pw.chromium.launch()
    c, p = signup(br, '&codes', [])
    check('Text alerts are on' in p.evaluate(PANEL), 'the code turns text alerts on')
    check(primary(p) == ['Pick your issues|#/start/1'], f'one main button, Pick your issues, to the guided picker {primary(p)}')
    check(' text ' in f" {kind(p, 'data-mr-alchange')} " and ' text ' in f" {kind(p, 'data-mr-alstop')} ", 'Change number and Stop texts are quiet (text buttons)')
    check('don’t follow any issues yet' in p.evaluate(PANEL), 'it says why: no issues, nothing to text about')
    check(p.locator('.mr-stopnum').count() == 0 and p.locator('.mr-alemail').count() == 0, 'no extra boxes in the moment after saving')
    p.locator('[data-mr-alnext]').click(); p.wait_for_timeout(1200)
    check(p.url.split('#')[1].startswith('/start'), f'Pick your issues opens the guided picker {p.url}')
    p.goto(BASE + '?demo=1&codes#/more'); p.wait_for_timeout(800); p.goto(BASE + '?demo=1&codes#/alerts'); p.wait_for_timeout(1200)
    check(primary(p) == [] and p.locator('.ya-just').count() == 0 and p.locator('[data-mr-alchange]').count() == 1 and p.locator('[data-mr-alstop]').count() == 1,
          'a later visit: no main button or after-saving block, Change and Stop all texts still there')
    # A later visit also has the closed "Stop texts to a number" fold at the foot of Your alerts; tests/stop_number.py checks it.
    check(not p.errs, f'no page errors {p.errs}')
    c.close()
    c, p = signup(br, '&codes', [ID['HB1562']])
    check(primary(p) == ['Go to Home|#/'], f'someone who follows a bill goes Home {primary(p)}')
    check('don’t follow any issues yet' not in p.evaluate(PANEL), 'and is not told they follow nothing')
    check(not p.errs, f'no page errors {p.errs}')
    c.close()
    c, p = signup(br, '&codes=0', [])
    check('Almost set' in p.evaluate(PANEL), 'codes off: Almost set')
    check(primary(p) == ['Pick your issues|#/start/1'], f'and it also leads with a way on {primary(p)}')
    c.close()
    br.close()
print(f'{ok} passed, {fail} failed'); sys.exit(1 if fail else 0)
