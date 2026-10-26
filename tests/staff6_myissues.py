# Staff v6 My issues, on Nate's picks of 25 Oct (R-336 walks 3 and 4; staff6/myviews.js): Deadlines by default, then Status,
# Topics and Spreadsheet behind one remembered switch. Walk 4 (Nate: "Issues should be sorted by needed deadline, and it
# should be easy to tell from there whether there is another bill in the other chamber that is alive or not") folded walk
# 3's Coverage and the old column board into the default. Checks, on the busiest practice day (Mon 16 Mar 2026):
#   - one quiet line of counts on top matches the practice data, counted here on their own (HB / SB bills on HIPHI's side);
#   - a heading a deadline, in date order, each with its count; every issue under the deadline issuestand.js says it must
#     beat next; Needs you rows first under each heading;
#   - every row has a From the House and a From the Senate cell in words (Cleared / Not yet / None alive), the House cell
#     holding only House-started bills; a split (one chamber cleared, the other not) exists and reads as one;
#   - stopped issues last, in a closed fold; Needs you today kept; a saved walk 3 "cover" lands on the default;
#   - each view draws, with no page error, and the choice is remembered after a reload;
#   - the filter box finds an issue by a word and by a bill number; "N bills on your issues have no owner yet · Take one";
#   - the spreadsheet sorts and copies; a phone has the select and nothing scrolls sideways;
#   - someone with no issue (Saya) still sees their coalitions; the calm budgets of staff6_budget.py hold on every view.
#   V4_ROOT=/path/to/worktree python3 tests/staff6_myissues.py [--shots DIR]
import os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import staff6_lib as L

SHOTS = sys.argv[sys.argv.index('--shots') + 1] if '--shots' in sys.argv else ''
VIEWS = ['deadlines', 'status', 'topics', 'sheet']

# The counts, worked out here from the data alone (not from myviews.js): an issue's bills this session, tracked, still
# alive (model.js diedish), on HIPHI's side (no Monitor and none opposed, unless nothing else is on it), split by the
# letter they start with (HB / HCR: House; SB / SCR: Senate).
COUNT = r"""async () => { const d = await import('/staff6/data.js'), m = await import('/staff6/model.js'), S = d.S, ids = d.myIssueIds();
  const AG = new Set(['oppose', 'strongly_oppose']); let both = 0, one = 0, stopped = 0, opp = 0;
  for (const i of S.issues.filter(i => ids.has(String(i.id)) && !i.archived_at)) {
    const bills = S.billIssues.filter(x => x.issue_id === i.id).map(x => S.bills.find(b => b.id === x.bill_id)).filter(b => b && b.tracked !== false && (!b.session_year || +b.session_year === +d.SESSION_YEAR));
    const going = bills.filter(b => !m.diedish(b));
    let side = going.filter(b => b.position && b.position !== 'monitor' && !AG.has(b.position)); if (!side.length) side = going.filter(b => !AG.has(b.position));
    if (i.stance === 'oppose' && going.length) { opp++; continue; }
    const h = side.some(b => !/^S/.test(b.bill_number)), s = side.some(b => /^S/.test(b.bill_number));
    if (h && s) both++; else if (h || s) one++; else stopped++; }
  return { both, one, stopped, opp }; }"""
SUM = r"""() => { const t = (document.querySelector('.mi-sum') || {}).innerText || '';
  const g = rx => +((t.match(rx) || [])[1] || 0); return { text: t, both: g(/(\d+) alive in both/), one: g(/(\d+) in one/), stopped: g(/(\d+) stopped/), all: g(/^(\d+) issues?/) }; }"""
# Each heading: its date, its count, and its rows, each with the deadline issuestand.js's standOf gives that issue.
HEADS = r"""async () => { const d = await import('/staff6/data.js'), st = await import('/staff6/issuestand.js');
  return [...document.querySelectorAll('section.mi-dsec')].map(sec => ({ date: sec.dataset.dl, head: sec.querySelector('h2').innerText.replace(/\s+/g, ' ').trim(),
    rows: [...sec.querySelectorAll('a.mi-cov')].map(a => { const i = d.S.issues.find(x => String(x.id) === a.dataset.mirow), x = st.standOf(i);
      return { name: i.name, want: (x.deadline || {}).date || null, needs: !!a.querySelector('.mi-need') }; }) })); }"""
