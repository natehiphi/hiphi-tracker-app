# Staff7 piece 10 part D (R-398): public mode for one issue, #/public/issue/<id>, on the practice copy only. Ready drafts are set up through the data layer (DB.createIssue, updateIssue,
# setBillIssue), never through the New issue screens.
#   (a) a ready draft as Nate: the band, Back and Close, the words to read once more, the goal named but not shown, the preview (name, topic, description, talking points, only the bills the public
#       would see, the follow row, not pressable), the docked Publish to the public site and its line;
#   (b) a draft that is not ready: the button is off, the line says what is missing, and a press publishes nothing;
#   (c) a teammate who is not an admin: only Nate publishes, a way back, no publish button;
#   (d) publishing: the done page, Undo for 10 seconds (then gone), the row written (published_at, prep_state approved), Undo puts it back as a draft;
#   (e) a published issue: the page says so, "Take it off the public site" takes it off, its Undo puts it back;
#   (f) the public views of the practice copy: a published issue is in them, a draft in none (the issue's own "On the public site" row, and public_issues' rule on the data);
#   (g) Close goes back to the issue; an unknown issue is said calmly; 390 wide: no sideways scroll, the button and the preview reach the screen; no page errors; nothing leaves 127.0.0.1.
#   python3 tests/staff7_newissue_publish.py [base] [shots folder]     base defaults to http://127.0.0.1:8857
import os, sys
from playwright.sync_api import sync_playwright
BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8857').rstrip('/')
SHOTS = sys.argv[2] if len(sys.argv) > 2 else ''
if SHOTS: os.makedirs(SHOTS, exist_ok=True)
res = []
def ok(c, m): res.append(bool(c)); print('PASS' if c else 'FAIL', m, flush=True)

READY = "async () => { const d = await import('/staff6/data.js'); return !!(d.S.publicSeededV7 && d.S.me && d.S.bills.length); }"
NOSIDE = "() => document.documentElement.scrollWidth <= innerWidth"
# two ready-to-publish drafts' ingredients, from the practice data: a bill the public sees and a bill it does not
SETUP = """async () => {
  const d = await import('/staff6/data.js'), S = d.S, DB = d.DB, kv = S.advocates.find(a => a.initials === 'KV');
  window.T = { d };
  const live = S.bills.find(b => d.isLiveBill(b) && !b.archived_at), dark = S.bills.find(b => b.tracked !== false && !b.is_public && b.id !== live.id);
  const mk = async (name, full) => {
    await new Promise(r => setTimeout(r, 15));   // the practice copy's new ids are made from the clock: two in one millisecond would be one
    const i = await DB.createIssue({ name, category: S.categories[0].key, description: 'Sample description of the issue.', owner_id: kv.id });
    i.created_by = kv.id;
    if (full) { await DB.updateIssue(i.id, { goal: 'Sample goal for the team only.', talking_points: ['Sample talking point one', 'Sample talking point two', 'Sample talking point three'] }); await DB.setBillIssue(live.id, i.id, true); await DB.setBillIssue(dark.id, i.id, true); }
    return i.id;
  };
  const ready = await mk('Sample bus rides issue', true), bare = await mk('Sample bare draft', false);
  return { ready, bare, topic: S.categories[0].name, liveName: live.nickname || null, liveNo: live.bill_number, darkNo: dark.bill_number, kv: kv.full_name.split(' ')[0],
    nate: S.advocates.find(a => a.initials === 'NT').full_name.split(' ')[0] }; }"""
ROW = "id => { const i = T.d.S.issues.find(x => x.id === id); return { pub: i.published_at, prep: i.prep_state }; }"

def new_ctx(br, w=1440, h=900):
    ctx = br.new_context(viewport={'width': w, 'height': h}); errs = []; out = []
    ctx.route(lambda u: '127.0.0.1' not in u and 'localhost' not in u and 'fonts.g' not in u, lambda r: (out.append(r.request.url), r.abort()))
    pg = ctx.new_page()
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'Failed to load resource' not in m.text and 'ERR_FAILED' not in m.text else None)
    pg.errs = errs; pg.out = out
    return pg

