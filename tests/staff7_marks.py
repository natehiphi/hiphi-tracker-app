# Staff7's marks on the Next date (R-398, Nate's table of 18 Nov 2026), on the practice copy: bill_cell.js signalOf is the ONE answer, and every page draws it.
#   (a) signalOf on SYNTHETIC bills, one case per row of the table, in the order the table tests them (first match wins): passed, floor, conference near and far and monitor,
#       hearing ahead (every position), deferred with the deadline ahead and with the stage dead, heard held (support 2 days soon, support 10 days heard, monitor heard),
#       needs a hearing (support at 5 days risk, at 20 days time, monitor and oppose none), not referred, cleared for oppose, and (Nate 18 Nov) a bill the upcoming
#       deadline does not touch is in the clear for every position, a hearing ahead still beats it, heard-no-vote stays heard, and with no row nothing changes;
#   (b) on the real page (All bills, Everyone): every Next date cell has exactly one mark, the legend lists exactly the marks in view and only those, a filter changes the legend,
#       no page error, and no sideways scroll at 1440, 1280 and 390;
#   (c) the marks use the page's own colour tokens only (no hex in the drawn marks).
#   python3 tests/staff7_marks.py [base]     base defaults to http://127.0.0.1:8880 (serve the worktree with docs/requests/R-398-dots/v2/serve.py)
import sys, re
from playwright.sync_api import sync_playwright
BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8880').rstrip('/')
res = []
def ok(c, m): res.append(bool(c)); print('PASS' if c else 'FAIL', m, flush=True)

NOSIDE = "() => document.documentElement.scrollWidth <= innerWidth && [...document.querySelectorAll('.paper, .wl')].every(p => p.scrollWidth <= p.clientWidth + 1)"
def open_page(br, w, h, hash):
    ctx = br.new_context(viewport={'width': w, 'height': h}); errs = []
    ctx.route(lambda u: '127.0.0.1' not in u and 'localhost' not in u and 'fonts.g' not in u, lambda r: r.abort())
    pg = ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'Failed to load resource' not in m.text and 'ERR_FAILED' not in m.text else None)
    pg.goto(f'{BASE}/staff7.html?demo=1&as=NT{hash}'); pg.wait_for_selector('.paper', timeout=60000)
    pg.evaluate("Promise.all([document.fonts.load('400 14px Lato'), document.fonts.load('700 14px Lato')])"); pg.wait_for_timeout(300); pg.errs = errs
    return pg
def settle(pg):
    pg.wait_for_function("() => { const t = document.getElementById('aTab'); return !t || t.dataset.all === '1'; }", timeout=30000); pg.wait_for_timeout(150)

