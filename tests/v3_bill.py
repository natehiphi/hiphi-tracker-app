# R-362 Part 5: version 3's bill page top (pub/v3/bill.js), behind ?v3=1. Run at http://127.0.0.1:PORT/track.html?demo=1&v3=1#/bill/HB2121
#   (a bill with a hearing) and HB1671 (waiting for a hearing, none set). Checks (DESIGN A-1, A-3, A-13, A-14, B-14):
#     - pub/v3/bill.js is the module that draws the page (it is fetched, and the page carries .bl-v3)
#     - at 390x844 the title, the status line, the deadline line and the one button all end above 600px (A-1)
#     - exactly one filled button on the page (A-3); the stance chips sit below it; Where it is now and three closed folds follow
#     - the deadline is said once: the status line leaves out the moment the deadline line holds (A-14)
#     - Share opens its sheet; Follow this issue becomes Following and back
#     - 1280 and 1440: two columns, the side panel (button and stance) on the right and sticky; no sideways scroll at 320, 390, 1280
#     - #/bill/HB2121/testify opens the letter (today's walkthrough until Part 6 lands, the v2 letter after; either passes)
#     - the practice copy without ?v3=1 draws no .bl-v3
# usage: python3 tests/v3_bill.py [BASE]   (BASE defaults to http://localhost:8832; http://127.0.0.1:8875/track.html?demo=1 works too)
import os, sys
from playwright.sync_api import sync_playwright

BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832').split('/track.html')[0].rstrip('/')
fails = 0
def ok(cond, what):
  global fails
  print(('PASS ' if cond else 'FAIL ') + what)
  if not cond:
    fails += 1
    if os.environ.get('GITHUB_ACTIONS'): print('::error title=v3_bill::' + what.replace('%', '%25').replace('\n', ' '))
    sm = os.environ.get('GITHUB_STEP_SUMMARY')
    if sm:
      try:
        with open(sm, 'a', encoding='utf-8') as f: f.write(f'- FAIL v3_bill: {what}\n')
      except OSError: pass

READY = """async () => {
  const nap = ms => new Promise(r => setTimeout(r, ms)), end = performance.now() + 8000;
  while (performance.now() < end) {
    try { const got = await Promise.all(['700 1em Poppins', '400 1em Lato', '700 1em Lato'].map(f => document.fonts.load(f)));
      await document.fonts.ready; if (got.every(a => a.length > 0 && a.every(f => f.status === 'loaded'))) return true; } catch (e) {}
    await nap(100);
  }
  return false;
}"""
URL = lambda num, extra='': f'{BASE}/track.html?demo=1&v3=1{extra}#/bill/{num}'
def open_bill(br, num, w, h, extra=''):
  pg = br.new_page(viewport={'width': w, 'height': h})
  pg.on('pageerror', lambda e: errs.append(str(e)))
  pg.goto(URL(num, extra)); pg.wait_for_selector('.bl-v3', timeout=20000)
  if not pg.evaluate(READY): ok(False, f'{w}: the webfonts loaded (a fonts outage, not a layout to judge)')
  pg.wait_for_timeout(600)
  return pg
BOTTOM = "sel => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return Math.round(r.bottom + scrollY); }"
errs = []

