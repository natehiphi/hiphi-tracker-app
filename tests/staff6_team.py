# Staff v6 Team (#/team), Nate's walk 4 (R-336): "It's still too crowded. This needs to be more calm and roomy. I'm not
# sure where I'm supposed to look." His pick, "One list, top 3": one reading column; Slipping and Hearings at risk as one
# ranked list with its three most urgent rows shown, each with its one action, and "See all N" opening the N; the schedule,
# Who is on what and the bills with no owner as quiet lines that open in place, each count the number of rows it opens
# (A-14); red only on a step whose deadline passed (A-5 on v6); the same order on a phone, no sideways scroll.
#
#   V4_ROOT=/path/to/worktree python3 tests/staff6_team.py      (otherwise HOST, :8832)
import os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import staff6_lib as L

R = L.Results()
check = R.check
BAD = 'rgb(175, 51, 40)'   # --v6-bad, #AF3328

def num(rx, s, default=None):
  m = re.search(rx, s or ''); return int(m.group(1)) if m else default

ROWS = "(sel) => [...document.querySelectorAll(sel)].filter(e => e.getClientRects().length).length"

def main():
  with L.browser() as b:
    # ---- laptop, 1440 ----
    pg = b.page('NT', 1440, 900); pg.open('/team')
    p = pg.page
    col = p.evaluate("""() => { const r = document.querySelector('.tm6-root'); if (!r) return null;
      const kids = [...r.querySelectorAll(':scope > [data-block], :scope > .tm6-lines')].map(e => e.getBoundingClientRect());
      return { w: Math.round(r.getBoundingClientRect().width), lefts: [...new Set(kids.map(k => Math.round(k.left)))], n: kids.length }; }""")
    check('1440: one reading column, 760px at most', col and col['w'] <= 760 and len(col['lefts']) == 1 and col['n'] >= 2, col)
    head = p.inner_text('[data-block="slip"] h2')
    n = num(r'(\d+)', head, 0)
    top = p.evaluate("""() => [...document.querySelectorAll('[data-block="slip"] .v6-list > *')].filter(e => e.getClientRects().length)
      .map(e => ({ t: e.innerText.split('\\n').slice(0, 3).join(' | '), btn: !!e.querySelector('button, .btn'), y: Math.round(e.getBoundingClientRect().bottom) }))""")
    check('1440: Slipping shows its 3 most urgent rows', len(top) == min(3, n), f'{len(top)} of {n}')
    check('1440: each of the 3 has its one action', top and all(r['btn'] for r in top), [r['t'][:50] for r in top if not r['btn']])
    check('1440: the 3 are on the first screen', top and max(r['y'] for r in top) <= 900, [r['y'] for r in top])
    check('1440: overdue first, then late, then the rest', top and 'Overdue' in top[0]['t'] and (len(top) < 2 or re.search(r'(?i)late, still accepted', top[1]['t'])), [r['t'][:60] for r in top])
    m = pg.measure()
    check('1440: at most 12 controls on the first screen (A-2 on v6)', m['controls'] <= 12, m['controls'])
    check('1440: fewer words on the first screen than before (246)', m['words'] < 200, m['words'])
    # the quiet lines: closed, each a count
    lines = p.evaluate("""() => [...document.querySelectorAll('.tm6-lines > details')].map(d => ({ id: d.dataset.tmfold, open: d.open, t: d.querySelector('summary').innerText }))""")
    check('1440: Hearings, Who is on what and No owner are quiet lines, closed', [l['id'] for l in lines] == ['sched', 'who', 'noown'] and not any(l['open'] for l in lines), lines)
    red = p.evaluate(f"""() => [...document.querySelectorAll('main *')].filter(e => e.getClientRects().length && e.childElementCount === 0 && e.textContent.trim() && getComputedStyle(e).color === '{BAD}')
      .map(e => (e.closest('.v6-row-line') || e).innerText.trim()).filter((t, i, a) => a.indexOf(t) === i)""")
    check('1440: red only on an overdue step', all(t.startswith('Overdue') for t in red), red[:3])
    # Today's "N slipping" door and Team's heading say one number (walk 4 critic: 7 on Today opened "Slipping 8")
    pg.nav('/'); today = num(r'(\d+)\s+slipping', pg.text('main'))
    pg.nav('/team')
    # See all N
    see = p.get_by_role('button', name=re.compile(r'^See all \d+'))
    st = see.inner_text() if see.count() else ''
    check('1440: "See all N" says the list\'s count', num(r'See all (\d+)', st) == n, f'"{st}", heading {n}')
    if see.count():
      see.click(); pg.ready()
      rows = p.evaluate(ROWS, '[data-block="slip"] .v6-list > *')
      check('1440: See all opens all N rows', rows == n, f'{rows} of {n}')
      lists = p.evaluate("() => document.querySelectorAll('[data-block=\"slip\"] .v6-list').length")
      first3 = p.evaluate("() => [...document.querySelectorAll('[data-block=\"slip\"] .v6-list > *')].slice(0, 3).map(e => e.innerText.split('\\n').slice(0, 3).join(' | '))")
      check('1440: See all keeps one card, the first 3 rows unchanged in place', lists == 1 and first3 == [r['t'] for r in top], f'{lists} lists')
      risk = p.evaluate("() => [...document.querySelectorAll('[data-block=\"slip\"] .v6-list > *')].filter(e => /Hearing at risk/.test(e.innerText)).length")
      check("1440: Today's door says Team's count (its slipping rows and the hearings at risk)", today is not None and n == today and risk >= 0, f'Today {today}, at risk {risk}, Team {n}')
      fewer = p.get_by_role('button', name='Show fewer')
      if fewer.count(): fewer.click(); pg.ready()
      check('1440: Show fewer goes back to 3', p.evaluate(ROWS, '[data-block="slip"] .v6-list > *') == min(3, n), '')
      pg.shot(os.path.join(os.environ.get('SHOTS', '/tmp'), 'team-1440-see-all.png'), full=True) if os.environ.get('SHOTS') else None
    # each quiet line opens what it counts
    def open_fold(fid):
      p.click(f'details[data-tmfold="{fid}"] > summary'); p.wait_for_timeout(250)
      return p.inner_text(f'details[data-tmfold="{fid}"] > summary')
    t = open_fold('sched')
    days = p.evaluate("""() => [...document.querySelectorAll('details[data-tmfold="sched"] h3')].map(h => { let e = h.nextElementSibling; return [h.innerText, e ? e.children.length : 0]; })""")
    got = {d: c for d, c in days}
    check('1440: Hearings opens the sittings it counts', num(r'(\d+) today', t, 0) == got.get('Today', 0) and num(r'(\d+) tomorrow', t, 0) == got.get('Tomorrow', 0), f'"{t}" vs {got}')
    t = open_fold('who')
    bars = p.evaluate(ROWS, 'details[data-tmfold="who"] .tm6-load:not(.tm6-helps):not([href*="who=none"])')
    check('1440: Who is on what opens the people it counts', num(r'(\d+) (?:people|person)', t) == bars, f'"{t}" vs {bars} bars')
    t = open_fold('noown')
    nob = p.evaluate(ROWS, 'details[data-tmfold="noown"] .v6-list > *')
    nbtn = p.evaluate(ROWS, 'details[data-tmfold="noown"] .v6-list > * :is(button, .btn)')
    check('1440: No owner opens the bills it counts', num(r'(\d+) bills?', t) == nob, f'"{t}" vs {nob} rows')
    check('1440: No owner: a button only on a step due within a day (A-3 on v6), the rest on its page', nbtn == p.evaluate("() => [...document.querySelectorAll('details[data-tmfold=\"noown\"] .v6-list > *')].filter(e => /\\b(today|tomorrow)\\b/i.test(e.innerText)).length") and p.query_selector('details[data-tmfold="noown"] a[href="#/team?who=none"]'), f'{nbtn} buttons on {nob} rows')
    check('1440: Who is on what has no No owner bar (said once, A-14)', not p.query_selector('details[data-tmfold="who"] a[href*="who=none"]'), '')
    # the same count as its own page
    pg.nav('/team?who=none'); whole = num(r'(\d+) bills? with a position', pg.text('main'))
    check('1440: No owner\'s count is its page\'s', whole == nob, f'{whole} vs {nob}')
    pg.nav('/team')
    check('1440: an opened line stays open after a redraw', p.evaluate("() => document.querySelector('details[data-tmfold=\"noown\"]')?.open") is True, '')
    check('1440: no page errors', not pg.errors, pg.errors[:1]); pg.close()

    # ---- phone, 390 ----
    pg = b.page('NT', 390, 844); pg.open('/team'); p = pg.page
    order = p.evaluate("() => [...document.querySelectorAll('.tm6-root [data-block]')].map(e => [e.dataset.block, Math.round(e.getBoundingClientRect().top)])")
    ids = [o[0] for o in order]; ys = [o[1] for o in order]
    check('390: the same order (Slipping, Hearings, Who is on what, No owner)', ids[:4] == ['slip', 'sched', 'who', 'noown'] and ys == sorted(ys), order)
    check('390: the 3 most urgent with their actions', p.evaluate(ROWS, '[data-block="slip"] .v6-list > *') == 3 and p.evaluate(ROWS, '[data-block="slip"] .v6-list > * :is(button, .btn)') == 3, '')
    for fid in ('sched', 'who', 'noown'): p.click(f'details[data-tmfold="{fid}"] > summary'); p.wait_for_timeout(200)
    see = p.get_by_role('button', name=re.compile(r'^See all \d+'))
    if see.count(): see.click(); pg.ready()
    hs = p.evaluate('document.documentElement.scrollWidth > innerWidth + 1')
    check('390: no sideways scroll, everything open', not hs, p.evaluate('document.documentElement.scrollWidth'))
    check('390: no page errors', not pg.errors, pg.errors[:1]); pg.close()

    # ---- between sessions: no hearings blocks, nothing broken ----
    pg = b.page('NT', 1440, 900); pg.open('/team', L.CLOCKS['off'])
    check('off season: no hearings line', not pg.page.query_selector('details[data-tmfold="sched"]'), '')
    check('off season: no page errors', not pg.errors, pg.errors[:1]); pg.close()
  R.done()

if __name__ == '__main__': main()
