# R-299 (Nate 17 Oct): how much each followed issue sends, chosen after acting, never in the first visit. In the practice
# copy served locally:
#   I1  the issue page: "Alerts about this issue" for a followed issue when alerts can reach the person, a sliding switch of three
#       radio buttons with a line under it, Big moments only chosen; a tap on Every hearing saves it, says "Saved." and is
#       kept after a reload; arrow keys move through it; nothing without a number or email
#       (C-13), nothing for an issue not followed
#   P1  Profile > Alerts: one sliding switch per followed issue, under its name; a change waits in the save bar, Save keeps it, Cancel puts
#       it back; the text line no longer says "at most one a day"; signed in with an email, "Hearing emails" is there while
#       hearing emails are ticked and its choice is saved in prefs.email_level
#   T1  the thank-you after testimony: "Text me every hearing on <issue>?" with "Yes, every hearing"; the yes leaves one line with
#       Undo, which puts the level back
#   X1  the page a text's link opens (?via=text): "Texts about <issue>: Big moments only" with Change, which opens the three
#       levels; a tap there changes the line; nothing without ?via=text
#   S1  Staff v2 and v5: an email about a bill has "Big push: also text it", the text line shows once ticked with a live count,
#       a short line is refused, a big push on the same issue in the past 7 days is warned of; an email to a list has none
#   G1  the go-live switch: pub/alerts.js WORDS_T5 and text-terms.html's R-299 GO-LIVE block agree
#   python3 tests/r299_levels.py [base]     base defaults to http://localhost:8832/
import sys, re, os, json
from playwright.sync_api import sync_playwright
BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832/').rstrip('/') + '/'
if BASE.endswith('track.html/'): BASE = BASE[:-len('track.html/')]
PUB = BASE + 'track.html?demo=1'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
snap = json.load(open(os.path.join(ROOT, 'demo', 'snapshot.json')))
ISS = {i['slug']: i for i in snap['issues']}
BID = {b['bill_number']: b['id'] for b in snap['bills']}
NUM = 'HB1523'   # testimony open on the practice copy's day; its issue is "Let people cross during the countdown"
CROSS = ISS['cross-during-the-countdown']; ECIG = ISS['disposable-e-cigarette-ban']
res = []
def ok(c, m): res.append(bool(c)); print('PASS' if c else 'FAIL', m)
def ready(pg):
    pg.wait_for_function("() => !!document.querySelector('main') && !document.querySelector('.skelpage') && !document.querySelector('.bl-skel')", timeout=60000); pg.wait_for_timeout(700)
def setup(follows, text=True, levels=None):
    return f"""() => {{ localStorage.clear(); sessionStorage.clear();
      localStorage.setItem('hiphi_issue_follows', JSON.stringify({json.dumps(follows)}));
      localStorage.setItem('hiphi_wiz', JSON.stringify({{ step: 99, done: true, skipped: true }}));
      localStorage.setItem('hiphi_tour_bill', '{{"how":"test"}}'); localStorage.setItem('hiphi_tour_home', '{{"how":"test"}}');
      {"localStorage.setItem('hiphi_text', JSON.stringify({ token: 't-r299', phone: '8085550147', at: new Date().toISOString(), confirmed: true }));" if text else ''}
      {f"localStorage.setItem('hiphi_issue_levels', JSON.stringify({json.dumps(levels)}));" if levels else ''} }}"""
