# Real Delete buttons (R-212 #28): a story, a letter and the profile itself, each deleted from the profile page.
# In the practice copy with ?letter (testimony on HB 2121) and ?email (an email on HB 1563), a phone-only profile (a hiphi_text
# number; the practice copy keeps it as hiphi_text_demo) with a story for any issue and one about an issue:
#   - each saved story has "Delete this story"; it goes at once (gone after a reload too), with Undo in its place that brings it back;
#   - each kept letter has its own Delete beside its row; it goes at once, Undo brings it back, and the row still opens the letter;
#   - "Delete my profile" asks on the page, "Keep my profile" backs out, "Yes, delete my profile" stops texts and clears the phone;
#   - no page errors, on a phone and a laptop.
#   python3 tests/delete_buttons.py [base]     base defaults to http://localhost:8832/track.html?demo=1&letter&email
import sys, os, json
from playwright.sync_api import sync_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832/track.html?demo=1&letter&email'
if 'letter' not in BASE: BASE += ('&' if '?' in BASE else '?') + 'letter&email'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out', 'delete_buttons'); os.makedirs(OUT, exist_ok=True)
res = []
def ok(c, m): res.append(bool(c)); print('PASS' if c else 'FAIL', m)
def ready(pg): pg.wait_for_function("() => !!document.querySelector('main') && !document.querySelector('.skelpage')", timeout=60000); pg.wait_for_timeout(900)
SKIP = "() => { try { if (sessionStorage.getItem('t_seeded')) return; sessionStorage.setItem('t_seeded', '1'); const w = JSON.parse(localStorage.getItem('hiphi_wiz') || '{}'); localStorage.setItem('hiphi_wiz', JSON.stringify({ ...w, done: true, step: 99 })); for (const k of ['hiphi_tour_bill', 'hiphi_tour_home', 'hiphi_tour_bill_demo', 'hiphi_tour_home_demo']) localStorage.setItem(k, '{\"how\":\"test\"}'); for (const k of ['hiphi_text', 'hiphi_text_demo']) localStorage.setItem(k, JSON.stringify({ token: 'test-token', phone: '8085550142', at: '2026-02-01T00:00:00.000Z' })); } catch {} }"
me = lambda pg: pg.evaluate("() => JSON.parse(localStorage.getItem('hiphi_me_demo') || '{}')")
live = lambda pg: pg.locator('#pf-live').inner_text() if pg.locator('#pf-live').count() else ''

