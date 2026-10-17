# Pictures of every A/B test's versions for staff's Tests page (R-201, Nate 10/7: "screenshots easily accessible so it's
# easy to compare the multiple options"). Each version is opened in the practice copy, forced by ?ab= (pub/variant.js),
# walked to the spot where it differs and photographed on a phone (390 x 844). A version that is a whole path (a first
# visit, its ending) gets a strip of its screens, from the first screen where the versions part ways. The share picture's
# versions are the pictures themselves (pub/og/t/...), so nothing is photographed for them.
#
# Writes shots/<test>/<version>-<n>.jpg and shots/shots.json (staff/setup.js reads it). A picture is taken again only when
# what is on that screen changed (its words and its parts, the "sig"), so the pictures do not churn from one run to the next;
# --all takes every one again. Run by .github/workflows/test-shots.yml on every push that changes the public pages (this
# repository is public, so its minutes are free), or by hand:
#   python3 -m http.server 8832   (in this folder, once)
#   python3 tools/test_shots.py [base] [--all] [--only key,key]
import glob, sys, os, re, json, hashlib, datetime
from playwright.sync_api import sync_playwright

ARGS = [a for a in sys.argv[1:] if not a.startswith('--')]
BASE = (ARGS[0] if ARGS else 'http://localhost:8832').rstrip('/')
ALL = '--all' in sys.argv
ONLY = next((a.split('=', 1)[1] for a in sys.argv if a.startswith('--only=')), '')
ONLY = set(ONLY.split(',')) if ONLY else None
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'shots')
MAN = os.path.join(OUT, 'shots.json')
STRIP_MAX = 4   # a path's strip shows at most this many screens: enough to compare, few enough to see at a glance

# The tests and their versions, read from the public page's own list (pub/variant.js TESTS), so a version added there is
# photographed on the next run without a change here.
src = open(os.path.join(ROOT, 'pub', 'variant.js'), encoding='utf-8').read()
TESTS = {m.group(1): re.findall(r"'([^']+)'", m.group(2)) for m in re.finditer(r"^\s+([a-z]+): \{ arms: \[([^\]]*)\]", src, re.M)}

old = {}
try: old = json.load(open(MAN, encoding='utf-8'))
except Exception: pass
man = {'v': 1, 'tests': {}}

# Home with three issues followed, as staff's See links open it (staff/setup.js HOME_SCENE).
HOME_SCENE = '#/follow/safer-walking-near-schools,forgive-medical-debt,disposable-e-cigarette-ban'
SKIP = "() => { try { const w = JSON.parse(localStorage.getItem('hiphi_wiz') || '{}'); localStorage.setItem('hiphi_wiz', JSON.stringify({ ...w, done: true, step: 99 })); localStorage.setItem('hiphi_tour_bill', '{\"how\":\"shots\"}'); localStorage.setItem('hiphi_tour_home', '{\"how\":\"shots\"}'); } catch {} }"
def og_pic(arm):
    """The share picture of HB 1780 in one version: the og:image of its share page, as a path under the site."""
    base = ROOT if arm == 'today' else os.path.join(ROOT, 'p', arm)
    # The testimony ask where a version has it (the letter is drawn for testimony), else whichever ask it was drawn for.
    pages = sorted(glob.glob(os.path.join(base, 'b', '*', 'HB1780-testify.html'))) + sorted(glob.glob(os.path.join(base, 'b', '*', 'HB1780-*.html')))
    for f in pages:
        m = re.search(r'og:image" content="[^"]*?/(pub/og/[^"]+)"', open(f, encoding='utf-8').read())
        if m and os.path.exists(os.path.join(ROOT, m.group(1))): return m.group(1)
    return ''

# Nothing moves in a picture: animations end at once, the caret does not blink.
STILL = "* , *::before, *::after { animation-duration: 0s !important; animation-delay: 0s !important; transition: none !important; caret-color: transparent !important; }"

def ready(pg):
    pg.wait_for_function("() => !!document.querySelector('main') && !document.querySelector('.skelpage') && !document.querySelector('.st [aria-busy=true]')", timeout=60000)
    pg.wait_for_timeout(700)

def sig_of(pg):
    # What the screen holds: its words and the shape of its parts (tags and classes), not its pixels.
    s = pg.evaluate("""() => { const m = document.querySelector('dialog[open], .sheet.open, [role=dialog]:not([hidden])') || document.querySelector('main') || document.body;
      const parts = [...m.querySelectorAll('*')].slice(0, 1500).map(e => e.tagName + '.' + (e.getAttribute('class') || '')).join('|');
      return location.hash.replace(/\\?.*/, '') + '\\n' + m.innerText + '\\n' + parts; }""")
    return hashlib.sha1(s.encode('utf-8')).hexdigest()[:12]

