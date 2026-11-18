# Staff7's "Where it is" wording (R-398, the settled design of 17 Nov 2026), on the practice copy: staff7/place.js is the ONE source of a bill's place (two lines: line 1 the state, line 2 the committee), and every page says the same.
#   (a) every one of the 734 rows has a line 1 from the design's list; (b) how many bills are in each status on the practice data; (c) the statuses the practice data lacks, checked on SYNTHETIC bills through the data layer
#   (not referred, waiting, passed some, crossed over, hearing, decision making, being heard, heard no vote, floor, back to agree or disagree, conference, governor, law, adopted, ballot, vetoed, failed, no hearing with and without a
#   deadline date, deferred by the Capitol's words vs no vote recorded, stopped, a joint stop); (d) the same bill reads the same on the table, its bill page and Search (alive, "No hearing", heard-and-stopped); (e) no icon in the cell;
#   (f) no sideways scroll at 1440 and 1280, and a single committee's line 2 never wraps; (g) sort order is the journey; and the old wordings are on no page.
#   python3 tests/staff7_place.py [base]     base defaults to http://127.0.0.1:8851
import sys, re
from playwright.sync_api import sync_playwright
BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8851').rstrip('/')
res = []
def ok(c, m): res.append(bool(c)); print('PASS' if c else 'FAIL', m, flush=True)

NOSIDE = "() => document.documentElement.scrollWidth <= innerWidth && [...document.querySelectorAll('.paper, .wl')].every(p => p.scrollWidth <= p.clientWidth + 1)"
CELLS = """() => [...document.querySelectorAll('#aTab tbody tr')].map(tr => { const td = tr.querySelector('.c-where'), w1 = td.querySelector('.w1'), w2 = td.querySelector('.w2');
  return { no: tr.dataset.no, w1: w1 ? w1.innerText.trim() : '', w2: w2 ? w2.innerText.trim() : '', icon: !!td.querySelector('svg, img, .ic'), label: td.getAttribute('aria-label') || '', cc: td.querySelectorAll('.cc[title]').length, ccTitles: [...td.querySelectorAll('.cc')].map(e => e.getAttribute('title') || ''),
    w2h: w2 ? w2.getBoundingClientRect().height : 0, lh: w2 ? parseFloat(getComputedStyle(w2).lineHeight) : 0, w1w: w1 ? getComputedStyle(w1).fontWeight : '', w1c: w1 ? getComputedStyle(w1).color : '', w2c: w2 ? getComputedStyle(w2).color : '', ink: getComputedStyle(td).color }; })"""
ROWNEXT = "() => [...document.querySelectorAll('#aTab tbody tr')].map(tr => [tr.dataset.no, tr.querySelector('.c-next').innerText.trim()])"
ALLOWED1 = [r'Not referred yet', r'Waiting for a hearing', r'Passed \d+ (of \d+ )?committees?', r'Crossed over, waiting for a hearing', r'Hearing scheduled', r'Decision making scheduled', r'Being heard today', r'Hearing held, no vote recorded',
            r'Passed committee, waiting for the floor vote', r'Back in the (House|Senate) to agree or disagree', r'In conference', r'With the Governor', r'Signed into law', r'Adopted', r'Going to the voters',
            r'No hearing, missed the deadline', r'No hearing', r'Deferred( \w{3} \d+)?', r'Heard \w{3} \d+, no vote recorded', r'Vetoed', r'Failed a floor vote', r'Stopped']
def allowed(t): return any(re.fullmatch(a, t) for a in ALLOWED1)
# the old wordings, and "in <House|Senate> <committee name>" with no code after it (a committee on a page is always "Name (CODE)", or "House ABC/DEF" for a joint stop)
NOCODE = re.compile(r"\bin (?:House|Senate) [A-Za-z&,’ ]+?(?= ·|\.|,|$)", re.I)   # a bill page and a Search row never name a committee without its code
OLD = re.compile(r"No hearing in |, held\b|\bWas in \b|Heard \w{3} \d+ in |Waiting in |Ready for the floor vote|Through committee, waiting|(?-i:Floor vote, )", re.I)

def open_page(br, w, h, hash):
    ctx = br.new_context(viewport={'width': w, 'height': h}); errs = []
    ctx.route(lambda u: '127.0.0.1' not in u and 'localhost' not in u and 'fonts.g' not in u, lambda r: r.abort())
    pg = ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'Failed to load resource' not in m.text and 'ERR_FAILED' not in m.text else None)
    pg.goto(f'{BASE}/staff7.html?demo=1&as=NT{hash}'); pg.wait_for_selector('.paper', timeout=60000)
    pg.evaluate("Promise.all([document.fonts.load('400 14px Lato'), document.fonts.load('700 14px Lato')])"); pg.wait_for_timeout(300); pg.errs = errs
    return pg
def settle(pg):
    pg.wait_for_function("() => { const t = document.getElementById('aTab'); return !t || t.dataset.all === '1'; }", timeout=30000); pg.wait_for_timeout(150)
def go(pg, h, sel, ms=400):
    pg.evaluate("h => { location.hash = h; }", h); pg.wait_for_selector(sel, timeout=20000); pg.wait_for_timeout(ms)

