# R-046 rework (10/10, Nate's answer of 10/5), in the public sandbox: good news is a card at the top of Home, at most three
# on a laptop and one on a phone (three would push today's actions past A-1), each dismissed on its own with "Got it". The
# next waiting card takes its place, "N more good news" opens the session page, a dismissed card stays gone after a reload,
# and a law keeps its full-screen moment, once.
#   python3 tests/moments_cards.py [root] [shots]   root defaults to http://localhost:8832/ (the sandbox, ?demo=1&seed=1)
import sys, os, re
from playwright.sync_api import sync_playwright
ROOT = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832/'
SHOTS = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out')
os.makedirs(SHOTS, exist_ok=True)
res = []
def ok(c, m): res.append(bool(c)); print('PASS' if c else 'FAIL', m)
def ready(pg):
    pg.wait_for_function("() => !!document.querySelector('main') && !document.querySelector('.skelpage')", timeout=60000); pg.wait_for_timeout(700)
# the first visit is done before any page loads (as moments.py)
SKIP = "() => { try { const w = JSON.parse(localStorage.getItem('hiphi_wiz') || '{}'); localStorage.setItem('hiphi_wiz', JSON.stringify({ ...w, done: true, step: 99 })); localStorage.setItem('hiphi_tour_bill', '{\"how\":\"test\"}'); localStorage.setItem('hiphi_tour_home', '{\"how\":\"test\"}'); } catch {} }"
FOLLOW = "async () => { const c = await import('./pub/core.js'); for (const a of c.myActions()) c.S.direct.add(a.bill_id); c.recomputeWatch(); c.saveLocal(); }"
# Six more hearings the committee passed in the last 25 days (good news is 30 days back), on bills HIPHI supports, with
# testimony marked as a real send would: enough to go past three cards. Only what the person did is shown (as the seed does).
MORE = """async () => { const c = await import('./pub/core.js'), k = await import('./pub/kernel.js'), now = Date.now();
  const recent = o => +new Date(o.reported_at || '') > now - 25 * 864e5;
  const passed = new Set(c.D.outcomes.filter(o => /passed/.test(o.outcome || '') && recent(o)).map(o => o.hearing_id)); let n = 0;
  for (const h of c.D.hearings) { if (n >= 6) break; if (!passed.has(h.id) || new Date(h.scheduled_at) > now) continue;
    const b = c.D.bills.find(x => x.id === h.bill_id); if (!b || !/support/.test(b.hiphi_position || '') || b.stage === 'enacted') continue;
    const key = k.doneKey(h.bill_id, h.id, 'testimony'); if (c.S.done.has(key)) continue;
    c.S.done.add(key); c.S.doneAt[key] = new Date(new Date(h.scheduled_at).getTime() - 864e5).toISOString(); n++; }
  k.saveDone(); k.saveDoneAt(); c.recomputeWatch(); c.saveLocal(); return n; }"""
# What Home should count: every good news result from the last 30 days, not dismissed (the same rule as goodNews()).
TOTAL = """async () => { const c = await import('./pub/core.js'), gone = JSON.parse(localStorage.getItem('hiphi_moments_seen') || '[]'), month = Date.now() - 30 * 864e5;
  return c.results().filter(r => r.at && +new Date(r.at) > month && !gone.includes(r.key)).length; }"""
# A law on one of the bills they acted on (the sandbox has no law of its own): the full-screen moment, once.
LAW = """async () => { const c = await import('./pub/core.js'), acts = c.myActions();
  for (const a of acts) { const b = c.D.bills.find(x => x.id === a.bill_id); if (!b || !/support/.test(b.hiphi_position || '')) continue;
    for (const arr of [c.S.bills, c.D.bills, c.S.featured?.bills, c.S.pool?.bills, c.S.results, c.S.browse?.rows]) { const x = (arr || []).find(y => y.id === b.id); if (x) { x.stage = 'enacted'; x.last_action_date = new Date().toISOString().slice(0, 10); } }
    c.saveLocal(); return b.bill_number; } return null; }"""
