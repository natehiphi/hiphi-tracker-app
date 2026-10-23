# Staff v5: turning someone off never hides their work (R-316 W28, G3-3). On the practice copy (Mon 16 Mar 2026), as
# Nate on Team: for every teammate who owns bills, turning them off must not lower Slipping's count, their name must
# say "(turned off)" where it still shows (G3-8: six screens, Lauren off and back on) and, where it shows as the owner,
# that it needs a new one (fresh-eyes), and they leave the going lists. The hearing page names who files approved
# testimony when that is not the row's owner (W20, T-3). Exits 1 when a check fails.
#   python3 tests/staff5_turnoff.py                  against http://localhost:8832
#   V4_ROOT=/path/to/worktree python3 tests/staff5_turnoff.py    serves that folder straight into the browser
import os, sys
from playwright.sync_api import sync_playwright
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from staff5_people import router, HOST, ROOT

fails = []
def check(ok, what):
  print(('ok   ' if ok else 'FAIL ') + what)
  if not ok: fails.append(what)

# Turn each owner off in turn (in the page's own state; nothing is saved), redraw, count Slipping's rows, put them back.
SWEEP = """async () => {
  const { S, hooks } = await import('./staff5/data.js'), m = await import('./staff5/model.js');
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const count = () => document.querySelectorAll('.td-slip .td-row, .td-slip .td-mrow').length;
  hooks.render(); await wait(600); const base = count(), out = [];
  const owners = [...new Set(Object.values(S.assignments || {}).flat())].filter(id => S.advocates.some(a => a.id === id && a.is_active !== false));
  for (const id of owners) {
    const a = S.advocates.find(x => x.id === id); if (a.id === S.me.id) continue;
    const goingBefore = Object.keys(S.attend || {}).filter(h => m.attendees({ id: h }).some(x => x.id === id)).length;
    a.is_active = false; hooks.render(); await wait(500);
    const n = count(), going = Object.keys(S.attend || {}).filter(h => m.attendees({ id: h }).some(x => x.id === id)).length;
    out.push({ who: a.full_name, n, going, goingBefore });
    a.is_active = true;
  }
  hooks.render(); await wait(400);
  return { base, out };
}"""

