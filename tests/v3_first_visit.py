# R-362 part 2: version 3's first visit, trimmed (behind ?v3=1; pub/start.js FLOW_V3, pub/start-rest.js model2 / stepIssues / the road's
# last Next, pub/v2/road.js borrowed as it is). DESIGN C-1, C-5, B-2, B-12, C-13.
#   the order: the front door (Home, pub/v3/home.js) -> "Choose your issues" -> the topics -> Your issues, nothing ticked -> the island road,
#   four pages ("k of 4"), Skip always there -> Home. No profile or phone ask (it waits for the first action), no address, no welcome page.
#   checks: no issue starts ticked; Next with nothing ticked says so and stays; no phone or number box on any step; the strip names
#   "Your issues" and "Your voice" only; door -> Home in 12 taps or fewer; the last Next lands on #/ (Home, not the visit) with the
#   first visit marked done and the returner's Home (no "Choose your issues" door); "Leave, go to Home" on the topics lands on the door;
#   #/start/0 is the door; nothing counted for the try-both tests (no 'lock' or 'seen' in hiphi_ab, nothing sent to log_ab).
#   Until pub/v3/home.js lands the door is skipped (the test opens #/start/1 and counts its tap) and Home's own shape is not read.
# usage: python3 tests/v3_first_visit.py [BASE]   (BASE defaults to http://localhost:8832); SHOTS=<dir> saves phone and laptop pictures of each step
import os, re, sys, json
from playwright.sync_api import sync_playwright

BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832').split('/track.html')[0].rstrip('/')
SHOTS = os.environ.get('SHOTS') or ''
if SHOTS: os.makedirs(SHOTS, exist_ok=True)
URL = BASE + '/track.html?demo=1&v3=1'
fails = 0
def ok(cond, what):
  global fails
  print(('PASS ' if cond else 'FAIL ') + what)
  if not cond: fails += 1

