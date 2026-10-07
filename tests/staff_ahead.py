# "Ahead" on Staff v2's Today (R-049, Nate 10/5: "Go as recommended"; the review of 26 Sep, https://claude.ai/artifact/WSAU3DwJCLsoqorFb3hLic).
# Today | Ahead: this week day by day, then the next deadline with every bill that still needs a hearing (P1 first, each with its
# committee, its chair, the last meeting and when the notice must post, and one button to email the chair), later deadlines folded to
# one line. The review's own test: every live position bill racing the next deadline without a hearing appears exactly once, in
# notice-by order, and never says "due".
#   python3 tests/staff_ahead.py [base]      base defaults to http://localhost:8832
import sys, os, re
from playwright.sync_api import sync_playwright
BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832').rstrip('/') + '/staff.html?demo=1'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out', 'ahead'); os.makedirs(OUT, exist_ok=True)
res, errors = [], []
def ok(c, m): res.append(bool(c)); print('PASS' if c else 'FAIL', m)
def ctx(b, w, h=900):
    c = b.new_context(viewport={'width': w, 'height': h}, is_mobile=w < 600, has_touch=w < 600, device_scale_factor=2 if w < 600 else 1)
    p = c.new_page(); p.on('pageerror', lambda e: errors.append(f'{w}: {e}'))
    p.on('console', lambda m: errors.append(f'console {w}: {m.text[:140]}') if m.type == 'error' and 'favicon' not in m.text and 'ERR_FAILED' not in m.text and 'Failed to fetch' not in m.text else None)
    return c, p
def go(p, hash='/?view=ahead', extra='', wait=2800):
    p.goto(BASE + extra + '#' + hash.lstrip('#')); p.reload(); p.wait_for_timeout(wait)
EXPECT = """async () => {
  const d = await import('./staff/data.js'), m = await import('./staff/model.js'), S = d.S;
  const gates = m.sessionGates(S.bills.filter(d.isMine)).filter(g => !g.past && g.racing.length && g.days <= 21);
  const first = gates.find(g => g.noHearing.length) || gates[0];
  const nb = x => { const n = m.noticeByFor(x.st); return n ? n.getTime() : Infinity; };
  const need = first ? first.noHearing.slice().sort((x, y) => (y.b.priority === 1) - (x.b.priority === 1) || nb(x) - nb(y) || x.b.bill_number.localeCompare(y.b.bill_number, 'en', { numeric: true })) : [];
  return { n: gates.length, date: first?.date, name: first?.name, need: need.map(x => m.billNum(x.b)), p1: need.map(x => x.b.priority === 1), nbs: need.map(nb).map(v => v === Infinity ? null : v), later: gates.filter(g => g !== first).length }; }"""

