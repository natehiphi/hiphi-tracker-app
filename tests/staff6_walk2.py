# Staff v6: the walk 2 fixes Nate said yes to (R-336, 25 Oct). On the practice copy (Mon 16 Mar 2026).
#   1. This week's asks says "No ask yet" one way per state: "· Saya writes it by <day>", "· due <day>", "· was due <day>" (a strong
#      position's ask), or "· a post still helps" (an optional one, with no clock: it has no time).
#   4. A legislator's page: an unknown stand is the words "Mark stand", so no hint sentence explains a picture (R-352 part 8b); a bill they introduced with no
#   3. A bill's Team talk: Message | What happened | Log a talk on one line at 390px.
#   4. A legislator's page: the pencil hint once ("on a bill": on a phone it sits under it); a bill they introduced with no
#      nickname shows its summary cut at a word near 70 characters.
#   5. Bills That Need Hearings names each chair as a link to their page, no photo (R-352 part 8b); the Legislators directory shows each legislator's photo (or initial).
#   6. A bill's Public tab: one box per talking point, Add a point up to five, remove, 200-character check, preview.
#
#   V4_ROOT=/path/to/worktree python3 tests/staff6_walk2.py     exits 1 when a check fails
import os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import staff6_lib as L

R = L.Results()
NOASK = r'No ask yet · (?:[A-Z][a-z]+ writes it by .+|due .+|was due .+|a post still helps)$'
def overflow(pg): return pg.page.evaluate('document.documentElement.scrollWidth - innerWidth')

