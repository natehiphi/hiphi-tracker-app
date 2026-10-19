# R-308 (Nate 18 Oct): the rooster's moments on trial on the practice copy, each behind its own switch,
# ?demo=1&fx=<id> (or fx=all). For every moment, at 390x844 (a phone: touch, dpr 2) and 1280x720:
#   - it appears with fx=<id>, and not without it (today's screen), and never without demo=1 (the live site loads nothing)
#   - its words are visible; a full-screen one ends at once on a key; a small one never covers Next or the thing pressed
#   - no sideways scroll, and a first-visit page that must fit (R-265) is no taller than today's
#   - Reduce Motion: the bird is there, still (nothing in it moves: no running transform; the busy dots may fade), and the words are there
#   - no page errors
# and for the full-screen ones and `voice`, on a phone page with the CPU slowed 4x (CDP), the longest gap between frames
# while it moves (target under about 70 ms; no view transition under a cover).
#   python3 tests/celebrations.py [http://localhost:8881/track.html] [--only id,id] [--review DIR] [--video]
# --review writes the evidence for the review page: current.png, new.png, new-1..4.png (and new.webm with --video) per
# moment, and checks.json with the numbers.
import sys, os, json, time, re
from playwright.sync_api import sync_playwright

args = [a for a in sys.argv[1:] if not a.startswith('--')]
def opt(name, default=None):
    for i, a in enumerate(sys.argv):
        if a == name and i + 1 < len(sys.argv): return sys.argv[i + 1]
    return default
BASE = args[0] if args else 'http://localhost:8881/track.html'
ONLY = [x for x in (opt('--only') or '').split(',') if x]
REVIEW = opt('--review')
VIDEO = '--video' in sys.argv
if REVIEW: os.makedirs(REVIEW, exist_ok=True)
passes, fails, info = [], [], {}
def ok(c, m): (passes if c else fails).append(('PASS ' if c else 'FAIL ') + m); print(('PASS ' if c else 'FAIL ') + m, flush=True)

SKIP = "() => { try { for (const x of ['', '_demo']) { localStorage.setItem('hiphi_wiz' + x, JSON.stringify({ done: true, step: 99 })); localStorage.setItem('hiphi_tour_bill' + x, '{\"how\":\"test\"}'); localStorage.setItem('hiphi_tour_home' + x, '{\"how\":\"test\"}'); } } catch {} }"
# Counts view transitions (none may run under a cover) and remembers whether a busy rooster was ever drawn.
WATCH = """(() => { window.__vt = 0; const o = document.startViewTransition; if (o) document.startViewTransition = function (...a) { window.__vt++; return o.apply(this, a); };
  document.addEventListener('DOMContentLoaded', () => new MutationObserver(() => { if (document.querySelector('.ro-busy')) window.__busy = true; }).observe(document.body, { childList: true, subtree: true })); })()"""
FOLLOW = "async () => { const c = await import('./pub/core.js'); for (const a of c.myActions()) c.S.direct.add(a.bill_id); c.recomputeWatch(); c.saveLocal(); }"
LAW = """async () => { const c = await import('./pub/core.js'), acts = c.myActions();
  for (const a of acts) { const b = c.D.bills.find(x => x.id === a.bill_id); if (!b || !/support/.test(b.hiphi_position || '')) continue;
    for (const arr of [c.S.bills, c.D.bills, c.S.featured?.bills, c.S.pool?.bills, c.S.results, c.S.browse?.rows]) { const x = (arr || []).find(y => y.id === b.id); if (x) { x.stage = 'enacted'; x.last_action_date = new Date().toISOString().slice(0, 10); } }
    c.saveLocal(); const k = await import('./pub/kernel.js'); k.app.render(); return b.bill_number; } return null; }"""
REM = """async () => { const c = await import('./pub/core.js'); const b = c.D.bills.find(x => x.bill_number === 'SB3234'); const i = c.issuesOf(b)[0];
  await c.setFollows({ issuesOn: [i.id] }); c.saveLocal(); return i.name; }"""

# The practice copy sends at once, so "Sending…" is never on screen long enough to see; for the pictures only, the busy
# button is drawn with the very markup alerts.js uses (the checks above it use the real send).
STAGE_BUSY = """async () => { const k = await import('./pub/kernel.js'); const b = document.querySelector('#nx-send');
  b.setAttribute('aria-busy', 'true'); b.innerHTML = `${k.fxArt('sending') || k.icon('loader-circle')}<span>Sending…</span>`; }"""
