# Ask a friend to speak up (R-205, Nate 10/7: sharing a specific ask "needs to be a KEY feature of this app"), in the
# practice copy served locally. Headless Chromium has no share menu, so a phone's is stood in for by a stub that records
# what it was given; a laptop's box is used as it is, the clipboard read back. Checks:
#   B1  Share is on the bill page's first screen, with its word, on a phone (top bar) and a laptop (the page's top row);
#       the phone's "•••" menu no longer holds Share or Copy link, the laptop's side panel no longer holds them.
#   C1  a hearing ahead offers three asks (testimony, the committee email, the hearing), testimony first; the one the person
#       did is marked; a bill with one ask goes straight to the phone's own menu.
#   C3  "Your friend sees" is the share page's own card (title and picture).
#   S1  the phone's menu gets the ask's own page, tagged ?sp=sheet, and words that name the ask.
#   S2  a laptop's box: the message to change, Gmail first, Copy message (?sp=copy) with "Copied" on screen.
#   M1, M2, C4  the Mahalo: "Not now" in the bar, then "Bring one friend along" in the profile ask's place, its button the
#       bar's main one; after a share one quiet line and Done alone (nothing asks again).
#   B3  "Just looking" offers the lighter step.   B4  Home's line under what you did, its Not now.
#   C2  #/bill/<n>/attend opens the hearing's when and where.   K2  404.html passes ?sp= and the new asks on.
#   python3 tests/askfriend.py [base]     base defaults to http://localhost:8832/
import sys, re, os, json
from playwright.sync_api import sync_playwright
BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832/').rstrip('/') + '/'
PUB = BASE + 'track.html?demo=1'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'tests', 'out'); os.makedirs(OUT, exist_ok=True)
res = []
def ok(c, m): res.append(bool(c)); print('PASS' if c else 'FAIL', m)
def ready(pg):
    pg.wait_for_function("() => !!document.querySelector('main') && !document.querySelector('.skelpage') && !document.querySelector('.bl-skel')", timeout=60000); pg.wait_for_timeout(700)
