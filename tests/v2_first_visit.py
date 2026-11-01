# R-357 Part 4 (Nate, 30 Oct 2026; the road since his note of 1 Nov): version 2's first visit, behind ?v2=1 (pub/start.js `v2()`, pub/start-rest.js
# `stepRoad`, pub/lessons.js `roadHTML` / `roadStart`, pub/v2/story.js). DESIGN C-12, C-13 (Nate's waiver of 1 Nov), C-14, B-12, B-2's new row.
#   v2 (?demo=1&v2=1&restart#/, a 375x812 phone): welcome, two topics, Your issues, ONE teaching screen "Where you come in" (the road: the bill at its
#     committee stop, two stops each with a full choice), the profile ask, the Mahalo cover, Home. Taps from the welcome to Home, counted and printed:
#     shortest 10: Let's begin, a topic, a second topic, Next, Follow N issues, Email the chair, Send testimony, Next, Skip this part (profile), See How I Can Help
#     longest 12: ... Follow N issues, Do nothing, Try emailing the chair, Do nothing, Try sending testimony, Next, ...
#     - in session the bill is the person's own when HIPHI supports it and it is at or before its hearing, else an example (?season=off: always an example)
#     - at every state: the heading, Skip on screen, Next hidden (not greyed) until the end, the first line names an issue (and "An example bill" for an
#       example), the words (heading + caption) at most 48, 16px or more, both choices one class and one size, no "DID NOT ADVANCE", nothing to scroll
#     - the scenes: need, no, c, no2, t; Reduce Motion shows each end state at once; Back from the profile ask shows the end state still
#     - the private counts: 'voice' viewed, 'answer' with lesson_step 1 and 2, 'next'; never a step the database does not know
#     - Your issues, the profile ask, the Mahalo cover (it holds still until pressed), a returner's change of issues (not taught again), a shared bill's visit
#   the story card (pub/v2/story.js); today's page (no v2): the story's four pages, the stamp and the old words are unchanged
#   nothing in the console but what the page always says
# usage: python3 tests/v2_first_visit.py [BASE]   (BASE defaults to http://localhost:8832)
import os, re, sys
from playwright.sync_api import sync_playwright

BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832').split('/track.html')[0].rstrip('/')
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out', 'v2_first_visit'); os.makedirs(OUT, exist_ok=True)
fails = 0
def ok(cond, what):
  global fails
  print(('PASS ' if cond else 'FAIL ') + what)
  if not cond: fails += 1

PHONE = dict(viewport={'width': 375, 'height': 812}, is_mobile=True, has_touch=True)
norm = lambda s: re.sub(r'\s+', ' ', (s or '').replace('’', "'").replace(' ', ' ')).strip()
# what is on the first-visit screen now: the heading, the words, the filled buttons in view, whether it fits the window
LOOK = """() => {
  const vis = e => { const r = e.getBoundingClientRect(); return e.checkVisibility({ visibilityProperty: true }) && r.width > 0 && r.height > 0; };
  const st = document.querySelector('main > .st'), h1 = document.getElementById('st-h');
  return { h1: h1 && h1.innerText.trim(), text: (document.querySelector('main') || document.body).innerText, over: document.scrollingElement.scrollHeight - innerHeight,
    filled: [...document.querySelectorAll('.btn.primary')].filter(vis).map(e => e.innerText.trim()), skip: [...document.querySelectorAll('[data-stskip]')].filter(vis).length,
    strip: [...document.querySelectorAll('.st-chapters .st-cl')].map(e => e.innerText.trim()),
    cls: st ? st.className : '', screen: document.body.dataset.screen, hash: location.hash }; }"""
# the road's state: its words, buttons (class and size), the scene, whether Next is on screen, whether anything is moving
ROAD = """() => {
  const vis = e => { const r = e.getBoundingClientRect(); return e.checkVisibility({ visibilityProperty: true }) && r.width > 0 && r.height > 0; };
  const px = e => parseFloat(getComputedStyle(e).fontSize), cap = document.querySelector('.lx-roadcap'), pic = document.getElementById('rd-pic'), h1 = document.getElementById('st-h');
  const doors = [...document.querySelectorAll('#rd-doors .lx-door')].filter(vis), nx = document.querySelector('.st-bar [data-stnext]'), sk = document.querySelector('.st-bar [data-stskip]');
  const bar = document.querySelector('.actionbar'), br = bar && getComputedStyle(bar).position === 'fixed' ? bar.getBoundingClientRect() : null, last = [...cap.querySelectorAll('.lx-door, #rd-q')].filter(vis).pop().getBoundingClientRect();
  const small = [...cap.querySelectorAll('p')].filter(vis).filter(e => px(e) < 16).map(e => e.innerText.slice(0, 20));
  const sv = pic && pic.getBoundingClientRect(), moving = pic ? document.getAnimations().filter(a => a.effect && a.effect.target && pic.contains(a.effect.target) && a.playState === 'running').length : -1;
  const ae = document.activeElement;
  return { h1: h1 && h1.innerText.trim(), tab: document.title, intro: cap.querySelector('.rd-intro').innerText.trim(), caption: [...cap.querySelectorAll('#rd-res, #rd-q')].filter(vis).map(e => e.innerText.trim()),
    btns: doors.map(b => [b.innerText.trim(), b.className, Math.round(b.getBoundingClientRect().width), Math.round(b.getBoundingClientRect().height), b.tagName]),
    scene: pic && pic.dataset.scene, picHidden: pic && pic.getAttribute('aria-hidden'), live: document.getElementById('rd-say').getAttribute('aria-live'),
    skipVis: !!sk && vis(sk), nextVis: !!nx && vis(nx), nextGreyed: !!nx && (nx.disabled || nx.getAttribute('aria-disabled') === 'true'), over: document.scrollingElement.scrollHeight - innerHeight,
    under: br ? Math.round(last.bottom - br.top) : 0, sx: document.scrollingElement.scrollWidth - innerWidth, small, picVis: !!sv && sv.width > 0 && sv.height > 0, picBox: sv && [Math.round(sv.left), Math.round(sv.right), Math.round(sv.height)],
    capBox: (r => [Math.round(r.left), Math.round(r.right)])(cap.getBoundingClientRect()), moving, stamp: /DID NOT ADVANCE/i.test(document.querySelector('main').innerText) || !!document.querySelector('#rd-pic .lx-pop rect + text'),
    stampDom: /DID NOT ADVANCE/.test(pic ? pic.innerHTML : ''), focus: ae ? (ae.id || ae.className || ae.tagName) : '', focusInCap: !!ae && cap.contains(ae) || (!!nx && ae === nx),
    h1vis: !!h1 && h1.getBoundingClientRect().height > 20, cls: document.querySelector('main > .st').className, strip: [...document.querySelectorAll('.st-chapters .st-cl')].map(e => e.innerText.trim()), hash: location.hash }; }"""
