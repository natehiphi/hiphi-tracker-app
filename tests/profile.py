# Your profile (R-147) in the sandbox, phone and laptop: More's first row, the invitation (a number or an email makes the
# profile), About you with the "I'm a..." picker (tap, More titles, the student choice, typing, their own words), the
# story, How you'll help, the initials on the More tab and the laptop header, #/settings opening the profile, and the
# letters: the two titles that fit the bill, "I live in Hilo, in Senator X's district" only when their own legislator
# is on the committee, an email to a chair who is not theirs saying nothing about where they live.
#   python3 tests/profile.py [base]     base defaults to http://localhost:8832/track.html?demo=1
import sys, os
from playwright.sync_api import sync_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832/track.html?demo=1'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out'); os.makedirs(OUT, exist_ok=True)
res = []
def ok(c, m): res.append(bool(c)); print('PASS' if c else 'FAIL', m)
def ready(pg): pg.wait_for_function("() => !!document.querySelector('main') && !document.querySelector('.skelpage')", timeout=60000); pg.wait_for_timeout(600)
def text(pg, sel='#main'): return pg.locator(sel).first.inner_text() if pg.locator(sel).count() else ''
def shot(pg, name): pg.screenshot(path=os.path.join(OUT, f'profile_{name}.png'), full_page=False)
SKIP = "() => { try { const w = JSON.parse(localStorage.getItem('hiphi_wiz') || '{}'); localStorage.setItem('hiphi_wiz', JSON.stringify({ ...w, done: true, step: 99 })); localStorage.setItem('hiphi_tour_bill', '{\"how\":\"test\"}'); localStorage.setItem('hiphi_tour_home', '{\"how\":\"test\"}'); } catch {} }"
# HB 1523 (crossing during the countdown) and its next hearing; a committee member's Senate district; the chair's.
FIND = """async () => { const c = await import('./pub/core.js'); const b = c.D.bills.find(x => x.bill_number === 'HB1523');
  const h = c.D.hearings.filter(x => x.bill_id === b.id && new Date(x.scheduled_at) > Date.now()).sort((a, z) => a.scheduled_at.localeCompare(z.scheduled_at))[0];
  const ms = c.legsOf(h.committee).map(m => m.l); const mem = c.legsOf(h.committee).find(m => m.role === 'member' && m.l.chamber === 'S').l, chair = c.legsOf(h.committee).find(m => m.role === 'chair').l;
  return { b: b.id, h: h.id, mem: mem.district, memName: mem.name, chair: chair.district, notOn: [1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25].find(d => !ms.some(l => l.chamber === 'S' && +l.district === d)) }; }"""
def letter(pg, t, mode='testimony'):
    # Open the walkthrough, take the steps to About you, then the letter, and return it (or the About you step's state).
    pg.evaluate("async ([t, mode]) => { const c = await import('./pub/core.js'); if (mode === 'testimony') c.app.openHelper(t.b, t.h); else c.app.openMail({ mode: 'email', hearing: t.h, bill: t.b }); }", [t, mode])
    pg.wait_for_selector('#hp-dlg', timeout=15000); pg.wait_for_timeout(800)
    for _ in range(4):
        if pg.locator('#hp-form').count(): break
        st = pg.locator('#hp-dlg [data-hp="stance"][data-v="support"]')
        if st.count(): st.first.click(); pg.wait_for_timeout(500); continue
        pg.locator('#hp-dlg .hp-foot .hp-main').first.click(); pg.wait_for_timeout(600)
    return pg
def close(pg):
    pg.evaluate("async () => { const c = await import('./pub/core.js'); c.S.helper = null; try { sessionStorage.clear(); const k = Object.keys(localStorage).find(k => /hiphi_me/.test(k)); const m = JSON.parse(localStorage.getItem(k) || '{}'); delete m.mail; delete m.drafts; localStorage.setItem(k, JSON.stringify(m)); } catch {} c.app.render(); }")
    pg.wait_for_timeout(400)
