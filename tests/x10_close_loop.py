# After a first action, end on the success and close the loop on Home (X10-2), and clear the way for someone who came to
# act (X10-4); R-180 wave 1, in the sandbox (Mon 16 Mar 2026, 9:00). Phone 390x844 and laptop 1366x900.
#   python3 tests/x10_close_loop.py [base]     base defaults to http://localhost:8832/track.html
# Checks:
#  1. A newcomer on a shared bill sends testimony: the Mahalo's undo says "Stop following <the issue>", right under the
#     sentence that says it is followed (not under "I plan to go"); Done goes to Home, not into the first visit's story;
#     the first visit is finished; Home leads with "You sent testimony on <bill>", the bill's number, when the committee
#     hears it and its video, and offers the story in one quiet line; the story, opened from there, does not say "We'll
#     show you how" of what they did; its Done comes back to Home, and the line is gone.
#  2. Hearing day: Home says "today" (the row at the top, and the issue's chip says Today, never the weekday), with the
#     live video; once the committee's decision is in, the row goes and the decision shows instead.
#  3. The bill tour: not by itself after a finished first visit, nor on a bill opened from Home to act; the quiet line
#     "New to this? Take the tour" starts it, and goes once it is seen. Someone who skipped the first visit still gets it.
#  4. More's first row is named for alerts. No page errors, no sideways scroll.
import os, sys, json
from playwright.sync_api import sync_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832/track.html'
PUB = BASE + '?demo=1'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'tests', 'out', 'x10_close_loop'); os.makedirs(OUT, exist_ok=True)
snap = json.load(open(os.path.join(ROOT, 'demo', 'snapshot.json')))
B = next(b for b in snap['bills'] if b['bill_number'] == 'HB2121')            # Disposable e-cigarette ban, heard Fri 20 Mar 9:30
ISSUE = next(i['id'] for i in snap['issues'] if i['slug'] == 'disposable-e-cigarette-ban')
res = []
def ok(c, m): res.append(bool(c)); print('PASS' if c else 'FAIL', m)
def ready(p): p.wait_for_function("() => !!document.querySelector('main') && !document.querySelector('.skelpage') && !document.querySelector('.bl-skel')", timeout=60000); p.wait_for_timeout(600)
def txt(p, sel):
    loc = p.locator(sel)
    return loc.first.inner_text() if loc.count() else ''
click = lambda sel, rx: f"""(()=>{{const e=[...document.querySelectorAll({json.dumps(sel)})].filter(x=>x.offsetParent!==null).find(x=>/{rx}/i.test((x.innerText||'').trim())); if(!e)return false; e.click(); return true;}})()"""
# One tap copies the letter and opens the Capitol page in a new tab; coming back to this tab asks about the green box.
LEAVE_AND_RETURN = """(()=>{const b=[...document.querySelectorAll('#hp-dlg button')].find(x=>/Copy my letter and open/.test(x.innerText)); if(!b) return false;
  window.open=()=>null; b.click();
  Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>'hidden'}); document.dispatchEvent(new Event('visibilitychange'));
  Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>'visible'}); document.dispatchEvent(new Event('visibilitychange')); return true;})()"""
# Written before the page's own code runs, so under both names: the sandbox reads its _demo copy (core.js's storage shim).
WIZ = lambda w: f"() => {{ try {{ for (const x of ['', '_demo']) localStorage.setItem('hiphi_wiz' + x, JSON.stringify({w})); }} catch {{}} }}"
TOUR_HOME_SEEN = "() => { try { for (const x of ['', '_demo']) localStorage.setItem('hiphi_tour_home' + x, '1'); } catch {} }"
# A hearing of HB 2121 later today (the sandbox's clock is Monday 9:00), its testimony sent, the issue followed.
TODAY = """async ([bid, iss]) => { const c = await import('./pub/core.js');
  const x = c.D.hearings.find(h => h.bill_id === bid && h.status === 'scheduled');
  c.D.hearings.push({ ...x, id: 'x10-today', scheduled_at: new Date(Date.now() + 2 * 36e5).toISOString(),
    testimony_deadline: new Date(Date.now() - 22 * 36e5).toISOString(), notice_posted_at: new Date(Date.now() - 3 * 864e5).toISOString() });
  await c.setFollows({ issuesOn: [iss] }); await c.loadBills(); await c.markDone(bid, 'x10-today', 'testimony', true, { quiet: true }); }"""

