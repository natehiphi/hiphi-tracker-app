# R-140 (Nate 10/5: "celebratory but also encourage continuing... shouldn't be roadblocks"): the celebrations never block.
# On the practice copy, phone size unless said otherwise:
#   - a full-screen moment (fx.js celebrate: the testimony "Mahalo", a law passed, ...), driven here by a probe on the
#     story screen: its button is there from the first frame and works mid-animation (a click at 0.25 s closes it and moves
#     the flow on); it is gone within 1.6 s by itself, and its words stay for a while as a toast. (It used to be driven by
#     the first follow's "Mahalo!", which is a page that waits for Next since Nate 11 Oct: section 6.)
#   - a tap on the text under the veil, a scroll and Escape each close a moment; the tap and Escape move the flow on once,
#     a scroll does not; a tap on the button under the veil does that button's job once (no second step);
#   - a small burst flies up from the thing it came from, is gone within 0.8 s, and leaves the button under it clickable;
#   - Reduce Motion: no petals, no movement; the words stay and the thing gets a brief colour change;
#   - Skip on "Save your profile" (section 5): the screen turns into the "Mahalo!" page in place, with no moment over it,
#     its Next goes on one step, and "Save your profile" or its error never comes back;
#   - the "Mahalo!" page itself (section 6; R-140, Nate 11 Oct: the 1.5 s moment was "too quick", a page that waits for
#     Next), on a 375x812 phone after a confirmed code: the heading, still there after 3 s, the tab's title, focus on the
#     heading, Next to the story, Back to it without replaying the flower, and under Reduce Motion nothing animating.
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
# To the alerts screen, an email given: the screen turns into the "Mahalo!" page (R-140, Nate 11 Oct).
def walk_to_follow(p):
    p.locator('[data-stissue]').first.click(); p.locator('[data-stnext]').click(); p.wait_for_timeout(1500)
    if p.locator('[data-stpick][aria-pressed=true]').count() == 0: p.locator('[data-stpick]').first.click()
    p.locator('[data-stnext]').click(); p.wait_for_timeout(1500)
    p.locator('[data-alswap="email"]').click(); p.wait_for_timeout(400)
    p.fill('#st-a-email', 'leilani@example.com'); p.locator('#st-send').click()
    p.wait_for_selector('.st-thanks #st-h', timeout=8000)
# On through the "Mahalo!" page's Next to the story, where the probe moments play.
def walk_to_story(p):
    walk_to_follow(p); p.wait_for_timeout(400); p.locator('.actionbar [data-stnext]').click()
    p.wait_for_function("(document.querySelector('main h1')?.innerText || '') === 'A bill’s story'", timeout=8000); p.wait_for_timeout(600)
def shown_log(p): return p.evaluate("window.__fx.slice()")
def open_probe(p, name='Test moment', sub='A test moment.'):
    # A moment of its own (no walk needed), from the same fx.js the app imports ('./pub/fx.js' from track.html, no ?v=, so
    # one module instance): counts how often its `then` moves the flow on.
    p.evaluate(f"""async () => {{ const fx = await import('./pub/fx.js'); window.__n = 0; window.__fx.length = 0;
      fx.celebrate({{ title: '{name}', sub: '{sub}', go: 'Continue' }}, () => {{ window.__n++; }}); }}""")
    p.wait_for_selector('#fx-moment:not([hidden]) #fx-mgo', timeout=4000)

