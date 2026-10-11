# R-219 (Nate 10/11, "Go with version 1, the road"): the last stage of "A bill's story" is the road again with two doors,
# for everyone. Walks it on a phone for a bill whose testimony is due (HB 2121), one waiting for a hearing (HB 424), one
# past its committees (HB 1079, in conference) and between sessions, and checks:
#   - the heading asks the question; two doors; nothing is picked for you;
#   - the yes door follows the bill's moment (testimony with a hearing set, the chair's email while it waits);
#   - each door shows its own scene and says what it can do, "can", never a promise; no is stamped "Did not advance" and
#     says the bill can't pass; the other door stays there to try; Done (or Next) always moves on;
#   - what is read to choose is 16px or larger (C-14), and no page errors.
# public_journey.py walks the same page inside the first visit.
#   python3 -m http.server 8832   (in this folder, once)
#   python3 tests/story3.py [base]     base defaults to http://localhost:8832
import sys
from playwright.sync_api import sync_playwright
BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832').rstrip('/')
res = []
def ok(c, m): res.append(bool(c)); print('PASS' if c else 'FAIL', m)

def to_stage3(pg):
    pg.wait_for_function("() => document.getElementById('lx-story')", timeout=60000)
    for _ in range(2):
        pg.locator('.actionbar button, .actionbar a').filter(has_text='Next').first.click(); pg.wait_for_timeout(900)
    pg.wait_for_function("() => document.getElementById('lx-story')?.dataset.stage === '3'", timeout=10000)
    pg.wait_for_timeout(600)

CHOICE = "document.getElementById('lx-story').dataset.choice || ''"
CAP = "document.getElementById('lx-cap').innerText"
MOM = "document.getElementById('lx-mom').innerText"
SHOWN = "(sel) => [...document.querySelectorAll('#lx-story ' + sel)].some(g => g.getBoundingClientRect().width > 0)"
SMALL = """() => [...document.querySelectorAll('#lx-cap .lx-ch, #lx-cap p, #lx-mom p, #lx-mom button span')].filter(e => [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()))
  .filter(e => !e.closest('.lx-count') && parseFloat(getComputedStyle(e).fontSize) < 15.9).map(e => e.textContent.trim().slice(0, 40))"""

# The story's route takes the bill's id (the sandbox's snapshot): HB 2121, HB 424, HB 1079.
IDS = {'HB2121': '2455257b-07a6-41c9-9745-94f174d78442', 'HB424': 'c66bf0a9-c499-4cea-b572-4ba65dbf5167', 'HB1079': 'f707d3fd-f830-491c-8f46-06dcfd847cbf'}
CASES = [('HB2121', '', 'testimony', True), ('HB424', '', 'chair', True), ('HB1079', '', 'testimony', False), ('HB2121', '&season=off', 'testimony', False)]
with sync_playwright() as p:
    br = p.chromium.launch()
    for num, extra, kind, live in CASES:
        where = f'{num}{" between sessions" if extra else ""}'
        ctx = br.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True); pg = ctx.new_page()
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(f'{BASE}/track.html?demo=1{extra}#/learn/story/{IDS[num]}')
        to_stage3(pg)
        cap = pg.evaluate(CAP)
        ok(num.replace('HB', 'HB\u00a0') in cap or num.replace('HB', 'HB ') in cap, f'{where}: the story is about {num}')
        ok(pg.evaluate(CHOICE) == '' and pg.locator('[data-lx-ch][aria-pressed=true]').count() == 0, f'{where}: nothing is picked for you')
        ok(('Will you speak up on' if live else 'Would you speak up on a bill like') in cap, f'{where}: the doors ask the question')
        ok(pg.locator('.lx-doors [data-lx-ch]').count() == 2, f'{where}: two doors')
        yes = pg.locator('.lx-doors [data-lx-ch=yes]').inner_text()
        ok(('email the chair' in yes) == (kind == 'chair'), f'{where}: the yes door follows the moment ("{yes}")')
        ok(pg.evaluate(SHOWN, '.lx-r3'), f'{where}: the road comes back')
        pg.click('.lx-doors [data-lx-ch=yes]'); pg.wait_for_timeout(1700)
        m = pg.evaluate(MOM)
        ok(pg.evaluate(CHOICE) == 'yes' and pg.evaluate(SHOWN, '.lx-c3-yes') and ' can ' in m and 'will pass' not in m, f'{where}: yes plays its scene and says what it can do')
        ok(pg.locator('#lx-mom [data-lx-ch=no]').count() == 1, f'{where}: the other door is there to try')
        ok(pg.evaluate(SMALL) == [], f'{where}: what is read to choose is 16px+ ({pg.evaluate(SMALL)[:3]})')
        pg.click('#lx-mom [data-lx-ch=no]'); pg.wait_for_timeout(1700)
        m = pg.evaluate(MOM)
        ok(pg.evaluate(CHOICE) == 'no' and pg.evaluate(SHOWN, '.lx-c3-no') and 'DID NOT ADVANCE' in pg.inner_html('#lx-story') and 'can’t pass' in m, f'{where}: no greys the road, stamps it and says it can’t pass')
        pg.locator('.actionbar button, .actionbar a').last.click(); pg.wait_for_timeout(1200)
        ok('/learn/story' not in pg.url or pg.evaluate("!document.getElementById('lx-story')"), f'{where}: the button below moves on')
        ok(not errs, f'{where}: no page errors {errs[:2]}')
        ctx.close()
    br.close()
print(f'\n{sum(res)}/{len(res)} passed'); sys.exit(0 if all(res) else 1)
