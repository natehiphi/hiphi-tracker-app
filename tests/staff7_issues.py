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

    # the session page (R-398): the answer first, the dates, the next deadline's bills, the next 7 days, what moved
    SHOTS2 = '/private/tmp/claude-501/-Users-natehix--claude-spares-spare-fovE59/8642821d-b00a-4c8c-9765-481aee29b7f7/scratchpad/shots2'; os.makedirs(SHOTS2, exist_ok=True)
    WEEKX = """async (who) => { const d = await import('/staff6/data.js'), st = await import('/staff7/standing.js'), S = d.S;
      const withMe = (p, fn) => { const prev = S.me; S.me = p; try { return fn(); } finally { S.me = prev; } };
      const has = i => !i.archived_at && st.billsOfIssue(i).length > 0;
      let ids, mate = null; if (who === 'all') ids = S.issues.filter(has).map(i => String(i.id)); else { const p = who === 'mine' ? S.me : S.advocates.find(a => a.initials === who); if (who !== 'mine') mate = p; ids = withMe(p, () => [...d.myIssueIds()]).filter(id => has(S.issues.find(i => String(i.id) === id))); }
      const seen = new Set(), bills = []; for (const id of ids) for (const b of st.billsOfIssue(S.issues.find(i => String(i.id) === id))) if (!seen.has(b.id)) { seen.add(b.id); bills.push(b); }
      const HST = { timeZone: 'Pacific/Honolulu' }, ymd = t => new Date(t).toLocaleDateString('en-CA', HST), noon = s => Date.parse(s + 'T12:00:00-10:00');
      const idx = s => Math.round((noon(String(s).slice(0, 10)) - noon(ymd(Date.now()))) / 864e5), num = b => String(b.bill_number).replace(/\\s/g, '');
      const by = new Map(bills.filter(st.isAlive).map(b => [b.id, b])), dd = new Set();
      const hs = S.hearings.filter(h => h.status === 'scheduled' && by.has(h.bill_id) && idx(ymd(h.scheduled_at)) >= 0 && idx(ymd(h.scheduled_at)) <= 6 && !dd.has(h.bill_id + '|' + h.scheduled_at) && dd.add(h.bill_id + '|' + h.scheduled_at)).sort((x, y) => new Date(x.scheduled_at) - new Date(y.scheduled_at) || num(by.get(x.bill_id)).localeCompare(num(by.get(y.bill_id)), 'en', { numeric: true }));
      const risk = bills.filter(b => st.isAlive(b) && st.isAtRisk(b)).map(num);
      const act = b => String(b.last_action || ''), moved = bills.filter(b => b.last_action_date && idx(b.last_action_date) >= -6 && idx(b.last_action_date) <= 0 && !/has scheduled a public hearing|to be heard by|will hold a public decision making|has rescheduled|deleted from the meeting|^Meeting scheduled on|hours? notice|day notice/i.test(act(b))).sort((x, y) => String(y.last_action_date).localeCompare(String(x.last_action_date)) || num(x).localeCompare(num(y), 'en', { numeric: true }));
      const leads = n => { const b = bills.find(x => num(x) === n), out = new Set(); (S.assignments?.[b.id] || []).forEach(id => out.add(id)); S.billIssues.filter(x => x.bill_id === b.id).forEach(x => { const i = S.issues.find(y => y.id === x.issue_id); if (i?.owner_id) out.add(i.owner_id); }); return [...out].map(id => S.advocates.find(a => a.id === id)?.initials).filter(Boolean); };
      return { total: bills.length, alive: bills.filter(st.isAlive).length, risk, hear: hs.map(h => num(by.get(h.bill_id))), days: [...new Set(hs.map(h => ymd(h.scheduled_at)))], moved: moved.map(num), mateInit: mate ? mate.initials : '', mateFirst: mate ? mate.full_name.split(' ')[0] : '', leads: Object.fromEntries(bills.map(b => [num(b), leads(num(b))])) }; }"""
    SESS = """() => { const q = s => document.querySelector(s), norm = t => String(t).replace(/[\\u00a0\\u202f]/g, ' ');
      const rows = sel => [...document.querySelectorAll(sel)].map(li => ({ no: li.querySelector('.no').innerText.replace(/\\s/g, ''), name: li.querySelector('b').innerText, hid: li.hidden, face: li.querySelector('.person')?.innerText || '', href: li.querySelector('a.sr3').getAttribute('href'), amber: !!li.querySelector('.ir2.risk'), late: !!li.querySelector('.ir2.late'), text: norm(li.innerText), tag: li.querySelector('a.sr3').tagName }));
      const pos = (a, b) => { const x = q(a), y = q(b); return x && y ? !!(x.compareDocumentPosition(y) & 4) : null; };
      return { label: q('.ovdate')?.innerText.trim(), h1: q('main h1')?.innerText.trim(), sub: q('.ovsub')?.innerText.trim(), heads: [...document.querySelectorAll('.pn h2')].map(h => norm(h.innerText.trim())), dayHeads: [...document.querySelectorAll('#sHear h3')].map(h => h.innerText.trim()),
        touch: rows('#sTouch li'), risk: rows('#sRisk li'), hear: rows('#sHear li'), moved: rows('#sMoved li'), more: q('#sMore')?.innerText.trim() || '', moreTag: q('#sMore')?.tagName || '', noHear: q('#sNoHear')?.innerText.trim() || '', text: norm(q('main').innerText), nextH: norm(q('#sNext')?.innerText || ''),
        order: [pos('main h1', '.sess'), pos('.sess', '#sNext'), pos('#sNext', '#sHearH'), pos('#sHearH', '#sMovedH')], riskt: document.querySelectorAll('.riskt, .tlist').length }; }"""
    def fullshots(pg, name):
        sc = pg.evaluate_handle("() => { const c = [...document.querySelectorAll('main, .wp, .paper, .pn')].filter(e => e.scrollHeight > e.clientHeight + 8 && getComputedStyle(e).overflowY !== 'visible'); return c[0] || document.scrollingElement; }")
        hh = pg.evaluate("e => e.clientHeight", sc); tot = pg.evaluate("e => e.scrollHeight", sc); y = 0; k = 1
        while True:
            pg.evaluate("([e, y]) => { e.scrollTop = y; }", [sc, y]); pg.wait_for_timeout(120); pg.screenshot(path=os.path.join(SHOTS2, f'{name}_{k}.png'))
            if y + hh >= tot - 2: break
            y += hh - 80; k += 1
        pg.evaluate("e => { e.scrollTop = 0; }", sc)
    for w, h in ((1440, 900), (1280, 800)):
        tag = f'{w}x{h}'
        for who, hsh, key, nm in (('JM', '#/issues/session', 'mine', 'JM Mine'), ('KR', '#/issues/session', 'mine', 'KR Mine'), ('KV', '#/issues/session', 'mine', 'KV Mine'), ('JM', '#/issues/session?who=all', 'all', 'Everyone'), ('JM', '#/issues/session?who=KR', 'KR', 'KR seen by JM')):
            pg, errs, bad = open_as(br, who, w, h, hsh)
            x = pg.evaluate(WEEKX, key); s = pg.evaluate(SESS)
            whose = {'mine': 'your bills', 'all': 'everyone’s bills'}.get(key, f'{x["mateFirst"]}’s bills')
            want = (f'{len(x["risk"])} bill{"" if len(x["risk"]) == 1 else "s"} at risk' if x['risk'] else 'Nothing at risk') + ' · ' + (f'{len(x["hear"])} hearing{"" if len(x["hear"]) == 1 else "s"}' if x['hear'] else 'no hearings') + ' in the next 7 days'
            ok(s['h1'] == want and s['sub'] == f'{x["alive"]} of {x["total"]} bills still alive', f'{tag} {nm}: the h1 answers "{want}" with "{x["alive"]} of {x["total"]} bills still alive" under it (page: "{s["h1"]}" / "{s["sub"]}")')
            ok(s['label'] == ('The session' if key == 'mine' else f'The session · {whose}'), f'{tag} {nm}: the label says whose ("{s["label"]}")')
            ok(all(s['order'][:3]) and (s['order'][3] or not x['moved']) and s['heads'][0].startswith('The session') and s['heads'][1].startswith('Next deadline: ') and 'Next 7 days' in s['heads'], f'{tag} {nm}: order is answer, the dates, next deadline, next 7 days, moved ({s["order"]} {s["heads"][:3]})')
            # the next deadline's list: each bill once, at-risk first; Also at risk holds the rest; no bill twice
            t_nos = [r['no'] for r in s['touch']]; r_nos = [r['no'] for r in s['risk']]; amber_t = [r['amber'] for r in s['touch']]
            ok(len(set(t_nos)) == len(t_nos) and amber_t == sorted(amber_t, reverse=True) and not set(t_nos) & set(r_nos) and set(r_nos) | {r['no'] for r in s['touch'] if r['amber']} == set(x['risk']) and all(r['text'].count('At risk · needs a hearing') == 1 for r in s['touch'] if r['amber']), f'{tag} {nm}: Next deadline lists each bill once, at-risk first; Also at risk holds the other at-risk bills ({len(t_nos)} + {len(r_nos)}; {len(x["risk"])} at risk)')
            ok((('Also at risk' in s['heads']) == bool(r_nos)) and all(re.search(r'Needs a hearing by \w{3}, \w{3} \d+ · (today|\d+ days?)$', r['text']) for r in s['risk']) and all(not re.search(r'\w{3}, \w{3} \d+', r['text']) for r in s['touch'] if r['amber']), f'{tag} {nm}: Also at risk gives the date; the next-deadline rows do not repeat it')
            # the hearings: all of them, under their days
            ok([r['no'] for r in s['hear']] == x['hear'] and all(re.fullmatch(r'\w{3}, \w{3} \d+', d) for d in s['dayHeads']) and len(s['dayHeads']) == len(x['days']), f'{tag} {nm}: Next 7 days lists all {len(x["hear"])} hearings in order under {len(x["days"])} days')
            if x['hear']:
                ok(all(re.search(r'\d{1,2}:\d\d [AP]M · .+', r['text']) and re.search(r'Testimony (due|was due) \w{3}[ ,]', r['text']) for r in s['hear']) and all(r['late'] == ('Testimony was due' in r['text']) for r in s['hear']), f'{tag} {nm}: each hearing has its time, committee and testimony line')
            else:
                ok(s['noHear'] == f'No hearings for {whose} in the next 7 days.', f'{tag} {nm}: an empty week reads calmly ("{s["noHear"]}")')
            # moved
            k = len(x['moved']); vis = [r for r in s['moved'] if not r['hid']]
            ok([r['no'] for r in s['moved']] == x['moved'] and len(vis) == min(5, k) and (s['more'] == f'Show {k - 5} more' and s['moreTag'] == 'BUTTON' if k > 5 else not s['more']) and (('Moved in the last 7 days' in s['heads']) == bool(k)), f'{tag} {nm}: Moved lists {k} bills newest first, shows {len(vis)}, button "{s["more"]}"')
            ok(not re.search(r'\band \d+ more\b', s['text']) and 'this week' not in s['text'] and not re.search(r'vap(e|es|ing)\b', s['text'], re.I) and not re.search(r'Hearing set|Decision making set|Hearing notice', ' '.join(r['text'] for r in s['moved'])) and not re.search(r'Referred to', ' '.join(r['text'] for r in s['moved'])), f'{tag} {nm}: no dead "and N more", no "this week", no "vape", no hearing notices or raw referrals in Moved')
            if k > 5:
                pg.click('#sMore'); pg.wait_for_timeout(200); s2 = pg.evaluate(SESS)
                ok(len([r for r in s2['moved'] if not r['hid']]) == k and not s2['more'] and pg.locator('#sMoved li:visible').count() == k, f'{tag} {nm}: Show {k - 5} more opens the rest in place')
            # faces
            rows = s['touch'] + s['risk'] + s['hear'] + s['moved']; fs = [r for r in rows if r['face']]
            if key == 'mine': okf = not fs
            elif key == 'all': okf = all(r['face'] in x['leads'][r['no']] for r in fs) and all((r['face'] != '') == bool(x['leads'][r['no']]) for r in rows)
            else: okf = all(r['face'] in x['leads'][r['no']] and r['face'] != x['mateInit'] for r in fs)
            ok(okf, f'{tag} {nm}: faces ({len(fs)} of {len(rows)} rows): ' + ('none on Mine' if key == 'mine' else 'on Everyone every row has its lead' if key == 'all' else f'only a lead other than {x["mateInit"]}'))
            # rows are whole links to real bill pages
            hrs = list(dict.fromkeys(r['href'] for r in rows))[:6]; bad_l = []
            for hr in hrs:
                go(pg, hr)
                if pg.locator('[data-notfound]').count() or pg.locator('main h2.sh', has_text='Where it stands').count() + pg.locator('main h2.sh', has_text='Did not advance').count() == 0: bad_l.append(hr)
            ok(not bad_l and all(r['tag'] == 'A' for r in rows), f'{tag} {nm}: rows are whole links; {len(hrs)} tried, bad: {bad_l[:1]}')
            go(pg, hsh)
            ok(pg.evaluate(FILLED) == 0 and pg.evaluate(NOSIDE) and not pg.evaluate(SMALL) and not errs and not bad, f'{tag} {nm}: no filled button, no sideways scroll, 44px rows, no console error ({pg.evaluate(SMALL)[:1]})')
            if w == 1440: fullshots(pg, nm.replace(' ', '_'))
            pg.context.close()
    # hand-made data with fixed dates, so the windows are checked without the page's own code: +6 days counts and +7 does not, -6 counts and -7 does not, a dead bill's hearing and a duplicate do not count twice, past-due testimony says so
    pg, errs, bad = open_as(br, 'JM', 1440, 900, '#/issues')
    INJ = """async () => { const d = await import('/staff6/data.js'), st = await import('/staff7/standing.js'), S = d.S, now = Date.now(), DAY = 864e5;
      const mine = [...d.myIssueIds()].map(id => S.issues.find(i => String(i.id) === id)).filter(Boolean), issue = mine.find(i => st.billsOfIssue(i).some(st.isAlive)), base = st.billsOfIssue(issue).find(st.isAlive), dead = S.bills.find(b => !st.isAlive(b) && b.tracked !== false);
      const ymd = t => new Date(t).toLocaleDateString('en-CA', { timeZone: 'Pacific/Honolulu' });
      const mk = (id, no, extra, from = base) => { const b = { ...from, id, bill_number: no, tracked: true, last_action: 'Passed Second Reading', last_action_date: ymd(now - 30 * DAY), ...extra }; S.bills.push(b); S.billIssues.push({ bill_id: id, issue_id: issue.id }); return b; };
      mk('t-6', 'HB9901', {}); mk('t-7', 'HB9902', {}); mk('t-d', 'HB9903', {}, dead); mk('t-dup', 'HB9904', {}); mk('t-m6', 'HB9905', { last_action_date: ymd(now - 6 * DAY) }); mk('t-m7', 'HB9906', { last_action_date: ymd(now - 7 * DAY) }); mk('t-early', 'HB9907', {});
      const H = (id, bill, at, due) => S.hearings.push({ id, bill_id: bill, scheduled_at: new Date(at).toISOString(), status: 'scheduled', committee: 'JDC', room: '325', testimony_deadline: due == null ? null : new Date(due).toISOString() });
      H('h6', 't-6', now + 6 * DAY); H('h7', 't-7', now + 7 * DAY); H('hd', 't-d', now + 2 * DAY); H('hu1', 't-dup', now + 2 * DAY, now - 36e5); H('hu2', 't-dup', now + 2 * DAY, now - 36e5);
      H('he', 't-early', Date.parse(ymd(now) + 'T00:01:00-10:00'));
      return true; }"""
    pg.evaluate(INJ); go(pg, '#/issues?who=all'); go(pg, '#/issues/session?who=all'); s = pg.evaluate(SESS)
    hn = [r['no'] for r in s['hear']]; mv = [r['no'] for r in s['moved']]
    ok('HB9901' in hn and 'HB9902' not in hn, f'hand-made: a hearing at +6 days is in Next 7 days, one at +7 days is not')
    ok('HB9903' not in hn and hn.count('HB9904') == 1, f'hand-made: a dead bill\'s hearing is left out; a duplicate hearing shows once ({hn.count("HB9904")})')
    ok('HB9907' in hn, 'hand-made: a hearing from earlier today stays in the list')
    late = [r for r in s['hear'] if r['no'] == 'HB9904']; ok(late and late[0]['late'] and 'Testimony was due' in late[0]['text'], 'hand-made: past-due testimony says "Testimony was due" in the late style')
    ok([r for r in s['hear'] if r['no'] == 'HB9901'][0]['text'].count('Testimony due') == 1 and not [r for r in s['hear'] if r['no'] == 'HB9901'][0]['late'], 'hand-made: testimony not yet due says "Testimony due"')
    ok('HB9905' in mv and 'HB9906' not in mv, 'hand-made: a move at -6 days is in Moved, one at -7 days is not')
    ok(s['h1'].split(' · ')[-1].startswith(f'{len(s["hear"])} hearing') and not errs, f'hand-made: the h1 counts the hearings listed ({len(s["hear"])})')
    # an empty week: take every hearing away
    pg.evaluate("async () => { const d = await import('/staff6/data.js'); d.S.hearings.length = 0; }"); go(pg, '#/issues?who=all'); go(pg, '#/issues/session?who=all'); s = pg.evaluate(SESS)
    ok(s['noHear'] == 'No hearings for everyone’s bills in the next 7 days.' and s['h1'].endswith(' · no hearings in the next 7 days') and not s['hear'] and not errs, f'an empty week reads calmly ("{s["h1"]}" / "{s["noHear"]}")')
    pg.context.close()
    # a teammate with no hearings: the same words for "your bills"
    pg, errs, bad = open_as(br, 'JM', 1440, 900, '#/issues'); pg.evaluate("async () => { const d = await import('/staff6/data.js'); d.S.hearings.length = 0; }"); go(pg, '#/issues?who=all'); go(pg, '#/issues/session?who=all')
    ok(pg.evaluate(SESS)['noHear'] == 'No hearings for everyone’s bills in the next 7 days.' and re.search(r'no hearings in the next 7 days', pg.evaluate(SESS)['h1']), 'an empty week on Everyone: calm and consistent'); go(pg, '#/issues/session'); ok(pg.evaluate(SESS)['noHear'] == 'No hearings for your bills in the next 7 days.', 'an empty week on Mine: "No hearings for your bills in the next 7 days."'); pg.context.close()

    # phone: the list, then the picked thing in one column, with Back to Issues
    pg, errs, bad = open_as(br, 'JM', 390, 844, '#/issues')
    ok(pg.evaluate(NOSIDE) and pg.locator('.wl').is_visible() and pg.locator('.back').count() == 0 and not pg.evaluate(SMALL) and left_first(pg) == 'sessionRow', f'phone: the list, The session first, no sideways scroll, no Back link yet, 44px ({pg.evaluate(SMALL)[:2]})')
    snap(pg, 'issues_phone', '390x844')
    pg.click('#sessionRow'); pg.wait_for_timeout(400)
    ok(pg.locator('.wl').is_hidden() and 'session' in pg.url and pg.locator('.back').inner_text().strip() == 'Back to Issues' and pg.locator('.sess').is_visible(), 'phone: The session opens alone with its line and Back to Issues')
    snap(pg, 'issues_session_phone', '390x844'); fullshots(pg, 'JM_Mine_phone_390x844')
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
