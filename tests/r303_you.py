# You and the pages under it in the calm redesign (R-303), everyone's since 19 Oct (Nate).
#   python3 tests/r303_you.py [base] [--shots DIR]
# base: a served copy (http://localhost:8832); without one this file's own folder is served from disk (no server needed).
# --shots DIR also writes a phone and a laptop picture of every page it checks.
# As none (a first-time visitor), Kai and Leilani (the practice copy's sample people) and Kai with a text number (signed up),
# at 390x844 and 1440x900:
#   You (#/more): h1 "You"; the profile card, then the rows (Your lawmakers, Your alerts only when signed up, Your session,
#     Help), then the quiet footer links (About HIPHI, Privacy and accessibility, the practice copy, Send my issues to a friend); Every bill and Committees
#     are gone from it; the event staff posted is its own row (Nate 18 Oct, card 11), not inside About HIPHI; at most one
#     filled button; under 1,050px tall on a phone (900 before the event row);
#   - Help's seven groups each with its icon (card 15); the old #/alerts (?rec=0) says what really comes, in the Text terms page's
#     words (Nate 18 Oct, "match reality"): when your voice matters most, usually a few texts a month and never more than
#     one a day, each issue's level and where to change it; never a text for every hearing (card 21, then his ask).
#   Profile: its first row is Your alerts; no "Your issues" or Alerts section; "Make your profile" without one.
#   Your alerts: where texts and email go, a switch per followed issue that saves at once, "Stop texts to this phone" once and the closed "Not your phone? Stop texts to another number" fold, the live
#     consent's words (a few texts a month), never "At most one text a day".
#   Sign in: "Sign in with your email" without a profile, "Add your email" with one.
#   Help: the Public Access Room right under the search, the seven groups closed with no counts, no "Reading a bill"; a
#     conversation has one way back, "Help", on Help's left edge on a laptop.
#   Privacy: "In short" open, every other section a closed card, Accessibility second, every word of the old page (?rec=0) there.
#   The later-visit ask: the "Welcome back" icon has a gap before its words (a live fix).
# With ?rec=0 (the way back since the redesign became everyone's, R-303) each page is still the old one. Home's Your issues is
# in the white box with ?rec=1 (Nate 18 Oct, "I'll go with the box for the home page"), its slide's row lit pale blue and each
# day kept on one line with its time at 360px; the old Home (?rec=0) has no box. The seven other lists are in the white box with ?rec=1 too (Nate 18 Oct, "Box all seven"): You's rows, Help's
# lessons and Email HIPHI, Your lawmakers, a lawmaker's On your issues, a committee's bills, the issue page's Bills on this
# issue and its one record row; a day and its time stay on one line in them; no list in the redesign is left on the grey.
import sys, os, re
from urllib.parse import urlparse, unquote
from playwright.sync_api import sync_playwright

args = [a for a in sys.argv[1:]]
SHOTS = ''
if '--shots' in args: i = args.index('--shots'); SHOTS = args[i + 1]; del args[i:i + 2]
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
LOCAL = not args
BASE = 'http://wt.local' if LOCAL else args[0].rstrip('/').replace('/track.html', '')
if SHOTS: os.makedirs(SHOTS, exist_ok=True)
ok_n = fail_n = 0
def check(cond, what):
    global ok_n, fail_n
    if cond: ok_n += 1; print('PASS', what)
    else: fail_n += 1; print('FAIL', what)

