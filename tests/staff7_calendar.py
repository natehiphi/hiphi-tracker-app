# Staff7's Calendar tab (R-398), on the practice copy: the week's sittings, our bills' testimony times and the Capitol's deadlines, for Mine, a teammate and Everyone (look only), as a List and as a Week grid.
# Practice "today" is Mon 16 Mar 2026, 9:00 AM Honolulu. Two kinds of check: (1) the real practice data, with the expected week worked out here by a second, simpler reading of the same rows;
# (2) hand-made hearings with fixed dates put into the page's data (a Friday 4 PM sitting of two bills, a Saturday one, a cancelled one, a dead bill's, a repeated row, a testimony time already past),
# so the test does not just agree with the code it tests.
#   python3 tests/staff7_calendar.py [base] [shots folder]     base defaults to http://127.0.0.1:8851 (serve with a 256 backlog, one server per worktree)
import sys, os, re, json
from playwright.sync_api import sync_playwright
BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8851').rstrip('/')
SHOTS = sys.argv[2] if len(sys.argv) > 2 else ''
if SHOTS: os.makedirs(SHOTS, exist_ok=True)
res = []
def ok(c, m): res.append(bool(c)); print('PASS' if c else 'FAIL', m, flush=True)

FILLED = "() => [...document.querySelectorAll('.btn.filled')].filter(b => { const r = b.getBoundingClientRect(), s = getComputedStyle(b); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && r.top < innerHeight && r.bottom > 0; }).length"
NOSIDE = "() => document.documentElement.scrollWidth <= innerWidth && [...document.querySelectorAll('.paper')].every(p => p.scrollWidth <= p.clientWidth)"
SMALL = "() => [...document.querySelectorAll('.btn, .sr3, .seg, .pk, .cgc, .back, .crumb.back2')].filter(e => e.getBoundingClientRect().width > 0 && e.getBoundingClientRect().height < 43.5).map(e => e.className + ' ' + e.innerText.slice(0, 20))"
H1 = "() => [...document.querySelectorAll('main h1')].find(h => h.getBoundingClientRect().width > 0)?.innerText.trim()"
# every control on the page that could write: a button other than the teammate picker, a form field, a link to a step
WRITERS = "() => [...document.querySelectorAll('.paper button:not(#whoMate):not(#whoChange), .wl button:not(#whoMate):not(#whoChange), .paper input, .paper textarea, .paper select, .wl input')].map(e => e.tagName + ' ' + e.innerText.slice(0, 20))"
# a link to a step: allowed only on Mine, as the quiet "Your move" link (never filled)
STEPS = "() => [...document.querySelectorAll('a[href^=\"#/do/\"]')].map(a => [a.className, a.innerText.trim()])"
SITS = "root => [...document.querySelectorAll(root + ' [data-sit]')].map(a => [a.dataset.sit, a.innerText.replace(/\\s+/g, ' ').trim()])"
SESSION_KEYS = ['first_crossover', 'second_triple', 'second_lateral', 'second_decking', 'conference', 'governor']
# what the data says for a set and a week (Monday, 'YYYY-MM-DD'), read afresh here: sittings {key: bills}, testimony times {key|due: bills}, the Capitol's deadlines {key: date}
EXPECT = """async ([who, mon]) => { const d = await import('/staff6/data.js'), st = await import('/staff7/standing.js'); const S = d.S;
  const ymd = t => new Date(t).toLocaleDateString('en-CA', { timeZone: 'Pacific/Honolulu' }), noon = s => new Date(s + 'T12:00:00-10:00').getTime();
  const days = new Set([0,1,2,3,4,5,6].map(i => ymd(noon(mon) + i * 864e5)));
  const me0 = S.me, shown = x => { const w = new Date(noon(x)).getUTCDay(); return w === 6 ? ymd(noon(x) + 2 * 864e5) : w === 0 ? ymd(noon(x) + 864e5) : x; };
  const withMe = (p, fn) => { const prev = S.me; S.me = p; try { return fn(); } finally { S.me = prev; } };
  let ids; if (who === 'all') ids = S.issues.filter(i => !i.archived_at).map(i => String(i.id)); else { const p = who === 'mine' ? S.me : S.advocates.find(a => a.initials === who); ids = withMe(p, () => [...d.myIssueIds()]); }
  const bills = new Map(); for (const id of ids) { const i = S.issues.find(x => String(x.id) === id); if (!i || i.archived_at) continue; for (const b of st.billsOfIssue(i)) if (st.isAlive(b)) bills.set(b.id, b); }
  if (who !== 'all') { const p = who === 'mine' ? me0 : S.advocates.find(a => a.initials === who), pf = S.follows;   // plus any bill the person leads or follows (Home's own reading)
    try { S.me = p; if (who !== 'mine') S.follows = new Set(Object.entries(S.followersBy || {}).filter(([, ids]) => ids.includes(p.id)).map(([id]) => id));
      for (const b of S.bills) if (b.tracked !== false && (!b.session_year || +b.session_year === +d.SESSION_YEAR) && st.isAlive(b) && d.isMine(b)) bills.set(b.id, b); } finally { S.me = me0; S.follows = pf; } }
  const seen = new Set(), sit = {}, td = {};
  for (const h of S.hearings) { if (h.status === 'cancelled' || !bills.has(h.bill_id)) continue; const dk = h.bill_id + '|' + h.scheduled_at; if (seen.has(dk)) continue; seen.add(dk);
    const k = h.committee.split('/').map(c => c.trim()).sort().join('/') + '|' + new Date(h.scheduled_at).toISOString(); if (days.has(ymd(h.scheduled_at))) sit[k] = (sit[k] || 0) + 1;
    const due = h.testimony_deadline ? new Date(h.testimony_deadline).getTime() : new Date(h.scheduled_at).getTime() - 864e5; if (days.has(shown(ymd(due)))) { const tk = k + '#' + due; td[tk] = (td[tk] || 0) + 1; } }
  const dl = {}; for (const k of %s) { const e = (d.DEADLINES || {})[k]; const dt = e && e[0] && String(e[0][1]).slice(0, 10); if (dt && days.has(dt)) dl[k] = dt; }
  return { sit, td, dl, n: bills.size }; }""" % json.dumps(SESSION_KEYS)
