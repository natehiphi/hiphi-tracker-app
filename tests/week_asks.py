# This week's asks (R-212 #36, the Neighborhood Captain and the Partner Staffer), in the practice copy served locally.
# The practice Tuesday (17 Mar 2026), nothing followed: the page is the same for everyone.
#   W1  #/week lists every bill HIPHI takes a stand on with testimony due in the next 7 days, soonest first, one row a bill,
#       none it only watches, none past its deadline, none due after the 7 days (checked against the page's own data)
#   W2  each row: name, "Testimony due ...", "HB nnnn · HIPHI supports"; amber only inside a day
#   W3  the message: a first line with the count, each bill's name, side, dated deadline and share page tagged ?via=week,
#       and this page's link; "Copy the message" puts it on the clipboard and says so
#   W4  "Choose the bills": unticking one takes it out of the message and the count; none ticked, Copy says to tick one
#   W5  a row's Share opens the ask-a-friend sheet for that bill's testimony
#   W6  the filled "Copy all N as one message" is on the first screen (the critic's high, 21 Oct)
#   W4b unticking a bill after changing the words says so, and Undo puts the words and the tick back (B-5)
#   W7  Find (browsing) links to it under "Needs voices this week", which opens the page; a bill opened from it goes Back to it
#   W8  the practice copy off-season (&season=off): the break line, no rows; Find has no row
#   W9  no page errors; the phone page is no wider than the phone
#   python3 tests/week_asks.py [base] [outdir]
import sys, os, re
from playwright.sync_api import sync_playwright
BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832/').rstrip('/')
OUT = sys.argv[2] if len(sys.argv) > 2 else '.'
res = []
def ok(c, m): res.append(bool(c)); print('PASS' if c else 'FAIL', m)
CLEAN = """(() => { if (sessionStorage.getItem('__set')) return; sessionStorage.setItem('__set', '1');
  for (const k of Object.keys(localStorage)) if (k.startsWith('hiphi_')) localStorage.removeItem(k);
  localStorage.setItem('hiphi_wiz_demo', JSON.stringify({ done: true, issues: [] }));
  localStorage.setItem('hiphi_tour_home_demo', '{"how":"test"}'); localStorage.setItem('hiphi_tour_bill_demo', '{"how":"test"}'); })();"""
# What the page should list, from the same data (S.pool), by the rule written out here rather than the page's function.
WANT = """async () => { const c = await import('./pub/core.js'), now = Date.now(), end = now + 7 * 864e5, best = {};
  for (const h of c.S.pool.hearings) { if (h.status === 'cancelled' || !h.testimony_deadline) continue;
    const t = Date.parse(h.testimony_deadline); if (t <= now || t > end) continue;
    const b = c.S.pool.bills.find(x => x.id === h.bill_id); if (!b || !c.alive(b) || !b.hiphi_position || b.hiphi_position === 'monitor') continue;
    if (!(b.bill_number in best) || t < best[b.bill_number]) best[b.bill_number] = t; }
  return Object.entries(best).sort((x, y) => x[1] - y[1] || x[0].localeCompare(y[0])).map(x => x[0].replace(/^([A-Z]+)(\\d)/, '$1 $2')); }"""
