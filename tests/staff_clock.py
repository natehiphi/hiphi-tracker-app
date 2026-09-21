# Staff v2 Today: the Next deadline panel and the "N bills with no hearing yet" button (Nate, 9/21: "when it is
# tapped nothing happens"). python3 tests/staff_clock.py
# The button drops the bills it counted into the list as suggestions (Nate, 9/19). These checks press it on your own
# list, a teammate's list (where it used to do nothing), a quiet day (where it only swapped one line of text), and in
# the rarer states its note has to explain: a counted bill already on today's list, one put off, more than five.
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
    answers: document.querySelectorAll('.td-sugg [data-sgdo]').length, showAll: !!document.querySelector('.td-sugg [data-sgall]'),
    note: document.querySelector('.td-sugg .td-sgnote')?.innerText.replace(/\s+/g, ' ').trim() || '',
    clock: document.querySelector('.td-ck')?.innerText.replace(/\s+/g, ' ').trim() || '',
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

def press(p, sel='[data-clockwork]'):
    el = p.locator(sel).first; el.scroll_into_view_if_needed(); p.wait_for_timeout(150)
    el.tap() if p.viewport_size['width'] < 600 else el.click()
    p.wait_for_timeout(900)   # the smooth scroll

def opened(tag, s, ro=False):
    ok(s['expanded'] == 'true', f'{tag}: the button says it is open (aria-expanded {s["expanded"]})')
    ok(s['sugg'] and s['head'].startswith('No hearing yet'), f'{tag}: the section is named in the button\'s words ("{s["head"]}")')
    ok(s['inView'], f'{tag}: what it opened is on screen')
    ok(s['focusHead'], f'{tag}: the focus moved to what it opened')
    ok(s['bills'] >= 1, f'{tag}: it shows the bills ({s["bills"]} of {s["count"]})')
    ok('has to be heard by' in s['note'], f'{tag}: the note says by when ("{s["note"][:70]}")')
    if ro: ok(s['answers'] == 0 and not s['showAll'], f'{tag}: read-only on a teammate\'s list ({s["answers"]} answer buttons, Show all {s["showAll"]})')
    else: ok(s['answers'] == 3 * s['bills'] and s['showAll'], f'{tag}: Done / Not now / Not this bill on each card, and Show all suggestions')

with sync_playwright() as pw:
    b = pw.chromium.launch()
    for W, H, tag in ((390, 844, 'phone'), (1440, 900, 'desk'), (1024, 768, 'd1024')):
        # ---- your own list ----
        c, p = ctx(b, W, H); load(p)
        s0 = p.evaluate(STATE)
        ok(s0['btn'] and s0['count'] >= 1 and s0['expanded'] == 'false', f'{tag} mine: the button is there, closed ({s0["count"]} bills)')
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

    # ---- the note accounts for every bill counted ----
    c, p = ctx(b, 1440, 900); load(p)
    # a to-do due today puts the first of Nate's no-hearing bills on today's list
    first = p.evaluate("""(async () => { const d = await import('./staff/data.js'), m = await import('./staff/model.js');
      const nh = m.sessionClock(d.S.bills.filter(d.isMine)).noHearing, b = nh[0];
      (d.S.todos[b.id] ??= []).push({ id: 'test-clock', bill_id: b.id, title: 'Call the committee clerk', due_date: '2026-03-16', assignee_id: d.S.me.id, done: false });
      d.hooks.render(); return m.billNum(b); })()""")
    p.wait_for_timeout(500); press(p); s = p.evaluate(STATE)
    ok(f'{first} is on today’s list above.' in s['note'] and s['bills'] == s['count'] - 1, f'a counted bill with a card today is named, not dropped ("{s["note"]}")')
    # Not now on the other one: it is named as having nothing to suggest right now
    p.locator('.td-sugg [data-sgdo="later"]').first.click(); p.wait_for_timeout(700); s = p.evaluate(STATE)
    ok('Nothing to suggest on' in s['note'] and 'right now' in s['note'] and s['bills'] == 0, f'a bill put off is named too ("{s["note"]}")')
    c.close()
    # more than five: copies of a no-hearing bill, in the team's list
    c, p = ctx(b, 1440, 900); load(p, setup="localStorage.setItem('hiphi2_today_scope_demo', 'team')")
    p.evaluate("""(async () => { const d = await import('./staff/data.js'), m = await import('./staff/model.js');
      const b = m.sessionClock(d.S.bills).noHearing[0];
      for (let i = 0; i < 4; i++) d.S.bills.push({ ...b, id: 990000 + i, bill_number: 'HB' + (9901 + i) });
      d.hooks.render(); })()""")
    p.wait_for_timeout(500); press(p); s = p.evaluate(STATE)
    ok(s['count'] > 5 and s['bills'] == 5 and f'Showing 5 of {s["count"]}.' in s['note'], f'more than five: five shown, and the note says so ({s["count"]} counted, "{s["note"]}")')
    c.close()
    b.close()

print('\n'.join(fails)); print(f'{len(fails)} failed, {len(results)} passed'); print('errors:', errors[:12])
sys.exit(1 if fails else 0)