levels = lambda pg: pg.evaluate("async () => (await import('./pub/core.js')).S.levels")
pressed = lambda pg, sel='.lvl': pg.evaluate(f"[...document.querySelectorAll('{sel} [data-lvl]:checked')].map(r => r.closest('.lvl-o').querySelector('.lvl-n').innerText.trim())")
errs = []
with sync_playwright() as p:
    br = p.chromium.launch()
    def phone():
        c = br.new_context(viewport={'width': 375, 'height': 812}, is_mobile=True, has_touch=True); pg = c.new_page()
        pg.on('pageerror', lambda e: errs.append(str(e)[:200])); return c, pg
    # ---- I1: the issue page ----
    c, pg = phone()
    pg.goto(PUB + '#/'); ready(pg); pg.evaluate(setup([ECIG['id']]))
    pg.goto(PUB + f'#/issue/{ECIG["slug"]}'); pg.reload(); ready(pg); pg.wait_for_timeout(800)
    line = pg.locator('.fd-follow.on .lvl-line')
    ok(line.count() == 1 and 'Alerts: Big moments only' in line.inner_text() and pg.locator('.fd-follow.on .lvl').count() == 0, 'I1: a followed issue has one line, "Alerts: Big moments only · Change", in its follow card (A-1: no chips until asked)')
    act = pg.evaluate("document.querySelector('#fd-iact-h')?.getBoundingClientRect().top")
    ok(act is not None and act < 812, f'I1: "You can help this week" starts on the first phone screen ({act})')
    pg.locator('.fd-follow [data-lvl-toggle]').click(); pg.wait_for_timeout(500)
    box = pg.locator('.fd-follow.on .lvl')
    ok(box.count() == 1 and 'Alerts about this issue' in box.inner_text(), 'I1: Change opens "Alerts about this issue" in place')
    chips = pg.evaluate("[...document.querySelectorAll('.lvl .lvl-o')].map(o => o.querySelector('.lvl-n').innerText.trim())")
    ok(chips == ['Every hearing', 'Big moments only', 'App only'] and pressed(pg) == ['Big moments only'], f'I1: three levels, most to least, Big moments only chosen by default ({chips}, {pressed(pg)})')
    ok(pg.locator('.lvl [role="radiogroup"] input[type="radio"][data-lvl]').count() == 3 and pg.evaluate("new Set([...document.querySelectorAll('.lvl [data-lvl]')].map(r => r.name)).size") == 1, 'I1: one radio group of three real radio buttons (Nate 17 Oct: the sliding switch)')
    ok('Usually a few a month' in pg.locator('.lvl-hint').inner_text() and pg.evaluate("document.querySelector('.lvl [role=radiogroup]').getAttribute('aria-describedby')") == pg.evaluate("document.querySelector('.lvl-hint').id"), 'I1: the line under the switch says what Big moments only sends, and describes the group')
    pill = lambda: pg.evaluate("(() => { const p = document.querySelector('.lvl-pill').getBoundingClientRect(), o = document.querySelector('.lvl [data-lvl]:checked').closest('.lvl-o').getBoundingClientRect(); return Math.abs(p.left - o.left) < 3 && Math.abs(p.width - o.width) < 3; })()")
    ok(pill(), 'I1: the white pill sits under the chosen level')
    ok(all((b['height'] >= 44) for b in pg.evaluate("[...document.querySelectorAll('.lvl .lvl-o')].map(b => b.getBoundingClientRect().toJSON())")), 'I1: each row is at least 44px tall (A-6)')
    ok(pg.locator('.lvl button.chip').count() == 0, 'I1: no chips')
    pg.locator('.lvl .lvl-o:has([data-lvl="every"])').click(); pg.wait_for_timeout(600)
    ok(pressed(pg) == ['Every hearing'] and 'Saved.' in pg.locator('.lvl-hint').inner_text() and 'never more than one a day' in pg.locator('.lvl-hint').inner_text() and 'Alerts: Every hearing' in pg.locator('.fd-follow .lvl-line').inner_text(), 'I1: a tap on Every hearing chooses it, says "Saved." with what it sends, and the line says it')
    pg.wait_for_timeout(300); ok(pill(), 'I1: the pill has slid to Every hearing')
    ok(levels(pg).get(ECIG['id']) == 'every', 'I1: the level is kept (the sandbox keeps it in this browser)')
    ok(pg.evaluate("document.activeElement?.dataset?.lvl") == 'every', 'I1: the focus is on the level just chosen')
    pg.keyboard.press('ArrowDown'); pg.wait_for_timeout(250); pg.keyboard.press('ArrowDown'); pg.wait_for_timeout(900)
    ok(pressed(pg) == ['App only'] and levels(pg).get(ECIG['id']) == 'app' and 'Alerts: App only' in pg.locator('.fd-follow .lvl-line').inner_text() and 'Saved.' in pg.locator('.lvl-hint').inner_text() and 'stays in your app' in pg.locator('.lvl-hint').inner_text(), f'I1: arrow keys move through the levels, and the last one is kept ({pressed(pg)}, {levels(pg).get(ECIG["id"])})')
    pg.keyboard.press('ArrowUp'); pg.wait_for_timeout(250); pg.keyboard.press('ArrowUp'); pg.wait_for_timeout(900)
    ok(levels(pg).get(ECIG['id']) == 'every', 'I1: and back up to Every hearing')
    pg.reload(); ready(pg); pg.wait_for_timeout(800)
    ok('Alerts: Every hearing' in pg.locator('.fd-follow .lvl-line').inner_text(), 'I1: still Every hearing after a reload')
    pg.evaluate("() => localStorage.removeItem('hiphi_text')"); pg.reload(); ready(pg); pg.wait_for_timeout(800)
    ok(pg.locator('.fd-follow.on').count() == 1 and pg.locator('.lvl-line').count() == 0, 'I1: no number and no email: no level to choose (C-13)')
    pg.goto(PUB + f'#/issue/{CROSS["slug"]}'); ready(pg); pg.wait_for_timeout(800)
    ok(pg.locator('.lvl-line').count() == 0, 'I1: an issue not followed has no level')
    c.close()

    # ---- P1: Profile > Alerts ----
    c, pg = phone()
    pg.goto(PUB + '#/'); ready(pg); pg.evaluate(setup([ECIG['id'], CROSS['id']], levels={CROSS['id']: 'app'}))
    pg.goto(PUB + '#/profile'); pg.reload(); ready(pg); pg.wait_for_timeout(800)
    al = pg.locator('#pf-email').inner_text()
    ok('when your voice matters most' in al and 'at most one a day' not in al, f'P1: the text line says what texts are for, not "at most one a day" ({al[:90]!r})')
    rows = pg.evaluate("[...document.querySelectorAll('.pf-lvls .lvl-sw')].map(s => [document.getElementById(s.getAttribute('aria-labelledby')).innerText.trim(), s.querySelector('input:checked')?.value])")
    ok(sorted(rows) == sorted([[ECIG['name'], 'big'], [CROSS['name'], 'app']]) and pg.locator('.pf-lvls select').count() == 0, f'P1: one sliding switch per followed issue, under its name, with its level (Nate 17 Oct: "A switch for each issue") ({rows})')
    ok('Big moments only is usually a few a month' in pg.locator('.pf-lvls').inner_text() and 'Alerts for each issue' in pg.locator('.pf-lvls legend').inner_text(), 'P1: "Alerts for each issue", and one line says how often the usual level comes')
    pg.locator(f'label[for="pf-lv-{ECIG["id"]}-every"]').click(); pg.wait_for_timeout(400)
    ok(pg.evaluate(f"document.getElementById('pf-lv-{ECIG['id']}-every').closest('.lvl-sw').dataset.on") == 'every', 'P1: the pill moves to the level tapped')
    ok(pg.locator('.pf-bar [data-pf-save]').count() == 1 and levels(pg).get(ECIG['id']) is None, 'P1: a change waits in the save bar, not saved yet')
    pg.locator('[data-pf-cancel]').click(); pg.wait_for_timeout(500)
    ok(pg.locator(f'#pf-lv-{ECIG["id"]}-big').is_checked() and pg.locator('.pf-bar').count() == 0, 'P1: Cancel puts it back')
    pg.locator(f'label[for="pf-lv-{ECIG["id"]}-every"]').click(); pg.locator(f'label[for="pf-lv-{CROSS["id"]}-big"]').click(); pg.wait_for_timeout(300)
    pg.locator('[data-pf-save]').click(); pg.wait_for_timeout(900)
    lv = levels(pg)
    ok(lv.get(ECIG['id']) == 'every' and lv.get(CROSS['id']) == 'big', f'P1: Save keeps both levels ({lv})')
    ok(pg.locator('.pf-bar').count() == 0 and pg.locator(f'#pf-lv-{ECIG["id"]}-every').is_checked(), 'P1: the bar goes and the rows show what was saved')
    # Signed in with an email (stood in for, as tests/profile.py does): the email follows the levels unless they choose every hearing.
    pg.evaluate("async () => { const c = await import('./pub/core.js'); c.S.session = { user: { email: 'lei@example.com' } }; c.S.user = { id: 'u1', prefs: { hearing_alerts: true, action_alerts: true, consent_at: '2026-10-01T00:00:00Z' }, created_at: new Date().toISOString() }; c.S.profile = { name: 'Lei', titles: [], interests: [], stories: {} }; c.app.go('#/more'); }")
    pg.wait_for_timeout(500); pg.evaluate("async () => (await import('./pub/core.js')).app.go('#/profile')"); pg.wait_for_timeout(900)
    elv = pg.locator('#pf-elv')
    ok(elv.count() == 1 and elv.is_visible() and 'Same as each issue above' in elv.inner_text() and 'Every hearing on my issues (not App only ones)' in elv.inner_text(), 'P1: signed in with an email, "Hearing emails" offers the same as each issue, or every hearing but App only ones')
    ok('Email me alerts about my issues' in pg.locator('#pf-email').inner_text() and 'gets a hearing' not in pg.locator('label[for="pf-em-alerts"]').inner_text(), 'P1: the box over it says "Email me alerts about my issues" (P-5)')
    ok(pg.locator('#pf-elv-same').is_checked(), 'P1: the same as each issue is the default')
    pg.locator('label[for="pf-elv-every"]').click(); pg.wait_for_timeout(300)
    pg.locator('[data-pf-save]').click(); pg.wait_for_timeout(900)
    prefs = pg.evaluate("async () => (await import('./pub/core.js')).S.user.prefs")
    ok(prefs.get('email_level') == 'every' and prefs.get('consent_at') == '2026-10-01T00:00:00Z', f'P1: saved as prefs.email_level, the consent stamp untouched ({prefs})')
    pg.locator('label[for="pf-em-alerts"]').click(); pg.wait_for_timeout(300)
    ok(not pg.locator('#pf-elv').is_visible(), 'P1: with hearing emails unticked, "Hearing emails" folds away (B-12)')
    pg.evaluate("async () => { const c = await import('./pub/core.js'); c.S.session = null; c.S.user = null; c.S.profile = {}; }")
    c.close()

    # ---- T1: the thank-you, and X1: the page a text's link opens ----
    c, pg = phone()
    pg.goto(PUB + '#/'); ready(pg); pg.evaluate(setup([CROSS['id']]))
    pg.goto(BASE + f'track.html?demo=1&via=text#/bill/2026/{NUM}/testify'); pg.wait_for_selector('#hp-dlg', timeout=20000); pg.wait_for_timeout(1200)
    tap = lambda t: pg.locator('#hp-dlg button, #hp-dlg a, #hp-dlg label').filter(has_text=re.compile(t)).first.click()
    if 'Where do you stand' in pg.evaluate("document.getElementById('hp-dlg').innerText"): tap('^I support it'); pg.wait_for_timeout(700)
    tap('^Next'); pg.wait_for_timeout(600); pg.fill('#hp-name', 'Kai Ho'); tap('^See my letter'); pg.wait_for_timeout(700)
    tap('^Next'); pg.wait_for_timeout(700); tap('^Yes, I have an account'); pg.wait_for_timeout(700); tap('^I already sent it'); pg.wait_for_timeout(1600)
    card = pg.locator('#hp-dlg .hp-next .hp-lvl')
    ok(card.count() == 1 and f'Text me about every hearing on “{CROSS["name"]}”?' in card.inner_text(), f'T1: "What happens next" asks "Text me about every hearing on “{CROSS["name"]}”?" (C-10)')
    ok(card.locator('.btn.secondary').count() == 1 and card.locator('.btn.primary').count() == 0, 'T1: its one button is quiet, the bar keeps the only filled one (A-3)')
    ok(pg.locator('#hp-dlg section.hp-lvl, #hp-dlg .card.hp-lvl').count() == 0, 'T1: no card of its own beside the story ask (one ask card at a time, C-3)')
    card.locator('[data-hp="lvl-every"]').click(); pg.wait_for_timeout(700)
    okl = pg.locator('#hp-dlg .hp-lvlok')
    ok(okl.count() == 1 and 'every hearing' in okl.inner_text() and pg.locator('#hp-dlg .hp-lvl').count() == 0 and levels(pg).get(CROSS['id']) == 'every', 'T1: the yes leaves one line, and the level is Every hearing')
    pg.locator('#hp-dlg [data-hp="lvl-undo"]').click(); pg.wait_for_timeout(700)
    ok(pg.locator('#hp-dlg .hp-lvl').count() == 1 and levels(pg).get(CROSS['id']) == 'big', 'T1: Undo puts back Big moments only, and the question with it')
    # The big push's link: the bill's own page, ?via=text.
    pg.goto(BASE + f'track.html?demo=1&via=text#/bill/2026/{NUM}'); pg.reload(); ready(pg); pg.wait_for_timeout(900)
    line = pg.locator('.bl-issue')
    ok(line.count() == 1 and 'Texts: Big moments only' in line.inner_text() and line.inner_text().count(CROSS['name']) == 1, f'X1: the "Part of" line says "Texts: Big moments only", the issue named once ({line.inner_text() if line.count() else None!r})')
    ch = pg.locator('.bl-issue [data-lvl-toggle]'); ok(ch.count() == 1 and ch.inner_text().strip() == 'Change' and ch.get_attribute('aria-expanded') == 'false', 'X1: with Change beside it')
    ch.click(); pg.wait_for_timeout(600)
    ok(pg.locator('#bl-lvl-box .lvl input[type="radio"][data-lvl]').count() == 3 and 'Alerts about this issue' in pg.locator('#bl-lvl-box').inner_text() and pg.locator('.bl-issue [data-lvl-toggle]').get_attribute('aria-expanded') == 'true', 'X1: Change opens "Alerts about this issue" in place')
    pg.locator('#bl-lvl-box .lvl-o:has([data-lvl="app"])').click(); pg.wait_for_timeout(700)
    ok('Texts: App only' in pg.locator('.bl-issue').inner_text() and levels(pg).get(CROSS['id']) == 'app', 'X1: a tap there changes the line and the level')
    pg.goto(PUB + f'#/bill/2026/{NUM}'); pg.reload(); ready(pg); pg.wait_for_timeout(700)
    ok(pg.locator('.bl-txt').count() == 0 and pg.locator('[data-lvl-toggle]').count() == 0, 'X1: no line without ?via=text')
    c.close()

    # ---- S1: Staff v2 and Staff v5 ----
    for app in ('staff', 'staff5'):
        c = br.new_context(viewport={'width': 1280, 'height': 800}); pg = c.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
        url = BASE + f'{app}.html?demo=1'
        pg.goto(url + '#/'); pg.wait_for_timeout(3500)
        pg.goto(url + '#/email/new?bill=HB2121'); pg.reload(); pg.wait_for_timeout(3500)
        if pg.locator('#le-push').count() == 0 and pg.locator('[data-le="next"]').count(): pg.locator('[data-le="next"]').first.click(); pg.wait_for_timeout(800)
        ok(pg.locator('#le-push').count() == 1 and 'Also text everyone following “Disposable e-cigarette ban”' in pg.locator('.le-push').inner_text() and 'At most one per issue a week keeps texts welcome.' in pg.locator('.le-push').inner_text(), f'S1 {app}: an email about a bill offers "Also text everyone following" its issue, with the hint')
        ok(not pg.locator('#le-tline').is_visible(), f'S1 {app}: the text line waits until it is ticked')
        pg.locator('label[for="le-push"]').click(); pg.wait_for_timeout(300)
        subj = pg.locator('#le-subj').input_value().strip()
        ok(pg.locator('#le-tline').is_visible() and pg.locator('#le-tline').input_value() == subj[:110], f'S1 {app}: ticked, the text line shows, its first draft the subject ({pg.locator("#le-tline").input_value()!r})')
        rd = pg.locator('#le-tline-p').inner_text()
        ok(rd.startswith('HIPHI Bill Tracker: ') and 'b/2026/HB2121?via=text' in rd and rd.endswith('Reply STOP to stop.'), f'S1 {app}: the text as it will read, under the count ({rd!r})')
        pg.fill('#le-tline', 'Speak up'); pg.wait_for_timeout(200)
        ok('8 of 110 characters, at least 10' in pg.locator('#le-tline-n').inner_text(), f'S1 {app}: a live count ({pg.locator("#le-tline-n").inner_text()!r})')
        pg.locator('[data-le="next"]').first.click(); pg.wait_for_timeout(600)
        ok('at least 10' in pg.locator('#le-tline-err').inner_text(), f'S1 {app}: a text line under 10 characters is refused, next to it')
        pg.fill('#le-tline', 'Testimony on the disposable e-cigarette ban is due Wed at 9:30 AM.'); pg.wait_for_timeout(200)
        ok(pg.locator('#le-tline-err').inner_text().strip() == '' and '66 of 110 characters: two text parts. 59 or fewer sends one' in pg.locator('#le-tline-n').inner_text(), f'S1 {app}: typing clears the error; over 59 characters it says two text parts')
        pg.fill('#le-tline', 'Testify on the e-cigarette ban by Wed 9:30 AM.'); pg.wait_for_timeout(200)
        ok('46 of 110 characters: one text part' in pg.locator('#le-tline-n').inner_text(), f'S1 {app}: 59 or fewer is one text part ({pg.locator("#le-tline-n").inner_text()!r})')
        # A big push on the same issue two days ago (stood in for in the sandbox's alerts): warned of.
        pg.evaluate(f"""async () => {{ const d = await import('./{app}/data.js'); const S = d.S; const other = S.bills.find(b => b.id !== '{BID['HB2121']}');
          const iss = (S.billIssues || []).find(x => x.bill_id === '{BID['HB2121']}'); if (iss && other) S.billIssues.push({{ bill_id: other.id, issue_id: iss.issue_id }});
          S.alerts.unshift({{ id: -99, bill_id: other.id, big_push: true, status: 'sent', sent_at: new Date(Date.now() - 2 * 864e5).toISOString(), subject: 'Ban disposables now' }});
          d.hooks.render(); }}""")
        pg.wait_for_timeout(600)
        warn = pg.locator('.le-pushmore .notice')
        ok(warn.count() == 1 and 'Ban disposables now' in warn.inner_text() and 'went out' in warn.inner_text(), f'S1 {app}: a big push on the same issue in the past 7 days is warned of ({warn.inner_text() if warn.count() else None!r})')
        # Waiting for approval: the approver sees the text line too, not only the email.
        pg.evaluate(f"""async () => {{ const d = await import('./{app}/data.js'); const other = d.S.advocates.find(x => x.id !== d.S.me?.id);
          d.S.alerts.unshift({{ id: -98, bill_id: '{BID['HB2121']}', author_id: other?.id, status: 'submitted', subject: 'Testify on HB 2121', body: 'Please testify on the bill this week, it matters.', body_html: '<p>Please testify on the bill this week, it matters.</p>', big_push: true, text_line: 'Testify on the e-cigarette ban by Wed.', created_at: new Date().toISOString() }}); d.S.leCmp = null; }}""")
        pg.goto(url + '#/email/-98'); pg.wait_for_timeout(1200)
        pl = pg.locator('.le-pushline')
        ok(pl.count() == 1 and 'Testify on the e-cigarette ban by Wed.' in pl.inner_text(), f'S1 {app}: an email waiting for approval shows its text line too')
        lid = (snap.get('lists') or [{}])[0].get('id')
        if lid:
            pg.evaluate("async () => { const d = await import('./" + app + "/data.js'); d.S.leCmp = null; }")
            pg.goto(url + f'#/email/new?list={lid}'); pg.wait_for_timeout(1500)
            if pg.locator('[data-le="next"]').count() and pg.locator('#le-subj').count() == 0: pg.locator('[data-le="next"]').first.click(); pg.wait_for_timeout(800)
            ok(pg.locator('#le-subj').count() == 0 or pg.locator('#le-push').count() == 0, f'S1 {app}: an email to a list has no big push')
        c.close()
    br.close()

# ---- G1: the go-live switch ----
alerts = open(os.path.join(ROOT, 'pub', 'alerts.js')).read(); terms = open(os.path.join(ROOT, 'text-terms.html')).read()
m = re.search(r'export const WORDS_T5 = (true|false);', alerts)
on = m and m.group(1) == 'true'
live = re.sub(r'<!--.*?-->', '', terms, flags=re.S)
ok(m and ((not on and 'R-299 GO-LIVE' in terms and 'At most one text a day.' in live and 'Usually a few texts a month' not in live)
          or (on and 'R-299 GO-LIVE' not in terms and 'Usually a few texts a month' in live)), f'G1: WORDS_T5 is {m and m.group(1)} and text-terms.html shows the same words')
ok(not errs, f'no page errors {errs[:3]}')
print(f'{sum(res)} of {len(res)} passed'); sys.exit(0 if all(res) else 1)
