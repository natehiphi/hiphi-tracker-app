# R-357 Part 3 (Nate, 30 Oct 2026: "Make the bold changes but keep the my issues tab"): version 2 of Home, behind ?v2=1 (pub/calm/home.js,
# weekBlock; docs/DESIGN.md A-23, B-14, A-12, A-14). The greeting and the slide are Nate's own of 20 Oct and do not change; the box under
# the slide becomes "This week", by day. The people are compare.html's (the same as tests/home_calm.py): Kai follows 3 issues, Leilani 16.
#   Kai, Monday (the practice copy's Mon 16 Mar 2026, a phone at 375x812 and a laptop at 1280x800):
#     - the box's heading is "This week"; its rows are in the order of what is due, each with a day label (Tue, Wed, Mar 30, Today), the bill's
#       everyday name and what is due ("Testimony due 1:00 PM"; amber only inside 24 hours)
#     - the slide's own bill is the lit row: not a link, no chevron, no "Show"; the others end in a chevron and a tap opens that bill's page
#       (#/bill/...), not the slide
#     - "Also due: HIPHI asks / On issues you don't follow" with no number (Nate, R-300), only when there are some, under the day the soonest is
#       due; it opens Find's "Needs voices this week", scrolled to that heading, where the asks are listed; Leilani, who follows what the week
#       holds, has none and so no row
#     - a newcomer's story card (pub/v2/story.js, Part 4: storyCard() -> { html, wire }) is drawn between the slide and the box when that module
#       gives one, wired, gone when put aside; with the file absent Home draws as before (no page error); without ?v2=1 it is never asked for
#     - "Edit my issues" is the box's last line, in link blue, and opens My issues in its edit state
#     - "See your 2026 session" and "See them all in My issues" are not on Home; the You tab has "Your 2026 session" opening the same page
#     - A-23: at most 4 blocks of at most 2 shapes, one filled button, each bill named once, under 2 phone screens for 3 issues and 3 for 16,
#       the first phone screen under 60 words and 6 text styles; no sideways scroll; nothing in the console
#     - the slide's letter buttons call app.openLetter2(bill, kind, opts) when it exists ({ resume: true } for a letter started), else open
#       today's walkthrough
#   Leilani, Monday: the first 8 rows, then "Show all your issues · more due this week" (in the box), which opens the rest in place with the
#     focus on the first one; nothing due is below an issue with nothing due; the box still ends with the two lines
#   Between sessions (?season=off): the box is today's list of issues with v1's own words (the Light fix of 30 Oct), titled "Your issues", ending
#     with "Edit my issues"; no session link on Home
#   Without ?v2=1: Home is today's: "Show" rows, "See them all in My issues", "See your 2026 session", nothing of version 2
#   python3 -m http.server 8832   (in the frontend folder, once)
#   python3 tests/v2_home.py [base]   base defaults to http://localhost:8832; V2_HOME_OUT sets where the screenshots go (default tests/out/v2_home)
import os, re, sys
from playwright.sync_api import sync_playwright

BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832').split('/track.html')[0].rstrip('/')
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.environ.get('V2_HOME_OUT') or os.path.join(ROOT, 'tests', 'out', 'v2_home'); os.makedirs(OUT, exist_ok=True)
src = open(os.path.join(ROOT, 'compare.html')).read()
WHO = src[src.index('const WHO = {'):src.index('const pick =')]   # the same people as the compare page and tests/home_calm.py
fails = 0
def ok(c, m):
    global fails
    print(('PASS ' if c else 'FAIL ') + m)
    if not c: fails += 1