ISSUES = """() => [...document.querySelectorAll('.st-tsec')].map(sec => ({ name: sec.querySelector('.st-tname')?.innerText.trim(), cards: sec.querySelectorAll('.st-pcard').length,
  ticked: sec.querySelectorAll('.st-pcard.on').length, pressed: sec.querySelectorAll('[data-stpick][aria-pressed=true]').length }))"""
words = lambda *xs: sum(len(norm(x).split()) for x in xs)

# the five states of the road: the buttons each shows, the scene, whether Next is awake, and the words that must be there
STATES = {
  's1':  dict(btns=['Email the chair', 'Do nothing'], scene='need', next=False, has="waiting for a hearing. Chairs decide which bills get one, and they notice who writes in. What would you do?"),
  's1no': dict(btns=['Try emailing the chair'], scene='no', next=False, has="Nobody asked, so it waited. Without a hearing, it can't pass this year."),
  's2':  dict(btns=['Send testimony', 'Do nothing'], scene='c', next=False, has="Its hearing is set. What would you do?", res=True),
  's2no': dict(btns=['Try sending testimony'], scene='no2', next=False, has="With nothing sent, it can be held, and then it can't pass this year.", res=True),
  'end': dict(btns=[], scene='t', next=True, has="The committee reads testimony before it votes. Notes like yours can carry a bill on.", res=True),
}
RES = "Your note reaches the chair. A bill people write about is more likely to get a hearing."
def road_ok(pg, key, example, label, shots=None):
  """check one state of the road; returns the word count"""
  r = pg.evaluate(ROAD); S = STATES[key]; cap = [norm(x) for x in r['caption']]
  ok(r['h1'] == 'Where you come in' and r['tab'].startswith('Where you come in'), f"{label} {key}: the heading and the tab say Where you come in ({r['h1']!r}, {r['tab']!r})")
  ok(r['scene'] == S['scene'] and r['picHidden'] == 'true' and r['live'] == 'polite', f"{label} {key}: scene {r['scene']!r}, the drawing hidden from screen readers, the caption a polite live region")
  ok([b[0] for b in r['btns']] == S['btns'] and all(b[4] == 'BUTTON' for b in r['btns']), f"{label} {key}: the buttons are {S['btns']} ({[b[0] for b in r['btns']]})")
  if len(r['btns']) == 2: ok(r['btns'][0][1] == r['btns'][1][1] and r['btns'][0][2:4] == r['btns'][1][2:4], f"{label} {key}: the two choices are equal, one class and one size ({r['btns']})")
  ok(all(b[3] >= 44 and b[2] >= 44 for b in r['btns']), f"{label} {key}: 44px touch targets ({[b[2:4] for b in r['btns']]})")
  want = norm(S['has']); ok(any(c.endswith(want) for c in cap), f"{label} {key}: its words ({cap})")
  if S.get('res'): ok(RES in cap, f"{label} {key}: the first stop's one-line result stays ({cap})")
  else: ok(RES not in cap, f"{label} {key}: no result yet")
  if key in ('s2', 's2no', 'end'): ok(not any('What would you do' in c and 'waiting for a hearing' in c for c in cap), f"{label} {key}: the first stop's question and buttons have gone")
  ok(r['skipVis'], f"{label} {key}: Skip this part is on screen")
  ok(r['nextVis'] == S['next'] and not r['nextGreyed'], f"{label} {key}: Next is {'awake' if S['next'] else 'hidden, not greyed'} (visible {r['nextVis']})")
  n = words(r['h1'], r['intro'], *cap)
  ok(n <= 48, f"{label} {key}: {n} words on screen (heading + caption), at most 48")
  ok(not r['stamp'] and not r['stampDom'], f"{label} {key}: no DID NOT ADVANCE stamp")
  ok(not r['small'], f"{label} {key}: the caption is 16px or more ({r['small']})")
  ok(r['over'] <= 1 and r['under'] <= 1 and r['sx'] <= 0, f"{label} {key}: nothing to scroll, nothing under the bar, no sideways scroll ({r['over']}px over, {r['under']} under, {r['sx']} sideways; {r['cls']})")
  ok(r['picVis'] and r['h1vis'], f"{label} {key}: the drawing and the heading are in view")
  intro = norm(r['intro'])
  if key in ('s1', 's1no'):
    if example: ok(re.search(r'^An example bill, (HB|SB) \d+, (on one of your issues: .+|on the issue: .+|one HIPHI supports)\.$', intro), f"{label} {key}: the first line says it is an example and names an issue ({intro!r})")
    else: ok(re.search(r'^(HB|SB) \d+ is on one of your issues: .+\.$', intro) and 'example' not in intro, f"{label} {key}: the first line names the bill and an issue of theirs ({intro!r})")
  else: ok(re.search(r'^(An example bill: )?(HB|SB) \d+\.$', intro) and intro.startswith('An example bill') == example, f"{label} {key}: from the second stop the first line keeps only the bill ({intro!r})")
  if key == 's1' and example: ok(cap[0].startswith("Say it's waiting for a hearing."), f"{label} s1: an example bill says 'Say it's waiting' ({cap[:1]})")
  ok(r['strip'] == ['Your issues', 'Your voice', 'Your profile'], f"{label} {key}: the signpost stays on Your voice ({r['strip']})")
  if shots: pg.screenshot(path=shots)
  return n, r

