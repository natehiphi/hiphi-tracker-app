# Staff7 Help (R-398 piece 12), on the practice copy: Help (six how-tos, two more rows), each guide, Where things are, Capitol words under Help,
# the old #/more/words address, More lit on every Help page, Back to Help, no page error and no sideways scroll at 1440, 1280 and 390.
#   python3 tests/staff7_help.py [base] [shots folder]     base defaults to http://127.0.0.1:8875
import sys, os, re
from playwright.sync_api import sync_playwright
BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8875').rstrip('/')
SHOTS = sys.argv[2] if len(sys.argv) > 2 else ''
if SHOTS: os.makedirs(SHOTS, exist_ok=True)
res = []
def ok(c, m): res.append(bool(c)); print('PASS' if c else 'FAIL', m)
SIDE = "() => document.documentElement.scrollWidth <= innerWidth && document.body.scrollWidth <= innerWidth"
H1 = "() => [...document.querySelectorAll('#app h1')].filter(h => h.getBoundingClientRect().width > 0).map(h => h.innerText.replace(/\\s+/g, ' ').trim())"
LIT = "() => { const b = document.getElementById('moreBtn'); return { cur: [...document.querySelectorAll('.bar a.bi[aria-current], .bar button.bi[aria-current]')].map(e => e.innerText.trim()), more: b ? b.getAttribute('aria-current') : null }; }"
BACK = "() => { const b = document.getElementById('tbBack'); return b ? b.textContent.trim() : ''; }"
GUIDES = [('testimony', 'Write and file testimony', 7), ('sort', 'Sort new bills', 6), ('ask', 'Ask for a hearing', 7), ('public', 'Write public words', 7), ('alerts', 'Set your alerts', 6), ('legislator', 'Talk with a legislator', 5)]

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

