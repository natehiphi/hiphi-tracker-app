# Staff v5 practice copy: every ask to a chair is recorded and the team sees it (R-316 W3), the writer's hand-on time
# skips the night (W31, Nate 10/22) and Help's Ask in Slack goes to Nate (W37). Exits 1 when a check fails.
#   python3 tests/staff5_chair_ask.py                  against http://localhost:8832
#   V4_ROOT=/path/to/worktree python3 tests/staff5_chair_ask.py    serves that folder straight into the browser
import os, sys
from playwright.sync_api import sync_playwright
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from staff5_people import router, HOST, ROOT

fails = []
def check(ok, what):
  print(('ok   ' if ok else 'FAIL ') + what)
  if not ok: fails.append(what)

BILL = os.environ.get('ASK_BILL', 'SB2175')
with sync_playwright() as p:
  br = p.chromium.launch(); pg = br.new_page(viewport={'width': 1440, 'height': 900})
  if ROOT: pg.route(HOST + '/**', router)
  pg.route('mailto:*', lambda r: r.abort())
  pg.goto(HOST + f'/staff5.html?demo=1&as=KV#/bill/{BILL}'); pg.wait_for_timeout(4000)
  mail = pg.locator('.bw-next a.btn[href^="mailto:"]').first
  check(mail.count() == 1, f'{BILL} Next up offers Email the chair')
  href = mail.get_attribute('href') or ''
  check('respectfully%20ask%20you%20to%20schedule%20a%20hearing' in href and 'Public%20Health%20Institute' in href, 'the email uses the hearing request wording')
  check(pg.locator('[data-logtalk]').count() >= 1, 'Log a talk with a legislator is a visible button on the bill')
  pg.evaluate("document.querySelector('.bw-next a.btn[href^=\"mailto:\"]').addEventListener('click', e => e.preventDefault(), { once: true })")
  mail.click(); pg.wait_for_timeout(900)
  sheet = pg.locator('dialog[open]')
  check(sheet.count() == 1 and 'Did you send it?' in sheet.inner_text(), 'after the email the app asks "Did you send it?"')
  pg.get_by_role('button', name='Yes, I sent it').click(); pg.wait_for_timeout(600)
  chipt = pg.locator('.bw-next .ca-chip').first.inner_text() if pg.locator('.bw-next .ca-chip').count() else ''
  check(chipt.startswith('Asked by you') and 'no reply yet' in chipt, f'the row reads "Asked by you … · no reply yet" in place of the button ("{chipt}")')
  check(pg.locator('.bw-next a.btn[href^="mailto:"]').count() == 0, 'the Email the chair button is gone once asked')
  pg.locator('.bw-next .ca-chip').first.click(); pg.wait_for_timeout(500)
  check('Will schedule' in pg.locator('dialog[open]').inner_text(), 'the chip offers the one-tap answers')
  pg.get_by_role('button', name='Will schedule').click(); pg.wait_for_timeout(600)
  chipt = pg.locator('.bw-next .ca-chip').first.inner_text()
  check('will schedule' in chipt, f'the answer shows on the row ("{chipt}")')
  # Another teammate sees it (practice changes carry across a person switch, W38).
  pg.goto(HOST + f'/staff5.html?demo=1&as=NT#/bill/{BILL}'); pg.wait_for_timeout(4000)
  chipt = pg.locator('.bw-next .ca-chip').first.inner_text() if pg.locator('.bw-next .ca-chip').count() else ''
  check(chipt.startswith('Asked by Kevin'), f'Nate sees "Asked by Kevin" ({chipt})')
  pg.goto(HOST + '/staff5.html?demo=1&as=NT#/legislators'); pg.wait_for_timeout(3500)
  check('None logged' not in pg.locator('tr', has_text='Takayama').first.inner_text() if pg.locator('tr', has_text='Takayama').count() else False, "the chair's Last contact shows the ask")
  # W31: a 9:00 AM deadline's writer hands on at 4:00 PM the day before, not 9:00 PM; filing stays 2 hours before.
  got = pg.evaluate("""async () => { const m = await import('/staff5/today.js');
    const hst = (d, t) => new Date(d + 'T' + t + ':00-10:00').getTime(), now = Date.now(), day = new Date(now + 36 * 36e5 - 10 * 36e5).toISOString().slice(0, 10);
    const t = (kind, due) => ({ kind, due, h: { committee: 'HLT', scheduled_at: new Date(due + 864e5).toISOString() } });
    return [m.handOn(t('write', hst(day, '09:00'))), m.handOn(t('file', hst(day, '09:00'))), m.handOn(t('write', hst(day, '23:00')))]; }""")
  check('4:00 PM' in got[0], f'a 9:00 AM deadline: send for approval by 4:00 PM the day before ({got[0]})')
  check('7:00 AM' in got[1], f'filing stays 2 hours before ({got[1]})')
  check('11:00 AM' in got[2], f'an 11:00 PM deadline keeps 12 hours before ({got[2]})')
  br.close()
print('\nall passed' if not fails else f'\n{len(fails)} failed'); sys.exit(1 if fails else 0)
