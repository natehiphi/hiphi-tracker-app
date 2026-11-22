# Staff7 Legislators (R-398 piece 12, part 1), on the practice copy: More's six items, the left list and the Directory, finding, a row opening a legislator, the phone's list then page.
#   python3 tests/staff7_leg.py [base] [shots folder]     base defaults to http://127.0.0.1:8874
import sys, os, re
from playwright.sync_api import sync_playwright
BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8874').rstrip('/')
SHOTS = sys.argv[2] if len(sys.argv) > 2 else ''
if SHOTS: os.makedirs(SHOTS, exist_ok=True)
res = []
def ok(c, m): res.append(bool(c)); print('PASS' if c else 'FAIL', m)
SIDE = "() => document.documentElement.scrollWidth <= innerWidth && document.body.scrollWidth <= innerWidth"
VIS = "(sel) => [...document.querySelectorAll(sel)].filter(e => e.getBoundingClientRect().width > 0)"
def open_as(br, w, h, hash):
    ctx = br.new_context(viewport={'width': w, 'height': h}); pg = ctx.new_page(); pg.errs = []
    pg.on('pageerror', lambda e: pg.errs.append(str(e)))
    pg.on('console', lambda m: pg.errs.append(m.text) if m.type == 'error' and 'Failed to load resource' not in m.text and 'ERR_FAILED' not in m.text else None)
    pg.goto(f'{BASE}/staff7.html?demo=1&as=KV{hash}'); pg.wait_for_selector('.paper', state='attached', timeout=60000)
    pg.evaluate("Promise.all([document.fonts.load('600 16px Poppins'), document.fonts.load('400 16px Lato')])"); pg.wait_for_timeout(500)
    return pg
def snap(pg, name):
    pg.wait_for_timeout(300)
    if SHOTS: pg.screenshot(path=os.path.join(SHOTS, name))
def names(pg): return pg.eval_on_selector_all('#legList .lgr b', 'els => els.map(e => e.textContent.trim())')
def typ(pg, t):
    pg.fill('#legIn', t); pg.wait_for_timeout(250)
def clear(pg): pg.fill('#legIn', ''); pg.wait_for_timeout(200)
GROUPS = "() => [...document.querySelectorAll('#legList .lggh')].map(h => h.innerText.replace(/\\s+/g, ' ').trim())"

