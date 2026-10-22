# A second device says where the letters are, and sign-in brings them (R-212 #31; the Capitol Regular walk: "a second
# device keeps only follows and offers Write my testimony again"). In the practice copy served locally (signed out):
#   W1  the profile with letters kept here: "Your letters" says "Kept on this device only." with a Sign in link
#   W2  the profile with none kept here: the section still shows, saying where letters are kept, with a Sign in link
#   W3  "Your session" (#/recap): "Only what you did on this phone or computer shows here." with a Sign in link
#   W4  no profile yet: the sign-in line says "everything comes with you"
#   W5  signed in (S.session and S.user set by hand): "Kept with your account"; with none here, sign in on the other device;
#       the session page has a line only when nothing is counted
#   W6  the words of the sign-in toast (kernel.js cameWords): one letter, two, an email, a mix
#   W7  #/profile?to=letters lands on "Your letters"
#   no page errors, on a phone and a laptop
#   python3 tests/second_device.py [base] [outdir]     base defaults to http://localhost:8832/
import sys, os
from playwright.sync_api import sync_playwright
BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832/').rstrip('/') + '/'
OUT = sys.argv[2] if len(sys.argv) > 2 else '.'
PUB = BASE + 'track.html?demo=1'
res = []
def ok(c, m): res.append(bool(c)); print('PASS' if c else 'FAIL', m)
def ready(pg): pg.wait_for_function("() => !!document.querySelector('main') && !document.querySelector('.skelpage')", timeout=60000); pg.wait_for_timeout(900)
WIZ = "localStorage.setItem('hiphi_wiz', JSON.stringify({ ...JSON.parse(localStorage.getItem('hiphi_wiz') || '{}'), done: true, step: 99 })); localStorage.setItem('hiphi_wiz_demo', localStorage.getItem('hiphi_wiz')); for (const k of ['hiphi_tour_bill', 'hiphi_tour_home', 'hiphi_tour_bill_demo', 'hiphi_tour_home_demo']) localStorage.setItem(k, '{\"how\":\"test\"}');"
TEXT = "for (const k of ['hiphi_text', 'hiphi_text_demo']) localStorage.setItem(k, JSON.stringify({ token: 'test-token', phone: '8085550142', at: '2026-02-01T00:00:00.000Z' }));"
def ctx_for(br, vp, mob, profile):
    c = br.new_context(viewport=vp, is_mobile=mob, has_touch=mob)
    c.add_init_script("(() => { try { " + WIZ + (TEXT if profile else '') + " } catch {} })()")
    return c
text = lambda pg, sel: pg.locator(sel).inner_text() if pg.locator(sel).count() else ''

with sync_playwright() as p:
    br = p.chromium.launch()
    for name, vp, mob in (('phone', {'width': 390, 'height': 844}, True), ('laptop', {'width': 1280, 'height': 860}, False)):
        errs = []
        # W1: letters kept here.
        c = ctx_for(br, vp, mob, True); pg = c.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(PUB + '&letter&email#/profile'); ready(pg)
        t = text(pg, '#pf-letters')
        ok('Kept on this device only.' in t and pg.locator('#pf-letters .myl-where a.myl-signin[href^="#/signin"]').count() == 1 and pg.locator('#pf-letters [data-myl]').count() >= 2,
           f'{name} W1: with letters here, "Kept on this device only." and a Sign in link ({t[-120:]!r})')
        if name == 'phone': pg.locator('#pf-letters').screenshot(path=os.path.join(OUT, f'r212-31-letters-{name}.png'))
        # W7: the toast's link lands on the section.
        pg.goto(PUB + '&letter&email#/find'); ready(pg); pg.goto(PUB + '&letter&email#/profile?to=letters'); ready(pg)
        ok(pg.evaluate("document.activeElement?.id") == 'pf-letters-t', f'{name} W7: #/profile?to=letters focuses "Your letters" ({pg.evaluate("document.activeElement?.id")!r})')
        # W5: signed in, by hand: the account line, and no session-page line.
        w = pg.evaluate("""async () => { const k = await import('./pub/kernel.js'), m = await import('./pub/myletters.js');
          const was = [k.S.session, k.S.user]; k.S.session = { user: {} }; k.S.user = { id: 'x' };
          const r = [m.lettersWhere(true), m.lettersWhere(false), m.sessionWhere(), m.sessionWhere(true)]; [k.S.session, k.S.user] = was; return r; }""")
        ok('Kept with your account, on any phone or computer you sign in on.' in w[0] and 'Sign in there with the same' in w[1] and w[2] == '' and 'Did something on another phone or computer?' in w[3],
           f'{name} W5: signed in, "Kept with your account"; with none, sign in there; the session line only when nothing is counted')
        # W6: the toast's words.
        cw = pg.evaluate("""async () => { const k = await import('./pub/kernel.js'), L = k => ({ kind: k });
          return [k.cameWords([L('testimony')]), k.cameWords([L('testimony'), L('testimony')]), k.cameWords([L('email')]), k.cameWords([L('testimony'), L('email'), L('email')])]; }""")
        ok(cw == ['Your letter from another device is here.', 'Your 2 letters from another device are here.', 'Your email from another device is here.',
                  'Your 3 letters and emails from another device are here.'], f'{name} W6: the toast words {cw}')
        c.close()
        # W2 and W3: a profile with none kept here (the second device).
        c = ctx_for(br, vp, mob, True); pg = c.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(PUB + '#/profile'); ready(pg)
        t = text(pg, '#pf-letters')
        ok('will be listed here, on the phone or computer you send them from' in t and 'Sent some on another one?' in t and pg.locator('#pf-letters a.myl-signin').count() == 1 and pg.locator('#pf-letters [data-myl]').count() == 0,
           f'{name} W2: with none here, the section says where they are, with Sign in ({t[-160:]!r})')
        if name == 'phone': pg.locator('#pf-letters').screenshot(path=os.path.join(OUT, f'r212-31-none-{name}.png'))
        pg.goto(PUB + '#/recap'); ready(pg)
        t = text(pg, '.hm-rcpwhere')
        ok('Only what you did on this phone or computer shows here.' in t and pg.locator('.hm-rcpwhere a.myl-signin').count() == 1, f'{name} W3: the session page says what it counts ({t!r})')
        if name == 'phone': pg.screenshot(path=os.path.join(OUT, f'r212-31-recap-{name}.png'), full_page=True)
        c.close()
        # W4: no profile.
        c = ctx_for(br, vp, mob, False); pg = c.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(PUB + '#/profile'); ready(pg)
        t = text(pg, '.pf-back')
        ok('everything comes with you' in t, f'{name} W4: no profile, the sign-in line ({t!r})')
        c.close()
        ok(not errs, f'{name}: no page errors {errs[:2]}')
    br.close()
print(f'{sum(res)}/{len(res)} passed'); sys.exit(0 if all(res) else 1)
