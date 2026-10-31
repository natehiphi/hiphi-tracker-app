# R-357 Part 1 (Nate, 30 Oct 2026): version 2 of the bill page, behind ?v2=1, and the three small fixes to today's page that ship live.
#   v2 (?demo=1&v2=1#/bill/HB2300, a phone and a laptop):
#     - the page opens like Home's slide: HB 2300 · the bill's everyday name, the goal heading within 320px of the top (A-1), one plain
#       sentence, one detail line on one line ("By tomorrow 1:00 PM · about 10 min"), exactly one filled button in view (A-3), "Email the chair
#       instead · 2 min" with its envelope, an outlined "Follow this issue" a newcomer has too, then one row, "More about this bill",
#       closed; no stance chips on the first screen; the slide under 60 words and 6 text styles
#     - the row opens today's sections inline (Where it is now, Where do you stand?, Who decides next ...); from 1100px they are open on
#       the right of the slide
#     - HB 1671 (waiting for a hearing): "Needs a hearing by Mon, Mar 30" and the hearing's own ask; a stopped bill between sessions: its
#       state in one phrase, the issue's Follow ("Follow this issue", the one Follow label) as the one button, its sentence said once
#     - a law: the top Share pill stands aside when the main button is Share
#     - Follow this issue becomes the outlined "Following" with a check (never a filled dark button) and back
#   the drawing and the issue's tile (R-357, Nate 31 Oct: "the issue and bill images should be included again"; A-1, A-22): the slide opens with
#     Home's drawing (the issue's own, else its topic's scene, else the Capitol) over the small line, 96px on a phone (the goal heading stays within
#     320px at 390x844, even when the small line takes two lines) and 152px from 480px up; a window 640px tall or less (a 320x568 phone) puts it under
#     the buttons so the one button still shows; More's "Its issue" row has the topic-tinted round icon tile on a phone and tablet (closed in the fold,
#     so not on the first screen), and none on a laptop, where the drawing already is the issue's picture: one picture on the screen
#   today's page (no v2): nothing of version 2 loads or shows, and
#     - 3a a newcomer has the band's Follow the issue; 3b Back on a bill opened first says Home, goes Home, and lights no tab;
#       3c the "Its issue" link and the sponsors' names are 44px targets (A-6)
#   nothing in the console but what the page always says
# usage: python3 tests/v2_bill.py [BASE]   (BASE defaults to http://localhost:8832; try http://localhost:8832/track.html?demo=1 as other tests take)
import re, sys
from playwright.sync_api import sync_playwright

BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832').split('/track.html')[0].rstrip('/')
fails = 0
def ok(cond, what):
  global fails
  print(('PASS ' if cond else 'FAIL ') + what)
  if not cond: fails += 1

# The pixel checks measure the page the way people see it: in its webfonts. Poppins (headings) and Lato (text) come from Google Fonts and
# are non-blocking since R-357 5a (the text draws at once in the system face and swaps when they arrive), so a measure taken before the
# swap reads the system face's metrics: with the fonts missing or two seconds late the small line wrapped to two lines and the goal heading
# started 334px down against a budget of 320 (HB1671 at 390 wide, HB1075 at 360), which read as a layout failure. So before any measurement
# the three faces the slide sets are loaded (document.fonts.load lists the faces it loaded and is empty until the stylesheet is in;
# fonts.check() is true for a face nothing declares, so it cannot tell) and the issue's drawing, an <img> for an issue that has its own, is
# complete. Eight seconds at most. Fonts that never load are one plain FAIL that stops the run (a fonts outage, not a layout to judge); a
# drawing that never loads is a FAIL of its own.
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
def settled(pg, ms=900):
  pg.wait_for_selector('#main .v2-slide', timeout=30000)
  r = pg.evaluate(READY)
  if not r['fonts']:
    print('FAIL the webfonts (Poppins, Lato) did not load within 8 s, so no pixel check can be judged (is Google Fonts reachable from this machine?)'); print('1 failed'); sys.exit(1)
  if not r['pic']: ok(False, "the issue's drawing (<img>) did not finish loading within 8 s")
  pg.wait_for_timeout(ms)   # then the page's own settling (the slide's entrance, the walkthrough's), as before

