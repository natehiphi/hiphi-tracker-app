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
    ok(r[0] == 'under a minute' and r[1] == '59 min' and r[2] == '1 hour' and r[3] == '47 hours' and re.match(r'\w{3}, \w{3} \d+, ', r[4]), f'B5: the countdown rounds down at every edge, far days carry the date ({r})')
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
        ok(re.search(r'Hearing \w{3},? ?(\w{3} \d+, )?[\d:]+ [AP]M · (House|Senate) ', pg.locator('.strip').inner_text()) and ' with ' in pg.locator('.strip').inner_text() and '/' not in pg.locator('.strip .hl').last.inner_text(), f'{tag}: E6 the chamber leads and a joint hearing joins with "with"')
        snap(pg, '1_write_no_letter', tag)
        pg.click('#makeBtn'); pg.wait_for_selector('#sendBtn', timeout=10000); pg.wait_for_timeout(300)
        ok(pg.locator('#makeBtn').count() == 0 and pg.locator('#sendBtn').inner_text() == 'Send for approval' and not pg.locator('#sendBtn').is_disabled() and 'Write it in the Doc, then send it.' in pg.locator('.sfoot').inner_text() and pg.evaluate(FILLED) == 1 and pg.evaluate("document.activeElement.id") == 'sendBtn', f'{tag}: E1 with the letter the footer is Send for approval, its line, focus kept on it')
        ok(pg.locator('.pdfrow .g span').inner_text().startswith('Started from HIPHI’s') and 'It opens in Google Docs. Come back here to send it.' in pg.inner_text('.hint') and 'HIPHI’s position: Support' in pg.locator('.lethead').inner_text(), f'{tag}: E3 the file row says where it started; the hint; the position is in the heading')
        snap(pg, '2_write_with_letter', tag)
        n_before = len(rows(pg)); n_write = len([r for r in rows(pg) if r['text'].startswith('Write testimony')])
        pg.evaluate("() => { const b = document.getElementById('sendBtn'); b.click(); b.click(); }"); pg.wait_for_selector('.done', timeout=20000); pg.wait_for_timeout(300)
        ok(re.match(r'Sent to \w+', pg.evaluate(H1)) and len([r for r in rows(pg) if r['text'].startswith('Write testimony')]) == n_write - 1, f'{tag}: C2 two clicks send once, the write step leaves the list (an admin\'s own letter then shows as an approve step)')
        ok(pg.locator('.done .btn.filled').inner_text().startswith('Next step: ') and ' · ' not in pg.locator('.done .btn.filled').inner_text() and pg.locator('.done .nxname').count() == 1, f'{tag}: E13 the next step is one line, the bill named under it')
        pg.click('#undoBtn'); pg.wait_for_selector('#openDoc'); pg.wait_for_timeout(300)
        ok(wr['href'] in [r['href'] for r in rows(pg)], f'{tag}: Undo puts the step back')
        # the file step has a page of its own now: never the "being built" sheet
        nb = row(pg, 'File testimony'); pg.click(f'.sr3[href="{nb["href"]}"]'); pg.wait_for_selector('#subBtn'); pg.wait_for_timeout(400)
        ok('being built' not in pg.locator('.paper').inner_text() and pg.evaluate(H1) == 'File testimony' and pg.evaluate(FILLED) == 1, f'{tag}: E11 the file step is a page of its own, not the "being built" sheet')
        snap(pg, '9_file_page', tag)
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
        for hsh in ('#/do/%', '#/constructor', '#/__proto__', '#/done/zzz', '#/do/ask-HB1-2026', '#/done/__proto__', '#/done/constructor', '#/done/toString', '#/do/__proto__', '#/do/toString'):
            pg.evaluate(f"location.hash = '{hsh}'"); pg.wait_for_timeout(300)
            ok('no longer yours' in pg.evaluate(H1) and pg.locator('.sheet-error, .pn a:has-text("Back to Home")').count() >= 1, f'{tag}: D1 {hsh} shows the "not here" sheet')
        ok(not errs, f'{tag}: no errors on the router run {errs[:2]}')
        pg.context.close()


    # ================= F. file, ask and missed: the three step pages =================
    OWN = """async (num) => { const d = await import('/staff6/data.js'), t6 = await import('/staff6/today.js'); t6.t6Fresh(); return t6.work(d.S.me).own.filter(i => i.b?.bill_number === num).map(i => i.kind); }"""
    DRS = """async (num) => { const d = await import('/staff6/data.js'); const b = d.S.bills.find(x => x.bill_number === num); return (d.S.drafts[b.id] || []).map(x => x.status); }"""
    ASKS = """async (num) => { const d = await import('/staff6/data.js'); const b = d.S.bills.find(x => x.bill_number === num); return { notes: (d.S.demoNotes || []).filter(n => n.bill_id === b.id && n.answer === 'asked').length, todos: (d.S.todos[b.id] || []).filter(t => /^Ask /.test(t.title)).map(t => t.done) }; }"""
    SMALL = "() => [...document.querySelectorAll('.btn, .sr3, .field, .letter')].filter(e => e.getBoundingClientRect().width > 0 && e.getBoundingClientRect().height < 43.5).map(e => e.className)"
    INVIEW = "(sel) => { const r = document.querySelector(sel).getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; }"
    NOSIDE = "() => document.documentElement.scrollWidth <= innerWidth && document.querySelector('.paper').scrollWidth <= document.querySelector('.paper').clientWidth"
    def open_step(who, w, h, start, hsh=''):
        bad = []; pg, errs = open_as(br, who, w, h, hsh, bad)
        r = row(pg, start); pg.evaluate(f"location.hash = '{r['href']}'"); pg.wait_for_timeout(500)
        return pg, errs, bad, r['href']
    for w, h in ((1440, 900), (1280, 800)):
        tag = f'{w}x{h}'
        # ---- NT: file ----
        pg, errs, bad, href = open_step('NT', w, h, 'File testimony'); pg.context.grant_permissions(['clipboard-read', 'clipboard-write'])
        pages = len(pg.context.pages)
        st = pg.locator('.strip').inner_text()
        ok(pg.evaluate(H1) == 'File testimony' and 'being built' not in pg.locator('.paper').inner_text() and pg.evaluate(FILLED) == 1 and pg.evaluate(NOSIDE), f'{tag}: F1 file: its own page, one filled button, no sideways scroll')
        ok(re.search(r'File by \w{3} [\d:]+ [AP]M', st) and 'Capitol’s deadline is' in st and 'Hearing ' in st and re.search(r'approved it \w{3} [\d:]+ [AP]M\.', pg.locator('.who2').inner_text()), f'{tag}: F1 file: the team\'s time first, the Capitol\'s second, the hearing, and who approved it and when ({pg.locator(".who2").inner_text()})')
        ok(pg.locator('.pdfrow b').inner_text() == 'The approved letter' and pg.locator('#pdfBtn').inner_text() == 'Download the PDF' and 'quiet' in pg.locator('#pdfBtn').get_attribute('class') and 'Download it from Google Docs' not in pg.inner_text('.paper') and pg.locator('#pdfBtn').evaluate('e => e.tagName') == 'BUTTON' and 'HIPHI’s position' not in pg.locator('.lethead').inner_text() and pg.locator('#openDoc').evaluate('e => e.tagName') == 'BUTTON' and pg.locator('#tpBtn').count() == 0, f'{tag}: F1 file: the letter row, its hint, a button in the practice copy')
        snap(pg, 'F1_file_state1', tag)
        labels = pg.locator('.copyrow .cq > span:first-child').all_inner_texts(); vals = pg.locator('.copyrow .cq b').all_inner_texts()
        ok(labels[:3] == ['Position', 'Organization', 'Signed with'] and labels[-1] == 'How we testify' and pg.locator('.copyrow .btn.text').count() == len(labels) - 2 and vals[0].startswith('Choose: ') and vals[-1].startswith('Choose: ') and 'Log in, press Submit Testimony and pick the' in pg.inner_text('.stmain'), f'{tag}: F1 file: the Capitol form\'s answers, each with a quiet Copy ({labels})')
        pg.click('.copyrow:nth-child(2) .btn.text'); pg.wait_for_timeout(300)
        clip = pg.evaluate('navigator.clipboard.readText()')
        ok(clip == vals[1] and pg.locator('.copyrow:nth-child(2) .btn.text').inner_text() == 'Copied' and not pg.locator('#toast').evaluate('e => e.classList.contains("on")'), f'{tag}: D6 file: Copy puts the answer on the clipboard, the button itself says Copied, no toast ({clip!r})')
        ok(pg.locator('#subBtn').inner_text() == 'Submit on the Capitol site' and 'btn filled' in pg.locator('#subBtn').get_attribute('class') and 'Attach the PDF on the Capitol’s page, then come back here.' in pg.locator('.sfoot').inner_text() and pg.evaluate(INVIEW, '#subBtn'), f'{tag}: F1 file: footer state 1, the one filled button, in view')
        pg.click('#subBtn'); pg.wait_for_timeout(400)
        ok(len(pg.context.pages) == pages and not bad and 'does not open' in pg.locator('#toastMsg').inner_text() and '#/do/' in pg.url, f'{tag}: F2 file: Submit opens no page and no outside request in the practice copy, and says so ({bad[:1]})')
        ok(pg.locator('#fq').inner_text() == 'Did you file it?' and pg.locator('#yesBtn').inner_text() == 'Yes, filed' and 'filled' in pg.locator('#yesBtn').get_attribute('class') and 'quiet' in pg.locator('#notYet').get_attribute('class') and pg.locator('#notYet').inner_text() == 'Not yet' and pg.evaluate(FILLED) == 1 and pg.evaluate("document.activeElement.id") == 'yesBtn', f'{tag}: F2 file: state 2 asks "Did you file it?", one filled Yes, filed, a quiet Not yet, focus on Yes')
        snap(pg, 'F2_file_state2', tag)
        pg.evaluate("location.hash = '#/'"); pg.wait_for_timeout(300); pg.evaluate(f"location.hash = '{href}'"); pg.wait_for_timeout(400)
        ok(pg.locator('#yesBtn').count() == 1 and pg.locator('#subBtn').count() == 0, f'{tag}: F2 file: leaving and coming back keeps state 2')
        pg.click('#notYet'); pg.wait_for_timeout(250)
        ok(pg.locator('#subBtn').count() == 1 and pg.locator('#yesBtn').count() == 0 and pg.evaluate("document.activeElement.id") == 'subBtn', f'{tag}: F2 file: Not yet goes back to state 1')
        pg.click('#subBtn'); pg.wait_for_timeout(250)
        pg.evaluate("() => { const b = document.getElementById('yesBtn'); b.click(); b.click(); }"); pg.wait_for_selector('.done'); pg.wait_for_timeout(300)
        ok(pg.evaluate(H1) == 'Filed.' and re.match(r'Nothing else needs you on .+\.$', pg.locator('.done .sub').inner_text()) and pg.locator('#undoBtn').inner_text() == 'I have not filed it yet' and 'for 10 seconds' not in pg.locator('.done').inner_text() and pg.locator('.segs').count() == 1 and pg.locator('.done .btn.filled').inner_text().startswith('Next step: '), f'{tag}: F3 file: done says Filed., the sentence, the week bar, the reverse link, the next step')
        d = pg.evaluate(DRS, 'HB2300'); own = pg.evaluate(OWN, 'HB2300')
        ok(d == ['filed'] and 'file' not in own and pg.evaluate("[...document.querySelectorAll('.sr3')].every(a => !a.innerText.includes('HB 2300'))"), f'{tag}: F3 file: two clicks filed once; the step left staff6\'s own list and staff7\'s ({d}, {own})')
        snap(pg, 'F3_file_done', tag)
        pg.click('#undoBtn'); pg.wait_for_selector('#subBtn'); pg.wait_for_timeout(300)
        ok(pg.evaluate(DRS, 'HB2300') == ['approved'] and 'file' in pg.evaluate(OWN, 'HB2300') and '#/do/' in pg.url, f'{tag}: F3 file: "I have not filed it yet" puts it back, approved and in the list again')
        # not an amber strip but a calm one at 25 hours; and the words, targets, errors
        ok(not pg.evaluate(SMALL) and not re.search(r'\b(task|tasks|vape|vapes|vaping|dead)\b', chrome_text(pg), re.I), f'{tag}: F9 file: every control 44px or more, none of the banned words')
        ok(not errs and not bad, f'{tag}: file run: no page or console errors, nothing outside {errs[:2]} {bad[:1]}')
        pg.context.close()
        # KV and KR: another file step each (KR's is due in under an hour)
        for who, wk in (('KV', 'HB2121'), ('KR', 'SB3025')):
            pg, errs, bad, href = open_step(who, w, h, 'File testimony')
            ok(pg.evaluate(H1) == 'File testimony' and pg.evaluate(FILLED) == 1 and pg.evaluate(NOSIDE) and pg.evaluate(INVIEW, '#subBtn') and 'Capitol’s deadline is' in pg.locator('.strip').inner_text() + ' Capitol’s deadline is' and not errs, f'{tag}: F1 {who} {wk}: file opens with one filled button in view ({errs[:1]})')
            if who == 'KR': snap(pg, 'F1b_file_late_KR', tag)
            pg.context.close()
        # ---- asks ----
        for who, start, num in (('NT', 'Ask for a hearing', 'HB1732'), ('KV', 'Ask for a hearing', 'SB2175'), ('JM', 'Ask for a hearing', 'SB11'), ('KR', 'Ask for a hearing', 'HB1991')):
            pg, errs, bad, href = open_step(who, w, h, start); pages = len(pg.context.pages)
            st = pg.locator('.strip').inner_text(); handed = who == 'KR'
            ok(pg.evaluate(H1) == 'Ask for a hearing' and pg.evaluate(FILLED) == 1 and pg.evaluate(NOSIDE) and pg.evaluate(INVIEW, '#mailBtn') and 'being built' not in pg.locator('.paper').inner_text(), f'{tag}: B1 {who} {num}: ask opens with one filled button in view')
            ok(re.search(r'Ask by \w{3},? ', st) and re.search(r'It needs a hearing in (House|Senate) .+ by \w{3}, \w{3} \d+, or it stops for the year\.', st), f'{tag}: B1 {who}: the strip says why in words ({st!r})')
            ok(pg.locator('.chair').inner_text().startswith(('The chair: ', 'The chairs: ')) and pg.locator('.chair .person').count() == 0 and pg.locator('h2.sh').inner_text().startswith('Your email to the chair'), f'{tag}: E1 {who}: one plain line for the chair or chairs, no mark')
            ok(('Rick sees it when you have asked.' in pg.locator('.stmain').inner_text()) == handed and 'You are asking for' not in pg.locator('.stmain').inner_text(), f'{tag}: B2 {who}: the handed line shows only for a handed ask')
            to = pg.locator('.mline b').inner_text(); subj = pg.input_value('#subj'); body = pg.input_value('#letter')
            ok('@capitol.hawaii.gov' in to and subj.startswith('Request for a hearing on ') and body.startswith('Aloha ') and 'Mahalo' in body and pg.locator('label[for=letter]').count() == 1 and pg.locator('label[for=subj]').count() == 1, f'{tag}: B3 {who}: To, Subject and the words, built from the data and labelled ({to}, {subj!r})')
            ok(pg.evaluate("() => { const a = getComputedStyle(document.getElementById('subj')), b = getComputedStyle(document.getElementById('letter')); return a.borderColor === b.borderColor && a.backgroundColor === b.backgroundColor && a.borderRadius === b.borderRadius; }"), f'{tag}: E4 {who}: Subject and Message share one field style')
            ok(not re.search(r'Ask partners|public', ' '.join(pg.locator('.paper .btn, .paper a').all_inner_texts()), re.I), f'{tag}: B1 {who}: no "Ask partners and the public" control')
            if who == 'NT':
                snap(pg, 'B1_ask_top', tag)
                pg.evaluate("document.querySelector('.paper').scrollTo(0, 99999)"); pg.wait_for_timeout(300); snap(pg, 'B1b_ask_scrolled', tag)
                pg.evaluate("document.querySelector('.paper').scrollTo(0, 0)")
            if handed: snap(pg, 'B2_ask_handed', tag)
            # typed changes survive leaving and coming back
            pg.fill('#subj', 'My subject ' + tag); pg.fill('#letter', body + '\nA line I added. ' + tag)
            pg.evaluate("location.hash = '#/'"); pg.wait_for_timeout(300); pg.evaluate(f"location.hash = '{href}'"); pg.wait_for_timeout(400)
            ok(pg.input_value('#subj') == 'My subject ' + tag and pg.input_value('#letter').endswith('A line I added. ' + tag), f'{tag}: B4 {who}: the edited email survives leaving and coming back')
            ok(pg.evaluate("() => { const t = document.getElementById('letter'); return t.scrollHeight <= t.clientHeight + 2; }"), f'{tag}: B4 {who}: the message grows with its words (no inner scrollbar)')
            pg.click('#mailBtn'); pg.wait_for_timeout(400)
            ok(len(pg.context.pages) == pages and not bad and 'does not open' in pg.locator('#toastMsg').inner_text() and '#/do/' in pg.url and 'mailto' not in pg.url, f'{tag}: B5 {who}: Open in my mail app opens nothing in the practice copy and says so')
            ok(pg.locator('#fq').inner_text() == 'Did you send it?' and pg.locator('#yesBtn').inner_text() == 'Yes, sent' and pg.locator('#notYet').inner_text() == 'Not yet' and pg.evaluate(FILLED) == 1, f'{tag}: B5 {who}: state 2 asks "Did you send it?"')
            if who == 'NT': snap(pg, 'B3_ask_state2', tag)
            pg.evaluate("location.hash = '#/'"); pg.wait_for_timeout(300); pg.evaluate(f"location.hash = '{href}'"); pg.wait_for_timeout(400)
            ok(pg.locator('#yesBtn').count() == 1 and pg.input_value('#subj') == 'My subject ' + tag, f'{tag}: B5 {who}: state 2 and the edits survive leaving and returning')
            pg.click('#notYet'); pg.wait_for_timeout(250); ok(pg.locator('#mailBtn').count() == 1, f'{tag}: B5 {who}: Not yet goes back')
            pg.click('#mailBtn'); pg.wait_for_timeout(250)
            before = pg.evaluate(ASKS, num); own0 = pg.evaluate(OWN, num)
            pg.evaluate("() => { const b = document.getElementById('yesBtn'); b.click(); b.click(); }"); pg.wait_for_selector('.done'); pg.wait_for_timeout(300)
            after = pg.evaluate(ASKS, num); own1 = pg.evaluate(OWN, num)
            ok(pg.evaluate(H1) == 'Asked.' and re.match(r'Nothing else needs you on .+ until the chairs? answers?\.$', pg.locator('.done .sub').inner_text()) and pg.locator('#undoBtn').inner_text() == 'I have not sent it yet', f'{tag}: B6 {who}: done says Asked. and what is next')
            ok('chair' in own0 and 'chair' not in own1 and after['notes'] > before['notes'] and after['notes'] - before['notes'] <= 2, f'{tag}: B6 {who}: two clicks recorded the ask once per chair; the step left staff6\'s own list ({before} -> {after}, {own0} -> {own1})')
            if handed: ok(before['todos'] == [False] and after['todos'] == [True], f'{tag}: B6 {who}: the to-do that handed the ask is closed ({before} -> {after})')
            if who == 'NT':
                snap(pg, 'B4_ask_done', tag)
                ok(pg.locator('.segs').count() == 0 and 'done this week' not in pg.inner_text('.done'), f'{tag}: E5 a step not due this week shows no week bar')
            pg.click('#undoBtn'); pg.wait_for_selector('#mailBtn'); pg.wait_for_timeout(300)
            back = pg.evaluate(ASKS, num)
            ok(back['notes'] == before['notes'] and back['todos'] == before['todos'] and 'chair' in pg.evaluate(OWN, num) and pg.input_value('#subj') == 'My subject ' + tag, f'{tag}: B6 {who}: "I have not sent it yet" puts it back, edits kept ({back})')
            ok(not pg.evaluate(SMALL) and not errs and not bad, f'{tag}: ask {who}: 44px targets, no page or console errors, nothing outside {errs[:2]} {bad[:1]}')
            pg.context.close()
        # ---- missed, by changing a hearing's time in memory (the practice data has none) ----
        for ans in ('yes', 'no'):
            pg, errs = open_as(br, 'KV', w, h)
            pg.evaluate("async () => {" + PRE + "hearingOf('HB2121').scheduled_at = new Date(Date.now() - 36e5).toISOString(); }")
            pg.evaluate("location.hash = '#/x'"); pg.wait_for_timeout(200); pg.evaluate("location.hash = '#/'"); pg.wait_for_timeout(400)
            r = row(pg, 'Did we file?'); pg.evaluate(f"location.hash = '{r['href']}'"); pg.wait_for_selector('#noBtn'); pg.wait_for_timeout(400)
            ok(pg.evaluate(H1) == 'Did we file?' and 'The hearing started ' in pg.locator('.strip').inner_text() and pg.locator('.strip.calm').count() == 1 and re.search(r'(House|Senate) .+ · Room', pg.locator('.strip').inner_text()) and pg.locator('.pdfrow b').inner_text() == 'The approved letter', f'{tag}: M1 missed: band, a calm strip that says when the hearing started, the committee and room, the letter')
            ok(pg.locator('#yesBtn').inner_text() == 'Yes, filed' and 'filled' in pg.locator('#yesBtn').get_attribute('class') and pg.locator('#noBtn').inner_text() == 'No, it was not filed' and 'quiet' in pg.locator('#noBtn').get_attribute('class') and pg.evaluate(FILLED) == 1 and pg.evaluate(NOSIDE) and pg.evaluate(INVIEW, '#yesBtn'), f'{tag}: M1 missed: one filled Yes, filed and a quiet No, it was not filed, in view')
            if ans == 'yes': snap(pg, 'M1_missed', tag)
            own0 = pg.evaluate(OWN, 'HB2121'); d0 = pg.evaluate(DRS, 'HB2121')
            pg.click('#yesBtn' if ans == 'yes' else '#noBtn'); pg.wait_for_selector('.done'); pg.wait_for_timeout(300)
            own1 = pg.evaluate(OWN, 'HB2121'); dd = pg.evaluate(DRS, 'HB2121')
            ok(pg.evaluate(H1) == 'Recorded.' and 'Noted on ' in pg.locator('.done .sub').inner_text() and 'missed' in own0 and 'missed' not in own1, f'{tag}: M2 missed {ans}: done says Recorded. and the step left staff6\'s own list ({own0} -> {own1})')
            if ans == 'yes':
                ok(dd.count('filed') == d0.count('filed') + 1 and 'was filed' in pg.locator('.done .sub').inner_text() and pg.locator('#undoBtn').inner_text() == 'Change my answer', f'{tag}: M2 missed yes: marked filed as in the file step, with a way to change the answer')
                snap(pg, 'M2_missed_done', tag)
                pg.click('#undoBtn'); pg.wait_for_selector('#yesBtn'); pg.wait_for_timeout(300)
                ok(pg.evaluate(DRS, 'HB2121') == d0 and 'missed' in pg.evaluate(OWN, 'HB2121'), f'{tag}: M2 missed yes: changing the answer restores the question')
            else:
                ok('was not filed' in pg.locator('.done .sub').inner_text() and pg.locator('#undoBtn').count() == 0, f'{tag}: M2 missed no: noted on the bill, and no reverse link (the timeline line cannot be taken off)')
            ok(not errs, f'{tag}: missed {ans}: no page or console errors {errs[:2]}')
            pg.context.close()


    # ================= G. the fix round =================
    src = open(os.path.join(ROOT, 'staff7', 'frame.js')).read()
    ok(re.search(r"async function start\(\) \{\n\s*if \(!DEMO\) throw new Error", src), 'A8: the second lock is the first line of start(), before DB.init()')
    ok('location.href' not in open(os.path.join(ROOT, 'staff7', 'do_ask.js')).read(), 'C3: the mail never replaces the app\'s tab (no location.href in do_ask.js)')
    BODYM = "() => { const s = JSON.parse(sessionStorage.getItem('hiphi7_pages') || '{}'); return Object.keys(s.mail || {}); }"
    for w, h in ((1440, 900), (1280, 800)):
        tag = f'{w}x{h}'
        # A1 + B: the minute redraw runs from an empty hash, and moves and closes nothing
        for hh in ('', '#', '#/'):
            pg, errs = open_as(br, 'NT', w, h, hh)
            pg.evaluate("document.querySelector('.paper').dataset.old = '1'; window.__staff7Tick()"); pg.wait_for_timeout(200)
            ok(pg.evaluate("!document.querySelector('.paper').dataset.old") and not errs, f'{tag}: A1 the minute redraw runs with the hash {hh!r}')
            pg.context.close()
        pg, errs = open_as(br, 'NT', w, 600)
        wr = next(r for r in rows(pg) if r['text'].startswith('Write testimony'))
        pg.evaluate(f"location.hash = '{wr['href']}'"); pg.wait_for_selector('#makeBtn, #sendBtn'); pg.wait_for_timeout(300)
        if pg.locator('#makeBtn').count(): pg.click('#makeBtn'); pg.wait_for_selector('#sendBtn', timeout=10000); pg.wait_for_timeout(300)
        had_tp = pg.locator('#tpBtn').count() == 1
        if had_tp: pg.click('#tpBtn')
        pg.evaluate("() => { document.activeElement.blur(); const p = document.querySelector('.paper'); p.scrollTop = 40; document.querySelector('.wl').scrollTop = 10; }")
        before = pg.evaluate("() => [document.querySelector('.paper').scrollTop, document.querySelector('.wl').scrollTop]")
        pg.evaluate("window.__staff7Tick()"); pg.wait_for_timeout(300)
        after = pg.evaluate("() => [document.querySelector('.paper').scrollTop, document.querySelector('.wl').scrollTop, document.querySelectorAll('#app .enter').length, !!document.getElementById('tpList') && !document.getElementById('tpList').hidden]")
        ok(after[0] == before[0] and after[1] == before[1] and after[2] == 0 and (after[3] or not had_tp), f'{tag}: B the minute redraw keeps both scroll positions, plays no entry animation and keeps the talking points open ({before} -> {after}, talking points {had_tp})')
        pg.evaluate("async () => { const m = await import('/staff7/parts.js'); m.toast('x', { undo: () => {} }); document.querySelector('.paper').dataset.old = '1'; }"); pg.evaluate("window.__staff7Tick()"); pg.wait_for_timeout(200)
        ok(pg.evaluate("!!document.querySelector('.paper').dataset.old"), f'{tag}: B no redraw while a toast with Undo is up')
        pg.context.close()

        # A2 + A6: an admin sends his own letter; his approve step is in the list, matches the current app's own list, and works; the done words name "you or Kris"
        pg, errs = open_as(br, 'NT', w, h)
        wr = next(r for r in rows(pg) if r['text'].startswith('Write testimony')); num = re.search(r'(HB|SB) (\d+)', wr['text']); num = num.group(1) + num.group(2)
        pg.evaluate(f"location.hash = '{wr['href']}'"); pg.wait_for_selector('#makeBtn, #sendBtn'); pg.wait_for_timeout(300)
        if pg.locator('#makeBtn').count(): pg.click('#makeBtn'); pg.wait_for_selector('#sendBtn', timeout=10000); pg.wait_for_timeout(300)
        pg.click('#sendBtn'); pg.wait_for_selector('.done'); pg.wait_for_timeout(300)
        ok(re.match(r'Sent to you or \w+\.$', pg.evaluate(H1)) and 'you approve' in pg.locator('.done .sub').inner_text() or ' or ' in pg.evaluate(H1), f'{tag}: A6 an admin\'s own letter: the done words say "{pg.evaluate(H1)}"')
        rs = [r['text'] for r in rows(pg)]
        ok(any(x.startswith('Approve testimony') and num[:2] + ' ' + num[2:] in x for x in rs) and 'approve' in pg.evaluate(OWN, num), f'{tag}: A2 the approve step for the letter he just sent is in the list, as in work(me).own ({pg.evaluate(OWN, num)})')
        ar = next(r for r in rows(pg) if r['text'].startswith('Approve testimony') and num[:2] + ' ' + num[2:] in r['text'])
        pg.evaluate(f"location.hash = '{ar['href']}'"); pg.wait_for_selector('#apBtn'); pg.click('#apBtn'); pg.wait_for_selector('.done'); pg.wait_for_timeout(300)
        ok(pg.evaluate(H1) == 'Approved.' and not errs, f'{tag}: A2 that step can be approved (a stale mark does not stick it on "Approving") {errs[:1]}')
        pg.context.close()

        # A3: Undo during a slow held send back says it was sent
        pg, errs = open_as(br, 'NT', w, h)
        pg.click('#sbBtn'); pg.fill('#sbNote', 'Slow one'); pg.click('#sbGo'); pg.wait_for_selector('.done'); pg.wait_for_timeout(300)
        pg.evaluate("""async () => { const d = await import('/staff6/data.js'), o = d.DB.transition.bind(d.DB); d.DB.transition = async (...a) => { await new Promise(r => setTimeout(r, 3000)); return o(...a); };
          Object.defineProperty(document, 'visibilityState', { get: () => 'hidden', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); Object.defineProperty(document, 'visibilityState', { get: () => 'visible', configurable: true }); }""")
        pg.wait_for_timeout(300); pg.click('#undoBtn'); pg.wait_for_timeout(400)
        ok('already sent' in pg.locator('#toastMsg').inner_text() and '#/done/' in pg.url and pg.locator('#sbNote').count() == 0, f'{tag}: A3 Undo while the send back is going says it was sent ({pg.locator("#toastMsg").inner_text()!r})')
        pg.context.close()

        # A4 cancelled hearing; A5 two drafts on one hearing; A7 a missing Doc link
        pg, errs = open_as(br, 'KV', w, h)
        r = pg.evaluate("async () => { const s7 = await import('/staff7/steps.js'); return s7.hearingLine({ status: 'cancelled', scheduled_at: new Date(Date.now() + 864e5).toISOString(), committee: 'HLT' }); }")
        ok(r == 'Hearing cancelled, no new date yet.', f'{tag}: A4 a cancelled hearing says so, never a day and time ({r!r})')
        r = pg.evaluate("async () => {" + PRE + "const x = openDraft('SB3076'); x.doc_url = ''; return 1; }")
        pg.evaluate("location.hash = '#/x'"); pg.wait_for_timeout(200); pg.evaluate("location.hash = '#/'"); pg.wait_for_timeout(400)
        ok(pg.locator('#sendBtn').is_disabled() and 'link is missing' in pg.locator('.sfoot').inner_text() and pg.evaluate(FILLED) == 1, f'{tag}: A7 a letter with no Doc link cannot be sent, and says why')
        pg.context.close()
        pg, errs = open_as(br, 'NT', w, h)
        pg.evaluate("async () => {" + PRE + "for (const n of ['HB1523', 'HB1839']) { S.hearings.filter(y => y.bill_id === bill(n).id).forEach(x => { x.status = 'cancelled'; }); } }")
        pg.evaluate("location.hash = '#/x'"); pg.wait_for_timeout(200); pg.evaluate("location.hash = '#/'"); pg.wait_for_timeout(400)
        for nm, pre in (('W1_approve_cancelled', 'Approve testimony'), ('W2_write_cancelled', 'Write testimony')):
            rr = [x for x in rows(pg) if x['text'].startswith(pre) and re.search(r'HB (1523|1839)', x['text'])]   # in this data a cancelled hearing takes the step off the list; if a step stays, its strip must say so
            if rr:
                pg.evaluate(f"location.hash = '{rr[0]['href']}'"); pg.wait_for_timeout(500); snap(pg, nm, tag)
                st = pg.locator('.strip').inner_text()
                ok('cancelled' in st.lower() and not re.search(r'Hearing \w{3},? ', st), f'{tag}: A4 {pre} with a cancelled hearing: the strip says so ({st!r})')
        pg.context.close()
        pg, errs = open_as(br, 'NT', w, h)
        r = pg.evaluate("async () => {" + PRE + """const b = bill('HB2300'), x = S.drafts[b.id].find(d => d.status === 'approved'); S.drafts[b.id].push({ ...x, id: 'dup-' + x.id }); S.me = ini('NT'); t6.t6Fresh();
          const own = t6.work(S.me).own.filter(i => i.b?.bill_number === 'HB2300' && i.kind === 'file').length, mine7 = s7.stepsFor(S.me).filter(s => s.bill.bill_number === 'HB2300' && s.kind === 'file'), ids = new Set(mine7.map(s => s.id)).size; return [own, mine7.length, ids]; }""")
        ok(r[1] == r[0] and r[2] == r[1], f'{tag}: A5 the list equals work(me).own when two drafts share a hearing, every id distinct ({r})')
        pg.context.close()

        # C1, C2, C4: state 2 and the edited email survive a reload; "I already ..." goes to state 2; an unedited email is not kept
        pg, errs, bad, href = open_step('NT', w, h, 'File testimony')
        pg.click('#already'); pg.wait_for_timeout(300)
        ok(pg.locator('#yesBtn').count() == 1 and pg.evaluate(FILLED) == 1, f'{tag}: C2 "I already filed it" goes to state 2')
        pg.reload(); pg.wait_for_selector('.paper'); pg.wait_for_timeout(600)
        ok(pg.locator('#yesBtn').count() == 1, f'{tag}: C1 a reload in state 2 stays in state 2')
        pg.context.close()
        pg, errs, bad, href = open_step('KR', w, h, 'Ask for a hearing')
        ok(pg.evaluate(BODYM) == [], f'{tag}: C4 an unedited email is not kept (it is written fresh each time)')
        pg.fill('#subj', 'Kept ' + tag); pg.click('#mailBtn'); pg.wait_for_timeout(300)
        ok(len(pg.evaluate(BODYM)) == 1, f'{tag}: C1 the edited email is kept')
        pg.reload(); pg.wait_for_selector('.paper'); pg.wait_for_timeout(600)
        ok(pg.locator('#yesBtn').count() == 1 and pg.input_value('#subj') == 'Kept ' + tag, f'{tag}: C1 after a reload: still "Did you send it?", the subject as edited')
        pg.click('#notYet')
        ok(pg.locator('#already').count() == 1, f'{tag}: C2 "I already sent it" is in the footer of state 1')
        r = pg.evaluate("async () => { const m = await import('/staff7/do_ask.js'); const a = m.linkOf({ to: 'a@x.gov,b@y.gov' }, { subject: 's p', body: 'x'.repeat(2000) }); return [a.startsWith('mailto:a%40x.gov,b%40y.gov?subject=s%20p'), a.length > m.TOO_LONG]; }")
        ok(r == [True, True], f'{tag}: C3 each recipient is encoded, and a link over 1,800 characters is told apart ({r})')
        pg.context.close()
        pg, errs, bad, href = open_step('NT', w, h, 'Ask for a hearing')
        pg.click('#mailBtn'); pg.click('#yesBtn'); pg.wait_for_selector('.done'); pg.wait_for_timeout(300)
        ok(pg.evaluate("document.activeElement.tagName") != 'BODY', f'{tag}: C5 focus is not on the page body on the done page')
        pg.wait_for_timeout(1200)
        pg.context.close()

        # F2: a letter never approved offers "It went in anyway"
        pg, errs = open_as(br, 'KV', w, h)
        pg.evaluate("async () => {" + PRE + "hearingOf('HB2121').scheduled_at = new Date(Date.now() - 36e5).toISOString(); const x = S.drafts[bill('HB2121').id].find(d => d.status === 'approved'); x.status = 'review'; }")
        pg.evaluate("location.hash = '#/x'"); pg.wait_for_timeout(200); pg.evaluate("location.hash = '#/'"); pg.wait_for_timeout(400)
        r = row(pg, 'Did we file?'); pg.evaluate(f"location.hash = '{r['href']}'"); pg.wait_for_selector('#noBtn'); pg.wait_for_timeout(300)
        n = len(pg.context.pages)
        ok(pg.locator('#yesBtn').count() == 0 and pg.locator('#anyway').inner_text() == 'It went in anyway' and 'No cannot be changed afterwards' in pg.locator('.sfoot').inner_text() and pg.evaluate(FILLED) == 1, f'{tag}: F2 never approved: "It went in anyway" as the quiet choice, no Yes, filed')
        snap(pg, 'M3_missed_never_approved', tag)
        pg.click('#anyway'); pg.wait_for_timeout(300)
        ok(len(pg.context.pages) == n and 'does not open' in pg.locator('#toastMsg').inner_text(), f'{tag}: F2 in the practice copy it opens nothing and says so')
        pg.context.close()

        # G1: a toast sits above the footer, from its measured height, also when the footer wraps
        pg, errs, bad, href = open_step('NT', w, h, 'File testimony')
        pg.click('#pdfBtn'); pg.wait_for_timeout(300)
        g = pg.evaluate("() => { const t = document.getElementById('toast').getBoundingClientRect(), f = document.querySelector('.sfoot').getBoundingClientRect(); return [t.bottom, f.top, f.height, document.getElementById('toast').classList.contains('on')]; }")
        ok(g[3] and g[0] <= g[1] + 1 and 'does not download' in pg.locator('#toastMsg').inner_text(), f'{tag}: G1 the toast sits above the footer and does not cover its buttons ({g})')
        snap(pg, 'G1_toast_file_state1', tag)
        pg.evaluate("location.hash = '#/'"); pg.wait_for_timeout(400)
        ok(not pg.evaluate("document.getElementById('toast').classList.contains('on')"), f'{tag}: G1 the toast is cleared when the page changes')
        pg.context.close()

    # ================= the look is tokens in one file =================
    for f in ('app.css', 'app.js', 'frame.js', 'parts.js', 'steps.js', 'do_write.js', 'do_approve.js', 'do_file.js', 'do_ask.js', 'do_missed.js', 'done.js', 'icons7.js'):
        src = open(os.path.join(ROOT, 'staff7', f)).read()
        lit = re.findall(r'(?<![&\w])#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|font-family:\s*(?!var\()\S|font-size:\s*\d|font:[^;]*\b\d+px', src)
        if f == 'app.css': lit += re.findall(r'\b\d+(?:px|rem|em)\b', '\n'.join(l for l in src.split('\n') if not l.lstrip().startswith(('@media', '@container', '/*'))))
        ok(not lit, f'staff7/{f} holds no colour, font or size literal {lit[:3]}')
    ok(os.path.exists(os.path.join(ROOT, 'staff7', 'tokens.css')), 'tokens.css exists')
    br.close()
print(f'{sum(res)}/{len(res)} passed'); sys.exit(0 if all(res) else 1)
