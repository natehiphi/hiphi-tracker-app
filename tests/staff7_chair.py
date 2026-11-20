# Staff7's chair ask, parts 1 and 2 (R-398 piece 5), on the practice copy (part 2 is section H: Follow up with the chair, Decide what next, the vice chair, the ask ending by itself): the clock maths (3 working days, weekends skipped, the announce-within-2 trigger), each reply (will schedule, said no, no answer yet restarts the
# clock) with its Undo, two chairs kept apart, giving an ask and Undo, two people recording at once, the ask ending by itself, the bill page's line, one filled button (S-2) and no page errors at 1440 and 390.
#   python3 tests/staff7_chair.py [base] [shots folder]     base defaults to http://127.0.0.1:8853 (serve with a 256 backlog, one server per worktree)
import sys, os, re
from playwright.sync_api import sync_playwright
BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8853').rstrip('/')
SHOTS = sys.argv[2] if len(sys.argv) > 2 else ''
if SHOTS: os.makedirs(SHOTS, exist_ok=True)
res = []
def ok(c, m): res.append(bool(c)); print('PASS' if c else 'FAIL', m, flush=True)

FILLED = "() => [...document.querySelectorAll('.btn.filled')].filter(b => { const r = b.getBoundingClientRect(), s = getComputedStyle(b); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && r.top < innerHeight && r.bottom > 0; }).length"
H1 = "() => [...document.querySelectorAll('main h1')].find(h => h.getBoundingClientRect().width > 0)?.innerText.trim()"
NOSIDE = "() => document.documentElement.scrollWidth <= innerWidth && document.querySelector('.paper').scrollWidth <= document.querySelector('.paper').clientWidth"
SMALL = "() => [...document.querySelectorAll('.paper .btn, .paper .cch, .wl .sr3')].filter(e => e.getBoundingClientRect().width > 0 && e.getBoundingClientRect().height < 43.5).map(e => e.className + ':' + e.innerText.slice(0, 20))"
SB = 'SB2175'
PRE = """const D = await import('/staff6/data.js'), S = D.S, M = await import('/staff6/model.js'), A = await import('/staff7/ask_data.js');
const bill = n => S.bills.find(x => String(x.bill_number).replace(/\\s/g, '') === n), adv = i => S.advocates.find(a => a.initials === i);
const ask = (n, code) => A.allAsks().find(a => a.b.id === bill(n).id && (!code || a.code === code));
const as = (i, fn) => { const p = S.me; S.me = adv(i); try { return fn(); } finally { S.me = p; } };
"""
def ev(pg, body, arg=None):
    return pg.evaluate("async (arg) => { " + PRE + body + " }", arg)
def key(pg, n=SB, code=None): return ev(pg, "return ask(arg[0], arg[1]).key;", [n, code])

def open_as(br, who, w, h, hash='', ctx=None, fresh=True):
    ctx = ctx or br.new_context(viewport={'width': w, 'height': h}); pg = ctx.new_page(); errs = []; bad = []
    def block(route):
        u = route.request.url
        if 'fonts.g' in u: return route.continue_()
        bad.append(u); route.abort()
    ctx.route(lambda u: '127.0.0.1' not in u and 'localhost' not in u, block)
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'Failed to load resource' not in m.text and 'ERR_FAILED' not in m.text else None)
    pg.goto(f'{BASE}/staff7.html?demo=1&as={who}{hash}'); pg.wait_for_selector('.paper', timeout=60000)
    pg.evaluate("Promise.all([document.fonts.load('600 16px Poppins'), document.fonts.load('400 16px Lato'), document.fonts.load('700 16px Lato')])"); pg.wait_for_timeout(400)
    if fresh: renew(pg)
    return pg, errs, bad
def renew(pg, days_back=0):
    # Kevin's seeded asks are 4+ working days old (so the follow-up step is due, section H); sections A to G want a fresh ask (waiting, not due): their rows are dated today
    pg.evaluate("async (back) => { const D = await import('/staff6/data.js'), A = await import('/staff7/ask_data.js'); const t = A.shiftWork(A.ymd(Date.now()), -back) + 'T09:00:00-10:00'; (D.S.demoNotes || []).filter(n => n.answer === 'asked').forEach(n => { n.created_at = new Date(t).toISOString(); }); window.__staff7Render({ tick: true }); }", days_back); pg.wait_for_timeout(250)
SHIFT = "async (d) => { const R = Date, off = d * 864e5; window.Date = class extends R { constructor(...a) { a.length ? super(...a) : super(R.now() + off); } static now() { return R.now() + off; } }; window.__staff7Render({ tick: true }); }"
def shift(pg, days): pg.evaluate(SHIFT, days); pg.wait_for_timeout(250)   # the practice clock moves on by days (new Date() and Date.now() together, as the app's own clock does)
def todo(pg): return pg.evaluate("() => [...document.querySelectorAll('.wl a[href*=\"#/do/\"]')].map(a => a.innerText.replace(/\\s+/g, ' ').trim())")
def fus(pg): return [x for x in todo(pg) if x.startswith('Follow up with the chair') and 'SB 2175' in x]
def dcs(pg): return [x for x in todo(pg) if x.startswith('Decide what next') and 'SB 2175' in x]
def enc(pg, k): return pg.evaluate("(k) => encodeURIComponent(k)", k)
def go(pg, hash):
    pg.evaluate(f"location.hash = {hash!r}"); pg.wait_for_timeout(450)
def snap(pg, name, tag):
    if SHOTS: pg.screenshot(path=os.path.join(SHOTS, f'{name}_{tag}.png'))
def waiting(pg):
    return pg.evaluate("() => [...document.querySelectorAll('#hw ~ ul .sr3')].map(a => a.innerText.replace(/\\s+/g, ' ').trim())")
def row(pg, no): return next((r for r in waiting(pg) if no in r), '')
def toast_text(pg): return pg.inner_text('#toastMsg') if pg.locator('#toast.on').count() else ''