# SYNTHETIC bills: made-up bills and hearings pushed into the page's data. Each case sets the calendar so that the deadline the bill races (stopOf's deadlineKey, read
# in the page) is k days ahead, and every other deadline key is 30 days further off, so a wrong key would give a wrong answer. A held hearing is one whose time has passed
# (within 12 days) and that has no outcome. Everything is put back after each case.
SYN = """async (cases) => {
  const d = await import('/staff6/data.js'), m = await import('/staff6/model.js'), C = await import('/staff7/bill_cell.js'), SD = await import('/staff7/standing.js'), S = d.S, DL = d.DEADLINES, day = 864e5, now = Date.now(), iso = t => new Date(t).toISOString();
  const ymd = t => new Date(t).toLocaleDateString('en-CA', { timeZone: 'Pacific/Honolulu' });
  const saveDL = JSON.parse(JSON.stringify(DL)), out = []; let n = 0;
  const restore = () => { for (const k of Object.keys(DL)) delete DL[k]; for (const k of Object.keys(saveDL)) DL[k] = JSON.parse(JSON.stringify(saveDL[k])); };
  for (const c of cases) {
    restore();
    const id = 'syn-' + (++n), b = Object.assign({ id, bill_number: 'HB9' + String(n).padStart(3, '0'), chamber: 'H', stage: 'first_lateral', referrals: ['HLT'], origin_stops: 0, committee: 'HLT',
      last_action: '', last_action_date: iso(now - 30 * day).slice(0, 10), died_deadline: null, died_at_stage: null, position: 'support', title: 'Made-up bill', description: 'Made-up bill',
      tracked: true, session_year: d.SESSION_YEAR }, c.bill);
    const hs = (c.hearings || []).map((h, i) => ({ id: id + '-h' + i, bill_id: id, committee: h.committee || b.committee, scheduled_at: iso(now + h.at * day), status: h.status || 'scheduled', description: '', room: '' }));
    S.hearings.push(...hs);
    if (c.dl != null) {
      const near = ymd(now + c.dl * day), far = ymd(now + (c.dl + 30) * day);
      for (const k of Object.keys(DL)) DL[k] = [[k, far]];
      DL.conference = [['House and Senate must agree', far], ['Fiscal', far]];
      const key = m.stopOf(b).deadlineKey;   // the deadline this bill races
      if (key === 'final_decking') DL.conference = [['House and Senate must agree', near], ['Fiscal', far]];
      else if (key === 'fiscal') DL.conference = [['House and Senate must agree', far], ['Fiscal', near]];
      else if (key && DL[key] !== undefined) DL[key] = [[key, near]];
    }
    // the upcoming deadline row the page would pass: 'own' = the one this bill races (it faces it); 'other' = a deadline it does not touch (a second-chamber gate its first-chamber bill has not reached); null = no row
    const dte = ymd(now + (c.dl ?? 30) * day), key0 = m.stopOf(b).deadlineKey;
    const row = c.row === 'own' ? { key: C.GATE(key0), date: dte } : c.row === 'other' ? { key: 'second_triple', date: dte } : (c.row || null);
    let r; try { const st = m.stopOf(b); r = { name: c.name, sig: C.signalOf(b, row), key: st.deadlineKey, clr: C.clearedOf(b, row), phase: st.phase, st2: SD.billStanding(b), amb: SD.isAmberRisk(b), iss: SD.issueStanding([b]) }; } catch (e) { r = { name: c.name, err: String(e) }; }
    for (const h of hs) S.hearings.splice(S.hearings.indexOf(h), 1);
    out.push(r);
  }
  restore();
  return out; }"""

