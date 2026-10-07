# The unsubscribe page every email links to (X1-7, R-180 wave 2; backend supabase/functions/unsubscribe v2 and migration 161).
# python3 tests/unsubscribe_page.py [origin]   (the function is faked: nothing reaches Supabase)
# Checks: opening the link changes nothing (no request is sent until the button is pressed); the heading names what will stop
# (hearing alerts, action alerts, all email); the button posts the one-click form to the function once, with the token and
# what in the address; "Done" says what stopped and masks the address; an unknown account and a failed send each say so in plain
# words and give the contact; a link with no token says it looks incomplete and offers no button; "No, keep them" goes to the
# tracker; the page fits at 375 with 44px targets and no sideways scroll; no console errors.
import re, sys
from playwright.sync_api import sync_playwright
ORIGIN = (sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832').rstrip('/')
TOK = '0b1c2d3e-4f50-4a6b-8c7d-9e0f1a2b3c4d'
passes, fails, errors = [], [], []
def ok(c, m): (passes if c else fails).append(('PASS ' if c else 'FAIL ') + m)
def run(b, what, reply, tag):
    c = b.new_context(viewport={'width': 375, 'height': 667}); p = c.new_page(); calls = []
    p.on('pageerror', lambda e: errors.append(str(e)[:160])); p.on('console', lambda m: errors.append(m.text[:160]) if m.type == 'error' and 'favicon' not in m.text and 'Failed to load resource' not in m.text else None)   # the fonts are blocked in the test
    def fake(route):
        req = route.request; calls.append((req.method, req.url, req.post_data))
        route.fulfill(status=reply[0], content_type='application/json', headers={'access-control-allow-origin': '*'}, body=reply[1])
    p.route(re.compile(r'.*/functions/v1/unsubscribe.*'), fake)
    p.route(re.compile(r'.*(fonts\.googleapis|fonts\.gstatic).*'), lambda r: r.abort())
    p.goto(f'{ORIGIN}/unsubscribe.html?u={TOK}&what={what}'); p.wait_for_timeout(300)
    return c, p, calls
with sync_playwright() as pw:
    b = pw.chromium.launch()
    for what, head in (('hearing', 'Stop hearing alerts?'), ('action', 'Stop action alerts?'), ('all', 'Stop all email from the tracker?')):
        c, p, calls = run(b, what, (200, '{"ok":true,"said":"You will no longer get hearing alerts.","account":"n…@example.org"}'), what)
        ok(p.inner_text('#u-h') == head and 'Nothing changes until you press the button' in p.inner_text('#u-p'), f'{what}: the heading says what will stop, and that nothing changes yet ({p.inner_text("#u-h")!r})')
        ok(calls == [], f'{what}: opening the link sent nothing')
        if what == 'hearing':
            small = p.evaluate("[...document.querySelectorAll('button, a.keep')].map(e => [e.textContent.trim(), Math.round(e.getBoundingClientRect().height)]).filter(([, h]) => h < 44)")
            ok(not small and not p.evaluate('document.documentElement.scrollWidth > innerWidth + 1'), f'375: every target is 44px tall and nothing scrolls sideways ({small})')
            ok(p.locator('a#u-keep').get_attribute('href') == 'track.html', 'No, keep them goes to the tracker')
            p.click('#u-go'); p.wait_for_timeout(500)
            ok(len(calls) == 1 and calls[0][0] == 'POST' and f'u={TOK}' in calls[0][1] and 'what=hearing' in calls[0][1] and calls[0][2] == 'List-Unsubscribe=One-Click', f'the button posts the one-click form once, token and what in the address ({calls})')
            t = p.inner_text('#u-card')
            ok(t.startswith('Done') and 'You will no longer get hearing alerts.' in t and 'n…@example.org' in t and p.locator('#u-go').is_hidden(), 'Done: says what stopped, shows the masked address, no button left')
            p.screenshot(path='/private/tmp/claude-501/unsub_done.png')
        c.close()
    c, p, calls = run(b, 'all', (404, '{"ok":false,"why":"unknown"}'), 'unknown'); p.click('#u-go'); p.wait_for_timeout(400)
    ok('could not find that account' in p.inner_text('#u-card') and 'contact@hiphi.org' in p.inner_text('#u-card'), 'an unknown account says so and gives the contact'); c.close()
    c, p, calls = run(b, 'all', (500, '{"ok":false,"why":"error"}'), 'error'); p.click('#u-go'); p.wait_for_timeout(400)
    ok('did not go through' in p.inner_text('#u-card') and p.inner_text('#u-go') == 'Try again' and 'contact@hiphi.org' in p.inner_text('#u-card'), 'a failure says so, offers Try again and the contact'); c.close()
    c = b.new_context(viewport={'width': 375, 'height': 667}); p = c.new_page(); p.route(re.compile(r'.*fonts.*'), lambda r: r.abort())
    p.goto(f'{ORIGIN}/unsubscribe.html'); p.wait_for_timeout(300)
    ok('looks incomplete' in p.inner_text('#u-h'), 'no token: it says the link looks incomplete')
    ok(p.locator('#u-row').is_hidden(), 'no button without a token'); c.close()
    b.close()
ok(not errors, 'no console errors' + ('' if not errors else ': ' + ' | '.join(errors[:4])))
print('\n'.join(passes + fails)); print(f'\n{len(passes)} passed, {len(fails)} failed')
sys.exit(1 if fails else 0)