with sync_playwright() as p:
    br = p.chromium.launch()

    # ================= A. the clock, as pure maths =================
    pg, errs, bad = open_as(br, 'KV', 1440, 900)
    m = ev(pg, """const a = ask('SB2175'), b = a.b, code = a.code, rows = a.chairs.map(c => ({ ...c.row })), day = t => A.ymd(new Date(t));
      const mk = (at, ans) => a.chairs.map(c => ({ ...c.row, answer: ans, created_at: at, id: 'x' + Math.random() }));
      const at = '2026-03-10T19:00:00.000Z';   // Tuesday 9:00 AM in Honolulu
      const d = (now, rows) => A.describe('k', b, code, rows, new Date(now).getTime());
      return { thu3: A.shiftWork('2026-03-12', 3), fri3: A.shiftWork('2026-03-13', 3), sat1: A.shiftWork('2026-03-14', 1), back2: A.shiftWork('2026-03-26', -2), between: A.workBetween('2026-03-10', '2026-03-16'), weekend: A.workBetween('2026-03-13', '2026-03-16'),
        clockOn: d('2026-03-12T19:00:00Z', mk(at, 'asked')).clockOn, dueThu: d('2026-03-12T19:00:00Z', mk(at, 'asked')).due, dueFri: d('2026-03-13T19:00:00Z', mk(at, 'asked')).due, dueMon: d('2026-03-16T19:00:00Z', mk(at, 'asked')).due,
        noticeDay: a.noticeDay, noticeOn: a.noticeOn };""")
    ok(m['thu3'] == '2026-03-17' and m['fri3'] == '2026-03-18' and m['sat1'] == '2026-03-16' and m['back2'] == '2026-03-24', f'A1: 3 working days after Thu 12 Mar is Tue 17, after Fri 13 is Wed 18, a Saturday counts from Monday, 2 before Thu 26 is Tue 24 ({m})')
    ok(m['between'] == 4 and m['weekend'] == 1, f'A2: Tue 10 to Mon 16 Mar is 4 working days, the weekend between Fri 13 and Mon 16 is 1 ({m["between"]}, {m["weekend"]})')
    ok(m['clockOn'] == '2026-03-13' and m['dueThu'] is False and m['dueFri'] is True and m['dueMon'] is True, f'A3: asked Tue 10 Mar, the follow-up is not due Thu 12, is due from Fri 13 and on Mon 16 ({m["clockOn"]}, {m["dueThu"]}, {m["dueFri"]}, {m["dueMon"]})')
    ok(bool(m['noticeDay']) and m['noticeOn'] == pg.evaluate("async (d) => { const A = await import('/staff7/ask_data.js'); return A.shiftWork(d, -2); }", m['noticeDay']), f'A4: SB 2175 has a day its committee must announce a hearing ({m["noticeDay"]}), and the trigger is 2 working days before it ({m["noticeOn"]})')
    t = ev(pg, """const a = ask('SB2175'), b = a.b, code = a.code, nd = a.noticeDay, no = a.noticeOn;
      const mk = (at, ans) => a.chairs.map(c => ({ ...c.row, answer: ans, created_at: at, id: 'x' + Math.random() }));
      const noon = day => new Date(day + 'T12:00:00-10:00').getTime(), d = (day, rows) => A.describe('k', b, code, rows, noon(day));
      const just = new Date(noon(no) - 86400e3 * 1).toISOString(), prev = A.shiftWork(no, -1);
      const fresh = A.shiftWork(no, -1) + 'T19:00:00.000Z';   // asked the working day before the trigger: the 3-day clock alone would not be due
      return { leftBefore: d(prev, mk(fresh, 'left_message')).due, leftOn: d(no, mk(fresh, 'left_message')).due, willBefore: d(prev, mk(fresh, 'will_schedule')).due, willOn: d(no, mk(fresh, 'will_schedule')).due, willRemind: d(prev, mk(fresh, 'will_schedule')).remindOn, noticeOn: no };""")
    ok(t['leftBefore'] is False and t['leftOn'] is True, f'A5: a restarted clock is still not due, until the committee must announce within 2 working days, then it is ({t})')
    ok(t['willBefore'] is False and t['willOn'] is True and t['willRemind'] == t['noticeOn'], f'A6: will schedule with no hearing set: due again 2 working days before the announce day, not before ({t})')
    n = ev(pg, """const a = ask('SB2175'); const noHear = A.endedBy(a.b, a.code); const st = M.stopOf(a.b);
      return { open: noHear, moved: A.endedBy(a.b, a.code, { ...st, phase: 'floor' }), deadline: A.endedBy(a.b, a.code, { ...st, deadline: { ...st.deadline, missed: true } }) };""")
    ok(n['open'] == '' and n['moved'] == 'moved' and n['deadline'] == 'deadline', f'A7: SB 2175 is open now; a bill that left the committee or whose deadline passed has ended ({n})')
    ctx = pg.context; ctx.close()

    for (w, h) in ((1440, 900), (1280, 800), (390, 844)):
        tag = f'{w}x{h}'; phone = w < 600
        # ================= B. Home, the sheet, the bill page =================
        pg, errs, bad = open_as(br, 'KV', w, h)
        pg.evaluate("() => { const b = document.getElementById('laterBtn'); }")
        r = row(pg, 'SB 2175')
        ok(re.search(r'Disposable e-cigarette ban SB 2175 Waiting on Rep\. Takayama · asked \w{3}, \w{3} \d+ · no reply yet', r), f'{tag} B1: Home, under Waiting on others: the ask row says who, when and no reply yet ({r!r})')
        r2 = row(pg, 'HB 756'); ok('Waiting on Sen. Keohokalole and Sen. San Buenaventura' in r2 and 'no reply yet' in r2, f'{tag} B1: the two-chair ask names both chairs ({r2!r})')
        ok('followask' not in pg.content() and 'Follow up with the chair' not in pg.inner_text('.wl'), f'{tag} B1: the old "Follow up with the chair" suggestion that linked to the old app is gone')
        k = key(pg); href = '#/ask/' + pg.evaluate("(k) => encodeURIComponent(k)", k)
        pg.click('.wl a[href="%s"]' % href.replace('|', '%7C')) if not phone else go(pg, href); pg.wait_for_timeout(450)
        ok(pg.evaluate(H1) == 'Did the chair reply?' and re.match(r'You asked House Health for a hearing on \w{3}, \w{3} \d+\.', pg.locator('.stmain .lead').inner_text()), f'{tag} B2: the row opens "Did the chair reply?" and says what was asked and when ({pg.locator(".stmain .lead").inner_text()!r})')
        opts = pg.locator('#opts .cch').all_inner_texts()
        ok([o.split('\n')[0] for o in opts] == ['Will schedule', 'Said no', 'No answer yet'] and opts[2].split('\n')[1] == 'We remind you again in 3 working days' and 'called' not in opts[2].lower() and 'message' not in opts[2].lower(), f'{tag} B2: three answers in the words of the drawing ({opts})')
        ok(pg.locator('.cfoot a, .cfoot button').all_inner_texts() == ['Give this ask to…', 'See the email you sent'], f'{tag} B2: the two text links ({pg.locator(".cfoot .btn").all_inner_texts()})')
        ok(pg.evaluate(FILLED) == 0 and pg.evaluate(NOSIDE) and not pg.evaluate(SMALL), f'{tag} B2: no filled button (S-2), no sideways scroll, targets 44px ({pg.evaluate(SMALL)})')
        snap(pg, 'B2_reply', tag)
        pg.click('#seeMail'); pg.wait_for_timeout(200)
        ok(pg.locator('#mailSee').is_visible() and '@capitol.hawaii.gov' in pg.inner_text('#mailSee') and 'vape' not in pg.inner_text('#mailSee').lower(), f'{tag} B2: See the email you sent opens the email in place')
        # the bill page
        bref = ev(pg, "return M.billRef(bill('SB2175'));"); go(pg, '#/bill/' + bref)
        line = pg.inner_text('#bChair') if pg.locator('#bChair').count() else ''
        ok(re.search(r'You asked House Health for a hearing on \w{3}, \w{3} \d+ · no reply yet', line) and pg.locator('#bReply').inner_text() == 'The chair replied' and pg.locator('#bReply.quiet').count() == 1, f'{tag} B3: the bill page says where the ask stands, with the quiet button The chair replied ({line!r})')
        ok(pg.evaluate(FILLED) <= 1 and pg.evaluate(NOSIDE) and not errs and not bad, f'{tag} B3: bill page: at most one filled button, no sideways scroll, no page errors ({errs[:1]})')
        snap(pg, 'B3_bill', tag)
        pg.click('#bReply'); pg.wait_for_timeout(450)
        ok(pg.evaluate(H1) == 'Did the chair reply?', f'{tag} B3: The chair replied opens the reply sheet')
        pg.context.close()
        # anyone on staff can record it: Jess sees "Kevin asked ..." and the same button
        pg, errs, bad = open_as(br, 'JS', w, h, '#/bill/' + bref)
        ok(pg.locator('#bChair').count() == 1 and pg.inner_text('#bChair').startswith('Kevin asked House Health') and pg.locator('#bReply').count() == 1 and 'SB 2175' not in ' '.join(waiting(pg)), f'{tag} B4: another person sees "Kevin asked ..." with the button, and the ask is not in their Waiting ({pg.inner_text("#bChair")[:60]!r})')
        pg.context.close()

        # ================= C. each reply =================
        pg, errs, bad = open_as(br, 'KV', w, h); k = key(pg); H = '#/ask/' + pg.evaluate("(k) => encodeURIComponent(k)", k); go(pg, H)
        # C1 will schedule
        n0 = ev(pg, "return A.allAsks().length;")
        pg.click('#opts [data-ans=will_schedule]'); pg.wait_for_selector('.done'); pg.wait_for_timeout(300)
        ok(pg.evaluate(H1) == 'Rep. Takayama will schedule it.' and 'When the hearing is set you get the step Write testimony.' in pg.inner_text('.done .sub') and pg.locator('#undoBtn').count() == 1, f'{tag} C1: Will schedule: its own done page with Undo ({pg.evaluate(H1)!r})')
        st = ev(pg, "const a = ask('SB2175'); return { ans: a.answer, will: a.yes.length, old: M.chairAskOf(a.b, a.code).answer };")
        ok(st['ans'] == 'will_schedule' and st['old'] == 'will_schedule', f'{tag} C1: recorded as will_schedule, and the old app reads it the same ({st})')
        ok(pg.evaluate(FILLED) <= 1 and pg.evaluate(NOSIDE) and not pg.evaluate(SMALL), f'{tag} C1: done page: at most one filled button, no sideways scroll ({pg.evaluate(SMALL)})')
        snap(pg, 'C1_will', tag)
        ok('will schedule it' in row(pg, 'SB 2175') if not phone else True, f'{tag} C1: Home says so under Waiting')
        pg.click('#undoBtn'); pg.wait_for_selector('#opts'); pg.wait_for_timeout(300)
        st = ev(pg, "const a = ask('SB2175'); return { ans: a.answer, rows: a.chairs.length };")
        ok(st['ans'] == 'asked' and pg.evaluate(H1) == 'Did the chair reply?', f'{tag} C1: Undo puts the ask back and returns to the sheet ({st})')
        # C2 said no
        pg.click('#opts [data-ans=said_no]'); pg.wait_for_timeout(500)
        ok(toast_text(pg).startswith('Recorded: Rep. Takayama said no.') and pg.locator('#toastUndo').is_visible(), f'{tag} C2: Said no records and says so with Undo ({toast_text(pg)!r})')
        snap(pg, 'C2_saidno', tag)
        st = ev(pg, "const a = ask('SB2175'); return { no: a.saidNo, old: M.chairAskOf(a.b, a.code).answer, due: a.due };")
        ok(st['no'] and st['old'] == 'said_no' and not st['due'], f'{tag} C2: either chair saying no is Said no, the old app agrees, no follow-up is due ({st})')
        ok(pg.evaluate(H1) == 'The chair said no' and 'Decide what next' in pg.inner_text('.wl'), f'{tag} C2: a no opens the step Decide what next, and it is in To do ({pg.evaluate(H1)!r})')
        pg.click('#toastUndo'); pg.wait_for_timeout(500)
        ok(ev(pg, "return ask('SB2175').saidNo;") is False and pg.evaluate(H1) == 'Did the chair reply?', f'{tag} C2: Undo takes it back and returns to the reply sheet')
        pg.click('#opts [data-ans=said_no]'); pg.wait_for_timeout(500); go(pg, H)
        ok('said no' in pg.inner_text('.stmain') and 'recorded today by you' in pg.inner_text('.stmain'), f'{tag} C2: the reply sheet shows what was recorded and who recorded it ({pg.locator(".cans").first.inner_text()!r})')
        ev(pg, "const a = ask('SB2175'); await D.DB.delLegNote(a.chairs[0].row.id, a.chairs[0].lid);"); go(pg, H); pg.wait_for_selector('#opts')   # back to a plain ask for the next check
        # C3 no answer yet restarts the clock
        pg.click('#opts [data-ans=left_message]'); pg.wait_for_timeout(500)
        st = ev(pg, "const a = ask('SB2175'); return { ans: a.answer, clockDay: a.clockDay, today: A.ymd(Date.now()), clockOn: a.clockOn, want: A.shiftWork(A.ymd(Date.now()), 3), due: a.due, noticeOn: a.noticeOn };")
        ok(st['ans'] == 'left_message' and st['clockDay'] == st['today'] and st['clockOn'] == st['want'] and st['due'] is False, f'{tag} C3: No answer yet saves left_message and restarts the 3-day clock from today ({st})')
        ok(toast_text(pg).startswith('Saved. We remind you again on '), f'{tag} C3: the toast says when we remind you ({toast_text(pg)!r})')
        ok(('no reply yet' in row(pg, 'SB 2175') and 'left a message' not in row(pg, 'SB 2175')) if not phone else True, f'{tag} C3: Home says no reply yet, never that a message was left ({row(pg, "SB 2175")!r})')
        st = ev(pg, "const a = ask('SB2175'); return { body: a.chairs[0].row.body, line: A.waitLine(a), state: A.stateWords(a), bill: A.billLine(a) };")
        ok(st['body'] == 'No reply yet from Rep. Takayama about a hearing on SB2175 (HLT); reminder restarted.' and not any('left a message' in x.lower() or 'called' in x.lower() for x in st.values()), f'{tag} C3: the note, the Home line and the bill line say no reply yet; no call is claimed ({st})')
        go(pg, H); ok('No reply yet from Rep. Takayama' in pg.inner_text('.stmain') and 'left a message' not in pg.inner_text('.stmain').lower(), f'{tag} C3: the reply sheet says no reply yet ({pg.locator(".cans").first.inner_text()!r})')
        pg.click('#toastUndo'); pg.wait_for_timeout(500)
        ok(ev(pg, "const a = ask('SB2175'); return a.answer === 'asked' && a.due === false;"), f'{tag} C3: Undo puts back the first ask and its clock')
        ok(not errs and not bad, f'{tag} C: no page or console errors, nothing outside the app ({errs[:1]} {bad[:1]})')
        pg.context.close()

        # ================= D. two chairs =================
        pg, errs, bad = open_as(br, 'KV', w, h); k2 = key(pg, 'HB756'); H2 = '#/ask/' + pg.evaluate("(k) => encodeURIComponent(k)", k2); go(pg, H2)
        ok(pg.locator('#whoH').inner_text() == 'Who replied?' and pg.locator('input[name=chairpick]').count() == 2 and 'both committees' in pg.locator('.stmain .lead').inner_text(), f'{tag} D1: two chairs: "Who replied?", a choice of one ({pg.locator(".stmain .lead").inner_text()!r})')
        off = pg.evaluate("() => [...document.querySelectorAll('#opts [data-ans]')].map(b => b.getAttribute('aria-disabled'))")
        ok(pg.locator('input[name=chairpick]:checked').count() == 0 and off == ['true'] * 3 and 'Pick who replied first' in pg.inner_text('.stmain'), f'{tag} D1: no chair is chosen at first; the three answers are disabled with "Pick who replied first" ({off})')
        pg.click('#opts [data-ans=said_no]', force=True); pg.wait_for_timeout(300)   # force: the button is aria-disabled, so Playwright would wait forever
        ok(ev(pg, "return ask('HB756').saidNo === false && ask('HB756').chairs.every(c => c.answer === 'asked');") and pg.locator('#opts').count() == 1, f'{tag} D1: clicking a disabled answer records nothing')
        snap(pg, 'D1_pick_none', tag)
        pg.locator('label.cr', has_text='San Buenaventura').click(); pg.wait_for_timeout(300)
        on = pg.evaluate("() => [...document.querySelectorAll('#opts [data-ans]')].map(b => b.getAttribute('aria-disabled'))")
        ok(on == [None] * 3 and pg.locator('#didH').inner_text().startswith('Did Sen. San Buenaventura reply?') and 'Pick who replied first' not in pg.inner_text('.stmain'), f'{tag} D1: picking a chair enables the answers and asks about that chair ({pg.locator("#didH").inner_text()!r})')
        bd = pg.evaluate("() => { const l = document.querySelector('.cr:has(input:checked)'), c = getComputedStyle(l), a = getComputedStyle(document.documentElement).getPropertyValue('--act').trim(); const t = document.createElement('i'); t.style.color = a; document.body.append(t); const col = getComputedStyle(t).color; t.remove(); return [c.borderTopWidth, c.borderTopColor === col]; }")
        ok(bd == ['2px', True], f'{tag} D1: the chosen chair has the action-colour 2px border ({bd})')
        snap(pg, 'D1_pick_chosen', tag)
        pg.locator('label.cr', has_text='Keohokalole').click(); pg.wait_for_timeout(300)
        pg.click('#opts [data-ans=will_schedule]'); pg.wait_for_selector('.done'); pg.wait_for_timeout(300)
        ok(pg.evaluate(H1) == 'Sen. Keohokalole will schedule it.' and 'San Buenaventura has not answered yet' in pg.inner_text('.done .sub'), f'{tag} D2: one chair saying yes leaves the other "no reply yet" ({pg.evaluate(H1)!r})')
        st = ev(pg, "const a = ask('HB756'); return { ans: a.answer, yes: a.yes.length, quiet: a.quiet.length, line: A.waitLine(a), old: M.chairAskOf(a.b, a.code).answer };")
        ok(st['yes'] == 1 and st['quiet'] == 1 and st['ans'] == 'asked' and st['line'] == 'Sen. Keohokalole will schedule it · waiting on Sen. San Buenaventura', f'{tag} D2: each chair kept apart; the row says who is still to answer ({st["line"]!r})')
        pg.click('#undoBtn'); pg.wait_for_selector('#opts'); pg.wait_for_timeout(200)
        pg.locator('label.cr', has_text='Keohokalole').click(); pg.wait_for_timeout(300); pg.click('#opts [data-ans=will_schedule]'); pg.wait_for_selector('.done')   # again, and stay in this state
        go(pg, H2)
        ok(pg.locator('.cans').first.inner_text().startswith('Sen. Keohokalole will schedule it') and 'recorded today by you' in pg.locator('.cans').first.inner_text() and pg.locator('#didH').inner_text() == 'Did Sen. San Buenaventura reply?', f'{tag} D3: the sheet keeps the first chair\'s answer and asks only about the other ({pg.locator(".cans").first.inner_text()!r})')
        snap(pg, 'D3_mixed', tag)
        pg.click('#opts [data-ans=said_no]'); pg.wait_for_timeout(500)
        st = ev(pg, "const a = ask('HB756'); return { no: a.saidNo, ans: a.answer, yes: a.yes.length, no2: a.noes.map(c => c.who) };")
        ok(st['no'] and st['ans'] == 'said_no' and st['yes'] == 1 and st['no2'] == ['Sen. San Buenaventura'], f'{tag} D4: either chair saying no makes it Said no, the other\'s yes is kept ({st})')
        ok(not errs and not bad, f'{tag} D: no page or console errors ({errs[:1]})')
        pg.context.close()

        # ================= E. give, and Undo =================
        pg, errs, bad = open_as(br, 'KV', w, h); k = key(pg); H = '#/ask/' + pg.evaluate("(k) => encodeURIComponent(k)", k); go(pg, H)
        ev(pg, "A.setHold(arg, { to: adv('KR').id, by: S.me.id, at: Date.now() });", k); go(pg, H); pg.click('#giveLink'); pg.wait_for_selector('.cwho'); pg.wait_for_timeout(300)   # Kris holds it, so Kevin, who leads the bill, is who it can go to first
        ok(pg.locator('.stmain h2.sh').first.inner_text() == 'Who should take this ask over?', f'{tag} E1: the heading says who should take this ask over ({pg.locator(".stmain h2.sh").first.inner_text()!r})')
        ok(pg.evaluate(H1) == 'Give this ask' and pg.locator('.cwho .cch').count() >= 8, f'{tag} E1: Give this ask to…: everyone but the one who has it ({pg.locator(".cwho .cch").count()})')
        order = pg.evaluate("() => [...document.querySelectorAll('.cwho .cch')].map(b => b.innerText.replace(/\\s+/g, ' ').trim())")
        ok(order[0].startswith('KV Kevin') and 'Leads this bill' in order[0] and not any('Kris' in o for o in order) and 'lead' in pg.get_attribute('.cwho .cch', 'class'), f'{tag} E1: the bill\'s lead comes first, in a card of its own; the one who has it is not offered ({order[:3]})')
        ev(pg, "A.setHold(arg, null);", k); go(pg, H); pg.click('#giveLink'); pg.wait_for_selector('.cwho')
        ok(pg.evaluate(FILLED) == 0 and pg.evaluate(NOSIDE) and not pg.evaluate(SMALL), f'{tag} E1: no filled button, no sideways scroll, targets 44px ({pg.evaluate(SMALL)})')
        snap(pg, 'E1_give', tag)
        pg.locator('.cwho .cch', has_text='Kris').click(); pg.wait_for_selector('.done'); pg.wait_for_timeout(300)
        ok(pg.evaluate(H1) == 'Kris has this ask now.' and 'Kris waits on Rep. Takayama' in pg.inner_text('.done .sub') and 'Follow up with the chair' in pg.inner_text('.done .sub') and 'no message is sent' in pg.inner_text('.done .sub'), f'{tag} E2: done says who has it now and that nothing is sent in the practice copy ({pg.evaluate(H1)!r})')
        ok(ev(pg, "return A.askById(arg)?.holder === adv('KR').id;", k) and (phone or 'Kris waits on Rep. Takayama' in row(pg, 'SB 2175')), f'{tag} E2: Kris now holds it; Kevin, who asked, sees "Kris waits on ..." ({row(pg, "SB 2175")!r})')
        snap(pg, 'E2_give_done', tag)
        # the receiver: Kris sees the ask waiting, and it reads as hers
        pg.goto(f'{BASE}/staff7.html?demo=1&as=KR'); pg.wait_for_selector('.paper'); pg.wait_for_timeout(700)
        ok(re.search(r'Waiting on Rep\. Takayama · asked', row(pg, 'SB 2175')), f'{tag} E3: Kris, who has it now, waits on the chair ({row(pg, "SB 2175")!r})')
        pg.goto(f'{BASE}/staff7.html?demo=1&as=KV'); pg.wait_for_selector('.paper'); pg.wait_for_timeout(700)
        go(pg, H); go(pg, '#/'); pg.evaluate(f"location.hash = '#/done/' + encodeURIComponent('ask:' + {k!r})"); pg.wait_for_timeout(300)
        go(pg, H)
        ok('Kris has this ask now' in pg.inner_text('.stmain .lead'), f'{tag} E3: the reply sheet says Kris has it ({pg.locator(".stmain .lead").inner_text()!r})')
        # give it again, then Undo restores the earlier holder (Kris)
        pg.click('#giveLink'); pg.wait_for_selector('.cwho'); pg.locator('.cwho .cch', has_text='Patti').click(); pg.wait_for_selector('.done'); pg.wait_for_timeout(300)
        ok(ev(pg, "return A.askById(arg).holder === adv('PH').id;", k), f'{tag} E4: given to Patti')
        pg.click('#undoBtn'); pg.wait_for_selector('#opts'); pg.wait_for_timeout(300)
        ok(ev(pg, "return A.askById(arg).holder === adv('KR').id;", k) and 'Kris has this ask now' in pg.inner_text('.stmain .lead'), f'{tag} E4: Undo restores the earlier holder, Kris')
        pg.click('#giveLink'); pg.wait_for_selector('.cwho'); pg.locator('.cwho .cch', has_text='Kevin').click(); pg.wait_for_selector('.done')
        ok(ev(pg, "return A.askById(arg).holder === adv('KV').id && A.holdOf(arg) === null;", k) and pg.evaluate(H1) == 'You have this ask now.', f'{tag} E5: giving it back to the one who asked leaves no hold ({pg.evaluate(H1)!r})')
        ok(not errs and not bad, f'{tag} E: no page or console errors ({errs[:1]})')
        pg.context.close()

        # ================= F. two people record at once =================
        pg, errs, bad = open_as(br, 'KV', w, h); k = key(pg); H = '#/ask/' + pg.evaluate("(k) => encodeURIComponent(k)", k); go(pg, H)
        ev(pg, "const a = ask('SB2175'); const p = S.me; S.me = adv('LR'); await D.DB.addLegNote(a.chairs[0].lid, a.b.id, 'Rep. Takayama will schedule a hearing on SB2175 (HLT).', { answer: 'will_schedule', committee: a.code }); S.me = p;")
        pg.click('#opts [data-ans=said_no]'); pg.wait_for_timeout(600)
        st = ev(pg, "const a = ask('SB2175'); return { ans: a.answer, by: a.chairs[0].by === S.me.id };")
        ok(st['ans'] == 'said_no' and st['by'] and 'Lauren had recorded “will schedule” a moment ago; yours replaces it.' in toast_text(pg), f'{tag} F1: the newest word wins, and the second person is told who was first ({toast_text(pg)!r})')
        pg.context.close()

        # ================= G. it ends by itself =================
        pg, errs, bad = open_as(br, 'KV', w, h); k = key(pg); H = '#/ask/' + pg.evaluate("(k) => encodeURIComponent(k)", k)
        ev(pg, "const a = ask('SB2175'); S.hearings.push({ id: 'h-end', bill_id: a.b.id, committee: a.code, status: 'scheduled', scheduled_at: new Date(Date.now() + 5 * 864e5).toISOString(), room: null }); window.__staff7Render({ tick: true });")
        pg.wait_for_timeout(400)
        ok('SB 2175' not in ' '.join(waiting(pg)) and ev(pg, "return A.allAsks().find(a => a.b.id === bill('SB2175').id).ended;") == 'hearing', f'{tag} G1: a hearing set for that committee ends the ask with no click: it leaves Waiting')
        go(pg, H); ok(pg.evaluate(H1).startswith('That step is done'), f'{tag} G1: its reply sheet is gone ({pg.evaluate(H1)!r})')
        ok(ev(pg, "const a = A.allAsks().find(a => a.b.id === bill('SB2175').id); return !a.due;"), f'{tag} G1: an ended ask asks for no follow-up')
        ok(not errs and not bad, f'{tag} G: no page or console errors ({errs[:1]})')
        pg.context.close()

        # ================= H. part 2: Follow up with the chair, Decide what next, the vice chair, ending by itself =================
        # H1 the step appears after 3 working days (weekend skipped) and not before
        pg, errs, bad = open_as(br, 'KV', w, h, fresh=False); k = key(pg); FU = '#/do/fu-' + enc(pg, k); H = '#/ask/' + enc(pg, k)
        t = [x for x in todo(pg) if 'SB 2175' in x]
        ok(len(t) == 1 and t[0].startswith('Follow up with the chair · Disposable e-cigarette ban') and 'Today' in t[0] and 'SB 2175' not in ' '.join(waiting(pg)), f'{tag} H1: an ask 4 working days old is a step in To do, no longer a Waiting row ({t})')
        ok(pg.locator(f'.wl a[href="{FU.replace("|", "%7C")}"]').count() == 1, f'{tag} H1: the step is at #/do/fu-<key>')
        renew(pg, 2); ok(not [x for x in todo(pg) if 'SB 2175' in x] and 'SB 2175' in ' '.join(waiting(pg)), f'{tag} H1: asked Thu 12 Mar (2 working days before Mon 16 Mar), no step yet: the weekend is not counted')
        renew(pg, 3); ok(len([x for x in todo(pg) if 'SB 2175' in x]) == 1, f'{tag} H1: asked Wed 11 Mar (3 working days), the step is due')
        renew(pg, 4)
        # H2 the page as drawn
        go(pg, FU); pg.wait_for_selector('#fuFoot'); pg.wait_for_timeout(300)
        tx = pg.inner_text('.paper')
        ok(pg.evaluate(H1) == 'Follow up with the chair' and 'Follow up today' in tx and re.search(r'Needs a hearing by \w{3}, Mar 30, in 14 days\. The committee must announce the hearing by \w{3}, Mar 2\d\.', tx), f'{tag} H2: the clock box: Follow up today, the hearing-by and announce-by days')
        ok('Rep. Takayama has not answered since Tue, Mar 10. A short second note often gets it scheduled.' in tx and 'Your follow-up to the chair' in tx and 'Or call the office: 808-586-6340' in tx, f'{tag} H2: who has not answered since when, and the office phone the Capitol lists')
        ok(pg.input_value('#subj') == 'Following up: hearing on SB 2175' and 'Aloha Rep. Takayama,' in pg.input_value('#letter') and 'I am following up on my note of Tuesday, March 10 asking you to schedule a hearing on SB 2175, Disposable e-cigarette ban, before the committee deadline on Monday, March 30.' in pg.input_value('#letter') and 'vape' not in pg.input_value('#letter').lower(), f'{tag} H2: the second note, in the drawing\'s words ({pg.input_value("#subj")!r})')
        vis = pg.evaluate("() => [...document.querySelectorAll('#fuFoot > .btn, #fuFoot .fnote, #fuFoot .fnote .btn')].filter(e => e.getBoundingClientRect().width > 0).map(e => e.id || e.className)")
        if phone: ok(vis == ['btn filled', 'btn quiet'] or [v for v in vis if v in ('mailBtn', 'replied')] == ['mailBtn', 'replied'] and 'giveLink' not in vis, f'{tag} H2: on a phone the docked footer holds only the filled button and The chair replied ({vis})')
        else: ok(vis[:2] == ['mailBtn', 'replied'] and 'giveLink' in vis, f'{tag} H2: footer: Open in my mail app, The chair replied, the hint and Give this ask to… ({vis})')
        if phone:
            gv = pg.evaluate("() => { const e = document.getElementById('giveLinkBody'); if (!e) return null; const r = e.getBoundingClientRect(); return [r.width > 0, e.getAttribute('href')]; }")
            ok(gv and gv[0] and gv[1].startswith('#/give/'), f'{tag} H2: on a phone Give this ask to… is a text link at the end of the page ({gv})')
            sj = pg.evaluate("() => { const f = document.getElementById('subj').getBoundingClientRect(), l = document.querySelector('label[for=subj]').getBoundingClientRect(); return [l.bottom <= f.top + 1, f.width]; }")
            ok(sj[0] and sj[1] > 300, f'{tag} H2: on a phone the Subject label sits above its field, the field has the width ({sj})')
        else: ok(pg.evaluate("() => { const e = document.getElementById('giveLinkBody'); return !e || e.getBoundingClientRect().width === 0; }"), f'{tag} H2: on a laptop the link stays in the footer only')
        ok(pg.evaluate(FILLED) == 1 and pg.evaluate(NOSIDE) and not pg.evaluate(SMALL), f'{tag} H2: one filled button in view (S-2), no sideways scroll, targets 44px ({pg.evaluate(FILLED)}, {pg.evaluate(SMALL)})')
        snap(pg, 'H2_followup', tag)
        # a chair with no listed phone: no phone line
        ev(pg, "const l = S.legislators.find(l => String(l.id) === String(ask('SB2175').chairs[0].id)); window.__ph = l.phone; l.phone = ''; window.__staff7Render({ tick: true });"); pg.wait_for_timeout(250)
        ok('Or call the office' not in pg.inner_text('.paper'), f'{tag} H2: no phone listed, no "Or call the office" line')
        ev(pg, "const l = S.legislators.find(l => String(l.id) === String(ask('SB2175').chairs[0].id)); l.phone = window.__ph; window.__staff7Render({ tick: true });"); pg.wait_for_timeout(250)
        # H3 mail, Did you send it?, Not yet, The chair replied
        pg.click('#mailBtn'); pg.wait_for_selector('#yesBtn'); pg.wait_for_timeout(200)
        ok(pg.inner_text('#fq') == 'Did you send it?' and pg.locator('#yesBtn.filled').count() == 1 and pg.locator('#notYet').count() == 1 and pg.evaluate(FILLED) == 1, f'{tag} H3: after Open in my mail app: "Did you send it?" Yes, sent / Not yet, one filled button')
        pg.click('#notYet'); pg.wait_for_selector('#mailBtn'); pg.wait_for_timeout(150)
        ok(pg.locator('#mailBtn').is_visible() and ev(pg, "return ask('SB2175').followedAt === 0;"), f'{tag} H3: Not yet puts the footer back and records nothing')
        pg.click('#replied'); pg.wait_for_selector('#opts'); pg.wait_for_timeout(250)
        ok(pg.evaluate(H1) == 'Did the chair reply?', f'{tag} H3: The chair replied from the step opens the reply sheet')
        # H4 Yes, sent
        go(pg, FU); pg.wait_for_selector('#mailBtn'); pg.click('#mailBtn'); pg.wait_for_selector('#yesBtn'); n0 = ev(pg, "return S.demoNotes.length;")
        pg.click('#yesBtn'); pg.wait_for_selector('.done'); pg.wait_for_timeout(400)
        st = ev(pg, "const a = ask('SB2175'); const r = a.chairs[0].row; return { ans: a.answer, body: r.body, clockDay: a.clockDay, today: A.ymd(Date.now()), due: a.due, remind: a.remindOn, n: S.demoNotes.length, fu: a.followedAt > 0, line: A.waitLine(a), noMore: a.noMore };")
        ok(st['ans'] == 'left_message' and st['body'].startswith('Followed up with Rep. Takayama') and st['clockDay'] == st['today'] and st['due'] is False and st['n'] == n0 + 1 and st['fu'], f'{tag} H4: Yes, sent records a follow-up row and restarts the 3-day clock ({st})')
        d = pg.inner_text('.done')
        ok(pg.evaluate(H1) == 'Followed up.' and re.search(r'We remind you again on \w{3}, Mar 19 if there is still no reply\. Nothing else needs you on Disposable e-cigarette ban until then\.', d) and pg.locator('#undoBtn').inner_text() == 'I have not sent it yet', f'{tag} H4: done: "Followed up. We remind you again on ..." with "I have not sent it yet" ({d[:160]!r})')
        ok(pg.evaluate(FILLED) <= 1 and pg.evaluate(NOSIDE) and not pg.evaluate(SMALL), f'{tag} H4: done page: at most one filled button, no sideways scroll')
        snap(pg, 'H4_followed', tag)
        if not phone: ok(re.search(r'Waiting on Rep\. Takayama · followed up today · next reminder \w{3}, Mar 19', row(pg, 'SB 2175')) and not [x for x in todo(pg) if 'SB 2175' in x], f'{tag} H4: Home: waiting row "followed up today · next reminder ...", the step is gone ({row(pg, "SB 2175")!r})')
        pg.click('#undoBtn'); pg.wait_for_selector('#mailBtn'); pg.wait_for_timeout(300)
        ok(ev(pg, "const a = ask('SB2175'); return a.followedAt === 0 && a.due === true && S.demoNotes.length === arg;", n0) and pg.evaluate("() => location.hash").startswith('#/do/fu-'), f'{tag} H4: "I have not sent it yet" takes the row back; the step is open again at its first footer')
        # follow-ups have no cap: a second follow-up after the next 3 working days, and a third
        for i in range(2):
            ev(pg, "const a = ask('SB2175'); const r = await D.DB.addLegNote(a.chairs[0].lid, a.b.id, 'Followed up with Rep. Takayama about a hearing on SB2175 (HLT).', { answer: 'left_message', committee: a.code }); S.demoNotes.find(x => x.id === r.id).created_at = new Date(Date.now() - arg * 864e5).toISOString(); window.__staff7Render({ tick: true });", 9 - 4 * i)
        pg.wait_for_timeout(250)
        ev(pg, "const a = ask('SB2175'); S.demoNotes.filter(n => n.answer === 'left_message').sort((x, y) => String(x.created_at).localeCompare(String(y.created_at))).at(-1).created_at = new Date(Date.now() - 5 * 864e5).toISOString(); window.__staff7Render({ tick: true });"); pg.wait_for_timeout(250)
        ok(ev(pg, "const a = ask('SB2175'); return a.due === true && a.followedAt > 0;") and len(fus(pg)) == 1, f'{tag} H4: no cap: with two follow-ups on record and 3 more working days of quiet there is another one')
        ok(not errs and not bad, f'{tag} H: no page or console errors, nothing outside the app so far ({errs[:1]} {bad[:1]})')
        pg.context.close()

        # H5 the committee must announce within 2 working days: due before the 3-day clock; and "announce day is tomorrow" (choice a)
        pg, errs, bad = open_as(br, 'KV', w, h, fresh=False); k = key(pg); FU = '#/do/fu-' + enc(pg, k)
        ev(pg, "const nd = ask('SB2175').noticeOn; const prev = A.shiftWork(nd, -1); S.demoNotes.filter(n => n.answer === 'asked').forEach(n => { n.created_at = new Date(prev + 'T09:00:00-10:00').toISOString(); });")
        ok(ev(pg, "const a = ask('SB2175'); return a.due === false && a.clockOn > a.noticeOn;"), f'{tag} H5: asked the working day before the trigger: not due yet')
        shift(pg, 7)   # Mon 23 Mar: 2 working days before the committee must announce (Wed 25 Mar)
        st = ev(pg, "const a = ask('SB2175'); return { due: a.due, clockOn: a.clockOn, today: A.ymd(Date.now()), noticeOn: a.noticeOn };")
        ok(st['due'] is True and st['today'] == st['noticeOn'] and st['clockOn'] > st['today'], f'{tag} H5: the announce-within-2-working-days trigger makes the step due before the 3-day clock runs out ({st})')
        go(pg, FU); pg.wait_for_selector('#mailBtn'); pg.click('#mailBtn'); pg.wait_for_selector('#yesBtn'); pg.click('#yesBtn'); pg.wait_for_selector('.done'); pg.wait_for_timeout(400)
        d = pg.inner_text('.done')
        ok('Nothing else needs you' not in d and re.search(r'The committee must announce the hearing by \w{3}, Mar 25\. If there is no reply by \w{3}, Mar 24, we put Call the chair\'s office in your To do\.', d), f'{tag} H5: the done page says when Call the chair\'s office comes ({d[:260]!r})')
        fl = pg.evaluate("() => [...document.querySelectorAll('.btn.filled')].filter(b => b.getBoundingClientRect().width > 0).map(b => b.id + ':' + b.innerText.trim())")
        ok(fl == ['callOffice:Call the office: 808-586-6340'] and pg.locator('#callOffice').get_attribute('href') == 'tel:8085866340' and 'text' in pg.locator('#askPublic').get_attribute('class') and pg.locator('#askPublic').get_attribute('href') == '#/public/SB2175', f'{tag} H5: last-chance page: the one filled button is Call the office; Ask partners and the public is a text link ({fl})')
        nxl = pg.locator('.done .actions .btn')
        ok(nxl.count() == 0 or 'filled' not in nxl.first.get_attribute('class'), f'{tag} H5: any Next step on this page is quiet, not filled')
        snap(pg, 'H5_last', tag)
        pg.click('#askPublic'); pg.wait_for_timeout(500)
        ok('public' in pg.evaluate("() => location.hash"), f'{tag} H5: Ask partners and the public opens public mode for the bill')
        ok(not errs and not bad, f'{tag} H5: no page or console errors ({errs[:1]})')
        # H5b the call comes back as a step on the working day before the announce day, not before
        go(pg, '#/'); ok(not any('SB 2175' in x for x in todo(pg)) and 'SB 2175' in ' '.join(waiting(pg)), f'{tag} H5b: on the follow-up day nothing is in To do for SB 2175 ({[x for x in todo(pg) if "SB 2175" in x]})')
        shift(pg, 1)   # Tue 24 Mar: the working day before the announce day
        t = [x for x in todo(pg) if 'SB 2175' in x]
        ok(len(t) == 1 and t[0].startswith("Call the chair's office · Disposable e-cigarette ban"), f'{tag} H5b: the working day before the announce day, "Call the chair\'s office" is in To do ({t})')
        CALL = '#/do/fu-' + enc(pg, k); go(pg, CALL); pg.wait_for_selector('#callBtn'); pg.wait_for_timeout(500)
        tx = pg.inner_text('.paper'); order = pg.evaluate("() => ['callBtn', 'askPublic', 'subj', 'mailBtn'].map(i => document.getElementById(i).getBoundingClientRect().top)")
        ok(pg.evaluate(H1) == "Call the chair's office" and pg.locator('#callBtn').get_attribute('href') == 'tel:8085866340' and 'Ask partners and the public' in tx and 'Or email them again' in tx and order[1] < order[2] <= order[3], f'{tag} H5b: the call page: phone first, Ask partners and the public, the email below ({order})')
        ok(pg.evaluate(FILLED) == 1 and pg.evaluate(NOSIDE) and not pg.evaluate(SMALL), f'{tag} H5b: one filled button, no sideways scroll ({pg.evaluate(FILLED)}, {pg.evaluate(SMALL)})')
        snap(pg, 'H5b_callstep', tag)
        pg.locator('#mailBtn').click(); pg.wait_for_selector('#yesBtn'); pg.click('#yesBtn'); pg.wait_for_selector('.done'); pg.wait_for_timeout(300)
        go(pg, '#/'); ok(not any('SB 2175' in x for x in todo(pg)), f'{tag} H5b: Yes, sent on the call step answers it for good ({[x for x in todo(pg) if "SB 2175" in x]})')
        pg.context.close()
        # H5c with no phone listed the step keeps its old name
        pg, errs, bad = open_as(br, 'KV', w, h, fresh=False); k = key(pg)
        ev(pg, "const nd = ask('SB2175').noticeOn; const prev = A.shiftWork(nd, -1); S.demoNotes.filter(n => n.answer === 'asked').forEach(n => { n.created_at = new Date(prev + 'T09:00:00-10:00').toISOString(); }); M.legById(ask('SB2175').chairs[0].id).phone = '';"); shift(pg, 7)
        go(pg, '#/do/fu-' + enc(pg, k)); pg.wait_for_selector('#mailBtn'); pg.click('#mailBtn'); pg.wait_for_selector('#yesBtn'); pg.click('#yesBtn'); pg.wait_for_selector('.done'); pg.wait_for_timeout(400)
        d = pg.inner_text('.done'); fl = pg.evaluate("() => [...document.querySelectorAll('.btn.filled')].filter(b => b.getBoundingClientRect().width > 0).map(b => b.id)")
        ok('we put Follow up with the chair in your To do' in d and fl == ['askPublic'], f'{tag} H5c: with no phone, Ask partners and the public is the filled one and the step stays Follow up with the chair ({fl})')
        shift(pg, 1); ok(any(x.startswith('Follow up with the chair') and 'SB 2175' in x for x in todo(pg)), f'{tag} H5c: the next day it is Follow up with the chair')
        pg.context.close()

        # H6 will schedule, and no hearing is set 2 working days before the announce day
        pg, errs, bad = open_as(br, 'KV', w, h, fresh=False); k = key(pg); FU = '#/do/fu-' + enc(pg, k)
        ev(pg, "const a = ask('SB2175'); const r = await D.DB.addLegNote(a.chairs[0].lid, a.b.id, 'Rep. Takayama will schedule a hearing on SB2175 (HLT).', { answer: 'will_schedule', committee: a.code }); S.demoNotes.find(x => x.id === r.id).created_at = new Date(A.shiftWork(a.noticeOn, -1) + 'T09:00:00-10:00').toISOString();")
        ok(ev(pg, "const a = ask('SB2175'); return a.answer === 'will_schedule' && a.due === false && a.remindOn === a.noticeOn;"), f'{tag} H6: a yes with no hearing yet is not due before the trigger day')
        shift(pg, 7); go(pg, FU); pg.wait_for_selector('#mailBtn')
        tx = pg.inner_text('.paper')
        ok('Rep. Takayama said yes, but no hearing is set yet.' in tx and 'Mahalo for letting me know you will schedule a hearing on SB 2175' in pg.input_value('#letter'), f'{tag} H6: at the trigger the same step says "said yes, but no hearing is set yet"')
        pg.click('#mailBtn'); pg.wait_for_selector('#yesBtn'); pg.click('#yesBtn'); pg.wait_for_selector('.done'); pg.wait_for_timeout(400)
        st = ev(pg, "const a = ask('SB2175'); return { ans: a.answer, body: a.chairs[0].row.body, due: a.due, line: A.waitLine(a) };")
        ok(st['ans'] == 'will_schedule' and st['body'].startswith('Followed up') and st['due'] is False and 'followed up today' in st['line'], f'{tag} H6: the follow-up leaves the yes a yes and the step goes ({st})')
        ok(not errs and not bad, f'{tag} H6: no page or console errors ({errs[:1]})')
        pg.context.close()

        # H7 Said no: Decide what next, its choices, the vice chair, leave it
        pg, errs, bad = open_as(br, 'KV', w, h); k = key(pg); H = '#/ask/' + enc(pg, k); DC = '#/do/dc-' + enc(pg, k); go(pg, H)
        pg.click('#opts [data-ans=said_no]'); pg.wait_for_selector('#opts [data-act]'); pg.wait_for_timeout(500)
        ch = pg.locator('#opts .cch').all_inner_texts()
        ok(pg.evaluate(H1) == 'The chair said no' and 'Needs a hearing by' in pg.inner_text('.strip') and 'What next?' in pg.inner_text('.stmain'), f'{tag} H7: a no is the step "The chair said no" with the clock box and "What next?"')
        ok([c.split('\n')[0] for c in ch] == ['Ask the vice chair, Rep. Keohokapu-Lee Loy', 'Ask partners and the public', 'Leave it for now'] and ch[0].split('\n')[1] == 'Opens a written email for you to send' and ch[1].split('\n')[1] == 'Opens public mode for this bill' and ch[2].split('\n')[1].startswith('The bill stays on your list. You still hear if it is at risk or does not advance.'), f'{tag} H7: three choices, the companion left out because it has no hearing ahead ({ch})')
        ok(pg.locator('#seeMail').inner_text() == 'See the email you sent' and pg.evaluate(FILLED) == 0 and pg.evaluate(NOSIDE) and not pg.evaluate(SMALL), f'{tag} H7: See the email you sent; no filled button; no sideways scroll ({pg.evaluate(SMALL)})')
        ok(any('Decide what next' in x and 'SB 2175' in x for x in todo(pg)) and 'SB 2175' not in ' '.join(waiting(pg)) if not phone else True, f'{tag} H7: Home: Decide what next in To do, no waiting row "Rep. Takayama said no"')
        ok(toast_text(pg).startswith('Recorded: Rep. Takayama said no.') and pg.locator('#toastUndo').is_visible(), f'{tag} H7: the toast says so, with Undo ({toast_text(pg)!r})')
        snap(pg, 'H7_decide', tag)
        pg.click('#seeMail'); pg.wait_for_timeout(200); ok('@capitol.hawaii.gov' in pg.inner_text('#mailSee'), f'{tag} H7: See the email you sent opens it in place')
        # the companion shows only with a hearing ahead
        ev(pg, "const a = ask('SB2175'); a.b.companions = ['HB2121']; window.__staff7Render({ tick: true });"); pg.wait_for_timeout(250)
        ch = [c.split('\n')[0] for c in pg.locator('#opts .cch').all_inner_texts()]
        ok(ch[:2] == ['Ask the vice chair, Rep. Keohokapu-Lee Loy', 'Work on the companion, HB 2121'] and len(ch) == 4 and 'Has a hearing' in pg.locator('#opts .cch').nth(1).inner_text(), f'{tag} H7: a companion with a hearing ahead is offered ({ch})')
        ev(pg, "const a = ask('SB2175'); a.b.companions = ['HB2121']; S.hearings.filter(h => h.bill_id === bill('HB2121').id).forEach(h => { window.__hs = (window.__hs || []).concat([[h, h.status]]); h.status = 'cancelled'; }); window.__staff7Render({ tick: true });"); pg.wait_for_timeout(250)
        ok(len(pg.locator('#opts .cch').all()) == 3, f'{tag} H7: with no hearing ahead the companion is not offered')
        ev(pg, "for (const [h, s] of window.__hs) h.status = s; bill('SB2175').companions = []; window.__staff7Render({ tick: true });"); pg.wait_for_timeout(200)
        # Ask the vice chair: a written email; after Yes, sent it waits like any ask
        pg.click('#opts [data-act=vice]'); pg.wait_for_selector('#mailBtn'); pg.wait_for_timeout(300)
        ok(pg.evaluate(H1) == 'Ask the vice chair' and 'repkeohokapuleeloy@capitol.hawaii.gov' in pg.inner_text('.paper') and pg.input_value('#subj') == 'Request for help getting a hearing on SB 2175' and 'Aloha Rep. Keohokapu-Lee Loy,' in pg.input_value('#letter') and 'Rep. Takayama has said no' in pg.input_value('#letter'), f'{tag} H7: Ask the vice chair opens a written email to the vice chair ({pg.input_value("#subj")!r})')
        ok(pg.evaluate(FILLED) == 1 and pg.evaluate(NOSIDE), f'{tag} H7: the vice chair page has one filled button')
        snap(pg, 'H7_vice', tag)
        pg.click('#mailBtn'); pg.wait_for_selector('#yesBtn'); pg.click('#yesBtn'); pg.wait_for_selector('.done'); pg.wait_for_timeout(400)
        st = ev(pg, "const a = ask('SB2175'); return { ans: a.answer, who: a.chairs.map(c => c.who), no: a.saidNo, vice: a.chairs.map(c => c.vice), line: A.waitLine(a) };")
        ok(pg.evaluate(H1) == 'Asked the vice chair.' and st['who'] == ['Rep. Keohokapu-Lee Loy'] and st['vice'] == [True] and st['no'] is False and st['ans'] == 'asked' and 'Waiting on Rep. Keohokapu-Lee Loy · asked' in st['line'], f'{tag} H7: Yes, sent: a new ask row for the vice chair, and it waits like any ask ({st})')
        if not phone: ok(not [x for x in todo(pg) if 'SB 2175' in x] and 'Waiting on Rep. Keohokapu-Lee Loy' in row(pg, 'SB 2175'), f'{tag} H7: Home: the Decide step is gone, the vice chair is under Waiting ({row(pg, "SB 2175")!r})')
        pg.click('#undoBtn'); pg.wait_for_selector('#opts [data-act]'); pg.wait_for_timeout(300)
        ok(ev(pg, "return ask('SB2175').decide === true;") and pg.evaluate(H1) == 'The chair said no', f'{tag} H7: "I have not sent it yet" brings Decide what next back')
        # Leave it for now
        pg.click('#opts [data-act=leave]'); pg.wait_for_timeout(600)
        ok(not [x for x in todo(pg) if 'SB 2175' in x] and 'SB 2175' not in ' '.join(waiting(pg)) and toast_text(pg).startswith('Left for now.') and pg.locator('#toastUndo').is_visible(), f'{tag} H7: Leave it for now closes the step and says so, with Undo ({toast_text(pg)!r})')
        pg.click('#toastUndo'); pg.wait_for_timeout(500)
        ok(any('Decide what next' in x for x in todo(pg)), f'{tag} H7: Undo brings the step back')
        pg.click('a[href*="#/do/dc-"]') if not phone else go(pg, DC); pg.wait_for_selector('#opts [data-act]'); pg.click('#opts [data-act=public]'); pg.wait_for_timeout(600)
        ok(pg.evaluate("() => location.hash").startswith('#/public/SB2175') and ev(pg, "return ask('SB2175').decided === true;"), f'{tag} H7: Ask partners and the public opens public mode for this bill and closes the step')
        ev(pg, "A.setLeft(arg, { at: 1, via: 'leave' });", k); ok(ev(pg, "return ask('SB2175').decide === true;"), f'{tag} H7: a newer no than the one that was answered opens the step again')
        ok(not errs and not bad, f'{tag} H7: no page or console errors ({errs[:1]} {bad[:1]})')
        pg.context.close()

        # H8 it ends by itself: no click
        pg, errs, bad = open_as(br, 'KV', w, h, fresh=False); k = key(pg); FU = '#/do/fu-' + enc(pg, k)
        ok(any('Follow up with the chair' in x and 'SB 2175' in x for x in todo(pg)), f'{tag} H8: the follow-up step is open')
        ev(pg, "const a = ask('SB2175'); S.hearings.push({ id: 'h-end2', bill_id: a.b.id, committee: a.code, status: 'scheduled', scheduled_at: new Date(Date.now() + 5 * 864e5).toISOString(), room: null }); window.__staff7Render({ tick: true });"); pg.wait_for_timeout(400)
        ok(not fus(pg) and 'SB 2175' not in ' '.join(waiting(pg)), f'{tag} H8: a hearing set for that committee ends the follow-up step with no click')
        go(pg, FU); ok(pg.evaluate(H1).startswith('That step is done'), f'{tag} H8: its page says it is done ({pg.evaluate(H1)!r})')
        ev(pg, "S.hearings.splice(S.hearings.findIndex(h => h.id === 'h-end2'), 1); const a = ask('SB2175'); for (const c of a.chairs) await D.DB.addLegNote(c.lid, a.b.id, 'Rep. Takayama said no to a hearing on SB2175 (HLT).', { answer: 'said_no', committee: a.code }); window.__staff7Render({ tick: true });"); pg.wait_for_timeout(300)
        go(pg, '#/'); ok(any('Decide what next' in x for x in todo(pg)), f'{tag} H8: a no is the Decide step')
        ev(pg, "const a = ask('SB2175'); S.hearings.push({ id: 'h-end3', bill_id: a.b.id, committee: a.code, status: 'scheduled', scheduled_at: new Date(Date.now() + 5 * 864e5).toISOString(), room: null }); window.__staff7Render({ tick: true });"); pg.wait_for_timeout(300)
        ok(not any('Decide what next' in x and 'SB 2175' in x for x in todo(pg)), f'{tag} H8: a hearing set ends Decide what next with no click')
        ev(pg, "S.hearings.splice(S.hearings.findIndex(h => h.id === 'h-end3'), 1); window.__staff7Render({ tick: true });"); pg.wait_for_timeout(200)
        n_ = ev(pg, """const a = ask('SB2175'), st = M.stopOf(a.b);
          return { dl: A.endedBy(a.b, a.code, { ...st, deadline: { ...st.deadline, missed: true } }), moved: A.endedBy(a.b, a.code, { ...st, phase: 'floor' }) };""")
        ok(n_['dl'] == 'deadline' and n_['moved'] == 'moved', f'{tag} H8: the deadline passing, or the bill moving on, ends an ask ({n_})')
        ok(not errs and not bad, f'{tag} H8: no page or console errors ({errs[:1]})')
        pg.context.close()

        # H9 the receiver is turned off: the ask goes back to the asker, then to the bill's lead
        pg, errs, bad = open_as(br, 'KV', w, h); k = key(pg)
        ev(pg, "A.setHold(arg, { to: adv('KR').id, by: S.me.id, at: Date.now() });", k)
        ok(ev(pg, "return ask('SB2175').holder === adv('KR').id;"), f'{tag} H9: Kris holds the ask')
        ev(pg, "adv('KR').is_active = false;"); ok(ev(pg, "return ask('SB2175').holder === adv('KV').id;"), f'{tag} H9: Kris is turned off: the ask goes back to Kevin, who asked')
        ev(pg, "adv('KV').is_active = false;"); st = ev(pg, "const a = ask('SB2175'), lead = (S.assignments[a.b.id] || []).find(id => S.advocates.find(x => x.id === id)?.is_active !== false); return { holder: a.holder, lead, kv: adv('KV').id, ok: S.advocates.find(x => x.id === a.holder)?.is_active !== false };")
        ok(st['holder'] != st['kv'] and st['ok'] and (st['lead'] is None or st['holder'] == st['lead']), f'{tag} H9: the asker is off too: it goes to a person who leads the bill, never to someone turned off ({st})')
        ev(pg, "adv('KV').is_active = true; adv('KR').is_active = true;")
        ok(not errs and not bad, f'{tag} H9: no page or console errors ({errs[:1]})')
        pg.context.close()

    ok(all(res), f'{len(res)} checks')
    br.close()
print(f'{sum(res)}/{len(res)} passed'); sys.exit(0 if all(res) else 1)
