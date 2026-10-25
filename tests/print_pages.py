# Printing the public page (R-212 #48, the Teacher's walk of 8 Oct: "no print"). In the practice copy (?demo=1), in
# Chromium, as someone who follows three issues, with print emulated (page.emulate_media) and printed to Letter (page.pdf):
#   python3 -m http.server 8832   (in this folder, once)
#   python3 tests/print_pages.py [base] [out]   base defaults to http://localhost:8832
# Checks:
#   - pub/print.css is the last stylesheet (it is in <body>; pub/app.js adds each screen's own to <head>, the last ones at
#     its end) and wins over one added there later: a rule of the same weight in a sheet appended to <head> loses to it
#   - the bill page, today's layout and the older one (&rec=0), on a phone: the tab bar, Share, the menu, Back, "Where do
#     you stand?" and the main button are not drawn; nothing drawn is fixed or sticky; every fold is open, and afterwards
#     each is as it was (one opened beforehand stays open) with nothing stored by the screen's fold listeners; "Printed
#     <date> from HIPHI's Bill Tracker. For the latest: <address>" is drawn last with this bill's address (?demo=1 kept,
#     &rec=0 and ?from= dropped) and is gone on screen; the sandbox band prints; the PDF stays within its pages
#   - on a laptop the bill page draws itself again for the narrower paper while it prints (pub/bill.js WIDE): its folds are
#     still open when the PDF is made (read at afterprint, before track.html's script closes them)
#   - the walkthrough at the letter step (phone and laptop): only the sheet is drawn, in the page's flow, with no X, Next or
#     footer; the whole letter is on paper (its words copied whole, nothing cut off); the line is under the sheet; on screen
#     again the box is back and the copy gone
#   - This week, My issues, a list, Find, a lawmaker, a committee, Home, the lessons, the in-person directions and the
#     walkthrough's Zoom checklist: no tab bar, no button but those kept on purpose ("and 13 others" read as words, the
#     open "How to get there" as its list's name), nothing fixed, nothing past the right edge, the line at the end, and
#     within their pages
#   - "Print this page", last in the bill page's ⋯ menu (A-20), on a phone (both layouts) and a laptop: it closes the menu
#     and prints
#   - no page or console errors, nothing written to the database
# Pictures and PDFs in [out] (default tests/out/print_pages): <screen>.pdf and <screen>-print.png (816px wide, print
# emulated), menu-phone.png and menu-laptop.png. Page counts are printed; the limits leave room for the wider fonts of the
# Linux runner.
import json, os, re, sys
from playwright.sync_api import sync_playwright
BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832').rstrip('/')
if BASE.endswith('.html'): BASE = BASE.rsplit('/', 1)[0]
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out', 'print_pages')
os.makedirs(OUT, exist_ok=True)
HOST = re.sub(r'^https?://', '', BASE)
res = []
def ok(c, m): res.append(bool(c)); print('PASS' if c else 'FAIL', m)

snap = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'demo', 'snapshot.json')))
ISS = {i['slug']: i['id'] for i in snap['issues']}
FOLLOWS = [ISS['disposable-e-cigarette-ban'], ISS['free-bus-rides-for-kids'], ISS['more-local-food-in-school-meals']]
# Past the first visit and the tours, following three issues (so My issues and Home have rows). The sandbox keeps its own
# copy of each name (_demo).
INIT = ("(() => { try { const S = (k, v) => { localStorage.setItem(k, v); localStorage.setItem(k + '_demo', v); };"
        " S('hiphi_wiz', JSON.stringify({ step: 99, done: true, skipped: true })); S('hiphi_tour_bill', '1'); S('hiphi_tour_home', '1');"
        f" S('hiphi_issue_follows', {json.dumps(json.dumps(FOLLOWS))}); }} catch (e) {{}} }})();"
        # What the page looks like when the PDF is made, read before track.html's own afterprint listener (this one is added
        # first) puts the folds back.
        " addEventListener('afterprint', () => { window.__atPrint = { closed: document.querySelectorAll('details:not([open])').length,"
        " all: document.querySelectorAll('details').length, line: (document.getElementById('pr-from') || {}).textContent || '' }; });")
writes, errs = [], []

