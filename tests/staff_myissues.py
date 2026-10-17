# My issues (R-263): the main menu's My issues is the list of your issues and where each stands in getting ready for 2027
# (Nate 10/16 had the 12 Oct page, each issue with its bills, go back to this list). Walked in the sandbox (frozen 16 March
# 2026) at a phone and a laptop width: the menu item, the list, the old address, Back from an issue, and the bills of your
# issues still in Bills > Mine (data.js isMine).
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
        ok(p.evaluate("document.querySelector('.pr-top h1')?.innerText") == 'My issues', f'{tag}: the page is headed My issues')
        ok(p.evaluate("[...document.querySelectorAll('.le-deskback')].filter(a => a.offsetParent).length") == 0, f'{tag}: a menu page has no Back link')
        ok(p.evaluate(f"document.querySelector('{nav}[aria-current=\"page\"]')?.innerText.trim().split('\\n')[0]") == 'My issues', f'{tag}: the menu marks My issues')
        rows = p.evaluate("document.querySelectorAll('.pr-row').length")
        heads = p.evaluate("[...document.querySelectorAll('.pr-page h2')].map(h => h.innerText.trim())")
        ok(rows > 0 and 'Yours' in heads, f'{tag}: {rows} issues, under {heads}')
        ok(p.locator('.mi-iss').count() == 0, f'{tag}: the 12 Oct page (each issue with its bills) is gone')
        lede = p.evaluate("document.querySelector('.pr-top .le-lede')?.innerText || ''")
        ok('ready' in lede and 'Due' in lede, f'{tag}: the lede says how many are ready and when ({lede[:60]!r})')
        rep = checks.page_report(p, 'myissues'); ok(not rep['overflow'], f'{tag}: no sideways scroll')
        if tag == 'p': ok(not rep['small_targets'], f'{tag}: targets {rep["small_targets"][:3]}')
        p.screenshot(path=f'{OUT}/{tag}_myissues.png', full_page=True)
        p.screenshot(path=f'{OUT}/{tag}_myissues_top.png')
        # the bills of my issues are still mine (R-263's other half, unchanged)
        mine_ids = p.evaluate("(async () => { const d = await import('./staff/data.js'); return [...d.myIssueBills()].filter(id => d.S.bills.some(b => b.id === id && b.tracked !== false && !d.isMuted(b))); })()")
        in_mine = p.evaluate("(async () => { const d = await import('./staff/data.js'); return d.S.bills.filter(d.isMine).map(b => b.id); })()")
        ok(mine_ids and set(mine_ids) <= set(in_mine), f'{tag}: all {len(mine_ids)} bills on my issues are in Mine')
        # an issue opened here comes Back to My issues
        p.locator('.pr-main').first.click(); p.wait_for_timeout(1000)
        ok('#/issue/' in p.url, f'{tag}: an issue opens its page')
        back = p.evaluate("[...document.querySelectorAll('.le-deskback, .sv-back')].filter(a => a.offsetParent).map(a => a.innerText.trim())")
        ok(any('My issues' in x for x in back), f'{tag}: its Back says My issues ({back})')
        # the address the Today notice and Slack used before still opens it
        p.goto(BASE + '#/outreach/issues?view=mine'); p.wait_for_timeout(1000)
        ok(p.evaluate("document.querySelector('.pr-top h1')?.innerText") == 'My issues', f'{tag}: the old address opens My issues')
        c.close()
    b.close()

print('\n'.join(results + fails + [f'ERROR {e}' for e in errors]))
print(f'{len(results)} passed, {len(fails)} failed, {len(errors)} page errors')
sys.exit(1 if fails or errors else 0)