ROWS = r"""() => [...document.querySelectorAll('a.mi-cov')].map(a => { const cells = [...a.querySelectorAll('.mi-cell')];
  return { name: a.querySelector('.mi-name').firstChild.textContent.trim(), ok: cells.map(c => c.classList.contains('ok')), off: cells.map(c => c.classList.contains('no')),
    cells: cells.map(c => c.innerText.replace(/\s+/g, ' ').trim()), nums: cells.map(c => [...c.querySelectorAll('.mi-cn')].map(n => n.innerText.trim())) }; })"""
PICK = """v => { const b = document.querySelector(`[data-miview=${v}]`), s = document.querySelector('[data-misel]');
  if (b && b.offsetParent) b.click(); else if (s) { s.value = v; s.dispatchEvent(new Event('change')); } }"""
PRESSED = "() => (document.querySelector('[data-miview][aria-pressed=true]') || {}).dataset?.miview || document.querySelector('[data-misel]')?.value"
HSCROLL = '() => document.scrollingElement.scrollWidth > innerWidth + 1'

def budgets(R, pg, label):
  m = pg.measure()
  R.check(f'{label}: text at 14px or under <= 30%', m['small_pct'] <= 30, f"{m['small_pct']}%")
  R.check(f'{label}: bold text <= 25%', m['bold_pct'] <= 25, f"{m['bold_pct']}%")
  R.check(f'{label}: text colours <= 5', m['colors'] <= 5, m['colors'])
  R.check(f'{label}: bordered elements <= 8', m['bordered'] <= 8, m['bordered'])
  R.check(f'{label}: corner radii <= 3', m['radii'] <= 3, f"{m['radii']} {m.get('radii_where')}")
  # A spreadsheet's row is a table row of seven columns by design (Bills' Spreadsheet is the same, D9): only its buttons and
  # codes are held to the row rules there.
  table = label.startswith('sheet')
  R.check(f'{label}: facts per row <= 4{" (not for the spreadsheet)" if table else ""}, buttons per row <= 1, no codes in rows', (table or m['facts_max'] <= 4) and m['row_buttons_max'] <= 1 and m['row_codes'] == 0,
          f"facts {m['facts_max']}, buttons {m['row_buttons_max']}, codes {m['row_codes']} {m.get('worst_row')}")
  R.check(f'{label}: at most 1 filled button', m['filled'] <= 1, m['filled'])
  R.check(f'{label}: no sideways scroll', not m['hscroll'])

def shot(pg, name):
  if SHOTS: pg.shot(os.path.join(SHOTS, name))

