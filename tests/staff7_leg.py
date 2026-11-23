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
def open_as(br, w, h, hash, who='KV'):
    ctx = br.new_context(viewport={'width': w, 'height': h}); pg = ctx.new_page(); pg.errs = []
    pg.on('pageerror', lambda e: pg.errs.append(str(e)))
    pg.on('console', lambda m: pg.errs.append(m.text) if m.type == 'error' and 'Failed to load resource' not in m.text and 'ERR_FAILED' not in m.text else None)
    pg.goto(f'{BASE}/staff7.html?demo=1&as={who}{hash}'); pg.wait_for_selector('.paper', state='attached', timeout=60000)
    pg.evaluate("Promise.all([document.fonts.load('600 16px Poppins'), document.fonts.load('400 16px Lato')])"); pg.wait_for_timeout(500)
    return pg
def snap(pg, name):
    pg.wait_for_timeout(300)
    if SHOTS: pg.screenshot(path=os.path.join(SHOTS, name))
def names(pg): return pg.eval_on_selector_all('#legList .lgr b', 'els => els.map(e => e.textContent.trim())')
def typ(pg, t):
    pg.fill('#legIn', t); pg.wait_for_timeout(250)
def clear(pg): pg.fill('#legIn', ''); pg.wait_for_timeout(200)
# R-398: every card foot lists the phone then Email (both when the data has both); in a foot the two links are on one line and never touch
FOOTS = """() => { const bad = []; let both = 0, n = 0;
  document.querySelectorAll('.lgd-card').forEach(c => { if (!c.getBoundingClientRect().width) return; n++; const a = [...c.querySelectorAll('.lgd-ft .lgd-reach')].map(e => e.getBoundingClientRect());
    if (a.length === 2) { both++; if (Math.abs(a[0].top - a[1].top) > 2 || a[1].left - a[0].right < 12) bad.push(c.dataset.id); } if (a.some(r => r.height < 43.5)) bad.push('h' + c.dataset.id); });
  return { n, both, bad }; }"""