with sync_playwright() as p:
    br = p.chromium.launch()
    for name, vp, mob in (('phone', {'width': 390, 'height': 844}, True), ('laptop', {'width': 1280, 'height': 860}, False)):
        ctx = br.new_context(viewport=vp, is_mobile=mob, has_touch=mob); ctx.add_init_script(f"({SKIP})()")
        pg = ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(BASE + '#/recap'); ready(pg)   # the practice letters are kept once a page has loaded
        # Two stories on the device: one for any issue and one about the first issue the page knows.
        iss = pg.evaluate("async () => { const k = await import('./pub/core.js'); return (k.S.issues || [])[0] || null; }")
        iid, iname = (iss or {}).get('id', ''), (iss or {}).get('name', '')
        pg.evaluate("([id]) => { const m = JSON.parse(localStorage.getItem('hiphi_me_demo') || '{}'); m.story = 'My son started at twelve.'; m.stories = { [id]: 'I walk this crossing every day.' }; localStorage.setItem('hiphi_me_demo', JSON.stringify(m)); }", [iid])
        pg.goto(BASE + '#/profile'); pg.reload(); ready(pg)

        # 1. Stories: a Delete under each saved one.
        ok(pg.locator('[data-pf-stdel]').count() == 2, f'{name}: both saved stories have "Delete this story" ({pg.locator("[data-pf-stdel]").count()})')
        pg.locator(f'[data-pf-stdel="{iid}"]').click(); pg.wait_for_timeout(500)
        g = pg.locator('.pf-stgone')
        ok(g.count() == 1 and f'Your story about “{iname}” is deleted.' in g.inner_text(), f'{name}: the issue story is deleted, said in its place ({g.inner_text()[:80] if g.count() else ""!r})')
        ok(iid not in (me(pg).get('stories') or {}), f'{name}: it is gone from this phone at once, no Save needed')
        ok(pg.locator('.actionbar [data-pf-save]').count() == 0, f'{name}: no "unsaved changes" bar after a delete')
        ok(pg.evaluate("() => document.activeElement?.matches?.('[data-pf-stundo]')"), f'{name}: focus is on Undo')
        pg.locator('[data-pf-stdel=""]').click(); pg.wait_for_timeout(500)
        ok(pg.locator('.pf-stgone').count() == 2 and pg.locator(f'[data-pf-stundo="{iid}"]').count() == 1, f'{name}: a second delete keeps the first one\'s Undo')
        pg.locator('[data-pf-stundo=""]').click(); pg.wait_for_timeout(500)
        ok(me(pg).get('story') == 'My son started at twelve.' and pg.locator('.pf-stgone').count() == 1, f'{name}: each Undo brings back its own story')
        if name == 'phone': g.scroll_into_view_if_needed(); pg.screenshot(path=os.path.join(OUT, f'story-gone-{name}.png'))
        pg.locator(f'[data-pf-stundo="{iid}"]').click(); pg.wait_for_timeout(500)
        ok((me(pg).get('stories') or {}).get(iid) == 'I walk this crossing every day.' and pg.locator(f'#pf-st-{iid}').input_value() == 'I walk this crossing every day.', f'{name}: Undo brings the story back, box and phone')
        ok(pg.evaluate("() => document.activeElement?.matches?.('[data-pf-stdel]')"), f'{name}: after Undo, focus is on its Delete, not the box (no keyboard)')
        pg.locator('[data-pf-stdel=""]').click(); pg.wait_for_timeout(500)
        ok('Your story is deleted.' in pg.locator('.pf-stgone').first.inner_text() and not me(pg).get('story') and pg.locator('#pf-st-any').input_value() == '', f'{name}: the story for any issue deletes too (its box stays, empty)')
        pg.reload(); ready(pg)
        ok(pg.locator('.pf-stgone').count() == 0 and pg.locator('#pf-st-any').input_value() == '' and pg.locator('[data-pf-stdel]').count() == 1, f'{name}: after a reload it stays deleted and the Undo has gone')

        # 2. Letters: a Delete beside each row.
        n0 = pg.locator('#pf-letters .myl-item').count()
        ok(n0 == 2 and pg.locator('#pf-letters [data-myl-del]').count() == 2, f'{name}: each kept letter has its own Delete ({n0} rows)')
        ok(pg.locator('#pf-letters .row [data-myl-del]').count() == 0, f'{name}: the Delete sits beside the row, not inside its button')
        lbl = pg.locator('#pf-letters [data-myl-del="HB2121"], #pf-letters [data-myl-del]:not([data-myl-del^="email:"])').first.get_attribute('aria-label') or ''
        ok(lbl.startswith('Delete your copy of the letter on HB 2121'), f'{name}: the button says which letter ({lbl!r})')
        if name == 'phone': pg.locator('#pf-letters').scroll_into_view_if_needed(); pg.screenshot(path=os.path.join(OUT, f'letters-{name}.png'))
        pg.locator('#pf-letters [data-myl-del]:not([data-myl-del^="email:"])').first.click(); pg.wait_for_timeout(500)
        kept = [v for v in (me(pg).get('letters') or {}).values() if v.get('num') == 'HB2121' and v.get('kind') != 'email']
        ok(not kept and pg.locator('#pf-letters .myl-item').count() == 1, f'{name}: the letter is gone from the list and the phone')
        ok('Your copy of the letter on HB 2121 is deleted. The Capitol still has the one you sent.' in pg.locator('#pf-letters .myl-gone').inner_text(), f'{name}: "Your copy of the letter on HB 2121 is deleted. The Capitol still has the one you sent." with Undo')
        ok(pg.evaluate("() => document.activeElement?.matches?.('[data-myl-undo]')"), f'{name}: focus is on Undo')
        if name == 'phone': pg.screenshot(path=os.path.join(OUT, f'letter-gone-{name}.png'))
        pg.locator('#pf-letters [data-myl-undo]').click(); pg.wait_for_timeout(500)
        ok(pg.locator('#pf-letters .myl-item').count() == 2 and pg.locator('#pf-letters .myl-gone').count() == 0, f'{name}: Undo puts it back in the list')
        pg.locator('#pf-letters [data-myl]:not([data-myl^="email:"])').first.click(); pg.wait_for_selector('#hp-dlg', timeout=15000); pg.wait_for_timeout(600)
        ok('Your letter on HB 2121' in pg.locator('#hp-dlg').inner_text(), f'{name}: the letter brought back still opens')
        pg.locator('#hp-dlg [data-hp="close"]').first.click(); pg.wait_for_timeout(500)
        pg.locator('#pf-letters [data-myl-del^="email:"]').click(); pg.wait_for_timeout(400)
        ok('Your copy of the email on HB 1563 is deleted. The people you wrote to still have it.' in pg.locator('#pf-letters .myl-gone').inner_text(), f'{name}: the email deletes on its own')
        pg.goto(BASE + '#/recap'); ready(pg); pg.goto(BASE + '#/profile'); ready(pg)
        ok(pg.locator('#pf-letters .myl-gone').count() == 0 and pg.locator('#pf-letters .myl-item').count() == 1, f'{name}: after leaving the page the Undo has gone and the email stays deleted')

        # 3. The profile kept on this phone: Delete my profile.
        ok(pg.locator('[data-mr-del="ask"]').count() == 1 and 'Delete my profile' in pg.locator('[data-mr-del="ask"]').inner_text(), f'{name}: a phone-only profile has "Delete my profile"')
        pg.locator('[data-mr-del="ask"]').click(); pg.wait_for_timeout(500)
        t = pg.locator('.mr-confirm').inner_text() if pg.locator('.mr-confirm').count() else ''
        ok('Delete your profile for good?' in t and 'stops your text alerts' in t and 'stay with the Capitol' in t and 'can’t be undone' in t, f'{name}: it asks on the page and says what goes')
        ok(pg.evaluate("() => document.activeElement?.id === 'mr-del-t'"), f'{name}: focus moves to the question')
        if name == 'phone': pg.screenshot(path=os.path.join(OUT, f'profile-ask-{name}.png'))
        pg.locator('[data-mr-del="no"]').click(); pg.wait_for_timeout(400)
        ok(pg.locator('.mr-confirm').count() == 0 and pg.evaluate("() => !!localStorage.getItem('hiphi_text_demo')"), f'{name}: "Keep my profile" backs out, nothing deleted')
        pg.locator('[data-mr-del="ask"]').click(); pg.wait_for_timeout(300)
        pg.locator('[data-mr-del="yes"]').click(); pg.wait_for_timeout(1200)
        st = pg.evaluate("() => ({ text: localStorage.getItem('hiphi_text_demo'), me: JSON.parse(localStorage.getItem('hiphi_me_demo') || '{}'), watch: localStorage.getItem('hiphi_watch_ids_demo'), hash: location.hash })")
        ok(not st['text'] and not st['me'].get('letters') and not st['me'].get('stories') and not st['watch'], f'{name}: the number, letters, stories and follows are gone from the phone')
        ok(st['hash'] in ('', '#/', '#') or st['hash'].startswith('#/start'), f'{name}: it lands on Home, or the first visit as deleting an account does ({st["hash"]!r})')
        pg.goto(BASE + '#/profile'); ready(pg)
        ok('Make your profile' in pg.locator('main').inner_text(), f'{name}: the profile page invites a new one')
        ok(not errs, f'{name}: no page errors {errs[:2]}')
        ctx.close()
    br.close()
print(f'{sum(res)}/{len(res)} passed'); sys.exit(0 if all(res) else 1)
