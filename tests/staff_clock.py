# Staff v2 Today: the Next deadline panel and the "N bills with no hearing yet" button (Nate, 9/21: "when it is
# tapped nothing happens"). python3 tests/staff_clock.py
# The button drops the bills it counted into the list as suggestions (Nate, 9/19). These checks press it on your own
# list, a teammate's list (where it used to do nothing), a quiet day (where it only swapped one line of text), and in
# the rarer states its note has to explain: a counted bill already on your list, one put off, more than five.
# R-022 (9/21): the panel names the bills with no hearing (links), shows the deadline after it with its own button
# (decision 3), "Showing 5 of N" gets a "See all … in Bills" link, a suggestion shows one button and a "…" holding
# Done / Not now / Not this bill, a P1 bill with a dated "Ask the chair" card is never also a suggestion, and the
# section never says "Nothing urgent" or "Nothing here is on the clock" over a suggestion racing a deadline.
import os, sys, re
from playwright.sync_api import sync_playwright
BASE = os.environ.get('STAFF_BASE', 'http://localhost:8832/staff.html?demo=1')
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out', 'clock'); os.makedirs(OUT, exist_ok=True)
results, fails, errors = [], [], []
def ok(c, m): (results if c else fails).append(('PASS ' if c else 'FAIL ') + m)

STATE = r"""(() => {
  const b = document.querySelector('[data-clockwork]'), s = document.querySelector('.td-sugg'), h = document.getElementById('td-g-sugg');
  const r = s && s.getBoundingClientRect(), a = document.activeElement;
  return { btn: !!b, expanded: b ? b.getAttribute('aria-expanded') : null, count: b ? +((b.innerText.match(/(\d+) bills? with no hearing yet/) || [])[1] || 0) : 0,
    sugg: !!s, head: h ? h.innerText.replace(/\s+/g, ' ').trim() : '', inView: !!r && r.top >= 0 && r.top < innerHeight - 80,
    bills: [...new Set([...document.querySelectorAll('.td-sugg .td-sg')].map(e => e.dataset.bill))].length,
    answers: document.querySelectorAll('.td-sugg [data-sgmore]').length, showAll: !!document.querySelector('.td-sugg [data-sgall]'),
    names: [...document.querySelectorAll('.td-cknames a[href^="#/bill/"]')].map(a => a.querySelector('.td-num')?.innerText.trim()),
    then: document.querySelector('[data-clockwork="then"]') ? +((document.querySelector('[data-clockwork="then"]').innerText.match(/(\d+) bills? with no hearing yet/) || [])[1] || 0) : 0,
    bills2: document.querySelector('.td-sugg [data-sgbills]')?.innerText.replace(/\s+/g, ' ').trim() || '',
    words: [...document.querySelectorAll('#td-g-sugg, .td-sugg .td-sgnote > span, .td-sugg .td-sgwhy, .td-sugg .td-sg > .td-s')].map(e => e.innerText).join(' · ').replace(/\s+/g, ' '),
    cards: [...document.querySelectorAll('.td-sugg .td-sg')].map(e => e.querySelector('.td-num')?.innerText.trim()),
    note: document.querySelector('.td-sugg .td-sgnote')?.innerText.replace(/\s+/g, ' ').trim() || '',
    clock: document.querySelector('.td-ck')?.innerText.replace(/\s+/g, ' ').trim() || '',
    panel: document.querySelector('.td-p-clock')?.innerText.replace(/\s+/g, ' ').trim() || '',
    focusHead: !!a && !!h && (a === h || h.contains(a)) };
})()"""

def ctx(b, w, h):
    c = b.new_context(viewport={'width': w, 'height': h}, is_mobile=w < 600, has_touch=w < 600, device_scale_factor=2 if w < 600 else 1)
    p = c.new_page()
    p.on('pageerror', lambda e: errors.append(f'{w}: {e}'))
    p.on('console', lambda m: errors.append(f'console {w}: {m.text[:160]}') if m.type == 'error' else None)
    return c, p

def load(p, extra='', setup=None):
    p.goto(BASE + extra + '#/')
    if setup: p.evaluate(setup)
    p.reload(); p.wait_for_timeout(3500)

def press(p, sel='[data-clockwork]'):   # the first is the nearest deadline's
    el = p.locator(sel).first; el.scroll_into_view_if_needed(); p.wait_for_timeout(150)
    el.tap() if p.viewport_size['width'] < 600 else el.click()
    p.wait_for_timeout(900)   # the smooth scroll

