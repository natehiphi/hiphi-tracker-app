# Help as ready-made conversations (R-075, pub/talk.js + pub/talk-data.js). python3 tests/help_talk.py [base_url]
# The list renders in its groups and can be searched; a conversation opens at its first answer; the next-question button
# adds one exchange at a time; Back and "All questions" return to the list (B-4); #/help/<slug> works as a link and the
# old #/help still works; every one of the conversations walks to its end cleanly; 390 and 1440 wide, no console errors,
# only the public type sizes, 44px targets on a phone.
import sys, os, re, json, subprocess
from playwright.sync_api import sync_playwright
import checks
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832/track.html'
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'out', 'help'); os.makedirs(OUT, exist_ok=True)
DATA = json.loads(subprocess.check_output(['node', '--input-type=module', '-e',
  f"import {{ TALKS, GROUPS }} from '{os.path.join(HERE, '..', 'pub', 'talk-data.js')}'; console.log(JSON.stringify({{ TALKS, GROUPS }}))"]))
TALKS, GROUPS = DATA['TALKS'], DATA['GROUPS']
passes, fails, errors = [], [], []
def ok(c, m): (passes if c else fails).append(('PASS ' if c else 'FAIL ') + m)

def ctx(b, w=390, h=844):
    c = b.new_context(viewport={'width': w, 'height': h}, is_mobile=w < 600, has_touch=w < 600, device_scale_factor=2 if w < 600 else 1)
    p = c.new_page(); p.on('pageerror', lambda e: errors.append(f'{w}: {e}'))
    p.on('console', lambda m: errors.append(f'console {w}: {m.text[:140]}') if m.type == 'error' and 'favicon' not in m.text else None)
    return c, p
def start(p):   # a returning person (the first visit done), so Home does not send them into the guided start
    p.goto(BASE + '?demo=1'); p.wait_for_timeout(400)
    p.evaluate("localStorage.clear(); sessionStorage.clear(); localStorage.setItem('hiphi_wiz', JSON.stringify({step:1,done:true,skipped:true}))")
def go(p, h, wait=2600):
    p.goto(BASE + '?demo=1#' + h.lstrip('#')); p.reload(); p.wait_for_timeout(wait)
def std(p, name, desktop=False):
    r = checks.page_report(p, name)
    ok(not r['emoji'], f'{name}: no emoji {r["emoji"][:3]}')
    if not desktop: ok(not r['small_targets'], f'{name}: targets >= 44 {r["small_targets"][:3]}')
    allowed = {13, 14, 16, 18, 22, 28} | ({36} if desktop else set())
    extra = [s for s in r['font_sizes'] if round(s) not in allowed]
    ok(not extra, f'{name}: type sizes {r["font_sizes"]}')
    ok(not r['overflow'], f'{name}: no sideways scroll')
    ok(not r['small_inputs'], f'{name}: inputs >= 16px {r["small_inputs"]}')
turns = lambda p: p.locator('.tk-turn').count()
def show(p, slug):   # on a phone the groups are folded (R-075): open the one a row sits in before tapping the row
    if not p.locator(f'[data-tkrow="{slug}"]').is_visible():
        p.locator(f'[data-tkrow="{slug}"]').locator('xpath=ancestor::details/summary').click(); p.wait_for_timeout(250)
openg = lambda p: p.evaluate("[...document.querySelectorAll('[data-tkgroup]')].filter(d => d.open).map(d => d.dataset.tkgroup)")
h1 = lambda p: p.evaluate("document.querySelector('main h1')?.innerText || ''")

# ---- the words themselves ----
slugs = [t['slug'] for t in TALKS]
ok(len(TALKS) >= 30, f'at least 30 conversations ({len(TALKS)})')
ok(len(set(slugs)) == len(slugs), 'every slug is different')
ok(all(re.fullmatch(r'[a-z0-9-]+', s) for s in slugs), 'slugs are plain addresses')
ok(all(2 <= len(t['turns']) <= 5 for t in TALKS), 'each conversation has 2 to 5 exchanges')
ok(all(t['group'] in {g['key'] for g in GROUPS} for t in TALKS), 'each conversation sits in a known group')
ok(all(r in slugs for t in TALKS for r in t.get('related', [])), 'every "You might also ask" points at a real conversation')
answers = [' '.join(x['a'] if isinstance(x['a'], list) else [x['a']]) for t in TALKS for x in t['turns']]
ok(all(len(re.findall(r'[.!?](?:\s|$)', a)) <= 4 for a in answers), 'answers are short (at most a few sentences)')
ok(not [a for a in answers if '24 hours' in a and '48' not in a], 'testimony is never "due 24 hours" without the 48-hour Senate rule')
ok(not re.search(r"Hawaii|Hawai['’]i", json.dumps(DATA, ensure_ascii=False)), 'Hawaiʻi is written with the ʻokina')

