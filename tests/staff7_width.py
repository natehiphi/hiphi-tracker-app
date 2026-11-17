# Staff7's list column width (R-398) on the practice copy: 340 wide by default on every door, a handle between the list and the page that is dragged or moved with the keys,
# remembered per person on this device, never in the way (no handle on a phone, on Calendar's Week view or on a one-column page), and nothing cut off or scrolling sideways at the smallest width.
# Rules kept: the largest is min(560, 45% of the page area), the page column is never under 400 at 900 and up, a drag survives a redraw, Escape puts the width back,
# a click with no movement saves nothing, the phone layout does not change whatever is stored; no console error; nothing leaves 127.0.0.1.
#   python3 tests/staff7_width.py [base] [shots folder]     base defaults to http://127.0.0.1:8851
import sys, os, json, math
from playwright.sync_api import sync_playwright
BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8851').rstrip('/')
SHOTS = sys.argv[2] if len(sys.argv) > 2 else ''
if SHOTS: os.makedirs(SHOTS, exist_ok=True)
res = []
def ok(c, m): res.append(bool(c)); print('PASS' if c else 'FAIL', m, flush=True)
KEY = 'hiphi.staff7.listw'
ERRS, BAD = [], []

def external_blocker(ctx):
    def h(route):
        u = route.request.url
        if 'fonts.g' in u: return route.continue_()
        BAD.append(u); route.abort()
    ctx.route(lambda u: '127.0.0.1' not in u and 'localhost' not in u, h)
def open_as(br, who, w, h, hash='', store=None):
    """A fresh context (so nothing is stored) unless `store` says what to put there first, once."""
    ctx = br.new_context(viewport={'width': w, 'height': h}); external_blocker(ctx)
    if store is not None:
        ctx.add_init_script("(v => { try { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('%s', v); sessionStorage.setItem('seeded', '1'); } } catch (e) {} })(%s)" % (KEY, json.dumps(json.dumps(store))))
    pg = ctx.new_page()
    pg.on('pageerror', lambda e: ERRS.append(str(e))); pg.on('console', lambda m: ERRS.append(m.text) if m.type == 'error' and 'Failed to load resource' not in m.text and 'ERR_FAILED' not in m.text else None)
    pg.goto(f'{BASE}/staff7.html?demo=1&as={who}' + hash); pg.wait_for_selector('.paper', timeout=60000)
    pg.evaluate("Promise.all([document.fonts.load('600 16px Poppins'), document.fonts.load('400 16px Lato'), document.fonts.load('700 16px Lato'), document.fonts.load('500 16px Poppins')])"); pg.wait_for_timeout(500)
    return pg
def go(pg, hash): pg.evaluate("h => { location.hash = h; }", hash); pg.wait_for_selector('.paper'); pg.wait_for_timeout(600)
def snap(pg, name):
    if SHOTS: pg.screenshot(path=os.path.join(SHOTS, name))
WL = "() => document.getElementById('wl') ? Math.round(document.getElementById('wl').getBoundingClientRect().width) : null"
WP = "() => Math.round(document.querySelector('.wp').getBoundingClientRect().width)"
WSW = "() => Math.round(document.querySelector('.ws').getBoundingClientRect().width)"
STORED = "k => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return 'bad'; } }"
def now_w(pg): return pg.evaluate(WL)
def drag(pg, dx=None, to=None, steps=8, release=True):
    b = pg.locator('#wsz').bounding_box(); x, y = b['x'] + b['width'] / 2, 450
    pg.mouse.move(x, y); pg.mouse.down(); pg.mouse.move(x + dx if dx is not None else to, y, steps=steps); pg.wait_for_timeout(150)
    if release: pg.mouse.up(); pg.wait_for_timeout(150)
def largest(pg): return pg.evaluate("() => Math.floor(Math.min(560, 0.45 * document.querySelector('.ws').getBoundingClientRect().width))")

