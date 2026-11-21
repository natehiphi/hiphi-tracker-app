# Staff7's My alerts (R-398 piece 8), on the practice copy: the initials door and its menu (keyboard and mouse), the phone's circle, the page at three
# widths, saving every pick (the prefs written match the rule), Undo, a failed save, the test's states, the email-off notes, the kinds fold (mixed both ways),
# the deadline times, a person who leads no bill, admin notices, and the whole-team line.
#   python3 tests/staff7_alerts.py [base] [shots folder]     base defaults to http://127.0.0.1:8856
import sys, os, re, json
from playwright.sync_api import sync_playwright
BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8856').rstrip('/')
SHOTS = sys.argv[2] if len(sys.argv) > 2 else ''
if SHOTS: os.makedirs(SHOTS, exist_ok=True)
res = []
def ok(c, m): res.append(bool(c)); print('PASS' if c else 'FAIL', m, flush=True)

def external_blocker(ctx, bad):
    def h(route):
        u = route.request.url
        if 'fonts.g' in u: return route.continue_()
        bad.append(u); route.abort()
    ctx.route(lambda u: '127.0.0.1' not in u and 'localhost' not in u, h)

def open_as(br, who, w=1440, h=900, hash='#/me/alerts', extra=''):
    ctx = br.new_context(viewport={'width': w, 'height': h}); bad = []; external_blocker(ctx, bad); pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'Failed to load resource' not in m.text and 'ERR_FAILED' not in m.text else None)
    pg.goto(f'{BASE}/staff7.html?demo=1&as={who}{extra}{hash}'); pg.wait_for_selector('.paper', timeout=60000)
    pg.evaluate("Promise.all([document.fonts.load('600 16px Poppins'), document.fonts.load('400 16px Lato'), document.fonts.load('700 16px Lato'), document.fonts.load('500 16px Poppins')])"); pg.wait_for_timeout(500)
    return pg, errs, bad
def snap(pg, name):
    if SHOTS: pg.screenshot(path=os.path.join(SHOTS, name + '.png'))
def state(pg): return pg.evaluate("window.__alerts7.state()")
def redraw(pg): pg.evaluate("window.__staff7Render({})"); pg.wait_for_timeout(250)
def toast(pg): return pg.evaluate("() => { const t = document.getElementById('toast'); return t.classList.contains('on') ? t.querySelector('#toastMsg').innerText : '' }")
def undo_shown(pg): return pg.evaluate("() => !document.getElementById('toastUndo').hidden")
def picked(pg): return pg.evaluate("() => document.querySelector('input[name=alWhere]:checked')?.value || ''")
def text(pg, sel='#alRoot'): return pg.locator(sel).inner_text()
def noside(pg): return pg.evaluate("() => document.documentElement.scrollWidth <= innerWidth")
def pick(pg, v): pg.locator(f'input[name=alWhere][value="{v}"]').click(); pg.wait_for_timeout(300)   # click, not check(): a refused save puts the radio back, and check() would try again
def route_of(st): return st['prefs'].get('route', {})
# what the rule writes for a pick, read from the page's own module (the same rule as staff6/me.js prefsFor), for the person as they are NOW
EXPECT = """async (want) => { const D = await import('/staff7/me_alerts_data.js'); const d = await import('/staff6/data.js'); const me = d.S.me;
  const r = D.prefsFor(me, D.routeFor(me, want)); return JSON.parse(JSON.stringify({ slack_dm: r.slack_dm, prefs: r.prefs })); }"""

