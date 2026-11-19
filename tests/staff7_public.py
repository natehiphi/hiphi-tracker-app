# Staff7's public mode, part 1a (R-398, the settled design of 18 Nov 2026), on the practice copy only. The rules and words are the data layer's
# (staff6/data.js, the public-mode functions) and staff7/public_data.js; this drives them through the page itself, with no buttons (the screens are later parts).
#   (a) a non-admin's words wait and leave the public words unchanged; the same writer's second send joins; another writer is refused;
#   (b) the bar: a side bill missing a thing is refused and files nothing; a Monitor bill goes through;
#   (c) take back; take down; (d) our position: a non-admin's change waits as a 'position' change and leaves the public position alone; changing back withdraws it;
#   (e) an admin's approve changes the words; a stale approve is refused; a send back keeps its note; an ask past its last day is skipped; the bar holds after
#       publishing; approving a position sets the public position only; an admin's own publish is at once; an admin is refused while another's change waits;
#   (f) the reload that &as= causes keeps the waiting changes, and another writer is refused after it; (g) the wording functions give the design's strings; (h) no page errors.
#   python3 tests/staff7_public.py [base]     base defaults to http://127.0.0.1:8851
import re, sys
from playwright.sync_api import sync_playwright
BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8851').rstrip('/')
res = []
def ok(c, m): res.append(bool(c)); print('PASS' if c else 'FAIL', m, flush=True)

READY = "async () => { const d = await import('/staff6/data.js'); return !!(d.S.publicSeededV7 && d.S.me && d.S.bills.length); }"
INSTALL = "async () => { window.T = { d: await import('/staff6/data.js'), P: await import('/staff7/public_data.js') }; return true; }"
WHEN = r"(Mon|Tue|Wed|Thu|Fri|Sat|Sun) \d{1,2}:\d{2} (AM|PM)"
LBL = {'support': 'Support', 'oppose': 'Oppose', 'strongly_support': 'Strongly support', 'support_amend': 'Support w/ amendments', 'neutral': 'Comments (neutral)', 'strongly_oppose': 'Strongly oppose'}

def new_page(br):
    ctx = br.new_context(viewport={'width': 1280, 'height': 800}); errs = []
    ctx.route(lambda u: '127.0.0.1' not in u and 'localhost' not in u and 'fonts.g' not in u, lambda r: r.abort())
    pg = ctx.new_page()
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'Failed to load resource' not in m.text and 'ERR_FAILED' not in m.text else None)
    pg.errs = errs
    return pg

def open_as(pg, who):
    pg.goto(f'{BASE}/staff7.html?demo=1&as={who}')
    for _ in range(200):
        try:
            if pg.evaluate(READY): break
        except Exception:
            pass
        pg.wait_for_timeout(200)
    pg.evaluate(INSTALL)

