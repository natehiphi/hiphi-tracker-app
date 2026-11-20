# Staff7's All bills (R-398), on the practice copy: the row under "The session" on Issues, and the table at #/issues/bills: Mine (the bills on my issues, plus any bill I lead that is on no issue), A teammate, Everyone;
# six columns in Everyone and five elsewhere; the issue link only when the names differ; position as bold text; Where it is and Next date from the app's shared functions, and the same as the Issues list says for the
# same bill; ONE wording for a stopped bill on the table, the Issues list, the issue page and the bill page; amber only for a deadline; the three selects and Clear; the count; every header sorts both ways with alive
# before stopped on ties; "SB 11" finds SB 11 first; the view, filters and sort are in the address (reload and Back keep them); the minute's redraw keeps the scroll; empty states; no sideways scroll at 1440, 1280 and 390;
# the phone's labels, Filters and Sort; nothing but GETs to 127.0.0.1 and fonts; no page errors.
#   python3 tests/staff7_bills.py [base] [shots folder]     base defaults to http://127.0.0.1:8851
import sys, os, re, json
from playwright.sync_api import sync_playwright
BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8851').rstrip('/')
SHOTS = sys.argv[2] if len(sys.argv) > 2 else ''
if SHOTS: os.makedirs(SHOTS, exist_ok=True)
res = []
def ok(c, m): res.append(bool(c)); print('PASS' if c else 'FAIL', m, flush=True)

NOSIDE = "() => document.documentElement.scrollWidth <= innerWidth && [...document.querySelectorAll('.paper, .wl')].every(p => p.scrollWidth <= p.clientWidth + 1)"
# the rows as drawn (innerText, so what is hidden by the style is not read), and the heads
ROWS = """() => [...document.querySelectorAll('#aTab tbody tr')].map(tr => { const g = s => tr.querySelector(s), t = e => e ? e.innerText.replace(/\\s+/g, ' ').trim() : '', cs = getComputedStyle;
  const pe = g('.c-pos b') || g('.c-pos span');
  return { no: tr.dataset.no, stopped: tr.classList.contains('stopped'), nick: !!g('.bsub2'), bill: t(g('a.bn')), sub: t(g('.bsub2') || g('.bdesc')), issue: t(g('.issl')), issueHref: g('.issl') ? g('.issl').getAttribute('href') : '', led: t(g('.ledby')), href: g('a.bn').getAttribute('href'),
    pos: t(g('.c-pos')), posBold: pe ? +cs(pe).fontWeight >= 700 : false, posMuted: pe ? cs(pe).color : '', lead: g('.c-lead') ? t(g('.c-lead')) : null, coal: t(g('.c-coal')), w1: t(g('.c-where .w1')), w2: t(g('.c-where .w2')), wlabel: g('.c-where') ? (g('.c-where').getAttribute('aria-label') || '') : '', wicon: !!g('.c-where svg, .c-where img'), ccn: tr.querySelectorAll('.c-where .cc[title]').length, where: [t(g('.c-where .w1')), t(g('.c-where .w2'))].filter(Boolean).join(' · '), next: t(g('.c-next')), amber: !!g('.dl.amber'), icon: !!g('.c-next svg') }; })"""
HEADS = "() => [...document.querySelectorAll('#aTab thead th')].map(th => ({ text: th.innerText.trim(), scope: th.getAttribute('scope'), sort: th.getAttribute('aria-sort'), id: th.querySelector('button').id }))"
COUNT = "() => (document.getElementById('abCount') || {}).innerText || ''"
H1 = "() => [...document.querySelectorAll('main h1')].find(h => h.getBoundingClientRect().width > 0)?.innerText.trim()"
ALLOWED_EXT = ('fonts.g',)
SMALL = "() => [...document.querySelectorAll('.btn, .sr3, .seg, .sorth, select.field, .pk')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.height < 43.5 && getComputedStyle(e).visibility !== 'hidden' }).map(e => e.id || e.className)"

def open_as(br, who, w, h, hash='#/issues/bills'):
    ctx = br.new_context(viewport={'width': w, 'height': h}); bad = []; seen = []
    def blk(route):
        u = route.request.url
        if any(a in u for a in ALLOWED_EXT): return route.continue_()
        bad.append(u); route.abort()
    ctx.route(lambda u: '127.0.0.1' not in u and 'localhost' not in u, blk)
    ctx.on('request', lambda r: seen.append((r.method, r.url)))
    pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'Failed to load resource' not in m.text and 'ERR_FAILED' not in m.text else None)
    pg.goto(f'{BASE}/staff7.html?demo=1' + (f'&as={who}' if who != 'default' else '') + hash); pg.wait_for_selector('.paper', timeout=60000)
    pg.evaluate("Promise.all([document.fonts.load('600 16px Poppins'), document.fonts.load('400 16px Lato'), document.fonts.load('700 16px Lato'), document.fonts.load('500 16px Poppins')])"); pg.wait_for_timeout(300)
    pg.bad, pg.seen, pg.errs = bad, seen, errs
    return pg
def settle(pg):
    # the table has drawn every row (it draws the first ones at once and the rest in chunks)
    pg.wait_for_function("() => { const t = document.getElementById('aTab'); return !t || t.dataset.all === '1'; }", timeout=30000); pg.wait_for_timeout(120)
def table(pg, hash):
    pg.evaluate("h => { window.__staff7TrailReset && window.__staff7TrailReset(); location.hash = h; }", hash); pg.wait_for_timeout(300); pg.wait_for_selector('#abResult'); settle(pg)
def rows(pg): return pg.evaluate(ROWS)
def stopped_one(r):
    # a stopped bill on a page with one line: "Stopped Feb 11 · <line 1> · <committee>"; a bill the record cannot say more about is "Stopped Feb 11 · <committee>" (the word is not said twice)
    rest = r['w2'] if r['w1'] == 'Stopped' else r['where']
    head = r['next'] or 'Stopped'   # a stop date the app does not have: the Next date is empty and the one-line form says "Stopped" once
    return f"{head} · {rest}" if rest else head
def nrows(pg): return pg.evaluate("() => document.querySelectorAll('#aTab tbody tr').length")
def intn(s): return int(re.sub(r'[^\d]', '', s) or 0)
def snap(pg, name):
    if SHOTS: pg.screenshot(path=os.path.join(SHOTS, name + '.png'))
def model(pg, js, arg=None):
    # what the page's own functions say (read from the page): used to PICK bills and to compare, never as the only judge
    return pg.evaluate("async (arg) => { const d = await import('/staff6/data.js'), I = await import('/staff7/issues.js'), B = await import('/staff7/bills.js'), C = await import('/staff7/bill_cell.js'), T = await import('/staff7/issue_table.js'), St = await import('/staff7/standing.js'), W = await import('/staff7/steps.js'), L = await import('/staff7/bill_words.js'); const S = d.S; " + js + " }", arg)