def open_as(pg, who):
    pg.goto(f'{BASE}/staff7.html?demo=1&as={who}')
    for _ in range(200):
        try:
            if pg.evaluate(READY): break
        except Exception: pass
        pg.wait_for_timeout(200)
    return pg.evaluate(SETUP)

def go(pg, h):
    pg.evaluate("h => { location.hash = h; }", h); pg.wait_for_timeout(500)
    pg.evaluate("async () => { await document.fonts.load('600 16px Poppins'); await document.fonts.load('400 16px Lato'); }")
def txt(pg, sel='#app'): return pg.inner_text(sel)
def toast(pg): return pg.inner_text('#toastMsg')
def shot(pg, n):
    if SHOTS: pg.screenshot(path=f'{SHOTS}/{n}.png')

with sync_playwright() as p:
    br = p.chromium.launch()
    pg = new_ctx(br); k = open_as(pg, 'NT'); R, B = k['ready'], k['bare']
    # ---- (a) the ready draft, opened by address so Back has nothing before it and names its parent
    pg.evaluate("() => window.__staff7TrailReset()")
    pg.evaluate("h => { location.hash = h; }", f'#/public/issue/{R}'); pg.wait_for_timeout(600)
    t = txt(pg)
    ok(pg.evaluate("() => document.documentElement.dataset.mode") == 'public', 'the page is in public mode')
    ok('You are changing the public site' in t and 'Sample bus rides issue' in pg.inner_text('.pub-band'), 'the band: "You are changing the public site" and the issue name')
    ok(pg.is_visible('#tbBack') and 'Back to the issue' in pg.inner_text('#tbBack') and pg.is_visible('#tbClose'), 'Back to the issue (top left) and Close X (top right)')
    ok(pg.is_visible('h1') and pg.inner_text('h1') == 'Sample bus rides issue', 'the heading is the issue name')
    left = pg.inner_text('.pi-left')
    ok(f"Issue · {k['topic']}" in left, 'the line above the name says Issue and the topic')
    ok(f"{k['kv']} started it as a draft. It has a goal, three talking points and 2 bills." in left, f'the status line counts the real goal, points and bills ({left[left.find(k["kv"]):left.find(k["kv"])+90]!r})')
    ok('Sample description of the issue.' in left and 'Sample talking point two' in left and k['topic'] in left, 'the topic, description and talking points to read once more')
    ok('The goal is for the team only and is not shown.' in left and 'Sample goal' not in t, 'the goal is named as team only and its words are not on the page')
    ok(pg.get_attribute('#piChange', 'href') == f'#/issue/{R}' and 'Change these words on the issue’s page' in left, 'a link back to the issue\'s page to change the words')
    card = txt(pg, '#pubCard')
    ok('How the public site will show it' in t and 'Preview · a picture, not the real page' in card, 'the preview is headed and says it is a picture')
    ok('Sample bus rides issue' in card and k['topic'] in card and 'Sample description of the issue.' in card and 'Sample talking point three' in card, 'the preview shows the name, topic, description and talking points')
    sp = lambda x: x.replace(' ', '')
    ok(sp(k['liveNo']) in sp(card) and sp(k['darkNo']) not in sp(card), f"the preview lists only the bill the public sees ({k['liveNo']} yes, {k['darkNo']} no)")
    ok('1 bill on it is not on the public site' in left, 'the left says one bill is not on the public site')
    ok('Follow this issue' in card and 'to hear when its bills move' in card, 'the preview has the follow row')
    ok(pg.evaluate("() => document.querySelectorAll('#pubCard button, #pubCard a, #pubCard input, #pubCard select').length") == 0, 'nothing in the preview can be pressed')
    ok('Sample goal' not in card, 'the preview does not show the goal')
    go_btn = pg.query_selector('#piGo')
    ok(go_btn and go_btn.inner_text() == 'Publish to the public site' and go_btn.get_attribute('aria-disabled') == 'false', 'the docked button reads Publish to the public site and is on')
    ok('The public can find and follow it from then on.' in txt(pg, '#pubDock'), 'the dock line: The public can find and follow it from then on.')
    ok(pg.evaluate("() => { const r = document.getElementById('pubDock').getBoundingClientRect(); return Math.abs(r.bottom - innerHeight) < 2; }"), 'the dock sits at the bottom of the window')
    shot(pg, 'publish_review')
    # ---- (b) not ready
    go(pg, f'#/public/issue/{B}')
    ok(pg.get_attribute('#piGo', 'aria-disabled') == 'true', 'a draft that is not ready: the button is off')
    ln = txt(pg, '#pubLine')
    ok(ln == 'It needs a goal, three talking points and a bill before it can be published.', f'the line says what is missing ({ln!r})')
    ok('It needs a goal, three talking points and a bill' in txt(pg, '#piStatus'), 'the status box says what is missing')
    pg.click('#piGo', force=True); pg.wait_for_timeout(300)
    ok('needs a goal' in toast(pg) and pg.evaluate(ROW, B)['pub'] is None, 'a press on it says what is missing and publishes nothing')
    shot(pg, 'publish_notready')
    # ---- (d) publish and Undo
    go(pg, f'#/public/issue/{R}')
    pg.click('#piGo'); pg.wait_for_timeout(500)
    t = txt(pg)
    row = pg.evaluate(ROW, R)
    ok(row['pub'] and row['prep'] == 'approved', f'the issue is published and its prep state is approved ({row})')
    ok(pg.inner_text('h1') == 'Published.' and 'The public can find and follow Sample bus rides issue.' in t, 'the done page: Published. and the sentence with the name')
    ok(pg.is_visible('#piUndo') and 'for 10 seconds' in txt(pg, '#piUndoRow'), 'Undo for 10 seconds')
    ok('Later, you can take it off the public site from the issue’s page.' in t, 'the line about taking it off the public site')
    ok('Back to the issue' in pg.inner_text('#piBack') and pg.get_attribute('#piBack', 'href') == f'#/issue/{R}', 'the button Back to the issue goes to the issue')
    ok(pg.is_visible('.pi-tick svg'), 'a tick')
    shot(pg, 'publish_done')
    pg.click('#piUndo'); pg.wait_for_timeout(500)
    row = pg.evaluate(ROW, R)
    ok(row['pub'] is None and row['prep'] == 'todo', f'Undo puts the issue back as a draft with its old prep state ({row})')
    ok(pg.is_visible('#piGo') and 'Put back' in toast(pg), 'Undo is back on the review page, with a toast')
    # ---- Undo goes after 10 seconds
    pg.click('#piGo'); pg.wait_for_timeout(500)
    ok(pg.is_visible('#piUndo'), 'published again: Undo is there')
    pg.wait_for_timeout(10600)
    ok(not pg.is_visible('#piUndo') and pg.inner_text('h1') == 'Published.', 'after 10 seconds Undo is gone and the page still says Published.')
    # ---- (f) public views
    go(pg, f'#/issue/{R}')
    ok('Shown' in txt(pg, '.paper'), 'the published issue\'s page says it is on the public site (Shown)')
    ok(pg.get_attribute('#iOffGo', 'href') == f'#/public/issue/{R}', 'the published issue\'s page (admin) has the door into public mode to take it off')
    views = pg.evaluate("""([a, b]) => { const S = T.d.S, pubIssues = S.issues.filter(i => i.published_at && !i.archived_at).map(i => i.id); return [pubIssues.includes(a), pubIssues.includes(b)]; }""", [R, B])
    ok(views == [True, False], f'the data the public views read (public_issues rule) holds the published issue and not the draft ({views})')
    # ---- (e) take it off
    go(pg, f'#/public/issue/{R}')
    ok(pg.is_visible('#piOff') and pg.inner_text('#piOff') == 'Take it off the public site' and not pg.query_selector('#piGo'), 'a published issue shows Take it off the public site and no Publish')
    ok('On the public site' in txt(pg, '#piStatus'), 'the status box says it is on the public site')
    shot(pg, 'publish_published')
    pg.click('#piOff'); pg.wait_for_timeout(500)
    ok(pg.evaluate(ROW, R)['pub'] is None and 'off the public site' in toast(pg) and pg.is_visible('#toastUndo'), 'take off: published_at is empty, a toast with Undo')
    ok(pg.is_visible('#piGo'), 'the page is the draft review again, Publish is back')
    go(pg, f'#/issue/{R}')
    ok('Shown' not in txt(pg, '.paper').replace('shown on the public site', ''), 'the draft is in no public view (its page has no Shown)')
    go(pg, f'#/public/issue/{R}'); pg.click('#piGo'); pg.wait_for_timeout(500)
    go(pg, f'#/issue/{R}'); go(pg, f'#/public/issue/{R}'); pg.click('#piOff'); pg.wait_for_timeout(300); pg.click('#toastUndo'); pg.wait_for_timeout(400)
    ok(pg.evaluate(ROW, R)['pub'] is not None and pg.is_visible('#piOff'), 'Undo after taking off puts it back on the public site')
    # ---- (g) Close
    pg.evaluate("() => window.__staff7TrailReset && window.__staff7TrailReset()")
    pg.evaluate("h => { location.hash = h; }", f'#/public/issue/{R}'); pg.wait_for_timeout(500)
    pg.click('#tbClose'); pg.wait_for_timeout(600)
    ok(pg.evaluate("() => location.hash") == f'#/issue/{R}', 'Close goes back to the issue')
    go(pg, '#/public/issue/not-an-issue')
    ok('That issue is not here.' in pg.inner_text('h1') and pg.is_visible('.pi-back a'), 'an unknown issue is said calmly, with a way back')
    ok(not pg.errs, f'no page errors ({pg.errs[:2]})')
    ok(not pg.out, f'nothing left 127.0.0.1 ({pg.out[:2]})')
    pg.context.close()

    # ---- (c) a teammate who is not an admin
    pg = new_ctx(br); k = open_as(pg, 'KV'); R2 = k['ready']
    go(pg, f'#/public/issue/{R2}')
    t = txt(pg)
    ok(f"Only {k['nate']} publishes an issue." in t and not pg.query_selector('#piGo') and not pg.query_selector('#piOff'), 'a non-admin sees that only Nate publishes, and no publish control')
    ok(pg.is_visible('.pi-back a') and pg.get_attribute('.pi-back a', 'href') == f'#/issue/{R2}' and pg.is_visible('#tbClose'), 'and a way back')
    shot(pg, 'publish_nonadmin')
    ok(not pg.errs, f'no page errors for the teammate ({pg.errs[:2]})')
    pg.context.close()

    # ---- 390 wide
    pg = new_ctx(br, 390, 800); k = open_as(pg, 'NT'); R3 = k['ready']
    go(pg, f'#/public/issue/{R3}')
    ok(pg.evaluate(NOSIDE), 'at 390 there is no sideways scroll')
    ok(pg.is_visible('#piGo') and pg.evaluate("() => { const r = document.getElementById('piGo').getBoundingClientRect(); return r.right <= innerWidth && r.left >= 0 && r.bottom <= innerHeight; }"), 'at 390 the Publish button is wholly on the screen')
    pg.evaluate("() => document.getElementById('pubCard').scrollIntoView()"); pg.wait_for_timeout(200)
    ok(pg.is_visible('#pubCard') and pg.evaluate(NOSIDE), 'at 390 the preview is reachable')
    shot(pg, 'publish_390')
    pg.click('#piGo'); pg.wait_for_timeout(500)
    ok(pg.is_visible('#piUndo') and pg.evaluate(NOSIDE), 'at 390 the done page shows Undo, no sideways scroll')
    shot(pg, 'publish_done_390')
    ok(not pg.errs, f'no page errors at 390 ({pg.errs[:2]})')
    br.close()
print(f'{sum(res)} of {len(res)} passed'); sys.exit(0 if all(res) else 1)
