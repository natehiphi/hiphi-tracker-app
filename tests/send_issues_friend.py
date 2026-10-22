# "Send my issues to a friend" (R-212 #37; the My issues link of R-123, renamed and put to a friend's use, Nate 10/22 "Build
# #37 as listed"), in the practice copy served locally. Kai follows three topics (tobacco, food, around).
#   M1  You: the row is "Send my issues to a friend"; it opens the ask-a-friend sheet with that title, a message naming the
#       issues, and a #/follow/... link marked ?f=1
#   M2  an issue page Kai follows: the "✓ Following" menu has "Send my issues to a friend", which opens the same sheet
#   M3  the friend opens the link in a fresh browser: "You now follow the 3 issues your friend sent", and they are followed;
#       the same link without ?f=1 (their own other phone) still says "Your ... issues are here"
#   M4  the end of the first visit (keep.js shareLine): two issues or more offer "Send my issues to a friend"; one issue, its Share
#   M5  no page errors; the old More (?rec=0) row has the new name
#   python3 tests/send_issues_friend.py [base] [outdir]
import sys, os, re
from playwright.sync_api import sync_playwright
BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832/').rstrip('/')
OUT = sys.argv[2] if len(sys.argv) > 2 else '.'
ROOT = sys.argv[3] if len(sys.argv) > 3 else os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src = open(os.path.join(ROOT, 'compare.html')).read()
WHO = src[src.index('const WHO = {'):src.index('const pick =')]
res = []
def ok(c, m): res.append(bool(c)); print('PASS' if c else 'FAIL', m)
SCENE = f"""(() => {{ {WHO}
  if (sessionStorage.getItem('__set')) return; sessionStorage.setItem('__set', '1');
  const p = WHO.kai;
  for (const k of Object.keys(localStorage)) if (k.startsWith('hiphi_')) localStorage.removeItem(k);
  const set = (k, v) => localStorage.setItem(k + '_demo', typeof v === 'string' ? v : JSON.stringify(v));
  set('hiphi_issue_follows', p.issues); set('hiphi_watch_ids', []); set('hiphi_cat_follows', p.cats); set('hiphi_skips', []);
  set('hiphi_wiz', {{ done: true, issues: p.cats, name: p.name }}); set('hiphi_done', []); set('hiphi_done_at', {{}}); set('hiphi_stances', {{}}); set('hiphi_demo_seeded', '0');
  localStorage.setItem('hiphi_tour_home_demo', '{{"how":"test"}}'); localStorage.setItem('hiphi_tour_bill_demo', '{{"how":"test"}}');
}})();"""
FRESH = """(() => { if (sessionStorage.getItem('__set')) return; sessionStorage.setItem('__set', '1');
  for (const k of Object.keys(localStorage)) if (k.startsWith('hiphi_')) localStorage.removeItem(k); })();"""