def districts(pg, senate, label='Hilo'):
    pg.evaluate("([s, l]) => { const k = 'hiphi_districts' + (location.search.includes('demo=1') ? '_demo' : ''); localStorage.setItem(k, JSON.stringify({ senate: s, house: 2, label: l })); }", [senate, label])

with sync_playwright() as p:
    br = p.chromium.launch()
    ctx = br.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True); ctx.add_init_script(f"({SKIP})()")
    pg = ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))

    # 1. No profile: More invites; the invitation is the R-146 box; a number makes the profile
    pg.goto(BASE + '#/more'); ready(pg)
    me = pg.locator('#main > .mr > a.mr-me, #main a.mr-me').first
    ok(me.count() == 1 and 'Make your profile' in me.inner_text() and me.get_attribute('href') == '#/profile', 'More: the first row invites "Make your profile"')
    ok(pg.locator('.mr-me-in a[href="#/signin"]').count() == 1, 'and someone returning on a new phone can sign in from there')
    ok(pg.locator('#main a.row[href="#/settings"], #main [data-mr-signout]').count() == 0, 'More: no Settings or Sign out rows (they moved to the profile)')
    shot(pg, '1_more_invite')
    me.click(); pg.wait_for_timeout(1200)
    ok('Make your profile' in text(pg) and pg.locator('#pf-alf-phone').count() == 1 and pg.locator('a.al-swap[href="#/signin"]').count() == 1, 'the invitation: the phone box first, email as a link')
    pg.fill('#pf-alf-phone', '808 555 0147'); pg.click('#pf-al-send'); pg.wait_for_timeout(1200)
    ok(pg.locator('#pf-about').count() == 1 and '(808) ••• 0147' in text(pg, '.pf-head'), 'a number makes the profile; the header shows it masked')
    ok('Your profile is made' in text(pg, '.pf-made') and pg.locator('#toast .toast, .toast').filter(has_text='profile is made').count() == 0, '"Your profile is made" is said on the page, not in a toast over the form')
    ok(pg.locator('#pf-about [data-pf-edit="about"]').inner_text().strip() == 'Add', 'an empty section offers Add')
    ok(pg.locator('.tabs a[href="#/more"] .tab-av').count() == 1, 'the More tab carries the person (an icon before a name)')

    # 2. About you: name, tap, the student choice, More titles, typing a suggestion and their own words; Save
    pg.click('[data-pf-edit="about"]'); pg.wait_for_timeout(300)
    pg.fill('#pf-name', 'Leilani Kahale')
    ok(pg.locator('#pf-tp .tp-chips [data-tp]').count() == 7 and pg.locator('[data-tp-student]').count() == 1, 'the picker: seven titles and "student" shown first')
    pg.click('[data-tp="parent"]'); pg.click('[data-tp="teacher"]'); pg.wait_for_timeout(200)
    pg.click('[data-tp-student]'); pg.wait_for_timeout(150)
    ok(pg.locator('#pf-tps [data-tp]').count() == 2 and 'high school student' in text(pg, '#pf-tps'), 'student asks: high school or college')
    pg.click('[data-tp-student]'); pg.wait_for_timeout(150)
    pg.click('[data-tp-more]'); pg.wait_for_timeout(150)
    ok(pg.locator('.tp-gh').all_inner_texts() == ['Family and home', 'Health', 'School and youth', 'Work', 'Community and getting around'], 'More titles: the five groups')
    pg.click('#pf-tq'); pg.keyboard.type('coa'); pg.wait_for_timeout(200)
    opts = pg.locator('[data-tpo]').all_inner_texts()
    ok(opts[:1] == ['coach or youth leader'] and 'Add “coa” as your own' in opts[-1], f'typing "coa": the coach title, then their own words ({opts})')
    ok(pg.evaluate("document.activeElement && document.activeElement.id") == 'pf-tq', 'typing keeps the box focused (a phone keyboard stays up)')
    pg.fill('#pf-tq', ''); pg.keyboard.type('youth soccer coach'); pg.wait_for_timeout(150); pg.keyboard.press('Enter'); pg.wait_for_timeout(250)
    chosen = pg.locator('#pf-tp .tp-chips [aria-pressed="true"]').all_inner_texts()
    ok([c.strip() for c in chosen] == ['parent', 'teacher (kumu)', 'youth soccer coach'] and pg.input_value('#pf-tq') == '', f'Enter adds their own title and empties the box ({chosen})')
    shot(pg, '2_about_edit')
    pg.click('#pf-about-save'); pg.wait_for_timeout(600)
    t = text(pg, '#pf-about')
    ok('Leilani Kahale' in t and 'youth soccer coach' in t and 'Saved.' in t, 'Save: the name and titles show, with "Saved."')
    ok(pg.locator('.tabs a[href="#/more"] .tab-av').inner_text().strip() == 'LK' and 'LK' in text(pg, '.pf-head'), 'initials LK on the More tab and the profile')

    # 3. The story and How you'll help
    pg.click('[data-pf-edit="story"]'); pg.wait_for_timeout(300)
    pg.fill('#pf-storyt', 'As a mom of two teenagers in Hilo, I see how easy vapes are to get.'); pg.check('#pf-quote'); pg.click('#pf-story-save'); pg.wait_for_timeout(500)
    ok('mom of two teenagers' in text(pg, '#pf-story') and 'quote me: Yes' in text(pg, '#pf-story'), 'the story is saved, and "HIPHI may quote me: Yes"')
    pg.click('[data-pf-edit="help"]'); pg.wait_for_timeout(300); pg.check('#pf-int-volunteer'); pg.click('#pf-help-save'); pg.wait_for_timeout(500)
    ok('volunteer' in text(pg, '#pf-help'), 'How you’ll help is saved')
    shot(pg, '3_profile')
    ok(pg.evaluate("document.documentElement.scrollWidth <= innerWidth"), 'no sideways scroll at 390px')

    # 4. More's first row is the person; #/settings opens the profile
    pg.goto(BASE + '#/more'); ready(pg)
    me = pg.locator('#main a.mr-me').first
    ok('Leilani Kahale' in me.inner_text() and 'parent, teacher' in me.inner_text() and 'Your profile' in me.inner_text(), f'More: the first row is the person ({me.inner_text()[:60]!r})')
    pg.goto(BASE + '#/settings'); ready(pg)
    ok(pg.locator('#pf-about').count() == 1, '#/settings opens the profile')

    # 5. Testimony: the two titles that fit the bill, and where they live when their senator sits on the committee
    pg.goto(BASE + '#/bill/HB1523'); ready(pg)
    t = pg.evaluate(FIND)
    districts(pg, t['mem'])
    letter(pg, t)
    ok(pg.locator('#hp-tp [data-hp="use"]').count() == 3 and pg.locator('#hp-tp [data-hp="use"][aria-pressed="true"]').count() == 2 and pg.locator('[data-hp="addtitle"]').count() == 1, 'the walkthrough: their three titles, the two in use ticked, and "Add a title"')
    ok(pg.locator('#hp-email').count() == 0, 'someone with a profile is not asked for an email in the middle of a letter')
    ok('Your story, from your profile' in text(pg, '#hp-why-help') and 'mom of two teenagers' in pg.input_value('#hp-why'), 'their story starts the "why", marked as from the profile')
    ok('As a parent and teacher, I support HB 1523.' in text(pg, '#hp-tp-prev'), f'the preview: "{text(pg, "#hp-tp-prev")}"')
    shot(pg, '5_about_you')
    pg.click('[data-hp="use"][data-v="own:youth soccer coach"]'); pg.wait_for_timeout(200)
    ok('As a teacher and youth soccer coach' in text(pg, '#hp-tp-prev'), 'a third title picked for this letter replaces the first of the two')
    ok(pg.evaluate("async () => JSON.stringify((await import('./pub/myprofile.js')).myTitles())") == '["parent","teacher","own:youth soccer coach"]', 'choosing for a letter never changes the profile')
    pg.click('[data-hp="addtitle"]'); pg.wait_for_timeout(200)
    ok(pg.locator('#hp-tq').count() == 1 and pg.locator('#hp-tp [data-tp="nurse"]').count() == 1, '"Add a title" opens the picker')
    pg.locator('#hp-dlg .hp-foot .hp-main').first.click(); pg.wait_for_timeout(800)
    L = pg.input_value('#hp-letter')
    ok(f'As a teacher and youth soccer coach, I support HB 1523. My name is Leilani Kahale. I live in Hilo, in Senator ' in L and '’s district.' in L, 'the letter: the two titles, and "I live in Hilo, in Senator ...’s district."')
    close(pg)
    districts(pg, t['notOn'])
    pg.goto(BASE + '#/bill/HB1523'); pg.reload(); ready(pg)
    letter(pg, t); pg.locator('#hp-dlg .hp-foot .hp-main').first.click(); pg.wait_for_timeout(800)
    L = pg.input_value('#hp-letter')
    ok('My name is Leilani Kahale.' in L and 'I live in' not in L, 'no senator of theirs on the committee: nothing about where they live')
    close(pg)

    # 6. An email to the chair: where they live only when the chair is their own senator
    pg.goto(BASE + '#/bill/HB1523'); pg.reload(); ready(pg)
    letter(pg, t, 'email'); pg.locator('#hp-dlg .hp-foot .hp-main').first.click(); pg.wait_for_timeout(800)
    L = pg.evaluate("async () => (await import('./pub/core.js')).S.helper.letter")
    ok('As a parent and teacher, I support HB 1523. My name is Leilani Kahale.' in L and 'your district' not in L, 'an email to a chair who is not theirs: nothing about where they live')
    close(pg)
    districts(pg, t['chair'])
    pg.goto(BASE + '#/bill/HB1523'); pg.reload(); ready(pg)
    letter(pg, t, 'email'); pg.locator('#hp-dlg .hp-foot .hp-main').first.click(); pg.wait_for_timeout(800)
    L = pg.evaluate("async () => (await import('./pub/core.js')).S.helper.letter")
    ok(f'and I live in your district (Senate District {t["chair"]}).' in L, 'an email to a chair who is their senator: "I live in your district"')
    close(pg)
    ok(not errs, 'no page errors on a phone: ' + '; '.join(errs[:2]))
    ctx.close()

    # 7. A laptop: the initials at the top right open the profile; the page at 1280; a 320px phone has no sideways scroll
    ctx = br.new_context(viewport={'width': 1280, 'height': 800}); ctx.add_init_script(f"({SKIP})()")
    pg = ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(BASE + '#/more'); ready(pg)
    pg.evaluate("() => { const k = 'hiphi_text_demo'; localStorage.setItem(k, JSON.stringify({ token: crypto.randomUUID(), phone: '8085550147', at: new Date().toISOString() })); const m = 'hiphi_me_demo'; localStorage.setItem(m, JSON.stringify({ name: 'Leilani Kahale', titles: ['parent', 'teacher'] })); }")
    pg.reload(); ready(pg)
    a = pg.locator('.hdr .hacct')
    ok(a.count() == 1 and a.get_attribute('href') == '#/profile' and 'LK' in a.inner_text() and 'Leilani' in a.inner_text(), f'laptop header: "LK Leilani" at the top right ({a.inner_text() if a.count() else "none"})')
    shot(pg, '7_more_laptop')
    a.click(); pg.wait_for_timeout(1000)
    ok(pg.locator('#pf-about').count() == 1, 'it opens the profile')
    shot(pg, '7b_profile_laptop')
    pg.set_viewport_size({'width': 320, 'height': 640}); pg.wait_for_timeout(400)
    pg.click('[data-pf-edit="about"]'); pg.wait_for_timeout(300); pg.click('[data-tp-more]'); pg.wait_for_timeout(200)
    ok(pg.evaluate("document.documentElement.scrollWidth <= innerWidth"), 'no sideways scroll at 320px, with every title showing')
    shot(pg, '7c_about_320')
    ok(not errs, 'no page errors on a laptop: ' + '; '.join(errs[:2]))
    br.close()
print(f'{sum(res)}/{len(res)} passed'); sys.exit(0 if all(res) else 1)