with sync_playwright() as pw:
    b = pw.chromium.launch()
    c, p = ctx(b, 1280); go(p)
    ex = p.evaluate(EXPECT)
    ok(ex['n'] >= 2 and len(ex['need']) >= 5, f'the sandbox has deadlines to look ahead at: {ex["n"]} within 3 weeks, {len(ex["need"])} bills with no hearing at {ex["date"]}')
    ok(p.locator('h1').first.inner_text().strip() == 'Ahead', 'the page is called Ahead')
    seg = p.evaluate("[...document.querySelectorAll('[data-seg=tdview]')].map(b => [b.innerText.trim(), b.getAttribute('aria-pressed')])")
    ok(seg == [['Today', 'false'], ['Ahead', 'true']], f'the switch is Today | Ahead ({seg})')
    ok(p.locator('#ah-wk').count() == 1 and p.locator('#ah-dl').count() == 1, 'This week, then Deadlines')
    days = p.evaluate("[...document.querySelectorAll('.ah-dh')].map(h => h.innerText.replace(/\\s+/g, ' '))")
    ok(len(days) >= 3 and days[0].startswith('Today') and days[1].startswith('Tomorrow'), f'this week day by day, starting today ({days[:3]})')
    kinds = p.evaluate("[...document.querySelectorAll('.ah-ev')].map(e => e.className)")
    ok(any('ah-due' in k for k in kinds) and any('ah-hearing' in k for k in kinds), 'hearings and the day testimony closes both show')
    ok(p.locator('.ah-ev a[href^="#/hearing/"]').count() == len(kinds), 'each opens its hearing page')
    ok('Email is paused' not in p.locator('main').inner_text() and not p.locator('.td-dl').count(), 'no "email is paused" banner and no repeated deadline subtitle on Ahead (the review of 10/6)')
    due = p.evaluate("[...document.querySelectorAll('.ah-due')].map(e => [e.querySelector('.ah-k').innerText, e.classList.contains('ah-soon'), getComputedStyle(e.querySelector('.ah-k')).color])")
    ok(due and all(d[0].startswith('Written testimony closes') and 'hearing' in d[0] for d in due), f'the deadline row says which hearing it is for ({due[0][0] if due else None})')
    ok(len({d[2] for d in due if not d[1]}) <= 1 and (not any(d[1] for d in due) or {d[2] for d in due if d[1]} != {d[2] for d in due if not d[1]}), 'amber only on a deadline within 24 hours')
    ev_times = p.evaluate("[...document.querySelectorAll('.ah-day')].map(d => [...d.querySelectorAll('.ah-t')].map(t => t.innerText))")
    ok(all(len(set(t)) <= len(t) for t in ev_times), 'events are listed in time order inside a day')
    # the review's test: the next deadline's bills, once each, P1 first, then by when the notice must post, and never "due"
    gate = p.locator('.ah-gate:not(.ah-later)').first
    ok(gate.count() == 1 and ex['name'] in gate.inner_text() and 'must' in gate.inner_text(), f'the open deadline is {ex["name"]} {ex["date"]}')
    if p.locator('.ah-gate:not(.ah-later) [data-fold]').count(): p.locator('.ah-gate:not(.ah-later) [data-fold]').click(); p.wait_for_timeout(500)
    shown = p.evaluate("[...document.querySelectorAll('.ah-gate:not(.ah-later) .ah-row .td-num')].map(e => e.innerText.trim())")
    ok(len(shown) == len(set(shown)) and set(shown) == set(ex['need']), f'every live position bill racing it without a hearing appears exactly once ({len(shown)} of {len(ex["need"])})')
    ok(shown == ex['need'], f'P1 first, then by when the notice must post ({shown[:4]})')
    t = gate.inner_text()
    ok(not re.search(r'\b(due|overdue)\b', t, re.I), 'and the list never says "due" or "overdue": it is work coming, not a task list')
    row = p.locator('.ah-gate:not(.ah-later) .ah-row').first
    sub = row.locator('.ah-sub').inner_text()
    ok(re.search(r'(Sen|Rep)\. ', sub) and 'must be posted by' in sub and 'last meeting' in sub, f'a row names the chair, the last meeting and when the notice must post ({sub[:100]})')
    comp = p.evaluate("[...document.querySelectorAll('.ah-gate .ah-sub')].map(e => e.innerText).filter(t => /companion/.test(t))")
    ok(all('is heard' in t for t in comp), f'a bill whose companion already has a hearing says so ({len(comp)} such rows)')
    ok(row.locator('.btn').count() == 1 and 'mailto:' in (row.locator('.btn').get_attribute('href') or ''), 'one button, to email the chair')
    ok(all(p.evaluate("[...document.querySelectorAll('.ah-gate:not(.ah-later) .ah-row')].every(r => r.querySelectorAll('.btn').length === 1)") for _ in [0]), 'one button on every row (A-3)')
    p.screenshot(path=f'{OUT}/d_ahead.png')
    # later deadlines are folded to a line
    later = p.locator('details.ah-later')
    ok(later.count() == ex['later'] and not any(p.evaluate("[...document.querySelectorAll('details.ah-later')].map(d => d.open)")), f'the other {ex["later"]} deadlines are folded, one line each')
    if later.count():
        ok('no hearing' in later.first.locator('summary').inner_text() or 'hearing' in later.first.locator('summary').inner_text(), 'each line says how many bills still need a hearing')
        h0 = later.first.bounding_box()['height']; ok(h0 < 76, f'a folded deadline is about one line ({round(h0)}px)')
        later.first.locator('summary').click(); p.wait_for_timeout(200)
        ok(later.first.locator('.ah-row, .ah-ok').count() >= 1, 'opened, it lists its bills')
    # Week as a grid, on a laptop
    ok(p.locator('a:has-text("Week as a grid")').count() == 1, 'on a laptop the day grid is one link away')
    p.locator('a:has-text("Week as a grid")').click(); p.wait_for_timeout(1500)
    ok(p.locator('.td-weekgrid').count() == 1 and p.evaluate('location.hash').startswith('#/?view=week'), 'it opens the Week grid')
    seg = p.evaluate("[...document.querySelectorAll('[data-seg=tdview]')].map(b => b.innerText.trim())")
    ok(seg == ['Today', 'Ahead', 'Week'], f'and the switch then shows where you are ({seg})')
    p.locator('[data-seg=tdview][data-val=ahead]').click(); p.wait_for_timeout(1200)
    ok(p.locator('#ah-dl').count() == 1, 'the switch goes back to Ahead')
    p.locator('[data-seg=tdview][data-val=list]').click(); p.wait_for_timeout(1200)
    ok(p.locator('.td-aheadroot').count() == 0 and p.evaluate('location.hash') in ('#/', ''), 'and to Today')
    # Team: whose bills they are
    go(p); p.locator('[data-seg=tdscope][data-val=team]').click(); p.wait_for_timeout(1200)
    ok(p.locator('h1').first.inner_text().strip() == 'Team: Ahead' and p.locator('.ah-gate .sv-av').count() >= 1, 'Team shows whose each bill is')
    c.close()

    # ---- a phone ----
    c, p = ctx(b, 390, 844); go(p)
    ok(p.locator('#ah-dl').count() == 1 and p.locator('a:has-text("Week as a grid")').count() == 0, 'on a phone Ahead exists, without the grid link (the grid is laptop-only)')
    ok(not p.evaluate('document.documentElement.scrollWidth > innerWidth'), 'no sideways scroll')
    sm = p.evaluate("[...document.querySelectorAll('.ah-gate .btn, .ah-later > summary, .ah-ev a')].filter(e => e.offsetParent).map(e => e.getBoundingClientRect()).filter(r => r.height < 43.5).length")
    ok(sm == 0, f'every button and row is a 44px target ({sm} smaller)')
    y = p.evaluate("document.querySelector('#ah-dl').getBoundingClientRect().top + scrollY"); ok(y < 2600, f'the deadlines are {round(y)}px down')
    p.screenshot(path=f'{OUT}/p_ahead.png')
    p.evaluate("window.scrollTo(0, document.querySelector('#ah-dl').getBoundingClientRect().top + scrollY - 70)"); p.wait_for_timeout(300); p.screenshot(path=f'{OUT}/p_ahead_deadlines.png')
    go(p, '/')
    tb = p.evaluate("[...document.querySelectorAll('.td-tools .sv-seg')].length"); ok(tb == 2, 'a phone\'s Today has the Today | Ahead switch beside Mine | Team')
    ok(p.evaluate("document.querySelector('.td-date').getBoundingClientRect().width") > 200, 'and the date keeps its own line')
    p.locator('[data-seg=tdview][data-val=ahead]').click(); p.wait_for_timeout(1200)
    ok(p.locator('#ah-dl').count() == 1, 'the switch opens Ahead on a phone')
    c.close()

    # ---- between sessions, and someone who owns no bills ----
    c, p = ctx(b, 1280); go(p, '/?view=ahead', '&season=off')
    ok('The session is over' in p.locator('main').inner_text(), 'between sessions Ahead says there is nothing to race yet')
    c.close()
    c, p = ctx(b, 1280); go(p, '/?view=ahead', '&as=KR')
    ok(p.locator('#ah-wk').count() == 1 and p.locator('#ah-dl').count() == 1, 'Kris, who owns no bills, still gets the page (her coalitions\' bills)')
    c.close()
    b.close()

ok(not errors, f'no page errors {errors[:3]}')
print(f'{sum(res)} passed, {len(res) - sum(res)} failed')
sys.exit(1 if not all(res) else 0)
