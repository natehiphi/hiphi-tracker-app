# Staff v6 My issues, on Nate's picks of 25 Oct (R-336 walks 3 and 4; staff6/myviews.js) made calmer on 27 Oct (R-352
# part 4: "keep the cards, calmer"; A-14, A-18 and C-14 on v6): Deadlines by default, then Status, behind one remembered
# two-button switch (Topics and the issue Spreadsheet went). Checks, on the busiest practice day (Mon 16 Mar 2026):
#   - two views; a saved "topics", "sheet" or walk 3's "cover" opens Deadlines; the choice is remembered after a reload;
#   - no counts line and no "Needs you" chip; no icon tiles or tinted bands; one small drawing beside each name;
#   - "Needs you today" first, and every issue is drawn once on the page (A-14), counted against the data;
#   - a heading a deadline, in date order, each with its count; every issue under the deadline issuestand.js says it must
#     beat next; the heading's plain-words line is kept;
#   - every row has a House and a Senate cell, each one short thing ("House: hearing today", "Senate: none alive"), the
#     House cell holding only House-started bills; a split (one chamber cleared, the other not) exists;
#   - stopped issues last, in a closed fold; the filter box finds an issue by a word and by a bill number;
#     "N bills on your issues have no owner yet · Take one"; a phone keeps the two buttons and nothing scrolls sideways;
#   - someone with no issue (Saya) still sees their coalitions; the calm budgets of staff6_budget.py hold on both views.
#   V4_ROOT=/path/to/worktree python3 tests/staff6_myissues.py [--shots DIR]
import os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import staff6_lib as L

SHOTS = sys.argv[sys.argv.index('--shots') + 1] if '--shots' in sys.argv else ''
VIEWS = ['deadlines', 'status']

# Each heading: its date, its count, and its rows, each with the deadline issuestand.js's standOf gives that issue.
HEADS = r"""async () => { const d = await import('/staff6/data.js'), st = await import('/staff6/issuestand.js');
  return [...document.querySelectorAll('section.mi-dsec')].map(sec => ({ date: sec.dataset.dl, head: sec.querySelector('h2').innerText.replace(/\s+/g, ' ').trim(), sub: (sec.querySelector('.mi-sub') || {}).innerText || '',
    rows: [...sec.querySelectorAll('a.mi-cov')].map(a => { const i = d.S.issues.find(x => String(x.id) === a.dataset.mirow), x = st.standOf(i);
      return { name: i.name, want: (x.deadline || {}).date || null }; }) })); }"""
ROWS = r"""() => [...document.querySelectorAll('a.mi-cov')].map(a => { const cells = [...a.querySelectorAll('.mi-cell')];
  return { name: a.querySelector('.mi-nm').textContent.trim(), ok: cells.map(c => c.classList.contains('ok')), off: cells.map(c => c.classList.contains('no')),
    cells: cells.map(c => c.innerText.replace(/\s+/g, ' ').trim()), titles: cells.map(c => c.getAttribute('title') || ''), nums: cells.map(c => (c.getAttribute('title') || '').split('; ').filter(Boolean).map(s => s.split(',')[0].trim())) }; })"""
# Every issue on the page, once: the cards and the stopped fold's rows, by issue id.
ONCE = r"""async () => { const d = await import('/staff6/data.js'); const ids = [...document.querySelectorAll('#mi-q-body a.mi-cov')].map(a => a.dataset.mirow)
    .concat([...document.querySelectorAll('#mi-q-body details.mi-stopped [data-v6row]')].map(r => r.dataset.v6row));
  return { shown: ids.length, unique: new Set(ids).size, want: d.myIssueIds().size }; }"""
PICK = """v => document.querySelector(`[data-miview=${v}]`).click()"""
PRESSED = "() => (document.querySelector('[data-miview][aria-pressed=true]') || {}).dataset?.miview"
HSCROLL = '() => document.scrollingElement.scrollWidth > innerWidth + 1'
CALM = r"""() => ({ chips: document.querySelectorAll('#mi-q-body .mi-need').length, sum: !!document.querySelector('.mi-sum'),
  tiles: [...document.querySelectorAll('#mi-q-body .mi-tic, #mi-q-body .i6-lead, #mi-q-body .mi-tile')].filter(e => { const c = getComputedStyle(e).backgroundColor; return c && c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent'; }).length,
  tinted: [...document.querySelectorAll('#mi-q-body section')].filter(s => { const c = getComputedStyle(s).backgroundColor; return c && c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent'; }).length,
  icons: [...document.querySelectorAll('#mi-q-body a.mi-cov, #mi-q-body .mi-srow')].every(r => r.querySelectorAll('.mi-ic').length === 1) })"""

