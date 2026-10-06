# One status rule for alerts (D1-4, R-180) and the endings' "Turn on alerts" (X10-4, R-180).
# python3 tests/d1_status.py [base_url]   (the practice copy; a phone at 390x844 and a laptop at 1366x900)
# The rule (pub/alerts.js alertStatus): alerts are "on" only for a number confirmed by its code, or a signed-in account
# with an email and an email choice ticked. A number kept but not yet confirmed (codes off, &codes=0), a code texted and
# not yet typed, or an email link not yet opened is "Almost set", in the alerts step's own words. Anything else is
# "Alerts are off". Checked on every screen that reports alerts: the first visit's "Mahalo!" and its ending, the version
# that ends on Home, the plans' sign-up and ending, More > Get alerts and its toast, and the profile; as a newcomer with a
# number not yet confirmed, as someone signed in with both email choices off (a stand-in sign-in, as tests/profile.py
# does), with a code still to type, and with the code typed (on). The endings' "Alerts are off" row has its own "Turn on
# alerts", which opens the same box in a sheet (the consent words, the code step), and the row then says the new status.
# Fails on the code before R-180's D1-4 and X10-4: it said "Text alerts are on", "Alerts are on", "Reminders are on" and
# "Email reminders on" for those people, and the ending had no button.
import os, re, sys
from playwright.sync_api import sync_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832/track.html'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out', 'd1_status'); os.makedirs(OUT, exist_ok=True)
passes, fails, errors = [], [], []
def ok(c, m): (passes if c else fails).append(('PASS ' if c else 'FAIL ') + m)
# Words that say alerts are on. "Turn on alerts" is a button, not a status, so it is not one of them.
ON = re.compile(r'alerts are on|alerts on\b|reminders are on|reminders on\b|you’re set\b', re.I)
PROMISE = 'We’ll text you when a bill on your issues gets a hearing, and when HIPHI asks people to speak up on them. At most one text a day.'
SIZES = [(390, 844), (1366, 900)]

def ctx(b, w=390, h=844):
    c = b.new_context(viewport={'width': w, 'height': h}, is_mobile=w < 600, has_touch=w < 600, device_scale_factor=2 if w < 600 else 1)
    p = c.new_page(); p.set_default_timeout(10000); p.on('pageerror', lambda e: errors.append(f'{w}: {e}'))
    p.on('console', lambda m: errors.append(f'console {w}: {m.text[:160]} @ {(m.location or {}).get("url", "")[-40:]}:{(m.location or {}).get("lineNumber", "")}') if m.type == 'error' and 'favicon' not in m.text else None)
    return c, p
def text(p, sel='main'):
    try: return p.inner_text(sel, timeout=3000)
    except Exception: return ''
def shot(p, name): p.screenshot(path=os.path.join(OUT, name + '.png'))
def moment(p): return p.evaluate("(() => { const m = document.getElementById('fx-moment'); return m && !m.hidden ? m.innerText : ''; })()")
# The endings' alerts row is their list's last row (on the old code too, which is how this test reads what it said).
def row(p): return text(p, '.st-did li:last-child').replace('\n', ' | ')
def sign_in(p, prefs):
    # A stand-in sign-in in the practice copy (nothing reaches Supabase, as tests/profile.py does): an account with an email,
    # these email choices and no text number on this device, then the screen drawn again (standing still).
    p.evaluate("""async prefs => { const c = await import('./pub/core.js'); localStorage.removeItem('hiphi_text');
      c.S.session = { user: { email: 'lei@example.com' } }; c.S.user = { id: 'u1', prefs, created_at: new Date().toISOString() };
      c.S.profile = { name: 'Lei', titles: [], interests: [], stories: {} }; c.S.stCalm = true; c.app.render(); c.S.stCalm = false; }""", prefs)
    p.wait_for_timeout(500)

# Each page is opened with a query that differs from the page before, so goto is a full load and no reload is needed (a
# reload right after one aborts the practice data's fetch, which logs "Failed to fetch"; CLAUDE.md, Tests).
def to_alerts(p, extra=''):
    p.goto(BASE + '?demo=1&restart' + extra); p.wait_for_selector('.st-tile', timeout=15000); p.wait_for_timeout(800)
    p.locator('.st-tile', has_text='Food').first.click(); p.wait_for_timeout(200)
    p.click('[data-stnext]'); p.wait_for_selector('[data-stpick]', timeout=10000); p.wait_for_timeout(800)
    p.click('[data-stnext]'); p.wait_for_selector('.st-alertspage', timeout=10000); p.wait_for_timeout(700)
