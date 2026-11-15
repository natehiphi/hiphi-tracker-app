# Staff7's Calendar tab (R-398), on the practice copy: the week's sittings, our bills' testimony times and the Capitol's deadlines, for Mine, a teammate and Everyone (look only), as the Week grid (the default on a laptop) and as a List (?view=list; the phone is the List only).
# A thing picked in the Week grid opens beside its own day (the day paper) with a Close control; the hearing sheet is: are we ready, our bills with their links, the other bills at the sitting, the committee.
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
# every control on the page that could write: a button other than the teammate picker and the sheet's folds (they only open and close), a form field, a link to a step
WRITERS = "() => [...document.querySelectorAll('.paper button:not(#whoMate):not(#whoChange):not(.fbtn):not(#alsoMore), .wl button:not(#whoMate):not(#whoChange), .paper input, .paper textarea, .paper select, .wl input')].map(e => e.tagName + ' ' + e.innerText.slice(0, 20))"
# a link to a step: allowed only on Mine, as the quiet "Your move" link (never filled)
STEPS = "() => [...document.querySelectorAll('a[href^=\"#/do/\"]:not(#rdyGo)')].map(a => [a.className, a.innerText.trim()])"
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

# ================= helpers for the picked-hearing tests (read the snapshot here, a second and simpler reading than the page's) =================
SNAP = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'demo', 'snapshot.json')))
LEG = {l['id']: l for l in SNAP['legislators']}; CM = {c['code']: c for c in SNAP['committees']}
def cname(code):
    c = CM[code]; n = c['name']; return n if re.match(r'(House|Senate)\b', n) else ('Senate ' if c['chamber'] == 'S' else 'House ') + n
def cexp(code):
    ms = [(m['role'], LEG[m['legislator_id']]) for m in SNAP['committeeMembers'] if m['committee'] == code and m['legislator_id'] in LEG]
    return {'name': cname(code), 'chairs': [l for r, l in ms if r == 'chair'], 'vices': [l for r, l in ms if r == 'vice_chair'], 'rest': [l for r, l in ms if r not in ('chair', 'vice_chair')], 'count': len(ms)}
SHEET = """() => { const q = s => document.querySelector(s), t = s => q(s)?.innerText.replace(/\\s+/g, ' ').trim() || '';
  return { h1: t('main h1'), kick: t('.sheetp .kick, .paper .kick'), grid: document.querySelectorAll('.cgrid').length, split: document.querySelectorAll('.split').length, cols: document.querySelectorAll('.cgcol').length,
    dayCol: q('.dayp .cgcol')?.getAttribute('aria-labelledby') || '', dayH: t('.dayp .dph'), marked: [...document.querySelectorAll('.dayp a[aria-current="true"]')].map(a => [a.dataset.sit || '', a.dataset.td || '', a.dataset.dl || '']),
    marks: document.querySelectorAll('.dayp .cgc[aria-current="true"]').length, outline: q('.dayp .cgc[aria-current="true"]') ? getComputedStyle(q('.dayp .cgc[aria-current="true"]')).outlineColor + '|' + getComputedStyle(q('.dayp .cgc[aria-current="true"]')).outlineStyle : '',
    filled: [...document.querySelectorAll('.sheetp .btn.filled, .paper .btn.filled')].length, doLinks: document.querySelectorAll('.sheetp a[href^="#/do/"], .paper a[href^="#/do/"]').length, rdy: t('.rdy'), rdyGo: q('#rdyGo')?.getAttribute('href') || '',
    bills: document.querySelectorAll('.cl .brow').length, also: document.querySelectorAll('.alsol li').length, alsoSum: t('.fbtn[data-fold="also"] .fs'), folds: [...document.querySelectorAll('.fbtn')].map(b => [b.dataset.fold, b.getAttribute('aria-expanded'), !!document.getElementById(b.getAttribute('aria-controls'))]),
    cm: [...document.querySelectorAll('.cm')].map(c => ({ name: c.querySelector('.cmn').innerText.trim(), rows: [...c.querySelectorAll('.cmr li')].map(li => [li.querySelector('.cmrole').innerText.trim(), li.querySelector('.cmwho').innerText.trim(), li.querySelector('a')?.getAttribute('href') || '', li.querySelector('a')?.getAttribute('target') || '']), members: [...c.querySelectorAll('.cmem a')].map(a => [a.innerText.trim(), a.getAttribute('href')]) })),
    cmSum: [...document.querySelectorAll('.fbtn[data-fold="cmte"] .fs')].map(e => e.textContent.replace(/\\s+/g, ' ').trim()),
    prev: q('#dayPrev') ? [q('#dayPrev').tagName, q('#dayPrev').getAttribute('aria-disabled'), q('#dayPrev').getAttribute('aria-label'), q('#dayPrev').getAttribute('href')] : null, next: q('#dayNext') ? [q('#dayNext').tagName, q('#dayNext').getAttribute('aria-disabled'), q('#dayNext').getAttribute('aria-label'), q('#dayNext').getAttribute('href')] : null,
    close: q('#calClose') ? [q('#calClose').getAttribute('aria-label'), q('#calClose').getAttribute('href')] : null, whole: q('#dayWeek')?.getAttribute('href') || '', back: !!q('#backWeek'),
    side: document.documentElement.scrollWidth <= innerWidth && [...document.querySelectorAll('.paper, .sheetp, .dayp')].every(p => p.scrollWidth <= p.clientWidth), pageScroll: document.documentElement.scrollHeight <= innerHeight, sheetOverflow: q('.sheetp') ? getComputedStyle(q('.sheetp')).overflowY : '' }; }"""
ALSO = """async key => { const d = await import('/staff6/data.js'), st = await import('/staff7/standing.js'); const S = d.S;
  const sk = h => String(h.committee || '').split('/').map(c => c.trim()).filter(Boolean).sort().join('/') + '|' + new Date(h.scheduled_at).toISOString();
  const ids = new Set(); for (const h of S.hearings) { if (h.status === 'cancelled' || sk(h) !== key) continue; const b = S.bills.find(x => x.id === h.bill_id); if (b && b.tracked !== false && st.isAlive(b)) ids.add(b.id); } return ids.size; }"""
LINKS = """async key => { const d = await import('/staff6/data.js'), m = await import('/staff6/model.js'); const S = d.S, out = [];
  const sk = h => String(h.committee || '').split('/').map(c => c.trim()).filter(Boolean).sort().join('/') + '|' + new Date(h.scheduled_at).toISOString(), http = u => /^https?:\\/\\//i.test(String(u || '').trim());
  for (const row of document.querySelectorAll('.cl .brow')) { const ref = decodeURIComponent(row.querySelector('.bn2').getAttribute('href').replace(/^#\\/bill\\//, '').split('?')[0]); const b = S.bills.find(x => m.billRef(x) === ref); if (!b) { out.push({ ref, none: 1 }); continue; }
    // the draft read straight from the data (S.drafts, by hearing_id), never through the model's sittingDraft: the draft that names this hearing, or names none and has this hearing's committee codes
    const h = S.hearings.find(x => x.bill_id === b.id && x.status !== 'cancelled' && sk(x) === key), dd = h && (S.drafts[b.id] || []).find(x => x.status !== 'cancelled' && (x.hearing_id ? x.hearing_id === h.id : String(x.committee || '').split('/').map(c => c.trim()).sort().join('/') === String(h.committee).split('/').map(c => c.trim()).sort().join('/'))), a = t => [...row.querySelectorAll('.blinks a')].find(x => x.innerText.trim() === t);
    out.push({ ref, bill: b.id, hearing: h && h.id, committee: h && h.committee, wantLetter: dd && http(dd.doc_url) ? dd.doc_url : null, letter: a('Open the letter')?.getAttribute('href') || null, letterTarget: a('Open the letter')?.getAttribute('target') || null, cap: a('On the Capitol site')?.getAttribute('href') || null, capTarget: a('On the Capitol site')?.getAttribute('target') || null, page: a('Bill page') ? 1 : 0 }); }
  return out; }"""
