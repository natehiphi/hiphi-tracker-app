# Staff v5: search finds conversations with legislators (R-316 H-15). A conversation Kris logs and an ask to a chair (W3's
# record) are found by what was said, by the legislator, by who logged it and by the chair's answer, on the Search page
# and in the header's suggestions; a result opens the bill's Activity tab on that conversation, in full and marked.
#   python3 tests/staff5_conv_search.py                  against http://localhost:8832 (CI serves the repo there)
#   V4_ROOT=/path/to/worktree python3 tests/staff5_conv_search.py    serves that folder straight into the browser
import os, re, sys
from playwright.sync_api import sync_playwright
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from staff5_people import router, HOST

results = []
def check(name, ok, detail=''):
  results.append((name, bool(ok), detail)); print(('ok   ' if ok else 'FAIL ') + name + (f'  ({detail})' if detail else ''))

# Two practice conversations, logged the way the app logs them (DB.addLegNote): Kris's talk with Rep. Kila about the
# crosswalk bill SB2695, and an ask to the chair of SB2175's committee answered "will schedule" (a reply is a second row).
SEED = """Promise.all([import('/staff5/data.js'), import('/staff5/model.js')]).then(async ([m, md]) => { const S = m.S, DB = m.DB;
  const b = S.bills.find(x => x.bill_number === 'SB2175'), cw = S.bills.find(x => x.bill_number === 'SB2695'), kila = S.legislators.find(l => /kila/i.test(l.name || ''));
  const code = md.stopOf(b).committee, chair = md.chairIdsOf(code)[0];
  await DB.addLegNote(kila.id, cw.id, 'Talked after the floor session: she will look at the crosswalk numbers and wants the youth survey first.', {});
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
      check(f'{nm}: the result names the bill, the day and who logged it', re.search(r'^Mon 3/16 · You logged it · Stop and stay stopped at crosswalks$', sub), sub)
      q = rows.first.locator('.lg-cvq').inner_text() if rows.count() else ''
      check(f'{nm}: the result shows what was said', 'crosswalk numbers' in q, q[:60])
      check(f'{nm}: "conversation" counted in the summary', re.search(r'\b1 conversation\b', pg.inner_text('#lg-sres')), '')
      wide = pg.evaluate("[...document.querySelectorAll('#lg-sres .lg-cvrow')].some(r => r.getBoundingClientRect().right > innerWidth + 1) || document.documentElement.scrollWidth > innerWidth + 1")
      check(f'{nm}: the result fits the screen', not wide, '')

      # The chair's answer: the ask and its reply are one result, worded by the newest answer
      pg.evaluate("location.hash = '#/search?q=will schedule'"); pg.wait_for_timeout(1200)
      rows = pg.locator('#lg-sres .lg-cvrow'); txt = rows.first.inner_text() if rows.count() else ''
      check(f'{nm}: "will schedule" finds the ask to the chair, once, named as the chair', rows.count() == 1 and re.search(chair.split()[-1] + r' \(chair\)', txt), f'{rows.count()} {txt[:80]!r}')
      check(f'{nm}: the ask says it as the bill page does: asked by whom, when, the answer', re.search(r'\nAsked by you Mon 3/16 · will schedule · Disposable e-cigarette ban\n', txt) and 'next agenda' in txt, txt.replace('\n', ' | ')[:140])

      # A word in no conversation finds none
      pg.evaluate("location.hash = '#/search?q=zzqx crosswalk'"); pg.wait_for_timeout(900)
      check(f'{nm}: words in no conversation find none', pg.locator('#lg-sres .lg-cvrow').count() == 0, '')

      # Opening a result: the bill's Activity tab, the conversation there in full
      pg.evaluate("location.hash = '#/search?q=kila crosswalk'"); pg.wait_for_timeout(1000)
      href = pg.locator('#lg-sres .lg-cvrow').first.get_attribute('href') or ''
      pg.locator('#lg-sres .lg-cvrow').first.click(); pg.wait_for_timeout(2000)
      at = pg.evaluate("""(() => { const e = document.querySelector('.cv-item.cv-land'); if (!e) return null; const r = e.getBoundingClientRect();
        return { text: e.innerText, seen: r.top >= 0 && r.bottom <= innerHeight, focus: document.activeElement === e }; })()""")
      check(f'{nm}: a result opens the bill\'s Activity on that conversation: in full, on screen, focused, marked', re.search(r'/activity\?cv=', href) and at and 'wants the youth survey first' in at['text'] and at['seen'] and at['focus'], f'{href} {at and {k: v for k, v in at.items() if k != "text"}}')
      # Back to the results and the same result again: it lands again
      pg.go_back(); pg.wait_for_timeout(1200); pg.evaluate("scrollTo(0, 0)")
      pg.locator('#lg-sres .lg-cvrow').first.click(); pg.wait_for_timeout(2000)
      at = pg.evaluate("""(() => { const e = document.querySelector('.cv-item.cv-land'); if (!e) return null; const r = e.getBoundingClientRect();
        return { seen: r.top >= 0 && r.bottom <= innerHeight, focus: document.activeElement === e }; })()""")
      check(f'{nm}: opening the same result a second time lands on it again', at and at['seen'] and at['focus'], at)

      if nm == 'laptop':
        # The header's suggestions, as you type on any page
        pg.evaluate("location.hash = '#/'"); pg.wait_for_timeout(1000)
        hq = pg.locator('#hq'); hq.fill(''); hq.type('kila crosswalk'); pg.wait_for_timeout(1200)
        box = pg.inner_text('.sg') if pg.locator('.sg').count() else ''
        check('Header suggestions: "kila crosswalk" lists the conversation', 'Conversations' in box and 'Rep. Kila' in box, box.replace('\n', ' | ')[:160])
        # A topic word: many two-line bills match, and the list still keeps a row for the conversation (fit() trims the longest group)
        hq.fill(''); hq.type('crosswalk'); pg.wait_for_timeout(1500)
        box = pg.inner_text('.sg') if pg.locator('.sg').count() else ''
        check('Header suggestions: "crosswalk" (many bills) still lists the conversation', 'Conversations' in box and 'Rep. Kila' in box, box.replace('\n', ' | ')[:200])
      check(f'{nm}: no page errors', not errs, errs[:1])
      ctx.close()
    b.close()
  bad = [r for r in results if not r[1]]
  print(f'{len(results) - len(bad)} of {len(results)} checks met')
  sys.exit(1 if bad else 0)

if __name__ == '__main__':
  main()
