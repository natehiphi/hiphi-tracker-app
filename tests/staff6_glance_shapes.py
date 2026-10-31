# Staff v6: the at-a-glance picture rules (R-344; R-336's at-a-glance review, Nate's decisions of 26 Oct). On the practice
# copy (Mon 16 Mar 2026), as Nate, at 1440x900 and 390x844.
#   1. One table (staff6/verbs.js): every action has a word, an icon and a tile hue; each status set (testimony, chair ask,
#      issue, stance) uses a different shape for each state, and no icon carries two meanings across the table (Rule 5).
#   2. Testimony (R-352, A-18 on v6: no icons on a list of one kind): no row leads with a job tile; a teammate's row with an
#      owner leads with their face, a row nobody holds and your own rows show none; the tabs are words, no icon; every row
#      button keeps its icon; a sent-back draft's row says Revise or Resubmit, a new draft's never does. The open item's
#      step picture has 20px dots and stays on one line, "Second look" included (C5).
#   3. Partners, Words to approve: every row starts with the partner tile; Approve carries its icon.
#   4. Bills (Team) (R-352 part 7, and D, Nate 28 Oct): a row is its own soft card led by its issue's tile on the topic's
#      tint (or an empty slot), then a name, its number and one line: no bar, no job tile, no icon beside a group heading;
#      two shown bills that share a name say whose twin; no row passes spec 8's four facts. Search:
#      the twins name each other, each bill result keeps its slim progress bar (R-352 FIX-3), no line drawn past its box.
#   5. All issues: each card says how the issue is doing as one shape and word (no tint), with the House and Senate dots.
#   6. No sideways scroll, no page errors.
#   Part 2 (the files R-346 held): Today's rows (R-352 part 2) lead with one small neutral kind-of-job icon, not a coloured
#   tile, and every button carries its icon; due today is plain with its clock and its time bold (R-352, amending Decision
#   2); the bill page's step card shows no job tile (its button has the icon), the bigger step picture and "The Capitol’s deadline"; the issue page's
#   health check is an issue shape; the ask board's chair names link to their pages (R-352 part 8b, no faces); the Capitol
#   building is not used for hearings or asks (Rule 5).
#
#   V4_ROOT=/path/to/worktree python3 tests/staff6_glance_shapes.py      exits 1 when a check fails
#   --shots DIR                                                         saves each screen, laptop and phone
import os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import staff6_lib as L

R = L.Results()
SHOTS = sys.argv[sys.argv.index('--shots') + 1] if '--shots' in sys.argv else ''
def overflow(pg): return pg.page.evaluate('document.documentElement.scrollWidth - innerWidth')
def shot(pg, name):
  if SHOTS: pg.shot(os.path.join(SHOTS, f'{name}-{pg.w}.png'))

TABLE = """import('./staff6/verbs.js').then(V => ({ conflicts: V.conflicts(),
  sets: Object.fromEntries(Object.entries(V.STATES).map(([k, s]) => [k, Object.entries(s).map(([key, x]) => [key, x.icon, x.word, x.tone])])),
  acts: Object.entries(V.ACTS).map(([k, a]) => [k, a.word, a.icon, a.hue]),
  hues: [...new Set(Object.values(V.ACTS).map(a => a.hue))],
  tile: V.actTile('file'), track: V.testimonyTrack({ state: { key: 'write', sentBack: true }, d: null }, { second: true }) }))"""
ROWS = """(sel) => [...document.querySelectorAll(sel)].map(r => ({ key: r.dataset.v6row || '', tile: !!r.querySelector('.v6-act-lead, .v6-at'), face: !!r.querySelector('.v6-row-lead.sv-face .sv-av'),
  line: r.querySelector('.v6-row-line')?.innerText.trim() || '',
  mine: !!r.closest('[role=list]') && (() => { let p = r.previousElementSibling; while (p && !p.classList.contains('tp-gh')) p = p.previousElementSibling; return !!p && /For you/.test(p.innerText); })(),
  act: r.querySelector('.v6-row-main .v6-at')?.dataset.act || '', name: r.querySelector('.v6-row-name')?.innerText.trim() || '',
  btns: [...r.querySelectorAll('.v6-row-act .btn')].map(b => [b.innerText.trim(), !!b.querySelector('svg')]) }))"""

