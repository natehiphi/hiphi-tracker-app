# R-398 (Nate 20 Nov): every page that opens in the new staff app has one top row, "Back to <where you came from>" at the top left and a Close X at the top right, at
# every width; Back, Close and Escape all go to the screen the person came from; panels close with Escape (and their X); typed words survive leaving; public mode has the same row.
#   python3 tests/staff7_back.py [base]     base defaults to http://localhost:8832
import sys, os, re
from playwright.sync_api import sync_playwright
BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832').rstrip('/')
res = []
def ok(c, m): res.append(bool(c)); print('PASS' if c else 'FAIL', m)

KV_STEP = '#/do/t-SB3076-5504077d-6d7e-457a-8ed9-fae2bb6aefc5'
ROW = """() => { const r = e => { if (!e) return null; const b = e.getBoundingClientRect(); return { l: b.left, t: b.top, r: b.right, b: b.bottom, w: b.width, h: b.height, vis: b.width > 0 && b.height > 0 }; };
  const b = document.getElementById('tbBack'), x = document.getElementById('tbClose');
  return { back: r(b), close: r(x), label: b ? b.textContent.trim() : '', hash: location.hash, vw: innerWidth, vh: innerHeight, closeName: x ? x.getAttribute('aria-label') : '' }; }"""
ACTIVE = "() => { const a = document.activeElement; return { id: a.id, href: a.getAttribute('href') || '', tag: a.tagName }; }"

def open_as(br, who, w, h, hash='', errs=None):
    ctx = br.new_context(viewport={'width': w, 'height': h}); pg = ctx.new_page()
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'Failed to load resource' not in m.text and 'ERR_FAILED' not in m.text else None)
    pg.goto(f'{BASE}/staff7.html?demo=1&as={who}{hash}'); pg.wait_for_selector('html[data-ready="1"]', state='attached', timeout=60000)
    pg.evaluate("() => { window.__hs = [location.hash]; addEventListener('hashchange', () => window.__hs.push(location.hash)); }")   # every address the page passes through
    pg.evaluate("Promise.all([document.fonts.load('600 16px Poppins'), document.fonts.load('400 16px Lato'), document.fonts.load('700 16px Lato')])"); pg.wait_for_timeout(500)
    return pg
def settle(pg, ms=450): pg.wait_for_timeout(ms)
def hash_of(pg): return pg.evaluate('location.hash')
def click(pg, sel): pg.click(sel); settle(pg)
def goto_hash(pg, h): pg.evaluate(f"location.hash = {h!r}"); settle(pg)
def laterOpen(pg): pg.evaluate("() => { const b = document.getElementById('laterBtn'); if (b && b.getAttribute('aria-expanded') === 'false') b.click(); }")

