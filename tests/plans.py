# The first visit's five plans (R-164; pub/plans.js, pub/onb*.js, the test 'onb' in pub/variant.js, backend 136 and 138).
# Each plan forced by ?ab=onb.pN in the sandbox and walked from its first screen to Home, on a phone and a laptop, in
# session and between sessions: the steps come in the plan's order, its named parts and words show, the alerts sign-up is
# in every one with "Not now" as large as its main button, giving a number shows the warm "You're set", the ending
# names what was done, Home shows the plan's next small thing on a later visit (pub/onb-later.js), no page errors and no
# sideways scroll. Today's first visit is checked by public_journey.py and abtests.py.
#   python3 -m http.server 8832   (in this folder, once)
#   python3 tests/plans.py [base]     base defaults to http://localhost:8832
import sys, os, re
from playwright.sync_api import sync_playwright
BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832').rstrip('/')
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'tests', 'out'); os.makedirs(OUT, exist_ok=True)
res = []
def ok(c, m): res.append(bool(c)); print('PASS' if c else 'FAIL', m)
TITLE = {'What do you care about?': 'topics', 'One bill that needs voices': 'one', 'Find a bill': 'find', 'How this bill can move': 'learn', 'Your choice': 'decide', 'Say aloha to your legislators': 'hello', 'Stay in the loop': 'join',
         'You’re all set': 'wrap', 'A bill’s journey': 'story', 'Your issues on the road': 'road', 'Where do you live?': 'island',
         'How do you like to help?': 'way', 'Your first step': 'first', 'What’s moving on your issues': 'picks', 'Who speaks for you': 'you'}
WANT = {'p1': ['topics', 'find', 'learn', 'decide', 'join', 'wrap'], 'p2': ['story', 'topics', 'road', 'join', 'wrap'], 'p3': ['island', 'you', 'topics', 'picks', 'join', 'hello', 'wrap'],
        'p4': ['way', 'topics', 'picks', 'join', 'first', 'wrap'], 'p5': ['topics', 'picks', 'join', 'wrap']}
WANT_OFF = dict(WANT, p1=['topics', 'you', 'hello', 'join', 'wrap'])

ST = {}   # what each plan's phone walk saw, checked after it
def step_of(pg):
    t = pg.title().split(' · ')[0]
    return TITLE.get(t, t)