def newpage(br, url, errs=None, kw=PHONE, returning=False, init=None):
  ctx = br.new_context(**kw); pg = ctx.new_page()
  if returning: ctx.add_init_script("const w = JSON.stringify({step: 9, issues: [], done: true}); localStorage.setItem('hiphi_wiz', w); localStorage.setItem('hiphi_wiz_demo', w)")
  if init: ctx.add_init_script(init)
  if errs is not None:
    pg.on('pageerror', lambda e: errs.append('pageerror ' + str(e)))
    pg.on('console', lambda m: errs.append('console ' + m.text) if m.type == 'error' else None)
  pg.goto(url); pg.wait_for_selector('main h1', timeout=40000); pg.wait_for_timeout(1200)
  return ctx, pg

def settle(pg, ms=1800): pg.wait_for_timeout(ms)
def to_road(pg, taps=None):
  """welcome -> the road, with the taps counted into taps"""
  def tap(what, sel, nth=0):
    pg.locator(sel).nth(nth).click(); taps is not None and taps.append(what); settle(pg, 900)
  tap("Let's begin", '.st-bar [data-stnext]'); tap('a topic', '.st-tile', 0); tap('a second topic', '.st-tile', 1); tap('Next', '.st-bar [data-stnext]'); settle(pg, 1800)
  tap('Follow N issues', '.st-bar [data-stnext]'); settle(pg, 1500)
def door(pg, name): pg.get_by_role('button', name=name, exact=True).click()

SHORT = [('Email the chair', 's2'), ('Send testimony', 'end')]
LONG = [('Do nothing', 's1no'), ('Try emailing the chair', 's2'), ('Do nothing', 's2no'), ('Try sending testimony', 'end')]

