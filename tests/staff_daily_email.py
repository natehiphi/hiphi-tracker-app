# R-101 in the staff sandbox: Send puts a supporter email into the 4:30 pm email (with Undo and Take it back), the
# Emails page shows it under "Going out at 4:30 pm", and Session setup > Email has the sender and reply fields.
#   python3 tests/staff_daily_email.py [base] [shots]      base defaults to http://localhost:8832/staff.html?demo=1
import sys, os
from playwright.sync_api import sync_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832/staff.html?demo=1'
SHOTS = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out')
res = []
def ok(c, m): res.append(bool(c)); print('PASS' if c else 'FAIL', m)
with sync_playwright() as p:
    br = p.chromium.launch(); ctx = br.new_context(viewport={'width': 1280, 'height': 900}); pg = ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(BASE + '#/outreach/emails'); pg.wait_for_function("() => !!document.querySelector('main') && !document.querySelector('.skel')", timeout=60000); pg.wait_for_timeout(800)
    aid = pg.evaluate("""async () => { const d = await import('./staff/data.js'); const S = d.S;
      const b = S.bills.find(x => x.position && x.position !== 'monitor'); const other = S.advocates.find(x => x.id !== S.me.id);
      S.alerts = [{ id: 'demo-a1', bill_id: b.id, list_id: null, segment_id: null, subject: 'Testify by Thursday', body: 'Please send a short note of support before Thursday.',
        body_html: '<p>Please send a short note of support before Thursday.</p>', author_id: S.me.id, status: 'approved', approved_by: other.id, approved_at: new Date().toISOString(),
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(), recipients: null, scheduled_for: null, opens: 0, clicks: 0, bounces: 0 }];
      location.hash = '#/email/demo-a1'; return 'demo-a1'; }""")
    pg.wait_for_timeout(1200)
    sb = pg.locator('[data-le="send"]').first
    ok(sb.count() == 1 and 'Send at 4:30 pm' in sb.inner_text(), 'the button says when it goes: ' + (sb.inner_text() if sb.count() else 'none'))
    sb.click(); pg.wait_for_timeout(500)
    sheet = pg.locator('dialog[open], .sheet[open], [role="dialog"]').last
    t = sheet.inner_text() if sheet.count() else ''
    ok('4:30 pm' in t and 'one email of the day' in t and 'take it back' in t.lower(), 'the confirmation says it joins the 4:30 pm email and can be taken back')
    pg.locator('[data-yes]').click(); pg.wait_for_timeout(900)
    toast = pg.locator('.toast, [role="status"]').filter(has_text='4:30 pm').first
    ok(toast.count() == 1 and 'Undo' in toast.inner_text(), 'the message says when, with Undo: ' + (toast.inner_text().replace('\n', ' ')[:90] if toast.count() else 'none'))
    main = pg.locator('main').inner_text()
    ok('goes out today at 4:30 pm' in main.lower() and pg.locator('[data-le="unsend"]').count() == 1, 'the page says it goes out at 4:30 pm and offers Take it back')
    ok('HIPHI Bill Tracker' in main and 'One email a day at most' in main and 'Stop HIPHI’s alerts' in main, 'the preview shows the 4:30 pm email: from HIPHI Bill Tracker, its footer')
    pg.screenshot(path=f'{SHOTS}/r101_waiting_1280.png')
    pg.locator('[data-le="unsend"]').first.click(); pg.wait_for_timeout(800)
    ok(pg.locator('[data-le="send"]').count() == 1 and pg.locator('[data-le="unsend"]').count() == 0, 'Take it back returns it to Ready to send')
    pg.locator('[data-le="send"]').first.click(); pg.wait_for_timeout(400); pg.locator('[data-yes]').click(); pg.wait_for_timeout(800)
    pg.goto(BASE + '#/outreach/emails'); pg.wait_for_timeout(1200)
    ok('Goes out today at 4:30 pm' in pg.locator('main').inner_text(), 'the Emails list shows it as going out at 4:30 pm')
    pg.set_viewport_size({'width': 390, 'height': 844}); pg.wait_for_timeout(800)
    ok('Going out at 4:30 pm' in pg.locator('main').inner_text(), 'on a phone it has its own group, Going out at 4:30 pm')
    pg.set_viewport_size({'width': 1280, 'height': 900}); pg.wait_for_timeout(500)
    ok('one email a day at most, at 4:30 pm' in pg.locator('main').inner_text(), 'and says supporters get one email a day at 4:30 pm')
    pg.goto(BASE + '#/setup/email'); pg.wait_for_function("() => !!document.querySelector('#st-email-from')", timeout=30000)
    ok(pg.locator('#st-email-from').count() == 1 and pg.locator('#st-email-reply').count() == 1, 'Session setup > Email has the sender and reply fields')
    pg.locator('#st-email-from').fill('not an email'); pg.locator('[data-stsave]').click(); pg.wait_for_timeout(400)
    ok(pg.locator('#st-email-from-err').count() == 1, 'a wrong address is refused in words')
    pg.locator('#st-email-from').fill('alerts@hiphi.org'); pg.locator('#st-email-reply').fill('info@hiphi.org'); pg.locator('[data-stsave]').click(); pg.wait_for_timeout(600)
    cfg = pg.evaluate("async () => { const d = await import('./staff/data.js'); return d.S.emailCfg; }")
    ok(cfg.get('from_email') == 'alerts@hiphi.org' and cfg.get('reply_to') == 'info@hiphi.org' and cfg.get('from_name') == 'HIPHI Bill Tracker', f'saved: {cfg}')
    ok(not errs, f'no page errors {errs[:2]}')
    br.close()
print(f"\n{sum(res)} passed, {len(res) - sum(res)} failed")