def ready(p, t=60000):
    p.wait_for_function("() => !!document.querySelector('main') && !document.querySelector('.skelpage') && !document.querySelector('.boot-note')", timeout=t)
def url(extra, fx, hash_=''):
    return f"{BASE}?demo=1{extra}{('&fx=' + fx) if fx else ''}{hash_}"

# ---- the first visit (as tests/mahalo_try.py and tests/d1_status.py walk it) ----
def fv_alerts(p, fx, extra='&fv=full&end=today&codes=0'):
    p.goto(url(extra, fx)); p.wait_for_timeout(300)
    p.evaluate('localStorage.clear(); sessionStorage.clear()')
    p.goto(url('&restart' + extra, fx)); p.wait_for_selector('.st-hellopage, .st-tile', timeout=60000)
    if p.locator('.st-hellopage').count(): p.click('[data-stnext]'); p.wait_for_selector('.st-tile', timeout=30000)
    p.wait_for_timeout(500)
    p.locator('.st-tile', has_text='Food').first.click(); p.wait_for_timeout(200)
    p.click('.actionbar [data-stnext]'); p.wait_for_selector('.st2 [data-stpick]', timeout=30000); p.wait_for_timeout(600)
    p.click('.actionbar [data-stnext]'); p.wait_for_selector('#st-aform', timeout=30000); p.wait_for_timeout(600)
def fv_story_last(p, fx):
    fv_alerts(p, fx); p.click('[data-stskip]'); p.wait_for_selector('.lx-count', timeout=15000); p.wait_for_timeout(3000)
    for _ in range(2): p.click('[data-stnext]'); p.wait_for_timeout(1300)
    p.click('.lx-doors [data-lx-pick]'); p.wait_for_timeout(900); p.click('[data-stnext]'); p.wait_for_timeout(1300)
    p.click('.lx-doors [data-lx-pick]'); p.wait_for_timeout(900)
def fv_soon(p, fx):
    fv_story_last(p, fx); p.click('[data-stnext]'); p.wait_for_selector('.st-soonpage', timeout=15000); p.wait_for_timeout(900)

def walk_testimony(p, fx):
    p.goto(url('', fx, '#/bill/HB1780/testify')); ready(p); p.wait_for_selector('#hp-dlg', timeout=15000); p.wait_for_timeout(800)
    dlg = lambda: p.locator('#hp-dlg').inner_text() if p.locator('#hp-dlg').count() else ''
    for _ in range(16):
        if p.locator('#hp-dlg [data-hp="stance"][data-v="support"]').count(): p.locator('#hp-dlg [data-hp="stance"][data-v="support"]').first.click(); p.wait_for_timeout(500); continue
        if p.locator('#hp-name').count() and not p.input_value('#hp-name'): p.fill('#hp-name', 'Leilani Kahale')
        if p.locator('#hp-why').count() and not p.input_value('#hp-why'): p.fill('#hp-why', 'Our keiki deserve clean air.')
        if p.locator('#hp-dlg [data-hp="acct-yes"]').count(): p.locator('#hp-dlg [data-hp="acct-yes"]').click(); p.wait_for_timeout(600); continue
        if 'Send it at the Capitol' in dlg() or 'look for the green box' in dlg(): return   # the next tap is the send
        b = p.locator('#hp-dlg .hp-foot .hp-main')
        if not b.count(): return
        b.first.click(); p.wait_for_timeout(800)
def send_testimony(p): p.locator('#hp-dlg [data-hp="sent"], #hp-dlg [data-hp="confirm"]').first.click()

def home_seed(p, fx, again=True):
    p.goto(url('&seed=1&ab=layout.today', fx, '#/')); ready(p); p.wait_for_timeout(700)
    p.evaluate(FOLLOW)
    if again: p.reload(); ready(p); p.wait_for_timeout(700)   # (good news is seen on the next drawing, so its check reloads itself)
def quiz_to_last(p, fx):
    p.goto(url('', fx, '#/quiz')); ready(p); p.wait_for_timeout(500); p.click('[data-qz=start]'); p.wait_for_timeout(500)
    for k in range(4): p.locator('[data-pick]').first.click(); p.wait_for_timeout(500)
def next_page(p, fx, which):
    p.goto(url('&codes=0', fx, f'#/next/{which}')); ready(p); p.wait_for_timeout(900)
