# Staff7's New issue (R-398 piece 10, part A) on the practice copy: the form (Issues door), its errors and the duplicate check (case, accents, the okina), the draft's own page
# ("Before it goes public": ticks worked out from the data, save as you leave a field, who may fill the lines), Remove this draft and its Undo, that no tracker page can publish, and
# that a new draft is in no public view. Names, goals and talking points are plainly sample text; nothing real is written.
#   python3 tests/staff7_newissue.py [base] [shots folder]     base defaults to http://127.0.0.1:8857
import sys, os, re
from playwright.sync_api import sync_playwright
BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8857').rstrip('/')
SHOTS = sys.argv[2] if len(sys.argv) > 2 else ''
if SHOTS: os.makedirs(SHOTS, exist_ok=True)
res = []
def ok(c, m): res.append(bool(c)); print('PASS' if c else 'FAIL', m, flush=True)

NOSIDE = "() => document.documentElement.scrollWidth <= innerWidth && [...document.querySelectorAll('.paper, .wl')].every(p => p.scrollWidth <= p.clientWidth + 1)"
def external_blocker(ctx, bad):
    def h(route):
        u = route.request.url
        if 'fonts.g' in u: return route.continue_()
        bad.append(u); route.abort()
    ctx.route(lambda u: '127.0.0.1' not in u and 'localhost' not in u, h)
def open_as(br, who, w, h, hash=''):
    ctx = br.new_context(viewport={'width': w, 'height': h}); ctx._bad = []; external_blocker(ctx, ctx._bad); ctx._errs = []
    pg = ctx.new_page(); errs = ctx._errs
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'Failed to load resource' not in m.text and 'ERR_FAILED' not in m.text else None)
    pg.goto(f'{BASE}/staff7.html?demo=1&as={who}' + hash); pg.wait_for_selector('.paper', timeout=60000)
    pg.evaluate("Promise.all([document.fonts.load('600 16px Poppins'), document.fonts.load('400 16px Lato'), document.fonts.load('700 16px Lato'), document.fonts.load('500 16px Poppins')])"); pg.wait_for_timeout(500)
    return pg, ctx
def go(pg, hash): pg.evaluate("h => { window.__staff7TrailReset && window.__staff7TrailReset(); location.hash = h; }", hash); pg.wait_for_selector('.paper h1'); pg.wait_for_timeout(600)
def snap(pg, name, tall=False):
    if not SHOTS: return
    if tall:
        w = pg.viewport_size['width']; pg.set_viewport_size({'width': w, 'height': 2800}); pg.wait_for_timeout(300)
        h = pg.evaluate("() => Math.ceil(document.querySelector('.paper').scrollHeight) + 60"); pg.set_viewport_size({'width': w, 'height': max(900, min(h, 4000))}); pg.wait_for_timeout(300)
        pg.screenshot(path=os.path.join(SHOTS, name)); pg.set_viewport_size({'width': w, 'height': 900}); pg.wait_for_timeout(200)
    else: pg.screenshot(path=os.path.join(SHOTS, name))
H1 = "() => document.querySelector('main h1')?.innerText.trim()"
TOAST = "() => { const t = document.getElementById('toast'); return t && t.classList.contains('on') ? t.innerText.replace(/\\s+/g, ' ').trim() : ''; }"
PAPER = "() => document.querySelector('.paper').innerText.replace(/\\s+/g, ' ')"

