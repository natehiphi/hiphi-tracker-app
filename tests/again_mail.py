# Emails offered again (R-153; backend migration 126): every email the walkthrough writes is kept beside the testimony letter,
# offered again at the bill's next step, re-addressed, with R-148's check; either kind can start from the other's answers;
# and one short reminder to the same chair a week before the bill's deadline. In the sandbox (16 March 2026): HB 1563 waits
# for a hearing in Senate HHS/EIG after House FIN (?email plants a 25 Feb email to FIN; &remind instead a 9 Mar one to
# HHS/EIG and moves its deadline to Fri 20 Mar). HB 2121 has a hearing on 20 Mar, on House draft 2 (ticked).
# R-167 (Nate 10/5): each begins with "Where do you stand?", the earlier answer chosen and where it came from.
#   python3 tests/again_mail.py [base]     base defaults to http://localhost:8832
import sys, json
from playwright.sync_api import sync_playwright
BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832').rstrip('/')
res = []
def ok(c, m): res.append(bool(c)); print('PASS' if c else 'FAIL', m)
SKIP = "() => { try { localStorage.setItem('hiphi_wiz_demo', JSON.stringify({ done: true, step: 99 })); localStorage.setItem('hiphi_tour_bill_demo', '{\"how\":\"test\"}'); localStorage.setItem('hiphi_tour_home_demo', '{\"how\":\"test\"}'); } catch {} }"
HB1563 = 'b4da66dc-b9e3-4c64-85f8-6d4ffd122ebd'
HB2121 = '2455257b-07a6-41c9-9745-94f174d78442'
def rec(bill, num, **kw):
    L = { 'v': 1, 'bill': bill, 'num': num, 'nick': '', 'yr': 2026, 'sent': '2026-02-25T20:00:00.000Z', 'stance': 'support', 'ours': True,
          'pos': 'support', 'name': 'Test Person', 'why': 'My kids see it every day.', 'points': [], 'pointsText': '', 'closing': 'Mahalo',
          'letter': '', 'edited': False }
    L.update(kw); return L
def plant(letters, done=()):
    me = { 'name': 'Test Person', 'capitolAcct': True, 'letters': letters }
    return f"() => {{ try {{ localStorage.setItem('hiphi_me_demo', {json.dumps(json.dumps(me))}); localStorage.setItem('hiphi_done_demo', {json.dumps(json.dumps(list(done)))}); }} catch {{}} }}"
def body(pg): return pg.locator('#hp-dlg .hp-body').inner_text()
def past_stand(pg, what=''):
    # R-167: "Where do you stand?" first, an answer chosen and where it came from; Next goes on
    sub = pg.locator('#hp-dlg .hp-standsub').inner_text() if pg.locator('#hp-dlg .hp-standsub').count() else ''
    ok('Where do you stand' in body(pg) and pg.locator('#hp-dlg [data-hp="stance"][aria-pressed="true"]').count() == 1 and ('said you support it.' in sub or 'You marked Support on the bill page.' in sub),
       f'{tag}: {what}begins with "Where do you stand?", the answer chosen and where it came from ({sub[:46]!r})')
    pg.click('#hp-dlg .hp-foot [data-hp="next"]'); pg.wait_for_timeout(700)
def stored(pg): return pg.evaluate("() => (JSON.parse(localStorage.getItem('hiphi_me_demo') || '{}').letters || {})")

