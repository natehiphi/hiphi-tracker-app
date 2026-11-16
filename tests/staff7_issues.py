# Staff7's Issues tab (R-398), on the practice copy: whose issues (Mine, a teammate's, Everyone's), the five groups for where an issue stands (At risk, Hearing scheduled, Cleared the deadline, Moving, Stopped this year)
# with a second line on every row, the summary sentence and its narrowing links, folding, Changed since you last looked, topics (Everyone's and a teammate's list) with a topic's own page, an issue's sheet, a bill's short sheet.
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
GROUPS = """() => [...document.querySelectorAll('section[aria-labelledby^="g-"]')].map(s => [s.querySelector('h3').innerText.trim().replace(/ · \\d+$/, ''), [...s.querySelectorAll('a.sr3')].map(a => decodeURIComponent(a.getAttribute('href').split('/issue/')[1].split('?')[0])), +(/ · (\\d+)$/.exec(s.querySelector('h3').innerText.trim()) || [0, -1])[1], +((s.querySelector('.held')?.innerText || '').match(/^\\d+/) || [0])[0]])"""
LEFTROWS = "() => [...document.querySelectorAll('.wl a.sr3')].map(a => [a.id, a.getAttribute('aria-current'), a.getAttribute('href')])"
SHOWS = ['risk', 'hearing', 'cleared', 'moving', 'stopped']
LABEL = {'risk': 'At risk', 'hearing': 'Hearing scheduled', 'cleared': 'Cleared the deadline', 'moving': 'Moving', 'stopped': 'Stopped this year'}
SUMW = {'risk': 'at risk', 'hearing': 'with a hearing', 'cleared': 'cleared the deadline', 'moving': 'moving', 'stopped': 'stopped'}
# what the page's own rules say, written again here (not the app's function): where each issue of a set stands, its topics, and the session's next deadline. who: 'mine', 'all' or initials.
STATEX = """async (who) => { const d = await import('/staff6/data.js'), st = await import('/staff7/standing.js'), mo = await import('/staff6/model.js'), S = d.S;
  const withMe = (p, fn) => { const prev = S.me; S.me = p; try { return fn(); } finally { S.me = prev; } };
  const has = i => !i.archived_at && st.billsOfIssue(i).length > 0, HST = { timeZone: 'Pacific/Honolulu' }, ymd = t => new Date(t).toLocaleDateString('en-CA', HST), now = Date.now();
  let ids; if (who === 'all') ids = S.issues.filter(has).map(i => String(i.id)); else { const p = who === 'mine' ? S.me : S.advocates.find(a => a.initials === who); ids = withMe(p, () => [...d.myIssueIds()]).filter(id => has(S.issues.find(i => String(i.id) === id))); }
  const KEYS = ['first_crossover', 'second_triple', 'second_lateral', 'second_decking', 'conference', 'governor'];
  const rows = KEYS.map(k => { const e = d.DEADLINES[k]; return e && e[0] ? { key: k, date: String(e[0][1]).slice(0, 10) } : null; }).filter(Boolean).sort((a, b) => a.date.localeCompare(b.date));
  const fold = k => k === 'first_triple_senate' ? 'first_triple' : (k === 'final_decking' || k === 'fiscal') ? 'conference' : k;
  const pool = new Map(); for (const id of ids) for (const b of st.billsOfIssue(S.issues.find(x => String(x.id) === id))) pool.set(b.id, b);   // the shown list's own bills: its session row's next deadline
  const racing = new Map(); for (const b of pool.values()) { if (mo.diedish(b)) continue; for (const k of [fold(mo.stopOf(b).deadlineKey), 'governor']) if (k) racing.set(k, [...(racing.get(k) || []), b.id]); }
  const today = ymd(now), ahead = rows.filter(r => r.date >= today), nxt = ahead.find(r => r.key !== 'governor' && (racing.get(r.key) || []).length) || ahead.find(r => (racing.get(r.key) || []).length) || ahead[0] || null;
  const ORDER = ['first_triple', 'first_lateral', 'first_decking', 'first_crossover', 'second_triple', 'second_lateral', 'second_decking', 'second_crossover', 'conference'];
  const cleared = b => { if (!nxt || nxt.key === 'governor') return false; const s = mo.stopOf(b), own = fold(s.deadlineKey); if (own === nxt.key) return false;
    const pos = own ? ORDER.indexOf(own) : (['governor', 'law', 'ballot'].includes(s.phase) ? ORDER.length : -1), g = ORDER.indexOf(nxt.key); if (pos < 0) return false;
    if (nxt.key === 'first_crossover') return s.leg !== 'first' && !/^(HR|SR)\\d/.test(b.bill_number); if (nxt.key === 'conference') return pos > g; if (s.leg === 'first') return false;
    const refs = b.referrals || [], o = Math.min(b.origin_stops || 0, refs.length), c = s.leg === 'second' ? s.stops : (o ? refs.length - o : 0), need = nxt.key === 'second_triple' ? 3 : nxt.key === 'second_lateral' ? 2 : 1; return c >= need && pos > g; };
  const bstate = b => { if (mo.diedish(b)) return { s: 'stopped' }; if (st.isAtRisk(b)) return { s: 'risk', date: st.deadlineOf(b).date };
    const hs = S.hearings.filter(h => h.bill_id === b.id && h.status === 'scheduled' && Date.parse(h.scheduled_at) > now).sort((x, y) => Date.parse(x.scheduled_at) - Date.parse(y.scheduled_at));
    return hs.length ? { s: 'hearing', t: Date.parse(hs[0].scheduled_at) } : { s: cleared(b) ? 'cleared' : 'moving' }; };
  const ORDS = ['risk', 'hearing', 'cleared', 'moving', 'stopped'], keys = (S.categories || []).map(c => c.key);
  const wd = t => new Date(t).toLocaleDateString('en-US', { ...HST, weekday: 'short' }), clk = t => new Date(t).toLocaleTimeString('en-US', { ...HST, hour: 'numeric', minute: '2-digit' }).replace(/[\\u202f\\u00a0]/g, ' ');
  const noon = x => Date.parse(x + 'T12:00:00-10:00'), off = t => Math.round((noon(ymd(t)) - noon(today)) / 864e5), codes = c => String(c || '').split('/').map(x => x.trim()).filter(Boolean).sort().join('/');
  const week = bills => { const w = new Set(); for (const b of bills) if (!mo.diedish(b)) for (const h of S.hearings) if (h.bill_id === b.id && h.status === 'scheduled' && off(h.scheduled_at) >= 0 && off(h.scheduled_at) <= 6) w.add(codes(h.committee) + '|' + new Date(h.scheduled_at).toISOString()); return w; };
  const out = ids.map(id => { const i = S.issues.find(x => String(x.id) === id), bills = st.billsOfIssue(i), per = bills.map(b => ({ b, ...bstate(b) })), state = ORDS.find(k => per.some(p => p.s === k)) || 'stopped';
    const cats = [...new Set([i.category, ...S.issueCats.filter(x => String(x.issue_id) === id).map(x => x.category)].filter(c => keys.includes(c)))], hearT = Math.min(...per.filter(p => p.s === 'hearing').map(p => p.t)), riskDate = per.filter(p => p.s === 'risk').map(p => p.date).sort()[0] || '';
    const first = per.filter(p => p.s === 'hearing' && p.t === hearT).map(p => p.b), before = first.map(b => !!nxt && (racing.get(nxt.key) || []).includes(b.id) && ymd(hearT) < nxt.date);
    return { id, name: i.name, state, cats: cats.length ? cats : ['other'], owner: (S.advocates.find(a => a.id === i.owner_id && a.is_active !== false) || {}).initials || '', hearT: isFinite(hearT) ? hearT : 0, hearTxt: isFinite(hearT) ? (off(hearT) === 0 ? 'today ' + clk(hearT) : off(hearT) === 1 ? 'tomorrow ' + clk(hearT) : Math.abs(hearT - now) > 6 * 864e5 ? wd(hearT) + ', ' + new Date(hearT).toLocaleDateString('en-US', { ...HST, month: 'short', day: 'numeric' }) + ', ' + clk(hearT) : wd(hearT) + ' ' + clk(hearT)) : '', before, riskDate,
      bills: bills.map(b => b.id), alive: bills.filter(b => !mo.diedish(b)).length, week: [...week(bills)] }; });
  return { rows: out, nextKey: nxt ? nxt.key : '', nextDate: nxt ? nxt.date : '', nextDay: nxt ? new Date(nxt.date + 'T12:00:00-10:00').toLocaleDateString('en-US', { ...HST, weekday: 'long' }) : '', cats: [...(S.categories || []).map(c => [c.key, c.name]), ['other', 'Other']],
    today, clearedBills: [...pool.values()].filter(b => !mo.diedish(b) && cleared(b)).map(b => b.id), racingNext: nxt ? racing.get(nxt.key) || [] : [], info: Object.fromEntries([...pool.values()].map(b => [b.id, { s: bstate(b).s, wants: !['monitor', 'oppose', 'strongly_oppose'].includes(b.position) }])) }; }"""
