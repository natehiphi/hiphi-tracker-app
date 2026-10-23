# Staff v5: search finds conversations with legislators (R-316 H-15). A conversation Kris logs and an ask to a chair (W3's
# record) are found by what was said, by the legislator, by who logged it and by the chair's answer, on the Search page
# and in the header's suggestions; a result opens the bill's Activity tab, where the conversation is in full.
#   python3 tests/staff5_conv_search.py                  against http://localhost:8832 (CI serves the repo there)
#   V4_ROOT=/path/to/worktree python3 tests/staff5_conv_search.py    serves that folder straight into the browser
import os, re, sys
from playwright.sync_api import sync_playwright
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from staff5_people import router, HOST

results = []
def check(name, ok, detail=''):
  results.append((name, bool(ok), detail)); print(('ok   ' if ok else 'FAIL ') + name + (f'  ({detail})' if detail else ''))

# Two practice conversations, logged the way the app logs them (DB.addLegNote): Kris's talk with Rep. Kila about SB2175,
# and an ask to the chair of SB2175's committee that the chair answered "Will schedule" (a reply is a second row).
SEED = """Promise.all([import('/staff5/data.js'), import('/staff5/model.js')]).then(async ([m, md]) => { const S = m.S, DB = m.DB;
  const b = S.bills.find(x => x.bill_number === 'SB2175'), kila = S.legislators.find(l => /kila/i.test(l.name || ''));
  const code = md.stopOf(b).committee, chair = md.chairIdsOf(code)[0];
  await DB.addLegNote(kila.id, b.id, 'Talked after the floor session: she will look at the crosswalk numbers and wants the youth survey first.', {});
  await DB.addLegNote(chair, b.id, `Asked for a hearing on SB2175 (${code}).`, { answer: 'asked', committee: code });
  await new Promise(r => setTimeout(r, 5));
  await DB.addLegNote(chair, b.id, 'Office says the chair will put it on the next agenda.', { answer: 'will_schedule', committee: code });
  return [kila.name, S.legislators.find(l => l.id === chair)?.name, code]; })"""

def main():
  with sync_playwright() as p:
    b = p.chromium.launch()
    for W, H, nm in [(1440, 900, 'laptop'), (390, 844, 'phone')]:
      ctx = b.new_context(viewport={'width': W, 'height': H}); ctx.route(HOST + '/**', router); pg = ctx.new_page()
      errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
      pg.goto(f'{HOST}/staff5.html?demo=1&as=KR#/search'); pg.wait_for_timeout(3000)
      if nm == 'laptop': check('Search, empty: says it finds conversations', 'conversations with legislators' in pg.inner_text('#lg-sres'), '')
      kila, chair, code = pg.evaluate(SEED)

      # What was said, and who it was with
      pg.evaluate("location.hash = '#/search?q=kila crosswalk'"); pg.wait_for_timeout(1200)
      rows = pg.locator('#lg-sres .lg-cvrow')
      check(f'{nm}: "kila crosswalk" finds the conversation with Rep. Kila', rows.count() == 1 and 'Kila' in rows.first.inner_text(), rows.count())
      sub = rows.first.locator('.sub').inner_text() if rows.count() else ''
      check(f'{nm}: the result says who logged it, the day and the bill', re.search(r'^You · Mon 3/16 · SB2175$', sub), sub)
      q = rows.first.locator('.lg-cvq').inner_text() if rows.count() else ''
      check(f'{nm}: the result shows what was said', 'crosswalk numbers' in q, q[:60])
      check(f'{nm}: "conversation" counted in the summary', re.search(r'\b1 conversation\b', pg.inner_text('#lg-sres')), '')
      wide = pg.evaluate("[...document.querySelectorAll('#lg-sres .lg-cvrow')].some(r => r.getBoundingClientRect().right > innerWidth + 1) || document.documentElement.scrollWidth > innerWidth + 1")
      check(f'{nm}: the result fits the screen', not wide, '')

      # The chair's answer: the ask and its reply are one result, worded by the newest answer
      pg.evaluate("location.hash = '#/search?q=will schedule'"); pg.wait_for_timeout(1200)
      rows = pg.locator('#lg-sres .lg-cvrow'); txt = rows.first.inner_text() if rows.count() else ''
      check(f'{nm}: "will schedule" finds the ask to the chair, once', rows.count() == 1 and chair.split()[-1] in txt, f'{rows.count()} {txt[:80]!r}')
      check(f'{nm}: the ask says the chair\'s answer', 'Will schedule' in txt and 'next agenda' in txt, txt.replace('\n', ' ')[:120])

      # A word in no conversation finds none
      pg.evaluate("location.hash = '#/search?q=zzqx crosswalk'"); pg.wait_for_timeout(900)
      check(f'{nm}: words in no conversation find none', pg.locator('#lg-sres .lg-cvrow').count() == 0, '')

      # Opening a result: the bill's Activity tab, the conversation there in full
      pg.evaluate("location.hash = '#/search?q=kila crosswalk'"); pg.wait_for_timeout(1000)
      href = pg.locator('#lg-sres .lg-cvrow').first.get_attribute('href') or ''
      pg.locator('#lg-sres .lg-cvrow').first.click(); pg.wait_for_timeout(2000)
      body = pg.inner_text('main')
      check(f'{nm}: a result opens the bill\'s Activity, the conversation in full', href.endswith('/activity') and 'wants the youth survey first' in body, href)

      if nm == 'laptop':
        # The header's suggestions, as you type on any page
        pg.evaluate("location.hash = '#/'"); pg.wait_for_timeout(1000)
        hq = pg.locator('#hq'); hq.fill(''); hq.type('kila crosswalk'); pg.wait_for_timeout(1200)
        box = pg.inner_text('.sg') if pg.locator('.sg').count() else ''
        check('Header suggestions: "kila crosswalk" lists the conversation', 'Conversations' in box and 'Rep. Kila' in box, box.replace('\n', ' | ')[:160])
      check(f'{nm}: no page errors', not errs, errs[:1])
      ctx.close()
    b.close()
  bad = [r for r in results if not r[1]]
  print(f'{len(results) - len(bad)} of {len(results)} checks met')
  sys.exit(1 if bad else 0)

if __name__ == '__main__':
  main()