BILLS = {b['id']: b for b in SNAP['bills']}
def day_of(label): return label.replace('g-', '')

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
                    q = '&'.join(x for x in (vq, '' if wk == MON else 'w=' + wk, 'view=list') if x); go(pg, '#/calendar?' + q)
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
                    go(pg, '#/calendar' + ('?' + '&'.join(x for x in (vq, '' if wk == MON else 'w=' + wk) if x) if (vq or wk != MON) else ''))
                    ok(sit_dict(pg, '.cgrid') == want and pg.locator('.cgrid').count() == 1 and pg.locator('.wl [data-sit], .wl [data-td], .wl #weekRow').count() == 0 and pg.locator('.wl .ihd').count() == 1, f'{L}: the grid shows the same sittings as the list; the left keeps only its header, no day list')
                    gtd2 = td_dict(pg, '.cgrid'); ok(gtd2 == wtd and {a.get_attribute('data-dl') for a in pg.locator('.cgrid [data-dl]').all()} == set(ex['dl']), f'{L}: the grid carries the same testimony times and deadlines')
                    ok(5 <= pg.locator('.cgcol').count() <= 7, f'{L}: five day columns at least')
            pg.context.close()
    # ================= JM on real data: pages, whose, week, view, Back =================
    for w, h in ((1440, 900), (1280, 800)):
        tag = f'{w}x{h}'
        pg, errs, bad = open_as(br, 'JM', w, h, '#/calendar?view=list')
        ok(pg.locator('.bi[aria-current="page"]').inner_text().strip() == 'Calendar' and pg.locator('#weekRow').count() == 1, f'{tag}: Calendar is current in the bar, and the list opens with The week')
        marked = pg.evaluate("() => [...document.querySelectorAll('.wl a.sr3[aria-current=\"true\"]')].map(a => a.id || a.dataset.sit || a.dataset.dl)")
        ok(len(marked) == 1 and pg.evaluate(H1), f'{tag}: the tab never opens unmarked: one row is marked ({marked}) and the right side says "{pg.evaluate(H1)}"')
        ok(re.match(r'\d+:\d\d [AP]M · ', pg.locator('.wl a.sel').inner_text()) or marked == ['weekRow'], f'{tag}: the marked row is the next sitting from now, else The week')
        ok(pg.evaluate(FILLED) <= 1 and not pg.evaluate(WRITERS) and pg.evaluate(NOSIDE) and not pg.evaluate(SMALL), f'{tag}: at most the one filled button, nothing that writes, no sideways scroll, 44px targets ({pg.evaluate(SMALL)[:2]} {pg.evaluate(WRITERS)[:2]})')
        snap(pg, 'cal_list_JM', tag)
        # the list's rows all land on a real page (Mine, then Everyone's up to 12)
        hs = hrefs(pg, '.wl a.sr3'); ok(len(hs) >= 2 and not lands(pg, hs), f'{tag}: every row of the list opens a real page ({len(hs)} rows)')
        go(pg, '#/calendar?who=all&view=list'); hs = hrefs(pg, '.wl a.sr3')[:12]; ok(not lands(pg, hs) and not pg.evaluate(WRITERS), f'{tag}: Everyone\'s rows open real pages, none writes ({len(hs)} tried)')
        # the switch and the week survive Back
        go(pg, '#/calendar?view=list'); pg.click('#viewWeek'); pg.wait_for_timeout(300)
        ok('view=' not in pg.url and pg.locator('.cgrid').count() == 1 and pg.locator('#viewWeek').get_attribute('aria-current') == 'true', f'{tag}: Week switches to the grid, and the address is clean')
        pg.click('#wkNext'); pg.wait_for_timeout(300); u1 = pg.url
        ok('w=2026-03-23' in u1 and 'view=' not in u1 and pg.locator('#wkNow').count() == 1 and '23' in pg.evaluate(H1), f'{tag}: Next week moves the grid a week, in the address ({pg.evaluate(H1)})')
        pg.click('#wkPrev'); pg.click('#wkPrev'); pg.wait_for_timeout(300)
        ok('w=2026-03-09' in pg.url and 'Mar 9' in pg.evaluate(H1), f'{tag}: Previous week twice goes back to the week of 9 Mar')
        pg.click('#wkNow'); pg.wait_for_timeout(300); ok(not re.search(r'[?&]w=', pg.url) and 'this week' in pg.evaluate(H1) and pg.locator('#wkNow').count() == 0, f'{tag}: This week comes back to this week, and goes from the address')
        pg.go_back(); pg.wait_for_timeout(300); ok('w=2026-03-09' in pg.url and 'Mar 9' in pg.evaluate(H1), f'{tag}: Back returns to the week of 9 Mar')
        pg.go_back(); pg.go_back(); pg.go_back(); pg.go_back(); pg.wait_for_timeout(300); ok('view=list' in pg.url and pg.locator('.cgrid').count() == 0 and pg.locator('#weekRow').count() == 1, f'{tag}: Back again returns to the List ({pg.url[-40:]})')
        pg.go_forward(); pg.wait_for_timeout(300); ok('view=' not in pg.url and pg.locator('.cgrid').count() == 1, f'{tag}: Forward returns to the grid')
        pg.click('#viewList'); pg.wait_for_timeout(300); ok('view=list' in pg.url and pg.locator('#weekRow').count() == 1, f'{tag}: List switches to the list, and the address says so')
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
        go(pg, '#/issues'); go(pg, '#/calendar?view=list')
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
        ok(marked == ['td'] and '/testimony/' in pg.url and pg.locator('.paper .kick').first.inner_text().startswith('Testimony · due Thu 10:00 AM') and '1 of 2 filed' in tx and 'Our 2 bills' in tx, f'{tag}: a testimony row is the row marked, and opens the sitting with its testimony line at the top ({marked})')
        pg.locator(f'.wl a[data-sit="{KEYS["AGR"]}"]').click(); pg.wait_for_timeout(300)
        ok(pg.evaluate("() => [...document.querySelectorAll('.wl a.sr3[aria-current=\"true\"]')].map(a => a.dataset.sit ? 'sit' : a.dataset.td ? 'td' : '?')") == ['sit'] and pg.locator('.paper .kick').first.inner_text().startswith('Hearing ·'), f'{tag}: a hearing row is the row marked, and its page says "Hearing"')
        pg.locator('.wl a[data-dl]').click(); pg.wait_for_timeout(300)
        ok(pg.evaluate("() => [...document.querySelectorAll('.wl a.sr3[aria-current=\"true\"]')].map(a => a.dataset.dl ? 'dl' : '?')") == ['dl'] and pg.locator('.wl a[data-dl].sel').count() == 1, f'{tag}: an open deadline row is marked, as sitting rows are')
        # the two-bill sitting's page
        go(pg, '#/calendar/sitting/' + kq(KEYS['AGR']) + '?view=list'); t = pg.locator('.paper').inner_text()
        ok('Agriculture' in (pg.evaluate(H1) or '') and 'Fri, Mar 20 · 4:00 PM' in t and 'Room 325' in t and 'Our 2 bills' in t, f'{tag}: the sitting\'s page: committee, day and time, room, "Our 2 bills" ({pg.evaluate(H1)})')
        ok(pg.locator('.paper a[href="https://example.com/live"]').first.inner_text() == 'Watch it live' and pg.locator('.paper a[href="https://example.com/notice"]').first.inner_text() == 'Hearing notice', f'{tag}: the watch link and the notice link are there')
        ok(re.search(r'Testimony is due\s+Thu 10:00 AM', t) and t.count('Testimony is due') == 1 and t.count('Testimony due') == 0, f'{tag}: both bills share one testimony time, so it is said once, in the readiness block ({t.count("Testimony is due")})')
        rows = pg.locator('.paper .brow'); ok(rows.count() == 2 and all(re.match(r'^#/bill/[^?]+\?i=', hr) for hr in hrefs(pg, '.paper .bn2')), f'{tag}: each of our bills is a row linking to its bill page ({hrefs(pg, ".paper .bn2")})')
        txt = [rows.nth(i).inner_text() for i in range(2)]
        ok(all(re.search(r'(Support|Oppose|Monitor|No position|Neutral|Comments|Amend)', x) and (' lead' in x or 'No lead yet' in x) for x in txt) and sum('Letter filed' in x for x in txt) == 1 and sum('Letter not started' in x or 'Letter being written' in x or 'Letter sent back' in x for x in txt) == 1, f'{tag}: each bill has its position and lead and where its testimony stands (one Filed, one not) ({txt})')
        ok(not pg.evaluate(WRITERS) and pg.evaluate(FILLED) <= 1 and pg.locator('.paper .btn.filled').count() == pg.locator('#rdyGo').count() and all('quiet' in c and t.startswith('Your move · ') for c, t in pg.evaluate(STEPS)), f'{tag}: the sitting page writes nothing; its one filled button, if any, is the readiness block\'s; other step links are the quiet "Your move" ({pg.evaluate(STEPS)})')
        bh = hrefs(pg, '.paper .bn2'); go(pg, bh[0]); ok('We could not find' not in (pg.evaluate(H1) or '') and pg.locator('.pn').count() == 1, f'{tag}: a bill row lands on its bill page in Issues ({pg.evaluate(H1)})')
        go(pg, '#/calendar/sitting/' + kq(KEYS['WLO']) + '?view=list'); t = pg.locator('.paper').inner_text()
        ok('Our bill' in t and 'Our 2 bills' not in t and 'Late, still accepted until 2:00 PM' in t and pg.locator('.rdy.t-late').count() == 1, f'{tag}: a past testimony time on a hearing still ahead is the amber block with the app\'s own late words; one bill says "Our bill"')
        go(pg, '#/calendar/testimony/' + kq(KEYS['WLO']) + '?view=list'); ok(re.search(r'Testimony · was due today 8:00 AM', pg.locator('.paper').inner_text()), f'{tag}: a testimony page says when it was due ({pg.locator(".kick").inner_text()!r})')
        go(pg, '#/calendar/testimony/' + kq(KEYS['ECD']) + '?view=list'); ok('Testimony · due Fri 10:00 AM' in pg.locator('.paper').inner_text() and 'Sat, Mar 21' in pg.locator('.paper').inner_text() and pg.locator('.rdy.t-done').count() == 1, f'{tag}: with no stated testimony time it is a day before the hearing (Fri 10:00 AM); all filed says so')
        go(pg, '#/calendar/sitting/' + kq(KEYS['JOINT']) + '?view=list'); ok('Our 2 bills' in pg.locator('.paper').inner_text(), f'{tag}: the joint sitting\'s page holds both bills')
        # links that are not http(s) are not drawn; a weekend testimony time is on the Monday it serves
        go(pg, '#/calendar?view=list&w=2026-03-23'); mon = dict((a, b) for a, b in pg.evaluate(DAYS))['Mon, Mar 23']
        ok(mon[0] == 'Testimony due Sun 3:00 PM' and mon[1].startswith('9:00 AM · '), f'{tag}: the next Monday: "Testimony due Sun 3:00 PM", then the 9:00 AM sitting ({mon})')
        ok(pg.locator('.wl .hint.nothing').count() >= 1, f'{tag}: in a week with something, a day with nothing keeps a quiet "Nothing scheduled"')
        go(pg, '#/calendar/sitting/' + kq(KEYS['JHA']) + '?view=list'); ok(pg.locator('.paper a[href^="javascript:"], .paper a[href^="ftp:"]').count() == 0 and 'Watch it live' not in pg.locator('.paper').inner_text() and 'Hearing notice' not in pg.locator('.paper').inner_text(), f'{tag}: a notice or video link that is not http(s) is not drawn')
        ok('Mar 23' in pg.locator('#weekRow').inner_text(), f'{tag}: a sitting opened with no week shows its own week on the left')
        go(pg, '#/calendar/sitting/' + kq(KEYS['AGR']) + '?view=list&w=2026-01-05'); ok('Mar 16' in pg.locator('#weekRow').inner_text() and pg.locator(f'.wl a.sel[data-sit="{KEYS["AGR"]}"]').count() == 1, f'{tag}: a sitting opened with a ?w of another week still shows its own week, with its row marked')
        go(pg, '#/calendar/sitting/' + kq(KEYS['AGR']) + '?view=list&w=2031-01-05'); ok('Mar 16' in pg.locator('#weekRow').inner_text(), f'{tag}: the same when ?w is clamped')
        # the week's summary, Mine
        go(pg, '#/calendar/week?view=list'); hh = pg.evaluate(H1); sub = pg.locator('.ovsub').inner_text() if pg.locator('.ovsub').count() else ''
        ok(re.match(r'^4 letters still to write · the first is late, still accepted until 2:00 PM today$', hh) and sub == '2 other hearings need nothing from you.', f'{tag}: the week page: what needs you, then the rest in one quiet line ({hh!r} / {sub!r})')
        ok(pg.locator('#stillOpen').count() == 1 and pg.locator('.paper .brow').count() == 4 and 'of your bills have' not in pg.locator('.paper').inner_text() and pg.locator('.wl a#weekRow.sel').count() == 1, f'{tag}: it lists the four open letters, with no broken sentence, and The week row is marked')
        ok(all('quiet' in c and t.startswith('Your move · ') for c, t in pg.evaluate(STEPS)) and pg.evaluate(FILLED) == 0, f'{tag}: its step links are the quiet "Your move" only')
        go(pg, '#/calendar/week?who=all&view=list'); hh = pg.evaluate(H1); ok((hh.startswith('Everyone has ') or hh.startswith('Nothing is waiting')) and 'Look only' in pg.locator('.paper').inner_text() and not pg.evaluate(STEPS), f'{tag}: Everyone\'s week page is worded for everyone, look only, no step link ({hh!r})')
        go(pg, '#/calendar/week?who=KR&view=list'); hh = pg.evaluate(H1); ok(re.match(r'^(Kris has |Nothing needs Kris|A quiet week)', hh) and 'Look only' in pg.locator('.paper').inner_text() and not pg.evaluate(STEPS), f'{tag}: a teammate\'s week page names the teammate, look only ({hh!r})')
        # the deadline's page, Mine: the quiet "Your move" on at-risk bills
        go(pg, '#/calendar?view=list'); pg.click('.wl a[data-dl]'); pg.wait_for_timeout(400); t = pg.locator('.paper').inner_text()
        ok(pg.evaluate(H1) == 'First committee deadline' and 'Thu, Mar 19 · in 3 days' in t and 'must clear their first committee' in t and ('Your bills it affects' in t or 'touches none of your bills' in t), f'{tag}: the deadline\'s page: plain name, date, what it means, the bills it touches ({pg.evaluate(H1)})')
        risk = pg.locator('.paper .brow:has(.riskt)').count(); mv = pg.locator('.paper .brow:has(.riskt) .ymove').count()
        ok(mv <= risk and pg.locator('.paper .brow:not(:has(.riskt)) .ymove').count() == 0 and all(t.startswith('Your move · ') for c, t in pg.evaluate(STEPS)), f'{tag}: "Your move" appears only on an at-risk bill of its own ({mv} of {risk} at-risk rows)')
        bl = hrefs(pg, '.paper .bn2'); ok(not lands(pg, bl[:6]), f'{tag}: the deadline\'s bills land on real pages ({len(bl)})')
        go(pg, '#/calendar?view=list'); pg.click('.wl a[data-dl]'); pg.wait_for_timeout(400); snap(pg, 'cal_deadline_JM_crafted', tag)
        # the grid
        go(pg, '#/calendar'); g = sit_dict(pg, '.cgrid')
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
        go(pg, '#/calendar?view=list'); b1 = box('#viewWeek'); w1 = box('#whoMine'); t1 = box('#ihd'); pg.click('#viewWeek'); pg.wait_for_timeout(350); b2 = box('#viewWeek'); w2 = box('#whoMine'); t2 = box('#ihd')
        same = lambda a, b: all(abs(a[k] - b[k]) < 1 for k in ('x', 'y', 'width', 'height'))
        ok(same(b1, b2) and same(w1, w2) and same(t1, t2), f'{tag}: pressing Week moves nothing: the switch, the whose switch and the title stay put ({b1} {b2})')
        ok(b1['y'] < w1['y'] and b1['x'] > w1['x'] and abs((b1['y'] + b1['height'] / 2) - (t1['y'] + t1['height'] / 2)) < 12, f'{tag}: the switch is on the title line, to its right; the whose switch is below it')
        pg.click(f'.cgrid a[data-sit="{KEYS["AGR"]}"]'); pg.wait_for_timeout(300)
        ok(pg.locator('#calClose').get_attribute('aria-label') == 'Close' and pg.locator('#backWeek').count() == 0 and pg.locator('.wl [data-sit]').count() == 0 and 'Agriculture' in pg.evaluate(H1) and same(box('#viewWeek'), b1), f'{tag}: a sitting picked in the grid opens its page beside its day, with Close, the header where it was')
        snap(pg, 'cal_sitting_JM_crafted', tag)
        pg.click('#calClose'); pg.wait_for_timeout(300); ok(pg.locator('.cgrid').count() == 1 and 'view=' not in pg.url, f'{tag}: Close returns to the grid')
        pg.click('.cgrid a[data-dl]'); pg.wait_for_timeout(300); ok(pg.locator('#calClose').count() == 1 and pg.evaluate(H1) == 'First committee deadline', f'{tag}: a deadline picked in the grid has the same Close')
        pg.go_back(); pg.wait_for_timeout(300); ok(pg.locator('.cgrid').count() == 1, f'{tag}: Back from it returns to the grid')
        pg.click('.cgrid a[data-td]'); pg.wait_for_timeout(300); ok(pg.locator('.kick').first.inner_text().startswith('Testimony ·') and pg.locator('#calClose').count() == 1, f'{tag}: a testimony chip opens the sitting with its testimony line, and the same Close')
        # an empty week says it once; with something, only the days with nothing say so
        dl = pg.evaluate("async () => { const w = await import('/staff7/words.js'); const r = w.sessionDates(null).find(r => r.date > '2026-03-30'); return [r.date, r.label]; }")
        import datetime as dt
        d0 = dt.date.fromisoformat(dl[0]); monday = (d0 - dt.timedelta(days=d0.weekday())).isoformat()
        for view in ('&view=list', ''):
            go(pg, f'#/calendar?w={monday}{view}'); bt = body(pg)
            ok(bt.count('No hearings for your bills this week.') == 1 and 'Nothing scheduled' not in bt and pg.locator('.wl [data-dl], .cgrid [data-dl]').count() >= 1 and pg.locator('.wl [data-sit], .cgrid [data-sit]').count() == 0, f'{tag}: an empty week with a deadline{" (grid)" if view else ""}: the one calm line once, no "Nothing scheduled", the deadline ({dl})')
        go(pg, f'#/calendar?w={monday}&view=list'); ok(pg.evaluate(H1) == 'A quiet week' and pg.locator('.ovsub').inner_text() == '1 Capitol deadline this week.', f'{tag}: the overview does not say it again ({pg.evaluate(H1)!r})')
        go(pg, '#/calendar?w=2026-12-07&view=list'); bt = body(pg); ok(bt.count('No hearings for your bills this week.') == 1 and pg.locator('.wl [data-dl], .wl [data-sit], .wl [data-td]').count() == 0 and pg.evaluate(H1) == 'A quiet week' and pg.locator('.ovsub').count() == 0, f'{tag}: an empty week with nothing else: the line once, "A quiet week" ({pg.evaluate(H1)})')
        snap(pg, 'cal_empty_JM_crafted', tag)
        go(pg, '#/calendar?w=2026-12-09&view=list'); ok('w=2026-12-09' in pg.url and 'Dec 7' in pg.locator('#weekRow').inner_text(), f'{tag}: a ?w= that is not a Monday is read as its Monday')
        for bad_h in ('#/calendar?view=list&w=nonsense', '#/calendar?view=list&w=2026-02-31'):
            go(pg, bad_h); ok('this week' in pg.locator('#weekRow').inner_text(), f'{tag}: {bad_h} falls back to this week')
        go(pg, '#/calendar?view=wat'); ok(pg.locator('.cgrid').count() == 1 and 'this week' in pg.evaluate(H1), f'{tag}: a view that is not List is the Week grid')
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
            seen_any += 1; go(pg, f'#/calendar?w={nx["mon"]}&view=list'); keys = [k for k, _ in pg.evaluate(SITS, '.wl')]
            ok(nx['key'] in keys, f'{who}: Home\'s next hearing ({nx["no"]}, {nx["key"]}) is on Calendar Mine')
            MINE[nx['ini']] = None
        else: ok(True, f'{who}: Home has no next hearing; nothing to find')
        for wk in ('2026-03-16', '2026-03-02'):
            go(pg, f'#/calendar?w={wk}&view=list'); MINE[(who, wk)] = sit_dict(pg, '.wl')
        pg.context.close()
    ok(seen_any >= 3, f'at least three practice people have a next hearing on Home ({seen_any})')
    for viewer, mate_, mine_who in (('JM', 'KR', 'KR'), ('KR', 'JM', 'JM'), ('KV', 'JS', 'JS')):
        pg, errs, bad = open_as(br, viewer, 1440, 900, '#/calendar')
        for wk in ('2026-03-16', '2026-03-02'):
            go(pg, f'#/calendar?who={mate_}&w={wk}&view=list'); got = sit_dict(pg, '.wl')
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
    go(pg, '#/calendar?who=KR&view=list'); sk = pg.locator('.wl a[data-sit]')
    if sk.count(): sk.first.click(); pg.wait_for_timeout(300); ok('Look only' in pg.locator('.paper').inner_text() and not pg.evaluate(WRITERS) and pg.evaluate(FILLED) == 0, f'JM: a sitting in a teammate\'s calendar says "Look only" and writes nothing ({pg.evaluate(WRITERS)})')
    else: ok(True, 'JM: Kris has no sitting this week; the look-only page is covered on Everyone')
    go(pg, '#/calendar?who=all&view=list'); snap(pg, 'cal_list_everyone', '1440x900'); pg.locator('.wl a[data-sit]').first.click(); pg.wait_for_timeout(300)
    ok('Look only' in pg.locator('.paper').inner_text() and not pg.evaluate(WRITERS) and pg.evaluate(FILLED) == 0 and not pg.evaluate(STEPS), 'JM: a sitting on Everyone\'s calendar says "Look only" and has no link to a step')
    go(pg, '#/calendar?who=all&view=week'); ok(pg.locator('.paper').inner_text().count('Look only') >= 1 and not pg.evaluate(WRITERS) and pg.evaluate(NOSIDE), 'JM: Everyone\'s grid is look only and has no sideways scroll')
    ok(not re.search(r'vap(e|es|ing)\b', body(pg), re.I), 'no "vape" in Everyone\'s grid')
    for hsh in ('#/calendar', '#/calendar?who=all', '#/calendar?who=KR', '#/calendar?view=list', '#/calendar?who=all&view=list'):
        go(pg, hsh); ok(not re.search(r'vap(e|es|ing)\b', body(pg), re.I), f'no "vape" at {hsh}')
    ok(not errs and not bad, f'JM: no console error, nothing left 127.0.0.1 ({errs[:1]} {bad[:1]})'); pg.context.close()

    # ================= Home sends people here =================
    pg, errs, bad = open_as(br, 'JM', 1440, 900, '#/')
    href = pg.evaluate("() => [...document.querySelectorAll('a[href=\"#/calendar\"]')].length")
    ok(href >= 1, f'Home: the "next hearing" fact links to #/calendar ({href})')
    pg.locator('a[href="#/calendar"]').first.click(); pg.wait_for_timeout(400)
    ok(pg.locator('.bi[aria-current="page"]').inner_text().strip() == 'Calendar' and pg.locator('#ihd').inner_text() == 'Calendar' and pg.locator('.cgrid').count() == 1, 'Home: that link lands on Calendar, on the week')
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

    # ================= the Week grid is the default; List is ?view=list; the phone is the List whatever the address says =================
    pg, errs, bad = open_as(br, 'KR', 1440, 900, '#/calendar')
    ok(pg.locator('.cgrid').count() == 1 and pg.locator('#viewWeek').get_attribute('aria-current') == 'true' and pg.locator('#weekRow').count() == 0, '#/calendar at 1440x900 opens the Week grid')
    snap(pg, 'cal_week_default_KR', '1440x900')
    go(pg, '#/calendar?view=list'); ok(pg.locator('.cgrid').count() == 0 and pg.locator('#weekRow').count() == 1 and pg.locator('#viewList').get_attribute('aria-current') == 'true', '?view=list opens the List')
    pg.click('#viewWeek'); pg.wait_for_timeout(250); ok('view' not in pg.url and pg.locator('.cgrid').count() == 1, 'Week leaves the address clean')
    pg.click('#viewList'); pg.wait_for_timeout(250); ok(pg.url.endswith('view=list'), 'List writes view=list')
    ok(not errs and not bad, f'default view: no console error, nothing left 127.0.0.1 ({errs[:1]} {bad[:1]})'); pg.context.close()
    pg, errs, bad = open_as(br, 'KR', 390, 844, '#/calendar')
    ok(pg.locator('.cgrid').count() == 0 and pg.locator('#weekRow').count() == 1 and pg.locator('#viewWeek').count() == 0, 'phone: #/calendar is the list'); go(pg, '#/calendar?view=list'); ok(pg.locator('#weekRow').count() == 1, 'phone: ?view=list is the list'); pg.context.close()

    # ================= every hearing of this week, picked in the grid: five views =================
    VIEWS = [('KR', '', 'KR mine'), ('JM', '', 'JM mine'), ('KV', '', 'KV mine'), ('JM', 'who=all', 'JM sees Everyone'), ('KR', 'who=KV', 'KR sees KV')]
    seen_letters = 0; seen_also = 0; seen_cm = 0; seen_btn = 0
    for who, vq, lab in VIEWS:
        pg, errs, bad = open_as(br, who, 1440, 900, '#/calendar' + ('?' + vq if vq else ''))
        keys = pg.evaluate("() => [...new Set([...document.querySelectorAll('.cgrid a[data-sit]')].map(a => a.dataset.sit))]"); look = bool(vq)
        ok(len(keys) >= 1 or who == 'KV', f'{lab}: this week has hearings in the grid ({len(keys)})')
        for n_, key in enumerate(keys):
            card = pg.locator(f'.cgrid a[data-sit="{key}"]').first; col = card.evaluate("a => a.closest('section').getAttribute('aria-labelledby')")
            card.click(); pg.wait_for_timeout(250); I = pg.evaluate(SHEET); P = []
            if not (I['split'] == 1 and I['grid'] == 0 and I['cols'] == 1 and I['dayCol'] == col): P.append(f'one day column {I["dayCol"]} vs {col}')
            if not (I['marked'] == [[key, '', '']] and I['marks'] == 1 and 'solid' in I['outline']): P.append(f'marked {I["marked"]} {I["outline"]}')
            if not (I['dayH'].startswith(pg.evaluate("d => new Date(d + 'T12:00:00-10:00').toLocaleDateString('en-US', {timeZone: 'Pacific/Honolulu', weekday: 'short', month: 'short', day: 'numeric'})", day_of(col)))): P.append(f'day heading {I["dayH"]}')
            if I['back'] or not I['close'] or I['close'][0] != 'Close' or not I['whole']: P.append(f'close {I["close"]} {I["whole"]}')
            if not (I['close'][1] == I['whole'] and 'sitting' not in I['whole'] and (not vq or vq in I['whole']) and 'view=' not in I['whole']): P.append(f'close goes to {I["close"]}')
            if not (I['prev'] and I['next'] and I['prev'][2].startswith('Earlier day') and I['next'][2].startswith('Later day')): P.append(f'arrows {I["prev"]} {I["next"]}')
            codes = list(dict.fromkeys(c.strip() for c in key.split('|')[0].split('/')))
            want = [cexp(c) for c in codes if c in CM]; got = {c['name']: c for c in I['cm']}
            for w in want:
                g = got.get(w['name'])
                if not g: P.append(f'committee {w["name"]} missing'); continue
                rows = [[r, n] for r, n, h_, t_ in g['rows']]; wrows = [['Chair', l['name']] for l in w['chairs']] + [['Vice chair', l['name']] for l in w['vices']]
                if rows != wrows: P.append(f'chair rows {rows} vs {wrows}')
                if [(n, h_) for n, h_ in g['members']] != [(l['name'], l['capitol_url']) for l in w['rest']]: P.append('member names or links')
                if [h_ for r, n, h_, t_ in g['rows']] != [l['capitol_url'] for l in w['chairs'] + w['vices']] or any(t_ != '_blank' for r, n, h_, t_ in g['rows']): P.append('chair links')
                tot = len(g['rows']) + len(g['members'])
                if tot != w['count']: P.append(f'member count {tot} vs {w["count"]}')
                if len(want) == 1 and not (I['cmSum'] and I['cmSum'][0].endswith(f'{w["count"]} members') and I['cmSum'][0].startswith('Chair')): P.append(f'closed line {I["cmSum"]}')
                if len(want) > 1 and not (I['cmSum'] and I['cmSum'][0].startswith('Chair') and not re.search(r'\d|:', I['cmSum'][0])): P.append(f'joint closed line {I["cmSum"]}')
                seen_cm += 1
            if len(want) != len(got): P.append(f'committees {len(got)} vs {len(want)}')
            tot_here = pg.evaluate(ALSO, key); exp_also = tot_here - I['bills']
            if I['also'] != exp_also: P.append(f'also {I["also"]} vs {exp_also}')
            if I['also']: seen_also += 1; ok_sum = f'{I["also"]} other bill' in I['alsoSum']; P += [] if ok_sum else [f'also line {I["alsoSum"]}']
            L = pg.evaluate(LINKS, key)
            for r in L:
                wl = r.get('wantLetter'); wc = (BILLS.get(r.get('bill')) or {}).get('state_url'); wc = wc if wc and re.match(r'https?://', wc, re.I) else None
                if r.get('none') or r['letter'] != wl or r['cap'] != wc or not r['page'] or (r['cap'] and r['capTarget'] != '_blank') or (r['letter'] and r['letterTarget'] != '_blank'): P.append(f'links {r} want {wl} {wc}')
                if wl: seen_letters += 1
            if re.search(r'second review', pg.evaluate("() => document.body.innerText"), re.I): P.append('"Second review" is on the page')
            if I['filled'] > 1: P.append(f'{I["filled"]} filled buttons')
            if look and (I['filled'] or I['doLinks'] or I['rdyGo']): P.append('look-only has a button or a step link')
            if I['filled']: seen_btn += 1
            if I['filled'] and not I['rdyGo'].startswith('#/do/'): P.append('the filled button is not the block\'s')
            if not (I['side'] and I['pageScroll'] and I['sheetOverflow'] in ('auto', 'scroll')): P.append(f'scroll {I["side"]} {I["pageScroll"]} {I["sheetOverflow"]}')
            if not I['rdy'].startswith('Are we ready?'): P.append('no readiness block')
            if not I['kick'].startswith('Hearing ·'): P.append(f'kicker {I["kick"]}')
            if n_ == 0:   # the first of each view also checks Whole week; the others check Close
                pg.click('#dayWeek')
            else: pg.click('#calClose')
            pg.wait_for_timeout(250)
            if not (pg.locator('.cgrid').count() == 1 and pg.locator('.split').count() == 0 and (not vq or vq in pg.url) and 'sitting' not in pg.url): P.append(f'did not return to the grid {pg.url}')
            ok(not P, f'{lab}: hearing {key[:40]} picked in the grid ({n_ + 1}/{len(keys)}) {P[:4]}')
        ok(not errs and not bad, f'{lab}: no console error, nothing left 127.0.0.1 ({errs[:1]} {bad[:1]})'); pg.context.close()
    ok(seen_cm >= 4 and seen_also >= 1 and seen_btn >= 1, f'the walk covered committees ({seen_cm}), other-bills folds ({seen_also}) and a filled button ({seen_btn}); letters seen {seen_letters}')

    # ================= testimony times and deadlines picked in the grid; the arrows =================
    pg, errs, bad = open_as(br, 'KR', 1440, 900, '#/calendar'); tds = pg.locator('.cgrid a[data-td]'); n_td = tds.count(); dls_ = pg.locator('.cgrid a[data-dl]').count(); P = []
    for i in range(n_td):
        c = pg.locator('.cgrid a[data-td]').nth(i); col = c.evaluate("a => a.closest('section').getAttribute('aria-labelledby')"); key = c.get_attribute('data-td'); c.click(); pg.wait_for_timeout(250); I = pg.evaluate(SHEET)
        if not (I['dayCol'] == col and I['cols'] == 1 and I['marked'] == [['', key, '']] and I['kick'].startswith('Testimony ·') and I['rdy'].startswith('Are we ready?') and I['close']): P.append((i, I['dayCol'], col, I['marked'], I['kick']))
        pg.click('#calClose'); pg.wait_for_timeout(200)
    ok(n_td >= 1 and not P, f'KR: every testimony time of the week ({n_td}) opens the hearing sheet beside its day, marked, with its testimony line {P[:2]}')
    P = []
    for i in range(dls_):
        c = pg.locator('.cgrid a[data-dl]').nth(i); col = c.evaluate("a => a.closest('section').getAttribute('aria-labelledby')"); key = c.get_attribute('data-dl'); c.click(); pg.wait_for_timeout(250); I = pg.evaluate(SHEET)
        dv = pg.evaluate("d => new Date(d + 'T12:00:00-10:00').toLocaleDateString('en-US', {timeZone: 'Pacific/Honolulu', weekday: 'short', month: 'short', day: 'numeric'})", day_of(col))
        if not (I['dayCol'] == col and I['marked'] == [['', '', key]] and dv in pg.locator('.sheetp .facts').inner_text() and I['close'] and not I['folds'] and I['kick'] == 'Capitol deadline' and I['filled'] == 0 and I['side']): P.append((i, I['dayCol'], col, I['marked'], I['kick'], I['folds']))
        pg.click('#calClose'); pg.wait_for_timeout(200)
    ok(not P, f'KR: every deadline of the week ({dls_}) opens its sheet on the day paper of its date, marked, no folds, no filled button {P[:2]}')
    # the arrows: earlier and later land on a day that has something; disabled at the ends
    days = pg.evaluate("() => [...document.querySelectorAll('.cgrid .cgcol')].map(c => [c.getAttribute('aria-labelledby'), c.querySelectorAll('.cgc').length])"); have = [d for d, k in days if k]; P = []
    for idx, d in enumerate(have):
        pg.locator(f'.cgrid section[aria-labelledby="{d}"] .cgc').first.click(); pg.wait_for_timeout(250); I = pg.evaluate(SHEET)
        for nm, tgt, a in (('prev', have[idx - 1] if idx else None, I['prev']), ('next', have[idx + 1] if idx + 1 < len(have) else None, I['next'])):
            if tgt is None:
                if not (a[0] == 'SPAN' and a[1] == 'true' and not a[3]): P.append((d, nm, 'not disabled', a))
            else:
                if not (a[0] == 'A' and a[3]): P.append((d, nm, 'not a link', a)); continue
                fd = pg.evaluate("d => new Date(d + 'T12:00:00-10:00').toLocaleDateString('en-US', {timeZone: 'Pacific/Honolulu', weekday: 'short', month: 'short', day: 'numeric'})", day_of(tgt))
                if a[2] != ('Earlier day, ' if nm == 'prev' else 'Later day, ') + fd or fd.split(',')[0] not in pg.locator('#dayPrev' if nm == 'prev' else '#dayNext').inner_text(): P.append((d, nm, 'label', a[2], fd))
                pg.click('#dayPrev' if nm == 'prev' else '#dayNext'); pg.wait_for_timeout(250); J = pg.evaluate(SHEET)
                if J['dayCol'] != tgt or J['cols'] != 1 or not J['marked']: P.append((d, nm, J['dayCol'], tgt))
                pg.go_back(); pg.wait_for_timeout(250)
        pg.click('#calClose'); pg.wait_for_timeout(200)
    ok(len(have) >= 2 and not P, f'KR: Earlier and Later land on the nearest day with something, disabled at the ends ({len(have)} days) {P[:3]}')
    ok(not errs and not bad, f'KR: testimony, deadlines, arrows: no console error ({errs[:1]} {bad[:1]})'); pg.context.close()

    # ================= the folds, the width, the list =================
    for w, h in ((1440, 900), (1280, 800)):
        tag = f'{w}x{h}'; pg, errs, bad = open_as(br, 'KR', w, h, '#/calendar'); keys = pg.evaluate("() => [...new Set([...document.querySelectorAll('.cgrid a[data-sit]')].map(a => a.dataset.sit))]")
        both = None
        for key in keys:
            pg.locator(f'.cgrid a[data-sit="{key}"]').first.click(); pg.wait_for_timeout(250)
            if pg.locator('.fbtn').count() == 2: both = key; break
            pg.click('#calClose'); pg.wait_for_timeout(200)
        ok(both is not None, f'{tag}: a hearing with both folds is in the week')
        I = pg.evaluate(SHEET); ok(all(f[1] == 'true' and f[2] for f in I['folds']) and I['side'], f'{tag}: in the Week view both folds start open (the sheet has two columns) ({I["folds"]})')
        pg.click('.fbtn[data-fold="also"]'); pg.wait_for_timeout(150); ok(pg.locator('.fbtn[data-fold="also"]').get_attribute('aria-expanded') == 'false' and not pg.locator('#fold-also').is_visible(), f'{tag}: a fold closes when pressed')
        pg.evaluate('window.__staff7Tick()'); pg.wait_for_timeout(200); ok(pg.locator('.fbtn[data-fold="also"]').get_attribute('aria-expanded') == 'false' and pg.locator('.fbtn[data-fold="cmte"]').get_attribute('aria-expanded') == 'true', f'{tag}: the minute\'s redraw does not change a fold')
        pg.click('.fbtn[data-fold="also"]'); snap(pg, 'cal_hearing_week', tag)
        # the List, same hearing: the left column stays, no X, the sheet is narrower (one column at 1280), folds follow its width
        go(pg, '#/calendar/sitting/' + both.replace('|', '%7C').replace(':', '%3A').replace('/', '%2F') + '?view=list'); I = pg.evaluate(SHEET)
        ok(pg.locator('.wl #weekRow').count() == 1 and I['close'] is None and I['split'] == 0 and I['bills'] >= 1 and I['side'] and I['filled'] <= 1, f'{tag}: the List keeps its left column and has no Close; the same sheet opens on the right')
        cols = pg.evaluate("() => getComputedStyle(document.querySelector('.cols')).gridTemplateColumns.split(' ').length")
        ok(all((f[1] == 'true') == (cols == 2) for f in I['folds'] if f[0] == 'cmte') and dict((f[0], f[1]) for f in I['folds'])['also'] == 'true' and (w != 1280 or cols == 1), f'{tag}: in the List the folds follow the sheet\'s width ({cols} column(s); {I["folds"]})'); snap(pg, 'cal_hearing_list', tag)
        ok(not errs and not bad, f'{tag}: folds and list: no console error ({errs[:1]} {bad[:1]})'); pg.context.close()

    # ================= round two: folds, sent back, late once, show more, words, deadline hearing links =================
    pg, errs, bad = open_as(br, 'KR', 1440, 900, '#/calendar'); pg.locator('.cgrid a[data-sit]').first.click(); pg.wait_for_timeout(250)
    for k in pg.evaluate("() => [...document.querySelectorAll('.fbtn')].map(b => b.id)"):
        ok(k.startswith('fbtn-'), f'fold button has an id ({k})')
    fb = pg.locator('.fbtn').first
    if fb.count():
        vis_open = pg.evaluate("() => [...document.querySelectorAll('.fbtn')].map(b => [b.getAttribute('aria-expanded'), getComputedStyle(b.querySelector('.fs')).display])")
        ok(all((e == 'true') == (d_ == 'none') for e, d_ in vis_open), f'a fold\'s closed line is hidden when it is open, shown when closed ({vis_open})')
        fb.click(); vis_closed = pg.evaluate("() => [...document.querySelectorAll('.fbtn')].map(b => [b.getAttribute('aria-expanded'), getComputedStyle(b.querySelector('.fs')).display])"); ok(vis_closed[0][0] == 'false' and vis_closed[0][1] != 'none', f'closed: its line shows ({vis_closed})')
        fid = fb.get_attribute('id'); fb.focus(); pg.evaluate('window.__staff7Tick()'); pg.wait_for_timeout(250)
        ok(pg.evaluate("() => document.activeElement && document.activeElement.id") == fid, f'focus stays on the fold button across the minute\'s redraw ({fid})')
    ok(not re.search(r'second review', body(pg), re.I), 'no "Second review" in the Week view sheet'); go(pg, '#/calendar'); ok(not re.search(r'second review', body(pg), re.I), 'no "Second review" in the grid')
    go(pg, '#/calendar?view=list'); ok(not re.search(r'second review', body(pg), re.I), 'no "Second review" in the List')
    # Show N more: the Wednesday 1:00 PM House/Senate Health sitting has many bills the team tracks
    HK = 'HHS|2026-03-18T23:00:00.000Z'; kq2 = HK.replace('|', '%7C').replace(':', '%3A')
    go(pg, '#/calendar/sitting/' + kq2); tot = pg.evaluate(ALSO, HK); I = pg.evaluate(SHEET); ours = I['bills']; want_other = tot - ours
    if pg.locator('#fbtn-also').get_attribute('aria-expanded') != 'true': pg.click('#fbtn-also')
    vis = pg.evaluate("() => [...document.querySelectorAll('.alsol li')].filter(l => l.getBoundingClientRect().height > 0).length")
    ok(want_other > 5 and pg.locator('#alsoMore').count() == 1 and vis == 5 and pg.locator('#alsoMore').inner_text() == f'Show {want_other - 5} more', f'Also at this hearing: five rows and "Show {want_other - 5} more" ({vis} shown, {want_other} in the data)')
    pg.evaluate('window.__staff7Tick()'); pg.click('#alsoMore'); pg.wait_for_timeout(150)
    vis = pg.evaluate("() => [...document.querySelectorAll('.alsol li')].filter(l => l.getBoundingClientRect().height > 0).length")
    ok(vis == want_other and pg.locator('#alsoMore').count() == 0, f'Show more reveals all rows in place ({vis} = {want_other})')
    pg.evaluate('window.__staff7Tick()'); pg.wait_for_timeout(200)
    vis = pg.evaluate("() => [...document.querySelectorAll('.alsol li')].filter(l => l.getBoundingClientRect().height > 0).length"); ok(vis == want_other, f'the minute\'s redraw keeps them shown ({vis})')
    row1 = pg.evaluate("() => { const r = document.querySelector('.alsol li'); return [r.querySelector('.alr').innerText.replace(/\\s+/g, ' '), getComputedStyle(r.querySelector('.alr')).fontWeight, r.querySelector('.alead')?.innerText || '', getComputedStyle(r.querySelector('.alr')).whiteSpace]; }")
    ok(row1[1] == '400' and (not row1[2] or re.search(r' (leads|lead)$', row1[2])), f'an Also row is the short name and number in regular weight, with its lead on its own line ({row1})')
    ok(not errs and not bad, f'round two page one: no console error ({errs[:1]} {bad[:1]})'); pg.context.close()

    # sent back, late once, late with several bills (hand-made data)
    pg, errs, bad = open_as(br, 'JM', 1440, 900, '#/'); st = pg.evaluate(SETUP); ok('err' not in st, 'hand-made data is in (round two)')
    pg.evaluate("""async () => { const d = await import('/staff6/data.js'), S = d.S; const h6 = S.hearings.find(h => h.id === 'cal-test-6'), A = S.bills.find(b => b.id === h6.bill_id);
      S.drafts[A.id] = [{ id: 'cal-d9', bill_id: A.id, hearing_id: 'cal-test-6', committee: 'WLO', status: 'draft', review_note: 'Please tighten the first paragraph', version: A.current_version || null }]; }""")
    go(pg, '#/issues'); go(pg, '#/calendar/sitting/WLO%7C2026-03-17T00%3A00%3A00.000Z?view=list'); t = pg.locator('.paper').inner_text(); I = pg.evaluate(SHEET)
    ok(I['rdy'].startswith('Are we ready? 1 letter sent back to fix') and 'still to write' not in I['rdy'], f'a sent-back letter has its own headline ({I["rdy"][:60]!r})')
    if I['rdyGo']: ok(pg.locator('#rdyGo').inner_text().strip() == 'Resubmit testimony', f'the headline matches the button ({pg.locator("#rdyGo").inner_text()!r})')
    else: ok(True, 'no step of JM\'s on that bill; the button check is covered in the Everyone-free walk')
    ok('Letter sent back to fix' in t and t.count('Late, still accepted') == 1, f'with one bill the late warning is said once, in the block ({t.count("Late, still accepted")})')
    # a second, unfiled bill at the same late sitting
    pg.evaluate("""async () => { const d = await import('/staff6/data.js'), S = d.S; const h6 = S.hearings.find(h => h.id === 'cal-test-6'), hb = S.hearings.find(h => h.id === 'cal-test-1');
      S.hearings.push({ ...h6, id: 'cal-test-extra', bill_id: hb.bill_id }); }""")
    go(pg, '#/calendar'); go(pg, '#/calendar/sitting/WLO%7C2026-03-17T00%3A00%3A00.000Z?view=list'); I = pg.evaluate(SHEET); t = pg.locator('.paper').inner_text()
    ok(re.search(r'All 2 late, still accepted until 2:00 PM today', I['rdy']) and pg.locator('.brow .riskt').count() == 2 and t.count('Late, still accepted') == 2, f'with several bills the block summarises and each late bill carries the amber line ({I["rdy"][:140]!r}; {pg.locator(".brow .riskt").count()} amber lines)')
    go(pg, '#/calendar/testimony/WLO%7C2026-03-17T00%3A00%3A00.000Z?view=list'); ft = pg.locator('.facts').inner_text()
    ok(ft.startswith('Hearing Mon, Mar 16 · 2:00 PM') and pg.locator('.kick').inner_text().startswith('Testimony · was due'), f'a testimony page labels the hearing time ({ft[:40]!r} / {pg.locator(".kick").inner_text()!r})')
    ok(not errs and not bad, f'round two page two: no console error ({errs[:1]} {bad[:1]})'); pg.context.close()

    # the deadline's hearing links open that hearing's page, keeping who and view
    found = 0; P = []
    for who_q in ('', 'who=all'):
        pg, errs, bad = open_as(br, 'KR', 1440, 900, '#/calendar')
        for wk in ('2026-03-16', '2026-03-23', '2026-03-30', '2026-04-06', '2026-04-13', '2026-04-20'):
            go(pg, f'#/calendar?view=list&w={wk}' + (f'&{who_q}' if who_q else '')); n_dl = pg.locator('.wl a[data-dl]').count()
            for i in range(n_dl):
                go(pg, f'#/calendar?view=list&w={wk}' + (f'&{who_q}' if who_q else '')); pg.locator('.wl a[data-dl]').nth(i).click(); pg.wait_for_timeout(250)
                ok_hd = 'Your bills it affects' in pg.locator('.paper').inner_text() or 'bills it affects' in pg.locator('.paper').inner_text() or 'touches none' in pg.locator('.paper').inner_text(); 
                for j in range(pg.locator('.paper a.hl').count()):
                    pg.locator('.paper a.hl').nth(j).evaluate("a => a.scrollIntoView()"); txt = pg.locator('.paper a.hl').nth(j).inner_text(); href = pg.locator('.paper a.hl').nth(j).get_attribute('href')
                    pg.locator('.paper a.hl').nth(j).click(); pg.wait_for_timeout(250); found += 1
                    if not ('/sitting/' in pg.url and 'view=list' in pg.url and (not who_q or who_q in pg.url) and pg.locator('.kick').first.inner_text().startswith('Hearing ·')): P.append((txt, pg.url[-60:]))
                    else:
                        day = re.match(r'Hearing (\w{3})', txt).group(1)
                        if day not in pg.locator('.facts').first.inner_text(): P.append((txt, pg.locator('.facts').first.inner_text()))
                    pg.go_back(); pg.wait_for_timeout(200)
        pg.context.close()
    ok(found >= 1 and not P, f'deadline bills\' "Hearing ..." lines link to that hearing\'s page ({found} followed) {P[:2]}')
    br.close()
print(f'{sum(res)}/{len(res)} passed'); sys.exit(0 if all(res) else 1)