SHEET = 'dialog.af-sheet[open]'
with sync_playwright() as p:
    br = p.chromium.launch(); errs = []
    def ctx(init, phone=False):
        c = br.new_context(**({'viewport': {'width': 375, 'height': 812}, 'is_mobile': True, 'has_touch': True} if phone else {'viewport': {'width': 1366, 'height': 900}}))
        c.add_init_script(init); c.grant_permissions(['clipboard-read', 'clipboard-write'])
        pg = c.new_page(); pg.on('pageerror', lambda e: errs.append(str(e))); return c, pg
    def said(pg, words):   # the toast, read while it is up
        try: pg.wait_for_function(f"() => document.body && document.body.innerText.includes({words!r})", timeout=15000)
        except Exception: return []
        return [l for l in pg.evaluate('document.body.innerText').split('\n') if words in l]
    def sheet_text(pg):
        pg.wait_for_selector(SHEET, timeout=8000); pg.wait_for_timeout(700)
        return pg.locator(SHEET).inner_text(), pg.locator(SHEET + ' #af-msg').input_value()
    # M1 You
    c, pg = ctx(SCENE)
    pg.goto(f'{BASE}/track.html?demo=1#/more'); pg.wait_for_selector('#main .yu-you', timeout=60000); pg.wait_for_timeout(1500)
    b = pg.locator('[data-mr-keep]')
    ok(b.count() == 1 and b.inner_text().strip() == 'Send my issues to a friend', 'M1 You has "Send my issues to a friend"')
    b.click(); st, msg = sheet_text(pg)
    pg.screenshot(path=os.path.join(OUT, 'mine-sheet-laptop.png'))
    ok(st.startswith('Send my issues to a friend'), 'M1 the sheet says what it does')
    links = re.findall(r'https?://\S+', msg)
    ok(len(links) == 1 and '#/follow/' in links[0] and links[0].endswith('?f=1'), f'M1 one #/follow/ link marked ?f=1 ({links[:1]})')
    ok(msg.startswith('I follow these at the Hawaiʻi Legislature') and 'no sign-up needed' in msg, 'M1 the message names what it is')
    ok('Food & Nutrition' in msg and 'all of' not in msg, 'M1 a whole topic is named by its own name')
    ok(pg.locator(SHEET + ' .af-one').count() == 0, 'M1 no second line saying the title again (A-14)')
    pg.locator(SHEET + ' [data-af="link"]').click(); pg.wait_for_timeout(300)
    ok('#/follow/' in pg.evaluate('navigator.clipboard.readText()') and '?f=1' not in pg.evaluate('navigator.clipboard.readText()'), 'M1 Copy link gives the plain link (their own other phone)')
    link = links[0]
    pg.locator(SHEET + ' [data-af="close"]').first.click(); c.close()
    # M2 an issue page Kai follows
    c, pg = ctx(SCENE)
    pg.goto(f'{BASE}/track.html?demo=1#/'); pg.wait_for_timeout(2500)
    slug = pg.evaluate("async () => { const c = await import('./pub/core.js'); return c.followedIssues()[0]?.slug || ''; }")
    pg.goto(f'{BASE}/track.html?demo=1#/issue/{slug}'); pg.wait_for_selector('[data-rc-fmenu]', timeout=30000); pg.wait_for_timeout(800)
    pg.locator('[data-rc-fmenu]').first.click(); pg.wait_for_timeout(300)
    item = pg.locator('#rc-fmenu [data-rc-mine]')
    ok(item.is_visible() and 'Send my issues to a friend' in item.inner_text(), f'M2 the Following menu on {slug} has it')
    pg.screenshot(path=os.path.join(OUT, 'mine-menu-laptop.png'))
    item.click(); st, _ = sheet_text(pg)
    ok(st.startswith('Send my issues to a friend'), 'M2 it opens the sheet')
    c.close()
    # M3 the friend
    c, pg = ctx(FRESH, phone=True)
    pg.goto(link.replace('http://localhost:8832', BASE)); toast = said(pg, 'your friend sent')
    ok(any('your friend sent' in t for t in toast), f'M3 the friend is told whose issues these are ({toast[:1]})')
    n = pg.evaluate("async () => { const c = await import('./pub/core.js'); return c.S.catFollows.size + c.S.issueFollows.size; }")
    ok(n >= 3, f'M3 and follows them ({n})')
    m = re.search(r'follow (\d+) issues', toast[0] if toast else '')
    rows = pg.evaluate("async () => (await import('./pub/core.js')).followedIssues().length")
    ok(m and int(m.group(1)) == rows, f'M3 the toast counts the issues they now follow ({m and m.group(1)} of {rows})')
    ok(pg.url.endswith('#/bills'), 'M3 the friend lands on My issues')
    pg.screenshot(path=os.path.join(OUT, 'mine-friend-phone.png'))
    c.close()
    c, pg = ctx(FRESH, phone=True)
    pg.goto(link.replace('http://localhost:8832', BASE).replace('?f=1', '')); toast = said(pg, 'are here')
    ok(any('are here' in t for t in toast) and not any('your friend' in t for t in toast), 'M3 without ?f=1 it is their own link ("are here")')
    c.close()
    # M6 My issues: "Send to a friend" beside Edit
    c, pg = ctx(SCENE, phone=True)
    pg.goto(f'{BASE}/track.html?demo=1#/bills'); pg.wait_for_selector('.rc-mine', timeout=60000); pg.wait_for_timeout(1200)
    sb = pg.locator('.rc-mhead [data-rc-mine]')
    ok(sb.count() == 1 and sb.inner_text().strip() == 'Send' and sb.get_attribute('aria-label') == 'Send my issues to a friend' and pg.locator('.rc-mhead .rc-h1').evaluate('h => h.getBoundingClientRect().height') < 50, 'M6 My issues has Send (to a friend), and its title keeps one line')
    pg.screenshot(path=os.path.join(OUT, 'mine-myissues-phone.png'))
    sb.click(); st, _ = sheet_text(pg); ok(st.startswith('Send my issues to a friend'), 'M6 it opens the sheet')
    pg.screenshot(path=os.path.join(OUT, 'mine-sheet-phone.png'))
    ok(pg.evaluate('document.documentElement.scrollWidth') <= 375, 'M6 no wider than the phone')
    c.close()
    # M4 the finale's line
    c, pg = ctx(SCENE)
    pg.goto(f'{BASE}/track.html?demo=1#/'); pg.wait_for_timeout(2500)
    many = pg.evaluate("async () => (await import('./pub/keep.js')).shareLine()")
    one = pg.evaluate("""async () => { const c = await import('./pub/core.js'); const i = c.followedIssues()[0]; c.S.catFollows.clear(); c.S.issueFollows.clear(); c.S.issueFollows.add(i.id);
      return (await import('./pub/keep.js')).shareLine(); }""")
    ok('Send my issues to a friend' in many and 'data-stshare="mine"' in many and 'Know someone who’d follow ' in many, 'M4 two issues or more: "Send my issues to a friend", naming them')
    ok('Send my issues' not in one and '>Share<' in one, 'M4 one issue: its own Share')
    c.close()
    # M5 old More
    c, pg = ctx(SCENE)
    pg.goto(f'{BASE}/track.html?demo=1&rec=0#/more'); pg.wait_for_timeout(3000)
    ok('Send my issues to a friend' in pg.locator('#main').inner_text() and 'My issues link' not in pg.locator('#main').inner_text(), 'M5 the old More says the new name')
    c.close()
    ok(not errs, f'M5 no page errors {errs[:2]}')
    br.close()
print(f'{sum(res)}/{len(res)} passed')
sys.exit(0 if all(res) else 1)