def scene(who, day='mon'):
    off = {'mon': 0, 'tue': 1, 'wed': 2}[day]
    return f"""(() => {{ {WHO}
  if (sessionStorage.getItem('__set')) return; sessionStorage.setItem('__set', '1');
  const p = WHO['{who}'], at = Date.parse('2026-03-16T09:00:00-10:00') + {off} * 864e5;
  for (const k of Object.keys(localStorage)) if (k.startsWith('hiphi_')) localStorage.removeItem(k);
  const set = (k, v) => localStorage.setItem(k + '_demo', typeof v === 'string' ? v : JSON.stringify(v));
  set('hiphi_issue_follows', p.issues); set('hiphi_watch_ids', []); set('hiphi_cat_follows', []); set('hiphi_skips', []);
  set('hiphi_wiz', {{ done: true, issues: p.cats, name: p.name }});
  set('hiphi_onb', {{ lastVisit: new Date(at - 14 * 36e5).toISOString() }});
  set('hiphi_done', Object.keys(p.done)); set('hiphi_done_at', p.done); set('hiphi_stances', {{}}); set('hiphi_demo_seeded', '0');
  localStorage.setItem('hiphi_tour_home_demo', '{{"how":"test"}}'); localStorage.setItem('hiphi_tour_bill_demo', '{{"how":"test"}}');
}})();"""

PHONE = dict(viewport={'width': 375, 'height': 812}, is_mobile=True, has_touch=True)
LAPTOP = dict(viewport={'width': 1280, 'height': 800})
BLUE = 'rgb(0, 105, 142)'   # --p700, the link blue

def url(v2=True, off=False, day='mon'):
    return f"{BASE}/track.html?demo=1{'' if day == 'mon' else '&day=' + day}&abrest=today&ab=layout.calm{'&season=off' if off else ''}{'&v2=1' if v2 else ''}#/"

# Part 4's story card (pub/v2/story.js) may or may not be in the tree yet, so a test says which it wants: a stub module, or none (a 404). The
# 404 the browser logs for an absent file is expected, and is the only console error allowed for it.
STORY_STUB = """import { app } from '../core.js';
let read = false;
export const storyCard = () => read ? { html: '' } : { html: '<section class="cm-story" aria-label="How a bill becomes law"><p>New here? How a bill becomes law</p><button type="button" data-story-no>Not now</button></section>',
  wire: root => { window.__storyWired = (window.__storyWired || 0) + 1; const b = root.querySelector('[data-story-no]'); if (b) b.onclick = () => { read = true; app.render(); }; } };"""
def story_route(ctx, how):
    if how == 'stub': ctx.route('**/pub/v2/story.js', lambda r: r.fulfill(status=200, content_type='text/javascript', body=STORY_STUB))
    elif how == 'absent': ctx.route('**/pub/v2/story.js', lambda r: r.fulfill(status=404, body='not found'))
def console_bad(m): return m.type == 'error' and 'favicon' not in m.text and 'v2/story.js' not in (m.location.get('url') or '')

def open_home(br, kw, who, v2=True, off=False, day='mon', errs=None, story='absent', reqs=None):
    ctx = br.new_context(**kw)
    ctx.add_init_script("Object.defineProperty(Navigator.prototype,'globalPrivacyControl',{get:()=>true});")
    ctx.add_init_script(scene(who, day))
    story_route(ctx, story)
    pg = ctx.new_page()
    if reqs is not None: pg.on('request', lambda r: reqs.append(r.url))
    if errs is not None:
        pg.on('pageerror', lambda e: errs.append('pageerror ' + str(e)))
        pg.on('console', lambda m: errs.append('console ' + m.text[:160]) if console_bad(m) else None)
    pg.goto(url(v2, off, day))
    pg.wait_for_function("() => !!document.querySelector('#main .cm') && !document.querySelector('.skelpage')", timeout=60000); pg.wait_for_timeout(1500)
    return ctx, pg

# What Home holds, read from the page (textContent, not innerText: the day labels and the heading are set in capitals by the style sheet).
ROWS = """() => [...document.querySelectorAll('#main .cm-rows .cm-row')].map(r => ({
  day: r.querySelector('.cm-day')?.textContent.trim() || '', name: r.querySelector('.cm-rname')?.firstChild.textContent.trim() || '',
  line: r.querySelector('.cm-rstat')?.textContent.trim() || '', warn: !!r.querySelector('.cm-rstat.warn'), lit: r.classList.contains('on'),
  link: r.tagName === 'A' ? r.getAttribute('href') : null, chev: !!r.querySelector('.cm-chev'), show: !!r.querySelector('.cm-show'), also: r.classList.contains('cm-also'),
  hidden: !!r.closest('li').hidden, fresh: !!r.querySelector('.cm-new') }))"""
