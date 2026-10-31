# A message and a way out when a screen cannot load (R-212 #49; DESIGN B-8, C-9). On the live path (no ?demo=1: the
# practice copy never asks the database), with the database's address blocked in the browser (Playwright routes): every
# request aborted, answered with a 500 (with the CORS headers, or the browser reports a network error instead), or held
# with no answer; the whole connection dropped after the page loaded; the Supabase library's CDN blocked; pub/app.js blocked.
#   python3 -m http.server 8832   (in this folder, once)
#   python3 tests/load_fail.py [base] [out]   base defaults to http://localhost:8832; pictures go to [out]
# Checks, one browser at a time (the privacy signal is set, so nothing is counted or reported):
#   - the start: one clock from the script's start, so a database that never answers ends in "We couldn't load the tracker"
#     by about 20 s (pub/app.js START_MS; a slow phone keeps about the time it had), an h1, the honest words ("It's not
#     you"), and Try again reloads; on a bill, "We couldn't load this bill"
#   - a database that answers 500 at the start: the card, never a Home, Find, My issues or issue page drawn from nothing
#   - after the page loaded: the bill page (both layouts), a search, All bills, an issue's bills, a shared list, a committee's
#     next hearing, a lawmaker's bills: one card or one line in place, and Try again draws the real screen with no reload
#   - a search and an issue's bills that never answer end in the line by about 12 s, not "Searching" or a skeleton for good
#   - the lawmakers and committees failing alone: Committees, a committee, Your lawmakers and a lawmaker say they could not
#     load (never "We couldn't find" or "the link may be old"), and Try again asks again in place
#   - the issues failing with last visit's copy in hand: My issues for a follower says it could not load (never "You're not
#     following any issues yet"), and an issue's address is kept, not sent to Find
#   - the first visit's issues step: its Try again really asks again (it could never recover before)
#   - offline after load: a screen whose code had not come yet says "You're offline", and comes back by itself when the
#     connection does, with no reload
#   - what was typed stays: the search box and the address box keep their words through the failure and the retry (C-9)
#   - the Supabase library never arriving on a first visit: the welcome stays (no card for 3 s); "Let’s begin" then shows the card, which stays; Try again reloads
#   - pub/app.js never arriving: after 20 s the page says so, with Try again, instead of a skeleton for good
#   - no page error and no ReferenceError or TypeError in the console anywhere
import json, logging, os, re, sys, time
from playwright.sync_api import sync_playwright
# A request held with no answer (the "never answers" checks) is still pending when its page closes, and Python's asyncio
# says so at length; that is the test's own doing, not the page's.
logging.getLogger('asyncio').setLevel(logging.CRITICAL)

BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832').rstrip('/')
if BASE.endswith('.html'): BASE = BASE.rsplit('/', 1)[0]
URL = BASE + '/track.html'
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out', 'load_fail')
os.makedirs(OUT, exist_ok=True)
SB = re.compile(r'https://eivzjbnygscguqqiiuvh\.supabase\.co/.*')
LIB = re.compile(r'https://cdn\.jsdelivr\.net/npm/.*')
REF = re.compile(r'.*/rest/v1/public_(committees|legislators|committee_members|committee_slots)\b.*')
CAT = re.compile(r'.*/rest/v1/public_(issues|categories|issue_links)\b.*')
RECAP = re.compile(r'.*/rest/v1/public_all_bills\?select=\*&session_year=eq\.\d+&hiphi_position=not\.is\.null.*limit=1000.*')
HEARINGS = re.compile(r'.*/rest/v1/public_all_hearings.*')
CORS = {'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*'}
QUIET = "Object.defineProperty(navigator, 'globalPrivacyControl', { value: true });"
BACK = "try { if (!localStorage.getItem('hiphi_wiz')) localStorage.setItem('hiphi_wiz', JSON.stringify({ done: true, step: 99 })); } catch {}"
FOLLOW = "try { if (!localStorage.getItem('hiphi_issue_follows')) localStorage.setItem('hiphi_issue_follows', JSON.stringify(['00000000-0000-0000-0000-00000000abcd'])); } catch {}"
# Words a failure must never be read as (B-8: a person would believe them).
LIES = re.compile(r'couldn’t find|link may be old|not following any issues|No testimony is due|Nothing needs you|Searching$', re.I)
res = []
def ok(c, m): res.append(bool(c)); print('PASS' if c else 'FAIL', m)
def h500(r):
    if r.request.method == 'OPTIONS': r.fulfill(status=204, headers=CORS)
    else: r.fulfill(status=500, headers={**CORS, 'content-type': 'application/json'}, body='{"message":"internal error","code":"XX000"}')
