# Staff v6: My issues › All issues and › Coalitions as grids of cards (R-336 walk 3). Nate on All issues: "This needs to be
# the most organized ... It's possible these should be organized like the legislator list. Each issue has it's own image
# with a description so it doesn't feel overly daunting"; his pick for the image: the topic's icon, large, on a soft tint.
# On Coalitions: "Maybe a similar card and image sorting as well here." On the practice copy (Mon 16 Mar 2026), as Nate,
# at 1440x900 and 390x844.
#   1. By topic (the default): the six topics in order, each a heading with its icon and count over a grid of its issues,
#      A to Z inside; every live issue shown once, under its own topic; a jump chip per topic that brings its heading to the
#      top and puts the focus there.
#   2. Each card is one link to the issue: the topic's icon on the topic's tint, the name, the description cut at a word
#      (the whole of it in the title), one status line; about five a row on a laptop, two on a phone.
#   3. Sort: By topic, A to Z (one grid, a letter badge on each letter's first card, letter chips), By next deadline (R-272's
#      groups: This week, Next deadlines...); the pick is remembered on this device.
#   4. The find box matches words and bill numbers ("HB 1779" and "hb1779"), Sort steps aside while it shows matches, and
#      clearing it brings the groups back. New issue opens its form.
#   5. Coalitions: your coalition first, then the others; each card its icon (or a monogram when it has none), its short and
#      full name, its owner and its week; I help stays on the card and still works (and Undo).
#   6. No sideways scroll and no page errors.
#
#   V4_ROOT=/path/to/worktree python3 tests/staff6_issuegrid.py      exits 1 when a check fails
#   --shots DIR                                                      saves each sort and Coalitions, laptop and phone
import os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import staff6_lib as L

R = L.Results()
SHOTS = sys.argv[sys.argv.index('--shots') + 1] if '--shots' in sys.argv else ''
ALL, COAL = '/my-issues/all', '/my-issues/coalitions'
def overflow(pg): return pg.page.evaluate('document.documentElement.scrollWidth - innerWidth')
CARDS = """[...document.querySelectorAll('#is-q-body .ig6-cell, .co6-index .ig6-cell')].map(c => { const a = c.querySelector('.ig6-link');
  return { id: c.dataset.igcard, href: a.getAttribute('href'), title: a.getAttribute('title') || '', name: a.querySelector('.ig6-name')?.innerText.trim(),
    desc: [...a.querySelectorAll('.ig6-desc')].map(e => e.innerText.trim()), stat: a.querySelector('.ig6-stat')?.innerText.trim() || '',
    links: a.querySelectorAll('a, button').length, svg: !!a.querySelector('.ig6-pic svg'), mono: a.querySelector('.ig6-mono')?.innerText || '',
    tint: [...a.querySelector('.ig6-pic').classList].find(k => /^ig6-tint/.test(k)) || '', badge: a.querySelector('.ig6-badge')?.innerText || '',
    group: c.closest('section, details')?.querySelector('h2, summary')?.innerText.trim() || '', foot: [...c.querySelectorAll('.ig6-foot button')].map(b => [b.innerText.trim(), b.getAttribute('aria-pressed')]) }; })"""
def cards(pg): return pg.page.evaluate(CARDS)
def heads(pg): return pg.page.evaluate("[...document.querySelectorAll('#is-q-body .ig6-sh h2, #is-q-body .ig6-fold > summary')].map(h => h.innerText.trim().replace(/\\s*\\(\\d+\\)$/, ''))")
def chips(pg): return pg.page.evaluate("[...document.querySelectorAll('.ig6-jump .lg6-jchip')].map(b => b.innerText.replace(/\\s+/g, ' ').trim())")
def per_row(pg, sel='#is-q-body .ig6-cell'): return pg.page.evaluate(f"(() => {{ const c = [...document.querySelectorAll('{sel}')]; const t = c[0].getBoundingClientRect().top; return c.filter(x => Math.abs(x.getBoundingClientRect().top - t) < 2).length; }})()")
def sort(pg, label):
  pg.page.click('[data-igsort]'); pg.page.wait_for_timeout(500)
  pg.page.click(f'dialog[open] >> text="{label}"'); pg.page.wait_for_timeout(500); pg.ready()
def shot(pg, name):
  if SHOTS: pg.shot(os.path.join(SHOTS, f'{name}-{pg.w}.png'))
def find(pg, q):
  pg.page.fill('#is-q', q); pg.page.wait_for_timeout(400)

