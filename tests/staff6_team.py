# Staff v6 Team (#/team), Nate's walk 4 (R-336): "It's still too crowded. This needs to be more calm and roomy. I'm not
# sure where I'm supposed to look." His pick, "One list, top 3": Slipping and Hearings at risk as one ranked list with its
# three most urgent rows shown, each with its one action, and "See all N" opening the N. R-352 (Nate 27 Oct): the lead's own
# steps are on their Today, so Slipping leaves them out and says how many in one quiet line; Who is on what is
# read-only, faces and counts, in the column beside the lists at 1440 (23 Oct's layout), with the Partners line under it;
# one column on a phone. Red only on a step whose deadline passed (A-5 on v6); 12 controls on the first screen (A-2 on v6).
# R-356 round 1 (decision 2): Team has page tabs, Slipping (#/team) · The team's hearings (#/team/hearings) · No owner
# (#/team/noowner, every bill nobody holds, with its button; it was a card of 3 on Slipping's page) · Chair asks
# (#/team/asks) · Public asks (#/team/public); Team opens for admins, second approvers and people with Sees Team (Kris);
# Kevin has no Team option on Hearings, Bills, Legislators or Outreach, Kris has all four.
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
    col = p.evaluate("""() => { const m = document.querySelector('.tm6-main'), a = document.querySelector('.tm6-side'); if (!m || !a) return null;
      const r = m.getBoundingClientRect(), q = a.getBoundingClientRect(); return { w: Math.round(r.width), right: Math.round(r.right), side: Math.round(q.left), sideTop: Math.round(q.top), top: Math.round(r.top) }; }""")
    check('1440: the lists at most 760px, Who is on what in the column beside them (23 Oct)', col and col['w'] <= 760 and col['side'] > col['right'] and abs(col['sideTop'] - col['top']) < 4, col)
    check('1440: Who is on what is in the side column', bool(p.query_selector('.tm6-side [data-block="who"]')), '')
    head = p.inner_text('[data-block="slip"] h2')
    n = num(r'(\d+)', head, 0)
    top = p.evaluate("""() => [...document.querySelectorAll('[data-block="slip"] .v6-list > *')].filter(e => e.getClientRects().length)
      .map(e => ({ t: e.innerText.split('\\n').slice(0, 3).join(' | '), btn: !!e.querySelector('button, .btn'), b: (e.querySelector('.v6-row-act') || {}).innerText || '', y: Math.round(e.getBoundingClientRect().bottom) }))""")
    check('1440: Slipping shows its 3 most urgent rows', len(top) == min(3, n), f'{len(top)} of {n}')
    check('1440: each of the 3 has its one action', top and all(r['btn'] for r in top), [r['t'][:50] for r in top if not r['btn']])
    check('1440: the 3 are on the first screen', top and max(r['y'] for r in top) <= 900, [r['y'] for r in top])
    check('1440: overdue first, then late, then the rest', top and re.search(r'(?i)overdue', top[0]['t']), [r['t'][:60] for r in top])
    # R-352: none of the lead's own steps (their button would be the step's own verb, File or Review); the quiet line says how many
    own = [r['b'] for r in top if r['b'] and not re.match(r'(?i)(Alert|Alerted|Give to|Take it)', r['b'].strip())]
    check("1440: none of the lead's own steps in Slipping (they are Today's)", not own, own)
    yours = p.inner_text('[data-block="slip"] .tm6-yours') if p.query_selector('[data-block="slip"] .tm6-yours') else ''
    check("1440: one quiet line says how many of the lead's own are on Today, not a link", re.search(r'Your own (one|\d+) (is|are) on your Today', yours) and not p.query_selector('.tm6-yours a'), yours)
    m = pg.measure()
    # R-356: the five page tabs are navigation links (the No owner card moved to its own tab)
    check('1440: at most 12 controls on the first screen, the 5 tab links included (A-2 on v6)', m['controls'] <= 13, m['controls'])
    check('1440: fewer words on the first screen than before R-336 (246)', m['words'] < 200, m['words'])
    # R-356 critic fixes (A-14): the folded Hearings card left Slipping (The team's hearings tab is that list), so no fold at all
    lines = p.evaluate("""() => [...document.querySelectorAll('.tm6-root details')].map(d => ({ id: d.dataset.tmfold, open: d.open }))""")
    check('1440: Slipping holds no folded card (Hearings is its own tab; nothing a lead must do is in a fold, B-14 on v6)', lines == [], lines)
    red = p.evaluate(f"""() => [...document.querySelectorAll('main *')].filter(e => e.getClientRects().length && e.childElementCount === 0 && e.textContent.trim() && getComputedStyle(e).color === '{BAD}')
      .map(e => (e.closest('.v6-row-line') || e).innerText.trim()).filter((t, i, a) => a.indexOf(t) === i)""")
    check('1440: red only on an overdue step', all(re.search(r'(?i)overdue', t) for t in red), red[:3])
    # R-356: the tabs, in this order, Slipping current; no No owner card on this tab (it is its own tab now)
    tabs = p.evaluate("() => [...document.querySelectorAll('nav.sv-secnav[aria-label=\"Team\"] a')].map(a => [a.querySelector('.sv-tl').innerText, a.getAttribute('aria-current') === 'page'])")
    check("1440: Team's tabs are Slipping, The team's hearings, No owner, Chair asks, Public asks, Slipping current", [t[0] for t in tabs] == ['Slipping', 'The team’s hearings', 'No owner', 'Chair asks', 'Public asks'] and [t[1] for t in tabs] == [True, False, False, False, False], tabs)
    check('1440: the No owner card is not on Slipping any more', not p.query_selector('[data-block="noown"]'), '')
    tn = p.query_selector('nav.sv-secnav a:nth-child(3) .sv-tn'); nc = num(r'(\d+)', tn.inner_text() if tn else '', 0)   # No owner's tab count
    # Who is on what: read-only, its count the rows it shows
    wsub = p.inner_text('[data-block="who"] .tm6-sub')
    bars = p.evaluate(ROWS, '[data-block="who"] .tm6-load:not(.tm6-helps)')
    check('1440: Who is on what counts the people it shows', num(r'(\d+) (?:people|person)', wsub) == bars, f'"{wsub}" vs {bars} bars')
    check('1440: Who is on what is read-only (no links or buttons) and has no No owner bar', not p.query_selector('[data-block="who"] :is(a, button)'), '')
    check('1440: the Partners line is in the side column, under Who is on what', not p.query_selector('.tm6-main a[href^="#/partners"]') and (not p.query_selector('a[href^="#/partners"]') or bool(p.query_selector('.tm6-side a[href^="#/partners"]'))), '')
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
    # the same count as its own page
    pg.nav('/team?who=none'); whole = num(r'(\d+) bills? with a position', pg.text('main'))
    check('1440: No owner\'s count is the old teammate page\'s', whole == nc, f'{whole} vs {nc}')
    # R-356: each tab opens, with its own content and no page errors
    pg.nav('/team/noowner')
    nrows = p.evaluate("""() => [...document.querySelectorAll('[data-block="noown"] .v6-list > *')].map(e => ({ btn: !!e.querySelector('.v6-row-act :is(button, .btn)') }))""")
    nh = num(r'(\d+)', p.inner_text('[data-block="noown"] h2'), 0)
    check('1440: No owner tab lists every bill nobody holds (not 3), each with its one button', len(nrows) == nh == nc and nh > 3 and all(r['btn'] for r in nrows), f'{len(nrows)} rows, heading {nh}, tab count {nc}')
    check('1440: No owner tab is current', 'No owner' in p.inner_text('nav.sv-secnav a[aria-current="page"]'), '')
    pg.nav('/team/hearings')
    check("1440: The team's hearings tab draws the week's cards", bool(p.query_selector('.hw-page .hw-day, .hw-page .hw-none')) and 'hearings' in p.inner_text('nav.sv-secnav a[aria-current="page"]').lower(), p.inner_text('main')[:80])
    pg.nav('/team/asks')
    check('1440: Chair asks tab draws the team board', bool(p.query_selector('.hg-sec, .hg-empty, [data-hg], .hg-how')) and 'Chair asks' in p.inner_text('nav.sv-secnav a[aria-current="page"]'), p.inner_text('main')[:80])
    pg.nav('/team/public')
    check('1440: Public asks tab draws Outreach\'s list at team scope', bool(p.query_selector('.ot-card, .ot-empty')) and 'Public asks' in p.inner_text('nav.sv-secnav a[aria-current="page"]'), p.inner_text('main')[:80])
    pg.nav('/team?tab=noowner')
    check('1440: ?tab= opens the same tab as the address', bool(p.query_selector('[data-block="noown"]')), '')
    pg.nav('/team')
    check('1440: the Slipping heading is for screen readers only (the tab says Slipping and its count, A-14)', p.evaluate("() => { const h = document.querySelector('[data-block=\"slip\"] h2'); return !!h && h.classList.contains('sr') && h.getBoundingClientRect().width <= 1; }"), '')
    check('1440: no page errors', not pg.errors, pg.errors[:1]); pg.close()

    # ---- phone, 390 ----
    pg = b.page('NT', 390, 844); pg.open('/team'); p = pg.page
    order = p.evaluate("() => [...document.querySelectorAll('.tm6-root [data-block]')].map(e => [e.dataset.block, Math.round(e.getBoundingClientRect().top)])")
    ids = [o[0] for o in order]; ys = [o[1] for o in order]
    check('390: one column: Slipping, then Who is on what', ids[:2] == ['slip', 'who'] and ys == sorted(ys), order)
    check('390: the 3 most urgent with their actions', p.evaluate(ROWS, '[data-block="slip"] .v6-list > *') == 3 and p.evaluate(ROWS, '[data-block="slip"] .v6-list > * :is(button, .btn)') == 3, '')
    see = p.get_by_role('button', name=re.compile(r'^See all \d+'))
    if see.count(): see.click(); pg.ready()
    hs = p.evaluate('document.documentElement.scrollWidth > innerWidth + 1')
    check('390: no sideways scroll, everything open', not hs, p.evaluate('document.documentElement.scrollWidth'))
    check('390: no page errors', not pg.errors, pg.errors[:1]); pg.close()

    # ---- between sessions: no hearings blocks, nothing broken ----
    pg = b.page('NT', 1440, 900); pg.open('/team', L.CLOCKS['off'])
    check('off season: no folded hearings card', not pg.page.query_selector('details[data-tmfold]'), '')
    check('off season: no page errors', not pg.errors, pg.errors[:1]); pg.close()
    # ---- R-356: who has a Team option (Kevin none, Kris all four) and who reaches Team ----
    OPT = "() => [...document.querySelectorAll('[data-seg=\"hscope\"],[data-seg=\"blscope\"],[data-seg=\"lgask\"],[data-seg=\"otwho\"]')].filter(e => e.textContent.trim() === 'Team').length"
    for who, want in (('KV', 0), ('KR', 1), ('NT', 1)):
      for path in ('/hearings/week', '/bills', '/legislators?view=ask', '/outreach'):
        pg = b.page(who, 1440, 900); pg.open(path); got = pg.page.evaluate(OPT)
        check(f'{who}: {path} has {"no" if not want else "a"} Team option', got == want, got)
        check(f'{who}: {path} has no page errors', not pg.errors, pg.errors[:1]); pg.close()
    for who, ok in (('KR', True), ('KV', False)):
      pg = b.page(who, 1440, 900); pg.open('/team'); p = pg.page
      check(f'{who}: #/team {"opens Team with its tabs" if ok else "is the teammate picker, not an error"}', bool(p.query_selector('nav.sv-secnav[aria-label="Team"]')) == ok, p.inner_text('main')[:60])
      check(f'{who}: #/team has no page errors', not pg.errors, pg.errors[:1]); pg.close()
  R.done()

if __name__ == '__main__': main()
