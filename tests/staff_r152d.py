# R-152 batch D, "ready for January" (the staff review of 10/4), in the sandbox: the practice copy tells the truth (its to-do and
# sample email as the live app makes them, its checklist agreeing with its Team page, the calendar connected, no 2027 prep notice
# leading a March Today, a hearing with no draft to practise on), readiness checks the approvers and the next session's
# committees, a stray "%" in the address cannot freeze a page, and the staff app pins its database library.
#   python3 tests/staff_r152d.py [base]      base defaults to http://localhost:8832
import sys, os, re
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832').rstrip('/') + '/staff.html?demo=1'
res, errors = [], []
def ok(c, m): res.append(bool(c)); print('PASS' if c else 'FAIL', m)
def ctx(b, w=1280, h=900):
    c = b.new_context(viewport={'width': w, 'height': h}, is_mobile=w < 600, has_touch=w < 600)
    p = c.new_page(); p.on('pageerror', lambda e: errors.append(f'{w}: {e}'))
    p.on('console', lambda m: errors.append(f'console {w}: {m.text[:140]}') if m.type == 'error' and 'favicon' not in m.text and 'ERR_FAILED' not in m.text and 'Failed to fetch' not in m.text else None)
    return c, p
def go(p, hash='/', extra='', wait=2600):
    p.goto(BASE + extra + '#' + hash.lstrip('#')); p.reload(); p.wait_for_timeout(wait)
def S(p, js): return p.evaluate("async () => { const S = (await import('./staff/data.js')).S; return " + js + "; }")

with sync_playwright() as pw:
    b = pw.chromium.launch()
    c, p = ctx(b); go(p)
    # ---- the practice copy tells the truth ----
    ok('Your issues for 2027' not in p.locator('main').inner_text(), "a March Today does not lead with the 2027 issue prep (due 6 Nov)")
    ok('No testimony draft yet' in p.locator('main').inner_text(), 'a hearing this week has no draft, so the card people will meet in January can be practised')
    nd = S(p, "(() => { const now = Date.now(); for (const h of S.hearings) { const t = new Date(h.scheduled_at) - now, b = S.bills.find(x => x.id === h.bill_id); if (b && b.position && b.position !== 'monitor' && h.status === 'scheduled' && t > 2 * 864e5 && t < 6 * 864e5 && !(S.drafts[b.id] || []).some(d => d.committee === h.committee)) return b.bill_number; } return null; })()")
    ok(bool(nd), f'the bill without a draft ({nd})')
    if nd:
        go(p, f'/bill/{nd}'); ok(p.locator('button:has-text("Make the draft now")').count() >= 1, 'its page offers "Make the draft now", to practise on')
        go(p)
    t = S(p, "Object.values(S.todos).flat().filter(t => /^Send (the ask|an email blast)/.test(t.title)).map(t => ({ t: t.title, due: t.due_date, b: t.bill_id }))")
    ok(t and all(x['t'].startswith('Send the ask to HIPHI’s list and partners for the') for x in t), f'the email to-do says what the database says while email is paused ({t[0]["t"] if t else None})')
    hz = S(p, "S.hearings.filter(h => Object.values(S.todos).flat().some(t => t.id === 'eb' + h.id)).map(h => ({ id: h.id, at: h.scheduled_at, td: h.testimony_deadline, np: h.notice_posted_at }))")
    today = p.evaluate("new Date().toLocaleDateString('en-CA', { timeZone: 'Pacific/Honolulu' })")
    bad = []
    dues = S(p, "Object.values(S.todos).flat().filter(t => /^eb/.test(t.id)).map(t => [t.id.slice(2), t.due_date])")
    for hid, due in dues:
        h = next(x for x in hz if x['id'] == hid)
        tdl = p.evaluate("(h) => new Date(h.td ? h.td : new Date(h.at) - 864e5).getTime() - 12 * 36e5", h)
        latest = p.evaluate("(ms) => new Date(ms).toLocaleDateString('en-CA', { timeZone: 'Pacific/Honolulu' })", tdl)
        if due < today or due > latest and due != today: bad.append((hid[:6], due, latest))
    ok(dues and not bad, f'and is due in time to reach people: never before today, never after 12 hours before testimony closes ({len(dues)} checked) {bad[:2]}')
    al = S(p, "S.alerts.find(a => a.status === 'submitted' && a.bill_id)")
    if al:
        wd = p.evaluate("""async (a) => { const S = (await import('./staff/data.js')).S; const h = S.hearings.filter(h => h.bill_id === a.bill_id && new Date(h.scheduled_at) > Date.now()).sort((x, y) => x.scheduled_at.localeCompare(y.scheduled_at))[0];
          const d = ms => new Date(ms).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'Pacific/Honolulu' }); return h ? [d(new Date(h.scheduled_at)), d(+new Date(h.testimony_deadline || +new Date(h.scheduled_at) - 864e5))] : null; }""", al)
        ok(wd and f'on {wd[0]}.' in al['body'] and al['ask'] == f'Send testimony by {wd[1]}', f'the sample email names its hearing\'s real weekday ({wd}: {al["body"][:70]})')
    go(p, '/setup/connections')
    ok(re.search(r'Google Calendar\s*Connected', p.locator('main').inner_text().replace('\n', ' ')) is not None or 'Calendar connected' in p.locator('main').inner_text(), 'the practice copy shows Google Calendar connected, as the real tracker has it')
    # readiness and Team agree
    go(p, '/setup/team'); team = p.locator('main').inner_text()
    go(p, '/setup'); r = p.locator('main').inner_text()
    miss = S(p, "S.advocates.filter(a => a.is_active !== false && !a.is_admin).map(a => a.initials)")
    ok(all(i in r for i in miss) and f'{len(miss)} without an account' in r.replace('\n', ' '), f'the checklist names the {len(miss)} people without an account, the ones the Team page says have not signed in')
    ok(re.search(r'Everyone who approves testimony has signed in once', r) is not None, 'readiness checks that the approvers have signed in')
    ok(re.search(r'(Kris|Jess|Jaylen)[^.]*not signed in yet', r.replace('\n', ' ')) is not None, 'and names who has not')
    # next session's committees
    go(p, '/setup', '&season=off'); r2 = p.locator('main').inner_text()
    ok('2027 committees and chairs loaded' in r2, 'between sessions readiness asks for the 2027 committees and chairs')
    go(p, '/setup'); ok('2027 committees and chairs loaded' not in p.locator('main').inner_text(), 'and not in the middle of a session')
    # ---- a stray % ----
    go(p, '/bill/100%')
    ok(p.locator('main').count() == 1 and len(p.locator('main').inner_text()) > 10, 'a "%" in the address draws a page instead of freezing it')
    go(p, '/search?q=100%25%')
    ok(p.locator('main').count() == 1, 'also in a search')
    c.close()
    b.close()

lib = open(os.path.join(ROOT, 'staff', 'data.js')).read() + open(os.path.join(ROOT, 'staff', 'model.js')).read() + open(os.path.join(ROOT, 'app.js')).read()
ok('supabase-js@2/' not in lib and 'supabase-js@2.117.2' in lib, "the staff apps load a pinned database library (the public page pins the same one)")
ok(not errors, f'no page errors {errors[:3]}')
print(f'{sum(res)} passed, {len(res) - sum(res)} failed')
sys.exit(1 if not all(res) else 0)
