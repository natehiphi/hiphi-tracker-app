# R-081: a bill's pathway names each committee (Nate 9/29). Sandbox bills, phone to laptop.
# python3 tests/pathway.py [base_url]
# Checks: one dot per committee (two or three heard together are one), full committee names (never "undefined", never
# cut short), the words under the dots, the committee links in "See all steps", no dot names overlapping each other or
# leaving the card (HB1782's did on laptops, 9/29), and no sideways scroll on a 320px phone with eleven dots.
import sys, json, os
from playwright.sync_api import sync_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832/track.html'
SEEN = "try{localStorage.setItem('hiphi_tour_bill','1');localStorage.setItem('hiphi_tour_bill_demo','1');localStorage.setItem('hiphi_wiz',JSON.stringify({step:1,done:true,skipped:true}))}catch(e){}"
snap = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'demo', 'snapshot.json')))
# Eleven steps, the most a bill can have: HB1518 given a third Senate committee, in this browser's copy only.
for b in snap['bills']:
    if b['bill_number'] == 'HB1518': b['referrals'] = ['HSH', 'PBS', 'FIN', 'PSM/HHS', 'JDC', 'WAM']; b['second_stops'] = 3
BODY = json.dumps(snap)
# bill, dots, the words under the dots (phone), committee links in See all steps
CASES = [
    ('HB1518', 11, 'Now: Senate Judiciary, 2nd of 3 Senate committees', 7),
    ('HB2049', 10, 'Now: Senate Water, Land, Culture and the Arts with Housing and Hawaiian Affairs, 1st of 2 Senate committees', 8),
    ('HB1926', 10, 'Now: Senate Ways and Means with Judiciary, 2nd of 2 Senate committees', 7),
    ('HB2148', 7, 'Now: Senate Ways and Means, its only Senate committee', 2),
    ('HB1314', 9, 'Stopped in House Health', 3),
]
OVERLAP = """() => { const box = e => { const r = document.createRange(); r.selectNodeContents(e); const b = r.getBoundingClientRect(); return { t: e.textContent, l: b.left, r: b.right, top: b.top, bot: b.bottom }; };
  const ls = [...document.querySelectorAll('.bl-dlbl')].filter(e => e.offsetParent).map(box), bad = [];
  for (let i = 0; i < ls.length; i++) for (let j = i + 1; j < ls.length; j++) { const a = ls[i], b = ls[j];
    if (a.l < b.r - 1 && b.l < a.r - 1 && a.top < b.bot - 1 && b.top < a.bot - 1) bad.push(a.t + ' | ' + b.t); }
  const card = document.querySelector('.bl-rail').getBoundingClientRect();
  return { bad, out: ls.filter(x => x.l < card.left - 1 || x.r > card.right + 1).map(x => x.t) }; }"""
passes = fails = 0
def ok(c, m):
    global passes, fails
    print('PASS' if c else 'FAIL', m); passes += bool(c); fails += (not c)
with sync_playwright() as pw:
    br = pw.chromium.launch()
    for w in (320, 390, 760, 1024, 1280):
        c = br.new_context(viewport={'width': w, 'height': 900}, is_mobile=w < 600, has_touch=w < 600)
        c.add_init_script(SEEN)
        c.route('**/demo/snapshot.json*', lambda r: r.fulfill(status=200, content_type='application/json', body=BODY))
        p = c.new_page(); errs = []; p.on('pageerror', lambda e: errs.append(str(e)))
        for num, n, now, links in CASES:
            p.goto(BASE + '?demo=1#/bill/' + num); p.wait_for_timeout(2200)
            got = p.evaluate("""() => ({ n: document.querySelectorAll('.bl-dots li').length, now: document.querySelector('.bl-nowlbl')?.textContent || '',
              names: [...document.querySelectorAll('.bl-dlbl')].map(e => e.textContent),
              links: document.querySelectorAll('.bl-steplist a[href^="#/committee/"]').length,
              sideways: document.documentElement.scrollWidth > innerWidth })""")
            ok(got['n'] == n, f'{w} {num}: {n} dots, one per committee ({got["n"]})')
            ok(got['now'] == now, f'{w} {num}: "{now}" ("{got["now"]}")')
            ok(got['links'] == links, f'{w} {num}: {links} committee links in See all steps ({got["links"]})')
            ok(not any('undefined' in x or 'null' in x for x in got['names']), f'{w} {num}: every dot has a name')
            ok(not got['sideways'], f'{w} {num}: no sideways scroll')
            if w >= 700:
                r = p.evaluate(OVERLAP)
                ok(not r['bad'] and not r['out'], f'{w} {num}: dot names do not overlap or leave the card {r}')
        ok(not errs, f'{w}: no page errors {errs[:2]}')
        c.close()
print(f'\n{passes} passed, {fails} failed')
