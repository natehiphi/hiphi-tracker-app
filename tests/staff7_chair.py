# Staff7's chair ask, part 1 (R-398 piece 5), on the practice copy: the clock maths (3 working days, weekends skipped, the announce-within-2 trigger), each reply (will schedule, said no, no answer yet restarts the
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

def open_as(br, who, w, h, hash='', ctx=None):
    ctx = ctx or br.new_context(viewport={'width': w, 'height': h}); pg = ctx.new_page(); errs = []; bad = []
    def block(route):
        u = route.request.url
        if 'fonts.g' in u: return route.continue_()
        bad.append(u); route.abort()
    ctx.route(lambda u: '127.0.0.1' not in u and 'localhost' not in u, block)
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'Failed to load resource' not in m.text and 'ERR_FAILED' not in m.text else None)
    pg.goto(f'{BASE}/staff7.html?demo=1&as={who}{hash}'); pg.wait_for_selector('.paper', timeout=60000)
    pg.evaluate("Promise.all([document.fonts.load('600 16px Poppins'), document.fonts.load('400 16px Lato'), document.fonts.load('700 16px Lato')])"); pg.wait_for_timeout(400)
    return pg, errs, bad
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

    for (w, h) in ((1440, 900), (390, 844)):
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
        ok([o.split('\n')[0] for o in opts] == ['Will schedule', 'Said no', 'No answer yet'] and 'remind you again in 3 working days' in opts[2], f'{tag} B2: three answers in the words of the drawing ({opts})')
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
        ok('said no' in pg.inner_text('.stmain') and pg.evaluate(H1) == 'Did the chair reply?', f'{tag} C2: the sheet shows what was recorded and who recorded it ({pg.locator(".cans").first.inner_text()!r})')
        pg.click('#toastUndo'); pg.wait_for_timeout(500)
        ok(ev(pg, "return ask('SB2175').saidNo;") is False, f'{tag} C2: Undo takes it back')
        # C3 no answer yet restarts the clock
        pg.click('#opts [data-ans=left_message]'); pg.wait_for_timeout(500)
        st = ev(pg, "const a = ask('SB2175'); return { ans: a.answer, clockDay: a.clockDay, today: A.ymd(Date.now()), clockOn: a.clockOn, want: A.shiftWork(A.ymd(Date.now()), 3), due: a.due, noticeOn: a.noticeOn };")
        ok(st['ans'] == 'left_message' and st['clockDay'] == st['today'] and st['clockOn'] == st['want'] and st['due'] == (bool(st['noticeOn']) and st['today'] >= st['noticeOn']), f'{tag} C3: No answer yet saves left_message and restarts the 3-day clock from today ({st})')
        ok(toast_text(pg).startswith('Saved. We remind you again on '), f'{tag} C3: the toast says when we remind you ({toast_text(pg)!r})')
        ok('left a message' in row(pg, 'SB 2175') if not phone else True, f'{tag} C3: Home says a message was left')
        pg.click('#toastUndo'); pg.wait_for_timeout(500)
        ok(ev(pg, "const a = ask('SB2175'); return a.answer === 'asked' && a.due === true;"), f'{tag} C3: Undo puts back the first ask and its overdue clock')
        ok(not errs and not bad, f'{tag} C: no page or console errors, nothing outside the app ({errs[:1]} {bad[:1]})')
        pg.context.close()

        # ================= D. two chairs =================
        pg, errs, bad = open_as(br, 'KV', w, h); k2 = key(pg, 'HB756'); H2 = '#/ask/' + pg.evaluate("(k) => encodeURIComponent(k)", k2); go(pg, H2)
        ok(pg.locator('#whoH').inner_text() == 'Who replied?' and pg.locator('input[name=chairpick]').count() == 2 and 'both committees' in pg.locator('.stmain .lead').inner_text(), f'{tag} D1: two chairs: "Who replied?", a choice of one ({pg.locator(".stmain .lead").inner_text()!r})')
        ok(pg.locator('#didH').inner_text().startswith('Did Sen. Keohokalole reply?'), f'{tag} D1: the answers are for the chair chosen ({pg.locator("#didH").inner_text()!r})')
        snap(pg, 'D1_pick', tag)
        pg.locator('label.cr', has_text='San Buenaventura').click(); pg.wait_for_timeout(300)
        ok(pg.locator('#didH').inner_text().startswith('Did Sen. San Buenaventura reply?'), f'{tag} D1: choosing the other chair changes the question')
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

    ok(all(res), f'{len(res)} checks')
    br.close()
print(f'{sum(res)}/{len(res)} passed'); sys.exit(0 if all(res) else 1)
