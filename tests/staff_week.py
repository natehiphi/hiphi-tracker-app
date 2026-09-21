# Staff v2 Today, the Week view (R-025, 9/21). python3 tests/staff_week.py
# Nate: "many bills blend together; it is not clear what is a hearing and what is a testimony due date". Each testimony
# deadline used to show twice, on two days, drawn like the hearing it belongs to. These checks hold the rebuild to what
# was decided: three kinds of thing, each titled in words; each deadline once, on the day it falls; everything with a
# time in time order (Nate's answer 1); who is going only when someone is (answer 2); messages folded into one row
# (answer 3); counts that count what they say, the same in the side panel; and every deadline in the week shown.
import os, sys
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
      hr: [...d.querySelectorAll('.wk-hr')].map(c => ({ title: txt(c.querySelector('.wk-bh b, .wk-heldt b')), held: c.tagName === 'DETAILS', open: c.open, top: Math.round(c.getBoundingClientRect().top), sub: txt(c.querySelector('.wk-bs')), going: txt(c.querySelector('.wk-going')), bills: [...c.querySelectorAll('.wk-bill .td-num')].map(txt), countdowns: c.querySelectorAll('.sv-count').length, text: txt(c) })),
      overdueTop: Math.round(d.querySelector('.wk-dl.late')?.getBoundingClientRect().top ?? -1),
      also: txt(d.querySelector('.wk-also')), none: txt(d.querySelector('.td-dnone')),
      initials: d.querySelectorAll('.wk-bill .sv-av').length, rows: d.querySelectorAll('.wk-bill').length };
  });
  const grid = document.querySelector('.td-weekgrid')?.getBoundingClientRect();
  return { hst0: hst(Date.now()), sum: txt(document.querySelector('.td-wsum')), cols, gridW: grid ? Math.round(grid.width) : 0,
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
                    ok(h['countdowns'] == 0 and 'Testimony' not in h['text'], f'{tag}: a hearing does not repeat its testimony deadline ({h["title"]})')
                    ok(len(h['bills']) == len(set(h['bills'])) >= 1, f'{tag}: each bill once in a hearing ({h["bills"]})')
                    ok(h['going'] == '' or h['going'].endswith('going'), f'{tag}: who is going, only when someone is ("{h["going"]}")')
                ok('asked:' not in col['also'] and ' wrote:' not in col['also'], f'{tag} {col["h"]}: messages fold into one row')
                if scope == 'mine': ok(col['initials'] == 0, f'{tag} {col["h"]}: no initials on Mine ({col["initials"]})')
                elif col['rows']: ok(col['initials'] == col['rows'], f'{tag} {col["h"]}: initials on every bill on Everyone ({col["initials"]} of {col["rows"]})')
            # counts that count what they say
            ok(s['sum'] == line_for(s), f'{tag}: the week line counts what it shows ("{s["sum"]}" / "{line_for(s)}")')
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
print(f'\n{len(results)} passed, {len(fails)} failed, {len(errors)} page errors')
for e in errors[:10]: print('ERROR', e)
sys.exit(1 if fails or errors else 0)
