# Shared links open the ask they name (R-169, Nate 10/5: "The link needs to link them to taking action, not just the bill
# page."), in the sandbox served locally, as a newcomer on a phone. Checks: a testimony link opens the testimony
# walkthrough; a hearing-ask link opens the email walkthrough to the chairs, with the session's year in the address too;
# on a year-form bill page the "Ask the chairs" button opens the walkthrough, not a bare email (speakup.js read no year);
# a closed ask says so and shows the bill; the final version's link puts its main button in front; every share carries
# the ask's page or address and words; a shared link never reopens a walkthrough left open in the tab (R-113), while a
# reload still does; staff's links name the testimony page; every built share page leads with its ask, with no instant
# redirect and no og:url.
#   python3 tests/share_asks.py [base]     base defaults to http://localhost:8832/
import sys, re, os, json, glob
from playwright.sync_api import sync_playwright
BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832/').rstrip('/') + '/'
PUB = BASE + 'track.html?demo=1'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
res = []
def ok(c, m): res.append(bool(c)); print('PASS' if c else 'FAIL', m)
def ready(pg):
    pg.wait_for_function("() => !!document.querySelector('main') && !document.querySelector('.skelpage') && !document.querySelector('.bl-skel') && (document.querySelector('main').innerText || '').length > 80", timeout=60000); pg.wait_for_timeout(600)