def ctx(br, w, h):
    m = w < 700
    c = br.new_context(viewport={'width': w, 'height': h}, is_mobile=m, has_touch=m, device_scale_factor=2 if m else 1)
    c.add_init_script(INIT)
    def guard(route):
        r = route.request
        if r.method in ('GET', 'HEAD', 'OPTIONS'): route.continue_(); return
        writes.append(f'{r.method} {r.url[:100]}'); route.abort()
    c.route(re.compile(r'.*supabase\.co/.*'), guard)
    p = c.new_page()
    p.on('pageerror', lambda e: errs.append(f'{w}: {e}'))
    p.on('console', lambda m: errs.append(f'{w} console: {m.text[:160]}') if m.type == 'error' and 'favicon' not in m.text else None)
    return c, p

def ready(p, sel='main'):
    p.wait_for_selector(sel, timeout=40000)
    p.wait_for_function("() => !!document.querySelector('main') && !document.querySelector('.skelpage')", timeout=40000)
    p.wait_for_timeout(1200)
def go(p, route, q='', sel='main'):
    p.goto(f'{BASE}/track.html?demo=1{q}#{route}'); ready(p, sel)
def printing(p, on=True):
    p.emulate_media(media='print' if on else 'screen'); p.wait_for_timeout(350)
def pages(b): return len(re.findall(rb'/Type\s*/Page(?!s)', b))   # pypdf is not on the runner

SHOWN = "const shown = e => !!e && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden';"
# What the paper shows of the page as it is now (call it with print emulated).
STATE = "() => { " + SHOWN + """
  const name = e => e.tagName.toLowerCase() + (typeof e.className === 'string' && e.className.trim() ? '.' + e.className.trim().split(/\\s+/).join('.') : '');
  const fixed = [...document.querySelectorAll('body *')].filter(e => /^(fixed|sticky)$/.test(getComputedStyle(e).position) && shown(e)).map(name);
  const ctl = [...document.querySelectorAll('button, a.btn, [role=button], input:not([type=hidden]), select, textarea')].filter(shown)
    .filter(e => !e.matches('.bl-rsmore, .goline .btn[aria-expanded="true"]')).map(e => name(e) + ' "' + (e.innerText || e.value || '').trim().slice(0, 30) + '"');
  const line = document.getElementById('pr-from'), dlg = document.querySelector('dialog[open]'), scope = dlg || document.getElementById('app');
  const bottoms = [...scope.querySelectorAll('*')].filter(e => e !== line && !line.contains(e) && shown(e) && !e.matches('.sr')).map(e => e.getBoundingClientRect().bottom);
  const band = document.querySelector('.band');
  return { fixed, ctl, line: shown(line) ? line.innerText.trim() : '', lineTop: line.getBoundingClientRect().top, lastBottom: Math.max(0, ...bottoms),
    lineInSheet: !!dlg && dlg.contains(line), over: document.documentElement.scrollWidth - innerWidth, tabs: shown(document.querySelector('.tabs')),
    band: shown(band) ? band.innerText.trim() : '', closed: document.querySelectorAll('details:not([open])').length, folds: document.querySelectorAll('details').length }; }"""
HIDDEN = "sels => { " + SHOWN + " return sels.map(s => [s, document.querySelectorAll(s).length, [...document.querySelectorAll(s)].some(shown)]); }"
FOLDS = "() => [...document.querySelectorAll('details')].map(d => d.open)"
STORE = "() => JSON.stringify([Object.entries(localStorage).sort(), Object.entries(sessionStorage).sort()])"
DATE = r'Printed [A-Z][a-z]{2} \d{1,2}, \d{4} from HIPHI’s Bill Tracker\. For the latest: '

def hidden_ok(p, tag, sels, maybe=()):
    for s, n, vis in p.evaluate(HIDDEN, list(sels) + list(maybe)):
        ok((n > 0 or s in maybe) and not vis, f'{tag}: {s} is not on paper ({n} on the page)')