with L.browser() as B:
  # ---- 1. This week's asks: one wording ----
  for who in ['NT', 'SY', 'KV']:
    pg = B.page(who, 1440, 900); pg.open('/outreach')
    t = pg.page.query_selector('[data-seg="otwho"][data-val="team"], [data-seg][data-val="team"]')
    if t: t.click(); pg.ready()
    lines = pg.page.evaluate("[...document.querySelectorAll('.ot-card .ot-nw > span:last-child')].map(e => e.innerText.trim()).filter(t => /No ask/.test(t))")
    bad = [x for x in lines if not re.match(NOASK, x)]
    R.check(f'{who}: every "No ask yet" line reads one of the set ways', lines and not bad, bad[:3] or len(lines))
    clocks = pg.page.evaluate("[...document.querySelectorAll('.ot-card .ot-nw')].filter(e => /a post still helps/.test(e.innerText)).map(e => !!e.querySelector('svg'))")
    R.check(f'{who}: "a post still helps" carries no clock', not any(clocks), clocks)
    R.check(f'{who}: nothing about an ask is red', not pg.page.query_selector('.ot-card .ot-nw.t-overdue, .ot-card .ot-nw .t-overdue'))
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
    # R-352 part 8b (P-4): "Mark stand" says itself, so the sentence explaining the thumbs-up is gone
    n = pg.text().count('The thumbs-up on a bill marks where they stand on it.')
    R.check(f'{w}: no stance hint sentence (the button\'s words explain it)', n == 0, n)
    more = pg.page.query_selector('.lg6-s-intro button[data-fold], .lg6-s-intro [aria-expanded="false"]')
    if more: more.click(); pg.page.wait_for_timeout(200)
    rows = pg.page.evaluate("""[...document.querySelectorAll('.lg6-intro .v6-row-name')].map(e => ({ t: e.textContent, h: Math.round(e.getBoundingClientRect().height), lh: parseFloat(getComputedStyle(e).lineHeight) || 24, title: e.title }))""")
    R.check(f'{w}: bills they introduced with no nickname are in the list', len(rows) > 0, len(rows))
    R.check(f'{w}: each such name keeps its telling words, cut at a word near 70 characters, the whole in its title', rows and all(len(r['t']) <= 77 and len(r['t']) >= 50 and (r['t'].endswith('…') == bool(r['title'])) and (not r['title'] or r['title'].startswith(r['t'][:-1])) for r in rows), [r['t'] for r in rows][:3])
    lines = 1 if w >= 768 else 3   # one line on a laptop; a phone wraps it, as it wraps a long nickname
    R.check(f'{w}: and keeps to {lines} line{"s" if lines > 1 else ""}', rows and all(r['h'] <= r['lh'] * lines + 4 for r in rows), [(r['h'], r['lh']) for r in rows][:3])
    R.check(f'{w}: no sideways scroll', overflow(pg) <= 0, overflow(pg))
    R.check(f'{w}: no page errors', not pg.errors, pg.errors[:2]); pg.close()

  # ---- 5. Bills That Need Hearings: chair names as links, no photos (R-352); the Legislators directory keeps its photos ----
  for w, h in [(1440, 900), (390, 844)]:
    pg = B.page('NT', w, h); pg.open('/hearings/ask')
    # R-352 part 8b (A-18, A-14 on v6): the chair's name is the link to their page, no photo or letter bubble (the photo was
    # mostly a letter). Who to ask is gone (round 2, decision 4): Bills That Need Hearings is the board that has these cards.
    ask = pg.page.evaluate("[...document.querySelectorAll('.hg-chair')].map(c => [!!c.querySelector('.hg-cph, .hg-chead .lg-ph'), c.querySelectorAll('.hg-cname a[href^=\"#/legislator/\"]').length])")
    R.check(f'{w}: Bills That Need Hearings, the same cards: chair names are links, no photos', ask and all(not c[0] and c[1] >= 1 for c in ask), ask[:4])
    pg.nav('/legislators')
    ev = pg.page.evaluate("[...document.querySelectorAll('[data-lgrow]')].map(r => { const p = r.querySelector('.lg6-rph'); const b = p && p.getBoundingClientRect(); return !!b && b.width >= 38 && b.height >= 38 && (!!p.querySelector('img') || getComputedStyle(p, '::before').content.length > 2); })")
    R.check(f'{w}: The directory, every legislator shows a photo or initial', ev and all(ev), f'{sum(ev)} of {len(ev)}')
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
    R.check(f'{w}: "up to five" is said by the counter only', 'up to five' not in pg.text('#bw-ptp-h').lower() and 'of 5 points' in pg.text('.bw-ptfoot'))
    if w == 1440:
      pv = pg.page.evaluate("document.querySelectorAll('.bw-pvlist li').length")
      R.check('the preview lists the points one at a time', pv == n0, pv)
      R.check('the preview names the public page’s letter writer', 'letter writer' in pg.text('.bw-pvpts') and 'testimony helper' not in pg.text('.bw-prev'))
      st = pg.page.evaluate("(() => { const a = document.querySelector('.bw-pvadd'); const c = getComputedStyle(a); return { tag: a.tagName, color: c.color, action: getComputedStyle(document.querySelector('[data-ptadd]')).color, border: c.borderTopStyle, hidden: a.getAttribute('aria-hidden') }; })()")
      R.check('its Add is a picture of the public’s button: muted, outlined, not a control, not the app’s teal', st['tag'] == 'SPAN' and st['color'] != st['action'] and st['border'] == 'solid' and st['hidden'] == 'true', st)
    # Paste: three lines into the last box fill it and the boxes after it
    PASTE = """(i) => { const t = document.querySelectorAll('[data-pt]')[i]; t.focus(); t.setSelectionRange(t.value.length, t.value.length);
      const dt = new DataTransfer(); dt.setData('text/plain', 'Pasted one.\\nPasted two.\\n\\nPasted three.');
      t.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); }"""
    pg.page.click('[data-ptadd]'); pg.page.wait_for_timeout(80)
    pg.page.evaluate(PASTE, n0); pg.page.wait_for_timeout(120)
    vals = pg.page.evaluate("[...document.querySelectorAll('[data-pt]')].map(t => t.value)")
    slots = 5 - n0; want = ['Pasted one.', 'Pasted two.', 'Pasted three.']
    want = want if slots >= 3 else want[:slots - 1] + [' '.join(want[slots - 1:])]   # past the fifth box the rest joins the last
    R.check(f'{w}: pasting three lines fills the boxes after it, a line each, the rest joining the fifth', vals[n0:] == want, vals[n0:])
    while len(boxes()) > n0: pg.page.click(f'[data-ptrm="{len(boxes()) - 1}"]'); pg.page.wait_for_timeout(60)
    add = pg.page.query_selector('[data-ptadd]')
    while len(boxes()) < 5: add.click(); pg.page.wait_for_timeout(80)
    R.check(f'{w}: Add a point stops at five', len(boxes()) == 5 and not add.is_visible())
    # a blank box between: the too-long one is named by its own label, and told under that box
    boxes()[n0 + 1].fill('x' * 230); pg.page.wait_for_timeout(80)
    R.check(f'{w}: the count shows near the limit', '230 of 200 characters' in pg.text('.bw-ptlist'))
    if w == 1440: R.check('the preview adds the new point as typed', pg.page.evaluate("document.querySelectorAll('.bw-pvlist li').length") == n0 + 1)
    pg.page.click('.bw-pubsave [type=submit]'); pg.page.wait_for_timeout(200)
    msg = pg.text(f'#bw-ptp-{n0 + 1}-e')
    R.check(f'{w}: a point over 200 is refused under its own box, named by its label (blank box before it)', f'Point {n0 + 2} is 230 characters' in msg and boxes()[n0 + 1].get_attribute('aria-invalid') == 'true' and not pg.text('#bw-perr').strip(), msg)
    boxes()[n0 + 1].fill(''); boxes()[n0].fill('A short new point for the test.'); pg.page.wait_for_timeout(80)
    R.check(f'{w}: typing in it clears its message', not pg.text(f'#bw-ptp-{n0 + 1}-e').strip())
    first = boxes()[0].input_value()
    pg.page.click(f'[data-ptrm="0"]'); pg.page.wait_for_timeout(100)
    R.check(f'{w}: remove takes that point out and renumbers', len(boxes()) == 4 and pg.text('.bw-ptrow > label') == 'Point 1' and 'Add a point' in pg.text('.bw-ptfoot'))
    R.check(f'{w}: remove offers Undo', 'Point 1 removed.' in pg.text('#toast') and bool(pg.page.query_selector('#toast .toastundo')), pg.text('#toast'))
    pg.page.click('#toast .toastundo'); pg.page.wait_for_timeout(120)
    R.check(f'{w}: Undo puts it back where it was', boxes()[0].input_value() == first and len(boxes()) == 5)
    pg.page.click(f'[data-ptrm="0"]'); pg.page.wait_for_timeout(100)
    pg.page.click('.bw-pubsave [type=submit]'); pg.page.wait_for_timeout(500); pg.ready()
    saved = pg.page.evaluate("[...document.querySelectorAll('[data-pt]')].map(t => t.value)")
    R.check(f'{w}: the one Save keeps the points as a list', saved[-1] == 'A short new point for the test.' and len(saved) == n0, saved)
    R.check(f'{w}: no sideways scroll', overflow(pg) <= 0, overflow(pg))
    R.check(f'{w}: no page errors', not pg.errors, pg.errors[:2]); pg.close()

R.done()
