# R-357 pL (Nate, 31 Oct 2026: "The images are not back for issues"; where: "the issue's own page, the page a tap on an issue opens, its
# drawing at the top"): version 2's issue page opens with the issue's drawing, behind ?v2=1 (pub/rec/issue.js, rules in pub/rec/issue.css).
#   v2 (?demo=1&v2=1#/issue/more-local-food-in-school-meals):
#     - the page opens with Home's band over the heading: the issue's own drawing (an <img>), else its topic's scene (an <svg>), else the
#       Capitol; decorative (no alt, aria-hidden); 88px under 480px wide and Home's 152px from 480px up (A-22)
#     - A-1: the heading starts within 320px of the top at 390x844 (it started 166px down before the band); on a laptop inside the 400px
#       limit (152px band, as the bill page's)
#     - a window 640px tall or less (a 320x568 phone): the band stands under the Follow row, so Follow is on the first screen
#     - one picture per screen: the action card on this page draws no scene of its own, so a laptop shows the issue's drawing once
#     - a loading page draws it too (it is in the head), and an issue with nothing moving has it
#     - since R-361 (6 Nov) every issue in the sandbox has its own drawing; the topic scene is still what an issue without one gets (and what
#       live visitors get until the drawings go live), so that check loads the page with the issue drawings turned off in pub/art.js
#   today's page (no ?v2=1): no band, no picture
#   nothing in the console but what the page always says
# usage: python3 tests/v2_issue.py [BASE]   (BASE defaults to http://localhost:8832; try http://localhost:8832/track.html?demo=1 as other tests take)
import os, sys
from playwright.sync_api import sync_playwright

BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832').split('/track.html')[0].rstrip('/')
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out', 'v2_issue')
fails = 0
def ok(cond, what):
  global fails
  print(('PASS ' if cond else 'FAIL ') + what)
  if not cond: fails += 1

# Pixel checks measure the page in its webfonts (tests/v2_bill.py has the story): Poppins (the heading) and Lato (the text) come from
# Google Fonts and swap in after the first draw, so before any measurement the faces are loaded and the issue's drawing, an <img> for an
# issue that has its own, is complete. Eight seconds at most; fonts that never load are one plain FAIL that stops the run.
READY = """async () => {
  const nap = ms => new Promise(r => setTimeout(r, ms)), end = performance.now() + 8000;
  const fontsIn = async () => { try { const got = await Promise.all(['700 1em Poppins', '400 1em Lato', '700 1em Lato'].map(f => document.fonts.load(f)));
    await document.fonts.ready; return got.every(a => a.length > 0 && a.every(f => f.status === 'loaded')); } catch (e) { return false; } };
  const picIn = () => [...document.querySelectorAll('#main .v2-art img')].every(i => i.complete && i.naturalWidth > 0);
  let f = false, p = false;
  while (performance.now() < end && !(f && p)) {
    if (!f) f = await Promise.race([fontsIn(), nap(Math.max(0, end - performance.now())).then(() => false)]);
    p = picIn(); if (!(f && p)) await nap(100);
  }
  return { fonts: f, pic: p };
}"""
def settled(pg, ms=900, ready='#main .rc-iss[data-shape]'):
  pg.wait_for_selector(ready, timeout=30000)
  r = pg.evaluate(READY)
  if not r['fonts']:
    print('FAIL the webfonts (Poppins, Lato) did not load within 8 s, so no pixel check can be judged (is Google Fonts reachable from this machine?)'); print('1 failed'); sys.exit(1)
  if not r['pic']: ok(False, "the issue's drawing (<img>) did not finish loading within 8 s")
  pg.wait_for_timeout(ms)   # then the page's own settling

RETURNING = "const w = JSON.stringify({step: 9, issues: [], done: true}); localStorage.setItem('hiphi_wiz', w); localStorage.setItem('hiphi_wiz_demo', w)"
# What the person sees: the band and its picture, the heading, Follow (the head's pill), the tab bar's top (the first screen's floor on a
# phone), every drawing in view (a scene is two svgs, a background and a foreground layer, so the foreground is not counted), the card's own
# scene (the action card's .acband), and sideways scroll.
LOOK = """() => {
  const r = e => e && e.getBoundingClientRect(), a = document.querySelector('#main .rc-iss .v2-art'), h = document.querySelector('#main .rc-iss h1'),
    f = document.querySelector('#main .rc-iss .rc-ihead .rc-fpill'), head = document.querySelector('#main .rc-iss .rc-ihead'), tabs = document.querySelector('.tabs'),
    pic = a && a.querySelector('svg, img'), side = document.querySelector('#main .rc-iss .bl-side');
  const seen = e => { const q = r(e); return e.checkVisibility({ visibilityProperty: true }) && q.width > 0 && q.top < innerHeight && q.bottom > 0; };
  return { has: !!a, first: !!a && a === head?.firstElementChild, inHead: !!a && a.parentElement === head, kind: pic && pic.tagName.toLowerCase(), cls: pic && (pic.getAttribute('class') || ''),
    quiet: !!pic && (pic.tagName === 'IMG' ? pic.getAttribute('alt') === '' : pic.getAttribute('aria-hidden') === 'true'),
    h: a && Math.round(r(a).height), aTop: a && Math.round(r(a).top + scrollY), aBottom: a && Math.round(r(a).bottom + scrollY), aRight: a && Math.round(r(a).right), aWidth: a && Math.round(r(a).width),
    h1: h && h.textContent.trim(), h1top: h && Math.round(r(h).top + scrollY), h1count: document.querySelectorAll('#main h1').length,
    fTop: f && Math.round(r(f).top + scrollY), fBottom: f && Math.round(r(f).bottom + scrollY), fText: f ? f.textContent.trim() : null,
    tabTop: tabs && r(tabs).top > innerHeight / 2 ? Math.round(r(tabs).top) : innerHeight, sideLeft: side && Math.round(r(side).left),
    pics: [...document.querySelectorAll('#main svg.art:not(.art-band-fg), #main img.art')].filter(seen).length, bands: document.querySelectorAll('#main .acband').length,
    shape: document.querySelector('#main .rc-iss')?.dataset.shape, wide: document.documentElement.scrollWidth > innerWidth + 1,
    v2: document.body.classList.contains('v2') }; }"""
