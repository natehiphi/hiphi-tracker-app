# One share everywhere, a link newcomer left to finish, and the staff wording fixes (R-113 P3, R-114 P4, R-112 S9),
# in the sandbox served locally. Headless Chromium has no share sheet, so every share goes to the clipboard, which the
# test reads back. Checks: a bill's share text carries the testimony deadline and the link once; the issue page has
# Share this issue and its text names the issue with the link once; the finale's "Know someone who cares" line; a
# newcomer on a shared link gets the deadline on the card and in the head, no partner welcome, no automatic tour;
# the Coming-up screen asks once per visit; the share pages and the 404 forwarder pass ?via= and utm_ on; Staff v2's
# hearing page goes back to Today or Week; the Help words.
#   python3 tests/share_links.py [base]     base defaults to http://localhost:8832/
import sys, re, os, json
from playwright.sync_api import sync_playwright
BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832/').rstrip('/') + '/'
PUB = BASE + 'track.html?demo=1'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
res = []
def ok(c, m): res.append(bool(c)); print('PASS' if c else 'FAIL', m)
def ready(pg):
    pg.wait_for_function("() => !!document.querySelector('main') && !document.querySelector('.skelpage') && !document.querySelector('.bl-skel')", timeout=60000); pg.wait_for_timeout(500)
SKIP = "() => { try { const w = JSON.parse(localStorage.getItem('hiphi_wiz') || '{}'); localStorage.setItem('hiphi_wiz', JSON.stringify({ ...w, done: true, step: 99 })); localStorage.setItem('hiphi_tour_bill', '{\"how\":\"test\"}'); localStorage.setItem('hiphi_tour_home', '{\"how\":\"test\"}'); } catch {} }"
snap = json.load(open(os.path.join(ROOT, 'demo', 'snapshot.json')))
# A position bill with a hearing ahead of the sandbox's day (Mon 16 Mar 2026) whose testimony is still open.
hs = {}
for h in snap['hearings']:
    if h.get('status') == 'scheduled' and h.get('testimony_deadline', '') > '2026-03-16T19:00:00' and h['scheduled_at'] < '2026-03-28':
        hs.setdefault(h['bill_id'], []).append(h)
