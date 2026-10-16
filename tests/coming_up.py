# "Coming up on your issues" (R-098, Nate 10/5: "not prominent and looks like it should be skipped"; R-135's unlabelled
# dates), pub/start-rest.js stepSoon. The page is the first visit's "Stay connected" step, before the last screen (today's
# ending) or Home (the ending on Home).
# python3 tests/coming_up.py [base_url]   (sandbox; a phone at 390x844 and a laptop at 1280x800)
# Checks, in session: the heading is a real h1 in the page's heading face; each item is a plain card that opens nothing
# (R-247, Nate 10/11: a card that opened its bill left the first visit with no way back), and the bill's nickname is its name; every date sits under its label ("Testimony due", "Hearing") with its
# day in words; the one button (Write testimony, when testimony cannot wait) is the secondary kind, never a primary, and
# the page has one primary button (Next); the card is in the top of the phone screen (A-1). With nothing set this week
# (the topic "Getting Around" in the practice copy), one honest line in the place of the list, no cards.
# Between sessions (&season=off): no blue "Nothing is scheduled yet" box above the cards (R-247's review: it outranked them);
# the session's card leads and says hearings start in late January; the day the session opens labelled "Opens", and last session's issues below, labelled "What happened", all plain cards
# (R-247: tapping one stays on the page); the session date said once (R-098, 10/10).
# No console errors.
import os, sys
from playwright.sync_api import sync_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832/track.html'
if not BASE.split('?')[0].split('#')[0].endswith('.html'): BASE = BASE.rstrip('/') + '/track.html'   # a server root works too, like the other tests take (R-287)
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
    # the story's two choices since R-255 (Nate 10/12): the first choice on each, then Next, which sleeps until a choice is made
    for _ in range(2): p.click('.lx-doors [data-lx-pick]'); p.wait_for_timeout(900); p.click('[data-stnext]'); p.wait_for_timeout(1300)
    # the story hands straight on to Coming up (R-232: the address step left the first visit)
    p.wait_for_selector('.st-soonpage', timeout=10000); p.wait_for_timeout(1000)

DATE_LABELS = ('Testimony due', 'Hearing')

