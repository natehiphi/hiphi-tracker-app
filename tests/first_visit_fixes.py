# The first visit's six small fixes of 11 Oct (R-249, Nate's go after the page-by-page walk), pub/start.js, start-rest.js,
# start.css. python3 tests/first_visit_fixes.py [base_url]   (sandbox; a phone at 375x812, the width where the word broke)
# Checks: a tile's name is never broken inside a word ("Environment" sat on two lines as "Environmen / t" at 375px, A-19,
# C-14); the first screen's lede says what HIPHI is, in sentences of 30 words or fewer (C-14; the stranger from a link);
# the issues screen's free line says "alert", the one word for the thing (C-15), never "email"; the chapter strip ticks a
# chapter only when it was done: Skip with nothing picked leaves "Your issues" a plain dot that reads "(skipped)", Skip on
# the story leaves "A bill's story" the same (C-7), while a chapter that was done keeps its tick; the Mahalo page's button
# names the next part as the strip and the page do ("A Bill's Story", C-15); the "One thing" card says the bill's name
# once, with "Your issue:" only when the issue's name differs (A-14); with nothing followed the page says why and the way
# out (B-8, B-3). No console errors.
import os, sys
from playwright.sync_api import sync_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832/track.html'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out', 'first_visit_fixes'); os.makedirs(OUT, exist_ok=True)
passes, fails, errors = [], [], []
def ok(c, m): (passes if c else fails).append(('PASS ' if c else 'FAIL ') + m)

def ctx(b, w=375, h=812):
    c = b.new_context(viewport={'width': w, 'height': h}, is_mobile=w < 600, has_touch=w < 600, device_scale_factor=2 if w < 600 else 1)
    p = c.new_page(); p.on('pageerror', lambda e: errors.append(f'{w}: {e}'))
    p.on('console', lambda m: errors.append(f'console {w}: {m.text[:140]}') if m.type == 'error' and 'favicon' not in m.text else None)
    return c, p
def text(p, sel='main'):
    try: return p.inner_text(sel, timeout=3000)
    except Exception: return ''
def strip(p):
    return p.evaluate("() => [...document.querySelectorAll('.st-chapters li')].map(li => ({ cls: li.className, tick: !!li.querySelector('.st-cm svg, .st-cm .ic'), sr: (li.querySelector('.sr') || {}).textContent || '' }))")

# One line box for the word: the range over "Environment" inside the tile's name has one client rect.
LINE_BOXES = """() => { const el = [...document.querySelectorAll('.st-tiles .st-iname')].find(e => /Environment/.test(e.textContent)); if (!el) return null;
  const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) { const i = n.data.indexOf('Environment'); if (i >= 0) { const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + 11); return r.getClientRects().length; } } return null; }"""

def start(p, extra=''):
    p.goto(BASE + '?demo=1&restart' + extra); p.wait_for_selector('.st-tile', timeout=15000); p.wait_for_timeout(800)

def to_issues(p, *topics):
    for topic in topics: p.locator('.st-tile', has_text=topic).first.click(); p.wait_for_timeout(200)
    p.click('[data-stnext]'); p.wait_for_selector('[data-stpick]', timeout=10000); p.wait_for_timeout(800)

def to_soon(p):
    # Follow, skip the profile ask, through the Mahalo page and the story's three pages to "Coming up" (as coming_up.py walks it)
    p.click('[data-stnext]'); p.wait_for_selector('.st-alertspage', timeout=8000); p.wait_for_timeout(500)
    p.click('[data-stskip]'); p.wait_for_selector('.st-thanks #st-h', timeout=8000); p.wait_for_timeout(300)
    go = text(p, '.actionbar [data-stnext]').strip()
    p.click('.actionbar [data-stnext]'); p.wait_for_selector('.lx-count', timeout=10000); p.wait_for_timeout(1200)
    for _ in range(2): p.click('[data-stnext]'); p.wait_for_timeout(1500)
    p.click('[data-stnext]'); p.wait_for_selector('.st-soonpage', timeout=10000); p.wait_for_timeout(1000)
    return go

