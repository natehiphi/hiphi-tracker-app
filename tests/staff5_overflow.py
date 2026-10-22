# Staff v5: no label spills out of its card or cell at 1280 and 1440 px (R-316 W54, O-17, S-11). A chip, a status or
# a table cell's text must end inside the card, week block, row or table cell that holds it. On the practice copy (Mon
# 16 Mar 2026) as Nate and Kris. Exits 1 when a check fails.
#   python3 tests/staff5_overflow.py                  against http://localhost:8832
#   V4_ROOT=/path/to/worktree python3 tests/staff5_overflow.py    serves that folder straight into the browser
import os, sys
from playwright.sync_api import sync_playwright
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from staff5_people import router, HOST, ROOT

fails = []
def check(ok, what):
  print(('ok   ' if ok else 'FAIL ') + what)
  if not ok: fails.append(what)

SPILL = """() => { const out = [];
  for (const el of document.querySelectorAll('main .sv-chip, main .chip, main th, main td > *')) {
    if (!el.getClientRects().length || el.closest('details:not([open])')) continue;
    const box = el.parentElement && el.parentElement.closest('.wk-blk, td, th, .card, .td-row, .ist-row, .row'); if (!box) continue;
    const r = el.getBoundingClientRect(), b = box.getBoundingClientRect();
    if (r.right > b.right + 2 && getComputedStyle(box).overflow !== 'hidden') out.push(`${(el.innerText || '').trim().slice(0, 40)} +${Math.round(r.right - b.right)}px`);
    else if (el.matches('th') && el.scrollWidth > el.clientWidth + 2) out.push(`header "${el.innerText.trim()}" cut`);
  }
  return out; }"""
ROUTES = ['/?view=week', '/?view=week&scope=team', '/?scope=team', '/outreach/emails', '/outreach/supporters']

with sync_playwright() as p:
  br = p.chromium.launch()
  for w in (1280, 1440):
    for who in ('NT', 'KR'):
      pg = br.new_page(viewport={'width': w, 'height': 900})
      if ROOT: pg.route(HOST + '/**', router)
      pg.goto(HOST + f'/staff5.html?demo=1&as={who}#/'); pg.wait_for_timeout(4500)
      for r in ROUTES:
        pg.evaluate(f"location.hash = '#{r}'"); pg.wait_for_timeout(1800)
        got = pg.evaluate(SPILL)
        check(not got, f'{who} {r} at {w}: nothing spills out ({"; ".join(got[:3])})')
      pg.close()
  br.close()
print('\nall passed' if not fails else f'\n{len(fails)} failed'); sys.exit(1 if fails else 0)
