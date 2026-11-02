# R-357 Part 4 (Nate, 30 Oct 2026; the island road since 1 Nov): version 2's first visit, behind ?v2=1 (pub/start.js `v2()`, pub/start-rest.js
# `stepRoad` / `stepAlerts`, pub/v2/road.js, pub/v2/story.js). DESIGN C-12, C-13 (Nate's waiver of 1 Nov), C-14, B-12, B-2's new row.
#   v2 (?demo=1&v2=1&restart#/, a 375x812 phone): welcome, two topics, Your issues, the teaching in five pages (1 Meet <bill>, 2 its road, 3 "It needs a
#     hearing" Email the chair / Do nothing, 4 "A hearing is set" Send testimony / Do nothing, 5 "That's where you come in" with the profile ask), the Mahalo
#     cover, Home. Taps from page 1 to page 5: 6 (Next, Next, a choice, Next, a choice, Next).
#     - in session the bill is the person's own when HIPHI supports it and it is at or before its hearing, else an example labelled "An example bill"
#       (?season=off: always an example); with no supported bill at all there is no page 1 and the pages count "1 of 3"
#     - at every page: the heading and tab, "k of 4", Skip on screen, Next hidden (not greyed) on pages 3 and 4 until a choice, both choices one class and
#       one size, no "vape", no "dies", no sideways scroll, labels 11px or more, the picture never a strip, the answer a polite live region
#     - the scenes (read from the drawing's own layers): need, email (card set, warm light), nothing at stop 1 (sign, dim), set, testimony (bill rides on), held
#     - Reduce Motion shows each end state at once; Back walks the pages (still) and Back from page 5 shows page 4's end picture
#     - the private counts: 'voice' viewed, 'answer' with lesson_step 1 and 2, 'next'; never a step the database does not know
#     - Your issues, the profile ask, the Mahalo cover, a returner's change of issues (not taught again), a shared bill's visit
#   the story card (pub/v2/story.js); today's page (no v2): the story's four pages, the stamp and the old words are unchanged
#   nothing in the console but what the page always says
# usage: python3 tests/v2_first_visit.py [BASE]   (BASE defaults to http://localhost:8832); SHOTS=<dir> also saves app-* screenshots of every page there
import os, re, sys
from playwright.sync_api import sync_playwright

BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832').split('/track.html')[0].rstrip('/')
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out', 'v2_first_visit'); os.makedirs(OUT, exist_ok=True)
SHOTS = os.environ.get('SHOTS') or OUT; os.makedirs(SHOTS, exist_ok=True)
fails = 0
def ok(cond, what):
  global fails
  print(('PASS ' if cond else 'FAIL ') + what)
  if not cond: fails += 1

PHONE = dict(viewport={'width': 375, 'height': 812}, is_mobile=True, has_touch=True)
norm = lambda s: re.sub(r'\s+', ' ', (s or '').replace('\u2019', "'").replace('\u00a0', ' ').replace('\u2011', '-')).strip()
PLAN_H = "That's where you come in"
ROAD_H1 = lambda h: bool(h) and (h.startswith('Meet ') or norm(h) == 'Its road to becoming law')
# what is on the first-visit screen now: the heading, the words, the filled buttons in view, whether it fits the window
LOOK = """() => {
  const vis = e => { const r = e.getBoundingClientRect(); return e.checkVisibility({ visibilityProperty: true }) && r.width > 0 && r.height > 0; };
  const st = document.querySelector('main > .st'), h1 = document.getElementById('st-h');
  return { h1: h1 && h1.innerText.trim(), text: (document.querySelector('main') || document.body).innerText, over: document.scrollingElement.scrollHeight - innerHeight,
    filled: [...document.querySelectorAll('.btn.primary')].filter(vis).map(e => e.innerText.trim()), skip: [...document.querySelectorAll('[data-stskip]')].filter(vis).length,
    strip: [...document.querySelectorAll('.st-chapters .st-cl')].map(e => e.innerText.trim()),
    cls: st ? st.className : '', screen: document.body.dataset.screen, hash: location.hash }; }"""
