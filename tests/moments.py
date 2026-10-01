# R-046 in the public sandbox: result moments on Home (once, with the burst), the honest countdown, the session page
# (#/recap), More's "Your session", "you asked for a hearing and it got one", and the end-of-session moment (once).
#   python3 tests/moments.py [root] [shots]      root defaults to http://localhost:8832/ (the sandbox with ?seed=1)
import sys, re, os
from playwright.sync_api import sync_playwright
ROOT = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832/'
SHOTS = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out')
res = []
def ok(c, m): res.append(bool(c)); print('PASS' if c else 'FAIL', m)
def ready(pg):
    pg.wait_for_function("() => !!document.querySelector('main') && !document.querySelector('.skelpage')", timeout=60000); pg.wait_for_timeout(700)
SKIP = "() => { try { const w = JSON.parse(localStorage.getItem('hiphi_wiz') || '{}'); localStorage.setItem('hiphi_wiz', JSON.stringify({ ...w, done: true, step: 99 })); localStorage.setItem('hiphi_tour_bill', '{\"how\":\"test\"}'); localStorage.setItem('hiphi_tour_home', '{\"how\":\"test\"}'); } catch {} }"
with sync_playwright() as p:
    br = p.chromium.launch()
    for w, h, tag in [(1280, 900, 'laptop'), (390, 844, 'phone')]:
        ctx = br.new_context(viewport={'width': w, 'height': h}, is_mobile=w < 500, has_touch=w < 500)
        ctx.add_init_script(f"({SKIP})()")   # the first visit is done before any page loads
        pg = ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        base = ROOT + 'track.html?demo=1&seed=1'
        pg.goto(base + '#/'); ready(pg)
        # follow the seeded bills so Home is the in-session "follow" Home, then Home's first look at their results
        pg.evaluate("async () => { const c = await import('./pub/core.js'); for (const a of c.myActions()) c.S.direct.add(a.bill_id); c.recomputeWatch(); c.saveLocal(); }")
        pg.reload(); ready(pg)
        txt = pg.locator('main').inner_text()
        since = pg.locator('.hm-since')
        ok(since.count() == 1 and re.search(r'You (testified|emailed the chair), and .+ passed it', since.inner_text()), f'{tag}: Home leads with the moment: ' + (since.inner_text().replace('\n', ' | ')[:160] if since.count() else 'none'))
        ok(pg.locator('.hm-youburst').count() == 1, f'{tag}: the first moment gets the small burst')
        nrows, more = pg.locator('.hm-since .row').count(), pg.locator('.hm-since .hm-sincemore')
        whys = pg.evaluate("[...document.querySelectorAll('main .acard .why, main .why')].map(e => e.innerText).filter(t => /, and .+ (passed it|put it on hold)|and it got one/.test(t))")
        if tag == 'phone': ok(nrows == 1 and (more.count() == 1 and 'more on your session page' in more.inner_text() or nrows + len(whys) >= 2), f'{tag}: one moment row (link: {more.inner_text() if more.count() else "none"}; in cards: {len(whys)})')
        else: ok(nrows + len(whys) == 3 and more.count() == 0, f'{tag}: a laptop says all three once: {nrows} in the strip, {len(whys)} as a card\'s reason')
        ok(not any(pg.locator('.hm-since .row').nth(i).inner_text().split('\n')[0] in ' '.join(whys) for i in range(nrows)), f'{tag}: no moment is said twice (strip and card)')
        if whys: print(f'INFO {tag}: a card says why: {whys[0]}')
        card = pg.evaluate("(() => { const c = document.querySelector('main .card.ac, main article.card, main .hm-main .card'); return c ? Math.round(c.getBoundingClientRect().top) : null; })()")
        print(f'INFO {tag}: first card below the strip at {card}px')
        seen = pg.evaluate("JSON.parse(localStorage.getItem('hiphi_moments_seen_demo') || localStorage.getItem('hiphi_moments_seen') || '[]')")
        ok(len(seen) >= 1, f'{tag}: the moments shown are remembered ({len(seen)})')
        pg.screenshot(path=f'{SHOTS}/r046_home_{tag}.png')
        pg.reload(); ready(pg)
        ok(pg.locator('.hm-youburst').count() == 0, f'{tag}: after a reload the moment does not burst again')
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
        ok('You asked for a hearing, and it got one' in pg.locator('main').inner_text(), f'{tag}: Home says so: ' + (pg.locator('.hm-since').inner_text().replace('\n', ' | ')[:200] if pg.locator('.hm-since').count() else ''))
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
    mo = pg.locator('#fx-moment:not([hidden]) .fx-mtitle')
    ok(mo.count() == 1 and 'session is over' in mo.inner_text(), f'off season: the end of the session is a full-screen moment ({made}): ' + (mo.inner_text() if mo.count() else 'none'))
    pg.screenshot(path=f'{SHOTS}/r046_end_390.png')
    pg.keyboard.press('Escape'); pg.wait_for_timeout(600)
    ok(not pg.url.endswith('#/recap'), 'Escape closes it and stays on Home')
    pg.evaluate("localStorage.removeItem('hiphi_recap_moment')"); pg.reload(); ready(pg); pg.wait_for_timeout(800)
    mo = pg.locator('#fx-moment:not([hidden]) .fx-mtitle')
    if mo.count():
        pg.locator('#fx-mgo').click(); pg.wait_for_timeout(700)
        ok(pg.url.endswith('#/recap') and 'Your 2026 session' in pg.locator('h1').first.inner_text(), 'See your session opens the session page')
    pg.goto(base + '#/'); pg.reload(); ready(pg); pg.wait_for_timeout(800)
    ok(pg.locator('#fx-moment:not([hidden]) .fx-mtitle').count() == 0, 'it shows once')
    ok(not errs, f'off season: no page errors {errs[:2]}')
    br.close()
print(f"\n{sum(res)} passed, {len(res) - sum(res)} failed")
