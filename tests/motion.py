# R-140 (Nate 10/5: "celebratory but also encourage continuing... shouldn't be roadblocks"): the celebrations never block.
# On the practice copy, phone size unless said otherwise:
#   - the first follow's "Mahalo!" moment: its button is there from the first frame and works mid-animation (a click at
#     0.25 s moves on); the moment is gone within 1.6 s by itself, and its words stay for a while as a toast;
#   - a tap on the text under the veil, a scroll and Escape each close a moment; the tap and Escape move the flow on once,
#     a scroll does not; a tap on the button under the veil does that button's job once (no second step);
#   - a small burst flies up from the thing it came from, is gone within 0.8 s, and leaves the button under it clickable;
#   - Reduce Motion: no petals, no movement; the words stay and the thing gets a brief colour change.
#   python3 tests/motion.py [base_url]     base defaults to http://localhost:8832/track.html (run_test.sh rewrites the port)
import sys, os
from playwright.sync_api import sync_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832/track.html'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out'); os.makedirs(OUT, exist_ok=True)
passes, fails = [], []
def ok(c, m): (passes if c else fails).append(m); print(('PASS ' if c else 'FAIL ') + m, flush=True)
# Every time the moment opens or closes, in the page's own clock (a MutationObserver: it sees the change within a frame).
INIT = """(() => { window.__fx = []; let last = 'hidden';
  const check = () => { const el = document.getElementById('fx-moment'); const st = el && !el.hidden && el.innerHTML ? 'shown' : 'hidden';
    if (st !== last) { last = st; window.__fx.push({ kind: st, t: performance.now() }); } };
  new MutationObserver(check).observe(document, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden'] });
})();"""
# Is the element on screen, not faded out, and the thing a tap at its middle would reach (the petals and the veil do not take taps)?
REACH = """(sel => { const el = document.querySelector(sel); if (!el) return { ok: false, why: 'missing' };
  const r = el.getBoundingClientRect(), vw = innerWidth, vh = innerHeight;
  let op = 1; for (let n = el; n; n = n.parentElement) op *= +getComputedStyle(n).opacity;
  const inside = r.top >= 0 && r.bottom <= vh && r.left >= 0 && r.right <= vw;
  const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  const clickable = !!hit && (hit === el || el.contains(hit));
  return { ok: inside && op > .95 && clickable, inside, op: +op.toFixed(2), clickable, why: hit ? (hit.id || hit.className || hit.tagName) : 'nothing' }; })"""
def walk_to_follow(p):
    p.locator('[data-stissue]').first.click(); p.locator('[data-stnext]').click(); p.wait_for_timeout(1500)
    if p.locator('[data-stpick][aria-pressed=true]').count() == 0: p.locator('[data-stpick]').first.click()
    p.locator('[data-stnext]').click(); p.wait_for_timeout(1500)
    p.locator('[data-alswap="email"]').click(); p.wait_for_timeout(400)
    p.fill('#st-a-email', 'leilani@example.com'); p.locator('#st-send').click()
    p.wait_for_selector('#fx-moment:not([hidden]) #fx-mgo', timeout=8000)
def shown_log(p): return p.evaluate("window.__fx.slice()")
def open_probe(p, name='Test moment'):
    # A moment of its own on the alerts page (no walk needed): counts how often its `then` moves the flow on.
    p.evaluate(f"""async () => {{ const fx = await import('./pub/fx.js'); window.__n = 0; window.__fx.length = 0;
      fx.celebrate({{ title: '{name}', sub: 'A test moment.', go: 'Continue' }}, () => {{ window.__n++; }}); }}""")
    p.wait_for_selector('#fx-moment:not([hidden]) #fx-mgo', timeout=4000)

