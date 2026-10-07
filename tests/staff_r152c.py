# R-152 batch C, "the jobs, smoothed" (the staff review of 10/4), in the sandbox: one countdown rounded one way, the testimony
# deadline on a bill page before a draft exists, the right names for who gets a draft, the phone's Public tab leading with the
# public's response and the share kit, the ask's date checked against the hearing, "This week's asks" folded to one line and
# reachable on a phone, the next hearing first on a hearing day, bill names that are not cut in the Week.
#   python3 tests/staff_r152c.py [base]      base defaults to http://localhost:8832
import sys, os
from playwright.sync_api import sync_playwright
BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832').rstrip('/') + '/staff.html?demo=1'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out', 'r152c'); os.makedirs(OUT, exist_ok=True)
res, errors = [], []
def ok(c, m): res.append(bool(c)); print('PASS' if c else 'FAIL', m)
def ctx(b, w, h=844, extra=''):
    c = b.new_context(viewport={'width': w, 'height': h}, is_mobile=w < 600, has_touch=w < 600, device_scale_factor=2 if w < 600 else 1)
    p = c.new_page(); p.on('pageerror', lambda e: errors.append(f'{w}: {e}'))
    p.on('console', lambda m: errors.append(f'console {w}: {m.text[:140]}') if m.type == 'error' and 'favicon' not in m.text and 'ERR_FAILED' not in m.text else None)
    return c, p
def go(p, hash='/', extra='', wait=2600):
    p.goto(BASE + extra + '#' + hash.lstrip('#')); p.reload(); p.wait_for_timeout(wait)
def mod(p, name, js):
    return p.evaluate("async () => { const m = await import('./staff/%s.js'); %s }" % (name, js))