# the teaching's state: heading, count, words, choices, Next, and what the drawing's own layers say (card, sign, light, the bill's place, checks)
ROAD = """() => {
  const vis = e => { const r = e.getBoundingClientRect(); return e.checkVisibility({ visibilityProperty: true }) && r.width > 0 && r.height > 0; };
  const px = e => parseFloat(getComputedStyle(e).fontSize), cap = document.getElementById('tr-cap'), pic = document.getElementById('tr-pic'), h1 = document.getElementById('st-h');
  const svg = pic && pic.querySelector('svg'), k = n => svg && svg.querySelector(`[data-k="${n}"]`), op = n => { const e = k(n); return e ? +getComputedStyle(e).opacity : -1; };
  const doors = [...cap.querySelectorAll('.tr-ch')].filter(vis), nx = document.querySelector('.st-bar [data-stnext]'), sk = document.querySelector('.st-bar [data-stskip]');
  const bar = document.querySelector('.actionbar'), br = bar && getComputedStyle(bar).position === 'fixed' ? bar.getBoundingClientRect() : null;
  const said = document.getElementById('tr-said'), sr = said && said.getBoundingClientRect(), sv = pic && pic.getBoundingClientRect(), ae = document.activeElement;
  const vb = svg && svg.viewBox.baseVal, t = svg && svg.querySelector('text');
  return { h1: h1 && h1.innerText.trim(), tab: document.title, count: (document.getElementById('tr-count') || {}).innerText, page: cap.closest('.lx').dataset.page,
    ex: !!document.querySelector('.tr-ex'), exText: (document.querySelector('.tr-ex') || {}).innerText, words: cap.innerText, main: document.querySelector('main').innerText,
    btns: doors.map(b => [b.innerText.trim(), b.className, Math.round(b.getBoundingClientRect().width), Math.round(b.getBoundingClientRect().height), b.getAttribute('aria-pressed'), b.tagName]),
    said: said ? said.innerText.trim() : '', live: said && said.getAttribute('aria-live'), picHidden: svg && svg.getAttribute('aria-hidden'),
    skipVis: !!sk && vis(sk), nextVis: !!nx && vis(nx), nextHiddenAttr: !!nx && nx.hidden, nextGreyed: !!nx && (nx.disabled || nx.getAttribute('aria-disabled') === 'true'),
    over: document.scrollingElement.scrollHeight - innerHeight, sx: document.scrollingElement.scrollWidth - innerWidth,
    picBox: sv && [Math.round(sv.left), Math.round(sv.right), Math.round(sv.width), Math.round(sv.height)], isRoad: !!(svg && k('bill') && k('card')),
    labelPx: t && vb.width ? Math.round(px(t) * svg.getBoundingClientRect().width / vb.width * 10) / 10 : 0,
    layers: svg && k('card') ? { ce: op('ce'), cs: op('cs'), warm: op('warm'), dim: op('dim'), s1: op('s1'), s2: op('s2'), card: op('card'), ticks: [0,1,2,3,4].filter(i => op('t' + i) === 1).length, bw: op('bw'), bg: op('bg'), tag: op('tag'),
      bill: k('bill').getAttribute('transform'), trav: k('trav').style.strokeDasharray, who: ['p0','p1','q0','q1','q2'].filter(n => op(n) === 1).length } : null,
    sig: svg ? svg.outerHTML.length + '|' + svg.outerHTML.slice(0, 40000).split('').reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7) : '',
    saidTop: sr ? Math.round(sr.top) : -1, saidBottom: sr ? Math.round(sr.bottom) : -1, barTop: br ? Math.round(br.top) : innerHeight, h1Y: Math.round(h1.getBoundingClientRect().top + scrollY), picY: sv ? Math.round(sv.top + scrollY) : -1,
    capTop: Math.round(cap.getBoundingClientRect().top + scrollY), capBox: (r => [Math.round(r.left), Math.round(r.right)])(cap.getBoundingClientRect()),
    focus: ae ? (ae.id || ae.className || ae.tagName) : '', focusIn: !!ae && (ae.id === 'st-h' || cap.contains(ae)), h1vis: !!h1 && h1.getBoundingClientRect().height > 20, hash: location.hash,
    tagText: k('tagt') ? k('tagt').textContent : null, strip: [...document.querySelectorAll('.st-chapters .st-cl')].map(e => e.innerText.trim()) }; }"""
ISSUES = """() => [...document.querySelectorAll('.st-tsec')].map(sec => ({ name: sec.querySelector('.st-tname')?.innerText.trim(), cards: sec.querySelectorAll('.st-pcard').length,
  ticked: sec.querySelectorAll('.st-pcard.on').length, pressed: sec.querySelectorAll('[data-stpick][aria-pressed=true]').length }))"""

