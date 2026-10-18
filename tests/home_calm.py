# The calm Home's budget (R-222 Direction 1, pub/calm/home.js; docs/DESIGN.md A-23), on the practice copy, the layout
# test's 'calm' forced (everyone's Home since 11 Oct), phone (390x844) and laptop (1366x900), for the people compare.html sets up:
#   Kai (3 issues) Monday and Tuesday, Malia (3 issues, a quiet week), Kai right after the first visit, Kai between
#   sessions, Leilani (16 issues) Monday, Tuesday and between sessions.
# In each: at most 4 blocks, of at most 2 shapes (a card, rows); one filled button; each bill named once; on a phone under
# 2 screens for 3 issues and 3 for 16; one row per issue followed; amber only for what is due inside 24 hours (A-5); nothing
# "New" right after the first visit; no sideways scroll; no page errors. Over 8 issues in session (Nate 10/11: "Option number
# 2, but still grouped by status"): the issues in the order of where they stand, the first 8 shown, "Show all your issues"
# opens the rest in place, and nothing due is ever below a quiet issue; no headings over the groups (R-300).
# R-300 (Nate's picks, 17 Oct): the greeting is one line with no count; the button, More ways to help and the pager sit at the
# same x/y on every slide of a moment (walked with the pager, phone and laptop), with at most 5 dots and no "1 of N"; the
# first phone screen is under 60 words and 6 text styles (the amber A-5 asks for inside 24 hours aside).
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
# R-300: where the slide's controls sit (document x/y), the dots, the heading; and the first screen's words and text styles.
POS = """() => { const at = s => { const e = document.querySelector('#main .cm-slide ' + s); if (!e) return null; const r = e.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top + scrollY)]; };
  return { go: at('.cm-go .btn'), more: at('.cm-more .btn'), pager: at('.cm-pager'), dots: document.querySelectorAll('#main .cm-dots i').length,
    title: document.querySelector('#main .cm-goal')?.innerText.trim(), next: !!document.querySelector('#main [data-cm-step="1"]:not([disabled])'),
    text: document.querySelector('#main .cm-slide')?.innerText || '' }; }"""
FIRST = """() => { const root = document.querySelector('#main .cm'), bar = document.querySelector('.tabs');
  const bottom = Math.min(innerHeight, bar && bar.getBoundingClientRect().top > 0 ? bar.getBoundingClientRect().top : innerHeight);
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); let words = 0; const st = new Set();
  for (let n; (n = w.nextNode());) { const t = n.textContent.trim(), el = n.parentElement; if (!t) continue;
    if (!el.checkVisibility({ visibilityProperty: true, opacityProperty: true }) || el.closest('.sr, [aria-hidden="true"]')) continue;
    const r = document.createRange(); r.selectNodeContents(n); const rc = r.getBoundingClientRect(); if (!rc.height || rc.top + rc.height / 2 >= bottom || rc.bottom <= 0) continue;
    const cs = getComputedStyle(el); if (!el.closest('.warn')) st.add([cs.fontFamily.split(',')[0], cs.fontSize, cs.fontWeight, cs.color].join(' '));
    words += t.split(/\\s+/).filter(x => /\\w/.test(x)).length; }
  return { words, styles: [...st] }; }"""
