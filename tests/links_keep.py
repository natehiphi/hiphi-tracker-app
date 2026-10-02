# A link straight into the testimony walkthrough (R-124), the "My issues link" (R-123), "What's next" on a result (R-126)
# and the calendar feed's place on the issue page (R-125), in the sandbox served locally.
#   python3 tests/links_keep.py [base]     base defaults to http://localhost:8832/track.html?demo=1
import sys, re, os, json
from playwright.sync_api import sync_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832/track.html?demo=1'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
res = []
def ok(c, m): res.append(bool(c)); print('PASS' if c else 'FAIL', m)
def ready(pg):
    pg.wait_for_function("() => !!document.querySelector('main') && !document.querySelector('.skelpage') && !document.querySelector('.bl-skel')", timeout=60000); pg.wait_for_timeout(500)
SKIP = "() => { try { const w = JSON.parse(localStorage.getItem('hiphi_wiz') || '{}'); localStorage.setItem('hiphi_wiz', JSON.stringify({ ...w, done: true, step: 99 })); localStorage.setItem('hiphi_tour_bill', '{\"how\":\"test\"}'); localStorage.setItem('hiphi_tour_home', '{\"how\":\"test\"}'); } catch {} }"
snap = json.load(open(os.path.join(ROOT, 'demo', 'snapshot.json')))
hs = {}
for h in snap['hearings']:
    if h.get('status') == 'scheduled' and h.get('testimony_deadline', '') > '2026-03-16T19:00:00' and h['scheduled_at'] < '2026-03-28': hs.setdefault(h['bill_id'], []).append(h)
bill = next(b for b in snap['bills'] if b.get('position') in ('strongly_support', 'support') and b.get('nickname') and b['id'] in hs)
NUM = bill['bill_number']
issues = snap['issues']; slug1, slug2 = issues[0]['slug'], issues[1]['slug']; cat1 = snap['categories'][0]['key']
with sync_playwright() as p:
    br = p.chromium.launch()
    ctx = br.new_context(viewport={'width': 1280, 'height': 900}); ctx.grant_permissions(['clipboard-read', 'clipboard-write'])
    pg = ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    # 1. the walkthrough link
    pg.goto(BASE + '#/'); ready(pg); pg.evaluate(SKIP)
    pg.goto(BASE + f'#/bill/{NUM}/testify'); pg.reload(); ready(pg); pg.wait_for_timeout(1500)
    dlg = pg.locator('#hp-dlg[open], dialog.hp[open], dialog[open]')
    ok(dlg.count() >= 1 and 'testimony' in dlg.first.inner_text().lower(), f'#/bill/{NUM}/testify opens the testimony walkthrough')
    pg.keyboard.press('Escape'); pg.wait_for_timeout(500)
    # 2. the My issues link: built from what is followed, restored in a fresh browser
    pg.goto(BASE + '#/'); ready(pg)
    pg.evaluate("async (a) => { const c = await import('./pub/core.js'); const i1 = c.S.issues.find(x => x.slug === a[0]); await c.setFollows({ issuesOn: [i1.id], catsOn: [a[1]] }); }", [slug1, cat1])
    link = pg.evaluate("async () => (await import('./pub/core.js')).issuesLink()")
    ok(link.endswith(f'#/follow/cat:{cat1},{slug1}') or (f'cat:{cat1}' in link and slug1 in link and '#/follow/' in link), f'the issues link names the category and the issue: {link[-60:]}')
    pg.goto(BASE + '#/more'); ready(pg)
    ok('My issues link' in pg.locator('main').inner_text(), 'More offers "My issues link"')
    ctx2 = br.new_context(viewport={'width': 390, 'height': 844}); pg2 = ctx2.new_page(); errs2 = []; pg2.on('pageerror', lambda e: errs2.append(str(e)))
    pg2.goto(link); pg2.wait_for_timeout(3500)
    t = pg2.locator('body').inner_text()
    ok(pg2.evaluate("location.hash") in ('#/', '') and 'are here' in t or 'is here' in t, f'opened in a fresh browser, the link follows the issues and lands on Home (hash {pg2.evaluate("location.hash")!r})')
    got = pg2.evaluate("async () => { const c = await import('./pub/core.js'); return { issues: [...c.S.issueFollows].length, cats: [...c.S.catFollows].length, first: c.wiz().done }; }")
    ok(got['issues'] >= 1 and got['cats'] >= 1 and got['first'] is True, f'the issue and the category are followed, and the first visit is skipped: {got}')
    ctx2.close()
    # 3. "What's next" words
    nxt = pg.evaluate("async n => { const c = await import('./pub/core.js'); const b = c.S.bills.find(x => x.bill_number === n) || Object.values(c.S.extra).find(x => x.bill_number === n) || c.D.bills.find(x => x.bill_number === n); return c.nextWords(b); }", NUM)
    ok(nxt.startswith('Next:') and ('hearing' in nxt or 'vote' in nxt or 'report' in nxt), 'the next step for ' + NUM + ': ' + nxt)
    # 4. the finale's keep line and the calendar address
    keep = pg.evaluate("async () => (await import('./pub/start.js')).keepLine()")
    ok('Copy my issues link' in keep and 'Text it to myself' in keep and 'sms:' in keep, 'the finale offers the issues link, with a way to text it')
    cal = pg.evaluate("async s => { const c = await import('./pub/core.js'); return c.calendarUrl(c.S.issues.find(x => x.slug === s)); }", slug1)
    ok(cal == f'#/issue/{slug1}', f'the sandbox has no feeds, so the calendar link opens the issue page ({cal})')
    ok(os.path.exists(os.path.join(ROOT, 'cal', f'{slug1}.ics')) and open(os.path.join(ROOT, 'cal', f'{slug1}.ics')).read().startswith('BEGIN:VCALENDAR'), f'the feed file cal/{slug1}.ics exists for the live site')
    # 5. the finale on a phone, with the keep line shown: nothing runs past the edge, and its own button takes the tap
    # (10/1: a calendar label naming the issue made the page 452px wide and the tap missed)
    ctx3 = br.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True, device_scale_factor=2); pg3 = ctx3.new_page(); errs3 = []; pg3.on('pageerror', lambda e: errs3.append(str(e)))
    pg3.goto(BASE + '&restart#/'); ready(pg3)
    pg3.evaluate("async a => { const c = await import('./pub/core.js'); await c.setFollows({ issuesOn: [c.S.issues.find(x => x.slug === a[0]).id], catsOn: [] }); }", [slug1])
    pg3.goto(BASE + '#/start/9'); ready(pg3); pg3.wait_for_timeout(2500)
    ok(pg3.locator('.st-keep').count() == 1 and 'Add to my calendar' in pg3.locator('.st-keep').inner_text(), 'the finale shows the keep line with the calendar button')
    w = pg3.evaluate('document.documentElement.scrollWidth')
    ok(w <= 390, f'nothing on the finale runs past a phone\'s edge (page {w}px wide)')
    pg3.locator('[data-stdone]').click(timeout=5000); pg3.wait_for_timeout(1500)
    ok(pg3.evaluate('location.hash') in ('#/', ''), f'its button takes the tap and lands on Home ({pg3.evaluate("location.hash")})')
    ctx3.close()
    ok(not errs and not errs2 and not errs3, 'no page errors: ' + '; '.join((errs + errs2 + errs3)[:3]))
    br.close()
print(f'{sum(res)}/{len(res)} passed'); sys.exit(0 if all(res) else 1)
