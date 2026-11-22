# Staff7 More (R-398 piece 11), on the practice copy: the fifth door and its menu (mouse and keyboard), the phone sheet, Capitol words, Committees, A teammate's Home (look only),
# the old #/explore address, More lit on the pages it opens, Back and Close on each, no page error and no sideways scroll at 1440, 1280 and 390.
#   python3 tests/staff7_more.py [base] [shots folder]     base defaults to http://127.0.0.1:8858
import sys, os, re
from playwright.sync_api import sync_playwright
BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8858').rstrip('/')
SHOTS = sys.argv[2] if len(sys.argv) > 2 else ''
if SHOTS: os.makedirs(SHOTS, exist_ok=True)
res = []
def ok(c, m): res.append(bool(c)); print('PASS' if c else 'FAIL', m)

SIDE = "() => document.documentElement.scrollWidth <= innerWidth && document.body.scrollWidth <= innerWidth"
ACTIVE = "() => { const a = document.activeElement; return { id: a.id, href: a.getAttribute('href') || '', cls: a.className, vis: a.matches(':focus-visible'), text: a.textContent.trim() }; }"
ITEMS = "() => [...document.querySelectorAll('#moreLayer a.mi')].map(a => ({ text: a.innerText.replace(/\\s+/g, ' ').trim(), name: a.textContent.replace(/\\s+/g, ' ').trim(), href: a.getAttribute('href'), h: a.getBoundingClientRect().height, role: a.getAttribute('role') }))"
TOP = "() => { const b = document.getElementById('tbBack'), x = document.getElementById('tbClose'); return { back: b ? b.textContent.trim() : '', backVis: !!b && b.getBoundingClientRect().width > 0, close: x ? x.getAttribute('aria-label') : '', closeVis: !!x && x.getBoundingClientRect().width > 0 }; }"
H1 = "() => [...document.querySelectorAll('main h1, #app h1')].filter(h => h.getBoundingClientRect().width > 0).map(h => h.innerText.replace(/\\s+/g, ' ').trim())"
LIT = "() => { const b = document.getElementById('moreBtn'); return { cur: [...document.querySelectorAll('.bar a.bi[aria-current], .bar button.bi[aria-current]')].map(e => e.innerText.trim()), more: b ? b.getAttribute('aria-current') : null }; }"
PILL = "() => [...document.querySelectorAll('.bar .bi')].map(b => { const p = b.querySelector('.rpill'), s = getComputedStyle(p); return { name: b.innerText.trim(), bg: s.backgroundColor, shadow: s.boxShadow, weight: getComputedStyle(b).fontWeight }; })"
# inside the look-only area: anything that can be clicked or focused
CLICKABLE = "() => [...document.querySelectorAll('#app .lo')].flatMap(r => [...r.querySelectorAll('a, button, input, select, textarea, [href], [tabindex], [role=button], [role=link], [onclick]')].filter(e => !(e.tagName === 'H1' && e.getAttribute('tabindex') === '-1'))).length"
LOPTR = "() => { const r = [...document.querySelectorAll('#app .lo')].flatMap(x => [...x.querySelectorAll('*')]); return r.filter(e => getComputedStyle(e).cursor === 'pointer').length; }"

def open_as(br, who, w, h, hash='#/'):
    ctx = br.new_context(viewport={'width': w, 'height': h}); pg = ctx.new_page(); pg.errs = []
    pg.on('pageerror', lambda e: pg.errs.append(str(e)))
    pg.on('console', lambda m: pg.errs.append(m.text) if m.type == 'error' and 'Failed to load resource' not in m.text and 'ERR_FAILED' not in m.text else None)
    pg.goto(f'{BASE}/staff7.html?demo=1&as={who}{hash}'); pg.wait_for_selector('.paper', state='attached', timeout=60000)
    pg.evaluate("Promise.all([document.fonts.load('600 16px Poppins'), document.fonts.load('400 16px Lato'), document.fonts.load('700 16px Lato')])"); pg.wait_for_timeout(400)
    return pg
def go(pg, hash): pg.evaluate("h => { window.__staff7TrailReset && window.__staff7TrailReset(); location.hash = h; }", hash); pg.wait_for_timeout(350)
def snap(pg, name):
    pg.wait_for_timeout(300)
    if SHOTS: pg.screenshot(path=os.path.join(SHOTS, name))