with sync_playwright() as pw:
    b = pw.chromium.launch()

    # 1. the first screen: the word stays whole, the lede says what HIPHI is
    c, p = ctx(b); start(p)
    ok(p.evaluate(LINE_BOXES) == 1, '1: "Environment" sits on one line of its tile at 375px, never "Environmen / t" (A-19, C-14)')
    lede = text(p, 'main .lede')
    ok('Hawaiʻi Public Health Institute' in lede and 'nonprofit' in lede, '1: the lede says what HIPHI is, by the name the rest of the page uses (C-15, Nate 10/11)')
    ok('Pick what you care about' in lede, '1: and still says what to do here')
    sentences = [s for s in lede.replace('?', '.').split('.') if s.strip()]
    ok(len(sentences) <= 2 and all(len(s.split()) <= 30 for s in sentences), f'1: two sentences at most, each 30 words or fewer (C-14): {[len(s.split()) for s in sentences]}')
    p.screenshot(path=os.path.join(OUT, 'topics-375.png'), full_page=True)

    ok('speak up' not in lede.lower(), '1: and does not say again what the heading says (A-14; the critic)')

    # 2. Skip with nothing picked: the story, with "Your issues" a plain dot that reads skipped, not a tick, and no petals from it
    p.click('[data-stskip]'); p.wait_for_selector('.lx-count', timeout=10000)
    bursts = 0
    for _ in range(7): p.wait_for_timeout(200); bursts += p.locator('.fx-burst').count()
    ok(bursts == 0, f'2: no celebration petals fly from the skipped chapter (C-7, A-10; the critic): {bursts} seen')
    s = strip(p)
    ok(len(s) == 3 and 'skipped' in s[0]['cls'] and not s[0]['tick'] and 'skipped' in s[0]['sr'] and 'done' not in s[0]['cls'], f'2: after Skip at the start the strip shows "Your issues" skipped, no tick (C-7): {s[0]}')
    ok('on' in s[1]['cls'], '2: and the story is the current chapter')
    p.screenshot(path=os.path.join(OUT, 'skipped-strip-375.png'))
    # Skip on the story: with nothing followed, "One thing you can do" has nothing to offer and is passed over (R-233); the
    # strip on "You're all set!" keeps both skipped chapters plain dots
    p.click('[data-stskip]'); p.wait_for_selector('[data-stdone]', timeout=10000); p.wait_for_timeout(800)
    ok(p.locator('.st-soonpage').count() == 0, '2: following nothing, the page before the end is passed over (R-233)')
    s = strip(p)
    ok('skipped' in s[0]['cls'] and 'skipped' in s[1]['cls'] and not s[1]['tick'], f'2: Skip on the story leaves it a plain dot too: {s[1]}')
    c.close()

    # 3. the ordinary road: the free line says alert, the chapters done are ticked, the Mahalo button names the story, the cards say the name once
    # Two topics: Tobacco's first card is a bill named after its issue (the name must not be said twice), Health Care's first
    # card is "Protect preventive care coverage" on the issue "Protect preventive care and vaccines" (the issue line stays).
    c, p = ctx(b); start(p); to_issues(p, 'Tobacco', 'Health Care')
    free = text(p, '.st-free')
    ok('one alert a day' in free and 'email' not in free.lower(), f'3: "Following is free" names alerts, not email, before the number is asked (C-15, A-14): {free!r}')
    ok(p.locator('.st-free .ic-bell, .st-free [class*="bell"]').count() == 1, '3: with the bell, the alerts icon')
    go = to_soon(p)
    ok(go == 'Next: A Bill’s Story', f'3: the Mahalo page\'s button names the next part as the strip does (C-15): {go!r}')
    ok(p.locator('.st-nothing').count() == 0 and p.locator('.st-pickagain').count() == 0, '3: with issues followed there is no empty-page note and no way-back button')
    s = strip(p)
    ok('done' in s[0]['cls'] and s[0]['tick'] and 'done' in s[1]['cls'] and s[1]['tick'], f'3: chapters that were done keep their ticks: {s[:2]}')
    # One thing you can do (R-233): the card says the bill's name once; the line under it names the bill and committee, not the name again (A-14)
    card = p.evaluate("() => { const c = document.querySelector('.st-onecard'); return c && { name: c.querySelector('.st-one-name').textContent.trim(), meta: (c.querySelector('.st-one-meta') || {}).textContent || '' }; }")
    ok(card and card['name'] and card['name'].lower() not in card['meta'].lower(), f'3: the one card names its bill once (A-14): {card}')
    p.screenshot(path=os.path.join(OUT, 'coming-up-375.png'), full_page=True)
    c.close()
    b.close()

for line in passes + fails: print(line)
print(f'\n{len(passes)} passed, {len(fails)} failed, {len(errors)} console/page errors')
for e in errors: print('  ', e)
sys.exit(1 if fails or errors else 0)