def story_to_soon(p):
    p.wait_for_selector('.lx-count', timeout=10000); p.wait_for_timeout(1000)
    for _ in range(3): p.click('[data-stnext]'); p.wait_for_timeout(1300)
    p.wait_for_selector('[data-staddr]', timeout=10000); p.wait_for_timeout(500)
    p.click('[data-stskip]'); p.wait_for_selector('.st-soonpage', timeout=10000); p.wait_for_timeout(700)
def mahalo_on(p):
    p.wait_for_selector('#fx-mgo', timeout=8000); p.wait_for_timeout(400); m = moment(p); p.click('#fx-mgo'); return m
def to_end(p):
    story_to_soon(p); p.click('[data-stnext]'); p.wait_for_selector('.st-did', timeout=8000); p.wait_for_timeout(2300)
# A plan (Plan 5: topics, picks, the sign-up, the ending), up to its sign-up.
def to_join(p, extra=''):
    p.goto(BASE + '?demo=1&restart&ab=onb.p5' + extra)
    p.wait_for_function("() => /#\\/start\\/1/.test(location.hash) && !document.querySelector('.st [aria-busy=true]')", timeout=60000); p.wait_for_timeout(900)
    p.locator('[data-stissue]').nth(2).click(); p.click('[data-stnext]'); p.wait_for_timeout(1500)
    p.click('[data-stnext]'); p.wait_for_selector('.ob-join', timeout=10000); p.wait_for_timeout(800)

# Each scenario runs in its own browser context; one that stops (a control missing, as on the old code) is one FAIL and
# the others still run.
def run(name, fn, b, *a):
    c, p = ctx(b, *(a or (390, 844)))
    try: fn(p, *a)
    except Exception as e: ok(False, f'{name}: stopped: {str(e).splitlines()[0][:160]}')
    finally: c.close()

# ---- 1. today's first visit, a number not yet confirmed (codes off: the live page until texts are set up) ----
def s1(p, w=390, h=844):
    to_alerts(p, '&codes=0&fv=full&end=today')
    p.fill('#st-a-phone', '(808) 555-0123'); p.click('#st-send')
    m = mahalo_on(p)
    if w == 390:
        ok('Almost set. We’ll text (808) 555-0123 to confirm it’s your number.' in m and not ON.search(m) and 'Then alerts start' not in m,
           f'1 the "Mahalo!": "Almost set", in the alerts step’s words, never "alerts start": {m[:150]!r}')
    to_end(p)
    r = row(p)
    ok(r.startswith('Alerts almost set') and 'We’ll text (808) 555-0123 to confirm it’s your number.' in r and not ON.search(text(p, '.st-did')),
       f'1 {w}: the ending says "Almost set" for a number not yet confirmed, never "on": {r!r}')
    ok(p.locator('[data-alsheet]').count() == 0, f'1 {w}: no "Turn on alerts" once a number is given')
    ok('When it’s your moment, we tell you.' in text(p, '.st-next3'), f'1 {w}: "we tell you" (alerts are almost set)')
    ok(p.evaluate("document.documentElement.scrollWidth <= innerWidth + 1"), f'1 {w}: no sideways scroll')
    p.locator('.st-did li:last-child').scroll_into_view_if_needed(); shot(p, f'1_end_almost_{w}')
    # More > Get alerts, and its toast after a change of number
    p.goto(BASE + '?demo=1&codes=0&at=alerts#/alerts'); p.wait_for_timeout(2500)
    h1 = text(p, 'h1')
    ok(h1 == 'Alerts almost set' and 'We’ll text (808) 555-0123 to confirm it’s your number.' in text(p) and not ON.search(text(p)),
       f'1 {w}: More > Get alerts heads the page "Alerts almost set", not "Text alerts are on" ({h1!r})')
    shot(p, f'1_more_almost_{w}')
    p.click('[data-mr-alchange]'); p.wait_for_timeout(300); p.fill('#mr-al-phone', '808 555 0166'); p.click('#mr-al-send'); p.wait_for_timeout(700)
    ok('Almost set. We’ll text (808) 555-0166 to confirm it’s your number.' in text(p, 'body') and text(p, 'h1') == 'Alerts almost set', f'1 {w}: More: a new number, the toast and the page say "Almost set"')
    # the profile's Alerts
    p.goto(BASE + '?demo=1&codes=0&at=profile#/profile'); p.wait_for_timeout(2500)
    al = text(p, '#pf-email')
    ok('Almost set.' in al and 'We’ll text (808) ••• 0166 to confirm it’s your number.' in al and not ON.search(al), f'1 {w}: the profile’s Alerts say "Almost set": {al[:120]!r}')
    p.locator('#pf-email').scroll_into_view_if_needed(); shot(p, f'1_profile_almost_{w}')

