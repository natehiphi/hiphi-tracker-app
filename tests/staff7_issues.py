# Staff7's Issues tab (R-398), on the practice copy: whose issues (Mine, a teammate's, Everyone's), the three groups (At risk, Moving, Stopped this year), an issue's sheet, a bill's short sheet.
# Rules kept by this file: the groups partition the set; any at-risk bill puts its issue in At risk; a bill with a hearing is never at risk; Mine = myIssueIds, Everyone = every issue with a bill this session;
# a teammate's view has no link to a step; odd addresses give a calm "not found" sheet; one filled button at most; no sideways scroll; 44px targets; nothing leaves 127.0.0.1.
#   python3 tests/staff7_issues.py [base] [shots folder]     base defaults to http://127.0.0.1:8851 (serve with a 256 backlog, one server per worktree)
import sys, os, re, json
from playwright.sync_api import sync_playwright
BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8851').rstrip('/')
SHOTS = sys.argv[2] if len(sys.argv) > 2 else ''
if SHOTS: os.makedirs(SHOTS, exist_ok=True)
res = []
def ok(c, m): res.append(bool(c)); print('PASS' if c else 'FAIL', m, flush=True)

FILLED = "() => [...document.querySelectorAll('.btn.filled')].filter(b => { const r = b.getBoundingClientRect(), s = getComputedStyle(b); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && r.top < innerHeight && r.bottom > 0; }).length"
NOSIDE = "() => document.documentElement.scrollWidth <= innerWidth && [...document.querySelectorAll('.paper')].every(p => p.scrollWidth <= p.clientWidth)"
SMALL = "() => [...document.querySelectorAll('.btn, .sr3, .seg, .pk')].filter(e => e.getBoundingClientRect().width > 0 && e.getBoundingClientRect().height < 43.5).map(e => e.className + ' ' + e.innerText.slice(0, 20))"
H1 = "() => [...document.querySelectorAll('main h1')].find(h => h.getBoundingClientRect().width > 0)?.innerText.trim()"
# what the page's own rules say about a set: who is 'mine', 'all' or a teammate's initials
MODEL = """async (who) => { const d = await import('/staff6/data.js'), st = await import('/staff7/standing.js'), mo = await import('/staff6/model.js'); const S = d.S, me = S.me;
  const withMe = (p, fn) => { const prev = S.me; S.me = p; try { return fn(); } finally { S.me = prev; } };
  const has = i => !i.archived_at && st.billsOfIssue(i).length > 0;
  let ids;
  if (who === 'all') ids = S.issues.filter(has).map(i => String(i.id));
  else { const p = who === 'mine' ? me : S.advocates.find(a => a.initials === who); ids = withMe(p, () => [...d.myIssueIds()]).filter(id => has(S.issues.find(i => String(i.id) === id))); }
  const rows = ids.map(id => { const i = S.issues.find(x => String(x.id) === id), bills = st.billsOfIssue(i);
    const want = bills.some(st.isAtRisk) ? 'risk' : bills.some(st.isAlive) ? 'moving' : 'stopped'; return { id, name: i.name, want, bills: bills.length }; });
  const all = S.bills.filter(b => b.tracked !== false);
  return { rows, hearingRisk: all.filter(b => mo.hearingAhead(b) && st.isAtRisk(b)).length, hearingBills: all.filter(b => mo.hearingAhead(b)).length,
    needsFirst: S.issues.filter(has).length, people: S.advocates.filter(a => a.is_active !== false).map(a => a.initials) }; }"""
GROUPS = """() => [...document.querySelectorAll('section[aria-labelledby^="g-"]')].map(s => [s.querySelector('h3').innerText.trim().replace(/ · \\d+$/, ''), [...s.querySelectorAll('a.sr3')].map(a => decodeURIComponent(a.getAttribute('href').split('/issue/')[1].split('?')[0])), +(/ · (\\d+)$/.exec(s.querySelector('h3').innerText.trim()) || [0, -1])[1]])"""
LEFTROWS = "() => [...document.querySelectorAll('.wl a.sr3')].map(a => [a.id, a.getAttribute('aria-current'), a.getAttribute('href')])"
def left_first(pg): return pg.evaluate("() => document.querySelector('.wl .sr3').id")

def external_blocker(ctx, bad):
    def h(route):
        u = route.request.url
        if 'fonts.g' in u: return route.continue_()
        bad.append(u); route.abort()
    ctx.route(lambda u: '127.0.0.1' not in u and 'localhost' not in u, h)
