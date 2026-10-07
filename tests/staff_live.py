# Staff v2's LIVE path, against a fake Supabase (R-152 batch B, "safe with eleven people"; tests/livefake.py). The sandbox skips
# the database, so these never ran: what sign-in reads, what a failed read looks like, a refresh when someone comes back, what a
# save sends and whether it can undo a teammate's newer save, bill numbers in two sessions, and the staff error reports.
#   python3 tests/staff_live.py [base]      base defaults to http://localhost:8832 (the frontend served from this folder)
import sys, os, json, re
from playwright.sync_api import sync_playwright
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from livefake import Fake
BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832').rstrip('/')
NOW = '2026-03-16T09:00:00-10:00'   # the snapshot's day: the session is on, hearings are coming
res = []
def ok(c, m): res.append(bool(c)); print('PASS' if c else 'FAIL', m)
errors = []

def state(pg, js):   # read the app's own state (the same module instance the page runs)
    return pg.evaluate("async () => { const m = await import('./staff/data.js'); const S = m.S; return " + js + "; }")
def open_page(b, fake, hash='', w=1280, h=900, clock=True, init=''):
    ctx = b.new_context(viewport={'width': w, 'height': h}); fake.install(ctx)
    if init: ctx.add_init_script(init)
    pg = ctx.new_page()
    pg.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
    pg.on('console', lambda m: errors.append('console: ' + m.text[:160]) if m.type == 'error' and 'favicon' not in m.text and 'fake outage' not in m.text and 'status of 500' not in m.text else None)
    if clock: pg.clock.install(time=NOW)
    pg.goto(f'{BASE}/staff.html#{hash}'); pg.wait_for_function("() => !!document.querySelector('main') && !document.querySelector('.skel, .skelpage')", timeout=60000); pg.wait_for_timeout(1500)
    return ctx, pg
def goto(pg, hash, wait=1200):
    pg.evaluate(f"location.hash = '{hash}'"); pg.wait_for_timeout(wait)
def away(pg, minutes):   # the person leaves the tab and comes back
    pg.evaluate("() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); }")
    pg.clock.fast_forward(minutes * 60 * 1000)
    pg.evaluate("() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' }); document.dispatchEvent(new Event('visibilitychange')); }")
    pg.wait_for_timeout(1500)

fake0 = Fake()
# A tracked, public bill with a position (the Public tab's form is on it), and a bill to be heard this week with no draft.
pub = next(b for b in fake0.t['bills'] if b.get('is_public') and b.get('position') and b['position'] != 'monitor' and b.get('nickname') and b['session_year'] == 2026)
NUM = pub['bill_number']; PID = pub['id']
now_ms = 1773688800000   # 2026-03-16T09:00 HST
def hearing_week_bill(fake):
    for h in fake.t['hearings']:
        t = __import__('datetime').datetime.fromisoformat(h['scheduled_at'].replace('Z', '+00:00')).timestamp() * 1000
        b = next((x for x in fake.t['bills'] if x['id'] == h['bill_id']), None)
        if b and b.get('tracked') and b.get('position') and b['position'] != 'monitor' and h.get('status') != 'cancelled' and now_ms < t < now_ms + 6 * 864e5 and b['stage'] not in ('dead', 'enacted'):
            return b, h
    return None, None

