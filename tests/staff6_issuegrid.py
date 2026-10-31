# Staff v6: My issues › All issues and › Coalitions as grids of cards (R-336 walk 3), calmer since R-352 (Nate 27 Oct: "keep
# the issue cards, but calmer"). On the practice copy (Mon 16 Mar 2026), as Nate, at 1440x900 and 390x844.
#   1. By topic (the default): the six topics in order, each a heading led by its topic's tinted icon tile (R-352 FIX-3) and a
#      count over a grid of its issues, the
#      most urgent first inside (issuestand.js byUrgency), the issues with nothing moving in a closed fold at the topic's end;
#      every live issue shown once, under its own topic; a jump chip per topic that brings its heading to the top and puts the
#      focus there.
#   2. Each card is one link to the issue: the issue's small icon beside its name (no band, tile or monogram), how it stands
#      in one word with its shape (On track's tick hidden: a tick reads as done), and its next step and date in one line, with
#      no check mark and no description cut off with "…"; four a row on a laptop; on a phone each topic is one list card of
#      rows, a row the name and one line.
#   3. Sort: By topic, A to Z (one grid, letter chips), By next deadline (R-272's groups: This week, Next deadlines...); the
#      pick is remembered on this device.
#   4. The find box matches words and bill numbers ("HB 1779" and "hb1779"), Sort steps aside while it shows matches, and
#      clearing it brings the groups back. New issue opens its form.
#   5. Coalitions: your coalition first, then the others; each card the same calm card: its small icon beside its name (none
#      when it has none or its icon is a topic's), its full name then its short one, its owner and its week; I help stays on
#      the card, says what it does in its title, and still works.
#   6. No sideways scroll and no page errors.
#
#   V4_ROOT=/path/to/worktree python3 tests/staff6_issuegrid.py      exits 1 when a check fails
#   --shots DIR                                                      saves each sort and Coalitions, laptop and phone
import os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import staff6_lib as L

R = L.Results()
SHOTS = sys.argv[sys.argv.index('--shots') + 1] if '--shots' in sys.argv else ''
ALL, COAL = '/issues/all', '/issues/coalitions'
def overflow(pg): return pg.page.evaluate('document.documentElement.scrollWidth - innerWidth')
CARDS = """[...document.querySelectorAll('#is-q-body .ig6-cell, .co6-index .ig6-cell')].map(c => { const a = c.querySelector('.ig6-link');
  return { id: c.dataset.igcard, href: a.getAttribute('href'), title: a.getAttribute('title') || '', name: a.querySelector('.ig6-name')?.textContent.trim(),
    desc: [...a.querySelectorAll('.ig6-desc')].map(e => e.innerText.trim()), stat: a.querySelector('.ig6-stat')?.textContent.replace(/\\s+/g, ' ').trim() || '',
    next: a.querySelector('.ig6-next')?.textContent.replace(/\\s+/g, ' ').trim() || '', nextIc: [...a.querySelectorAll('.ig6-next svg')].map(s => [...s.classList].find(k => k.startsWith('ic-')) || ''),
    state: a.querySelector('.ig6-stat [data-state]')?.dataset.state || '', text: a.innerText,
    links: a.querySelectorAll('a, button').length, svg: !!a.querySelector('.ig6-top > .ig6-ic svg'), icH: Math.round(a.querySelector('.ig6-ic svg')?.getBoundingClientRect().height || 0),
    old: !!a.querySelector('.ig6-pic, .ig6-mono, .ig6-badge'), rest: !!c.closest('.ig6-rest'),
    group: c.closest('section')?.querySelector('h2')?.innerText.trim() || c.closest('details')?.querySelector('summary')?.innerText.trim() || '', foot: [...c.querySelectorAll('.ig6-foot button')].map(b => [b.innerText.trim(), b.getAttribute('aria-pressed')]) }; })"""