with sync_playwright() as pw:
    br = pw.chromium.launch()
    # ---- 1. a full-screen moment, default motion (a probe "Mahalo!" on the story screen) ----
    ctx = br.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True, device_scale_factor=2)
    ctx.add_init_script(INIT)
    p = ctx.new_page(); errs = []; p.on('pageerror', lambda e: errs.append(str(e)))
    p.goto(BASE + '?demo=1&restart&fv=full'); p.wait_for_timeout(2500)
    p.evaluate("localStorage.clear(); sessionStorage.clear()"); p.reload(); p.wait_for_timeout(3000)
    walk_to_story(p)
    open_probe(p, 'Mahalo!', 'You’re following a probe.')
    p.wait_for_timeout(250)
    r = p.evaluate(REACH + "('#fx-mgo')")
    ok(r['ok'], f'the moment\'s button is there and tappable from the first frame, mid-animation ({r})')
    p.screenshot(path=os.path.join(OUT, 'motion_follow_250.png'))
    bar = p.evaluate(REACH + "('.st-bar .btn, .st-bar button')")
    ok(bar['ok'], f'the bar under the moment (the screen\'s own) is not covered ({bar})')
    p.locator('#fx-mgo').click(); p.wait_for_timeout(900)
    ok(p.evaluate("window.__n") == 1, f'a click on the button at 0.25 s closes it and moves the flow on, once (n={p.evaluate("window.__n")})')
    ok(p.locator('#fx-moment:not([hidden])').count() == 0, 'the moment is gone after its button')
    # the same moment, left alone: gone within 1.6 s, the words kept as a toast
    open_probe(p, 'Mahalo!', 'You’re following a probe.')
    p.wait_for_timeout(2200)
    log = shown_log(p)
    shown = [e['t'] for e in log if e['kind'] == 'shown']; hid = [e['t'] for e in log if e['kind'] == 'hidden' and shown and e['t'] > shown[-1]]
    dur = (hid[0] - shown[-1]) if hid else None
    ok(dur is not None and dur <= 1600, f'a full-screen moment is gone within 1.6 s by itself ({None if dur is None else round(dur)} ms)')
    ok(p.locator('#fx-moment:not([hidden])').count() == 0 and p.evaluate("window.__n") == 1, 'it moves on by itself after that (no tap), once')
    toast = p.evaluate("document.querySelector('#toast .toastmsg')?.innerText || ''")
    ok('Mahalo!' in toast and 'following' in toast, f'the words stay as a toast after it leaves: "{toast[:80]}"')
    ok(not errs, f'phone walk: no page errors {errs[:2]}')
    ctx.close()
    # ---- 2. what closes a moment, on the story screen (a probe moment, its `then` counted) ----
    ctx = br.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True, device_scale_factor=2)
    ctx.add_init_script(INIT)
    p = ctx.new_page(); p.goto(BASE + '?demo=1&restart&fv=full'); p.wait_for_timeout(2500)
    p.evaluate("localStorage.clear(); sessionStorage.clear()"); p.reload(); p.wait_for_timeout(3000)
    walk_to_story(p)   # through the "Mahalo!" page's Next into the story: the probes run there
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
    walk_to_story(p); open_probe(p, 'Mahalo!')
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
    # ---- 5. Skip on "Save your profile" (the alerts ask, the short first visit): the "Mahalo!" page, in place ----
    # R-140 fix (10/10): the skipped screen's bottom bar ("Text me a code") stayed live under the moment's veil, so a tap there
    # went back to "Save your profile" with its error. Since Nate 11 Oct ("too quick") there is no moment here at all: the
    # screen itself turns into the "Mahalo!" page, its one button is its Next, and nothing leaves on its own.
    H1 = "(document.querySelector('#st-h') || document.querySelector('main h1') || {}).innerText || ''"
    BARS = "[...document.querySelectorAll('.st-bar button')].filter(b => { const r = b.getBoundingClientRect(); return r.width > 0 && r.height > 0; }).map(b => b.innerText.trim())"
    ERR = "document.body.innerText.includes('Add your mobile number, or skip this for now.')"
    def step_of(h): s = h.rsplit('/', 1)[-1]; return int(s) if s.isdigit() else -1
    def walk_to_profile(p):
        for _ in range(12):
            if p.evaluate(H1) == 'Save your profile': return True
            if p.locator('[data-stissue]').count() and not p.locator('[data-stissue][aria-pressed=true]').count(): p.locator('[data-stissue]').first.click()
            elif p.locator('[data-stpick]').count() and not p.locator('[data-stpick][aria-pressed=true]').count(): p.locator('[data-stpick]').first.click()
            if p.locator('[data-stnext]').count(): p.locator('[data-stnext]').first.click(); p.wait_for_timeout(1500)
            else: p.wait_for_timeout(800)
        return False
    def short_visit(br):
        c = br.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True, device_scale_factor=2)
        c.add_init_script(INIT)
        pg = c.new_page(); e = []; pg.on('pageerror', lambda x: e.append(str(x)))
        pg.goto(BASE + '?demo=1&restart&abrest=today&ab=fv.short'); pg.wait_for_timeout(2500)
        pg.evaluate("localStorage.clear(); sessionStorage.clear()"); pg.reload(); pg.wait_for_timeout(3000)
        return c, pg, e
    # 5a: Skip turns the screen into the "Mahalo!" page at the same address; its Next goes on one step, never back
    ctx, p, errs5 = short_visit(br)
    ok(walk_to_profile(p), '5: the short first visit reaches "Save your profile"')
    before = p.evaluate("location.hash")
    p.locator('[data-stskip]').first.click(); p.wait_for_selector('.st-thanks #st-h', timeout=4000); p.wait_for_timeout(300)
    h = p.evaluate(H1); bars = p.evaluate(BARS)
    ok(h == 'Mahalo!' and p.evaluate("location.hash") == before and p.locator('#fx-moment:not([hidden])').count() == 0,
       f'5: Skip: the screen turns into the "Mahalo!" page in place ("{h}", {p.evaluate("location.hash")}), with no moment over it')
    ok(bars == ['Next: Why Your Voice Matters'] and not p.evaluate(ERR), f'5: its bar is one Next naming the short version’s next part, no "Text me a code" and no error ({bars})')
    p.screenshot(path=os.path.join(OUT, 'motion_skip_profile_mahalo_390.png'))
    r = p.evaluate(REACH + "('.st-bar [data-stnext]')")
    ok(r['ok'], f'5: its Next is there and tappable ({r})')
    p.locator('.actionbar [data-stnext]').click(); p.wait_for_timeout(900)
    after = p.evaluate("location.hash")
    ok(p.locator('#fx-moment:not([hidden])').count() == 0 and p.evaluate(H1) not in ('Save your profile', 'Mahalo!') and not p.evaluate(ERR)
       and step_of(after) == step_of(before) + 1, f'5: its Next goes on one step, never back to "Save your profile" ({before} -> {after})')
    p.wait_for_timeout(1500)
    ok(p.evaluate(H1) != 'Save your profile' and not p.evaluate(ERR), '5: the skipped screen does not come back afterwards')
    ok(not errs5, f'5: no page errors {errs5[:2]}')
    ctx.close()
    # 5b: left alone, the page stays (R-140, Nate 11 Oct: a page that waits for Next); no moment ever shows
    ctx, p, errs5b = short_visit(br)
    walk_to_profile(p)
    before = p.evaluate("location.hash")
    p.locator('[data-stskip]').first.click(); p.wait_for_selector('.st-thanks #st-h', timeout=4000)
    seen = []
    for _ in range(20): seen.append(p.evaluate(H1)); p.wait_for_timeout(150)
    ok(set(seen) == {'Mahalo!'} and p.evaluate("location.hash") == before and not [e for e in shown_log(p) if e['kind'] == 'shown'],
       f'5: left alone for 3 s the "Mahalo!" page stays, no moment shows, and "Save your profile" never comes back ({sorted(set(seen))})')
    p.locator('.actionbar [data-stnext]').click(); p.wait_for_timeout(900)
    after = p.evaluate("location.hash")
    ok(p.evaluate(H1) != 'Save your profile' and not p.evaluate(ERR) and step_of(after) == step_of(before) + 1,
       f'5: its Next goes on one step ({before} -> {after})')
    ok(not errs5b, f'5: no page errors {errs5b[:2]}')
    ctx.close()
    # ---- 6. the "Mahalo!" page on a phone (375x812), after a confirmed code (R-140, Nate 11 Oct: a page that waits for Next) ----
    def to_code_mahalo(c):
        pg = c.new_page(); e = []; pg.on('pageerror', lambda x: e.append(str(x)))
        pg.goto(BASE + '?demo=1&restart&fv=full'); pg.wait_for_timeout(2500)
        pg.evaluate("localStorage.clear(); sessionStorage.clear()"); pg.reload(); pg.wait_for_timeout(3000)
        pg.locator('[data-stissue]').first.click(); pg.locator('[data-stnext]').click(); pg.wait_for_timeout(1500)
        if pg.locator('[data-stpick][aria-pressed=true]').count() == 0: pg.locator('[data-stpick]').first.click()
        pg.locator('[data-stnext]').click(); pg.wait_for_selector('#st-a-phone', timeout=8000); pg.wait_for_timeout(500)
        # the practice copy has codes on (R-176): a number, then its six digits, which send themselves
        pg.fill('#st-a-phone', '808-555-0123'); pg.locator('#st-send').click(); pg.wait_for_selector('#st-a-code', timeout=8000)
        at = pg.evaluate("location.hash"); pg.type('#st-a-code', '123456'); pg.wait_for_selector('.st-thanks #st-h', timeout=8000)
        return pg, e, at
    ctx = br.new_context(viewport={'width': 375, 'height': 812}, is_mobile=True, has_touch=True, device_scale_factor=2)
    ctx.add_init_script(INIT)
    p, errs6, at = to_code_mahalo(ctx); p.wait_for_timeout(600)
    ok(p.evaluate("document.querySelector('main h1')?.id === 'st-h' && document.querySelector('main h1').innerText") == 'Mahalo!' and p.evaluate("location.hash") == at,
       f'6: after a confirmed code, "Mahalo!" is the page’s h1, at the alerts step’s own address ({at})')
    ok('Text alerts are on for (808) 555-0123.' in p.inner_text('.st-thanks').replace('\xa0', ' ') and p.locator('.st-alertdone [data-stalchange]').count() == 1,
       '6: its card says alerts are on for the number, with "Use a different number"')
    ok(p.title() == 'Mahalo! · HIPHI Bill Tracker', f'6: the tab says "Mahalo! · HIPHI Bill Tracker" ({p.title()!r})')
    ok(p.evaluate("document.activeElement?.id") == 'st-h', f'6: focus is on its heading (the code field it came from is gone) ({p.evaluate("document.activeElement?.id")!r})')
    ok(p.inner_text('.actionbar').strip() == 'Next: How a Bill Becomes Law' and p.locator('.actionbar button').count() == 1, '6: the bar is one button, its Next naming the story (C-6)')
    p.screenshot(path=os.path.join(OUT, 'motion_mahalo_page_375.png'))
    p.wait_for_timeout(3000)
    ok(p.locator('.st-thanks #st-h').count() == 1 and p.evaluate("location.hash") == at and not [e for e in shown_log(p) if e['kind'] == 'shown'],
       '6: still there after 3 s, with no full-screen moment at any point: it waits for Next')
    p.locator('.actionbar [data-stnext]').click()
    try: p.wait_for_function("(document.querySelector('main h1')?.innerText || '') === 'A bill’s story'", timeout=6000)
    except Exception: pass
    ok(p.evaluate("document.querySelector('main h1')?.innerText || ''") == 'A bill’s story' and step_of(p.evaluate("location.hash")) == step_of(at) + 1,
       f'6: Next goes to the story, one step on ({p.evaluate("location.hash")})')
    p.locator('[data-stback]').first.click(); p.wait_for_timeout(1300)
    ok(p.evaluate(H1) == 'Mahalo!' and p.evaluate("location.hash") == at and p.locator('.st-thanks').count() == 1 and p.locator('.st-thanksnew').count() == 0,
       '6: Back from the story comes back to the "Mahalo!" page, the flower not replayed (no .st-thanksnew)')
    ok(not errs6, f'6: no page errors {errs6[:2]}')
    ctx.close()
    # under Reduce Motion: the same page, with nothing animating longer than 0.01 s
    ctx = br.new_context(viewport={'width': 375, 'height': 812}, is_mobile=True, has_touch=True, device_scale_factor=2, reduced_motion='reduce')
    ctx.add_init_script(INIT)
    p, errs6r, at = to_code_mahalo(ctx)
    info = p.evaluate("""(() => { const els = [...document.querySelectorAll('.st-thanks, .st-thanks *')];
      const s = v => Math.max(0, ...String(v).split(',').map(x => parseFloat(x) || 0));
      const long = els.map(e => { const cs = getComputedStyle(e); return { el: e.className?.baseVal ?? e.className, a: s(cs.animationDuration) + s(cs.animationDelay), t: s(cs.transitionDuration) }; })
        .filter(x => x.a > 0.01 || x.t > 0.01);
      return { h: document.getElementById('st-h')?.innerText, n: els.length, long: long.slice(0, 4) }; })()""")
    ok(info['h'] == 'Mahalo!' and info['n'] > 3, f'6 reduced motion: the "Mahalo!" page shows ({info["h"]!r}, {info["n"]} elements)')
    ok(not info['long'], f'6 reduced motion: nothing on it animates longer than 0.01 s ({info["long"]})')
    ok(not errs6r, f'6 reduced motion: no page errors {errs6r[:2]}')
    ctx.close()
    br.close()
print(f"\n{len(passes)} passed, {len(fails)} failed")
sys.exit(1 if fails else 0)
