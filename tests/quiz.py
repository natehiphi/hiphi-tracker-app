# "What kind of advocate are you?" (R-217, a draft for Nate's yes or no) in the sandbox: the start, five one-tap questions, Back
# (the screen's and the phone's), a picked answer staying picked, the result and its one step, the kept result, Take it again,
# the friend share, the focus, the double-tap guard, the reading level, and that the address opens Home outside the practice copy.
#   python3 tests/quiz.py [base]     base defaults to http://localhost:8832/track.html
import os, sys
from playwright.sync_api import sync_playwright
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from checks import fk_grade

BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832/track.html').split('?')[0]
res = []
def ok(c, m): res.append(bool(c)); print('PASS' if c else 'FAIL', m)
def ready(pg): pg.wait_for_function("() => !!document.querySelector('main') && !document.querySelector('.skelpage')", timeout=60000); pg.wait_for_timeout(500)
SKIP = """() => { try { Object.defineProperty(navigator, 'globalPrivacyControl', { get: () => true });
  const w = JSON.parse(localStorage.getItem('hiphi_wiz') || '{}'); localStorage.setItem('hiphi_wiz', JSON.stringify({ ...w, done: true, step: 99 }));
  localStorage.setItem('hiphi_tour_bill', '{"how":"test"}'); localStorage.setItem('hiphi_tour_home', '{"how":"test"}');
  navigator.share = async d => { window.__shared = d; }; } catch {} }"""
NAMES = {'voice': 'The Voice', 'connector': 'The Connector', 'shows': 'The One Who Shows Up', 'skill': 'The Skill Sharer'}
text = lambda pg: pg.locator('main').inner_text()
hash_ = lambda pg: pg.evaluate("() => location.hash")
active = lambda pg: pg.evaluate("() => document.activeElement && document.activeElement.id")
OVER = "() => document.documentElement.scrollWidth <= window.innerWidth + 1"
def pick(pg, k): pg.click(f'[data-pick={k}]'); pg.wait_for_timeout(450)   # a tap in the first 350 ms of a question is ignored on purpose
def run5(pg, k):
    for _ in range(5): pick(pg, k)

