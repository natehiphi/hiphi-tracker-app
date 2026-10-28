# Staff v6: an issue's page (R-336 walk 3, staff6/issuepage.js). Nate, 25 Oct: "going to this page should show everything
# that a staff member needs to know about what's going on with their bills". On the practice copy (Mon 16 Mar 2026), as Nate:
#   1. the health check, one plain sentence for each case, with no "Next:" (R-352: the next step is said once, below it):
#      alive in both chambers, alive in one ("At risk: ... If they stop in the Senate, ..."), past both ("On track: HB 244
#      is in conference."), every bill stopped ("Stopped: every bill on this issue stopped this session."), and no bills;
#   2. the bills House | Senate: both headings, a column with none alive says so ("No House bill alive"), alive bills carry
#      the slim stage bar, stopped ones say when and why ("Stopped 2/20: ...");
#   3. the next step (R-352): a heading that names it ("Needs a hearing by Mon 3/30"), its bill's row and the way to act;
#      walk 4 (Nate, 25 Oct): one column at 1440 (no right column, a reading column of 760px at most), the top four open in
#      order (health check, the next step, Its bills, Who is working on it), the quiet lines, then three folds closed, each
#      with a summary on its closed line (talking points and materials, timeline, last year's result);
#   4. the timeline shows five events and folds the rest under "Earlier";
#   5. the prep card (walk 3 item 7): in session left out while nobody has started it, shown once a step is done, and back
#      between sessions;
#   6. on a phone the columns stack, House then Senate, with no sideways scroll; no codes in rows; no page errors;
#   7. where partners stand (issue_partner_positions, 189): the practice rows show, and add, change and remove each work
#      with Undo in the toast.
#
#   V4_ROOT=/path/to/worktree python3 tests/staff6_issuepage.py     exits 1 when a check fails
import os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import staff6_lib as L

BOTH = '66a32660-b0a7-4a90-a71f-231963619b44'      # Disposable e-cigarette ban: House bill HB 2121 and Senate bill SB 2175, one name
ONE = 'a8690eec-3d30-4c19-9e15-ce5157c6b950'       # Safety for immigrant families: four House bills alive (all now in the Senate)
PAST = 'b636541e-aef7-46e8-8a99-fb4b0cf38b50'      # Funding for community nonprofits: HB 244 in conference
STOPPED = '2631c97b-91d1-4336-9d56-6f2678f5bc41'   # Single-payer health care: both bills stopped
SHOTS = os.environ.get('ISSUEPAGE_SHOTS', '')

R = L.Results()
def health(pg): return pg.page.evaluate("document.querySelector('.ip6-hs')?.innerText.replace(/\\s+/g, ' ').trim() || ''")
def in_view(pg, sel): return pg.page.evaluate("""s => { const e = document.querySelector(s); if (!e) return false; const r = e.getBoundingClientRect(); return r.top >= 0 && r.top < innerHeight && r.height > 0; }""", sel)
def open_folds(pg): pg.page.evaluate("document.querySelectorAll('details.ip6-sf').forEach(d => d.open = true)"); pg.page.wait_for_timeout(100)
def shot(pg, name):
  if SHOTS: pg.shot(os.path.join(SHOTS, f'{name}-{pg.w}.png')); pg.shot(os.path.join(SHOTS, f'{name}-{pg.w}-full.png'), full=True)

