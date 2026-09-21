# End-to-end checks for the public tracker after the 9/19 follow-ups. python3 journey2.py [base_url]
import json, sys, os, re
from playwright.sync_api import sync_playwright
import checks
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832/track.html'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out', 'final2'); os.makedirs(OUT, exist_ok=True)
snap = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'demo', 'snapshot.json')))
pos = {b['id'] for b in snap['bills'] if b.get('position') and b['position'] != 'monitor'}
FOLLOW = list(dict.fromkeys(h['bill_id'] for h in snap['hearings'] if h['scheduled_at'] > '2026-03-15T00:00:00' and h['bill_id'] in pos))[:6]
WAITING = [b['id'] for b in snap['bills'] if b['bill_number'] in ('HB1563', 'HB1732')]
NONICK = next(b['bill_number'] for b in snap['bills'] if not b.get('nickname') and b.get('is_public') and b.get('tracked'))   # a bill HIPHI only watches has no nickname
VAPE = next(i['id'] for i in snap.get('issues', []) if i['slug'] == 'disposable-vape-ban')   # an issue (063, R-018)
passes, fails, errors = [], [], []
def ok(c, m): (passes if c else fails).append(('PASS ' if c else 'FAIL ') + m)
COMMUNITY = re.compile(r'people have spoken up|HIPHI community|Together, |join the count|actions count|community total', re.I)

def ctx(b, w=390, h=844, **kw):
    c = b.new_context(viewport={'width': w, 'height': h}, is_mobile=w < 600, has_touch=w < 600, device_scale_factor=2 if w < 600 else 1, **kw)
    p = c.new_page(); p.on('pageerror', lambda e: errors.append(f'{w}: {e}'))
    p.on('console', lambda m: errors.append(f'console {w}: {m.text[:140]}') if m.type == 'error' and 'favicon' not in m.text else None)
    return c, p
def fresh(p, extra=''):
    p.goto(BASE + '?demo=1' + extra); p.wait_for_timeout(500); p.evaluate('localStorage.clear(); sessionStorage.clear()')
def follower(p, extra='', more=()):
    p.goto(BASE + '?demo=1' + extra); p.wait_for_timeout(500)
    p.evaluate(f"localStorage.clear(); sessionStorage.clear(); localStorage.setItem('hiphi_watch_ids_demo', JSON.stringify({json.dumps(FOLLOW + list(more))})); localStorage.setItem('hiphi_wiz', JSON.stringify({{step:1,done:true,skipped:true}}))")
def visit(p, h, extra='', wait=2600):
    p.goto(BASE + '?demo=1' + extra + '#' + h.lstrip('#')); p.reload(); p.wait_for_timeout(wait)
def text(p): return p.evaluate("(document.querySelector('main') || document.body).innerText")
def shot(p, name, full=False): p.screenshot(path=f'{OUT}/{name}.png', full_page=full)
def std(p, name, desktop=False, axe=False):
    r = checks.page_report(p, name, do_axe=axe)
    ok(not r['emoji'], f'{name}: no emoji {r["emoji"][:3]}')
    if not desktop: ok(not r['small_targets'], f'{name}: targets >= 44 {r["small_targets"][:3]}')
    allowed = {13, 14, 16, 18, 22, 28} | ({36} if desktop else set())
    extra = [s for s in r['font_sizes'] if round(s) not in allowed]
    ok(not extra, f'{name}: type sizes {r["font_sizes"]}')
    ok(not r['overflow'], f'{name}: no sideways scroll')
    ok(not r['small_inputs'], f'{name}: inputs >= 16px {r["small_inputs"]}')
    if axe: ok(not r.get('axe'), f'{name}: axe {str(r.get("axe"))[:160]}')
    return r