with sync_playwright() as p:
    br = p.chromium.launch()
    # ============ 1. Help ============
    pg = open_as(br, 'KV', 1440, 900, '#/more/help')
    ok(pg.evaluate(H1) == ['Help'] and 'How to do the main jobs, where things are, and what the Capitol’s words mean.' in pg.inner_text('#app'), f'1 title and line ({pg.evaluate(H1)})')
    rows = pg.evaluate("() => [...document.querySelectorAll('a.hp-r')].map(a => ({ t: a.querySelector('b').textContent, l: a.querySelector('.hp-rl').textContent, h: a.getAttribute('href'), ch: !!a.querySelector('svg.hp-go'), ht: a.getBoundingClientRect().height }))")
    ok(len(rows) == 8, f'1 eight rows ({len(rows)})')
    ok([r['t'] for r in rows[:6]] == [g[1] for g in [GUIDES[0], GUIDES[1], GUIDES[2], GUIDES[5], GUIDES[3], GUIDES[4]]], f'1 six how-tos in the drawn order ({[r["t"] for r in rows[:6]]})')
    ok([r['t'] for r in rows[6:]] == ['What each place is for', 'What the Capitol’s words mean'], '1 two more rows')
    ok(all(r['ch'] and r['ht'] >= 44 and r['l'] for r in rows), '1 each row has a muted line, a chevron and is at least 44px')
    ok('Who to ask' in pg.inner_text('#app') and 'Still stuck? Message Nate in Slack.' in pg.inner_text('#app') and pg.locator('#app a[href^="http"]').count() == 0, '1 ends with Who to ask, no outside links')
    ok(pg.evaluate(BACK) == 'Back to Home', f'1 Back goes to Home ({pg.evaluate(BACK)})')
    lit = pg.evaluate(LIT); ok(lit['more'] == 'page' and lit['cur'] == ['More'], f'1 More is lit ({lit})')
    ok(pg.evaluate("() => { const e = document.querySelector('.hp'); const l = e.querySelector('.hp-list'); return l.getBoundingClientRect().width <= 680.5; }"), '1 the reading column is at most 680px')
    snap(pg, 'help.png')
    # ============ 2. each guide ============
    for k, title, n in GUIDES:
        go(pg, f'#/more/help/{k}')
        steps = pg.evaluate("() => [...document.querySelectorAll('ol.hp-steps > li')].map(li => ({ n: li.querySelector('.hp-n').textContent, t: li.querySelector('.hp-t').innerText }))")
        ok(pg.evaluate(H1) == [title], f'2 {k}: title ({pg.evaluate(H1)})')
        ok(len(steps) == n and [s['n'] for s in steps] == [str(i + 1) for i in range(n)] and all(len(s['t']) > 10 for s in steps), f'2 {k}: {n} numbered steps ({len(steps)})')
        ok(pg.locator('.hp-ask h2').inner_text() == 'Who to ask' and 'Message Nate in Slack' in pg.locator('.hp-ask').inner_text(), f'2 {k}: ends with Who to ask')
        ok(pg.evaluate(BACK) == 'Back to Help' and pg.evaluate(LIT)['more'] == 'page', f'2 {k}: Back to Help, More lit')
        ok(pg.evaluate("() => document.querySelector('ol.hp-steps').getBoundingClientRect().width <= 680.5"), f'2 {k}: steps within 680px')
    go(pg, '#/more/help/testimony'); snap(pg, 'help_testimony.png')
    pg.click('#tbBack'); pg.wait_for_timeout(400)
    ok(pg.evaluate('location.hash') == '#/more/help' and pg.evaluate(H1) == ['Help'], f'2 Back to Help works ({pg.evaluate("location.hash")})')
    pg.click('a.hp-r[href="#/more/help/sort"]'); pg.wait_for_timeout(400)
    ok(pg.evaluate(H1) == ['Sort new bills'], '2 a row opens its guide')
    pg.click('#tbClose'); pg.wait_for_timeout(400)
    ok(pg.evaluate("location.hash") != '#/more/help/sort', f'2 Close leaves the guide ({pg.evaluate("location.hash")})')
    # ============ 3. Where things are ============
    go(pg, '#/more/help/where')
    t = pg.inner_text('#app')
    ok(pg.evaluate(H1) == ['Where things are'] and pg.evaluate(BACK) == 'Back to Help', '3 title, Back to Help')
    names = pg.evaluate("() => [...document.querySelectorAll('.hp-defs li b')].map(b => b.textContent)")
    ok(names == ['Home', 'Issues', 'Calendar', 'Search', 'More', 'Team', 'Public words', 'Legislators', 'Committees', 'Help', 'My alerts'], f'3 doors, More items, alerts ({names})')
    ok('Who to ask' in t and pg.evaluate(LIT)['more'] == 'page', '3 Who to ask; More lit')
    snap(pg, 'help_where.png')
    # ============ 4. Capitol words under Help ============
    go(pg, '#/more/help/words')
    ok(pg.evaluate(H1) == ['Capitol words'] and pg.evaluate(BACK) == 'Back to Help' and pg.evaluate(LIT)['more'] == 'page', '4 Capitol words: title, Back to Help, More lit')
    ok(pg.locator('.cwe').count() == 18 and pg.inner_text('#cwCount').strip() == '18 of 18 words', '4 18 words')
    pg.fill('#cwIn', 'decking'); pg.wait_for_timeout(250)
    ok(0 < pg.locator('.cwe').count() < 18 and pg.inner_text('#cwCount').strip().endswith('of 18 words'), f'4 the find box narrows it ({pg.inner_text("#cwCount").strip()})')
    pg.click('#tbBack'); pg.wait_for_timeout(400); ok(pg.evaluate('location.hash') == '#/more/help', '4 Back to Help from the words')
    pg.click('a.hp-r[href="#/more/help/words"]'); pg.wait_for_timeout(400); ok(pg.evaluate(H1) == ['Capitol words'], '4 the Help row opens the words')
    go(pg, '#/more/words'); pg.wait_for_timeout(300)
    ok(pg.evaluate('location.hash') == '#/more/help/words' and pg.evaluate(H1) == ['Capitol words'] and pg.locator('.cwe').count() == 18, f'4 #/more/words lands on #/more/help/words ({pg.evaluate("location.hash")})')
    go(pg, '#/more/help/nothing'); ok('not here' in pg.inner_text('#app'), '4 an unknown guide says so')
    ok(not pg.errs, f'no page error at 1440 ({pg.errs[:2]})'); pg.close()
    # ============ 5. no sideways scroll, no errors, three widths ============
    for w, h in ((1440, 900), (1280, 800), (390, 844)):
        pg = open_as(br, 'NT', w, h, '#/more/help')
        bad = []
        for hs in ('', '/testimony', '/sort', '/ask', '/public', '/alerts', '/legislator', '/where', '/words'):
            go(pg, '#/more/help' + hs)
            if not pg.evaluate(SIDE): bad.append(hs or '/')
        ok(not bad, f'5 {w}: no sideways scroll on any Help page ({bad})')
        ok(not pg.errs, f'5 {w}: no page error ({pg.errs[:2]})')
        if w == 390:
            go(pg, '#/more/help'); snap(pg, 'help_390.png')
            ok(pg.evaluate(BACK) == 'Back to Home' and pg.evaluate("() => [...document.querySelectorAll('a.hp-r')].every(a => a.getBoundingClientRect().height >= 44)"), '5 390: Back to Home, rows tall enough to press')
        pg.close()
    br.close()

print(f'{sum(res)}/{len(res)} passed')
sys.exit(0 if all(res) else 1)
