# The alerts ask inside the letter helper, after a first email is sent (found 10/5 while building R-155: the helper drew
# its own copy of Home's card with renamed ids, so Text me there was never wired and the form fell through to the browser).
# python3 tests/helper_alerts.py [base url]   (sandbox, a phone)
#   codes off (&codes=0): the box is there with its own ids, Text me keeps the number and says a text will confirm it, in the dialog,
#              and the page does not navigate; Use email instead swaps inside the dialog
#   codes on (&codes): Text me -> the code field in the dialog -> six digits -> "Text alerts are on"
import json, os, sys, urllib.parse
from playwright.sync_api import sync_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832/track.html'
snap = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'demo', 'snapshot.json')))
ID = {b['bill_number']: b['id'] for b in snap['bills']}
TOUR_SEEN = "try{localStorage.setItem('hiphi_tour_bill','1');localStorage.setItem('hiphi_tour_bill_demo','1')}catch(e){}"
CATCH = """document.addEventListener('click', e => { const a = e.target.closest && e.target.closest('a.hp-send'); if (!a) return;
  e.preventDefault(); (window.__opened ||= []).push(a.href); }, true);"""
ok = fail = 0
def check(c, m):
    global ok, fail
    print('PASS' if c else 'FAIL', m); ok += bool(c); fail += (not c)
dlg = lambda p: p.evaluate("document.getElementById('hp-dlg')?.innerText || ''")
def tap(p, rx, sel='#hp-dlg button, #hp-dlg a'):
    return p.evaluate("""([sel, rx]) => { const e = [...document.querySelectorAll(sel)].filter(x => x.offsetParent !== null).find(x => new RegExp(rx, 'i').test((x.innerText || '').trim()));
      if (!e) return false; e.click(); return true; }""", [sel, rx])

def to_mahalo(br, extra):
    c = br.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
    c.add_init_script(TOUR_SEEN); c.add_init_script(CATCH)
    c.grant_permissions(['clipboard-read', 'clipboard-write'], origin=urllib.parse.urlsplit(BASE)._replace(path='').geturl().rstrip('/'))
    p = c.new_page(); p.errs = []; p.on('pageerror', lambda e: p.errs.append(str(e)[:160]))
    p.goto(BASE + '?demo=1' + extra + '#/'); p.wait_for_timeout(600)
    p.evaluate(f"""localStorage.clear(); sessionStorage.clear(); localStorage.setItem('hiphi_watch_ids_demo', JSON.stringify({json.dumps([ID['HB1562'], ID['HB2121']])}));
      localStorage.setItem('hiphi_wiz', JSON.stringify({{step:1,done:true,skipped:true}}));""")
    p.goto(BASE + '?demo=1' + extra + '#/'); p.reload(); p.wait_for_timeout(2800)
    card = p.evaluate("[...document.querySelectorAll('[data-card]')].map(e => e.dataset.card).find(k => k.startsWith('" + ID['HB2121'] + "'))")
    p.evaluate("k => { const c = [...document.querySelectorAll('[data-card]')].find(e => e.dataset.card === k); c.querySelector('[data-moreways]').click(); }", card); p.wait_for_timeout(500)
    p.evaluate("k => { const c = [...document.querySelectorAll('[data-card]')].find(e => e.dataset.card === k); [...c.querySelectorAll('.mwrow')].find(r => /quick email/i.test(r.innerText)).click(); }", card); p.wait_for_timeout(900)
    if 'Where do you stand' in dlg(p): tap(p, '^I support it'); p.wait_for_timeout(500)
    tap(p, '^Next'); p.wait_for_timeout(500)
    p.fill('#hp-name', 'Kai Ho'); tap(p, 'See my email'); p.wait_for_timeout(600)
    tap(p, '^Next'); p.wait_for_timeout(900)
    p.locator('#hp-dlg .hp-send').first.click(); p.wait_for_timeout(1300)
    tap(p, '^Yes, I sent it'); p.wait_for_timeout(1500)
    return c, p

with sync_playwright() as pw:
    br = pw.chromium.launch()
    c, p = to_mahalo(br, '&codes=0')
    check('Mahalo' in dlg(p), 'the helper’s Mahalo screen')
    check(p.locator('#hp-dlg .nudgecard #hp-ng-phone').count() == 1 and p.locator('#hp-dlg #ng-phone').count() == 0, 'its alerts box has its own ids (hp-ng-)')
    url = p.url
    p.fill('#hp-ng-phone', '(808) 555-0199'); p.locator('#hp-dlg .nudgecard button', has_text='Text me').click(); p.wait_for_timeout(1000)
    check(p.url == url, 'Text me does not send the page anywhere')
    check('We’ll text (808) 555-0199 to confirm it’s your number' in dlg(p) and 'YES' not in dlg(p), 'Text me keeps the number and says so, in the dialog (no YES, R-176)')
    check('8085550199' in (p.evaluate("localStorage.getItem('hiphi_text')") or ''), 'the number is kept (the sandbox copy)')
    check(not p.errs, f'no page errors {p.errs}')
    c.close()
    c, p = to_mahalo(br, '')
    tap(p, '^Use email instead'); p.wait_for_timeout(500)
    check(p.locator('#hp-dlg #hp-ng-email').count() == 1, 'Use email instead swaps the box inside the dialog')
    c.close()
    c, p = to_mahalo(br, '&codes')
    p.fill('#hp-ng-phone', '(808) 555-0199'); p.locator('#hp-dlg .nudgecard button', has_text='Text me').click(); p.wait_for_timeout(800)
    check(p.locator('#hp-dlg #hp-ng-code').count() == 1 and p.locator('#hp-dlg .nudgecard button', has_text='Confirm').count() == 1, 'codes on: the code field in the dialog, with Confirm')
    p.type('#hp-ng-code', '123456'); p.wait_for_timeout(1200)
    check('Text alerts are on for (808) 555-0199' in dlg(p), 'six digits: "Text alerts are on"')
    check(not p.errs, f'no page errors {p.errs}')
    c.close()
    br.close()
print(f'\n{ok} passed, {fail} failed'); sys.exit(1 if fail else 0)
