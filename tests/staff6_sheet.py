# Staff v6: Bills' two fixes and the spreadsheet (R-336, Nate 25 Oct). On the practice copy (Mon 16 Mar 2026).
#   a. A group never folds away 3 bills or fewer: "No hearing yet" showed 19 of 20 and then "Show all 20 bills" for one.
#   b. The line over the list says what Today and Hearings say: "20 to ask · first by Mon 3/23 · Bills That Need Hearings",
#      the tab's name a link to it on the list's scope; no "Get hearings" left on Bills.
#   c. The spreadsheet (Nate: "We also need a spreadsheet view of bills somewhere"): Rows | Spreadsheet, remembered; every
#      column sorts by its header; a team cell opens its picker (Enter opens, Escape closes) and saves with Undo; Copy for
#      Google Sheets puts the rows and columns shown on the clipboard as tab-separated text; chosen columns are remembered.
#
#   V4_ROOT=/path/to/worktree python3 tests/staff6_sheet.py [--shots DIR]     exits 1 when a check fails
import os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import staff6_lib as L

R = L.Results()
SHOTS = sys.argv[sys.argv.index('--shots') + 1] if '--shots' in sys.argv else ''
def shot(pg, name):
  if SHOTS: pg.shot(os.path.join(SHOTS, name))
def overflow(pg): return pg.page.evaluate('document.documentElement.scrollWidth - innerWidth')
GROUPS = """[...document.querySelectorAll('.bl-grp, tbody.bl-tg')].map(g => {
  const h = g.querySelector('.bl-gh, .bl-grb'), n = +(h?.querySelector('.bl-gn, .n')?.textContent || 0);
  return { name: (h?.querySelector('span:not(.bl-gn):not(.n):not(.bl-ghic)')?.textContent || '').trim(), n,
    shown: g.querySelectorAll('.v6-row, tr[data-row]').length, open: !!g.querySelector('.v6-list, tr[data-row]'), more: !!g.querySelector('[data-full]') }; })"""