# the block's people: the links sit under the sentence, on one line, 16px apart or more
BLOCKS = """() => [...document.querySelectorAll('.lgd-bc')].every(c => { const s = c.querySelector('.lgd-bs').getBoundingClientRect(), a = [...c.querySelectorAll('.lgd-reach')].map(e => e.getBoundingClientRect());
  return a.length >= 1 && a.every(r => r.top >= s.bottom - 1 && r.height >= 43.5) && (a.length < 2 || (Math.abs(a[0].top - a[1].top) < 2 && a[1].left - a[0].right >= 15)); })"""
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
    ok(pg.evaluate("document.querySelector('main h1, #app h1').textContent.trim()") == 'Legislators' and pg.inner_text('.lgdir .bsub').strip() == 'Everyone in the Senate and House, and the quickest way to reach each one.', '2 Directory intro line, exact words')
    g = pg.evaluate(GROUPS)
    cnt = [int(re.search(r'· (\d+)', x).group(1)) for x in g]
    ok([re.sub(r' · .*', '', x) for x in g] == ['Yours', 'House', 'Senate'] and sum(cnt) == 77 and 1 <= cnt[0] <= 6, f'2 groups and counts add to 77 ({g})')
    ok(len(names(pg)) == 77, f'2 77 rows ({len(names(pg))})')
    row = pg.evaluate("() => { const r = document.querySelector('#legList .lgr'); return { sub: r.querySelector('.lgs').textContent, w: r.querySelector('img') && r.querySelector('img').width, h: r.getBoundingClientRect().height }; }")
    ok(row['sub'].startswith('District ') and row['w'] == 32 and row['h'] >= 44, f'2 row: photo 32, District line, tall enough ({row})')
    ok(pg.evaluate(VIS + "('#tbBack, #tbClose')").__len__() == 0 if False else pg.evaluate("() => [...document.querySelectorAll('#tbBack, #tbClose')].filter(e => e.getBoundingClientRect().width > 0).length") == 0, '2 no Back or X at laptop width')
    ok(pg.locator('.lgd-card').count() == 77 and pg.locator('.lgd-sec').count() == 2, f'2 chamber view: 77 cards, two sections ({pg.locator(".lgd-card").count()})')
    secs = pg.eval_on_selector_all('.lgd-sec h2', 'els => els.map(e => e.innerText.replace(/\\s+/g, " ").trim())')
    ok(secs[0].startswith('Senate') and secs[1].startswith('House'), f'2 Senate first, then House ({secs})')
    segs = pg.eval_on_selector_all('[data-dview]', 'els => els.map(e => e.textContent.trim())')
    ok(segs == ['By chamber', 'By island', 'By committee', 'A to Z'], f'2 the four segments ({segs})')
    ok('77 members' in pg.inner_text('#lgdCount'), '2 the count says 77 members')
    f = pg.evaluate(FOOTS)
    ok(pg.locator('.lgd-card .lgd-reach[href^="tel:"]').count() >= 70 and f['both'] >= 70 and f['n'] == 77, f"2 at least 70 of 77 cards list both a tel: and a mailto: link ({f['both']} of {f['n']})")
    ok(f['bad'] == [], f"2 1440: in each foot the phone and Email are on one line, at least 12px apart, 44px tall ({f['bad'][:3]})")
    ok(pg.evaluate("() => [...document.querySelectorAll('.lgd-card')].every(c => { const t = c.querySelector('.lgd-ft .lgd-reach[href^=\"tel:\"]'), m = c.querySelector('.lgd-ft .lgd-reach[href^=\"mailto:\"]'); const has = x => !!x; return has(t) === /\\d/.test(t ? t.textContent : '') && (!t || /^808-\\d{3}-\\d{4}$/.test(t.textContent.trim())) && (!m || m.textContent.trim() === 'Email') && !/Call/.test(c.querySelector('.lgd-ft').textContent) })"), '2 the number shows, Email says Email, the word Call is not written')
    ok(pg.evaluate("() => [...document.querySelectorAll('.lgd-ft .lgd-reach')].every(a => a.querySelector('svg.ic') && /^(Call .+ at 808|Email )/.test(a.getAttribute('aria-label')))"), '2 each link has its icon and its aria-label')
    txt = pg.inner_text('#lgdBody')
    ok('None' not in txt and 'Office line not listed' not in txt and not re.search(r'(^|\n)\s*[\u2013\u2014-]\s*($|\n)', txt), '2 no "None", "Office line not listed" or lone dash in the Directory')
    ok(pg.evaluate("() => [...document.querySelectorAll('.lgd-card')].every(c => { const L = [...c.querySelectorAll('.lgd-reach')]; return L.every(a => /^(tel:|mailto:)/.test(a.getAttribute('href'))) && (L.length > 0 || !c.querySelector('.lgd-ft').textContent.trim()) })"), '2 every card has a phone link and/or an Email link, or (neither) nothing')
    ok(pg.evaluate("() => [...document.querySelectorAll('.lgd-n a, .lgd-bn a, .lgd-reach')].every(a => getComputedStyle(a).textDecorationLine === 'none')"), '2 names, Call and Email are not underlined')
    ok(pg.evaluate("() => [...document.querySelectorAll('.lgd-n a')].every(a => /^#\\/more\\/legislators\\/\\d+$/.test(a.getAttribute('href')))"), '2 every card name links to the person')
    ok(pg.evaluate("() => [...document.querySelectorAll('.lgd-d')].every(d => !d.textContent.includes('\u2026') && !/\\.\\.\\./.test(d.textContent))"), '2 no ellipsis in the district line')
    ok(pg.evaluate("() => [...document.querySelectorAll('.lgd-reach, .lgd-sw .seg')].every(e => e.getBoundingClientRect().height >= 43.5)"), '2 Call, Email and segments are at least 44px tall')
    ok(pg.evaluate("() => !document.querySelector('.lgdir .btn.filled, .lgdir button.filled')"), '2 no filled button on the page')
    ok(pg.evaluate("() => { const t = getComputedStyle(document.querySelector('.lgd-grid')).gridTemplateColumns.split(' ').length; const rows = {}; document.querySelectorAll('#lgd-ch-S .lgd-card').forEach(c => { const r = c.getBoundingClientRect(); (rows[Math.round(r.top)] ||= []).push(r.height) }); return t === 4 && Object.values(rows).every(h => h.every(x => Math.abs(x - h[0]) < 1.5)) }"), '2 four across at 1440, cards in a row share a height')
    ok(not pg.is_visible('#lgdIn'), '2 the phone find box is not at laptop width')
    snap(pg, 'dir_1440.png')
    # Directory views
    pg.click('[data-dview="island"]'); pg.wait_for_timeout(300)
    isl = pg.eval_on_selector_all('.lgd-sec h2', 'els => els.map(e => e.innerText.replace(/\\s+/g, " ").trim())')
    cnt = [int(re.search(r'· (\d+)', x).group(1)) for x in isl]
    ok([re.sub(r' · .*', '', x) for x in isl] == ['O\u02bbahu', 'Hawai\u02bbi Island', 'Maui, Moloka\u02bbi and L\u0101na\u02bbi', 'Kaua\u02bbi and Ni\u02bbihau'] and sum(cnt) == 77 and pg.locator('.lgd-card').count() == 77, f'2 By island: four sections, Oahu first, add up to 77 ({isl})')
    ok(all(re.match(r'(Senate|House) District \d+', x) for x in pg.eval_on_selector_all('.lgd-d', 'els => els.map(e => e.textContent)')), '2 By island: the district line names the chamber')
    snap(pg, 'dir_island.png')
    pg.click('[data-dview="committee"]'); pg.wait_for_timeout(300)
    ok(pg.locator('.lgd-sec').count() > 20 and pg.locator('.lgd-s', has_text='Chair').count() > 20, f'2 By committee: sections with chairs ({pg.locator(".lgd-sec").count()})')
    first = pg.eval_on_selector('.lgd-card .lgd-s', 'e => e.textContent.trim()')
    ok(first == 'Chair', f'2 By committee: chair first ({first})')
    snap(pg, 'dir_committee.png')
    pg.click('[data-dview="az"]'); pg.wait_for_timeout(300)
    az = pg.eval_on_selector_all('.lgd-sec h2', 'els => els.map(e => e.textContent.trim()[0])')
    ok(len(az) > 10 and az == sorted(az) and pg.locator('.lgd-card').count() == 77, f'2 A to Z: letters in order, 77 cards ({"".join(az)})')
    pg.click('[data-dview="chamber"]'); pg.wait_for_timeout(200)

    # the block on top (Kris has six on the practice copy)
    kr = open_as(br, 1440, 900, '#/more/legislators', 'KR')
    ok(kr.locator('.lgd-bc').count() == 6 and kr.inner_text('#lgdY') == 'Who your bills are with now', f'2 block: six people under "Who your bills are with now" ({kr.locator(".lgd-bc").count()})')
    ok(kr.evaluate("() => [...document.querySelectorAll('.lgd-bc')].every(c => /^Chairs (House|Senate) .+, where \\d+ of your bills? (is|are) now\\.$/.test(c.querySelector('.lgd-bs').textContent))"), '2 block: each person has the chair sentence')
    ok(kr.evaluate("() => [...document.querySelectorAll('.lgd-bc')].every(c => getComputedStyle(c).borderTopWidth === '0px' && getComputedStyle(c).backgroundColor === 'rgba(0, 0, 0, 0)')") and kr.evaluate("() => getComputedStyle(document.querySelector('.lgd-bcs')).gridTemplateColumns.split(' ').length") == 3, '2 block: three across, no card borders or backgrounds')
    ok(kr.evaluate(BLOCKS), '2 block: the six each show their links under the sentence, on one line')
    kr.fill('#legIn', 'takayama'); kr.wait_for_timeout(300)
    ok(kr.locator('.lgd-bc').count() == 0 and kr.locator('#lgdY').count() == 0, '2 block: gone while the find box holds words')
    kr.fill('#legIn', ''); kr.wait_for_timeout(300)
    ok(kr.locator('.lgd-bc').count() == 6, '2 block: back when the find box is clear'); kr.close()
    kr = open_as(br, 1280, 800, '#/more/legislators', 'KR')
    ok(kr.evaluate("() => getComputedStyle(document.querySelector('.lgd-grid')).gridTemplateColumns.split(' ').length") == 3 and kr.evaluate("() => getComputedStyle(document.querySelector('.lgd-bcs')).gridTemplateColumns.split(' ').length") == 3, '2 1280: three across in the block and the grid'); kr.close()

    # KV: the sentences read right, and the tray is inside the first screen at 1280x800
    kv = open_as(br, 1280, 800, '#/more/legislators', 'KV')
    bs = kv.eval_on_selector_all('.lgd-bs', 'els => els.map(e => e.textContent)')
    ok(bs and not any('of your bill is' in x for x in bs) and all(re.search(r'of your bills? (is|are) now', x) is None or re.search(r'of your bills (is|are) now\.$', x) for x in bs), f'2 KV block sentences use "bills" ({bs[:3]})')
    ok(any('1 of your bills is now' in x for x in bs) or not any(re.search(r'where 1 of', x) for x in bs), '2 a count of 1 reads "1 of your bills is now"')
    ok(kv.evaluate("() => document.querySelector('.lgd-sw').getBoundingClientRect().top < 800 && document.querySelector('.lgd-h').getBoundingClientRect().top < 800"), '2 1280x800: the tray and the first heading are in the first screen')
    kv.fill('#legIn', 'pearl city'); kv.wait_for_timeout(300)
    cards = kv.eval_on_selector_all('.lgd-card', 'els => els.map(e => e.textContent)')
    ok(len(cards) >= 1 and all('Pearl City' in x for x in cards), f'2 "Pearl City" shows the town on every card ({len(cards)})')
    kv.fill('#legIn', 'zzzz'); kv.wait_for_timeout(300)
    ok('No one matches. Try a name, a district number, a town or a committee.' in kv.inner_text('#lgdBody') and kv.evaluate("document.activeElement.id") == 'legIn', '2 "zzzz": the Directory says no one matches, focus stays in the box')
    kv.close()

    # ============ 3. finding ============
    typ(pg, 'takayama'); n = names(pg)
    ok(len(n) >= 1 and all('Takayama' in x for x in n) and pg.locator('.lgd-card').count() == len(n), f'3 name "takayama" ({n}); the Directory narrows too ({pg.locator("tr.lgd-row").count()})')
    typ(pg, '34'); n = names(pg); d = pg.eval_on_selector_all('#legList .lgs', 'els => els.map(e => e.textContent)')
    ok(len(n) == 1 and all('District 34' in x for x in d), f'3 district "34" ({n})')
    typ(pg, 'kailua'); n = names(pg)
    ok(len(n) >= 1 and all('ailua' in x for x in pg.eval_on_selector_all('#legList .lgs', 'els => els.map(e => e.textContent)')), f'3 town "kailua" ({len(n)}) names the town')
    snap(pg, 'find_town.png')
    typ(pg, 'health'); n = names(pg); sub = pg.eval_on_selector_all('#legList .lgs', 'els => els.map(e => e.textContent)')
    ok(len(n) >= 2 and all('ealth' in x for x in sub), f'3 committee "health" ({len(n)}) says the seat ({sub[:2]})')
    typ(pg, 'chair'); n = names(pg); sub = pg.eval_on_selector_all('#legList .lgs', 'els => els.map(e => e.textContent)')
    ok(len(n) > 20 and all('hair' in x for x in sub), f'3 "chair" lists chairs ({len(n)})')
    typ(pg, 'zzzz'); ok('No legislator matches' in pg.inner_text('#legList') and pg.locator('.lgd-card').count() == 0, '3 nothing found says so')
    clear(pg); ok(len(names(pg)) == 77 and pg.locator('.lgd-card').count() == 77, '3 clearing brings everyone back')

    # ============ 4. a row opens a legislator ============
    pg.locator('#legList .lgr').nth(10).click(); pg.wait_for_timeout(600)
    h = pg.evaluate('location.hash'); lid = h.split('/')[-1]
    ok(re.match(r'#/more/legislators/\d+$', h) is not None, f'4 row opens its page ({h})')
    sel = pg.eval_on_selector_all('#legList .lgr.sel', 'els => els.map(e => e.dataset.id)')
    ok(sel == [lid] and pg.get_attribute('#lgDirRow', 'aria-current') is None, f'4 that row is selected, Directory is not ({sel})')
    nm = pg.eval_on_selector('#legList .lgr.sel b', 'e => e.textContent.trim()')
    ok(pg.evaluate("document.querySelector('.paper h1').textContent.trim()") == nm and pg.locator('.lgstrip .bsub').count() == 1, f'4 the page strip names them ({nm})')
    pg.click('#lgDirRow'); pg.wait_for_timeout(500)
    ok(pg.evaluate('location.hash') == '#/more/legislators' and pg.locator('.lgd-card').count() == 77, '4 the Directory row goes back')
    pg.locator('.lgd-card .lgd-d').nth(5).dispatch_event('click'); pg.wait_for_timeout(500)
    ok(re.match(r'#/more/legislators/\d+$', pg.evaluate('location.hash')) is not None, '4 a whole Directory row opens the legislator')
    ok(pg.evaluate(SIDE), '4 no sideways scroll'); ok(not pg.errs, f'4 no page error ({pg.errs[:2]})'); pg.close()

    # ============ 5. widths ============
    for w, h in ((1440, 900), (1280, 800), (390, 844)):
        for hash in ('#/more/legislators', '#/more/legislators/' + lid):
            pg = open_as(br, w, h, hash)
            ok(pg.evaluate(SIDE) and not pg.errs, f'5 {w}: {hash.split("/")[-1][:12]} no sideways scroll, no error ({pg.errs[:1]})')
            if w > 900 and hash == '#/more/legislators':
                f = pg.evaluate(FOOTS); ok(f['bad'] == [] and f['both'] >= 70, f"5 {w}: foot links on one line, apart, 44px tall ({f['both']} with both, bad {f['bad'][:3]})")
            pg.close()

    # ============ 6. phone ============
    pg = open_as(br, 390, 844, '#/more/legislators')
    ok(pg.is_visible('#legList') and pg.locator('.lgd-card').evaluate_all('e => e.filter(r => r.getBoundingClientRect().width > 0).length') == 0, '6 phone: the list is the page, the Directory is not under it')
    snap(pg, 'phone_list.png')
    pg.locator('#legList .lgr').nth(3).click(); pg.wait_for_timeout(600)
    bk = pg.evaluate("() => { const b = document.getElementById('tbBack'); return b && b.getBoundingClientRect().width > 0 ? b.textContent.trim() : '' }")
    ok(bk == 'Back to Legislators' and pg.is_visible('.lgstrip') and not pg.is_visible('#legList'), f'6 phone: the page shows with "{bk}"')
    snap(pg, 'phone_page.png')
    pg.click('#tbBack'); pg.wait_for_timeout(500)
    ok(pg.evaluate('location.hash') == '#/more/legislators' and pg.is_visible('#legList'), '6 phone: Back to the list')
    pg.click('#lgDirRow'); pg.wait_for_timeout(500)
    ok(pg.evaluate('location.hash') == '#/more/legislators/directory' and pg.locator('.lgd-card').first.is_visible() and pg.evaluate(SIDE), '6 phone: Directory as cards, no sideways scroll')
    ok(pg.is_visible('#lgdIn') and pg.get_attribute('#lgdIn', 'placeholder') == 'Find by name, district or town', '6 phone: the find box is above the block')
    ok(pg.evaluate("() => { const c = document.querySelector('.lgd-card'), r = c.querySelector('.lgd-cph').getBoundingClientRect(), t = c.querySelector('.lgd-tx').getBoundingClientRect(); return r.width === 72 && r.right <= t.left && Math.abs(r.top - t.top) < 20 }"), '6 phone: one across, photo at the left')
    f = pg.evaluate(FOOTS)
    ok(f['bad'] == [] and f['both'] >= 70 and pg.evaluate(SIDE), f"6 phone 390: foot links on one line, apart, 44px tall, no sideways scroll ({f['both']} with both, bad {f['bad'][:3]})")
    ok(pg.evaluate(BLOCKS) and pg.evaluate("() => [...document.querySelectorAll('.lgd-bc')].every(c => { const n = c.querySelector('.lgd-bn').getBoundingClientRect(), b = c.getBoundingClientRect(); return b.right - n.right < 30 })"), '6 phone 390: the block drops the side link, links sit under the sentence, names get the width')
    ok(pg.locator('.lgd-bc').count() >= 1 and pg.evaluate("() => { const p = document.querySelector('.lgd-bc .lgd-bph').getBoundingClientRect(); return p.width === 48 }"), '6 phone: the block is compact rows, photo 48')
    pg.fill('#lgdIn', 'takayama'); pg.wait_for_timeout(300)
    ok(pg.evaluate("document.activeElement.id") == 'lgdIn' and pg.locator('.lgd-card').count() >= 1 and all('Takayama' in x for x in pg.eval_on_selector_all('.lgd-card .lgd-n a', 'els => els.map(e => e.textContent)')) and 'of 77' in pg.inner_text('#lgdCount') and pg.locator('.lgd-bc').count() == 0, '6 phone: the find box narrows the cards and the count, keeps focus, hides the block')
    pg.fill('#lgdIn', 'zzzz'); pg.wait_for_timeout(300)
    ok('No one matches. Try a name, a district number, a town or a committee.' in pg.inner_text('#lgdBody'), '6 phone: nothing found says so')
    pg.fill('#lgdIn', ''); pg.wait_for_timeout(300)
    ok(pg.locator('.lgd-card').count() == 77 and pg.locator('.lgd-bc').count() > 0, '6 phone: clearing brings everyone and the block back')
    pg.fill('#lgdIn', 'zzzz'); pg.wait_for_timeout(300)
    ok(pg.evaluate("document.activeElement.id") == 'lgdIn' and 'No one matches' in pg.inner_text('#lgdBody'), '6 phone: "zzzz" keeps focus in the phone box')
    pg.fill('#lgdIn', ''); pg.wait_for_timeout(300)
    TRAY = "() => { const t = document.querySelector('.lgd-sw').getBoundingClientRect(); return [...document.querySelectorAll('.lgd-sw .seg')].every(b => { const r = b.getBoundingClientRect(); return r.left >= t.left - 0.5 && r.right <= t.right + 0.5 && r.height >= 43.5 }) && t.right <= innerWidth && document.querySelector('.lgd-sw').scrollWidth <= document.querySelector('.lgd-sw').clientWidth + 1 }"
    ok(pg.evaluate(TRAY) and pg.evaluate(SIDE), '6 phone 390: all four segments are inside the tray, no sideways scroll')
    pg.evaluate("document.getElementById('lgd-ch-H').scrollIntoView()"); pg.wait_for_timeout(300)
    ok(pg.evaluate("() => { const bar = document.querySelector('.toprow').getBoundingClientRect(), h = document.querySelector('#lgd-ch-H .lgd-h').getBoundingClientRect(); return h.top >= bar.bottom - 1 }"), '6 phone: the sticky House heading sits below the Back bar')
    pg.evaluate("window.scrollTo(0,0)")
    snap(pg, 'phone_dir.png'); ok(not pg.errs, f'6 no page error ({pg.errs[:2]})'); pg.close()
    pg = open_as(br, 360, 760, '#/more/legislators/directory')
    ok(pg.evaluate(TRAY) and pg.evaluate(SIDE), '6 phone 360: all four segments are inside the tray, no sideways scroll')
    f = pg.evaluate(FOOTS); ok(f['bad'] == [] and f['both'] >= 70 and pg.evaluate(BLOCKS), f"6 phone 360: foot and block links on one line, apart ({f['bad'][:3]})"); pg.close()
    br.close()
print(f'{sum(res)}/{len(res)} passed'); sys.exit(0 if all(res) else 1)