with sync_playwright() as p:
    br = p.chromium.launch()
    for label, vp, mob in (('phone', {'width': 390, 'height': 844}, True), ('laptop', {'width': 1366, 'height': 900}, False)):
        ctx = br.new_context(viewport=vp, is_mobile=mob); ctx.add_init_script(f"({SKIP})()"); pg = ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'favicon' not in m.text else None)
        pg.goto(BASE + '?demo=1#/quiz'); ready(pg)
        ok('What kind of advocate are you?' in pg.locator('h1').first.inner_text() and 'HIPHI' not in pg.locator('.lede').inner_text() and 'Hawaiʻi' in pg.locator('.lede').inner_text(), f'{label}: the start says what the quiz is and that it is about Hawaiʻi')
        grades = [fk_grade(text(pg))]
        ok(pg.evaluate(OVER), f'{label}: the start does not scroll sideways')
        pg.click('[data-qz=start]'); pg.wait_for_timeout(450)
        ok(hash_(pg) == '#/quiz/1' and 'Question 1 of 5' in pg.locator('h1').inner_text() and pg.locator('.qz-opt').count() == 4, f'{label}: Start opens #/quiz/1, whose heading reads "Question 1 of 5" with the question')
        ok(active(pg) == 'qz-h', f'{label}: the question is focused for a screen reader')
        ok(all(pg.locator('.qz-opt').nth(i).bounding_box()['height'] >= 44 for i in range(4)), f'{label}: every answer is 44px or taller')
        ok(pg.locator('.qz-opts.qz-nohover').count() == 1 and pg.locator('.qz-picked').count() == 0, f'{label}: no answer looks chosen or hovered before the pointer moves')
        # a double tap answers one question, not two
        pg.dblclick('[data-pick=voice]'); pg.wait_for_timeout(500)
        ok('Question 2 of 5' in pg.locator('h1').inner_text(), f'{label}: a double tap answers only one question')
        # Back (the screen's and the phone's) keep the answer and the history in step
        pg.click('[data-qz=back]'); pg.wait_for_timeout(450)
        ok(hash_(pg) == '#/quiz/1' and pg.locator('.qz-opt.qz-picked[aria-pressed=true]').count() == 1, f'{label}: Back returns to question 1 with the answer still picked')
        pick(pg, 'connector'); pg.go_back(); pg.wait_for_timeout(450)
        ok(hash_(pg) == '#/quiz/1', f'{label}: the phone\'s back gesture steps back one question, not out of the quiz')
        pg.go_forward(); pg.wait_for_timeout(450)
        ok(hash_(pg) == '#/quiz/2', f'{label}: forward goes on to question 2')
        # a reload keeps the answers so far; an address with no answers behind it is the start
        pg.reload(); ready(pg)
        ok(hash_(pg) == '#/quiz/2' and 'Question 2 of 5' in pg.locator('h1').inner_text(), f'{label}: a reload on question 2 stays on question 2')
        pg.goto(BASE + '?demo=1#/quiz/4'); pg.evaluate("() => sessionStorage.clear()"); pg.reload(); ready(pg)
        ok(hash_(pg) == '#/quiz' and 'Start' in text(pg), f'{label}: #/quiz/4 with no answers behind it opens the start')
        # five connector answers
        pg.click('[data-qz=start]'); pg.wait_for_timeout(450)
        for _ in range(5): grades.append(fk_grade(text(pg))); pick(pg, 'connector')
        ok(hash_(pg) == '#/quiz/result' and NAMES['connector'] in text(pg) and 'Your one step' in text(pg), f'{label}: five connector answers end on The Connector and its one step')
        ok(pg.locator('[data-qz=share]').count() == 1 and pg.locator('.qz-step a.btn').count() == 0, f'{label}: the Connector\'s step is the share, and it is the only main button')
        ok(pg.locator('.qz-more a[href="#/find"]').count() == 1, f'{label}: the Connector can still choose an issue to follow')
        ok(active(pg) == 'qz-h' and 'Your way to help' in pg.locator('h1').inner_text(), f'{label}: the result is focused, and its heading reads "Your way to help" with the name')
        ok(pg.evaluate(OVER), f'{label}: the result does not scroll sideways')
        pg.click('[data-qz=share]'); pg.wait_for_timeout(400)
        sh = pg.evaluate("() => window.__shared || null")
        ok(sh and 'via=quiz#/quiz' in sh['url'] and 'HIPHI' in sh['text'] and 'Hawaiʻi' in sh['text'], f'{label}: the share sends a link to the quiz tagged ?via=quiz, in words that say who is asking')
        ok('Sent' in pg.locator('.toast, [role=status]').first.inner_text() if pg.locator('.toast, [role=status]').count() else False, f'{label}: the share says it was sent')
        # kept on this device; Take it again starts over
        pg.goto(BASE + '?demo=1#/'); ready(pg); pg.goto(BASE + '?demo=1#/quiz'); ready(pg)
        ok(NAMES['connector'] in text(pg), f'{label}: the result is kept on this device and #/quiz shows it')
        pg.click('[data-qz=again]'); pg.wait_for_timeout(450)
        ok(hash_(pg) == '#/quiz/1' and pg.locator('.qz-picked').count() == 0, f'{label}: Take it again starts at question 1 with nothing picked')
        # the other three results, each with its step
        for k in ('voice', 'shows', 'skill'):
            run5(pg, k)
            t = text(pg); grades.append(fk_grade(t))
            ok(NAMES[k] in t and 'Choose an issue' in t and pg.locator('.qz-step a.btn[href="#/find"]').count() == 1, f'{label}: {NAMES[k]} gets its step, which opens Find')
            ok(pg.locator('.qz-more [data-qz=share]').count() == 1, f'{label}: {NAMES[k]} still offers "Send this quiz to a friend"')
            if k != 'skill': pg.click('[data-qz=again]'); pg.wait_for_timeout(450)
        ok(max(grades) <= 8, f'{label}: every screen reads at grade 8 or below (worst {max(grades)})')
        pg.click('.qz-step a.btn'); pg.wait_for_timeout(600)
        ok(hash_(pg).startswith('#/find'), f'{label}: the step opens Find')
        ok(not errs, f'{label}: no page or console errors' + (': ' + '; '.join(errs[:2]) if errs else ''))
        ctx.close()
    # outside the practice copy the draft is not there: the address opens Home, with the usual word for a page that is not here
    ctx = br.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True); ctx.add_init_script(f"({SKIP})()"); pg = ctx.new_page()
    pg.goto(BASE + '#/quiz'); pg.wait_for_function("() => location.hash === '#/' || location.hash === ''", timeout=60000); pg.wait_for_timeout(800)
    ok(pg.evaluate("() => document.body.dataset.screen") == 'home' and 'What kind of advocate' not in text(pg), 'live address: #/quiz opens Home, not the draft')
    pg.goto(BASE + '#/quiz/3'); pg.wait_for_function("() => location.hash === '#/' || location.hash === ''", timeout=60000); pg.wait_for_timeout(500)
    ok(pg.evaluate("() => document.body.dataset.screen") == 'home', 'live address: #/quiz/3 opens Home too')
    br.close()
print(f'{sum(res)}/{len(res)} passed'); sys.exit(0 if all(res) else 1)
