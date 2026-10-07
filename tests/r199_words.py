# R-199 wave 1, the public page's words (10/6), in the sandbox, on a phone and a laptop:
#   C3-5  the email walkthrough's note says HIPHI doesn't send it and a copy only you can see is kept, as the privacy page does
#   X2-5  the privacy page names the AI helper and what its everyday access can't read
#   C2-1  late testimony's thank-you says it is marked late; "the account you just made" only after "No"; how to fix a mistake
#   C1-7  a suggested card's Follow says it follows the issue
#   B3-1  between sessions, a stopped bill says what happens next, "Follow the issue" leads, one ask for a newcomer
#   B3-3  "Anyone can send testimony", the late line, "not reached" after a stop, one "Follow the issue" per screen
#   C5-2  every share link carries the year
#   python3 tests/r199_words.py [base]     base defaults to http://localhost:8832/
import sys, os, re
from playwright.sync_api import sync_playwright
BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832/').rstrip('/') + '/'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'tests', 'out', 'r199'); os.makedirs(OUT, exist_ok=True)
res = []
def ok(c, m): res.append(bool(c)); print('PASS' if c else 'FAIL', m)
def ready(pg): pg.wait_for_function("() => !!document.querySelector('main') && !document.querySelector('.skelpage')", timeout=60000); pg.wait_for_timeout(1200)
SKIP = "() => { try { for (const x of ['', '_demo']) { localStorage.setItem('hiphi_wiz' + x, JSON.stringify({ done: true, step: 99 })); localStorage.setItem('hiphi_tour_bill' + x, '{\"how\":\"test\"}'); localStorage.setItem('hiphi_tour_home' + x, '{\"how\":\"test\"}'); } } catch {} }"
GPC = "Object.defineProperty(navigator, 'globalPrivacyControl', { get: () => true })"
dlg = lambda pg: pg.locator('#hp-dlg').inner_text() if pg.locator('#hp-dlg').count() else ''

def go(pg, path, extra=''):
    pg.goto(f'{BASE}track.html?demo=1{extra}#/{path}'); pg.reload(); ready(pg)

def walk_testimony(pg, num, acct='acct-yes', tag='', shots=True):
    """Open the walkthrough on the bill's hearing and walk it to the Mahalo. Returns the send screen's text."""
    go(pg, f'bill/{num}/testify'); pg.wait_for_selector('#hp-dlg', timeout=15000); pg.wait_for_timeout(800)
    send = ''
    for _ in range(16):
        if pg.locator('#hp-done-t').count(): break
        if pg.locator('#hp-dlg [data-hp="stance"][data-v="support"]').count(): pg.locator('#hp-dlg [data-hp="stance"][data-v="support"]').first.click(); pg.wait_for_timeout(500); continue
        if pg.locator('#hp-name').count() and not pg.input_value('#hp-name'): pg.fill('#hp-name', 'Leilani Kahale')
        if pg.locator('#hp-why').count() and not pg.input_value('#hp-why'): pg.fill('#hp-why', 'Our keiki deserve clean air.')
        if pg.locator(f'#hp-dlg [data-hp="{acct}"]').count(): pg.locator(f'#hp-dlg [data-hp="{acct}"]').click(); pg.wait_for_timeout(600); continue
        if 'Send it at the Capitol' in dlg(pg) or 'Did you see the green box' in dlg(pg):
            send = dlg(pg)
            if shots: pg.screenshot(path=os.path.join(OUT, f'{tag}-send.png'))
            pg.locator('#hp-dlg [data-hp="sent"], #hp-dlg [data-hp="confirm"]').first.click(); pg.wait_for_timeout(1200); continue
        b = pg.locator('#hp-dlg .hp-foot .hp-main')
        if not b.count(): break
        b.first.click(); pg.wait_for_timeout(800)
    return send

