# R-340: the issue band on the public bill page (layout 3). Checks, on a phone and a laptop:
#   - the bill's number follows its name in the title, and the old number line over the title is gone
#   - a bill on an issue shows the band: "Its issue:", the issue's name (a link to its page), a badge and a sentence
#   - an issue with the bill's own name says its name too, "Its issue: <name>" (R-346, Nate 10/27: "of the same name" read oddly)
#   - the band is in the topic's colour (data-topic), and Follow the issue is in it for everyone, a newcomer too (R-357, Nate 30 Oct:
#     this layout draws no "New here?" card, so a newcomer from a link had no way to follow from the page)
#   - nothing scrolls sideways and the page has no errors
# usage: python3 tests/issue_band.py [BASE]   (BASE defaults to http://localhost:8832)
import sys, asyncio
from playwright.async_api import async_playwright

BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832').rstrip('/')
fails = 0
def check(cond, what):
  global fails
  print(('PASS ' if cond else 'FAIL ') + what)
  if not cond: fails += 1

READ = """() => { const h = document.querySelector('.bl-rhead'), band = h && h.querySelector('.bl-iband');
  return { h1: h?.querySelector('h1')?.textContent.trim(), num: h?.querySelector('h1 .bl-hnum')?.textContent.trim(), eye: !!h?.querySelector('.bl-reye'),
    band: !!band, topic: band?.dataset.topic, label: band?.querySelector('.bl-ib-l')?.textContent.trim(), name: band?.querySelector('.bl-ib-n a')?.textContent.trim(),
    href: band?.querySelector('.bl-ib-l a')?.getAttribute('href'), badge: band?.querySelector('.bl-ib-badge')?.textContent.trim(), says: band?.querySelector('.bl-ib-s')?.textContent.trim(),
    follow: band?.querySelector('[data-bl-followissue],[data-bl-unfollowissue],[data-bl-newfollow]')?.textContent.trim() || '', wide: document.documentElement.scrollWidth > innerWidth + 1 }; }"""

CASES = [('HB2300', 'HB 2300', 'food', 'More local food in school meals', False), ('HB2121', 'HB 2121', 'tobacco', None, True)]

async def main():
  async with async_playwright() as p:
    br = await p.chromium.launch()
    for size, kw in (('phone', dict(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)), ('laptop', dict(viewport={'width': 1280, 'height': 860}))):
      for back in (False, True):
        ctx = await br.new_context(**kw); pg = await ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        if back:   # a returning visitor: past the first visit, so Follow the issue is in the band
          await ctx.add_init_script("const w = JSON.stringify({step: 9, issues: [], done: true}); localStorage.setItem('hiphi_wiz', w); localStorage.setItem('hiphi_wiz_demo', w)")
        who = 'returning' if back else 'newcomer'
        for ref, num, topic, name, same in CASES:
          await pg.goto(f'{BASE}/track.html?demo=1#/bill/2026/{ref}'); await pg.wait_for_selector('.bl-rhead h1', timeout=15000); await pg.wait_for_timeout(700)
          r = await pg.evaluate(READ); tag = f'{size} {who} {ref}'
          check(r['num'] == num and r['h1'].endswith(num), f'{tag}: the number follows the name ({r["h1"]!r})')
          check(not r['eye'], f'{tag}: no number line over the title')
          check(r['band'] and r['topic'] == topic, f'{tag}: the band, in the {topic} colour ({r["topic"]})')
          check((r['href'] or '').startswith('#/issue/'), f'{tag}: the band opens the issue page ({r["href"]})')
          check(r['label'].startswith('Its issue:') and 'same name' not in r['label'] and (r['name'] == name if name else bool(r['name'])), f'{tag}: "Its issue:" and the issue named ({r["label"]!r}, {r["name"]!r})')
          check(r['badge'] == 'Still moving' and 'each chamber' in (r['says'] or ''), f'{tag}: badge and sentence ({r["says"]!r})')
          check('Follow the issue' in r['follow'] or 'Following' in r['follow'], f'{tag}: Follow the issue in the band, for a {who} ({r["follow"]!r})')
          check(not r['wide'], f'{tag}: nothing scrolls sideways')
        check(not errs, f'{size} {who}: no page errors {errs[:2]}')
        await ctx.close()
    await br.close()
  print(f'{"all passed" if not fails else f"{fails} failed"}')
  sys.exit(1 if fails else 0)

asyncio.run(main())
