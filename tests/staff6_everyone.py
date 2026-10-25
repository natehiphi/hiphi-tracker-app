# Staff v6: Legislators > Everyone as a grid of faces (R-336 walk 2, Nate: "can this be better organized? Profile
# pictures, easy to identify. Not one big long list?"). On the practice copy (Mon 16 Mar 2026).
#   1. A House | Senate switch, the Senate first (the calmer page), remembered for the person.
#   2. By island (the default): Hawaiʻi Island, Maui County, Oʻahu, Kauaʻi, each a heading over its grid of cards.
#   3. A to Z: a heading row for each letter. By committee: each committee a group, chair first.
#   3a. A row of jump chips, one per group, that brings its heading to the top (critic, R-336 walk 2); on a phone the row
#       slides sideways and the group headings stay under the top bar.
#   4. Each card is one link: a photo (or the initial), the name, the district, at most one line of what they hold of ours.
#   5. About five cards a row on a 1440 laptop, two on a 390 phone; no sideways scroll.
#   6. The find box, the "Hearing our bills this week" preset and Filter still narrow the grid; Sort is in view on a phone.
#
#   V4_ROOT=/path/to/worktree python3 tests/staff6_everyone.py     exits 1 when a check fails
# (V4_ROOT blocks outside addresses, so the Capitol's photos fail there and every card shows its initial: that is the
# missing-photo case, checked below.)
import os, re, sys, unicodedata
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import staff6_lib as L

R = L.Results()
EV = '/legislators?view=everyone'
ISL = ['Hawaiʻi Island', 'Maui County', 'Oʻahu', 'Kauaʻi']
def overflow(pg): return pg.page.evaluate('document.documentElement.scrollWidth - innerWidth')
def heads(pg): return pg.page.evaluate("[...document.querySelectorAll('.lg6-groups .lg6-sh h2')].map(h => h.innerText.trim())")
def cards(pg): return pg.page.evaluate("""[...document.querySelectorAll('#lg-body .lg6-card')].map(a => ({ id: +a.dataset.lglink, href: a.getAttribute('href'),
  name: a.querySelector('.lg6-cname')?.innerText.trim(), dist: a.querySelector('.lg6-cdist')?.innerText.trim(), line: a.querySelector('.lg6-cline')?.innerText.trim() || '',
  links: a.querySelectorAll('a, button').length, ph: (() => { const p = a.querySelector('.lg6-cph'); const r = p.getBoundingClientRect(); const img = p.querySelector('img');
    return { w: Math.round(r.width), h: Math.round(r.height), img: !!img && img.complete && img.naturalWidth > 0, init: getComputedStyle(p, '::before').content.replace(/"/g, '') }; })(),
  group: a.closest('section')?.querySelector('h2')?.innerText.trim() || '' }))""")
def picked(pg): return pg.page.evaluate("document.querySelector('[data-seg=\"lgch\"][aria-pressed=\"true\"]')?.dataset.val")
def per_row(pg): return pg.page.evaluate("(() => { const c = [...document.querySelectorAll('#lg-body .lg6-card')]; const t = c[0].getBoundingClientRect().top; return c.filter(x => Math.abs(x.getBoundingClientRect().top - t) < 2).length; })()")
def chips(pg): return pg.page.evaluate("[...document.querySelectorAll('.lg6-jchip')].map(b => b.innerText.replace(/\\s+/g, ' ').trim())")
def jumplabel(pg): return pg.page.evaluate("document.querySelector('.lg6-jump')?.getAttribute('aria-label') || ''")
def sort(pg, label):
  pg.page.click('[data-lgsort]')
  pg.page.wait_for_timeout(500); pg.page.click(f'dialog[open] >> text="{label}"'); pg.page.wait_for_timeout(500); pg.ready()

