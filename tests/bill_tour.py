# The bill page tour (R-062 Concept 2, pub/tour.js): three tips the first time anyone opens a bill page, then never
# again. python3 tests/bill_tour.py [base_url]   (sandbox; a phone at 390x844 and a laptop at 1440x900)
# Checks: the first bill page shows tip 1 as a labelled dialog with focus in it; Next, Next, Done ends it; a reload or
# another bill does not bring it back; Skip and Esc end it too; the page underneath takes no taps on tips 1-2; tip 3
# lights the real main button, and using it ends the tour and does what it says; a stopped bill between sessions points
# tip 3 at Follow; not on the first visit (#/start) and not while the "New here?" card is up, but after "Just looking";
# the tip stays inside the window; reduced motion; no console errors.
import json, os, sys
from playwright.sync_api import sync_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832/track.html'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out', 'bill_tour'); os.makedirs(OUT, exist_ok=True)
snap = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'demo', 'snapshot.json')))
NONICK = next(b['bill_number'] for b in snap['bills'] if not b.get('nickname') and b.get('is_public') and b.get('tracked'))
passes, fails, errors = [], [], []
def ok(c, m): (passes if c else fails).append(('PASS ' if c else 'FAIL ') + m)
PAST_START = "localStorage.setItem('hiphi_wiz', JSON.stringify({step:1,done:true,skipped:true}))"

def ctx(b, w=390, h=844, **kw):
    c = b.new_context(viewport={'width': w, 'height': h}, is_mobile=w < 600, has_touch=w < 600, device_scale_factor=2 if w < 600 else 1, **kw)
    p = c.new_page(); p.on('pageerror', lambda e: errors.append(f'{w}: {e}'))
    p.on('console', lambda m: errors.append(f'console {w}: {m.text[:140]}') if m.type == 'error' and 'favicon' not in m.text else None)
    return c, p
def fresh(p, extra='', returning=True):
    p.goto(BASE + '?demo=1' + extra); p.wait_for_timeout(400)
    p.evaluate('localStorage.clear(); sessionStorage.clear()' + ('; ' + PAST_START if returning else ''))
def visit(p, h, extra='', wait=2600):
    p.goto(BASE + '?demo=1' + extra + '#' + h.lstrip('#')); p.reload(); p.wait_for_timeout(wait)
def tip(p, timeout=5000):
    try: p.wait_for_selector('.tr-tip', timeout=timeout); return True
    except Exception: return False
def tipstate(p):
    return p.evaluate("""() => { const t = document.querySelector('.tr-tip'); if (!t) return null; const r = t.getBoundingClientRect();
      const h = document.querySelector('.tr-hole').getBoundingClientRect(), a = document.activeElement;
      return { text: t.innerText, role: t.getAttribute('role'), label: document.getElementById(t.getAttribute('aria-labelledby'))?.textContent || '',
        focusIn: t.contains(a), inert: !!document.getElementById('app').inert, top: r.top, bottom: r.bottom, left: r.left, right: r.right,
        vw: innerWidth, vh: innerHeight, hole: [h.top, h.left, h.bottom, h.right] }; }""")
def seen(p): return p.evaluate("localStorage.getItem('hiphi_tour_bill')") is not None   # the sandbox reads its _demo copy
def inside(s): return s and s['top'] >= 0 and s['left'] >= 0 and s['bottom'] <= s['vh'] + 1 and s['right'] <= s['vw'] + 1
def covers(hole, sel, p):
    r = p.evaluate(f"(() => {{ const e = [...document.querySelectorAll({json.dumps(sel)})].find(x => x.getBoundingClientRect().height > 0); if (!e) return null; const r = e.getBoundingClientRect(); return [r.top, r.left, r.bottom, r.right]; }})()")
    return bool(r) and hole[0] <= r[0] + 1 and hole[1] <= r[1] + 1 and hole[2] >= r[2] - 1 and hole[3] >= r[3] - 1

