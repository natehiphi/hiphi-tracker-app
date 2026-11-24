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
def skip(m): print('SKIP (not counted)', m, flush=True)

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
        if 'RepSenPhotos' in u: return route.abort()   # a legislator's photo on their page (R-398 piece 12): blocked offline, not a stray request
        bad.append(u); route.abort()
    ctx.route(lambda u: '127.0.0.1' not in u and 'localhost' not in u, h)
def open_as(br, who, w, h, hash=''):
    ctx = br.new_context(viewport={'width': w, 'height': h}); ctx._bad = []; external_blocker(ctx, ctx._bad); ctx._errs = []
    pg = ctx.new_page(); errs = ctx._errs
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'Failed to load resource' not in m.text and 'ERR_FAILED' not in m.text else None)
    pg.goto(f'{BASE}/staff7.html?demo=1&as={who}' + hash); pg.wait_for_selector('.paper', timeout=60000)
    pg.evaluate("Promise.all([document.fonts.load('600 16px Poppins'), document.fonts.load('400 16px Lato'), document.fonts.load('700 16px Lato'), document.fonts.load('500 16px Poppins')])"); pg.wait_for_timeout(500)
    return pg, ctx
def other_pos(pg):   # click a position that is not the checked one
    cur = pg.evaluate("() => document.querySelector('#bEdit input:checked')?.value"); pg.click('#bp-' + ('neutral' if cur != 'neutral' else 'monitor'))