LEAD = r'^\d+ to ask · first by (Mon|Tue|Wed|Thu|Fri|Sat|Sun) \d+/\d+ · Bills That Need Hearings$'
def toast(pg): return pg.page.evaluate("[...document.querySelectorAll('.toastmsg')].map(t => t.innerText.trim()).join(' | ')")
def wait_toast(pg, rx, ms=2000):
  for _ in range(ms // 100):
    if re.search(rx, toast(pg)): return True
    pg.page.wait_for_timeout(100)
  return False
def dialog_open(pg): return pg.page.evaluate("!!document.querySelector('dialog[open]')")

with L.browser() as B:
  # ---- a. folding: never 3 or fewer behind Show all, at a laptop's 8 and a phone's 5 ----
  for who, w, h in [('NT', 1440, 900), ('NT', 390, 844), ('KV', 1440, 900), ('LR', 390, 844)]:
    pg = B.page(who, w, h); pg.open('/bills')
    for scope in ['me', 'all']:
      b = pg.page.query_selector(f'[data-seg="blscope"][data-val="{scope}"]')
      if b and b.get_attribute('aria-pressed') != 'true': b.click(); pg.ready(); pg.page.wait_for_timeout(200)
      gs = [g for g in pg.page.evaluate(GROUPS) if g['open']]
      bad = [g for g in gs if g['more'] and g['n'] - g['shown'] <= 3]
      R.check(f'{who} {w} {scope}: no group hides 3 bills or fewer behind Show all', gs and not bad, bad or [(g['name'], g['n'], g['shown']) for g in gs])
      half = [g for g in gs if not g['more'] and g['shown'] != g['n']]
      R.check(f'{who} {w} {scope}: a group with no Show all shows every bill', not half, half)
      if who == 'NT' and w == 1440 and scope == 'me':
        nh = next((g for g in gs if g['name'] == 'No hearing yet'), None)
        R.check('NT Mine: "No hearing yet" shows all 20, with no Show all', nh and nh['n'] == nh['shown'] == 20 and not nh['more'], nh)
        shot(pg, 'bills-rows-1440.png')
      if who == 'NT' and w == 390 and scope == 'me': shot(pg, 'bills-rows-390.png')
    R.check(f'{who} {w}: no page errors', not pg.errors, pg.errors[:2]); pg.close()

  # ---- b. the line over the list: Today's and Hearings' words and count ----
  for who in ['NT', 'KV', 'LR']:
    pg = B.page(who, 1440, 900); pg.open('/hearings')
    hw = pg.page.evaluate("document.querySelector('.hw-ask .hw-ask-n')?.innerText.trim() || ''")
    pg.nav('/bills')
    b = pg.page.query_selector('[data-seg="blscope"][data-val="me"]')
    if b and b.get_attribute('aria-pressed') != 'true': b.click(); pg.ready()
    lead = pg.page.evaluate("document.querySelector('#bl-lead')?.innerText.trim() || ''")
    if not lead or 'to ask' not in lead:
      R.check(f'{who}: no ask line on Bills (nothing to ask, or the group under it says it)', 'Get hearings' not in lead, lead); pg.close(); continue
    R.check(f'{who}: Bills says "N to ask · first by <day> · Bills That Need Hearings"', re.match(LEAD, lead), lead)
    R.check(f'{who}: the same words as Hearings ({hw})', hw and lead.startswith(hw), [lead, hw])
    href = pg.page.evaluate("document.querySelector('#bl-lead a')?.getAttribute('href')")
    R.check(f'{who}: the tab name links to Bills That Need Hearings on My bills', href == '#/hearings/ask?scope=mine', href)
    R.check(f'{who}: no "Get hearings" anywhere on Bills', 'Get hearings' not in pg.text(), '')
    if who == 'NT':
      pg.page.click('[data-seg="blscope"][data-val="all"]'); pg.ready(); pg.page.wait_for_timeout(200)
      href = pg.page.evaluate("document.querySelector('#bl-lead a')?.getAttribute('href') || ''")
      R.check('NT Team: the link carries the Team scope', href == '#/hearings/ask?scope=team', href)
      pg.nav('/'); tl = pg.text()
      R.check('NT: Today says the same pile in the same words', bool(re.search(re.escape(hw), tl)), hw)
      pg.nav('/bills'); pg.page.click('[data-seg="blscope"][data-val="me"]'); pg.ready(); pg.page.click('#bl-lead a'); pg.ready()
      R.check('NT: the link opens Bills That Need Hearings', pg.hash().startswith('#/hearings/ask'), pg.hash())
    R.check(f'{who}: no page errors', not pg.errors, pg.errors[:2]); pg.close()

  # ---- c. the spreadsheet, on a laptop ----
  pg = B.page('NT', 1440, 900); pg.open('/bills')
  sw = pg.page.evaluate("[...document.querySelectorAll('[data-blview]')].map(b => b.innerText.trim())")
  R.check('the switch reads Rows | Spreadsheet', sw == ['Rows', 'Spreadsheet'], sw)
  pg.page.click('[data-blview="table"]'); pg.ready(); pg.page.wait_for_timeout(300)
  R.check('Spreadsheet is on, its table drawn', pg.page.evaluate("document.querySelector('[data-blview=table]').getAttribute('aria-pressed') === 'true' && !!document.querySelector('.bl-table tr[data-row]')"))
  stored = pg.page.evaluate("Object.keys(localStorage).filter(k => k.startsWith('hiphi6_blview_')).map(k => localStorage.getItem(k))")
  R.check("the choice is kept as 'table' (prefs.billsView keeps its value)", stored == ['table'], stored)
  R.check('no Edit mode to enter, and no "Table" on a control', not pg.page.query_selector('[data-tedit]') and not pg.page.evaluate("[...document.querySelectorAll('main button, main a')].some(b => /^\\s*Table\\s*$/.test(b.innerText))"))
  tools = pg.page.evaluate("[...document.querySelectorAll('.bl-ttools .btn')].map(b => b.innerText.trim())")
  R.check('its tools: Columns, Export, Copy for Google Sheets', tools == ['Columns', 'Export', 'Copy for Google Sheets'], tools)
  sw_top = pg.page.evaluate("(r => Math.abs((r(document.querySelector('.bl-viewsw')).top + r(document.querySelector('.bl-viewsw')).bottom) / 2 - (r(document.querySelector('.bl-search')).top + r(document.querySelector('.bl-search')).bottom) / 2) < 4)(e => e.getBoundingClientRect())")
  R.check('Rows | Spreadsheet stays on the filter box line', sw_top)
  shot(pg, 'sheet-1440.png')

  # every column sorts by its header
  heads = pg.page.evaluate("[...document.querySelectorAll('.bl-table thead th')].filter(th => !th.classList.contains('bl-ck')).map(th => [th.innerText.trim(), !!th.querySelector('[data-sort]')])")
  R.check('every column header sorts', heads and all(h[1] for h in heads), heads)
  pg.page.click('[data-sort="title"]'); pg.ready(); pg.page.wait_for_timeout(200)
  first = pg.page.evaluate("[...document.querySelector('tbody.bl-tg').querySelectorAll('tr[data-row] td.bl-ti')].map(t => t.innerText.trim().toLowerCase())")
  R.check('Title sorts A to Z inside a group', first == sorted(first) and len(first) > 2, first[:5])
  R.check('its header says so (aria-sort ascending)', pg.page.evaluate("document.querySelector('[data-sort=title]').closest('th').getAttribute('aria-sort')") == 'ascending')
  pg.page.click('[data-sort="title"]'); pg.ready(); pg.page.wait_for_timeout(200)
  first = pg.page.evaluate("[...document.querySelector('tbody.bl-tg').querySelectorAll('tr[data-row] td.bl-ti')].map(t => t.innerText.trim().toLowerCase())")
  R.check('again: Z to A', first == sorted(first, reverse=True), first[:5])
  pg.page.click('[data-sort="title"]'); pg.ready(); pg.page.wait_for_timeout(200)

  # a team cell: Enter opens its picker, Escape closes it; a pick saves, with Undo
  cell = '.bl-table [data-edit="pos"]'
  bid = pg.page.evaluate(f"document.querySelector('{cell}').dataset.id")
  sel = f'.bl-table [data-edit="pos"][data-id="{bid}"]'
  before = pg.page.inner_text(sel).strip()
  pg.page.focus(sel); pg.page.keyboard.press('Enter'); pg.page.wait_for_timeout(300)
  R.check('Enter on a position cell opens its picker', dialog_open(pg) and pg.page.query_selector('dialog[open] [data-pv="oppose"]') is not None)
  shot(pg, 'sheet-cell-edit-1440.png')
  pg.page.keyboard.press('Escape'); pg.page.wait_for_timeout(300)
  R.check('Escape closes it, nothing changed', not dialog_open(pg) and pg.page.inner_text(sel).strip() == before, before)
  pg.page.click(sel); pg.page.wait_for_timeout(300)
  pg.page.click('dialog[open] [data-pv="oppose"]'); pg.page.wait_for_timeout(500)
  R.check('a pick saves at once: the cell says Oppose', pg.page.inner_text(sel).strip() == 'Oppose', pg.page.inner_text(sel))
  R.check('the message names the change and offers Undo', wait_toast(pg, r'position: .* to Oppose') and pg.page.query_selector('.toastmsg .toastundo') is not None, toast(pg))
  pg.page.click('.toastmsg .toastundo'); pg.page.wait_for_timeout(500)
  R.check('Undo puts the old position back', pg.page.inner_text(sel).strip() == before, [pg.page.inner_text(sel), before])
  R.check('Capitol facts have no edit button', not pg.page.query_selector('.bl-table [data-edit]:not([data-edit="pos"]):not([data-edit="own"]):not([data-edit="nick"])'))

  # Columns: Priority and Nickname, remembered after a reload
  pg.page.click('[data-cols]'); pg.page.wait_for_timeout(300)
  for k in ['pri', 'nick']:
    if not pg.page.is_checked(f'dialog[open] [data-col="{k}"]'): pg.page.click(f'dialog[open] label[for="bl-col-{k}"], dialog[open] [data-col="{k}"]')
    pg.page.wait_for_timeout(200)
  pg.page.keyboard.press('Escape'); pg.page.wait_for_timeout(300)
  heads = pg.page.evaluate("[...document.querySelectorAll('.bl-table thead th')].map(th => th.innerText.trim())")
  R.check('Priority and Nickname join the columns', 'Priority' in heads and 'Nickname' in heads, heads)
  pri = set(pg.page.evaluate("[...document.querySelectorAll('.bl-table tbody tr[data-row]')].map(tr => tr.children[[...document.querySelectorAll('.bl-table thead th')].findIndex(th => th.innerText.trim() === 'Priority')].innerText.trim())"))
  R.check('Priority says Top tier or Standard in words (never P1)', pri and pri <= {'Top tier', 'Standard', 'None'}, pri)
  # a nickname, changed in its cell, with Undo
  nsel = '.bl-table [data-edit="nick"]'
  nid = pg.page.evaluate(f"document.querySelector('{nsel}').dataset.id"); nsel = f'.bl-table [data-edit="nick"][data-id="{nid}"]'
  nbefore = pg.page.inner_text(nsel).strip()
  pg.page.click(nsel); pg.page.wait_for_timeout(300)
  pg.page.fill('#bl-nickin', 'Test nickname here'); pg.page.keyboard.press('Enter'); pg.page.wait_for_timeout(500)
  R.check('a nickname saves from its cell', pg.page.inner_text(nsel).strip() == 'Test nickname here', pg.page.inner_text(nsel))
  R.check('with Undo', wait_toast(pg, 'nickname') and pg.page.query_selector('.toastmsg .toastundo') is not None, toast(pg))
  pg.page.click('.toastmsg .toastundo'); pg.page.wait_for_timeout(500)
  R.check('Undo puts the nickname back', pg.page.inner_text(nsel).strip() == nbefore, [pg.page.inner_text(nsel), nbefore])

  # Copy for Google Sheets
  pg.page.click('[data-copy]'); pg.page.wait_for_timeout(500)
  clip = pg.page.evaluate("navigator.clipboard.readText()")
  lines = clip.split('\n'); n = pg.page.evaluate("document.querySelectorAll('.bl-table tr[data-row]').length")
  heads = pg.page.evaluate("[...document.querySelectorAll('.bl-table thead th')].filter(th => !th.classList.contains('bl-ck')).map(th => th.innerText.trim())")
  R.check('the clipboard: a header row of the columns shown', lines[0].split('\t') == heads, [lines[0], heads])
  R.check(f'and one line per bill shown ({n})', len(lines) - 1 == n, len(lines) - 1)
  R.check('each line has every column, plain words (no HTML)', all(len(l.split('\t')) == len(heads) for l in lines) and '<' not in clip, lines[1][:120] if len(lines) > 1 else '')
  num0 = pg.page.evaluate("document.querySelector('.bl-table tr[data-row] td.bl-num').innerText.trim()")
  R.check('the first line is the first bill', len(lines) > 1 and lines[1].split('\t')[0] == num0, [lines[1][:40] if len(lines) > 1 else '', num0])
  R.check(f'the message: "Copied {n} bills. Paste into Google Sheets or Excel."', wait_toast(pg, re.escape(f'Copied {n} bills. Paste into Google Sheets or Excel.')), toast(pg))

  # remembered after a reload: the spreadsheet and the columns
  pg.page.reload(); pg.page.wait_for_timeout(600); pg.ready()
  R.check('after a reload: still the spreadsheet', pg.page.evaluate("document.querySelector('[data-blview=table]')?.getAttribute('aria-pressed') === 'true' && !!document.querySelector('.bl-table')"))
  heads = pg.page.evaluate("[...document.querySelectorAll('.bl-table thead th')].map(th => th.innerText.trim())")
  R.check('after a reload: Priority and Nickname still shown', 'Priority' in heads and 'Nickname' in heads, heads)
  R.check('no sideways page scroll', overflow(pg) <= 0, overflow(pg))
  shot(pg, 'sheet-columns-1440.png')
  R.check('laptop: no page errors', not pg.errors, pg.errors[:2]); pg.close()

  # ---- the phone: the menu says spreadsheet, and Copy is there ----
  pg = B.page('NT', 390, 844); pg.open('/bills')
  pg.page.click('[data-blmenu]'); pg.page.wait_for_timeout(300)
  items = pg.page.evaluate("[...document.querySelectorAll('dialog[open] .sv-menu .title')].map(t => t.innerText.trim())")
  R.check('phone menu: "Show as a spreadsheet"', 'Show as a spreadsheet' in items and not any('table' in i.lower() for i in items), items)
  pg.page.click('dialog[open] [data-mi="0"]'); pg.page.wait_for_timeout(400); pg.ready()
  R.check('phone: the spreadsheet opens', pg.page.query_selector('.bl-table') is not None)
  R.check('phone: no sideways page scroll (the sheet scrolls in its own box)', overflow(pg) <= 0, overflow(pg))
  shot(pg, 'sheet-390.png')
  tools = pg.page.evaluate("[...document.querySelectorAll('.bl-ttools .btn')].filter(b => b.getBoundingClientRect().width > 0).map(b => b.innerText.trim())")
  R.check('phone: Columns, Export and Copy for Google Sheets on a line of their own', tools == ['Columns', 'Export', 'Copy for Google Sheets'], tools)
  box = pg.page.evaluate("document.querySelector('.bl-search').getBoundingClientRect().width")
  R.check('phone: the filter box keeps its room beside Filter', box >= 150, box)
  pg.page.click('[data-blmenu]'); pg.page.wait_for_timeout(300)
  items = pg.page.evaluate("[...document.querySelectorAll('dialog[open] .sv-menu .title')].map(t => t.innerText.trim())")
  R.check('phone menu then offers Show as rows (Export and Copy are on the line, said once)', items == ['Show as rows'], items)
  pg.page.keyboard.press('Escape'); pg.page.wait_for_timeout(200)
  R.check('phone: no page errors', not pg.errors, pg.errors[:2]); pg.close()

R.done()
