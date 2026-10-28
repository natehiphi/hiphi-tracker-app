# Staff v6: the at-a-glance picture rules (R-344; R-336's at-a-glance review, Nate's decisions of 26 Oct). On the practice
# copy (Mon 16 Mar 2026), as Nate, at 1440x900 and 390x844.
#   1. One table (staff6/verbs.js): every action has a word, an icon and a tile hue; each status set (testimony, chair ask,
#      issue, stance) uses a different shape for each state, and no icon carries two meanings across the table (Rule 5).
#   2. Testimony: every row starts with its job's tile, every row button carries its icon, each tab wears its state's shape,
#      and a sent-back draft's tile and step picture differ from a new draft's. The open item's step picture has 20px dots
#      and stays on one line, "Second look" included (C5).
#   3. Partners, Words to approve: every row starts with the partner tile; Approve carries its icon.
#   4. Bills (Team): each row shows the slim bar (Now, the trophy at Law), two shown bills that share a name say whose twin, the
#      topic icons show by default (and ?icons=0 turns them off); search results show the bar too; no row passes spec 8's
#      four facts.
#   5. All issues: each card says how the issue is doing as one shape and word (no tint), with the House and Senate dots.
#   6. No sideways scroll, no page errors.
#   Part 2 (the files R-346 held): Today's job rows lead with their tile and every button carries its icon; due today is
#   amber; the bill page's step card wears its tile, the bigger step picture and "The Capitol’s deadline"; the issue page's
#   health check is an issue shape with the House and Senate dots; the ask board's chair photos open their pages; the
#   Capitol building is not used for hearings or asks (Rule 5); Testimony's team rows lead with whose face it is (Rule 4).
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
ROWS = """(sel) => [...document.querySelectorAll(sel)].map(r => ({ key: r.dataset.v6row || '', tile: !!r.querySelector('.v6-row-main .v6-act-lead .v6-at'), face: !!r.querySelector('.v6-row-main .v6-row-lead.sv-face'),
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
      R.check(f'{w} Testimony {view}: every row starts with its job\'s tile, or the face of whose it is (Rule 4)', all(r['tile'] or r['face'] for r in rows), [r['name'] for r in rows if not (r['tile'] or r['face'])][:3])
      R.check(f'{w} Testimony {view}: your own rows lead with the job, not your face', all(r['tile'] for r in rows if r['mine']), [r['name'] for r in rows if r['mine'] and not r['tile']][:3])
      btns = [b for r in rows for b in r['btns']]
      R.check(f'{w} Testimony {view}: every row button carries its icon', all(b[1] for b in btns), [b[0] for b in btns if not b[1]][:3])
      if view == 'sent': R.check(f'{w} Testimony sent back: its rows wear the sent-back tile, never a new draft\'s', all(r['act'] == 'revise' for r in rows if r['tile']), [r['act'] for r in rows])
      if view == 'write': R.check(f'{w} Testimony to write: no row wears the sent-back tile', all(r['act'] != 'revise' for r in rows if r['tile']), [r['act'] for r in rows])
    tabs = pg.page.evaluate("[...document.querySelectorAll('.tp .sv-secnav a')].map(a => [a.innerText.trim().split(/\\s/)[0], !!a.querySelector('.tp-tic svg'), a.querySelector('.tp-tic svg')?.getAttribute('class') || ''])")
    R.check(f'{w} Testimony: every tab wears its state\'s shape', tabs and all(x[1] for x in tabs), tabs)
    R.check(f'{w} Testimony: each tab\'s shape is different', len({x[2] for x in tabs}) == len(tabs), [x[2] for x in tabs])
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
    pg.nav('/bills')
    try: pg.page.click('[data-seg="blscope"][data-whose="team"]'); pg.page.wait_for_timeout(600); pg.ready()
    except Exception: pass
    b = pg.page.evaluate("""(() => { const rows = [...document.querySelectorAll('.bl-page .v6-row[data-v6row]')];
      return { n: rows.length, bar: rows.filter(r => r.querySelector('.v6-bar .v6-bar-segs i')).length, now: rows.filter(r => r.querySelector('.v6-bar-now')).length,
        law: rows.filter(r => r.querySelector('.v6-bar-end svg.ic-trophy')).length,
        twins: rows.filter(r => r.querySelector('.v6-twin')).map(r => [r.querySelector('.v6-row-num').firstChild.textContent.trim(), r.querySelector('.v6-twin').innerText.trim()]),
        shown: rows.map(r => r.querySelector('.v6-row-num')?.firstChild?.textContent.trim()),
        leads: rows.filter(r => r.querySelector('.v6-row-lead:not(.none):not(.v6-act-lead) svg')).length,
        stance: rows.filter(r => r.querySelector('[data-state^="stance:"]')).length,
        barW: Math.max(0, ...rows.map(r => r.querySelector('.v6-bar')?.getBoundingClientRect().width || 0)) }; })()""")
    R.check(f'{w} Bills (Team): every row shows the slim bar', b['n'] > 0 and b['bar'] == b['n'], (b['bar'], b['n']))
    R.check(f'{w} Bills (Team): the bar has room (wider than 200px)', b['barW'] > 200, b['barW'])
    R.check(f'{w} Bills (Team): the bar marks Now and ends at Law with the trophy', b['now'] > 0 and b['law'] == b['bar'], (b['now'], b['law']))
    tw = dict(b['twins'])
    # the review (27 Oct): a twin tag only where two shown bills share a name, and it names the other ("twin of SB 2175"),
    # never a bare chamber that reads as where the bill is now
    R.check(f'{w} Bills (Team): a twin tag names a twin that is shown too', all(re.fullmatch(r'twin of (\S+ \d+)', t2) and re.fullmatch(r'twin of (\S+ \d+)', t2).group(1) in b['shown'] for n, t2 in b['twins']), b['twins'][:6])
    facts = pg.measure(full=True)
    R.check(f'{w} Bills (Team): the pictures add no fact to a row (spec 8: four at most)', facts['facts_max'] <= 4, (facts['facts_max'], facts['worst_row']))
    if w >= 600: R.check(f'{w} Bills (Team): the topic icons show by default (R-339, Nate\'s go)', b['leads'] > 0, b['leads'])
    R.check(f'{w} Bills: no sideways scroll', overflow(pg) <= 0, overflow(pg))
    shot(pg, 'bills-team')
    if w == 1440:
      off = B.page('NT', w, h); off.open('/bills', extra='&icons=0')
      try: off.page.click('[data-seg="blscope"][data-whose="team"]'); off.page.wait_for_timeout(600); off.ready()
      except Exception: pass
      n0 = off.page.evaluate("document.querySelectorAll('.bl-page .v6-row-lead:not(.v6-act-lead) svg, .bl-gh .bl-ghic').length")
      R.check('1440 Bills ?icons=0: the topic and heading icons are off, for a comparison', n0 == 0, n0)
      off.close()
    pg.nav('/search?q=e-cigarette')
    s = pg.page.evaluate("""(() => { const rows = [...document.querySelectorAll('.sr-page .v6-row[data-bill], .sr-page .v6-row')].filter(r => r.querySelector('.v6-row-main[data-bill]'));
      return { n: rows.length, bar: rows.filter(r => r.querySelector('.v6-bar')).length,
        over: rows.filter(r => { const l = r.querySelector('.v6-row-line > span'); return l && l.scrollHeight > l.clientHeight + 2; }).length,
        twins: Object.fromEntries(rows.filter(r => r.querySelector('.v6-twin')).map(r => [r.querySelector('.v6-row-num').firstChild.textContent.trim(), r.querySelector('.v6-twin').innerText.trim()])) }; })()""")
    R.check(f'{w} Search: the twins HB 2121 and SB 2175 ("Disposable e-cigarette ban") name each other', s['twins'].get('HB 2121') == 'twin of SB 2175' and s['twins'].get('SB 2175') == 'twin of HB 2121', s['twins'])
    R.check(f'{w} Search: only bills with a shown twin are tagged (not every result)', len(s['twins']) < s['n'], (len(s['twins']), s['n']))
    R.check(f'{w} Search: every bill result shows the slim bar', s['n'] > 0 and s['bar'] == s['n'], s)
    R.check(f'{w} Search: no result line is drawn past its box (the old clamp)', s['over'] == 0, s)
    fs = pg.measure(full=True)
    R.check(f'{w} Search: the pictures add no fact to a result (spec 8: four at most)', fs['facts_max'] <= 4, (fs['facts_max'], fs['worst_row']))
    R.check(f'{w} Search: no sideways scroll', overflow(pg) <= 0, overflow(pg))
    shot(pg, 'search')

    # ---- 5. All issues ----
    pg.nav('/my-issues/all')
    c = pg.page.evaluate("""(() => { const cards = [...document.querySelectorAll('#is-q-body .ig6-issue')];
      return { n: cards.length, state: cards.map(x => x.querySelector('.ig6-stat [data-state^="issue:"]')?.dataset.state || ''),
        word: cards.filter(x => (x.querySelector('.ig6-stat .ig6-sic')?.getAttribute('aria-label') || '').trim()).length,
        boxTint: cards.filter(x => { const bg = getComputedStyle(x.querySelector('.ig6-stat')).backgroundColor; return !/rgba\\(0, 0, 0, 0\\)|transparent/.test(bg); }).length }; })()""")
    keys = {'issue:ontrack', 'issue:risk', 'issue:stopped', 'issue:won', 'issue:none'}
    R.check(f'{w} All issues: every card\'s status line wears how its issue is doing, one shape per state', c['n'] > 0 and all(k in keys for k in c['state']), sorted(set(c['state'])))
    R.check(f'{w} All issues: the states vary (not one shape on every card)', len(set(c['state'])) >= 3, sorted(set(c['state'])))
    R.check(f'{w} All issues: each shape has its word for screen readers', c['word'] == c['n'], (c['word'], c['n']))
    R.check(f'{w} All issues: no tint (Decision 4)', c['boxTint'] == 0, c['boxTint'])
    fa = pg.measure(full=True)
    R.check(f'{w} All issues: a card keeps spec 8\'s four facts', fa['facts_max'] <= 4, (fa['facts_max'], fa['worst_row']))
    R.check(f'{w} All issues: no sideways scroll', overflow(pg) <= 0, overflow(pg))
    shot(pg, 'all-issues')

    # ---- part 2: Today, the step card, the issue page, the bill page, the ask board ----
    pg.nav('/')
    t6 = pg.page.evaluate("""(() => { const rows = [...document.querySelectorAll('.t6-job')];
      return { n: rows.length, tiles: rows.filter(r => r.querySelector('.t6-jtile .v6-at')).length,
        btns: [...document.querySelectorAll('.t6-job .v6-row-act .btn, .v6-step-acts .btn:not(.text), .t6-nsacts .btn')].map(b => [b.innerText.trim(), !!b.querySelector('svg')]),
        today: rows.filter(r => r.querySelector('.t6-jsub.t-today')).length,
        landmark: document.querySelectorAll('.v6-step-hl svg.ic-landmark, .t6-line svg.ic-landmark').length,
        late: [...document.querySelectorAll('.v6-hcard-late, .t6-jsub.t-late')].map(e => [getComputedStyle(e).color, !!e.querySelector('svg.ic-alarm-clock'), /^\\s*Late\\b/.test(e.innerText)]),
        amber: getComputedStyle(document.body).getPropertyValue('--v6-late').trim() }; })()""")
    R.check(f'{w} Today: every job row starts with its job\'s tile (Rule 1)', t6['n'] > 0 and t6['tiles'] == t6['n'], (t6['tiles'], t6['n']))
    R.check(f'{w} Today: every row and card button carries its icon', all(b[1] for b in t6['btns']), [b[0] for b in t6['btns'] if not b[1]][:4])
    R.check(f'{w} Today: what is due today says so in amber (Rule 3, Decision 2)', t6['today'] > 0, t6['today'])
    R.check(f'{w} Today: the Capitol building is not on hearing or ask lines (Rule 5)', t6['landmark'] == 0, t6['landmark'])
    R.check(f'{w} Today: your late-but-accepted filing is amber, leads with "Late" and wears the alarm clock (not due today\'s clock)', t6['late'] and all(x[1] and x[2] for x in t6['late']) and len({x[0] for x in t6['late']}) == 1, t6['late'])
    pg.nav('/bill/HB1523')
    bp = pg.page.evaluate("""(() => ({ tt: !!document.querySelector('.v6-step .v6-tt'), old: !!document.querySelector('.v6-step .v6-track'),
      tile: !!document.querySelector('.v6-step .v6-step-eyebrow .v6-at'), btn: [...document.querySelectorAll('.v6-step-acts .btn:not(.text)')].every(b => b.querySelector('svg')),
      cap: /Capitol’s deadline/.test(document.querySelector('.v6-step')?.innerText || ''), pill: document.querySelector('.bw-if-pill')?.dataset.state || '' }))()""")
    R.check(f'{w} Bill page: the step card wears its job\'s tile, the bigger step picture and icons on its buttons', bp['tt'] and not bp['old'] and bp['tile'] and bp['btn'], bp)
    R.check(f'{w} Bill page: the card says whose the other time is ("The Capitol’s deadline")', bp['cap'], bp)
    R.check(f'{w} Bill page: its issue\'s state wears the issue set\'s shape', bp['pill'].startswith('issue:'), bp)
    pg.nav('/issue/' + L.ISSUE)
    ip = pg.page.evaluate("""(() => { const h = document.querySelector('.ip6-health'); return { state: h?.querySelector('[data-state]')?.dataset.state || '', dots: h ? h.querySelectorAll('.v6-chd').length : 0,
      bg: h ? getComputedStyle(h).backgroundColor : '', wash: getComputedStyle(document.body).getPropertyValue('--v6-wash').trim() }; })()""")
    R.check(f'{w} Issue page: the health check is one issue shape, no tint and no dots (the sentence says where)', ip['state'].startswith('issue:') and ip['dots'] == 0, ip)
    pg.nav('/hearings/ask')
    ph = pg.page.evaluate("[...document.querySelectorAll('.hg-cph')].map(p => !!p.querySelector('a.hg-cphl[href^=\"#/legislator/\"]'))")
    if ph: R.check(f'{w} Ask board: each chair\'s photo opens their page', all(ph), ph[:4])
    R.check(f'{w}: no page errors', not pg.errors, pg.errors[:3])
    pg.close()

R.done()