with sync_playwright() as p:
    br = p.chromium.launch()
    pg, ctx = open_as(br, 'KV', 1440, 900, '#/issues'); errs, bad = ctx._errs, ctx._bad
    info = pg.evaluate("""async () => { const d = await import('/staff6/data.js'), S = d.S;
      const adm = S.advocates.find(a => a.is_admin), kv = S.me, other = S.advocates.find(a => a.id !== kv.id && !a.is_admin && a.is_active !== false);
      const pub = S.issues.find(i => !i.archived_at && i.published_at && i.owner_id && S.advocates.find(a => a.id === i.owner_id));
      const free = S.bills.filter(b => b.tracked !== false && !S.billIssues.some(x => x.bill_id === b.id));
      return { admin: adm && adm.full_name.split(' ')[0], kv: kv.id, other: other && other.id, otherName: other && other.full_name.split(' ')[0], pub: pub && { id: pub.id, name: pub.name, owner: S.advocates.find(a => a.id === pub.owner_id).full_name.split(' ')[0] },
               freeBill: free[0] && { id: free[0].id, no: free[0].bill_number }, cats: S.categories.length }; }""")
    ADMIN = info['admin']
    ok(ADMIN and info['pub'] and info['other'] and info['freeBill'] and info['cats'] == 6, f'the practice copy has what the test needs: an admin ({ADMIN}), a public issue, a teammate, a bill on no issue, six topics')

    # ---- door one: the Issues heading row
    b = pg.locator('#newIssueGo'); ok(b.count() == 1 and b.inner_text().strip() == 'New issue' and 'quiet' in b.get_attribute('class'), 'Issues has a quiet "New issue" button on its heading row')
    ok(pg.evaluate("() => { const h = document.querySelector('#ihd').getBoundingClientRect(), n = document.querySelector('#newIssueGo').getBoundingClientRect(); return Math.abs((h.top + h.bottom) / 2 - (n.top + n.bottom) / 2) < 12 && n.left > h.right; }"), 'it sits on the heading row, to the right of "Issues"')
    b.click(); pg.wait_for_selector('#niForm'); pg.wait_for_timeout(500)
    ok(pg.evaluate("() => location.hash") == '#/issue-new', 'it opens the form as its own page at #/issue-new (not the sort route)')
    ok(pg.evaluate(H1) == 'New issue' and 'Start the draft here. Add the goal and talking points on its page.' in pg.evaluate(PAPER), 'the band says "New issue" and "Start the draft here. Add the goal and talking points on its page."')
    ok(pg.locator('#tbBack').inner_text().strip() == 'Back to Issues' and pg.locator('#tbClose').count() == 1, 'the one top row: "Back to Issues" at the left and Close at the right')
    ok(not pg.evaluate("() => /^#\\/issues\\/new/.test(location.hash)") and pg.locator('.wl #ihd').count() == 1, 'the Issues list stays on the left, and this is not Sort new bills')
    txt = pg.evaluate(PAPER)
    ok('Name required' in txt and 'Topic required' in txt and 'Description can wait' in txt, 'the labels: Name required, Topic required, Description can wait')
    ok(pg.get_attribute('#niNameIn', 'placeholder') == 'Free school meals for every student', 'Name has the placeholder "Free school meals for every student"')
    ok('A policy people recognize, in everyday words. The public will follow it by this name.' in txt and 'One sentence on what would change. Needed before it goes public; the public sees it then.' in txt, 'the help lines under Name and Description are as drawn')
    radios = pg.locator('input[name=niCat]'); ok(radios.count() == 6 and pg.locator('input[name=niCat]:checked').count() == 0, 'six topic rows from the data, none picked')
    names = pg.evaluate("() => [...document.querySelectorAll('.nitop span')].map(s => s.textContent)"); cats = pg.evaluate("async () => (await import('/staff6/data.js')).S.categories.map(c => c.name)")
    ok(sorted(names) == sorted(cats), 'the topics are the six in the categories table')
    ok(pg.get_attribute('#niDescIn', 'maxlength') == '240' and pg.get_attribute('#niNameIn', 'maxlength') == '60', 'Description up to 240 and Name up to 60')
    ok(f'You will lead it. Only the team sees a draft until {ADMIN} publishes it.' in txt and pg.locator('#niSave').inner_text().strip() == 'Save as draft', f'"Save as draft" with "You will lead it. Only the team sees a draft until {ADMIN} publishes it."')
    ok(pg.evaluate("() => { const r = [...document.querySelectorAll('.nitop')].map(e => e.getBoundingClientRect()); return r[0].left === r[1].left && r[3].left > r[0].left && r[3].top === r[0].top; }") is not None and pg.evaluate("() => { const r = [...document.querySelectorAll('.nitop')].map(e => e.getBoundingClientRect()); return r[3].left > r[0].left; }"), 'at laptop width the topics are in two columns of three')
    ok(pg.evaluate(NOSIDE), 'no sideways scroll at 1440')
    snap(pg, 'new_empty_1440.png')

    # ---- errors
    pg.click('#niSave'); pg.wait_for_timeout(300)
    ok(pg.evaluate("() => document.getElementById('niNameErr').innerText.trim()") == 'Give the issue a name.' and pg.evaluate("() => document.getElementById('niCatErr').innerText.trim()") == 'Choose a topic.', 'empty: "Give the issue a name." and "Choose a topic."')
    ok(pg.evaluate("() => document.activeElement.id") == 'niNameIn' and pg.evaluate("() => document.getElementById('niNameIn').classList.contains('err')"), 'the focus is back on Name, which has the red border')
    ok(pg.evaluate("() => document.getElementById('niTopic').classList.contains('bad') && !document.getElementById('niDescIn').classList.contains('err')"), 'one red bar at the left of the topic group; Description is not marked')
    ok(pg.evaluate("() => !!document.querySelector('#niNameErr svg') && !!document.querySelector('#niCatErr svg')"), 'each error has an icon as well as words')
    snap(pg, 'new_required_1440.png')
    pg.fill('#niNameIn', 'Sample issue one'); pg.wait_for_timeout(150)
    ok(pg.evaluate("() => document.getElementById('niNameErr').hidden") and pg.evaluate("() => !document.getElementById('niCatErr').hidden"), 'typing a name takes its error away; the topic error stays')
    pg.click('#niSave'); pg.wait_for_timeout(300)
    ok(pg.evaluate("() => document.activeElement.name") == 'niCat' and pg.input_value('#niNameIn') == 'Sample issue one', 'name filled, no topic: the focus goes to the topics and the name stays')
    pg.locator('.nitop').nth(1).click(); pg.wait_for_timeout(150)
    ok(pg.evaluate("() => document.getElementById('niCatErr').hidden"), 'choosing a topic takes its error away')
    pg.fill('#niNameIn', 'A'); pg.click('#niSave'); pg.wait_for_timeout(200)
    ok(pg.evaluate("() => document.getElementById('niNameErr').innerText.trim()") == 'Give the issue a name.', 'a one-letter name is not a name')

    # ---- the duplicate check: case, accents, the okina, drafts count, archived do not
    pg.evaluate("""async () => { const d = await import('/staff6/data.js'), S = d.S;
      const mk = async (name, extra) => { const i = await d.DB.createIssue({ name, category: S.categories[0].key, owner_id: extra.owner }); if (extra.arch) i.archived_at = new Date().toISOString(); return i; };
      window.__okina = await mk('Hawaiʻi sample rule', { owner: null }); window.__acc = await mk('Café sample rule', { owner: null }); window.__arch = await mk('Archived sample rule', { owner: null, arch: true }); }""")
    pub = info['pub']
    def dup(typed, expect_name):
        pg.fill('#niNameIn', typed); pg.evaluate("() => document.querySelector('input[name=niCat]').click()"); pg.click('#niSave'); pg.wait_for_timeout(250)
        return pg.evaluate("() => document.getElementById('niNameErr').innerText.replace(/\\s+/g, ' ').trim()")
    m = dup(pub['name'].upper(), pub['name'])
    ok(m.startswith(f'There is already an issue called “{pub["name"]}” (on the public site, {pub["owner"]} leads it).') and m.endswith('Use that one'), f'the same name in capitals is found: {m}')
    m = dup('hawaii SAMPLE rule', '')
    ok('Hawaiʻi sample rule' in m and '(a draft,' in m, f'a typed name without the ʻokina finds one that has it, and says it is a draft: {m}')
    m = dup("Hawai'i sample  rule", '')
    ok('Hawaiʻi sample rule' in m, 'a straight apostrophe and a double space find it too')
    m = dup('cafe sample rule', '')
    ok('Café sample rule' in m, 'a name without accents finds one with them')
    pg.fill('#niNameIn', 'Archived sample rule'); pg.click('#niSave'); pg.wait_for_timeout(400)
    ok(pg.evaluate("() => /^#\\/issue\\/demo-/.test(location.hash)"), 'an archived issue with the same name does not count: the draft is made')
    pg.evaluate("() => { window.__staff7TrailReset(); }")
    # use that one (from Issues it opens that issue)
    go(pg, '#/issue-new'); dup(pub['name'], ''); pg.click('#niUse'); pg.wait_for_timeout(600)
    ok(pg.evaluate("(id) => decodeURIComponent(location.hash).startsWith('#/issue/' + id)", pub['id']) and pg.evaluate(H1) == pub['name'], '"Use that one" from Issues opens that issue')

    # ---- a failed save keeps the form and its words
    go(pg, '#/issue-new'); pg.fill('#niNameIn', 'Sample failing issue'); pg.locator('.nitop').nth(2).click(); pg.fill('#niDescIn', 'Sample description.')
    pg.evaluate("async () => { const d = await import('/staff6/data.js'); window.__cr = d.DB.createIssue; d.DB.createIssue = async () => { throw new Error('x'); }; }")
    pg.click('#niSave'); pg.wait_for_timeout(500)
    ok('We could not save the draft' in pg.evaluate(TOAST) and pg.evaluate("() => location.hash") == '#/issue-new', 'a failed save says so in a toast and stays on the form')
    ok(pg.input_value('#niNameIn') == 'Sample failing issue' and pg.input_value('#niDescIn') == 'Sample description.' and pg.evaluate("() => document.querySelector('input[name=niCat]:checked')?.parentElement.innerText") == names[2], 'the words, the topic and the description are all kept')
    pg.evaluate("async () => { const d = await import('/staff6/data.js'); d.DB.createIssue = window.__cr; }")
    # words are never lost on Back (S-11)
    pg.click('#tbBack'); pg.wait_for_timeout(600); pg.click('#newIssueGo'); pg.wait_for_selector('#niForm')
    ok(pg.input_value('#niNameIn') == 'Sample failing issue', 'leaving with Back and coming back: the typed words are still there')
    pg.keyboard.press('Escape'); pg.wait_for_timeout(500)
    ok(pg.evaluate("() => location.hash") == '#/issues' or 'issues' in pg.evaluate("() => location.hash"), 'Escape closes the page and goes back to Issues')

    # ---- a good save: the draft's page
    go(pg, '#/issue-new'); pg.fill('#niNameIn', 'Sample issue one'); pg.locator('.nitop').nth(1).click(); pg.fill('#niDescIn', 'Sample description one.'); pg.click('#niSave'); pg.wait_for_selector('#dBlock'); pg.wait_for_timeout(500)
    ok(pg.evaluate("() => /^#\\/issue\\/demo-/.test(location.hash)"), 'saving opens the draft\'s own page')
    ok(pg.evaluate(TOAST) == f'Saved as a draft. {ADMIN} has been told.', f'the toast says "Saved as a draft. {ADMIN} has been told."')
    DID = pg.evaluate("() => decodeURIComponent(location.hash.split('/')[2].split('?')[0])")
    ok(pg.evaluate(H1) == 'Sample issue one' and 'Draft · not on the public site' in pg.evaluate(PAPER), 'the name, and the mark "Draft · not on the public site" under it')
    ok(pg.evaluate("(id) => import('/staff6/data.js').then(d => { const i = d.S.issues.find(x => x.id === id); return i.published_at == null && i.owner_id === d.S.me.id && i.description === 'Sample description one.' && i.category === d.S.categories[1].key; })", DID), 'it is saved as a draft (nothing published), led by the starter, with its topic and description')
    ok(pg.evaluate("() => document.getElementById('tbBack').innerText.trim()") != 'Back to New issue', 'Back from the draft\'s page never goes to the used-up form')
    t = pg.evaluate(PAPER)
    ok('Before it goes public' in t and '1 of 4 done' in t and 'Saves as you type.' in t, '"Before it goes public", "1 of 4 done", "Saves as you type."')
    ok('A description' in t and 'A goal for 2027' in t and 'What we want to win. Staff only.' in t and 'At least three talking points' in t and 'Up to five, each under 200 characters. They show on the public site under the issue.' in t and 'A bill on it' in t and 'Put a bill on it' in t, 'the four rows and their help are as drawn')
    ok(f'Needs a goal, three talking points and a bill before {ADMIN} can publish it.' in t, 'the closing line names everything missing')
    ok(pg.locator('#d-goal').get_attribute('maxlength') == '600' and pg.locator('#dTpList input').count() == 3 and all(x == '200' for x in pg.eval_on_selector_all('#dTpList input', 'els => els.map(e => e.maxLength + "")')), 'the goal takes up to 600; three talking-point fields of up to 200')
    ok('On the public site' not in t.split('About this issue')[1] and 'Description' in t.split('About this issue')[1], 'About this issue says "Description" and leaves out "On the public site"')
    ok(pg.locator('#dRemove').count() == 1 and pg.locator('#dBlock').inner_text().strip().endswith('Remove this draft'), '"Remove this draft" is the quiet text button at the foot of the block')
    ok(pg.locator('#dPublicGo').count() == 0, 'a not-ready draft has no publish door')
    snap(pg, 'draft_page_1440.png', tall=True)
    # a ticked row is compact and left-aligned, as drawn (a class it once shared with the finished-step page centred it)
    g = pg.evaluate("() => { const r = document.getElementById('dRow-desc').getBoundingClientRect(), b = document.getElementById('dBody-desc').querySelector('.nitext').getBoundingClientRect(), h = document.querySelector('#dRow-desc h3').getBoundingClientRect(); return { h: r.height, row: r.left, text: b.left, title: h.left, tickx: document.querySelector('#dRow-desc .nick').getBoundingClientRect().left }; }")
    ok(g['h'] < 120 and g['text'] - g['row'] < 60 and g['tickx'] - g['row'] < 8 and g['title'] < g['text'] + 1, f'a ticked row is under 120px tall with the tick, title and text at the left ({g})')
    if SHOTS:
        pg.evaluate("() => window.scrollTo(0, 0)"); pg.wait_for_timeout(1500); pg.screenshot(path=os.path.join(SHOTS, 'draft_top.png'))
        pg.evaluate("() => document.querySelector('.paper').scrollBy(0, 450)"); pg.wait_for_timeout(300); pg.screenshot(path=os.path.join(SHOTS, 'draft_mid.png')); pg.evaluate("() => document.querySelector('.paper').scrollTo(0, 0)")

    # ---- the ticks come from the data, and each field saves as it is left
    TICKS = "() => [...document.querySelectorAll('.nirow')].map(r => r.classList.contains('nidone'))"
    DATA = """(id) => import('/staff6/data.js').then(d => { const i = d.S.issues.find(x => x.id === id), pts = (i.talking_points || []).filter(x => String(x).trim());
        return [!!(i.description || '').trim(), !!(i.goal || '').trim(), pts.length >= 3, d.S.billIssues.some(x => x.issue_id === id)]; })"""
    def same(msg): ok(pg.evaluate(TICKS) == pg.evaluate(DATA, DID), msg + f' (ticks {pg.evaluate(TICKS)})')
    same('ticks: the page agrees with the data to begin with')
    pg.fill('#d-goal', 'Sample goal for the draft.'); ok(pg.evaluate("() => document.getElementById('dSaved-goal').hidden"), 'typing does not say Saved yet')
    pg.click('#d-tp-0'); pg.wait_for_timeout(500)
    ok(not pg.evaluate("() => document.getElementById('dSaved-goal').hidden") and pg.evaluate("(id) => import('/staff6/data.js').then(d => d.S.issues.find(x => x.id === id).goal)", DID) == 'Sample goal for the draft.', 'leaving the goal saves it and says "Saved"')
    ok('2 of 4 done' in pg.evaluate(PAPER), 'the count moves to 2 of 4'); same('ticks: goal done')
    pg.fill('#d-tp-0', 'Sample talking point one'); pg.press('#d-tp-0', 'Tab'); pg.fill('#d-tp-1', 'Sample talking point two'); pg.wait_for_timeout(200)
    ok(pg.evaluate("() => document.activeElement.id") == 'd-tp-1' and pg.evaluate("(id) => import('/staff6/data.js').then(d => (d.S.issues.find(x => x.id === id).talking_points || []).length)", DID) in (0, 1), 'moving between the points keeps the cursor in the next field')
    pg.press('#d-tp-1', 'Tab'); pg.fill('#d-tp-2', 'Sample talking point three'); pg.click('#dTpAdd'); pg.wait_for_timeout(500)
    ok(pg.locator('#dTpList input').count() == 4 and pg.evaluate("() => document.activeElement.id") == 'd-tp-3', '"Add another" adds a fourth field with the cursor in it')
    pg.click('#d-goal'); pg.wait_for_timeout(500)   # leaving the points saves them
    same('ticks: three points are done (saved when the cursor left them)')
    ok('3 of 4 done' in pg.evaluate(PAPER), 'the count reads 3 of 4')
    pg.fill('#d-tp-3', 'Sample talking point four'); pg.fill('#d-tp-4', 'x') if pg.locator('#d-tp-4').count() else None
    pg.click('#dTpAdd'); pg.fill('#d-tp-4', 'Sample talking point five'); pg.click('#d-goal'); pg.wait_for_timeout(500)
    ok(pg.locator('#dTpList input').count() == 5 and pg.locator('#dTpAdd').count() == 0, 'at five points "Add another" goes away')
    ok(pg.evaluate("(id) => import('/staff6/data.js').then(d => d.S.issues.find(x => x.id === id).talking_points.length)", DID) == 5, 'up to five points are saved')
    # a bill: "Put a bill on it" opens the bills-on-an-issue editing
    pg.click('#dBillGo'); pg.wait_for_selector('#iPutIn'); pg.fill('#iPutIn', info['freeBill']['no']); pg.wait_for_selector('[data-put]'); pg.click('[data-put]'); pg.wait_for_timeout(700)
    ok('4 of 4 done' in pg.evaluate(PAPER), '"Put a bill on it" opens the bills editor; putting a bill on makes it 4 of 4'); same('ticks: all four done')
    t = pg.evaluate(PAPER)
    ok(f'Ready. It is on {ADMIN}’s list to publish.' in t or f"Ready. It is on {ADMIN}'s list to publish." in t, 'the closing line says "Ready. It is on Nate’s list to publish."')
    ok(pg.locator('#dPublicGo').count() == 0, 'the starter (not an admin) has no publish door')
    # Undo the bill: the tick goes again (ticks are never stored)
    pg.click('#toastUndo'); pg.wait_for_timeout(600); same('ticks: taking the bill back un-ticks it')
    ok('3 of 4 done' in pg.evaluate(PAPER), 'the count goes back to 3 of 4')
    pg.fill('#iPutIn', info['freeBill']['no']) if pg.locator('#iPutIn').count() else None
    pg.evaluate("async ([id, bid]) => { const d = await import('/staff6/data.js'); await d.DB.setBillIssue(bid, id, true); window.__staff7Render({}); }", [DID, info['freeBill']['id']]); pg.wait_for_timeout(500)
    same('ticks: a bill put on by other means is ticked')
    # empty the goal: it un-ticks
    pg.evaluate("() => document.getElementById('dChange-goal')?.click()"); pg.wait_for_selector('#d-goal'); pg.fill('#d-goal', ''); pg.click('#d-tp-0'); pg.wait_for_timeout(400)
    same('ticks: an emptied goal is un-ticked'); ok('Needs a goal' in pg.evaluate(PAPER), 'and the closing line names the goal again')
    pg.fill('#d-goal', 'Sample goal for the draft.'); pg.click('#d-tp-0'); pg.wait_for_timeout(400)
    snap(pg, 'draft_ready_1440.png', tall=True)

    # ---- a save that fails keeps the words
    pg.evaluate("async () => { const d = await import('/staff6/data.js'); window.__ui = d.DB.updateIssue; d.DB.updateIssue = async () => { throw new Error('x'); }; }")
    pg.fill('#d-goal', 'Sample goal that will not save.'); pg.click('#d-tp-0'); pg.wait_for_timeout(400)
    ok(pg.input_value('#d-goal') == 'Sample goal that will not save.' and not pg.evaluate("() => document.getElementById('dErr-goal').hidden"), 'a failed save keeps the typed words and says so beside the field')
    pg.evaluate("async () => { const d = await import('/staff6/data.js'); d.DB.updateIssue = window.__ui; }")
    pg.fill('#d-goal', 'Sample goal for the draft.'); pg.click('#d-tp-0'); pg.wait_for_timeout(400)

    # ---- Remove this draft and its Undo
    nm = 'Sample issue one'
    pg.fill('#d-goal', 'Sample goal for the draft. More.'); pg.click('#dRemove'); pg.wait_for_timeout(700)   # blur by pressing Remove itself
    ok(pg.evaluate("() => location.hash").startswith('#/issues'), 'Remove goes to Issues')
    ok(pg.evaluate(TOAST) == f'Removed the draft {nm}. Its 1 bill is on no issue now. Undo', 'the toast: "Removed the draft Sample issue one. Its 1 bill is on no issue now." with Undo')
    ok(pg.evaluate("(id) => import('/staff6/data.js').then(d => { const i = d.S.issues.find(x => x.id === id); return !!i.archived_at && !d.S.billIssues.some(x => x.issue_id === id); })", DID), 'the record is hidden (archived), not erased, and its bill is off it')
    ok(pg.evaluate("() => new Promise(r => { const el = document.getElementById('toast'); setTimeout(() => r(el.classList.contains('on')), 8000); })"), 'the toast is still there after 8 seconds (it lasts 10)')
    pg.click('#toastUndo'); pg.wait_for_timeout(600)
    ok(pg.evaluate("(id) => import('/staff6/data.js').then(d => { const i = d.S.issues.find(x => x.id === id); return !i.archived_at && d.S.billIssues.some(x => x.issue_id === id); })", DID), 'Undo puts the record and its bill back')
    go(pg, f'#/issue/{DID}'); ok(pg.evaluate(H1) == nm and 'Draft · not on the public site' in pg.evaluate(PAPER), 'and the draft\'s page opens again')

    # ---- a teammate who neither leads nor administers sees the lines read-only; no Remove for them
    pg.evaluate("async ([o]) => { const d = await import('/staff6/data.js'); const i = await d.DB.createIssue({ name: 'Sample other draft', category: d.S.categories[0].key, description: 'Sample words.', owner_id: o, goal: 'Sample goal text.' }); i.created_by = o; window.__od = i.id; }", [info['other']])
    pg.wait_for_timeout(200); go(pg, '#/issue/' + pg.evaluate("() => window.__od")); pg.wait_for_selector('#dBlock')
    ok(pg.locator('#dBlock textarea, #dBlock input').count() == 0, 'a teammate who does not lead it sees the lines read-only (no field)')
    ok(f"{info['otherName']} leads this draft" in pg.evaluate(PAPER) and 'Sample goal text.' in pg.evaluate(PAPER), 'the page says who leads it, and shows the words')
    ok(pg.locator('#dRemove').count() == 0 and pg.locator('#dPublicGo').count() == 0, 'no Remove and no publish door for them')

    # ---- no tracker page can publish
    PUB = "() => [...document.querySelectorAll('#app button, #app a')].map(e => e.innerText.trim()).filter(t => /^publish\\b/i.test(t) || /publish to the public site/i.test(t))"
    seen = 0; bad_pub = []
    for h in ['#/issues', '#/issue-new', f'#/issue/{DID}', f'#/issue/{pub["id"]}', '#/issues/session', '#/issues/bills', '#/calendar', '#/']:
        go(pg, h); seen += 1; bad_pub += pg.evaluate(PUB)
    ok(not bad_pub, f'no tracker page ({seen} looked at) has a "Publish" control: {bad_pub}')

    # ---- a new draft is in no public view of the practice copy
    ok(pg.evaluate("(id) => import('/staff7/issue_data.js').then(m => import('/staff6/data.js').then(d => m.onPublicSite(d.S.issues.find(x => x.id === id))))", DID) is False, 'onPublicSite says a new draft is not on the public site')
    nobad = not bad
    bad0 = list(bad)
    pg.goto(f'{BASE}/track.html?demo=1#/issues'); pg.wait_for_timeout(2500)
    ok('Sample issue one' not in pg.evaluate("() => document.body.innerText"), 'the public tracker\'s practice copy does not show the draft')
    ok(not errs, f'no console or page errors ({errs[:2]})')
    ok(nobad, 'nothing left 127.0.0.1')
    ctx.close()

    # ---- an admin: a ready draft has the way in to public mode, and nothing else
    pg, ctx = open_as(br, 'NT', 1440, 900, '#/issue-new'); errs, bad = ctx._errs, ctx._bad
    pg.fill('#niNameIn', 'Sample admin draft'); pg.locator('.nitop').nth(3).click(); pg.fill('#niDescIn', 'Sample words.'); pg.click('#niSave'); pg.wait_for_selector('#dBlock'); pg.wait_for_timeout(500)
    ADID = pg.evaluate("() => decodeURIComponent(location.hash.split('/')[2].split('?')[0])")
    ok(pg.locator('#dPublicGo').count() == 0, 'a draft that is not ready has no publish door, even for an admin')
    # blur a filled field by pressing each button directly: the press must still land
    pg.fill('#d-goal', 'Sample goal one'); pg.click('#dChange-desc'); pg.wait_for_selector('#d-desc')
    ok(pg.evaluate("(id) => import('/staff6/data.js').then(d => d.S.issues.find(x => x.id === id).goal === 'Sample goal one')", ADID) and pg.locator('#d-desc').count() == 1, 'typed goal then pressing "Change": the goal saved and the press landed')
    pg.fill('#d-tp-0', 'Sample talking point one'); pg.click('#dTpAdd'); pg.wait_for_timeout(300)
    ok(pg.locator('#dTpList input').count() == 4, 'typed point then pressing "Add another": the press landed')
    pg.fill('#d-tp-3', 'Sample talking point four'); pg.click('#dBillGo'); pg.wait_for_timeout(400)
    ok(pg.locator('#iPutIn').count() == 1, 'typed point then pressing "Put a bill on it": the bills editor opened')
    pg.click('#iBillsDone'); pg.wait_for_timeout(300)
    pg.fill('#d-goal', 'Sample goal.'); pg.fill('#d-tp-0', 'Sample talking point one'); pg.fill('#d-tp-1', 'Sample talking point two'); pg.fill('#d-tp-2', 'Sample talking point three'); pg.click('#dBillGo'); pg.wait_for_selector('#iPutIn')
    nb = pg.evaluate("async () => { const d = await import('/staff6/data.js'); return d.S.bills.find(b => b.tracked !== false && !d.S.billIssues.some(x => x.bill_id === b.id)).bill_number; }")
    pg.fill('#iPutIn', nb); pg.wait_for_selector('[data-put]'); pg.click('[data-put]'); pg.wait_for_timeout(700)
    g = pg.locator('#dPublicGo'); ok(g.count() == 1 and g.inner_text().strip() == 'Open in public mode to publish' and 'filled' in g.get_attribute('class'), 'an admin on a ready draft sees the filled "Open in public mode to publish"')
    ok('Nothing changes on the public site until you publish there.' in pg.evaluate(PAPER), 'with "Nothing changes on the public site until you publish there."')
    ok(g.get_attribute('href') == f'#/public/issue/{ADID}', 'it goes to #/public/issue/<id>')
    ok(not pg.evaluate(PUB), 'and the page itself has no Publish control')
    snap(pg, 'admin_ready_1440.png', tall=True)
    ok(not errs and not bad, f'admin: no console errors ({errs[:2]})')
    ctx.close()

    # ---- the form on a phone
    pg, ctx = open_as(br, 'KV', 390, 844, '#/issue-new'); errs = ctx._errs
    pg.wait_for_selector('#niForm'); pg.wait_for_timeout(500)
    ok(pg.evaluate(NOSIDE), 'phone: no sideways scroll')
    ok(pg.evaluate("() => { const r = [...document.querySelectorAll('.nitop')].map(e => e.getBoundingClientRect()); return r.every(x => x.left === r[0].left) && r.every(x => x.height >= 44); }"), 'phone: the six topics are one column, each at least 44px tall')
    ok(pg.locator('#tbBack').is_visible() and pg.locator('#tbClose').is_visible(), 'phone: Back and Close are there')
    pg.click('#niSave'); pg.wait_for_timeout(300)
    ok(pg.evaluate("() => document.getElementById('niNameErr').innerText.trim()") == 'Give the issue a name.' and pg.evaluate(NOSIDE), 'phone: the errors show and nothing scrolls sideways')
    pg.fill('#niNameIn', 'Sample phone issue'); pg.locator('.nitop').nth(4).click(); pg.fill('#niDescIn', 'Sample description.')
    pg.locator('#niSave').scroll_into_view_if_needed(); ok(pg.locator('#niSave').is_visible() and pg.locator('.niwho').is_visible(), 'phone: "Save as draft" and the line under it are reachable')
    snap(pg, 'new_filled_390.png')
    pg.click('#niSave'); pg.wait_for_selector('#dBlock'); pg.wait_for_timeout(500)
    ok(pg.evaluate(NOSIDE) and not ctx._errs, f'phone: the draft\'s page fits and nothing errored ({ctx._errs[:2]})')
    snap(pg, 'draft_390.png')
    ctx.close(); br.close()
print(f'{sum(res)}/{len(res)} passed'); sys.exit(0 if all(res) else 1)