FIRST = {'key': 'first_triple', 'date': '2026-12-01'}   # a row the second chamber's bills have passed (clearedOf: yes)
CASES = [
    # the Legislature is done, or it is on the floor
    dict(name='passed_governor', bill=dict(stage='governor', referrals=[], committee=None), dl=None, expect='clear'),
    dict(name='passed_law', bill=dict(stage='enacted', referrals=[], committee=None), dl=None, expect='clear'),
    dict(name='passed_ballot', bill=dict(stage='ballot', referrals=[], committee=None), dl=None, expect='clear'),
    dict(name='floor_vote_support', bill=dict(stage='first_floor', referrals=['HLT'], origin_stops=1), dl=5, expect='clear'),
    dict(name='floor_vote_monitor', bill=dict(stage='first_floor', referrals=['HLT'], origin_stops=1, position='monitor'), dl=5, expect='clear'),
    dict(name='floor_vote_oppose', bill=dict(stage='first_floor', referrals=['HLT'], origin_stops=1, position='oppose'), dl=5, expect='clear'),
    dict(name='vetoed', bill=dict(stage='vetoed', referrals=[], committee=None), dl=None, expect=''),
    dict(name='failed_floor', bill=dict(stage='first_floor', referrals=['HLT'], origin_stops=1, last_action='Failed to pass on third reading'), dl=5, expect=''),
    # conference: support or oppose only; the deadline 7 days or less is risk, 8 or more time, a missed one nothing
    dict(name='conference_near_support_3', bill=dict(stage='second_crossover', referrals=['HLT'], chamber='S', position='support'), dl=3, expect='risk'),
    dict(name='conference_7_support', bill=dict(stage='second_crossover', referrals=['HLT'], chamber='S', position='support'), dl=7, expect='risk'),
    dict(name='conference_8_oppose', bill=dict(stage='conference', referrals=[], position='oppose'), dl=8, expect='time'),
    dict(name='conference_far_oppose', bill=dict(stage='conference', referrals=[], position='oppose'), dl=30, expect='time'),
    dict(name='conference_monitor', bill=dict(stage='conference', referrals=[], position='monitor'), dl=3, expect=''),
    dict(name='conference_missed', bill=dict(stage='conference', referrals=[], position='support'), dl=-2, expect=''),
    # a hearing ahead is the blue calendar for every bill, whatever its position; it beats a held hearing and a deferral
    dict(name='hearing_ahead_support', bill=dict(position='support'), dl=5, hearings=[dict(at=3)], expect='hear'),
    dict(name='hearing_ahead_oppose', bill=dict(position='oppose'), dl=5, hearings=[dict(at=3)], expect='hear'),
    dict(name='hearing_ahead_monitor', bill=dict(position='monitor'), dl=5, hearings=[dict(at=3)], expect='hear'),
    dict(name='hearing_after_deadline_support', bill=dict(position='support'), dl=2, hearings=[dict(at=6)], expect='hear'),
    dict(name='hearing_ahead_beats_held', bill=dict(position='support'), dl=5, hearings=[dict(at=-1), dict(at=3)], expect='hear'),
    dict(name='hearing_ahead_beats_deferral', bill=dict(position='support', last_action='Committee deferred the measure.'), dl=5, hearings=[dict(at=3)], expect='hear'),
    # deferred: the dying mark until the deadline passes; a postponed hearing ahead makes the bill alive, so no dying mark
    dict(name='deferred_deadline_ahead', bill=dict(last_action='Committee deferred the measure.'), dl=10, expect='dying'),
    dict(name='deferred_stage_dead', bill=dict(stage='dead', died_at_stage='first_lateral', died_deadline='Lateral 3/6/26', last_action='Committee deferred the measure.'), dl=10, expect=''),
    dict(name='deferred_deadline_missed', bill=dict(last_action='Committee deferred the measure.'), dl=-2, expect=''),
    dict(name='deferred_postponed_hearing_ahead', bill=dict(last_action='Committee deferred the measure.'), dl=10, hearings=[dict(at=3, status='postponed')], expect='!dying'),
    # heard, no vote: the grey hourglass; the amber one only for a bill we support with its deadline 3 days off or less
    dict(name='heard_support_2_days', bill=dict(position='support'), dl=2, hearings=[dict(at=-1)], expect='soon'),
    dict(name='heard_support_3_days', bill=dict(position='support'), dl=3, hearings=[dict(at=-1)], expect='soon'),
    dict(name='heard_support_4_days', bill=dict(position='support'), dl=4, hearings=[dict(at=-1)], expect='heard'),
    dict(name='heard_support_10_days', bill=dict(position='support'), dl=10, hearings=[dict(at=-1)], expect='heard'),
    dict(name='heard_monitor_2_days', bill=dict(position='monitor'), dl=2, hearings=[dict(at=-1)], expect='heard'),
    # needs a hearing (bills we support only): amber at 7 days or less, grey clock further off; monitor, oppose and neutral have none
    dict(name='needs_hearing_support_5_days', bill=dict(position='support'), dl=5, row='own', expect='risk'),
    dict(name='needs_hearing_support_7_days', bill=dict(position='support'), dl=7, row='own', expect='risk'),
    dict(name='needs_hearing_support_8_days', bill=dict(position='support'), dl=8, row='own', expect='time'),
    dict(name='needs_hearing_support_20_days', bill=dict(position='support'), dl=20, row='own', expect='time'),
    dict(name='needs_hearing_strongly_support', bill=dict(position='strongly_support'), dl=5, row='own', expect='risk'),
    dict(name='needs_hearing_support_amend', bill=dict(position='support_amend'), dl=5, row='own', expect='risk'),
    dict(name='needs_hearing_neutral', bill=dict(position='neutral'), dl=5, row='own', expect=''),
    dict(name='needs_hearing_monitor', bill=dict(position='monitor'), dl=5, row='own', expect=''),
    dict(name='needs_hearing_oppose', bill=dict(position='oppose'), dl=5, row='own', expect=''),
    dict(name='needs_hearing_missed_deadline', bill=dict(position='support'), dl=-2, row='own', expect=''),
    dict(name='not_referred_support', bill=dict(referrals=[], committee=None), dl=5, expect=''),
    # a bill the upcoming deadline does not touch (its own gate is another one; here the second chamber's first gate, which a first-chamber bill has not reached) is in the clear,
    # whatever its position (Nate, 18 Nov); with no row (no upcoming deadline known) it keeps its old answer
    dict(name='untouched_support', bill=dict(position='support'), dl=5, row='other', expect='clear'),
    dict(name='untouched_monitor', bill=dict(position='monitor'), dl=5, row='other', expect='clear'),
    dict(name='untouched_oppose', bill=dict(position='oppose'), dl=5, row='other', expect='clear'),
    dict(name='untouched_neutral', bill=dict(position='neutral'), dl=5, row='other', expect='clear'),
    dict(name='untouched_not_referred', bill=dict(referrals=[], committee=None), dl=5, row='other', expect='clear'),
    dict(name='untouched_hearing_ahead', bill=dict(position='support'), dl=5, hearings=[dict(at=3)], row='other', expect='hear'),
    dict(name='untouched_heard_no_vote', bill=dict(position='support'), dl=10, hearings=[dict(at=-1)], row='other', expect='heard'),
    dict(name='untouched_deferred', bill=dict(last_action='Committee deferred the measure.'), dl=10, row='other', expect='dying'),   # the dying mark still comes first
    dict(name='no_row_untouched_support', bill=dict(position='support'), dl=10, expect='time'),
    dict(name='no_row_untouched_oppose', bill=dict(position='oppose'), dl=10, expect=''),
    dict(name='cleared_unknown_support', bill=dict(stage='second_lateral', referrals=['HLT'], origin_stops=0, chamber='S', position='support'), dl=5, row=FIRST, expect=''),
    # cleared: a bill that has passed the next deadline is never amber, whatever its position
    dict(name='cleared_oppose', bill=dict(stage='second_lateral', referrals=['HLT', 'WAM'], origin_stops=1, chamber='S', position='oppose'), dl=20, row=FIRST, expect='clear'),
    # at risk (Nate, 18 Nov): the amber conference triangle and the amber hourglass count in billStanding and an issue's standing too (stand, iss)
    dict(name='amb_conf_support_5', bill=dict(stage='conference', referrals=[], position='support'), dl=5, expect='risk', stand='risk', iss='risk'),
    dict(name='amb_conf_oppose_5', bill=dict(stage='conference', referrals=[], position='oppose'), dl=5, expect='risk', stand='risk'),
    dict(name='amb_conf_monitor_5', bill=dict(stage='conference', referrals=[], position='monitor'), dl=5, expect='', stand='moving'),
    dict(name='amb_conf_support_10', bill=dict(stage='conference', referrals=[], position='support'), dl=10, expect='time', stand='moving'),
    dict(name='amb_heard_support_2', bill=dict(position='support'), dl=2, hearings=[dict(at=-1)], expect='soon', stand='risk'),
    dict(name='amb_heard_support_5', bill=dict(position='support'), dl=5, hearings=[dict(at=-1)], expect='heard', stand='moving'),
    dict(name='amb_heard_monitor_2', bill=dict(position='monitor'), dl=2, hearings=[dict(at=-1)], expect='heard', stand='moving'),
]