held = []
def hang(r): held.append(r)
STATE = """() => { const vis = e => !!(e && e.getClientRects().length);
  const m = document.querySelector('main'), t = (m ? m.innerText : document.body.innerText).replace(/\\s+/g, ' ').trim();
  const al = [...document.querySelectorAll('[role=alert]')].filter(vis).map(e => e.innerText.replace(/\\s+/g, ' ').trim()).join(' | ');
  return { t, al, h1: [...document.querySelectorAll('h1')].filter(vis).map(e => e.innerText.trim()).join(' | '),
    again: [...document.querySelectorAll('[data-loadfail]')].filter(vis).length, skel: [...document.querySelectorAll('.skelpage, .skel')].filter(vis).length,
    kept: !!window.__kept }; }"""

class Run:
    """One browser context at a time; a phone (390 x 844) unless told otherwise."""
    def __init__(self, br, *, back=True, follow=False, w=390, h=844):
        self.ctx = br.new_context(viewport={'width': w, 'height': h})
        self.ctx.add_init_script(QUIET)
        if back: self.ctx.add_init_script(BACK)
        if follow: self.ctx.add_init_script(FOLLOW)
        self.pg = self.ctx.new_page(); self.errs = []
        self.pg.on('pageerror', lambda e: self.errs.append('page error: ' + str(e)[:160]))
        # Broken code, not the blocked connection's own "TypeError: Failed to fetch".
        self.pg.on('console', lambda m: self.errs.append('console: ' + m.text[:160]) if m.type == 'error' and re.search(r'ReferenceError|SyntaxError|TypeError: (?!Failed to fetch|NetworkError|Load failed)', m.text) else None)
    def go(self, hash_, wait=None):
        self.pg.goto(URL + hash_)
        if wait: self.pg.wait_for_selector(wait, timeout=45000)
    def ready(self, hash_='#/'):
        self.go(hash_, 'main#main h1'); self.pg.wait_for_timeout(2000)
    def to(self, hash_): self.pg.evaluate('window.__kept = 1'); self.pg.evaluate(f'location.hash = {json.dumps(hash_)}')
    def st(self): return self.pg.evaluate(STATE)
    def until(self, test, secs):
        t0 = time.time()
        while time.time() - t0 < secs:
            s = self.st()
            if test(s): return round(time.time() - t0, 1), s
            self.pg.wait_for_timeout(500)
        return None, self.st()
    def failed(self, secs=10, text='We couldn’t load'):
        return self.until(lambda s: text in s['t'] and s['again'] > 0, secs)
    def press(self):   # window.__kept: a Try again that asks again in place keeps the page (no reload)
        self.pg.evaluate('window.__kept = 1'); self.pg.locator('[data-loadfail]:visible').first.click()
    def shot(self, name): self.pg.screenshot(path=os.path.join(OUT, name + '.png'))
    def close(self, label):
        ok(not self.errs, f'{label}: no page error or broken code ({self.errs[:2]})')
        try: self.ctx.unroute_all(behavior='ignoreErrors')   # the requests still held end with their page, quietly
        except Exception: pass
        held.clear(); self.ctx.close()

def recovered(r, test, secs=15):
    t, s = r.until(lambda s: test(s) and s['again'] == 0 and not s['skel'], secs)
    return t is not None and s['kept'], s

