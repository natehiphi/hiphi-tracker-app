# Staff v2 Today, the Week view (R-025, 9/21). python3 tests/staff_week.py
# Nate: "many bills blend together; it is not clear what is a hearing and what is a testimony due date". Each testimony
# deadline used to show twice, on two days, drawn like the hearing it belongs to. These checks hold the rebuild to what
# was decided: three kinds of thing, each titled in words; each deadline once, on the day it falls; everything with a
# time in time order (Nate's answer 1); who is going only when someone is (answer 2); messages folded into one row
# (answer 3); counts that count what they say, the same in the side panel; and every deadline in the week shown.
# R-022 and Nate's R-025 answers (9/21): hearings on Monitor bills fold away behind "+N on bills you monitor" and the
# counts follow; the owner chips are gone and the one person picker (Everyone, a teammate, No owner) narrows the week;
# the page's heading says it is the week; the public ask is due at 4:00 PM two days before its hearing; a sitting
# opens its hearing page; and a held line keeps its committee and count on a line of their own.
import os, sys, re
from playwright.sync_api import sync_playwright
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import checks
BASE = os.environ.get('STAFF_BASE', 'http://localhost:8832/staff.html?demo=1')
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out', 'week'); os.makedirs(OUT, exist_ok=True)
ALLOWED = {13, 14, 16, 18, 22}
results, fails, errors = [], [], []
def ok(c, m): (results if c else fails).append(('PASS ' if c else 'FAIL ') + m)

# Everything the checks need, read from the page. Hawaiʻi has no daylight saving, so a moment's Hawaiʻi date is UTC-10.
WEEK = r"""(() => {
  const hst = t => new Date(+t - 36e6).toISOString().slice(0, 10), txt = e => (e?.innerText || '').replace(/\s+/g, ' ').trim();
  const cols = [...document.querySelectorAll('.td-weekgrid > .td-day')].map(d => {
    const kids = [...d.querySelectorAll('.wk-col > *')];
    return { day: d.dataset.day || 'weekend', h: txt(d.querySelector('h3')), w: Math.round(d.getBoundingClientRect().width),
      kinds: kids.map(k => k.classList.contains('wk-dl') ? 'dl' : k.classList.contains('wk-hr') ? 'hr' : k.classList.contains('wk-also') ? 'also' : k.classList.contains('wk-timed') ? 'step' : k.classList.contains('td-dnone') ? 'none' : 'other:' + k.className),
      at: kids.filter(k => k.dataset.at).map(k => ({ at: +k.dataset.at, kind: k.classList.contains('wk-dl') ? 'dl' : k.classList.contains('wk-hr') ? 'hr' : 'step', late: k.classList.contains('late'), title: txt(k.querySelector('.wk-bh')) || txt(k) })),
      dl: [...d.querySelectorAll('.wk-dl')].map(c => ({ title: txt(c.querySelector('.wk-bh')), sub: txt(c.querySelector('.wk-bs')), bills: [...c.querySelectorAll('.wk-bill .td-num')].map(txt), chips: [...c.querySelectorAll('.wk-bill .sv-chip')].map(txt) })),
      hr: [...d.querySelectorAll('.wk-hr')].map(c => ({ title: txt(c.querySelector('.wk-bh b, .wk-heldt b')), held: c.classList.contains('wk-held'), fold: c.tagName === 'DETAILS', mon: c.classList.contains('wk-monh'), open: c.open, top: Math.round(c.getBoundingClientRect().top), sub: txt(c.querySelector('.wk-bs, .wk-heldsub')), going: txt(c.querySelector('.wk-going')), bills: [...c.querySelectorAll('.wk-bill .td-num')].map(txt), monBills: c.querySelectorAll('.wk-bill.wk-mon').length, countdowns: c.querySelectorAll('.sv-count').length, page: c.querySelector('a[href^="#/hearing/"]')?.getAttribute('href') || '', text: txt(c) })),
      steps: [...d.querySelectorAll('.wk-timed')].map(txt),
      overdueTop: Math.round(d.querySelector('.wk-dl.late')?.getBoundingClientRect().top ?? -1),
      also: txt(d.querySelector('.wk-also')), none: txt(d.querySelector('.td-dnone')),
      initials: d.querySelectorAll('.wk-bill .sv-av').length, rows: d.querySelectorAll('.wk-bill').length };
  });
  const grid = document.querySelector('.td-weekgrid')?.getBoundingClientRect();
  return { hst0: hst(Date.now()), sum: txt(document.querySelector('.td-wsum')), cols, gridW: grid ? Math.round(grid.width) : 0,
    h1: txt(document.querySelector('.td-h1')), title: document.title, chips: document.querySelectorAll('.td-wchip, .td-wwho').length,
    mon: txt(document.querySelector('.td-wnav [data-mon]')), monOn: document.querySelector('.td-wnav [data-mon]')?.getAttribute('aria-pressed') || '',
    monBills: document.querySelectorAll('.td-weekgrid .wk-bill.wk-mon').length,
    over: document.documentElement.scrollWidth > innerWidth + 1, old: document.querySelectorAll('.td-wi, .td-slot, .td-sldue, .td-dl2').length };
})()"""
PANEL = r"""(() => [...document.querySelectorAll('.td-wk tbody tr')].map(r => ({ day: r.querySelector('th').innerText.replace(/\s+/g, ' ').replace(' Today', '').trim(), n: [...r.querySelectorAll('td')].map(t => +t.innerText) })))()"""

