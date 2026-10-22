# The practice copy findable (R-212 #39; the Teacher's walk of 10/8 found no way to it), served locally or live.
#   P1  Help lists "Can I practice first?" under Using this tracker; the answer has three turns, says nothing is sent, and its
#       button "Open the practice copy" goes to track.html?demo=1; Help's search finds it by "practice" and by "class"
#   P2  You (the live tracker): the footer link "Try the practice copy" goes to track.html?demo=1, and it opens the practice
#       copy (its Sandbox band); the old More (?rec=0) has the row too
#   P3  inside the practice copy, the same place says "Leave the practice copy" and goes to track.html
#   P4  no page errors; phone screenshots of You and the answer
#   python3 tests/practice_copy.py [base] [outdir]
import sys, os
from playwright.sync_api import sync_playwright
BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832/').rstrip('/')
OUT = sys.argv[2] if len(sys.argv) > 2 else '.'
res = []
def ok(c, m): res.append(bool(c)); print('PASS' if c else 'FAIL', m)
# A returning person on either copy: the first visit done, so #/more and #/help draw at once.
INIT = """(() => { if (sessionStorage.getItem('__set')) return; sessionStorage.setItem('__set', '1');
  for (const k of Object.keys(localStorage)) if (k.startsWith('hiphi_')) localStorage.removeItem(k);
  for (const sfx of ['', '_demo']) {
    localStorage.setItem('hiphi_wiz' + sfx, JSON.stringify({ done: true, issues: ['Tobacco & E-Cigarettes'] }));
    localStorage.setItem('hiphi_tour_home' + sfx, '{"how":"test"}'); localStorage.setItem('hiphi_tour_bill' + sfx, '{"how":"test"}'); } })();"""
with sync_playwright() as p:
    br = p.chromium.launch(); errs = []
    def ctx(phone=False):
        c = br.new_context(**({'viewport': {'width': 375, 'height': 812}, 'is_mobile': True, 'has_touch': True} if phone else {'viewport': {'width': 1366, 'height': 900}}))
        c.add_init_script(INIT); pg = c.new_page(); pg.on('pageerror', lambda e: errs.append(str(e))); return c, pg
    # P1 Help
    c, pg = ctx(True)
    pg.goto(f'{BASE}/track.html#/help'); pg.wait_for_selector('[data-tkrow="practice"]', state='attached', timeout=60000); pg.wait_for_timeout(800)
    grp = pg.locator('[data-tkgroup="tracker"]')
    ok(grp.count() == 1 and grp.locator('[data-tkrow="practice"]').count() == 1, 'P1 Help lists it under Using this tracker')
    ok(pg.locator('[data-tkrow="practice"]').first.text_content().strip().startswith('Can I practice first?'), 'P1 its title is "Can I practice first?"')
    for word in ['practice', 'class']:
        box = pg.locator('#main input[type="search"]').first
        box.fill(word); pg.wait_for_timeout(500)
        ok(pg.locator('[data-tkrow="practice"]').first.is_visible(), f'P1 Help\'s search finds it by "{word}"')
        box.fill(''); pg.wait_for_timeout(300)
    pg.goto(f'{BASE}/track.html#/help/practice'); pg.wait_for_selector('#main [data-tkturn]', timeout=30000)
    for _ in range(3):   # one turn per tap, as a reader would
        if pg.locator('#main [data-tknext]').count(): pg.locator('#main [data-tknext]').click(); pg.wait_for_timeout(500)
    pg.wait_for_selector('#main .tk-act', timeout=10000); pg.wait_for_timeout(800)
    ok(pg.locator('#main [data-tkturn]').count() == 3, 'P1 the answer has three turns')
    txt = pg.locator('#main').inner_text()
    ok('Nothing reaches lawmakers' in txt and 'that is the practice copy' in txt and 'After the first steps, a Next day' in txt, 'P1 the answer says nothing is sent, what Sandbox means and when Next day shows')
    a = pg.locator('#main .tk-act a')
    ok(a.count() == 1 and a.inner_text().strip() == 'Open the practice copy' and a.get_attribute('href') == 'track.html?demo=1', 'P1 its button opens the practice copy')
    pg.screenshot(path=os.path.join(OUT, 'help-practice-phone.png'), full_page=True)
    c.close()
    # P2 You, live
    c, pg = ctx(True)
    pg.goto(f'{BASE}/track.html#/more'); pg.wait_for_selector('#main .yu-you', timeout=60000); pg.wait_for_timeout(1200)
    l = pg.locator('#main [data-yu-practice]')
    ok(l.count() == 1 and l.inner_text().strip() == 'Practice on the 2026 bills' and l.get_attribute('href') == 'track.html?demo=1', 'P2 You has "Practice on the 2026 bills"')
    pg.screenshot(path=os.path.join(OUT, 'you-live-phone.png'), full_page=True)
    l.click(); pg.wait_for_url('**/track.html?demo=1**', timeout=30000); pg.wait_for_selector('.band', timeout=60000)
    ok('Sandbox' in pg.locator('.band').inner_text(), 'P2 it opens the practice copy, Sandbox band and all')
    c.close()
    c, pg = ctx()
    pg.goto(f'{BASE}/track.html?rec=0#/more'); pg.wait_for_selector('#main .mr-more', timeout=60000); pg.wait_for_timeout(1000)
    r = pg.locator('#main a[href="track.html?demo=1"]')
    ok(r.count() == 1 and 'Try the practice copy' in r.inner_text(), 'P2 the old More has the row')
    c.close()
    # P3 inside the practice copy
    c, pg = ctx(True)
    pg.goto(f'{BASE}/track.html?demo=1#/more'); pg.wait_for_selector('#main .yu-you', timeout=60000); pg.wait_for_timeout(1200)
    l = pg.locator('#main [data-yu-practice]')
    ok(l.count() == 1 and l.inner_text().strip() == 'Leave the practice copy' and l.get_attribute('href') == 'track.html', 'P3 the practice copy leads back out')
    l.scroll_into_view_if_needed(); pg.wait_for_timeout(300)
    bb, tabs = l.bounding_box(), pg.locator('nav.tabs').bounding_box()
    ok(bb and tabs and bb['y'] + bb['height'] <= tabs['y'], 'P3 the way out sits above the tab bar')
    pg.screenshot(path=os.path.join(OUT, 'you-practice-phone.png'))
    c.close()
    ok(not errs, f'P4 no page errors {errs[:3]}')
    br.close()
print(f'{sum(res)}/{len(res)} passed')
sys.exit(0 if all(res) else 1)
