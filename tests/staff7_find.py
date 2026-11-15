# Staff7's find box (R-398), on the practice copy: one text box on every page (Home, Issues, Calendar, a step page, the Search door), "/" to reach it, Recently opened, the four result groups with their caps,
# the Issues list narrowed in place with the words in the address, the Search door with its three look-only sheets (committee, legislator, a bill nobody tracks), Escape, the arrow keys and Enter.
# What it checks is computed AGAIN here from the practice data (not by calling find.js): every issue of Mine (KR, JM) and Everyone is found by the first 4 letters of a word in its name (Nate's measure of success).
# Rules kept: no select, checkbox or radio in the find UI (there is nothing to filter with but the words); the page never prints "vape"; one filled button at most; 44px targets; no sideways scroll; no console error;
# nothing leaves 127.0.0.1.
#   python3 tests/staff7_find.py [base] [shots folder]     base defaults to http://127.0.0.1:8851
import sys, os, re, json
from playwright.sync_api import sync_playwright
BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8851').rstrip('/')
SHOTS = sys.argv[2] if len(sys.argv) > 2 else ''
if SHOTS: os.makedirs(SHOTS, exist_ok=True)
res = []
def ok(c, m): res.append(bool(c)); print('PASS' if c else 'FAIL', m, flush=True)

FILLED = "() => [...document.querySelectorAll('.btn.filled')].filter(b => { const r = b.getBoundingClientRect(), s = getComputedStyle(b); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && r.top < innerHeight && r.bottom > 0; }).length"
NOSIDE = "() => document.documentElement.scrollWidth <= innerWidth && [...document.querySelectorAll('.paper, .wl')].every(p => p.scrollWidth <= p.clientWidth + 1)"
SMALL = "() => [...document.querySelectorAll('.fit, .fall, .findb, .findb input, #findClear, .btn, .seg')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.height < 43.5 && !e.closest('[hidden]'); }).map(e => e.className + ' ' + (e.innerText || '').slice(0, 20))"
NOFILTER = "() => [...document.querySelectorAll('.findw, #slist, #ilist, #ialso, .fdrop')].flatMap(r => [...r.querySelectorAll('select, input[type=checkbox], input[type=radio], [role=checkbox], [role=switch], [role=radio], [role=menuitemcheckbox]')]).length"
H1 = "() => [...document.querySelectorAll('main h1')].find(h => h.getBoundingClientRect().width > 0)?.innerText.trim()"
# The data, read again here. norm: lower case, no diacritics, no okina or apostrophes, punctuation to spaces.
DATA = """async () => { const d = await import('/staff6/data.js'), st = await import('/staff7/standing.js'), mo = await import('/staff6/model.js'), sx = await import('/staff6/steps.js'), S = d.S;
  const norm = s => String(s ?? '').normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').toLowerCase().replace(/[\\u02bb\\u2018\\u2019\\u02bc'`]/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ').trim();
  const withMe = (p, fn) => { const prev = S.me; S.me = p; try { return fn(); } finally { S.me = prev; } };
  const has = i => !i.archived_at && st.billsOfIssue(i).length > 0;
  const setOf = who => { let ids; if (who === 'all') ids = S.issues.filter(has).map(i => String(i.id)); else { const p = who === 'mine' ? S.me : S.advocates.find(a => a.initials === who); ids = withMe(p, () => [...d.myIssueIds()]).filter(id => has(S.issues.find(i => String(i.id) === id))); }
    return ids.map(id => { const i = S.issues.find(x => String(x.id) === id); return { id, name: i.name }; }); };
  const lead = id => { const a = S.advocates.find(x => x.id === id && x.is_active !== false); return a ? a.full_name : ''; };
  const catName = i => { const ks = new Set([i.category, ...S.issueCats.filter(x => String(x.issue_id) === String(i.id)).map(x => x.category)]); return [...ks].map(k => (S.categories.find(c => c.key === k) || { name: 'Other' }).name); };
  const nums = b => norm(b.bill_number) + ' ' + norm(b.bill_number.replace(/^([A-Z]+)(\\d)/, '$1 $2'));
  return { setOf, S, norm,
    issueHay: i => norm([i.name, ...catName(i), lead(i.owner_id)].join(' ')) + ' ' + st.billsOfIssue(i).map(nums).join(' '),
    billHay: b => { const iss = S.billIssues.filter(x => x.bill_id === b.id).map(x => S.issues.find(i => i.id === x.issue_id)).filter(i => i && !i.archived_at);
      const ids = [...new Set([...(S.assignments[b.id] || []), ...iss.map(i => i.owner_id)])].filter(id => lead(id)); return norm(nums(b) + ' ' + sx.fullName(b) + ' ' + b.title + ' ' + iss.map(i => i.name).join(' ') + ' ' + ids.map(lead).join(' ')); },
    cmteHay: c => norm((c.chamber === 'S' ? 'Senate ' : 'House ') + c.name + ' ' + (c.chair || '')), legHay: l => norm(l.name + ' ' + (l.places || '')) }; }"""
MATCH = """async ([q, kind]) => { const D = await (0, eval)('(' + %s + ')')(); const ws = D.norm(q).split(' ').filter(Boolean), all = h => ws.length > 0 && Math.max(...ws.map(w => w.length)) >= 2 && ws.every(w => (' ' + h).includes(' ' + w) || (/^vap(e|es|ing)?$/.test(w) && (' ' + h).includes(' cigarette')));
  const S = D.S; if (kind === 'issues') return S.issues.filter(i => !i.archived_at && all(D.issueHay(i))).map(i => String(i.id));
  if (kind === 'bills') return S.bills.filter(b => b.tracked !== false && all(D.billHay(b))).map(b => b.bill_number);
  if (kind === 'people') return [...Object.values(S.committees).filter(c => all(D.cmteHay(c))).map(c => 'c:' + c.code), ...S.legislators.filter(l => all(D.legHay(l))).map(l => 'l:' + l.id)];
  return []; }""" % json.dumps(DATA)
def match(pg, q, kind): return pg.evaluate(MATCH, [q, kind])

def external_blocker(ctx, bad):
    def h(route):
        u = route.request.url
        if 'fonts.g' in u: return route.continue_()
        bad.append(u); route.abort()
    ctx.route(lambda u: '127.0.0.1' not in u and 'localhost' not in u, h)
def open_as(br, who, w, h, hash='', ctx=None):
    if ctx is None:
        ctx = br.new_context(viewport={'width': w, 'height': h}); ctx._bad = []; external_blocker(ctx, ctx._bad); ctx._errs = []
    pg = ctx.new_page(); errs = ctx._errs
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'Failed to load resource' not in m.text and 'ERR_FAILED' not in m.text else None)
    pg.goto(f'{BASE}/staff7.html?demo=1' + (f'&as={who}' if who != 'default' else '') + hash); pg.wait_for_selector('.paper', timeout=60000)
    pg.evaluate("Promise.all([document.fonts.load('600 16px Poppins'), document.fonts.load('400 16px Lato'), document.fonts.load('700 16px Lato'), document.fonts.load('500 16px Poppins')])"); pg.wait_for_timeout(500)
    return pg, ctx
def go(pg, hash): pg.evaluate("h => { location.hash = h; }", hash); pg.wait_for_timeout(450)
def snap(pg, name):
    if SHOTS: pg.screenshot(path=os.path.join(SHOTS, name))
def settle(pg):   # the other bills have been asked for and answered
    pg.wait_for_function("() => document.getElementById('findW') && document.getElementById('findW').dataset.busy === '0'", timeout=15000); pg.wait_for_timeout(150)
def type_q(pg, q, delay=15):
    pg.click('#findIn'); pg.fill('#findIn', ''); pg.keyboard.type(q, delay=delay); settle(pg)
def groups(pg, host='#findList'):   # [(heading, [(kind, href, name, sub, tag)])]
    return pg.evaluate("""h => [...document.querySelectorAll(h + ' [data-g]')].map(g => [g.querySelector('h3, h4').innerText.replace(/ · .*$/, '').trim(), [...g.querySelectorAll('[role=option]')].map(a => [a.dataset.k, a.getAttribute('href'), a.querySelector('b').innerText.trim(), a.querySelector('.ir2').innerText.trim(), a.querySelector('.ftag')?.innerText || ''])])""", host)
def door_totals(pg): return pg.evaluate("() => Object.fromEntries([...document.querySelectorAll('#slist [data-g]')].map(g => [g.dataset.g, +((/ · (\\d+)/.exec(g.querySelector('h3').innerText)) || [0, 0])[1]]))")
ALIVE = """async rows => { const d = await import('/staff6/data.js'), st = await import('/staff7/standing.js'), mo = await import('/staff6/model.js'), S = d.S;
  return rows.map(h => { if (h.startsWith('#/issue/')) { const i = S.issues.find(x => String(x.id) === decodeURIComponent(h.slice(8).split('?')[0])); return st.billsOfIssue(i).some(b => !mo.diedish(b)); }
    if (h.startsWith('#/bill/')) { const b = S.bills.find(x => x.bill_number === decodeURIComponent(h.slice(7).split('?')[0])); return !mo.diedish(b); } return null; }); }"""
HINT_TXT = 'Type a bill number, a name, a topic or a person.'
HEAD = ['Issues', 'Our bills', 'Committees and legislators', 'Other bills at the Legislature']
def others_expected(pg, q):   # the other bills, by the data layer's own ask, minus our bills
    return pg.evaluate("""async q => { const d = await import('/staff6/data.js'), S = d.S, mine = new Set(S.bills.map(b => b.bill_number.toUpperCase())); const raw = await d.DB.searchUntracked(q); return { n: raw.length, rows: raw.filter(r => !mine.has(r.bill_number.toUpperCase())).map(r => r.bill_number) }; }""", q)