RETURNING = "const w = JSON.stringify({step: 9, issues: [], done: true}); localStorage.setItem('hiphi_wiz', w); localStorage.setItem('hiphi_wiz_demo', w)"
PHONE = dict(viewport={'width': 375, 'height': 812}, is_mobile=True, has_touch=True)
LAPTOP = dict(viewport={'width': 1280, 'height': 800})
# What is in view above the tab bar: a visible filled button (the docked bar is hidden until the slide's scrolls away), the slide's words and
# text styles (one face, size, weight and colour: home_calm.py's measure), the heading's top.
LOOK = """() => {
  const vis = e => { const r = e.getBoundingClientRect(); return e.checkVisibility({ visibilityProperty: true }) && r.width > 0 && r.top < innerHeight && r.bottom > 0; };
  const slide = document.querySelector('#main .v2-slide'), h1 = document.querySelector('#main h1');
  let words = 0; const st = new Set();
  if (slide) for (const w = document.createTreeWalker(slide, NodeFilter.SHOW_TEXT), n = null; ;) { const t = w.nextNode(); if (!t) break; const s = t.textContent.trim(), el = t.parentElement;
    if (!s || !el.checkVisibility({ visibilityProperty: true }) || el.closest('.sr, [aria-hidden="true"]')) continue;
    words += s.split(/\\s+/).filter(x => /\\w/.test(x)).length; const cs = getComputedStyle(el); if (!el.closest('.warn')) st.add([cs.fontFamily.split(',')[0], cs.fontSize, cs.fontWeight, cs.color].join(' ')); }
  return { h1: h1 && h1.textContent.trim(), h1top: h1 && Math.round(h1.getBoundingClientRect().top + scrollY),
    k: document.querySelector('.v2-k')?.textContent.trim(), kLines: (e => e ? Math.round(e.getBoundingClientRect().height / parseFloat(getComputedStyle(e).lineHeight)) : 0)(document.querySelector('.v2-k')),
    detailLines: (e => e ? Math.round(e.getBoundingClientRect().height / parseFloat(getComputedStyle(e).lineHeight)) : 0)(document.querySelector('.v2-detail')),
    share: document.querySelectorAll('.bl-sharebtn').length, linkIcon: !!document.querySelector('.v2-go .btn.text .ic'), say: document.querySelector('.v2-say')?.textContent.trim() || '', detail: document.querySelector('.v2-detail')?.textContent.trim() || '',
    filled: [...document.querySelectorAll('.btn.primary')].filter(vis).map(e => e.textContent.trim()),
    link: document.querySelector('.v2-go .btn.text')?.textContent.trim() || '', follow: document.querySelector('.v2-go .btn.secondary, .v2-go .v2-following')?.textContent.trim() || '',
    stance: [...document.querySelectorAll('[data-bl-stance]')].filter(vis).length, words, styles: st.size,
    moreOpen: !!document.querySelector('details.v2-more[open]') || !!document.querySelector('.v2-more.v2-open'), back: document.querySelector('.bl-back span')?.textContent.trim(),
    lit: [...document.querySelectorAll('.tabs [aria-current]')].map(e => e.textContent.trim()), wide: document.documentElement.scrollWidth > innerWidth + 1 }; }"""

def page(br, kw, url, returning=False, errs=None):
  ctx = br.new_context(**kw); pg = ctx.new_page()
  if errs is not None:
    pg.on('pageerror', lambda e: errs.append('pageerror ' + str(e)))
    pg.on('console', lambda m: errs.append('console ' + m.text) if m.type == 'error' else None)
  if returning: ctx.add_init_script(RETURNING)
  pg.goto(url); return ctx, pg