with sync_playwright() as pw:
    b = pw.chromium.launch()
    # ---- 1. one countdown, rounded down everywhere, one way to say days ----
    c, p = ctx(b, 1280, 900); go(p)
    r = p.evaluate("""async () => {
      const ui = await import('./staff/ui.js'), td = await import('./staff/today.js'), strip = h => h.replace(/<[^>]*>/g, '').trim();
      const at = ms => new Date(Date.now() + ms).toISOString(), H = 36e5, out = {};
      for (const [k, ms] of [['5h40', 5.67 * H], ['27h50', 27.83 * H], ['2d6h', 54 * H], ['3d', 72.2 * H], ['over5h40', -5.67 * H]]) {
        out[k] = { count: strip(ui.countdown(at(ms))), urg: strip(ui.urgentMark(at(ms))), left: strip(td.cd(Date.now() + ms)), due: strip(td.cd(Date.now() + ms, 'due')), first: strip(td.cd(Date.now() + ms, 'first')) };
      }
      return out; }""")
    ok(r['5h40']['count'] == '5h left' and r['5h40']['left'] == '5h left' and r['5h40']['due'] == 'Due in 5 hours' and r['5h40']['urg'].startswith('5h'),
       f'5h40m is 5 hours on every screen, never 6: {r["5h40"]}')
    ok(r['27h50']['count'] == '27h left' and r['27h50']['left'] == '27h left' and r['27h50']['urg'].startswith('27h'), f'27h50m is 27 hours everywhere, never 28: {r["27h50"]}')
    ok(r['2d6h']['count'] == '2 days left' and r['2d6h']['left'] == '2 days left' and r['2d6h']['urg'].startswith('2d'), f'2 days 6 hours is 2 days, never 3: {r["2d6h"]}')
    ok(r['2d6h']['urg'].endswith('left') and 'to go' not in r['3d']['urg'], f'time still to run says "left", never "to go": {r["3d"]["urg"]}')
    ok('5h' in r['over5h40']['urg'] and 'overdue' in r['over5h40']['urg'], f'overdue rounds down too: {r["over5h40"]["urg"]}')
    # bills: "N days left", not "N days away"
    go(p, '/bills'); t = p.locator('main').inner_text()
    ok('days away' not in t, 'the Bills page says "N days left", never "N days away"')
    c.close()

    # ---- 2. the testimony deadline on a bill page before a draft exists ----
    c, p = ctx(b, 1280, 900); go(p)
    pick = p.evaluate("""async () => { const m = await import('./staff/data.js'), S = m.S, now = Date.now();
      for (const h of S.hearings) { const t = new Date(h.scheduled_at).getTime(), bl = S.bills.find(x => x.id === h.bill_id);
        if (bl && bl.position && bl.position !== 'monitor' && h.status !== 'cancelled' && t > now + 36e5 && t < now + 10 * 864e5 && !(S.drafts[bl.id] || []).some(d => d.committee === h.committee)) return { num: bl.bill_number, c: h.committee }; }
      return null; }""")
    ok(bool(pick), f'a position bill with a hearing coming and no draft exists in the sandbox ({pick})')
    if pick:
        go(p, f'/bill/{pick["num"]}'); t = p.locator('.bw-next').first.inner_text()
        ok('Testimony due' in t and 'Hearing starts' in t, f'with no draft, the card gives the testimony deadline and when the hearing starts ({t.replace(chr(10), " | ")[:160]})')
        ok(t.index('Testimony due') < t.index('Hearing starts'), 'the deadline comes first')
    c.close()

    # ---- 3. who gets a draft: everyone who can approve, not only the admin ----
    c, p = ctx(b, 1280, 900); go(p, '/', '&as=KV')
    nm = mod(p, 'today', "return { kev: m.approvers(S_ME()), none: m.approvers(null) }".replace('S_ME()', "(await import('./staff/data.js')).S.me.id"))
    ok(nm['kev'] == 'Nate or Kris' or (' or ' in nm['kev'] and 'Kris' in nm['kev']), f'a draft from Kevin goes to everyone who approves: {nm}')
    ok('Kris' in nm['none'] and 'Nate' in nm['none'], 'including Kris, who is an approver but not an admin')
    c.close()

    # ---- 4. the Public tab on a phone leads with the public's response and the share kit ----
    c, p = ctx(b, 390); go(p)
    num = p.evaluate("async () => { const S = (await import('./staff/data.js')).S; return S.bills.find(b => b.is_public && b.position && b.position !== 'monitor').bill_number; }")
    go(p, f'/bill/{num}/public'); y = p.evaluate("({ r: document.querySelector('#bw-resp-h')?.getBoundingClientRect().top, f: document.querySelector('#bw-ispub')?.getBoundingClientRect().top, k: document.querySelector('[data-kit=link]')?.getBoundingClientRect().top })")
    ok(y['r'] is not None and y['f'] is not None and y['r'] < y['f'], f'on a phone the public\'s response comes before the form ({y})')
    ok(y['k'] is not None and y['k'] < 900, f'and the share kit is on the first screens ({round(y["k"] or 0)}px)')
    p.screenshot(path=f'{OUT}/p_public.png')
    ok(not p.evaluate('document.documentElement.scrollWidth > innerWidth'), 'no sideways scroll')
    c.close()
    c, p = ctx(b, 1280, 900); go(p, f'/bill/{num}/public'); y = p.evaluate("({ r: document.querySelector('#bw-resp-h')?.getBoundingClientRect().top, f: document.querySelector('#bw-ispub')?.getBoundingClientRect().top })")
    ok(y['r'] > y['f'], f'on a laptop the order is unchanged: the form, then the response ({y})')
    c.close()

    # ---- 5. the ask's date against the hearing ----
    c, p = ctx(b, 1280, 900); go(p)
    hb = p.evaluate("""async () => { const S = (await import('./staff/data.js')).S, now = Date.now();
      for (const h of S.hearings) { const t = new Date(h.scheduled_at).getTime(), bl = S.bills.find(x => x.id === h.bill_id);
        if (bl && bl.is_public && bl.position && bl.position !== 'monitor' && h.status === 'scheduled' && t > now + 3 * 864e5 && t < now + 12 * 864e5)
          return { num: bl.bill_number, day: new Date(t).toLocaleDateString('en-CA', { timeZone: 'Pacific/Honolulu' }) }; } return null; }""")
    ok(bool(hb), f'a public bill with a hearing 3 to 12 days away exists ({hb})')
    if hb:
        go(p, f'/bill/{hb["num"]}/public')
        p.fill('#bw-pact', 'Please email the chair today.'); p.fill('#bw-puntil', '2026-03-17'); p.wait_for_timeout(200)
        w = p.inner_text('#bw-puntil-w')
        ok('stops showing' in w and 'hearing on' in w, f'an ask that ends before the hearing says so ({w[:120]})')
        p.fill('#bw-puntil', hb['day']); p.wait_for_timeout(200)
        ok(p.inner_text('#bw-puntil-w').strip() == '', 'a date on or after the hearing day: no warning')
        p.fill('#bw-puntil', '2026-03-17'); p.fill('#bw-pact', ''); p.wait_for_timeout(200)
        ok(p.inner_text('#bw-puntil-w').strip() == '', 'no ask, no warning')
        ok(p.locator('#bw-puntil').get_attribute('aria-describedby').split() == ['bw-puntil-h', 'bw-puntil-w'], 'the warning is read with the field')
    c.close()

    # ---- 6. This week's asks: one line, folded; the same card on a phone ----
    c, p = ctx(b, 1280, 900); go(p, '/?view=week')
    ok(p.locator('details.td-asks').count() == 1 and not p.evaluate("document.querySelector('details.td-asks').open"), "on the Week, \"This week's asks\" is folded")
    h = p.evaluate("document.querySelector('details.td-asks').getBoundingClientRect().height"); ok(h < 70, f'to one line ({round(h)}px)')
    d1 = p.evaluate("document.querySelector('.td-weekgrid .td-day').getBoundingClientRect().top"); ok(d1 < 480, f'so the first day starts higher (was 616px; now {round(d1)}px)')
    ok('bill' in p.inner_text('details.td-asks > summary'), 'the line says how many bills')
    p.locator('details.td-asks > summary').click(); p.wait_for_timeout(200)
    ok(p.locator('[data-wkasks]').first.is_visible(), 'open, the copy buttons are there')
    names = p.evaluate("[...document.querySelectorAll('.td-weekgrid .wk-name')].map(e => { const s = getComputedStyle(e); return [s.whiteSpace, s.webkitLineClamp] })")
    ok(names and all(n[0] == 'normal' and n[1] in ('2',) for n in names if n[1] != 'none') and all(n[0] == 'normal' for n in names), f'a bill\'s name may take two lines, never one cut line ({names[:2]})')
    p.screenshot(path=f'{OUT}/d_week.png')
    c.close()
    c, p = ctx(b, 390); go(p)
    ok(p.locator('details.td-asks').count() == 1, 'a phone\'s Today carries the same card (it had no Week view)')
    top = p.evaluate("document.querySelector('details.td-asks').getBoundingClientRect().top"); ok(top < 700, f'near the top, folded ({round(top)}px)')
    p.locator('details.td-asks > summary').click(); p.wait_for_timeout(200)
    ok(p.locator('details.td-asks [data-wkasks="newsletter"]').is_visible(), 'opened, its Copy for the newsletter button is there')
    p.screenshot(path=f'{OUT}/p_today_asks.png')
    first = p.evaluate("document.querySelector('.td-hrow')?.getBoundingClientRect().top")
    cards = p.evaluate("document.querySelector('.td-group')?.getBoundingClientRect().top")
    ok(first is not None and cards is not None and first < cards, f'on a hearing day the next hearing is above the cards ({round(first or 0)} < {round(cards or 0)})')
    ok(p.locator('.td-hrow').count() <= 2 or 'more' in p.locator('.td-p-hear').inner_text().lower(), 'one hearing, or a fold for the rest')
    p.screenshot(path=f'{OUT}/p_today.png')
    c.close()

    # ---- 7. draft notes use the phone's width ----
    c, p = ctx(b, 390); go(p, f'/bill/{num}/public')
    fb = p.evaluate("""() => { const l = document.createElement('ul'); l.className = 'bw-drlist'; l.innerHTML = '<li class="bw-drrow"><div class="bw-drbody">x</div><div class="bw-dracts"><button>a</button></div></li>'; document.body.appendChild(l);
      const s = getComputedStyle(l.querySelector('.bw-drbody')).flexBasis; l.remove(); return s; }""")
    ok(fb == '100%', f'a draft note takes the full width on a phone ({fb})')
    c.close()
    b.close()

errs = [e for e in errors if 'Failed to fetch' not in e]   # a reload aborts the snapshot's fetch; other staff tests drop it too
ok(not errs, f'no page errors {errs[:3]}')
print(f'{sum(res)} passed, {len(res) - sum(res)} failed')
sys.exit(1 if not all(res) else 0)
