# Staff v2 bill page, the Testimony tab (R-027, 9/21). python3 tests/staff_testimony.py
# Nate: "within a particular bill page, links to all HIPHI staff testimonies should be available", and "when I open up
# one of those bills to draft testimony, I should see all previous testimony written for that bill and also for other
# free school meal bills". Scope (his answer, 9/21): the drafts the tracker itself makes. These checks hold the build to
# what was decided: a fifth tab with its own address; this bill and its companion first, then its issue, then a search
# that says it covers the tracker's drafts, then the rest of its category folded, nearest issues first; "Newest filed"
# as a plain label (a fresh-eyes review, 9/21: the arrow looked like a link); no "Filed" chip on filed rows; one
# "Earlier testimony" link on Next up while a draft is being written (no new button); filed drafts off Next up once
# their hearing has passed (A-14); the staff type scale, 44px targets on a phone, no emoji, no sideways scroll, no
# console errors. The sandbox's example drafts sit on the hearings where HIPHI really filed
# testimony in 2026 (docs/capitol_testimony_2026.json in the backend): HB1779 at House Education 2/10 and Finance 3/4.
import os, sys, re
from playwright.sync_api import sync_playwright
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import checks
BASE = os.environ.get('STAFF_BASE', 'http://localhost:8832/staff.html?demo=1')
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out', 'testimony'); os.makedirs(OUT, exist_ok=True)
ALLOWED = {13, 14, 16, 18, 22}
results, fails, errors = [], [], []
def ok(c, m): (results if c else fails).append(('PASS ' if c else 'FAIL ') + m)

TAB = r"""(() => {
  const txt = e => (e?.innerText || '').replace(/\s+/g, ' ').trim();
  const parts = [...document.querySelectorAll('#tm-body .tm-part')].map(p => ({ h: txt(p.querySelector('h3')), sub: txt(p.querySelector('h3 + p')),
    rows: [...p.querySelectorAll('.tm-row')].map(r => ({ text: txt(r), mark: txt(r.querySelector('.tm-mark')), links: [...r.querySelectorAll('a')].map(a => txt(a)) })),
    crows: [...p.querySelectorAll('.tm-crow')].map(r => ({ text: txt(r), date: txt(r.querySelector('.tm-date')) })),
    groups: [...p.querySelectorAll('.tm-ghead a')].map(txt),
    folded: [...p.querySelectorAll('details.tm-iss')].map(d => ({ open: d.open, s: txt(d.querySelector('summary')) })) }));
  return { tabs: [...document.querySelectorAll('.bw-tabs [data-tab]')].map(a => a.dataset.tab), cur: document.querySelector('.bw-tabs [aria-current="page"]')?.dataset.tab,
    parts, empty: txt(document.querySelector('#tm-body .empty')), marks: [...document.querySelectorAll('#tm-body .tm-mark')].map(txt),
    chips: [...document.querySelectorAll('#tm-body .tm-row .sv-chip')].map(txt),
    over: document.documentElement.scrollWidth > innerWidth + 1, hash: location.hash };
})()"""
NEXT = r"""(() => { const txt = e => (e?.innerText || '').replace(/\s+/g, ' ').trim();
  const cards = [...document.querySelectorAll('.bw-next')];
  return { earlier: [...document.querySelectorAll('[data-earlier]')].map(a => ({ text: txt(a), href: a.getAttribute('href'), primary: a.classList.contains('primary') })),
    other: cards.filter(c => /testimony/i.test(txt(c.querySelector('.bw-eyebrow')))).map(c => txt(c)),
    filedChips: cards.map(c => [...c.querySelectorAll('.sv-chip')].map(txt)).flat().filter(t => t === 'Filed').length }; })()"""

def ctx(b, w, h):
    c = b.new_context(viewport={'width': w, 'height': h}, is_mobile=w < 600, has_touch=w < 600, device_scale_factor=2 if w < 600 else 1)
    p = c.new_page()
    p.on('pageerror', lambda e: errors.append(f'{w}: {e}'))
    p.on('console', lambda m: errors.append(f'console {w}: {m.text[:160]}') if m.type == 'error' and 'favicon' not in m.text else None)
    return c, p
def visit(p, h, wait=2800):
    p.goto(BASE + '#' + h.lstrip('#')); p.reload(); p.wait_for_timeout(wait)