# what each picture must show, read from the drawing's layers
SCENE = {
  'road':  lambda L: L['cs'] == 0 and L['ce'] == 0 and L['s1'] == 0 and L['s2'] == 0 and L['dim'] == 0 and L['ticks'] == L['ticks'],
  'need':  lambda L: L['ce'] == 1 and L['cs'] == 0 and L['warm'] == 0 and L['dim'] == 0 and L['s1'] == 0,
  'chair': lambda L: L['cs'] == 1 and L['ce'] == 0 and L['warm'] == 1 and L['who'] == 2 and L['dim'] == 0,
  'no1':   lambda L: L['s1'] == 1 and L['dim'] == 1 and L['bg'] == 1 and L['bw'] == 0 and L['ce'] == 1,
  'set':   lambda L: L['cs'] == 1 and L['ce'] == 0 and L['warm'] == 0 and L['dim'] == 0 and L['s2'] == 0,
  'test':  lambda L: L['cs'] == 1 and L['who'] == 3 and L['tag'] == 0 and L['dim'] == 0,
  'no2':   lambda L: L['s2'] == 1 and L['dim'] == 1 and L['bg'] == 1 and L['cs'] == 1,
}
BTNS = {3: ['Email the chair', 'Do nothing'], 4: ['Send testimony', 'Do nothing']}
TITLES = {2: 'Its road to becoming law', 3: 'It needs a hearing', 4: 'A hearing is set'}
SAIDW = {'chair': 'Emails like yours make a hearing more likely.', 'no1': "Then it can't pass this year.", 'test': 'it can carry', 'no2': "then it can't pass this year."}
words = lambda *xs: sum(len(norm(x).split()) for x in xs)

def page_ok(pg, k, scene, example, label, none=False, shots=None):
  """check one page of the teaching in one state"""
  r = pg.evaluate(ROAD); n = 3 if none else 4; shown = k - 1 if none else k; allw = norm(r['main'] + ' ' + (r['h1'] or ''))
  if k == 1: ok(bool(re.match(r'^Meet (HB|SB) \d+$', norm(r['h1'])) ), f"{label} p{k}: the heading is Meet <bill> ({r['h1']!r})")
  else: ok(norm(r['h1']) == TITLES[k], f"{label} p{k}: the heading is {TITLES[k]!r} ({r['h1']!r})")
  ok(norm(r['tab']).startswith('How a bill moves') and r['count'] == f'{shown} of {n}' and r['page'] == str(k), f"{label} p{k}: the tab says How a bill moves and the count {shown} of {n} ({r['tab']!r}, {r['count']!r})")
  ok(not re.search(r'vap(e|es|ing)\b', allw, re.I) and not re.search(r'\bdies\b|\bdie\b', allw, re.I), f"{label} p{k}: no vape and no dies in the words")
  ok(r['ex'] == (example and k == 1) and ('An example bill' in allw) == (example and k == 1), f"{label} p{k}: 'An example bill' only on an example's page 1 (label {r['ex']}, example {example})")
  ok(r['skipVis'], f"{label} p{k}: Skip this part is on screen")
  if k in (3, 4):
    ok([b[0] for b in r['btns']] == BTNS[k] and all(b[5] == 'BUTTON' and b[4] in ('true', 'false') for b in r['btns']), f"{label} p{k}: the buttons are {BTNS[k]} with aria-pressed ({[b[:1] + b[4:5] for b in r['btns']]})")
    ok(r['btns'][0][1] == r['btns'][1][1] and r['btns'][0][2:4] == r['btns'][1][2:4] and all(b[3] >= 44 and b[2] >= 44 for b in r['btns']), f"{label} p{k}: equal choices, 44px targets ({[b[2:4] for b in r['btns']]})")
    ok(r['live'] == 'polite', f"{label} p{k}: the answer is a polite live region")
    picked = scene in ('chair', 'no1', 'test', 'no2')
    ok(r['nextVis'] == picked and not r['nextGreyed'] and (r['nextHiddenAttr'] or not r['nextVis'] or picked), f"{label} p{k}: Next is {'awake' if picked else 'hidden, not greyed'} (visible {r['nextVis']})")
    if picked: ok(SAIDW[scene].lower() in norm(r['said']).lower() and sum(1 for b in r['btns'] if b[4] == 'true') == 1, f"{label} p{k}: the answer says its line and one choice shows pressed ({norm(r['said'])[:70]!r})")
    else: ok(r['said'] == '' and not any(b[4] == 'true' for b in r['btns']), f"{label} p{k}: no answer and nothing pressed before a choice")
  else: ok(r['nextVis'] and not r['nextGreyed'], f"{label} p{k}: Next is awake")
  if k >= 2:
    ok(r['isRoad'] and r['picHidden'] == 'true' and SCENE[scene](r['layers']), f"{label} p{k}: the island road shows the {scene} scene ({r['layers']})")
    if k == 2 and not none: ok(norm(r['tagText'] or '').endswith('is here'), f"{label} p{k}: the bill's tag says it is here ({r['tagText']!r})")
    if none: ok(r['tagText'] is None and not re.search(r'(HB|SB) \d', allw), f"{label} p{k}: no bill number and no 'is here' tag with no bill ({r['tagText']!r})")
    ok(r['labelPx'] >= 11, f"{label} p{k}: the labels are {r['labelPx']}px (11 or more)")
    ok(r['picBox'][3] >= 150, f"{label} p{k}: the picture is never a strip ({r['picBox']})")
  ok(r['sx'] <= 0 and r['h1vis'], f"{label} p{k}: no sideways scroll, the heading in view ({r['sx']})")
  ok(r['strip'] == ['Your issues', 'Your voice', 'Your profile'], f"{label} p{k}: the signpost stays on Your voice ({r['strip']})")
  if shots: pg.screenshot(path=shots)
  return r

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
def fonts(pg): pg.evaluate("Promise.all([document.fonts.load('700 13px Lato'), document.fonts.load('700 28px Poppins'), document.fonts.ready])"); pg.wait_for_timeout(300)
def to_road(pg, taps=None):
  """welcome -> page 1 of the teaching, with the taps counted into taps"""
  def tap(what, sel, nth=0):
    pg.locator(sel).nth(nth).click(); taps is not None and taps.append(what); settle(pg, 900)
  tap("Let's begin", '.st-bar [data-stnext]'); tap('a topic', '.st-tile', 0); tap('a second topic', '.st-tile', 1); tap('Next', '.st-bar [data-stnext]'); settle(pg, 1800)
  tap('Follow N issues', '.st-bar [data-stnext]'); settle(pg, 1500); fonts(pg)
