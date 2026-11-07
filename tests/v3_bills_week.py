# R-362 part 4: version 3's Find as bills by issue (pub/v3/bills.js, the #/find route) and This week (pub/v3/week.js, the #/bills tab),
# behind ?v3=1 on the practice copy (16 Mar 2026). DESIGN B-3, B-6, A-3, A-14, B-13, C-15.
#   Find: the box, the topic chips (aria-pressed; one chosen filters the issues), Needs voices this week (at most five), Lists from HIPHI
#     (each to #/list/...), one closed row per issue with a quiet Follow and "N bills", a tap opens it to at most 4 bills + "Show N more"
#     in place (kept over a reload), a topic chip or a search opens the issues it leaves, under about 8 phone screens with All topics, the foot rows to
#     Every bill HIPHI tracks, Committees and For advocacy groups; no filled button; "hb2121" and "vape" both find their bills; Back
#     from a bill finds the topic and the place it was scrolled to.
#   This week: the tab reads "This week" and is lit; the one thing's card is the one filled button; Your issues; the hearings by day,
#     ten rows then "Show N more hearings", the one thing's own hearing never hidden; a newcomer is told what the page is for with
#     "Pick your issues".
#   Both: a Follow pressed on Find shows on This week and survives a reload; no "dead" and no "vape" in the words; no sideways
#     scroll at 390x844 and 1440x900; no page errors.
# usage: python3 tests/v3_bills_week.py [BASE]   (BASE defaults to http://localhost:8832); SHOTS=<dir> saves both screens at both sizes
import os, re, sys
from playwright.sync_api import sync_playwright

BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832').split('/track.html')[0].rstrip('/')
SHOTS = os.environ.get('SHOTS') or ''
if SHOTS: os.makedirs(SHOTS, exist_ok=True)
URL = BASE + '/track.html?demo=1&v3=1'
HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src = open(os.path.join(HERE, 'compare.html')).read()
WHO = src[src.index('const WHO = {'):src.index('const pick =')]
fails = 0
def ok(cond, what):
  global fails
  print(('PASS ' if cond else 'FAIL ') + what)
  if not cond: fails += 1

def init(who):
  return f"""(() => {{ {WHO}
  if (sessionStorage.getItem('__set')) return; sessionStorage.setItem('__set', '1');
  for (const k of Object.keys(localStorage)) if (k.startsWith('hiphi_')) localStorage.removeItem(k);
  const at = Date.parse('2026-03-16T09:00:00-10:00'), set = (k, v) => localStorage.setItem(k + '_demo', typeof v === 'string' ? v : JSON.stringify(v));
  localStorage.setItem('hiphi_tour_home_demo', '{{"how":"test"}}'); localStorage.setItem('hiphi_tour_bill_demo', '{{"how":"test"}}');
  if ('{who}' === 'none') {{ set('hiphi_wiz', {{ done: true, issues: [] }}); set('hiphi_onb', {{ lastVisit: new Date(at - 14 * 36e5).toISOString() }}); return; }}
  const p = WHO['{who}'];
  set('hiphi_issue_follows', p.issues); set('hiphi_watch_ids', []); set('hiphi_cat_follows', []); set('hiphi_skips', []);
  set('hiphi_wiz', {{ done: true, issues: p.cats, name: p.name }});
  set('hiphi_onb', {{ lastVisit: new Date(at - 14 * 36e5).toISOString() }});
  set('hiphi_done', Object.keys(p.done)); set('hiphi_done_at', p.done); set('hiphi_stances', {{}}); set('hiphi_demo_seeded', '0');
}})();"""

WIDE = "document.documentElement.scrollWidth > innerWidth + 1"
MAIN = "(document.querySelector('#main') || document.body).innerText"
BAD = re.compile(r'\b(dead|died|vape|vapes|vaping)\b', re.I)
# The kinds of control in the first screenful (buttons, links, inputs), for the report.
FIRST = """() => { const h = innerHeight, els = [...document.querySelectorAll('#main a[href], #main button, #main input')].filter(e => { const r = e.getBoundingClientRect(); return r.width && r.height && r.top < h && r.bottom > 0 && !e.closest('[hidden]'); });
  return els.length; }"""