KAI = ['66a32660-b0a7-4a90-a71f-231963619b44', '1dcec7ca-ed94-4a19-9c9c-235514ca7491', '2616613e-a363-418b-ae19-4add60957cd8']
LEILANI = ['e336663a-0a6b-4dd2-a313-8f6ba0de2d10', '312680f6-e284-4321-8a07-3ee624a0af24', '3699b13d-3466-426d-a2eb-88d20db60c12', '8b1a1b4d-0699-4d8a-970e-4c4ff8d84a1f',
  'a26e0f87-9d98-4b8e-a326-517f0ec6aa7f', '257867b0-ada6-476b-8eaa-a4914e52da1c', '1dcec7ca-ed94-4a19-9c9c-235514ca7491', '2616613e-a363-418b-ae19-4add60957cd8',
  '5f4c4ec6-252a-429f-b22b-aab91cd0889a', 'b636541e-aef7-46e8-8a99-fb4b0cf38b50', 'a8690eec-3d30-4c19-9e15-ce5157c6b950', 'fb5e85b5-bf05-4164-8fba-a4f161f7ba83',
  'de0916f3-e8c6-4f1d-8f08-f106f6d4e3ae', '66a32660-b0a7-4a90-a71f-231963619b44', 'cca05b80-ed45-467b-a019-2bbc4cb289ee', '48742bb7-36d9-4b50-aae2-d19eaf0c872c']
WHO = {'none': None, 'kai': ('Kai', KAI, False), 'leilani': ('Leilani', LEILANI, False), 'kai+number': ('Kai', KAI, True)}

def init(who):
    p = WHO[who]
    if not p: return "(() => { if (sessionStorage.getItem('__set')) return; sessionStorage.setItem('__set', '1'); for (const k of Object.keys(localStorage)) if (k.startsWith('hiphi_')) localStorage.removeItem(k); })()"
    name, issues, num = p
    text = "set('hiphi_text', { token: 'demo-token', phone: '8085550123', at: '2026-03-10T09:00:00-10:00', confirmed: true });" if num else ''
    return f"""(() => {{ if (sessionStorage.getItem('__set')) return; sessionStorage.setItem('__set', '1');
      for (const k of Object.keys(localStorage)) if (k.startsWith('hiphi_')) localStorage.removeItem(k);
      const set = (k, v) => localStorage.setItem(k + '_demo', typeof v === 'string' ? v : JSON.stringify(v));
      set('hiphi_issue_follows', {issues!r}); set('hiphi_watch_ids', []); set('hiphi_cat_follows', []); set('hiphi_skips', []);
      set('hiphi_wiz', {{ done: true, issues: ['tobacco'], name: '{name}' }}); set('hiphi_onb', {{ lastVisit: '2026-03-15T19:00:00-10:00' }});
      set('hiphi_done', []); set('hiphi_done_at', {{}}); set('hiphi_stances', {{}}); set('hiphi_demo_seeded', '0');
      set('hiphi_tour_home', {{ how: 'test' }}); set('hiphi_tour_bill', {{ how: 'test' }}); {text}
    }})()"""

def serve(route, request=None):
    f = os.path.join(ROOT, unquote(urlparse(route.request.url).path).lstrip('/'))
    if os.path.isdir(f): f = os.path.join(f, 'index.html')
    route.fulfill(path=f) if os.path.isfile(f) else route.fulfill(status=404, body='not found')

def ready(pg, sel):
    try: pg.wait_for_selector(sel, timeout=40000)
    except Exception: pass
    pg.wait_for_timeout(700)

def open_page(pg, hash_, rec=True, sel='#main .rc-h1, #main h1'):
    pg.goto(f"{BASE}/track.html?demo=1{'&rec=1' if rec else '&rec=0'}{hash_}"); ready(pg, sel)

def shot(pg, tag, name, full=True):
    if SHOTS: pg.screenshot(path=os.path.join(SHOTS, f'{tag}_{name}.png'), full_page=full)

H = lambda pg: pg.evaluate('document.documentElement.scrollHeight')
WIDE = lambda pg: pg.evaluate('document.documentElement.scrollWidth > innerWidth + 1')
TEXT = lambda pg: pg.evaluate("document.querySelector('#main').innerText")
FILLED = lambda pg: pg.evaluate("[...document.querySelectorAll('#main .btn.primary')].filter(b => b.offsetParent).length")
ORDER = """sels => { const els = sels.map(s => document.querySelector(s)); if (els.some(e => !e)) return 'missing ' + sels.filter((s, i) => !els[i]).join(' ');
  for (let i = 1; i < els.length; i++) if (els[i - 1].compareDocumentPosition(els[i]) & Node.DOCUMENT_POSITION_PRECEDING) return 'out of order at ' + sels[i];
  return 'ok'; }"""

