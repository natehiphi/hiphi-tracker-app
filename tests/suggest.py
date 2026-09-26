# Suggestions under the header search as you type (R-032, pub/suggest.js). python3 tests/suggest.py [host]
# Both apps: the public tracker's header box, then Staff v2's (the same component, its own list).
# The public tracker's header box (900px and wider): issues and bills listed from the third character, the arrow keys,
# Enter, Esc, a click, "See all results", nothing on Find itself (its own results are the list), what was typed kept
# when the page redraws, the list inside the window at every laptop size, and the live site's bills from the database.
import os, sys, re
from playwright.sync_api import sync_playwright
HOST = sys.argv[1] if len(sys.argv) > 1 else os.environ.get('HOST', 'http://localhost:8832')
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out', 'suggest'); os.makedirs(OUT, exist_ok=True)
passes, fails, errors = [], [], []
def ok(c, m): (passes if c else fails).append(('PASS ' if c else 'FAIL ') + m)

def ctx(b, w, h, touch=False):
    c = b.new_context(viewport={'width': w, 'height': h}, is_mobile=w < 600, has_touch=touch or w < 600)
    p = c.new_page(); p.on('pageerror', lambda e: errors.append(f'{w}: {e}'))
    p.on('console', lambda m: errors.append(f'console {w}: {m.text[:160]}') if m.type == 'error' and 'favicon' not in m.text else None)
    return c, p
def visit(p, h, demo=True, wait=2600):
    p.goto(f"{HOST}/track.html{'?demo=1' if demo else ''}#{h.lstrip('#')}"); p.reload(); p.wait_for_timeout(wait)
def typein(p, q, wait=450):
    box = p.locator('#hq'); box.click(); box.fill(''); box.type(q, delay=30); p.wait_for_timeout(wait)
def state(p):
    return p.evaluate("""() => { const b = document.querySelector('.sg'), i = document.getElementById('hq');
      const r = b && b.getBoundingClientRect();
      return { open: !!b, expanded: i && i.getAttribute('aria-expanded'), ad: i && i.getAttribute('aria-activedescendant'), value: i && i.value,
        focused: document.activeElement === i, hash: location.hash, w: innerWidth, h: innerHeight,
        rect: r ? [r.left, r.right, r.top, r.bottom] : null, scroll: b ? [b.scrollHeight, b.clientHeight] : null,
        groups: b ? [...b.querySelectorAll('.sg-h')].map(x => x.textContent) : [],
        opts: b ? [...b.querySelectorAll('[role=option]')].map(o => ({ id: o.id, t: o.querySelector('.sg-l').textContent, s: (o.querySelector('.sg-s') || {}).textContent || '',
          href: o.getAttribute('href'), sel: o.getAttribute('aria-selected'), hgt: o.getBoundingClientRect().height, lw: o.querySelector('.sg-l').getBoundingClientRect().width,
          icpos: getComputedStyle(o.querySelector('.ic')).position, other: /^(Other bills|Not tracked yet)$/.test((o.closest('.sg-g')?.querySelector('.sg-h') || {}).textContent || ''),
          beside: !!o.querySelector('.sg-s') && Math.abs(o.querySelector('.sg-s').getBoundingClientRect().top - o.querySelector('.sg-l').getBoundingClientRect().top) < 6 })) : [],
        note: b && b.querySelector('.sg-note') ? b.querySelector('.sg-note').textContent : '',
        status: (document.querySelector('[data-hsearch] [role=status]') || {}).textContent || '', hdr: (document.querySelector('.hdr, .sv-hdr') || { getBoundingClientRect: () => ({ bottom: 0 }) }).getBoundingClientRect().bottom,
        busy: !!(b && b.classList.contains('sg-busy')), height: r ? r.height : 0 }; }""")