def legs_typed(p, fx):
    next_page(p, fx, 'legs'); box = p.locator('#nx-addr'); box.click(); box.type('415 S Beretania', delay=20); p.wait_for_timeout(1800)
def pick_addr(p):
    pk = p.locator('[data-nxpick]').first; (pk if pk.count() else p.locator('[data-nxtyped]').first).click()
def alerts_typed(p, fx):
    next_page(p, fx, 'alerts'); p.fill('#nx-a-phone', '8085550123')

# Each moment: kind; reach (to just before it, skip init or not); trigger; sel (its rooster); words (said with it, today too
# unless new_words); peak (ms after the trigger when it is at its fullest); next (what it must never cover); fit (a page
# that must not grow); frames (ms of motion to time); end (a full-screen one: the element a key removes).
M = {
  'follow':   dict(kind='full', title='The first follow (the cover)', reach=lambda p, fx: fv_alerts(p, fx), trigger=lambda p: p.click('[data-stskip]'),
                   sel='#st-cover .ro', cur_sel='#st-cover .fx-bloom', words='We’ll watch these with', peak=1050, frames=2600, end='#st-cover', rsel='.st-mhband .ro',
                   stills=[350, 700, 1100, 2300], what='The rooster bobs once in the flower’s place on the full-window cover, then flies into the band at the top of A bill’s story.'),
  'voice':    dict(kind='small', title='End of A bill’s story (R-307)', reach=fv_story_last, trigger=lambda p: p.click('[data-stnext]'),
                   sel='.ro-float .ro', words='Your voice is ready.', new_words=True, peak=330, frames=1400, next='.actionbar [data-stnext]',
                   stills=[100, 250, 450, 650], what='A small burst and the rooster just above Next as the story ends; “Your voice is ready.” as a toast over the next screen.'),
  'sent':     dict(kind='full', title='The first action sent (the thank-you)', reach=lambda p, fx: (p.context.add_init_script(f'({SKIP})()'), walk_testimony(p, fx)), trigger=send_testimony,
                   sel='#hp-dlg .hp-badge .ro', cur_sel='#hp-dlg .hp-badge svg', words='Mahalo', peak=900, frames=2000, wait_sel='#hp-done-t',
                   stills=[200, 500, 900, 1500], what='The rooster hops and flaps at the head of the testimony or email thank-you (1.5 s); the first action’s moment from a bill gets it in place of the flower.'),
  'law':      dict(kind='full', title='A bill becomes law', reach=lambda p, fx: (p.context.add_init_script(f'({SKIP})()'), home_seed(p, fx)), trigger=lambda p: p.evaluate(LAW),
                   sel='#fx-moment .ro', cur_sel='#fx-moment .fx-bloom', words='became law', peak=1000, frames=1900, end='#fx-moment .fx-mcard', pre=400,
                   stills=[500, 800, 1100, 1500], what='The full-screen moment shows the rooster from the lei’s bloom (the last 1.6 s of it) in place of the flower, then folds to the toast as today.'),
  'finale':   dict(kind='full', title='The end of the first visit', reach=fv_soon, trigger=lambda p: p.click('[data-stnext]'),
                   sel='.st-finro .ro', words='You’re all set', peak=2000, frames=3000, fit=True, wait_sel='.st-did',
                   stills=[400, 1000, 1800, 2600], what='The rooster crows in front of the Capitol as the petals fall, inside the drawing’s box, so the page is no taller.'),
  'toast':    dict(kind='small', title='Every yay toast', reach=lambda p, fx: (p.context.add_init_script(f'({SKIP})()'), p.goto(url('', fx, '#/bill/HB2121')), ready(p), p.wait_for_timeout(1200)),
                   trigger=lambda p: p.locator('[data-bl-stance="support"]').first.click(), sel='.toastmsg .ro', cur_sel='.toastmsg.yay svg', words='You now follow', peak=500,
                   stills=[150, 300, 500, 800], what='A small rooster holds still, then bobs once, where the green tick was in every yay toast.'),
  'stance':   dict(kind='small', title='A stance taken on a bill', reach=lambda p, fx: (p.context.add_init_script(f'({SKIP})()'), p.goto(url('', fx, '#/bill/HB2121')), ready(p), p.wait_for_timeout(1200)),
                   trigger=lambda p: p.locator('[data-bl-stance="support"]').first.click(), sel='.ro-float .ro', words='Saved', peak=300, next='[data-bl-stance="support"]',
                   stills=[100, 250, 450, 650], what='The burst and the rooster just above the answer picked.'),
  'found':    dict(kind='small', title='An address found', reach=lambda p, fx: (p.context.add_init_script(f'({SKIP})()'), legs_typed(p, fx)), trigger=pick_addr,
                   sel='.ro-float .ro', words='speak for you', peak=None, next='.actionbar .btn.primary',
                   stills=[100, 250, 450, 650], what='The burst and the rooster above the two legislators found.'),
  'alerts':   dict(kind='small', title='Alerts turned on', reach=lambda p, fx: (p.context.add_init_script(f'({SKIP})()'), alerts_typed(p, fx)), trigger=lambda p: p.click('#nx-send'),
                   sel='.ro-float .ro', words='Mahalo!', peak=None, next='.actionbar .btn.primary',
                   stills=[100, 250, 450, 650], what='The burst and the rooster above the “Mahalo!” heading once the number is in (also More’s alerts row and Home’s ask).'),
  'goodnews': dict(kind='small', title='Good news on Home', reach=lambda p, fx: (p.context.add_init_script(f'({SKIP})()'), home_seed(p, fx, again=False)),
                   trigger=lambda p: (p.reload(), ready(p)), sel='.ro-float .ro', words='Got it', peak=None,
                   stills=[100, 250, 450, 650], what='The rooster beside each new good-news card’s icon as it bursts, once.'),
  'quiz':     dict(kind='small', title='The daily game’s result', reach=lambda p, fx: (p.context.add_init_script(f'({SKIP})()'), quiz_to_last(p, fx)),
                   trigger=lambda p: p.locator('[data-pick]').first.click(), sel='.ro-float .ro', words='Your one step', peak=None,
                   stills=[100, 250, 450, 650], what='The burst and the rooster beside the result’s badge (inside the game, C-7’s exception).'),
  'welcome':  dict(kind='small', title='The first visit’s hello page', reach=lambda p, fx: (p.goto(url('', fx)), p.wait_for_timeout(300), p.evaluate('localStorage.clear(); sessionStorage.clear()')),
                   trigger=lambda p: (p.goto(url('&restart', p.__fx)), p.wait_for_selector('.st-hellopage', timeout=60000)),
                   sel='.st-greet .ro', cur_sel='.st-greet svg', words='Aloha!', peak=1300, next='[data-stnext]', fit=True,
                   stills=[200, 700, 1300, 2200], what='The rooster struts in and waves beside “Aloha!”, in the small flower’s place; the page keeps its height.'),
  'sending':  dict(kind='small', title='Sending… and Saving…', reach=lambda p, fx: (p.context.add_init_script(f'({SKIP})()'), alerts_typed(p, fx)), trigger=lambda p: p.click('#nx-send'),
                   sel='.ro-busy', words='', peak=1200, busy=True, stage=lambda p: p.evaluate(STAGE_BUSY),
                   stills=[150, 450, 750, 1050], what='A tiny pecking rooster in place of the spinner on a busy button, stopped at 5 s.'),
  'error':    dict(kind='small', title='Error cards', reach=lambda p, fx: p.route('**/demo/snapshot.json*', lambda r: r.abort()),
                   trigger=lambda p: (p.goto(url('', p.__fx)), p.wait_for_selector('text=Try again', timeout=30000)), sel='.empty .ro', words='We couldn’t load', peak=900,
                   stills=[200, 500, 900, 1400], what='The rooster tilts its head above the words of an error card (the bills not loading, a bill not found, the issues not loading).'),
  'empty':    dict(kind='small', title='Empty lists', reach=lambda p, fx: p.context.add_init_script(f'({SKIP})()'),
                   trigger=lambda p: (p.goto(url('', p.__fx, '#/find?q=zzzzqq')), ready(p), p.wait_for_selector('text=No bills match', timeout=15000)), sel='.empty .ro', words='No bills match', peak=2000,
                   stills=[500, 1500, 2500, 3500], what='The rooster pecks and looks up once above an empty list, then stands still (A-10’s 5 s).'),
  'reminder': dict(kind='small', title='Testimony due within a day', reach=lambda p, fx: (p.context.add_init_script(f'({SKIP})()'), p.goto(url('&ab=layout.today', fx, '#/')), ready(p), p.wait_for_timeout(800), p.evaluate(REM)),
                   trigger=lambda p: (p.reload(), ready(p)), sel='.acard .due .ro', cur_sel='.acard .due.warn', words='Testimony due', peak=800,
                   stills=[200, 500, 800, 1300], what='The rooster’s chest-puff “ahem” in the clock’s place on the first card due within a day, once.'),
}