# SYNTHETIC bills, built in the page from the data layer's own inputs (the bill's fields, S.hearings, S.outcomes); nothing is saved, S is put back after each one
SYN = """async (cases) => {
  const d = await import('/staff6/data.js'), P = await import('/staff7/place.js'), S = d.S, out = [], now = Date.now(), day = 864e5, iso = t => new Date(t).toISOString();
  let n = 0;
  for (const c of cases) {
    const b = Object.assign({ id: 'syn-' + (++n), bill_number: 'HB9' + String(n).padStart(3, '0'), chamber: 'H', stage: 'first_lateral', referrals: [], origin_stops: 0, committee: null, last_action: '', last_action_date: iso(now - 30 * day).slice(0, 10), died_deadline: null, died_at_stage: null, tracked: true, session_year: d.SESSION_YEAR }, c.bill);
    const hs0 = (c.hearings || []).map((h, i) => ({ id: b.id + '-h' + i, bill_id: b.id, committee: h.committee, scheduled_at: iso(now + h.at * day), status: 'scheduled', description: h.description || '', room: '' }));
    const hs = hs0; if (hs[0] && /\{d\}/.test(b.last_action)) { const x = new Date(hs[0].scheduled_at).toLocaleDateString('en-CA', { timeZone: 'Pacific/Honolulu' }).split('-'); b.last_action = b.last_action.replace('{d}', `${x[1]}-${x[2]}-${x[0].slice(2)}`); }
    S.hearings.push(...hs); const keep = {}; for (const h of c.hearings || []) { }
    hs.forEach((h, i) => { const o = c.hearings[i].outcome; if (o) { keep[h.id] = S.outcomes?.[h.id]; (S.outcomes ||= {})[h.id] = { hearing_id: h.id, bill_id: b.id, committee: h.committee, scheduled_at: h.scheduled_at, outcome: o }; } });
    let r; try { const p = P.placeOf(b); r = { name: c.name, key: p.key, order: p.order, line1: p.line1, l2: p.cmte.text, joint: p.cmte.joint, codes: p.cmte.codes, names: p.cmte.names, label: p.label, date: p.date, line: P.placeLine(b), html: P.placeHTML(b), lineHTML: P.placeLineHTML(b), stopped: P.stoppedLine(b), stoppedHTML: P.stoppedLineHTML(b), nx: (await import('/staff7/bills.js')).nextDateOf(b, null).text }; } catch (e) { r = { name: c.name, err: String(e && e.stack || e) }; }
    for (const h of hs) { S.hearings.splice(S.hearings.indexOf(h), 1); if (S.outcomes) { if (keep[h.id]) S.outcomes[h.id] = keep[h.id]; else delete S.outcomes[h.id]; } }
    out.push(r);
  }
  return out; }"""
def syn(pg, cases): return {r['name']: r for r in pg.evaluate(SYN, cases)}