with sync_playwright() as pw:
    b = pw.chromium.launch()
    # ---- the sandbox at the laptop sizes DESIGN.md judges, plus a tablet held sideways (touch) ----
    for (w, h, touch) in [(1280, 800, False), (1440, 900, False), (1024, 768, False), (1024, 768, True)]:
        tag = f'{w}x{h}{" touch" if touch else ""}'
        c, p = ctx(b, w, h, touch); visit(p, '/more')
        typein(p, 'vap'); s = state(p)
        ok(s['open'] and s['expanded'] == 'true', f'{tag}: typing "vap" opens the list')
        ok(s['groups'][:1] == ['Issues'], f'{tag}: issues first {s["groups"]}')
        titles = [o['t'] for o in s['opts'] if not o.get('other')]; ok(len(titles) == len(set(titles)), f'{tag}: no issue or HIPHI bill listed twice (A-14) {titles}')
        ok(3 <= len(s['opts']) <= 8, f'{tag}: seven rows at most, plus See all ({len(s["opts"])})')
        ok(s['opts'] and s['opts'][-1]['t'] == 'See all results for “vap”' and s['opts'][-1]['href'] == '#/find?q=vap', f'{tag}: the last row is See all results')
        ok(any(re.search(r'vap', o['t'], re.I) for o in s['opts']), f'{tag}: a vaping issue or bill is offered')
        r = s['rect']; ok(r and r[0] >= 0 and r[1] <= s['w'] and r[3] <= s['h'], f'{tag}: the list is inside the window {r}')
        ok(s['scroll'][0] <= s['scroll'][1] + 1, f'{tag}: nothing in the list is scrolled out of sight {s["scroll"]}')
        ok(all(o['hgt'] >= 44 for o in s['opts']), f'{tag}: every row is 44px or taller {[round(o["hgt"]) for o in s["opts"]]}')
        ok(all(o['icpos'] == 'static' and o['lw'] > 120 for o in s['opts']), f'{tag}: icons sit beside the words, which have room')
        ok(re.match(r'\d+ suggestions?', s['status']), f'{tag}: a screen reader hears how many ("{s["status"]}")')
        bills = [o for o in s['opts'] if o['href'].startswith('#/bill/')]
        ok(all(re.match(r'[A-Z]+ \d+', o['s']) and o['beside'] and o['hgt'] <= 70 for o in bills), f'{tag}: a bill row has its number beside its name, two lines at most {[(o["s"], round(o["hgt"])) for o in bills]}')
        ok(abs(s['rect'][2] - s['hdr']) <= 1, f'{tag}: the list starts on the header line ({s["rect"][2]} vs {s["hdr"]})')
        if w == 1280 and not touch: p.screenshot(path=f'{OUT}/vap_{w}.png')
        # keys: Down highlights the first row, again the second, Up twice goes back to the box
        p.keyboard.press('ArrowDown'); s1 = state(p); p.keyboard.press('ArrowDown'); s2 = state(p)
        ok(s1['ad'] == s1['opts'][0]['id'] and s1['opts'][0]['sel'] == 'true', f'{tag}: Down highlights the first row')
        ok(s2['ad'] == s2['opts'][1]['id'] and s2['opts'][0]['sel'] == 'false', f'{tag}: Down again moves to the second')
        p.keyboard.press('ArrowUp'); p.keyboard.press('ArrowUp'); s3 = state(p)
        ok(not s3['ad'] and s3['open'], f'{tag}: Up from the first row goes back to the box, list still open')
        if w == 1280 and not touch: p.keyboard.press('ArrowDown'); p.wait_for_timeout(100); p.screenshot(path=f'{OUT}/vap_{w}_down.png'); p.keyboard.press('ArrowUp')
        # Enter on a highlighted row opens it
        p.keyboard.press('ArrowDown'); first = state(p)['opts'][0]['href']; p.keyboard.press('Enter'); p.wait_for_timeout(900); s = state(p)
        ok(s['hash'] == first and not s['open'] and s['value'] == '', f'{tag}: Enter opens the highlighted row ({first} -> {s["hash"]}), box emptied')
        # a bill number, then a click on its row
        visit(p, '/more'); typein(p, 'sb2175'); s = state(p)
        row = next((o for o in s['opts'] if o['s'].startswith('SB 2175')), None)
        ok(row is not None and s['opts'][0]['s'].startswith('SB 2175'), f'{tag}: "sb2175" puts SB 2175 first {[o["s"] for o in s["opts"]][:3]}')
        if row:
            p.locator(f'#{row["id"]}').click(); p.wait_for_timeout(1200); s = state(p)
            ok(s['hash'] == '#/bill/SB2175' and not s['open'], f'{tag}: a click opens the bill ({s["hash"]})')
        # two letters say too little; three open it
        visit(p, '/more'); typein(p, 'sb'); ok(not state(p)['open'], f'{tag}: two letters do not open the list')
        # Esc closes and keeps the words; Enter with nothing highlighted goes to the full results, as before
        typein(p, 'vap'); p.keyboard.press('Escape'); s = state(p)
        ok(not s['open'] and s['expanded'] == 'false' and s['value'] == 'vap', f'{tag}: Esc closes the list and keeps the words')
        typein(p, 'vap'); p.keyboard.press('Enter'); p.wait_for_timeout(1200); s = state(p)
        ok(s['hash'] == '#/find?q=vap' and not s['open'], f'{tag}: Enter with nothing highlighted shows all results ({s["hash"]})')
        # on Find itself the results under the page's box are the list
        typein(p, 'meals', 700); s = state(p)
        ok(not s['open'] and 'q=meals' in s['hash'], f'{tag}: no list on Find; its own results follow the header box ({s["hash"]})')
        # nothing matches: says so, and See all is still there
        visit(p, '/more'); typein(p, 'zzqxw'); s = state(p)
        ok(s['open'] and s['note'].startswith('No issues or bills match “zzqxw”') and s['opts'][-1]['t'] == 'Browse all issues' and s['opts'][-1]['href'] == '#/find', f'{tag}: nothing matching says so and offers the issues ("{s["note"]}")')
        # every bill, not only HIPHI's (Nate, 9/26): a word lists the session's other bills beside HIPHI's
        typein(p, 'water'); s = state(p); oth = [o for o in s['opts'] if o['other']]
        ok('Other bills' in s['groups'] and oth and all(o['href'].startswith('#/bill/') for o in oth), f'{tag}: "water" lists other bills too {s["groups"]}')
        if w == 1280 and not touch: p.screenshot(path=f'{OUT}/water_{w}.png')
        # a word that names a policy lists it once: the issue, not its House and Senate bills beside it
        typein(p, 'disposable vape'); s = state(p); names = [o['t'] for o in s['opts']]
        ok(names.count('Disposable vape ban') == 1 and not any(o['href'].startswith('#/bill/') and o['t'] == 'Disposable vape ban' for o in s['opts']), f'{tag}: a policy is one row {names}')
        # the pointer resting on one row and the keys moving: still one highlighted row
        typein(p, 'school meals'); rows = state(p)['opts']; p.locator(f'#{rows[2]["id"]}').hover(); p.keyboard.press('ArrowDown'); p.wait_for_timeout(100)
        lit = p.evaluate("[...document.querySelectorAll('.sg [role=option]')].filter(o => getComputedStyle(o).backgroundColor !== 'rgba(0, 0, 0, 0)' && getComputedStyle(o).backgroundColor !== 'rgb(255, 255, 255)').length")
        ok(lit == 1, f'{tag}: one row lit when the pointer and the keys disagree ({lit})')
        # the page redraws while someone types (data arriving does this): the words, the focus and the list stay
        typein(p, 'school'); p.evaluate("window.dispatchEvent(new PopStateEvent('popstate', { state: history.state }))"); p.wait_for_timeout(400); s = state(p)
        ok(s['value'] == 'school' and s['focused'] and s['open'], f'{tag}: a redraw keeps the words, the focus and the list ({s["value"]!r}, focused {s["focused"]})')
        # the pointer: hovering a row highlights it; clicking elsewhere closes the list
        opt3 = s['opts'][min(2, len(s['opts']) - 1)]['id']; p.locator(f'#{opt3}').hover(); p.wait_for_timeout(100)
        ok(state(p)['ad'] == opt3, f'{tag}: hovering a row highlights it')
        p.mouse.click(40, s['h'] - 40); p.wait_for_timeout(400); ok(not state(p)['open'], f'{tag}: clicking elsewhere closes the list')
        # a new page does not bring back words typed on the last one
        typein(p, 'vap'); p.evaluate("location.hash = '#/bills'"); p.wait_for_timeout(1200); s = state(p)
        ok(s['value'] == '' and not s['open'], f'{tag}: another page starts with an empty box')
        c.close()

    # ---- a short laptop window: only the rows that fit, so nothing hides below a list that looks finished ----
    for (w, h) in [(1280, 600), (1366, 640)]:
        c, p = ctx(b, w, h); visit(p, '/more'); typein(p, 'vap'); s = state(p)
        ok(s['open'] and s['scroll'][0] <= s['scroll'][1] + 1 and s['rect'][3] <= s['h'], f'{w}x{h}: the list fits without scrolling {s["scroll"]} bottom {s["rect"][3]}')
        ok(s['opts'][-1]['t'].startswith('See all results'), f'{w}x{h}: See all results is still the last row ({len(s["opts"])} rows)')
        if w == 1280: p.screenshot(path=f'{OUT}/short_{w}x{h}.png')
        c.close()

    # ---- Staff v2's header box: tracked bills, issues, legislators and supporters (the sandbox) ----
    def staff(p, h='/'):
        p.goto(f'{HOST}/staff.html?demo=1#{h}'); p.reload(); p.wait_for_timeout(3200)
    for (w, h) in [(1280, 800), (1440, 900), (1024, 768)]:
        tag = f'staff {w}x{h}'
        c, p = ctx(b, w, h); staff(p)
        typein(p, 'HB15'); s = state(p)
        ok(s['open'] and s['groups'][0] == 'Bills' and all(o['s'].startswith('HB 15') for o in s['opts'][:-1]), f'{tag}: "HB15" lists its bills {[o["s"] for o in s["opts"]][:4]}')
        ok(s['opts'][-1]['t'] == 'See all results for “HB15”' and s['opts'][-1]['href'] == '#/search?q=HB15', f'{tag}: See all results opens Search')
        ok(abs(s['rect'][2] - s['hdr']) <= 1.5 and s['rect'][1] <= s['w'] and s['rect'][3] <= s['h'], f'{tag}: the list starts on the header line and fits ({s["rect"]}, header {s["hdr"]})')
        ok(all(o['hgt'] >= 44 and o['icpos'] == 'static' and o['lw'] > 120 for o in s['opts']), f'{tag}: rows 44px or taller, icons beside the words')
        if w == 1280: p.screenshot(path=f'{OUT}/staff_hb15_{w}.png')
        typein(p, 'kusch'); s = state(p)
        ok(s['groups'] == ['Legislators'] and s['opts'][0]['t'] == 'Matthias Kusch', f'{tag}: a legislator by name, not the bills they sponsored {[o["t"] for o in s["opts"]]}')
        typein(p, 'sd 12'); s = state(p)
        ok('Supporters' in s['groups'] and all('SD 12' in o['s'] or 'Senate district 12' in o['s'] for o in s['opts'][:-1]), f'{tag}: "sd 12" is Senate district 12 {[o["s"] for o in s["opts"]]}')
        typein(p, 'school'); s = state(p)
        ok('Issues' in s['groups'] and all('school' in o['t'].lower() for o in s['opts'] if o['href'].startswith('#/bill/')), f'{tag}: "school" lists issues, and bills whose names say school {s["groups"]}')
        if w == 1280: p.screenshot(path=f'{OUT}/staff_school_{w}.png')
        typein(p, 'sample'); ok('Supporters' in state(p)['groups'], f'{tag}: supporters by name')
        p.keyboard.press('ArrowDown'); first = state(p)['opts'][0]['href']; p.keyboard.press('Enter'); p.wait_for_timeout(900)
        ok(state(p)['hash'] == first, f'{tag}: Down and Enter open the first row ({first})')
        staff(p); typein(p, 'HB1562'); p.keyboard.press('Enter'); p.wait_for_timeout(1200)
        ok(state(p)['hash'].startswith('#/bill/HB1562'), f'{tag}: Enter on an exact bill number still opens that bill ({state(p)["hash"]})')
        staff(p); typein(p, 'school'); p.keyboard.press('Escape'); s = state(p)
        ok(not s['open'] and s['value'] == 'school', f'{tag}: Esc closes the list and keeps the words')
        typein(p, 'school'); rows = state(p)['opts']; p.locator(f'#{rows[2]["id"]}').hover(); p.keyboard.press('ArrowDown'); p.wait_for_timeout(100)
        lit = p.evaluate("[...document.querySelectorAll('.sg [role=option]')].filter(o => getComputedStyle(o).backgroundColor !== 'rgba(0, 0, 0, 0)' && getComputedStyle(o).backgroundColor !== 'rgb(255, 255, 255)').length")
        ok(lit == 1, f'{tag}: one row lit when the pointer and the keys disagree ({lit})')
        typein(p, 'school'); p.evaluate("window.dispatchEvent(new PopStateEvent('popstate', { state: history.state }))"); p.wait_for_timeout(500); s = state(p)
        ok(s['value'] == 'school' and s['focused'] and s['open'], f'{tag}: a redraw keeps the words, the focus and the list ({s["value"]!r})')
        typein(p, 'zzqxw'); s = state(p)
        ok(s['note'] == 'No bill, issue, legislator or supporter matches “zzqxw”.' and s['opts'][-1]['t'] == 'Look for “zzqxw” in sponsors, owners and committees', f'{tag}: nothing matching says so and offers Search ("{s["note"]}")')
        # every bill, not only the tracked ones (Nate, 9/26): a bill not tracked opens Search at it, where Track is
        typein(p, 'firearm'); s = state(p); un = [o for o in s['opts'] if o['href'].startswith('#/search?q=') and not o['t'].startswith(('See all', 'Look for'))]
        ok('Not tracked yet' in s['groups'] and un, f'{tag}: "firearm" lists bills not tracked yet {s["groups"]}')
        if un:
            p.locator(f'#{un[0]["id"]}').click(); p.wait_for_timeout(1500)
            ok(p.evaluate("location.hash").startswith('#/search?q=') and p.locator('#lg-sres [data-lgtrack]').count() >= 1, f'{tag}: it opens Search at that bill, with its Track button ({p.evaluate("location.hash")})')
        staff(p)
        # on Search itself the results under the box are the list, and Down still walks them
        staff(p, '/search'); typein(p, 'school', 700); s = state(p)
        ok(not s['open'] and 'q=school' in s['hash'], f'{tag}: no list on Search; its results follow the header box ({s["hash"]})')
        p.keyboard.press('ArrowDown'); p.wait_for_timeout(150)
        ok(p.evaluate("!!document.activeElement.closest('#lg-sres')"), f'{tag}: Down from the header box goes into Search\'s results')
        c.close()
    c, p = ctx(b, 390, 844); staff(p)
    ok(not p.locator('#hq').is_visible() and p.locator('.sv-srchbtn').is_visible(), 'staff phone: a search button, no header box')
    c.close()

    # ---- a phone: no header box (the magnifier opens Find, whose own results appear as you type) ----
    c, p = ctx(b, 390, 844); visit(p, '/more')
    ok(not p.locator('#hq').is_visible() and p.locator('.hsearchbtn').is_visible(), 'phone: the header has the magnifier, not a box')
    visit(p, '/find'); p.locator('#q').fill('vap'); p.wait_for_timeout(1500)
    ok(not state(p)['open'] and p.locator('#fd-results .mb-row, #fd-results .fd-irow').count() > 0, 'phone: Find lists results as you type, no header list')
    c.close()

    # ---- the live site: issues at once, then bills from the database (read-only public views) ----
    c, p = ctx(b, 1280, 800); visit(p, '/more', demo=False, wait=4000)
    typein(p, 'vap', 350); s0 = state(p)
    p.wait_for_function("() => document.querySelectorAll('.sg [role=option][href^=\"#/bill/\"]').length > 0", timeout=8000); s = state(p)
    ok(s0['open'], f'live: the list opens at once (issues: {len([o for o in s0["opts"] if "/issue/" in o["href"] or "/category/" in o["href"]])}; note "{s0["note"]}")')
    ok(any(o['href'].startswith('#/bill/') for o in s['opts']) and not s['note'], 'live: bills arrive from the database and the "Looking" note goes')
    p.screenshot(path=f'{OUT}/live_vap_1280.png')
    typein(p, 'sb2175', 350); p.wait_for_function("() => [...document.querySelectorAll('.sg .sg-s')].some(x => x.textContent.startsWith('SB 2175'))", timeout=8000)
    ok(state(p)['opts'][0]['s'].startswith('SB 2175'), 'live: "sb2175" puts SB 2175 first')
    # a new search keeps the list in place, dimmed, until its answer lands: no emptying and refilling (B-7)
    typein(p, 'school', 1500); p.wait_for_function("() => !document.querySelector('.sg.sg-busy') && document.querySelectorAll('.sg [role=option]').length > 2", timeout=8000)
    h0 = state(p)['height']; box = p.locator('#hq'); box.type(' meals', delay=40)
    heights, busy = [], False
    for _ in range(30):
        st = state(p); heights.append(st['height']); busy = busy or st['busy']; p.wait_for_timeout(50)
    p.wait_for_function("() => !document.querySelector('.sg.sg-busy')", timeout=8000); s = state(p)
    ok(busy and min(heights) >= h0 * 0.9, f'live: while looking, the list stays put (was {round(h0)}px, lowest {round(min(heights))}px, dimmed {busy})')
    ok(not s['busy'] and any('meal' in o['t'].lower() for o in s['opts']), 'live: the answer replaces it')
    c.close()
    b.close()

for x in passes + fails: print(x)
print(f'\n{len(passes)} passed, {len(fails)} failed')
if errors: print('errors:', errors[:8])
sys.exit(1 if fails else 0)