# Watches every frame from the page's start: the most roosters seen at once (the moment's own, and any at all), and whether
# one ever overlapped the control it must leave clear. In the page, so a moment of 0.6 s is never missed between steps.
def sampler(sel, nxt):
    return """(() => { const S = %s, N = %s; window.__smp = { has: 0, any: 0, covers: false };
  const tick = () => { const sm = window.__smp, rs = document.querySelectorAll(S); sm.has = Math.max(sm.has, rs.length); sm.any = Math.max(sm.any, document.querySelectorAll('.ro').length);
    if (N && rs.length) { const n = [...document.querySelectorAll(N)].find(e => e.offsetParent); if (n) { const q = n.getBoundingClientRect();
      for (const e of rs) { const z = e.getBoundingClientRect(), k = .12 * z.width;   // the bird sits a little inside its box
        if (z.width && z.left + k < q.right && z.right - k > q.left && z.top + k < q.bottom && z.bottom - k > q.top) { sm.covers = true; sm.at = [z.left, z.top, z.width, q.left, q.top, q.width, q.height].map(Math.round); } } } }
    if (!window.__noSmp) requestAnimationFrame(tick); };
  requestAnimationFrame(tick); })()""" % (json.dumps(sel), json.dumps(nxt or ''))

def ctx_for(b, w, h, reduced=False, video=None, smp=None):
    kw = dict(viewport={'width': w, 'height': h}, is_mobile=w < 600, has_touch=w < 600, device_scale_factor=2 if w < 600 else 1)
    if reduced: kw['reduced_motion'] = 'reduce'
    if video: kw['record_video_dir'] = video; kw['record_video_size'] = {'width': w, 'height': h}
    c = b.new_context(**kw); c.add_init_script(WATCH)
    if smp: c.add_init_script(smp)
    return c

