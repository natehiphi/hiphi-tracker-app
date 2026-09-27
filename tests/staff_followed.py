# Sort new bills lists the bills people follow on the public tracker that the team does not track (R-059, migration
# 074). python3 tests/staff_followed.py [host]. The sandbox shows sample bills with sample counts (DB.triageFollowed).
import os, sys
from playwright.sync_api import sync_playwright
HOST = sys.argv[1] if len(sys.argv) > 1 else os.environ.get('HOST', 'http://localhost:8832')
passes, fails, errors = [], [], []
def ok(c, m): (passes if c else fails).append(('PASS ' if c else 'FAIL ') + m)

with sync_playwright() as pw:
    b = pw.chromium.launch()
    for (w, h) in [(1280, 800), (1024, 768), (390, 844), (320, 640)]:
        tag = f'{w}x{h}'; phone = w < 600
        c = b.new_context(viewport={'width': w, 'height': h}, is_mobile=phone, has_touch=phone); p = c.new_page()
        p.on('pageerror', lambda e: errors.append(f'{w}: {e}'))
        p.on('console', lambda m: errors.append(f'console {w}: {m.text[:140]}') if m.type == 'error' and 'favicon' not in m.text else None)
        p.goto(f'{HOST}/staff.html?demo=1#/bills/new'); p.reload(); p.wait_for_timeout(3500)
        rows = p.locator('.st-follow li')
        ok(p.locator('#st-folh').inner_text() == 'Followed on the public tracker' and rows.count() >= 1, f'{tag}: the panel lists followed bills ({rows.count()})')
        txt = rows.first.inner_text() if rows.count() else ''
        ok('people follow it' in txt or 'person follows it' in txt, f'{tag}: each row says how many follow it ({txt!r})')
        card = p.locator('.st-tcard').bounding_box(); panel = p.locator('.st-follow').bounding_box()
        ok(card and panel and panel['y'] >= card['y'] + card['height'] - 1, f'{tag}: the panel sits under the card, which stays first')
        btn = p.locator('[data-tfol]').first
        ok(btn.bounding_box()['height'] >= (44 if phone else 32), f'{tag}: "Sort it" is big enough to press ({btn.bounding_box()["height"]})')
        ok(not any(p.evaluate("[...document.querySelectorAll('.st-follow *')].map(e => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflow === 'visible')")), f'{tag}: nothing in the panel runs off its edge')
        num = p.locator('.st-follow li b').first.inner_text()
        btn.click(); p.wait_for_timeout(600)
        ok(p.locator('#st-tnum').inner_text() == num, f'{tag}: "Sort it" puts {num} on the card')
        ok('on the public tracker' in p.locator('.st-whys').inner_text(), f'{tag}: the card says people follow it')
        ok(num not in ' '.join(p.locator('.st-follow li').all_inner_texts()), f'{tag}: while on the card it leaves the panel')
        p.locator('[data-ttrack]').first.click(); p.wait_for_timeout(1200)
        ok(p.locator('#st-tnum').inner_text() != num and num not in ' '.join(p.locator('.st-follow li').all_inner_texts()), f'{tag}: tracked, it leaves the card and the panel')
        ok(p.evaluate("!!document.querySelector('#toast')") and 'tracked' in p.locator('#toast').inner_text(), f'{tag}: a toast says it was tracked, with Undo')
        c.close()
    b.close()

for x in passes + fails: print(x)
print(f'\n{len(passes)} passed, {len(fails)} failed')
if errors: print('errors:', errors[:6])
sys.exit(1 if fails else 0)
