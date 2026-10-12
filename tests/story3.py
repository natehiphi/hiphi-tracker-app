# R-255 (Nate 10/12): the last two stages of "A bill's story" are a choice at each of the bill's two moments, in the third
# person and text light: stage 3 "<bill> needs (or needed) a hearing. What should people do?" with Ask the chair for a
# hearing / Do nothing, stage 4 "Its hearing is ... (or Say a hearing is set.) Now what should people do?" with Send
# testimony / Do nothing. Walks it on a phone for a bill whose hearing is set (HB 2121), one waiting for a hearing
# (HB 424), one past its committees (HB 1079, in conference) and between sessions, and checks:
#   - the tense follows the bill; two equal choices; nothing is picked for you; the host's Next sleeps until a choice
#     (hidden, not greyed) and wakes after one; Back keeps a choice; coming forward again is afresh;
#   - each choice plays its own scene (the email and the calendar, the notes and the bill moving on, the grey road and
#     the stamp) and says one sentence, "can", never a promise, with the other path in one quiet line (C-12);
#   - doing nothing is said plainly in the word list's words ("on hold", "can't pass this year", "Most bills end at a
#     committee"), never "die" (R-144), never that few people write (R-171); the last choice turns to the person;
#   - what is read is 16px or larger (C-14); Done (or Next) moves on; no page errors.
# public_journey.py walks the same pages inside the first visit.
#   python3 -m http.server 8832   (in this folder, once)
#   python3 tests/story3.py [base]     base defaults to http://localhost:8832
import sys, re
from playwright.sync_api import sync_playwright
BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832').rstrip('/')
res = []
def ok(c, m): res.append(bool(c)); print('PASS' if c else 'FAIL', m)

def to_stage3(pg):
    pg.wait_for_function("() => document.getElementById('lx-story')", timeout=60000)
    for _ in range(2):
        pg.locator('[data-stlearnnext]').click(); pg.wait_for_timeout(900)
    pg.wait_for_function("() => document.getElementById('lx-story')?.dataset.stage === '3'", timeout=10000)
    pg.wait_for_timeout(600)

CAP = "document.getElementById('lx-cap').innerText"
SAID = "document.getElementById('lx-said')?.innerText || ''"
SCENE = "document.getElementById('lx-story').dataset.scene || ''"
SHOWN = "(sel) => [...document.querySelectorAll('#lx-story ' + sel)].some(g => g.getBoundingClientRect().width > 0)"
SMALL = """() => [...document.querySelectorAll('#lx-cap p, #lx-cap h2, #lx-cap .lx-ch, #lx-said p')].filter(e => [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim()))
  .filter(e => !e.closest('.lx-count') && parseFloat(getComputedStyle(e).fontSize) < 15.9).map(e => e.textContent.trim().slice(0, 40))"""
PROMISE = re.compile(r'will (pass|become law|get a hearing|change)|guarantee|for sure|always works', re.I)
BANNED = re.compile(r"\b(die|dies|died|dead|killed?)\b|few people|most people never", re.I)
IDS = {'HB2121': '2455257b-07a6-41c9-9745-94f174d78442', 'HB424': 'c66bf0a9-c499-4cea-b572-4ba65dbf5167', 'HB1079': 'f707d3fd-f830-491c-8f46-06dcfd847cbf'}
# (bill, extra, the tense of "needs a hearing", what stage 4's title says)
CASES = [('HB2121', '', 'needed', r'Its hearing is \w+ at [\d:]+ [AP]M\.'), ('HB424', '', 'needs', r'Say a hearing is set\.'),
         ('HB1079', '', 'needed', r'(It had its hearing|got a hearing)'), ('HB2121', '&season=off', 'needed', r'got a hearing\.')]
