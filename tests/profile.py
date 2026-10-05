# Your profile (R-147) in the sandbox, phone and laptop: More's first row, the invitation (a number or an email makes the
# profile), About you with the "I'm a..." picker (tap, More titles, the student choice, typing, their own words), the
# story, How you'll help, the initials on the More tab and the laptop header, #/settings opening the profile, and the
# letters: the two titles that fit the bill, "I live in Hilo, in Senator X's district" only when their own legislator
# is on the committee, an email to a chair who is not theirs saying nothing about where they live.
# R-156 (the review, 10/5): Enter picks the list title typed, a typed title is kept on Save, Undo for titles taken off,
# focus stays on a chip, "Saved." is said aloud, Escape closes a section, stories by topic and the three quote choices,
# the letter's "says" ticks, the story asked after sending, the profile line, the sign-in merge (two devices), sign-out
# clearing the device, and the ʻokina never an initial.
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
    me.click(); pg.wait_for_selector('#pf-alf-phone', timeout=20000); pg.wait_for_timeout(300)   # the profile screen loads on demand
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
    ok(pg.locator('#pf-tq').get_attribute('aria-controls') == 'pf-tpl' and pg.locator('#pf-tpl').count() == 1, 'the box names a list that is always there (aria-controls)')
    pg.click('[data-tp="parent"]'); pg.wait_for_timeout(200)
    ok(pg.evaluate("document.activeElement && document.activeElement.dataset.tp") == 'parent', 'focus stays on the chip just tapped')
    pg.wait_for_timeout(200)
    ok('Added parent' in text(pg, '#pf-tplive'), 'the change is said aloud ("Added parent.")')
    pg.click('#pf-tq'); pg.keyboard.type('teacher'); pg.keyboard.press('Enter'); pg.wait_for_timeout(250)
    ok(pg.evaluate("async () => JSON.stringify((await import('./pub/core.js')).S && document.querySelector('#pf-tp .tp-chips [data-tp=\"teacher\"]') ? 'list' : 'own')") == '"list"' and pg.locator('#pf-tp [data-tp="own:teacher"]').count() == 0, 'typing "teacher" and Enter picks the list title "teacher (kumu)", not their own words')
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
    pg.click('#pf-tq'); pg.keyboard.type('lifeguard'); pg.wait_for_timeout(150)
    shot(pg, '2_about_edit')
    pg.click('#pf-about-save'); pg.wait_for_timeout(600)
    t = text(pg, '#pf-about')
    ok('Leilani Kahale' in t and 'youth soccer coach' in t and 'Saved.' in t, 'Save: the name and titles show, with "Saved."')
    ok('lifeguard' in t, 'a title typed but not added is kept on Save')
    pg.wait_for_timeout(200)
    ok(text(pg, '#pf-live').strip() == 'Saved.', '"Saved." is said aloud')
    pg.click('[data-pf-edit="about"]'); pg.wait_for_timeout(300); pg.click('#pf-tp [data-tp="own:lifeguard"]'); pg.wait_for_timeout(150)
    ok(pg.evaluate("!!document.activeElement && !!document.activeElement.closest('#pf-tp')"), 'after taking a title off, focus stays in the picker')
    pg.click('#pf-about-save'); pg.wait_for_timeout(600)
    ok('Took off lifeguard' in text(pg, '#pf-about') and pg.locator('[data-pf-undo="about"]').count() == 1, 'taking a title off says so, with Undo')
    pg.click('[data-pf-undo="about"]'); pg.wait_for_timeout(600)
    ok('lifeguard' in text(pg, '#pf-about'), 'Undo puts it back')
    pg.click('[data-pf-edit="about"]'); pg.wait_for_timeout(300); pg.click('#pf-tp [data-tp="own:lifeguard"]'); pg.click('#pf-about-save'); pg.wait_for_timeout(600)
    ok(pg.locator('.tabs a[href="#/more"] .tab-av').inner_text().strip() == 'LK' and 'LK' in text(pg, '.pf-head'), 'initials LK on the More tab and the profile')

    # 3. The story and How you'll help
    pg.click('[data-pf-edit="story"]'); pg.wait_for_timeout(300)
    ok(pg.input_value('#pf-topic') == '' and 'What changed for you' in text(pg, '#pf-story-ask') and pg.locator('#pf-story-f input[name="pf-quote"]').count() == 0, 'a story: "Any topic" first, the question is the box\'s label, and no quote question inside one story')
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300)
    ok(pg.locator('#pf-story-f').count() == 0, 'Escape closes the section without saving')
    pg.click('[data-pf-edit="story"]'); pg.wait_for_timeout(300)
    pg.fill('#pf-storyt', 'As a mom of two teenagers in Hilo, I see how easy it is to get around unsafely.'); pg.click('#pf-story-save'); pg.wait_for_timeout(500)
    ok('mom of two teenagers' in text(pg, '#pf-story') and 'Can HIPHI quote your stories?' in text(pg, '#pf-story'), 'the story is saved, with its own row "Can HIPHI quote your stories?"')
    pg.click('[data-pf-edit="quote"]'); pg.wait_for_timeout(300)
    ok(pg.locator('#pf-quote-f input[name="pf-quote"]').count() == 4 and 'applies to all of them' in text(pg, '#pf-quote-f'), 'the quote question: four choices, for all the stories')
    pg.check('#pf-quote-first'); pg.click('#pf-quote-save'); pg.wait_for_timeout(500)
    ok('My first name and island' in text(pg, '#pf-story') and 'Saved.' in text(pg, '#pf-story'), 'saved: "My first name and island"')
    pg.click('[data-pf-story="+"]'); pg.wait_for_timeout(300)
    pg.select_option('#pf-topic', 'tobacco'); pg.wait_for_timeout(100)
    ok('e-cigarettes' in text(pg, '#pf-story-ask'), f'the topic\'s own question is the label ({text(pg, "#pf-story-ask")[:60]})')
    pg.fill('#pf-storyt', 'My son started using e-cigarettes at 14.'); pg.click('#pf-story-save'); pg.wait_for_timeout(500)
    pg.click('[data-pf-edit="quote"]'); pg.wait_for_timeout(300); pg.check('#pf-quote-name'); pg.click('#pf-quote-save'); pg.wait_for_timeout(500)
    t = text(pg, '#pf-story')
    ok('Your stories' in t and 'About Tobacco' in t and 'e-cigarettes at 14' in t and 'My full name' in t, 'a second story, about tobacco, and the full-name choice')
    pg.click('[data-pf-story="tobacco"]'); pg.wait_for_timeout(300); pg.click('[data-pf-storydel]'); pg.wait_for_timeout(600)
    ok('Story removed.' in text(pg, '#pf-story') and 'e-cigarettes at 14' not in text(pg, '#pf-story'), 'Remove this story: gone, with "Story removed."')
    pg.click('[data-pf-undo="story"]'); pg.wait_for_timeout(600)
    ok('e-cigarettes at 14' in text(pg, '#pf-story'), 'Undo brings the story back')
    pg.click('[data-pf-edit="help"]'); pg.wait_for_timeout(300)
    ok(pg.locator('#pf-int-story').count() == 0 and 'sign up to speak' in text(pg, '#pf-help'), 'How you’ll help: "a story to share" is gone, and each answer says what it changes')
    pg.check('#pf-int-volunteer'); pg.check('#pf-int-testify'); pg.click('#pf-help-save'); pg.wait_for_timeout(500)
    ok('volunteer' in text(pg, '#pf-help') and 'sign up to speak' in text(pg, '#pf-help'), 'How you’ll help is saved, with what it does')
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
    use = pg.evaluate("async ([t]) => { const c = await import('./pub/core.js'), T = await import('./pub/titles.js'), b = c.D.bills.find(x => x.id === t); const is = c.issuesOf(b) || []; return T.pickTwo(['parent','teacher','own:youth soccer coach'], { cats: [...new Set(is.map(i => i.category))], text: [c.nick(b), b.hiphi_summary, b.title, b.description, ...is.map(i => i.name)].filter(Boolean).join(' ') }); }", [t['b']])
    ok(pg.locator('#hp-tp [data-hp="use"]').count() == 3 and pg.locator('#hp-tp [data-hp="use"][aria-pressed="true"]').count() == len(use) and pg.locator('[data-hp="addtitle"]').count() == 1, f'the walkthrough: their three titles, the ones that fit ticked ({use}), and "Add a title"')
    ok(pg.locator('#hp-email').count() == 0, 'someone with a profile is not asked for an email in the middle of a letter')
    ok('Your story, from your profile' in text(pg, '#hp-why-help') and 'mom of two teenagers' in pg.input_value('#hp-why'), 'their story for any issue starts the "why", marked as from the profile (the tobacco one is not used on a crossing bill)')
    shot(pg, '5_about_you')
    pg.click('[data-hp="use"][data-v="own:youth soccer coach"]'); pg.wait_for_timeout(200)
    ok('youth soccer coach' in text(pg, '#hp-tp-prev'), 'a title picked for this letter goes in it')
    ok(pg.evaluate("async () => JSON.stringify((await import('./pub/myprofile.js')).myTitles())") == '["parent","teacher","own:youth soccer coach"]', 'choosing for a letter never changes the profile')
    pg.click('[data-hp="addtitle"]'); pg.wait_for_timeout(200)
    ok(pg.locator('#hp-tq').count() == 1 and pg.locator('#hp-tp [data-tp="nurse"]').count() == 1 and pg.locator('#hp-tp [data-tp="parent"]').count() == 0 and pg.locator('[data-tp-done]').count() == 1, '"Add a title" opens the picker to add only (their titles are not there to untap), with Done')
    pg.click('[data-tp-done]'); pg.wait_for_timeout(200)
    ok(pg.locator('#hp-tp [data-hp="use"]').count() == 3 and pg.locator('#hp-tq').count() == 0, 'Done goes back to the letter\'s titles')
    two = pg.evaluate("async () => { const c = await import('./pub/core.js'); return c.S.helper.use; }")
    pg.locator('#hp-dlg .hp-foot .hp-main').first.click(); pg.wait_for_timeout(800)
    L = pg.input_value('#hp-letter')
    ok('youth soccer coach, I support HB 1523. My name is Leilani Kahale. I live in Hilo, in Senator ' in L and '’s district.' in L, 'the letter: their titles, and "I live in Hilo, in Senator ...’s district."')
    ok(pg.locator('.hp-says [data-hp="says"]').count() == 3 and 'Testimony is posted publicly' in text(pg, '.hp-says') and pg.evaluate("document.querySelector('.hp-says').compareDocumentPosition(document.querySelector('#hp-letter')) & 2") , 'under the letter: what it says about them (titles, where they live, their story), each a tap to leave out')
    pg.click('#hp-says-live'); pg.wait_for_timeout(300)
    L = pg.input_value('#hp-letter')
    ok('I live in' not in L and pg.locator('#hp-says-live[aria-pressed="false"]').count() == 1 and 'left out' in text(pg, '#hp-says-live') and 'put it back' in text(pg, '.hp-says'), 'leaving out where they live takes it out of the letter, and the chip says "left out"')
    pg.click('#hp-says-titles'); pg.wait_for_timeout(300)
    L = pg.input_value('#hp-letter')
    ok(L.split('\n\n')[2].startswith('I support HB 1523.'), 'leaving out the titles: the letter starts "I support HB 1523."')
    pg.click('#hp-says-why'); pg.wait_for_timeout(300)
    ok('mom of two teenagers' not in pg.input_value('#hp-letter'), 'leaving out their story takes it out')
    shot(pg, '5b_says')
    close(pg)
    districts(pg, t['notOn'])
    pg.goto(BASE + '#/bill/HB1523'); pg.reload(); ready(pg)
    letter(pg, t); pg.locator('#hp-dlg .hp-foot .hp-main').first.click(); pg.wait_for_timeout(800)
    L = pg.input_value('#hp-letter')
    ok('My name is Leilani Kahale.' in L and 'I live in' not in L, 'no senator of theirs on the committee: nothing about where they live')
    close(pg)

    # 5b. The hearing card for someone who said "I'd testify in person": when and where to go, under the main button (C1)
    pg.goto(BASE + '#/bill/HB1523'); pg.reload(); ready(pg)
    a = pg.locator('[data-asked]')
    ok(a.count() == 1 and 'When and where to go' in a.inner_text(), 'the hearing card: "When and where to go" for someone who would testify in person')
    a.click(); pg.wait_for_timeout(300)
    ok('Arrive 15 minutes early' in text(pg, '.gopanel'), 'it opens the room, the time and "arrive 15 minutes early"')

    # 6. An email to the chair: where they live only when the chair is their own senator
    pg.goto(BASE + '#/bill/HB1523'); pg.reload(); ready(pg)
    letter(pg, t, 'email'); pg.locator('#hp-dlg .hp-foot .hp-main').first.click(); pg.wait_for_timeout(800)
    L = pg.evaluate("async () => (await import('./pub/core.js')).S.helper.letter")
    ok('I support HB 1523. My name is Leilani Kahale.' in L and 'your district' not in L, 'an email to a chair who is not theirs: nothing about where they live')
    close(pg)
    districts(pg, t['chair'])
    pg.goto(BASE + '#/bill/HB1523'); pg.reload(); ready(pg)
    letter(pg, t, 'email'); pg.locator('#hp-dlg .hp-foot .hp-main').first.click(); pg.wait_for_timeout(800)
    L = pg.evaluate("async () => (await import('./pub/core.js')).S.helper.letter")
    ok(f'and I live in your district (Senate District {t["chair"]}).' in L, 'an email to a chair who is their senator: "I live in your district"')
    close(pg)

    # 6b. After sending: the story ask for a topic with no story, and the profile named once (C2)
    pg.evaluate("async () => { const m = await import('./pub/myprofile.js'); await m.saveProfile({ story: '', stories: {} }); }")
    pg.goto(BASE + '#/bill/HB1523'); pg.reload(); ready(pg)
    letter(pg, t)
    pg.fill('#hp-why', 'Our road has no crosswalk near the school.')
    for _ in range(5):
        if pg.locator('#hp-done-t').count(): break
        b = pg.locator('#hp-dlg [data-hp="sent"], #hp-dlg [data-hp="acct-yes"]')
        if not b.count(): b = pg.locator('#hp-dlg .hp-foot .hp-main')
        if not b.count(): break
        b.first.click(); pg.wait_for_timeout(900)
    has_done = pg.locator('#hp-done-t').count() == 1
    ok(has_done, 'the letter can be marked sent')
    if has_done:
        ok(pg.locator('.hp-storyask').count() == 1 and 'crosswalk' in pg.input_value('#hp-sa') and 'street' in text(pg, '.hp-storyask label'), 'after sending: "Save a sentence on why this matters to you?", their reason in the box, the topic\'s question')
        ok('saved in your profile' in text(pg, '.hp-profline'), 'and the profile is named once ("saved in your profile")')
        shot(pg, '6b_done')
        pg.click('[data-hp="storysave"]'); pg.wait_for_timeout(600)
        ok('Saved in your profile as your story about Getting Around' in text(pg, '#hp-dlg'), 'saved as the story about its topic')
        st = pg.evaluate("async () => JSON.stringify((await import('./pub/myprofile.js')).myStories())")
        ok('crosswalk' in st and 'around' in st, f'kept under the topic ({st[:80]})')
    close(pg)
    pg.evaluate("async () => { const m = await import('./pub/myprofile.js'); await m.saveProfile({ story: 'As a mom of two teenagers in Hilo, I see how easy it is to get around unsafely.' }); }")
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
    a.click(); pg.wait_for_selector('#pf-about', timeout=20000)
    ok(pg.locator('#pf-about').count() == 1, 'it opens the profile')
    shot(pg, '7b_profile_laptop')
    pg.set_viewport_size({'width': 320, 'height': 640}); pg.wait_for_timeout(400)
    pg.click('[data-pf-edit="about"]'); pg.wait_for_timeout(300); pg.click('[data-tp-more]'); pg.wait_for_timeout(200)
    ok(pg.evaluate("document.documentElement.scrollWidth <= innerWidth"), 'no sideways scroll at 320px, with every title showing')
    shot(pg, '7c_about_320')
    ok(not errs, 'no page errors on a laptop: ' + '; '.join(errs[:2]))

    # 8. The sign-in merge (two devices, kernel.js), sign-out clearing the device, the ʻokina and an iPhone's Home Screen note
    r = pg.evaluate("""async () => { const k = await import('./pub/kernel.js'), m = await import('./pub/myprofile.js');
      const acct = { name: 'Leilani Kahale', titles: ['parent'], story: null, stories: {}, interests: [], senate_district: 1, house_district: 2 };
      // A laptop that followed this account still holds the story cleared on the phone: nothing goes up, the device follows.
      const laptop = { acct: 'u1', name: 'Leilani Kahale', titles: ['parent'], story: 'old words', drafts: { x: 1 } };
      const j1 = k.profileJoin(acct, laptop, null), d1 = k.profileOnDevice(acct, laptop, { senate: 9, house: 9, label: 'Kailua' }, 'u1');
      // A profile made on a phone while signed out joins an empty account, all of it.
      const empty = { name: null, titles: [], story: null, stories: {}, interests: [], senate_district: null, house_district: null };
      const phone = { name: 'Lei', titles: ['nurse'], story: 'mine', stories: { food: 'lunch' }, interests: ['testify'], quote: 'name' };
      const j2 = k.profileJoin(empty, phone, { senate: 5, house: 9 });
      return { j1, story: d1.me.story, drafts: !!d1.me.drafts, dist: d1.dist, j2, ini: [m.initials('ʻIlima Kahale'), m.initials('Leilani'), m.initials('Mary-Jane Ōta')] }; }""")
    ok(r['j1'] is None and r['story'] == '' and r['dist'] == {'senate': 1, 'house': 2, 'label': ''}, f'a story cleared on another device stays cleared, and the account\'s districts win ({r["story"]!r}, {r["dist"]})')
    ok(r['j2'] == {'name': 'Lei', 'titles': ['nurse'], 'story': 'mine', 'stories': {'food': 'lunch'}, 'interests': ['testify', 'quote', 'quote-name'], 'senate': 5, 'house': 9}, f'a profile made signed out joins an empty account: name, titles, stories, help, quote and districts ({r["j2"]})')
    ok(r['ini'] == ['IK', 'L', 'MÕ'] or r['ini'][:2] == ['IK', 'L'], f'initials skip the ʻokina ({r["ini"]})')
    r = pg.evaluate("""async () => { const m = await import('./pub/myprofile.js'); m.forgetProfileOnDevice();
      const me = JSON.parse(localStorage.getItem('hiphi_me_demo') || '{}'); return { keys: Object.keys(me), d: localStorage.getItem('hiphi_districts_demo'), name: m.myName() }; }""")
    ok(not any(k in r['keys'] for k in ['name', 'titles', 'story', 'drafts']) and r['d'] is None and r['name'] == '', f'sign-out takes the profile off the device ({r})')
    br.close()

    # 9. An iPhone with a number-only profile: "Keep your profile on this iPhone", once
    br = p.chromium.launch()
    ctx = br.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, user_agent='Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1')
    ctx.add_init_script(f"({SKIP})()")
    pg = ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(BASE + '#/more'); ready(pg)
    pg.evaluate("() => localStorage.setItem('hiphi_text_demo', JSON.stringify({ token: crypto.randomUUID(), phone: '8085550147', at: new Date().toISOString() }))")
    pg.goto(BASE + '#/profile'); pg.reload(); ready(pg)
    ok(pg.locator('.pf-hs').count() == 0, 'an iPhone, a profile kept only on this phone: no Home Screen card (its storage would not come along)')
    pg.evaluate("async () => { const c = await import('./pub/core.js'); c.S.session = { user: { email: 'lei@example.com' } }; c.S.user = { id: 'u1', prefs: {}, created_at: new Date().toISOString() }; c.S.profile = { name: 'Lei', titles: [], interests: [], stories: {} }; c.app.render(); }")
    pg.wait_for_timeout(600)
    ok(pg.locator('.pf-hs').count() == 1 and 'keeps you signed in' in text(pg, '.pf-hs'), 'signed in on an iPhone: "Add the tracker to your Home Screen"')
    pg.click('[data-pf-hs="how"]'); pg.wait_for_timeout(300)
    ok(pg.locator('.pf-steps li').count() == 3 and 'Add to Home Screen' in text(pg, '.pf-steps') and 'with your email' in text(pg, '.pf-steps'), 'Show me how: the three steps, signing in there with their email')
    shot(pg, '9_iphone_hs')
    pg.click('[data-pf-hs="no"]'); pg.wait_for_timeout(300)
    ok(pg.locator('.pf-hs').count() == 0, 'No thanks hides it')
    pg.evaluate("async () => { const c = await import('./pub/core.js'); c.S.session = null; c.S.user = null; c.S.profile = {}; }")
    # 10. Signing in with the code from the email (D2), shown in the sandbox with &ecode (off live until the email carries it)
    pg.goto(BASE.replace('demo=1', 'demo=1&ecode') + '#/signin'); ready(pg)
    pg.fill('#mr-email', 'lei@example.com'); pg.click('#mr-si-send'); pg.wait_for_timeout(800)
    ok(pg.locator('#mr-ecin').count() == 1 and pg.locator('#mr-ecin').get_attribute('autocomplete') == 'one-time-code', 'Check your inbox: "Or type the 6-digit code from the email"')
    shot(pg, '10_email_code')
    pg.fill('#mr-ecin', '12345'); pg.click('#mr-ec-go'); pg.wait_for_timeout(400)
    ok('Enter the 6 digits' in text(pg, '#mr-ec-msg'), 'five digits: "Enter the 6 digits from the email."')
    pg.goto(BASE + '#/signin'); ready(pg)
    pg.fill('#mr-email', 'lei@example.com'); pg.click('#mr-si-send'); pg.wait_for_timeout(800)
    ok(pg.locator('#mr-ecin').count() == 0, 'without the switch, no code box (the email has no code yet)')
    ok(not errs, 'no page errors on an iPhone: ' + '; '.join(errs[:2]))
    br.close()
print(f'{sum(res)}/{len(res)} passed'); sys.exit(0 if all(res) else 1)
