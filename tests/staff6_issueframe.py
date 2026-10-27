# R-346 (Nate's pick "bold", 27 Oct; it replaced R-340's issue frame over the name): the issue card on a Staff v6 bill page.
#   - a bill on an issue has the issue card in the right column, in its topic's tint; nothing is left above the name
#   - the card says "Its issue" and the issue's name (always, even the bill's own name), how it stands, Open the issue
#   - its bills still alive are cards, the page's own bill ringed as "This bill"
#   - on a laptop the card stands beside the bill's name; on a phone it comes under the step card, before the doors
#   - the hearing card and Who is on it follow it; nothing scrolls sideways and the page has no errors
# usage: python3 tests/staff6_issueframe.py [BASE]   (BASE defaults to http://localhost:8832)
import sys, asyncio
from playwright.async_api import async_playwright

BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832').rstrip('/')
fails = 0
def check(cond, what):
  global fails
  print(('PASS ' if cond else 'FAIL ') + what)
  if not cond: fails += 1

READ = """() => { const f = document.querySelector('.bw-side .bw-icard'), h1 = document.querySelector('.bw-h1'), top = e => e ? e.getBoundingClientRect().top + scrollY : null;
  return { card: !!f, tint: f ? [...f.classList].find(c => c.startsWith('ig6-tint')) : null, label: f?.querySelector('.bw-ic-l')?.textContent.trim(),
    name: f?.querySelector('.bw-ic-n')?.textContent.trim() || '', pill: f?.querySelector('.bw-if-pill')?.textContent.trim(), says: f?.querySelector('.bw-if-s')?.textContent.trim(),
    href: f?.querySelector('.bw-if-go')?.getAttribute('href'), cards: f ? f.querySelectorAll('.ip6-brow').length : 0, me: f?.querySelector('.ip6-brow.is-this .v6-row-top')?.textContent || '',
    oldFrame: !!document.querySelector('.bw-iframe, .bw-fiss, .bw-issue'),
    beside: !!(f && h1 && f.getBoundingClientRect().left > h1.getBoundingClientRect().right && f.getBoundingClientRect().top < h1.getBoundingClientRect().bottom + 80),
    underStep: !!(f && top(f) > top(document.querySelector('.bw-next')) && (!document.querySelector('.bw-doors') || top(f) < top(document.querySelector('.bw-doors')))),
    who: !!document.querySelector('.bw-side .bw-wside'), wide: document.documentElement.scrollWidth > innerWidth + 1 }; }"""
CASES = [('HB2300', 'More local food in school meals', 'HB 2300'), ('HB2121', None, 'HB 2121')]

async def main():
  async with async_playwright() as p:
    br = await p.chromium.launch()
    for size, kw in (('laptop', dict(viewport={'width': 1280, 'height': 860})), ('phone', dict(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True))):
      ctx = await br.new_context(**kw); pg = await ctx.new_page(); errs = []
      pg.on('pageerror', lambda e: errs.append(str(e)))
      for ref, name, num in CASES:
        await pg.goto(f'{BASE}/staff6.html?demo=1#/bill/{ref}'); await pg.wait_for_selector('.bw-head', timeout=20000); await pg.wait_for_timeout(900)
        r = await pg.evaluate(READ); tag = f'{size} {ref}'
        check(r['card'] and r['tint'], f'{tag}: the issue card, in a topic tint ({r["tint"]})')
        check(not r['oldFrame'], f'{tag}: no frame or old issue link over the name')
        check(r['beside'] if size == 'laptop' else r['underStep'], f'{tag}: {"beside the name" if size == "laptop" else "under the step card, before the doors"}')
        check(r['label'] == 'Its issue' and (r['name'] == name if name else bool(r['name'])), f'{tag}: "Its issue" and its name ({r["name"]!r})')
        check(r['pill'] == 'On track' and 'each chamber' in (r['says'] or ''), f'{tag}: how it stands ({r["says"]!r})')
        check((r['href'] or '').startswith('#/issue/') and f'from={ref}' in r['href'], f'{tag}: Open the issue, with the way back ({r["href"]})')
        check(r['cards'] >= 2 and (num in r['me'] or 'This bill' in r['me']), f'{tag}: {r["cards"]} bill cards, this one ringed ({r["me"].strip()[:40]!r})')
        check(r['who'], f'{tag}: Who is on it in the right column')
        check(not r['wide'], f'{tag}: nothing scrolls sideways')
      check(not errs, f'{size}: no page errors {errs[:2]}')
      await ctx.close()
    await br.close()
  print('all passed' if not fails else f'{fails} failed')
  sys.exit(1 if fails else 0)

asyncio.run(main())
