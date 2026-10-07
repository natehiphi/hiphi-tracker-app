# A bill the team does not track: a read-only staff page with a Track button (R-058, Nate 10/5: "Go as recommended"). On the fake database
# (tests/livefake.py): the page shows what the Capitol has and its hearings, edits nothing, Track makes it the team's (and Undo takes it back),
# an unknown number says so, search links each not-tracked row to its page. In the sandbox the same page opens from its title and description.
#   python3 tests/staff_untracked.py [base]      base defaults to http://localhost:8832
import sys, os, json
from playwright.sync_api import sync_playwright
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from livefake import Fake
BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832').rstrip('/')
res, errors = [], []
def ok(c, m): res.append(bool(c)); print('PASS' if c else 'FAIL', m)
NOW = '2026-03-16T09:00:00-10:00'
def page(b, fake, hash, w=1280, h=900):
    ctx = b.new_context(viewport={'width': w, 'height': h}); fake.install(ctx); pg = ctx.new_page()
    pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.on('console', lambda m: errors.append('console: ' + m.text[:150]) if m.type == 'error' and 'favicon' not in m.text and 'fake outage' not in m.text and '404' not in m.text else None)
    pg.clock.install(time=NOW); pg.goto(f'{BASE}/staff.html#{hash}')
    pg.wait_for_function("() => !!document.querySelector('main') && !document.querySelector('.skel, .skelpage')", timeout=60000); pg.wait_for_timeout(2500)
    return ctx, pg

fake = Fake()
ref = next(b for b in fake.t['bills'] if b.get('referrals'))
un = dict(ref, id='un-1', bill_number='HB9999', tracked=False, title='RELATING TO TESTING THE READ-ONLY PAGE.', description='Does a test thing so the page has words.', nickname=None, public_summary=None,
          position=None, priority=None, is_public=False, internal_notes=None, stage='second_lateral' if False else (ref.get('stage') or 'introduced'), last_action='Referred to the Committee on Health.', last_action_date='2026-03-10',
          referrals=['HLT', 'FIN'], sponsors=[{'n': 'Rep. Example'}], companions=[], session_year=2026)
old = dict(un, id='un-2', session_year=2025, title='THE 2025 BILL OF THE SAME NUMBER.')
fake.t['bills'] += [un, old]
fake.t['hearings'] += [
    {'id': 'uh-1', 'bill_id': 'un-1', 'committee': 'HLT', 'scheduled_at': '2026-03-19T20:00:00.000Z', 'room': 'Conference Room 329', 'status': 'scheduled', 'description': 'x', 'source': 'openstates'},
    {'id': 'uh-2', 'bill_id': 'un-1', 'committee': 'HLT', 'scheduled_at': '2026-03-05T20:00:00.000Z', 'room': 'Conference Room 329', 'status': 'scheduled', 'description': 'x', 'source': 'openstates'}]

