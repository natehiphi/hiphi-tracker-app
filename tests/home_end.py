# The first visit that ends on Home (R-098, ?end=home, pub/variant.js), beside today's (?end=today).
# python3 tests/home_end.py [base_url]   (sandbox; a phone at 390x844, an iPhone SE at 375x667 and a laptop at 1440x900)
# Checks, new version: the first screen says "we'll show you" and the last part is "Your home page"; the story's last
# stage names the real moment when the bill has one; the alerts box comes right after the issues and fits the SE (R-146); the
# last step goes straight to Home (no "You're all set" screen) with "Mahalo, <name>!", the ticks, "What you can do right
# now" with the real card and its button, and issue rows that open their issue; two tips labelled "Your home page"
# (the first lights the card's real button, which works and ends the tips), Next, Done, and never again; after a reload it says Aloha and does not ask for the email again. Between sessions
# the same ending, with the hello to legislators as the thing to do. Today's version keeps its finale and gets no tips.
# ?demo=1&restart clears only the sandbox's storage. No console errors.
import os, sys
from playwright.sync_api import sync_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832/track.html'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out', 'home_end'); os.makedirs(OUT, exist_ok=True)
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
def click_text(p, sel, t):
    p.locator(sel, has_text=t).first.click()

# Walk the first visit from a restart to "Coming up". The alerts come right after the issues (R-146): an email given there
# when email is passed, else Skip. Returns what the screens said on the way.
def walk_to_soon(p, extra, email=None):
    p.goto(BASE + '?demo=1&restart' + extra); p.wait_for_selector('.st-tile', timeout=15000); p.wait_for_timeout(800)
    seen = {'first': text(p)}
    click_text(p, '.st-tile', 'Food'); p.wait_for_timeout(200)
    p.click('[data-stnext]'); p.wait_for_selector('[data-stpick]', timeout=10000); p.wait_for_timeout(800)
    p.click('[data-stnext]'); p.wait_for_selector('.st-alertspage', timeout=8000); p.wait_for_timeout(500)
    seen['alerts'] = text(p)
    seen['fit'] = p.evaluate('() => { const i = document.getElementById("st-a-phone").getBoundingClientRect(), bar = document.querySelector(".st-bar").getBoundingClientRect(); return i.bottom <= bar.top + 1; }')
    if email:
        p.click('[data-alswap="email"]'); p.wait_for_timeout(300); p.fill('#st-a-email', email); p.click('#st-send')
    else: p.click('[data-stskip]')
    p.wait_for_selector('#fx-mgo', timeout=8000); p.wait_for_timeout(300); seen['mahalo'] = text(p, '#fx-moment'); p.click('#fx-mgo')
    p.wait_for_selector('.lx-count', timeout=10000); p.wait_for_timeout(1200)
    for _ in range(2): p.click('[data-stnext]'); p.wait_for_timeout(1500)
    seen['story'] = text(p, '.lx-calm')
    p.click('[data-stnext]')   # finishing the story goes straight on to who speaks for you (R-140)
    p.wait_for_selector('[data-staddr]', timeout=10000); p.wait_for_timeout(600)
    p.click('[data-stskip]'); p.wait_for_selector('.st-soonpage', timeout=10000); p.wait_for_timeout(800)
    seen['soon'] = text(p)
    return seen