# ---- 2. the version that ends on Home: its ticks follow the same rule ----
def s2(p, w=390, h=844):
    to_alerts(p, '&codes=0&fv=full&end=home')
    p.fill('#st-a-phone', '(808) 555-0123'); p.click('#st-send'); mahalo_on(p)
    story_to_soon(p); p.click('[data-stnext]'); p.wait_for_selector('.hm-did', timeout=10000); p.wait_for_timeout(1500)
    did = text(p, '.hm-did')
    ok('Alerts almost set' in did and not ON.search(did), f'2 Home’s ticks: "Alerts almost set", not "Text alerts on": {did!r}')
    shot(p, f'2_home_end_almost_{w}')
    sign_in(p, {'hearing_alerts': False, 'action_alerts': False})
    did = text(p, '.hm-did') if p.locator('.hm-did').count() else ''
    ok(not ON.search(did), f'2 Home’s ticks, signed in with both email choices off: no "Email reminders on": {did!r}')
    sign_in(p, {'hearing_alerts': True, 'action_alerts': False})
    did = text(p, '.hm-did') if p.locator('.hm-did').count() else ''
    ok('Email alerts on' in did, f'2 Home’s ticks, signed in with hearing alerts ticked: "Email alerts on": {did!r}')

# ---- 3. Skip: "Alerts are off" with its own "Turn on alerts", which opens the same box (X10-4) ----
def s3(p, w=390, h=844):
    to_alerts(p, '&codes=0&fv=full&end=today')
    p.click('[data-stskip]'); mahalo_on(p); to_end(p)
    r = row(p)
    btn = p.locator('.st-did li:last-child [data-alsheet]')
    ok(r.startswith('Alerts are off') and btn.count() == 1 and btn.inner_text().strip() == 'Turn on alerts' and 'in More' not in r, f'3 {w}: "Alerts are off" with its own "Turn on alerts", not also "any time in More": {r!r}')
    ok('When it’s your moment, it’s on your home page.' in text(p, '.st-next3'), f'3 {w}: no "we tell you" while alerts are off')
    ok(p.locator('.st-did .btn.primary').count() == 0, f'3 {w}: the ending keeps one primary, "Go to my home page" (A-3)')
    p.locator('.st-did li:last-child').scroll_into_view_if_needed(); shot(p, f'3_end_off_{w}')
    bb = btn.bounding_box(); ok(bb and bb['height'] >= (44 if w < 600 else 32), f'3 {w}: the button is a full target ({bb and round(bb["height"])}px)')
    btn.click(); p.wait_for_timeout(600)
    dlg = p.locator('dialog.al-sheet[open]')
    ok(dlg.count() == 1 and p.evaluate("document.activeElement.id") == 'al-sh-phone', f'3 {w}: it opens the alerts box in a sheet, the number box focused')
    t = text(p, 'dialog.al-sheet')
    ok(PROMISE in t and 'We’ll text you to confirm it’s your number. Message and data rates may apply. Reply STOP to stop, HELP for help.' in t and 'Text terms' in t and 'Privacy' in t,
       f'3 {w}: the same box: the consent words as stored (t3), the privacy and terms links')
    box = dlg.bounding_box()
    if w < 600: ok(box and abs(box['y'] + box['height'] - h) <= 2, f'3 {w}: on a phone it rises from the bottom ({box and round(box["y"])})')
    else: ok(box and abs(box['width'] - 520) <= 2 and box['y'] > 0, f'3 {w}: on a laptop it sits in the middle, 520px wide ({box and round(box["width"])})')
    shot(p, f'3_sheet_{w}')
    p.click('[data-alshno]'); p.wait_for_timeout(400)
    ok(p.locator('dialog.al-sheet[open]').count() == 0 and row(p).startswith('Alerts are off'), f'3 {w}: Not now closes it, nothing changed')
    p.locator('[data-alsheet]').click(); p.wait_for_timeout(500)
    p.click('#al-sh-send'); p.wait_for_timeout(300)
    ok('Add your mobile number' in text(p, '#al-sh-err'), f'3 {w}: the box’s own errors, in the sheet')
    p.fill('#al-sh-phone', '808.555.0188'); p.click('#al-sh-send'); p.wait_for_timeout(1500)
    r = row(p)
    ok(p.locator('dialog.al-sheet[open]').count() == 0 and r.startswith('Alerts almost set') and '(808) 555-0188' in r and not ON.search(text(p, '.st-did')),
       f'3 {w}: a number given there: the sheet closes and the row says "Almost set": {r!r}')
    ok(p.evaluate("document.activeElement.matches('[data-alrow]')"), f'3 {w}: focus goes to the row, which says the new status')
    ok('When it’s your moment, we tell you.' in text(p, '.st-next3'), f'3 {w}: "What happens next" follows it')
    ok(p.evaluate("document.querySelector('.st-done').classList.contains('st-calm') && !document.querySelector('.st-calm .st-petals')?.offsetHeight"),
       f'3 {w}: drawn again standing still (no second petals)')
    shot(p, f'3_end_after_{w}')

