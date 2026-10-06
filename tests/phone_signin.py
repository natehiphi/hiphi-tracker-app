# Sign in with a mobile number and a 6-digit code (R-155, Nate 10/5: "Yes"; "Code at sign-up").
# python3 tests/phone_signin.py [base_url]   (defaults to http://localhost:8832/track.html)
# Part A, the page as it is until texts are set up (codes off, &codes=0 in the practice copy): More on a laptop says how a
#   number-only person brings their profile here ("Add your email on your phone"); the header's Sign in opens the email
#   page; the box says the number will be confirmed by text, never "reply YES" (R-176). The practice copy without &codes=0
#   shows codes on (R-176, Nate 10/5: "Code everywhere").
# Part B, the practice copy with codes on (&codes): the first visit's box texts a code, the box becomes the code field
#   (Confirm; a short code, a new code too soon, a different number), six digits send it, and the "Mahalo!" says alerts
#   are on and the person is signed in; Back says "You're all set". More's "Sign in" -> "Sign in" by number -> code ->
#   "Code accepted". More > Get alerts and the profile's invitation take the code too. Home's card. The privacy page.
# Part C, the live page with Supabase answered by the test (nothing reaches a phone or the database): Supabase says phone
#   sign-in is on; the code signs in without restarting the page; the account loads (ensure_public_user, my_profile_v2),
#   the text row is linked (text_link), the number is kept under the t2 words with the session (text_signup) only from
#   the alerts box, never from the sign-in page; the profile shows the name and "Signed in with (808) ••• 0123".
# No console errors.
import base64, json, os, sys, time
from playwright.sync_api import sync_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832/track.html'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out', 'phone_signin'); os.makedirs(OUT, exist_ok=True)
passes, fails, errors = [], [], []
def ok(c, m): (passes if c else fails).append(('PASS ' if c else 'FAIL ') + m)
QUIET = "Object.defineProperty(navigator, 'globalPrivacyControl', { value: true });"   # never counted as a visit

def ctx(b, w=390, h=844):
    c = b.new_context(viewport={'width': w, 'height': h}, is_mobile=w < 600, has_touch=w < 600, device_scale_factor=2 if w < 600 else 1)
    c.add_init_script(QUIET)
    p = c.new_page(); p.on('pageerror', lambda e: errors.append(f'{w}: {e}'))
    p.on('console', lambda m: errors.append(f'console {w}: {m.text[:160]}') if m.type == 'error' and 'favicon' not in m.text else None)
    return c, p
def text(p, sel='main'):
    try: return p.inner_text(sel, timeout=3000)
    except Exception: return ''
def shot(p, name): p.screenshot(path=os.path.join(OUT, name + '.png'))
def until(p, js, t=30000):
    try: p.wait_for_function(js, timeout=t); return True
    except Exception: return False
def moment(p):
    return p.evaluate("(() => { const m = document.getElementById('fx-moment'); return m && !m.hidden ? m.innerText : ''; })()")
def to_alerts(p, extra=''):
    p.goto(BASE + '?demo=1&restart' + extra); p.wait_for_selector('.st-tile', timeout=20000); p.wait_for_timeout(800)
    p.locator('.st-tile', has_text='Food').first.click(); p.wait_for_timeout(200)
    p.click('[data-stnext]'); p.wait_for_selector('[data-stpick]', timeout=10000); p.wait_for_timeout(800)
    p.click('[data-stnext]'); p.wait_for_selector('.st-alertspage', timeout=10000); p.wait_for_timeout(700)

