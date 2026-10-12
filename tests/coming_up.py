# "One thing you can do" (R-233, Nate 10/11; it was "Coming up on your issues", R-098), pub/start-rest.js stepSoon. The page is
# the first visit's "Stay connected" step, before the last screen (today's ending) or Home (the ending on Home).
# python3 tests/coming_up.py [base_url]   (sandbox; a phone at 390x844 and a laptop at 1280x800)
# Checks, in session: the heading "One thing you can do this week" is a real h1; one card, the bill in the heading face, that
# opens nothing; the line says what it is and how long; the bar's main button is the action ("Write testimony") with "Not
# now" beside it and no Next; the button opens the walkthrough; once done the card ticks, the one thing stays the same and
# the bar is Next, and the finale says what they did; "Not now" goes on to "You're all set!"; the rest of the week one line
# each. With nothing to testify or email on (Getting Around): a hearing ask or "Ask a friend to follow it", never an empty
# page. Ending on Home: the same page, "See How I Can Help" once done. Between sessions (&season=off): "before January",
# "Ask a friend to follow it", the session's date (said once) and what happened below. Following nothing: the page is
# passed over, forward and Back. No sideways scroll.
# No console errors.
import os, sys
from playwright.sync_api import sync_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832/track.html'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out', 'coming_up'); os.makedirs(OUT, exist_ok=True)
passes, fails, errors = [], [], []
def ok(c, m): (passes if c else fails).append(('PASS ' if c else 'FAIL ') + m)

def ctx(b, w=390, h=844):
    c = b.new_context(viewport={'width': w, 'height': h}, is_mobile=w < 600, has_touch=w < 600, device_scale_factor=2 if w < 600 else 1)
    p = c.new_page(); p.on('pageerror', lambda e: errors.append(f'{w}: {e}'))
    p.on('console', lambda m: errors.append(f'console {w}: {m.text[:140]}') if m.type == 'error' and 'favicon' not in m.text else None)
    return c, p
def text(p, sel='main'):
    try: return p.inner_text(sel, timeout=3000)
    except Exception: return ''

# The first visit from a restart to "Coming up" (the story, the address skipped), for one topic.
def walk_to_soon(p, extra, topic='Food'):
    p.goto(BASE + '?demo=1&restart' + extra); p.wait_for_selector('.st-tile', timeout=15000); p.wait_for_timeout(800)
    p.locator('.st-tile', has_text=topic).first.click(); p.wait_for_timeout(200)
    p.click('[data-stnext]'); p.wait_for_selector('[data-stpick]', timeout=10000); p.wait_for_timeout(800)
    p.click('[data-stnext]'); p.wait_for_selector('.st-alertspage', timeout=8000); p.wait_for_timeout(500)
    p.click('[data-stskip]')
    # Skip turns the screen into the "Mahalo!" page, which waits for its Next (R-140, Nate 11 Oct)
    p.wait_for_selector('.st-thanks #st-h', timeout=8000); p.wait_for_timeout(300); p.click('.actionbar [data-stnext]')
    p.wait_for_selector('.lx-count', timeout=10000); p.wait_for_timeout(1200)
    for _ in range(2): p.click('[data-stnext]'); p.wait_for_timeout(1500)
    p.click('[data-stnext]')
    # the story hands straight on to Coming up (R-232: the address step left the first visit)
    p.wait_for_selector('.st-soonpage', timeout=10000); p.wait_for_timeout(1000)

def bar(p): return [x.strip() for x in p.eval_on_selector_all('.st-bar .btn', 'bs => bs.map(b => b.innerText)')]
def primary(p): return p.locator('.st-bar .btn.primary').inner_text().strip()
def noscroll(p): return p.evaluate('() => document.documentElement.scrollWidth <= innerWidth + 1')
# The one thing, as the page picked it (S.stOne, start-rest.js oneThing), and marking it done the way a walkthrough does.
ONE = "async () => { const k = await import('./pub/kernel.js'); const w = k.S.stOne && k.S.stOne.w; return w ? { kind: w.kind, bill: w.b && w.b.id, hearing: w.h && w.h.id } : null; }"
DONE = """async () => { const c = await import('./pub/core.js'), k = await import('./pub/kernel.js'); const w = k.S.stOne.w;
  k.S.done.add(c.doneKey(w.b.id, w.h.id, w.kind)); k.app.render(); }"""