with sync_playwright() as p:
    b = p.chromium.launch()

    # ---- 1. sign-in reads, and only tracked bills' hearings (R-152 B) ----
    fake = Fake(); ctx, pg = open_page(b, fake)
    hr = [u for u in fake.reads if '/rest/v1/hearings' in u and 'bill_id=eq' not in u]
    ok(hr and 'bills%21inner' in hr[0] and 'bills.tracked=eq.true' in hr[0], 'the sign-in reads the hearings of tracked bills only (an inner join on tracked)')
    n_h = state(pg, 'S.hearings.length'); tracked_h = len([h for h in fake.t['hearings'] if any(x['id'] == h['bill_id'] and x.get('tracked') for x in fake.t['bills'])])
    ok(n_h == tracked_h and state(pg, "S.hearings.every(h => !('bills' in h))"), f'S.hearings holds those hearings, without the join column ({n_h} of {len(fake.t["hearings"])})')
    ok(state(pg, 'S.loadFailed.length') == 0 and pg.locator('.sv-failnote').count() == 0, 'nothing failed: no notice')
    ctx.close()

    # ---- 2. a failed read says so, and never says "no draft yet" (R-152 B) ----
    fake = Fake(); wb, wh = hearing_week_bill(fake)
    fake.t['testimony_drafts'] = [d for d in fake.t['testimony_drafts'] if d['bill_id'] != wb['id']]
    ctx, pg = open_page(b, fake)
    goto(pg, '/')
    ok('No testimony draft yet' in pg.locator('main').inner_text() or 'No draft yet' in pg.locator('main').inner_text(), f'control: with the drafts read working, a hearing this week with no draft says so ({wb["bill_number"]})')
    ctx.close()
    fake.fail.add('testimony_drafts')
    ctx, pg = open_page(b, fake)
    ok(pg.locator('.sv-failnote[role="alert"]').count() == 1 and 'testimony drafts' in pg.locator('.sv-failnote').inner_text(), 'a failed read is named in a notice at the top')
    ok(pg.locator('.sv-failnote [data-reload]').count() == 1, 'the notice has a Reload')
    goto(pg, '/')
    t = pg.locator('main').inner_text()
    ok('No testimony draft yet' not in t and 'No draft yet' not in t, 'Today does not claim "no testimony draft" when the drafts did not load')
    goto(pg, f'/bill/{wb["bill_number"]}'); t = pg.locator('main').inner_text()
    ok('did not load' in t and 'No testimony draft yet' not in t, 'the bill page says the drafts did not load instead of "no draft yet"')
    pg.screenshot(path=os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out', 'staff_live_failed.png'))
    fake.fail.clear(); pg.locator('.sv-failnote [data-reload]').click(); pg.wait_for_timeout(2000)
    ok(pg.locator('.sv-failnote').count() == 0 and state(pg, 'S.loadFailed.length') == 0, 'Reload reads again and the notice goes')
    ctx.close()
    ctx, pg = open_page(b, fake, w=390, h=844)
    fake.fail.add('hearing_outcomes'); fake.fail.add('bill_messages')
    ctx.close(); ctx, pg = open_page(b, fake, w=390, h=844)
    ok(pg.locator('.sv-failnote').count() == 1 and 'hearing results' in pg.locator('.sv-failnote').inner_text() and 'chat messages' in pg.locator('.sv-failnote').inner_text(), 'two failures are named together, on a phone too')
    pg.screenshot(path=os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out', 'staff_live_failed_phone.png'))
    ok(not pg.evaluate("document.documentElement.scrollWidth > innerWidth"), 'the notice does not make the phone scroll sideways')
    ctx.close(); fake.fail.clear()

    # ---- 3. fresh data when someone comes back after five minutes, and Refresh in the menu (R-152 B) ----
    fake = Fake(); ctx, pg = open_page(b, fake, hash=f'/bill/{NUM}')
    ok(state(pg, f"S.bills.find(x => x.id === '{PID}').nickname") == pub['nickname'], 'the bill loaded with its nickname')
    fake.set('bills', PID, nickname='Changed by a teammate'); n0 = len([u for u in fake.reads if '/rest/v1/bills?' in u and 'tracked=eq.true' in u])
    away(pg, 1)
    ok(len([u for u in fake.reads if '/rest/v1/bills?' in u and 'tracked=eq.true' in u]) == n0, 'back after one minute: no re-read')
    away(pg, 6)
    ok(len([u for u in fake.reads if '/rest/v1/bills?' in u and 'tracked=eq.true' in u]) == n0 + 1, 'back after six minutes: the bills are read again')
    ok(state(pg, f"S.bills.find(x => x.id === '{PID}').nickname") == 'Changed by a teammate', "and the teammate's change shows")
    ok('Changed by a teammate' in pg.locator('main').inner_text(), 'the open screen was redrawn with it')
    fake.set('bills', PID, nickname='Changed again')
    pg.locator('[data-avatar]').first.click(); pg.wait_for_timeout(500)
    ok(pg.locator('.sv-menu button:has-text("Refresh"), [role=menuitem]:has-text("Refresh"), button:has-text("Refresh")').count() >= 1, 'Refresh is in the menu')
    pg.locator('button:has-text("Refresh")').first.click(); pg.wait_for_timeout(2500)
    ok(state(pg, f"S.bills.find(x => x.id === '{PID}').nickname") == 'Changed again', 'Refresh reads again on demand')
    ok('Up to date' in pg.evaluate("document.body.innerText"), 'and says so')
    ctx.close()

    # ---- 4. a refresh never redraws over someone typing ----
    fake = Fake(); ctx, pg = open_page(b, fake, hash=f'/bill/{NUM}/public')
    box = pg.locator('#bw-psum'); box.click(); box.fill('Half-written summary'); fake.set('bills', PID, nickname='Teammate changed the nickname meanwhile')
    away(pg, 6)
    ok(pg.locator('#bw-psum').input_value() == 'Half-written summary', 'the box being typed in keeps its words through a refresh')
    ok(state(pg, f"S.bills.find(x => x.id === '{PID}').nickname") == 'Teammate changed the nickname meanwhile', 'while the data underneath is updated')
    ctx.close()

    # ---- 5. a save sends only what changed, and never undoes a teammate's other field (R-152 B) ----
    fake = Fake(); ctx, pg = open_page(b, fake, hash=f'/bill/{NUM}/public')
    nick = pg.locator('#bw-nick'); nick.fill('A brand new nickname')
    fake.set('bills', PID, public_summary='Kevin wrote this summary at 10:00')   # a teammate saves a different field meanwhile
    pg.locator('.bw-pubsave button[type=submit]').click(); pg.wait_for_timeout(1500)
    w = fake.writes('bills', 'PATCH')
    ok(len(w) == 1 and set(w[0][3].keys()) == {'nickname'} and w[0][3]['nickname'] == 'A brand new nickname', f'only the changed field is sent ({[sorted(x[3].keys()) for x in w]})')
    ok(fake.get('bills', PID)['public_summary'] == 'Kevin wrote this summary at 10:00', "so a teammate's summary is not erased")
    ok('Public page saved' in pg.evaluate("document.body.innerText"), 'and the save says so')
    # nothing changed: nothing sent
    n = len(fake.writes('bills', 'PATCH')); pg.locator('.bw-pubsave button[type=submit]').click(); pg.wait_for_timeout(1000)
    ok(len(fake.writes('bills', 'PATCH')) == n and 'Nothing to save' in pg.evaluate("document.body.innerText"), 'saving with nothing changed sends nothing and says so')
    ctx.close()

    # ---- 6. the same field changed by a teammate: shown, nothing written until the person chooses ----
    fake = Fake(); ctx, pg = open_page(b, fake, hash=f'/bill/{NUM}/public')
    pg.locator('#bw-nick').fill('Mine nick'); fake.set('bills', PID, nickname='Theirs nick'); n = len(fake.writes('bills', 'PATCH'))
    pg.locator('.bw-pubsave button[type=submit]').click(); pg.wait_for_timeout(1500)
    ok(pg.locator('dialog[open]').count() == 1, 'a conflict opens a sheet')
    t = pg.locator('dialog[open]').inner_text()
    ok('Theirs nick' in t and 'Mine nick' in t and 'Nickname' in t, 'it shows theirs and the person\'s own, named')
    ok(len(fake.writes('bills', 'PATCH')) == n, 'nothing has been written yet')
    ok(pg.locator('dialog[open] .btn.primary').count() == 1, 'one primary button (A-3)')
    pg.screenshot(path=os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out', 'staff_live_conflict.png'))
    pg.locator('dialog[open] [data-cfkeep]').click(); pg.wait_for_timeout(1500)
    ok(fake.get('bills', PID)['nickname'] == 'Theirs nick' and not any('nickname' in x[3] for x in fake.writes('bills', 'PATCH')), '"Keep theirs": theirs stays on the server and nothing of the person\'s nickname is sent')
    ok(pg.locator('#bw-nick').input_value() == 'Theirs nick', 'the form shows theirs')
    pg.locator('#bw-nick').fill('Mine again'); fake.set('bills', PID, nickname='Theirs again')
    pg.locator('.bw-pubsave button[type=submit]').click(); pg.wait_for_timeout(1500)
    pg.locator('dialog[open] [data-cfmine]').click(); pg.wait_for_timeout(1500)
    ok(fake.get('bills', PID)['nickname'] == 'Mine again', '"Replace with mine": the person\'s wins')
    ok('Public page saved' in pg.evaluate("document.body.innerText"), 'and says it saved')
    ctx.close()

    # ---- 7. a conflict on one field does not hold back the others when the person keeps theirs ----
    fake = Fake(); ctx, pg = open_page(b, fake, hash=f'/bill/{NUM}/public')
    pg.locator('#bw-nick').fill('Mine nick'); pg.locator('#bw-psum').fill('My summary'); fake.set('bills', PID, nickname='Theirs nick')
    pg.locator('.bw-pubsave button[type=submit]').click(); pg.wait_for_timeout(1500)
    pg.locator('dialog[open] [data-cfkeep]').click(); pg.wait_for_timeout(1500)
    w = fake.writes('bills', 'PATCH')
    ok(len(w) == 1 and set(w[0][3].keys()) == {'public_summary'}, f'"Keep theirs" still saves the person\'s other change ({[sorted(x[3].keys()) for x in w]})')
    ctx.close()

    # ---- 8. the team note: the same rule ----
    fake = Fake(); ctx, pg = open_page(b, fake, hash=f'/bill/{NUM}')
    pg.locator('#bw-note').fill('My note about this bill'); pg.locator('[data-savenote]').click(); pg.wait_for_timeout(1500)
    w = fake.writes('bills', 'PATCH')
    ok(len(w) == 1 and w[0][3] == {'internal_notes': 'My note about this bill'}, f'a note saves as the one field it is ({[x[3] for x in w]})')
    pg.locator('#bw-note').fill('My note, longer now'); fake.set('bills', PID, internal_notes='Their note, written at 10:00'); n = len(fake.writes('bills', 'PATCH'))
    pg.locator('[data-savenote]').click(); pg.wait_for_timeout(1500)
    ok(pg.locator('dialog[open]').count() == 1 and 'Their note, written at 10:00' in pg.locator('dialog[open]').inner_text() and 'My note, longer now' in pg.locator('dialog[open]').inner_text(), "a teammate's newer note is shown beside the person's")
    ok(len(fake.writes('bills', 'PATCH')) == n and fake.get('bills', PID)['internal_notes'] == 'Their note, written at 10:00', 'and not replaced without a word')
    pg.locator('dialog[open] [data-cfmine]').click(); pg.wait_for_timeout(1500)
    ok(fake.get('bills', PID)['internal_notes'] == 'My note, longer now', '"Replace with mine" replaces it')
    ctx.close()

    # ---- 9. bill numbers in two sessions (R-152 B; the public page's R-110) ----
    old = dict(pub, id='old-' + PID, session_year=2025, title='THE 2025 BILL OF THE SAME NUMBER', nickname='Old session twin', tracked=True)
    fake = Fake(extra_bills=[old]); ctx, pg = open_page(b, fake, hash=f'/bill/{NUM}')
    ok(state(pg, f"S.bills.filter(x => x.bill_number === '{NUM}').length") == 2, f'two tracked bills share {NUM}')
    ok(pub['nickname'] in pg.locator('main').inner_text() and 'Old session twin' not in pg.locator('main').inner_text(), 'the number alone opens the current session\'s bill')
    goto(pg, f'/bill/2025/{NUM}')
    ok('Old session twin' in pg.locator('main').inner_text() or 'THE 2025 BILL' in pg.locator('main').inner_text(), 'the number with the year opens that session\'s bill')
    goto(pg, f'/search?q={NUM}', 2500); links = pg.evaluate(f"[...document.querySelectorAll('a[href*=\"/bill/\"]')].map(a => a.getAttribute('href')).filter(h => h.endsWith('/{NUM}'))")
    ok(f'#/bill/2025/{NUM}' in links and f'#/bill/{NUM}' in links, f'Search links each one to its own bill ({links[:4]})')
    ok(pg.evaluate(f"[...document.querySelectorAll('a[href=\"#/bill/2025/{NUM}\"]')].some(a => a.innerText.includes('{NUM} (2025)'))"), 'and the earlier session\'s row says "(2025)", so two bills are never two identical rows')
    goto(pg, '/'); pg.fill('#hq', NUM); pg.press('#hq', 'Enter'); pg.wait_for_timeout(1500)
    ok(pg.evaluate('location.hash') == f'#/bill/{NUM}', f'typing the number in the header search opens the current bill ({pg.evaluate("location.hash")})')
    goto(pg, f'/bill/2025/{NUM}')
    ok(f'{NUM} (2025)' in pg.locator('.sv-hdr, main').first.inner_text() or f'{NUM} (2025)' in pg.evaluate("document.title"), 'an earlier session\'s bill says its year where its number is shown')
    ctx.close()

    # ---- 10. staff errors are reported, and a test run never sends one (R-152 B) ----
    fake = Fake()
    ctx, pg = open_page(b, fake, init="window.__staffErrlogTest = true; window.__sent = []; window.__staffErrlogSend = (u, i) => { window.__sent.push(JSON.parse(i.body).p); return Promise.resolve(); };")
    pg.evaluate("window.dispatchEvent(new ErrorEvent('error', { message: 'boom from a test, mail me at nate@example.com', error: new Error('boom from a test, mail me at nate@example.com') }))"); pg.wait_for_timeout(500)
    pg.evaluate("void Promise.reject(new Error('a rejected promise'))"); pg.wait_for_timeout(300)
    pg.evaluate("void Promise.reject(new Error('Failed to fetch'))"); pg.wait_for_timeout(300)
    sent = pg.evaluate('window.__sent')
    ok(any(s['kind'] == 'error' and s['place'] == 'staff/today' and 'boom' in s['message'] for s in sent), f'a thrown error is reported with its screen, "staff/today" ({[ (s["kind"], s["place"]) for s in sent]})')
    ok(any(s['kind'] == 'rejection' for s in sent) and not any('Failed to fetch' in s['message'] for s in sent), 'a rejection is reported, a dropped connection is not')
    ok(all(re.fullmatch(r'staff/[A-Za-z0-9/_.-]*', s['place']) and s['device'] in ('phone', 'tablet', 'laptop') and '?' not in s['place'] for s in sent), 'only the screen name, never a query string; the device is a size')
    goto(pg, f'/bill/{NUM}?reply=1')
    pg.evaluate("window.dispatchEvent(new ErrorEvent('error', { message: 'on the bill page', error: new Error('on the bill page') }))"); pg.wait_for_timeout(500)
    ok(any(s['place'] == f'staff/bill/{NUM}' for s in pg.evaluate('window.__sent')), 'on a bill page the bill is named, not what was typed or opened with')
    goto(pg, '/person/00000000-0000-0000-0000-000000000000')
    pg.evaluate("window.dispatchEvent(new ErrorEvent('error', { message: 'on a person page', error: new Error('on a person page') }))"); pg.wait_for_timeout(500)
    ok(all('0000' not in s['place'] for s in pg.evaluate('window.__sent')), "a person's id never leaves the browser")
    ctx.close()
    ctx, pg = open_page(b, fake, init="window.__sent = []; const f = window.fetch; window.fetch = (...a) => { if (String(a[0]).includes('log_public_error')) window.__sent.push(1); return f(...a); };")
    pg.evaluate("window.dispatchEvent(new ErrorEvent('error', { message: 'a test run', error: new Error('a test run') }))"); pg.wait_for_timeout(500)
    ok(pg.evaluate('window.__sent.length') == 0 and not [r for r in fake.rpcs if r[0] == 'log_public_error'], 'an automated browser (a test run) sends nothing')
    ctx.close()

    # ---- 11. the small fixes (R-152 D): a big bulk edit, an owner change that half fails, a filing link that is not a web address ----
    fake = Fake(); ctx, pg = open_page(b, fake)
    ids = [f'bulk-{i}' for i in range(700)]
    pg.evaluate("async (ids) => { const m = await import('./staff/data.js'); await m.DB.bulkUpdate(ids, { position: 'support' }); }", ids)
    pw_ = fake.writes('bills', 'PATCH')
    ok(len(pw_) == 5 and all(len(json.dumps(w[2])) < 8000 for w in pw_), f'700 bills in one edit go in slices of 150, none too long for the API ({len(pw_)} requests)')
    ob = next(x for x in fake.t['bills'] if (next((a for a in fake.t['bill_assignments'] if a['bill_id'] == x['id']), None)))
    old_owner = next(a['advocate_id'] for a in fake.t['bill_assignments'] if a['bill_id'] == ob['id'])
    new_owner = next(a['id'] for a in fake.t['advocates'] if a['id'] != old_owner)
    n0 = len(fake.log)
    pg.evaluate("async ([b, a]) => { const m = await import('./staff/data.js'); await m.DB.setOwner(b, a); }", [ob['id'], new_owner])
    ws = [(w[0], w[1]) for w in fake.log[n0:]]
    ok(ws and ws[0] == ('POST', 'bill_assignments') and ws[-1] == ('DELETE', 'bill_assignments'), f'a new owner is added before the old one is taken off, so a failure never leaves none ({ws})')
    fake.t['bill_assignments'] = [a for a in fake.t['bill_assignments'] if a['bill_id'] != ob['id']] + [{'bill_id': ob['id'], 'advocate_id': old_owner}]
    pg.evaluate("async ([b, o]) => { const S = (await import('./staff/data.js')).S; S.assignments[b] = [o]; }", [ob['id'], old_owner])
    fake.fail.add('bill_assignments')
    err = pg.evaluate("async ([b, a]) => { const m = await import('./staff/data.js'); try { await m.DB.setOwner(b, a); return ''; } catch (e) { return String(e.message || e); } }", [ob['id'], new_owner])
    ok(err and state(pg, f"S.assignments['{ob['id']}'].join()") == old_owner, f'a failed owner change says so and the screen keeps the old owner ({err[:40]})')
    fake.fail.clear()
    dr = next(d for d in fake.t['testimony_drafts'])
    n1 = len(fake.rpcs)
    err = pg.evaluate("async ([bid, did]) => { const m = await import('./staff/data.js'); try { await m.DB.transition(bid, did, 'file', null, 'javascript:alert(1)'); return ''; } catch (e) { return String(e.message || e); } }", [dr['bill_id'], dr['id']])
    ok('https://' in err and len(fake.rpcs) == n1, f'a filing link that is not a web address is refused before anything is sent ({err[:50]})')
    ctx.close()
    b.close()

errs = [e for e in errors if 'Failed to fetch' not in e and 'ERR_FAILED' not in e and 'boom' not in e and 'rejected promise' not in e and 'on the bill page' not in e and 'on a person page' not in e and 'a test run' not in e]
ok(not errs, f'no page errors {errs[:3]}')
print(f'{sum(res)} passed, {len(res) - sum(res)} failed')
sys.exit(1 if not all(res) else 0)