os.makedirs(OUT, exist_ok=True)
SLUG = 'more-local-food-in-school-meals'
errs = []

with sync_playwright() as pw:
  br = pw.chromium.launch()
  # The fallback: serve pub/art.js with the issue's own drawing never found, as for an issue that has none.
  NO_OWN = ('iss?.slug && ISSUE_ART[iss.slug] && (demo', 'iss?.slug && false && (demo')
  swapped = []
  def no_own_art(route):
    body = route.fetch().text(); swapped.append(NO_OWN[0] in body)
    route.fulfill(body=body.replace(NO_OWN[0], NO_OWN[1]), content_type='text/javascript')
  def at(w, h, slug=SLUG, qs='&v2=1', ready='#main .rc-iss[data-shape]', own=True):
    kw = dict(viewport={'width': w, 'height': h})
    if w < 600: kw.update(is_mobile=True, has_touch=True)
    c = br.new_context(**kw); c.add_init_script(RETURNING); p = c.new_page()
    if not own: c.route('**/pub/art.js*', no_own_art)
    p.on('pageerror', lambda e: errs.append('pageerror ' + str(e)))
    p.on('console', lambda m: errs.append('console ' + m.text) if m.type == 'error' else None)
    p.goto(f'{BASE}/track.html?demo=1{qs}#/issue/{slug}'); settled(p, 900, ready); return c, p

  # ---------------- a phone: the drawing over the heading, the heading within the budget ----------------
  c, p = at(390, 844); r = p.evaluate(LOOK)
  p.screenshot(path=os.path.join(OUT, 'phone-390x844.png'))
  ok(r['v2'] and r['has'] and r['inHead'] and r['first'] and r['kind'] in ('svg', 'img') and r['quiet'], f"the issue page opens with the drawing, first in its head (decorative: no alt, aria-hidden) ({r['kind']}, {r['cls']})")
  ok(r['kind'] == 'img' and 'art-issue' in r['cls'], f"the issue's own drawing (R-361: every issue has one in the sandbox) ({r['kind']}, {r['cls']})")
  ok(r['aTop'] < r['h1top'] and r['h'] == 88, f"it stands over the heading, 88px tall on a phone ({r['aTop']} < {r['h1top']}, {r['h']}px)")
  ok(r['h1'] == 'More local food in school meals' and r['h1count'] == 1 and r['h1top'] <= 320, f"A-1: the heading still starts within 320px at 390x844 ({r['h1top']}px; it was 166px before the drawing)")
  ok(r['fText'] == 'Follow' and r['fBottom'] <= r['tabTop'] and r['fTop'] >= 0, f"Follow is on the first screen ({r['fTop']}-{r['fBottom']} vs the tab bar at {r['tabTop']})")
  ok(r['pics'] == 1 and r['bands'] == 0, f"one picture on the screen: the card draws no scene of its own ({r['pics']} pictures, {r['bands']} card scenes)")
  ok(not r['wide'], 'nothing scrolls sideways'); c.close()

  # ---------------- a narrow phone with a short window: the drawing under the Follow row ----------------
  c, p = at(320, 568); r = p.evaluate(LOOK)
  ok(r['h'] == 88 and r['has'] and r['inHead'], f"320x568: the drawing is there, 88px ({r['h']}px)")
  ok(r['fText'] == 'Follow' and r['fBottom'] <= r['tabTop'] and r['fTop'] >= 0, f"320x568: Follow is on the first screen ({r['fTop']}-{r['fBottom']} vs the tab bar at {r['tabTop']})")
  ok(r['aTop'] >= r['fBottom'] and r['h1top'] < 320, f"320x568: the drawing is under the Follow row, not over the heading ({r['aTop']} >= {r['fBottom']}; heading at {r['h1top']}px)")
  ok(r['pics'] == 1 and not r['wide'], '320x568: one picture, nothing scrolls sideways'); c.close()

  # ---------------- an issue with no drawing of its own: its topic's scene, as Home does ----------------
  c, p = at(390, 844, own=False); r = p.evaluate(LOOK)
  ok(swapped and all(swapped), f"the test turned the issue drawings off in pub/art.js (its line is still there: {swapped})")
  ok(r['kind'] == 'svg' and 'art-food' in r['cls'] and r['quiet'] and r['h'] == 88 and r['pics'] == 1, f"an issue with no drawing of its own shows its topic's scene, as Home does ({r['kind']}, {r['cls']}, {r['h']}px)")
  c.close()

  # ---------------- a phone, the other shapes and the issue's own drawing ----------------
  # a bill moving and nothing moving: since R-361 each issue has its own drawing (an <img>)
  for slug, what, kind in (('free-school-meals-for-every-student', 'an issue with its own drawing (one bill moving)', 'img'),
                           ('disposable-e-cigarette-ban', 'an issue with its own drawing (several bills moving)', 'img'),
                           ('single-payer-health-care', 'an issue with nothing moving', 'img')):
    c, p = at(390, 844, slug); r = p.evaluate(LOOK)
    ok(r['has'] and r['kind'] == kind and r['quiet'] and r['h'] == 88 and r['h1top'] <= 320 and r['pics'] == 1, f"{what}: the band, {kind}, 96px, heading at {r['h1top']}px, one picture (shape {r['shape']}, {r['cls']})")
    c.close()
  # a tablet: Home's 152px
  c, p = at(768, 1024); r = p.evaluate(LOOK)
  ok(r['h'] == 152 and r['first'] and r['aWidth'] > 600 and not r['wide'], f"from 480px the drawing is Home's 152px ({r['h']}px)"); c.close()

  # ---------------- a laptop: the drawing over the heading in the main column, the card beside it with no scene of its own ----------------
  c, p = at(1280, 800); r = p.evaluate(LOOK)
  p.screenshot(path=os.path.join(OUT, 'laptop-1280x800.png'))
  ok(r['has'] and r['first'] and r['h'] == 152 and r['aRight'] <= r['sideLeft'], f"a laptop: the drawing is in the main column, 152px, the card at its right ({r['h']}px, right edge {r['aRight']} <= {r['sideLeft']})")
  ok(r['h1top'] <= 400, f"A-1: the heading is inside the 400px limit on a laptop ({r['h1top']}px; the bill page's is 373)")
  ok(r['pics'] == 1 and r['bands'] == 0, f"one picture per screen: the issue's drawing is not drawn a second time across the card ({r['pics']} pictures, {r['bands']} card scenes)")
  ok(r['fBottom'] <= 800 and not r['wide'], f"Follow is on the screen, nothing scrolls sideways ({r['fBottom']}px)")
  c.close()
  c, p = at(1280, 600); r = p.evaluate(LOOK)
  ok(r['aTop'] >= r['fBottom'] and r['pics'] == 1, f"a laptop window 600px tall: the drawing is under the Follow row ({r['aTop']} >= {r['fBottom']}), one picture"); c.close()

  # ---------------- every draw of the page has the band, the loading one too (it is in the head, so nothing moves when the bills arrive) ----------------
  # A recorder, started before the page: each time the issue page's root is drawn anew it notes whether the bills were in (data-shape) and whether the
  # band was the head's first child.
  REC = """(() => { window.__draws = []; let last = null;
    new MutationObserver(() => { const el = document.querySelector('#main .rc-iss'); if (el && el !== last) { last = el;
      window.__draws.push({ ready: !!el.dataset.shape, band: !!el.querySelector('.rc-ihead > .v2-art:first-child') }); } }).observe(document, { childList: true, subtree: true }); })()"""
  c = br.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True); c.add_init_script(RETURNING); c.add_init_script(REC); p = c.new_page()
  p.on('pageerror', lambda e: errs.append('pageerror ' + str(e)))
  p.goto(f'{BASE}/track.html?demo=1&v2=1#/issue/{SLUG}'); settled(p, 600)
  d = p.evaluate('window.__draws'); n = len([x for x in d if not x['ready']])
  ok(len(d) >= 1 and all(x['band'] for x in d) and d[-1]['ready'], f"every draw of the page carries the band, {n} while the bills were loading ({len(d)} draws)"); c.close()

  # ---------------- today's page (no ?v2=1): no band, no picture ----------------
  c, p = at(390, 844, qs=''); r = p.evaluate(LOOK)
  ok(not r['v2'] and not r['has'] and not p.query_selector('#main .cm-art') and r['pics'] == 0 and r['bands'] == 0, f"without the flag the issue page draws no band and no picture ({r['has']}, {r['pics']} pictures)")
  ok(r['h1top'] < 220, f"and the heading is where it was ({r['h1top']}px)"); c.close()

  ok(not errs, f'no errors {errs[:3]}')
  br.close()
print('all passed' if not fails else f'{fails} failed'); sys.exit(1 if fails else 0)