with sync_playwright() as p:
  br = p.chromium.launch()
  for num, hearing in (('HB2121', True), ('HB1671', False)):
    pg = open_bill(br, num, 390, 844)
    seen = []
    pg.on('request', lambda r: seen.append(r.url))
    ok('pub/v3/bill.js' in ' '.join(pg.evaluate("performance.getEntriesByType('resource').map(r => r.name)")), f'{num}: pub/v3/bill.js is the module that drew the page')
    h1, status, when, btn = (pg.evaluate(BOTTOM, s) for s in ('.bl-v3 h1', '.bl-v3 .v3-status', '.bl-v3 .v3-when', '.bl-v3 .v3-go .btn.primary'))
    ok(h1 is not None and h1 < 600, f'{num} 390x844: the title ends above 600px ({h1})')
    ok(status is not None and status < 600, f'{num} 390x844: the status line ends above 600px ({status})')
    ok(when is not None and when < 600, f'{num} 390x844: the deadline line ends above 600px ({when})')
    ok(btn is not None and btn < 600, f'{num} 390x844: the one button ends above 600px ({btn})')
    ok(pg.locator('#main .btn.primary:visible').count() == 1, f'{num}: exactly one filled button on the page (A-3)')
    st = pg.evaluate("sel => { const e = document.querySelector(sel); return e ? Math.round(e.getBoundingClientRect().top + scrollY) : null; }", '.v3-stance .chip')
    ok(st is not None and btn is not None and st > btn, f'{num}: the stance chips sit below the button ({st} > {btn})')
    ok(pg.locator('.bl-v3 .v3-stance .chip').count() == 3, f'{num}: three stance chips')
    ok(pg.locator('.bl-v3 .bl-rwhere').count() == 1, f'{num}: Where it is now is on the page')
    ok(pg.locator('.bl-v3 details.bl-rfold').count() >= 3, f'{num}: at least three folds ({pg.locator(".bl-v3 details.bl-rfold").count()})')
    ok(pg.locator('.bl-v3 details.bl-rfold[open]').count() == 0, f'{num}: the folds start closed')
    sa, wa = pg.inner_text('.v3-status').strip(), pg.inner_text('.v3-when').strip()
    key = {'HB2121': 'Send testimony by', 'HB1671': 'Needs a hearing by'}[num]
    ok(wa.startswith(key), f'{num}: the deadline line says "{wa}"')
    ok(not any(w in sa for w in ('due ', 'Needs a hearing by', 'Send testimony')) and sa, f'{num}: the status line leaves the deadline out ("{sa}")')
    ok(pg.evaluate("document.documentElement.scrollWidth <= innerWidth + 1"), f'{num} 390: no sideways scroll')
    # Share: its sheet opens.
    pg.click('.bl-sharebtn'); pg.wait_for_timeout(500)
    ok(pg.locator('dialog.af-sheet[open]').count() >= 1, f'{num}: Share opens its sheet')
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    # Follow: the issue's Follow becomes Following and back.
    f = pg.locator('.v3-issue [data-bl-followissue], .v3-issue [data-bl-newfollow]')
    if f.count():
      f.first.click(); pg.wait_for_timeout(1200)
      if pg.locator('dialog[open]').count(): pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
      ok(pg.locator('.v3-issue [data-bl-unfollowissue]').count() == 1, f'{num}: Follow this issue becomes Following')
      # a newcomer's follow has its moment, and Following ignores a tap meant for the moment's Continue (bill.js blQuietUntil): wait it out
      for _ in range(8):
        pg.locator('.v3-issue [data-bl-unfollowissue]').first.click(timeout=2000) if pg.locator('.v3-issue [data-bl-unfollowissue]').count() else None
        pg.wait_for_timeout(1500)
        if not pg.locator('.v3-issue [data-bl-unfollowissue]').count(): break
      ok(pg.locator('.v3-issue [data-bl-followissue], .v3-issue [data-bl-newfollow]').count() == 1, f'{num}: and back to Follow this issue')
    else:
      ok(pg.locator('.v3-issue').count() == 0 or pg.locator('.v3-issue [data-bl-unfollowissue]').count() == 1, f'{num}: the issue is followed already or the bill has none')
      pg.click('.bl-menuwrap [data-bl-menu]'); pg.click('[data-bl-star]'); pg.wait_for_timeout(800)
      ok(True, f'{num}: Follow from the menu')
    pg.close()

  for w, h in ((320, 568), (1280, 800), (1440, 900)):
    pg = open_bill(br, 'HB2121', w, h)
    ok(pg.evaluate("document.documentElement.scrollWidth <= innerWidth + 1"), f'{w}: no sideways scroll')
    if w >= 1100:
      r = pg.evaluate("""() => { const m = document.querySelector('.bl-v3 .bl-main').getBoundingClientRect(), s = document.querySelector('.bl-v3 .v3-side').getBoundingClientRect(), b = document.querySelector('.v3-side .btn.primary').getBoundingClientRect(), c = document.querySelector('.v3-side .chip').getBoundingClientRect();
        return { mr: m.right, sl: s.left, bl: b.left, cl: c.left, sp: getComputedStyle(document.querySelector('.bl-v3 .v3-side')).position }; }""")
      ok(r['sl'] > r['mr'], f'{w}: two columns, the side panel to the right of the story ({r["sl"]:.0f} > {r["mr"]:.0f})')
      ok(r['bl'] > r['mr'] and r['cl'] > r['mr'], f'{w}: the button and the stance chips are in the side panel')
      ok(r['sp'] == 'sticky', f'{w}: the side panel is sticky')
      pg.evaluate("scrollTo(0, 500)"); pg.wait_for_timeout(300)
      t = pg.evaluate("document.querySelector('.v3-side').getBoundingClientRect().top")
      ok(0 <= t < 200, f'{w}: scrolled 500px down the side panel is still in view (top {t:.0f})')
    pg.close()

  # the deep link opens the letter (today's walkthrough until Part 6, the v2 letter after)
  pg = br.new_page(viewport={'width': 390, 'height': 844})
  pg.goto(URL('HB2121/testify')); pg.wait_for_timeout(3500)
  ok(pg.evaluate("document.body.classList.contains('hp-lock') || !!document.querySelector('[class*=\"hp-\"], [class*=\"v2l\"]')"), '/testify opens the letter')
  pg.close()

  # without the flag nothing of version 3 draws
  pg = br.new_page(viewport={'width': 390, 'height': 844})
  pg.goto(f'{BASE}/track.html?demo=1#/bill/HB2121'); pg.wait_for_selector('.bl-page', timeout=20000); pg.wait_for_timeout(500)
  ok(pg.locator('.bl-v3').count() == 0, 'no ?v3=1: no .bl-v3 on the page')
  pg.close()
  br.close()

errs = [e for e in errs if 'ResizeObserver' not in e]
ok(not errs, f'no page errors ({errs[:2]})')
print('all passed' if not fails else f'{fails} failed')
sys.exit(1 if fails else 0)