with sync_playwright() as p:
    br = p.chromium.launch()
    # ---- 1. the door and its menu, by keyboard and mouse ----
    pg, errs, bad = open_as(br, 'KV', hash='#/')
    door = pg.locator('#meDoor')
    ok(door.count() == 1 and door.get_attribute('aria-haspopup') == 'menu' and door.get_attribute('aria-expanded') == 'false' and 'Kevin' in door.inner_text() and 'Practice' in door.inner_text(), '1 door: the rail initials are a button with the first name and Practice under it')
    ok(pg.evaluate("() => { const r = document.getElementById('meDoor').getBoundingClientRect(); return r.width >= 44 && r.height >= 44 }"), '1 door: at least 44px')
    door.focus(); pg.keyboard.press('Enter'); pg.wait_for_timeout(200)
    m = pg.locator('#meMenu')
    ok(m.is_visible() and m.get_attribute('role') == 'menu' and door.get_attribute('aria-expanded') == 'true' and pg.locator('#meMenu [role=menuitem]').count() == 2, '1 menu: Enter opens a menu with two items')
    ok('Kevin' in text(pg, '#meMenu') and 'My alerts' in text(pg, '#meMenu') and 'Sign out' in text(pg, '#meMenu') and 'Not in the practice copy' in text(pg, '#meMenu') and pg.locator('#meMenu [aria-disabled=true]').count() == 1, '1 menu: name, My alerts, Sign out disabled with "Not in the practice copy"')
    ok(pg.evaluate("document.activeElement.textContent").startswith('My alerts') or 'My alerts' in pg.evaluate("document.activeElement.textContent"), '1 menu: focus lands on My alerts')
    pg.keyboard.press('ArrowDown'); a1 = pg.evaluate("document.activeElement.textContent"); pg.keyboard.press('ArrowDown'); a2 = pg.evaluate("document.activeElement.textContent"); pg.keyboard.press('ArrowUp'); a3 = pg.evaluate("document.activeElement.textContent")
    ok('Sign out' in a1 and 'My alerts' in a2 and 'Sign out' in a3, '1 menu: arrow keys move between the items and wrap')
    pg.keyboard.press('Escape'); pg.wait_for_timeout(150)
    ok(not m.is_visible() and pg.evaluate("document.activeElement.id") == 'meDoor' and '#/me' not in pg.url, '1 menu: Escape closes it and gives the circle the focus, and leaves the page where it is')
    door.click(); pg.wait_for_timeout(150); pg.mouse.click(900, 600); pg.wait_for_timeout(150)
    ok(not m.is_visible() and pg.evaluate("document.activeElement.id") == 'meDoor', '1 menu: a click outside closes it and the circle gets the focus')
    door.click(); pg.wait_for_timeout(150); door.click(); pg.wait_for_timeout(150)
    ok(not m.is_visible(), '1 menu: the circle again closes it')
    door.click(); pg.wait_for_timeout(150); pg.locator('#meMenu a').click(); pg.wait_for_timeout(500)
    ok(pg.url.endswith('#/me/alerts') and not m.is_visible() and pg.locator('main h1').first.inner_text() == 'My alerts', '1 menu: My alerts opens the page and the menu goes')
    ok(pg.locator('#meDoor').get_attribute('aria-current') == 'page' and pg.locator('.bar a[aria-current]').count() == 0, '2 page: no rail door is lit, the initials are ringed')
    ok(pg.locator('#tbBack').inner_text().strip().endswith('Back to Home') and pg.locator('#tbClose').count() == 1 and pg.locator('#tbBack').count() == 1, '2 page: the one top row has Back to Home and Close, and no second Back')
    pg.keyboard.press('Escape'); pg.wait_for_timeout(400)
    ok(pg.url.endswith('/staff7.html?demo=1&as=KV#/') or pg.url.endswith('#/'), '2 page: Escape closes the page to Home')
    pg.goto(f'{BASE}/staff7.html?demo=1&as=KV#/me/alerts'); pg.wait_for_selector('#alRoot'); pg.locator('#tbClose').click(); pg.wait_for_timeout(400)
    ok(pg.url.endswith('#/'), '2 page: Close goes to Home')
    ok(not errs and not bad, f'1-2 no page errors, nothing external ({errs[:2]} {bad[:2]})')

    # ---- 1b. the phone's circle ----
    pg, errs, bad = open_as(br, 'KV', 390, 844, hash='#/')
    pd = pg.locator('#meDoorP')
    geo = pg.evaluate("() => { const c = document.getElementById('meDoorP').getBoundingClientRect(), d = document.querySelector('.ovdate').getBoundingClientRect(); return { w: c.width, h: c.height, overlap: !(c.right <= d.left || c.left >= d.right || c.bottom <= d.top || c.top >= d.bottom), top: c.top, right: innerWidth - c.right } }")
    ok(pd.is_visible() and geo['w'] == 44 and geo['h'] == 44 and not geo['overlap'] and geo['right'] <= 48 and not pg.locator('#meDoor').is_visible(), f'1 phone: a 44px circle at the top right of Home that does not overlap the date line {geo}')
    pd.click(); pg.wait_for_timeout(200); snap(pg, 'alerts_390_door')
    mb = pg.evaluate("() => { const r = document.getElementById('meMenu').getBoundingClientRect(); return [r.left >= 0, r.right <= innerWidth, r.top >= 0] }")
    ok(pg.locator('#meMenu').is_visible() and all(mb) and noside(pg), '1 phone: the circle opens the same menu inside the screen')
    pg.keyboard.press('Escape'); ok(pg.evaluate("document.activeElement.id") == 'meDoorP' and not pg.locator('#meMenu').is_visible(), '1 phone: Escape closes and returns focus to the circle')
    pg.locator('#meDoorP').click(); pg.locator('#meMenu a').click(); pg.wait_for_timeout(500)
    ok(pg.url.endswith('#/me/alerts') and pg.locator('.bar').is_visible(), '2 phone: My alerts opens with the bottom bar')
    ok(not errs and not bad, f'1 phone no page errors ({errs[:2]})')

    # ---- 2. the page at 1440, 1280 and 390 ----
    for w, h in ((1440, 900), (1280, 800), (390, 844)):
        pg, errs, bad = open_as(br, 'KV', w, h)
        ok(noside(pg) and not errs and not bad and pg.locator('main h1').count() >= 1, f'2 {w}: no sideways scroll, no page errors')
        small = pg.evaluate("() => [...document.querySelectorAll('#alRoot .btn, #alRoot .alrad, #alRoot .alfb, #alRoot .alsw, #alRoot .alck, #alRoot .alin')].filter(e => e.getBoundingClientRect().width > 0 && (e.getBoundingClientRect().height < 43.5)).map(e => e.className)")
        ok(not small, f'2 {w}: every control is 44px ({small})')
        if w == 1440: snap(pg, 'alerts_page')
        if w == 390: snap(pg, 'alerts_390')
        pg.close()
    pg, errs, bad = open_as(br, 'KV')
    t = text(pg)
    ok('Choose where the tracker’s alerts reach you, then send yourself a test. Every step also stays on Home.' in t and 'Where should alerts reach you?' in t and 'Saves as soon as you pick.' in t, '2 page: band words and the question')
    ok(pg.locator('input[name=alWhere]').count() == 3 and [l.strip() for l in pg.locator('.alrt').all_inner_texts()] == ['Slack', 'Email', 'Both'] and picked(pg) == 'slack', '2 page: three radio rows, Slack picked for a person who never chose')
    ok('Slack: your account is linked. Email goes to kevin@example.com.' in t, '2 page: the reach line')
    ok(pg.locator('.btn.filled:visible').count() == 1 and 'Send me a test message' in text(pg, '#alTest'), '4 page: one filled button, "Send me a test message"')
    ok('The same for the whole team' in t and 'Whatever you pick, the morning list of hearings goes to #hearing-alerts-2027 in Slack for everyone.' in t, '8 the whole team line, with the channel name from the settings')
    pg.evaluate("window.__alerts7.setSlackLinked(false)"); redraw(pg)
    ok('Slack: the tracker finds you by your email the first time it messages you. Send a test to check. Email goes to kevin@example.com.' in text(pg), '2 page: the reach line when Slack has no match')
    snap(pg, 'alerts_slack_unlinked'); pg.evaluate("window.__alerts7.setSlackLinked(true)"); redraw(pg)

    # ---- 3. saving each pick, the prefs written, Undo ----
    pg.evaluate("window.__alerts7.setPrefs(null, { coalitions: 'all', palette: 'x', reminders: { morning: '07:15', morning_on: true } })")
    redraw(pg)
    for v, name in (('slack,email', 'Slack and email'), ('email', 'email'), ('slack', 'Slack')):
        want = pg.evaluate(EXPECT, v.split(',')); pick(pg, v); st = state(pg)
        ok(st == want and picked(pg) == v, f'3 pick {v}: the prefs written equal the rule ({v})')
        ok(toast(pg) == f'Saved. Alerts reach you by {name}.' and undo_shown(pg), f'3 pick {v}: toast "{toast(pg)}" with Undo')
        if v == 'slack,email': snap(pg, 'alerts_saved')
    st = state(pg)
    ok(st['prefs'].get('coalitions') == 'all' and st['prefs'].get('palette') == 'x' and st['prefs']['reminders']['morning'] == '07:15', '3 saving merges into the latest prefs: other keys and times are kept')
    ok(st['slack_dm'] is True and all(st['prefs']['workflow'][k] for k in ('review_requested', 'chat', 'todo', 'hearing', 'issue', 'draft_moved')), '3 Slack: slack_dm and workflow.* are in step')
    pick(pg, 'email'); st = state(pg)
    ok(st['slack_dm'] is True and route_of(st)['deadlines'] == ['email'], '3 Email: slack_dm stays on while deadline alerts have a place (the reminders are queued for slack_dm, then routed to email)')
    before = state(pg)
    pick(pg, 'slack,email'); pg.locator('#toastUndo').click(); pg.wait_for_timeout(300)
    ok(state(pg) == before and picked(pg) == 'email', '3 Undo puts back the exact previous prefs and the radio')
    ok(toast(pg) == 'Undone.' and not undo_shown(pg), '3 one toast at a time: Undo says "Undone."')
    pg.evaluate("window.__alerts7.setPrefs(null, {})"); redraw(pg)
    ok(pg.evaluate("window.__alerts7.state().prefs.route") is None and picked(pg) == 'slack', '3 a person who never picked has no route written until they pick')
    pg.evaluate("window.__alerts7.setPrefs(null, {})"); redraw(pg)
    # failed save
    pg.evaluate("window.__alerts7.failSaves(1)"); pick(pg, 'email'); pg.wait_for_timeout(200)
    ok(picked(pg) == 'slack' and state(pg)['prefs'].get('route') is None, '3 a failed save puts the radio back and writes nothing')
    ok('Not saved, so alerts still go to Slack. Pick again. If it fails twice, message Nate.' in text(pg) and pg.locator('.alline.err[role=alert] svg').count() == 1, '3 the failed save says so beside the radios with an icon')
    ink = pg.evaluate("() => getComputedStyle(document.querySelector('.alline.err > span')).color")
    ok(ink == 'rgb(28, 25, 21)', f'3 the error text is ink, not red ({ink})'); snap(pg, 'alerts_error')
    pick(pg, 'email'); ok(picked(pg) == 'email' and 'Not saved' not in text(pg), '3 picking again saves and clears the error')

    # ---- 5. email off / on ----
    pg.evaluate("window.__alerts7.setPrefs(null, {})"); redraw(pg)
    t = text(pg)
    ok('Email to the team is not turned on yet. Until Nate turns it on, these alerts reach you by Slack only.' in t and 'email-only alerts are held and do not reach you. Pick Both to get them by Slack meanwhile.' in t, '5 email off: the Both row and the Email row carry their own notes')
    snap(pg, 'alerts_email_off')
    pg.evaluate("window.__alerts7.setTeamEmail(true)"); redraw(pg)
    ok('Email to the team is not turned on yet' not in text(pg), '5 email on: no notes')
    pg.evaluate("window.__alerts7.setTeamEmail(false)"); redraw(pg)

    # ---- 4. the test ----
    pg.locator('#alTest').click(); pg.wait_for_timeout(300)
    ok(pg.locator('#alTest').count() == 0 and 'Practice copy: a test would be on its way to Slack. Nothing is sent.' in text(pg, '#alBox') and pg.locator('#alAgain').inner_text().strip() == 'Send another', '4 practice: info box and "Send another"')
    snap(pg, 'alerts_test_practice')
    pg.evaluate("window.__alerts7.liveWords(true)"); pg.locator('#alAgain').click(); pg.wait_for_timeout(300)
    ok('Test on its way to Slack. It comes from HIPHI Bill Tracker. If it has not arrived in a minute, message Nate in Slack.' in text(pg, '#alBox') and pg.locator('#alBox.ok').count() == 1, '4 sent: the drawn words with a check'); snap(pg, 'alerts_test_sent')
    pick(pg, 'email'); ok(pg.locator('#alBox').count() == 0 and pg.locator('#alTest').count() == 1, '4 a new pick clears the old test box')
    pg.locator('#alTest').click(); pg.wait_for_timeout(300)
    ok('Your choice is saved. The test email was held, because email to the team is not turned on yet. Until Nate turns it on, email-only alerts do not reach you.' in text(pg, '#alBox') and pg.locator('#alAgain').inner_text().strip() == 'Send a test to Slack', '4 held: email picked, team email off: the held box with "Send a test to Slack"'); snap(pg, 'alerts_email_held')
    pg.locator('#alAgain').click(); pg.wait_for_timeout(300)
    ok('Test on its way to Slack.' in text(pg, '#alBox') and 'held' not in text(pg, '#alBox'), '4 held: "Send a test to Slack" sends to Slack')
    pick(pg, 'slack,email'); pg.locator('#alTest').click(); pg.wait_for_timeout(300)
    ok('Test on its way to Slack. The test email was held: email to the team is not turned on yet.' in text(pg, '#alBox'), '4 both held: Slack on its way, the email held'); snap(pg, 'alerts_test_both_held')
    pg.evaluate("window.__alerts7.liveWords(false)"); pg.locator('#alAgain').click(); pg.wait_for_timeout(300)
    ok('Practice copy: a test would be on its way to Slack.' in text(pg, '#alBox') and 'The test email was held' in text(pg, '#alBox') and 'Nothing is sent.' in text(pg, '#alBox'), '4 both held in the practice copy says nothing is sent')
    pg.evaluate("window.__alerts7.setTeamEmail(true)"); pg.locator('#alAgain').click(); pg.wait_for_timeout(300)
    ok('Slack and email' in text(pg, '#alBox') and 'held' not in text(pg, '#alBox'), '4 both, team email on: to Slack and email')
    # busy while sending
    busy = pg.evaluate("""async () => { const D = await import('/staff6/data.js'); const orig = D.DB.alertTest; let b = null; D.DB.alertTest = async p => { await new Promise(r => setTimeout(r, 300)); return 'queued'; };
      document.getElementById('alAgain').click(); await new Promise(r => setTimeout(r, 80)); b = document.getElementById('alAgain').getAttribute('aria-busy'); await new Promise(r => setTimeout(r, 500)); D.DB.alertTest = orig; return b; }""")
    ok(busy == 'true', '4 the button is busy while sending')
    # all cleared
    pg.evaluate("window.__alerts7.setPrefs(false, { route: { review_requested: [], second_review_requested: [], draft_created: [], approved: [], changes_requested: [], filed: [], deadlines: [], hearings: [], chat: [], given: [], standin: [], admin: [] } })"); redraw(pg)
    ok(picked(pg) == '' and 'Different for each kind' not in text(pg) and 'No place is picked. Alerts will sit on Home until you open the tracker.' in text(pg), '4 every box cleared: no radio filled, not called "different", and says so')
    pg.locator('#alAgain').click(); pg.wait_for_timeout(300)
    ok('No place is picked, so the test goes to Slack.' in text(pg, '#alBox'), '4 every box cleared: the button stays and the box says the test goes to Slack')
    pg.evaluate("window.__alerts7.setTeamEmail(false)")

    # ---- 6. the kinds fold ----
    pg.evaluate("window.__alerts7.setPrefs(null, {})"); redraw(pg)
    k = pg.locator('#alKindsB')
    ok(k.get_attribute('aria-expanded') == 'false' and not pg.locator('#alKinds').is_visible(), '6 the fold is closed by default')
    k.click(); pg.wait_for_timeout(200)
    rows = pg.locator('#alKinds tbody tr').all_inner_texts()
    ok(len(rows) == 6 and all(x in ' '.join(rows) for x in ('Testimony approvals', 'Testimony deadlines', 'Hearings on your bills', 'Questions and notes from teammates', 'Handed to you', 'Standing in for a teammate')) and 'Admin notices' not in ' '.join(rows), '6 open: six kinds for a lead who is no admin, with the drawn second lines')
    ok('Drafts waiting for your approval, approvals, testimony sent back, testimony filed' in ' '.join(rows) and 'Bills you lead, until the testimony is filed' in ' '.join(rows), '6 second lines as drawn')
    ok(pg.locator('#alKinds input:checked').count() == 6 and pg.locator('#alKinds input[data-p=email]:checked').count() == 0, '6 a Slack pick shows in the boxes'); snap(pg, 'alerts_kinds_slack')
    pg.locator('#alC-hearings-email').check(); pg.wait_for_timeout(300)
    st = state(pg)
    ok(route_of(st)['hearings'] == ['slack', 'email'] and route_of(st)['chat'] == ['slack'] and toast(pg) == 'Saved. Hearings on your bills: by Slack and email.' and undo_shown(pg), '6 a box saves one kind and says so with Undo')
    ok(picked(pg) == '' and pg.locator('#alKinds').is_visible() and 'Different for each kind, set below. Picking Slack, Email or Both sets every kind to it.' in text(pg), '6 mixed: no radio filled, the fold stays open, the line says so'); snap(pg, 'alerts_kinds_mixed')
    mixed_before = state(pg)
    pick(pg, 'slack'); ok(toast(pg) == 'Saved. Every kind now goes to Slack.' and pg.locator('#alKinds input[data-p=email]:checked').count() == 0 and pg.locator('#alKinds').is_visible(), '6 mixed to Slack: toast, the boxes follow, the fold stays open'); snap(pg, 'alerts_mixed_to_slack')
    pg.locator('#toastUndo').click(); pg.wait_for_timeout(300)
    ok(state(pg) == mixed_before and picked(pg) == '' and pg.locator('#alC-hearings-email').is_checked(), '6 Undo brings the mix back')
    # a fresh page: closed folds open themselves when mixed
    pg.close(); pg, errs, bad = open_as(br, 'KV')
    pg.evaluate("window.__alerts7.setPrefs(null, { route: { hearings: ['email'] } })"); pg.evaluate("window.__staff7TrailReset()"); redraw(pg)
    ok(pg.locator('#alKinds').is_visible() and picked(pg) == '', '6 the fold opens by itself when the kinds differ')
    # cleared row
    pg.locator('#alC-approvals-slack').uncheck(); pg.wait_for_timeout(250)
    ok('Testimony waiting for your approval will sit on Home until you open the tracker.' in text(pg, '#alKinds') and toast(pg) == 'Saved. Testimony approvals: on Home only.', '6 a row with both boxes cleared: the muted line (testimony wording) and a toast')
    pg.locator('#alC-hearings-email').uncheck(); pg.locator('#alC-hearings-slack').uncheck(); pg.wait_for_timeout(250)
    ok('These will sit on Home until you open the tracker.' in text(pg, '#alKinds'), '6 other cleared rows: the generic line')
    pg.evaluate("window.__alerts7.setPrefs(null, { route: { hearings: ['email'] } })"); redraw(pg)
    ok('email-only alerts are held' in text(pg, '#alKinds tbody tr:nth-child(3)'), '5 a row with only Email ticked gets the muted held line while team email is off')
    # hidden rows keep their value
    pg.evaluate("window.__alerts7.setPrefs(null, { route: { admin: ['email'], deadlines: ['slack'] } })"); redraw(pg)
    pick(pg, 'slack,email'); st = state(pg)
    ok(route_of(st)['admin'] == ['email'], '6 a hidden row (Admin notices for a non-admin) keeps its saved value')
    pg.close()

    # ---- 7. deadline times ----
    pg, errs, bad = open_as(br, 'KV')
    tb = pg.locator('#alTimesB')
    ok(tb.get_attribute('aria-expanded') == 'false' and '8:35 AM on the day testimony is due · 1 hour before · 4:00 PM if it is not filed' in text(pg, '#alRoot'), '7 closed: the summary of the times')
    tb.click(); pg.wait_for_timeout(200)
    t = text(pg)
    ok('For bills you lead. Saves as soon as you change it. Other alerts arrive when the thing happens.' in t and all(x in t for x in ('The morning testimony is due', 'Shortly before it is due', 'After the deadline, if it is not filed')) and pg.locator('.alsw[role=switch]').count() == 3 and pg.locator('.alsw[aria-checked=true]').count() == 3, '7 open: the hint and three switches on'); snap(pg, 'alerts_times')
    ok('hour before' in t and 'Use the team’s times' not in t, '7 "hour before" for 1, and no team link while the times are the team\'s')
    pg.locator('#alMorning').fill('07:30'); pg.locator('#alMorning').blur(); pg.wait_for_timeout(300)
    ok(state(pg)['prefs']['reminders']['morning'] == '07:30' and toast(pg) == 'Saved. Morning alert at 7:30 AM.' and undo_shown(pg), '7 a time change saves with a toast and Undo')
    ok('Use the team’s times' in text(pg), '7 the team link shows once the times differ')
    pg.locator('#alS-after').click(); pg.wait_for_timeout(300)
    ok(pg.locator('#alAfter').is_disabled() and state(pg)['prefs']['reminders']['after_on'] is False and 'Saved.' in toast(pg), '7 a switch off greys its field and saves'); snap(pg, 'alerts_times_changed')
    ok(pg.evaluate("document.getElementById('alS-after').getAttribute('aria-checked')") == 'false', '7 switch state is aria-checked')
    pg.locator('#toastUndo').click(); pg.wait_for_timeout(300)
    ok(state(pg)['prefs']['reminders']['after_on'] is True and pg.locator('#alS-after').get_attribute('aria-checked') == 'true', '7 Undo of a switch')
    for bad_v in ('60', '0.2', ''):
        pg.locator('#alHours').fill(bad_v); pg.locator('#alHours').blur(); pg.wait_for_timeout(250)
        ok('Use a number of hours from 0.5 to 48.' in text(pg) and pg.locator('#alHours').input_value() == bad_v and state(pg)['prefs']['reminders']['hours_before'] == 1, f'7 hours "{bad_v}": the reason beside the field, the typed words stay, nothing saved')
    pg.locator('#alHours').fill('60'); pg.locator('#alHours').blur(); pg.wait_for_timeout(250); snap(pg, 'alerts_times_error')
    ok(pg.locator('#alHoursErr svg').count() == 1 and pg.locator('#alHours').get_attribute('aria-invalid') == 'true', '7 the error has an icon and aria-invalid')
    pg.locator('#alHours').fill('0.5'); pg.locator('#alHours').blur(); pg.wait_for_timeout(300)
    ok(state(pg)['prefs']['reminders']['hours_before'] == 0.5 and 'Use a number of hours' not in text(pg) and toast(pg) == 'Saved. Alert 0.5 hours before it is due.', '7 0.5 saves')
    pg.locator('#alHours').fill('48'); pg.locator('#alHours').blur(); pg.wait_for_timeout(300)
    ok(state(pg)['prefs']['reminders']['hours_before'] == 48, '7 48 saves')
    pg.locator('#alTeam').click(); pg.wait_for_timeout(300)
    r = state(pg)['prefs']['reminders']
    ok(r['morning'] == '08:35' and r['hours_before'] == 1 and r['after'] == '16:00' and pg.locator('#alTeam').count() == 0, '7 "Use the team\'s times" resets to the team and goes away')
    for k in ('morning', 'before', 'after'): pg.locator(f'#alS-{k}').click(); pg.wait_for_timeout(250)
    ok('No deadline alerts. Testimony due on your bills will show on Home only.' in text(pg) and pg.locator('.alsw[aria-checked=true]').count() == 0, '7 all off: the line says so'); snap(pg, 'alerts_times_off')
    pg.locator('#alTimesB').click(); ok('Off' in text(pg, '.alsum'), '7 closed with all off the row reads "Off"')
    pg.locator('#alTimesB').click()
    pg.locator('#alS-before').click(); pg.locator('#alS-after').click(); pg.wait_for_timeout(300); pg.locator('#alTimesB').click()
    ok('1 hour before · 4:00 PM if it is not filed' in text(pg, '.alsum') and 'on the day testimony' not in text(pg, '.alsum'), '7 a part off drops out of the summary')
    pg.evaluate("window.__alerts7.failSaves(1)"); pg.locator('#alTimesB').click(); pg.locator('#alS-morning').click(); pg.wait_for_timeout(300)
    ok('Not saved, so your deadline times are as they were.' in text(pg) and pg.locator('#alS-morning').get_attribute('aria-checked') == 'false', '7 a failed time save puts the switch back and says so')
    # a deadline-time change does not touch where alerts go
    pg.evaluate("window.__alerts7.setPrefs(true, { route: { deadlines: ['email'], hearings: ['email'] } })"); redraw(pg)
    pg.locator('#alAfter').fill('15:00'); pg.locator('#alAfter').blur(); pg.wait_for_timeout(300)
    st = state(pg); ok(route_of(st)['deadlines'] == ['email'] and st['slack_dm'] is True, '7 a time change keeps the route and slack_dm (an Email-only person still gets queued, then routed to email)')
    pg.close()

    # ---- hidden for a person who leads no bill; admin notices ----
    pg, errs, bad = open_as(br, 'JN')
    lead = pg.evaluate("async () => { const D = await import('/staff7/me_alerts_data.js'); return D.leadsBills((await import('/staff6/data.js')).S.me) }")
    pg.locator('#alKindsB').click()
    ok(not lead and pg.locator('#alTimesB').count() == 0 and 'When deadline alerts arrive' not in text(pg) and 'Testimony deadlines' not in text(pg, '#alKinds') and pg.locator('#alKinds tbody tr').count() == 5, '7 a person who leads no bill: no times section and no Testimony deadlines row')
    ok('Admin notices' not in text(pg), '6 Admin notices not shown to a non-admin')
    pg.close()
    pg, errs, bad = open_as(br, 'KR'); pg.locator('#alKindsB').click()
    ok('Admin notices' in text(pg, '#alKinds') and 'Bills close to their last chance for a hearing, public changes to approve' in text(pg, '#alKinds'), '6 Admin notices for an approver')
    pg.close()
    pg, errs, bad = open_as(br, 'NT'); pg.locator('#alKindsB').click()
    ok(pg.locator('#alKinds tbody tr').count() == 7 and 'Admin notices' in text(pg, '#alKinds'), '6 Admin notices for an admin (seven rows)')
    pg.evaluate("window.__alerts7.setPrefs(null, { route: { review_requested: [], second_review_requested: [], draft_created: [], approved: [], changes_requested: [], filed: [], deadlines: ['slack','email'], hearings: ['slack'], chat: ['email'], given: ['slack','email'], standin: ['slack'], admin: ['slack','email'] } })"); pg.evaluate("window.__staff7TrailReset()"); redraw(pg)
    snap(pg, 'alerts_kinds_mixed_full')
    ok(not errs and not bad, 'no page errors as Nate')
    pg.close()

    # ---- a failed save forced by the address, and the page by keyboard ----
    pg, errs, bad = open_as(br, 'KV', extra='&fail=save')
    pick(pg, 'email'); ok(picked(pg) == 'slack' and 'Not saved' in text(pg), '3 &fail=save forces a failed save on the practice copy')
    pg.close()
    pg, errs, bad = open_as(br, 'KV', 390, 844)
    pg.locator('#alKindsB').click(); pg.locator('#alTimesB').click(); pg.wait_for_timeout(200); snap(pg, 'alerts_390_times')
    ok(noside(pg) and not errs, '7 390: the opened folds fit with no sideways scroll')
    pg.close()
    br.close()
print(f'{sum(res)} passed, {len(res) - sum(res)} failed of {len(res)}')
sys.exit(0 if all(res) else 1)