def budgets(R, pg, label):
  m = pg.measure()
  R.check(f'{label}: text at 14px or under <= 30%', m['small_pct'] <= 30, f"{m['small_pct']}%")
  R.check(f'{label}: bold text <= 25%', m['bold_pct'] <= 25, f"{m['bold_pct']}%")
  R.check(f'{label}: text colours <= 5', m['colors'] <= 5, m['colors'])
  R.check(f'{label}: bordered elements <= 8', m['bordered'] <= 8, m['bordered'])
  R.check(f'{label}: corner radii <= 3', m['radii'] <= 3, f"{m['radii']} {m.get('radii_where')}")
  R.check(f'{label}: facts per row <= 4, buttons per row <= 1, no codes in rows', m['facts_max'] <= 4 and m['row_buttons_max'] <= 1 and m['row_codes'] == 0,
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
    R.check('opens on Deadlines (the default), two views: Deadlines and Status', pg.page.evaluate(PRESSED) == 'deadlines' and pg.page.evaluate("() => [...document.querySelectorAll('[data-miview]')].map(b => b.innerText.trim()).join('|')") == 'Deadlines|Status', pg.page.evaluate(PRESSED))
    R.check('the switch has no icons and there is no select', pg.page.evaluate("() => !document.querySelector('.mi-seg svg') && !document.querySelector('[data-misel]')"))
    calm = pg.page.evaluate(CALM)
    R.check('no counts line, no "Needs you" chip, no icon tiles, no tinted sections; one small drawing beside each name', not calm['sum'] and calm['chips'] == 0 and calm['tiles'] == 0 and calm['tinted'] == 0 and calm['icons'], calm)
    once = pg.page.evaluate(ONCE)
    R.check('every issue is drawn once on the page (A-14): none twice, none missing', once['shown'] == once['unique'] == once['want'], once)
    R.check('"Needs you today" comes first, as the same cards', pg.page.evaluate("() => { const t = document.querySelector('#mi-q-body > section.mi-today'), s = document.querySelector('section.mi-dsec'); return !!t && t === document.querySelector('#mi-q-body > section') && t.querySelectorAll('a.mi-cov .mi-cell').length >= 2 && t.getBoundingClientRect().bottom < s.getBoundingClientRect().top; }"))
    heads = pg.page.evaluate(HEADS)
    dates = [h['date'] for h in heads]
    R.check('a heading a deadline, at least two, in date order', len(heads) >= 2 and dates == sorted(dates) and len(set(dates)) == len(dates), dates)
    R.check('each heading says "Must clear", its day and its count of issues, and the count is its rows', all(h['head'].startswith('Must clear ') and re.search(r'\d+/\d+', h['head']) and re.search(rf"\b{len(h['rows'])} issues?\b", h['head']) for h in heads), [h['head'] for h in heads])
    R.check('each heading keeps its plain-words line (what the deadline asks)', all(len(h['sub']) > 15 for h in heads), [h['sub'] for h in heads])
    R.check('every issue stands under the deadline it must beat next (issuestand.js standOf)', all(r['want'] == h['date'] for h in heads for r in h['rows']), [(r['name'], r['want'], h['date']) for h in heads for r in h['rows'] if r['want'] != h['date']][:3])
    items = pg.page.evaluate(ROWS)
    R.check('every row has two cells, "House:" then "Senate:"', bool(items) and all(len(x['cells']) == 2 and x['cells'][0].startswith('House:') and x['cells'][1].startswith('Senate:') for x in items), items[0]['cells'] if items else None)
    R.check('each cell says one short thing (no "·", 32 characters at most)', all('·' not in c and len(c) <= 32 for x in items for c in x['cells']), [c for x in items for c in x['cells'] if '·' in c or len(c) > 32][:3])
    R.check('House cells hold only House-started bills, Senate cells only Senate-started ones (the title names them)', all(all(n.startswith('H') for n in x['nums'][0]) and all(n.startswith('S') for n in x['nums'][1]) for x in items))
    R.check('a ring cell says "none alive"; a tick cell says "cleared"; a dot cell says neither', all((c.endswith('none alive')) == o and (not k or c.endswith('cleared')) and (o or k or not c.endswith('cleared')) for x in items for c, o, k in zip(x['cells'], x['off'], x['ok'])), [x['cells'] for x in items][:2])
    split = [x for x in items if not any(x['off']) and x['ok'].count(True) == 1]
    R.check('a split exists (one chamber cleared its heading\'s deadline, the other not yet)', bool(split), [x['name'] for x in items][:3])
    R.check('an issue with no backup bill shows plainly: some rows have one ring cell', any(x['off'].count(True) == 1 for x in items))
    R.check('a crossed-over bill says where it is now, in its cell\'s title ("now in the Senate")', any('now in the ' in t for x in items for t in x['titles']))
    R.check('stopped issues come last, in a closed fold that says how many', pg.page.evaluate("() => { const d = document.querySelector('details.mi-stopped'), b = document.querySelector('#mi-q-body'); return !!d && !d.open && b.lastElementChild === d && /^\\d+ stopped/.test(d.querySelector('summary').innerText.trim()); }"))
    R.check('every issue row links to its issue page', pg.page.evaluate("() => [...document.querySelectorAll('a.mi-cov')].every(a => /^#\\/issue\\/.+\\?from=mine$/.test(a.getAttribute('href')))"))
    line = pg.text('.i6-lines') if pg.page.query_selector('.i6-lines') else ''
    R.check('"N bills on your issues have no owner yet · Take one" is kept', bool(re.search(r'\d+ bills? on your issues? (has|have) no owner yet', line)) and 'Take' in line, line[:80])
    pg.page.click('[data-mi="unowned"]'); pg.page.wait_for_timeout(500)
    R.check('Take one opens the bills with no owner', pg.page.evaluate("() => !!document.querySelector('dialog[open] [data-mitake]')"))
    pg.page.keyboard.press('Escape'); pg.page.wait_for_timeout(400)
    budgets(R, pg, 'deadlines 1440'); shot(pg, 'NT-deadlines-1440.png')
    e0 = len(pg.errors); pg.page.evaluate(PICK, 'status'); pg.page.wait_for_timeout(500)
    R.check('status draws, without a page error', pg.page.evaluate("() => [...document.querySelectorAll('main h2')].map(h => h.innerText).join('|').includes('Needs you') && !!document.querySelector('.mi-def')") and len(pg.errors) == e0, pg.errors[e0:][:1])
    calm = pg.page.evaluate(CALM)
    R.check('Status: no icon tiles; one small drawing beside each name', calm['tiles'] == 0 and calm['icons'], calm)
    budgets(R, pg, 'status 1440'); shot(pg, 'NT-status-1440.png')
    R.check('Status: no On track issue reads At risk', pg.page.evaluate("() => ![...document.querySelectorAll('#mi-s-ok ~ .i6-list .mi-dl')].some(e => /^At risk/.test(e.innerText.trim()))"))
    R.check('Status: an At risk row names bills that need a hearing, never one that has a hearing', pg.page.evaluate("() => [...document.querySelectorAll('.mi-dl')].filter(e => /^At risk/.test(e.innerText.trim())).every(e => !/has a hearing|have a hearing/.test(e.innerText))"))
    # remembered
    pg.open('/my-issues')
    R.check('the view is remembered after a reload', pg.page.evaluate(PRESSED) == 'status', pg.page.evaluate(PRESSED))
    # a dropped view (Topics, Spreadsheet) or walk 3's "cover", from this browser or from the person's prefs, opens Deadlines
    for old in ('topics', 'sheet', 'cover'):
      e0 = len(pg.errors)
      pg.page.evaluate("async (v) => { const d = await import('/staff6/data.js'); localStorage.setItem(`hiphi6_miview_${d.S.me.id}_demo`, v); d.S.me.prefs = { ...(d.S.me.prefs || {}), myIssuesView: v }; d.S.miView = null; d.hooks.render(); }", old); pg.page.wait_for_timeout(400)
      R.check(f'a saved "{old}" opens the Deadlines view, with no page error', pg.page.evaluate(PRESSED) == 'deadlines' and bool(pg.page.query_selector('section.mi-dsec')) and len(pg.errors) == e0, (pg.page.evaluate(PRESSED), pg.errors[e0:][:1]))
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
    ph.page.evaluate("() => { try { localStorage.clear(); } catch {} }"); ph.open('/my-issues')
    R.check('phone: the switch is the same two buttons, in view', ph.page.evaluate("() => [...document.querySelectorAll('[data-miview]')].filter(b => b.offsetParent).length === 2"))
    for v in VIEWS:
      ph.page.evaluate(PICK, v); ph.page.wait_for_timeout(500)
      R.check(f'phone {v}: no sideways scroll', not ph.page.evaluate(HSCROLL))
      budgets(R, ph, f'{v} 390'); shot(ph, f'NT-{v}-390.png')
    ph.page.evaluate(PICK, 'deadlines'); ph.page.wait_for_timeout(300)
    hs = ph.page.evaluate("() => [...document.querySelectorAll('a.mi-cov')].map(a => Math.round(a.getBoundingClientRect().height)).sort((x, y) => x - y)")
    R.check('phone: a row is short (the median under 160px; the tallest said)', bool(hs) and hs[len(hs) // 2] < 160, f'median {hs[len(hs) // 2] if hs else None}, tallest {hs[-1] if hs else None}')
    R.check('phone: the two cells sit side by side under each issue', ph.page.evaluate("() => [...document.querySelectorAll('a.mi-cov')].every(a => { const [h, s] = a.querySelectorAll('.mi-cell'); return Math.abs(h.getBoundingClientRect().top - s.getBoundingClientRect().top) < 2 && h.getBoundingClientRect().right <= s.getBoundingClientRect().left; })"))
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