# every list-and-page door, found from the data by what it is
IDS = """async () => { const d = await import('/staff6/data.js'); const i = d.S.issues.find(i => !i.archived_at); return { issue: i.id }; }"""
# what must hold at one width, on the page that is open: nothing scrolls sideways, every tab's words are inside its tab, the find box is inside the column, no one-line cut with dots
CHECK = """() => {
  const wl = document.getElementById('wl'), out = [], r = wl.getBoundingClientRect();
  if (wl.scrollWidth > wl.clientWidth) out.push('wl scrolls sideways ' + wl.scrollWidth + '>' + wl.clientWidth);
  const pp = document.querySelector('.paper'); if (pp && pp.scrollWidth > pp.clientWidth + 1) out.push('paper scrolls sideways');
  if (document.documentElement.scrollWidth > innerWidth) out.push('document scrolls sideways');
  document.querySelectorAll('.seg').forEach(s => { if (s.scrollWidth > s.clientWidth) out.push('tab cut: ' + s.innerText); const a = s.getBoundingClientRect(); if (a.right > r.right + 0.5 || a.left < r.left - 0.5) out.push('tab outside the column: ' + s.innerText); });
  const fb = document.querySelector('.findb'); if (fb) { const f = fb.getBoundingClientRect(); if (f.left < r.left - 0.5 || f.right > r.right + 0.5) out.push('find box outside the column'); }
  wl.querySelectorAll('*').forEach(e => { const cs = getComputedStyle(e); if (cs.display === 'none') return;
    if (cs.textOverflow === 'ellipsis' && cs.overflow === 'hidden' && e.scrollWidth > e.clientWidth + 1 && !e.closest('.fdrop')) out.push('one line cut with dots: ' + (e.innerText || e.getAttribute('placeholder') || '').slice(0, 40));
    if (e.tagName === 'MARK' && e.closest('.fnt, .fn')) { const c = e.closest('.fnt, .fn').getBoundingClientRect(), m = e.getBoundingClientRect(); if (m.bottom > c.bottom + 1) out.push('a matched word is cut: ' + e.innerText); }
    if (cs.webkitLineClamp !== 'none' && e.scrollHeight > e.clientHeight + 1 && !(e.classList.contains('fnt') && !e.querySelector('mark')) && !e.matches('.clamp2, .cgn.nm, .tdst > span') && !e.closest('.fdrop')) out.push('cut by a line clamp: ' + e.innerText.slice(0, 40));   // a plain title may end in two lines; nothing else (a matched word, a number, a date) may be cut
  });
  for (const el of wl.querySelectorAll('.ir2')) { if (el.closest('.fdrop')) continue; const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), cs = []; let n; while ((n = w.nextNode())) for (let i = 0; i < n.length; i++) cs.push([n, i]);
    for (let k = 0; k < cs.length; k++) { const [n, i] = cs[k]; if (n.data[i] !== '\u00b7') continue; let j = k + 1; while (j < cs.length && /\s/.test(cs[j][0].data[cs[j][1]])) j++; if (j >= cs.length) continue;
      const rg = (c) => { const r = document.createRange(); r.setStart(c[0], c[1]); r.setEnd(c[0], c[1] + 1); return r.getBoundingClientRect(); };
      if (rg(cs[j]).top > rg(cs[k]).top + 2) out.push('a line ends on a separator: ' + el.innerText.slice(0, 50)); } }
  const inp = document.querySelector('.findb input'); if (inp && inp.scrollWidth > inp.clientWidth + 1 && getComputedStyle(inp).textOverflow !== 'ellipsis') out.push('find box placeholder cut without dots');
  return out; }"""
DAYS = """() => [...document.querySelectorAll('#wl .kd')].filter(k => /days?$/.test(k.innerText.trim()) && k.getClientRects().length > 1).map(k => k.innerText)"""
# the lines a text is drawn in: [[text of line 1], ...] by the top of each character
LINES = """sel => { const el = document.querySelector(sel), w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), L = []; let n;
  while ((n = w.nextNode())) for (let i = 0; i < n.length; i++) { const r = document.createRange(); r.setStart(n, i); r.setEnd(n, i + 1); const b = r.getBoundingClientRect(); if (!b.width && /\\s/.test(n.data[i])) continue; const t = Math.round(b.top); let l = L.find(x => Math.abs(x[0] - t) < 4); if (!l) L.push(l = [t, '']); l[1] += n.data[i]; }
  return L.map(x => x[1].trim()); }"""
# Search's "Other bills" rows: the number shows, every matched word is inside its row, a clamped title hides no matched word
OTHER = """() => { const out = []; for (const a of document.querySelectorAll('#wl .fit')) { const ar = a.getBoundingClientRect(), no = a.querySelector('.no');
  if (no) { const r = no.getBoundingClientRect(); if (!r.width || !no.getClientRects().length || r.right > ar.right + 0.5 || r.bottom > ar.bottom + 0.5) out.push('number not shown: ' + no.innerText); }
  for (const m of a.querySelectorAll('mark')) { const r = m.getBoundingClientRect(), f = m.closest('.fnt'); if (r.bottom > ar.bottom + 0.5 || r.right > ar.right + 0.5 || (f && r.bottom > f.getBoundingClientRect().bottom + 1)) out.push('a matched word is outside its row: ' + m.innerText); }
  for (const f of a.querySelectorAll('.fnt')) if (f.scrollHeight > f.clientHeight + 1 && ![...f.querySelectorAll('mark')].every(m => m.getBoundingClientRect().bottom <= f.getBoundingClientRect().bottom + 1)) out.push('a clamped title hides a matched word: ' + f.innerText.slice(0, 40));
  const t = a.querySelector('.ftag'); if (t) { const tr = t.getBoundingClientRect(), s = a.querySelector('.fnt').getBoundingClientRect(), fw = a.querySelector('.fn').getBoundingClientRect().width; if (tr.top < s.bottom - 1) out.push('the pill is on the title rows: ' + a.innerText.slice(0, 30)); if (fw < ar.width * 0.7) out.push('room for the title is only ' + Math.round(fw) + ': ' + a.innerText.slice(0, 30)); } }
  return out; }"""
# where the hyphen of every "e-cig" is drawn compared with the letter after it (client rects of the characters, not innerText)
ECIG = """() => { const out = []; let seen = 0; for (const f of document.querySelectorAll('#wl .fnt')) { const w = document.createTreeWalker(f, NodeFilter.SHOW_TEXT), cs = []; let n; while ((n = w.nextNode())) for (let i = 0; i < n.length; i++) cs.push([n, i]);
  const txt = cs.map(c => c[0].data[c[1]]).join(''); for (const m of txt.matchAll(/e-cig/gi)) { seen++; const rg = c => { const r = document.createRange(); r.setStart(c[0], c[1]); r.setEnd(c[0], c[1] + 1); return r.getBoundingClientRect(); };
    const e = rg(cs[m.index]), h = rg(cs[m.index + 1]), c = rg(cs[m.index + 2]); if (Math.abs(e.top - h.top) > 2 || Math.abs(h.top - c.top) > 2) out.push('e-cig broken: ' + txt.slice(0, 50)); } } return { out, seen }; }"""

