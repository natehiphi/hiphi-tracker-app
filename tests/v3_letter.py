# R-362 Part 6: version 3's letter and Mahalo, behind ?v3=1 (pub/v2/letter.js under x.v3, pub/v2/letter.css, pub/v3/thanks.js,
#   pub/v3/thanks.css; helper.js's V3 hook). ?demo=1&v3=1#/bill/HB2121, "Send testimony", a newcomer on a phone:
#     - screen 1 asks two things only: the name and the town (exactly two boxes); the town goes in the letter ("I live in Hilo.") and
#       in what is sent, and survives closing and reopening the letter (then shown as plain text with "change")
#     - "Write your own words instead" swaps the points for one empty box with the cursor in it; "Use HIPHI's points" brings them back,
#       and the words come back when they switch again; what is sent is their words, without HIPHI's points
#     - from the bill's button to sent is at most 4 taps (button, Next, Open the Capitol page, I already sent it)
#     - the Mahalo: "Mahalo, <first>!", one filled button in view, no friend card, no next-up, no story or quote card, no milestones;
#       the follow line with Undo, Undo unfollows (and "Follow it again" follows again); the alerts card comes after the follow line
#       (before and after Undo), its answers in the bar; "Not now" leaves Done alone; nobody with a profile (a saved number) sees it;
#       someone who followed the issue before sending is told they follow it already, with no Undo (the send started no follow)
#     - phone 390x844 and laptop 1280x800, no sideways scroll; nothing in the console but what the page always says
# usage: python3 tests/v3_letter.py [BASE]   (BASE defaults to http://localhost:8832); V3_LETTER_OUT=<folder> saves the screenshots
import os, re, sys
from playwright.sync_api import sync_playwright

BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832').split('/track.html')[0].rstrip('/')
URL = BASE + '/track.html?demo=1&v3=1#/bill/HB2121'
OUT = os.environ.get('V3_LETTER_OUT')
fails = 0
def ok(cond, what):
  global fails
  print(('PASS ' if cond else 'FAIL ') + what)
  if not cond: fails += 1
def shot(pg, name):
  if OUT: os.makedirs(OUT, exist_ok=True); pg.screenshot(path=os.path.join(OUT, name + '.png'))
def norm(t): return re.sub(r'\s+', ' ', (t or '').replace('’', "'").replace('\xa0', ' ')).strip()

PHONE = dict(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
LAPTOP = dict(viewport={'width': 1280, 'height': 800})
SCREEN = "() => document.querySelector('#hp-dlg .hp-frame')?.dataset.screen || ''"
INPUTS = "() => [...document.querySelectorAll('#hp-dlg .hp-in input:not([type=hidden]), #hp-dlg .hp-in textarea, #hp-dlg .hp-in select')].filter(e => e.checkVisibility()).map(e => e.id)"
FILLED = """() => { const d = document.querySelector('#hp-dlg'); return [...d.querySelectorAll('.btn.primary')].filter(e => { const r = e.getBoundingClientRect();
  return e.checkVisibility({ visibilityProperty: true }) && r.width > 0 && r.top < innerHeight && r.bottom > 0; }).map(e => e.innerText.trim()); }"""
OPEN = "() => document.querySelector('#hp-dlg [data-v2-part=open]')?.textContent || ''"
SENT = "() => document.querySelector('#hp-dlg .v2-sent')?.innerText || ''"
WIDE = "() => document.documentElement.scrollWidth > innerWidth + 1"
AFTER = "([a, b]) => { const x = document.querySelector(a), y = document.querySelector(b); return !!x && !!y && !!(x.compareDocumentPosition(y) & Node.DOCUMENT_POSITION_FOLLOWING); }"
PROFILE = """const t = JSON.stringify({ phone: '8085550123', token: 'test-token', confirmed: true }); localStorage.setItem('hiphi_text', t); localStorage.setItem('hiphi_text_demo', t);"""

def run(p, ctx_opts, name, init=''):
  ctx = p.chromium.launch().new_context(**ctx_opts); ctx.grant_permissions(['clipboard-read', 'clipboard-write'])
  if init: ctx.add_init_script(init)
  pg = ctx.new_page(); errs = []
  pg.on('pageerror', lambda e: errs.append(str(e)))
  pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'Failed to load resource' not in m.text else None)
  pg.goto(URL); pg.wait_for_selector('main button', timeout=20000); pg.wait_for_timeout(1200)
  return ctx, pg, errs

