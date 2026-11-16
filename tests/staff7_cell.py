# Staff7's shared bill status (R-398, Nate 16 Nov): bill_cell.js answers one thing per alive bill about the issue's next deadline, and the Issues list groups by it
# (At risk, Hearing scheduled, Needs a hearing, Cleared the deadline, Past committees, Stopped this year; no "Moving"). Practice copy only; under 2 minutes.
#   python3 tests/staff7_cell.py [base]     base defaults to http://127.0.0.1:8851
import sys, re
from playwright.sync_api import sync_playwright
BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8851').rstrip('/')
res = []
def ok(c, m): res.append(bool(c)); print('PASS' if c else 'FAIL', m, flush=True)

ORDER = ['At risk', 'Hearing scheduled', 'Needs a hearing', 'Cleared', 'Past committees', 'Stopped this year']
WORDS = ['at risk', 'with a hearing', 'need a hearing', 'cleared the deadline', 'past committees', 'stopped']
# every group's heading with its rows' second lines, and the count line, read from the page
PAGE = """() => ({ groups: [...document.querySelectorAll('section[aria-labelledby^="g-"]')].map(s => ({ h: s.querySelector('h3').innerText.trim(), n: +(s.querySelector('h3').innerText.match(/(\\d+)$/) || [0, -1])[1],
    rows: [...s.querySelectorAll('a.sr3')].map(a => (a.querySelector('.ir2')?.innerText || '').replace(/\\s+/g, ' ').trim()) })), summ: document.querySelector('#summ')?.innerText.trim() || '', text: document.body.innerText })"""
# the model: deadlineCell over every alive tracked bill, with the page's own next-deadline row
MODEL = """async () => { const d = await import('/staff6/data.js'), bc = await import('/staff7/bill_cell.js'), st = await import('/staff7/standing.js'), is = await import('/staff7/issues.js');
  const S = d.S, set = is.setFor({ kind: 'all', code: 'all' }, S.me), ses = is.sessionOf(set), row = ses.next?.row || null;
  const seen = new Set(), out = { counts: {}, bad: [], amberNotRisk: [], amberCleared: [], heads: [bc.headCell(null), bc.headCell(row)], order: bc.CELL_ORDER, wheres: [] };
  for (const x of set) for (const b of x.bills) { if (seen.has(b.id) || !st.isAlive(b)) continue; seen.add(b.id);
    const c = bc.deadlineCell(b, row); out.counts[c.key] = (out.counts[c.key] || 0) + 1;
    if (!bc.CELL_ORDER.includes(c.key) || typeof c.text !== 'string' || !c.text) out.bad.push(b.bill_number + ':' + c.key);
    if (c.amber && !(st.isAtRisk(b) || c.key === 'late')) out.amberNotRisk.push(b.bill_number);
    if (c.amber && is.clearedOf(b, row) === 'yes') out.amberCleared.push(b.bill_number);
    if (out.wheres.length < 400) out.wheres.push(bc.whereCell(b)); }
  out.n = seen.size; return out; }"""

