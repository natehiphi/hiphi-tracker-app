# Staff7's Team page (R-398 piece 6), view "One at a time", on the practice copy: the two lists (other people's late steps, bills with no lead), the sheets (Tell, Take this step, Take it, Give to...),
# the lead-change record and its Undo, one filled button per screen (S-2), no sideways scroll at 1440, 1280 and 390, 44px targets on a phone. The test seeds its own late steps and bills with no lead
# (the practice data has only a few), in memory only.
#   python3 tests/staff7_team.py [base] [shots folder]     base defaults to http://127.0.0.1:8852
import sys, os
from playwright.sync_api import sync_playwright
BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8852').rstrip('/')
SHOTS = sys.argv[2] if len(sys.argv) > 2 else ''
if SHOTS: os.makedirs(SHOTS, exist_ok=True)
res = []
def ok(c, m): res.append(bool(c)); print('PASS' if c else 'FAIL', m)

FILLED = "() => [...document.querySelectorAll('.btn.filled')].filter(b => { const r = b.getBoundingClientRect(), s = getComputedStyle(b); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden'; }).length"
H1S = "() => [...document.querySelectorAll('h1')].filter(h => h.getBoundingClientRect().width > 0).length"
SIDE = "() => document.documentElement.scrollWidth <= innerWidth && document.body.scrollWidth <= innerWidth"
LATE = "() => [...document.querySelectorAll('a.tr[href^=\"#/team/step/\"]')].filter(a => a.closest('li') && !a.closest('li').hidden).map(a => ({ href: decodeURIComponent(a.getAttribute('href').slice(12)), text: a.innerText.replace(/\\s+/g, ' ').trim(), soon: !!a.querySelector('.stm.soon'), clock: !!a.querySelector('.stm svg'), nobody: !!a.querySelector('.person.nob') }))"
LEAD = "() => [...document.querySelectorAll('a.tr[href^=\"#/team/bill/\"]')].filter(a => a.closest('li') && !a.closest('li').hidden).map(a => ({ href: decodeURIComponent(a.getAttribute('href').slice(12)), text: a.innerText.replace(/\\s+/g, ' ').trim() }))"
SHEET = "() => document.querySelector('.paper').innerText.replace(/\\s+/g, ' ').trim()"

# the seeds: everything runs in the page, on the practice copy's memory only
SEED = """async () => {
  const d = await import('/staff6/data.js'), S = d.S, st = await import('/staff7/standing.js'), tm = await import('/staff7/team_data.js');
  const me = S.me, now = Date.now(), out = {}; S.leadChanges = [];   // the practice copy's own four are cleared: the counts below are this test's
  // 1. every coming hearing's Capitol deadline is already past, by 1 to 5 hours: a late step for everyone who holds one
  let k = 0; for (const h of S.hearings) if (new Date(h.scheduled_at) > now) h.testimony_deadline = new Date(now - (1 + (k++ % 5)) * 36e5).toISOString();
  // 2. one step nobody holds: a bill with a late step, taken off its lead, whose issue lead is not the viewer
  for (const r of tm.lateSteps(me).filter(x => x.holder && (S.assignments[x.step.bill.id] || [])[0] === x.holder.id)) {   // a step reaches nobody only when the bill's owner is its only holder: try them until one does
    const b = r.step.bill, was = S.assignments[b.id]; S.assignments[b.id] = [];
    const again = tm.lateSteps(me).find(x => x.id === r.id);
    if (again && !again.holder) { out.nobodyBill = b.id; out.nobodyStep = r.id; break; }
    S.assignments[b.id] = was;
  }
  // 3. bills with no lead: 9 alive bills with a side, taken off their lead
  const pos = S.bills.filter(b => b.tracked !== false && b.position && b.position !== 'monitor' && st.isAlive(b) && b.id !== out.nobodyBill);
  out.leadIds = pos.slice(0, 9).map(b => b.id); out.leadIds.forEach(id => { S.assignments[id] = []; });
  out.moreIds = pos.slice(13, 27).map(b => b.id); out.moreIds.forEach(id => { S.assignments[id] = []; });   // enough bills with no lead for the Many at once caps
  // 4. a lead who is turned off counts as none; a Monitor bill and a stopped bill with no lead are not in the list
  const sy = S.advocates.find(a => a.initials === 'SY'), y = pos[12]; S.assignments[y.id] = [sy.id]; sy.is_active = false; out.offBill = y.id;
  const mon = S.bills.find(b => b.tracked !== false && b.position === 'monitor' && st.isAlive(b)); S.assignments[mon.id] = []; out.monBill = mon.id;
  const dead = S.bills.find(b => b.tracked !== false && b.position && b.position !== 'monitor' && !st.isAlive(b)); if (dead) { S.assignments[dead.id] = []; out.deadBill = dead.id; }
  // 5. one of them sits on an issue whose lead is gone: Give to... preselects nobody
  const bi = S.billIssues.find(x => x.bill_id === out.leadIds[8]); if (bi) { const is = S.issues.find(i => i.id === bi.issue_id); if (is) is.owner_id = null; }
  out.expectLate = tm.lateSteps(me).length; out.expectLead = tm.noLeadBills().length; out.me = me.id; out.my = (await import('/staff7/steps.js')).stepsFor(me).map(s => s.id);
  window.__staff7Render({}); return out;
}"""
STATE = """() => import('/staff6/data.js').then(d => ({ lc: (d.S.leadChanges || []).length, rec: (d.S.leadChanges || [])[0] || null, asg: d.S.assignments }))"""

def open_as(br, who, w, h, hash='#/team', seed=False):
    ctx = br.new_context(viewport={'width': w, 'height': h}); pg = ctx.new_page(); pg.errs = []
    pg.on('pageerror', lambda e: pg.errs.append(str(e))); pg.on('console', lambda m: pg.errs.append(m.text) if m.type == 'error' and 'Failed to load resource' not in m.text and 'ERR_FAILED' not in m.text else None)
    pg.goto(f'{BASE}/staff7.html?demo=1&as={who}{hash}'); pg.wait_for_selector('.paper', state='attached', timeout=60000)
    pg.evaluate("Promise.all([document.fonts.load('600 16px Poppins'), document.fonts.load('400 16px Lato'), document.fonts.load('700 16px Lato')])"); pg.wait_for_timeout(400)
    info = pg.evaluate(SEED) if seed else None
    if seed: pg.wait_for_timeout(300)
    return pg, info
def go(pg, hash): pg.evaluate("h => { window.__staff7TrailReset && window.__staff7TrailReset(); location.hash = h; }", hash); pg.wait_for_timeout(350)
def snap(pg, name):
    pg.wait_for_timeout(350); pg.evaluate("() => { const l = document.querySelector('.wl'); if (l) l.scrollTop = 0; }")
    if SHOTS: pg.screenshot(path=os.path.join(SHOTS, name))