with sync_playwright() as p:
    br = p.chromium.launch()
    def walk(plan, mobile=True, off=False, phone=False):
        ctx = br.new_context(viewport={'width': 390, 'height': 844} if mobile else {'width': 1440, 'height': 900}, is_mobile=mobile)
        pg = ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(f"{BASE}/track.html?demo=1&restart&ab=onb.{plan}{'&season=off' if off else ''}")
        pg.wait_for_function("() => /#\\/start\\/1/.test(location.hash) && !document.querySelector('.st [aria-busy=true]')", timeout=60000); pg.wait_for_timeout(900)
        seen, wide = [], True
        for _ in range(40):
            if not re.search(r'#/start/', pg.url): break
            pg.wait_for_timeout(500)
            if pg.locator('#fx-moment:not([hidden]) #fx-mgo').count(): pg.click('#fx-moment #fx-mgo'); pg.wait_for_timeout(500); continue
            s = step_of(pg)
            if not seen or seen[-1] != s: seen.append(s)
            wide = wide and pg.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1")
            if s == 'topics':
                tile = pg.locator('[data-stissue]').nth(3 if plan == 'p1' else 2); tile.click(); pg.click('[data-stnext]')
            elif s == 'join':
                main, skip = pg.locator('#st-send'), pg.locator('.ob-joinbtns [data-stskip]')
                if main.count() and skip.count():
                    a, b = main.bounding_box(), skip.bounding_box()
                    if 'join_sizes' not in ST.setdefault(plan, {}):
                        ST[plan]['join_sizes'] = abs(a['width'] - b['width']) <= 2 and abs(a['height'] - b['height']) <= 2
                    txt = pg.locator('main').inner_text()
                    ST[plan]['join_words'] = ('Example text' in txt or 'We tell you' in txt) and txt.lower().count('once or twice a week') == 1
                if phone and main.count():
                    pg.fill('#st-a-phone', '(808) 555-0123'); main.click(); pg.wait_for_timeout(1200)
                    m = pg.locator('#fx-moment:not([hidden])')
                    ST[plan]['set'] = m.count() == 1 and 'Save our number as HIPHI' in m.inner_text()
                elif skip.count(): skip.click()
                else: pg.click('[data-obon]')
            elif s == 'picks': pg.click('[data-stnext]')
            elif s == 'find':
                # Plan 1's gradual build-up (R-164): nothing is asked until a bill is chosen; Next without one says so.
                pg.click('[data-stnext]'); pg.wait_for_timeout(300)
                ST.setdefault(plan, {})['find_flash'] = 'Pick one' in pg.locator('#st-alert').inner_text()
                pg.locator('[data-obfind]').first.click(); pg.click('[data-stnext]')
            elif s == 'decide':
                ST.setdefault(plan, {})['decide_ways'] = pg.locator('.ob-way').count()
                pg.click('[data-obnot]')
            elif s == 'wrap':
                ST[plan]['wrap'] = pg.locator('.st-did li').count() >= 1
                if mobile and not off: pg.screenshot(path=os.path.join(OUT, f'plans_{plan}_wrap.png'))
                pg.click('[data-stdone]')
            elif pg.locator('[data-obnot]').count(): pg.click('[data-obnot]')
            elif pg.locator('.st-bar [data-stskip]').count(): pg.click('.st-bar [data-stskip]')
            elif pg.locator('.st-bar [data-stnext]').count(): pg.click('.st-bar [data-stnext]')
            elif pg.locator('.st-bar [data-obon]').count(): pg.click('.st-bar [data-obon]')
            else: break
        pg.wait_for_timeout(1200)
        home = not re.search(r'#/start/', pg.url)
        return ctx, pg, errs, seen, wide, home

    for plan in ('p1', 'p2', 'p3', 'p4', 'p5'):
        for mobile, off in ((True, False), (False, False), (True, True)):
            where = f"{plan} {'phone' if mobile else 'laptop'}{' between sessions' if off else ''}"
            ctx, pg, errs, seen, wide, home = walk(plan, mobile, off, phone=(plan == 'p5' and mobile and not off))
            want = (WANT_OFF if off else WANT)[plan]
            ok(seen == want, f'{where}: the steps in order {seen}')
            ok(home, f'{where}: ends on Home')
            ok(wide, f'{where}: no sideways scroll on any step')
            ok(not errs, f'{where}: no page errors ' + '; '.join(errs[:2]))
            if mobile and not off:
                st = ST.get(plan, {})
                ok(st.get('join_sizes'), f'{plan}: "Not now" is as large as the sign-up button (C-3)')
                ok(st.get('join_words'), f'{plan}: the sign-up shows the example or the three steps, and how often')
                ok(st.get('wrap'), f'{plan}: the ending lists what was done')
                if plan == 'p1':
                    ok(st.get('find_flash'), 'p1: "Learn about it" without a bill picked asks for one, never jumps ahead')
                    ok(st.get('decide_ways') == 3, f'p1: the choice offers three equal ways (write now, a reminder, just keep watch) ({st.get("decide_ways")})')
                if plan == 'p5': ok(st.get('set'), 'p5: a number given goes straight to the Mahalo moment, which says to save our number (one ending, not three)')
                # a later visit: Home brings the plan's next small thing, once, and "Not now" puts it away for good
                pg.evaluate("() => sessionStorage.clear()"); pg.goto(f"{BASE}/track.html?demo=1&ab=onb.{plan}#/"); pg.wait_for_timeout(3500)
                card = pg.locator('.hm-later')
                ok(card.count() == 1, f'{plan}: a later visit shows one next-step card at the top of Home')
                if card.count():
                    first = card.locator('h2').inner_text(); card.locator('[data-laterno]').click(); pg.wait_for_timeout(600)
                    again = pg.locator('.hm-later h2')
                    ok(not again.count() or again.inner_text() != first, f'{plan}: "Not now" puts that card away ({first})')
            ctx.close()
    br.close()
print(f'{sum(res)}/{len(res)} passed'); sys.exit(0 if all(res) else 1)
