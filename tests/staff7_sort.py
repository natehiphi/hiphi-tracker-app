# Staff7's Sort new bills (R-398), on the practice copy: "New bills" under Issues, the list (one row per bill, grouped by the coalition it will go under), the page for the picked bill (what it
# does, the four fields), Track / Not for us / Skip for now, the toast with Undo (10 seconds), "Just sorted", the keys, the empty states, the admin's switch and the helper's view.
# Rules kept by this file: the entry row is only for someone who sorts and only in Mine; the count is the rows; a bill is one row; groups come in the app's order; Track needs an issue (or "No issue yet");
# Track puts the bill on the team only (never public) and Undo puts back what it changed; Skip saves nothing; nothing in the practice copy leaves 127.0.0.1 or is a write; no sideways scroll at 1440, 1280 and 390;
# the three fixes of Nate's review (the why-line in two lines at most, the three buttons in fixed places, line 1 of a row two full lines cut at a word).
#   python3 tests/staff7_sort.py [base] [shots folder]     base defaults to http://127.0.0.1:8851
import sys, os, re, json
from playwright.sync_api import sync_playwright
BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8851').rstrip('/')
SHOTS = sys.argv[2] if len(sys.argv) > 2 else ''
if SHOTS: os.makedirs(SHOTS, exist_ok=True)
res = []
def ok(c, m): res.append(bool(c)); print('PASS' if c else 'FAIL', m, flush=True)

NOSIDE = "() => document.documentElement.scrollWidth <= innerWidth && [...document.querySelectorAll('.paper, .wl')].every(p => p.scrollWidth <= p.clientWidth + 1)"
SMALL = "() => [...document.querySelectorAll('.btn, .sr3, .seg')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.height < 43.5 && getComputedStyle(e).visibility !== 'hidden' }).map(e => e.className + ' ' + e.innerText.slice(0, 20))"
# the list as drawn: [[group label, heading count, [bill numbers]]], and the one summary line
LIST = """() => [...document.querySelectorAll('.wl section[aria-labelledby^="g-"]')].map(s => [s.querySelector('h3').innerText.trim().replace(/ · [\\d,]+$/, ''), +/ · ([\\d,]+)$/.exec(s.querySelector('h3').innerText.trim())[1].replace(/,/g, ''), [...s.querySelectorAll('a.sr3[data-no]')].map(a => a.dataset.no)])"""
NUMS = "() => [...document.querySelectorAll('.wl a.sr3[data-no]')].map(a => a.dataset.no)"
SUM = "() => (document.getElementById('sortSum') || {}).innerText || ''"
H1 = "() => [...document.querySelectorAll('main h1')].find(h => h.getBoundingClientRect().width > 0)?.innerText.trim()"
OPEN = "() => document.querySelector('.wl a.sr3.sel')?.dataset.no || ''"
TOAST = "() => { const t = document.getElementById('toast'); return t && t.classList.contains('on') ? t.querySelector('#toastMsg').innerText.trim() : null; }"
# what the page's own model says (the data module), read from the page: used to PICK bills, never to judge them
MODEL = """async () => { const D = await import('/staff7/sort_data.js'), d = await import('/staff6/data.js'); const me = d.S.me, mode = location.hash.includes('show=all') ? 'all' : 'matching', l = D.listFor(me, mode);
  return { rows: l.rows.map(m => ({ no: m.no, group: m.group, sg: !!D.suggestion(m), also: m.also.map(c => c.name), comp: m.comp, fol: m.followers, terms: m.terms.length, sample: !!m.r.sample, sp: (m.r.sponsors || []).length, refs: (m.r.referrals || []).length, look: !!m.r.lookalike, sim: !!m.r.similar, desc: (m.r.description || '').length, why: D.fieldsOf(m, me).why })),
    camps: d.S.campaigns.map(c => c.public_name || c.name), me: me.initials, sorts: D.sorts(me) }; }"""

def external_blocker(ctx, bad, seen):
    def h(route):
        u = route.request.url
        if 'fonts.g' in u: return route.continue_()
        bad.append(u); route.abort()
    ctx.route(lambda u: '127.0.0.1' not in u and 'localhost' not in u, h)
    ctx.on('request', lambda r: seen.append((r.method, r.url)))
def open_as(br, who, w, h, hash='#/issues/new'):
    ctx = br.new_context(viewport={'width': w, 'height': h}); bad = []; seen = []; external_blocker(ctx, bad, seen); pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'Failed to load resource' not in m.text and 'ERR_FAILED' not in m.text else None)
    pg.goto(f'{BASE}/staff7.html?demo=1' + (f'&as={who}' if who != 'default' else '') + hash); pg.wait_for_selector('.paper', timeout=60000)
    pg.evaluate("Promise.all([document.fonts.load('600 16px Poppins'), document.fonts.load('400 16px Lato'), document.fonts.load('700 16px Lato'), document.fonts.load('500 16px Poppins')])"); pg.wait_for_timeout(400)
    pg.bad, pg.seen, pg.errs = bad, seen, errs
    return pg
def ready(pg, sel='.wl a.sr3[data-no]'):
    pg.wait_for_selector(sel, timeout=30000); pg.wait_for_timeout(350)
def go(pg, hash): pg.evaluate("h => { location.hash = h; }", hash); pg.wait_for_timeout(450)
def snap(pg, name):
    if SHOTS: pg.screenshot(path=os.path.join(SHOTS, name + '.png'))
def intn(s): return int(re.sub(r'[^\d]', '', s) or 0)
# where the three buttons stand: across, and down from the top of the decision block (the facts above it differ from bill to bill)
BTNS = "() => { const t = document.getElementById('decide').getBoundingClientRect().top; return ['sTrack', 'sNot', 'sSkip'].map(i => { const b = document.getElementById(i).getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top - t)]; }); }"
def spied(pg):   # record what Track is asked to do (the practice copy answers from memory; this only reads the call)
    pg.evaluate("""async () => { const d = await import('/staff6/data.js'); window.__calls = []; const o = d.DB.triageTrackTeam.bind(d.DB); d.DB.triageTrackTeam = async (row, a) => { window.__calls.push({ no: row.bill_number, ...a }); return o(row, a); }; }""")
def spaced(n): return re.sub(r'^([A-Z]+)(\d)', r'\1 \2', n)

