# R-056: after the committees the public bill page offers a real step, not only Share. Sandbox, phone and desktop.
# The sandbox is frozen at 16 March, so real sandbox bills HIPHI supports or opposes are put at each stage in the test
# page's memory only (nothing is saved), with the Capitol's own conference wording.
import sys, re
from urllib.parse import unquote
from playwright.sync_api import sync_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832/track.html?demo=1&seed=1'
ok = fail = 0
def check(c, m):
    global ok, fail
    print('PASS' if c else 'FAIL', m); ok += bool(c); fail += (not c)
SETUP = """async ({ stage, pos, acts, dist }) => {
  const c = await import('./pub/core.js');
  window.__used ??= new Set();   // (the same bill can come back at a new stage: each case sets the stage it tests)
  const b = c.D.bills.find(x => x.hiphi_position === pos && !window.__used.has(x.id) && !['dead', 'enacted', 'vetoed'].includes(x.stage)
    && !c.D.hearings.some(h => h.bill_id === x.id && new Date(h.scheduled_at) > new Date('2026-03-01')));   // past its committees: no hearing ahead window.__used.add(b.id);
  b.stage = stage; b.last_action = 'Test'; if (stage === 'conference') b.second_stops = b.second_stops || [];
  c.D.activity = c.D.activity.filter(a => a.bill_id !== b.id).concat(acts.map((t, k) => ({ bill_id: b.id, title: t, occurred_at: `2026-03-1${k}T08:00:00-10:00`, source: 'auto' })));
  if (c.S.activity) c.S.activity = c.S.activity.filter(a => a.bill_id !== b.id).concat(c.D.activity.filter(a => a.bill_id === b.id));
  if (c.S.xa) delete c.S.xa[b.id];
  const inS = (c.S.bills || []).find(x => x.id === b.id); if (inS) { inS.stage = stage; }
  for (const k of Object.keys(c.S.extra || {})) if (c.S.extra[k].id === b.id) c.S.extra[k].stage = stage;
  if (dist) localStorage.setItem('hiphi_districts', JSON.stringify(dist)); else localStorage.removeItem('hiphi_districts');
  return b.bill_number; }"""
def open_bill(pg, stage, pos, acts=(), dist=None):
    num = pg.evaluate(SETUP, {'stage': stage, 'pos': pos, 'acts': list(acts), 'dist': dist})
    pg.evaluate(f"location.hash = '#/find'"); pg.wait_for_timeout(300)
    pg.evaluate(f"location.hash = '#/bill/{num}'"); pg.wait_for_timeout(1800)
    return num
def main_btn(pg):
    el = pg.locator('.actionbar [data-bl-main], .bl-side [data-bl-main], .actionbar a.btn.primary, .bl-side .bl-do a.btn.primary').first
    return (el.inner_text().strip(), el.get_attribute('href') or '') if el.count() else ('', '')