with sync_playwright() as pw:
    b = pw.chromium.launch()
    # ---- 1. the new first visit on a phone: issues -> bills -> where you stand -> email -> calm Home ----
    c, p = ctx(b); fresh(p); p.reload(); p.wait_for_timeout(3000)
    ok(p.evaluate('location.hash') == '#/start/1', 'first visit lands on step 1'); std(p, 'start1', axe=True); shot(p, 'p_s1')
    ok(not COMMUNITY.search(text(p)), 'step 1 has no community-wide totals')
    p.locator('[data-stissue]').first.click(); p.locator('[data-stnext]').click(); p.wait_for_timeout(1500)
    # The flow gained a "narrow it down" screen (9/20) and may gain more, so the walk advances by
    # pressing Next and checks WHAT it is looking at, not which number the step happens to be.
    if p.locator('[data-stsub]').count():
        std(p, 'narrow', axe=True); shot(p, 'p_narrow')
        ok('particular' in text(p).lower(), 'narrow step offers sub-topics')
        p.locator('[data-stnext]').click(); p.wait_for_timeout(1800)
    # Screen 2 offers ISSUES, not bills (R-018): one row per issue, one "Follow all" per category and no overall one
    # (Nate's answer 4), and the button counts issues.
    ok(p.locator('[data-stpick]').count() > 0, f"issues step offers issues ({p.evaluate('location.hash')})"); std(p, 'start2', axe=True); shot(p, 'p_s2')
    t2 = text(p); ok('Relating to' not in t2, 'issues step has no "Relating to" headlines')
    ok(p.locator('[data-stfollowcat]').count() >= 1 and p.locator('[data-stfollowall]').count() == 0, 'one "Follow all" per category, and no overall one')
    lbl = p.inner_text('.st-bar'); ok(re.search(r'Follow \d+ issues?', lbl) is not None, f'the button counts issues ("{lbl.strip()}")')
    p.locator('[data-stnext]').click(); p.wait_for_timeout(1500)
    fi = p.evaluate("JSON.parse(localStorage.getItem('hiphi_issue_follows_demo') || '[]').length + JSON.parse(localStorage.getItem('hiphi_cat_follows_demo') || '[]').length")
    ok(fi >= 1, f'what is saved is issues, not a list of bills ({fi} issue or category follows)')
    ok(re.search(r'where do you stand', text(p), re.I) is not None, f"stance step follows the issues ({p.evaluate('location.hash')})"); std(p, 'start3', axe=True); shot(p, 'p_s3')
    ok(not p.locator('main [data-helper]').count(), 'the stance step pushes no action')
    # Three at most, the rest folded (Nate, 9/20), and one card per idea: a policy carried by two bills was asked twice (R-019).
    shown = p.evaluate("[...document.querySelectorAll('.st-stand')].filter(e => e.offsetParent !== null).length")
    heads = p.evaluate("[...document.querySelectorAll('.st-shead')].map(e => e.textContent.trim())")
    ok(0 < shown <= 3, f'the stance step shows three ideas at most ({shown})')
    ok(len(heads) == len(set(heads)), f'no idea is asked about twice ({heads})')
    chips = p.locator('main button[aria-pressed]'); n0 = chips.count()
    if n0: chips.first.click(); p.wait_for_timeout(400)
    st = p.evaluate("JSON.parse(localStorage.getItem('hiphi_stances_demo') || '{}')"); ok(len(st) >= 1, f'a stance is saved ({st})')
    p.locator('[data-stnext]').click(); p.wait_for_timeout(1200)
    # The explaining screens (9/20): a bill tour, how a bill becomes law, the calendar, what a hearing
    # is, and who speaks for you. Walk them with Next, checking each teaches and asks for nothing.
    teach = []
    for _ in range(8):
        if p.locator('main input[type=email]').count(): break
        teach.append(p.evaluate("document.querySelector('main h1')?.innerText || ''"))
        std(p, f'teach{len(teach)}', axe=True); shot(p, f'p_teach{len(teach)}')
        ok(not p.locator('main [data-helper]').count(), f'teaching screen "{teach[-1]}" pushes no action')
        p.locator('[data-stnext]').click(); p.wait_for_timeout(1500)
    ok(len(teach) == 5, f'five explaining screens between the stance and the email ({teach})')
    ok(p.locator('main input[type=email]').count() == 1, f"the email step follows them ({p.evaluate('location.hash')})"); std(p, 'start4', axe=True); shot(p, 'p_s4')
    # skip the email: skipping the EMAIL must not skip the name step after it
    p.evaluate("(() => { const b=[...document.querySelectorAll('main button, main a')].find(x=>/skip|not now|later/i.test(x.innerText)); b && b.click(); })()"); p.wait_for_timeout(1800)
    ok(p.locator('#st-name').count() == 1, f"skipping the email lands on the name step ({p.evaluate('location.hash')})"); std(p, 'name', axe=True); shot(p, 'p_name')
    p.fill('#st-name', 'Leilani'); p.locator('[data-stnext]').click(); p.wait_for_timeout(1800)
    ok(p.evaluate('location.hash') in ('#/', ''), f"finishing lands on Home ({p.evaluate('location.hash')})"); shot(p, 'p_home_welcome', full=True)
    ok('Leilani' in text(p), 'Home greets them by the name they gave')
    th = text(p); vis_primary = p.evaluate("[...document.querySelectorAll('main .acard .btn.primary')].filter(e=>e.offsetParent!==null).length")
    ok(vis_primary == 0, f'welcome Home pushes no action ({vis_primary} primary action buttons visible)')
    ok(not COMMUNITY.search(th), 'welcome Home has no community-wide totals'); std(p, 'home_welcome', axe=True)
    # Back walks the steps
    c.close()

    # ---- 2. a return visit: the ladder ----
    c, p = ctx(b); follower(p, more=WAITING); visit(p, '/', wait=3200); shot(p, 'p_home_return', full=True)
    first = p.evaluate("document.querySelector('main .acard .btn.primary')?.innerText || ''"); ok('email' in first.lower(), f'newcomer ladder: first card leads with the quick email ("{first}")')
    ok(re.search(r'ask the chair', text(p), re.I) is not None, 'Home offers "Ask the chair for a hearing" for a waiting bill')
    ok(not COMMUNITY.search(text(p)), 'return Home has no community-wide totals'); std(p, 'home_return', axe=True)
    hgt = p.evaluate('document.documentElement.scrollHeight'); ok(hgt <= 2800, f'Home height {hgt}px')
    # after one action, testimony leads
    p.evaluate("localStorage.setItem('hiphi_done_demo', JSON.stringify(['x|y|share'])); localStorage.setItem('hiphi_done_at_demo', JSON.stringify({'x|y|share': new Date().toISOString()}))")
    visit(p, '/', wait=3000); first2 = p.evaluate("document.querySelector('main .acard .btn.primary')?.innerText || ''"); ok('testimony' in first2.lower(), f'after an action, testimony leads ("{first2}")')
    for name, h in (('bills', '/bills'), ('find', '/find'), ('search', '/find?q=vape'), ('bill', '/bill/HB2121'), ('bill_nonick', '/bill/' + NONICK), ('bill_late', '/bill/HB1562'), ('legislators', '/legislators'), ('more', '/more'), ('help', '/help'), ('signin', '/signin'), ('privacy', '/privacy')):
        visit(p, h, wait=2800); std(p, name, axe=name in ('bill', 'find', 'signin')); shot(p, 'p_' + name, full=True)
    visit(p, '/bill/HB2121', wait=2800); tb = text(p)
    ok(re.search(r'where do you stand', tb, re.I) is not None, 'bill page asks where you stand'); ok('Disposable vape ban' in tb, 'bill page leads with the nickname')
    visit(p, '/find?q=vape', wait=2800); ok('Disposable vape ban' in text(p), 'search finds a bill by its nickname')
    visit(p, '/bill/' + NONICK, wait=2800); h1 = p.evaluate("document.querySelector('main h1')?.innerText || ''"); ok(len(h1) > 10, f'a bill without a nickname still has a plain headline ({NONICK}: "{h1[:50]}")')
    visit(p, '/bill/HB1563', wait=2800); ok('Let counties regulate tobacco sales' in text(p), 'an approved nickname from the snapshot leads the bill page (HB 1563)')
    # ---- issues (063, R-018): categories and issues in Find, an issue's page, My issues, and the issue on a bill page ----
    visit(p, '/find', wait=2800); tf = text(p); ok('Food & Nutrition' in tf and 'Getting Around Safely' in tf, 'Find browses the six categories')
    visit(p, '/find/category/food', wait=2800); tc = text(p); std(p, 'category', axe=True); shot(p, 'p_category', full=True)
    ok('Follow all' in tc and p.locator('[data-fdissue]').count() >= 3, f"a category page lists its issues, each with its own Follow ({p.locator('[data-fdissue]').count()})")
    visit(p, '/issue/disposable-vape-ban', wait=3000); ti = text(p); std(p, 'issue', axe=True); shot(p, 'p_issue', full=True)
    h1 = p.evaluate("document.querySelector('main h1')?.innerText || ''")
    ok('vape' in h1.lower() and 'HB 2121' in ti, f'an issue page names the issue and lists its bills ("{h1}")')
    p.locator('[data-fdissue]').first.click(); p.wait_for_timeout(1500)
    ok(VAPE in p.evaluate("JSON.parse(localStorage.getItem('hiphi_issue_follows_demo') || '[]')"), 'following an issue from its page saves the issue')
    visit(p, '/bills', wait=2800); tm = text(p); std(p, 'myissues', axe=True); shot(p, 'p_myissues', full=True)
    ok(p.evaluate("document.querySelector('main h1')?.innerText || ''") == 'My issues' and h1 in tm, 'My issues lists the followed issue')
    visit(p, '/bill/HB2121', wait=2800); ok(re.search(r'Part of', text(p)) is not None and h1 in text(p), 'a bill page names the issue it belongs to')
    visit(p, '/find?q=school%20meals', wait=3200); tq = text(p); ok('free school meals' in tq.lower() and 'Issues' in tq, 'search finds issues by name')
    c.close()

    # ---- 3. desktop is a first-class view ----
    for W, H in ((1440, 900), (1280, 800), (1024, 768)):
        c, p = ctx(b, W, H); follower(p, more=WAITING)
        for name, h in (('home', '/'), ('bills', '/bills'), ('find', '/find'), ('bill', '/bill/HB2121'), ('legislators', '/legislators'), ('more', '/more'), ('help', '/help')):
            visit(p, h, wait=2800); std(p, f'{name}@{W}', desktop=True);
            if W == 1440: shot(p, 'd_' + name)
        if W >= 1100:
            visit(p, '/', wait=2800)
            cols = p.evaluate("(() => { const m=document.querySelector('main'); const kids=[...m.querySelectorAll('.cols > *')].filter(e=>e.offsetParent!==null); if (kids.length<2) return 0; const a=kids[0].getBoundingClientRect(), z=kids[kids.length-1].getBoundingClientRect(); return z.left > a.left + 200 ? 2 : 1 })()")
            ok(cols == 2, f'Home is two columns at {W}')
            used = p.evaluate("(() => { const m=document.querySelector('main').getBoundingClientRect(); return Math.round(m.width) })()"); ok(used >= 1000, f'Home uses the width at {W} ({used}px)')
            wide_btn = p.evaluate("(() => { const b=document.querySelector('main .acard .btn.primary'); if(!b) return 0; return Math.round(b.getBoundingClientRect().width) })()"); ok(0 < wide_btn < 420, f'card buttons are sized to their label at {W} ({wide_btn}px)')
            visit(p, '/bill/HB2121', wait=2800)
            bar = p.evaluate("(() => { const a=document.querySelector('.actionbar'); return a ? getComputedStyle(a).display : 'none' })()"); ok(bar == 'none', f'bill page: no detached bottom bar at {W} ({bar})')
            prim = p.evaluate("[...document.querySelectorAll('main .btn.primary')].filter(e=>e.offsetParent!==null && e.getBoundingClientRect().top < innerHeight).length"); ok(prim >= 1, f'bill page: the main action is visible in place at {W}')
        ok(p.locator('#hq').count() == 1 and p.locator('#hq').is_visible(), f'header search box at {W}')
        fresh(p); p.goto(BASE + '?demo=1#/'); p.reload(); p.wait_for_timeout(2600); std(p, f'start@{W}', desktop=True)
        if W == 1440: shot(p, 'd_start1')
        c.close()

    # ---- 4. small and zoomed ----
    for w, h in ((320, 640), (195, 422)):
        c, p = ctx(b, w, h); follower(p)
        for name, hh in (('home', '/'), ('bill', '/bill/HB2121'), ('find', '/find'), ('bills', '/bills')):
            visit(p, hh, wait=2600); ok(not p.evaluate(checks.OVERFLOW_JS), f'{name} at {w}px: no sideways scroll')
        fresh(p); p.goto(BASE + '?demo=1#/'); p.reload(); p.wait_for_timeout(2600); ok(not p.evaluate(checks.OVERFLOW_JS), f'start at {w}px: no sideways scroll')
        if w == 320: rows = p.evaluate("[...document.querySelectorAll('[data-stissue]')].filter(e=>{const r=e.getBoundingClientRect(); return r.top>=0 && r.bottom<=innerHeight-80}).length"); ok(rows >= 2, f'step 1 at 320px shows {rows} whole issue rows')
        c.close()

    # ---- 5. keyboard: skip link and focus after a redraw ----
    c, p = ctx(b, 1280, 800); follower(p); visit(p, '/', wait=2800)
    p.evaluate("document.querySelector('[data-skip]').focus()"); p.keyboard.press('Enter'); p.wait_for_timeout(200)
    ok(p.evaluate('location.hash') in ('#/', '') and p.evaluate('document.activeElement.id') == 'main', 'Skip to content focuses the page and stays on it')
    p.evaluate("(() => { const m=document.querySelector('[data-moreways]'); m.focus(); m.click(); })()"); p.wait_for_timeout(300)
    ok(p.evaluate("!!document.activeElement.getAttribute('data-moreways')"), 'focus stays on "More ways to help" after it opens')
    c.close()

    # ---- 6. reduced motion, network failure, off-season ----
    c, p = ctx(b, reduced_motion='reduce'); fresh(p); p.reload(); p.wait_for_timeout(2500)
    ok(p.evaluate("document.getAnimations().filter(a=>a.playState==='running' && a.effect && a.effect.getTiming().iterations===Infinity).length") == 0, 'reduced motion: nothing animates forever'); c.close()
    c, p = ctx(b); p.route('**/demo/snapshot.json*', lambda r: r.abort()); p.goto(BASE + '?demo=1'); p.wait_for_timeout(3000)
    ok('Try again' in p.evaluate('document.body.innerText'), 'blocked data shows Try again'); c.close()
    c, p = ctx(b); fresh(p, '&season=off'); p.goto(BASE + '?demo=1&season=off#/'); p.reload(); p.wait_for_timeout(3000); t = text(p); shot(p, 'p_off_s1')
    ok('January 20' in t and not COMMUNITY.search(t), 'off-season step 1: January 20, no community totals')
    # The between-sessions walk, pressing Next the whole way (R-019: Next went nowhere on the live site, every topic
    # said "0 bills", the recap found nothing, and Home asked for the issues again - and nothing here pressed Next).
    counts = re.findall(r'\d+ issues? in 20\d\d', t)[:3]
    ok(re.search(r'(?<!\d)0 (bills|issues) in', t) is None and re.search(r'[1-9]\d* issues? in 20\d\d', t) is not None, f"off-season categories count last session's issues ({counts})")
    p.locator('[data-stissue]').first.click(); p.locator('[data-stnext]').click(); p.wait_for_timeout(2500); t = text(p); shot(p, 'p_off_recap')
    ok(p.evaluate('location.hash') == '#/start/2' and 'Your issues' in t, f"off-season Next goes to the issues ({p.evaluate('location.hash')})")
    ok(re.search(r'[1-9]\d* issues? HIPHI worked on in 20\d\d', t) is not None, 'the issues screen finds last session\u2019s issues')
    p.locator('[data-stnext]').click(); p.wait_for_timeout(1800)
    ok(p.locator('main input[type=email]').count() == 1, f"its Next follows them and goes on to the email ask ({p.evaluate('location.hash')})")
    p.locator('[data-stskip]').click(); p.wait_for_timeout(1500); p.locator('[data-stnext]').click(); p.wait_for_timeout(3000); t = text(p)
    ok('Your issues' in t and 'Pick a few health issues' not in t, 'off-season Home names the issues just picked and does not ask again')
    for extra in ('', '&season=off'):
        fresh(p, extra); p.reload(); p.wait_for_timeout(3000); p.locator('[data-stskip]').click(); p.wait_for_timeout(2000)
        ok(not p.evaluate('location.hash').startswith('#/start'), f"Skip with nothing picked leaves the start{' (off-season)' if extra else ''} ({p.evaluate('location.hash')})")
    follower(p, '&season=off'); visit(p, '/', '&season=off', 3200); t = text(p); shot(p, 'p_off_home', full=True)
    ok("didn't act" not in t and 'didn’t act' not in t, 'off-season Home does not scold'); ok(not COMMUNITY.search(t), 'off-season Home has no community totals')
    ok(len(p.evaluate("[...document.querySelectorAll('main input[type=email]')].filter(e=>e.offsetParent!==null)")) <= 1, 'off-season Home asks for an email at most once'); std(p, 'off_home', axe=True)
    c, p2 = ctx(b, 1440, 900); follower(p2, '&season=off'); visit(p2, '/', '&season=off', 3200); shot(p2, 'd_off_home'); std(p2, 'off_home@1440', desktop=True)
    c.close(); b.close()

print('\n'.join(fails)); print(f'{len(fails)} failed, {len(passes)} passed'); print('errors:', errors[:10])