CASES = [
  ('both chambers', BOTH, r'^On track: bills that started in each chamber are still alive\.$'),
  ('one chamber', ONE, r'^At risk: all 4 alive bills started in the House\. If they stop in the Senate, the issue ends this year\.$'),
  ('past both chambers', PAST, r'^On track: HB 244 is in conference\.$'),
  ('every bill stopped', STOPPED, r'^Stopped: every bill on this issue stopped this session\.$'),
]
with L.browser() as B:
  for (w, h) in [(1440, 900), (390, 844)]:
    pg = B.page('NT', w, h)
    first = True
    for name, iid, rx in CASES:
      if first: pg.open('/issue/' + iid); first = False
      else: pg.nav('/issue/' + iid)
      pg.page.wait_for_timeout(300)
      where = f'{name} {w}'
      t = health(pg)
      R.check(f'{where}: the health check says it in one sentence', re.match(rx, t) is not None, t)
      # A step below it may be amber when late (A-5 on v6, R-352; due today is plain); the check is the health box's own colours.
      alarm = pg.page.evaluate("""(() => { const h = document.querySelector('.ip6-health'); if (!h) return -1; const cs = getComputedStyle(document.body);
        const bad = ['--v6-late', '--v6-bad', '--v6-late-wash', '--v6-bad-wash'].map(k => cs.getPropertyValue(k).trim()).filter(Boolean).map(c => { const d = document.createElement('i'); d.style.color = c; document.body.append(d); const r = getComputedStyle(d).color; d.remove(); return r; });
        return [h, ...h.querySelectorAll('*')].filter(e => bad.includes(getComputedStyle(e).color) || bad.includes(getComputedStyle(e).backgroundColor)).length; })()""")
      R.check(f'{where}: no colour alarm on the health check (no late or bad colour)', alarm == 0, alarm)
      cols = pg.page.evaluate("[...document.querySelectorAll('.ip6-col')].map(e => e.dataset.ipCol)")
      R.check(f'{where}: House and Senate columns, in that order', cols == ['H', 'S'], cols)
      heads = pg.page.evaluate("[...document.querySelectorAll('.ip6-colh')].map(e => e.firstChild.textContent.trim())")
      R.check(f'{where}: the columns are "Started in the House" and "Started in the Senate"', heads == ['Started in the House', 'Started in the Senate'], heads)
      origin = pg.page.evaluate("[...document.querySelectorAll('.ip6-col')].map(c => [c.dataset.ipCol, [...c.querySelectorAll('.ip6-brow')].map(r => r.innerText.match(/\\b(HB|SB|HCR|SCR|HR|SR) \\d+/)?.[1] || '')])")
      R.check(f'{where}: each bill sits in the chamber it started in', all(all((n.startswith('H') if side == 'H' else n.startswith('S')) for n in ns) for side, ns in origin), origin)
      hl = pg.page.evaluate("(() => { const e = document.querySelector('.ip6-hs > span'); return e ? Math.round(e.getBoundingClientRect().height / parseFloat(getComputedStyle(e.parentElement).lineHeight)) : 0; })()")
      lim = 2 if w >= 768 else 5   # the verdict says what is at stake, and no Next (R-352: said once, below)
      R.check(f'{where}: the health check is at most {lim} lines', 1 <= hl <= lim, hl)
      m = pg.measure()
      R.check(f'{where}: no committee codes in rows', m['row_codes'] == 0, m['worst_row'])
      R.check(f'{where}: no sideways scroll', not m['hscroll'])
      R.check(f'{where}: at most one filled button in view', m['filled'] <= 1, m['filled'])
      R.check(f'{where}: bold at most 25%, small text at most 30%', m['bold_pct'] <= 25 and m['small_pct'] <= 30, (m['bold_pct'], m['small_pct']))
      if w == 1440:
        ok = all(in_view(pg, s) for s in ['.ip6-health', '.ip6-next h2'])
        first_row = in_view(pg, '.ip6-next .v6-row') or in_view(pg, '.ip6-next .ip6-quiet') or in_view(pg, '.ip6-next .ip6-go')
        R.check(f'{where}: the first laptop screen holds the health check and the first next step', ok and first_row)
        lay = pg.page.evaluate("""(() => { const p = document.querySelector('.ip6-page'), r = p.getBoundingClientRect();
          return { side: !!document.querySelector('.ip6-side, .is6-side, .is6-cols'), w: Math.round(document.querySelector('main').getBoundingClientRect().width),
            lefts: [...p.querySelectorAll(':scope > .ip6-health, :scope > .ip6-sec, :scope > .ip6-folds')].map(e => Math.round(e.getBoundingClientRect().left)) }; })()""")
        R.check(f'{where}: one column, no right column, at most 760px wide', not lay['side'] and lay['w'] <= 760 and len(set(lay['lefts'])) == 1, lay)
      top = pg.page.evaluate("""[...document.querySelectorAll('.ip6-page > .ip6-health, .ip6-page > .ip6-sec')].map(e => e.classList.contains('ip6-health') ? 'health' : e.classList.contains('ip6-next') ? 'next' : e.classList.contains('ip6-bills') ? 'bills' : e.getAttribute('aria-labelledby') === 'ip-wh' ? 'who' : e.className)""")
      R.check(f'{where}: the top four open, in order: health check, the next step, Its bills, Who is working on it', top == ['health', 'next', 'bills', 'who'], top)
      folds = pg.page.evaluate("[...document.querySelectorAll('.ip6-folds > details.ip6-sf')].map(d => [d.dataset.fold, d.open, d.querySelector('summary').innerText.replace(/\\s+/g, ' ').trim()])")
      keys = [f[0] for f in folds]
      R.check(f'{where}: then three folds of one weight: talking points and materials, timeline, last year (R-352: seven were too many)', keys == ['points', 'timeline', 'lastyear'], keys)
      R.check(f'{where}: every fold starts closed with a summary on its closed line', all(not o and ' · ' in t and len(t.split(' · ', 1)[1]) > 3 for _, o, t in folds), folds)
      wt = pg.page.evaluate("[...document.querySelectorAll('.ip6-folds .ip6-sfh')].map(h => getComputedStyle(h).fontWeight + ' ' + getComputedStyle(h).fontSize)")
      R.check(f'{where}: the folds share one weight', len(set(wt)) == 1, wt)
      R.check(f'{where}: no "mores" (R-352 typo)', 'mores' not in pg.text())
      shot(pg, name.replace(' ', '-'))
    # alive in one chamber: the other column says so plainly; alive bills carry the bar
    pg.nav('/issue/' + ONE)
    none = pg.page.evaluate("document.querySelector('[data-ip-none=\"S\"]')?.innerText.trim()")
    R.check(f'one chamber {w}: "No bill that started in the Senate is still alive"', none == 'No bill that started in the Senate is still alive', none)
    bars = pg.page.evaluate("[...document.querySelectorAll('[data-ip-col=\"H\"] .ip6-brow:not(.is-stop)')].map(r => !!r.querySelector('.ip6-bar'))")
    R.check(f'one chamber {w}: each alive House bill has its stage bar', bars and all(bars), bars)
    now = pg.page.evaluate("[...document.querySelectorAll('[data-ip-col=\"H\"] .ip6-brow:not(.is-stop) .v6-row-line')].map(e => e.innerText.trim())")
    R.check(f'one chamber {w}: each alive bill says where it is now ("Now in Senate ...")', now and all(x.split('\n')[-1].startswith('Now in Senate') for x in now), now)
    # next steps in date order: each row's time, read from the model, never goes backwards
    order = pg.page.evaluate("document.querySelectorAll('.ip6-next .v6-row').length")
    R.check(f'one chamber {w}: the next step and those after it are listed', order >= 3, order)
    R.check(f'one chamber {w}: "3 more stopped" style fold words, never "mores"', 'mores' not in pg.text())
    # stopped bills say when and why
    pg.nav('/issue/' + STOPPED)
    lines = pg.page.evaluate("[...document.querySelectorAll('.ip6-brow.is-stop .v6-row-line')].map(e => e.innerText.trim())")
    R.check(f'every bill stopped {w}: stopped bills say when and why', lines and all(re.match(r'^Stopped( \d+/\d+)?: \S', x) for x in lines), lines)
    R.check(f'every bill stopped {w}: no "none alive" box over the stopped cards', pg.page.query_selector('.ip6-none') is None)
    R.check(f'every bill stopped {w}: its next step is getting it ready for 2027', pg.page.query_selector('.ip6-next [data-ip="prep"]') is not None and pg.page.query_selector('.pr6-card') is not None)
    pg.page.click('.ip6-next [data-ip="prep"]'); pg.page.wait_for_timeout(600)
    R.check(f'every bill stopped {w}: "get it ready for 2027" opens the prep card', pg.page.evaluate("(() => { const c = document.querySelector('.pr6-card'); const r = c.getBoundingClientRect(); return (c.tagName !== 'DETAILS' || c.open) && r.top < innerHeight && r.bottom > 0; })()"))
    if w < 768:
      y = pg.page.evaluate("[...document.querySelectorAll('.ip6-col')].map(c => [c.getBoundingClientRect().top, c.getBoundingClientRect().bottom, c.getBoundingClientRect().left])")
      R.check('phone: the columns stack, House above Senate', len(y) == 2 and y[1][0] >= y[0][1] - 1 and abs(y[0][2] - y[1][2]) < 2, y)
    else:
      y = pg.page.evaluate("[...document.querySelectorAll('.ip6-col')].map(c => [c.getBoundingClientRect().top, c.getBoundingClientRect().left])")
      R.check('laptop: the columns sit side by side', len(y) == 2 and abs(y[0][0] - y[1][0]) < 2 and y[1][1] > y[0][1], y)
    # two bills with one name: the number leads each card
    pg.nav('/issue/' + BOTH)
    names = pg.page.evaluate("[...document.querySelectorAll('.ip6-brow .v6-row-name')].map(e => e.innerText.trim())")
    R.check(f'same name {w}: each card leads with its bill number', names and all(re.match(r'^(HB|SB) \d+$', n) for n in names), names)
    # The next step (R-352): said once, under a heading that names it; its rows are the bills as Today and Bills draw them
    # (the bill's name first, its number small after, A-14), and a to-do keeps its own words with the bill number second
    rows = pg.page.evaluate("[...document.querySelectorAll('.ip6-next .ip6-step')].map(r => [r.querySelector('.v6-row-name').innerText.trim(), r.querySelector('.v6-row-num')?.innerText.trim() || '', r.querySelector('.v6-row-line')?.innerText.trim() || ''])")
    R.check(f'next steps {w}: each step row names its bill, its number small after, and one line', rows and all(n and not re.match(r'^(HB|SB) \d+', n) and re.match(r'^(HB|SB) \d+$', k) and l for n, k, l in rows), rows)
    R.check(f'next steps {w}: the health check says no "Next:" (the step is said once, below it)', 'Next:' not in health(pg), health(pg))
    nh = pg.page.evaluate("document.querySelector('.ip6-next h2')?.innerText.trim() || ''")
    R.check(f'next steps {w}: the heading names the first step, not "What to do next"', nh and nh != 'What to do next', nh)
    go = pg.page.evaluate("[...document.querySelectorAll('.ip6-next a.ip6-golink')].map(a => [a.innerText.trim(), a.getAttribute('href'), getComputedStyle(a).textDecorationLine])")
    R.check(f'next steps {w}: a chair ask with no button of its own ends with "Ask on Bills That Need Hearings ›", teal, no underline', len(go) == 1 and go[0][0] == 'Ask on Bills That Need Hearings ›' and go[0][1].startswith('#/hearings/ask?scope=') and go[0][2] == 'none', go)
    # legislators: with no stance known, one quiet line per committee naming its chairs by surname; no fold, no heading
    R.check(f'legislators {w}: no fold of its own', pg.page.query_selector('details[data-fold="legs"]') is None)
    ll = pg.page.evaluate("[...document.querySelectorAll('[data-ip-legs=\"line\"] .ip6-lline')].map(e => e.innerText.trim())")
    R.check(f'legislators {w}: one line per committee when no stance is known', len(ll) == 2 and all('no stances known yet' in x and 'chair' in x for x in ll) and not pg.page.query_selector('.ip6-lrow'), ll)
    # the first-visit switch is in the "…"; the public page is one line (R-352: Public interest and Stories were two folds)
    R.check(f'public {w}: no first-visit switch on the page', pg.page.query_selector('#is-fv') is None)
    pub = pg.page.evaluate("document.querySelector('.ip6-pub')?.innerText || ''")
    R.check(f'public {w}: one line, "On the public page: ... N following its bills"', re.match(r'^On the public page: (\d+ following this issue.* · )?\d+ following its bills', pub) is not None and pg.page.query_selector('details[data-fold="public"], details[data-fold="stories"]') is None, pub[:120])
    R.check(f'related {w}: one line with Edit, no fold', pg.page.query_selector('p.ip6-rel [data-is="reledit"]') is not None and pg.page.query_selector('details[data-fold="related"]') is None)
    pg.page.click('p.ip6-rel [data-is="reledit"]'); pg.page.wait_for_timeout(300)
    R.check(f'related {w}: Edit opens the tools in place', pg.page.query_selector('section.ip6-rel [data-is="link"]') is not None)
    pg.page.click('section.ip6-rel [data-is="reledit"]'); pg.page.wait_for_timeout(300)
    R.check(f'related {w}: Done closes them, focus back on Edit', pg.page.evaluate("document.activeElement?.dataset?.is === 'reledit' && !!document.activeElement.closest('p.ip6-rel')"))
    open_folds(pg)
    ly = pg.page.evaluate("document.querySelector('[data-ip-late=\"lastyearsum\"]')?.innerText.trim()")
    R.check(f'last year {w}: the fold says the result', re.match(r'^2025: \S', ly or '') is not None, ly)
    R.check(f'documents {w}: "more documents", never "Docs"', 'more Doc' not in pg.text())
    # the timeline: five events, then a fold labelled Earlier
    pg.nav('/issue/' + BOTH); pg.page.wait_for_timeout(500); open_folds(pg)
    tl = pg.page.evaluate("""() => { const sec = document.querySelector('[data-ip-late="tl"]'); const d = sec?.querySelector('details[data-fold="tl"]');
      return { shown: sec ? sec.querySelectorAll(':scope > ol > li').length : -1, fold: d ? d.querySelector('summary').innerText.trim() : '', open: d ? d.open : null, inside: d ? d.querySelectorAll('li').length : 0 }; }""")
    R.check(f'timeline {w}: five events shown, the rest folded under "Earlier"', tl['shown'] == 5 and tl['fold'].startswith('Earlier:') and tl['open'] is False and tl['inside'] > 0, tl)
    # newest first: this session's days ("Tue 3/10") read as month/day, falling down the list
    md = pg.page.evaluate("[...document.querySelectorAll('[data-ip-late=\"tl\"] > ol > .ip6-ev .ip6-evd')].map(e => e.innerText.trim())")
    nums = [tuple(int(x) for x in re.search(r'(\d+)/(\d+)', d).groups()) for d in md if re.fullmatch(r'\w{3} \d+/\d+', d)]
    R.check(f'timeline {w}: newest first', nums == sorted(nums, reverse=True) and len(nums) >= 2, md)
    # where partners stand: the practice rows, then add, change and remove, each with Undo
    pp = lambda: pg.page.evaluate("[...document.querySelectorAll('.ip6-pp')].map(r => r.innerText.replace(/\\s+/g, ' ').trim())")
    rows = pp()
    R.check(f'partners {w}: the practice positions show, stance in words, with who set them', len(rows) == 3 and any(r.startswith('American Heart Association Supports · the whole issue · 2026') for r in rows) and any('Opposes · on SB 2175' in r for r in rows) and all('Set by' in r for r in rows), rows)
    R.check(f'partners {w}: the closed line counts them', '3 partner positions' in pg.page.evaluate("document.querySelector('details[data-fold=\"points\"] summary').innerText"))
    def undo():
      pg.page.click('#toast .toastundo'); pg.page.wait_for_timeout(400)
    pg.page.click('[data-ipp="add"]'); pg.page.wait_for_timeout(400)
    pg.page.fill('#ip-ppname', 'Hawaii Public Health Institute Youth Council')
    pg.page.check('input[name="ip-ppst"][value="amend"]'); pg.page.select_option('#ip-ppbill', index=1); pg.page.fill('#ip-ppnote', 'Want a longer phase-in.')
    pg.page.click('[data-ppsave]'); pg.page.wait_for_timeout(500)
    rows = pp()
    R.check(f'partners {w}: Add puts the new position on the list', len(rows) == 4 and any(r.startswith('Hawaii Public Health Institute Youth Council Wants changes · on ') and 'Want a longer phase-in.' in r and 'Set by you' in r for r in rows), rows)
    R.check(f'partners {w}: the toast offers Undo', pg.page.query_selector('#toast .toastundo') is not None)
    undo(); R.check(f'partners {w}: Undo takes the new position off', len(pp()) == 3, pp())
    pg.page.click('[data-ipp="add"]'); pg.page.wait_for_timeout(400)
    pg.page.fill('#ip-ppname', 'american heart association'); pg.page.click('[data-ppsave]'); pg.page.wait_for_timeout(400)
    err = pg.page.evaluate("document.getElementById('ip-ppname-err')?.innerText.trim() || ''")
    R.check(f'partners {w}: a second position for the same partner and bill says so next to the name', 'already has a position' in err, err)
    pg.page.keyboard.press('Escape'); pg.page.wait_for_timeout(400)
    pg.page.click('.ip6-pp [data-ipp="edit"] >> nth=0'); pg.page.wait_for_timeout(400)
    pg.page.check('input[name="ip-ppst"][value="comments"]'); pg.page.click('[data-ppsave]'); pg.page.wait_for_timeout(500)
    R.check(f'partners {w}: a change shows on its row', any('Comments · the whole issue' in r for r in pp()), pp())
    undo(); R.check(f'partners {w}: Undo puts the old stance back', any(r.startswith('American Heart Association Supports') for r in pp()), pp())
    before = pp()[0]
    pg.page.click('.ip6-pp [data-ipp="edit"] >> nth=0'); pg.page.wait_for_timeout(400)
    pg.page.click('[data-ppx]'); pg.page.wait_for_timeout(500)
    R.check(f'partners {w}: Remove takes it off', len(pp()) == 2 and not any(r.startswith('American Heart') for r in pp()), pp())
    undo(); R.check(f'partners {w}: Undo brings it back as it was', len(pp()) == 3 and before in pp(), (before, pp()))
    if SHOTS:
      el = pg.page.query_selector('details[data-fold="points"]'); el.scroll_into_view_if_needed(); el.screenshot(path=os.path.join(SHOTS, f'partners-{w}.png'))
    # the prep card: in session, left out while nobody started it; shown once a step is done
    R.check(f'prep {w}: in session the unstarted "Getting ready for 2027" card is left out', pg.page.query_selector('.pr6-card') is None)
    pg.page.evaluate(f"""async () => {{ const D = await import('./staff6/data.js'); await D.DB.updateIssue('{BOTH}', {{ goal: 'Keep disposable e-cigarettes off the shelves.' }}); D.hooks.render(); }}""")
    pg.page.wait_for_timeout(400)
    R.check(f'prep {w}: once a step is done, the card comes back', pg.page.query_selector('.pr6-card') is not None)
    # the walk's issue (Free school meals): one bill alive, asked and waiting; the heading says what it needs, by when
    pg.nav('/issue/' + L.ISSUE); pg.page.wait_for_timeout(300)
    nh = pg.page.evaluate("document.querySelector('.ip6-next h2')?.innerText.trim() || ''")
    R.check(f'walk issue {w}: the next step\'s heading is "Needs a hearing by Mon 3/30"', nh == 'Needs a hearing by Mon 3/30', nh)
    R.check(f'walk issue {w}: the Senate column with none alive folds its stopped bills ("3 bills stopped") under "3 more stopped" House-side', '3 more stopped' in pg.text() and '3 bills stopped' in pg.text(), pg.text()[:0])
    # an issue with no bills
    nid = pg.page.evaluate("""async () => { const D = await import('./staff6/data.js'); const i = await D.DB.createIssue({ name: 'Test issue with no bills', description: 'Nothing on it yet.', category: D.S.categories[0].key }); return i.id; }""")
    pg.nav('/issue/' + nid); pg.page.wait_for_timeout(300)
    t = health(pg)
    R.check(f'no bills {w}: the health check says so', t.startswith('No bills yet'), t)
    R.check(f'no bills {w}: the bill search is open to put one on', pg.page.query_selector('#is-bq') is not None)
    shot(pg, 'no-bills')
    R.check(f'{w}: no page errors', not pg.errors, pg.errors[:2])
    pg.close()
  # between sessions the card is back (the prep is the work again)
  pg = B.page('NT', 1440, 900); pg.open('/issue/' + BOTH, L.CLOCKS['off']); pg.page.wait_for_timeout(300)
  R.check('prep: between sessions the card is shown', pg.page.query_selector('.pr6-card') is not None)
  R.check('between sessions: no page errors', not pg.errors, pg.errors[:2]); pg.close()
R.done()