# ---- 3b. signed in with both email choices off, then one ticked (a stand-in sign-in) ----
def s3b(p, w=390, h=844):
    to_alerts(p, '&codes=0&fv=full&end=today')
    p.click('[data-stskip]'); mahalo_on(p); to_end(p)
    sign_in(p, {'hearing_alerts': False, 'action_alerts': False})
    r = row(p)
    ok(r.startswith('Alerts are off') and not ON.search(text(p, '.st-did')), f'3b {w}: signed in, both email choices off: "Alerts are off", not "Reminders are on": {r!r}')
    ok('When it’s your moment, it’s on your home page.' in text(p, '.st-next3'), f'3b {w}: signed in with both off: no "we tell you"')
    shot(p, f'3b_end_signedin_off_{w}')
    p.click('[data-alsheet]'); p.wait_for_timeout(500)
    lede = text(p, '.al-shlede')
    ok('Your email alerts are off.' in lede and 'too' not in lede and p.locator('.al-shlede a[href="#/profile"]').count() == 1,
       f'3b {w}: the sheet says their email alerts are off, with the way to turn them on (not "texts too"): {lede!r}')
    shot(p, f'3b_sheet_signedin_off_{w}')
    p.click('[data-alshno]'); p.wait_for_timeout(300)
    sign_in(p, {'hearing_alerts': False, 'action_alerts': True})
    ok(row(p).startswith('Email alerts are on') and 'lei@example.com' in row(p), f'3b {w}: signed in with an email choice ticked: "Email alerts are on": {row(p)!r}')

# ---- 4. codes on (the practice copy's default): a code texted, not typed; then typed ----
def s4(p, w=390, h=844):
    to_alerts(p, '&fv=full&end=today')
    p.fill('#st-a-phone', '8085550177'); p.click('#st-send'); p.wait_for_selector('#st-a-code', timeout=5000); p.wait_for_timeout(300)
    p.click('[data-stskip]'); mahalo_on(p); to_end(p)
    r = row(p)
    ok(r.startswith('Alerts almost set') and 'We texted a code to (808) 555-0177.' in r and 'Enter the code' in r,
       f'4 {w}: a code texted and not typed: "Alerts almost set", which phone, and "Enter the code": {r!r}')
    p.locator('.st-did li:last-child').scroll_into_view_if_needed(); shot(p, f'4_end_code_{w}')
    p.click('[data-alsheet]'); p.wait_for_timeout(600)
    ok(p.locator('dialog.al-sheet[open] #al-sh-code').count() == 1 and 'Check your texts' in text(p, 'dialog.al-sheet') and '(808) 555-0177' in text(p, 'dialog.al-sheet'),
       f'4 {w}: the sheet opens at the code step, for the number given')
    shot(p, f'4_sheet_code_{w}')
    p.fill('#al-sh-code', '123456'); p.wait_for_timeout(1800)
    r = row(p)
    ok(r.startswith('Text alerts are on') and '(808) 555-0177' in r and p.locator('[data-alsheet]').count() == 0, f'4 {w}: the code typed: "Text alerts are on" (confirmed is on): {r!r}')
    shot(p, f'4_end_on_{w}')
    p.goto(BASE + '?demo=1&at=alerts#/alerts'); p.wait_for_timeout(2500)
    ok(text(p, 'h1') == 'Text alerts are on', f'4 {w}: More > Get alerts: confirmed is "Text alerts are on"')

