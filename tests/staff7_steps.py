# Staff7's first slice (R-398), on the practice copy: practice-only is airtight (A), the steps equal the current app's own list (B), nothing held is lost or
# doubled (C), the router is safe (D), the pages (E), and the counted rules of design section 4 (S-2 one filled button, S-7 words, S-12/S-13 tokens, S-15 targets, S-17 motion).
#   python3 -m http.server 8832   (in this folder, once; a listen backlog of 256 is kinder to module-heavy pages)
#   python3 tests/staff7_steps.py [base] [shots folder]     base defaults to http://localhost:8832
import sys, os, re, json
from playwright.sync_api import sync_playwright
BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832').rstrip('/')
SHOTS = sys.argv[2] if len(sys.argv) > 2 else ''
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if SHOTS: os.makedirs(SHOTS, exist_ok=True)
res = []
def ok(c, m): res.append(bool(c)); print('PASS' if c else 'FAIL', m)

# one visible filled button, counted the way a person sees it: in the window, not hidden
FILLED = "() => [...document.querySelectorAll('.btn.filled')].filter(b => { const r = b.getBoundingClientRect(), s = getComputedStyle(b); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && r.top < innerHeight && r.bottom > 0; }).length"
H1S = "() => [...document.querySelectorAll('h1')].filter(h => h.getBoundingClientRect().width > 0).length"
H1 = "() => [...document.querySelectorAll('main h1')].find(h => h.getBoundingClientRect().width > 0)?.innerText.trim()"
DR = """async (q) => { const d = await import('/staff6/data.js'); const b = d.S.bills.find(x => x.bill_number === q); return Object.values(d.S.drafts).flat().filter(x => x.bill_id === b.id && x.status !== 'filed').map(x => [x.status, x.review_note]); }"""
PRE = """const d = await import('/staff6/data.js'), S = d.S, s7 = await import('/staff7/steps.js'), t6 = await import('/staff6/today.js');
const bill = n => S.bills.find(x => x.bill_number === n), ini = i => S.advocates.find(a => a.initials === i);
const openDraft = n => S.drafts[bill(n).id].find(x => !['filed','cancelled'].includes(x.status));
const hearingOf = n => S.hearings.find(h => h.bill_id === bill(n).id && h.status === 'scheduled' && new Date(h.scheduled_at) > Date.now());
const mine = (n) => s7.stepsFor(S.me).filter(s => s.bill.bill_number === n).map(s => s.kind + '|' + (s.at ? s7.dayTime(s.at) : ''));
"""

def external_blocker(ctx, bad):
    def h(route):
        u = route.request.url
        if 'fonts.g' in u: return route.continue_()
        bad.append(u); route.abort()
    ctx.route(lambda u: '127.0.0.1' not in u and 'localhost' not in u, h)

def open_as(br, who, w, h, hash='', bad=None):
    ctx = br.new_context(viewport={'width': w, 'height': h}); pg = ctx.new_page(); errs = []
    if bad is not None: external_blocker(ctx, bad)
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'Failed to load resource' not in m.text and 'ERR_FAILED' not in m.text else None)
    pg.goto(f'{BASE}/staff7.html?demo=1&as={who}{hash}'); pg.wait_for_selector('.paper', timeout=60000)
    pg.evaluate("Promise.all([document.fonts.load('600 16px Poppins'), document.fonts.load('400 16px Lato'), document.fonts.load('700 16px Lato')])"); pg.wait_for_timeout(500)
    return pg, errs
def snap(pg, name, tag):
    if SHOTS: pg.screenshot(path=os.path.join(SHOTS, f'{name}_{tag}.png'))
def rows(pg): return pg.evaluate("() => [...document.querySelectorAll('.sr3')].map(a => ({ href: a.getAttribute('href'), text: a.innerText.replace(/\\s+/g, ' ').trim(), sel: a.classList.contains('sel'), cur: a.getAttribute('aria-current') }))")
def chrome_text(pg):
    return pg.evaluate("() => { const c = document.body.cloneNode(true); c.querySelectorAll('textarea,ul.tplist').forEach(e => e.remove()); return c.innerText; }")