def title_of(pg):
    # The screen's own heading (a sheet's when one is open), else the page's title: the words a person reads at its top.
    h = pg.evaluate("() => { const e = document.querySelector('dialog[open] h2, dialog[open] h1, main h1'); return e ? e.innerText.replace(/\\s+/g, ' ').trim() : ''; }")
    t = pg.title().split(' · ')[0].strip()
    return h or (t if t and 'Bill Tracker' not in t else 'Home')

def shot(pg, key, arm, n, focus=None):
    # A passing note ("Your 3 issues are here") would cover the bottom of the screen; it is not what differs, except on
    # the save test, where what comes right after a follow is the difference.
    if key != 'save': pg.add_style_tag(content='#toast { display: none !important; }')
    # One picture: the phone screen, scrolled so the part that differs (focus) is near the top.
    if focus:
        pg.evaluate("""sel => { const e = document.querySelector(sel); if (!e) return; const r = e.getBoundingClientRect();
          const box = e.closest('dialog, .sheet, [role=dialog]'); const sc = box && box.scrollHeight > box.clientHeight ? box : null;
          if (sc) sc.scrollTop += r.top - 140; else window.scrollBy(0, r.top - 140); }""", focus)
        pg.wait_for_timeout(300)
    sig = sig_of(pg)
    name = f'{arm}-{n}.jpg'; path = os.path.join(OUT, key, name)
    prev = next((s for s in (old.get('tests', {}).get(key, {}).get('arms', {}).get(arm, []) or []) if s.get('file') == f'{key}/{name}'), None)
    if ALL or not prev or prev.get('sig') != sig or not os.path.exists(path):
        os.makedirs(os.path.dirname(path), exist_ok=True)
        pg.screenshot(path=path, type='jpeg', quality=68)
        when = datetime.date.today().isoformat()
    else: when = prev.get('date')
    return {'file': f'{key}/{name}', 'title': title_of(pg), 'sig': sig, 'date': when}

def page(br, url, skip=False):
    ctx = br.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, device_scale_factor=1.5)
    if skip: ctx.add_init_script(f"({SKIP})()")
    pg = ctx.new_page(); pg.on('pageerror', lambda e: print('  page error:', str(e)[:120]))
    pg.goto(f"{BASE}/track.html?demo=1&abrest=today&restart&{url}")
    pg.add_style_tag(content=STILL); ready(pg); pg.add_style_tag(content=STILL)
    return ctx, pg

def advance(pg):
    # Each screen's way on, as tests/plans.py walks the plans: a topic picked, a bill picked, "Not now" on every ask.
    moved = False
    if pg.title().startswith('What do you care about?') and pg.locator('[data-stissue]').count():
        pg.locator('[data-stissue]').nth(2).click(); pg.wait_for_timeout(250); pg.click('[data-stnext]'); moved = True
    elif pg.locator('[data-obfind]').count():
        pg.locator('[data-obfind]').first.click(); pg.wait_for_timeout(300)
        if pg.locator('[data-stnext]:visible').count(): pg.locator('[data-stnext]:visible').first.click()
        moved = True
    else:
        # An ask for a number or email is passed over (its Skip); anywhere else Skip would pass over the step itself.
        ask = pg.locator('#st-a-phone, #st-a-email, [data-alswap], #st-send').count() > 0
        order = ('.st-bar [data-stskip]', '[data-stskip]') if ask else ()
        for sel in order + ('[data-stdone]', '[data-obnot]', '.st-bar [data-stnext]', '.st-bar [data-obon]', '.actionbar [data-obon]', '[data-stnext]', '[data-obon]', '.st-bar [data-stskip]'):
            if pg.locator(sel + ':visible').count():
                try: pg.locator(sel + ':visible').first.click(timeout=3000); moved = True
                except Exception: continue
                break
    return moved

def path_shots(br, key, arm, url, skip=False):
    # Every screen of a forced first visit, photographed as it is met; the strip keeps them all (trimmed later).
    ctx, pg = page(br, url, skip)
    out, last, stuck = [], None, 0
    for _ in range(40):
        pg.wait_for_timeout(500)
        if pg.locator('#fx-moment:not([hidden]) #fx-mgo').count(): pg.click('#fx-moment #fx-mgo'); continue
        on_start = bool(re.search(r'#/start/', pg.url))
        t = title_of(pg)
        if t != last:
            pg.evaluate("window.scrollTo(0, 0)"); out.append(shot(pg, key, arm, len(out) + 1)); last = t
        if not on_start: break
        moved = advance(pg)
        if not moved:
            # A screen still drawing: try it again once before giving up on the path.
            stuck += 1
            if stuck > 2: print(f'  {key}.{arm}: stopped on “{t}”'); break
            pg.wait_for_timeout(1200); continue
        stuck = 0
    ctx.close(); return out

