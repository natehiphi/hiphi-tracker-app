# R-357 Part 4 (Nate, 30 Oct 2026): version 2's first visit, in seven taps, behind ?v2=1 (pub/start.js `v2()`, pub/start-rest.js `stepWhy`,
# pub/v2/story.js). DESIGN C-12, C-13, C-14, B-12, B-2's new row.
#   v2 (?demo=1&v2=1&restart#/, a 375x812 phone), the seven taps from the welcome to Home, each counted:
#     1 Let's begin   2 a topic   3 a second topic   4 Next   5 Follow N issues   6 Next on "Why your note counts"   7 Skip this part on the profile ask
#     - Your issues: exactly two ticked under each topic shown (at least one), the button "Follow N issues" counts them, and the line
#       "The two most active under each topic are ticked; change them as you like." is there at reading size (16px or more, C-14)
#     - "Why your note counts": the drawing, the heading, the two sentences, the two rows with their times, one filled button "Next", no
#       Skip and no question (C-13), nothing to scroll in a 375x812 window (the first visit fits, R-265), and the sentences at 16px or more
#     - the profile ask follows as today (Save your profile), its cover carries "See How I Can Help" and Home arrives by itself: seven taps
#     - Back from the teaching screen is Your issues; the cover's button also moves on, at once
#     - coming back to change the issues (#/start/1 after the visit) does not teach again, and does not go through the story
#     - a shared bill's visit (wiz via) is the follow ask, then the profile ask, then Home
#   the story card (pub/v2/story.js): importing it touches nothing; storyCard() is { html, wire } with the title, its line, "Read it" and
#     "Not now"; Not now removes it and keeps the mark; with the mark it returns no html; Read it's page is the story (#/learn/story) in the
#     first visit's frame with Back and a last button Done, which returns to Home and marks it
#   today's page (no v2): the issues step is R-245's (four ticked, "We ticked 4 to start."), and after the profile ask come the story's four
#     pages, Coming up and "You're all set" with the recap, and no "Why your note counts" anywhere
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
norm = lambda s: re.sub(r'\s+', ' ', (s or '').replace('’', "'").replace(' ', ' ')).strip()
# what is on the first-visit screen now: the heading, the words, the filled buttons in view, whether it fits the window
LOOK = """() => {
  const vis = e => { const r = e.getBoundingClientRect(); return e.checkVisibility({ visibilityProperty: true }) && r.width > 0 && r.height > 0; };
  const st = document.querySelector('main > .st'), h1 = document.getElementById('st-h');
  const px = e => e ? parseFloat(getComputedStyle(e).fontSize) : 0;
  return { h1: h1 && h1.innerText.trim(), text: (document.querySelector('main') || document.body).innerText, over: document.scrollingElement.scrollHeight - innerHeight,
    filled: [...document.querySelectorAll('.btn.primary')].filter(vis).map(e => e.innerText.trim()), skip: [...document.querySelectorAll('[data-stskip]')].filter(vis).length,
    art: !!document.querySelector('.st-art svg.art-voices') && vis(document.querySelector('.st-art svg')), ledes: [...document.querySelectorAll('.st .lede')].map(e => [e.innerText.trim(), px(e)]),
    rows: [...document.querySelectorAll('.st-whyways li')].map(li => [li.querySelector('b')?.innerText.trim(), li.querySelector('span:not(.st-vic)')?.innerText.trim()]),
    strip: [...document.querySelectorAll('.st-chapters .st-cl')].map(e => e.innerText.trim()), choices: document.querySelectorAll('.lx-ch, .lx-quiz, [data-lx-q]').length,
    cls: st ? st.className : '', screen: document.body.dataset.screen, hash: location.hash }; }"""
ISSUES = """() => [...document.querySelectorAll('.st-tsec')].map(sec => ({ name: sec.querySelector('.st-tname')?.innerText.trim(), cards: sec.querySelectorAll('.st-pcard').length,
  ticked: sec.querySelectorAll('.st-pcard.on').length, pressed: sec.querySelectorAll('[data-stpick][aria-pressed=true]').length }))"""

