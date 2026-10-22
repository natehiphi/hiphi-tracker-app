# The reminder to friends (R-212 #35, the Neighborhood Captain's Tuesday: "Closes tomorrow. Send a reminder?"), in the practice
# copy served locally. Kai on the practice Tuesday (17 Mar 2026): HB 2121's testimony closes Wednesday 9:30 AM.
#   R1  shared HB 2121 and sent their own: Home's slide is "Closes tomorrow. Send a reminder?" with "Remind your friends" and "Not now"
#   R2  shared it, their own testimony not sent yet: no reminder, their own testimony's slide instead
#   R3  shared it, on the practice Monday (closes in two days): no reminder
#   R4  "Send a reminder": the sheet is "Remind your friends", its message a reminder with the date; copied, the slide is gone,
#       and still gone after a reload
#   R5  "Not now": the slide is gone, still gone after a reload, and back once on the closing day ("Closes today")
#   R7  a phone's share menu: "Send the reminder" sends it, and the slide is gone
#   R6  the old Home (?rec=0, the layout test's 'today'; also the Home of someone who follows nothing): the line under what
#       they did offers the reminder
#   python3 tests/remind_friends.py [base] [outdir]
import sys, os
from playwright.sync_api import sync_playwright
BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832/').rstrip('/')
OUT = sys.argv[2] if len(sys.argv) > 2 else '.'
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
src = open(os.path.join(ROOT, 'compare.html')).read()
WHO = src[src.index('const WHO = {'):src.index('const pick =')]   # the same people as the compare page
res = []
def ok(c, m): res.append(bool(c)); print('PASS' if c else 'FAIL', m)
BUS, TWO, ECIG = '2455257b-07a6-41c9-9745-94f174d78442', '', ''   # filled in from the page below
H_ECIG = '6585adbd-60ab-4eb3-a0b7-303405b87be5'   # HB 2121's hearing: testimony closes Wed 18 Mar, 9:30 AM
def scene(marks):
    return f"""(() => {{ {WHO}
  if (sessionStorage.getItem('__set')) return; sessionStorage.setItem('__set', '1');
  const p = WHO.kai, at = '2026-03-16T08:00:00-10:00';
  for (const k of Object.keys(localStorage)) if (k.startsWith('hiphi_')) localStorage.removeItem(k);
  const set = (k, v) => localStorage.setItem(k + '_demo', typeof v === 'string' ? v : JSON.stringify(v));
  const done = {{ ...p.done }}; for (const k of {marks}) done[k] = at;
  set('hiphi_issue_follows', p.issues); set('hiphi_watch_ids', []); set('hiphi_cat_follows', []); set('hiphi_skips', []);
  set('hiphi_wiz', {{ done: true, issues: p.cats, name: p.name }});
  set('hiphi_done', Object.keys(done)); set('hiphi_done_at', done); set('hiphi_stances', {{}}); set('hiphi_demo_seeded', '0');
  localStorage.setItem('hiphi_tour_home_demo', '{{"how":"test"}}'); localStorage.setItem('hiphi_tour_bill_demo', '{{"how":"test"}}');
}})();"""
# The hearings with testimony open on the practice Tuesday, read once from the page: 'HB1780' -> [bill id, hearing id].
OPEN = """async () => { const c = await import('./pub/core.js'), now = Date.now(), out = {};
  for (const h of c.S.hearings) { const b = c.S.bills.find(x => x.id === h.bill_id);
    if (b && h.testimony_deadline && Date.parse(h.testimony_deadline) > now) out[b.bill_number] = [b.id, h.id]; }
  return out; }"""
TITLE = "() => document.querySelector('#main .cm-goal')?.innerText.trim() || ''"
KEYS = "async () => (await import('./pub/core.js')).S.cmKeys || []"
def url(day='tue', layout='calm'):
    return f"{BASE}/track.html?demo=1{'' if day == 'mon' else '&day=' + day}&abrest=today&ab=layout.{layout}{'' if layout == 'calm' else '&rec=0'}#/"