with sync_playwright() as pw:
  br = pw.chromium.launch()
  # ======================= version 2: the road, both paths, in session (the person's own bill) and between sessions (an example) =======================
  counts = {}
  for label, q, example in (('in session', '', False), ('between sessions', '&season=off', True)):
    for pname, path in (('shortest', SHORT), ('longest', LONG)):
      errs = []; ctx, pg = newpage(br, f'{BASE}/track.html?demo=1&v2=1&restart{q}#/', errs); taps = []
      r = pg.evaluate(LOOK)
      ok(r['h1'] and 'Your voice can shape' in r['h1'], f"[{label}, {pname}] the welcome is unchanged ({r['h1']!r})")
      to_road(pg, taps)
      r = pg.evaluate(LOOK)
      ok(r['h1'] == 'Where you come in' and '#/start/3' in r['hash'], f"[{label}, {pname}] Follow N issues goes to the road, before the profile ask ({r['h1']!r}, {r['hash']})")
      ex = example
      if not example:
        # in session the road uses the person's own bill only when HIPHI supports it and it is at or before its hearing; either way the words say which it is
        ex = pg.evaluate("document.querySelector('.rd-intro').innerText.startsWith('An example bill')")
      _, rr = road_ok(pg, 's1', ex, f'[{label}, {pname}]', os.path.join(OUT, f"{'off' if example else 'in'}-{pname}-s1.png"))
      for what, state in path:
        door(pg, what); taps.append(what); settle(pg, 1600)
        _, rr = road_ok(pg, state, ex, f'[{label}, {pname}]', os.path.join(OUT, f"{'off' if example else 'in'}-{pname}-{state}.png"))
        # focus goes to the new words, or to the one new button, never lost
        ok(rr['focusInCap'], f"[{label}, {pname}] {state}: focus moved to the new words or button, not lost ({rr['focus']})")
      pg.locator('.st-bar [data-stnext]').click(); taps.append('Next'); settle(pg, 1800)
      r = pg.evaluate(LOOK)
      ok(r['h1'] == 'Save your profile', f"[{label}, {pname}] Next goes to the profile ask ({r['h1']!r})")
      ok(r['over'] <= 1 and 'Three sentences in your own words is enough.' in norm(r['text']) and 'When a bill on your issues gets a hearing, we\'ll tell you.' in norm(r['text']), f"[{label}, {pname}] the profile ask's lede is the plan, and it fits ({r['over']}px over)")
      pg.screenshot(path=os.path.join(OUT, f"{'off' if example else 'in'}-{pname}-profile.png"))
      pg.locator('.st-bar [data-stskip]').click(); taps.append('Skip this part (the profile ask)')
      pg.wait_for_selector('.st-cover .st-cvgo', timeout=4000)
      pg.wait_for_timeout(1800)
      pg.locator('.st-cover .st-cvgo').click(); taps.append('See How I Can Help')
      pg.wait_for_selector('.st-cover', state='detached', timeout=9000); settle(pg, 600)
      r = pg.evaluate(LOOK)
      counts[(label, pname)] = len(taps)
      want = 10 if pname == 'shortest' else 12
      ok(len(taps) == want and r['hash'] == '#/' and r['screen'] == 'home', f"[{label}, {pname}] {len(taps)} taps from the welcome to Home (want {want}): {taps}")
      print(f"   TAPS [{label}, {pname}]: {len(taps)}")
      ok(not errs, f"[{label}, {pname}] nothing in the console but what the page always says ({errs[:2]})")
      ctx.close()

  # ======================= the walk that holds the rest of the first visit's checks (the same as before the road) =======================
  errs = []; ctx, pg = newpage(br, f'{BASE}/track.html?demo=1&v2=1&restart#/', errs)
  pg.locator('.st-bar [data-stnext]').click(); settle(pg, 900)
  ok(pg.locator('.st-tile').count() >= 2, 'the topics are unchanged: tiles to pick from')
  pg.locator('.st-tile').nth(0).click(); pg.locator('.st-tile').nth(1).click(); settle(pg, 500)
  pg.locator('.st-bar [data-stnext]').click(); settle(pg, 1800)
  r = pg.evaluate(LOOK); sec = pg.evaluate(ISSUES)
  ok(r['h1'] == 'Your issues', f"Your issues ({r['h1']!r})")
  ok(len(sec) == 2 and all(s['cards'] >= 2 and s['ticked'] == 2 and s['pressed'] == 2 for s in sec), f"exactly two issues ticked under each topic shown (at least one): {sec}")
  ok('The two most active under each topic are ticked; change them as you like' in norm(r['text']), 'the line under the heading says what the ticks are')
  ok(r['filled'] == ['Follow 4 issues'], f"the button counts them: {r['filled']}")
  pg.screenshot(path=os.path.join(OUT, 'issues.png'))
  pg.locator('.st-bar [data-stnext]').click(); settle(pg, 2200)
  # Back is Your issues, with what was ticked kept; forward again comes to the road, not the second of two screens
  pg.locator('.st-back').first.click(); settle(pg, 1500)
  r = pg.evaluate(LOOK); sec = pg.evaluate(ISSUES)
  ok(r['h1'] == 'Your issues' and all(s['ticked'] == 2 for s in sec), 'Back from the road is Your issues, ticks kept')
  pg.locator('.st-bar [data-stnext]').click(); settle(pg, 2200)
  ok(pg.evaluate(LOOK)['h1'] == 'Where you come in', 'Follow N issues again comes back to the road (the follow is the same)')
  # Skip on the road goes to the profile ask without finishing it, and the ask is there
  pg.locator('.st-bar [data-stskip]').click(); settle(pg, 1800)
  r = pg.evaluate(LOOK)
  ok(r['h1'] == 'Save your profile', f"Skip this part on the road goes to the profile ask ({r['h1']!r})")
  pg.locator('.st-bar [data-stskip]').click()
  pg.wait_for_selector('.st-cover .st-cvgo', timeout=4000); pg.wait_for_timeout(1800)
  pg.screenshot(path=os.path.join(OUT, 'cover.png'))
  pg.wait_for_timeout(2600)   # longer than the 2.8 s the cover once stayed: it holds
  hold = pg.evaluate("() => ({ cover: !!document.querySelector('.st-cover'), screen: document.body.dataset.screen, focus: document.activeElement?.className || '', dialog: document.querySelector('.st-cover')?.getAttribute('role'), inert: !!document.getElementById('app')?.inert })")
  ok(hold['cover'] and hold['screen'] == 'start' and 'st-cvgo' in hold['focus'], f"the cover holds still with its button: nothing moved on by itself after 4.4 s, focus on the button ({hold})")
  ok(hold['dialog'] == 'dialog' and hold['inert'], 'it is a dialog and the page under it is out of reach until it leaves')
  pg.mouse.click(40, 300); pg.keyboard.press('Tab'); pg.wait_for_timeout(500)
  ok(pg.evaluate("() => !!document.querySelector('.st-cover') && document.activeElement.classList.contains('st-cvgo')"), 'a tap elsewhere on it does nothing, and Tab stays on the button')
  ok(norm(pg.locator('.st-cover .st-cvgo').inner_text()) == 'See How I Can Help', 'the Mahalo cover carries the first visit\'s last button, See How I Can Help')
  pg.locator('.st-cover .st-cvgo').click()
  pg.wait_for_selector('.st-cover', state='detached', timeout=9000); settle(pg, 600)
  r = pg.evaluate(LOOK)
  ok(r['hash'] == '#/' and r['screen'] == 'home' and not pg.evaluate("() => document.getElementById('app').inert"), f"Home arrives on the tap, and the page is live again ({r['hash']}, {r['screen']})")
  pg.screenshot(path=os.path.join(OUT, 'home.png'))
  # back at Home: a returner changes their issues (#/start/1): not taught again, not the story (Skip on the road counts as seen)
  pg.evaluate("location.hash = '#/start/1'"); settle(pg, 1500)
  pg.locator('.st-tile').first.click(); settle(pg, 300)
  pg.locator('.st-bar [data-stnext]').click(); settle(pg, 1800)
  pg.locator('.st-bar [data-stnext]').click(); settle(pg, 2200)
  r = pg.evaluate(LOOK)
  ok(r['h1'] != 'Where you come in' and not re.search(r'#/start/3$', r['hash']) and 'bill’s story' not in r['text'] and "story" not in (r['h1'] or '').lower(), f"changing the issues later does not teach again or open the story ({r['h1']!r}, {r['hash']})")
  ok(not errs, f"nothing in the console but what the page always says ({errs[:2]})")
  ctx.close()

  # Enter on the cover's button does the same as a tap (keyboard), and under Reduce Motion the cover still shows, standing still, with the same button
  for rm in ('no-preference', 'reduce'):
    errs = []; ctx, pg = newpage(br, f'{BASE}/track.html?demo=1&v2=1&restart#/', errs, kw=dict(PHONE, reduced_motion=rm))
    to_road(pg)
    for what, state in SHORT: door(pg, what); settle(pg, 700)
    pg.locator('.st-bar [data-stnext]').click(); settle(pg, 1800)
    pg.locator('.st-bar [data-stskip]').click(); pg.wait_for_selector('.st-cover .st-cvgo', timeout=4000); pg.wait_for_timeout(300 if rm == 'reduce' else 1500)
    if rm == 'reduce':
      st = pg.evaluate("() => { const t = document.querySelector('.st-cvtitle'), b = document.querySelector('.st-cvgo'), r = b.getBoundingClientRect(); return { title: t.innerText.trim(), op: getComputedStyle(b).opacity, bAnim: getComputedStyle(b).animationName, tAnim: getComputedStyle(t).animationName, vis: r.width > 0 && r.top >= 0 && r.bottom <= innerHeight }; }")
      ok(st['op'] == '1' and st['bAnim'] == 'none' and st['tAnim'] == 'none' and st['vis'], f"Reduce Motion: the cover shows without animation, the button there at once ({st})")
      pg.screenshot(path=os.path.join(OUT, 'cover-reduced.png'))
    pg.wait_for_timeout(1500)
    ok(pg.locator('.st-cover .st-cvgo').count() == 1, f"({rm}) the cover is still there, holding")
    pg.keyboard.press('Enter'); pg.wait_for_selector('.st-cover', state='detached', timeout=9000); settle(pg, 500)
    ok(pg.evaluate("() => [location.hash, document.body.dataset.screen]") == ['#/', 'home'], f"({rm}) Enter on See How I Can Help lands on Home")
    ok(not errs, f"({rm}) nothing in the console but what the page always says ({errs[:2]})")
    ctx.close()

  # Reduce Motion on the road itself: each tap shows its end state at once (nothing is running a moment after it), the same words and buttons
  errs = []; ctx, pg = newpage(br, f'{BASE}/track.html?demo=1&v2=1&restart&season=off#/', errs, kw=dict(PHONE, reduced_motion='reduce'))
  to_road(pg)
  for what, state in LONG:
    door(pg, what); pg.wait_for_timeout(250)
    r = pg.evaluate(ROAD)
    ok(r['scene'] == STATES[state]['scene'] and r['moving'] == 0 and [b[0] for b in r['btns']] == STATES[state]['btns'], f"Reduce Motion: after {what!r} the {state} state stands at once, nothing moving ({r['scene']}, moving {r['moving']})")
  ok(pg.evaluate(ROAD)['nextVis'], 'Reduce Motion: Next is awake at the end')
  ok(not errs, f"Reduce Motion: nothing in the console ({errs[:2]})")
  ctx.close()

  # the motion itself (no preference): a tap starts something that moves and ends on the scene; each animation is under a second
  errs = []; ctx, pg = newpage(br, f'{BASE}/track.html?demo=1&v2=1&restart&season=off#/', errs)
  to_road(pg)
  door(pg, 'Email the chair'); pg.wait_for_timeout(150)
  ok(pg.evaluate(ROAD)['moving'] > 0, 'a tap on Email the chair moves the picture (mail flies in, the calendar fills)')
  durs = pg.evaluate("() => document.getAnimations().filter(a => document.getElementById('rd-pic').contains(a.effect.target)).map(a => a.effect.getTiming().duration)")
  ok(durs and max(durs) <= 1000, f"every animation is under a second ({durs})")
  settle(pg, 1800)
  ok(pg.evaluate(ROAD)['moving'] == 0, 'and it has come to rest')
  ctx.close()

  # keyboard: the choices are real buttons; Enter on one does what a tap does and focus lands on the new words
  errs = []; ctx, pg = newpage(br, f'{BASE}/track.html?demo=1&v2=1&restart&season=off#/', errs)
  to_road(pg)
  pg.focus('#rd-doors .lx-door'); pg.keyboard.press('Enter'); settle(pg, 1500)
  r = pg.evaluate(ROAD)
  ok(r['scene'] == 'c' and r['focus'] == 'rd-q', f"Enter on Email the chair plays it, and focus is on the new words ({r['scene']}, {r['focus']})")
  ctx.close()

  # on a laptop the drawing stands beside the words, as the story's does; Next is under the words
  errs = []; ctx, pg = newpage(br, f'{BASE}/track.html?demo=1&v2=1&restart&season=off#/', errs, kw=dict(viewport={'width': 1280, 'height': 800}))
  to_road(pg)
  r = pg.evaluate(ROAD)
  ok(r['picBox'][1] <= r['capBox'][0] + 4, f"laptop: the drawing is left of the words ({r['picBox']} {r['capBox']})")
  pg.screenshot(path=os.path.join(OUT, 'laptop-s1.png'))
  for what, state in SHORT: door(pg, what); settle(pg, 1400)
  r = pg.evaluate(ROAD)
  ok(r['nextVis'] and r['over'] <= 1, f"laptop: Next wakes at the end and nothing scrolls ({r['over']}px over)")
  pg.screenshot(path=os.path.join(OUT, 'laptop-end.png'))
  ctx.close()

  # every state on the smallest windows checked (R-265: nothing scrolls, nothing under the bar): 320x568, 360x640, 390x664, 375x812, 390x844, and laptops
  for w, h in ((320, 568), (360, 640), (390, 664), (375, 812), (390, 844), (1280, 800), (1024, 768), (1280, 600)):
    errs = []; m = w < 700; ctx, pg = newpage(br, f'{BASE}/track.html?demo=1&v2=1&restart&season=off#/', errs, kw=dict(viewport={'width': w, 'height': h}, is_mobile=m, has_touch=m))
    to_road(pg)
    pg.evaluate("document.fonts.load('700 16px Lato')"); pg.evaluate("document.fonts.load('700 28px Poppins')"); pg.wait_for_timeout(400)
    states = [('s1', None)] + [(st, wh) for wh, st in LONG]
    for st, wh in states:
      if wh: door(pg, wh); pg.wait_for_timeout(1500)
      r = pg.evaluate(ROAD)
      ok(r['over'] <= 1 and r['under'] <= 1 and not r['small'] and (r['h1vis'] or (w, h) == (320, 568)) and r['picVis'] and r['sx'] <= 0, f"{w}x{h} {st}: fits, nothing under the bar, 16px or more, heading and drawing in view (at 320x568 the heading may go to screen readers, last), no sideways scroll ({r['over']} over, {r['under']} under; heading in view {r['h1vis']}; {r['cls']})")
      if (w, h) in ((320, 568), (375, 812)): pg.screenshot(path=os.path.join(OUT, f'{st}-{w}x{h}.png'))
    ok(pg.evaluate(ROAD)['skipVis'] and pg.evaluate(ROAD)['nextVis'], f"{w}x{h}: Skip and Next are both on screen at the end")
    ok(not errs, f"{w}x{h}: nothing in the console ({errs[:1]})")
    ctx.close()

  # no bill HIPHI supports at all: the road is drawn with no number, and nothing breaks
  errs = []; ctx, pg = newpage(br, f'{BASE}/track.html?demo=1&v2=1&restart&season=off#/', errs)
  pg.locator('.st-bar [data-stnext]').click(); settle(pg, 900); pg.locator('.st-tile').nth(0).click(); pg.locator('.st-tile').nth(1).click(); pg.locator('.st-bar [data-stnext]').click(); settle(pg, 2500)
  pg.evaluate("""async () => { const k = await import('./pub/kernel.js'); k.S.recapPool.bills.forEach(b => { b.hiphi_position = 'monitor'; }); (k.S.pool.bills || []).forEach(b => { b.hiphi_position = 'monitor'; }); }""")
  pg.locator('.st-bar [data-stnext]').click(); settle(pg, 2500)
  r = pg.evaluate(ROAD)
  ok(r['intro'] == 'A bill about your issues' and r['scene'] == 'need' and [b[0] for b in r['btns']] == ['Email the chair', 'Do nothing'], f"no supported bill: the road is drawn with no number ({r['intro']!r})")
  door(pg, 'Email the chair'); settle(pg, 1200)
  ok(pg.evaluate(ROAD)['scene'] == 'c' and not errs, f"and it still plays ({errs[:1]})")
  ctx.close()

  # the private counts (R-023 decision 8), read from the sandbox's own printout (?debug), never sent: the road is 'voice', each choice is an
  # 'answer' with the stop as lesson_step, and no step the database does not know is ever sent
  INIT = """window.__hiphiCountTests = true; window.__fv = []; window.__warn = [];
  (() => { const d = console.debug.bind(console), w = console.warn.bind(console);
    console.debug = (...a) => { if (a[0] === 'first visit (sandbox, not sent):') { try { window.__fv.push(JSON.parse(JSON.stringify(a[1]))); } catch (e) {} } return d(...a); };
    console.warn = (...a) => { window.__warn.push(String(a[0])); return w(...a); }; })();"""
  ctx = br.new_context(**PHONE); ctx.add_init_script(INIT); pg = ctx.new_page(); pg.goto(f'{BASE}/track.html?demo=1&v2=1&restart&debug#/'); pg.wait_for_selector('main h1', timeout=40000); pg.wait_for_timeout(1500)
  to_road(pg)
  for what, state in SHORT: door(pg, what); settle(pg, 900)
  pg.locator('.st-bar [data-stnext]').click(); settle(pg, 1800)
  ev = [(e['step'], e['event'], e.get('lesson_step')) for e in pg.evaluate('window.__fv')]
  warn = pg.evaluate('window.__warn')
  print('   counts:', ev)
  ok(('voice', 'view', None) in ev and ('voice', 'next', None) in ev, 'the road is counted as voice, viewed and left by Next')
  ok(('voice', 'answer', 1) in ev and ('voice', 'answer', 2) in ev, 'each stop\'s choice is counted as an answer on voice, with the stop as lesson_step (1, 2)')
  ok(not any(e[0] == 'chair' for e in ev) and not [w for w in warn if 'not a first-visit step' in w or 'not a first-visit' in w], f"no step or event the database does not know is sent ({warn[:1]})")
  ok([e[0] for e in ev if e[1] == 'view'] == ['arrive', 'topics', 'issues', 'voice', 'alerts'], f"the funnel sees the visit's screens in order: {[e[0] for e in ev if e[1] == 'view']}")
  # Back from the profile ask shows the road's end state, still: the same words, the scene at rest, Next awake
  pg.locator('.st-back').first.click(); settle(pg, 1500)
  rr = pg.evaluate(ROAD)
  ok(rr['scene'] == 't' and rr['nextVis'] and rr['moving'] == 0 and RES in [norm(x) for x in rr['caption']] and rr['btns'] == [], f"Back from the profile ask shows the road's end state, standing still ({rr['scene']}, moving {rr['moving']})")
  ctx.close()

  # a shared bill's visit: follow it, the profile ask, then Home (the story, Coming up and the recap are not in version 2)
  errs = []; ctx, pg = newpage(br, f'{BASE}/track.html?demo=1&v2=1&restart#/bill/HB2121', errs)
  pg.wait_for_timeout(1500)
  # the way a link newcomer's visit starts today is pub/bill.js viaStart: it sets the bill in the visit's state and opens #/start/1
  link = pg.evaluate("""async () => { const k = await import('./pub/kernel.js'); const b = [...Object.values(k.S.extra || {}), ...k.S.bills].find(b => b.bill_number === 'HB2121');
    const w = k.wizSet({ via: 'HB2121', viaId: b && b.id, viaName: 'HB 2121', step: 1 }); location.hash = '#/start/1'; return b && w.via; }""")
  settle(pg, 1800)
  r = pg.evaluate(LOOK)
  ok(link == 'HB2121' and 'Want us to tell you next time?' in r['text'], f"a shared bill's visit begins with the follow ask ({r['h1']!r})")
  pg.locator('.st-bar [data-stnext]').click(); settle(pg, 2000)
  r = pg.evaluate(LOOK)
  ok(r['h1'] == 'Save your profile', f"then the profile ask ({r['h1']!r})")
  pg.locator('.st-bar [data-stskip]').click(); settle(pg, 2500)
  r = pg.evaluate(LOOK)
  ok(r['hash'] == '#/' and r['screen'] == 'home', f"then Home, not the story ({r['hash']}, {r['screen']})")
  ctx.close()

  # ======================= the story card =======================
  errs = []; ctx, pg = newpage(br, f'{BASE}/track.html?demo=1&v2=1#/find', errs, returning=True)
  pg.wait_for_timeout(1500)
  before = pg.evaluate("() => ({ styles: document.querySelectorAll('style').length, links: document.querySelectorAll('link').length, mark: localStorage.getItem('hiphi_v2_story'), body: document.body.innerHTML.length })")
  card = pg.evaluate("""async () => { const m = await import('./pub/v2/story.js'); const c = m.storyCard(); return { keys: Object.keys(c), type: typeof c.wire, html: c.html, marked: m.storyMarked() }; }""")
  after = pg.evaluate("() => ({ styles: document.querySelectorAll('style').length, links: document.querySelectorAll('link').length, mark: localStorage.getItem('hiphi_v2_story'), body: document.body.innerHTML.length })")
  ok(before == after, f"importing the module and calling storyCard() touches no storage, styles or page: {before} -> {after}")
  ok(sorted(card['keys']) == ['html', 'wire'] and card['type'] == 'function', f"storyCard() returns {{ html, wire }}: {card['keys']}")
  h = norm(re.sub(r'<[^>]+>', ' ', re.sub(r'<style>.*?</style>', '', card['html'], flags=re.S)))
  ok('New here? How a bill becomes law' in h and 'Four short pages on your own bill · 2 min' in h and 'Read it' in h and 'Not now' in h, f"the card's words: {h!r}")
  ok('href="#/learn/story"' in card['html'], 'Read it opens the story page')
  # mounted: Not now removes it and keeps the mark; then no html
  shown = pg.evaluate("""async () => { const m = await import('./pub/v2/story.js'); const d = document.createElement('div'); d.id = 'story-test'; const c = m.storyCard(); d.innerHTML = '<p>a</p>' + c.html + '<p>b</p>';
    document.querySelector('main').prepend(d); c.wire(d); const card = d.querySelector('.story-v2'), r = card.getBoundingClientRect();
    const btns = [...card.querySelectorAll('.btn')].map(b => [b.innerText.trim(), Math.round(b.getBoundingClientRect().height)]); const filled = card.querySelectorAll('.btn.primary').length;
    return { w: Math.round(r.width), h: Math.round(r.height), btns, filled, bg: getComputedStyle(card).backgroundColor }; }""")
  ok(shown['filled'] == 0 and all(hh >= 44 for _, hh in shown['btns']), f"the card has no filled button and its two choices are 44px targets: {shown}")
  pg.screenshot(path=os.path.join(OUT, 'card.png'))
  pg.locator('#story-test [data-story-not]').click(); pg.wait_for_timeout(200)
  gone = pg.evaluate("""async () => { const m = await import('./pub/v2/story.js'); return { present: !!document.querySelector('.story-v2'), style: !!document.querySelector('#story-test style'), mark: localStorage.getItem('hiphi_v2_story'), again: m.storyCard().html }; }""")
  ok(not gone['present'] and not gone['style'] and gone['mark'] == '1' and gone['again'] == '', f"Not now hides the card for good: {gone['present']}, mark {gone['mark']}, html {gone['again']!r}")
  # Read it: the story page in the first visit's frame, Back and a last Done that returns to Home and marks it (a fresh mark)
  pg.evaluate("() => { localStorage.removeItem('hiphi_v2_story'); location.hash = '#/'; }"); settle(pg, 1500)
  pg.evaluate("() => { location.hash = '#/learn/story'; }"); pg.wait_for_selector('.st-learn .lx-story, .st-lesson .lx-story', timeout=15000); settle(pg, 1200)
  r = pg.evaluate(LOOK)
  ok(r['screen'] == 'learn' and pg.locator('[data-stlearnback]').count() == 1 and norm(pg.locator('[data-stlearnnext]').inner_text()) == 'Next', f"Read it's page: the story in the first visit's frame with Back and Next ({r['h1']!r})")
  for i in range(14):
    nx = pg.locator('[data-stlearnnext]')
    if nx.is_visible() and norm(nx.inner_text()) == 'Done': break
    if nx.is_visible(): nx.click(); settle(pg, 1300); continue
    # a choice stands before Next on the story's third and fourth pages (lessons.js): take the first door
    if pg.locator('.lx-ch').count() and pg.locator('.lx-ch').first.is_visible() and not pg.locator('.lx-ch[aria-pressed=true]').count(): pg.locator('.lx-ch').first.click()
    settle(pg, 1200)
  ok(norm(pg.locator('[data-stlearnnext]').inner_text()) == 'Done', 'the last button is Done')
  pg.locator('[data-stlearnnext]').click(); settle(pg, 1500)
  done = pg.evaluate("() => [location.hash, localStorage.getItem('hiphi_v2_story')]")
  ok(done == ['#/', '1'], f"Done returns to Home and hides the card for good: {done}")
  ok(not errs, f"nothing in the console but what the page always says ({errs[:2]})")
  ctx.close()

  # ======================= today's page: no v2 =======================
  errs = []; ctx, pg = newpage(br, f'{BASE}/track.html?demo=1&restart#/', errs)
  pg.locator('.st-bar [data-stnext]').click(); settle(pg, 900); pg.locator('.st-tile').nth(0).click(); pg.locator('.st-tile').nth(1).click(); pg.locator('.st-bar [data-stnext]').click(); settle(pg, 2200)
  r = pg.evaluate(LOOK); sec = pg.evaluate(ISSUES)
  ok(r['h1'] == 'Your issues' and 'We ticked 4 to start.' in norm(r['text']) and 'The two most active' not in r['text'] and sum(s['ticked'] for s in sec) == 4, f"today's issues step: four ticked, its own line ({[s['ticked'] for s in sec]})")
  pg.locator('.st-bar [data-stnext]').click(); settle(pg, 2200)
  r = pg.evaluate(LOOK)
  ok(r['h1'] == 'Save your profile', f"today's next step is the profile ask, not the teaching step ({r['h1']!r})")
  pg.locator('.st-bar [data-stskip]').click(); pg.wait_for_selector('.st-cover', timeout=4000); pg.wait_for_selector('.st-cover', state='detached', timeout=9000); settle(pg, 1500)
  ok(pg.locator('.st-cover .st-cvgo').count() == 0, 'the cover has no button in today\'s page')
  r = pg.evaluate(LOOK)
  ok('story' in norm(r['text']).lower() and r['hash'].startswith('#/start/'), f"after the profile ask comes the story ({r['h1']!r}, {r['hash']})")
  seen = [r['h1']]
  for i in range(14):
    if not re.search(r'#/start/', pg.url): break
    if pg.locator('.lx-ch').count() and pg.locator('.lx-ch').first.is_visible() and not pg.locator('.lx-ch[aria-pressed=true]').count(): pg.locator('.lx-ch').first.click(); settle(pg, 1200)
    if pg.locator('#fx-moment:not([hidden]) #fx-mgo').count(): pg.click('#fx-moment #fx-mgo'); settle(pg, 600); continue
    h = pg.evaluate("document.getElementById('st-h')?.innerText.trim()")
    if h and h != seen[-1]: seen.append(h)
    if h and h.startswith('You') and 'all set' in h: break
    pg.locator('.st-bar [data-stnext]').click(); settle(pg, 1500)
  ok(any('all set' in (h or '') for h in seen), f"today's page still ends on You're all set with its recap: {seen}")
  ok(not any('Where you come in' in (h or '') for h in seen), 'and never shows the road')
  ok(not errs, f"nothing in the console but what the page always says ({errs[:2]})")
  ctx.close()
  br.close()

print(f"\n{'ALL PASS' if not fails else str(fails) + ' FAILED'}   screenshots: {OUT}")
sys.exit(1 if fails else 0)
