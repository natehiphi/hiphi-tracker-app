# Staff v6: the at-a-glance picture rules (R-344; R-336's at-a-glance review, Nate's decisions of 26 Oct). On the practice
# copy (Mon 16 Mar 2026), as Nate, at 1440x900 and 390x844.
#   1. One table (staff6/verbs.js): every action has a word, an icon and a tile hue; each status set (testimony, chair ask,
#      issue, stance) uses a different shape for each state, and no icon carries two meanings across the table (Rule 5).
#   2. Testimony: every row starts with its job's tile, every row button carries its icon, each tab wears its state's shape,
#      and a sent-back draft's tile and step picture differ from a new draft's. The open item's step picture has 20px dots
#      and stays on one line, "Second look" included (C5).
#   3. Partners, Words to approve: every row starts with the partner tile; Approve carries its icon.
#   4. Bills (Team): each row shows the slim bar (Now, the trophy at Law), twins that share a name say House or Senate, the
#      topic icons show by default (and ?icons=0 turns them off); search results show the bar too.
#   5. All issues: each card says how the issue is doing as one shape and word (no tint), with the House and Senate dots.
#   6. No sideways scroll, no page errors.
#
#   V4_ROOT=/path/to/worktree python3 tests/staff6_glance_shapes.py      exits 1 when a check fails
#   --shots DIR                                                         saves each screen, laptop and phone
import os, sys
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
ROWS = """(sel) => [...document.querySelectorAll(sel)].map(r => ({ key: r.dataset.v6row || '', tile: !!r.querySelector('.v6-row-main .v6-act-lead .v6-at'),
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
      R.check(f'{w} Testimony {view}: every row starts with its job\'s tile', all(r['tile'] for r in rows), [r['name'] for r in rows if not r['tile']][:3])
      btns = [b for r in rows for b in r['btns']]
      R.check(f'{w} Testimony {view}: every row button carries its icon', all(b[1] for b in btns), [b[0] for b in btns if not b[1]][:3])
      if view == 'sent': R.check(f'{w} Testimony sent back: its rows wear the sent-back tile, never a new draft\'s', all(r['act'] == 'revise' for r in rows), [r['act'] for r in rows])
      if view == 'write': R.check(f'{w} Testimony to write: no row wears the sent-back tile', all(r['act'] != 'revise' for r in rows), [r['act'] for r in rows])
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
        twins: rows.filter(r => r.querySelector('.v6-twin')).map(r => [r.querySelector('.v6-row-num').innerText.trim(), r.querySelector('.v6-twin').innerText.trim()]),
        leads: rows.filter(r => r.querySelector('.v6-row-lead:not(.none):not(.v6-act-lead) svg')).length,
        stance: rows.filter(r => r.querySelector('[data-state^="stance:"]')).length,
        barW: Math.max(0, ...rows.map(r => r.querySelector('.v6-bar')?.getBoundingClientRect().width || 0)) }; })()""")
    R.check(f'{w} Bills (Team): every row shows the slim bar', b['n'] > 0 and b['bar'] == b['n'], (b['bar'], b['n']))
    R.check(f'{w} Bills (Team): the bar has room (wider than 200px)', b['barW'] > 200, b['barW'])
    R.check(f'{w} Bills (Team): the bar marks Now and ends at Law with the trophy', b['now'] > 0 and b['law'] == b['bar'], (b['now'], b['law']))
    tw = dict(b['twins'])
    R.check(f'{w} Bills (Team): twins that share a name say House or Senate', len(tw) > 0 and all(tw.get(n, v) == v for n, v in [('HB 2121', 'House'), ('SB 2175', 'Senate')]), b['twins'][:6])
    R.check(f'{w} Bills (Team): a twin tag says the chamber its number starts in', all((n.startswith('H') and t2 == 'House') or (n.startswith('S') and t2 == 'Senate') for n, t2 in b['twins']), b['twins'][:6])
    R.check(f'{w} Bills (Team): HIPHI\'s stance shows as its shape and word', b['stance'] > 0, b['stance'])
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
        twins: Object.fromEntries(rows.filter(r => r.querySelector('.v6-twin')).map(r => [r.querySelector('.v6-row-num').innerText.trim(), r.querySelector('.v6-twin').innerText.trim()])) }; })()""")
    R.check(f'{w} Search: the twins HB 2121 and SB 2175 ("Disposable e-cigarette ban") say House and Senate', s['twins'].get('HB 2121') == 'House' and s['twins'].get('SB 2175') == 'Senate', s['twins'])
    R.check(f'{w} Search: every bill result shows the slim bar', s['n'] > 0 and s['bar'] == s['n'], s)
    R.check(f'{w} Search: no result line is drawn past its box (the old clamp)', s['over'] == 0, s)
    R.check(f'{w} Search: no sideways scroll', overflow(pg) <= 0, overflow(pg))
    shot(pg, 'search')

    # ---- 5. All issues ----
    pg.nav('/my-issues/all')
    c = pg.page.evaluate("""(() => { const cards = [...document.querySelectorAll('#is-q-body .ig6-issue')];
      return { n: cards.length, state: cards.map(x => x.querySelector('[data-state^="issue:"]')?.dataset.state || ''),
        dots: cards.filter(x => x.querySelectorAll('.v6-chd').length === 2).length,
        tint: cards.filter(x => { const m = x.querySelector('.ig6-sline .v6-sm-ic'); return m && getComputedStyle(m).backgroundColor !== getComputedStyle(document.body).getPropertyValue('--v6-wash').trim() && /leaf|late|bad/.test(m.parentElement.className) && !/t-done/.test(m.parentElement.className); }).length,
        boxTint: cards.filter(x => { const bg = getComputedStyle(x.querySelector('.ig6-sline')).backgroundColor; return !/rgba\\(0, 0, 0, 0\\)|transparent/.test(bg); }).length }; })()""")
    keys = {'issue:ontrack', 'issue:risk', 'issue:stopped', 'issue:won', 'issue:none'}
    R.check(f'{w} All issues: every card says how its issue is doing as one shape and word', c['n'] > 0 and all(k in keys for k in c['state']), sorted(set(c['state'])))
    R.check(f'{w} All issues: the states vary (not one shape on every card)', len(set(c['state'])) >= 3, sorted(set(c['state'])))
    R.check(f'{w} All issues: the state line has no tint (Decision 4)', c['boxTint'] == 0 and c['tint'] == 0, (c['boxTint'], c['tint']))
    R.check(f'{w} All issues: every card with bills carries the House and Senate dots', c['dots'] >= len([k for k in c['state'] if k != 'issue:none']), (c['dots'], c['n']))
    R.check(f'{w} All issues: no sideways scroll', overflow(pg) <= 0, overflow(pg))
    shot(pg, 'all-issues')

    R.check(f'{w}: no page errors', not pg.errors, pg.errors[:3])
    pg.close()

R.done()
