# R-219 (Nate 10/11, "Build 1 and 3"): the two new versions of "A bill's story"'s last stage, each on its own link for
# his pick: ?story3=road (page 2's road comes back with two doors) and ?story3=table (the committee's table, three
# choices). Walks each on a phone for a bill whose testimony is due (HB 2121), one waiting for a hearing (HB 424), one
# past its committees (HB 1079, in conference) and between sessions, and checks:
#   - the stage's heading asks the question; the doors (or the three choices) are there and nothing is picked for you;
#   - the yes door follows the bill's moment (testimony with a hearing, the chair's email while it waits); the table
#     marks the one that fits now;
#   - every pick shows its own scene and says what it can do, "can", never a promise; doing nothing is stamped "Did not
#     advance" and says the bill can't pass; the others stay there to try; Next (Done) always moves on;
#   - nothing is smaller than 16px in what is read to choose (C-14), and no page errors.
# Today's version (no ?story3) is public_journey.py's.
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
SMALL = """() => [...document.querySelectorAll('#lx-cap .lx-ch, #lx-cap .lx-ch *, #lx-mom p')].filter(e => e.childNodes.length && [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()))
  .filter(e => !e.closest('.lx-chhere') && parseFloat(getComputedStyle(e).fontSize) < 15.9).map(e => e.textContent.trim().slice(0, 40))"""

# The story's route takes the bill's id (the sandbox's snapshot): HB 2121, HB 424, HB 1079.
IDS = {'HB2121': '2455257b-07a6-41c9-9745-94f174d78442', 'HB424': 'c66bf0a9-c499-4cea-b572-4ba65dbf5167', 'HB1079': 'f707d3fd-f830-491c-8f46-06dcfd847cbf'}
CASES = [('HB2121', '', 'testimony', True), ('HB424', '', 'chair', True), ('HB1079', '', 'testimony', False), ('HB2121', '&season=off', 'testimony', False)]
with sync_playwright() as p:
    br = p.chromium.launch()
    for v in ('road', 'table'):
        for num, extra, kind, live in CASES:
            where = f'{v} {num}{" between sessions" if extra else ""}'
            ctx = br.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True); pg = ctx.new_page()
            errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
            pg.goto(f'{BASE}/track.html?demo=1{extra}&story3={v}#/learn/story/{IDS[num]}')
            to_stage3(pg)
            cap = pg.evaluate(CAP)
            ok(pg.evaluate(CHOICE) == '' and pg.locator('[data-lx-ch][aria-pressed=true]').count() == 0, f'{where}: nothing is picked for you')
            if v == 'road':
                ok(('Will you speak up on' if live else 'Would you speak up on a bill like') in cap, f'{where}: the doors ask the question ({cap.splitlines()[1] if len(cap.splitlines()) > 1 else cap})')
                ok(pg.locator('.lx-doors [data-lx-ch]').count() == 2, f'{where}: two doors')
                yes = pg.locator('.lx-doors [data-lx-ch=yes]').inner_text()
                ok(('email the chair' in yes) == (kind == 'chair'), f'{where}: the yes door follows the moment ("{yes}")')
                ok(pg.evaluate(SHOWN, '.lx-r3'), f'{where}: the road comes back')
                pg.click('.lx-doors [data-lx-ch=yes]'); pg.wait_for_timeout(1700)
                m = pg.evaluate(MOM)
                ok(pg.evaluate(CHOICE) == 'yes' and pg.evaluate(SHOWN, '.lx-c3-yes') and ' can ' in m, f'{where}: yes plays its scene and says what it can do')
                ok(pg.locator('#lx-mom [data-lx-ch=no]').count() == 1, f'{where}: the other door is there to try')
                pg.click('#lx-mom [data-lx-ch=no]'); pg.wait_for_timeout(1700)
                m = pg.evaluate(MOM)
                ok(pg.evaluate(CHOICE) == 'no' and pg.evaluate(SHOWN, '.lx-c3-no') and 'DID NOT ADVANCE' in pg.inner_html('#lx-story') and 'can’t pass' in m, f'{where}: no greys the road, stamps it and says it can’t pass')
            else:
                ok('What would you do?' in cap and pg.locator('.lx-choose [data-lx-ch]').count() == 3, f'{where}: the table asks, with three choices')
                ok(pg.evaluate(SHOWN, '.lx-t3'), f'{where}: the committee table is drawn')
                here = pg.locator('.lx-choose .lx-chhere')
                ok(here.count() == (1 if live else 0) and (not live or pg.locator(f'.lx-choose [data-lx-ch={kind}] .lx-chhere').count() == 1), f'{where}: the one that fits now is marked ({here.count()})')
                for k in ('testimony', 'chair', 'quiet'):
                    pg.click(f'.lx-choose [data-lx-ch={k}]'); pg.wait_for_timeout(1700)
                    m = pg.evaluate(MOM)
                    ok(pg.evaluate(CHOICE) == k and pg.evaluate(SHOWN, f'.lx-c3-{k}') and pg.locator('#lx-mom [data-lx-ch]').count() == 2, f'{where}: {k} plays its scene, the other two to try')
                    if k == 'quiet': ok('DID NOT ADVANCE' in pg.inner_html('#lx-story') and 'can’t pass' in m, f'{where}: doing nothing is stamped and says it can’t pass')
                    else: ok(' can ' in m and 'will pass' not in m, f'{where}: {k} says what it can do')
            ok(num.replace('HB', 'HB\u00a0') in cap or num.replace('HB', 'HB ') in cap, f'{where}: the story is about {num}')
            ok(pg.evaluate(SMALL) == [], f'{where}: what is read to choose is 16px+ ({pg.evaluate(SMALL)[:3]})')
            pg.locator('.actionbar button, .actionbar a').last.click(); pg.wait_for_timeout(1200)
            ok('/learn/story' not in pg.url or pg.evaluate("!document.getElementById('lx-story')"), f'{where}: the button below moves on ({pg.url.split("#")[-1]})')
            ok(not errs, f'{where}: no page errors {errs[:2]}')
            ctx.close()
    br.close()
print(f'\n{sum(res)}/{len(res)} passed'); sys.exit(0 if all(res) else 1)