with sync_playwright() as p:
    br = p.chromium.launch()
    for num, extra, tense, set_re in CASES:
        where = f'{num}{" between sessions" if extra else ""}'
        ctx = br.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True); pg = ctx.new_page()
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(f'{BASE}/track.html?demo=1{extra}#/learn/story/{IDS[num]}')
        to_stage3(pg)
        cap = pg.evaluate(CAP); numsp = num.replace('HB', 'HB ')
        ok(cap.startswith('3 of 4') and re.search(rf'{numsp.replace(" ", r"[  ]")} {tense} a hearing\.', cap) is not None and 'What should people do?' in cap, f'{where}: stage 3 says "{numsp} {tense} a hearing. What should people do?" ({cap[:70]!r})')
        picks = pg.evaluate("[...document.querySelectorAll('.lx-doors [data-lx-pick]')].map(b => [b.dataset.lxPick, b.innerText.trim(), b.getAttribute('aria-pressed')])")
        ok(picks == [['chair', 'Ask the chair for a hearing', 'false'], ['none', 'Do nothing', 'false']], f'{where}: two equal choices, nothing picked for you ({picks})')
        ok(pg.locator('[data-stlearnnext]').is_hidden() and pg.evaluate(SAID) == '' and pg.evaluate(SCENE) == 'need' and pg.evaluate(SHOWN, '.lx-c3-need') and pg.locator('.actionbar.lx-asleep').count() == 1, f'{where}: Next sleeps until a choice (the empty bar with it); nothing said; the drawing shows the hearing the bill has not got')
        ok(pg.evaluate(SHOWN, '.lx-r3') and pg.evaluate(SHOWN, '.lx-r3 .lx-b3'), f'{where}: the road comes back with the bill on it')
        pg.click('.lx-doors [data-lx-pick=none]'); pg.wait_for_timeout(1700)
        said = pg.evaluate(SAID)
        ok(pg.evaluate(SCENE) == 'no' and 'DID NOT ADVANCE' in pg.inner_html('#lx-story') and 'without a hearing' in said and 'can’t pass this year' in said, f'{where}: Do nothing greys the road, stamps the bill and says it can be left without a hearing ({said[:80]!r})')
        ok(pg.locator('#lx-said .lx-other').count() == 1 and 'a hearing' in pg.locator('#lx-said .lx-other').inner_text() and pg.locator('[data-stlearnnext]').is_visible(), f'{where}: the other path is one quiet line, and Next wakes')
        pg.click('[data-stlearnnext]'); pg.wait_for_timeout(900)
        ok(pg.evaluate(SCENE) == 'c' and pg.evaluate(SHOWN, '.lx-c3-c'), f'{where}: after Do nothing, stage 4 opens by playing the email and the calendar, so the hearing is seen to come from asking (the critic)')
        pg.click('[data-stlearnback]'); pg.wait_for_timeout(900)
        pg.click('.lx-doors [data-lx-pick=chair]'); pg.wait_for_timeout(1700)
        said = pg.evaluate(SAID)
        ok(pg.evaluate(SCENE) == 'c' and pg.evaluate(SHOWN, '.lx-c3-c') and 'chair picks' in said and ' can ' in f' {said} ', f'{where}: Ask the chair flies the email, fills the calendar and says who the chair is and what an email can do ({said[:80]!r})')
        ok(pg.locator('.lx-doors [data-lx-pick=chair][aria-pressed=true]').count() == 1 and pg.locator('.lx-doors [aria-pressed=true]').count() == 1, f'{where}: the other choice is there to try, and the pick moves')
        ok(pg.evaluate(SMALL) == [], f'{where}: what is read is 16px+ ({pg.evaluate(SMALL)[:3]})')
        ok('Next' in pg.locator('[data-stlearnnext]').inner_text(), f'{where}: stage 3 is not the last: the button says Next')
        pg.click('[data-stlearnnext]'); pg.wait_for_timeout(1600)
        cap4 = pg.evaluate(CAP)
        ok(cap4.startswith('4 of 4') and re.search(set_re, cap4) is not None and 'Now what should people do?' in cap4, f'{where}: stage 4: the hearing is set, now what should people do? ({cap4[:70]!r})')
        ok(pg.evaluate(SCENE) == 'set' and pg.evaluate(SHOWN, '.lx-c3-set') and pg.locator('[data-stlearnnext]').is_hidden(), f'{where}: the hearing is on the list in the drawing, and Next sleeps again')
        picks = pg.evaluate("[...document.querySelectorAll('.lx-doors [data-lx-pick]')].map(b => [b.dataset.lxPick, b.innerText.trim()])")
        ok(picks == [['testimony', 'Send testimony'], ['none', 'Do nothing']], f'{where}: Send testimony or Do nothing ({picks})')
        pg.click('.lx-doors [data-lx-pick=none]'); pg.wait_for_timeout(1700)
        said_no = pg.evaluate(SAID)
        ok(pg.evaluate(SCENE) == 'no' and 'on hold' in said_no and 'what you think' in said_no, f'{where}: Do nothing at the hearing: on hold, and testimony named as a note saying what you think ({said_no[:90]!r})')
        pg.click('.lx-doors [data-lx-pick=testimony]'); pg.wait_for_timeout(1900)
        said_t = pg.evaluate(SAID)
        ok(pg.evaluate(SCENE) == 't' and pg.evaluate(SHOWN, '.lx-c3-t') and 'Testimony is a note saying what you think' in said_t and 'reads it before it votes' in said_t and 'carry' in said_t, f'{where}: Send testimony says what testimony is, flies the notes and moves the bill on ({said_t[:80]!r})')
        ok('home page' in said_t and 'what to do and by when' in said_t and 'on your issues' in said_t, f'{where}: the last choice turns to the person: where these moments reach them')
        ok(pg.locator('[data-stlearnnext]').is_visible() and 'Done' in pg.locator('[data-stlearnnext]').inner_text(), f'{where}: on the last stage the button says Done')
        allwords = cap + cap4 + said + said_no + said_t
        ok(PROMISE.search(allwords) is None and BANNED.search(allwords) is None, f'{where}: "can", never a promise; never "die", never that few people write')
        pg.click('[data-stlearnback]'); pg.wait_for_timeout(1000)
        ok(pg.evaluate("document.getElementById('lx-story').dataset.stage") == '3' and pg.locator('.lx-doors [data-lx-pick=chair][aria-pressed=true]').count() == 1 and pg.evaluate(SCENE) == 'c', f'{where}: Back keeps stage 3\'s choice')
        pg.click('[data-stlearnnext]'); pg.wait_for_timeout(1400)
        ok(pg.evaluate("document.getElementById('lx-story').dataset.stage") == '4' and pg.locator('.lx-doors [aria-pressed=true]').count() == 0 and pg.locator('[data-stlearnnext]').is_hidden(), f'{where}: coming forward again, stage 4 is afresh and Next sleeps')
        pg.click('.lx-doors [data-lx-pick=testimony]'); pg.wait_for_timeout(1200)
        pg.click('[data-stlearnnext]'); pg.wait_for_timeout(1200)
        ok('/learn/story' not in pg.url or pg.evaluate("!document.getElementById('lx-story')"), f'{where}: Done moves on')
        ok(not errs, f'{where}: no page errors {errs[:1]}')
        ctx.close()
    br.close()

print(f'{sum(res)}/{len(res)} passed')
sys.exit(0 if all(res) else 1)
