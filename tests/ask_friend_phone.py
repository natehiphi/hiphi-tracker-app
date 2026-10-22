# The Captain's phone (R-212 #33), in the practice copy served locally. Headless Chromium has no share menu, so a phone's is
# stood in for by a stub that records what it was given; the clipboard is read back.
#   P1  a phone's sheet shows the whole message in a box, with Send to a friend and Copy message held at its foot, then Close
#   P5  on a phone with three asks, Send to a friend is on the first screen
#   P2  their edited words go to the phone's menu, the link passed once and tagged sp=sheet
#   P3  Copy message copies their edited words, the link tagged sp=copy, and "Copied" stays on screen
#   P4  one ask (the chair's email) opens the sheet too, rather than going straight to the menu
#   O1  each ask opens differently: testimony keeps the share test's "Have you seen this?", the email and the hearing their own
#   Y1  before their own testimony, "Send yours first" shows; it closes the sheet and opens their testimony
#   Y2  once they have sent testimony, the sheet no longer offers it; the message starts from what they did
#   L1  a laptop keeps its box (Gmail first) and also offers "Send yours first"
#   python3 tests/ask_friend_phone.py [base] [outdir]
import sys, os
from playwright.sync_api import sync_playwright
BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832/').rstrip('/') + '/'
OUT = sys.argv[2] if len(sys.argv) > 2 else '.'
PUB = BASE + 'track.html?demo=1'
res = []
def ok(c, m): res.append(bool(c)); print('PASS' if c else 'FAIL', m)
def ready(pg):
    pg.wait_for_function("() => !!document.querySelector('main') && !document.querySelector('.skelpage') && !document.querySelector('.bl-skel')", timeout=60000); pg.wait_for_timeout(700)
SKIP = "() => { try { for (const k of ['hiphi_wiz', 'hiphi_wiz_demo']) { const w = JSON.parse(localStorage.getItem(k) || '{}'); localStorage.setItem(k, JSON.stringify({ ...w, done: true, step: 99 })); } for (const k of ['hiphi_tour_bill', 'hiphi_tour_home', 'hiphi_tour_bill_demo', 'hiphi_tour_home_demo']) localStorage.setItem(k, '{\"how\":\"test\"}'); } catch {} }"
STUB = "() => { window.__shared = []; navigator.share = async d => { window.__shared.push(d); }; }"
MARK = """async n => { const c = await import('./pub/core.js'); const b = [...c.S.bills, ...Object.values(c.S.extra || {})].find(x => x.bill_number.replace(/\\s/g, '') === n);
  const h = c.hearingsOf(b).find(x => new Date(x.scheduled_at) > Date.now()); await c.markDone(b.id, h.id, 'testimony', true, { quiet: true }); }"""
NUM = 'HB1523'      # a hearing ahead, testimony open
ASKNUM = 'HB1518'   # waiting for a hearing: one ask, the chair's email
SHEET = 'dialog.af-sheet'
def bill(pg, num):
    pg.goto(PUB + '#/find'); pg.wait_for_timeout(300); pg.goto(PUB + f'#/bill/{num}'); ready(pg); pg.evaluate(STUB)
def share(pg):
    pg.locator('.bl-top [data-bl-share]').first.click(); pg.wait_for_selector(SHEET + '[open]', timeout=5000); pg.wait_for_timeout(900)