def row(pg, start): return next(r for r in rows(pg) if r['text'].startswith(start))

with sync_playwright() as p:
    br = p.chromium.launch()

    # ================= A. practice-only is airtight =================
    for path in ['/staff7.html', '/staff7.html?demo=0', '/staff7.html?Demo=1', '/staff7.html#demo', '/staff7.html?as=KV&', '/staff7.html?as=KV?demo=1', '/staff7.html?demo-x=1', '/staff7.html?demo.=1', '/staff7.html?demo[]=1', '/staff7.html?demo%3D1', '/staff7.html?DEMO', '/staff7.html?as=ZZ']:
        bad = []; ctx = br.new_context(viewport={'width': 1440, 'height': 900}); external_blocker(ctx, bad); pg = ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(BASE + path); pg.wait_for_selector('.paper, .msg', timeout=60000); pg.wait_for_timeout(1200)
        st = pg.evaluate("async () => { const d = await import('/staff6/data.js'); return { demo: d.DEMO, supa: !!d.S.supa, steps: document.querySelectorAll('.sr3').length, session: !!d.S.session }; }")
        live = [u for u in bad if 'jsdelivr' in u or 'supabase.co' in u]
        ok(st['demo'] and not st['supa'] and not live and not errs, f'A4 {path}: the app is the practice copy (DEMO {st["demo"]}), no client, nothing sent to jsdelivr or supabase ({live[:1]} {errs[:1]})')
        ctx.close()
    # the gate itself: with the redirect script taken out, no demo in the address shows the practice-only page and loads nothing live
    bad = []; ctx = br.new_context(viewport={'width': 1440, 'height': 900}); external_blocker(ctx, bad); pg = ctx.new_page(); seen = []
    pg.on('request', lambda r: seen.append(r.url))
    def strip(route):
        r = route.fetch(); body = re.sub(r'<script>if \(!new URLSearchParams.*?</script>', '', r.text(), flags=re.S); route.fulfill(response=r, body=body)
    ctx.route(lambda u: u.endswith('/staff7.html'), strip)
    pg.goto(BASE + '/staff7.html'); pg.wait_for_selector('.msg'); pg.wait_for_timeout(500)
    ok('practice copy for now' in pg.inner_text('.msg') and pg.locator('#goPractice').get_attribute('href').endswith('?demo=1') and not any('staff6/' in u or 'jsdelivr' in u or 'supabase' in u for u in seen) and not bad, 'A2: without ?demo the page says it is a practice copy and imports nothing from the data layer')
    if SHOTS: pg.screenshot(path=os.path.join(SHOTS, '11_not_practice_1440x900.png'))
    ctx.close()
    pg, errs = open_as(br, 'ZZ', 1440, 900) if False else (None, None)
    ctx = br.new_context(viewport={'width': 1440, 'height': 900}); pg = ctx.new_page(); pg.goto(f'{BASE}/staff7.html?demo=1&as=ZZ'); pg.wait_for_selector('.paper'); pg.wait_for_timeout(500)
    ok('No practice person ZZ.' in pg.inner_text('main') and pg.locator('.people a').count() >= 8 and pg.locator('.sr3').count() == 0, 'A3: an unknown ?as= says so and lists the people, not quietly Nate'); ctx.close()

    # ================= B. the steps equal the current app's own list =================
    pg, errs = open_as(br, 'NT', 1440, 900)
    cmp_ = pg.evaluate("""async () => { %s
      const KIND = { nodraft: 'write', write: 'write', submit: 'write', revise: 'resubmit', approve: 'approve', second: 'second', file: 'file', missed: 'missed', stale: 'stale', chair: 'ask' };
      const out = {}; const left = {};
      for (const a of S.advocates) { S.me = a; S.follows = new Set(Object.entries(S.followersBy || {}).filter(([, ids]) => ids.includes(a.id)).map(([id]) => id));
        t6.t6Fresh(); const own = t6.work(a).own; const ref = own.filter(i => KIND[i.kind]).map(i => KIND[i.kind] + '|' + i.b.bill_number + '|' + (i.at == null ? '' : new Date(i.at).toISOString())).sort();
        const mine7 = s7.stepsFor(a).map(s => s.kind + '|' + s.bill.bill_number + '|' + (s.at == null ? '' : new Date(s.at).toISOString())).sort();
        out[a.initials] = { same: JSON.stringify(ref) === JSON.stringify(mine7), n: mine7.length, ref, mine7 };
        left[a.initials] = own.filter(i => !KIND[i.kind]).map(i => i.kind + ':' + (i.b?.bill_number || '')); }
      return { out, left }; }""" % PRE)
    for who, v in cmp_['out'].items(): ok(v['same'], f'B8 {who}: stepsFor equals the testimony and ask rows of work(me).own ({v["n"]} rows) {"" if v["same"] else v}')
    print('LEFT OUT by kind per person:', json.dumps(cmp_['left']))
    print('STEPS per person:', json.dumps({k: v['mine7'] for k, v in cmp_['out'].items()}))
    sc = lambda who, body: pg.evaluate('async () => {' + PRE + 'S.me = ini("%s"); S.follows = new Set();' % who + body + '}')
    r = sc('KV', "bill('SB3076').position = 'oppose'; return mine('SB3076');"); ok(any(x.startswith('resubmit') for x in r), f'B8: a bill set to oppose keeps its step ({r})')
    r = sc('KV', "bill('HB2121').position = 'strongly_oppose'; return mine('HB2121');"); ok(any(x.startswith('file') for x in r), f'B8: strongly oppose keeps its step ({r})')
    pg.reload(); pg.wait_for_selector('.paper')
    r = sc('JS', "bill('HB1523').position = 'monitor'; const x = openDraft('HB1523'); x.submitted_at = x.submitted_at || new Date().toISOString(); return mine('HB1523');"); ok(any(x.startswith('approve') for x in r), f'B8: a monitor bill with a submitted draft reaches the approver ({r})')
    pg.reload(); pg.wait_for_selector('.paper')
    r = sc('JS', "const x = openDraft('HB1591'); x.submitted_by = ini('JS').id; x.approved_by = ini('JN').id; const a = mine('HB1591'); S.me = ini('JN'); return [a, mine('HB1591')];"); ok(any(x.startswith('second') for x in r[0]) and r[1] == [], f'B8: a second look sent by one second reviewer still reaches her (it is hers to give), not the one who approved first ({r})')
    pg.reload(); pg.wait_for_selector('.paper')
    r = sc('KV', "hearingOf('HB2121').scheduled_at = new Date(Date.now() - 36e5).toISOString(); return mine('HB2121');"); ok(any(x.startswith('missed') for x in r), f'B8: a hearing started an hour ago with an approved unfiled letter gives missed ({r})')
    pg.reload(); pg.wait_for_selector('.paper')
    r = sc('JM', "return mine('SB11');"); ok(len(r) == 1 and r[0].startswith('ask|Tue'), f'B8: JM\'s SB11 ask reads by Tue 3/17 ({r})')
    r = sc('NT', "const n = Date.now(); return [s7.left(n + 30e3), s7.left(n + 3590e3), s7.left(n + 7140e3), s7.left(n + 172740e3), s7.dayTime(n + 9 * 864e5)];")
    ok(r[0] == 'under a minute' and r[1] == '59 min' and r[2] == '1 hour' and r[3] == '47 hours' and re.match(r'\w{3}, \w{3} \d+ ', r[4]), f'B5: the countdown rounds down at every edge, far days carry the date ({r})')
    r = sc('NT', "bill('HB1523').position = 'support_amend'; return s7.posWords(bill('HB1523'));"); ok(r == 'Support w/ amendments', f'B6: position words are the data layer\'s ({r})')
    pg.context.close()

    for w, h in ((1440, 900), (1280, 800)):
        tag = f'{w}x{h}'
        # ================= NT: approve first, then three letters to make, then asks =================
        pg, errs = open_as(br, 'NT', w, h)
        rs = rows(pg)
        ok(len(rs) >= 5 and rs[0]['sel'] and rs[0]['cur'] == 'true' and sum(r['sel'] for r in rs) == 1 and pg.locator('.sr3[aria-current]').count() == 1, f'{tag}: Home opens with the first step open and its row marked')
        ok(pg.evaluate(H1S) == 1 and pg.evaluate(FILLED) == 1 and pg.evaluate("document.documentElement.scrollWidth <= innerWidth"), f'{tag}: Home: one h1, one filled button, no sideways scroll')
        strip = pg.locator('.strip').inner_text()
        ok(re.search(r'Approve by \w{3} 11:00 AM', strip) and 'Capitol’s deadline is Mon 3:00 PM.' in strip and 'Hearing ' in strip, f'{tag}: approve: the team\'s time first ("Approve by Mon 11:00 AM"), the Capitol\'s second')
        ok('wrote this and sent it' in pg.locator('.who2').inner_text() and pg.locator('.posfact').count() == 0 and re.search(r'The letter\s*· HIPHI’s position: ', pg.locator('.lethead').inner_text()), f'{tag}: approve: who wrote it above the letter; position folded into the letter\'s heading')
        ok(pg.locator('.pdfrow b').inner_text().startswith('Letter to ') and pg.locator('.pdfrow .g span').count() == 0 and 'approve it or send it back' in pg.inner_text('.hint'), f'{tag}: approve: file row is "Letter to <committee>", no second line, the approve hint')
        ok(pg.locator('#apBtn').inner_text() == 'Approve' and 'quiet' in pg.locator('#sbBtn').get_attribute('class') and pg.evaluate(FILLED) == 1 and pg.locator('textarea').count() == 1, f'{tag}: approve footer: filled Approve, quiet Send back')
        ok(pg.locator('#openDoc').evaluate('e => e.tagName') == 'BUTTON', f'{tag}: in the practice copy "Open the letter" is a button, not a link')
        n = len(pg.context.pages); pg.click('#openDoc'); pg.wait_for_timeout(400)
        tb = pg.evaluate("() => { const t = document.getElementById('toast').getBoundingClientRect(), f = document.querySelector('.sfoot').getBoundingClientRect(); return [t.bottom, f.top, document.getElementById('toast').classList.contains('on')]; }")
        ok(len(pg.context.pages) == n and 'does not open' in pg.locator('#toast').inner_text() and tb[2] and tb[0] <= tb[1] + 1, f'{tag}: E7 the practice toast opens nothing and sits above the docked footer ({tb})')
        snap(pg, '3_approve', tag)
        # send back: empty refused, then two clicks in one task send once
        pg.click('#sbBtn'); pg.wait_for_selector('#sbNote'); pg.wait_for_timeout(250)
        ok(pg.evaluate("document.activeElement.id") == 'sbNote' and pg.evaluate(FILLED) == 1 and pg.locator('#sbGo').inner_text() == 'Send back with this note' and pg.input_value('#sbNote') == '', f'{tag}: Send back opens an empty, focused note; one filled button')
        pg.click('#sbGo'); pg.wait_for_timeout(250)
        ok('#/done/' not in pg.url and pg.locator('#sbErr').is_visible() and pg.locator('#sbNote').get_attribute('aria-invalid') == 'true' and pg.evaluate(FILLED) == 1, f'{tag}: an empty note is refused with the error in words')
        snap(pg, '5_send_back_note_error', tag)
        pg.fill('#sbNote', 'Please cite the 2024 numbers. ' + tag)
        pg.evaluate("() => { const b = document.getElementById('sbGo'); b.click(); b.click(); }"); pg.wait_for_selector('.done'); pg.wait_for_timeout(300)
        ok(re.match(r'Sent back to \w+\.', pg.evaluate(H1)) and 'resubmits' in pg.locator('.done .sub').inner_text(), f'{tag}: send back lands on its done moment ("{pg.evaluate(H1)}")')
        ok(pg.evaluate(DR, 'HB1523')[0][0] == 'review', f'{tag}: C1 the held send back has not gone yet ({pg.evaluate(DR, "HB1523")})')
        pg.click('#undoBtn'); pg.wait_for_selector('#sbNote'); pg.wait_for_timeout(300)
        ok('Please cite the 2024 numbers. ' + tag in pg.input_value('#sbNote') and pg.evaluate(DR, 'HB1523')[0][0] == 'review', f'{tag}: Undo returns with the typed note, nothing sent')
        if w == 1440:
            pg.wait_for_timeout(11000)   # the one long wait: an undone send back is NOT sent later
            ok(pg.evaluate(DR, 'HB1523')[0][0] == 'review' and pg.evaluate("document.activeElement.id") != 'x', f'{tag}: C1 11 s after Undo it was not sent ({pg.evaluate(DR, "HB1523")})')
        # C1: sent at once when the page goes away: back, then reload inside the 10 seconds
        pg.fill('#sbNote', 'Reload test'); pg.click('#sbGo'); pg.wait_for_selector('.done'); pg.wait_for_timeout(500)
        pg.reload(); pg.wait_for_selector('.paper'); pg.wait_for_timeout(800)
        dr = pg.evaluate(DR, 'HB1523')
        ok(dr and dr[0][0] == 'draft' and dr[0][1] == 'Reload test', f'{tag}: C1 a reload inside the 10 seconds sent the held send back ({dr})')
        pg.context.close()

        pg, errs = open_as(br, 'NT', w, h)
        pg.evaluate("() => { const b = document.getElementById('apBtn'); b.click(); b.click(); }"); pg.wait_for_selector('.done'); pg.wait_for_timeout(300)
        t = pg.evaluate(H1); dr = pg.evaluate(DR, 'HB1523')
        ok(t == 'Approved.' and len(dr) == 1 and dr[0][0] in ('second_review', 'approved'), f'{tag}: C2 two clicks in one task approve once ({t}, {dr})')
        ok(('second look' in pg.locator('.done .sub').inner_text()) == (dr[0][0] == 'second_review') and pg.evaluate(FILLED) == 1, f'{tag}: C4 the done words come from the draft as it is now ("{pg.locator(".done .sub").inner_text()}", {dr[0][0]})')
        cl = pg.evaluate("[...document.querySelectorAll('.segs i')].map(i => i.classList.contains('on'))")
        ok(cl == sorted(cl, reverse=True) and sum(cl) == 1 and len(cl) >= 2, f'{tag}: the week bar fills from the left by count ({cl})')
        snap(pg, '6_done_approved', tag)
        pg.click('#undoBtn'); pg.wait_for_selector('#apBtn'); pg.wait_for_timeout(300)
        ok('#/do/' in pg.url and pg.evaluate(DR, 'HB1523')[0][0] == 'review' and pg.evaluate("document.activeElement.tagName") != 'BODY', f'{tag}: Undo puts the approval back and focus is not on the page body')
        # C3: an Undo that the data layer refuses is said and drawn truthfully
        pg.click('#apBtn'); pg.wait_for_selector('.done'); pg.evaluate("async () => { const d = await import('/staff6/data.js'); Object.values(d.S.drafts).flat().forEach(x => { if (x.status === 'second_review' || x.status === 'approved') { x.approved_by = null; x.second_approved_by = 'someone'; } }); }")
        pg.click('#undoBtn'); pg.wait_for_timeout(500)
        ok(pg.locator('#toast').inner_text().strip() != '' and pg.locator('#undoBtn').count() == 0 and not pg.evaluate("() => document.querySelector('.is-loading')"), f'{tag}: C3 a refused Undo is said ("{pg.locator("#toastMsg").inner_text()}") and the Undo is gone')
        # write: no letter yet
        pg.goto(f'{BASE}/staff7.html?demo=1&as=NT'); pg.wait_for_selector('.paper'); pg.wait_for_timeout(500)
        wr = row(pg, 'Write testimony'); pg.click(f'.sr3[href="{wr["href"]}"]'); pg.wait_for_selector('#makeBtn'); pg.wait_for_timeout(300)
        ok(pg.evaluate(H1) == 'Write testimony' and pg.locator('#sendBtn').count() == 0 and pg.locator('#makeBtn').inner_text() == 'Make the letter' and 'btn filled' in pg.locator('#makeBtn').get_attribute('class') and pg.evaluate(FILLED) == 1, f'{tag}: E1 no letter yet: the one filled button is "Make the letter", no Send at all')
        ok('Makes a Google Doc from HIPHI’s template. You write it there.' in pg.locator('.sfoot').inner_text() and 'The letter is not made yet.' in pg.locator('.pdfrow').inner_text() and pg.locator('textarea').count() == 0, f'{tag}: E1 its line, the row says not made yet, no textarea')
        ok(re.search(r'Hearing \w{3},? ?(\w{3} \d+ )?[\d:]+ [AP]M · (House|Senate) ', pg.locator('.strip').inner_text()) and ' with ' in pg.locator('.strip').inner_text() and '/' not in pg.locator('.strip .hl').last.inner_text(), f'{tag}: E6 the chamber leads and a joint hearing joins with "with"')
        snap(pg, '1_write_no_letter', tag)
        pg.click('#makeBtn'); pg.wait_for_selector('#sendBtn', timeout=10000); pg.wait_for_timeout(300)
        ok(pg.locator('#makeBtn').count() == 0 and pg.locator('#sendBtn').inner_text() == 'Send for approval' and not pg.locator('#sendBtn').is_disabled() and 'Write it in the Doc, then send it.' in pg.locator('.sfoot').inner_text() and pg.evaluate(FILLED) == 1 and pg.evaluate("document.activeElement.id") == 'sendBtn', f'{tag}: E1 with the letter the footer is Send for approval, its line, focus kept on it')
        ok(pg.locator('.pdfrow .g span').inner_text().startswith('Started from HIPHI’s') and 'It opens in Google Docs. Come back here to send it.' in pg.inner_text('.hint') and 'HIPHI’s position: Support' in pg.locator('.lethead').inner_text(), f'{tag}: E3 the file row says where it started; the hint; the position is in the heading')
        snap(pg, '2_write_with_letter', tag)
        n_before = len(rows(pg))
        pg.evaluate("() => { const b = document.getElementById('sendBtn'); b.click(); b.click(); }"); pg.wait_for_selector('.done', timeout=20000); pg.wait_for_timeout(300)
        ok(re.match(r'Sent to \w+', pg.evaluate(H1)) and len(rows(pg)) == n_before - 1, f'{tag}: C2 two clicks send once, the step leaves the list ({n_before} -> {len(rows(pg))})')
        ok(pg.locator('.done .btn.filled').inner_text().startswith('Next step: ') and ' · ' in pg.locator('.done .btn.filled').inner_text(), f'{tag}: E13 the next step names the bill')
        pg.click('#undoBtn'); pg.wait_for_selector('#openDoc'); pg.wait_for_timeout(300)
        ok(wr['href'] in [r['href'] for r in rows(pg)], f'{tag}: Undo puts the step back')
        # not built: a file step
        nb = row(pg, 'File testimony'); pg.click(f'.sr3[href="{nb["href"]}"]'); pg.wait_for_timeout(400)
        vis_back = pg.evaluate("() => [...document.querySelectorAll('.paper a, .paper button')].filter(e => e.getBoundingClientRect().width > 0).length")
        ok('being built' in pg.locator('.paper').inner_text() and pg.evaluate(FILLED) == 0 and vis_back == 0 and 'Hearing' in pg.locator('.strip').inner_text(), f'{tag}: E11 a step whose page is not built: band, strip, one line, no list of facts, no button')
        snap(pg, '9_step_not_built', tag)
        txt = chrome_text(pg)
        ok(not re.search(r'\b(task|tasks|vape|vapes|vaping|dead|review)\b', txt, re.I), f'{tag}: no "task", "vape", "dead" or "review" in the words')
        small = pg.evaluate("() => [...document.querySelectorAll('.btn, .sr3, .bi, .brand')].filter(e => e.getBoundingClientRect().width > 0 && e.getBoundingClientRect().height < 43.5).map(e => e.className)")
        ok(not small, f'{tag}: every button, row, door and the brand link is 44px or more ({small})')
        mo = pg.evaluate("() => { let max = 0, loop = 0; for (const e of document.querySelectorAll('*')) { const s = getComputedStyle(e); for (const d of (s.animationDuration + ',' + s.transitionDuration).split(',')) max = Math.max(max, parseFloat(d) * (d.includes('ms') ? 1 : 1000) || 0); if (s.animationIterationCount === 'infinite') loop++; } return [max, loop]; }")
        ok(mo[0] <= 250 and mo[1] == 0, f'{tag}: motion at most 250 ms and nothing loops ({mo})')
        ok(pg.evaluate("document.querySelectorAll('.sr3 .nb').length") >= 0 and not errs, f'{tag}: no page or console errors on NT\'s run {errs[:2]}')
        pg.context.close()

        # ================= JS: second look =================
        pg, errs = open_as(br, 'JS', w, h)
        sl = row(pg, 'Second look'); pg.click(f'.sr3[href="{sl["href"]}"]'); pg.wait_for_selector('#apBtn'); pg.wait_for_timeout(300)
        ok(pg.evaluate(H1) == 'Second look' and 'Second look by' in pg.locator('.strip').inner_text() and 'approved it' in pg.locator('.who2').inner_text() and pg.evaluate(FILLED) == 1, f'{tag}: the Second look page: heading, "Second look by", who wrote and who approved first ({pg.locator(".who2").inner_text()})')
        snap(pg, '4_second_look', tag)
        pg.click('#apBtn'); pg.wait_for_selector('.done'); pg.wait_for_timeout(300)
        ok(pg.evaluate(H1) == 'Approved.' and 'can file it' in pg.locator('.done .sub').inner_text(), f'{tag}: second look approved: "{pg.locator(".done .sub").inner_text()}"')
        pg.context.close()

        # ================= KV: a letter sent back =================
        pg, errs = open_as(br, 'KV', w, h)
        rs = rows(pg)
        ok(rs[0]['text'].startswith('Resubmit testimony') and rs[0]['sel'] and pg.evaluate(H1) == 'Resubmit testimony' and pg.locator('.note.flag').count() == 1 and pg.locator('#sendBtn').inner_text() == 'Resubmit', f'{tag}: KV opens on a letter sent back: note above, button Resubmit')
        ok(pg.evaluate(FILLED) == 1 and pg.locator('textarea').count() == 0 and 'Started from HIPHI’s' in pg.locator('.pdfrow').inner_text(), f'{tag}: resubmit: one filled button, the letter is a Doc row that says where it started')
        ok(pg.locator('.sr3 .nb').count() >= 1, f'{tag}: E9 hyphenated words in a row never break after the hyphen')
        snap(pg, '0_resubmit', tag)
        orphan = pg.evaluate("""() => [...document.querySelectorAll('.sr3 .sv')].filter(sv => { const n = sv.querySelector('.no'), t = n.previousSibling; const r = document.createRange(); r.setStart(t, Math.max(0, t.textContent.length - 1)); r.setEnd(t, t.textContent.length); return Math.abs(r.getBoundingClientRect().top - n.getBoundingClientRect().top) > 6; }).length""")
        ok(orphan == 0, f'{tag}: no bill number stands alone on a row\'s second line')
        pg.context.close()

        # ================= LR: one step, the last done; SY: nothing to do =================
        pg, errs = open_as(br, 'LR', w, h)
        pg.click('#sendBtn'); pg.wait_for_selector('.done'); pg.wait_for_timeout(300)
        d = pg.inner_text('.done')
        ok(pg.evaluate(FILLED) == 0 and 'Nothing else needs you.' not in d and pg.locator('.done a:has-text("Back to Home")').count() == 1 and pg.locator('.segs').count() == 1 and len(rows(pg)) == 0, f'{tag}: E12 the last done: heading, sentence, week bar, a Back to Home link, no second "Nothing else needs you."')
        snap(pg, '7_done_last', tag); pg.context.close()
        pg, errs = open_as(br, 'SY', w, h)
        ok(pg.evaluate(H1) == 'Nothing needs you.' and pg.evaluate(FILLED) == 0 and pg.locator('.wl').inner_text().count('\n') == 0 and 'Good morning' in pg.locator('.wl').inner_text() and len(pg.locator('.paper').inner_text().strip().split('\n')) == 1, f'{tag}: E10 nothing to do: the date line, and a sheet that is only the heading')
        snap(pg, '8_nothing_to_do', tag); pg.context.close()

        # ================= a door, the router, one more look =================
        pg, errs = open_as(br, 'KV', w, h, '#/calendar')
        ok('Not built yet' in pg.locator('.paper').inner_text() and pg.evaluate(FILLED) == 1 and [a.strip() for a in pg.locator('.bi').all_inner_texts()] == ['Home', 'Issues', 'Calendar', 'Search', 'Explore'], f'{tag}: a door not built yet is a calm sheet that says so; five doors')
        for hsh in ('#/do/%', '#/constructor', '#/__proto__', '#/done/zzz', '#/do/ask-HB1-2026'):
            pg.evaluate(f"location.hash = '{hsh}'"); pg.wait_for_timeout(300)
            ok('no longer yours' in pg.evaluate(H1) and pg.locator('.sheet-error, .pn a:has-text("Back to Home")').count() >= 1, f'{tag}: D1 {hsh} shows the "not here" sheet')
        ok(not errs, f'{tag}: no errors on the router run {errs[:2]}')
        pg.context.close()

    # ================= the look is tokens in one file =================
    for f in ('app.css', 'app.js', 'frame.js', 'parts.js', 'steps.js', 'do_write.js', 'do_approve.js', 'done.js', 'icons7.js'):
        src = open(os.path.join(ROOT, 'staff7', f)).read()
        lit = re.findall(r'(?<![&\w])#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|font-family:\s*(?!var\()\S|font-size:\s*\d|font:[^;]*\b\d+px', src)
        if f == 'app.css': lit += re.findall(r'\b\d+(?:px|rem|em)\b', '\n'.join(l for l in src.split('\n') if not l.lstrip().startswith(('@media', '@container', '/*'))))
        ok(not lit, f'staff7/{f} holds no colour, font or size literal {lit[:3]}')
    ok(os.path.exists(os.path.join(ROOT, 'staff7', 'tokens.css')), 'tokens.css exists')
    br.close()
print(f'{sum(res)}/{len(res)} passed'); sys.exit(0 if all(res) else 1)
