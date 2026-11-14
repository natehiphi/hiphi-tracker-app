# Staff7's first slice (R-398): Home with the first step open, the write/resubmit step page, the done moment with its Undo, the doors
# not built yet, and the rules of design section 4 that can be counted (S-2 one filled button, S-7 words, S-12/S-13 tokens only,
# S-15 targets, S-17 motion), on the practice copy, at 1440x900 and 1280x800.
#   python3 -m http.server 8832   (in this folder, once; a listen backlog of 256 is kinder to module-heavy pages)
#   python3 tests/staff7_steps.py [base] [shots folder]     base defaults to http://localhost:8832
import sys, os, re
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

def open_as(br, who, w, h, hash=''):
    ctx = br.new_context(viewport={'width': w, 'height': h}); pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    pg.goto(f'{BASE}/staff7.html?demo=1&as={who}{hash}'); pg.wait_for_selector('.paper', timeout=60000)
    pg.evaluate("Promise.all([document.fonts.load('600 16px Poppins'), document.fonts.load('400 16px Lato'), document.fonts.load('700 16px Lato')])"); pg.wait_for_timeout(500)
    return pg, errs
def snap(pg, name, tag):
    if SHOTS: pg.screenshot(path=os.path.join(SHOTS, f'{name}_{tag}.png'))
def rows(pg): return pg.evaluate("() => [...document.querySelectorAll('.sr3')].map(a => ({ href: a.getAttribute('href'), text: a.innerText.replace(/\\s+/g, ' ').trim(), sel: a.classList.contains('sel'), cur: a.getAttribute('aria-current') }))")
def chrome_text(pg):   # what the app says, without a bill's own words in the letter and the talking points
    return pg.evaluate("() => { const c = document.body.cloneNode(true); c.querySelectorAll('textarea,.pop').forEach(e => e.remove()); return c.innerText; }")

