# Every screen of today's first visit fits the window, with nothing to scroll (R-265, Nate 12 Oct: "all onboarding slides
# can be viewed without needing to scroll at all. All images and text are visible the entire time"; his answers: phones
# from about 390x660 of visible page, laptops from 1280x600, by trimming, today's version only).
#   python3 -m http.server 8832   (in this folder, once)
#   python3 tests/first_visit_fits.py [base]   base defaults to http://localhost:8832
# Walks today's version, in session and between sessions, on a 390x664 phone and a 1280x600 laptop (the practice band on,
# so 28px tighter than the live site): on every screen the page is no taller than the window, nothing sits under the
# phone's bottom bar, no issue that starts ticked is left out, and the plans get none of the trimming (pub/start.js
# fitScreen). Also the story's last stage after each of its two doors, and no page errors.
# Two screens are left whole and may scroll (Nate, 12 Oct: "we need to show people many options to choose from, do not cut
# that down at all"; the topic tiles "so pretty before"): the six topics and Your issues. For them the test checks the
# opposite: nothing trimmed, every issue card shown, the tiles with their icons, descriptions and counts.
import os, re, sys
from playwright.sync_api import sync_playwright
BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832').rstrip('/')
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out', 'first_visit_fits'); os.makedirs(OUT, exist_ok=True)
res = []
def ok(c, m): res.append(bool(c)); print('PASS' if c else 'FAIL', m)
MEASURE = """() => {
  const H = innerHeight, bar = document.querySelector('.actionbar'), br = bar && getComputedStyle(bar).position === 'fixed' ? bar.getBoundingClientRect() : null;
  let under = 0;
  if (br) for (const el of document.querySelectorAll('main .st h1, main .st h2, main .st p, main .st li, main .st button, main .st input, main .st svg')) {
    const r = el.getBoundingClientRect(); if (!r.height || el.closest('.fx-bloom, .st-petals')) continue;
    if (r.bottom > br.top + 1) under = Math.max(under, Math.round(r.bottom - br.top));
  }
  const st = document.querySelector('main > .st');
  const hiddenTicked = [...document.querySelectorAll('.st-pcard.on.fit-gone, .st-pcard.fit-gone [aria-pressed=true]')].length;
  const shown = s => [...document.querySelectorAll(s)].filter(e => e.getClientRects().length).length;
  const whole = st && st.matches('.st-topics, .st2') ? { gone: document.querySelectorAll('.fit-gone').length, cards: document.querySelectorAll('.st-pcard').length,
    cardsShown: shown('.st-pcard'), lines: document.querySelectorAll('.st-pwhat').length, linesShown: shown('.st-pwhat'),
    tiles: shown('.st-tile'), icons: shown('.st-tile .st-ilead'), descs: shown('.st-tile .st-idesc'), counts: shown('.st-tile .st-icount') } : null;
  return { whole, over: document.scrollingElement.scrollHeight - H, under, hiddenTicked, title: document.title.split(' · ')[0],
    fit: st ? [...st.classList].filter(c => /^fit\\d/.test(c)).length : 0 };
}"""