with sync_playwright() as pw:
    b = pw.chromium.launch()

    # ---- the new version, on a phone ----
    c, p = ctx(b)
    s = walk_to_soon(p, '&end=home', email='tester@example.com')
    # R-099 (10/3): the new version says how as well as when: "you'll see what to do, and we'll help you do it"
    ok('When it’s time, we help you speak up' in s['first'] and 'we’ll tell you' not in s['first'], 'new: the first screen says we help you act when it is time (said once, in the promise row)')
    ok('Your home page' in s['first'] and 'Stay connected' not in s['first'], 'new: the last part is named "Your home page"')
    ok('at one of these moments now' in s['story'] and 'top of your home page' in s['story'], f'new: the story names the real moment ({s["story"][:90]})')
    # The alerts moved to right after the issues (R-146), where they cannot read as the end of the visit.
    ok('Save your profile' in s['alerts'] and 'gets a hearing' in s['alerts'] and 'HIPHI asks people to speak up' in s['alerts'], 'new: the alerts box names both kinds of alert (C-4)')
    ok('We sent a link to tester@example.com' in s['mahalo'] and 'when you finish here' in s['mahalo'], 'new: after sending, it says to finish here first')
    ok(p.locator('#st-a-email, #st-eform').count() == 0 and p.locator('#st-name').count() == 1, 'new: Coming up asks only the optional first name')
    ok('See How I Can Help' in text(p, '.st-bar'), 'new: the last button says what Home is for, "See How I Can Help" (R-190)')
    p.fill('#st-name', 'Leilani'); p.wait_for_timeout(200)   # no Save button: Next keeps it
    p.click('[data-stnext]'); p.wait_for_selector('#main .hm-fin2', timeout=10000); p.wait_for_timeout(400)
    ok(p.evaluate('location.hash') in ('#/', ''), 'new: the last step goes straight to Home')
    home = text(p)
    ok('Mahalo, Leilani!' in home and 'This is your home page. When a bill on your issues needs you, it shows up here, and we help you speak up' in home, 'new: Home opens with "Mahalo, Leilani! This is your home page" and what it is for')
    ok('You’re all set' not in home, 'new: no "You\'re all set"')
    ok(p.locator('.hm-did li').count() >= 2, 'new: the ticks of what they did')
    ok(p.locator('.hm-rightnow .hm-rnh', has_text='What you can do right now').count() == 1, 'new: "What you can do right now"')
    ok(p.locator('.hm-rightnow .acard .btn.primary').count() >= 1, 'new: the one thing due, open, with its button')
    rows = p.eval_on_selector_all('.hm-ylist a.hm-yrow', 'as => as.map(a => a.getAttribute("href"))')
    ok(len(rows) >= 1 and all(r.startswith('#/issue/') for r in rows), f'issue rows open their issue ({len(rows)})')
    p.screenshot(path=os.path.join(OUT, 'phone_home.png'))
    p.wait_for_selector('.tr-tip', timeout=10000)
    tips = []
    for k in range(2):
        p.wait_for_timeout(500)
        tips.append(text(p, '.tr-tip'))
        r = p.eval_on_selector('.tr-tip', 'e => { const b = e.getBoundingClientRect(); return [b.top, b.bottom, innerHeight]; }')
        ok(r[0] >= 0 and r[1] <= r[2], f'new: tip {k + 1} inside the window')
        if k == 0:
            vis = p.eval_on_selector('.hm-rightnow .acard .btn.primary', 'e => { const b = e.getBoundingClientRect(), t = document.querySelector(".tr-tip").getBoundingClientRect(); return b.top >= t.bottom || b.bottom <= t.top; }')
            ok(vis, 'new: tip 1 leaves the card\'s button in view')
            ok(not p.evaluate('document.getElementById("app").inert'), 'new: tip 1\'s lit button can be used (the page is not frozen)')
            p.screenshot(path=os.path.join(OUT, 'phone_tip1.png'))
        p.click('[data-tr-next]')
    ok(all('Your home page' in t for t in tips), 'new: the tips are labelled "Your home page"')
    ok('What you can do right now' in tips[0] and 'is a real button' in tips[0] and 'Come back any time' in tips[1], 'new: the two tips in order')
    ok('Testimony due' not in tips[0], 'new: tip 1 does not repeat the card\'s deadline (A-14)')
    ok('reminder emails' in tips[1], 'new: someone who gave an email is told the emails bring them back')
    p.wait_for_timeout(500)
    ok(p.locator('[data-tour]').count() == 0 and not p.evaluate('document.getElementById("app").inert'), 'new: Done ends the tips and frees the page')
    p.reload(); p.wait_for_selector('#main .hm-fin2', timeout=10000); p.wait_for_timeout(3500)
    home2 = text(p)
    ok(p.locator('.tr-tip').count() == 0, 'new: the tips never come back')
    ok('Aloha, Leilani' in home2 and 'Mahalo' not in home2, 'new: after a reload it says Aloha')
    ok('Add your email' not in home2 and 'Welcome back' not in home2, 'the sandbox does not ask for the email again')
    c.close()

    # ---- the new version on an iPhone SE: the alerts box fits ----
    c, p = ctx(b, 375, 667)
    s = walk_to_soon(p, '&end=home')
    ok(s['fit'], 'new: on an iPhone SE the mobile number box is above the button bar')
    p.click('[data-stnext]'); p.wait_for_selector('#main .hm-fin2', timeout=10000)
    ok(p.locator('.hm-rnh').first.evaluate('e => e.getBoundingClientRect().bottom < innerHeight - 64'), 'new: on an SE "What you can do right now" is on the first screen')
    c.close()

    # ---- today's version keeps its finale and gets no tips ----
    c, p = ctx(b)
    s = walk_to_soon(p, '&end=today')
    ok('We tell you' in s['first'] and 'Stay connected' in s['first'], 'today: the first screen still promises to tell you (R-174: in its three promises)')
    ok('Save your profile' in s['alerts'] and 'Want alerts by text or email?' in s['soon'], 'today: the alerts come after the issues; Coming up has one quiet line')
    ok('We’ll show you how.' in s['story'], 'today: the story names the real moment too (a fix for both)')
    p.click('[data-stnext]'); p.wait_for_selector('.st-done', timeout=10000)
    ok('You’re all set' in text(p), 'today: the finale screen is still there')
    p.click('[data-stdone]'); p.wait_for_selector('#main .hm', timeout=10000); p.wait_for_timeout(3500)
    ok(p.locator('.tr-tip').count() == 0 and p.locator('.hm-fin2').count() == 0, 'today: Home as before, no tips')
    ok(p.locator('.hm-ylist a.hm-yrow').count() >= 1, 'today: issue rows open their issue too')
    c.close()

    # ---- the new version between sessions ----
    c, p = ctx(b)
    walk_to_soon(p, '&end=home&season=off')
    p.click('[data-stnext]'); p.wait_for_selector('#main .hm-fin2', timeout=10000); p.wait_for_timeout(400)
    off = text(p)
    ok('Mahalo for joining in!' in off and 'on break until' in off, 'off: Home opens with Mahalo and when the session opens')
    ok(p.locator('.hm-rightnow .hm-ready').count() == 1, 'off: "What you can do right now" is the hello to legislators')
    p.wait_for_selector('.tr-tip', timeout=10000)
    n, last = 0, ''
    while p.locator('.tr-tip').count() and n < 5:
        n += 1; last = text(p, '.tr-tip'); p.click('[data-tr-next]'); p.wait_for_timeout(600)
    ok(n == 2, f'off: two tips ({n})')
    ok('home screen' in last, 'off: someone who gave no email is told how to find the page again')
    c.close()

    # ---- the new version on a laptop ----
    c, p = ctx(b, 1440, 900)
    walk_to_soon(p, '&end=home')
    p.click('[data-stnext]'); p.wait_for_selector('#main .hm-fin2', timeout=10000)
    p.wait_for_selector('.tr-tip', timeout=10000); p.wait_for_timeout(500)
    for k in range(2):
        r = p.eval_on_selector('.tr-tip', 'e => { const b = e.getBoundingClientRect(); return [b.top, b.bottom, b.left, b.right, innerWidth, innerHeight]; }')
        ok(r[0] >= 0 and r[1] <= r[5] and r[2] >= 0 and r[3] <= r[4], f'laptop: tip {k + 1} inside the window')
        if k == 0: p.screenshot(path=os.path.join(OUT, 'laptop_tip1.png'))
        p.click('[data-tr-next]'); p.wait_for_timeout(600)
    c.close()

    # ---- the lit button in tip 1 works: it opens the testimony walkthrough and ends the tips ----
    c, p = ctx(b)
    walk_to_soon(p, '&end=home')
    p.click('[data-stnext]'); p.wait_for_selector('#main .hm-fin2', timeout=10000)
    t0 = p.evaluate('Date.now()'); p.wait_for_selector('.tr-tip', timeout=10000)
    waited = p.evaluate('Date.now()') - t0
    ok(waited >= 3500, f'new: the tips wait for the celebration ({waited} ms)')
    p.click('.hm-rightnow .acard .btn.primary'); p.wait_for_timeout(1200)
    ok(p.locator('[data-tour]').count() == 0, 'new: using the lit button ends the tips')
    ok(p.locator('dialog[open]').count() >= 1 or 'testimony' in p.evaluate('location.hash').lower(), 'new: and opens the testimony walkthrough')
    c.close()

    # ---- restart touches only the sandbox ----
    c, p = ctx(b)
    # A plain file on the same site, so the live page (and its counting) never loads here.
    p.goto(BASE.replace('track.html', 'pub/icon.svg')); p.wait_for_timeout(300)
    p.evaluate("localStorage.setItem('hiphi_keepme', '1'); localStorage.setItem('hiphi_wiz_demo', '{\"done\":true}')")
    p.goto(BASE + '?demo=1&restart'); p.wait_for_timeout(2500)
    keys = p.evaluate("Object.keys(localStorage)")
    ok('hiphi_keepme' in keys, 'restart: the real page\'s storage is kept')
    ok(p.evaluate("location.hash").startswith('#/start'), 'restart: the sandbox starts the first visit again')
    ok('restart' not in p.evaluate('location.search'), 'restart: the word leaves the address')
    c.close()
    b.close()

for line in passes + fails: print(line)
for e in errors: print('ERROR', e)
print(f'\n{len(passes)} passed, {len(fails)} failed, {len(errors)} console errors')
sys.exit(1 if fails or errors else 0)
