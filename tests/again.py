# Testifying again on a bill (R-148; backend migration 124): a letter sent is kept, offered again for the bill's next
# hearing re-addressed, after a check of what changed (each draft's note; amber when staff ticked a draft, HIPHI's
# position moved, or a point used changed); and Staff v2's tick on a draft note, Claude's suggestion of it, and the to-do.
# In the sandbox (frozen 16 March 2026): HB 2121 was heard in House Health on 18 Feb (House draft 1) and comes to Senate
# Health and Commerce on 20 Mar (House draft 2, ticked in demo/drafts.json). ?letter plants the 18 Feb letter.
#   python3 tests/again.py [base]     base defaults to http://localhost:8832
import sys, json
from playwright.sync_api import sync_playwright
BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832').rstrip('/')
res = []
def ok(c, m): res.append(bool(c)); print('PASS' if c else 'FAIL', m)
SKIP = "() => { try { localStorage.setItem('hiphi_wiz_demo', JSON.stringify({ done: true, step: 99 })); localStorage.setItem('hiphi_tour_bill_demo', '{\"how\":\"test\"}'); localStorage.setItem('hiphi_tour_home_demo', '{\"how\":\"test\"}'); localStorage.setItem('hiphi_wiz', JSON.stringify({ done: true, step: 99 })); localStorage.setItem('hiphi_tour_bill', '{\"how\":\"test\"}'); localStorage.setItem('hiphi_tour_home', '{\"how\":\"test\"}'); } catch {} }"
HB2121 = '2455257b-07a6-41c9-9745-94f174d78442'
HLT = 'd58d4bdb-6322-47d0-8852-b36eeb8b3c4e'      # House Health, 18 Feb
CPN = '6585adbd-60ab-4eb3-a0b7-303405b87be5'      # Senate Health and Commerce, 20 Mar
def plant(**kw):
    L = { 'v': 1, 'bill': HB2121, 'num': 'HB2121', 'nick': '', 'yr': 2026, 'h': HLT, 'code': 'HLT', 'at': '2026-02-18T20:00:00.000Z', 'sent': '2026-02-17T20:00:00.000Z',
          'draft': 'HD1', 'stance': 'support', 'ours': True, 'pos': 'strongly_support', 'name': 'Test Person', 'why': 'My kids see e-cigarettes at school.',
          'points': [], 'pointsText': '', 'closing': 'Mahalo', 'letter': '', 'edited': False }
    L.update(kw)
    me = { 'name': 'Test Person', 'capitolAcct': True, 'letters': { HB2121: L } }
    return f"() => {{ try {{ localStorage.setItem('hiphi_me_demo', {json.dumps(json.dumps(me))}); }} catch {{}} }}"
def open_again(pg, url='/track.html?demo=1#/bill/HB2121'):
    pg.goto(BASE + url); pg.wait_for_selector('.bl-head', timeout=60000); pg.wait_for_timeout(1500)
    pg.locator('[data-bl-go="testify"]').first.click(); pg.wait_for_selector('#hp-dlg .hp-body', timeout=10000); pg.wait_for_timeout(700)
def body(pg): return pg.locator('#hp-dlg .hp-body').inner_text()
def foot(pg): return pg.locator('#hp-dlg .hp-foot').inner_text()
def stored(pg): return pg.evaluate("() => (JSON.parse(localStorage.getItem('hiphi_me') || '{}').letters || {})")
def no_tick(route):   # demo/drafts.json without staff's tick, for the calm case
    r = route.fetch(); d = r.json()
    for x in d: x.pop('changes_letters', None)
    route.fulfill(response=r, body=json.dumps(d), headers={**r.headers, 'content-type': 'application/json'})