# Counts the small bursts this page load plays (fx.js appends one .fx-burst to the body per burst).
BURSTS = """document.addEventListener('DOMContentLoaded', () => { window.__bursts = 0; new MutationObserver(ms => { for (const m of ms) for (const n of m.addedNodes) if (n.classList && n.classList.contains('fx-burst')) window.__bursts++; }).observe(document.body, { childList: true }); });"""
def bursts(pg):
    return pg.evaluate("window.__bursts || 0")
def count_reasons(pg):
    return len(pg.evaluate("[...document.querySelectorAll('main .acard .why, main .why')].map(e => e.innerText).filter(t => /, and .+ (passed it|put it on hold)|and it got one|became law/.test(t))"))
def card_keys(pg):
    return pg.evaluate("[...document.querySelectorAll('.hm-gn')].map(e => e.dataset.gnKey)")
# R-046 (10/10 fresh-eyes review): a bill that needs a hearing and has good news is one card, the good news its reason line;
# no bill is both a good news card and a "needs a hearing" card. Returns the bills that are both (should be none).
def gn_and_ask(pg):
    return pg.evaluate("""(() => { const g = new Set([...document.querySelectorAll('.hm-gn .hm-gnt')].map(a => a.getAttribute('href')));
      return [...document.querySelectorAll('.hm-ask')].map(c => c.querySelector('a[href^="#/bill/"]')?.getAttribute('href')).filter(h => h && g.has(h)); })()""")
def more_n(pg):
    m = pg.locator('.hm-gnmore')
    if not m.count(): return 0
    t = re.match(r'(\d+) more good news', m.first.inner_text().strip())
    return int(t.group(1)) if t else -1
def open_home(br, tag, w, h, extra_init='', reduced=False):
    kw = dict(viewport={'width': w, 'height': h}, is_mobile=w < 500, has_touch=w < 500)
    if reduced: kw['reduced_motion'] = 'reduce'
    ctx = br.new_context(**kw)
    ctx.add_init_script(f"({SKIP})()")
    ctx.add_init_script(BURSTS)
    if extra_init: ctx.add_init_script(extra_init)
    pg = ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(ROOT + 'track.html?demo=1&seed=1#/', wait_until='domcontentloaded'); ready(pg)
    pg.evaluate(FOLLOW); pg.reload(wait_until='domcontentloaded'); ready(pg)
    return ctx, pg, errs