with sync_playwright() as p:
    br = p.chromium.launch()

    # 1. The start never answered: the card by about 20 s on Home (one clock from the script's start), the honest words, and
    # Try again reloads.
    r = Run(br); r.ctx.route(SB, hang); t0 = time.time(); r.go('#/')
    t, s = r.failed(26, 'We couldn’t load the tracker')
    ok(t is not None and t <= 23, f'a database that never answers: Home says "We couldn’t load the tracker" in {t} s (one 20-second clock from the start)')
    ok(s['h1'] == 'We couldn’t load the tracker' and 'It’s not you' in s['t'] and 'Check your connection' not in s['t'], f'the card is the page’s h1, in the honest words ({s["h1"]!r})')
    r.shot('home-hang-phone')
    r.ctx.unroute(SB); r.press(); r.pg.wait_for_selector('main#main h1', timeout=45000); r.pg.wait_for_timeout(1500)
    ok('couldn’t load' not in r.st()['t'], 'its Try again reloads into Home')
    r.close('the start, never answered')

    # 2. A 500 at the start: the card at once, never a page drawn from nothing (Home, My issues for a follower, an issue link).
    for hash_, follow, what in [('#/', True, 'the tracker'), ('#/bills', True, 'the tracker'), ('#/issue/free-school-meals-for-every-student', False, 'this issue'), ('#/bill/SB963', False, 'this bill')]:
        r = Run(br, follow=follow); r.ctx.route(SB, h500); r.go(hash_)
        t, s = r.failed(10, f'We couldn’t load {what}')
        ok(t is not None and not LIES.search(s['t']) and r.pg.evaluate('location.hash') == hash_, f'a 500 at the start on {hash_}: "We couldn’t load {what}" in {t} s, the address kept, nothing drawn from nothing')
        if hash_ == '#/bills': ok('What you follow is still saved.' in s['t'], 'My issues’ card says what they follow is still saved')
        ok(not r.pg.locator('.hdr .hnav, .hdr .hsearch, .hdr .hsearchbtn').evaluate_all('els => els.filter(e => e.getClientRects().length).length'), f'{hash_}: the card’s header has no tabs or search (they would only draw the card again)')
        if hash_ == '#/bills': r.shot('mybills-500-phone')
        r.close(f'500 at the start, {hash_}')

    # 3. The connection to the database drops after the page loaded: the bill page in both layouts, in place, and back.
    for q, label in [('', 'the calm bill page'), ('?rec=0', 'the older bill page')]:
        r = Run(br); r.pg.goto(URL + q + '#/'); r.pg.wait_for_selector('main#main h1', timeout=45000); r.pg.wait_for_timeout(2000)
        r.ctx.route(SB, lambda x: x.abort()); r.to('#/bill/SB963')
        t, s = r.failed(15, 'We couldn’t load this bill')
        ok(t is not None and s['h1'] == 'We couldn’t load this bill' and 'It’s not you' in s['t'], f'{label}: "We couldn’t load this bill" in place, in {t} s, with Try again')
        r.ctx.unroute(SB); r.press()
        good, s = recovered(r, lambda s: 'SB 963' in s['t'] and 'couldn’t load' not in s['t'])
        ok(good, f'{label}: Try again draws the bill, with no reload ({s["h1"][:50]!r})')
        r.close(label)

    # 4. A search fails (500), then never answers: one line under the box, the words stay, Try again searches again (C-9).
    r = Run(br); r.ready('#/find'); r.ctx.route(SB, h500); r.pg.fill('#q', 'tobacco')
    t, s = r.failed(8, 'We couldn’t load the results')
    ok(t is not None and r.pg.input_value('#q') == 'tobacco', f'a failed search: "We couldn’t load the results" in {t} s, and the box still says what was typed')
    r.shot('search-500-phone')
    r.ctx.unroute(SB); r.press()
    good, s = recovered(r, lambda s: 'Results for' in s['t'] or 'tobacco' in s['t'].lower())
    ok(good and r.pg.input_value('#q') == 'tobacco', 'Try again searches again, in place, and the words are still there')
    r.ctx.route(SB, hang); r.pg.fill('#q', 'school meals xyz')
    t, s = r.failed(16, 'We couldn’t load the results')
    ok(t is not None and t <= 15, f'a search that never answers ends in the line in {t} s, not "Searching" for good')
    r.ctx.unroute(SB); r.close('search')

    # 5. All bills (500) and an issue's bills (never answering), in place, and back.
    r = Run(br); r.ready('#/'); r.ctx.route(SB, h500); r.to('#/allbills')
    t, s = r.failed(10, 'We couldn’t load the bills')
    ok(t is not None and 'Every bill HIPHI tracks' in s['t'], f'All bills: "We couldn’t load the bills" under its own heading, in {t} s')
    r.ctx.unroute(SB); r.press()
    good, s = recovered(r, lambda s: 'Every bill HIPHI tracks' in s['t'] and 'couldn’t load' not in s['t'], 30)
    ok(good, 'All bills: Try again draws the list, with no reload')
    r.close('All bills')
    # (A page of its own: All bills brought every bill into the page, the issue's among them.)
    r = Run(br); r.ready('#/'); r.ctx.route(SB, hang); r.to('#/issue/free-school-meals-for-every-student')
    t, s = r.failed(16, 'We couldn’t load this issue’s bills')
    ok(t is not None and 'Free school meals for every student' in s['t'], f'an issue whose bills never answer: the line under its name in {t} s, not a skeleton for good')
    r.ctx.unroute(SB); r.press()
    good, s = recovered(r, lambda s: 'couldn’t load' not in s['t'] and 'Free school meals' in s['t'])
    ok(good, 'the issue: Try again draws its bills, with no reload')
    r.close('an issue')

    # 6. The lawmakers and committees alone fail: said, never "not found", and Try again asks again in place.
    for hash_, what, sure in [('#/committees', 'the committees', 'Senate'), ('#/committee/AGR', 'this committee', 'Agriculture'),
                              ('#/legislators', 'the list of lawmakers', 'Who represents you'), ('#/legislator/55', 'this lawmaker', 'Hashem')]:
        r = Run(br); r.ctx.route(REF, h500); r.go(hash_)
        t, s = r.failed(15, f'We couldn’t load {what}')
        ok(t is not None and not LIES.search(s['t']), f'{hash_} with the lawmakers and committees failing: "We couldn’t load {what}" in {t} s, never "not found"')
        if hash_ == '#/committees': r.shot('committees-500-phone')
        r.ctx.unroute(REF); r.press()
        good, s = recovered(r, lambda s, sure=sure: sure in s['t'] and 'couldn’t load' not in s['t'])
        ok(good, f'{hash_}: Try again draws it, with no reload')
        r.close(hash_)

    # 7. One part of a drawn page: a committee's next hearing and a lawmaker's bills, in place, and back.
    r = Run(br); r.ready('#/committees'); r.ctx.route(HEARINGS, h500); r.to('#/committee/AGR')
    t, s = r.failed(10, 'We couldn’t load the next hearing')
    ok(t is not None and 'Agriculture' in s['t'], f'a committee whose next hearing fails: one line on its page in {t} s')
    r.ctx.unroute(HEARINGS); r.press()
    good, s = recovered(r, lambda s: 'couldn’t load' not in s['t'])
    ok(good, 'the committee: Try again asks again, with no reload')
    r.close('the next hearing')

    # 8. The issues fail with last visit's copy in hand: My issues for a follower, and an issue address the copy lacks.
    r = Run(br, follow=True); r.ready('#/'); r.pg.wait_for_function("() => !!localStorage.getItem('hiphi_catalog')", timeout=30000)
    r.ctx.route(CAT, h500); r.pg.goto('about:blank'); r.go('#/bills')
    t, s = r.failed(12, 'We couldn’t load your issues')
    ok(t is not None and not LIES.search(s['t']), f'My issues, issues failing (last visit’s copy in hand): "We couldn’t load your issues" in {t} s, never "not following any issues"')
    r.pg.goto('about:blank'); r.go('#/issue/a-new-issue-not-in-the-copy')
    t, s = r.failed(12, 'We couldn’t load this issue')
    ok(t is not None and r.pg.evaluate('location.hash') == '#/issue/a-new-issue-not-in-the-copy', f'an issue address the copy lacks: "We couldn’t load this issue" in {t} s, the address kept (not sent to Find)')
    r.ctx.unroute(CAT); r.close('the issues, from last visit’s copy')

    # 9. The first visit's issues step: Try again really asks again.
    r = Run(br, back=False); r.ctx.route(RECAP, h500); r.go('#/start/1', '[data-stissue], [data-loadfail]'); r.pg.wait_for_timeout(2000)
    ok(r.pg.locator('[data-stissue]').count() > 0, f'the first visit’s topics drew ({r.st()["t"][:80]!r})')
    r.pg.locator('[data-stissue]:visible').first.click(); r.pg.locator('[data-stnext]:visible').first.click()
    t, s = r.failed(10, 'We couldn’t load the issues')
    ok(t is not None and 'It’s not you' in s['t'], f'the first visit’s issues step: "We couldn’t load the issues" in {t} s')
    r.shot('start2-500-phone')
    r.ctx.unroute(RECAP); r.pg.evaluate('window.__kept = 1'); r.press()
    good, s = recovered(r, lambda s: 'Tick every issue' in s['t'] or 'Follow' in s['t'])
    ok(good, 'its Try again asks again and draws the issues, with no reload (it never recovered before)')
    r.close('the first visit')

    # 10. The address box: the words stay through a failed lookup, and the sentence is the honest one (C-9).
    r = Run(br); r.ready('#/legislators'); r.ctx.route(SB, lambda x: x.abort())
    r.pg.fill('#pp-q', '45 Kamehameha Hwy'); r.pg.wait_for_timeout(1500); r.pg.press('#pp-q', 'Enter')
    t, s = r.until(lambda s: 'We couldn’t look that up' in s['t'], 25)
    ok(t is not None and r.pg.input_value('#pp-q') == '45 Kamehameha Hwy' and 'It’s not you' in s['t'], f'a failed address lookup keeps the address in the box and says it in the honest words ({s["al"][:90]!r})')
    r.ctx.unroute(SB); r.close('the address box')

    # 11. Offline after load: a screen whose code had not come yet, and back by itself when the connection is.
    r = Run(br); r.ready('#/'); r.ctx.set_offline(True); r.to('#/allbills')
    t, s = r.failed(8, 'We couldn’t load this page')
    ok(t is not None and 'You’re offline' in s['t'] and s['skel'] == 0, f'offline, a screen not loaded yet: "We couldn’t load this page", "You’re offline", in {t} s (it was a skeleton for good)')
    r.shot('lazy-offline-phone')
    r.ctx.set_offline(False)
    good, s = recovered(r, lambda s: 'Every bill HIPHI tracks' in s['t'], 20)
    ok(good, 'back online, it draws by itself, with no reload')
    r.close('offline after load')

    # 12. The Supabase library never arrives (its CDN blocked), on a first visit (R-357 5c: pub/app.js welcomeStays, watchDb): the
    # welcome needs no data, so a newcomer keeps it (no "couldn’t load" card for at least 3 s, the buttons still there); when they go
    # on ("Let’s begin") the card replaces it, and it stays (the first visit's own redraws used to put the welcome back over it, with
    # nothing behind it); its Try again reloads.
    r = Run(br, back=False); r.ctx.route(LIB, lambda x: x.abort()); r.go('#/')
    r.pg.wait_for_selector('.st-hellobar [data-stnext]', timeout=30000)
    r.pg.wait_for_timeout(3500)
    s = r.st()
    ok('couldn’t load' not in s['t'] and r.pg.locator('.st-hellobar [data-stnext]:visible').count() == 1, f'the library never arriving, first visit: the welcome stays and no "couldn’t load" card shows for 3 s ({s["t"][:70]!r})')
    r.shot('library-missing-welcome-phone')
    r.pg.locator('.st-hellobar [data-stnext]:visible').first.click()
    t, s = r.failed(15, 'We couldn’t load the tracker')
    r.pg.wait_for_timeout(2000)
    ok(t is not None and 'We couldn’t load the tracker' in r.st()['t'], f'tapping "Let’s begin" then says "We couldn’t load the tracker" ({t} s), and it stays')
    r.shot('library-missing-card-phone')
    r.ctx.unroute(LIB); r.press(); r.pg.wait_for_selector('main#main h1', timeout=45000); r.pg.wait_for_timeout(1500)
    ok('couldn’t load' not in r.st()['t'], 'its Try again reloads into the first visit')
    r.close('the library never arriving')

    # 13. pub/app.js never arrives: the page says so after 20 s.
    r = Run(br); r.ctx.route(re.compile(r'.*/pub/app\.js.*'), lambda x: x.abort()); r.go('#/')
    t, s = r.until(lambda s: 'We couldn’t load the tracker' in s['t'], 24)
    ok(t is not None and s['h1'] == 'We couldn’t load the tracker' and 'Try again' in s['t'], f'the app’s code never arriving: the page says so in {t} s, with Try again')
    r.shot('appjs-missing-phone')
    r.close('the app’s code never arriving')

    br.close()
print(f'{sum(res)}/{len(res)} passed'); sys.exit(0 if all(res) else 1)