with L.browser() as B:
  for w, h in [(1440, 900), (390, 844)]:
    pg = B.page('NT', w, h); pg.open(ALL)
    pg.page.evaluate("try { localStorage.removeItem('sv6_allissues_sort') } catch {}")
    pg.open(ALL)
    data = pg.page.evaluate("""import('./staff6/data.js').then(m => ({ cats: m.S.categories.map(c => ({ key: c.key, name: c.name })),
      issues: m.S.issues.filter(i => !i.archived_at).map(i => ({ id: i.id, name: i.name, cat: i.category, desc: i.description || '' })),
      camps: m.S.campaigns.map(c => ({ id: c.id, name: c.name, full: c.public_name, owner: c.owner_id, icon: c.icon })), me: m.S.me.id }))""")
    by = {i['id']: i for i in data['issues']}
    cat_name = {c['key']: c['name'] for c in data['cats']}

    # ---- 1. By topic ----
    R.check(f'{w}: Sort says by topic by default', pg.page.get_attribute('[data-igsort]', 'aria-label') == 'Sort, now by topic', pg.page.get_attribute('[data-igsort]', 'aria-label'))
    topics = [c['name'] for c in data['cats'] if any(i['cat'] == c['key'] for i in data['issues'])]
    R.check(f'{w}: grouped by topic, the six in order', heads(pg) == topics, heads(pg))
    cs = cards(pg)
    R.check(f'{w}: every live issue shown once', sorted(c['id'] for c in cs) == sorted(by), f'{len(cs)} cards, {len(by)} issues')
    R.check(f'{w}: each issue under its own topic', all(c['group'] == cat_name[by[c['id']]['cat']] for c in cs), [(c['name'], c['group']) for c in cs if c['group'] != cat_name[by[c['id']]['cat']]][:3])
    ok = all(a['name'].lower() <= b['name'].lower() for a, b in zip(cs, cs[1:]) if a['group'] == b['group'])
    R.check(f'{w}: A to Z inside a topic', ok)
    n_of = {t: sum(1 for c in cs if c['group'] == t) for t in topics}
    R.check(f'{w}: a jump chip per topic, with its count', chips(pg) == [f'{t} {n_of[t]}' for t in topics], chips(pg))
    sn = pg.page.evaluate("[...document.querySelectorAll('#is-q-body .ig6-sn')].map(e => e.innerText.trim())")
    R.check(f'{w}: each topic heading counts its issues', all(s.startswith(f'{n_of[t]} issues') for s, t in zip(sn, topics)) and len(sn) == len(topics), sn[:2])
    R.check(f'{w}: each topic heading carries its icon', pg.page.evaluate("[...document.querySelectorAll('#is-q-body .ig6-sh')].every(s => s.querySelector('.ig6-pic svg'))"))
    pg.page.click('.ig6-jump .lg6-jchip >> nth=3'); pg.page.wait_for_timeout(900)
    jt = pg.page.evaluate("(() => { const h = document.querySelector('#ig6-g-family'); const r = h.getBoundingClientRect(); return [Math.round(r.top), document.activeElement === h]; })()")
    R.check(f'{w}: a chip brings its topic to the top, clear of the top bar, and moves focus there', jt[1] and ((40 < jt[0] <= 140) if w >= 768 else (40 <= jt[0] <= 100)), jt)
    if w < 768:
      pg.page.evaluate("scrollTo(0, document.querySelector('#ig6-g-care').closest('section').offsetTop + 600)"); pg.page.wait_for_timeout(300)
      st = pg.page.evaluate("(() => { const r = document.querySelector('#ig6-g-care').closest('.ig6-sh').getBoundingClientRect(); return Math.round(r.top); })()")
      R.check(f'{w}: on a phone the topic heading stays under the top bar while its cards pass', 40 <= st <= 70, st)
    pg.page.evaluate('scrollTo(0, 0)'); pg.page.wait_for_timeout(200)
    shot(pg, 'all-by-topic')

    # ---- 2. the cards ----
    R.check(f'{w}: each card is one link to its issue', all(c['links'] == 0 and c['href'] == f"#/issue/{c['id']}" for c in cs))
    R.check(f'{w}: each card names its issue', all(c['name'] == by[c['id']]['name'] for c in cs))
    tint_of = {c['key']: f'ig6-tint{k + 1}' for k, c in enumerate(data['cats'])}
    R.check(f'{w}: each card shows its topic\'s icon on its topic\'s tint', all(c['svg'] and c['tint'] == tint_of[by[c['id']]['cat']] for c in cs), [c['name'] for c in cs if c['tint'] != tint_of[by[c['id']]['cat']]][:3])
    R.check(f'{w}: six different tints, one per topic', len({c['tint'] for c in cs}) == 6)
    def cut_ok(c):
      d = by[c['id']]['desc'].strip(); t = c['desc'][0] if c['desc'] else ''
      if t in ('Not public yet', 'Not in the first visit', 'Not public yet, Not in the first visit'): return True   # its tag takes the line
      if not d: return not t
      if t.endswith('…'): p = t[:-1]; return d.startswith(p) and (len(d) == len(p) or not d[len(p)].isalnum()) and len(p) >= 10
      return d.startswith(t)
    bad = [c['desc'] for c in cs if not cut_ok(c)]
    R.check(f'{w}: one line of the description, cut at a word, never mid-word', not bad, bad[:3])
    R.check(f'{w}: the whole description is the card\'s title', all(c['title'] == by[c['id']]['desc'] for c in cs))
    nclamp = pg.page.evaluate("[...document.querySelectorAll('#is-q-body .ig6-desc')].filter(e => e.scrollHeight > e.clientHeight + 2).length")
    R.check(f'{w}: no description runs past its two lines (the cut is the word\'s, not the box\'s)', nclamp == 0, nclamp)
    STAT = r'(At risk: .+ needs? a hearing( by .+)?|Safe, but a bill on it is dying: .+|(Your step: testimony|Testimony) (due .+|late, still accepted until .+)|Testimony filed, hearing .+|Testimony missed|Hearing .+|.+ needs? a hearing by .+|\d+ bills? alive( · (House and Senate|in the (House|Senate)|with the Governor|.+))?|HIPHI opposes it · \d+ bills? alive|No bills this session|Nothing moving this session|Its bills did not advance|No \d{4} bills on it( yet)?|\d+ bills? in \d{4}|Safe: .+|Next deadline: .+|Bills must .+)'
    bad = [c['stat'] for c in cs if not re.fullmatch(STAT, c['stat'])]
    R.check(f'{w}: one status line in words on every card', not bad, bad[:4])
    R.check(f'{w}: the status lines vary (alive, at risk or a hearing, no bills)', any('alive' in c['stat'] for c in cs) and any(re.match(r'(At risk|Testimony|Your step|Hearing)', c['stat']) for c in cs), sorted({c['stat'][:14] for c in cs})[:6])
    R.check(f'{w}: "2 bills alive · House and Senate" reads as Nate wrote it', any(re.fullmatch(r'\d+ bills alive · House and Senate', c['stat']) for c in cs))
    n = per_row(pg)
    R.check(f'{w}: {"four or five" if w >= 768 else "two"} cards a row', (4 <= n <= 5) if w >= 768 else n == 2, n)
    R.check(f'{w}: no sideways scroll (by topic)', overflow(pg) <= 0, overflow(pg))

    # ---- 3. the sorts ----
    sort(pg, 'A to Z'); cs2 = cards(pg)
    R.check(f'{w}: A to Z: every issue in one grid, in order', len(cs2) == len(by) and pg.page.evaluate("document.querySelectorAll('#is-q-body .ig6-grid').length") == 1
      and all(a['name'].lower() <= b['name'].lower() for a, b in zip(cs2, cs2[1:])), [c['name'] for c in cs2[:3]])
    letters = []
    for c in cs2:
      k = c['name'][0].upper()
      if not letters or letters[-1] != k: letters.append(k)
    R.check(f'{w}: A to Z: a letter badge on each letter\'s first card, and a chip per letter', [c['badge'] for c in cs2 if c['badge']] == letters and chips(pg) == letters, chips(pg)[:6])
    R.check(f'{w}: Sort says A to Z', pg.page.get_attribute('[data-igsort]', 'aria-label') == 'Sort, now A to Z')
    pg.page.evaluate('scrollTo(0, 0)'); shot(pg, 'all-a-to-z')
    pg.open(ALL)
    R.check(f'{w}: the sort is remembered on this device', pg.page.get_attribute('[data-igsort]', 'aria-label') == 'Sort, now A to Z')
    sort(pg, 'By next deadline'); hs = heads(pg)
    order = ['This week', 'Next deadlines', 'Safe for now', 'Nothing moving this session', 'No bills yet']
    R.check(f'{w}: By next deadline: R-272\'s groups in order', hs and hs[0] == 'This week' and hs == [x for x in order if x in hs], hs)
    cs3 = cards(pg)
    R.check(f'{w}: By next deadline: every issue once', sorted(c['id'] for c in cs3) == sorted(by), len(cs3))
    wk = [c['stat'] for c in cs3 if c['group'] == 'This week']
    R.check(f'{w}: This week holds the issues at risk or with a hearing', wk and all(re.match(r'(At risk|Safe, but|Testimony|Your step|Hearing)', s) for s in wk), wk[:4])
    fold = pg.page.evaluate("[...document.querySelectorAll('#is-q-body details.ig6-fold')].map(d => [d.querySelector('summary').innerText.trim(), d.open])")
    R.check(f'{w}: what is not moving and what has no bills wait in folds', all(not o for _, o in fold) and len(fold) >= 1, fold)
    fc = [x for x in chips(pg) if x.startswith('Nothing moving') or x.startswith('No bills')]
    if fc:
      pg.page.click(f'.ig6-jump .lg6-jchip >> text="{fc[0].rsplit(" ", 1)[0]}"'); pg.page.wait_for_timeout(700)
      R.check(f'{w}: a fold\'s chip opens it', pg.page.evaluate("[...document.querySelectorAll('#is-q-body details.ig6-fold')].some(d => d.open)"))
    pg.page.evaluate('scrollTo(0, 0)'); pg.page.wait_for_timeout(200); shot(pg, 'all-by-deadline')
    R.check(f'{w}: no sideways scroll (by deadline)', overflow(pg) <= 0, overflow(pg))
    sort(pg, 'By topic')
    R.check(f'{w}: back to By topic', heads(pg) == topics)

    # ---- 4. the find box, New issue ----
    find(pg, 'school meals'); cs4 = cards(pg)
    found = pg.page.evaluate("document.querySelector('#is-q-body .i6-found')?.innerText || ''")
    R.check(f'{w}: the find box narrows to matching cards', 0 < len(cs4) < len(by) and re.match(r'\d+ issues? match', found) and any('school meals' in c['name'].lower() for c in cs4), (found, len(cs4)))
    R.check(f'{w}: Sort steps aside while the box shows matches', pg.page.evaluate("document.querySelector('[data-igsort]').hidden") is True)
    R.check(f'{w}: typing keeps the focus in the box', pg.page.evaluate("document.activeElement?.id") == 'is-q')
    shot(pg, 'all-find')
    hb = pg.page.evaluate("import('./staff6/data.js').then(m => { const ids = new Set(m.S.billIssues.map(x => x.bill_id)); const b = m.S.bills.find(b => ids.has(b.id) && /^HB/.test(b.bill_number) && (!b.session_year || +b.session_year === 2026) && b.tracked !== false); return b ? [b.bill_number, m.S.billIssues.filter(x => x.bill_id === b.id).map(x => x.issue_id)] : null; })")
    if hb:
      num = re.sub(r'^([A-Z]+)(\d+).*$', r'\1 \2', hb[0])
      for q in [num, num.replace(' ', '').lower()]:
        find(pg, q); ids = {c['id'] for c in cards(pg)}
        R.check(f'{w}: the find box finds a bill number typed "{q}"', any(i in ids for i in hb[1] if i in by), (q, len(ids)))
    find(pg, 'zzzz qqqq')
    R.check(f'{w}: no match says so in words', 'No issue matches' in pg.text('#is-q-body'))
    pg.page.click('[data-istq="clear"]'); pg.page.wait_for_timeout(400)
    R.check(f'{w}: clearing the box brings the topics back, and Sort', heads(pg) == topics and pg.page.evaluate("document.querySelector('[data-igsort]').hidden") is False, heads(pg)[:2])
    nb = pg.page.locator('[data-is="new"]:visible')
    R.check(f'{w}: New issue is in view', nb.count() == 1, nb.count())
    if nb.count():
      nb.first.click(); pg.page.wait_for_timeout(600)
      R.check(f'{w}: New issue opens its form', pg.page.evaluate("!!document.querySelector('dialog[open] input, dialog[open] textarea')"))
      pg.page.keyboard.press('Escape'); pg.page.wait_for_timeout(500)
    # the card opens its issue, and Back puts the focus on it again (rule 10)
    first = cards(pg)[0]
    pg.page.click(f'[data-igcard="{first["id"]}"] .ig6-link'); pg.page.wait_for_timeout(500); pg.ready()
    R.check(f'{w}: a card opens its issue', pg.hash() == f"#/issue/{first['id']}", pg.hash())
    pg.page.go_back(); pg.page.wait_for_timeout(700); pg.ready()
    R.check(f'{w}: Back puts the focus on the card it came from', pg.page.evaluate("document.activeElement?.closest('[data-igcard]')?.dataset.igcard") == first['id'])
    R.check(f'{w}: All issues: no page errors', not pg.errors, pg.errors[:2])

    # ---- 5. Coalitions ----
    pg.nav(COAL)
    cc = cards(pg); cby = {c['id']: c for c in data['camps']}
    hs = pg.page.evaluate("[...document.querySelectorAll('.co6-index .ig6-sh h2')].map(h => h.innerText.trim())")
    R.check(f'{w}: Coalitions: your coalition first, then the others', hs == ['Your coalition', 'Other coalitions'], hs)
    R.check(f'{w}: Coalitions: every coalition once, as a card', sorted(c['id'] for c in cc) == sorted(cby), len(cc))
    mine = [c for c in cc if c['group'] == 'Your coalition']
    R.check(f'{w}: Coalitions: Nate\'s own coalition leads, with no I help on it', len(mine) == 1 and cby[mine[0]['id']]['owner'] == data['me'] and not mine[0]['foot'], mine[:1])
    R.check(f'{w}: each coalition card is one link to its page', all(c['links'] == 0 and c['href'] == f"#/coalition/{c['id']}" for c in cc))
    R.check(f'{w}: each coalition card shows its icon on a tint', all(c['svg'] and c['tint'] for c in cc))
    full_ok = all((c['desc'][0] == cby[c['id']]['full']) if cby[c['id']]['full'] and cby[c['id']]['full'] != c['name'] else True for c in cc)
    R.check(f'{w}: each card names it and says its full name', all(c['name'] == cby[c['id']]['name'] for c in cc) and full_ok)
    R.check(f'{w}: each card says its owner', all(re.fullmatch(r'You own it|Owner: .+|No owner yet', c['desc'][-1]) for c in cc), [c['desc'] for c in cc][:2])
    R.check(f'{w}: each card says its week', all(re.fullmatch(r'(\d+ live bills?|No live bills), (\d+ hearings? this week|no hearings this week)', c['stat']) for c in cc), [c['stat'] for c in cc][:3])
    R.check(f'{w}: I help on every coalition Nate does not own', all(c['foot'] and c['foot'][0][0] == 'I help' for c in cc if c not in mine))
    n = per_row(pg, '.co6-index section:nth-of-type(2) .ig6-cell')
    R.check(f'{w}: Coalitions: {"four or five" if w >= 768 else "two"} cards a row', (4 <= n <= 5) if w >= 768 else n == 2, n)
    R.check(f'{w}: Coalitions: no sideways scroll', overflow(pg) <= 0, overflow(pg))
    shot(pg, 'coalitions')
    other = next(c for c in cc if c not in mine)
    sel = f'[data-igcard="{other["id"]}"] [data-misup]'
    pg.page.click(sel); pg.page.wait_for_timeout(700)
    R.check(f'{w}: I help still works: pressed, and it says so', pg.page.get_attribute(sel, 'aria-pressed') == 'true' and 'You help on' in pg.page.evaluate("document.querySelector('#toast')?.innerText || ''"), pg.page.evaluate("document.querySelector('#toast')?.innerText || ''")[:80])
    R.check(f'{w}: the card stays where it was until the next visit', pg.page.evaluate(f"document.querySelector('[data-igcard=\"{other['id']}\"]').closest('section').querySelector('h2').innerText.trim()") == 'Other coalitions')
    R.check(f'{w}: the focus stays on I help', pg.page.evaluate("document.activeElement?.dataset?.misup") == other['id'])
    pg.page.click(sel); pg.page.wait_for_timeout(700)
    R.check(f'{w}: pressed again, it lets go', pg.page.get_attribute(sel, 'aria-pressed') == 'false')
    # a coalition with no icon gets a monogram, never a broken or stand-in picture
    pg.page.evaluate(f"import('./staff6/data.js').then(m => {{ const c = m.S.campaigns.find(c => c.id === '{other['id']}'); c.icon = ''; m.hooks.render(); }})"); pg.page.wait_for_timeout(500)
    mono = pg.page.evaluate(f"document.querySelector('[data-igcard=\"{other['id']}\"] .ig6-mono')?.innerText || ''")
    R.check(f'{w}: a coalition with no icon shows a monogram', bool(re.fullmatch(r'[A-Z0-9]{1,2}', mono)), mono)
    R.check(f'{w}: Coalitions: no page errors', not pg.errors, pg.errors[:2])
    pg.close()

R.done()