with sync_playwright() as p:
    br = p.chromium.launch()
    # ---- laptop: more than three results, so three cards and the line beneath ----
    ctx, pg, errs = open_home(br, 'laptop', 1280, 800)
    seen0 = card_keys(pg)   # the seed's cards: already shown on the first visit, so they do not burst again
    ok(not gn_and_ask(pg), f'laptop, seed: no bill is both a good news card and a needs-a-hearing card: {gn_and_ask(pg)}')
    reason_txt = pg.evaluate("[...document.querySelectorAll('.hm-ask .hm-askgood')].map(e => e.innerText)")
    ok(len(reason_txt) >= 1 and all(re.search(r', and .+ (passed it|put it on hold)', t) for t in reason_txt), f'laptop, seed: the needs-a-hearing card with good news says it as its reason line: {reason_txt[:1]}')
    added = pg.evaluate(MORE); pg.reload(); ready(pg); pg.wait_for_timeout(400)
    total = pg.evaluate(TOTAL); reasons = count_reasons(pg); keys = card_keys(pg); nmore = more_n(pg)
    ok(not gn_and_ask(pg), f'laptop, with more results: no bill is both a good news card and a needs-a-hearing card: {gn_and_ask(pg)}')
    ok(len(keys) <= 3, f'laptop: at most three cards at once: {len(keys)}')
    ok(len(keys) == min(3, total - reasons), f'laptop: the cards fill to three while there are more ({len(keys)} of {total} results, {reasons} as reason lines, {added} added)')
    ok(nmore == total - reasons - len(keys), f'laptop: "N more good news" counts the rest: {nmore} (expected {total - reasons - len(keys)})')
    fresh = [k for k in keys if k not in seen0]
    ok(bursts(pg) == len(fresh), f'laptop: each card that first appears bursts once ({len(fresh)} new, {bursts(pg)} bursts)')
    link = pg.locator('.hm-gnmore')
    ok(link.count() == 1 and link.get_attribute('href') == '#/recap', 'laptop: the line under the cards opens the session page')
    ok(pg.locator('.hm-side .hm-gnsec').count() == 1 and pg.locator('.hm-main .hm-gnsec').count() == 0, 'laptop: the cards sit at the top of the right column, not above the first thing to do')
    first = pg.evaluate("(() => { const e = document.querySelector('#main .acard'); return e ? Math.round(e.getBoundingClientRect().top) : null })()")
    ok(first is not None and first <= 400, f'laptop: the first thing to do still starts within A-1\'s 400px: {first}px')
    pg.screenshot(path=f'{SHOTS}/R-046-cards-laptop-more.png')
    # dismiss the first card: it goes, the next waiting one takes its place, the line counts one fewer
    k1 = keys[0]; b0 = bursts(pg)
    pg.locator('.hm-gn').first.locator('[data-gn-got]').click()
    pg.wait_for_selector(f'[data-gn-key="{k1}"]', state='detached', timeout=4000)
    keys2 = card_keys(pg)
    ok(k1 not in keys2 and len(keys2) == min(3, total - reasons - 1), f'laptop: "Got it" removes only that card: {len(keys2)} left, the next one in its place')
    ok(more_n(pg) == nmore - 1 if nmore else more_n(pg) == 0, f'laptop: the line counts one fewer: {more_n(pg)}')
    ok(bursts(pg) == b0 + 1, f'laptop: the next card to appear bursts once ({bursts(pg) - b0})')
    focused = pg.evaluate("!!document.activeElement && (document.activeElement.matches('[data-gn-got]') || document.activeElement.id === 'main')")
    ok(focused, 'laptop: focus stays in the cards after "Got it" (not dropped to the top of the page)')
    stored = pg.evaluate("JSON.parse(localStorage.getItem('hiphi_moments_seen') || '[]')")
    ok(k1 in stored, 'laptop: the dismissed result is remembered (hiphi_moments_seen)')
    pg.reload(); ready(pg); pg.wait_for_timeout(400)
    ok(k1 not in card_keys(pg), 'laptop: a dismissed card stays gone after a reload')
    ok(bursts(pg) == 0, f'laptop: after a reload nothing bursts again ({bursts(pg)})')
    # dismiss every card: the block goes, and stays gone after a reload
    for _ in range(12):
        if not pg.locator('.hm-gn').count(): break
        pg.locator('.hm-gn').first.locator('[data-gn-got]').click(); pg.wait_for_timeout(400)
    ok(pg.locator('.hm-gn').count() == 0 and more_n(pg) == 0, 'laptop: dismissing all of them leaves no card and no line')
    pg.reload(); ready(pg); pg.wait_for_timeout(400)
    ok(pg.locator('.hm-gn').count() == 0 and pg.locator('.hm-gnsec').count() == 0, 'laptop: and they stay gone after a reload')
    ok(not errs, f'laptop: no page errors {errs[:2]}')
    ctx.close()
    # ---- phone: one card, its line beneath, compact ----
    ctx, pg, errs = open_home(br, 'phone', 390, 844)
    pg.evaluate(MORE); pg.reload(); ready(pg); pg.wait_for_timeout(400)
    total = pg.evaluate(TOTAL); reasons = count_reasons(pg); keys = card_keys(pg); nmore = more_n(pg)
    ok(not gn_and_ask(pg), f'phone: no bill is both a good news card and a needs-a-hearing card: {gn_and_ask(pg)}')
    ok(len(keys) == 1, f'phone: one card at a time ({len(keys)})')
    ok(nmore == total - reasons - 1, f'phone: the rest sit behind the line: {nmore} more good news')
    box = pg.locator('.hm-gn').first.bounding_box()
    ok(box and box['height'] <= 120, f'phone: the card is compact: {box and round(box["height"])}px tall at 390 (aim under 120)')
    arrival = pg.evaluate("(() => { const e = document.querySelector('.hm-now .acard, .acard'); return e ? Math.round(e.getBoundingClientRect().top) : null })()")
    ok(pg.locator('.hm-main .hm-gnsec').count() == 1, 'phone: the cards are in the one column, above the first thing to do')
    ok(arrival is not None and arrival <= 430, f'phone: today\'s first action still starts near where it did before the cards: {arrival}px (425 before; A-1 budget 400)')
    pg.screenshot(path=f'{SHOTS}/R-046-cards-phone-more.png')
    k1 = keys[0]
    b0 = bursts(pg)
    pg.locator('.hm-gn').first.locator('[data-gn-got]').click()
    pg.wait_for_selector(f'[data-gn-key="{k1}"]', state='detached', timeout=4000)
    keys2 = card_keys(pg)
    ok(bursts(pg) == b0 + 1, f'phone: the card that takes its place bursts once ({bursts(pg) - b0})')
    ok(len(keys2) == 1 and keys2[0] != k1, f'phone: dismissing the card brings the next one up ({keys2})')
    pg.reload(); ready(pg); pg.wait_for_timeout(400)
    ok(k1 not in card_keys(pg), 'phone: the dismissed card stays gone after a reload')
    ok(not errs, f'phone: no page errors {errs[:2]}')
    ctx.close()
    # ---- phone, reduced motion: the same, with no fade ----
    ctx, pg, errs = open_home(br, 'phone', 390, 844, reduced=True)
    keys = card_keys(pg)
    if keys:
        dur = pg.evaluate("getComputedStyle(document.querySelector('.hm-gn')).transitionDuration")
        ok(float(dur.rstrip('s') or 0) < 0.01, f'reduced motion: no fade on a card ({dur})')
        k1 = keys[0]; pg.locator('.hm-gn').first.locator('[data-gn-got]').click()
        pg.wait_for_selector(f'[data-gn-key="{k1}"]', state='detached', timeout=4000)
        ok(k1 not in card_keys(pg), 'reduced motion: "Got it" still removes the card')
    ok(not errs, f'reduced motion: no page errors {errs[:2]}')
    ctx.close()
    # ---- what three cards look like on a phone, for Nate's decision (a preview only: matchMedia reports a wide screen) ----
    WIDE = """(() => { const orig = window.matchMedia.bind(window); window.matchMedia = q => q === '(max-width: 719px)'
      ? { matches: false, media: q, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; } } : orig(q); })()"""
    ctx, pg, errs = open_home(br, 'phone', 390, 844, extra_init=WIDE)
    pg.evaluate(MORE); pg.reload(); ready(pg); pg.wait_for_timeout(400)
    arrival3 = pg.evaluate("(() => { const e = document.querySelector('.hm-now .acard, .acard'); return e ? Math.round(e.getBoundingClientRect().top) : null })()")
    ok(len(card_keys(pg)) == 3, f'preview: three cards when the phone rule is off ({len(card_keys(pg))})')
    print(f'INFO preview: with three stacked cards at 390, today\'s first action starts at {arrival3}px')
    pg.screenshot(path=f'{SHOTS}/R-046-cards-phone-three-preview.png')
    ctx.close()
    # ---- a law: its full-screen moment once. The stage is changed in this page only (a reload would give the snapshot's
    # stage back), so Home is drawn again in place, as a tap would draw it. ----
    ctx, pg, errs = open_home(br, 'laptop', 1280, 800)
    law = pg.evaluate(LAW)
    pg.evaluate("async () => { const k = await import('./pub/kernel.js'); k.app.render(); }"); pg.wait_for_timeout(900)
    mo = pg.locator('#fx-moment:not([hidden]) .fx-mtitle')
    ok(law is not None and mo.count() == 1 and 'became law' in mo.inner_text(), f'a law keeps its full-screen moment ({law}): ' + (mo.inner_text() if mo.count() else 'none'))
    if mo.count():
        pg.locator('#fx-mgo').click(); pg.wait_for_timeout(500)
    ok(pg.locator('.hm-gn.law').count() + pg.locator('main .why', has_text='became law').count() >= 1, 'the law is also on Home: a card, or the reason line on its bill')
    pg.evaluate("async () => { const k = await import('./pub/kernel.js'); k.app.render(); }"); pg.wait_for_timeout(900)
    ok(pg.locator('#fx-moment:not([hidden]) .fx-mtitle').count() == 0, 'the law moment shows once: not again on the next drawing')
    ok(not errs, f'law: no page errors {errs[:2]}')
    ctx.close()
    br.close()
print(f"\n{sum(res)} passed, {len(res) - sum(res)} failed")