with sync_playwright() as p:
  br = p.chromium.launch(); pg = br.new_page(viewport={'width': 1440, 'height': 900})
  if ROOT: pg.route(HOST + '/**', router)
  pg.goto(HOST + '/staff5.html?demo=1&as=NT#/?scope=team'); pg.wait_for_timeout(5000)
  r = pg.evaluate(SWEEP)
  check(r['base'] > 0, f"Slipping has rows on the practice day ({r['base']})")
  check(len(r['out']) >= 3, f"tried turning off {len(r['out'])} owners")
  low = [f"{x['who']} {r['base']}->{x['n']}" for x in r['out'] if x['n'] < r['base']]
  check(not low, f"turning off any owner never lowers the Slipping count (lowered: {low[:4]})")
  went = [x['who'] for x in r['out'] if x['going']]
  check(not went, f"someone turned off leaves every going list (still going: {went[:4]})")

  # G3-8: Lauren turned off still holds her bills, HEAL and her issues until Nate hands them on, so her name says
  # "(turned off)" wherever it still shows as owner, and (fresh-eyes) that it needs a new owner, as Slipping's "No owner
  # (was Lauren's, turned off)" does: her bill's page, its hearing's row, the coalition she owns, Session setup's
  # coalitions (whose summary counts her: "1 owner turned off"), an issue she owns and Review's card for her bill. Back
  # on, the words are gone.
  where = pg.evaluate("""async () => {
    const { S } = await import('./staff5/data.js');
    const lr = S.advocates.find(a => a.initials === 'LR'), mine = id => (S.assignments[id] || [])[0] === lr.id;
    const d = Object.values(S.drafts).flat().find(x => x.status === 'review' && mine(x.bill_id) && x.submitted_by && x.submitted_by !== lr.id);
    const b = d && S.bills.find(x => x.id === d.bill_id);
    return { lr: lr.id, bill: b?.bill_number, draft: d?.id, hearing: d?.hearing_id,
      coal: S.campaigns.find(c => c.owner_id === lr.id)?.id, issue: (S.issues || []).find(i => i.owner_id === lr.id && !i.archived_at)?.id }; }""")
  check(all(where.values()), f"the practice copy has a bill, review draft, hearing, coalition and issue of Lauren's ({where})")
  OFF = """async ({ off, route }) => {
    const { S, hooks } = await import('./staff5/data.js'), wait = ms => new Promise(r => setTimeout(r, ms));
    S.advocates.find(a => a.initials === 'LR').is_active = !off;
    location.hash = route; await wait(900); hooks.render(); await wait(700);
    document.querySelectorAll('main details').forEach(x => x.open = true);   // the issue's folded prep card holds its owner
    return document.querySelector('main')?.textContent || ''; }"""
  NEW = 'Lauren (turned off), needs a new owner'
  pages = [('her bill\'s page', '#/bill/' + str(where['bill']), NEW),
           ('her bill\'s row on the hearing page', '#/hearing/' + str(where['hearing']), NEW),
           ('the coalition she owns', '#/coalition/' + str(where['coal']), 'Owner: ' + NEW),
           ('Session setup > Coalitions', '#/setup/coalitions', NEW),
           ('Session setup > Coalitions, its summary', '#/setup/coalitions', '1 owner turned off'),
           ('an issue she owns', '#/issue/' + str(where['issue']), NEW),
           ('Review, her bill\'s card', '#/review/' + str(where['draft']), 'Lauren (turned off) owns it, needs a new owner')]
  for name, route, want in pages:
    t = pg.evaluate(OFF, {'off': True, 'route': route})
    check(want in t, f"turned off: {name} says \"{want}\"")
    t = pg.evaluate(OFF, {'off': False, 'route': route})
    check('(turned off)' not in t and 'owner turned off' not in t and 'needs a new owner' not in t and 'Lauren' in t, f"back on: {name} names Lauren without \"(turned off)\" or \"needs a new owner\"")
  pg.evaluate(OFF, {'off': True, 'route': '#/bill/' + str(where['bill'])})
  own = pg.evaluate("[...document.querySelectorAll('main [data-bwpick=\"own\"]')].map(e => e.textContent.trim() + ' / ' + e.getAttribute('aria-label'))")
  check(own and all(x.count(NEW) == 2 for x in own), f"her bill's Owner picker says \"{NEW}\", on screen and to a screen reader ({own[:1]})")
  # Setup keeps a turned-off owner on the Owner list, so saving another card never sets HEAL to No owner.
  pg.evaluate(OFF, {'off': True, 'route': '#/setup/coalitions'})
  sel = pg.evaluate(f"document.querySelector('[data-coal=\"{where['coal']}\"] [data-cowner]')?.value")
  check(sel == where['lr'], f"Session setup: HEAL's Owner list still has Lauren picked while she is off ({sel})")
  pg.evaluate(OFF, {'off': False, 'route': '#/'})

  # W20 (T-3): a hearing page's row with approved testimony names who files it, whoever sent it for approval ("you" for
  # the viewer), else the bill's owner; fresh-eyes: only when that is not the row's owner, who is named just beside it
  # ("Kevin files it" beside "KV Kevin" said it twice). Every approved draft on the practice copy was sent by its bill's
  # owner, so the owner is moved in the page's state (nothing is saved) to see the other case.
  FILER = """async ({ num, owner, off, route }) => {
    const { S, hooks } = await import('./staff5/data.js'), wait = ms => new Promise(r => setTimeout(r, ms));
    const b = S.bills.find(x => x.bill_number === num), d = Object.values(S.drafts).flat().find(x => x.bill_id === b.id && x.status === 'approved');
    S._own ??= {}; S._own[b.id] ??= S.assignments[b.id]; S.assignments[b.id] = owner ? [S.advocates.find(a => a.initials === owner).id] : S._own[b.id];
    S.advocates.forEach(a => { a._on ??= a.is_active; a.is_active = a.initials === off ? false : a._on; });
    location.hash = route || '#/hearing/' + d.hearing_id; await wait(900); hooks.render(); await wait(600);
    const r = [...document.querySelectorAll('main a.hr-bill')].find(e => e.getAttribute('href').endsWith('/' + num));
    return r ? { chip: (r.querySelector('.hr-bs') || {}).textContent || '', facts: (r.querySelector('.hr-bf') || {}).textContent || '', who: S.advocates.find(a => a.id === d.submitted_by)?.initials } : null; }"""
  kv = pg.evaluate(FILER, {'num': 'HB2121', 'owner': None, 'off': None})
  check(kv and kv['who'] == 'KV' and 'Kevin' in kv['facts'] and 'Testimony ready to file' in kv['chip'] and 'files it' not in kv['chip'],
        f"hearing page: Kevin's own bill, sent by him, says \"Testimony ready to file\" without naming him again ({kv})")
  kv = pg.evaluate(FILER, {'num': 'HB2121', 'owner': 'LR', 'off': None})
  check(kv and 'Testimony ready to file · Kevin files it' in kv['chip'], f"hearing page: owned by Lauren, sent by Kevin: \"Kevin files it\" ({kv and kv['chip']})")
  kv = pg.evaluate(FILER, {'num': 'HB2121', 'owner': None, 'off': 'KV'})
  check(kv and 'Kevin (turned off), needs a new owner' in kv['facts'] and 'files it' not in kv['chip'],
        f"hearing page: sender and owner turned off: the owner says \"Kevin (turned off), needs a new owner\" and the chip does not name him ({kv})")
  nt = pg.evaluate(FILER, {'num': 'HB1562', 'owner': None, 'off': None})
  check(nt and nt['who'] == 'NT' and 'You' in nt['facts'] and 'files it' not in nt['chip'] and 'file it' not in nt['chip'].replace('ready to file', ''),
        f"hearing page: Nate's own bill, sent by him: no \"you file it\" beside \"You\" ({nt})")
  nt = pg.evaluate(FILER, {'num': 'HB1562', 'owner': 'KV', 'off': None})
  check(nt and '· you file it' in nt['chip'], f"hearing page: owned by Kevin, sent by Nate: \"you file it\" ({nt and nt['chip']})")
  pg.evaluate(FILER, {'num': 'HB1562', 'owner': None, 'off': None, 'route': '#/'})
  pg.evaluate(FILER, {'num': 'HB2121', 'owner': None, 'off': None, 'route': '#/'})
  br.close()
print('\nall passed' if not fails else f'\n{len(fails)} failed'); sys.exit(1 if fails else 0)