with sync_playwright() as p:
    br = p.chromium.launch()
    for w, h, tag in ((390, 844, 'phone'), (1280, 900, 'laptop')):
        def ctx(*scripts):
            c = br.new_context(viewport={'width': w, 'height': h}, is_mobile=(w < 600)); c.add_init_script(f"({SKIP})()")
            for s in scripts: c.add_init_script(f"({s})()")
            pg = c.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e))); return c, pg, errs
        def bill(pg, num, q=''):
            pg.goto(f'{BASE}/track.html?demo=1{q}#/bill/{num}'); pg.wait_for_selector('.bl-head', timeout=60000); pg.wait_for_timeout(1500)

        # ---- the ask for a hearing, again, at the bill's next committee ----
        c, pg, errs = ctx(); bill(pg, 'HB1563', '&email=1')
        m = pg.locator('[data-bl-main="ask"]').first
        ok(m.count() == 1 and 'Send my email to the Senate chairs' in m.inner_text(), f'{tag}: the ask for a hearing reads "Send my email to the Senate chairs"')
        m.click(); pg.wait_for_selector('#hp-dlg .hp-body'); pg.wait_for_timeout(800)
        past_stand(pg, 'the email again ')
        t = body(pg)
        ok('Your email is ready' in t and 'HB 1563 passed the House' in t and 'Feb 25 email to the two Senate chairs who decide on its hearing' in t, f'{tag}: "Your email is ready": why it is back and who decides now')
        ok('If it isn’t heard by Mon, Mar 30, it stops for this year.' in t and 'Waiting for a hearing' not in t, f'{tag}: then only the deadline')
        ok('The bill has changed since you wrote this' in t and 'We haven’t summed up what House draft 2 changed yet. HIPHI strongly supports the bill as it is now.' in t, f'{tag}: a new draft with no note: where HIPHI stands now')
        ok('Part 2 of 4' in pg.locator('#hp-dlg .hp-count').inner_text() and 'Use my email' in pg.locator('#hp-dlg .hp-foot').inner_text(), f'{tag}: 4 parts; "Use my email" leads')
        pg.click('[data-hp="again-use"]'); pg.wait_for_timeout(500)
        letter = pg.locator('#hp-letter').input_value()
        ok(letter.startswith('Dear Chair San Buenaventura and Chair Wakai,') and 'Our county should be able to protect kids' in letter and 'give HB 1563 a hearing' in letter and 'Mon, Mar 30' in letter,
           f'{tag}: the email is addressed to them, their words kept, the ask and deadline this committee’s')
        ok(pg.locator('#hp-subject').input_value() == 'HB 1563: please give it a hearing', f'{tag}: the subject is this step’s')
        pg.click('[data-hp="next"]'); pg.wait_for_timeout(400); pg.click('[data-hp="mailsent"]'); pg.wait_for_timeout(1200)
        L = stored(pg).get('email:' + HB1563, {})
        ok(L.get('key') == 'email|HHS/EIG' and L.get('draft') == 'HD2' and L.get('parts') and not L.get('demo'), f'{tag}: once sent, the kept email is this step’s ({L.get("key")})')
        ok(not errs, f'{tag}: no page errors (ask) ' + '; '.join(errs[:2])); c.close()

        # ---- an email written from their testimony letter ----
        c, pg, errs = ctx(plant({ HB1563: rec(HB1563, 'HB1563', h='x', code='FIN', at='2026-03-04T20:00:00.000Z', draft='HD2') }, [f'{HB1563}|FIN|ask']))
        bill(pg, 'HB1563'); pg.locator('[data-bl-main="ask"]').first.click(); pg.wait_for_selector('#hp-dlg .hp-body'); pg.wait_for_timeout(800)
        past_stand(pg, 'an email from their testimony ')
        t = body(pg)
        # (its HIPHI position may differ from the planted letter's, which turns it amber: either heading is right here)
        ok(('Your email is ready' in t or 'Your email needs a check' in t) and 'from your Feb 25 testimony on HB 1563' in t, f'{tag}: their testimony letter’s answers start the email')
        pg.click('[data-hp="again-use"]'); pg.wait_for_timeout(500)
        ok('My kids see it every day.' in pg.locator('#hp-letter').input_value(), f'{tag}: with their reason')
        c.close()

        # ---- a letter written from their email (amber: House draft 2 is ticked) ----
        c, pg, errs = ctx(plant({ 'email:' + HB2121: rec(HB2121, 'HB2121', kind='email', mode='email', key='email|HLT', code='HLT', draft='HD1', pos='strongly_support') }))
        bill(pg, 'HB2121')
        ok('Write my testimony' in pg.locator('[data-bl-go="testify"]').first.inner_text(), f'{tag}: the testimony button stays "Write my testimony" (it was an email)')
        pg.locator('[data-bl-go="testify"]').first.click(); pg.wait_for_selector('#hp-dlg .hp-body'); pg.wait_for_timeout(900)
        past_stand(pg, 'a letter from their email ')
        t = body(pg)
        ok('Your letter needs a check' in t and 'from your Feb 25 email on HB 2121' in t and 'HIPHI’s advice' in t, f'{tag}: a letter from their email’s answers, with the check')
        pg.click('[data-hp="again-use"]'); pg.wait_for_timeout(500)
        lt = pg.locator('#hp-letter').input_value()
        ok(lt.startswith('Testimony in SUPPORT of HB 2121') and 'My kids see it every day.' in lt and 'Dear Chair' in lt, f'{tag}: written as testimony, never the email’s words')
        c.close()

        # ---- a hand-written email: every word kept, the greeting, who they are and the ask swapped ----
        old = { 'dear': 'Dear Chair Yamashita,', 'opening': 'I strongly support HB 1563. My name is Test Person.', 'ask': 'I respectfully ask you to give HB 1563 a hearing, so the public can weigh in. It needs one by Fri, Mar 6 to stay alive this session.' }
        mine = '\n\n'.join([old['dear'], old['opening'], 'Please, I have asked before and I will ask again.', old['ask'], 'Mahalo,\nTest Person'])
        c, pg, errs = ctx(plant({ 'email:' + HB1563: rec(HB1563, 'HB1563', kind='email', mode='email', key='email|FIN', code='FIN', draft='HD2', letter=mine, edited=True, parts=old) }, [f'{HB1563}|FIN|ask']))
        bill(pg, 'HB1563'); pg.locator('[data-bl-main="ask"]').first.click(); pg.wait_for_selector('#hp-dlg .hp-body'); pg.wait_for_timeout(800)
        past_stand(pg, 'a hand-written email ')
        pg.click('[data-hp="again-use"]'); pg.wait_for_timeout(500)
        letter = pg.locator('#hp-letter').input_value()
        ok(letter.startswith('Dear Chair San Buenaventura and Chair Wakai,') and 'Yamashita' not in letter, f'{tag}: a hand-written email gets the new greeting')
        ok('Please, I have asked before and I will ask again.' in letter, f'{tag}: and keeps their own words')
        ok('Mon, Mar 30' in letter and 'Fri, Mar 6' not in letter, f'{tag}: the ask is this committee’s, with its deadline')
        c.close()

        # ---- the reminder to the same chairs ----
        c, pg, errs = ctx(); bill(pg, 'HB1563', '&email=1&remind=1')
        m = pg.locator('[data-bl-main]').first
        ok('Follow up with the chairs' in m.inner_text(), f'{tag}: a week before the deadline, the bill offers "Follow up with the chairs"')
        m.click(); pg.wait_for_selector('#hp-dlg .hp-body'); pg.wait_for_timeout(800)
        past_stand(pg, 'the follow-up ')
        t = body(pg); letter = pg.locator('#hp-letter').input_value()
        ok('Your follow-up' in t and 'still has no hearing, and Fri, Mar 20 is the last day for one' in t and 'Part 2 of 3' in pg.locator('#hp-dlg .hp-count').inner_text(), f'{tag}: the follow-up says why, then the email: 3 parts')
        ok('I wrote to you on Mon, Mar 9 to ask you to give HB 1563 a hearing' in letter and 'its deadline is Fri, Mar 20' in letter and 'schedule it before then' in letter, f'{tag}: it says when they wrote, the deadline, one ask')
        ok(pg.locator('#hp-subject').input_value() == 'HB 1563: please hear it by Mar 20' and pg.locator('#hp-dlg .hp-foot [data-hp="back"]').count() == 1, f'{tag}: a short subject; Back goes to where they stand')
        pg.click('[data-hp="next"]'); pg.wait_for_timeout(400); pg.click('[data-hp="mailsent"]'); pg.wait_for_timeout(1200)
        ok('You followed up with' in pg.locator('.hp-hero').inner_text(), f'{tag}: "You followed up with …"')
        ok(stored(pg).get('email:' + HB1563, {}).get('sent', '').startswith('2026-03-09'), f'{tag}: the kept email is still the one it followed up, not the reminder')
        pg.click('[data-hp="done"]'); pg.wait_for_timeout(800)
        ok('Follow up' not in (pg.locator('[data-bl-main]').first.inner_text() if pg.locator('[data-bl-main]').count() else ''), f'{tag}: one follow-up only')
        c.close()
        # never the morning after: an email to these chairs only two days old gets no follow-up yet (P-5)
        fresh = rec(HB1563, 'HB1563', kind='email', mode='email', key='email|HHS/EIG', code='HHS/EIG', draft='HD2', sent='2026-03-14T20:00:00.000Z')
        c, pg, errs = ctx(plant({ 'email:' + HB1563: fresh }, [f'{HB1563}|HHS/EIG|ask', f'{HB1563}||email'])); bill(pg, 'HB1563', '&email=1&remind=1')
        ok('Follow up' not in (pg.locator('[data-bl-main]').first.inner_text() if pg.locator('[data-bl-main]').count() else ''), f'{tag}: an email two days old is never followed up yet')
        ok(not errs, f'{tag}: no page errors (reminder) ' + '; '.join(errs[:2])); c.close()
    br.close()
print(f'{sum(res)}/{len(res)} passed'); sys.exit(0 if all(res) else 1)