with sync_playwright() as p:
    br = p.chromium.launch()
    ctx = br.new_context(viewport={'width': 1440, 'height': 900}); bad = []; errs = []
    def block(route):
        u = route.request.url
        if 'fonts.g' in u: return route.continue_()
        bad.append(u); route.abort()
    ctx.route(lambda u: '127.0.0.1' not in u and 'localhost' not in u, block)
    pg = ctx.new_page()
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'Failed to load resource' not in m.text and 'ERR_FAILED' not in m.text else None)
    pg.goto(f'{BASE}/staff7.html?demo=1&as=NT#/issues'); pg.wait_for_selector('section[aria-labelledby^="g-"]', timeout=60000); pg.wait_for_timeout(500)
    for name, hash in (('Mine', '#/issues'), ('Everyone', '#/issues?who=all')):
        pg.goto(f'{BASE}/staff7.html?demo=1&as=NT{hash}'); pg.wait_for_selector('#summ', timeout=60000); pg.wait_for_timeout(600)
        r = pg.evaluate(PAGE)
        ok('Moving' not in r['text'] and not re.search(r'\bmoving\b', r['summ']), f'{name}: no "Moving" anywhere on the page')
        heads = [re.sub(r' · \d+$', '', g['h']) for g in r['groups']]
        idx = [next((i for i, o in enumerate(ORDER) if h.startswith(o)), -1) for h in heads]
        ok(heads and -1 not in idx and idx == sorted(idx) and len(set(idx)) == len(idx), f'{name}: group headings in the order of the groups ({heads})')
        m = re.match(r'(\d+) issues?', r['summ']); total = int(m.group(1)) if m else -1
        pw = re.search(r'(\d+) past (its|their) committees', r['summ'])
        ok(not pw or (pw.group(2) == 'its') == (pw.group(1) == '1'), f'{name}: the past group says "its" for 1 and "their" for more')
        nums = [(int(a), w) for a, w in re.findall(r'(\d+) (at risk|with a hearing|need a hearing|cleared the deadline|past committees|stopped)', re.sub(r'past (its|their) committees', 'past committees', r['summ']))]
        ok(total > 0 and sum(a for a, _ in nums) == total, f'{name}: the count line adds up: "{r["summ"]}"')
        ok([w for _, w in nums] == [w for w in WORDS if w in [x for _, x in nums]], f'{name}: the count line words are in the order of the groups')
        # Everyone's list leads with At risk and then lists topics, so the other groups are read narrowed (?show=)
        if name == 'Everyone':
            shown = {}
            for k in ('hearing', 'need', 'cleared', 'past', 'stopped'):
                pg.goto(f'{BASE}/staff7.html?demo=1&as=NT#/issues?who=all&show={k}'); pg.wait_for_selector('#summ', timeout=60000); pg.wait_for_timeout(400); shown[k] = pg.evaluate(PAGE)
            r['groups'] = r['groups'] + [g for k in shown for g in shown[k]['groups']]
        ok(sum(g['n'] for g in r['groups']) == total, f'{name}: the group counts add up to the issue count ({total})')
        need = next((g for g in r['groups'] if g['h'].startswith('Needs a hearing')), None)
        ok(need and need['rows'] and all(re.search(r'· by .+ · (\d+ days|today|tomorrow)$', t) or '·' not in t.split(' · by ')[0] and ' · by ' not in t for t in need['rows']) and any(' · by ' in t for t in need['rows']),
           f'{name}: "Needs a hearing" second lines read "In ... · by Mon, Mar 30 · 14 days" ({(need or {"rows": []})["rows"][:2]})')
        past = next((g for g in r['groups'] if g['h'].startswith('Past committees')), None)
        ok(past is None or all(t and 'by ' not in t and 'has until' not in t for t in past['rows']), f'{name}: "Past committees" second lines are the phase words ({(past or {"rows": []})["rows"][:2]})')
        if name == 'Everyone': pg.screenshot(path='/private/tmp/claude-501/-Users-natehix--claude-spares-spare-zTmcFY/44767ddd-ed84-4c32-9b0f-b9986f5c326a/scratchpad/build/A_issues.png')
    m = pg.evaluate(MODEL)
    print('counts per key:', dict(sorted(m['counts'].items(), key=lambda kv: m['order'].index(kv[0]))), 'of', m['n'], 'alive bills')
    ok(m['n'] > 0 and sum(m['counts'].values()) == m['n'] and not m['bad'], f'every alive bill gets one key from CELL_ORDER with words ({m["bad"][:3]})')
    ok(m['order'] == ['risk', 'late', 'hearing', 'need', 'until', 'unsure', 'cleared', 'noask', 'past'], 'CELL_ORDER is the contract')
    ok(not m['amberCleared'], f'no bill that cleared the next deadline is amber ({m["amberCleared"][:3]})')
    ok(not m['amberNotRisk'], f'every amber bill is at risk or "late" ({m["amberNotRisk"][:3]})')
    ok(m['heads'][0] == 'Deadline' and re.fullmatch(r'Deadline \w{3} \d+ · (today|tomorrow|\d+ days)', m['heads'][1] or '') is not None, f'headCell: {m["heads"]}')
    ok(all(isinstance(w, str) and w for w in m['wheres']), f'whereCell gives words for every bill (e.g. {m["wheres"][:2]})')
    ok(not errs, f'no console errors {errs[:2]}')
    ok(not bad, f'no request leaves 127.0.0.1 {bad[:2]}')
    br.close()
print(f'{sum(res)}/{len(res)} passed'); sys.exit(0 if all(res) else 1)
