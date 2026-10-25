# Staff v6: the walk 2 fixes Nate said yes to (R-336, 25 Oct). On the practice copy (Mon 16 Mar 2026).
#   1. This week's asks says "No ask yet" one way: "No ask yet · Saya writes it by <day>" or "No ask yet · a post still helps".
#   2. Emails: the paused band says paused once; "goes to" reads "HB 1523's followers" on a laptop and a phone alike.
#   3. A bill's Team talk: Message | What happened | Log a talk on one line at 390px.
#   4. A legislator's page: the pencil hint once; a bill they introduced with no nickname is cut at a word to a nickname's length.
#   5. Who to ask shows each chair's photo; Everyone shows each legislator's photo (or initial).
#   6. A bill's Public tab: one box per talking point, Add a point up to five, remove, 200-character check, preview.
#
#   V4_ROOT=/path/to/worktree python3 tests/staff6_walk2.py     exits 1 when a check fails
import os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import staff6_lib as L

R = L.Results()
NOASK = r'No ask yet · (?:[A-Z][a-z]+ writes it by .+|a post still helps)$'
def overflow(pg): return pg.page.evaluate('document.documentElement.scrollWidth - innerWidth')

with L.browser() as B:
  # ---- 1. This week's asks: one wording ----
  for who in ['NT', 'SY', 'KV']:
    pg = B.page(who, 1440, 900); pg.open('/outreach')
    t = pg.page.query_selector('[data-seg="otwho"][data-val="team"], [data-seg][data-val="team"]')
    if t: t.click(); pg.ready()
    lines = pg.page.evaluate("[...document.querySelectorAll('.ot-card .ot-nw > span:last-child')].map(e => e.innerText.trim()).filter(t => /No ask/.test(t))")
    bad = [x for x in lines if not re.match(NOASK, x)]
    R.check(f'{who}: every "No ask yet" line reads one of the two ways', lines and not bad, bad[:3] or len(lines))
    R.check(f'{who}: never the old "It was due" / "can post one" / "No ask yet." forms', not re.search(r'No ask yet\.|can post one|to write by', pg.text()), '')
    if who == 'NT': writes = [x for x in lines if 'writes it by' in x]; R.check('a teammate due to write one is named with the day ("· Saya writes it by …")', bool(writes), lines[:4])
    R.check(f'{who}: no page errors', not pg.errors, pg.errors[:2]); pg.close()

  # ---- 2. Emails ----
  pg = B.page('NT', 1440, 900); pg.open('/outreach/emails')
  band = pg.text('.notice') if pg.page.query_selector('.notice') else pg.text()
  R.check('the paused band: the new words', 'Email is paused. You can still write and approve; approved emails go out in the first 4:30 PM email after it is turned on.' in pg.text(), band[:160])
  R.check('the band says paused once', pg.text().count('paused') == 1, pg.text().count('paused'))
  R.check('the admin keeps Turn it on', bool(pg.page.query_selector('a[href="#/setup/email"]')))
  to = pg.page.evaluate("[...document.querySelectorAll('td.c-to')].map(e => e.innerText.trim())")
  R.check('laptop Goes to: "HB 1523’s followers"', to and all(re.match(r'^(HB|SB) \d+’s followers$|^The (list|group) ', x) for x in to), to)
  R.check('no "Followers of"', 'Followers of' not in pg.text())
  pg.close()
  pg = B.page('NT', 390, 844); pg.open('/outreach/emails')
  R.check('phone row: "to HB 1523’s followers"', 'to HB 1523’s followers' in pg.text(), '')
  R.check('phone: the band says paused once', pg.text().count('paused') == 1)
  pg.close()

  # ---- 3. Team talk's switch on one line at 390 ----
  for w, h in [(390, 844), (1440, 900)]:
    pg = B.page('NT', w, h); pg.open('/bill/HB1562/talk')
    labs = pg.page.evaluate("[...document.querySelectorAll('[data-seg=\"bwkind\"]')].map(b => [b.innerText.trim(), Math.round(b.getBoundingClientRect().height), Math.round(b.getBoundingClientRect().top)])")
    R.check(f'{w}: the switch reads Message | What happened | Log a talk', [x[0] for x in labs] == ['Message', 'What happened', 'Log a talk'], labs)
    R.check(f'{w}: all three on one line, none wrapped', len({x[2] for x in labs}) == 1 and max(x[1] for x in labs) <= 44, labs)
    pg.page.click('[data-seg="bwkind"][data-val="note"]'); pg.page.wait_for_timeout(200)
    R.check(f'{w}: the box keeps the longer name for screen readers', pg.page.evaluate("document.querySelector('label[for=bw-chat]').textContent") == 'Log what happened')
    R.check(f'{w}: no sideways scroll', overflow(pg) <= 0); pg.close()

  # ---- 4. A legislator's page ----
  for w, h in [(1440, 900), (390, 844)]:
    pg = B.page('NT', w, h); pg.open(f'/legislator/{L.LEGISLATOR}')
    n = pg.text().count('The pencil beside a bill marks where they stand on it.')
    R.check(f'{w}: the pencil hint is said once', n == 1, n)
    more = pg.page.query_selector('.lg6-s-intro button[data-fold], .lg6-s-intro [aria-expanded="false"]')
    if more: more.click(); pg.page.wait_for_timeout(200)
    rows = pg.page.evaluate("""[...document.querySelectorAll('.lg6-intro .v6-row-name')].map(e => ({ t: e.textContent, h: Math.round(e.getBoundingClientRect().height), lh: parseFloat(getComputedStyle(e).lineHeight) || 24, title: e.title }))""")
    R.check(f'{w}: bills they introduced with no nickname are in the list', len(rows) > 0, len(rows))
    R.check(f'{w}: each such name is cut at a word to a nickname\'s length, the whole in its title', rows and all(len(r['t']) <= 45 and (r['t'].endswith('…') == bool(r['title'])) and (not r['title'] or r['title'].startswith(r['t'][:-1])) for r in rows), [r['t'] for r in rows][:3])
    lines = 1 if w >= 768 else 2   # a nickname's length: one line on a laptop, as a nickname wraps on a phone
    R.check(f'{w}: and keeps to {lines} line{"s" if lines > 1 else ""}', rows and all(r['h'] <= r['lh'] * lines + 4 for r in rows), [(r['h'], r['lh']) for r in rows][:3])
    R.check(f'{w}: no sideways scroll', overflow(pg) <= 0, overflow(pg))
    R.check(f'{w}: no page errors', not pg.errors, pg.errors[:2]); pg.close()

  # ---- 5. Photos: Who to ask, Bills That Need Hearings, Everyone ----
  for w, h in [(1440, 900), (390, 844)]:
    pg = B.page('NT', w, h); pg.open('/legislators')
    cards = pg.page.evaluate("[...document.querySelectorAll('.hg-chair')].map(c => !!c.querySelector('.hg-chead .hg-cph .lg-ph'))")
    R.check(f'{w}: Who to ask, every chair card has a photo or initial', cards and all(cards), f'{sum(cards)} of {len(cards)}')
    vis = pg.page.evaluate("(() => { const e = document.querySelector('.hg-cph .lg-ph'); const r = e && e.getBoundingClientRect(); return r ? [Math.round(r.width), Math.round(r.height)] : null; })()")
    R.check(f'{w}: the photo is 40px (44 with its ring) and showing', vis == [44, 44], vis)
    pg.nav('/hearings/ask')
    R.check(f'{w}: Bills That Need Hearings shares the photos', bool(pg.page.query_selector('.hg-chair .hg-cph .lg-ph')))
    pg.nav('/legislators?view=everyone')
    ev = pg.page.evaluate("[...document.querySelectorAll('[data-lgrow]')].map(r => { const p = r.querySelector('.lg6-rph'); const b = p && p.getBoundingClientRect(); return !!b && b.width >= 38 && b.height >= 38 && (!!p.querySelector('img') || getComputedStyle(p, '::before').content.length > 2); })")
    R.check(f'{w}: Everyone, every row shows a photo or initial', ev and all(ev), f'{sum(ev)} of {len(ev)}')
    R.check(f'{w}: no sideways scroll', overflow(pg) <= 0, overflow(pg))
    R.check(f'{w}: no page errors', not pg.errors, pg.errors[:2]); pg.close()

  # ---- 6. Talking points, one at a time ----
  for w, h in [(1440, 900), (390, 844)]:
    pg = B.page('NT', w, h); pg.open('/bill/HB1562/public')
    boxes = lambda: pg.page.query_selector_all('[data-pt]')
    n0 = len(boxes())
    R.check(f'{w}: one box per saved point, labelled Point 1, Point 2…', n0 >= 1 and pg.page.evaluate("[...document.querySelectorAll('.bw-ptrow > label')].every((l, i) => l.textContent === `Point ${i + 1}` && document.getElementById(l.htmlFor))"), n0)
    R.check(f'{w}: no single talking-points box any more', not pg.page.query_selector('textarea#bw-ptp'))
    R.check(f'{w}: the Drafted-by-Claude note stays', 'Drafted by Claude from the bill’s record' in pg.text())
    grown = pg.page.evaluate("[...document.querySelectorAll('[data-pt]')].every(t => t.scrollHeight <= t.clientHeight + 4)")
    R.check(f'{w}: each box grows to fit its words', grown)
    if w == 1440:
      pv = pg.page.evaluate("document.querySelectorAll('.bw-pvlist li').length")
      R.check('the preview lists the points one at a time', pv == n0, pv)
    add = pg.page.query_selector('[data-ptadd]')
    while len(boxes()) < 5: add.click(); pg.page.wait_for_timeout(80)
    R.check(f'{w}: Add a point stops at five', len(boxes()) == 5 and not add.is_visible())
    boxes()[n0].fill('x' * 230); pg.page.wait_for_timeout(80)
    R.check(f'{w}: the count shows near the limit', '230 of 200 characters' in pg.text('.bw-ptlist'))
    if w == 1440: R.check('the preview adds the new point as typed', pg.page.evaluate("document.querySelectorAll('.bw-pvlist li').length") == n0 + 1)
    pg.page.click('.bw-pubsave [type=submit]'); pg.page.wait_for_timeout(200)
    R.check(f'{w}: a point over 200 is refused, that box marked', 'Keep each one under 200' in pg.text('#bw-perr') and boxes()[n0].get_attribute('aria-invalid') == 'true', pg.text('#bw-perr'))
    boxes()[n0].fill('A short new point for the test.'); pg.page.wait_for_timeout(80)
    pg.page.click(f'[data-ptrm="0"]'); pg.page.wait_for_timeout(100)
    R.check(f'{w}: remove takes that point out and renumbers', len(boxes()) == 4 and pg.text('.bw-ptrow > label') == 'Point 1' and 'Add a point' in pg.text('.bw-ptfoot'))
    pg.page.click('.bw-pubsave [type=submit]'); pg.page.wait_for_timeout(500); pg.ready()
    saved = pg.page.evaluate("[...document.querySelectorAll('[data-pt]')].map(t => t.value)")
    R.check(f'{w}: the one Save keeps the points as a list', saved[-1] == 'A short new point for the test.' and len(saved) == n0, saved)
    R.check(f'{w}: no sideways scroll', overflow(pg) <= 0, overflow(pg))
    R.check(f'{w}: no page errors', not pg.errors, pg.errors[:2]); pg.close()

R.done()
