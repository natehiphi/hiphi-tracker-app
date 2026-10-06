# A saved testimony letter is offered once on Home (R-189, A-14 say it once, A-3 one main button; R-187 did version A).
# In the practice copy, a returning follower (Kai, as compare.html and tests/layout.py set him up), phone and laptop:
#   1. a letter saved for the hearing on one of Home's full cards: no "Finish your testimony" card; that card's main button
#      is the one "Finish sending your testimony" on the page (today's Home, by topic, and version A's Now card)
#   2. a letter saved for a hearing with no full card on Home: the "Finish your testimony" card still names it, with its
#      own "Finish sending it"
#   python3 -m http.server 8832   (in this folder, once)
#   python3 tests/draft_once.py [base]     base defaults to http://localhost:8832
import sys, os
from playwright.sync_api import sync_playwright
BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832').rstrip('/')
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'tests', 'out'); os.makedirs(OUT, exist_ok=True)
res = []
def ok(c, m): res.append(bool(c)); print('PASS' if c else 'FAIL', m)
def ready(pg): pg.wait_for_function("() => !!document.querySelector('main') && !document.querySelector('.skelpage')", timeout=60000); pg.wait_for_timeout(900)
KAI = """() => { try { const set = (k, v) => localStorage.setItem(k + '_demo', typeof v === 'string' ? v : JSON.stringify(v));
  if (localStorage.getItem('hiphi_wiz_demo')) return;
  set('hiphi_issue_follows', ['66a32660-b0a7-4a90-a71f-231963619b44', '1dcec7ca-ed94-4a19-9c9c-235514ca7491', '2616613e-a363-418b-ae19-4add60957cd8']);
  set('hiphi_watch_ids', []); set('hiphi_cat_follows', []); set('hiphi_skips', []); set('hiphi_wiz', { done: true, issues: ['tobacco', 'food', 'around'], name: 'Kai' });
  set('hiphi_onb', { lastVisit: new Date(Date.parse('2026-03-15T19:00:00-10:00')).toISOString() }); set('hiphi_done', []); set('hiphi_done_at', {}); set('hiphi_stances', {});
  set('hiphi_demo_seeded', '0'); localStorage.setItem('hiphi_tour_bill_demo', '{"how":"test"}'); localStorage.setItem('hiphi_tour_home_demo', '{"how":"test"}'); } catch {} }"""
# the sandbox reads and writes hiphi_me as hiphi_me_demo (the shim in kernel.js), so these work on its pages
SAVE = "hid => { const m = JSON.parse(localStorage.getItem('hiphi_me') || '{}'); m.drafts = { [hid]: { body: 'Aloha', at: new Date().toISOString() } }; localStorage.setItem('hiphi_me', JSON.stringify(m)); }"
CLEAR = "() => { const m = JSON.parse(localStorage.getItem('hiphi_me') || '{}'); delete m.drafts; localStorage.setItem('hiphi_me', JSON.stringify(m)); }"
COUNT = """() => { const t = document.querySelector('#main').innerText, n = re => (t.match(re) || []).length;
  return { draft: document.querySelectorAll('#main .hm-draft').length, finish: n(/Finish sending your testimony/g), it: n(/Finish sending it/g) }; }"""
# a hearing on one of the follower's bills, still ahead, that no card on the page offers (one line further down, or none)
UNDRAWN = """async () => { const c = await import('./pub/core.js'), on = new Set([...document.querySelectorAll('#main [data-helper]')].map(e => e.dataset.helper));
  const x = c.openActions(c.S.bills, c.S.hearings).find(x => !on.has(x.h.id) && new Date(x.h.scheduled_at) > Date.now());
  return x ? { id: x.h.id, name: c.nick(x.b) || c.spaced(x.b.bill_number) } : null; }"""
# today's Home's full cards, version A's Now card
FULL = { 'today': '#main .hm-now .acard [data-helper]', 'by-issue': '#main .hm-byissue .acard [data-helper]', 'a': '#main .a-now [data-helper]' }

with sync_playwright() as p:
    br = p.chromium.launch()
    for mobile in (True, False):
        size = 'phone' if mobile else 'laptop'
        for arm in ('today', 'by-issue', 'a'):
            if arm == 'by-issue' and not mobile: continue
            ab = 'layout.a' if arm == 'a' else 'layout.today,home.by-issue' if arm == 'by-issue' else 'layout.today'
            ctx = br.new_context(viewport={'width': 390, 'height': 844} if mobile else {'width': 1280, 'height': 800}, is_mobile=mobile, has_touch=mobile)
            ctx.add_init_script(f"({KAI})()")
            pg = ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
            pg.goto(f'{BASE}/track.html?demo=1&ab={ab}#/'); ready(pg)
            full = pg.eval_on_selector_all(FULL[arm], 'bs => bs.map(b => b.dataset.helper)')
            ok(len(full) >= (1 if arm == 'a' else 2), f'{size} {arm}: Home draws its full cards ({len(full)})')
            # 1. a letter saved for a full card's hearing: the first card, and on today's Home the second too
            for k, hid in enumerate(full[:1] if arm == 'a' else full[:2]):
                pg.evaluate(SAVE, hid); pg.reload(); ready(pg)
                c = pg.evaluate(COUNT)
                btn = pg.locator(f'#main [data-helper="{hid}"]').first.inner_text().strip()
                ok(c['draft'] == 0 and c['it'] == 0, f'{size} {arm}: a letter saved on card {k + 1}: no “Finish your testimony” card ({c})')
                ok(c['finish'] == 1 and btn == 'Finish sending your testimony', f'{size} {arm}: card {k + 1}’s main button is the one “Finish sending your testimony” ({btn!r})')
                if k == 0: pg.screenshot(path=os.path.join(OUT, f'draft_once_{arm}_card_{size}.png'))
                pg.evaluate(CLEAR)
            # 2. a letter saved for a hearing with no full card: the letter's own card stays
            pg.reload(); ready(pg)
            u = pg.evaluate(UNDRAWN)
            ok(u is not None, f'{size} {arm}: there is a hearing on Home with no full card ({u})')
            if u:
                pg.evaluate(SAVE, u['id']); pg.reload(); ready(pg)
                c = pg.evaluate(COUNT)
                card = pg.locator('#main .hm-draft')
                ok(c['draft'] == 1 and u['name'] in card.inner_text() and card.locator(f'[data-helper="{u["id"]}"]').count() == 1, f'{size} {arm}: the “Finish your testimony” card names {u["name"]} with its own button ({c})')
                ok(c['finish'] == 0 and c['it'] == 1, f'{size} {arm}: and nothing else offers to finish it ({c})')
                pg.screenshot(path=os.path.join(OUT, f'draft_once_{arm}_nocard_{size}.png'))
                pg.evaluate(CLEAR)
            ok(pg.evaluate("document.documentElement.scrollWidth <= window.innerWidth + 1"), f'{size} {arm}: no sideways scroll')
            ok(not errs, f'{size} {arm}: no page errors {errs[:2]}'); ctx.close()
    br.close()
print(f'{sum(res)}/{len(res)} passed'); sys.exit(0 if all(res) else 1)
