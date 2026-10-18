# The calm Home's budget (R-222 Direction 1, pub/calm/home.js; docs/DESIGN.md A-23), on the practice copy, the layout
# test's 'calm' forced (everyone's Home since 11 Oct), phone (390x844) and laptop (1366x900), for the people compare.html sets up:
#   Kai (3 issues) Monday and Tuesday, Malia (3 issues, a quiet week), Kai right after the first visit, Kai between
#   sessions, Leilani (16 issues) Monday, Tuesday and between sessions.
# In each: at most 4 blocks, of at most 2 shapes (a card, rows); one filled button; each bill named once; on a phone under
# 2 screens for 3 issues and 3 for 16; one row per issue followed; amber only for what is due inside 24 hours (A-5); nothing
# "New" right after the first visit; no sideways scroll; no page errors. Over 8 issues in session (Nate 10/11: "Option number
# 2, but still grouped by status"): the issues under status headings in their order, the first 8 shown, "Show all N" opens
# the rest in place, still grouped, and nothing due is ever below a quiet issue.
#   python3 -m http.server 8832   (in this folder, once)
#   python3 tests/home_calm.py [base]     base defaults to http://localhost:8832
import sys, os, re
from playwright.sync_api import sync_playwright
BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832').rstrip('/')
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'tests', 'out', 'home_calm'); os.makedirs(OUT, exist_ok=True)
src = open(os.path.join(ROOT, 'compare.html')).read()
WHO = src[src.index('const WHO = {'):src.index('const pick =')]   # the same people as the compare page
res = []
def ok(c, m): res.append(bool(c)); print('PASS' if c else 'FAIL', m)
def scene(who, day, welcome=False):
    off = {'mon': 0, 'tue': 1, 'wed': 2}[day]
    return f"""(() => {{ {WHO}
  if (sessionStorage.getItem('__set')) return; sessionStorage.setItem('__set', '1');
  const p = WHO['{who}'], at = Date.parse('2026-03-16T09:00:00-10:00') + {off} * 864e5;
  for (const k of Object.keys(localStorage)) if (k.startsWith('hiphi_')) localStorage.removeItem(k);
  const set = (k, v) => localStorage.setItem(k + '_demo', typeof v === 'string' ? v : JSON.stringify(v));
  set('hiphi_issue_follows', p.issues); set('hiphi_watch_ids', []); set('hiphi_cat_follows', []); set('hiphi_skips', []);
  set('hiphi_wiz', {{ done: true, issues: p.cats, name: p.name{', finale: true' if welcome else ''} }});
  set('hiphi_onb', {{ lastVisit: new Date(at - 14 * 36e5).toISOString() }});
  set('hiphi_done', Object.keys(p.done)); set('hiphi_done_at', p.done); set('hiphi_stances', {{}}); set('hiphi_demo_seeded', '0');
  localStorage.setItem('hiphi_tour_home_demo', '{{"how":"test"}}'); localStorage.setItem('hiphi_tour_bill_demo', '{{"how":"test"}}');
  {"sessionStorage.setItem('hiphi_welcome_demo', '1');" if welcome else ''}
}})();"""
CASES = [('Kai, Monday', 'kai', 'mon', {}, 3), ('Kai, Tuesday', 'kai', 'tue', {}, 3), ('Malia, a quiet week', 'malia', 'mon', {}, 3),
         ('Kai, right after the first visit', 'kai', 'mon', {'welcome': True}, 3), ('Kai, between sessions', 'kai', 'mon', {'off': True}, 3),
         ('Leilani, Monday', 'leilani', 'mon', {}, 16), ('Leilani, Tuesday', 'leilani', 'tue', {}, 16), ('Leilani, between sessions', 'leilani', 'mon', {'off': True}, 16)]
