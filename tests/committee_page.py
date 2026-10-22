# A committee's page: the next real hearing, "yours", Email the chair, HIPHI's bills here (R-212 #42; the walks of 10/8), in the
# practice copy (clock: Monday 16 March 2026, 9:00 HST).
#   C1  the head says the next real hearing (day, time, room), under the weekly "Usually meets" times; when the card is that
#       same sitting, the card says it and the head adds nothing (A-14)
#   C2  "Email the chair" opens the chair's page with an email about the bill here that is due soonest (?from=)
#   C3  "Bills at the next hearing": the count in its preview, rows that open the bill; the card no longer repeats the chair
#   C7  "Email the chair" keeps the way back: the lawmaker's back link returns to the committee, not the bill
#   C4  "yours": with saved districts, the Members preview and row name your senator; the committee list says "Your senator is a member"
#   C5  a committee with nothing set says so plainly; between sessions it names opening day (&season=off)
#   C6  phone: no sideways scroll, the head's links at least 44px tall; no page errors
#   python3 tests/committee_page.py [base] [outdir]
import sys, os, re
from playwright.sync_api import sync_playwright
BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832/').rstrip('/')
OUT = sys.argv[2] if len(sys.argv) > 2 else '.'
res = []
def ok(c, m): res.append(bool(c)); print('PASS' if c else 'FAIL', m)
# Senate 3 is Sen. Kanuha, a member of Health and Human Services (HHS) in the 2026 snapshot.
INIT = """(() => { if (sessionStorage.getItem('__set')) return; sessionStorage.setItem('__set', '1');
  for (const k of Object.keys(localStorage)) if (k.startsWith('hiphi_')) localStorage.removeItem(k);
  localStorage.setItem('hiphi_wiz_demo', JSON.stringify({ done: true, issues: ['Tobacco & E-Cigarettes'] }));
  localStorage.setItem('hiphi_districts_demo', JSON.stringify({ senate: 3, house: 5 }));
  localStorage.setItem('hiphi_tour_home_demo', '{"how":"test"}'); localStorage.setItem('hiphi_tour_bill_demo', '{"how":"test"}'); })();"""
LOADED = "() => { const e = document.querySelector('.cmt-next'); return e && !/Looking up/.test(e.innerText); }"
with sync_playwright() as p:
    br = p.chromium.launch(); errs = []
    for w, h, tag in [(1366, 900, 'laptop'), (390, 844, 'phone')]:
        c = br.new_context(viewport={'width': w, 'height': h}); c.add_init_script(INIT)
        pg = c.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(f'{BASE}/track.html?demo=1#/committee/HHS'); pg.wait_for_selector('[data-rc-fold="cmt-agenda"]', timeout=90000); pg.wait_for_timeout(500)
        mail = pg.locator('.cmt-mail')
        if tag == 'laptop':
            ok(pg.locator('.cmt-next').count() == 0 and pg.locator('.rc-act .rc-awhen').inner_text().startswith('Hearing today'), 'C1 the card\'s own sitting is said once, by the card')
            ok(pg.locator('.rc-lede').inner_text().startswith('Usually meets Mon, Wed and Fri'), 'C1 the weekly times say "Usually"')
            href = mail.get_attribute('href') or ''
            ok(mail.inner_text().strip() == 'Email the chair' and re.match(r'#/legislator/\d+\?from=HB\d+$', href), f'C2 Email the chair ({href})')
            ok('Write to the chair' not in pg.locator('#main').inner_text(), 'C3 the card does not repeat the chair (A-14)')
            ag = pg.locator('[data-rc-fold="cmt-agenda"]')
            prev = ag.locator('summary').inner_text()
            ok(re.search(r'^\d+ bills?(, HIPHI’s|, all HIPHI’s|, \d+ of them HIPHI’s)?$', prev.split('\n')[-1]), f'C3 the agenda preview counts its bills ({prev!r})')
            ag.locator('summary').click(); pg.wait_for_timeout(300)
            ok(ag.locator('.rc-rows a').count() >= 1, 'C3 the agenda lists its bills')
            mem = pg.locator('[data-rc-fold="cmt-members"]')
            ok('Sen. Kanuha (your senator)' in mem.locator('summary').inner_text(), f'C4 Members preview names your senator ({mem.locator("summary").inner_text()!r})')
            mem.locator('summary').click(); pg.wait_for_timeout(300)
            ok(re.search(r'Dru Mamo Kanuha\s+Member · Your senator', mem.inner_text()), 'C4 the member row says "Your senator"')
            pg.screenshot(path=os.path.join(OUT, 'committee-page.png'), full_page=True)
            mail.click(); pg.wait_for_timeout(1500)
            ok(re.search(r'#/legislator/\d+\?from=', pg.url) and 'Email Sen.' in pg.locator('#main').inner_text(), f'C2 the chair\'s page offers the email ({pg.url})')
            bk = pg.locator('.rc-top a').first
            ok(bk.get_attribute('href') == '#/committee/HHS' and 'Health and Human Services' in bk.inner_text(), f'C7 back goes to the committee ({bk.get_attribute("href")}, {bk.inner_text()!r})')
            pg.goto(f'{BASE}/track.html?demo=1#/committees'); pg.wait_for_timeout(1500)
            pg.locator('[data-rc-fold="cmt-S"] summary').click(); pg.wait_for_timeout(300)
            ok(re.search(r'Health and Human Services\s+Your senator is a member · Usually meets', pg.locator('[data-rc-fold="cmt-S"]').inner_text()), 'C4 the list says "Your senator is a member"')
            pg.goto(f'{BASE}/track.html?demo=1#/committee/WAM'); pg.wait_for_function(LOADED, timeout=30000)
            ok(pg.locator('.cmt-next').inner_text().startswith('No hearing is set yet.'), f'C5 nothing set ({pg.locator(".cmt-next").inner_text()!r})')
            pg.goto(f'{BASE}/track.html?demo=1#/committee/EDU'); pg.wait_for_function(LOADED, timeout=30000)
            t = pg.locator('.cmt-next').inner_text()
            ok(re.match(r'Next hearing (today|tomorrow|\w{3}) \d+:\d\d [AP]M · Room \d+$', t), f'C1 a sitting before the card\'s says its day, time and room ({t!r})')
            ok(pg.locator('.cmt-mail').count() == 1, 'C2 Email the chair also without a hearing')
            pg.goto(f'{BASE}/track.html?demo=1&season=off#/committee/HHS'); pg.reload(); pg.wait_for_function(LOADED, timeout=30000)
            ok(re.match(r'No hearings until the session opens on January \d+, 2027\.$', pg.locator('.cmt-next').inner_text()), f'C5 between sessions ({pg.locator(".cmt-next").inner_text()!r})')
        else:
            ok(pg.evaluate('document.documentElement.scrollWidth <= innerWidth'), 'C6 no sideways scroll on a phone')
            hs = [pg.locator('.rc-hrow a').nth(i).bounding_box()['height'] for i in range(pg.locator('.rc-hrow a').count())]
            ok(hs and min(hs) >= 44, f'C6 the head\'s links are 44px tall ({[round(x) for x in hs]})')
            pg.screenshot(path=os.path.join(OUT, 'committee-page-phone.png'))
        c.close()
    ok(not errs, f'C6 no page errors {errs[:3]}')
    br.close()
print(f'{sum(res)}/{len(res)} passed')
