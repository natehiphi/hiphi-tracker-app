# Staff v2, Session setup > Privacy and keeping (R-180 wave 2: J2-1 forget a person, J2-2 the keeping periods; backend 159).
# python3 tests/staff_privacy.py [base_url]   (sandbox; nothing reaches Supabase)
# Checks: the part is listed under Advanced; the form takes an email, a number or both and says what it does; both empty, a bad email
# and a bad number are refused in plain words; a good one asks first, then says what was done (counts, no identifier) and clears the
# fields; the keeping table lists the six kinds with their periods; the switch asks before turning the clean-up on and says so after;
# the page fits at 390 and 1440 wide with no sideways scroll; no console errors.
import os, re, sys
from playwright.sync_api import sync_playwright
# Screenshots go to tests/out (git-ignored), as in the older tests: a Mac-only folder crashed the test on GitHub's machine (R-200).
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out'); os.makedirs(OUT, exist_ok=True)
BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832/staff.html').split('#')[0]
passes, fails, errors = [], [], []
def ok(c, m): (passes if c else fails).append(('PASS ' if c else 'FAIL ') + m)
with sync_playwright() as pw:
    b = pw.chromium.launch()
    for W, H in ((1440, 900), (390, 844)):
        c = b.new_context(viewport={'width': W, 'height': H}); p = c.new_page()
        p.on('pageerror', lambda e: errors.append(str(e)[:160])); p.on('console', lambda m: errors.append(m.text[:160]) if m.type == 'error' and 'favicon' not in m.text else None)
        c.route(re.compile(r'.*supabase\.co/.*'), lambda r: r.abort())
        p.goto(BASE + '?demo=1#/setup'); p.reload(); p.wait_for_timeout(2600)
        tag = f'@{W}'
        ok(p.locator('a[href="#/setup/privacy"]').count() >= 1, f'{tag} Session setup lists "Privacy and keeping"')
        p.goto(BASE + '?demo=1#/setup/privacy'); p.reload(); p.wait_for_timeout(2600)
        t = p.inner_text('main')
        ok('Forget a person' in t and 'contact@hiphi.org' in t and 'cannot be undone' in t and 'never touches a team member' in t, f'{tag} the form says what it does')
        ok(p.locator('#st-fg-email').count() == 1 and p.locator('#st-fg-phone').count() == 1, f'{tag} an email box and a number box')
        ok(p.locator('table.st-kptable tbody tr').count() == 6 and '7 years' in t and '30 days' in t and '4 years' in t and '1 year' in t, f'{tag} the keeping table: six kinds, with their periods')
        ok('The clean-up is off' in t and 'deletes nothing' in t, f'{tag} it says the clean-up is off')
        p.locator('[data-stsave]').first.click(); p.wait_for_timeout(400)
        ok('Give an email' in p.inner_text('main'), f'{tag} nothing given: refused in plain words')
        p.fill('#st-fg-email', 'nope'); p.locator('[data-stsave]').first.click(); p.wait_for_timeout(300)
        ok('does not look like an email' in p.inner_text('main'), f'{tag} a bad email is refused')
        p.fill('#st-fg-email', ''); p.fill('#st-fg-phone', '12345'); p.locator('[data-stsave]').first.click(); p.wait_for_timeout(300)
        ok('10-digit mobile number' in p.inner_text('main'), f'{tag} a bad number is refused')
        p.fill('#st-fg-email', 'someone@example.org'); p.fill('#st-fg-phone', '(808) 555-0123'); p.locator('[data-stsave]').first.click(); p.wait_for_timeout(500)
        ok(p.locator('[data-yes]').count() == 1 and 'cannot be undone' in p.inner_text('body'), f'{tag} it asks first, naming both')
        p.locator('[data-yes]').first.click(); p.wait_for_timeout(900)
        body = p.inner_text('body')
        ok('Done' in body and 'the sandbox' in body and 'account' in body and '555' not in body.split('Done')[1][:200], f'{tag} it says what was done, with counts and no number')
        ok(p.input_value('#st-fg-email') == '' and p.input_value('#st-fg-phone') == '', f'{tag} and clears the boxes')
        p.locator('[data-kpset="1"]').first.click(); p.wait_for_timeout(500)
        ok('Turn the clean-up on?' in p.inner_text('body'), f'{tag} the switch asks before turning the clean-up on')
        p.locator('[data-yes]').first.click(); p.wait_for_timeout(900)
        ok('The clean-up is on' in p.inner_text('main') and p.locator('[data-kpset="0"]').count() == 1, f'{tag} then says it is on, with a way to turn it off')
        ok(not p.evaluate('document.documentElement.scrollWidth > innerWidth + 1'), f'{tag} no sideways scroll')
        small = p.evaluate("[...document.querySelectorAll('.st-form button, .st-form input, .st-keeping button, [data-stsave]')].filter(e => e.offsetParent && !e.closest('table')).map(e => [e.textContent.trim().slice(0, 24), Math.round(e.getBoundingClientRect().height)]).filter(([, h]) => h < 44)")
        ok(not small, f'{tag} every target is 44px tall: {small[:4]}')
        p.screenshot(path=os.path.join(OUT, f'privacy_{W}.png'), full_page=True)
        c.close()
    b.close()
ok(not errors, 'no console errors' + ('' if not errors else ': ' + ' | '.join(errors[:4])))
print('\n'.join(passes + fails)); print(f'\n{len(passes)} passed, {len(fails)} failed')
sys.exit(1 if fails else 0)
