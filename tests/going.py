# Going to a hearing in person (R-142, Nate 10/4: "People should be provided directions to in-person hearings if they sign
# up for them"), in the sandbox (Mon 16 Mar 2026, 9:00): HB 1523's hearing is Tue 17 Mar at 3:00 PM in Room 229.
#   "Go to the hearing" says what signing up brings; "I plan to go" opens "How to get there" in place (the floor, arrive by,
#   getting in, the bus and parking, how to speak, the Public Access Room, Directions, the calendar file); the card keeps
#   "How to get there" after a reload; Home shows the plan for tomorrow at the top; a changed room is pointed out; the
#   calendar file carries the directions and a reminder; Undo takes it all away. Phone and laptop; no page errors.
#   python3 tests/going.py [base]     base defaults to http://localhost:8832/track.html?demo=1
import sys, os, json, re
from playwright.sync_api import sync_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832/track.html?demo=1'
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'tests', 'out', 'going'); os.makedirs(OUT, exist_ok=True)
res = []
def ok(c, m): res.append(bool(c)); print('PASS' if c else 'FAIL', m)
def ready(pg): pg.wait_for_function("() => !!document.querySelector('main') && !document.querySelector('.skelpage')", timeout=60000); pg.wait_for_timeout(900)
SKIP = "() => { try { for (const x of ['', '_demo']) { localStorage.setItem('hiphi_wiz' + x, JSON.stringify({ done: true, step: 99 })); localStorage.setItem('hiphi_tour_bill' + x, '{\"how\":\"test\"}'); localStorage.setItem('hiphi_tour_home' + x, '{\"how\":\"test\"}'); } } catch {} }"
snap = json.load(open(os.path.join(ROOT, 'demo', 'snapshot.json')))
B = next(b for b in snap['bills'] if b['bill_number'] == 'HB1523')
H = next(h for h in snap['hearings'] if h['bill_id'] == B['id'] and h['status'] == 'scheduled' and h['scheduled_at'].startswith('2026-03-18'))
K = f"{B['id']}|{H['id']}"

