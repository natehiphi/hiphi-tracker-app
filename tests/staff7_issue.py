# Staff7's issue page (R-398) on the practice copy: the band ("Issue", the name), HIPHI's position and who leads, where the issue stands, the bills as a real table (headings, one answer per bill),
# the stopped bills folded away, the facts, the edits (the lead, the goal, a note) and the notes. Issues are PICKED from the practice data by what they are (a hearing ahead, none alive, one the
# viewer neither leads nor administers), never named in advance.
# Rules kept: real th headings, the deadline heading on one line; every bill's status is one of the allowed wordings; a bill that cleared the deadline is never amber; "Change the lead" only for the lead or an
# admin; a goal edit and a note save and show; the words "letter" and "vape" appear nowhere a person reads; no console error; nothing leaves 127.0.0.1; no sideways scroll at 390px wide.
#   python3 tests/staff7_issue.py [base] [shots folder]     base defaults to http://127.0.0.1:8851
import sys, os, re
from playwright.sync_api import sync_playwright
BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8851').rstrip('/')
SHOTS = sys.argv[2] if len(sys.argv) > 2 else ''
if SHOTS: os.makedirs(SHOTS, exist_ok=True)
res = []
def ok(c, m): res.append(bool(c)); print('PASS' if c else 'FAIL', m, flush=True)

NOSIDE = "() => document.documentElement.scrollWidth <= innerWidth && [...document.querySelectorAll('.paper, .wl')].every(p => p.scrollWidth <= p.clientWidth + 1)"
TEXTS = "() => document.querySelector('.paper').innerText + ' ' + [...document.querySelectorAll('.paper [aria-label], .paper [title]')].map(e => (e.getAttribute('aria-label') || '') + ' ' + (e.getAttribute('title') || '')).join(' ')"
ALLOWED = re.compile(r'^(Past committees|Cleared the deadline|Hearing .+|Not sure yet|Not asking for a hearing|Needs a hearing( by .+)?|Has until .+)$')
# issues by what they are
PICK = """async () => {
  const d = await import('/staff6/data.js'), mo = await import('/staff6/model.js'), st = await import('/staff7/standing.js'), S = d.S, out = { hearing: null, mixed: null, stopped: null, notlead: null };
  for (const i of S.issues.filter(i => !i.archived_at)) {
    const bs = st.billsOfIssue(i), alive = bs.filter(st.isAlive), dead = bs.filter(b => !st.isAlive(b));
    if (alive.some(b => mo.hearingAhead(b)) && !out.hearing) out.hearing = { id: i.id, name: i.name };
    if (alive.some(b => mo.hearingAhead(b)) && dead.length && !out.mixed) out.mixed = { id: i.id, name: i.name, dead: dead.length };
    if (bs.length && !alive.length && !out.stopped) out.stopped = { id: i.id, name: i.name, n: bs.length };
    if (alive.length && !out.notlead) out.notlead = { id: i.id, name: i.name, owner: i.owner_id };
  }
  out.adv = S.advocates.map(a => [a.id, a.initials, a.is_admin]);
  return out; }"""

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
def go(pg, hash): pg.evaluate("h => { location.hash = h; }", hash); pg.wait_for_selector('.paper h1'); pg.wait_for_timeout(700)
def snap(pg, name, tall=False):
    if not SHOTS: return
    if tall:
        pg.set_viewport_size({'width': 1440, 'height': 2800}); pg.wait_for_timeout(300)
        h = pg.evaluate("() => Math.ceil(document.querySelector('.paper').scrollHeight) + 60"); pg.set_viewport_size({'width': 1440, 'height': max(900, min(h, 4000))}); pg.wait_for_timeout(300)
        pg.screenshot(path=os.path.join(SHOTS, name)); pg.set_viewport_size({'width': 1440, 'height': 900}); pg.wait_for_timeout(200)
    else: pg.screenshot(path=os.path.join(SHOTS, name))
H1 = "() => document.querySelector('main h1')?.innerText.trim()"

