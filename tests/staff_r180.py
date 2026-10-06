# R-180 wave 1, the Staff v2 fixes (the assessments of 5 Oct 2026), in the practice copy:
#   X10-1  an approver (Kris) finds Approve on the bill page their Slack link opens; the writer and a teammate do not;
#   Z1-5   a failed read of the email settings counts as paused and every email save is refused; a sender Save never
#          writes "enabled";
#   Z1-3/3 while email is paused an approved supporter email shows "Approved · held while email is paused";
#   Z1-3/4 an ask past its show-through date is no ask: Today asks for the next one, This week's asks and the share kit
#          leave its words out;
#   X9-2   the staff sign-in (and Choose a new password) is centred and named on a laptop, with the public tracker's link;
#   Z1-7   staff read the stored follower count, and the practice copy's sample counts still show.
#   python3 tests/staff_r180.py [base folder]      base defaults to http://localhost:8832/
import os, sys, re
from playwright.sync_api import sync_playwright
ROOT = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832/'
ROOT = ROOT if ROOT.endswith('/') else ROOT + '/'
B = ROOT + 'staff.html?demo=1'
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'out'); os.makedirs(OUT, exist_ok=True)
res = []
def ok(c, m): res.append(bool(c)); print('PASS' if c else 'FAIL', m)
READY = "() => !!document.querySelector('main') && !document.querySelector('.skel') && !!document.querySelector('.sv-side, .sv-hdr, .sv-tabs')"
def open_(pg, url):
    pg.goto(url); pg.reload(); pg.wait_for_function(READY, timeout=60000); pg.wait_for_timeout(1200)
def main_text(pg): return pg.locator('main').inner_text()