def run(w, h, mobile):
    tag = 'phone' if mobile else 'laptop'
    ctx = br.new_context(viewport={'width': w, 'height': h}, is_mobile=mobile, has_touch=mobile, accept_downloads=True)
    ctx.add_init_script(f"({SKIP})()")
    pg = ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    # Follow the bill, so Home has it the way a follower would.
    pg.goto(BASE + '#/'); ready(pg)
    pg.evaluate("async id => { const c = await import('./pub/core.js'); c.S.direct.add(id); c.recomputeWatch(); c.saveLocal(); }", B['id'])
    pg.goto(BASE + '#/bill/HB1523'); pg.reload(); ready(pg)
    card = pg.locator(f'[data-card="{K}"]').first
    ok(card.count() == 1, f'{tag}: the bill page has the card for the 17 Mar hearing')
    card.locator(f'[data-moreways="{K}"]').click(); pg.wait_for_timeout(300)
    card.locator(f'.mwrow[data-go="{K}"]').click(); pg.wait_for_timeout(300)
    gp = card.locator('.gopanel')
    t = gp.inner_text() if gp.count() else ''
    ok('Room 229, 2nd floor' in t and 'with no sign-up' in t and 'Tap I plan to go, and you get directions' in t, f'{tag}: before the sign-up, the panel gives the floor, says listening needs no sign-up, and what "I plan to go" brings')
    ok(card.locator('.godir').count() == 0, f'{tag}: no directions before the sign-up')
    # Sign up.
    card.locator(f'[data-attend="{K}"]').click(); pg.wait_for_timeout(700)
    card = pg.locator(f'[data-card="{K}"]').first
    d = card.locator('.godir'); dt = d.inner_text() if d.count() else ''
    ok(d.count() == 1, f'{tag}: "I plan to go" opens How to get there in the same card')
    ok('Arrive by 2:40 PM' in dt, f'{tag}: arrive 20 minutes early, in words ({re.search(r"Arrive by [^.]*", dt).group(0) if "Arrive by" in dt else "missing"})')
    ok('Room 229 is on the 2nd floor. Take an elevator up.' in dt, f'{tag}: the room and its floor')
    ok('photo ID' in dt and 'bag' in dt, f'{tag}: getting in: photo ID and the bag check')
    ok('Beretania Street' in dt and 'Miller Street' in dt, f'{tag}: the bus and the parking')
    ok('In person' in dt and 'put your name on the list to speak' in dt, f'{tag}: how to speak')
    ok('(808) 587-0478' in dt and 'Room 401' in dt, f'{tag}: the Public Access Room for help')
    href = d.locator('a[data-godir]').get_attribute('href') or ''
    ok(href.startswith('https://www.google.com/maps/dir/?api=1&destination=') and d.locator('a[data-godir]').get_attribute('target') == '_blank', f'{tag}: Directions opens the map in a new tab')
    ok(pg.evaluate("document.activeElement && document.activeElement.id") == f"go-{H['id']}" and card.locator(f'#go-{H["id"]}').get_attribute('aria-expanded') == 'true', f'{tag}: focus moves to "How to get there", open, so a screen reader hears it')
    ok(dt.count('How to get there') == 0 and card.inner_text().count('How to get there') == 1, f'{tag}: "How to get there" is said once (A-14)')
    ok('You plan to go' in card.locator('.donebox').inner_text(), f'{tag}: the done line says "You plan to go"')
    ok(card.locator(f'.goline [data-undo]').count() == 0, f'{tag}: no "I can\'t go" beside the done line\'s own Undo for the same step')
    card.locator(f'[data-moreways="{K}"]').click() if card.locator('.moreways').count() == 0 else None
    pg.wait_for_timeout(200)
    ok(card.locator(f'.mwrow[data-go="{K}"]').count() == 0, f'{tag}: "Go to the hearing" leaves More ways to help once signed up')
    d.scroll_into_view_if_needed(); pg.screenshot(path=os.path.join(OUT, f'{tag}-1-signed-up.png'), full_page=False)
    # The calendar file.
    with pg.expect_download() as dl:
        card.locator('.godir [data-ics]').click()
    ics = open(dl.value.path()).read()
    ok('2nd floor' in ics and 'Arrive by 2:40 PM' in ics and 'Miller Street' in ics, f'{tag}: the calendar file carries the floor and the directions')
    ok('TRIGGER:-PT90M' in ics, f'{tag}: and a reminder an hour and a half before')
    pg.wait_for_timeout(300)
    ok('Saved. Open the file to add it to your calendar.' in pg.locator(f'[data-card="{K}"] .godir').inner_text(), f'{tag}: it says what to do with the file')
    # Reload: the plan stays, folded.
    pg.reload(); ready(pg)
    card = pg.locator(f'[data-card="{K}"]').first
    ok(card.locator('.godir').count() == 0 and card.locator(f'.goline [data-go="{K}"]').count() == 1, f'{tag}: after a reload the card offers "How to get there", folded')
    card.locator(f'.goline [data-go="{K}"]').click(); pg.wait_for_timeout(300)
    ok(pg.locator(f'[data-card="{K}"] .godir').count() == 1, f'{tag}: and opens it')
    # Home while testimony is still open (due today 3:00 PM): the hearing's own card stays, with its deadline's warning and
    # "How to get there"; Home does not say "all caught up" (R-005's rule, now for going too).
    pg.goto(BASE + '#/'); pg.reload(); ready(pg)
    hc = pg.locator(f'.hm-main [data-card="{K}"]').first
    ok(hc.count() == 1 and hc.locator('.goline').count() == 1 and hc.locator('[data-helper]').count() >= 1, f'{tag}: with testimony open, Home keeps the card, with "Write my testimony" and "How to get there"')
    ok(hc.locator('.due.warn').count() == 1, f'{tag}: and the deadline keeps its warning')
    ok('caught up' not in pg.inner_text('.hm-main h1'), f'{tag}: Home does not say "all caught up" ({pg.inner_text(".hm-main h1")!r})')
    ok(pg.locator('.gocard').count() == 0, f'{tag}: and no second plan card for the same hearing (said once)')
    # Testimony sent: the card folds into Done this week, and the plan card leads Home.
    # (The sandbox's clock starts again at 9:00 on every load, so the testimony is stamped later than the plan by hand.)
    pg.evaluate("async k => { const c = await import('./pub/core.js'); await c.markDone(k.split('|')[0], k.split('|')[1], 'testimony', true, { quiet: true }); c.S.doneAt[k + '|testimony'] = '2026-03-16T23:00:00.000Z'; c.saveDoneAt(); }", K)
    pg.reload(); ready(pg)
    gc = pg.locator('.hm-main .gocard')
    gt = gc.inner_text() if gc.count() else ''
    ok(gc.count() == 1 and 'You plan to go' in gt and 'Tomorrow (Tue) at 3:00 PM' in gt and 'Room 229, 2nd floor' in gt, f'{tag}: testimony sent, Home shows tomorrow\'s plan at the top ({gt[:90]!r})')
    ok(pg.locator(f'.hm-main [data-card="{K}"]:visible').count() == 0, f'{tag}: the hearing\'s own card is folded away, so the plan is said once')
    gc.locator('[data-go]').first.click(); pg.wait_for_timeout(300)
    ok(pg.locator('.hm-main .gocard .godir').count() == 1, f'{tag}: How to get there opens on Home')
    pg.locator('.gocard').scroll_into_view_if_needed(); pg.screenshot(path=os.path.join(OUT, f'{tag}-2-home.png'), full_page=False)
    # A changed room is pointed out (the sign-up kept Room 225 here, as if the notice had said that).
    pg.evaluate("hid => { const k = 'hiphi_going_demo'; const m = JSON.parse(localStorage.getItem(k) || '{}'); m[hid] = { ...(m[hid] || {}), room: 'Conference Room 225' }; localStorage.setItem(k, JSON.stringify(m)); }", H['id'])
    pg.reload(); ready(pg)
    ch = pg.locator('.gocard .gochange')
    ok(ch.count() == 1 and 'The room changed' in ch.inner_text() and 'Room 229, 2nd floor' in ch.inner_text(), f'{tag}: a changed room is pointed out ({ch.inner_text() if ch.count() else "none"})')
    # "I can't go" on the bill page (the done line's Undo now takes back the testimony, the latest step): the plan is gone.
    pg.goto(BASE + '#/bill/HB1523'); pg.reload(); ready(pg)
    pg.locator(f'[data-card="{K}"] .goline [data-undo="{K}|attend"]').click(); pg.wait_for_timeout(500)
    ok(pg.locator(f'[data-card="{K}"] .goline').count() == 0, f'{tag}: "I can\'t go" takes the plan off the card, with testimony sent')
    pg.evaluate("async k => { const c = await import('./pub/core.js'); await c.markDone(k.split('|')[0], k.split('|')[1], 'testimony', false, { quiet: true }); }", K)
    pg.goto(BASE + '#/'); pg.reload(); ready(pg)
    ok(pg.locator('.gocard').count() == 0, f'{tag}: and off Home')
    kept = pg.evaluate("hid => JSON.parse(localStorage.getItem('hiphi_going_demo') || '{}')[hid] || null", H['id'])
    ok(kept is None, f'{tag}: and forgets the room it kept')
    # A cancelled hearing they planned to go to (the sandbox's duplicate 3:05 PM row): Home says so and moves the plan.
    X = next(h for h in snap['hearings'] if h['bill_id'] == B['id'] and h['status'] == 'cancelled' and h['scheduled_at'].startswith('2026-03-18'))
    pg.evaluate("async ([b, h]) => { const c = await import('./pub/core.js'); await c.markDone(b, h, 'attend', true, { quiet: true }); }", [B['id'], X['id']])
    pg.goto(BASE + '#/'); pg.reload(); ready(pg)
    gt = pg.locator('.gocard').inner_text() if pg.locator('.gocard').count() else ''
    ok('was cancelled' in gt and 'It’s now Tue, Mar 17 at 3:00 PM, Room 229, 2nd floor' in gt, f'{tag}: a cancelled hearing says so, with the one set in its place')
    pg.locator('.gocard [data-goswitch]').click(); pg.wait_for_timeout(700)
    dn = pg.evaluate("async () => [...(await import('./pub/core.js')).S.done].filter(k => k.endsWith('|attend'))")
    ok(dn == [f"{K}|attend"], f'{tag}: "I’ll go to the new one" moves the plan ({dn})')
    pg.evaluate("async k => { const c = await import('./pub/core.js'); await c.markDone(k.split('|')[0], k.split('|')[1], 'attend', false, { quiet: true }); }", K)
    # The walkthrough's last page (after sending testimony): "Going to the hearing in person?" and the directions there.
    for person in ('anyone', 'inperson'):
        pg.goto(BASE + '#/bill/HB1523'); pg.reload(); ready(pg)
        pg.evaluate("p => { const k = 'hiphi_me_demo'; const m = JSON.parse(localStorage.getItem(k) || '{}'); m.interests = p === 'inperson' ? ['testify'] : []; delete m.drafts; localStorage.setItem(k, JSON.stringify(m)); }", person)
        pg.evaluate("async ([b, h]) => { const c = await import('./pub/core.js'); c.app.openHelper(b, h); }", [B['id'], H['id']])
        pg.wait_for_selector('#hp-dlg', timeout=15000); pg.wait_for_timeout(800)
        for _ in range(12):
            if pg.locator('#hp-done-t').count(): break
            if pg.locator('#hp-dlg [data-hp="stance"][data-v="support"]').count(): pg.locator('#hp-dlg [data-hp="stance"][data-v="support"]').first.click(); pg.wait_for_timeout(500); continue
            if pg.locator('#hp-name').count() and not pg.input_value('#hp-name'): pg.fill('#hp-name', 'Leilani Kahale')
            if pg.locator('#hp-why').count() and not pg.input_value('#hp-why'): pg.fill('#hp-why', 'Our road has no crosswalk near the school.')
            b = pg.locator('#hp-dlg [data-hp="sent"], #hp-dlg [data-hp="acct-yes"]')
            if not b.count(): b = pg.locator('#hp-dlg .hp-foot .hp-main')
            if not b.count(): break
            b.first.click(); pg.wait_for_timeout(900)
        done = pg.locator('#hp-done-t').count() == 1
        ok(done, f'{tag}, {person}: the walkthrough reaches its last page')
        if not done: continue
        nx = pg.locator('#hp-dlg .hp-next').inner_text()
        if person == 'inperson': ok('To speak in person' in nx and 'Room 229, 2nd floor' in nx and 'Tap I plan to go, and you get directions' in nx, f'{tag}, {person}: where and when, and what "I plan to go" brings')
        else: ok('Going to the hearing in person?' in nx, f'{tag}, {person}: one line asks "Going to the hearing in person?"')
        pg.locator('#hp-dlg [data-hp="going"]').click(); pg.wait_for_timeout(700)
        gd = pg.locator('#hp-dlg .godir'); gt = gd.inner_text() if gd.count() else ''
        ok(gd.count() == 1 and 'How to get there' in gt and 'Room 229 is on the 2nd floor' in gt and 'You plan to go' in pg.locator('#hp-dlg .hp-next').inner_text(), f'{tag}, {person}: "I plan to go" opens the directions there')
        ok(pg.evaluate("document.activeElement && document.activeElement.id") == f"gdt-{H['id']}", f'{tag}, {person}: focus moves to "How to get there"')
        with pg.expect_download() as dl:
            pg.locator('#hp-dlg [data-hp="goics"]').click()
        ok('2nd floor' in open(dl.value.path()).read(), f'{tag}, {person}: its calendar file carries the floor')
        if person == 'inperson': gd.scroll_into_view_if_needed(); pg.screenshot(path=os.path.join(OUT, f'{tag}-3-walkthrough.png'), full_page=False)
        pg.evaluate("async () => { const c = await import('./pub/core.js'); c.S.helper = null; c.app.render(); }"); pg.wait_for_timeout(300)
        ok(pg.evaluate("async k => (await import('./pub/core.js')).S.done.has(k + '|attend')", K), f'{tag}, {person}: the plan is the card\'s own (marked going)')
        pg.goto(BASE + '#/bill/HB1523'); pg.reload(); ready(pg)
        pg.evaluate("async k => { const c = await import('./pub/core.js'); for (const x of ['testimony', 'attend']) await c.markDone(k.split('|')[0], k.split('|')[1], x, false, { quiet: true }); }", K)
    # The day itself: a plan for a hearing that started an hour ago still has its directions (hearings run late).
    pg.evaluate("""async ([b, h]) => { const c = await import('./pub/core.js'); const x = c.D.hearings.find(y => y.id === h);
      const at = new Date(Date.now() - 36e5).toISOString(); c.D.hearings.push({ ...x, id: 'going-today-test', scheduled_at: at, testimony_deadline: new Date(Date.now() - 25 * 36e5).toISOString() });
      await c.loadBills(); await c.markDone(b, 'going-today-test', 'attend', true, { quiet: true }); location.hash = '#/'; }""", [B['id'], H['id']])
    pg.wait_for_timeout(1500)
    gt = pg.locator('.gocard').inner_text() if pg.locator('.gocard').count() else ''
    ok('Today at' in gt and 'You plan to go' in gt, f'{tag}: an hour after the start, Home still shows today\'s plan ({gt[:60]!r})')
    pg.evaluate("async b => { const c = await import('./pub/core.js'); await c.markDone(b, 'going-today-test', 'attend', false, { quiet: true }); }", B['id'])
    # The Help conversation.
    pg.goto(BASE + '#/help/getting-to-the-capitol'); pg.reload(); ready(pg)
    ok('How do I get to a hearing at the Capitol?' in pg.inner_text('main'), f'{tag}: Help has "How do I get to a hearing at the Capitol?"')
    over = pg.evaluate("document.documentElement.scrollWidth > window.innerWidth")
    ok(not over, f'{tag}: no sideways scroll')
    ok(not errs, f'{tag}: no page errors ' + '; '.join(errs[:2]))
    ctx.close()

with sync_playwright() as p:
    br = p.chromium.launch()
    run(390, 844, True)
    run(1440, 900, False)
    br.close()
print(f'{sum(res)}/{len(res)} passed'); sys.exit(0 if all(res) else 1)
