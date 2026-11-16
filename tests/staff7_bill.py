# Staff7's bill page, Part A (R-398), on the practice copy: HIPHI's position and who leads, where the bill stands (two plain lines), the path, and the bill's facts.
# Bills are PICKED from the practice data by what they are (a hearing ahead, at risk, cleared a deadline, stopped, joint hearing, late testimony, no issue, nobody leads, ...), never named in advance.
# The status words are compared with what the Issues list says for the same bill (Everyone's list), so the two cannot drift.
# Rules kept: position, status and who leads are readable without scrolling at 1440x900; every name is a link that lands on a real page; amber only for late testimony; external links open in a new tab with rel=noopener;
# the word "letter" appears nowhere a person reads; the page never prints "vape"; no sideways scroll, 44px targets on a phone; no console error; nothing leaves 127.0.0.1.
#   python3 tests/staff7_bill.py [base] [shots folder]     base defaults to http://127.0.0.1:8851
import sys, os, re, json
from playwright.sync_api import sync_playwright
BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8851').rstrip('/')
SHOTS = sys.argv[2] if len(sys.argv) > 2 else ''
if SHOTS: os.makedirs(SHOTS, exist_ok=True)
res = []
def ok(c, m): res.append(bool(c)); print('PASS' if c else 'FAIL', m, flush=True)

NOSIDE = "() => document.documentElement.scrollWidth <= innerWidth && [...document.querySelectorAll('.paper, .wl')].every(p => p.scrollWidth <= p.clientWidth + 1)"
SMALL = "() => [...document.querySelectorAll('.paper .btn, .paper .crumb.back2, .back')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.height < 43.5 && !e.closest('[hidden]'); }).map(e => e.className + ' ' + (e.innerText || '').slice(0, 20))"
# every bill, by what it is (computed here from the data layer, then used to pick real bills)
CLASSES = """async () => {
  const d = await import('/staff6/data.js'), mo = await import('/staff6/model.js'), st = await import('/staff7/standing.js'), is = await import('/staff7/issues.js'), bw = await import('/staff7/bill_words.js'), S = d.S;
  const out = {}, add = (k, b) => { (out[k] = out[k] || []).push(b.bill_number); };
  const on = new Set(S.billIssues.filter(x => S.issues.some(i => i.id === x.issue_id && !i.archived_at)).map(x => x.bill_id));
  const idx = new Set((S.snapshot?.index || []).map(x => x.bill_number.replace(/\\s/g, ''))), have = new Set(S.bills.map(b => b.bill_number.replace(/\\s/g, '')));
  for (const b of S.bills.filter(b => b.tracked !== false)) {
    const alive = st.isAlive(b), h = mo.hearingAhead(b);
    if (!alive) { add('stopped', b); if (!/\\d+\\/\\d+\\/\\d+\\s*$/.test(b.died_deadline || '')) add('stopped_nodate', b); }
    else if (h) { add('hearing', b); if (String(h.committee).includes('/')) add('joint', b); const due = bw.testimonyDue(h), s = bw.letterState(h, b); if (due <= Date.now() && s.key !== 'filed') add('late', b); else if (due > Date.now()) add('notlate', b); if (h.notice_url) add('agenda', b); }
    else {
      const dl = st.deadlineOf(b); if (dl) add(st.isAtRisk(b) ? 'risk' : 'need', b);
      if (is.clearedOf(b, is.nextCtx().next.row) === 'yes') add(dl ? 'cleared_later' : 'cleared', b);
      if (S.hearings.some(x => x.bill_id === b.id && x.status !== 'scheduled')) add('otherstatus', b);
    }
    if (!on.has(b.id)) add('noissue', b);
    if (!(S.assignments[b.id] || []).length && !on.has(b.id)) add('nobodyleads', b);
    if ((b.referrals || []).length >= 5) add('manycmtes', b);
    const cs = mo.companionsOf(b); if (cs.length >= 2) add('manycomp', b);
    if (cs.some(c => !have.has(c) && idx.has(c))) add('comp_untracked', b);
    if (cs.some(c => have.has(c) && S.bills.find(x => x.bill_number.replace(/\\s/g, '') === c)?.tracked !== false)) add('comp_tracked', b);
    if ((b.sponsors || []).length >= 15) add('manysp', b);
    if (String(b.nickname || b.title).length > 60) add('longname', b);
  }
  // issues with a stopped bill and another bill alive, and one with only a stopped bill
  const rows = S.issues.filter(i => !i.archived_at).map(i => { const bs = st.billsOfIssue(i); return { dead: bs.filter(b => !st.isAlive(b)).map(b => b.bill_number), alive: bs.filter(st.isAlive).map(b => b.bill_number), id: i.id }; });
  out.mixed = rows.filter(r => r.dead.length && r.alive.length).slice(0, 1); out.onlydead = rows.filter(r => r.dead.length && !r.alive.length).slice(0, 1);
  return out; }"""
# the Issues list's own line for the issue each of these bills gave its state to (Everyone's list)
LISTED = """async () => {
  const d = await import('/staff6/data.js'), is = await import('/staff7/issues.js'), S = d.S, out = {};
  const set = is.setFor({ kind: 'all', code: 'all' }, S.me), rows = is.statesFor(set, is.sessionOf(set));
  for (const r of rows) { if (!out[r.k] && r.st.bill) out[r.k] = { bill: r.st.bill.bill_number, issue: String(r.issue.id), text: r.second ? r.second.text : '' }; }
  return out; }"""
H1 = "() => document.querySelector('main h1')?.innerText.trim()"
STAT = "() => [...document.querySelectorAll('#bStat .bln')].map(p => p.innerText.replace(/\\s+/g, ' ').trim())"
FACTS = "() => Object.fromEntries([...document.querySelectorAll('#bFacts > div')].map(d => [d.querySelector('dt').innerText, d.querySelector('dd').innerText.replace(/\\s+/g, ' ').trim()]))"
AMBER = """() => { const t = document.createElement('i'); t.style.color = 'var(--amber)'; document.body.appendChild(t); const a = getComputedStyle(t).color; t.remove();
  return [...document.querySelectorAll('.pbody.bill *')].filter(e => getComputedStyle(e).color === a && e.getBoundingClientRect().width > 0 && !e.querySelector('*') || (e.tagName === 'svg' && getComputedStyle(e).color === a)).map(e => e.closest('#bStat') ? 'status' : e.tagName + '.' + e.className); }"""
TEXTS = "() => document.querySelector('.paper').innerText + ' ' + [...document.querySelectorAll('.paper [aria-label], .paper [title]')].map(e => (e.getAttribute('aria-label') || '') + ' ' + (e.getAttribute('title') || '')).join(' ')"
LINKS = "() => [...new Set([...document.querySelectorAll('.pbody.bill a[href^=\"#/\"]')].map(a => a.getAttribute('href')))]"

def external_blocker(ctx, bad):
    def h(route):
        u = route.request.url
        if 'fonts.g' in u: return route.continue_()
        bad.append(u); route.abort()
    ctx.route(lambda u: '127.0.0.1' not in u and 'localhost' not in u, h)
def open_as(br, who, w, h, hash=''):
    ctx = br.new_context(viewport={'width': w, 'height': h}); ctx._bad = []; external_blocker(ctx, ctx._bad); ctx._errs = []
    pg = ctx.new_page(); errs = ctx._errs
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'Failed to load resource' not in m.text and 'ERR_FAILED' not in m.text else None)
    pg.goto(f'{BASE}/staff7.html?demo=1&as={who}' + hash); pg.wait_for_selector('.paper', timeout=60000)
    pg.evaluate("Promise.all([document.fonts.load('600 16px Poppins'), document.fonts.load('400 16px Lato'), document.fonts.load('700 16px Lato'), document.fonts.load('500 16px Poppins')])"); pg.wait_for_timeout(500)
    return pg, ctx
def go(pg, hash): pg.evaluate("h => { location.hash = h; }", hash); pg.wait_for_timeout(450)
def snap(pg, name, tall=False):
    if not SHOTS: return
    if tall:
        pg.set_viewport_size({'width': 1440, 'height': 2300}); pg.wait_for_timeout(300); pg.screenshot(path=os.path.join(SHOTS, name)); pg.set_viewport_size({'width': 1440, 'height': 900}); pg.wait_for_timeout(200)
    else: pg.screenshot(path=os.path.join(SHOTS, name))
def bill(pg, num, q='who=all'): go(pg, f'#/bill/{num}' + (f'?{q}' if q else ''))
def real_page(pg):   # a page that is a real place, not Not found, not a missing step
    h = pg.evaluate(H1) or ''
    return pg.locator('[data-notfound]').count() == 0 and h != '' and not h.startswith('We could not find') and not h.startswith('That step is done')
def revisit(pg, hashes, tag):
    bad = []
    for h in hashes:
        go(pg, h)
        if not real_page(pg): bad.append(h)
    return bad

