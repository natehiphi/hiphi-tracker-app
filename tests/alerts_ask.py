# The alerts ask, phone first, right after the issues (R-146, Nate 10/4).
# python3 tests/alerts_ask.py [base_url]   (sandbox; a phone at 390x844, an iPhone SE at 375x667 and a laptop at 1440x900)
# Checks: the first visit goes topics -> issues -> "Get alerts on your N issues" -> the "Mahalo!" -> the story; the box is
# a mobile number first with the consent words (frequency, rates, STOP, HELP) and "Prefer email?" under it, and fits the
# first screen of an iPhone SE; errors show only on Text me; a number given plays the "Mahalo!" naming it, then the story;
# Back shows "You're set" with a way to change it and no second "Mahalo!"; "Coming up on your issues" no longer asks; the
# finale says "Almost set" (the number is not confirmed yet: D1-4, R-180; tests/d1_status.py checks the rule everywhere).
# Email: the swap, "Email me", the "Mahalo!" says where the link went, the finale's row.
# Skip: the "Mahalo!" with the bills line, the quiet line on Coming up. Between sessions: the January line. A visit from
# a shared bill: Follow on the bill (its own "Mahalo!") -> the alerts screen -> the story, no second "Mahalo!". Home's card after a skipped first
# visit, on the next load: the phone box, "You're set" after, nothing on the load after. More: "Get alerts" -> the page ->
# "Alerts almost set" -> Change number -> Stop texts (Undo) -> the box again. The privacy page names numbers. Nothing
# reaches the database (the sandbox). No console errors.
# Every page here is the box before codes are on (&codes=0: the live page until texts are set up), whose small print says
# the number will be confirmed by text, never "reply YES" (R-176). The code step is tests/phone_signin.py's.
import os, sys
from playwright.sync_api import sync_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832/track.html'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out', 'alerts_ask'); os.makedirs(OUT, exist_ok=True)
passes, fails, errors = [], [], []
def ok(c, m): (passes if c else fails).append(('PASS ' if c else 'FAIL ') + m)

def ctx(b, w=390, h=844):
    c = b.new_context(viewport={'width': w, 'height': h}, is_mobile=w < 600, has_touch=w < 600, device_scale_factor=2 if w < 600 else 1)
    p = c.new_page(); p.on('pageerror', lambda e: errors.append(f'{w}: {e}'))
    p.on('console', lambda m: errors.append(f'console {w}: {m.text[:160]}') if m.type == 'error' and 'favicon' not in m.text else None)
    return c, p
def text(p, sel='main'):
    try: return p.inner_text(sel, timeout=3000)
    except Exception: return ''
def shot(p, name): p.screenshot(path=os.path.join(OUT, name + '.png'))
def moment(p):
    return p.evaluate("(() => { const m = document.getElementById('fx-moment'); return m && !m.hidden ? m.innerText : ''; })()")

# From a restart to the alerts screen (topic Food, HIPHI's ticked issues followed).
def to_alerts(p, extra=''):
    p.goto(BASE + '?demo=1&codes=0&restart' + extra); p.wait_for_selector('.st-tile', timeout=15000); p.wait_for_timeout(800)
    p.locator('.st-tile', has_text='Food').first.click(); p.wait_for_timeout(200)
    p.click('[data-stnext]'); p.wait_for_selector('[data-stpick]', timeout=10000); p.wait_for_timeout(800)
    p.click('[data-stnext]'); p.wait_for_selector('.st-alertspage', timeout=10000); p.wait_for_timeout(700)
# From the story's first page to Coming up (skipping the address).
def story_to_soon(p):
    p.wait_for_selector('.lx-count', timeout=10000); p.wait_for_timeout(1000)
    for _ in range(3): p.click('[data-stnext]'); p.wait_for_timeout(1300)
    p.wait_for_selector('[data-staddr]', timeout=10000); p.wait_for_timeout(500)
    p.click('[data-stskip]'); p.wait_for_selector('.st-soonpage', timeout=10000); p.wait_for_timeout(700)