MEASURE = """async () => {
  const main = document.querySelector('#main'), root = main.querySelector('.cm');
  const vis = e => e.offsetHeight > 0, blocks = [...root.children].filter(vis), shapes = new Set();
  if (root.querySelector('.cm-slide, .acard, .hm-ask, .hm-ready, .goitem, .card')) shapes.add('card');
  if (root.querySelector('.cm-rows')) shapes.add('rows');
  const { S, nick } = await import('./pub/core.js');
  // Each bill named once, strictly: its number and its everyday name appear once on the page (the rows' names are bills' names here).
  const text = root.innerText, twice = [];
  for (const b of S.bills) {
    const num = b.bill_number.replace(/^([A-Z]+)(\\d+)$/, '$1 $2'), nm = nick(b);
    const c1 = text.split(num).length - 1, c2 = nm && nm.length > 8 ? text.split(nm).length - 1 : 0;
    if (c1 > 1 || c2 > 1) twice.push(`${num} ${nm || ''} (${c1}, ${c2})`);
  }
  return { blocks: blocks.length, kinds: blocks.map(e => e.className.split(' ')[0]).join(','), shapes: [...shapes], filled: [...root.querySelectorAll('.btn.primary')].filter(vis).length,
    twice, h: Math.round(main.scrollHeight), wide: document.documentElement.scrollWidth > innerWidth + 1, hi: root.querySelector('.cm-hi')?.innerText.trim() || '' };
}"""
FIRST = """() => { const root = document.querySelector('#main .cm'), bar = document.querySelector('.tabs');
  const bottom = Math.min(innerHeight, bar && bar.getBoundingClientRect().top > 0 ? bar.getBoundingClientRect().top : innerHeight);
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); let words = 0; const st = new Set();
  for (let n; (n = w.nextNode());) { const t = n.textContent.trim(), el = n.parentElement; if (!t) continue;
    if (!el.checkVisibility({ visibilityProperty: true, opacityProperty: true }) || el.closest('.sr, [aria-hidden="true"]')) continue;
    const r = document.createRange(); r.selectNodeContents(n); const rc = r.getBoundingClientRect(); if (!rc.height || rc.top + rc.height / 2 >= bottom || rc.bottom <= 0) continue;
    const cs = getComputedStyle(el); if (!el.closest('.warn')) st.add([cs.fontFamily.split(',')[0], cs.fontSize, cs.fontWeight, cs.color].join(' '));
    words += t.split(/\\s+/).filter(x => /\\w/.test(x)).length; }
  return { words, styles: [...st] }; }"""
