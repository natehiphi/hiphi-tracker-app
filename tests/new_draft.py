# "A new draft" on My issues and the issue page (R-212 Tier 2 #50, Nate's yes of 25 Oct; pub/newdraft.js), in the practice
# copy (frozen at Mon 16 Mar 2026, 9:00 HST), phone 390x844 and laptop 1366x900. Most of its bills got their latest draft on
# 5-6 March (the decking deadline), ten days before its clock, so "new" needs a last visit before then (hiphi_onb lastVisit, 2
# March here); ?letter plants a testimony letter on HB 2121 written for House draft 1 (docs/FEATURES.md, R-148).
#   N1  My issues, last visit 2 Mar: an issue with two changed bills says "New drafts of HB 2121 and SB 2175" and opens the
#       issue's page; three, "New drafts of HB 1839 and 2 more bills"; one, "New draft of HB 1671 · Mar 6" and opens
#       #/bill/2026/HB1671/changes; an issue with none has no line; a bill followed on its own says "New draft · Mar 6" (its
#       number is on the row already, A-14). Each line is its own link beside the row's link in the same <li> (never inside
#       it), 44px tall (A-6), in the status line's size (A-4), link blue (never amber, A-5), with an accessible name that says
#       the bill and where it goes; beside its words a tap still opens the row (no dead strip); the rows' own names, words and
#       order are Home's (calm/home.js myRows), untouched.
#   N2  while editing, no line
#   N3  the letter case, no recent visit: "Your letter is for an older draft of HB 2121" (the date window alone would show nothing);
#       a letter on SB 2175 as well names the letter's bills first
#   N4  the issue page: each changed bill's row is marked ("Your letter is for an older draft", "New draft · Mar 6"), the same
#       link to its /changes
#   N5  between sessions (&season=off): no line anywhere
#   N6  the links: tapping the one-bill line lands on that bill's drafts, and again when tapped again after Back; the
#       two-bill line opens the issue's page
#   N7  #/bill/<year>/<NUM>/changes: on the calm page "About the bill" opens at "What each draft changed" when HIPHI has a note
#       on the current draft (HB 2121), else "More details" at "Drafts of the bill" on the current draft's row (HB 1671); with
#       ?rec=0 "Draft history", else More details. In view, focused, no toast, and the folds a person keeps open on this
#       device (hiphi_recfold) are left exactly as they were; the short form #/bill/HB2121/changes works too
#   N8  the honesty rule, on newdraft.js with made-up official lines: a draft named on the bill's earliest line in hand is not
#       new; the report that made it after an earlier line is; a draft first named by a repeat (a floor vote) is not; HD 21 is
#       not HD2; outside the window it is not new unless a letter was written for an older draft; a twin's letter does not count,
#       nor a letter on a bill that can no longer move
#   N9  no page errors
#   python3 tests/new_draft.py [base] [outdir]    base defaults to http://localhost:8832; pictures go to [outdir]
import json, os, re, sys
from playwright.sync_api import sync_playwright
BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832').rstrip('/')
if BASE.endswith('.html'): BASE = BASE.rsplit('/', 1)[0]
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out', 'new_draft')
os.makedirs(OUT, exist_ok=True)
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SNAP = json.load(open(os.path.join(ROOT, 'demo', 'snapshot.json')))
ID = {b['bill_number']: b['id'] for b in SNAP['bills']}
ISS = {i['slug']: i['id'] for i in SNAP['issues']}
res = []
def ok(c, m): res.append(bool(c)); print('PASS' if c else 'FAIL', m)