with sync_playwright() as pw:
    b = pw.chromium.launch()

    # ---- in session, a topic with hearings, a phone ----
    c, p = ctx(b)
    walk_to_soon(p, '&end=today')
    h = p.locator('#st-h')
    ok(h.evaluate('e => e.tagName') == 'H1' and h.inner_text() == 'One thing you can do this week', f'heading: a real h1, "One thing you can do this week" ({h.inner_text()})')
    one = p.evaluate(ONE)
    ok(one and one['kind'] == 'testimony', f'with testimony open this week, the one thing is testimony ({one})')
    ok(p.locator('.st-onecard').count() == 1, 'one card')
    ok(p.locator('.st-onecard a, .st-onecard button').count() == 0, 'the card opens nothing: its action is the bar\'s button (A-12)')
    ok(p.locator('.st-one-name').evaluate('e => getComputedStyle(e).fontFamily').startswith('Poppins'), 'the bill is named in the heading face (A-19)')
    ok('Testimony due' in text(p, '.st-one-when') and ' at ' in text(p, '.st-one-when'), f'the card says when testimony is due ({text(p, ".st-one-when")})')
    ok('We help you write it, about 5 minutes.' in text(p, '.lede'), f'the line says what it is and how long ({text(p, ".lede")})')
    ok(p.locator('.st-bar .btn.primary').count() == 1 and primary(p) == 'Write testimony', f'the main button is the action, "Write testimony" ({bar(p)})')
    ok('Not now' in bar(p) and 'Next' not in bar(p), f'"Not now" beside it, and no Next (R-233: {bar(p)})')
    ok(p.locator('.st-bar [data-stskip]').evaluate('e => !e.classList.contains("primary")'), '"Not now" is the quiet one (A-3)')
    top = p.locator('.st-onecard').evaluate('e => e.getBoundingClientRect().top')
    ok(top < 844 * 0.6, f'the card is in the top of the phone screen ({int(top)}px, A-1)')
    rest = p.eval_on_selector_all('.st-rest li', 'ls => ls.map(l => l.innerText)')
    ok(all(one['bill'] not in r for r in rest), f'the rest of the week, one line each, without the one thing again ({rest})')
    ok(noscroll(p), 'no sideways scroll')
    p.screenshot(path=os.path.join(OUT, 'phone_today.png'))
    # The button opens the testimony walkthrough.
    p.click('.st-bar .btn.primary')
    try: p.wait_for_selector('#hp-dlg', timeout=15000); opened = True
    except Exception: opened = False
    ok(opened, 'the button opens the testimony walkthrough')
    p.keyboard.press('Escape'); p.wait_for_timeout(800)
    ok(p.locator('.st-onepage').count() == 1, 'closing the walkthrough comes back to the page')
    # Done (as the walkthrough marks it): the card ticks, the line thanks, the button is Next.
    p.evaluate(DONE); p.wait_for_timeout(500)
    ok(p.locator('.st-onecard.done').count() == 1 and 'Done' in text(p, '.st-one-done'), 'done: the card turns green with a tick (A-16)')
    ok(p.evaluate(ONE)['bill'] == one['bill'], 'done: the one thing stays the same (it does not swap to another bill)')
    ok(bar(p) == ['Next'], f'done: the bar is Next ({bar(p)})')
    p.screenshot(path=os.path.join(OUT, 'phone_done.png'))
    p.click('.st-bar [data-stnext]'); p.wait_for_selector('.st-donepage, .st-finale, [data-stdone]', timeout=8000); p.wait_for_timeout(600)
    ok('You wrote testimony' in text(p), 'the finale says what they did')
    c.close()

    # ---- "Not now" goes on to "You're all set!" ----
    c, p = ctx(b)
    walk_to_soon(p, '&end=today')
    p.click('.st-bar [data-stskip]'); p.wait_for_selector('[data-stdone]', timeout=8000); p.wait_for_timeout(400)
    ok(p.locator('[data-stdone]').count() == 1, '"Not now" goes on to "You\'re all set!"')
    c.close()

    # ---- in session, nothing this week: "Ask a friend to follow it" ----
    c, p = ctx(b)
    walk_to_soon(p, '&end=today', topic='Getting Around')
    ok(p.evaluate(ONE)['kind'] in ('shareissue', 'ask'), f'nothing to testify or email on: a hearing ask or "Ask a friend to follow it" ({p.evaluate(ONE)})')
    ok(p.locator('.st-onecard').count() == 1 and p.locator('.st-nothing').count() == 0, 'still one thing, never an empty page')
    ok(primary(p) in ('Ask a friend to follow it', 'Ask the chair for a hearing', 'Ask the chairs for a hearing'), f'its button ({primary(p)})')
    p.screenshot(path=os.path.join(OUT, 'phone_quiet.png'))
    c.close()

    # ---- the ending on Home: the same page; once done its button says where it goes ----
    c, p = ctx(b)
    walk_to_soon(p, '&end=home')
    ok(p.inner_text('#st-h') == 'One thing you can do this week' and primary(p) == 'Write testimony', 'ending on Home: the same page')
    p.evaluate(DONE); p.wait_for_timeout(500)
    ok(p.locator('.st-bar .btn.primary', has_text='See How I Can Help').count() == 1, f'ending on Home: once done, "See How I Can Help" (B-14; {bar(p)})')
    c.close()

    # ---- between sessions: Ask a friend to follow it; the session's date and last year's story below ----
    c, p = ctx(b)
    walk_to_soon(p, '&end=today&season=off')
    ok(p.inner_text('#st-h') == 'One thing you can do before January', f'between sessions: its heading ({p.inner_text("#st-h")})')
    ok(p.evaluate(ONE)['kind'] == 'shareissue' and primary(p) == 'Ask a friend to follow it', f'between sessions: "Ask a friend to follow it" (Nate 10/11; {bar(p)})')
    ok(p.inner_text('#st-rest-h') == 'Coming up', 'between sessions: the rest under "Coming up"')
    rest = p.eval_on_selector_all('.st-rest li', 'ls => ls.map(l => l.innerText)')
    ok(any('Opens:' in r for r in rest) and any('What happened:' in r for r in rest), f'between sessions: the session opening and what happened, one line each ({rest})')
    ok(text(p).count('January 20') == 1, 'between sessions: the session date said once')
    ok(noscroll(p), 'between sessions: no sideways scroll')
    p.screenshot(path=os.path.join(OUT, 'phone_off.png'))
    c.close()

    # ---- following nothing (Skip on the issues): the page is passed over ----
    c, p = ctx(b)
    p.goto(BASE + '?demo=1&restart&end=today'); p.wait_for_selector('.st-tile', timeout=15000); p.wait_for_timeout(800)
    p.locator('.st-tile', has_text='Food').first.click(); p.wait_for_timeout(200)
    p.click('[data-stnext]'); p.wait_for_selector('[data-stpick]', timeout=10000); p.wait_for_timeout(800)
    p.click('.st-bar [data-stskip]'); p.wait_for_timeout(1500)
    # with nothing followed the alerts screen may be passed over too; through whatever comes until the story
    for _ in range(4):
        if p.locator('.lx-count').count(): break
        p.click('.st-bar [data-stskip], .actionbar [data-stnext]' if p.locator('.st-bar [data-stskip]').count() else '.actionbar [data-stnext]'); p.wait_for_timeout(1200)
    p.wait_for_selector('.lx-count', timeout=10000); p.wait_for_timeout(1200)
    for _ in range(2): p.click('[data-stnext]'); p.wait_for_timeout(1500)
    ok('All Set' in primary(p), f'following nothing: the story\'s last button names the end ({primary(p)})')
    p.click('[data-stnext]'); p.wait_for_timeout(1500)
    ok(p.locator('.st-onepage, .st-soonpage').count() == 0 and p.locator('[data-stdone]').count() == 1, 'following nothing: straight to "You\'re all set!"')
    p.click('.st-steps [data-stback]'); p.wait_for_timeout(1500)
    ok(p.locator('.st-soonpage').count() == 0, 'following nothing: Back from the end skips the page too')
    c.close()

    # ---- a laptop, in session ----
    c, p = ctx(b, 1280, 800)
    walk_to_soon(p, '&end=today')
    ok(p.locator('.st-onecard').count() == 1 and primary(p) == 'Write testimony', 'laptop: the card and the action')
    ok(noscroll(p), 'laptop: no sideways scroll')
    p.screenshot(path=os.path.join(OUT, 'laptop_today.png'))
    c.close()
    b.close()

for line in passes + fails: print(line)
for e in errors: print('ERROR', e)
print(f'\n{len(passes)} passed, {len(fails)} failed, {len(errors)} console errors')
sys.exit(1 if fails or errors else 0)