RETURNING = "const w = JSON.stringify({step: 9, issues: [], done: true}); localStorage.setItem('hiphi_wiz', w); localStorage.setItem('hiphi_wiz_demo', w)"
def newpage(br, url, errs=None, kw=PHONE, returning=False):
  ctx = br.new_context(**kw); pg = ctx.new_page()
  if returning: ctx.add_init_script(RETURNING)
  if errs is not None:
    pg.on('pageerror', lambda e: errs.append('pageerror ' + str(e)))
    pg.on('console', lambda m: errs.append('console ' + m.text) if m.type == 'error' else None)
  pg.goto(url); pg.wait_for_selector('main h1', timeout=40000); pg.wait_for_timeout(1200)
  return ctx, pg

def settle(pg, ms=1800): pg.wait_for_timeout(ms)

with sync_playwright() as pw:
  br = pw.chromium.launch()
  # ======================= version 2, the seven taps =======================
  errs = []; ctx, pg = newpage(br, f'{BASE}/track.html?demo=1&v2=1&restart#/', errs)
  taps = []
  def tap(what, sel, nth=0):
    pg.locator(sel).nth(nth).click(); taps.append(what); settle(pg, 900)
  r = pg.evaluate(LOOK)
  ok(r['h1'] and 'Your voice can shape' in r['h1'], f"the welcome is unchanged ({r['h1']!r})")
  tap("Let's begin", '.st-bar [data-stnext]')                                    # 1
  ok(pg.locator('.st-tile').count() >= 2, 'the topics are unchanged: tiles to pick from')
  tap('a topic', '.st-tile', 0)                                                  # 2
  tap('a second topic', '.st-tile', 1)                                            # 3
  tap('Next', '.st-bar [data-stnext]'); settle(pg, 1800)                          # 4
  r = pg.evaluate(LOOK); sec = pg.evaluate(ISSUES)
  ok(r['h1'] == 'Your issues', f"Your issues ({r['h1']!r})")
  ok(len(sec) == 2 and all(s['cards'] >= 2 and s['ticked'] == 2 and s['pressed'] == 2 for s in sec), f"exactly two issues ticked under each topic shown (at least one): {sec}")
  line = 'The two most active under each topic are ticked; change them as you like'
  ok(any(norm(t).startswith(line) and px >= 16 for t, px in r['ledes']), f"the line under the heading, 16px or more (C-14): {r['ledes']}")
  ok(r['filled'] == ['Follow 4 issues'], f"the button counts them: {r['filled']}")
  pg.screenshot(path=os.path.join(OUT, 'issues.png'))
  tap('Follow 4 issues', '.st-bar [data-stnext]'); settle(pg, 2200)               # 5
  r = pg.evaluate(LOOK)
  ok(r['h1'] == 'Why your note counts' and pg.title().startswith('Why your note counts'), f"the teaching step follows the issues, before the profile ask ({r['h1']!r}, tab {pg.title()!r})")
  t = norm(r['text'])
  ok('Lawmakers decide on these bills in committee hearings, and they read what people send in.' in t, 'sentence one')
  ok('A few sentences from you, in your own words, is testimony. The tracker writes the first draft; you make it yours.' in t, 'sentence two')
  rows = [[norm(a), norm(b)] for a, b in r['rows']]
  ok(rows == [['Testimony', "Goes on the hearing's record · about 10 min the first time, 3 after"], ['An email to the committee chair', 'about 2 min']], f"the two plain rows with their times: {rows}")
  ok(r['filled'] == ['Next'] and r['skip'] == 0, f"one filled button, Next, and no Skip: {r['filled']}")
  ok(r['choices'] == 0 and '?' not in t, 'no question and no quiz (C-13)')
  ok(r['art'], 'the drawing of speaking up (art.js VOICES) is shown')
  ok(r['over'] <= 1, f"nothing to scroll in a 375x812 window ({r['over']}px over) ({r['cls']})")
  ok(all(px >= 16 for _, px in r['ledes']), f"the sentences are 16px or more (C-14): {[px for _, px in r['ledes']]}")
  ok(r['strip'] == ['Your issues', 'Your voice', 'Your profile'], f"the signpost names the three parts: {r['strip']}")
  ok(not re.search(r'few people|most people don.t|fewer than', t, re.I) and 'vape' not in t.lower(), 'nothing says or implies that few people act (R-171); no "vape"')
  pg.screenshot(path=os.path.join(OUT, 'why.png'))
  # Back is Your issues, with the ticks as they were; forward again
  pg.locator('.st-back').first.click(); settle(pg, 1500)
  r = pg.evaluate(LOOK); sec = pg.evaluate(ISSUES)
  ok(r['h1'] == 'Your issues' and all(s['ticked'] == 2 for s in sec), 'Back from the teaching step is Your issues, ticks kept')
  pg.locator('.st-bar [data-stnext]').click(); settle(pg, 2200)
  r = pg.evaluate(LOOK)
  ok(r['h1'] == 'Why your note counts', 'Follow N issues again comes back to the teaching step (the follow is the same)')
  tap('Next on Why your note counts', '.st-bar [data-stnext]'); settle(pg, 1800)   # 6
  r = pg.evaluate(LOOK)
  ok(r['h1'] == 'Save your profile', f"the profile ask follows as today ({r['h1']!r})")
  ok(r['over'] <= 1, f"the profile ask fits ({r['over']}px over)")
  pg.screenshot(path=os.path.join(OUT, 'profile.png'))
  tap('Skip this part (the profile ask)', '.st-bar [data-stskip]')               # 7
  pg.wait_for_selector('.st-cover .st-cvgo', timeout=4000)
  ok(norm(pg.locator('.st-cover .st-cvgo').inner_text()) == 'See How I Can Help', 'the Mahalo cover carries the first visit\'s last button, See How I Can Help')
  pg.wait_for_timeout(500)
  pg.screenshot(path=os.path.join(OUT, 'cover.png'))
  pg.wait_for_selector('.st-cover', state='detached', timeout=9000); settle(pg, 600)
  r = pg.evaluate(LOOK)
  ok(len(taps) == 7, f"seven taps from the welcome: {taps}")
  ok(r['hash'] == '#/' and r['screen'] == 'home', f"Home arrives by itself after the cover, no eighth tap ({r['hash']}, {r['screen']})")
  pg.screenshot(path=os.path.join(OUT, 'home.png'))
  # back at Home: a returner changes their issues (Home's "Pick the issues I care about" / Edit my issues is #/start/1): not taught again, not the story
  pg.evaluate("location.hash = '#/start/1'"); settle(pg, 1500)
  pg.locator('.st-tile').first.click(); settle(pg, 300)
  pg.locator('.st-bar [data-stnext]').click(); settle(pg, 1800)
  pg.locator('.st-bar [data-stnext]').click(); settle(pg, 2200)
  r = pg.evaluate(LOOK)
  ok('Why your note counts' not in r['text'] and 'bill’s story' not in r['text'] and "story" not in (r['h1'] or '').lower(), f"changing the issues later does not teach again or open the story ({r['h1']!r}, {r['hash']})")
  ok(not errs, f"nothing in the console but what the page always says ({errs[:2]})")
  ctx.close()

  # the cover's own button moves on at once (a tap on it, not a wait)
  errs = []; ctx, pg = newpage(br, f'{BASE}/track.html?demo=1&v2=1&restart#/', errs)
  for sel, n in (('.st-bar [data-stnext]', 0), ('.st-tile', 0), ('.st-tile', 1), ('.st-bar [data-stnext]', 0)): pg.locator(sel).nth(n).click(); settle(pg, 900)
  settle(pg, 1500); pg.locator('.st-bar [data-stnext]').click(); settle(pg, 2000); pg.locator('.st-bar [data-stnext]').click(); settle(pg, 1800)
  pg.locator('.st-bar [data-stskip]').click(); pg.wait_for_selector('.st-cover .st-cvgo', timeout=4000); pg.wait_for_timeout(1300)
  pg.locator('.st-cover .st-cvgo').click(); pg.wait_for_selector('.st-cover', state='detached', timeout=3000)
  ok(pg.evaluate("location.hash") == '#/', 'a tap on See How I Can Help lands on Home before the cover would have left by itself')
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
  ok('Why your note counts' not in ' '.join(h or '' for h in seen), 'and never shows Why your note counts')
  ok(not errs, f"nothing in the console but what the page always says ({errs[:2]})")
  ctx.close()
  br.close()

print(f"\n{'ALL PASS' if not fails else str(fails) + ' FAILED'}   screenshots: {OUT}")
sys.exit(1 if fails else 0)