with sync_playwright() as p:
    br = p.chromium.launch()
    # ============ 1. More's items ============
    pg = open_as(br, 1440, 900, '#/')
    pg.click('#moreBtn'); pg.wait_for_timeout(250)
    items = pg.eval_on_selector_all('#moreLayer a.mmi', "els => els.map(a => [a.querySelector('b').textContent.trim(), a.getAttribute('href')])")
    ok(items == [['Team', '#/team'], ['Public words', '#/public'], ['Legislators', '#/more/legislators'], ['Committees', '#/more/committees'], ['Help', '#/more/help'], ['My alerts', '#/me/alerts']], f'1 six items in order ({items})')
    pg.click('#moreLayer a[href="#/more/legislators"]'); pg.wait_for_timeout(600)

    # ============ 2. laptop: list and Directory ============
    ok(pg.evaluate('location.hash') == '#/more/legislators', '2 opens #/more/legislators')
    ok(pg.is_visible('#legList') and pg.is_visible('#legIn') and pg.evaluate("document.querySelector('#ihd').textContent") == 'Legislators', '2 the list column has the title and the box')
    ok(pg.get_attribute('#legIn', 'placeholder') == 'Find a legislator', '2 box says Find a legislator')
    ok(pg.get_attribute('#lgDirRow', 'aria-current') == 'true' and 'All 77' in pg.inner_text('#lgDirRow'), f'2 Directory row selected, "All 77": {pg.inner_text("#lgDirRow").strip()!r}')
    ok(pg.evaluate("document.querySelector('main h1, #app h1').textContent.trim()") == 'Legislators' and 'Every member of the House and Senate, and how to reach them.' in pg.inner_text('#app'), '2 Directory title and line')
    g = pg.evaluate(GROUPS)
    cnt = [int(re.search(r'· (\d+)', x).group(1)) for x in g]
    ok([re.sub(r' · .*', '', x) for x in g] == ['Yours', 'House', 'Senate'] and sum(cnt) == 77 and 1 <= cnt[0] <= 6, f'2 groups and counts add to 77 ({g})')
    ok(len(names(pg)) == 77, f'2 77 rows ({len(names(pg))})')
    row = pg.evaluate("() => { const r = document.querySelector('#legList .lgr'); return { sub: r.querySelector('.lgs').textContent, w: r.querySelector('img') && r.querySelector('img').width, h: r.getBoundingClientRect().height }; }")
    ok(row['sub'].startswith('District ') and row['w'] == 32 and row['h'] >= 44, f'2 row: photo 32, District line, tall enough ({row})')
    ok(pg.evaluate(VIS + "('#tbBack, #tbClose')").__len__() == 0 if False else pg.evaluate("() => [...document.querySelectorAll('#tbBack, #tbClose')].filter(e => e.getBoundingClientRect().width > 0).length") == 0, '2 no Back or X at laptop width')
    ok(pg.locator('tr.lgd-row').count() == 77 and pg.locator('.lgd-sec').count() == 2, f'2 chamber view: 77 rows, two sections ({pg.locator("tr.lgd-row").count()})')
    secs = pg.eval_on_selector_all('.lgd-sec h2', 'els => els.map(e => e.innerText.replace(/\\s+/g, " ").trim())')
    ok(secs[0].startswith('Senate') and secs[1].startswith('House'), f'2 Senate first, then House ({secs})')
    heads = pg.eval_on_selector_all('.lgd-tab thead th', 'els => els.map(e => e.textContent.trim())')
    ok(heads == ['District', 'Name', 'Towns', 'Seats', 'Phone', 'Yours · team', 'Our contact'], f'2 columns ({heads})')
    ok(pg.evaluate("() => { const a = [...document.querySelectorAll('.lgd-ph a:not(.lgd-em)')]; return a.length > 30 && a.every(x => x.getAttribute('href').startsWith('tel:')) }"), '2 every phone number is a tel link')
    ok(pg.evaluate("() => getComputedStyle(document.querySelector('.lgd-tab thead th')).position") == 'sticky', '2 column headings are sticky')
    ok('None' not in pg.inner_text('#lgdBody'), '2 no "None" anywhere in the Directory')
    ok(pg.evaluate("() => [...document.querySelectorAll('tr.lgd-row')].every(r => r.querySelector('.lgd-ph a[href^=\"tel:\"]') || /Office line not listed/.test(r.querySelector('.lgd-ph').textContent))"), '2 every row has a call link or "Office line not listed"')
    ok(pg.evaluate("() => [...document.querySelectorAll('.lgd-ph')].every(c => c.textContent.trim().length > 0 && !/^Phone:?$/.test(c.textContent.trim()))"), '2 no blank or bare-label phone cell')
    ok(pg.evaluate("() => [...document.querySelectorAll('.lgd-b')].every(c => /^\\d+ · \\d+/.test(c.textContent.trim()))"), '2 bills read "yours · team" with both numbers')
    ok(pg.evaluate("() => [...document.querySelectorAll('.lgd-a')].every(a => getComputedStyle(a).textDecorationLine === 'none')"), '2 names are not underlined')
    ok(pg.evaluate("() => [...document.querySelectorAll('.lgd-s, .lgd-c')].every(c => c.textContent.trim() !== 'None')") and pg.locator('.lgd-mut[aria-label]').count() > 0, '2 empty seats and contacts show a dash with a label')
    snap(pg, 'dir_1440.png')
    # Directory views
    pg.click('[data-dview="committee"]'); pg.wait_for_timeout(300)
    ok(pg.locator('.lgd-sec').count() > 20 and pg.locator('.lgd-s', has_text='Chair').count() > 20, f'2 By committee: sections with chairs ({pg.locator(".lgd-sec").count()})')
    first = pg.eval_on_selector('.lgd-tab tbody tr.lgd-row .lgd-s', 'e => e.textContent.trim()')
    ok(first == 'Chair', f'2 By committee: chair first ({first})')
    snap(pg, 'dir_committee.png')
    pg.click('[data-dview="az"]'); pg.wait_for_timeout(300)
    az = pg.eval_on_selector_all('.lgd-sec h2', 'els => els.map(e => e.textContent.trim()[0])')
    ok(len(az) > 10 and az == sorted(az) and pg.locator('tr.lgd-row').count() == 77, f'2 A to Z: letters in order, 77 rows ({"".join(az)})')
    pg.click('[data-dview="chamber"]'); pg.wait_for_timeout(200)

    # ============ 3. finding ============
    typ(pg, 'takayama'); n = names(pg)
    ok(len(n) >= 1 and all('Takayama' in x for x in n) and pg.locator('tr.lgd-row').count() == len(n), f'3 name "takayama" ({n}); the Directory narrows too ({pg.locator("tr.lgd-row").count()})')
    typ(pg, '34'); n = names(pg); d = pg.eval_on_selector_all('#legList .lgs', 'els => els.map(e => e.textContent)')
    ok(len(n) == 1 and all('District 34' in x for x in d), f'3 district "34" ({n})')
    typ(pg, 'kailua'); n = names(pg)
    ok(len(n) >= 1 and all('ailua' in x for x in pg.eval_on_selector_all('#legList .lgs', 'els => els.map(e => e.textContent)')), f'3 town "kailua" ({len(n)}) names the town')
    snap(pg, 'find_town.png')
    typ(pg, 'health'); n = names(pg); sub = pg.eval_on_selector_all('#legList .lgs', 'els => els.map(e => e.textContent)')
    ok(len(n) >= 2 and all('ealth' in x for x in sub), f'3 committee "health" ({len(n)}) says the seat ({sub[:2]})')
    typ(pg, 'chair'); n = names(pg); sub = pg.eval_on_selector_all('#legList .lgs', 'els => els.map(e => e.textContent)')
    ok(len(n) > 20 and all('hair' in x for x in sub), f'3 "chair" lists chairs ({len(n)})')
    typ(pg, 'zzzz'); ok('No legislator matches' in pg.inner_text('#legList') and pg.locator('tr.lgd-row').count() == 0, '3 nothing found says so')
    clear(pg); ok(len(names(pg)) == 77 and pg.locator('tr.lgd-row').count() == 77, '3 clearing brings everyone back')

    # ============ 4. a row opens a legislator ============
    pg.locator('#legList .lgr').nth(10).click(); pg.wait_for_timeout(600)
    h = pg.evaluate('location.hash'); lid = h.split('/')[-1]
    ok(re.match(r'#/more/legislators/\d+$', h) is not None, f'4 row opens its page ({h})')
    sel = pg.eval_on_selector_all('#legList .lgr.sel', 'els => els.map(e => e.dataset.id)')
    ok(sel == [lid] and pg.get_attribute('#lgDirRow', 'aria-current') is None, f'4 that row is selected, Directory is not ({sel})')
    nm = pg.eval_on_selector('#legList .lgr.sel b', 'e => e.textContent.trim()')
    ok(pg.evaluate("document.querySelector('.paper h1').textContent.trim()") == nm and pg.locator('.lgstrip .bsub').count() == 1, f'4 the page strip names them ({nm})')
    pg.click('#lgDirRow'); pg.wait_for_timeout(500)
    ok(pg.evaluate('location.hash') == '#/more/legislators' and pg.locator('tr.lgd-row').count() == 77, '4 the Directory row goes back')
    pg.locator('tr.lgd-row').nth(5).click(); pg.wait_for_timeout(500)
    ok(re.match(r'#/more/legislators/\d+$', pg.evaluate('location.hash')) is not None, '4 a whole Directory row opens the legislator')
    ok(pg.evaluate(SIDE), '4 no sideways scroll'); ok(not pg.errs, f'4 no page error ({pg.errs[:2]})'); pg.close()

    # ============ 5. widths ============
    for w, h in ((1440, 900), (1280, 800), (390, 844)):
        for hash in ('#/more/legislators', '#/more/legislators/' + lid):
            pg = open_as(br, w, h, hash)
            ok(pg.evaluate(SIDE) and not pg.errs, f'5 {w}: {hash.split("/")[-1][:12]} no sideways scroll, no error ({pg.errs[:1]})'); pg.close()

    # ============ 6. phone ============
    pg = open_as(br, 390, 844, '#/more/legislators')
    ok(pg.is_visible('#legList') and pg.locator('tr.lgd-row').evaluate_all('e => e.filter(r => r.getBoundingClientRect().width > 0).length') == 0, '6 phone: the list is the page, the Directory is not under it')
    snap(pg, 'phone_list.png')
    pg.locator('#legList .lgr').nth(3).click(); pg.wait_for_timeout(600)
    bk = pg.evaluate("() => { const b = document.getElementById('tbBack'); return b && b.getBoundingClientRect().width > 0 ? b.textContent.trim() : '' }")
    ok(bk == 'Back to Legislators' and pg.is_visible('.lgstrip') and not pg.is_visible('#legList'), f'6 phone: the page shows with "{bk}"')
    snap(pg, 'phone_page.png')
    pg.click('#tbBack'); pg.wait_for_timeout(500)
    ok(pg.evaluate('location.hash') == '#/more/legislators' and pg.is_visible('#legList'), '6 phone: Back to the list')
    pg.click('#lgDirRow'); pg.wait_for_timeout(500)
    ok(pg.evaluate('location.hash') == '#/more/legislators/directory' and pg.locator('.lgd-row').first.is_visible() and pg.evaluate(SIDE), '6 phone: Directory as cards, no sideways scroll')
    ok(pg.evaluate("""() => { const r = [...document.querySelectorAll('tr.lgd-row')].find(e => e.getBoundingClientRect().width > 0); const kids = [...r.children].filter(c => getComputedStyle(c).display !== 'none'); const q = k => r.querySelector(k).getBoundingClientRect(); const bb = q('.lgd-b'), ph = q('.lgd-ph'); const same = Math.abs(q('.lgd-d').top - q('.lgd-n').top) < 3 && bb.top < ph.bottom && bb.bottom > ph.top; const tops = new Set([q('.lgd-d').top, q('.lgd-s').top, ph.top].map(Math.round)); return kids.length === 5 && same && tops.size === 3 && !/(District|Seats|Phone|Our bills|Towns):\\s/.test(r.innerText) }"""), '6 phone: each card is three lines, no "Label:" lines')
    snap(pg, 'phone_dir.png'); ok(not pg.errs, f'6 no page error ({pg.errs[:2]})'); pg.close()
    br.close()
print(f'{sum(res)}/{len(res)} passed'); sys.exit(0 if all(res) else 1)