with sync_playwright() as p:
    br = p.chromium.launch(); errs = []
    ctx = br.new_context(viewport={'width': 1366, 'height': 900}); pg = ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))

    # ---- X10-1: the bill page offers Approve to the people the Review screen does ----
    open_(pg, B + '#/')
    d = pg.evaluate("""async () => { const d = await import('./staff/data.js'); const S = d.S;
      const x = Object.values(S.drafts).flat().find(r => r.status === 'review'); if (!x) return null;
      return { bill: S.bills.find(b => b.id === x.bill_id).bill_number, writer: d.advocate(x.submitted_by)?.initials, id: x.id }; }""")
    ok(d is not None, f'the practice copy has a draft waiting for its first approval: {d}')
    if d:
        acts = lambda: pg.evaluate("[...document.querySelectorAll('[data-dact]')].map(e => e.dataset.dact)")
        open_(pg, B + f'&as=KR#/bill/{d["bill"]}')
        a = acts(); who = pg.locator('.bw-who').first.inner_text() if pg.locator('.bw-who').count() else ''
        ok('approve' in a and 'changes' in a, f'as Kris (an approver) the bill page shows Approve and Request changes: {a} · "{who}"')
        ok('waiting for you' in who, 'and the line says it is waiting for them')
        pg.screenshot(path=f'{OUT}/r180_kris_approve_1366.png')
        pg.locator('[data-dact="approve"]').first.click(); pg.wait_for_timeout(900)
        t = pg.locator('.toastmsg').first.inner_text() if pg.locator('.toastmsg').count() else ''
        ok(t.startswith('Approved') and 'Undo' in t, f'Approve works there, with Undo: "{t[:80]}"')
        open_(pg, B + f'&as={d["writer"]}#/bill/{d["bill"]}')
        ok('approve' not in acts(), f'as its writer ({d["writer"]}) the bill page offers no Approve: {acts()}')
        open_(pg, B + f'&as=LR#/bill/{d["bill"]}')
        ok('approve' not in acts(), f'as a teammate who neither approves nor reviews (Lauren) it offers none: {acts()}')
        # A reviewer (Jess) gets Approve exactly when the Review screen lets them stand in (6 hours before the deadline).
        open_(pg, B + f'&as=JS#/bill/{d["bill"]}')
        st = pg.evaluate(f"""async () => {{ const d = await import('./staff/data.js'); const m = await import('./staff/model.js');
          const x = Object.values(d.S.drafts).flat().find(r => r.id === '{d["id"]}'); return m.canFirstApprove(d.S.me, x, m.draftHearing(x)); }}""")
        ok(('approve' in acts()) == st, f'as a reviewer (Jess) Approve follows the stand-in rule: may stand in {st}, buttons {acts()}')
        if st: ok('you can stand in' in pg.locator('.bw-who').first.inner_text(), 'and the line says they can stand in')

    # ---- Z1-5: fail closed when the email settings cannot be read ----
    open_(pg, B + '#/setup/email')
    r = pg.evaluate("""async () => { const d = await import('./staff/data.js');
      return { failed: d.emailCfgOf({ data: null, error: { message: 'Failed to fetch' } }), none: d.emailCfgOf({ data: null, error: null }),
        stored: d.emailCfgOf({ data: { value: { enabled: false, postal: 'x' } }, error: null }), lost: d.emailCfgOf(null) }; }""")
    ok(r['failed']['cfg'].get('enabled') is False and 'read the email settings' in r['failed']['err'], f'a failed read counts as paused and says so: {r["failed"]}')
    ok(r['lost']['cfg'].get('enabled') is False and r['lost']['err'], 'so does a read that never came back')
    ok(r['none']['cfg'].get('enabled') is False and not r['none']['err'], 'no row yet reads as paused, as the database counts it since 145 (email_enabled)')
    ok(r['stored']['cfg'] == {'enabled': False, 'postal': 'x'} and not r['stored']['err'], 'a stored row is read as stored')
    # a normal Save of the sender fields writes them and leaves the switch alone
    pg.locator('#st-email-from').fill('alerts@hiphi.org'); pg.locator('#st-email-reply').fill('info@hiphi.org'); pg.locator('[data-stsave]').click(); pg.wait_for_timeout(700)
    cfg = pg.evaluate("async () => (await import('./staff/data.js')).S.emailCfg")
    ok(cfg.get('from_email') == 'alerts@hiphi.org' and cfg.get('enabled') is False, f'a sender Save keeps email paused: {cfg}')
    # now as a failed read leaves things
    pg.evaluate("""async () => { const d = await import('./staff/data.js'); ({ err: d.S.emailCfgErr, cfg: d.S.emailCfg } = d.emailCfgOf({ data: null, error: { message: 'Failed to fetch' } })); d.hooks.render(); }""")
    pg.wait_for_timeout(600)
    status = pg.locator('[data-ststatus]').inner_text()
    ok('read the email settings' in status and 'paused' in status, f'Session setup > Email says it could not read them: "{status}"')
    ok(not pg.locator('#st-email-on').is_checked(), 'and the switch shows email paused')
    pg.locator('#st-email-postal').fill('707 Richards Street'); pg.locator('[data-stsave]').click(); pg.wait_for_timeout(700)
    t = pg.locator('.toastmsg').first.inner_text() if pg.locator('.toastmsg').count() else ''
    cfg = pg.evaluate("async () => (await import('./staff/data.js')).S.emailCfg")
    ok('read the email settings' in t and 'Reload' in t, f'Save is refused in plain words: "{t}"')
    ok(cfg == {'enabled': False}, f'and nothing was written: {cfg}')
    pg.locator('#st-email-on').evaluate('e => e.click()'); pg.wait_for_timeout(700)
    t = pg.locator('.toastmsg').first.inner_text() if pg.locator('.toastmsg').count() else ''
    ok(not pg.locator('dialog[open]').count() and not pg.locator('#st-email-on').is_checked() and 'read the email settings' in t, f'turning email on is refused too, with no "Turn email on?" first: "{t}"')
    pg.screenshot(path=f'{OUT}/r180_email_unread_1366.png')
    # a fresh page: the refused Save left typed words, and the page's leave guard rightly holds on to them
    pg.close(); pg = ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))

    # ---- Z1-3 part 3: approved and held while email is paused ----
    open_(pg, B + '#/outreach/emails')
    pg.evaluate("""async () => { const d = await import('./staff/data.js'); const S = d.S, now = new Date().toISOString();
      const b = S.bills.find(x => x.position && x.position !== 'monitor' && x.is_public !== false); const other = S.advocates.find(x => x.id !== S.me.id && x.is_active !== false);
      const base = { bill_id: b.id, list_id: null, segment_id: null, body: 'Please send a short note.', body_html: '<p>Please send a short note.</p>', created_at: now, updated_at: now, opens: 0, clicks: 0, bounces: 0 };
      S.alerts = [{ ...base, id: 'r180-a1', subject: 'Testify by Thursday', author_id: S.me.id, status: 'approved', approved_by: other.id, approved_at: now, recipients: 12, scheduled_for: now },
        { ...base, id: 'r180-a2', subject: 'Call the chair', author_id: other.id, status: 'submitted', submitted_at: now, recipients: null, scheduled_for: null }];
      d.hooks.render(); }""")
    pg.wait_for_timeout(700)
    m = main_text(pg)
    ok('Approved · held while email is paused' in m, 'the Emails table says "Approved · held while email is paused"')
    ok('Goes out today at 4:30 pm' not in m, 'and not that it goes out today')
    pg.screenshot(path=f'{OUT}/r180_emails_held_1366.png')
    pg.set_viewport_size({'width': 390, 'height': 844}); pg.wait_for_timeout(900)
    m = main_text(pg)
    ok('Held while email is paused' in m and 'Approved · held while email is paused' in m, 'on a phone its group and chip say it is held')
    pg.screenshot(path=f'{OUT}/r180_emails_held_390.png')
    pg.set_viewport_size({'width': 1366, 'height': 900}); pg.wait_for_timeout(600)
    pg.evaluate("location.hash = '#/email/r180-a1'"); pg.wait_for_timeout(1000)
    m = main_text(pg)
    ok('Approved · held while email is paused.' in m and 'after an admin turns email on' in m, 'its own page says it is held until email is turned on')
    pg.screenshot(path=f'{OUT}/r180_email_held_page_1366.png')
    pg.evaluate("location.hash = '#/email/r180-a2'"); pg.wait_for_timeout(1000)
    m = main_text(pg)
    ok('Waiting for' in m and 'still writing it' not in m, 'an email waiting for approval says so (it used to read "still writing it")')
    ok('an approved email is held until email is turned on' in m, 'the paused notice says an approved email is held')
    pg.evaluate("async () => { const d = await import('./staff/data.js'); d.S.emailCfg = { enabled: true }; location.hash = '#/outreach/emails'; }"); pg.wait_for_timeout(1000)
    m = main_text(pg)
    ok('Goes out today at 4:30 pm' in m and 'held while email is paused' not in m, 'with email on the same email goes out today at 4:30 pm')
    pg.evaluate("async () => { const d = await import('./staff/data.js'); d.S.emailCfg = { enabled: false }; d.S.alerts = []; }")

    # ---- Z1-3 part 4: an expired ask is no ask ----
    open_(pg, B + '&as=KV#/')
    m0 = main_text(pg)
    ok('Write the public ask' in m0, 'Kevin\'s Today asks for HB2121\'s public ask (no ask yet)')
    setask = lambda until: pg.evaluate(f"""async () => {{ const d = await import('./staff/data.js'); const b = d.S.bills.find(x => x.bill_number === 'HB2121');
      b.public_action = 'Tell the committee: pass it this week.'; b.public_action_until = '{until}'; d.hooks.render(); }}""")
    setask('2026-03-14'); pg.wait_for_timeout(900)
    m = main_text(pg)
    ok('Write the next public ask' in m and 'The last ask showed through' in m, 'an ask whose date has passed: Today asks for the next one')
    pg.screenshot(path=f'{OUT}/r180_expired_ask_1366.png')
    kit = lambda: pg.evaluate("""async () => { const d = await import('./staff/data.js'); const m = await import('./staff/model.js'); const b = d.S.bills.find(x => x.bill_number === 'HB2121');
      return m.shareKit(b, m.hearingAhead(b)).message; }""")
    ok('pass it this week' not in kit(), f'the share kit leaves the old words out: "{kit()[:90]}"')
    asks = lambda: pg.evaluate("""async () => { const t = await import('./staff/today.js'); const d = await import('./staff/data.js'); const m = await import('./staff/model.js');
      const b = d.S.bills.find(x => x.bill_number === 'HB2121'); return t.weekAsksText([{ b, h: m.hearingAhead(b), due: Date.now() + 864e5 }], 'newsletter'); }""")
    ok('pass it this week' not in asks() and 'Please speak up on' in asks(), 'This week\'s asks leaves them out too')
    setask('2026-03-20'); pg.wait_for_timeout(900)
    m = main_text(pg)
    ok('public ask' not in m, 'an ask still showing: no card')
    ok('pass it this week' in kit() and 'pass it this week' in asks(), 'and the share kit and This week\'s asks use it')
    pg.evaluate("async () => { const d = await import('./staff/data.js'); const b = d.S.bills.find(x => x.bill_number === 'HB2121'); b.public_action = null; b.public_action_until = null; }")

    # ---- Z1-7: the stored follower count ----
    src = open(os.path.join(HERE, '..', 'staff', 'data.js')).read()
    ok(".from('follower_counts')" in src and "rpc('watch_counts')" not in src, 'Staff v2 reads follower_counts, the public page\'s own number, not watch_counts()')
    open_(pg, B + '#/bill/HB2121/public')
    resp = ' '.join(pg.locator('#bw-resp-h').locator('xpath=..').inner_text().split())
    ok(re.search(r'\d+ follow', resp) and 'sample numbers' in resp, f'the practice copy\'s sample counts still show: "{resp[:110]}"')

    # ---- Found in wave 1: Review's Skip and the frame's "Skip to content" shared data-skip ----
    open_(pg, B + '&as=KR#/review')
    cnt = lambda: pg.locator('.td-rvn').inner_text() if pg.locator('.td-rvn').count() else ''
    c0 = cnt(); total = int(re.search(r'of (\d+)', c0).group(1)) if re.search(r'of (\d+)', c0) else 0
    ok(total >= 2, f'as Kris the review queue has two items or more: "{c0}"')
    pg.evaluate("document.querySelector('button.skip').click()"); pg.wait_for_timeout(300)
    ok(cnt() == c0 and pg.evaluate("document.activeElement?.id") == 'main', f'"Skip to content" moves focus to the page and skips no item: "{cnt()}"')
    pg.mouse.move(600, 400); pg.keyboard.press('ArrowRight'); pg.wait_for_timeout(400)
    ok('2 of' in cnt(), f'Right arrow skips to the next item: "{c0}" -> "{cnt()}"')
    # An email item redraws when its audience count arrives; the slide carries on instead of the card snapping in.
    key = pg.evaluate("async () => { const t = await import('./staff/today.js'); return t.reviewQueue().find(x => x.type === 'email')?.key || null; }")
    if key:
        pg.evaluate("async () => { (await import('./staff/data.js')).S.tdAud = {}; }")
        pg.evaluate(f"location.hash = '#/review/' + encodeURIComponent({key!r})"); pg.wait_for_timeout(120)
        st = pg.evaluate("(() => { const c = document.querySelector('.td-rvcard'); return c ? { cls: c.className, d: c.style.animationDelay, n: (document.querySelector('.td-rvline')?.innerText || '') } : null; })()")
        ok(st and 'td-in' in st['cls'], f'an email item slides in, and still does after its audience count redraws it: {st}')
    else:
        ok(True, 'no supporter email in the practice queue (the slide check is skipped)')

    # ---- Found in wave 1: Today's Send said "cannot be taken back" and named the writer's address as the sender ----
    # (an email with no bill gets its own card; on a bill's card it is an "Also" line)
    open_(pg, B + '#/')
    pg.evaluate("""async () => { const d = await import('./staff/data.js'); const a = d.S.alerts[0];
      Object.assign(a, { author_id: d.S.me.id, status: 'approved', scheduled_for: null, bill_id: null }); d.hooks.render(); }""")
    pg.wait_for_timeout(500)
    sb = pg.locator('main button[data-act="send"]')
    ok(sb.count() >= 1, 'Today offers Send on my approved email')
    if sb.count():
        sb.first.click(); pg.wait_for_timeout(400)
        txt = ' '.join(pg.evaluate("document.querySelector('dialog[open]')?.innerText || ''").split())
        ok('4:30 pm' in txt and 'take it back until then' in txt and 'cannot be taken back' not in txt and 'goes out from' not in txt,
           f'its confirmation says the 4:30 pm email, that it can be taken back, and who gets the replies: "{txt[:220]}"')
        pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    ctx.close()

    # ---- X9-2: the staff sign-in, signed out at the main address ----
    for w, h in ((1366, 900), (390, 844)):
        c = br.new_context(viewport={'width': w, 'height': h}); q = c.new_page(); q.on('pageerror', lambda e: errs.append(str(e)))
        q.goto(ROOT + 'index.html'); q.wait_for_selector('#lf', timeout=60000); q.wait_for_timeout(500)
        box = q.evaluate("(() => { const r = document.querySelector('main').getBoundingClientRect(); return { l: Math.round(r.left), w: Math.round(r.width), r: Math.round(innerWidth - r.right) }; })()")
        txt = q.locator('main').inner_text(); link = q.locator('main a[href="track.html"]')
        if w > 1100: ok(box['w'] <= 440 and abs(box['l'] - box['r']) <= 2, f'{w}px: the sign-in is centred, not in the side column: {box}')
        else: ok(box['l'] == 0 and box['r'] == 0, f'{w}px: the sign-in fills the phone: {box}')
        ok('HIPHI Bill Tracker' in txt and 'for the HIPHI team' in txt and 'HIPHI Bill Tracker · for the HIPHI team' in q.title(), f'{w}px: named "HIPHI Bill Tracker · for the HIPHI team" ({q.title()})')
        ok('Looking for the public tracker?' in txt and link.count() == 1, f'{w}px: "Looking for the public tracker?" links to track.html')
        q.screenshot(path=f'{OUT}/r180_signin_{w}.png')
        q.evaluate("async () => (await import('./staff/data.js')).hooks.onRecovery()"); q.wait_for_timeout(400)
        box = q.evaluate("(() => { const r = document.querySelector('main').getBoundingClientRect(); return { l: Math.round(r.left), w: Math.round(r.width), r: Math.round(innerWidth - r.right) }; })()")
        ok(q.locator('h1').inner_text() == 'Choose a new password' and (box['w'] <= 440 and abs(box['l'] - box['r']) <= 2 if w > 1100 else box['l'] == 0), f'{w}px: Choose a new password is laid out the same: {box}')
        q.screenshot(path=f'{OUT}/r180_newpassword_{w}.png')
        c.close()

    ok(not errs, f'no page errors {errs[:2]}')
    br.close()
print(f"\n{sum(res)} passed, {len(res) - sum(res)} failed")
sys.exit(0 if all(res) else 1)