with sync_playwright() as pw:
    br = pw.chromium.launch()
    # ---- 1. the first follow's moment, default motion ----
    ctx = br.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True, device_scale_factor=2)
    ctx.add_init_script(INIT)
    p = ctx.new_page(); errs = []; p.on('pageerror', lambda e: errs.append(str(e)))
    p.goto(BASE + '?demo=1&restart&fv=full'); p.wait_for_timeout(2500)
    p.evaluate("localStorage.clear(); sessionStorage.clear()"); p.reload(); p.wait_for_timeout(3000)
    walk_to_follow(p)
    p.wait_for_timeout(250)
    r = p.evaluate(REACH + "('#fx-mgo')")
    ok(r['ok'], f'the moment\'s button is there and tappable from the first frame, mid-animation ({r})')
    p.screenshot(path=os.path.join(OUT, 'motion_follow_250.png'))
    bar = p.evaluate(REACH + "('.st-bar .btn, .st-bar button')")
    ok(bar['ok'], f'the page\'s own action bar is not covered by the moment ({bar})')
    p.locator('#fx-mgo').click(); p.wait_for_timeout(900)
    h1 = p.evaluate("document.querySelector('main h1')?.innerText || ''")
    ok(h1 == 'A bill’s story', f'a click on the button at 0.25 s moves on at once: "{h1}"')
    ok(p.locator('#fx-moment:not([hidden])').count() == 0, 'the moment is gone after its button')
    # the same moment, left alone: gone within 1.6 s, the words kept as a toast
    ctx.close()
    ctx = br.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True, device_scale_factor=2)
    ctx.add_init_script(INIT)
    p = ctx.new_page(); p.on('pageerror', lambda e: errs.append(str(e)))
    p.goto(BASE + '?demo=1&restart&fv=full'); p.wait_for_timeout(2500)
    p.evaluate("localStorage.clear(); sessionStorage.clear()"); p.reload(); p.wait_for_timeout(3000)
    walk_to_follow(p)
    p.wait_for_timeout(2200)
    log = shown_log(p)
    shown = [e['t'] for e in log if e['kind'] == 'shown']; hid = [e['t'] for e in log if e['kind'] == 'hidden' and shown and e['t'] > shown[-1]]
    dur = (hid[0] - shown[-1]) if hid else None
    ok(dur is not None and dur <= 1600, f'a full-screen moment is gone within 1.6 s by itself ({None if dur is None else round(dur)} ms)')
    ok(p.locator('#fx-moment:not([hidden])').count() == 0 and p.evaluate("document.querySelector('main h1')?.innerText || ''") == 'A bill’s story',
       'it moves on by itself after that (no tap)')
    toast = p.evaluate("document.querySelector('#toast .toastmsg')?.innerText || ''")
    ok('Mahalo!' in toast and 'following' in toast, f'the words stay as a toast after it leaves: "{toast[:80]}"')
    ok(not errs, f'phone walk: no page errors {errs[:2]}')
    ctx.close()
    # ---- 2. what closes a moment, on the alerts screen (a probe moment, its `then` counted) ----
    ctx = br.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True, device_scale_factor=2)
    ctx.add_init_script(INIT)
    p = ctx.new_page(); p.goto(BASE + '?demo=1&restart&fv=full'); p.wait_for_timeout(2500)
    p.evaluate("localStorage.clear(); sessionStorage.clear()"); p.reload(); p.wait_for_timeout(3000)
    walk_to_follow(p); p.wait_for_timeout(250); p.locator('#fx-mgo').click(); p.wait_for_timeout(900)   # into the story: the probes run there
    # a tap on plain text under the veil closes it and moves on, once
    open_probe(p); p.wait_for_timeout(250)
    box = p.evaluate("(() => { const h = document.querySelector('main h1'); const r = h.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; })()")
    p.mouse.click(box[0], box[1]); p.wait_for_timeout(500)
    ok(p.evaluate("window.__n") == 1 and p.locator('#fx-moment:not([hidden])').count() == 0, 'a tap on the text under the veil closes the moment and moves on, once')
    # a scroll closes it and does not move on
    open_probe(p); p.wait_for_timeout(250); p.mouse.wheel(0, 120); p.wait_for_timeout(500)
    ok(p.evaluate("window.__n") == 0 and p.locator('#fx-moment:not([hidden])').count() == 0, 'a scroll closes the moment and leaves the flow where it is')
    # Escape closes it and moves on, once
    open_probe(p); p.wait_for_timeout(250); p.keyboard.press('Escape'); p.wait_for_timeout(500)
    ok(p.evaluate("window.__n") == 1 and p.locator('#fx-moment:not([hidden])').count() == 0, 'Escape closes it and moves on, once')
    # a tap through to the control under the veil: that control does its own job, once; the moment does not move on too
    before = p.evaluate("location.hash")
    open_probe(p); p.wait_for_timeout(250)
    p.locator('[data-stback]').first.click(); p.wait_for_timeout(700)
    after = p.evaluate("location.hash")
    ok(after != before and p.evaluate("window.__n") == 0 and p.locator('#fx-moment:not([hidden])').count() == 0,
       f'a tap through to Back does Back once and leaves the moment\'s own "then" unrun ({before} -> {after}, n={p.evaluate("window.__n")})')
    # the card's own button, mid-animation: it moves on once
    open_probe(p, 'Card button'); p.wait_for_timeout(250); p.locator('#fx-mgo').click(); p.wait_for_timeout(500)
    ok(p.evaluate("window.__n") == 1, f'the card\'s button moves on once ({p.evaluate("window.__n")})')
    # ---- 3. a small burst: from above its thing, gone by 0.8 s, and the button under it still takes a tap ----
    ctx.close(); ctx = br.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True, device_scale_factor=2)
    p = ctx.new_page(); p.goto(BASE + '?demo=1&restart&fv=full'); p.wait_for_timeout(2500)
    p.evaluate("localStorage.clear(); sessionStorage.clear()"); p.reload(); p.wait_for_timeout(3000)
    res = p.evaluate("""async () => { const fx = await import('./pub/fx.js'); const b = document.querySelector('[data-stissue]') || document.querySelector('main button');
      const r = b.getBoundingClientRect(); fx.burst(b, 12, 48); await new Promise(r => setTimeout(r, 60));
      const pts = [...document.querySelectorAll('.fx-burst i')]; const tops = pts.map(i => i.getBoundingClientRect().top);
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      await new Promise(r => setTimeout(r, 800)); const left = document.querySelectorAll('.fx-burst').length;
      return { n: pts.length, above: tops.length ? Math.max(...tops) <= r.top + 4 : false, hitOk: !!hit && (hit === b || b.contains(hit)), left }; }""")
    ok(res['n'] == 12 and res['left'] == 0, f'a burst is 12 petals and gone by 0.8 s ({res})')
    ok(res['hitOk'], 'the button under a burst still takes the tap (petals are not in the way)')
    ok(res['above'], 'the petals fly up from above the thing, not down over it')
    ctx.close()
    # ---- 4. Reduce Motion: no movement, the words and a colour change ----
    ctx = br.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True, device_scale_factor=2, reduced_motion='reduce')
    ctx.add_init_script(INIT)
    p = ctx.new_page(); errs2 = []; p.on('pageerror', lambda e: errs2.append(str(e)))
    p.goto(BASE + '?demo=1&restart&fv=full'); p.wait_for_timeout(2500)
    p.evaluate("localStorage.clear(); sessionStorage.clear()"); p.reload(); p.wait_for_timeout(3000)
    walk_to_follow(p)
    tinted = p.evaluate("document.querySelector('#fx-moment .fx-mtitle')?.classList.contains('fx-tint') || false")
    ok(tinted, 'reduced motion: the title gets a brief colour change as the moment opens')
    info = p.evaluate("""(() => { const t = document.querySelector('#fx-moment .fx-mtitle'); const cs = getComputedStyle(t);
      const anims = [...document.querySelectorAll('#fx-moment *')].map(e => parseFloat(getComputedStyle(e).animationDuration) || 0);
      return { words: t.innerText, dur: Math.max(0, ...anims), tint: t.classList.contains('fx-tint'), bursts: document.querySelectorAll('.fx-burst').length }; })()""")
    ok(info['words'] == 'Mahalo!', f'reduced motion: the words are there ("{info["words"]}")')
    ok(info['dur'] <= 0.001, f'reduced motion: nothing in the moment animates (longest {info["dur"]} s)')
    ok(info['bursts'] == 0, 'reduced motion: no petals')
    p.wait_for_timeout(1900)
    ok(p.locator('#fx-moment:not([hidden])').count() == 0, 'reduced motion: it still leaves on its own at 1.5 s')
    bu = p.evaluate("""async () => { const fx = await import('./pub/fx.js'); const b = document.querySelector('[data-stnext]') || document.querySelector('main button');
      fx.burst(b, 12, 48); return { petals: document.querySelectorAll('.fx-burst').length, tinted: b.classList.contains('fx-tint') }; }""")
    ok(bu['petals'] == 0 and bu['tinted'], f'reduced motion: a burst draws no petals and tints its thing instead ({bu})')
    ok(not errs2, f'reduced motion: no page errors {errs2[:2]}')
    ctx.close()
    br.close()
print(f"\n{len(passes)} passed, {len(fails)} failed")
sys.exit(1 if fails else 0)