MEASURE = """async () => {
  const main = document.querySelector('#main'), root = main.querySelector('.cm');
  if (!root) return null;
  const vis = e => e.offsetHeight > 0, blocks = [...root.children].filter(vis);
  const shapes = new Set();
  if (root.querySelector('.cm-slide, .acard, .hm-ask, .hm-ready, .goitem, .card')) shapes.add('card');   // the slide (R-295) is the one-thing shape
  if (root.querySelector('.cm-rows')) shapes.add('rows');
  const filled = [...root.querySelectorAll('.btn.primary')].filter(vis).length;
  // Each bill named once: its number, and its nickname outside the issue rows' names (55 of 91 issues share their name
  // with one of their bills, and the issue's name is the row's own heading, A-14 allows that once).
  const { S, nick } = await import('./pub/core.js');
  const names = [...root.querySelectorAll('.cm-rname')].map(e => e.firstChild.textContent.trim());
  let text = root.innerText; for (const n of names) text = text.replace(n, '');
  const twice = [];
  for (const b of S.bills) {
    const num = b.bill_number.replace(/^([A-Z]+)(\\d+)$/, '$1 $2'), nm = nick(b);
    const c1 = text.split(num).length - 1, c2 = nm && nm.length > 8 ? text.split(nm).length - 1 : 0;
    if (c1 > 1 || c2 > 1) twice.push(`${num} ${nm || ''} (${c1}, ${c2})`);
  }
  const warn = [...root.querySelectorAll('.cm-rstat.warn')].map(e => e.innerText.trim());
  // a row never says its own issue's name again under it (the review of R-222: "Disposable e-cigarette ban (SB 2175) became law")
  const selfnamed = [...root.querySelectorAll('.cm-row')].filter(r => { const n = r.querySelector('.cm-rname').firstChild.textContent.trim(), t = r.querySelector('.cm-rstat').innerText;
    return n.length > 8 && t.includes(n); }).map(r => r.querySelector('.cm-rname').firstChild.textContent.trim());
  return { blocks: blocks.length, kinds: blocks.map(e => e.className.split(' ')[0]).join(','), shapes: [...shapes], filled, twice,
    h: Math.round(main.scrollHeight), rows: root.querySelectorAll('.cm-rows .cm-row').length, fresh: root.querySelectorAll('.cm-new').length,
    warn, selfnamed, wide: document.documentElement.scrollWidth > window.innerWidth + 1,
    groups: [...root.querySelectorAll('.cm-gh')].map(e => e.firstChild.textContent.trim()), shown: [...root.querySelectorAll('.cm-rows .cm-row')].filter(vis).length,
    showall: [...root.querySelectorAll('[data-cm-showall]')].map(e => e.innerText.trim()) };
}"""
with sync_playwright() as pw:
    br = pw.chromium.launch()
    for size, (w, h) in [('phone', (390, 844)), ('laptop', (1366, 900))]:
        for label, who, day, o, n in CASES:
            ctx = br.new_context(viewport={'width': w, 'height': h}, is_mobile=size == 'phone', has_touch=size == 'phone')
            ctx.add_init_script("Object.defineProperty(Navigator.prototype,'globalPrivacyControl',{get:()=>true});")
            ctx.add_init_script(scene(who, day, o.get('welcome', False)))
            pg = ctx.new_page(); errs = []
            pg.on('pageerror', lambda e: errs.append(str(e)))
            pg.goto(f"{BASE}/track.html?demo=1{'' if day == 'mon' else '&day=' + day}&abrest=today&ab=layout.calm{'&season=off' if o.get('off') else ''}#/")
            pg.wait_for_function("() => !!document.querySelector('#main .cm, #main .hm') && !document.querySelector('.skelpage')", timeout=60000); pg.wait_for_timeout(1500)
            m = pg.evaluate(MEASURE); tag = f'{size} {label}'
            ok(m is not None, f'{tag}: the calm Home is drawn')
            if m is None: ctx.close(); continue
            ok(m['blocks'] <= 4, f"{tag}: at most 4 blocks ({m['blocks']}: {m['kinds']})")
            ok(len(m['shapes']) <= 2, f"{tag}: at most 2 shapes ({m['shapes']})")
            ok(m['filled'] == 1, f"{tag}: one filled button ({m['filled']})")
            ok(not m['twice'], f"{tag}: each bill named once {m['twice'][:3]}")
            ok(not m['selfnamed'], f"{tag}: no row repeats its issue's name {m['selfnamed'][:3]}")
            ok(m['rows'] == n, f"{tag}: one row per issue ({m['rows']} of {n})")
            if size == 'phone': ok(m['h'] <= (2 if n <= 3 else 3) * h, f"{tag}: under {2 if n <= 3 else 3} phone screens ({m['h']}px)")
            ok(all(re.match(r'^(Testimony due|Your letter is started · due) (today|tomorrow)|^Needs a hearing by|^Late testimony until (today|tomorrow)', t) for t in m['warn']), f"{tag}: amber only for what is due within a day {m['warn'][:3]}")
            if o.get('welcome'): ok(m['fresh'] == 0, f"{tag}: nothing marked New right after the first visit ({m['fresh']})")
            ok(not m['wide'], f'{tag}: no sideways scroll')
            ORDER = ['Due this week', 'Hearing coming up', 'Needs a hearing', 'Passed recently', 'Waiting', 'Became law', 'Did not advance']
            if n > 8 and not o.get('off'):
                ok(m['groups'] and m['groups'] == sorted(m['groups'], key=ORDER.index), f"{tag}: grouped by where they stand, in order {m['groups']}")
                hidden_due = pg.evaluate("() => [...document.querySelectorAll('#main [data-cm-more] .cm-rstat, #main li[data-cm-more] .cm-rstat')].filter(e => /^(Testimony due|Your letter is started · due|Late testimony until)/.test(e.innerText) || e.closest('.cm-group')?.querySelector('.cm-gh')?.firstChild.textContent.trim() === 'Due this week').length")
                want = f'Show all {n} issues' + (f' · {hidden_due} more due this week' if hidden_due else '')
                ok(m['shown'] == 8 and m['showall'] == [want], f"{tag}: the first 8 shown, then “{want}” ({m['shown']}, {m['showall']})")
                pg.screenshot(path=os.path.join(OUT, f"{size}_{who}_{day}_folded.png"), full_page=True)
                pg.click('[data-cm-showall]'); pg.wait_for_timeout(300)
                m2 = pg.evaluate(MEASURE)
                ok(m2['shown'] == n and not m2['showall'] and m2['groups'] == m['groups'], f"{tag}: Show all opens all {n}, still grouped ({m2['shown']})")
                ok(pg.evaluate("document.activeElement?.classList.contains('cm-row')"), f'{tag}: the first row it opened takes the focus')
                # The slide's own issue says "On the slide above" (R-295): it is due when the slide is testimony due or late.
                due = pg.evaluate("() => { const sd = /^(Send it by|Late testimony until)/.test(document.querySelector('#main .cm-slide .cm-when b')?.innerText || '');"
                                  " return [...document.querySelectorAll('#main .cm-rows .cm-row')].map(r => r.classList.contains('on') ? sd : /^(Testimony due|Your letter is started · due|Late testimony until)/.test(r.querySelector('.cm-rstat').innerText)); }")
                ok(due == sorted(due, reverse=True), f'{tag}: nothing due this week is below an issue with nothing due {due}')
            elif not o.get('off'): ok(not m['groups'] and not m['showall'], f"{tag}: up to 8 issues, no headings and no Show all")
            ok(not errs, f'{tag}: no page errors {errs[:2]}')
            pg.screenshot(path=os.path.join(OUT, f"{size}_{who}_{day}{'_welcome' if o.get('welcome') else ''}{'_off' if o.get('off') else ''}.png"), full_page=True)
            ctx.close()
    # ---- R-250 (Nate 10/11, "Yes, go on R-250 as recommended"): what the calm Home first left out ----
    # 1. Late testimony: HB 1562 is heard Monday 1:10 PM, its written deadline passed Sunday. Followed through its issue, with
    #    nothing due on time, it is the card ("Send late testimony") and its row says so; the greeting never says nothing
    #    needs you. 2. Bills followed on their own (HB 1563 and HB 1732 wait for a hearing; HB 1605 is on no issue): a row
    #    each, named for the bill and opening its page, while the card is the soonest thing (C1-1, B-14, A-23, A-14).
    import json
    snap = json.load(open(os.path.join(ROOT, 'demo', 'snapshot.json')))
    BID = {b['bill_number']: b['id'] for b in snap['bills']}; IID = {i['slug']: i['id'] for i in snap['issues']}
    def follows(issues, bills):
        return f"""(() => {{ if (sessionStorage.getItem('__set')) return; sessionStorage.setItem('__set', '1');
  for (const k of Object.keys(localStorage)) if (k.startsWith('hiphi_')) localStorage.removeItem(k);
  const set = (k, v) => localStorage.setItem(k + '_demo', JSON.stringify(v));
  set('hiphi_issue_follows', {json.dumps(issues)}); set('hiphi_watch_ids', {json.dumps(bills)}); set('hiphi_cat_follows', []); set('hiphi_skips', []);
  set('hiphi_wiz', {{ done: true, skipped: true }}); set('hiphi_onb', {{ lastVisit: new Date(Date.parse('2026-03-15T19:00:00-10:00')).toISOString() }});
  localStorage.setItem('hiphi_tour_home_demo', '{{"how":"test"}}'); localStorage.setItem('hiphi_tour_bill_demo', '{{"how":"test"}}'); }})();"""
    ROWS = "() => [...document.querySelectorAll('#main .cm-row')].map(r => [r.querySelector('.cm-rname').firstChild.textContent.trim(), r.querySelector('.cm-rstat').innerText.trim(), r.getAttribute('href')])"
    for size, (w, h) in [('phone', (390, 844)), ('laptop', (1366, 900))]:
        for label, iss, bills in [('late testimony', [IID['youth-mental-health-app']], []),
                                  ('bills followed on their own', [], [BID['HB1563'], BID['HB1732'], BID['HB1605'], BID['HB1562']])]:
            ctx = br.new_context(viewport={'width': w, 'height': h}, is_mobile=size == 'phone', has_touch=size == 'phone')
            ctx.add_init_script("Object.defineProperty(Navigator.prototype,'globalPrivacyControl',{get:()=>true});")
            ctx.add_init_script(follows(iss, bills))
            pg = ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
            pg.goto(f'{BASE}/track.html?demo=1&abrest=today&ab=layout.calm#/')
            pg.wait_for_function("() => !!document.querySelector('#main .cm') && !document.querySelector('.skelpage')", timeout=60000); pg.wait_for_timeout(1500)
            tag = f'{size} R-250 {label}'; m = pg.evaluate(MEASURE); rows = pg.evaluate(ROWS)
            card = pg.evaluate("document.querySelector('#main .cm-slide .btn.primary')?.innerText.trim() || ''")
            when = pg.evaluate("document.querySelector('#main .cm-slide .cm-when')?.innerText.trim() || ''")
            lede = pg.evaluate("document.querySelector('#main .cm-head .lede')?.innerText || ''")
            ok(card == 'Send late testimony' and when.startswith('Late testimony until 1:10 PM today · HB 1562'), f'{tag}: the slide is HB 1562\'s late testimony ("{card}", "{when}")')
            ok('Nothing needs you' not in lede, f'{tag}: the greeting does not say nothing needs you ("{lede[:60]}")')
            ok(m['filled'] == 1 and len(m['shapes']) <= 2 and m['blocks'] <= 4 and not m['twice'], f"{tag}: still inside the budget (A-23: {m['blocks']} blocks, {m['shapes']}, {m['filled']} filled, twice {m['twice'][:2]})")
            if label == 'late testimony':
                ok(rows and rows[0][1] == 'On the slide above', f'{tag}: the issue row points to the slide, which says late testimony is open ({rows})')
            else:
                hd = pg.evaluate("document.querySelector('#cm-iss-h')?.innerText.trim()")
                hrefs = sorted(r[2] for r in rows)
                ok(hd == 'Your bills' and hrefs == ['#/bill/2026/HB1563', '#/bill/2026/HB1605', '#/bill/2026/HB1732'], f'{tag}: a row for each bill but the card\'s, opening the bill ("{hd}", {hrefs})')
                st = {r[2]: r[1] for r in rows}
                ok(st.get('#/bill/2026/HB1563', '').startswith('HB 1563 · Needs a hearing by') and st.get('#/bill/2026/HB1732', '').startswith('HB 1732 · Needs a hearing by'), f'{tag}: the waiting bills give their number and say they need a hearing ({st})')
                ok('Nothing new on your bills' in lede or 'your issues' not in lede, f'{tag}: someone who follows only bills is not told about issues ("{lede[:60]}")')
            ok(not m['wide'] and not errs, f'{tag}: no sideways scroll, no page errors {errs[:2]}')
            pg.screenshot(path=os.path.join(OUT, f"{size}_r250_{label.split()[0]}.png"), full_page=True)
            ctx.close()
    # ---- R-295 (Nate 10/17, version A "The slide", decisions 1-5): the one thing drawn like an onboarding screen ----
    # Kai Monday has 3 things this week. The slide: a drawing, a goal heading (h1, not the bill's name), the time it takes,
    # one filled button in it; the count once, in the greeting; "Show the next one" swaps the slide in place with an Undo;
    # a row with something to do brings it up onto the slide (5a) and says "On the slide above" (a quiet row keeps its link).
    # Home reads at onboarding's type step (C-14): the slide's sentence at 18px.
    from playwright.sync_api import expect
    SL = """() => { const s = document.querySelector('#main .cm-slide'); if (!s) return null;
      return { h: s.querySelector('.cm-goal')?.tagName, title: s.querySelector('.cm-goal')?.innerText.trim(), art: !!s.querySelector('.cm-art svg, .cm-art img'),
        filled: s.querySelectorAll('.btn.primary').length, mins: s.querySelector('.cm-time')?.innerText.trim() || '', say: parseFloat(getComputedStyle(s.querySelector('.cm-say')).fontSize),
        hi: document.querySelector('#main .cm-hi')?.innerText || '', on: [...document.querySelectorAll('#main .cm-row.on .cm-rname')].map(e => e.firstChild.textContent.trim()),
        more: [...s.querySelectorAll('.cm-more .btn')].map(e => [e.innerText.trim(), Math.round(e.getBoundingClientRect().top)]) }; }"""
    for size, (w, h) in [('phone', (390, 844)), ('laptop', (1366, 900))]:
        ctx = br.new_context(viewport={'width': w, 'height': h}, is_mobile=size == 'phone', has_touch=size == 'phone')
        ctx.add_init_script("Object.defineProperty(Navigator.prototype,'globalPrivacyControl',{get:()=>true});")
        ctx.add_init_script(scene('kai', 'mon'))
        pg = ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(f'{BASE}/track.html?demo=1&abrest=today&ab=layout.calm#/')
        pg.wait_for_selector('#main .cm-slide', timeout=60000); pg.wait_for_timeout(1500)
        tag = f'{size} R-295 slide'; a = pg.evaluate(SL)
        ok(a['h'] == 'H1' and a['art'] and a['filled'] == 1 and a['mins'] == 'About 2 minutes', f"{tag}: a drawing, the goal as the h1, one filled button, the time it takes ({a['h']}, {a['art']}, {a['filled']}, {a['mins']!r})")
        ok(not re.search(r'\b[HS]B \d', a['title']), f"{tag}: the heading says the goal, not the bill ({a['title']!r})")
        ok(a['say'] >= 18, f"{tag}: the sentence at onboarding's step ({a['say']}px)")
        ok('3 things you can do this week' in a['hi'] and 'of 3' not in pg.inner_text('#main .cm-slide'), f"{tag}: the count said once, in the greeting ({a['hi'][-70:]!r})")
        ok(len(a['on']) == 1, f"{tag}: one row says the slide is its issue ({a['on']})")
        ok(len(a['more']) == 2 and a['more'][0][1] == a['more'][1][1], f"{tag}: More ways to help and Show the next one on one line ({a['more']})")
        first = a['title']
        pg.click('#main [data-cm-skip]'); pg.wait_for_timeout(900); b = pg.evaluate(SL)
        ok(b['title'] != first and b['filled'] == 1, f"{tag}: Show the next one brings up the next ({first!r} -> {b['title']!r})")
        ok(pg.evaluate("document.activeElement?.classList.contains('cm-goal')"), f'{tag}: the new heading takes the focus')
        ok(pg.locator('#toast .toastundo', has_text='Undo').count() == 1, f'{tag}: it says what it did, with Undo')
        pick = pg.evaluate("() => { const r = document.querySelector('#main .cm-row[data-cm-pick]:not(.on)'); return r && r.querySelector('.cm-rname').firstChild.textContent.trim(); }")
        ok(pick, f'{tag}: a row with something to do can be picked ({pick})')
        if pick:
            pg.click('#main .cm-row[data-cm-pick]:not(.on)'); pg.wait_for_timeout(900); c = pg.evaluate(SL)
            ok(c['on'] == [pick] and c['title'] != b['title'], f"{tag}: the row it picked comes onto the slide (5a: {c['on']}, {c['title']!r})")
            ok(pg.evaluate("location.hash") in ('#/', ''), f"{tag}: and Home stays put ({pg.evaluate('location.hash')})")
        ok(not errs, f'{tag}: no page errors {errs[:2]}')
        pg.screenshot(path=os.path.join(OUT, f'{size}_slide_picked.png'), full_page=True)
        ctx.close()
    br.close()
print(f'\n{sum(res)}/{len(res)} passed')
sys.exit(0 if all(res) else 1)
