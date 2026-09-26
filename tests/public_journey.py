# End-to-end checks for the public tracker (9/19 follow-ups; the first visit rebuilt 9/21, R-023). python3 tests/public_journey.py [base_url]
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
    # ---- 1. the first visit on a phone (R-023, rebuilt 9/21; R-039 and R-053, 9/26): topics -> issues (the Mahalo moment) ->
    # three lessons (the "Now you know" moment) -> who speaks for you -> coming up, THEN the ask -> you're all set -> Home ----
    c, p = ctx(b); fresh(p); p.reload(); p.wait_for_timeout(3000)
    ok(p.evaluate('location.hash') == '#/start/1', 'first visit lands on step 1'); std(p, 'start1', axe=True); shot(p, 'p_s1')
    ok(not COMMUNITY.search(text(p)), 'step 1 has no community-wide totals')
    # Three named parts and no counting, no bar (Nate 9/21), and they are not controls (A-12).
    parts = p.evaluate("[...document.querySelectorAll('.st-chapters li')].map(li => li.textContent.replace(/\\(done\\)/, '').trim())")
    ok(parts == ['Your issues', 'How it works', 'Stay connected'], f'the three named parts ({parts})')
    ok(p.evaluate("document.querySelector('.st-chapters li[aria-current=step]')?.textContent.trim()") == 'Your issues', 'step 1 is in "Your issues"')
    ok(p.locator('[role=progressbar], progress').count() == 0 and not re.search(r'step \d+ of \d+', text(p), re.I), 'no progress bar and no "Step N of M"')
    ok(p.locator('.st-chapters button, .st-chapters a').count() == 0, 'the named parts are a signpost, not buttons')
    ok(p.locator('[data-stissue]').count() == 6 and 'About 4 minutes' in text(p), 'six category tiles, and an honest time promise')
    p.locator('[data-stissue]').first.click(); p.locator('[data-stnext]').click(); p.wait_for_timeout(1800)
    # Screen 2 offers ISSUES, not bills (R-018): the four most important first, then three more per category, and nothing
    # else (R-039, Nate 9/22: the list was way too long).
    ok(p.locator('[data-stpick]').count() > 0, f"issues step offers issues ({p.evaluate('location.hash')})"); std(p, 'start2', axe=True); shot(p, 'p_s2')
    t2 = text(p); ok('Relating to' not in t2, 'issues step has no "Relating to" headlines')
    ok(p.locator('[data-stfollowcat]').count() >= 1 and p.locator('[data-stfollowall]').count() == 0, 'one "Follow all" per category, and no overall one')
    lbl = p.inner_text('.st-bar'); ok(re.search(r'Follow \d+ issues?', lbl) is not None, f'the button counts issues ("{lbl.strip()}")')
    top = p.locator('.st-topsec .st-pcard').count()
    ok(1 <= top <= 4 and 'Most important' in p.inner_text('.st-topsec h2'), f'the four most important issues come first ({top})')
    vis = p.evaluate("[...document.querySelectorAll('[data-stsec]')].map(d => d.querySelectorAll('.st-pcard').length)")
    ok(all(n <= 3 for n in vis), f'then three more per category at most ({vis})')
    ids = p.evaluate("[...document.querySelectorAll('[data-stpick]')].map(e => e.dataset.stpick)")
    ok(len(ids) == len(set(ids)), 'no issue is shown twice')
    ok(p.locator('[data-stmore]').count() == 0 and p.locator('.st-pcard[hidden]').count() == 0, 'no "Show more", nothing hidden')
    ticked_below = p.evaluate("[...document.querySelectorAll('[data-stsec] [data-stpick][aria-pressed=true]')].length")
    ok(ticked_below == 0 and p.locator('.st-topsec [data-stpick][aria-pressed=true]').count() >= 1, 'only the top issues start ticked (B-12)')
    p.locator('[data-stnext]').click(); p.wait_for_timeout(1500)
    # The first success: a moment that fills the screen and waits for Continue (C-7, WCAG 2.2.1).
    ok(p.locator('#fx-moment:not([hidden]) [role=dialog]').count() == 1 and 'Mahalo' in p.inner_text('#fx-moment'), 'following shows the "Mahalo!" moment')
    std(p, 'moment_follow', axe=True); shot(p, 'p_moment')
    p.wait_for_timeout(2500); ok(p.locator('#fx-moment:not([hidden])').count() == 1, 'the moment waits for Continue')
    p.locator('#fx-mgo').click(); p.wait_for_timeout(1500)
    fi = p.evaluate("JSON.parse(localStorage.getItem('hiphi_issue_follows_demo') || '[]').length + JSON.parse(localStorage.getItem('hiphi_cat_follows_demo') || '[]').length")
    ok(fi >= 1, f'what is saved is issues, not a list of bills ({fi} issue or category follows)')
    # "Where do you stand?" left the first visit (R-053, 9/26): the answer changed nothing the person saw next (C-13).
    # The bill page asks it instead (checked below). After "Mahalo!" comes the first lesson.
    ok(re.search(r'where do you stand', text(p), re.I) is None and p.locator('[data-ststance]').count() == 0, f"no stance screen after the issues ({p.evaluate('location.hash')})")
    ok(p.evaluate("document.querySelector('main h1')?.innerText || ''") == 'Reading a bill', 'the first lesson comes straight after "Mahalo!"')
    # How it works: three lessons, every word visible (C-12), stepped through with the primary button.
    seen = []
    for _ in range(24):
        h1 = p.evaluate("document.querySelector('main h1')?.innerText || ''")
        if h1 not in seen:
            seen.append(h1); std(p, f'lesson{len(seen)}', axe=True); shot(p, f'p_lesson{len(seen)}')
            ok(p.locator('main details:not([open]), main [role=tab]').count() == 0, f'"{h1}" hides nothing behind a tap (C-12)')
            if h1 in ('Reading a bill', 'The session, January to May', 'What a hearing is'):
                ok(p.evaluate("document.querySelector('.st-chapters li[aria-current=step]')?.textContent.trim()") == 'How it works', f'"{h1}" is in "How it works"')
        if 'Who speaks for you' in h1: break
        p.locator('[data-stnext]').click(); p.wait_for_timeout(1400)
        if p.locator('#fx-moment:not([hidden])').count():
            ok('how it works' in p.inner_text('#fx-moment').lower(), 'finishing the lessons shows the "Now you know how it works" moment')
            std(p, 'moment_learned', axe=True); p.locator('#fx-mgo').click(); p.wait_for_timeout(1500)
    ok(seen[:3] == ['Reading a bill', 'The session, January to May', 'What a hearing is'], f'three lessons, in order ({seen[:3]})')
    # Stay connected: a street address only; nothing is pushed before one is found.
    ok('Who speaks for you' in seen and p.locator('#st-addr').count() == 1 and p.locator('#st-town').count() == 0, 'who speaks for you asks for a street address only')
    ok(p.locator('.actionbar .btn.primary').count() == 0 and p.locator('[data-stskip]').count() == 1, 'before an address there is only Skip')
    std(p, 'you', axe=True); shot(p, 'p_you')
    p.locator('[data-stskip]').click(); p.wait_for_timeout(1500)
    # The value first, then the one ask (Nate 9/21: ask for the email after the value).
    ts = text(p); ok('Coming up on your issues' in ts, f"then coming up on your issues ({p.evaluate('location.hash')})")
    order = p.evaluate("(() => { const l = document.querySelector('.st-soon'), f = document.querySelector('#st-eform'); return !!l && !!f && (l.compareDocumentPosition(f) & Node.DOCUMENT_POSITION_FOLLOWING) ? 1 : 0; })()")
    ok(order == 1 and p.locator('.st-soon li').count() >= 1, 'what is coming up comes before the ask')
    ok('testimony is due' in ts.lower() and 'closes' not in ts.lower(), 'the ask names the value, and testimony is "due", never "closes"')
    std(p, 'soon', axe=True); shot(p, 'p_soon')
    p.fill('#st-email', 'leilani@example.com'); p.fill('#st-name', 'Leilani'); p.locator('#st-send').click(); p.wait_for_timeout(1200)
    ok('Check your inbox' in text(p), 'the ask says to check the inbox'); std(p, 'soon_sent', axe=True)
    p.locator('[data-stnext]').click(); p.wait_for_timeout(3200)
    # The peak: what they did, then what happens next; nothing asks for anything (Nate 9/21: end on a high).
    td = text(p); ok('You’re all set, Leilani!' in td and 'What happens next' in td, f"the last screen celebrates what they did ({p.evaluate('location.hash')})")
    ok(p.locator('.st-did li').count() >= 3 and p.locator('main input').count() == 0, 'the recap lists what they did, and asks for nothing')
    ok(p.evaluate("document.querySelectorAll('.st-chapters li.done').length") == 3, 'all three parts are ticked')
    std(p, 'done', axe=True); shot(p, 'p_done', full=True)
    p.locator('[data-stdone]').click(); p.wait_for_timeout(2500)
    ok(p.evaluate('location.hash') in ('#/', ''), f"finishing lands on Home ({p.evaluate('location.hash')})"); shot(p, 'p_home_welcome', full=True)
    th = text(p); ok('Aloha, Leilani' in th and 'What happens next' not in th, 'Home greets them by name and does not repeat "What happens next" (A-14)')
    vis_primary = p.evaluate("[...document.querySelectorAll('main .acard .btn.primary')].filter(e=>e.offsetParent!==null).length")
    ok(vis_primary == 0, f'welcome Home pushes no action ({vis_primary} primary action buttons visible)')
    ok(not COMMUNITY.search(th), 'welcome Home has no community-wide totals'); std(p, 'home_welcome', axe=True)
    c.close()

    # ---- 1b. a shared bill (R-023 decision 7): the easiest action first, "Follow this issue" second ----
    c, p = ctx(b); fresh(p); visit(p, '/bill/HB2121', wait=3000)
    ok(p.locator('.bl-newbie').count() == 1 and 'New here?' in text(p), 'a newcomer on a shared bill gets the "New here?" card')
    ok('email' in p.inner_text('.actionbar').lower(), 'the easiest action leads (the quick email)')
    ok(p.get_by_role('button', name='Follow this issue', exact=True).count() == 1 and 'instead' not in text(p), '"Follow this issue" once, without "instead"')
    std(p, 'arrive', axe=True); shot(p, 'p_arrive')
    ok(p.locator('.actionbar [data-bl-newlater]').count() == 1, '"Not now" sits beside the action it turns down')
    p.locator('.actionbar [data-bl-newlater]').click(); p.wait_for_timeout(2000)
    ok(p.evaluate("document.querySelector('main h1')?.innerText || ''") == 'Reading a bill' and 'HB 2121' in text(p).replace('\xa0', ' '), f"Not now goes straight on to the lessons, on the bill they opened ({p.evaluate('location.hash')})")
    fresh(p); visit(p, '/bill/HB2121', wait=3000); p.locator('[data-bl-newfollow]').click(); p.wait_for_timeout(1500)
    ok(p.locator('#fx-moment:not([hidden])').count() == 1 and 'Disposable vape ban' in p.inner_text('#fx-moment'), '"Follow this issue" gets the Mahalo moment')
    p.locator('#fx-mgo').click(); p.wait_for_timeout(2000)
    ok(p.evaluate("document.querySelector('main h1')?.innerText || ''") == 'Reading a bill', 'following from the card goes on to the lessons, without asking again')
    std(p, 'link_lesson', axe=True)
    fresh(p); p.evaluate("localStorage.setItem('hiphi_wiz', JSON.stringify({step:1, via:'HB2121', issues:[]}))"); visit(p, '/start/1', wait=3000)
    ok('Want us to tell you next time?' in text(p), 'after a quick email, "Want us to tell you next time?" asks about following'); std(p, 'followask', axe=True)
    c.close()
    c, p = ctx(b, 1440, 900); fresh(p); visit(p, '/bill/HB2121', wait=3000)
    top = p.evaluate("(() => { const b = [...document.querySelectorAll('main .btn.primary')].find(x => /email/i.test(x.innerText)); return b ? Math.round(b.getBoundingClientRect().top) : -1; })()")
    ok(0 < top < 700, f'on a laptop the quick email is in view at the top, beside the bill ({top}px)'); shot(p, 'd_arrive')
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
    # ---- "Your issues" with three categories (R-039): every category starts open, one ticked in the top group is named
    # on its category's line, and "Follow N issues" counts exactly the ticks on screen (R-023's review, 9/21) ----
    fresh(p); p.reload(); p.wait_for_timeout(2500)
    for name in ('Food', 'Tobacco', 'Family'):
        p.evaluate(f"[...document.querySelectorAll('.st-issue')].find(x => /{name}/.test(x.innerText))?.click()"); p.wait_for_timeout(150)
    p.locator('[data-stnext]').click(); p.wait_for_timeout(2200)
    secs = p.evaluate("[...document.querySelectorAll('[data-stsec]')].map(d => ({ open: d.open, line: d.querySelector('[data-stpicked]').hidden ? '' : d.querySelector('[data-stpicked]').textContent, n: d.querySelectorAll('[data-stpick][aria-pressed=true]').length }))")
    ok(secs and all(x['open'] for x in secs), f'every category starts open ({secs})')
    named = p.evaluate("[...document.querySelectorAll('.st-topsec [data-stpick][aria-pressed=true]')].map(b => [b.dataset.stcat, b.querySelector('.st-phead').textContent])")
    lines = p.evaluate("Object.fromEntries([...document.querySelectorAll('[data-stsec]')].map(d => [d.dataset.stsec, d.querySelector('[data-stpicked]').textContent]))")
    shown_n = p.locator('[data-stpick][aria-pressed=true]').count()
    ok(shown_n >= 1 and f"Follow {shown_n} issue" in p.inner_text('.st-bar'), f'the button counts exactly the ticks on screen ({shown_n})')
    ok(any(nm in ' '.join(lines.values()) for _, nm in named), f'a category line names its issue ticked in the top group ({named}, {lines})')
    order = p.evaluate("[...document.querySelectorAll('[data-stsec]')].map(d => d.dataset.stsec)")
    ok(len(order) == 3, f'three categories, most important first ({order})')
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
    counts = re.findall(r'\d+ (?:issues?|wins?) in 20\d\d', t)[:3]
    ok(re.search(r'(?<!\d)0 (bills|issues|wins) in', t) is None and re.search(r'[1-9]\d* (?:issues?|wins?) in 20\d\d', t) is not None, f"off-season categories count last session's issues and wins ({counts})")
    p.locator('[data-stissue]').first.click(); p.locator('[data-stnext]').click(); p.wait_for_timeout(2500); t = text(p); shot(p, 'p_off_recap')
    ok(p.evaluate('location.hash') == '#/start/2' and 'Your issues' in t, f"off-season Next goes to the issues ({p.evaluate('location.hash')})")
    ok(re.search(r'HIPHI worked on in 20\d\d', t) is not None and p.locator('[data-stpick]').count() > 0, 'the issues screen finds last session\u2019s issues')
    p.locator('[data-stnext]').click(); p.wait_for_timeout(1500)
    if p.locator('#fx-mgo').count(): p.locator('#fx-mgo').click(); p.wait_for_timeout(1500)
    for _ in range(24):
        if p.locator('main input[type=email]').count(): break
        if p.locator('#fx-mgo').count(): p.locator('#fx-mgo').click(); p.wait_for_timeout(1200); continue
        (p.locator('[data-stnext]') if p.locator('[data-stnext]').count() else p.locator('[data-stskip]')).first.click(); p.wait_for_timeout(1300)
    ok(p.locator('main input[type=email]').count() == 1 and 'start moving' in text(p), f"between sessions the lessons lead on to the ask, in off-season words ({p.evaluate('location.hash')})")
    p.locator('[data-stskip]').click(); p.wait_for_timeout(2600); p.locator('[data-stdone]').click(); p.wait_for_timeout(3000); t = text(p)
    ok('Your issues' in t and 'Pick a few health issues' not in t, 'off-season Home names the issues just picked and does not ask again')
    for extra in ('', '&season=off'):
        fresh(p, extra); p.goto(BASE + '?demo=1' + extra + '#/start/1'); p.reload(); p.wait_for_timeout(3000); p.locator('[data-stskip]').click(); p.wait_for_timeout(2000)
        ok(p.evaluate("document.querySelector('main h1')?.innerText || ''") == 'Reading a bill', f"Skip with nothing picked goes on to the lessons, never back to the start{' (off-season)' if extra else ''} ({p.evaluate('location.hash')})")
    follower(p, '&season=off'); visit(p, '/', '&season=off', 3200); t = text(p); shot(p, 'p_off_home', full=True)
    ok("didn't act" not in t and 'didn’t act' not in t, 'off-season Home does not scold'); ok(not COMMUNITY.search(t), 'off-season Home has no community totals')
    ok(len(p.evaluate("[...document.querySelectorAll('main input[type=email]')].filter(e=>e.offsetParent!==null)")) <= 1, 'off-season Home asks for an email at most once'); std(p, 'off_home', axe=True)
    c, p2 = ctx(b, 1440, 900); follower(p2, '&season=off'); visit(p2, '/', '&season=off', 3200); shot(p2, 'd_off_home'); std(p2, 'off_home@1440', desktop=True)
    c.close(); b.close()

print('\n'.join(fails)); print(f'{len(fails)} failed, {len(passes)} passed'); print('errors:', errors[:10])