CONF = ['House Conferees Appointed: Belatti, Garrett, Morikawa Co-Chairs; Iwamoto, Souza.', 'Senate Conferees Appointed: Fukunaga Chair; Kim, Lee, C. Co-Chairs.']
with sync_playwright() as p:
    br = p.chromium.launch()
    for w, h, mob in [(390, 844, True), (1280, 800, False)]:
        ctx = br.new_context(viewport={'width': w, 'height': h}, is_mobile=mob, has_touch=mob); pg = ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(BASE + '#/'); pg.reload(); pg.wait_for_timeout(3000)
        # the parser, on the Capitol's own wording
        names = pg.evaluate("""async () => { const c = await import('./pub/core.js'), m = await import('./pub/bill.js');
          const saved = c.S.activity; c.S.activity = [%s].map((t, k) => ({ bill_id: 'x', title: t, occurred_at: '2026-04-1' + k }));
          const r = m.conferees({ id: 'x' }).map(o => [o.l.chamber, o.l.name, o.chair]); c.S.activity = saved; return r; }""" % ','.join(repr(t) for t in CONF))
        chairs = [n for ch, n, c in names if c]
        check(len(chairs) == 6 and 'Chris Lee' in chairs and 'Donna Mercado Kim' in chairs, f'{w}: the conference chairs are read from the notice, the right Lee among them ({chairs})')
        check(any(n[1].startswith('Kim Coco Iwamoto') or 'Iwamoto' in n[1] for n in names if not n[2]), f'{w}: members too ({[n[1] for n in names if not n[2]]})')
        # conference, HIPHI supports: email the conference chairs
        num = open_bill(pg, 'conference', 'support', CONF)
        label, href = main_btn(pg)
        check(label == 'Email the conference chairs' and href.startswith('mailto:') and href.count('@') >= 6, f'{w} {num}: conference offers the chairs ("{label}", {href.count("@")} addresses)')
        body = unquote(href)
        check('Dear Chair ' in body and 'working out one version in conference' in body and 'agree on one version and pass it' in body, f'{w}: the email greets the chairs and asks them to pass it')
        check('conference chairs' in pg.inner_text('main').lower() or 'Write to the conference chairs' in pg.inner_text('body'), f'{w}: the page says why')
        pg.screenshot(path=f'tests/out/stages_{w}_conference.png')
        # conference, no appointment yet, no districts: find your legislators
        num = open_bill(pg, 'conference', 'support', [])
        label, href = main_btn(pg)
        check(label == 'Find your legislators', f'{w} {num}: no chairs named and no districts: find your legislators first ("{label}")')
        # conference, no appointment, districts known: your own two legislators
        num = open_bill(pg, 'conference', 'support', [], {'senate': 13, 'house': 26})
        label, href = main_btn(pg)
        check(label == 'Email your legislators' and href.count('@') == 2 and 'Senator ' in unquote(href) and 'Representative ' in unquote(href), f'{w} {num}: then your own senator and representative ("{label}")')
        # the floor vote in the second chamber: your own legislator there, by name
        num = open_bill(pg, 'second_crossover', 'support', [], {'senate': 13, 'house': 26})
        label, href = main_btn(pg)
        check(re.match(r'^Ask (Sen|Rep)\. [A-Za-z\u02bb\u2018 -]+ to vote yes$', label) is not None and href.count('@') == 1, f'{w} {num}: the floor vote asks your own legislator ("{label}")')
        check('please vote yes' in unquote(href).lower() and re.search(r'Dear (Senator|Representative) ', unquote(href)) is not None, f'{w}: the email greets them as your senator or representative and asks for a yes')
        pg.screenshot(path=f'tests/out/stages_{w}_floor.png')
        num = open_bill(pg, 'second_crossover', 'oppose', [], None)
        label, href = main_btn(pg)
        check(label == 'Find your legislators', f'{w} {num}: no districts yet: find your legislators first ("{label}")')
        check('Ask for a no vote' in pg.inner_text('body'), f'{w}: and it says the ask is a no vote, since HIPHI opposes it')
        # the Governor, HIPHI supports, with a veto notice
        num = open_bill(pg, 'governor', 'support', ['Notice of intent to veto (Gov. Msg. No. 1264)'])
        label, href = main_btn(pg)
        check(label == 'Ask the Governor to sign it' and href == 'https://governor.hawaii.gov/comments-on-legislation/', f'{w} {num}: the Governor ("{label}")')
        check('The Governor may veto it' in pg.inner_text('body'), f'{w}: a veto notice is said plainly')
        pg.screenshot(path=f'tests/out/stages_{w}_governor.png')
        # the Governor, HIPHI opposes
        num = open_bill(pg, 'governor', 'oppose', [])
        label, href = main_btn(pg)
        check(label == 'Ask the Governor to veto it', f'{w} {num}: opposed: ask for a veto ("{label}")')
        # pressing it asks whether it went; "Yes" means it is not offered again at this stage
        pg.evaluate("document.querySelector('[data-bl-main=governor]')?.addEventListener('click', e => e.preventDefault(), { capture: true })")
        pg.locator('[data-bl-main=governor]').first.click(); pg.wait_for_timeout(1300)
        check(pg.locator('[data-bl-sent=yes]').count() >= 1 and 'Did you send your message?' in pg.inner_text('body'), f'{w}: then "Did you send your message?"')
        pg.locator('[data-bl-sent=yes]').first.click(); pg.wait_for_timeout(900)
        label, href = main_btn(pg)
        check(label != 'Ask the Governor to veto it', f'{w}: once sent, not offered again ("{label}")')
        # a monitored bill at the Governor: no ask (nothing to say for HIPHI)
        num = open_bill(pg, 'governor', 'monitor', [])
        label, href = main_btn(pg)
        check('Governor' not in label, f'{w} {num}: a bill HIPHI only monitors gets no ask ("{label}")')
        check(not errs, f'{w}: no page errors ' + '; '.join(errs))
        ctx.close()
    br.close()
print(f'\n{ok} passed, {fail} failed')