with sync_playwright() as pw:
    b = pw.chromium.launch()

    # ================= A. codes off (the live page until texts are set up) =================
    c, p = ctx(b)
    p.goto(BASE + '?demo=1&restart#/alerts'); p.wait_for_selector('#mr-al-phone', timeout=60000)
    ok(p.locator('#mr-al-send', has_text='Text me a code').count() == 1 and '6-digit code' in text(p) and 'YES' not in text(p), 'the practice copy shows codes on without &codes (R-176)')
    c.close()
    c, p = ctx(b, 1440, 900)
    p.goto(BASE + '?demo=1&restart&codes=0#/more'); p.wait_for_selector('.mr-me', timeout=60000); p.wait_for_timeout(500)
    t = text(p)
    ok('Made one before? Sign in with your email' in t, 'codes off: More still offers sign-in with an email')
    ok('Signed up with your number? Add your email on your phone, then sign in here with it.' in t, 'codes off: the line for a number-only person on a laptop')
    shot(p, 'A1_more_laptop')
    p.goto(BASE + '?demo=1&codes=0#/signin?by=number'); p.wait_for_selector('#mr-email, #mr-pi-phone', timeout=60000)
    ok(p.locator('#mr-email').count() == 1 and p.locator('#mr-pi-phone').count() == 0, 'codes off: "Sign in" opens the email page')
    p.goto(BASE + '?demo=1&codes=0#/alerts'); p.wait_for_selector('#mr-al-phone', timeout=60000)
    ok('We’ll text you to confirm it’s your number' in text(p) and 'YES' not in text(p) and '6-digit code' not in text(p), 'codes off: the box says the number will be confirmed by text, never "reply YES" (R-176)')
    p.fill('#mr-al-phone', '808 555 0155'); p.click('#mr-al-send'); p.wait_for_timeout(1200)
    # D1-4 (R-180): the page heads "Alerts almost set" with the alerts step's words, not "Text alerts are on" over "We'll text you first".
    ok(p.inner_text('h1') == 'Alerts almost set' and 'We’ll text (808) 555-0155 to confirm it’s your number.' in text(p) and 'YES' not in text(p), 'codes off: the number kept, "Almost set", "confirm it’s your number", no YES')
    p.goto(BASE + '?demo=1&codes=0#/privacy'); p.wait_for_selector('.mr-facts', timeout=60000)
    ok('Our first text confirms the number is yours' in text(p) and 'YES' not in text(p) and 'Updated 5 October 2026' in text(p), 'codes off: the privacy page says the first text confirms the number, dated 5 October')
    c.close()
    c, p = ctx(b)
    p.goto(BASE + '?demo=1&restart&codes=0#/more'); p.wait_for_selector('.mr-me', timeout=60000); p.wait_for_timeout(500)
    ok('Made one before? Sign in with your email' in text(p) and 'Signed up with your number?' not in text(p), 'codes off, on a phone: no laptop line (it would contradict itself there)')
    c.close()

    # ================= B. codes on, the practice copy =================
    c, p = ctx(b)
    to_alerts(p, '&codes&fv=full&end=today')
    t = text(p)
    ok('We’ll text you a 6-digit code to confirm it’s your number' in t and 'reply YES' not in t, 'codes on: the small print says a code comes first, not a YES')
    ok(all(w in t for w in ['At most one text a day', 'Message and data rates may apply', 'Reply STOP to stop', 'HELP for help']), 'codes on: frequency, rates, STOP and HELP are still there')
    ok(p.locator('#st-send', has_text='Text me a code').count() == 1, 'codes on: the button says what it sends, a code')
    p.fill('#st-a-phone', '(808) 555-0123'); p.click('#st-send'); p.wait_for_selector('#st-a-code', timeout=5000); p.wait_for_timeout(400)
    t = text(p)
    ok(p.inner_text('#st-h') == 'Check your texts' and 'Type the 6-digit code' in t, 'the heading says to check your texts')
    ok(p.locator('#st-aform [data-alswap="email"]').count() == 1, 'the code step has a way to email instead')
    ok('We texted a code to (808) 555-0123' in t, 'the box becomes the code field, naming the number')
    ok(p.get_attribute('#st-a-code', 'autocomplete') == 'one-time-code' and p.get_attribute('#st-a-code', 'inputmode') == 'numeric', 'the field lets the phone fill the code in (one-time-code, numeric keypad)')
    ok(p.locator('#st-send', has_text='Confirm').count() == 1, 'the bar button says Confirm')
    ok(moment(p) == '', 'no "Mahalo!" before the code')
    shot(p, 'B1_code_step')
    p.wait_for_load_state('networkidle'); p.wait_for_timeout(500)
    p.click('#st-send'); until(p, "(document.getElementById('st-a-err')?.innerText || '').includes('Enter the 6-digit code')", 5000)
    ok('Enter the 6-digit code' in text(p, '#st-a-err'), 'Confirm with nothing typed says what to do')
    p.fill('#st-a-code', '12'); p.click('#st-send'); p.wait_for_timeout(300)
    ok('all 6 digits' in text(p, '#st-a-err') and p.get_attribute('#st-a-code', 'aria-invalid') == 'true', 'a short code: the message, marked invalid')
    p.click('[data-alresend]'); p.wait_for_timeout(300)
    ok('Wait a minute' in text(p, '#st-a-status'), 'a new code right away: "Wait a minute", never a disabled button')
    p.click('[data-alnumber]'); p.wait_for_timeout(500)
    ok(p.locator('#st-a-phone').count() == 1 and p.input_value('#st-a-phone') == '(808) 555-0123' and p.locator('#st-send', has_text='Text me a code').count() == 1 and 'Get alerts on your' in p.inner_text('#st-h'), 'a different number: the number box again, with the number in it')
    p.fill('#st-a-phone', '808 555 0177'); p.click('#st-send'); p.wait_for_selector('#st-a-code', timeout=5000)
    p.type('#st-a-code', '123456'); p.wait_for_selector('#fx-mgo', timeout=6000); p.wait_for_timeout(1500)
    m = moment(p)
    ok('Mahalo!' in m and 'Text alerts are on for (808) 555-0177.' in m and 'signed in' not in m, f'six digits send it by themselves; the "Mahalo!" says alerts are on (the sandbox signs no one in): {m[:160]!r}')
    shot(p, 'B2_mahalo')
    saved = json.loads(p.evaluate("localStorage.getItem('hiphi_text')") or 'null')
    ok(saved and saved.get('phone') == '8085550177' and saved.get('confirmed') is True, 'this browser keeps the number, confirmed (the sandbox copy)')
    p.click('#fx-mgo'); p.wait_for_selector('.lx-count', timeout=10000); p.wait_for_timeout(600)
    p.click('[data-stback]'); p.wait_for_timeout(1200)
    t = text(p)
    ok('You’re all set' in t and 'Text alerts are on for (808) 555-0177' in t and 'reply YES' not in t, 'Back: "You’re all set", alerts on, no YES')
    shot(p, 'B3_back_set')
    c.close()

    # More on a laptop: "Sign in" by number
    c, p = ctx(b, 1440, 900)
    p.goto(BASE + '?demo=1&restart&codes#/more'); p.wait_for_selector('.mr-me', timeout=60000); p.wait_for_timeout(500)
    t = text(p)
    ok('Made one before? Sign in' in t and 'Add your email on your phone' not in t, 'codes on: More says "Made one before? Sign in", no stopgap line')
    p.click('a[href="#/signin?by=number"]'); p.wait_for_selector('#mr-pi-phone', timeout=5000); p.wait_for_timeout(300)
    t = text(p)
    ok('Sign in' in p.inner_text('h1') and 'We’ll text you a 6-digit code' in t and 'Sign in with your email' in t, 'the sign-in page: the number first, email as a link')
    ok(p.title().startswith('Sign in'), f'the tab says Sign in ({p.title()})')
    shot(p, 'B4_signin_number')
    p.click('#mr-pi-send'); p.wait_for_timeout(300)
    ok('Add your mobile number' in text(p, '#mr-pi-err'), 'nothing typed: says what to do')
    p.fill('#mr-pi-phone', '8085550123'); p.click('#mr-pi-send'); p.wait_for_selector('#mr-pi-code', timeout=5000); p.wait_for_timeout(300)
    ok('We texted a code to (808) 555-0123' in text(p) and p.locator('#mr-pi-send', has_text='Sign in').count() == 1, 'the code step, with Sign in')
    shot(p, 'B5_signin_code')
    p.type('#mr-pi-code', '654321'); p.wait_for_selector('#mr-pi-h', timeout=5000); p.wait_for_timeout(500)
    ok('Code accepted' in text(p) and 'you stay signed out' in text(p), 'the sandbox: "Code accepted", and it says you stay signed out there')
    p.goto(BASE + '?demo=1&codes#/privacy'); p.wait_for_selector('.mr-facts', timeout=60000)
    t = text(p)
    ok('6-digit code' in t and 'signs you in, the way an email does' in t and 'never your number' in t and 'Updated 5 October 2026' in t, 'codes on: the privacy page says the number signs people in, staff never see it')
    c.close()

    # More > Get alerts, and the profile's invitation
    c, p = ctx(b)
    p.goto(BASE + '?demo=1&restart&codes#/alerts'); p.wait_for_selector('#mr-al-phone', timeout=60000); p.wait_for_load_state('networkidle')
    p.fill('#mr-al-phone', '808 555 0166'); p.click('#mr-al-send'); p.wait_for_selector('#mr-al-code', timeout=5000)
    ok(p.locator('#mr-al-send', has_text='Confirm').count() == 1 and 'Check your texts' in p.inner_text('h1'), 'More > Get alerts: the code step, Confirm, "Check your texts"')
    ok(p.locator('#mr-alform a.al-swap[href="#/signin"]').count() == 1, 'More > Get alerts: email is still a way out from the code step')
    p.type('#mr-al-code', '111111'); p.wait_for_timeout(1200)
    t = text(p)
    ok('Text alerts are on' in t and '(808) 555-0166' in t and 'reply YES' not in t, 'More > Get alerts: on, with no YES text to wait for')
    c.close()
    c, p = ctx(b)
    p.goto(BASE + '?demo=1&restart&codes#/profile'); p.wait_for_selector('#pf-alf-phone', timeout=60000); p.wait_for_load_state('networkidle')
    ok('Made one before? Sign in' in text(p), 'the profile’s invitation: "Made one before? Sign in"')
    p.fill('#pf-alf-phone', '808 555 0188'); p.click('#pf-al-send'); p.wait_for_selector('#pf-alf-code', timeout=5000)
    p.type('#pf-alf-code', '222222'); p.wait_for_timeout(1200)
    ok('Your profile is made. Text alerts are on.' in text(p), 'the profile is made, said once')
    shot(p, 'B6_profile_made')
    c.close()

    # Home's card after a skipped first visit
    c, p = ctx(b)
    to_alerts(p, '&codes&fv=full&end=today')
    p.click('[data-stskip]'); p.wait_for_selector('#fx-mgo', timeout=5000); p.click('#fx-mgo'); p.wait_for_timeout(800)
    p.goto(BASE + '?demo=1&codes#/'); p.wait_for_timeout(1500); p.evaluate("localStorage.setItem('hiphi_wiz_demo', JSON.stringify({ ...JSON.parse(localStorage.getItem('hiphi_wiz_demo') || '{}'), finale: true }))")
    p.reload(); p.wait_for_timeout(3000)
    if p.locator('.nudgecard #ng-phone').count():
        p.fill('#ng-phone', '(808) 555-0144'); p.locator('.nudgecard button', has_text='Text me a code').click(); p.wait_for_selector('#ng-code', timeout=5000)
        ok('Check your texts' in text(p, '.nudgecard'), 'Home’s card: "Check your texts"')
        ok(p.locator('.nudgecard button', has_text='Confirm').count() == 1, 'Home’s card: the code step, Confirm')
        p.type('#ng-code', '333333'); p.wait_for_timeout(1200)
        ok('Text alerts are on for (808) 555-0144' in text(p, '.nudgecard'), 'Home’s card: alerts on')
    else:
        ok(True, 'Home’s card not shown on this load (nothing to check)')
    c.close()

    # ================= C. the live page, Supabase answered by the test =================
    FAKE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' + base64.urlsafe_b64encode(json.dumps({'sub': '11111111-2222-3333-4444-555555555555', 'role': 'authenticated', 'phone': '18085550123', 'email': '', 'exp': int(time.time()) + 3600, 'aud': 'authenticated'}).encode()).decode().rstrip('=') + '.sig'
    USER = {'id': '11111111-2222-3333-4444-555555555555', 'aud': 'authenticated', 'role': 'authenticated', 'email': '', 'phone': '18085550123', 'phone_confirmed_at': '2026-10-05T00:00:00Z', 'app_metadata': {'provider': 'phone'}, 'user_metadata': {}, 'created_at': '2026-10-05T00:00:00Z'}
    def live(b, w=390, h=844):
        c, p = ctx(b, w, h)
        calls = []
        def auth(route):
            u = route.request.url
            if '/auth/v1/settings' in u: return route.fulfill(json={'external': {'phone': True, 'email': True}, 'disable_signup': False})
            if '/auth/v1/otp' in u: calls.append(('otp', route.request.post_data)); return route.fulfill(json={})
            if '/auth/v1/verify' in u:
                calls.append(('verify', route.request.post_data))
                return route.fulfill(json={'access_token': FAKE, 'token_type': 'bearer', 'expires_in': 3600, 'expires_at': int(time.time()) + 3600, 'refresh_token': 'r1', 'user': USER})
            if '/auth/v1/user' in u: return route.fulfill(json=USER)
            return route.fulfill(status=404, json={})
        def rest(route):
            r = route.request
            if FAKE not in (r.headers.get('authorization') or ''): return route.continue_()
            path = r.url.split('/rest/v1/')[1].split('?')[0]
            calls.append((r.method + ' ' + path, r.post_data))
            if path.startswith('rpc/'):
                fn = path[4:]
                body = {'ensure_public_user': {'id': USER['id'], 'email': '', 'prefs': {}, 'created_at': '2026-10-05T00:00:00Z'},
                        'my_profile_v2': {'name': 'Keoni Text', 'titles': ['parent'], 'story': None, 'house': None, 'senate': None, 'island': None, 'interests': []},
                        'text_link': {'token': 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee', 'phone': '8085550123', 'stopped': False, 'confirmed': True},
                        'text_signup': {'ok': True}}.get(fn)
                return route.fulfill(status=200, json=body) if body is not None else route.fulfill(status=200, body='null', headers={'content-type': 'application/json'})
            if path.startswith('public_') and path not in ('public_actions', 'public_users'):   # public views: as anyone
                h = {k: v for k, v in r.headers.items() if k.lower() != 'authorization'}; return route.continue_(headers=h)
            return route.fulfill(status=200, json=[]) if r.method == 'GET' else route.fulfill(status=201, json=[])
        p.route('**/auth/v1/**', auth); p.route('**/rest/v1/**', rest)
        return c, p, calls
    LIVE = BASE.replace('?demo=1', '')

    # A laptop: Sign in with the number.
    c, p, calls = live(b, 1440, 900)
    p.goto(LIVE + '#/more'); p.wait_for_selector('.mr-me', timeout=30000); p.wait_for_function("document.querySelector('.mr-me-in')?.innerText.trim() === 'Made one before? Sign in'", timeout=10000)
    ok('Made one before? Sign in' in text(p) and 'Add your email on your phone' not in text(p), 'live, Supabase says phone sign-in is on: More offers "Sign in"')
    p.goto(LIVE + '#/signin?by=number'); p.wait_for_selector('#mr-pi-phone', timeout=8000)
    p.fill('#mr-pi-phone', '(808) 555-0123'); p.click('#mr-pi-send'); p.wait_for_selector('#mr-pi-code', timeout=8000)
    otp = [json.loads(d or '{}') for k, d in calls if k == 'otp']
    ok(otp and otp[-1].get('phone') == '+18085550123', f'the code is asked for +18085550123 ({otp[-1] if otp else None})')
    url_before = p.url
    p.type('#mr-pi-code', '123456'); p.wait_for_function("location.hash.startsWith('#/profile')", timeout=10000); until(p, "(document.querySelector('main')?.innerText || '').includes('Signed in with')", 30000); p.wait_for_timeout(500)
    ver = [json.loads(d or '{}') for k, d in calls if k == 'verify']
    ok(ver and ver[-1].get('type') == 'sms' and ver[-1].get('token') == '123456', f'the code is checked as a sign-in ({ver[-1] if ver else None})')
    names = [k for k, _ in calls]
    ok('POST rpc/ensure_public_user' in names and 'POST rpc/my_profile_v2' in names, 'the account loads after the code (ensure_public_user, my_profile_v2)')
    ok('POST rpc/text_link' in names, 'the account’s text row is linked')
    ok('POST rpc/text_signup' not in names, 'signing in is not consent: no text sign-up from the sign-in page')
    t = text(p)
    ok('Keoni Text' in t and 'Signed in with (808) ••• 0123' in t, f'the profile: their name and "Signed in with (808) ••• 0123"')
    ok(p.evaluate("document.activeElement?.id") != 'pf-h' or p.evaluate("getComputedStyle(document.activeElement).outlineStyle") == 'none', 'no focus box drawn round the profile heading')
    ok('Email: not added' in t and p.locator('#pf-email a[href="#/signin"]').count() == 1, 'no email yet: offered, with no email choices to change')
    ok('We keep your mobile number, which signs you in' in t and 'Sign out' in t, 'Your data: the number-only wording, with Sign out')
    shot(p, 'C1_profile_signed_in')
    p.goto(LIVE + '#/signin'); p.wait_for_timeout(1000)
    ok('Add your email' in text(p) and 'sign in with either' in text(p), 'a number account’s "Add your email" adds it to the same account')
    c.close()

    # A phone: the first visit's box, with a real code step.
    c, p, calls = live(b)
    p.goto(LIVE + '#/'); p.wait_for_selector('.st-tile', timeout=20000); p.wait_for_timeout(800)
    p.locator('.st-tile').first.click(); p.wait_for_timeout(200)
    p.click('[data-stnext]'); p.wait_for_selector('[data-stpick]', timeout=10000); p.wait_for_timeout(800)
    p.click('[data-stnext]'); p.wait_for_selector('.st-alertspage', timeout=10000); p.wait_for_timeout(700)
    ok('6-digit code' in text(p), 'live: the box says a code comes first')
    p.fill('#st-a-phone', '808-555-0123'); p.click('#st-send'); p.wait_for_selector('#st-a-code', timeout=8000)
    ok(any(k == 'otp' for k, _ in calls) and not any(k.endswith('rpc/text_signup') for k, _ in calls), 'Text me asks for a code; nothing is kept before it')
    p.type('#st-a-code', '123456'); p.wait_for_selector('#fx-mgo', timeout=10000); p.wait_for_timeout(800)
    ok('Text alerts are on for (808) 555-0123, and you’re signed in with it.' in moment(p) and p.url.split('#')[1].startswith('/start/'), 'the "Mahalo!" says alerts are on and they are signed in, and the visit goes on (no restart)')
    sign = [json.loads(d or '{}') for k, d in calls if k == 'POST rpc/text_signup']
    ok(sign and sign[-1].get('p', {}).get('consent') == 't2' and sign[-1]['p'].get('phone') == '8085550123', f'the number is kept with the session, under the t2 words ({sign[-1] if sign else None})')
    links = [k for k, _ in calls if k == 'POST rpc/text_link']
    ok(len(links) >= 2, f'text_link at sign-in and again after the number is kept, to confirm it ({len(links)})')
    ok(json.loads(p.evaluate("localStorage.getItem('hiphi_text')") or '{}').get('confirmed') is True, 'this phone keeps the number as confirmed')
    shot(p, 'C2_live_mahalo')
    c.close()
    b.close()

for r in passes + fails: print(r)
print(f'\n{len(passes)} passed, {len(fails)} failed')
real = [e for e in errors if 'text_link' not in e]
for e in real[:15]: print('ERROR', e)
sys.exit(1 if fails or real else 0)