def main():
  R = L.Results()
  with L.browser() as b:
    # ---- Nate on a laptop ----
    pg = b.page('NT', 1440, 900); pg.open('/my-issues')
    pg.page.evaluate("() => { try { localStorage.clear(); } catch {} }"); pg.open('/my-issues')
    R.check('opens on Deadlines (the default), four views, no Coverage', pg.page.evaluate(PRESSED) == 'deadlines' and pg.page.evaluate("() => [...document.querySelectorAll('[data-miview]')].map(b => b.dataset.miview).join('|')") == 'deadlines|status|topics|sheet', pg.page.evaluate(PRESSED))
    want, sm = pg.page.evaluate(COUNT), pg.page.evaluate(SUM)
    total = pg.page.evaluate("async () => (await import('/staff6/data.js')).myIssueIds().size")
    R.check('one quiet line of counts matches the data (issues / both chambers / one / stopped)', (sm['all'], sm['both'], sm['one'], sm['stopped']) == (total, want['both'], want['one'], want['stopped']), f"shown {sm['text']!r}, data {want}")
    R.check('no count tiles lead the page any more', not pg.page.query_selector('.mi-tiles, .mi-tile'))
    heads = pg.page.evaluate(HEADS)
    dates = [h['date'] for h in heads]
    R.check('a heading a deadline, at least two, in date order', len(heads) >= 2 and dates == sorted(dates) and len(set(dates)) == len(dates), dates)
    R.check('each heading says "Must clear", its day and its count of issues, and the count is its rows', all(h['head'].startswith('Must clear ') and re.search(r'\d+/\d+', h['head']) and re.search(rf"\b{len(h['rows'])} issues?\b", h['head']) for h in heads), [h['head'] for h in heads])
    R.check('every issue stands under the deadline it must beat next (issuestand.js standOf)', all(r['want'] == h['date'] for h in heads for r in h['rows']), [(r['name'], r['want'], h['date']) for h in heads for r in h['rows'] if r['want'] != h['date']][:3])
    R.check('under each heading, Needs you rows come first', all([r['needs'] for r in h['rows']] == sorted([r['needs'] for r in h['rows']], reverse=True) for h in heads))
    items = pg.page.evaluate(ROWS)
    R.check('every row has two cells, "From the House" then "From the Senate"', bool(items) and all(len(x['cells']) == 2 and x['cells'][0].startswith('From the House') and x['cells'][1].startswith('From the Senate') for x in items), items[0]['cells'] if items else None)
    R.check('House cells hold only House-started bills, Senate cells only Senate-started ones', all(all(n.startswith('H') for n in x['nums'][0]) and all(n.startswith('S') for n in x['nums'][1]) for x in items))
    R.check('a ring cell says "None alive"; a tick cell says "Cleared"; a dot cell says "Not yet" or the bill\'s state', all((not o or c.endswith('None alive')) and (not k or 'Cleared' in c) for x in items for c, o, k in zip(x['cells'], x['off'], x['ok']))
            and any('Not yet:' in c for x in items for c in x['cells']), [x['cells'] for x in items][:2])
    split = [x for x in items if not any(x['off']) and x['ok'].count(True) == 1]
    R.check('a split exists (one chamber cleared its heading\'s deadline, the other not yet) and reads as one', bool(split) and all(any('Not yet' in c for c, k in zip(x['cells'], x['ok']) if not k) for x in split), [x['name'] for x in split][:3])
    R.check('an issue with no backup bill shows plainly: some rows have one ring cell', any(x['off'].count(True) == 1 for x in items))
    R.check('a crossed-over bill says where it is now ("now in the Senate")', any('now in the ' in c for x in items for c in x['cells']))
    today = pg.page.evaluate("() => [...document.querySelectorAll('.mi-today a.mi-trow')].map(a => a.innerText.replace(/\\s+/g, ' ').trim())")
    R.check('"Needs you today": at most 3 one-line rows, each naming an issue and its step, above the first heading', 0 < len(today) <= 3 and all(len(r) > 10 for r in today)
            and pg.page.evaluate("() => document.querySelector('.mi-today').getBoundingClientRect().bottom < document.querySelector('section.mi-dsec').getBoundingClientRect().top"), today)
    R.check('rows that need you carry the "Needs you" mark (a word and an icon)', pg.page.evaluate("() => [...document.querySelectorAll('a.mi-cov .mi-need')].every(m => m.innerText.trim() === 'Needs you' && m.querySelector('svg'))") and pg.page.evaluate("() => document.querySelectorAll('a.mi-cov .mi-need').length") > 0)
    R.check('stopped issues come last, in a closed fold that says how many', pg.page.evaluate("() => { const d = document.querySelector('details.mi-stopped'), b = document.querySelector('#mi-q-body'); return !!d && !d.open && b.lastElementChild === d && /^\\d+ stopped/.test(d.querySelector('summary').innerText.trim()); }"))
    pg.page.click('[data-migo="stopped"]'); pg.page.wait_for_timeout(600)
    R.check('the stopped count in the line opens its fold', pg.page.evaluate("() => document.querySelector('details.mi-stopped').open"))
    pg.page.evaluate("() => { document.querySelector('details.mi-stopped').open = false; scrollTo(0, 0); }")
    R.check('every issue row links to its issue page', pg.page.evaluate("() => [...document.querySelectorAll('a.mi-cov')].every(a => /^#\\/issue\\/.+\\?from=mine$/.test(a.getAttribute('href')))"))
    line = pg.text('.i6-lines') if pg.page.query_selector('.i6-lines') else ''
    R.check('"N bills on your issues have no owner yet · Take one" is kept', bool(re.search(r'\d+ bills? on your issues? (has|have) no owner yet', line)) and 'Take' in line, line[:80])
    pg.page.click('[data-mi="unowned"]'); pg.page.wait_for_timeout(500)
    R.check('Take one opens the bills with no owner', pg.page.evaluate("() => !!document.querySelector('dialog[open] [data-mitake]')"))
    pg.page.keyboard.press('Escape'); pg.page.wait_for_timeout(400)
    budgets(R, pg, 'deadlines 1440'); shot(pg, 'NT-deadlines-1440.png')
    for v in VIEWS[1:]:
      e0 = len(pg.errors); pg.page.evaluate(PICK, v); pg.page.wait_for_timeout(500)
      ok = {'status': "() => [...document.querySelectorAll('main h2')].map(h => h.innerText).join('|').includes('Needs you') && !!document.querySelector('.mi-def')",
            'topics': "() => document.querySelectorAll('.mi-shelf').length >= 2 && document.querySelectorAll('[data-mijump]').length >= 2",
            'sheet': "() => document.querySelectorAll('.mi-tbl tbody tr').length"}[v]
      r = pg.page.evaluate(ok)
      if v == 'sheet': r = r == pg.page.evaluate("async () => (await import('/staff6/data.js')).myIssueIds().size")
      R.check(f'{v} draws, without a page error', bool(r) and len(pg.errors) == e0, pg.errors[e0:][:1])
      budgets(R, pg, f'{v} 1440'); shot(pg, f'NT-{v}-1440.png')
    # Status: On track is never At risk (the definitions say why)
    pg.page.evaluate(PICK, 'status'); pg.page.wait_for_timeout(300)
    R.check('Status: no On track issue reads At risk', pg.page.evaluate("() => ![...document.querySelectorAll('#mi-s-ok ~ .i6-list .mi-dl')].some(e => /^At risk/.test(e.innerText.trim()))"))
    R.check('Status: an At risk row names bills that need a hearing, never one that has a hearing', pg.page.evaluate("() => [...document.querySelectorAll('.mi-dl')].filter(e => /^At risk/.test(e.innerText.trim())).every(e => !/has a hearing|have a hearing/.test(e.innerText))"))
    # the spreadsheet sorts and copies
    pg.page.evaluate(PICK, 'sheet'); pg.page.wait_for_timeout(300)
    pg.page.click('[data-misort="deadline"]'); pg.page.wait_for_timeout(300)
    R.check('the spreadsheet sorts by a heading', pg.page.evaluate("() => document.querySelector('th.mi-th-deadline').getAttribute('aria-sort')") == 'ascending')
    pg.page.click('[data-micopy]'); pg.page.wait_for_timeout(400)
    clip = pg.page.evaluate("async () => { try { return await navigator.clipboard.readText(); } catch (e) { return 'ERR ' + e; } }")
    R.check('Copy for Google Sheets copies a header and one row per issue', clip.startswith('Issue\tHouse-started\tSenate-started\tNext deadline\tCleared') and clip.count('\n') == pg.page.evaluate("async () => (await import('/staff6/data.js')).myIssueIds().size"), clip[:60])
    # remembered
    pg.page.evaluate(PICK, 'status'); pg.page.wait_for_timeout(300); pg.open('/my-issues')
    R.check('the view is remembered after a reload', pg.page.evaluate(PRESSED) == 'status', pg.page.evaluate(PRESSED))
    # walk 3's saved default ("cover", from this browser or from the person's prefs) lands on the new default, without error
    e0 = len(pg.errors)
    pg.page.evaluate("async () => { const d = await import('/staff6/data.js'); localStorage.setItem(`hiphi6_miview_${d.S.me.id}_demo`, 'cover'); }")
    pg.page.evaluate("async () => { const d = await import('/staff6/data.js'); d.S.me.prefs = { ...(d.S.me.prefs || {}), myIssuesView: 'cover' }; d.S.miView = null; d.hooks.render(); }"); pg.page.wait_for_timeout(400)
    R.check('a saved "cover" (walk 3) opens the Deadlines view, with no page error', pg.page.evaluate(PRESSED) == 'deadlines' and bool(pg.page.query_selector('section.mi-dsec')) and len(pg.errors) == e0, (pg.page.evaluate(PRESSED), pg.errors[e0:][:1]))
    # the filter box
    pg.page.fill('#mi-q', 'e-cigarette'); pg.page.wait_for_timeout(400)
    found = pg.text('#mi-q-body')
    R.check('the filter finds an issue by a word', 'Disposable e-cigarette ban' in found and bool(re.search(r'\d+ issues? match', found)), found[:80])
    pg.page.fill('#mi-q', 'HB 2300'); pg.page.wait_for_timeout(400)
    R.check('the filter finds an issue by a bill number', 'More local food in school meals' in pg.text('#mi-q-body'))
    pg.page.click('[data-istq="clear"]'); pg.page.wait_for_timeout(300)
    R.check('clearing the filter brings the view back', bool(pg.page.query_selector('section.mi-dsec')))
    R.check('no page errors as Nate on a laptop', not pg.errors, pg.errors[:2])
    pg.close()

    # ---- Nate on a phone ----
    ph = b.page('NT', 390, 844); ph.open('/my-issues')
    R.check('phone: the switch is a select, the buttons hidden', ph.page.evaluate("() => !!document.querySelector('[data-misel]').offsetParent && !document.querySelector('.mi-seg').offsetParent"))
    for v in VIEWS:
      ph.page.evaluate(PICK, v); ph.page.wait_for_timeout(500)
      R.check(f'phone {v}: no sideways scroll', not ph.page.evaluate(HSCROLL))
      budgets(R, ph, f'{v} 390'); shot(ph, f'NT-{v}-390.png')
    ph.page.evaluate(PICK, 'deadlines'); ph.page.wait_for_timeout(300)
    hs = ph.page.evaluate("() => [...document.querySelectorAll('a.mi-cov')].map(a => Math.round(a.getBoundingClientRect().height)).sort((x, y) => x - y)")
    R.check('phone: a row is well under 370px (the median; the tallest said)', bool(hs) and hs[len(hs) // 2] < 300, f'median {hs[len(hs) // 2] if hs else None}, tallest {hs[-1] if hs else None}')
    R.check('phone: the two cells sit side by side under each issue', ph.page.evaluate("() => [...document.querySelectorAll('a.mi-cov')].every(a => { const [h, s] = a.querySelectorAll('.mi-cell'); return Math.abs(h.getBoundingClientRect().top - s.getBoundingClientRect().top) < 2 && h.getBoundingClientRect().right <= s.getBoundingClientRect().left; })"))
    R.check('phone: the counts line sits above the first issue', ph.page.evaluate("() => document.querySelector('.mi-sum').getBoundingClientRect().bottom < document.querySelector('a.mi-cov').getBoundingClientRect().top"))
    R.check('no page errors as Nate on a phone', not ph.errors, ph.errors[:2])
    ph.close()

    # ---- someone with no issues: their coalitions (Saya) ----
    for w, h in ((1440, 900), (390, 844)):
      sy = b.page('SY', w, h); sy.open('/my-issues')
      R.check(f'Saya ({w}): one line says why she sees coalitions', 'No issues are yours yet.' in sy.text())
      R.check(f'Saya ({w}): no issues, so her coalitions show and no switch', not sy.page.query_selector('[data-miview], [data-misel]') and bool(sy.page.query_selector('main')) and 'My issues' in sy.text(), sy.text()[:80])
      shot(sy, f'SY-{w}.png'); R.check(f'Saya ({w}): no page errors', not sy.errors, sy.errors[:2]); sy.close()
  R.done()

if __name__ == '__main__': main()