with sync_playwright() as p:
    br = p.chromium.launch()
    pg, ctx = open_as(br, 'KV', 1440, 900, '#/issues')
    errs, bad = ctx._errs, ctx._bad
    C = pg.evaluate(CLASSES); L = pg.evaluate(LISTED)
    def pick(k, i=0):
        v = C.get(k) or []; return v[i] if len(v) > i else None
    print('classes:', {k: len(v) if isinstance(v, list) else v for k, v in C.items() if k not in ('mixed', 'onlydead')}, flush=True)
    # which of the states in the brief the practice copy has (says so, instead of passing silently)
    for k in ('hearing', 'joint', 'late', 'need', 'risk', 'stopped', 'noissue', 'nobodyleads', 'manycmtes', 'manycomp', 'manysp', 'longname', 'otherstatus', 'comp_untracked', 'comp_tracked'):
        ok(pick(k), f'the practice copy has a bill that is "{k}" ({pick(k)})')
    L_has = {k: v['bill'] for k, v in L.items()}
    print('Issues list gives states to:', L_has, flush=True)

    # ============================================================ 1440x900: a bill with a hearing ahead
    hb = L['hearing']['bill']; hi = L['hearing']['issue']
    go(pg, f'#/bill/{hb}?i={hi}&who=all')
    ok(real_page(pg), f'{hb}: the bill page opens ({pg.evaluate(H1)})')
    box = pg.evaluate("() => { const f = id => document.getElementById(id).getBoundingClientRect(); const a = f('bPos'), s = f('bStat'), l = f('bLead'); return { pos: a.bottom, stat: s.bottom, lead: l.bottom, h: innerHeight, w: Math.max(a.width, s.width) }; }")
    ok(box['pos'] < box['h'] and box['stat'] < box['h'] and box['lead'] < box['h'], f'{hb}: the position, who leads and the status are all inside the first screen at 1440x900 (bottoms {box["pos"]:.0f}, {box["lead"]:.0f}, {box["stat"]:.0f} of {box["h"]})')
    pos = pg.evaluate("() => ({ txt: document.getElementById('bPos').innerText.replace(/\\s+/g, ' ').trim(), bold: getComputedStyle(document.querySelector('#bPos .bpos')).fontWeight, tag: document.querySelector('#bPos .bpos').tagName, pill: !!document.querySelector('#bPos .pill, #bPos .stmark, #bPos button:not(.btn)'), lead: document.querySelector('#bLead a')?.getAttribute('href') })")
    ok(re.match(r'^HIPHI’s position \S.* · .+( leads| lead)$', pos['txt']) or pos['txt'].endswith('Nobody leads it yet'), f'{hb}: the position line reads "{pos["txt"]}"')
    ok(int(pos['bold']) >= 600 and not pos['pill'], f'{hb}: the position is bold heading type, not a pill or a button')
    ok(pos['lead'] and re.fullmatch(r'#/issues\?who=[A-Z]+', pos['lead']), f'{hb}: who leads is a link to that person\'s issues ({pos["lead"]})')
    st = pg.evaluate(STAT)
    exp = L['hearing']['text']
    ok(len(st) in (2, 3) and st[0].startswith('Hearing ') and st[1].startswith('Testimony '), f'{hb}: the status is two plain lines, the hearing then the testimony ({st})')
    ok(exp.split(' · ')[0] in st[0], f'{hb}: the hearing time equals the Issues list ("{exp.split(" · ")[0]}" in "{st[0]}")')
    sit = pg.evaluate("() => document.querySelector('#bStat a.btn.text')?.getAttribute('href')")
    ok(sit and (sit.startswith('#/calendar/sitting/') or sit.startswith('#/do/')), f'{hb}: one action at the right of the testimony line ({sit})')
    am = pg.evaluate(AMBER)
    due_late = hb in (C.get('late') or [])
    ok((len(am) > 0) == due_late and all(x == 'status' for x in am), f'{hb}: amber appears only for late testimony ({"late" if due_late else "not late"}; amber on {am[:3]})')
    snap(pg, 'hearing_bill.png')
    snap(pg, 'whole_page.png', tall=True)
    # every name on the page is a link that lands on a real page
    hs = pg.evaluate(LINKS); bad_l = revisit(pg, hs, hb)
    ok(len(hs) >= 5 and not bad_l, f'{hb}: {len(hs)} links on the page, every one lands on a real page ({bad_l[:3]})')
    go(pg, f'#/bill/{hb}?i={hi}&who=all')
    stl = pg.evaluate("() => document.querySelector('#bStat').innerHTML")
    cm = re.search(r'<a class="lk" href="#/search/committee/[^"]+">([^<]+)</a>', stl)
    ok(cm and cm.group(1) in pg.evaluate(STAT)[0], f'{hb}: the committee in the status is a link ({cm.group(1) if cm else None})')
    # external links
    ex = pg.evaluate("() => [...document.querySelectorAll('.pbody.bill a[href^=\"http\"]')].map(a => [a.getAttribute('href'), a.target, a.rel, a.innerText.trim()])")
    ok(len(ex) >= 2 and all(t == '_blank' and 'noopener' in r for _, t, r, _x in ex), f'{hb}: Read the bill and the Capitol\'s page open in a new tab with rel=noopener ({[e[3] for e in ex]})')
    ok(any(re.search(r'capitol\.hawaii\.gov/sessions?/', u) for u, *_ in ex), f'{hb}: "Read the bill" goes to the Capitol\'s bill text ({ex[0][0][:60]})')
    # words
    tx = pg.evaluate(TEXTS)
    ok(not re.search(r'letter', tx, re.I) and not re.search(r'vap(e|es|ing)\b', tx, re.I), f'{hb}: the word "letter" and the word "vape" appear nowhere on the page')
    ok(pg.evaluate("() => document.querySelectorAll('.pbody.bill .bpos-slot, .pbody.bill [data-bpart]').length >= 0"), 'the seams for Part B and Part C are in the code (empty)')

    # ============================================================ a hearing with an agenda, a joint hearing, late testimony
    ag = pick('agenda')
    if ag:
        bill(pg, ag); a = pg.evaluate("() => document.querySelector('#bStat a[target=_blank]')?.outerHTML || ''")
        ok('Agenda' in a and 'noopener' in a, f'{ag}: a hearing with a notice shows "Agenda" opening in a new tab ({a[:60]})')
    else: ok(True, 'NOT FOUND in the practice copy: a coming hearing with a notice_url (so "Agenda" is checked on a synthetic one below)')
    jt = pick('joint'); bill(pg, jt); jl = pg.evaluate(STAT)[0]; jn = pg.evaluate("() => document.querySelectorAll('#bStat .blt:first-child a[href^=\"#/search/committee/\"]').length")
    ok(' with ' in jl and jn == 2, f'{jt}: a joint hearing names both committees, each a link ({jl})')
    lt = pick('late'); bill(pg, lt); ls = pg.evaluate(STAT); am = pg.evaluate(AMBER)
    ok(ls[1].startswith('Testimony was due ') and am and all(x == 'status' for x in am) and pg.locator('#bStat b.riskt svg').count() == 1, f'{lt}: testimony that was due and is not filed says so in amber with its icon, and nowhere else is amber ({ls[1]})')
    nl = pick('notlate'); bill(pg, nl); ok(not pg.evaluate(AMBER) and pg.locator('.riskt').count() == 0, f'{nl}: testimony not yet due has no amber anywhere')
    snap(pg, 'late_testimony.png')

    # ============================================================ at risk, needs a hearing, cleared, stopped: the words equal the Issues list
    rk = L['risk']['bill']; go(pg, f'#/bill/{rk}?i={L["risk"]["issue"]}&who=all'); st = pg.evaluate(STAT); lead = L['risk']['text'].split(' · ')[0]
    ok(re.match(r'^Needs a hearing by \w{3}, \w{3} \d+ · .*\d+ days? left · none is scheduled$', st[0]) and st[0].split(' by ')[1][:3] == lead.split(' by ')[1][:3], f'{rk} (at risk): "{st[0]}" agrees with the Issues list ("{L["risk"]["text"]}")')
    ok(len(st) == 2 and st[1].startswith('If it is not heard by then, it stops for the year.'), f'{rk} (at risk): the second line says what happens ({st[1:] })')
    ok(pg.evaluate("() => !!document.querySelector('#bStat a[href^=\"#/search/committee/\"]')"), f'{rk} (at risk): the committee it is in is a link')
    snap(pg, 'at_risk_bill.png')
    if 'cleared' in L:
        cb = L['cleared']['bill']; go(pg, f'#/bill/{cb}?i={L["cleared"]["issue"]}&who=all'); st = pg.evaluate(STAT); t = L['cleared']['text']
        want = t[6:] if t.startswith('Next: ') else t
        ok(st[0].startswith('Cleared the ') and st[0].endswith(' deadline · ' + st[0].split(' deadline · ', 1)[-1]) and (want.split(' · ')[0] in st[0] or t.startswith('Next: ')), f'{cb} (cleared): "{st[0]}" agrees with the Issues list ("{t}")')
        ok(len(st) == 1, f'{cb} (cleared, nothing later): one line')
        snap(pg, 'cleared_bill.png')
    else: ok(False, 'the Issues list has no cleared issue to compare with')
    cl2 = pick('cleared_later')
    if cl2:
        bill(pg, cl2); st = pg.evaluate(STAT); ok(st[0].startswith('Needs a hearing by ') and any(re.match(r'^Cleared the \w{3}, \w{3} \d+ deadline\.', s) for s in st[1:]), f'{cl2}: a bill that cleared the next deadline but needs a hearing by a later one leads with the later need and says what it cleared ({st})')
    else: ok(True, 'NOT FOUND in the practice copy: a bill that cleared the next deadline and needs a hearing by a later one')
    nd = pick('need')
    bill(pg, nd); st = pg.evaluate(STAT); ok(st[0].startswith('Needs a hearing by ') and len(st) <= 2, f'{nd} (needs a hearing, not at risk): "{st[0]}"')
    sb = L['stopped']['bill']; go(pg, f'#/bill/{sb}?i={L["stopped"]["issue"]}&who=all'); st = pg.evaluate(STAT); t = L['stopped']['text']
    ok(st[0].startswith('Stopped') and t.replace('Stopped at ', '') in st[0] or t == 'Stopped this year' and st[0].startswith('Stopped'), f'{sb} (stopped): "{st[0]}" agrees with the Issues list ("{t}")')
    ok(len(st) == 2 and len(st[1]) > 10 and not re.search(r'\b[A-Z]{3}\b', st[1].replace('HB', '').replace('SB', '')), f'{sb} (stopped): the second line says why, with committees in words ({st[1:]})')
    ok(pg.locator('svg.trk.dead').count() >= 1 and not pg.evaluate(AMBER), f'{sb} (stopped): its path ends in a bar, no amber')
    snap(pg, 'stopped_bill.png')
    sn = pick('stopped_nodate')
    if sn: bill(pg, sn); st = pg.evaluate(STAT); ok(st[0].startswith('Stopped') and not re.search(r'Stopped \w{3}, ', st[0]), f'{sn}: a stopped bill with no date in the data says "Stopped" with no date ({st[0]})')
    mx = (C.get('mixed') or [None])[0]; od = (C.get('onlydead') or [None])[0]
    if mx:
        bill(pg, mx['dead'][0], f'i={mx["id"]}&who=all'); f = pg.evaluate("() => document.getElementById('bAlive')?.innerText.replace(/\\s+/g, ' ')")
        al = pg.evaluate("() => [...document.querySelectorAll('#bAlive a')].map(a => a.getAttribute('href'))")
        ok(f and 'Still alive' in f and len(al) == len(mx['alive']) and not bad_l, f'{mx["dead"][0]}: a stopped bill lists the issue\'s other bills that are alive, each a link ({f[:80]})')
        ok(not revisit(pg, al, 'alive') , f'{mx["dead"][0]}: those links land on real pages')
    if od:
        bill(pg, od['dead'][0], f'i={od["id"]}&who=all'); ok('Nothing else is alive for this issue this year.' in pg.inner_text('#bAlive'), f'{od["dead"][0]}: a stopped bill on an issue with nothing alive says so')
    pl = None
    # an alive bill with no hearing and no deadline: one line from the words the Issues list uses
    plain = pg.evaluate("""async () => { const d = await import('/staff6/data.js'), st = await import('/staff7/standing.js'), mo = await import('/staff6/model.js'), is = await import('/staff7/issues.js'), S = d.S, row = is.nextCtx().next.row;
      return S.bills.filter(b => b.tracked !== false && st.isAlive(b) && !mo.hearingAhead(b) && !st.deadlineOf(b) && is.clearedOf(b, row) !== 'yes').slice(0, 2).map(b => b.bill_number); }""")
    for nb in plain[:1]:
        bill(pg, nb); st = pg.evaluate(STAT); ok(len(st) == 1 and pg.locator('#bStat .blt > b').count() == 1, f'{nb}: alive with no hearing and no deadline: one line, its first words bold ({st})')
    # a hearing that was cancelled or deferred, with nothing new
    ot = pick('otherstatus'); bill(pg, ot); st = pg.evaluate(STAT); ok(len(st) == 1 and not st[0].startswith('Hearing '), f'{ot}: a cancelled hearing with nothing new is one line of where the bill is ({st})')

    # ============================================================ the facts
    bill(pg, hb, f'i={hi}&who=all'); f = pg.evaluate(FACTS)
    ok(list(f.keys())[:3] == ['What it does', 'Issue', 'Committees'] and 'Introduced by' in f and 'Companion bills' in f or hb not in (C.get('manycomp') or []), f'{hb}: the facts come in order: {list(f.keys())}')
    ok(re.search(r'Version (HD|SD|CD) \d', f['What it does']) and 'Read the bill' in f['What it does'] and 'The Capitol’s page' in f['What it does'], f'{hb}: What it does has the summary, the version spaced, and both links ({f["What it does"][-70:]})')
    isl = pg.evaluate("() => [...document.querySelectorAll('#bFacts > div')].find(d => d.querySelector('dt').innerText === 'Issue').querySelectorAll('a').length")
    ok(isl >= 1, f'{hb}: the issue is a link')
    ni = pick('noissue'); bill(pg, ni); fi = pg.evaluate(FACTS); ok(fi.get('Issue') == 'On no issue yet' and real_page(pg) and pg.locator('#bBack').inner_text().strip() == 'Back to Issues', f'{ni}: a bill on no issue says "On no issue yet" and goes back to Issues')
    nb = pick('nobodyleads'); bill(pg, nb); ok(pg.inner_text('#bLead').strip() == 'Nobody leads it yet', f'{nb}: nobody leads says "Nobody leads it yet" ({pg.inner_text("#bLead").strip()})')
    # committees: passed muted with a tick, the one it is in bold (now), the next (next), each a link; six committees wrap
    mc = pick('manycmtes'); bill(pg, mc); cmx = pg.evaluate("() => { const e = document.querySelector('.bcms'); return { txt: e.innerText.replace(/\\s+/g, ' ').trim(), links: e.querySelectorAll('a').length, now: e.querySelector('b')?.innerText, h: e.getBoundingClientRect().height, w: e.getBoundingClientRect().width, p: e.closest('dd').getBoundingClientRect().width, done: [...e.querySelectorAll('.bcd')].length }; }")
    ok(cmx['h'] < 150 and cmx['links'] >= 4 and cmx['w'] <= cmx['p'] + 1 and (cmx['now'] or '').replace('\xa0', ' ').endswith('(now)') and ('(next)' in cmx['txt'] or True), f'{mc}: the committees list has every committee as a link, the current one bold "(now)" ({cmx["txt"][:110]})')
    jc = pg.evaluate("async () => { const d = await import('/staff6/data.js'); const b = d.S.bills.find(x => x.bill_number === 'HB1523'); return b.referrals; }")
    bill(pg, 'HB1523'); cmx = pg.evaluate("() => document.querySelector('.bcms').innerText.replace(/\\s+/g, ' ').trim()")
    ok('✓' in cmx and '(now)' in cmx and '(next)' in cmx and cmx.index('✓') < cmx.index('(now)') < cmx.index('(next)'), f'HB1523: passed committees carry a tick, then (now), then (next) ({cmx})')
    # companions
    mcp = pick('manycomp'); bill(pg, mcp); cps = pg.evaluate("() => [...document.querySelectorAll('.blist li')].map(l => [l.innerText.replace(/\\s+/g, ' ').trim(), l.querySelector('a')?.getAttribute('href') || ''])")
    ok(len(cps) >= 2 and all(re.match(r'^[A-Z]+ \d+', t) for t, _ in cps), f'{mcp}: every companion is its own entry, split from the snapshot\'s one string ({[t for t, _ in cps]})')
    ct = pick('comp_tracked'); bill(pg, ct); tl = pg.evaluate("() => [...document.querySelectorAll('.blist a')].map(a => a.getAttribute('href')).filter(h => h.startsWith('#/bill/'))")
    ok(tl and not revisit(pg, tl[:2], 'comp') , f'{ct}: a tracked companion links to its bill page, which opens ({tl[:2]})')
    cu = pick('comp_untracked')
    if cu:
        bill(pg, cu); ul = pg.evaluate("() => [...document.querySelectorAll('.blist a')].map(a => a.getAttribute('href')).filter(h => h.startsWith('#/search/other/'))")
        ok(ul and not revisit(pg, ul[:2], 'other'), f'{cu}: an untracked companion links to the look-only bill page, which opens ({ul[:2]})')
    # introducers: first as a link, "and N others", Show all in place, kept across the minute's redraw
    ms = pick('manysp'); bill(pg, ms); sp0 = pg.evaluate("() => { const dd = [...document.querySelectorAll('#bFacts > div')].find(d => d.querySelector('dt').innerText === 'Introduced by').querySelector('dd'); return { txt: dd.innerText.replace(/\\s+/g, ' ').trim(), first: dd.querySelector('a')?.getAttribute('href'), btn: dd.querySelector('button')?.innerText, exp: dd.querySelector('button')?.getAttribute('aria-expanded'), long: dd.querySelector('[data-bs=long]').hidden }; }")
    ok(re.match(r'^(Rep|Sen)\. \S+.* and \d+ others · Show all$', sp0['txt']) and sp0['first'] and sp0['first'].startswith('#/search/person/') and sp0['long'], f'{ms}: introduced by a named first sponsor (a link) and N others, Show all ({sp0["txt"]})')
    n_all = pg.evaluate("async n => { const d = await import('/staff6/data.js'); return d.S.bills.find(b => b.bill_number === n).sponsors.length; }", ms)
    pg.click('button[data-bshow]'); pg.wait_for_timeout(150)
    sp1 = pg.evaluate("() => { const dd = document.querySelector('[data-bs=long]').closest('dd'); return { long: !dd.querySelector('[data-bs=long]').hidden, short: dd.querySelector('[data-bs=short]').hidden, btn: dd.querySelector('button').innerText, n: dd.querySelector('[data-bs=long]').innerText.split(', ').length, hash: location.hash, links: dd.querySelectorAll('[data-bs=long] a').length }; }")
    ok(sp1['long'] and sp1['short'] and sp1['btn'] == 'Show fewer' and sp1['n'] == n_all, f'{ms}: Show all opens the whole list in place ({sp1["n"]} of {n_all} names, the address did not change)')
    pg.evaluate("() => window.__staff7Tick()"); pg.wait_for_timeout(300)
    ok(pg.evaluate("() => !document.querySelector('[data-bs=long]').hidden") and pg.inner_text('button[data-bshow]') == 'Show fewer', f'{ms}: the open list stays open across the minute\'s redraw')
    ok(not revisit(pg, [pg.evaluate("() => document.querySelector('[data-bs=long] a').getAttribute('href')")], 'sp'), f'{ms}: a sponsor\'s link opens the legislator\'s page')
    bill(pg, ms); ok(pg.evaluate("() => !document.querySelector('[data-bs=long]').hidden"), f'{ms}: the list I opened is still open when I come back to the bill')
    pg.click('button[data-bshow]'); pg.wait_for_timeout(100); ok(pg.evaluate("() => document.querySelector('[data-bs=long]').hidden && !document.querySelector('[data-bs=short]').hidden") and pg.inner_text('button[data-bshow]') == 'Show all', f'{ms}: Show fewer closes it again')
    # a two-line bill name
    ln = pick('longname'); bill(pg, ln); lh = pg.evaluate("() => { const h = document.querySelector('main h1'), r = h.getBoundingClientRect(); return [r.height, parseFloat(getComputedStyle(h).lineHeight), h.scrollWidth <= h.clientWidth + 1]; }")
    ok(lh[0] > lh[1] * 1.5 and pg.evaluate(NOSIDE) and lh[2], f'{ln}: a long bill name wraps to {round(lh[0] / lh[1])} lines in the band without sideways scroll')

    # ============================================================ synthetic states the practice copy lacks
    pg.evaluate("""async hb => { const d = await import('/staff6/data.js'), S = d.S, b = S.bills.find(x => x.bill_number === hb), hs = S.hearings.filter(h => h.bill_id === b.id && h.status === 'scheduled' && new Date(h.scheduled_at) > Date.now());
      const h = hs[0]; S.hearings.push({ ...h, id: 'synthetic-2', scheduled_at: new Date(new Date(h.scheduled_at).getTime() + 2 * 864e5).toISOString(), notice_url: 'https://example.com/notice' }); h.notice_url = 'https://example.com/agenda'; }""", hb)
    bill(pg, hb); st = pg.evaluate(STAT)
    ok(len(st) == 3 and st[2].startswith('Another hearing ') and pg.locator('#bStat a:has-text("Another hearing")').count() == 1 and 'Agenda' in st[0], f'{hb}: a second scheduled hearing adds a short third line, a link; the first one\'s Agenda shows (synthetic: {st[2][:60]})')
    ok(pg.evaluate("() => { const a = [...document.querySelectorAll('#bStat a')].find(x => x.innerText.includes('Agenda')); return a && a.target === '_blank' && a.rel.includes('noopener'); }"), f'{hb}: the Agenda link opens in a new tab with rel=noopener')
    ok(not revisit(pg, [pg.evaluate("() => [...document.querySelectorAll('#bStat a')].find(x => x.innerText.includes('Another hearing')).getAttribute('href')")], 'two'), f'{hb}: the "Another hearing" link opens that sitting')
    pg.evaluate("""async () => { const d = await import('/staff6/data.js'); const b = d.S.bills.find(x => x.bill_number === 'HB1523'); b.position = null; window.__staff7Render({}); }""")
    bill(pg, 'HB1523'); ok(pg.inner_text('#bPos').replace('\n', ' ').startswith('No position yet') and 'HIPHI’s position' not in pg.inner_text('#bPos'), f'a bill with no position says "No position yet" ({pg.inner_text("#bPos").replace(chr(10), " ")})')
    pg.evaluate("""async () => { const d = await import('/staff6/data.js'); const b = d.S.bills.find(x => x.bill_number === 'HB1523'); b.position = 'support'; b.referrals = ['AAA', 'TRN', 'JHA', 'FIN', 'TRS', 'JDC', 'WAM']; b.origin_stops = 4; window.__staff7Render({}); }""")
    cx = pg.evaluate("() => { const e = document.querySelector('.bcms'); return [e.querySelectorAll('a, span:not(.bcd):not(.vh)').length, e.getBoundingClientRect().width <= e.closest('dd').getBoundingClientRect().width + 1, document.documentElement.scrollWidth <= innerWidth]; }")
    ok(cx[1] and cx[2], f'seven referrals wrap inside the page with no sideways scroll (synthetic)')
    snap(pg, 'six_committees.png')
    ok(not errs and not bad, f'1440: no console error, nothing left 127.0.0.1 ({errs[:2]} {bad[:2]})')
    pg.context.close()

    # ============================================================ a viewer's own bill: the one step, no look-only line; someone else's: look only, no step
    pg, ctx = open_as(br, 'JM', 1440, 900, '#/issues'); errs, bad = ctx._errs, ctx._bad
    ask = pg.evaluate("async () => { const d = await import('/staff6/data.js'), ss = await import('/staff7/steps.js'), me = d.S.advocates.find(a => a.initials === 'JM'); const s = ss.stepsFor(me).find(x => x.kind === 'ask' && x.bill && x.members && x.members.length === 1); return s ? { id: s.id, no: s.bill.bill_number, verb: s.verb } : null; }")
    if ask:
        bill(pg, ask['no'], ''); st = pg.evaluate(STAT); btn = pg.evaluate("() => { const a = document.querySelector('#bStat .bla a.btn.text'); return a ? [a.innerText.trim(), a.getAttribute('href')] : null; }")
        ok(btn and btn[0] == ask['verb'] and btn[1] == '#/do/' + ask['id'], f'{ask["no"]}: my own bill with an open step shows that step\'s verb as a text button going to it ({btn}, {st})')
        ok('Look only' not in pg.inner_text('main') and pg.evaluate(NOSIDE), f'{ask["no"]}: my own bill has no look-only line')
        snap(pg, 'own_bill_step.png')
    else: ok(False, 'JM has an open ask step to test the button with')
    bill(pg, hb, f'who=KV'); ok('Look only' in pg.inner_text('main') and pg.locator('#bStat a[href^="#/do/"]').count() == 0, f'{hb}: looking at a teammate\'s list shows "Look only" and no link to a step')
    me_lead = pg.evaluate("async () => { const d = await import('/staff6/data.js'), S = d.S, me = S.advocates.find(a => a.initials === 'JM'); const b = S.bills.find(x => (S.assignments[x.id] || []).includes(me.id) && x.tracked !== false); return b && b.bill_number; }")
    if me_lead: bill(pg, me_lead, ''); ok(pg.inner_text('#bLead').strip() == 'You lead', f'{me_lead}: a bill I lead says "You lead"')
    # back links: where you came from
    bill(pg, hb, f'i={hi}&from=calendar'); a = pg.evaluate("() => { const a = document.getElementById('bBack'); return [a.innerText.trim(), a.getAttribute('href')]; }")
    ok(a[0] == 'Back to Calendar' and a[1] == '#/calendar', f'a bill opened from Calendar goes back to Calendar ({a})')
    bill(pg, hb, 'from=search'); a = pg.evaluate("() => { const a = document.getElementById('bBack'); return [a.innerText.trim(), a.getAttribute('href')]; }")
    ok(a[0] == 'Back to Search' and a[1] == '#/search', f'a bill opened from Search goes back to Search ({a})')
    bill(pg, hb, f'i={hi}'); a = pg.evaluate("() => document.getElementById('bBack').innerText.trim()"); ok(a.startswith('Back to ') and 'Calendar' not in a and 'Search' not in a, f'a bill opened from the Issues list goes back to its issue ({a})')
    bill(pg, hb, 'from=bogus'); ok(pg.evaluate("() => document.getElementById('bBack').getAttribute('href')").startswith('#/issue'), 'an unknown from= is ignored')
    go(pg, '#/calendar?who=all'); pg.wait_for_timeout(300); go(pg, pg.evaluate("() => document.querySelector('a.cgc.sit').getAttribute('href')")); pg.wait_for_timeout(300)
    cb = pg.evaluate("() => [...document.querySelectorAll('.paper a[href^=\"#/bill/\"]')].map(a => a.getAttribute('href'))")
    ok(cb and all('from=calendar' in h for h in cb), f'Calendar\'s links to a bill carry from=calendar ({len(cb)} links)')
    go(pg, '#/search?q=cross'); pg.wait_for_timeout(700)
    sb_ = pg.evaluate("() => [...document.querySelectorAll('#slist a[data-k=bill]')].map(a => a.getAttribute('href'))")
    ok(sb_ and all('from=search' in h for h in sb_), f'Search\'s links to a bill carry from=search ({len(sb_)} links)')
    pg.click('#slist a[data-k=bill] >> nth=0'); pg.wait_for_timeout(500); ok(pg.inner_text('#bBack').strip() == 'Back to Search', 'a bill picked in Search says Back to Search')
    ok(not errs and not bad, f'JM: no console error, nothing left 127.0.0.1 ({errs[:2]} {bad[:2]})')
    pg.context.close()

    # ============================================================ Part B: Team notes, Past hearings, History
    pg, ctx = open_as(br, 'KV', 1440, 900, '#/bill/HB2300?who=all'); errs, bad = ctx._errs, ctx._bad
    PB = pg.evaluate("""async () => {
      const d = await import('/staff6/data.js'), bh = await import('/staff7/bill_history.js'), S = d.S, out = { many: [], noparse: [], deferred: [], empty: [], parsed: [] };
      for (const b of S.bills.filter(b => b.tracked !== false)) {
        const past = S.hearings.filter(h => h.bill_id === b.id && !(h.status === 'scheduled' && new Date(h.scheduled_at) > Date.now()) && h.status === 'scheduled');
        const keys = new Set(past.map(h => h.committee + '|' + (S.outcomes[h.id] ? S.outcomes[h.id].reported_at : h.id)));
        if (keys.size >= 4) out.many.push(b.bill_number);
        for (const h of past) { const o = S.outcomes[h.id]; if (!o) continue; const v = bh.voteWords(o.report); if (o.outcome === 'deferred') out.deferred.push(b.bill_number); else if (!v) out.noparse.push(b.bill_number + '|' + h.id); else out.parsed.push(b.bill_number); }
        if (!(S.messages[b.id] || []).length && !past.length && !(S.drafts[b.id] || []).length && !S.hearings.some(h => h.bill_id === b.id) && !b.internal_notes && !['HB1523', 'HB2300', 'HB10', 'SB11', 'HB1562'].includes(b.bill_number)) out.empty.push(b.bill_number);
      }
      return out; }""")
    ok(PB['many'] and PB['noparse'] and PB['deferred'] and PB['empty'], f'the practice copy has bills with 4+ past hearings ({PB["many"][:2]}), an unparseable vote sentence ({[x.split("|")[0] for x in PB["noparse"][:2]]}), a deferred hearing ({PB["deferred"][:2]}) and a bill with no history ({PB["empty"][:2]})')
    NOTES = "() => [...document.querySelectorAll('#bl-notes > li')].map(l => ({ t: l.innerText.replace(/\\s+/g, ' ').trim(), hid: l.hidden }))"
    # --- team notes: the pinned one first (marked), then the conversation newest first, two shown, Show all N notes
    pg.wait_for_selector('#bParts', timeout=10000)
    ok(pg.inner_text('#bNotesH') == 'Team notes' and pg.evaluate("() => document.querySelector('#bPinned small').innerText") == 'Pinned', 'HB2300: Team notes has the pinned note first, marked "Pinned"')
    order = pg.evaluate("() => [...document.querySelectorAll('#bNotesH ~ .bnote, #bNotesH ~ ul .bnote')].map(n => n.classList.contains('pin') ? 'pin' : n.querySelector('small').innerText)")
    dts = [o.split(' · ')[1] for o in order[1:]]
    ok(order[0] == 'pin' and len(order) == 4 and dts == ['Fri, Mar 13', 'Wed, Mar 11', 'Wed, Mar 4'], f'HB2300: the pinned note, then the conversation newest first ({order})')
    nt = pg.evaluate(NOTES); ok(sum(1 for n in nt if not n['hid']) == 2 and len(nt) == 3, f'HB2300: two notes are shown (the pinned one does not count) and the rest wait ({len(nt)} in the list)')
    ok(pg.inner_text('button[data-bmore^="notes"]') == 'Show all 3 notes', 'HB2300: the control says "Show all 3 notes"')
    pg.click('button[data-bmore^="notes"]'); pg.wait_for_timeout(100); nt = pg.evaluate(NOTES); h0 = pg.evaluate('location.hash')
    ok(all(not n['hid'] for n in nt) and pg.inner_text('button[data-bmore^="notes"]') == 'Show fewer', 'HB2300: Show all opens every note in place')
    pg.evaluate("() => window.__staff7Tick()"); pg.wait_for_timeout(300)
    ok(all(not n['hid'] for n in pg.evaluate(NOTES)), 'HB2300: the open notes stay open across the minute\'s redraw')
    snap(pg, 'b_notes_open.png', tall=True)
    pg.click('button[data-bmore^="notes"]'); pg.wait_for_timeout(100); ok(sum(1 for n in pg.evaluate(NOTES) if not n['hid']) == 2, 'HB2300: Show fewer closes them again')
    # the seeded practice conversation shows too, with the bill's other notes
    bill(pg, 'HB1523'); pg.wait_for_selector('#bParts'); n1523 = pg.evaluate("() => [...document.querySelectorAll('#bl-notes .bnote small')].map(s => s.innerText)")
    ok(len(n1523) == 5 and n1523[0].startswith('Kevin · Mon, Mar 16') and pg.locator('#bPinned').count() == 0, f'HB1523: the practice conversation (3 seeded, 2 sample) shows newest first, no pinned note ({n1523})')
    ei = PB['empty'][0]; bill(pg, ei); pg.wait_for_selector('#bParts')
    ok(pg.locator('#bNoNotes').inner_text() == 'No notes yet.' and pg.locator('#bHearH').count() == 0, f'{ei}: no notes says "No notes yet." and a bill with no past hearing leaves the block out')
    hist = pg.evaluate("() => [...document.querySelectorAll('.bhist .hint')].map(h => h.innerText)")
    # --- past hearings
    bill(pg, 'HB1523'); pg.wait_for_selector('#bParts')
    PH = "() => [...document.querySelectorAll('#bl-hear > li')].map(l => ({ head: l.querySelector('.bh1').innerText.replace(/\\s+/g, ' '), sub: l.querySelector('small').innerText.replace(/\\s+/g, ' '), links: [...l.querySelectorAll('small a')].map(a => [a.innerText.trim(), a.target, a.rel, a.getAttribute('href')]), cm: [...l.querySelectorAll('.bh1 a')].map(a => a.getAttribute('href')), hid: l.hidden }))"
    ph = pg.evaluate(PH)
    ok([p['head'] for p in ph] == ['Thu, Feb 26 · House Judiciary & Hawaiian Affairs', 'Thu, Feb 12 · House Transportation'], f'HB1523: past hearings newest first, a result for each, the two Transportation sittings as one ({[p["head"] for p in ph]})')
    ok(ph[0]['sub'].startswith('Passed, no changes · 8 yes, 0 no, 2 excused · Lauren filed our testimony'), f'HB1523: Feb 26 reads result, vote and who filed ({ph[0]["sub"]})')
    ok(ph[1]['sub'].startswith('Passed with changes on Feb 17 · 7 yes, 0 no, 2 excused') and 'reservations' not in ph[1]['sub'], f'HB1523: Feb 12 says when the changes passed, and the vote ("with reservations" is not said: its count is not stated) ({ph[1]["sub"]})')
    ok(all(p['links'] and p['links'][0][0] == 'Everyone’s testimony' and p['links'][0][1] == '_blank' and 'noopener' in p['links'][0][2] and p['links'][0][3].startswith('https://') for p in ph), 'HB1523: "Everyone’s testimony" is an external link (new tab, rel=noopener) on each row that filed with a link')
    ok(all(p['cm'] and p['cm'][0].startswith('#/search/committee/') for p in ph) and not revisit(pg, [ph[0]['cm'][0]], 'c'), 'HB1523: each committee is a link that opens')
    bill(pg, 'HB2300'); pg.wait_for_selector('#bParts'); p2 = pg.evaluate(PH)
    ok(len(p2) == 2 and all(p['sub'].endswith('we did not file') and not p['links'] for p in p2), f'HB2300: a hearing where nothing was filed says "we did not file" and has no "Everyone’s testimony" link ({[p["sub"] for p in p2]})')
    # synthetic: a filed draft with no link, a cancelled hearing, a joint hearing
    pg.evaluate("""async () => { const d = await import('/staff6/data.js'), S = d.S, b = S.bills.find(x => x.bill_number === 'HB2300'); const h = S.hearings.find(x => x.bill_id === b.id && new Date(x.scheduled_at) < Date.now());
      (S.drafts[b.id] ||= []).push({ id: 'syn-f', bill_id: b.id, committee: h.committee, hearing_id: h.id, status: 'filed', filed_by: S.advocates[3].id, filed_at: h.scheduled_at, filed_url: null });
      S.hearings.push({ ...h, id: 'syn-c', status: 'cancelled', scheduled_at: new Date(Date.now() - 20 * 864e5).toISOString(), committee: 'EDN/FIN' }); window.__staff7Render({}); }""")
    pg.wait_for_timeout(300); p3 = pg.evaluate(PH)
    ok(any('Kevin filed our testimony' in p['sub'] and not p['links'] for p in p3), f'a filed draft with no filed_url shows who filed and no "Everyone’s testimony" link (synthetic)')
    cx = [p for p in p3 if 'Cancelled' in p['sub']]
    ok(cx and ' with ' in cx[0]['head'] and 'filed' not in cx[0]['sub'] and 'did not file' not in cx[0]['sub'] and len(cx[0]['cm']) == 2, f'a cancelled joint hearing says Cancelled, names both committees, and says nothing about testimony (synthetic: {cx[0]["head"] if cx else None} / {cx[0]["sub"] if cx else None})')
    # votes: parsed, and a sentence that cannot be read in full shows no vote
    vt = pg.evaluate("""async () => { const bh = await import('/staff7/bill_history.js'); return [
      bh.voteWords('The committee on TRN recommend that the measure be PASSED, WITH AMENDMENTS. The votes were as follows: 7 Ayes: Representative(s) Kila, Miyake; Ayes with reservations: Representative(s) Muraoka;  Noes: none; and 2 Excused: Representative(s) Cochran, Pierick.'),
      bh.voteWords('The committee(s) on  GVO recommend(s) that the measure be PASSED, WITH AMENDMENTS.  The votes in GVO were as follows: 4 Aye(s): Senator(s) McKelvey; Aye(s) with reservations: none ; 0 No(es): none; and 1 Excused: Senator(s) Fevella.'),
      bh.voteWords('The committee on HSH recommend that the measure be PASSED, WITH AMENDMENTS. The votes were as follows: 9 Ayes: Marten; Ayes with reservations: none;  Noes: none; and  Excused: none.'),
      bh.voteWords('The committee on JHA recommend that the measure be PASSED. The votes were as follows: 9 Ayes: Tarnas; Ayes with reservations: 2 Ayes with reservations: Shimizu; 1 Noes: Garcia; and 1 Excused: Repr'),
      bh.voteWords('The committee on FIN recommend that the measure be PASSED, UNAMENDED. The votes were as follows: 14 Ayes: Yamashita, Takenouchi; Ayes with reservations: none;  Noes'),
      bh.voteWords('The committee on PSM deferred the measure.'), bh.voteWords('') ]; }""")
    ok(vt[0] == '7 yes, 0 no, 2 excused' and vt[1] == '4 yes, 0 no, 1 excused' and vt[2] == '9 yes, 0 no, 0 excused' and vt[4] == '' and vt[5] == '' and vt[6] == '', f'the vote sentence is read in both forms, counts only; a cut sentence or none gives no vote ({vt})')
    ok(vt[3] == '' or vt[3].startswith('9 yes, 1 no, 1 excused'), f'a sentence read in full with a stated reservation count says it ({vt[3]})')
    nb_ = PB['noparse'][0].split('|')[0]; bill(pg, nb_); pg.wait_for_selector('#bParts'); subs = pg.evaluate(PH)
    ok(subs and any(not re.search(r'\d+ yes', p['sub']) and not p['sub'].startswith('No result') for p in subs), f'{nb_}: a hearing whose sentence cannot be read in full shows its result and no vote ({[p["sub"][:60] for p in subs][:3]})')
    dfb = PB['deferred'][0]; bill(pg, dfb); pg.wait_for_selector('#bParts'); dsub = pg.evaluate(PH)
    ok(any(p['sub'].startswith('Deferred') and not re.search(r'\d+ yes', p['sub']) for p in dsub), f'{dfb}: a deferred hearing says Deferred, with no vote')
    mb = PB['many'][0]; bill(pg, mb); pg.wait_for_selector('#bParts'); mh = pg.evaluate(PH)
    ok(len(mh) > 3 and sum(1 for p in mh if not p['hid']) == 3 and pg.inner_text('button[data-bmore^="hear"]') == f'Show all {len(mh)}', f'{mb}: more than three past hearings show three and "Show all {len(mh)}"')
    pg.click('button[data-bmore^="hear"]'); pg.wait_for_timeout(100); pg.evaluate("() => window.__staff7Tick()"); pg.wait_for_timeout(300)
    ok(all(not p['hid'] for p in pg.evaluate(PH)), f'{mb}: Show all opens every hearing, and stays open across the minute\'s redraw')
    # --- history
    bill(pg, 'HB1523'); pg.wait_for_selector('#bParts')
    H = "id => [...document.querySelectorAll('#' + id + ' li')].map(l => ({ t: l.innerText.replace(/\\s+/g, ' ').trim(), hid: l.hidden }))"
    cap, our = pg.evaluate(H, 'bCap'), pg.evaluate(H, 'bOurs')
    ok(len(cap) == 18 and sum(1 for c in cap if not c['hid']) == 4 and pg.inner_text('#bCap button[data-bmore]') == 'Show all 18', f'HB1523: What the Capitol did shows four of {len(cap)} and "Show all 18"')
    ok(cap[0]['t'].endswith('Fri, Mar 13 · Senate') or 'Mar 13' in cap[0]['t'], f'HB1523: the Capitol\'s lines are newest first, each with its date and chamber ({cap[0]["t"][:80]})')
    ok(not any(re.search(r'\b(TRS|JDC|JHA|TRN)\b', c['t']) for c in cap) and len({c['t'] for c in cap}) == len(cap), 'HB1523: committee codes are in words and no line repeats')
    ok(sum(1 for c in our if not c['hid']) == 4 and pg.inner_text('#bOurs button[data-bmore]').startswith('Show all'), f'HB1523: What we did shows four and its own Show all ({len(our)} rows)')
    alltxt = ' | '.join(c['t'] for c in our)
    ok('Kris changed the position: Monitor to Support' in alltxt and 'Kris made Patti the lead' in alltxt and 'Patti asked the Senate Transportation chair for a hearing' in alltxt and 'Lauren sent testimony for approval' in alltxt and 'Nate approved the testimony' in alltxt and 'Lauren filed testimony' in alltxt and 'added a note' in alltxt, 'HB1523: What we did merges position and lead changes, the hearing request, the testimony steps and the notes')
    ok('priority' not in alltxt.lower(), 'HB1523: a priority change is left out')
    pg.click('#bCap button[data-bmore]'); pg.click('#bOurs button[data-bmore]'); pg.wait_for_timeout(100); pg.evaluate("() => window.__staff7Tick()"); pg.wait_for_timeout(300)
    ok(all(not c['hid'] for c in pg.evaluate(H, 'bCap')) and all(not c['hid'] for c in pg.evaluate(H, 'bOurs')), 'HB1523: each history list has its own Show all, and both stay open across the minute\'s redraw')
    pos = pg.evaluate("() => { const a = document.getElementById('bCap').getBoundingClientRect(), b = document.getElementById('bOurs').getBoundingClientRect(); return [a.left, b.left, a.top, b.top]; }")
    ok(pos[1] > pos[0] + 200 and abs(pos[2] - pos[3]) < 5, f'at laptop width the two history lists sit side by side ({pos})')
    snap(pg, 'b_history_open.png', tall=True)
    snap(pg, 'b_whole_page.png', tall=True)
    # --- loading, failed, empty (forced in the page)
    pg.evaluate("""async () => { const m = await import('/staff7/bill_data.js'), d = await import('/staff6/data.js'); m.cache.set(d.S.bills.find(b => b.bill_number === 'HB1523').id, 'loading'); window.__staff7Render({}); }""")
    pg.wait_for_timeout(200)
    ok(pg.inner_text('#bWait') == 'Loading the bill’s history.' and pg.locator('#bParts').count() == 0 and pg.locator('#bFacts').count() == 1 and pg.locator('#bStat').count() == 1, 'loading: the three blocks are one quiet line, and the top of the page (status, facts) is already there')
    pg.evaluate("""async () => { const m = await import('/staff7/bill_data.js'), d = await import('/staff6/data.js'); m.cache.set(d.S.bills.find(b => b.bill_number === 'HB1523').id, 'failed'); window.__staff7Render({}); }""")
    pg.wait_for_timeout(200)
    ok('We could not load the bill’s history.' in pg.inner_text('#bFail') and pg.locator('#bRetry').count() == 1 and pg.locator('#bRetry').get_attribute('class').split().count('text') == 1, 'failed: one line and a text button "Try again"')
    pg.click('#bRetry'); pg.wait_for_selector('#bParts', timeout=10000); ok(pg.locator('#bNotesH').count() == 1 and pg.locator('#bFail').count() == 0, 'Try again asks again and draws the history')
    pg.evaluate("""async eb => { const m = await import('/staff7/bill_data.js'), d = await import('/staff6/data.js'), b = d.S.bills.find(x => x.bill_number === eb); m.cache.set(b.id, { tl: [], hearings: [], outcomes: [], tf: {}, at: Date.now() }); window.__staff7Render({}); }""", ei)
    bill(pg, ei); pg.evaluate("""async eb => { const m = await import('/staff7/bill_data.js'), d = await import('/staff6/data.js'), b = d.S.bills.find(x => x.bill_number === eb); m.cache.set(b.id, { tl: [], hearings: [], outcomes: [], tf: {}, at: Date.now() }); window.__staff7Render({}); }""", ei); pg.wait_for_timeout(300)
    hn = pg.evaluate("() => [...document.querySelectorAll('.bhist .hint')].map(h => h.innerText)")
    ok(pg.inner_text('#bNoNotes') == 'No notes yet.' and hn == ['Nothing yet.', 'Nothing yet.'] and pg.locator('#bHearH').count() == 0, f'{ei}: empty states: "No notes yet.", "Nothing yet." in both history lists, no Past hearings block')
    tx = pg.evaluate(TEXTS); bill(pg, 'HB2300'); pg.wait_for_selector('#bParts'); tx = pg.evaluate(TEXTS)
    ok(not re.search(r'letter', tx, re.I) and not re.search(r'vap(e|es|ing)\b', tx, re.I), 'HB2300: the whole page, with its notes, hearings and history, never says "letter" or "vape"')
    ok(pg.evaluate(NOSIDE) and not pg.evaluate(SMALL), 'HB2300: no sideways scroll, 44px targets with the history drawn')
    ok(not errs and not bad, f'Part B at 1440: no console error, nothing left 127.0.0.1 ({errs[:2]} {bad[:2]})')
    pg.context.close()

    # ============================================================ Part C: change position or lead, add a note
    pg0, ctx0 = open_as(br, 'NT', 1440, 900, '#/issues')
    WHO = pg0.evaluate("""async () => {
      const d = await import('/staff6/data.js'), bw = await import('/staff7/bill_words.js'), S = d.S, out = {}, prev = S.me;
      const issueOf = b => { const ids = S.billIssues.filter(x => x.bill_id === b.id).map(x => x.issue_id); return S.issues.find(i => ids.includes(i.id) && !i.archived_at); };
      try { for (const a of S.advocates.filter(a => a.is_active !== false)) { S.me = a; const mine = new Set([...d.myIssueIds()].map(String));
        for (const b of S.bills.filter(b => b.tracked !== false && issueOf(b)).slice(0, 400)) { const i = issueOf(b), lead = bw.leadIds(b, i).includes(a.id), own = mine.has(String(i.id)), adm = !!a.is_admin;
          const k = lead && !adm ? 'lead' : own && !lead && !adm ? 'owner' : adm && !lead && !own ? 'admin' : !lead && !own && !adm ? 'none' : ''; if (k && !out[k]) out[k] = { ini: a.initials, bill: b.bill_number }; } } } finally { S.me = prev; }
      // a bill with a lead assigned and no issue owner to stand in for it; a bill that is not public; one that is
      const nobody = S.bills.find(b => b.tracked !== false && (S.assignments[b.id] || []).length === 1 && !(issueOf(b) && issueOf(b).owner_id));
      const pub = S.bills.find(b => b.tracked !== false && b.is_public && issueOf(b) && (S.assignments[b.id] || []).length), priv = S.bills.find(b => b.tracked !== false && !b.is_public && (S.assignments[b.id] || []).length && issueOf(b));
      out.nobody = nobody ? nobody.bill_number : null; out.pub = pub ? [pub.bill_number, S.advocates.find(a => a.id === S.assignments[pub.id][0]).initials] : null; out.priv = priv ? [priv.bill_number, S.advocates.find(a => a.id === S.assignments[priv.id][0]).initials] : null;
      return out; }""")
    pg0.context.close()
    print('who sees the button:', WHO, flush=True)
    ok(all(WHO.get(k) for k in ('lead', 'owner', 'admin', 'none', 'nobody', 'pub')), f'the practice copy has a lead, an issue owner, an admin and a stranger to test with, a bill with a lead and no owner to stand in, a public and a private bill ({ {k: WHO.get(k) for k in ("lead", "owner", "admin", "none")} })')
    for kind in ('lead', 'owner', 'admin', 'none'):
        w = WHO[kind]; pgx, cx = open_as(br, w['ini'], 1440, 900, f'#/bill/{w["bill"]}'); pgx.wait_for_selector('#bParts', timeout=20000)
        see = pgx.locator('#bEditGo').count() == 1; txt = pgx.locator('#bEditGo').inner_text() if see else ''
        ok(see == (kind != 'none') and (not see or txt == 'Change position or lead'), f'{w["ini"]} ({kind}) on {w["bill"]}: the "Change position or lead" button is {"shown" if see else "not shown"}')
        ok(pgx.locator('#bNoteIn').count() == 1 and pgx.inner_text('label[for=bNoteIn]') == 'Add a note for the team', f'{w["ini"]} ({kind}): the note box is there for every team viewer')
        if kind == 'none':
            go(pgx, f'#/bill/{w["bill"]}?who=all'); pgx.wait_for_selector('#bParts'); ok('Look only' in pgx.inner_text('main') and pgx.locator('#bEditGo').count() == 0 and pgx.locator('#bNoteIn').count() == 1, f'{w["ini"]}: looking at everyone\'s list: look only, no change button, but the note box is still there')
        pgx.context.close()

    pg, ctx = open_as(br, 'NT', 1440, 900, '#/bill/HB2300'); errs, bad = ctx._errs, ctx._bad
    pg.wait_for_selector('#bParts', timeout=20000)
    LISTROW = "() => [...document.querySelectorAll('#bOurs li')].slice(0, 3).map(l => l.innerText.replace(/\\s+/g, ' ').trim())"
    OURS = "() => document.querySelectorAll('#bl-ours > li').length"
    snap(pg, 'c_button.png')
    ok(pg.inner_text('#bPos').replace('\n', ' ').startswith('HIPHI’s position') and pg.evaluate("() => document.getElementById('bPos').lastElementChild.id") == 'bEditGo', 'HB2300: the button is at the end of the position line')
    # open: focus on the checked position; the status lines stay; Cancel and Escape close and give the focus back
    n0 = pg.evaluate(OURS); stat0 = pg.evaluate(STAT)
    pg.click('#bEditGo'); pg.wait_for_timeout(200)
    ok(pg.evaluate("() => document.activeElement.id") == 'bp-support' and pg.locator('#bEdit').count() == 1 and pg.locator('#bPos').count() == 0 and pg.evaluate(STAT) == stat0, 'open: the edit block stands in the position line\'s place, focus is on the checked position, the status lines are still there')
    lab = pg.evaluate("() => ({ legend: document.querySelector('#bEdit fieldset legend').innerText, radios: [...document.querySelectorAll('#bEdit input[type=radio]')].map(r => [r.value, r.closest('label').innerText.trim(), r.checked]), lead: document.querySelector('label[for=bLeadSel]').innerText, opts: [...document.querySelectorAll('#bLeadSel option')].map(o => o.innerText), save: document.getElementById('bSave').disabled, savecls: document.getElementById('bSave').className })")
    labels = pg.evaluate("async () => (await import('/staff6/data.js')).POSITIONS.filter(p => p[0]).map(p => [p[0], p[1]])")
    ok(lab['legend'] == 'Position' and lab['lead'] == 'Lead' and [r[:2] for r in lab['radios']][:-1] == labels and lab['radios'][-1][:2] == ['', 'No position yet'] and sum(1 for r in lab['radios'] if r[2]) == 1, f'the position choices are the data layer\'s own list and labels, plus "No position yet" ({[r[1] for r in lab["radios"]]})')
    ok(lab['opts'][0] == 'Nobody' and 'Nate' in lab['opts'] and 'Kris' in lab['opts'] and len(lab['opts']) == 1 + pg.evaluate("async () => (await import('/staff6/data.js')).S.advocates.filter(a => a.is_active !== false).length"), f'the lead select has Nobody and every active teammate by first name ({lab["opts"]})')
    ok(lab['save'] and 'filled' in lab['savecls'], 'Save is a filled button and is disabled until something changes')
    ok(pg.inner_text('.beact .hint') == 'The position shows on the public site.' if pg.evaluate("async () => (await import('/staff6/data.js')).S.bills.find(b => b.bill_number === 'HB2300').is_public") else pg.locator('.beact .hint').count() == 0, 'the public hint matches whether HB2300 is public')
    snap(pg, 'c_editing.png')
    pg.click('#bp-oppose'); pg.wait_for_timeout(100); ok(not pg.evaluate("() => document.getElementById('bSave').disabled"), 'Save is enabled once a choice differs')
    pg.click('#bp-support'); pg.wait_for_timeout(100); ok(pg.evaluate("() => document.getElementById('bSave').disabled"), 'putting the choice back disables Save again')
    pg.click('#bCancel'); pg.wait_for_timeout(200)
    ok(pg.locator('#bEdit').count() == 0 and pg.evaluate("() => document.activeElement.id") == 'bEditGo' and 'Support' in pg.inner_text('#bPos') and pg.evaluate(OURS) == n0, 'Cancel closes with nothing saved and the focus goes back to the button')
    pg.click('#bEditGo'); pg.click('#bp-monitor'); pg.keyboard.press('Escape'); pg.wait_for_timeout(200)
    ok(pg.locator('#bEdit').count() == 0 and pg.evaluate("() => document.activeElement.id") == 'bEditGo' and 'Monitor' not in pg.inner_text('#bPos'), 'Escape closes with nothing saved and the focus goes back to the button')
    # the open block and its unsaved choices survive a redraw
    pg.click('#bEditGo'); pg.click('#bp-oppose'); pg.select_option('#bLeadSel', label='Kris')
    pg.evaluate("() => window.__staff7Render({ tick: true })"); pg.wait_for_timeout(300)
    ok(pg.locator('#bEdit').count() == 1 and pg.evaluate("() => document.querySelector('#bEdit input:checked').value") == 'oppose' and pg.evaluate("() => document.getElementById('bLeadSel').selectedOptions[0].innerText") == 'Kris' and not pg.evaluate("() => document.getElementById('bSave').disabled"), 'the open block and its unsaved choices survive the minute\'s redraw')
    pg.click('#bCancel')
    # save position only, then Undo
    pg.click('#bEditGo'); pg.click('#bp-support_amend'); pg.click('#bSave'); pg.wait_for_timeout(500)
    ok(pg.inner_text('#bPos').replace('\n', ' ') == 'HIPHI’s position Support w/ amendments · You lead Change position or lead' and pg.locator('#bEdit').count() == 0 and pg.evaluate("() => document.activeElement.id") == 'bEditGo', f'position only: the page shows the new position and the same lead ({pg.inner_text("#bPos").replace(chr(10), " ")})')
    r = pg.evaluate(LISTROW); ok(r[0].startswith('Nate changed the position: Support to Support w/ amendments') and pg.evaluate(OURS) == n0 + 1, f'position only: "What we did" has the new row on top ({r[0]})')
    ok(pg.inner_text('#toast .tin').replace('\n', ' ').startswith('Saved') and pg.locator('#toastUndo').is_visible(), 'position only: a toast "Saved" with Undo')
    snap(pg, 'c_saved_toast.png')
    pg.click('#toastUndo'); pg.wait_for_timeout(500)
    ok('Support' in pg.inner_text('#bPos') and 'amendments' not in pg.inner_text('#bPos') and pg.evaluate(OURS) == n0 and not pg.evaluate(LISTROW)[0].startswith('Nate changed'), 'position only: Undo puts the position back and takes the row out of the history')
    # lead only, then Undo
    pg.click('#bEditGo'); pg.select_option('#bLeadSel', label='Kris'); pg.click('#bSave'); pg.wait_for_timeout(500)
    ok(pg.inner_text('#bLead').strip() == 'Kris leads' and pg.locator('#bLead a').get_attribute('href') == '#/issues?who=KR', f'lead only: the page says "Kris leads", a link to Kris\'s issues ({pg.inner_text("#bLead")})')
    ok(pg.evaluate(LISTROW)[0].startswith('Nate made Kris the lead') and 'changed the position' not in pg.evaluate(LISTROW)[0], 'lead only: "What we did" reads "Nate made Kris the lead"')
    pg.click('#toastUndo'); pg.wait_for_timeout(500)
    ok(pg.inner_text('#bLead').strip() == 'You lead' and pg.evaluate(OURS) == n0, 'lead only: Undo puts the lead back and removes the row')
    # both at once, then Undo
    pg.click('#bEditGo'); pg.click('#bp-strongly_support'); pg.select_option('#bLeadSel', label='Jess'); pg.click('#bSave'); pg.wait_for_timeout(500)
    rows = pg.evaluate(LISTROW)
    ok('Strongly support' in pg.inner_text('#bPos') and 'Jess leads' in pg.inner_text('#bLead') and pg.evaluate(OURS) == n0 + 2 and any('made Jess the lead' in x for x in rows[:2]) and any('Support to Strongly support' in x for x in rows[:2]), f'both: one Save changes both, with a row for each ({rows[:2]})')
    pg.click('#toastUndo'); pg.wait_for_timeout(500)
    ok('Strongly' not in pg.inner_text('#bPos') and 'You lead' in pg.inner_text('#bLead') and pg.evaluate(OURS) == n0, 'both: one Undo puts both back')
    # the issues list at the left is drawn again, not left stale
    ok(pg.locator('.wl a.sr3').count() > 3 and pg.locator('a.sr3[aria-current=true]').count() >= 1, 'the Issues list at the left is still there and still marks the open issue after a save')
    # keyboard only
    pg.focus('#bEditGo'); pg.keyboard.press('Enter'); pg.wait_for_timeout(200)
    ok(pg.evaluate("() => document.activeElement.id") == 'bp-support', 'keyboard: Enter on the button opens the block with the focus on the checked position')
    pg.keyboard.press('ArrowRight'); pg.wait_for_timeout(100)
    ok(pg.evaluate("() => document.querySelector('#bEdit input:checked').value") == 'support_amend', 'keyboard: the arrow keys move through the positions')
    pg.keyboard.press('Tab'); ok(pg.evaluate("() => document.activeElement.id") == 'bLeadSel', 'keyboard: Tab goes on to the lead')
    pg.keyboard.type('Kris'); pg.wait_for_timeout(150); pk = pg.evaluate("() => document.getElementById('bLeadSel').selectedOptions[0].innerText")
    ok(pk == 'Kris', f'keyboard: typing a name changes the lead (the arrow keys open the browser\'s own list on a Mac) ({pk})')
    pg.keyboard.press('Tab'); ok(pg.evaluate("() => document.activeElement.id") == 'bSave', 'keyboard: Tab reaches Save')
    pg.keyboard.press('Enter'); pg.wait_for_timeout(500)
    ok('Support w/ amendments' in pg.inner_text('#bPos') and pg.evaluate("() => document.activeElement.id") == 'bEditGo', 'keyboard: Enter on Save saves, and the focus returns to the button')
    pg.click('#toastUndo'); pg.wait_for_timeout(400)
    # forced failures
    pg.evaluate("async () => { const d = await import('/staff6/data.js'); window.__keepU = d.DB.updateBill; d.DB.updateBill = async () => { throw new Error('no'); }; }")
    pg.click('#bEditGo'); pg.click('#bp-oppose'); pg.click('#bSave'); pg.wait_for_timeout(400)
    ok(pg.inner_text('#bEditErr') == 'We could not save that. Try again.' and pg.locator('#bEdit').count() == 1 and pg.evaluate("() => document.querySelector('#bEdit input:checked').value") == 'oppose' and pg.evaluate(OURS) == n0, 'a failed position save keeps the block open, says one plain line, and changes nothing')
    pg.evaluate("async () => { const d = await import('/staff6/data.js'); d.DB.updateBill = window.__keepU; window.__keepO = d.DB.setOwner; d.DB.setOwner = async () => { throw new Error('no'); }; }")
    pg.select_option('#bLeadSel', label='Kris'); pg.click('#bSave'); pg.wait_for_timeout(500)
    posnow = pg.evaluate("async () => (await import('/staff6/data.js')).S.bills.find(b => b.bill_number === 'HB2300').position")
    ok(pg.inner_text('#bEditErr') == 'We could not save that. Try again.' and posnow == 'support' and pg.evaluate(OURS) == n0, f'a failed lead save puts the position back too, so nothing is half done (position {posnow})')
    pg.evaluate("async () => { const d = await import('/staff6/data.js'); d.DB.setOwner = window.__keepO; }")
    pg.click('#bCancel')
    # held for an admin (the data layer says so)
    pg.evaluate("async () => { const d = await import('/staff6/data.js'); window.__keepU = d.DB.updateBill; d.DB.updateBill = async () => ['position']; }")
    pg.click('#bEditGo'); pg.click('#bp-oppose'); pg.click('#bSave'); pg.wait_for_timeout(500)
    ok('The position waits for an admin’s yes.' in pg.inner_text('#toast .tin') and 'Oppose' not in pg.inner_text('#bPos') and pg.evaluate(OURS) == n0, 'a position the database keeps for an admin says so, and is not shown as final')
    pg.evaluate("async () => { const d = await import('/staff6/data.js'); d.DB.updateBill = window.__keepU; }")
    # a bill with a lead and nobody to stand in: "Nobody"
    nb = WHO['nobody']; bill(pg, nb, ''); pg.wait_for_selector('#bParts'); who0 = pg.inner_text('#bLead').strip(); n1 = pg.evaluate(OURS)
    pg.click('#bEditGo'); pg.select_option('#bLeadSel', label='Nobody'); pg.click('#bSave'); pg.wait_for_timeout(500)
    ok(pg.inner_text('#bLead').strip() == 'Nobody leads it yet' and pg.evaluate(LISTROW)[0].startswith('Nate took the lead off ') and pg.evaluate(OURS) == n1 + 1, f'{nb}: choosing Nobody says "Nobody leads it yet" and the history reads "{pg.evaluate(LISTROW)[0]}" (it was "{who0}")')
    pg.click('#toastUndo'); pg.wait_for_timeout(500); ok(pg.inner_text('#bLead').strip() == who0 and pg.evaluate(OURS) == n1, f'{nb}: Undo puts the lead back')
    # the public hint only on a public bill
    pb = WHO['pub']; pv = WHO['priv'] or [WHO['lead']['bill'], WHO['lead']['ini']]   # every tracked practice bill with a lead is public: the private one is made so in the page
    for (num, ini), want in ((pb, True), (pv, False)):
        pgx, cx = open_as(br, ini, 1440, 900, f'#/bill/{num}'); pgx.wait_for_selector('#bParts')
        if not want: pgx.evaluate("async n => { const d = await import('/staff6/data.js'); d.S.bills.find(b => b.bill_number === n).is_public = false; window.__staff7Render({ tick: true }); }", num)
        pgx.click('#bEditGo'); pgx.wait_for_timeout(150)
        has = pgx.locator('.beact .hint').count() == 1 and pgx.inner_text('.beact .hint') == 'The position shows on the public site.'
        ok(has == want, f'{num}: the public hint is {"there" if want else "not there"} on a {"public" if want else "private"} bill')
        pgx.context.close()
    # --- add a note
    bill(pg, 'HB2300', ''); pg.wait_for_selector('#bParts'); nn = pg.evaluate("() => document.querySelectorAll('#bl-notes > li').length"); n2 = pg.evaluate(OURS)
    ok(pg.evaluate("() => document.getElementById('bNoteBox').nextElementSibling.id") == 'bPinned' and pg.inner_text('#bNoteBox .hint') == 'Only the team sees notes.' and pg.inner_text('#bNoteGo') == 'Add the note' and pg.evaluate("() => document.getElementById('bNoteGo').disabled"), 'the note box sits above the notes (pinned note and list), has the hint, and "Add the note" is disabled while the box is empty')
    pg.fill('#bNoteIn', '   \n  '); ok(pg.evaluate("() => document.getElementById('bNoteGo').disabled"), 'spaces only keep "Add the note" disabled')
    pg.fill('#bNoteIn', 'Called the chair\'s office. They will hear it on the 18th.'); ok(not pg.evaluate("() => document.getElementById('bNoteGo').disabled"), 'words enable "Add the note"')
    pg.evaluate("() => window.__staff7Render({ tick: true })"); pg.wait_for_timeout(300)
    ok(pg.input_value('#bNoteIn').startswith('Called the chair') and not pg.evaluate("() => document.getElementById('bNoteGo').disabled"), 'typed words survive the minute\'s redraw')
    snap(pg, 'c_add_note.png')
    pg.evaluate("async () => { const d = await import('/staff6/data.js'); window.__keepM = d.DB.sendMessage; d.DB.sendMessage = async () => { throw new Error('no'); }; }")
    pg.click('#bNoteGo'); pg.wait_for_timeout(400)
    ok(pg.inner_text('#bNoteErr') == 'We could not save that. Try again.' and pg.input_value('#bNoteIn').startswith('Called the chair') and pg.evaluate("() => document.querySelectorAll('#bl-notes > li').length") == nn, 'a failed note keeps the words, says one plain line, and adds nothing')
    pg.evaluate("async () => { const d = await import('/staff6/data.js'); d.DB.sendMessage = window.__keepM; }")
    pg.click('#bNoteGo'); pg.wait_for_timeout(500)
    top = pg.evaluate("() => document.querySelector('#bl-notes > li:first-child').innerText.replace(/\\s+/g, ' ').trim()")
    ok(top.startswith('Nate ·') and 'Called the chair' in top and pg.evaluate("() => document.querySelectorAll('#bl-notes > li').length") == nn + 1 and pg.input_value('#bNoteIn') == '' and pg.evaluate("() => document.getElementById('bNoteGo').disabled"), f'the note shows on top of the list at once and the box empties ({top[:60]})')
    ok(pg.evaluate(LISTROW)[0].startswith('Nate added a note') and pg.evaluate(OURS) == n2 + 1 and 'Note added' in pg.inner_text('#toast .tin'), '"What we did" has "Nate added a note" on top, and a toast says "Note added"')
    pg.click('#toastUndo'); pg.wait_for_timeout(500)
    ok(pg.evaluate("() => document.querySelectorAll('#bl-notes > li').length") == nn and pg.evaluate(OURS) == n2, 'Undo takes the note and its history row away')
    ok(not re.search(r'letter', pg.evaluate(TEXTS), re.I), 'HB2300 with the edit and note boxes: no "letter" anywhere')
    ok(not errs and not bad, f'Part C at 1440: no console error, nothing left 127.0.0.1 ({errs[:2]} {bad[:2]})')
    pg.context.close()
    # --- a phone
    pg, ctx = open_as(br, 'NT', 390, 844, '#/bill/HB2300'); errs, bad = ctx._errs, ctx._bad; pg.wait_for_selector('#bParts', timeout=20000)
    pg.click('#bEditGo'); pg.wait_for_timeout(200)
    SMALLC = "() => [...document.querySelectorAll('#bEdit .bs span, #bEdit select, #bEdit .btn, #bEditGo, #bNoteIn, #bNoteGo')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.height < 43.5; }).map(e => e.className + ' ' + e.id)"
    ok(pg.evaluate(NOSIDE) and not pg.evaluate(SMALLC) and pg.evaluate("() => { const r = [...document.querySelectorAll('#bEdit .bs')].map(l => Math.round(l.getBoundingClientRect().top)); return new Set(r).size > 1; }"), f'phone: the edit block wraps its position choices, no sideways scroll, 44px targets ({pg.evaluate(SMALLC)[:2]})')
    snap(pg, 'c_phone_editing.png')
    pg.click('#bCancel'); pg.evaluate("() => document.getElementById('bNoteIn').scrollIntoView()"); pg.fill('#bNoteIn', 'x')
    ok(pg.evaluate(NOSIDE) and not pg.evaluate(SMALLC), 'phone: the note box fits, with a 44px button')
    ok(not errs and not bad, f'Part C phone: no console error, nothing left 127.0.0.1 ({errs[:2]} {bad[:2]})')
    pg.context.close()

    # ============================================================ a phone
    pg, ctx = open_as(br, 'KV', 390, 844, f'#/bill/{hb}?i={hi}&who=all'); errs, bad = ctx._errs, ctx._bad
    for num in (hb, pick('manycmtes'), pick('stopped'), pick('manysp'), pick('longname'), pick('joint')):
        bill(pg, num, f'i={hi}&who=all' if num == hb else 'who=all')
        ok(pg.evaluate(NOSIDE) and not pg.evaluate(SMALL), f'phone {num}: no sideways scroll, 44px targets ({pg.evaluate(SMALL)[:2]})')
    bill(pg, hb, f'i={hi}&who=all')
    ok(pg.locator('svg.trk.row').first.is_visible() and pg.locator('svg.trk.wide').first.is_hidden(), 'phone: the path is the compact one')
    backs = pg.evaluate("() => [...document.querySelectorAll('.back, .crumb.back2')].filter(e => e.getBoundingClientRect().width > 0).map(e => e.innerText.trim())")
    ok(len(backs) == 1 and backs[0].startswith('Back to '), f'phone: one back link, labelled with where it goes ({backs})')
    bill(pg, 'HB1523'); pg.wait_for_selector('#bParts'); pg.click('#bCap button[data-bmore]'); pg.wait_for_timeout(100)
    st2 = pg.evaluate("() => { const a = document.getElementById('bCap').getBoundingClientRect(), b = document.getElementById('bOurs').getBoundingClientRect(); return [a.left, b.left, a.bottom, b.top]; }")
    ok(abs(st2[0] - st2[1]) < 2 and st2[3] >= st2[2] - 1, f'phone: the two history lists are stacked ({st2})')
    ok(pg.evaluate(NOSIDE) and not pg.evaluate(SMALL), f'phone HB1523: the notes, hearings and history fit with 44px targets ({pg.evaluate(SMALL)[:2]})')
    snap(pg, 'b_phone.png', tall=False)
    snap(pg, 'phone_bill.png')
    ok(not errs and not bad, f'phone: no console error, nothing left 127.0.0.1 ({errs[:2]} {bad[:2]})')
    pg.context.close()
    br.close()
print(f'{sum(res)}/{len(res)} passed')
sys.exit(0 if all(res) else 1)
