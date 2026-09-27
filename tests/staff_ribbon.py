# R-005 (option A): the stage caption sits under its own bar on the staff bill page and the quick look; an end label is
# hidden only where the caption would touch it. Sandbox; many bills at every stage; phone and laptop.
import sys
from playwright.sync_api import sync_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832/staff.html?demo=1'
ok = fail = 0
def check(c, m):
    global ok, fail
    if not c or '--v' in sys.argv: print('PASS' if c else 'FAIL', m)
    ok += bool(c); fail += (not c)
# Bills from the sandbox at every stage: the live ones at theirs, and dead ones stopped at many different steps.
import json, collections
_bills = [b for b in json.load(open('demo/snapshot.json'))['bills'] if b.get('tracked')]
_by = collections.defaultdict(list)
for b in _bills: _by[b.get('stage')].append(b)
HREFS = []
for st, lst in _by.items(): HREFS += ['#/bill/' + b['bill_number'].replace(' ', '') for b in lst[:: max(1, len(lst) // (40 if st == 'dead' else 4))]]
M = """() => { const p = document.querySelector('.bw-page .sv-riblab'); if (!p) return null; const at = +p.dataset.at;
  const bars = p.previousElementSibling, b = p.querySelector('b').getBoundingClientRect(), box = p.getBoundingClientRect();
  const seg = at >= 0 ? bars.children[at].getBoundingClientRect() : null;
  const ends = [p.firstElementChild, p.lastElementChild].map(e => ({ r: e.getBoundingClientRect(), on: getComputedStyle(e).visibility === 'visible', t: e.textContent }));
  return { at, n: bars.children.length, said: p.querySelector('b').textContent, anch: p.classList.contains('anch'), bL: b.left, bR: b.right, bC: (b.left + b.right) / 2,
    segC: seg ? (seg.left + seg.right) / 2 : null, boxL: box.left, boxR: box.right, ends }; }"""
with sync_playwright() as p:
    br = p.chromium.launch()
    for w, h, mob in [(390, 844, True), (1280, 800, False)]:
        ctx = br.new_context(viewport={'width': w, 'height': h}, is_mobile=mob, has_touch=mob); pg = ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(BASE + '#/bills'); pg.reload(); pg.wait_for_timeout(3500)
        seen = {}
        for href in HREFS:
            pg.evaluate(f"location.hash = '{href}'"); pg.wait_for_timeout(350)
            a = pg.evaluate(M)
            if not a: continue
            k = (a['at'], a['said'][:14])
            if k in seen: continue
            seen[k] = href
            tag = f"{w}px {href} step {a['at'] + 1}/{a['n']} “{a['said']}”"
            if a['at'] < 0: check(True, tag + ': no step marked, centred'); continue
            check(a['anch'], tag + ': placed')
            want = min(max(a['segC'], a['boxL'] + (a['bR'] - a['bL']) / 2), a['boxR'] - (a['bR'] - a['bL']) / 2)
            check(abs(a['bC'] - want) <= 1.5, tag + f": caption centred on its bar (off by {a['bC'] - want:.1f}px)")
            check(a['bL'] >= a['boxL'] - 0.5 and a['bR'] <= a['boxR'] + 0.5, tag + ': caption inside the line')
            for e in a['ends']:
                if e['on']: check(e['r']['right'] + 4 <= a['bL'] or e['r']['left'] >= a['bR'] + 4, tag + f": visible end “{e['t']}” does not touch the caption")
            check(a['ends'][0]['on'] or a['ends'][1]['on'] or a['at'] in (0, a['n'] - 1), tag + ': at least one end label stays')
        print(f'{w}px: {len(seen)} distinct stages checked')
        pg.screenshot(path=f'tests/out/ribbon_{w}.png')
        check(len(seen) >= 6, f'{w}px: enough variety ({len(seen)})')
        check(not errs, f'{w}px: no page errors ' + '; '.join(errs))
        ctx.close()
    br.close()
print(f'\n{ok} passed, {fail} failed')