# A follower of four issues (two changed bills, three, one, none) and one bill on its own (HB 1850, on no issue they follow).
FOLLOWS = [ISS['disposable-e-cigarette-ban'], ISS['safety-for-immigrant-families'], ISS['hygienists-temporary-fillings'], ISS['free-bus-rides-for-kids']]
def scene(last=None, letters=None, folds=None):
    extra = ''
    if last: extra += f"set('hiphi_onb', {{ lastVisit: {json.dumps(last)} }});"
    if letters: extra += f"set('hiphi_me', {{ letters: {json.dumps(letters)} }});"
    if folds is not None: extra += f"set('hiphi_recfold', {json.dumps(folds)});"
    return f"""(() => {{ if (sessionStorage.getItem('__set')) return; sessionStorage.setItem('__set', '1');
  for (const k of Object.keys(localStorage)) if (k.startsWith('hiphi_')) localStorage.removeItem(k);
  const set = (k, v) => localStorage.setItem(k + '_demo', typeof v === 'string' ? v : JSON.stringify(v));
  set('hiphi_issue_follows', {json.dumps(FOLLOWS)}); set('hiphi_watch_ids', {json.dumps([ID['HB1850']])}); set('hiphi_cat_follows', []); set('hiphi_skips', []);
  set('hiphi_wiz', {{ done: true, issues: ['tobacco'], name: 'Kalani' }}); set('hiphi_done', []); set('hiphi_done_at', {{}}); set('hiphi_stances', {{}}); set('hiphi_demo_seeded', '1');
  localStorage.setItem('hiphi_tour_home_demo', '{{"how":"test"}}'); localStorage.setItem('hiphi_tour_bill_demo', '{{"how":"test"}}');
  {extra}
}})();"""
def letter(num, draft):   # a kept testimony letter, as keepLetter writes one (letters.js)
    return {ID[num]: {'v': 1, 'bill': ID[num], 'num': num, 'yr': 2026, 'h': 'x', 'code': 'X', 'at': '2026-02-18T10:00:00-10:00', 'sent': '2026-02-17T10:00:00-10:00',
            'draft': draft, 'stance': 'support', 'ours': False, 'name': 'Kalani', 'why': '', 'points': [], 'letter': '', 'edited': False}}
LAST = '2026-03-02T19:00:00.000Z'

# Each line and the row it sits under: words, where it goes, its name, its box, and that it is a sibling of the row's link.
LINES = """(sel) => [...document.querySelectorAll(sel)].map(li => { const a = li.querySelector(':scope > a.rc-row'), d = li.querySelector('.rc-draft');
  const name = a && a.querySelector('.rc-rname').cloneNode(true); name?.querySelectorAll('.sr').forEach(e => e.remove());
  const st = a && a.querySelector('.rc-rstat'), r = d && d.getBoundingClientRect();
  return { name: (name?.textContent || '').trim(), stat: (st?.textContent || '').replace(/\\u00a0/g, ' ').trim(),
    line: d ? d.textContent.replace(/\\u00a0/g, ' ').trim() : '', href: d ? d.getAttribute('href') : '', label: d ? d.getAttribute('aria-label') || '' : '',
    h: r ? r.height : 0, w: r ? r.width : 0, sib: !!d && !d.closest('a.rc-row') && d.parentElement === li && !!a, n: li.querySelectorAll('.rc-draft').length,
    size: d ? getComputedStyle(d).fontSize : '', statSize: st ? getComputedStyle(st).fontSize : '', color: d ? getComputedStyle(d).color : '' }; })"""
BLUE = 'rgb(0, 105, 142)'   # --p700, the links' blue (pub/base.css)
def row(rows, name): return next((r for r in rows if r['name'].startswith(name)), None)