with sync_playwright() as pw:
    b = pw.chromium.launch()
    for W, H in ((1280, 800), (390, 844)):
        c, p = ctx(b, W, H)
        # ---- HB1779: its own two filed drafts, its companion SB3058, its issue, its category, search ----
        visit(p, '/bill/HB1779/testimony')
        t = p.evaluate(TAB)
        ok(t['tabs'] == ['overview', 'activity', 'pathway', 'public', 'testimony'], f'{W}: five tabs, Testimony last ({t["tabs"]})')
        ok(t['cur'] == 'testimony', f'{W}: #/bill/HB1779/testimony opens the Testimony tab ({t["cur"]})')
        own = t['parts'][0] if t['parts'] else {'h': '', 'rows': []}
        ok(own['h'] == 'On HB1779 and its companion SB3058', f'{W}: first part names the bill and its companion ({own["h"]!r})')
        ok(len(own['rows']) == 2 and 'House Finance hearing' in own['rows'][0]['text'] and 'House Education hearing' in own['rows'][1]['text'],
           f'{W}: HB1779 lists Finance 3/4 then Education 2/10, newest first ({[r["text"][:40] for r in own["rows"]]})')
        ok(all('Filed by Nate' in r['text'] for r in own['rows']) and not t['chips'], f'{W}: each says who filed it, with no "Filed" chip ({t["chips"]})')
        ok(own['rows'] and own['rows'][0]['mark'] == 'Newest filed' and t['marks'] == ['Newest filed'], f'{W}: "Newest filed" marks the newest filed draft, once, as a plain label ({t["marks"]})')
        ok(p.evaluate("(() => { const m = document.querySelector('#tm-body .tm-mark'); return !!m && !m.closest('a, button') && getComputedStyle(m).cursor !== 'pointer'; })()"), f'{W}: the mark is not a link (A-12)')
        ok(all(r['links'][:1] == ['Open Doc'] and len(r['links']) <= 2 for r in own['rows']), f'{W}: each row opens its Doc, at most two actions (A-20) ({[r["links"] for r in own["rows"]]})')
        ok(all(re.search(r'\b(Tue 2/10/26|Wed 3/4/26)\b', r['text']) for r in own['rows']), f'{W}: dates carry the weekday and the year')
        iss = next((x for x in t['parts'] if x['h'].startswith('Other bills in')), None)
        ok(iss and '"Free school meals for every student"' in iss['h'], f'{W}: second part is the bill\'s issue ({iss and iss["h"]})')
        ok(iss and 'HB757' in iss['groups'], f'{W}: the issue part groups by bill and includes HB757 ({iss and iss["groups"]})')
        cat = next((x for x in t['parts'] if x['h'].startswith('More in')), None)
        ok(cat and cat['h'] == 'More in Food & Nutrition' and cat['folded'] and not any(f['open'] for f in cat['folded']),
           f'{W}: the category part is folded ({cat and cat["h"]}, {len(cat["folded"]) if cat else 0} issues)')
        ok(cat and any(f['s'].startswith('Lower school meal prices') for f in cat['folded']), f'{W}: school meal prices is among the folded issues')
        names = [f['s'] for f in (cat['folded'] if cat else [])]
        first_snap = next((k for k, n in enumerate(names) if 'SNAP' in n), 99)
        ok(names and names[0].startswith('Free school meals for more families') and all(k < first_snap for k, n in enumerate(names) if 'school meal' in n.lower()),
           f'{W}: the nearest issues come first, school meals before SNAP ({[n[:28] for n in names[:5]]})')
        heads = [x['h'] for x in t['parts']]
        si = next((k for k, h in enumerate(heads) if h.startswith('Search')), -1); ci = next((k for k, h in enumerate(heads) if h.startswith('More in')), -1)
        ok(0 <= si < ci and re.match(r'^Search the \d+ drafts made in the tracker$', heads[si]), f'{W}: search sits above the category and says what it covers ({heads[si] if si >= 0 else None!r})')
        ok(p.evaluate("[...document.querySelectorAll('.tm-cat')].length") == 1 and p.evaluate("[...document.querySelectorAll('.tm-cat details.tm-iss')].length") == len(names), f'{W}: the folded issues share one card')
        if cat and cat['folded']:
            p.locator('details.tm-iss summary').first.click(); p.wait_for_timeout(200)
            ok(p.evaluate("document.querySelector('details.tm-iss').open && document.querySelectorAll('details.tm-iss[open] .tm-crow').length > 0"), f'{W}: an issue opens to its drafts')
        # search: remembered for the visit, finds by bill number, says so when nothing matches
        q = p.locator('#tm-q'); q.fill('HB2296'); p.wait_for_timeout(200)
        res = p.evaluate("(document.querySelector('#tm-res')?.innerText || '').replace(/\\s+/g, ' ')")
        ok('HB2296' in res and 'found' in res, f'{W}: search finds HB2296 ({res[:80]!r})')
        q.fill('zzzqq'); p.wait_for_timeout(200)
        nm = p.evaluate("document.querySelector('#tm-res').innerText")
        ok('Nothing in the tracker' in nm and 'Capitol page' in nm and p.evaluate("!!document.querySelector('#tm-res a[href*=\"capitol\"]')"), f'{W}: no match says the search covers the tracker only and points to the Capitol page ({nm[:60]!r})')
        q.fill('')
        rep = checks.page_report(p, f'testimony_{W}')
        extra = [s for s in rep['font_sizes'] if round(s) not in ALLOWED]
        ok(not extra, f'{W}: type sizes stay on the staff scale {rep["font_sizes"]}')
        ok(not rep['emoji'], f'{W}: no emoji {rep["emoji"][:3]}')
        if W < 600: ok(not rep['small_targets'], f'{W}: targets are 44px {rep["small_targets"][:3]}')
        ok(not p.evaluate("document.documentElement.scrollWidth > innerWidth + 1"), f'{W}: no sideways scroll')
        p.screenshot(path=f'{OUT}/{W}_HB1779_testimony.png', full_page=W < 600)
        # ---- SB3058: nothing of its own, its companion's drafts come first ----
        visit(p, '/bill/SB3058/testimony')
        t2 = p.evaluate(TAB)
        o2 = t2['parts'][0] if t2['parts'] else {'h': '', 'rows': []}
        ok(o2['h'] == 'On SB3058 and its companion HB1779' and len(o2['rows']) == 2 and all('HB1779' in r['text'] for r in o2['rows']),
           f'{W}: SB3058 shows its companion\'s two drafts, labelled HB1779 ({o2["h"]!r}, {len(o2["rows"])})')
        # ---- Next up: filed drafts are not repeated there; a draft being written links to the tab ----
        visit(p, '/bill/HB1779')
        n = p.evaluate(NEXT)
        ok(n['filedChips'] == 0 and not any('Filed' in o for o in n['other']), f'{W}: HB1779\'s filed drafts, both hearings passed, are not repeated on Next up (A-14) ({n["filedChips"]})')
        # a bill with a hearing ahead, a draft on it and earlier testimony in its issue
        found = None
        # bills with a hearing in the sandbox's coming week and a position: the sandbox seeds a draft on each, some still
        # being written ("draft"), which is when the link shows
        cands = p.evaluate("""fetch('demo/snapshot.json').then(r => r.json()).then(s => { const t0 = new Date(s.asof).getTime();
          const act = new Set(s.bills.filter(b => b.position && b.position !== 'monitor').map(b => b.id));
          return [...new Set(s.hearings.filter(h => { const t = new Date(h.scheduled_at).getTime(); return t > t0 && t - t0 < 7 * 864e5 && act.has(h.bill_id); })
            .map(h => s.bills.find(b => b.id === h.bill_id).bill_number))]; })""")
        for num in cands[:30]:
            visit(p, '/bill/' + num, 2200)
            n = p.evaluate(NEXT)
            if n['earlier']: found = (num, n); break
        ok(found is not None, f'{W}: a bill with a draft in progress shows "Earlier testimony" on Next up ({found and found[0]})')
        if found:
            e = found[1]['earlier'][0]
            ok(re.match(r'^Earlier testimony \(\d+\)$', e['text']) and not e['primary'], f'{W}: it is a plain link with a count, not a new button ({e["text"]!r})')
            p.locator('[data-earlier]').first.click(); p.wait_for_timeout(900)
            ok(p.evaluate(TAB)['cur'] == 'testimony', f'{W}: the link opens the Testimony tab')
            if W >= 900: ok(p.evaluate("document.querySelectorAll('[data-earlier]').length") == 0, f'{W}: with the tab open beside it, the link hides (A-14)')
            p.screenshot(path=f'{OUT}/{W}_{found[0]}_from_next_up.png')
        # keyboard: 5 opens the tab (desktop)
        if W >= 900:
            visit(p, '/bill/HB1779'); p.keyboard.press('5'); p.wait_for_timeout(600)
            ok(p.evaluate(TAB)['cur'] == 'testimony', f'{W}: the 5 key opens the Testimony tab')
        c.close()
    b.close()

errs = [e for e in errors if 'Failed to load resource' not in e]
ok(not errs, f'no page or console errors {errs[:3]}')
print('\n'.join(results + fails))
print(f'\n{len(results)} passed, {len(fails)} failed')
sys.exit(1 if fails else 0)