with sync_playwright() as p:
    br = p.chromium.launch()

    # ---------------------------------------------------------------- (a) (b) (e) (f) the table, Everyone, at 1440 and 1280
    counts_by = {}
    for w in (1440, 1280):
        pg = open_page(br, w, 800, '#/issues/bills?who=all'); settle(pg)
        cells = pg.evaluate(CELLS)
        ok(len(cells) == 734, f'{w}: Everyone draws 734 rows')
        ok(all(c['w1'] and allowed(c['w1']) for c in cells), f'{w} (a): every one of the 734 rows has a non-empty line 1 from the design\'s list ({[c["w1"] for c in cells if not (c["w1"] and allowed(c["w1"]))][:3]})')
        ok(not any(c['icon'] for c in cells), f'{w} (e): no icon inside any Where it is cell')
        ok(pg.evaluate(NOSIDE), f'{w} (f): no sideways scroll on Everyone')
        single = [c for c in cells if c['w2'] and '/' not in c['w2']]
        ok(len(single) > 400 and all(c['w2h'] <= c['lh'] * 1.5 for c in single), f'{w} (f): a single committee\'s line 2 does not wrap, longest names included ({len(single)} rows; wrapped: {[c["w2"] for c in single if c["w2h"] > c["lh"] * 1.5][:3]})')
        ok(all(c['w1w'] in ('400', 'normal') and c['w1c'] == c['ink'] for c in cells) and all(c['w2c'] != c['w1c'] for c in cells if c['w2']), f'{w}: line 1 is normal weight in the ink colour, line 2 is muted')
        if w == 1440: ok(pg.evaluate("() => { const t = document.getElementById('aTab'); return !t.querySelector('.c-where [class*=amber], .c-where .dl'); }"), 'no status colour or amber in the Where it is cell')
        mine = open_page(br, w, 800, '#/issues/bills'); settle(mine)
        mc = mine.evaluate(CELLS); single = [c for c in mc if c['w2'] and '/' not in c['w2']]
        ok(mc and mine.evaluate(NOSIDE) and all(c['w2h'] <= c['lh'] * 1.5 for c in single), f'{w}: Mine ({len(mc)} rows) has no sideways scroll and no wrapped committee line')
        mine.context.close()
        if w == 1440:
            for c in cells: counts_by[c['no']] = c
            # (b) the counts per status
            def status(c):
                for rx, k in ((r'No hearing', 'no_hearing'), (r'Deferred', 'deferred'), (r'Heard \w{3} \d+, no vote', 'heard_stopped'), (r'Stopped', 'stopped'), (r'In conference', 'conference'), (r'Passed \d+', 'passed_some'), (r'Crossed over', 'crossed'), (r'Hearing scheduled', 'hearing')):
                    if re.match(rx, c['w1']): return k
                return 'other:' + c['w1']
            cnt = {}
            for c in cells: cnt[status(c)] = cnt.get(status(c), 0) + 1
            ok(cnt == {'no_hearing': 541, 'deferred': 26, 'stopped': 1, 'conference': 20, 'passed_some': 19, 'crossed': 89, 'hearing': 38}, f'(b) the practice data\'s 734 bills by status ({cnt})')
            # joint committees: codes joined by "/", the chamber once, each code's full name on pointing, the cell labelled
            jo = [c for c in cells if '/' in c['w2']]
            ok(len(jo) > 100 and all(re.fullmatch(r'(House |Senate )?[A-Z]{2,4}(/[A-Z]{2,4})+', c['w2']) and c['cc'] == c['w2'].count('/') + 1 and all(len(t) > 6 for t in c['ccTitles']) and c['label'].startswith(c['w1'] + '. ') for c in jo), f'joint committees: codes joined by "/", the chamber once, a title on each code, the cell\'s accessible label ({len(jo)} rows)')
            ex = next(c for c in jo if c['w2'] == 'Senate EIG/PSM/EDT')
            ok(ex['ccTitles'] == ['Senate Energy and Intergovernmental Affairs', 'Senate Public Safety and Military Affairs', 'Senate Economic Development and Tourism'] and 'Senate Energy and Intergovernmental Affairs, Senate Public Safety and Military Affairs, Senate Economic Development and Tourism' in ex['label'], f'"Senate EIG/PSM/EDT": each code carries its full name ({ex["ccTitles"]}) and the cell\'s label has them ({ex["label"][:90]!r})')
            ok(all(re.fullmatch(r'[A-Z][^()]+ \([A-Z]{2,4}\)', c['w2']) for c in cells if c['w2'] and '/' not in c['w2']), 'one committee is named in full with its code ("Senate Education (EDU)")')
            # Next date: the word "Hearing" is gone, the time stays
            nx = pg.evaluate(ROWNEXT)
            ok(not any('Hearing' in t for _, t in nx) and any(re.match(r'(Today|Tomorrow) \d', t) for _, t in nx) and any(re.match(r'\w{3} \d+:\d\d [AP]M', t) for _, t in nx), 'Next date: a hearing reads "Today 1:00 PM" / "Tomorrow 9:30 AM" / "Wed 1:10 PM", never the word "Hearing"')
            ok(any(t.startswith('Stopped') for _, t in nx) and any(t.startswith('by ') for _, t in nx), 'Next date: deadlines ("by Mon, Mar 30 · 14 days") and "Stopped Mar 6" are as they were')
        pg.context.close()

    # ---------------------------------------------------------------- (g) sort order is the journey
    pg = open_page(br, 1440, 900, '#/issues/bills?who=all&sort=where'); settle(pg)
    def order_of(w1):
        for i, rx in enumerate(ALLOWED1): pass
        for rx, n_ in ((r'Not referred', 1), (r'Waiting for a hearing', 2), (r'Passed \d+', 3), (r'Crossed over', 4), (r'(Hearing scheduled|Decision making)', 5), (r'Being heard', 6), (r'Hearing held', 7), (r'Passed committee', 8), (r'Back in', 9), (r'In conference', 10), (r'With the Governor', 11),
                       (r'(Signed into law|Adopted|Going to the voters)', 12), (r'No hearing', 13), (r'Deferred', 14), (r'Heard \w{3} \d+, no vote', 15), (r'Vetoed', 16), (r'Failed a floor vote', 17), (r'Stopped', 18)):
            if re.match(rx, w1): return n_
        return 99
    cs = pg.evaluate(CELLS); os_ = [order_of(c['w1']) for c in cs]
    ok(os_ == sorted(os_) and os_[0] == 3 and os_[-1] == 18, f'(g) Where it is ascending is the journey: {sorted(set(os_))} in that order, first Passed N of M, last Stopped')
    ok(pg.evaluate("() => { const c = new Intl.Collator('en', { numeric: true, sensitivity: 'base' }); const tr = [...document.querySelectorAll('#aTab tbody tr')].map(r => [r.querySelector('.w1').innerText, (r.querySelector('.w2') || { innerText: '' }).innerText, r.dataset.no]); return tr.every((x, i) => i === 0 || x[0] !== tr[i - 1][0] || c.compare(tr[i - 1][1], x[1]) <= 0); }"), '(g) inside one line 1, the committee text is in order')
    pg.click('#abH-where'); pg.wait_for_timeout(300); settle(pg)
    cs = pg.evaluate(CELLS); od = [order_of(c['w1']) for c in cs]
    ok(od == sorted(od, reverse=True) and od[0] == 18, '(g) a second click turns it round: the stopped lines first, the journey backwards')
    # ties: same line 1 and same committee are by bill number
    tie = pg.evaluate("() => { const c = new Intl.Collator('en', { numeric: true, sensitivity: 'base' }); const tr = [...document.querySelectorAll('#aTab tbody tr')].map(r => [r.querySelector('.w1').innerText, (r.querySelector('.w2') || { innerText: '' }).innerText, r.dataset.no]); return tr.every((x, i) => i === 0 || x[0] !== tr[i - 1][0] || x[1] !== tr[i - 1][1] || c.compare(tr[i - 1][2], x[2]) <= 0); }")
    ok(tie, '(g) the same state and committee: by bill number')
    pg.context.close()

    # ---------------------------------------------------------------- (c) the statuses the practice data lacks, on synthetic bills
    pg = open_page(br, 1440, 900, '#/issues/bills?who=all'); settle(pg)
    H = lambda committee, at, **kw: dict(committee=committee, at=at, **kw)
    cases = [
        dict(name='not_referred', bill=dict(stage='introduced', referrals=[], origin_stops=0)),
        dict(name='waiting', bill=dict(stage='first_lateral', referrals=['HLT', 'FIN'], origin_stops=2, committee='FIN')),
        dict(name='waiting_one', bill=dict(stage='first_decking', referrals=['HLT'], origin_stops=1, committee='HLT')),
        dict(name='passed_some', bill=dict(stage='first_decking', referrals=['HLT', 'FIN'], origin_stops=2, committee='FIN')),
        dict(name='passed_two_of_three', bill=dict(stage='first_decking', referrals=['HLT', 'CPC', 'FIN'], origin_stops=3, committee='FIN')),
        dict(name='crossed', bill=dict(stage='second_lateral', referrals=['HLT', 'EDU', 'WAM'], origin_stops=1, committee='WAM')),
        dict(name='hearing', bill=dict(stage='first_lateral', referrals=['HLT', 'FIN'], origin_stops=2, committee='FIN'), hearings=[H('HLT', 3)]),
        dict(name='decision', bill=dict(stage='first_lateral', referrals=['HLT', 'FIN'], origin_stops=2, committee='FIN'), hearings=[H('HLT', 3, description='Decision making only')]),
        dict(name='joint_hearing', bill=dict(stage='first_lateral', referrals=['EIG/PSM/EDT', 'WAM'], origin_stops=2, chamber='S', bill_number='SB9100', committee='WAM'), hearings=[H('EIG/PSM/EDT', 2)]),
        dict(name='being_heard', bill=dict(stage='first_lateral', referrals=['HLT', 'FIN'], origin_stops=2, committee='FIN', last_action_date='2020-01-01'), hearings=[H('HLT', -0.04)]),
        dict(name='heard_held', bill=dict(stage='first_lateral', referrals=['HLT', 'FIN'], origin_stops=2, committee='FIN', last_action_date='2020-01-01'), hearings=[H('HLT', -2)]),
        dict(name='floor', bill=dict(stage='first_floor', referrals=['HLT', 'FIN'], origin_stops=2)),
        dict(name='back_house', bill=dict(stage='second_crossover', referrals=['HLT', 'FIN', 'EDU'], origin_stops=2)),
        dict(name='back_senate', bill=dict(stage='second_crossover', referrals=['EDU', 'WAM', 'HLT'], origin_stops=2, chamber='S', bill_number='SB9101')),
        dict(name='conference', bill=dict(stage='conference', referrals=['HLT', 'EDU'], origin_stops=1)),
        dict(name='governor', bill=dict(stage='governor', referrals=['HLT'], origin_stops=1)),
        dict(name='law', bill=dict(stage='enacted', last_action='Act 12, 05/20/2026 (Gov. Msg. No. 99).')),
        dict(name='adopted', bill=dict(stage='enacted', bill_number='HCR9102')),
        dict(name='ballot', bill=dict(stage='ballot', referrals=['JHA'], origin_stops=1)),
        dict(name='vetoed', bill=dict(stage='vetoed')),
        dict(name='failed_floor', bill=dict(stage='dead', status_text='Failed a vote', referrals=['HLT'], origin_stops=1)),
        dict(name='no_hearing', bill=dict(stage='dead', died_at_stage='first_triple', died_deadline='Triple filing 2/11/26', referrals=['HLT', 'CPC', 'FIN'], origin_stops=3, committee='FIN')),
        dict(name='no_hearing_nodate', bill=dict(stage='dead', died_at_stage='first_triple', died_deadline=None, referrals=['HLT', 'CPC', 'FIN'], origin_stops=3, committee='FIN')),
        dict(name='no_hearing_joint', bill=dict(stage='dead', died_at_stage='first_lateral', died_deadline='Lateral 3/6/26', referrals=['EIG/PSM/EDT', 'WAM'], origin_stops=2, chamber='S', bill_number='SB9103', committee='WAM')),
        dict(name='deferred', bill=dict(stage='dead', died_at_stage='first_triple', died_deadline='Triple filing 2/11/26', referrals=['HLT', 'CPC', 'FIN'], origin_stops=3, committee='FIN', last_action='The committee(s) on HLT recommend(s) that the measure be deferred.'), hearings=[H('HLT', -20, outcome='deferred')]),
        dict(name='heard_no_vote', bill=dict(stage='dead', died_at_stage='first_triple', died_deadline='Triple filing 2/11/26', referrals=['HLT', 'CPC', 'FIN'], origin_stops=3, committee='FIN', last_action='Referred to HLT, CPC, FIN.'), hearings=[H('HLT', -20)]),
        dict(name='deleted_meeting', bill=dict(stage='dead', died_at_stage='first_triple', died_deadline='Triple filing 2/11/26', referrals=['HLT', 'CPC', 'FIN'], origin_stops=3, committee='FIN', last_action='This measure has been deleted from the meeting scheduled on Wednesday {d} 2:00PM'), hearings=[H('HLT', -20)]),
        dict(name='deleted_other_day', bill=dict(stage='dead', died_at_stage='first_triple', died_deadline='Triple filing 2/11/26', referrals=['HLT', 'CPC', 'FIN'], origin_stops=3, committee='FIN', last_action='This measure has been deleted from the meeting scheduled on Wednesday 01-07-25 2:00PM'), hearings=[H('HLT', -20)]),
        dict(name='deleted_nodate', bill=dict(stage='dead', died_at_stage='first_triple', died_deadline='Triple filing 2/11/26', referrals=['HLT', 'CPC', 'FIN'], origin_stops=3, committee='FIN', last_action='This measure has been deleted from the meeting scheduled on Wednesday.'), hearings=[H('HLT', -20)]),
        dict(name='deferred_lastday', bill=dict(stage='dead', died_at_stage='first_triple', died_deadline='Triple filing 2/11/26', referrals=['HLT', 'CPC', 'FIN'], origin_stops=3, committee='FIN', last_action='The committee(s) on HLT recommend(s) that the measure be deferred.', last_action_date='2026-02-12'), hearings=[H('HLT', -20, outcome='deferred')]),
        dict(name='deferred_nolastday', bill=dict(stage='dead', died_at_stage='first_triple', died_deadline='Triple filing 2/11/26', referrals=['HLT', 'CPC', 'FIN'], origin_stops=3, committee='FIN', last_action='The committee(s) on HLT recommend(s) that the measure be deferred.', last_action_date=''), hearings=[H('HLT', -20, outcome='deferred')]),
        dict(name='stopped_joint_nodate', bill=dict(stage='dead', referrals=['EIG/PSM/EDT'], origin_stops=1, chamber='S', bill_number='SB9104', committee='EIG/PSM/EDT', last_action='Carried over to 2026 Regular Session.')),
        dict(name='stopped_known', bill=dict(stage='dead', referrals=['JDC'], origin_stops=1, committee='JDC', last_action='Carried over to 2026 Regular Session.')),
        dict(name='stopped_unknown', bill=dict(stage='dead', referrals=[], origin_stops=0)),
    ]
    S_ = syn(pg, cases)
    bad = [k for k, v in S_.items() if 'err' in v]
    ok(not bad, f'(c) every synthetic bill gets a place without an error ({[(k, S_[k]["err"][:200]) for k in bad][:2]})')
    def is_(name, key, order, line1, l2=''):
        v = S_[name]; good = v.get('key') == key and v.get('order') == order and v.get('line1') == line1 and v.get('l2') == l2
        ok(good, f'(c) {name}: row {order} "{line1}"{" / " + l2 if l2 else ""} ({v.get("key")}, {v.get("order")}, {v.get("line1")!r}, {v.get("l2")!r})')
    is_('not_referred', 'not_referred', 1, 'Not referred yet')
    is_('waiting', 'waiting', 2, 'Waiting for a hearing', 'House Health (HLT)')
    is_('waiting_one', 'waiting', 2, 'Waiting for a hearing', 'House Health (HLT)')
    is_('passed_some', 'passed_some', 3, 'Passed 1 of 2 committees', 'House Finance (FIN)')
    is_('passed_two_of_three', 'passed_some', 3, 'Passed 2 of 3 committees', 'House Finance (FIN)')
    is_('crossed', 'crossed', 4, 'Crossed over, waiting for a hearing', 'Senate Education (EDU)')
    is_('hearing', 'hearing', 5, 'Hearing scheduled', 'House Health (HLT)')
    is_('decision', 'decision', 5, 'Decision making scheduled', 'House Health (HLT)')
    is_('joint_hearing', 'hearing', 5, 'Hearing scheduled', 'Senate EIG/PSM/EDT')
    is_('being_heard', 'being_heard', 6, 'Being heard today', 'House Health (HLT)')
    is_('heard_held', 'heard_held', 7, 'Hearing held, no vote recorded', 'House Health (HLT)')
    is_('floor', 'floor', 8, 'Passed committee, waiting for the floor vote')
    is_('back_house', 'back', 9, 'Back in the House to agree or disagree')
    is_('back_senate', 'back', 9, 'Back in the Senate to agree or disagree')
    is_('conference', 'conference', 10, 'In conference')
    is_('governor', 'governor', 11, 'With the Governor')
    is_('law', 'law', 12, 'Signed into law')
    is_('adopted', 'adopted', 12, 'Adopted')
    is_('ballot', 'ballot', 12, 'Going to the voters')
    is_('no_hearing', 'no_hearing', 13, 'No hearing, missed the deadline', 'House Health (HLT)')
    is_('no_hearing_nodate', 'no_hearing', 13, 'No hearing', 'House Health (HLT)')
    is_('no_hearing_joint', 'no_hearing', 13, 'No hearing, missed the deadline', 'Senate EIG/PSM/EDT')
    is_('deferred', 'deferred', 14, S_['deferred']['line1'], 'House Health (HLT)')
    ok(re.fullmatch(r'Deferred \w{3} \d+', S_['deferred']['line1']), f'(c) deferred: "Deferred <the hearing\'s date>" ({S_["deferred"]["line1"]!r})')
    is_('heard_no_vote', 'heard_stopped', 15, S_['heard_no_vote']['line1'], 'House Health (HLT)')
    ok(re.fullmatch(r'Heard \w{3} \d+, no vote recorded', S_['heard_no_vote']['line1']) and not re.search('eferred', S_['heard_no_vote']['line1']), f'(c) a real past hearing and a neutral last action: "Heard <date>, no vote recorded" ({S_["heard_no_vote"]["line1"]!r})')
    # a hearing the Capitol says was deleted from the meeting of that same day did not happen (HB 2372)
    is_('deleted_meeting', 'no_hearing', 13, 'No hearing, missed the deadline', 'House Health (HLT)')
    ok(S_['deleted_meeting']['line1'].startswith('No hearing') and 'Heard' not in S_['deleted_meeting']['line1'], '(c) "deleted from the meeting scheduled on <that hearing\'s day>": the hearing does not count as heard, "No hearing..."')
    is_('deleted_other_day', 'heard_stopped', 15, S_['deleted_other_day']['line1'], 'House Health (HLT)')
    is_('deleted_nodate', 'heard_stopped', 15, S_['deleted_nodate']['line1'], 'House Health (HLT)')
    ok(all(S_[k]['line1'].startswith('Heard ') for k in ('deleted_other_day', 'deleted_nodate')), '(c) a deleted-from-the-meeting action for ANOTHER day, or naming no day, ignores nothing: still "Heard <date>, no vote recorded"')
    # a deferral is dated by the Capitol's own action (SB 2699); the hearing's date only when the action has no date
    ok(S_['deferred_lastday']['line1'] == 'Deferred Feb 12', f'(c) deferred: the date is the Capitol\'s last action date, not the hearing\'s ({S_["deferred_lastday"]["line1"]!r})')
    ok(re.fullmatch(r'Deferred \w{3} \d+', S_['deferred_nolastday']['line1']) and S_['deferred_nolastday']['line1'] != 'Deferred Feb 12', f'(c) deferred with no last action date: falls back to the hearing\'s date ({S_["deferred_nolastday"]["line1"]!r})')
    # "Stopped" is said once: the Next date is empty when the stop date is unknown, and a one-line form carries the word once
    ok(S_['stopped_unknown']['nx'] == '' and S_['stopped_known']['nx'] == '' and S_['no_hearing_nodate']['nx'] == '' and S_['no_hearing']['nx'] == 'Stopped Feb 11', f'(c) Next date of a stopped bill: "Stopped Feb 11" with a date, empty without ({[S_[k]["nx"] for k in ("no_hearing", "stopped_known", "stopped_unknown", "no_hearing_nodate")]})')
    ok(all(len(re.findall(r'Stopped', S_[k]['stopped'])) == 1 and len(re.findall(r'Stopped', re.sub('<[^>]+>', '', S_[k]['stoppedHTML']))) == 1 for k in ('stopped_known', 'stopped_unknown', 'stopped_joint_nodate', 'no_hearing', 'no_hearing_nodate', 'deferred', 'heard_no_vote')), '(c) a one-line stopped form says "Stopped" exactly once')
    ok(S_['stopped_known']['stopped'] == 'Stopped · Senate Judiciary (JDC)' and S_['stopped_joint_nodate']['stopped'] == 'Stopped · Senate EIG/PSM/EDT', f'(c) a bill with no date: "Stopped · <committee>" ({S_["stopped_known"]["stopped"]!r}, {S_["stopped_joint_nodate"]["stopped"]!r})')
    is_('vetoed', 'vetoed', 16, 'Vetoed')
    is_('failed_floor', 'failed_floor', 17, 'Failed a floor vote')
    is_('stopped_known', 'stopped', 18, 'Stopped', 'Senate Judiciary (JDC)')
    is_('stopped_unknown', 'stopped', 18, 'Stopped')
    # one line, the date said once, the escaped HTML, the label of a joint stop
    ok(S_['hearing']['line'] == 'Hearing scheduled · House Health (HLT)' and S_['not_referred']['line'] == 'Not referred yet', f'(c) placeLine is "Line 1 · Line 2" (or line 1 alone): {S_["hearing"]["line"]!r}')
    ok(S_['no_hearing']['stopped'] == 'Stopped Feb 11 · No hearing, missed the deadline · House Health (HLT)' and S_['no_hearing']['date'] == 'Feb 11', f'(c) a stopped bill on a one-line page says the date once, first: {S_["no_hearing"]["stopped"]!r}')
    ok(S_['joint_hearing']['joint'] and S_['joint_hearing']['codes'] == ['EIG', 'PSM', 'EDT'] and S_['joint_hearing']['label'].startswith('Hearing scheduled. Senate Energy') and S_['joint_hearing']['html'].count('title="') == 3 and '<span class="w2">Senate <span class="cc"' in S_['joint_hearing']['html'], f'(c) a joint stop: three codes, three titles, the chamber once, a label ({S_["joint_hearing"]["html"][:140]})')
    ok('role="group" aria-label="Senate Energy' in S_['joint_hearing']['lineHTML'], '(c) placeLineHTML gives a joint stop an accessible name with the full names')
    ok(all(v['order'] == o for v, o in ((S_['conference'], 10), (S_['law'], 12), (S_['ballot'], 12), (S_['stopped_known'], 18))) and len({v['key'] for v in S_.values()}) >= 21, '(c) every status has a stable key and the design\'s order number')
    # the order of the statuses is the journey (the synthetic list, sorted by order, is the design's table)
    ords = [S_[n]['order'] for n in ('not_referred', 'waiting', 'passed_some', 'crossed', 'hearing', 'being_heard', 'heard_held', 'floor', 'back_house', 'conference', 'governor', 'law', 'no_hearing', 'deferred', 'heard_no_vote', 'vetoed', 'failed_floor', 'stopped_known')]
    ok(ords == sorted(ords) and len(set(ords)) == len(ords) and ords[0] == 1 and ords[-1] == 18, f'(c) the 18 rows of the design have their own order numbers 1 to 18 ({ords})')
    # HTML is escaped
    esc = pg.evaluate("""async () => { const d = await import('/staff6/data.js'), P = await import('/staff7/place.js'); const b = { id: 'syn-x', bill_number: 'HB9999', chamber: 'H', stage: 'first_lateral', referrals: ['<b>X</b>', 'HLT'], origin_stops: 2, committee: '<b>X</b>', last_action: '', tracked: true };
      try { const h = P.placeHTML(b) + P.placeLineHTML(b); return { raw: /<b>/.test(h), h }; } catch (e) { return { err: String(e) }; } }""")
    ok(not esc.get('raw') and 'err' not in esc, f'(c) a committee code from the data is escaped in the HTML ({esc})')
    ok(not pg.errs, f'no console error ({pg.errs[:2]})')
    pg.context.close()

    # ---------------------------------------------------------------- (d) the same bill reads the same on the table, the bill page, Search and the Issues list
    pg = open_page(br, 1440, 900, '#/issues/bills?who=all'); settle(pg)
    cells = {c['no']: c for c in pg.evaluate(CELLS)}; nx = dict(pg.evaluate(ROWNEXT))
    one = lambda c: f"{c['w1']} · {c['w2']}" if c['w2'] else c['w1']
    # twelve or more bills covering every status on the practice data (the first two of each, one of them joint where there is one) and the ones this build had wrong (HB 2372, SB 2699, SB 319, SB 11, HB 239, HB 1605, SB 3263)
    def status_of(c):
        for rx, k in ((r'No hearing', 'no_hearing'), (r'Deferred', 'deferred'), (r'Heard \w{3} \d+, no vote', 'heard_stopped'), (r'Stopped', 'stopped'), (r'In conference', 'conference'), (r'Passed \d+', 'passed_some'), (r'Crossed over', 'crossed'), (r'Hearing scheduled', 'hearing')):
            if re.match(rx, c['w1']): return k
        return 'other'
    DEAD = ('no_hearing', 'deferred', 'heard_stopped', 'stopped')
    by = {}
    for no, c in cells.items(): by.setdefault(status_of(c), []).append(no)
    SAMPLE = [(n, 'a named bill') for n in ('HB1349', 'HB10', 'HB1532', 'HB2372', 'SB2345', 'SB2699', 'SB319', 'SB11', 'HB239', 'HB1605', 'SB3263') if n in cells]
    for k, nos in by.items():
        jo = [n for n in nos if '/' in cells[n]['w2']]; pick = nos[:2] + jo[:1]
        SAMPLE += [(n, f'{k}') for n in pick if n not in [x for x, _ in SAMPLE]]
    ST = {status_of(cells[n]) for n, _ in SAMPLE}
    ok(len(SAMPLE) >= 12 and {'hearing', 'crossed', 'passed_some', 'conference', 'no_hearing', 'deferred', 'stopped'} <= ST, f'(d) {len(SAMPLE)} bills compared, every status on the practice data ({sorted(ST)})')
    for no, what in SAMPLE:
        c = cells[no]; line = one(c); k = status_of(c); alive = k not in DEAD
        want = line if alive else (f'{nx[no]} · {line}' if nx[no] else line if k == 'stopped' else f'Stopped · {line}')
        go(pg, f'#/bill/{no}?who=all', '#bStat'); bl = pg.evaluate("() => document.querySelector('#bStat .bln').innerText.replace(/\\s+/g, ' ').trim()"); full = pg.evaluate("() => document.getElementById('bStat').innerText.replace(/\\s+/g, ' ')")
        ok(bl == want, f'(d) {no} ({what}): the bill page LEADS with the table\'s words "{want}" ({bl!r})')
        go(pg, f'#/search?q={no}', '#slist', 700)
        st = pg.evaluate("() => document.getElementById('app').innerText.replace(/\\s+/g, ' ')")
        swant = f'{line} · {nx[no]}' if k == 'hearing' else want   # a hearing ahead says when too, in the table's Next date words
        ok(swant in st, f'(d) {no} ({what}): the Search row says "{swant}"')
        hit = [x.search(t) for x in (OLD, NOCODE) for t in (bl, st, full)]
        ok(not any(hit), f'(d) {no}: no old wording and no "in <committee>" without a code on its bill page or in Search ({[h.group(0) for h in hit if h][:1]})')
        if k == 'hearing': ok(len(re.findall(re.escape(c['w2'].split(' (')[0]), full)) <= 2 and 'none is scheduled' not in full, f'(d) {no}: the hearing line does not say the committee or the status again')
    # Search says a joint stop with each code's full name
    go(pg, '#/search?q=SB2345', '#slist', 700)
    ok(pg.evaluate("() => document.querySelectorAll('#slist .cc[title]').length") >= 2, '(d) a joint stop in Search: each code carries its full name')
    # the bill page and the issue page table link the committee again
    go(pg, '#/bill/HB1349?who=all', '#bStat'); ok(pg.evaluate("() => !!document.querySelector('#bStat .bln a[href^=\"#/search/committee/\"]')"), '(d) the bill page\'s lead line links the committee')
    go(pg, '#/bill/SB2345?who=all', '#bStat'); ok(pg.evaluate("() => document.querySelectorAll('#bStat .bln a[href^=\"#/search/committee/\"]').length") >= 2, '(d) a joint stop on the bill page links each code')
    # every practice "Deferred" row carries the Capitol's own action date
    dfr = pg.evaluate("""async (rows) => { const d = await import('/staff6/data.js'); const out = []; for (const [no, w1] of rows) { const b = d.S.bills.find(x => x.bill_number.replace(/\\s/g, '') === no); const iso = String(b.last_action_date || '').slice(0, 10); const m = iso ? new Date(iso + 'T12:00:00-10:00').toLocaleDateString('en-US', { timeZone: 'Pacific/Honolulu', month: 'short', day: 'numeric' }) : ''; out.push([no, w1, m]); } return out; }""", [[n, c['w1']] for n, c in cells.items() if c['w1'].startswith('Deferred')])
    ok(len(dfr) == 26 and all(w1 == (f'Deferred {m}' if m else 'Deferred') for _, w1, m in dfr), f'(d) every one of the {len(dfr)} "Deferred" rows is dated by the bill\'s last action date ({[x for x in dfr if x[1] != "Deferred " + x[2]][:3]})')
    ok(cells['SB2699']['w1'] == 'Deferred Feb 12', f'(d) SB 2699 reads "Deferred Feb 12" ({cells["SB2699"]["w1"]!r})')
    ok(cells['HB2372']['w1'] == 'No hearing, missed the deadline', f'(d) HB 2372 reads "No hearing, missed the deadline" ({cells["HB2372"]["w1"]!r})')
    ok(cells['SB319']['w1'] == 'Stopped' and nx['SB319'] == '', f'(d) SB 319: line 1 "Stopped" and an empty Next date ({cells["SB319"]["w1"]!r}, {nx["SB319"]!r})')
    # an issue with one bill, on the Issues list and on its page
    IDS = pg.evaluate("""async () => { const d = await import('/staff6/data.js'); const S = d.S; const b = S.bills.find(x => x.bill_number === 'SB1525'), bi = S.billIssues.find(x => x.bill_id === b.id); return { issue: bi.issue_id, n: S.billIssues.filter(x => x.issue_id === bi.issue_id).length }; }""")
    go(pg, '#/issues?who=all&show=stopped', '.wl', 500)
    row = pg.evaluate("(id) => { const a = document.querySelector('a.sr3.ir[href*=\"' + id + '\"]'); return a ? a.innerText.replace(/\\s+/g, ' ').trim() : null; }", IDS['issue'])
    ok(IDS['n'] == 1 and row and f"{nx['SB1525']} · {one(cells['SB1525'])}" in row, f'(d) SB1525\'s issue on the Issues list says the same ({row!r})')
    go(pg, f"#/issue/{IDS['issue']}?who=all", '#iStat'); top = pg.evaluate("() => document.getElementById('iStat').innerText.replace(/\\s+/g, ' ')")
    ok(one(cells['SB1525']) in top, f'(d) SB1525\'s issue page says it in its status line ({top[:160]!r})')
    I3 = pg.evaluate("""async () => { const d = await import('/staff6/data.js'); const S = d.S; const b = S.bills.find(x => x.bill_number.replace(/\\s/g, '') === 'SB319'), bi = S.billIssues.find(x => x.bill_id === b.id); return bi ? { issue: bi.issue_id, n: S.billIssues.filter(x => x.issue_id === bi.issue_id).length } : null; }""")
    if I3:
        go(pg, f"#/issue/{I3['issue']}?who=all", '#iStat', 300); t3 = pg.evaluate("() => document.getElementById('iStat').innerText.replace(/\\s+/g, ' ')")
        ok(len(re.findall(r'Stopped', t3)) == 1 or I3['n'] > 1, f'(d) SB319\'s issue page line says "Stopped" once ({t3[:160]!r})')
    # an alive bill on the issue page's table, said the same way
    AL = pg.evaluate("""async () => { const d = await import('/staff6/data.js'), St = await import('/staff7/standing.js'); const S = d.S; for (const i of S.issues) { if (i.archived_at) continue; const bs = S.billIssues.filter(x => x.issue_id === i.id).map(x => S.bills.find(b => b.id === x.bill_id)).filter(b => b && b.tracked !== false && St.isAlive(b)); if (bs.length) return { issue: i.id, no: bs[0].bill_number.replace(/\\s/g, '') }; } return null; }""")
    go(pg, f"#/issue/{AL['issue']}?who=all", '#tBills'); itx = pg.evaluate("(no) => { const t = [...document.querySelectorAll('#tBills tbody tr')].find(r => r.querySelector('th').innerText.replace(/\\s/g, '') === no); return t ? [...t.querySelectorAll('td.tw .w1, td.tw .w2')].map(e => e.innerText.trim()).join(' · ') : null; }", AL['no'])
    ok(itx and itx == one(cells[AL['no']]), f'(d) {AL["no"]} on its issue page\'s table says the table\'s words ({itx!r} / {one(cells[AL["no"]])!r})')
    ok(not pg.evaluate("() => !!document.querySelector('#tBills td.tw svg, #tBills td.tw img')"), '(e) no icon in the issue page table\'s Where it is cell')
    hd = pg.evaluate("() => [...document.querySelectorAll('#tBills thead th')].map(t => t.innerText.trim())")
    ok('Where it is' in hd and 'Now waiting' not in hd, f'(d) the issue page table\'s column is "Where it is" ({hd})')
    ok(pg.evaluate("() => [...document.querySelectorAll('#tBills td.tw')].filter(td => td.querySelector('.w2')).every(td => td.querySelectorAll('a.lk[href^=\"#/search/committee/\"]').length >= 1)"), '(d) the committee in every issue page table cell is a link to the committee page (each code of a joint stop)')

    # ---------------------------------------------------------------- the old wordings are gone from every staff7 page, for single bills
    texts = []
    for h, sel in (('#/issues?who=all&show=stopped', '.wl'), ('#/issues?who=all', '.wl'), ('#/issues/bills?who=all', '#aTab'), ('#/issues/bills', '#aTab'), ('#/search?q=a', '#slist')):
        go(pg, h, sel, 600); texts.append((h, pg.evaluate("() => document.getElementById('app').innerText.replace(/\\s+/g, ' ')")))
    ids = pg.evaluate("() => [...new Set([...document.querySelectorAll('a[href^=\"#/issue/\"]')].map(a => a.getAttribute('href')))].slice(0, 0)")
    allissues = pg.evaluate("async () => { const d = await import('/staff6/data.js'); return d.S.issues.filter(i => !i.archived_at).map(i => i.id).slice(0, 40); }")
    for iid in allissues:
        go(pg, f'#/issue/{iid}?who=all', '#app .bill, #iStat, .paper', 60); texts.append((iid, pg.evaluate("() => { const t = document.getElementById('tDead'); if (t) t.hidden = false; return document.getElementById('app').innerText.replace(/\\s+/g, ' '); }")))
    for no in ('HB10', 'HB1532', 'HB1349', 'HB1523', 'HB108', 'SB319', 'SB11', 'HB1079', 'SB2345'):
        go(pg, f'#/bill/{no}?who=all', '#bStat', 150); texts.append((no, pg.evaluate("() => document.getElementById('app').innerText.replace(/\\s+/g, ' ')")))
    # every alive practice bill page and a spread of the stopped ones: no "in <committee name>" without its code, no old wording, a lead line that is the place
    SWEEP = """async (nos) => { const out = []; for (const no of nos) { location.hash = '#/bill/' + no + '?who=all'; const t0 = Date.now();
      while (Date.now() - t0 < 5000) { await new Promise(r => setTimeout(r, 12)); const n = document.querySelector('.bno, .kindl.no'); if (n && n.innerText.replace(/\\s/g, '') === no && document.getElementById('bStat')) break; }
      const st = document.getElementById('bStat'); out.push([no, st ? st.innerText.replace(/\\s+/g, ' ') : '']); } return out; }"""
    swp = [n for n, c in cells.items() if status_of(c) not in DEAD] + [n for n, c in cells.items() if status_of(c) in DEAD][::12]   # every alive bill, and every 12th stopped one (a page takes about half a second)
    sweep = pg.evaluate(SWEEP, swp)
    sweep_bad = [(no, (NOCODE.search(t) or OLD.search(t) or re.search('^$', t)).group(0)) for no, t in sweep if NOCODE.search(t) or OLD.search(t) or not t]
    ok(len(sweep) == len(swp) > 200 and not sweep_bad, f'{len(sweep)} practice bill pages (all the alive ones): no "in <committee name>" without its code, no old wording ({sweep_bad[:3]})')
    old = [(h, OLD.search(t).group(0)) for h, t in texts if OLD.search(t)]
    ok(not old, f'no old wording ("No hearing in X", "Heard <date> in X, held", "In X", "Was in X") on {len(texts)} pages: Issues, All bills, Search, {len(allissues)} issue pages, 9 bill pages ({old[:3]})')
    ok(not any(re.search(r'\bletter\b|\bvape', t, re.I) for _, t in texts), 'no "letter" or "vape" on those pages')
    ok(not pg.errs, f'no console error ({pg.errs[:2]})')
    pg.context.close()
    br.close()
print(f'{sum(res)}/{len(res)} passed'); sys.exit(0 if all(res) else 1)