def walk(br, ab, w, h, off=False, door=0, errs=None):
    m = w < 700
    c = br.new_context(viewport={'width': w, 'height': h}, is_mobile=m, has_touch=m, reduced_motion='reduce'); p = c.new_page()
    p.on('pageerror', lambda e: errs.append(f'{ab} {w}: {e}'))
    p.goto(f"{BASE}/track.html?demo=1&restart&ab={ab}{'&season=off' if off else ''}"); p.wait_for_selector('main h1', timeout=40000); p.wait_for_timeout(1200)
    seen, last = [], None
    for _ in range(45):
        if not re.search(r'#/start/', p.url): break
        if p.locator('#fx-moment:not([hidden]) #fx-mgo').count(): p.click('#fx-moment #fx-mgo'); p.wait_for_timeout(600); continue
        # Every state is measured, not only each new screen: the story's last stage after its choice is the tallest.
        r = p.evaluate(MEASURE)
        if not r['whole'] and (r['over'] > 1 or r['under'] > 0): p.wait_for_timeout(1000); r = p.evaluate(MEASURE)   # not a screen still arriving
        key = r['title'] + p.url + p.locator('main').inner_text()
        if key != last: last = key; seen.append(r)
        if not r['whole'] and (r['over'] > 1 or r['under'] > 0): p.screenshot(path=os.path.join(OUT, f"{ab.replace(',', '_')}_{w}x{h}{'_off' if off else ''}_{len(seen)}.png"))
        if p.locator('.st-tile').count() and not p.locator('.st-tile[aria-pressed=true]').count(): p.locator('.st-tile').nth(2).click(); p.wait_for_timeout(200)
        if p.locator('.lx-ch').count() and p.locator('.lx-ch').first.is_visible() and not p.locator('.lx-ch[aria-pressed=true]').count():
            p.locator('.lx-ch').nth(door).click(); p.wait_for_timeout(1200); continue
        sels = ('.st-bar [data-stskip]',) if p.locator('.st-alertspage form').count() else ()
        for sel in (*sels, '[data-obnot]', '.ob-joinbtns [data-stskip]', '[data-stdone]', '.st-bar [data-stnext]', '[data-stnext]', '[data-obon]', '[data-stskip]'):
            if p.locator(sel).count() and p.locator(sel).first.is_visible():
                p.locator(sel).first.click(); break
        else: break
        p.wait_for_timeout(900)
    c.close()
    return seen

with sync_playwright() as pw:
    br = pw.chromium.launch(); errs = []
    for (w, h) in ((390, 664), (1280, 600)):
        for off in (False, True):
            for door in (0, 1):
                where = f"{'phone' if w < 700 else 'laptop'} {w}x{h}{' between sessions' if off else ''}, the story's {'first' if door == 0 else 'second'} door"
                seen = walk(br, 'onb.today', w, h, off, door, errs)
                ok(len(seen) >= 6, f'{where}: walked the first visit ({len(seen)} states)')
                bad = [f"{r['title']} +{r['over']}px/under bar {r['under']}px" for r in seen if not r['whole'] and (r['over'] > 1 or r['under'] > 0)]
                wh = [r for r in seen if r['whole']]
                ok(len(wh) >= 2 and all(r['fit'] == 0 and r['whole']['gone'] == 0 and r['whole']['cardsShown'] == r['whole']['cards'] and r['whole']['linesShown'] == r['whole']['lines'] for r in wh)
                   and any(r['whole']['tiles'] == 6 and r['whole']['icons'] == 6 and r['whole']['descs'] == 6 and r['whole']['counts'] == 6 for r in wh)
                   and any(r['whole']['cards'] >= 8 for r in wh),
                   f"{where}: the topics and Your issues are left whole {[r['whole'] for r in wh][:2]}")
                ok(not bad, f'{where}: every screen fits the window {bad}')
                ok(all(r['hiddenTicked'] == 0 for r in seen), f'{where}: no ticked issue is left out')
    # The versions inside today's (the short page, three ways to help, the other sign-up words): the same.
    for ab in ('onb.today,fv.short', 'onb.today,act.three', 'onb.today,save.alerts'):
        seen = walk(br, ab, 390, 664, errs=errs)
        bad = [f"{r['title']} +{r['over']}px" for r in seen if not r['whole'] and (r['over'] > 1 or r['under'] > 0)]
        ok(seen and not bad, f'{ab} phone 390x664: every screen fits {bad}')
    # A plan is left as it was (Nate: today's version only).
    seen = walk(br, 'onb.p5', 390, 664, errs=errs)
    ok(seen and all(r['fit'] == 0 for r in seen), 'Plan 5: no trimming applied (today\'s version only)')
    ok(not errs, 'no page errors ' + '; '.join(errs[:3]))
print(f"{res.count(False)} failed, {res.count(True)} passed")
sys.exit(1 if False in res else 0)