# A returning person: the first visit and the tips done, so nothing covers the page.
SKIP = "() => { try { const w = JSON.parse(localStorage.getItem('hiphi_wiz') || '{}'); localStorage.setItem('hiphi_wiz', JSON.stringify({ ...w, done: true, step: 99 })); localStorage.setItem('hiphi_tour_bill', '{\"how\":\"test\"}'); localStorage.setItem('hiphi_tour_home', '{\"how\":\"test\"}'); } catch {} }"
STUB = "() => { window.__shared = []; navigator.share = async d => { window.__shared.push(d); }; }"
snap = json.load(open(os.path.join(ROOT, 'demo', 'snapshot.json')))
NUM = 'HB1523'   # a hearing ahead of the practice copy's day, testimony open until Mon 16 Mar 3:00 PM
ASKNUM = 'HB1518'   # waiting for a hearing: one ask, the chair's email
with sync_playwright() as p:
    br = p.chromium.launch()
    def phone():
        c = br.new_context(viewport={'width': 375, 'height': 812}, is_mobile=True, has_touch=True); c.grant_permissions(['clipboard-read', 'clipboard-write']); return c
    def laptop():
        c = br.new_context(viewport={'width': 1366, 'height': 800}); c.grant_permissions(['clipboard-read', 'clipboard-write']); return c
    errs = []
    # ---- B1, C1, C3, S1: a phone with its own share menu ----
    c = phone(); pg = c.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(PUB + '#/'); ready(pg); pg.evaluate(SKIP); pg.goto(PUB + f'#/bill/{NUM}'); ready(pg); pg.evaluate(STUB)
    sb = pg.locator('.bl-top [data-bl-share]')
    box = sb.bounding_box() if sb.count() else None
    ok(sb.count() == 1 and sb.inner_text().strip() == 'Share' and box and box['y'] + box['height'] <= 812 and box['height'] >= 44, 'B1 phone: Share, with its word, in the top bar on the first screen, 44px tall')
    menu = pg.evaluate("() => document.getElementById('bl-menu')?.innerText || ''")
    ok('Share' not in menu and 'Copy link' not in menu and 'Add to a list' in menu, f'B1 phone: the "•••" menu keeps only the rarer things ({menu!r})')
    pg.screenshot(path=os.path.join(OUT, 'askfriend_1_bill_phone.png'))
    sb.click(); pg.wait_for_selector('dialog.af-sheet[open]', timeout=5000); pg.wait_for_timeout(1200)
    asks = pg.evaluate("() => [...document.querySelectorAll('dialog.af-sheet .af-ask b')].map(b => b.textContent.trim())")
    ok(asks == ['Send testimony', 'Email the committee', 'Go to the hearing'], f'C1: three asks for a hearing ahead, testimony first ({asks})')
    subs = pg.evaluate("() => [...document.querySelectorAll('dialog.af-sheet .af-asktx > span')].map(e => e.textContent.trim())")
    ok(subs and subs[0].startswith('A few minutes') and 'due today at 3:00 PM' in subs[0] and subs[1].startswith('About 2 minutes'), f'C1: each ask says how long, what it is, and "today" for a deadline hours away ({subs[:2]})')
    card = pg.locator('dialog.af-sheet [data-af-card]').inner_text()
    ok(card.startswith('Speak up by') and pg.locator('dialog.af-sheet [data-af-card] img').count() == 1, f'C3: "Your friend sees" is the share page\'s own card ({card[:60]!r})')
    btns = pg.evaluate("() => [...document.querySelectorAll('dialog.af-sheet .af-btns button')].map(b => (b.classList.contains('primary') ? '*' : '') + b.textContent.trim())")
    ok(btns == ['*Send to a friend', 'Close'] and pg.locator('dialog.af-sheet #af-msg').count() == 0, f'S1: on a phone, one main button to the phone\'s own menu ({btns})')
    pg.screenshot(path=os.path.join(OUT, 'askfriend_2_sheet_phone.png'))
    pg.check('dialog.af-sheet input[value="email"]'); pg.wait_for_timeout(600)
    pg.locator('dialog.af-sheet [data-af="sheet"]').click(); pg.wait_for_timeout(900)
    sh = pg.evaluate("() => window.__shared")
    u = sh[0]['url'] if sh else ''
    ok(len(sh) == 1 and f'b/demo/{NUM}-email' in u and 'sp=sheet' in u, f'S1: the menu gets the committee email\'s own page, tagged sp=sheet ({u})')
    ok(sh and 'email to the committee' in sh[0]['text'] and u not in sh[0]['text'], 'S1: the words name the ask, and the link is passed once')
    ok(pg.locator('dialog.af-sheet[open]').count() == 0, 'the sheet closes once the phone\'s menu is done')
    marked = pg.evaluate("async n => { const c = await import('./pub/core.js'); const b = [...c.S.bills, ...Object.values(c.S.extra || {})].find(x => x.bill_number.replace(/\\s/g, '') === n); const h = c.hearingsOf(b).find(x => new Date(x.scheduled_at) > Date.now()); return c.didKind(b, h, 'share'); }", NUM)
    ok(marked, 'the share is marked done, once')
    # One ask: straight to the phone's menu, no sheet.
    pg.goto(PUB + f'#/bill/{ASKNUM}'); ready(pg); pg.evaluate(STUB)
    pg.locator('.bl-top [data-bl-share]').click(); pg.wait_for_timeout(900)
    sh = pg.evaluate("() => window.__shared")
    ok(pg.locator('dialog.af-sheet[open]').count() == 0 and len(sh) == 1 and f'{ASKNUM}-ask' in sh[0]['url'], f'C1: one ask (the chair\'s email) goes straight to the phone\'s menu ({sh[0]["url"] if sh else None})')
    c.close()
    # ---- B1, S2: a laptop with no share menu ----
    c = laptop(); pg = c.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(PUB + '#/'); ready(pg); pg.evaluate(SKIP); pg.goto(PUB + f'#/bill/{NUM}'); ready(pg)
    sb = pg.locator('.bl-top [data-bl-share]'); box = sb.bounding_box() if sb.count() else None
    ok(sb.count() == 1 and box and box['y'] < 300, f'B1 laptop: Share in the page\'s top row, on the first screen (y={box and round(box["y"])})')
    ok(pg.locator('.bl-stools [data-bl-share], [data-bl-copy]').count() == 0, 'B1 laptop: the side panel no longer holds Share or Copy link')
    sb.click(); pg.wait_for_selector('dialog.af-sheet[open]', timeout=5000); pg.wait_for_timeout(1200)
    mails = pg.evaluate("() => [...document.querySelectorAll('dialog.af-sheet [data-af-mail]')].map(a => (a.classList.contains('primary') ? '*' : '') + a.textContent.trim())")
    ok(mails == ['*Gmail', 'Outlook.com', 'My mail app'], f'S2: Email it, Gmail first on a laptop ({mails})')
    href = pg.evaluate("() => document.querySelector('dialog.af-sheet [data-af-mail=\"gmail\"]').href")
    ok('sp%3Demail' in href and 'su=Speak%20up%20by' in href, 'S2: the email names the ask in its subject and tags the link sp=email')
    gm = pg.locator('dialog.af-sheet [data-af-mail="gmail"]').bounding_box()
    ok(gm and gm['y'] + gm['height'] <= 800, f'S2: the email buttons are on screen when the sheet opens (Gmail ends at {gm and round(gm["y"] + gm["height"])}px of 800)')
    pg.fill('dialog.af-sheet #af-msg', pg.input_value('dialog.af-sheet #af-msg').replace('Have you seen this?', 'Can you help with this one?'))
    pg.evaluate("() => navigator.clipboard.writeText('')"); pg.locator('dialog.af-sheet [data-af="copy"]').click(); pg.wait_for_timeout(600)
    clip = pg.evaluate("() => navigator.clipboard.readText()")
    ok(clip.startswith('Can you help with this one?') and 'sp=copy' in clip, 'S2: Copy message copies their own words, the link tagged sp=copy')
    st = pg.locator('dialog.af-sheet .af-status').inner_text()
    ok('Copied' in st, f'S2: "Copied" stays on screen ({st!r})')
    pg.screenshot(path=os.path.join(OUT, 'askfriend_3_box_laptop.png'))
    c.close()
    # ---- M1, M2, C4: the Mahalo after testimony from a friend's link ----
    c = phone(); pg = c.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(BASE + f'track.html?demo=1&restart&via=share#/bill/2026/{NUM}/testify'); pg.wait_for_selector('#hp-dlg', timeout=20000); pg.wait_for_timeout(1200)
    tap = lambda t: pg.locator('#hp-dlg button, #hp-dlg a, #hp-dlg label').filter(has_text=re.compile(t)).first.click()
    if 'Where do you stand' in pg.evaluate("document.getElementById('hp-dlg').innerText"): tap('^I support it'); pg.wait_for_timeout(700)
    tap('^Next'); pg.wait_for_timeout(600); pg.fill('#hp-name', 'Kai Ho'); tap('^See my letter'); pg.wait_for_timeout(700)
    tap('^Next'); pg.wait_for_timeout(700); tap('^Yes, I have an account'); pg.wait_for_timeout(700); tap('^I already sent it'); pg.wait_for_timeout(1600)
    bar = lambda: pg.evaluate("[...document.querySelectorAll('#hp-dlg .hp-foot button')].map(b => (b.classList.contains('primary') ? '*' : '') + b.innerText.trim())")
    nn = pg.locator('#hp-dlg .hp-foot [data-hp="ngno"]'); nb = nn.bounding_box() if nn.count() else None
    ok(bar() == ['Not now', '*Text me a code'] and nb and nb['width'] > 40 and pg.locator('#hp-dlg .hp-friend').count() == 0, f'C4: the profile ask first, "Not now" beside it and readable at 375px ({bar()})')
    nn.click(); pg.wait_for_timeout(700)
    fc = pg.locator('#hp-dlg .hp-friend')
    ok(fc.count() == 1 and 'Who’s one person who’d write too?' in fc.inner_text() and 'closes today at 3:00 PM' in fc.inner_text() and bar() == ['Done', '*Ask a friend to speak up'], f'M1-M2: the share ask in the profile ask\'s place, its button the bar\'s main one ({bar()})')
    pg.screenshot(path=os.path.join(OUT, 'askfriend_4_mahalo.png'))
    pg.evaluate(STUB); pg.locator('#hp-dlg [data-hp="share"]').click(); pg.wait_for_selector('dialog.af-sheet[open]', timeout=5000); pg.wait_for_timeout(800)
    first = pg.locator('dialog.af-sheet .af-ask').first.inner_text()
    ok(first.startswith('Send testimony') and 'you did this' in first, 'C1: what they did comes first, marked')
    pg.locator('dialog.af-sheet [data-af="sheet"]').click(); pg.wait_for_timeout(900)
    ok(pg.locator('#hp-dlg .hp-friended').count() == 1 and bar() == ['*Done'], f'after a share: one quiet line and Done alone, nothing asks again ({bar()})')
    c.close()
    # ---- B3: "Just looking" offers the lighter step ----
    c = phone(); pg = c.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(PUB + f'&via=share&restart#/bill/{NUM}'); ready(pg); pg.wait_for_timeout(1500)
    pg.locator('[data-bl-newlater]').first.click(); pg.wait_for_timeout(1200)
    ok(pg.locator('.bl-lookshare').count() == 1 and 'Can’t do it today? Ask someone who might.' in pg.locator('.bl-lookshare').inner_text(), 'B3: after "Just looking", the lighter step, once')
    c.close()
    # ---- B4: Home's line under what you did; C2: the hearing's own link ----
    c = phone(); pg = c.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(PUB + '#/'); ready(pg); pg.evaluate(SKIP)
    pg.evaluate("async n => { const c = await import('./pub/core.js'); const b = [...c.S.bills, ...Object.values(c.S.extra || {})].find(x => x.bill_number.replace(/\\s/g, '') === n) || await c.ensureBill?.(n); const h = c.hearingsOf(b).find(x => new Date(x.scheduled_at) > Date.now()); if (!c.S.watch.has(b.id)) await c.toggleWatch(b.id); await c.markDone(b.id, h.id, 'testimony', true, { quiet: true }); }", NUM)
    pg.goto(PUB + '#/find'); pg.wait_for_timeout(500); pg.goto(PUB + '#/'); ready(pg); pg.wait_for_timeout(800)
    line = pg.locator('.hm-askf')
    ok(line.count() >= 1 and 'Know someone who’d write too?' in line.first.inner_text(), 'B4: Home asks once, under what you did, while testimony is open')
    pg.screenshot(path=os.path.join(OUT, 'askfriend_5_home.png'))
    if line.count(): line.first.locator('[data-hm-askno]').click(); pg.wait_for_timeout(800)
    ok(pg.locator('.hm-askf').count() == 0, 'B4: "Not now" hides it for that hearing')
    pg.goto(PUB + f'#/bill/2026/{NUM}/attend'); ready(pg); pg.wait_for_timeout(2500)
    ok(pg.locator('.gopanel [data-attend]').count() >= 1, 'C2: a friend\'s "come to the hearing" link opens its when and where, with I plan to go')
    c.close()
    # ---- K2: the 404 page passes the new asks and ?sp= on ----
    c = laptop(); pg = c.new_page()
    html404 = open(os.path.join(ROOT, '404.html'), encoding='utf-8').read()
    pg.route(re.compile(r'.*/track\.html\?.*'), lambda r: r.fulfill(status=200, content_type='text/html', body='<title>stub</title>'))
    pg.route(re.compile(r'.*/b/(2027/)?HB9999.*'), lambda r: r.fulfill(status=404, content_type='text/html', body=html404))
    for ask in ('email', 'attend'):
        pg.goto(BASE + f'b/2027/HB9999-{ask}?sp=sheet'); pg.wait_for_url(re.compile(r'track\.html'), timeout=15000)
        ok(pg.url == BASE + f'track.html?via=share&sp=sheet#/bill/2027/HB9999/{ask}', f'K2: 404.html opens -{ask} and keeps sp ({pg.url})')
    c.close()
    ok(not errs, 'no page errors: ' + '; '.join(errs[:3]))
    br.close()
print(f'{sum(res)}/{len(res)} passed'); sys.exit(0 if all(res) else 1)