with sync_playwright() as p:
    br = p.chromium.launch()

    # ============================================================ 340 by default on every door, both desktop sizes
    pg = open_as(br, 'NT', 1440, 900, '#/'); ids = pg.evaluate(IDS); pg.context.close()
    DOORS = [('Home', '#/'), ('Issues', '#/issues'), ('an issue page', f'#/issue/{ids["issue"]}'), ('Calendar List', '#/calendar?view=list'), ('Search', '#/search?q=school')]
    for (w, h) in ((1440, 900), (1280, 800)):
        pg = open_as(br, 'NT', w, h, '#/')
        for name, hs in DOORS:
            go(pg, hs)
            ok(now_w(pg) == 340, f'{w}x{h}: {name}: the list is 340 wide by default ({now_w(pg)})')
            ok(pg.locator('#wsz').count() == 1 and pg.evaluate("() => { const a = document.getElementById('wl').getBoundingClientRect(), b = document.getElementById('wsz').getBoundingClientRect(); return Math.abs(b.left - (a.right - 4)) < 1.5 && Math.round(b.width) === 20; }"), f'{w}x{h}: {name}: the handle is one 20px strip starting 4px inside the list\'s right edge')
        pg.context.close()

    # ============================================================ drag +100 -> 440; held on the other doors and after a reload; another person has 340
    pg = open_as(br, 'NT', 1440, 900, '#/issues')
    ok(pg.evaluate("() => { const h = document.getElementById('wsz'); return h.getAttribute('role') === 'separator' && h.getAttribute('aria-orientation') === 'vertical' && h.tabIndex === 0 && h.getAttribute('aria-label') === 'Width of the list' && h.getAttribute('aria-controls') === 'wl' && h.title === 'Drag to change the width. Double-click for the usual width.' && !!document.getElementById(h.getAttribute('aria-describedby'))?.innerText.match(/Arrow keys/) && !!document.getElementById('wl'); }"), 'the handle has its role, label, title, controls and a description for a screen reader')
    ok(pg.evaluate("() => { const h = document.getElementById('wsz'); return ['valuemin', 'valuemax', 'valuenow'].every(k => /^\\d+$/.test(h.getAttribute('aria-' + k))) && h.getAttribute('aria-valuetext') === '340 pixels wide' && h.getAttribute('aria-valuenow') === '340' && h.getAttribute('aria-valuemin') === '300' && h.getAttribute('aria-valuemax') === '560'; }"), 'at rest the handle says 340 of 300 to 560, in pixels')
    ok(pg.evaluate("() => getComputedStyle(document.getElementById('wsz'), '::after').opacity") == '0', 'nothing shows at rest')
    snap(pg, 'width_rest.png')
    drag(pg, dx=100)
    ok(now_w(pg) == 440, f'dragged 100 to the right: 440 ({now_w(pg)})')
    ok(pg.evaluate("() => document.getElementById('wsz').getAttribute('aria-valuenow') + '|' + document.getElementById('wsz').getAttribute('aria-valuetext')") == '440|440 pixels wide', 'the handle\'s numbers follow the drag')
    ok(pg.evaluate(STORED, KEY) == {'NT': 440}, f'it is stored under the person\'s initials ({pg.evaluate(STORED, KEY)})')
    ok(not pg.evaluate("() => document.body.classList.contains('wdrag') || document.getElementById('wsz').classList.contains('on')"), 'after the drag the marks are gone')
    for name, hs in DOORS: go(pg, hs); ok(now_w(pg) == 440, f'{name}: 440 holds on the other doors ({now_w(pg)})')
    pg.reload(); pg.wait_for_selector('.paper'); pg.wait_for_timeout(500); ok(now_w(pg) == 440, f'after a reload: still 440 ({now_w(pg)})')
    pg.goto(f'{BASE}/staff7.html?demo=1&as=JM#/issues'); pg.wait_for_selector('.paper'); pg.wait_for_timeout(600)
    ok(now_w(pg) == 340, f'another person (JM) on the same device has 340 ({now_w(pg)})')
    pg.goto(f'{BASE}/staff7.html?demo=1&as=nt#/issues'); pg.wait_for_selector('.paper'); pg.wait_for_timeout(600)
    ok(now_w(pg) == 440, f'initials are not case sensitive: as=nt has 440 ({now_w(pg)})')
    pg.context.close()

    # a click with no movement saves nothing; Escape puts the width back; a stored value that is not a number is ignored, one that is too big is held
    pg = open_as(br, 'NT', 1440, 900, '#/issues')
    b = pg.locator('#wsz').bounding_box(); pg.mouse.click(b['x'] + 10, 450); pg.wait_for_timeout(150)
    ok(pg.evaluate(STORED, KEY) is None and now_w(pg) == 340, 'a click on the handle with no movement saves nothing')
    drag(pg, dx=80, release=False); ok(now_w(pg) == 420 and pg.evaluate("() => document.getElementById('wsz').classList.contains('on') && document.body.classList.contains('wdrag')"), 'while dragging the handle shows its line and the page does not select text')
    snap(pg, 'width_dragging.png')
    pg.keyboard.press('Escape'); pg.wait_for_timeout(100); pg.mouse.move(900, 450, steps=3); pg.mouse.up(); pg.wait_for_timeout(150)
    ok(now_w(pg) == 340 and pg.evaluate(STORED, KEY) is None and not pg.evaluate("() => document.body.classList.contains('wdrag')"), f'Escape during a drag puts back the width it started from, saves nothing, and later moves do nothing ({now_w(pg)})')
    pg.context.close()
    for bad_v, want, why in (('"wide"', 340, 'not a number'), (None, 340, 'null'), (9999, 560, 'too big'), (10, 300, 'too small')):
        pg = open_as(br, 'NT', 1440, 900, '#/issues', store={'NT': json.loads(bad_v) if isinstance(bad_v, str) else bad_v})
        ok(now_w(pg) == want, f'a stored value that is {why} gives {want} ({now_w(pg)})'); pg.context.close()
    pg = open_as(br, 'NT', 1440, 900, '#/issues', store='not json {'); ok(now_w(pg) == 340 and not ERRS[-1:] , 'a stored value that is not even JSON is ignored'); pg.context.close()

    # ============================================================ the extremes: 300 on the left; the largest on the right; the page column never under 400
    for (w, h) in ((1440, 900), (1280, 800), (1024, 768), (900, 700)):
        pg = open_as(br, 'NT', w, h, '#/issues')
        drag(pg, to=0, steps=12); a = now_w(pg)
        drag(pg, to=w + 200, steps=12); z = now_w(pg); want = largest(pg)
        ok(a == 300, f'{w}x{h}: dragged far left: 300 ({a})')
        ok(z == want, f'{w}x{h}: dragged far right: min(560, 45% of the page area) = {want} ({z})')
        ok(pg.evaluate(WP) >= 400, f'{w}x{h}: at the largest the page column is {pg.evaluate(WP)} wide (400 or more)')
        ok(pg.evaluate("() => document.getElementById('wsz').getAttribute('aria-valuenow') === String(document.getElementById('wl').offsetWidth)"), f'{w}x{h}: the handle reads the real width')
        pg.context.close()
    # a stored 560 in a narrow window: the column is held by the style and the handle says the real number
    pg = open_as(br, 'NT', 1024, 768, '#/issues', store={'NT': 560}); real = now_w(pg)
    ok(0 <= real - largest(pg) <= 1 and pg.evaluate("() => document.getElementById('wsz').getAttribute('aria-valuenow')") == str(largest(pg)) == pg.evaluate("() => document.getElementById('wsz').getAttribute('aria-valuemax')"), f'a stored 560 in a 1024 window is drawn at the largest ({real} rounded; the style does not round down) and read as {largest(pg)}, which is the handle\'s largest')
    pg.set_viewport_size({'width': 1440, 'height': 900}); pg.wait_for_timeout(300)
    ok(now_w(pg) == 560 and pg.evaluate("() => document.getElementById('wsz').getAttribute('aria-valuenow')") == '560', 'the window grows: the stored 560 is drawn and read as 560 (resize needs no redraw)')
    pg.context.close()

    # ============================================================ at 300 and at the largest: nothing cut off or sideways, on every door and a topic page
    for label, n in (('300', 300), ('largest', 560)):
        pg = open_as(br, 'NT', 1440 if n == 300 else 1280, 900 if n == 300 else 800, '#/issues', store={'NT': n})
        topic = pg.evaluate("() => document.querySelector('a.tp')?.getAttribute('href')")
        pg.evaluate("() => { location.hash = '#/issues?who=all'; }"); pg.wait_for_timeout(500)
        topic = topic or pg.evaluate("() => document.querySelector('a.tp')?.getAttribute('href')")
        pages = DOORS + [('Everyone', '#/issues?who=all'), ('an issues topic page', topic or '#/issues'), ('Calendar List with a hearing opened', None)]
        for name, hs in pages:
            if hs is None:
                go(pg, '#/calendar?view=list'); href = pg.evaluate("() => document.querySelector('#wl a[data-sit]')?.getAttribute('href')")
                if not href: continue
                go(pg, href)
            else: go(pg, hs)
            if name == 'Search': pg.wait_for_timeout(600)
            bad = pg.evaluate(CHECK); ok(not bad, f'{label}: {name}: nothing cut off or scrolling sideways {bad}')
            if n == 300: ok(now_w(pg) == 300, f'{label}: {name}: the list is 300')
            lone = pg.evaluate(DAYS); ok(not lone, f'{label}: {name}: a count of days is never split across lines {lone}')
        if n == 300:
            go(pg, '#/issues'); snap(pg, 'width_issues_300.png')
            go(pg, '#/search?q=school'); snap(pg, 'width_search_300.png')
            go(pg, '#/search?q=e-cig'); ok(pg.evaluate("() => [...document.querySelectorAll('#wl .fn b')].every(b => !/e-$/.test(b.innerText.split('\\n')[0].trim()))") and not pg.evaluate(CHECK), '300: "e-cigarette" is never split after "e-" in a result title')
        pg.context.close()
    # tabs at every width between: the narrowest to a little over the usual
    pg = open_as(br, 'NT', 1440, 900, '#/issues')
    bad = []
    for n in range(300, 361, 4):
        pg.evaluate("n => document.documentElement.style.setProperty('--list-w', n + 'px')", n); pg.wait_for_timeout(60)
        b = pg.evaluate(CHECK)
        if b: bad.append((n, b))
    ok(not bad, f'every width from 300 to 360 on Issues: nothing cut off ({bad[:2]})')
    pg.context.close()
    # the tab padding is tighter only when the column is narrow; at 340 it is what it was
    pg = open_as(br, 'NT', 1440, 900, '#/issues')
    pad = lambda: pg.evaluate("() => getComputedStyle(document.querySelector('.segs3 .seg')).paddingLeft")
    a = pad(); pg.evaluate("document.documentElement.style.setProperty('--list-w', '300px')"); pg.wait_for_timeout(100); b = pad()
    ok(a == '12px' and b == '4px', f'tab padding: 12px at 340, 4px at 300 ({a}, {b})'); pg.context.close()

    # ============================================================ keyboard
    pg = open_as(br, 'NT', 1440, 900, '#/issues')
    last = pg.evaluate("() => { const f = [...document.querySelectorAll('#wl a[href], #wl button, #wl input, #wl [tabindex=\"0\"]')].filter(e => e.getClientRects().length && !e.disabled); const e = f[f.length - 1]; e.focus(); return e.tagName; }")
    pg.keyboard.press('Tab')
    ok(pg.evaluate("() => document.activeElement.id") == 'wsz', 'Tab from the last thing in the list reaches the handle')
    pg.keyboard.press('Tab'); ok(pg.evaluate("() => !!document.activeElement.closest('.wp')"), 'and the next Tab goes into the page')
    pg.keyboard.press('Shift+Tab'); pg.wait_for_timeout(250)
    ok(pg.evaluate("() => document.activeElement.id") == 'wsz', 'Shift+Tab comes back to the handle')
    line = pg.evaluate("() => { const c = getComputedStyle(document.getElementById('wsz'), '::after'); return [c.opacity, parseFloat(c.width), parseFloat(c.height), c.backgroundColor]; }")
    ok(line[0] == '1' and line[1] >= 2 and line[2] > 300 and line[3] != 'rgba(0, 0, 0, 0)', f'focused, the handle paints a line: opacity {line[0]}, {line[1]}px wide, {line[2]}px tall, {line[3]}')
    snap(pg, 'width_focus.png')
    seq = [('ArrowRight', 356), ('ArrowRight', 372), ('ArrowLeft', 356), ('Shift+ArrowRight', 420), ('Shift+ArrowLeft', 356), ('Home', 300), ('ArrowLeft', 300), ('End', 560), ('ArrowRight', 560), ('Enter', 340)]
    for k, want in seq:
        pg.keyboard.press(k); pg.wait_for_timeout(60)
        ok(now_w(pg) == want and pg.evaluate("() => document.getElementById('wsz').getAttribute('aria-valuenow')") == str(want) and pg.evaluate("() => document.getElementById('wsz').getAttribute('aria-valuetext')") == f'{want} pixels wide', f'{k}: {want} and the handle says so ({now_w(pg)})')
        if k == 'ArrowRight' and want == 356: ok(pg.evaluate(STORED, KEY) == {'NT': 356}, 'a key press is stored')
        if k == 'Enter': ok(pg.evaluate(STORED, KEY) in ({}, None), f'Enter restores the usual width and clears the stored one ({pg.evaluate(STORED, KEY)})')
    ok(pg.evaluate("() => document.activeElement.id") == 'wsz', 'the handle keeps focus through all of it')
    pg.keyboard.press('Home'); pg.keyboard.press('a'); ok(now_w(pg) == 300, 'a key the handle does not use does nothing')
    pg.context.close()

    # ============================================================ double-click
    pg = open_as(br, 'NT', 1440, 900, '#/issues'); drag(pg, dx=100); ok(now_w(pg) == 440, 'set to 440 to be reset')
    b = pg.locator('#wsz').bounding_box(); pg.mouse.dblclick(b['x'] + 10, 450); pg.wait_for_timeout(200)
    ok(now_w(pg) == 340 and pg.evaluate(STORED, KEY) in ({}, None) and pg.evaluate("() => document.documentElement.style.getPropertyValue('--list-w')") == '', f'double-click: back to 340, the stored value and the inline one are gone ({now_w(pg)}, {pg.evaluate(STORED, KEY)})')
    pg.context.close()

    # ============================================================ a redraw: focus and width kept; a drag that is going is not broken
    pg = open_as(br, 'NT', 1440, 900, '#/issues')
    pg.focus('#wsz'); pg.keyboard.press('ArrowRight'); w0 = now_w(pg)
    pg.evaluate("window.__staff7Render({ tick: true })"); pg.wait_for_timeout(200)
    ok(pg.evaluate("() => document.activeElement.id") == 'wsz' and now_w(pg) == w0, f'a tick redraw keeps the handle\'s focus and the width ({w0})')
    pg.evaluate("window.__staff7Tick()"); pg.wait_for_timeout(200); ok(pg.evaluate("() => document.activeElement.id") == 'wsz', 'the minute\'s own tick keeps focus too')
    ok(pg.evaluate("() => document.getElementById('wsz').getAttribute('aria-valuenow')") == str(w0), 'and the numbers')
    pg.context.close()
    pg = open_as(br, 'NT', 1440, 900, '#/issues')
    b = pg.locator('#wsz').bounding_box(); x, y = b['x'] + b['width'] / 2, 450
    pg.mouse.move(x, y); pg.mouse.down(); pg.mouse.move(x + 60, y, steps=6); pg.wait_for_timeout(100)
    pg.evaluate("() => { document.getElementById('wl').__same = 1; }"); pg.evaluate("window.__staff7Tick()"); pg.wait_for_timeout(100)
    ok(pg.evaluate("() => document.getElementById('wl').__same === 1"), 'the minute\'s tick is skipped while a drag is going (nothing is drawn again)')
    pg.evaluate("window.__staff7Render({ tick: true })"); pg.wait_for_timeout(100)
    ok(pg.evaluate("() => document.getElementById('wl').__same !== 1 && document.getElementById('wsz').classList.contains('on') && document.body.classList.contains('wdrag')"), 'a forced redraw in the middle of a drag: the new handle carries the drag\'s mark')
    pg.mouse.move(x + 100, y, steps=6); pg.wait_for_timeout(100); pg.mouse.up(); pg.wait_for_timeout(150)
    ok(now_w(pg) == 440, f'down, move, redraw, move, up: the width followed the last move ({now_w(pg)})')
    ok(not pg.evaluate("() => document.getElementById('wsz').classList.contains('on') || document.body.classList.contains('wdrag')") and pg.evaluate(STORED, KEY) == {'NT': 440}, 'afterwards the marks are gone and 440 is stored')
    pg.evaluate("window.__staff7Render({ tick: true })"); pg.mouse.move(x - 200, y, steps=4); pg.wait_for_timeout(100); ok(now_w(pg) == 440, 'a move after the release changes nothing')
    # a route change in the middle of a drag (hashchange redraws the page too)
    b = pg.locator('#wsz').bounding_box(); x = b['x'] + b['width'] / 2
    pg.mouse.move(x, y); pg.mouse.down(); pg.mouse.move(x - 40, y, steps=4); pg.evaluate("location.hash = '#/search?q=school'"); pg.wait_for_timeout(500); pg.mouse.move(x - 140, y, steps=4); pg.mouse.up(); pg.wait_for_timeout(150)
    ok(now_w(pg) == 300 and pg.evaluate(STORED, KEY) == {'NT': 300}, f'a new page drawn in the middle of a drag does not break it ({now_w(pg)})')
    pg.context.close()

    # ============================================================ no handle where there is no list beside a page; the Week grid keeps 340 whatever is stored
    pg = open_as(br, 'NT', 1440, 900, '#/calendar', store={'NT': 500})
    ok(pg.locator('.ws.gridws').count() == 1 and pg.locator('#wsz').count() == 0, 'Calendar\'s Week view has no handle')
    wk = now_w(pg) if pg.locator('#wl').count() else pg.evaluate("() => Math.round(document.querySelector('.wl').getBoundingClientRect().width)")
    ok(wk == 340, f'and its header column stays 340 (the same as the List\'s usual width, so the switch does not move) whatever is stored ({wk})')
    snap(pg, 'width_week.png')
    go(pg, '#/explore'); ok(pg.locator('.ws.one').count() == 1 and pg.locator('#wsz').count() == 0, 'a one-column page (Explore) has no handle')
    go(pg, '#/calendar?view=list'); ok(pg.locator('#wsz').count() == 1 and now_w(pg) == 500, 'back on the List the handle is there and 500 is kept')
    ok(not pg.evaluate("() => { for (const e of document.elementsFromPoint(innerWidth / 2, 400)) if (e.closest('.wsz')) return true; return false; }"), 'the handle is only a thin strip (the middle of the page is not under it)')
    pg.context.close()

    # ============================================================ the handle is in nobody's way: nothing clickable under its strip on the paper; the list's scrollbar can still be taken
    for name, hs in DOORS:
        pg = open_as(br, 'NT', 1440, 900, hs)
        r = pg.evaluate("""() => { const b = document.getElementById('wsz').getBoundingClientRect(), wl = document.getElementById('wl').getBoundingClientRect(), hits = [];
          for (let y = 30; y < innerHeight - 10; y += 12) for (const x of [b.left + 12, b.left + 16, b.left + 19]) { const st = document.elementsFromPoint(x, y); const i = st.findIndex(e => e.closest('.wsz')); if (i < 0) continue; for (const e of st.slice(i + 1)) { if (e.closest('a[href], button, input, select, textarea, [tabindex=\"0\"]') && !e.closest('.wsz')) { hits.push(e.tagName + '@' + Math.round(x) + ',' + y); break; } } }
          const wlEl = document.getElementById('wl'); return { hits, bar: wlEl.offsetWidth - wlEl.clientWidth, inside: document.elementFromPoint(wl.right - 8, 300)?.closest('#wl') !== null }; }""")
        ok(not r['hits'], f'{name}: nothing clickable under the handle on the page side {r["hits"][:3]}')
        if name == 'Issues': ok(r['inside'], f'the point 8px inside the list\'s right edge is the list, not the handle (the list\'s scrollbar here is {r["bar"]}px wide: overlay scrollbars when 0; classic scrollbars are not tested in this headless run)')
        pg.context.close()

    # ============================================================ phones: no handle, and the layout is the same whatever is stored
    for (w, h) in ((390, 844), (320, 640)):
        boxes = {}
        for tag, store in (('none', None), ('500', {'NT': 500})):
            pg = open_as(br, 'NT', w, h, '#/', store=store)
            for name, hs in (('Home', '#/'), ('Issues', '#/issues'), ('Calendar', '#/calendar'), ('Search', '#/search?q=school')):
                go(pg, hs)
                boxes[(tag, name)] = pg.evaluate("() => ['.wl', '.wp', '.paper', '.ws'].map(s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return [s, Math.round(r.left * 10), Math.round(r.top * 10), Math.round(r.width * 10), Math.round(r.height * 10)]; })")
                if tag == 'none': ok(pg.locator('.wsz').count() == 0 or not pg.locator('.wsz').first.is_visible(), f'{w}x{h}: {name}: no visible handle')
            pg.context.close()
        for name in ('Home', 'Issues', 'Calendar', 'Search'):
            ok(boxes[('none', name)] == boxes[('500', name)], f'{w}x{h}: {name}: .wl and .wp are in the same place with 500 stored')

    # ---- the phone is what it was at HEAD: fixed expectations taken from the page before R-398 (a comparison with the new code itself cannot catch a change)
    for (w, h, want_h, want_lines) in ((320, 640, 71.4, ['Committee deadline · Mon, Mar 30 · 14', 'days']), (390, 844, 52.5, ['Committee deadline · Mon, Mar 30 · 14 days']), (899, 700, 52.5, ['Committee deadline · Mon, Mar 30 · 14 days'])):
        pg = open_as(br, 'NT', w, h, '#/issues')
        r = pg.evaluate("() => ({ h: document.getElementById('sessionRow').getBoundingClientRect().height, ir: document.querySelector('#sessionRow .ir2').getBoundingClientRect().height, items: [...document.querySelector('#sessionRow .ir2').children].length, kd: [...document.querySelectorAll('#sessionRow .kd')].map(k => getComputedStyle(k).whiteSpace === getComputedStyle(k.parentElement).whiteSpace) })")
        L = pg.evaluate(LINES, '#sessionRow .ir2')
        ok(abs(r['h'] - want_h) < 0.5 and L == want_lines and r['items'] == 1 and all(r['kd']), f'{w}x{h}: the session row is {want_h} tall and reads {want_lines} as before R-398 (now {round(r["h"], 1)}, {L}, {r["items"]} flex item(s), kd spans like their parent {r["kd"]})')
        go(pg, '#/search?q=e-cig')
        ok(all(x for x in pg.evaluate("() => [...document.querySelectorAll('#wl .kd')].map(k => getComputedStyle(k).whiteSpace === getComputedStyle(k.parentElement).whiteSpace)")), f'{w}x{h}: nothing is held together under 900px (the "kd" spans have no rule)')
        pg.context.close()

    # ============================================================ Search's "Other bills": the number always shows, the pill is not on the title's rows, no matched word is clamped away
    for q in ('school', 'tax'):
        for n in (340, 300):
            pg = open_as(br, 'NT', 1440, 900, '#/search?q=' + q, store={'NT': n}); pg.wait_for_timeout(600)
            rows = pg.evaluate("() => document.querySelectorAll('#wl .fit').length"); bad = pg.evaluate(OTHER)
            ok(rows > 0 and not bad, f'q={q} at {n}: {rows} result rows: every number shows, every matched word is in its row, the pill is under the words and the title keeps the width {bad[:2]}')
            ok(not pg.evaluate(CHECK), f'q={q} at {n}: nothing cut off {pg.evaluate(CHECK)[:2]}')
            if n == 300 and q == 'school': pg.evaluate("() => { const a = [...document.querySelectorAll('#wl .ftag')][0]; if (a) a.scrollIntoView({ block: 'center' }); }"); snap(pg, 'width_search_other_300.png')
            pg.context.close()

    # ============================================================ "e-cigarette" is never broken after "e-", marked or not
    for q in ('e-cig', 'cig', 'e-cigarettes', 'vape'):
        for n in (300, 340):
            pg = open_as(br, 'NT', 1440, 900, '#/search?q=' + q, store={'NT': n}); pg.wait_for_timeout(500)
            r = pg.evaluate(ECIG); ok(r['seen'] > 0 and not r['out'] and pg.evaluate("() => document.querySelector('#findIn, .findb input')?.value") == q, f'q={q} at {n}: "e-cigarette" is drawn whole in {r["seen"]} title(s), and the search box still says {q!r} {r["out"][:1]}')
            if q == 'e-cig': ok(pg.evaluate("() => [...document.querySelectorAll('#wl .fnt mark')].map(m => m.innerText).join('|')").lower().startswith('e'), f'q={q} at {n}: the typed letters are still marked')
            if q == 'e-cig' and n == 300: snap(pg, 'width_search_ecig_300.png')
            pg.context.close()

    # ============================================================ a mouse drag leaves nothing lit; a drag whose pointerup never comes ends
    pg = open_as(br, 'NT', 1440, 900, '#/issues')
    drag(pg, dx=60); pg.mouse.move(900, 450, steps=3); pg.wait_for_timeout(400)
    ok(pg.evaluate("() => getComputedStyle(document.getElementById('wsz'), '::after').opacity") == '0' and pg.evaluate("() => document.activeElement.id") != 'wsz', 'after a mouse drag and the pointer moved away the line is gone (opacity 0) and the handle is not focused')
    pg.keyboard.press('Tab'); pg.keyboard.press('Shift+Tab'); pg.wait_for_timeout(300)
    pg.context.close()
    SYN = """([kind]) => { const h = document.getElementById('wsz'), b = h.getBoundingClientRect(), ev = (t, o) => new PointerEvent(t, Object.assign({ pointerId: 7, bubbles: true, clientX: b.left + 10, clientY: 400, button: 0, buttons: 1 }, o));
      h.dispatchEvent(ev('pointerdown')); document.dispatchEvent(ev('pointermove', { clientX: b.left + 70 })); return new Promise(res => requestAnimationFrame(() => requestAnimationFrame(() => {
        const mid = document.body.classList.contains('wdrag') && document.getElementById('wsz').classList.contains('on');
        if (kind === 'buttons') document.dispatchEvent(ev('pointermove', { clientX: b.left + 90, buttons: 0 })); else window.dispatchEvent(new Event('blur'));
        requestAnimationFrame(() => res([mid, document.body.classList.contains('wdrag'), document.getElementById('wsz').classList.contains('on')])); }))); }"""
    for kind, what in (('buttons', 'a move with no button down'), ('blur', 'the window losing focus')):
        pg = open_as(br, 'NT', 1440, 900, '#/issues'); r = pg.evaluate(SYN, [kind]); w1 = now_w(pg)
        ok(r == [True, False, False] and w1 > 340, f'a drag is going, then {what}: it ends and the marks go ({r}; width {w1})')
        pg.mouse.move(600, 450, steps=3); ok(now_w(pg) == w1, 'and a later move does not drag'); pg.context.close()

    # ============================================================ the numbers the handle reports never pass its largest
    for ww in (1200, 1000, 900, 1024, 1100):
        pg = open_as(br, 'NT', ww, 800, '#/issues', store={'NT': 560})
        a = pg.evaluate("() => { const h = document.getElementById('wsz'), g = k => +h.getAttribute('aria-' + k); return [g('valuemin'), g('valuenow'), g('valuemax'), h.getAttribute('aria-valuetext')]; }")
        ok(a[0] <= a[1] <= a[2] and a[3] == f'{a[1]} pixels wide' and abs(a[1] - pg.evaluate("() => document.getElementById('wl').getBoundingClientRect().width")) < 1, f'{ww} wide, 560 stored: valuenow {a[1]} is within {a[0]}..{a[2]} and is the column\'s width'); pg.context.close()

    # ============================================================ Calendar's List at 300: Previous week and Next week share a row
    pg = open_as(br, 'NT', 1440, 900, '#/calendar?view=list', store={'NT': 300})
    r = pg.evaluate("() => { const a = document.getElementById('wkPrev').getBoundingClientRect(), b = document.getElementById('wkNext').getBoundingClientRect(), wl = document.getElementById('wl'); return { same: Math.abs(a.top - b.top) < 2, over: wl.scrollWidth > wl.clientWidth, cut: [...document.querySelectorAll('.wknav .btn')].some(x => x.scrollWidth > x.clientWidth + 1) }; }")
    ok(r['same'] and not r['over'] and not r['cut'], f'Calendar List at 300: Previous week and Next week are on one row, nothing cut {r}'); snap(pg, 'width_calendar_list_300.png'); pg.context.close()

    # ============================================================ a hearing sheet's folds are not opened or closed by a drag and a redraw (calendar.js decides the fold from the width at each draw)
    pg = open_as(br, 'KR', 1280, 800, '#/calendar?view=list')
    href = pg.evaluate("() => document.querySelector('#wl a[data-sit]')?.getAttribute('href')")
    if href:
        go(pg, href); f0 = pg.evaluate("() => [...document.querySelectorAll('.fbtn')].map(b => [b.dataset.fold, b.getAttribute('aria-expanded')])")
        cq0 = pg.evaluate("() => document.querySelector('.cq').clientWidth")
        drag(pg, dx=120); cq1 = pg.evaluate("() => document.querySelector('.cq').clientWidth")
        pg.evaluate("window.__staff7Render({ tick: true })"); pg.wait_for_timeout(200)
        f1 = pg.evaluate("() => [...document.querySelectorAll('.fbtn')].map(b => [b.dataset.fold, b.getAttribute('aria-expanded')])")
        print(f'     info: the sheet was {cq0} wide with folds {f0}; after a drag of 120 it is {cq1}, after a redraw the folds are {f1}')
        ok(f0 == f1, f'a drag then a redraw does not open or close a fold nobody pressed ({f0} -> {f1})')
    else: ok(False, 'a hearing is in the week for the fold check')
    pg.context.close()

    # ============================================================ the whole run
    ok(not ERRS, f'no console error ({ERRS[:2]})')
    ok(not BAD, f'nothing was requested outside 127.0.0.1 ({BAD[:2]})')
    br.close()
print(f'{sum(res)}/{len(res)} passed')
sys.exit(0 if all(res) else 1)