# ---- 5. the plans' sign-up and ending ----
def s5(p, w=390, h=844):
    to_join(p, '&codes=0')
    p.fill('#st-a-phone', '(808) 555-0123'); p.click('#st-send')
    m = mahalo_on(p)
    if w == 390: ok('We’ll text (808) 555-0123 to confirm it’s your number.' in m and not ON.search(m), f'5 the plans’ "Mahalo!": not "You’re set" before the number is confirmed: {m[:140]!r}')
    p.wait_for_selector('.ob-wrap', timeout=10000); p.wait_for_timeout(2300)
    r = row(p)
    ok(r.startswith('Alerts almost set') and not ON.search(text(p, '.st-did')), f'5 {w}: the plans’ ending: "Almost set": {r!r}')
    p.locator('.st-did li:last-child').scroll_into_view_if_needed(); shot(p, f'5_wrap_almost_{w}')
    p.click('[data-stback]'); p.wait_for_selector('.ob-join', timeout=8000); p.wait_for_timeout(800)
    ok(text(p, '#st-h') == 'Almost set' and not ON.search(text(p, 'main')), f'5 {w}: Back on the sign-up: "Almost set", not "You’re set" ({text(p, "#st-h")!r})')
    shot(p, f'5_join_almost_{w}')
# "Not now" on the plans' sign-up: the ending's "Turn on alerts", with codes on; then signed in with both choices off.
def s5b(p, w=390, h=844):
    to_join(p)
    p.click('.ob-joinbtns [data-stskip]'); p.wait_for_timeout(900)
    if moment(p): p.click('#fx-mgo')
    p.wait_for_selector('.ob-wrap', timeout=10000); p.wait_for_timeout(2300)
    r = row(p)
    ok(r.startswith('Alerts are off') and p.locator('.st-did li:last-child [data-alsheet]').count() == 1, f'5b {w}: the plans’ ending: "Alerts are off" with "Turn on alerts": {r!r}')
    p.locator('.st-did li:last-child').scroll_into_view_if_needed(); shot(p, f'5b_wrap_off_{w}')
    p.click('[data-alsheet]'); p.wait_for_timeout(500)
    p.fill('#al-sh-phone', '(808) 555-0199'); p.click('#al-sh-send'); p.wait_for_selector('#al-sh-code', timeout=5000)
    p.fill('#al-sh-code', '654321'); p.wait_for_timeout(1800)
    ok(row(p).startswith('Text alerts are on'), f'5b {w}: the code typed in the sheet: "Text alerts are on": {row(p)!r}')
    sign_in(p, {'hearing_alerts': False, 'action_alerts': False})
    ok(row(p).startswith('Alerts are off') and not ON.search(text(p, '.st-did')), f'5b {w}: the plans’ ending signed in, both choices off: "Alerts are off", not "Alerts are on": {row(p)!r}')

with sync_playwright() as pw:
    b = pw.chromium.launch()
    for w, h in SIZES:
        for name, fn in (('1', s1), ('3', s3), ('3b', s3b), ('4', s4), ('5', s5), ('5b', s5b)): run(f'{name} {w}', fn, b, w, h)
    run('2', s2, b, 390, 844)
    b.close()

ok(not errors, 'no page or console errors' + ('' if not errors else ': ' + ' | '.join(errors[:4])))
print('\n'.join(passes + fails)); print(f'\n{len(passes)} passed, {len(fails)} failed')
sys.exit(1 if fails else 0)