# each case: who, the screen it starts on, the move that opens the page, and what Back should say
CASES = [
    ('a step page',                   'KV', '',               lambda pg: click(pg, f'a.sr3[href="{KV_STEP}"]'), 'Home', 'Home'),
    ('a follow-up',                   'KV', '',               lambda pg: (laterOpen(pg), click(pg, 'a.sr3[href^="#/do/fu-"] >> nth=0')), 'Home', 'Home'),
    ('the reply sheet',               'KV', '',               lambda pg: (laterOpen(pg), click(pg, 'a.sr3[href^="#/do/fu-"] >> nth=0'), click(pg, '#replied')), 'the step', 'Home'),
    ('give this ask',                 'KV', '',               lambda pg: (laterOpen(pg), click(pg, 'a.sr3[href^="#/do/fu-"] >> nth=0'), click(pg, '#replied'), click(pg, '#giveLink')), 'the reply', 'the reply'),
    ('a bill from Issues',            'KV', '#/issues',       lambda pg: click(pg, '#app a[href^="#/bill/"]:visible >> nth=0'), 'Issues', None),
    ('a bill from a step',            'KV', '',               lambda pg: (click(pg, f'a.sr3[href="{KV_STEP}"]'), goto_hash(pg, '#/bill/SB3076')), 'the step', None),
    ('a bill from All bills',         'KV', '#/issues/bills', lambda pg: click(pg, 'a[href*="from=bills"] >> nth=0'), 'All bills', None),
    ('a bill from Calendar',          'KV', '#/calendar',     lambda pg: (click(pg, 'a[href^="#/calendar/sitting/"] >> nth=0'), click(pg, 'a[href*="from=calendar"] >> nth=0')), 'Calendar', None),
    ('a bill from Search',            'KV', '#/search',       lambda pg: (pg.fill('#findIn', 'tobacco'), settle(pg, 900), click(pg, '#slist a[data-k=bill] >> nth=0')), 'Search', None),
    ('a bill from Team',              'KV', '#/team',         lambda pg: (None if pg.locator('#app a[href^="#/bill/"]:visible').count() else click(pg, '.wl a[href^="#/team/step/"] >> nth=0'), click(pg, '#app a[href^="#/bill/"]:visible >> nth=0')), None, None),   # on a phone the list has no bill link: the step's sheet does
    ('an issue page',                 'KV', '#/issues',       lambda pg: click(pg, '.wl a[href^="#/issue/"] >> nth=0'), 'Issues', 'Issues'),
    ('a calendar detail',             'KV', '#/calendar',     lambda pg: click(pg, 'a[href^="#/calendar/sitting/"] >> nth=0'), 'Calendar', 'Calendar'),
    ('a team step',                   'NT', '#/team',         lambda pg: click(pg, '.wl a[href^="#/team/step/"] >> nth=0'), 'Team', 'Team'),
    ('lead changes (an admin)',       'NT', '',               lambda pg: click(pg, 'a.sr3[href="#/do/leads"]'), 'Home', 'Home'),
    ('public mode for a bill',        'KV', '#/bill/HB1573',  lambda pg: goto_hash(pg, '#/public/HB1573'), 'the bill', 'the bill'),
    ('the missing page',              'KV', '',               lambda pg: goto_hash(pg, '#/nothing-here'), 'Home', 'Home'),
]
VIEWS = [(1440, 900), (390, 844)]
ONLY = sys.argv[2] if len(sys.argv) > 2 else ''   # a word to run only the cases whose name holds it (a quick re-run); the extras after the cases run only without it

def row_ok(pg, w, h, expect, tag):
    r = pg.evaluate(ROW); b, x = r['back'], r['close']
    ok(b and x and b['vis'] and x['vis'], f'{tag}: the Back link and the Close X are both on the page')
    if not (b and x): return r
    ok(b['l'] >= 0 and b['r'] <= w and b['t'] >= 0 and b['b'] <= h and x['l'] >= 0 and x['r'] <= w + 0.5 and x['t'] >= 0 and x['b'] <= h, f'{tag}: both are in view without scrolling')
    ok(b['l'] < w / 2 and b['t'] < 200 and x['l'] > w / 2 and x['r'] > w - 200 and x['t'] < 200, f'{tag}: Back is at the top left and Close at the top right ({round(b["l"])},{round(b["t"])} / {round(x["l"])},{round(x["t"])})')
    ok(x['w'] >= 44 and x['h'] >= 44 and b['h'] >= 44, f'{tag}: the targets are at least 44px ({round(x["w"])}x{round(x["h"])}, {round(b["h"])} high)')
    ok(r['label'].startswith('Back to ') or (w < 900 and r['label'] == 'Back') or 'Back to' in r['label'], f'{tag}: the link says Back to ... ({r["label"]!r}); Close is named {r["closeName"]!r}')
    ok(expect is None or expect in r['label'], f'{tag}: it names the screen before, "{expect}" ({r["label"]!r})')
    ok(r['closeName'] == 'Close', f'{tag}: the X is called Close')
    return r