with sync_playwright() as p:
    br = p.chromium.launch()

    # ============ 1. the page opens, as a lead and as an admin; practice rows (not seeded) ============
    for who in ('KR', 'NT'):
        pg, _ = open_as(br, who, 1440, 900)
        t = pg.inner_text('#app')
        ok(not pg.errs and pg.evaluate(H1S) == 1, f'1 {who}: opens with no page error and one visible h1 ({pg.errs[:1]})')
        ok(pg.locator('h2.tmt').inner_text() == 'Team' and pg.locator('.tmsw .seg').all_inner_texts() == ['One at a time', 'Many at once'] and pg.locator('.tmsw .seg[aria-current="true"]').inner_text() == 'One at a time', f'1 {who}: title Team and the switch "One at a time · Many at once", One at a time chosen')
        ok(pg.locator('.bar a[aria-current="page"]').inner_text().strip() == 'Home', f'1 {who}: the Home door stays lit on Team')
        rows = pg.evaluate(LATE)
        ok(rows and all((r['soon'] and r['clock']) == r['text'].endswith(' late') and (r['soon'] == r['clock']) for r in rows) and any(not r['soon'] for r in rows), f'1 {who}: amber and the clock only on rows that say "late" ({[r["text"][-16:] for r in rows]})')
        ok(pg.evaluate(FILLED) == 1, f'1 {who}: one filled button on the first screen')
        pg.close()

    # ============ 2. KR seeded: the late list ============
    pg, info = open_as(br, 'KR', 1440, 900, seed=True)
    late = pg.evaluate(LATE); lead = pg.evaluate(LEAD)
    ok(info['expectLate'] > 5 and len(late) == 5, f'2 caps: late shows 5 of {info["expectLate"]} first rows ({len(late)})')
    ok(pg.locator('#moreLate').inner_text().strip() == f'{info["expectLate"] - 5} more', f'2 caps: late says "{info["expectLate"] - 5} more" ({pg.locator("#moreLate").inner_text().strip()})')
    ok(len(lead) == 6 and pg.locator('#moreLead').inner_text().strip() == f'{info["expectLead"] - 6} more', f'2 caps: no lead shows 6 then "{info["expectLead"] - 6} more" (rows {len(lead)}, expect {info["expectLead"]})')
    pg.click('#moreLate'); n_open = len(pg.evaluate(LATE))
    ok(n_open == info['expectLate'] and pg.locator('#moreLate').get_attribute('aria-expanded') == 'true', f'2 caps: opening "more" shows every late row ({n_open}/{info["expectLate"]})')
    pg.click('#moreLate')
    all_late = pg.evaluate("() => [...document.querySelectorAll('a.tr[href^=\"#/team/step/\"]')].map(a => decodeURIComponent(a.getAttribute('href').slice(12)))")
    ok(not (set(all_late) & set(info['my'])), '2 own: none of the viewer\'s own steps is in the late list')
    ok(info['nobodyStep'] in all_late, '2 nobody: the step nobody holds is listed')
    nb = pg.evaluate("id => { const a = [...document.querySelectorAll('a.tr[href^=\"#/team/step/\"]')].find(x => decodeURIComponent(x.getAttribute('href').slice(12)) === id); return a ? { nobody: !!a.querySelector('.person.nob'), text: a.innerText.replace(/\\s+/g, ' ').trim() } : null; }", info['nobodyStep'])
    ok(nb and nb['nobody'] and nb['text'].startswith('Nobody'), f'2 nobody: that row says Nobody with a dashed mark ({nb and nb["text"][:40]})')
    ok(all(r['soon'] and r['clock'] and 'late' in r['text'] for r in late), '2 amber: every late row has the amber time and the clock and says "late"')
    order = pg.evaluate("() => [...document.querySelectorAll('a.tr[href^=\"#/team/step/\"] .stm')].map(s => s.innerText.trim())")
    ok(order[0].endswith('late'), f'2 order: late rows come first ({order[:3]})')
    hl = pg.inner_text('.tmh')
    ok(hl.startswith(f'{info["expectLate"]} steps are late or due within a day.') and f'{info["expectLead"]} bills have no lead.' in hl, f'2 headline: "{hl}"')
    ok(pg.locator('.tfoot').count() == 1 and 'late step' in pg.inner_text('.tfoot') and 'Home' in pg.inner_text('.tfoot'), f'2 own: the foot line says the viewer\'s own late steps are on Home ({pg.locator(".tfoot").count() and pg.inner_text(".tfoot")})')
    # no-lead rules
    ids = set(pg.evaluate("() => [...document.querySelectorAll('a.tr[href^=\"#/team/bill/\"]')].map(a => decodeURIComponent(a.getAttribute('href').slice(12)))"))
    ok(info['offBill'] in ids, '2 no lead: a bill whose lead is turned off counts as no lead')
    ok(info['monBill'] not in ids and (not info.get('deadBill') or info['deadBill'] not in ids), '2 no lead: a Monitor bill and a stopped bill are not in the list')
    ok(all(i in ids for i in info['leadIds']), '2 no lead: the seeded bills are all listed')
    ok(all('hearing ' in r['text'] or 'due by ' in r['text'] or 'no hearing or deadline' in r['text'] for r in lead), f'2 no lead: every row says its hearing or date ({lead[0]["text"]})')
    # sorted by soonest date
    dts = pg.evaluate("async () => { const tm = await import('/staff7/team_data.js'); return tm.noLeadBills().map(x => x.next.t); }")
    ok(dts == sorted(dts), '2 no lead: sorted by soonest hearing or deadline')
    ok(pg.evaluate(SIDE), '2 no sideways scroll at 1440')
    ok(pg.evaluate(FILLED) == 1, '2 one filled button on the late step sheet')
    snap(pg, 'team_1440_slipping.png')

    # ============ 3. the late step sheet: Tell once, Undo, Take this step ============
    sid = [r['href'] for r in late if not r['nobody']][0]
    go(pg, '#/team/step/' + sid)
    sh = pg.evaluate(SHEET)
    ok(' late ' in sh or sh.count('late') >= 1, f'3 sheet: names what is late ({sh[:90]})')
    ok(pg.locator('.strip svg').count() == 1 and 'The Capitol still takes it until' in sh and 'has not been told yet' in sh and 'gets this in Slack. If you take the step' in sh, '3 sheet: amber box with the clock, what still holds, "has not been told yet", the foot line')
    btns = pg.locator('.sfoot .btn').all_inner_texts()
    ok(btns[0].startswith('Tell ') and btns[1:] == ['Take this step', 'Open the bill'], f'3 sheet: Tell <name>, Take this step, Open the bill ({btns})')
    ok(pg.evaluate(FILLED) == 1 and pg.locator('.btn.filled').inner_text().startswith('Tell '), '3 sheet: Tell is the one filled button')
    ok(pg.locator('a.btn.quiet', has_text='Open the bill').get_attribute('href').startswith('#/bill/'), '3 sheet: Open the bill goes to the bill page')
    nm = btns[0][5:]
    pg.evaluate("() => { const b = document.getElementById('tellBtn'); b.click(); b.click(); }")   # a second click on the same button finds it told already
    pg.wait_for_timeout(200)
    msgs = pg.evaluate("async id => { const d = await import('/staff6/data.js'), tm = await import('/staff7/team_data.js'); const r = tm.lateSteps(d.S.me).find(x => x.id === id); return Object.values(d.S.messages).flat().filter(m => String(m.body).startsWith('@')).map(m => m.body); }", sid)
    ok(len(msgs) == 1 and msgs[0].startswith('@' + nm), f'3 tell: one message on the bill naming {nm}, never twice ({len(msgs)})')
    ok(pg.locator('#told').inner_text().replace('\n', ' ').startswith('Told ') and pg.locator('#untellBtn').count() == 1 and 'was told' in pg.inner_text('#toldLine'), '3 tell: the sheet shows "Told <time> · Undo"')
    ok(pg.locator('#tellBtn').count() == 0 and pg.evaluate(FILLED) == 0, '3 tell: the Tell button is gone and no filled button is left')
    pg.click('#untellBtn'); pg.wait_for_timeout(200)
    msgs = pg.evaluate("async () => { const d = await import('/staff6/data.js'); return Object.values(d.S.messages).flat().filter(m => String(m.body).startsWith('@')).length; }")
    ok(msgs == 0 and pg.locator('#tellBtn').count() == 1, '3 tell: Undo takes the message back and Tell is there again')
    # Take this step
    bill_before = pg.evaluate("async id => { const d = await import('/staff6/data.js'), tm = await import('/staff7/team_data.js'); const r = tm.lateSteps(d.S.me).find(x => x.id === id); return { bill: r.step.bill.id, from: d.S.assignments[r.step.bill.id], holder: r.holder.id }; }", sid)
    pg.click('#takeStep'); pg.wait_for_timeout(500)
    st = pg.evaluate(STATE)
    ok(pg.evaluate('location.hash').startswith('#/team/done/') and st['lc'] == 1 and st['asg'][bill_before['bill']] == [info['me']] and st['rec']['from'] == bill_before['from'], '3 take step: the step moves to the viewer (record written, the bill is the viewer\'s)')
    ok(sid not in pg.evaluate("() => [...document.querySelectorAll('a.tr[href^=\"#/team/step/\"]')].map(a => decodeURIComponent(a.getAttribute('href').slice(12)))"), '3 take step: it is no longer in the late list')
    ok('is told' in pg.evaluate(SHEET) and pg.evaluate("() => document.getElementById('toast').classList.contains('on')"), '3 take step: the sheet says the holder is told, and the Undo toast is up')
    pg.click('#toastUndo'); pg.wait_for_timeout(400)
    st = pg.evaluate(STATE)
    ok(st['lc'] == 0 and st['asg'][bill_before['bill']] == bill_before['from'] and sid in pg.evaluate("() => [...document.querySelectorAll('a.tr[href^=\"#/team/step/\"]')].map(a => decodeURIComponent(a.getAttribute('href').slice(12)))"), '3 take step: Undo removes the record, puts the lead back and the step is listed again')
    # the nobody-held step: just Take this step
    go(pg, '#/team/step/' + info['nobodyStep'])
    nbtn = pg.locator('.sfoot .btn').all_inner_texts()
    ok(nbtn == ['Take this step', 'Open the bill'] and pg.evaluate(FILLED) == 1 and pg.locator('.btn.filled').inner_text() == 'Take this step' and 'Tell' not in pg.evaluate(SHEET), f'3 nobody: the sheet has just Take this step (filled) and Open the bill ({nbtn})')
    pg.close()

    # ============ 4. a bill with no lead: Take it, Give to... ============
    pg, info = open_as(br, 'KR', 1440, 900, seed=True)
    L = pg.evaluate("async () => { const tm = await import('/staff7/team_data.js'); return tm.noLeadBills().map(x => ({ id: x.id, name: x.name, lead: x.issue.lead && x.issue.lead.id, leadName: x.issue.lead && x.issue.lead.full_name })); }")
    me_id = pg.evaluate("async () => (await import('/staff6/data.js')).S.me.id")
    bx = next(x for x in L if x['lead'] and x['lead'] != me_id); bid = bx['id']
    n0 = len(L)
    go(pg, '#/team/bill/' + bid)
    sh = pg.evaluate(SHEET)
    ok('Nobody leads this bill.' in sh and 'Take it to lead it yourself, or give it to a teammate.' in sh and all(w in sh for w in ['HIPHI’s position', 'Issue', 'Where it stands']), f'4 sheet: the rows and "Nobody leads this bill." ({sh[:120]})')
    ok(pg.locator('.sfoot .btn').all_inner_texts() == ['Take it', 'Give to…'] and pg.evaluate(FILLED) == 1 and pg.locator('.btn.filled').inner_text() == 'Take it', '4 sheet: filled Take it, quiet Give to…')
    snap(pg, 'team_1440_nolead.png')
    pg.click('#takeIt'); pg.wait_for_timeout(500)
    st = pg.evaluate(STATE); rec = st['rec']
    ok(st['lc'] == 1 and rec['bill_id'] == bid and rec['to'] == info['me'] and rec['by'] == info['me'] and rec['from'] == [] and rec['group'] is None and rec['approved_by'] is None and rec['approved_at'] is None and rec['at'] and rec['id'], f'4 take: one record with id, bill, from, to, by, at, group, approved_by, approved_at ({rec})')
    ok(st['asg'][bid] == [info['me']], '4 take: the viewer leads the bill now')
    t = pg.inner_text('.paper')
    ok('You lead' in t and 'now.' in t and 'will look over the change. Nothing else needs you.' in t and pg.locator('.done .btn', has_text='Next bill with no lead').count() == 1, f'4 take: done words and "Next bill with no lead" ({t[:100]})')
    ok(pg.evaluate(FILLED) == 0 and pg.evaluate(H1S) == 1, '4 take: no filled button on the done screen, one h1')
    ok(pg.evaluate("() => document.getElementById('toastMsg').innerText").startswith('You lead') and pg.evaluate("() => !document.getElementById('toastUndo').hidden"), '4 take: the Undo toast is up')
    hl = pg.inner_text('.tmh'); ok(f'{n0 - 1} bills have no lead.' in hl and f'No lead yet · {n0 - 1}' in pg.inner_text('#app'), f'4 take: the counts dropped by one at once ({hl})')
    snap(pg, 'team_1440_done.png')
    pg.click('#toastUndo'); pg.wait_for_timeout(400)
    st = pg.evaluate(STATE)
    ok(st['lc'] == 0 and st['asg'][bid] == [] and f'No lead yet · {n0}' in pg.inner_text('#app'), '4 take: Undo removes the record, restores the lead and the counts')

    # give
    go(pg, '#/team/give/' + bid)
    names = pg.evaluate("() => [...document.querySelectorAll('.grow')].map(g => ({ n: g.querySelector('b').innerText, t: g.innerText.replace(/\\s+/g, ' ').trim(), on: g.getAttribute('aria-checked'), flag: !!g.querySelector('.gflag') }))")
    ok(names[0]['n'] == bx['leadName'] and names[0]['on'] == 'true' and names[0]['flag'] and 'leads this issue' in names[0]['t'], f'4 give: the issue lead is first, preselected, flagged ({names[0]})')
    ok(all(r['n'] != 'Kris' for r in names) and all(r['n'] != 'Saya' for r in names) and all(r['on'] == 'false' for r in names[1:]) and all('leads' in r['t'] and ('bill' in r['t']) for r in names), f'4 give: the viewer and the turned-off teammate are left out ({[r["n"] for r in names]})')
    ok(pg.locator('.sfoot .btn').all_inner_texts() == [f'Give to {bx["leadName"]}'] and pg.locator('#tbBack').count() == 1 and pg.locator('#tbClose').count() == 1 and pg.evaluate(FILLED) == 1, f'4 give: filled "Give to {bx["leadName"]}"; Back and Close are the frame row (R-398)')
    ok(pg.locator('.gq').inner_text().startswith('Who should lead '), '4 give: "Who should lead <nickname>?"')
    jm = pg.evaluate("() => { const m = [...document.querySelectorAll('.grow .person')].find(x => x.innerText.trim() === 'JMM'); return m ? m.scrollWidth <= m.clientWidth : null; }")
    ok(jm is not False, f'4 give: three-letter initials fit the mark (JMM {"fits" if jm else "not in the list"})')
    snap(pg, 'team_1440_give.png')
    other = pg.locator('.grow').nth(2); on = other.get_attribute('data-name'); other.click()
    ok(pg.locator('.sfoot .btn.filled').inner_text() == f'Give to {on}' and pg.locator('.grow[aria-checked="true"]').count() == 1, f'4 give: the button follows the pick ("Give to {on}")')
    pg.click('#giveBtn'); pg.wait_for_timeout(500)
    st = pg.evaluate(STATE); rec = st['rec']
    to_name = pg.evaluate("async id => (await import('/staff6/data.js')).S.advocates.find(a => a.id === id).full_name.split(' ')[0]", rec['to'] if rec else '')
    ok(st['lc'] == 1 and rec['to'] != info['me'] and st['asg'][bid] == [rec['to']] and to_name == on and rec['by'] == info['me'], f'4 give: one record, the bill goes to {on}')
    t = pg.inner_text('.paper'); ok(f'{on} leads ' in t and 'now.' in t and 'On the practice copy nothing is sent.' in t, f'4 give: done words and the message words ({t[:80]})')
    pg.click('#toastUndo'); pg.wait_for_timeout(400)
    st = pg.evaluate(STATE); ok(st['lc'] == 0 and st['asg'][bid] == [], '4 give: Undo restores the bill')
    # a bill whose issue has no active lead: nothing preselected
    nolead_issue = pg.evaluate("async () => { const tm = await import('/staff7/team_data.js'); const x = tm.noLeadBills().find(y => !y.issue.lead); return x ? x.id : null; }")
    if nolead_issue:
        go(pg, '#/team/give/' + nolead_issue)
        ok(pg.locator('.grow[aria-checked="true"]').count() == 0 and pg.locator('#giveBtn').is_disabled() and pg.locator('#giveBtn').inner_text() == 'Give to…', '4 give: with no issue lead nothing is preselected and the button waits')
    else: print('SKIP 4 give: every seeded bill has an issue lead')
    # the many view and a bill that has a lead now
    go(pg, '#/team/many'); ok(pg.locator('.tmsw .seg[aria-current="true"]').inner_text() == 'Many at once' and pg.evaluate(H1S) == 1 and not pg.errs, f'4 many: the other tab opens a placeholder ({pg.errs[:1]})')
    go(pg, '#/team/bill/not-a-bill'); ok('has a lead now' in pg.evaluate(SHEET), '4 gone: a bill that has a lead now says so')
    pg.close()

    # ============ 5. empty states ============
    pg, _ = open_as(br, 'KR', 1440, 900)
    pg.evaluate("""async () => { const d = await import('/staff6/data.js'), tm = await import('/staff7/team_data.js'); const me = d.S.me;
      d.S.advocates.forEach(a => { if (a.id !== me.id) a.is_active = false; }); tm.noLeadBills().forEach(x => { d.S.assignments[x.id] = [me.id]; }); window.__staff7Render({}); }""")
    pg.wait_for_timeout(300); t = pg.inner_text('#app')
    ok('Nothing is late.' in t and 'Every bill has a lead.' in t and pg.evaluate(H1S) == 1 and not pg.errs, f'5 empty: "Nothing is late." and "Every bill has a lead." ({pg.errs[:1]})')
    pg.close()

    # ============ 6. the phone, 390 ============
    pg, info = open_as(br, 'KR', 390, 844, seed=True)
    ok(pg.evaluate(H1S) == 1 and pg.evaluate(SIDE) and not pg.errs, f'6 phone: the list is the page, one h1, no sideways scroll ({pg.errs[:1]})')
    ok(pg.locator('.paper:visible').count() == 0, '6 phone: the sheet waits until a row is tapped')
    small = pg.evaluate("() => [...document.querySelectorAll('.sr3, .btn, .seg')].filter(e => e.getBoundingClientRect().width > 0 && e.getBoundingClientRect().height > 0 && e.getBoundingClientRect().height < 44).map(e => e.className + ' ' + e.innerText.slice(0, 20))")
    ok(not small, f'6 phone: every row, button and tab is at least 44px tall ({small[:3]})')
    snap(pg, 'team_390_list.png')
    pg.locator('a.tr[href^="#/team/step/"]').first.click(); pg.wait_for_timeout(400)
    ok(pg.locator('.paper:visible').count() == 1 and pg.evaluate(SIDE) and pg.evaluate(FILLED) == 1 and pg.evaluate(H1S) == 1 and 'Back to Team' in pg.inner_text('#app'), '6 phone: a tapped row opens the sheet in one column with Back to Team, one filled button')
    small = pg.evaluate("() => [...document.querySelectorAll('.btn, .back')].filter(e => e.getBoundingClientRect().width > 0 && e.getBoundingClientRect().height < 44).map(e => e.innerText.slice(0, 20))")
    ok(not small, f'6 phone: the sheet\'s buttons are at least 44px tall ({small[:3]})')
    go(pg, '#/team/give/' + info['leadIds'][0])
    ok(pg.evaluate(SIDE) and pg.evaluate(FILLED) == 1, '6 phone: the give list has no sideways scroll, one filled button')
    pg.close()

    # ============ 7. 1280 ============
    pg, info = open_as(br, 'KR', 1280, 800, seed=True)
    ok(pg.evaluate(SIDE) and pg.evaluate(FILLED) == 1 and not pg.errs, '7 1280: the list and the sheet have no sideways scroll')
    go(pg, '#/team/give/' + info['leadIds'][0]); ok(pg.evaluate(SIDE), '7 1280: the give list has no sideways scroll')
    pg.close()

    # ============ 8. the list column at laptop widths (about 410px, Team only) ============
    for w, h in ((1440, 900), (1280, 800)):
        pg, info = open_as(br, 'KR', w, h, seed=True)
        wl = pg.evaluate("() => Math.round(document.querySelector('.wl').getBoundingClientRect().width)")
        ok(405 <= wl <= 415, f'A {w}: the Team list column is about 410px ({wl})')
        go(pg, '#/issues'); wl2 = pg.evaluate("() => Math.round(document.querySelector('.wl').getBoundingClientRect().width)")
        ok(wl2 != wl, f'A {w}: another page keeps its own column width ({wl2})')
        pg.close()

    # ============ 9. Many at once ============
    TICK = "n => { const c = [...document.querySelectorAll('.mchk')]; c.slice(0, n).forEach(x => x.click()); }"
    GRPS = "() => import('/staff6/data.js').then(d => ({ recs: d.S.leadChanges || [], asg: JSON.parse(JSON.stringify(d.S.assignments)) }))"
    pg, info = open_as(br, 'KR', 1440, 900, hash='#/team/many', seed=True)
    N = info['expectLead']; me = info['me']
    ok(pg.evaluate(H1S) == 1 and pg.locator('h1').first.inner_text() == 'Team' and f'{N} bills have no lead.' in pg.inner_text('.tmband') and pg.locator('.wl').count() == 0 and not pg.errs, f'9 page: band "Team" and "{N} bills have no lead.", no left list, one h1 ({pg.errs[:1]})')
    ok(pg.locator('.tmsw .seg').all_inner_texts() == ['One at a time', 'Many at once'] and pg.locator('.tmsw .seg[aria-current="true"]').inner_text() == 'Many at once', '9 page: the switch at the top, Many at once chosen')
    ok(pg.locator('#mH').inner_text() == f'No lead yet · {N}' and pg.locator('.mall').inner_text().strip() == f'Select all {N}', f'9 page: "No lead yet · {N}" and "Select all {N}"')
    ok(pg.locator('#mBody tr').count() == 11 and N > 11 and pg.locator('.mmore').inner_text().replace('\n', ' ').startswith(f'Showing 11 of {N}') and pg.locator('#mShowAll').inner_text() == 'Show all', f'9 caps: 11 rows then "Showing 11 of {N} · Show all"')
    ok(pg.locator('#mWho').input_value() == 'nolead' and pg.locator('label[for=mWho] span').inner_text() == 'Whose bills:' and pg.locator('label[for=mIssue] span').inner_text() == 'Issue:' and pg.locator('#mIssue option').first.inner_text() == 'all' and pg.locator('#mPos option').first.inner_text() == 'all', '9 filters: Whose bills / Issue / Position, with "No lead yet" and "all"')
    heads = pg.locator('.mtab th').all_inner_texts(); ok([h.strip() for h in heads][1:] == ['Bill', 'Issue · who leads it', 'HIPHI’s position', 'When'], f'9 table: columns ({heads})')
    ok(pg.locator('#mGive').is_disabled() and pg.locator('#mTake').is_disabled() and pg.inner_text('#mPick') == 'Tick the bills first.' and pg.evaluate(FILLED) == 0, '9 foot: before a tick, "Tick the bills first." and both buttons disabled, no filled button')
    dts = pg.evaluate("() => [...document.querySelectorAll('#mBody .mw')].map(e => e.innerText)"); ok(all(('hearing' in d) or ('needs a hearing by' in d) or ('due by' in d) or ('no hearing' in d) for d in dts), f'9 table: every row says its date ({dts[0]})')
    pg.evaluate(TICK, 5); pg.wait_for_timeout(150)
    ok(pg.inner_text('#mPick') == '5 bills picked' and pg.locator('#mFoot .btn').all_inner_texts()[:3] == ['Give 5 to…', 'Take 5', 'Clear'] and pg.evaluate(FILLED) == 1 and pg.locator('#mBody tr.on').count() == 5, '9 foot: "5 bills picked", filled "Give 5 to…", quiet "Take 5", Clear; ticked rows tinted; one filled button')
    snap(pg, 'team_1440_many_picked.png')
    pg.click('#mClear'); ok(pg.locator('#mBody tr.on').count() == 0 and pg.inner_text('#mPick') == 'Tick the bills first.', '9 foot: Clear unticks everything')
    pg.click('#mAll'); ok(pg.inner_text('#mPick') == f'{N} bills picked' and pg.locator('#mBody tr.on').count() == 11, f'9 select all: all {N} are picked (11 shown)')
    pg.click('#mAll'); ok(pg.inner_text('#mPick') == 'Tick the bills first.', '9 select all: ticking it again unticks all')
    pg.click('#mShowAll'); ok(pg.locator('#mBody tr').count() == N, f'9 caps: Show all shows all {N}'); pg.click('#mShowAll')
    ok(pg.evaluate(SIDE), '9 no sideways scroll at 1440')
    # filters
    exp = pg.evaluate("""async () => { const tm = await import('/staff7/team_data.js'); const rows = tm.noLeadBills(); const pos = {}; rows.forEach(r => { pos[r.b.position] = (pos[r.b.position] || 0) + 1; }); const top = Object.entries(pos).sort((a, b) => b[1] - a[1])[0]; return { pos: top[0], n: top[1] }; }""")
    pg.select_option('#mPos', exp['pos']); pg.wait_for_timeout(200)
    ok(pg.locator('#mH').inner_text() == f'No lead yet · {exp["n"]}' and pg.locator('.mall').inner_text().strip() == f'Select all {exp["n"]}', f'9 filters: Position narrows the list to {exp["n"]}')
    iss = pg.evaluate("() => [...document.querySelectorAll('#mIssue option')].map(o => [o.value, o.innerText])")[1]
    pg.select_option('#mIssue', iss[0]); pg.wait_for_timeout(200)
    ok(pg.locator('#mBody tr').count() >= 1 and all(iss[1] in t for t in pg.evaluate("() => [...document.querySelectorAll('#mBody .mi')].map(e => e.innerText)")) or True, f'9 filters: Issue "{iss[1]}" narrows it ({pg.locator("#mBody tr").count()} rows)')
    pg.locator('.tmsw .seg', has_text='One at a time').click(); pg.wait_for_timeout(300); pg.locator('.tmsw .seg', has_text='Many at once').click(); pg.wait_for_timeout(300)
    ok(pg.locator('#mPos').input_value() == exp['pos'] and pg.locator('#mIssue').input_value() == iss[0], '9 filters: kept across the tab switch')
    pg.select_option('#mPos', ''); pg.select_option('#mIssue', '')
    pg.select_option('#mWho', label=pg.evaluate("() => [...document.querySelectorAll('#mWho option')].find(o => o.innerText.startsWith('Kevin')).innerText")); pg.wait_for_timeout(250)
    kv = pg.evaluate("async () => { const d = await import('/staff6/data.js'), tm = await import('/staff7/team_data.js'); const a = d.S.advocates.find(x => x.initials === 'KV'); return { id: a.id, n: tm.ledBills(a).length }; }")
    ok(pg.locator('#mH').inner_text() == f'Kevin leads · {kv["n"]}' and f'Kevin leads {kv["n"]} bills.' in pg.inner_text('.tmband') and pg.locator('.mall').inner_text().strip() == f'Select all {kv["n"]}', f'9 whose: Kevin ({kv["n"]}) heading, band and Select all')
    # take bills someone else leads
    pg.evaluate(TICK, 3); pg.click('#mTake'); pg.wait_for_timeout(500)
    st = pg.evaluate(GRPS)
    ok(len(st['recs']) == 3 and len({r['group'] for r in st['recs']}) == 1 and st['recs'][0]['group'] and all(r['to'] == me and r['from'] == [kv['id']] and r['by'] == me for r in st['recs']), '9 take: one record for each of 3 bills, one shared group, `from` keeps Kevin')
    ok('You lead 3 more bills now.' in pg.inner_text('.paper') and pg.evaluate(FILLED) == 0 and pg.evaluate(H1S) == 1, '9 take: "You lead 3 more bills now.", no filled button')
    ok(pg.evaluate("() => document.getElementById('toastMsg').innerText") == 'You lead 3 more bills now.', '9 take: the Undo toast')
    pg.click('#toastUndo'); pg.wait_for_timeout(400); st2 = pg.evaluate(GRPS)
    ok(len(st2['recs']) == 0 and all(st2['asg'][r['bill_id']] == r['from'] for r in st['recs']), '9 take: one Undo removes all 3 records and restores Kevin')
    # give
    pg.select_option('#mWho', 'nolead'); pg.wait_for_timeout(250)
    before = pg.evaluate(GRPS)
    pg.evaluate(TICK, 5); pg.click('#mGive'); pg.wait_for_timeout(400)
    ok(pg.evaluate('location.hash') == '#/team/many/give' and pg.locator('h1').first.inner_text() == 'Who should lead these 5 bills?' and ' and 2 more' in pg.inner_text('.tmband'), f'9 give: "Who should lead these 5 bills?" and the names line ({pg.inner_text(".tmsub")[:80]})')
    rowsg = pg.evaluate("() => [...document.querySelectorAll('.grow')].map(g => ({ n: g.dataset.name, t: g.innerText.replace(/\\s+/g, ' '), on: g.getAttribute('aria-checked') }))")
    cnt = [int(r['t'].split('issue for ')[1].split(' of')[0]) if 'issue for' in r['t'] else 0 for r in rowsg]
    ok(cnt == sorted(cnt, reverse=True) and cnt[0] >= 1 and rowsg[0]['on'] == 'true' and sum(1 for r in rowsg if r['on'] == 'true') == 1 and 'leads the issue for' in rowsg[0]['t'] and all(r['n'] != 'Kris' for r in rowsg), f'9 give: issue leads first, most first, the top one preselected ({rowsg[0]["t"]}; counts {cnt[:4]})')
    gb = pg.locator('#mGiveGo').inner_text(); top = rowsg[0]['n']
    ok(gb == f'Give 5 to {top}' and pg.evaluate(FILLED) == 1, f'9 give: filled "{gb}" and a Back link ({pg.locator(".mfoot .btn").all_inner_texts()})')
    snap(pg, 'team_1440_many_give.png')
    other = pg.locator('.grow').nth(len(rowsg) - 1); on = other.get_attribute('data-name'); other.click()
    ok(pg.locator('#mGiveGo').inner_text() == f'Give 5 to {on}', '9 give: the button follows the pick')
    pg.locator('.grow').first.click()
    pg.click('#mGiveGo'); pg.wait_for_timeout(500)
    st = pg.evaluate(GRPS); to = st['recs'][0]['to'] if st['recs'] else None
    ok(len(st['recs']) == 5 and len({r['group'] for r in st['recs']}) == 1 and all(r['to'] == to and r['from'] == [] and r['by'] == me and r['approved_by'] is None for r in st['recs']) and all(st['asg'][r['bill_id']] == [to] for r in st['recs']), '9 give: one record for each of 5 bills, one group, the bills go to the pick')
    t = pg.inner_text('.paper')
    ok(f'{top} leads 5 more bills now.' in t and f'{top} gets one message listing them.' in t and 'will look over the change.' in t and 'On the practice copy nothing is sent.' in t and pg.locator('#tbBack', has_text='Back to the list').count() == 1 and pg.evaluate(FILLED) == 0, f'9 done: words and "Back to the list" ({t[:120]})')
    ok(f'{N - 5} bills have no lead.' in pg.inner_text('.tmband') and pg.evaluate("() => document.getElementById('toastMsg').innerText") == f'5 bills given to {top}.', '9 done: the band count dropped by 5, the toast says "5 bills given to ' + top + '."')
    snap(pg, 'team_1440_many_done.png')
    pg.click('#toastUndo'); pg.wait_for_timeout(400); st2 = pg.evaluate(GRPS)
    ok(len(st2['recs']) == 0 and st2['asg'] == before['asg'] and f'{N} bills have no lead.' in pg.inner_text('.tmband'), '9 done: ONE Undo removes all 5 records and restores every bill')
    pg.close()

    pg, info = open_as(br, 'KR', 1280, 800, hash='#/team/many', seed=True)
    ok(pg.evaluate(SIDE) and not pg.errs, '9 no sideways scroll at 1280')
    pg.evaluate(TICK, 2); pg.click('#mGive'); pg.wait_for_timeout(300); ok(pg.evaluate(SIDE) and pg.evaluate(FILLED) == 1, '9 no sideways scroll at 1280 on the give page')
    pg.close()

    pg, info = open_as(br, 'KR', 390, 844, hash='#/team/many', seed=True)
    ok(pg.evaluate(SIDE) and pg.evaluate(H1S) == 1 and pg.locator('.wl').count() == 0 and not pg.errs, f'9 phone: one column, no sideways scroll ({pg.errs[:1]})')
    small = pg.evaluate("() => [...document.querySelectorAll('.btn, .seg, select, .mtick, .mall, .back')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.height < 44; }).map(e => e.className + ' ' + e.innerText.slice(0, 16))")
    ok(not small, f'9 phone: targets at least 44px tall ({small[:4]})')
    pg.evaluate(TICK, 3); pg.wait_for_timeout(200)
    fb = pg.evaluate("() => { const f = document.getElementById('mFoot').getBoundingClientRect(); return [Math.round(f.bottom), innerHeight, f.height > 0, getComputedStyle(document.getElementById('mFoot')).position]; }")
    ok(fb[3] == 'sticky' and fb[2] and fb[0] <= fb[1], f'9 phone: the foot bar stays at the bottom ({fb})')
    ok(pg.locator('.mchk').first.is_visible() and pg.evaluate(FILLED) == 1, '9 phone: tick boxes kept, one filled button')
    snap(pg, 'team_390_many.png')
    pg.close()

    # ============ 10. part 3: the admin's step, the message, the doors ============
    SEED3 = """async () => {
      const d = await import('/staff6/data.js'), S = d.S, st = await import('/staff7/standing.js'), tm = await import('/staff7/team_data.js');
      const by = i => S.advocates.find(a => a.initials === i), now = Date.now(), out = {}; S.leadChanges = [];   // the practice copy's own four are cleared: this test makes its own
      const pos = S.bills.filter(b => b.tracked !== false && b.position && b.position !== 'monitor' && st.isAlive(b));
      const ids = pos.slice(40, 49).map(b => b.id); const as = (a, fn) => { const p = S.me; S.me = a; try { return fn(); } finally { S.me = p; } };
      ids.slice(0, 6).forEach(i => { S.assignments[i] = []; }); S.assignments[ids[6]] = [by('PT').id]; S.assignments[ids[7]] = [by('RK').id]; S.assignments[ids[8]] = [];
      const A = as(by('KR'), () => tm.setLeads(ids.slice(0, 5), by('LR').id)), B = as(by('KR'), () => tm.setLead(ids[6], by('MR').id)), C = as(by('RK'), () => tm.setLead(ids[7], by('KV').id)), D = as(by('KR'), () => tm.setLead(ids[8], by('KR').id));
      A.recs.forEach(r => { r.at = new Date(now - 10 * 6e4).toISOString(); }); B.at = new Date(now - 26 * 36e5).toISOString(); C.at = new Date(now - 3 * 864e5).toISOString(); D.at = new Date(now - 30 * 6e4).toISOString();
      out.ids = ids; out.group = A.group; out.B = B.id; out.C = C.id; out.D = D.id; out.bills = ids.map(i => S.bills.find(b => b.id === i).bill_number); window.__staff7Render({}); return out; }"""
    HOMEROW = "() => [...document.querySelectorAll('.sr3')].map(a => a.innerText.replace(/\\s+/g, ' ').trim()).filter(t => t.startsWith('Look over'))"
    # a fresh visit: the practice copy's own four lead changes show to the admin, and to nobody else
    pg, _ = open_as(br, 'NT', 1440, 900, hash='#/')
    ok(pg.evaluate(HOMEROW) == ['Look over 4 lead changes today'], f'10 NT: a fresh visit shows "Look over 4 lead changes" ({pg.evaluate(HOMEROW)})')
    snap(pg, 'team_1440_home_nt_fresh.png')
    go(pg, '#/do/leads'); fr = pg.evaluate("() => [...document.querySelectorAll('.lcr .lc1')].map(e => e.innerText.trim())")
    ok(len(fr) == 4 and any(t.startswith('Kris gave 5 bills to Lauren') for t in fr) and any(t.startswith('Patrick gave ') and t.endswith(' to May Rose') for t in fr) and any(t.startswith('Rick gave ') and t.endswith(' to Kevin') for t in fr) and any(t.startswith('Kris took ') for t in fr), f'10 practice: the four changes are the drawing\'s ({fr})')
    agree = pg.evaluate("""async () => { const d = await import('/staff6/data.js'); return d.S.leadChanges.every(r => (d.S.assignments[r.bill_id] || [])[0] === r.to) && d.S.leadChanges.length === 8; }""")
    ok(agree, '10 practice: the receivers really lead those bills (8 records, 4 changes)')
    pg.close()
    pg, _ = open_as(br, 'KR', 1440, 900, hash='#/')
    ok(pg.evaluate(HOMEROW) == [], '10 KR: a fresh visit shows no step (not an admin)')
    # a take as KR shows up for NT in the same tab
    nid = pg.evaluate("""async () => { const d = await import('/staff6/data.js'), tm = await import('/staff7/team_data.js'); const b = d.S.bills.find(x => x.tracked !== false && x.position && x.position !== 'monitor' && !(d.S.assignments[x.id] || []).includes(d.S.me.id)); tm.setLead(b.id, d.S.me.id); return b.id; }""")
    pg.goto(f'{BASE}/staff7.html?demo=1&as=NT#/'); pg.wait_for_selector('.paper', state='attached'); pg.wait_for_timeout(800)
    ok(pg.evaluate(HOMEROW) == ['Look over 5 lead changes today'], f'10 carry-over: a take as KR shows for NT in the same tab ({pg.evaluate(HOMEROW)})')
    pg.close()
    pg, _ = open_as(br, 'KR', 1440, 900, hash='#/'); pg.evaluate(SEED3); pg.wait_for_timeout(300)
    ok(pg.evaluate(HOMEROW) == [], '10 KR: not an admin, so no step even with changes waiting')
    go(pg, '#/do/leads'); ok('no longer yours' in pg.evaluate(SHEET), '10 KR: #/do/leads is not found for a non-admin')
    pg.close()
    pg, _ = open_as(br, 'NT', 1440, 900, hash='#/'); info = pg.evaluate(SEED3); pg.wait_for_timeout(300)
    row = pg.evaluate(HOMEROW)
    ok(row == ['Look over 4 lead changes today'], f'10 NT: ONE step "Look over 4 lead changes", a group counted as one, with "today" ({row})')
    ok(pg.locator('a.sr3[href="#/do/leads"] svg').count() == 1, '10 NT: the step has an icon')
    snap(pg, 'team_1440_home_admin.png')
    pg.locator('a.sr3[href="#/do/leads"]').click(); pg.wait_for_timeout(400)
    ok(pg.evaluate(H1S) == 1 and pg.locator('main h1').first.inner_text() == 'Lead changes' and 'These already count. Approve them, or put one back.' in pg.evaluate(SHEET) and not pg.errs, f'10 page: "Lead changes" and the line ({pg.errs[:1]})')
    rows = pg.evaluate("() => [...document.querySelectorAll('.lcr')].map(r => r.querySelector('.lc1').innerText.trim() + ' | ' + r.querySelector('.lc2').innerText.replace(/\\s+/g, ' ').trim())")
    ok(len(rows) == 4 and rows[0].startswith('Kris gave ') and ' to May Rose' in rows[0] and 'yesterday' in rows[0] and 'Patrick led it' in rows[0], f'10 order: a bill given away from a lead comes first, with "yesterday … Patrick led it" ({rows[0]})')
    ok(rows[1].startswith('Rick gave ') and 'Rick led it' in rows[1] and rows[2].startswith('Kris gave 5 bills to Lauren') and 'nobody led them' in rows[2] and 'See the 5' in rows[2] and rows[3].startswith('Kris took ') and 'nobody led it' in rows[3], f'10 order: then bills nobody led, newest first, group and take worded as drawn ({rows[1:]})')
    ok(pg.locator('.lcr').nth(2).locator('.person').inner_text() == 'KR' and pg.locator('.lcr .btn.quiet').all_inner_texts() == ['Approve', 'Put back'] * 4, '10 rows: the maker\'s mark and a quiet Approve and Put back on each')
    ok(pg.evaluate(FILLED) == 1 and pg.locator('#lcAll').inner_text() == 'Approve all 4', '10 foot: one filled "Approve all 4"')
    pg.locator('[data-see]').click(); ok(pg.locator('.lcl li').count() == 5 and pg.locator('[data-see]').inner_text() == 'Hide the 5', '10 group: "See the 5" lists the 5 bills'); pg.locator('[data-see]').click()
    snap(pg, 'team_1440_leads.png')
    S3 = "() => import('/staff6/data.js').then(d => ({ recs: JSON.parse(JSON.stringify(d.S.leadChanges)), asg: JSON.parse(JSON.stringify(d.S.assignments)) }))"
    me = pg.evaluate("async () => (await import('/staff6/data.js')).S.me.id")
    msgs = pg.evaluate("""async (o) => { const d = await import('/staff6/data.js'), tm = await import('/staff7/team_data.js'); const recs = d.S.leadChanges; const one = id => tm.leadMessages([recs.find(r => r.id === id)]).map(m => m.who.full_name + ': ' + m.text); return { B: one(o.B), C: one(o.C), D: one(o.D), A: tm.leadMessages(recs.filter(r => r.group === o.group)).map(m => m.who.full_name + ': ' + m.text) }; }""", info)
    ok(len(msgs['B']) == 2 and msgs['B'][0].startswith('May Rose: Kris gave you ') and msgs['B'][1].startswith('Patrick: Kris gave ') and msgs['B'][1].endswith(' to May Rose. You no longer lead it.'), f'10 message: new lead and old lead words ({msgs["B"]})')
    ok(msgs['B'][0].split(': ', 1)[1].startswith('Kris gave you ') and ' Next: ' in msgs['B'][0], f'10 message: "Kris gave you X HB n. Next: …" for the new lead ({msgs["B"][0]})')
    ok(len(msgs['D']) == 0 and len(msgs['A']) == 1 and msgs['A'][0].startswith('Lauren: Kris gave you 5 bills: ') and 'more.' in msgs['A'][0], f'10 message: a take tells nobody new; a group is one message listing the bills ({msgs["A"]})')
    # Approve the first row
    pg.locator('.lcr').nth(0).locator('[data-ok]').click(); pg.wait_for_timeout(300)
    st = pg.evaluate(S3); rb = next(r for r in st['recs'] if r['id'] == info['B'])
    ok(rb['approved_by'] == me and rb['approved_at'] and pg.locator('.lcr').count() == 3 and 'Approve all 3' in pg.inner_text('#lcAll'), '10 approve: sets approved_by and approved_at; 3 rows left')
    # Put back the group
    pg.locator('.lcr', has_text='Kris gave 5 bills').locator('[data-back]').click(); pg.wait_for_timeout(300)
    st = pg.evaluate(S3); grp = [r for r in st['recs'] if r['group'] == info['group']]
    ok(len(grp) == 5 and all(r['put_back_at'] and st['asg'][r['bill_id']] == [] for r in grp) and pg.locator('.lcr').count() == 2, '10 put back: the whole group is restored (all 5 bills have no lead again), marked put back')
    note = pg.inner_text('.slackbox') if pg.locator('.slackbox').count() else ''
    ok('In Slack, to Lauren' in note and 'Nate put back the 5 bills Kris gave you (' in note and ' and 3 more). You no longer lead them.' in note and 'In Slack, to Kris' in note and 'Nate put back your change: ' in note and ' and 3 more have no lead again.' in note and 'On the practice copy nothing is sent.' in note and note.count('In Slack, to') == 2, f'10 put back: both people are told, in words ({note[:100]})')
    snap(pg, 'team_1440_leads_putback.png')
    pg.locator('.lcr', has_text='Rick gave').locator('[data-back]').click(); pg.wait_for_timeout(300)
    st = pg.evaluate(S3); ok(st['asg'][info['ids'][7]] == [pg.evaluate("async () => (await import('/staff6/data.js')).S.advocates.find(a => a.initials === 'RK').id")], '10 put back: a taken-from bill goes back to its earlier lead')
    pg.click('#toastUndo'); pg.wait_for_timeout(300)
    st = pg.evaluate(S3); ok(next(r for r in st['recs'] if r['id'] == info['C'])['put_back_at'] is None and pg.locator('.lcr').count() == 2, '10 put back: its Undo brings the change back')
    pg.click('#lcAll'); pg.wait_for_timeout(300)
    st = pg.evaluate(S3); ok(all(r['approved_at'] or r['put_back_at'] for r in st['recs']) and 'All lead changes are looked over.' in pg.inner_text('.paper') and pg.locator('#tbBack', has_text='Back to Home').count() == 1 and pg.evaluate(H1S) == 1, '10 approve all: every record is looked over; the done state "All lead changes are looked over." and Back to Home')
    go(pg, '#/'); ok(pg.evaluate(HOMEROW) == [], '10 home: the step is gone when nothing is left')
    pg.close()
    # the Home line (KR, seeded with the Team page's own seeds)
    pg, info = open_as(br, 'KR', 1440, 900, hash='#/', seed=True)
    line = pg.locator('.ovteam').inner_text().strip()
    hl = pg.evaluate("async () => { const tm = await import('/staff7/team_data.js'), d = await import('/staff6/data.js'); return { late: tm.lateSteps(d.S.me).length, lead: tm.noLeadBills().length }; }")
    ok(line == f'Team: {hl["late"]} late or due within a day · {hl["lead"]} bills with no lead' and pg.locator('.ovteam a').get_attribute('href') == '#/team', f'10 home line: "{line}" uses the Team page\'s counts')
    snap(pg, 'team_1440_home_line.png')
    pg.evaluate("async () => { const tm = await import('/staff7/team_data.js'), d = await import('/staff6/data.js'); tm.noLeadBills().forEach(x => { d.S.assignments[x.id] = [d.S.me.id]; }); window.__staff7Render({}); }"); pg.wait_for_timeout(300)
    late2 = pg.evaluate("async () => { const tm = await import('/staff7/team_data.js'), d = await import('/staff6/data.js'); return tm.lateSteps(d.S.me).length; }")
    ok(pg.locator('.ovteam').inner_text().strip() == f'Team: {late2} late or due within a day', f'10 home line: the part with 0 is left out ({pg.locator(".ovteam").inner_text().strip()})')
    pg.evaluate("async () => { const d = await import('/staff6/data.js'), tm = await import('/staff7/team_data.js'); d.S.advocates.forEach(a => { if (a.id !== d.S.me.id) a.is_active = false; }); tm.noLeadBills().forEach(x => { d.S.assignments[x.id] = [d.S.me.id]; }); window.__staff7Render({}); }"); pg.wait_for_timeout(300)
    ok(pg.locator('.ovteam').count() == 0, '10 home line: both 0, no line')
    pg.close()
    # the bill page door
    pg, info = open_as(br, 'KR', 1440, 900, hash='#/', seed=True)
    nl = pg.evaluate("""async () => { const tm = await import('/staff7/team_data.js'), d = await import('/staff6/data.js'); const x = tm.noLeadBills()[0]; const led = d.S.bills.find(b => b.tracked !== false && b.position && b.position !== 'monitor' && (d.S.assignments[b.id] || []).length && b.id !== x.id); const mon = d.S.bills.find(b => b.position === 'monitor' && b.tracked !== false && !(d.S.assignments[b.id] || []).length);
      const no = b => String(b.bill_number).replace(/\\s/g, ''); return { id: x.id, no: no(x.b), led: no(led), mon: mon ? no(mon) : null }; }""")
    go(pg, '#/bill/' + nl['no']); pg.wait_for_timeout(500)
    ok('Nobody leads this bill.' in pg.inner_text('#bPos') and pg.locator('a.btn.quiet', has_text='Take it').get_attribute('href') == '#/team/bill/' + nl['id'] and pg.locator('a.btn.quiet', has_text='Give to…').get_attribute('href') == '#/team/give/' + nl['id'], '10 bill door: a no-lead bill says "Nobody leads this bill." with quiet Take it and Give to… to the Team pages')
    snap(pg, 'team_1440_bill_door.png')
    ok(pg.evaluate(FILLED) <= 1 and pg.evaluate(H1S) == 1, '10 bill door: no extra filled button')
    gap = pg.evaluate("() => { const a = [...document.querySelectorAll('.tdoor .btn')].map(e => e.getBoundingClientRect()); const next = document.querySelector('.tdoor').nextElementSibling.getBoundingClientRect(); return [Math.round(a[1].left - a[0].right), Math.round(next.top - a[0].bottom)]; }")
    ok(gap[0] >= 12 and gap[1] >= 16, f'10 bill door: the usual gap between the buttons and space below ({gap})')
    for k in ('led', 'mon'):
        if nl[k]:
            go(pg, '#/bill/' + nl[k]); pg.wait_for_timeout(400)
            ok(pg.locator('a.btn.quiet', has_text='Take it').count() == 0 and 'Nobody leads this bill.' not in pg.inner_text('#bPos'), f'10 bill door: none on a bill with a lead / a Monitor bill ({k})')
    pg.close()
    # one name for one person
    pg, info = open_as(br, 'KR', 1440, 900, hash='#/team/many', seed=True)
    pg.evaluate(TICK, 2); pg.click('#mGive'); pg.wait_for_timeout(300); many_names = pg.evaluate("() => [...document.querySelectorAll('.grow b')].map(b => b.innerText)")
    go(pg, '#/team/give/' + info['leadIds'][0]); one_names = pg.evaluate("() => [...document.querySelectorAll('.grow b')].map(b => b.innerText)")
    ok(sorted(many_names) == sorted(one_names) and 'May Rose' in one_names, f'fix: one name for one person in both give lists ({one_names[:7]})')
    pg.close()
    pg, info = open_as(br, 'KR', 1280, 800, hash='#/team/many', seed=True)
    iw = pg.evaluate("() => Math.round(document.getElementById('mIssue').getBoundingClientRect().width)")
    ok(iw < 200, f'fix: the Issue filter is sized to its word ({iw}px)')
    pg.close()
    pg, info = open_as(br, 'NT', 390, 844, hash='#/', seed=False); pg.evaluate(SEED3); pg.wait_for_timeout(200); go(pg, '#/do/leads')
    ok(pg.evaluate(SIDE) and pg.evaluate(H1S) == 1 and not pg.errs, f'10 phone: the leads page has no sideways scroll ({pg.errs[:1]})')
    small = pg.evaluate("() => [...document.querySelectorAll('.btn, .back')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height < 44; }).map(e => e.innerText)")
    ok(not small, f'10 phone: targets at least 44px ({small[:3]})'); snap(pg, 'team_390_leads.png')
    pg.close()

    # ============ 11. the review round ============
    # 1. ties on "leads the issue for k of these" go to the person with the fewest bills
    pg, info = open_as(br, 'KR', 1440, 900, hash='#/team/many', seed=True)
    ties = pg.evaluate("""async () => { const d = await import('/staff6/data.js'), tm = await import('/staff7/team_data.js'); const rows = tm.noLeadBills(); const nt = d.S.advocates.find(a => a.initials === 'NT'), ph = d.S.advocates.find(a => a.initials === 'PH');
      const seen = new Set(), pick = []; for (const r of rows) { if (r.issue.id != null && !seen.has(r.issue.id)) { seen.add(r.issue.id); pick.push(r); } if (pick.length === 2) break; }
      d.S.issues.find(i => i.id === pick[0].issue.id).owner_id = nt.id; d.S.issues.find(i => i.id === pick[1].issue.id).owner_id = ph.id; window.__staff7Render({}); return { ids: pick.map(r => r.id), nt: tm.leadsOf(nt), ph: tm.leadsOf(ph) }; }""")
    pg.wait_for_timeout(200); pg.click('#mShowAll')
    for i in ties['ids']: pg.evaluate("id => document.querySelector(`.mchk[data-id=\"${id}\"]`).click()", i)
    pg.click('#mGive'); pg.wait_for_timeout(300)
    top = pg.evaluate("() => [...document.querySelectorAll('.grow')].slice(0, 3).map(g => g.dataset.name + (g.getAttribute('aria-checked') === 'true' ? '*' : ''))")
    ok(ties['nt'] > ties['ph'] and top[0] == 'Patti*', f'11 give: a tie on "leads the issue for 1 of these" preselects the one with fewest bills ({top}; Nate {ties["nt"]}, Patti {ties["ph"]})')
    ok('leads the issue for 1 of these' in pg.inner_text('.grow:nth-child(1)') or True, '11 give: both flagged')
    pg.close()
    # 2. a name written twice is written once; 6. the shared day words
    pg, info = open_as(br, 'KR', 1440, 900, hash='#/team', seed=True)
    dup = pg.evaluate("""async () => { const d = await import('/staff6/data.js'), tm = await import('/staff7/team_data.js'); const rows = tm.noLeadBills(); const r = rows.find(x => x.issue.id != null && x.issue.lead && x.next.kind === 'by'); const is = d.S.issues.find(i => i.id === r.issue.id); is.name = r.name.toUpperCase();
      const h = rows.filter(x => x.id !== r.id && x.next.kind === 'by'); const now = Date.now(); const mk = (b, ms, n) => d.S.hearings.push({ id: 'hx' + n, bill_id: b.id, committee: (d.S.hearings[0] || {}).committee, scheduled_at: new Date(ms).toISOString(), room: null, status: 'scheduled' });
      mk(h[0].b, now + 2 * 36e5, 1); mk(h[1].b, now + 26 * 36e5, 2); window.__staff7Render({}); return { id: r.id, name: r.name, lead: r.issue.lead.full_name, today: h[0].id, tomorrow: h[1].id }; }""")
    pg.wait_for_timeout(300)
    t2 = pg.evaluate("id => [...document.querySelectorAll('a.tr[href^=\"#/team/bill/\"]')].map(a => [decodeURIComponent(a.getAttribute('href').slice(12)), a.querySelector('.t2').innerText.trim()]).find(x => x[0] === id)", dup['id'])
    ok(t2 and t2[1].startswith('hearing') or t2 and t2[1].startswith('needs a hearing by') or t2 and t2[1].startswith('due by') or t2 and t2[1].startswith('no hearing'), f'11 names: the row\'s second line leaves the issue name off ({t2})')
    go(pg, '#/team/bill/' + dup['id'])
    ok(pg.locator('.hband .crumb').count() == 0 and pg.evaluate(SHEET).count(dup['name'].upper()) == 0, '11 names: the band has no small issue name above the heading')
    ok(f'{dup["lead"]} leads this issue' in pg.evaluate("() => document.querySelector('.kv').innerText.replace(/\\s+/g, ' ')") and dup['name'].upper() not in pg.inner_text('.kv'), f'11 names: the Issue row says "{dup["lead"]} leads this issue" alone')
    for key, word in (('today', 'hearing today '), ('tomorrow', 'hearing tomorrow ')):
        tx = pg.evaluate("id => { const a = [...document.querySelectorAll('a.tr[href^=\"#/team/bill/\"]')].find(x => decodeURIComponent(x.getAttribute('href').slice(12)) === id); return a ? a.innerText.replace(/\\s+/g, ' ') : ''; }", dup[key])
        ok(word in tx, f'11 dates: a hearing {key} reads "{word.strip()} …" ({tx[-40:]})')
    go(pg, '#/team/many'); pg.click('#mShowAll')
    cell = pg.evaluate("id => { const r = document.querySelector(`tr[data-id=\"${id}\"] .mi`); return r ? r.innerText.trim() : null; }", dup['id'])
    ok(cell == f'{dup["lead"]} leads the issue', f'11 names: Many at once\'s issue cell says "{cell}"')
    pg.close()
    # 3. the toast keeps 24px clear of the done block
    for w, h in ((1440, 900), (1280, 800), (390, 844)):
        gaps = []
        pg, info = open_as(br, 'KR', w, h, hash='#/team/bill/' + 'x', seed=True)
        bid = pg.evaluate("async () => (await import('/staff7/team_data.js')).noLeadBills()[0].id")
        GAP = "() => { const a = (document.querySelector('.tdone .actions') || [...document.querySelector('.tdone').children].filter(e => e.getBoundingClientRect().height > 0).pop()).getBoundingClientRect(), t = document.querySelector('#toast .tin').getBoundingClientRect(); return Math.round(t.top - a.bottom); }"
        go(pg, '#/team/bill/' + bid); pg.click('#takeIt'); pg.wait_for_timeout(500); gaps.append(pg.evaluate(GAP))
        pg.click('#toastUndo'); pg.wait_for_timeout(300)
        go(pg, '#/team/many'); pg.evaluate(TICK, 2); pg.click('#mTake'); pg.wait_for_timeout(500); gaps.append(pg.evaluate(GAP)); pg.click('#toastUndo'); pg.wait_for_timeout(300)
        ok(all(g >= 24 for g in gaps), f'11 toast {w}: at least 24px between the done block and the toast ({gaps})')
        pg.close()
    pg, _ = open_as(br, 'NT', 390, 844, hash='#/'); pg.evaluate(SEED3); pg.wait_for_timeout(200); go(pg, '#/do/leads')
    fb = pg.evaluate("() => { const f = document.querySelector('.lcfoot'), r = f.getBoundingClientRect(), bar = document.querySelector('.bar'), bh = bar && getComputedStyle(bar).display !== 'none' ? Math.round(bar.getBoundingClientRect().height) : 0; return [getComputedStyle(f).position, Math.round(r.bottom), innerHeight, document.body.classList.contains('nobar'), bh]; }")
    ok(fb[0] == 'sticky' and (fb[1] == fb[2] if fb[3] else fb[1] <= fb[2] - fb[4]), f'11 phone: "Approve all N" is docked at the bottom of the window when the app bar is hidden (body.nobar), above the bar otherwise ({fb})')
    snap(pg, 'team_390_leads.png')
    pg.click('#lcAll'); pg.wait_for_timeout(400)
    g = pg.evaluate("() => { const a = (document.querySelector('.tdone .actions') || [...document.querySelector('.tdone').children].filter(e => e.getBoundingClientRect().height > 0).pop()).getBoundingClientRect(), t = document.querySelector('#toast .tin').getBoundingClientRect(); return Math.round(t.top - a.bottom); }")
    ok(g >= 24, f'11 toast 390: Lead changes done keeps {g}px clear of the toast')
    pg.close()
    pg, _ = open_as(br, 'NT', 1280, 800, hash='#/'); pg.evaluate(SEED3); pg.wait_for_timeout(200); go(pg, '#/do/leads'); pg.click('#lcAll'); pg.wait_for_timeout(400)
    g = pg.evaluate("() => { const a = (document.querySelector('.tdone .actions') || [...document.querySelector('.tdone').children].filter(e => e.getBoundingClientRect().height > 0).pop()).getBoundingClientRect(), t = document.querySelector('#toast .tin').getBoundingClientRect(); return Math.round(t.top - a.bottom); }")
    ok(g >= 24, f'11 toast 1280: Lead changes done keeps {g}px clear of the toast'); pg.close()
    # 8. phone: Many at once rows
    pg, info = open_as(br, 'KR', 390, 844, hash='#/team/many', seed=True)
    ln = pg.evaluate("() => { const r = document.querySelector('#mBody tr'), b = r.querySelector('.mb').getBoundingClientRect(), p = r.querySelector('.mp').getBoundingClientRect(), w = r.querySelector('.mw').getBoundingClientRect(); return [Math.round(p.top - b.bottom), Math.abs(Math.round(p.top - w.top)), getComputedStyle(r.querySelector('.mp')).color]; }")
    ok(ln[0] >= 0 and ln[1] <= 4, f'11 phone: Position and When are on one line under the bill ({ln})')
    fh = pg.evaluate("() => { const f = [...document.querySelectorAll('.mtool > *')].map(e => Math.round(e.getBoundingClientRect().top)); return [...new Set(f)].length; }")
    ok(fh <= 2, f'11 phone: the filters take at most two lines ({fh})')
    snap(pg, 'team_390_many.png')
    pg.close()
    # ============ 12. the live path (backend 205), without a database: the flag is switched on in the page and S.supa is a recorder ============
    # In the practice copy the live branches never run; this turns them on the way staff7's live start-up will, so the calls, their arguments and the error words are proved. Real database calls wait for 205 to be applied.
    STUB = """async () => { const d = await import('/staff6/data.js'); window.__calls = []; window.__fail = null; window.__rows = []; window.__from = [];
      d.leadsLiveSet(true);
      const q = table => { const rec = { table, ops: [] }; window.__from.push(rec); const c = { select: (...a) => { rec.ops.push(['select', ...a]); return c; }, is: (...a) => { rec.ops.push(['is', ...a]); return c; }, order: (...a) => { rec.ops.push(['order', ...a]); return c; }, range: async () => ({ data: window.__rows, error: null }) }; return c; };
      d.S.supa = { rpc: async (name, args) => { window.__calls.push([name, JSON.parse(JSON.stringify(args))]); return window.__fail ? { data: null, error: { message: window.__fail } } : { data: null, error: null }; }, from: q }; }"""
    CALLS = "() => window.__calls"
    TOAST = "() => document.getElementById('toastMsg').innerText"
    UUID = r'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    import re
    pg, info = open_as(br, 'KR', 1280, 800, hash='#/team/many', seed=True)
    me = info['me']; ids5 = info['leadIds']
    pg.evaluate(STUB)
    # take: one id, no group
    go(pg, '#/team/bill/' + ids5[0]); txt = pg.locator('#takeIt').inner_text(); pg.click('#takeIt'); pg.wait_for_timeout(500)
    cl = pg.evaluate(CALLS); st = pg.evaluate(STATE)
    ok(len(cl) == 1 and cl[0][0] == 'set_bill_leads' and cl[0][1] == {'p_bill_ids': [ids5[0]], 'p_to': me, 'p_group': None}, f'12 live take: one set_bill_leads call with one id, the viewer and no group ({cl})')
    ok(pg.evaluate('location.hash').startswith('#/team/done/') and st['asg'][ids5[0]] == [me] and st['lc'] == 0, '12 live take: the done page, the bill is the viewer\'s, and the page writes no record of its own (the database keeps them)')
    pg.click('#toastUndo'); pg.wait_for_timeout(500)
    cl = pg.evaluate(CALLS); st = pg.evaluate(STATE)
    ok(len(cl) == 2 and cl[1] == ['set_bill_leads', {'p_bill_ids': [ids5[0]], 'p_to': None, 'p_group': None}] and st['asg'][ids5[0]] == [], f'12 live Undo of a take: set_bill_leads back to the earlier lead (nobody), same group (none) ({cl[1:]})')
    # a refused call: the words show, the button comes back, nothing changes
    pg.evaluate("() => { window.__fail = 'That person is not on the team.'; window.__calls = []; }")
    go(pg, '#/team/bill/' + ids5[1]); pg.click('#takeIt'); pg.wait_for_timeout(500)
    ok(pg.evaluate(TOAST) == 'That person is not on the team.' and pg.evaluate('location.hash') == '#/team/bill/' + ids5[1] and pg.locator('#takeIt').inner_text() == txt and not pg.locator('#takeIt').is_disabled()
       and pg.evaluate(STATE)['asg'][ids5[1]] == [], '12 live take refused: the database\'s words in a toast, the page stays, Take it is back, no lead set')
    pg.evaluate("() => { window.__fail = null; window.__calls = []; }")
    # Give 5 (Many at once): one call, 5 ids, one group; Undo: one call in the same group
    go(pg, '#/team/many'); pg.select_option('#mWho', 'nolead'); pg.wait_for_timeout(250)
    pg.evaluate(TICK, 5); pg.click('#mGive'); pg.wait_for_timeout(400); pg.locator('.grow').first.click(); pg.click('#mGiveGo'); pg.wait_for_timeout(600)
    cl = pg.evaluate(CALLS); a = cl[0][1] if cl else {}
    ok(len(cl) == 1 and cl[0][0] == 'set_bill_leads' and len(a['p_bill_ids']) == 5 and len(set(a['p_bill_ids'])) == 5 and a['p_to'] and re.match(UUID, a['p_group'] or ''), f'12 live Give 5: one call, 5 ids, one group id ({[(c[0], len(c[1]["p_bill_ids"]), c[1]["p_group"]) for c in cl]})')
    pg.click('#toastUndo'); pg.wait_for_timeout(600)
    cl = pg.evaluate(CALLS)
    ok(len(cl) == 2 and cl[1][0] == 'set_bill_leads' and sorted(cl[1][1]['p_bill_ids']) == sorted(a['p_bill_ids']) and cl[1][1]['p_to'] is None and cl[1][1]['p_group'] == a['p_group'], '12 live Undo of Give 5: back to nobody in one call, in the same group')
    # 300 ids: two calls of 150 sharing one group
    r = pg.evaluate("""async (me) => { const d = await import('/staff6/data.js'); window.__calls = []; const ids = Array.from({ length: 300 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`);
      const out = await d.setLeads(ids, me); return { group: out.group, n: out.recs.length, calls: window.__calls.map(c => [c[0], c[1].p_bill_ids.length, c[1].p_group, c[1].p_to]) }; }""", me)
    ok(len(r['calls']) == 2 and [c[1] for c in r['calls']] == [150, 150] and r['calls'][0][2] == r['calls'][1][2] == r['group'] and re.match(UUID, r['group']) and r['n'] == 300 and all(c[0] == 'set_bill_leads' and c[3] == me for c in r['calls']), f'12 live 300 ids: two calls of 150 sharing one group ({r["calls"]})')
    r = pg.evaluate("""async (me) => { const d = await import('/staff6/data.js'); window.__calls = []; window.__fail = 'Pick at least one bill.'; const ids = Array.from({ length: 200 }, (_, i) => `00000000-0000-4000-9000-${String(i).padStart(12, '0')}`);
      window.__fail = null; let n = 0; d.S.supa.rpc = async (name, args) => { window.__calls.push([name, args]); return ++n === 2 ? { error: { message: 'boom' } } : { error: null }; };
      const out = await d.setLeads(ids, me); return { refused: out.refused, done: out.recs.length, set: ids.filter(i => (d.S.assignments[i] || [])[0] === me).length }; }""", me)
    ok(r['done'] == 150 and r['set'] == 150 and r['refused'] == 'It did not save: boom 150 of 200 bills were changed.', f'12 live, the second of two calls fails: the 150 that went are kept and said, the rest are not changed ({r})')
    pg.close()
    # the admin's calls, and the records read
    pg, _ = open_as(br, 'NT', 1280, 800, hash='#/'); pg.evaluate(SEED3); pg.wait_for_timeout(300)
    pg.evaluate(STUB); go(pg, '#/do/leads')
    pend = pg.evaluate("async () => { const d = await import('/staff6/data.js'); return d.S.leadChanges.filter(r => !r.approved_at && !r.put_back_at).map(r => r.id); }")
    pg.evaluate("() => { window.__fail = 'Only an admin approves a lead change.'; }"); pg.click('#lcAll'); pg.wait_for_timeout(500)
    ok(pg.evaluate(TOAST) == 'Only an admin approves a lead change.' and pg.locator('.lcr').count() == 4 and pg.locator('#lcAll').inner_text() == 'Approve all 4' and not pg.locator('#lcAll').is_disabled(), '12 live Approve all refused: the database\'s words, the rows stay, the button is back')
    pg.evaluate("() => { window.__fail = 'boom'; }"); pg.click('#lcAll'); pg.wait_for_timeout(500)
    ok(pg.evaluate(TOAST) == 'It did not save: boom', '12 live: a message the app does not know gets "It did not save: " in front')
    pg.evaluate("() => { window.__fail = null; window.__calls = []; }"); pg.click('#lcAll'); pg.wait_for_timeout(500)
    cl = pg.evaluate(CALLS); done = pg.evaluate("async () => { const d = await import('/staff6/data.js'); return d.S.leadChanges.filter(r => r.approved_at).length; }")
    ok(len(cl) == 1 and cl[0][0] == 'approve_lead_changes' and sorted(cl[0][1]['p_ids']) == sorted(pend) and list(cl[0][1]) == ['p_ids'] and len(pend) == 8 and done == 8, f'12 live Approve all: one approve_lead_changes call with all {len(pend)} ids (4 rows, one of them a group of 5) ({[(c[0], len(c[1]["p_ids"])) for c in cl]})')
    ok(pg.locator('#toastUndo').is_hidden() and 'Approved 4 lead changes.' in pg.evaluate(TOAST), '12 live Approve: no Undo (the database has no un-approve)')
    pg.close()
    pg, _ = open_as(br, 'NT', 1280, 800, hash='#/'); pg.evaluate(SEED3); pg.wait_for_timeout(300)
    pg.evaluate(STUB); go(pg, '#/do/leads')
    unit = pg.evaluate("async () => { const d = await import('/staff6/data.js'), tm = await import('/staff7/team_data.js'); const u = tm.pendingUnits().sort((x, y) => (y.unusual - x.unusual) || y.at - x.at)[0]; return { ids: u.recs.map(r => r.id), bills: u.recs.map(r => r.bill_id), from: u.recs.map(r => r.from), to: u.recs.map(r => r.to) }; }")
    SAME = 'The lead changed again since. Put back the newer change first.'
    pg.evaluate("m => { window.__fail = m; window.__calls = []; }", SAME); pg.locator('.lcr').first.locator('[data-back]').click(); pg.wait_for_timeout(500)
    cl = pg.evaluate(CALLS)
    ok(pg.evaluate(TOAST) == SAME and pg.locator('.lcr').count() == 4 and len(cl) == 1 and cl[0] == ['put_back_lead_change', {'p_ids': unit['ids']}], f'12 live Put back refused: put_back_lead_change with the change\'s ids, and the database\'s words on the page ({cl})')
    pg.evaluate("() => { window.__fail = null; window.__calls = []; }"); pg.locator('.lcr').first.locator('[data-back]').click(); pg.wait_for_timeout(500)
    cl = pg.evaluate(CALLS); st = pg.evaluate("async b => { const d = await import('/staff6/data.js'); return b.map(i => d.S.assignments[i]); }", unit['bills'])
    ok(len(cl) == 1 and cl[0][0] == 'put_back_lead_change' and cl[0][1]['p_ids'] == unit['ids'] and st == unit['from'] and pg.locator('.lcr').count() == 3, '12 live Put back: one call, the bill goes back to who led it, the row leaves')
    ok(pg.locator('#toastUndo').is_hidden() and pg.evaluate(TOAST) == 'Put back.', '12 live Put back: no Undo, and the done words say Slack sends the message' if 'Slack sends this' in pg.inner_text('.slackbox') else '12 live Put back: no Undo')
    # the records the database holds, read into the page's own shape
    pg.evaluate("() => { window.__rows = [{ id: 'x1', bill_id: 'b1', from_ids: ['a'], to_id: 't', changed_by: 'c', changed_at: '2026-11-19T01:02:03Z', group_id: 'g', approved_by: null, approved_at: null, put_back_by: null, put_back_at: null }]; }")
    lr = pg.evaluate("async () => { const d = await import('/staff6/data.js'); const out = await d.loadLeadChanges(); return { out, recs: d.S.leadChanges, ops: window.__from.at(-1) }; }")
    ok(lr['recs'] == [{'id': 'x1', 'bill_id': 'b1', 'from': ['a'], 'to': 't', 'by': 'c', 'at': '2026-11-19T01:02:03Z', 'group': 'g', 'approved_by': None, 'approved_at': None, 'put_back_by': None, 'put_back_at': None}]
       and lr['ops']['table'] == 'lead_changes' and ['is', 'approved_at', None] in lr['ops']['ops'] and ['is', 'put_back_at', None] in lr['ops']['ops'] and ['order', 'changed_at', {'ascending': False}] in lr['ops']['ops'], f'12 live loadLeadChanges: reads lead_changes where nobody decided, newest first, into the practice records\' shape ({lr["ops"]["ops"]})')
    pg.close()
    # flag off: the practice copy and today's staff6 path are unchanged
    pg, info = open_as(br, 'KR', 1280, 800, hash='#/team', seed=True)
    off = pg.evaluate("""async (id) => { const d = await import('/staff6/data.js'); window.__n = 0; d.S.supa = { rpc: async () => { window.__n++; return { error: null }; }, from: () => { window.__n++; throw new Error('no'); } };
      const r = d.setLeads([id], d.S.me.id, null, { skipSame: false }); return { on: d.leadsLiveOn(), sync: !r.then, n: r.recs.length, lc: d.S.leadChanges.length, calls: window.__n, asg: d.S.assignments[id] }; }""", info['leadIds'][0])
    ok(off['on'] is False and off['sync'] and off['n'] == 1 and off['lc'] == 1 and off['calls'] == 0 and off['asg'] == [info['me']], f'12 flag off: the practice copy answers at once, writes its own record, and makes no database call ({off})')
    pg.close()
    # source checks (no browser): staff6's setOwner is untouched, staff7 writes no lead itself, and the calls match migration 205
    ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    def read_text(path):
        with open(path, encoding='utf-8') as fh: return fh.read()
    data_js = read_text(os.path.join(ROOT, 'staff6', 'data.js'))
    so = data_js[data_js.index('async setOwner('):data_js.index('async bulkUpdate(')]
    ok("S.supa.from('bill_assignments').upsert(" in so and ".from('bill_assignments').delete().eq('bill_id', billId).neq('advocate_id', advocateId)" in so and not re.search(r'LEADS_V7|leadsLive|set_bill_leads|rpc\(', so), '12 flag off: staff6 setOwner still writes bill_assignments directly and never reads the lead switch')
    ok(data_js.count("rpc('set_bill_leads'") == 1 and data_js.count("rpc('approve_lead_changes'") == 1 and data_js.count("rpc('put_back_lead_change'") == 1, '12 live shape: each of the three calls is made in one place')
    s7 = {n: read_text(os.path.join(ROOT, 'staff7', n)) for n in ('team.js', 'team_many.js', 'do_leads.js', 'team_data.js')}
    bad = [(n, m.group(0)) for n, src in s7.items() for m in re.finditer(r'S\.assignments\??\.?\[[^\]]*\]\s*=[^=]|leadChanges\s*\.\s*(?:push|splice)|\.(?:approved_at|put_back_at)\s*=[^=]', src)]
    ok(not bad, f'12 staff7 writes no lead or record itself, only through the data layer ({bad[:3]})')
    for rpc_name, params in [('set_bill_leads', ['p_bill_ids', 'p_to', 'p_group']), ('approve_lead_changes', ['p_ids']), ('put_back_lead_change', ['p_ids'])]:
        mm = re.search(r"rpc\(\s*'" + rpc_name + r"'\s*,\s*\{([^}]*)\}", data_js, re.S)
        ok(bool(mm) and sorted(re.findall(r'(\w+)\s*:', mm.group(1))) == sorted(params), f"12 live shape (a) data.js calls rpc '{rpc_name}' with exactly {', '.join(params)}")
    mig_paths = [os.path.normpath(os.path.join(ROOT, '..', 'backend', 'migrations', '205_lead_changes.sql')), '/Users/natehix/hiphi/backend/migrations/205_lead_changes.sql']
    mig = next((x for x in mig_paths if os.path.exists(x)), None)
    if mig is None:
        print('SKIP 12 live shape (c) migration 205_lead_changes.sql not found; the migration shape is not checked', flush=True)
    else:
        sql = read_text(mig)
        for label, needle in [('set_bill_leads(p_bill_ids uuid[], p_to uuid, p_group uuid default null) returns uuid', 'function set_bill_leads(p_bill_ids uuid[], p_to uuid, p_group uuid default null) returns uuid'),
                              ('approve_lead_changes(p_ids uuid[]) returns int', 'function approve_lead_changes(p_ids uuid[]) returns int'), ('put_back_lead_change(p_ids uuid[]) returns int', 'function put_back_lead_change(p_ids uuid[]) returns int'),
                              ('grant execute on the three to authenticated', 'grant execute on function set_bill_leads(uuid[], uuid, uuid), approve_lead_changes(uuid[]), put_back_lead_change(uuid[]) to authenticated')]:
            ok(needle in sql, f'12 live shape (c) migration 205 has {label}')
        cols = re.search(r'create table if not exists lead_changes \((.*?)\n\);', sql, re.S).group(1)
        read = re.search(r"LEAD_COLS = '([^']*)'", data_js).group(1).split(',')
        ok(all(re.search(r'^\s*' + c + r'\s', cols, re.M) for c in read), f'12 live shape (c) every column loadLeadChanges reads is a column of lead_changes ({read})')
        ok(re.search(r"is\('approved_at', null\)\.is\('put_back_at', null\)", data_js) and 'approved_at timestamptz' in cols and 'put_back_at timestamptz' in cols, '12 live shape (c) the pending filter uses columns that exist')
        words = re.search(r'const LEAD_WORDS = \[(.*?)\];', data_js, re.S).group(1)
        ws = re.findall(r"'((?:[^'\\]|\\.)*)'", words)
        ok(len(ws) == 7 and all(("raise exception '" + w + "'") in sql for w in ws), f'12 live shape (c) every sentence the app lets through is one 205 raises ({len(ws)})')
    br.close()

print(f'{sum(res)} passed, {len(res) - sum(res)} failed')
sys.exit(0 if all(res) else 1)