snap = json.load(open(os.path.join(ROOT, 'demo', 'snapshot.json')))
YEAR = snap.get('session_year') or 2026
heard = {h['bill_id'] for h in snap['hearings'] if h['scheduled_at'] > '2026-03-10'}
open_h = {h['bill_id'] for h in snap['hearings'] if h.get('status') == 'scheduled' and h.get('testimony_deadline', '') > '2026-03-16T19:00:00' and h['scheduled_at'] < '2026-03-28'}
pos = lambda b: b.get('position') not in (None, 'monitor') and b.get('nickname')
T = next(b for b in snap['bills'] if pos(b) and b['id'] in open_h)['bill_number']
A = next(b for b in snap['bills'] if pos(b) and b.get('position') in ('support', 'strongly_support') and b['id'] not in heard and b.get('stage') in ('second_lateral', 'second_triple'))['bill_number']
C = next((b['bill_number'] for b in snap['bills'] if pos(b) and b.get('stage') == 'conference' and 'support' in b.get('position', '') and b['id'] not in heard), None)
DEAD = next(b for b in snap['bills'] if pos(b) and b.get('stage') == 'dead' and any(r['bill_id'] == b['id'] for r in snap.get('billIssues', [])))['bill_number']
print(f'testimony {T}, waiting {A}, final version {C}, stopped {DEAD}')
DLG = "() => { const d = document.querySelector('#hp-dlg'); return d && d.open ? d.innerText.slice(0, 300) : ''; }"
TOAST = "() => (document.querySelector('#toast') || {}).innerText || ''"
with sync_playwright() as p:
    br = p.chromium.launch(); errs = []
    def phone():
        ctx = br.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True, device_scale_factor=2)
        ctx.grant_permissions(['clipboard-read', 'clipboard-write']); pg = ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e))); return ctx, pg
    # ---- 1. testimony: the walkthrough opens ----
    ctx, pg = phone(); pg.goto(PUB + f'&via=share#/bill/{T}/testify'); ready(pg); pg.wait_for_timeout(1500)
    d = pg.evaluate(DLG); ok(d.startswith('Testimony on'), f'a testimony link opens the testimony walkthrough: {d[:60]!r}')
    ctx.close()
    # ---- 2. asking for a hearing: the email walkthrough to the chairs, the year in the address ----
    ctx, pg = phone(); pg.goto(PUB + f'&via=share#/bill/{YEAR}/{A}/ask'); ready(pg); pg.wait_for_timeout(2500)
    d = pg.evaluate(DLG); ok(d.startswith('Email about') and 'Where do you stand' in d, f'a hearing-ask link opens the email walkthrough: {d[:80]!r}')
    pg.locator('#hp-dlg [data-hp-close], #hp-dlg button:has-text("Close")').first.click(); pg.wait_for_timeout(800)
    # ---- 3. the year-form bill page's own button opens the walkthrough, not a bare email ----
    pg.goto(PUB + f'&via=share#/bill/{YEAR}/{A}'); ready(pg); pg.wait_for_timeout(1500)
    pg.evaluate("() => { try { sessionStorage.clear(); } catch {} }")
    btn = pg.locator('[data-bl-main="ask"]').first
    ok(btn.count() == 1, 'the bill waiting for a hearing leads with the ask')
    if btn.count():
        btn.click(); pg.wait_for_timeout(1200); d = pg.evaluate(DLG)
        ok(d.startswith('Email about'), f'on #/bill/{YEAR}/{A} the main button opens the walkthrough: {d[:60]!r}')
    # ---- 4. the share from this page carries the ask ----
    t = pg.evaluate("async n => { const c = await import('./pub/core.js'), bl = await import('./pub/bill.js'), a = await import('./pub/actions.js'); const b = Object.values(c.S.extra).concat(c.S.bills).find(x => x.bill_number === n); const k = bl.shareAsk(b); const s = a.shareFor(b, null, { ask: k }); return { k, url: s.url, text: s.text }; }", A)
    ok(t['k'] == 'ask' and t['url'].endswith(f'b/demo/{A}-ask') and 'needs a hearing' in t['text'], f"a waiting bill's share: {t['k']} {t['url'][-30:]} {t['text'][:110]}")
    ctx.close()
    ctx, pg = phone(); pg.goto(PUB + f'#/bill/{T}'); ready(pg)
    t = pg.evaluate("async n => { const c = await import('./pub/core.js'), bl = await import('./pub/bill.js'), a = await import('./pub/actions.js'); const b = Object.values(c.S.extra).concat(c.S.bills).find(x => x.bill_number === n); const x = bl.situation(b); return { k: bl.shareAsk(b, x), url: a.shareFor(b, x.act?.h, { ask: bl.shareAsk(b, x) }).url }; }", T)
    ok(t['k'] == 'testify' and t['url'].endswith(f'b/demo/{T}-testify'), f"a bill with a hearing shares its testimony page: {t}")
    t = pg.evaluate("async n => { const c = await import('./pub/core.js'), bl = await import('./pub/bill.js'), a = await import('./pub/actions.js'); const b = await c.ensureBill(n); return { k: bl.shareAsk(b), url: a.shareFor(b, null, { ask: bl.shareAsk(b) }).url, text: a.shareFor(b, null, { ask: bl.shareAsk(b) }).text }; }", DEAD)
    ok(t['k'] == 'follow' and t['url'].endswith(f'b/demo/{DEAD}-follow') and 'speak up' not in t['text'].lower() and 'come back' in t['text'], f"a stopped bill shares its follow page: {t['url'][-40:]} {t['text'][-90:]}")
    ctx.close()
    # ---- 5. a closed ask says so and shows the bill ----
    ctx, pg = phone(); pg.goto(PUB + f'&via=share#/bill/{DEAD}/testify'); ready(pg); pg.wait_for_timeout(2500)
    ok('Testimony on this bill has closed' in pg.evaluate(TOAST) and not pg.evaluate(DLG), f'a closed testimony link says so: {pg.evaluate(TOAST)!r}')
    ctx.close()
    # ---- 6. the final version: its main button in front, no "closed" line ----
    if C:
        ctx, pg = phone(); pg.goto(PUB + f'&via=share#/bill/{C}/conference'); ready(pg); pg.wait_for_timeout(2500)
        act = pg.evaluate("() => { const e = document.activeElement; return e ? (e.getAttribute('data-bl-main') || e.getAttribute('href') || e.tagName) : ''; }")
        ok('passed' not in pg.evaluate(TOAST) and (act == 'conference' or str(act).startswith('#/legislators')), f'a final-version link puts its ask in front: {act!r} {pg.evaluate(TOAST)!r}')
        ctx.close()
    # ---- 7. R-113: a shared link never reopens a walkthrough left open in the tab; a reload still does ----
    ctx, pg = phone(); pg.goto(PUB + f'#/bill/{T}'); ready(pg)
    pg.locator('[data-bl-go="testify"]').first.click(); pg.wait_for_timeout(1200)
    ok(pg.evaluate(DLG).startswith('Testimony on'), 'the walkthrough is open in this tab')
    pg.reload(); ready(pg); pg.wait_for_timeout(2500)
    ok(pg.evaluate(DLG).startswith('Testimony on'), 'a reload brings it back (phones that reload a tab in the background)')
    pg.goto(PUB + f'&via=share#/bill/{A}'); ready(pg); pg.wait_for_timeout(2500)
    ok(not pg.evaluate(DLG), 'a shared link opened in that tab shows its own bill, not the old walkthrough')
    ctx.close()
    # ---- 7b. the practice copy's share page itself: its card leads with the ask and its link opens it there ----
    ctx, pg = phone(); pg.goto(BASE + f'b/demo/{T}-testify.html'); pg.wait_for_url(re.compile(r'track\.html'), timeout=20000); ready(pg); pg.wait_for_timeout(2000)
    ok('demo=1' in pg.url and pg.url.endswith(f'#/bill/{YEAR}/{T}/testify') and pg.evaluate(DLG).startswith('Testimony on'), f"the practice copy's testimony page opens its walkthrough: {pg.url[-50:]}")
    ctx.close()
    # ---- 8. staff: the share kit and this week's asks link the testimony page ----
    ctx, pg = phone(); pg.goto(BASE + 'staff.html?demo=1#/'); pg.wait_for_timeout(3500)
    t = pg.evaluate("async () => { const m = await import('./staff/model.js'); const b = { bill_number: 'HB 1573', session_year: " + str(YEAR) + ", nickname: 'X', public_action: 'Please support it.' }; const h = { committee: 'HLT', scheduled_at: new Date(Date.now() + 3 * 864e5).toISOString(), testimony_deadline: new Date(Date.now() + 864e5).toISOString() }; return { kit: m.shareKit(b, h).link, plain: m.shareKit(b, null).link }; }")
    ok(t['kit'].endswith('b/demo/HB1573-testify') and t['plain'].endswith('b/demo/HB1573'), f"staff's share kit: a hearing ahead links the testimony page (the practice copy's own): {t}")
    ctx.close()
    # ---- 8b. how long a letter took (R-169, backend 143): the call carries the kind, seconds, first time, device and
    # version, nothing else; intercepted here, so nothing reaches the database ----
    ctx = br.new_context(viewport={'width': 390, 'height': 844}); pg = ctx.new_page(); sent = []
    pg.add_init_script('window.__hiphiCountTests = true')
    pg.route('**/rest/v1/rpc/log_act_time', lambda r: (sent.append(r.request.post_data_json), r.fulfill(status=204, body='')))
    pg.goto(BASE + 'track.html#/'); pg.wait_for_timeout(2500)
    pg.evaluate("async () => { const v = await import('./pub/visitlog.js'); await v.logTime('testimony', 200.4, true); await v.logTime('email', 75, true); await v.logTime('share', 5); }")
    pg.wait_for_timeout(800)
    ok(len(sent) == 2 and sent[0]['p']['act'] == 'testimony' and sent[0]['p']['seconds'] == 200 and sent[0]['p']['first_time'] is True
       and {'act', 'device', 'first_time', 'seconds'} <= set(sent[0]['p']) <= {'act', 'device', 'first_time', 'seconds', 'variant'} and 'first_time' not in sent[1]['p'],
       f'the time a letter took is sent with nothing else, and only for testimony and email: {sent}')
    ctx.close()
    ok(not errs, 'no page errors: ' + '; '.join(errs[:3]))
    br.close()
