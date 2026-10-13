# The alerts ask, phone first, right after the issues (R-146, Nate 10/4).
# python3 tests/alerts_ask.py [base_url]   (sandbox; a phone at 390x844, an iPhone SE at 375x667 and a laptop at 1440x900)
# Checks: the first visit goes topics -> issues -> "Get alerts on your N issues" -> the "Mahalo!" page -> the story; the box
# is a mobile number first with the consent words (frequency, rates, STOP, HELP) and "Prefer email?" under it, and fits the
# first screen of an iPhone SE; errors show only on Text me; a number given turns the screen into the "Mahalo!" page naming
# it, which waits for Next (R-140, Nate 11 Oct: a page that waits for Next), then the story; Back finds the same page with
# a way to change the number and no replayed moment; "Coming up on your issues" no longer asks; the
# finale says "Almost set" (the number is not confirmed yet: D1-4, R-180; tests/d1_status.py checks the rule everywhere).
# Email: the swap, "Email me", the "Mahalo!" says where the link went, the finale's row.
# Skip: the "Mahalo!" with the bills line, the quiet line on Coming up. Between sessions: the January line. A visit from
# a shared bill: Follow on the bill (its own "Mahalo!") -> the alerts screen -> the story, no second "Mahalo!". Home's card after a skipped first
# visit, on the next load: the phone box, "You're set" after, nothing on the load after. More: "Get alerts" -> the page ->
# "Alerts almost set" -> Change number -> Stop texts (Undo) -> the box again. The privacy page names numbers. Nothing
# reaches the database (the sandbox). No console errors.
# Every page here is the box before codes are on (&codes=0: the live page until texts are set up), whose small print says
# the number will be confirmed by text, never "reply YES" (R-176). The code step is tests/phone_signin.py's.
import os, re, sys
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
# The "Mahalo!" page (R-140, Nate 11 Oct): the alerts step drawn again in place, its heading, lines and the card of what was given.
def thanks(p):
    return p.evaluate("[...document.querySelectorAll('.st-thanks #st-h, .st-thanks .st-thsub, .st-thanks .lede, .st-thanks .st-alertdone')].map(e => e.innerText).join('\\n')")

# From a restart to the alerts screen (topic Food, HIPHI's ticked issues followed).
def to_alerts(p, extra=''):
    p.goto(BASE + '?demo=1&codes=0&restart' + extra); p.wait_for_selector('.st-tile', timeout=15000); p.wait_for_timeout(800)
    p.locator('.st-tile', has_text='Food').first.click(); p.wait_for_timeout(200)
    p.click('[data-stnext]'); p.wait_for_selector('[data-stpick]', timeout=10000); p.wait_for_timeout(800)
    p.click('[data-stnext]'); p.wait_for_selector('.st-alertspage', timeout=10000); p.wait_for_timeout(700)
# From the story's first page to Coming up.
def story_to_soon(p):
    p.wait_for_selector('.lx-count', timeout=10000); p.wait_for_timeout(1000)
    for _ in range(2): p.click('[data-stnext]'); p.wait_for_timeout(1300)
    # the story's two choices since R-255 (Nate 10/12): the first choice on each, then Next, which sleeps until a choice is made
    for _ in range(2): p.click('.lx-doors [data-lx-pick]'); p.wait_for_timeout(900); p.click('[data-stnext]'); p.wait_for_timeout(1300)
    # the story hands straight on to Coming up (R-232: the address step left the first visit)
    p.wait_for_selector('.st-soonpage', timeout=10000); p.wait_for_timeout(700)