# put hand-made hearings into the page's data: four alive bills of the viewer's own set (A, B, C and D; D is made dead)
SETUP = """async () => { const d = await import('/staff6/data.js'), is = await import('/staff7/issues.js'), st = await import('/staff7/standing.js'); const S = d.S;
  const pick = []; for (const x of is.setFor({ kind: 'mine', code: '' }, S.me)) for (const b of x.bills) if (st.isAlive(b) && !pick.some(y => y.id === b.id)) pick.push(b);
  if (pick.length < 4) return { err: 'fewer than 4 alive bills ' + pick.length };
  const [A, B, C, D] = pick; let n = 0; const mk = (b, o) => ({ id: 'cal-test-' + (n++), bill_id: b.id, room: 'Conference Room 325', description: 'test', status: 'scheduled', testimony_deadline: null, notice_url: null, stream_url: null, stream_auto_url: null, source: 'capitol', ...o });
  D.stage_override = 'dead';
  S.hearings = [
    mk(A, { committee: 'AGR', scheduled_at: '2026-03-21T02:00:00.000Z', testimony_deadline: '2026-03-19T20:00:00.000Z', stream_url: 'https://example.com/live', notice_url: 'https://example.com/notice' }),   // 0 Fri 20 Mar 4:00 PM, testimony Thu 10:00 AM
    mk(B, { committee: 'AGR', scheduled_at: '2026-03-21T02:00:00.000Z', testimony_deadline: '2026-03-19T20:00:00.000Z' }),   // 1 the same sitting (B's letter is filed)
    mk(B, { committee: 'AGR', scheduled_at: '2026-03-21T02:00:00.000Z', testimony_deadline: '2026-03-19T20:00:00.000Z' }),   // 2 a repeated row: shown once
    mk(C, { committee: 'ECD', scheduled_at: '2026-03-21T20:00:00.000Z' }),   // 3 Sat 21 Mar 10:00 AM, no stated testimony time: a day before, Fri 10:00 AM (C's letter is filed)
    mk(A, { committee: 'JHA', scheduled_at: '2026-03-18T01:00:00.000Z', status: 'cancelled' }),   // 4 Tue 17 Mar 3:00 PM, cancelled
    mk(D, { committee: 'HLT', scheduled_at: '2026-03-18T19:00:00.000Z' }),   // 5 Wed 18 Mar 9:00 AM, a bill that has stopped
    mk(A, { committee: 'WLO', scheduled_at: '2026-03-17T00:00:00.000Z', testimony_deadline: '2026-03-16T18:00:00.000Z' }),   // 6 Mon 16 Mar 2:00 PM, testimony was due 8:00 AM, hearing still ahead: late, still accepted
    mk(B, { committee: 'HED', scheduled_at: '2026-03-16T18:00:00.000Z', testimony_deadline: '2026-03-15T18:00:00.000Z' }),   // 7 Mon 16 Mar 8:00 AM (already past), testimony was due Sun 8:00 AM: Missed, shown on Monday
    mk(A, { committee: 'JHA', scheduled_at: '2026-03-23T19:00:00.000Z', testimony_deadline: '2026-03-23T01:00:00.000Z', notice_url: 'javascript:alert(1)', stream_url: 'ftp://example.com/x' }),   // 8 Mon 23 Mar 9:00 AM, testimony Sun 22 Mar 3:00 PM
    mk(C, { committee: 'WAM/CPN', scheduled_at: '2026-03-18T21:00:00.000Z' }),   // 9 Wed 18 Mar 11:00 AM, a joint hearing listed two ways
    mk(B, { committee: 'CPN/WAM', scheduled_at: '2026-03-18T21:00:00.000Z' })];   // 10
  S.drafts[B.id] = [{ id: 'cal-d1', bill_id: B.id, hearing_id: 'cal-test-1', committee: 'AGR', status: 'filed' }];
  S.drafts[C.id] = [{ id: 'cal-d2', bill_id: C.id, hearing_id: 'cal-test-3', committee: 'ECD', status: 'filed' }];
  return { A: A.bill_number, B: B.bill_number, C: C.bill_number, D: D.bill_number, deadAlive: st.isAlive(D) }; }"""

def external_blocker(ctx, bad):
    def h(route):
        u = route.request.url
        if 'fonts.g' in u: return route.continue_()
        bad.append(u); route.abort()
    ctx.route(lambda u: '127.0.0.1' not in u and 'localhost' not in u, h)
def open_as(br, who, w, h, hash='#/calendar'):
    ctx = br.new_context(viewport={'width': w, 'height': h}); bad = []; external_blocker(ctx, bad); pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'Failed to load resource' not in m.text and 'ERR_FAILED' not in m.text else None)
    pg.goto(f'{BASE}/staff7.html?demo=1' + (f'&as={who}' if who != 'default' else '') + hash); pg.wait_for_selector('.paper', timeout=60000)
    pg.evaluate("Promise.all([document.fonts.load('600 16px Poppins'), document.fonts.load('400 16px Lato'), document.fonts.load('700 16px Lato'), document.fonts.load('500 16px Poppins')])"); pg.wait_for_timeout(500)
    return pg, errs, bad
def go(pg, hash): pg.evaluate("h => { location.hash = h; }", hash); pg.wait_for_timeout(350)
def snap(pg, name, tag):
    if SHOTS: pg.screenshot(path=os.path.join(SHOTS, f'{name}_{tag}.png'))
def body(pg): return pg.evaluate("() => document.body.innerText")
def sit_dict(pg, root):
    out = {}
    for k, t in pg.evaluate(SITS, root):
        m = re.search(r'(\d+) bills?', t); out[k] = int(m.group(1)) if m else None
    if root == '.cgrid':   # the grid names the bills (up to three, then "+N more") instead of counting them
        out = pg.evaluate("() => Object.fromEntries([...document.querySelectorAll('.cgrid a[data-sit]')].map(a => [a.dataset.sit, a.querySelectorAll('.cgn.nm').length + (+((a.innerText.match(/\\+(\\d+) more/) || [0, 0])[1]))]))")
    return out
def td_dict(pg, root):
    out = {}
    for el in pg.locator(f'{root} [data-td]').all():
        k = el.get_attribute('data-td'); out[k] = out.get(k, 0) + 1
    return out
def hrefs(pg, sel): return pg.evaluate("s => [...document.querySelectorAll(s)].map(a => a.getAttribute('href'))", sel)
def lands(pg, hs):
    bad = []
    for h in hs:
        go(pg, h); t = pg.evaluate(H1) or ''
        if not t or 'We could not find' in t or 'no longer yours' in t: bad.append((h, t))
    return bad

