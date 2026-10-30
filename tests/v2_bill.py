# R-357 Part 1 (Nate, 30 Oct 2026): version 2 of the bill page, behind ?v2=1, and the three small fixes to today's page that ship live.
#   v2 (?demo=1&v2=1#/bill/HB2300, a phone and a laptop):
#     - the page opens like Home's slide: HB 2300 · HIPHI supports, the goal heading within 320px of the top (A-1), one plain sentence, one
#       detail line, exactly one filled button in view (A-3), "Email the chair instead · 2 min", an outlined "Follow this issue" a newcomer
#       has too, then one row, "More about this bill", closed; no stance chips on the first screen; the slide under 60 words and 6 text styles
#     - the row opens today's sections inline (Where it is now, Where do you stand?, Who decides next ...); from 1100px they are open on
#       the right of the slide
#     - HB 1671 (waiting for a hearing): "Needs a hearing by Mon, Mar 30 · ask the chair" and the hearing's own ask; a stopped bill between
#       sessions: its state in one phrase and the issue's Follow as the one button
#     - Follow this issue becomes a pale "Following" chip (never a filled dark button) and back
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
    k: document.querySelector('.v2-k')?.textContent.trim(), say: document.querySelector('.v2-say')?.textContent.trim() || '', detail: document.querySelector('.v2-detail')?.textContent.trim() || '',
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
  pg.wait_for_selector('#main .v2-slide', timeout=30000); pg.wait_for_timeout(900)
  r = pg.evaluate(LOOK)
  ok(r['k'] == 'HB 2300 · HIPHI supports', f"the small line is the number and HIPHI's side ({r['k']!r})")
  ok(r['h1'] == 'Help put more local food in school meals' and r['h1top'] < 320, f"the goal heading, within 320px of the top (A-1): {r['h1']!r} at {r['h1top']}px")
  ok(re.search(r'hears it \w+\. ', r['say'] + ' ') and 'note' in r['say'], f"one plain sentence on what happens next and why a note helps ({r['say']!r})")
  ok(re.fullmatch(r'By .* · about 10 min the first time', r['detail']) is not None, f"the detail line: when, and the first-time promise ({r['detail']!r})")
  ok(r['filled'] == ['Help me write testimony'], f"exactly one filled button in view, Help me write testimony (A-3): {r['filled']}")
  ok(r['link'] == 'Email the chair instead · 2 min', f"the plain link under it ({r['link']!r})")
  ok(r['follow'] == 'Follow this issue', f"a newcomer has Follow this issue ({r['follow']!r})")
  ok(r['stance'] == 0, 'no stance chips on the first screen: the letter asks')
  ok(r['words'] < 60 and r['styles'] <= 6, f"the slide under 60 words and 6 text styles ({r['words']} words, {r['styles']} styles)")
  ok(not r['moreOpen'], 'More about this bill starts closed')
  ok(r['back'] == 'Home' and r['lit'] == [], f"Back says Home and no tab is lit ({r['back']!r}, {r['lit']})")
  ok(pg.evaluate("() => document.body.classList.contains('v2') && !!document.querySelector('link[href=\"pub/v2/v2.css\"]')"), 'the page brings version 2\'s stylesheet and marks the body')
  ok(pg.evaluate("() => [...document.querySelectorAll('summary')].find(s => /More about this bill/.test(s.textContent))?.innerText.replace(/\\s+/g, ' ').trim()") == 'More about this bill What it does, where it is (step 5 of 9), who decides', 'the row says what it holds, with the step')
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
  chip = pg.evaluate("() => { const e = document.querySelector('.v2-go .v2-following'); if (!e) return null; const cs = getComputedStyle(e); return { text: e.textContent.trim(), pressed: e.getAttribute('aria-pressed'), bg: cs.backgroundColor, color: cs.color }; }")
  ok(chip and chip['text'] == 'Following' and chip['pressed'] == 'true' and chip['bg'] != 'rgb(0, 105, 142)', f'followed: a pale Following chip, not the filled blue ({chip})')
  ok(len(pg.evaluate(LOOK)['filled']) == 1, f"still one filled button after following {pg.evaluate(LOOK)['filled']}")
  pg.click('.v2-go .v2-following'); pg.wait_for_timeout(700)
  ok(pg.evaluate(LOOK)['follow'] == 'Follow this issue', 'pressing Following stops following')
  ok(not errs, f'no errors after following {errs[:2]}')
  ctx.close()

  # ---------------- the email walkthrough from the link ----------------
  errs = []; ctx, pg = page(br, PHONE, f'{BASE}/track.html?demo=1&v2=1#/bill/HB2300', returning=True, errs=errs)
  pg.wait_for_selector('#main .v2-slide', timeout=30000); pg.wait_for_timeout(700)
  pg.click('.v2-go .btn.text'); pg.wait_for_timeout(1000)
  ok(pg.evaluate("() => !!document.querySelector('#hp-dlg[open]')"), 'Email the chair instead opens the email walkthrough')
  ok(not errs, f'no errors {errs[:2]}'); ctx.close()

  # ---------------- a bill waiting for a hearing; a stopped bill between sessions ----------------
  errs = []; ctx, pg = page(br, PHONE, f'{BASE}/track.html?demo=1&v2=1#/bill/HB1671', errs=errs)
  pg.wait_for_selector('#main .v2-slide', timeout=30000); pg.wait_for_timeout(700); r = pg.evaluate(LOOK)
  ok(re.fullmatch(r'Needs a hearing by \w{3}, \w{3} \d+ · ask the chair', r['detail']) is not None, f"between hearings the one thing to do ({r['detail']!r})")
  ok(r['filled'] == ['Ask the chair for a hearing'] and r['link'] == '' and r['h1top'] < 320, f"the hearing's own ask, one filled button, no email link ({r['filled']}, {r['link']!r})")
  ok(r['follow'] == 'Follow this issue' and not r['wide'], 'Follow this issue, nothing scrolls sideways'); ctx.close()
  ctx, pg = page(br, PHONE, f'{BASE}/track.html?demo=1&v2=1&season=off#/bill/HB2121', errs=errs)
  pg.wait_for_selector('#main .v2-slide', timeout=30000); pg.wait_for_timeout(700); r = pg.evaluate(LOOK)
  ok(r['detail'].startswith('Did not advance in 20') and r['filled'] == ['Follow the issue'] and r['follow'] == '', f"between sessions: the state in one phrase, the issue's Follow the one button, no second Follow ({r['detail']!r}, {r['filled']}, {r['follow']!r})"); ctx.close()
  ctx, pg = page(br, PHONE, f'{BASE}/track.html?demo=1&v2=1&season=off#/bill/HB2300', errs=errs)
  pg.wait_for_selector('#main .v2-slide', timeout=30000); pg.wait_for_timeout(700); r = pg.evaluate(LOOK)
  ok(r['detail'] == 'Became law' and len(r['filled']) == 1, f"a law: its state, one filled button ({r['detail']!r}, {r['filled']})")
  ok(not errs, f'no errors {errs[:2]}'); ctx.close()

  # ---------------- version 2, a laptop ----------------
  errs = []; ctx, pg = page(br, LAPTOP, f'{BASE}/track.html?demo=1&v2=1#/bill/HB2300', errs=errs)
  pg.wait_for_selector('#main .v2-slide', timeout=30000); pg.wait_for_timeout(900); r = pg.evaluate(LOOK)
  geo = pg.evaluate("() => { const a = document.querySelector('.v2-slide').getBoundingClientRect(), b = document.querySelector('.v2-more').getBoundingClientRect(); return { slideRight: a.right, moreLeft: b.left, sameTop: Math.abs(a.top - b.top) < 120 }; }")
  ok(geo['slideRight'] <= geo['moreLeft'] and geo['sameTop'], f'the slide on the left, More about this bill beside it on the right ({geo})')
  ok(r['moreOpen'] and 'Where it is now' in pg.evaluate("() => document.querySelector('.v2-more').innerText"), 'More about this bill is open')
  ok(r['filled'] == ['Help me write testimony'] and not r['wide'], f"one filled button, nothing scrolls sideways ({r['filled']})")
  ok(not errs, f'no errors {errs[:2]}'); ctx.close()

  # ---------------- today's page (no ?v2=1): nothing of version 2, and the three fixes ----------------
  errs = []; reqs = []
  ctx = br.new_context(**PHONE); pg = ctx.new_page(); pg.on('request', lambda q: reqs.append(q.url)); pg.on('pageerror', lambda e: errs.append(str(e)))
  pg.goto(f'{BASE}/track.html?demo=1#/bill/HB2300'); pg.wait_for_selector('#main .bl-head h1', timeout=30000); pg.wait_for_timeout(2800)
  ok(not pg.query_selector('.v2-slide') and not pg.evaluate("document.body.classList.contains('v2')"), 'without the flag the page is today\'s')
  ok(not [u for u in reqs if '/pub/v2/' in u] and not pg.query_selector('link[href="pub/v2/v2.css"]'), 'and nothing of version 2 is fetched')
  ok(pg.evaluate("() => [...new Set([...document.querySelectorAll('#main .acard .btn.primary')].map(e => e.textContent.trim()))].join('|')") == 'Help me write testimony', 'its main button reads as before')
  b = pg.evaluate("() => { const e = document.querySelector('.bl-iband .bl-ib-btn'); return e && e.textContent.trim(); }")
  ok(b == 'Follow the issue', f'3a: a newcomer has Follow the issue in the band ({b!r})')
  ok(pg.evaluate("() => document.querySelector('.bl-back span').textContent.trim()") == 'Home' and pg.evaluate("() => document.querySelectorAll('.tabs [aria-current]').length") == 0, '3b: a bill opened first says Home on Back and lights no tab')
  small = pg.evaluate("() => [...document.querySelectorAll('.bl-ib-l a, .bl-ib-n a, .bl-rspons a')].map(e => [e.className || e.parentElement.className, Math.round(e.getBoundingClientRect().height)]).filter(x => x[1] < 44)")
  ok(not small, f'3c: the Its issue link, the issue name and the sponsors are 44px targets {small}')
  pg.click('.bl-back'); pg.wait_for_timeout(900)
  ok(re.search(r'#/(start/0)?$', pg.evaluate('location.hash')) is not None, f"3b: Back goes Home, a newcomer's front door ({pg.evaluate('location.hash')})")
  ok(not errs, f'no page errors {errs[:2]}'); ctx.close()
  # a visit with an earlier page keeps real Back: the bill, its issue's page, another bill
  ctx, pg = page(br, PHONE, f'{BASE}/track.html?demo=1#/bill/HB2300', returning=True, errs=errs)
  pg.wait_for_selector('#main .bl-head h1', timeout=30000); pg.wait_for_timeout(700)
  pg.click('.bl-ib-n a'); pg.wait_for_selector('#main a[href^="#/bill/"]', timeout=15000); pg.wait_for_timeout(500)
  pg.click('#main a.rc-row[href^="#/bill/"]:not([href$="HB2300"])'); pg.wait_for_selector('#main .bl-head h1', timeout=15000); pg.wait_for_timeout(500)
  back = pg.evaluate("() => document.querySelector('.bl-back span').textContent.trim()")
  ok(back not in ('Home', 'Back', ''), f'a bill opened from an issue page still says where Back goes ({back!r})')
  ctx.close(); br.close()
print('all passed' if not fails else f'{fails} failed'); sys.exit(1 if fails else 0)
