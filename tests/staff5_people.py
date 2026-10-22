# Staff v5: each person's most important things, where R-269 put them (Nate's targets, 12 Oct 2026). Eight people on the
# practice copy (Mon 16 Mar 2026, 9:00 am HST unless a check moves the clock), laptop 1440x900, and a phone on a hearing
# day for Kris and Lauren. Patti (PH, HEAL) and Julie (JMM, HIAPA) are not in the practice data yet, so this test adds them
# as the snapshot is served, and moves the practice clock with &asof by rewriting the two clocks as they are served. Nothing
# is written to the repo. Exits 1 when a target is missed.
#   python3 tests/staff5_people.py                  against http://localhost:8832 (CI serves the repo there)
#   V4_ROOT=/path/to/worktree python3 tests/staff5_people.py    serves that folder straight into the browser
import json, mimetypes, os, re, sys
from urllib.parse import urlparse, unquote
from playwright.sync_api import sync_playwright

ROOT = os.environ.get('V4_ROOT', '')
HOST = 'https://v4.test' if ROOT else os.environ.get('HOST', 'http://localhost:8832')
EXTRA = [('aaaaaaaa-0000-4000-8000-00000000a011', 'Patti', 'PH', '#8e5ea2', 'HEAL'),
         ('aaaaaaaa-0000-4000-8000-00000000a012', 'Julie', 'JMM', '#3b8d6e', 'HIAPA')]
CLOCKS = {'staff5/data.js': "export const DEMO_ASOF = DEMO_OFF", 'pub/kernel.js': "export const DEMO_ASOF = SEASON_OFF"}
TRN_TUE = '16eeec38-adf0-43f7-954d-30e358b7eac8'      # SB3234, TRN Tue 3/17 9:30 AM, Rm 430 (HEAL)
HHSCPN_FRI = '9ebffb71-69c2-4868-8956-e624cac16d30'   # HB1573 and three more, HHS/CPN Fri 3/20 9:30 AM, Rm 229

def body_for(rel, raw):
  if rel == 'demo/snapshot.json':
    s = json.loads(raw); camp = {c['name']: c['id'] for c in s['campaigns']}; have = {a['initials'] for a in s['advocates']}
    for i, full, ini, col, co in EXTRA:
      if ini not in have: s['advocates'].append({'id': i, 'full_name': full, 'initials': ini, 'color': col, 'email': None, 'is_admin': False,
        'is_reviewer': False, 'can_approve': False, 'is_active': True, 'focus_areas': None, 'prefs': {'coalitions': [camp[co]]}})
    return json.dumps(s).encode()
  if rel in CLOCKS:
    t = raw.decode(); old = CLOCKS[rel]
    if old in t: t = t.replace(old, "const T_ASOF = DEMO && new URLSearchParams(location.search).get('asof');\n" + old.replace('= ', '= T_ASOF ? T_ASOF : ', 1))
    return t.encode()
  return raw

def router(route):
  path = unquote(urlparse(route.request.url).path)
  rel = path.lstrip('/') or 'index.html'
  if ROOT:
    f = os.path.join(ROOT, rel)
    if not os.path.isfile(f): return route.fulfill(status=404, body='')
    raw = open(f, 'rb').read()
  else:
    if rel not in CLOCKS and rel != 'demo/snapshot.json': return route.continue_()
    r = route.fetch(); raw = r.body()
  t = {'.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.json': 'application/json'}.get(os.path.splitext(rel)[1]) or mimetypes.guess_type(rel)[0] or 'application/octet-stream'
  route.fulfill(status=200, body=body_for(rel, raw), headers={'content-type': t})

WHERE = r"""(t) => { const want = t.toLowerCase(); const els = [...document.querySelectorAll('main *')].filter(e => e.offsetParent !== null && e.children.length < 4 && (e.innerText || '').toLowerCase().includes(want));
  if (!els.length) return null; const e = els.sort((a, b) => (a.innerText || '').length - (b.innerText || '').length)[0];
  if (e.closest('details:not([open])')) return null; return Math.round(e.getBoundingClientRect().top + scrollY); }"""

results = []
def check(name, ok, detail=''):
  results.append((name, bool(ok), detail)); print(('ok   ' if ok else 'FAIL ') + name + (f'  ({detail})' if detail else ''))