PEOPLE = ['KV', 'KR', 'JS', 'JM', 'LR', 'SY', 'MR', 'JN', 'PH', 'PT', 'RK', 'JMM']
with sync_playwright() as p:
    br = p.chromium.launch()

    # ---------------------------------------------------------------- the row on Issues: "N mine" is the table's Mine count
    mine_n = {}
    for who in ('NT', 'KR', 'JMM'):
        pg = open_as(br, who, 1440, 900, '#/issues'); pg.wait_for_selector('#allBillsRow')
        t = pg.locator('#allBillsRow').inner_text().replace('\n', ' ')
        m = re.fullmatch(r'All bills\s+([\d,]+) mine · ([\d,]+) tracked', t)
        ok(m and pg.locator('#allBillsRow').get_attribute('href') == '#/issues/bills', f'{who}: Issues has an "All bills" row with its two counts and the address of the table ({t!r})')
        ok(pg.evaluate("() => { const a = document.getElementById('sessionRow'), b = document.getElementById('allBillsRow'); return a.closest('ul') === b.closest('ul'); }"), f'{who}: the row is in the same group as The session')
        if who == 'NT': ok(pg.evaluate("() => document.getElementById('newBillsRow').closest('li').nextElementSibling === document.getElementById('allBillsRow').closest('li')"), 'NT: it comes right after "New bills"'); snap(pg, 'entry_row')
        pg.click('#allBillsRow'); pg.wait_for_selector('#abResult'); settle(pg)
        rs = rows(pg); mine_n[who] = len(rs)
        ok(m and len(rs) == intn(m.group(1)) == intn(pg.evaluate(COUNT)) and intn(m.group(2)) == 734, f'{who}: the row says {m.group(1) if m else "?"} mine, and Mine has exactly that many rows ({len(rs)}; the line says {pg.evaluate(COUNT)!r})')
        ok('#/issues/bills' in pg.url and pg.evaluate(H1) == 'Your bills', f'{who}: the title in Mine is "Your bills"')
        ok(len(set(r['no'] for r in rs)) == len(rs), f'{who}: one row per bill')
        pg.context.close()
    # the row's words are for the view it opens: Mine "N mine", a teammate "N for <first name>", Everyone "M tracked"
    pg = open_as(br, 'NT', 1440, 900, '#/issues?who=all'); pg.wait_for_selector('#allBillsRow')
    t = pg.locator('#allBillsRow').inner_text().replace('\n', ' ')
    ok(t == 'All bills 734 tracked' and pg.locator('#allBillsRow').get_attribute('href') == '#/issues/bills?who=all', f'Everyone: the row says only how many are tracked, and opens Everyone ({t!r})')
    pg.click('#allBillsRow'); pg.wait_for_selector('#abResult'); settle(pg)
    ok(nrows(pg) == 734 and pg.evaluate(COUNT) == '734 bills', 'Everyone: the row and the table agree (734)')
    pg.context.close()
    pg = open_as(br, 'NT', 1440, 900, '#/issues?who=LR'); pg.wait_for_selector('#allBillsRow')
    t = pg.locator('#allBillsRow').inner_text().replace('\n', ' ')
    m = re.fullmatch(r'All bills (\d+) for Lauren · 734 tracked', t)
    ok(m and pg.locator('#allBillsRow').get_attribute('href') == '#/issues/bills?who=LR', f'a teammate: the row says "N for Lauren" and opens her table ({t!r})')
    pg.click('#allBillsRow'); pg.wait_for_selector('#abResult'); settle(pg)
    ok(m and nrows(pg) == int(m.group(1)) == 50 and pg.evaluate(H1) == 'Lauren’s bills', 'a teammate: the number in the row is the number of rows in her table')
    pg.context.close()
    ok(mine_n['KR'] == 60 and mine_n['JMM'] == 8, f'the practice data: KR leads 60 bills and JMM has 8 ({mine_n})')

    # ---------------------------------------------------------------- Mine: the rule, with Led by
    # The expected set is worked out WITHOUT the app's helpers: the person's issues are read from the Issues list as drawn (every issue row, shown or folded), and the bills, their issues and their leads straight from the practice data.
    EXPECT = """async (ids) => { const d = await import('/staff6/data.js'), S = d.S, me = S.me, yr = d.SESSION_YEAR, mine = new Set(ids), out = {};
      const live = id => { const a = S.advocates.find(x => x.id === id); return !!id && !!a && a.is_active !== false; };
      const active = new Set(S.issues.filter(i => !i.archived_at).map(i => String(i.id))), owner = i => (S.issues.find(x => String(x.id) === i) || {}).owner_id;
      for (const b of S.bills) {
        if (b.tracked === false || (b.session_year && +b.session_year !== +yr)) continue;
        const on = S.billIssues.filter(x => x.bill_id === b.id && active.has(String(x.issue_id))).map(x => String(x.issue_id)), inMine = on.filter(i => mine.has(i)), assigned = [...new Set((S.assignments[b.id] || []).filter(live))];
        const no = String(b.bill_number).replace(/\\s/g, '');
        if (inMine.length) { const leads = inMine.map(i => assigned.length ? assigned[0] : live(owner(i)) ? owner(i) : ''); const ambiguous = new Set(leads).size > 1, lead = leads[0] ? S.advocates.find(a => a.id === leads[0]) : null;
          out[no] = { kind: 'issue', ambiguous, led: lead && lead.id !== me.id ? 'Led by ' + lead.full_name.split(' ')[0] : '' }; }
        else if (!on.length && assigned.includes(me.id)) out[no] = { kind: 'led', ambiguous: false, led: '' };
      }
      return out; }"""
    def expect_mine(who):
        pg = open_as(br, who, 1440, 900, '#/issues'); pg.wait_for_selector('#allBillsRow')
        ids = pg.evaluate("() => [...new Set([...document.querySelectorAll('.wl a.sr3.ir[href^=\"#/issue/\"]')].map(a => decodeURIComponent(a.getAttribute('href').slice(8).split('?')[0])))]")
        ex = pg.evaluate(EXPECT, ids); pg.evaluate("h => { location.hash = h; }", '#/issues/bills'); pg.wait_for_selector('#abResult'); settle(pg)
        return pg, ex, ids
    for who, want_n in (('NT', 365), ('KR', 60), ('JMM', 8), ('PH', 11)):
        pg, ex, ids = expect_mine(who); rs = rows(pg); byno = {r['no']: r for r in rs}
        ok(len(ids) >= 1 and set(ex) == set(byno) and len(rs) == want_n, f'{who} Mine: exactly the bills on the issues the Issues list shows (read from its rows) plus the bills the data says I lead on no issue ({len(rs)} rows, {len(ex)} expected, {len(ids)} issues)')
        bad = [(n_, x['led'], byno[n_]['led']) for n_, x in ex.items() if n_ in byno and not x['ambiguous'] and byno[n_]['led'] != x['led']]
        ok(not bad, f'{who} Mine: "Led by X" is on every bill of my issues that someone else leads, and nowhere else ({sum(1 for x in ex.values() if x["led"])} bills say it; {bad[:2]})')
        led_only = [n_ for n_, x in ex.items() if x['kind'] == 'led']
        ok(all(not byno[n_]['issue'] and not byno[n_]['led'] for n_ in led_only), f'{who} Mine: the {len(led_only)} bills I lead that are on no issue are in the table, with no issue link and no "Led by"')
        if who == 'NT':
            ok(sum(1 for x in ex.values() if x['led']) >= 3 and len(led_only) > 100, 'NT has bills a teammate leads on my issues and many I lead on no issue, so both halves of the rule are tested')
        if who == 'PH': ok(sum(1 for x in ex.values() if x['led']) == 5, 'PH has five bills led by someone else')
        if who == 'JMM': ok(all(r['led'].startswith('Led by ') for r in rs) and len(rs) == 8, 'JMM: eight bills, each on an issue a teammate leads, each says who')
        pg.context.close()
    pg = open_as(br, 'NT', 1440, 900); settle(pg); rs = rows(pg); byno = {r['no']: r for r in rs}
    heads = pg.evaluate(HEADS)
    ok([h['text'] for h in heads] == ['Bill', 'Position', 'Coalition', 'Where it is', 'Next date'] and all(h['scope'] == 'col' for h in heads), f'Mine has five columns, no Lead ({[h["text"] for h in heads]})')
    ok(pg.locator('#aTab th[scope="row"]').count() == len(rs) and pg.evaluate("() => document.getElementById('aTab').getAttribute('role') === 'table' && !!document.querySelector('#aTab [role=row]') && !!document.querySelector('#aTab [role=columnheader]') && !!document.querySelector('#aTab [role=rowheader]')"), 'a real table: <th scope=col> heads, a row head for each bill, and roles that keep the table for a screen reader')
    snap(pg, 'mine_nt')
    pg.context.close()

    # ---------------------------------------------------------------- Everyone: six columns, the words of the page
    pg = open_as(br, 'NT', 1440, 900, '#/issues/bills?who=all'); settle(pg)
    rs = rows(pg); heads = pg.evaluate(HEADS)
    ok(len(rs) == 734 == intn(pg.evaluate(COUNT)) and pg.evaluate(COUNT) == '734 bills', f'Everyone: 734 rows and the line says "734 bills" ({pg.evaluate(COUNT)!r})')
    ok([h['text'] for h in heads] == ['Bill', 'Position', 'Lead', 'Coalition', 'Where it is', 'Next date'] and all(h['scope'] == 'col' for h in heads), f'Everyone has six columns, Lead after Position ({[h["text"] for h in heads]})')
    ok(pg.evaluate(H1) == 'All bills' and pg.evaluate("() => document.querySelector('.trailbar a').getAttribute('href')") == '#/issues', 'the title in Everyone is "All bills", with Issues as the trail')
    alltxt = pg.evaluate("() => document.body.innerText")
    ok(not re.search(r'Same name|No issue', alltxt) and not re.search(r'\bletter\b|public tracker|\bvap(e|es|ing)\b', alltxt, re.I), 'no "Same name", "No issue", "letter", "public tracker" or "vape" on the page')
    ok(pg.locator('a[href*="staff6"]').count() == 0, 'nothing links to the current app (staff6)')
    # the issue link only when the names differ
    IS = model(pg, """const v = B.viewOf({ kind: 'all', code: 'all' }, S.me); return v.recs.map(r => ({ no: r.no, issue: r.issue ? r.issue.name : '', same: !!r.issue && I.sameName(r.b, r.issue), name: W.billName(r.b) }));""")
    ism = {x['no']: x for x in IS}; byno = {r['no']: r for r in rs}
    withl = [x for x in IS if x['issue'] and not x['same']]; samen = [x for x in IS if x['issue'] and x['same']]; noiss = [x for x in IS if not x['issue']]
    ok(withl and samen and noiss and all(byno[x['no']]['issue'] and byno[x['no']]['issue'].lower() != x['name'].lower() for x in withl), f'a bill whose issue has another name shows the issue under it ({len(withl)} bills)')
    ok(all(not byno[x['no']]['issue'] for x in samen + noiss), f'no issue line when the issue has the bill\'s name ({len(samen)}) or there is no issue ({len(noiss)})')
    ok(all(r['issueHref'].startswith('#/issue/') for r in rs if r['issue']), 'the issue under a bill is a link to the issue')
    # position: bold text, Monitor muted, no pill
    sides = [r for r in rs if r['pos'] and r['pos'] not in ('Monitor', 'No position yet')]; mons = [r for r in rs if r['pos'] == 'Monitor']; nopos = [r for r in rs if r['pos'] == 'No position yet']
    ok(sides and mons and all(r['posBold'] for r in sides) and not any(r['posBold'] for r in mons) and pg.locator('#aTab .ppill').count() == 0 and pg.evaluate("() => [...document.querySelectorAll('#aTab .c-pos > *')].every(e => getComputedStyle(e).borderTopWidth === '0px')"), f'position is bold text for a side ({len(sides)}), plain muted for Monitor ({len(mons)}), no pill')
    ok(all(r['pos'] in ('Strongly support', 'Support', 'Support w/ amendments', 'Strongly oppose', 'Oppose', 'Monitor', 'Comments (neutral)', 'No position yet') for r in rs), 'every position is in the app\'s own words')
    ok(all(r['lead'] and (r['lead'] == 'No lead' or re.fullmatch(r'[A-Z][a-z]+( \+\d)?', r['lead'])) for r in rs), 'Lead is a first name (or "No lead")')
    ok(all(r['coal'] for r in rs), 'Coalition is a name or "No coalition"')
    # the Where it is words
    CM1 = r'[A-Z][\w&,\' -]+ \([A-Z]{2,4}\)'; CMJ = r'(House |Senate )?[A-Z]{2,4}(/[A-Z]{2,4})+'; CMT = f'(?:{CM1}|{CMJ})'
    ok(all(re.fullmatch(rf'(No hearing(, missed the deadline)?|Deferred( \w{{3}} \d+)?|Heard \w{{3}} \d+, no vote recorded|Vetoed|Failed a floor vote|Stopped)( · {CMT})?', r['where']) for r in rs if r['stopped']), 'a stopped bill\'s Where it is is one of the design\'s stopped lines (No hearing, Deferred, Heard, no vote recorded, ...) and its committee')
    ALIVE1 = r'(Not referred yet|Waiting for a hearing|Passed \d+ (of \d+ )?committees?|Crossed over, waiting for a hearing|Hearing scheduled|Decision making scheduled|Being heard today|Hearing held, no vote recorded|Passed committee, waiting for the floor vote|Back in the (House|Senate) to agree or disagree|In conference|With the Governor|Signed into law|Adopted|Going to the voters)'
    ok(all(re.fullmatch(rf'{ALIVE1}( · {CMT})?', r['where']) for r in rs if not r['stopped']), 'an alive bill\'s Where it is is one of the design\'s lines; one committee by name and code, a joint stop by its codes joined with "/"')
    ok(all(r['w1'] and not r['wicon'] for r in rs), 'every bill has a line 1 in Where it is, and no icon is in the cell')
    ok(all(re.fullmatch(r'Stopped \w{3} \d+|', r['next']) for r in rs if r['stopped']) and all(not re.search(r'Stopped \w{3} \d', r['where']) for r in rs) and all(r['next'] != 'Stopped' for r in rs), 'the stopped date is said once, in Next date ("Stopped Feb 11"), never in Where it is; with no date known the Next date is empty (never a second "Stopped")')
    ok(all(not re.search(r'Committee deadline|before \w+’s deadline', r['next']) for r in rs), 'no "Committee deadline" line and no "before Thursday\'s deadline" tail in Next date')
    ok(all(re.fullmatch(r'((Today|Tomorrow|\w{3}|\w{3}, \w{3} \d+,) \d+:\d\d [AP]M( · after the deadline)?|by \w{3}, \w{3} \d+( · (\d+ days?|today|tomorrow))?|Stopped( \w{3} \d+)?|)', r['next']) for r in rs) and not any('Hearing' in r['next'] for r in rs), 'Next date is a hearing time without the word "Hearing" ("Today 1:00 PM"), a "by <date> · N days", "Stopped <date>", or empty')
    snap(pg, 'everyone_top')

    # ---------------------------------------------------------------- ten bills across states: the table says what the shared functions say, and what the Issues list says
    PICK = model(pg, """const all = { kind: 'all', code: 'all' }, v = B.viewOf(all, S.me), ses = I.sessionOf(I.setFor(all, S.me)), row = ses.next ? ses.next.row : null, seen = {}, out = [];
      for (const r of v.recs) { const k = r.alive ? C.deadlineCell(r.b, row).key + '|' + (r.pos === 'monitor' ? 'mon' : 'pos') : 'stopped|' + (T.stoppedWhy(r.b).kind || 'x') + (T.stoppedWhy(r.b).codes.length > 1 ? 'J' : ''); seen[k] = (seen[k] || 0) + 1; if (seen[k] <= 2) out.push({ no: r.no, k }); }
      return { out, rowKey: row ? row.key : null, sameRow: row && v.row && v.row.key === row.key };""")
    ok(PICK['sameRow'] and PICK['rowKey'], f'Everyone is judged against the deadline the Issues list uses for Everyone ({PICK["rowKey"]})')
    kinds = sorted(set(x['k'] for x in PICK['out']))
    ok(len(PICK['out']) >= 10 and len(kinds) >= 7, f'{len(PICK["out"])} bills picked across {len(kinds)} states ({kinds})')
    CMP = model(pg, """const all = { kind: 'all', code: 'all' }, v = B.viewOf(all, S.me), ses = I.sessionOf(I.setFor(all, S.me)), row = ses.next ? ses.next.row : null, out = [];
      for (const no of arg) { const r = v.recs.find(x => x.no === no), b = r.b, x = I.statesFor([{ issue: {}, bills: [b], standing: null }], ses)[0], n = B.nextDateOf(b, row);
        out.push({ no, where: B.whereOf(b), next: n.text, amber: n.amber, issuesState: x.k, issuesText: x.second ? x.second.text : '', cell: St.isAlive(b) ? C.deadlineCell(b, row).key : 'stopped', pos: b.position || '' }); }
      return out;""", [x['no'] for x in PICK['out']])
    bad = []
    for c in CMP:
        r = byno[c['no']]
        good = r['where'] == c['where'] and r['next'] == c['next'] and r['amber'] == c['amber']
        st, k, it = c['issuesState'], c['cell'], c['issuesText']
        if st == 'risk': good = good and r['amber'] and re.fullmatch(r'by \w{3}, \w{3} \d+ · \d+ days?', r['next']) and it.startswith(('Needs a hearing by ', 'Hearing '))
        elif st == 'hearing': good = good and not r['amber'] and re.match(r'(Today|Tomorrow|\w{3})', r['next']) and it.lower().startswith('hearing ' + r['next'].lower())
        elif st == 'need': good = good and not r['amber'] and (not ' · by ' in it or r['next'] == 'by ' + it.split(' · by ')[1])
        elif st == 'stopped': good = good and stopped_one(r) == it
        else: good = good and not r['amber'] and (not ' · by ' in it or r['next'] == 'by ' + it.split(' · by ')[1])
        if not good: bad.append((c, r['where'], r['next'], r['amber']))
    ok(not bad, f'for {len(CMP)} bills in every state the table\'s Where it is and Next date are what the shared functions give, and agree with the Issues list\'s group and words {bad[:2]}')
    ok(all(not r['amber'] for r in rs if r['pos'] == 'Monitor'), 'no amber on a Monitor bill')
    ok(any(c['issuesState'] == 'hearing' for c in CMP) and any(c['issuesState'] == 'stopped' for c in CMP) and any(c['issuesState'] == 'need' for c in CMP) and any(c['issuesState'] == 'risk' for c in CMP), 'the ten include a hearing, a bill that needs one, one at risk and a stopped bill')

    # amber: exactly the at-risk bill (SB 11 on the practice clock), a deadline and never a hearing
    amb = [r['no'] for r in rs if r['amber']]
    ok(amb == ['SB11'] and byno['SB11']['icon'] and re.fullmatch(r'by \w{3}, \w{3} \d+ · \d+ days?', byno['SB11']['next']), f'Everyone: exactly one amber row, SB 11 ("{byno["SB11"]["next"]}"); {amb}')
    AMB = model(pg, """const v = B.viewOf({ kind: 'all', code: 'all' }, S.me), ses = I.sessionOf(I.setFor({ kind: 'all', code: 'all' }, S.me)), row = ses.next.row; return v.recs.filter(r => r.alive && St.isAtRisk(r.b) && !r.next.amber).map(r => r.no).concat(v.recs.filter(r => r.next.amber && !St.isAtRisk(r.b)).map(r => 'x' + r.no));""")
    ok(not AMB, f'amber is exactly what the app\'s at-risk rule says (isAtRisk) ({AMB})')
    pg.evaluate("() => { document.querySelector('#aTab tr[data-no=\"SB11\"]').scrollIntoView({ block: 'center' }); }"); pg.wait_for_timeout(200)
    snap(pg, 'amber_sb11')

    # ---------------------------------------------------------------- ONE wording for a stopped bill: table, Issues list, issue page, bill page
    W3 = {
        'SB1525': 'No hearing, missed the deadline · Senate Commerce and Consumer Protection (CPN)',
        'HB1747': 'Deferred Feb 3 · House Human Services & Homelessness (HSH)',
        'SB2345': 'No hearing, missed the deadline · Senate HHS/CPN',
    }
    IDS = model(pg, """const out = {}; for (const no of arg) { const b = S.bills.find(x => x.bill_number.replace(/\\s/g, '') === no), bi = (S.billIssues || []).find(x => x.bill_id === b.id); out[no] = { issue: bi ? bi.issue_id : '', n: (S.billIssues || []).filter(x => x.issue_id === (bi || {}).issue_id).length }; } return out;""", list(W3))
    for no, why in W3.items():
        r = byno[no]; date = r['next']
        ok(r['stopped'] and r['where'] == why and re.fullmatch(r'Stopped (Feb|Mar) \d+', date), f'{no}: the table says "{why}" in Where it is and "{date}" in Next date')
        line = f'{date} · {why}'
        pg.evaluate("h => { location.hash = h; }", "#/issues?who=all&show=stopped"); pg.wait_for_timeout(500)
        row_txt = pg.evaluate("(id) => { const a = document.querySelector('a.sr3.ir[href*=\"' + id + '\"]'); return a ? a.innerText.replace(/\\s+/g, ' ').trim() : null; }", IDS[no]['issue'])
        ok(IDS[no]['n'] == 1 and row_txt and line in row_txt, f'{no}: the Issues list says the same, "{line}" ({row_txt!r})')
        pg.evaluate("h => { location.hash = h; }", f"#/issue/{IDS[no]['issue']}?who=all"); pg.wait_for_selector('#iStat'); pg.wait_for_timeout(300)
        it = pg.evaluate("() => [...document.querySelectorAll('#tDead tbody tr td.tw, #tBills tbody tr td.tw')].map(t => t.innerText.replace(/\\s+/g, ' ').trim())")
        top = pg.evaluate("() => document.getElementById('iStat').innerText.replace(/\\s+/g, ' ')")
        cm = why.split(' · ', 1)[1]
        ok(len(it) == 1 and it[0] == date and why in top, f'{no}: the issue page\'s table says "{it[0] if it else None}" (the status line above already names the committee, with its code: {top[:150]!r})')
        pg.evaluate("h => { location.hash = h; }", f"#/bill/{no}?i={IDS[no]['issue']}&who=all"); pg.wait_for_selector('#bStat'); pg.wait_for_timeout(300)
        bl = pg.evaluate("() => document.querySelector('#bStat .bln').innerText.replace(/\\s+/g, ' ').trim()")
        ok(bl == line, f'{no}: the bill page\'s stopped line is "{bl}"')
    # an issue with several bills that all stopped in the same committee names it; with different committees it keeps the short line
    SEV = model(pg, """const all = { kind: 'all', code: 'all' }, set = I.setFor(all, S.me), ses = I.sessionOf(set), rows = I.statesFor(set, ses).filter(x => x.k === 'stopped' && x.bills.length > 1);
      const same = rows.find(x => new Set(x.bills.map(b => T.stoppedWhy(b).cmte)).size === 1), diff = rows.find(x => new Set(x.bills.map(b => T.stoppedWhy(b).cmte)).size > 1);
      return { same: same && { id: same.issue.id, name: same.second.text, want: T.stoppedWhy(same.bills[0]).name }, diff: diff && { id: diff.issue.id, text: diff.second.text }, diff_name: diff && diff.issue.name };""")
    pg.evaluate("h => { location.hash = h; }", "#/issues?who=all&show=stopped"); pg.wait_for_timeout(500)
    def issue_row(i): return pg.evaluate("(id) => { const a = document.querySelector('a.sr3.ir[href*=\"' + id + '\"]'); return a ? a.innerText.replace(/\\s+/g, ' ').trim() : null; }", i)
    ok(SEV['same'] and f"Stopped in {SEV['same']['want']}" in (issue_row(SEV['same']['id']) or ''), f'an issue whose bills all stopped in one committee says so, with its code ({issue_row(SEV["same"]["id"])!r})')
    DEAD = lambda iid: (pg.evaluate("h => { location.hash = h; }", f"#/issue/{iid}?who=all"), pg.wait_for_selector('#tDead'), pg.wait_for_timeout(300), pg.evaluate("() => [...document.querySelectorAll('#tDead tbody tr')].map(tr => [tr.querySelector('th').innerText.replace(/\\s/g, ''), tr.querySelector('td.tw').innerText.replace(/\\s+/g, ' ').trim()])"))[-1]
    dead = DEAD(SEV['diff']['id'])
    codes = {c for n_, _ in dead for c in re.findall(r'\(([A-Z]{2,4})\)', byno[n_]['where'])}
    pg.evaluate("h => { location.hash = h; }", "#/issues?who=all&show=stopped"); pg.wait_for_timeout(500)
    ok(len(codes) >= 2 and re.search(rf" Stopped in {len(codes)} committees\b", ' ' + (issue_row(SEV['diff']['id']) or '')), f'an issue whose bills stopped in different committees says how many different ones ({len(codes)}): {issue_row(SEV["diff"]["id"])!r}')
    pg.evaluate("h => { location.hash = h; }", "#/issues?who=all&show=stopped"); pg.wait_for_timeout(300)
    allrows = pg.evaluate("() => [...document.querySelectorAll('#app a.sr3.ir .ir2')].map(e => e.innerText.replace(/\\s+/g, ' ').trim())")
    ok(allrows and not any(re.search(r'Stopped at |Stopped this year|Second chamber', t) for t in allrows), f'no old wording ("Stopped at First committees" and the like) in the stopped list ({len(allrows)} rows)')
    # an issue whose bills all stopped: the status line above names the last bill, with ITS date and reason; that bill is the first row of the folded list; every other row says the table's words in one line
    for iid, nm in ((SEV['diff']['id'], 'mixed'), ('88f6638b-924a-4232-89f4-6c7422c6428b', 'SNAP match for healthy local food'), ('18fc9d97-2d75-409d-bb69-7d07d2a45b72', 'A fee on sugary drinks'), ('748c47fe-be83-4b54-b9f5-b8b039a27f36', 'Higher tobacco taxes')):
        dead = DEAD(iid); top = pg.evaluate("() => document.getElementById('iStat').innerText.replace(/\\s+/g, ' ')")
        mm = re.search(r'bill, ([A-Z]+ ?\d+) ·', top); named = mm.group(1).replace(' ', '') if mm else ''
        dm = re.search(r'on \w{3}, (\w{3} \d+) ·', top)
        r0 = byno.get(named, {}); cm = r0.get('where', '')
        ok(len(dead) >= 2 and named == dead[0][0] and dm and 'Stopped ' + dm.group(1) == r0.get('next') and dead[0][1] == r0.get('next') and cm and cm in top, f'{nm}: the headline names {named} with its own date ({dm.group(1) if dm else None}) and committee, and {named} is the first row, which says only its date ({dead[0]})')
        ok(all(t == f"{byno[n_]['next']} · {byno[n_]['where']}" for n_, t in dead[1:]), f'{nm}: every other stopped bill says "Stopped <date> · <why>" in the table\'s words, so each reason appears ({[n_ for n_, _ in dead]})')
    # joint referrals carry a code per committee, on the whole table
    joints = [r for r in rs if r['stopped'] and '/' in r['w2']]
    ok(len(joints) > 100 and all(re.fullmatch(r'(House |Senate )?[A-Z]{2,4}(/[A-Z]{2,4})+', r['w2']) and r['wlabel'].startswith(r['w1'] + '. ') and r['ccn'] == r['w2'].count('/') + 1 for r in joints), f'every joint referral is its codes joined with "/", the chamber said once, and the cell carries the full names ({len(joints)} bills)')
    ok(all('(' not in r['w2'] or '/' not in r['w2'] for r in rs), 'no code pair like (JDC/WAM) anywhere')
    # the bill page says the table's words for at least six stopped bills, of every kind (never heard, heard and held, joint, a deadline in March, a bill with no stage data)
    SIX = ['SB1525', 'HB1747', 'SB2345', 'SB2699', 'HB1123', 'HB1532', 'SB1013', 'HB10', 'SB319']
    badp = []
    for no in SIX:
        r = byno[no]; want = stopped_one(r)
        pg.evaluate("h => { location.hash = h; }", f"#/bill/{no}?who=all"); pg.wait_for_selector('#bStat'); pg.wait_for_timeout(200)
        got = pg.evaluate("() => document.querySelector('#bStat .bln').innerText.replace(/\\s+/g, ' ').trim()")
        if got != want: badp.append((no, got, want))
    ok(not badp and len(SIX) >= 6, f'the bill page says the table\'s words for {len(SIX)} stopped bills ({badp[:2]})')
    # a bill's companion list says it the same way
    badc = []
    for no, comp in (('HB1021', 'SB1340'), ('HB1079', 'SB1398'), ('HB1075', 'SB1394'), ('HB108', 'SB464')):
        r = byno[comp]; want = stopped_one(r)
        pg.evaluate("h => { location.hash = h; }", f"#/bill/{no}?who=all"); pg.wait_for_selector('#bStat'); pg.wait_for_timeout(200)
        li = pg.evaluate("(c) => [...document.querySelectorAll('.blist li')].map(l => l.innerText.replace(/\\s+/g, ' ').trim()).find(t => t.replace(' ', '').startsWith(c)) || ''", comp)
        if want not in li: badc.append((no, li, want))
    ok(not badc, f'a companion list says a stopped companion in the same words ({badc[:2]})')
    # Search says it the same way, for a bill and for its issue, and for an issue with bills in several committees
    pg.evaluate("h => { location.hash = h; }", "#/search?q=SB1525"); pg.wait_for_timeout(800)
    st = pg.evaluate("() => document.getElementById('app').innerText.replace(/\\s+/g, ' ')")
    want = stopped_one(byno['SB1525'])
    ok(st.count(want) == 2, f'Search: the bill and its issue both say "{want}" ({st.count(want)} times)')
    pg.evaluate("h => { location.hash = h; }", "#/search?q=" + SEV['diff_name'].replace(' ', '%20')); pg.wait_for_timeout(800)
    st = pg.evaluate("() => document.getElementById('app').innerText.replace(/\\s+/g, ' ')")
    ok(re.search(r'Stopped in \d+ committees', st) and not re.search(r'Stopped at ', st), 'Search: an issue with bills in different committees says "Stopped in N committees"')
    # "vape" finds e-cigarettes in the table, as it does in the Issues find
    pg.evaluate("h => { location.hash = h; }", "#/issues/bills?who=all&q=vape"); pg.wait_for_timeout(400); settle(pg)
    vr = rows(pg)
    ok(vr and any('e-cigarette' in (r['bill'] + ' ' + r['sub']).lower() for r in vr), f'"vape" finds the e-cigarette bills ({len(vr)} bills)')
    # "SB 11" and "sb11" are the same search
    pg.evaluate("h => { location.hash = h; }", "#/issues/bills?who=all&q=SB%2011"); pg.wait_for_timeout(400); settle(pg); a1 = [r['no'] for r in rows(pg)]
    pg.evaluate("h => { location.hash = h; }", "#/issues/bills?who=all&q=sb11"); pg.wait_for_timeout(400); settle(pg); a2 = [r['no'] for r in rows(pg)]
    ok(a1 == a2 and a1[0] == 'SB11' and len(a1) > 3 and all(n_.startswith('SB11') for n_ in a1), f'"SB 11" and "sb11" find the same {len(a1)} bills, all numbers that start SB 11, SB 11 first')
    pg.context.close()

    # ---------------------------------------------------------------- columns in a teammate's view, the title, the picker
    pg = open_as(br, 'NT', 1440, 900, '#/issues/bills?who=LR'); settle(pg)
    heads = pg.evaluate(HEADS); rs = rows(pg)
    ok([h['text'] for h in heads] == ['Bill', 'Position', 'Coalition', 'Where it is', 'Next date'] and pg.evaluate(H1) == 'Lauren’s bills', f'a teammate\'s view: five columns, "Lauren’s bills" ({pg.evaluate(H1)!r})')
    LR = model(pg, "const lr = S.advocates.find(a => a.initials === 'LR'), v = B.viewOf(I.whoOf('LR', S.me, S.advocates), S.me), set = I.setFor(I.whoOf('LR', S.me, S.advocates), S.me); return { n: v.recs.length, ledBy: v.recs.filter(r => r.lids.length && !r.lids.includes(lr.id)).length };")
    ok(len(rs) == LR['n'] == 50 and pg.evaluate(COUNT) == '50 bills', f'Lauren has 50 bills, the same function Issues uses plus the ones she leads on no issue ({len(rs)})')
    ok(pg.locator('#whoPick a.on').inner_text() == 'Lauren Reyes' or pg.locator('#whoPick a.pk[aria-current="true"]').count() == 1, 'the picker shows Lauren as the chosen teammate')
    ok(all(not r['led'] for r in rs) == (LR['ledBy'] == 0) and (LR['ledBy'] == 0 or sum(1 for r in rs if r['led']) == LR['ledBy']), 'a bill led by someone else says "Led by", a teammate\'s own does not')
    snap(pg, 'teammate_lauren')
    pg.click('#whoMine'); pg.wait_for_timeout(500); settle(pg)
    ok(pg.evaluate(H1) == 'Your bills' and 'who=' not in pg.url, 'Mine goes back to your own list')
    pg.click('#whoMate'); pg.wait_for_timeout(200)
    ok(pg.locator('#whoPick').is_visible() and pg.locator('#whoMate').get_attribute('aria-expanded') == 'true', '"A teammate" opens the picker')
    pg.click('#whoPick a >> nth=0'); pg.wait_for_timeout(500); settle(pg)
    ok('who=' in pg.url and pg.evaluate(H1).endswith('’s bills'), 'choosing a teammate opens their bills')
    pg.click('#whoAll'); pg.wait_for_timeout(500); settle(pg)
    ok('who=all' in pg.url and pg.evaluate(H1) == 'All bills' and nrows(pg) == 734, 'Everyone shows all 734')
    ok(not pg.errs, f'no console error ({pg.errs[:2]})'); pg.context.close()
    pg = open_as(br, 'NT', 1440, 900, '#/issues/bills?who=ZZ'); pg.wait_for_timeout(500)
    ok(pg.locator('[data-notfound]').count() == 1 and pg.locator('#aTab').count() == 0, 'an unknown person in the address is said calmly, no table')
    pg.context.close()

    # ---------------------------------------------------------------- the three selects, Clear and the count
    pg = open_as(br, 'NT', 1440, 900, '#/issues/bills?who=all'); settle(pg)
    ok(pg.locator('#abPos option').all_inner_texts()[:2] == ['Any position', 'With a position'] and 'Monitor' in pg.locator('#abPos option').all_inner_texts() and pg.locator('#abSt option').all_inner_texts() == ['Alive and stopped', 'Alive', 'Stopped'], 'the Position select has Any, With a position, each side and Monitor; Status has three choices')
    ok(pg.locator('#abClear').is_hidden() and pg.locator('#abCoal option').first.inner_text() == 'Any coalition', 'no Clear while nothing is set')
    full = rows(pg); alive_n = sum(1 for r in full if not r['stopped'])
    pg.select_option('#abSt', 'alive'); pg.wait_for_timeout(250); settle(pg)
    ok(nrows(pg) == alive_n and all(not r['stopped'] for r in rows(pg)) and pg.evaluate(COUNT) == f'{alive_n} of 734 bills' and 'st=alive' in pg.url and pg.locator('#abClear').is_visible(), f'Status Alive: {alive_n} rows, "{pg.evaluate(COUNT)}", the address says st=alive, Clear shows')
    pg.select_option('#abSt', 'stopped'); pg.wait_for_timeout(250); settle(pg)
    ok(nrows(pg) == 734 - alive_n and all(r['stopped'] for r in rows(pg)), f'Status Stopped: {734 - alive_n} rows')
    pg.select_option('#abSt', ''); pg.wait_for_timeout(250); settle(pg)
    ok(nrows(pg) == 734 and pg.evaluate(COUNT) == '734 bills' and 'st=' not in pg.url and pg.locator('#abClear').is_hidden(), 'Alive and stopped is every bill, no filter in the address')
    pg.select_option('#abPos', 'with'); pg.wait_for_timeout(250); settle(pg); w = rows(pg)
    ok(w and all(r['pos'] not in ('Monitor', 'No position yet') for r in w) and len(w) == sum(1 for r in full if r['pos'] not in ('Monitor', 'No position yet')) and 'pos=with' in pg.url, f'With a position: no Monitor, no "No position yet" ({len(w)} bills)')
    pg.select_option('#abPos', 'monitor'); pg.wait_for_timeout(250); settle(pg)
    ok(all(r['pos'] == 'Monitor' for r in rows(pg)) and nrows(pg) == len(mons), f'Monitor: {len(mons)} bills')
    for val, lab in (('strongly_support', 'Strongly support'), ('support', 'Support'), ('oppose', 'Oppose')):
        pg.select_option('#abPos', val); pg.wait_for_timeout(200); settle(pg)
        ok(nrows(pg) == sum(1 for r in full if r['pos'] == lab) and all(r['pos'] == lab for r in rows(pg)), f'Position "{lab}": {nrows(pg)} bills, all of them')
    pg.select_option('#abPos', ''); settle(pg)
    camps = pg.locator('#abCoal option').all_inner_texts()[1:]
    cname = 'Healthy Eating, Active Living' if 'Healthy Eating, Active Living' in camps else camps[0]
    pg.select_option('#abCoal', label=cname); pg.wait_for_timeout(250); settle(pg); cr = rows(pg)
    ok(cr and all(cname in r['coal'] for r in cr) and nrows(pg) == sum(1 for r in full if cname in r['coal']) and 'coal=' in pg.url, f'Coalition "{cname}": {len(cr)} bills, all in it')
    pg.select_option('#abPos', 'with'); pg.select_option('#abSt', 'alive'); pg.fill('#abFind', 'snap'); pg.wait_for_timeout(300); settle(pg)
    ok(re.fullmatch(r'\d+ of 734 bills', pg.evaluate(COUNT)) and all(not r['stopped'] and r['pos'] not in ('Monitor', 'No position yet') and cname in r['coal'] for r in rows(pg)), f'three filters and a word together: {pg.evaluate(COUNT)}')
    snap(pg, 'filtered')
    pg.click('#abClear'); pg.wait_for_timeout(250); settle(pg)
    ok(nrows(pg) == 734 and pg.evaluate(COUNT) == '734 bills' and pg.input_value('#abFind') == '' and pg.input_value('#abPos') == '' and pg.input_value('#abCoal') == '' and pg.input_value('#abSt') == '' and re.search(r'#/issues/bills\?who=all$', pg.url), f'Clear sets all of them back and the address keeps only the view ({pg.url[-40:]})')
    # the count line is one plain count
    pg.fill('#abFind', 'zzzzqq'); pg.wait_for_timeout(250)
    ok(pg.evaluate(COUNT) == '0 of 734 bills' and 'No bill matches' in pg.locator('.aempty').inner_text() and pg.locator('#abNone').count() == 1, 'nothing found: "0 of 734 bills" and "No bill matches. Clear filters."')
    snap(pg, 'empty_no_match')
    pg.click('#abNone'); pg.wait_for_timeout(250); settle(pg)
    ok(nrows(pg) == 734 and pg.input_value('#abFind') == '', '"Clear filters" in the empty words brings the table back')
    pg.context.close()
    pg = open_as(br, 'JN', 1440, 900, '#/issues'); pg.wait_for_selector('#allBillsRow')
    ok(pg.locator('#allBillsRow').inner_text().replace('\n', ' ') == 'All bills 0 mine · 734 tracked', 'JN (no bills of her own): the row says 0 mine')
    pg.click('#allBillsRow'); pg.wait_for_selector('#abResult'); pg.wait_for_timeout(200)
    ok(pg.locator('.aempty').inner_text().startswith('You have no bills.') and pg.evaluate(COUNT) == '0 bills' and pg.locator('#aTab').count() == 0, 'Mine with no bills: "You have no bills. See Everyone."')
    snap(pg, 'empty_mine')
    pg.click('.aempty a'); pg.wait_for_timeout(500); settle(pg)
    ok('who=all' in pg.url and nrows(pg) == 734, '"See Everyone" opens Everyone')
    pg.context.close()

    # ---------------------------------------------------------------- sorting: every header, both ways, alive before stopped on ties; aria-sort; focus
    pg = open_as(br, 'NT', 1440, 900, '#/issues/bills?who=all'); settle(pg)
    h0 = pg.evaluate(HEADS)
    ok([h['sort'] for h in h0] == [None, None, None, None, None, 'ascending'], f'the default sort is Next date, soonest first, and says so ({[h["sort"] for h in h0]})')
    r0 = rows(pg)
    dated = [r for r in r0 if not r['stopped'] and r['next']]
    ok(r0[0]['next'].startswith('Today') and [r['stopped'] for r in r0] == sorted(r['stopped'] for r in r0) and all(r['next'].startswith('Stopped') or r['next'] == '' for r in r0 if r['stopped']), 'default order: dated bills soonest first, then alive bills with no date, then stopped bills')
    stops = [r['next'] for r in r0 if r['stopped']]
    MON = {m: i for i, m in enumerate('Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split())}
    sk = lambda t: (MON[t.split()[1]], int(t.split()[2])) if len(t.split()) == 3 else (0, 0)
    ok([sk(t) for t in stops] == sorted([sk(t) for t in stops], reverse=True), 'stopped bills: most recently stopped first')
    undated = [r for r in r0 if not r['stopped'] and not r['next']]
    ok(r0.index(undated[0]) > r0.index(dated[-1]) if undated else True, 'alive bills with no date follow the dated ones')
    NK = model(pg, "const v = B.viewOf({ kind: 'all', code: 'all' }, S.me); return v.recs.map(r => [r.no, r.next.key, r.alive, r.next.stop || '']);")
    keyof = {a: k for a, k, _, _ in NK}
    ks = [keyof[r['no']] for r in dated]
    ok(ks == sorted(ks), 'the dated bills are in the order of their dates and times')
    def click(k): pg.click(f'#abH-{k}'); pg.wait_for_timeout(200); settle(pg)
    def active(): return pg.evaluate("() => document.activeElement.id")
    def heads_sort(): return {h['text']: h['sort'] for h in pg.evaluate(HEADS) if h['sort']}
    def in_order(vals, desc=False):
        # in the order of the same collator the page sorts with (numbers by value, case and accents ignored), read in the page
        return pg.evaluate("([v, d]) => { const c = new Intl.Collator('en', { numeric: true, sensitivity: 'base' }); return v.every((x, i) => i === 0 || (d ? c.compare(v[i - 1], x) >= 0 : c.compare(v[i - 1], x) <= 0)); }", [vals, desc])
    JOURNEY = [(r'Not referred yet', 1), (r'Waiting for a hearing', 2), (r'Passed \d+ (of \d+ )?committees?', 3), (r'Crossed over, waiting for a hearing', 4), (r'(Hearing scheduled|Decision making scheduled)', 5), (r'Being heard today', 6), (r'Hearing held, no vote recorded', 7),
               (r'Passed committee, waiting for the floor vote', 8), (r'Back in the (House|Senate) to agree or disagree', 9), (r'In conference', 10), (r'With the Governor', 11), (r'(Signed into law|Adopted|Going to the voters)', 12), (r'No hearing', 13), (r'Deferred', 14),
               (r'Heard \w{3} \d+, no vote recorded', 15), (r'Vetoed', 16), (r'Failed a floor vote', 17), (r'Stopped', 18)]
    def JORD(r):
        for rx, n_ in JOURNEY:
            if re.match(rx + r'\b', r['w1']): return n_
        return 99
    def JOURNEY_OK(rs_, desc):
        keys = [[JORD(r), r['w2'], r['no']] for r in rs_]
        return all(k[0] < 99 for k in keys) and pg.evaluate("([k, d]) => { const c = new Intl.Collator('en', { numeric: true, sensitivity: 'base' }); const t = (x, y) => d * (x[0] - y[0]) || d * c.compare(x[1], y[1]) || c.compare(x[2], y[2]); return k.every((x, i) => i === 0 || t(k[i - 1], x) <= 0); }", [keys, -1 if desc else 1])
    POSR = ['Strongly support', 'Support', 'Support w/ amendments', 'Strongly oppose', 'Oppose', 'Comments (neutral)', 'Monitor', 'No position yet']
    def tie_ok(rs_, key):
        # a bill that stopped never comes before an alive bill of the same value
        last = {}
        for r in rs_:
            k = key(r)
            if r['stopped']: last[k] = True
            elif last.get(k): return False
        return True
    COLKEY = {
        'bill': lambda r: r['bill'], 'pos': lambda r: POSR.index(r['pos']), 'lead': lambda r: re.sub(r' \+\d$', '', r['lead']), 'coal': lambda r: re.sub(r' \+\d$', '', r['coal']), 'where': lambda r: r['where'],
    }
    for k, lab in (('bill', 'Bill'), ('pos', 'Position'), ('lead', 'Lead'), ('coal', 'Coalition'), ('where', 'Where it is'), ('next', 'Next date')):
        click(k)
        a = rows(pg); first_state = heads_sort()
        ok(first_state == {lab: 'ascending'} and active() == f'abH-{k}', f'{lab}: one click sorts it ascending, aria-sort says so, and the focus stays on its header button ({first_state}, {active()})')
        click(k)
        d = rows(pg); second = heads_sort()
        ok(second == {lab: 'descending'} and active() == f'abH-{k}' and [r['no'] for r in d] != [r['no'] for r in a], f'{lab}: a second click sorts it descending (aria-sort {second}), focus still on the button')
        if k == 'next':
            for rs_, desc in ((a, False), (d, True)):
                da = [keyof[r['no']] for r in rs_ if not r['stopped'] and keyof[r['no']] is not None]
                ok(da == sorted(da, reverse=desc) and [r['stopped'] for r in rs_] == sorted(r['stopped'] for r in rs_), f'Next date {"descending" if desc else "ascending"}: dates in order, alive above stopped')
            sd = [sk(r['next']) for r in d if r['stopped']]; sa = [sk(r['next']) for r in a if r['stopped']]
            ok(sa == sorted(sa, reverse=True) and sd == sorted(sd), 'Next date: stopped bills most recently stopped first, and the other way round when descending')
            ok(tie_ok(a, lambda r: r['next']) and tie_ok(d, lambda r: r['next']), 'Next date: on a tie alive comes before stopped, both ways')
            continue
        key = COLKEY[k]
        if k in ('lead', 'coal'):
            ne = lambda rs_: [r for r in rs_ if not re.match(r'No (lead|coalition)', key(r) if k == 'lead' else key(r))]
            va, vd = [key(r) for r in ne(a)], [key(r) for r in ne(d)]
            empties = [r for r in a if re.match(r'No (lead|coalition)', key(r))]
            ok(in_order(va) and in_order(vd, True) and (not empties or (all(re.match(r'No (lead|coalition)', key(r)) for r in a[-len(empties):]) and all(re.match(r'No (lead|coalition)', key(r)) for r in d[-len(empties):]))), f'{lab}: A to Z, then Z to A, and an empty cell ({len(empties)} here) stays last both ways')
        elif k == 'bill':
            for rs_, desc in ((a, False), (d, True)):
                nk = [r for r in rs_ if r['nick']]; nm = [r for r in rs_ if not r['nick']]
                ok(nk and nm and all(r['nick'] for r in rs_[:len(nk)]) and in_order([r['bill'] for r in nk], desc) and in_order([r['bill'] for r in nm], desc), f'Bill {"descending" if desc else "ascending"}: bills with our name first, in order of the name, then the bills shown by number, in number order')
            ok([r['bill'] for r in a if not r['nick']][0].startswith('HB') and [r['bill'] for r in a if not r['nick']][-1].startswith('SB'), 'Bill ascending: the numbered bills run HB before SB')
        elif k == 'pos':
            va, vd = [key(r) for r in a], [key(r) for r in d]
            ok(va == sorted(va) and vd == sorted(vd, reverse=True), 'Position: strongest first, then the other way round')
        elif k == 'where':
            ok(JOURNEY_OK(a, False) and JOURNEY_OK(d, True), 'Where it is: in the journey\'s order (not referred, waiting, passed some, crossed over, hearing, ... law, then the stopped ones: no hearing, deferred, heard, vetoed, failed, stopped), ties by committee then bill number; and the other way round')
        else:
            va, vd = [key(r) for r in a], [key(r) for r in d]
            ok(in_order(va) and in_order(vd, True), f'{lab}: in order, then in the other order')
        ok(tie_ok(a, key) and tie_ok(d, key), f'{lab}: on a tie alive comes before stopped, both ways')
    # keyboard: a header is a button in the tab order and Enter sorts
    pg.focus('#abH-bill'); pg.keyboard.press('Enter'); pg.wait_for_timeout(250); settle(pg)
    ok(heads_sort() == {'Bill': 'ascending'} and active() == 'abH-bill' and pg.evaluate("() => document.getElementById('abH-bill').tagName") == 'BUTTON', 'a header is a button: Enter sorts and the focus stays on it')
    ok('sort=bill' in pg.url and 'dir=' not in pg.url, f'the sort is in the address ({pg.url[-30:]})')
    ok(pg.evaluate("() => { const b = document.getElementById('abH-bill'); b.focus(); const cs = getComputedStyle(b); return cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) >= 2; }"), 'a focused header shows a visible focus ring')
    snap(pg, 'sorted_bill')
    pg.context.close()

    # ---------------------------------------------------------------- find: an exact number first
    pg = open_as(br, 'NT', 1440, 900, '#/issues/bills?who=all'); settle(pg)
    pg.fill('#abFind', 'SB 11'); pg.wait_for_timeout(300); settle(pg); f = rows(pg)
    ok(f and f[0]['no'] == 'SB11' and f[0]['bill'] in ('SB 11', byno['SB11']['bill']), f'"SB 11" finds SB 11 first ({[r["no"] for r in f[:4]]})')
    ok(any(r['no'].startswith('SB11') and r['no'] != 'SB11' for r in f) and all(r['no'].startswith('SB11') or 'sb' in (r['bill'] + r['sub']).lower().replace(' ', '') or re.search(r'\b11', r['bill'] + ' ' + r['sub']) for r in f), 'the other matches (SB 1120 and the like) follow it, and each really matches')
    pg.fill('#abFind', 'sb11'); pg.wait_for_timeout(250)
    ok(rows(pg)[0]['no'] == 'SB11', '"sb11" finds the same bill first')
    pg.fill('#abFind', 'HB 1562'); pg.wait_for_timeout(250)
    ok(rows(pg)[0]['no'] == 'HB1562' and rows(pg)[0]['bill'] == 'Youth mental health app pilot', 'a bill with a name is found by its number')
    pg.fill('#abFind', 'wildfire'); pg.wait_for_timeout(250); settle(pg); w = rows(pg)
    ok(w and all('wildfire' in (r['bill'] + ' ' + r['sub']).lower() for r in w) and 'q=wildfire' in pg.url, f'a word finds the bills that have it ({len(w)}) and goes in the address')
    ok(pg.evaluate("() => document.activeElement.id") == 'abFind', 'typing never moves the focus')
    # typing is quick: the answer to each key
    T = pg.evaluate("""async () => { const t = async fn => { const a = performance.now(); fn(); await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))); return performance.now() - a; };
      const inp = document.getElementById('abFind'), out = []; inp.focus(); for (const s of ['', 'h', 'he', 'hea', 'heal', 'healt', 'health']) { inp.value = s; out.push(await t(() => inp.dispatchEvent(new Event('input', { bubbles: true })))); }
      const sorts = []; for (const k of ['bill', 'pos', 'coal', 'where', 'next']) sorts.push(await t(() => document.getElementById('abH-' + k).click())); return { out, sorts }; }""")
    med = sorted(T['out'])[len(T['out']) // 2]
    ok(med < 100 and max(T['sorts']) < 150, f'a key is answered in {med:.0f} ms (median of {len(T["out"])}, worst {max(T["out"]):.0f}) and a sort in at most {max(T["sorts"]):.0f} ms')
    pg.context.close()

    # ---------------------------------------------------------------- the address: reload and Back keep the view, the filters and the sort
    pg = open_as(br, 'NT', 1440, 900, '#/issues/bills?who=all'); settle(pg)
    pg.select_option('#abPos', 'with'); pg.select_option('#abSt', 'alive'); pg.fill('#abFind', 'a'); pg.click('#abH-where'); pg.click('#abH-where'); pg.wait_for_timeout(300); settle(pg)
    hist0 = pg.evaluate("() => history.length")
    url = pg.url; before = [r['no'] for r in rows(pg)][:12]; cnt = pg.evaluate(COUNT)
    ok(all(x in url for x in ('who=all', 'pos=with', 'st=alive', 'q=a', 'sort=where', 'dir=desc')), f'view, filters and sort are all in the address ({url[url.index("#"):]})')
    pg.reload(); pg.wait_for_selector('#aTab'); settle(pg)
    ok([r['no'] for r in rows(pg)][:12] == before and pg.evaluate(COUNT) == cnt and pg.input_value('#abPos') == 'with' and pg.input_value('#abSt') == 'alive' and pg.input_value('#abFind') == 'a' and heads_sort() == {'Where it is': 'descending'}, 'reload keeps the view, the filters and the sort')
    first = rows(pg)[0]
    pg.click('#aTab tbody tr:first-child a.bn'); pg.wait_for_selector('#bStat'); pg.wait_for_timeout(300)
    ok('from=bills' in pg.url and 'bq=' in pg.url and pg.locator('#tbBack').inner_text().strip() == 'Back to All bills', f'the bill\'s address carries from=bills and the table\'s query ({pg.locator("#tbBack").inner_text().strip()!r})')
    pg.go_back(); pg.wait_for_selector('#aTab'); settle(pg)
    ok(pg.url == url and [r['no'] for r in rows(pg)][:12] == before and pg.input_value('#abSt') == 'alive' and heads_sort() == {'Where it is': 'descending'}, 'the browser\'s Back from a bill returns to the same table')
    pg.click('#aTab tbody tr:first-child a.bn'); pg.wait_for_selector('#bStat'); pg.click('#tbBack'); pg.wait_for_selector('#aTab'); settle(pg)
    ok(pg.url == url and [r['no'] for r in rows(pg)][:12] == before and pg.evaluate(COUNT) == cnt, '"Back to All bills" on the bill page returns to the table with its query')
    ok(pg.evaluate("() => history.length") <= hist0 + 2, 'typing and choosing did not pile up history steps')
    # Back keeps the place in a long table
    pg.fill('#abFind', ''); pg.select_option('#abPos', ''); pg.select_option('#abSt', ''); pg.wait_for_timeout(250); settle(pg)
    pg.evaluate("() => { document.querySelector('.paper').scrollTop = 2500; }"); pg.wait_for_timeout(150)
    y0 = pg.evaluate("() => document.querySelector('.paper').scrollTop"); no = pg.evaluate("() => { const p = document.querySelector('.paper').getBoundingClientRect(); return [...document.querySelectorAll('#aTab tbody tr')].find(t => t.getBoundingClientRect().top > p.top + 200).dataset.no; }")
    pg.click(f'#aTab tr[data-no="{no}"] a.bn'); pg.wait_for_selector('#bStat'); pg.go_back(); pg.wait_for_selector('#aTab'); settle(pg); pg.wait_for_timeout(200)
    y1 = pg.evaluate("() => document.querySelector('.paper').scrollTop")
    ok(y0 > 1500 and abs(y1 - y0) < 60, f'Back from a bill far down keeps the place in the table ({y0:.0f} -> {y1:.0f})')
    # the minute's redraw keeps the scroll, the address and the sort
    pg.click('#abH-pos'); pg.wait_for_timeout(250); settle(pg)
    pg.evaluate("() => { document.querySelector('.paper').scrollTop = 1800; }"); pg.wait_for_timeout(150)
    y0 = pg.evaluate("() => document.querySelector('.paper').scrollTop"); u0 = pg.url; r0 = [r['no'] for r in rows(pg)][:30]
    pg.evaluate("() => { document.activeElement.blur(); window.__staff7Tick(); }"); pg.wait_for_timeout(500); settle(pg)
    ok(abs(pg.evaluate("() => document.querySelector('.paper').scrollTop") - y0) < 5 and pg.url == u0 and [r['no'] for r in rows(pg)][:30] == r0 and heads_sort() == {'Position': 'ascending'}, f'the timed redraw keeps the scroll ({y0:.0f}), the address and the sort')
    pg.evaluate("() => document.getElementById('abH-pos').focus()"); pg.evaluate("() => window.__staff7Tick()"); pg.wait_for_timeout(400); settle(pg)
    ok(pg.evaluate("() => document.activeElement.id") == 'abH-pos', 'a focused header keeps the focus through the minute\'s redraw')
    pg.context.close()

    # ---------------------------------------------------------------- laptop sizes, sideways scroll, targets
    for (w, h) in ((1440, 900), (1280, 800)):
        for who, hash_ in (('NT', '#/issues/bills?who=all'), ('KR', '#/issues/bills')):
            pg = open_as(br, who, w, h, hash_); settle(pg)
            toolbar = pg.evaluate("() => { const t = [...document.querySelectorAll('.atool .segs3, .atool .findw, .atool select, .atool .clr')].filter(e => e.getBoundingClientRect().width > 0); return Math.max(...t.map(e => e.getBoundingClientRect().top + e.getBoundingClientRect().height / 2)) - Math.min(...t.map(e => e.getBoundingClientRect().top + e.getBoundingClientRect().height / 2)); }")
            ok(pg.evaluate(NOSIDE) and toolbar < 4, f'{w}x{h} {who}: no sideways scroll, and the switch, find box and the three selects are on one line')
            ok(not pg.evaluate(SMALL), f'{w}x{h} {who}: targets are at least 44px ({pg.evaluate(SMALL)[:4]})')
            vis = pg.evaluate("() => { const p = document.querySelector('.paper').getBoundingClientRect(); return [...document.querySelectorAll('#aTab tbody tr')].filter(t => { const r = t.getBoundingClientRect(); return r.top >= p.top && r.bottom <= p.bottom; }).length; }")
            ok(vis >= (8 if h == 900 else 6), f'{w}x{h} {who}: {vis} rows are in view at once')
            if (w, who) == (1280, 'NT'): snap(pg, 'everyone_1280')
            if (w, who) == (1440, 'KR'): snap(pg, 'mine_kr')
            ok(not pg.errs and not pg.bad, f'{w}x{h} {who}: no console error, nothing left the machine ({pg.errs[:1]} {pg.bad[:1]})')
            pg.context.close()

    # ---------------------------------------------------------------- the phone
    pg = open_as(br, 'NT', 390, 844, '#/issues/bills?who=all'); settle(pg)
    ok(pg.evaluate(NOSIDE), 'phone: no sideways scroll in Everyone')
    ph = pg.evaluate("""() => ({ filt: !!document.getElementById('abFilt') && document.getElementById('abFilt').getBoundingClientRect().width > 0, sort: document.getElementById('abSort').getBoundingClientRect().width > 0, panel: getComputedStyle(document.getElementById('abFilters')).display,
      headHidden: document.querySelector('#aTab thead').getBoundingClientRect().width <= 2, role: document.getElementById('aTab').getAttribute('role'), cells: document.querySelectorAll('#aTab [role=cell]').length, rowhead: document.querySelectorAll('#aTab [role=rowheader]').length })""")
    ok(ph['filt'] and ph['sort'] and ph['panel'] == 'none' and ph['headHidden'] and ph['role'] == 'table' and ph['cells'] > 0, f'phone: a Filters button, a Sort select, the selects folded away, the header row out of sight but the table kept for a screen reader ({ph})')
    lab = pg.evaluate("() => [...document.querySelectorAll('#aTab tbody tr')].slice(0, 12).map(tr => tr.innerText.replace(/\\s+/g, ' ').trim())")
    ok(any('Lead: ' in t for t in lab) and any('Coalition: ' in t for t in lab), f'phone: labelled lines ("Lead: Kris", "Coalition: ...") ({lab[1][:90]!r})')
    emp = pg.evaluate("() => [...document.querySelectorAll('#aTab tbody td')].filter(td => td.textContent.trim() === '' && getComputedStyle(td).display !== 'none').length")
    ok(emp == 0, 'phone: an empty line is not drawn')
    wn = pg.evaluate("() => { const tr = document.querySelector('#aTab tbody tr'); const w = tr.querySelector('.c-where').getBoundingClientRect(), n = tr.querySelector('.c-next').getBoundingClientRect(); return [w.bottom >= n.top - 2 && n.top < w.bottom + 24, getComputedStyle(tr.querySelector('.c-where')).display]; }")
    ok(wn[1] == 'inline', 'phone: where it is and the next date run on one line')
    pg.click('#abFilt'); pg.wait_for_timeout(200)
    ok(pg.locator('#abFilters').is_visible() and pg.locator('#abPos').is_visible() and pg.locator('#abFilt').get_attribute('aria-expanded') == 'true', 'phone: Filters opens the three selects')
    pg.select_option('#abPos', 'with'); pg.wait_for_timeout(250); settle(pg)
    ok('Filters · on' in pg.locator('#abFilt').inner_text() and nrows(pg) < 734 and pg.locator('#abClear').is_visible(), 'phone: a filter is on, the button says so, Clear shows')
    pg.select_option('#abSort', 'bill'); pg.wait_for_timeout(250); settle(pg)
    ok('sort=bill' in pg.url and pg.evaluate("() => document.getElementById('abH-bill').closest('th').getAttribute('aria-sort')") == 'ascending', 'phone: the Sort select sorts, and aria-sort follows')
    pg.click('#abRev'); pg.wait_for_timeout(250)
    ok('dir=desc' in pg.url, 'phone: the button beside Sort reverses the order')
    ok(not pg.evaluate(SMALL), f'phone: targets are at least 44px ({pg.evaluate(SMALL)[:4]})')
    snap(pg, 'phone_filters')
    pg.click('#abClear'); pg.wait_for_timeout(200)
    pg.click('#abFilt'); pg.wait_for_timeout(200)
    snap(pg, 'phone_everyone')
    # the minute's redraw on a phone keeps the place
    pg.evaluate("() => window.scrollTo(0, 1500)"); pg.wait_for_timeout(150); y0 = pg.evaluate("() => window.scrollY")
    pg.evaluate("() => { document.activeElement.blur(); window.__staff7Tick(); }"); pg.wait_for_timeout(500)
    ok(y0 > 800 and abs(pg.evaluate("() => window.scrollY") - y0) < 5, f'phone: the minute\'s redraw keeps the place in the list ({y0:.0f} -> {pg.evaluate("() => window.scrollY"):.0f})')
    pg.context.close()
    pg = open_as(br, 'KR', 390, 844, '#/issues/bills'); settle(pg)
    ok(pg.evaluate(NOSIDE) and not re.search(r'Lead: ', pg.evaluate("() => document.getElementById('aTab').innerText")) and pg.evaluate(H1) == 'Your bills', 'phone, Mine: no Lead line (it is you), no sideways scroll')
    snap(pg, 'phone_mine')
    pg.context.close()

    # ---------------------------------------------------------------- nothing is written, nothing leaves the machine
    pg = open_as(br, 'NT', 1440, 900, '#/issues/bills'); settle(pg)
    pg.click('#abH-bill'); pg.select_option('#abPos', 'with'); pg.fill('#abFind', 'tax'); pg.click('#whoAll'); pg.wait_for_timeout(400); settle(pg)
    pg.click('#aTab tbody tr:first-child a.bn'); pg.wait_for_selector('#bStat'); pg.go_back(); pg.wait_for_timeout(400)
    writes = [(m, u) for m, u in pg.seen if m != 'GET' and ('127.0.0.1' in u or 'localhost' in u)]
    out = [u for m, u in pg.seen if '127.0.0.1' not in u and 'localhost' not in u and 'fonts.g' not in u]
    ok(not writes and not out and not pg.bad, f'only GETs to 127.0.0.1 and the fonts ({writes[:2]} {out[:2]})')
    ok(not pg.errs, f'no page error or console error ({pg.errs[:2]})')
    pg.context.close()
    br.close()

passed = sum(res); print(f'\n{passed}/{len(res)} passed'); sys.exit(0 if passed == len(res) else 1)