def paper(p, tag, addr=None):
    s = p.evaluate(STATE)
    ok(not s['tabs'], f'{tag}: no tab bar')
    ok(not s['fixed'], f'{tag}: nothing drawn is fixed or sticky ({s["fixed"][:4]})')
    ok(not s['ctl'], f'{tag}: no buttons or fields on paper ({s["ctl"][:5]})')
    ok(s['over'] <= 0, f'{tag}: nothing past the right edge ({s["over"]}px)')
    ok(s['closed'] == 0, f'{tag}: every fold open ({s["folds"]} folds)')
    ok(re.match(DATE, s['line']) is not None and (addr is None or s['line'].endswith(addr)), f'{tag}: the line says where it came from ({s["line"][-70:]!r})')
    ok(s['lineTop'] >= s['lastBottom'] - 1, f'{tag}: the line comes last ({round(s["lineTop"])} >= {round(s["lastBottom"])})')
    return s

def proof(p, name, limit):
    """The PDF and the print-emulated picture, for the eye; the PDF's pages within the limit."""
    p.screenshot(path=os.path.join(OUT, f'{name}-print.png'), full_page=True)
    b = p.pdf(format='Letter'); open(os.path.join(OUT, f'{name}.pdf'), 'wb').write(b)
    n = pages(b)
    ok(1 <= n <= limit, f'{name}: {n} Letter page(s), at most {limit}')
    return n

def to_letter(p):
    """The walkthrough at its letter step: a letter sent for an earlier hearing (?letter=1), used again."""
    p.locator('[data-bl-go="testify"]').first.click(); p.wait_for_selector('#hp-dlg .hp-body', timeout=10000); p.wait_for_timeout(700)
    p.click('#hp-dlg .hp-foot [data-hp="next"]'); p.wait_for_timeout(700)
    p.click('[data-hp="again-use"]'); p.wait_for_selector('#hp-letter', timeout=8000); p.wait_for_timeout(800)

PICK = """async n => { const c = await import('./pub/core.js'); const b = c.D.bills.find(x => x.bill_number === n);
  const h = c.D.hearings.filter(x => x.bill_id === b.id && new Date(x.scheduled_at) > Date.now()).sort((a, z) => a.scheduled_at.localeCompare(z.scheduled_at))[0];
  await c.setFollows({ issuesOn: c.issuesOf(b).map(i => i.id) }); c.saveLocal(); await c.loadBills(); c.app.render(); return [b.id, h.id]; }"""
def to_zoom(p):
    """The walkthrough's last page after testimony sent to be spoken on Zoom: the checklist a testifier takes to the hearing."""
    t = p.evaluate(PICK, 'HB2121')
    p.evaluate("async ([b, h]) => { const c = await import('./pub/core.js'); c.app.openHelper(b, h); }", t); p.wait_for_selector('#hp-dlg', timeout=15000); p.wait_for_timeout(800)
    for _ in range(8):
        if p.locator('#hp-dlg .hp-speak').count(): break
        st = p.locator('#hp-dlg [data-hp="stance"][data-v="support"]')
        if st.count(): st.first.click(); p.wait_for_timeout(500); continue
        if p.locator('#hp-name').count() and not p.input_value('#hp-name'): p.fill('#hp-name', 'Malia Test')
        b = p.locator('#hp-dlg [data-hp="acct-yes"]')
        if not b.count(): b = p.locator('#hp-dlg .hp-foot .hp-main')
        b.first.click(); p.wait_for_timeout(800)
    p.locator('#hp-spk-zoom').click(); p.wait_for_timeout(500)
    for _ in range(6):
        if p.locator('#hp-done-t').count(): break
        b = p.locator('#hp-dlg [data-hp="sent"]')
        if not b.count(): b = p.locator('#hp-dlg .hp-foot .hp-main')
        b.first.click(); p.wait_for_timeout(900)
    p.wait_for_selector('#hp-dlg .zoomdir', timeout=8000)

def going(p):
    """The bill page's hearing card after "I plan to go": How to get there, open on the card (pub/actions.js)."""
    p.locator('[data-moreways]').first.click(); p.wait_for_timeout(400)
    p.locator('.mwrow[data-go]').first.click(); p.wait_for_timeout(400)
    p.locator('[data-attend]').first.click(); p.wait_for_selector('.godir', timeout=8000); p.wait_for_timeout(900)