def ctx(b, w, h, scope):
    c = b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=1)
    c.add_init_script(f"try {{ localStorage.setItem('hiphi2_today_scope_demo', '{scope}'); }} catch (e) {{}}")
    p = c.new_page()
    p.on('pageerror', lambda e: errors.append(f'{w} {scope}: {e}'))
    p.on('console', lambda m: errors.append(f'console {w} {scope}: {m.text[:160]}') if m.type == 'error' and 'favicon' not in m.text else None)
    return c, p
def week(p, w=0):
    p.goto(BASE + '#/?view=week' + (f'&w={w}' if w else '')); p.reload(); p.wait_for_timeout(3000)
    return p.evaluate(WEEK)
def hst(t): import datetime; return datetime.datetime.utcfromtimestamp((t - 36e6) / 1000).strftime('%Y-%m-%d')
def plural(n, w): return f'{n} {w}{"s" if n != 1 else ""}'
def line_for(s):
    nsit = sum(len(x['hr']) for x in s['cols']); nbills = sum(len(h['bills']) for x in s['cols'] for h in x['hr'])
    ndue = sum(len(c_['bills']) for x in s['cols'] for c_ in x['dl'])
    return (f'{plural(nsit, "hearing")} ({plural(nbills, "bill")})' if nsit else 'No hearings') + (f' · testimony due for {plural(ndue, "bill")}' if ndue else '')