AMBER = re.compile(r'^(Testimony due|Your letter is started · due|Late testimony until|Ask the chairs? for a hearing)')
DAYS = ['Today', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

with sync_playwright() as pw:
    br = pw.chromium.launch()
    # ---------------- Kai, Monday: a phone ----------------
    errs = []; ctx, pg = open_home(br, PHONE, 'kai', errs=errs)
    ok(pg.evaluate("document.body.classList.contains('v2')") and pg.locator('#main .cm.hm-v2').count() == 1, 'version 2 marks the body and Home')
    ok(pg.evaluate("document.querySelector('#main .cm-hi')?.innerText.trim()") == 'Aloha, Kai. Here’s how you can help.', 'the greeting is the slide’s own line, with no count (R-300)')
    head = pg.evaluate("document.querySelector('#main .cm-issues h2')?.textContent.trim()")
    ok(head == 'This week', f'the box is headed "This week" ({head!r})')
    rows = pg.evaluate(ROWS); week = [r for r in rows if not r['also']]
    print('   rows:', [(r['day'], r['name'], r['line'], 'lit' if r['lit'] else '') for r in rows])
    ok([(r['day'], r['name'], r['line']) for r in week] == [('Tue', 'Free school bus passes', 'Testimony due 1:00 PM'), ('Tue', 'Local food buying rules for schools', 'Testimony due 1:00 PM'),
                                                            ('Wed', 'Disposable e-cigarette ban', 'Testimony due 9:30 AM')], 'one row for each thing due, by day, each with its day, the bill\'s everyday name and what is due')
    order = [DAYS.index(r['day']) if r['day'] in DAYS else 99 for r in week]
    ok(order == sorted(order), f'the days run in order ({[r["day"] for r in week]})')
    lit = [r for r in rows if r['lit']]
    num = pg.evaluate("document.querySelector('#main .cm-slide .cm-bill')?.textContent.trim()")
    slide_nick = pg.evaluate("""async n => { const { S, nick } = await import('./pub/core.js'); const b = S.bills.find(b => b.bill_number.replace(/^([A-Z]+)(\\d+)$/, '$1 $2') === n); return b ? nick(b) : null; }""", num)
    ok(len(lit) == 1 and lit[0]['name'] == slide_nick, f'the slide\'s own bill ({num}) is the one lit row, named once there ({[r["name"] for r in lit]}, {slide_nick!r})')
    ok(lit and lit[0]['link'] is None and not lit[0]['chev'] and not lit[0]['show'], 'the lit row is not a link and has no chevron and no "Show"')
    others = [r for r in rows if not r['lit']]
    ok(all(r['link'] and r['chev'] and not r['show'] for r in others), 'every other row is a link ending in a chevron, never "Show" (a tap opens the thing itself, not the slide)')
    ok(pg.locator('#main [data-cm-pick]').count() == 0 and 'On the slide above' not in pg.inner_text('#main'), 'no row moves the slide, and none says "On the slide above"')
    ok(not any(r['warn'] for r in rows), f'Monday 9 AM: nothing is due inside 24 hours, so nothing is amber ({[r["warn"] for r in rows]})')
    ok(rows[-1]['also'] and rows[-1]['name'] == 'Also due: HIPHI asks' and not re.search(r'\d', rows[-1]['name']) and rows[-1]['line'] == 'On issues you don’t follow' and rows[-1]['day'] == 'Today' and rows[-1]['link'] == '#/find',
       f'the last row is "{rows[-1]["name"]}" / "{rows[-1]["line"]}" with no number, under Today, opening Find')
    edit = pg.evaluate("""() => { const li = [...document.querySelectorAll('#main .cm-rows > li')].pop(), a = li?.querySelector('a');
      return { text: a?.textContent.trim(), href: a?.getAttribute('href'), color: a && getComputedStyle(a).color, h: a && Math.round(a.getBoundingClientRect().height) }; }""")
    ok(edit['text'] == 'Edit my issues' and edit['href'] == '#/bills' and edit['color'] == BLUE and edit['h'] >= 44, f'"Edit my issues" is the box\'s last line, in link blue, a 44px target ({edit})')
    txt = pg.inner_text('#main')
    ok('See your 2026 session' not in txt and 'See them all in My issues' not in txt and 'My issues' not in txt.replace('Edit my issues', ''), 'Home has no "See your 2026 session" and no "See them all in My issues"')
    ok(pg.locator('.tabs a, .tabs button').filter(has_text='My issues').count() >= 1, 'the My issues tab stays in the bar (Nate)')
    m = pg.evaluate(MEASURE)
    ok(m['blocks'] <= 4, f"at most 4 blocks ({m['blocks']}: {m['kinds']})")
    ok(len(m['shapes']) <= 2, f"at most 2 shapes ({m['shapes']})")
    ok(m['filled'] == 1, f"one filled button ({m['filled']})")
    ok(not m['twice'], f"each bill named once ({m['twice'][:3]})")
    ok(m['h'] <= 2 * 812, f"under two phone screens for 3 issues ({m['h']}px of {2 * 812})")
    ok(not m['wide'], 'no sideways scroll')
    pg.evaluate('window.scrollTo(0, 0)'); pg.wait_for_timeout(200); f1 = pg.evaluate(FIRST)
    ok(f1['words'] < 60 and len(f1['styles']) <= 6, f"the first phone screen under 60 words and 6 text styles ({f1['words']} words, {len(f1['styles'])} styles)")
    pg.add_style_tag(content='.tabs{visibility:hidden !important}'); pg.wait_for_timeout(100)
    pg.screenshot(path=os.path.join(OUT, 'phone_kai_mon_v2.png'), full_page=True)
    pg.evaluate("document.querySelector('style:last-of-type')?.remove()")
    # the letter buttons: the new sheet when it is there, else today's walkthrough
    info = pg.evaluate("() => { const b = document.querySelector('#main .cm-slide [data-helper]'); return { hid: b?.dataset.helper, bid: b?.dataset.bill, label: b?.textContent.trim() }; }")
    ok(info['label'] == 'Help me write testimony', f"the slide's one filled button ({info['label']!r})")
    pg.click('#main .cm-slide [data-helper]'); pg.wait_for_selector('.hp-frame', timeout=15000)
    ok(True, 'without app.openLetter2 the button opens today\'s walkthrough')
    pg.click('.hp-frame [data-hp="close"]'); pg.wait_for_timeout(600)
    if pg.locator('.hp-frame').count() and pg.locator('[data-hp="leave"], [data-hp="discard"]').count(): pg.click('[data-hp="leave"], [data-hp="discard"]'); pg.wait_for_timeout(400)
    pg.evaluate("""async () => { const { app } = await import('./pub/core.js'); window.__l2 = []; app.openLetter2 = (b, kind, o) => window.__l2.push([b.bill_number, kind, o ?? null]); }""")
    pg.click('#main .cm-slide [data-helper]'); pg.wait_for_timeout(300)
    ok(pg.evaluate('window.__l2') == [['HB1780', 'testimony', None]], f"with app.openLetter2 the same button calls it with the bill and 'testimony' ({pg.evaluate('window.__l2')})")
    pg.evaluate("""async ([hid]) => { const { app } = await import('./pub/core.js'); localStorage.setItem('hiphi_me', JSON.stringify({ drafts: { [hid]: { at: new Date().toISOString(), screen: 'letter' } } })); app.render(); }""", [info['hid']])
    pg.wait_for_timeout(600)
    lab = pg.evaluate("document.querySelector('#main .cm-slide [data-helper]')?.textContent.trim()")
    pg.click('#main .cm-slide [data-helper]'); pg.wait_for_timeout(300)
    ok(lab == 'Finish sending your testimony' and pg.evaluate('window.__l2')[-1] == ['HB1780', 'testimony', {'resume': True}], f"'Finish sending your testimony' calls it with {{ resume: true }} ({lab!r}, {pg.evaluate('window.__l2')[-1]})")
    pg.evaluate("localStorage.removeItem('hiphi_me')")
    ok(not errs, f'no console errors on Kai\'s Home {errs[:2]}')
    ctx.close()

    # ---------------- Kai: a tap on a row opens the bill; Edit; Also due; You ----------------
    errs = []; ctx, pg = open_home(br, PHONE, 'kai', errs=errs)
    goal = pg.evaluate("document.querySelector('#main .cm-goal').innerText.trim()")
    pg.click('#main .cm-rows a.cm-row:not(.cm-also) >> nth=0'); pg.wait_for_function("() => /^#\\/bill\\//.test(location.hash)", timeout=15000)
    h1 = pg.evaluate("location.hash"); pg.wait_for_selector('#main .bl-v2', timeout=15000)
    ok(re.match(r'^#/bill/(\d{4}/)?[HS]B\d+$', h1) is not None, f'a tap on a row opens that bill\'s page, version 2\'s ({h1})')
    pg.go_back(); pg.wait_for_selector('#main .cm-rows', timeout=15000); pg.wait_for_timeout(600)
    ok(pg.evaluate("document.querySelector('#main .cm-goal').innerText.trim()") == goal, 'and Back finds Home with the slide where it was')
    # Edit my issues
    pg.click('#main [data-hm-edit]'); pg.wait_for_selector('#main .rc-mine.editing', timeout=15000)
    ok(pg.evaluate('location.hash') == '#/bills' and pg.get_attribute('#main [data-rc-edit]', 'aria-label') == 'Done editing' and pg.locator('#main [data-rc-stop]').count() >= 3,
       'Edit my issues opens My issues in its edit state (Done, and a Stop on each row)')
    pg.go_back(); pg.wait_for_selector('#main .cm-rows', timeout=15000); pg.wait_for_timeout(500)
    # Also due -> Find's "Needs voices this week"
    pg.click('#main .cm-also'); pg.wait_for_function("() => !!document.getElementById('fd-voices-h')", timeout=20000); pg.wait_for_timeout(1500)
    f = pg.evaluate("""() => { const h = document.getElementById('fd-voices-h'); return { hash: location.hash, top: Math.round(h.getBoundingClientRect().top), text: h.textContent.trim(),
      rows: h.closest('section').querySelectorAll('li').length, focus: document.activeElement === h }; }""")
    ok(f['hash'] == '#/find' and f['text'] == 'Needs voices this week' and 0 <= f['top'] < 200 and f['focus'], f'Also due opens Find scrolled to "Needs voices this week" ({f})')
    soon = pg.evaluate("() => [...document.getElementById('fd-voices-h').closest('section').querySelectorAll('li')].map(l => l.innerText.replace(/\\s+/g, ' '))")
    ok(f['rows'] >= 1 and any(re.search(r'due today', s) for s in soon), f'Find lists the asks there, the soonest due today, as the row\'s "Today" says ({f["rows"]} rows)')
    # You
    pg.goto(url().replace('#/', '#/more')); pg.wait_for_selector('#main .yu-you', timeout=15000)
    ses = pg.evaluate("""() => { const a = document.querySelector('#main .yu-you a.rc-row[href="#/recap"]'); return a ? { name: a.querySelector('.rc-rname')?.textContent.trim(), text: a.querySelector('.rc-rstat')?.textContent.trim() } : null; }""")
    ok(ses and ses['name'] == 'Your 2026 session' and sum(1 for _ in pg.query_selector_all('#main .yu-you a[href="#/recap"]')) == 1, f'the You tab has one row, "Your 2026 session", opening the same page ({ses})')
    ok(not errs, f'no console errors on the way {errs[:2]}')
    ctx.close()

    # ---------------- a newcomer's story card (Part 4's pub/v2/story.js): a stub module, and none ----------------
    errs = []; ctx, pg = open_home(br, PHONE, 'kai', story='stub', errs=errs)
    kinds = pg.evaluate("[...document.querySelector('#main .cm').children].filter(e => e.offsetHeight > 0).map(e => e.className.split(' ')[0])")
    ok(kinds == ['cm-head', 'cm-slide', 'cm-story', 'cm-issues'], f'the story card is the block between the slide and the box, four blocks in all ({kinds})')
    ok(pg.evaluate('window.__storyWired') >= 1, "its wire(root) ran after the draw")
    m = pg.evaluate(MEASURE)
    ok(m['blocks'] == 4 and m['filled'] == 1 and len(m['shapes']) <= 2 and not m['wide'], f"with the card: {m['blocks']} blocks, {m['shapes']}, {m['filled']} filled, no sideways scroll")
    pg.click('#main [data-story-no]'); pg.wait_for_timeout(600)
    kinds = pg.evaluate("[...document.querySelector('#main .cm').children].filter(e => e.offsetHeight > 0).map(e => e.className.split(' ')[0])")
    ok(kinds == ['cm-head', 'cm-slide', 'cm-issues'], f'put aside, the card is gone and the box is where it was ({kinds})')
    ok(not errs, f'no console errors with a story card {errs[:2]}')
    ctx.close()
    errs = []; reqs = []; ctx, pg = open_home(br, PHONE, 'kai', story='absent', errs=errs, reqs=reqs)
    ok(pg.locator('#main .cm-story').count() == 0 and pg.locator('#main .cm-rows').count() == 1 and any('v2/story.js' in u for u in reqs), 'with the file absent (a 404) Home draws as before, with no card')
    ok(not errs, f'and with no page error or console error but the 404 itself {errs[:2]}')
    ctx.close()

    # ---------------- Kai, Tuesday: what is due today is amber, in the same rows ----------------
    errs = []; ctx, pg = open_home(br, PHONE, 'kai', day='tue', errs=errs)
    rows = pg.evaluate(ROWS); week = [r for r in rows if not r['also']]
    print('   rows:', [(r['day'], r['name'], r['line'], 'amber' if r['warn'] else '') for r in week])
    ok([(r['day'], r['warn']) for r in week] == [('Today', True), ('Today', True), ('Wed', False)] and all(AMBER.match(r['line']) for r in week if r['warn']),
       'Tuesday: "Testimony due 1:00 PM" is amber inside 24 hours and only then (A-5)')
    ok(not errs, f'no console errors {errs[:2]}')
    ctx.close()

    # ---------------- Kai, Monday: a laptop ----------------
    errs = []; ctx, pg = open_home(br, LAPTOP, 'kai', errs=errs)
    rows = pg.evaluate(ROWS); m = pg.evaluate(MEASURE)
    ok([r['name'] for r in rows if not r['also']] == ['Free school bus passes', 'Local food buying rules for schools', 'Disposable e-cigarette ban'] and m['filled'] == 1 and m['blocks'] <= 4 and len(m['shapes']) <= 2 and not m['twice'] and not m['wide'],
       f"laptop: the same week, inside the budget ({m['blocks']} blocks, {m['shapes']}, {m['filled']} filled)")
    pg.screenshot(path=os.path.join(OUT, 'laptop_kai_mon_v2.png'), full_page=True)
    ok(not errs, f'no console errors {errs[:2]}')
    ctx.close()

    # ---------------- Leilani, Monday: sixteen issues ----------------
    for tag, kw in [('phone', PHONE), ('laptop', LAPTOP)]:
        errs = []; ctx, pg = open_home(br, kw, 'leilani', errs=errs)
        rows = pg.evaluate(ROWS); m = pg.evaluate(MEASURE); shown = [r for r in rows if not r['hidden'] and not r['also']]
        lbl = pg.evaluate("[...document.querySelectorAll('#main [data-cm-showall]')].map(e => e.textContent.trim())")
        hid_due = [r for r in rows if r['hidden'] and AMBER.match(r['line'] or '') and not r['line'].startswith('Ask')]
        want = 'Show all your issues' + (' · more due this week' if hid_due else '')
        names = [r['name'] for r in rows if not r['also']]
        ok(len(names) == len(set(names)), f'{tag} Leilani: no two rows carry the same name, a bill is named once ({[n for n in names if names.count(n) > 1]})')
        ok(len(shown) == 8 and lbl == [want], f'{tag} Leilani: the first 8 rows, then "{want}" ({len(shown)}, {lbl})')
        ok(pg.evaluate("document.querySelector('#main .cm-rows').lastElementChild.textContent.trim()") == 'Edit my issues' and pg.locator('#main .cm-also').count() == (0 if not any(r['also'] for r in rows) else 1),
           f'{tag} Leilani: the box still ends with "Edit my issues"')
        ok(not any(r['also'] for r in rows) and pg.evaluate("""() => !document.getElementById('fd-voices-h')""") is True, f'{tag} Leilani: nothing is due on issues she does not follow, so no "Also due" row')
        due = [bool(AMBER.match(r['line'] or '')) or r['lit'] for r in rows if not r['also']]
        ok(due == sorted(due, reverse=True), f'{tag} Leilani: nothing due is below an issue with nothing due')
        ok(m['filled'] == 1 and len(m['shapes']) <= 2 and m['blocks'] <= 4 and not m['twice'] and not m['wide'], f"{tag} Leilani: {m['blocks']} blocks, {m['shapes']}, {m['filled']} filled, each bill once {m['twice'][:2]}")
        if tag == 'phone': ok(m['h'] <= 3 * 812, f"phone Leilani: under three phone screens for 16 issues ({m['h']}px of {3 * 812})")
        pg.add_style_tag(content='.tabs{visibility:hidden !important}'); pg.wait_for_timeout(100)
        pg.screenshot(path=os.path.join(OUT, f'{tag}_leilani_mon_v2_folded.png'), full_page=True)
        pg.click('[data-cm-showall]'); pg.wait_for_timeout(300)
        r2 = pg.evaluate(ROWS)
        ok(all(not r['hidden'] for r in r2) and pg.locator('[data-cm-showall]').count() == 0 and pg.evaluate("document.activeElement?.classList.contains('cm-row')"), f'{tag} Leilani: Show all opens the rest in place (the first of them takes the focus)')
        ok(r2[-1]['also'] is False and len([r for r in r2 if not r['also']]) >= 16, f"{tag} Leilani: every issue has a row ({len(r2)} rows)")
        ok(pg.evaluate("document.querySelector('#main .cm-rows').lastElementChild.textContent.trim()") == 'Edit my issues', f'{tag} Leilani: and "Edit my issues" is still last')
        pg.screenshot(path=os.path.join(OUT, f'{tag}_leilani_mon_v2_all.png'), full_page=True)
        ok(not errs, f'{tag} Leilani: no console errors {errs[:2]}')
        ctx.close()

    # ---------------- between sessions ----------------
    for tag, kw in [('phone', PHONE), ('laptop', LAPTOP)]:
        errs = []; ctx2, pg2 = open_home(br, kw, 'kai', v2=False, off=True, errs=errs)
        v1 = pg2.evaluate(ROWS); ctx2.close()
        ctx, pg = open_home(br, kw, 'kai', off=True, errs=errs)
        rows = pg.evaluate(ROWS); head = pg.evaluate("document.querySelector('#main .cm-issues h2')?.textContent.trim()"); m = pg.evaluate(MEASURE)
        ok(head == 'Your issues' and [(r['name'], r['line']) for r in rows] == [(r['name'], r['line']) for r in v1], f'{tag} between sessions: "Your issues" with today\'s rows and words ({[r["name"] for r in rows]})')
        ok(not any(r['day'] for r in rows) and pg.evaluate("document.querySelector('#main .cm-rows').lastElementChild.textContent.trim()") == 'Edit my issues', f'{tag} between sessions: no day labels, and "Edit my issues" is the last line')
        txt = pg.inner_text('#main'); ok('See your 2026 session' not in txt and 'See them all in My issues' not in txt, f'{tag} between sessions: the session link is not on Home')
        ok(m['filled'] == 1 and len(m['shapes']) <= 2 and m['blocks'] <= 4 and not m['wide'], f"{tag} between sessions: {m['blocks']} blocks, {m['shapes']}, {m['filled']} filled")
        pg.add_style_tag(content='.tabs{visibility:hidden !important}'); pg.wait_for_timeout(100)
        pg.screenshot(path=os.path.join(OUT, f'{tag}_kai_off_v2.png'), full_page=True)
        ok(not errs, f'{tag} between sessions: no console errors {errs[:2]}')
        ctx.close()

    # ---------------- today's page, without the flag ----------------
    errs = []; reqs = []; ctx, pg = open_home(br, PHONE, 'kai', v2=False, errs=errs, reqs=reqs)
    ok(not any('v2/story.js' in u for u in reqs), "without ?v2=1 the story module is never asked for")
    rows = pg.evaluate(ROWS); txt = pg.inner_text('#main')
    ok(pg.locator('#main .cm.hm-v2, #main .cm-day, #main .cm-week').count() == 0 and not pg.evaluate("document.body.classList.contains('v2')"), 'without ?v2=1 nothing of version 2 is drawn')
    ok(sum(1 for r in rows if r['show']) >= 1 and all(r['chev'] or r['show'] for r in rows), f"today's rows keep their \"Show\" and chevrons ({[(r['name'], r['show']) for r in rows]})")
    ok('See your 2026 session' in txt and 'See them all in My issues' in txt and 'Your issues' in pg.evaluate("document.querySelector('#main .cm-issues h2').textContent"), "today's Home keeps \"Your issues\", \"See them all in My issues\" and \"See your 2026 session\"")
    pg.goto(url(v2=False).replace('#/', '#/more')); pg.wait_for_selector('#main .yu-you', timeout=15000)
    ok(pg.evaluate("document.querySelector('#main .yu-you a[href=\"#/recap\"] .rc-rname').textContent.trim()") == 'Your session', "today's You keeps \"Your session\"")
    ok(not errs, f'no console errors without the flag {errs[:2]}')
    ctx.close()
    br.close()
print('\nfailures:', fails)
sys.exit(1 if fails else 0)