def run_one(b, mid, m, w, h, fx, reduced=False, frames=False, shots=None, video=None):
    """Reach the moment, trigger it, and read what is on screen. Returns a dict of facts."""
    sel0 = m['sel'] if fx else (m.get('cur_sel') or m['sel'])
    if reduced and fx and m.get('rsel'): sel0 = m['rsel']
    c = ctx_for(b, w, h, reduced, video, None if frames else sampler(sel0, m.get('next') if fx else None)); p = c.new_page(); p.set_default_timeout(20000)
    errs = []; p.on('pageerror', lambda e: errs.append(str(e)))
    p.__fx = fx
    r = {'errs': errs}
    try:
        m['reach'](p, fx)
        sh0 = p.evaluate("document.scrollingElement.scrollHeight")
        cdp = None
        if frames:
            cdp = c.new_cdp_session(p); cdp.send('Emulation.setCPUThrottlingRate', {'rate': 4})
            p.evaluate("window.__fr = []; window.__frOn = true; window.__vt0 = window.__vt; (function f(t) { if (!window.__frOn) return; window.__fr.push(t); requestAnimationFrame(f); })(performance.now())")
        if not frames: p.evaluate("window.__busy = false; window.__smp && (window.__smp = { has: 0, any: 0, covers: false })")
        t0 = time.time()
        (m['stage'] if (shots is not None and m.get('stage')) else m['trigger'])(p)
        if m.get('wait_sel'): p.wait_for_selector(m['wait_sel'], timeout=20000)
        if m.get('pre'): p.wait_for_timeout(m['pre'])
        sel = m['sel'] if fx else (m.get('cur_sel') or m['sel'])
        if reduced and m.get('rsel'): sel = m['rsel'] if fx else sel
        # The small ones that come after a lookup: wait for the bird (or for today's screen to settle).
        if m.get('peak') is None:
            if fx:
                try: p.wait_for_selector(m['sel'], timeout=8000, state='attached'); p.wait_for_timeout(150 if reduced else 250)
                except Exception: pass
            else: p.wait_for_timeout(1500)
        stills = []
        if frames:
            p.wait_for_timeout(m.get('frames', 2000))
            fr = p.evaluate("window.__frOn = false; window.__fr")
            gaps = [round(fr[i + 1] - fr[i], 1) for i in range(len(fr) - 1)]
            r['max_frame_ms'] = max(gaps) if gaps else None
            r['frames'] = len(fr); r['vt'] = p.evaluate("window.__vt - (window.__vt0 || 0)")
            cdp.send('Emulation.setCPUThrottlingRate', {'rate': 1})
        else:
            if shots is not None and m.get('stills') and fx:
                # The stills through it, and new.png at its fullest (the peak), in time order.
                plan = sorted([(t, f'new-{k + 1}.png') for k, t in enumerate(m['stills'])] + [(m['peak'] if m['peak'] is not None else 200, 'new.png')])
                last = 0
                for t, name in plan:
                    p.wait_for_timeout(max(0, t - last)); last = max(last, t)
                    p.screenshot(path=os.path.join(shots, name))
                    if name != 'new.png': stills.append(name)
            elif m.get('peak'): p.wait_for_timeout(m['peak'])
        r['stills'] = stills
        smp = p.evaluate("window.__smp || {}") if not frames else {}
        r['has'] = max(p.locator(sel).count(), smp.get('has', 0), 1 if m.get('busy') and fx and p.evaluate("!!window.__busy") else 0)
        r['rooster'] = max(p.locator('.ro').count(), smp.get('any', 0))
        if m.get('next') and fx and not frames: r['covers'] = bool(smp.get('covers')); r['cover_at'] = smp.get('at')
        body = p.evaluate("document.body.innerText").replace(' ', ' ')
        r['words'] = (m['words'].lower() in body.lower()) if m['words'] else True   # innerText follows text-transform
        r['hscroll'] = p.evaluate("document.scrollingElement.scrollWidth > innerWidth + 1")
        r['sh'] = p.evaluate("document.scrollingElement.scrollHeight"); r['ih'] = h
        if reduced and fx:
            r['moving'] = p.evaluate("""s => [...document.querySelectorAll('.ro')].reduce((n, e) => n + e.getAnimations({ subtree: true }).filter(a => a.playState === 'running' && a.effect.getKeyframes().some(k => k.transform && k.transform !== 'none')).length, 0)""", m['sel'])
        if shots is not None:
            if not fx or not m.get('stills'): p.screenshot(path=os.path.join(shots, 'new.png' if fx else 'current.png'))
        if m['kind'] == 'full' and m.get('end') and fx and not reduced and not frames:
            p.keyboard.press('Enter') if mid != 'follow' else p.keyboard.press('Space')
            p.wait_for_timeout(1100)
            r['ended'] = p.evaluate("s => { const e = document.querySelector(s); return !e || !e.offsetParent || e.closest('[hidden]') !== null; }", m['end'])
        r['sh0'] = sh0
    except Exception as e:
        r['stopped'] = str(e).splitlines()[0][:200]
    finally:
        vp = p.video.path() if video and p.video else None
        c.close()
        r['video'] = vp
    return r