with sync_playwright() as pw:
    b = pw.chromium.launch()
    for W, H in ((1100, 800), (1280, 800), (1440, 900), (1536, 864), (1920, 1080)):
        for scope in ('mine', 'team'):
            tag = f'{W} {scope}'
            c, p = ctx(b, W, H, scope); s = week(p)
            p.screenshot(path=f'{OUT}/{W}_{scope}.png', full_page=True)
            ok(not s['over'], f'{tag}: no sideways scroll')
            sizes = {round(x) for x in checks.page_report(p, tag)['font_sizes']}
            ok(sizes <= ALLOWED, f'{tag}: type sizes {sorted(sizes)}')
            ok(s['old'] == 0, f'{tag}: nothing left of the old drawing ({s["old"]} old items)')
            days = [x for x in s['cols'] if x['day'] != 'weekend']
            ok(len(days) == 5, f'{tag}: five weekday columns ({len(days)})')
            for col in s['cols']:
                d = col['day']
                ok(all(not k.startswith('other') for k in col['kinds']), f'{tag} {col["h"]}: only the three kinds of thing ({set(col["kinds"])})')
                # Nate's answer 1: everything with a time in time order (at the same minute a deadline comes first)
                seq = [(x['at'], {'dl': 0, 'step': 1, 'hr': 2}[x['kind']]) for x in col['at']]
                ok(seq == sorted(seq), f'{tag} {col["h"]}: in time order ({[x["title"][:22] for x in col["at"]]})')
                ok('also' not in col['kinds'] or col['kinds'][-1] == 'also', f'{tag} {col["h"]}: steps with no time come last')
                for x in col['at']:
                    if d == 'weekend': continue
                    if x['kind'] == 'dl' and x['late']: ok(d == s['hst0'], f'{tag}: an overdue deadline sits on today ({x["title"]})'); continue
                    ok(hst(x['at']) == d, f'{tag} {col["h"]}: "{x["title"][:30]}" is on its own day ({hst(x["at"])})')
                for c_ in col['dl']:
                    ok('Testimony due' in c_['title'] or 'Testimony overdue' in c_['title'], f'{tag}: a deadline says so in words ("{c_["title"]}")')
                    ok(c_['sub'].startswith('for ') and c_['sub'].endswith(' hearing') or ' · for ' in c_['sub'], f'{tag}: a deadline names its hearing ("{c_["sub"]}")')
                    ok(len(c_['bills']) == len(set(c_['bills'])) >= 1, f'{tag}: each bill once in a deadline card ({c_["bills"]})')
                    ok(not any('left' in t or ' in ' in t for t in [c_['title']]) and 'h left' not in c_['sub'], f'{tag}: a clock time, not a countdown ("{c_["title"]}")')
                for h in col['hr']:
                    ok(h['title'].endswith('Hearing held' if h['held'] else 'Hearing'), f'{tag}: a hearing says so in words ("{h["title"]}")')
                    ok(h['page'].startswith('#/hearing/'), f'{tag}: a hearing opens its own page ({h["title"]}: "{h["page"]}")')
                    ok(not h['fold'] or ('·' not in h['title'].split('Hearing')[-1] and h['sub']), f'{tag}: a folded line keeps its committee and count on a line of their own ("{h["title"]}" / "{h["sub"]}")')
                    ok(h['countdowns'] == 0 and 'Testimony' not in h['text'], f'{tag}: a hearing does not repeat its testimony deadline ({h["title"]})')
                    ok(len(h['bills']) == len(set(h['bills'])) >= 1, f'{tag}: each bill once in a hearing ({h["bills"]})')
                    ok(h['going'] == '' or h['going'].endswith('going'), f'{tag}: who is going, only when someone is ("{h["going"]}")')
                ok('asked:' not in col['also'] and ' wrote:' not in col['also'], f'{tag} {col["h"]}: messages fold into one row')
                if scope == 'mine': ok(col['initials'] == 0, f'{tag} {col["h"]}: no initials on Mine ({col["initials"]})')
                elif col['rows']: ok(col['initials'] == col['rows'], f'{tag} {col["h"]}: initials on every bill on Everyone ({col["initials"]} of {col["rows"]})')
            # counts that count what they say
            ok(s['sum'] == line_for(s), f'{tag}: the week line counts what it shows ("{s["sum"]}" / "{line_for(s)}")')
            # Monitor bills folded away by default (decision 4), with the button that shows them; no owner chips; the h1
            ok(s['monBills'] == 0 and re.fullmatch(r'\+\d+ on bills (you|the team) monitors?', s['mon'] or '') and s['monOn'] == 'false', f'{tag}: monitored bills folded away, "{s["mon"]}"')
            ok(s['chips'] == 0, f'{tag}: no owner chips (R-025 answer 2)')
            ok(s['h1'] == ('This week' if scope == 'mine' else 'Team: this week') and s['title'].startswith(s['h1']), f'{tag}: the heading says it is the week ("{s["h1"]}")')
            # the Sunday deadline for next Monday's hearing, which no step existed for yet (R-025). Sandbox data: if the
            # snapshot is rebuilt and HB1839 gains a draft or loses that hearing, pick another no-draft position bill.
            we = next((x for x in s['cols'] if x['day'] == 'weekend'), None)
            sun = we and next((c_ for c_ in we['dl'] if 'Sun 3:00 PM' in c_['title']), None)
            ok(bool(sun) and 'HB1839' in sun['bills'] and 'No draft yet' in sun['chips'], f'{tag}: the Sunday 22 deadline for Monday\'s PSM/EIG hearing shows ({sun})')
            # the weekend: a strip under the week below 1600px, a sixth column from 1600
            if we: ok((we['w'] > 0.9 * s['gridW']) == (W < 1600), f'{tag}: the weekend is {"a sixth column" if W >= 1600 else "a strip under the week"} ({we["w"]} of {s["gridW"]}px)')
            if W == 1440 and days: ok(min(x['w'] for x in days) >= 200, f'{tag}: weekdays get the width ({min(x["w"] for x in days)}px)')
            # the side panel's "This week" agrees with the Week view, day by day
            if W >= 1100:
                p.goto(BASE + '#/'); p.reload(); p.wait_for_timeout(2500)
                panel = p.evaluate(PANEL)
                for row in panel:
                    col = next((x for x in days if x['h'] == row['day']), None) if row['day'] != 'Weekend' else we
                    if not col: ok(False, f'{tag}: panel row {row["day"]} has a column'); continue
                    ok(row['n'] == [len(col['hr']), sum(len(c_['bills']) for c_ in col['dl'])], f'{tag}: the side panel agrees on {row["day"]} ({row["n"]} / {[len(col["hr"]), sum(len(c_["bills"]) for c_ in col["dl"])]})')
            c.close()
    # "+N on bills you monitor": pressed, the week and the side panel both count the monitored hearings, a sitting of
    # only monitored bills is one closed line, and the choice holds on the way back from the list (it is in prefs)
    c, p = ctx(b, 1440, 900, 'mine'); s0 = week(p)
    n = int(re.search(r'\d+', s0['mon']).group(0))
    p.locator('.td-wnav [data-mon]').click(); p.wait_for_timeout(900); s = p.evaluate(WEEK)
    ok(s['monOn'] == 'true' and s['mon'] == f'Hide the {n} on bills you monitor' and s['monBills'] == n, f'monitor: pressed, all {n} are shown ({s["monBills"]}, "{s["mon"]}")')
    ok(s['sum'] == line_for(s) and s['sum'] != s0['sum'], f'monitor: the week line counts them ("{s0["sum"]}" -> "{s["sum"]}")')
    folds = [h for x in s['cols'] for h in x['hr'] if h['mon']]
    ok(len(folds) >= 1 and all(h['fold'] and not h['open'] and 'monitored bill' in h['sub'] for h in folds), f'monitor: a sitting of monitored bills only is one closed line ({[h["title"] + " / " + h["sub"] for h in folds][:3]})')
    p.screenshot(path=f'{OUT}/1440_mine_monitor.png', full_page=True)
    p.locator('[data-seg="tdview"][data-val="list"]').click(); p.wait_for_timeout(1200)
    panel = p.evaluate(PANEL)
    for row in panel:
        col = next((x for x in s['cols'] if x['h'] == row['day']), None) if row['day'] != 'Weekend' else next((x for x in s['cols'] if x['day'] == 'weekend'), None)
        if col: ok(row['n'] == [len(col['hr']), sum(len(c_['bills']) for c_ in col['dl'])], f'monitor: the side panel agrees on {row["day"]} ({row["n"]})')
    p.locator('[data-seg="tdview"][data-val="week"]').click(); p.wait_for_timeout(1200); s2 = p.evaluate(WEEK)
    ok(s2['monOn'] == 'true' and s2['monBills'] == n, f'monitor: the choice holds after going to the list and back ({s2["monBills"]})')
    p.locator('.td-wnav [data-mon]').click(); p.wait_for_timeout(900); s3 = p.evaluate(WEEK)
    ok(s3['monOn'] == 'false' and s3['monBills'] == 0 and s3['sum'] == s0['sum'], f'monitor: pressed again, folded away again ("{s3["sum"]}")')
    c.close()
    # the public ask (R-025 answer 4): due 4:00 PM two days before its hearing, so Kevin's HB2121 (heard Fri 9:30 AM) is
    # a timed step at 4:00 PM on Wednesday, on Everyone's week
    c, p = ctx(b, 1440, 900, 'team'); s = week(p)
    wed = next(x for x in s['cols'] if x['h'].startswith('Wed'))
    ask = [t for t in wed['steps'] if 'HB2121' in t]
    ok(len(ask) == 1 and ask[0].startswith('4:00 PM') and 'public ask' in ask[0] and 'Fri' in ask[0], f'public ask: HB2121 at 4:00 PM Wednesday ({ask})')
    # No owner (R-025 answer 1): the one picker narrows the week to the bills nobody owns
    p.locator('[data-whopick]').click(); p.wait_for_timeout(500)
    p.locator('dialog[open] [role="radio"]').filter(has_text='No owner').first.click(); p.wait_for_timeout(1200); s = p.evaluate(WEEK)
    owned = p.evaluate("(async () => { const d = await import('./staff/data.js'); return [...document.querySelectorAll('.td-weekgrid .wk-bill .td-num')].map(e => e.innerText.trim().split(' ')[0]).filter(n => (d.S.assignments[d.S.bills.find(b => b.bill_number === n)?.id] || []).length); })()")
    nb = sum(len(h['bills']) for x in s['cols'] for h in x['hr']) + sum(len(c_['bills']) for x in s['cols'] for c_ in x['dl'])
    ok(s['h1'] == 'No owner: this week' and nb >= 1 and not owned and s['sum'] == line_for(s), f'No owner: only bills nobody owns ("{s["h1"]}", {nb} bills, owned {owned}, "{s["sum"]}")')
    p.screenshot(path=f'{OUT}/1440_none.png', full_page=True)
    c.close()
    # next week (sparse), last week (empty)
    c, p = ctx(b, 1440, 900, 'team')
    s = week(p, 1); ok(s['sum'] == line_for(s) and not s['over'], f'next week: the line counts what it shows ("{s["sum"]}")')
    s = week(p, -1); ok(s['sum'] == line_for(s) and all(x['none'] == 'Nothing was scheduled.' for x in s['cols'] if not x['kinds'] or x['kinds'] == ['none']), f'last week: "{s["sum"]}", and an empty day says nothing was scheduled')
    # answer 2: press "I'm going" on a bill heard Wednesday; its hearing says so, and one nobody is going to says nothing
    p.goto(BASE + '#/bill/HB1780'); p.reload(); p.wait_for_timeout(3000)
    p.locator('[data-attend]').first.click(); p.wait_for_timeout(600)
    p.evaluate("location.hash = '#/?view=week'"); p.wait_for_timeout(1500)
    s = p.evaluate(WEEK); wed = next(x for x in s['cols'] if x['h'].startswith('Wed'))
    edu = next((h for h in wed['hr'] if 'EDU' in h['sub']), None); hhs = next((h for h in wed['hr'] if 'HHS' in h['sub']), None)
    ok(edu and edu['going'] == 'You are going', f'going: the EDU hearing says "{edu and edu["going"]}"')
    ok(hhs and hhs['going'] == '', f'going: the HHS hearing, which nobody marked, says nothing ("{hhs and hhs["going"]}")')
    p.wait_for_timeout(10500); p.screenshot(path=f'{OUT}/1440_team_going.png')
    c.close()
    # The afternoon (review, 9/21): at Wed 4:30 PM the morning's hearings are over. They keep their place in time order as
    # one closed line each, so the overdue testimony for Thursday's hearings is on the first screen, not under them.
    c, p = ctx(b, 1440, 900, 'team'); p.clock.install()
    p.goto(BASE + '#/?view=week'); p.reload(); p.wait_for_timeout(3000)
    p.clock.fast_forward('55:30:00'); p.evaluate("location.hash = '#/'"); p.wait_for_timeout(800); p.evaluate("location.hash = '#/?view=week'"); p.wait_for_timeout(1500)
    s = p.evaluate(WEEK); today_ = next((x for x in s['cols'] if x['day'] == s['hst0']), None)
    ok(s['hst0'] == '2026-03-18' and today_ is not None, f'afternoon: the sandbox clock reads Wed 18 ({s["hst0"]})')
    if today_:
        held = [h for h in today_['hr'] if h['held']]
        ok(len(held) >= 2 and all(not h['open'] and len(h['bills']) >= 1 for h in held), f'afternoon: the 1:00 PM hearings are held, one closed line each ({[h["title"] for h in held]})')
        ok(all(h['title'].endswith('Hearing held') and re.fullmatch(r'[A-Z/]+ · \d+ bills?', h['sub']) for h in held), f'afternoon: a held line is its title, then the committee and count on a line of their own ({[h["title"] + " / " + h["sub"] for h in held]})')
        seq = [(x['at'], {'dl': 0, 'step': 1, 'hr': 2}[x['kind']]) for x in today_['at']]
        ok(seq == sorted(seq), f'afternoon: still in time order ({[x["title"][:24] for x in today_["at"]]})')
        ok(0 < today_['overdueTop'] < 900, f'afternoon: the overdue testimony is on the first screen (top {today_["overdueTop"]}px)')
        mon = next(x for x in s['cols'] if x['day'] == '2026-03-16')
        ok(all(h['held'] for h in mon['hr']), f'afternoon: Monday, over, is all held lines ({len(mon["hr"])})')
        p.screenshot(path=f'{OUT}/1440_team_wed1630.png')
        p.locator('.wk-held > summary').first.click(); p.wait_for_timeout(400)
        ok(p.evaluate("document.querySelector('.wk-held').open && document.querySelector('.wk-held .wk-bill').offsetParent !== null"), 'afternoon: a held hearing opens to its bills')
    c.close()
    b.close()

for r in fails: print(r)
if os.environ.get('SHOW'): [print(r) for r in results if re.search(os.environ['SHOW'], r)]   # SHOW='monitor|No owner' prints those passes too
print(f'\n{len(results)} passed, {len(fails)} failed, {len(errors)} page errors')
for e in errors[:10]: print('ERROR', e)
sys.exit(1 if fails or errors else 0)