with sync_playwright() as p:
    br = p.chromium.launch()

    # ---------------------------------------------------------------- (a) signalOf, one case per row
    pg = open_page(br, 1440, 900, '#/issues/bills?who=all'); settle(pg)
    got = pg.evaluate(SYN, [dict(c, bill=c['bill'], row=c.get('row')) for c in CASES])
    bad = []
    for c, g in zip(CASES, got):
        want_ok = (g.get('sig') != 'dying') if c['expect'] == '!dying' else (g.get('sig') == c['expect'])
        if 'stand' in c and g.get('st2') != c['stand']: want_ok = False; g['sig'] = f"{g.get('sig')} (billStanding {g.get('st2')})"
        if 'iss' in c and g.get('iss') != c['iss']: want_ok = False; g['sig'] = f"{g.get('sig')} (issueStanding {g.get('iss')})"
        if g.get('err') or not want_ok:
            bad.append(f"{c['name']}: got '{g.get('sig', g.get('err'))}' want '{c['expect']}'")
    ok(not bad, f'signalOf: every row of the table gives its mark on made-up bills ({len(CASES)} cases) {bad[:6]}')
    got_map = {g['name']: g.get('sig') for g in got}
    ok(got_map.get('cleared_unknown_support') == '' and [g for g in got if g['name'] == 'cleared_unknown_support'][0].get('clr') == 'unknown', 'clearedOf unknown gives no mark (the case really is unknown)')
    ok(got_map.get('needs_hearing_neutral') == '' and got_map.get('needs_hearing_monitor') == '', 'neutral and monitor bills that need a hearing get no mark')
    ok(all(got_map.get(k) == 'clear' for k in ('floor_vote_monitor', 'floor_vote_oppose')), 'floor vote: monitor and oppose bills are in the clear too')
    ok(got_map.get('failed_floor') == '' and got_map.get('vetoed') == '', 'a failed floor vote and a veto show no mark')
    ok(got_map.get('hearing_ahead_beats_held') == 'hear' and got_map.get('hearing_ahead_beats_deferral') == 'hear', 'a hearing ahead beats a held hearing and a deferral')
    ok(got_map.get('deferred_postponed_hearing_ahead') != 'dying', 'a deferred bill with a postponed hearing ahead is alive, so not dying')
    ok(got_map.get('conference_near_support_3') == 'risk' and got_map.get('conference_far_oppose') == 'time', 'conference: support or oppose only; the conference deadline 7 days or less is risk, further off is time')
    ok(got_map.get('heard_support_3_days') == 'soon' and got_map.get('heard_support_4_days') == 'heard' and got_map.get('heard_support_10_days') == 'heard', 'heard, no vote: amber hourglass at 3 days or less (4 days is grey), the grey one otherwise')
    ok(got_map.get('needs_hearing_support_7_days') == 'risk' and got_map.get('needs_hearing_support_8_days') == 'time', 'needs a hearing: amber at 7 days, grey at 8')
    ok(got_map.get('conference_7_support') == 'risk' and got_map.get('conference_8_oppose') == 'time', 'conference: amber at 7 days, grey at 8')
    ok(got_map.get('hearing_after_deadline_support') == 'hear', 'a hearing after the deadline is the blue calendar, never amber')
    ok(all(got_map.get(k) == 'clear' for k in ('untouched_support', 'untouched_monitor', 'untouched_oppose', 'untouched_not_referred')), 'untouched by the upcoming deadline (support, monitor, oppose, not referred): in the clear')
    ok(got_map.get('untouched_hearing_ahead') == 'hear' and got_map.get('untouched_heard_no_vote') == 'heard', 'untouched: a hearing ahead is still hear; heard with no vote is still heard, not clear')
    ok(got_map.get('no_row_untouched_support') == 'time', 'no row: an untouched support bill keeps its old answer (time)')
    ok(got_map.get('deferred_stage_dead') == '' and got_map.get('deferred_deadline_missed') == '', 'a dead deferred bill, and a deferred bill whose deadline has passed, show no mark')
    ok(all(g.get('st2') == 'risk' for g in got if g['name'] in ('amb_conf_support_5', 'amb_conf_oppose_5', 'amb_heard_support_2')), 'at risk: an amber conference bill or an amber hourglass bill is billStanding risk')

    # ---------------------------------------------------------------- (a2) isAmberRisk agrees with the amber marks on the practice bills
    AGREE = """async () => { const d = await import('/staff6/data.js'), m = await import('/staff6/model.js'), C = await import('/staff7/bill_cell.js'), SD = await import('/staff7/standing.js'), P = await import('/staff7/place.js');
      const bills = d.S.bills.filter(b => SD.isAlive(b) && b.tracked !== false && (!b.session_year || +b.session_year === +d.SESSION_YEAR));
      const diff = [], why = {}; let agree = 0, other = 0;
      for (const b of bills) {
        const amb = SD.isAmberRisk(b), sig = C.signalOf(b, null), mk = ['risk', 'soon'].includes(sig);
        if (amb === mk) { agree++; continue; }
        const grp = m.POS_GROUP[b.position] || '', st = m.stopOf(b);
        let r = 'other';
        if (amb && !mk) r = grp !== 'support' ? 'position: the mark only asks support bills (isAtRisk counts neutral too)' : P.placeOf(b).key === 'not_referred' ? 'not referred: the mark says nothing' : st.hearingState === 'held' ? 'heard: the mark shows grey or the clear, the rule still counts the deadline' : 'other';
        else if (!amb && mk) r = 'mark only';
        why[r] = (why[r] || 0) + 1; if (r === 'other' || r === 'mark only') other++;
        diff.push({ no: b.bill_number, pos: b.position, amb, sig, atRisk: SD.isAtRisk(b), r });
      }
      return { n: bills.length, agree, why, other, sample: diff.slice(0, 8) }; }"""
    ag = pg.evaluate(AGREE)
    print('AGREE', ag, flush=True)
    ok(ag['n'] > 100 and ag['other'] == 0, f"isAmberRisk agrees with the amber marks on {ag['agree']} of {ag['n']} alive practice bills; the rest are explained ({ag['why']})")
    pg.context.close()

    # ---------------------------------------------------------------- (b) the real page, Everyone, at 1440 and 1280
    for w in (1440, 1280):
        pg = open_page(br, w, 800, '#/issues/bills?who=all'); settle(pg)
        kinds = pg.evaluate("() => [...document.querySelectorAll('#aTab tbody td.c-next')].map(td => ({ n: td.querySelectorAll('.sgm').length, k: ([...td.querySelector('.sgm').classList].find(c => c.startsWith('sgm-')) || '') }))")
        nrows = pg.evaluate("() => document.querySelectorAll('#aTab tbody tr').length")
        ok(nrows > 700 and len(kinds) == nrows and all(x['n'] == 1 for x in kinds), f'{w}: every one of the {nrows} Next date cells has exactly one mark slot')
        cnt = pg.evaluate("() => { const o = {}; document.querySelectorAll('#aTab .c-next .sgm').forEach(e => { const k = [...e.classList].find(c => c.startsWith('sgm-')); o[k] = (o[k] || 0) + 1; }); return o; }")
        ok(sum(cnt.values()) == nrows, f'{w}: the mark counts add up to the row count ({cnt})')
        ok(pg.evaluate("() => [...document.querySelectorAll('#aTab .dl.amber')].every(d => d.querySelector('.sgm-risk, .sgm-soon'))"), f'{w}: every amber date has an amber mark (risk or soon)')
        ok(pg.evaluate("() => [...document.querySelectorAll('#aTab .sgm-risk, #aTab .sgm-soon')].every(s => s.closest('.dl').classList.contains('amber'))"), f'{w}: every amber mark has its date in amber')
        ok(pg.evaluate("() => [...document.querySelectorAll('#aTab .sgm:not(.sgm-none)')].every(s => s.getAttribute('role') === 'img' && s.getAttribute('aria-label') && s.getAttribute('aria-label') === s.getAttribute('title'))"), f'{w}: every mark is an image with its name as label and title')
        ok(pg.evaluate("() => [...document.querySelectorAll('#abLegend .sgm')].every(s => s.closest('[aria-hidden=\"true\"]'))"), f'{w}: legend icons sit inside aria-hidden')
        present = {x['k'][4:] for x in kinds if x['k'] != 'sgm-none'}
        leg = pg.evaluate("() => [...document.querySelectorAll('#abLegend .lgi')].map(e => e.textContent.trim())")
        names = pg.evaluate("() => ({ risk: 'At risk', soon: 'Vote needed soon', dying: 'Deferred', hear: 'Hearing set', heard: 'Heard, waiting for the vote', time: 'On time', clear: 'In the clear' })")
        want = [names[k] for k in ['risk', 'soon', 'dying', 'hear', 'heard', 'time', 'clear'] if k in present]
        # the clear mark names its deadline ("In the clear for Mar 19"): the legend's own deadline date is the one it must name
        dl_date = re.search(r'^Deadline \w{3}, (\w{3} \d{1,2}) ·', leg_head := pg.evaluate("() => document.getElementById('abLegend').textContent.trim()"))
        leg_n = [('In the clear' if x.startswith('In the clear') else x) for x in leg]
        ok(leg_n == want and not pg.evaluate("() => document.getElementById('abLegend').hidden"), f'{w}: the legend lists exactly the marks in view, in order ({leg})')
        ok(bool(dl_date) and leg_head.startswith('Deadline '), f'{w}: the legend starts with its deadline ("{leg_head[:48]}")')
        if dl_date:
            clr_names = pg.evaluate("() => [...document.querySelectorAll('#aTab .sgm-clear')].map(e => e.getAttribute('aria-label'))")
            ok(clr_names and all(n == 'In the clear for ' + dl_date.group(1) for n in clr_names), f'{w}: every clear mark is named "In the clear for {dl_date.group(1)}" ({len(clr_names)})')
            if w == 1440:
                ok(len(clr_names) > 50, f'{w}: more than 50 bills are in the clear on practice data ({len(clr_names)}; it was 7 before R-398 Nate 18 Nov)')
        ok(pg.evaluate("() => document.querySelector('#abCount').nextElementSibling.id") == 'abLegend', f'{w}: the legend sits directly under the bill count')
        ok(pg.evaluate(NOSIDE), f'{w}: no sideways scroll on All bills')
        ok(not pg.errs, f'{w}: no page error ({pg.errs[:2]})')
        if w == 1440:
            # the marks use the page's tokens: no hex colour on a mark, the colour comes from a --sig token
            cols = pg.evaluate("() => [...document.querySelectorAll('#aTab .sgm')].filter(e => e.className.includes('sgm-') && !e.className.includes('sgm-none')).map(e => getComputedStyle(e).color)")
            ok(cols and len(set(cols)) >= 3, f'{w}: the marks in view carry their status colours ({sorted(set(cols))})')
            pg.evaluate("() => { location.hash = '#/issues/bills?who=all&st=stopped'; }"); pg.wait_for_timeout(500); settle(pg)
            leg2 = pg.evaluate("() => [...document.querySelectorAll('#abLegend .lgi')].map(e => e.textContent.trim())")
            seen2 = pg.evaluate("() => [...new Set([...document.querySelectorAll('#aTab .c-next .sgm')].map(e => [...e.classList].find(c => c.startsWith('sgm-'))).filter(k => k !== 'sgm-none'))].map(k => k.slice(4))")
            ok([('In the clear' if x.startswith('In the clear') else x) for x in leg2] == [names[k] for k in ['risk', 'soon', 'dying', 'hear', 'heard', 'time', 'clear'] if k in seen2], f'a stopped view: the legend lists only the marks in that view ({leg2})')
        pg.context.close()

    # ---------------------------------------------------------------- (b) phone: no sideways scroll on All bills
    pg = open_page(br, 390, 844, '#/issues/bills?who=all'); settle(pg)
    ok(pg.evaluate(NOSIDE), '390: no sideways scroll on All bills')
    ok(pg.evaluate("() => [...document.querySelectorAll('#aTab tbody td.c-next')].every(td => td.querySelectorAll('.sgm').length === 1)"), '390: every Next date cell still has its mark slot')
    ok(not pg.errs, f'390: no page error ({pg.errs[:2]})')
    pg.context.close()
    br.close()
print(f'{sum(res)}/{len(res)} passed'); sys.exit(0 if all(res) else 1)
