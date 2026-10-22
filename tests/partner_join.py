# R-328 batch H: For advocacy groups (#/groups) and the partner sign-in link (#/link/<token_hash>), pub/groups.js.
# The practice copy: the page's three parts and its form, every check of the form in plain words next to its field with the
# typed words kept (C-9), the thank-you, the day's cap as the database words it, an invite link's prefill ("&" and "+" in a
# name survive), typed words kept on leaving and coming back, the links from You, Help and the website box, the link screen
# (Continue opens the sample group; an incomplete link offers sign-in by email). Then the LIVE page with every call to
# Supabase answered here (nothing reaches the database): the link spends nothing until Continue, Continue calls verifyOtp
# with the token_hash as a magic link and lands signed in on #/partner, a used link says so, and the form sends
# partner_request with exactly its fields and shows a refusal as it comes. On every page: one h1, no sideways scroll,
# labels, 44px targets on a phone, at most one filled button, no console errors. Pictures go to tests/out/partner_join/
# (or the folder given second). Look at them.
# Run: python3 tests/partner_join.py http://localhost:8853 [picture folder]
import sys, os, re, json, time, base64
from playwright.sync_api import sync_playwright

BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8853').rstrip('/')
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out', 'partner_join')
os.makedirs(OUT, exist_ok=True)
HOST = 'eivzjbnygscguqqiiuvh.supabase.co'
CLEAN = """(() => { for (const s of ['_demo', '']) { localStorage.setItem('hiphi_wiz' + s, JSON.stringify({ done: true, issues: [] }));
  localStorage.setItem('hiphi_tour_home' + s, '{}'); localStorage.setItem('hiphi_tour_bill' + s, '{}'); } })();"""
FAILS, N = [], [0]
def check(ok, msg):
    N[0] += 1; print(('ok   ' if ok else 'FAIL ') + msg)
    if not ok: FAILS.append(msg)
SMALL = """(() => { const out = []; for (const el of document.querySelectorAll('#main .gp a, #main .gp button, #main .gp input, #main .gp textarea, #main .gp label.check')) {
  const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue; if (el.tagName === 'A' && !el.classList.contains('btn') && el.closest('p') && !el.classList.contains('rc-back')) continue;
  if (el.type === 'checkbox') continue;
  if (r.height < 43.5) out.push((el.className || el.tagName) + ' ' + Math.round(r.height) + ' ' + (el.innerText || el.value || '').slice(0, 30)); } return out; })()"""

def ctx(b, w=390, h=844, live=False):
    c = b.new_context(viewport={'width': w, 'height': h}, has_touch=w < 900, is_mobile=w < 900)
    c.add_init_script(CLEAN)
    p = c.new_page(); p.errs = []
    p.on('pageerror', lambda e: p.errs.append('pageerror ' + str(e)))
    p.on('console', lambda m: p.errs.append(m.type + ' ' + m.text) if m.type == 'error' else None)
    return c, p
def open_page(p, route, q='', sel='#main .gp'):
    p.goto(f'{BASE}/track.html?demo=1{q}{route}'); p.wait_for_selector(sel, timeout=45000); p.wait_for_timeout(500)
def text(p, sel='#main'): return p.inner_text(sel)
def common(p, tag, w, errs_ok=()):
    sw = p.evaluate('document.documentElement.scrollWidth')
    check(sw <= w, f'{tag}: no sideways scroll ({sw} at {w})')
    check(p.evaluate("document.querySelectorAll('h1').length") == 1, f'{tag}: one h1')
    if w < 900:
        small = p.evaluate(SMALL); check(not small, f'{tag}: 44px targets {small[:4]}')
    unl = p.evaluate("""[...document.querySelectorAll('#main input, #main textarea')].filter(i => i.type !== 'hidden' && !(i.labels && i.labels.length) && !i.getAttribute('aria-label')).map(i => i.id)""")
    check(not unl, f'{tag}: every field has a label {unl}')
    filled = p.evaluate("[...document.querySelectorAll('#main .btn.primary')].filter(b => b.offsetParent).length")
    check(filled <= 1, f'{tag}: at most one filled button ({filled})')
    errs = [e for e in p.errs if not any(x in e for x in errs_ok)]
    check(not errs, f'{tag}: no console errors {errs[:2]}')