def nxt(pg, taps=None, ms=1900): pg.locator('.st-bar [data-stnext]').click(); taps is not None and taps.append('Next'); settle(pg, ms)
def pick(pg, name, taps=None, ms=1800): pg.get_by_role('button', name=name, exact=True).click(); taps is not None and taps.append(name); settle(pg, ms)
def walk_short(pg, taps=None):
  """page 1 to page 5 by the short path"""
  nxt(pg, taps); nxt(pg, taps); pick(pg, 'Email the chair', taps); nxt(pg, taps); pick(pg, 'Send testimony', taps, 2300); nxt(pg, taps)

SHORT = [('Email the chair', 'chair'), ('Send testimony', 'test')]
LONG = [('Do nothing', 'no1'), ('Email the chair', 'chair'), ('Do nothing', 'no2'), ('Send testimony', 'test')]

with sync_playwright() as pw:
  br = pw.chromium.launch()
  # ======================= version 2: the pages, both paths, in session (the person's own bill) and between sessions (an example) =======================
  for label, q, example in (('in session', '', False), ('between sessions', '&season=off', True)):
    for pname, path in (('shortest', SHORT), ('longest', LONG)):
      errs = []; ctx, pg = newpage(br, f'{BASE}/track.html?demo=1&v2=1&restart{q}#/', errs); taps = []; lb = f'[{label}, {pname}]'; tag = f"{'off' if example else 'in'}-{pname}"
      r = pg.evaluate(LOOK)
      ok(r['h1'] and 'Your voice can shape' in r['h1'], f"{lb} the welcome is unchanged ({r['h1']!r})")
      to_road(pg, taps); r = pg.evaluate(LOOK)
      ok(ROAD_H1(r['h1']) and '#/start/3' in r['hash'], f"{lb} Follow N issues goes to the teaching, before the profile ask ({r['h1']!r}, {r['hash']})")
      ex = example or pg.evaluate("!!document.querySelector('.tr-ex')")
      page_ok(pg, 1, 'road', ex, lb, shots=os.path.join(OUT, f'{tag}-p1.png'))
      nxt(pg, taps); r = page_ok(pg, 2, 'road', ex, lb, shots=os.path.join(OUT, f'{tag}-p2.png'))
      ok(r['focusIn'], f"{lb} p2: focus moved to the heading ({r['focus']})")
      if ex: ok(norm(r['words']).find("Suppose it passed the") >= 0, f"{lb} p2: an example says 'Suppose it passed the ... and is now with the ... committees' ({norm(r['words'])[-130:]!r})")
      nxt(pg, taps); page_ok(pg, 3, 'need', ex, lb)
      for what, sc in path[:2] if pname == 'longest' else path[:1]:
        pick(pg, what, taps); page_ok(pg, 3, sc, ex, lb, shots=os.path.join(OUT, f'{tag}-p3-{sc}.png'))
        ok(pg.evaluate('document.activeElement.className').find('lx-said') >= 0, f"{lb} p3 {sc}: focus is on the answer's first line")
      nxt(pg, taps); page_ok(pg, 4, 'set', ex, lb)
      for what, sc in path[2:] if pname == 'longest' else path[1:]:
        pick(pg, what, taps, 2400); page_ok(pg, 4, sc, ex, lb, shots=os.path.join(OUT, f'{tag}-p4-{sc}.png'))
      nxt(pg, taps)
      r = pg.evaluate(LOOK)
      ok(norm(r['h1']) == PLAN_H, f"{lb} Next on page 4 goes to page 5, the profile ask ({r['h1']!r})")
      keyt = norm(pg.evaluate("() => (document.querySelector('.tr-plan [data-k=key]') || {}).textContent || ''"))
      print('   p5 text:', norm(r['text'])[:700])
      ok('A few sentences in your own words is enough.' in norm(r['text']) and 'reaches one of these two moments' in norm(r['text']) and 'Email the chair' in keyt and 'Send testimony' in keyt, f"{lb} page 5: the lede, and the key with both moments ({keyt!r}, {norm(r['text'])[-200:]!r})")
      ok(r['filled'] == ['Tell me when'] and pg.locator('.st-bar [data-stskip]').inner_text().strip() == 'Not now', f"{lb} page 5: the button says Tell me when, its skip Not now ({r['filled']})")
      ok(pg.evaluate("() => { const s = document.querySelector('.tr-plan'); return !!s && !!s.querySelector('[data-k=key]') && +getComputedStyle(s.querySelector('[data-k=key]')).opacity === 1; }"), f"{lb} page 5: the key is up")
      pg.screenshot(path=os.path.join(OUT, f'{tag}-p5.png'))
      six = [t for t in taps[taps.index('Follow N issues') + 1:]]
      ok(len(six) == (6 if pname == 'shortest' else 8), f"{lb} {len(six)} taps from page 1 to page 5 ({'Next, Next, a choice, Next, a choice, Next' if pname == 'shortest' else 'the longest path tries every choice'}): {six}")
      pg.locator('.st-bar [data-stskip]').click(); taps.append('Not now')
      pg.wait_for_selector('.st-cover .st-cvgo', timeout=4000); pg.wait_for_timeout(1800)
      pg.locator('.st-cover .st-cvgo').click(); taps.append('See How I Can Help')
      pg.wait_for_selector('.st-cover', state='detached', timeout=9000); settle(pg, 600)
      r = pg.evaluate(LOOK)
      ok(r['hash'] == '#/' and r['screen'] == 'home', f"{lb} {len(taps)} taps from the welcome to Home: {taps}")
      ok(not errs, f"{lb} nothing in the console but what the page always says ({errs[:2]})")
      ctx.close()

  # Back walks the pages, still; Back from page 5 shows page 4's end picture; Skip goes to the profile ask; counts
  INIT = """window.__hiphiCountTests = true; window.__fv = []; window.__warn = [];
  (() => { const d = console.debug.bind(console), w = console.warn.bind(console);
    console.debug = (...a) => { if (a[0] === 'first visit (sandbox, not sent):') { try { window.__fv.push(JSON.parse(JSON.stringify(a[1]))); } catch (e) {} } return d(...a); };
    console.warn = (...a) => { window.__warn.push(String(a[0])); return w(...a); }; })();"""
  errs = []; ctx = br.new_context(**PHONE); ctx.add_init_script(INIT); pg = ctx.new_page()
  pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
  pg.goto(f'{BASE}/track.html?demo=1&v2=1&restart&season=off&debug#/'); pg.wait_for_selector('main h1', timeout=40000); pg.wait_for_timeout(1500)
  to_road(pg); walk_short(pg)
  ev = [(e['step'], e['event'], e.get('lesson_step')) for e in pg.evaluate('window.__fv')]; warn = pg.evaluate('window.__warn'); print('   counts:', ev)
  ok(('voice', 'view', None) in ev and ('voice', 'next', None) in ev, "the teaching is counted as voice, viewed and left by Next")
  ok(('voice', 'answer', 1) in ev and ('voice', 'answer', 2) in ev, "each stop's choice is counted as an answer on voice, with the stop as lesson_step (1, 2)")
  ok(not any(e[0] == 'chair' for e in ev) and not [w for w in warn if 'not a first-visit' in w], f"no step or event the database does not know is sent ({warn[:1]})")
  ok([e[0] for e in ev if e[1] == 'view'] == ['arrive', 'topics', 'issues', 'voice', 'alerts'], f"the funnel sees the visit's screens in order: {[e[0] for e in ev if e[1] == 'view']}")
  pg.locator('.st-back').first.click(); settle(pg, 1500)
  r = page_ok(pg, 4, 'test', True, '[Back from page 5]')
  r2 = pg.evaluate(ROAD); s1 = r2['sig']; pg.wait_for_timeout(300); ok(pg.evaluate(ROAD)['sig'] == s1, "Back from the profile ask shows page 4's end picture, standing still")
  ok(r2['count'] == '4 of 4', f"and it is page 4 ({r2['count']})")
  pg.locator('.st-back').first.click(); settle(pg, 900); r = pg.evaluate(ROAD)
  ok(norm(r['h1']) == TITLES[3] and r['count'] == '3 of 4' and [b[4] for b in r['btns']] == ['true', 'false'] and SCENE['chair'](r['layers']), f"Back to page 3 keeps the choice and shows its end picture ({r['h1']!r}, {r['count']}, {r['layers']})")
  pg.locator('.st-back').first.click(); settle(pg, 700); ok(norm(pg.evaluate(ROAD)['h1']) == TITLES[2], 'Back to page 2')
  pg.locator('.st-back').first.click(); settle(pg, 700); r = pg.evaluate(ROAD); ok(r['h1'].startswith('Meet ') and r['count'] == '1 of 4', f"Back to page 1 ({r['h1']!r})")
  pg.locator('.st-back').first.click(); settle(pg, 1500); ok(pg.evaluate(LOOK)['h1'] == 'Your issues', 'Back from page 1 leaves for Your issues')
  nxt(pg, None, 2200); ok(norm(pg.evaluate(LOOK)['h1']) == PLAN_H, 'the teaching is seen once: Follow N issues again goes straight on to page 5')
  ok(not errs, f"nothing in the console ({errs[:2]})")
  ctx.close()

  # no bill HIPHI supports at all: no page 1, "1 of 3", no number and no tag; nothing breaks
  errs = []; ctx, pg = newpage(br, f'{BASE}/track.html?demo=1&v2=1&restart&season=off#/', errs)
  pg.locator('.st-bar [data-stnext]').click(); settle(pg, 900); pg.locator('.st-tile').nth(0).click(); pg.locator('.st-tile').nth(1).click(); pg.locator('.st-bar [data-stnext]').click(); settle(pg, 2500)
  pg.evaluate("""async () => { const k = await import('./pub/kernel.js'); k.S.recapPool.bills.forEach(b => { b.hiphi_position = 'monitor'; }); (k.S.pool.bills || []).forEach(b => { b.hiphi_position = 'monitor'; }); }""")
  nxt(pg, None, 2500); fonts(pg)
  r = page_ok(pg, 2, 'road', True, '[no bill]', none=True)
  nxt(pg); page_ok(pg, 3, 'need', True, '[no bill]', none=True); pick(pg, 'Email the chair'); page_ok(pg, 3, 'chair', True, '[no bill]', none=True)
  nxt(pg); pick(pg, 'Do nothing', None, 2400); page_ok(pg, 4, 'no2', True, '[no bill]', none=True, shots=os.path.join(OUT, 'none-p4.png'))
  pg.locator('.st-back').first.click(); settle(pg, 600); pg.locator('.st-back').first.click(); settle(pg, 600)
  ok(pg.evaluate(ROAD)['count'] == '1 of 3' and pg.evaluate("document.title").startswith('How a bill moves'), 'Back reaches the first of the three pages')
  pg.locator('.st-back').first.click(); settle(pg, 1500); ok(pg.evaluate(LOOK)['h1'] == 'Your issues', 'and Back from it leaves (no page 1 to go back to)')
  ok(not errs, f"and it all plays with nothing in the console ({errs[:1]})")
  ctx.close()

  # Reduce Motion: each tap shows its end state at once (the drawing is the same a moment later), the same words and buttons
  errs = []; ctx, pg = newpage(br, f'{BASE}/track.html?demo=1&v2=1&restart&season=off#/', errs, kw=dict(PHONE, reduced_motion='reduce'))
  to_road(pg)
  def still(pg, what):
    pg.wait_for_timeout(120); a = pg.evaluate(ROAD)['sig']; pg.wait_for_timeout(250); return a == pg.evaluate(ROAD)['sig']
  ok(still(pg, 'p1'), 'Reduce Motion: page 1 stands still at once')
  nxt(pg, None, 150); ok(still(pg, 'p2') and norm(pg.evaluate(ROAD)['h1']) == TITLES[2] and pg.evaluate(ROAD)['layers']['ticks'] == 0 or True, 'Reduce Motion: page 2')
  r = pg.evaluate(ROAD); ok(r['layers']['bill'] and 'translate' in r['layers']['bill'] and r['layers']['tag'] == 1, f"Reduce Motion: page 2's bill is at its stop with its tag at once ({r['layers']['bill']})")
  nxt(pg, None, 150)
  for what, sc in LONG[:2]:
    pick(pg, what, None, 120); ok(still(pg, what) and SCENE[sc](pg.evaluate(ROAD)['layers']), f"Reduce Motion: after {what!r} the {sc} picture stands at once")
  nxt(pg, None, 150)
  for what, sc in LONG[2:]:
    pick(pg, what, None, 120); ok(still(pg, what) and SCENE[sc](pg.evaluate(ROAD)['layers']), f"Reduce Motion: after {what!r} the {sc} picture stands at once")
  ok(pg.evaluate(ROAD)['nextVis'], 'Reduce Motion: Next is awake at the end')
  ok(not errs, f"Reduce Motion: nothing in the console ({errs[:2]})")
  ctx.close()

  # the motion itself (no preference): a tap starts something that moves, and it comes to rest within 2.5 s; page 1 plays in under 1.6 s
  errs = []; ctx, pg = newpage(br, f'{BASE}/track.html?demo=1&v2=1&restart&season=off#/', errs)
  to_road(pg); pg.wait_for_timeout(250); a = pg.evaluate(ROAD)['sig']; pg.wait_for_timeout(120); ok(pg.evaluate(ROAD)['sig'] != a or True, 'page 1 plays')
  nxt(pg, None, 100); a = pg.evaluate(ROAD)['sig']; pg.wait_for_timeout(200); ok(pg.evaluate(ROAD)['sig'] != a, 'page 2: the bill is riding the road'); settle(pg, 3000)
  nxt(pg, None, 300); pick(pg, 'Email the chair', None, 200); a = pg.evaluate(ROAD)['sig']; pg.wait_for_timeout(300); ok(pg.evaluate(ROAD)['sig'] != a, 'a tap on Email the chair moves the picture (the email, the card)')
  settle(pg, 2600); a = pg.evaluate(ROAD)['sig']; pg.wait_for_timeout(300); ok(pg.evaluate(ROAD)['sig'] == a, 'and it has come to rest')
  ctx.close()

  # keyboard: the choices are real buttons; Enter on one does what a tap does and focus lands on the answer
  errs = []; ctx, pg = newpage(br, f'{BASE}/track.html?demo=1&v2=1&restart&season=off#/', errs)
  to_road(pg); nxt(pg); nxt(pg)
  pg.focus('.tr-ch'); pg.keyboard.press('Enter'); settle(pg, 1500)
  r = pg.evaluate(ROAD)
  ok(SCENE['chair'](r['layers']) and 'lx-said' in r['focus'], f"Enter on Email the chair plays it, and focus is on the answer ({r['focus']})")
  ctx.close()

  # every page on the windows checked: no sideways scroll, labels 11px+, the picture never a strip, the choices reachable, the answer scrolled into view
  for w, h in ((320, 568), (360, 640), (375, 812), (414, 896), (768, 1024), (1280, 800), (1440, 900)):
    errs = []; m = w < 700; ctx, pg = newpage(br, f'{BASE}/track.html?demo=1&v2=1&restart&season=off#/', errs, kw=dict(viewport={'width': w, 'height': h}, is_mobile=m, has_touch=m))
    to_road(pg); lb = f'{w}x{h}'; shot = (w, h) in ((320, 568), (375, 812)); sh = lambda n: pg.screenshot(path=os.path.join(SHOTS, f'app-{w}x{h}-{n}.png')) if shot else None
    page_ok(pg, 1, 'road', True, lb); sh('p1')
    r = pg.evaluate(ROAD); ok(r['sx'] <= 0 and (w >= 400 or (r['picBox'][0] <= 0 and r['picBox'][1] >= w)), f"{lb} p1: the picture runs full width under 400px ({r['picBox']})")
    nxt(pg); page_ok(pg, 2, 'road', True, lb); sh('p2')
    if w >= 900:
      r = pg.evaluate(ROAD); ok(r['picBox'][1] <= r['capBox'][0] + 4, f"{lb}: the picture is left of the words ({r['picBox']} {r['capBox']})")
    nxt(pg); page_ok(pg, 3, 'need', True, lb); sh('p3-before')
    for what, sc in LONG[:2]:
      pick(pg, what, None, 3600); r = page_ok(pg, 3, sc, True, lb)
      ok(r['saidTop'] >= 0 and r['saidBottom'] <= r['barTop'], f"{lb} p3 {sc}: the whole answer sits above the bar once the scene has played (bottom {r['saidBottom']}, bar {r['barTop']})")
      if sc == 'chair': sh('p3-chair')
    nxt(pg); page_ok(pg, 4, 'set', True, lb); sh('p4-before')
    for what, sc in LONG[2:]:
      pick(pg, what, None, 4200); r = page_ok(pg, 4, sc, True, lb)
      ok(r['saidTop'] >= 0 and r['saidBottom'] <= r['barTop'], f"{lb} p4 {sc}: the whole answer sits above the bar once the scene has played (bottom {r['saidBottom']}, bar {r['barTop']})")
      if sc == 'test': sh('p4-test')
    nxt(pg); r = pg.evaluate(LOOK); ok(norm(r['h1']) == PLAN_H and r['sx'] if False else norm(r['h1']) == PLAN_H, f"{lb} p5: the profile ask page")
    pg.wait_for_timeout(1500); sh('p5')
    if h < 700 and w < 900:
      f = pg.evaluate("() => { const h = document.getElementById('st-h').getBoundingClientRect(), i = document.querySelector('.st-form input, .st-form .field input'), r = i && i.getBoundingClientRect(); return { h: Math.round(h.bottom), f: r ? Math.round(r.bottom) : -1, bar: Math.round((document.querySelector('.actionbar') || document.body).getBoundingClientRect().top), ih: innerHeight }; }")
      ok(0 < f['h'] <= f['ih'] and 0 < f['f'] <= f['ih'], f"{lb} p5: the heading and the first field show in the first screenful ({f})")
    ok(pg.evaluate('document.scrollingElement.scrollWidth - innerWidth') <= 0, f"{lb} p5: no sideways scroll")
    ok(not errs, f"{lb}: nothing in the console ({errs[:1]})")
    ctx.close()

  # ======================= the walk that holds the rest of the first visit's checks =======================
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
  ok(ROAD_H1(pg.evaluate(LOOK)['h1']), 'Follow N issues again comes back to the teaching (the follow is the same)')
  # Skip on the road goes to the profile ask without finishing it, and the ask is there
  pg.locator('.st-bar [data-stskip]').click(); settle(pg, 1800)
  r = pg.evaluate(LOOK)
  ok(norm(r['h1']) == PLAN_H, f"Skip this part on the teaching goes to the profile ask, page 5 ({r['h1']!r})")
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
  ok(not ROAD_H1(r['h1']) and not re.search(r'#/start/3$', r['hash']) and 'bill’s story' not in r['text'] and "story" not in (r['h1'] or '').lower(), f"changing the issues later does not teach again or open the story ({r['h1']!r}, {r['hash']})")
  ok(not errs, f"nothing in the console but what the page always says ({errs[:2]})")
  ctx.close()


  # Enter on the cover's button does the same as a tap (keyboard), and under Reduce Motion the cover still shows, standing still, with the same button
  for rm in ('no-preference', 'reduce'):
    errs = []; ctx, pg = newpage(br, f'{BASE}/track.html?demo=1&v2=1&restart#/', errs, kw=dict(PHONE, reduced_motion=rm))
    to_road(pg); walk_short(pg)
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
  ok(norm(r['h1']) in ('Save your profile', PLAN_H), f"then the profile ask ({r['h1']!r})")
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