with sync_playwright() as p:
    br = p.chromium.launch()
    # ============================================================ 1440 wide, as KR
    pg, ctx = open_as(br, 'KR', 1440, 900, '#/')
    errs, bad = ctx._errs, ctx._bad
    # ---- the box is on every page
    step = pg.evaluate("() => document.querySelector('a[href^=\"#/do/\"]')?.getAttribute('href')")
    for name, hash in (('Home', '#/'), ('Issues', '#/issues'), ('Calendar (week grid)', '#/calendar'), ('Calendar (list)', '#/calendar?view=list'), ('a step page', step or '#/do/none'), ('the Search door', '#/search')):
        go(pg, hash); pg.wait_for_timeout(300)
        b = pg.evaluate("() => { const i = document.getElementById('findIn'); return i ? { n: document.querySelectorAll('#findIn').length, ph: i.placeholder, role: i.getAttribute('role'), kbd: document.querySelector('#findB kbd')?.innerText, top: i.getBoundingClientRect().top, vis: i.getBoundingClientRect().width > 0, label: i.getAttribute('aria-label'), icon: !!document.querySelector('#findB svg') } : null; }")
        ok(b and b['n'] == 1 and b['ph'] == 'Find an issue, a bill or a person' and b['role'] == 'combobox' and b['kbd'] == '/' and b['vis'] and b['icon'] and b['label'], f'{name}: one find box with the words "Find an issue, a bill or a person", a search icon and a "/" hint ({b})')
        ok(pg.evaluate(NOFILTER) == 0, f'{name}: no select, checkbox or radio in the find UI')
    ok(step is not None, f'a step page was found on Home ({step})')
    # ---- "/" goes to the box, but not while typing in a field
    go(pg, '#/'); pg.evaluate("() => document.activeElement.blur()"); pg.keyboard.press('/')
    ok(pg.evaluate("() => document.activeElement.id") == 'findIn', '"/" focuses the box from anywhere on the page')
    pg.evaluate("() => document.activeElement.blur()")
    for tag in ('textarea', 'input', 'select', 'div'):
        pg.evaluate("""t => { const e = document.createElement(t); e.id = 'probe'; if (t === 'div') { e.contentEditable = 'true'; e.textContent = ''; } if (t === 'select') e.innerHTML = '<option>a</option>'; document.body.appendChild(e); e.focus(); }""", tag)
        pg.keyboard.press('/'); on = pg.evaluate("() => document.activeElement.id")
        ok(on == 'probe', f'"/" does not leave a {tag} (focus stays in the field)')
        if tag in ('textarea', 'input'): ok(pg.evaluate("() => document.getElementById('probe').value") == '/', f'"/" is typed into the {tag}')
        pg.evaluate("() => document.getElementById('probe').remove()")
    # ---- placeholders: the focused empty box on a fresh browser has only the hint
    pg.evaluate("() => localStorage.removeItem('hiphi7_recent')"); go(pg, '#/'); pg.click('#findIn'); pg.wait_for_timeout(200)
    t = pg.locator('#findDrop').inner_text().strip()
    ok(pg.locator('#findDrop').is_visible() and t == 'Type a bill number, a name, a topic or a person.' and pg.locator('#findList [role=option]').count() == 0, f'nothing opened yet: the empty box offers only the hint line ({t[:70]})')
    ok(pg.get_attribute('#findIn', 'aria-expanded') == 'true' and pg.evaluate("() => !!document.getElementById(document.getElementById('findIn').getAttribute('aria-controls'))") and pg.get_attribute('#findList', 'role') == 'listbox', 'combobox: aria-expanded is true with the panel open, aria-controls names the listbox')

    # ---- typed on Home: the four groups in order, capped, each other-bill row "Not tracked"
    type_q(pg, 'health')
    gs = groups(pg); heads = [g[0] for g in gs]
    exp_i, exp_b, exp_p = match(pg, 'health', 'issues'), match(pg, 'health', 'bills'), match(pg, 'health', 'people'); exp_o = others_expected(pg, 'health')
    want = [h for h, k in zip(HEAD, [len(exp_i), len(exp_b), len(exp_p), len(exp_o['rows'])]) if k]
    ok(heads == want and len(want) == 4, f'"health" on Home: the groups are {heads}, in the fixed order, a group with no match left out (expected {want})')
    caps = {'Issues': 3, 'Our bills': 3, 'Committees and legislators': 2, 'Other bills at the Legislature': 2}; tot = {'Issues': len(exp_i), 'Our bills': len(exp_b), 'Committees and legislators': len(exp_p), 'Other bills at the Legislature': len(exp_o['rows'])}
    ok(all(len(g[1]) == min(caps[g[0]], tot[g[0]]) for g in gs), f'the panel shows at most 3 issues, 3 bills, 2 committees or legislators, 2 other bills ({[(g[0][:8], len(g[1])) for g in gs]}, found {tot})')
    N = sum(tot.values()); capped = exp_o['n'] >= 40; link = pg.locator('#findList a.fall').inner_text().strip()
    ok(link == ('See all results' if capped else f'See all {N} results'), f'the link reads "{link}" (the data layer gave {exp_o["n"]} other bills; expected {"no number" if capped else N})')
    ok(pg.get_attribute('#findList a.fall', 'href') == '#/search?q=health', 'See all goes to #/search?q=health')
    oth = [r for g in gs if g[0].startswith('Other') for r in g[1]]
    ok(oth and all(r[4] == 'Not tracked' and re.match(r'^(Bill|Resolution|Concurrent resolution|Governor’s message) · nobody on the team tracks it$', r[3]) for r in oth), f'every other-bill row says Not tracked and what it is ({len(oth)} rows)')
    nums = [re.sub(r'^/search/other/', '', r[1].split('?')[0].replace('#', '')) for r in oth]
    inbills = pg.evaluate("async n => { const d = await import('/staff6/data.js'); const s = new Set(d.S.bills.map(b => b.bill_number.toUpperCase())); return n.filter(x => s.has(decodeURIComponent(x).toUpperCase())); }", nums)
    ok(not inbills, f'none of the other bills is one of ours (S.bills): {inbills}')
    mk = pg.evaluate("() => [...document.querySelectorAll('#findList [role=option]:not(.fall)')].filter(a => a.dataset.k).map(a => { const b = a.querySelector('b'), t = b.innerText.toLowerCase().replace(/[^a-z0-9]+/g, ' '), at = (' ' + t).indexOf(' health'); return [at < 0 ? -1 : at, b.innerHTML.includes('<mark>'), a.innerHTML.includes('<mark>')]; })")
    ok(mk and all((m[1] if 0 <= m[0] < 36 else (not m[1] and m[2]) if m[0] < 0 else not m[1]) for m in mk), f'the matched letters are marked where the name shows them (not beyond the cut), else the reason is ({mk})')
    ok(all(not re.match(r'^…', r[2]) for g in gs for r in g[1]), 'no name is cut at its front')
    hs = pg.evaluate("() => [...document.querySelectorAll('#findList [role=option][data-k]')].map(a => [Math.round(a.getBoundingClientRect().height), getComputedStyle(a.querySelector('.fn')).whiteSpace, getComputedStyle(a.querySelector('b')).fontWeight, getComputedStyle(a.querySelector('b')).fontSize])")
    ref = pg.evaluate("() => { const b = document.createElement('a'); b.className = 'sr3 ir'; b.innerHTML = '<span class=\"sv\"><b>x</b></span>'; document.body.appendChild(b); const c = getComputedStyle(b.querySelector('b')); const r = [c.fontWeight, c.fontSize]; b.remove(); return r; }")
    ok(hs and all(h[0] <= 72 and h[1] == 'nowrap' and [h[2], h[3]] == ref for h in hs), f'a row is two lines at most: the name on one line, in the weight and size of the Issues rows ({hs[:2]} against {ref})')
    live = pg.inner_text('#findLive'); ok(re.match(r'^(\d+( or more)? results?|No results)$', live) is not None and (str(N) in live or capped), f'a polite live line says the count: "{live}"')
    ok(pg.get_attribute('#findLive', 'aria-live') == 'polite', 'the live line is polite')
    first = pg.evaluate("() => { const o = document.querySelector('#findList [role=option]'); return [o.getAttribute('aria-selected'), o.id, document.getElementById('findIn').getAttribute('aria-activedescendant'), o.classList.contains('on')]; }")
    ok(first[0] == 'true' and first[1] == first[2] and first[3], f'the first row is highlighted and named by aria-activedescendant ({first})')
    # the second line of an issue and of a bill
    ok(all(re.search(r'(^| · )Issue · ', r[3]) for g in gs if g[0] == 'Issues' for r in g[1]) and all(re.search(r'(^| · )Bill · ', r[3]) for g in gs if g[0] == 'Our bills' for r in g[1]) and all(re.search(r'(^| · )(Committee|Representative · |Senator · )', r[3]) for g in gs if g[0].startswith('Committees') for r in g[1]), 'each row says what it is on its second line')
    snap(pg, 'home-typed.png')
    # ---- arrow keys and Enter
    pg.keyboard.press('ArrowDown'); a1 = pg.evaluate("() => { const o = document.querySelectorAll('#findList [role=option]'); return [o[1].getAttribute('aria-selected'), o[0].getAttribute('aria-selected'), document.getElementById('findIn').getAttribute('aria-activedescendant') === o[1].id]; }")
    ok(a1 == ['true', 'false', True], 'Arrow Down moves the highlight to the second row')
    pg.keyboard.press('ArrowUp'); pg.keyboard.press('ArrowUp'); last = pg.evaluate("() => { const o = [...document.querySelectorAll('#findList [role=option]')]; return o.findIndex(x => x.getAttribute('aria-selected') === 'true') === o.length - 1; }")
    ok(last, 'Arrow Up from the first row goes to the last (See all)')
    pg.keyboard.press('ArrowDown'); pg.keyboard.press('ArrowDown'); pg.keyboard.press('ArrowDown')
    target = pg.evaluate("() => document.querySelector('#findList [role=option][aria-selected=true]').getAttribute('href')"); pg.keyboard.press('Enter'); pg.wait_for_timeout(500)
    ok(pg.evaluate('location.hash') == target and not pg.locator('#findDrop').is_visible(), f'Enter opens the highlighted row ({target[:50]}) and the panel closes')
    # ---- escape: clears, closes, then leaves
    go(pg, '#/'); pg.click('#findIn'); pg.keyboard.type('hea', delay=20); pg.wait_for_timeout(300)
    ok(pg.locator('#findDrop').is_visible(), 'typing opens the panel')
    pg.keyboard.press('Escape'); ok(pg.input_value('#findIn') == '' and not pg.locator('#findDrop').is_visible() and pg.evaluate("() => document.activeElement.id") == 'findIn' and pg.get_attribute('#findIn', 'aria-expanded') == 'false', 'Escape clears the words and closes the panel, and the cursor stays in the box')
    pg.keyboard.press('Escape'); ok(pg.evaluate("() => document.activeElement.id") != 'findIn', 'a second Escape leaves the box')
    # ---- Enter with a closed panel opens nothing
    go(pg, '#/'); pg.click('#findIn'); pg.keyboard.type('youth', delay=20); settle(pg); pg.keyboard.press('Escape'); h0 = pg.evaluate('location.hash'); pg.keyboard.press('Enter'); pg.wait_for_timeout(400)
    ok(pg.evaluate('location.hash') == h0, 'Enter after Escape (panel closed) opens nothing')
    go(pg, '#/'); pg.evaluate("() => document.activeElement.blur()"); pg.click('#findIn'); pg.keyboard.press('Escape'); pg.keyboard.press('Enter'); pg.wait_for_timeout(300)
    ok(pg.evaluate('location.hash') == '#/', 'Enter in an empty box with the panel closed opens nothing (the recent things are not offered unseen)')
    # ---- the minute's redraw, FORCED (the real tick stops while a field has the focus): the panel, the words, the caret and the focus survive; nothing is recorded
    go(pg, '#/'); pg.click('#findIn'); pg.keyboard.type('health', delay=20); settle(pg); pg.evaluate("() => { const i = document.getElementById('findIn'); i.setSelectionRange(2, 4); i.dispatchEvent(new Event('keyup')); }")
    rec0 = pg.evaluate("() => localStorage.getItem('hiphi7_recent')"); pg.evaluate("() => window.__staff7Render({ tick: true })"); pg.wait_for_timeout(600)
    st = pg.evaluate("() => { const i = document.getElementById('findIn'); return { v: i.value, f: document.activeElement.id, s: [i.selectionStart, i.selectionEnd], open: !document.getElementById('findDrop').hidden, rows: document.querySelectorAll('#findList [role=option]').length, ex: i.getAttribute('aria-expanded'), busy: document.getElementById('findW').dataset.busy }; }")
    ok(st['v'] == 'health' and st['f'] == 'findIn' and st['s'] == [2, 4] and st['open'] and st['rows'] > 0 and st['ex'] == 'true', f'a forced redraw while typing leaves the words, the caret, the focus and the open panel alone ({st})')
    ok(pg.evaluate("() => localStorage.getItem('hiphi7_recent')") == rec0, 'a redraw by the tick records nothing')
    settle(pg); ok(pg.locator('#findNone').count() == 0 and any(g[0].startswith('Other') for g in groups(pg)), 'the other bills are asked for again after the redraw')
    # with the box not focused: the words stay, and the other bills come back when the panel is opened again (no "Looking…" forever)
    pg.evaluate("() => document.activeElement.blur()"); pg.evaluate("() => window.__staff7Render({ tick: true })"); pg.wait_for_timeout(400)
    ok(pg.input_value('#findIn') == 'health' and pg.evaluate("() => document.getElementById('findDrop').hidden"), 'a redraw with the box not focused keeps the words and leaves the panel shut')
    pg.click('#findIn'); settle(pg); ok(pg.locator('#findNone').count() == 0 and pg.locator('#findList [role=option]').count() > 0, 'opened again after the redraw the panel shows its results, not "Looking…"')
    pg.keyboard.press('Escape'); pg.keyboard.press('Escape')

    # ---- bills by number
    for typed in ('hb1562', 'HB 1562', '1562'):
        go(pg, '#/'); type_q(pg, typed); g = groups(pg); bills = [r for x in g if x[0] == 'Our bills' for r in x[1]]
        ok(any('/bill/HB1562' in r[1] and r[2] and 'HB 1562' in pg.inner_text('#findList') for r in bills), f'"{typed}" finds HB 1562 among our bills ({[(r[2][:30]) for r in bills]})')
    ok(match(pg, '1562', 'bills').count('HB1562') == 1, 'the data has HB 1562 as one of our bills (checked again from the data)')
    # ---- the okina
    go(pg, '#/issues?who=all'); hawaii = pg.evaluate("async () => { const d = await import('/staff6/data.js'); return d.S.issues.filter(i => !i.archived_at && /[\\u02bb]/.test(i.name)).map(i => [String(i.id), i.name]); }")
    pg.click('#findIn'); pg.fill('#findIn', 'hawaii'); pg.wait_for_timeout(300)
    inlist = pg.evaluate("() => [...document.querySelectorAll('#ilist a.ir, #ialso a.fit')].map(a => decodeURIComponent((a.getAttribute('href').split('/issue/')[1] || '').split('?')[0]))")
    ok(hawaii and all(i in inlist for i, _ in hawaii), f'"hawaii" finds the names with an ʻokina ({[n for _, n in hawaii][:3]})')
    # ---- vape
    pg.fill('#findIn', 'vape'); pg.wait_for_timeout(300); settle(pg)
    cig = pg.evaluate("async () => { const d = await import('/staff6/data.js'); return d.S.issues.filter(i => !i.archived_at && /cigarette/i.test(i.name)).map(i => String(i.id)); }")
    inlist = pg.evaluate("() => [...document.querySelectorAll('#ilist a.ir, #ialso a.fit')].map(a => decodeURIComponent((a.getAttribute('href').split('/issue/')[1] || '').split('?')[0]))")
    ok(cig and all(i in inlist for i in cig), f'"vape" finds the e-cigarette issues ({len(cig)} of them)')
    ok(len(match(pg, 'vape', 'bills')) > 0, '"vape" also finds bills about e-cigarettes in the data')
    body = pg.inner_text('body'); ok(not re.search(r'vap(e|es|ing)', body, re.I), 'the page never prints "vape", "vapes" or "vaping" (the typed words are said back as e-cigarette)')
    go(pg, '#/'); type_q(pg, 'vape'); ok(not re.search(r'vap(e|es|ing)', pg.inner_text('body') + pg.inner_text('#findLive'), re.I) and any(g[0] == 'Our bills' for g in groups(pg)), 'on Home too the panel finds them and never prints "vape"')
    pg.fill('#findIn', '')

    # ---- every issue of a set is found by the first 4 letters of a word in its name (Nate's measure of success)
    FIRST4 = """async (who) => { const D = await (0, eval)('(' + %s + ')')(); return D.setOf(who).map(r => { const words = D.norm(r.name).split(' ').filter(w => w.length >= 4); const w = words[0] || D.norm(r.name).split(' ')[0]; return { id: r.id, name: r.name, q: w.slice(0, 4) }; }); }""" % json.dumps(DATA)
    for who, label, hash in (('KR', 'KR\'s own issues (Mine)', '#/issues'), ('all', 'Everyone', '#/issues?who=all')):
        go(pg, hash); rows = pg.evaluate(FIRST4, 'mine' if who == 'KR' else 'all'); miss = []
        pg.click('#findIn')
        for r in rows:
            pg.fill('#findIn', r['q'])
            found = pg.evaluate("id => !!document.querySelector('#ilist a.ir[href*=\"/issue/' + id + '\"]')", r['id'])
            if not found: miss.append((r['name'], r['q']))
        pg.fill('#findIn', '')
        ok(len(rows) > 5 and not miss, f'{label}: all {len(rows)} issues are found by the first 4 letters of a word in their name ({miss[:3]})')
    pg.close()
    for who in ('JM',):
        pg, ctx2 = open_as(br, who, 1440, 900, '#/issues'); rows = pg.evaluate(FIRST4, 'mine'); miss = []; pg.click('#findIn')
        for r in rows:
            pg.fill('#findIn', r['q'])
            if not pg.evaluate("id => !!document.querySelector('#ilist a.ir[href*=\"/issue/' + id + '\"]')", r['id']): miss.append((r['name'], r['q']))
        ok(len(rows) > 5 and not miss, f'{who}\'s own issues (Mine): all {len(rows)} issues are found by the first 4 letters of a word in their name ({miss[:3]})'); pg.close()

    # ============================================================ Issues: the list narrows in place
    pg, ctx = open_as(br, 'KR', 1440, 900, '#/issues?who=all'); errs, bad = ctx._errs, ctx._bad
    pg.evaluate("() => { window.__app0 = document.getElementById('app').firstElementChild; window.__in0 = document.getElementById('findIn'); }")
    pg.click('#findIn'); pg.wait_for_timeout(200)
    ok(pg.locator('#findDrop').is_visible(), 'on Issues the empty box, focused, still offers Recently opened (or the hint)')
    pg.keyboard.type('health', delay=40); settle(pg)
    st = pg.evaluate("() => ({ same: document.getElementById('app').firstElementChild === window.__app0 && document.getElementById('findIn') === window.__in0, focus: document.activeElement.id, caret: document.getElementById('findIn').selectionStart, val: document.getElementById('findIn').value, hash: location.hash, panel: !document.getElementById('findDrop').hidden })")
    ok(st['same'] and st['focus'] == 'findIn' and st['caret'] == 6 and st['val'] == 'health', f'typing narrows the list in place: the page was not drawn again, focus and caret stay in the box ({st})')
    ok(st['hash'] == '#/issues?who=all&q=health' and not st['panel'], f'the words are in the address, with who kept ({st["hash"]}), and the panel does not cover the list')
    sx = match(pg, 'health', 'issues'); ev = pg.evaluate("() => { const h = [...document.querySelectorAll('#ilist section h3')].map(x => x.innerText.trim().replace(/ · .*/, '')); return { sum: document.getElementById('summ').innerText.replace(/\\s+/g, ' '), rows: document.querySelectorAll('#ilist a.ir').length, heads: h, clear: document.getElementById('findClear')?.innerText, top: document.querySelector('#ilist a.ir b').innerHTML }; }")
    everyone = pg.evaluate("async () => { const d = await import('/staff6/data.js'), st = await import('/staff7/standing.js'); return d.S.issues.filter(i => !i.archived_at && st.billsOfIssue(i).length > 0).map(i => String(i.id)); }")
    inview = [i for i in sx if i in everyone]
    ok(re.match(rf'^{len(inview)} of {len(everyone)} issues match “health”( · also .+ below)? Clear$', ev['sum']) and ev['rows'] == len(inview) and ev['clear'] == 'Clear', f'the summary says "{ev["sum"]}" and the list holds the {len(inview)} matching issues of the view')
    ok(ev['heads'] and all(h in ('At risk', 'Hearing scheduled', 'Moving', 'Stopped this year') or h.startswith('Cleared') for h in ev['heads']) and '<mark>' in ev['top'], f'the list keeps its group headings ({ev["heads"]}) and marks the letters')
    ok(pg.locator('#sessionRow').count() == 0 and pg.locator('#topics').count() == 0, 'the narrowed list shows only issues (no session row, no topics)')
    also = pg.evaluate("() => ({ h: document.getElementById('alsoH')?.innerText, heads: [...document.querySelectorAll('#ialso [role=group] h4')].map(x => x.innerText), all: document.querySelector('#ialso a.fall')?.innerText })")
    ok(also['h'] == 'Also found' and 'Our bills' in also['heads'] and 'Committees and legislators' in also['heads'] and also['all'] and 'Issues' not in also['heads'], f'"Also found" under the list gives the other groups with See all ({also})')
    snap(pg, 'issues-narrowed.png')
    # C1: the count line says what is below, as a link to it
    ncm = len([x for x in match(pg, 'health', 'people') if x.startswith('c:')]); nlg = len(match(pg, 'health', 'people')) - ncm; nb = len(match(pg, 'health', 'bills'))
    lk = pg.evaluate("() => { const a = document.getElementById('alsoLink'); return a ? [a.innerText, a.getAttribute('href')] : null; }")
    ok(lk and lk[1] == '#alsoH' and re.match(r'^also .+ below$', lk[0]) and f'{ncm} committees' in lk[0] and (not nlg or f'{nlg} legislators' in lk[0]) and f'{nb} bills' in lk[0], f'the count line has a link to what is below ({lk}; data: {ncm} committees, {nlg} legislators, {nb} bills)')
    # C2: the arrow keys walk the narrowed issues and then the Also found rows; Enter opens the highlighted one
    pg.click('#findIn'); nil = pg.locator('#ilist [role=option]').count(); nal = pg.locator('#ialso [role=option]').count()
    ok(nil == len(inview) and nal > 0 and pg.get_attribute('#findIn', 'aria-controls') == 'ilist ialso', f'on Issues the narrowed rows and the Also found rows are options of the box ({nil}, {nal}, {pg.get_attribute("#findIn", "aria-controls")})')
    pg.keyboard.press('ArrowDown'); second = pg.evaluate("() => [document.getElementById('findIn').getAttribute('aria-activedescendant'), document.querySelectorAll('#ilist [role=option]')[1].id, document.querySelectorAll('#ilist [role=option]')[1].getAttribute('aria-selected')]")
    ok(second[0] == second[1] and second[2] == 'true', f'Arrow Down on Issues moves to the second narrowed issue ({second})')
    for _ in range(nil - 1): pg.keyboard.press('ArrowDown')
    cur = pg.evaluate("() => { const a = document.getElementById(document.getElementById('findIn').getAttribute('aria-activedescendant')); return [!!a.closest('#ialso'), a.getAttribute('href')]; }")
    ok(cur[0], 'Arrow Down past the last narrowed issue goes into the Also found rows')
    pg.keyboard.press('Enter'); pg.wait_for_timeout(500); ok(pg.evaluate('location.hash') == cur[1], f'Enter opens the highlighted Also found row ({cur[1][:40]})')
    pg.go_back(); pg.wait_for_timeout(700)
    pg.click('#findIn'); pg.keyboard.press('ArrowUp'); ok(pg.evaluate("() => document.getElementById(document.getElementById('findIn').getAttribute('aria-activedescendant')).closest('#ialso') !== null"), 'Arrow Up from the first row wraps to the last Also found row')
    pg.click('#alsoLink'); pg.wait_for_timeout(300)
    ok(pg.evaluate("() => document.activeElement.id") == 'alsoH' and pg.evaluate("() => { const r = document.getElementById('alsoH').getBoundingClientRect(); return r.top >= 0 && r.top < innerHeight; }"), 'the link scrolls to the Also found section and focuses it')
    snap(pg, 'issues-also.png')
    # a view that is not Everyone: the issues outside it are in Also found
    # Back from an opened issue restores the words
    pg.evaluate("() => { const w = document.querySelector('.wl'); w.scrollTop = 120; }"); first_issue = pg.evaluate("() => document.querySelector('#ilist a.ir').getAttribute('href')")
    pg.click('#ilist a.ir'); pg.wait_for_timeout(500)
    ok('#/issue/' in pg.evaluate('location.hash'), 'a click on a row opens the issue')
    pg.go_back(); pg.wait_for_timeout(700)
    ok(pg.evaluate('location.hash') == '#/issues?who=all&q=health' and pg.input_value('#findIn') == 'health' and pg.locator('#summ').inner_text().startswith(f'{len(inview)} of'), 'Back from the opened issue restores the words and the narrowed list')
    ok(pg.evaluate("() => document.querySelector('.wl').scrollTop") > 0, 'Back also finds the list scrolled where it was')
    pg.click('#findClear'); pg.wait_for_timeout(300)
    ok(pg.input_value('#findIn') == '' and 'q=' not in pg.evaluate('location.hash') and pg.locator('#sessionRow').count() == 1 and pg.locator('#topics').count() == 1, 'Clear empties the box, takes q out of the address and brings the whole list back')
    ok(pg.evaluate("() => document.activeElement.id") == 'findIn', 'after Clear the cursor is in the box')
    pg.keyboard.type('zzzzqq', delay=15); settle(pg); ok(pg.locator('#findNone').count() >= 1, 'words that match nothing say so calmly'); pg.fill('#findIn', '')
    # Escape on Issues
    pg.keyboard.type('hea', delay=15); pg.keyboard.press('Escape'); pg.wait_for_timeout(200)
    ok(pg.input_value('#findIn') == '' and 'q=' not in pg.evaluate('location.hash') and pg.locator('#sessionRow').count() == 1, 'Escape on Issues clears the words, the address and the narrowing')
    # a teammate's list and a topic's list narrow to their own set
    go(pg, '#/issues?who=JM'); pg.click('#findIn'); pg.keyboard.type('health', delay=15); settle(pg)
    jm = pg.evaluate("() => ({ sum: document.getElementById('summ').innerText, n: document.querySelectorAll('#ilist a.ir').length, hash: location.hash })")
    mj = pg.evaluate(FIRST4, 'JM'); total_jm = len(mj); matched_jm = [r for r in mj if r['id'] in match(pg, 'health', 'issues')]
    ok(f'{len(matched_jm)} of {total_jm} issues match' in jm['sum'] and jm['n'] == len(matched_jm) and 'who=JM' in jm['hash'], f'on a teammate\'s list the words narrow that list only: "{jm["sum"]}"')
    pg.fill('#findIn', '')
    go(pg, '#/issues/topic/tobacco?who=all'); pg.click('#findIn'); pg.keyboard.type('ban', delay=15); pg.wait_for_timeout(300)
    ok(pg.locator('#summ').count() == 1 and pg.locator('#trail').count() == 1 and 'issues match' in pg.inner_text('#summ'), f'on a topic\'s list the words narrow that topic ({pg.inner_text("#summ")[:50]})')
    pg.fill('#findIn', '')
    ok(pg.evaluate(NOFILTER) == 0, 'no select, checkbox or radio on a narrowed Issues page')
    go(pg, '#/issues?who=all'); pg.click('#findIn'); pg.keyboard.type('health', delay=10); settle(pg); pg.evaluate("() => document.activeElement.blur()")
    ok(pg.locator('#ialso [data-g=other]').count() == 1, 'Issues: the other bills are in Also found before the redraw')
    pg.evaluate("() => window.__staff7Render({ tick: true })"); got = pg.evaluate("() => [document.querySelectorAll('#ialso [data-g=other]').length, document.getElementById('findW').dataset.busy]")
    ok(got == [1, '0'], f'Issues: the redraw keeps the answer it holds for the same words (no blank, no new ask): {got}')
    pg.fill('#findIn', '')
    ok(not errs and not bad, f'Issues: no console error and nothing left 127.0.0.1 ({errs[:2]} {bad[:2]})')
    pg.close()

    # ============================================================ Recently opened
    pg, ctx = open_as(br, 'KR', 1440, 900, '#/'); errs, bad = ctx._errs, ctx._bad
    pg.evaluate("() => localStorage.removeItem('hiphi7_recent')")
    THINGS = pg.evaluate("""async () => { const d = await import('/staff6/data.js'), st = await import('/staff7/standing.js'), S = d.S;
      const iss = S.issues.filter(i => !i.archived_at && st.billsOfIssue(i).length).slice(0, 2); const b = S.bills.find(x => x.bill_number === 'HB1562');
      const cm = Object.values(S.committees).find(c => c.chair); const lg = S.legislators[5]; const idx = (S.snapshot.index || []).find(x => !S.bills.some(b => b.bill_number === x.bill_number));
      return [['#/issue/' + encodeURIComponent(iss[0].id), iss[0].name], ['#/issue/' + encodeURIComponent(iss[1].id), iss[1].name], ['#/bill/HB1562', ''], ['#/search/committee/' + cm.code, cm.name], ['#/search/person/' + lg.id, lg.name], ['#/search/other/' + idx.bill_number, idx.bill_number]]; }""")
    for h, _ in THINGS: go(pg, h)
    go(pg, '#/'); pg.click('#findIn'); pg.wait_for_timeout(250)
    rec = pg.evaluate("() => [...document.querySelectorAll('#findList [role=option]')].map(a => [a.getAttribute('href').split('?')[0], a.querySelector('b').innerText.trim(), a.querySelector('.ir2').innerText.trim()])")
    want = [t[0] for t in THINGS][::-1][:5]
    ok(len(rec) == 5 and [r[0] for r in rec] == want, f'Recently opened holds the last five things, most recent first ({[r[0][:22] for r in rec]})')
    ok(pg.locator('#findDrop h4').first.inner_text() == 'Recently opened' and 'Type a bill number, a name, a topic or a person.' in pg.inner_text('#findDrop'), 'headed "Recently opened" with the hint line under it')
    kinds = [r[2] for r in rec]
    ok(re.match(r'^[A-Za-z’ ]+ · nobody on the team tracks it$', kinds[0]) and kinds[1].startswith(('Representative · ', 'Senator · ')) and kinds[2].startswith('Committee · ') and kinds[3].startswith('Bill · ') and kinds[4].startswith('Issue · '), f'each says what it is: {kinds}')
    snap(pg, 'home-empty-focus.png')
    stored = pg.evaluate("() => JSON.parse(localStorage.getItem('hiphi7_recent'))")
    ok(list(stored.keys()) == ['KR'] and len(stored['KR']) == 5, f'kept in this browser per person ({list(stored.keys())}), five at most')
    pg.reload(); pg.wait_for_selector('.paper', timeout=60000); pg.wait_for_timeout(500); pg.click('#findIn'); pg.wait_for_timeout(250)
    ok(pg.locator('#findList [role=option]').count() == 5, 'Recently opened survives a reload')
    pg.click('#findList [role=option] >> nth=0'); pg.wait_for_timeout(500)
    ok(pg.evaluate('location.hash').startswith(want[0]), 'a click on a recent thing opens it')
    # the minute's tick does not record
    before = pg.evaluate("() => localStorage.getItem('hiphi7_recent')"); pg.evaluate("() => window.__staff7Render({ tick: true })"); pg.wait_for_timeout(300)
    ok(pg.evaluate("() => localStorage.getItem('hiphi7_recent')") == before, 'the minute\'s tick does not record anything')
    # another person in the same browser has their own
    pg2, _ = open_as(br, 'JM', 1440, 900, '#/', ctx=ctx); pg2.click('#findIn'); pg2.wait_for_timeout(250)
    ok(pg2.locator('#findList [role=option]').count() == 0, 'another person in the same browser has their own, empty, list'); pg2.close()
    pg.close()

    # ============================================================ the Search door
    pg, ctx = open_as(br, 'KR', 1440, 900, '#/search?q=health'); errs, bad = ctx._errs, ctx._bad
    settle(pg)
    ok(pg.evaluate("() => document.activeElement.id") == 'findIn' and pg.input_value('#findIn') == 'health', 'the Search door opens with the cursor in the box, and the words from the address in it')
    gs = groups(pg, '#slist'); heads = [g[0] for g in gs]; eo = others_expected(pg, 'health')
    want_heads = [h for h, k in zip(HEAD, [len(match(pg, 'health', 'issues')), len(match(pg, 'health', 'bills')), len(match(pg, 'health', 'people')), len(eo['rows'])]) if k]
    ok(heads == want_heads and len(want_heads) == 4, f'the door lists all four groups in order: {heads}')
    tot = door_totals(pg); cnt = {g[0]: len(g[1]) for g in gs}
    ok(tot['issues'] == len(match(pg, 'health', 'issues')) and tot['bills'] == len(match(pg, 'health', 'bills')) and tot['people'] == len(match(pg, 'health', 'people')) and tot['other'] == min(40, len(eo['rows'])), f'every match is counted in its heading ({tot})')
    ok(all(v <= 5 for v in cnt.values()) and cnt['Issues'] == 5, f'five rows to a group on the door ({cnt})')
    btn = pg.evaluate("() => [...document.querySelectorAll('#slist [data-more]')].map(b => [b.dataset.more, b.innerText.trim(), !!b.closest('[role=listbox]')])")
    ok(btn and all(t == f'Show all {tot[k]} ' + {'issues': 'issues', 'bills': 'bills', 'people': 'committees and legislators', 'other': 'other bills'}[k] and not inl for k, t, inl in btn) and {k for k, _, _ in btn} == {k for k in tot if tot[k] > 5}, f'a "Show all N" link under each group with more than five ({btn})')
    pg.click('#slist [data-more=issues]'); pg.wait_for_timeout(300)
    ok(pg.locator('#slist [data-g=issues] [role=option]').count() == tot['issues'] and 'all=issues' in pg.evaluate('location.hash') and pg.locator('#slist [data-more=issues]').count() == 0, 'Show all opens the rest of the group in place, and remembers it in the address')
    pg.reload(); pg.wait_for_selector('.paper', timeout=60000); settle(pg)
    ok(pg.locator('#slist [data-g=issues] [role=option]').count() == tot['issues'], 'a reload (or Back) finds the group still opened')
    pg.fill('#findIn', 'health'); pg.wait_for_timeout(200)
    ok(pg.locator('#slist [role=option][aria-selected=true]').count() == 0 and pg.locator('#slist .on').count() == 0, 'no row looks selected until the arrow keys are used')
    pg.keyboard.press('ArrowDown'); ok(pg.locator('#slist [role=option][aria-selected=true]').count() == 1 and pg.evaluate("() => document.getElementById('findIn').getAttribute('aria-activedescendant') === document.querySelector('#slist [aria-selected=true]').id"), 'the first Arrow Down highlights the first row')
    ok(pg.locator('#slist [role=option]').count() > 0 and pg.get_attribute('#findIn', 'aria-expanded') == 'true' and not pg.evaluate("() => [...document.querySelectorAll('#slist [role=listbox], #slist [role=group]')].some(l => [...l.children].some(c => !c.matches('[role=option], h3, h4')))"), 'the door\'s list is expanded; only options sit inside a listbox')
    ok(pg.locator('#sessionRow').count() == 0 and pg.locator('main h1').count() == 1 and pg.locator('.paper .hband').count() == 0 and pg.inner_text('#calmLine') == 'Pick a result to look at it here.' and 'Type a bill number' not in pg.inner_text('.paper'), 'the right side is one calm line (no second heading, no repeat of the hint)')
    ok(not re.search(r'Not built yet', pg.inner_text('body')) and pg.locator('.bar a[aria-current=page]').inner_text().strip() == 'Search', 'the Search door is no longer "Not built yet"')
    pg.evaluate("() => document.activeElement.blur()"); snap(pg, 'search-all.png')
    ok(pg.evaluate(NOFILTER) == 0 and pg.evaluate(FILLED) <= 1 and pg.evaluate(NOSIDE) and not pg.evaluate(SMALL), f'door: no filter control, at most one filled button, no sideways scroll, 44px targets ({pg.evaluate(SMALL)[:2]})')
    ok(pg.evaluate("() => document.querySelectorAll('#findLive, #summ[role=status]').length") == 1, 'one live announcement on the door')
    # words typed on the door go in the address without drawing the page again
    go(pg, '#/search?q=health'); pg.click('#findIn'); pg.evaluate("() => { window.__in1 = document.getElementById('findIn'); }"); pg.fill('#findIn', ''); pg.keyboard.type('mental', delay=30); settle(pg)
    ok(pg.evaluate('location.hash') == '#/search?q=mental' and pg.evaluate("() => document.getElementById('findIn') === window.__in1 && document.activeElement.id === 'findIn'"), 'typing on the door writes q into the address and keeps the focus')
    mid = pg.evaluate("async () => { const d = await import('/staff6/data.js'); return Object.values(d.S.committees).map(c => (c.chamber === 'S' ? 'Senate ' : 'House ') + c.name).filter(n => /[a-z]mental/i.test(n)); }")
    ppl = pg.evaluate("() => [...document.querySelectorAll('#slist [data-g=people] [role=option] b')].map(b => b.innerText)")
    ok(mid and not (set(mid) & set(ppl)) and len(ppl) == len(match(pg, 'mental', 'people')) and len(ppl) == door_totals(pg).get('people', 0), f'"mental" matches the START of a word only: {len(mid)} committees have it inside a word ({mid[0]}) and none of them is listed')
    pg.keyboard.press('ArrowDown'); pg.keyboard.press('ArrowUp'); pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    ok(pg.input_value('#findIn') == '' and pg.evaluate('location.hash') == '#/search' and pg.locator('#slist [role=option]').count() <= 5, 'Escape on the door clears the words and shows Recently opened again')
    # one letter shows only the hint; "a b" asks for nothing
    for q1 in ('a', 'a b'):
        pg.fill('#findIn', q1); pg.wait_for_timeout(300)
        ok(pg.locator('#slist [role=option]').count() == 0 and HINT_TXT in pg.inner_text('#slist') and pg.locator('#findNone').count() == 0, f'"{q1}": too short to look for, so only the hint line')
    pg.fill('#findIn', '')
    # ---- the order inside a group, and what other bills are: from the full lists
    go(pg, '#/search?q=health&all=issues,bills,people'); settle(pg)
    for kind in ('issues', 'bills'):
        hrefs = pg.evaluate("k => [...document.querySelectorAll('#slist [data-g=' + k + '] [role=option]')].map(a => a.getAttribute('href'))", kind); al = pg.evaluate(ALIVE, hrefs)
        ok(len(al) > 5 and al == sorted(al, reverse=True), f'KR "health": in {kind} no stopped one comes above an alive one ({sum(al)} alive of {len(al)})')
    top = pg.evaluate("() => [...document.querySelectorAll('#slist [data-g=bills] [role=option]')].map(a => a.getAttribute('href'))")
    ok(any(h.startswith('#/bill/HB1591') for h in top[:6]) and any(h.startswith('#/bill/HB1562') for h in top[:6]), f'KR "health": HB 1591 and HB 1562 (hearings coming) are at the top of Our bills ({[h[:16] for h in top[:5]]})')
    isr = pg.evaluate("() => [...document.querySelectorAll('#slist [data-g=issues] [role=option]')].map(a => a.querySelector('b').innerText)")
    ok(isr and isr[0] == 'Youth mental health app pilot', f'KR "health": her own issue with a hearing today comes first ({isr[:2]})')
    mixed = False
    for q2 in ('health', 'tax', 'school', 'relating'):
        go(pg, f'#/search?q={q2}&all=other'); settle(pg)
        orow = pg.evaluate("() => [...document.querySelectorAll('#slist [data-g=other] [role=option]')].map(a => [a.querySelector('.no').innerText, a.querySelector('.ir2').innerText.split(' · ')[0]])")
        kinds = [bool(re.match(r'^(HB|SB) ', n_)) for n_, _ in orow]; mixed = mixed or (True in kinds and False in kinds)
        want = {'HB': 'Bill', 'SB': 'Bill', 'HR': 'Resolution', 'SR': 'Resolution', 'HCR': 'Concurrent resolution', 'SCR': 'Concurrent resolution', 'GM': 'Governor’s message'}
        ok(orow and kinds == sorted(kinds, reverse=True) and all(k == want[re.match(r'^[A-Z]+', n_).group(0)] for n_, k in orow), f'"{q2}": HB and SB come first among other bills, and each says what it is ({len(orow)} rows, {sorted({k for _, k in orow})})')
    ok(mixed, 'at least one search had both bills and resolutions or messages to order')
    # why a thing matched when its name did not: topic, lead, bill number (marked, at the start of the second line)
    go(pg, '#/search?q=nutrition&all=issues'); settle(pg)
    rows = pg.evaluate("() => [...document.querySelectorAll('#slist [data-g=issues] [role=option]')].map(a => [a.querySelector('b').innerText.toLowerCase(), a.querySelector('.ir2').innerText, !!a.querySelector('.why mark')])")
    nm = [r for r in rows if 'nutrition' not in r[0]]
    ok(nm and all(r[1].startswith('Food & Nutrition · Issue · ') and r[2] for r in nm), f'a topic match says the topic first, marked ({len(nm)} such rows of {len(rows)})')
    go(pg, '#/search?q=james&all=issues'); settle(pg)
    rows = pg.evaluate("() => [...document.querySelectorAll('#slist [data-g=issues] [role=option]')].map(a => [a.querySelector('b').innerText.toLowerCase(), a.querySelector('.ir2').innerText, !!a.querySelector('.why mark')])")
    ok(rows and all(r[1].startswith('James leads · Issue · ') and r[2] for r in rows if 'james' not in r[0]), f'a lead match says "James leads" first, marked ({len(rows)} rows)')
    go(pg, '#/search?q=hb1562&all=issues'); settle(pg)
    rows = pg.evaluate("() => [...document.querySelectorAll('#slist [data-g=issues] [role=option]')].map(a => [a.querySelector('b').innerText, a.querySelector('.ir2').innerText, !!a.querySelector('.why mark, .no mark')])")
    ok(rows and rows[0][0] == 'Youth mental health app pilot' and rows[0][1].startswith('HB 1562 · Issue · ') and rows[0][2], f'a bill-number match says the number first ({rows[:1]})')
    names = pg.evaluate("() => [...document.querySelectorAll('#slist [role=option] b')].map(b => b.innerText)")
    ok(not any(x.startswith('…') for x in names), 'no row name starts with an ellipsis')
    # E1: no word set found in full: the closest
    go(pg, '#/search?q=youth+mental+health+app+pilot+wildfire'); settle(pg)
    ok(pg.inner_text('#findClosest') == 'No match for every word. Closest:' and pg.locator('#slist [role=option]').count() > 0, 'a long phrase nothing matches in full shows the closest, under "No match for every word. Closest:"')
    go(pg, '#/search?q=zzzzqq'); settle(pg)
    ok(pg.locator('#slist [role=option]').count() == 0 and 'Nothing found for “zzzzqq”.' in pg.inner_text('#findNone') and HINT_TXT in pg.inner_text('#slist') and pg.locator('#findClosest').count() == 0, 'nothing at all: the calm line and the hint')
    pg.keyboard.press('Escape')
    # D4: a result picked on the door keeps the list where it was; Back and Forward restore it
    go(pg, '#/search?q=health&all=issues,bills,people'); settle(pg)
    pos = pg.evaluate("() => { const a = document.querySelector('#slist a[data-k=cmte]'); a.scrollIntoView({ block: 'center' }); const w = document.querySelector('.wl'); w.scrollTop += 300; return w.scrollTop; }"); pg.wait_for_timeout(200)
    pg.evaluate("() => { const w = document.querySelector('.wl'); const a = [...document.querySelectorAll('#slist a[data-k=cmte]')].find(x => { const r = x.getBoundingClientRect(); return r.top > 100 && r.bottom < innerHeight; }); a.click(); }"); pg.wait_for_timeout(600)
    after = pg.evaluate("() => document.querySelector('.wl').scrollTop")
    ok(pos > 300 and abs(after - pos) <= 2 and '/search/committee/' in pg.evaluate('location.hash'), f'a click on a door result keeps the list scroll ({pos} then {after})')
    pg.go_back(); pg.wait_for_timeout(700); back = pg.evaluate("() => document.querySelector('.wl').scrollTop")
    ok(abs(back - pos) <= 3, f'Back finds the list where it was ({pos} then {back})')
    pg.go_forward(); pg.wait_for_timeout(700); fwd = pg.evaluate("() => document.querySelector('.wl').scrollTop")
    ok(abs(fwd - pos) <= 3 and '/search/committee/' in pg.evaluate('location.hash'), f'Forward does too ({fwd})')
    # the sheets
    go(pg, '#/search?q=health'); settle(pg)
    # --- a committee
    row = pg.evaluate("() => { const a = [...document.querySelectorAll('#slist a[data-k=cmte]')][0]; return [a.getAttribute('href'), a.querySelector('b').innerText]; }")
    pg.click(f'#slist a[href="{row[0]}"]'); pg.wait_for_timeout(500)
    code = re.search(r'committee/([^?]+)', row[0]).group(1)
    cd = pg.evaluate("""async code => { const d = await import('/staff6/data.js'), mo = await import('/staff6/model.js'), S = d.S; const c = S.committees[code]; const ms = S.committeeMembers.filter(m => m.committee === code);
      const nm = id => S.legislators.find(l => l.id === id)?.name; const now = Date.now();
      const codes = c => String(c || '').split('/').map(x => x.trim()).filter(Boolean);
      const placed = b => { if (b.tracked === false || mo.diedish(b)) return null; const st = mo.stopOf(b); if (st.phase !== 'committee') return null; const cur = codes(st.committee); if (cur.includes(code)) return 'here';
        const refs = (b.referrals || []).map(codes), k = refs.findIndex(r => r.some(x => cur.includes(x))); return k >= 0 && refs[k + 1] && refs[k + 1].includes(code) && S.committees[code].chamber === st.chamber ? 'next' : null; };
      const mine = S.bills.filter(b => placed(b)).length, here = S.bills.filter(b => placed(b) === 'here').length;
      return { chair: c.chair, chairs: ms.filter(m => m.role === 'chair').map(m => nm(m.legislator_id)), vices: ms.filter(m => m.role === 'vice_chair').map(m => nm(m.legislator_id)), members: ms.length, mine, here, name: (c.chamber === 'S' ? 'Senate ' : 'House ') + c.name }; }""", code)
    ev = pg.evaluate("() => ({ h1: document.querySelector('main h1').innerText.trim(), kv: [...document.querySelectorAll('.paper .kv > div')].map(d => [d.querySelector('dt').innerText, d.querySelector('dd').innerText]), people: document.querySelectorAll('.paper a[href^=\"#/search/person/\"]').length, bills: [...document.querySelectorAll('.paper a[data-k=bill]')].map(a => a.getAttribute('href')), lines: [...document.querySelectorAll('.paper a[data-k=bill] .ir2')].map(x => x.innerText), marks: document.querySelectorAll('.paper mark').length, sits: [...document.querySelectorAll('.paper a[href^=\"#/calendar/sitting/\"]')].map(a => a.getAttribute('href')), sel: document.querySelector('#slist a.sel')?.getAttribute('href') })")
    ok(ev['h1'] == cd['name'] == row[1], f'a committee opens its short sheet on the right: "{ev["h1"]}"')
    ok(dict(ev['kv']).get('Chair', '') == ', '.join(cd['chairs']) and dict(ev['kv']).get('Vice chair', '') == ', '.join(cd['vices']), f'Chair and Vice chair ({ev["kv"]})')
    ok(ev['people'] == cd['members'], f'its members are links to their sheet ({ev["people"]} of {cd["members"]})')
    ok(len(ev['bills']) == cd['mine'] and all(b.startswith('#/bill/') for b in ev['bills']), f'our bills in the committee link to their sheet ({len(ev["bills"])}, data says {cd["mine"]})')
    ok(len(ev['lines']) > 0 and all(re.match(r'^Bill · (Here now|Comes here next, after .+)', l) for l in ev['lines']) and sum(1 for l in ev['lines'] if l.startswith('Bill · Here now')) == cd['here'], f'each bill says whether it is here now or comes here next ({ev["lines"][:2]}; {cd["here"]} here now)')
    ok(ev['marks'] == 0, 'no mark inside the sheet (marks belong to results)')
    ok(ev['sel'] and ev['sel'].split('?')[0] == f'#/search/committee/{code}', 'the open row is marked on the left')
    ok(f'#/search/committee/{code}?q=health' == pg.evaluate('location.hash'), 'the address is #/search/committee/<code>?q=...')
    snap(pg, 'search-committee.png')
    ok(pg.evaluate(NOFILTER) == 0 and pg.evaluate(FILLED) <= 1 and pg.evaluate(NOSIDE), 'committee sheet: no filter control, at most one filled button, no sideways scroll')
    ok(not re.search(r'@|\b808-', pg.inner_text('.paper')), 'no phone or email on the sheet')
    # a hearing link, when there is one
    # --- a person: the chair
    chair_link = pg.locator('.paper .kv a[href^="#/search/person/"]').first; cn = chair_link.inner_text(); stale = chair_link.get_attribute('href')
    pg.click('#findIn'); pg.fill('#findIn', 'water'); pg.wait_for_timeout(200)
    chair_link.click(); pg.wait_for_timeout(500)
    ok(stale.endswith('?q=health') and pg.evaluate('location.hash').endswith('?q=water'), f'a link drawn on a sheet reads the words as they are when it is used ({stale[-10:]} drawn, now {pg.evaluate("location.hash")[-10:]})')
    pd = pg.evaluate("() => ({ h1: document.querySelector('main h1').innerText.trim(), sub: document.querySelector('main .bsub')?.innerText, kv: Object.fromEntries([...document.querySelectorAll('.paper .kv > div')].map(d => [d.querySelector('dt').innerText, d.querySelector('dd').innerText])), cm: [...document.querySelectorAll('.paper a[href^=\"#/search/committee/\"]')].map(a => a.getAttribute('href')), txt: document.querySelector('.paper').innerText })")
    leg = pg.evaluate("""async name => { const d = await import('/staff6/data.js'), S = d.S; const l = S.legislators.find(x => x.name === name); return { id: l.id, d: l.district, places: l.places, ch: l.chamber, room: l.room, cms: S.committeeMembers.filter(m => m.legislator_id === l.id).length, party: l.party }; }""", cn)
    ok(pd['h1'] == cn and pd['sub'] == ('Senator' if leg['ch'] == 'S' else 'Representative') and pd['kv'].get('District', '').startswith(str(leg['d'])) and (not leg['places'] or leg['places'] in pd['kv'].get('District', '')), f'a legislator\'s sheet: name, role, district and its places ({pd["h1"]}, {pd["sub"]}, {pd["kv"].get("District", "")[:40]})')
    ok(len(pd['cm']) == leg['cms'] and 'Chair' in pd['txt'], f'it lists the committees they sit on with their role, as links ({len(pd["cm"])} of {leg["cms"]})')
    ok(not re.search(r'@|\b808-|Phone|Email', pd['txt']), 'no phone or email on a legislator\'s sheet')
    snap(pg, 'search-person.png')
    pg.click('.paper a[href^="#/search/committee/"] >> nth=0'); pg.wait_for_timeout(400)
    ok(pg.evaluate('location.hash').startswith('#/search/committee/'), 'a committee on a legislator\'s sheet links back to the committee sheet')
    go(pg, '#/search/committee/HLT'); l709 = pg.evaluate("() => { const a = document.querySelector('.paper a[href^=\"#/bill/SB709\"]'); return a ? a.querySelector('.ir2').innerText : null; }")
    ok(l709 is not None and l709.startswith('Bill · Here now, together with House Human Services') and not re.search(r'in House Human', l709), f'SB 709 (a joint referral) says it is here now together with the other committee ({l709})')
    # a committee's bills and hearing links open real pages
    cms = pg.evaluate("""async () => { const d = await import('/staff6/data.js'), mo = await import('/staff6/model.js'), S = d.S; return Object.keys(S.committees).map(code => [code, S.bills.filter(b => b.tracked !== false && !mo.diedish(b) && mo.stopOf(b).phase === 'committee' && String(mo.stopOf(b).committee || '').split('/').map(x => x.trim()).includes(code)).length]).filter(x => x[1] > 0).sort((a, b) => b[1] - a[1]); }""")
    go(pg, f'#/search/committee/{cms[0][0]}'); bl = pg.locator('.paper a[data-k=bill]').first; bh = bl.get_attribute('href'); bl.click(); pg.wait_for_timeout(500)
    ok(pg.evaluate('location.hash').startswith('#/bill/') and not pg.evaluate("() => !!document.querySelector('[data-notfound]')"), f'a bill in the committee opens its short bill sheet ({bh[:30]})')
    noi = pg.evaluate("async () => { const d = await import('/staff6/data.js'), S = d.S; const act = new Set(S.issues.filter(i => !i.archived_at).map(i => i.id)); const w = new Set(S.billIssues.filter(x => act.has(x.issue_id)).map(x => x.bill_id)); return S.bills.filter(b => b.tracked !== false && !w.has(b.id)).slice(0, 3).map(b => b.bill_number); }")
    for num in noi:
        go(pg, '#/search?q=' + num); settle(pg); pg.click(f'#slist a[data-k=bill][href^="#/bill/{num}"]'); pg.wait_for_timeout(500)
        ok(pg.evaluate('location.hash').startswith(f'#/bill/{num}') and pg.locator('[data-notfound]').count() == 0 and pg.locator('a.back2:has-text("Back to Issues")').count() == 1, f'{num}: one of our bills that is on no issue still opens its short bill sheet (no dead end)')
    sit = None
    for code, _ in [(c, 0) for c in pg.evaluate("async () => Object.keys((await import('/staff6/data.js')).S.committees)")]:
        go(pg, f'#/search/committee/{code}'); s = pg.locator('.paper a[href^="#/calendar/sitting/"]')
        if s.count(): sit = (code, s.first.get_attribute('href')); break
    ok(sit is not None, f'a committee with a coming hearing links it to Calendar ({sit})')
    if sit:
        pg.click('.paper a[href^="#/calendar/sitting/"] >> nth=0'); pg.wait_for_timeout(600)
        ok('/calendar/sitting/' in pg.evaluate('location.hash') and not pg.evaluate("() => !!document.querySelector('[data-notfound]')") and pg.locator('main h1').count() == 1, 'the hearing link opens Calendar\'s sitting page')
    # --- a bill not tracked
    go(pg, '#/search?q=health'); settle(pg)
    orow = pg.evaluate("() => { const a = document.querySelector('#slist a[data-k=other]'); return [a.getAttribute('href'), a.querySelector('b').innerText, a.querySelector('.no').innerText]; }")
    pg.click(f'#slist a[href="{orow[0]}"]'); pg.wait_for_timeout(500)
    od = pg.evaluate("() => ({ h1: document.querySelector('main h1').innerText.trim(), sub: document.querySelector('main .bsub')?.innerText, txt: document.querySelector('.paper').innerText, link: document.getElementById('oCapitol')?.getAttribute('href'), btns: [...document.querySelectorAll('.paper .btn')].map(b => b.innerText), pill: document.getElementById('notTracked')?.innerText })")
    ok(od['h1'] == orow[2] and od['pill'] == 'Not tracked' and 'Nobody on the team tracks this bill, so there is nothing to do here yet.' in od['txt'] and 'Look only' not in od['txt'], f'a bill not tracked: its number, the pill Not tracked and the look-only line ({od["h1"]})')
    ok(od['link'] and od['link'].startswith('https://www.capitol.hawaii.gov/') and orow[2].replace(' ', '') .lower() in od['link'].lower().replace('billtype=', '').replace('&billnumber=', ''), f'a link to the Capitol site ({od["link"]})')
    ok(not any(re.search(r'Track', b) for b in od['btns']) and od['sub'], f'no Track button; the official title is shown ({od["sub"][:40]})')
    snap(pg, 'search-other.png')
    # --- not found
    for h, what in (('#/search/committee/ZZZ', 'committee'), ('#/search/person/99999999', 'person'), ('#/search/other/XX0000', 'other'), ('#/search/other/HB1562', 'tracked as other'), ('#/search/bogus', 'part'), ('#/search/person/%E0%A4%A', 'bad encoding')):
        go(pg, h); ok(pg.locator('[data-notfound]').count() == 1 and 'We could not find' in pg.evaluate(H1) and pg.locator('.paper a:has-text("Back to Search")').count() == 1, f'{h}: the calm "not found" sheet ({pg.evaluate(H1)})')
    ok(not errs and not bad, f'Search: no console error and nothing left 127.0.0.1 ({errs[:2]} {bad[:2]})')
    pg.close()

    # ============================================================ Calendar and the page widths
    pg, ctx = open_as(br, 'KR', 1440, 900, '#/calendar'); errs, bad = ctx._errs, ctx._bad
    ok(pg.locator('.wl #findIn').count() == 1 and pg.evaluate("() => document.getElementById('findIn').getBoundingClientRect().top < 400"), 'Calendar (the week grid): the box is in the page\'s header row')
    pg.click('#findIn'); pg.keyboard.type('mental', delay=15); settle(pg)
    ok(pg.locator('#findDrop').is_visible() and pg.locator('#findList [role=option]').count() > 0 and pg.evaluate("() => { const d = document.getElementById('findDrop').getBoundingClientRect(), g = document.querySelector('.cgrid')?.getBoundingClientRect(); return !g || d.bottom > g.top; }"), 'the panel opens over the week grid on Calendar')
    snap(pg, 'calendar-box.png'); pg.keyboard.press('Escape'); pg.keyboard.press('Escape')
    ok(pg.evaluate(NOSIDE) and pg.evaluate(FILLED) <= 1 and not pg.evaluate(SMALL), f'Calendar with the box: no sideways scroll, one filled button at most, 44px targets ({pg.evaluate(SMALL)[:2]})')
    # B1, B2: the panel ends inside the window with "See all" in view, and covers the column's full width
    PB = "() => { const d = document.getElementById('findDrop'), r = d.getBoundingClientRect(), f = d.querySelector('.fall'), fr = f ? f.getBoundingClientRect() : null, b = document.getElementById('findB').getBoundingClientRect(); return { bottom: r.bottom, h: innerHeight, fall: fr ? [fr.top, fr.bottom] : null, scroll: d.scrollHeight > d.clientHeight + 1, left: r.left, right: r.right, bl: b.left, br: b.right }; }"
    for (vw, vh) in ((1440, 900), (1280, 800)):
        pg.set_viewport_size({'width': vw, 'height': vh}); pg.wait_for_timeout(300)
        for page in ('#/', '#/calendar'):
            go(pg, page); pg.click('#findIn'); pg.fill('#findIn', ''); pg.keyboard.type('health', delay=10); settle(pg); bx = pg.evaluate(PB)
            ok(bx['bottom'] <= bx['h'] and bx['fall'] and 0 <= bx['fall'][0] and bx['fall'][1] <= bx['h'] + 1, f'{vw}x{vh} {page}: the panel ends inside the window and "See all" is in view ({bx["bottom"]:.0f} of {bx["h"]}, See all {bx["fall"]})')
            ok(bx['left'] <= bx['bl'] - 8 and bx['right'] >= bx['br'] + 8, f'{vw}x{vh} {page}: the panel covers the column\'s full width ({bx["left"]:.0f}-{bx["right"]:.0f} against the box {bx["bl"]:.0f}-{bx["br"]:.0f})')
            if (vw, page) == (1440, '#/'): ok(not bx['scroll'], 'at 1440x900 the four groups for "health" fit the panel without scrolling')
            if (vw, page) == (1440, '#/calendar'): snap(pg, 'calendar-typed.png')
            pg.keyboard.press('Escape'); pg.keyboard.press('Escape')
    pg.set_viewport_size({'width': 1440, 'height': 900}); pg.wait_for_timeout(300)
    # B5: a failed search of the other bills is said, not "Nothing found"
    pg.evaluate("async () => { const d = await import('/staff6/data.js'); d.DB.searchUntracked = async () => { throw new Error('down'); }; }")
    go(pg, '#/'); pg.click('#findIn'); pg.keyboard.type('health', delay=10); settle(pg)
    ok(pg.inner_text('#otherFail') == 'The other bills could not be searched. Try again.' and pg.locator('#findNone').count() == 0 and not any(g[0].startswith('Other') for g in groups(pg)) and len(groups(pg)) >= 3, 'a failed search of the other bills says so in that group\'s place')
    go(pg, '#/search?q=zzzzqq'); settle(pg)
    ok(pg.inner_text('#otherFail') == 'The other bills could not be searched. Try again.' and pg.locator('#findNone').count() == 0, 'on the door too, a failure is not read as "Nothing found"')
    for h in ('#/', '#/issues', '#/issues?who=all&q=health', '#/calendar?view=list', step):
        go(pg, h); pg.wait_for_timeout(300); ok(pg.evaluate(NOSIDE) and pg.evaluate(FILLED) <= 1 and not pg.evaluate(SMALL), f'1440: {h[:30]}: no sideways scroll, one filled button at most, 44px targets ({pg.evaluate(SMALL)[:2]})')
    ok(not errs and not bad, f'Calendar and the rest: no console error, nothing left 127.0.0.1 ({errs[:2]} {bad[:2]})')
    pg.close()

    # ============================================================ phone
    pg, ctx = open_as(br, 'KR', 390, 844, '#/search?q=health'); errs, bad = ctx._errs, ctx._bad; settle(pg)
    ok(pg.evaluate("() => document.activeElement.id") != 'findIn', 'on a phone the Search door does not raise the keyboard on arrival')
    top = pg.evaluate("() => { const i = document.getElementById('findIn').getBoundingClientRect(), l = document.querySelector('#slist [role=option]').getBoundingClientRect(); return [i.top, l.top, i.width, innerWidth]; }")
    ok(top[0] < top[1] and top[2] > 250, f'phone: the box sits on top of the list ({top})')
    ok(pg.evaluate(NOSIDE) and not pg.evaluate(SMALL) and pg.evaluate(NOFILTER) == 0, f'phone Search: no sideways scroll, 44px targets ({pg.evaluate(SMALL)[:2]})')
    snap(pg, 'phone-search.png')
    pg.click('#slist a[data-k=cmte] >> nth=0'); pg.wait_for_timeout(500)
    ok(pg.locator('.paper').is_visible() and pg.locator('.wl').is_hidden() and pg.locator('a.back:has-text("Back to Search")').is_visible(), 'phone: picking a result shows its sheet with a "Back to Search" link')
    ok(pg.evaluate(NOSIDE), 'phone: the sheet has no sideways scroll')
    pg.click('a.back:has-text("Back to Search")'); pg.wait_for_timeout(500)
    ok(pg.evaluate('location.hash') == '#/search?q=health' and pg.locator('#slist').is_visible(), 'Back to Search returns to the results with the words')
    for h in ('#/', '#/issues?who=all', '#/calendar'):
        go(pg, h); pg.click('#findIn'); pg.keyboard.type('mental', delay=15); pg.wait_for_timeout(500); settle(pg)
        r = pg.evaluate("() => { const d = document.getElementById('findDrop'), w = document.getElementById('findB').getBoundingClientRect(); const r = d && !d.hidden ? d.getBoundingClientRect() : null; return { open: !!r, side: document.documentElement.scrollWidth <= innerWidth, within: r ? r.left >= 0 && r.right <= innerWidth : true, w: r ? r.width : 0, box: w.width }; }")
        ok(r['side'] and r['within'] and (not r['open'] or r['w'] >= r['box'] - 2), f'phone {h}: the panel (or the narrowed list) is full width with no sideways scroll ({r})')
        ok(not pg.evaluate(SMALL), f'phone {h}: 44px targets with words typed ({pg.evaluate(SMALL)[:2]})')
    ok(not errs and not bad, f'phone: no console error, nothing left 127.0.0.1 ({errs[:2]} {bad[:2]})')
    pg.close()
    br.close()
print(f'{sum(res)}/{len(res)} passed')
sys.exit(0 if all(res) else 1)
