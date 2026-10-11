# "Coming up on your issues" (R-098, Nate 10/5: "not prominent and looks like it should be skipped"; R-135's unlabelled
# dates), pub/start-rest.js stepSoon. The page is the first visit's "Stay connected" step, before the last screen (today's
# ending) or Home (the ending on Home).
# python3 tests/coming_up.py [base_url]   (sandbox; a phone at 390x844 and a laptop at 1280x800)
# Checks, in session: the heading is a real h1 in the page's heading face; each item is a card that is a link to its bill
# (#/bill/...), and the bill's nickname is its name; every date sits under its label ("Testimony due", "Hearing") with its
# day in words; the one button (Write testimony, when testimony cannot wait) is the secondary kind, never a primary, and
# the page has one primary button (Next); the card is in the top of the phone screen (A-1). With nothing set this week
# (the topic "Getting Around" in the practice copy), one honest line in the place of the list, no cards.
# Between sessions (&season=off): the honest line in the place of the list ("Nothing is scheduled yet ...", late January),
# the day the session opens labelled "Opens", and last session's issues below, each linking to its issue.
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
    p.wait_for_selector('#fx-mgo', timeout=8000); p.wait_for_timeout(300); p.click('#fx-mgo')
    p.wait_for_selector('.lx-count', timeout=10000); p.wait_for_timeout(1200)
    for _ in range(2): p.click('[data-stnext]'); p.wait_for_timeout(1500)
    p.click('[data-stnext]')
    p.wait_for_selector('[data-staddr]', timeout=10000); p.wait_for_timeout(600)
    p.click('[data-stskip]'); p.wait_for_selector('.st-soonpage', timeout=10000); p.wait_for_timeout(1000)

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
    links = p.eval_on_selector_all('.st-cu-go', 'as => as.map(a => [a.tagName, a.getAttribute("href") || ""])')
    ok(len(links) == p.locator('.st-cu').count() and all(t == 'A' and h.startswith('#/bill/') for t, h in links), f'each item opens its bill: {links}')
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

    # ---- the ending on Home: the same page, its button still says where it goes ----
    c, p = ctx(b)
    walk_to_soon(p, '&end=home')
    ok(p.locator('.st-cu').count() >= 1 and 'Coming up on your issues' == p.inner_text('#st-h'), 'ending on Home: the same coming-up page')
    ok(p.locator('.st-bar .btn.primary', has_text='See How I Can Help').count() == 1, 'ending on Home: the button still says "See How I Can Help" (B-14)')
    c.close()

    # ---- between sessions: the honest line in the place of the list, the session date labelled ----
    c, p = ctx(b)
    walk_to_soon(p, '&end=today&season=off')
    t = text(p)
    ok('Your issues, this year and next' == p.inner_text('#st-h'), 'between sessions: its heading')
    ok(p.locator('.st-nothing').count() == 1 and 'Nothing is scheduled yet on your issues. Hearings start in late January; we’ll show them here.' in text(p, '.st-nothing'), 'between sessions: one honest line in the place of the list')
    off_dates = p.eval_on_selector_all('.st-cu-dates > div dt', 'ds => ds.map(d => d.innerText)')
    ok('Opens' in off_dates, f'between sessions: the day the session opens is labelled ({off_dates})')
    ok(p.locator('.st-cu-go[href^="#/issue/"]').count() >= 1, 'between sessions: last session\'s issues open their issue')
    ok(all(lbl.startswith('In 20') or lbl == 'Opens' for lbl in off_dates), 'between sessions: each date is labelled')
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