def find(pg, route='#/find'):
  pg.goto(URL + route); pg.wait_for_selector('.v3b #v3b-res .v3b-isec', timeout=60000); pg.wait_for_timeout(500)
def week(pg):
  pg.goto(URL + '#/bills'); pg.wait_for_selector('.v3w #v3w-hear-h', timeout=60000); pg.wait_for_timeout(500)
def search(pg, q):
  pg.fill('#q', q); pg.press('#q', 'Enter')
  pg.wait_for_function("q => !document.querySelector('.fd-box.busy') && decodeURIComponent(location.hash).includes(q) && !document.querySelector('#v3b-res .skelpage')", arg=q, timeout=30000)
  pg.wait_for_timeout(300)

with sync_playwright() as p:
  br = p.chromium.launch()
  for w, h, tag in [(390, 844, 'phone'), (1440, 900, 'laptop')]:
    # ---------------- Kai (3 issues) ----------------
    ctx = br.new_context(viewport={'width': w, 'height': h}); ctx.add_init_script(init('kai'))
    pg = ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    find(pg); t = f'{tag} Kai Find'
    if SHOTS: pg.screenshot(path=f'{SHOTS}/find_{tag}.png'); pg.screenshot(path=f'{SHOTS}/find_{tag}_full.png', full_page=True)
    ok(pg.evaluate("document.body.dataset.screen") == 'find' and pg.evaluate("!!document.querySelector('.v3b #q')"), f'{t}: pub/v3/bills.js draws Find with the search box')
    chips = pg.evaluate("[...document.querySelectorAll('.v3b-chips [data-v3topic]')].map(c => [c.dataset.v3topic, c.getAttribute('aria-pressed')])")
    ok(len(chips) >= 7 and chips[0] == ['', 'true'], f'{t}: All topics and the six topics as chips, All pressed ({len(chips)})')
    nv = pg.evaluate("document.querySelectorAll('#v3b-voices-h ~ .rc-rows > li').length")
    ok(0 < nv <= 5, f'{t}: Needs voices this week, at most five ({nv})')
    ls = pg.evaluate("[...document.querySelectorAll('.rc-lists .rc-row')].map(a => a.getAttribute('href'))")
    ok(len(ls) >= 2 and all(x.startswith('#/list/') for x in ls), f'{t}: Lists from HIPHI reachable, each to its page {ls}')
    ok(pg.evaluate("['#/allbills', '#/committees', '#/groups'].every(h => document.querySelector(`.v3b-foot a[href=\"${h}\"]`))"), f'{t}: the foot: Every bill HIPHI tracks, Committees, For advocacy groups')
    secs = pg.evaluate("[...document.querySelectorAll('.v3b-isec')].map(s => [s.querySelectorAll('.rc-rows > li').length, s.querySelector('[data-v3open]').getAttribute('aria-expanded'), s.querySelectorAll('[data-v3follow]').length, /^\\d+ bills?( · \\d+ needs? voices this week)?$/.test(s.querySelector('.v3b-icount').innerText)])")
    ok(len(secs) >= 10 and all(n == 0 and e == 'false' and f == 1 and c for n, e, f, c in secs), f'{t}: {len(secs)} issues, each closed with one Follow and "N bills" (none open)')
    ok(pg.evaluate("!document.querySelector('#main .btn.primary')"), f'{t}: no filled button (A-3: browsing)')
    words = pg.evaluate(MAIN); ok(not BAD.search(words), f'{t}: no "dead" or "vape" in the words (C-15, R-158)')
    ok(not pg.evaluate(WIDE), f'{t}: no sideways scroll')
    H = pg.evaluate("document.documentElement.scrollHeight")
    if tag == 'phone': ok(H < 8.5 * h, f'{t}: All topics fits in about 8 phone screens ({H}px, {H / h:.1f} screens)')
    print(f'INFO {t}: {pg.evaluate(FIRST)} controls in the first screenful; page {H}px')
    # a tap of an issue's row opens its bills (four, then Show N more), and the opened issue is kept over a reload
    k = pg.evaluate("[...document.querySelectorAll('.v3b-isec')].find(s => +s.querySelector('.v3b-icount').innerText.split(' ')[0] > 5)?.querySelector('[data-v3open]').dataset.v3open")
    pg.click(f'[data-v3open="{k}"]'); pg.wait_for_timeout(200)
    ok(pg.evaluate(f"document.querySelector('[data-v3open=\"{k}\"]').getAttribute('aria-expanded')") == 'true' and pg.evaluate(f"document.querySelectorAll('#v3b-rows-{k} > li').length") == 4
       and pg.evaluate(f"!!document.querySelector('[data-v3more=\"{k}\"]')") and pg.evaluate("document.querySelectorAll('.v3b-isec.open').length") == 1, f'{t}: a tap opens that issue alone, four bills and Show N more')
    pg.reload(); pg.wait_for_selector('.v3b #v3b-res .v3b-isec', timeout=30000); pg.wait_for_timeout(400)
    ok(pg.evaluate(f"document.querySelector('[data-v3open=\"{k}\"]').getAttribute('aria-expanded')") == 'true', f'{t}: the opened issue is still open after a reload (B-6)')
    # Show N more opens in place and is remembered
    n0 = pg.evaluate(f"document.querySelectorAll('#v3b-rows-{k} > li').length")
    pg.click(f'[data-v3more="{k}"]'); pg.wait_for_timeout(200)
    ok(pg.evaluate(f"document.querySelectorAll('#v3b-rows-{k} > li').length") > n0 and pg.evaluate("location.hash") == '#/find', f'{t}: Show N more opens the rest in place')
    pg.click(f'[data-v3open="{k}"]'); pg.wait_for_timeout(200)
    ok(pg.evaluate("document.querySelectorAll('.v3b-isec.open').length") == 0, f'{t}: a second tap closes it')
    # a topic chip filters
    allsec = len(secs)
    pg.click('[data-v3topic="tobacco"]'); pg.wait_for_timeout(300)
    names = pg.evaluate("[...document.querySelectorAll('.v3b-isec .v3b-in')].map(e => e.innerText)")
    ok(pg.evaluate("document.querySelector('[data-v3topic=tobacco]').getAttribute('aria-pressed')") == 'true' and 0 < len(names) < allsec
       and not any(re.search(r'school meal', n, re.I) for n in names), f'{t}: the Tobacco chip leaves its issues only ({len(names)} of {allsec}: {names[:3]})')
    ok(pg.evaluate("[...document.querySelectorAll('.v3b-isec')].every(s => s.classList.contains('open') && s.querySelector('.rc-rows > li'))"), f'{t}: and opens every one of them')
    # Back from a bill finds the topic and the place
    pg.evaluate("window.scrollTo(0, Math.min(900, document.documentElement.scrollHeight - innerHeight))"); pg.wait_for_timeout(400)
    y0 = pg.evaluate("scrollY")
    a = pg.evaluate("(() => { const a = [...document.querySelectorAll('.v3b-isec .rc-row')].find(a => { const r = a.getBoundingClientRect(); return r.top > 80 && r.bottom < innerHeight - 90; }); a?.setAttribute('data-t', '1'); return a?.getAttribute('href'); })()")
    pg.click('[data-t="1"]'); pg.wait_for_function("document.body.dataset.screen === 'bill'", timeout=30000); pg.wait_for_timeout(800)
    pg.go_back(); pg.wait_for_selector('.v3b #v3b-res .rc-row', timeout=30000); pg.wait_for_timeout(900)
    y1 = pg.evaluate("scrollY")
    ok(pg.evaluate("document.querySelector('[data-v3topic=tobacco]')?.getAttribute('aria-pressed')") == 'true' and abs(y1 - y0) < 40, f'{t}: Back from {a} finds Tobacco chosen and the place ({y0} -> {y1})')
    pg.reload(); pg.wait_for_selector('.v3b #v3b-res .rc-row', timeout=30000); pg.wait_for_timeout(500)
    ok(pg.evaluate("document.querySelector('[data-v3topic=tobacco]')?.getAttribute('aria-pressed')") == 'true', f'{t}: a reload keeps the topic (B-6)')
    pg.click('[data-v3topic=""]'); pg.wait_for_timeout(200)
    # search
    search(pg, 'hb2121')
    ok(pg.evaluate("[...document.querySelectorAll('#v3b-res .rc-row')].some(a => /HB 2121\\b/.test(a.innerText))"), f'{tag} search "hb2121": finds HB 2121')
    ok(pg.evaluate("document.querySelectorAll('.v3b-isec').length > 0 && [...document.querySelectorAll('.v3b-isec')].every(s => s.classList.contains('open') && s.querySelector('.rc-rows > li'))"), f'{tag} search "hb2121": the matching issues open')
    ok(pg.evaluate("[...document.querySelectorAll('.v3b-isec')].length > 0 && [...document.querySelectorAll('.v3b-isec')].every(s => s.classList.contains('open'))"), f'{tag} search "hb2121": the matching issues open')
    search(pg, 'vape')
    hits = pg.evaluate("[...document.querySelectorAll('#v3b-res .rc-row')].map(a => a.innerText)")
    ok(any(re.search(r'e-cigarette|nicotine|tobacco|smok', x, re.I) for x in hits), f'{tag} search "vape": finds the e-cigarette bills ({len(hits)} rows)')
    ok(not BAD.search(pg.evaluate("document.getElementById('v3b-res').innerText")), f'{tag} search "vape": HIPHI\'s words say e-cigarettes')
    ok(not pg.evaluate(WIDE), f'{tag} search: no sideways scroll')
    pg.click('.fd-clear'); pg.wait_for_timeout(500)
    # ---- This week ----
    week(pg); t = f'{tag} Kai This week'
    if SHOTS: pg.screenshot(path=f'{SHOTS}/week_{tag}.png'); pg.screenshot(path=f'{SHOTS}/week_{tag}_full.png', full_page=True)
    tab = pg.evaluate("[...document.querySelectorAll('nav[aria-label=Main] a[href=\"#/bills\"]')].filter(a => a.offsetParent).map(a => [a.innerText.trim(), a.getAttribute('aria-current')])")
    ok(len(tab) >= 1 and all(x == ['This week', 'page'] for x in tab), f'{t}: pub/v3/week.js; the tab reads This week and is lit {tab}')
    ok(pg.evaluate("document.querySelectorAll('#main .btn.primary').length") == 1 and pg.evaluate("!!document.querySelector('.v3w-one .v3-card [data-v3go]')"), f'{t}: the one thing card is the one filled button')
    ok(pg.evaluate("document.querySelectorAll('#v3w-iss-h ~ .rc-rows > li').length") >= 2 and pg.evaluate("!!document.querySelector('.v3w-change a[href=\"#/find\"]')"), f'{t}: Your issues, then Change my issues to Find')
    ok(not pg.evaluate("[...document.querySelectorAll('#v3w-iss-h ~ .rc-rows .rc-rstat')].some(e => e.textContent.replace(/\\s+/g, ' ').trim() === 'Your one thing, above')"), f'{t}: no Your issues row that only says "Your one thing, above"')
    vis = pg.evaluate("[...document.querySelectorAll('#v3w-hear-h ~ .v3w-day li')].filter(li => li.offsetParent).length")
    hid = pg.evaluate("[...document.querySelectorAll('#v3w-hear-h ~ .v3w-day li')].filter(li => !li.offsetParent).length")
    one = pg.evaluate("(() => { const a = document.querySelector('.v3w [data-one]'); return a ? !!a.offsetParent : null; })()")
    ok(vis <= 11 and (one is None or one), f'{t}: ten hearing rows show ({vis}, {hid} behind Show more), the one thing\'s hearing not hidden ({one})')
    ok(pg.evaluate("[...document.querySelectorAll('.v3w-dayh')].every(e => /^(Mon|Tues|Wednes|Thurs|Fri)day, /.test(e.innerText))"), f'{t}: hearings by day, Monday to Friday')
    if hid:
      ok(pg.evaluate("document.querySelector('[data-v3wmore]').innerText.includes(String(%d))" % hid), f'{t}: "Show {hid} more hearings" says how many')
      pg.click('[data-v3wmore]'); pg.wait_for_timeout(200)
      ok(pg.evaluate("[...document.querySelectorAll('#v3w-hear-h ~ .v3w-day li')].every(li => li.offsetParent)"), f'{t}: Show more shows every hearing')
    ok(not BAD.search(pg.evaluate(MAIN)), f'{t}: no "dead" or "vape" in the words')
    ok(not pg.evaluate(WIDE), f'{t}: no sideways scroll')
    print(f'INFO {t}: {pg.evaluate(FIRST)} controls in the first screenful; page {pg.evaluate("document.documentElement.scrollHeight")}px')
    ok(not errs, f'{tag} Kai: no page errors {errs[:2]}')
    ctx.close()

    # ---------------- a newcomer: This week says what it is for; a Follow on Find shows there and survives a reload ----------------
    ctx = br.new_context(viewport={'width': w, 'height': h}); ctx.add_init_script(init('none'))
    pg = ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    week(pg); t = f'{tag} newcomer This week'
    ok(pg.evaluate("!!document.querySelector('.v3w-empty a[href=\"#/find\"]') && /Pick your issues/.test(document.querySelector('.v3w-empty').innerText) && /what happens at the Capitol/.test(document.querySelector('.v3w-empty').innerText)"),
       f'{t}: what the page is for, with Pick your issues (B-3)')
    find(pg); name = pg.evaluate("document.querySelector('.v3b-isec .v3b-in').innerText.trim()")
    pg.click('.v3b-isec [data-v3follow]'); pg.wait_for_function("document.querySelector('.v3b-isec [data-v3follow]').getAttribute('aria-pressed') === 'true'", timeout=15000)
    ok(True, f'{tag} newcomer Find: Follow on "{name}" turns to Following')
    week(pg)
    ok(name in pg.evaluate("[...document.querySelectorAll('#v3w-iss-h ~ .rc-rows .rc-rname')].map(e => e.innerText).join('|')"), f'{tag} newcomer: "{name}" is on This week')
    pg.reload(); pg.wait_for_selector('.v3w #v3w-hear-h', timeout=60000); pg.wait_for_timeout(500)
    ok(name in pg.evaluate("[...document.querySelectorAll('#v3w-iss-h ~ .rc-rows .rc-rname')].map(e => e.innerText).join('|')"), f'{tag} newcomer: and still after a reload')
    find(pg)
    ok(pg.evaluate("document.querySelector('.v3b-isec [data-v3follow]').getAttribute('aria-pressed')") == 'true', f'{tag} newcomer Find: still Following after the reload')
    pg.click('.v3b-isec [data-v3follow]'); pg.wait_for_function("document.querySelector('.v3b-isec [data-v3follow]').getAttribute('aria-pressed') === 'false'", timeout=15000)
    ok(True, f'{tag} newcomer Find: pressing Following lets it go')
    ok(not errs, f'{tag} newcomer: no page errors {errs[:2]}')
    ctx.close()
  br.close()
print(f'\n{"ALL PASS" if not fails else f"{fails} FAILED"}')
sys.exit(1 if fails else 0)