def go(pg, hash): pg.evaluate("h => { window.__staff7TrailReset && window.__staff7TrailReset(); location.hash = h; }", hash); pg.wait_for_timeout(450)
# R-398 part 3: is the bill on this page one whose HIPHI words are public (the position save then says what the public site keeps)?
def live_now(pg): return pg.evaluate("async () => { const d = await import('/staff6/data.js'), n = decodeURIComponent(location.hash.split('/')[2] || '').split('?')[0].replace(/\\s/g, ''); const b = d.S.bills.find(x => x.bill_number.replace(/\\s/g, '') === n); return !!b && d.isLiveBill(b); }")
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
    ok(len(st) in (3, 4) and st[0].startswith(('Hearing scheduled', 'Decision making scheduled')) and re.match(r'^(Today|Tomorrow|\w{3}) \d+:\d\d [AP]M', st[1]) and st[2].startswith('Testimony ') and 'Hearing scheduled' not in st[1], f'{hb}: the status leads with where the bill is, then the hearing\'s time, then the testimony ({st})')
    ok(len(st) == 4 and st[3].startswith('After this: ') and (' which must hear it by ' in st[3] or ', which must hear it by ' in st[3] or st[3].endswith('floor vote')), f'{hb}: a muted last line says what comes after this committee ({st[3:]})')
    ok(pg.locator('#bStat .bln.m').count() == 1 and pg.locator('#bStat .bln:nth-child(4) a[href^="#/search/committee/"]').count() == 1, f'{hb}: that line is muted and names the next committee as a link')
    ok(exp.split(' · ')[0].replace('Hearing ', '', 1).lower() in st[1].lower(), f'{hb}: the hearing time equals the Issues list ("{exp.split(" · ")[0]}" in "{st[1]}")')
    sit = pg.evaluate("() => { const a = [...document.querySelectorAll('#bStat .bln:nth-child(2) .blt a')].pop(); const t = document.querySelector('#bStat .bln:nth-child(2) .blt').innerText.trim(); return a ? [a.innerText.trim(), a.getAttribute('href'), t.endsWith('See the hearing'), document.querySelectorAll('#bStat .bla').length] : null; }")
    ok(sit and sit[0] == 'See the hearing' and sit[1].startswith('#/calendar/sitting/') and sit[2] and sit[3] == 0 and pg.locator('#bStat .bln:nth-child(3) a[href^="#/calendar"]').count() == 0 and pg.locator('#bStat .bmv').count() == 0, f'{hb}: with no step of mine, "See the hearing" ends the HEARING line inline (no far-right float), not the testimony line ({sit})')
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
    ex = pg.evaluate("() => [...document.querySelectorAll('.paper a[href^=\"http\"]')].map(a => [a.getAttribute('href'), a.target, a.rel, a.innerText.trim(), !!a.querySelector('svg')])")
    bl = pg.evaluate("() => { const e = document.querySelector('.hband .bsub'); return { txt: e.innerText.replace(/\\s+/g, ' ').trim(), links: [...e.querySelectorAll('a')].map(a => [a.innerText.trim(), a.target, a.rel, getComputedStyle(a).fontWeight, getComputedStyle(a).color, getComputedStyle(a).fontSize]), row: document.querySelector('#bFacts').innerText }; }")
    ok(len(ex) >= 4 and all(t == '_blank' and 'noopener' in r and ic for _, t, r, _x, ic in ex), f'{hb}: every outside link opens in a new tab with rel=noopener and the external icon ({[e[3] for e in ex]})')
    ok(re.match(r'^The Capitol’s page\s+·\s+Read the bill$', bl['txt']) and pg.evaluate("() => document.querySelector('.hband .kindl.no')?.innerText.trim()") == hb.replace('HB', 'HB ') and [l[0] for l in bl['links']] == ['The Capitol’s page', 'Read the bill'] and all(int(l[3]) >= 700 and l[5] == '16px' for l in bl['links']) and 'Read the bill' not in bl['row'] and 'The Capitol’s page' not in bl['row'], f'{hb}: the number\'s line in the band holds "The Capitol’s page" and "Read the bill" (bold, 16px), and the What it does row does not ({bl["txt"]})')
    ok(any(re.search(r'capitol\.hawaii\.gov/sessions?/', u) for u, *_ in ex) and any(e[3].startswith('Read the bill') and re.search(r'/bills/' + hb + '_', e[0]) for e in ex), f'{hb}: "Read the bill" goes to the Capitol\'s bill text ({ex[0][0][:60]})')
    # words
    tx = pg.evaluate(TEXTS)
    ok(not re.search(r'letter', tx, re.I) and not re.search(r'vap(e|es|ing)\b', tx, re.I), f'{hb}: the word "letter" and the word "vape" appear nowhere on the page')

    # ============================================================ a hearing with an agenda, a joint hearing, late testimony
    ag = pick('agenda')
    if ag:
        bill(pg, ag); a = pg.evaluate("() => document.querySelector('#bStat a[target=_blank]')?.outerHTML || ''")
        ok('Agenda' in a and 'noopener' in a, f'{ag}: a hearing with a notice shows "Agenda" opening in a new tab ({a[:60]})')
    else: skip('no coming hearing in the practice copy has a notice_url: "Agenda" is checked on a synthetic one below')
    jt = pick('joint'); bill(pg, jt); jl = pg.evaluate(STAT)[0]; jn = pg.evaluate("() => document.querySelectorAll('#bStat .bln:first-child a[href^=\"#/search/committee/\"]').length")
    ok(re.search(r' (House|Senate) [A-Z]{2,4}/[A-Z]{2,4}', jl) and jn == 2, f'{jt}: a joint hearing names both committees, each a link ({jl})')
    lt = pick('late'); bill(pg, lt); ls = pg.evaluate(STAT); am = pg.evaluate(AMBER)
    ok(re.match(r'^Late, still accepted until \d+:\d\d [AP]M( today)? · ', ls[2]) and am and all(x == 'status' for x in am) and pg.locator('#bStat b.riskt svg').count() == 1, f'{lt}: late testimony says it in Calendar\'s own words, in amber with its icon, and nowhere else is amber ({ls[2]})')
    nl = pick('notlate'); bill(pg, nl); ok(not pg.evaluate(AMBER) and pg.locator('.riskt').count() == 0, f'{nl}: testimony not yet due has no amber anywhere')
    snap(pg, 'late_testimony.png')

    # ============================================================ at risk, needs a hearing, cleared, stopped: the words equal the Issues list
    rk = L['risk']['bill']; go(pg, f'#/bill/{rk}?i={L["risk"]["issue"]}&who=all'); st = pg.evaluate(STAT); lead = L['risk']['text'].split(' · ')[0]
    lm = re.match(r'^Needs a hearing by (\w{3}) · in (\d+) days?$', L['risk']['text'].strip()); pm = re.match(r'^Needs a hearing by (\w{3}), (\w{3} \d+) · (\d+) days?$', st[1]); lead_ok = re.match(r'^.+ \([A-Z]{2,4}\)$|^.+ [A-Z]{2,4}(/[A-Z]{2,4})*$', st[0]) and not re.search(r'none is scheduled|\bin (House|Senate)', ' '.join(st))
    ok(lm and pm and lead_ok and lm.group(1) == pm.group(1) and lm.group(2) == pm.group(3) and 'days left' not in st[1], f'{rk} (at risk): the page leads with where it is ("{st[0]}"), then "{st[1]}", the same weekday and days as the Issues list ("{L["risk"]["text"]}"), in the same date words, with no committee or status said twice')
    ok(len(st) in (3, 4) and st[2].startswith('If it is not heard by then, it stops for the year.'), f'{rk} (at risk): the line after says what happens ({st[2:] })')
    ok(pg.evaluate("() => !!document.querySelector('#bStat a[href^=\"#/search/committee/\"]')"), f'{rk} (at risk): the committee it is in is a link')
    snap(pg, 'at_risk_bill.png')
    if 'cleared' in L:
        cb = L['cleared']['bill']; go(pg, f'#/bill/{cb}?i={L["cleared"]["issue"]}&who=all'); st = pg.evaluate(STAT); t = L['cleared']['text']
        want = t[6:] if t.startswith('Next: ') else t
        glab = pg.evaluate("async () => { const is = await import('/staff7/issues.js'); return is.clearedLabel(is.nextCtx().next.row); }")
        where = t[6:] if t.startswith('Next: ') else t
        ok(glab.startswith('Cleared ') and st[1] == glab + '.' and (t.startswith('Next: ') or st[0] == where), f'{cb} (cleared): the page leads with "{st[0]}" (the list\'s own line "{t}") and then says the Issues group\'s own words ("{glab}")')
        ok(len(st) == 2, f'{cb} (cleared, nothing later): two lines')
        snap(pg, 'cleared_bill.png')
    else: skip('the Issues list has no issue in the "cleared" group today (the practice copy has none; the groups are risk, hearing, need, cleared, past, stopped), so the cleared words are not compared')
    cl2 = pick('cleared_later')
    if cl2:
        bill(pg, cl2); st = pg.evaluate(STAT); ok(st[1].startswith('Needs a hearing by ') and any(re.match(r'^Cleared \w+’s deadline\.$', s) for s in st[2:]), f'{cl2}: a bill that cleared the next deadline but needs a hearing by a later one leads with the later need and says what it cleared ({st})')
    else: skip('no practice bill cleared the next deadline and needs a hearing by a later one')
    nd = pick('need')
    bill(pg, nd); st = pg.evaluate(STAT); ok(st[1].startswith('Needs a hearing by ') and len(st) <= 4, f'{nd} (needs a hearing, not at risk): "{st[0]}" then "{st[1]}"')
    sb = L['stopped']['bill']; go(pg, f'#/bill/{sb}?i={L["stopped"]["issue"]}&who=all'); st = pg.evaluate(STAT); t = L['stopped']['text']
    ok(len(st) in (1, 2) and re.match(r'^Stopped (\w{3} \d+(, \d{4})?)? ?· ', st[0]) and (len(st) == 1 or st[1].startswith('Still alive for this issue: ') or st[1].startswith('No other bill')), f'{sb} (stopped): "Stopped <date> · why", then at most the line about the issue ("{st[0]}"; the Issues list says "{t}")')
    dt = re.match(r'^Stopped (\w{3} \d+)', st[0]).group(1)
    ok(st[0].count(dt) == 1 and ' on ' + dt not in st[0] and re.search(r'· (No hearing(, missed the deadline)?|Deferred \w{3} \d+|Heard \w{3} \d+, no vote recorded) · .+ (\([A-Z]{2,4}\)|[A-Z]{2,4}(/[A-Z]{2,4})+)$', st[0]), f'{sb} (stopped): the date is said once, the why is the app\'s one wording (place.js) with the committee\'s code ({st[0]}; the Issues list says "{t}")')
    ok(pg.locator('svg.trk.dead').count() >= 1 and not pg.evaluate(AMBER), f'{sb} (stopped): its path ends in a bar, no amber')
    snap(pg, 'stopped_bill.png')
    sn = pick('stopped_nodate')
    if sn: bill(pg, sn); st = pg.evaluate(STAT); ok(st[0].startswith('Stopped') and not re.search(r'Stopped \w{3}, ', st[0]), f'{sn}: a stopped bill with no date in the data says "Stopped" with no date ({st[0]})')
    mx = (C.get('mixed') or [None])[0]; od = (C.get('onlydead') or [None])[0]
    if mx:
        bill(pg, mx['dead'][0], f'i={mx["id"]}&who=all'); f = pg.evaluate("() => document.getElementById('bAlive')?.innerText.replace(/\\s+/g, ' ')")
        al = pg.evaluate("() => [...document.querySelectorAll('#bStat .bln:not(:first-child) a')].map(a => a.getAttribute('href'))")
        ok(f and f.startswith('Still alive for this issue: ') and ' · ' in f and len(al) == len(mx['alive']) and not bad_l and pg.locator('#bStat #bAlive').count() == 1 and 'Still alive' not in pg.inner_text('#bFacts'), f'{mx["dead"][0]}: a stopped bill says in its status lines which of the issue\'s other bills are alive and where, each a link, and no facts row repeats it ({f[:80]})')
        ok(not revisit(pg, al, 'alive') , f'{mx["dead"][0]}: those links land on real pages')
    if od:
        bill(pg, od['dead'][0], f'i={od["id"]}&who=all'); ok('No other bill on this issue is still moving.' in pg.inner_text('#bAlive'), f'{od["dead"][0]}: a stopped bill on an issue with nothing alive says so')
    pl = None
    # an alive bill with no hearing and no deadline: one line from the words the Issues list uses
    plain = pg.evaluate("""async () => { const d = await import('/staff6/data.js'), st = await import('/staff7/standing.js'), mo = await import('/staff6/model.js'), is = await import('/staff7/issues.js'), S = d.S, row = is.nextCtx().next.row;
      return S.bills.filter(b => b.tracked !== false && st.isAlive(b) && !mo.hearingAhead(b) && !st.deadlineOf(b) && is.clearedOf(b, row) !== 'yes').slice(0, 2).map(b => b.bill_number); }""")
    for nb in plain[:1]:
        bill(pg, nb); st = pg.evaluate(STAT); ok(len(st) in (1, 2) and pg.locator('#bStat .blt > b').count() == 1 and (len(st) == 1 or re.match(r'^It must be heard by \w{3}, \w{3} \d+\.$', st[1])), f'{nb}: alive with no hearing and no deadline: its first words bold, and at most the date it must be heard by ({st})')
    # a hearing that was cancelled or deferred, with nothing new
    ot = pick('otherstatus'); bill(pg, ot); st = pg.evaluate(STAT); ok(len(st) in (1, 2) and not st[0].startswith('Hearing ') and (len(st) == 1 or re.match(r'^It must be heard by \w{3}, \w{3} \d+\.$', st[1])), f'{ot}: a cancelled hearing with nothing new is a line of where the bill is, and at most the date it must be heard by ({st})')

    # ============================================================ the facts
    bill(pg, 'HB1523', f'who=all'); pg.wait_for_selector('#bParts'); f = pg.evaluate(FACTS)
    ok(list(f.keys()) == ['What it does', 'Companion bills', 'Introduced by', 'On the public site', 'Talking points'], f'HB1523: the facts are one list in the order What it does, Companion bills, Introduced by, On the public site, Talking points (no Issue row, no referral rows): {list(f.keys())}')
    ok('Version' not in f['What it does'] and 'Read the bill' not in f['What it does'] and 'Capitol' not in f['What it does'] and pg.locator('#bFacts a[target=_blank]').count() == 0, f'HB1523: What it does is the plain summary only ({f["What it does"][:60]})')
    ok(pg.locator('.bcms').count() == 0 and not any(k.endswith('referral') or k == 'Referral' or k == 'Issue' for k in f), 'HB1523: the referral rows and the Issue row are gone from the facts')
    # the public site row: read only, the follower count, the ask, the share link
    ok(re.match(r"^Now on the public site: HIPHI's words( · published [^·]+ by \w+)? \d+ (person follows|people follow) it · no ask is set · Copy the share link Change what the public sees$", f['On the public site']) and pg.locator('#bFacts dd input, #bFacts dd textarea, #bFacts dd select').count() == 0, f'HB1523: "On the public site" says what is there, the follows and the share link, then the door (R-398 part 3) ({f["On the public site"]})')
    pg.evaluate("async () => { const d = await import('/staff6/data.js'); window.__pc = d.S.pubCounts; d.S.pubCounts = undefined; window.__staff7Render({ tick: true }); }"); pg.wait_for_timeout(300)
    ok('38 people follow it' in pg.evaluate(FACTS)['On the public site'], f'HB1523: with no counts in the app, the practice sample in demo/bill_team.json says 38 people follow it ({pg.evaluate(FACTS)["On the public site"]})')
    pg.evaluate("async () => { const d = await import('/staff6/data.js'); d.S.pubCounts = window.__pc; const b = d.S.bills.find(x => x.bill_number === 'HB1523'); window.__pa = [b.public_action, b.public_action_until]; b.public_action = 'Call the chair, vape free'; b.public_action_until = '2026-03-20'; window.__staff7Render({ tick: true }); }"); pg.wait_for_timeout(300)
    ok(re.search(r' · Ask: Call the chair, e-cigarette free until Fri, Mar 20 · Copy the share link Change what the public sees$', pg.evaluate(FACTS)['On the public site']) and 'vape' not in pg.evaluate(FACTS)['On the public site'], f'HB1523: a set ask shows its words (e-cigarette, never vape) and the day it runs until ({pg.evaluate(FACTS)["On the public site"][-70:]})')
    pg.evaluate("async () => { const d = await import('/staff6/data.js'); const b = d.S.bills.find(x => x.bill_number === 'HB1523'); b.public_action = window.__pa[0]; b.public_action_until = window.__pa[1]; Object.defineProperty(navigator, 'clipboard', { value: { writeText: async t => { window.__cp = t; } }, configurable: true }); window.__staff7Render({ tick: true }); }"); pg.wait_for_timeout(300)
    pg.click('button[data-bshare]'); pg.wait_for_timeout(300)
    ok(re.search(r'/b/(demo/)?HB1523$', pg.evaluate('window.__cp') or '') and 'Link copied' in pg.inner_text('#toast .tin'), f'HB1523: "Copy the share link" copies the public tracker\'s address for the bill and says "Link copied" ({pg.evaluate("window.__cp")})')
    ok(pg.locator('button[data-bshare]').evaluate("e => e.classList.contains('text')") and pg.locator('button[data-bshare]').inner_text() == 'Copy the share link', 'the share link is a text button')
    pg.evaluate("async () => { const d = await import('/staff6/data.js'); window.__pub = d.S.bills.find(x => x.bill_number === 'HB1523').is_public; d.S.bills.find(x => x.bill_number === 'HB1523').is_public = false; window.__staff7Render({ tick: true }); }"); pg.wait_for_timeout(300)
    ok(pg.evaluate(FACTS)['On the public site'].startswith("Now on the public site: the Legislature's title only") and pg.locator('button[data-bshare]').count() == 0 and pg.locator('#bFacts a.pdoor').count() == 1, 'a bill that is not public says the Legislature\'s title only, has no share link, and keeps the door (R-398 part 3)')
    pg.evaluate("async () => { const d = await import('/staff6/data.js'); d.S.bills.find(x => x.bill_number === 'HB1523').is_public = window.__pub; window.__staff7Render({ tick: true }); }"); pg.wait_for_timeout(300)
    # talking points: Show N opens them in place, Show fewer closes, kept across the minute's redraw; a bill with none has no row
    tk = pg.evaluate("() => { const b = document.querySelector('button[data-btalk]'); return [b.innerText, b.getAttribute('aria-expanded'), document.getElementById('bTalk').hidden, document.querySelectorAll('#bTalk li').length]; }")
    ok(tk == ['Show 3', 'false', True, 3], f'HB1523: talking points start closed with "Show 3" ({tk})')
    pg.click('button[data-btalk]'); pg.wait_for_timeout(100)
    tk = pg.evaluate("() => { const b = document.querySelector('button[data-btalk]'); return [b.innerText, b.getAttribute('aria-expanded'), document.getElementById('bTalk').hidden, document.getElementById('bTalk').getBoundingClientRect().height > 0, location.hash.slice(0, 14)]; }")
    ok(tk[:3] == ['Show fewer', 'true', False] and tk[3], f'HB1523: Show 3 opens the points in place, the button says Show fewer ({tk})')
    pg.evaluate("() => window.__staff7Tick()"); pg.wait_for_timeout(300)
    ok(not pg.evaluate("() => document.getElementById('bTalk').hidden") and pg.inner_text('button[data-btalk]') == 'Show fewer', 'HB1523: the open talking points stay open across the minute\'s redraw')
    pg.click('button[data-btalk]'); pg.wait_for_timeout(100); ok(pg.evaluate("() => document.getElementById('bTalk').hidden") and pg.inner_text('button[data-btalk]') == 'Show 3', 'HB1523: Show fewer closes them')
    ntp = pg.evaluate("async () => { const d = await import('/staff6/data.js'); const b = d.S.bills.find(x => x.bill_number === 'HB1523'); window.__tp = b.talking_points; b.talking_points = []; window.__staff7Render({ tick: true }); return 1; }"); pg.wait_for_timeout(300)
    ok('Talking points' not in pg.evaluate(FACTS) and 'On the public site' in pg.evaluate(FACTS), 'a bill with no talking points has no Talking points row')
    pg.evaluate("async () => { const d = await import('/staff6/data.js'); d.S.bills.find(x => x.bill_number === 'HB1523').talking_points = window.__tp; }")
    ni = pick('noissue'); bill(pg, ni); fi = pg.evaluate(FACTS)
    ok('Issue' not in fi and pg.inner_text('#bNoIssue') == 'On no issue yet' and real_page(pg) and pg.locator('#tbBack').inner_text().strip() == 'Back to Issues' and pg.evaluate("() => document.getElementById('bNoIssue').getBoundingClientRect().top >= document.getElementById('bPos').getBoundingClientRect().bottom && getComputedStyle(document.getElementById('bNoIssue')).fontSize"), f'{ni}: a bill on no issue says "On no issue yet" as a small muted line under the position line and goes back to Issues')
    bill(pg, 'HB1523'); ok(pg.locator('#bNoIssue').count() == 0, 'HB1523: a bill on an issue has no "On no issue yet" line')
    nb = pick('nobodyleads'); bill(pg, nb); ok(pg.inner_text('#bLead').strip() == 'Nobody leads it yet', f'{nb}: nobody leads says "Nobody leads it yet" ({pg.inner_text("#bLead").strip()})')
    # the timeline: groups, codes, names, marks
    TLJS = """() => ({ groups: [...document.querySelectorAll('.bigpath .btl .btg')].map(g => ({ cap: g.querySelector('.btc').innerText.trim(), stops: [...g.querySelectorAll('.bts')].map(s => ({ k: s.dataset.k, s: s.dataset.s, code: s.querySelector('.btk').innerText.replace(/\\s+/g, ' ').trim(), name: s.querySelector('.btnm')?.innerText.trim() || '', sub: s.querySelector('.btsb')?.innerText.trim() || '', links: [...s.querySelectorAll('.btk a')].map(a => a.getAttribute('href')) })) })),
      vis: document.querySelector('.bigpath .btl').getBoundingClientRect().height > 0, rowhid: getComputedStyle(document.querySelector('.bigpath svg.trk.row')).display === 'none', sr: document.querySelector('.bigpath .btl ~ .sr')?.textContent || '',
      fit: [...document.querySelectorAll('.bigpath .bts')].every(s => [...s.children].every(c => c.scrollWidth <= c.clientWidth + 1)),
      over: (() => { const r = [...document.querySelectorAll('.bigpath .bts')].map(s => s.getBoundingClientRect()).sort((a, b) => a.left - b.left || a.top - b.top); return r.some((x, i) => i && Math.abs(x.top - r[i - 1].top) < 4 && x.left < r[i - 1].right - 1); })(),
      w: document.querySelector('.bigpath .btl').scrollWidth <= document.querySelector('.bigpath').clientWidth + 1 })"""
    TLF = "() => [...document.querySelectorAll('.bigpath .bts')].map(s => s.querySelector('.btk').innerText.replace(/\\s+/g, ' ').trim() + ':' + s.dataset.s)"
    bill(pg, 'HB1523'); pg.wait_for_selector('#bParts'); pg.wait_for_timeout(200); t = pg.evaluate(TLJS)
    cap = [g['cap'] for g in t['groups']]; flat = [x for g in t['groups'] for x in g['stops']]
    ok(cap == ['', 'House', 'Senate', ''] and [x['code'] for x in flat] == ['Introduced', 'TRN', 'JHA', 'Floor vote', 'TRS', 'JDC', 'Floor vote', 'Final votes', 'Governor'], f'HB1523: the timeline is Introduced | House | Senate | final stops, each committee its code ({cap}, {[x["code"] for x in flat]})')
    ok([x['s'] for x in flat] == ['done', 'done', 'done', 'done', 'now', 'todo', 'todo', 'todo', 'todo'], f'HB1523: passed, now and to come marks ({[x["s"] for x in flat]})')
    ok([x['name'] for x in flat] == ['', 'Transportation', 'Judiciary & Hawaiian Affairs', '', 'Transportation', 'Judiciary', '', 'House and Senate agree', ''], f'HB1523: each committee\'s short name sits under its code, without the chamber word ({[x["name"] for x in flat]})')
    ok([x['sub'].replace('\u00a0', ' ') for x in flat] == ['', 'passed Feb 17', 'passed Feb 26', 'passed Mar 6', 'now', '', '', '', ''], f'HB1523: a passed committee says when it passed (from the outcomes in memory), a passed floor vote its day (from the history), the one it is in says "now" ({[x["sub"] for x in flat]})')
    ok(all(x['links'] and x['links'][0].startswith('#/search/committee/') for x in flat if x['k'] == 'cmte') and not any(x['links'] for x in flat if x['k'] != 'cmte') and not revisit(pg, [flat[1]['links'][0]], 'tl'), 'HB1523: each committee code is a link to the committee\'s page, which opens')
    ok(t['vis'] and t['rowhid'] and t['fit'] and not t['over'] and t['w'] and 'Transportation, now' in t['sr'] and 'Introduced, passed' in t['sr'], f'HB1523: at laptop width the timeline shows, the compact drawing hides, no name overflows or overlaps, and a sentence is there for a screen reader ({t["sr"][:80]})')
    bill(pg, 'HB1523'); pg.wait_for_selector('#bParts')
    ok(pg.locator('.bigpath svg.trk.row').count() == 1 and pg.locator('.bigpath .btl a[href^="#/search/committee/"]').count() >= 4, 'HB1523: the compact drawing is still in the page (for phones)')
    # a bill with several joint stops: SB 11 (a Senate bill now in the House)
    bill(pg, 'SB11'); pg.wait_for_selector('#bParts'); pg.wait_for_timeout(200); t = pg.evaluate(TLJS); flat = [x for g in t['groups'] for x in g['stops']]
    ok([g['cap'] for g in t['groups']] == ['', 'Senate', 'House', ''] and flat[1]['code'] == 'WTL / CPN' and flat[2]['code'] == 'WAM / JDC' and len(flat[2]['links']) == 2 and len(flat[1]['links']) <= 2 and [x['s'] for x in flat].count('now') == 1, f'SB11: a Senate bill puts the Senate first; a joint referral is each code (the ones with a page) its own link, "WAM / JDC" ({[x["code"] for x in flat]})')
    ok(any(x['code'] == 'WAL / PBS' and x['s'] == 'now' for x in flat) and t['fit'] and not t['over'] and t['w'], f'SB11: the joint stop it is in is marked now; names fit ({[(x["code"], x["s"]) for x in flat]})')
    ok(any('2025' in x['sub'] for x in flat), f'SB11: a passed stop from another year carries its year ({[x["sub"] for x in flat if x["sub"]]})')
    # six committees (three in each chamber, one of them joint) at the content width
    mc = pick('manycmtes'); bill(pg, mc); pg.wait_for_selector('#bParts'); t = pg.evaluate(TLJS)
    ok(t['vis'] and t['fit'] and not t['over'] and t['w'] and sum(1 for g in t['groups'] for x in g['stops'] if x['k'] == 'cmte') >= 4, f'{mc}: five or more committees wrap inside the page, no overlap, no sideways scroll ({t["w"]}, {t["fit"]}, {t["over"]})')
    snap(pg, 'six_committees.png')
    # ---- the fix round: words never split, one line of dots, only "now" bold, stopped bills, retired codes
    SPLIT = """() => { const bad = []; for (const el of document.querySelectorAll('.bigpath .bts .btk, .bigpath .bts .btnm, .bigpath .bts .btsb')) { const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) { const re = /\\S+/g; let m; while ((m = re.exec(n.data))) { const r = document.createRange(); r.setStart(n, m.index); r.setEnd(n, m.index + m[0].length); if (new Set([...r.getClientRects()].map(x => Math.round(x.top))).size > 1) bad.push(m[0]); } } } return bad; }"""
    DOTS = """() => { const rows = {}; for (const s of document.querySelectorAll('.bigpath .bts')) { const r = s.getBoundingClientRect(), g = Math.round(s.closest('.btg').getBoundingClientRect().top / 8); (rows[g] ||= []).push(r.top); } const ys = Object.values(rows); return { rows: ys.length, ok: ys.every(a => Math.max(...a) - Math.min(...a) <= 1), over: document.documentElement.scrollWidth <= innerWidth && document.querySelector('.bigpath .btl').scrollWidth <= document.querySelector('.bigpath').clientWidth + 1 }; }"""
    # R-409: a date on the path stays in one piece: no sub-line breaks between the month and the day
    DATEBRK = """() => { const bad = []; for (const el of document.querySelectorAll('.bigpath .bts .btsb')) { const r = document.createRange(); r.selectNodeContents(el); const m = el.textContent.match(/[A-Z][a-z]{2}[\\s\\u00a0]\\d+/); if (!m) continue; const at = el.textContent.indexOf(m[0]); const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); const n = w.nextNode(); r.setStart(n, at); r.setEnd(n, at + m[0].length); const rs = [...r.getClientRects()].filter(x => x.width > 0); if (new Set(rs.map(x => Math.round(x.top))).size > 1) bad.push(el.textContent); } return bad; }"""
    dtb = []; ndt = 0
    for num_ in ('HB108', 'SB11', 'HB1523'):
        bill(pg, num_); pg.wait_for_selector('#bParts'); pg.wait_for_timeout(200)
        dtb += pg.evaluate(DATEBRK); ndt += pg.evaluate("() => [...document.querySelectorAll('.bigpath .bts .btsb')].filter(e => /[A-Z][a-z]{2}\\u00a0\\d/.test(e.textContent)).length")
    ok(not dtb and ndt > 0, f'1440: no path sub-line breaks between the month and the day ({ndt} dates checked, broken: {dtb[:3]})')
    for num_ in ('HB108', 'SB11', 'HB1523'):
        bill(pg, num_); pg.wait_for_selector('#bParts'); pg.wait_for_timeout(200)
        sp = pg.evaluate(SPLIT); dt = pg.evaluate(DOTS)
        ok(not sp and dt['ok'] and dt['over'], f'{num_}: no word of a stop label breaks in the middle ({sp[:3]}), every dot of a row sits on one line ({dt}), nothing overflows')
    wrap = pg.evaluate("() => new Set([...document.querySelectorAll('.bigpath .btg')].map(g => Math.round(g.getBoundingClientRect().top))).size")
    bill(pg, 'HB108'); pg.wait_for_selector('#bParts'); rows108 = pg.evaluate(DOTS)['rows']
    ok(rows108 >= 2, f'HB108: with five committees the groups go onto a second row (House row, then Senate row) rather than squeezing ({rows108} rows)')
    # weights: only the stop it is at is bold; links keep their own weight
    bill(pg, 'HB1523'); pg.wait_for_selector('#bParts')
    wt = pg.evaluate("() => [...document.querySelectorAll('.bigpath .bts')].map(s => [s.dataset.k, s.dataset.s, +getComputedStyle(s.querySelector('.btk')).fontWeight, [...s.querySelectorAll('.btk a')].map(a => +getComputedStyle(a).fontWeight)])")
    ok(all((w >= 700) == (st_ == 'now') for k, st_, w, ls in wt) and all(all(x >= 700 for x in ls) for k, st_, w, ls in wt) and any(k == 'floor' and w == 400 for k, st_, w, ls in wt), f'HB1523: only the stop it is at is bold; Introduced, Floor vote, Final votes and Governor are regular; committee codes keep their link weight ({[(k, w) for k, st_, w, ls in wt]})')
    # retired codes: SB11's WTL is "Water and Land", plain text, and nothing says "Senate committee"
    bill(pg, 'SB11'); pg.wait_for_selector('#bParts'); t = pg.evaluate(TLJS); flat = [x for g in t['groups'] for x in g['stops']]
    ok('Water and Land' in flat[1]['name'] and 'Senate committee' not in pg.inner_text('.paper') and not any(l.endswith('/WTL') for l in flat[1]['links']), f'SB11: the retired code WTL reads "Water and Land" in the timeline, as plain text, and no "Senate committee" is on the page ({flat[1]["name"]})')
    rl = pg.evaluate("async () => { const w = await import('/staff7/bill_words.js'), d = await import('/staff6/data.js'), b = d.S.bills.find(x => x.bill_number === 'SB11'); return [w.cmteLabel('WTL', b), w.cmteLabel('HRE', b), w.cmtesText('WTL/CPN', b), w.cmteLabel('ZZZ', b)]; }")
    ok(rl[0] == 'Senate Water and Land' and rl[1] == 'Senate Higher Education' and rl[2].startswith('Senate Water and Land with ') and rl[3] in ('A committee', 'House committee', 'Senate committee'), f'the retired-code map feeds the words too ({rl})')
    ok(pg.evaluate("() => [...document.querySelectorAll('.bill a[href^=\"tel:\"]')].every(a => getComputedStyle(a).whiteSpace === 'nowrap')") and pg.locator('.bill a[href^="tel:"]').count() >= 1, 'SB11: a phone number never wraps inside the number')
    # a stopped bill draws the committees up to where it stopped, "stopped" under that stop and nothing after
    bill(pg, 'HB10'); pg.wait_for_selector('#bParts'); tr = pg.evaluate(TLF); t = pg.evaluate(TLJS)
    sx = pg.evaluate("() => { const x = document.querySelector('.bigpath .bts.bs-x'); return x ? [x.querySelector('.btk').innerText.trim(), x.querySelector('.btnm')?.innerText.trim(), x.querySelector('.btsb').innerText.trim(), getComputedStyle(x, '::before').display, x === [...document.querySelectorAll('.bigpath .bts')].pop()] : null; }")
    ok(sx and sx[2] == 'stopped' and sx[0] != 'First committees' and sx[1] and sx[3] == 'none' and sx[4], f'HB10: a stopped bill ends at the committee it was waiting in, "stopped" under it, nothing after it, no bar glyph ({tr}, {sx})')
    ok(pg.locator('.bigpath svg.trk.row.dead, .bigpath svg.trk.row .tx').count() >= 1, 'HB10: the compact drawing is unchanged (it keeps its bar)')
    # F6, F9, F10, F11 on HB108 / HB1523
    bill(pg, 'HB108'); pg.wait_for_selector('#bParts'); st = pg.evaluate(STAT)
    ok(pg.locator('#bStat .bln:nth-child(1) a[href^="#/search/committee/"]').count() == 1 and not re.search(r'no hearing is scheduled|\bin (House|Senate)', ' '.join(st), re.I) and (len(st) == 1 or re.match(r'^It must be heard by \w{3}, \w{3} \d+\.$', st[1])), f'HB108: a bill in a committee with nothing scheduled and no needs-a-hearing state leads with where it is, the committee a link, and says only the date it must be heard by when the calendar gives one, never the committee again ({st})')
    bill(pg, 'SB11'); st = pg.evaluate(STAT); ok(not any(x.startswith('No hearing is scheduled') for x in st), 'SB11: a bill in the needs-a-hearing state does not get that line as well')
    bill(pg, 'HB1523'); pg.wait_for_selector('#bParts'); ok(pg.locator('#bHearOld').count() == 0, 'HB1523: a bill of this year has no note about earlier hearings')
    pg.evaluate("async () => { const d = await import('/staff6/data.js'), b = d.S.bills.find(x => x.bill_number === 'HB1523'); b.intro_year = 2025; window.__staff7Render({ tick: true }); }"); pg.wait_for_timeout(250)
    ok(pg.locator('#bHearOld').count() == 1 and pg.inner_text('#bHearOld') == 'Hearings before 2026 are in History.' and pg.evaluate("() => { const o = document.getElementById('bHearOld'), h = document.getElementById('bHearH'); return o.previousElementSibling === h && getComputedStyle(o).fontSize === '14px'; }"), 'a carried-over bill with no hearing from before this year in the list says "Hearings before 2026 are in History." under the heading (synthetic: HB1523 made a 2025 bill)')
    pg.evaluate("async () => { const d = await import('/staff6/data.js'), b = d.S.bills.find(x => x.bill_number === 'HB1523'); b.intro_year = null; window.__staff7Render({ tick: true }); }")
    pg.evaluate("async () => { const d = await import('/staff6/data.js'), b = d.S.bills.find(x => x.bill_number === 'HB1523'); window.__ds = b.description; b.description = 'Removes references to countdown timers.  Effective 3/22/2075.  (SD1)'; window.__staff7Render({ tick: true }); }"); pg.wait_for_timeout(250)
    pg.click('#bCapBtn'); pg.wait_for_timeout(150); cd = pg.evaluate("() => ({ d: document.querySelectorAll('#bCapKv dd')[1].innerText, w: [document.getElementById('bCapKv').getBoundingClientRect().width, document.getElementById('bFacts').getBoundingClientRect().width] })")
    ok(cd['d'] == 'Removes references to countdown timers. Effective 3/22/2075.' and abs(cd['w'][0] - cd['w'][1]) < 2, f'the trailing draft tag is cut from the Capitol description, and the section rows are as wide as the page\'s ({cd})')
    pg.click('#bCapBtn')
    pg.evaluate("async () => { const d = await import('/staff6/data.js'), b = d.S.bills.find(x => x.bill_number === 'HB1523'); b.description = window.__ds; }")
    al = pg.evaluate("() => { const dd = [...document.querySelectorAll('#bFacts > div')].map(d => [d.querySelector('dt').innerText, d.querySelector('dd')]); const left = e => Math.round(e.getBoundingClientRect().left); const pub = dd.find(x => x[0] === 'On the public site')[1], tk = dd.find(x => x[0] === 'Talking points')[1]; return [left(pub), left(tk.querySelector('button')), left(tk)]; }")
    ok(abs(al[1] - al[0]) <= 1, f'the Talking points value lines up with the other values ({al})')
    # a one-chamber resolution has no second chamber and no final votes
    pg.evaluate("""async () => { const d = await import('/staff6/data.js'), S = d.S, b = S.bills.find(x => x.bill_number === 'HB1523'); window.__k0 = [b.bill_number, b.referrals, b.origin_stops, b.stage]; b.bill_number = 'HR1523'; b.referrals = ['TRN']; b.origin_stops = 1; b.stage = 'first_lateral'; b.stage_override = null; window.__staff7Render({ tick: true }); }""")
    bill(pg, 'HR1523'); tr = pg.evaluate(TLF)
    ok(tr[0] == 'Introduced:done' and not any(x.startswith('Final votes') for x in tr) and pg.locator('.bigpath .btg .btc').evaluate_all("e => e.map(x => x.innerText.trim())") == ['', 'House', ''], f'a one-chamber resolution has no second chamber and no final votes ({tr})')
    pg.evaluate("""async () => { const d = await import('/staff6/data.js'), S = d.S, b = S.bills.find(x => x.bill_number === 'HR1523'), k = window.__k0; [b.bill_number, b.referrals, b.origin_stops, b.stage] = k; }""")
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
    ok(re.match(r'^(Rep|Sen)\. \S+.* and \d+ others · Show all$', sp0['txt']) and sp0['first'] and sp0['first'].startswith('#/more/legislators/') and sp0['long'], f'{ms}: introduced by a named first sponsor (a link) and N others, Show all ({sp0["txt"]})')
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
    ok(len(st) >= 4 and st[3].startswith('Another hearing ') and pg.locator('#bStat a:has-text("Another hearing")').count() == 1 and 'Agenda' in st[1], f'{hb}: a second scheduled hearing adds a short line, a link; the first one\'s Agenda shows (synthetic: {st[3][:60]})')
    ok(pg.evaluate("() => { const a = [...document.querySelectorAll('#bStat a')].find(x => x.innerText.includes('Agenda')); return a && a.target === '_blank' && a.rel.includes('noopener'); }"), f'{hb}: the Agenda link opens in a new tab with rel=noopener')
    ok(not revisit(pg, [pg.evaluate("() => [...document.querySelectorAll('#bStat a')].find(x => x.innerText.includes('Another hearing')).getAttribute('href')")], 'two'), f'{hb}: the "Another hearing" link opens that sitting')
    pg.evaluate("""async () => { const d = await import('/staff6/data.js'); const b = d.S.bills.find(x => x.bill_number === 'HB1523'); b.position = null; window.__staff7Render({}); }""")
    bill(pg, 'HB1523'); ok(pg.inner_text('#bPos').replace('\n', ' ').startswith('No position yet') and 'HIPHI’s position' not in pg.inner_text('#bPos'), f'a bill with no position says "No position yet" ({pg.inner_text("#bPos").replace(chr(10), " ")})')
    pg.evaluate("""async () => { const d = await import('/staff6/data.js'); const b = d.S.bills.find(x => x.bill_number === 'HB1523'); b.position = 'support'; b.referrals = ['AAA', 'TRN', 'JHA', 'FIN', 'TRS', 'JDC', 'WAM']; b.origin_stops = 4; window.__staff7Render({}); }""")
    pg.wait_for_timeout(300); t = pg.evaluate(TLJS)
    ok(t['vis'] and t['fit'] and not t['over'] and t['w'] and pg.evaluate(NOSIDE), f'seven referrals (four in the first chamber, three in the second) wrap inside the page, nothing overlaps, no sideways scroll (synthetic: {[x["code"] for g in t["groups"] for x in g["stops"]]})')
    ok(not errs and not bad, f'1440: no console error, nothing left 127.0.0.1 ({errs[:2]} {bad[:2]})')
    pg.context.close()

    # ============================================================ a viewer's own bill: the one step, no look-only line; someone else's: look only, no step
    pg, ctx = open_as(br, 'JM', 1440, 900, '#/issues'); errs, bad = ctx._errs, ctx._bad
    ask = pg.evaluate("async () => { const d = await import('/staff6/data.js'), ss = await import('/staff7/steps.js'), me = d.S.advocates.find(a => a.initials === 'JM'); const s = ss.stepsFor(me).find(x => x.kind === 'ask' && x.bill && x.members && x.members.length === 1); return s ? { id: s.id, no: s.bill.bill_number, verb: s.verb } : null; }")
    if ask:
        bill(pg, ask['no'], ''); st = pg.evaluate(STAT); btn = pg.evaluate("() => { const a = document.querySelector('#bStat .bmv a'); return a ? [a.innerText.trim(), a.getAttribute('href'), a.className] : null; }")
        ok(btn and btn[0] == 'Your move · ' + ask['verb'] and btn[1] == '#/do/' + ask['id'] and 'ymove' in btn[2] and 'quiet' in btn[2] and 'text' not in btn[2].split(), f'{ask["no"]}: my own bill with an open step shows the same tonal button the issue page has, "Your move · {ask["verb"]}" ({btn})')
        pos_ = pg.evaluate("() => { const m = document.querySelector('#bStat .bmv .btn').getBoundingClientRect(), l = [...document.querySelectorAll('#bStat .bln')].pop().getBoundingClientRect(), s = document.getElementById('bStat').getBoundingClientRect(), p = document.querySelector('main .bigpath').getBoundingClientRect(); return [m.top - l.bottom, Math.abs(m.left - s.left), p.top - m.bottom]; }")
        ok(0 <= pos_[0] < 40 and pos_[1] < 2 and pos_[2] > 0, f'{ask["no"]}: the button sits on its own line directly under the status lines, left-aligned ({[round(x) for x in pos_]})')
        ok('Look only' not in pg.inner_text('main') and pg.evaluate(NOSIDE), f'{ask["no"]}: no "Look only." line on the bill page')
        snap(pg, 'own_bill_step.png')
    else: ok(False, 'JM has an open ask step to test the button with')
    bill(pg, hb, f'who=KV'); ok('Look only' not in pg.inner_text('main') and pg.locator('#bStat a[href^="#/do/"]').count() == 0 and pg.locator('.ymove').count() == 0, f'{hb}: looking at a teammate\'s list has no "Look only." line and no link to a step')
    me_lead = pg.evaluate("async () => { const d = await import('/staff6/data.js'), S = d.S, me = S.advocates.find(a => a.initials === 'JM'); const b = S.bills.find(x => (S.assignments[x.id] || []).includes(me.id) && x.tracked !== false); return b && b.bill_number; }")
    if me_lead: bill(pg, me_lead, ''); ok(pg.inner_text('#bLead').strip() == 'You lead', f'{me_lead}: a bill I lead says "You lead"')
    # back links: where you came from
    bill(pg, hb, f'i={hi}&from=calendar'); a = pg.evaluate("() => { const a = document.getElementById('tbBack'); return [a.innerText.trim(), a.getAttribute('href')]; }")
    ok(a[0] == 'Back to Calendar' and a[1] == '#/calendar', f'a bill opened from Calendar goes back to Calendar ({a})')
    bill(pg, hb, 'from=search'); a = pg.evaluate("() => { const a = document.getElementById('tbBack'); return [a.innerText.trim(), a.getAttribute('href')]; }")
    ok(a[0] == 'Back to Search' and a[1] == '#/search', f'a bill opened from Search goes back to Search ({a})')
    bill(pg, hb, f'i={hi}'); a = pg.evaluate("() => document.getElementById('tbBack').innerText.trim()"); ok((a.startswith('Back to ') or a.startswith('Issues')) and 'Calendar' not in a and 'Search' not in a, f'a bill opened from the Issues list goes back to its issue ({a})')
    bill(pg, hb, 'from=bogus'); ok(pg.evaluate("() => document.getElementById('tbBack').getAttribute('href')").startswith('#/issue'), 'an unknown from= is ignored')
    go(pg, '#/calendar?who=all'); pg.wait_for_timeout(300); go(pg, pg.evaluate("() => document.querySelector('a.cgc.sit').getAttribute('href')")); pg.wait_for_timeout(300)
    cb = pg.evaluate("() => [...document.querySelectorAll('.paper a[href^=\"#/bill/\"]')].map(a => a.getAttribute('href'))")
    ok(cb and all('from=calendar' in h for h in cb), f'Calendar\'s links to a bill carry from=calendar ({len(cb)} links)')
    go(pg, '#/search?q=cross'); pg.wait_for_timeout(700)
    sb_ = pg.evaluate("() => [...document.querySelectorAll('#slist a[data-k=bill]')].map(a => a.getAttribute('href'))")
    ok(sb_ and all('from=search' in h for h in sb_), f'Search\'s links to a bill carry from=search ({len(sb_)} links)')
    pg.click('#slist a[data-k=bill] >> nth=0'); pg.wait_for_timeout(500); ok(pg.inner_text('#tbBack').strip() == 'Back to Search', 'a bill picked in Search says Back to Search')
    ok(not errs and not bad, f'JM: no console error, nothing left 127.0.0.1 ({errs[:2]} {bad[:2]})')
    pg.context.close()

    # ============================================================ SB11 as JM: needs a hearing, the chairs, who asked, the committees after this one
    pg, ctx = open_as(br, 'JM', 1440, 900, '#/bill/SB11'); errs, bad = ctx._errs, ctx._bad; pg.wait_for_selector('#bParts', timeout=20000)
    st = pg.evaluate(STAT)
    ok(st[1].startswith('Needs a hearing by ') and st[2].startswith('If it is not heard by then, it stops for the year. Chairs: ') and ' and ' in st[2], f'SB11: line 3 says what happens, then "Chairs: A and B" for a joint committee ({st[2]})')
    ch = pg.evaluate("() => [...document.querySelectorAll('#bStat .bln:nth-child(3) a')].map(a => [a.innerText.trim(), a.getAttribute('href')])")
    ok(re.match(r'^If it is not heard by then, it stops for the year\. Chairs: (Rep|Sen)\. \w+ \(Room \w+, [\d-]+\) and (Rep|Sen)\. \w+ \(Room \w+, [\d-]+\)$', st[2]) and sum(1 for h in ch if h[1].startswith('#/more/legislators/')) == 2 and sum(1 for h in ch if h[1].startswith('tel:')) == 2, f'SB11: each chair is a link with room and a phone as a tel: link ({ch})')
    ok(not revisit(pg, [h[1] for h in ch if h[1].startswith('#/')], 'chair'), 'SB11: each chair\'s link opens the legislator\'s page'); go(pg, '#/bill/SB11'); pg.wait_for_selector('#bParts')
    ok(len(st) >= 4 and re.match(r'^[12] more committees? after this one: .+', st[3]) and (' then ' in st[3]) and pg.locator('#bStat .bln:nth-child(4).m a[href^="#/search/committee/"]').count() >= 1, f'SB11: a muted line says how many committees come after this one, each a link ({st[3:]})')
    ok(not any('asked the chair' in x for x in st), 'SB11: nobody has asked yet, so no "asked" sentence (the practice copy holds no chair ask for it)')
    # before the history has come nothing about asks is shown; after, the newest ask is told
    pg.evaluate("""async () => { const m = await import('/staff7/bill_data.js'), d = await import('/staff6/data.js'), S = d.S, b = S.bills.find(x => x.bill_number === 'SB11'), leg = S.legislators.find(l => String(l.id) === String(S.committeeMembers.find(c => c.committee === 'WAL' && c.role === 'chair').legislator_id));
      await d.DB.addLegNote(leg.id, b.id, 'Asked for a hearing on SB 11 (WAL).', { answer: 'asked', committee: 'WAL' }); S.convCache = {}; m.cache.delete(b.id); window.__staff7Render({ tick: true }); }""")
    pg.wait_for_selector('#bParts', timeout=10000); pg.wait_for_timeout(300); st = pg.evaluate(STAT)
    # R-398 piece 5 part 2: the ask's own line ("You asked ... · no reply yet", bill_chair.js) now says who asked and when, so the old muted clause "Jess asked the chairs' offices on ..." is not said twice
    ok(len(st) >= 4 and re.match(r'^[12] more committees? after this one: ', st[3]) and not any('asked the chair' in x for x in st) and re.match(r'^\w+ asked [^·]+ for a hearing on \w{3}, \w{3} \d+ · no reply yet', pg.inner_text('#bChair')), f'SB11: once an ask is on record the committees after come next and the ask is said once, in its own line ({st[3:]} / {pg.inner_text("#bChair") if pg.locator("#bChair").count() else None})')
    pg.evaluate("""async () => { const m = await import('/staff7/bill_data.js'), d = await import('/staff6/data.js'); m.cache.set(d.S.bills.find(x => x.bill_number === 'SB11').id, 'loading'); window.__staff7Render({ tick: true }); }"""); pg.wait_for_timeout(200)
    st = pg.evaluate(STAT); ok(st[1].startswith('Needs a hearing by') and not any('asked the chair' in x for x in st) and len(pg.evaluate(STAT)) >= 2, 'SB11: while the history is still loading nothing about asks is shown, and the top of the page is drawn')
    ok(pg.evaluate(NOSIDE), 'SB11: no sideways scroll')
    snap(pg, 'needs_hearing_bill.png')
    ok(not errs and not bad, f'SB11: no console error, nothing left 127.0.0.1 ({errs[:2]} {bad[:2]})')
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
    ok(pg.inner_text('#bHearH') == 'Hearings and votes so far' and pg.evaluate("() => document.getElementById('bHearH').getBoundingClientRect().top < document.getElementById('bNotesH').getBoundingClientRect().top"), 'HB1523: the block is called "Hearings and votes so far" and stands above Team notes')
    ok([p['head'] for p in ph] == ['Fri, Mar 6 · House floor, third reading', 'Thu, Feb 26 · House Judiciary & Hawaiian Affairs', 'Thu, Feb 12 · House Transportation'], f'HB1523: newest first, the House floor vote a row of its own, a result for each hearing, the two Transportation sittings as one ({[p["head"] for p in ph]})')
    ok(ph[0]['sub'] == 'Passed · 1 voted no, 3 excused' and not ph[0]['links'], f'HB1523: the floor vote row says "Passed" and the counts the Capitol\'s line gives in full ({ph[0]["sub"]})')
    ok(re.match(r'^Passed, no changes · 8 yes, 0 no, 2 excused · Our testimony, filed by Lauren · Everyone’s testimony$', ph[1]['sub']), f'HB1523: Feb 26 reads result, vote, our testimony and who filed, everyone\'s testimony ({ph[1]["sub"]})')
    ok(ph[2]['sub'].startswith('Passed with changes on Feb 17 · 7 yes, 0 no, 2 excused') and 'reservations' not in ph[2]['sub'], f'HB1523: Feb 12 says when the changes passed, and the vote ("with reservations" is not said: its count is not stated) ({ph[2]["sub"]})')
    hr = [p for p in ph if p['cm']]
    ok(all(len(p['links']) == 2 and p['links'][0][0] == 'Our testimony' and p['links'][0][3].startswith('https://docs.google.com/') and p['links'][1][0] == 'Everyone’s testimony' and all(l[1] == '_blank' and 'noopener' in l[2] and l[3].startswith('https://') for l in p['links']) for p in hr), 'HB1523: "Our testimony" (its Doc) and "Everyone’s testimony" are external links (new tab, rel=noopener) on each row that filed')
    ok(all(p['cm'][0].startswith('#/search/committee/') for p in hr) and not revisit(pg, [hr[0]['cm'][0]], 'c'), 'HB1523: each committee is a link that opens')
    bill(pg, 'HB2300'); pg.wait_for_selector('#bParts'); p2 = pg.evaluate(PH)
    ok(len([p for p in p2 if p['cm']]) == 2 and all(p['sub'].endswith('we did not file') and not p['links'] for p in p2 if p['cm']), f'HB2300: a hearing where nothing was filed says "we did not file" and has no "Everyone’s testimony" link ({[p["sub"] for p in p2]})')
    # synthetic: a filed draft with no link, a cancelled hearing, a joint hearing
    pg.evaluate("""async () => { const d = await import('/staff6/data.js'), S = d.S, b = S.bills.find(x => x.bill_number === 'HB2300'); const h = S.hearings.find(x => x.bill_id === b.id && new Date(x.scheduled_at) < Date.now());
      (S.drafts[b.id] ||= []).push({ id: 'syn-f', bill_id: b.id, committee: h.committee, hearing_id: h.id, status: 'filed', filed_by: S.advocates[3].id, filed_at: h.scheduled_at, filed_url: null });
      S.hearings.push({ ...h, id: 'syn-c', status: 'cancelled', scheduled_at: new Date(Date.now() - 20 * 864e5).toISOString(), committee: 'EDN/FIN' }); window.__staff7Render({}); }""")
    pg.wait_for_timeout(300); p3 = pg.evaluate(PH)
    ok(any('Our testimony, filed by Kevin' in p['sub'] and 'Everyone' not in p['sub'] and not p['links'] for p in p3), f'a filed draft with no Doc link and no filed_url shows who filed and no links (synthetic)')
    cx = [p for p in p3 if 'Cancelled' in p['sub']]
    ok(cx and ' with ' in cx[0]['head'] and 'filed' not in cx[0]['sub'] and 'did not file' not in cx[0]['sub'] and len(cx[0]['cm']) == 2, f'a cancelled joint hearing says Cancelled, names both committees, and says nothing about testimony (synthetic: {cx[0]["head"] if cx else None} / {cx[0]["sub"] if cx else None})')
    # votes: parsed, and a sentence that cannot be read in full shows no vote
    vt = pg.evaluate("""async () => { const bh = await import('/staff7/bill_history.js'); return [
      bh.voteWords('The committee on TRN recommend that the measure be PASSED, WITH AMENDMENTS. The votes were as follows: 7 Ayes: Representative(s) Kila, Miyake; Ayes with reservations: Representative(s) Muraoka;  Noes: none; and 2 Excused: Representative(s) Cochran, Pierick.'),
      bh.voteWords('The committee(s) on  GVO recommend(s) that the measure be PASSED, WITH AMENDMENTS.  The votes in GVO were as follows: 4 Aye(s): Senator(s) McKelvey; Aye(s) with reservations: none ; 0 No(es): none; and 1 Excused: Senator(s) Fevella.'),
      bh.voteWords('The committee on HSH recommend that the measure be PASSED, WITH AMENDMENTS. The votes were as follows: 9 Ayes: Marten; Ayes with reservations: none;  Noes: none; and  Excused: none.'),
      bh.voteWords('The committee on JHA recommend that the measure be PASSED. The votes were as follows: 9 Ayes: Tarnas; 2 Ayes with reservations: Shimizu, Garcia; 1 Noes: Poepoe; and 1 Excused: Cochran.'),
      bh.voteWords('The committee on FIN recommend that the measure be PASSED, UNAMENDED. The votes were as follows: 14 Ayes: Yamashita, Takenouchi; Ayes with reservations: none;  Noes'),
      bh.voteWords('The committee on PSM deferred the measure.'), bh.voteWords('') ]; }""")
    ok(vt[0] == '7 yes, 0 no, 2 excused' and vt[1] == '4 yes, 0 no, 1 excused' and vt[2] == '9 yes, 0 no, 0 excused' and vt[4] == '' and vt[5] == '' and vt[6] == '', f'the vote sentence is read in both forms, counts only; a cut sentence or none gives no vote ({vt})')
    ok(vt[3] == '9 yes, 1 no, 1 excused (2 with reservations)', f'a sentence read in full with a stated reservation count says it ({vt[3]})')
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
    ok(len(cap) >= 10 and sum(1 for c in cap if not c['hid']) == 4 and pg.inner_text('#bCap button[data-bmore]') == f'Show all {len(cap)}' and 'what the Capitol did' in pg.get_attribute('#bCap button[data-bmore]', 'aria-label'), f'HB1523: What the Capitol did shows four of {len(cap)}, "Show all {len(cap)}", and its button says which list it is for')
    ok(cap[0]['t'].startswith('Hearing moved') and 'Fri, Mar 13 · Senate' in cap[0]['t'] and not any(c['t'].startswith('Hearing set: Senate Transportation Tue 3/17, 3:05') for c in cap), f'HB1523: newest first, each with its date and chamber; two same-day lines setting one hearing show only the later ("{cap[0]["t"][:60]}")')
    ok(not any(re.search(r'\b(TRS|JDC|JHA|TRN)\b', c['t']) for c in cap) and len({c['t'] for c in cap}) == len(cap), 'HB1523: committee codes are in words and no line repeats')
    ok(sum(1 for c in our if not c['hid']) == 4 and pg.inner_text('#bOurs button[data-bmore]').startswith('Show all'), f'HB1523: What we did shows four and its own Show all ({len(our)} rows)')
    alltxt = ' | '.join(c['t'] for c in our)
    ok('Kris changed the position: Monitor to Support' in alltxt and 'Kris made Patti the lead' in alltxt and 'Patti asked the Senate Transportation chair for a hearing' in alltxt and 'Lauren sent testimony for approval' in alltxt and 'Nate approved the testimony' in alltxt and 'Lauren filed testimony' in alltxt and 'added a note' not in alltxt, 'HB1523: What we did merges position and lead changes, the hearing request and the testimony steps, and does not list the notes again')
    ok('priority' not in alltxt.lower(), 'HB1523: a priority change is left out')
    pg.click('#bCap button[data-bmore]'); pg.click('#bOurs button[data-bmore]'); pg.wait_for_timeout(100); pg.evaluate("() => window.__staff7Tick()"); pg.wait_for_timeout(300)
    ok(all(not c['hid'] for c in pg.evaluate(H, 'bCap')) and all(not c['hid'] for c in pg.evaluate(H, 'bOurs')), 'HB1523: each history list has its own Show all, and both stay open across the minute\'s redraw')
    pos = pg.evaluate("() => { const a = document.getElementById('bCap').getBoundingClientRect(), b = document.getElementById('bOurs').getBoundingClientRect(); return [a.left, b.left, a.top, b.top]; }")
    ok(pos[1] > pos[0] + 200 and abs(pos[2] - pos[3]) < 5, f'at laptop width the two history lists sit side by side ({pos})')
    # --- the order, the closed Capitol section
    ord_ = pg.evaluate("() => { const t = id => document.getElementById(id).getBoundingClientRect().top; return [t('bHearH'), t('bNotesH'), t('bCap2'), t('bHistH')]; }")
    ok(ord_ == sorted(ord_) and len(set(ord_)) == 4, f'HB1523: the order is Hearings and votes so far, Team notes, More from the Capitol’s page, History ({ord_})')
    cb = pg.evaluate("() => { const b = document.getElementById('bCapBtn'); return [b.getAttribute('aria-expanded'), b.innerText.replace(/\\s+/g, ' ').trim(), document.getElementById('bCapKv').hidden, b.getBoundingClientRect().height, getComputedStyle(document.getElementById('bCapKv')).display]; }")
    ok(cb[0] == 'false' and cb[1] == 'More from the Capitol’s page official title, description, versions' and cb[2] and cb[3] >= 44 and cb[4] == 'none', f'HB1523: the Capitol section is closed, a button row with its contents named in muted words ({cb})')
    pg.click('#bCapBtn'); pg.wait_for_timeout(150)
    ck = pg.evaluate("() => ({ x: document.getElementById('bCapBtn').getAttribute('aria-expanded'), hint: document.querySelector('#bCapBtn .bcaph').hidden, rows: [...document.querySelectorAll('#bCapKv > div')].map(d => [d.querySelector('dt').innerText, d.querySelector('dd').innerText.replace(/\\s+/g, ' ').trim()]), links: [...document.querySelectorAll('#bCapKv a')].map(a => [a.innerText.trim(), a.getAttribute('href'), a.target, a.rel]) })")
    ok(ck['x'] == 'true' and ck['hint'] and [r[0] for r in ck['rows']] == ['Official title', 'The Capitol’s description', 'Versions'], f'HB1523: opened, it has Official title, The Capitol’s description and Versions, nothing else ({[r[0] for r in ck["rows"]]})')
    ok(ck['rows'][0][1] != ck['rows'][0][1].upper() and ck['rows'][0][1].startswith('Relating to the statewide'), f'HB1523: the official title is in normal case ({ck["rows"][0][1]})')
    ok('countdown timers' in ck['rows'][1][1] and not re.search(r'vap(e|es|ing)\b', ck['rows'][1][1], re.I), 'HB1523: the Capitol\'s description is as written')
    ok([l[0] for l in ck['links']] == ['HD 1, the current one', 'As introduced'] and re.search(r'/bills/HB1523_HD1_\.HTM$', ck['links'][0][1]) and re.search(r'/bills/HB1523_\.HTM$', ck['links'][1][1]) and all(l[2] == '_blank' and 'noopener' in l[3] for l in ck['links']), f'HB1523: versions are the current one and the bill as introduced, each an outside link ({ck["links"]})')
    pg.evaluate("() => window.__staff7Tick()"); pg.wait_for_timeout(300)
    ok(pg.evaluate("() => !document.getElementById('bCapKv').hidden") and pg.get_attribute('#bCapBtn', 'aria-expanded') == 'true', 'HB1523: the open section stays open across the minute\'s redraw')
    pg.evaluate("""async () => { const m = await import('/staff7/bill_data.js'), d = await import('/staff6/data.js'), b = d.S.bills.find(x => x.bill_number === 'HB1523'), c = m.cache.get(b.id); c.tl.push({ bill_id: b.id, type: 'status_auto', title: 'Passed Second Reading as amended in SD 1 and referred to JDC.', details: 'Official action - Senate', occurred_at: '2026-03-12T20:00:00.000Z', source: 'auto', advocate_id: null }); window.__staff7Render({ tick: true }); }"""); pg.wait_for_timeout(250)
    ok([a.strip() for a in pg.evaluate("() => [...document.querySelectorAll('#bCapKv a')].map(a => a.innerText)")] == ['HD 1, the current one', 'SD 1', 'As introduced'], 'HB1523: an earlier draft the history names (SD 1) gets its own link between the current one and the introduced one')
    pg.evaluate("""async () => { const m = await import('/staff7/bill_data.js'), d = await import('/staff6/data.js'), b = d.S.bills.find(x => x.bill_number === 'HB1523'); window.__cv = b.current_version; b.current_version = null; m.cache.get(b.id).tl = []; window.__staff7Render({ tick: true }); }"""); pg.wait_for_timeout(250)
    ok([a.strip() for a in pg.evaluate("() => [...document.querySelectorAll('#bCapKv a')].map(a => a.innerText)")] == ['As introduced'], 'a bill with only its introduced version shows just that')
    pg.evaluate("""async () => { const d = await import('/staff6/data.js'); d.S.bills.find(x => x.bill_number === 'HB1523').current_version = window.__cv; }""")
    fc = pg.evaluate("""async () => { const f = await import('/staff7/bill_floor.js'); return [
      f.floorCounts('Passed Third Reading with none voting aye with reservations; Representative(s) Olds voting no (1) and Representative(s) Perruso, Quinlan, Sayama excused (3).  Transmitted to Senate.'),
      f.floorCounts('Report adopted; Passed Third Reading, as amended (SD  2). Ayes, 25; Aye(s) with reservations: none .  Noes, 0 (none). Excused, 0 (none).  Transmitted to House.'),
      f.floorCounts('Passed Third Reading with none voting aye with reservations; Representative(s) Olds voting no (1) and Representative(s) Perruso, Quin'),
      f.floorCounts('Report Adopted; Passed Third Reading, as amended (SD 1).  Ayes, 22; Aye(s) with reservations: none.  Noes, 0 (none).  Exc'),
      f.floorCounts('Passed Third Reading.'),
      f.floorCounts('Passed Third Reading with none voting aye with reservations; none voting no (0) and Representative(s) Cochran, Pierick, Templo, Ward excused (4).  Transmitted to Senate.'),
      f.floorVotes([{ title: 'Passed Third Reading.  Transmitted to Senate.', details: 'Official action - House', occurred_at: '2026-03-06T18:00:00.000Z', source: 'auto' }, { title: 'Reported from JHA, recommending passage on Third Reading.', details: 'Official action - House', occurred_at: '2026-03-06T18:00:00.000Z', source: 'auto' }]).map(x => x.chamber + '|' + x.counts) ]; }""")
    ok(fc[0] == '1 voted no, 3 excused' and fc[1] == '25 yes, 0 no, 0 excused' and fc[2] == '' and fc[3] == '' and fc[4] == '' and fc[6] == ['House|'] and fc[5] == 'none voted no, 4 excused', f'floor vote counts are read only when the Capitol\'s line gives them in full, never partial or wrong ({fc})')
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
        for (const b of S.bills.filter(b => b.tracked !== false && issueOf(b))  ) { const i = issueOf(b), lead = (S.assignments[b.id] || []).includes(a.id), own = i.owner_id === a.id, adm = !!a.is_admin;
          const k = lead && !adm ? 'lead' : own && !lead && !adm ? 'owner' : adm && !lead && !own ? 'admin' : !lead && !own && !adm ? 'none' : ''; if (k && !out[k]) out[k] = { ini: a.initials, bill: b.bill_number }; } } } finally { S.me = prev; }
      // a bill with a lead assigned and no issue owner to stand in for it; a bill that is not public; one that is
      const nobody = S.bills.find(b => b.tracked !== false && (S.assignments[b.id] || []).length === 1 && !(issueOf(b) && issueOf(b).owner_id));
      const pub = S.bills.find(b => b.tracked !== false && b.is_public && issueOf(b) && (S.assignments[b.id] || []).length), priv = S.bills.find(b => b.tracked !== false && !b.is_public && (S.assignments[b.id] || []).length && issueOf(b));
      out.nobody = nobody ? nobody.bill_number : null; out.pub = pub ? [pub.bill_number, S.advocates.find(a => a.id === S.assignments[pub.id][0]).initials] : null; out.priv = priv ? [priv.bill_number, S.advocates.find(a => a.id === S.assignments[priv.id][0]).initials] : null;
      return out; }""")
    pg0.context.close()
    print('who sees the button:', WHO, flush=True)
    ok(all(WHO.get(k) for k in ('lead', 'admin', 'none', 'nobody', 'pub')), f'the practice copy has a lead, an issue owner, an admin and a stranger to test with, a bill with a lead and no owner to stand in, a public and a private bill ({ {k: WHO.get(k) for k in ("lead", "owner", "admin", "none")} })')
    for kind in ('lead', 'admin', 'none'):
        w = WHO[kind]; pgx, cx = open_as(br, w['ini'], 1440, 900, f'#/bill/{w["bill"]}'); pgx.wait_for_selector('#bParts', timeout=20000)
        see = pgx.locator('#bEditGo').count() == 1; txt = pgx.locator('#bEditGo').inner_text() if see else ''
        ok(see == (kind != 'none') and (not see or txt == 'Change position or lead'), f'{w["ini"]} ({kind}) on {w["bill"]}: the "Change position or lead" button is {"shown" if see else "not shown"}')
        ok(pgx.locator('#bNoteOpen').count() == 1 and pgx.inner_text('#bNoteOpen') == 'Add a note' and pgx.locator('#bNoteIn').count() == 0, f'{w["ini"]} ({kind}): the note box starts closed, as one quiet button "Add a note", for every team viewer')
        pgx.click('#bNoteOpen'); ok(pgx.locator('#bNoteIn').count() == 1 and pgx.inner_text('label[for=bNoteIn]') == 'Add a note for the team', f'{w["ini"]} ({kind}): the button opens the box')
        if kind == 'none':
            go(pgx, f'#/bill/{w["bill"]}?who=all'); pgx.wait_for_selector('#bParts'); ok('Look only' not in pgx.inner_text('main') and pgx.locator('#bEditGo').count() == 0 and pgx.locator('#bNoteOpen, #bNoteIn').count() == 1, f'{w["ini"]}: looking at everyone\'s list: no change button, no "Look only." line, but the note box is still there')
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
    O = ['strongly_support', 'support', 'support_amend', 'monitor', 'neutral', 'oppose', 'strongly_oppose']; labels = sorted(labels, key=lambda l: O.index(l[0]))   # the picker puts Oppose before Strongly oppose (R-398 gap B)
    ok(lab['legend'] == 'Position' and lab['lead'] == 'Lead' and [r[:2] for r in lab['radios']][:-1] == labels and lab['radios'][-1][:2] == ['', 'No position yet'] and sum(1 for r in lab['radios'] if r[2]) == 1, f'the position choices are the data layer\'s own labels in the support-to-oppose order, plus "No position yet" ({[r[1] for r in lab["radios"]]})')
    ownw = pg.evaluate("async () => { const d = await import('/staff6/data.js'), S = d.S, b = S.bills.find(x => x.bill_number === 'HB2300'), i = S.issues.find(i => S.billIssues.some(x => x.bill_id === b.id && x.issue_id === i.id)); const o = S.advocates.find(a => a.id === i.owner_id); return o ? o.full_name.split(' ')[0] + ', who leads the issue' : 'Nobody'; }")
    ok(lab['opts'][0] == ownw and 'Nate' in lab['opts'] and 'Kris' in lab['opts'] and len(lab['opts']) == 1 + pg.evaluate("async () => (await import('/staff6/data.js')).S.advocates.filter(a => a.is_active !== false).length"), f'the lead select has Nobody and every active teammate by first name ({lab["opts"]})')
    ok(lab['save'] and 'filled' in lab['savecls'], 'Save is a filled button and is disabled until something changes')
    pub23 = pg.evaluate("async () => (await import('/staff6/data.js')).S.bills.find(b => b.bill_number === 'HB2300').is_public")
    ok((pg.locator('.beact .hint').count() == 0) if pub23 else (pg.inner_text('.beact .hint') == "The public site shows HIPHI’s position once its words are published."), 'the old position hint shows only for a bill with no public words (R-398 fix 4: the public-mode line replaces it)')
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
    # R-398 part 3: on a live bill the public site still says its old position, so the toast says so (design 7); a bill that is not public keeps the old words
    want = 'Saved. The public site keeps Support until you publish it.' if live_now(pg) else 'Position: Support w/ amendments'   # this section is Nate's (an admin): his own words
    ok(pg.inner_text('#toast .tin').replace('\n', ' ').startswith(want) and 'Lead' not in pg.inner_text('#toast .tin') and pg.locator('#toastUndo').is_visible(), f'position only: the toast says what changed ("{want}"), with Undo')
    snap(pg, 'c_saved_toast.png')
    pg.click('#toastUndo'); pg.wait_for_timeout(500)
    ok('Support' in pg.inner_text('#bPos') and 'amendments' not in pg.inner_text('#bPos') and pg.evaluate(OURS) == n0 and not pg.evaluate(LISTROW)[0].startswith('Nate changed'), 'position only: Undo puts the position back and takes the row out of the history')
    # lead only, then Undo
    pg.click('#bEditGo'); pg.select_option('#bLeadSel', label='Kris'); pg.click('#bSave'); pg.wait_for_timeout(500)
    ok(pg.inner_text('#bLead').strip() == 'Kris leads' and pg.locator('#bLead a').get_attribute('href') == '#/issues?who=KR' and pg.inner_text('#toast .tin').replace('\n', ' ').startswith('Lead: Kris'), f'lead only: the page says "Kris leads", a link to Kris\'s issues, and the toast says "Lead: Kris" ({pg.inner_text("#bLead")})')
    ok(pg.evaluate(LISTROW)[0].startswith('Nate made Kris the lead') and 'changed the position' not in pg.evaluate(LISTROW)[0], 'lead only: "What we did" reads "Nate made Kris the lead"')
    pg.click('#toastUndo'); pg.wait_for_timeout(500)
    ok(pg.inner_text('#bLead').strip() == 'You lead' and pg.evaluate(OURS) == n0, 'lead only: Undo puts the lead back and removes the row')
    # both at once, then Undo
    pg.click('#bEditGo'); pg.click('#bp-strongly_support'); pg.select_option('#bLeadSel', label='Jess'); pg.click('#bSave'); pg.wait_for_timeout(500)
    rows = pg.evaluate(LISTROW)
    ok('Strongly support' in pg.inner_text('#bPos') and 'Jess leads' in pg.inner_text('#bLead') and pg.evaluate(OURS) == n0 + 2 and any('made Jess the lead' in x for x in rows[:2]) and any('Support to Strongly support' in x for x in rows[:2]), f'both: one Save changes both, with a row for each ({rows[:2]})')
    ok(pg.inner_text('#toast .tin').replace('\n', ' ').startswith('Position: Strongly support · Lead: Jess'), 'both: the toast names both, joined with " · "')
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
    # the old position hint only on a bill with no public words: a public-mode bill shows the new line instead (R-398 fix 4)
    pb = WHO['pub']; pv = WHO['priv'] or [WHO['lead']['bill'], WHO['lead']['ini']]   # every tracked practice bill with a lead is public: the private one is made so in the page
    for (num, ini), want in ((pb, False), (pv, True)):
        pgx, cx = open_as(br, ini, 1440, 900, f'#/bill/{num}'); pgx.wait_for_selector('#bParts')
        if want: pgx.evaluate("async n => { const d = await import('/staff6/data.js'); d.S.bills.find(b => b.bill_number === n).is_public = false; window.__staff7Render({ tick: true }); }", num)
        pgx.click('#bEditGo'); pgx.wait_for_timeout(150)
        has = pgx.locator('.beact .hint').count() == 1 and pgx.inner_text('.beact .hint') == "The public site shows HIPHI’s position once its words are published."
        ok(has == want, f'{num}: the old position hint is {"there" if want else "not there"} on a {"private" if want else "public"} bill (fix 4)')
        pgx.context.close()
    # --- add a note
    bill(pg, 'HB2300', ''); pg.wait_for_selector('#bParts'); nn = pg.evaluate("() => document.querySelectorAll('#bl-notes > li').length"); n2 = pg.evaluate(OURS)
    ok(pg.locator('#bNoteIn').count() == 0 and pg.inner_text('#bNoteOpen') == 'Add a note' and pg.evaluate("() => document.getElementById('bNoteBox').nextElementSibling.id") == 'bPinned' and pg.evaluate("() => document.getElementById('bNoteOpen').getBoundingClientRect().height") >= 44, 'the note box is closed: one quiet "Add a note" button above the notes')
    pg.click('#bNoteOpen'); pg.wait_for_timeout(150)
    ok(pg.evaluate("() => document.activeElement.id") == 'bNoteIn' and pg.locator('#bNoteOpen').count() == 0, 'the button opens the box with the cursor in it')
    pg.keyboard.press('Escape'); pg.wait_for_timeout(150)
    ok(pg.locator('#bNoteIn').count() == 0 and pg.evaluate("() => document.activeElement.id") == 'bNoteOpen', 'Escape closes an empty box, and the focus goes back to the button')
    pg.click('#bNoteOpen'); pg.evaluate("() => window.__staff7Render({ tick: true })"); pg.wait_for_timeout(250)
    ok(pg.locator('#bNoteIn').count() == 1, 'the open box stays open across the minute\'s redraw')
    ok(pg.evaluate("() => document.getElementById('bNoteBox').nextElementSibling.id") == 'bPinned' and pg.inner_text('#bNoteBox .hint') == 'Only the team sees notes.' and pg.inner_text('#bNoteGo') == 'Add the note' and pg.evaluate("() => document.getElementById('bNoteGo').disabled"), 'the note box sits above the notes (pinned note and list), has the hint, and "Add the note" is disabled while the box is empty')
    pg.fill('#bNoteIn', '   \n  '); ok(pg.evaluate("() => document.getElementById('bNoteGo').disabled"), 'spaces only keep "Add the note" disabled')
    pg.fill('#bNoteIn', 'Called the chair\'s office. They will hear it on the 18th.'); ok(not pg.evaluate("() => document.getElementById('bNoteGo').disabled"), 'words enable "Add the note"')
    pg.focus('#bNoteIn'); pg.keyboard.press('Escape'); pg.wait_for_timeout(150); ok(pg.locator('#bNoteIn').count() == 1 and pg.input_value('#bNoteIn').startswith('Called'), 'Escape does not close a box with words in it')
    pg.evaluate("() => window.__staff7Render({ tick: true })"); pg.wait_for_timeout(300)
    ok(pg.input_value('#bNoteIn').startswith('Called the chair') and not pg.evaluate("() => document.getElementById('bNoteGo').disabled"), 'typed words survive the minute\'s redraw')
    snap(pg, 'c_add_note.png')
    pg.evaluate("async () => { const d = await import('/staff6/data.js'); window.__keepM = d.DB.sendMessage; d.DB.sendMessage = async () => { throw new Error('no'); }; }")
    pg.click('#bNoteGo'); pg.wait_for_timeout(400)
    ok(pg.inner_text('#bNoteErr') == 'We could not save that. Try again.' and pg.input_value('#bNoteIn').startswith('Called the chair') and pg.evaluate("() => document.querySelectorAll('#bl-notes > li').length") == nn, 'a failed note keeps the words, says one plain line, and adds nothing')
    pg.evaluate("async () => { const d = await import('/staff6/data.js'); d.DB.sendMessage = window.__keepM; }")
    pg.click('#bNoteGo'); pg.wait_for_timeout(500)
    top = pg.evaluate("() => document.querySelector('#bl-notes > li:first-child').innerText.replace(/\\s+/g, ' ').trim()")
    ok(top.startswith('Nate ·') and 'Called the chair' in top and pg.evaluate("() => document.querySelectorAll('#bl-notes > li').length") == nn + 1 and pg.locator('#bNoteIn').count() == 0 and pg.inner_text('#bNoteOpen') == 'Add a note' and pg.evaluate("() => document.activeElement.id") == 'bNoteOpen', f'the note shows on top of the list at once and the box closes again ({top[:60]})')
    ok(pg.evaluate(OURS) == n2 and not any('added a note' in x for x in pg.evaluate(LISTROW)) and 'Note added' in pg.inner_text('#toast .tin'), 'a note is in the notes list, not repeated in "What we did", and a toast says "Note added"')
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
    pg.click('#bCancel'); pg.evaluate("() => document.getElementById('bNoteOpen').scrollIntoView()"); pg.click('#bNoteOpen'); pg.fill('#bNoteIn', 'x')
    ok(pg.evaluate(NOSIDE) and not pg.evaluate(SMALLC), 'phone: the note box fits, with a 44px button')
    ok(not errs and not bad, f'Part C phone: no console error, nothing left 127.0.0.1 ({errs[:2]} {bad[:2]})')
    pg.context.close()

    # ============================================================ the review round: one wording, no codes, years, plain Capitol lines, real assignments, failures
    pg0, ctx0 = open_as(br, 'NT', 1440, 900, '#/issues')
    W2 = pg0.evaluate("""async () => {
      const d = await import('/staff6/data.js'), S = d.S, out = {};
      const issueOf = b => { const ids = S.billIssues.filter(x => x.bill_id === b.id).map(x => x.issue_id); return S.issues.find(i => ids.includes(i.id) && !i.archived_at); };
      const live = id => !!id && S.advocates.find(a => a.id === id && a.is_active !== false), ini = id => S.advocates.find(a => a.id === id).initials;
      const cands = S.bills.filter(b => b.tracked !== false && issueOf(b) && live(issueOf(b).owner_id) && !S.advocates.find(a => a.id === issueOf(b).owner_id).is_admin && (S.assignments[b.id] || []).length === 1);
      const fb = cands[0], ob = cands.find(b => issueOf(b).owner_id !== issueOf(fb).owner_id) || cands[1], pick = o => S.advocates.find(a => a.is_active !== false && !a.is_admin && a.id !== o && a.initials !== 'KV').initials;
      out.fallback = [fb.bill_number, ini(issueOf(fb).owner_id)]; out.ownerbill = [ob.bill_number, ini(issueOf(ob).owner_id), pick(issueOf(ob).owner_id)];
      // a helper of an issue who neither owns it nor leads the bill, and is no admin
      for (const h of S.issueHelpers || []) { const a = S.advocates.find(x => x.id === h.advocate_id), i = S.issues.find(x => x.id === h.issue_id); if (!a || !i || a.is_admin || i.owner_id === a.id) continue; const bl = S.billIssues.filter(x => x.issue_id === i.id).map(x => S.bills.find(b => b.id === x.bill_id)).find(b => b && b.tracked !== false && !(S.assignments[b.id] || []).includes(a.id)); if (bl) { out.helper = [bl.bill_number, a.initials]; break; } }
      out.ids = Object.fromEntries(S.advocates.map(a => [a.initials, a.id]));
      return out; }""")
    pg0.context.close(); print('review round data:', {k: v for k, v in W2.items() if k != 'ids'}, flush=True)
    ok(W2['fallback'] and W2['ownerbill'], f'the practice copy has bills whose issue owner is not an admin, to make the stand-in cases from ({W2["fallback"]}, {W2["ownerbill"]})')
    if W2.get('helper'):
        ph_, cx_ = open_as(br, W2['helper'][1], 1440, 900, f'#/bill/{W2["helper"][0]}'); ph_.wait_for_selector('#bParts', timeout=20000)
        ok(ph_.locator('#bEditGo').count() == 0 and ph_.locator('#bNoteOpen').count() == 1, f'{W2["helper"][1]} helps on the issue of {W2["helper"][0]} but does not lead it or own the issue: no "Change position or lead" (a helper is not an editor)'); ph_.context.close()
    else: skip('no practice issue has a helper who is neither its owner nor a bill lead')
    pg, ctx = open_as(br, 'NT', 1440, 900, '#/bill/HB1523'); errs, bad = ctx._errs, ctx._bad
    pg.on('dialog', lambda d: errs.append('dialog: ' + d.message))
    pg.wait_for_selector('#bParts', timeout=20000)
    LISTROW = "() => [...document.querySelectorAll('#bOurs li')].slice(0, 3).map(l => l.innerText.replace(/\\s+/g, ' ').trim())"
    OURS = "() => document.querySelectorAll('#bl-ours > li').length"
    # --- D16: each Show all / Show fewer names its list
    labs = pg.evaluate("() => [...document.querySelectorAll('button[data-bmore], button[data-bshow]')].map(b => [b.innerText.trim(), b.getAttribute('aria-label'), b.getAttribute('aria-controls') || 'introducers'])")
    ok(len(labs) >= 3 and all(l[1] and l[1].startswith('Show all') and any(w in l[1] for w in ('introducers', 'notes', 'Capitol', 'we did', 'hearings')) for l in labs), f'every "Show all" button has an aria-label that names its list ({[l[1] for l in labs]})')
    pg.click('#bCap button[data-bmore]'); ok(pg.get_attribute('#bCap button[data-bmore]', 'aria-label').startswith('Show fewer') and 'what the Capitol did' in pg.get_attribute('#bCap button[data-bmore]', 'aria-label'), 'and says "Show fewer ..." when open'); pg.click('#bCap button[data-bmore]')
    # --- D11: one content width
    pg.click('#bNoteOpen'); pg.wait_for_timeout(150)
    wd = pg.evaluate("() => { const f = document.getElementById('bFacts').getBoundingClientRect(), n = document.querySelector('.bnote').getBoundingClientRect(), b = document.getElementById('bNoteBox').getBoundingClientRect(), t = document.getElementById('bNoteIn').getBoundingClientRect(); return [f.width, n.width, b.width, t.width]; }")
    ok(all(abs(w - wd[0]) < 2 for w in wd[1:]), f'the note cards and the note box are as wide as the facts ({[round(w) for w in wd]})')
    # --- D12: the chosen position is marked, not filled
    pg.click('#bEditGo'); pg.wait_for_timeout(150)
    st12 = pg.evaluate("() => { const t = document.createElement('i'); t.style.color = 'var(--ink)'; t.style.background = 'var(--wash)'; document.body.appendChild(t); const c = getComputedStyle(t); const ink = c.color, wash = c.backgroundColor; t.remove(); const on = document.querySelector('#bEdit .bsr:checked + span'), off = document.querySelector('#bEdit .bsr:not(:checked) + span'); const o = getComputedStyle(on), f = getComputedStyle(off); return { bg: o.backgroundColor === wash, notInk: o.backgroundColor !== ink, svg: getComputedStyle(on.querySelector('svg')).display !== 'none', svgOff: getComputedStyle(off.querySelector('svg')).display === 'none', col: o.color === ink, save: getComputedStyle(document.getElementById('bSave')).backgroundColor }; }")
    ok(st12['bg'] and st12['notInk'] and st12['svg'] and st12['svgOff'] and st12['col'], f'the chosen position has the wash background and a check mark in ink, the others do not ({st12})')
    snap(pg, 'f_editing.png'); pg.click('#bCancel')
    # --- D3/D4/D5 on a carryover bill (SB11 stays in the House with codes the data layer has no name for)
    bill(pg, 'SB11', ''); pg.wait_for_selector('#bParts'); tx = pg.inner_text('.pbody.bill')
    ok(not re.search(r'\b(WTL|CPN|WAL|PBS|EEP|WAM|JDC|FIN)\b', pg.inner_text('#bParts')), 'SB11: no Capitol committee code is in the notes, hearings or history (codes belong to the timeline only)')
    capS = pg.evaluate("() => [...document.querySelectorAll('#bl-cap > li')].map(l => l.innerText.replace(/\\s+/g, ' ').trim())")
    ok(any(', 2025' in c for c in capS) and any('Dec 8, 2025' in c for c in capS) and not any(re.search(r'Feb 1\d\b(?!,)', c) and '2025' not in c for c in capS if False), f'SB11 (a carryover): dates from 2025 carry their year ({[c for c in capS if "2025" in c][:2]})')
    # --- D5: plain words for the Capitol's raw lines (HB1523)
    bill(pg, 'HB1523'); pg.wait_for_selector('#bParts'); pg.click('#bCap button[data-bmore]'); capH = pg.evaluate("() => [...document.querySelectorAll('#bl-cap > li .bh1')].map(l => l.innerText.trim())")
    need = ['House Transportation passed it with changes', 'House Judiciary & Hawaiian Affairs passed it, no changes', 'House Transportation deferred it until Tue, Feb 17 9:15 AM', 'Decision set: Tue, Feb 17 9:15 AM · Room 430', 'Passed first reading', 'Introduced']
    ok(all(n_ in capH for n_ in need) and not any(re.search(r'recommend|PASSED|The committee', c) for c in capH), f'HB1523: the Capitol\'s raw sentences are in plain words (missing {[n_ for n_ in need if n_ not in capH]})')
    ok(capH.index('Hearing moved: Senate Transportation to Tue 3/17, 3:00 PM') < 3 and not any('3:05 PM' in c for c in capH), 'HB1523: the later "Hearing moved" is above, and the same-day "Hearing set ... 3:05 PM" is not shown again')
    # --- D4 on a note: a note from another year carries it
    pg.evaluate("""async () => { const d = await import('/staff6/data.js'), S = d.S, b = S.bills.find(x => x.bill_number === 'HB1523'); (S.messages[b.id] ||= []).push({ id: 'old-1', bill_id: b.id, advocate_id: S.advocates[3].id, body: 'An old one', created_at: '2025-12-08T20:00:00.000Z' }); window.__staff7Render({ tick: true }); }""")
    pg.wait_for_timeout(200); ok(any('Dec 8, 2025' in t for t in pg.evaluate("() => [...document.querySelectorAll('#bl-notes small')].map(s => s.innerText)")), 'a team note from 2025 shows its year')
    # --- C3: a joint hearing shows no vote
    pg.evaluate("""async () => { const d = await import('/staff6/data.js'), S = d.S, b = S.bills.find(x => x.bill_number === 'HB1523'); S.hearings.filter(h => h.bill_id === b.id && h.committee === 'JHA').forEach(h => { h.committee = 'JHA/TRN'; }); window.__staff7Render({ tick: true }); }""")
    pg.wait_for_timeout(200); ph2 = pg.evaluate("() => [...document.querySelectorAll('#bl-hear > li')].map(l => l.innerText.replace(/\\s+/g, ' '))")
    ok(len(ph2) == 3 and ' with ' in ph2[1] and not re.search(r'\d+ yes', ph2[1]) and re.search(r'\d+ yes', ph2[2]), f'a joint hearing shows no vote count; the other one still does ({ph2[1][:90]})')
    pg.evaluate("""async () => { const d = await import('/staff6/data.js'), S = d.S, b = S.bills.find(x => x.bill_number === 'HB1523'); S.hearings.filter(h => h.bill_id === b.id && h.committee === 'JHA/TRN').forEach(h => { h.committee = 'JHA'; }); }""")
    # --- C6: an unknown status is escaped once; a cancelled hearing dated ahead is not a past one; committees match by sorted codes
    pg.evaluate("""async () => { const d = await import('/staff6/data.js'), S = d.S, b = S.bills.find(x => x.bill_number === 'HB1523'), base = S.hearings.find(h => h.bill_id === b.id && h.committee === 'JHA');
      S.hearings.push({ ...base, id: 'syn-odd', status: 'odd<b>', scheduled_at: new Date(Date.now() - 40 * 864e5).toISOString() });
      S.hearings.push({ ...base, id: 'syn-fut', status: 'cancelled', scheduled_at: new Date(Date.now() + 9 * 864e5).toISOString() });
      const t = new Date(Date.now() - 50 * 864e5).toISOString(); S.hearings.push({ ...base, id: 'syn-c1', status: 'cancelled', committee: 'WAM/CPN', scheduled_at: t });
      const ahead = new Date(Date.now() + 864e5 * 0).toISOString(); window.__staff7Render({ tick: true }); }""")
    pg.wait_for_timeout(200); ph3 = pg.evaluate("() => [...document.querySelectorAll('#bl-hear > li')].map(l => l.innerText.replace(/\\s+/g, ' '))")
    ok(any('Odd<b>' in x for x in ph3) and not any('&lt;' in x or '&amp;' in x for x in ph3) and len(ph3) == 5, f'an unknown status is shown once-escaped as plain text, and a cancelled hearing dated ahead is not listed as a past one ({[x[:60] for x in ph3]})')
    # --- C6: a live-shaped row (meta {} and JSON in details) reads as a lead change; "Testimony filed with" is not doubled
    pg.evaluate("""async () => { const d = await import('/staff6/data.js'), m = await import('/staff7/bill_data.js'), S = d.S, b = S.bills.find(x => x.bill_number === 'HB1523'), c = m.cache.get(b.id);
      c.tl.push({ bill_id: b.id, type: 'field_change', title: 'Lead changed', details: JSON.stringify({ field: 'lead', old: null, new: S.advocates.find(a => a.initials === 'PH').id }), meta: {}, advocate_id: S.advocates.find(a => a.initials === 'KR').id, occurred_at: '2026-03-14T20:00:00.000Z', source: 'team' });
      c.tl.push({ bill_id: b.id, type: 'status_auto', title: 'Testimony filed with the Senate Transportation committee', details: '', advocate_id: S.advocates.find(a => a.initials === 'LR').id, occurred_at: '2026-03-14T21:00:00.000Z', source: 'team' }); window.__staff7Render({ tick: true }); }""")
    pg.wait_for_timeout(200); pg.click('#bOurs button[data-bmore]'); oursT = pg.evaluate("() => [...document.querySelectorAll('#bl-ours > li')].map(l => l.innerText.replace(/\\s+/g, ' '))")
    ok(any(x.startswith('Kris made Patti the lead') and 'Sat, Mar 14' in x for x in oursT) and not any('Testimony filed with' in x for x in oursT), 'a live-shaped row (meta {} and the fields as JSON in details) reads "Kris made Patti the lead", and a "Testimony filed with ..." activity row is not listed twice')
    # --- C4: committee marks at the first chamber, the floor, a crossover, and a stopped bill
    def marks(stage, refs, ob, committee=None, dead=None):
        pg.evaluate("""async ([stage, refs, ob, cm, dead]) => { const d = await import('/staff6/data.js'), S = d.S, b = S.bills.find(x => x.bill_number === 'HB1523'); window.__k ||= { stage: b.stage, refs: b.referrals, ob: b.origin_stops, cm: b.committee, so: b.stage_override, hs: S.hearings.filter(h => h.bill_id === b.id) };
          S.hearings = S.hearings.filter(h => h.bill_id !== b.id); b.stage_override = null; b.stage = stage; b.referrals = refs; b.origin_stops = ob; b.committee = cm; b.died_at_stage = dead; window.__staff7Render({ tick: true }); }""", [stage, refs, ob, committee, dead])
        pg.wait_for_timeout(250); return pg.evaluate(TLF)
    four = ['TRN', 'JHA', 'TRS', 'JDC']
    m1 = marks('first_lateral', four, 2, 'TRN'); ok(m1 == ['Introduced:done', 'TRN:now', 'JHA:todo', 'Floor vote:todo', 'TRS:todo', 'JDC:todo', 'Floor vote:todo', 'Final votes:todo', 'Governor:todo'], f'in the first chamber: the committee it is in is now, the rest to come ({m1})')
    m2 = marks('first_floor', four, 2); ok(m2 == ['Introduced:done', 'TRN:done', 'JHA:done', 'Floor vote:now', 'TRS:todo', 'JDC:todo', 'Floor vote:todo', 'Final votes:todo', 'Governor:todo'], f'on the first chamber\'s floor: its committees passed, its floor vote is now ({m2})')
    m3 = marks('first_crossover', ['TRN', 'JHA'], 2); ok(m3 == ['Introduced:done', 'TRN:done', 'JHA:done', 'Floor vote:done', 'Not referred yet:now', 'Final votes:todo', 'Governor:todo'], f'crossed over with no committee of the other chamber yet: the first chamber is passed, the second says "Not referred yet" ({m3})')
    m4 = marks('dead', four, 2, None, 'second_lateral'); ok(m4[:4] == ['Introduced:done', 'TRN:done', 'JHA:done', 'Floor vote:done'] and m4[-1].endswith(':x') and len(m4) in (5, 6) and pg.locator('.bigpath .btl.dead').count() == 1 and m4[-1] != 'Second chamber:x', f'a bill that stopped in a second-chamber committee: the first chamber is passed, then the committees up to where it stopped, nothing after it ({m4})')
    m5 = marks('dead', four, 2, None, 'first_lateral'); ok(m5[0] == 'Introduced:done' and m5[-1].endswith(':x') and m5[-1] != 'First committees:x' and not any(x.startswith(('JDC', 'TRS')) for x in m5), f'a bill that stopped in a first committee: that committee is where it stopped ({m5})')
    m5b = marks('dead', four, 2, None, 'first_floor'); ok(m5b[0] == 'Introduced:done' and m5b[-1].endswith(':x') and len(m5b) <= 5, f'a bill stopped with no committee named keeps the general stop or the floor ({m5b})')
    pg.evaluate("""async () => { const d = await import('/staff6/data.js'), b = d.S.bills.find(x => x.bill_number === 'HB1523'); b.died_at_stage = null; b.stage = 'dead'; window.__staff7Render({ tick: true }); }"""); pg.wait_for_timeout(250)
    m5c = pg.evaluate(TLF); ok(m5c == ['Introduced:done', 'First committees:x'], f'a stopped bill whose committee the data does not name keeps one general stop ({m5c})')
    m6 = marks('second_floor', four, 2); ok(m6 == ['Introduced:done', 'TRN:done', 'JHA:done', 'Floor vote:done', 'TRS:done', 'JDC:done', 'Floor vote:now', 'Final votes:todo', 'Governor:todo'], f'on the second chamber\'s floor ({m6})')
    m7 = marks('introduced', [], 0); ok(m7[0] == 'Introduced:now' and not any(x.endswith(':x') for x in m7), f'not referred yet: Introduced is now, the chambers are general stops ({m7})')
    pg.evaluate("""async () => { const d = await import('/staff6/data.js'), S = d.S, b = S.bills.find(x => x.bill_number === 'HB1523'), k = window.__k; b.stage = k.stage; b.referrals = k.refs; b.origin_stops = k.ob; b.committee = k.cm; b.stage_override = k.so; b.died_at_stage = null; S.hearings.push(...k.hs); }""")
    pg.context.close()

    # --- C1/C2: lead editing works on the REAL assignments
    fbn, fbi = W2['fallback']; pg, ctx = open_as(br, fbi, 1440, 900, f'#/bill/{fbn}'); errs, bad = ctx._errs, ctx._bad; pg.wait_for_selector('#bParts', timeout=20000)
    ASG = "async n => { const d = await import('/staff6/data.js'); const b = d.S.bills.find(x => x.bill_number === n); return [...(d.S.assignments[b.id] || [])]; }"
    OURS = "() => document.querySelectorAll('#bl-ours > li').length"
    pg.evaluate("async n => { const d = await import('/staff6/data.js'); d.S.assignments[d.S.bills.find(x => x.bill_number === n).id] = []; window.__staff7Render({ tick: true }); }", fbn)   # the owner of the issue stands in as lead on the page
    ok(pg.locator('#bEditGo').count() == 1, f'{fbi}, the owner of the issue, may change {fbn} though no one is assigned (a bill\'s issue owner is an editor)')
    lead0 = pg.inner_text('#bLead').strip(); n0 = pg.evaluate(OURS)
    pg.click('#bEditGo'); pg.wait_for_timeout(150)
    sel = pg.evaluate("() => ({ v: document.getElementById('bLeadSel').value, o: document.querySelector('#bLeadSel option').innerText })")
    ok(sel['v'] == '' and sel['o'].endswith(', who leads the issue') and pg.evaluate("() => document.getElementById('bSave').disabled"), f'{fbn}: with nobody assigned, the select shows the empty choice "{sel["o"]}" and Save is disabled (no change)')
    other_pos(pg); pg.click('#bSave'); pg.wait_for_timeout(500)
    ok(pg.evaluate(ASG, fbn) == [] and pg.inner_text('#bLead').strip() == lead0 and pg.evaluate(OURS) == n0 + 1 and ('Position:' in pg.inner_text('#toast .tin') or 'The public site keeps' in pg.inner_text('#toast .tin')), f'{fbn}: a position-only save writes no assignment and no lead row (assignments {pg.evaluate(ASG, fbn)})')
    pg.click('#toastUndo'); pg.wait_for_timeout(400); ok(pg.evaluate(ASG, fbn) == [] and pg.evaluate(OURS) == n0, f'{fbn}: Undo leaves the assignments empty')
    other = [i for i in ('KR', 'JM', 'JS', 'KV') if i != fbi][0]
    pg.click('#bEditGo'); pg.select_option('#bLeadSel', value=W2['ids'][other]); pg.click('#bSave'); pg.wait_for_timeout(500)
    ok(pg.evaluate(ASG, fbn) == [W2['ids'][other]] and 'made' in pg.evaluate(LISTROW)[0], f'{fbn}: choosing a lead assigns exactly that one')
    pg.click('#toastUndo'); pg.wait_for_timeout(500)
    ok(pg.evaluate(ASG, fbn) == [] and pg.inner_text('#bLead').strip() == lead0 and pg.evaluate(OURS) == n0, f'{fbn}: Undo of a lead put on a bill that had only the issue owner standing in puts the assignments back to empty ({pg.evaluate(ASG, fbn)})')
    # a real assignment and a different issue owner: the select shows the REAL lead; the empty choice removes it
    pg.context.close()
    obn, obi, obl = W2['ownerbill']; pg, ctx = open_as(br, obi, 1440, 900, f'#/bill/{obn}'); errs, bad = ctx._errs, ctx._bad; pg.wait_for_selector('#bParts', timeout=20000)
    pg.evaluate("async ([n, a]) => { const d = await import('/staff6/data.js'); d.S.assignments[d.S.bills.find(x => x.bill_number === n).id] = [a]; window.__staff7Render({ tick: true }); }", [obn, W2['ids'][obl]])
    n0 = pg.evaluate(OURS); pg.click('#bEditGo'); pg.wait_for_timeout(150)
    ok(pg.evaluate("() => document.getElementById('bLeadSel').value") == W2['ids'][obl], f'{obn}: the select\'s value is the bill\'s real lead, not the issue owner')
    pg.select_option('#bLeadSel', value=''); pg.click('#bSave'); pg.wait_for_timeout(500)
    row0 = pg.evaluate(LISTROW)[0]
    ok(pg.evaluate(ASG, obn) == [] and re.match(r'^\w+ took the lead off \w+', row0) and pg.evaluate(OURS) == n0 + 1, f'{obn}: choosing the empty choice removes the real lead, and the history says it was removed ("{row0}")')
    pg.click('#toastUndo'); pg.wait_for_timeout(500); ok(pg.evaluate(ASG, obn) == [W2['ids'][obl]] and pg.evaluate(OURS) == n0, f'{obn}: Undo puts the very same assignment back')
    # several previous leads: no Undo for the lead
    pg.evaluate("async ([n, a, b]) => { const d = await import('/staff6/data.js'); d.S.assignments[d.S.bills.find(x => x.bill_number === n).id] = [a, b]; window.__staff7Render({ tick: true }); }", [obn, W2['ids'][obl], W2['ids']['KV'] if obl != 'KV' else W2['ids']['KR']])
    pg.click('#bEditGo'); pg.select_option('#bLeadSel', value=W2['ids']['JM'] if obl != 'JM' else W2['ids']['JS']); pg.click('#bSave'); pg.wait_for_timeout(500)
    ok(pg.locator('#toastUndo').is_hidden() and pg.inner_text('#toast .tin').startswith('Lead:'), 'a lead change that replaced several assigned leads offers no Undo (it could not be put back exactly)')
    # a position held for an admin: no Undo when nothing else changed; the lead failing after a held position says the position still waits
    pg.evaluate("async () => { const d = await import('/staff6/data.js'); window.__kU = d.DB.updateBill; window.__kO = d.DB.setOwner; d.DB.updateBill = async () => ['position']; }")
    pg.click('#bEditGo'); other_pos(pg); pg.click('#bSave'); pg.wait_for_timeout(500)
    ok('waits for an admin' in pg.inner_text('#toast .tin') and pg.locator('#toastUndo').is_hidden(), 'a held position with nothing else changed says so and offers no Undo (nothing was saved to undo)')
    pg.evaluate("async () => { const d = await import('/staff6/data.js'); d.DB.setOwner = async () => { throw new Error('no'); }; }")
    pg.click('#bEditGo'); other_pos(pg); pg.select_option('#bLeadSel', value=W2['ids']['NT']); pg.click('#bSave'); pg.wait_for_timeout(500)
    ok('The position still waits for an admin’s yes.' in pg.inner_text('#bEditErr') and pg.evaluate("() => document.activeElement.id") == 'bSave', 'the lead failing after a held position says the position still waits, and the focus is still on Save')
    pg.evaluate("async () => { const d = await import('/staff6/data.js'); d.DB.updateBill = window.__kU; d.DB.setOwner = window.__kO; }")
    pg.keyboard.press('Escape'); pg.wait_for_timeout(200)
    # --- C9: a save that finishes after the person went to another bill must not draw or focus that page
    pg.evaluate("async () => { const d = await import('/staff6/data.js'); window.__kU = d.DB.updateBill; d.DB.updateBill = async (id, p) => { await new Promise(r => setTimeout(r, 900)); return window.__kU(id, p); }; }")
    pg.click('#bEditGo'); other_pos(pg); pg.click('#bSave'); pg.wait_for_timeout(100)
    go(pg, '#/bill/HB2300?who=all'); pg.wait_for_selector('#bParts'); pg.click('#bNoteOpen'); pg.focus('#bNoteIn'); pg.wait_for_timeout(1200)
    ok(pg.evaluate("() => document.querySelector('main h1').innerText") != '' and pg.evaluate("() => document.activeElement.id") == 'bNoteIn' and pg.locator('#bEdit').count() == 0 and ('Position:' in pg.inner_text('#toast .tin') or 'The public site keeps' in pg.inner_text('#toast .tin')), 'a save that finishes on another bill\'s page does not redraw it or take its focus (it still says what it saved)')
    pg.evaluate("async () => { const d = await import('/staff6/data.js'); d.DB.updateBill = window.__kU; }")
    # --- D14: focus after a note and after a failed one
    pg.fill('#bNoteIn', 'A second note'); pg.click('#bNoteGo'); pg.wait_for_timeout(500)
    ok(pg.evaluate("() => document.activeElement.id") == 'bNoteOpen' and pg.locator('#bNoteIn').count() == 0, 'after a note is added the box closes and the focus goes to the "Add a note" button')
    pg.click('#bNoteOpen')
    pg.evaluate("async () => { const d = await import('/staff6/data.js'); window.__kM = d.DB.sendMessage; d.DB.sendMessage = async () => { throw new Error('no'); }; }")
    pg.fill('#bNoteIn', 'Will not save'); pg.focus('#bNoteGo'); pg.click('#bNoteGo'); pg.wait_for_timeout(400)
    ok(pg.evaluate("() => document.activeElement.id") == 'bNoteGo' and pg.input_value('#bNoteIn') == 'Will not save', 'after a failed note the focus is still on the button and the words are still there')
    pg.evaluate("async () => { const d = await import('/staff6/data.js'); d.DB.sendMessage = window.__kM; }")
    # --- a note with markup in it shows as text
    pg.click('#bNoteIn'); pg.keyboard.press('Meta+a'); pg.keyboard.insert_text('<img src=x onerror=alert(1)> and "quotes" and \'single\' & <b>bold</b>'); pg.click('#bNoteGo'); pg.wait_for_timeout(500)
    top = pg.evaluate("() => { const l = document.querySelector('#bl-notes > li:first-child'); return [l.querySelector('p').innerText, l.querySelectorAll('img, b').length]; }")
    ok(top[0] == '<img src=x onerror=alert(1)> and "quotes" and \'single\' & <b>bold</b>' and top[1] == 0, f'a note with markup and quotes shows as plain text, nothing is drawn from it ({top[0][:50]})')
    pg.context.close()

    # --- D15 and C5: the history failing, then arriving; the notes need only memory
    pg, ctx = open_as(br, 'NT', 1440, 900, '#/issues'); errs, bad = ctx._errs, ctx._bad
    pg.evaluate("async () => { const d = await import('/staff6/data.js'); window.__kT = d.DB.timeline; d.DB.timeline = async () => { throw new Error('rejected'); }; }")
    go(pg, '#/bill/HB2300'); pg.wait_for_selector('#bFail', timeout=10000)
    ok(pg.locator('#bNotesH').count() == 1 and pg.locator('#bNoteOpen').count() == 1 and pg.locator('#bPinned').count() == 1 and pg.locator('#bHearH').count() == 0 and pg.locator('#bHistH').count() == 0 and pg.evaluate("() => document.getElementById('bFail').previousElementSibling !== null"), 'the history failing (DB.timeline rejects): Team notes and the note box are still drawn, and the failure line takes the place of Past hearings and History')
    ok('We could not load the bill’s history.' in pg.inner_text('#bFail') and pg.locator('#bRetry').count() == 1, 'the failure line has "Try again"')
    pg.evaluate("async () => { const d = await import('/staff6/data.js'); d.DB.timeline = window.__kT; }"); pg.click('#bRetry'); pg.wait_for_selector('#bHistH', timeout=10000)
    ok(pg.locator('#bFail').count() == 0 and pg.locator('#bHearH').count() == 1, 'Try again loads it, and the blocks come in')
    # switching bills mid-load: the first bill's history arriving does not redraw the second page; the address's words do not matter, only the bill
    pg.evaluate("async () => { const d = await import('/staff6/data.js'); window.__kT = d.DB.timeline; d.DB.timeline = (id) => new Promise(r => setTimeout(() => r(window.__kT(id)), id === d.S.bills.find(b => b.bill_number === 'HB1562').id ? 500 : 1500)); }")
    go(pg, '#/bill/HB1562'); pg.evaluate("() => { document.querySelector('.paper').dataset.m = 'x'; }")
    go(pg, '#/bill/SB11?who=all'); pg.evaluate("() => { document.querySelector('.paper').dataset.m = 'second'; }")
    pg.wait_for_timeout(900)
    ok(pg.evaluate("() => document.querySelector('.paper').dataset.m") == 'second' and pg.locator('#bWait').count() == 1, 'switching bills mid-load: the first bill\'s history arriving does not redraw the page the person is on')
    pg.evaluate("() => history.replaceState(history.state, '', location.pathname + location.search + '#/bill/SB11?who=all&q=zzz')")
    pg.wait_for_selector('#bParts', timeout=10000)
    ok(pg.evaluate("() => document.getElementById('bParts').dataset.bill") == pg.evaluate("async () => (await import('/staff6/data.js')).S.bills.find(b => b.bill_number === 'SB11').id"), 'the second bill\'s history arrives and is drawn even though the address\'s words changed while it loaded (only the bill matters)')
    pg.evaluate("async () => { const d = await import('/staff6/data.js'); d.DB.timeline = window.__kT; }")
    ok(not errs and not bad, f'review round: no console error, nothing left 127.0.0.1 ({errs[:2]} {bad[:2]})')
    ok(pg.locator('#bNotes90').count() == 0, 'on the practice copy there is no "Notes from the last 90 days." line'); skip('the "Notes from the last 90 days." line shows only when not practice (staff7 runs only on the practice copy)')
    skip('C10: an external address from data (state_url fallback of the bill-text link) is checked http(s) in code; the practice numbers never take the fallback, so there is no page that shows it')
    pg.context.close()

    # --- the phone: facts stacked, 44px links, the change button lines up
    pg, ctx = open_as(br, 'NT', 390, 844, '#/bill/HB1523'); errs, bad = ctx._errs, ctx._bad; pg.wait_for_selector('#bParts', timeout=20000)
    stk = pg.evaluate("() => [...document.querySelectorAll('#bFacts > div')].map(d => { const t = d.querySelector('dt').getBoundingClientRect(), v = d.querySelector('dd').getBoundingClientRect(), r = d.getBoundingClientRect(); return [t.bottom <= v.top + 2, Math.abs(v.left - t.left) < 2, v.width > r.width - 4]; })")
    ok(stk and all(all(x) for x in stk), f'phone: each fact\'s label sits above its value, full width ({stk})')
    tg = pg.evaluate("() => [...document.querySelectorAll('.bfacts .blist a, .bfacts dd > a.lk:only-child')].map(a => Math.round(a.getBoundingClientRect().height))")
    ok(tg and all(h >= 43.5 for h in tg), f'phone: standalone links in the facts are 44px tall by padding ({tg})')
    al = pg.evaluate("() => { const p = document.getElementById('bPos').getBoundingClientRect(), b = document.getElementById('bEditGo').getBoundingClientRect(); return [Math.round(p.left), Math.round(b.left), Math.round(b.top - p.top)]; }")
    ok(al[2] < 5 or abs(al[0] - al[1]) < 3, f'phone: "Change position or lead" lines up with the text above (line left {al[0]}, button left {al[1]}, {al[2]}px down)')
    ic_ = pg.evaluate("() => { const i = document.querySelector('.hband .imark').getBoundingClientRect(), h = document.querySelector('.hband h1').getBoundingClientRect(), lh = parseFloat(getComputedStyle(document.querySelector('.hband h1')).lineHeight) || 34; return [i.top + i.height / 2, h.top + lh / 2, h.height / lh]; }")
    ok(abs(ic_[0] - ic_[1]) <= 12, f'phone: the band\'s icon lines up with the first line of the title, not the middle of its {round(ic_[2])} lines ({[round(x) for x in ic_]})')
    snap(pg, 'f_phone.png')
    ok(not errs and not bad, 'phone: no console error, nothing left 127.0.0.1')
    pg.context.close()

    # ============================================================ a phone
    pg, ctx = open_as(br, 'KV', 390, 844, f'#/bill/{hb}?i={hi}&who=all'); errs, bad = ctx._errs, ctx._bad
    for num in (hb, pick('manycmtes'), pick('stopped'), pick('manysp'), pick('longname'), pick('joint')):
        bill(pg, num, f'i={hi}&who=all' if num == hb else 'who=all')
        ok(pg.evaluate(NOSIDE) and not pg.evaluate(SMALL), f'phone {num}: no sideways scroll, 44px targets ({pg.evaluate(SMALL)[:2]})')
    bill(pg, hb, f'i={hi}&who=all')
    ok(pg.locator('svg.trk.row').first.is_visible() and pg.locator('.bigpath .btl').first.is_hidden(), 'phone: the path is the compact one, the timeline is hidden')
    bn = pg.evaluate("() => { const n = document.querySelector('.hband .bno, .hband .kindl.no').getBoundingClientRect(), l = [...document.querySelectorAll('.hband .bls a')].map(a => a.getBoundingClientRect()); return [Math.round(n.top), l.map(r => Math.round(r.top)), l.map(r => Math.round(r.height))]; }")
    ok(len(set(bn[1])) == 1 and all(t > bn[0] + 10 for t in bn[1]) and all(h >= 44 for h in bn[2]), f'phone: the Capitol and Read-the-bill links wrap to their own line under the number, 44px tall ({bn})')
    backs = pg.evaluate("() => [...document.querySelectorAll('.back, .crumb.back2')].filter(e => e.getBoundingClientRect().width > 0).map(e => e.innerText.trim())")
    ok(len(backs) == 1 and (backs[0].startswith('Back to ') or backs[0].startswith('Issues')), f'phone: one back link, labelled with where it goes ({backs})')
    bill(pg, 'HB1523'); pg.wait_for_selector('#bParts'); pg.click('#bCap button[data-bmore]'); pg.wait_for_timeout(100)
    st2 = pg.evaluate("() => { const a = document.getElementById('bCap').getBoundingClientRect(), b = document.getElementById('bOurs').getBoundingClientRect(); return [a.left, b.left, a.bottom, b.top]; }")
    ok(abs(st2[0] - st2[1]) < 2 and st2[3] >= st2[2] - 1, f'phone: the two history lists are stacked ({st2})')
    ok(pg.evaluate(NOSIDE) and not pg.evaluate(SMALL), f'phone HB1523: the notes, hearings and history fit with 44px targets ({pg.evaluate(SMALL)[:2]})')
    snap(pg, 'b_phone.png', tall=False)
    snap(pg, 'phone_bill.png')
    ok(not errs and not bad, f'phone: no console error, nothing left 127.0.0.1 ({errs[:2]} {bad[:2]})')
    pg.context.close()
    # ---- narrower laptops and a tablet: no word breaks, nothing overflows, the timeline or the compact drawing shows
    for (w_, h_) in ((1024, 768), (768, 1024)):
        pg, ctx = open_as(br, 'KV', w_, h_, '#/bill/HB108'); errs, bad = ctx._errs, ctx._bad; pg.wait_for_selector('#bParts', timeout=20000)
        for num_ in ('HB108', 'SB11', 'HB1523'):
            bill(pg, num_); pg.wait_for_selector('#bParts'); pg.wait_for_timeout(250)
            shown = pg.evaluate("() => document.querySelector('.bigpath .btl').getBoundingClientRect().height > 0")
            sp = pg.evaluate(SPLIT) if shown else []
            ok(not sp and pg.evaluate(NOSIDE) and (shown or pg.locator('.bigpath svg.trk.row').first.is_visible()), f'{w_}x{h_} {num_}: the timeline ({"shown" if shown else "hidden, the compact drawing shows"}) breaks no word ({sp[:3]}), no sideways scroll')
        ok(not errs and not bad, f'{w_}x{h_}: no console error')
        pg.context.close()
    br.close()
print(f'{sum(res)}/{len(res)} passed')
sys.exit(0 if all(res) else 1)
