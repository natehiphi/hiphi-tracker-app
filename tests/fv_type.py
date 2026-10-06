# The first visit is large and short (R-174, DESIGN.md C-14; Nate 10/5: "The text during onboarding is far too small.
# Anything that users need to read should be prominent and not long."). Walks today's first visit and the five plans
# (pub/plans.js) on a phone, from the first screen to the end, and on every screen checks:
#   - nothing is smaller than 14px (the first visit's sizes are one step up, pub/base.css);
#   - 14px is only for a label, a count or the fine print (LABELS below); every word someone reads to move on is 16px+;
#   - the sentence under each heading (.lede) is short: at most LEDE_MAX words.
#   python3 -m http.server 8832   (in this folder, once)
#   python3 tests/fv_type.py [base]     base defaults to http://localhost:8832
import sys, re
from playwright.sync_api import sync_playwright
BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832').rstrip('/')
LEDE_MAX = 30
# What may be 14px: the three named parts, chips, a card's bill number and count, a tile's count, a lesson's "1 of 3",
# a time or a day label, and the text alerts' fine print. Anything else at 14px is a sentence someone has to read.
LABELS = ('.st-chapters, .chip, .st-pmeta, .st-icount, .st-catnote, .lx-count, .ob2-count, .ob2-trytag, .ob2-rbill, '
          '.ob2-where, .ob4-time, .st-when, .al-fine, .sr')
res = []
def ok(c, m): res.append(bool(c)); print('PASS' if c else 'FAIL', m)

SCAN = """(LABELS) => {
  const root = document.querySelector('#fx-moment:not([hidden])') || document.querySelector('main');
  const tiny = [], small = [], ledes = [];
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); let n;
  while ((n = w.nextNode())) {
    const t = n.textContent.replace(/\\s+/g, ' ').trim(), el = n.parentElement; if (!t || !el) continue;
    const r = el.getBoundingClientRect(); if (r.width < 1 || r.height < 1 || el.closest('[hidden], [aria-hidden=true], svg')) continue;
    const fs = parseFloat(getComputedStyle(el).fontSize);
    if (fs < 13.9) tiny.push(`${fs}px "${t.slice(0, 40)}"`);
    else if (fs < 15.9 && !el.closest(LABELS)) small.push(`${el.className || el.tagName} "${t.slice(0, 40)}"`);
  }
  root.querySelectorAll('.st .lede').forEach(l => ledes.push(l.innerText.trim()));
  return { tiny, small, ledes, title: document.title.split(' · ')[0] };
}"""

with sync_playwright() as p:
    br = p.chromium.launch()
    for v in ('today', 'p1', 'p2', 'p3', 'p4', 'p5'):
        ctx = br.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True); pg = ctx.new_page()
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(f'{BASE}/track.html?demo=1&restart&ab=onb.{v}')
        pg.wait_for_function("() => /#\\/start\\/1/.test(location.hash) && document.querySelector('.st-issue, [data-ob2], .st h1')", timeout=60000)
        pg.wait_for_timeout(1000)
        tiny, small, long, seen, last = [], [], [], 0, None
        for _ in range(40):
            if not re.search(r'#/start/', pg.url): break
            pg.wait_for_timeout(600)
            d = pg.evaluate(SCAN, LABELS)
            key = (pg.url, d['title'], tuple(d['ledes']))
            if key != last:
                seen += 1
                tiny += [f"{d['title']}: {x}" for x in d['tiny']]; small += [f"{d['title']}: {x}" for x in d['small']]
                long += [f"{d['title']}: {len(l.split())} words" for l in d['ledes'] if len(l.split()) > LEDE_MAX]
            last = key
            if pg.locator('#fx-moment:not([hidden]) #fx-mgo').count(): pg.click('#fx-moment #fx-mgo'); continue
            if pg.locator('[data-stissue]').count() and not pg.locator('[data-stissue][aria-pressed=true]').count():
                pg.locator('[data-stissue]').nth(3).click(); pg.click('[data-stnext]'); continue
            if d['title'] == 'Find a bill' and not pg.locator('[data-obfind][aria-pressed=true]').count():   # Plan 1 asks for one
                pg.locator('[data-obfind]').first.click(); pg.click('[data-stnext]'); continue
            for sel in ('.ob-joinbtns [data-stskip]', '[data-obnot]', '.actionbar [data-stlearnnext]', '.actionbar [data-stnext]',
                        '[data-stnext]', '.actionbar [data-obon]', '[data-stskip]', '[data-stdone]'):
                loc = pg.locator(sel)
                if loc.count() and loc.first.is_visible():
                    loc.first.click(); break
            else: break
        ok(seen >= 4, f'{v}: walked {seen} screens to the end')
        ok(not tiny, f'{v}: nothing under 14px {tiny[:3]}')
        ok(not small, f'{v}: 14px only for labels, counts and the fine print {small[:3]}')
        ok(not long, f'{v}: each sentence under a heading is {LEDE_MAX} words or fewer {long[:3]}')
        ok(not errs, f'{v}: no page errors {errs[:2]}')
        ctx.close()
    br.close()
print(f'{sum(res)}/{len(res)} passed'); sys.exit(0 if all(res) else 1)