def walk(pg, tag):
    # Every slide of the moment, with the pager's next arrow: the controls never move, the dots stay 5 or fewer, no count.
    seen = [pg.evaluate(POS)]
    while seen[-1]['next'] and len(seen) < 30:
        pg.click('#main [data-cm-step="1"]'); pg.wait_for_timeout(450); seen.append(pg.evaluate(POS))
    if len(seen) < 2: return
    for k in ('go', 'more', 'pager'):
        spots = sorted({tuple(x[k]) for x in seen if x[k]})
        ok(len(spots) == 1 and all(x[k] for x in seen), f"{tag}: {'the button' if k == 'go' else 'More ways to help' if k == 'more' else 'the pager'} at the same x/y on all {len(seen)} slides {spots[:4]}")
    ok(max(x['dots'] for x in seen) <= 5, f"{tag}: at most 5 dots ({max(x['dots'] for x in seen)})")
    ok(not any(re.search(r'\b\d+ of \d+\b', x['text']) for x in seen), f'{tag}: no "1 of N" on any slide')
    ok(not seen[-1]['next'] and seen[-1]['title'] not in ('Nothing needs you this week', 'You’ve seen everything due this week'), f"{tag}: the last slide is a slide, its next arrow off ({seen[-1]['title']!r})")
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
                ok(not m['groups'], f"{tag}: no headings over the groups, “Due this week 15” gone (R-300: {m['groups']})")
                hidden_due = pg.evaluate("() => [...document.querySelectorAll('#main li[data-cm-more] .cm-rstat')].filter(e => /^(Testimony due|Your letter is started · due|Late testimony until)/.test(e.innerText)).length")
                want = 'Show all your issues' + (' · more due this week' if hidden_due else '')
                ok(m['shown'] == 8 and m['showall'] == [want], f"{tag}: the first 8 shown, then “{want}” ({m['shown']}, {m['showall']})")
                pg.screenshot(path=os.path.join(OUT, f"{size}_{who}_{day}_folded.png"), full_page=True)
                pg.click('[data-cm-showall]'); pg.wait_for_timeout(300)
                m2 = pg.evaluate(MEASURE)
                ok(m2['shown'] == n and not m2['showall'], f"{tag}: Show all opens all {n} ({m2['shown']})")
                ok(pg.evaluate("document.activeElement?.classList.contains('cm-row')"), f'{tag}: the first row it opened takes the focus')
                # The slide's own issue says "On the slide above" (R-295): it is due when the slide is testimony due or late.
                due = pg.evaluate("() => { const sd = !!document.querySelector('#main .cm-slide .cm-go [data-helper]');"
                                  " return [...document.querySelectorAll('#main .cm-rows .cm-row')].map(r => r.classList.contains('on') ? sd : /^(Testimony due|Your letter is started · due|Late testimony until)/.test(r.querySelector('.cm-rstat').innerText)); }")
                ok(due == sorted(due, reverse=True), f'{tag}: nothing due this week is below an issue with nothing due {due}')
            elif not o.get('off'): ok(not m['groups'] and not m['showall'], f"{tag}: up to 8 issues, no headings and no Show all")
            ok(not errs, f'{tag}: no page errors {errs[:2]}')
            pg.screenshot(path=os.path.join(OUT, f"{size}_{who}_{day}{'_welcome' if o.get('welcome') else ''}{'_off' if o.get('off') else ''}.png"), full_page=True)
            if not o.get('off') and not o.get('welcome'):
                # R-300: one line, no count (Nate: "Remove the XYZ things you can do this week").
                hi = pg.evaluate("(() => { const e = document.querySelector('#main .cm-hi'); if (!e) return ['', 0]; const lh = parseFloat(getComputedStyle(e).lineHeight); return [e.innerText.trim(), Math.round(e.getBoundingClientRect().height / lh)]; })()")
                ok(hi[0] and not re.search(r'\d|things you can do|more result', hi[0]) and hi[1] == 1, f"{tag}: the greeting is one line with no count ({hi[0]!r}, {hi[1]} lines)")
                if size == 'phone':
                    pg.evaluate('window.scrollTo(0, 0)'); pg.wait_for_timeout(200); f1 = pg.evaluate(FIRST)
                    ok(f1['words'] < 60 and len(f1['styles']) <= 6, f"{tag}: the first screen under 60 words and 6 text styles ({f1['words']} words, {len(f1['styles'])} styles)")
                walk(pg, tag)
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
            when = pg.evaluate("document.querySelector('#main .cm-slide .cm-time')?.innerText.trim() || ''")
            lede = pg.evaluate("document.querySelector('#main .cm-head .lede')?.innerText || ''")
            ok(card == 'Send late testimony' and when.startswith('Late until 1:10 PM today · about 2 min · HB 1562'), f'{tag}: the slide is HB 1562\'s late testimony ("{card}", "{when}")')
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
    # ---- R-295 (Nate 10/17, version A "The slide") and R-300 (Nate's picks, 17 Oct): the one thing drawn like an onboarding
    # screen, moved through with a pager and a swipe ----
    # Kai Monday has 3 things this week. The slide: a drawing, a goal heading (h1, not the bill's name), one detail line with
    # the time it takes, one filled button, More ways to help under it and the pager under that. The next arrow brings up the
    # next in place and keeps the focus (the new heading read out); the one-before arrow comes back; a swipe does the same on a
    # touch screen, a short one does nothing; a row with something to do moves the pager to its slide (5a), and Home stays put.
    # Malia's hearing asks get More ways too. Home reads at onboarding's type step (C-14): the sentence at 18px.
    SL = """() => { const s = document.querySelector('#main .cm-slide'); if (!s) return null;
      return { h: s.querySelector('.cm-goal')?.tagName, title: s.querySelector('.cm-goal')?.innerText.trim(), art: !!s.querySelector('.cm-art svg, .cm-art img'),
        filled: s.querySelectorAll('.btn.primary').length, time: s.querySelector('.cm-time')?.innerText.trim() || '', say: parseFloat(getComputedStyle(s.querySelector('.cm-say')).fontSize),
        hi: document.querySelector('#main .cm-hi')?.innerText || '', on: [...document.querySelectorAll('#main .cm-row.on .cm-rname')].map(e => e.firstChild.textContent.trim()),
        more: s.querySelector('.cm-more .btn')?.innerText.trim() || '', dots: [...s.querySelectorAll('.cm-dots i')].map(e => e.className), skip: !!s.querySelector('[data-cm-skip]') }; }"""
    SWIPE = """dx => { const s = document.querySelector('#main .cm-slide .cm-say'), r = s.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + 4;
      const ev = (t, cx) => s.dispatchEvent(new PointerEvent(t, { pointerId: 7, pointerType: 'touch', isPrimary: true, clientX: cx, clientY: y, bubbles: true }));
      ev('pointerdown', x); for (let k = 1; k <= 5; k++) ev('pointermove', x + dx * k / 5); ev('pointerup', x + dx); }"""
    for size, (w, h) in [('phone', (390, 844)), ('laptop', (1366, 900))]:
        ctx = br.new_context(viewport={'width': w, 'height': h}, is_mobile=size == 'phone', has_touch=size == 'phone')
        ctx.add_init_script("Object.defineProperty(Navigator.prototype,'globalPrivacyControl',{get:()=>true});")
        ctx.add_init_script(scene('kai', 'mon'))
        pg = ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(f'{BASE}/track.html?demo=1&abrest=today&ab=layout.calm#/')
        pg.wait_for_selector('#main .cm-slide', timeout=60000); pg.wait_for_timeout(1500)
        tag = f'{size} R-300 slide'; a = pg.evaluate(SL)
        ok(a['h'] == 'H1' and a['art'] and a['filled'] == 1 and re.match(r'^By .+ · about 2 min · [HS]B \d+$', a['time']), f"{tag}: a drawing, the goal as the h1, one filled button, one detail line ({a['h']}, {a['art']}, {a['filled']}, {a['time']!r})")
        ok(not re.search(r'\b[HS]B \d', a['title']), f"{tag}: the heading says the goal, not the bill ({a['title']!r})")
        ok(a['say'] >= 18, f"{tag}: the sentence at onboarding's step ({a['say']}px)")
        ok(a['hi'].strip() == 'Aloha, Kai. Here’s how you can help.' and 'of 3' not in pg.inner_text('#main .cm-slide'), f"{tag}: no count in the greeting or on the slide ({a['hi']!r})")
        ok(len(a['on']) == 1, f"{tag}: one row says the slide is its issue ({a['on']})")
        ok(a['more'] == 'More ways to help' and a['dots'] == ['on', '', ''] and not a['skip'], f"{tag}: More ways to help, then the pager on the first of three dots, no “Show the next one” ({a['more']!r}, {a['dots']})")
        ok(pg.locator('#main [data-cm-step="-1"]').is_disabled() and not pg.locator('#main [data-cm-step="1"]').is_disabled(), f'{tag}: the one-before arrow is off on the first slide')
        first = a['title']
        pg.click('#main [data-cm-step="1"]'); pg.wait_for_timeout(700); b = pg.evaluate(SL)
        ok(b['title'] != first and b['filled'] == 1 and b['dots'] == ['', 'on', ''], f"{tag}: the next arrow brings up the next ({first!r} -> {b['title']!r}, {b['dots']})")
        ok(pg.evaluate("document.activeElement?.dataset.cmStep === '1' && document.querySelector('#main [data-cm-said]').textContent.trim() === document.querySelector('#main .cm-goal').innerText.trim()"), f'{tag}: the focus stays on the arrow and the new heading is read out')
        ok(pg.locator('#toast .toastundo').count() == 0, f'{tag}: moving is browsing: no “moved out of the way” toast')
        pg.click('#main [data-cm-step="-1"]'); pg.wait_for_timeout(700)
        ok(pg.evaluate(SL)['title'] == first, f'{tag}: the one-before arrow comes back')
        if size == 'phone':
            pg.evaluate(SWIPE, -120); pg.wait_for_timeout(700); sw = pg.evaluate(SL)
            ok(sw['title'] == b['title'] and pg.evaluate("document.activeElement?.classList.contains('cm-goal')"), f"{tag}: a swipe to the left brings up the next and its heading takes the focus ({sw['title']!r})")
            pg.evaluate(SWIPE, 30); pg.wait_for_timeout(500)
            ok(pg.evaluate(SL)['title'] == b['title'], f'{tag}: a short swipe settles back')
            pg.evaluate(SWIPE, 120); pg.wait_for_timeout(700)
            ok(pg.evaluate(SL)['title'] == first, f'{tag}: a swipe to the right comes back')
        pick = pg.evaluate("() => { const r = document.querySelector('#main .cm-row[data-cm-pick]:not(.on)'); return r && r.querySelector('.cm-rname').firstChild.textContent.trim(); }")
        ok(pick, f'{tag}: a row with something to do can be picked ({pick})')
        if pick:
            pg.click('#main .cm-row[data-cm-pick]:not(.on)'); pg.wait_for_timeout(900); c = pg.evaluate(SL)
            ok(c['on'] == [pick] and c['title'] != first and 'on' in c['dots'] and c['dots'].index('on') > 0, f"{tag}: the row it picked comes onto the slide and the pager moves to it (5a: {c['on']}, {c['title']!r}, {c['dots']})")
            ok(pg.evaluate("location.hash") in ('#/', ''), f"{tag}: and Home stays put ({pg.evaluate('location.hash')})")
        ok(not errs, f'{tag}: no page errors {errs[:2]}')
        pg.screenshot(path=os.path.join(OUT, f'{size}_slide_picked.png'), full_page=True)
        ctx.close()
        # Malia's hearing asks (R-300, "every slide gets it"): More ways opens inline with a friend, the calendar and the bill.
        ctx = br.new_context(viewport={'width': w, 'height': h}, is_mobile=size == 'phone', has_touch=size == 'phone')
        ctx.add_init_script("Object.defineProperty(Navigator.prototype,'globalPrivacyControl',{get:()=>true});")
        ctx.add_init_script(scene('malia', 'mon'))
        pg = ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(f'{BASE}/track.html?demo=1&abrest=today&ab=layout.calm#/')
        pg.wait_for_selector('#main .cm-slide', timeout=60000); pg.wait_for_timeout(1500)
        tag = f'{size} R-300 hearing ask'
        pg.click('#main .cm-more [data-moreways]'); pg.wait_for_timeout(300)
        rows = pg.evaluate("[...document.querySelectorAll('#main .cm-slide .moreways .mwrow .title')].map(e => e.innerText.trim())")
        ok(pg.get_attribute('#main .cm-more [data-moreways]', 'aria-expanded') == 'true' and len(rows) == 3 and rows[0] == 'Ask a friend to ask too' and rows[1].endswith('to my calendar') and rows[2] == 'Read what the bill does', f'{tag}: More ways to help opens inline on a hearing ask ({rows})')
        with pg.expect_download() as dl: pg.click('#main [data-cm-cutoff]')
        ok(dl.value.suggested_filename.endswith('-cutoff.ics'), f'{tag}: the cut-off goes into a calendar file ({dl.value.suggested_filename})')
        ok(not errs, f'{tag}: no page errors {errs[:2]}')
        ctx.close()
    br.close()
print(f'\n{sum(res)}/{len(res)} passed')
sys.exit(0 if all(res) else 1)