# the ids of the issue rows in a list, as the page draws them (a section's rows, hidden or not)
IDS = "() => [...document.querySelectorAll('section[aria-labelledby^=\"g-\"] a.sr3')].map(a => decodeURIComponent(a.getAttribute('href').split('/issue/')[1].split('?')[0]))"
def union_ids(pg, base):
    # every issue of a list, found by narrowing to each group in turn: [(state, [ids])]
    out = {}
    for k in SHOWS:
        go(pg, base + ('&' if '?' in base else '?') + f'show={k}'); out[k] = pg.evaluate(IDS)
    return out
CHANGED = """() => { const s = document.querySelector('section[aria-labelledby="c-changed"]'); if (!s) return null; return { n: +/ · (\\d+)$/.exec(s.querySelector('h3').innerText.trim())[1], rows: [...s.querySelectorAll('a.sr3')].map(a => ({ id: decodeURIComponent(a.getAttribute('href').split('/issue/')[1].split('?')[0]), hid: !!a.closest('li[hidden]'),
  vh: a.querySelector('.ir2 .vh')?.textContent, text: (a.querySelector('.ir2 > span:last-child')?.textContent || '').replace(/[\\u00a0\\u202f]/g, ' ').trim() })), btn: s.querySelector('button[data-ifold]')?.innerText.trim() || '' }; }"""
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
            m = pg.evaluate(MODEL, 'mine'); sx = pg.evaluate(STATEX, 'mine'); g = pg.evaluate(GROUPS); chg = pg.evaluate(CHANGED); chids = [r['id'] for r in chg['rows']] if chg else []; ids = [i for _, l, _c, _h in g for i in l] + chids; HD = lambda k, sx=sx: f"Cleared {sx['nextDay']}’s deadline" if k == 'cleared' else LABEL[k]
            ok(not errs and not bad, f'{tag} {who}: Issues opens with no console error and nothing leaving 127.0.0.1 ({errs[:1]} {bad[:1]})')
            ok(len(ids) == len(set(ids)) and set(ids) == {r['id'] for r in m['rows']}, f'{tag} {who}: Mine is exactly myIssueIds with a bill this session ({len(ids)} issues, each in one group)')
            heads = [x[0] for x in g]; ok(all(x[2] == len(x[1]) + x[3] and x[3] == sum(1 for r in sx['rows'] if r['id'] in chids and HD(r['state']) == x[0]) for x in g) and not set(chids) & {i for x in g for i in x[1]}, f'{tag} {who}: each group heading carries its full count, less those held above under Changed ({[(x[0], x[2], x[3]) for x in g]})'); order = [HD(k) for k in SHOWS if HD(k) in heads]
            ok(heads == order, f'{tag} {who}: the groups are {heads}, in order, an empty one not drawn')
            where = {i: x[0] for x in g for i in x[1]}
            ok(all(where.get(r['id'], HD(r['state'])) == HD(r['state']) for r in sx['rows']) and len(sx['rows']) == len(ids), f'{tag} {who}: every issue is in the group its bills say, by an independent reading of the data ({ {k: sum(1 for r in sx["rows"] if r["state"] == k) for k in SHOWS} })')
            cnt = {k: sum(1 for r in sx['rows'] if r['state'] == k) for k in SHOWS}; sm = pg.locator('#summ').inner_text().strip() if pg.locator('#summ').count() else ''; links = {k: pg.locator(f'#sum-{k}').inner_text().strip() if pg.locator(f'#sum-{k}').count() else '' for k in SHOWS}
            ok((re.match(rf'{len(sx["rows"])} issues?', sm) or not sx['rows']) and all((links[k] == f'{cnt[k]} {SUMW[k]}') if cnt[k] else not links[k] for k in SHOWS) and sum(cnt.values()) == len(sx['rows']), f'{tag} {who}: the summary says "{sm}" and its numbers add up to the {len(sx["rows"])} issues')
            ok(pg.locator('.wl a.sr3 .person').count() == 0, f'{tag} {who}: no lead initials on Mine')
            ok(m['hearingBills'] > 0 and m['hearingRisk'] == 0, f'{tag} {who}: a bill with a hearing scheduled is never at risk ({m["hearingBills"]} such bills)')
            risky0 = [r for r in sx['rows'] if r['state'] == 'risk']
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
            risky = [r for r in sx['rows'] if r['state'] == 'risk']
            ok(all('Needs a hearing by ' in pg.locator(f'a.sr3[href^="#/issue/{r["id"]}"]').first.inner_text() for r in risky) and pg.locator('.ir2.risk').count() == len(risky) and all(re.fullmatch(r'Needs a hearing by \w{3} · (today|tomorrow|in \d+ days)', pg.locator('.ir2.risk').nth(k).inner_text().strip()) for k in range(len(risky))), f'{tag} {who}: an at-risk issue\'s second line is "Needs a hearing by Thu · in 3 days" with a mark, and only those are amber ({len(risky)})')
            if who in ('JM', 'NT', 'default', 'KV'): snap(pg, f'issues_{who}', tag)
            if who == 'KV': go(pg, '#/issues/session'); snap(pg, 'issues_session_KV', tag)
            if risky: INFO[who] = risky[0]['id']
            pg.context.close()

        # the same session line for everyone, in the one table's words; a stop that touches none of the person's bills is greyed, not removed
        ok(len({tuple(v) for v in LABELS.values()}) == 1 and len(LABELS) == len(PEOPLE) and not re.search(r'Crossover|lateral|decking|triple|2nd|1st', ' '.join(LABELS['JM']), re.I), f'{tag}: the session line shows the same six stops for all {len(LABELS)} people, in plain words ({LABELS["JM"][:2]})')
        ok(sum(1 for v in OFFS.values() if v) >= 1 and all(c == 6 for c in COUNTS.values()), f'{tag}: some people have a greyed stop and none loses one ({sorted(set(OFFS.values()))} greyed, six each)')

        # Everyone, a teammate, and the whose control
        pg, errs, bad = open_as(br, 'JM', w, h, '#/issues?who=all')
        m = pg.evaluate(MODEL, 'all'); mine = pg.evaluate(MODEL, 'mine'); mineids = {r['id'] for r in mine['rows']}; un = union_ids(pg, '#/issues?who=all'); ids = [i for k in SHOWS for i in un[k]]; go(pg, '#/issues?who=all')
        ok(set(ids) == {r['id'] for r in m['rows']} and len(ids) == len(set(ids)) and len(ids) == m['needsFirst'], f'{tag}: Everyone is every issue with a bill this session ({len(ids)} of {m["needsFirst"]}), each in exactly one group')
        ok(pg.locator('#whoAll').get_attribute('aria-current') == 'true' and pg.locator('#whoMine').get_attribute('aria-current') is None and pg.locator('#sessionRow').get_attribute('aria-current') == 'true' and 'Look only' not in pg.locator('main').inner_text(), f'{tag}: Everyone is the chosen segment, opens on the session (marked), and says nothing about look only there')
        # fix 2: the lead's initials at the right of each row, no bill count in any list
        lead = pg.evaluate("""async () => { const d = await import('/staff6/data.js'); const out = [];
          for (const a of document.querySelectorAll('.wl section a.sr3[href^="#/issue/"]')) { const id = decodeURIComponent(a.getAttribute('href').split('/issue/')[1].split('?')[0]), i = d.S.issues.find(x => String(x.id) === id), o = d.advocate(i.owner_id), p = a.querySelector('.person');
            out.push([!!p, p ? p.innerText.trim() : '', o && o.is_active !== false ? o.initials : '']); } return out; }""")
        ok(all((ok_ == bool(want) and (not ok_ or got == want)) for ok_, got, want in lead) and sum(1 for x in lead if x[0]) >= 1, f'{tag}: on Everyone each row shows its lead\'s initials at the right ({sum(1 for x in lead if x[0])} of {len(lead)}), as the data says')
        ok(not re.search(r'\b\d+ bills?\b', pg.locator('.wl').inner_text()), f'{tag}: no row says how many bills it has')
        snap(pg, 'issues_everyone', tag)
        ok(not errs and not bad, f'{tag}: Everyone has no console error')
        # the viewer's own issue under Everyone keeps its step links and button; someone else's is look-only
        rid = INFO['JM']; pg.locator(f'a.sr3[href^="#/issue/{rid}"]').first.click(); pg.wait_for_timeout(350)
        ok('Look only' not in pg.locator('main').inner_text() and steplinks(pg) >= 1 and pg.locator('.strip .btn.filled').count() == 1 and pg.evaluate(FILLED) == 1, f'{tag}: under Everyone my own at-risk issue keeps its step link and its Ask for a hearing button, and does not say "Look only"')
        snap(pg, 'rv_all_own_risk', tag)
        other = next(i for i in un['moving'] if i not in mineids); go(pg, '#/issues?who=all&show=moving')
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
        km = pg.evaluate(MODEL, 'KV'); kun = union_ids(pg, '#/issues?who=KV'); ids = [i for k in SHOWS for i in kun[k]]; go(pg, '#/issues?who=KV')
        ok('who=KV' in pg.url and set(ids) == {r['id'] for r in km['rows']} and pg.locator('#whoPick').is_hidden() and 'Kevin' in pg.locator('.ihd').inner_text(), f'{tag}: picking Kevin puts him in the address and shows his {len(ids)} issues')
        ok(pg.locator('#whoChange').is_visible() and pg.locator('#whoChange').inner_text().strip() == 'Change' and pg.locator('.ihd').inner_text().strip() == 'Kevin’s issues' and pg.locator('#sessionRow').get_attribute('aria-current') == 'true', f'{tag}: Kevin\'s heading carries a small "Change" link; the tab opens on the session')
        pg.click('#whoChange'); pg.wait_for_timeout(150)
        ok(pg.locator('#whoPick').is_visible() and pg.locator('#whoMate').get_attribute('aria-expanded') == 'true', f'{tag}: "Change" reopens the picker')
        pg.click('#who-KV'); pg.wait_for_timeout(250)
        kst = next(k for k in SHOWS if any(i not in mineids for i in kun[k])); kother = next(i for i in kun[kst] if i not in mineids); go(pg, f'#/issues?who=KV&show={kst}')
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
        bun = union_ids(pg, '#/issues?who=KV'); both = [i for k in SHOWS for i in bun[k] if i in mineids]; bst = next((k for k in SHOWS if any(i in mineids for i in bun[k])), 'risk'); go(pg, f'#/issues?who=KV&show={bst}')
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
        ok(all(x in pg.locator('#bFacts').inner_text() for x in ('What it does', 'Issue', 'Committees')) and pg.locator('#bStat .bln').count() >= 1 and pg.locator('main input:not(#findIn), main textarea:not(#bNoteIn), main select').count() == 0, f'{tag} JM: the bill page reads where it stands and its facts, and has no form controls but the note box')
        # fix 4, 5: "Your move" is a quiet button right under the position line; the sheet does not restate the banner
        ymp = pg.evaluate("() => { const m = document.querySelector('#bStat .bla .btn.text'), l = document.getElementById('bPos'), h = document.getElementById('bigpathProbe') || document.querySelector('main .bigpath'); if (!m) return null; return [m.className, m.getBoundingClientRect().top - l.getBoundingClientRect().bottom, h.getBoundingClientRect().top - m.getBoundingClientRect().bottom]; }")
        ok(ymp and 'btn' in ymp[0] and 'text' in ymp[0].split() and ymp[1] > 0 and ymp[2] > 0 and pg.locator('.strip').count() == 0, f'{tag} JM: "Your move" is a text button at the right of the status line, above the path, and the bill page has no banner of its own ({ymp})')
        nxt = pg.evaluate("() => [...document.querySelectorAll('#bStat .bln')].map(p => p.innerText.replace(/\\s+/g, ' ').trim())")
        ok(re.match(r'^Needs a hearing by \w{3}, \w{3} \d+ · .*\d+ days? left · none is scheduled$', nxt[0]) and nxt[1].startswith('If it is not heard by then'), f'{tag} JM: the status reads "{nxt[0]}" (one time form) and says what happens without a hearing')
        snap(pg, 'bill_sheet', tag)
        ok(pg.locator('.crumb.back2').inner_text().strip().startswith('Back to'), f'{tag} JM: the bill sheet\'s back link says where it goes ("{pg.locator(".crumb.back2").inner_text().strip()}")')
        pg.click('.crumb.back2'); pg.wait_for_timeout(350)
        ok(f'#/issue/{rid}' in pg.url and 'who=' not in pg.url, f'{tag} JM: the bill\'s back link goes to its issue')
        ok(not errs and not bad, f'{tag} JM: no console error, nothing left the machine')
        pg.context.close()

        # a stopped issue and a stopped bill, and a moving bill with a hearing
        pg, errs, bad = open_as(br, 'JM', w, h, '#/issues')
        sid = pg.evaluate(GROUPS)[-1][1][0]; ok(pg.evaluate(GROUPS)[-1][0] == 'Stopped this year', f'{tag} JM: there is a stopped issue to open')
        pg.click('#more-stopped'); pg.click(f'a.sr3[href^="#/issue/{sid}"]'); pg.wait_for_timeout(350)
        st_txt = pg.locator('main').inner_text()
        ok('Stopped for this year' in pg.locator('.hband .bsub').inner_text() and 'Nothing more can happen' not in st_txt and 'None of its' not in st_txt and 'Did not advance' in st_txt and pg.locator('.strip').count() == 0 and not re.search(r'\bdead\b|\bdied\b|\bkilled\b|vape', st_txt, re.I), f'{tag} JM: a stopped issue\'s band says "Stopped for this year", it lists its bills under Did not advance, in S-7 words')
        snap(pg, 'issue_sheet_stopped', tag)
        pg.locator('.bn2').first.click(); pg.wait_for_timeout(350)
        b_txt = pg.locator('main').inner_text(); why = pg.locator('#bStat .bln').nth(1).inner_text()
        ok(pg.locator('#bStat .bln').first.inner_text().startswith('Stopped') and why and pg.locator('svg.trk.dead').count() >= 1, f'{tag} JM: a stopped bill says where it stopped and why, and its path ends in a bar')
        ok(not re.search(r'\d+/\d+/\d+|Lateral|Decking|Triple', why) and (re.search(r'\w{3}, \w{3} \d+', why) or 'Failed' in why or 'Not adopted' in why or 'Deferred' in why or why.endswith('Stopped.') or 'Missed' in why), f'{tag} JM: "Why" uses plain words and dates like "Fri, Feb 20" ("{why}")')
        snap(pg, 'bill_sheet_stopped', tag)
        ok(not errs and not bad, f'{tag} JM stopped: no console error')
        pg.context.close()
        # fix 3 and 5 across every issue: a stopped bill's "Still alive" leads with number and chamber; no row repeats its issue's name; no m/d/yy anywhere
        if w == 1440:
            pg, errs, bad = open_as(br, 'JM', w, h, '#/issues?who=all')
            aun = union_ids(pg, '#/issues?who=all'); allids = [i for k in SHOWS for i in aun[k]]; dupes = []; olds = []; alive_refs = []
            for iid in allids:
                go(pg, f'#/issue/{iid}?who=all'); h1x = pg.evaluate(H1)
                dupes += [t for t in pg.evaluate("() => [...document.querySelectorAll('.bn2')].map(a => a.innerText.trim())") if t == h1x]
                if re.search(r'\d+/\d+/\d+', pg.locator('main').inner_text()): olds.append(iid)
                if pg.locator('.dh').count() and pg.locator('.brows').count() == 2 and len(alive_refs) < 3: alive_refs.append(iid)
            ok(not dupes and not olds, f'{tag}: across all {len(allids)} issues no bill row repeats its issue\'s name ({dupes[:1]}) and no date reads m/d/yy ({olds[:1]})')
            sa = []
            for iid in alive_refs:
                go(pg, f'#/issue/{iid}?who=all'); pg.locator('.brow.dead .bn2').first.click(); pg.wait_for_timeout(300)
                sa += [a.strip() for a in pg.evaluate("() => [...document.querySelectorAll('#bAlive a.lk')].map(a => a.innerText)")]
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
    SHOTS2 = os.path.join(SHOTS or '/private/tmp/claude-501/-Users-natehix-hiphi-backend/608a757d-8967-4f09-8879-6ccad1528f7b/scratchpad', 'shots2'); os.makedirs(SHOTS2, exist_ok=True)
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
                ok(all(re.search(r'\d{1,2}:\d\d [AP]M · .+', r['text']) and re.search(r'Testimony (due|was due) (today|tomorrow|\w{3})[ ,]', r['text']) for r in s['hear']) and all(r['late'] == ('Testimony was due' in r['text']) for r in s['hear']), f'{tag} {nm}: each hearing has its time, committee and testimony line')
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
                if pg.locator('[data-notfound]').count() or pg.locator('#bStat .bln').count() == 0: bad_l.append(hr)
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

    # ------------------------------------------------------------------------------------------------------------------------------------
    # R-398: the five groups, a second line on each row, the summary, folding, Changed since you last looked, topics and a topic's page
    # every expected number below is worked out from the data again in STATEX / CHANGEX (not by the app's own function)
    DLN = {'first_crossover': 'Crossed to the other chamber', 'second_triple': 'First committee deadline', 'second_lateral': 'Committee deadline', 'second_decking': 'Last committee deadline', 'conference': 'House and Senate must agree', 'governor': 'Session ends'}
    NORM = lambda t: re.sub(r'[\u00a0\u202f]', ' ', t or '')
    SECOND = """() => [...document.querySelectorAll('.wl section[aria-labelledby^="g-"] a.sr3')].map(a => ({ id: decodeURIComponent(a.getAttribute('href').split('/issue/')[1].split('?')[0]), sec: (a.querySelector('.ir2.one')?.innerText || '').replace(/[\\u00a0\\u202f]/g, ' ').trim(), amber: !!a.querySelector('.ir2.risk'), lead: a.querySelector('.person')?.innerText.trim() || '',
      hid: !!a.closest('li[hidden], ul[hidden]') }))"""
    CHANGEX = """async () => { const d = await import('/staff6/data.js'), st = await import('/staff7/standing.js'), mo = await import('/staff6/model.js'), s7 = await import('/staff7/steps.js'), S = d.S, HST = { timeZone: 'Pacific/Honolulu' }, ymd = t => new Date(t).toLocaleDateString('en-CA', HST);
      const now = Date.now(), since = now - 3 * 864e5, sinceDay = ymd(since), today = ymd(now), has = i => !i.archived_at && st.billsOfIssue(i).length > 0;
      const RAW = /has scheduled a public hearing|to be heard by|will hold a public decision making|has rescheduled|deleted from the meeting|^Meeting scheduled on|hours? notice|day notice/i, ACT = /^(?:Hearing|Decision making) (?:set|moved|cancelled)|^Taken off|^Hearing notice/i;
      const ev = (i) => { const out = []; for (const b of st.billsOfIssue(i)) {
          if (!mo.diedish(b)) for (const h of S.hearings) { const p = h.notice_posted_at ? Date.parse(h.notice_posted_at) : NaN; if (h.bill_id === b.id && h.status === 'scheduled' && Date.parse(h.scheduled_at) > now && p >= since && p <= now) out.push('hearing'); }
          const day = String(b.last_action_date || '').slice(0, 10); if (day && day >= sinceDay && day <= today && !ACT.test(mo.plainAction(String(b.last_action || ''))[0]) && !RAW.test(String(b.last_action || ''))) out.push('move'); }
        for (const x of s7.stepsFor(S.me)) if (x.sentBack && String(x.issue?.id) === String(i.id) && x.draft?.updated_at && Date.parse(x.draft.updated_at) >= since && Date.parse(x.draft.updated_at) <= now) out.push('letter'); return out; };
      const mine = new Set([...d.myIssueIds()].map(String)), r = { all: {}, mine: {} };
      for (const i of S.issues.filter(has)) { const e = ev(i); if (e.length) { r.all[String(i.id)] = e; if (mine.has(String(i.id))) r.mine[String(i.id)] = e; } }
      return r; }"""
    VIEWS = [('KR', 'mine', ''), ('JM', 'mine', ''), ('KV', 'mine', ''), ('JM', 'all', '?who=all'), ('JM', 'KV', '?who=KV')]
    TOPICS = "() => [...document.querySelectorAll('#topics a.sr3')].map(a => ({ key: a.getAttribute('href').split('/topic/')[1].split('?')[0], name: a.querySelector('b').innerText.trim(), line: a.querySelector('.ir2').innerText.replace(/\\s*\\n\\s*/g, ' ').trim(), amber: !!a.querySelector('.ir2 .tr.risk'), href: a.getAttribute('href') }))"
    AMBER = "() => { const e = document.createElement('i'); e.style.color = 'var(--amber)'; document.body.appendChild(e); const c = getComputedStyle(e).color; e.remove(); const r = document.querySelector('.ir2.risk, .ir2 .tr.risk'); return r ? [getComputedStyle(r).color, c] : [c, c]; }"
    HEADWORDS = ('At risk', 'Cleared', 'Waiting', 'Hearing scheduled', 'Moving', 'Stopped this year ·')
    def sec_ok(r, x, nextDay):
        t = r['sec']; k = x['state']
        if t.startswith(HEADWORDS): return False   # a second line never says its group heading again
        if k == 'risk': return r['amber'] and re.fullmatch(r'Needs a hearing by \w{3} · (today|tomorrow|in \d+ days)', t) is not None
        if r['amber']: return False
        if k == 'hearing':
            base = 'Hearing ' + x['hearTxt']; tail = f' · before {nextDay}’s deadline'
            return t == base + tail if all(x['before']) else t == base if not any(x['before']) else t in (base, base + tail)
        if k == 'cleared': return t.startswith('Next: ') or (bool(t) and not t.startswith('Cleared'))
        if k == 'moving': return bool(t) and not t.startswith(('Hearing', 'Needs')) and re.search(r'^(In (\d+ (House|Senate) committees|(House|Senate) .+)|Ready for|In conference|With the|Signed|Going)', t) is not None and not re.search(r'has until (?!\w{3}, \w{3} \d+$)', t)
        return t == 'Stopped this year' or t.startswith('Stopped at ')
    def stats_sentence(sx, key, rows, bills):
        # the topic page's deadline sentence, from the data: the next deadline against the topic's alive bills
        nr = sx['nextKey']; info = sx['info']; racing = [b for b in sx['racingNext'] if b in bills]; clr = [b for b in bills if b in set(sx['clearedBills'])]
        risk = sum(1 for b in racing if info[b]['s'] == 'risk'); heard = sum(1 for b in racing if info[b]['s'] == 'hearing'); rest = [b for b in racing if info[b]['s'] not in ('risk', 'hearing')]
        wait = sum(1 for b in rest if info[b]['wants']); no = len(rest) - wait; total = len(racing) + len(clr)
        parts = [x for x in [risk and f'{risk} at risk', heard and f'{heard} with a hearing set', wait and f'{wait} waiting for a hearing', no and f'{no} not asking for one', clr and f'{len(clr)} cleared'] if x]
        return total, parts
    for w, h in ((1440, 900), (1280, 800)):
        tag = f'{w}x{h}'
        for viewer, key, q in VIEWS:
            pg, errs, bad = open_as(br, viewer, w, h, '#/issues' + q); nm = f'{viewer} {key}'
            sx = pg.evaluate(STATEX, key); R = {r['id']: r for r in sx['rows']}; flat = key == 'mine'; nd = sx['nextDay']
            cnt = {k: sum(1 for r in sx['rows'] if r['state'] == k) for k in SHOWS}
            if w == 1440:
                # the five groups, narrowed one at a time: the right issues, each with the right second line, every row showing, nothing folded
                seen = []
                for k in SHOWS:
                    go(pg, '#/issues' + q + ('&' if q else '?') + f'show={k}'); rows = pg.evaluate(SECOND); want = {r['id'] for r in sx['rows'] if r['state'] == k}; seen += [r['id'] for r in rows]
                    heads = pg.locator('section[aria-labelledby^="g-"] h3').all_inner_texts()
                    ok({r['id'] for r in rows} == want and len(rows) == len(want) and (heads == [(f'Cleared {nd}’s deadline' if k == 'cleared' else LABEL[k]) + f' · {len(want)}'] if want else not heads) and not any(r['hid'] for r in rows) and pg.locator('button[data-ifold]').count() == 0, f'{tag} {nm}: show={k} lists exactly the {len(want)} {SUMW[k]} issues, all showing, nothing folded')
                    bad_s = [(r['id'], r['sec'], R[r['id']]['state']) for r in rows if not sec_ok(r, R[r['id']], nd)]
                    ok(not bad_s, f'{tag} {nm}: show={k}: every row\'s second line matches its state ({bad_s[:2]})')
                    if k == 'risk': a = pg.evaluate(AMBER); ok(not rows or a[0] == a[1], f'{tag} {nm}: an at-risk second line is in the amber token')
                    if k == 'hearing': ok(all((' · before ' in r['sec']) if all(R[r['id']]['before']) else (' · before ' not in r['sec']) if not any(R[r['id']]['before']) else True for r in rows) and all(re.match(r'Hearing (today|tomorrow|\w{3}) ', r['sec']) for r in rows), f'{tag} {nm}: "before <weekday>’s deadline" appears exactly when the hearing bill races this list\'s next deadline and the hearing is on an earlier day ({[r["sec"] for r in rows][:2]})')
                    if k == 'cleared': ok(all(r['sec'] and not r['sec'].startswith('Cleared') for r in rows), f'{tag} {nm}: a cleared row says where it goes next, not the heading again ({[r["sec"] for r in rows][:2]})')
                    lead_ok = all(r['lead'] == '' for r in rows) if flat else all(r['lead'] == (R[r['id']]['owner'] if not (key not in ('mine', 'all') and R[r['id']]['owner'] == key) else '') for r in rows)
                    ok(lead_ok, f'{tag} {nm}: show={k}: ' + ('no lead initials on Mine' if flat else 'a row shows its lead\'s initials' + (' (not the teammate\'s own)' if key not in ('mine', 'all') else '')))
                ok(sorted(seen) == sorted(R) and len(seen) == len(set(seen)), f'{tag} {nm}: the five groups hold every one of the {len(R)} issues exactly once ({cnt})')
                # the summary and its links
                go(pg, '#/issues' + q); sm = pg.locator('#summ').inner_text().strip(); links = {k: pg.locator(f'#sum-{k}').inner_text().strip() if pg.locator(f'#sum-{k}').count() else '' for k in SHOWS}
                ok(re.match(rf'{len(R)} issues?', sm) and all((links[k] == f'{cnt[k]} {SUMW[k]}') if cnt[k] else not links[k] for k in SHOWS) and sum(cnt.values()) == len(R) and pg.locator('#showAll').count() == 0, f'{tag} {nm}: the summary says "{sm}"; a zero group is left out; the numbers add up to {len(R)}')
                for k in [k for k in SHOWS if cnt[k]][:5]:
                    go(pg, '#/issues' + q); pg.click(f'#sum-{k}'); pg.wait_for_timeout(250); a1 = pg.evaluate(IDS); cur = pg.locator(f'#sum-{k}').get_attribute('aria-current'); sa = pg.locator('#showAll').count()
                    ok(f'show={k}' in pg.url and set(a1) == {r['id'] for r in sx['rows'] if r['state'] == k} and cur == 'true' and sa == 1 and pg.locator('[aria-current="true"].sl').count() == 1, f'{tag} {nm}: pressing "{links[k]}" narrows to those {cnt[k]} and marks it')
                    pg.click(f'#sum-{k}'); pg.wait_for_timeout(250)
                    ok('show=' not in pg.url and pg.locator('#showAll').count() == 0 and pg.locator('[aria-current="true"].sl').count() == 0, f'{tag} {nm}: pressing it again clears the narrowing')
                    pg.click(f'#sum-{k}'); pg.wait_for_timeout(200); pg.click('#showAll'); pg.wait_for_timeout(250)
                    ok('show=' not in pg.url and pg.locator('#showAll').count() == 0, f'{tag} {nm}: "Show all issues" clears it too')
                go(pg, '#/issues' + q + ('&' if q else '?') + 'show=zz')
                ok(pg.locator('#showAll').count() == 0 and pg.locator('[aria-current="true"].sl').count() == 0 and pg.locator('[data-notfound]').count() == 0 and pg.locator('#summ').count() == 1, f'{tag} {nm}: show=zz is ignored')
                ok(not errs and not bad, f'{tag} {nm}: no console error, nothing left the machine')
            # layout, both sizes
            go(pg, '#/issues' + q)
            ok(pg.evaluate(NOSIDE) and not pg.evaluate(SMALL), f'{tag} {nm}: no sideways scroll, 44px targets ({pg.evaluate(SMALL)[:2]})')
            if w == 1440 and not flat:
                ok(pg.locator('a[href^="#/do/"]').count() == 0 and pg.evaluate(FILLED) == 0, f'{tag} {nm}: the list has no step link and no filled button (look only)')
            pg.context.close()

        # ---- folding: a group over 5 shows 5 and "Show all N"; opening shows all, and it stays open across the minute's redraw; Stopped starts folded
        if w == 1440:
            pg, errs, bad = open_as(br, 'KR', w, h, '#/issues'); sx = pg.evaluate(STATEX, 'mine'); cnt0 = {k: sum(1 for r in sx['rows'] if r['state'] == k) for k in SHOWS}; chg0 = pg.evaluate(CHANGED); chids = {r['id'] for r in chg0['rows']} if chg0 else set(); cnt = {k: cnt0[k] - sum(1 for r in sx['rows'] if r['id'] in chids and r['state'] == k) for k in SHOWS}   # rows held above under Changed are not repeated
            big = [k for k in SHOWS if cnt[k] > 5 and k != 'stopped']
            ok(len(big) >= 1 and cnt['stopped'] >= 1, f'{tag} KR: there is a group over 5 to fold ({big}) and a stopped group ({cnt})')
            VIS = "k => [...document.querySelectorAll(`#gl-${k} li`)].filter(l => !l.hidden && !l.closest('ul[hidden]')).length"
            for k in big[:1]:
                b = pg.locator(f'#more-{k}')
                ok(pg.evaluate(VIS, k) == 5 and b.inner_text().strip() == f'Show all {cnt[k]}' and b.get_attribute('aria-expanded') == 'false' and b.evaluate('e => e.tagName') == 'BUTTON', f'{tag} KR: {LABEL[k]} ({cnt[k]}) shows 5 rows and a "Show all {cnt[k]}" button')
                pg.evaluate("document.querySelector('.wl').scrollTop = 30"); b.click(); pg.wait_for_timeout(150)
                ok(pg.evaluate(VIS, k) == cnt[k] and b.get_attribute('aria-expanded') == 'true', f'{tag} KR: opening it shows all {cnt[k]} in place')
                pg.evaluate('window.__staff7Tick()'); pg.wait_for_timeout(250)
                ok(pg.evaluate(VIS, k) == cnt[k] and pg.locator(f'#more-{k}').get_attribute('aria-expanded') == 'true', f'{tag} KR: it stays open across the minute\'s redraw')
                pg.locator(f'#more-{k}').click(); pg.wait_for_timeout(150); ok(pg.evaluate(VIS, k) == 5, f'{tag} KR: pressing it again folds back to 5')
            hv = pg.evaluate("() => [document.querySelector('#gl-stopped').hidden, document.querySelector('#g-stopped').innerText.trim(), document.querySelector('#more-stopped').innerText.trim(), document.querySelector('#more-stopped').getAttribute('aria-expanded')]")
            ok(hv == [True, f'Stopped this year · {cnt["stopped"]}', f'Show {cnt["stopped"]}', 'false'], f'{tag} KR: Stopped this year starts as its heading and "Show {cnt["stopped"]}" ({hv})')
            pg.click('#more-stopped'); pg.wait_for_timeout(150); pg.evaluate('window.__staff7Tick()'); pg.wait_for_timeout(250)
            ok(pg.evaluate(VIS, 'stopped') == cnt['stopped'], f'{tag} KR: opened, it shows all {cnt["stopped"]} and stays so across the redraw')
            ok(not errs and not bad, f'{tag} KR folding: no console error')
            pg.context.close()
            # a group of 5 or fewer shows all, with no button
            pg, errs, bad = open_as(br, 'JM', w, h, '#/issues'); sj = pg.evaluate(STATEX, 'mine'); cj = {k: sum(1 for r in sj['rows'] if r['state'] == k) for k in SHOWS}
            ok(all(pg.locator(f'#more-{k}').count() == 0 for k in SHOWS if 0 < cj[k] <= 5 and k != 'stopped') and all(pg.evaluate("k => document.querySelectorAll(`#gl-${k} li`).length", k) == cj[k] for k in SHOWS if cj[k] and k != 'stopped'), f'{tag} JM: a group of 5 or fewer shows all its rows and has no button ({cj})')
            pg.context.close()

        # ---- Changed since you last looked: the practice copy never writes, and counts from 3 days before the practice clock
        if w == 1440:
            for viewer, key, q in (('KR', 'all', '?who=all'), ('JM', 'mine', ''), ('KR', 'mine', '')):
                pg, errs, bad = open_as(br, viewer, w, h, '#/issues' + q); cx = pg.evaluate(CHANGEX); want = cx['all' if key == 'all' else 'mine']; c = pg.evaluate(CHANGED)
                ok((c is None and not want) or (c and c['n'] == len(want) and {r['id'] for r in c['rows']} == set(want) and len(c['rows']) == len(want)), f'{tag} {viewer} {key}: "Changed in the last 3 days" (the practice copy counts back 3 days) holds the {len(want)} issues with a hearing set, a move or a testimony in the last 3 days of the practice clock ({c and c["n"]})')
                if c:
                    vis = [r for r in c['rows'] if not r['hid']]
                    lim = 5 if key == 'mine' else 3
                    ok(all(r['vh'] == 'New: ' and r['text'] for r in c['rows']) and not pg.locator('.newdot').count() and len(vis) == min(lim, c['n']) and (c['btn'] == f'Show all {c["n"]}' if c['n'] > lim else c['btn'] == ''), f'{tag} {viewer} {key}: each row has the hidden "New: " (and no dot); {len(vis)} show (limit {lim}), button "{c["btn"]}"')
                    ok(all(r['text'].startswith('Hearing set for ') for r in c['rows'] if want[r['id']] == ['hearing']), f'{tag} {viewer} {key}: a row whose only change is a hearing says "Hearing set for ..."')
                    first_ids = pg.evaluate("() => [...document.querySelectorAll('#ilist > section h3')].map(h => h.innerText.trim().replace(/ · \\d+$/, ''))")
                    ok(first_ids[0] == 'Changed in the last 3 days', f'{tag} {viewer} {key}: the heading says "in the last 3 days" on the practice copy and Changed is the first group ({first_ids[:2]})')
                    # an issue under Changed still appears in its state group
                    sx2 = pg.evaluate(STATEX, 'all' if key == 'all' else 'mine'); R2 = {r['id']: r for r in sx2['rows']}; gg = pg.evaluate(GROUPS); gid = {i for x in gg for i in x[1]}; ch = {r['id'] for r in c['rows']}
                    ok(not (gid & ch) and all(x[3] == sum(1 for i in ch if (f"Cleared {sx2['nextDay']}’s deadline" if R2[i]['state'] == 'cleared' else LABEL[R2[i]['state']]) == x[0]) and x[2] == len(x[1]) + x[3] for x in gg) and gid | ch == set(R2) if key != 'all' else not (gid & ch), f'{tag} {viewer} {key}: no issue is under Changed and in its group too; each group says how many are held ("N more above, under Changed") ({[(x[0], x[3]) for x in gg]})')
                else: ok(pg.locator('section[aria-labelledby="c-changed"]').count() == 0, f'{tag} {viewer} {key}: no Changed group when nothing changed')
                if key == 'all':
                    keys0 = pg.evaluate("() => Object.keys(localStorage).sort().join(',')"); pg.wait_for_timeout(10800); pg.evaluate('window.__staff7Tick()'); pg.wait_for_timeout(300)
                    keys1 = pg.evaluate("() => Object.keys(localStorage).sort().join(',')"); go(pg, '#/'); go(pg, '#/issues?who=all')
                    ok(keys0 == keys1 == pg.evaluate("() => Object.keys(localStorage).sort().join(',')") and 'looked' not in keys1, f'{tag} {viewer}: the practice copy writes nothing to localStorage, not after 10 seconds and not on leaving Issues ("{keys1}")')
                    chg = pg.evaluate("async () => { const m = await import('/staff7/issues.js'), n = Date.now(), D = 864e5; return [m.sinceFor(null, n) === n - 3 * D, m.sinceFor(String(n - 2 * D), n) === n - 2 * D, m.sinceFor(String(n - 8 * D), n) === n - 3 * D, m.sinceFor(String(n + D), n) === n - 3 * D, m.sinceFor('x', n) === n - 3 * D]; }")
                    ok(all(chg), f'{tag}: the time to count from is the stored one within 7 days, else 3 days back (first visit, too old, in the future, unreadable) {chg}')
                ok(not errs and not bad, f'{tag} {viewer} {key} Changed: no console error')
                pg.context.close()

        # ---- topics (Everyone's and a teammate's list) and a topic's own page
        for viewer, key, q in (('JM', 'all', '?who=all'), ('JM', 'NT', '?who=NT')) if w == 1440 else (('JM', 'all', '?who=all'),):
            pg, errs, bad = open_as(br, viewer, w, h, '#/issues' + q); nm = f'{viewer} {key}'; sx = pg.evaluate(STATEX, key); R = {r['id']: r for r in sx['rows']}; cats = sx['cats']
            exp = [(ck, cn, [r for r in sx['rows'] if ck in r['cats']]) for ck, cn in cats]; exp = [e for e in exp if e[2]]
            tps = pg.evaluate(TOPICS); gh = pg.evaluate("() => [...document.querySelectorAll('#ilist > section h3')].map(h => h.innerText.trim().replace(/ · \\d+$/, ''))")
            ok([t['key'] for t in tps] == [e[0] for e in exp] and [t['name'] for t in tps] == [e[1] for e in exp], f'{tag} {nm}: one topic row per category that has issues, in the categories\' order, "Other" last ({[t["key"] for t in tps]})')
            ok(gh[-1] == 'Topics' and set(gh) <= {'Changed in the last 3 days', 'At risk', 'Topics'} and gh == sorted(gh, key=['Changed in the last 3 days', 'At risk', 'Topics'].index), f'{tag} {nm}: the list is Changed, At risk, then Topics ({gh})')
            def line_for(rs):
                r = sum(1 for x in rs if x['state'] == 'risk'); hr = sum(1 for x in rs if x['state'] == 'hearing'); return f'{len(rs)} issue{"" if len(rs) == 1 else "s"}' + (f' · {r} at risk' if r else '') + (f' · {hr} with a hearing' if hr else '')
            ok(all(t['line'] == line_for(e[2]) and t['amber'] == any(x['state'] == 'risk' for x in e[2]) for t, e in zip(tps, exp)), f'{tag} {nm}: each topic says its counts, and starts amber with "N at risk" when it holds one ({[t["line"] for t in tps][:3]})')
            a = pg.evaluate(AMBER) if any(t['amber'] for t in tps) else None
            ok(a is None or a[0] == a[1], f'{tag} {nm}: the at-risk topic\'s line is in the amber token')
            atr = [x for x in pg.evaluate(GROUPS) if x[0] == 'At risk']; ok(bool(atr) == any(r['state'] == 'risk' for r in sx['rows']) and all(x[2] == sum(1 for r in sx['rows'] if r['state'] == 'risk') and len(x[1]) + x[3] == x[2] for x in atr), f'{tag} {nm}: At risk shows in full above Topics ({atr and atr[0][2]})')
            ok(pg.locator('.sl.nw').evaluate_all("els => els.every(e => e.getClientRects().length === 1)") and 'hearing scheduled' not in pg.locator('#summ').inner_text() + ' '.join(t['line'] for t in tps), f'{tag} {nm}: no summary link wraps inside itself, and "hearing scheduled" is not in the sentence or the topic rows')
            ok(pg.evaluate(NOSIDE) and not pg.evaluate(SMALL), f'{tag} {nm}: topics list: no sideways scroll, 44px targets ({pg.evaluate(SMALL)[:2]})')
            if w == 1280: snap(pg, 'topics', tag); pg.context.close(); continue
            snap(pg, f'i3_{nm.replace(" ", "_")}', tag)
            seen_issues = set(); followed = 0
            for ck, cn, rs in exp:
                go(pg, f'#/issues/topic/{ck}' + q); ids_t = {r['id'] for r in rs}; tcount = {k: sum(1 for r in rs if r['state'] == k) for k in SHOWS}
                tr = pg.locator('#trail').inner_text().replace('\n', ' ').strip()
                ok(tr.startswith('Issues') and tr.endswith(cn) and pg.locator('#trailIssues').get_attribute('href') == '#/issues' + q and pg.locator('#sessionRow').count() == 0, f'{tag} {nm}/{ck}: the trail reads "Issues › {cn}", Issues goes back to the list, and the session row is not shown')
                sm = pg.locator('#summ').inner_text().strip(); lk = {k: pg.locator(f'#sum-{k}').inner_text().strip() if pg.locator(f'#sum-{k}').count() else '' for k in SHOWS}
                ok(re.match(rf'{len(rs)} issues?', sm) and all((lk[k] == f'{tcount[k]} {SUMW[k]}') if tcount[k] else not lk[k] for k in SHOWS) and sum(tcount.values()) == len(rs), f'{tag} {nm}/{ck}: the summary says "{sm}" and adds up to the topic\'s {len(rs)}')
                un = {}
                for k in SHOWS: go(pg, f'#/issues/topic/{ck}' + q + ('&' if q else '?') + f'show={k}'); un[k] = pg.evaluate(IDS)
                allt = [i for k in SHOWS for i in un[k]]; seen_issues |= set(allt)
                ok(sorted(allt) == sorted(ids_t) and all(set(un[k]) == {r['id'] for r in rs if r['state'] == k} for k in SHOWS), f'{tag} {nm}/{ck}: its issues are in the five groups, each once ({len(allt)} of {len(ids_t)})')
                go(pg, f'#/issues/topic/{ck}' + q)
                # the page at the right
                hn = {(r['id'], x) for r in rs for x in r['week']}
                bills = {b for r in rs for b in r['bills']}; risk_n = sum(1 for b in bills if sx['info'][b]['s'] == 'risk'); want_h1 = (f'{risk_n} bill{"" if risk_n == 1 else "s"} at risk' if risk_n else 'Nothing at risk') + ' · ' + (f'{len(hn)} hearing{"" if len(hn) == 1 else "s"}' if hn else 'no hearings') + ' in the next 7 days'
                alive_b = sum(1 for b in bills if sx['info'][b]['s'] != 'stopped'); alive_i = sum(1 for r in rs if r['state'] != 'stopped')
                kick = pg.locator('#tKick').inner_text().strip(); sub = pg.locator('#tSub').inner_text().strip(); h1 = pg.evaluate(H1)
                whose = 'everyone’s issues' if key == 'all' else {'KV': 'Kevin', 'NT': 'Nate'}[key] + '’s issues'
                ok(h1 == want_h1 and kick == f'{cn} · {whose}' and sub == f'{alive_i} of {len(rs)} issue{"" if len(rs) == 1 else "s"} still alive · {alive_b} of {len(bills)} bill{"" if len(bills) == 1 else "s"}', f'{tag} {nm}/{ck}: "{h1}" / "{sub}" / "{kick}" as the data says')
                rows_w = pg.evaluate("() => [...document.querySelectorAll('#tWeek li')].map(li => ({ issue: li.querySelector('a.twi').getAttribute('href'), name: li.querySelector('a.twi').innerText.trim(), sit: li.querySelector('.twl a').getAttribute('href'), text: li.querySelector('.twl').innerText.replace(/[\\u00a0\\u202f]/g, ' ').trim() }))")
                ok(len(rows_w) == len(hn) and (not hn or pg.locator('#tWeekH').inner_text().strip() == 'Next 7 days') and (hn or pg.locator('#tWeekH').count() == 0), f'{tag} {nm}/{ck}: Next 7 days lists the {len(hn)} hearings of the next 7 days, one row for each issue and sitting')
                ok(all(re.fullmatch(r'Hearing (?:today|tomorrow|\w{3}) \d+:\d\d [AP]M · .+ · testimony (filed|ready to file|waiting for a second look|waiting for approval|not filed|sent back to fix|not started|being written)|Hearing .+ · (\d+ of \d+ testimonies filed|testimonies filed)', r['text']) for r in rows_w) and 'second review' not in ' '.join(r['text'] for r in rows_w).lower(), f'{tag} {nm}/{ck}: each says "Hearing Wed 1:00 PM (or today, tomorrow) · committee · where the testimony stands", the day worded as the list words it ({[r["text"] for r in rows_w][:1]})')
                # the next deadline against the topic's bills
                total, parts = stats_sentence(sx, ck, rs, bills); dd = (lambda a, b: round((__import__('datetime').date.fromisoformat(a) - __import__('datetime').date.fromisoformat(b)).days))(sx['nextDate'], sx['today'])
                rel = 'today' if dd <= 0 else 'tomorrow' if dd == 1 else f'in {dd} days'
                want_dl = f'{DLN[sx["nextKey"]]} · {rel}. ' + (('The one bill it affects' if total == 1 else f'Of the {total} bills it affects') + ': ' + ', '.join(parts) + '.' if total else 'It affects none of this topic’s bills.')
                if total: ok(pg.locator('#tDlH').inner_text().strip() == f'{sx["nextDay"]}’s deadline' and NORM(pg.locator('#tDl').inner_text()).strip() == want_dl, f'{tag} {nm}/{ck}: "{pg.locator("#tDlH").inner_text().strip()}": "{pg.locator("#tDl").inner_text().strip()}"')
                else: ok(pg.locator('#tDlH').count() == 0 and pg.locator('#tDl').count() == 0, f'{tag} {nm}/{ck}: the deadline section is left out, since it affects none of this topic\'s bills')
                if rows_w: ok(pg.evaluate("() => { const a = document.querySelector('.twl a'), t = document.querySelector('.twl'); return [getComputedStyle(a).fontWeight, getComputedStyle(t).fontWeight, getComputedStyle(a).textDecorationLine]; }") == ['400', '400', 'none'], f'{tag} {nm}/{ck}: the hearing link is regular weight, no underline at rest')
                # who leads: each lead with a count, each a link to that teammate's list
                lead_n = {}
                for r in rs:
                    if r['owner']: lead_n[r['owner']] = lead_n.get(r['owner'], 0) + 1
                lls = pg.evaluate("() => [...document.querySelectorAll('#tLeads a')].map(a => [a.getAttribute('href'), a.innerText.trim(), a.nextSibling.textContent.trim().replace(/^[·\\s]+/, '').replace(/[·\\s]+$/, '')])")
                ok(sorted(x[0].split('who=')[1] for x in lls) == sorted(lead_n) and all(x[2] == f'{lead_n[x[0].split("who=")[1]]} issue{"" if lead_n[x[0].split("who=")[1]] == 1 else "s"}' for x in lls), f'{tag} {nm}/{ck}: Who leads: {[(x[1], x[2]) for x in lls]}')
                ok(pg.evaluate(NOSIDE) and not pg.evaluate(SMALL) and pg.locator('a[href^="#/do/"]').count() == 0 and pg.evaluate(FILLED) == 0 and not errs and not bad, f'{tag} {nm}/{ck}: the topic page fits, no step link, no filled button, no console error')
                # every hearing link opens that sitting in Calendar (one or more per topic that has one), every issue link opens that issue
                for r in rows_w[:2 if len(rows_w) > 1 else 1]:
                    go(pg, f'#/issues/topic/{ck}' + q); pg.click(f'#tWeek a[href="{r["sit"]}"]'); pg.wait_for_timeout(450); followed += 1
                    ok('#/calendar/sitting/' in pg.url and (('who=' + key) in pg.url if key != 'mine' and key != 'all' else True) and pg.locator('[data-notfound]').count() == 0 and pg.locator('.kick').first.inner_text().startswith('Hearing'), f'{tag} {nm}/{ck}: "{r["text"][:40]}" opens that hearing in Calendar')
                go(pg, f'#/issues/topic/{ck}' + q)
                if rows_w:
                    pg.click(f'#tWeek a.twi[href="{rows_w[0]["issue"]}"]'); pg.wait_for_timeout(350)
                    ok('#/issue/' in pg.url and pg.evaluate(H1) == rows_w[0]['name'] and f'topic={ck}' in pg.url and pg.locator('#trail').count() == 1, f'{tag} {nm}/{ck}: the issue link opens "{rows_w[0]["name"]}" with the trail still showing the topic')
                    pg.go_back(); pg.wait_for_timeout(350); ok(f'/issues/topic/{ck}' in pg.url, f'{tag} {nm}/{ck}: Back returns to the topic')
            ok(seen_issues == set(R), f'{tag} {nm}: across the topics every one of the {len(R)} issues appears (at least once)')
            ok(followed >= 1, f'{tag} {nm}: {followed} hearing links were followed into Calendar')
            # picking an issue in a topic: the sheet opens, the trail and the topic's list stay, Back returns
            ck = exp[0][0]; rs0 = exp[0][2]; k0 = next(k for k in SHOWS if any(r['state'] == k for r in rs0)); pick = next(r for r in rs0 if r['state'] == k0)['id']
            go(pg, f'#/issues/topic/{ck}' + q + ('&' if q else '?') + f'show={k0}'); pg.click(f'a.sr3[href^="#/issue/{pick}"]'); pg.wait_for_timeout(400)
            ok(f'topic={ck}' in pg.url and 'show=' + k0 in pg.url and pg.locator('#trail').count() == 1 and pg.locator(f'a.sr3[href^="#/issue/{pick}"]').get_attribute('aria-current') == 'true' and pg.evaluate(H1) == R[pick]['name'].replace('vape', 'e-cigarette'), f'{tag} {nm}: an issue opened inside {ck} keeps the trail, the topic\'s list and its marked row')
            snap(pg, f'i8_issue_open_inside_topic_{nm.replace(" ", "_")}', tag)
            pg.go_back(); pg.wait_for_timeout(400); ok(f'/issues/topic/{ck}' in pg.url and 'topic=' not in pg.url, f'{tag} {nm}: Back returns to the topic')
            go(pg, f'#/issues/topic/{ck}' + q + ('&' if q else '?') + f'show={k0}'); pg.click(f'a.sr3[href^="#/issue/{pick}"]'); pg.wait_for_timeout(350); pg.locator('.bn2').first.click(); pg.wait_for_timeout(350)
            ok('#/bill/' in pg.url and f'topic={ck}' in pg.url, f'{tag} {nm}: the topic is kept through to a bill')
            # the minute's redraw keeps the topic, the open fold and the place
            go(pg, f'#/issues/topic/{ck}' + q); pg.evaluate('window.__staff7Tick()'); pg.wait_for_timeout(250); ok(pg.locator('#trail').count() == 1 and pg.evaluate(H1), f'{tag} {nm}: the minute\'s redraw keeps the topic')
            # an unknown topic is the not-found sheet
            for bad_t in ('zzz', 'tobacco/x', '', 'TOBACCO', '%E0%A4%A', '__proto__'):
                go(pg, f'#/issues/topic/{bad_t}' + q); ok(pg.locator('[data-notfound]').count() == 1 and pg.locator('main h1').count() == 1 and not errs, f'{tag} {nm}: "#/issues/topic/{bad_t}" gives the not-found sheet')
            ok(not errs and not bad, f'{tag} {nm}: topics: no console error, nothing left the machine')
            pg.context.close()

        if w == 1440:
            # ---- the list's own next deadline: the cleared group's heading names the weekday of the session row above the list (KR, KV, NT)
            for viewer, key, q in (('KR', 'mine', ''), ('KV', 'mine', ''), ('NT', 'mine', ''), ('KR', 'all', '?who=all'), ('KR', 'NT', '?who=NT')):
                pg, errs, bad = open_as(br, viewer, w, h, '#/issues' + q); sx = pg.evaluate(STATEX, key); row_txt = pg.locator('#sessionRow .ir2').inner_text().strip()
                dl = {r['date']: r for r in []}
                wd = pg.evaluate("(d) => new Date(d + 'T12:00:00-10:00').toLocaleDateString('en-US', { timeZone: 'Pacific/Honolulu', weekday: 'short', month: 'short', day: 'numeric' })", sx['nextDate'])
                ok(wd in row_txt and sx['nextKey'] != '', f'{tag} {viewer} {key}: the session row ("{row_txt}") is the next deadline the page and the data both name ({sx["nextKey"]} {wd})')
                un = union_ids(pg, '#/issues' + q); go(pg, '#/issues' + q + ('&' if q else '?') + 'show=cleared'); hd = pg.locator('#g-cleared').inner_text().strip() if pg.locator('#g-cleared').count() else ''
                ok(set(un['cleared']) == {r['id'] for r in sx['rows'] if r['state'] == 'cleared'} and (not un['cleared'] or hd == f"Cleared {sx['nextDay']}’s deadline · {len(un['cleared'])}"), f'{tag} {viewer} {key}: the cleared group is headed "{hd}", the weekday of that list\'s own session row')
                # Cleared again, from the raw fields only: the second-chamber committee count (referrals minus origin stops) and the raw stage, for every alive bill of the view
                RAW = """async ([who, key]) => { const d = await import('/staff6/data.js'), st = await import('/staff7/standing.js'), S = d.S, now = Date.now();
                  const withMe = (p, fn) => { const prev = S.me; S.me = p; try { return fn(); } finally { S.me = prev; } };
                  const has = i => !i.archived_at && st.billsOfIssue(i).length > 0; let ids; if (who === 'all') ids = S.issues.filter(has).map(i => String(i.id)); else { const p = who === 'mine' ? S.me : S.advocates.find(a => a.initials === who); ids = withMe(p, () => [...d.myIssueIds()]).filter(id => has(S.issues.find(i => String(i.id) === id))); }
                  const PAST = { second_triple: ['second_lateral', 'second_decking', 'second_floor', 'second_crossover', 'conference', 'governor', 'enacted', 'ballot'], second_lateral: ['second_decking', 'second_floor', 'second_crossover', 'conference', 'governor', 'enacted', 'ballot'],
                    second_decking: ['second_floor', 'second_crossover', 'conference', 'governor', 'enacted', 'ballot'], conference: ['governor', 'enacted', 'ballot'], first_crossover: ['first_crossover', 'second_triple', 'second_lateral', 'second_decking', 'second_floor', 'second_crossover', 'conference', 'governor', 'enacted', 'ballot'] };
                  const NEED = { second_triple: 3, second_lateral: 2, second_decking: 1, conference: 0, first_crossover: 0 };
                  const out = []; for (const id of ids) { const i = S.issues.find(x => String(x.id) === id), bills = st.billsOfIssue(i), alive = bills.filter(st.isAlive);
                    const hear = b => S.hearings.some(h => h.bill_id === b.id && h.status === 'scheduled' && Date.parse(h.scheduled_at) > now);
                    const raw = b => { const refs = (b.referrals || []).length, c = refs - Math.min(b.origin_stops || 0, refs), stage = b.stage; return !hear(b) && !st.isAtRisk(b) && (PAST[key] || []).includes(stage) && c >= NEED[key] && (key !== 'first_crossover' || !/^(HR|SR)\\d/.test(b.bill_number)); };
                    out.push({ id, cleared: alive.length > 0 && !alive.some(b => st.isAtRisk(b) || hear(b)) && alive.some(raw) }); } return out; }"""
                if sx['nextKey'] in ('second_triple', 'second_lateral', 'second_decking', 'conference', 'first_crossover'):
                    rw = pg.evaluate(RAW, [key, sx['nextKey']]); rawc = {r['id'] for r in rw if r['cleared']}
                    ok(rawc == set(un['cleared']), f'{tag} {viewer} {key}: the cleared issues ({len(un["cleared"])}) equal a reading of the raw fields (committees from referrals minus origin stops, and the raw stage) for the next deadline {sx["nextKey"]} ({len(rawc)})')
                ok(not errs and not bad, f'{tag} {viewer} {key}: cleared heading: no console error')
                pg.context.close()

            # ---- a teammate whose issues are all in one topic is shown flat; one with several has Topics
            pg, errs, bad = open_as(br, 'JM', w, h, '#/issues?who=KV'); sk = pg.evaluate(STATEX, 'KV'); nt = len({c for r in sk['rows'] for c in r['cats']})
            ok(nt == 1 and pg.locator('#topics').count() == 0 and any(pg.locator(f'#g-{k}').count() for k in SHOWS), f'{tag} KV: all {len(sk["rows"])} issues are in {nt} topic, so the groups are flat and there is no Topics group')
            go(pg, '#/issues?who=NT'); sn = pg.evaluate(STATEX, 'NT'); nt2 = len({c for r in sn['rows'] for c in r['cats']})
            ok(nt2 >= 2 and pg.locator('#topics a.sr3').count() == nt2, f'{tag} NT: issues in {nt2} topics keep the Topics rows ({pg.locator("#topics a.sr3").count()})')
            pg.context.close()

            # ---- fixtures put into the live page data (then taken out): the group must follow the Capitol's facts, not the app's own algorithm
            pg, errs, bad = open_as(br, 'JM', w, h, '#/issues?who=all'); un0 = union_ids(pg, '#/issues?who=all'); mv = un0['moving']
            INJ = """async ([a, b, c]) => { const d = await import('/staff6/data.js'), st = await import('/staff7/standing.js'), S = d.S, now = Date.now(), H = 36e5; const alive = id => st.billsOfIssue(S.issues.find(i => String(i.id) === id)).find(st.isAlive);
              const dead = S.issues.find(i => { const bs = st.billsOfIssue(i); return bs.length && bs.every(x => !st.isAlive(x) && x.stage === 'dead'); }), db = st.billsOfIssue(dead)[0], add = (id, b, at, status) => S.hearings.push({ id, bill_id: b.id, scheduled_at: new Date(at).toISOString(), status, committee: 'JDC', room: '325', testimony_deadline: null });
              add('zz-cancel', alive(a), now + 30 * H, 'cancelled'); add('zz-past', alive(b), now - H, 'scheduled'); add('zz-dup1', alive(c), now + 30 * H, 'scheduled'); add('zz-dup2', alive(c), now + 30 * H, 'scheduled'); add('zz-dead', db, now + 30 * H, 'scheduled'); return String(dead.id); }"""
            dead_id = pg.evaluate(INJ, mv[:3]); un1 = union_ids(pg, '#/issues?who=all'); where1 = {i: k for k in SHOWS for i in un1[k]}
            ok(where1[mv[0]] == 'moving' and where1[mv[1]] == 'moving' and where1[mv[2]] == 'hearing' and where1[dead_id] == 'stopped' and all(len(un1[k]) == len(set(un1[k])) for k in SHOWS) and sum(len(v) for v in un1.values()) == sum(len(v) for v in un0.values()), f'{tag} fixtures: a cancelled future hearing and one that began an hour ago leave a moving issue moving; two rows for one hearing make it Hearing scheduled once; a future hearing on a stopped bill leaves a stopped issue stopped')
            pg.evaluate("async () => { const d = await import('/staff6/data.js'); d.S.hearings = d.S.hearings.filter(h => !String(h.id).startsWith('zz-')); }"); un2 = union_ids(pg, '#/issues?who=all')
            ok(un2 == un0, f'{tag} fixtures: taken out again, every group is as it was')
            pg.context.close()

            # ---- a hearing today says "today"; the Calendar fold still opens and closes (Issues' fold buttons never touch Calendar's)
            pg, errs, bad = open_as(br, 'KR', w, h, '#/issues?show=hearing'); sx = pg.evaluate(STATEX, 'mine'); tod = [r for r in sx['rows'] if r['state'] == 'hearing' and r['hearTxt'].startswith('today')]
            ok(tod and all(any(x['sec'] == 'Hearing ' + r['hearTxt'] or x['sec'].startswith('Hearing ' + r['hearTxt']) for x in pg.evaluate(SECOND) if x['id'] == r['id']) for r in tod), f'{tag} KR: a hearing today reads "Hearing today ..." ({[r["hearTxt"] for r in tod]})')
            go(pg, '#/calendar/sitting/HHS%7C2026-03-16T23%3A10%3A00.000Z'); f = pg.locator('#fbtn-cmte'); a0 = f.get_attribute('aria-expanded'); f.click(); pg.wait_for_timeout(150); a1 = f.get_attribute('aria-expanded'); snap(pg, 'i10_calendar_fold_still_works', tag); f.click(); pg.wait_for_timeout(150)
            ok(a0 == 'true' and a1 == 'false' and f.get_attribute('aria-expanded') == 'true' and f.locator('svg').count() == 1 and not errs, f'{tag} Calendar: "The committee" closes and opens again and keeps its chevron')
            pg.context.close()

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