with sync_playwright() as pw:
    b = pw.chromium.launch()

    # ---- 1. a number, on a phone ----
    c, p = ctx(b)
    to_alerts(p, '&fv=full&end=today')
    t = text(p)
    ok(p.url.endswith('#/start/3'), f'the alerts screen is the third step, right after the issues ({p.url[-10:]})')
    ok(moment(p) == '', 'no "Mahalo!" before the alerts screen')
    ok(p.inner_text('#st-h') == 'Save your profile' and 'At a hearing, lawmakers hear from the public' in text(p, '.st-alertspage .lede'), f'the heading asks to save the profile, and the line says what a hearing is (R-184): {p.inner_text("#st-h")}')
    ok(p.locator('#st-a-phone').count() == 1 and p.locator('#st-a-email').count() == 0, 'the mobile number box comes first, alone')
    ok(all(w in t for w in ['gets a hearing', 'HIPHI asks people to speak up', 'At most one text a day', 'We’ll text you to confirm it’s your number', 'Message and data rates may apply', 'Reply STOP to stop', 'HELP for help']) and 'YES' not in t, 'the consent words: what arrives, how often, the confirming text (no YES, R-176), rates, STOP, HELP')
    ok('At a hearing, lawmakers hear from the public' in t, 'the lede says what a hearing is (the story comes after this screen)')
    ok(p.evaluate("(() => { const i = document.getElementById('st-a-phone'), h = document.getElementById('st-a-hint'); return !!h && h.getBoundingClientRect().top > i.getBoundingClientRect().bottom && h.getBoundingClientRect().top - i.getBoundingClientRect().bottom < 40 && i.getAttribute('aria-describedby') === 'st-a-hint'; })()"), 'the privacy line sits right under the box, and the box points to it')
    ok('Use email instead' in t, 'email is a link under the box')
    ok('never see your number' in t, 'it says staff never see the number')
    ok(p.locator('.st-bar button', has_text='Text me').count() == 1 and p.locator('[data-stskip]').count() == 1, 'the bar: Skip and Text me')
    ok(p.evaluate("getComputedStyle(document.querySelector('.st-chapters li.on')).fontWeight >= 600 && document.querySelector('.st-chapters li.on').innerText.includes('Your issues')"), 'it is still the "Your issues" part')
    shot(p, '1_alerts_phone')
    p.click('#st-send'); p.wait_for_timeout(300)
    ok('Add your mobile number' in text(p, '#st-a-err'), 'Text me with nothing typed says what to do')
    p.fill('#st-a-phone', '555-0123'); p.wait_for_timeout(100)
    ok(text(p, '#st-a-err').strip() == '', 'typing clears the message (C-9)')
    p.click('#st-send'); p.wait_for_timeout(300)
    ok('10-digit' in text(p, '#st-a-err') and p.get_attribute('#st-a-phone', 'aria-invalid') == 'true', 'a short number: the 10-digit message, marked invalid')
    p.fill('#st-a-phone', '808.555.0123'); p.click('#st-send'); p.wait_for_selector('#fx-mgo', timeout=5000); p.wait_for_timeout(1800)   # settled, for the screenshot
    m = moment(p)
    ok('Mahalo!' in m and 'following' in m and 'We’ll text (808) 555-0123 to confirm it’s your number' in m and 'YES' not in m, f'the "Mahalo!" celebrates both, and says a text will confirm the number: {m[:140]!r}')
    ok('Next: How a Bill Becomes Law' in m, 'its button names what comes next (C-6), not "Continue", in title case (R-186)')
    shot(p, '1b_mahalo')
    saved = p.evaluate("localStorage.getItem('hiphi_text')")
    ok(saved and '8085550123' in saved, 'this browser keeps the number (the sandbox copy)')
    p.click('#fx-mgo'); p.wait_for_selector('.lx-count', timeout=10000); p.wait_for_timeout(600)
    ok(p.url.endswith('#/start/4'), 'Continue goes on to the story')
    p.click('[data-stback]'); p.wait_for_timeout(1200)
    t = text(p)
    ok(p.url.endswith('#/start/3') and 'We’ll text (808) 555-0123 to confirm it’s your number.' in t and 'Use a different number' in t and 'You’re almost set' in p.inner_text('#st-h'), 'Back: "almost set" (the confirming text is still to come), with a way to change it')
    ok(p.locator('.st-bar button', has_text='Next').count() == 1, 'Back: the bar says Next')
    shot(p, '1c_back_set')
    p.click('[data-stnext]'); p.wait_for_timeout(900)
    ok(moment(p) == '' and p.url.endswith('#/start/4'), 'Next from there: the story again, no second "Mahalo!"')
    story_to_soon(p)
    ok(p.locator('#st-a-phone, #st-eform, #st-email').count() == 0 and 'Want alerts' not in text(p), 'Coming up asks nothing (the number was given)')
    shot(p, '1d_soon')
    p.click('[data-stnext]'); p.wait_for_selector('.st-did', timeout=8000); p.wait_for_timeout(600)
    # D1-4 (R-180): a number not yet confirmed is "Almost set", never "on" (it said "Text alerts are on").
    ok('Alerts almost set' in text(p, '.st-did') and 'We’ll text (808) 555-0123 to confirm it’s your number.' in text(p, '.st-did') and 'alerts are on' not in text(p, '.st-did').lower(), 'the finale: "Alerts almost set" (not "Text alerts are on")')
    c.close()

    # ---- 2. email instead ----
    c, p = ctx(b)
    to_alerts(p, '&fv=full&end=today')
    p.click('[data-alswap="email"]'); p.wait_for_selector('#st-a-email', timeout=3000); p.wait_for_timeout(200)
    t = text(p)
    ok(p.evaluate("document.activeElement.id") == 'st-a-email', 'the email box takes the focus')
    ok('We’ll email you when a bill on your issues gets a hearing' in t and 'At most one email a day' in t and 'Text me instead' in t, 'the email words, and the way back to texts')
    ok(p.locator('.st-bar button', has_text='Email me').count() == 1, 'the button says Email me')
    shot(p, '2_alerts_email')
    p.fill('#st-a-email', 'leilani@example'); p.click('#st-send'); p.wait_for_timeout(300)
    ok('name@example.com' in text(p, '#st-a-err'), 'an unfinished email says so')
    p.fill('#st-a-email', 'leilani@example.com'); p.click('#st-send'); p.wait_for_selector('#fx-mgo', timeout=5000); p.wait_for_timeout(400)
    m = moment(p)
    ok('We sent a link to leilani@example.com' in m and 'when you finish here' in m, f'the "Mahalo!" says where the link went and to finish first (C-6): {m[:140]!r}')
    p.click('#fx-mgo'); story_to_soon(p)
    p.click('[data-stnext]'); p.wait_for_selector('.st-did', timeout=8000); p.wait_for_timeout(500)
    ok('Alerts almost set' in text(p, '.st-did') and 'Tap the link we sent to leilani@example.com to turn on alerts.' in text(p, '.st-did'), 'the finale: "Almost set", tap the link (it said "Reminders: one tap to go")')
    c.close()

    # ---- 3. Skip ----
    c, p = ctx(b)
    to_alerts(p, '&fv=full&end=today')
    p.click('[data-stskip]'); p.wait_for_selector('#fx-mgo', timeout=5000); p.wait_for_timeout(400)
    m = moment(p)
    ok('Mahalo!' in m and 'text' not in m.lower() and 'bill' in m, f'Skip: the "Mahalo!" for the issues, with the bills line: {m[:120]!r}')
    p.click('#fx-mgo'); story_to_soon(p)
    ok('Want alerts by text or email?' in text(p) and p.locator('#st-a-phone').count() == 0, 'Coming up: one quiet line, no second ask')
    p.click('[data-stnext]'); p.wait_for_selector('.st-did', timeout=8000); p.wait_for_timeout(400)
    ok('Alerts are off' in text(p, '.st-did') and p.locator('.st-did [data-alsheet]', has_text='Turn on alerts').count() == 1, 'the finale: "Alerts are off", with its own "Turn on alerts" (X10-4)')
    p.click('[data-stdone]'); p.wait_for_timeout(1500)
    # Home on the next load asks once, with the same box.
    p.reload(); p.wait_for_timeout(2500)
    ok(p.locator('.nudgecard #ng-phone').count() == 1 and p.locator('.nudgecard button', has_text='Text me').count() == 1, 'Home, next load: the ask is the phone box')
    ok('Use email instead' in text(p, '.nudgecard') and 'never see your number' in text(p, '.nudgecard'), 'Home: email is a link under it, and the privacy line is there too')
    p.locator('.nudgecard').scroll_into_view_if_needed(); shot(p, '3_home_card')
    p.fill('#ng-phone', '(808) 555-0144'); p.locator('.nudgecard button', has_text='Text me').click(); p.wait_for_timeout(800)
    ok('We’ll text (808) 555-0144 to confirm it’s your number' in text(p, '.nudgecard'), 'Home: "almost set" in the card')
    p.reload(); p.wait_for_timeout(2500)
    ok(p.locator('.nudgecard form').count() == 0, 'Home, the load after: no ask (a number was given)')
    c.close()

    # ---- 4. between sessions ----
    c, p = ctx(b)
    to_alerts(p, '&season=off&fv=full&end=today')
    ok('Their new bills start in January' in text(p), 'between sessions: the January line')
    c.close()

    # ---- 5. a visit from a shared bill ----
    c, p = ctx(b)
    p.goto(BASE + '?demo=1&codes=0&restart&fv=full&end=today#/bill/HB2121'); p.wait_for_selector('[data-bl-newfollow]', timeout=15000); p.wait_for_timeout(800)
    p.locator('[data-bl-newfollow]').first.click(); p.wait_for_selector('#fx-mgo', timeout=8000); p.wait_for_timeout(400)
    p.click('#fx-mgo'); p.wait_for_timeout(2000)
    ok(p.locator('.st-alertspage').count() == 1, f'from a shared bill: the alerts screen comes right after "Follow this issue?" ({p.url[-10:]})')
    p.fill('#st-a-phone', '8085550155'); p.click('#st-send'); p.wait_for_timeout(1500)
    ok(moment(p) == '' and p.locator('.lx-count, .st-lessonpage, .st-voicepage').count() >= 1, f'from a shared bill: no second "Mahalo!", straight on to the story ({p.url[-10:]})')
    c.close()

    # ---- 6. More > Get alerts ----
    c, p = ctx(b)
    p.goto(BASE + '?demo=1&codes=0&restart#/more'); p.wait_for_timeout(2500)
    # R-147 (10/4): More's first row is the person; without a number or email it invites them to make a profile with the same box.
    ok(p.locator('a.mr-me[href="#/profile"]', has_text='Get alerts and make your profile').count() == 1, 'More: "Get alerts and make your profile" is the first row (R-147, X10-4)')
    p.goto(BASE + '?demo=1&codes=0#/alerts'); p.wait_for_timeout(1500)
    t = text(p)
    ok('Get alerts on your issues' in t and p.locator('#mr-al-phone').count() == 1 and p.locator('a.al-swap[href="#/signin"]').count() == 1, 'the page: the phone box, email to the sign-in page')
    shot(p, '6_more_alerts')
    p.fill('#mr-al-phone', '808 555 0166'); p.click('#mr-al-send'); p.wait_for_timeout(800)
    t = text(p)
    ok(p.inner_text('h1') == 'Alerts almost set' and 'We’ll text (808) 555-0166 to confirm it’s your number.' in t and 'Stop texts' in t and 'alerts are on' not in t.lower(), 'given: "Almost set" (not "Text alerts are on") with Change number and Stop texts')
    shot(p, '6b_more_on')
    p.click('[data-mr-alchange]'); p.wait_for_timeout(400)
    ok(p.input_value('#mr-al-phone') == '(808) 555-0166' and 'Change your number' in text(p), 'Change number: the box with the number in it')
    p.click('[data-mr-alcancel]'); p.wait_for_timeout(300)
    p.click('[data-mr-alstop]'); p.wait_for_timeout(800)
    ok(p.locator('#mr-al-phone').count() == 1 and 'Texts stopped' in text(p, 'body'), 'Stop texts: the box again, and a toast')
    undo = p.locator('button', has_text='Undo')
    if undo.count(): undo.first.click(); p.wait_for_timeout(800)
    ok(p.inner_text('h1') == 'Alerts almost set' and '(808) 555-0166' in text(p), 'Undo: the number is back, almost set again')
    p.goto(BASE + '?demo=1&codes=0#/more'); p.wait_for_timeout(1200)
    ok(p.locator('a.mr-me[href="#/profile"]', has_text='Your profile').count() == 1, 'More: with a number, the first row is the profile (R-147)')
    p.goto(BASE + '?demo=1&codes=0#/profile'); p.wait_for_timeout(1200)
    ok('(808) ••• 0166' in text(p) and p.locator('#pf-email a[href="#/signin"]').count() == 1, 'the profile: texts on (the number masked), and email still offered')
    p.goto(BASE + '?demo=1&codes=0#/privacy'); p.wait_for_timeout(1200)
    ok('If you add your mobile number' in text(p) and 'never see your text-alert number' in text(p) and 'left out of HIPHI' in text(p), 'the privacy page names numbers')
    c.close()

    # ---- 7. an iPhone SE: the box and Text me on the first screen ----
    c, p = ctx(b, 375, 667)
    to_alerts(p, '&fv=full&end=today')
    fit = p.evaluate("""(() => { const i = document.getElementById('st-a-phone').getBoundingClientRect(), bar = document.querySelector('.st-bar').getBoundingClientRect();
      return { input: Math.round(i.bottom), bar: Math.round(bar.top) }; })()""")
    ok(fit['input'] < fit['bar'], f'iPhone SE: the number box is above the bar without scrolling ({fit})')
    shot(p, '7_se')
    c.close()

    # ---- 8. a laptop ----
    c, p = ctx(b, 1440, 900)
    to_alerts(p, '&fv=full&end=today')
    shot(p, '8_laptop')
    ok(p.locator('#st-a-phone').is_visible(), 'laptop: the box shows')
    c.close()
    b.close()

ok(not errors, 'no console errors' + ('' if not errors else ': ' + ' | '.join(errors[:4])))
print('\n'.join(passes + fails)); print(f'\n{len(passes)} passed, {len(fails)} failed')
sys.exit(1 if fails else 0)