with sync_playwright() as pw:
    b = pw.chromium.launch()
    for w, h, tag in [(390, 844, 'phone'), (1440, 900, 'laptop')]:
        # 1. The whole tour on a bill with a hearing: Next, Next, Done
        c, p = ctx(b, w, h); fresh(p); visit(p, '/bill/HB2121')
        ok(tip(p), f'{tag}: the first bill page shows the tour')
        s = tipstate(p)
        ok(s and s['role'] == 'dialog' and s['label'] == 'What this bill is', f'{tag}: tip 1 is a dialog labelled "What this bill is" ({s and s["label"]})')
        ok(s and 'Tip 1 of 4' in s['text'] and 'HB 2121' in s['text'] and 'HIPHI' in s['text'], f'{tag}: tip 1 says 1 of 4, the number and HIPHI')
        ok(s and s['focusIn'], f'{tag}: focus moves into the tip')
        ok(s and s['inert'], f'{tag}: the page underneath is out of reach on tip 1')
        ok(inside(s), f'{tag}: tip 1 sits inside the window')
        ok(s and covers(s['hole'], '.bl-head h1', p), f'{tag}: tip 1 lights the bill\'s name')
        p.screenshot(path=f'{OUT}/{tag}-tip1.png')
        # a tap on the page underneath does nothing (the Back button, top left)
        hb = p.evaluate("location.hash"); back = p.locator('[data-bl-back]').bounding_box()
        if back: p.mouse.click(back['x'] + back['width'] / 2, back['y'] + back['height'] / 2); p.wait_for_timeout(400)
        ok(p.evaluate("location.hash") == hb and p.locator('.tr-tip').count() == 1, f'{tag}: a tap on the page under tip 1 is caught')
        # Tab stays in the tip
        for _ in range(4): p.keyboard.press('Tab')
        ok(p.evaluate("document.querySelector('.tr-tip').contains(document.activeElement)"), f'{tag}: Tab stays inside the tip')
        p.locator('[data-tr-next]').click(); p.wait_for_timeout(500); s = tipstate(p)
        ok(s and 'Tip 2 of 4' in s['text'] and s['label'] == 'Where it is now', f'{tag}: Next shows tip 2, where it is now')
        ok(s and covers(s['hole'], '.bl-status', p), f'{tag}: tip 2 lights the status card')
        ok(inside(s), f'{tag}: tip 2 sits inside the window')
        ok(s and 'Senate committees' in s['text'], f'{tag}: tip 2 names where the bill is now')
        p.screenshot(path=f'{OUT}/{tag}-tip2.png')
        # Tip 3 (R-205 C6): Share, on the button itself, in the top bar.
        p.locator('[data-tr-next]').click(); p.wait_for_timeout(500); s = tipstate(p)
        ok(s and 'Tip 3 of 4' in s['text'] and s['label'] == 'Ask a friend' and covers(s['hole'], '.bl-sharebtn', p), f'{tag}: tip 3 lights Share and says what it does')
        ok(inside(s), f'{tag}: tip 3 sits inside the window')
        p.locator('[data-tr-next]').click(); p.wait_for_timeout(500); s = tipstate(p)
        ok(s and 'Tip 4 of 4' in s['text'] and 'Write my testimony' in s['text'] and 'real' in s['text'], f'{tag}: tip 4 names the real button')
        ok(s and not s['inert'], f'{tag}: on tip 4 the page is reachable (its button is the point)')
        btn_sel = '.actionbar .btn.primary' if w < 600 else '.bl-side .btn.primary'
        ok(s and covers(s['hole'], btn_sel, p), f'{tag}: tip 4 lights the main button')
        if w >= 600: ok(s and covers(s['hole'], '.bl-side .bl-act', p), f'{tag}: on a laptop tip 4 lights the side panel\'s action card')
        ok(inside(s), f'{tag}: tip 4 sits inside the window')
        ok(p.locator('[data-tr-skip]').count() == 0 and p.locator('[data-tr-next]').inner_text().strip() == 'Done', f'{tag}: the last tip ends with Done')
        p.screenshot(path=f'{OUT}/{tag}-tip4.png')
        p.locator('[data-tr-next]').click(); p.wait_for_timeout(400)
        ok(p.locator('.tr, .tr-tip').count() == 0, f'{tag}: Done ends the tour')
        ok(seen(p), f'{tag}: Done is remembered')
        ok(not p.evaluate("document.getElementById('app').inert"), f'{tag}: the page is usable again')
        ok(p.evaluate("document.activeElement !== document.body && document.getElementById('app').contains(document.activeElement)"), f'{tag}: focus goes back to the page')
        visit(p, '/bill/HB2121'); ok(not tip(p, 1800), f'{tag}: a reload does not show it again')
        visit(p, '/bill/HB1075'); ok(not tip(p, 1800), f'{tag}: another bill does not show it again')
        c.close()

        # 2. Skip
        c, p = ctx(b, w, h); fresh(p); visit(p, '/bill/HB2121'); tip(p)
        p.locator('[data-tr-skip]').click(); p.wait_for_timeout(400)
        ok(p.locator('.tr-tip').count() == 0 and seen(p), f'{tag}: Skip ends the tour and is remembered')
        visit(p, '/bill/HB2121'); ok(not tip(p, 1800), f'{tag}: after Skip it does not come back')
        c.close()

        # 3. Esc, from tip 2
        c, p = ctx(b, w, h); fresh(p); visit(p, '/bill/HB2121'); tip(p)
        p.locator('[data-tr-next]').click(); p.wait_for_timeout(300); p.keyboard.press('Escape'); p.wait_for_timeout(400)
        ok(p.locator('.tr-tip').count() == 0 and seen(p), f'{tag}: Esc ends the tour and is remembered')
        ok(p.evaluate("location.hash").startswith('#/bill/HB2121'), f'{tag}: Esc stays on the bill')
        c.close()

        # 4. The lit button is real: using it ends the tour and opens the testimony walkthrough
        c, p = ctx(b, w, h); fresh(p); visit(p, '/bill/HB2121'); tip(p)
        for _ in range(3): p.locator('[data-tr-next]').click(); p.wait_for_timeout(400)   # past the Share tip (R-205) to the button's
        p.locator(btn_sel).first.click(); p.wait_for_timeout(1200)
        ok(p.locator('.tr-tip').count() == 0 and seen(p), f'{tag}: using the lit button ends the tour')
        ok(p.evaluate("!!document.querySelector('#hp-dlg[open]')"), f'{tag}: and the button does what it says (the testimony walkthrough opens)')
        c.close()

        # 5. A stopped bill between sessions: the last tip points at Follow (tip 3 is Share since R-205)
        c, p = ctx(b, w, h); fresh(p, '&season=off'); visit(p, '/bill/HB1075', '&season=off')
        ok(tip(p), f'{tag}: a stopped bill between sessions shows the tour')
        p.locator('[data-tr-next]').click(); p.wait_for_timeout(300); s = tipstate(p)
        ok(s and 'Stopped' in s['text'], f'{tag}: tip 2 says where it stopped')
        p.locator('[data-tr-next]').click(); p.wait_for_timeout(500); s = tipstate(p)
        ok(s and s['label'] == 'Ask a friend', f'{tag}: tip 3 is Share')
        p.locator('[data-tr-next]').click(); p.wait_for_timeout(500); s = tipstate(p)
        ok(s and 'Follow' in s['text'] and 'Write my testimony' not in s['text'], f'{tag}: tip 4 on a stopped bill is about following')
        ok(s and covers(s['hole'], '[data-bl-followissue], [data-bl-star]', p), f'{tag}: tip 4 lights the Follow button')
        ok(inside(s), f'{tag}: the Follow tip sits inside the window')
        p.screenshot(path=f'{OUT}/{tag}-stopped-tip3.png')
        # following from the lit button works and ends the tour
        fb = p.locator('[data-bl-followissue], [data-bl-star]').first; fb.click(); p.wait_for_timeout(900)
        ok(p.locator('.tr-tip').count() == 0 and seen(p), f'{tag}: pressing the lit Follow ends the tour')
        ok(p.evaluate("JSON.parse(localStorage.getItem('hiphi_issue_follows') || '[]').length + JSON.parse(localStorage.getItem('hiphi_watch_ids') || '[]').length") > 0, f'{tag}: and it follows')
        c.close()

    # 6. Never during the first visit, and never over the "New here?" card
    c, p = ctx(b); fresh(p, returning=False); visit(p, '/start/1', wait=3000)
    ok(not tip(p, 1500), 'phone: no tour on the first visit (#/start)')
    visit(p, '/bill/HB2121', wait=3000)
    ok(p.locator('.bl-newbie').count() == 1, 'phone: a newcomer on a shared bill gets the "New here?" card')
    ok(not tip(p, 1500), 'phone: no tour while the "New here?" card is up')
    p.locator('[data-bl-newlater]').first.click()
    # R-114 (10/1): someone who arrived on a shared link is never interrupted by the tour; one quiet line offers it.
    ok(not tip(p, 2500) and 'Take the 2-minute tour' in p.locator('main').inner_text(), 'phone: after "Just looking" no tour starts by itself; the quiet line offers it')
    ok(p.locator('.bl-newbie').count() == 0, 'phone: the card is gone after "Just looking"')
    c.close()
    c, p = ctx(b, 1440, 900); fresh(p, returning=False); visit(p, '/bill/HB2121', wait=3000)
    ok(p.locator('.bl-newbie').count() == 1 and not tip(p, 1500), 'laptop: no tour while the "New here?" card is up')
    c.close()

    # 7. A bill without an everyday name, and reduced motion
    c, p = ctx(b, reduced_motion='reduce'); fresh(p); visit(p, '/bill/' + NONICK)
    ok(tip(p), f'phone: a bill without a nickname ({NONICK}) shows the tour')
    s = tipstate(p); ok(s and 'words at the top' in s['text'], 'phone: tip 1 on a bill without a name says the words at the top say what it does')
    ok(p.evaluate("document.querySelector('.tr').classList.contains('tr-still')"), 'phone: reduced motion is respected')
    p.screenshot(path=f'{OUT}/phone-noname-tip1.png')
    c.close()
    b.close()

ok(not errors, f'no console errors {errors[:4]}')
print('\n'.join(passes + fails))
print(f'\n{len(passes)} passed, {len(fails)} failed')
sys.exit(1 if fails else 0)