with L.browser() as B:
  for w, h in [(1440, 900), (390, 844)]:
    pg = B.page('NT', w, h); pg.open(EV)
    legs = pg.page.evaluate("import('./staff6/data.js').then(m => m.S.legislators.map(l => ({ id: l.id, ch: l.chamber, d: l.district, name: l.name, sort: l.sort_name })))")
    by = {l['id']: l for l in legs}

    # ---- 1. House | Senate ----
    R.check(f'{w}: the switch reads House | Senate', pg.page.evaluate("[...document.querySelectorAll('[data-seg=\"lgch\"]')].map(b => b.innerText.trim())") == ['House', 'Senate'])
    R.check(f'{w}: the Senate is shown first (the calmer page)', picked(pg) == 'S', picked(pg))
    cs = cards(pg)
    R.check(f'{w}: the Senate shows all its senators, no one else', sorted(c['id'] for c in cs) == sorted(l['id'] for l in legs if l['ch'] == 'S'), len(cs))
    R.check(f'{w}: the chip row is named for who and the order', jumplabel(pg) == 'All 25 senators, by island: go to', jumplabel(pg))
    R.check(f'{w}: the find box says what it finds', pg.page.get_attribute('#lg-q', 'placeholder') == ('Name, town, district or committee' if w >= 768 else 'Name, town or district'), pg.page.get_attribute('#lg-q', 'placeholder'))
    sb = pg.page.evaluate("(() => { const s = document.querySelector('[data-lgsort]'), p = document.querySelector('[data-lgweek]'); if (!s || !s.getClientRects().length) return null; return Math.abs(s.getBoundingClientRect().top - p.getBoundingClientRect().top) < 4; })()")
    R.check(f'{w}: Sort is in view, on the preset\'s line', sb is True, sb)

    # ---- 2. By island ----
    R.check(f'{w}: grouped by island in order', heads(pg) == ISL, heads(pg))
    R.check(f'{w}: a jump chip per island, with its count', chips(pg) == ['Hawaiʻi Island 4', 'Maui County 3', 'Oʻahu 17', 'Kauaʻi 1'], chips(pg))
    pg.page.click('.lg6-jchip >> nth=1'); pg.page.wait_for_timeout(900)
    jt = pg.page.evaluate("(() => { const h = document.querySelector('#lg6-g-maui'); const r = h.getBoundingClientRect(); return [Math.round(r.top), document.activeElement === h, Math.round(innerHeight)]; })()")
    R.check(f'{w}: a chip brings its group to the top, clear of the top bar, and moves focus there', jt[1] and ((92 < jt[0] <= 130) if w >= 768 else (56 <= jt[0] <= 90)), jt)
    if w < 768:
      pg.page.evaluate("scrollTo(0, document.querySelector('#lg6-g-oahu').closest('section').offsetTop + 700)"); pg.page.wait_for_timeout(300)
      st = pg.page.evaluate("(() => { const r = document.querySelector('#lg6-g-oahu').closest('.lg6-sh').getBoundingClientRect(); return [Math.round(r.top), Math.round(r.bottom)]; })()")
      R.check(f'{w}: on a phone the group heading stays under the top bar while its cards pass', 40 <= st[0] <= 70, st)
    pg.page.evaluate('scrollTo(0, 0)')
    isl = lambda l: ('Hawaiʻi Island' if l['d'] <= 4 else 'Maui County' if l['d'] <= 7 else 'Kauaʻi' if l['d'] == 8 else 'Oʻahu') if l['ch'] == 'S' else \
      ('Hawaiʻi Island' if l['d'] <= 8 else 'Maui County' if l['d'] <= 14 else 'Kauaʻi' if l['d'] <= 17 else 'Oʻahu')
    R.check(f'{w}: each senator under their own island', all(c['group'] == isl(by[c['id']]) for c in cs), [(c['name'], c['group']) for c in cs if c['group'] != isl(by[c['id']])][:3])
    R.check(f'{w}: in district order inside an island', all(by[a['id']]['d'] < by[b['id']]['d'] for a, b in zip(cs, cs[1:]) if a['group'] == b['group']))
    R.check(f'{w}: under an island the card says the district only (the heading says the island, A-14)', all(re.fullmatch(r'District \d+', c['dist']) for c in cs), cs[0]['dist'])
    pg.page.click('[data-seg="lgch"][data-val="H"]'); pg.page.wait_for_timeout(300); pg.ready()
    cs = cards(pg)
    R.check(f'{w}: House shows every representative', sorted(c['id'] for c in cs) == sorted(l['id'] for l in legs if l['ch'] == 'H'), len(cs))
    R.check(f'{w}: House by island in order', heads(pg) == ISL, heads(pg))
    R.check(f'{w}: each representative under their own island', all(c['group'] == isl(by[c['id']]) for c in cs))
    R.check(f'{w}: the switch keeps focus on its pick', pg.page.evaluate("document.activeElement?.dataset?.val") == 'H')
    pg.open(EV)
    R.check(f'{w}: House is remembered for the person', picked(pg) == 'H', picked(pg))

    # ---- 4. the cards ----
    cs = cards(pg)
    R.check(f'{w}: each card is one link to that legislator', all(c['links'] == 0 and c['href'].startswith(f"#/legislator/{c['id']}") for c in cs))
    R.check(f'{w}: each card names them', all(c['name'] == by[c['id']]['name'] for c in cs))
    size = 96 if w >= 768 else 80
    R.check(f'{w}: each photo is {size}px and round', all(c['ph']['w'] == size and c['ph']['h'] == size for c in cs) and pg.page.evaluate("getComputedStyle(document.querySelector('.lg6-cph')).borderRadius") == '50%', cs[0]['ph'])
    R.check(f'{w}: a card with no photo (or a failed one) shows the initial, never a broken image',
      all(c['ph']['img'] or c['ph']['init'] == by[c['id']]['name'][0] for c in cs) and not pg.page.evaluate("[...document.querySelectorAll('.lg6-cph img')].some(i => i.complete && i.naturalWidth === 0)"))
    LINE = r'Chairs the hearing on 1 of our bills this week|Chairs hearings on \d+ of our bills this week|Hearing \d+ of our bills this week|Chair: (1 of our bills waits|\d+ of our bills wait) on them|\d+ of our bills in their committees'
    bad = [c['line'] for c in cs if c['line'] and not re.fullmatch(LINE, c['line'])]
    R.check(f'{w}: one line of what they hold of ours, or none', not bad and any(c['line'] for c in cs) and any(not c['line'] for c in cs), bad[:3])
    R.check(f'{w}: someone hears our bills this week, someone chairs one waiting', any('this week' in c['line'] for c in cs) and any(c['line'].startswith('Chair:') for c in cs))
    wt = pg.page.evaluate("[...document.querySelectorAll('.lg6-cline')].map(e => [e.innerText.startsWith('Chair:'), +getComputedStyle(e).fontWeight])")
    R.check(f'{w}: only the chair line is bold, the rest regular', all((wgt >= 600) == ch for ch, wgt in wt), wt[:4])
    if w >= 768:
      two = pg.page.evaluate("(() => { const c = [...document.querySelectorAll('#lg-body .lg6-card')]; const tops = [...new Set(c.map(x => Math.round(x.getBoundingClientRect().top)))].sort((a, b) => a - b); return c.filter(x => Math.round(x.getBoundingClientRect().top) <= tops[1] && x.getBoundingClientRect().bottom <= innerHeight).length; })()")
      R.check(f'{w}: two full rows of cards on the first screen', two >= 8, two)
    n = per_row(pg)
    R.check(f'{w}: {"about five" if w >= 768 else "two"} cards a row', (4 <= n <= 6) if w >= 768 else n == 2, n)
    R.check(f'{w}: no sideways scroll', overflow(pg) <= 0, overflow(pg))
    pg.page.click('#lg-body .lg6-card'); pg.ready()
    R.check(f'{w}: a card opens the legislator', pg.hash().startswith('#/legislator/'), pg.hash())
    pg.page.go_back(); pg.page.wait_for_timeout(300); pg.ready()

    # ---- 3. A to Z, By committee ----
    sort(pg, 'A to Z'); cs = cards(pg)
    lets = heads(pg)
    R.check(f'{w}: A to Z, the chip row says so', jumplabel(pg) == 'All 52 representatives, A to Z: go to', jumplabel(pg))
    R.check(f'{w}: A to Z keeps every representative', len(cs) == sum(1 for l in legs if l['ch'] == 'H'))
    R.check(f'{w}: a heading row for each letter, in order, the chips the same letters', len(lets) >= 10 and lets == sorted(set(lets)) and all(len(x) == 1 for x in lets) and chips(pg) == lets, lets)
    first = lambda l: unicodedata.normalize('NFD', (l['sort'] or l['name']).split(',')[0].strip())[0].upper()
    R.check(f'{w}: everyone under their own surname\'s letter', all(c['group'] == first(by[c['id']]) for c in cs), [(c['name'], c['group']) for c in cs if c['group'] != first(by[c['id']])][:3])
    sort(pg, 'By committee'); cs = cards(pg)
    gs = heads(pg)
    R.check(f'{w}: by committee, each a group, House committees only', len(gs) >= 10 and all(g.startswith('House ') for g in gs), gs[:3])
    R.check(f'{w}: committees in A to Z order', gs == sorted(gs), gs)
    R.check(f'{w}: a chip per committee by its short name', chips(pg) == [g.replace('House ', '', 1) for g in gs], chips(pg)[:3])
    if w < 768:
      row = pg.page.evaluate("(() => { const r = document.querySelector('.lg6-jrow'); return [getComputedStyle(r).flexWrap, r.scrollWidth > r.clientWidth, [...r.children].every(c => Math.abs(c.getBoundingClientRect().top - r.children[0].getBoundingClientRect().top) < 2)]; })()")
      R.check(f'{w}: on a phone the chips are one row that slides sideways', row == ['nowrap', True, True], row)
    first = pg.page.evaluate("[...document.querySelectorAll('.lg6-groups section')].map(s => [...s.querySelectorAll('.lg6-cdist')].map(e => e.innerText.split(' · ')[0]))")
    R.check(f'{w}: the chair first, then the vice chair, then members', all(g and g[0] == 'Chair' and (len(g) < 2 or g[1] == 'Vice chair') and all(not x.startswith(('Chair', 'Vice')) for x in g[2:]) for g in first), first[:2])
    many = {}
    for c in cs: many[c['id']] = many.get(c['id'], 0) + 1
    R.check(f'{w}: a legislator appears under each committee they sit on', len(cs) > len(many) and max(many.values()) >= 2, (len(cs), len(many)))
    R.check(f'{w}: the screen reader count says people, not cards', pg.page.evaluate("document.querySelector('#lg-status').textContent") == f"{len(many)} legislators listed", pg.page.evaluate("document.querySelector('#lg-status').textContent"))
    sort(pg, 'By island')
    R.check(f'{w}: back to By island', heads(pg) == ISL)

    # ---- 6. the find box, the preset, Filter ----
    pg.page.fill('#lg-q', 'Kailua'); pg.page.wait_for_timeout(300)
    cs = cards(pg)
    R.check(f'{w}: the find box shows its matches as cards, both chambers', len(cs) >= 2 and {by[c['id']]['ch'] for c in cs} == {'H', 'S'}, len(cs))
    R.check(f'{w}: a found card says the chamber and the town it matched', all(re.match(r'(Rep|Sen)\. ', c['name']) for c in cs) and any(c['line'].startswith('Covers Kailua') for c in cs), [(c['name'], c['line']) for c in cs][:2])
    R.check(f'{w}: no switch while searching (the box searches everyone)', not pg.page.query_selector('[data-seg="lgch"]'))
    pg.page.fill('#lg-q', 'HD 20'); pg.page.wait_for_timeout(300); cs = cards(pg)
    R.check(f'{w}: a district finds its representative', len(cs) == 1 and by[cs[0]['id']]['d'] == 20)
    pg.page.fill('#lg-q', ''); pg.page.wait_for_timeout(300)
    R.check(f'{w}: clearing the box brings the grid back', heads(pg) == ISL)
    pg.page.click('[data-lgweek="1"]'); pg.page.wait_for_timeout(300); pg.ready()
    cs = cards(pg); cap = pg.text('.lg6-cap')
    R.check(f'{w}: the preset narrows the grid to who hears our bills', cs and all('this week' in c['line'] for c in cs), [c['line'] for c in cs if 'this week' not in c['line']][:2])
    R.check(f'{w}: and says the other chamber\'s count', re.search(r'representatives? hears? our bills this week · \d+ senators? too', cap), cap)
    R.check(f'{w}: still grouped by island', heads(pg) and all(x in ISL for x in heads(pg)), heads(pg))
    pg.page.click('[data-lgweek="0"]'); pg.page.wait_for_timeout(300); pg.ready()
    pg.page.click('[data-lgfilter]'); pg.page.wait_for_timeout(400)
    items = pg.page.evaluate("[...document.querySelectorAll('dialog[open] button')].map(b => b.innerText.split('\\n')[0].trim()).filter(Boolean)")
    R.check(f'{w}: Filter no longer asks the chamber (the switch does)', 'Chamber' not in items and 'Island' in items, items)
    pg.page.click('dialog[open] >> text="Island"'); pg.page.wait_for_timeout(600)
    pg.page.click('dialog[open] >> text="Maui County"'); pg.page.wait_for_timeout(400); pg.ready()
    cs = cards(pg)
    R.check(f'{w}: Filter by island narrows the grid', heads(pg) == ['Maui County'] and len(cs) == sum(1 for l in legs if l['ch'] == 'H' and 9 <= l['d'] <= 14), (heads(pg), len(cs)))
    R.check(f'{w}: the lead names the filter', '6 representatives from Maui County' in pg.text('.lg6-cap'), pg.text('.lg6-cap'))
    pg.page.click('.lg6-cap [data-lgclear="filters"]'); pg.page.wait_for_timeout(300)
    R.check(f'{w}: Clear filters brings everyone back', len(cards(pg)) == sum(1 for l in legs if l['ch'] == 'H'))
    R.check(f'{w}: no page errors', not pg.errors, pg.errors[:2]); pg.close()

R.done()