with sync_playwright() as p:
    br = p.chromium.launch()
    for w, h, tag in ((390, 844, 'phone'), (1280, 900, 'laptop')):
        def ctx_for(*scripts, route=None):
            c = br.new_context(viewport={'width': w, 'height': h}, is_mobile=(w < 600)); c.add_init_script(f"({SKIP})()")
            for s in scripts: c.add_init_script(f"({s})()")
            if route: c.route('**/demo/drafts.json*', route)
            pg = c.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e))); return c, pg, errs

        # ---- the amber case: House draft 2 is ticked; the planted letter was for House draft 1 ----
        c, pg, errs = ctx_for(route=None)
        pg.goto(BASE + '/track.html?demo=1&letter=1#/bill/HB2121'); pg.wait_for_selector('.bl-head', timeout=60000); pg.wait_for_timeout(1500)
        ok('Send my letter again' in pg.locator('[data-bl-go="testify"]').first.inner_text(), f'{tag}: the bill page offers "Send my letter again"')
        pg.locator('[data-bl-go="testify"]').first.click(); pg.wait_for_selector('#hp-dlg .hp-body'); pg.wait_for_timeout(800)
        t = body(pg)
        ok('Your letter needs a check' in t and 'Your letter is ready' not in t and 'Feb 18' in t and 'Fri, Mar 20' in t, f'{tag}: amber: "Your letter needs a check", when they wrote and the next hearing')
        ok('What changed' in t and 'House draft 2' in t and 'HIPHI’s advice' in t, f'{tag}: the ticked draft turns it amber, with what changed and HIPHI’s advice')
        ok('Testimony due Wed, Mar 18 at 9:30 AM' in t, f'{tag}: the deadline carries its date, so two weekdays are never side by side')
        ok('Part 1 of 3' in pg.locator('#hp-dlg .hp-count').inner_text(), f'{tag}: three parts: ready, the letter, the Capitol (no account step)')
        f = foot(pg)
        ok('Check my letter' in f and 'Start a new letter' in f and 'Use my letter' not in f, f'{tag}: amber: "Check my letter" leads, "Start a new letter" beside it')
        ok(pg.locator('#hp-again-warn [data-hp="again-update"]').count() == 1, f'{tag}: going over the bill again is a link in the box')
        pg.click('[data-hp="again-use"]'); pg.wait_for_timeout(500)
        letter = pg.locator('#hp-letter').input_value()
        ok('Senate Health and Human Services Committee' in letter and 'Fri, Mar 20, 2026' in letter and 'Dear Chair San Buenaventura' in letter, f'{tag}: the letter is addressed to the new committee, chairs and date')
        ok('Before you send, check your letter' in body(pg), f'{tag}: the letter screen repeats the warning above the letter')
        pg.click('[data-hp="back"]'); pg.wait_for_timeout(400)
        ok('Your letter needs a check' in body(pg), f'{tag}: Back returns to the first screen')
        pg.click('[data-hp="again-update"]'); pg.wait_for_timeout(500)
        t = body(pg)
        ok('Update your letter' in t and 'HIPHI’s advice' in t, f'{tag}: going over it again walks the bill step with HIPHI’s advice at the top')
        ok('Disposable e-cigarettes are easy' in pg.locator('#hp-pts').input_value(), f'{tag}: their points are in the box')
        pg.click('[data-hp="next"]'); pg.wait_for_timeout(400)
        ok('As a parent of two teenagers' in pg.locator('#hp-why').input_value(), f'{tag}: their reason is filled in')
        pg.locator('#hp-form button[type=submit], .hp-foot button[type=submit]').first.click(); pg.wait_for_timeout(500)
        pg.click('[data-hp="next"]'); pg.wait_for_timeout(400)
        ok('Send it at the Capitol' in body(pg), f'{tag}: then the Capitol step')
        pg.click('[data-hp="sent"]'); pg.wait_for_timeout(1500)
        L = stored(pg).get(HB2121, {})
        ok(L.get('h') == CPN and L.get('draft') == 'HD2' and L.get('code') == 'HHS/CPN' and not L.get('demo'), f'{tag}: once sent, the kept letter is this hearing’s (draft {L.get("draft")}, {L.get("code")})')
        ok(not errs, f'{tag}: no page errors (amber) ' + '; '.join(errs[:2])); c.close()

        # ---- the calm case: no tick, so a new draft is a blue note; the same draft is a green line ----
        c, pg, errs = ctx_for(plant(), route=no_tick); open_again(pg)
        t = body(pg)
        ok('The bill has changed since you wrote this' in t and 'House draft 2' in t and 'needs a check' not in t and 'Your letter is ready' in t, f'{tag}: an unticked new draft is a calm note with what changed')
        ok('Use my letter' in foot(pg), f'{tag}: and "Use my letter" leads')
        c.close()
        c, pg, errs = ctx_for(plant(draft='HD2'), route=no_tick); open_again(pg)
        ok('hasn’t changed since you wrote this' in body(pg), f'{tag}: the same draft says the bill hasn’t changed')
        c.close()

        # ---- HIPHI's position moved since a letter in HIPHI's words: amber ----
        c, pg, errs = ctx_for(plant(draft='HD2', pos='support_amend'), route=no_tick); open_again(pg)
        ok('Your letter needs a check' in body(pg) and 'HIPHI’s position changed' in body(pg), f'{tag}: a changed HIPHI position turns it amber')
        c.close()

        # ---- a letter rewritten by hand keeps every word; its top and greeting are this hearing's ----
        mine = 'Testimony in SUPPORT of HB 2121\nHouse Health Committee\nHearing: Wed, Feb 18, 2026 at 10:00 AM, Room 329\n\nDear Chair Takayama, Vice Chair Keohokapu-Lee Loy, and members of the committee,\n\nI strongly support HB 2121. My name is Test Person.\n\nI said this to you on Wed, Feb 18 and I say it again: my kids see e-cigarettes at school.\n\nMahalo,\nTest Person'
        c, pg, errs = ctx_for(plant(draft='HD2', letter=mine, edited=True), route=no_tick); open_again(pg)
        pg.click('[data-hp="again-use"]'); pg.wait_for_timeout(500)
        letter = pg.locator('#hp-letter').input_value()
        ok('Senate Health and Human Services Committee' in letter and 'House Health Committee' not in letter and 'Dear Chair San Buenaventura' in letter and 'Dear Chair Takayama' not in letter,
           f'{tag}: a hand-written letter gets the new top and greeting')
        ok('I said this to you on Wed, Feb 18 and I say it again' in letter, f'{tag}: and keeps the person’s own words')
        ok('Your letter mentions “Wed, Feb 18”' in body(pg), f'{tag}: a sentence naming the old hearing day is pointed out')
        c.close()

        # ---- a new letter, or the saved one deleted ----
        c, pg, errs = ctx_for(plant(), route=no_tick); open_again(pg)
        pg.click('[data-hp="again-new"]'); pg.wait_for_timeout(500)
        # A new letter asks where they stand (R-167, 10/5), the kept letter's answer chosen; Next goes on to the bill
        ok('Where do you stand' in body(pg) and pg.locator('#hp-dlg [data-hp="stance"][data-v="support"]').get_attribute('aria-pressed') == 'true',
           f'{tag}: "Start a new letter" asks where they stand, the kept letter\'s "I support it" chosen')
        pg.click('#hp-dlg .hp-foot [data-hp="next"]'); pg.wait_for_timeout(500)
        ok('Get to know the bill' in body(pg) and pg.locator('#hp-pts').count() == 0, f'{tag}: and Next goes on to the bill with nothing picked')
        ok(HB2121 in stored(pg), f'{tag}: and keeps the saved letter')
        c.close()
        c, pg, errs = ctx_for(plant(), route=no_tick); open_again(pg)
        ok(pg.locator('[data-hp="again-forget"]').count() == 0, f'{tag}: delete is not on the first screen')
        pg.click('[data-hp="again-use"]'); pg.wait_for_timeout(400); pg.click('[data-hp="again-forget"]'); pg.wait_for_timeout(500)
        ok(HB2121 not in stored(pg) and 'Where do you stand' in body(pg) and 'Your saved letter is deleted' in body(pg), f'{tag}: "Delete my saved letter" deletes it and starts a new one, saying so')
        pg.click('[data-hp="again-undo"]'); pg.wait_for_timeout(600)
        ok(HB2121 in stored(pg) and 'Your letter is ready' in body(pg), f'{tag}: Undo brings the letter back (B-5)')
        c.close()
        # the card says when they wrote; the button says it is ready (A-14)
        c, pg, errs = ctx_for(plant(), route=no_tick)
        pg.goto(BASE + '/track.html?demo=1#/issue/disposable-e-cigarette-ban'); pg.wait_for_timeout(3000)
        card = pg.locator('.acard:has(.again)').first
        ok(card.count() == 1 and 'You wrote testimony on this bill on Feb 18.' in card.inner_text() and 'Send my letter again' in card.inner_text(), f'{tag}: the card says when they wrote, and its button "Send my letter again"')
        ok(not errs, f'{tag}: no page errors (cases) ' + '; '.join(errs[:2])); c.close()

        # ---- Staff v2: the tick, Claude's suggestion, Undo ----
        c = br.new_context(viewport={'width': w, 'height': h}, is_mobile=(w < 600)); pg = c.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(BASE + '/staff.html?demo=1#/bill/SB2175/public'); pg.wait_for_selector('section[aria-labelledby=bw-dr-h] .bw-drrow', timeout=60000)
        first = pg.locator('.bw-drrow').first
        ok('Claude suggests warning people who wrote on an earlier draft' in first.inner_text() and 'Warn letter writers' in first.inner_text(), f'{tag}: Claude’s suggestion shows with "Warn letter writers"')
        first.locator('[data-drtick]').click(); pg.wait_for_timeout(800)
        ok('People who wrote on an earlier draft are warned' in pg.locator('.bw-drrow').first.inner_text() and pg.locator('.toastmsg .toastundo').count() == 1, f'{tag}: "Warn letter writers" ticks it, with Undo')
        pg.locator('.toastmsg .toastundo').click(); pg.wait_for_timeout(800)
        ok('Claude suggests' in pg.locator('.bw-drrow').first.inner_text(), f'{tag}: Undo takes the tick back')
        pg.locator('.bw-drrow').nth(1).locator('[data-dredit]').click(); pg.wait_for_selector('#bw-drbig')
        ok(not pg.locator('#bw-drbig').is_checked() and not pg.locator('#bw-drln').is_visible(), f'{tag}: the sheet’s tick starts as the note is (unticked), the advice box hidden until it is')
        pg.check('#bw-drbig'); pg.fill('#bw-drln', 'If you wrote that it changed nothing, that is still true.'); pg.click('[data-drsave]'); pg.wait_for_timeout(900)
        t = pg.locator('.bw-drrow').nth(1).inner_text()
        ok('are warned' in t and 'still true' in t, f'{tag}: the sheet saves the tick and HIPHI’s advice')
        pg.goto('about:blank'); pg.goto(BASE + '/staff.html?demo=1#/bill/HB2121/public?focus=drafts'); pg.wait_for_selector('.bw-drrow', timeout=60000); pg.wait_for_timeout(600)
        ok('are warned' in pg.locator('.bw-drrow').first.inner_text(), f'{tag}: HB 2121’s House draft 2 shows staff’s tick')
        pg.wait_for_timeout(600)
        ok(pg.evaluate("() => document.activeElement && document.activeElement.id") == 'bw-dr-h' and pg.evaluate("() => { const r = document.getElementById('bw-dr-h').getBoundingClientRect(); return r.top >= 0 && r.top < innerHeight; }"), f'{tag}: ?focus=drafts lands on the draft notes')
        # Today: a new draft of a public bill with a hearing this week and no note becomes "Say what ... changed"
        pg.goto('about:blank'); pg.goto(BASE + '/staff.html?demo=1#/'); pg.wait_for_timeout(5000)
        say = pg.locator('text=/Say what (House|Senate) draft \\d+ \\((HD|SD)\\d+\\) changed/')
        ok(say.count() >= 1, f'{tag}: Today lists "Say what ... changed" for a new draft with no note ({say.count()})')
        ok(not errs, f'{tag}: no page errors (staff) ' + '; '.join(errs[:2])); c.close()
    br.close()
print(f'{sum(res)}/{len(res)} passed'); sys.exit(0 if all(res) else 1)