bill = next(b for b in snap['bills'] if b.get('position') not in (None, 'monitor') and b.get('nickname') and b['id'] in hs)
NUM = bill['bill_number']; NICK = bill['nickname']
with sync_playwright() as p:
    br = p.chromium.launch()
    def context(w=1280, h=900):
        ctx = br.new_context(viewport={'width': w, 'height': h}); ctx.grant_permissions(['clipboard-read', 'clipboard-write']); return ctx
    clip = lambda pg: pg.evaluate("() => navigator.clipboard.readText()")
    # ---- 1. a bill's share: the deadline in the words, the link once ----
    ctx = context(); pg = ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(PUB + '#/'); ready(pg); pg.evaluate(SKIP); pg.goto(PUB + f'#/bill/{NUM}'); ready(pg)
    # The words every share uses (shareFor), on this bill's soonest open hearing; the sheet itself is the device's.
    t = pg.evaluate("async n => { const c = await import('./pub/core.js'), a = await import('./pub/actions.js'); const b = c.S.bills.find(x => x.bill_number === n) || Object.values(c.S.extra).find(x => x.bill_number === n); const h = c.hearingsOf(b).filter(x => x.testimony_deadline && new Date(x.testimony_deadline) > Date.now()).sort((x, y) => x.scheduled_at < y.scheduled_at ? -1 : 1)[0]; const t = a.shareFor(b, h); return { text: t.text, url: t.url, copy: t.copy }; }", NUM)
    ok('Testimony is due' in t['text'] and re.search(r'due \w{3}, \w{3} \d{1,2} at \d{1,2}:\d{2} [AP]M', t['text']) is not None, f"the share text says when testimony is due: {t['text'][:140]}")
    ok(t['copy'].count('http') == 1 and f'#/bill/{NUM}' in t['url'] and 'http' not in t['text'], 'the link is passed once: as the url for a share sheet, at the end of the copied text')
    ok(NICK in t['text'], 'the bill is named by its everyday name')
    # ---- 2. Share this issue ----
    islug = next((i['slug'] for i in snap['issues'] if any(r['bill_id'] == bill['id'] and r['issue_id'] == i['id'] for r in snap.get('billIssues', []))), None)
    pg.goto(PUB + f'#/issue/{islug}'); ready(pg)
    sb = pg.locator('[data-shareissue]').first
    ok(sb.count() == 1 and 'Share this issue' in sb.inner_text(), 'the issue page offers Share this issue')
    pg.evaluate("() => navigator.clipboard.writeText('')"); sb.click(); pg.wait_for_timeout(600); t = clip(pg)
    iname = pg.locator('.fd-ihead h1').inner_text()
    ok(iname in t and t.count('http') == 1 and f'#/issue/{islug}' in t, f'the issue share text names the issue with its link once: {t[:120]}')
    ok('Link copied' in pg.locator('[data-shareissue]').first.inner_text(), 'the button says Link copied')
    # ---- 3. the finale's line, for someone who follows an issue ----
    pg.evaluate("async s => { const c = await import('./pub/core.js'); const i = c.S.issues.find(x => x.slug === s); await c.setFollows({ issuesOn: [i.id] }); }", islug)
    line = pg.evaluate("async () => (await import('./pub/keep.js')).shareLine()")
    ok('Know someone who cares about' in line and 'data-stshare' in line, 'the finale has "Know someone who cares about <issue>? Send it"')
    ctx.close()
    # ---- 4. a newcomer on a shared link: the deadline up top, no partner welcome, no automatic tour ----
    ctx = context(390, 844); pg = ctx.new_page(); errs2 = []; pg.on('pageerror', lambda e: errs2.append(str(e)))
    pg.goto(PUB + f'&via=share&restart#/bill/{NUM}'); ready(pg); pg.wait_for_timeout(2500)
    card = pg.locator('.bl-newbie')
    ok(card.count() == 1 and 'New here?' in card.inner_text(), 'the "New here?" card shows')
    ok('Testimony is due' in card.inner_text(), 'the card says when testimony is due')
    ok('friends of' not in pg.locator('main').inner_text(), 'a friend\'s shared link gets no partner welcome line')
    ok(pg.locator('.bl-head .chip', has_text='Testimony due').count() == 1, 'the head carries a "Testimony due" chip on the first phone screen')
    ok(pg.locator('.tr-tip').count() == 0, 'no tour started by itself')
    pg.locator('[data-bl-newlater]').first.click(); pg.wait_for_timeout(1500)
    ok(pg.locator('.tr-tip').count() == 0 and 'Take the 2-minute tour' in pg.locator('main').inner_text(), 'after "Just looking", still no tour; the quiet line offers it')
    ctx.close()
    # ---- 5. one email ask per visit: the Coming-up screen stays quiet once the walkthrough asked ----
    ctx = context(); pg = ctx.new_page()
    pg.goto(PUB + '&restart#/'); ready(pg)
    pg.evaluate("async () => { const c = await import('./pub/core.js'); c.S.nudgedThisVisit = true; c.wizSet({ step: 1 }); }")
    step = pg.evaluate("async () => { const s = await import('./pub/start.js'); return 1; }")
    pg.goto(PUB + '#/start/8'); pg.wait_for_timeout(1200)
    t = pg.locator('main').inner_text()
    quiet = 'Add your email any time under More' in t
    form = pg.locator('#st-eform').count() > 0
    ok(quiet or not form or 'Coming up' not in t, f'the Coming-up screen asks once per visit (quiet line: {quiet}, form: {form})')
    ctx.close()
    # ---- 6. the share pages and the 404 forwarder pass ?via= and utm_ on ----
    ctx = context(); pg = ctx.new_page()
    html404 = open(os.path.join(ROOT, '404.html'), encoding='utf-8').read()
    pg.route(re.compile(r'.*/track\.html\?.*'), lambda r: r.fulfill(status=200, content_type='text/html', body='<title>stub</title>'))
    pg.route(re.compile(r'.*/b/HB9999.*'), lambda r: r.fulfill(status=404, content_type='text/html', body=html404))
    pg.goto(BASE + 'b/HB9999?via=kokua&utm_source=newsletter'); pg.wait_for_url(re.compile(r'track\.html'), timeout=15000)
    ok(pg.url == BASE + 'track.html?via=kokua&utm_source=newsletter#/bill/HB9999', f'404.html keeps a partner word and a campaign word: {pg.url}')
    pg.goto(BASE + 'b/SB2175.html?via=kokua'); pg.wait_for_url(re.compile(r'track\.html'), timeout=15000)
    ok(pg.url == BASE + 'track.html?via=kokua#/bill/2026/SB2175', f'a share page keeps a partner word: {pg.url}')
    pg.goto(BASE + 'b/SB2175.html'); pg.wait_for_url(re.compile(r'track\.html'), timeout=15000)
    ok(pg.url == BASE + 'track.html?via=share#/bill/2026/SB2175', f'a share page with nothing added counts as a share: {pg.url}')
    ctx.close()
    # ---- 7. Staff v2: the hearing page goes back to where it came from; the Help words ----
    ctx = context(); pg = ctx.new_page()
    pg.goto(BASE + 'staff.html?demo=1#/'); pg.wait_for_timeout(3500)
    hid = pg.evaluate("() => (document.querySelector('a[href^=\"#/hearing/\"]') || {}).getAttribute?.('href') || ''")
    ok(hid.endswith('?from=today') or hid.endswith('?from=week'), f'Today links a hearing with where it came from: {hid}')
    pg.goto(BASE + 'staff.html?demo=1' + hid.split('?')[0] + '?from=today'); pg.wait_for_timeout(1500)
    back = pg.locator('.hr-page a, .hr-page button').filter(has_text=re.compile(r'^\s*Today\s*$')).first
    ok(back.count() >= 1, 'opened from Today, the hearing page goes back to Today')
    pg.goto(BASE + 'staff.html?demo=1' + hid.split('?')[0] + '?from=week'); pg.wait_for_timeout(1200)
    ok(pg.locator('.hr-page').inner_text().count('Week') >= 1, 'opened from the Week view, it goes back to Week')
    pg.goto(BASE + 'staff.html?demo=1#/help/words'); pg.wait_for_timeout(1500); t = pg.locator('main').inner_text()
    pg.goto(BASE + 'staff.html?demo=1#/help/public'); pg.wait_for_timeout(1200); t += pg.locator('main').inner_text()
    ok('Testimony is still taken' in t and 'Visitors follow issues' in t and 'No new testimony is taken' not in t, 'Help: decision-making meetings take testimony; visitors follow issues')
    ctx.close()
    ok(not errs and not errs2, 'no page errors: ' + '; '.join((errs + errs2)[:3]))
    br.close()
print(f'{sum(res)}/{len(res)} passed'); sys.exit(0 if all(res) else 1)