def main():
  with sync_playwright() as p:
    b = p.chromium.launch()
    def page(who, W=1440, H=900, mobile=False):
      ctx = b.new_context(viewport={'width': W, 'height': H}, is_mobile=mobile, has_touch=mobile)
      ctx.route(HOST + '/**', router); pg = ctx.new_page(); pg.errs = []; pg.on('pageerror', lambda e: pg.errs.append(str(e)))
      pg.who = who; return pg
    def go(pg, route='/', asof='', wait=3500):
      pg.goto(f"{HOST}/staff5.html?demo=1&as={pg.who}{'&asof=' + asof if asof else ''}#{route}"); pg.wait_for_timeout(wait)
    at = lambda pg, t: pg.evaluate(WHERE, t)
    main_text = lambda pg: pg.inner_text('main')
    def going(pg, hid, asof):
      go(pg, '/hearing/' + hid, asof)
      btn = pg.get_by_role('button', name=re.compile(r"I.m going")).first
      if btn.count(): btn.click(); pg.wait_for_timeout(700)
      pg.evaluate("location.hash = '#/'"); pg.wait_for_timeout(2500)

    # Nate: what's slipping, in one place, from his Today (R-269 #7, D2/D3)
    pg = page('NT'); go(pg)
    y = at(pg, 'slipping on the team'); check('Nate: "slipping on the team" on his first screen', y is not None and y < 900, y)
    go(pg, '/?scope=team'); txt = main_text(pg)
    check('Nate: Team opens on the Slipping list', 'Slipping' in txt[:400], txt[:80].replace('\n', ' '))
    end = pg.evaluate("(() => { const s = [...document.querySelectorAll('main section')].find(x => /^\\s*Slipping/.test(x.innerText)); return s ? Math.round(s.getBoundingClientRect().bottom) : null; })()")
    check('Nate: the whole Slipping list on Team\'s first screen', end is not None and end <= 900, end)
    check('Nate: no page errors', not pg.errs, pg.errs[:1])

    # Jess: her approvals on every visit, even after a look at Team; late but open is never red "Overdue" (#2, #6)
    pg = page('JS'); go(pg); pg.get_by_role('button', name='Team', exact=True).first.click(); pg.wait_for_timeout(800)
    go(pg, '/'); txt = main_text(pg)
    check('Jess: Today reopens on hers after a look at Team', 'Team: today' not in txt[:200], txt[:60].replace('\n', ' '))
    y = at(pg, 'second approval'); check('Jess: her second approvals on her first screen', y is not None and y < 900, y)
    check('Jess: late but open testimony is not headed "Overdue"', 'Overdue' not in txt, '')
    check('Jess: "to approve", not "to file", on her approvals', 'to file' not in txt, '')

    # Kris: every hearing on her week says where its testimony stands (#1); on a phone on Friday her hearing leads (#4)
    pg = page('KR'); go(pg)
    # Kris supports every coalition, so "The team's week" starts folded (R-269 gate): open it to read its rows.
    if pg.query_selector('[data-fold="coal"]') and not pg.query_selector('.td-coal a.td-crow'): pg.click('[data-fold="coal"]'); pg.wait_for_timeout(600)
    rows = pg.evaluate("[...document.querySelectorAll('.td-coal a.td-crow[href*=\"/hearing/\"]')].map(a => a.innerText)")
    told = [r for r in rows if re.search(r'Testimony|No draft|draft yet|Filed|Ready to file|Sent back|in review|approval', r, re.I)]
    check('Kris: hearing rows that say where testimony stands', rows and len(told) == len(rows), f'{len(told)} of {len(rows)}')
    nobody = sum(r.count('Nobody from the team yet') for r in rows)
    check('Kris: "Nobody from the team yet" not on every row', nobody == 0, nobody)
    pg = page('KR', 390, 844, True); going(pg, HHSCPN_FRI, '2026-03-20T08:00:00-10:00')
    y = at(pg, 'Your hearing today'); check('Kris, phone, Friday: her hearing in the top third', y is not None and y < 0.3 * 844, y)
    h = pg.evaluate('document.documentElement.scrollHeight'); check('Kris, phone, Friday: Today under 1.5 screens', h < 1.5 * 844, h)

    # Patti: her sent-back draft and its deadline first, never "nothing of your own" (#1); This week is HEAL's (#3)
    pg = page('PH'); go(pg); txt = main_text(pg)
    check('Patti: no "Nothing of your own" over a draft due today', 'Nothing of your own' not in txt, '')
    y = at(pg, 'sent back'); check('Patti: "Sent back" on her first screen', y is not None and y < 900, y)
    go(pg, '/?view=week'); check('Patti: This week shows HEAL\'s SB3234', 'SB3234' in main_text(pg), '')

    # Kevin: on his deadline day the P1 testimony is row 1 (#5); one look at Team does not hide his work tomorrow (#2)
    pg = page('KV'); go(pg, '/', '2026-03-18T08:00:00-10:00')
    # R-271: a narrow row names the bill by its nickname alone, so the bill is read from the row's data-num
    first = pg.evaluate("(r => r ? (r.dataset.num || '') + ' ' + r.innerText : '')(document.querySelector('main .td-row'))")
    check('Kevin, Wednesday: HB2121 testimony leads', first.startswith('HB2121') and re.search(r'testimony', first, re.I), first[:70].replace('\n', ' '))
    pg.get_by_role('button', name='Team', exact=True).first.click(); pg.wait_for_timeout(800); go(pg, '/', '2026-03-18T08:00:00-10:00')
    check('Kevin: Today reopens on his own', 'Team: today' not in main_text(pg)[:200], '')

    # Saya: Outreach opens on this week's asks (#10)
    pg = page('SY'); go(pg, '/outreach')
    heads = pg.evaluate("[...document.querySelectorAll('main h1, main h2')].map(h => h.innerText).join(' | ')")
    check('Saya: Outreach opens on this week\'s asks', re.search(r'asks', heads, re.I) and not re.match(r'\s*Supporters', heads), heads[:80])
    check('Saya: the asks are CTFH\'s, not every coalition\'s', 'HB2121' in main_text(pg) and 'SB3234' not in main_text(pg), '')

    # Lauren: on a phone on her hearing day, her hearing and its testimony first (#4)
    pg = page('LR', 390, 844, True); going(pg, TRN_TUE, '2026-03-17T08:00:00-10:00')
    y = at(pg, 'Your hearing today'); check('Lauren, phone, Tuesday: her hearing first', y is not None and y < 0.3 * 844, y)
    card = pg.evaluate("(() => { const h = [...document.querySelectorAll('main h2, main h3')].find(x => /Your hearing today/.test(x.innerText)); const s = h && h.closest('section'); return s ? s.innerText : ''; })()")
    check('Lauren: the card says room 430 and the testimony', '430' in card and re.search(r'testimony', card, re.I), card[:80].replace('\n', ' '))

    # Julie: a quiet week says so once (#1); a week with alcohol hearings shows them on This week (#3)
    pg = page('JMM'); go(pg); y = at(pg, 'No hearings this week')
    check('Julie: "No hearings this week" on her first screen', y is not None and y < 900, y)
    go(pg, '/?view=week', '2026-02-23T09:00:00-10:00'); check('Julie: This week shows HIAPA\'s SB2463 (Fri 27 Feb)', 'SB2463' in main_text(pg), '')

    # Two people in one tab (R-316 W38): Kevin sends his draft for approval and adds a to-do, switches to Nate from his menu,
    # and Nate finds both; Start over in the menu puts the practice day back.
    pg = page('KV'); go(pg)
    sent = pg.evaluate("""(async () => { const m = await import('./staff5/data.js'), S = m.S;
      const d = Object.values(S.drafts).flat().find(d => d.status === 'draft' && (S.assignments[d.bill_id] || [])[0] === S.me.id);
      if (!d) return null; await m.DB.transition(d.bill_id, d.id, 'submit'); await m.DB.addTodo(d.bill_id, 'Two-person check: call the chair');
      return S.bills.find(b => b.id === d.bill_id).bill_number; })()""")
    check('Kevin: has a draft of his own to send', sent, sent)
    def menu(label):
      pg.click('.sv-avbtn'); pg.wait_for_timeout(500); pg.get_by_text(label).first.click(); pg.wait_for_timeout(600)
    menu('Practice as someone else'); pg.get_by_text('Nate').last.click(); pg.wait_for_timeout(3500)
    check('Kevin -> Nate: the menu switched person', '&as=NT' in pg.url, pg.url)
    go_nt = lambda r: (pg.goto(f'{HOST}/staff5.html?demo=1&as=NT#{r}'), pg.wait_for_timeout(3000))
    go_nt('/inbox'); check('Nate: Kevin\'s draft waits for his approval after the switch', sent and re.search(rf'{sent}[\s\S]{{0,300}}approval|approval[\s\S]{{0,300}}{sent}', main_text(pg)), '')
    go_nt(f'/bill/{sent}'); check('Nate: Kevin\'s to-do is on the bill', 'Two-person check' in main_text(pg), '')
    menu('Start the practice over'); pg.wait_for_timeout(3000)
    go_nt(f'/bill/{sent}'); check('Start over: the practice day is back as it began', 'Two-person check' not in main_text(pg), '')
    check('Two people in one tab: no page errors', not pg.errs, pg.errs[:1])
    b.close()
  bad = [r for r in results if not r[1]]
  print(f'{len(results) - len(bad)} of {len(results)} targets met')
  if bad:   # most reds here have been a screen's words changed on purpose, with the old words still expected (R-278)
    print(f'If a screen\'s words changed on purpose, update the words the FAIL line looks for in {os.path.relpath(__file__)}'
          ' (search for its name), in the same commit as the change.')
  sys.exit(1 if bad else 0)

if __name__ == '__main__':
  main()
