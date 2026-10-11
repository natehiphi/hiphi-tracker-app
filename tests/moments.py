# R-046 in the public sandbox: result moments on Home as good news cards (once each, with the burst; the rework of 10/10:
# at most three, one on a phone, "Got it" removes one), the honest countdown, the session page (#/recap), More's "Your
# session", "you asked for a hearing and it got one", and the end-of-session moment (once).
# moments_cards.py checks the cards themselves (the cap, the dismissal, "N more good news").
#   python3 tests/moments.py [root] [shots]      root defaults to http://localhost:8832/ (the sandbox with ?seed=1)
import sys, re, os
from playwright.sync_api import sync_playwright
ROOT = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832/'
SHOTS = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out')
res = []
def ok(c, m): res.append(bool(c)); print('PASS' if c else 'FAIL', m)
def ready(pg):
    pg.wait_for_function("() => !!document.querySelector('main') && !document.querySelector('.skelpage')", timeout=60000); pg.wait_for_timeout(700)
# Counts the small bursts this page load plays (fx.js appends one .fx-burst to the body per burst).
BURSTS = "document.addEventListener('DOMContentLoaded', () => { window.__bursts = 0; new MutationObserver(ms => { for (const m of ms) for (const n of m.addedNodes) if (n.classList && n.classList.contains('fx-burst')) window.__bursts++; }).observe(document.body, { childList: true }); });"
SKIP = "() => { try { const w = JSON.parse(localStorage.getItem('hiphi_wiz') || '{}'); localStorage.setItem('hiphi_wiz', JSON.stringify({ ...w, done: true, step: 99 })); localStorage.setItem('hiphi_tour_bill', '{\"how\":\"test\"}'); localStorage.setItem('hiphi_tour_home', '{\"how\":\"test\"}'); } catch {} }"
with sync_playwright() as p:
    br = p.chromium.launch()
    for w, h, tag in [(1280, 900, 'laptop'), (390, 844, 'phone')]:
        ctx = br.new_context(viewport={'width': w, 'height': h}, is_mobile=w < 500, has_touch=w < 500)
        ctx.add_init_script(f"({SKIP})()")   # the first visit is done before any page loads
        ctx.add_init_script(BURSTS)
        pg = ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        base = ROOT + 'track.html?demo=1&seed=1'
        pg.goto(base + '#/'); ready(pg)
        # follow the seeded bills so Home is the in-session "follow" Home, then Home's first look at their results
        pg.evaluate("async () => { const c = await import('./pub/core.js'); for (const a of c.myActions()) c.S.direct.add(a.bill_id); c.recomputeWatch(); c.saveLocal(); }")
        pg.reload(); ready(pg)
        txt = pg.locator('main').inner_text()
        gnsec = pg.locator('.hm-gnsec')
        cards = pg.locator('.hm-gn'); ncards = cards.count()
        facts = pg.evaluate("[...document.querySelectorAll('.hm-gn .hm-gnf')].map(e => e.innerText)")
        # 10/10: a result on a bill that needs a hearing is that card's reason line, not a card of its own (the seed's two are both)
        reasons0 = pg.evaluate("[...document.querySelectorAll('.hm-ask .hm-askgood')].map(e => e.innerText)")
        goodtxt = facts + reasons0
        ok(len(goodtxt) >= 1 and all(re.search(r'(testified|emailed the chair|asked for a hearing|wrote to your legislators), and|and it got one|became law', f) for f in goodtxt),
           f'{tag}: Home says the good news, as cards ({ncards}) or as the reason line of a bill that needs a hearing ({len(reasons0)}): ' + (gnsec.inner_text().replace('\n', ' | ')[:200] if gnsec.count() else '; '.join(reasons0)[:200]))
        ok(pg.evaluate("window.__bursts || 0") == ncards, f'{tag}: each card that first appears gets the small burst once ({ncards} cards, {pg.evaluate("window.__bursts || 0")} bursts)')
        whys = pg.evaluate("[...document.querySelectorAll('main .acard .why, main .why')].map(e => e.innerText).filter(t => /, and .+ (passed it|put it on hold)|and it got one/.test(t))")
        more = pg.locator('.hm-gnmore')
        if tag == 'phone': ok(ncards == 0 and len(reasons0) == 2 and more.count() == 0, f'{tag}: both results sit on their bills as reason lines, no card or line left over (the one-card cap is in moments_cards.py; reason lines: {len(whys)})')
        else: ok(ncards + len(whys) == 3 and more.count() == 0, f'{tag}: a laptop says all three once: {ncards} cards, {len(whys)} as a card\'s reason')
        ok(not any(f in ' '.join(whys) for f in facts), f'{tag}: no moment is said twice (card and reason line)')
        if whys: print(f'INFO {tag}: a card says why: {whys[0]}')
        card = pg.evaluate("(() => { const c = document.querySelector('main .card.ac, main article.card, main .hm-main .card'); return c ? Math.round(c.getBoundingClientRect().top) : null; })()")
        print(f'INFO {tag}: first card below the strip at {card}px')
        shown = pg.evaluate("JSON.parse(localStorage.getItem('hiphi_moments_shown') || '[]')")
        ok(len(shown) >= ncards + len(reasons0) >= 1, f'{tag}: the moments shown are remembered ({len(shown)})')
        pg.screenshot(path=f'{SHOTS}/r046_home_{tag}.png')
        pg.reload(); ready(pg)
        ok(pg.evaluate("window.__bursts || 0") == 0, f'{tag}: after a reload the moment does not burst again')
        # the honest countdown: a bill whose testimony is due within two days of the sandbox clock
        num = pg.evaluate("async () => { const c = await import('./pub/core.js'); const now = Date.now(); const h = c.D.hearings.find(x => x.testimony_deadline && new Date(x.testimony_deadline) - now > 2 * 36e5 && new Date(x.testimony_deadline) - now < 20 * 36e5 && c.D.bills.some(b => b.id === x.bill_id && c.alive(b))); return h ? c.D.bills.find(b => b.id === h.bill_id).bill_number : null; }")
        pg.goto(base + f'#/bill/{num}'); ready(pg)
        cd = pg.locator('[data-due]')
        line = pg.evaluate("(() => { const p = document.querySelector('[data-due]')?.closest('p'); return p ? [p.innerText, p.className] : ['', ''] })()")
        ok(cd.count() >= 1 and re.match(r'Testimony due in under (\d+ hours|an hour)$', cd.first.inner_text()), f'{tag}: {num}\'s deadline within a day counts down: ' + line[0])
        ok('warn' in line[1], f'{tag}: amber within a day (A-5): {line[1]}')
        if cd.count(): pg.screenshot(path=f'{SHOTS}/r046_due_{tag}.png')
        pg.evaluate("document.querySelector('[data-due]') && (document.querySelector('[data-due]').textContent = 'stale')")
        pg.wait_for_timeout(61000) if tag == 'laptop' else None
        if tag == 'laptop': ok(pg.locator('[data-due]').first.inner_text().startswith('Testimony due in under'), 'the countdown rewrites itself each minute')
        # the session page
        pg.goto(base + '#/recap'); ready(pg)
        h1 = pg.locator('h1').first.inner_text()
        ok('Your 2026 session so far' in h1, f'{tag}: the session page: {h1}')
        mt = pg.locator('main').inner_text()
        ok('passed it' in mt and pg.locator('#hm-rcp-good').count() == 0 and 'Your weeks' not in mt, f'{tag}: one list of what happened (no second "Good news" list, no weeks)')
        lede = pg.locator('.hm-rcphead .lede').inner_text()
        ok('passed the committee you spoke to' in lede and 'Governor' not in lede, f'{tag}: in session the sentence counts committee votes as such: "{lede}"')
        ok('A committee said yes' not in mt and 'Asked, and it got a hearing' not in mt, f'{tag}: no badges for other people\'s votes')
        ok(pg.evaluate("document.documentElement.scrollWidth") <= w, f'{tag}: nothing wider than the screen')
        pg.screenshot(path=f'{SHOTS}/r046_recap_{tag}.png', full_page=True)
        pg.goto(base + '#/more'); ready(pg)
        ok(pg.locator('a.row[href="#/recap"]').count() == 1, f'{tag}: More has Your session')
        # asked for a hearing, then a notice was posted: "You asked for a hearing, and it got one"
        got = pg.evaluate("""async () => { const c = await import('./pub/core.js'); const now = Date.now();
          const h = c.D.hearings.find(x => x.notice_posted_at && new Date(x.scheduled_at) > now && c.D.bills.some(b => b.id === x.bill_id && /support/.test(b.hiphi_position || '')) && !c.myActions().some(a => a.bill_id === x.bill_id));
          if (!h) return null; const k = h.bill_id + '||email'; c.S.done.add(k); c.S.doneAt[k] = new Date(new Date(h.notice_posted_at).getTime() - 3 * 864e5).toISOString(); c.saveDone(); c.saveDoneAt();
          c.S.direct.add(h.bill_id); c.recomputeWatch(); c.saveLocal(); return c.results().filter(r => r.kind === 'heard').map(r => r.key); }""")
        ok(got and len(got) >= 1, f'{tag}: an ask before the notice is a "got a hearing" result: {got}')
        held = pg.evaluate("""async () => { const c = await import('./pub/core.js'); const now = Date.now();
          const h = c.D.hearings.find(x => x.notice_posted_at && new Date(x.scheduled_at) > now && c.D.bills.some(b => b.id === x.bill_id && /oppose/.test(b.hiphi_position || '')) && !c.myActions().some(a => a.bill_id === x.bill_id));
          if (!h) return 'none'; const k = h.bill_id + '||email'; c.S.done.add(k); c.S.doneAt[k] = new Date(new Date(h.notice_posted_at).getTime() - 3 * 864e5).toISOString();
          const r = c.results().some(x => x.b.id === h.bill_id); c.S.done.delete(k); delete c.S.doneAt[k]; return r; }""")
        ok(held is False or held == 'none', f'{tag}: asking the chair to hold a bill HIPHI opposes is no "got a hearing" moment ({held})')
        pg.goto(base + '#/'); ready(pg)
        ok('You asked for a hearing, and it got one' in pg.locator('main').inner_text(), f'{tag}: Home says so: ' + (pg.locator('.hm-gnsec').inner_text().replace('\n', ' | ')[:200] if pg.locator('.hm-gnsec').count() else ''))
        # someone against a bill: a committee passing it is no good news (sideOf)
        if tag == 'laptop':
            r = pg.evaluate("""async () => { const c = await import('./pub/core.js'); const p = c.results().find(x => x.kind === 'passed'); if (!p) return null;
              c.S.stances[p.b.id] = 'oppose'; c.saveStances(); localStorage.removeItem('hiphi_moments_seen'); return [p.b.bill_number, c.results().some(x => x.b.id === p.b.id && x.kind === 'passed')]; }""")
            ok(r and r[1] is False, f'against a bill, its passing is not a result to celebrate: {r}')
            pg.goto(base + '#/recap'); ready(pg)
            ok(r and f'{r[0][:2]} {r[0][2:]}' in pg.locator('main').inner_text(), 'it is still listed, as a plain fact')
        ok(not errs, f'{tag}: no page errors {errs[:2]}')
        ctx.close()
    # between sessions: the end-of-session moment, once
    ctx = br.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
    pg = ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    base = ROOT + 'track.html?demo=1&season=off'
    pg.goto(base + '#/'); ready(pg); pg.evaluate(SKIP)   # after load: the sandbox keeps its own copy of these keys
    made = pg.evaluate("""async () => { const c = await import('./pub/core.js');
      const b = c.D.bills.find(x => x.stage === 'enacted' && x.hiphi_position && x.hiphi_position !== 'monitor'); if (!b) return null;
      const k = b.id + '||share'; c.S.done.add(k); c.S.doneAt[k] = '2026-03-01T20:00:00.000Z'; c.saveDone(); c.saveDoneAt();
      try { localStorage.setItem('hiphi_moments_seen_demo', JSON.stringify(['law:' + b.id])); localStorage.setItem('hiphi_moments_seen', JSON.stringify(['law:' + b.id])); } catch {}
      c.S.direct.add(b.id); c.recomputeWatch(); c.saveLocal(); return b.bill_number; }""")
    pg.reload(); ready(pg); pg.goto(base + '#/'); ready(pg); pg.wait_for_timeout(800)
    # R-140 (10/10): the session's end is not a full-screen moment any more; it is a burst on Home's heading and a toast
    # that stays 10 s with "See your session" on it. Nothing waits for it.
    tm = pg.locator('#toast .toastmsg')
    ok(tm.count() == 1 and 'session is over' in tm.inner_text() and pg.locator('#fx-moment:not([hidden])').count() == 0,
       f'off season: the end of the session is a toast, not a full-screen moment ({made}): ' + (tm.inner_text()[:120] if tm.count() else 'none'))
    pg.screenshot(path=f'{SHOTS}/r046_end_390.png')
    pg.wait_for_timeout(400)
    ok('#/recap' not in pg.url, 'nothing moves it on by itself: Home stays')
    pg.locator('#toast .toastundo').first.click(); pg.wait_for_timeout(900)
    ok(pg.url.endswith('#/recap') and 'Your 2026 session' in pg.locator('h1').first.inner_text(), 'See your session (the toast\'s button) opens the session page')
    pg.goto(base + '#/'); pg.reload(); ready(pg); pg.wait_for_timeout(800)
    ok(pg.locator('#toast .toastmsg').count() == 0 and pg.locator('#fx-moment:not([hidden])').count() == 0, 'it shows once')
    ok(not errs, f'off season: no page errors {errs[:2]}')
    br.close()
print(f"\n{sum(res)} passed, {len(res) - sum(res)} failed")
