# What starts ticked on the first visit's "Your issues" (R-245, Nate 10/11: "a max of 4 issues, or at minimum 1 per category
# and max of 2 per category"): one to two in each picked topic, four in all; five or six topics tick one each.
# python3 tests/ticks_per_topic.py [base_url]
import sys
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832/track.html'
passes, fails, errors = [], [], []
def ok(c, m): (passes if c else fails).append(('PASS ' if c else 'FAIL ') + m)

with sync_playwright() as pw:
    b = pw.chromium.launch()
    for n in range(1, 7):
        c = b.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
        p = c.new_page(); p.on('pageerror', lambda e: errors.append(str(e)))
        p.goto(BASE + '?demo=1'); p.wait_for_timeout(500); p.evaluate('localStorage.clear(); sessionStorage.clear()'); p.reload(); p.wait_for_timeout(2500)
        tiles = p.locator('[data-stissue]')
        for k in range(n): tiles.nth(k).click()
        p.locator('[data-stnext]').click(); p.wait_for_timeout(1800)
        per = p.evaluate("[...document.querySelectorAll('[data-stsec]')].map(d => d.querySelectorAll('[data-stpick][aria-pressed=true]').length)")
        total = p.locator('[data-stpick][aria-pressed=true]').count()
        ok(len(per) > 0, f'{n} topics: the issues show under their topics ({len(per)} topics with issues)')
        ok(all(1 <= x <= 2 for x in per), f'{n} topics: one or two start ticked in each topic ({per})')
        ok(total == sum(per), f'{n} topics: nothing ticked outside a topic shown ({total})')
        ok(total <= 4 if len(per) <= 4 else total == len(per), f'{n} topics: four at most, or one each past four topics ({total})')
        two = sum(1 for x in per if x == 2)
        ok(total == 4 or len(per) >= 4 or two == sum(1 for x in per), f'{n} topics: fills to four when the topics have room ({per})')
        lbl = p.inner_text('.st-bar')
        ok(f'Follow {total} issue' in lbl, f'{n} topics: the button counts what is ticked ("{lbl.strip()}")')
        lede = p.inner_text('.st2 .lede')
        ok(('one' if total == 1 else str(total)) + ' to start' in lede, f'{n} topics: the line says how many were ticked ("{lede.strip()}")')
        # One tap still unticks, and the count follows it (B-12).
        p.locator('[data-stpick][aria-pressed=true]').first.click(); p.wait_for_timeout(200)
        ok(p.locator('[data-stpick][aria-pressed=true]').count() == total - 1, f'{n} topics: a tap unticks one')
        c.close()
    b.close()

ok(not errors, f'no page errors {errors[:3]}')
print('\n'.join(passes + fails))
print(f'{len(passes)} passed, {len(fails)} failed')
sys.exit(1 if fails else 0)