PHONE = dict(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
LAPTOP = dict(viewport={'width': 1280, 'height': 800})
LOOK = """() => { const vis = e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && e.checkVisibility({ visibilityProperty: true }); };
  const h1 = document.getElementById('st-h') || document.querySelector('main h1');
  return { hash: location.hash, screen: document.body.dataset.screen, h1: h1 ? h1.innerText.trim() : '', main: (document.querySelector('main') || document.body).innerText,
    strip: [...document.querySelectorAll('.st-chapters .st-cl')].map(e => e.innerText.trim()), st: !!document.querySelector('main > .st'),
    tel: document.querySelectorAll('input[type=tel], input[inputmode=tel], input[inputmode=numeric], #st-aform').length,
    ticked: document.querySelectorAll('.st-pcard.on, [data-stpick][aria-pressed=true], [data-stfollowcat][aria-pressed=true]').length,
    picks: document.querySelectorAll('[data-stpick]').length, count: (document.getElementById('tr-count') || {}).innerText || '',
    skip: [...document.querySelectorAll('.st-bar [data-stskip]')].filter(vis).length, alert: (document.getElementById('st-alert') || {}).innerText || '',
    sx: document.scrollingElement.scrollWidth - innerWidth }; }"""
AB = """() => Object.keys(localStorage).filter(k => k.startsWith('hiphi_ab') && !k.startsWith('hiphi_ab_cfg')).map(k => localStorage.getItem(k)).join(' ')"""
WIZ = """() => { for (const k of ['hiphi_wiz_demo', 'hiphi_wiz']) { const v = localStorage.getItem(k); if (v) return JSON.parse(v); } return {}; }"""

def newpage(br, kw, sent, errs):
  ctx = br.new_context(reduced_motion='reduce', **kw); pg = ctx.new_page()
  pg.on('request', lambda r: sent.append(r.url) if re.search(r'log_ab|ab_event', r.url) else None)
  pg.on('pageerror', lambda e: errs.append(str(e)))
  return ctx, pg
def settle(pg, ms=900): pg.wait_for_timeout(ms)
def look(pg): return pg.evaluate(LOOK)
def shot(pg, name, tag):
  if SHOTS: pg.screenshot(path=os.path.join(SHOTS, f'{tag}-{name}.png'))
def door_there(pg):
  return pg.evaluate("() => !!(document.body.dataset.screen === 'home' && [...document.querySelectorAll('main a, main button')].find(e => /Choose your issues/.test(e.innerText) || (e.getAttribute('href') || '') === '#/start/1'))")

def walk(br, kw, tag):
  """the door to Home, every tap counted; returns the taps"""
  sent, errs, taps = [], [], []
  ctx, pg = newpage(br, kw, sent, errs)
  def tap(what, sel, nth=0, ms=900):
    pg.locator(sel).nth(nth).click(); taps.append(what); settle(pg, ms)
  pg.goto(URL + '&restart#/'); settle(pg, 2500)
  r = look(pg)
  ok(not r['hash'].startswith('#/start'), f'{tag}: a newcomer\'s #/ stays on #/ (the door), never the welcome ({r["hash"]})')
  has_door = door_there(pg)
  if has_door:
    shot(pg, '0-door', tag)
    pg.locator('main a, main button').filter(has_text='Choose your issues').first.click(); taps.append('Choose your issues'); settle(pg, 1500)
  else:
    print(f'NOTE {tag}: Home\'s front door (pub/v3/home.js) is not drawn yet; opening #/start/1 and counting its tap')
    pg.goto(URL + '#/start/1'); taps.append('Choose your issues (door)'); settle(pg, 2000)
  pg.wait_for_selector('.st-topics', timeout=30000); settle(pg, 600)
  r = look(pg)
  ok(r['hash'] == '#/start/1' and r['strip'] == ['Your issues', 'Your voice'], f'{tag}: the topics, the strip names Your issues and Your voice only ({r["hash"]}, {r["strip"]})')
  ok(r['tel'] == 0 and r['sx'] <= 0, f'{tag} topics: no phone or number box, no sideways scroll')
  ok('About 2 minutes' in r['main'] and '4 minutes' not in r['main'], f'{tag} topics: the time promise is the door\'s "About 2 minutes" (C-15)')
  shot(pg, '1-topics', tag)
  tap('a topic', '.st-tile', 0); tap('Next', '.st-bar [data-stnext]', 0, 2200)
  pg.wait_for_selector('[data-stpick]', timeout=30000); settle(pg, 600)
  r = look(pg)
  ok(r['picks'] > 0 and r['ticked'] == 0, f'{tag} Your issues: {r["picks"]} issues and none ticked (C-4, B-12)')
  ok('Tick the issues you care about.' in r['main'], f'{tag} Your issues: the lede says "Tick the issues you care about."')
  ok(r['tel'] == 0 and r['strip'] == ['Your issues', 'Your voice'], f'{tag} Your issues: no phone box, the strip ({r["strip"]})')
  shot(pg, '2-issues', tag)
  pg.locator('.st-bar [data-stnext]').click(); settle(pg, 700); r = look(pg)
  ok(r['hash'] == '#/start/2' and 'Tick at least one issue' in r['alert'], f'{tag} Your issues: Next with nothing ticked says so and stays ({r["alert"]!r})')
  tap('an issue', '[data-stpick]', 0)
  r = look(pg); ok(r['ticked'] >= 1, f'{tag} Your issues: the tapped issue shows ticked')
  tap('Follow 1 issue', '.st-bar [data-stnext]', 0, 2200)
  pg.wait_for_selector('#tr-count', timeout=30000); settle(pg, 900)
  for k in (1, 2, 3, 4):
    r = look(pg)
    ok(r['count'] == f'{k} of 4' and r['skip'] == 1 and r['tel'] == 0 and r['strip'] == ['Your issues', 'Your voice'] and r['sx'] <= 0,
       f'{tag} road page {k}: "{r["count"]}", Skip on screen, no phone box, the strip, no sideways scroll')
    if k in (3, 4):
      shot(pg, f'3-road{k}-ask', tag)
      pg.get_by_role('button', name='Email the chair' if k == 3 else 'Send testimony', exact=True).click(); taps.append('a choice'); settle(pg, 1200)
    shot(pg, f'3-road{k}', tag)
    pg.locator('.st-bar [data-stnext]').click(); taps.append('Next'); settle(pg, 1500)
  pg.wait_for_function("() => document.body.dataset.screen !== 'start'", timeout=15000); settle(pg, 1500)
  r = look(pg); w = pg.evaluate(WIZ)
  ok(r['hash'] == '#/' and not r['st'] and w.get('done') is True, f'{tag}: the road\'s last Next lands on #/ with the first visit done ({r["hash"]}, done={w.get("done")})')
  ok(r['tel'] == 0, f'{tag}: Home after the visit asks for no phone number')
  if has_door: ok(r['screen'] == 'home' and not door_there(pg), f'{tag}: Home is the returner\'s shape (no "Choose your issues" door)')
  shot(pg, '4-home', tag)
  ok(len(taps) <= 12, f'{tag}: door to Home in {len(taps)} taps (12 or fewer): {", ".join(taps)}')
  ab = pg.evaluate(AB)
  ok('lock' not in ab and 'seen' not in ab and not sent, f'{tag}: nothing counted for the try-both tests (hiphi_ab {ab[:80]!r}, sent {len(sent)})')
  ok(not errs, f'{tag}: no page errors ({errs[:2]})')
  # Back into Your issues later: the road is not taught again (wiz().why), the issues' Next goes straight Home
  pg.goto(URL + '#/start/1'); pg.wait_for_selector('.st-topics', timeout=30000); settle(pg, 600)
  if not pg.locator('.st-tile[aria-pressed=true], .st-tile.on').count(): pg.locator('.st-tile').nth(0).click(); settle(pg)
  pg.locator('.st-bar [data-stnext]').click(); pg.wait_for_selector('[data-stpick]', timeout=30000); settle(pg, 600)
  if not look(pg)['ticked']: pg.locator('[data-stpick]').nth(1).click(); settle(pg)
  pg.locator('.st-bar [data-stnext]').click(); settle(pg, 2500)
  r = look(pg); ok(r['hash'] == '#/' and not r['st'], f'{tag}: changing issues later goes straight Home, the road not taught again ({r["hash"]})')
  ctx.close()
  return taps

with sync_playwright() as p:
  br = p.chromium.launch()
  walk(br, PHONE, 'phone')
  walk(br, LAPTOP, 'laptop')
  # "Leave, go to Home" on the topics lands on the door; #/start/0 is the door too
  sent, errs = [], []
  ctx, pg = newpage(br, PHONE, sent, errs)
  pg.goto(URL + '&restart#/start/0'); settle(pg, 2500)
  r = look(pg); ok(not r['hash'].startswith('#/start') and not r['st'], f'#/start/0 is the door, not the old welcome ({r["hash"]})')
  pg.goto(URL + '#/start/1'); pg.wait_for_selector('.st-topics', timeout=30000); settle(pg, 600)
  pg.locator('.st-bar [data-stleave]').click(); settle(pg, 2000)
  r = look(pg); w = pg.evaluate(WIZ)
  ok(r['hash'] == '#/' and not r['st'] and not w.get('done'), f'"Leave, go to Home" on the topics lands on #/ (the door), the visit not marked done ({r["hash"]})')
  if pg.evaluate("() => document.body.dataset.screen === 'home' && !!document.querySelector('main h1')"):
    ok(door_there(pg), 'after Leave, Home is the front door (its "Choose your issues")')
  else: print('NOTE Home\'s front door is not drawn yet; its shape after Leave is not read')
  ab = pg.evaluate(AB)
  ok('lock' not in ab and 'seen' not in ab and not sent, f'Leave: nothing counted for the try-both tests ({ab[:80]!r})')
  ctx.close()
  # without the flag the welcome is still step 0 (today's visit unchanged)
  ctx, pg = newpage(br, PHONE, [], [])
  pg.goto(BASE + '/track.html?demo=1&restart#/'); pg.wait_for_selector('.st-hellopage', timeout=30000)
  ok(look(pg)['strip'] == [], 'without ?v3=1 a newcomer still gets the welcome (step 0)')
  ctx.close()
  br.close()
print(f'{fails} failed' if fails else 'all passed')
sys.exit(1 if fails else 0)