with sync_playwright() as pw:
  br = pw.chromium.launch()
  # ---------------- version 2, a phone, a newcomer ----------------
  errs = []; ctx, pg = page(br, PHONE, f'{BASE}/track.html?demo=1&v2=1#/bill/HB2300', errs=errs)
  settled(pg, 900)
  r = pg.evaluate(LOOK)
  ok(r['k'] == 'HB 2300 · Local food buying rules for schools' and r['kLines'] <= 2, f"the small line names the bill, the number and its everyday name, in two lines at most ({r['k']!r}, {r['kLines']})")
  ok(r['h1'] == 'Help put more local food in school meals' and r['h1top'] < 320, f"the goal heading, within 320px of the top (A-1): {r['h1']!r} at {r['h1top']}px")
  ok(re.search(r'hears it \w+\. ', r['say'] + ' ') and 'note' in r['say'], f"one plain sentence on what happens next and why a note helps ({r['say']!r})")
  ok(re.fullmatch(r'By .* · about 10 min', r['detail']) is not None and r['detailLines'] == 1, f"the detail line, on one line: when, and how long ({r['detail']!r}, {r['detailLines']} line)")
  ok(r['filled'] == ['Help me write testimony'], f"exactly one filled button in view, Help me write testimony (A-3): {r['filled']}")
  ok(r['link'] == 'Email the chair instead · 2 min' and r['linkIcon'], f"the plain link under it, with the app's envelope ({r['link']!r})")
  ok(r['follow'] == 'Follow this issue', f"a newcomer has Follow this issue ({r['follow']!r})")
  ok(r['stance'] == 0, 'no stance chips on the first screen: the letter asks')
  ok(r['words'] < 60 and r['styles'] <= 6, f"the slide under 60 words and 6 text styles ({r['words']} words, {r['styles']} styles)")
  ok(not r['moreOpen'], 'More about this bill starts closed')
  ok(r['back'] == 'Home' and r['lit'] == [], f"Back says Home and no tab is lit ({r['back']!r}, {r['lit']})")
  ok(pg.evaluate("() => document.body.classList.contains('v2') && !!document.querySelector('link[href=\"pub/v2/v2.css\"]')"), 'the page brings version 2\'s stylesheet and marks the body')
  ok(pg.evaluate("() => [...document.querySelectorAll('summary')].find(s => /More about this bill/.test(s.textContent))?.innerText.replace(/\\s+/g, ' ').trim()") == 'More about this bill What it does, where it is, who decides', 'the row says what it holds (the step is in the card inside, said once)')
  # the row opens today's sections inline
  pg.click('details.v2-more > summary'); pg.wait_for_timeout(400)
  t = pg.evaluate("() => document.querySelector('#main').innerText")
  ok(all(w in t for w in ('Where it is now', 'Where do you stand?', 'Who decides next', 'About the bill', 'More details', 'Introduced by', 'Its issue: More local food in school meals')), 'opened: where it is, where you stand, who decides, about, details, sponsors and its issue, inline')
  ok(pg.evaluate(LOOK)['moreOpen'], 'the row is open')
  # the same handlers as today's page
  pg.click('.v2-go .btn.primary'); pg.wait_for_timeout(900)
  ok(pg.evaluate("() => !!document.querySelector('#hp-dlg[open]')"), 'Help me write testimony opens the walkthrough')
  pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
  ok(not errs, f'no errors on the phone page {errs[:2]}')
  # Follow this issue: a newcomer's follow (the profile ask, then the page), a pale chip, never a filled dark one, and back
  pg.evaluate("window.scrollTo(0, 0)")
  pg.click('.v2-go .btn.secondary'); pg.wait_for_timeout(900)
  if pg.query_selector('text=Not now'): pg.click('text=Not now'); pg.wait_for_timeout(3200)   # the Mahalo's quiet moment (R-212 #47) first
  chip = pg.evaluate("() => { const e = document.querySelector('.v2-go .v2-following'); if (!e) return null; const cs = getComputedStyle(e); return { text: e.textContent.trim(), pressed: e.getAttribute('aria-pressed'), bg: cs.backgroundColor, color: cs.color, outlined: e.classList.contains('secondary') && !e.classList.contains('on'), check: !!e.querySelector('.ic-check'), star: !!e.querySelector('.ic-star') }; }")
  ok(chip and chip['text'] == 'Following' and chip['pressed'] == 'true' and chip['outlined'] and chip['check'] and not chip['star'] and chip['bg'] != 'rgb(0, 105, 142)', f'followed: the same outlined pill with a check, not the filled blue ({chip})')
  ok(len(pg.evaluate(LOOK)['filled']) == 1, f"still one filled button after following {pg.evaluate(LOOK)['filled']}")
  pg.click('.v2-go .v2-following'); pg.wait_for_timeout(700)
  ok(pg.evaluate(LOOK)['follow'] == 'Follow this issue', 'pressing Following stops following')
  ok(not errs, f'no errors after following {errs[:2]}')
  ctx.close()

  # ---------------- testimony already sent: its sentence once ----------------
  # (the sandbox's HB 2300 hearing of Wed 18 Mar: ids from demo/snapshot.json)
  SENT = "localStorage.setItem('hiphi_done_demo', JSON.stringify(['86f499e6-7bab-4943-ad6e-5f4d23e85e34|62da6ef7-6c9a-4a03-975b-4b5155e564dc|testimony']))"
  errs = []; ctx = br.new_context(**PHONE); ctx.add_init_script(RETURNING + ';' + SENT); pg = ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
  pg.goto(f'{BASE}/track.html?demo=1&v2=1#/bill/HB2300'); settled(pg, 900)
  t = pg.evaluate("() => document.querySelector('.v2-slide').innerText.replace(/\\s+/g, ' ')")
  ok(t.count('reads your testimony before it votes') == 1 and 'Your testimony is in' not in t and 'You sent testimony. Mahalo!' in t, f'after testimony: the committee reads it, said once, and the Mahalo line ({t!r})')
  ok(pg.evaluate(LOOK)['filled'] == ['Ask a friend to speak up'], 'and the one button asks a friend'); ctx.close()

  # ---------------- the email walkthrough from the link ----------------
  errs = []; ctx, pg = page(br, PHONE, f'{BASE}/track.html?demo=1&v2=1#/bill/HB2300', returning=True, errs=errs)
  settled(pg, 700)
  pg.click('.v2-go .btn.text'); pg.wait_for_timeout(1000)
  ok(pg.evaluate("() => !!document.querySelector('#hp-dlg[open]')"), 'Email the chair instead opens the email walkthrough')
  ok(not errs, f'no errors {errs[:2]}'); ctx.close()

  # ---------------- a bill waiting for a hearing; a stopped bill between sessions ----------------
  errs = []; ctx, pg = page(br, PHONE, f'{BASE}/track.html?demo=1&v2=1#/bill/HB1671', errs=errs)
  settled(pg, 700); r = pg.evaluate(LOOK)
  ok(re.fullmatch(r'Needs a hearing by \w{3}, \w{3} \d+', r['detail']) is not None, f"between hearings the one thing to do, the date only: the button says the ask ({r['detail']!r})")
  ok(r['say'] == 'A Senate committee hasn’t heard it yet. The committee’s chair decides whether it gets a hearing, and people asking helps.', f"it says who decides and that asking helps ({r['say']!r})")
  ok(r['filled'] == ['Ask the chair for a hearing'] and r['link'] == '' and r['h1top'] < 320, f"the hearing's own ask, one filled button, no email link ({r['filled']}, {r['link']!r})")
  ok(r['follow'] == 'Follow this issue' and not r['wide'], 'Follow this issue, nothing scrolls sideways'); ctx.close()
  ctx, pg = page(br, PHONE, f'{BASE}/track.html?demo=1&v2=1&season=off#/bill/HB2121', errs=errs)
  settled(pg, 700); r = pg.evaluate(LOOK)
  ok(r['detail'].startswith('Did not advance in 20') and r['filled'] == ['Follow this issue'] and r['follow'] == '', f"between sessions: the state in one phrase, the issue's Follow (one label, Follow this issue) the one button, no second Follow ({r['detail']!r}, {r['filled']}, {r['follow']!r})")
  pg.click('details.v2-more > summary'); pg.wait_for_timeout(400)
  said = pg.evaluate("() => (document.querySelector('#main').innerText.match(/can’t come back/g) || []).length")
  ok(said == 1, f"the dead bill's sentence is said once, the stage card does not repeat it ({said})"); ctx.close()
  ctx, pg = page(br, PHONE, f'{BASE}/track.html?demo=1&v2=1&season=off#/bill/HB2300', errs=errs)
  settled(pg, 700); r = pg.evaluate(LOOK)
  ok(r['detail'] == 'Became law' and r['filled'] == ['Share the good news'] and r['share'] == 0, f"a law: its state, one filled button, and no second Share above it ({r['detail']!r}, {r['filled']}, {r['share']} pills)")
  ok(not errs, f'no errors {errs[:2]}'); ctx.close()

  # ---------------- version 2, a laptop ----------------
  errs = []; ctx, pg = page(br, LAPTOP, f'{BASE}/track.html?demo=1&v2=1#/bill/HB2300', errs=errs)
  settled(pg, 900); r = pg.evaluate(LOOK)
  geo = pg.evaluate("() => { const a = document.querySelector('.v2-slide').getBoundingClientRect(), b = document.querySelector('.v2-more').getBoundingClientRect(); return { slideRight: a.right, moreLeft: b.left, sameTop: Math.abs(a.top - b.top) < 120 }; }")
  ok(geo['slideRight'] <= geo['moreLeft'] and geo['sameTop'], f'the slide on the left, More about this bill beside it on the right ({geo})')
  ok(r['moreOpen'] and 'Where it is now' in pg.evaluate("() => document.querySelector('.v2-more').innerText"), 'More about this bill is open')
  ok(not pg.query_selector('.v2-mh, .v2-more > .v2-ms') and r['share'] == 1, 'with no heading of its own: the right column starts at the bill\'s content')
  ok(r['filled'] == ['Help me write testimony'] and not r['wide'], f"one filled button, nothing scrolls sideways ({r['filled']})")
  ok(not errs, f'no errors {errs[:2]}'); ctx.close()

  # ---------------- the drawing and the issue's tile ----------------
  ART = """() => { const a = document.querySelector('#main .v2-slide .v2-art'), k = document.querySelector('.v2-k'), h = document.querySelector('#main h1'), g = document.querySelector('.v2-go .btn.primary');
    const r = e => e && e.getBoundingClientRect(), pic = a && a.querySelector('svg, img'), tabs = document.querySelector('.tabs');
    return { has: !!a, first: !!a && a === a.closest('.v2-slide').firstElementChild, kind: pic && pic.tagName.toLowerCase(), cls: pic && (pic.getAttribute('class') || ''),
      quiet: !!pic && (pic.tagName === 'IMG' ? pic.getAttribute('alt') === '' : pic.getAttribute('aria-hidden') === 'true'), h: a && Math.round(r(a).height),
      aTop: a && Math.round(r(a).top + scrollY), aBottom: a && Math.round(r(a).bottom + scrollY), kTop: k && Math.round(r(k).top + scrollY), h1top: h && Math.round(r(h).top + scrollY),
      kLines: k ? Math.round(r(k).height / parseFloat(getComputedStyle(k).lineHeight)) : 0, btnTop: g && Math.round(r(g).top + scrollY), btnBottom: g && Math.round(r(g).bottom + scrollY),
      tabTop: tabs && r(tabs).top > innerHeight / 2 ? Math.round(r(tabs).top) : innerHeight,
      tileShown: [...document.querySelectorAll('.v2-tile')].some(e => e.checkVisibility({ visibilityProperty: true }) && r(e).top < innerHeight && r(e).bottom > 0),
      wide: document.documentElement.scrollWidth > innerWidth + 1 }; }"""
  def at(w, h, hash, qs='', touch=None):
    kw = dict(viewport={'width': w, 'height': h}); 
    if (w < 600 if touch is None else touch): kw.update(is_mobile=True, has_touch=True)
    c = br.new_context(**kw); c.add_init_script(RETURNING); p = c.new_page(); p.on('pageerror', lambda e: errs.append(str(e)))
    p.goto(f'{BASE}/track.html?demo=1&v2=1{qs}#/bill/{hash}'); settled(p, 900); return c, p
  errs = []
  # a phone, a bill with a hearing: the drawing first, the goal heading within the budget, the one button still in view
  c, p = at(390, 844, 'HB2300'); r = p.evaluate(ART)
  ok(r['has'] and r['first'] and r['kind'] in ('svg', 'img') and r['quiet'], f"the slide opens with a drawing (decorative: no alt, aria-hidden) ({r['kind']}, {r['cls']})")
  ok(r['aTop'] < r['kTop'] and r['h'] == 96, f"it stands over the small line, 96px tall on a phone ({r['aTop']} < {r['kTop']}, {r['h']}px)")
  ok(r['h1top'] <= 320, f"A-1: the goal heading still starts within 320px at 390x844 ({r['h1top']}px)")
  ok(r['btnBottom'] <= r['tabTop'] and not r['tileShown'] and not r['wide'], f"the one button is above the tab bar and no second picture (the tile) is on the first screen ({r['btnBottom']} <= {r['tabTop']}, tile shown {r['tileShown']})")
  c.close()
  # the issue's own drawing (the practice copy shows them, art.js ISSUE_ART_LIVE) and the Capitol for a bill on no issue, Home's way
  c, p = at(390, 844, 'HB1671'); r = p.evaluate(ART)
  ok(r['kind'] == 'img' and 'art-issue' in r['cls'] and r['quiet'] and r['h1top'] <= 320, f"a bill whose issue has its own drawing shows it ({r['kind']}, {r['cls']}, heading {r['h1top']}px)"); c.close()
  c, p = at(390, 844, 'HB1005'); r = p.evaluate(ART)
  ok(r['kind'] == 'svg' and 'art-capitol' in r['cls'] and r['h1top'] <= 320, f"a bill on no issue gets the Capitol ({r['cls']}, heading {r['h1top']}px)"); c.close()
  # the small line on two lines (a narrow phone, a long name) is the worst case for the budget
  c, p = at(360, 780, 'HB1075'); r = p.evaluate(ART)
  ok(r['kLines'] == 2 and r['h1top'] <= 320, f"A-1 with a two-line small line at 360px ({r['kLines']} lines, heading {r['h1top']}px)"); c.close()
  # a short phone: the drawing stands under the buttons, so the one button stays on the first screen
  # (HB 1671's five-line sentence already ran its button's lower edge under the tab bar at this size before the drawing; the drawing must not move it)
  for num, whole in (('HB2300', True), ('HB1671', False)):
    c, p = at(320, 568, num); r = p.evaluate(ART)
    ok(r['btnTop'] < r['tabTop'] and (r['btnBottom'] <= r['tabTop'] or not whole) and r['aTop'] > r['btnBottom'], f"{num} at 320x568: the button is on the first screen and the drawing is under the buttons, not above it ({r['btnTop']}-{r['btnBottom']} vs the tab bar at {r['tabTop']}, drawing at {r['aTop']})")
    ok(not r['tileShown'] and not r['wide'], 'and nothing scrolls sideways'); c.close()
  # a tablet: Home's 152px
  c, p = at(768, 1024, 'HB2300'); r = p.evaluate(ART)
  ok(r['h'] == 152 and r['first'] and not r['tileShown'], f"from 480px the drawing is Home's 152px ({r['h']}px)"); c.close()
  # More's "Its issue" row on a phone: the round tile in the topic's tint, still one tap to the issue
  c, p = at(390, 844, 'HB2300'); p.click('details.v2-more > summary'); p.wait_for_timeout(400)
  t = p.evaluate("""() => { const t = document.querySelector('.v2-issue .v2-tile'), a = document.querySelector('.v2-issue .v2-issuelink'), cs = t && getComputedStyle(t), r = e => e.getBoundingClientRect();
    return t && { w: Math.round(r(t).width), h: Math.round(r(t).height), round: cs.borderRadius, icon: !!t.querySelector('svg'), topic: document.querySelector('.v2-issue').dataset.topic, bg: getComputedStyle(document.querySelector('.v2-issue')).backgroundColor,
      href: a.getAttribute('href'), tall: Math.round(r(a).height), shown: t.checkVisibility({ visibilityProperty: true }) }; }""")
  ok(t and t['w'] == 40 and t['h'] == 40 and t['icon'] and t['shown'] and t['topic'] == 'food' and t['bg'] == 'rgb(252, 235, 221)', f"the Its issue row has the 40px round icon tile in the topic's tint ({t})")
  ok(t and t['href'].startswith('#/issue/') and t['tall'] >= 44, f"and is still one tap to the issue, a 44px target (A-6) ({t and t['href']}, {t and t['tall']}px)"); c.close()
  # a laptop: the drawing in the left column over the slide, 152px, and the row has no tile, so the screen holds one picture
  c, p = at(1280, 800, 'HB2300'); r = p.evaluate(ART)
  geo = p.evaluate("() => { const a = document.querySelector('.v2-left .v2-art'); return a && { right: a.getBoundingClientRect().right, moreLeft: document.querySelector('.v2-more').getBoundingClientRect().left }; }")
  ok(r['first'] and r['h'] == 152 and geo and geo['right'] <= geo['moreLeft'], f"a laptop: the drawing is in the left column over the slide, 152px ({r['h']}px, {geo})")
  ok(not r['tileShown'] and p.evaluate("() => !!document.querySelector('.v2-issue .v2-issuelink[href^=\"#/issue/\"]')") and r['btnBottom'] <= 800 and not r['wide'], f"one picture on the screen: no tile beside it, the issue link stays, the button is in view ({r['btnBottom']}px)")
  ok(not errs, f'no errors {errs[:2]}'); c.close()

  # ---------------- today's page (no ?v2=1): nothing of version 2, and the three fixes ----------------
  errs = []; reqs = []
  ctx = br.new_context(**PHONE); pg = ctx.new_page(); pg.on('request', lambda q: reqs.append(q.url)); pg.on('pageerror', lambda e: errs.append(str(e)))
  pg.goto(f'{BASE}/track.html?demo=1#/bill/HB2300'); pg.wait_for_selector('#main .bl-head h1', timeout=30000); pg.wait_for_timeout(2800)
  ok(not pg.query_selector('.v2-slide') and not pg.evaluate("document.body.classList.contains('v2')"), 'without the flag the page is today\'s')
  ok(not [u for u in reqs if '/pub/v2/' in u] and not pg.query_selector('link[href="pub/v2/v2.css"]') and not pg.query_selector('.v2-art, .v2-tile'), 'and nothing of version 2 is fetched or drawn (no v2 drawing, no v2 tile)')
  ok(pg.evaluate("() => [...new Set([...document.querySelectorAll('#main .acard .btn.primary')].map(e => e.textContent.trim()))].join('|')") == 'Help me write testimony', 'its main button reads as before')
  b = pg.evaluate("() => { const e = document.querySelector('.bl-iband .bl-ib-btn'); return e && e.textContent.trim(); }")
  ok(b == 'Follow the issue', f'3a: a newcomer has Follow the issue in the band ({b!r})')
  ok(pg.evaluate("() => document.querySelector('.bl-back span').textContent.trim()") == 'Home' and pg.evaluate("() => document.querySelectorAll('.tabs [aria-current]').length") == 0, '3b: a bill opened first says Home on Back and lights no tab')
  small = pg.evaluate("() => [...document.querySelectorAll('.bl-ib-l a, .bl-ib-n a, .bl-rspons a')].map(e => [e.className || e.parentElement.className, Math.round(e.getBoundingClientRect().height)]).filter(x => x[1] < 44)")
  ok(not small, f'3c: the Its issue link, the issue name and the sponsors are 44px targets {small}')
  pg.click('.bl-back'); pg.wait_for_timeout(900)
  ok(re.search(r'#/(start/0)?$', pg.evaluate('location.hash')) is not None, f"3b: Back goes Home, a newcomer's front door ({pg.evaluate('location.hash')})")
  ok(not errs, f'no page errors {errs[:2]}'); ctx.close()
  # one Follow label is version 2's alone: today's stopped bill still says "Follow the issue"
  ctx, pg = page(br, PHONE, f'{BASE}/track.html?demo=1#/bill/HB10', returning=True, errs=errs)
  pg.wait_for_selector('#main .bl-head h1', timeout=30000); pg.wait_for_timeout(900)
  ok(pg.evaluate("() => [...new Set([...document.querySelectorAll('#main .btn.primary')].map(e => e.textContent.trim()))].join('|')") == 'Follow the issue', 'today\'s stopped bill still says Follow the issue'); ctx.close()
  # a visit with an earlier page keeps real Back: the bill, its issue's page, another bill
  ctx, pg = page(br, PHONE, f'{BASE}/track.html?demo=1#/bill/HB2300', returning=True, errs=errs)
  pg.wait_for_selector('#main .bl-head h1', timeout=30000); pg.wait_for_timeout(700)
  pg.click('.bl-ib-n a'); pg.wait_for_selector('#main a[href^="#/bill/"]', timeout=15000); pg.wait_for_timeout(500)
  pg.click('#main a.rc-row[href^="#/bill/"]:not([href$="HB2300"])'); pg.wait_for_selector('#main .bl-head h1', timeout=15000); pg.wait_for_timeout(500)
  back = pg.evaluate("() => document.querySelector('.bl-back span').textContent.trim()")
  ok(back not in ('Home', 'Back', ''), f'a bill opened from an issue page still says where Back goes ({back!r})')
  ctx.close(); br.close()
print('all passed' if not fails else f'{fails} failed'); sys.exit(1 if fails else 0)