msg = lambda pg: pg.input_value(SHEET + ' #af-msg')
with sync_playwright() as p:
    br = p.chromium.launch(); errs = []
    def ctx(phone):
        c = br.new_context(**({'viewport': {'width': 375, 'height': 812}, 'is_mobile': True, 'has_touch': True} if phone else {'viewport': {'width': 1366, 'height': 800}}))
        c.grant_permissions(['clipboard-read', 'clipboard-write']); c.add_init_script(f"({SKIP})()"); return c
    c = ctx(True); pg = c.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
    bill(pg, NUM); share(pg)
    btns = pg.evaluate("() => [...document.querySelectorAll('dialog.af-sheet .af-send button, dialog.af-sheet .af-btns button')].map(b => (b.classList.contains('primary') ? '*' : '') + b.textContent.trim())")
    m = msg(pg) if pg.locator(SHEET + ' #af-msg').count() else ''
    ok(m.startswith('Have you seen this?') and 'sp=' not in m and '/b/demo/' in m and btns == ['*Send to a friend', 'Copy message', 'Close'], f'P1: the whole message in a box, then Send, Copy, Close ({btns}; {m[:50]!r})')
    ok('Send yours first' in pg.locator(SHEET).inner_text(), 'Y1: "Send yours first" before their own testimony')
    sb = pg.locator(SHEET + ' [data-af="sheet"]').bounding_box()
    ok(sb and sb['y'] + sb['height'] <= 812, f'P5: Send to a friend on the first screen with three asks (ends at {sb and round(sb["y"] + sb["height"])}px of 812)')
    pg.screenshot(path=os.path.join(OUT, 'r212_33_phone_sheet.png'), full_page=False)
    pg.check(SHEET + ' input[value="email"]'); pg.wait_for_timeout(500)
    ok(msg(pg).startswith('Will you email the committee about'), f'O1: the committee email opens with its own question ({msg(pg)[:60]!r})')
    pg.check(SHEET + ' input[value="attend"]'); pg.wait_for_timeout(500)
    ok(msg(pg).startswith('Want to come to a hearing at the Capitol?'), f'O1: the hearing opens with its own question ({msg(pg)[:60]!r})')
    ok('Send yours first' not in pg.locator(SHEET).inner_text(), 'Y1: not offered for going to the hearing')
    pg.check(SHEET + ' input[value="email"]'); pg.wait_for_timeout(500)
    pg.fill(SHEET + ' #af-msg', msg(pg).replace('Will you email the committee about', 'Aloha group! Can we all email the committee about'))
    pg.locator(SHEET + ' [data-af="sheet"]').click(); pg.wait_for_timeout(900)
    sh = pg.evaluate("() => window.__shared")
    ok(len(sh) == 1 and sh[0]['text'].startswith('Aloha group!') and 'sp=sheet' in sh[0]['url'] and sh[0]['url'] not in sh[0]['text'] and '-email' in sh[0]['url'], f'P2: their words go to the menu, the link once, tagged ({sh[0]["url"] if sh else None})')
    bill(pg, NUM); share(pg)
    pg.fill(SHEET + ' #af-msg', 'Aloha group! ' + msg(pg))
    pg.evaluate("() => navigator.clipboard.writeText('')"); pg.locator(SHEET + ' [data-af="copy"]').click(); pg.wait_for_timeout(600)
    clip = pg.evaluate("() => navigator.clipboard.readText()")
    st = pg.locator(SHEET + ' .af-status').inner_text()
    ok(clip.startswith('Aloha group! Have you seen this?') and 'sp=copy' in clip and 'Copied' in st, f'P3: Copy message copies their words, tagged sp=copy ({st!r})')
    pg.locator(SHEET + ' [data-af="close"]').first.click(); pg.wait_for_timeout(300)
    bill(pg, ASKNUM); share(pg)
    sh = pg.evaluate("() => window.__shared")
    ok(pg.locator(SHEET + '[open]').count() == 1 and not sh and msg(pg).startswith('Will you email a committee chair about'), f'P4: one ask opens the sheet with its own opening ({msg(pg)[:60]!r})')
    pg.locator(SHEET + ' [data-af="close"]').first.click(); pg.wait_for_timeout(300)
    bill(pg, NUM); share(pg)
    pg.locator(SHEET + ' [data-af="yours"]').click(); pg.wait_for_timeout(2500)
    ok(pg.locator(SHEET + '[open]').count() == 0 and pg.locator('#hp-dlg[open]').count() == 1, 'Y1: "Send yours first" closes the sheet and opens their testimony')
    c.close()
    c = ctx(True); pg = c.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
    bill(pg, NUM); pg.evaluate(MARK, NUM); bill(pg, NUM); share(pg)
    txt = pg.locator(SHEET).inner_text()
    ok('Send yours first' not in txt and msg(pg).startswith('I just spoke up'), f'Y2: after their testimony, no "Send yours first", and the message starts from what they did ({msg(pg)[:40]!r})')
    c.close()
    c = ctx(False); pg = c.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
    bill(pg, NUM); share(pg)
    mails = pg.evaluate("() => [...document.querySelectorAll('dialog.af-sheet [data-af-mail]')].map(a => a.textContent.trim())")
    ok(mails[:1] == ['Gmail'] and 'Send yours first' in pg.locator(SHEET).inner_text(), f'L1: the laptop keeps its box and offers "Send yours first" ({mails})')
    pg.screenshot(path=os.path.join(OUT, 'r212_33_laptop_sheet.png'))
    c.close()
    ok(not errs, f'no page errors ({errs[:2]})')
    br.close()
print(f'{sum(res)}/{len(res)} passed')
sys.exit(0 if all(res) else 1)