def shot(p, name, full=False): p.screenshot(path=f'{OUT}/{name}.png', full_page=full)
def fill_all(p, email='leilani@example.org'):
    p.fill('#gp-group_name', 'Keiki Smiles Alliance'); p.fill('#gp-website', 'keikismiles.org'); p.fill('#gp-about', 'Healthy teeth for every child in Hawaiʻi.')
    p.fill('#gp-contact_name', 'Leilani K.'); p.fill('#gp-contact_email', email); p.fill('#gp-note', 'We work on HB 1671 and school meals.')
    if not p.is_checked('#gp-ok'): p.check('#gp-ok')

with sync_playwright() as pw:
    b = pw.chromium.launch()
    # ================= A. the practice copy =================
    for w, h in ((390, 844), (1440, 900), (320, 640)):
        t = str(w)
        c, p = ctx(b, w, h)
        open_page(p, '#/groups')
        txt = text(p)
        check(p.evaluate("document.querySelector('#main h1').innerText") == 'For advocacy groups', f'{t}: headed "For advocacy groups"')
        for s in ['What your group gets', 'Who can join', 'How it works', 'Ask to join', 'Any advocacy group in Hawaiʻi, on any bill.', 'No candidates, campaigns or political parties.',
                  'A second person at HIPHI approves it.', 'HIPHI looks over every word before it goes public.', 'Your own link opens the tracker with your bills first.',
                  'We are an advocacy group, not a candidate, campaign or party', 'Send to HIPHI', 'A note (optional)', 'This is the practice copy, so nothing is sent.']:
            check(s in txt, f'{t}: says {s!r}')
        check(txt.count('HIPHI looks over every word') == 1, f'{t}: "HIPHI looks over every word" said once (A-14)')
        check(p.evaluate("document.querySelector('#main .rc-back')?.innerText.trim()") == 'You', f'{t}: the back row says You')
        if w == 1440:
            side = p.evaluate("(() => { const m = document.querySelector('.gp-main').getBoundingClientRect(), s = document.querySelector('.gp-side').getBoundingClientRect(); return [Math.round(m.right), Math.round(s.left), Math.round(s.top - m.top)]; })()")
            check(side[1] > side[0] and abs(side[2]) < 60, f'{t}: the form sits beside the reading from 1100px ({side})')
        jv = p.locator('[data-gp-jump]').is_visible()
        check(jv == (w < 1100), f'{t}: "Ask to join" goes to the form on a phone, and is not needed on a laptop ({jv})')
        common(p, f'{t} page', w); shot(p, f'groups-{t}'); shot(p, f'groups-{t}-full', True)
        # the form's checks: empty Send
        p.click('#gp-send'); p.wait_for_timeout(250)
        errs = p.evaluate("[...document.querySelectorAll('#gp-form .err')].map(e => e.innerText.trim())")
        check(errs == ['Write your group’s name.', 'Add your group’s website, or its Facebook or Instagram page.', 'Write one line about your group.', 'Write your name.',
                       'Write your email, so HIPHI can reach you.', 'Tick this box to send. The tracker is for advocacy groups.'], f'{t}: each missing field says so next to it {errs}')
        check(p.evaluate("document.activeElement?.id") == 'gp-group_name', f'{t}: focus goes to the first field that needs it (C-9)')
        check(p.evaluate("document.getElementById('gp-group_name').getAttribute('aria-invalid')") == 'true', f'{t}: the field is marked invalid')
        if w == 390:
            p.evaluate("document.getElementById('gp-form').scrollIntoView()"); shot(p, f'form-error-{t}')
        # typed words kept, the next error focused; a bad web address and email
        p.fill('#gp-group_name', 'Keiki Smiles Alliance'); p.fill('#gp-website', 'not a site'); p.fill('#gp-contact_email', 'leilani@'); p.click('#gp-send'); p.wait_for_timeout(250)
        errs = p.evaluate("[...document.querySelectorAll('#gp-form .err')].map(e => e.innerText.trim())")
        check('That doesn’t look like a web address. Try one like example.org.' in errs and 'That email doesn’t look right. Try one like name@example.org.' in errs, f'{t}: a bad web address and email say so {errs[:3]}')
        check(p.input_value('#gp-group_name') == 'Keiki Smiles Alliance' and p.evaluate("document.activeElement?.id") == 'gp-website', f'{t}: typed words kept, the web address focused')
        # the counter, and an error cleared by typing
        p.fill('#gp-about', 'Healthy teeth'); check(p.inner_text('[data-gcount=about]') == '13 of 200', f'{t}: the line counts as it is typed')
        check(p.locator('#gp-about-err').count() == 0, f'{t}: typing clears that field’s error')
        fill_all(p); p.click('#gp-send')
        p.wait_for_selector('#gp-done-h', timeout=5000); p.wait_for_timeout(300)
        d = text(p, '.gp-done')
        check('Thank you' in d and 'HIPHI will be in touch by email.' in d and 'Look for it at leilani@example.org.' in d and 'nothing was sent' in d, f'{t}: the thank-you says where HIPHI will write ({d[:90]!r})')
        check(p.evaluate("document.activeElement?.id") == 'gp-done-h', f'{t}: focus moves to the thank-you')
        check(p.locator('.gp-done a[href="#/find"]').count() == 1, f'{t}: the thank-you has a way on (B-3)')
        check(p.locator('.gp-steps li.done').count() == 1 and 'Sent.' in text(p, '.gp-steps li.done'), f'{t}: the first step shows done')
        check(p.locator('[data-gp-jump]').count() == 0, f'{t}: no "Ask to join" after sending')
        common(p, f'{t} thank-you', w); shot(p, f'thanks-{t}')
        if w == 390:
            p.click('[data-gp-change]'); p.wait_for_selector('#gp-form #gp-contact_email', timeout=5000)
            check(p.input_value('#gp-contact_email') == 'leilani@example.org' and p.input_value('#gp-group_name') == 'Keiki Smiles Alliance' and p.is_checked('#gp-ok')
                  and p.evaluate("document.activeElement?.id") == 'gp-contact_email', f'{t}: "Wrong address? Change it" brings the form back as sent, on the email')
        c.close()

    # the day's cap, in the database's words; the sandbox never calls partner_request
    c, p = ctx(b); calls = []
    p.on('request', lambda r: calls.append(r.url) if HOST in r.url and 'partner_request' in r.url else None)
    open_page(p, '#/groups')
    for i in range(4):
        fill_all(p, 'kawika@example.org'); p.click('#gp-send'); p.wait_for_selector('#gp-done-h', timeout=5000); p.wait_for_timeout(200)
        if i < 3: p.reload(); p.wait_for_selector('#gp-form', timeout=45000); p.wait_for_timeout(300)   # a new page load: the thank-you stays for the rest of one
    d = text(p, '.gp-done')
    check('Thank you' in d and 'HIPHI has your request already.' in d and 'in touch' not in d, f'the fourth request in a day: "Thank you. HIPHI has your request already." ({d[:80]!r})')
    check(not calls, f'the practice copy never calls partner_request ({calls[:1]})')
    c.close()

    # an invite link fills in the group ("&" and "+" survive), says so, and never overwrites typed words
    c, p = ctx(b)
    open_page(p, '#/groups?name=Keiki%20%26%20Families&site=https%3A%2F%2Fkeikifamilies.org')
    check(p.input_value('#gp-group_name') == 'Keiki & Families' and p.input_value('#gp-website') == 'https://keikifamilies.org', f'invite: name and site filled ({p.input_value("#gp-group_name")!r})')
    check('HIPHI sent you this link, so your group’s name is filled in below.' in text(p), 'invite: says why the form is filled')
    shot(p, 'invite-390')
    p.click('[data-gp-jump]'); p.wait_for_timeout(600)
    check(p.evaluate("document.activeElement?.id") == 'gp-about', f'invite: Go to the form focuses the first empty field ({p.evaluate("document.activeElement?.id")})')
    p.evaluate("document.getElementById('gp-form').scrollIntoView()"); shot(p, 'invite-form-390')
    common(p, '390 invite', 390)
    # leaving and coming back keeps what was typed (B-4); a second invite fills only empty fields
    p.fill('#gp-about', 'Families first.'); p.wait_for_timeout(400)
    p.evaluate("location.hash = '#/more'"); p.wait_for_selector('#main .yu-you', timeout=8000)
    p.evaluate("location.hash = '#/groups?name=Other+Group'"); p.wait_for_selector('#gp-form', timeout=8000); p.wait_for_timeout(300)
    check(p.input_value('#gp-about') == 'Families first.' and p.input_value('#gp-group_name') == 'Keiki & Families', 'typed words survive leaving and coming back, and an invite never overwrites them')
    c.close()
    c, p = ctx(b, 1440, 900)
    open_page(p, '#/groups?name=Keiki+Smiles+Alliance&site=keikismiles.org')
    check(p.input_value('#gp-group_name') == 'Keiki Smiles Alliance', 'invite: "+" reads as a space (Staff v5 makes links with URLSearchParams)')
    check(not p.locator('[data-gp-jump]').is_visible(), 'invite on a laptop: no "Go to the form" (the form is in view)')
    shot(p, 'invite-1440')
    c.close()

    # the ways in: You's footer, Help, the website box
    c, p = ctx(b)
    open_page(p, '#/more', sel='#main .yu-you')
    foot = p.evaluate("[...document.querySelectorAll('#main .yu-foot .yu-fl')].map(e => [e.innerText.trim(), e.getAttribute('href')])")
    check(['For advocacy groups', '#/groups'] in foot, f'You: "For advocacy groups" in the footer ({foot})')
    p.click('#main .yu-foot a[href="#/groups"]'); p.wait_for_selector('#gp-form', timeout=8000)
    check(p.evaluate("document.querySelector('#main .rc-back')?.innerText.trim()") == 'You', 'opened from You, the back row says You')
    p.goto(f'{BASE}/track.html?demo=1#/help/advocacy-groups'); p.wait_for_selector('#main .tk-conv', timeout=30000)
    for _ in range(6):
        if not p.locator('[data-tknext]').count(): break
        p.click('[data-tknext]'); p.wait_for_timeout(350)
    check(p.locator('#main a[href="#/groups"]').count() >= 1, 'Help: "Can my group add its bills to the tracker?" leads to the page')
    p.locator('#main a[href="#/groups"]').first.click(); p.wait_for_selector('#gp-form', timeout=8000)
    check(p.evaluate("document.querySelector('#main .rc-back')?.innerText.trim()") == 'Help', 'opened from Help, the back row says Help')
    p.goto(f'{BASE}/embed.html?demo=1'); p.wait_for_function("!/Loading/.test(document.querySelector('#rows').innerText)", timeout=30000)
    j = p.evaluate("[document.querySelector('.join').innerText, document.getElementById('join').href]")
    check(j[0] == 'Are you an advocacy group? Add your bills ›' and j[1].endswith('track.html?via=embed&demo=1#/groups'), f'the website box invites groups ({j})')
    shot(p, 'embed-390', True)
    c.close()

    # the link screen in the practice copy
    for w, h in ((390, 844), (1440, 900), (320, 640)):
        c, p = ctx(b, w, h)
        open_page(p, '#/link/3f8a1c0e9b7d4a2f6e5c1b0a9d8e7f6a5b4c3d2e1f0a9b8c7d6e5f4a')
        txt = text(p)
        check(p.evaluate("document.querySelector('#main h1').innerText") == 'Sign in to the tracker' and p.locator('#gp-go').count() == 1, f'{w} link: "Sign in to the tracker" with Continue')
        check('Continue opens the sample group’s page, with no sign-in.' in txt and 'The link works once, and only for you.' in txt, f'{w} link: says what Continue does here')
        common(p, f'{w} link', w); shot(p, f'link-{w}')
        if w == 390:
            p.click('#gp-go'); p.wait_for_function("location.hash === '#/partner'", timeout=30000); p.wait_for_selector('#main .pt-corner', timeout=45000)
            check('partner=1' in p.url and 'Keiki Smiles Alliance' in text(p), f'link: Continue opens the sample group ({p.url.split("/")[-1]})')
        c.close()
    c, p = ctx(b)
    open_page(p, '#/link/')
    txt = text(p)
    check('This sign-in link isn’t complete.' in txt and p.locator('#gp-go').count() == 0 and p.locator('#main a[href="#/signin"]').count() == 1, 'an incomplete link: says so, no Continue, sign in by email instead')
    check('Continue' not in txt, 'an incomplete link: nothing speaks of Continue')
    common(p, '390 incomplete link', 390); shot(p, 'link-incomplete-390')
    c.close()

    # ================= B. the live page, every Supabase call answered here =================
    FAKE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' + base64.urlsafe_b64encode(json.dumps({'sub': '11111111-2222-3333-4444-555555555555', 'role': 'authenticated', 'email': 'leilani@example.org', 'exp': int(time.time()) + 3600, 'aud': 'authenticated'}).encode()).decode().rstrip('=') + '.sig'
    USER = {'id': '11111111-2222-3333-4444-555555555555', 'aud': 'authenticated', 'role': 'authenticated', 'email': 'leilani@example.org', 'email_confirmed_at': '2026-10-22T00:00:00Z', 'app_metadata': {'provider': 'email'}, 'user_metadata': {}, 'created_at': '2026-10-22T00:00:00Z'}
    SESSION = {'access_token': FAKE, 'token_type': 'bearer', 'expires_in': 3600, 'expires_at': int(time.time()) + 3600, 'refresh_token': 'r1', 'user': USER}
    GROUP = {'slug': 'keiki-smiles', 'name': 'Keiki Smiles Alliance', 'website': 'https://example.org', 'about': 'Healthy teeth.', 'welcome': None, 'status': 'active',
             'me': {'id': 'pp-1', 'name': 'Leilani K.', 'role': 'lead', 'terms_at': None}, 'people': [], 'bills': [], 'issues': [], 'visits': None}
    CORS = {'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS', 'access-control-expose-headers': 'content-range'}
    def live(b, w=390, h=844, verify='ok', request=None):
        c, p = ctx(b, w, h); calls = []
        def handle(route):
            r = route.request; path = r.url.split(HOST, 1)[1].split('?')[0]
            if r.method == 'OPTIONS': return route.fulfill(status=204, headers=CORS)
            send = lambda status, body: route.fulfill(status=status, headers={**CORS, 'content-type': 'application/json'}, body=json.dumps(body))
            if path.startswith('/auth/v1/'):
                calls.append(('auth ' + path[9:], r.post_data))
                if path.startswith('/auth/v1/verify'):
                    return send(200, SESSION) if verify == 'ok' else send(403, {'code': 403, 'error_code': 'otp_expired', 'msg': 'Email link is invalid or has expired'})
                if path.startswith('/auth/v1/token'): return send(200, SESSION)
                if path.startswith('/auth/v1/user'): return send(200, USER)
                if path.startswith('/auth/v1/settings'): return send(200, {'external': {'email': True, 'phone': False}, 'disable_signup': False})
                return send(200, {})
            if path.startswith('/rest/v1/rpc/'):
                fn = path[len('/rest/v1/rpc/'):]; body = json.loads(r.post_data or '{}') if r.post_data else {}
                calls.append(('rpc ' + fn, body))
                if fn == 'ensure_public_user': return send(200, {'id': USER['id'], 'email': USER['email'], 'prefs': {}, 'created_at': '2026-10-22T00:00:00Z'})
                if fn == 'my_partner': return send(200, {'groups': [GROUP]})
                if fn == 'partner_request': return request(body, send) if request else send(200, {'ok': True})
                return route.fulfill(status=200, headers={**CORS, 'content-type': 'application/json'}, body='null')
            if path.startswith('/rest/v1/'):
                calls.append(('get ' + path[9:], None))
                return send(200, [])
            return send(404, {})
        p.route(re.compile(r'https://' + re.escape(HOST) + r'/.*'), handle)
        return c, p, calls
    LIVE = f'{BASE}/track.html'
    TOKEN = '3f8a1c0e9b7d4a2f6e5c1b0a9d8e7f6a5b4c3d2e1f0a9b8c7d6e5f4a'
    for w, h in ((390, 844), (1440, 900)):
        c, p, calls = live(b, w, h)
        p.goto(f'{LIVE}#/link/{TOKEN}'); p.wait_for_selector('#gp-go', timeout=45000); p.wait_for_timeout(2500)
        check(not [k for k, _ in calls if k.startswith('auth verify')], f'{w} live: opening the link spends nothing (no verify before Continue)')
        check('practice copy' not in text(p), f'{w} live: no practice-copy line')
        check(p.locator('.hdr a[href^="#/signin"]').count() == 0, f'{w} live: no header Sign in beside Continue')
        common(p, f'{w} live link', w, errs_ok=('Failed to load resource',)); shot(p, f'live-link-{w}')
        p.click('#gp-go')
        p.wait_for_function("location.hash === '#/partner'", timeout=15000); p.wait_for_selector('#main .pt-terms', timeout=30000); p.wait_for_timeout(400)
        ver = [json.loads(d or '{}') for k, d in calls if k.startswith('auth verify')]
        check(len(ver) == 1 and ver[0].get('token_hash') == TOKEN and ver[0].get('type') == 'magiclink', f'{w} live: Continue checks the token_hash as a magic link, once ({ver[:1]})')
        names = [k for k, _ in calls]
        check('rpc ensure_public_user' in names and 'rpc my_partner' in names, f'{w} live: signed in, the account loads and the group is asked for')
        check('Before you write' in text(p) and 'Keiki Smiles Alliance' in text(p), f'{w} live: lands on the group’s page, signed in (the terms first)')
        tt = p.evaluate("document.getElementById('toast')?.innerText || ''")
        check('You’re signed in as leilani@example.org.' in tt, f'{w} live: says the sign-in worked ({tt[:80]!r})')
        check(p.evaluate("history.length") >= 1 and '#/link/' not in p.url, f'{w} live: the used link left the address')
        shot(p, f'live-signed-in-{w}')
        c.close()
    c, p, calls = live(b, verify='used')
    p.goto(f'{LIVE}#/link/{TOKEN}'); p.wait_for_selector('#gp-go', timeout=45000); p.wait_for_timeout(400)
    p.click('#gp-go'); p.wait_for_selector('#gp-lerr .notice', timeout=10000); p.wait_for_timeout(300)
    txt = text(p)
    check('Press Continue' not in txt, 'live: a used link no longer says "Press Continue"')
    check('This sign-in link has been used or has expired.' in txt and p.locator('#gp-go').count() == 0 and p.locator('#main a[href="#/signin"]').count() == 1, 'live: a used link says so, with sign-in by email instead')
    check(p.evaluate("location.hash").startswith('#/link/'), 'live: a used link stays on its screen')
    common(p, '390 live used link', 390, errs_ok=('Failed to load resource', 'otp_expired', 'AuthApiError', 'invalid or has expired')); shot(p, 'live-link-used-390')
    c.close()
    # the form, live: exactly its fields, a bare address with https://, then the thank-you; a refusal shown as it comes
    sent = []
    def req(body, send):
        sent.append(body)
        return send(200, {'ok': True}) if len(sent) > 1 else send(400, {'code': 'P0001', 'details': None, 'hint': None, 'message': 'Fill in the form'})
    c, p, calls = live(b, request=req)
    p.goto(f'{LIVE}#/groups'); p.wait_for_selector('#gp-form', timeout=45000); p.wait_for_timeout(400)
    check('Only HIPHI’s team sees what you send here.' in text(p), 'live form: says who sees it')
    fill_all(p); p.click('#gp-send'); p.wait_for_selector('#gp-ferr .notice', timeout=8000)
    check(text(p, '#gp-ferr') == 'Fill in the form.' and p.input_value('#gp-group_name') == 'Keiki Smiles Alliance', f'live form: a refusal is shown as it comes, every value kept ({text(p, "#gp-ferr")!r})')
    p.click('#gp-send'); p.wait_for_selector('#gp-done-h', timeout=8000)
    want = {'group_name': 'Keiki Smiles Alliance', 'website': 'https://keikismiles.org', 'about': 'Healthy teeth for every child in Hawaiʻi.', 'contact_name': 'Leilani K.',
            'contact_email': 'leilani@example.org', 'note': 'We work on HB 1671 and school meals.', 'not_campaign': True}
    check(sent and sent[-1] == {'p': want}, f'live form: partner_request gets exactly its fields ({sent[-1] if sent else None})')
    check('HIPHI will be in touch by email.' in text(p, '.gp-done') and 'nothing was sent' not in text(p, '.gp-done'), 'live form: the thank-you')
    shot(p, 'live-thanks-390')
    c.close()
    b.close()

print(f'\n{N[0] - len(FAILS)} of {N[0]} passed')
for f in FAILS: print('FAIL', f)
sys.exit(1 if FAILS else 0)