with sync_playwright() as pw:
    b = pw.chromium.launch()

    # ---- 1. a number, on a phone ----
    c, p = ctx(b)
    to_alerts(p, '&fv=full&end=today')
    t = text(p)
    ok(p.url.endswith('#/start/3'), f'the alerts screen is the third step, right after the issues ({p.url[-10:]})')
    ok(moment(p) == '', 'no "Mahalo!" before the alerts screen')
    ok(p.inner_text('#st-h') == 'Save your profile' and p.locator('.st-alertspage .lede').count() == 0 and p.title().startswith('Save your profile'),
       'the heading and the tab ask to save the profile, with no line under it (R-265: the box says what comes)')
    ok(p.locator('#st-a-phone').count() == 1 and p.locator('#st-a-email').count() == 0, 'the mobile number box comes first, alone')
    ok('Hearing alerts and action asks from HIPHI, up to 1 a day. Msg & data rates may apply. Reply STOP to cancel.' in t and 'YES' not in t and p.locator('.al-fine a', has_text='Terms').count() == 1 and p.locator('.al-fine a', has_text='Privacy').count() == 1,
       'the consent line as stored (t4, R-265): who, what, how often, rates, STOP, with the Terms and Privacy links beside it')
    ok(p.evaluate("(() => { const i = document.getElementById('st-a-phone'), h = document.getElementById('st-a-hint'); return !!h && h.getBoundingClientRect().top > i.getBoundingClientRect().bottom && h.getBoundingClientRect().top - i.getBoundingClientRect().bottom < 40 && i.getAttribute('aria-describedby') === 'st-a-hint'; })()"), 'the privacy line sits right under the box, and the box points to it')
    ok('Use email instead' in t, 'email is a link under the box')
    ok(text(p, '#st-a-hint') == 'We never share your number.', 'under the box: "We never share your number." (R-265)')
    ok(p.locator('.st-bar button', has_text='Text me').count() == 1 and p.locator('[data-stskip]').count() == 1, 'the bar: Skip and Text me')
    ok(p.evaluate("getComputedStyle(document.querySelector('.st-chapters li.on')).fontWeight >= 600 && document.querySelector('.st-chapters li.on').innerText.includes('Your issues')"), 'it is still the "Your issues" part')
    shot(p, '1_alerts_phone')
    p.click('#st-send'); p.wait_for_timeout(300)
    ok('Add your mobile number' in text(p, '#st-a-err'), 'Text me with nothing typed says what to do')
    p.fill('#st-a-phone', '555-0123'); p.wait_for_timeout(100)
    ok(text(p, '#st-a-err').strip() == '', 'typing clears the message (C-9)')
    p.click('#st-send'); p.wait_for_timeout(300)
    ok('10-digit' in text(p, '#st-a-err') and p.get_attribute('#st-a-phone', 'aria-invalid') == 'true', 'a short number: the 10-digit message, marked invalid')
    p.fill('#st-a-phone', '808.555.0123'); p.click('#st-send'); p.wait_for_selector('.st-thanks #st-h', timeout=5000); p.wait_for_timeout(300)
    m = thanks(p)
    ok(p.inner_text('#st-h') == 'Mahalo!' and 'following' in m and 'We’ll text (808) 555-0123 to confirm it’s your number' in m and 'YES' not in m and p.url.endswith('#/start/3') and moment(p) == '',
       f'the "Mahalo!" page celebrates both, in place of the box, and says a text will confirm the number: {m[:140]!r}')
    ok(p.inner_text('.actionbar [data-stnext]').strip() == 'Next: A Bill’s Story', 'its button names what comes next (C-6), not "Continue", in title case (R-186), as the strip and the page name it (C-15, R-249)')
    shot(p, '1b_mahalo')
    saved = p.evaluate("localStorage.getItem('hiphi_text')")
    ok(saved and '8085550123' in saved, 'this browser keeps the number (the sandbox copy)')
    p.wait_for_timeout(3000)
    ok(p.locator('.st-thanks #st-h').count() == 1 and p.url.endswith('#/start/3'), 'the page is still there after 3 s: it waits for Next (R-140, Nate 11 Oct: a page that waits for Next)')
    p.click('.actionbar [data-stnext]'); p.wait_for_selector('.lx-count', timeout=10000); p.wait_for_timeout(600)
    ok(p.url.endswith('#/start/4'), 'Next goes on to the story')
    p.click('[data-stback]'); p.wait_for_timeout(1200)
    t = text(p)
    ok(p.url.endswith('#/start/3') and 'We’ll text (808) 555-0123 to confirm it’s your number.' in t and 'Use a different number' in t and p.inner_text('#st-h') == 'Mahalo!' and p.locator('.st-thanksnew').count() == 0,
       'Back: the same "Mahalo!" page (the confirming text is still to come), with a way to change it, the flower not replayed')
    ok(p.locator('.st-bar button', has_text='Next').count() == 1, 'Back: the bar says Next')
    shot(p, '1c_back_set')
    p.click('[data-stnext]'); p.wait_for_timeout(900)
    ok(moment(p) == '' and p.url.endswith('#/start/4'), 'Next from there: the story again, no moment over it')
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
    ok('Hearing alerts and action asks from HIPHI, up to 1 a day. Unsubscribe anytime.' in t and 'We never share your email.' in t and 'Text me instead' in t, 'the email words (e2, R-265), and the way back to texts')
    ok(p.locator('.st-bar button', has_text='Email me').count() == 1, 'the button says Email me (a link)')
    shot(p, '2_alerts_email')
    p.fill('#st-a-email', 'leilani@example'); p.click('#st-send'); p.wait_for_timeout(300)
    ok('name@example.com' in text(p, '#st-a-err'), 'an unfinished email says so')
    p.fill('#st-a-email', 'leilani@example.com'); p.click('#st-send'); p.wait_for_selector('.st-thanks #st-h', timeout=5000); p.wait_for_timeout(400)
    m = thanks(p)
    ok('Mahalo!' in m and 'Link sent to leilani@example.com' in m and 'Tap it when you finish here' in m and 'Use a different email' in m, f'the "Mahalo!" page says where the link went and to finish first (C-6): {m[:160]!r}')
    p.click('.actionbar [data-stnext]'); story_to_soon(p)
    p.click('[data-stnext]'); p.wait_for_selector('.st-did', timeout=8000); p.wait_for_timeout(500)
    ok('Alerts almost set' in text(p, '.st-did') and 'Tap the link we sent to leilani@example.com to turn on alerts.' in text(p, '.st-did'), 'the finale: "Almost set", tap the link (it said "Reminders: one tap to go")')
    c.close()

    # ---- 3. Skip ----
    c, p = ctx(b)
    to_alerts(p, '&fv=full&end=today')
    p.click('[data-stskip]'); p.wait_for_selector('.st-thanks #st-h', timeout=5000); p.wait_for_timeout(400)
    m = thanks(p)
    ok('Mahalo!' in m and 'text' not in m.lower() and 'bill' in m and p.locator('.st-alertdone').count() == 0, f'Skip: the "Mahalo!" page for the issues, with the bills line and no card: {m[:120]!r}')
    p.click('.actionbar [data-stnext]'); story_to_soon(p)
    ok('Want alerts by text or email?' in text(p) and p.locator('#st-a-phone').count() == 0, 'Coming up: one quiet line, no second ask')
    p.click('[data-stnext]'); p.wait_for_selector('.st-did', timeout=8000); p.wait_for_timeout(400)
    ok('Alerts are off' in text(p, '.st-did') and p.locator('.st-did [data-alsheet]', has_text='Turn on alerts').count() == 1, 'the finale: "Alerts are off", with its own "Turn on alerts" (X10-4)')
    p.click('[data-stdone]'); p.wait_for_timeout(1500)
    # Home on the next load asks once: one quiet line (R-222), whose button opens the same box in the sheet.
    p.reload(); p.wait_for_timeout(2500)
    ok(p.locator('.nudgecard form').count() == 0 and p.locator('.hm-profline [data-hm-prof]').count() == 1, 'Home, next load: one quiet line, no form in the page (R-222)')
    p.locator('.hm-profline').scroll_into_view_if_needed(); shot(p, '3_home_line')
    p.locator('.hm-profline [data-hm-prof]').click(); p.wait_for_selector('.al-sheet[open] #al-sh-phone', timeout=5000)
    ok(p.locator('.al-sheet button', has_text='Text me').count() == 1, 'Home: the line opens the phone box in the sheet')
    ok('Use email instead' in text(p, '.al-sheet') and 'We never share your number.' in text(p, '.al-sheet'), 'Home: email is a link under it, and the privacy line is there too')
    shot(p, '3_home_sheet')
    p.fill('#al-sh-phone', '(808) 555-0144'); p.locator('.al-sheet button', has_text='Text me').click(); p.wait_for_timeout(1000)
    ok('We’ll text (808) 555-0144 to confirm it’s your number' in text(p, '.nudgecard'), 'Home: "almost set" in the card where the line was')
    p.reload(); p.wait_for_timeout(2500)
    ok(p.locator('.nudgecard form').count() == 0 and p.locator('.hm-profline').count() == 0, 'Home, the load after: no ask (a number was given)')
    c.close()

    # ---- 4. between sessions ----
    c, p = ctx(b)
    to_alerts(p, '&season=off&fv=full&end=today')
    # "Save your profile" has no line under it since R-265 (Nate 12 Oct: "the absolute minimum"); the box's line says what comes.
    ok(p.locator('.st-alertspage .lede').count() == 0 and p.evaluate("document.querySelector('#st-aform').getBoundingClientRect().top + scrollY") <= 320, 'between sessions: no line under the heading (R-265), and the box starts within 320px (A-1)')
    c.close()

    # ---- 5. a visit from a shared bill ----
    c, p = ctx(b)
    p.goto(BASE + '?demo=1&codes=0&restart&fv=full&end=today#/bill/HB2121'); p.wait_for_selector('[data-bl-newfollow]', timeout=15000); p.wait_for_timeout(800)
    p.locator('[data-bl-newfollow]').first.click(); p.wait_for_selector('#fx-mgo', timeout=8000); p.wait_for_timeout(400)
    p.click('#fx-mgo'); p.wait_for_timeout(2000)
    ok(p.locator('.st-alertspage').count() == 1, f'from a shared bill: the alerts screen comes right after "Follow this issue?" ({p.url[-10:]})')
    p.fill('#st-a-phone', '8085550155'); p.click('#st-send'); p.wait_for_timeout(1500)
    ok(moment(p) == '' and p.locator('.st-thanks').count() == 0 and p.locator('.lx-count, .st-lessonpage, .st-voicepage').count() >= 1, f'from a shared bill: no second "Mahalo!", straight on to the story ({p.url[-10:]})')
    c.close()

    # ---- 6. More > Get alerts ----
    c, p = ctx(b)
    p.goto(BASE + '?demo=1&codes=0&restart#/more'); p.wait_for_timeout(2500)
    # R-147 (10/4): More's first row is the person; without a number or email it invites them to make a profile with the same box.
    ok(p.locator('a.mr-me[href="#/profile"]', has_text='Get alerts and make your profile').count() == 1, 'More: "Get alerts and make your profile" is the first row (R-147, X10-4)')
    p.goto(BASE + '?demo=1&codes=0#/alerts'); p.wait_for_timeout(1500)
    t = text(p)
    ok('Get alerts on your issues' in t and p.locator('#mr-al-phone').count() == 1 and p.locator('button.al-swap[data-alswap="email"]').count() == 1, 'the page: the phone box, "Use email instead" in place (D1-5)')
    p.click('button.al-swap[data-alswap="email"]'); p.wait_for_selector('#mr-al-email', timeout=3000)
    ok('Email me a link' in text(p) and 'Hearing alerts and action asks from HIPHI, up to 1 a day. Unsubscribe anytime.' in text(p) and p.locator('#mr-alform input[type=checkbox]').count() == 0, 'Use email instead: the email box under the alerts promise, nothing to tick (D1-5)')
    p.fill('#mr-al-email', 'someone@example.org'); p.click('#mr-al-send'); p.wait_for_timeout(900)
    ok(p.inner_text('h1') == 'Alerts almost set' and 'We sent a link to someone@example.org. Tap it to turn on alerts.' in text(p), 'the email given: "Alerts almost set", the link sent (D1-5)')
    p.click('[data-mr-alotheremail]'); p.wait_for_timeout(500)
    ok(p.locator('#mr-al-email').count() == 1 and p.locator('button.al-swap[data-alswap="phone"]').count() == 1, 'Use a different email: the box again, with Text me instead')
    p.click('button.al-swap[data-alswap="phone"]'); p.wait_for_timeout(400)
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
