# Staff7's New issue, part C (R-398 piece 10): nobody finds it by looking. On the practice copy: the starter's step "Finish a new issue" (its line follows what is missing, it sits below the timed steps,
# it is never First up, it ends by itself), an admin's "Waiting on others" row and then "Publish a new issue", and the Drafts group in the Issues list (only with a draft; a removed draft is nowhere).
# Names, goals and talking points are plainly sample text; nothing real is written.
#   python3 tests/staff7_newissue_steps.py [base] [shots folder]     base defaults to http://127.0.0.1:8857
import sys, os
from playwright.sync_api import sync_playwright
BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8857').rstrip('/')
SHOTS = sys.argv[2] if len(sys.argv) > 2 else ''
if SHOTS: os.makedirs(SHOTS, exist_ok=True)
res = []
def ok(c, m): res.append(bool(c)); print('PASS' if c else 'FAIL', m, flush=True)

def open_as(br, who, w, h, hash=''):
    ctx = br.new_context(viewport={'width': w, 'height': h}); ctx._errs = []
    pg = ctx.new_page(); errs = ctx._errs
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'Failed to load resource' not in m.text and 'ERR_FAILED' not in m.text else None)
    pg.goto(f'{BASE}/staff7.html?demo=1&as={who}' + hash); pg.wait_for_selector('.paper', timeout=60000)
    pg.evaluate("Promise.all([document.fonts.load('600 16px Poppins'), document.fonts.load('400 16px Lato'), document.fonts.load('700 16px Lato'), document.fonts.load('500 16px Poppins')])"); pg.wait_for_timeout(500)
    return pg, ctx
def go(pg, hash): pg.evaluate("h => { window.__staff7TrailReset && window.__staff7TrailReset(); const same = location.hash === h || (h === '#/' && (location.hash === '' || location.hash === '#')); location.hash = h; if (same) window.__staff7Render({}); }", hash); pg.wait_for_selector('.paper h1'); pg.wait_for_timeout(600)
def snap(pg, name):
    if SHOTS: pg.screenshot(path=os.path.join(SHOTS, name))
def redraw(pg): pg.evaluate("() => window.__staff7Render({})"); pg.wait_for_timeout(400)
def rows(pg, sec): return pg.evaluate("(id) => [...document.querySelectorAll('#' + id + ' ~ ul > li, #' + id + ' + ul > li')].map(li => li.innerText.replace(/\\s+/g, ' ').trim())", sec)
TODO = "() => [...document.querySelectorAll('#hs ~ ul.srows3 > li')].map(li => li.innerText.replace(/\\s+/g, ' ').trim())"
WAIT = "() => [...document.querySelectorAll('#hw ~ ul > li')].map(li => li.innerText.replace(/\\s+/g, ' ').trim())"
H1 = "() => document.querySelector('main h1')?.innerText.trim()"
SUB = "() => document.querySelector('.ovsub')?.innerText.trim() || ''"

# set the draft's words from inside the page (the page's own data call), then draw again
SET = """async ([id, patch]) => { const d = await import('/staff6/data.js'); await d.DB.updateIssue(id, patch); window.__staff7Render({}); }"""
MAKE = """async ([name, owner, creator]) => { const d = await import('/staff6/data.js'), S = d.S;
  const i = await d.DB.createIssue({ name, category: S.categories[0].key, owner_id: owner }); i.created_by = creator; return i.id; }"""