with sync_playwright() as p:
    br = p.chromium.launch(); errs = []
    def page(init, w, h):
        c = br.new_context(viewport={'width': w, 'height': h}, is_mobile=(w < 600), has_touch=(w < 600)); c.add_init_script(init)
        pg = c.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)[:200])); return c, pg
    def mine(pg, q=''):
        pg.goto(f'{BASE}/track.html?demo=1{q}#/bills'); pg.wait_for_selector('.rc-mine .rc-mrows, .rc-mine', timeout=60000); pg.wait_for_timeout(2500)
        return pg.evaluate(LINES, '.rc-mine .rc-mrows > li')
    for w, h, tag in ((390, 844, 'phone'), (1366, 900, 'laptop')):
        # N1 My issues, last visit 2 Mar
        c, pg = page(scene(LAST), w, h); rows = mine(pg)
        two, three, one, none = row(rows, 'Disposable e-cigarette ban'), row(rows, 'Safety for immigrant families'), row(rows, 'Hygienists can place'), row(rows, 'Free bus rides for kids')
        own = next((r for r in rows if r['stat'].startswith('HB 1850')), None)
        ok(two and two['line'] == 'New drafts of HB 2121 and SB 2175' and two['href'] == '#/issue/disposable-e-cigarette-ban', f'N1 {tag}: two changed bills: "{two and two["line"]}" opens the issue’s page')
        ok(three and three['line'] == 'New drafts of HB 1839 and 2 more bills' and three['href'] == '#/issue/safety-for-immigrant-families', f'N1 {tag}: three: "{three and three["line"]}"')
        ok(one and one['line'] == 'New draft of HB 1671 · Mar 6' and one['href'] == '#/bill/2026/HB1671/changes', f'N1 {tag}: one: "{one and one["line"]}" opens {one and one["href"]}')
        ok(none and not none['line'], f'N1 {tag}: an issue with no new draft has no line')
        ok(own and own['line'] == 'New draft · Mar 6' and own['href'] == '#/bill/2026/HB1850/changes', f'N1 {tag}: a bill followed on its own: "{own and own["line"]}" (its number is on the row already)')
        lines = [r for r in rows if r['line']]
        ok(len(lines) == 4 and all(r['sib'] and r['n'] == 1 for r in lines), f'N1 {tag}: each line is its own link beside the row’s, in the same <li>, never inside it ({len(lines)} lines)')
        ok(all(r['h'] >= 44 for r in lines), f'N1 {tag}: each line is at least 44px tall (A-6): {[round(r["h"]) for r in lines]}')
        ok(all(r['size'] == r['statSize'] and r['color'] == BLUE for r in lines), f'N1 {tag}: the status line’s size, link blue, never amber ({lines[0]["size"]}, {lines[0]["color"]})')
        ok(one and one['label'] == 'New draft of HB 1671, Mar 6: see what changed' and own and own['label'] == 'New draft, Mar 6: see what changed in HB 1850'
           and two and two['label'] == 'New drafts of HB 2121 and SB 2175: see them on the page for Disposable e-cigarette ban', f'N1 {tag}: each link’s name says the bill and where it goes ({own and own["label"]!r})')
        # the row's link runs under the line too: beside the line's words a tap opens the row, on them the line (no dead strip)
        cover = pg.evaluate("""() => { const out = [...document.querySelectorAll('.rc-mine .rc-mrows > li > .rc-draft')].map(d => { d.scrollIntoView({ block: 'center' });
          const li = d.parentElement, a = li.querySelector(':scope > a.rc-row'), r = d.getBoundingClientRect(), L = li.getBoundingClientRect();
          const beside = document.elementFromPoint(Math.min(r.right + 24, L.right - 40), r.top + r.height / 2), on = document.elementFromPoint(r.left + 8, r.top + r.height / 2);
          return a.getBoundingClientRect().bottom >= r.bottom - 1 && beside?.closest('a') === a && on?.closest('a') === d; }); scrollTo(0, 0); return out; }""")
        ok(cover and all(cover), f'N1 {tag}: beside a line’s words a tap opens the row, on them the line: no dead strip in the row ({cover})')
        home = pg.evaluate("""async () => { const h = await import('./pub/calm/home.js'); return h.myRows().map(r => [r.name, String(r.text || '')]); }""")
        ok([[r['name'], r['stat']] for r in rows] == [[n, t.replace(' ', ' ')] for n, t in home], f'N1 {tag}: the rows’ own names, words and order are Home’s ({len(rows)} rows)')
        pg.screenshot(path=os.path.join(OUT, f'mine-{tag}.png'), full_page=True)
        # N2 editing
        pg.locator('[data-rc-edit]').click(); pg.wait_for_timeout(500)
        ok(pg.locator('.rc-mine.editing').count() == 1 and pg.locator('.rc-draft').count() == 0, f'N2 {tag}: while editing, no line')
        pg.locator('[data-rc-edit]').click(); pg.wait_for_timeout(500)
        ok(pg.locator('.rc-draft').count() == 4, f'N2 {tag}: Done brings the lines back')
        # N6 the links (the phone taps, the laptop clicks)
        pg.locator('.rc-draft[href="#/bill/2026/HB1671/changes"]').click(); pg.wait_for_selector('.bl-head', timeout=30000); pg.wait_for_timeout(2500)
        st = pg.evaluate("() => ({ hash: location.hash, open: [...document.querySelectorAll('#main details[open]')].map(d => d.dataset.blRfold || d.dataset.blFold), f: document.activeElement?.textContent.trim().slice(0, 40) })")
        ok(st['hash'] == '#/bill/2026/HB1671/changes' and 'more' in st['open'] and 'rd-drafts' in st['open'] and st['f'].startswith('House draft 2'), f'N6 {tag}: the one-bill line lands on HB 1671’s drafts ({st})')
        pg.go_back(); pg.wait_for_selector('.rc-mine', timeout=30000); pg.wait_for_timeout(1000)
        # the same line tapped again later in the visit lands on the drafts again (once per arrival, not once per visit)
        pg.locator('.rc-draft[href="#/bill/2026/HB1671/changes"]').click(); pg.wait_for_selector('.bl-head', timeout=30000); pg.wait_for_timeout(2500)
        st = pg.evaluate("() => ({ y: scrollY, f: document.activeElement?.textContent.trim().slice(0, 40) })")
        ok(st['y'] > 0 and st['f'].startswith('House draft 2'), f'N6 {tag}: tapped again after Back, it lands on the drafts again ({st})')
        pg.go_back(); pg.wait_for_selector('.rc-mine', timeout=30000); pg.wait_for_timeout(1000)
        pg.locator('.rc-draft[href="#/issue/disposable-e-cigarette-ban"]').click(); pg.wait_for_selector('.rc-iss[data-shape]', timeout=30000)
        ok(pg.evaluate('location.hash') == '#/issue/disposable-e-cigarette-ban', f'N6 {tag}: the two-bill line opens the issue’s page')
        c.close()

        # N3 the letter case, no recent visit (the 7-day window alone shows nothing in the practice copy)
        c, pg = page(scene(), w, h); rows = mine(pg, '&letter')
        two = row(rows, 'Disposable e-cigarette ban')
        ok(two and two['line'] == 'Your letter is for an older draft of HB 2121' and two['href'] == '#/bill/2026/HB2121/changes'
           and two['label'] == 'Your letter is for an older draft of HB 2121: see what changed', f'N3 {tag}: the letter case: "{two and two["line"]}"')
        ok([r['line'] for r in rows if r['line']] == ['Your letter is for an older draft of HB 2121'], f'N3 {tag}: nothing else is new inside a week ({[r["line"] for r in rows if r["line"]]})')
        pg.screenshot(path=os.path.join(OUT, f'mine-letter-{tag}.png'), full_page=True)
        c.close()
        # a letter on SB 2175 too (written for Senate draft 1, now Senate draft 2), a visit long ago: the letters' bills first
        c, pg = page(scene(LAST, letters=letter('SB2175', 'SD1')), w, h); rows = mine(pg)
        two = row(rows, 'Disposable e-cigarette ban')
        ok(two and two['line'] == 'New drafts of SB 2175 and HB 2121', f'N3 {tag}: the bill the letter was written on is named first ("{two and two["line"]}")')
        c.close()
        # N4 the issue page, ?letter, last visit 2 Mar: each changed bill marked. (Each page load is a visit: the next one's "last
        # visit" is this one, as for Home's dot, so every check of the date window starts in a fresh browser.)
        c, pg = page(scene(LAST), w, h)
        pg.goto(f'{BASE}/track.html?demo=1&letter#/issue/disposable-e-cigarette-ban'); pg.wait_for_selector('.rc-iss[data-shape]', timeout=60000); pg.wait_for_timeout(2000)
        irows = pg.evaluate(LINES, '.rc-iss .rc-rows > li')
        hb, sb = next((r for r in irows if 'HB 2121' in r['name']), None), next((r for r in irows if 'SB 2175' in r['name']), None)
        ok(hb and hb['line'] == 'Your letter is for an older draft' and hb['href'] == '#/bill/2026/HB2121/changes' and hb['label'] == 'Your letter is for an older draft: see what changed in HB 2121',
           f'N4 {tag}: the issue page marks HB 2121: "{hb and hb["line"]}"')
        ok(sb and sb['line'] == 'New draft · Mar 6' and sb['href'] == '#/bill/2026/SB2175/changes', f'N4 {tag}: and SB 2175: "{sb and sb["line"]}"')
        ok(hb and sb and hb['sib'] and sb['sib'] and hb['h'] >= 44 and sb['h'] >= 44 and hb['color'] == BLUE, f'N4 {tag}: the same link as on My issues (beside the row’s, 44px, link blue)')
        d = pg.locator('.rc-iss .rc-draft').first; d.scroll_into_view_if_needed(); pg.wait_for_timeout(300)
        pg.screenshot(path=os.path.join(OUT, f'issue-{tag}.png'))
        c.close()
        # the issue page with one moving bill: its full-record row is marked
        c, pg = page(scene(LAST), w, h)
        pg.goto(f'{BASE}/track.html?demo=1#/issue/hygienists-temporary-fillings'); pg.wait_for_selector('.rc-iss[data-shape]', timeout=60000); pg.wait_for_timeout(2000)
        irows = pg.evaluate(LINES, '.rc-iss .rc-rows > li')
        rec = next((r for r in irows if r['line']), None)
        ok(rec and rec['name'] == 'HB 1671’s full record' and rec['line'] == 'New draft · Mar 6' and rec['h'] >= 44, f'N4 {tag}: one moving bill: its full record row is marked ({rec and rec["name"]!r})')
        c.close()

        # N5 between sessions: no line anywhere
        c, pg = page(scene(LAST), w, h); mine(pg, '&season=off&letter')
        n1 = pg.locator('.rc-draft').count()
        pg.goto(f'{BASE}/track.html?demo=1&season=off&letter#/issue/disposable-e-cigarette-ban'); pg.wait_for_selector('.rc-iss[data-shape]', timeout=60000); pg.wait_for_timeout(1500)
        ok(n1 == 0 and pg.locator('.rc-draft').count() == 0, f'N5 {tag}: between sessions, no line on My issues or the issue page')
        c.close()

        # N7 #/bill/.../changes: in view, focused, the right fold, no toast, the kept folds untouched
        LAND = """() => { const a = document.activeElement, r = a && a.getBoundingClientRect();
          const bars = [document.querySelector('.hdr'), document.querySelector('.bl-top')].reduce((n, e) => n + (e && /sticky|fixed/.test(getComputedStyle(e).position) ? e.offsetHeight : 0), 0);
          const bar = document.querySelector('.actionbar'), under = bar && bar.getClientRects().length ? bar.getBoundingClientRect().top : innerHeight;
          return { hash: location.hash, open: [...document.querySelectorAll('#main details[open]')].map(d => d.dataset.blRfold || d.dataset.blFold),
            f: a ? a.tagName + ' ' + a.textContent.trim().slice(0, 60) : '', seen: !!r && r.top >= bars - 1 && r.bottom <= under + 1,
            toast: (document.querySelector('#toast')?.innerText || '').trim(), kept: localStorage.getItem('hiphi_recfold') }; }"""
        for num, q, want, focus, name in (('HB2121', '', ['about'], 'H3 What each draft changed', 'changes-calm'), ('HB1671', '', ['more', 'rd-drafts'], 'A House draft 2', 'changes-calm-more'),
                                          ('HB2121', '&rec=0', ['drafts'], 'SUMMARY Draft history', 'changes-rec0'), ('HB1671', '&rec=0', ['more'], 'SUMMARY More details', 'changes-rec0-more')):
            c, pg = page(scene(folds=['who']), w, h)
            pg.goto(f'{BASE}/track.html?demo=1{q}#/bill/2026/{num}/changes'); pg.wait_for_selector('.bl-head', timeout=60000); pg.wait_for_timeout(2000)
            s = pg.evaluate(LAND); pg.wait_for_timeout(2000); s2 = pg.evaluate(LAND)
            page_ = 'the calm page' if not q else '?rec=0'
            ok(all(x in s['open'] for x in want) and s['f'].startswith(focus) and s['seen'], f'N7 {tag}: {num}/changes on {page_}: {want} open, "{focus}" focused and in view ({s["open"]}, {s["f"][:40]!r}, seen {s["seen"]})')
            ok(not s['toast'] and not s2['toast'] and s2['open'] == s['open'] and s2['f'] == s['f'], f'N7 {tag}: {num} on {page_}: no toast, and still so two seconds later')
            ok(s2['kept'] == '["who"]', f'N7 {tag}: {num} on {page_}: the folds kept on this device are as they were ({s2["kept"]})')
            if name in ('changes-calm', 'changes-rec0') and (tag == 'laptop' or name == 'changes-calm'): pg.screenshot(path=os.path.join(OUT, f'{name}-{tag}.png'))
            if num == 'HB2121' and not q:
                # closed by hand, then the bill again (a later visit): About is closed, nothing was remembered
                pg.locator('details[data-bl-rfold="about"] > summary').click(); pg.wait_for_timeout(300)
                pg.evaluate("location.hash = '#/bill/2026/SB2175'"); pg.wait_for_selector('.bl-head', timeout=30000); pg.wait_for_timeout(800)
                pg.reload(); pg.wait_for_selector('.bl-head', timeout=60000); pg.wait_for_timeout(1500)
                pg.evaluate("location.hash = '#/bill/2026/HB2121'"); pg.wait_for_timeout(1500)
                ok(pg.locator('details[data-bl-rfold="about"][open]').count() == 0 and pg.evaluate("localStorage.getItem('hiphi_recfold')") == '["who"]',
                   f'N7 {tag}: opened by the link and closed by hand, About is closed on the next visit')
            c.close()
        # the short form
        c, pg = page(scene(), w, h)
        pg.goto(f'{BASE}/track.html?demo=1#/bill/HB2121/changes'); pg.wait_for_selector('.bl-head', timeout=60000); pg.wait_for_timeout(2500)
        s = pg.evaluate(LAND)
        ok('about' in s['open'] and s['f'].startswith('H3 What each draft changed') and s['hash'] == '#/bill/2026/HB2121/changes', f'N7 {tag}: #/bill/HB2121/changes works too, and the address names the session ({s["hash"]})')
        c.close()

    # N8 the honesty rule, on newdraft.js with made-up lines (HB 2121 at House draft 2 on Mon 16 Mar, the practice clock)
    c, pg = page(scene(), 390, 844)
    pg.goto(f'{BASE}/track.html?demo=1#/bills'); pg.wait_for_selector('.rc-mine', timeout=60000); pg.wait_for_timeout(2000)
    r = pg.evaluate("""async ([hb, sb]) => {
      const { S } = await import('./pub/core.js'), n = await import('./pub/newdraft.js');
      const b = S.bills.find(x => x.id === hb), keep = S.activity, prev = S.prevVisit, out = {};
      const L = (t, at) => ({ bill_id: hb, title: t, details: 'Official action - House', occurred_at: at });
      const REP = 'Reported from CPC (Stand. Com. Rep. No. 1058-26) as amended in HD 2, recommending passage on Third Reading.';
      const run = (k, lines) => { S.activity = lines.slice().sort((x, y) => y.occurred_at.localeCompare(x.occurred_at)); out[k] = { at: n.draftSeen(b), nd: !!n.newDraft(b) }; };
      S.prevVisit = null;
      run('earliest', [L(REP, '2026-03-12T18:00:00Z'), L('Passed Third Reading as amended in HD 2.', '2026-03-13T18:00:00Z')]);
      run('seen', [L('Bill scheduled to be heard by CPC', '2026-03-09T18:00:00Z'), L(REP, '2026-03-12T18:00:00Z')]);
      run('repeat', [L('Received from Senate (Sen. Com. No. 3).', '2026-03-09T18:00:00Z'), L('Passed Third Reading as amended in HD 2 with none voting no.', '2026-03-12T18:00:00Z')]);
      run('hd21', [L('Introduced.', '2026-03-09T18:00:00Z'), L(REP.replace('HD 2', 'HD 21'), '2026-03-12T18:00:00Z')]);
      run('old', [L('Bill scheduled to be heard by CPC', '2026-02-20T18:00:00Z'), L(REP, '2026-03-02T18:00:00Z')]);
      run('sametime', [L('Forty-eight (48) hours notice', '2026-03-12T18:00:00Z'), L(REP, '2026-03-12T18:00:00Z')]);
      S.prevVisit = '2026-02-26T19:00:00.000Z'; run('oldvisit', [L('Bill scheduled to be heard by CPC', '2026-02-20T18:00:00Z'), L(REP, '2026-03-02T18:00:00Z')]);
      S.prevVisit = '2026-01-01T19:00:00.000Z'; out.cap = Math.round((Date.now() - n.sinceWhen()) / 864e5);
      S.prevVisit = null; out.week = Math.round((Date.now() - n.sinceWhen()) / 864e5);
      // letters: one written for House draft 1 counts outside the window; a twin's (kept under this bill, written on SB 2175) does not
      const me = JSON.parse(localStorage.getItem('hiphi_me') || '{}');
      const put = L2 => localStorage.setItem('hiphi_me', JSON.stringify({ ...me, letters: { [hb]: L2 } }));
      const base = { v: 1, bill: hb, num: 'HB2121', yr: 2026, draft: 'HD1', sent: '2026-02-17T10:00:00-10:00' };
      run('noletter', [L('Bill scheduled to be heard by CPC', '2026-02-20T18:00:00Z'), L(REP, '2026-03-02T18:00:00Z')]);
      put(base); out.letter = n.newDraft(b); out.words = n.draftWords([out.letter]);
      put({ ...base, draft: 'HD2' }); out.sameDraft = !!n.newDraft(b);
      put(base); const stage = b.stage; b.stage = 'enacted'; out.law = !!n.newDraft(b); b.stage = stage;
      put({ ...base, bill: sb, num: 'SB2175' }); out.twin = !!n.newDraft(b);
      localStorage.setItem('hiphi_me', JSON.stringify(me)); S.activity = keep; S.prevVisit = prev;
      return out; }""", [ID['HB2121'], ID['SB2175']])
    ok(r['earliest']['at'] is None and not r['earliest']['nd'], f'N8 the draft named on the bill’s earliest line in hand is not new ({r["earliest"]})')
    ok(r['seen']['at'] == '2026-03-12T18:00:00.000Z' and r['seen']['nd'], f'N8 the report that made it, after an earlier line, dates it and is new ({r["seen"]})')
    ok(r['repeat']['at'] is None and not r['repeat']['nd'], f'N8 a draft first named by a floor vote (a repeat) is not new ({r["repeat"]})')
    ok(r['hd21']['at'] is None, 'N8 "HD 21" is not House draft 2')
    ok(r['old']['at'] and not r['old']['nd'] and r['oldvisit']['nd'], f'N8 14 days ago is not new within the week, and is after a visit 18 days ago ({r["old"]}, {r["oldvisit"]})')
    ok(r['sametime']['at'] is None, 'N8 a line on the same day as the report is not a line from before it')
    ok(r['cap'] == 30 and r['week'] == 7, f'N8 the window: back to the last visit, never past 30 days ({r["cap"]}), else 7 ({r["week"]})')
    ok(r['letter'] and r['letter']['letter'] and r['letter']['at'] and r['words']['text'] == 'Your letter is for an older draft of HB 2121' and not r['noletter']['nd'],
       f'N8 a letter for House draft 1 makes it count outside the window ({r["words"] and r["words"]["text"]!r})')
    ok(not r['sameDraft'] and not r['twin'], 'N8 a letter for the current draft, or a twin’s letter, does not')
    ok(not r['law'], 'N8 nor a letter on a bill that can no longer move (became law): no letter can be sent on it again')
    c.close()

    ok(not errs, f'N9 no page errors ({errs[:2]})')
    br.close()
print(f'{sum(res)}/{len(res)} passed'); sys.exit(0 if all(res) else 1)