ROWS = "() => [...document.querySelectorAll('.wk-row')].map(li => ({ name: li.querySelector('.rc-rname').innerText, due: li.querySelector('.rc-rstat').innerText, warn: li.querySelector('.rc-rstat').classList.contains('warn'), part: li.querySelector('.rc-rpart').innerText }))"
with sync_playwright() as p:
    br = p.chromium.launch(); errs = []
    def page(hash='#/week', extra='&day=tue', phone=True):
        c = br.new_context(**({'viewport': {'width': 375, 'height': 812}, 'is_mobile': True, 'has_touch': True} if phone else {'viewport': {'width': 1366, 'height': 900}}))
        c.add_init_script(CLEAN); c.grant_permissions(['clipboard-read', 'clipboard-write'])
        pg = c.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(f'{BASE}/track.html?demo=1{extra}{hash}'); pg.wait_for_selector('#main', timeout=60000); pg.wait_for_timeout(2000)
        return c, pg
    c, pg = page()
    pg.wait_for_selector('.wk-row', timeout=30000)
    want, rows = pg.evaluate(WANT), pg.evaluate(ROWS)
    nums = [r['part'].split(' · ')[0] for r in rows]
    ok(len(want) >= 3 and nums == want, f'W1 the rows are the bills with testimony due in 7 days, soonest first ({len(nums)}: {nums[:4]}...)')
    ok(pg.locator('#wk-list-h').inner_text() == f'{len(rows)} bills this week', 'W1 the list says how many')
    ok(any(' · HIPHI strongly supports' in r['part'] for r in rows) and not any(r['part'].endswith('HIPHI supports') for r in rows), 'W2 the side only where it is not plain "supports" (A-14)')
    ok(all(r['due'].startswith('Testimony due ') for r in rows) and all(re.fullmatch(r'[HS][BRC]+ \d+( · HIPHI (strongly supports|supports with changes|opposes|strongly opposes|has comments))?', r['part']) for r in rows), 'W2 each row says its deadline and HIPHI\'s side')
    ok(any(r['warn'] for r in rows) and not all(r['warn'] for r in rows), 'W2 amber only on the ones inside a day')
    pg.screenshot(path=os.path.join(OUT, 'week-phone.png'))
    text = pg.locator('#wk-text').input_value()
    first = text.split('\n')[0]
    ok(first.startswith(f'This week at the Hawaiʻi Legislature, {len(rows)} bills HIPHI takes a stand on'), f'W3 the message starts with the count ({first[:70]})')
    links = re.findall(r'https?://\S+', text)
    ok(len([u for u in links if u.endswith('-testify?via=week')]) == len(rows) and links[-1].endswith('#/week'), 'W3 a tagged share page per bill, and this page\'s link last')
    ok(all(f'({n})' in text or f'{n}:' in text for n in nums) and 'Testimony is due Tue, Mar 17 at' in text, 'W3 each bill named, with a dated deadline')
    ok('vape' not in text.lower(), 'W3 no "vape" in the message (R-158)')
    # W6 the jump
    topb = pg.locator('.wk-top [data-wk-copy]')
    y = topb.evaluate('b => b.getBoundingClientRect().bottom')
    ok(topb.inner_text().strip() == f'Copy all {len(rows)} as one message' and y < 812, f'W6 the filled copy button is on the first screen ({int(y)}px)')
    topb.click(); pg.wait_for_timeout(400)
    clip = pg.evaluate('navigator.clipboard.readText()')
    ok(clip.strip() == text.strip(), 'W3 Copy the message copies it')
    ok('Copied' in pg.locator('.wk-top .wk-said').inner_text(), 'W3 and says so, beside the button')
    # W4 choose
    pg.locator('[data-rc-fold="wk-pick"] summary').click(); pg.wait_for_timeout(200)
    pg.locator('[data-wk-pick]').first.uncheck(); pg.wait_for_timeout(200)
    t2 = pg.locator('#wk-text').input_value()
    ok(nums[0] not in t2 and f'{len(rows) - 1} bills HIPHI' in t2, f'W4 unticking {nums[0]} takes it out of the message')
    ok(pg.locator('[data-rc-fold="wk-pick"] .rc-fp').inner_text() == f'{len(rows) - 1} of {len(rows)} in the message', 'W4 the fold says how many are in')
    pg.locator('#wk-text').fill('Aloha team! ' + t2); pg.locator('[data-wk-pick]').nth(1).uncheck(); pg.wait_for_timeout(200)
    said = pg.locator('#wk-copy-h ~ .wk-said, .rc-sec .wk-said').last.inner_text()
    ok('replaced' in said and 'Aloha team!' not in pg.locator('#wk-text').input_value(), 'W4b changed words replaced by a tick: it says so')
    pg.locator('.wk-undo').click(); pg.wait_for_timeout(200)
    ok(pg.locator('#wk-text').input_value().startswith('Aloha team!') and pg.locator('[data-wk-pick]').nth(1).is_checked(), 'W4b Undo puts the words and the tick back')
    pg.screenshot(path=os.path.join(OUT, 'week-phone-message.png'))
    for b in pg.locator('[data-wk-pick]').all(): b.uncheck()
    pg.locator('.rc-sec [data-wk-copy]').click(); pg.wait_for_timeout(200)
    ok('Tick at least one bill' in pg.locator('.rc-sec .wk-said').inner_text(), 'W4 none ticked: Copy asks for one')
    # W5 Share
    pg.locator('.wk-share').first.click(); pg.wait_for_selector('dialog.af-sheet[open]', timeout=5000); pg.wait_for_timeout(900)
    sheet = pg.locator('dialog.af-sheet[open]').first
    st = sheet.inner_text() if sheet.count() else ''
    ok(sheet.count() and ('testimony' in st.lower() or 'Testimony' in st), f'W5 Share opens the ask-a-friend sheet for testimony ({st[:60]!r})')
    ok(pg.evaluate('document.documentElement.scrollWidth') <= 375, 'W9 the phone page is no wider than the phone')
    c.close()
    # laptop
    c, pg = page(phone=False); pg.wait_for_selector('.wk-row', timeout=30000)
    pg.screenshot(path=os.path.join(OUT, 'week-laptop.png'), full_page=True); c.close()
    # W7 Find's row, and Back from a bill
    c, pg = page('#/find')
    row = pg.locator('.rc-sec a[href="#/week"]')
    ok(row.count() == 1 and 'Pass this week’s asks on' in row.inner_text() and pg.locator('.rc-foot a[href="#/week"]').count() == 0, 'W7 Find links to it under "Needs voices this week" (once)')
    row.click(); pg.wait_for_selector('.wk-row', timeout=30000)
    ok(pg.locator('.rc-back').inner_text().strip() == 'Find', 'W7 the page says the way back (Find)')
    pg.locator('.wk-row .rc-row').first.click(); pg.wait_for_timeout(2500)
    ok('#/bill/' in pg.url, 'W7 a row opens its bill')
    pg.go_back(); pg.wait_for_selector('.wk-row', timeout=30000)
    ok(pg.url.endswith('#/week'), 'W7 Back returns to the week')
    c.close()
    # W8 off-season
    c, pg = page('#/week', '&season=off'); pg.wait_for_selector('.wk .rc-empty', timeout=30000)
    ok('on break' in pg.locator('.wk .rc-empty').inner_text() and pg.locator('.wk-row').count() == 0, 'W8 off-season: the break line, no rows')
    pg.goto(f'{BASE}/track.html?demo=1&season=off#/find'); pg.wait_for_timeout(2500)
    ok(pg.locator('.rc-foot a[href="#/week"]').count() == 0, 'W8 off-season: no row on Find')
    c.close()
    ok(not errs, f'W9 no page errors {errs[:2]}')
    br.close()
print(f'{sum(res)}/{len(res)} passed')
sys.exit(0 if all(res) else 1)