MON = '2026-03-16'
with sync_playwright() as p:
    br = p.chromium.launch()
    # ================= the real practice data, three people, three views, both layouts =================
    for w, h in ((1440, 900), (1280, 800)):
        tag = f'{w}x{h}'
        for who, mate in (('JM', 'KR'), ('KR', 'KV'), ('KV', 'JM')):
            pg, errs, bad = open_as(br, who, w, h)
            for view, vq in (('mine', ''), ('all', 'who=all'), ('mate', f'who={mate}')):
                for wk in ('2026-03-16', '2026-03-02'):
                    q = '&'.join(x for x in (vq, '' if wk == MON else 'w=' + wk) if x); go(pg, '#/calendar' + ('?' + q if q else ''))
                    ex = pg.evaluate(EXPECT, [{'mine': 'mine', 'all': 'all', 'mate': mate}[view], wk]); L = f'{tag} {who} {view} week {wk}'
                    got = sit_dict(pg, '.wl'); want = ex['sit']
                    ok(got == want, f'{L}: the list shows exactly the data\'s sittings with their bill counts ({len(got)} sittings; want {len(want)})')
                    gtd = td_dict(pg, '.wl'); wtd = {}
                    for k, n in ex['td'].items(): kk = k.split('#')[0]; wtd[kk] = wtd.get(kk, 0) + 1
                    ok(gtd == wtd, f'{L}: testimony times are the data\'s, one row per sitting and time ({sum(gtd.values())}; want {sum(wtd.values())})')
                    gdl = {a.get_attribute('data-dl'): 1 for a in pg.locator('.wl [data-dl]').all()}
                    ok(set(gdl) == set(ex['dl']), f'{L}: the Capitol\'s deadlines are the data\'s ({sorted(gdl)}; want {sorted(ex["dl"])})')
                    if not want: ok('No hearings for' in pg.locator('#calEmpty').inner_text() if pg.locator('#calEmpty').count() else False, f'{L}: an empty week says so in one line')
                    # the grid shows the same sittings
                    go(pg, '#/calendar?' + '&'.join(x for x in (vq, '' if wk == MON else 'w=' + wk, 'view=week') if x))
                    ok(sit_dict(pg, '.cgrid') == want and pg.locator('.cgrid').count() == 1 and pg.locator('.wl [data-sit], .wl [data-td], .wl #weekRow').count() == 0 and pg.locator('.wl .ihd').count() == 1, f'{L}: the grid shows the same sittings as the list; the left keeps only its header, no day list')
                    gtd2 = td_dict(pg, '.cgrid'); ok(gtd2 == wtd and {a.get_attribute('data-dl') for a in pg.locator('.cgrid [data-dl]').all()} == set(ex['dl']), f'{L}: the grid carries the same testimony times and deadlines')
                    ok(5 <= pg.locator('.cgcol').count() <= 7, f'{L}: five day columns at least')
            pg.context.close()
    # ================= JM on real data: pages, whose, week, view, Back =================
    for w, h in ((1440, 900), (1280, 800)):
        tag = f'{w}x{h}'
        pg, errs, bad = open_as(br, 'JM', w, h)
        ok(pg.locator('.bi[aria-current="page"]').inner_text().strip() == 'Calendar' and pg.locator('#weekRow').count() == 1, f'{tag}: Calendar is current in the bar, and the list opens with The week')
        marked = pg.evaluate("() => [...document.querySelectorAll('.wl a.sr3[aria-current=\"true\"]')].map(a => a.id || a.dataset.sit || a.dataset.dl)")
        ok(len(marked) == 1 and pg.evaluate(H1), f'{tag}: the tab never opens unmarked: one row is marked ({marked}) and the right side says "{pg.evaluate(H1)}"')
        ok(re.match(r'\d+:\d\d [AP]M · ', pg.locator('.wl a.sel').inner_text()) or marked == ['weekRow'], f'{tag}: the marked row is the next sitting from now, else The week')
        ok(pg.evaluate(FILLED) == 0 and not pg.evaluate(WRITERS) and pg.evaluate(NOSIDE) and not pg.evaluate(SMALL), f'{tag}: no filled button, nothing that writes, no sideways scroll, 44px targets ({pg.evaluate(SMALL)[:2]} {pg.evaluate(WRITERS)[:2]})')
        snap(pg, 'cal_list_JM', tag)
        # the list's rows all land on a real page (Mine, then Everyone's up to 12)
        hs = hrefs(pg, '.wl a.sr3'); ok(len(hs) >= 2 and not lands(pg, hs), f'{tag}: every row of the list opens a real page ({len(hs)} rows)')
        go(pg, '#/calendar?who=all'); hs = hrefs(pg, '.wl a.sr3')[:12]; ok(not lands(pg, hs) and not pg.evaluate(WRITERS), f'{tag}: Everyone\'s rows open real pages, none writes ({len(hs)} tried)')
        # the switch and the week survive Back
        go(pg, '#/calendar'); pg.click('#viewWeek'); pg.wait_for_timeout(300)
        ok('view=week' in pg.url and pg.locator('.cgrid').count() == 1 and pg.locator('#viewWeek').get_attribute('aria-current') == 'true', f'{tag}: Week switches to the grid and puts it in the address')
        pg.click('#wkNext'); pg.wait_for_timeout(300); u1 = pg.url
        ok('w=2026-03-23' in u1 and 'view=week' in u1 and pg.locator('#wkNow').count() == 1 and '23' in pg.evaluate(H1), f'{tag}: Next week moves the grid a week, in the address ({pg.evaluate(H1)})')
        pg.click('#wkPrev'); pg.click('#wkPrev'); pg.wait_for_timeout(300)
        ok('w=2026-03-09' in pg.url and 'Mar 9' in pg.evaluate(H1), f'{tag}: Previous week twice goes back to the week of 9 Mar')
        pg.click('#wkNow'); pg.wait_for_timeout(300); ok(not re.search(r'[?&]w=', pg.url) and 'this week' in pg.evaluate(H1) and pg.locator('#wkNow').count() == 0, f'{tag}: This week comes back to this week, and goes from the address')
        pg.go_back(); pg.wait_for_timeout(300); ok('w=2026-03-09' in pg.url and 'Mar 9' in pg.evaluate(H1), f'{tag}: Back returns to the week of 9 Mar')
        pg.go_back(); pg.go_back(); pg.go_back(); pg.go_back(); pg.wait_for_timeout(300); ok('view=week' not in pg.url and pg.locator('.wl').count() == 1, f'{tag}: Back again returns to the List ({pg.url[-40:]})')
        pg.go_forward(); pg.wait_for_timeout(300); ok('view=week' in pg.url and pg.locator('.cgrid').count() == 1, f'{tag}: Forward returns to the grid')
        pg.click('#viewList'); pg.wait_for_timeout(300); ok('view=week' not in pg.url and pg.locator('.wl').count() == 1, f'{tag}: List switches back, and the address is clean again')
        ok(not errs and not bad, f'{tag}: no console error, nothing left 127.0.0.1 ({errs[:1]} {bad[:1]})')
        pg.context.close()

    # ================= hand-made hearings, JM, both layouts =================
    KEYS = {'WLO': 'WLO|2026-03-17T00:00:00.000Z', 'HED': 'HED|2026-03-16T18:00:00.000Z', 'JOINT': 'CPN/WAM|2026-03-18T21:00:00.000Z', 'AGR': 'AGR|2026-03-21T02:00:00.000Z', 'ECD': 'ECD|2026-03-21T20:00:00.000Z', 'JHA': 'JHA|2026-03-23T19:00:00.000Z'}
    def kq(k): return k.replace('|', '%7C').replace(':', '%3A').replace('/', '%2F')
    DAYS = "() => [...document.querySelectorAll('.wl section')].map(s => [s.querySelector('h3').innerText.replace(/ · .*/, ''), [...s.querySelectorAll('a.sr3 b')].map(b => b.innerText.replace(/\\s+/g, ' ').trim())])"
    for w, h in ((1440, 900), (1280, 800)):
        tag = f'{w}x{h}'
        pg, errs, bad = open_as(br, 'JM', w, h, '#/')
        s = pg.evaluate(SETUP); ok('err' not in s and s['deadAlive'] is False, f'{tag}: hand-made data is in ({s})')
        go(pg, '#/issues'); go(pg, '#/calendar')
        want = {KEYS['WLO']: 1, KEYS['HED']: 1, KEYS['JOINT']: 2, KEYS['AGR']: 2, KEYS['ECD']: 1}
        ok(sit_dict(pg, '.wl') == want, f'{tag}: five sittings; Friday 4 PM is two bills in one sitting (the repeated row once); the joint hearing listed as WAM/CPN and as CPN/WAM is one sitting of two bills; the cancelled one and the dead bill\'s are not there ({sit_dict(pg, ".wl")})')
        dd = dict((a, b) for a, b in pg.evaluate(DAYS)); L = list(dd)
        ok(L == ['Mon, Mar 16', 'Tue, Mar 17', 'Wed, Mar 18', 'Thu, Mar 19', 'Fri, Mar 20', 'Sat, Mar 21'], f'{tag}: Monday to Friday, plus Saturday because a hearing falls on it, no Sunday ({L})')
        mon = dd['Mon, Mar 16']
        ok(len(mon) == 4 and mon[0] == 'Testimony was due Sun 8:00 AM' and mon[1].startswith('8:00 AM · ') and mon[2] == 'Testimony was due 8:00 AM' and mon[3].startswith('2:00 PM · '), f'{tag}: Monday in time order: a weekend testimony time shown on the Monday it serves ("Sun 8:00 AM"), then the 8:00 sitting and testimony, then 2:00 PM ({mon})')
        ok(dd['Tue, Mar 17'] == ['Testimony due 11:00 AM'] and len(dd['Wed, Mar 18']) == 1 and dd['Wed, Mar 18'][0].startswith('11:00 AM · '), f'{tag}: Tuesday: the joint hearing\'s testimony time; Wednesday: the joint sitting only (the dead bill\'s 9 AM hearing is not there) ({dd["Tue, Mar 17"]} {dd["Wed, Mar 18"]})')
        ok(dd['Thu, Mar 19'] == ['First committee deadline', 'Testimony due 10:00 AM'], f'{tag}: Thursday: the Capitol\'s deadline first, then testimony due 10:00 AM ({dd["Thu, Mar 19"]})')
        fri = dd['Fri, Mar 20']; ok(fri[0] == 'Testimony due 10:00 AM' and fri[1].startswith('4:00 PM · ') and dd['Sat, Mar 21'][0].startswith('10:00 AM · '), f'{tag}: Friday in time order (testimony due 10:00 AM, then the 4:00 PM sitting); Saturday has its hearing ({fri})')
        ok(pg.evaluate("() => [...document.querySelectorAll('.wl a[data-td] .imark')].every(m => /--act/.test(m.getAttribute('style')) && !/--edge/.test(m.getAttribute('style')))") and pg.locator('.wl a[data-td] .imark[style*="--edge"]').count() == 0, f'{tag}: testimony rows have the same tile as hearing rows, never the grey stopped tile')
        # where the letters stand, by state and not by the clock
        td = lambda k, i=0: pg.locator(f'.wl a[data-td="{KEYS[k]}"] .tdst').nth(i)
        t_wlo, t_hed, t_ecd, t_agr, t_joint = [pg.locator(f'.wl a[data-td="{KEYS[k]}"]').first for k in ('WLO', 'HED', 'ECD', 'AGR', 'JOINT')]
        ok(re.search(r' · Late, still accepted until 2:00 PM', t_wlo.inner_text()) and 'risk' in td('WLO').get_attribute('class') and 'late' in td('WLO').get_attribute('class'), f'{tag}: not filed, time gone, hearing still ahead: amber "Late, still accepted until 2:00 PM today" ({t_wlo.inner_text()!r})')
        ok(t_hed.inner_text().strip().endswith('· Missed') and 'missed' in td('HED').get_attribute('class') and 'risk' not in td('HED').get_attribute('class'), f'{tag}: not filed and the hearing gone: neutral "Missed" ({t_hed.inner_text()!r})')
        ok(t_ecd.inner_text().strip().endswith('· Filed') and 'done' in td('ECD').get_attribute('class') and td('ECD').locator('svg').count() == 1 and 'risk' not in td('ECD').get_attribute('class'), f'{tag}: all filed: neutral, with a check ({t_ecd.inner_text()!r})')
        ok('2 bills · 1 of 2 filed' in t_agr.inner_text() and 'plain' in td('AGR').get_attribute('class'), f'{tag}: two bills, one filed, the time not gone: "2 bills · 1 of 2 filed", neutral ({t_agr.inner_text()!r})')
        ok('2 bills · not filed yet' in t_joint.inner_text(), f'{tag}: two bills, none filed: "2 bills · not filed yet" ({t_joint.inner_text()!r})')
        ok('Committee' not in t_agr.inner_text() and 'House Agriculture' not in t_agr.inner_text(), f'{tag}: the testimony row does not repeat the committee')
        # S-20: the row you click is the row marked
        t_agr.click(); pg.wait_for_timeout(300); marked = pg.evaluate("() => [...document.querySelectorAll('.wl a.sr3[aria-current=\"true\"]')].map(a => a.dataset.td ? 'td' : a.dataset.sit ? 'sit' : a.dataset.dl ? 'dl' : a.id)")
        tx = pg.locator('.paper').inner_text()
        ok(marked == ['td'] and '/testimony/' in pg.url and pg.locator('.paper .tdl').first.inner_text().startswith('Testimony due Thu 10:00 AM · 2 bills · 1 of 2 filed') and 'Our 2 bills' in tx, f'{tag}: a testimony row is the row marked, and opens the sitting with its testimony line at the top ({marked})')
        pg.locator(f'.wl a[data-sit="{KEYS["AGR"]}"]').click(); pg.wait_for_timeout(300)
        ok(pg.evaluate("() => [...document.querySelectorAll('.wl a.sr3[aria-current=\"true\"]')].map(a => a.dataset.sit ? 'sit' : a.dataset.td ? 'td' : '?')") == ['sit'] and pg.locator('.paper .tdl').count() == 0, f'{tag}: a hearing row is the row marked, and its page has no testimony line on top')
        pg.locator('.wl a[data-dl]').click(); pg.wait_for_timeout(300)
        ok(pg.evaluate("() => [...document.querySelectorAll('.wl a.sr3[aria-current=\"true\"]')].map(a => a.dataset.dl ? 'dl' : '?')") == ['dl'] and pg.locator('.wl a[data-dl].sel').count() == 1, f'{tag}: an open deadline row is marked, as sitting rows are')
        # the two-bill sitting's page
        go(pg, '#/calendar/sitting/' + kq(KEYS['AGR'])); t = pg.locator('.paper').inner_text()
        ok('Agriculture' in (pg.evaluate(H1) or '') and 'Fri, Mar 20 · 4:00 PM' in t and 'Room 325' in t and 'Our 2 bills' in t, f'{tag}: the sitting\'s page: committee, day and time, room, "Our 2 bills" ({pg.evaluate(H1)})')
        ok(pg.locator('.paper a[href="https://example.com/live"]').inner_text() == 'Watch it live' and pg.locator('.paper a[href="https://example.com/notice"]').inner_text() == 'Read the notice', f'{tag}: the watch link and the notice link are there')
        ok(re.search(r'Testimony due\s+Thu 10:00 AM', t) and t.count('Testimony due') == 1, f'{tag}: both bills share one testimony time, so it is said once ({t.count("Testimony due")})')
        rows = pg.locator('.paper .brow'); ok(rows.count() == 2 and all(re.match(r'^#/bill/[^?]+\?i=', hr) for hr in hrefs(pg, '.paper .bn2')), f'{tag}: each of our bills is a row linking to its bill page ({hrefs(pg, ".paper .bn2")})')
        txt = [rows.nth(i).inner_text() for i in range(2)]
        ok(all(re.search(r'(Support|Oppose|Monitor|No position|Neutral|Comments|Amend)', x) and (' lead' in x or 'No lead yet' in x) for x in txt) and sum('Filed' in x for x in txt) == 1 and sum('Writing' in x or 'Not started' in x for x in txt) == 1, f'{tag}: each bill has its position and lead and where its testimony stands (one Filed, one not) ({txt})')
        ok(not pg.evaluate(WRITERS) and pg.evaluate(FILLED) == 0 and all('quiet' in c and t.startswith('Your move · ') for c, t in pg.evaluate(STEPS)), f'{tag}: the sitting page writes nothing; a step link, if any, is the quiet "Your move" ({pg.evaluate(STEPS)})')
        bh = hrefs(pg, '.paper .bn2'); go(pg, bh[0]); ok('We could not find' not in (pg.evaluate(H1) or '') and pg.locator('.pn').count() == 1, f'{tag}: a bill row lands on its bill page in Issues ({pg.evaluate(H1)})')
        go(pg, '#/calendar/sitting/' + kq(KEYS['WLO'])); t = pg.locator('.paper').inner_text()
        ok('Testimony was due' in t and 'Our bill' in t and 'Our 2 bills' not in t and 'Late, still accepted until 2:00 PM' in t, f'{tag}: a past testimony time reads "Testimony was due"; one bill says "Our bill"; the late words are the app\'s own')
        go(pg, '#/calendar/sitting/' + kq(KEYS['ECD'])); ok('Fri 10:00 AM' in pg.locator('.paper').inner_text() and 'Sat, Mar 21' in pg.locator('.paper').inner_text() and 'Filed' in pg.locator('.paper').inner_text(), f'{tag}: with no stated testimony time it is a day before the hearing (Fri 10:00 AM)')
        go(pg, '#/calendar/sitting/' + kq(KEYS['JOINT'])); ok('Our 2 bills' in pg.locator('.paper').inner_text(), f'{tag}: the joint sitting\'s page holds both bills')
        # links that are not http(s) are not drawn; a weekend testimony time is on the Monday it serves
        go(pg, '#/calendar?w=2026-03-23'); mon = dict((a, b) for a, b in pg.evaluate(DAYS))['Mon, Mar 23']
        ok(mon[0] == 'Testimony due Sun 3:00 PM' and mon[1].startswith('9:00 AM · '), f'{tag}: the next Monday: "Testimony due Sun 3:00 PM", then the 9:00 AM sitting ({mon})')
        ok(pg.locator('.wl .hint.nothing').count() >= 1, f'{tag}: in a week with something, a day with nothing keeps a quiet "Nothing scheduled"')
        go(pg, '#/calendar/sitting/' + kq(KEYS['JHA'])); ok(pg.locator('.paper a[target="_blank"]').count() == 0 and 'Watch it live' not in pg.locator('.paper').inner_text() and 'Read the notice' not in pg.locator('.paper').inner_text(), f'{tag}: a notice or video link that is not http(s) is not drawn')
        ok('Mar 23' in pg.locator('#weekRow').inner_text(), f'{tag}: a sitting opened with no week shows its own week on the left')
        go(pg, '#/calendar/sitting/' + kq(KEYS['AGR']) + '?w=2026-01-05'); ok('Mar 16' in pg.locator('#weekRow').inner_text() and pg.locator(f'.wl a.sel[data-sit="{KEYS["AGR"]}"]').count() == 1, f'{tag}: a sitting opened with a ?w of another week still shows its own week, with its row marked')
        go(pg, '#/calendar/sitting/' + kq(KEYS['AGR']) + '?w=2031-01-05'); ok('Mar 16' in pg.locator('#weekRow').inner_text(), f'{tag}: the same when ?w is clamped')
        # the week's summary, Mine
        go(pg, '#/calendar/week'); hh = pg.evaluate(H1); sub = pg.locator('.ovsub').inner_text() if pg.locator('.ovsub').count() else ''
        ok(re.match(r'^4 letters still to write · the first is late, still accepted until 2:00 PM today$', hh) and sub == '2 other hearings need nothing from you.', f'{tag}: the week page: what needs you, then the rest in one quiet line ({hh!r} / {sub!r})')
        ok(pg.locator('#stillOpen').count() == 1 and pg.locator('.paper .brow').count() == 4 and 'of your bills have' not in pg.locator('.paper').inner_text() and pg.locator('.wl a#weekRow.sel').count() == 1, f'{tag}: it lists the four open letters, with no broken sentence, and The week row is marked')
        ok(all('quiet' in c and t.startswith('Your move · ') for c, t in pg.evaluate(STEPS)) and pg.evaluate(FILLED) == 0, f'{tag}: its step links are the quiet "Your move" only')
        go(pg, '#/calendar/week?who=all'); hh = pg.evaluate(H1); ok((hh.startswith('Everyone has ') or hh.startswith('Nothing is waiting')) and 'Look only' in pg.locator('.paper').inner_text() and not pg.evaluate(STEPS), f'{tag}: Everyone\'s week page is worded for everyone, look only, no step link ({hh!r})')
        go(pg, '#/calendar/week?who=KR'); hh = pg.evaluate(H1); ok(re.match(r'^(Kris has |Nothing needs Kris|A quiet week)', hh) and 'Look only' in pg.locator('.paper').inner_text() and not pg.evaluate(STEPS), f'{tag}: a teammate\'s week page names the teammate, look only ({hh!r})')
        # the deadline's page, Mine: the quiet "Your move" on at-risk bills
        go(pg, '#/calendar'); pg.click('.wl a[data-dl]'); pg.wait_for_timeout(400); t = pg.locator('.paper').inner_text()
        ok(pg.evaluate(H1) == 'First committee deadline' and 'Thu, Mar 19 · 3 days' in t and 'must clear their first committee' in t and ('Touches your bills' in t or 'touches none of your bills' in t), f'{tag}: the deadline\'s page: plain name, date, what it means, the bills it touches ({pg.evaluate(H1)})')
        risk = pg.locator('.paper .brow:has(.riskt)').count(); mv = pg.locator('.paper .brow:has(.riskt) .ymove').count()
        ok(mv <= risk and pg.locator('.paper .brow:not(:has(.riskt)) .ymove').count() == 0 and all(t.startswith('Your move · ') for c, t in pg.evaluate(STEPS)), f'{tag}: "Your move" appears only on an at-risk bill of its own ({mv} of {risk} at-risk rows)')
        bl = hrefs(pg, '.paper .bn2'); ok(not lands(pg, bl[:6]), f'{tag}: the deadline\'s bills land on real pages ({len(bl)})')
        go(pg, '#/calendar'); pg.click('.wl a[data-dl]'); pg.wait_for_timeout(400); snap(pg, 'cal_deadline_JM_crafted', tag)
        # the grid
        go(pg, '#/calendar?view=week'); g = sit_dict(pg, '.cgrid')
        ok(g == want and pg.locator('.cgcol').count() == 6, f'{tag}: the grid has the same five sittings in six columns (Saturday has one) ({pg.locator(".cgcol").count()})')
        ok(pg.evaluate(H1) == 'Mar 16 – 21 · this week', f'{tag}: the grid\'s heading covers the first to the last day shown ({pg.evaluate(H1)})')
        thu = pg.locator('.cgcol').nth(3).evaluate("c => [...c.querySelectorAll('.cgc')].map(a => a.className.split(' ').slice(1, 2).join(''))")
        fr = pg.locator('.cgcol').nth(4).evaluate("c => [...c.querySelectorAll('.cgc')].map(a => a.className.split(' ').slice(1, 2).join(''))")
        ok(thu == ['dl', 'td'] and fr == ['td', 'sit'], f'{tag}: the grid\'s days read deadline first, then everything by time ({thu} {fr})')
        ok(pg.locator('.cgcol').nth(0).evaluate("c => [...c.querySelectorAll('.cgc')].map(a => a.innerText.replace(/\\s+/g, ' ').split(' ')[0])") == ['Was', '8:00', 'Was', '2:00'], f'{tag}: Monday\'s chips are in time order too')
        chip = pg.locator(f'.cgrid a[data-sit="{KEYS["AGR"]}"]'); ok(re.match(r'^4:00 PM · House Agriculture', chip.inner_text()) and chip.locator('.cgn.nm').count() == 2 and pg.locator('.cgrid .nb').first.evaluate("e => getComputedStyle(e).whiteSpace") == 'nowrap', f'{tag}: a hearing chip reads "4:00 PM · committee" with our bill names; times never wrap ({chip.inner_text()!r})')
        ok(re.search(r'Missed', pg.locator(f'.cgrid a[data-td="{KEYS["HED"]}"]').inner_text()) and re.search(r'Late, still accepted', pg.locator(f'.cgrid a[data-td="{KEYS["WLO"]}"]').inner_text()) and pg.locator(f'.cgrid a[data-td="{KEYS["ECD"]}"] svg').count() == 2 and pg.locator(f'.cgrid a[data-td="{KEYS["WLO"]}"].st-late').count() == 1, f'{tag}: the grid\'s testimony chips follow the same state rules')
        ok(pg.locator('.cgcol.today').count() == 1 and pg.locator('.cgcol.today .cgd').inner_text().startswith('Mon'), f'{tag}: today is marked in the grid')
        ok(pg.evaluate(FILLED) == 0 and pg.evaluate(NOSIDE) and not pg.evaluate(SMALL) and not pg.evaluate(WRITERS), f'{tag}: the grid: no filled button, no sideways scroll, 44px ({pg.evaluate(SMALL)[:2]})')
        snap(pg, 'cal_grid_JM_crafted', tag)
        # the List | Week switch does not move when pressed
        def box(sel): return pg.locator(sel).bounding_box()
        go(pg, '#/calendar'); b1 = box('#viewWeek'); w1 = box('#whoMine'); t1 = box('#ihd'); pg.click('#viewWeek'); pg.wait_for_timeout(350); b2 = box('#viewWeek'); w2 = box('#whoMine'); t2 = box('#ihd')
        same = lambda a, b: all(abs(a[k] - b[k]) < 1 for k in ('x', 'y', 'width', 'height'))
        ok(same(b1, b2) and same(w1, w2) and same(t1, t2), f'{tag}: pressing Week moves nothing: the switch, the whose switch and the title stay put ({b1} {b2})')
        ok(b1['y'] < w1['y'] and b1['x'] > w1['x'] and abs((b1['y'] + b1['height'] / 2) - (t1['y'] + t1['height'] / 2)) < 12, f'{tag}: the switch is on the title line, to its right; the whose switch is below it')
        pg.click(f'.cgrid a[data-sit="{KEYS["AGR"]}"]'); pg.wait_for_timeout(300)
        ok(pg.locator('#backWeek').inner_text().strip() == 'Back to the week' and pg.locator('.wl [data-sit]').count() == 0 and 'Agriculture' in pg.evaluate(H1) and same(box('#viewWeek'), b1), f'{tag}: a sitting picked in the grid opens its page, with "Back to the week", the header where it was')
        snap(pg, 'cal_sitting_JM_crafted', tag)
        pg.click('#backWeek'); pg.wait_for_timeout(300); ok(pg.locator('.cgrid').count() == 1 and 'view=week' in pg.url, f'{tag}: the link returns to the grid')
        pg.click('.cgrid a[data-dl]'); pg.wait_for_timeout(300); ok(pg.locator('#backWeek').count() == 1 and pg.evaluate(H1) == 'First committee deadline', f'{tag}: a deadline picked in the grid has the same link')
        pg.go_back(); pg.wait_for_timeout(300); ok(pg.locator('.cgrid').count() == 1, f'{tag}: Back from it returns to the grid')
        pg.click('.cgrid a[data-td]'); pg.wait_for_timeout(300); ok(pg.locator('.tdl').count() >= 1 and pg.locator('#backWeek').count() == 1, f'{tag}: a testimony chip opens the sitting with its testimony line, and the same link')
        # an empty week says it once; with something, only the days with nothing say so
        dl = pg.evaluate("async () => { const w = await import('/staff7/words.js'); const r = w.sessionDates(null).find(r => r.date > '2026-03-30'); return [r.date, r.label]; }")
        import datetime as dt
        d0 = dt.date.fromisoformat(dl[0]); monday = (d0 - dt.timedelta(days=d0.weekday())).isoformat()
        for view in ('', '&view=week'):
            go(pg, f'#/calendar?w={monday}{view}'); bt = body(pg)
            ok(bt.count('No hearings for your bills this week.') == 1 and 'Nothing scheduled' not in bt and pg.locator('.wl [data-dl], .cgrid [data-dl]').count() >= 1 and pg.locator('.wl [data-sit], .cgrid [data-sit]').count() == 0, f'{tag}: an empty week with a deadline{" (grid)" if view else ""}: the one calm line once, no "Nothing scheduled", the deadline ({dl})')
        go(pg, f'#/calendar?w={monday}'); ok(pg.evaluate(H1) == 'A quiet week' and pg.locator('.ovsub').inner_text() == '1 Capitol deadline this week.', f'{tag}: the overview does not say it again ({pg.evaluate(H1)!r})')
        go(pg, '#/calendar?w=2026-12-07'); bt = body(pg); ok(bt.count('No hearings for your bills this week.') == 1 and pg.locator('.wl [data-dl], .wl [data-sit], .wl [data-td]').count() == 0 and pg.evaluate(H1) == 'A quiet week' and pg.locator('.ovsub').count() == 0, f'{tag}: an empty week with nothing else: the line once, "A quiet week" ({pg.evaluate(H1)})')
        snap(pg, 'cal_empty_JM_crafted', tag)
        go(pg, '#/calendar?w=2026-12-09'); ok('w=2026-12-09' in pg.url and 'Dec 7' in pg.locator('#weekRow').inner_text(), f'{tag}: a ?w= that is not a Monday is read as its Monday')
        for bad_h in ('#/calendar?w=nonsense', '#/calendar?w=2026-02-31', '#/calendar?view=wat'):
            go(pg, bad_h); ok('this week' in pg.locator('#weekRow').inner_text(), f'{tag}: {bad_h} falls back to this week and the List')
        for bad_h in ('#/calendar/sitting/nope', '#/calendar/deadline/nope', '#/calendar/testimony/nope', '#/calendar/zzz', '#/calendar?who=ZZ'):
            go(pg, bad_h); ok('We could not find' in (pg.evaluate(H1) or '') and pg.locator('a:has-text("Back to Calendar")').count() >= 1, f'{tag}: {bad_h} is a calm "not found" with a way back')
        ok(not errs and not bad, f'{tag}: no console error, nothing left 127.0.0.1 ({errs[:1]} {bad[:1]})')
        pg.context.close()

    # ================= one "mine": Home's next hearing is on Calendar Mine, for every practice person; a teammate's view is that person's Mine =================
    PEOPLE = ['default', 'KV', 'KR', 'JS', 'JM', 'LR', 'SY', 'MR', 'JN', 'PH']; seen_any = 0; MINE = {}
    NEXT = """async () => { const d = await import('/staff6/data.js'), hm = await import('/staff7/home.js'); const x = hm.nextHearing(d.S.me); if (!x) return null;
      const ymd = t => new Date(t).toLocaleDateString('en-CA', { timeZone: 'Pacific/Honolulu' }), n12 = s => new Date(s + 'T12:00:00-10:00').getTime(), day = ymd(x.h.scheduled_at), dw = (new Date(n12(day)).getUTCDay() + 6) % 7;
      return { mon: ymd(n12(day) - dw * 864e5), key: x.h.committee.split('/').map(c => c.trim()).sort().join('/') + '|' + new Date(x.h.scheduled_at).toISOString(), no: x.b.bill_number, ini: d.S.me.initials }; }"""
    for who in PEOPLE:
        pg, errs, bad = open_as(br, who, 1440, 900, '#/'); nx = pg.evaluate(NEXT)
        if nx:
            seen_any += 1; go(pg, f'#/calendar?w={nx["mon"]}'); keys = [k for k, _ in pg.evaluate(SITS, '.wl')]
            ok(nx['key'] in keys, f'{who}: Home\'s next hearing ({nx["no"]}, {nx["key"]}) is on Calendar Mine')
            MINE[nx['ini']] = None
        else: ok(True, f'{who}: Home has no next hearing; nothing to find')
        for wk in ('2026-03-16', '2026-03-02'):
            go(pg, f'#/calendar?w={wk}'); MINE[(who, wk)] = sit_dict(pg, '.wl')
        pg.context.close()
    ok(seen_any >= 3, f'at least three practice people have a next hearing on Home ({seen_any})')
    for viewer, mate_, mine_who in (('JM', 'KR', 'KR'), ('KR', 'JM', 'JM'), ('KV', 'JS', 'JS')):
        pg, errs, bad = open_as(br, viewer, 1440, 900, '#/calendar')
        for wk in ('2026-03-16', '2026-03-02'):
            go(pg, f'#/calendar?who={mate_}&w={wk}'); got = sit_dict(pg, '.wl')
            ok(got == MINE[(mine_who, wk)], f'{viewer} looking at {mate_}\'s calendar, week {wk}: the same sittings as {mate_}\'s own Mine ({len(got)} sittings)')
        pg.context.close()

    # ================= the teammate picker closes when the tab changes =================
    pg, errs, bad = open_as(br, 'JM', 1440, 900, '#/issues'); pg.click('#whoMate'); ok(pg.locator('#whoPick').is_visible(), 'Issues: the teammate picker is open')
    pg.click('.bi:has-text("Calendar")'); pg.wait_for_timeout(300); ok(not pg.locator('#whoPick').is_visible(), 'Calendar: the picker left open in Issues is closed')
    pg.click('#whoMate'); pg.click('.bi:has-text("Issues")'); pg.wait_for_timeout(300); ok(not pg.locator('#whoPick').is_visible(), 'Issues: the picker left open in Calendar is closed')
    pg.context.close()

    # ================= a teammate's calendar and Everyone's are look only =================
    pg, errs, bad = open_as(br, 'JM', 1440, 900, '#/calendar')
    pg.click('#whoMate'); ok(pg.locator('#whoPick').is_visible() and pg.locator('#whoPick a').count() >= 3, 'JM: A teammate opens the picker of teammates')
    pg.click('#who-KR'); pg.wait_for_timeout(300)
    ok('who=KR' in pg.url and pg.locator('#ihd').inner_text().endswith('’s calendar') and pg.locator('#ihd').inner_text() != 'Calendar', f'JM: picking Kris opens a teammate\'s calendar in the address ({pg.locator("#ihd").inner_text()})')
    sk = pg.locator('.wl a[data-sit]')
    if sk.count(): sk.first.click(); pg.wait_for_timeout(300); ok('Look only' in pg.locator('.paper').inner_text() and not pg.evaluate(WRITERS) and pg.evaluate(FILLED) == 0, f'JM: a sitting in a teammate\'s calendar says "Look only" and writes nothing ({pg.evaluate(WRITERS)})')
    else: ok(True, 'JM: Kris has no sitting this week; the look-only page is covered on Everyone')
    go(pg, '#/calendar?who=all'); snap(pg, 'cal_list_everyone', '1440x900'); pg.locator('.wl a[data-sit]').first.click(); pg.wait_for_timeout(300)
    ok('Look only' in pg.locator('.paper').inner_text() and not pg.evaluate(WRITERS) and pg.evaluate(FILLED) == 0 and not pg.evaluate(STEPS), 'JM: a sitting on Everyone\'s calendar says "Look only" and has no link to a step')
    go(pg, '#/calendar?who=all&view=week'); ok(pg.locator('.paper').inner_text().count('Look only') >= 1 and not pg.evaluate(WRITERS) and pg.evaluate(NOSIDE), 'JM: Everyone\'s grid is look only and has no sideways scroll')
    ok(not re.search(r'vap(e|es|ing)\b', body(pg), re.I), 'no "vape" in Everyone\'s grid')
    for hsh in ('#/calendar', '#/calendar?who=all', '#/calendar?who=KR', '#/calendar?view=week', '#/calendar?who=all&view=week'):
        go(pg, hsh); ok(not re.search(r'vap(e|es|ing)\b', body(pg), re.I), f'no "vape" at {hsh}')
    ok(not errs and not bad, f'JM: no console error, nothing left 127.0.0.1 ({errs[:1]} {bad[:1]})'); pg.context.close()

    # ================= Home sends people here =================
    pg, errs, bad = open_as(br, 'JM', 1440, 900, '#/')
    href = pg.evaluate("() => [...document.querySelectorAll('a[href=\"#/calendar\"]')].length")
    ok(href >= 1, f'Home: the "next hearing" fact links to #/calendar ({href})')
    pg.locator('a[href="#/calendar"]').first.click(); pg.wait_for_timeout(400)
    ok(pg.locator('.bi[aria-current="page"]').inner_text().strip() == 'Calendar' and pg.locator('#ihd').inner_text() == 'Calendar' and pg.locator('.wl a.sr3[aria-current="true"]').count() == 1, 'Home: that link lands on Calendar, with a row marked')
    pg.go_back(); pg.wait_for_timeout(300); ok(pg.locator('.bi[aria-current="page"]').inner_text().strip() == 'Home', 'Home: Back returns to Home'); pg.context.close()

    # ================= phone: the list only, then a picked thing with "Back to Calendar" =================
    pg, errs, bad = open_as(br, 'JM', 390, 844, '#/calendar?view=week')
    ok(pg.locator('#viewWeek').count() == 0 and pg.locator('.cgrid').count() == 0 and pg.locator('.wl').is_visible(), 'phone: no grid and no switch, even from ?view=week: the list shows first')
    ok(pg.evaluate(NOSIDE) and not pg.evaluate(SMALL) and pg.evaluate(FILLED) == 0, f'phone: list: no sideways scroll, 44px, no filled button ({pg.evaluate(SMALL)[:2]})')
    snap(pg, 'cal_phone_list', '390x844')
    first = pg.locator('.wl a[data-sit]').first
    if first.count():
        first.click(); pg.wait_for_timeout(350)
        ok(pg.locator('.back.backhome').inner_text().strip() == 'Back to Calendar' and not pg.locator('.wl').is_visible() and 'view=week' not in pg.url, 'phone: a picked sitting opens with "Back to Calendar", the list hidden')
        ok(pg.evaluate(NOSIDE) and not pg.evaluate(SMALL), f'phone: sitting: no sideways scroll, 44px ({pg.evaluate(SMALL)[:2]})'); snap(pg, 'cal_phone_sitting', '390x844')
        pg.click('.back.backhome'); pg.wait_for_timeout(350); ok(pg.locator('.wl').is_visible(), 'phone: Back to Calendar returns to the list')
    go(pg, '#/calendar'); pg.locator('.wl a[data-dl]').first.click(); pg.wait_for_timeout(350)
    ok(pg.locator('.back.backhome').inner_text().strip() == 'Back to Calendar' and pg.evaluate(NOSIDE) and not pg.evaluate(SMALL), 'phone: a deadline\'s page has the same way back, no sideways scroll'); snap(pg, 'cal_phone_deadline', '390x844')
    ok(not errs and not bad, f'phone: no console error ({errs[:1]})'); pg.context.close()
    br.close()
print(f'{sum(res)}/{len(res)} passed'); sys.exit(0 if all(res) else 1)
