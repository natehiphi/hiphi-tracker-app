# R-255 (Nate 10/12): three pages to choose from for the last stage of "A bill's story", on the practice copy only
# (?story3=both|order|after); today's two doors stay for everyone (tests/story3.py). For a bill whose testimony is due
# (HB 2121), one waiting for a hearing (HB 424) and between sessions, each option is checked on a phone:
#   - no question and no doors: nothing to pick, Next (or Done) moves on;
#   - both sides are said without a tap: what testimony does, what an email to the chair does, and what happens with no
#     one asking ("put on hold", "can't pass this year", "Most bills end at a committee"); never "die" or "dead", and
#     never that few people write (R-171);
#   - the drawing plays on arrival: 'both' and 'after' end on the notes scene ('after' shows the stamp first), 'order'
#     shows both moments; what is read is 16px or larger (C-14); no page errors.
#   python3 -m http.server 8832   (in this folder, once)
#   python3 tests/story3_options.py [base]     base defaults to http://localhost:8832
import sys, re
from playwright.sync_api import sync_playwright
BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832').rstrip('/')
res = []
def ok(c, m): res.append(bool(c)); print('PASS' if c else 'FAIL', m)

def to_stage3(pg):
    pg.wait_for_function("() => document.getElementById('lx-story')", timeout=60000)
    for _ in range(2):
        pg.locator('.actionbar button, .actionbar a').filter(has_text='Next').first.click(); pg.wait_for_timeout(900)
    pg.wait_for_function("() => document.getElementById('lx-story')?.dataset.stage === '3'", timeout=10000)

CAP = "document.getElementById('lx-cap').innerText"
CHOICE = "document.getElementById('lx-story').dataset.choice || ''"
SHOWN = "(sel) => [...document.querySelectorAll('#lx-story ' + sel)].some(g => g.getBoundingClientRect().width > 0)"
SMALL = """() => [...document.querySelectorAll('#lx-cap p, #lx-cap li, #lx-cap h2')].filter(e => [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()))
  .filter(e => !e.closest('.lx-count') && parseFloat(getComputedStyle(e).fontSize) < 15.9).map(e => e.textContent.trim().slice(0, 40))"""
IDS = {'HB2121': '2455257b-07a6-41c9-9745-94f174d78442', 'HB424': 'c66bf0a9-c499-4cea-b572-4ba65dbf5167'}
CASES = [('HB2121', '', 'testimony', True), ('HB424', '', 'chair', True), ('HB2121', '&season=off', 'testimony', False)]
TITLES = {'both': 'What moves', 'order': 'Two moments decide', 'after': 'Why your note matters'}
BANNED = re.compile(r"\b(die|dies|died|dead|killed?)\b|few people|most people never", re.I)

with sync_playwright() as p:
    br = p.chromium.launch()
    for opt in ('both', 'order', 'after'):
        for num, extra, kind, live in CASES:
            where = f'{opt} · {num}{" between sessions" if extra else ""}'
            ctx = br.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True); pg = ctx.new_page()
            errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
            pg.goto(f'{BASE}/track.html?demo=1&story3={opt}{extra}#/learn/story/{IDS[num]}')
            to_stage3(pg)
            if opt == 'after' and live:
                pg.wait_for_timeout(700)
                ok(pg.evaluate(CHOICE) == 'no' and 'DID NOT ADVANCE' in pg.inner_html('#lx-story'), f'{where}: first the road ahead greys and the bill is stamped')
            pg.wait_for_timeout(2600)
            cap = pg.evaluate(CAP)
            ok(cap.startswith('3 of 3') and TITLES[opt] in cap, f'{where}: the page is titled for the option ({cap.splitlines()[1][:50] if len(cap.splitlines()) > 1 else cap[:50]!r})')
            ok(pg.locator('.lx-doors, [data-lx-ch]').count() == 0 and '?' not in cap.split('\n')[1], f'{where}: no question and no doors')
            ok('testimony' in cap.lower() and 'chair' in cap.lower(), f'{where}: it says what testimony does and what an email to the chair does')
            ok('can’t pass' in cap and 'Most bills end at a committee' in cap and 'on hold' in cap, f'{where}: and what happens with no one asking, in the word list\'s words')
            ok(not BANNED.search(cap), f'{where}: never "die" or "dead", never that few people write')
            ok(' can ' in cap and 'will pass' not in cap, f'{where}: "can", never a promise')
            if opt == 'order': ok(pg.evaluate(SHOWN, '.lx-c3-order') and pg.locator('#lx-cap .lx-steps li').count() == 2, f'{where}: both moments are drawn, and the two steps are numbered')
            else: ok(pg.evaluate(CHOICE) == 'yes' and pg.evaluate(SHOWN, '.lx-c3-yes'), f'{where}: the drawing ends on the notes scene with no tap')
            if opt == 'both': ok(pg.locator('#lx-cap .lx-two > div').count() == 2 and pg.locator('#lx-cap .lx-mini').count() == 2, f'{where}: the two outcomes stand side by side, each with its small drawing')
            ok(pg.evaluate(SMALL) == [], f'{where}: what is read is 16px+ ({pg.evaluate(SMALL)[:3]})')
            pg.locator('.actionbar button, .actionbar a').last.click(); pg.wait_for_timeout(1200)
            ok('/learn/story' not in pg.url or pg.evaluate("!document.getElementById('lx-story')"), f'{where}: the button below moves on')
            ok(not errs, f'{where}: no page errors {errs[:1]}')
            ctx.close()
    # without the switch, and on the live site's address, today's doors stay
    ctx = br.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True); pg = ctx.new_page()
    pg.goto(f'{BASE}/track.html?demo=1#/learn/story/{IDS["HB2121"]}'); to_stage3(pg); pg.wait_for_timeout(600)
    ok(pg.locator('.lx-doors [data-lx-ch]').count() == 2 and 'Will you speak up' in pg.evaluate(CAP), 'without ?story3 the page is today\'s: the question and two doors')
    ctx.close(); br.close()

print(f'{sum(res)}/{len(res)} passed')
sys.exit(0 if all(res) else 1)