with sync_playwright() as pw:
    b = pw.chromium.launch()
    # Never without demo=1: the live page (with fx= in the address) switches nothing on and never asks for the rooster.
    c = ctx_for(b, 390, 844); p = c.new_page(); reqs = []; p.on('request', lambda q: reqs.append(q.url))
    p.goto(BASE + '?fx=all'); p.wait_for_timeout(3500)
    live = p.evaluate("async () => { const f = await import(new URL('pub/fx.js', location.href).href); return Object.fromEntries(" + json.dumps(list(M)) + ".map(k => [k, f.fxOn(k)])); }")
    ok(not any(live.values()) and not any('rooster' in u for u in reqs), f'live site with ?fx=all: nothing on, the rooster never loaded ({sum(live.values())} on)')
    c.close()
    c = ctx_for(b, 390, 844); p = c.new_page(); reqs = []; p.on('request', lambda q: reqs.append(q.url))
    p.goto(BASE + '?demo=1'); ready(p); p.wait_for_timeout(800)
    ok(not any('rooster' in u for u in reqs) and p.locator('.ro').count() == 0, 'practice copy without fx=: the rooster never loaded, none drawn')
    c.close()

    for mid, m in M.items():
        if ONLY and mid not in ONLY: continue
        shots = None
        if REVIEW: shots = os.path.join(REVIEW, mid); os.makedirs(shots, exist_ok=True)
        info[mid] = {}
        for (w, h, tag) in ((390, 844, 'phone'), (1280, 720, 'laptop')):
            new = run_one(b, mid, m, w, h, mid, shots=shots if tag == 'phone' else None)
            cur = run_one(b, mid, m, w, h, '', shots=shots if tag == 'phone' else None)
            if new.get('stopped') or cur.get('stopped'):
                ok(False, f'{mid} {tag}: stopped: new={new.get("stopped")} current={cur.get("stopped")}'); continue
            ok(new['has'] >= 1, f'{mid} {tag}: the rooster appears with fx={mid}')
            ok(cur['rooster'] == 0, f'{mid} {tag}: no rooster without fx= (today’s screen)')
            ok(new['words'], f'{mid} {tag}: its words are visible ({m["words"]!r})')
            if not m.get('new_words'): ok(cur['words'], f'{mid} {tag}: today’s words are there too')
            ok(not new['hscroll'], f'{mid} {tag}: no sideways scroll')
            if 'covers' in new: ok(new['covers'] is False, f'{mid} {tag}: the rooster does not cover {m["next"]} {new.get("cover_at") or ""}')
            if m.get('fit'): ok(new['sh'] <= cur['sh'] + 1, f'{mid} {tag}: the page is no taller than today’s ({new["sh"]} vs {cur["sh"]}; window {h})')
            if 'ended' in new: ok(new['ended'], f'{mid} {tag}: a key ends it at once')
            ok(not new['errs'] and not cur['errs'], f'{mid} {tag}: no page errors {(new["errs"] + cur["errs"])[:2]}')
            info[mid][tag] = {'fits': (not new['hscroll']) and (not m.get('fit') or new['sh'] <= cur['sh'] + 1), 'sh_new': new['sh'], 'sh_cur': cur['sh']}
            if tag == 'phone': info[mid]['stills'] = new['stills']
        # Reduce Motion, on a phone: the bird is there and still, the words are there.
        rd = run_one(b, mid, m, 390, 844, mid, reduced=True)
        if rd.get('stopped'): ok(False, f'{mid} reduced: stopped: {rd["stopped"]}')
        else:
            ok(rd['has'] >= 1 or m.get('busy'), f'{mid} reduced: the rooster is there')
            ok(rd.get('moving', 0) == 0, f'{mid} reduced: nothing in it moves ({rd.get("moving")} running)')
            ok(rd['words'], f'{mid} reduced: the words are there')
            ok(not rd['errs'], f'{mid} reduced: no page errors {rd["errs"][:2]}')
            info[mid]['reduced_ok'] = (rd['has'] >= 1 or bool(m.get('busy'))) and rd.get('moving', 0) == 0 and rd['words']
        # Smoothness: the full-screen ones and voice, phone, CPU 4x slower.
        if m['kind'] == 'full' or mid == 'voice':
            fr = run_one(b, mid, m, 390, 844, mid, frames=True)
            if fr.get('stopped'): ok(False, f'{mid} frames: stopped: {fr["stopped"]}')
            else:
                info[mid]['max_frame_ms'] = fr['max_frame_ms']; info[mid]['vt_under'] = fr['vt']
                print(f'INFO {mid}: longest frame gap {fr["max_frame_ms"]} ms over {fr["frames"]} frames at CPU 4x; view transitions {fr["vt"]}', flush=True)
                ok(fr['max_frame_ms'] is not None and fr['max_frame_ms'] < 100, f'{mid} frames: longest gap {fr["max_frame_ms"]} ms at CPU 4x (target ~70)')
                if mid == 'follow': ok(fr['vt'] == 0, f'{mid}: no view transition under the cover ({fr["vt"]})')
        if REVIEW and VIDEO and m.get('stills'):
            vd = os.path.join(shots, '_v'); os.makedirs(vd, exist_ok=True)
            v = run_one(b, mid, m, 390, 844, mid, video=vd)
            if v.get('video') and os.path.exists(v['video']): os.replace(v['video'], os.path.join(shots, 'new.webm')); info[mid]['video'] = 'new.webm'
            try: os.rmdir(vd)
            except OSError: pass
    b.close()

if REVIEW: json.dump(info, open(os.path.join(REVIEW, 'checks.json'), 'w'), indent=1)
print(f'\n{len(passes)} passed, {len(fails)} failed')
for f in fails: print(f)
sys.exit(1 if fails else 0)