def opened(tag, s, ro=False):
    ok(s['expanded'] == 'true', f'{tag}: the button says it is open (aria-expanded {s["expanded"]})')
    ok(s['sugg'] and s['head'].startswith('No hearing yet'), f'{tag}: the section is named in the button\'s words ("{s["head"]}")')
    ok(s['inView'], f'{tag}: what it opened is on screen')
    ok(s['focusHead'], f'{tag}: the focus moved to what it opened')
    # every bill it counted is a card here, or named as already on the list (a P1 bill's dated chair ask, R-022)
    ok(s['bills'] >= 1 or ' above.' in s['note'], f'{tag}: it shows the bills, or says where they are ({s["bills"]} of {s["count"]}; "{s["note"][:90]}")')
    ok('has to be heard by' in s['note'], f'{tag}: the note says by when ("{s["note"][:70]}")')
    if ro: ok(s['answers'] == 0 and not s['showAll'], f'{tag}: read-only on a teammate\'s list ({s["answers"]} answer menus, Show all {s["showAll"]})')
    else: ok(s['answers'] == s['bills'] and s['showAll'], f'{tag}: one "…" (Done / Not now / Not this bill) on each card, and Show all suggestions ({s["answers"]} of {s["bills"]})')
    ok(not re.search(r'\b(over)?due\b', s['words'], re.I), f'{tag}: the suggestions never say "due" ("{s["words"][:60]}")')

def menu_pick(p, card_sel, label):
    # a suggestion's "…" opens its answers; each is a menu item
    el = p.locator(card_sel).first; el.scroll_into_view_if_needed(); el.click(); p.wait_for_timeout(500)
    items = p.evaluate("[...document.querySelectorAll('dialog[open] .sv-menu button .title')].map(e => e.innerText.trim())")
    p.locator('dialog[open] .sv-menu button').filter(has_text=label).first.click(); p.wait_for_timeout(800)
    return items