with sync_playwright() as p:
    br = p.chromium.launch()
    # ================================================================ the starter: Kevin
    pg, ctx = open_as(br, 'KV', 1440, 900, '#/'); errs = ctx._errs
    info = pg.evaluate("""async () => { const d = await import('/staff6/data.js'), S = d.S;
      const kv = S.me, adm = S.advocates.find(a => a.is_admin), free = S.bills.filter(b => b.tracked !== false && !S.billIssues.some(x => x.bill_id === b.id));
      return { kv: kv.id, adm: adm.id, admName: adm.full_name.split(' ')[0], bill: free[0] && free[0].id }; }""")
    ok(info['bill'] and info['kv'] != info['adm'], 'the practice copy has Kevin, an admin and a bill on no issue')
    todo0 = pg.evaluate(TODO)
    ok(not any('Finish a new issue' in t for t in todo0), 'with no draft there is no "Finish a new issue" step')
    go(pg, '#/issues')
    ok(pg.locator('#g-drafts').count() == 0 and 'Drafts' not in pg.evaluate("() => document.querySelector('.wl').innerText"), 'with no draft the Issues list has no Drafts group')
    timed0 = [t for t in todo0 if 'Approve' in t or 'testimony' in t.lower()]

    DID = pg.evaluate(MAKE, ['Sample finish draft', info['kv'], info['kv']])
    go(pg, '#/')
    todo = pg.evaluate(TODO); fin = [t for t in todo if t.startswith('Finish a new issue')]
    ok(len(fin) == 1 and 'Sample finish draft' in fin[0], f'the starter has the step "Finish a new issue · Sample finish draft" ({fin})')
    ok('A description, a goal and three talking points to write, and a bill to put on it' in fin[0], 'its line names everything missing, as words to write and a bill to put on it')
    ok(todo.index(fin[0]) == len(todo) - 1 and len(todo) > 1, f'it sits below the timed steps (last of {len(todo)})')
    ok('Finish a new issue' not in pg.evaluate(SUB), 'it is never First up')
    sr = pg.locator('#hs ~ ul.srows3 a', has_text='Finish a new issue').first
    ok(sr.locator('.stm').count() == 0, 'it has no clock on its row')
    snap(pg, 'steps_finish_1440.png')

    # each step of the line follows the data
    pg.evaluate(SET, [DID, {'description': 'Sample words about the change.'}])
    ok('A goal and three talking points to write, and a bill to put on it' in pg.evaluate(TODO)[-1], 'with a description, the line starts at "A goal and three talking points to write, and a bill to put on it"')
    pg.evaluate(SET, [DID, {'goal': 'Sample goal text.'}])
    last = pg.evaluate(TODO)[-1]; ok('Three talking points to write, and a bill to put on it' in last, f'with a goal, it says "Three talking points to write, and a bill to put on it" ({last})')
    pg.evaluate(SET, [DID, {'talking_points': ['Sample talking point one', 'Sample talking point two']}])
    ok('Three talking points to write' in pg.evaluate(TODO)[-1], 'two talking points are not three: the line still names them')
    pg.evaluate(SET, [DID, {'talking_points': ['Sample talking point one', 'Sample talking point two', 'Sample talking point three']}])
    last = pg.evaluate(TODO)[-1]; ok('A bill to put on it' in last and 'talking points' not in last, f'with three talking points, only "A bill to put on it" is left ({last})')
    # it opens the draft's page
    pg.locator('#hs ~ ul.srows3 a', has_text='Finish a new issue').first.click(); pg.wait_for_selector('#dBlock'); pg.wait_for_timeout(400)
    ok(pg.evaluate("() => location.hash").startswith(f'#/issue/{DID}'), 'the step opens the draft\'s own page')
    # the Drafts group in Issues
    go(pg, '#/issues')
    g = pg.evaluate("() => document.querySelector('#g-drafts')?.innerText")
    ok(g and g.startswith('Drafts') and '1' in g, f'the Issues list has "Drafts · 1" ({g})')
    drow = pg.evaluate("() => document.querySelector('#gl-drafts li')?.innerText.replace(/\\s+/g, ' ').trim()")
    ok(drow and 'Sample finish draft' in drow and 'Draft' in drow and 'only the team sees it' in drow, f'its row is marked "Draft" with "only the team sees it" ({drow})')
    ok(pg.evaluate("() => { const g = document.querySelector('#g-drafts'), s = document.querySelector('#summ'), c = document.querySelector('.wl h3.glab'); return !!s ? (s.compareDocumentPosition(g) & 4) !== 0 && c === g : c === g; }"), 'the group is the first group in the list, under the summary')
    ok(pg.evaluate("() => document.querySelectorAll('.wl .ir b').length && [...document.querySelectorAll('.wl .glab')].filter(h => !h.id.startsWith('g-drafts')).every(h => !/Sample finish draft/.test(h.parentElement.innerText))"), 'the draft is not repeated in the standing groups')
    snap(pg, 'issues_drafts_1440.png')
    pg.click('#gl-drafts a'); pg.wait_for_selector('#dBlock'); pg.wait_for_timeout(300)
    ok(pg.evaluate("() => location.hash").startswith(f'#/issue/{DID}'), 'the draft row opens its page')
    # the bill ends the step by itself
    pg.evaluate("async ([id, bid]) => { const d = await import('/staff6/data.js'); await d.DB.setBillIssue(bid, id, true); }", [DID, info['bill']])
    go(pg, '#/')
    ok(not any('Finish a new issue' in t for t in pg.evaluate(TODO)), 'with nothing missing the step ends by itself (worked out from the data, nothing stored)')
    go(pg, '#/issues')
    ok(pg.locator('#g-drafts').count() == 1, 'a ready draft is still a draft, and still in the Drafts group')
    # Fix Y 1: the lead who cannot publish waits on the admin, under Waiting on others
    go(pg, '#/'); w = [t for t in pg.evaluate(WAIT) if 'Sample finish draft' in t]
    ok(len(w) == 1 and 'Waiting on Nate to publish' in w[0], f'Kevin, the lead of a ready draft, has a waiting row naming Nate ({w})')
    pg.evaluate(SET, [DID, {'archived_at': '2026-11-20T00:00:00Z'}]); go(pg, '#/')
    ok(not any('Sample finish draft' in t for t in pg.evaluate(WAIT)), 'the waiting row ends by itself when the draft is removed')
    pg.evaluate(SET, [DID, {'archived_at': None}])
    # removed (archived): nowhere
    pg.evaluate(SET, [DID, {'archived_at': '2026-11-20T00:00:00Z'}]); go(pg, '#/issues')
    ok(pg.locator('#g-drafts').count() == 0, 'a removed draft is not in the Drafts group')
    pg.evaluate(SET, [DID, {'archived_at': None}]); pg.evaluate("async ([id, bid]) => { const d = await import('/staff6/data.js'); await d.DB.setBillIssue(bid, id, false); }", [DID, info['bill']])
    pg.evaluate(SET, [DID, {'archived_at': '2026-11-20T00:00:00Z'}]); go(pg, '#/')
    ok(not any('Finish a new issue' in t for t in pg.evaluate(TODO)), 'a removed draft has no step')
    # a published issue is not a draft
    pg.evaluate(SET, [DID, {'archived_at': None, 'published_at': '2026-11-20T00:00:00Z'}]); go(pg, '#/issues')
    ok(pg.locator('#g-drafts').count() == 0, 'a published issue is no draft: no Drafts group')
    # a teammate's draft is not Kevin's step
    OD = pg.evaluate(MAKE, ['Sample other draft', info['adm'], info['adm']]); go(pg, '#/')
    ok(not any('Sample other draft' in t for t in pg.evaluate(TODO)) and not any('Sample other draft' in t for t in pg.evaluate(WAIT)), 'a draft someone else leads is neither Kevin\'s step nor a waiting row (he is not an admin)')
    ok(not errs, f'Kevin: no console or page errors ({errs[:2]})')
    ctx.close()

    # ================================================================ the admin: Nate
    pg, ctx = open_as(br, 'NT', 1440, 900, '#/'); errs = ctx._errs
    info = pg.evaluate("""async () => { const d = await import('/staff6/data.js'), S = d.S; const kv = S.advocates.find(a => a.initials === 'KV');
      const free = S.bills.filter(b => b.tracked !== false && !S.billIssues.some(x => x.bill_id === b.id));
      return { kv: kv.id, nt: S.me.id, bill: free[0].id, bill2: free[1].id }; }""")
    ok(not any('Waiting on Kevin' in t for t in pg.evaluate(WAIT)), 'with no draft Nate has no waiting row for one')
    ID = pg.evaluate(MAKE, ['Sample admin view draft', info['kv'], info['kv']]); go(pg, '#/')
    w = [t for t in pg.evaluate(WAIT) if 'Sample admin view draft' in t]
    ok(len(w) == 1 and 'Waiting on Kevin for a description, a goal, talking points and a bill' in w[0], f'Nate sees it under Waiting on others, naming Kevin and what is missing ({w})')
    todo = pg.evaluate(TODO); ok(not any('Finish a new issue' in t or 'Publish a new issue' in t for t in todo), 'Nate has no step for it yet: it is Kevin\'s to finish')
    pg.evaluate(SET, [ID, {'description': 'Sample words about the change.'}])
    w = [t for t in pg.evaluate(WAIT) if 'Sample admin view draft' in t]; ok(len(w) == 1 and 'Waiting on Kevin for a goal, talking points and a bill' in w[0], f'the row follows what is missing ({w})')
    pg.evaluate(SET, [ID, {'goal': 'Sample goal text.', 'talking_points': ['Sample talking point one', 'Sample talking point two', 'Sample talking point three']}])
    w = [t for t in pg.evaluate(WAIT) if 'Sample admin view draft' in t]; ok(len(w) == 1 and 'Waiting on Kevin for a bill' in w[0] and 'goal' not in w[0], f'with a goal and three points, only the bill is left ({w})')
    snap(pg, 'steps_waiting_1440.png')
    pg.locator('#hw ~ ul a', has_text='Sample admin view draft').first.click(); pg.wait_for_selector('#dBlock'); pg.wait_for_timeout(300)
    ok(pg.evaluate("() => location.hash").startswith(f'#/issue/{ID}'), 'the waiting row opens the draft\'s page')
    go(pg, '#/issues')
    ok(pg.locator('#g-drafts').count() == 0, 'Kevin\'s draft is not in Nate\'s Mine (he neither leads it nor started it)')
    pg.evaluate("async ([id, bid]) => { const d = await import('/staff6/data.js'); await d.DB.setBillIssue(bid, id, true); }", [ID, info['bill']]); go(pg, '#/')
    ok(not any('Sample admin view draft' in t for t in pg.evaluate(WAIT)), 'once it is ready the waiting row is gone')
    ok(not any('to publish' in t for t in pg.evaluate(WAIT)), 'the admin who publishes never gets a "waiting on ... to publish" row')
    todo = pg.evaluate(TODO); pub = [t for t in todo if t.startswith('Publish a new issue')]
    ok(len(pub) == 1 and 'Sample admin view draft' in pub[0], f'it becomes the step "Publish a new issue · Sample admin view draft" ({pub})')
    ok('Kevin started it. It has a goal, three talking points and 1 bill.' in pub[0], 'its line counts the real points and bills: "Kevin started it. It has a goal, three talking points and 1 bill."')
    ok(todo.index(pub[0]) > 0, 'it is not the first row of To do') if len(todo) > 1 else None
    ok('Publish a new issue' not in pg.evaluate(SUB), 'it is never First up')
    snap(pg, 'steps_publish_1440.png')
    pg.evaluate(SET, [ID, {'talking_points': ['Sample talking point one', 'Sample talking point two', 'Sample talking point three', 'Sample talking point four']}])
    pg.evaluate("async ([id, bid]) => { const d = await import('/staff6/data.js'); await d.DB.setBillIssue(bid, id, true); }", [ID, info['bill2']]); redraw(pg)
    pub = [t for t in pg.evaluate(TODO) if t.startswith('Publish a new issue')]
    ok(pub and 'It has a goal, four talking points and 2 bills.' in pub[0], f'four points and two bills are counted ({pub})')
    pg.locator('#hs ~ ul.srows3 a', has_text='Publish a new issue').first.click(); pg.wait_for_selector('#dBlock'); pg.wait_for_timeout(300)
    ok(pg.evaluate("() => location.hash").startswith(f'#/issue/{ID}') and pg.locator('#dPublicGo').count() == 1, 'the step opens the draft\'s page, which has the way in to public mode')
    # published: the step ends by itself
    pg.evaluate(SET, [ID, {'published_at': '2026-11-20T00:00:00Z'}]); go(pg, '#/')
    ok(not any('Publish a new issue' in t for t in pg.evaluate(TODO)), 'once published the step ends by itself')
    # an admin who leads a draft has Finish, not a waiting row
    AD = pg.evaluate(MAKE, ['Sample led by Nate', info['nt'], info['nt']]); go(pg, '#/')
    ok(any(t.startswith('Finish a new issue') and 'Sample led by Nate' in t for t in pg.evaluate(TODO)) and not any('Sample led by Nate' in t for t in pg.evaluate(WAIT)), 'a draft Nate leads is his own "Finish a new issue" step, not a waiting row')
    go(pg, '#/issues'); ok(pg.evaluate("() => document.querySelector('#g-drafts')?.innerText.startsWith('Drafts')"), 'and it is in his Drafts group')
    ok(not errs, f'Nate: no console or page errors ({errs[:2]})')
    ctx.close()

    # ================================================================ a phone
    pg, ctx = open_as(br, 'KV', 390, 844, '#/'); errs = ctx._errs
    iid = pg.evaluate("async () => { const d = await import('/staff6/data.js'); const i = await d.DB.createIssue({ name: 'Sample phone draft', category: d.S.categories[0].key, owner_id: d.S.me.id }); window.__staff7Render({}); return i.id; }")
    pg.wait_for_timeout(500)
    ok(pg.evaluate("() => document.documentElement.scrollWidth <= innerWidth"), 'at 390 Home has no sideways scroll with the step')
    ok(pg.locator('.sr3', has_text='Finish a new issue').count() == 1, 'at 390 the step is on Home')
    snap(pg, 'steps_finish_390.png')
    ok(not errs, f'phone: no console or page errors ({errs[:2]})')
    ctx.close()
    br.close()
print(f'{sum(res)}/{len(res)}'); sys.exit(0 if all(res) else 1)