def run(br, w, h, tag):
    errs = []
    def context(init=None):
        c = br.new_context(viewport={'width': w, 'height': h}, is_mobile=w < 600, has_touch=w < 600, device_scale_factor=2 if w < 600 else 1)
        for s in init or []: c.add_init_script(f'({s})()')
        p = c.new_page(); p.on('pageerror', lambda e: errs.append(str(e))); return c, p

    # ---- 1. a newcomer from a shared link sends testimony, then Done ----
    c, p = context()
    p.goto(PUB + '&restart&via=share#/bill/HB2121'); ready(p)
    ok(p.locator('.bl-newbie').count() == 1, f'{tag}: a newcomer on a shared bill gets the "New here?" card')
    for s in (click('.btn', 'Write my testimony'), click('#hp-dlg button', 'I support it'), click('#hp-dlg button', '^Next')):
        p.evaluate(s); p.wait_for_timeout(900)
    p.fill('#hp-name', 'Kai Ho'); p.wait_for_timeout(200)
    if p.locator('#hp-why').count(): p.fill('#hp-why', 'I care about keiki health.')
    for s in (click('#hp-dlg button', 'See my letter'), click('#hp-dlg button', '^Next'), click('#hp-dlg button', 'Yes, I have an account'), LEAVE_AND_RETURN, click('#hp-dlg button', 'Yes, I saw the green box')):
        p.evaluate(s); p.wait_for_timeout(1100)
    nx = txt(p, '#hp-dlg .hp-next')
    ok('Stop following Disposable e-cigarette ban' in nx and 'Don’t follow it' not in nx, f'{tag}: the Mahalo says "Stop following Disposable e-cigarette ban", not "Don\'t follow it" (X10-4)')
    order = p.evaluate("(() => { const n = document.querySelector('#hp-dlg .hp-next'); const u = n && n.querySelector('.hp-unf'), g = n && n.querySelector('[data-hp=going]'), t = n && n.querySelector('p');"
                       " return !!u && !!g && !!(u.compareDocumentPosition(g) & 4) && !!(t.compareDocumentPosition(u) & 4) && /We now follow/.test(t.innerText); })()")
    ok(order, f'{tag}: it sits right under "We now follow ..." and above "Going to the hearing in person?"')
    p.screenshot(path=f'{OUT}/{tag}-1-mahalo.png')
    # R-205 C4: while the profile ask waits, its "Not now" is in the bar; then the share card, and Done beside it.
    if p.locator('#hp-dlg .hp-foot [data-hp="ngno"]').count(): p.locator('#hp-dlg .hp-foot [data-hp="ngno"]').click(); p.wait_for_timeout(700)
    p.evaluate(click('#hp-dlg .hp-foot button', '^Done$')); p.wait_for_timeout(2500)
    ok(p.evaluate('location.hash') == '#/', f"{tag}: Done goes to Home, not into the first visit's story ({p.evaluate('location.hash')})")
    w8 = p.evaluate("JSON.parse(localStorage.getItem('hiphi_wiz') || '{}')")
    ok(w8.get('done') is True and w8.get('viaActed') is True, f'{tag}: the first visit counts as finished ({ {k: w8.get(k) for k in ("done", "viaActed", "viaHome")} })')
    loop = txt(p, '.hm-loop')
    ok('You sent testimony on Disposable e-cigarette ban' in loop and 'HB 2121' in loop and 'The committee hears it Fri at 9:30 AM' in loop, f'{tag}: Home leads with what they did and when the committee hears it ({loop[:140]!r})')
    top = p.evaluate("(() => { const l = document.querySelector('.hm-loop'), c = document.querySelector('.hm-todo, .hm-nextup'); return l && c ? l.getBoundingClientRect().top < c.getBoundingClientRect().top : false; })()")
    ok(top, f'{tag}: it comes before "What happens next" and the things to do')
    wl = p.locator('.hm-loop .hm-loopx a')
    ok(wl.count() == 1 and wl.get_attribute('target') == '_blank' and 'Watch it live' in wl.inner_text(), f'{tag}: with the hearing\'s video, in a new tab')
    ok(p.locator('.hm-main .acard .btn.primary').count() == 0, f'{tag}: nothing else is pushed: the things to do this week are shown, calm, no button singled out (R-190)')
    lk = p.locator('.hm-looplearn a[data-hm-learn]')
    ok(lk.count() == 1 and lk.get_attribute('href') == f"#/learn/story/{B['id']}" and 'New to this?' in txt(p, '.hm-looplearn'), f'{tag}: the story of the bill is one quiet line: "New to this? See how a bill becomes law"')
    ok(not p.evaluate('document.documentElement.scrollWidth > window.innerWidth'), f'{tag}: no sideways scroll on Home')
    p.screenshot(path=f'{OUT}/{tag}-2-home.png', full_page=True)
    had = lk.count() == 1
    if had: lk.click()
    else: p.goto(PUB + f"#/learn/story/{B['id']}")   # (only so an older page still walks on to the next checks)
    p.wait_for_timeout(2500)
    ok(had and p.evaluate("document.querySelector('main h1')?.innerText || ''") == 'A bill’s story' and 'HB 2121' in txt(p, 'main').replace('\xa0', ' '), f'{tag}: the line opens the story of HB 2121')
    for _ in range(2): p.locator('[data-stlearnnext]').click(); p.wait_for_timeout(1400)
    calm = txt(p, '.lx-calm')
    ok('You already sent your note' in calm and 'show you how' not in calm, f'{tag}: its last page does not offer to show them how to do what they did ({calm!r})')
    p.screenshot(path=f'{OUT}/{tag}-3-story-end.png')
    p.locator('[data-stlearnnext]').click(); p.wait_for_timeout(2200)
    ok(p.evaluate('location.hash') == '#/' and p.locator('.hm-looplearn').count() == 0 and p.locator('.hm-loop').count() == 1, f"{tag}: Done comes back to Home, and the line has gone ({p.evaluate('location.hash')})")
    c.close()

    # ---- 2. hearing day ----
    for fin in (True, False):
        c, p = context([WIZ("{ done: true, step: 99 }"), TOUR_HOME_SEEN])
        p.goto(PUB + '#/'); ready(p)
        p.evaluate(TODAY, [B['id'], ISSUE])
        if fin: p.evaluate("() => { const w = JSON.parse(localStorage.getItem('hiphi_wiz') || '{}'); localStorage.setItem('hiphi_wiz', JSON.stringify({ ...w, finale: true, name: 'Kai' })); sessionStorage.setItem('hiphi_welcome', '1'); }")
        p.goto(PUB + '#/more'); ready(p); p.goto(PUB + '#/'); p.wait_for_timeout(1800)
        who = 'after the first visit' if fin else 'a later visit'
        loop = txt(p, '.hm-loop')
        ok('You sent testimony on Disposable e-cigarette ban' in loop and 'hears it today at 11:00 AM' in loop and 'Mon' not in loop, f'{tag}, {who}: on the hearing day Home says "today" ({loop[:120]!r})')
        ok('Watch it live' in txt(p, '.hm-loop .hm-loopx'), f'{tag}, {who}: with the live video')
        if fin:
            chips = p.evaluate("[...document.querySelectorAll('.hm-yours .chip')].map(x => x.innerText.trim())")
            ok('Today' in chips and 'Mon' not in chips, f'{tag}: the issue\'s chip says Today, not the weekday ({chips})')
            ok(p.locator('.hm-week').count() == 0 or 'HB 2121 has a hearing today' not in txt(p, '.hm-week'), f'{tag}: "This week" does not offer help with the hearing they already spoke at')
            p.screenshot(path=f'{OUT}/{tag}-4-hearing-day.png', full_page=False)
        else:
            nxt = txt(p, '.hm-since')
            ok('hearing today' not in nxt, f'{tag}: "Since you were here" does not say the hearing again ({nxt[:100]!r})')
            ok('Disposable e-cigarette ban' not in txt(p, '.hm-panel .hm-imps'), f'{tag}: nor does "What happened after you acted" (A-14)')
            # The decision comes in: the row goes, and the decision shows where results do.
            p.evaluate("async () => { const c = await import('./pub/core.js'); c.S.outcomes['x10-today'] = { hearing_id: 'x10-today', outcome: 'passed', reported_at: new Date().toISOString() }; c.app.render(); }")
            p.wait_for_timeout(1200)
            ok(p.locator('.hm-loop').count() == 0, f'{tag}: once the committee has decided, the row goes')
            ok('You testified, and' in txt(p, 'main') and 'passed it' in txt(p, 'main'), f'{tag}: and the decision shows instead ("You testified, and ... passed it")')
        c.close()

    # ---- 3. the bill tour ----
    c, p = context([WIZ("{ step: 1, done: true }")])
    p.goto(PUB + '#/bill/HB2121'); ready(p); p.wait_for_timeout(2200)
    ok(p.locator('.tr-tip').count() == 0, f'{tag}: after a finished first visit the bill tour does not start by itself')
    ok(p.locator('.bl-tourline [data-bl-billtour]').count() == 1 and 'New to this?' in txt(p, '.bl-tourline'), f'{tag}: the quiet line "New to this? Take the tour" offers it')
    p.screenshot(path=f'{OUT}/{tag}-5-bill-line.png')
    if p.locator('[data-bl-billtour]').count(): p.locator('[data-bl-billtour]').click(); p.wait_for_timeout(1000)
    ok('Tip 1 of 4' in txt(p, '.tr-tip'), f'{tag}: the line starts the tips')   # four since R-205's Share tip
    if p.locator('[data-tr-skip]').count(): p.locator('[data-tr-skip]').click(); p.wait_for_timeout(500)
    ok(p.locator('.tr-tip').count() == 0 and p.locator('[data-bl-billtour]').count() == 0, f'{tag}: skipped, the tips and the line are gone')
    p.reload(); ready(p); p.wait_for_timeout(1500)
    ok(p.locator('.tr-tip').count() == 0 and p.locator('[data-bl-billtour]').count() == 0, f'{tag}: and stay gone')
    c.close()
    # From Home to act, with a first visit skipped (which on its own still gets the tour): "Ask the chair for a hearing".
    c, p = context([WIZ("{ step: 1, done: true, skipped: true }"), TOUR_HOME_SEEN])
    p.goto(PUB + '#/'); ready(p)
    p.evaluate("async iss => { const c = await import('./pub/core.js'); await c.setFollows({ issuesOn: [iss] }); }", ISSUE)
    p.goto(PUB + '#/more'); ready(p); p.goto(PUB + '#/'); p.wait_for_timeout(1800)
    ask = p.locator('.hm-ask a[data-hm-act]')
    ok(ask.count() >= 1, f'{tag}: Home has a bill to act on ("Ask the chair for a hearing")')
    if ask.count():
        ask.first.click(); p.wait_for_timeout(3200)
        ok(p.evaluate('location.hash').startswith('#/bill/') and p.locator('.tr-tip').count() == 0 and p.locator('[data-bl-billtour]').count() == 1, f"{tag}: opened from Home to act, the bill page shows no tour, only the line ({p.evaluate('location.hash')})")
    p.goto(PUB + '#/bill/HB1563'); p.reload(); ready(p); p.wait_for_timeout(2200)
    ok(p.locator('.tr-tip').count() == 1, f'{tag}: someone who skipped the first visit still gets the tour on a bill opened on its own')
    c.close()

    # ---- 4. More ----
    c, p = context([WIZ("{ step: 1, done: true }")])
    p.goto(PUB + '#/more'); ready(p)
    me = txt(p, 'a.mr-me')
    ok('Get alerts and make your profile' in me and 'A text or email when your issues have a hearing' in me, f'{tag}: More\'s first row is named for alerts ({me[:80]!r})')
    p.screenshot(path=f'{OUT}/{tag}-6-more.png')
    c.close()
    ok(not errs, f'{tag}: no page errors ' + '; '.join(errs[:3]))

with sync_playwright() as pw:
    br = pw.chromium.launch()
    run(br, 390, 844, 'phone')
    run(br, 1366, 900, 'laptop')
    br.close()
print(f'{sum(res)}/{len(res)} passed'); sys.exit(0 if all(res) else 1)
