# Staff v6 My issues, rebuilt on Nate's picks of 25 Oct (R-336 walk 3; staff6/myviews.js): Coverage by default, then
# Deadlines, Status, Topics and Spreadsheet behind one remembered switch. Checks, on the busiest practice day (Mon 16 Mar
# 2026):
#   - the three counts on top match the practice data, counted here on their own (HB / SB bills on HIPHI's side still alive);
#   - an issue with one chamber's bill past the next deadline and the other's not reads as a split (its sentence and cells);
#   - each view draws, with no page error, and the choice is remembered after a reload;
#   - the filter box finds an issue by a word and by a bill number; "N bills on your issues have no owner yet · Take one";
#   - the spreadsheet sorts and copies; a phone has the select, the deadline tabs move the board, and nothing scrolls sideways;
#   - someone with no issue (Saya) still sees their coalitions; the calm budgets of staff6_budget.py hold on every view.
#   V4_ROOT=/path/to/worktree python3 tests/staff6_myissues.py [--shots DIR]
import os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import staff6_lib as L

SHOTS = sys.argv[sys.argv.index('--shots') + 1] if '--shots' in sys.argv else ''
VIEWS = ['cover', 'deadlines', 'status', 'topics', 'sheet']

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
TILES = "() => [...document.querySelectorAll('.mi-tile')].map(t => [t.querySelector('.mi-tn').innerText.trim(), t.querySelector('.mi-tw').innerText.trim()])"
PICK = """v => { const b = document.querySelector(`[data-miview=${v}]`), s = document.querySelector('[data-misel]');
  if (b && b.offsetParent) b.click(); else if (s) { s.value = v; s.dispatchEvent(new Event('change')); } }"""