def main():
    with sync_playwright() as p:
        br = p.chromium.launch()
        for w, h, tag in [(390, 844, 'phone'), (1440, 900, 'laptop')]:
            for who in WHO:
                ctx = br.new_context(viewport={'width': w, 'height': h})
                ctx.add_init_script(init(who))
                if LOCAL: ctx.route('http://wt.local/**', serve)
                pg = ctx.new_page(); errs = []
                pg.on('pageerror', lambda e: errs.append(str(e)))
                signed = who == 'kai+number'; follows = who != 'none'; t = f'{tag} {who}'
                # ---- You ----
                open_page(pg, '#/more', sel='#main .yu-you')
                check(pg.evaluate("document.querySelector('#main h1')?.innerText") == 'You', f'{t}: You is headed "You"')
                check(pg.evaluate(ORDER, ['#main .rc-head', '#main .yu-me', '#main .yu-rows', '#main .yu-foot']) == 'ok', f'{t}: the profile card, then the rows, then the footer links')
                rows = pg.evaluate("[...document.querySelectorAll('#main .yu-rows .rc-rname')].map(e => e.innerText)")
                want = ['Your lawmakers'] + (['Your alerts'] if signed else []) + ['Your session', 'Help', 'Meet HIPHI at the Keiki Health Fair (sample)']   # the sandbox's sample event, last
                check(rows == want, f'{t}: the rows are {want} ({rows})')
                txt = TEXT(pg)
                check('Every bill HIPHI tracks' not in txt and 'Committees' not in txt, f'{t}: Every bill and Committees have left You')
                foot = pg.evaluate("[...document.querySelectorAll('#main .yu-foot .yu-fl')].map(e => e.innerText.trim())")
                check(foot == ['About HIPHI', 'Privacy and accessibility', 'For advocacy groups', 'Leave the practice copy' if '?demo' in pg.url else 'Practice on the 2026 bills'] + (['Send my issues to a friend'] if follows else []), f'{t}: the footer links ({foot})')   # R-212 #37, #39; R-328 H
                if signed:
                    check(pg.evaluate("document.querySelector('#main .yu-me').getAttribute('href')") == '#/profile' and 'Kai' in pg.inner_text('#main .yu-me'), f'{t}: the card is the person, to their profile')
                else:
                    me = pg.inner_text('#main .yu-me')
                    check('Get alerts on your issues' in me and pg.evaluate("document.querySelector('#main .yu-me').getAttribute('href')") == '#/alerts' and 'Made one before?' in txt, f'{t}: the card invites "Get alerts on your issues", with "Made one before? Sign in"')
                check(FILLED(pg) <= 1, f'{t}: at most one filled button')
                pg.click('[data-yu-about]'); pg.wait_for_timeout(200)
                about = pg.evaluate("!document.getElementById('yu-about').hidden && [...document.querySelectorAll('#yu-about .rc-wt')].map(e => e.innerText)")
                check(bool(about) and about[-1] == 'Donate' and 'About HIPHI' in about and 'Newsletter' in about, f'{t}: About HIPHI opens HIPHI\'s links, Donate last ({about})')
                check(bool(about) and not any('Keiki' in a for a in about), f'{t}: the event is not said again inside About HIPHI')
                check(pg.evaluate("document.querySelector('#main .yu-event a')?.getAttribute('target')") == '_blank', f'{t}: the event row opens its page in a new tab')
                pg.click('[data-yu-about]'); pg.wait_for_timeout(100)
                if tag == 'phone': check(H(pg) < 1050, f'{t}: You is under 1,050px tall on a phone ({H(pg)}; 1,549 before the redesign)')
                shot(pg, tag, f'you_{who}')
                # ---- Profile ----
                open_page(pg, '#/profile', sel='#main .pf')
                if signed:
                    check(pg.evaluate(ORDER, ['#main .pf-head', '#main .yu-pfal', '#main #pf-about']) == 'ok', f'{t}: Profile\'s first row is Your alerts')
                    check(pg.evaluate("document.querySelector('#main .yu-pfal a').getAttribute('href')") == '#/alerts', f'{t}: it opens #/alerts')
                    check(pg.evaluate("!document.querySelector('#pf-email, #pf-issues, .pf-lvls')"), f'{t}: no Alerts or Your issues section in Profile')
                else:
                    check(pg.evaluate("document.querySelector('#main h1').innerText") == 'Make your profile', f'{t}: without a profile, "Make your profile"')
                check(pg.evaluate("document.querySelector('#main .rc-back')?.innerText.trim()") in ('You',), f'{t}: Profile\'s back row says You')
                shot(pg, tag, f'profile_{who}')
                # ---- Your alerts ----
                open_page(pg, '#/alerts', sel='#main .mr-alerts')
                txt = TEXT(pg)
                check('At most one' not in txt, f'{t}: #/alerts never says "At most one text a day"')
                if signed:   # the old page, with ?rec=0, says it as the sign-up does since Nate's Change of 18 Oct (card 21)
                    open_page(pg, '#/alerts', rec=False, sel='#main .mr-alerts'); live = TEXT(pg)
                    check('Usually a few texts a month while the Legislature meets, and never more than one text a day.' in live and 'At most one' not in live, f'{t}: the old #/alerts (?rec=0) says how often, as the Text terms do')
                    check('when your voice matters most on the issues you follow' in live and 'gets a hearing' not in live, f'{t}: the old #/alerts (?rec=0) says what comes, not a text for every hearing')
                    check('Big moments only (where every issue starts)' in live and 'from the link in any text' in live, f'{t}: the old #/alerts (?rec=0) says each issue\'s level and where to change it')
                    check('App only (no texts about it)' in live, f'{t}: the old #/alerts (?rec=0) says what App only means')
                    pg.click('#main a[href="#/profile?to=alerts"]'); pg.wait_for_selector('#main .pf-lvls', timeout=30000); pg.wait_for_timeout(900)
                    top = pg.evaluate("document.querySelector('#main .pf-lvls').getBoundingClientRect().top")
                    check(0 <= top < 400, f'{t}: "Alerts in your profile" opens Profile at the switch for each issue ({round(top)}px from the top)')
                    open_page(pg, '#/alerts', sel='#main .mr-alerts')
                if signed:
                    check(pg.evaluate("document.querySelector('#main h1').innerText") == 'Your alerts', f'{t}: #/alerts is "Your alerts"')
                    check('Texts to (808) ••• 0123' in txt and 'Change' in txt and 'Email: not added' in txt and 'Add your email' in txt, f'{t}: where texts and email go')
                    check('A few texts a month' in txt, f'{t}: the live consent\'s words (a few texts a month)')
                    n = pg.evaluate("document.querySelectorAll('#main .ya-lv .lvl-sw').length")
                    check(n == len(KAI), f'{t}: a switch for each followed issue ({n})')
                    check(txt.count('Stop texts to this phone') == 1 and 'Not your phone? Stop texts to another number' in txt and pg.locator('#main .ya-end > details.mr-stopnum:not([open])').count() == 1, f'{t}: "Stop texts to this phone" once, at the foot, then the closed "Not your phone? Stop texts to another number" fold')
                    fb = pg.evaluate("(() => { const p = document.querySelector('#main .ya-foot p'), b = document.querySelector('#main .ya-foot .btn'); return b.getBoundingClientRect().top >= p.getBoundingClientRect().bottom - 1 })()")
                    check(fb, f'{t}: the stop button sits under the STOP line, not beside it')
                    check(pg.evaluate(ORDER, ['#main .ya-ways', '#main .ya-lvs', '#main .ya-foot']) == 'ok', f'{t}: ways, then each issue, then Stop')
                    pg.click('#main .ya-lv:first-child label[for$="-every"]'); pg.wait_for_timeout(600)
                    lv = pg.evaluate("JSON.parse(localStorage.getItem('hiphi_issue_levels_demo') || '{}')")
                    first = pg.evaluate("document.querySelector('#main .ya-lv').dataset.lvlIssue")
                    check(lv.get(first) == 'every' and 'Saved' in pg.inner_text('#main .ya-lv:first-child'), f'{t}: a switch saves at once and says so ({lv.get(first)})')
                    check(pg.evaluate("!document.querySelector('.actionbar')"), f'{t}: no Save bar')
                    check(FILLED(pg) == 0, f'{t}: no filled button on Your alerts')
                    shot(pg, tag, f'alerts_{who}')
                    pg.click('[data-mr-alchange]'); pg.wait_for_timeout(400)
                    check(pg.evaluate("document.querySelector('#main h1').innerText") == 'Change your number' and pg.locator('[data-mr-alcancel]').count() == 1, f'{t}: Change opens the number box, with Cancel')
                    pg.click('[data-mr-alcancel]'); pg.wait_for_timeout(300)
                    check(pg.evaluate("document.querySelector('#main h1').innerText") == 'Your alerts', f'{t}: Cancel goes back to Your alerts')
                else:
                    check(pg.evaluate("document.querySelector('#main h1').innerText") == 'Get alerts on your issues' and 'Stop texts to a number' in txt, f'{t}: without a profile, the sign-up box and the any-number stop')
                    check('A few texts a month' in txt, f'{t}: the sign-up box carries the live consent words')
                    shot(pg, tag, f'alerts_{who}')
                # ---- Sign in ----
                open_page(pg, '#/signin', sel='#main .mr-signin')
                head = pg.evaluate("document.querySelector('#main h1').innerText")
                check(head == ('Add your email' if signed else 'Sign in with your email') and head in pg.title(), f'{t}: the email page is "{head}" ({pg.title()})')
                if tag == 'phone' and who == 'none': shot(pg, tag, 'signin_none')
                # ---- Help ----
                if who in ('none', 'kai'):
                    open_page(pg, '#/help', sel='#main .tk-list')
                    check(pg.evaluate("document.querySelector('#main h1').innerText") == 'Help', f'{t}: Help is headed "Help"')
                    par = pg.evaluate("(() => { const s = document.querySelector('#main .tk-search'), n = s.nextElementSibling; return n && n.innerText.trim(); })()")
                    check(par == 'Stuck? The Public Access Room helps for free: (808) 587-0478.', f'{t}: the Public Access Room is right under the search ({par})')
                    check(pg.evaluate("document.querySelector('#main .yu-par a').getAttribute('href')") == 'tel:+18085870478', f'{t}: its number calls')
                    g = pg.evaluate("[...document.querySelectorAll('[data-tkgroup]')].map(d => d.open)")
                    check(len(g) == 7 and not any(g), f'{t}: seven groups, all closed ({g})')
                    check(pg.locator('[data-tkgroup] > summary .yu-gic .ic').count() == 7, f'{t}: each group has its icon back (card 15)')
                    check(pg.evaluate("!document.querySelector('#main .tk-gn')") and not re.search(r'\b\d+\b', ''.join(pg.evaluate("[...document.querySelectorAll('[data-tkgroup] > summary')].map(s => s.innerText)"))), f'{t}: no counts on the groups')
                    check(pg.locator('#main a[href="#/learn/bill"]').count() == 0, f'{t}: "Reading a bill" is not offered')
                    pg.click('[data-tkgroup="hearings"] > summary'); pg.wait_for_timeout(250)
                    check(pg.evaluate("document.querySelector('[data-tkgroup=hearings]').open") and pg.locator('[data-tkgroup="hearings"] [data-tkrow]').first.is_visible(), f'{t}: a group opens on {tag}')
                    pg.fill('#tk-q', 'zoom'); pg.wait_for_timeout(300)
                    vis = pg.evaluate("[...document.querySelectorAll('[data-tkrow]')].filter(a => a.offsetParent).length")
                    check(vis >= 1, f'{t}: the search finds questions and opens their groups ({vis})')
                    pg.fill('#tk-q', ''); pg.wait_for_timeout(200)
                    shot(pg, tag, f'help_{who}', full=True)
                    x_list = pg.evaluate("document.querySelector('#main h1').getBoundingClientRect().left")
                    open_page(pg, '#/help/what-is-a-hearing', sel='#main .tk-conv')
                    while pg.locator('[data-tknext]').count(): pg.click('[data-tknext]'); pg.wait_for_timeout(350)
                    backs = pg.evaluate("[...document.querySelectorAll('#main a[href=\"#/help\"]')].map(a => a.innerText.trim())")
                    check(backs == ['Help'] and 'Ask something else' not in TEXT(pg), f'{t}: a conversation has one way back, "Help" ({backs})')
                    x_conv = pg.evaluate("document.querySelector('#main .tk-back').getBoundingClientRect().left + 4")
                    if tag == 'laptop': check(abs(x_conv - x_list) <= 2, f'{t}: the conversation lines up with Help ({x_conv} vs {x_list})')
                    shot(pg, tag, f'conversation_{who}', full=False)
                # ---- Privacy ----
                if who == 'none':
                    open_page(pg, '#/privacy', rec=False, sel='#main .mr-facts')
                    old = pg.evaluate("(() => { const n = s => s.replace(/\\s+/g, ' ').trim(); return [...document.querySelectorAll('#main .mr-facts h2, #main .mr-facts li, #main .mr-facts p, #main .mr-access > p')].map(e => n(e.textContent)); })()")
                    nsec = pg.evaluate("document.querySelectorAll('#main .mr-facts > section').length")
                    open_page(pg, '#/privacy', sel='#main .yu-pv')
                    new = pg.evaluate("document.querySelector('#main .yu-pv').textContent.replace(/\\s+/g, ' ')")
                    missing = [o[:50] for o in old if o.replace(' ', '') not in new.replace(' ', '')]
                    check(not missing, f'{t}: every word of the privacy page is still there ({missing[:2]})')
                    folds = pg.evaluate("[...document.querySelectorAll('#main .rc-fold')].map(d => [d.dataset.rcFold, d.open])")
                    check(len(folds) == nsec and not any(o for _, o in folds) and folds[0][0] == 'privacy-access', f'{t}: In short open, Accessibility second, the rest closed cards ({len(folds)})')
                    check(pg.evaluate(ORDER, ['#main .yu-short', '#main [data-rc-fold="privacy-access"]']) == 'ok', f'{t}: "In short" first')
                    if tag == 'phone': check(H(pg) < 2600, f'{t}: Privacy is {H(pg)}px on a phone (8,926 before)')
                    shot(pg, tag, 'privacy_none')
                    open_page(pg, '#/privacy?part=access', sel='#main .yu-pv')
                    check(pg.evaluate("document.querySelector('[data-rc-fold=\"privacy-access\"]').open"), f'{t}: #/privacy?part=access opens Accessibility')
                # ---- every page: no sideways scroll, no errors ----
                for hsh in ['#/more', '#/profile', '#/alerts', '#/help', '#/privacy']:
                    open_page(pg, hsh, sel='#main .yu')
                    check(not WIDE(pg), f'{t} {hsh}: no sideways scroll')
                check(not errs, f'{t}: no page errors {errs[:2]}')
                ctx.close()
            # ---- the later-visit ask: the eyebrow's icon and words apart (a live fix, on the page everyone gets since R-303) ----
            ctx = br.new_context(viewport={'width': w, 'height': h}); ctx.add_init_script(init('kai'))
            if LOCAL: ctx.route('http://wt.local/**', serve)
            pg = ctx.new_page(); open_page(pg, '#/next/legs', sel='.nx-eyebrow')
            gap = pg.evaluate("(() => { const e = document.querySelector('.nx-eyebrow'), i = e.querySelector('svg').getBoundingClientRect(), s = e.querySelector('span').getBoundingClientRect(); return [s.left - i.right, Math.round(s.height), getComputedStyle(e).display]; })()")
            check(gap[0] >= 4 and gap[2] == 'flex', f'{tag}: "Welcome back" has a gap after its icon ({gap})')
            shot(pg, tag, 'next_legs', full=False)
            ctx.close()
        # ---- with ?rec=0 (the way back, R-303) the old pages are drawn ----
        ctx = br.new_context(viewport={'width': 390, 'height': 844}); ctx.add_init_script(init('kai+number'))
        if LOCAL: ctx.route('http://wt.local/**', serve)
        pg = ctx.new_page()
        open_page(pg, '#/more', rec=False, sel='#main .mr-more'); txt = TEXT(pg)
        check(pg.evaluate("document.querySelector('#main h1').innerText") == 'More' and 'Every bill HIPHI tracks' in txt and not pg.evaluate("!!document.querySelector('.yu')"), 'with ?rec=0: More is the old one')
        open_page(pg, '#/profile', rec=False, sel='#main .pf'); check(pg.evaluate("!!document.querySelector('#pf-email') && !!document.querySelector('#pf-issues') && !document.querySelector('.yu-pfal')"), 'with ?rec=0: Profile keeps its Alerts and Your issues')
        open_page(pg, '#/alerts', rec=False, sel='#main .mr-alerts'); check(pg.evaluate("document.querySelector('#main h1').innerText") == 'Text alerts are on', 'with ?rec=0: #/alerts is the old one')
        open_page(pg, '#/help', rec=False, sel='#main .tk-list'); check(pg.locator('.tk-gn').count() == 7 and pg.locator('a[href="#/learn/bill"]').count() == 1, 'with ?rec=0: Help keeps its counts and Reading a bill')
        open_page(pg, '#/privacy', rec=False, sel='#main .mr-facts'); check(pg.evaluate("!!document.querySelector('.mr-facts') && !document.querySelector('.rc-fold')"), 'with ?rec=0: Privacy is the old one')
        ctx.close()
        ctx = br.new_context(viewport={'width': 390, 'height': 844}); ctx.add_init_script(init('none'))
        if LOCAL: ctx.route('http://wt.local/**', serve)
        pg = ctx.new_page(); open_page(pg, '#/signin', rec=False, sel='#main .mr-signin')
        check(pg.evaluate("document.querySelector('#main h1').innerText") == 'Add your email', 'with ?rec=0: the email page is "Add your email"')
        ctx.close()
        # ---- Home's Your issues in the white box with ?rec=1 (Nate 18 Oct: "I'll go with the box for the home page"); the old Home (?rec=0) has none ----
        ctx = br.new_context(viewport={'width': 360, 'height': 800}); ctx.add_init_script(init('kai'))
        if LOCAL: ctx.route('http://wt.local/**', serve)
        pg = ctx.new_page()
        BOXED = "(s => { const e = document.querySelector(s), c = e && getComputedStyle(e); return !!c && c.backgroundColor === 'rgb(255, 255, 255)' && parseFloat(c.borderTopWidth) > 0; })"
        for q, want in (('&rec=0', False), ('&rec=1', True)):
            pg.goto(f"{BASE}/track.html?demo=1{q}#/"); ready(pg, '#main .cm-goal'); pg.wait_for_selector('#main .cm .cm-rows', timeout=30000)
            check(pg.evaluate(BOXED + "('#main .cm .cm-rows')") == want, f"Home's Your issues: {'in the white box with ?rec=1' if want else 'no box with ?rec=0'}")
        lit = pg.evaluate("(() => { const r = document.querySelector('#main .cm-row.on'); return r ? getComputedStyle(r).backgroundColor : null; })()")
        check(lit not in (None, 'rgb(255, 255, 255)', 'rgba(0, 0, 0, 0)'), f"Home's box: the slide's row stays lit in pale blue, not white on white ({lit})")
        days = pg.evaluate("[...document.querySelectorAll('#main .cm-rstat .cm-when')].map(e => [e.textContent, e.getClientRects().length, getComputedStyle(e).whiteSpace])")
        check(days and all(n == 1 and ws == 'nowrap' for _, n, ws in days), f"Home's box at 360px: each day stays on one line with its time ({days[:2]})")
        ctx.close()
        # ---- The seven other places in the white box (Nate 18 Oct, "Box all seven"), as Leilani with her districts saved ----
        ctx = br.new_context(viewport={'width': 390, 'height': 844}); ctx.add_init_script(init('leilani'))
        ctx.add_init_script("localStorage.setItem('hiphi_districts_demo', JSON.stringify({ senate: 13, house: 29, label: 'Kalihi', island: 'oahu' }))")
        if LOCAL: ctx.route('http://wt.local/**', serve)
        pg = ctx.new_page()
        LOOSE = "[...document.querySelectorAll('#main .rc-rows:not(.rc-box, .rc-fold .rc-rows, .rc-card .rc-rows, .card .rc-rows)')].filter(u => u.offsetParent).length"
        for route, sel, name in (("#/more", "#main .yu-rows .rc-rows", "You's rows"), ("#/help", "#main .tk-more .rc-rows", "Help's lessons"),
                                 ("#/help", "#main .tk-more + .tk-more .rc-rows", "Help's Email HIPHI"), ("#/legislators", "#main .pp-rppl", "Your lawmakers"),
                                 ("#/legislator/189", "#rc-more-pp-yi", "a lawmaker's On your issues"), ("#/committee/EDU", "#rc-more-cmt-bills", "a committee's bills"),
                                 ("#/issue/safety-for-immigrant-families", "#main .rc-irest .rc-sec .rc-rows", "the issue page's Bills on this issue"),
                                 ("#/issue/let-counties-regulate-tobacco", "#main .rc-record", "the issue page's record row")):
            pg.goto(f"{BASE}/track.html?demo=1&rec=1{route}"); ready(pg, '#main h1, #main .rc-h1')
            try: pg.wait_for_selector(sel, timeout=30000)
            except Exception: pass
            check(pg.evaluate(BOXED + f"({sel!r})"), f'{name}: in the white box with ?rec=1')
            check(pg.evaluate(LOOSE) == 0, f'{route}: no list left on the grey')
            split = pg.evaluate("[...document.querySelectorAll('#main .rc-box .rc-rstat')].map(e => e.textContent).filter(t => / ([AP]M)\\b|\\b(today|tomorrow|[A-Z][a-z]{2}) \\d/.test(t))")
            check(not split, f'{name}: a day, a date and a time never split across lines ({split[:2]})')
        pg.goto(f"{BASE}/track.html?demo=1&boxes=1#/more"); ready(pg, '#main h1')
        check(not pg.evaluate("document.documentElement.classList.contains('rc-boxall')"), 'the &boxes=1 preview is gone')
        ctx.close(); br.close()
    # The live Alerts page's words are the Text terms page's (alerts.js GETS_*, levelsWhere): the terms still hold each piece.
    terms = re.sub(r'<[^>]+>', '', re.sub(r'<!--.*?-->', '', open(os.path.join(ROOT, 'text-terms.html'), encoding='utf8').read(), flags=re.S))
    al = open(os.path.join(ROOT, 'pub', 'alerts.js'), encoding='utf8').read()
    pieces = [re.search(r"export const GETS_WHAT = '(.+?)';", al).group(1), re.search(r"export const GETS_TEXTS = '(.+?)';", al).group(1),
              'Big moments only (where every issue starts)', 'Change it under Alerts in your profile, on the issue’s page, or from the link in any text.']
    check(all(x in terms for x in pieces), f'the Text terms page holds every piece of the Alerts page\'s words ({[x[:30] for x in pieces if x not in terms]})')
    print(f'\n{ok_n} passed, {fail_n} failed'); sys.exit(1 if fail_n else 0)
main()