with sync_playwright() as pw:
    b = pw.chromium.launch()
    ctx, pg = page(b, fake, '/bill/HB9999')
    t = pg.locator('main').inner_text()
    ok(pg.evaluate("document.querySelector('.ut-page') !== null") and 'HB9999' in t and 'RELATING TO TESTING' in t.upper(), 'a bill the team does not track opens a page, not "not on our list"')
    ok('The team is not tracking this bill' in t and 'read-only' in t, 'it says so, and that it is read-only')
    ok('Referred to the Committee on Health.' in t and 'Rep. Example' in t, 'it shows where it stands, its last action and who introduced it')
    ok('Health' in t or 'HLT' in t, 'and its committees')
    h = pg.locator('.ut-page .bw-allh li')
    ok(h.count() == 2 and 'Coming up' in t and 'Held' in t, f'its hearings, the one coming and the one held ({h.count()})')
    ok(pg.locator('.ut-page input, .ut-page textarea, .ut-page select').count() == 0, 'nothing on it can be edited')
    ok(pg.locator('.ut-page .btn.primary').count() == 1 and pg.locator('[data-uttrack]').count() == 1, 'one primary button: Track this bill (A-3)')
    ok(pg.locator('.ut-page a[href*="capitol.hawaii.gov"]').count() == 1, 'with the Capitol page link')
    pg.screenshot(path=os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out', 'untracked_laptop.png'))
    n0 = len(fake.writes('bills', 'PATCH'))
    pg.locator('[data-uttrack]').click(); pg.wait_for_timeout(2500)
    w = fake.writes('bills', 'PATCH')[n0:]
    ok(len(w) == 1 and w[0][3] == {'tracked': True}, f'Track sends one change: tracked ({[x[3] for x in w]})')
    ok(pg.evaluate("location.hash") == '#/bill/HB9999' and pg.locator('.ut-page').count() == 0 and pg.locator('#bw-panel').count() == 1, 'and the same address now opens the full bill page')
    ok('is now tracked' in pg.evaluate("document.body.innerText") and 'Undo' in pg.evaluate("document.querySelector('#toast')?.innerText || document.body.innerText"), 'a toast says so, with Undo')
    ok(pg.evaluate("async () => (await import('./staff/data.js')).S.hearings.filter(h => h.bill_id === 'un-1').length") == 2, 'its hearings came with it')
    pg.locator('#toast [data-undo], #toast button:has-text("Undo")').first.click(); pg.wait_for_timeout(2500)
    w = fake.writes('bills', 'PATCH')[n0:]
    ok(len(w) == 2 and w[1][3] == {'tracked': False}, 'Undo takes it off the team’s list again')
    ok(pg.locator('.ut-page, #lg-sres').count() >= 0 and not pg.evaluate("async () => (await import('./staff/data.js')).S.bills.some(b => b.id === 'un-1')"), 'and it is not on the team’s list')
    ctx.close()
    # an unknown number
    ctx, pg = page(b, fake, '/bill/HB8888')
    ok('is not on our list' in pg.locator('main').inner_text() and pg.locator('.ut-page').count() == 0, 'a number the Capitol does not have still says "not on our list"')
    ctx.close()
    # an earlier session's bill of the same number
    ctx, pg = page(b, fake, '/bill/2025/HB9999')
    ok('THE 2025 BILL' in pg.locator('main').inner_text().upper() and '2025 session' in pg.locator('main').inner_text(), 'the year in the address finds that session’s bill, and says which session')
    ctx.close()
    # search links each not-tracked row
    ctx, pg = page(b, fake, '/search?q=HB9999')
    pg.wait_for_timeout(1500)
    lk = pg.evaluate("[...document.querySelectorAll('.lg-urow .lg-ulink')].map(a => a.getAttribute('href'))")
    ok('#/bill/HB9999' in lk, f'search links a bill the team does not track to its page ({lk})')
    ctx.close()
    # phone
    ctx, pg = page(b, fake, '/bill/HB9999', 390, 844)
    ok(not pg.evaluate('document.documentElement.scrollWidth > innerWidth') and pg.locator('[data-uttrack]').is_visible(), 'on a phone: no sideways scroll, and Track is there')
    ok(all(r['height'] >= 43.5 for r in [pg.locator('[data-uttrack]').bounding_box()] if r), 'Track is a 44px target')
    pg.screenshot(path=os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out', 'untracked_phone.png'), full_page=True)
    ctx.close()
    # the sandbox
    ctx = b.new_context(viewport={'width': 1280, 'height': 900}); pg = ctx.new_page(); pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.goto(f'{BASE}/staff.html?demo=1#/'); pg.reload(); pg.wait_for_timeout(2500)
    num = pg.evaluate("async () => { const S = (await import('./staff/data.js')).S; return S.snapshot.index.find(x => /^HB\\d+$/.test(x.bill_number) && !S.bills.some(b => b.id === x.id)).bill_number; }")
    pg.goto(f'{BASE}/staff.html?demo=1#/bill/{num}'); pg.reload(); pg.wait_for_timeout(3000)
    ok(pg.locator('.ut-page').count() == 1 and pg.locator('[data-uttrack]').count() == 1, f'the practice copy opens {num} read-only too')
    pg.locator('[data-uttrack]').click(); pg.wait_for_timeout(2000)
    ok(pg.locator('#bw-panel').count() == 1, 'and Track opens its full page')
    ctx.close()
    b.close()
ok(not [e for e in errors if 'Failed to fetch' not in e], f'no page errors {errors[:3]}')
print(f'{sum(res)} passed, {len(res) - sum(res)} failed')
sys.exit(1 if not all(res) else 0)