PRESSED = "() => (document.querySelector('[data-miview][aria-pressed=true]') || {}).dataset?.miview || document.querySelector('[data-misel]')?.value"
SPLITS = r"""() => [...document.querySelectorAll('a.mi-cov')].map(a => { const cells = [...a.querySelectorAll('.mi-cell')];
  return { name: a.querySelector('.mi-name').firstChild.textContent.trim(), health: a.querySelector('.mi-cvt .mi-ln').innerText.trim(),
    ok: cells.map(c => c.classList.contains('ok')), off: cells.map(c => c.classList.contains('off')), cells: cells.map(c => c.innerText.replace(/\s+/g, ' ').trim()) }; })"""
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
    R.check('opens on Coverage', pg.page.evaluate(PRESSED) == 'cover', pg.page.evaluate(PRESSED))
    want, tiles = pg.page.evaluate(COUNT), pg.page.evaluate(TILES)
    got = {('both' if 'both' in w else 'one' if 'one' in w else 'stopped'): int(n) for n, w in tiles}
    R.check('the three counts match the data (both chambers / one / stopped)', got == {k: want[k] for k in ('both', 'one', 'stopped')}, f'shown {got}, data {want}')
    R.check('the counts are the issues: both + one + stopped + opposed = every issue', sum(got.values()) + want['opp'] == pg.page.evaluate("async () => (await import('/staff6/data.js')).myIssueIds().size"))
    items = pg.page.evaluate(SPLITS)
    split = [x for x in items if not any(x['off']) and x['ok'].count(True) == 1]
    R.check('a split-chamber issue exists in the practice data (one chamber past the next deadline, the other not)', bool(split), [x['name'] for x in split][:3])
    R.check('every split issue says "Split:" and names which chamber is past', all(x['health'].startswith('Split:') and ' past ' in x['health'] for x in split), [x['health'] for x in split][:2])
    R.check('in a split, the cleared cell says "Past ..." and the other what it still needs', all(any('Past ' in c for c, o in zip(x['cells'], x['ok']) if o) and any(re.search(r'Needs a|Hearing|Heard|floor vote|must agree', c) for c, o in zip(x['cells'], x['ok']) if not o) for x in split), split[:1])
    R.check('cells head "Started in the House" and "Started in the Senate" and say where each bill is now', all(x['cells'][0].startswith('Started in the House') and x['cells'][1].startswith('Started in the Senate') for x in items)
            and any(' now in Senate ' in x['cells'][0] for x in items), items[0]['cells'] if items else None)
    R.check('every issue item links to its issue page', pg.page.evaluate("() => [...document.querySelectorAll('a.mi-cov')].every(a => /^#\\/issue\\/.+\\?from=mine$/.test(a.getAttribute('href')))"))
    R.check('stopped issues are in a closed fold', pg.page.evaluate("() => { const d = document.querySelector('details.mi-stopped'); return !!d && !d.open; }"))
    line = pg.text('.i6-lines') if pg.page.query_selector('.i6-lines') else ''
    R.check('"N bills on your issues have no owner yet · Take one" is kept', bool(re.search(r'\d+ bills? on your issues? (has|have) no owner yet', line)) and 'Take' in line, line[:80])
    pg.page.click('[data-mi="unowned"]'); pg.page.wait_for_timeout(500)
    R.check('Take one opens the bills with no owner', pg.page.evaluate("() => !!document.querySelector('dialog[open] [data-mitake]')"))
    pg.page.keyboard.press('Escape'); pg.page.wait_for_timeout(400)
    budgets(R, pg, 'Coverage 1440'); shot(pg, 'NT-cover-1440.png')
    for v in VIEWS[1:]:
      e0 = len(pg.errors); pg.page.evaluate(PICK, v); pg.page.wait_for_timeout(500)
      ok = {'deadlines': "() => document.querySelectorAll('.mi-col').length >= 2 && !!document.querySelector('.mi-past')",
            'status': "() => [...document.querySelectorAll('main h2')].map(h => h.innerText).join('|').includes('Needs you') && !!document.querySelector('.mi-def')",
            'topics': "() => document.querySelectorAll('.mi-shelf').length >= 2 && document.querySelectorAll('[data-mijump]').length >= 2",
            'sheet': "() => document.querySelectorAll('.mi-tbl tbody tr').length"}[v]
      r = pg.page.evaluate(ok)
      if v == 'sheet': r = r == pg.page.evaluate("async () => (await import('/staff6/data.js')).myIssueIds().size")
      R.check(f'{v} draws, without a page error', bool(r) and len(pg.errors) == e0, pg.errors[e0:][:1])
      budgets(R, pg, f'{v} 1440'); shot(pg, f'NT-{v}-1440.png')
    # Status: On track is never At risk (the definitions say why)
    pg.page.evaluate(PICK, 'status'); pg.page.wait_for_timeout(300)
    R.check('Status: no On track issue reads At risk', pg.page.evaluate("() => ![...document.querySelectorAll('#mi-s-ok ~ .i6-list .mi-dl')].some(e => /^At risk/.test(e.innerText.trim()))"))
    # the spreadsheet sorts and copies
    pg.page.evaluate(PICK, 'sheet'); pg.page.wait_for_timeout(300)
    pg.page.click('[data-misort="deadline"]'); pg.page.wait_for_timeout(300)
    R.check('the spreadsheet sorts by a heading', pg.page.evaluate("() => document.querySelector('th.mi-th-deadline').getAttribute('aria-sort')") == 'ascending')
    pg.page.click('[data-micopy]'); pg.page.wait_for_timeout(400)
    clip = pg.page.evaluate("async () => { try { return await navigator.clipboard.readText(); } catch (e) { return 'ERR ' + e; } }")
    R.check('Copy for Google Sheets copies a header and one row per issue', clip.startswith('Issue\tAlive, started in the House\tAlive, started in the Senate') and clip.count('\n') == pg.page.evaluate("async () => (await import('/staff6/data.js')).myIssueIds().size"), clip[:60])
    # remembered
    pg.page.evaluate(PICK, 'status'); pg.page.wait_for_timeout(300); pg.open('/my-issues')
    R.check('the view is remembered after a reload', pg.page.evaluate(PRESSED) == 'status', pg.page.evaluate(PRESSED))
    pg.page.evaluate(PICK, 'cover'); pg.page.wait_for_timeout(300)
    # the filter box
    pg.page.fill('#mi-q', 'e-cigarette'); pg.page.wait_for_timeout(400)
    found = pg.text('#mi-q-body')
    R.check('the filter finds an issue by a word', 'Disposable e-cigarette ban' in found and bool(re.search(r'\d+ issues? match', found)), found[:80])
    pg.page.fill('#mi-q', 'HB 2300'); pg.page.wait_for_timeout(400)
    R.check('the filter finds an issue by a bill number', 'More local food in school meals' in pg.text('#mi-q-body'))
    pg.page.click('[data-istq="clear"]'); pg.page.wait_for_timeout(300)
    R.check('clearing the filter brings the view back', bool(pg.page.query_selector('.mi-tiles')))
    R.check('no page errors as Nate on a laptop', not pg.errors, pg.errors[:2])
    pg.close()

    # ---- Nate on a phone ----
    ph = b.page('NT', 390, 844); ph.open('/my-issues')
    R.check('phone: the switch is a select, the buttons hidden', ph.page.evaluate("() => !!document.querySelector('[data-misel]').offsetParent && !document.querySelector('.mi-seg').offsetParent"))
    for v in VIEWS:
      ph.page.evaluate(PICK, v); ph.page.wait_for_timeout(500)
      R.check(f'phone {v}: no sideways scroll', not ph.page.evaluate(HSCROLL))
      budgets(R, ph, f'{v} 390'); shot(ph, f'NT-{v}-390.png')
    ph.page.evaluate(PICK, 'deadlines'); ph.page.wait_for_timeout(400)
    tabs = ph.page.query_selector_all('[data-micol]')
    if len(tabs) > 1:
      tabs[1].click(); ph.page.wait_for_timeout(900)
      R.check('phone: a deadline tab slides the board to its column', ph.page.evaluate("() => document.querySelector('[data-miboard]').scrollLeft > 100") and tabs[1].get_attribute('aria-pressed') == 'true')
    else: R.check('phone: deadline tabs', False, 'fewer than two columns')
    ph.page.evaluate(PICK, 'cover'); ph.page.wait_for_timeout(300)
    R.check('phone: the counts sit above the first issue', ph.page.evaluate("() => document.querySelector('.mi-tiles').getBoundingClientRect().bottom < document.querySelector('a.mi-cov').getBoundingClientRect().top"))
    R.check('no page errors as Nate on a phone', not ph.errors, ph.errors[:2])
    ph.close()

    # ---- someone with no issues: their coalitions (Saya) ----
    for w, h in ((1440, 900), (390, 844)):
      sy = b.page('SY', w, h); sy.open('/my-issues')
      R.check(f'Saya ({w}): no issues, so her coalitions show and no switch', not sy.page.query_selector('[data-miview], [data-misel]') and bool(sy.page.query_selector('main')) and 'My issues' in sy.text(), sy.text()[:80])
      shot(sy, f'SY-{w}.png'); R.check(f'Saya ({w}): no page errors', not sy.errors, sy.errors[:2]); sy.close()
  R.done()

if __name__ == '__main__': main()