def cards(pg): return pg.page.evaluate(CARDS)
def heads(pg): return pg.page.evaluate("[...document.querySelectorAll('#is-q-body .ig6-sh h2, #is-q-body .ig6-fold:not(.ig6-rest) > summary')].map(h => h.innerText.trim().replace(/\\s*\\(\\d+\\)$/, ''))")
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
    data = pg.page.evaluate("""import('./staff6/data.js').then(m => ({ topic_icons: [...new Set(m.S.categories.flatMap(c => [c.icon, c.icon === 'apple' ? 'salad' : c.icon]))], cats: m.S.categories.map(c => ({ key: c.key, name: c.name })),
      issues: m.S.issues.filter(i => !i.archived_at).map(i => ({ id: i.id, name: i.name, cat: i.category, desc: i.description || '' })),
      camps: m.S.campaigns.map(c => ({ id: c.id, name: c.name, full: c.public_name, owner: c.owner_id, icon: c.icon })), me: m.S.me.id }))""")
    by = {i['id']: i for i in data['issues']}
    cat_name = {c['key']: c['name'] for c in data['cats']}

    # ---- 1. By topic ----
    sortl = lambda: pg.page.inner_text('[data-igsort]').strip()
    R.check(f'{w}: Sort names the order in force: "Sort: By topic" by default', sortl() == 'Sort: By topic', sortl())
    topics = [c['name'] for c in data['cats'] if any(i['cat'] == c['key'] for i in data['issues'])]
    R.check(f'{w}: grouped by topic, the six in order', heads(pg) == topics, heads(pg))
    cs = cards(pg)
    R.check(f'{w}: every live issue shown once', sorted(c['id'] for c in cs) == sorted(by), f'{len(cs)} cards, {len(by)} issues')
    R.check(f'{w}: each issue under its own topic', all(c['group'] == cat_name[by[c['id']]['cat']] for c in cs), [(c['name'], c['group']) for c in cs if c['group'] != cat_name[by[c['id']]['cat']]][:3])
    # R-352: the most urgent first inside a topic (byUrgency, then the name); nothing moving waits in the topic's closed fold
    want = pg.page.evaluate("""Promise.all([import('./staff6/data.js'), import('./staff6/issuestand.js'), import('./staff6/verbs.js')]).then(([m, I, V]) => {
      const xs = m.S.issues.filter(i => !i.archived_at).map(I.standOf), out = {};
      for (const c of m.S.categories) { const l = xs.filter(x => x.i.category === c.key).sort((a, b) => I.byUrgency(a, b) || a.i.name.localeCompare(b.i.name, 'en', { sensitivity: 'base' }));
        const q = x => ['stopped', 'none'].includes(x.state) && V.issueKey(x) !== 'won';
        out[c.name] = [...l.filter(x => !q(x)), ...l.filter(q)].map(x => x.i.id); }
      return out; })""")
    got = {}
    for c in cs: got.setdefault(c['group'], []).append(c['id'])
    R.check(f'{w}: the most urgent first inside a topic, nothing moving last', all(got.get(t) == want[t] for t in topics), [t for t in topics if got.get(t) != want[t]][:2])
    rest = [c for c in cs if c['rest']]
    R.check(f'{w}: the issues with nothing moving wait in a closed fold at their topic\'s end', rest and all(c['state'] == 'issue:stopped' or c['state'] == 'issue:none' for c in rest)
      and pg.page.evaluate("[...document.querySelectorAll('#is-q-body details.ig6-rest')].every(d => !d.open && /^Not moving this session \\(\\d+\\)$/.test(d.querySelector('summary').innerText.trim()))"), len(rest))
    R.check(f'{w}: At risk leads its topic', all(got[c['group']][0] == c['id'] for c in cs if c['state'] == 'issue:risk'))
    n_of = {t: sum(1 for c in cs if c['group'] == t) for t in topics}
    R.check(f'{w}: a jump chip per topic, with its count', chips(pg) == [f'{t} {n_of[t]}' for t in topics], chips(pg))
    sn = pg.page.evaluate("[...document.querySelectorAll('#is-q-body .ig6-sn')].map(e => e.innerText.trim())")
    R.check(f'{w}: a topic heading says only what the chip does not (no issue count again)', all(re.fullmatch(r'(\d+ at risk|\d+ with a hearing this week)(, \d+ with a hearing this week)?', s) for s in sn) and not any('issue' in s for s in sn), sn[:3])
    # R-352 FIX-3 (Nate 28 Oct: "keep ... the colored icons as issue headings"): each topic heading leads with its topic's icon
    # on its own tint, a rounded square (never round like a person's initials, A-5 on v6), hidden from screen readers (the
    # heading says the topic); the six tints differ; the cards under it keep their small untinted icon only
    th = pg.page.evaluate("""[...document.querySelectorAll('#is-q-body .ig6-sh')].map(s => { const t = s.querySelector(':scope > .ig6-htile'), cs = t && getComputedStyle(t);
      return { tile: !!t && !!t.querySelector('svg') && t.getAttribute('aria-hidden') === 'true', bg: cs ? cs.backgroundColor : '', round: cs ? parseFloat(cs.borderTopLeftRadius) >= t.offsetWidth / 2 : false, svgs: s.querySelectorAll('svg').length }; })""")
    R.check(f'{w}: every topic heading carries one tile, its topic\'s icon on its tint, a rounded square', bool(th) and all(x['tile'] and x['svgs'] == 1 and not x['round'] and not re.search(r'rgba\(0, 0, 0, 0\)', x['bg']) for x in th), th[:2])
    R.check(f'{w}: the six topics\' tiles wear six different tints', len({x['bg'] for x in th[:6]}) == min(6, len(th)), [x['bg'] for x in th])
    pg.page.click('.ig6-jump .lg6-jchip >> nth=3'); pg.page.wait_for_timeout(900)
    jt = pg.page.evaluate("(() => { const h = document.querySelector('#ig6-g-family'); const r = h.getBoundingClientRect(); return [Math.round(r.top), document.activeElement === h]; })()")
    R.check(f'{w}: a chip brings its topic to the top, clear of the top bar, and moves focus there', jt[1] and ((40 < jt[0] <= 140) if w >= 768 else (40 <= jt[0] <= 100)), jt)
    if w < 768:
      pg.page.evaluate("scrollTo(0, document.querySelector('#ig6-g-care').closest('section').offsetTop + 600)"); pg.page.wait_for_timeout(300)
      st = pg.page.evaluate("(() => { const r = document.querySelector('#ig6-g-care').closest('.ig6-sh').getBoundingClientRect(); return Math.round(r.top); })()")
      R.check(f'{w}: on a phone the topic heading stays under the top bar while its cards pass', 40 <= st <= 70, st)
    pg.page.evaluate('scrollTo(0, 0)'); pg.page.wait_for_timeout(200)
    if w < 768:
      pg.open(ALL)
      R.check(f'{w}: the chip row starts at its first chip', pg.page.evaluate("document.querySelector('.ig6-jump .lg6-jrow').scrollLeft") == 0)
    hv = pg.page.evaluate("(() => { const r = [...document.styleSheets].flatMap(s => { try { return [...s.cssRules]; } catch { return []; } }).flatMap(r => r.cssRules ? [...r.cssRules] : [r]).find(r => r.selectorText === 'body.staff6 .ig6-jump .lg6-jchip:hover'); return r ? r.style.background : ''; })()")
    R.check(f'{w}: a chip\'s hover is the page\'s wash, not the selected teal', 'wash-hover' in hv, hv)
    shot(pg, 'all-by-topic')

    # ---- 2. the cards ----
    R.check(f'{w}: each card is one link to its issue', all(c['links'] == 0 and c['href'] == f"#/issue/{c['id']}" for c in cs))
    R.check(f'{w}: each card names its issue', all(c['name'] == by[c['id']]['name'] for c in cs), [(c['name'], by[c['id']]['name']) for c in cs if c['name'] != by[c['id']]['name']][:3])
    R.check(f'{w}: each card shows the issue\'s small icon beside its name: no band, tile, monogram or badge', all(c['svg'] and not c['old'] and 0 < c['icH'] <= 20 for c in cs), [c['name'] for c in cs if not c['svg'] or c['old']][:3])
    R.check(f'{w}: no description on the card, nothing cut off with "…"', all(not c['desc'] and '…' not in c['text'] for c in cs), [c['name'] for c in cs if c['desc'] or '…' in c['text']][:3])
    R.check(f'{w}: the whole description is the card\'s title', all(c['title'] == by[c['id']]['desc'] for c in cs))
    STAND = r'(At risk|On track|Stopped|Won|No bills yet)( · Not public yet)?'
    bad = [c['stat'] for c in cs if not re.fullmatch(STAND, c['stat'])]
    R.check(f'{w}: how it stands, in one word on every card', not bad, bad[:4])
    R.check(f'{w}: the stands vary (on track, stopped, won, at risk)', len({c['state'] for c in cs}) >= 3, sorted({c['state'] for c in cs}))
    NEXT = r'(.+: (?:Follow up|Asked by|Ask the chairs?).+|.+ needs? a hearing by \w{3} \d+/\d+|.+ testimony: .+|.+: (?:Writing|With an approver|Second look|Ready to file).+|.+ hearing \w+.*|.+ past .+|Next deadline: .+|Bills must .+|No hearing set.*|.+ reached .+|.+ (was|were) settled|Through its committees)'
    bad = [c['next'] for c in cs if c['next'] and not re.fullmatch(NEXT, c['next'])]
    R.check(f'{w}: the next step and its date in one line', not bad, bad[:4])
    R.check(f'{w}: every issue that can still move says its next step', all(c['next'] for c in cs if c['state'] in ('issue:ontrack', 'issue:risk')), [c['name'] for c in cs if c['state'] in ('issue:ontrack', 'issue:risk') and not c['next']][:3])
    R.check(f'{w}: no check mark before a next step (a check means done)', not any(k in ('ic-check', 'ic-circle-check', 'ic-square-check-big') for c in cs for k in c['nextIc']), [c['nextIc'] for c in cs if c['nextIc']][:4])
    R.check(f'{w}: the next step\'s only icons are the time\'s own (clock, alarm clock, alert)', all(k in ('ic-clock', 'ic-alarm-clock', 'ic-circle-alert') for c in cs for k in c['nextIc']))
    R.check(f'{w}: On track\'s tick is not drawn', pg.page.evaluate("[...document.querySelectorAll('#is-q-body .ig6-stat [data-state=\"issue:ontrack\"] .v6-sm-ic')].every(e => !e.getClientRects().length)"))
    today = pg.page.evaluate("[...document.querySelectorAll('#is-q-body .ig6-next.t-today')].map(e => [e.querySelector('svg')?.classList.contains('ic-clock'), getComputedStyle(e.querySelector('.v6-tm')).fontWeight, getComputedStyle(e).color, getComputedStyle(e.closest('.ig6-card')).color])")
    R.check(f'{w}: due today is plain: a clock, the time in bold, the body colour', today and all(x[0] and int(x[1]) >= 700 for x in today), today[:2])
    n = per_row(pg)
    if w >= 768:
      R.check(f'{w}: four cards a row', n == 4, n)
      ch = pg.page.evaluate("[...document.querySelectorAll('#is-q-body .ig6-card')].slice(0, 40).map(c => Math.round(c.getBoundingClientRect().height))")
      R.check(f'{w}: calm cards: about 160px at most (a name, a word, a line)', max(ch) <= 190, max(ch))
    else:
      R.check(f'{w}: on a phone, a row of a list card', n == 1 and pg.page.evaluate("(() => { const g = document.querySelector('#is-q-body .ig6-grid'), c = g.querySelector('.ig6-card'); return getComputedStyle(g).display === 'block' && /rgba\\(0, 0, 0, 0\\)|transparent/.test(getComputedStyle(c).backgroundColor); })()"), n)
      ch = pg.page.evaluate("[...document.querySelectorAll('#is-q-body .ig6-card')].slice(0, 40).map(c => Math.round(c.getBoundingClientRect().height))")
      R.check(f'{w}: phone rows are short (the name and one line, about 64px)', sorted(ch)[len(ch) // 2] <= 70 and max(ch) <= 110, (min(ch), sorted(ch)[len(ch) // 2], max(ch)))
      R.check(f'{w}: phone rows still say a stand that is news in words', pg.page.evaluate("[...document.querySelectorAll('#is-q-body .ig6-stat [data-state=\"issue:risk\"], #is-q-body .ig6-stat [data-state=\"issue:stopped\"]')].every(e => e.closest('.ig6-stat').getBoundingClientRect().width > 20)"))
    R.check(f'{w}: All issues is about four laptop screens, under seven on a phone', pg.page.evaluate('document.documentElement.scrollHeight / innerHeight') <= (4.6 if w >= 768 else 7.0), round(pg.page.evaluate('document.documentElement.scrollHeight / innerHeight'), 2))
    R.check(f'{w}: no sideways scroll (by topic)', overflow(pg) <= 0, overflow(pg))

    # ---- 3. the sorts ----
    sort(pg, 'A to Z'); cs2 = cards(pg)
    R.check(f'{w}: A to Z: every issue in one grid, in order', len(cs2) == len(by) and pg.page.evaluate("document.querySelectorAll('#is-q-body .ig6-grid').length") == 1
      and all(a['name'].lower() <= b['name'].lower() for a, b in zip(cs2, cs2[1:])), [c['name'] for c in cs2[:3]])
    letters = []
    for c in cs2:
      k = c['name'][0].upper()
      if not letters or letters[-1] != k: letters.append(k)
    R.check(f'{w}: A to Z: a chip per letter (no letter badge on the cards)', chips(pg) == letters and not any(c['old'] for c in cs2), chips(pg)[:6])
    R.check(f'{w}: Sort says A to Z', sortl() == 'Sort: A to Z', sortl())
    pg.page.evaluate('scrollTo(0, 0)'); shot(pg, 'all-a-to-z')
    pg.open(ALL)
    R.check(f'{w}: the sort is remembered on this device', sortl() == 'Sort: A to Z', sortl())
    sort(pg, 'By next deadline'); hs = heads(pg)
    order = ['This week', 'Next deadlines', 'Safe for now', 'Nothing moving this session', 'No bills yet']
    R.check(f'{w}: By next deadline: R-272\'s groups in order', hs and hs[0] == 'This week' and hs == [x for x in order if x in hs], hs)
    cs3 = cards(pg)
    R.check(f'{w}: By next deadline: every issue once', sorted(c['id'] for c in cs3) == sorted(by), len(cs3))
    wk = [c for c in cs3 if c['group'] == 'This week']
    R.check(f'{w}: This week holds the issues at risk or with a hearing', wk and all(c['state'] == 'issue:risk' or re.search(r'testimony|hearing \w|: (?:Writing|With an approver|Second look|Ready to file)', c['next']) for c in wk), [c['next'] for c in wk][:4])
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
    R.check(f'{w}: New issue is in view, labelled ("New issue" on a laptop, "New" on a phone)', nb.count() == 1 and nb.first.inner_text().strip() == ('New issue' if w >= 768 else 'New'), [nb.nth(k).inner_text() for k in range(nb.count())])
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
    cards_by = {c['id']: c for c in cc}
    R.check(f'{w}: coalition cards are the calm card: no band, tile or monogram', all(not c['old'] for c in cc))
    norm = lambda s: re.sub(r'[^a-z0-9]', '', (s or '').lower())
    want = lambda k: (k['full'] or k['name']) + (f" · {k['name']}" if norm(k['full'] or k['name']) != norm(k['name']) else '')
    R.check(f'{w}: each card leads with the full name, the short name after it ("Community Health Workers · CHW")', all(c['name'] == want(cby[c['id']]) for c in cc), [c['name'] for c in cc][:3])
    R.check(f'{w}: each card says its owner', all(re.fullmatch(r'You own it|Owner: .+|No owner yet', c['desc'][-1]) for c in cc), [c['desc'] for c in cc][:2])
    R.check(f'{w}: each card says its week, in words with no icon', all(re.fullmatch(r'(\d+ live bills?|No live bills), (\d+ hearings? this week|no hearings this week)', c['stat']) for c in cc)
      and pg.page.evaluate("[...document.querySelectorAll('.co6-index .ig6-stat svg')].length") == 0, [c['stat'] for c in cc][:3])
    R.check(f'{w}: I help on every coalition Nate does not own', all(c['foot'] and c['foot'][0][0] == 'I help' for c in cc if c not in mine))
    n = per_row(pg, '.co6-index section:nth-of-type(2) .ig6-cell')
    R.check(f'{w}: Coalitions: {"four" if w >= 768 else "one"} card{"s" if w >= 768 else ""} a row', n == 4 if w >= 768 else n == 1, n)
    clash = [c for c in data['camps'] if c['icon'] in data['topic_icons']]
    R.check(f'{w}: a coalition whose icon is a topic\'s shows no icon (a picture keeps one meaning)', clash and all(not cards_by[c['id']]['svg'] for c in clash), [c['name'] for c in clash])
    helpt = pg.page.evaluate("[...document.querySelectorAll('.co6-index [data-misup]')].map(b => b.title)")
    R.check(f'{w}: I help says what it does in its title', helpt and all(x == 'Adds you as a helper: its bills show on your Today' for x in helpt), helpt[:1])
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
    # a coalition with no icon shows its name alone, never a broken or stand-in picture
    pg.page.evaluate(f"import('./staff6/data.js').then(m => {{ const c = m.S.campaigns.find(c => c.id === '{other['id']}'); c.icon = ''; m.hooks.render(); }})"); pg.page.wait_for_timeout(500)
    R.check(f'{w}: a coalition with no icon shows its name alone', pg.page.evaluate(f"(() => {{ const c = document.querySelector('[data-igcard=\"{other['id']}\"]'); return !!c && !c.querySelector('.ig6-top svg') && !!c.querySelector('.ig6-name').innerText.trim(); }})()"))
    R.check(f'{w}: Coalitions: no page errors', not pg.errors, pg.errors[:2])
    pg.close()

R.done()