def open_as(br, who, w, h, hash=''):
    ctx = br.new_context(viewport={'width': w, 'height': h}); bad = []; external_blocker(ctx, bad); pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'Failed to load resource' not in m.text and 'ERR_FAILED' not in m.text else None)
    pg.goto(f'{BASE}/staff7.html?demo=1' + (f'&as={who}' if who != 'default' else '') + hash); pg.wait_for_selector('.paper', timeout=60000)
    pg.evaluate("Promise.all([document.fonts.load('600 16px Poppins'), document.fonts.load('400 16px Lato'), document.fonts.load('700 16px Lato'), document.fonts.load('500 16px Poppins')])"); pg.wait_for_timeout(500)
    return pg, errs, bad
def go(pg, hash): pg.evaluate("h => { location.hash = h; }", hash); pg.wait_for_timeout(350)
def snap(pg, name, tag):
    if SHOTS: pg.screenshot(path=os.path.join(SHOTS, f'{name}_{tag}.png'))
def steplinks(pg): return pg.evaluate("() => document.querySelectorAll('a[href^=\"#/do/\"]').length")

PEOPLE = ['default', 'KV', 'KR', 'JS', 'JM', 'LR', 'SY', 'MR', 'JN', 'PH']
INFO = {}
with sync_playwright() as p:
    br = p.chromium.launch()
    for w, h in ((1440, 900), (1280, 800)):
        tag = f'{w}x{h}'; LABELS, OFFS, COUNTS = {}, {}, {}
        for who in PEOPLE:
            pg, errs, bad = open_as(br, who, w, h, '#/issues')
            m = pg.evaluate(MODEL, 'mine'); g = pg.evaluate(GROUPS); ids = [i for _, l, _c in g for i in l]
            ok(not errs and not bad, f'{tag} {who}: Issues opens with no console error and nothing leaving 127.0.0.1 ({errs[:1]} {bad[:1]})')
            ok(len(ids) == len(set(ids)) and set(ids) == {r['id'] for r in m['rows']}, f'{tag} {who}: Mine is exactly myIssueIds with a bill this session ({len(ids)} issues, each in one group)')
            heads = [x[0] for x in g]; ok(all(x[2] == len(x[1]) for x in g), f'{tag} {who}: each group heading carries its count ({[(x[0], x[2]) for x in g]})'); order = [k for k in ['At risk', 'Moving', 'Stopped this year'] if k in heads]
            ok(heads == order, f'{tag} {who}: the groups are {heads}, in order, an empty one not drawn')
            where = {i: k for k, l, _c in g for i in l}; want = {'risk': 'At risk', 'moving': 'Moving', 'stopped': 'Stopped this year'}
            ok(all(where[r['id']] == want[r['want']] for r in m['rows']), f'{tag} {who}: every issue is in the group its bills say (any at-risk bill: At risk; all stopped: Stopped this year)')
            ok(m['hearingBills'] > 0 and m['hearingRisk'] == 0, f'{tag} {who}: a bill with a hearing scheduled is never at risk ({m["hearingBills"]} such bills)')
            risky0 = [r for r in m['rows'] if r['want'] == 'risk']
            cur = pg.evaluate(LEFTROWS); marked = [c for c in cur if c[1]]
            ok(left_first(pg) == 'sessionRow' and pg.locator('#sessionRow b').inner_text().strip() == 'The session' and re.search(r'\w+ · \w{3}, \w{3} \d+ · (today|\d+ days?)$', pg.locator('#sessionRow .ir2').inner_text().strip()), f'{tag} {who}: the first row of the column is "The session" with its next deadline: "{pg.locator("#sessionRow .ir2").inner_text().strip()}"')
            ok(len(marked) == 1 and ((marked[0][0] == 'sessionRow') if not risky0 else marked[0][2].startswith('#/issue/' + g[0][1][0]) and g[0][0] == 'At risk'), f'{tag} {who}: the tab never opens unmarked: one row is marked ({marked[0][0] or marked[0][2][:24] if marked else None}); with an at-risk issue it is the first one')
            ok(pg.locator('main h1').count() == 1 and not re.search(r'Your \d+ issues?:|You are not on an issue yet\.$', pg.evaluate(H1) or ''), f'{tag} {who}: no count headline; the sheet opens on "{pg.evaluate(H1)}"')
            if risky0: go(pg, '#/issues/session')
            ok(pg.locator('.sess').count() == 1 and pg.locator('.here').count() == 1 and pg.locator('.sess .sd li:not(.you)').count() == 6 and 'The session' in pg.locator('.sess h2').inner_text() and pg.locator('#sessionRow').get_attribute('aria-current') == 'true', f'{tag} {who}: #/issues/session shows Home\'s session line (same six stops, "you are here") and marks its row')
            LABELS[who] = pg.evaluate("() => [...document.querySelectorAll('.sess .sd li:not(.you) b')].map(b => b.innerText.trim())"); OFFS[who] = pg.locator('.sess .sd li.off').count(); COUNTS[who] = pg.locator('.sess .sd li:not(.you)').count()
            if risky0: go(pg, '#/issues')
            ok(pg.locator('.bi[aria-current="page"]').inner_text().strip() == 'Issues', f'{tag} {who}: Issues is current in the bar')
            ok(pg.evaluate(FILLED) <= 1 and pg.evaluate(NOSIDE) and not pg.evaluate(SMALL), f'{tag} {who}: at most one filled button, no sideways scroll, 44px targets ({pg.evaluate(SMALL)[:2]})')
            risky = [r for r in m['rows'] if r['want'] == 'risk']
            ok(all('At risk · ' in pg.locator(f'a.sr3[href^="#/issue/{r["id"]}"]').inner_text() for r in risky) and pg.locator('.ir2.risk').count() == len(risky) and all(len(re.findall(r'At risk', pg.locator('.ir2.risk').nth(k).inner_text())) == 1 for k in range(len(risky))), f'{tag} {who}: only an at-risk issue has a second line ("At risk · N days left", with a mark and words) ({len(risky)})')
            if who in ('JM', 'NT', 'default', 'KV'): snap(pg, f'issues_{who}', tag)
            if who == 'KV': go(pg, '#/issues/session'); snap(pg, 'issues_session_KV', tag)
            if risky: INFO[who] = risky[0]['id']
            pg.context.close()

        # the same session line for everyone, in the one table's words; a stop that touches none of the person's bills is greyed, not removed
        ok(len({tuple(v) for v in LABELS.values()}) == 1 and len(LABELS) == len(PEOPLE) and not re.search(r'Crossover|lateral|decking|triple|2nd|1st', ' '.join(LABELS['JM']), re.I), f'{tag}: the session line shows the same six stops for all {len(LABELS)} people, in plain words ({LABELS["JM"][:2]})')
        ok(sum(1 for v in OFFS.values() if v) >= 1 and all(c == 6 for c in COUNTS.values()), f'{tag}: some people have a greyed stop and none loses one ({sorted(set(OFFS.values()))} greyed, six each)')

        # Everyone, a teammate, and the whose control
        pg, errs, bad = open_as(br, 'JM', w, h, '#/issues?who=all')
        m = pg.evaluate(MODEL, 'all'); mine = pg.evaluate(MODEL, 'mine'); mineids = {r['id'] for r in mine['rows']}; ids = [i for _, l, _c in pg.evaluate(GROUPS) for i in l]
        ok(set(ids) == {r['id'] for r in m['rows']} and len(ids) == len(set(ids)) and len(ids) == m['needsFirst'], f'{tag}: Everyone is every issue with a bill this session ({len(ids)} of {m["needsFirst"]}), each once')
        ok(pg.locator('#whoAll').get_attribute('aria-current') == 'true' and pg.locator('#whoMine').get_attribute('aria-current') is None and pg.locator('#sessionRow').get_attribute('aria-current') == 'true' and 'Look only' not in pg.locator('main').inner_text(), f'{tag}: Everyone is the chosen segment, opens on the session (marked), and says nothing about look only there')
        # fix 2: the lead's initials at the right of each row, no bill count in any list
        lead = pg.evaluate("""async () => { const d = await import('/staff6/data.js'); const out = [];
          for (const a of document.querySelectorAll('.wl section a.sr3')) { const id = decodeURIComponent(a.getAttribute('href').split('/issue/')[1].split('?')[0]), i = d.S.issues.find(x => String(x.id) === id), o = d.advocate(i.owner_id), p = a.querySelector('.person');
            out.push([!!p, p ? p.innerText.trim() : '', o && o.is_active !== false ? o.initials : '']); } return out; }""")
        ok(all((ok_ == bool(want) and (not ok_ or got == want)) for ok_, got, want in lead) and sum(1 for x in lead if x[0]) >= 1, f'{tag}: on Everyone each row shows its lead\'s initials at the right ({sum(1 for x in lead if x[0])} of {len(lead)}), as the data says')
        ok(not re.search(r'\b\d+ bills?\b', pg.locator('.wl').inner_text()), f'{tag}: no row says how many bills it has')
        snap(pg, 'issues_everyone', tag)
        ok(not errs and not bad, f'{tag}: Everyone has no console error')
        # the viewer's own issue under Everyone keeps its step links and button; someone else's is look-only
        rid = INFO['JM']; pg.click(f'a.sr3[href^="#/issue/{rid}"]'); pg.wait_for_timeout(350)
        ok('Look only' not in pg.locator('main').inner_text() and steplinks(pg) >= 1 and pg.locator('.strip .btn.filled').count() == 1 and pg.evaluate(FILLED) == 1, f'{tag}: under Everyone my own at-risk issue keeps its step link and its Ask for a hearing button, and does not say "Look only"')
        snap(pg, 'rv_all_own_risk', tag)
        other = next(i for i in ids if i not in mineids)
        pg.click(f'a.sr3[href^="#/issue/{other}"]'); pg.wait_for_timeout(350)
        ok(pg.locator('main').inner_text().count('Look only') == 1 and steplinks(pg) == 0 and pg.locator('.ymove, .stbtn').count() == 0 and 'Everyone’s issues. Look only.' in pg.locator('main').inner_text(), f'{tag}: under Everyone someone else\'s issue says "Look only" once and has no step link')
        ok(not errs and not bad, f'{tag}: no console error, nothing left the machine')
        pg.context.close()
        pg, errs, bad = open_as(br, 'JM', w, h, '#/issues?who=ALL')
        ok(pg.locator('#whoAll').get_attribute('aria-current') == 'true' and pg.locator('[data-notfound]').count() == 0, f'{tag}: who=ALL is accepted like who=all')
        pg.context.close()

        pg, errs, bad = open_as(br, 'JM', w, h, '#/issues')
        ok(pg.locator('#whoPick').is_hidden() and pg.locator('#whoMate').get_attribute('aria-expanded') == 'false', f'{tag}: the teammate picker is closed to begin with')
        pg.click('#whoMate'); pg.wait_for_timeout(200)
        names = pg.evaluate("() => [...document.querySelectorAll('#whoPick a')].map(a => a.innerText.trim())"); mm = pg.evaluate(MODEL, 'mine')
        ok(pg.locator('#whoPick').is_visible() and len(names) == len(mm['people']) - 1 and 'James' not in names and 'Kevin' in names, f'{tag}: "A teammate" opens the picker of every active person but me, by name ({len(names)})')
        ok(names == sorted(names, key=lambda x: x.lower()), f'{tag}: the picker is sorted by name ({names[:3]}...)')
        # the minute's redraw keeps the open picker, the focus and the scroll
        pg.evaluate("document.querySelector('.wl').scrollTop = 40"); pg.focus('#whoMate'); pg.evaluate('window.__staff7Tick()'); pg.wait_for_timeout(250)
        ok(pg.locator('#whoPick').is_visible() and pg.evaluate("document.activeElement.id") == 'whoMate' and pg.evaluate("document.querySelector('.wl').scrollTop") in (40, pg.evaluate("document.querySelector('.wl').scrollHeight - document.querySelector('.wl').clientHeight")), f'{tag}: the tick keeps the open picker, the focus and the scroll')
        # fix 10: choosing Mine or Everyone where you already are also closes the picker; leaving Issues resets it
        pg.click('#whoMine'); pg.wait_for_timeout(150)
        ok(pg.locator('#whoPick').is_hidden() and pg.locator('#whoMate').get_attribute('aria-expanded') == 'false', f'{tag}: Mine, while already on Mine, closes the picker')
        go(pg, '#/issues?who=all'); pg.click('#whoMate'); pg.click('#whoAll'); pg.wait_for_timeout(150)
        ok(pg.locator('#whoPick').is_hidden() and pg.locator('#whoMate').get_attribute('aria-expanded') == 'false', f'{tag}: Everyone, while already on Everyone, closes the picker')
        go(pg, '#/issues'); pg.click('#whoMate'); go(pg, '#/'); go(pg, '#/issues')
        ok(pg.locator('#whoPick').is_hidden(), f'{tag}: an open picker is closed again after leaving Issues and coming back')
        pg.click('#whoMate'); pg.click('#who-KV'); pg.wait_for_timeout(350)
        km = pg.evaluate(MODEL, 'KV'); ids = [i for _, l, _c in pg.evaluate(GROUPS) for i in l]
        ok('who=KV' in pg.url and set(ids) == {r['id'] for r in km['rows']} and pg.locator('#whoPick').is_hidden() and 'Kevin' in pg.locator('.ihd').inner_text(), f'{tag}: picking Kevin puts him in the address and shows his {len(ids)} issues')
        ok(pg.locator('#whoChange').is_visible() and pg.locator('#whoChange').inner_text().strip() == 'Change' and pg.locator('.ihd').inner_text().strip() == 'Kevin’s issues' and pg.locator('#sessionRow').get_attribute('aria-current') == 'true', f'{tag}: Kevin\'s heading carries a small "Change" link; the tab opens on the session')
        pg.click('#whoChange'); pg.wait_for_timeout(150)
        ok(pg.locator('#whoPick').is_visible() and pg.locator('#whoMate').get_attribute('aria-expanded') == 'true', f'{tag}: "Change" reopens the picker')
        pg.click('#who-KV'); pg.wait_for_timeout(250)
        kother = next(i for i in ids if i not in mineids)
        pg.click(f'a.sr3[href^="#/issue/{kother}"]'); pg.wait_for_timeout(350)
        ok('Kevin’s issues. Look only.' in pg.locator('main').inner_text() and pg.locator('main').inner_text().count('Look only') == 1 and steplinks(pg) == 0, f'{tag}: Kevin\'s issue that is not mine says "Kevin’s issues. Look only." once, and has no step link')
        snap(pg, 'issues_teammate', tag)
        pg.go_back(); pg.wait_for_timeout(350); pg.go_forward(); pg.wait_for_timeout(350)
        ok('who=KV' in pg.url and pg.locator('#whoMate').get_attribute('aria-current') == 'true', f'{tag}: Back and Forward keep the whose choice')
        pg.reload(); pg.wait_for_selector('.paper'); pg.wait_for_timeout(500)
        ok('who=KV' in pg.url and 'Kevin' in pg.locator('.ihd').inner_text(), f'{tag}: a reload keeps Kevin')
        pg.locator('.bn2').first.click(); pg.wait_for_timeout(350)
        ok('#/bill/' in pg.url and 'who=KV' in pg.url and steplinks(pg) == 0 and pg.locator('.ymove').count() == 0 and 'Look only' in pg.locator('main').inner_text(), f'{tag}: Kevin\'s bill sheet is look-only too')
        ok(not errs and not bad, f'{tag}: no console error, nothing left the machine')
        pg.context.close()
        # Kevin's issue that is also mine keeps its step links (look-only depends on the issue, not the view)
        pg, errs, bad = open_as(br, 'JM', w, h, '#/issues?who=KV')
        both = [i for i in [i for _, l, _c in pg.evaluate(GROUPS) for i in l] if i in mineids]
        ok(not both or (lambda: (pg.click(f'a.sr3[href^="#/issue/{both[0]}"]'), pg.wait_for_timeout(350), 'Look only' not in pg.locator('main').inner_text())[-1])(), f'{tag}: an issue that is Kevin\'s and mine ({len(both)}) does not say "Look only"')
        pg.context.close()

        # JM's own at-risk issue: the sheet, its one thing to do, the bill sheet
        pg, errs, bad = open_as(br, 'JM', w, h, '#/issues')
        rid = INFO['JM']; pg.click(f'a.sr3[href^="#/issue/{rid}"]'); pg.wait_for_timeout(350)
        ok(pg.locator(f'a.sr3[href^="#/issue/{rid}"]').get_attribute('aria-current') == 'true' and pg.locator('a.sr3[aria-current="true"]').count() == 1, f'{tag} JM: the picked issue\'s row is marked open, only one')
        ok(pg.locator('.strip.risk').count() >= 1 and pg.locator('.stbtn').count() >= 1 and pg.locator('.stbtn').first.inner_text().strip().startswith('Ask for a'), f'{tag} JM: the at-risk bill\'s one thing to do is its Ask for a hearing step ("{pg.locator(".stbtn").first.inner_text().strip() if pg.locator(".stbtn").count() else ""}")')
        href = pg.locator('.stbtn').first.get_attribute('href')
        ok(href.startswith('#/do/ask-') and pg.locator('.brow').count() >= 1 and pg.locator('.brow svg.trk.row').count() == pg.locator('.brow').count() and pg.locator('.ymove').count() == 0, f'{tag} JM: each bill is a row with one path drawing; the ask is not said twice ({href[:30]})')
        # fix 4: the banner's button is the page's one filled button
        ok(pg.locator('.stbtn').first.get_attribute('class').split().count('filled') == 1 and pg.evaluate(FILLED) == 1 and pg.evaluate(NOSIDE) and not pg.evaluate(SMALL) and 'Look only' not in pg.locator('main').inner_text(), f'{tag} JM: "Ask for a hearing" is the page\'s one filled button; no sideways scroll, 44px, no look-only words on my own issue')
        # fix 5: say it once, one time form; fix 3: a bill named like its issue is named by number and place
        strip = pg.locator('.strip.risk strong').inner_text().strip(); h1i = pg.evaluate(H1)
        ok(re.fullmatch(r'Needs a hearing by \w{3}, \w{3} \d+ · \d+ days?', strip) and pg.locator('.brow').count() == 1 and pg.locator('.brow .bst').count() == 0, f'{tag} JM: the banner says "{strip}" once; the issue\'s one bill does not say it again')
        bn = pg.locator('.bn2').first.inner_text().strip()
        ok(re.fullmatch(r'[A-Z]+ ?\d+ · in .+', bn) and bn != h1i and pg.locator('.bn2 .bno').count() == 0, f'{tag} JM: a bill named like its issue shows its number and where it is ("{bn}"), not the name again')
        # fix 9: the path's dots carry their names (a title on hover and a hidden list)
        ok(pg.locator('.brow svg.trk.row circle title').count() == 5 and 'Introduced' in pg.locator('.brow .bpath .sr').inner_text() and 'Governor' in pg.locator('.brow .bpath .sr').inner_text() and 'Crossed to the other chamber' in pg.locator('.brow .bpath .sr').inner_text(), f'{tag} JM: each path dot has its name on hover, and the whole path is in hidden text')
        snap(pg, 'issue_sheet_atrisk_JM', tag)
        pg.locator('.bn2').first.click(); pg.wait_for_timeout(350)
        ok('#/bill/' in pg.url and pg.locator('main h1').inner_text().strip() and pg.locator('.bsub').inner_text().strip() and pg.locator(f'a.sr3[href^="#/issue/{rid}"]').get_attribute('aria-current') == 'true', f'{tag} JM: a bill opens from its row; name first ("{pg.locator("main h1").inner_text().strip()[:30]}"), number after, the issue still marked open')
        txt = pg.locator('main').inner_text()
        ok(all(x in txt for x in ('Where it stands', 'Just happened', 'Next', 'After that')) and not re.search(r'capitol\.hawaii|Public site|public page', txt + pg.inner_html('main'), re.I) and pg.locator('main a[target], main input, main textarea, main select').count() == 0, f'{tag} JM: the bill sheet reads where it stands, has no controls and no link to the public site or the Capitol')
        # fix 4, 5: "Your move" is a quiet button right under the position line; the sheet does not restate the banner
        ymp = pg.evaluate("() => { const m = document.querySelector('.ymove'), l = document.querySelector('main .pbody > .lead'), h = document.querySelector('main h2.sh'); if (!m) return null; return [m.className, m.getBoundingClientRect().top - l.getBoundingClientRect().bottom, h.getBoundingClientRect().top - m.getBoundingClientRect().bottom]; }")
        ok(ymp and 'btn' in ymp[0] and 'quiet' in ymp[0] and 'text' not in ymp[0].split() and 0 <= ymp[1] < 40 and ymp[2] > 0 and pg.locator('.strip').count() == 0 and 'Without a hearing' not in txt and 'none is set' not in txt, f'{tag} JM: "Your move" is a quiet button right under the position line, and the bill sheet has no banner of its own ({ymp})')
        nxt = pg.evaluate("() => [...document.querySelectorAll('.kv > div')].map(d => [d.querySelector('dt').innerText, d.querySelector('dd').innerText])")
        ok(re.fullmatch(r'A hearing by \w{3}, \w{3} \d+ · \d+ days?', dict(nxt)['Next']) and dict(nxt)['After that'] and not dict(nxt)['After that'].startswith('Its next committee'), f'{tag} JM: Next reads "{dict(nxt)["Next"]}" (one time form) and After that is specific ("{dict(nxt)["After that"]}")')
        snap(pg, 'bill_sheet', tag)
        ok(pg.locator('.crumb.back2').inner_text().strip().startswith('Back to'), f'{tag} JM: the bill sheet\'s back link says where it goes ("{pg.locator(".crumb.back2").inner_text().strip()}")')
        pg.click('.crumb.back2'); pg.wait_for_timeout(350)
        ok(f'#/issue/{rid}' in pg.url and 'who=' not in pg.url, f'{tag} JM: the bill\'s back link goes to its issue')
        ok(not errs and not bad, f'{tag} JM: no console error, nothing left the machine')
        pg.context.close()

        # a stopped issue and a stopped bill, and a moving bill with a hearing
        pg, errs, bad = open_as(br, 'JM', w, h, '#/issues')
        sid = pg.evaluate(GROUPS)[-1][1][0]; ok(pg.evaluate(GROUPS)[-1][0] == 'Stopped this year', f'{tag} JM: there is a stopped issue to open')
        pg.click(f'a.sr3[href^="#/issue/{sid}"]'); pg.wait_for_timeout(350)
        st_txt = pg.locator('main').inner_text()
        ok('Stopped for this year' in pg.locator('.hband .bsub').inner_text() and 'Nothing more can happen' not in st_txt and 'None of its' not in st_txt and 'Did not advance' in st_txt and pg.locator('.strip').count() == 0 and not re.search(r'\bdead\b|\bdied\b|\bkilled\b|vape', st_txt, re.I), f'{tag} JM: a stopped issue\'s band says "Stopped for this year", it lists its bills under Did not advance, in S-7 words')
        snap(pg, 'issue_sheet_stopped', tag)
        pg.locator('.bn2').first.click(); pg.wait_for_timeout(350)
        b_txt = pg.locator('main').inner_text(); why = dict(pg.evaluate("() => [...document.querySelectorAll('.kv > div')].map(d => [d.querySelector('dt').innerText, d.querySelector('dd').innerText])")).get('Why', '')
        ok(pg.locator('main h2.sh').first.inner_text().strip() == 'Did not advance' and why and pg.locator('svg.trk.dead').count() >= 1, f'{tag} JM: a stopped bill says where it stopped and why, and its path ends in a bar')
        ok(not re.search(r'\d+/\d+/\d+|Lateral|Decking|Triple', why) and (re.search(r'\w{3}, \w{3} \d+', why) or 'Failed' in why or 'Not adopted' in why or 'Deferred' in why or why.endswith('Stopped.') or 'Missed' in why), f'{tag} JM: "Why" uses plain words and dates like "Fri, Feb 20" ("{why}")')
        snap(pg, 'bill_sheet_stopped', tag)
        ok(not errs and not bad, f'{tag} JM stopped: no console error')
        pg.context.close()
        # fix 3 and 5 across every issue: a stopped bill's "Still alive" leads with number and chamber; no row repeats its issue's name; no m/d/yy anywhere
        if w == 1440:
            pg, errs, bad = open_as(br, 'JM', w, h, '#/issues?who=all')
            allids = [i for _, l, _c in pg.evaluate(GROUPS) for i in l]; dupes = []; olds = []; alive_refs = []
            for iid in allids:
                go(pg, f'#/issue/{iid}?who=all'); h1x = pg.evaluate(H1)
                dupes += [t for t in pg.evaluate("() => [...document.querySelectorAll('.bn2')].map(a => a.innerText.trim())") if t == h1x]
                if re.search(r'\d+/\d+/\d+', pg.locator('main').inner_text()): olds.append(iid)
                if pg.locator('.dh').count() and pg.locator('.brows').count() == 2 and len(alive_refs) < 3: alive_refs.append(iid)
            ok(not dupes and not olds, f'{tag}: across all {len(allids)} issues no bill row repeats its issue\'s name ({dupes[:1]}) and no date reads m/d/yy ({olds[:1]})')
            sa = []
            for iid in alive_refs:
                go(pg, f'#/issue/{iid}?who=all'); pg.locator('.brow.dead .bn2').first.click(); pg.wait_for_timeout(300)
                sa += [a.strip() for a in pg.evaluate("() => [...document.querySelectorAll('.kv a.lk')].map(a => a.innerText)")]
            ok(sa and all(re.fullmatch(r'[A-Z]+ ?\d+, the (House|Senate) version · .+', a) for a in sa), f'{tag}: a stopped bill\'s "Still alive" leads with number and chamber ({sa[:2]})')
            pg.context.close()

        # by address
        pg, errs, bad = open_as(br, 'JM', w, h, f'#/issue/{INFO["JM"]}')
        ok(pg.locator('main h1').count() == 1 and pg.locator(f'a.sr3[href^="#/issue/{INFO["JM"]}"]').get_attribute('aria-current') == 'true', f'{tag}: an issue opens by its address, its row marked')
        pg.context.close()

        # hostile, odd, missing and encoded ids
        pg, errs, bad = open_as(br, 'JM', w, h, '#/issues')
        bads = ['#/issue/', '#/bill/', '#/issue', '#/bill', '#/issues/x', '#/issues/session/x', '#/issues/%E0%A4%A', '#/issue/%E0%A4%A', '#/issue/<script>alert(1)</script>', '#/issue/__proto__', '#/issue/constructor', '#/issue/' + 'x' * 3000, '#/issue/%00', '#/issue/..%2F..%2Fetc', "#/issue/'\"><img src=x onerror=alert(1)>",
                '#/bill/%E0%A4%A', '#/bill/__proto__', '#/bill/HB999999', '#/bill/<img src=x onerror=alert(1)>', '#/bill/2026/%3Cb%3E', '#/bill/' + 'y' * 3000, '#/bill/HB1?who=__proto__', '#/issues?who=%3Cimg%20src%3Dx%3E', '#/issues?who=constructor', '#/issues?who=' + 'z' * 3000, '#/issues?who=%E0%A4%A']
        for hsh in bads:
            go(pg, hsh)
            nf = pg.locator('[data-notfound]').count() == 1 and pg.locator('main h1').count() == 1 and pg.locator('.back, .btn.text').count() >= 1
            inj = pg.evaluate("() => document.querySelectorAll('#app img, #app script').length")
            ok(nf and inj == 0 and not errs, f'{tag}: "{hsh[:40]}" gives a calm sheet, nothing injected, no crash')
        go(pg, '#/issues'); ok(pg.locator('.sr3.ir').count() > 0 and not errs, f'{tag}: and the list is still there afterwards')
        pg.context.close()

    # phone: the list, then the picked thing in one column, with Back to Issues
    pg, errs, bad = open_as(br, 'JM', 390, 844, '#/issues')
    ok(pg.evaluate(NOSIDE) and pg.locator('.wl').is_visible() and pg.locator('.back').count() == 0 and not pg.evaluate(SMALL) and left_first(pg) == 'sessionRow', f'phone: the list, The session first, no sideways scroll, no Back link yet, 44px ({pg.evaluate(SMALL)[:2]})')
    snap(pg, 'issues_phone', '390x844')
    pg.click('#sessionRow'); pg.wait_for_timeout(400)
    ok(pg.locator('.wl').is_hidden() and 'session' in pg.url and pg.locator('.back').inner_text().strip() == 'Back to Issues' and pg.locator('.sess').is_visible(), 'phone: The session opens alone with its line and Back to Issues')
    snap(pg, 'issues_session_phone', '390x844')
    pg.click('.back'); pg.wait_for_timeout(400)
    pg.click(f'a.sr3[href^="#/issue/{INFO["JM"]}"]'); pg.wait_for_timeout(400)
    ok(pg.locator('.wl').is_hidden() and pg.locator('.back').inner_text().strip() == 'Back to Issues' and pg.evaluate(NOSIDE) and not pg.evaluate(SMALL), f'phone: an issue shows alone with "Back to Issues", no sideways scroll ({pg.evaluate(SMALL)[:2]})')
    snap(pg, 'issue_sheet_phone', '390x844')
    pg.locator('.bn2').first.click(); pg.wait_for_timeout(400)
    backs = pg.evaluate("() => [...document.querySelectorAll('.back, .crumb.back2')].filter(e => e.getBoundingClientRect().width > 0).map(e => e.innerText.trim())")
    ok(pg.evaluate(NOSIDE) and pg.locator('svg.trk.row').first.is_visible() and pg.locator('svg.trk.wide').first.is_hidden(), 'phone: a bill sheet fits, its path is the compact one')
    ok(len(backs) == 1 and backs[0].startswith('Back to ') and backs[0] != pg.evaluate(H1) and not pg.evaluate(SMALL), f'phone: a bill sheet has one back link, labelled with where it goes ({backs})')
    snap(pg, 'bill_sheet_phone', '390x844')
    pg.click('.crumb.back2'); pg.wait_for_timeout(400)
    ok(f'#/issue/{INFO["JM"]}' in pg.url and pg.locator('.back').inner_text().strip() == 'Back to Issues', 'phone: that link goes to the issue, which has Back to Issues')
    pg.click('.back'); pg.wait_for_timeout(400)
    ok(pg.locator('.wl').is_visible() and pg.locator('.sr3.ir').count() > 0 and not errs and not bad, 'phone: Back to Issues returns to the list; no errors')
    pg.context.close()

    # Home's "Your issues" fact lands on Mine
    pg, errs, bad = open_as(br, 'JM', 1440, 900, '#/')
    pg.locator('a.fact', has_text='Your issues').click(); pg.wait_for_timeout(350)
    ok(pg.url.endswith('#/issues') and pg.locator('#whoMine').get_attribute('aria-current') == 'true', 'Home\'s "Your issues" fact lands on Mine')
    pg.context.close()
    br.close()

passed = sum(res); print(f'\n{passed}/{len(res)} passed'); sys.exit(0 if passed == len(res) else 1)