PEOPLE = ['default', 'KV', 'KR', 'JS', 'JM', 'LR', 'SY', 'MR', 'JN', 'PH', 'PT', 'RK', 'JMM']
with sync_playwright() as p:
    br = p.chromium.launch()

    # ---------------------------------------------------------------- who sorts: the entry row on Issues
    pg = open_as(br, 'NT', 1440, 900, '#/issues'); ready(pg, '#newBillsRow')
    t = pg.locator('#newBillsRow').inner_text().replace('\n', ' ')
    ok(re.fullmatch(r'New bills\s+(400\+|[\d,]+) to sort', t) and pg.locator('#newBillsRow').get_attribute('href') == '#/issues/new', f'NT (admin): Mine has a "New bills" row with its count ({t!r})')
    ok(pg.evaluate("() => { const a = document.getElementById('sessionRow'), b = document.getElementById('newBillsRow'); return a.closest('ul') === b.closest('ul') && a.closest('li').nextElementSibling === b.closest('li'); }"), 'the row is the one right under "The session"')
    entry_n = pg.locator('#newBillsN').inner_text()
    snap(pg, 'sort_entry_NT')
    pg.click('#whoAll'); pg.wait_for_timeout(400)
    ok(pg.locator('#newBillsRow').count() == 0, 'Everyone: no New bills row')
    pg.click('#whoMate'); pg.click('.whopick a >> nth=0'); pg.wait_for_timeout(400)
    ok('who=' in pg.url and pg.locator('#newBillsRow').count() == 0, 'A teammate: no New bills row')
    pg.click('#whoMine'); pg.wait_for_timeout(400)
    ok(pg.locator('#newBillsRow').count() == 1, 'back on Mine the row is there again')
    pg.click('#newBillsRow'); ready(pg)
    ok('#/issues/new' in pg.url and pg.evaluate(SUM) == f'{entry_n}', f'the row opens New bills and its line says the same count ({entry_n!r} / {pg.evaluate(SUM)!r})')
    pg.context.close()

    pg = open_as(br, 'JMM', 1440, 900, '#/issues'); ready(pg, '#newBillsRow')
    t = pg.locator('#newBillsRow').inner_text().replace('\n', ' ')
    ok(re.fullmatch(r'New bills\s+[\d,]+ to sort', t), f'JMM (a coalition helper): Mine has the row ({t!r})')
    pg.context.close()

    # a person who does not sort: no row, and the address says so calmly
    nonsort = None
    for who in PEOPLE[1:]:
        pg = open_as(br, who, 1440, 900, '#/issues'); pg.wait_for_timeout(600)
        s = pg.evaluate("async () => { const D = await import('/staff7/sort_data.js'), d = await import('/staff6/data.js'); return D.sorts(d.S.me); }")
        if not s and nonsort is None:
            nonsort = who; has = pg.locator('#newBillsRow').count(); go(pg, '#/issues/new'); pg.wait_for_timeout(400)
            ok(has == 0 and pg.locator('[data-notfound]').count() == 1 and pg.locator('.wl #sortSum').count() == 0, f'{who} does not sort: no New bills row, and #/issues/new says it cannot be found, nothing to sort')
        pg.context.close()
        if nonsort: break
    ok(nonsort is not None, 'there is a person in the practice data who does not sort')

    # ---------------------------------------------------------------- the helper's list (JMM): matching words only, no switch
    pg = open_as(br, 'JMM', 1440, 900); ready(pg)
    M = pg.evaluate(MODEL); g = pg.evaluate(LIST); nums = pg.evaluate(NUMS)
    ok(pg.locator('.wl .segs3').count() == 0 and pg.locator('#modeAll').count() == 0, 'helper: no switch between Matching words and All new bills')
    ok(len(nums) == len(set(nums)) and intn(pg.evaluate(SUM)) == len(nums) and 'to sort' in pg.evaluate(SUM), f'helper: one row per bill and the line says the count ({pg.evaluate(SUM)!r}, {len(nums)} rows)')
    ok(all(int(c) == len(n) for _, c, n in g) and sum(int(c) for _, c, _ in g) == len(nums), 'helper: every group heading carries the number of its rows')
    ok(not any(l == 'Followed on the public site' for l, _, _ in g), 'helper: no "Followed on the public site" group (admin only)')
    drug = [x for x in M['camps'] if 'Drug-Free' in x]
    ok(all(l in (drug + ['Weak match']) for l, _, _ in g), f'helper: bills are grouped under the coalition the helper helps on, or Weak match ({[l for l, _, _ in g]})')
    snap(pg, 'sort_helper_list')
    ok(pg.evaluate(NOSIDE), 'helper: no sideways scroll at 1440')
    pg.context.close()

    # ---------------------------------------------------------------- the admin's list at 1440
    pg = open_as(br, 'NT', 1440, 900); ready(pg)
    M = pg.evaluate(MODEL); g = pg.evaluate(LIST); nums = pg.evaluate(NUMS); sm = pg.evaluate(SUM)
    sug = pg.evaluate("async () => { const D = await import('/staff7/sort_data.js'); return D.Q.counts.suggested; }")
    ok(sug > 400 and sm == f'{sug:,} to sort' and len(nums) >= 400, f'admin: the queue is capped at 400, so the line is the team\'s exact count, not "400+" ({sm!r}, {len(nums)} rows loaded)')
    ok(len(nums) == len(set(nums)) == len(M['rows']), 'admin: one row per bill (no number twice, even a bill that is followed AND matches words)')
    ok(all(int(c) == len(n) for _, c, n in g) and sum(int(c) for _, c, _ in g) == len(nums), 'admin: every group heading carries the number of its rows')
    labels = [l for l, _, _ in g]; order = ([] if labels[0] != 'Followed on the public site' else ['Followed on the public site']) + M['camps'] + ['Weak match', 'Matched no coalition']
    pos = [order.index(l) for l in labels]
    ok(labels[0] == 'Followed on the public site' and pos == sorted(pos) and len(set(labels)) == len(labels), f'admin: groups are Followed on the public site, then one per coalition in the app\'s order, then Weak match ({labels})')
    ok(pg.locator('.wl .segs3 a.seg').count() == 2 and pg.locator('#modeMatch').get_attribute('aria-current') == 'true' and pg.locator('#modeAll').inner_text() == 'All new bills' and pg.locator('#modeMatch').inner_text() == 'Matching words', 'admin: the switch "Matching words" · "All new bills", Matching words on')
    ok(pg.evaluate("() => document.querySelector('.wl h2').innerText") == 'New bills', 'the list is titled "New bills"')
    weak = pg.evaluate("() => [...document.querySelectorAll('section[aria-labelledby=\"g-weak\"] a.sr3')].every(a => a.classList.contains('dead')) && !!document.querySelector('section[aria-labelledby=\"g-weak\"] a.sr3')")
    ok(weak, 'Weak match rows are drawn quieter than the rest')
    ok(pg.evaluate(OPEN) == nums[0] and pg.evaluate(H1) and pg.locator('.wl a.sr3.sel').get_attribute('aria-current') == 'true', 'the first bill is open and marked in the list')
    snap(pg, 'sort_admin_1440')
    ok(pg.evaluate(NOSIDE), 'admin: no sideways scroll at 1440')
    ok(not pg.evaluate(SMALL), f'admin: buttons and rows are 44px tall ({pg.evaluate(SMALL)[:3]})')

    # words that must never show
    allt = pg.evaluate("() => document.body.innerText")
    ok(not re.search(r'\bletter\b|public tracker|\bvap(e|es|ing)\b', allt, re.I), 'no "letter", "public tracker" or "vape" on the list or the page')

    # ---------------------------------------------------------------- the three fixes (Nate's review)
    # 3. line 1 of a row runs to two full lines, cut at a word
    rows = pg.evaluate("""() => [...document.querySelectorAll('.wl a.sr3[data-no]')].map(a => { const e = a.querySelector('.nbt'), lh = parseFloat(getComputedStyle(e).lineHeight) || 1, r = e.getBoundingClientRect(); return { no: a.dataset.no, full: e.dataset.full, shown: e.textContent, lines: Math.round(r.height / lh) }; })""")
    long = [r for r in rows if len(r['full']) > 160]
    ok(len(long) > 20 and all(r['lines'] == 2 for r in long), f'fix 3: a long line 1 runs to two lines ({len(long)} rows, lines {sorted(set(r["lines"] for r in long))})')
    cut = [r for r in long if r['shown'].endswith('…')]
    okcut = all(r['full'].startswith(re.sub(r'[ ,;:]+$', '', r['shown'][:-1])) and (r['full'][len(r['shown']) - 1:len(r['shown'])] in (' ', ',', ';', ':', '')) for r in cut)
    fill = sorted(pg.evaluate("""() => [...document.querySelectorAll('.wl .nbt')].filter(e => e.textContent.endsWith('…')).map(e => { const g = document.createRange(); g.selectNodeContents(e); const rs = [...g.getClientRects()]; return Math.round(rs[rs.length - 1].width / e.getBoundingClientRect().width * 100); })"""))
    ok(cut and okcut and fill[len(fill) // 2] >= 60, f'fix 3: the cut is at a word, with "…", and the second line is filled before it is cut (median {fill[len(fill) // 2]}% of the column, {len(cut)} cut rows)')
    short = [r for r in rows if len(r['full']) < 50]
    ok(all(r['shown'] == r['full'] for r in short), 'fix 3: a short line 1 is shown whole')
    f = pg.evaluate("() => { const a = document.querySelector('section[aria-labelledby=\"g-followed\"] a.sr3'); return a ? [...a.querySelectorAll('.ir2')].map(x => x.innerText.trim()) : null; }")
    ok(f and re.fullmatch(r'[A-Z]+ \d+ · \d+ (person follows|people follow) it', f[0]), f'a followed row keeps the Capitol\'s title out: "{f[0] if f else None}"')
    # the same bill's companion: both rows carry their own number on line 2
    ok(all(re.match(r'^[A-Z]+ \d+', pg.evaluate("a => a.querySelector('.ir2').innerText", pg.query_selector(f'a.sr3[data-no="{r["no"]}"]'))) for r in rows[:5]), 'line 2 starts with the bill number')

    # ---------------------------------------------------------------- the page: facts only when the data has them
    sample = next(r for r in M['rows'] if r['sample'] and r['sp'] and r['look'] and r['refs'] and r['comp'] and r['sim'] and r['fol'])
    go(pg, '#/issues/new/' + sample['no']); pg.wait_for_selector('#sFacts')
    dts = pg.evaluate("() => [...document.querySelectorAll('#sFacts dt')].map(e => e.innerText.trim())")
    ok(dts[0] == 'What it does' and all(k in dts for k in ('Last session', 'Companion bills', 'Introduced by', 'Referred to', 'Similar bill we track', 'Followed by')), f'a bill with the data shows its facts rows ({dts})')
    refs = pg.evaluate("() => [...document.querySelectorAll('#sFacts dt')].find(e => e.innerText === 'Referred to').nextElementSibling.innerText")
    ok(re.search(r'\([A-Z]{2,4}\)', refs) and ('Senate' in refs or 'House' in refs), f'Referred to names committees by code with their names ({refs!r})')
    ls = pg.evaluate("() => [...document.querySelectorAll('#sFacts dt')].find(e => e.innerText === 'Last session').nextElementSibling.innerText")
    ok(re.match(r'Looks like [A-Z]+ \d+ \(\d{4}\), which we \w+', ls), f'Last session reads "Looks like HB 82 (2025), which we opposed, under …" ({ls!r})')
    bare = next(r for r in M['rows'] if not r['sample'] and not r['comp'] and not r['fol'] and r['group'] != 'followed')
    go(pg, '#/issues/new/' + bare['no']); pg.wait_for_selector('#sFacts')
    dts = pg.evaluate("() => [...document.querySelectorAll('#sFacts dt')].map(e => e.innerText.trim())")
    ok(dts == ['What it does'], f'a bill the data knows nothing more about shows only "What it does" (no invented rows): {dts}')
    ok(pg.locator('.hband .bline').inner_text().startswith(spaced(bare['no'])) and 'The Capitol’s page' in pg.locator('.bline').inner_text() and 'Read the bill' in pg.locator('.bline').inner_text() and not re.search(r'New bill ·', pg.locator('.hband').inner_text()), 'the band: trail Issues › New bills, the number above the title, the Capitol\'s page and Read the bill, no "New bill ·"')
    ok(pg.locator('#sBack a').nth(0).inner_text() == 'Issues' and pg.locator('#sBack a').nth(1).inner_text() == 'New bills', 'the trail is "Issues › New bills"')
    fol = next((r for r in M['rows'] if r['fol']), None)
    go(pg, '#/issues/new/' + fol['no']); pg.wait_for_selector('#sFacts')
    fb = pg.evaluate("() => { const d = [...document.querySelectorAll('#sFacts dt')].find(e => e.innerText === 'Followed by'); return d ? d.nextElementSibling.innerText : null; }")
    ok(fb and re.fullmatch(r'\d+ (person|people) on the public site', fb), f'a followed bill says "Followed by {fb}"')
    mk = next(r for r in M['rows'] if r['terms'] and r['desc'] > 50); go(pg, '#/issues/new/' + mk['no']); pg.wait_for_selector('#sFacts')
    ok(pg.evaluate("() => [...document.querySelectorAll('#sFacts mark')].length") >= 1, f'a matched word is marked on the page ({mk["no"]})')

    # ---------------------------------------------------------------- the four fields
    fl = pg.evaluate("() => [...document.querySelectorAll('.decide .df')].map(d => [d.querySelector('label').innerText, d.querySelector('select').tagName, d.querySelector('label').htmlFor === d.querySelector('select').id, d.querySelector('select').classList.contains('bsel')])")
    ok([x[0] for x in fl] == ['Position', 'Issue', 'Coalition', 'Lead'] and all(x[1] == 'SELECT' and x[2] and x[3] for x in fl), f'four labelled native selects in a row: {[x[0] for x in fl]}')
    ys = pg.evaluate("() => [...document.querySelectorAll('.decide select')].map(s => Math.round(s.getBoundingClientRect().top))")
    ok(len(set(ys)) == 1, 'the four fields sit in one row at 1440')
    pos_opts = pg.evaluate("() => [...document.querySelectorAll('#dPos option')].map(o => o.innerText)")
    ok('Monitor' in pos_opts and pos_opts[-1] == 'No position yet' and pg.evaluate("() => document.getElementById('dPos').selectedOptions[0].innerText") == 'Monitor' and 'Watching, no stance yet.' in pg.locator('#dPosHint').inner_text(), 'Position starts on Monitor, with "Watching, no stance yet." under it')
    cands = [r for r in M['rows'] if r['sg']][:1]
    go(pg, '#/issues/new/' + cands[0]['no']); pg.wait_for_selector('#dIss')
    og = pg.evaluate("() => [...document.querySelectorAll('#dIss > optgroup, #dIss > option')].map(o => o.tagName === 'OPTGROUP' ? o.label : o.innerText)")
    ok(og[0] == 'Suggested' and og[-1] == 'No issue yet' and 'All issues' in og and og.index('All issues') > og.index('Suggested') and not any('New issue' in x for x in og), f'Issue groups: Suggested, Same topic, All issues, then No issue yet ({og}); no "New issue…"')
    people = pg.evaluate("""async () => { const d = await import('/staff6/data.js'); return { opts: [...document.querySelectorAll('#dLead option')].map(o => o.innerText), active: d.S.advocates.filter(a => a.is_active !== false).length, off: d.S.advocates.filter(a => a.is_active === false).length }; }""")
    ok(len(people['opts']) == people['active'] and people['opts'][0] == 'You', f'Lead offers only active team members, You first ({len(people["opts"])} of {people["active"]})')
    ok(pg.locator('#dCamp option').count() >= 2 and pg.evaluate("() => [...document.querySelectorAll('#dCamp option')].pop().innerText") == 'No coalition', 'Coalition offers the coalitions and "No coalition"')

    # no suggested issue: "Choose an issue", Track cannot be pressed
    noS = next((r for r in M['rows'] if not r['sg'] and r['group'].startswith('c:')), None)
    go(pg, '#/issues/new/' + noS['no']); pg.wait_for_selector('#dIss')
    ok(pg.evaluate("() => document.getElementById('dIss').selectedOptions[0].innerText") == 'Choose an issue' and pg.locator('#sTrack').is_disabled() and pg.locator('#dTrackNote').inner_text() == 'Choose an issue, or No issue yet, to track it.', 'no suggested issue: Issue starts on "Choose an issue", Track is disabled, the line beside it says what to do')
    snap(pg, 'sort_no_suggestion')
    pg.keyboard.press('t'); pg.wait_for_timeout(300)
    ok(pg.evaluate(TOAST) is None and pg.evaluate(OPEN) == noS['no'], 'the T key does nothing while Track cannot be pressed')
    pg.select_option('#dIss', 'none'); pg.wait_for_timeout(200)
    ok(pg.locator('#sTrack').is_enabled() and 'Only the team sees it' in pg.locator('#dTrackNote').inner_text(), '"No issue yet" makes Track pressable')
    pg.select_option('#dIss', index=2); pg.wait_for_timeout(200)
    ok(pg.locator('#sTrack').is_enabled(), 'choosing an issue makes Track pressable')
    # choices stay when the page is drawn again (the minute\'s tick or a redraw)
    chosen = pg.evaluate("() => document.getElementById('dIss').value"); pg.evaluate("() => window.__staff7Render({ tick: true })"); pg.wait_for_timeout(300)
    ok(pg.evaluate("() => document.getElementById('dIss').value") == chosen, 'what was chosen on the fields survives a redraw')
    pg.context.close()

    # ---------------------------------------------------------------- the three fixes on the page: why-line, buttons that stay put
    for w, h in ((1440, 900), (1280, 800)):
        pg = open_as(br, 'NT', w, h); ready(pg); M = pg.evaluate(MODEL)
        wy = next(r for r in M['rows'] if r['why'] and r['sg'])
        go(pg, '#/issues/new/' + wy['no']); pg.wait_for_selector('#dIss')
        # the issue with the longest name whose owner is somebody else makes the longest why-line there can be
        pg.evaluate("""async () => { const d = await import('/staff6/data.js'); const me = d.S.me, c = [...document.querySelectorAll('#dIss option')].map(o => ({ v: o.value, n: o.innerText })).filter(o => { const i = d.S.issues.find(x => x.id === o.v); return i && i.owner_id && i.owner_id !== me.id; }).sort((a, b) => b.n.length - a.n.length)[0]; const s = document.getElementById('dIss'); s.value = c.v; s.dispatchEvent(new Event('change', { bubbles: true })); }""")
        pg.wait_for_timeout(250)
        lines = pg.evaluate("() => { const e = document.getElementById('dLeadWhy'), lh = parseFloat(getComputedStyle(e).lineHeight) || 20, r = e.getBoundingClientRect(); return { t: e.innerText, lines: Math.round(r.height / lh), hidden: e.hidden }; }")
        edge = pg.evaluate("() => Math.abs(document.getElementById('dLeadWhy').getBoundingClientRect().left - document.getElementById('dLead').getBoundingClientRect().left)")
        ok(not lines['hidden'] and lines['lines'] <= 2 and lines['t'].endswith('.') and ' leads ' in lines['t'] and (edge <= 2 or w < 1400), f'fix 1 ({w}): the why-line starts at Lead\'s left edge ({edge}px off) and fits in {lines["lines"]} line(s): "{lines["t"]}"')
        pl = pg.evaluate("() => { const e = document.getElementById('dPosHint'), lh = parseFloat(getComputedStyle(e).lineHeight) || 20; return Math.round(e.getBoundingClientRect().height / lh); }")
        ok(pl == 1 and pg.evaluate(NOSIDE), f'({w}) the hint under Position is one line and nothing scrolls sideways')
        # fix 2: Track, Not for us, Skip for now stand in the same places whatever lines are shown under them
        also = next((r for r in M['rows'] if r['also']), None); plain = next(r for r in M['rows'] if not r['also'] and r['sg'])
        xs = {}
        for tag, r in (('plain', plain), ('also', also)):
            go(pg, '#/issues/new/' + r['no']); pg.wait_for_selector('#sTrack')
            xs[tag] = pg.evaluate(BTNS)
        go(pg, '#/issues/new/' + next(r for r in M['rows'] if not r['sg'] and not r['also'])['no']); pg.wait_for_selector('#sTrack')
        xs['disabled'] = pg.evaluate(BTNS)
        note = pg.evaluate("() => document.getElementById('dNotNote').hidden")
        ok(xs['plain'] == xs['also'] == xs['disabled'] and note, f'fix 2 ({w}): the three buttons stay in fixed places with or without the line under Not for us, or with Track disabled {xs["plain"]}')
        also_t = pg.evaluate("() => 0"); go(pg, '#/issues/new/' + also['no']); pg.wait_for_selector('#sTrack')
        nn = pg.locator('#dNotNote').inner_text()
        ok(re.fullmatch(r"Off everyone’s list, including .+’s\.", nn) and pg.locator('#dNotNote').is_visible(), f'Not for us says when another coalition also matches: "{nn}"')
        by = pg.evaluate("() => { const n = document.getElementById('dNotNote').getBoundingClientRect(), b = document.getElementById('sNot').getBoundingClientRect(); return n.top >= b.bottom - 1; }")
        ok(by, 'the quiet lines are on a row beneath the buttons')
        if w == 1440: snap(pg, 'sort_also_matches')
        pg.context.close()

    # ---------------------------------------------------------------- deciding (helper, so the count is exact: it is under 400)
    pg = open_as(br, 'JMM', 1440, 900); ready(pg); spied(pg); pg.evaluate("() => localStorage.setItem('x', '1')")
    M = pg.evaluate(MODEL); n0 = len(M['rows']); sugg = [r for r in M['rows'] if r['sg']]
    first = M['rows'][0]; nums0 = pg.evaluate(NUMS)
    tr = next(r for r in M['rows'] if r['sg'] and r['no'] != M['rows'][-1]['no'])
    go(pg, '#/issues/new/' + tr['no']); pg.wait_for_selector('#sTrack')
    idx = nums0.index(tr['no']); expect_next = nums0[idx + 1]
    iss = pg.evaluate("() => document.getElementById('dIss').selectedOptions[0].innerText"); lead = pg.evaluate("() => document.getElementById('dLead').selectedOptions[0].innerText"); sbefore = pg.evaluate("async () => { const d = await import('/staff6/data.js'); return d.S.bills.length; }")
    ok(pg.locator('#sTrack').is_enabled() and pg.locator('#sTrack').inner_text().startswith('Track'), 'Track is pressable with the suggested issue')
    pg.click('#sTrack'); pg.wait_for_timeout(500)
    nums1 = pg.evaluate(NUMS)
    ok(pg.evaluate(OPEN) == expect_next and tr['no'] not in nums1 and len(nums1) == n0 - 1, f'Track: the next bill ({expect_next}) opens and the list loses {tr["no"]}')
    ok(intn(pg.evaluate(SUM)) == n0 - 1, f'the count drops by one ({n0} to {pg.evaluate(SUM)!r})')
    tt = pg.evaluate(TOAST)
    leadw = 'you lead' if lead == 'You' else f'{lead} leads'
    ok(tt == f'{spaced(tr["no"])} tracked: Monitor, on {iss}, {leadw}. Not on the public site.', f'the toast says what was done: {tt!r}')
    ok(pg.locator('#toastUndo').is_visible() and pg.locator('#toast').get_attribute('role') == 'status' and pg.locator('#toast').get_attribute('aria-live') == 'polite', 'the toast is announced politely and has Undo')
    calls = pg.evaluate("() => window.__calls")
    ok(len(calls) == 1 and calls[0]['issueVia'] == 'suggested' and calls[0]['position'] == 'monitor' and calls[0]['leadId'] and calls[0]['issueId'] and calls[0]['campaignId'], f'Track sends the position, issue, coalition and lead, issue via "suggested" ({calls[0]})')
    st = pg.evaluate("""async (no) => { const d = await import('/staff6/data.js'), S = d.S, b = S.bills.find(x => String(x.bill_number) === no); return b ? { tracked: b.tracked, pub: b.is_public, pos: b.position, lead: S.assignments[b.id], camp: S.billCampaigns[b.id], iss: (S.billIssues || []).filter(x => x.bill_id === b.id) } : null; }""", tr['no'])
    ok(st and st['tracked'] is True and st['pub'] is False and st['pos'] == 'monitor' and st['lead'] and st['iss'] and st['iss'][0]['added_via'] == 'suggested', f'the bill is tracked for the team and NOT public ({st})')
    snap(pg, 'sort_after_track')
    ok(pg.locator('.jgrp #jsBtn').inner_text().startswith('Just sorted · 1'), 'Just sorted · 1 appears at the foot of the list')
    pg.click('#toastUndo'); pg.wait_for_timeout(500)
    nums2 = pg.evaluate(NUMS)
    ok(nums2 == nums0 and pg.evaluate(OPEN) == tr['no'] and pg.evaluate(TOAST).startswith(spaced(tr['no'])) and intn(pg.evaluate(SUM)) == n0, f'Undo: the bill is back in its place, open, and the count is {n0} again')
    st2 = pg.evaluate("""async (no) => { const d = await import('/staff6/data.js'), S = d.S; return { has: S.bills.some(x => String(x.bill_number) === no), tri: S.demoTriaged.has(S.snapshot.index.find(x => x.bill_number === no).id) }; }""", tr['no'])
    ok(not st2['has'] and not st2['tri'], 'Undo put back everything Track changed (the bill is no longer tracked)')
    r2 = pg.evaluate("""async (no) => { const d = await import('/staff6/data.js'); const row = (await d.DB.triageQueue(null, true)).find(r => r.bill_number === no); return await d.DB.triageTrackTeamUndo(row); }""", tr['no'])
    ok(r2['undone'] is False and r2['reason'] == 'nothing to undo', f'a second Undo says there was nothing to undo ({r2})')
    ok(pg.locator('.jgrp').count() == 0, 'after Undo the bill leaves Just sorted')

    # Undo that the database refuses: said plainly
    go(pg, '#/issues/new/' + tr['no']); pg.wait_for_selector('#sTrack'); pg.click('#sTrack'); pg.wait_for_timeout(400)
    pg.evaluate("""async () => { const d = await import('/staff6/data.js'); d.DB.triageTrackTeamUndo = async () => { throw new Error('This bill has changed since it was tracked'); }; }""")
    pg.click('#toastUndo'); pg.wait_for_timeout(400)
    msg = pg.evaluate(TOAST) or ''
    ok('This bill has changed since it was tracked' in msg and tr['no'] not in pg.evaluate(NUMS) and pg.locator('#jsBtn').count() == 1, f'a refused Undo is shown as the database says it, and the decision stays in Just sorted ({msg!r})')
    pg.context.close()

    # Not for us, its Undo, and Skip for now
    pg = open_as(br, 'JMM', 1440, 900); ready(pg); M = pg.evaluate(MODEL); nums0 = pg.evaluate(NUMS); n0 = len(nums0)
    pg.evaluate("""async () => { const d = await import('/staff6/data.js'); window.__w = []; const a = d.DB.triageSkip.bind(d.DB), b = d.DB.triageUndo.bind(d.DB); d.DB.triageSkip = async r => { window.__w.push('skip ' + r.bill_number); return a(r); }; d.DB.triageUndo = async r => { window.__w.push('undo ' + r.bill_number); return b(r); }; }""")
    cur = pg.evaluate(OPEN); idx = nums0.index(cur)
    # Skip for now first: saves nothing, no toast, goes to the end of its group, opens the next
    grp = pg.evaluate(LIST); gi = next(i for i, x in enumerate(grp) if cur in x[2]); gnums = grp[gi][2]
    stb = pg.evaluate("""async () => { const d = await import('/staff6/data.js'); return [d.S.bills.length, d.S.demoTriaged.size]; }""")
    pg.click('#sSkip'); pg.wait_for_timeout(450)
    gnow = pg.evaluate(LIST); gj = next(i for i, x in enumerate(gnow) if cur in x[2])
    sta = pg.evaluate("""async () => { const d = await import('/staff6/data.js'); return [d.S.bills.length, d.S.demoTriaged.size]; }""")
    ok(sta == stb and pg.evaluate("() => window.__w") == [] and pg.evaluate(TOAST) is None and pg.locator('.jgrp').count() == 0, f'Skip for now saves nothing (no call, no toast, no Just sorted): {sta}')
    ok(gnow[gj][2][-1] == cur and len(gnow[gj][2]) == len(gnums) and pg.evaluate(OPEN) == nums0[idx + 1] and pg.evaluate(SUM) == f'{n0} to sort', f'the skipped bill is at the end of its group, the next opens, the count is unchanged ({cur} -> end of {gnow[gj][0]})')
    nn = pg.evaluate(OPEN)
    # Not for us
    pg.click('#sNot'); pg.wait_for_timeout(450)
    tt = pg.evaluate(TOAST)
    ok(tt == f'{spaced(nn)} is off everyone’s list.' and nn not in pg.evaluate(NUMS) and pg.evaluate("() => window.__w") == [f'skip {nn}'], f'Not for us: "{tt}", the bill leaves the list, the database call is triage_skip')
    pg.click('#toastUndo'); pg.wait_for_timeout(450)
    ok(nn in pg.evaluate(NUMS) and pg.evaluate(OPEN) == nn and pg.evaluate("() => window.__w") == [f'skip {nn}', f'undo {nn}'], 'Undo of Not for us brings the bill back (triage_undo)')
    pg.context.close()

    # Just sorted: several decisions, the toast gone, an earlier decision undone from the list
    pg = open_as(br, 'JMM', 1440, 900); ready(pg); M = pg.evaluate(MODEL); nums0 = pg.evaluate(NUMS); n0 = len(nums0)
    a = pg.evaluate(OPEN); pg.click('#sNot'); pg.wait_for_timeout(350); b = pg.evaluate(OPEN)
    sg = pg.evaluate(MODEL)['rows']; tb = next(r for r in sg if r['sg']); go(pg, '#/issues/new/' + tb['no']); pg.wait_for_selector('#sTrack'); pg.click('#sTrack'); pg.wait_for_timeout(350)
    js = pg.locator('#jsBtn')
    ok(js.inner_text().strip().startswith('Just sorted · 2') and js.get_attribute('aria-expanded') == 'false', 'Just sorted · 2, folded')
    js.click(); pg.wait_for_timeout(200)
    rowsj = pg.evaluate("() => [...document.querySelectorAll('#jsList li')].map(li => [li.querySelector('b').innerText, li.querySelector('.stm').innerText, !!li.querySelector('button[data-undo]')])")
    ok(len(rowsj) == 2 and rowsj[0][0] == spaced(tb['no']) and rowsj[0][1].startswith('Tracked: Monitor') and rowsj[1] == [spaced(a), 'Off everyone’s list', True] and rowsj[0][2], f'Just sorted lists each decision with what was decided and its own Undo, newest first ({rowsj})')
    snap(pg, 'sort_just_sorted')
    t0 = pg.evaluate(TOAST); pg.wait_for_timeout(9000)
    on9 = pg.evaluate(TOAST) is not None; pg.wait_for_timeout(2000)
    ok(t0 and on9 and pg.evaluate(TOAST) is None, 'the toast stays about 10 seconds, then goes by itself')
    ok(pg.locator('#jsList').is_visible(), 'Just sorted stays open after the toast has gone')
    pg.click(f'button[data-undo]:near(:text("{spaced(a)}"))' if False else '#jsList li:nth-child(2) button[data-undo]'); pg.wait_for_timeout(450)
    ok(a in pg.evaluate(NUMS) and pg.evaluate(OPEN) == a and pg.evaluate(SUM) == f'{n0 - 1} to sort' and pg.locator('#jsList li').count() == 1, 'an earlier decision is undone from Just sorted after the toast has gone; the bill is back and open')
    ok(len(pg.seen) > 0 and all(u.startswith(BASE) or 'fonts.g' in u for _, u in pg.seen) and all(m == 'GET' for m, u in pg.seen if u.startswith(BASE)) and not pg.bad, f'practice copy: nothing left 127.0.0.1, and nothing was written ({len(pg.seen)} requests, all GET; blocked: {pg.bad[:2]})')
    pg.context.close()

    # ---------------------------------------------------------------- the keys
    pg = open_as(br, 'JMM', 1440, 900); ready(pg); M = pg.evaluate(MODEL); nums0 = pg.evaluate(NUMS); n0 = len(nums0)
    cur = pg.evaluate(OPEN); pg.locator('main h1').first.focus()
    pg.keyboard.press('ArrowDown'); pg.wait_for_timeout(400)
    ok(pg.evaluate(OPEN) == nums0[1] and '#/issues/new/' + nums0[1] in pg.url, 'ArrowDown moves to the next bill in the list')
    pg.keyboard.press('ArrowUp'); pg.wait_for_timeout(400)
    ok(pg.evaluate(OPEN) == nums0[0], 'ArrowUp moves to the one before')
    pg.keyboard.press('s'); pg.wait_for_timeout(400)
    gl = pg.evaluate(LIST); ok(pg.evaluate(OPEN) == nums0[1] and next(x for x in gl if nums0[0] in x[2])[2][-1] == nums0[0] and pg.evaluate(TOAST) is None, 'S skips for now')
    cur = pg.evaluate(OPEN); pg.keyboard.press('n'); pg.wait_for_timeout(400)
    ok(cur not in pg.evaluate(NUMS) and (pg.evaluate(TOAST) or '').endswith('is off everyone’s list.'), 'N is Not for us')
    pg.keyboard.press('u'); pg.wait_for_timeout(400)
    ok(cur in pg.evaluate(NUMS) and pg.evaluate(OPEN) == cur, 'U undoes the latest decision')
    # a field keeps its letters: typing in a select does not decide
    tbefore = pg.evaluate(TOAST); pg.focus('#dLead'); pg.keyboard.press('t'); pg.keyboard.press('n'); pg.keyboard.press('s'); pg.keyboard.press('u'); pg.wait_for_timeout(300)
    ok(pg.evaluate(TOAST) == tbefore and cur in pg.evaluate(NUMS) and pg.evaluate(OPEN) == cur and pg.locator('.jgrp').count() == 0, 'while a field has the focus the keys T, N, S and U do nothing')
    pg.locator('main h1').first.focus()
    sg = [r for r in pg.evaluate(MODEL)['rows'] if r['sg']]; go(pg, '#/issues/new/' + sg[0]['no']); pg.wait_for_selector('#sTrack'); pg.locator('main h1').first.focus()
    pg.keyboard.press('t'); pg.wait_for_timeout(400)
    ok('tracked: Monitor' in (pg.evaluate(TOAST) or '') and sg[0]['no'] not in pg.evaluate(NUMS), 'T is Track')
    hints = pg.evaluate("() => ['sTrack', 'sNot', 'sSkip'].map(i => document.querySelector('#' + i + ' kbd')?.innerText).concat([document.querySelector('#toastUndo kbd')?.innerText])")
    ok(hints == ['T', 'N', 'S', 'U'], f'the keys are shown as small hints on the buttons and on Undo ({hints})')
    # focus is visible on a keyboard Tab
    pg.locator('main h1').first.focus(); pg.keyboard.press('Tab'); pg.wait_for_timeout(100)
    vis = pg.evaluate("() => { const e = document.activeElement; const s = getComputedStyle(e); return e && e !== document.body && (parseFloat(s.outlineWidth) > 0 || s.boxShadow !== 'none'); }")
    ok(vis, 'Tab reaches a control with a visible focus ring')
    pg.context.close()

    # ---------------------------------------------------------------- the empty states
    pg = open_as(br, 'JMM', 1440, 900); ready(pg); n0 = len(pg.evaluate(NUMS))
    for i in range(n0):
        pg.keyboard.press('n'); pg.wait_for_timeout(120)
    pg.wait_for_timeout(500)
    h = pg.evaluate(H1)
    ok(h == f'All sorted. You decided {n0} bills.' and pg.evaluate(SUM) == '0 to sort' and pg.locator('#jsList').is_visible() and pg.locator('#searchEvery').count() >= 1 and 'New bills arrive each night.' in pg.locator('.paper').inner_text(), f'nothing left: "{h}", Just sorted open, "Search every bill", new bills arrive each night')
    ok(pg.locator('#searchEvery').first.get_attribute('href') == '#/search', '"Search every bill" goes to the Search door')
    snap(pg, 'sort_all_sorted')
    pg.context.close()
    pg = open_as(br, 'NT', 1440, 900); ready(pg)
    pg.evaluate("""async () => { const D = await import('/staff7/sort_data.js'); D.Q.matching.rows = []; D.Q.matching.capped = false; D.Q.followed.rows = []; D.U.decisions = []; window.__staff7Render({}); }"""); pg.wait_for_timeout(400)
    h = pg.evaluate(H1); sub = pg.locator('.paper .sub').inner_text()
    ok(h == 'Nothing matches a coalition’s words.' and re.fullmatch(r'[\d,]+ other new bills are under All new bills\.', sub), f'Matching words empty but All new bills is not: "{h}" "{sub}"')
    ok(pg.locator('#showAllNew').count() >= 1 and pg.locator('#searchEvery').count() >= 1, 'it offers "Show all new bills" and "Search every bill"')
    snap(pg, 'sort_nothing_matches')
    pg.context.close()

    # ---------------------------------------------------------------- the switch: All new bills
    pg = open_as(br, 'NT', 1440, 900); ready(pg)
    pg.click('#modeAll'); pg.wait_for_selector('#sortSum'); pg.wait_for_timeout(900); ready(pg)
    sm = pg.evaluate(SUM); rows = pg.evaluate(NUMS)
    ok(re.fullmatch(r'400 of [\d,]{5,} · bills that match words come first · Search every bill', sm.replace('\n', ' ')) and len(rows) == len(set(rows)) and 'newest' not in sm, f'All new bills: "{sm}" (the queue is capped at 400; only the queue\'s rows are counted), one row per bill')
    ok(pg.locator('#searchLink').get_attribute('href') == '#/search' and pg.locator('#modeAll').get_attribute('aria-current') == 'true' and 'show=all' in pg.url, 'All new bills: a link "Search every bill" to the Search door; the switch is on All new bills')
    g = pg.evaluate(LIST); labels = [l for l, _, _ in g]
    ok('Matched no coalition' not in labels[:-1] and labels.index('Weak match') < labels.index('Matched no coalition') if 'Matched no coalition' in labels else labels[-1] == 'Weak match', f'All new bills: groups in the same order, "Matched no coalition" last when there is one ({labels})')
    snap(pg, 'sort_all_new_bills')
    pg.click('#modeMatch'); pg.wait_for_timeout(500)
    ok(re.fullmatch(r'[\d,]+ to sort', pg.evaluate(SUM)) and 'show=all' not in pg.url, 'back to Matching words')
    pg.context.close()

    # ---------------------------------------------------------------- track with the changes, and the calls it makes
    pg = open_as(br, 'NT', 1440, 900); ready(pg); spied(pg); M = pg.evaluate(MODEL)
    sgs = [r for r in M['rows'] if r['sg']]; a, b = sgs[0], sgs[1]
    go(pg, '#/issues/new/' + a['no']); pg.wait_for_selector('#sTrack')
    pg.select_option('#dCamp', ''); pg.select_option('#dPos', 'support'); pg.select_option('#dIss', index=3); pg.wait_for_timeout(200)
    pg.click('#sTrack'); pg.wait_for_timeout(400)
    c = pg.evaluate("() => window.__calls")[0]
    ok(c['campaignId'] is None and c['position'] == 'support' and c['issueVia'] == 'changed' and c['issueId'], f'a changed issue is sent as "changed"; "No coalition" sends no coalition ({c})')
    nos = next(r for r in M['rows'] if not r['sg'] and r['no'] != a['no'])
    go(pg, '#/issues/new/' + nos['no']); pg.wait_for_selector('#dIss'); pg.select_option('#dIss', index=2); pg.wait_for_timeout(150); pg.click('#sTrack'); pg.wait_for_timeout(400)
    c = pg.evaluate("() => window.__calls")[1]
    ok(c['issueVia'] == 'staff' and c['issueId'], f'an issue picked where none was suggested is sent as "staff" ({c})')
    go(pg, '#/issues/new/' + b['no']); pg.wait_for_selector('#dIss'); pg.select_option('#dPos', ''); pg.select_option('#dIss', 'none'); pg.wait_for_timeout(150); pg.click('#sTrack'); pg.wait_for_timeout(400)
    c = pg.evaluate("() => window.__calls")[2]
    ok(c['position'] is None and c['issueId'] is None and c['leadId'], f'No position yet and No issue yet send nothing for them, and a lead is always sent ({c})')
    tt = pg.evaluate(TOAST); ok('no issue yet' in tt and tt.startswith(spaced(b['no'])), f'the toast for a bill with no issue: {tt!r}')
    # the lead rule: the sorter when the sorter leads the coalition or issue, else the issue's owner (with a quiet line saying so)
    lead_ok = pg.evaluate("""async () => { const D = await import('/staff7/sort_data.js'), d = await import('/staff6/data.js'), me = d.S.me, out = [];
      for (const m of D.listFor(me, 'matching').rows.slice(0, 80)) { const f = D.fieldsOf(m, me), i = f.issue, c = f.camp;
        const sorter = (i && i.owner_id === me.id) || (c && (c.owner_id === me.id || D.mineCamps().includes(c.id)));
        const act = id => { const a = id && d.advocate(id); return a && a.is_active !== false; };
        const want = sorter ? me.id : i && act(i.owner_id) ? i.owner_id : c && act(c.owner_id) ? c.owner_id : me.id;
        out.push(f.leadId === want && (f.leadId === me.id ? f.why === '' : f.why.startsWith(d.advocate(f.leadId).full_name.split(' ')[0] + ' leads '))); }
      return out; }""")
    ok(lead_ok and all(lead_ok), f'Lead starts on the sorter, else the issue\'s owner, else the coalition\'s owner, and says why when it is not the sorter ({len(lead_ok)} bills checked)')
    pg.context.close()

    # ---------------------------------------------------------------- a capped queue: the next bills are read, the count stays true, "All sorted" waits for the end
    pg = open_as(br, 'NT', 1440, 900); ready(pg)
    pg.evaluate("""async () => { const d = await import('/staff6/data.js'); window.__q = 0; const o = d.DB.triageQueue.bind(d.DB); d.DB.triageQueue = async (...a) => { window.__q++; return o(...a); }; }""")
    sug0 = pg.evaluate("async () => (await import('/staff7/sort_data.js')).Q.counts.suggested"); n0 = len(pg.evaluate(NUMS))
    pg.evaluate("""async () => { const D = await import('/staff7/sort_data.js'), d = await import('/staff6/data.js'); const l = D.listFor(d.S.me, 'matching'); for (const m of l.rows.slice(0, l.rows.length - 8)) await D.notForUs(m); window.__dec = D.U.decisions.length; window.__staff7Render({}); }""")
    pg.wait_for_timeout(900); dec = pg.evaluate("() => window.__dec")
    ok(pg.evaluate("() => window.__q") == 1 and len(pg.evaluate(NUMS)) >= 20, f'capped queue: when the rows run low (8 left of {n0}) the next ones are read again, in memory ({pg.evaluate("() => window.__q")} read, {len(pg.evaluate(NUMS))} rows now)')
    ok(not pg.evaluate(H1).startswith('All sorted') and pg.evaluate(SUM) == f'{sug0 - dec:,} to sort', f'the count follows the decisions: {pg.evaluate(SUM)!r} (team count {sug0:,} less {dec})')
    saw = pg.evaluate("""async () => { const D = await import('/staff7/sort_data.js'), d = await import('/staff6/data.js'); const bad = []; for (let k = 0; k < 400; k++) { const l = D.listFor(d.S.me, 'matching'); if (!l.rows.length) { if (!D.more(d.S.me, 'matching')) break; window.__staff7Render({}); if (/^All sorted/.test(document.querySelector('main h1').innerText)) bad.push(k); await new Promise(r => setTimeout(r, 80)); continue; } for (const m of l.rows.slice(0, Math.max(1, l.rows.length - 3))) await D.notForUs(m); window.__staff7Render({}); await new Promise(r => setTimeout(r, 60)); if (/^All sorted/.test(document.querySelector('main h1').innerText) && D.more(d.S.me, 'matching')) bad.push(k); } return bad; }""")
    pg.wait_for_timeout(500); h = pg.evaluate(H1)
    ok(saw == [] and re.fullmatch(r'All sorted\. You decided [\d,]+ bills\.', h) and pg.evaluate("() => window.__q") >= 1, f'"All sorted" is said only when nothing more can come ("{h}", {pg.evaluate("() => window.__q")} reads)')
    pg.context.close()

    # ---------------------------------------------------------------- small things: the address, the arrow keys, the reason Track is off, refusals, the position the database kept
    pg = open_as(br, 'JMM', 1440, 900); ready(pg); nums0 = pg.evaluate(NUMS)
    go(pg, '#/issues/new/ZZ999'); pg.wait_for_timeout(300)
    ok(pg.evaluate(OPEN) == nums0[0] and pg.url.endswith('#/issues/new/' + nums0[0]), f'an unknown number opens the first bill and the address says so ({pg.url.split("#")[1]})')
    h0 = pg.evaluate("() => history.length"); pg.locator('main h1').first.focus()
    for _ in range(3): pg.keyboard.press('ArrowDown'); pg.wait_for_timeout(250)
    ok(pg.evaluate("() => history.length") == h0 and pg.evaluate(OPEN) == nums0[3], 'the arrow keys add no history entry per press')
    noS = next(r for r in pg.evaluate(MODEL)['rows'] if not r['sg']); go(pg, '#/issues/new/' + noS['no']); pg.wait_for_selector('#sTrack')
    ok(pg.locator('#sTrack').get_attribute('aria-describedby') == 'dTrackNote' and pg.locator('#dTrackNote').count() == 1, 'a disabled Track points to the line that says why (aria-describedby)')
    pg.select_option('#dIss', 'none'); pg.wait_for_timeout(150)
    ok(pg.locator('#sTrack').get_attribute('aria-describedby') is None, 'once Track can be pressed the pointer is gone')
    pg.evaluate("""async () => { const d = await import('/staff6/data.js'); d.DB.triageTrackTeam = async () => { throw new Error('staff only'); }; }""")
    pg.click('#sTrack'); pg.wait_for_timeout(400)
    ok('Only team members can sort bills.' in (pg.evaluate(TOAST) or ''), f'"staff only" is said as "Only team members can sort bills." ({pg.evaluate(TOAST)!r})')
    pg.evaluate("""async () => { const d = await import('/staff6/data.js'); d.DB.triageTrackTeam = async () => ({ position: 'support' }); }""")
    pg.click('#sTrack'); pg.wait_for_timeout(400)
    ok('tracked: Support,' in (pg.evaluate(TOAST) or '') and pg.locator('#jsList li').first.inner_text().find('Tracked: Support,') >= 0 or pg.evaluate("() => document.querySelector('#jsList') && document.querySelector('#jsList').innerText.includes('Tracked: Support,')"), f'the toast and Just sorted say the position the database returned ({pg.evaluate(TOAST)!r})')
    pg.context.close()

    # ---------------------------------------------------------------- 1280 and the phone
    pg = open_as(br, 'NT', 1280, 800); ready(pg)
    ok(pg.evaluate(NOSIDE) and not pg.evaluate(SMALL), 'admin at 1280: no sideways scroll, 44px targets')
    go(pg, '#/issues/new/' + pg.evaluate(MODEL)['rows'][5]['no']); pg.wait_for_selector('#sTrack')
    ok(pg.evaluate(NOSIDE) and pg.evaluate("() => { const r = document.getElementById('sSkip').getBoundingClientRect(); return r.right <= innerWidth && r.width > 0; }"), 'admin at 1280: the page and its buttons fit')
    snap(pg, 'sort_admin_1280'); pg.context.close()
    pg = open_as(br, 'JMM', 390, 844); ready(pg)
    ok(pg.locator('.wl').is_visible() and pg.evaluate(NOSIDE) and pg.locator('.sortback').is_visible(), 'phone: the list shows first, with a way back to Issues, no sideways scroll')
    ok(not pg.evaluate(SMALL), f'phone: 44px targets ({pg.evaluate(SMALL)[:3]})')
    snap(pg, 'sort_phone_list')
    pg.locator('.wl a.sr3[data-no]').first.click(); pg.wait_for_selector('#sTrack'); pg.wait_for_timeout(300)
    ok(pg.locator('.wl').is_hidden() and pg.evaluate(NOSIDE) and pg.locator('.backhome').inner_text().strip() == 'Back to New bills' and pg.locator('#sTrack').is_visible(), 'phone: a bill opens alone with Back to New bills, and no sideways scroll')
    ok(not pg.evaluate(SMALL), 'phone: the page\'s buttons and selects are 44px')
    fy = pg.evaluate("() => [...document.querySelectorAll('.decide select')].map(s => { const r = s.getBoundingClientRect(); return [Math.round(r.top), Math.round(r.width)]; })")
    ok(len(set(t for t, _ in fy)) == 4 and len(set(w for _, w in fy)) == 1 and fy[0][1] > 300, f'phone: the four fields are full width, one to a row ({fy})')
    snap(pg, 'sort_phone_page')
    pg.click('#sNot'); pg.wait_for_timeout(450)
    ok(pg.evaluate(TOAST) is not None and pg.locator('#sTrack').count() == 1, 'phone: after a decision the next bill opens and the toast shows')
    pg.click('.backhome'); pg.wait_for_timeout(400)
    ok(pg.locator('.wl').is_visible() and pg.locator('.wl a.sr3[data-no]').count() > 0, 'phone: Back to New bills returns to the list')
    ok(not pg.errs and not pg.bad, 'phone: no console errors')
    pg.context.close()
    br.close()

passed = sum(res); print(f'\n{passed}/{len(res)} passed'); sys.exit(0 if passed == len(res) else 1)