with sync_playwright() as p:
    br = p.chromium.launch()
    pg = new_page(br)
    open_as(pg, 'KR')

    names = pg.evaluate("""() => { const S = T.d.S, a = i => S.advocates.find(x => x.initials === i);
        return { KR: a('KR').full_name.split(' ')[0], KV: a('KV').full_name.split(' ')[0], NT: a('NT').full_name.split(' ')[0], KRid: a('KR').id, NTid: a('NT').id }; }""")
    KR, KV, NT = names['KR'], names['KV'], names['NT']

    # ---------------------------------------------------------------- the picks, from the practice data as seeded (nothing waits on them yet)
    pk = pg.evaluate("""() => { const { d } = T, S = d.S, side = b => b.tracked !== false && d.isPublicSide(b.position);
      const busy = new Set((S.publicChanges || []).filter(x => x.status === 'waiting').map(x => x.target_id));
      const kr = S.advocates.find(a => a.initials === 'KR');
      const pubSide = S.bills.filter(b => side(b) && d.isLiveBill(b) && b.position === b.public_position && !busy.has(b.id)).map(b => b.id);
      const hidden = S.bills.filter(b => side(b) && !b.is_public && (S.assignments[b.id] || []).includes(kr.id)).map(b => b.id);
      const monitor = S.bills.filter(b => b.tracked !== false && b.position === 'monitor' && b.public_position === 'monitor' && d.isLiveBill(b) && !busy.has(b.id)).map(b => b.id);
      const seeds = (S.publicChanges || []).map(x => [x.id, x.kind, x.status, x.target_id]);
      return { pubSide, hidden, monitor, seeds }; }""")
    seeds = {x[0]: x for x in pk['seeds']}
    ok(len(pk['pubSide']) >= 8, f"the practice data has side bills on the public site to write for ({len(pk['pubSide'])})")
    ok(len(pk['hidden']) >= 3, f"KR leads at least three side bills with no public words ({len(pk['hidden'])})")
    ok(len(pk['monitor']) >= 1, 'a Monitor bill on the public site to write for')
    s1, s2 = seeds.get('pc-seed-1'), seeds.get('pc-seed-2')
    ok(s1 and s1[1] == 'bill' and s1[2] == 'waiting' and s2 and s2[1] == 'position' and s2[2] == 'waiting', f'two seeded waiting changes: one words change, one position change ({pk["seeds"]})')
    B1, B2 = s1[3], s2[3]
    A = dict(send=pk['pubSide'][0], take=pk['pubSide'][1], down=pk['pubSide'][2], approve=pk['pubSide'][3], stale=pk['pubSide'][4], back=pk['pubSide'][5], ask=pk['pubSide'][6], pos=pk['pubSide'][7])
    H, MON = pk['hidden'], pk['monitor'][0]

    SEND = "([id, f]) => { const r = T.d.sendPublicWords(id, f); const pc = T.d.S.publicChanges.find(x => x.kind === 'bill' && x.target_id === id && x.status === 'waiting'); return { refused: r.refused || null, waiting: !!r.waiting, pc: pc ? pc.id : null }; }"

    # ---------------------------------------------------------------- (a) a non-admin's words wait
    r = pg.evaluate("""async (id) => { const { d } = T, S = d.S, before = JSON.stringify(d.publicStateOf(id));
        const r = d.sendPublicWords(id, { public_summary: 'First summary for the test.' });
        const pcs = S.publicChanges.filter(x => x.kind === 'bill' && x.target_id === id && x.status === 'waiting');
        return { waiting: !!r.waiting, refused: r.refused || null, same: before === JSON.stringify(d.publicStateOf(id)), n: pcs.length, f: pcs[0] ? pcs[0].fields : null, pc: pcs[0] ? pcs[0].id : null }; }""", A['send'])
    ok(r['waiting'] and not r['refused'], 'a non-admin sends words: they wait, nothing is refused')
    ok(r['same'], "a non-admin's send leaves the bill's public words and positions unchanged")
    ok(r['n'] == 1 and r['f'] and r['f'].get('public_summary') == 'First summary for the test.' and r['f'].get('is_public') is True, 'one waiting change holds the words sent, and is_public true')
    PC_SEND = r['pc']
    r = pg.evaluate("""async (id) => { const { d } = T, S = d.S, b = S.bills.find(x => x.id === id);
        const r = d.sendPublicWords(id, { public_summary: 'Second summary for the test.', nickname: b.nickname });
        const pcs = S.publicChanges.filter(x => x.kind === 'bill' && x.target_id === id && x.status === 'waiting');
        return { n: pcs.length, sum: pcs[0].fields.public_summary, pc: pcs[0].id, unchanged: b.public_summary !== 'Second summary for the test.' }; }""", A['send'])
    ok(r['n'] == 1 and r['sum'] == 'Second summary for the test.' and r['pc'] == PC_SEND and r['unchanged'], "the same writer's second send joins the one waiting change")
    r = pg.evaluate(SEND, [B1, {'public_summary': 'Not Kris, a second writer.'}])
    ok(r['refused'] == f'{KV} has a change waiting on this bill' and r['pc'] is not None, f"another writer is refused while a change waits: {r['refused']!r}")
    r = pg.evaluate("""async (id) => { const { d } = T, S = d.S, before = JSON.stringify(d.publicStateOf(id));
        const r = d.sendPublicWords(id, { nickname: '' }); const n = S.publicChanges.filter(x => x.target_id === id && x.status === 'waiting').length;
        return { refused: r.refused || null, n, same: before === JSON.stringify(d.publicStateOf(id)) }; }""", H[0])
    ok(r['refused'] == 'bar' and r['n'] == 0 and r['same'], f"(b) the bar refuses a side bill missing its nickname and files nothing ({r['refused']!r})")
    r = pg.evaluate(SEND, [MON, {'nickname': ''}])
    ok(r['waiting'] and not r['refused'], '(b) the bar lets a Monitor bill through: it needs nothing')

    # ---------------------------------------------------------------- (c) take back and take down
    r = pg.evaluate("""async (id) => { const { d } = T, S = d.S; d.sendPublicWords(id, { public_summary: 'Take this back.' });
        const pc = S.publicChanges.find(x => x.target_id === id && x.status === 'waiting'), before = JSON.stringify(d.publicStateOf(id));
        const t = d.takeBackChange(pc.id), again = d.takeBackChange(pc.id);
        return { pc: pc.id, taken: !!t.taken, status: pc.status, words: pc.fields.public_summary, same: before === JSON.stringify(d.publicStateOf(id)), again: again.refused || null }; }""", A['take'])
    ok(r['taken'] and r['status'] == 'withdrawn' and r['words'] == 'Take this back.' and r['same'], "(c) take back: the waiting change is withdrawn, its words kept, the public site unchanged")
    ok(r['again'] == f'Already decided by {KR}', f"(c) take back again: already decided ({r['again']!r})")
    r = pg.evaluate("""async (id) => { const { d } = T, S = d.S; d.sendPublicWords(id, { public_summary: 'Down test.' });
        const was = S.bills.find(x => x.id === id).is_public; d.takeDownWords(id); const b = S.bills.find(x => x.id === id);
        const pcs = S.publicChanges.filter(x => x.target_id === id && x.kind === 'bill');
        return { was, now: b.is_public, st: pcs.map(x => [x.status, !!x.taken_down]) }; }""", A['down'])
    ok(r['was'] is True and r['now'] is False and r['st'] and all(s == ['withdrawn', True] for s in r['st']), f"(c) take down: the words come down at once; the waiting change is withdrawn and taken down ({r['st']})")

    # ---------------------------------------------------------------- the asks the admin will decide, sent as Kris
    PC_APPROVE = pg.evaluate(SEND, [A['approve'], {'public_summary': 'Approve test summary.'}])['pc']
    PC_STALE = pg.evaluate(SEND, [A['stale'], {'public_summary': 'Stale test summary.'}])['pc']
    PC_BACK = pg.evaluate(SEND, [A['back'], {'public_summary': 'Send back test summary.'}])['pc']
    PC_ASK = pg.evaluate(SEND, [A['ask'], {'public_action': 'Tell the committee why this matters to you.', 'public_action_until': '2026-01-01'}])['pc']
    ok(all([PC_APPROVE, PC_STALE, PC_BACK, PC_ASK]), 'four more waiting changes for the admin to decide (approve, stale, send back, expired ask)')

    # ---------------------------------------------------------------- (d) our position
    r = pg.evaluate("""async (id) => { const { d, P } = T, S = d.S, b = S.bills.find(x => x.id === id), old = b.position, pub0 = b.public_position, nw = old === 'oppose' ? 'support' : 'oppose';
        await d.DB.updateBill(id, { position: nw });
        const pc = d.waitingPosition(id), mid = { team: b.position, pub: b.public_position, kind: pc ? pc.kind : null, status: pc ? pc.status : null, f: pc ? pc.fields : null, line: P.publicPositionLine(b) };
        await d.DB.updateBill(id, { position: old });
        const pc2 = S.publicChanges.find(x => x.kind === 'position' && x.target_id === id);
        return { old, nw, pub0, mid, back: pc2 ? pc2.status : null, pubAfter: b.public_position, teamAfter: b.position }; }""", A['pos'])
    m = r['mid']
    ok(m['team'] == r['nw'] and m['pub'] == r['pub0'], "(d) a non-admin's position change: the team sees it at once, the public position is unchanged")
    ok(m['kind'] == 'position' and m['status'] == 'waiting' and m['f'] == {'public_position': r['nw']}, "(d) it files one waiting change of kind position, holding the public position only")
    ok(m['line'] == f"HIPHI's position: {LBL[r['nw']]} for the team · {LBL[r['pub0']]} on the public site", f"(g) our position, the two differing: {m['line']!r}")
    ok(r['back'] == 'withdrawn' and r['teamAfter'] == r['old'] and r['pubAfter'] == r['pub0'], '(d) changing back to the public position withdraws the change')

    # ---------------------------------------------------------------- (g) the wording, as this page reads it (phase one)
    w = pg.evaluate("""(ids) => { const { d, P } = T, S = d.S, kr = S.advocates.find(a => a.initials === 'KR'), nt = S.advocates.find(a => a.initials === 'NT');
      const syn = o => ({ position: 'support', nickname: 'Nick', public_summary: 'Sum', talking_points: ['a', 'b', 'c'], ...o });
      const hid = S.bills.find(x => x.id === ids.hidden), pub = S.bills.find(x => x.id === ids.send), askB = S.bills.find(x => x.id === ids.ask);
      return {
        bar1: P.bar(syn({ talking_points: ['a'] })), missing1: P.missingLine(syn({ talking_points: ['a'] })), still1: P.stillNeeded(syn({ talking_points: ['a'] })),
        missingSum: P.missingLine(syn({ public_summary: '' })), missingBoth: P.missingLine(syn({ nickname: '', talking_points: [] })), stillTwo: P.stillNeeded(syn({ nickname: '', public_summary: '' })),
        monBar: P.bar({ position: 'monitor', public_position: 'monitor' }), sides: P.SIDES, isMon: P.isSide('monitor'), isNone: P.isSide(null), isAmend: P.isSide('support_amend'),
        sendKR: P.sendLabel(kr), sendNT: P.sendLabel(nt), readyKR: P.readyLine(kr), readyNT: P.readyLine(nt), admin: P.adminFirst(),
        nowHidden: P.nowLine(hid), nowPub: P.nowLine(askB),
        dock1: P.dockLine({ me: kr, b: hid, changedKeys: ['nickname', 'talking_points'], sent: false }),
        dock2: P.dockLine({ me: kr, b: askB, changedKeys: ['public_action'], sent: false }),
        dock3: P.dockLine({ me: kr, b: pub, changedKeys: [], sent: true }),
        dock4: P.dockLine({ me: nt, b: askB, changedKeys: ['public_action'], sent: false }),
        dock5: P.dockLine({ me: nt, b: pub, changedKeys: [], sent: false }),
        dock6: P.dockLine({ me: kr, b: syn({ nickname: '', public_summary: '' }), changedKeys: ['nickname'], sent: false }),
        barRef: P.barRefusal({ bill_number: 'HB 123', nickname: 'Nick', public_summary: 'Sum', talking_points: ['a', 'b'] }),
        tailKR: P.positionTail(kr, syn({ nickname: '' })), tailNT: P.positionTail(nt, syn({})), tailKRok: P.positionTail(kr, syn({})),
        sent: P.sentToast('Nate'), posSame: P.publicPositionLine(pub), words: [P.BAND, P.LEAVE_PUBLIC, P.PREVIEW_TAG, P.SAVE_LATER, P.SAVED_FOR_TEAM, P.TAKE_WORDS_DOWN, P.TAKE_WORDS_DOWN_HELP,
          P.WORDS_DOWN_TOAST, P.ASK_THROUGH_HELP, P.MONITOR_LINE, P.DOOR_TEXT, P.ON_SITE_AFTER_APPROVE, P.APPROVED_TOAST, P.positionSaveNote('Support'), P.NOT_ON_SITE_YET, P.AFTER_APPROVE] };
    }""", {'hidden': H[0], 'send': A['send'], 'ask': A['ask']})
    ok(w['bar1']['met'] is False and [x['done'] for x in w['bar1']['list']] == [True, True, False] and w['bar1']['list'][2]['label'] == '3 talking points (1 so far)', f"(g) the bar's three things in field order, with the count: {w['bar1']['list']}")
    ok(w['missing1'] == 'Needs 2 more talking points' and w['missingSum'] == 'Needs a summary' and w['missingBoth'] == 'Needs a nickname and 3 more talking points', f"(g) missing: {w['missing1']!r} / {w['missingSum']!r} / {w['missingBoth']!r}")
    ok(w['still1'] == '1 thing still needed' and w['stillTwo'] == '2 things still needed', f"(g) still needed: {w['still1']!r} / {w['stillTwo']!r}")
    ok(w['monBar'] == {'met': True, 'list': []} and w['isMon'] is False and w['isNone'] is False and w['isAmend'] is True, 'a Monitor bill and no position are not sides; support with amendments is')
    ok(w['sides'] == ['strongly_support', 'support', 'support_amend', 'strongly_oppose', 'oppose', 'neutral'], 'the six sides, comments included')
    ok(w['sendKR'] == 'Send to Nate to publish' and w['sendNT'] == 'Publish to the public site' and w['readyKR'] == 'Ready to send to Nate' and w['readyNT'] == 'Ready to publish', f"(g) the button and the ready line follow the role: {w['sendKR']!r}, {w['sendNT']!r}")
    ok(w['admin'] == NT, f"the admin's first name is {NT}")
    ok(w['nowHidden'] == "Now on the public site: the Legislature's title only", f"(g) what is there, title only: {w['nowHidden']!r}")
    ok(w['nowPub'].startswith("Now on the public site: HIPHI's words"), f"(g) what is there, HIPHI's words: {w['nowPub']!r}")
    ok(w['dock1'] == 'Sending: the nickname and 3 talking points. Nate approves before the public sees them.', f"(g) dock: not public, a non-admin: {w['dock1']!r}")
    ok(w['dock2'] == 'Sending: the ask. The public keeps the earlier words until Nate approves.', f"(g) dock: public, a non-admin: {w['dock2']!r}")
    ok(w['dock3'] == 'Sent to Nate. Change anything and it joins your change.', f"(g) dock: sent, nothing new: {w['dock3']!r}")
    ok(w['dock4'] == 'Publishing: the ask. On the public site in 10 seconds.', f"(g) dock: an admin: {w['dock4']!r}")
    ok(w['dock5'] == 'These words are on the public site. Nothing new to publish.', f"(g) dock: an admin, nothing new: {w['dock5']!r}")
    ok(w['dock6'] == '2 things still needed', f"(g) dock: the bar not met says what is still needed: {w['dock6']!r}")
    ok(w['tailKR'] == '· needs a nickname · Write them' and w['tailNT'] == '· Publish the change' and w['tailKRok'] == '· Waiting on Nate to publish · See it', f"(g) the position's tail: {w['tailKR']!r} / {w['tailNT']!r} / {w['tailKRok']!r}")
    ok(w['barRef'] == 'HB 123 now has 2 talking points. It needs 3.', f"(g) the refusal in plain words: {w['barRef']!r}")
    ok(w['sent'] == 'Sent to Nate. The public site has not changed.', f"(g) the sent toast: {w['sent']!r}")
    ok(w['posSame'] and w['posSame'].startswith("HIPHI's position: ") and 'public site' not in w['posSame'], f"(g) the position line, the two the same: {w['posSame']!r}")
    exp = ['You are changing the public site', 'Leave public mode', 'Preview · a picture, not the real page', 'Save for later', 'Saved for the team. The public site has not changed.',
           "Take HIPHI's words down", 'Off the public site at once. Nobody needs to approve this.', "HIPHI's words are off the public site. Undo",
           'The ask comes down by itself after this day. The rest stays.', 'Monitor bills need nothing here. A nickname and a summary help people find it.',
           'Change what the public sees', 'On the public site 10 seconds after you approve.', 'Approved. On the public site in 10 seconds.',
           'The team sees this at once. The public site keeps Support until it is published in public mode.', 'Not on the public site yet', 'After you approve']
    ok(w['words'] == exp, f"(g) the fixed words of the design are exact ({[a for a, b in zip(w['words'], exp) if a != b][:2]})")

    # ---------------------------------------------------------------- (f) the reload that &as= causes, then Nate
    n_before = pg.evaluate("() => T.d.S.publicChanges.filter(x => x.status === 'waiting').length")
    ok(n_before >= 6, f"before the switch: {n_before} changes wait")
    open_as(pg, 'NT')
    ok(pg.evaluate("() => T.d.S.me.is_admin === true && T.d.S.publicChanges.filter(x => x.status === 'waiting').length") == n_before, '(f) as Nate after &as=: the same waiting changes are there')
    ok(pg.evaluate("(id) => T.d.S.publicChanges.find(x => x.id === id).fields.public_summary", PC_SEND) == 'Second summary for the test.', '(f) the words a waiting change holds survive the switch')
    ok(pg.evaluate("(id) => T.d.S.publicChanges.find(x => x.id === id).status", PC_BACK) == 'waiting' and pg.evaluate("(id) => T.d.S.publicChanges.filter(x => x.target_id === id && x.kind === 'bill' && x.status === 'withdrawn').length", A['take']) == 1, '(f) a taken-back change is kept as withdrawn')

    # (e) the admin's approve
    r = pg.evaluate("""async ([pc, id]) => { const { d, P } = T, S = d.S, b = S.bills.find(x => x.id === id), seen = d.publicStateOf(id);
        const r = d.decidePublicChangeV7(pc, true, '', seen), row = S.publicChanges.find(x => x.id === pc);
        const again = d.decidePublicChangeV7(pc, true, '', d.publicStateOf(id));
        return { r, status: row.status, summary: b.public_summary, isPub: b.is_public, by: b.public_published_by, me: S.me.id, again: again.refused || null, now: P.nowLine(b), at: b.public_published_at || null }; }""", [PC_APPROVE, A['approve']])
    ok(r['r'].get('approved') and r['status'] == 'approved' and r['summary'] == 'Approve test summary.' and r['isPub'] is True, "(e) an admin's approve changes the public words")
    ok(r['by'] == r['me'] and r['again'] == f'Already decided by {NT}', f"(e) the approve is by Nate, and again says already decided ({r['again']!r})")
    ok(re.match(r"^Now on the public site: HIPHI's words · published " + WHEN + " by " + NT + "$", r['now']), f"(g) what is there after publishing: {r['now']!r}")
    r = pg.evaluate("""async ([pc, id]) => { const { d } = T, S = d.S, b = S.bills.find(x => x.id === id), seen = d.publicStateOf(id);
        b.public_summary = 'Changed by someone else.';
        const r = d.decidePublicChangeV7(pc, true, '', seen), row = S.publicChanges.find(x => x.id === pc);
        return { refused: r.refused || null, status: row.status, summary: b.public_summary }; }""", [PC_STALE, A['stale']])
    ok(r['refused'] == 'This changed since you opened it' and r['status'] == 'waiting' and r['summary'] == 'Changed by someone else.', f"(e) a stale approve is refused and the change still waits ({r['refused']!r})")
    r = pg.evaluate("""async ([pc, id]) => { const { d, P } = T, S = d.S, b = S.bills.find(x => x.id === id), before = b.public_summary, seen = d.publicStateOf(id);
        const r = d.decidePublicChangeV7(pc, false, '  Say more about cost  ', seen), row = S.publicChanges.find(x => x.id === pc);
        return { sent: !!r.sent_back, status: row.status, note: row.note, same: before === b.public_summary, line: P.sentBackLine(row), isPub: b.is_public }; }""", [PC_BACK, A['back']])
    ok(r['sent'] and r['status'] == 'sent_back' and r['note'] == 'Say more about cost' and r['same'], "(e) a send back keeps the public words and the note")
    ok(r['line'] == f'Sent back by {NT}: Say more about cost', f"(g) the sent-back line: {r['line']!r}")
    r = pg.evaluate("""async ([pc, id]) => { const { d } = T, S = d.S, b = S.bills.find(x => x.id === id), act = b.public_action ?? null, seen = d.publicStateOf(id);
        const r = d.decidePublicChangeV7(pc, true, '', seen);
        return { approved: !!r.approved, skipped: r.skipped || [], action: b.public_action ?? null, same: act === (b.public_action ?? null), isPub: b.is_public }; }""", [PC_ASK, A['ask']])
    ok(r['approved'] and r['skipped'] == ['public_action', 'public_action_until'] and r['same'], f"(e) an ask whose last day has passed is skipped, the rest is published ({r['skipped']})")
    r = pg.evaluate("""async (id) => { const { d } = T, S = d.S, b = S.bills.find(x => x.id === id), pub = d.sendPublicWords(id, {});
        let msg = null; try { await d.DB.updateBill(id, { nickname: '' }); } catch (e) { msg = e.message; }
        return { published: !!pub.published, isPub: b.is_public, msg, nick: b.nickname }; }""", H[1])
    ok(r['published'] and r['isPub'] is True and r['msg'] == "HIPHI's words are on the public site, so this bill needs a nickname, a summary and 3 talking points. Take the words down instead." and r['nick'], f"(e) the bar holds after publishing: the nickname cannot go ({r['msg']!r})")
    r = pg.evaluate("""async ([pc, id]) => { const { d } = T, S = d.S, b = S.bills.find(x => x.id === id), team = b.position, seen = d.publicStateOf(id);
        const r = d.decidePublicChangeV7(pc, true, '', seen), row = S.publicChanges.find(x => x.id === pc);
        return { approved: !!r.approved, status: row.status, pub: b.public_position, team, teamAfter: b.position }; }""", ['pc-seed-2', B2])
    ok(r['approved'] and r['status'] == 'approved' and r['pub'] == r['team'] and r['teamAfter'] == r['team'], f"(e) approving a position sets the public position only, never the team's ({r})")
    r = pg.evaluate("""async (id) => { const { d } = T, S = d.S, r = d.sendPublicWords(id, { public_summary: 'Admin, while Kris waits.' }); return { refused: r.refused || null }; }""", A['send'])
    ok(r['refused'] == f'{KR} has a change waiting on this bill', f"(e) an admin is refused while another writer's change waits: {r['refused']!r}")
    r = pg.evaluate("""async (id) => { const { d } = T, S = d.S, b = S.bills.find(x => x.id === id), r = d.sendPublicWords(id, { public_summary: 'Admin direct publish.' });
        return { published: !!r.published, isPub: b.is_public, pubPos: b.public_position, pos: b.position, by: b.public_published_by, me: S.me.id, summary: b.public_summary }; }""", H[2])
    ok(r['published'] and r['isPub'] is True and r['pubPos'] == r['pos'] and r['by'] == r['me'] and r['summary'] == 'Admin direct publish.', "(e) an admin's own words go live at once, with the team's position as the public one")
    r = pg.evaluate("""(pc) => { const { P, d } = T, row = d.S.publicChanges.find(x => x.id === pc); return { line: P.waitingLine(row) }; }""", PC_SEND)
    ok(bool(re.match(r'^Waiting on ' + NT + ' to publish · sent ' + WHEN + '$', r['line'])), f"(g) the waiting line: {r['line']!r}")

    # (f) as Kevin: another writer is refused, and cannot take back Kris's change
    open_as(pg, 'KV')
    r = pg.evaluate(SEND, [A['send'], {'public_summary': 'Kevin, not Kris.'}])
    ok(r['refused'] == f'{KR} has a change waiting on this bill', f"(f) after the switch, another writer is refused: {r['refused']!r}")
    r = pg.evaluate("(pc) => { const r = T.d.takeBackChange(pc); return { refused: r.refused || null }; }", PC_SEND)
    ok(r['refused'] == f'Only {KR} can take this back', f"(c) only the writer takes a change back ({r['refused']!r})")
    r = pg.evaluate(SEND, [B1, {'public_summary': 'Kevin, joins his own change.'}])
    ok(r['waiting'] and not r['refused'], "(a) the writer of a waiting change may send again: it joins")

    # ---------------------------------------------------------------- part 1b (R-398): one bill's public words at #/public/<no>, on a fresh tab each
    from urllib.parse import quote
    def open_pub(p, who, no, q=''):
        p.goto(f'{BASE}/staff7.html?demo=1&as={who}#/public/{quote(no)}{q}')
        for _ in range(200):
            try:
                if p.evaluate(READY): break
            except Exception:
                pass
            p.wait_for_timeout(200)
        p.evaluate(INSTALL)
        p.wait_for_selector('#pubRoot', timeout=15000)
        p.wait_for_timeout(150)
    PICK = """() => { const { d } = T, S = d.S, kr = S.advocates.find(a => a.initials === 'KR'), num = b => b.bill_number;
      const side = b => b.tracked !== false && d.isPublicSide(b.position);
      const hidB = S.bills.filter(b => side(b) && !d.isLiveBill(b) && (S.assignments[b.id] || []).includes(kr.id) && !d.heldFor('bill', b.id));
      if (hidB.length && d.barMet(hidB[0])) hidB[0].nickname = '';   // this tab only: the first one is made to miss its bar
      const hid = hidB.filter(b => !d.barMet(b)).map(num);
      const live = S.bills.filter(b => side(b) && d.isLiveBill(b) && !d.heldFor('bill', b.id)).map(num);
      const mon = S.bills.filter(b => b.tracked !== false && b.position === 'monitor').map(num);
      const seeded = (S.publicChanges || []).filter(x => x.kind === 'bill' && x.status === 'waiting' && x.proposed_by !== kr.id).map(x => num(S.bills.find(b => b.id === x.target_id)));
      return { hid, live, mon, seeded }; }"""
    pages = []
    P1 = new_page(br); pages.append(P1); open_as(P1, 'KR'); pk2 = P1.evaluate(PICK)
    ok(len(pk2['hid']) >= 1, f"(1b) practice data: KR leads a side bill with no public words and a bar not met ({len(pk2['hid'])})")
    NO = pk2['hid'][0]
    open_pub(P1, 'KR', NO)
    ok(P1.evaluate("() => document.documentElement.dataset.mode") == 'public' and P1.locator('nav.bar').count() == 0 and P1.locator('.wl').count() == 0,
       '(1b) #/public/<no> is in public mode: no app bar, no left column')
    ok(P1.get_attribute('#pubGo', 'aria-disabled') == 'true' and 'still needed' in P1.inner_text('#pubLine'),
       f"(1b) a side bill missing its things: the button is switched off and the line says what is still needed ({P1.inner_text('#pubLine')!r})")

    def fill_bar(p, summary):
        if not p.input_value('#pNick').strip(): p.fill('#pNick', 'Test nickname')
        p.fill('#pSum', summary)
        while p.locator('.pub-pt').count() < 3:
            p.click('#pubAddPt')
            i = p.locator('.pub-pt').count() - 1
            p.fill(f'#pPt{i}', f'Talking point {i + 1} for the test.')
    fill_bar(P1, 'First test summary for the bar.')
    ok(P1.get_attribute('#pubGo', 'aria-disabled') == 'false' and P1.inner_text('#pubLine').startswith('Sending:'),
       f"(1b) filled in, the button is on and the line starts 'Sending:' ({P1.inner_text('#pubLine')!r})")
    P1.click('#pubGo'); P1.wait_for_timeout(200)
    ok(P1.is_visible('#toastUndo') and P1.inner_text('#toastMsg') == f'Sent to {NT}. The public site has not changed.',
       f"(1b) a press shows the toast at once, with Undo: {P1.inner_text('#toastMsg')!r}")
    P1.click('#toastUndo'); P1.wait_for_timeout(10600)
    ok(P1.evaluate("(no) => T.d.S.publicChanges.filter(x => x.kind === 'bill' && x.status === 'waiting' && (T.d.S.bills.find(b => b.id === x.target_id) || {}).bill_number === no).length", NO) == 0,
       '(1b) Undo inside 10 seconds: nothing is sent, no waiting change')
    before = P1.evaluate("(no) => { const b = T.d.S.bills.find(x => x.bill_number === no); return { sum: b.public_summary ?? null, pub: !!b.is_public }; }", NO)
    P1.click('#pubGo'); P1.wait_for_timeout(10600)
    got = P1.evaluate("""(no) => { const { d } = T, S = d.S, b = S.bills.find(x => x.bill_number === no), pcs = S.publicChanges.filter(x => x.kind === 'bill' && x.target_id === b.id && x.status === 'waiting');
      return { n: pcs.length, sum: pcs[0] ? pcs[0].fields.public_summary : null, pub: b.public_summary ?? null, isPub: !!b.is_public, draft: !!d.draftWords(b.id) }; }""", NO)
    ok(got['n'] == 1 and got['sum'] == 'First test summary for the bar.' and got['pub'] == before['sum'] and got['isPub'] == before['pub'] and not got['draft'],
       f"(1b) after 10 seconds: one waiting change, the public words unchanged, the draft cleared ({got})")

    # Leave public mode returns to the exact place the person came from
    P2 = new_page(br); pages.append(P2); open_as(P2, 'KR')
    P2.evaluate("() => { location.hash = '#/calendar'; }"); P2.wait_for_timeout(600)
    P2.evaluate("(no) => { location.hash = '#/public/' + encodeURIComponent(no); }", NO); P2.wait_for_selector('#pubRoot', timeout=15000)
    ok(P2.get_attribute('.pub-band .btn.quiet', 'href') == '#/calendar', '(1b) Leave public mode goes back to the page the person came from')
    P2.click('.pub-band .btn.quiet'); P2.wait_for_timeout(500)
    ok(P2.evaluate("() => location.hash") == '#/calendar' and P2.evaluate("() => document.documentElement.dataset.mode") is None and P2.locator('nav.bar').count() == 1,
       '(1b) after Leave: the plum look is off and the app bar is back')

    # arriving for the ask: the ask has the focus, the other parts are one folded line
    P3 = new_page(br); pages.append(P3); open_as(P3, 'KR'); open_pub(P3, 'KR', NO, '?ask=1')
    ok(P3.evaluate("() => document.activeElement && document.activeElement.id") == 'pAsk' and P3.is_hidden('#pubFields') and P3.is_visible('.pub-fold'),
       "(1b) arriving for the ask: focus in the ask, the other parts folded into one line")
    P3.click('#pubUnfold'); P3.wait_for_timeout(100)
    ok(P3.is_visible('#pNick'), '(1b) "Change them" unfolds the other parts')

    # a Monitor bill: the Monitor line and no talking points
    if pk2['mon']:
        P4 = new_page(br); pages.append(P4); open_as(P4, 'KR'); open_pub(P4, 'KR', pk2['mon'][0])
        ok('Monitor bills need nothing here' in P4.inner_text('#pubBarBox') and P4.locator('#pubPtsLab').count() == 0,
           '(1b) a Monitor bill: the Monitor line, and no talking points part')

    # a second writer sees the other person's waiting change, and cannot change the words
    if pk2['seeded']:
        P5 = new_page(br); pages.append(P5); open_as(P5, 'KR'); open_pub(P5, 'KR', pk2['seeded'][0])
        ok(P5.get_attribute('#pNick', 'readonly') is not None and 'has a change waiting on this bill' in P5.inner_text('#pubStatus'),
           f"(1b) another writer: '<name> has a change waiting on this bill' and read-only fields ({P5.inner_text('#pubStatus')!r})")

    # the words come down at once, and Undo puts them back
    if pk2['live']:
        P6 = new_page(br); pages.append(P6); open_as(P6, 'KR'); open_pub(P6, 'KR', pk2['live'][0])
        P6.click('#pubDown'); P6.wait_for_timeout(200)
        ok(P6.inner_text('#toastMsg') == "HIPHI's words are off the public site. Undo" and P6.evaluate("(no) => T.d.S.bills.find(x => x.bill_number === no).is_public === false", pk2['live'][0]),
           "(1b) take HIPHI's words down: at once, with the toast")
        P6.click('#toastUndo'); P6.wait_for_timeout(200)
        ok(P6.evaluate("(no) => T.d.S.bills.find(x => x.bill_number === no).is_public === true", pk2['live'][0]), '(1b) Undo puts the words back')

    # an admin's button says where the words go
    P7 = new_page(br); pages.append(P7); open_as(P7, 'NT'); open_pub(P7, 'NT', NO)
    ok(P7.inner_text('#pubGo') == 'Publish to the public site', f"(1b) as Nate the button reads 'Publish to the public site' ({P7.inner_text('#pubGo')!r})")

    # typed words survive a reload
    P8 = new_page(br); pages.append(P8); open_as(P8, 'KR'); open_pub(P8, 'KR', NO)
    P8.fill('#pSum', 'Kept across a reload.')
    P8.reload(); P8.wait_for_selector('#pubRoot', timeout=15000); P8.wait_for_timeout(150)
    ok(P8.input_value('#pSum') == 'Kept across a reload.', '(1b) typed words survive a reload')

    # layout: no sideways scroll at 1440, 1280 and 390; the preview's last line is reachable at 1280x800; the preview sits below the form at 390
    for w, h in [(1440, 900), (1280, 800), (390, 844)]:
        L = new_page(br); pages.append(L); L.set_viewport_size({'width': w, 'height': h}); open_as(L, 'KR'); open_pub(L, 'KR', NO)
        sw = L.evaluate("() => document.documentElement.scrollWidth - document.documentElement.clientWidth")
        ok(sw <= 0, f'(1b) no sideways scroll at {w}x{h} ({sw}px over)')
        if w == 1280:
            r = L.evaluate("""() => { const c = document.getElementById('pubCard'); c.scrollTop = c.scrollHeight; const last = c.lastElementChild.getBoundingClientRect(), box = c.getBoundingClientRect(), dock = document.getElementById('pubDock').getBoundingClientRect();
              return { lastBottom: last.bottom, boxBottom: box.bottom, dockTop: dock.top }; }""")
            ok(r['lastBottom'] <= r['boxBottom'] + 1 and r['boxBottom'] <= r['dockTop'] + 1, f"(1b) the preview's last line is reachable at 1280x800 and the card clears the dock ({r})")
        if w == 390:
            r = L.evaluate("() => ({ form: document.querySelector('.pub-form').getBoundingClientRect().bottom, card: document.getElementById('pubCard').getBoundingClientRect().top, go: document.getElementById('pubGo').getBoundingClientRect().width, wrap: document.querySelector('.pub-dock .pub-wrap').getBoundingClientRect().width })")
            ok(r['card'] >= r['form'] and r['go'] >= r['wrap'] - 40, f"(1b) at 390 the preview is below the form and the button takes the row ({r})")

    # ---------------------------------------------------------------- the fix round (five faults)
    # (1) words not yet public with the bar met: the button is on and the line names everything it sends, changed or not
    P9 = new_page(br); pages.append(P9); open_as(P9, 'KR')
    ready_no = P9.evaluate("""() => { const { d } = T, S = d.S, kr = S.advocates.find(a => a.initials === 'KR');
      const b = S.bills.find(x => x.tracked !== false && d.isPublicSide(x.position) && !d.isLiveBill(x) && (S.assignments[x.id] || []).includes(kr.id) && !d.heldFor('bill', x.id));
      b.nickname = 'Ready nickname'; b.public_summary = 'Ready summary.'; b.talking_points = ['One point for the test.', 'Two point for the test.', 'Three point for the test.'];
      return b.bill_number; }""")
    open_pub(P9, 'KR', ready_no)
    ok(P9.get_attribute('#pubGo', 'aria-disabled') == 'false' and P9.inner_text('#pubLine') == 'Sending: the nickname, the summary and 3 talking points. Nate approves before the public sees them.',
       f"(fix 1) words not public, bar met, nothing changed: the button is on and the line names what it sends ({P9.inner_text('#pubLine')!r})")
    # (2) public words, nothing changed, nothing waiting: the line is never blank
    P10 = new_page(br); pages.append(P10); open_as(P10, 'KR'); open_pub(P10, 'KR', pk2['live'][0])
    ok(P10.inner_text('#pubLine') == 'These words are on the public site. Change anything to send it to Nate.',
       f"(fix 2) public words, unchanged: the line says so ({P10.inner_text('#pubLine')!r})")
    # (3) every text box grows to its words: nothing clipped, no inner scrollbar, on a phone with a long point
    P11 = new_page(br); pages.append(P11); P11.set_viewport_size({'width': 390, 'height': 844}); open_as(P11, 'KR'); open_pub(P11, 'KR', NO)
    P11.fill('#pPt0', 'A long point for the test that keeps going so that it wraps over several lines on a phone. ' * 3)
    clip = P11.evaluate("() => [...document.querySelectorAll('#pubRoot textarea')].filter(t => t.scrollHeight > t.clientHeight + 1).length")
    ok(clip == 0, f"(fix 3) every text box grows to fit its words, none clips ({clip} clipped)")
    # (4) the page's bottom clears the dock: the last control scrolls clear of it, at 1440, 1280 and 390
    for w, h in [(1440, 900), (1280, 800), (390, 844)]:
        P12 = new_page(br); pages.append(P12); P12.set_viewport_size({'width': w, 'height': h}); open_as(P12, 'KR'); open_pub(P12, 'KR', NO)
        r = P12.evaluate("""() => { const dock = document.getElementById('pubDock').getBoundingClientRect(), pad = parseFloat(getComputedStyle(document.getElementById('pubRoot')).paddingBottom);
          window.scrollTo(0, document.documentElement.scrollHeight); const last = document.querySelector('.pub-form').lastElementChild.getBoundingClientRect();
          const u = document.getElementById('pUntil'); u.scrollIntoView({ block: 'center' }); const ur = u.getBoundingClientRect(), d2 = document.getElementById('pubDock').getBoundingClientRect();
          return { pad, need: dock.height + 24, lastClear: last.bottom <= dock.top + 1, untilClear: ur.bottom <= d2.top + 1 }; }""")
        ok(r['pad'] >= r['need'] - 1 and r['lastClear'] and r['untilClear'],
           f"(fix 4) at {w}x{h} the page clears the dock by its height plus 24px, and the last control and the ask date scroll clear ({r})")
    # (5) phone: the line sits above the dock, and the second row holds Save for later and See the preview
    P13 = new_page(br); pages.append(P13); P13.set_viewport_size({'width': 390, 'height': 844}); open_as(P13, 'KR'); open_pub(P13, 'KR', NO)
    r = P13.evaluate("""() => { const q = id => document.getElementById(id).getBoundingClientRect(), line = q('pubLine'), go = q('pubGo'), sec = q('pubSecond'), prev = q('pubSeePrev');
      return { lineText: document.getElementById('pubLine').innerText, lineAbove: line.bottom <= go.top + 1, secondBelow: sec.width > 0 && sec.top >= go.bottom - 1, prevSame: prev.width > 0 && Math.abs(prev.top - sec.top) < 2,
               secondText: document.getElementById('pubSecond').innerText }; }""")
    ok(r['lineText'] != '' and r['lineAbove'] and r['secondBelow'] and r['prevSame'] and r['secondText'] == 'Save for later',
       f"(fix 5) phone dock: the line above the button, then Save for later and See the preview in the second row ({r})")

    # the page stays free of errors on every new tab
    ok(all(not p.errs for p in pages), f"(1b) no page errors on the public pages ({[e for p in pages for e in p.errs][:3]})")

    # ---------------------------------------------------------------- part 2 (R-398): the admin's page for one waiting change, and Public words (#/public)
    # Each scenario is a fresh tab with the practice seeds (two waiting changes: pc-seed-1 a words change, pc-seed-2 a position change).
    def open_at(p, who, h):
        p.goto(f'{BASE}/staff7.html?demo=1&as={who}{h}')
        for _ in range(200):
            try:
                if p.evaluate(READY): break
            except Exception:
                pass
            p.wait_for_timeout(200)
        p.evaluate(INSTALL)
        p.wait_for_selector('#pubRoot', timeout=15000)
        p.wait_for_timeout(200)
    def go_hash(p, h):
        p.evaluate("(h) => { location.hash = h; }", h); p.wait_for_timeout(500)
    CHG_TEXT = "() => { const b = document.querySelector('.pl-page, .pc-form'); return b ? b.innerText : ''; }"
    SEEDS = """() => { const S = T.d.S; return { w: S.publicChanges.find(x => x.id === 'pc-seed-1'), p: S.publicChanges.find(x => x.id === 'pc-seed-2') }; }"""

    # (p1) as Nate, Public words lists the two waiting changes first, each row a link to its page
    P20 = new_page(br); pages.append(P20); open_at(P20, 'NT', '#/public')
    secs = P20.evaluate("""() => [...document.querySelectorAll('.pl-sec')].map(s => [s.querySelector('h2').textContent, [...s.querySelectorAll('a.pl-link')].map(a => a.getAttribute('href'))])""")
    ok(secs and secs[0][0] == 'Waiting for you' and sorted(secs[0][1]) == ['#/public/change/pc-seed-1', '#/public/change/pc-seed-2'],
       f"(p1) as Nate, #/public lists the two waiting changes first ({secs})")
    ok(P20.evaluate("() => document.documentElement.dataset.mode") == 'public' and P20.locator('nav.bar').count() == 0 and P20.locator('.wl').count() == 0,
       '(p1) #/public is in public mode: plum, no app bar, no left column')

    # (p2) one change: the two cards, the words marked (only the changed words), and the preview tagged "After you approve"
    P21 = new_page(br); pages.append(P21); open_at(P21, 'NT', '#/public/change/pc-seed-1')
    r = P21.evaluate("""() => { const ins = [...document.querySelectorAll('.pc-card.is-new .pc-ins')].map(e => e.textContent).join(''), del = [...document.querySelectorAll('.pc-card.is-now .pc-del')].map(e => e.textContent).join('');
      const cards = [...document.querySelectorAll('.pc-card-h')].map(e => e.textContent), tag = document.querySelector('.pub-card .pv-tag');
      return { ins, del, cards, tag: tag ? tag.textContent : null, mode: document.documentElement.dataset.mode, hasTwoCards: document.querySelectorAll('.pc-cards').length }; }""")
    ok(r['ins'].strip() == 'Ask your legislators to take a stand.' and r['del'] == '' and "On the public site now" in r['cards'] and "Kevin’s change" in r['cards'],
       f"(p2) the change's new words are underlined, the old words are not struck (only the added sentence) ({r['ins']!r} / {r['del']!r})")
    ok(r['tag'] == 'After you approve' and r['mode'] == 'public' and r['hasTwoCards'] >= 1, f"(p2) the preview is tagged 'After you approve' and the window is plum ({r['tag']!r})")

    # (p3) Approve: the toast at once, the page moves to the next waiting change; after 10 seconds the public words are the change's
    P22 = new_page(br); pages.append(P22); open_at(P22, 'NT', '#/public/change/pc-seed-1')
    sd = P22.evaluate(SEEDS)
    P22.click('#pcGo'); P22.wait_for_timeout(300)
    ok(P22.inner_text('#toastMsg') == 'Approved. On the public site in 10 seconds.' and P22.is_visible('#toastUndo'),
       f"(p3) Approve shows the toast at once, with Undo ({P22.inner_text('#toastMsg')!r})")
    ok(P22.evaluate("() => location.hash") == '#/public/change/pc-seed-2', f"(p3) Approve moves to the next waiting change ({P22.evaluate('() => location.hash')})")
    ok(P22.evaluate("(id) => T.d.S.publicChanges.find(x => x.id === id).status", 'pc-seed-1') == 'waiting', '(p3) the decision waits its 10 seconds')
    P22.wait_for_timeout(10600)
    got = P22.evaluate("""(id) => { const { d } = T, S = d.S, pc = S.publicChanges.find(x => x.id === id), b = S.bills.find(x => x.id === pc.target_id);
      return { status: pc.status, sum: b.public_summary, want: pc.fields.public_summary, decided: pc.decided_by === S.me.id }; }""", 'pc-seed-1')
    ok(got['status'] == 'approved' and got['sum'] == got['want'] and got['decided'], f"(p3) after 10 seconds the bill's public words are the change's ({got['status']})")

    # (p4) Undo inside the 10 seconds: the change stays waiting, nothing changed, and Undo returns to the change
    P23 = new_page(br); pages.append(P23); open_at(P23, 'NT', '#/public/change/pc-seed-2')
    before = P23.evaluate("(id) => { const { d } = T, S = d.S, pc = S.publicChanges.find(x => x.id === id), b = S.bills.find(x => x.id === pc.target_id); return { pos: b.position, pub: b.public_position ?? null }; }", 'pc-seed-2')
    P23.click('#pcGo'); P23.wait_for_timeout(300)
    P23.click('#toastUndo'); P23.wait_for_timeout(400)
    ok(P23.evaluate("() => location.hash") == '#/public/change/pc-seed-2' and P23.locator('#pcGo').count() == 1,
       f"(p4) Undo returns to the change ({P23.evaluate('() => location.hash')})")
    P23.wait_for_timeout(10400)
    got = P23.evaluate("""(id) => { const { d } = T, S = d.S, pc = S.publicChanges.find(x => x.id === id), b = S.bills.find(x => x.id === pc.target_id);
      return { status: pc.status, pub: b.public_position ?? null, pos: b.position }; }""", 'pc-seed-2')
    ok(got['status'] == 'waiting' and got['pub'] == before['pub'], f"(p4) Undo inside 10 seconds: the change still waits and the public position is unchanged ({got})")

    # (p5) Send back with a note: the note opens in place; as Kevin the note shows in Your changes
    P24 = new_page(br); pages.append(P24); open_at(P24, 'NT', '#/public/change/pc-seed-1')
    P24.click('#pcSendOpen'); P24.wait_for_timeout(200)
    ok(P24.is_visible('#pcNote') and 'Kevin hears it with your note. The public keeps the earlier words.' in P24.inner_text('.pc-note'),
       "(p5) Send back opens the note in place, with the line 'Kevin hears it with your note'")
    P24.fill('#pcNote', 'Keep it to one sentence.')
    P24.click('#pcSendBack'); P24.wait_for_timeout(300)
    ok(P24.inner_text('#toastMsg') == 'Sent back.', f"(p5) Send back shows the toast at once ({P24.inner_text('#toastMsg')!r})")
    P24.wait_for_timeout(10400)
    open_at(P24, 'KV', '#/public')
    rowsKV = P24.evaluate("() => [...document.querySelectorAll('.pl-sec')].map(s => s.innerText).join(' | ')")
    ok('Sent back by Nate: Keep it to one sentence.' in rowsKV, f"(p5) as Kevin, Your changes shows 'Sent back by Nate: <note>' ({rowsKV[-160:]!r})")

    # (p6) a stale approve is refused in plain words and changes nothing; the page is drawn again with what the public site has now
    P25 = new_page(br); pages.append(P25); open_at(P25, 'NT', '#/public/change/pc-seed-1')
    P25.evaluate("""() => { const { d } = T, S = d.S, pc = S.publicChanges.find(x => x.id === 'pc-seed-1'), b = S.bills.find(x => x.id === pc.target_id); b.public_summary = 'Changed by someone else while the page was open.'; }""")
    P25.click('#pcGo'); P25.wait_for_timeout(300)
    ok('This changed since you opened it' in P25.inner_text('#pcStatus') and P25.evaluate("() => location.hash") == '#/public/change/pc-seed-1',
       f"(p6) a stale approve says 'This changed since you opened it' and stays ({P25.inner_text('#pcStatus')[:60]!r})")
    P25.wait_for_timeout(10400)
    got = P25.evaluate("""() => { const { d } = T, S = d.S, pc = S.publicChanges.find(x => x.id === 'pc-seed-1'), b = S.bills.find(x => x.id === pc.target_id); return { status: pc.status, sum: b.public_summary }; }""")
    ok(got['status'] == 'waiting' and got['sum'] == 'Changed by someone else while the page was open.', f"(p6) nothing is published by the stale approve ({got})")

    # (p7) a decided change's address says 'Already decided by'
    P26 = new_page(br); pages.append(P26); open_at(P26, 'NT', '#/public')
    P26.evaluate("""() => { const S = T.d.S, pc = S.publicChanges.find(x => x.id === 'pc-seed-1'); pc.status = 'approved'; pc.decided_by = S.me.id; }""")
    go_hash(P26, '#/public/change/pc-seed-1')
    ok(f'Already decided by {NT}' in P26.inner_text('#pubRoot') and P26.locator('#pcGo').count() == 0,
       f"(p7) a decided change says 'Already decided by {NT}' and offers no button")

    # (p8) a non-admin who opens the address is told that only an admin decides; a lead's list shows what they write for
    P27 = new_page(br); pages.append(P27); open_at(P27, 'KR', '#/public/change/pc-seed-1')
    ok('Only an admin decides a public change.' in P27.inner_text('#pubRoot') and P27.locator('#pcGo').count() == 0,
       "(p8) as Kris, the change page says only an admin decides, with no button")
    P28 = new_page(br); pages.append(P28); open_at(P28, 'KR', '#/public')
    rowsKR = P28.evaluate("""() => { const s = [...document.querySelectorAll('.pl-sec')].find(x => x.querySelector('h2').textContent === 'Bills to write'); return s ? s.querySelectorAll('li.pl-row').length : 0; }""")
    cnt = P28.evaluate("async () => { const L = await import('/staff7/public_list.js'); return L.counts(T.d.S.me).toWrite; }")
    ok(rowsKR >= 1 and rowsKR == cnt, f"(p8) as Kris, Bills to write has one row per bill counts() gives ({rowsKR} rows, counts {cnt})")
    ok(P28.evaluate("() => document.documentElement.dataset.mode") == 'public', '(p8) as Kris, #/public is in public mode')

    # (p9) Take back from Your changes: the row says Taken back, and the words are kept for the writer
    P29 = new_page(br); pages.append(P29); open_at(P29, 'KR', '#/public')
    bidKR = P29.evaluate("""() => { const { d } = T, S = d.S, kr = S.advocates.find(a => a.initials === 'KR');
      const b = S.bills.find(x => x.tracked !== false && d.isPublicSide(x.position) && !d.isLiveBill(x) && (S.assignments[x.id] || []).includes(kr.id) && !d.heldFor('bill', x.id));
      const r = d.sendPublicWords(b.id, { nickname: 'Take back test', public_summary: 'Take back test summary.', talking_points: ['One point.', 'Two point.', 'Three point.'], public_action: '', public_action_until: '' });
      return r.waiting ? b.id : null; }""")
    P29.evaluate("() => window.__staff7Render({})"); P29.wait_for_timeout(300)   # redraw the list: the same address does not
    ok(bidKR is not None and 'Waiting on Nate to publish' in P29.inner_text('#pubRoot'), "(p9) as Kris, a sent change shows 'Waiting on Nate to publish' in Your changes")
    P29.click('button.pl-take'); P29.wait_for_timeout(400)
    ok('Taken back' in P29.inner_text('#pubRoot') and P29.evaluate("(id) => T.d.S.bills.find(x => x.id === id).is_public === false", bidKR),
       "(p9) Take back: the row says Taken back, and the public site is unchanged")
    ok(P29.evaluate("(id) => !!T.d.draftWords(id)", bidKR), "(p9) the words it held are kept for the writer")

    # (p10) an admin's own unpublished position: 'Publish a public change', and its one button
    P30 = new_page(br); pages.append(P30); open_at(P30, 'NT', '#/public')
    own = P30.evaluate("""() => { const { d } = T, S = d.S, b = S.bills.find(x => x.tracked !== false && d.isLiveBill(x) && d.isPublicSide(x.public_position) && d.barMet(x) && !d.heldFor('bill', x.id) && !d.waitingPosition(x.id));
      b.position = b.public_position === 'support' ? 'oppose' : 'support'; return b.bill_number; }""")
    go_hash(P30, '#/public/change/position-' + own.replace(' ', '%20'))
    ok(P30.inner_text('h1') == 'Publish a public change' and P30.inner_text('#pcGo') == 'Publish to the public site' and P30.locator('#pcSendOpen').count() == 0,
       f"(p10) an admin's own unpublished position: 'Publish a public change' and only 'Publish to the public site' ({P30.inner_text('h1')!r})")

    # (p11) plum at both routes; no sideways scroll at 1440, 1280 and 390; no page errors; nothing leaves the page but fonts
    ext = []
    PX = {}
    for w, h in [(1440, 900), (1280, 800), (390, 844)]:
        for route in ['#/public', '#/public/change/pc-seed-1']:
            L = new_page(br); pages.append(L); L.set_viewport_size({'width': w, 'height': h})
            L.route(lambda u: '127.0.0.1' not in u and 'localhost' not in u, lambda rt: (ext.append(rt.request.url), rt.continue_() if 'fonts.g' in rt.request.url else rt.abort()))
            open_at(L, 'NT', route)
            sw = L.evaluate("() => document.documentElement.scrollWidth - document.documentElement.clientWidth")
            ok(sw <= 0 and L.evaluate("() => document.documentElement.dataset.mode") == 'public', f"(p11) {route} at {w}x{h}: plum and no sideways scroll ({sw}px over)")
            PX[(w, route)] = L
    ok(all('fonts.g' in u for u in ext), f"(p11) nothing leaves the page but fonts ({sorted(set(ext))[:4]})")
    ok(all(not p.errs for p in pages), f"(p11) no page errors on the part 2 tabs ({[e for p in pages for e in p.errs][:3]})")

    # ---------------------------------------------------------------- (h) no page errors
    ok(not pg.errs, f"(h) no page errors ({pg.errs[:3]})")
    br.close()
    passed = sum(res); failed = len(res) - passed
    print(f'{passed} passed, {failed} failed', flush=True)
    sys.exit(0 if failed == 0 else 1)