# ---- 9. the built pages: each leads with its ask; no instant redirect, no og:url ----
pages = glob.glob(os.path.join(ROOT, 'b', '*.html')) + glob.glob(os.path.join(ROOT, 'b', '*', '*.html')) + glob.glob(os.path.join(ROOT, 'i', '*.html'))
bad_meta, bad_title, bad_pic, per_issue = [], [], [], 0
PIC = {'Speak up': ('testify',), 'Ask for a hearing': ('ask',), 'Ask the chair to hold': ('hold',), 'Ask your': ('floor-yes', 'floor-no'),
       'Ask lawmakers': ('conference-yes', 'conference-no'), 'Ask the Governor': ('governor-sign', 'governor-veto'), 'Follow ': ('follow', 'law')}
for f in pages:
    h = open(f, encoding='utf-8').read(); t = re.search(r'og:title" content="([^"]*)"', h).group(1)
    if 'http-equiv' in h or 'og:url' in h or ('/demo/' in f and 'noindex' not in h): bad_meta.append(f)
    m = re.search(r'pub/(og/([a-z-]+)(?:/([a-z0-9-]+))?\.jpg)', h); path, pic, iss = (m.group(1), m.group(2), m.group(3)) if m else ('', '', None)
    per_issue += 1 if iss else 0
    if not any(t.startswith(k) and pic in v for k, v in PIC.items()) or not os.path.exists(os.path.join(ROOT, 'pub', path)): bad_pic.append(f'{os.path.basename(f)}: {t[:40]} / {path}')
    name = os.path.basename(f)
    want = r'^Speak up' if '-testify' in name else r'^Ask ' if re.search(r'-(ask|floor|conference|governor)\.html$', name) else r'^Follow ' if '-follow' in name or '/i/' in f else r'^(Speak up|Ask |Follow )'
    if not re.search(want, t): bad_title.append(f'{name}: {t}')
ok(len(pages) > 1000 and not bad_meta, f'{len(pages)} share pages, none with an instant redirect or og:url ({len(bad_meta)} do)')
ok(not bad_title, f'every share page title leads with its ask ({len(bad_title)} do not: {bad_title[:3]})')
ok(not bad_pic, f"every share page's picture says its ask, and the picture exists ({len(bad_pic)} do not: {bad_pic[:3]})")
ok(per_issue > len(pages) // 3, f"pages for bills with an issue carry that issue's own picture ({per_issue} of {len(pages)})")
wanted = json.load(open(os.path.join(ROOT, 'tools', 'og_wanted.json')))
ok(wanted and all(w['have'] and os.path.exists(os.path.join(ROOT, 'pub', 'og', w['img'], w['slug'] + '.jpg')) for w in wanted), f"every issue picture in use is drawn ({len(wanted)})")
ok(len(glob.glob(os.path.join(ROOT, 'b', 'demo', '*.html'))) > 500 and len(glob.glob(os.path.join(ROOT, 'i', 'demo', '*.html'))) > 50, 'the practice copy has its own share pages (b/demo/, i/demo/)')
print(f'{sum(res)}/{len(res)} passed'); sys.exit(0 if all(res) else 1)
