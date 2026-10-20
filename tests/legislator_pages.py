# R-212 #25: a legislator's long page folds, says why it is quiet between sessions, is never bare, and a hearing card has one
# row (not two) when the chair is the person's own senator; the hello letter works for someone who follows only a bill.
# python3 tests/legislator_pages.py [base]   (base: a server root, default http://localhost:8832/)
import sys
from playwright.sync_api import sync_playwright

BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832/').rstrip('/') + '/track.html'
HILO = "localStorage.setItem('hiphi_districts', JSON.stringify({senate:2,house:1,label:'Hilo',island:'hawaii'}))"
ok = bad = 0
def check(name, cond, got=''):
    global ok, bad
    if cond: ok += 1; print('PASS', name)
    else: bad += 1; print('FAIL', name, got)

with sync_playwright() as p:
    br = p.chromium.launch(); ctx = br.new_context(viewport={'width': 390, 'height': 844}); ctx.add_init_script(f'try{{{HILO}}}catch(e){{}}')
    pg = ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    # A chair with many bills (practice copy, Sen. Fevella chairs or sits on six committees): six rows, the rest folded.
    pg.goto(BASE + '?demo=1#/legislator/166'); pg.wait_for_selector('.pp-person'); pg.wait_for_timeout(1500)
    n = pg.evaluate("document.querySelectorAll('.pp-billrow').length"); shown = pg.evaluate("[...document.querySelectorAll('.pp-billrow')].filter(r => r.checkVisibility()).length")
    summ = pg.evaluate("document.querySelector('.pp-fold summary')?.textContent.trim() || ''")
    check('a long list shows 6 bills', n > 6 and shown == 6, (n, shown))
    check('the fold says how many in all', summ.startswith(f'Show all {n} bills'), summ)
    pg.click('.pp-fold summary'); pg.wait_for_timeout(200)
    check('opening it shows them all', pg.evaluate("[...document.querySelectorAll('.pp-billrow')].filter(r => r.checkVisibility()).length") == n)
    # A bill with a hearing ahead comes before any bill that only waits (the critic: the fold hid testimony due tomorrow).
    order = pg.evaluate("[...document.querySelectorAll('.pp-billrow')].map(r => /Hearing|testimony/i.test(r.textContent) ? 1 : 0)")
    check('hearings ahead lead the list', order == sorted(order, reverse=True), order)
    check('in session there is no break line', not pg.evaluate("!!document.querySelector('.pp-offline')"))
    # The Speaker has no committees: the page says so instead of ending at the name.
    pg.goto(BASE + '?demo=1#/legislator/100'); pg.wait_for_selector('.pp-person'); pg.wait_for_timeout(800)
    check('the Speaker: one line says why there are no committees', 'leads the House and does not sit on its committees' in pg.inner_text('.pp-rest'))
    # Between sessions, with no email or phone listed.
    pg.goto(BASE + '?demo=1&season=off#/legislator/188'); pg.wait_for_selector('.pp-person'); pg.wait_for_timeout(800)
    off = pg.evaluate("document.querySelector('.pp-offline')?.textContent.trim() || ''")
    check('between sessions: the break line', off.startswith('The Legislature is on break until') and 'set when the session opens' in off, off)
    check('no contact: the card says so', 'No email or phone number is listed' in pg.inner_text('.pp-sidecard'))
    # HB1562's hearing is run by Sen. San Buenaventura, the senator for Senate District 2: one row to her, which says so.
    # The practice copy starts each new visit clean, so the districts are set once it has loaded, then the page drawn again.
    pg.goto(BASE + '?demo=1#/bill/HB1562'); pg.wait_for_timeout(2000); pg.evaluate(HILO); pg.reload(); pg.wait_for_timeout(2500)
    more = pg.get_by_text('More ways to help')
    if more.count(): more.first.click(); pg.wait_for_timeout(400)
    txt = pg.inner_text('main')
    check('own chair: the email row says "your senator"', 'San Buenaventura, your senator, who runs this hearing' in txt, [l for l in txt.split('\n') if 'short note' in l or 'ways to help' in l])
    check('own chair: no second row to the same senator', 'Write to Sen. San Buenaventura' not in txt)
    # The hello letter for someone who follows one bill and no issue names that bill's issue.
    top = pg.evaluate("""async () => { const c = await import('./pub/core.js'), h = await import('./pub/hello.js'), S = c.S;
      const all = [...S.bills, ...Object.values(S.extra || {})], b = all.find(x => c.issuesOf(x).length); if (!b) return 'no bill';
      const k = { i: S.issueFollows, ca: S.catFollows, st: S.stances, w: S.watch };
      S.issueFollows = new Set(); S.catFollows = new Set(); S.stances = {}; S.watch = new Set([b.id]);
      try { return [h.helloFacts('').top?.name || '', c.issuesOf(b)[0].name]; } finally { Object.assign(S, { issueFollows: k.i, catFollows: k.ca, stances: k.st, watch: k.w }); } }""")
    check('hello for a bill follower names its issue', isinstance(top, list) and top[0] and top[0] == top[1], top)
    check('no page errors', not errs, errs)
    br.close()
print(f'\n{ok} passed, {bad} failed'); sys.exit(1 if bad else 0)