with sync_playwright() as pw:
    b = pw.chromium.launch()

    # ---- in session, today's ending, a phone ----
    c, p = ctx(b)
    walk_to_soon(p, '&end=today')
    h = p.locator('#st-h')
    ok(h.evaluate('e => e.tagName') == 'H1' and 'Coming up on your issues' == h.inner_text(), 'heading: a real h1 that says "Coming up on your issues"')
    ok(h.evaluate('e => getComputedStyle(e).fontFamily').startswith('Poppins'), 'heading: the page\'s heading face (A-19)')
    ok(p.locator('.st-soon li.st-cu').count() >= 1, 'items: each one is a card in the list')
    ok(p.locator('.st-soon a').count() == 0 and p.locator('li.st-cu').evaluate_all('es => es.every(e => getComputedStyle(e).boxShadow === "none")'), 'each item is a plain card that opens nothing, so the first visit cannot be left from here (R-247)')
    names = p.eval_on_selector_all('.st-cu-name', 'es => es.map(e => e.innerText)')
    ok(names and all(n.strip() for n in names), f'each item is named by its bill: {names}')
    ok(p.locator('.st-cu-name').first.evaluate('e => getComputedStyle(e).fontFamily').startswith('Poppins'), 'the bill name is in the heading face (A-19)')
    dates = p.eval_on_selector_all('.st-cu-dates > div', 'ds => ds.map(d => [d.querySelector("dt").innerText, d.querySelector("dd").innerText])')
    ok(dates and all(lbl in DATE_LABELS for lbl, _ in dates), f'every date is labelled "Testimony due" or "Hearing": {dates}')
    ok(all(any(w in v for w in ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday')) and ' at ' in v for _, v in dates), 'every date says its day in words and its time')
    ok(not any(len(v.split()) < 4 for _, v in dates), 'no bare weekday or day beside a label (R-135: "Fri" next to "Testimony due Wed")')
    ok(p.locator('.st-cu-act .btn.secondary').count() == p.locator('.st-cu-act .btn').count() == 1, 'the one button is the secondary kind (A-3: a clear button, not a link)')
    ok(p.locator('.st-cu-act .btn.primary').count() == 0, 'no primary button on a card (the page keeps one primary, Next)')
    ok(p.locator('.st-bar .btn.primary').count() == 1, 'the page has one primary button, in the bar')
    first_top = p.locator('.st-cu').first.evaluate('e => e.getBoundingClientRect().top')
    ok(first_top < 844 * 0.7, f'the first card is in the top of the phone screen ({int(first_top)}px, A-1)')
    ok(p.eval_on_selector_all('.st-cu-dates dt', 'ds => ds.every(d => getComputedStyle(d).color === getComputedStyle(d.closest(".st-cu").querySelector(".st-cu-go")).color)'),
       'in session: the date labels are neutral text, not blue (A-5)')
    ok(p.locator('.st-nothing').count() == 0, 'with items, no honest line')
    p.screenshot(path=os.path.join(OUT, 'phone_today.png'))
    # The card's bill opens; the walkthrough's button opens the testimony walkthrough.
    ok(p.locator('.st-cu-act button').count() == 1, 'a due-soon testimony gets its one button')
    c.close()

    # ---- in session, nothing set this week: one honest line, no cards ----
    c, p = ctx(b)
    walk_to_soon(p, '&end=today', topic='Getting Around')
    ok(p.locator('.st-cu').count() == 0, 'nothing set: no empty cards')
    ok(p.locator('.st-nothing').count() == 1 and 'Nothing is set on your issues this week yet.' in text(p, '.st-nothing'), 'nothing set: one honest line in the place of the list')
    ok(p.locator('.st-nothing').first.evaluate('e => e.getBoundingClientRect().height') >= 48, 'nothing set: the line is a card, not a skipped line')
    c.close()

    # ---- the ending on Home skips this page (R-293, Nate 10/15): Home already shows each bill under "What you can do right now" ----
    c, p = ctx(b)
    try: walk_to_soon(p, '&end=home'); reached = True
    except Exception: reached = False
    ok(not reached and p.locator('.st-soonpage').count() == 0 and p.locator('#main .hm').count() == 1, 'ending on Home: the story goes straight to Home, not to this page')
    c.close()

    # ---- between sessions: the honest line in the place of the list, the session date labelled ----
    c, p = ctx(b)
    walk_to_soon(p, '&end=today&season=off')
    t = text(p)
    ok('Your issues, this year and next' == p.inner_text('#st-h'), 'between sessions: its heading')
    ok(p.locator('.st-nothing').count() == 0, 'between sessions: no "nothing" box above the cards (it outranked them, A-13)')
    ok('Hearings start in late January; we’ll show them on your home page.' in p.locator('.st-cu').first.inner_text(), 'between sessions: the session card leads and says when hearings start')
    off_dates = p.eval_on_selector_all('.st-cu-dates > div dt', 'ds => ds.map(d => d.innerText)')
    ok('Opens' in off_dates, f'between sessions: the day the session opens is labelled ({off_dates})')
    ok(p.locator('.st-cu').count() >= 2 and p.locator('.st-soon a').count() == 0, 'between sessions: last session\'s issues are shown, and open nothing (R-247)')
    p.locator('.st-cu').nth(1).click(); p.wait_for_timeout(400)
    ok('#/start/' in p.url, f'between sessions: tapping an issue card stays in the first visit (R-247): {p.url}')
    ok(all(lbl in ('Opens', 'What happened') for lbl in off_dates), f'between sessions: each date is labelled "Opens" or "What happened" ({off_dates})')
    # R-098 (10/10): the label is not the year above a sentence that starts with the year (it read "In 2026" / "In 2026 it...")
    pairs = p.eval_on_selector_all('.st-cu-dates > div', 'ds => ds.map(d => [d.querySelector("dt").innerText, d.querySelector("dd").innerText])')
    ok(not any(l.startswith('In 20') and v.startswith('In 20') for l, v in pairs), 'between sessions: no "In 2026" label above a sentence that starts "In 2026"')
    ok(all('January 20' not in v for l, v in pairs if l != 'Opens') and text(p).count('January 20') == 1, 'between sessions: the session date is said once, on the session card, not on every card')
    ok(p.locator('li.st-cu a').count() == 0, 'between sessions: every card opens nothing, so none is a link')
    ok(p.locator('li.st-cu').evaluate_all('es => es.every(e => getComputedStyle(e).boxShadow === "none")'), 'between sessions: the plain cards have no shadow of a tappable card')
    ok(p.eval_on_selector_all('.st-cu-dates dt', 'ds => ds.every(d => getComputedStyle(d).color === getComputedStyle(d.closest(".st-cu").querySelector(".st-cu-go")).color)'),
       'between sessions: the date labels are neutral text, not blue (A-5)')
    p.screenshot(path=os.path.join(OUT, 'phone_off.png'))
    c.close()

    # ---- a laptop, in session ----
    c, p = ctx(b, 1280, 800)
    walk_to_soon(p, '&end=today')
    ok(p.locator('.st-cu').count() >= 1 and p.locator('#st-h').evaluate('e => e.tagName') == 'H1', 'laptop: the heading and the cards')
    p.screenshot(path=os.path.join(OUT, 'laptop_today.png'))
    c.close()
    b.close()

for line in passes + fails: print(line)
for e in errors: print('ERROR', e)
print(f'\n{len(passes)} passed, {len(fails)} failed, {len(errors)} console errors')
sys.exit(1 if fails or errors else 0)
