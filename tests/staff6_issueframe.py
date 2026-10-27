# R-340: the issue frame on a Staff v6 bill page (Nate's pick D, 26 Oct). On a laptop and a phone it checks:
#   - a bill on an issue has the frame above its name, in its topic's tint, and the facts line has no issue link any more
#   - the frame names the issue (or says "of the same name"), says how it stands, links to the issue page
#   - its bills still alive are cards, the page's own bill ringed as "This bill"; stopped bills are counted
#   - nothing scrolls sideways and the page has no errors
# usage: python3 tests/staff6_issueframe.py [BASE]   (BASE defaults to http://localhost:8832)
import sys, asyncio
from playwright.async_api import async_playwright

BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832').rstrip('/')
fails = 0
def check(cond, what):
  global fails
  print(('PASS ' if cond else 'FAIL ') + what)
  if not cond: fails += 1

READ = """() => { const f = document.querySelector('.bw-head .bw-iframe');
  return { frame: !!f, tint: f ? [...f.classList].find(c => c.startsWith('ig6-tint')) : null, label: f?.querySelector('.bw-if-l')?.textContent.trim(),
    name: f?.querySelector('.bw-if-n')?.textContent.trim() || '', pill: f?.querySelector('.bw-if-pill')?.textContent.trim(), says: f?.querySelector('.bw-if-s')?.textContent.trim(),
    href: f?.querySelector('.bw-if-go')?.getAttribute('href'), cards: f ? f.querySelectorAll('.ip6-brow').length : 0, me: f?.querySelector('.ip6-brow.is-this .v6-row-top')?.textContent || '',
    more: f?.querySelector('.bw-if-more')?.textContent.trim() || '', oldLink: !!document.querySelector('.bw-fiss, .bw-issue'),
    aboveName: !!(f && document.querySelector('.bw-h1') && f.getBoundingClientRect().bottom <= document.querySelector('.bw-h1').getBoundingClientRect().top + 1),
    wide: document.documentElement.scrollWidth > innerWidth + 1 }; }"""
CASES = [('HB2300', 'More local food in school meals', False, 'HB 2300'), ('HB2121', None, True, 'HB 2121')]

async def main():
  async with async_playwright() as p:
    br = await p.chromium.launch()
    for size, kw in (('laptop', dict(viewport={'width': 1280, 'height': 860})), ('phone', dict(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True))):
      ctx = await br.new_context(**kw); pg = await ctx.new_page(); errs = []
      pg.on('pageerror', lambda e: errs.append(str(e)))
      for ref, name, same, num in CASES:
        await pg.goto(f'{BASE}/staff6.html?demo=1#/bill/{ref}'); await pg.wait_for_selector('.bw-head', timeout=20000); await pg.wait_for_timeout(900)
        r = await pg.evaluate(READ); tag = f'{size} {ref}'
        check(r['frame'] and r['tint'], f'{tag}: the frame, in a topic tint ({r["tint"]})')
        check(r['aboveName'], f'{tag}: above the bill name')
        check(not r['oldLink'], f'{tag}: the old "Its issue" link is gone')
        if same: check(r['label'] == 'Part of the issue of the same name' and not r['name'], f'{tag}: same name said once ({r["label"]!r})')
        else: check(r['label'] == 'Part of the issue' and r['name'] == name, f'{tag}: the issue named ({r["name"]!r})')
        check(r['pill'] == 'On track' and 'each chamber' in (r['says'] or ''), f'{tag}: how it stands ({r["says"]!r})')
        check((r['href'] or '').startswith('#/issue/') and f'from={ref}' in r['href'], f'{tag}: Open the issue, with the way back ({r["href"]})')
        check(r['cards'] >= 2 and num in r['me'] or ('This bill' in r['me']), f'{tag}: {r["cards"]} bill cards, this one ringed ({r["me"].strip()[:40]!r})')
        check(not r['wide'], f'{tag}: nothing scrolls sideways')
      check(not errs, f'{size}: no page errors {errs[:2]}')
      await ctx.close()
    await br.close()
  print('all passed' if not fails else f'{fails} failed')
  sys.exit(1 if fails else 0)

asyncio.run(main())
