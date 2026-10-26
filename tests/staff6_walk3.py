# Staff v6: the walk 3 fix to Bills That Need Hearings' deadline line (R-336, Nate's walk 3). On the practice copy (Mon 16 Mar 2026).
#   The line under each deadline said the same number twice: "16 of your bills need a hearing · 16 to ask". Now:
#     every one still to ask   -> "16 of your bills need a hearing · none asked yet"
#     some asked already       -> "3 of your bills need a hearing · 2 still to ask" (this deadline's bills only, never a share
#                                 of the tab's total: "12 of the 20 still to ask" mixed two totals, the critic)
#   On a phone the "·" before the Bills That Need Hearings link goes with the link, never left at a line's end.
#   Today, Bills and Hearings keep their one top line, "20 to ask · first by Mon 3/23", and its number is the board's to-ask
#   bills added up over the deadlines, so no two screens give two numbers for one pile.
#
#   V4_ROOT=/path/to/worktree python3 tests/staff6_walk3.py     exits 1 when a check fails
import os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import staff6_lib as L

R = L.Results()
LINE = re.compile(r'^(\d+) of (?:your|your coalitions’|the team’s|[A-Z][a-z]+’s) bills? needs? a hearing · (none asked yet|(\d+) still to ask)(?: · |$)')
TOP = re.compile(r'(\d+) to ask · first by (?:Mon|Tue|Wed|Thu|Fri|Sat|Sun) \d+/\d+')
def dls(pg): return pg.page.evaluate("[...document.querySelectorAll('.hg-dlh .hg-dls:not(.hg-dld)')].map(e => e.innerText.replace(/\\s+/g, ' ').trim())")
def toask(lines):
  # the board's to-ask bills over every deadline: "none asked yet" counts them all
  n = 0
  for x in lines:
    m = LINE.match(x)
    if m: n += int(m.group(1)) if m.group(2) == 'none asked yet' else int(m.group(3))
  return n

seen = {'none': 0, 'still': 0}
with L.browser() as B:
  for who in ['NT', 'KV', 'KR', 'LR', 'SY', 'JS']:
    tops = {}
    for route in ['/legislators?view=ask', '/hearings/ask']:
      pg = B.page(who, 1440, 900); pg.open(route)
      for scope in [None] + [s for s in pg.page.evaluate("[...document.querySelectorAll('[data-seg=\"lgask\"], [data-seg=\"hscope\"]')].map(b => b.dataset.val)") if s]:
        if scope: pg.page.click(f'[data-seg="lgask"][data-val="{scope}"], [data-seg="hscope"][data-val="{scope}"]'); pg.page.wait_for_timeout(300); pg.ready()
        ls = [x for x in dls(pg) if 'need' in x]
        where = f'{who} {route} {scope or "first"}'
        twice = [x for x in ls if re.search(r'^(\d+) .*needs? a hearing · \1 (to ask|still to ask)', x)]
        R.check(f'{where}: no line says one number twice', not twice, twice[:2])
        bad = [x for x in ls if not LINE.match(x) and ' to ask' in x]
        R.check(f'{where}: each line says "none asked yet" or how many are still to ask', not bad, bad[:2])
        fewer = [x for x in ls if (m := LINE.match(x)) and m.group(3) and not int(m.group(3)) < int(m.group(1))]
        R.check(f'{where}: "still to ask" is fewer than need a hearing', not fewer, fewer[:2])
        R.check(f'{where}: never the old "N to ask" after "need a hearing"', not any(re.search(r'need[s]? a hearing · \d+ (of the \d+ )?to ask', x) for x in ls), ls[:2])
        seen['none'] += sum('none asked yet' in x for x in ls); seen['still'] += sum('still to ask' in x for x in ls)
      R.check(f'{who} {route}: no page errors', not pg.errors, pg.errors[:2]); pg.close()
    # Today, Bills and Hearings: the one top line, its count the board's (the person's own bills)
    for route in ['/', '/bills', '/hearings']:
      pg = B.page(who, 1440, 900); pg.open(route)
      m = TOP.search(pg.text('body'))
      if m: tops[route] = int(m.group(1))
      pg.close()
    if '/hearings' in tops:
      pg = B.page(who, 1440, 900); pg.open('/hearings/ask')
      mine = pg.page.query_selector('[data-seg="hscope"][data-val="mine"]')
      if mine: mine.click(); pg.page.wait_for_timeout(300); pg.ready()
      n = toask([x for x in dls(pg) if 'need' in x]); pg.close()
      R.check(f'{who}: Hearings\' "{tops["/hearings"]} to ask" is the board\'s to-ask bills added up', n == tops['/hearings'], (n, tops))
      R.check(f'{who}: Today and Bills say the same count as Hearings', all(v == tops['/hearings'] for k, v in tops.items() if k in ('/', '/bills')), tops)

R.check('someone\'s board says "none asked yet"', seen['none'] > 0, seen)
R.check('someone\'s board says "still to ask"', seen['still'] > 0, seen)

# the phone: the line stays whole parts, no sideways scroll
with L.browser() as B:
  pg = B.page('NT', 390, 844); pg.open('/legislators?view=ask')
  ls = dls(pg)
  R.check('390: Who to ask says "none asked yet" on the first deadline', ls and 'none asked yet' in ls[0], ls[:1])
  dot = pg.page.evaluate("[...document.querySelectorAll('.hg-dlgo')].map(a => { const t = a.previousSibling; return t && t.nodeType === 3 && t.nodeValue.endsWith('·\\u00a0'); })")
  R.check('390: the "·" before Bills That Need Hearings is held to the link (a no-break space)', dot and all(dot), dot)
  rr = pg.page.evaluate("(() => { const a = document.querySelector('.hg-dlgo'), p = a.closest('.hg-dls'), r = document.createRange(); const t = a.previousSibling; r.setStart(t, t.nodeValue.length - 2); r.setEnd(t, t.nodeValue.length - 1); const d = r.getBoundingClientRect(), l = a.getClientRects()[0]; return [Math.round(d.top), Math.round(l.top)]; })()")
  R.check('390: the "·" sits on the link\'s line', abs(rr[0] - rr[1]) <= 4, rr)
  R.check('390: no sideways scroll', pg.page.evaluate('document.documentElement.scrollWidth - innerWidth') <= 0)
  pg.close()

R.done()