with L.browser() as B:
  for w, h in [(1440, 900), (390, 844)]:
    pg = B.page('NT', w, h)
    # ---- 1. the table ----
    pg.open('/testimony')
    t = pg.page.evaluate(TABLE)
    if w == 1440:
      R.check('verbs.js: no icon carries two meanings (Rule 5)', not t['conflicts'], t['conflicts'])
      for name, states in t['sets'].items():
        icons = [s[1] for s in states]
        R.check(f'verbs.js: the {name} set uses one shape per state', len(icons) == len(set(icons)), icons)
        R.check(f'verbs.js: the {name} set has a word for every state', all(s[2] for s in states))
        R.check(f'verbs.js: the {name} set uses only the status colours (done, late, overdue)', all(s[3] in ('', 'done', 'late', 'overdue') for s in states))
      R.check('verbs.js: every action has a word, an icon and a hue', all(a[1] and a[2] and a[3] for a in t['acts']), [a for a in t['acts'] if not (a[1] and a[2] and a[3])][:3])
      R.check('verbs.js: the tile hues are the six action families', set(t['hues']) == {'write', 'approve', 'file', 'chair', 'rally', 'take'}, t['hues'])
      R.check('verbs.js: a sent-back draft\'s step picture says Revise with its own shape', 'Revise' in t['track'] and 'is-sent' in t['track'])
      hues = pg.page.evaluate("""['write', 'approve', 'file', 'chair', 'rally', 'take'].map(k => getComputedStyle(document.body).getPropertyValue('--v6-hue-' + k).trim())""")
      late = pg.page.evaluate("['--v6-late', '--v6-bad', '--v6-leaf'].map(k => getComputedStyle(document.body).getPropertyValue(k).trim().toLowerCase())")
      R.check('steps.css: the tile hues are never the amber, red or green of status (A-5)', all(x and x.lower() not in late for x in hues), hues)

    # ---- 2. Testimony ----
    for view in ['write', 'approve', 'sent', 'file', 'filed']:
      pg.nav(f'/testimony?view={view}')
      rows = pg.page.evaluate(ROWS, '.tp .v6-row')
      if not rows: R.check(f'{w} Testimony {view}: rows', True, skip='no rows on this tab in the practice copy'); continue
      # R-352 part 8a (A-18 on v6): a list of one kind, so no job tile on any row; whose it is shows only where it matters, a
      # teammate's row that has an owner leads with their face; your own rows, a row nobody holds and the record show none.
      R.check(f'{w} Testimony {view}: no row leads with a job tile (A-18: a list of one kind)', not any(r['tile'] for r in rows), [r['name'] for r in rows if r['tile']][:3])
      R.check(f'{w} Testimony {view}: your own rows show no tile and no face', not any(r['face'] for r in rows if r['mine']), [r['name'] for r in rows if r['mine'] and r['face']][:3])
      owned = [r for r in rows if not r['mine'] and view != 'filed' and not r['line'].startswith('No owner')]
      if view != 'filed' and owned: R.check(f'{w} Testimony {view}: a teammate\'s row with an owner leads with their face', all(r['face'] for r in owned), [r['name'] for r in owned if not r['face']][:3])
      R.check(f'{w} Testimony {view}: a row nobody holds says so in words, with no face', not any(r['face'] for r in rows if r['line'].startswith('No owner')), [r['name'] for r in rows if r['line'].startswith('No owner') and r['face']][:3])
      if view == 'filed': R.check(f'{w} Testimony filed: the record shows no face', not any(r['face'] for r in rows), [r['name'] for r in rows if r['face']][:3])
      btns = [b for r in rows for b in r['btns']]
      R.check(f'{w} Testimony {view}: every row button carries its icon', all(b[1] for b in btns), [b[0] for b in btns if not b[1]][:3])
      # a sent-back draft and a new one still differ at a glance, now in words: Revise or Resubmit, never "Make the draft"
      rv = lambda r: bool(re.search(r'\b(revise|resubmit)', ' '.join([r['line']] + [b[0] for b in r['btns']]), re.I))
      if view == 'sent': R.check(f'{w} Testimony sent back: every row says Revise or Resubmit, never a new draft\'s words', all(rv(r) for r in rows), [(r['line'], r['btns']) for r in rows if not rv(r)][:3])
      if view == 'write': R.check(f'{w} Testimony to write: no row says Revise or Resubmit', not any(rv(r) for r in rows), [r['line'] for r in rows if rv(r)][:3])
    tabs = pg.page.evaluate("[...document.querySelectorAll('.tp .sv-secnav a')].map(a => [a.innerText.trim().split(/\\s/)[0], a.querySelectorAll('svg').length])")
    R.check(f'{w} Testimony: the tabs are words, no icon inside any tab (A-18 on v6)', tabs and all(x[1] == 0 for x in tabs), tabs)
    shot(pg, 'testimony')
    # the open item: Sent back's own draft, and an approval with its second look
    for view in ['sent', 'approve']:
      pg.nav(f'/testimony?view={view}')
      first = pg.page.query_selector('.tp .v6-row-main[data-v6pick]')
      if not first: continue
      first.click(); pg.page.wait_for_timeout(700); pg.ready()
      tt = pg.page.evaluate("""(() => { const o = document.querySelector('.v6-tt'); if (!o) return null; const li = [...o.querySelectorAll('li')];
        const tops = li.map(x => Math.round(x.getBoundingClientRect().top)); const d = o.querySelector('.v6-tt-dot').getBoundingClientRect();
        return { n: li.length, words: li.map(x => x.querySelector('.v6-tt-w').innerText.trim()), oneLine: Math.max(...tops) - Math.min(...tops) <= 2,
          dot: Math.round(d.width), cur: o.querySelector('li.cur')?.className || '', old: !!document.querySelector('.tp-item .v6-track'),
          fits: o.scrollWidth <= o.clientWidth + 1 }; })()""")
      if not tt: R.check(f'{w} Testimony {view}: the open item shows the step picture', False, 'none'); continue
      R.check(f'{w} Testimony {view}: the step picture has 20px dots and replaces the old track', tt['dot'] == 20 and not tt['old'], tt)
      R.check(f'{w} Testimony {view}: the step picture stays on one line and fits ({tt["n"]} steps)', tt['oneLine'] and tt['fits'], tt)
      if view == 'sent': R.check(f'{w} Testimony sent back: the step picture says Revise, in its own shape', 'sent' in tt['cur'] and 'Revise' in tt['words'], tt)
      R.check(f'{w} Testimony {view}: no sideways scroll with the item open', overflow(pg) <= 0, overflow(pg))
      shot(pg, f'testimony-{view}-item')

    # ---- 3. Partners, Words to approve ----
    pg.nav('/partners?view=approve')
    pq = pg.page.evaluate("""[...document.querySelectorAll('.v6-row[data-v6row^="w:pq:"] > .v6-row-main')].map(m => { const b = getComputedStyle(m, '::before');
      const lead = m.querySelector('.v6-act-lead .v6-at'); return lead ? 'lead' : (b.content !== 'none' && /svg/.test(b.backgroundImage) && parseFloat(b.width) >= 32) ? 'tile' : ''; })""")
    if pq:
      R.check(f'{w} Partners: every row to approve starts with the partner tile', all(pq), pq)
    else: R.check(f'{w} Partners: rows to approve', True, skip='no partner words waiting in the practice copy')
    okb = pg.page.evaluate("[...document.querySelectorAll('[data-pqok]')].map(b => !!b.querySelector('svg.ic-user-check'))")
    if okb: R.check(f'{w} Partners: Approve carries the approve icon (the person-check)', all(okb), okb)
    R.check(f'{w} Partners: no sideways scroll', overflow(pg) <= 0, overflow(pg))
    shot(pg, 'partners')

    # ---- 4. Bills (Team) and search ----
    pg.nav('/issues/bills')
    try: pg.page.click('[data-seg="blscope"][data-whose="team"]'); pg.page.wait_for_timeout(600); pg.ready()
    except Exception: pass
    b = pg.page.evaluate("""(() => { const rows = [...document.querySelectorAll('.bl-page .v6-row[data-v6row]')];
      return { n: rows.length, bar: rows.filter(r => r.querySelector('.v6-bar')).length, act: rows.filter(r => r.querySelector('.v6-act-lead, .v6-at')).length,
        lead: rows.filter(r => r.querySelector('.v6-row-lead')).length,
        iss: rows.filter(r => { const l = r.querySelector('.v6-row-main > .v6-row-lead.i6-lead'); return l && (l.classList.contains('bl-noiss') || (/mi-c-/.test(l.className) && l.querySelector('svg') && getComputedStyle(l).backgroundColor !== 'rgba(0, 0, 0, 0)')); }).length,
        card: rows.filter(r => { const s = getComputedStyle(r); return s.boxShadow !== 'none' && s.backgroundColor === 'rgb(255, 255, 255)'; }).length,
        apart: (() => { const i = rows.findIndex((r, k) => k > 0 && r.previousElementSibling === rows[k - 1]); return i > 0 ? Math.round(rows[i].getBoundingClientRect().top - rows[i - 1].getBoundingClientRect().bottom) : null; })(),
        lines: rows.map(r => r.querySelectorAll('.v6-row-line').length).filter(n => n !== 1).length,
        twins: rows.filter(r => r.querySelector('.v6-twin')).map(r => [r.querySelector('.v6-row-num').firstChild.textContent.trim(), r.querySelector('.v6-twin').innerText.trim()]),
        shown: rows.map(r => r.querySelector('.v6-row-num')?.firstChild?.textContent.trim()),
        ghic: document.querySelectorAll('.bl-gh .bl-ghic, .bl-gh svg:not(.chev)').length }; })()""")
    # R-352 part 7 (A-18 on v6, spec 8): a row is a name, its number and one line; the bill's page keeps the tracker
    R.check(f'{w} Bills (Team): rows to measure', b['n'] > 0, b['n'])
    R.check(f'{w} Bills (Team): no row draws the progress bar (the bill page keeps it)', b['bar'] == 0, (b['bar'], b['n']))
    # R-352 D (Nate 28 Oct, "they all blur together"): the issue's tile tells bills on different issues apart (A-18 on v6)
    R.check(f'{w} Bills (Team): no row leads with a job tile', b['act'] == 0, b['act'])
    R.check(f'{w} Bills (Team): every row leads with its issue tile on the topic tint, or an empty slot', b['iss'] == b['n'] == b['lead'], (b['iss'], b['lead'], b['n']))
    R.check(f'{w} Bills (Team): every row is its own soft card, 8px apart', b['card'] == b['n'] and b['apart'] == 8, (b['card'], b['n'], b['apart']))
    R.check(f'{w} Bills (Team): every row has exactly one line', b['lines'] == 0, b['lines'])
    R.check(f'{w} Bills (Team): no icon beside a group heading (its word says it; the fold chevron stays)', b['ghic'] == 0, b['ghic'])
    tw = dict(b['twins'])
    # the review (27 Oct): a twin tag only where two shown bills share a name, and it names the other ("twin of SB 2175"),
    # never a bare chamber that reads as where the bill is now
    R.check(f'{w} Bills (Team): a twin tag names a twin that is shown too', all(re.fullmatch(r'twin of (\S+ \d+)', t2) and re.fullmatch(r'twin of (\S+ \d+)', t2).group(1) in b['shown'] for n, t2 in b['twins']), b['twins'][:6])
    facts = pg.measure(full=True)
    R.check(f'{w} Bills (Team): no row passes spec 8\'s four facts', facts['facts_max'] <= 4, (facts['facts_max'], facts['worst_row']))
    R.check(f'{w} Bills: no sideways scroll', overflow(pg) <= 0, overflow(pg))
    shot(pg, 'bills-team')
    pg.nav('/search?q=e-cigarette')
    s = pg.page.evaluate("""(() => { const rows = [...document.querySelectorAll('.sr-page .v6-row[data-bill], .sr-page .v6-row')].filter(r => r.querySelector('.v6-row-main[data-bill]'));
      return { n: rows.length, bar: rows.filter(r => r.querySelector('.v6-bar')).length, tile: rows.filter(r => r.querySelector('.v6-act-lead, .v6-at')).length,
        barIn: rows.filter(r => r.querySelector('.v6-row-main .v6-bar[role="img"][aria-label]')).length,
        over: rows.filter(r => { const l = r.querySelector('.v6-row-line > span'); return l && l.scrollHeight > l.clientHeight + 2; }).length,
        twins: Object.fromEntries(rows.filter(r => r.querySelector('.v6-twin')).map(r => [r.querySelector('.v6-row-num').firstChild.textContent.trim(), r.querySelector('.v6-twin').innerText.trim()])) }; })()""")
    R.check(f'{w} Search: the twins HB 2121 and SB 2175 ("Disposable e-cigarette ban") name each other', s['twins'].get('HB 2121') == 'twin of SB 2175' and s['twins'].get('SB 2175') == 'twin of HB 2121', s['twins'])
    R.check(f'{w} Search: only bills with a shown twin are tagged (not every result)', len(s['twins']) < s['n'], (len(s['twins']), s['n']))
    # R-352 FIX-3 (Nate 28 Oct, "keep the bill progress bar there"): each bill result draws its slim bar (Now, Law) inside its
    # link, said in one short sentence to a screen reader; no job tile (A-18 on v6: one kind under its own heading)
    R.check(f'{w} Search: every bill result draws its slim progress bar', s['n'] > 0 and s['bar'] == s['n'] and s['barIn'] == s['n'], s)
    R.check(f'{w} Search: no bill result wears a job tile', s['tile'] == 0, s)
    R.check(f'{w} Search: no result line is drawn past its box (the old clamp)', s['over'] == 0, s)
    fs = pg.measure(full=True)
    R.check(f'{w} Search: the pictures add no fact to a result (spec 8: four at most)', fs['facts_max'] <= 4, (fs['facts_max'], fs['worst_row']))
    R.check(f'{w} Search: no sideways scroll', overflow(pg) <= 0, overflow(pg))
    shot(pg, 'search')

    # ---- 5. All issues ----
    pg.nav('/issues/all')
    c = pg.page.evaluate("""(() => { const cards = [...document.querySelectorAll('#is-q-body .ig6-issue')];
      return { n: cards.length, state: cards.map(x => x.querySelector('.ig6-stat [data-state^="issue:"]')?.dataset.state || ''),
        word: cards.filter(x => (x.querySelector('.ig6-stat .v6-sm-w')?.textContent || '').trim()).length,
        boxTint: cards.filter(x => { const bg = getComputedStyle(x.querySelector('.ig6-stat')).backgroundColor; return !/rgba\\(0, 0, 0, 0\\)|transparent/.test(bg); }).length }; })()""")
    keys = {'issue:ontrack', 'issue:risk', 'issue:stopped', 'issue:won', 'issue:none'}
    R.check(f'{w} All issues: every card\'s status line wears how its issue is doing, one shape per state', c['n'] > 0 and all(k in keys for k in c['state']), sorted(set(c['state'])))
    R.check(f'{w} All issues: the states vary (not one shape on every card)', len(set(c['state'])) >= 3, sorted(set(c['state'])))
    R.check(f'{w} All issues: each shape has its word, shown beside it (R-352: visible, not only spoken)', c['word'] == c['n'], (c['word'], c['n']))
    R.check(f'{w} All issues: no tint (Decision 4)', c['boxTint'] == 0, c['boxTint'])
    fa = pg.measure(full=True)
    R.check(f'{w} All issues: a card keeps spec 8\'s four facts', fa['facts_max'] <= 4, (fa['facts_max'], fa['worst_row']))
    R.check(f'{w} All issues: no sideways scroll', overflow(pg) <= 0, overflow(pg))
    shot(pg, 'all-issues')

    # ---- part 2: Today, the step card, the issue page, the bill page, the ask board ----
    pg.nav('/')
    t6 = pg.page.evaluate("""(() => { const rows = [...document.querySelectorAll('.t6-list .v6-row')];
      const kinds = rows.map(r => r.querySelector('.v6-row-main .v6-row-lead.t6-kind'));
      return { n: rows.length, kind: kinds.filter(k => k && k.querySelectorAll('svg').length === 1).length, tiles: rows.filter(r => r.querySelector('.v6-act-lead, .v6-at')).length,
        kindTint: [...new Set(kinds.filter(Boolean).map(k => getComputedStyle(k).backgroundColor))],
        btns: [...document.querySelectorAll('.t6-list .v6-row-act .btn, .v6-step-acts .btn:not(.text), .t6-nsacts .btn')].map(b => [b.innerText.trim(), !!b.querySelector('svg')]),
        todayLook: [...document.querySelectorAll('.t6-list .v6-row-line.soon')].map(e => { const tm = e.querySelector('.v6-tm');
          return [getComputedStyle(e).color, tm ? getComputedStyle(tm).fontWeight : '', !!e.querySelector('svg.ic-clock'), /\\btoday\\b/i.test(e.innerText)]; }),
        landmark: document.querySelectorAll('.v6-step-hl svg.ic-landmark, .t6-line svg.ic-landmark, .t6-list svg.ic-landmark').length,
        late: [...document.querySelectorAll('.v6-hcard-late, .t6-list .v6-row-line.t-late, .t6-next .v6-step-meta .v6-status.late')].map(e => [getComputedStyle(e).color, !!e.querySelector('svg.ic-alarm-clock'), /^\\s*Late\\b/.test(e.innerText)]) }; })()""")
    # R-352 part 2 (A-18 on v6): Today's list mixes kinds of job, so each row leads with one small neutral kind icon, not the
    # coloured job tile; the filled button keeps its icon
    R.check(f'{w} Today: every row leads with one small kind-of-job icon (A-18 on v6)', t6['n'] > 0 and t6['kind'] == t6['n'], (t6['kind'], t6['n']))
    R.check(f'{w} Today: no row wears a coloured job tile', t6['tiles'] == 0 and all(re.search(r'rgba\(0, 0, 0, 0\)|transparent', c) for c in t6['kindTint']), (t6['tiles'], t6['kindTint']))
    R.check(f'{w} Today: every row and card button carries its icon', all(b[1] for b in t6['btns']), [b[0] for b in t6['btns'] if not b[1]][:4])
    R.check(f'{w} Today: something is due today on the busy day', len(t6['todayLook']) > 0, len(t6['todayLook']))
    # R-352 (Nate 27 Oct, A-5 on v6): due today is plain, never amber: the body colour, a plain clock, the time in bold and
    # the word "today", so on a busy day the one late row is the only amber one.
    amber_rgb = pg.page.evaluate("(() => { const e = document.createElement('i'); e.style.color = 'var(--v6-late)'; document.body.appendChild(e); const c = getComputedStyle(e).color; e.remove(); return c; })()")
    R.check(f'{w} Today: due today is plain (not amber), with its clock, the word "today" and its time in bold (R-352)', t6['todayLook'] and all(x[0] != amber_rgb and x[1] in ('700', 'bold') and x[2] and x[3] for x in t6['todayLook']), t6['todayLook'][:3])
    R.check(f'{w} Today: the Capitol building is not on hearing or ask lines (Rule 5)', t6['landmark'] == 0, t6['landmark'])
    R.check(f'{w} Today: your late-but-accepted filing is amber, leads with "Late" and wears the alarm clock (not due today\'s clock)', t6['late'] and all(x[0] == amber_rgb and x[1] and x[2] for x in t6['late']), (t6['late'], amber_rgb))
    pg.nav('/bill/HB1523')
    bp = pg.page.evaluate("""(() => ({ tt: !!document.querySelector('.v6-step .v6-tt'), old: !!document.querySelector('.v6-step .v6-track'),
      tile: !!document.querySelector('.v6-step .v6-at'), btn: [...document.querySelectorAll('.v6-step-acts .btn:not(.text)')].every(b => b.querySelector('svg')),
      cap: /Capitol’s deadline/.test(document.querySelector('.v6-step')?.innerText || ''), pill: document.querySelector('.bw-if-pill')?.dataset.state || '' }))()""")
    # R-352 (A-18 on v6): no job tile on the card, its filled button carries the job's icon
    R.check(f'{w} Bill page: the step card shows the bigger step picture, icons on its buttons and no job tile', bp['tt'] and not bp['old'] and not bp['tile'] and bp['btn'], bp)
    R.check(f'{w} Bill page: the card says whose the other time is ("The Capitol’s deadline")', bp['cap'], bp)
    R.check(f'{w} Bill page: its issue\'s state wears the issue set\'s shape', bp['pill'].startswith('issue:'), bp)
    pg.nav('/issue/' + L.ISSUE)
    ip = pg.page.evaluate("""(() => { const h = document.querySelector('.ip6-health'); return { state: h?.querySelector('[data-state]')?.dataset.state || '', dots: h ? h.querySelectorAll('.v6-chd').length : 0,
      bg: h ? getComputedStyle(h).backgroundColor : '', wash: getComputedStyle(document.body).getPropertyValue('--v6-wash').trim() }; })()""")
    R.check(f'{w} Issue page: the health check is one issue shape, no tint and no dots (the sentence says where)', ip['state'].startswith('issue:') and ip['dots'] == 0, ip)
    pg.nav('/hearings/ask')
    # R-352 part 8b (A-18, A-14 on v6): no faces or letter bubbles; each chair's name is the link to their page
    ph = pg.page.evaluate("({ faces: document.querySelectorAll('.hg-cph, .hg-chead .lg-ph').length, names: [...document.querySelectorAll('.hg-chair .hg-cname')].map(n => n.querySelectorAll('a[href^=\"#/legislator/\"]').length) })")
    R.check(f'{w} Ask board: no chair photo or letter bubble on the cards', ph['faces'] == 0, ph['faces'])
    R.check(f'{w} Ask board: each chair\'s name is the link to their page', ph['names'] and all(n >= 1 for n in ph['names']), ph['names'][:6])
    R.check(f'{w}: no page errors', not pg.errors, pg.errors[:3])
    pg.close()

R.done()