with sync_playwright() as pw:
    b = pw.chromium.launch()
    # ---- phone ----
    c, p = ctx(b); start(p)
    go(p, '/more'); ok(p.locator('main a[href="#/help"]').count() >= 1, 'More links to Help')
    p.locator('main a[href="#/help"]').first.click(); p.wait_for_timeout(1800)
    ok(p.evaluate('location.hash') == '#/help' and h1(p) == 'Help', f'the old #/help opens the list ({h1(p)})')
    ok(p.locator('[data-tkgroup]').count() == len({t['group'] for t in TALKS}), f"the list has its groups ({p.locator('[data-tkgroup]').count()})")
    ok(p.locator('[data-tkrow]').count() == len(TALKS), f"every conversation is a row ({p.locator('[data-tkrow]').count()})")
    ok(p.locator('a[href="#/learn/bill"]').count() == 1 and p.locator('a[href="tel:+18085870478"]').count() >= 1 and p.locator('a[href="mailto:contact@hiphi.org"]').count() >= 1,
       'the lessons, the Public Access Room and Email HIPHI are still on Help')
    ok(p.locator('main textarea, main [contenteditable]').count() == 0, 'no typing box: it is not a chatbot')
    std(p, 'list'); p.screenshot(path=f'{OUT}/p_list.png'); p.screenshot(path=f'{OUT}/p_list_full.png', full_page=True)
    # R-075: on a phone the seven groups fold, so every group's name is on the first screen (A-1, A-2)
    ok(openg(p) == [], f'on a phone every group starts folded ({openg(p)})')
    heads = p.evaluate("[...document.querySelectorAll('[data-tkgroup] > summary')].map(s => { const r = s.getBoundingClientRect(); return [Math.round(r.top), Math.round(r.bottom), Math.round(r.height)] })")
    ok(heads and heads[0][0] <= 400 and heads[-1][1] <= 844, f'the first group starts within 400px and the last ends on the first screen ({heads[0]}, {heads[-1]})')
    ok(all(h[2] >= 44 for h in heads), f'every group bar is a 44px+ target ({[h[2] for h in heads]})')
    ok(p.evaluate("[...document.querySelectorAll('[data-tkgroup] > summary')].every(s => s.querySelector('h2') && s.querySelector('.tk-gn').innerText.trim() > '0')"), 'each bar names its group and counts its questions')
    ok(p.evaluate("(() => { const d = document.querySelector('[data-tkgroup]'); return d.querySelector('summary').tabIndex === 0 })()"), 'a folded group heading is a tab stop on a phone')
    p.locator('[data-tkgroup] > summary').first.click(); p.wait_for_timeout(250)
    g0 = p.evaluate("document.querySelector('[data-tkgroup]').dataset.tkgroup")
    ok(openg(p) == [g0] and p.locator(f'[data-tkgroup="{g0}"] [data-tkrow]').first.is_visible(), f'tapping a group opens it and shows its questions ({openg(p)})')
    std(p, 'list_open'); p.screenshot(path=f'{OUT}/p_list_open.png')
    p.locator('[data-tkgroup] > summary').first.click(); p.wait_for_timeout(250)
    ok(openg(p) == [], 'tapping it again folds it')
    p.keyboard.press('Tab')   # focus travels to the first control; the heading bars are reachable by keyboard
    p.locator('[data-tkgroup] > summary').first.focus(); p.keyboard.press('Enter'); p.wait_for_timeout(250)
    ok(openg(p) == [g0], 'Enter on a focused group bar opens it')
    p.keyboard.press('Enter'); p.wait_for_timeout(250)
    # search
    p.fill('#tk-q', 'zoom'); p.wait_for_timeout(200)
    vis = p.evaluate("[...document.querySelectorAll('[data-tkrow]')].filter(a => !a.hidden).map(a => a.dataset.tkrow)")
    ok('in-person-or-zoom' in vis and len(vis) < len(TALKS), f'search narrows the list ({vis})')
    gz = p.evaluate("[...document.querySelectorAll('[data-tkgroup]')].filter(d => !d.hidden).map(d => [d.dataset.tkgroup, d.open])")
    ok(gz and all(o for _, o in gz) and p.locator('[data-tkrow]:not([hidden])').first.is_visible(), f'while searching, every group with a match is open ({gz})')
    ok('found' in p.inner_text('#tk-count'), 'search says how many it found')
    p.fill('#tk-q', 'qqqzzz'); p.wait_for_timeout(200)
    ok(p.locator('.tk-none').is_visible() and p.locator('[data-tkgroup]:not([hidden])').count() == 0, 'no match: says so, and the groups hide')
    p.fill('#tk-q', ''); p.wait_for_timeout(200)
    ok(p.locator('[data-tkrow]:not([hidden])').count() == len(TALKS), 'clearing the search brings every question back')
    ok(openg(p) == [], f'clearing the search folds the groups again ({openg(p)})')
    # open one from the list, walk it, Back
    T = next(t for t in TALKS if t['slug'] == 'what-is-a-hearing')
    show(p, 'what-is-a-hearing'); p.locator('[data-tkrow="what-is-a-hearing"]').click(); p.wait_for_timeout(1500)
    ok(p.evaluate('location.hash') == '#/help/what-is-a-hearing', 'a row opens #/help/<slug>')
    ok(h1(p) == T['turns'][0]['q'] and turns(p) == 1, f'the first question is the heading and one answer shows ({h1(p)}, {turns(p)})')
    ok(p.locator('.tk-b').first.is_visible() and len(p.inner_text('.tk-b')) > 20, 'the first answer is there')
    ok(p.inner_text('[data-tknext]').strip() == T['turns'][1]['q'], 'the button is the next question')
    ok(p.locator('main .btn.primary').count() == 1, 'one primary button (A-3)')
    std(p, 'conv1'); p.screenshot(path=f'{OUT}/p_conv1.png')
    p.click('[data-tknext]'); p.wait_for_timeout(800)
    ok(turns(p) == 2 and p.evaluate('location.hash') == '#/help/what-is-a-hearing', 'the next question adds an exchange without changing the address')
    ok(p.evaluate("document.activeElement?.classList.contains('tk-q')"), 'focus moves to the question just asked')
    box = p.evaluate("(() => { const r = document.querySelector('[data-tkturn=\"1\"]').getBoundingClientRect(); return [r.top, r.bottom, innerHeight] })()")
    ok(box[0] >= 56 and box[1] <= box[2] - 64, f'the new question and its answer are in view, clear of the header and tabs ({[round(x) for x in box]})')
    while p.locator('[data-tknext]').count(): p.click('[data-tknext]'); p.wait_for_timeout(600)
    ok(turns(p) == len(T['turns']), 'every question can be asked')
    ok(p.locator('.tk-end .rows .row').count() >= 2 and 'You might also ask' in p.inner_text('main'), 'the end offers related questions (B-3)')
    std(p, 'conv_end'); p.screenshot(path=f'{OUT}/p_conv_end.png')
    p.go_back(); p.wait_for_timeout(1500)
    ok(p.evaluate('location.hash') == '#/help' and p.locator('[data-tkrow]').count() == len(TALKS), 'browser Back returns to the list (B-4)')
    ok(openg(p) == [T['group']] and p.locator('[data-tkrow="what-is-a-hearing"]').is_visible(), f'Back lands with the conversation\'s own group open, and no other ({openg(p)})')
    # "All questions" and "Ask something else" are real Back when the list is behind
    show(p, 'green-box'); p.locator('[data-tkrow="green-box"]').click(); p.wait_for_timeout(1400)
    n0 = p.evaluate('history.length'); p.locator('.tk-back').click(); p.wait_for_timeout(1400)
    ok(p.evaluate('location.hash') == '#/help' and p.evaluate('history.length') == n0, '"All questions" goes back to the list without stacking a page')
    show(p, 'green-box'); p.locator('[data-tkrow="green-box"]').click(); p.wait_for_timeout(1400)
    p.click('[data-tknext]'); p.wait_for_timeout(600); p.locator('.tk-else').click(); p.wait_for_timeout(1400)
    ok(p.evaluate('location.hash') == '#/help', '"Ask something else" (added after a step) returns to the list')
    # a related question opens its own conversation from the start
    show(p, 'deferred'); p.locator('[data-tkrow="deferred"]').click(); p.wait_for_timeout(1300)
    while p.locator('[data-tknext]').count(): p.click('[data-tknext]'); p.wait_for_timeout(500)
    rel = p.evaluate("document.querySelector('.tk-end .rows .row').getAttribute('href')")
    p.locator('.tk-end .rows .row').first.click(); p.wait_for_timeout(1300)
    ok(p.evaluate('location.hash') == rel and turns(p) == 1, f'a related question opens at its first answer ({rel})')
    p.go_back(); p.wait_for_timeout(1300)
    ok(p.evaluate('location.hash') == '#/help/deferred', 'Back from a related question returns to the conversation before')
    # deep links
    go(p, '/help/testimony-deadline')
    tt = next(t for t in TALKS if t['slug'] == 'testimony-deadline')
    ok(h1(p) == tt['turns'][0]['q'] and turns(p) == 1, 'a link to #/help/<slug> opens that conversation')
    ok('48 hours' in p.inner_text('.tk-b'), 'the deadline answer names the 48-hour rule')
    ok(p.evaluate('document.title').startswith(tt['title']), f"the tab title names the question ({p.evaluate('document.title')})")
    std(p, 'deeplink'); p.screenshot(path=f'{OUT}/p_deadline.png')
    go(p, '/help/no-such-question')
    ok(p.evaluate('location.hash') == '#/help' and p.locator('[data-tkrow]').count() == len(TALKS), 'an unknown question falls back to the list')
    # every conversation walks cleanly: no raw markup, nothing empty, a drawing only where one was asked for
    go(p, '/help'); bad = []
    for t in TALKS:
        p.evaluate(f"location.hash = '#/help/{t['slug']}'"); p.wait_for_timeout(250)
        while p.locator('[data-tknext]').count(): p.click('[data-tknext]'); p.wait_for_timeout(60)
        body = p.inner_text('.tk-thread')
        arts = sum(1 for x in t['turns'] if x.get('art'))
        if turns(p) != len(t['turns']) or re.search(r'\*\*|\]\(|\{nextOpen\}', body) or p.locator('.tk-d').count() != arts \
           or any(not s.strip() for s in p.evaluate("[...document.querySelectorAll('.tk-b')].map(b => b.innerText)")):
            bad.append(t['slug'])
        if checks.page_report(p, t['slug'])['overflow']: bad.append(t['slug'] + ':overflow')
    ok(not bad, f'all {len(TALKS)} conversations walk to the end cleanly {bad[:5]}')
    r = checks.page_report(p, 'last'); ok(not r['emoji'], 'no emoji in the drawings or words')
    c.close()

    # ---- reduced motion: everything still works, with no movement ----
    c = b.new_context(viewport={'width': 390, 'height': 844}, reduced_motion='reduce'); p = c.new_page(); p.on('pageerror', lambda e: errors.append(f'rm: {e}'))
    start(p); go(p, '/help/crossover'); p.click('[data-tknext]'); p.wait_for_timeout(300)
    ok(turns(p) == 2 and p.locator('.tk-new').count() == 0, 'with Reduce Motion the next answer appears without animating')
    c.close()

    # ---- desktop ----
    c, p = ctx(b, 1440, 900); start(p)
    go(p, '/help'); std(p, 'list@1440', desktop=True); p.screenshot(path=f'{OUT}/d_list.png')
    ok(openg(p) == [g['key'] for g in GROUPS if any(t['group'] == g['key'] for t in TALKS)], 'at 1440 every group stays open')
    ok(p.evaluate("[...document.querySelectorAll('[data-tkgroup] > summary')].every(s => s.tabIndex === -1 && !s.querySelector('.tk-chev').offsetParent)"), 'at 1440 the headings are plain headings: no chevron, no tab stop')
    p.locator('[data-tkgroup] > summary').first.click(); p.wait_for_timeout(200)
    ok(len(openg(p)) == len({t['group'] for t in TALKS}), 'at 1440 a click on a heading does not fold it')
    cols = p.evaluate("new Set([...document.querySelectorAll('[data-tkgroup]')].map(s => Math.round(s.getBoundingClientRect().left))).size")
    ok(cols == 2, f'the groups sit in two columns at 1440 ({cols})')
    go(p, '/help/how-a-bill-becomes-law'); p.click('[data-tknext]'); p.wait_for_timeout(700)
    std(p, 'conv@1440', desktop=True); p.screenshot(path=f'{OUT}/d_conv.png')
    w = p.evaluate("Math.round(document.querySelector('.tk-conv').getBoundingClientRect().width)"); ok(w <= 720, f'a conversation stays a reading column ({w}px)')
    go(p, '/'); p.keyboard.press('?'); p.wait_for_timeout(1500)
    ok(p.evaluate('location.hash') == '#/help', 'the ? key still opens Help')
    ok(p.locator('.tk-keys').count() == 1, 'Help lists the keyboard shortcuts on a computer')
    c.close()
    b.close()

errors = [e for e in errors if 'Failed to fetch' not in e and 'ERR_FAILED' not in e]
ok(not errors, f'no console errors {errors[:3]}')
for l in fails: print(l)
print(f'{len(passes)} passed, {len(fails)} failed')
sys.exit(1 if fails else 0)