def run(w, h, mobile):
    tag = 'phone' if mobile else 'laptop'
    def ctx_new(skip=True):
        c = br.new_context(viewport={'width': w, 'height': h}, is_mobile=mobile, has_touch=mobile)
        c.add_init_script(GPC)
        if skip: c.add_init_script(f"({SKIP})()")
        return c
    ctx = ctx_new(); pg = ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))

    # C3-5: the email walkthrough's note on About you.
    go(pg, 'bill/HB1523/email'); pg.wait_for_selector('#hp-dlg', timeout=15000); pg.wait_for_timeout(800)
    for _ in range(6):
        if pg.locator('#hp-name').count(): break
        if pg.locator('#hp-dlg [data-hp="stance"][data-v="support"]').count(): pg.locator('#hp-dlg [data-hp="stance"][data-v="support"]').first.click(); pg.wait_for_timeout(500); continue
        pg.locator('#hp-dlg .hp-foot .hp-main').first.click(); pg.wait_for_timeout(600)
    t = dlg(pg)
    ok('HIPHI doesn’t send it.' in t and 'we keep a copy that only you can see, not HIPHI staff, so you can send it again' in t and 'never sees it' not in t,
       f'{tag} C3-5: the email note says HIPHI doesn’t send it and a private copy is kept')
    pg.screenshot(path=os.path.join(OUT, f'{tag}-c3-5-email-note.png'))

    # X2-5: the privacy page.
    go(pg, 'privacy'); t = pg.locator('main').inner_text()
    ok('Anthropic’s Claude' in t and 'can’t read anyone’s email, phone number, address, story or notes' in t and 'director says yes' in t,
       f'{tag} X2-5: the privacy page names the AI helper and what it can’t read')
    pg.locator('h2', has_text='Services that run the tracker').scroll_into_view_if_needed(); pg.screenshot(path=os.path.join(OUT, f'{tag}-x2-5-privacy.png'))

    # C2-1: on time, "Yes, I have an account": no "account you just made"; the Mahalo has the fix line.
    send = walk_testimony(pg, 'HB1523', 'acct-yes', f'{tag}-c2-1-yes')
    ok(send and 'account you just made' not in send, f'{tag} C2-1: after "Yes, I have an account", no "with the account you just made"')
    t = dlg(pg)
    ok('The committee reads it before they vote' in t and 'marked late' not in t, f'{tag} C2-1: on time, the thank-you says the committee reads it')
    fx = pg.locator('#hp-dlg .hp-fix')
    ok(fx.count() == 1 and 'Need to change it? Email or call the committee at Chair' in fx.inner_text() and fx.locator('a[href^="mailto:"]').count() >= 1,
       f'{tag} C2-1: the Mahalo says how to fix a mistake, with the chair’s office ({fx.inner_text() if fx.count() else "none"})')
    fx.scroll_into_view_if_needed() if fx.count() else None; pg.screenshot(path=os.path.join(OUT, f'{tag}-c2-1-mahalo.png'))
    ctx.close()
    # Late testimony (HB 1562: the deadline passed Sunday, the hearing is today).
    ctx = ctx_new(); pg = ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
    walk_testimony(pg, 'HB1562', 'acct-yes', f'{tag}-c2-1-late')
    t = dlg(pg)
    ok('It’s on the record, marked late. It may reach them after the vote.' in t and 'reads it before they vote' not in t, f'{tag} C2-1: late testimony’s thank-you says it is marked late')
    pg.screenshot(path=os.path.join(OUT, f'{tag}-c2-1-late-mahalo.png'))
    ctx.close()
    # "No, this is my first time": the send screen says "with the account you just made"; Something went wrong has the fix line.
    ctx = ctx_new(); pg = ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
    go(pg, 'bill/HB1523/testify'); pg.wait_for_selector('#hp-dlg', timeout=15000); pg.wait_for_timeout(800)
    for _ in range(12):
        if 'Send it at the Capitol' in dlg(pg): break
        if pg.locator('#hp-dlg [data-hp="stance"][data-v="support"]').count(): pg.locator('#hp-dlg [data-hp="stance"][data-v="support"]').first.click(); pg.wait_for_timeout(500); continue
        if pg.locator('#hp-name').count() and not pg.input_value('#hp-name'): pg.fill('#hp-name', 'Leilani Kahale')
        if pg.locator('#hp-dlg [data-hp="acct-no"]').count(): pg.locator('#hp-dlg [data-hp="acct-no"]').click(); pg.wait_for_timeout(500)
        if 'Make your free Capitol account' in dlg(pg):
            # As if they went to the Capitol tab to sign up and came back: the step then offers "I'm signed up".
            pg.evaluate("async () => { const c = await import('./pub/core.js'); c.S.helper.acctAway = true; document.dispatchEvent(new Event('visibilitychange')); }"); pg.wait_for_timeout(600)
            pg.locator('#hp-dlg [data-hp="acct-done"]').click(); pg.wait_for_timeout(600)
            continue
        pg.locator('#hp-dlg .hp-foot .hp-main').first.click(); pg.wait_for_timeout(700)
    t = dlg(pg)
    ok('Log in to the Capitol website with the account you just made.' in t, f'{tag} C2-1: after "No, this is my first time", the send screen says "with the account you just made"')
    pg.locator('#hp-dlg .hp-foot .hp-main').first.click(); pg.wait_for_timeout(700)
    for p in ctx.pages[1:]: p.close()
    pg.evaluate("() => document.dispatchEvent(new Event('visibilitychange'))"); pg.wait_for_timeout(600)
    pg.locator('#hp-dlg [data-hp="trouble"]').click(); pg.wait_for_timeout(500)
    tr = pg.locator('#hp-dlg .hp-trouble')
    ok(tr.count() == 1 and 'Need to change it? Email or call the committee at Chair' in tr.inner_text(), f'{tag} C2-1: "Something went wrong" says how to fix a mistake')
    pg.screenshot(path=os.path.join(OUT, f'{tag}-c2-1-trouble.png'))
    ctx.close()

    # C1-7: a suggested card's Follow (Find's suggestions, as someone who follows one issue).
    ctx = ctx_new(); pg = ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
    go(pg, 'find')
    labels = pg.evaluate("[...document.querySelectorAll('.acard [data-follow][aria-pressed=\"false\"]')].map(b => [b.innerText.trim(), b.getAttribute('aria-label') || ''])")
    ok(labels and all(l[0] in ('Follow this issue', 'Follow this bill') for l in labels) and any(l[0] == 'Follow this issue' and l[1].startswith('Follow this issue: ') for l in labels),
       f'{tag} C1-7: a suggested card says "Follow this issue" and names it for a screen reader ({labels[:2]})')
    if labels: pg.locator('.acard [data-follow]').first.scroll_into_view_if_needed(); pg.screenshot(path=os.path.join(OUT, f'{tag}-c1-7-suggested.png'))

    # B3-3: a watched bill with a hearing whose deadline passed (HB 1605): "Anyone", and the late line.
    go(pg, 'bill/HB1605'); t = pg.locator('main').inner_text()
    ok('Anyone in Hawaiʻi' not in t and ('Anyone can still send it on the Capitol website; it will be marked late.' in t or 'Anyone can send testimony on the Capitol website.' in t),
       f'{tag} B3-3: "Anyone can send testimony", with the late line after the deadline')
    # B3-3: a stopped bill in session (SB 1525): the later steps are "not reached"; one "Follow the issue".
    go(pg, 'bill/SB1525'); t = pg.locator('main').inner_text()
    sr = pg.evaluate("[...document.querySelectorAll('.bl-dots .sr')].map(e => e.textContent)")
    ok(sr and not any('still ahead' in s for s in sr) and any('not reached' in s for s in sr), f'{tag} B3-3: after a stop, screen readers hear "not reached" ({sr[-1] if sr else ""})')
    nf = pg.evaluate("[...document.querySelectorAll('[data-bl-followissue], [data-bl-newfollow]')].filter(e => e.offsetParent !== null).length")
    ok(nf == 1, f'{tag} B3-3: one "Follow the issue" on the stopped bill’s screen ({nf})')
    pg.screenshot(path=os.path.join(OUT, f'{tag}-b3-3-stopped-in-session.png'))
    ctx.close()

    # B3-1: between sessions, a stopped bill (HB 2121) for a follower of nothing, then a newcomer from a link.
    for who in ('visitor', 'newcomer'):
        ctx = ctx_new(skip=who == 'visitor'); pg = ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
        go(pg, 'bill/HB2121', '&season=off' + ('&via=share' if who == 'newcomer' else ''))
        t = pg.locator('main').inner_text()
        ok('Stopped in 2026. This bill can’t come back, but its idea can, as a new bill when the Legislature meets on January 20.' in t,
           f'{tag} B3-1 ({who}): the stopped bill says what happens next')
        main = pg.locator('.actionbar .btn.primary, .bl-do .btn.primary').first
        ok(main.count() and main.inner_text().strip() == 'Follow the issue', f'{tag} B3-1 ({who}): the main button is "Follow the issue" ({main.inner_text().strip() if main.count() else ""})')
        nf = pg.evaluate("[...document.querySelectorAll('[data-bl-followissue], [data-bl-newfollow]')].filter(e => e.offsetParent !== null).length")
        ok(nf == 1, f'{tag} B3-1 ({who}): one follow ask on the page ({nf})')
        fl = pg.locator('.bl-after a[href^="#/legislators"]')
        ok(fl.count() == 1 and 'Find your legislators' in fl.inner_text(), f'{tag} B3-1 ({who}): "Find your legislators" is the second choice')
        pg.screenshot(path=os.path.join(OUT, f'{tag}-b3-1-{who}.png'), full_page=False)
        pg.locator('.bl-after').scroll_into_view_if_needed(); pg.screenshot(path=os.path.join(OUT, f'{tag}-b3-1-{who}-next.png'))
        if who == 'newcomer':
            main.click(); pg.wait_for_timeout(2500)
            ok(pg.evaluate("async () => { const c = await import('./pub/core.js'); return c.followedIssues().length; }") >= 1, f'{tag} B3-1 (newcomer): the main button follows the issue')
        ctx.close()

    # C5-2: the share links carry the year (the live-site form, read from the module outside the practice copy).
    ctx = ctx_new(); pg = ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
    go(pg, '')
    urls = pg.evaluate("""async () => { const c = await import('./pub/core.js');
      const b = { bill_number: 'HB2121', session_year: 2026, hiphi_position: 'support' };
      return [c.billShareUrl(b, 'testify'), c.billShareUrl(b, ''), c.billShareUrl({ ...b, hiphi_position: null }, 'testify')]; }""")
    ok(urls[0].endswith('/b/demo/HB2121-testify'), f'{tag} C5-2: the practice copy keeps its own pages ({urls[0]})')
    ok(urls[2].endswith('#/bill/2026/HB2121/testify'), f'{tag} C5-2: a bill with no page shares the tracker’s address with its year ({urls[2]})')
    ctx.close()
    ok(not errs, f'{tag}: no page errors {errs[:2]}')

with sync_playwright() as p:
    br = p.chromium.launch()
    run(390, 844, True)
    run(1366, 900, False)
    br.close()
print(f'{sum(res)}/{len(res)} passed')
sys.exit(0 if all(res) else 1)
