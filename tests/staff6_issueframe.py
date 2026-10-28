# R-346 (Nate's pick "bold", 27 Oct; it replaced R-340's issue frame over the name), made calm in R-352 part 6: the issue
# card on a Staff v6 bill page.
#   - a bill on an issue has the issue card in the right column, a white card like the others (the tint read as selected;
#     on a phone the three parts share one white card); nothing is left above the name
#   - "Its issue", the issue's name (none when it is the bill's own name: the title says it, R-352 FIX-2), how it stands in
#     one line; Open the issue ›
#   - no bill rows, no paragraph, no black "This bill" tag
#   - the hearing card, when there is one, comes first; on a laptop the column stands beside the bill's name; on a phone it
#     comes under the step card, before the doors
#   - Who is on it follows; nothing scrolls sideways and the page has no errors
# usage: python3 tests/staff6_issueframe.py [BASE]   (BASE defaults to http://localhost:8832)
import sys, asyncio
from playwright.async_api import async_playwright

BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832').rstrip('/')
fails = 0
def check(cond, what):
  global fails
  print(('PASS ' if cond else 'FAIL ') + what)
  if not cond: fails += 1

READ = """() => { const f = document.querySelector('.bw-side .bw-icard'), side = document.querySelector('.bw-side'), h1 = document.querySelector('.bw-h1'), top = e => e ? e.getBoundingClientRect().top + scrollY : null;
  // one column (a phone): the three parts share one white card, the column itself
  const box = f && getComputedStyle(f).boxShadow === 'none' && innerWidth < 900 ? side : f, cs = box ? getComputedStyle(box) : null, card = getComputedStyle(document.body).getPropertyValue('--v6-card').trim();
  return { card: !!f, tint: f ? [...f.classList].find(c => c.startsWith('ig6-tint')) || null : null, white: !!cs && cs.backgroundColor === 'rgb(255, 255, 255)', shadow: !!cs && cs.boxShadow !== 'none',
    label: f?.querySelector('h2')?.textContent.trim(), name: f?.querySelector('.bw-ic-n')?.textContent.trim() || '', same: f?.querySelector('.bw-ic-same')?.textContent.trim() || '',
    says: f?.querySelector('.bw-ic-s')?.textContent.trim() || '', lines: f ? f.querySelectorAll('p').length : 0,
    href: f?.querySelector('.bw-if-go')?.getAttribute('href'), rows: f ? f.querySelectorAll('.ip6-brow, .bw-if-you, .bw-if-bills, .bw-if-s').length : -1,
    oldFrame: !!document.querySelector('.bw-iframe, .bw-fiss, .bw-issue'),
    first: side?.firstElementChild?.className || '', hasHearing: !!document.querySelector('.bw-side .bw-hside'),
    beside: !!(side && h1 && side.getBoundingClientRect().left > h1.getBoundingClientRect().right && side.getBoundingClientRect().top < h1.getBoundingClientRect().bottom + 80),
    underStep: !!(f && top(f) > top(document.querySelector('.bw-next')) && (!document.querySelector('.bw-doors') || top(f) < top(document.querySelector('.bw-doors')))),
    who: !!document.querySelector('.bw-side .bw-wside'), wide: document.documentElement.scrollWidth > innerWidth + 1 }; }"""
# (bill, the issue's name or None when it is the bill's own name, how it stands)
CASES = [('HB2300', 'More local food in school meals', 'On track: bills from both chambers still alive'), ('HB2121', None, 'On track: bills from both chambers still alive')]

async def main():
  async with async_playwright() as p:
    br = await p.chromium.launch()
    for size, kw in (('laptop', dict(viewport={'width': 1280, 'height': 860})), ('phone', dict(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True))):
      ctx = await br.new_context(**kw); pg = await ctx.new_page(); errs = []
      pg.on('pageerror', lambda e: errs.append(str(e)))
      for ref, name, says in CASES:
        await pg.goto(f'{BASE}/staff6.html?demo=1#/bill/{ref}'); await pg.wait_for_selector('.bw-head', timeout=20000); await pg.wait_for_timeout(900)
        r = await pg.evaluate(READ); tag = f'{size} {ref}'
        check(r['card'] and not r['tint'] and r['white'] and r['shadow'], f'{tag}: the issue card, white with the standard shadow, no tint ({r["tint"]})')
        check(not r['oldFrame'], f'{tag}: no frame or old issue link over the name')
        check(r['beside'] if size == 'laptop' else r['underStep'], f'{tag}: {"the column beside the name" if size == "laptop" else "under the step card, before the doors"}')
        check(r['label'] == 'Its issue' and (r['name'] == name if name else not r['name']) and not r['same'], f'{tag}: "Its issue" and its name, none when it is the bill\'s own ({r["name"] or r["same"]!r})')
        check(r['says'] == says and r['lines'] == (3 if name else 2), f'{tag}: how it stands, one line ({r["says"]!r}, {r["lines"]} lines)')
        check(r['rows'] == 0, f'{tag}: no bill rows, paragraph or "This bill" tag ({r["rows"]})')
        check((r['href'] or '').startswith('#/issue/') and f'from={ref}' in r['href'], f'{tag}: Open the issue, with the way back ({r["href"]})')
        check(not r['hasHearing'] or 'bw-hside' in r['first'], f'{tag}: the hearing card first when there is one ({r["first"]})')
        check(r['who'], f'{tag}: Who is on it in the right column')
        check(not r['wide'], f'{tag}: nothing scrolls sideways')
      check(not errs, f'{size}: no page errors {errs[:2]}')
      await ctx.close()
    await br.close()
  print('all passed' if not fails else f'{fails} failed')
  sys.exit(1 if fails else 0)

asyncio.run(main())