with sync_playwright() as p:
    br = p.chromium.launch()
    pg, ctx = open_as(br, 'NT', 1440, 900, '#/issues'); errs, bad = ctx._errs, ctx._bad
    P = pg.evaluate(PICK)
    for k in ('hearing', 'mixed', 'stopped', 'notlead'): ok(P.get(k), f'the practice copy has an issue that is "{k}" ({(P.get(k) or {}).get("name")})')
    adm = {a[1]: a[2] for a in P['adv']}

    # ============================================================ an issue with a hearing, as its lead (an admin)
    m = P['mixed'] or P['hearing']
    go(pg, f'#/issue/{m["id"]}')
    ok(pg.evaluate(H1) == m['name'], f'the page opens with the issue name as its h1 ({pg.evaluate(H1)})')
    ok(pg.evaluate("() => document.querySelector('.hband .kindl')?.innerText.trim()") == 'Issue', 'the small word "Issue" stands above the title')
    ok(pg.evaluate("() => { const m = document.querySelector('.hband .imark'); const r = m.getBoundingClientRect(); return Math.round(r.width) === 60 && getComputedStyle(m).backgroundColor !== 'rgba(0, 0, 0, 0)'; }"), 'the issue\'s mark is the filled 60px one')
    ok(re.match(r'^(\d+ of \d+ bills alive|None of its \d+ bills is alive|Its bill stopped this year|\d+ bills?)$', pg.evaluate("() => document.querySelector('.hband .bsub').innerText.trim()")), 'the band says how many of its bills are alive')
    ok(pg.evaluate("() => /^HIPHI’s position .+ · .+/.test(document.getElementById('iPos').innerText.replace(/\\s+/g, ' ').trim())"), 'the position line reads "HIPHI\'s position ... · ... lead"')
    st = pg.evaluate("() => [...document.querySelectorAll('#iStat .bln')].map(p => p.innerText.replace(/\\s+/g, ' ').trim())")
    ok(1 <= len(st) <= 2 and st[0].startswith(('Hearing ', 'Needs a hearing by ')) , f'where the issue stands is at most two lines, the most urgent first ({st})')
    ok(pg.locator('#iStat .bmv a.btn.quiet').count() <= 1 and pg.locator('#iStat .btn.filled').count() == 0, 'at most one outlined "Your move" button, never filled')
    # the table
    ok(pg.locator('#tBills caption.sr').count() == 1, 'the table has a caption for a screen reader')
    th = pg.evaluate("() => [...document.querySelectorAll('#tBills thead th')].map(t => [t.getAttribute('scope'), t.innerText.trim(), Math.round(t.getBoundingClientRect().height), parseInt(getComputedStyle(t).fontWeight)])")
    ok([t[1] for t in th][:2] == ['Bill', 'Where it is'] and th[2][1].startswith('Deadline') and all(t[0] == 'col' for t in th), f'real column headings: {[t[1] for t in th]}')
    ok(th[2][2] < 32 and all(t[3] == 500 for t in th), f'the deadline heading is on one line ({th[2][2]}px) and the headings are weight 500')
    rows = pg.evaluate("() => [...document.querySelectorAll('#tBills tbody tr')].map(r => ({ n: r.querySelector('th[scope=row]').innerText.trim(), href: r.querySelector('th a')?.getAttribute('href'), dl: r.querySelector('td.dc').innerText.trim(), amber: !!r.querySelector('td.dc .amber'), quiet: !!r.querySelector('td.dc .quiet'), where: r.querySelector('td.tw').innerText.trim(), h: Math.round(r.querySelector('th a').getBoundingClientRect().height) }))")
    ok(len(rows) >= 1 and all(re.match(r'^[HS]B \d+$', r['n']) and r['href'].startswith('#/bill/') and 'i=' in r['href'] for r in rows), f'each alive bill is a row, its number a link to its page with the issue ({[r["n"] for r in rows]})')
    ok(all(ALLOWED.match(r['dl']) for r in rows), f'every status is one of the allowed wordings ({[r["dl"] for r in rows]})')
    ok(all(not r['amber'] for r in rows if r['dl'] == 'Cleared the deadline') and all(r['amber'] == bool(re.match(r'Needs a hearing|Hearing .*after the deadline', r['dl'])) or not r['amber'] for r in rows), 'no amber on a bill that cleared the deadline; amber only on a bill that needs a hearing soon')
    ok(all(r['where'] and r['h'] >= 32 for r in rows), 'every row says where it waits now and its link is at least 32px tall')
    ok(pg.locator('#tBills thead th', has_text='Capitol').count() == 0, 'no Capitol column')
    # the stopped fold
    if P['mixed']:
        ok(pg.locator('#tDead').is_hidden() and pg.locator('#tFoldBtn').get_attribute('aria-expanded') == 'false', 'the stopped bills are folded away')
        pg.click('#tFoldBtn'); pg.wait_for_timeout(150)
        dead = pg.evaluate("() => [...document.querySelectorAll('#tDead tbody tr')].map(r => r.innerText.replace(/\\s+/g, ' ').trim())")
        ok(pg.locator('#tDead').is_visible() and pg.locator('#tFoldBtn').inner_text() == 'Show fewer' and len(dead) == P['mixed']['dead'] and all(re.search(r'Stopped( [A-Z][a-z]{2} \d+)?', d) and 'did not reach' not in d and 'first committee' not in d for d in dead), f'"Show N" opens the stopped bills ({dead[:2]})')
        pg.click('#tFoldBtn'); pg.wait_for_timeout(150)
        ok(pg.locator('#tDead').is_hidden() and pg.locator('#tFoldBtn').inner_text().startswith('Show '), '"Show fewer" closes them again')
    snap(pg, 'F_issue_hearing.png'); snap(pg, 'F_issue_hearing_full.png', tall=True)
    # the facts
    facts = pg.evaluate("() => Object.fromEntries([...document.querySelectorAll('#iFacts > div')].map(d => [d.querySelector('dt').innerText, d.querySelector('dd').innerText.replace(/\\s+/g, ' ').trim()]))")
    ok(all(k in facts for k in ('What we want', 'Our goal', 'Talking points', 'On the public site')) and 'public site' in facts['What we want'], f'the facts are there ({list(facts)})')
    ok(not re.search(r'\d+ (people )?follow', facts['On the public site']), 'no follower count is shown (none exists in the staff data)')
    # the lead's edit block
    pg.click('#iLeadGo'); pg.wait_for_selector('#iLeadSel'); pg.wait_for_timeout(150)
    ok('On the real tracker the new lead is told by Slack or email. Only the lead or an admin can change it again.' in pg.inner_text('#iLeadF') and pg.is_disabled('#iLeadSave'), 'the lead form says who is told and who can change it again, and Save waits for a change')
    snap(pg, 'F_issue_edit.png')
    other = pg.evaluate("() => [...document.querySelectorAll('#iLeadSel option')].map(o => o.value).find(v => v !== document.getElementById('iLeadSel').value)")
    pg.select_option('#iLeadSel', other); pg.click('#iLeadSave'); pg.wait_for_timeout(500)
    ok(pg.locator('#iLeadF').count() == 0 and re.search(r'leads', pg.inner_text('#iLead')) and 'You lead' not in pg.inner_text('#iLead'), f'Change the lead saves and shows ({pg.inner_text("#iLead")})')
    ok(pg.locator('#toast.on').count() == 1 and re.match(r'^Lead changed to \w+\.', pg.inner_text('#toast').strip()) and 'Undo' not in pg.inner_text('#toast'), f'the saved message says who leads now and offers no Undo ({pg.inner_text("#toast").strip()!r})')
    # a goal
    pg.click('#iGoalGo'); pg.fill('#iGoalIn', 'Get one bill through the Senate this session.'); pg.click('#iGoalSave'); pg.wait_for_timeout(400)
    ok('Get one bill through the Senate' in pg.inner_text('#iFacts') and pg.locator('#iGoalF').count() == 0, 'a goal saves and shows')
    # a note
    pg.wait_for_selector('#iNoteOpen'); pg.click('#iNoteOpen'); pg.fill('#iNoteIn', 'Called the committee clerk; we are on the list.'); pg.wait_for_timeout(100)
    ok('Practice copy: this note is not saved' in pg.inner_text('#iNoteBox'), 'the note box says the practice note is not saved')
    pg.click('#iNoteGo'); pg.wait_for_timeout(500)
    first_note = pg.inner_text('#nList li:first-child')
    ok('Called the committee clerk' in first_note and 'This issue' in first_note and 'You' in first_note, f'a note saves and shows first, tagged "This issue" ({first_note[:60]!r})')
    ok(not re.search(r'\b\d{1,2}/\d{1,2}\b', pg.inner_text('#nList')), 'no date in the history is written "3/18"')
    ok(not re.search(r'letter|vape', pg.evaluate(TEXTS), re.I), 'neither "letter" nor "vape" appears anywhere a person reads')
    # the bill page opened from the issue
    href = pg.evaluate("() => document.querySelector('#tBills tbody th a').getAttribute('href')")
    go(pg, href)
    bb = pg.evaluate("() => { const m = document.querySelector('.hband .imark'), r = m.getBoundingClientRect(), cs = getComputedStyle(m); return { w: Math.round(r.width), bg: cs.backgroundColor, bw: cs.borderTopWidth, trail: document.getElementById('bBack').innerText.replace(/\\s+/g, ' ').trim(), links: document.querySelectorAll('#bBack a').length, no: document.querySelector('.hband .kindl')?.innerText.trim(), h1: document.querySelector('h1').innerText.trim() }; }")
    ok(bb['w'] < 60 and bb['bg'] == 'rgba(0, 0, 0, 0)' and bb['bw'] in ('1px', '1.5px', '2px'), f'from an issue the bill page\'s mark is smaller and outlined ({bb["w"]}px, {bb["bg"]}, {bb["bw"]})')
    ok(bb['trail'].startswith('Issues') and m['name'] in bb['trail'] and bb['links'] == 2 and re.match(r'^[HS]B \d+$', bb['no'] or ''), f'the trail is "Issues > issue" and the number sits above the title ({bb["trail"]}; {bb["no"]})')
    snap(pg, 'F_bill_from_issue.png')
    go(pg, href.split('?')[0])
    ok(pg.evaluate("() => document.getElementById('bBack').classList.contains('trail')") is False and pg.evaluate("() => document.querySelector('.hband .imark').getBoundingClientRect().width") >= 40 and 'out' not in (pg.evaluate("() => document.querySelector('.hband .imark').className")), 'without ?i= the bill page is as it was')
    ok(not errs and not bad, f'no console error, nothing left 127.0.0.1 ({errs[:2]} {bad[:2]})')
    pg.context.close()

    # ============================================================ what was typed on one issue never shows on another (fix 1)
    pg, ctx = open_as(br, 'NT', 1440, 900, '#/issues'); errs, bad = ctx._errs, ctx._bad
    A, B2 = P['mixed'] or P['hearing'], P['stopped']
    go(pg, f'#/issue/{A["id"]}'); pg.click('#iGoalGo'); pg.fill('#iGoalIn', 'LEAKY GOAL'); pg.wait_for_selector('#iNoteOpen'); pg.click('#iNoteOpen'); pg.fill('#iNoteIn', 'LEAKY NOTE')
    pg.evaluate("h => { location.hash = h; }", f'#/issue/{B2["id"]}'); pg.wait_for_selector('.paper h1'); pg.wait_for_timeout(700)
    body = pg.inner_text('main')
    ok(pg.locator('#iGoalF').count() == 0 and pg.locator('#iNoteIn').count() == 0 and 'LEAKY' not in body and pg.locator('textarea').count() == 0, 'another issue opens with its goal form and note box closed and empty')
    pg.evaluate("h => { location.hash = h; }", f'#/issue/{A["id"]}'); pg.wait_for_selector('.paper h1'); pg.wait_for_timeout(700)
    ok(pg.locator('#iGoalF').count() == 0 and pg.locator('#iNoteIn').count() == 0 and 'LEAKY' not in pg.inner_text('main'), 'going back, the first issue is closed and empty too')
    go(pg, f'#/issue/{B2["id"]}'); pg.click('#iGoalGo'); ok(pg.input_value('#iGoalIn') == (pg.evaluate("async id => { const d = await import('/staff6/data.js'); return d.S.issues.find(i => i.id === id).goal || ''; }", B2['id'])), 'the goal form on the second issue starts from that issue\'s own goal'); pg.click('#iGoalCancel')

    # ============================================================ the band's count words, for every issue (fix 12)
    bandok = []
    for iss in pg.evaluate("async () => { const d = await import('/staff6/data.js'), st = await import('/staff7/standing.js'); return d.S.issues.filter(i => !i.archived_at).map(i => { const bs = st.billsOfIssue(i); return { id: i.id, all: bs.length, alive: bs.filter(st.isAlive).length }; }); }"):
        pg.evaluate("h => { location.hash = h; }", f'#/issue/{iss["id"]}'); pg.wait_for_selector('.hband .bsub'); pg.wait_for_timeout(150)
        t = pg.inner_text('.hband .bsub').strip(); a, n = iss['alive'], iss['all']
        want = 'No bill on it this session' if not n else ('Its bill stopped this year' if n == 1 else f'None of its {n} bills is alive') if not a else ('1 bill' if n == 1 else f'{n} bills') if a == n else f'{a} of {n} bills alive'
        if t != want: bandok.append((t, want))
    ok(not bandok, f'the band grammar is right for every issue ({bandok[:3]})')

    # ============================================================ the table and the Issues list never disagree (the three samples and one more)
    KEYS = ['risk', 'hearing', 'need', 'cleared', 'past', 'stopped']; RANK = {k: i for i, k in enumerate(KEYS)}
    listed = {}
    for k in KEYS:
        go(pg, f'#/issues?who=all&show={k}')
        for iid in pg.evaluate("() => [...document.querySelectorAll('section[aria-labelledby^=\"g-\"] a.sr3')].map(a => decodeURIComponent(a.getAttribute('href').split('/issue/')[1].split('?')[0]))"): listed.setdefault(iid, k)
    samples = {'More local food in school meals': '2616613e-a363-418b-ae19-4add60957cd8', 'No tax on groceries': 'f75cf18c-da93-4c93-ab90-620362ff8e43', 'Wildfire hazard map and brush clearing': 'af1314ec-37df-4208-9823-438b79b2543e'}
    pov = pg.evaluate("async () => { const d = await import('/staff6/data.js'); const i = d.S.issues.find(i => /^Poverty alone is not child neglect/.test(i.name)); return i ? i.id : null; }")
    ok(pov, 'the practice copy has "Poverty alone is not child neglect"')
    if pov: samples['Poverty alone is not child neglect'] = pov
    def cellkey(c):
        t, amber = c['t'], c['amber']
        if amber: return 'risk'
        if t.startswith('Hearing'): return 'hearing'
        if t.startswith(('Needs a hearing', 'Has until', 'Not sure yet')): return 'need'
        if t == 'Cleared the deadline': return 'cleared'
        return 'past'
    for nm, iid in samples.items():
        go(pg, f'#/issue/{iid}?who=all')   # the list above is Everyone's, so the page is read the way a click from that list opens it
        cells = pg.evaluate("() => [...document.querySelectorAll('#tBills tbody td.dc')].map(td => ({ t: td.innerText.trim(), amber: !!td.querySelector('.amber') }))")
        want = min((cellkey(c) for c in cells), key=RANK.get) if cells else 'stopped'
        ok(listed.get(iid) == want, f'"{nm}": the list puts it under "{listed.get(iid)}" and its table says "{want}" ({[c["t"] for c in cells]})')
        if listed.get(iid) == 'cleared': ok(not any(c['t'].startswith('Needs a hearing') for c in cells), f'"{nm}": a cleared issue has no "Needs a hearing" cell')

    ok(not errs and not bad, 'no console error, nothing left 127.0.0.1')
    pg.context.close()

    # ============================================================ an issue with no alive bill
    pg, ctx = open_as(br, 'NT', 1440, 900, f'#/issue/{P["stopped"]["id"]}'); errs, bad = ctx._errs, ctx._bad
    ok(pg.evaluate(H1) == P['stopped']['name'] and re.match(r'^(None of its \d+ bills is alive|Its bill stopped this year)$', pg.inner_text('.hband .bsub').strip()), 'the band says none of its bills is alive')
    st = pg.evaluate("() => [...document.querySelectorAll('#iStat .bln')].map(p => p.innerText.replace(/\\s+/g, ' ').trim())")
    ok(len(st) == 2 and st[0].startswith('Stopped for this year') and 'try again in 2027' in st[1] and 'did not reach' not in st[0], f'the status is the stopped line and the muted line ({st})')
    first_dead = pg.inner_text('#tDead tbody tr:first-child td.tw').strip()
    ok(re.match(r'^Stopped( [A-Z][a-z]{2} \d+)?$', first_dead), f'the status line already tells why, so the last bill\'s row says only when ({first_dead!r})')
    ok(pg.locator('#tBills').count() == 0 and pg.locator('#tDead').is_visible() and pg.locator('#tDead tbody tr').count() == P['stopped']['n'] and pg.locator('#tFoldBtn').count() == 0, 'every bill is listed as stopped, with no fold to open')
    ok(pg.locator('#iStat .bmv').count() == 0, 'no "Your move" on a stopped issue')
    snap(pg, 'F_issue_stopped.png'); snap(pg, 'F_issue_stopped_full.png', tall=True)
    ok(not re.search(r'letter|vape', pg.evaluate(TEXTS), re.I) and not errs and not bad, 'no "letter", no "vape", no console error, nothing left 127.0.0.1')
    pg.context.close()

    # ============================================================ an issue the viewer neither leads nor administers (look only)
    viewer = 'JM'
    pg, ctx = open_as(br, viewer, 1440, 900, '#/issues'); errs, bad = ctx._errs, ctx._bad
    me = pg.evaluate("async () => { const d = await import('/staff6/data.js'); return { id: d.S.me.id, adm: !!d.S.me.is_admin }; }")
    other = pg.evaluate("async (me) => { const d = await import('/staff6/data.js'), st = await import('/staff7/standing.js'); const i = d.S.issues.find(i => !i.archived_at && i.owner_id !== me && st.billsOfIssue(i).some(st.isAlive)); return i ? { id: i.id, name: i.name } : null; }", me['id'])
    ok(not me['adm'] and other, f'{viewer} is not an admin, and there is an issue led by someone else ({(other or {}).get("name")})')
    go(pg, f'#/issue/{other["id"]}')
    ok(pg.locator('#iLeadGo').count() == 0 and pg.locator('#iGoalGo').count() == 0 and pg.locator('#iTpGo').count() == 0, '"Change the lead", the goal and the talking points have no buttons for someone who does not lead it')
    ok(pg.locator('#iLook').count() == 0 and 'Look only' not in pg.inner_text('main') and pg.locator('#iStat .bmv').count() == 0, 'no separate "Look only" line, and no step offered')
    ok(re.search(r'(leads|Nobody leads yet)$', pg.inner_text('#iPos').strip()), f'the position line names the lead ({pg.inner_text("#iPos").strip()!r})')
    ok(pg.locator('#iNoteOpen').count() == 1, 'a note can still be added')
    snap(pg, 'F_issue_lookonly.png')
    ok(not errs and not bad, 'no console error, nothing left 127.0.0.1')
    pg.context.close()

    # ============================================================ a phone
    pg, ctx = open_as(br, 'NT', 390, 844, f'#/issue/{m["id"]}'); errs, bad = ctx._errs, ctx._bad
    pg.wait_for_selector('#tBills'); pg.wait_for_timeout(500)
    ok(pg.evaluate(NOSIDE), 'phone: nothing scrolls sideways')
    ok(pg.evaluate("() => { const r = document.querySelector('#tBills tbody tr'); const [a, b, c, d] = [...r.children].map(e => e.getBoundingClientRect().top); return d < c && c > a; }"), 'phone: number and name, then the status, then "Now waiting"')
    if SHOTS: pg.screenshot(path=os.path.join(SHOTS, 'F_issue_phone.png'), full_page=True)
    ok(not errs and not bad, 'phone: no console error, nothing left 127.0.0.1')
    pg.context.close()
    br.close()
print(f'{sum(res)}/{len(res)} passed')
sys.exit(0 if all(res) else 1)