with sync_playwright() as pw:
    br = pw.chromium.launch()

    # ---- 1. the stylesheet's place: last, and it wins over a sheet added to <head> later (as pub/app.js adds them) ----
    c, p = ctx(br, 816, 1056)
    go(p, '/bill/HB2121')
    order = p.evaluate("""() => { const l = [...document.querySelectorAll('link[rel=stylesheet]')], pr = l.find(x => x.getAttribute('href') === 'pub/print.css');
      return { last: l[l.length - 1] === pr, inBody: !!pr && document.body.contains(pr), media: pr && pr.media, n: l.length, rec: l.some(x => x.getAttribute('href') === 'pub/rec/rec.css') }; }""")
    ok(order['last'] and order['inBody'] and order['media'] == 'print', f'pub/print.css is the last of {order["n"]} stylesheets, in <body>, for print only (rec/rec.css loaded: {order["rec"]})')
    p.evaluate("() => { const s = document.createElement('style'); s.textContent = '.band { border-top-left-radius: 7px; } .hdr .brand svg { width: 77px; }'; document.head.appendChild(s); }")
    printing(p)
    cs = p.evaluate("() => ({ band: getComputedStyle(document.querySelector('.band')).borderTopLeftRadius, hdr: getComputedStyle(document.querySelector('.hdr')).position, tabs: getComputedStyle(document.querySelector('.tabs')).display, svg: getComputedStyle(document.querySelector('.hdr .brand svg')).width })")
    ok(cs['band'] == '6px' and cs['svg'] == '24px', f'rules of the same weight added to the end of <head> lose to print.css (band corner {cs["band"]}, brand mark {cs["svg"]})')
    ok(cs['hdr'] == 'static' and cs['tabs'] == 'none', f'in print the header is static and the tab bar not drawn ({cs})')
    printing(p, False)
    sc = p.evaluate("() => ({ band: getComputedStyle(document.querySelector('.band')).borderTopLeftRadius, svg: getComputedStyle(document.querySelector('.hdr .brand svg')).width, tabs: getComputedStyle(document.querySelector('.tabs')).display })")
    ok(sc['band'] == '7px' and sc['svg'] == '77px' and sc['tabs'] != 'none', f'on screen the added rules hold and the tab bar is back ({sc})')
    c.close()

    # ---- 2. the bill page on a phone, both layouts ----
    for q, tag in (('', 'bill, phone'), ('&rec=0', 'bill rec=0, phone')):
        c, p = ctx(br, 390, 844)
        go(p, '/bill/HB2121', q, '[data-bl-menu]')
        # One fold opened by the person beforehand stays open afterwards; the others close again.
        p.locator('details:not([open]) > summary:visible').nth(1 if q else 2).click(); p.wait_for_timeout(400)
        before, store = p.evaluate(FOLDS), p.evaluate(STORE)
        ok(any(before) and not all(before), f'{tag}: before printing {sum(before)} of {len(before)} folds are open')
        ok(p.evaluate("document.getElementById('pr-from').getClientRects().length") == 0, f'{tag}: the printed line is not on screen')
        printing(p)
        # (the older page has no tab bar while its docked bar shows)
        hidden_ok(p, tag, ['[data-bl-share]', '[data-bl-menu]', '[data-bl-back]', '[data-bl-stance]', '[data-bl-go="testify"]'], ['.tabs', '.actionbar'])
        s = paper(p, tag, f'{HOST}/track.html?demo=1#/bill/2026/HB2121')
        ok(s['band'].startswith('Sandbox · Mon, Mar 16, 2026'), f'{tag}: the sandbox band prints, so the made-up day is marked ({s["band"][:44]!r})')
        printing(p, False); p.wait_for_timeout(300)
        ok(p.evaluate(FOLDS) == before, f'{tag}: on screen again each fold is as it was')
        ok(p.evaluate(STORE) == store, f'{tag}: nothing was stored by opening and closing them (the screen never heard it)')
        ok(p.evaluate("document.getElementById('pr-from').getClientRects().length") == 0 and p.locator('.pr-copy').count() == 0, f'{tag}: the line is gone from the screen')
        c.close()

    # ---- 3. the bill page on a laptop: in print emulation, and in a real print, where it draws itself again ----
    c, p = ctx(br, 1280, 900)
    go(p, '/bill/HB2121', '', '[data-bl-share]')
    printing(p)
    hidden_ok(p, 'bill, laptop', ['.hdr .hsearch', '[data-bl-share]', '[data-bl-back]', '[data-bl-stance]', '[data-bl-go="testify"]'])
    s = p.evaluate(STATE)
    ok(not s['fixed'], f'bill, laptop: nothing drawn is fixed or sticky ({s["fixed"][:4]})')
    ok(s['line'].endswith(f'{HOST}/track.html?demo=1#/bill/2026/HB2121'), f'bill, laptop: the line has the bill\'s address ({s["line"][-60:]!r})')
    printing(p, False)
    b = p.pdf(format='Letter'); at = p.evaluate('window.__atPrint || {}')
    ok(at.get('all', 0) > 5 and at.get('closed') == 0 and re.match(DATE, at.get('line', '')), f'bill, laptop: the page redrawn for the paper still prints every fold open ({at.get("all")} folds, {at.get("closed")} shut)')
    n = pages(b); ok(n <= 7, f'bill, laptop: {n} Letter pages, at most 7')
    p.wait_for_timeout(500)
    ok(p.evaluate("document.querySelectorAll('details[open]').length") == 0 and p.locator('.pr-copy').count() == 0, 'bill, laptop: after printing, the folds are shut again')
    c.close()

    # ---- 4. the walkthrough at the letter step: the sheet alone, the whole letter ----
    for w, h, tag in ((390, 844, 'letter, phone'), (1280, 900, 'letter, laptop')):
        c, p = ctx(br, w, h)
        go(p, '/bill/HB2121', '&letter=1', '[data-bl-go="testify"]'); to_letter(p)
        text = p.input_value('#hp-letter')
        printing(p)
        hidden_ok(p, tag, ['main', '.tabs', '.hp-x', '.hp-foot', '[data-hp="next"]', '#hp-letter'])
        sh = p.evaluate("() => { const d = document.querySelector('dialog[open]'), r = d.getBoundingClientRect(), cs = getComputedStyle(d); return { pos: cs.position, w: Math.round(r.width), vw: innerWidth, shadow: cs.boxShadow }; }")
        ok(sh['pos'] == 'absolute' and sh['w'] >= sh['vw'] - 1 and sh['shadow'] == 'none', f'{tag}: the sheet is in the page, full width, no shadow ({sh})')
        cp = p.evaluate("""() => { const c = document.querySelector('#hp-dlg .pr-copy'); if (!c) return null; const r = c.getBoundingClientRect();
          let clip = null; for (let a = c.parentElement; a; a = a.tagName === 'DIALOG' ? null : a.parentElement) { const s = getComputedStyle(a), q = a.getBoundingClientRect();   // up to the sheet, which is in the top layer
            if (s.overflowY !== 'visible' && q.bottom < r.bottom - 1) { clip = a.className; break; } }
          return { text: c.textContent, h: r.height, sh: c.scrollHeight, clip, shown: c.getClientRects().length > 0 }; }""")
        ok(cp and cp['shown'] and cp['text'] == text and len(text) > 300, f'{tag}: the letter on paper is the whole letter ({len(text)} characters)')
        ok(cp and cp['h'] >= cp['sh'] - 1 and cp['clip'] is None, f'{tag}: nothing of it is cut off ({cp and round(cp["h"])} of {cp and cp["sh"]}px, clipped by {cp and cp["clip"]})')
        s = paper(p, tag)
        ok(s['lineInSheet'], f'{tag}: the line is under the sheet')
        if w == 390: proof(p, 'letter-phone', 2)
        printing(p, False)
        ok(p.evaluate("document.querySelector('#hp-letter').getClientRects().length > 0") and p.locator('.pr-copy').count() == 0
           and p.evaluate("!document.documentElement.classList.contains('pr-sheet') && !document.querySelector('[data-pr-sheet]')"), f'{tag}: on screen again the box is back and the copy gone')
        c.close()

    # ---- 5. every screen on paper, 816px wide (the width of a Letter page), with its PDF and picture ----
    LEG = f'{HOST}/track.html?demo=1#/legislator/71'   # opened from a bill: the line leaves out where it was opened from (?from=)
    SCREENS = [  # name, route, query, wait for, prepare, page limit (measured on a Mac, plus room)
        ('bill', '/bill/HB2121', '', '[data-bl-menu]', None, 7),
        ('bill-rec0', '/bill/HB2121', '&rec=0', '[data-bl-menu]', None, 7),
        ('letter', '/bill/HB2121', '&letter=1', '[data-bl-go="testify"]', to_letter, 2),
        ('going', '/bill/HB1523', '', '[data-moreways]', going, 6),
        ('zoom', '/', '&codes=0', 'main', to_zoom, 3),
        ('week', '/week', '', '.wk-row', None, 3),
        ('bills', '/bills', '', 'main', None, 2),
        ('list', '/list/keiki-health', '', 'main', None, 3),
        ('find', '/find', '', 'main', None, 3),
        ('legislator', '/legislator/71?from=HB2121', '', 'main', None, 5),
        ('committee', '/committee/HHS', '', 'main', None, 3),
        ('home', '/', '', 'main', None, 2),
        ('learn', '/learn/story', '', '#lx-story', None, 2),
        ('learn-bill', '/learn', '', 'main', lambda p: p.wait_for_function("() => !!document.querySelector('link[href=\"pub/bill.css\"]')?.sheet", timeout=20000), 2),   # its little bill page's dots are bill.css's, which comes a moment after the screen
    ]
    counts = {}
    for name, route, q, sel, prep, limit in SCREENS:
        c, p = ctx(br, 816, 1056)
        go(p, route, q, sel)
        if prep: prep(p)
        printing(p)
        paper(p, name, LEG if name == 'legislator' else None)
        if name == 'going':
            g = p.evaluate("() => { const d = document.querySelector('.godir'); return d && d.getClientRects().length ? d.innerText : ''; }")
            ok('Arrive by' in g and 'Room 229' in g and 'How to get there' in p.evaluate("document.querySelector('.goline').innerText"), 'going: "How to get there" prints, named, with the room and when to arrive')
        if name == 'zoom':
            z = p.evaluate("() => { const d = document.querySelector('#hp-dlg .zoomdir'); return d && d.getClientRects().length ? d.innerText : ''; }")
            ok('Speaking on Zoom' in z and 'Join' in z, 'zoom: the Zoom checklist prints, the sheet alone')
        counts[name] = proof(p, name, limit)
        c.close()
    print('pages:', ', '.join(f'{k} {v}' for k, v in counts.items()))

    # ---- 6. "Print this page", last in the ⋯ menu ----
    for w, h, q, tag in ((390, 844, '', 'phone'), (390, 844, '&rec=0', 'phone, rec=0'), (1280, 900, '', 'laptop')):
        c, p = ctx(br, w, h)
        go(p, '/bill/HB2121', q, '[data-bl-menu]')
        p.evaluate("() => { window.__printed = 0; window.print = () => { window.__printed++; }; }")
        p.click('[data-bl-menu]'); p.wait_for_timeout(300)
        items = p.evaluate("[...document.querySelectorAll('#bl-menu .bl-mi')].map(e => e.innerText.trim())")
        last = p.locator('#bl-menu .bl-mi').last
        ok(items and items[-1] == 'Print this page' and last.locator('.ic-printer').count() == 1, f'menu, {tag}: "Print this page" is last, with the printer icon ({items})')
        if q == '': p.screenshot(path=os.path.join(OUT, f'menu-{tag}.png'))
        last.click(); p.wait_for_timeout(300)
        ok(p.evaluate('window.__printed') == 1 and p.evaluate("document.getElementById('bl-menu').hidden") and p.get_attribute('[data-bl-menu]', 'aria-expanded') == 'false',
           f'menu, {tag}: tapping it closes the menu and prints')
        c.close()
    br.close()

ok(not writes, f'nothing was written to the database, nor tried ({writes[:3]})')
ok(not errs, f'no page or console errors ({errs[:3]})')
print(f'\n{sum(res)} passed, {len(res) - sum(res)} failed')
sys.exit(0 if all(res) else 1)