def open_letter(pg):
  pg.get_by_role('button', name=re.compile(r'^(Send testimony|Help me write testimony|Finish sending your testimony)$')).first.click()   # the second once a letter waits
  pg.wait_for_selector('#hp-dlg[open] .v2-paper', timeout=15000); pg.wait_for_timeout(300)

def send(pg, taps):
  pg.click('#hp-dlg .hp-foot [data-hp=next]'); taps.append('next'); pg.wait_for_function("() => document.querySelector('#hp-dlg .hp-frame')?.dataset.screen === 'v2s'", timeout=10000)
  pg.wait_for_timeout(300)

with sync_playwright() as p:
  # ---- A: a newcomer on a phone, the whole way to the Mahalo ----
  ctx, pg, errs = run(p, PHONE, 'A')
  taps = []
  open_letter(pg); taps.append('button')
  ok(pg.evaluate(SCREEN) == 'v2l', 'the testimony button opens version 3\'s letter (pub/v2/letter.js), screen v2l')
  ins = pg.evaluate(INPUTS)
  ok(ins == ['hp-name', 'hp-town'], f'screen 1 asks two things only, the name and the town: {ins}')
  ok(pg.locator('#v3-own').is_visible(), '"Write your own words instead" is under the points')
  ok(pg.locator('#hp-dlg .v2-pt').count() >= 2, 'the tappable points stay')
  ok(pg.locator('#v2-change').is_visible() and pg.locator('#v2-closing').count() == 1, 'the stance line and the sign-off tap stay')
  pg.fill('#hp-name', 'Leilani Kahale'); pg.fill('#hp-town', 'Hilo'); pg.wait_for_timeout(200)
  ok('I live in Hilo.' in pg.evaluate(OPEN), f'the town goes in the letter as it is typed: {norm(pg.evaluate(OPEN))!r}')
  shot(pg, 'letter_390')
  pg.locator('#hp-town').scroll_into_view_if_needed(); pg.wait_for_timeout(150); shot(pg, 'letter_sign_390')
  ok(not pg.evaluate(WIDE), 'screen 1: no sideways scroll at 390')
  send(pg, taps)
  ok('I live in Hilo.' in pg.evaluate(SENT), 'what is sent says "I live in Hilo."')
  ok(len(pg.evaluate(FILLED)) == 1, f'the send screen has one filled button in view: {pg.evaluate(FILLED)}')
  shot(pg, 'send_390')
  pg.click('#v2-copyopen'); taps.append('copyopen'); pg.wait_for_timeout(300)
  pg.click('#hp-dlg .hp-foot [data-hp=sent]'); taps.append('sent')
  pg.wait_for_selector('#hp-dlg #hp-done-t', timeout=15000); pg.wait_for_timeout(500)
  ok(len(taps) <= 4, f'from the bill\'s button to sent in {len(taps)} taps (at most 4): {taps}')
  ok(pg.evaluate("document.querySelector('#hp-dlg').getAttribute('aria-labelledby')") == 'hp-done-t', 'the dialog is named by the Mahalo\'s heading')
  ok(norm(pg.inner_text('#hp-done-t')) == 'Mahalo, Leilani!', f'the heading: {pg.inner_text("#hp-done-t")!r}')
  ok(pg.locator('#hp-dlg .v3-hero').count() == 1, 'the Mahalo is version 3\'s (pub/v3/thanks.js)')
  ok(len(pg.evaluate(FILLED)) == 1, f'the Mahalo has one filled button in view: {pg.evaluate(FILLED)}')
  gone = [c for c in ['.hp-friend', '.hp-nextup', '.hp-storyask', '.hp-quoteask', '.hp-next', '.hp-miles', '.hp-going'] if pg.locator('#hp-dlg ' + c).count()]
  ok(not gone, f'no friend card, next-up, story or quote card, What happens next, milestones: {gone}')
  ok(pg.locator('#v3-undo').is_visible() and 'follow' in pg.inner_text('#v3-follow'), f'the follow line, with Undo: {norm(pg.inner_text("#v3-follow"))!r}')
  ok(pg.locator('#hp-dlg .nudgecard').count() == 1, 'the alerts card shows after a first action')
  ok(pg.evaluate(AFTER, ['#v3-follow', '#hp-dlg .nudgecard']), 'the alerts card comes after the follow line')
  foot = norm(pg.inner_text('#hp-dlg .hp-foot'))
  ok('Not now' in foot and pg.locator('#hp-dlg .hp-foot button[form=hp-ng-form].primary').count() == 1, f'its answers are the bar\'s: {foot!r}')
  shot(pg, 'mahalo_390')
  ok(not pg.evaluate(WIDE), 'the Mahalo: no sideways scroll at 390')
  follows = "() => JSON.parse(localStorage.getItem('hiphi_issue_follows_demo') || '[]').length"
  before = pg.evaluate(follows)
  pg.click('#v3-undo'); pg.wait_for_selector('#v3-refollow', timeout=5000)
  ok('won' in pg.inner_text('#v3-follow') and pg.evaluate(follows) == before - 1, f'Undo unfollows the issue ({before} -> {pg.evaluate(follows)}): {norm(pg.inner_text("#v3-follow"))!r}')
  ok(pg.evaluate("document.activeElement?.id") == 'v3-refollow', 'the focus stays on the line\'s button')
  ok(pg.evaluate(AFTER, ['#v3-follow', '#hp-dlg .nudgecard']), 'after Undo the alerts card still comes after the follow line')
  shot(pg, 'mahalo_undo_390')
  pg.click('#v3-refollow'); pg.wait_for_selector('#v3-undo', timeout=5000)
  ok(pg.evaluate(follows) == before, 'Follow it again follows it again')
  pg.click('#hp-dlg .hp-foot [data-hp=ngno]'); pg.wait_for_timeout(300)
  ok(pg.locator('#hp-dlg .nudgecard').count() == 0 and pg.evaluate(FILLED) == ['Done'], f'"Not now": the card goes, the bar is Done alone: {pg.evaluate(FILLED)}')
  ok(not errs, f'no errors in the console: {errs[:3]}')
  ctx.close()

  # ---- B: their own words, and the town after a reopen ----
  ctx, pg, errs = run(p, PHONE, 'B')
  open_letter(pg)
  first_pt = norm(pg.locator('#hp-dlg .v2-pt .v2-ptt').first.evaluate("e => [...e.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('')"))
  pg.fill('#hp-name', 'Kai Akana'); pg.fill('#hp-town', 'Hilo')
  pg.click('#v3-own'); pg.wait_for_selector('#hp-why', timeout=5000)
  ok(pg.locator('#hp-dlg .v2-pt').count() == 0, 'own words: the points give way')
  ok(pg.input_value('#hp-why') == '' and pg.evaluate("document.activeElement?.id") == 'hp-why', 'own words: one empty box, the cursor in it')
  ok(pg.locator('#v3-points').is_visible(), '"Use HIPHI\'s points" is there to go back')
  shot(pg, 'ownwords_390')
  pg.click('#hp-dlg .hp-foot [data-hp=next]'); pg.wait_for_timeout(300)
  ok(pg.evaluate(SCREEN) == 'v2l' and pg.locator('#hp-why[aria-invalid=true]').count() == 1, 'Next with an empty box stops at the box with a plain message')
  pg.fill('#hp-why', 'My nephew started on these at fourteen')
  pg.click('#v3-points'); pg.wait_for_selector('#hp-dlg .v2-pt', timeout=5000)
  ok(pg.locator('#hp-why').count() == 0 and pg.locator('#hp-dlg .v2-pt:not(.out)').count() >= 1, 'Use HIPHI\'s points: the points are back, the box is gone')
  pg.click('#v3-own'); pg.wait_for_selector('#hp-why', timeout=5000)
  ok(pg.input_value('#hp-why') == 'My nephew started on these at fourteen', 'switching back brings their words back')
  send(pg, [])
  sent = norm(pg.evaluate(SENT))
  ok('My nephew started on these at fourteen.' in sent and first_pt[:40] not in sent, 'what is sent is their words, without HIPHI\'s points')
  ok('I live in Hilo.' in sent, 'and their town')
  pg.click('#hp-dlg .hp-foot [data-hp=later]'); pg.wait_for_function("() => !document.querySelector('#hp-dlg[open]')", timeout=10000); pg.wait_for_timeout(500)
  open_letter(pg)
  ok(pg.evaluate(SCREEN) in ('v2l', 'v2s'), f'the letter reopens where it was left: {pg.evaluate(SCREEN)}')
  if pg.evaluate(SCREEN) == 'v2s': pg.click('#v2-changeit'); pg.wait_for_selector('#hp-dlg .v2-paper [data-v2-part=open]', timeout=5000)
  ok('I live in Hilo.' in pg.evaluate(OPEN) and norm(pg.locator('#hp-dlg .v3-town').inner_text()).startswith('Hilo'), 'the town survives a reopen (plain text with "change")')
  ok(pg.locator('#hp-why').count() == 1 and pg.input_value('#hp-why').startswith('My nephew'), 'their own words survive a reopen')
  pg.click('#v3-retown'); pg.wait_for_selector('#hp-town', timeout=5000)
  ok(pg.input_value('#hp-town') == 'Hilo', '"change" opens the town box with the town in it')
  ok(not errs, f'no errors in the console: {errs[:3]}')
  ctx.close()

  # ---- C: someone with a profile (a saved number): no alerts card, the bar is Done ----
  ctx, pg, errs = run(p, PHONE, 'C', PROFILE)
  open_letter(pg); pg.fill('#hp-name', 'Malia Cruz'); send(pg, [])
  pg.click('#hp-dlg .hp-foot [data-hp=sent]'); pg.wait_for_selector('#hp-dlg #hp-done-t', timeout=15000); pg.wait_for_timeout(400)
  ok(pg.locator('#hp-dlg .nudgecard').count() == 0, 'with a profile there is no alerts card')
  ok(pg.evaluate(FILLED) == ['Done'], f'the bar is Done, the one filled button: {pg.evaluate(FILLED)}')
  ok(not errs, f'no errors in the console: {errs[:3]}')
  ctx.close()

  # ---- E: the issue followed before the send: "You follow ... already", no Undo (helper.js marks only the follow the send made) ----
  ctx, pg, errs = run(p, PHONE, 'E', PROFILE + "localStorage.setItem('hiphi_issue_follows_demo', JSON.stringify(['66a32660-b0a7-4a90-a71f-231963619b44']));")
  open_letter(pg); pg.fill('#hp-name', 'Malia Cruz'); send(pg, [])
  pg.click('#hp-dlg .hp-foot [data-hp=sent]'); pg.wait_for_selector('#hp-dlg #hp-done-t', timeout=15000); pg.wait_for_timeout(400)
  line = norm(pg.inner_text('#v3-follow'))
  ok('already' in line and pg.locator('#v3-undo').count() == 0, f'followed before the send: says so, no Undo: {line!r}')
  shot(pg, 'mahalo_followed_390')
  ok(not errs, f'no errors in the console: {errs[:3]}')
  ctx.close()

  # ---- D: the laptop ----
  ctx, pg, errs = run(p, LAPTOP, 'D')
  open_letter(pg)
  ok(pg.evaluate(INPUTS) == ['hp-name', 'hp-town'], 'laptop: the same two boxes')
  pg.fill('#hp-name', 'Leilani Kahale'); pg.fill('#hp-town', 'Hilo'); shot(pg, 'letter_1280')
  ok(not pg.evaluate(WIDE), 'laptop: no sideways scroll')
  send(pg, []); shot(pg, 'send_1280')
  pg.click('#hp-dlg .hp-foot [data-hp=sent]'); pg.wait_for_selector('#hp-dlg #hp-done-t', timeout=15000); pg.wait_for_timeout(500)
  ok(len(pg.evaluate(FILLED)) == 1, f'laptop Mahalo: one filled button: {pg.evaluate(FILLED)}')
  shot(pg, 'mahalo_1280')
  ok(not errs, f'no errors in the console: {errs[:3]}')
  ctx.close()

print('\nALL PASS' if not fails else f'\n{fails} FAILED')
sys.exit(1 if fails else 0)