with sync_playwright() as pw:
    b = pw.chromium.launch()
    for W, H, tag in ((390, 844, 'phone'), (1440, 900, 'desk'), (1024, 768, 'd1024')):
        # ---- your own list, as James: his nearest deadline (Triple filing, 3/19) has a bill with no hearing and the one
        # after (3/30) has four. Nate's had one only because of R-036: HB1732's Senate referrals read as three stops, so
        # it raced 3/19. They are two (HOU, WAM), it races 3/30, and Nate's 3/19 bill has its hearing (backend 3.24).
        c, p = ctx(b, W, H); load(p, '&as=JM')
        s0 = p.evaluate(STATE)
        ok(s0['btn'] and s0['count'] >= 1 and s0['expanded'] == 'false', f'{tag} mine: the button is there, closed ({s0["count"]} bills)')
        ok(len(s0['names']) == min(s0['count'], 4) and all(s0['names']), f'{tag} mine: the bills with no hearing are named, each a link to its bill ({s0["names"]})')
        ok(s0['then'] >= 1 and 'Then Mon 3/30' in s0['panel'] and 'Second lateral' in s0['panel'], f'{tag} mine: the deadline after it has its own row and button ({s0["then"]} bills; "{s0["panel"][-90:]}")')
        press(p); s1 = p.evaluate(STATE); p.screenshot(path=f'{OUT}/{tag}_mine_open.png')
        opened(f'{tag} mine', s1)
        ok(s1['bills'] == s1['count'], f'{tag} mine: one card for each bill counted ({s1["bills"]}/{s1["count"]})')
        press(p); s2 = p.evaluate(STATE)
        ok(s2['expanded'] == 'false' and not s2['head'].startswith('No hearing yet'), f'{tag} mine: pressed again, it closes ("{s2["head"]}")')
        # switching lists drops the filter
        press(p); p.locator('[data-seg="tdscope"][data-val="team"]').first.click(); p.wait_for_timeout(700)
        s3 = p.evaluate(STATE)
        ok(s3['expanded'] == 'false' and not s3['head'].startswith('No hearing yet'), f'{tag}: moving to Everyone drops the filter ("{s3["head"]}")')
        c.close()

        # ---- a teammate's list: the button used to do nothing here ----
        c, p = ctx(b, W, H); load(p)
        if W >= 900:
            p.locator('.td-load[data-who]').filter(has_text='James').first.click()
        else:
            p.locator('[data-seg="tdscope"][data-val="team"]').first.tap(); p.wait_for_timeout(600)
            p.locator('[data-whopick]').first.tap(); p.wait_for_timeout(600)
            p.locator('dialog[open] button, dialog[open] [role="option"]').filter(has_text='James').first.tap()
        p.wait_for_timeout(900)
        s0 = p.evaluate(STATE)
        ok('James' in p.evaluate("document.title") and s0['btn'] and not s0['sugg'], f'{tag} James: his list, the button, and no suggestions of his own until it is pressed')
        press(p); s1 = p.evaluate(STATE); p.screenshot(path=f'{OUT}/{tag}_james_open.png')
        opened(f'{tag} James', s1, ro=True)
        press(p); s2 = p.evaluate(STATE)
        ok(s2['expanded'] == 'false' and not s2['sugg'], f'{tag} James: pressed again, it closes')
        c.close()

        # ---- a quiet day (Kevin): the section is already open with the same bills ----
        c, p = ctx(b, W, H); load(p, '&as=KV')
        s0 = p.evaluate(STATE)
        press(p); s1 = p.evaluate(STATE)
        opened(f'{tag} Kevin (quiet day)', s1)
        ok(s0['head'] != s1['head'], f'{tag} Kevin: the heading changes, so the press visibly lands ("{s0["head"][:30]}" -> "{s1["head"]}")')
        c.close()

    # ---- the panel's wording when nothing, or one bill, races the deadline ----
    c, p = ctx(b, 1440, 900); load(p, '&as=JS'); s = p.evaluate(STATE)
    ok('None of your bills has to be heard by then.' in s['clock'] and 'Every one' not in s['clock'] and not s['btn'], f'Jess: nothing racing reads plainly ("{s["clock"]}")')
    c.close()
    c, p = ctx(b, 1440, 900); load(p, '&as=MR'); s = p.evaluate(STATE)
    ok('1 bill must be heard by then.' in s['clock'] and 'It has a hearing.' in s['clock'], f'May Rose: one bill, heard ("{s["clock"]}")')
    c.close()

    # ---- the note accounts for every bill counted (as James, see above) ----
    c, p = ctx(b, 1440, 900); load(p, '&as=JM')
    # a to-do due today puts the first of James's no-hearing bills on today's list
    first = p.evaluate("""(async () => { const d = await import('./staff/data.js'), m = await import('./staff/model.js');
      const nh = m.sessionClock(d.S.bills.filter(d.isMine)).noHearing, b = nh[0];
      (d.S.todos[b.id] ??= []).push({ id: 'test-clock', bill_id: b.id, title: 'Call the committee clerk', due_date: '2026-03-16', assignee_id: d.S.me.id, done: false });
      d.hooks.render(); return m.billNum(b); })()""")
    p.wait_for_timeout(500); press(p); s = p.evaluate(STATE)
    ok(f'{first} is on your list above.' in s['note'] and s['bills'] == s['count'] - 1, f'a counted bill with a card today is named, not dropped ("{s["note"]}")')
    c.close()
    # the deadline after it: its own button opens its own bills, five at a time, with a way to see them all in Bills
    # (Nate: nine bills with no hearing race 3/30, so "Showing 5 of 9" and the link to Bills both show)
    c, p = ctx(b, 1440, 900); load(p)
    press(p, '[data-clockwork="then"]'); s = p.evaluate(STATE)
    ok(s['head'].startswith('No hearing yet') and 'has to be heard by Mon 3/30' in s['note'] and s['focusHead'] and s['inView'], f'the deadline after: its button opens its bills ("{s["head"]}", "{s["note"][:60]}")')
    ok(s['bills'] == min(5, s['then']) and (s['then'] <= 5 or f'Showing 5 of {s["then"]}.' in s['note']), f'the deadline after: five shown of {s["then"]}, and the note says so ("{s["note"]}")')
    ok(s['then'] <= 5 or (s['bills2'].startswith('See ') and s['bills2'].endswith('in Bills')), f'"Showing 5 of N" has a link to Bills ("{s["bills2"]}")')
    # Not now on one of them, from its "…": it is named as having nothing to suggest right now, and Undo brings it back
    gone = s['cards'][0]
    items = menu_pick(p, '.td-sugg [data-sgmore]', 'Not now'); s = p.evaluate(STATE)
    ok(items == ['Done', 'Not now', 'Not this bill'], f'the "…" holds the three answers ({items})')
    ok(f'Nothing to suggest on {gone} right now' in s['note'] and gone not in s['cards'], f'a bill put off is named ("{s["note"]}")')
    toast = p.evaluate("document.querySelector('.toastmsg')?.innerText || ''")
    ok('comes back in two weeks' in toast and 'Undo' in toast, f'Not now says what it did, with Undo ("{toast}")')
    p.locator('.toastmsg .toastundo').first.click(); p.wait_for_timeout(700); s = p.evaluate(STATE)
    ok(gone in s['cards'], f'Undo puts {gone} back ({s["cards"]})')
    # See all in Bills: the Bills list, filtered to hold them
    if s['bills2']:
        n = int(re.search(r'(\d+)', s['bills2']).group(1))
        p.locator('.td-sugg [data-sgbills]').first.click(); p.wait_for_timeout(1500)
        rows = p.evaluate("[...new Set([...document.querySelectorAll('main [data-bill]')].map(e => e.dataset.bill))].length")
        ok(p.evaluate('location.hash') == '#/bills' and rows == n, f'See all in Bills opens Bills with the {n} it named ({p.evaluate("location.hash")}, {rows} rows)')
    c.close()
    # a P1 bill with a dated "Ask the chair" card is never also a suggestion (Lauren's HB1779, due to race 3/30)
    c, p = ctx(b, 1440, 900); load(p, '&as=LR'); s = p.evaluate(STATE)
    chair = p.evaluate("[...document.querySelectorAll('.td-card')].filter(e => /Ask the chairs? for a hearing/.test(e.innerText)).map(e => e.dataset.num)")
    if not chair:   # folded under "Coming up": open it
        p.locator('[data-fold="later"]').first.click(); p.wait_for_timeout(500)
        chair = p.evaluate("[...document.querySelectorAll('.td-card')].filter(e => /Ask the chairs? for a hearing/.test(e.innerText)).map(e => e.dataset.num)"); s = p.evaluate(STATE)
    ok(len(chair) >= 1 and not any(n in (s['cards'] or []) for n in chair), f'Lauren: a P1 chair ask on the list is not also a suggestion (cards {chair}, suggestions {s["cards"]})')
    c.close()
    # a quiet day whose suggestions race this week's deadline: the heading is truthful, and still never says "due"
    c, p = ctx(b, 1440, 900); load(p, '&as=JM'); s = p.evaluate(STATE)
    racing = p.evaluate("(async () => { const m = await import('./staff/model.js'), d = await import('./staff/data.js'); return m.suggestions(d.S.bills.filter(d.isMine)).filter(x => x.urgent).length; })()")
    ok(racing >= 1 and s['sugg'], f'James: a quiet day with {racing} suggestion(s) racing a deadline this week')
    ok('Nothing urgent' not in s['head'] and 'Nothing here is on the clock' not in s['note'] and 'deadline in the next seven days' in s['note'], f'James: no "Nothing urgent" over a deadline ("{s["head"]}", "{s["note"][:90]}")')
    ok(not re.search(r'\b(over)?due\b', s['words'], re.I), f'James: the heading, the note and the cards never say "due" ("{s["words"][:80]}")')
    c.close()
    # more than five: five copies of a no-hearing bill in the team's list, so there are more than five whatever the list
    # held (since R-036 the team's 3/19 list holds one bill: HB1732 left it)
    c, p = ctx(b, 1440, 900); load(p, setup="localStorage.setItem('hiphi2_today_scope_demo', 'team')")
    p.evaluate("""(async () => { const d = await import('./staff/data.js'), m = await import('./staff/model.js');
      const b = m.sessionClock(d.S.bills).noHearing[0];
      for (let i = 0; i < 5; i++) d.S.bills.push({ ...b, id: 990000 + i, bill_number: 'HB' + (9901 + i) });
      d.hooks.render(); })()""")
    p.wait_for_timeout(500); press(p); s = p.evaluate(STATE)
    ok(s['count'] > 5 and s['bills'] == 5 and f'Showing 5 of {s["count"]}.' in s['note'], f'more than five: five shown, and the note says so ({s["count"]} counted, "{s["note"]}")')
    c.close()
    b.close()

print('\n'.join(fails)); print(f'{len(fails)} failed, {len(results)} passed'); print('errors:', errors[:12])
sys.exit(1 if fails else 0)