with sync_playwright() as p:
    br = p.chromium.launch(); errs = []
    def page(marks, day='tue', layout='calm', phone=True):
        c = br.new_context(**({'viewport': {'width': 375, 'height': 812}, 'is_mobile': True, 'has_touch': True} if phone else {'viewport': {'width': 1366, 'height': 800}}))
        c.add_init_script(scene(marks)); c.grant_permissions(['clipboard-read', 'clipboard-write'])
        pg = c.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(url(day, layout)); pg.wait_for_selector('#main .hm', timeout=60000); pg.wait_for_timeout(1500)
        return c, pg
    # the practice copy's open hearings on Tuesday
    c, pg = page([]); hs = pg.evaluate(OPEN); c.close()
    ok(all(k in hs for k in ('HB1780', 'HB2300', 'HB2121')), f'the practice Tuesday has HB 1780, HB 2300 and HB 2121 open ({sorted(hs)})')
    e, eh = hs['HB2121']
    # their own testimony on everything due, and the share of HB 2121
    own = [f"{hs[n][0]}|{hs[n][1]}|testimony" for n in ('HB1780', 'HB2300', 'HB2121')]
    shared = own + [f"{e}|{eh}|share"]
    c, pg = page(shared); t = pg.evaluate(TITLE); slide = pg.locator('#main .cm-slide').inner_text()
    ok(t == 'Closes tomorrow. Send a reminder?', f'R1: the slide asks ({t!r})')
    ok('You asked friends to send testimony on' in slide and pg.locator('#main [data-cm-remind]').inner_text().strip() == 'Remind your friends' and pg.locator('#main [data-cm-remno]').count() == 1,
       'R1: the sentence names the friends asked and the testimony; "Remind your friends" and "Not now"')
    ok('By tomorrow 9:30 AM' in slide, f'R1: the deadline is on the detail line ({slide[:160]!r})')
    pg.screenshot(path=os.path.join(OUT, 'r212_35_phone.png'))
    # R4: send it (copied: the headless browser has no share menu, so the laptop's box)
    pg.locator('#main [data-cm-remind]').click(); pg.wait_for_timeout(700)
    h2 = pg.locator('.af-sheet #af-h').inner_text() if pg.locator('.af-sheet[open]').count() else ''
    msg = pg.locator('.af-sheet #af-msg').input_value() if h2 else ''
    ok(h2 == 'Remind your friends', f'R4: the sheet is "Remind your friends" ({h2!r})')
    ok(msg.startswith('A reminder: testimony on') and 'Wed, Mar 18 at 9:30 AM' in msg and '/b/' in msg and 'via=share' not in msg,
       f'R4: the message is a reminder with the date and the share page ({msg[:140]!r})')
    ok(pg.locator('.af-sheet .af-yours').count() == 0, 'R4: no "Send yours first" in a reminder')
    pg.screenshot(path=os.path.join(OUT, 'r212_35_sheet.png'))
    pg.locator('.af-sheet [data-af="copy"]').first.click(); pg.wait_for_timeout(500)
    pg.locator('.af-sheet [data-af="close"]').first.click(); pg.wait_for_timeout(800)
    keys = pg.evaluate(KEYS)
    ok(not any(k.startswith('remind|') for k in keys), f'R4: sent, the reminder leaves the deck ({keys})')
    pg.reload(); pg.wait_for_selector('#main .hm', timeout=60000); pg.wait_for_timeout(1500)
    ok(not any(k.startswith('remind|') for k in pg.evaluate(KEYS)), 'R4: and stays gone after a reload')
    c.close()
    # R5: Not now
    c, pg = page(shared); pg.locator('#main [data-cm-remno]').click(); pg.wait_for_timeout(800)
    ok(not any(k.startswith('remind|') for k in pg.evaluate(KEYS)) and pg.evaluate(TITLE) != 'Closes tomorrow. Send a reminder?', f'R5: "Not now" takes it away ({pg.evaluate(TITLE)!r})')
    pg.reload(); pg.wait_for_selector('#main .hm', timeout=60000); pg.wait_for_timeout(1500)
    ok(not any(k.startswith('remind|') for k in pg.evaluate(KEYS)), 'R5: and stays gone after a reload')
    nn = pg.evaluate("() => Object.entries(localStorage).filter(([k]) => k.startsWith('hiphi_remind'))")
    c.close()
    # the next day, with what "Not now" kept (a new page: a later day's first load may open the welcome-back page instead)
    c, pg = page(shared, day='wed'); pg.evaluate("kv => { for (const [k, v] of kv) localStorage.setItem(k, v); }", nn); pg.reload(); pg.wait_for_selector('#main .hm', timeout=60000); pg.wait_for_timeout(1500)
    ok(bool(nn) and pg.evaluate(TITLE) == 'Closes today. Send a reminder?', f'R5: back once on the closing day ({nn}, {pg.evaluate(TITLE)!r})')
    c.close()
    # R2: shared, own testimony on HB 2121 not sent
    c, pg = page(own[:2] + [f"{e}|{eh}|share"]); keys = pg.evaluate(KEYS)
    ok(not any(k.startswith('remind|') for k in keys) and any(eh in k for k in keys), f'R2: their own testimony comes first, no reminder ({keys})')
    c.close()
    # R3: the practice Monday
    c, pg = page(shared, day='mon'); keys = pg.evaluate(KEYS)
    ok(not any(k.startswith('remind|') for k in keys), f'R3: two days ahead, no reminder ({keys})')
    c.close()
    # R6: today's Home
    # "What you did" names the two soonest hearings, so HB 2121's testimony alone
    c, pg = page([own[2], f"{e}|{eh}|share"], layout='today'); n = pg.locator('#main [data-hm-remind]').count()
    line = pg.locator('#main [data-hm-remind]').first.locator('xpath=ancestor::div[contains(@class,"hm-askf")]').inner_text() if n else ''
    ok(n == 1 and 'Testimony closes tomorrow at 9:30 AM. Send your friends a reminder?' in line, f'R6: today\'s Home offers it under what they did ({line!r})')
    c.close()
    # R7: a phone's own share menu (stubbed: headless Chromium has none): "Send the reminder" sends the reminder's words
    c, pg = page(shared); pg.evaluate("() => { window.__shared = []; navigator.share = async d => { window.__shared.push(d); }; }")
    pg.locator('#main [data-cm-remind]').click(); pg.wait_for_timeout(700)
    send = pg.locator('.af-sheet .af-send [data-af="sheet"]')
    ok(send.count() == 1 and send.inner_text().strip() == 'Send the reminder', f'R7: a phone\'s sheet sends "Send the reminder" ({send.inner_text().strip() if send.count() else ""!r})')
    pg.screenshot(path=os.path.join(OUT, 'r212_35_phone_sheet.png'))
    send.click(); pg.wait_for_timeout(900)
    sent = pg.evaluate("() => window.__shared")
    ok(len(sent) == 1 and sent[0]['text'].startswith('A reminder: testimony on') and 'sp=sheet' in sent[0]['url'] and pg.locator('.af-sheet[open]').count() == 0
       and not any(k.startswith('remind|') for k in pg.evaluate(KEYS)), f'R7: sent through the menu, the sheet closes and the slide is gone ({sent[:1]})')
    c.close()
    c, pg = page(shared, phone=False); pg.screenshot(path=os.path.join(OUT, 'r212_35_laptop.png')); c.close()
    ok(not errs, f'no page errors ({errs[:2]})')
    br.close()
print(f'{sum(res)}/{len(res)} passed')
sys.exit(0 if all(res) else 1)
