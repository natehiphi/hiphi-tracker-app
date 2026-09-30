# R-100: every public screen opens without a page error, as three kinds of person, in the sandbox and on live data.
# Why: on 9/29 My issues threw for every returning follower (a helper was removed and its call left behind) and no test
# noticed, because the suites record page errors without failing and none opened My issues as a follower with a stopped
# bill and a "last seen" stamp. This one fails on any uncaught error or console error on any route.
#   python3 tests/screens_smoke.py [base]      base defaults to http://localhost:8832/ (the published site works too)
# The live half reads production as the public does; the privacy signal is set so no visit is counted.
import json, os, sys, time
from playwright.sync_api import sync_playwright

BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832/').rstrip('/') + '/'
HERE = os.path.dirname(os.path.abspath(__file__))
snap = json.load(open(os.path.join(HERE, '..', 'demo', 'snapshot.json')))
issues = snap.get('issues', [])
by_slug = {i['slug']: i for i in issues}
bills = {b['id']: b for b in snap['bills']}
# Issues whose bills include stopped ones: the case that crashed My issues (a stopped bill's news item and its date).
stopped_bills = {b['id'] for b in snap['bills'] if b.get('stage') in ('dead', 'vetoed') or b.get('died_at_stage')}
issue_bills = {}
for r in snap.get('billIssues', []):
    issue_bills.setdefault(r['issue_id'], []).append(r['bill_id'])
with_stopped = [i['id'] for i in issues if any(b in stopped_bills for b in issue_bills.get(i['id'], []))]
vape = by_slug.get('disposable-vape-ban') or issues[0]
cats = [c['key'] for c in snap.get('categories', [])][:2]
leg = snap['legislators'][0]['id']
PERSONAS = {
    'newcomer': None,
    'returning': {'hiphi_wiz': {'step': 1, 'done': True, 'skipped': True},
                  'hiphi_issue_follows': list(dict.fromkeys([vape['id']] + with_stopped[:3])),
                  'hiphi_bills_seen': {'t': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(time.time() - 3 * 86400)), 'k': []}},
    'heavy': {'hiphi_wiz': {'step': 1, 'done': True, 'skipped': True},
              'hiphi_cat_follows': cats, 'hiphi_issue_follows': [i['id'] for i in issues[:4]]},
}
ROUTES = ['#/', '#/bills', '#/find', f'#/find/category/{cats[0]}', f"#/issue/{vape['slug']}", '#/bill/HB2121',
          '#/legislators', f'#/legislator/{leg}', '#/committees', '#/more', '#/allbills', '#/help', '#/settings',
          '#/privacy', '#/learn/story']
INIT = ("Object.defineProperty(Navigator.prototype,'globalPrivacyControl',{get:()=>true});"
        "Object.defineProperty(Navigator.prototype,'doNotTrack',{get:()=>'1'});"
        "try{localStorage.setItem('hiphi_tour_bill','1');localStorage.setItem('hiphi_tour_bill_demo','1')}catch(e){}")
# An interrupted fetch of the 5 MB sandbox file when a page reloads is the harness, not the app (frontend CLAUDE.md).
BENIGN = ('Failed to fetch', 'ERR_FAILED', 'ERR_ABORTED', 'net::ERR')
ok = fail = 0
def check(c, m):
    global ok, fail
    print('PASS' if c else 'FAIL', m); ok += bool(c); fail += (not c)

with sync_playwright() as p:
    b = p.chromium.launch()
    for mode, page in [('sandbox', 'track.html?demo=1&seed=1'), ('live', 'track.html')]:
        for who, store in PERSONAS.items():
            ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
            ctx.add_init_script(INIT)
            pg = ctx.new_page(); errs = []
            pg.on('pageerror', lambda e: errs.append('pageerror: ' + str(e).splitlines()[0]))
            pg.on('console', lambda m: errs.append('console: ' + m.text[:160]) if m.type == 'error' and not any(x in m.text for x in BENIGN) else None)
            pg.goto(BASE + page + '#/'); pg.wait_for_timeout(1500)
            pg.evaluate('localStorage.clear(); sessionStorage.clear()')
            pg.evaluate("localStorage.setItem('hiphi_tour_bill','1')")
            if store:
                for k, v in store.items():
                    pg.evaluate('([k, v]) => localStorage.setItem(k, v)', [k, json.dumps(v)])
            pg.reload(); pg.wait_for_timeout(3000)
            for r in ROUTES:
                errs.clear()
                pg.evaluate(f'location.hash = {json.dumps(r)}'); pg.wait_for_timeout(1600)
                failed = pg.locator("text=We couldn't load").count()
                check(not errs and not failed, f'{mode} · {who} · {r}' + (f'  {errs[:2]}' if errs else '') + ('  (error card)' if failed else ''))
            ctx.close()
    b.close()
print(f'\n{ok} passed, {fail} failed')
sys.exit(1 if fail else 0)