with sync_playwright() as p:
    br = p.chromium.launch()
    for w, h in ((1440, 900), (1280, 800)):
        tag = f'{w}x{h}'
        # ---------- NT: three write steps, an approve, a file ----------
        pg, errs = open_as(br, 'NT', w, h)
        rs = rows(pg)
        ok(len(rs) >= 4 and any(r['text'].startswith('Write testimony') for r in rs), f'{tag}: NT has write steps among {len(rs)} rows')
        ok(sum(r['sel'] for r in rs) == 1 and rs[0]['sel'] and rs[0]['cur'] == 'true' and pg.locator('.sr3[aria-current]').count() == 1, f'{tag}: Home opens with the first step open and its row marked (aria-current)')
        ok(pg.evaluate(H1S) == 1 and pg.locator('main h1').first.inner_text().strip() == pg.evaluate("document.querySelector('.paper h1').innerText.trim()"), f'{tag}: one h1, and it is the sheet\'s')
        ok(pg.evaluate(FILLED) == 1, f'{tag}: Home: exactly one filled button')
        ok(pg.evaluate("document.documentElement.scrollWidth <= innerWidth"), f'{tag}: no sideways scroll on Home')
        # the bill number is never left alone on a second line
        orphan = pg.evaluate("""() => [...document.querySelectorAll('.sr3 .sv')].filter(sv => { const n = sv.querySelector('.no'), t = n.previousSibling; if (!t || !t.textContent.length) return false; const r = document.createRange(); r.setStart(t, t.textContent.length - 1); r.setEnd(t, t.textContent.length); return Math.abs(r.getBoundingClientRect().top - n.getBoundingClientRect().top) > 6 && n.previousSibling.textContent.trim().length < 2; }).length""")
        ok(orphan == 0, f'{tag}: no bill number stands alone on a row\'s second line')
        wr = next(r for r in rs if r['text'].startswith('Write testimony'))
        pg.click(f'.sr3[href="{wr["href"]}"]'); pg.wait_for_selector('#makeBtn'); pg.wait_for_timeout(300)
        ok(pg.locator('main h1').first.inner_text().strip() == 'Write testimony' and pg.locator('.sr3.sel').get_attribute('href') == wr['href'], f'{tag}: a write row opens "Write testimony" and is the marked row')
        ok(pg.locator('textarea').count() == 0 and pg.locator('.chip').count() == 0 and pg.locator('[role=radio]').count() == 0, f'{tag}: the write page has no letter box and no position control')
        ok(re.search(r'Position\s+(Support|Oppose|Comments)', pg.locator('.posfact').inner_text()) is not None, f'{tag}: Position is a fact in words')
        ok('The letter is not made yet.' in pg.locator('.pdfrow').inner_text() and pg.locator('#sendBtn').is_disabled() and 'Make the letter first.' in pg.locator('.sfoot').inner_text(), f'{tag}: no draft yet: the row says so and Send for approval is disabled with its reason')
        ok(pg.evaluate(FILLED) == 1 and pg.evaluate(H1S) == 1, f'{tag}: no-draft write page: one filled button, one h1')
        ok(re.search(r'Hearing \w{3} \d{1,2}:\d{2} [AP]M \u00b7 (House|Senate) ', pg.locator('.strip').inner_text()) is not None and '/' not in pg.locator('.strip .hl').inner_text(), f'{tag}: the hearing line names the chamber and joins joint committees with "and"')
        ok(re.search(r'Due \w{3} \d{1,2}:\d{2} [AP]M', pg.locator('.strip').inner_text()) is not None, f'{tag}: the due time is said as "Wed 2:00 PM"')
        sr = pg.evaluate("() => { const s = document.querySelector('.strip').getBoundingClientRect(), l = document.querySelector('.pdfrow').getBoundingClientRect(); return [s.width, l.width]; }")
        ok(abs(sr[0] - sr[1]) < 2 and sr[1] <= 681, f'{tag}: the due strip is as wide as the letter row, at most 680px ({sr})')
        snap(pg, '1b_write_no_doc', tag)
        pg.click('#makeBtn'); pg.wait_for_selector('#openDoc', timeout=10000); pg.wait_for_timeout(300)
        ok(not pg.locator('#sendBtn').is_disabled() and 'Started from HIPHI' in pg.locator('.pdfrow').inner_text() and pg.locator('#openDoc').inner_text().strip() == 'Open the letter', f'{tag}: Make the letter makes the Doc row ("{pg.locator(".pdfrow .g span").inner_text()}") and Send is ready')
        ok('opens in Google Docs' in pg.locator('main').inner_text() and pg.evaluate(FILLED) == 1, f'{tag}: the hint is there, one filled button')
        npages = len(pg.context.pages); pg.click('#openDoc'); pg.wait_for_timeout(500)
        ok(len(pg.context.pages) == npages and 'does not open' in pg.locator('#toast').inner_text() and pg.evaluate(FILLED) == 1, f'{tag}: in the practice copy "Open the letter" opens nothing and says so')
        if pg.locator('#tpBtn').count():
            pg.click('#tpBtn'); ok(pg.locator('#tpList').is_visible() and pg.locator('#tpList li').count() >= 1, f'{tag}: the talking points unfold in place')
        snap(pg, '1_write_step_open', tag)
        n_before = len(rows(pg))
        pg.click('#sendBtn'); pg.wait_for_selector('.done', timeout=20000); pg.wait_for_timeout(400)
        ok('#/done/' in pg.url and re.match(r'Sent to \w+', pg.locator('main h1').first.inner_text()) is not None, f'{tag}: Send for approval lands on the done moment ("{pg.locator("main h1").first.inner_text()}")')
        ok('Nothing else needs you on' in pg.locator('.done').inner_text() and 'approves' in pg.locator('.done .sub').first.inner_text(), f'{tag}: the one sentence says nothing else needs you until the approver acts')
        left = rows(pg)
        ok(len(left) == n_before - 1 and wr['href'] not in [r['href'] for r in left], f'{tag}: the step left the list at once ({n_before} -> {len(left)})')
        cnt = pg.locator('.done .left').inner_text(); m = re.match(r'(\d+) of (\d+) done this week', cnt); cl = pg.evaluate("[...document.querySelectorAll('.segs i')].map(i => i.classList.contains('on'))")
        ok(m and int(m.group(1)) == 1 == sum(cl) and int(m.group(2)) == len(cl) == len(left) + 1 and cl == sorted(cl, reverse=True), f'{tag}: the count is true and fills from the left ("{cnt}", {cl})')
        ok(pg.evaluate(FILLED) == 1 and pg.locator('.done .btn.filled').inner_text().startswith('Next step: '), f'{tag}: done has one filled button, "{pg.locator(".done .btn.filled").inner_text()}"')
        ok(pg.evaluate(H1S) == 1 and pg.locator('#undoBtn').count() == 1, f'{tag}: one h1 on done, and an Undo')
        pg.click('#undoBtn'); pg.wait_for_selector('#openDoc'); pg.wait_for_timeout(300)
        ok('#/do/' in pg.url and wr['href'] in [r['href'] for r in rows(pg)] and len(rows(pg)) == n_before, f'{tag}: Undo returns to the step and puts it back in the list')
        pg.click('#sendBtn'); pg.wait_for_selector('.done'); pg.wait_for_timeout(10600)
        ok(pg.locator('#undoBtn').count() == 0, f'{tag}: the Undo is gone after 10 seconds')
        # ---- Approve (NT's first row) ----
        pg.goto(f'{BASE}/staff7.html?demo=1&as=NT'); pg.wait_for_selector('#apBtn'); pg.wait_for_timeout(300)
        ok(pg.locator('main h1').first.inner_text().strip() in ('Approve testimony', 'Second look') and 'Approve by ' in pg.locator('.strip').inner_text() and re.search(r'From \w+ . sent ', pg.locator('.strip').inner_text()) is not None, f'{tag}: the approve page: band, "Approve by", who sent it and when')
        ok(pg.locator('#apBtn').inner_text().strip() == 'Approve' and pg.locator('#sbBtn').inner_text().strip() == 'Send back' and 'btn quiet' in pg.locator('#sbBtn').get_attribute('class') and pg.evaluate(FILLED) == 1 and pg.locator('#openDoc').count() == 1, f'{tag}: Approve is the one filled button, Send back is quiet, the letter has its row')
        snap(pg, '7_approve', tag)
        ap_href = pg.locator('.sr3.sel').get_attribute('href'); n_ap = len(rows(pg))
        pg.click('#sbBtn'); pg.wait_for_selector('#sbNote'); pg.wait_for_timeout(300)
        ok(pg.evaluate("document.activeElement.id") == 'sbNote' and pg.evaluate(FILLED) == 1 and pg.locator('#sbGo').inner_text().strip() == 'Send back with this note' and pg.locator('#sbCancel').count() == 1 and pg.locator('label[for=sbNote]').inner_text().strip() == 'What should change?' and pg.input_value('#sbNote') == '', f'{tag}: Send back opens an empty note in the page, focused, with one filled button')
        pg.click('#sbGo'); pg.wait_for_timeout(300)
        ok('#/done/' not in pg.url and pg.locator('#sbErr').is_visible() and pg.locator('#sbNote').get_attribute('aria-invalid') == 'true' and len(pg.locator('#sbErr').inner_text().strip()) > 10 and pg.evaluate(FILLED) == 1, f'{tag}: an empty note is refused, with the error on the field and in words')
        snap(pg, '8_approve_note_error', tag)
        pg.fill('#sbNote', 'Please cite the 2024 numbers. ' + tag); pg.click('#sbGo'); pg.wait_for_selector('.done'); pg.wait_for_timeout(300)
        ok(re.match(r'Sent back to \w+\.', pg.locator('main h1').first.inner_text()) is not None and 'until' in pg.locator('.done .sub').inner_text() and 'resubmits' in pg.locator('.done .sub').inner_text() and ap_href not in [r['href'] for r in rows(pg)], f'{tag}: send back lands on its done moment and the step left the list ("{pg.locator("main h1").first.inner_text()}")')
        snap(pg, '10_done_sent_back', tag)
        pg.click('#undoBtn'); pg.wait_for_selector('#sbNote'); pg.wait_for_timeout(300)
        ok('#/do/' in pg.url and 'Please cite the 2024 numbers. ' + tag in pg.input_value('#sbNote') and ap_href in [r['href'] for r in rows(pg)], f'{tag}: Undo returns to the step with the typed note, nothing sent')
        pg.click('#sbCancel'); pg.click('#apBtn'); pg.wait_for_selector('.done'); pg.wait_for_timeout(300)
        t = pg.locator('main h1').first.inner_text()
        ok(t == 'Approved.' and ('can file it' in pg.locator('.done .sub').inner_text() or 'second look' in pg.locator('.done .sub').inner_text()) and len(rows(pg)) == n_ap - 1, f'{tag}: Approve lands on "{t}" ("{pg.locator(".done .sub").inner_text()}")')
        cl = pg.evaluate("[...document.querySelectorAll('.segs i')].map(i => i.classList.contains('on'))")
        ok(cl == sorted(cl, reverse=True) and pg.evaluate(FILLED) == 1, f'{tag}: the week bar fills from the left ({cl}), one filled button')
        snap(pg, '9_done_approved', tag)
        pg.click('#undoBtn'); pg.wait_for_selector('#apBtn'); pg.wait_for_timeout(300)
        ok('#/do/' in pg.url and ap_href in [r['href'] for r in rows(pg)], f'{tag}: Undo puts the approval back')
        # words and rules over what the page said
        txt = chrome_text(pg)
        ok(not re.search(r'\b(task|tasks|vape|vapes|vaping|dead|review)\b', txt, re.I) and 'cannot open' not in txt, f'{tag}: no "task", "vape", "dead" or "review" in the words')
        ok(pg.evaluate("document.documentElement.scrollWidth <= innerWidth"), f'{tag}: no sideways scroll')
        mo = pg.evaluate("() => { let max = 0, loop = 0; for (const e of document.querySelectorAll('*')) { const s = getComputedStyle(e); for (const d of (s.animationDuration + ',' + s.transitionDuration).split(',')) max = Math.max(max, parseFloat(d) * (d.includes('ms') ? 1 : 1000) || 0); if (s.animationIterationCount === 'infinite') loop++; } return [max, loop]; }")
        ok(mo[0] <= 250 and mo[1] == 0, f'{tag}: motion at most 250 ms and nothing loops ({mo})')
        ok(not errs, f'{tag}: no page or console errors on NT\'s run {errs[:2]}')
        pg.context.close()

        # ---------- KV: a letter sent back (Resubmit) ----------
        pg, errs = open_as(br, 'KV', w, h)
        rs = rows(pg)
        ok(rs and rs[0]['text'].startswith('Resubmit testimony') and rs[0]['sel'], f'{tag}: KV Home opens on a letter sent back')
        ok(pg.locator('main h1').first.inner_text().strip() == 'Resubmit testimony' and pg.locator('.note.flag').count() == 1 and pg.locator('#sendBtn').inner_text().strip() == 'Resubmit', f'{tag}: the sent-back note is above the letter and the button says Resubmit')
        ok(pg.evaluate("() => document.querySelector('.note.flag').getBoundingClientRect().bottom <= document.querySelector('.pdfrow').getBoundingClientRect().top"), f'{tag}: the note is above the letter')
        ok(pg.evaluate(FILLED) == 1 and pg.evaluate(H1S) == 1 and pg.locator('textarea').count() == 0 and pg.locator('#openDoc').count() == 1 and not pg.locator('#sendBtn').is_disabled(), f'{tag}: KV Home: one filled button, one h1, the letter is a Doc row')
        ok(re.search(r'\b\d+ (min|hours?)\b', rs[0]['text']) is not None, f'{tag}: the row says the time left')
        amb = pg.evaluate("() => [...document.querySelectorAll('.stm')].map(e => [e.innerText.trim(), e.classList.contains('soon')])")
        ok(all(s == (('hour' in t or 'min' in t or 'overdue' in t)) for t, s in amb), f'{tag}: amber only on the steps due inside 24 hours ({amb})')
        snap(pg, '0_home_resubmit', tag)
        pg.click('#sendBtn'); pg.wait_for_selector('.done'); pg.wait_for_timeout(300)
        ok(pg.locator('.done .btn.filled').count() == 1 and 'File testimony' in pg.locator('.done .btn.filled').inner_text(), f'{tag}: done offers the next step by its verb')
        pg.click('.done .btn.filled'); pg.wait_for_timeout(300)
        ok('being built' in pg.locator('.paper').inner_text() and pg.evaluate(FILLED) == 1, f'{tag}: the next step opens (its page is not built: a calm sheet, one filled button)')
        ok(not errs, f'{tag}: no errors on KV\'s run {errs[:2]}')
        pg.context.close()

        # ---------- LR: one step; after it, nothing is left ----------
        pg, errs = open_as(br, 'LR', w, h)
        ok(len(rows(pg)) == 1, f'{tag}: LR has one step')
        pg.click('#sendBtn'); pg.wait_for_selector('.done'); pg.wait_for_timeout(300)
        ok(pg.locator('.done .btn.filled').count() == 0 and 'Nothing else needs you.' in pg.locator('.done').inner_text() and len(rows(pg)) == 0 and pg.locator('.done a:has-text("Back to Home")').count() == 1, f'{tag}: after the last step: no filled button, "Nothing else needs you." and a Back to Home link')
        snap(pg, '4_done_last', tag)
        pg.goto(f'{BASE}/staff7.html?demo=1&as=SY'); pg.wait_for_selector('.paper'); pg.wait_for_timeout(400)
        ok('Nothing needs you' in pg.locator('main h1').first.inner_text() and pg.evaluate(FILLED) == 1 and pg.evaluate(H1S) == 1, f'{tag}: a person with no steps gets the designed calm state, one filled button')
        pg.context.close()

        # ---------- a door that is not built ----------
        pg, errs = open_as(br, 'KV', w, h, '#/calendar')
        t = pg.locator('.paper').inner_text()
        ok('Not built yet' in t and pg.evaluate(FILLED) == 1 and pg.locator('main h1').first.inner_text().strip() == 'Calendar' and pg.locator('.bi[aria-current=page]').inner_text().strip() == 'Calendar', f'{tag}: a door not built yet is a calm sheet that says so')
        ok([a.strip() for a in pg.locator('.bi').all_inner_texts()] == ['Home', 'Issues', 'Calendar', 'Search', 'Explore'], f'{tag}: five doors, in order')
        snap(pg, '6_door_not_built', tag)
        # 44px targets
        small = pg.evaluate("() => [...document.querySelectorAll('.btn, .chip, .sr3, .bi')].filter(e => e.getBoundingClientRect().width > 0 && e.getBoundingClientRect().height < 43.5).map(e => e.className)")
        ok(not small, f'{tag}: every button, row and door is 44px tall or more ({small})')
        pg.context.close()

    # ---------- the address without ?demo gains it, before anything loads ----------
    ctx = br.new_context(viewport={'width': 1440, 'height': 900}); pg = ctx.new_page(); reqs = []
    pg.on('request', lambda r: reqs.append(r.url))
    pg.goto(f'{BASE}/staff7.html'); pg.wait_for_selector('.paper', timeout=60000)
    ok('demo=1' in pg.url and not any('supabase.co' in u for u in reqs), 'the address without ?demo gains ?demo=1 and nothing reaches the real database')
    pg.goto(f'{BASE}/staff7.html?as=KV#/'); pg.wait_for_selector('.paper', timeout=60000)
    ok('as=KV' in pg.url and 'demo=1' in pg.url, 'a person in the address is kept when ?demo is added')
    ctx.close()

    # ---------- the look is tokens in one file ----------
    for f in ('app.css', 'app.js', 'parts.js', 'steps.js', 'do_write.js', 'do_approve.js', 'done.js', 'icons7.js'):
        src = open(os.path.join(ROOT, 'staff7', f)).read()
        lit = re.findall(r'(?<![&\w])#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|font-family:\s*(?!var\()\S|font-size:\s*\d|font:[^;]*\b\d+px', src)
        ok(not lit, f'staff7/{f} holds no colour, font or size literal {lit[:3]}')
    ok(os.path.exists(os.path.join(ROOT, 'staff7', 'tokens.css')), 'tokens.css exists')
    br.close()
print(f'{sum(res)}/{len(res)} passed'); sys.exit(0 if all(res) else 1)
