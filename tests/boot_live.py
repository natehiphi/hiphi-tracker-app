# The staged boot on the published site (R-122, the assessment's P5): who gets the early first screen and who must not.
#   python3 tests/boot_live.py [base]      base defaults to https://natehiphi.github.io/hiphi-tracker-app/
# Nothing is counted (the privacy signal is set, and a test run is never a visit).
import sys
from playwright.sync_api import sync_playwright
BASE = (sys.argv[1] if len(sys.argv) > 1 else 'https://natehiphi.github.io/hiphi-tracker-app/').rstrip('/') + '/'
res = []
def ok(c, m): res.append(bool(c)); print('PASS' if c else 'FAIL', m)
QUIET = "Object.defineProperty(navigator, 'globalPrivacyControl', { value: true });"
def ready(pg):
    pg.wait_for_function("() => !!document.querySelector('main') && !document.querySelector('.skelpage') && !document.querySelector('.boot0')", timeout=60000); pg.wait_for_timeout(1500)
with sync_playwright() as p:
    br = p.chromium.launch()
    # 1. a newcomer: the topics screen, and a copy of the catalog kept for next time
    ctx = br.new_context(viewport={'width': 390, 'height': 844}); ctx.add_init_script(QUIET); pg = ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(BASE + 'track.html#/'); ready(pg)
    ok(pg.evaluate('location.hash').startswith('#/start/'), f'a newcomer gets the first visit ({pg.evaluate("location.hash")})')
    cached = pg.evaluate("() => { try { const c = JSON.parse(localStorage.getItem('hiphi_catalog') || 'null'); return c && c.cats.length && c.issues.length; } catch { return 0; } }")
    ok(bool(cached), 'the catalog is kept for next time')
    # 2. the same browser again: the first screen is drawn from the kept copy before the network answers
    pg.goto(BASE + 'track.html#/'); pg.wait_for_function("() => !!document.querySelector('.st1, .st-topics')", timeout=30000)
    ok(True, 'a second visit draws the topics screen again')
    ctx.close()
    # 3. a person who acted on a shared bill before finishing the first visit lands on Home, not back at step 1
    # (10/1: the early render judged before this browser's actions were read and rewrote the address to #/start/1)
    ctx = br.new_context(viewport={'width': 390, 'height': 844}); ctx.add_init_script(QUIET)
    ctx.add_init_script("try { localStorage.setItem('hiphi_done', JSON.stringify(['00000000-0000-0000-0000-000000000000|00000000-0000-0000-0000-000000000001|email'])); localStorage.setItem('hiphi_done_at', JSON.stringify({ '00000000-0000-0000-0000-000000000000|00000000-0000-0000-0000-000000000001|email': new Date().toISOString() })); } catch {}")
    pg = ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(BASE + 'track.html#/'); ready(pg); pg.wait_for_timeout(2500)
    ok(not pg.evaluate('location.hash').startswith('#/start/'), f'with an action already taken, the page is Home, not the first visit ({pg.evaluate("location.hash")})')
    ctx.close()
    # 4-6. Whoever skips the early first screen still ends with the full catalog (10/4, R-136: a first visit opened at
    # #/start/1, a reload half-way through, or a stored sign-in kept the slim one, so no issue had a bill and every
    # count said 0). Each tile's count is watched from the first paint: never a "0".
    WATCH = """(() => { window.__zeros = []; new MutationObserver(() => document.querySelectorAll('.st-icount').forEach(e => {
      if (/^0 /.test(e.textContent)) window.__zeros.push(e.textContent); })).observe(document, { subtree: true, childList: true, characterData: true }); })()"""
    def full(pg):
        return pg.evaluate("async () => { const k = await import(new URL('pub/kernel.js', location.href).href); return [k.S.catalogLive, k.S.issues.filter(i => i.bill_ids.length).length, k.S.issues.length]; }")
    def pick3(pg):
        pg.wait_for_selector('[data-stissue]', timeout=30000)
        for el in pg.query_selector_all('[data-stissue]')[:3]: el.click()
        pg.click('[data-stnext]')
        try: pg.wait_for_selector('.st-pcard', timeout=15000)
        except Exception: pass   # none came: the next check says so
        pg.wait_for_timeout(800)
    for label, url, init in [('a first visit opened at #/start/1', 'track.html#/start/1', ''),
                             ('a stored sign-in', 'track.html#/start/1', "try { localStorage.setItem('hiphi-public-auth', '{}'); } catch {}")]:
        ctx = br.new_context(viewport={'width': 390, 'height': 844}); ctx.add_init_script(QUIET); ctx.add_init_script(WATCH)
        if init: ctx.add_init_script(init)
        pg = ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(BASE + url); ready(pg)
        live, withb, n = full(pg)
        ok(live == 'full' and n and withb == n, f'{label}: the full catalog, every issue with its bills ({live}, {withb}/{n})')
        ok(not pg.evaluate('window.__zeros'), f'{label}: no topic says 0 ({pg.evaluate("window.__zeros")[:3]})')
        if not init:
            pick3(pg)
            cards = pg.eval_on_selector_all('.st-pcard', 'els => els.length')
            ok(cards >= 4, f'{label}: the issues screen lists issues ({cards} cards)')
            # The topic headings carry no count: they said "16 issues" over the three listed (R-136); the total is said
            # once, beside "Follow all".
            heads = pg.eval_on_selector_all('.st-tsec > summary', 'els => els.map(e => e.innerText)')
            ok(heads and not any(' issue' in h for h in heads), f'{label}: no count in the topic headings ({heads})')
            pg.reload(); ready(pg)
            try: pg.wait_for_selector('.st-pcard', timeout=15000)
            except Exception: pass
            live, withb, n = full(pg)
            ok(live == 'full' and withb == n and pg.eval_on_selector_all('.st-pcard', 'els => els.length') >= 4, f'a reload on the issues screen keeps its issues ({live}, {withb}/{n})')
        ctx.close()
    # 7. the plain address (the early first screen) never shows a 0 either, and still ends with the full catalog
    ctx = br.new_context(viewport={'width': 390, 'height': 844}); ctx.add_init_script(QUIET); ctx.add_init_script(WATCH)
    pg = ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(BASE + 'track.html#/'); ready(pg)
    live, withb, n = full(pg)
    ok(live == 'full' and withb == n and not pg.evaluate('window.__zeros'), f'a newcomer at the plain address: full catalog, no 0 on a topic ({live}, {withb}/{n}, {pg.evaluate("window.__zeros")[:3]})')
    ctx.close()
    ok(not errs, 'no page errors: ' + '; '.join(errs[:3]))
    br.close()
print(f'{sum(res)}/{len(res)} passed'); sys.exit(0 if all(res) else 1)
