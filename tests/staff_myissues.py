# My issues (R-263, Nate 10/12): staff own issues and work bills. Walked in the sandbox (frozen 16 March 2026, in session)
# at a phone and a laptop width: the menu item, the page (each issue the person owns or helps on, soonest work first, its
# bills under it), Bills > Mine holding the bills of those issues with the issue's tag, and Back from an issue to My issues.
#   python3 tests/staff_myissues.py [base]     base defaults to http://localhost:8832
import os, sys
from playwright.sync_api import sync_playwright
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import checks
ROOT = (sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832').rstrip('/')
BASE = ROOT + '/staff.html?demo=1'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out', 'myissues'); os.makedirs(OUT, exist_ok=True)
results, fails, errors = [], [], []
def ok(c, m): (results if c else fails).append(('PASS ' if c else 'FAIL ') + m)

with sync_playwright() as pw:
    b = pw.chromium.launch()
    for W, H, tag in ((390, 844, 'p'), (1440, 900, 'd')):
        c = b.new_context(viewport={'width': W, 'height': H}, is_mobile=W < 600, has_touch=W < 600)
        p = c.new_page()
        p.on('pageerror', lambda e: errors.append(f'{W}: {e}'))
        p.goto(BASE + '#/'); p.reload(); p.wait_for_timeout(3500)
        nav = '.sv-tabs a' if W < 900 else '.sv-side a'
        labels = p.evaluate(f"[...document.querySelectorAll('{nav}')].map(a => a.innerText.trim().split('\\n')[0])")
        ok('My issues' in labels, f'{tag}: the main menu has My issues ({labels[:6]})')
        p.goto(BASE + '#/my-issues'); p.wait_for_timeout(1500)
        ok(p.evaluate("document.querySelector('main h1, .le-h1')?.innerText") == 'My issues', f'{tag}: the page is headed My issues')
        secs = p.evaluate("[...document.querySelectorAll('.mi-iss')].map(s => ({ name: s.querySelector('h2').innerText.trim(), meta: s.querySelector('.mi-head .meta').textContent, bills: s.querySelectorAll('.le-brow').length, now: s.querySelector('.mi-now')?.innerText || '' }))")
        ok(len(secs) >= 2, f'{tag}: {len(secs)} issues listed')
        ok(any('You own it' in s['meta'] for s in secs) and any('You help on it' in s['meta'] for s in secs), f'{tag}: issues owned and helped on are both there')
        ok(p.evaluate("[...document.querySelectorAll('.mi-iss .is-bstat')].every(e => !/No owner|Owner: You/.test(e.innerText))"), f'{tag}: no bill line says "No owner" or "Owner: You" (the issue is yours)')
        ok(sum(s['bills'] for s in secs) > 0, f'{tag}: the issues carry their bills')
        lede = p.evaluate("document.querySelector('.le-lede')?.innerText || ''")
        ok(lede.startswith('You own'), f'{tag}: the lede says what is yours ({lede[:80]!r})')
        # soonest work first: an issue with a hearing on a bill never comes after one without (outside the fold)
        order = p.evaluate("[...document.querySelectorAll('.mi-page > .mi-iss')].map(s => [...s.querySelectorAll(':scope > .le-bills .is-bstat')].some(e => /Hearing /.test(e.innerText)) ? 0 : 1)")
        ok(order and order == sorted(order), f'{tag}: issues with a hearing lead')
        ok(p.locator('.mi-still').count() == 1, f'{tag}: issues with nothing moving wait in one fold at the end')
        rep = checks.page_report(p, 'myissues'); ok(not rep['overflow'], f'{tag}: no sideways scroll')
        if tag == 'p': ok(not rep['small_targets'], f'{tag}: targets {rep["small_targets"][:3]}')
        p.screenshot(path=f'{OUT}/{tag}_myissues.png', full_page=True)
        p.screenshot(path=f'{OUT}/{tag}_myissues_top.png')
        # every bill on my issues is in Bills > Mine
        mine_ids = p.evaluate("(async () => { const d = await import('./staff/data.js'); return [...d.myIssueBills()].filter(id => d.S.bills.some(b => b.id === id && b.tracked !== false && !d.isMuted(b))); })()")
        in_mine = p.evaluate("(async () => { const d = await import('./staff/data.js'); return d.S.bills.filter(d.isMine).map(b => b.id); })()")
        ok(mine_ids and set(mine_ids) <= set(in_mine), f'{tag}: all {len(mine_ids)} bills on my issues are in Mine')
        # Back from an issue opened here returns to My issues
        p.locator('.mi-iss h2 a').first.click(); p.wait_for_timeout(1000)
        ok('#/issue/' in p.url, f'{tag}: an issue opens its page')
        back = p.evaluate("[...document.querySelectorAll('.le-deskback, .sv-back')].filter(a => a.offsetParent).map(a => a.innerText.trim())")
        ok(any('My issues' in x for x in back), f'{tag}: its Back says My issues ({back})')
        # the prep list kept its own name
        p.goto(BASE + '#/outreach/issues?view=mine'); p.wait_for_timeout(1000)
        ok('Your issues for 2027' in p.evaluate("document.body.innerText"), f'{tag}: the 2027 prep list is "Your issues for 2027"')
        c.close()
    b.close()

print('\n'.join(results + fails + [f'ERROR {e}' for e in errors]))
print(f'{len(results)} passed, {len(fails)} failed, {len(errors)} page errors')
sys.exit(1 if fails or errors else 0)