def menu_open(pg): return pg.evaluate("() => !!document.getElementById('moreLayer') && document.getElementById('moreBtn').getAttribute('aria-expanded') === 'true'")

with sync_playwright() as p:
    br = p.chromium.launch()

    # ============ 1. the door and the menu, laptop, an admin and a staffer ============
    for who in ('NT', 'KV'):
        pg = open_as(br, who, 1440, 900)
        names = pg.eval_on_selector_all('.bar .bi', 'els => els.map(e => e.innerText.trim())')
        ok(names == ['Home', 'Issues', 'Calendar', 'Search', 'More'], f'1 {who}: five doors, the fifth is More, none is Explore ({names})')
        d = pg.evaluate("() => { const b = document.getElementById('moreBtn'); return { tag: b.tagName, pop: b.getAttribute('aria-haspopup'), exp: b.getAttribute('aria-expanded'), href: b.getAttribute('href') }; }")
        ok(d['tag'] == 'BUTTON' and d['pop'] == 'menu' and d['exp'] == 'false' and not d['href'], f'1 {who}: More is a button with aria-haspopup="menu", closed ({d})')
        pg.click('#moreBtn'); pg.wait_for_timeout(250)
        items = pg.evaluate(ITEMS)
        ok(menu_open(pg) and [i['href'] for i in items] == ['#/team', '#/more/team', '#/public', '#/more/words', '#/more/committees', '#/me/alerts'], f'1 {who}: opens with six items in order ({[i["href"] for i in items]})')
        ok([i['name'] for i in items] == ['Team Late steps · bills with no lead', 'A teammate’s Home Look only', 'Public words', 'Capitol words', 'Committees', 'My alerts Where the tracker’s alerts reach you, and a test message.'], f'1 {who}: names and muted lines ({[i["name"] for i in items]})')
        ok(not any('Lead changes' in i['text'] for i in items) and 'Lead changes' not in pg.inner_text('#moreLayer'), f'1 {who}: Lead changes is not in the menu')
        ok(pg.evaluate("() => document.querySelectorAll('#moreLayer .mrule').length") == 2 and pg.evaluate("() => document.querySelectorAll('#moreLayer h2, #moreLayer h3, #moreLayer .mhead').length") == 0, f'1 {who}: two dividers, no group headings')
        ok(all(i['h'] >= 44 for i in items), f'1 {who}: rows at least 44px ({[round(i["h"]) for i in items]})')
        pill = {x['name']: x for x in pg.evaluate(PILL)}
        ok(pill['More']['bg'] in ('rgba(0, 0, 0, 0)', 'transparent') and pill['More']['shadow'] != 'none' and pill['Home']['bg'] == 'rgb(255, 255, 255)', f'1 {who}: open More is outlined, not filled; the filled pill stays on Home ({pill["More"]["bg"]} / {pill["Home"]["bg"]})')
        snap(pg, f'menu_{who}.png')
        pg.keyboard.press('Escape'); pg.wait_for_timeout(200)
        a = pg.evaluate(ACTIVE)
        ok(not menu_open(pg) and a['id'] == 'moreBtn', f'1 {who}: Escape closes it and focus is back on the door ({a["id"]})')
        pg.close()

    pg = open_as(br, 'KV', 1440, 900)
    # keyboard: Enter on the door puts focus on the first item with a focus ring; arrows move; Home and End; Escape returns
    pg.focus('#moreBtn'); pg.keyboard.press('Enter'); pg.wait_for_timeout(250)
    a = pg.evaluate(ACTIVE)
    ok(menu_open(pg) and a['href'] == '#/team' and a['vis'], f'1 keyboard: Enter opens it, focus is on the first item with a focus ring ({a["href"]}, visible={a["vis"]})')
    seq = []
    for k in ('ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowDown', 'ArrowUp'): pg.keyboard.press(k); seq.append(pg.evaluate(ACTIVE)['href'])
    ok(seq == ['#/more/team', '#/public', '#/more/words', '#/more/committees', '#/me/alerts', '#/more/committees'], f'1 keyboard: arrows move and wrap ({seq})')
    pg.keyboard.press('Escape'); pg.wait_for_timeout(200)
    ok(not menu_open(pg) and pg.evaluate(ACTIVE)['id'] == 'moreBtn' and '#/more' not in pg.evaluate('location.hash'), '1 keyboard: Escape closes it, focus back on the door')
    # Tab on the laptop menu closes it and the browser's Tab goes on from the door (focus is not left behind or lost)
    pg.keyboard.press('Enter'); pg.wait_for_timeout(250); pg.keyboard.press('Tab'); pg.wait_for_timeout(250)
    a = pg.evaluate("() => ({ id: document.activeElement.id, tag: document.activeElement.tagName, inLayer: !!document.activeElement.closest('#moreLayer') })")
    ok(not menu_open(pg) and a['tag'] != 'BODY' and not a['inLayer'] and a['id'] != 'moreMenu', f'1 keyboard: Tab closes the menu and focus moves on from the door ({a})')
    # a click outside, and More again
    pg.click('#moreBtn'); pg.wait_for_timeout(200); pg.mouse.click(1000, 700); pg.wait_for_timeout(200)
    ok(not menu_open(pg) and pg.evaluate(ACTIVE)['id'] == 'moreBtn', '1 mouse: a click outside closes it and focus goes back to the door')
    pg.click('#moreBtn'); pg.wait_for_timeout(200); pg.click('#moreBtn'); pg.wait_for_timeout(200)
    ok(not menu_open(pg) and pg.evaluate(ACTIVE)['id'] == 'moreBtn', '1 mouse: More again closes it, focus on the door')
    # an item goes where it says and the menu is gone
    pg.click('#moreBtn'); pg.wait_for_timeout(200); pg.click('#moreLayer a[href="#/team"]'); pg.wait_for_timeout(500)
    ok(pg.evaluate('location.hash') == '#/team' and not menu_open(pg) and pg.evaluate("() => !document.getElementById('moreLayer')"), '1 mouse: Team opens its page and the menu is closed')
    ok(pg.evaluate(LIT)['cur'] == ['Home'], f'1 Team keeps the Home door lit (as before) ({pg.evaluate(LIT)["cur"]})')
    pg.close()

    # ============ 2. the phone sheet ============
    pg = open_as(br, 'KV', 390, 844)
    pg.click('#moreBtn'); pg.wait_for_timeout(300)
    info = pg.evaluate("() => { const s = document.querySelector('#moreLayer .msheet'), c = s.querySelector('.mclose'), bar = document.querySelector('.bar').getBoundingClientRect(), sb = s.getBoundingClientRect(), cb = c.getBoundingClientRect(); return { role: s.getAttribute('role'), modal: s.getAttribute('aria-modal'), closeText: c.textContent.trim(), cw: cb.width, ch: cb.height, cright: sb.right - cb.right, ctop: cb.top - sb.top, above: sb.bottom <= bar.top + 1, back: !!document.querySelector('#moreLayer .mback') }; }")
    items = pg.evaluate(ITEMS)
    ok(info['role'] == 'dialog' and info['modal'] == 'true' and info['back'] and info['above'], f'2 phone: a modal sheet above the bar with a backdrop ({info})')
    ok(info['closeText'] == 'Close' and info['cw'] >= 44 and info['ch'] >= 44 and info['cright'] < 40 and info['ctop'] < 80, f'2 phone: a visible Close at the sheet\'s top right, 44px ({info["cw"]}x{info["ch"]})')
    ok(len(items) == 6 and all(i['h'] >= 48 for i in items), f'2 phone: six rows of at least 48px ({[round(i["h"]) for i in items]})')
    ok(pg.evaluate("() => document.getElementById('moreBtn').getBoundingClientRect().width") > 0 and pg.evaluate(PILL)[-1]['shadow'] != 'none', '2 phone: More is the fifth tab and shows pressed')
    snap(pg, 'menu_390.png')
    inside = []
    for _ in range(8): pg.keyboard.press('Tab'); inside.append(pg.evaluate("() => !!document.activeElement.closest('#moreLayer .msheet')"))
    ok(all(inside), f'2 phone: Tab keeps the focus inside the sheet ({inside})')
    pg.click('#moreLayer .mclose'); pg.wait_for_timeout(250)
    ok(not menu_open(pg) and pg.evaluate(ACTIVE)['id'] == 'moreBtn', '2 phone: Close closes it, focus on the tab')
    pg.click('#moreBtn'); pg.wait_for_timeout(250); pg.mouse.click(195, 150); pg.wait_for_timeout(250)
    ok(not menu_open(pg), '2 phone: a tap on the backdrop closes it')
    pg.click('#moreBtn'); pg.wait_for_timeout(250)
    pg.evaluate("""() => { const s = document.querySelector('#moreLayer .msheet'), t = y => new Touch({ identifier: 1, target: s, clientX: 100, clientY: y });
      s.dispatchEvent(new TouchEvent('touchstart', { touches: [t(500)], bubbles: true })); s.dispatchEvent(new TouchEvent('touchmove', { touches: [t(640)], bubbles: true })); s.dispatchEvent(new TouchEvent('touchend', { changedTouches: [t(640)], bubbles: true })); }""")
    pg.wait_for_timeout(250)
    ok(not menu_open(pg), '2 phone: a downward swipe closes it')
    pg.click('#moreBtn'); pg.wait_for_timeout(250); pg.keyboard.press('Escape'); pg.wait_for_timeout(200)
    ok(not menu_open(pg), '2 phone: Escape closes it too')
    pg.click('#moreBtn'); pg.wait_for_timeout(250); pg.click('#moreLayer a[href="#/more/words"]'); pg.wait_for_timeout(500)
    ok(pg.evaluate('location.hash') == '#/more/words' and not menu_open(pg) and pg.evaluate(LIT)['more'] == 'page', '2 phone: Capitol words opens, the sheet is gone and More is lit')
    ok(not pg.errs, f'2 phone: no page error ({pg.errs[:1]})'); pg.close()

    # ============ 3. Capitol words ============
    pg = open_as(br, 'KV', 1440, 900, '#/more/words')
    ok(pg.evaluate(H1) == ['Capitol words'] and 'What the Capitol’s words mean, in plain language.' in pg.inner_text('#app'), f'3 title and line ({pg.evaluate(H1)})')
    ok(pg.locator('.cw').count() == 18 and pg.inner_text('#cwCount').strip() == '18 of 18 words', f'3 18 words, "18 of 18 words" ({pg.locator(".cw").count()}, {pg.inner_text("#cwCount").strip()})')
    heads = pg.eval_on_selector_all('.cwh', 'els => els.map(e => e.innerText.replace(/\\s+/g, " ").trim())')
    ok('Last committee deadline (Capitol: Decking)' in heads and 'Committee deadline (Capitol: Lateral)' in heads and 'Session ends (Capitol: Sine die)' in heads and 'Legislative day' in heads, f'3 the app\'s name first, the Capitol\'s word after it ({[h for h in heads if "Capitol:" in h]})')
    ok(pg.eval_on_selector('.cwh .cwcap', 'e => getComputedStyle(e).color') != pg.eval_on_selector('.cwh', 'e => getComputedStyle(e).color'), '3 the Capitol\'s word is in muted text')
    txt = pg.inner_text('#app')
    ok(not re.search(r'\breview', txt, re.I) and 'second look' in txt, '3 "second look", never "review"')
    ok(pg.evaluate("() => [...document.querySelectorAll('#app a[href]')].filter(a => /^https?:/.test(a.getAttribute('href'))).length") == 0, '3 no outside links')
    pg.fill('#cwIn', 'last committee'); pg.wait_for_timeout(200)
    heads = pg.eval_on_selector_all('.cwh', 'els => els.map(e => e.innerText.replace(/\\s+/g, " ").trim())')
    ok(heads == ['Committee deadline (Capitol: Lateral)', 'Last committee deadline (Capitol: Decking)'] and pg.inner_text('#cwCount').strip() == '2 of 18 words', f'3 typing narrows it: "2 of 18 words" ({heads})')
    ok(pg.locator('.cw mark').count() >= 3 and 'last committee' in pg.locator('.cw mark').first.inner_text().lower(), '3 the match is highlighted')
    ok(pg.evaluate("() => { const col = document.querySelector('.cw p').getBoundingClientRect(); return [...document.querySelectorAll('.cw mark')].every(m => [...m.getClientRects()].every(r => r.left >= col.left - 0.5 && r.right <= col.right + 0.5)); }"), '3 the highlight stays inside the text column')
    snap(pg, 'words_find.png')
    pg.fill('#cwIn', 'decking'); pg.wait_for_timeout(200)
    ok('Last committee deadline (Capitol: Decking)' in pg.eval_on_selector_all('.cwh', 'els => els.map(e => e.innerText.replace(/\\s+/g, " ").trim())'), '3 the Capitol\'s word finds the entry')
    pg.fill('#cwIn', 'crossed to the other'); pg.wait_for_timeout(200)
    ok(pg.locator('.cw').count() == 1 and 'Capitol: Crossover' in pg.inner_text('.cwh'), '3 the app\'s own name finds the entry')
    pg.fill('#cwIn', 'a day the chambers meet'); pg.wait_for_timeout(200)
    ok(pg.locator('.cw').count() == 1 and 'Legislative day' in pg.inner_text('.cwh'), '3 the meaning finds the entry')
    pg.fill('#cwIn', 'zzzq'); pg.wait_for_timeout(200)
    ok(pg.locator('.cw').count() == 0 and pg.inner_text('#cwCount').strip() == '0 of 18 words' and pg.is_visible('#cwNone'), '3 nothing found says so')
    pg.fill('#cwIn', ''); pg.wait_for_timeout(200)
    ok(pg.locator('.cw').count() == 18, '3 clearing the box brings all 18 back')
    ok(pg.evaluate(LIT)['cur'] == ['More'], f'3 More is the lit door ({pg.evaluate(LIT)["cur"]})')
    t = pg.evaluate(TOP); ok(t['backVis'] and t['closeVis'] and t['back'] == 'Back to Home' and t['close'] == 'Close', f'3 Back and Close ({t})')
    ok(pg.evaluate(SIDE) and not pg.errs, f'3 no sideways scroll, no page error ({pg.errs[:1]})')
    snap(pg, 'words.png'); pg.close()

    # ============ 4. Committees ============
    pg = open_as(br, 'KV', 1440, 900, '#/more/committees')
    exp = pg.evaluate("() => import('/staff6/data.js').then(d => { const l = Object.values(d.S.committees); return { h: l.filter(c => c.chamber === 'H').length, s: l.filter(c => c.chamber === 'S').length, n: l.length, amp: l.filter(c => /&/.test(c.name)).length }; })")
    heads = pg.eval_on_selector_all('.cmh', 'els => els.map(e => e.innerText.replace(/\\s+/g, " ").trim())')
    ok(pg.evaluate(H1) == ['Committees'] and heads == [f'House · {exp["h"]}', f'Senate · {exp["s"]}'], f'4 House then Senate with counts ({heads})')
    ok('Every House and Senate committee. Open one to see its bills and hearings.' in pg.inner_text('#app'), '4 the line under the title')
    rows = pg.evaluate("() => [...document.querySelectorAll('a.cmr')].map(a => { const n = a.querySelector('.cmn b'), c = a.querySelector('.cmc'), ch = a.querySelector('.cmch'); return { href: a.getAttribute('href'), name: n.textContent, code: c.textContent, chair: ch.textContent, nl: n.getBoundingClientRect().left, cl: ch.getBoundingClientRect().left, nc: getComputedStyle(n).color, chev: !!a.querySelector('svg'), h: a.getBoundingClientRect().height }; })")
    ok(len(rows) == exp['n'] and all(r['href'] == '#/search/committee/' + r['code'] for r in rows), f'4 every committee is one whole-row link to its Search page ({len(rows)} of {exp["n"]})')
    ok(not any('&' in r['name'] for r in rows) and exp['amp'] > 0 and any(r['name'] == 'Agriculture and Food Systems' for r in rows), '4 "and", never "&"')
    ok(len({round(r['cl']) for r in rows}) == 1 and len({round(r['nl']) for r in rows}) == 1, f'4 one grid: the columns line up ({sorted({round(r["cl"]) for r in rows})})')
    ok(all(r['chev'] and r['chair'] and r['h'] >= 44 for r in rows) and len({r['nc'] for r in rows}) == 1 and rows[0]['nc'] == 'rgb(0, 105, 142)', '4 chair column, chevron, name in the link colour, rows 44px or more')
    sorted_ok = pg.evaluate("() => [...document.querySelectorAll('.cmg')].every(g => { const n = [...g.querySelectorAll('.cmn b')].map(b => b.textContent.trim()); return n.every((x, i) => !i || n[i-1].localeCompare(x) <= 0); })")
    ok(sorted_ok, '4 committees are in name order within House and within Senate')
    cb = pg.evaluate("() => [...document.querySelectorAll('.cmr')].slice(0, 5).map(a => { const c = a.querySelector('.cmgo').getBoundingClientRect(), r = a.getBoundingClientRect(); return Math.abs((c.top + c.bottom) / 2 - (r.top + r.bottom) / 2); })")
    ok(all(d < 4 for d in cb), f'4 the chevron sits in the middle of its row ({[round(d) for d in cb]})')
    ok(pg.evaluate(LIT)['cur'] == ['More'] and pg.evaluate(TOP)['back'] == 'Back to Home' and pg.evaluate(TOP)['closeVis'], '4 More lit, Back and Close')
    snap(pg, 'committees.png')
    pg.click('a.cmr[href="#/search/committee/HLT"]'); pg.wait_for_timeout(500)
    ok(pg.evaluate('location.hash') == '#/search/committee/HLT' and 'Health' in pg.inner_text('#app'), '4 a row opens that committee\'s Search page')
    pg.evaluate("history.back()"); pg.wait_for_timeout(400)
    ok(pg.evaluate('location.hash') == '#/more/committees', '4 browser Back returns to Committees')
    ok(pg.evaluate(SIDE) and not pg.errs, f'4 no sideways scroll, no page error ({pg.errs[:1]})'); pg.close()

    # ============ 5. A teammate's Home ============
    pg = open_as(br, 'KV', 1440, 900, '#/more/team')
    rows = pg.evaluate("() => [...document.querySelectorAll('a.tmr')].map(a => ({ href: a.getAttribute('href'), name: a.querySelector('.tmn').textContent, mark: a.querySelector('.person').textContent, sub: a.querySelector('.tms').textContent }))")
    mates = pg.evaluate("() => import('/staff6/data.js').then(async d => { const st = await import('/staff7/steps.js'); const me = d.S.me; return d.S.advocates.filter(a => a.is_active !== false && a.id !== me.id).map(a => ({ i: a.initials, n: st.stepsFor(a).length, f: a.full_name })).sort((x, y) => x.f.localeCompare(y.f)); })")
    ok(pg.evaluate(H1) == ['A teammate’s Home'] and [r['name'] for r in rows] == [m['f'] for m in mates] and 'KV' not in [r['mark'] for r in rows], f'5 picker: the team but the viewer, by first name ({[r["name"] for r in rows]})')
    ok(all(r['sub'] == (f'{m["n"]} step' + ('' if m['n'] == 1 else 's') if m['n'] else 'Nothing waiting') for r, m in zip(rows, mates)) and any(r['sub'] != 'Nothing waiting' for r in rows), f'5 picker: each says its steps or "Nothing waiting" ({[r["sub"] for r in rows][:4]})')
    ok(pg.evaluate(LIT)['cur'] == ['More'] and 'Pick a person to see their Home as they see it.' in pg.inner_text('#app') and pg.evaluate(TOP)['back'] == 'Back to Home', '5 picker: More lit, its line, Back and Close')
    snap(pg, 'team_pick.png')
    pg.click('a.tmr[href="#/more/team/KR"]'); pg.wait_for_timeout(600)
    t = pg.evaluate(TOP)
    ok(pg.evaluate('location.hash') == '#/more/team/KR' and t['back'] == 'Back to teammates' and t['closeVis'] and pg.evaluate(LIT)['cur'] == ['More'], f'5 Kris: Back to teammates, Close, More lit ({t["back"]})')
    ok(pg.evaluate("() => { const l = document.getElementById('laterList'); return !!l && !l.hidden && l.getBoundingClientRect().height > 0; }") and pg.evaluate("() => !document.querySelector('#app .qt svg, .lo .qt svg')") and pg.evaluate("() => ![...document.querySelectorAll('.lo .qt')].some(e => e.hasAttribute('aria-expanded'))"), '5 Kris: the Later list is always open and its line is a plain label (no chevron)')
    ok(pg.inner_text('.lobar').strip().startswith('Kris’s Home, look only') and 'Kris’s steps' in pg.inner_text('#app'), '5 Kris: the band and heading use the first name only')
    txt = pg.inner_text('#app')
    ok('Kris’s Home, look only' in txt and 'This is what Kris sees. Nothing here can be done from your side.' in txt and 'Kris’s steps' in txt and 'Good morning, Kris.' in txt, '5 Kris: the band, the steps heading and Kris\'s own greeting')
    ok(pg.evaluate("() => !!document.querySelector('.lobar svg.ic')") and pg.evaluate("() => getComputedStyle(document.querySelector('.lobar')).backgroundColor") != 'rgb(255, 255, 255)', '5 Kris: the neutral band carries the eye icon')
    ok('Suggested' not in pg.inner_text('#wl') and pg.locator('#wl .ovl, #wl .ovr').count() == 0 and 'Overview' not in pg.inner_text('#wl'), '5 Kris: no Suggested, no Overview row')
    ok(pg.evaluate(CLICKABLE) == 0, f'5 Kris: no link, button or field inside the look-only area ({pg.evaluate(CLICKABLE)})')
    ok(pg.evaluate(LOPTR) == 0, '5 Kris: no pointer cursor anywhere in it')
    ok(pg.evaluate("() => [...document.querySelectorAll('#app .lo')].every(r => r.querySelectorAll('a[href]').length === 0)") and pg.evaluate("() => document.querySelectorAll('#wl a, #wl button').length") == 0, '5 Kris: the list column holds no link or button')
    h0 = pg.evaluate('location.hash'); b = pg.evaluate("() => { const e = document.querySelector('#wl .sr3'); const r = e.getBoundingClientRect(); return [r.left + 40, r.top + 20]; }")
    pg.mouse.click(b[0], b[1]); pg.wait_for_timeout(300); pg.mouse.click(700, 220); pg.wait_for_timeout(300)
    ok(pg.evaluate('location.hash') == h0 and pg.evaluate("() => document.getElementById('tbBack') !== null"), '5 Kris: clicking a step or a fact opens nothing')
    late = pg.evaluate("() => [...document.querySelectorAll('#wl .late, #wl .soon, #wl .stm')].length")
    ok(late > 0 and 'Past due' in pg.inner_text('#wl'), '5 Kris: late still shows as Home shows it ("Past due")')
    ok(pg.evaluate(SIDE) and not pg.errs, f'5 Kris: no sideways scroll, no page error ({pg.errs[:1]})')
    snap(pg, 'team_kris.png')
    pg.click('#tbBack'); pg.wait_for_timeout(500)
    ok(pg.evaluate('location.hash') == '#/more/team', '5 Back goes to the teammates')
    # the empty state: someone with nothing waiting
    nothing = [m['i'] for m in mates if m['n'] == 0]
    pg.evaluate("window.__staff7TrailReset && window.__staff7TrailReset()")
    if nothing:
        go(pg, '#/more/team/' + nothing[0]); n = pg.evaluate("() => document.querySelector('.lobar b').textContent")
        ok('All clear' in pg.inner_text('#wl') and 'look only' in n and pg.evaluate(CLICKABLE) == 0, f'5 empty: {n} shows "All clear" and nothing to click')
        snap(pg, 'team_empty.png')
    else: ok(False, '5 empty: the practice copy has no one with nothing waiting')
    go(pg, '#/more/team/ZZ')
    ok('No teammate by that name.' in pg.inner_text('#app') and pg.evaluate(TOP)['back'] == 'Back to teammates', '5 an unknown address says so calmly')
    go(pg, '#/more/team/KV')
    ok('No teammate by that name.' in pg.inner_text('#app'), '5 your own address is not a teammate\'s Home')
    go(pg, '#/more/team/kr')
    ok('Kris’s Home, look only' in pg.inner_text('#app'), '5 initials in lower case also work')
    pg.close()
    # as an admin, the same
    pg = open_as(br, 'NT', 1440, 900, '#/more/team/KV')
    ok('Kevin’s Home, look only' in pg.inner_text('#app') and pg.evaluate(CLICKABLE) == 0 and not pg.errs, f'5 an admin sees Kevin look-only too ({pg.errs[:1]})'); pg.close()
    # on a phone
    pg = open_as(br, 'KV', 390, 844, '#/more/team/KR')
    ok('Kris’s Home, look only' in pg.inner_text('#app') and 'Kris’s steps' in pg.inner_text('#app') and pg.evaluate(CLICKABLE) == 0 and pg.evaluate(SIDE) and not pg.errs, f'5 phone: look-only Home, steps in the page, no sideways scroll ({pg.errs[:1]})')
    ok('Kris’s Home, look only' in pg.inner_text('.lobar') and pg.evaluate("() => { const l = document.getElementById('laterList'); return !l || !l.hidden; }"), '5 phone: first name in the band, Later list open')
    ok(pg.evaluate(TOP)['backVis'] and pg.evaluate(TOP)['closeVis'], '5 phone: Back and Close')
    snap(pg, 'team_kris_390.png'); pg.close()

    # ============ 6. the old Explore address, and where Back goes ============
    pg = open_as(br, 'KV', 1440, 900, '#/explore')
    ok(pg.evaluate('location.hash') == '#/' and 'Good ' in pg.inner_text('#app') and pg.evaluate(LIT)['cur'] == ['Home'] and 'Explore' not in pg.inner_text('body'), f'6 #/explore shows Home and the address becomes #/ ({pg.evaluate("location.hash")})')
    go(pg, '#/calendar'); pg.click('#moreBtn'); pg.wait_for_timeout(200); pg.click('#moreLayer a[href="#/more/committees"]'); pg.wait_for_timeout(500)
    ok(pg.evaluate(TOP)['back'] == 'Back to Calendar', f'6 Back says where you came from ({pg.evaluate(TOP)["back"]})')
    pg.click('#tbBack'); pg.wait_for_timeout(500)
    ok(pg.evaluate('location.hash') == '#/calendar', '6 Back goes there')
    pg.click('#moreBtn'); pg.wait_for_timeout(200); pg.click('#moreLayer a[href="#/more/words"]'); pg.wait_for_timeout(500); pg.click('#tbClose'); pg.wait_for_timeout(500)
    ok(pg.evaluate('location.hash') == '#/calendar', '6 Close goes there too')
    go(pg, '#/'); pg.click('#moreBtn'); pg.wait_for_timeout(200); pg.click('#moreLayer a[href="#/more/words"]'); pg.wait_for_timeout(500); pg.keyboard.press('Escape'); pg.wait_for_timeout(500)
    ok(pg.evaluate('location.hash') == '#/', '6 Escape on an opened page goes back too')
    ok('Explore' not in pg.inner_text('body') and not pg.errs, f'6 nothing says Explore, no page error ({pg.errs[:1]})'); pg.close()

    # ============ 7. every page at the three widths ============
    for w, h in ((1440, 900), (1280, 800), (390, 844)):
        for hash in ('#/', '#/more/words', '#/more/committees', '#/more/team', '#/more/team/KR', '#/more/team/MR'):
            pg = open_as(br, 'KV', w, h, hash)
            ok(pg.evaluate(SIDE) and not pg.errs and len(pg.evaluate(H1)) >= 1, f'7 {w} {hash}: loads, no sideways scroll, a heading, no page error ({pg.errs[:1]})')
            if hash == '#/' and w == 1280:
                pg.click('#moreBtn'); pg.wait_for_timeout(250)
                r = pg.evaluate("() => { const m = document.querySelector('#moreLayer .msheet').getBoundingClientRect(); return m.left >= 0 && m.right <= innerWidth && m.top >= 0 && m.bottom <= innerHeight; }")
                ok(r, '7 1280: the popover is inside the window')
            pg.close()
    br.close()

print(f'{sum(res)}/{len(res)} passed')
sys.exit(0 if all(res) else 1)