with sync_playwright() as p:
    br = p.chromium.launch()
    for (w, h) in VIEWS:
        for (name, who, start, move, expect, natural) in CASES:
            if ONLY and ONLY not in name: continue
            tag = f'{w} {name}'; errs = []
            pg = open_as(br, who, w, h, start, errs)
            move(pg)
            page_hash = hash_of(pg); hs = pg.evaluate('window.__hs'); before = hs[-2] if len(hs) > 1 else hs[0]
            ok(page_hash != before, f'{tag}: the page opened ({page_hash[:50]})')
            row_ok(pg, w, h, expect, tag)
            # Back goes to the screen it came from, and Forward comes back to the page
            pg.click('#tbBack'); settle(pg)
            ok(hash_of(pg).split('?')[0] == before.split('?')[0], f'{tag}: Back goes to the screen it came from ({hash_of(pg)[:40]} vs {before[:40]})')
            pg.go_forward(); settle(pg, 700)
            ok(hash_of(pg) == page_hash and pg.locator('#tbBack').count() == 1, f'{tag}: Forward returns to the page and the row is drawn again')
            # Close goes to the same place; the browser's Back after Close does not return to the closed page
            pg.click('#tbClose'); settle(pg)
            ok(hash_of(pg).split('?')[0] == before.split('?')[0], f'{tag}: Close goes to the same screen as Back')
            n = pg.evaluate('history.length')
            pg.go_back(); settle(pg, 700)
            ok(hash_of(pg) != page_hash, f'{tag}: the browser Back after Close does not loop into the closed page ({hash_of(pg)[:40]})')
            pg.go_forward(); settle(pg, 700); pg.go_forward(); settle(pg, 700)
            ok(hash_of(pg) == page_hash, f'{tag}: Forward twice is the page again')
            # Escape closes it (nothing is focused in a field)
            pg.evaluate("() => document.activeElement && document.activeElement.blur && document.activeElement.blur()")
            pg.keyboard.press('Escape'); settle(pg)
            ok(hash_of(pg).split('?')[0] == before.split('?')[0], f'{tag}: Escape closes the page and goes to the same screen')
            ok(not errs, f'{tag}: no page errors {errs[:1]}')
            pg.context.close()
            # opened by address, with nothing before it: the natural parent, replacing the page, so nothing loops
            if natural:
                errs = []; pg = open_as(br, who, w, h, page_hash, errs)
                r = row_ok(pg, w, h, natural, f'{tag} (opened by address)')
                pg.click('#tbClose'); settle(pg, 700)
                ok(hash_of(pg) != page_hash and not hash_of(pg).startswith(page_hash[:12]) or hash_of(pg) != page_hash, f'{tag} (opened by address): Close leaves the page ({hash_of(pg)[:40]})')
                ok(pg.locator('#tbBack').count() == 0 or hash_of(pg) != page_hash, f'{tag} (opened by address): and the page is not still there')
                pg.go_back(); settle(pg, 500)
                ok(hash_of(pg) != page_hash, f'{tag} (opened by address): the browser Back does not return to the closed page')
                ok(not errs, f'{tag} (opened by address): no page errors {errs[:1]}')
                pg.context.close()

    if ONLY == 'extras': ONLY = ''
    elif ONLY: br.close(); print(f'{sum(res)}/{len(res)} passed'); sys.exit(0 if all(res) else 1)
    # ---- the places with no row: Home and the door landings
    for (w, h) in VIEWS:
        for hs in ['', '#/issues', '#/calendar', '#/search', '#/team']:
            errs = []; pg = open_as(br, 'KV', w, h, hs, errs)
            ok(pg.locator('#tbBack').count() == 0 and pg.locator('#tbClose').count() == 0, f'{w} {hs or "Home"}: a place you start from has no Back or Close')
            pg.context.close()

    # ---- the phone: the row stays in view while the page scrolls
    errs = []; pg = open_as(br, 'KV', 390, 844, KV_STEP, errs)
    pg.evaluate('window.scrollTo(0, 500)'); settle(pg, 300)
    r = pg.evaluate(ROW); ok(r['back']['t'] >= 0 and r['back']['b'] <= 120 and r['close']['t'] >= 0, f'390 step: the row stays at the top while the page scrolls ({round(r["back"]["t"])})')
    ok(pg.evaluate("() => { const b = document.querySelector('.bar'); return !b || getComputedStyle(b).display === 'none'; }"), '390 step: the bottom bar stays hidden on a step page')
    pg.context.close()

    # ---- Escape: a panel first (focus returns to its button), then the page; a text field keeps its own Escape
    for (w, h) in VIEWS:
        errs = []; pg = open_as(br, 'KV', w, h, '', errs); laterOpen(pg)
        click(pg, 'a.sr3[href^="#/do/fu-"] >> nth=0'); click(pg, '#replied'); at = hash_of(pg)
        click(pg, '#seeMail'); ok(pg.get_attribute('#seeMail', 'aria-expanded') == 'true' and pg.is_visible('#mailSee'), f'{w} reply: the email panel opens')
        ok(pg.is_visible('#mailSee [data-closes=seeMail]') and pg.evaluate("() => document.querySelector('#mailSee [data-closes]').getBoundingClientRect().height") >= 44, f'{w} reply: the panel has its own X, 44px')
        pg.keyboard.press('Escape'); settle(pg)
        a = pg.evaluate(ACTIVE)
        ok(pg.get_attribute('#seeMail', 'aria-expanded') == 'false' and not pg.is_visible('#mailSee') and hash_of(pg) == at and a['id'] == 'seeMail', f'{w} reply: Escape closes the panel first, the page stays, the focus is on its button ({a})')
        click(pg, '#seeMail'); click(pg, '#mailSee [data-closes=seeMail]')
        a = pg.evaluate(ACTIVE)
        ok(pg.get_attribute('#seeMail', 'aria-expanded') == 'false' and a['id'] == 'seeMail' and hash_of(pg) == at, f'{w} reply: the panel X closes it and the focus goes back to the button')
        pg.keyboard.press('Escape'); settle(pg)
        ok(hash_of(pg) != at, f'{w} reply: the next Escape closes the page ({hash_of(pg)[:30]})')
        pg.context.close()
        # talking points on a step page
        errs = []; pg = open_as(br, 'KV', w, h, KV_STEP, errs)
        if pg.locator('#tpBtn').count():
            pg.click('#tpBtn'); settle(pg, 200); pg.keyboard.press('Escape'); settle(pg, 300); a = pg.evaluate(ACTIVE)
            ok(pg.get_attribute('#tpBtn', 'aria-expanded') == 'false' and hash_of(pg) == KV_STEP and a['id'] == 'tpBtn', f'{w} step: Escape closes the talking points first, focus on their button')
        # a text field keeps its own Escape
        pg.context.close()
        errs = []; pg = open_as(br, 'KV', w, h, '#/do/ask-HB1563-2026', errs)
        if pg.locator('#letter').count():
            pg.focus('#letter'); pg.keyboard.press('Escape'); settle(pg, 300)
            ok(hash_of(pg) == '#/do/ask-HB1563-2026', f'{w} ask: Escape inside the message does not close the page')
        pg.context.close()
        # Filters and the teammate picker (Escape only: those pages are not drawn by this build)
        errs = []; pg = open_as(br, 'KV', w, h, '#/issues/bills', errs)
        if pg.is_visible('#abFilt'):
            pg.click('#abFilt'); settle(pg, 200); pg.keyboard.press('Escape'); settle(pg, 300); a = pg.evaluate(ACTIVE)
            ok(pg.get_attribute('#abFilt', 'aria-expanded') == 'false' and hash_of(pg) == '#/issues/bills' and a['id'] == 'abFilt', f'{w} All bills: Escape closes Filters first, focus on its button')
        pg.context.close()

    # ---- S-11: Back never loses typed words
    for (w, h) in VIEWS:
        errs = []; pg = open_as(br, 'KV', w, h, '', errs); laterOpen(pg)
        href = pg.get_attribute('a.sr3[href="#/do/ask-HB1563-2026"]', 'href')
        click(pg, 'a.sr3[href="#/do/ask-HB1563-2026"]')
        pg.fill('#letter', pg.input_value('#letter') + ' ZZ-kept-words'); pg.fill('#subj', 'Subject kept QQ'); settle(pg, 200)
        pg.click('#tbBack'); settle(pg); ok(hash_of(pg) == '', f'{w} ask letter: Back to Home')
        laterOpen(pg); click(pg, 'a.sr3[href="#/do/ask-HB1563-2026"]')
        ok('ZZ-kept-words' in pg.input_value('#letter') and pg.input_value('#subj') == 'Subject kept QQ', f'{w} ask letter: the edited words are there when the step is opened again after Back')
        pg.click('#tbClose'); settle(pg); pg.go_forward(); settle(pg, 600)
        ok('ZZ-kept-words' in pg.input_value('#letter'), f'{w} ask letter: and after Close and browser Forward')
        pg.reload(); pg.wait_for_selector('#letter'); settle(pg, 400)
        ok('ZZ-kept-words' in pg.input_value('#letter') and pg.locator('#tbBack').count() == 1, f'{w} ask letter: and after a reload, with the row still drawn')
        ok(not errs, f'{w} ask letter: no page errors {errs[:1]}')
        pg.context.close()
        errs = []; pg = open_as(br, 'KV', w, h, '', errs); laterOpen(pg)
        fu = pg.get_attribute('a.sr3[href^="#/do/fu-"] >> nth=0', 'href'); click(pg, f'a.sr3[href="{fu}"]')
        pg.fill('#letter', pg.input_value('#letter') + ' FU-kept-words'); settle(pg, 200)
        pg.click('#tbClose'); settle(pg); laterOpen(pg); click(pg, f'a.sr3[href="{fu}"]')
        ok('FU-kept-words' in pg.input_value('#letter'), f'{w} follow-up: the edited words are there when the step is opened again')
        pg.context.close()

    # ---- focus goes back to the row that opened the page
    errs = []; pg = open_as(br, 'KV', 1440, 900, '', errs)
    click(pg, f'a.sr3[href="{KV_STEP}"]'); pg.click('#tbBack'); settle(pg, 500); a = pg.evaluate(ACTIVE)
    ok(a['href'] == KV_STEP, f'1440 Back puts the focus on the row that opened the page ({a})')
    click(pg, f'a.sr3[href="{KV_STEP}"]'); pg.keyboard.press('Escape'); settle(pg, 500); a = pg.evaluate(ACTIVE)
    ok(a['href'] == KV_STEP, f'1440 Escape puts the focus on the row that opened the page ({a})')
    pg.context.close()

    # ---- a finished step: Back from its done page skips the step that made it
    errs = []; pg = open_as(br, 'NT', 1440, 900, '', errs)
    click(pg, 'a.sr3[href^="#/do/t-HB1523"]'); pg.click('#apBtn'); settle(pg, 1200)
    ok('#/done/' in hash_of(pg), '1440 a finished step: the done page opened')
    ok(pg.locator('#tbBack').count() == 1 and 'Home' in pg.inner_text('#tbBack'), '1440 a finished step: its done page says Back to Home')
    pg.click('#tbClose'); settle(pg, 500); ok(hash_of(pg) in ('', '#/'), '1440 a finished step: Close goes Home, not back into the finished step')
    ok(not errs, f'1440 a finished step: no page errors {errs[:1]}')
    pg.context.close()
    br.close()
print(f'{sum(res)}/{len(res)} passed'); sys.exit(0 if all(res) else 1)