with sync_playwright() as p:
    br = p.chromium.launch()
    for key, arms in TESTS.items():
        if ONLY and key not in ONLY:
            if key in old.get('tests', {}): man['tests'][key] = old['tests'][key]
            continue
        print(key, arms)
        got = {}
        for arm in arms:
            ab = f'ab={key}.{arm}'
            if key in ('onb', 'end', 'fv', 'email', 'act'):
                # A path: the whole first visit in that version (the tests inside it at today's, &abrest=today).
                got[arm] = path_shots(br, key, arm, ab + '#/start/1')
            elif key == 'join':
                # Met only on a plan's alerts sign-up (Plan 1's).
                ctx, pg = page(br, f'ab=onb.p1,join.{arm}#/start/1')
                for _ in range(20):
                    if pg.locator('#st-send').count() or not advance(pg): break
                    pg.wait_for_timeout(600)
                pg.evaluate("window.scrollTo(0, 0)")
                got[arm] = [shot(pg, key, arm, 1)]; ctx.close()
            elif key == 'rank':
                # The card after testimony is sent on Free school bus passes (HB 1780), on Home (the Home before 11 Oct,
                # whose cards are full size: a bill's own page and the calm Home show the compact card, the same in both).
                ctx, pg = page(br, ab + ',layout.today#/follow/free-bus-rides-for-kids', skip=True)
                pg.evaluate("""async () => { const c = await import('./pub/core.js'), k = await import('./pub/kernel.js'), a = await import('./pub/app.js');
                  const b = c.D.bills.find(x => x.bill_number === 'HB1780'), h = c.D.hearings.find(x => x.bill_id === b.id && new Date(x.scheduled_at) > Date.now());
                  c.S.done.add(c.doneKey(b.id, h.id, 'testimony')); k.saveDone(); a.render(); }""")
                pg.wait_for_timeout(900)
                got[arm] = [shot(pg, key, arm, 1, focus='.acard')]; ctx.close()
            elif key in ('share', 'pic'):
                ctx, pg = page(br, ab + '#/bill/HB1780', skip=True)
                pg.click('[data-bl-share]'); pg.wait_for_timeout(1200)
                if key == 'pic':
                    # The picture itself: the one a shared link to HB 1780 carries in that version (its share page's
                    # og:image, p/<version>/b/... as built by tools/share_pic_pages.mjs; today's is the bill's own page).
                    rel = og_pic(arm)
                    got[arm] = [{'file': '../' + rel, 'title': 'The picture a friend sees', 'sig': rel, 'date': None}] if rel else []
                else:
                    got[arm] = [shot(pg, key, arm, 1, focus='textarea')]
                ctx.close()
            elif key == 'save':
                # A newcomer from a shared link presses Follow on an issue: what comes right after is the difference.
                ctx, pg = page(br, f'via=share&{ab}#/issue/fda-proof-to-sell-e-cigarettes', skip=True)
                pg.locator('button:has-text("Follow")').first.click(); pg.wait_for_timeout(1500)
                got[arm] = [shot(pg, key, arm, 1)]; ctx.close()
            elif key in ('home', 'layout'):
                # Home with three issues followed, on a later visit (Home's top test lives on the Home before 11 Oct).
                ctx, pg = page(br, (f'ab=home.{arm},layout.today' if key == 'home' else ab) + HOME_SCENE, skip=True)
                pg.wait_for_timeout(800); pg.evaluate("window.scrollTo(0, 0)")
                got[arm] = [shot(pg, key, arm, 1)]; ctx.close()
            else:
                print('  no way to reach', key, 'yet'); got[arm] = []
        # A path's strip starts one screen before the first screen whose name differs between the versions (the screen
        # that leads to the difference), and keeps STRIP_MAX. Screen names, not their words: a first visit's chapter list
        # names its versions on every screen, so the words differ from the first screen on.
        multi = [a for a in arms if len(got.get(a) or []) > 1]
        if multi:
            ps = [[x['title'] for x in got[a]] for a in arms if got.get(a)]
            n = min(len(x) for x in ps); d = next((i for i in range(n) if len({x[i] for x in ps}) > 1), None)
            if d is None:   # the same screens by name (the page before the end keeps its name): the first whose words differ
                ss = [[x['sig'] for x in got[a]] for a in arms if got.get(a)]
                d = next((i for i in range(n) if len({x[i] for x in ss}) > 1), n - 1)
            start = max(0, d - 1)
            for a in arms:
                if got.get(a):
                    keep = got[a][start:start + STRIP_MAX]
                    for s in got[a]:
                        f = os.path.join(OUT, s['file'])
                        if s not in keep and os.path.exists(f): os.remove(f)
                    got[a] = keep
        man['tests'][key] = {'arms': got}
    br.close()

json.dump(man, open(MAN + '.tmp', 'w', encoding='utf-8'), ensure_ascii=False, indent=1); os.replace(MAN + '.tmp', MAN)
print('wrote', MAN, sum(len(v) for t in man['tests'].values() for v in t['arms'].values()), 'pictures')
