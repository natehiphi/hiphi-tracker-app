# R-360: act.html, one bill and one action, in the practice copy (frozen 16 Mar 2026, when HB 2121 has a Senate
# hearing on Fri 20 Mar and testimony is open). Part 1: the bill screen at a phone's size, the one button, the words, and
# the not-found state. Part 2: writing the letter (#/HB2121/write), sending it (#/HB2121/send: the copy, the Capitol's
# steps, "Yes, I sent it" recorded as the tracker records it) and the email to the chair for SB 2175. Saves screenshots
# at 390x844 (part1-390, part2-write, part2-send) and 320x640. Part 3: the Mahalo screen (part3-thanks at 390x844), Share with
# a friend (the bill's link, without /thanks), the email case, and that the practice copy sends no count to /rpc/log_.
# Part 4: the Bills screen (#/bills: search, topic chips, Need voices now, one section per issue with Follow) and the tab bar
# (Home · Bills · This week), the bill's "Part of <issue>" line and its Back to Bills. Saves part4-bills and part4-bill.
# Part 5: This week (#/week): the date, the one thing (the soonest deadline, the followed issue's first), Your issues, the
# hearings by day, a returning person landing there. Saves part5-week (following the e-cigarette ban) and part5-week-nofollow.
#   python3 tests/act_screens.py [base] [shots_dir]   base defaults to http://127.0.0.1:8861/act.html?demo=1
import os, sys
from playwright.sync_api import sync_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8861/act.html?demo=1'
SHOTS = sys.argv[2] if len(sys.argv) > 2 else os.environ.get('ACT_SHOTS', '')
res = []
def ok(c, m): res.append(bool(c)); print('PASS' if c else 'FAIL', m)

# Pixel checks wait for the fonts (fonts.load, not fonts.check) and the drawing, or a fallback face measures wider.
FONTS = "async () => { await document.fonts.ready; await document.fonts.load('700 28px Poppins'); await document.fonts.load('400 16px Lato'); return document.fonts.check('700 28px Poppins'); }"
IMGS = "() => [...document.images].every(i => i.complete)"

def open_bill(pg, hash_):
    pg.goto(BASE + hash_)
    pg.wait_for_selector('#main:not([aria-busy]) h1', timeout=60000)
    poppins = pg.evaluate(FONTS)
    pg.wait_for_function(IMGS, timeout=20000)
    return poppins

with sync_playwright() as p:
    br = p.chromium.launch()
    pg = br.new_page(viewport={'width': 390, 'height': 844}); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    poppins = open_bill(pg, '#/HB2121')
    ok(poppins, 'Poppins loaded before measuring')
    h1 = pg.locator('h1')
    ok(h1.is_visible() and h1.inner_text().replace('\n', ' ').strip() == 'Disposable e-cigarette ban', f'the nickname is the heading ({h1.inner_text()!r})')
    ok(pg.locator('.num').inner_text() == 'HB 2121' and 'HIPHI supports' in pg.locator('.pos').inner_text(), 'number and position chip')
    ok(pg.locator('.primary').count() == 1, f'exactly one primary button ({pg.locator(".primary").count()})')
    ok(pg.locator('.primary').inner_text().strip() == 'Send testimony', 'the button is Send testimony while the deadline is open')
    ok(pg.locator('.hd img.art-issue').count() == 1, 'the issue drawing is the header')
    body = pg.locator('body').inner_text()
    first = pg.locator('.stand .ln').first.inner_text()
    ok(first.startswith('Send by Wed, Mar 18, ') and 'hear it Fri, Mar 20. You don’t need to go.' in first, f'the deadline leads, with its date, then the hearing day ({first!r})')
    ok('Two Senate committees hear it next.' in body or 'Now with the Senate' in body, 'the committee line counts two committees, or names the one')
    ok(pg.evaluate("getComputedStyle(document.querySelector('h1')).textWrap").startswith('balance') or pg.evaluate("getComputedStyle(document.querySelector('h1')).textWrapStyle") == 'balance', 'the heading is balanced (text-wrap: balance)')
    ok('vape' not in pg.content().lower(), 'the word "vape" is nowhere on the page')
    ok(not any(c in body for c in ('HD1', 'HD2', 'SD1', 'SD2', 'HHS', 'CPN')), 'no version or committee codes in the words')
    sw = pg.evaluate('() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]')
    ok(sw[0] <= sw[1], f'no sideways scroll at 390 ({sw})')
    btn = pg.locator('.primary').bounding_box()
    ok(btn and btn['y'] + btn['height'] <= 844, f'the button is in the first screen at 390x844 (bottom {btn and round(btn["y"] + btn["height"])})')
    if SHOTS: pg.screenshot(path=os.path.join(SHOTS, 'part1-390.png'))
    pg.locator('.primary').click(); pg.wait_for_function("() => location.hash === '#/HB2121/write' && (document.querySelector('h1')?.textContent || '').trim() === 'Your testimony'", timeout=10000)
    ok(True, 'the button goes to #/HB2121/write, "Your testimony"')
    pg.go_back(); pg.wait_for_selector('.primary', timeout=5000)
    ok(pg.locator('h1').inner_text().replace('\n', ' ').strip() == 'Disposable e-cigarette ban', 'Back returns to the bill')

    # The tracker's own address form and lower case open the same bill.
    for h in ('#/hb2121', '#/bill/HB2121'):
        open_bill(pg, h); ok('Disposable e-cigarette ban' in pg.locator('h1').inner_text().replace('\n', ' '), f'{h} opens HB 2121')
    # A bill waiting for a hearing offers Email the chair; one that did not advance has no button and says so.
    open_bill(pg, '#/SB2175'); ok(pg.locator('.primary').inner_text().strip() == 'Email the chair', 'SB 2175, waiting for a hearing: Email the chair')
    open_bill(pg, '#/HB10'); ok(pg.locator('.primary').count() == 0 and 'This bill did not advance this year.' in pg.locator('body').inner_text(), 'HB 10, did not advance: no button, a plain line')

    # Not found.
    open_bill(pg, '#/XX0000')
    ok("We can’t find that bill" in pg.locator('h1').inner_text(), 'XX0000: "We can’t find that bill"')
    ok(pg.locator('a[href^="track.html"]').count() == 1, 'with a link to track.html')

    # 320x640.
    pg.set_viewport_size({'width': 320, 'height': 640}); open_bill(pg, '#/HB2121')
    sw = pg.evaluate('() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]')
    ok(sw[0] <= sw[1], f'no sideways scroll at 320 ({sw})')
    if SHOTS: pg.screenshot(path=os.path.join(SHOTS, 'part1-320.png'), full_page=True)
    ok(not errs, f'no page errors {errs[:2]}')

    # ---- Part 2: write and send, in a fresh context with the clipboard allowed ----
    ctx = br.new_context(viewport={'width': 390, 'height': 844}, permissions=['clipboard-read', 'clipboard-write'])
    pg = ctx.new_page(); errs2 = []; pg.on('pageerror', lambda e: errs2.append(str(e)))
    reqs = []; pg.on('request', lambda r: reqs.append(r.url))   # part 3: what the practice copy sends
    def open_step(h, sel):
        pg.goto(BASE + h); pg.wait_for_selector(sel, timeout=60000); pg.evaluate(FONTS)
    letter = lambda: pg.locator('#w-letter').input_value()
    width = lambda: pg.evaluate('() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]')
    open_step('#/HB2121/write', '#w-letter')
    L = letter()
    ok('Dear Chair San Buenaventura' in L and 'Please pass HB 2121.' in L and L.startswith('Dear '), 'the letter is written from HIPHI’s position, the chairs by surname')
    ok('Testimony in SUPPORT' not in L and 'Hearing:' not in L, 'the box holds only the letter’s body, no header (fix 6)')
    to = pg.locator('#w-to').inner_text()
    ok(to.startswith('To the ') and '· hearing Fri, Mar 20' in to, f'one quiet line says who it goes to and the hearing ({to!r})')
    bk = pg.locator('.back').bounding_box()
    ok(bk and bk['height'] >= 44, f'the back link is at least 44px tall ({bk and bk["height"]}) (fix 3)')
    ok(pg.locator('.note').inner_text().strip() == 'The Capitol posts testimony online with your name and town.', 'the public note, once and plainly')
    ok('Disposable e-cigarettes are easy for young people to buy' in L, 'HIPHI’s talking points are in the letter')
    ok(pg.locator('.primary').count() == 1 and pg.locator('.primary').inner_text().strip() == 'Next', 'write: exactly one primary button, Next')
    ok(pg.locator('[data-differ]').count() == 1 and 'Write your own words instead' in pg.locator('[data-differ]').inner_text(), '"I see it differently", with "Write your own words instead"')
    pg.click('[data-next]'); pg.wait_for_selector('#w-name-err', timeout=3000)
    ok(pg.evaluate('location.hash') == '#/HB2121/write', 'Next with no name stays and asks for one')
    pg.fill('#w-name', 'Leilani Kahale'); pg.fill('#w-town', 'Hilo')
    ok('My name is Leilani Kahale, and I live in Hilo.' in letter() and letter().rstrip().endswith('Leilani Kahale'), 'the typed name and town are in the letter and sign it')
    pg.fill('#w-own', 'My daughter got her first one at school')
    ok('My daughter got her first one at school.' in letter(), 'their own line goes into the letter')
    pg.locator('#w-letter').evaluate("t => { t.value = t.value.replace('Thank you for the chance to testify.', 'Mahalo for reading this.'); t.dispatchEvent(new Event('input', { bubbles: true })); }")
    pg.fill('#w-name', 'Leilani K. Kahale')
    ok('Mahalo for reading this.' in letter() and 'My name is Leilani K. Kahale' in letter() and letter().rstrip().endswith('Leilani K. Kahale'), 'a retyped name updates the letter and keeps their edit')
    me = pg.evaluate("JSON.parse(localStorage.getItem('hiphi_me') || '{}')")
    ok(me.get('name') == 'Leilani K. Kahale' and me.get('town') == 'Hilo', 'name and town are kept in hiphi_me')
    sw = width(); fit = pg.evaluate("() => { const t = document.querySelector('#w-letter'); return [t.scrollHeight, t.clientHeight]; }")
    ok(sw[0] <= sw[1] and fit[0] <= fit[1] + 2, f'write: the box grows to the whole letter, no scroll inside it and none sideways ({fit}, {sw})')
    ok('vape' not in pg.content().lower(), 'write: no "vape"')
    if SHOTS: pg.locator('#w-letter').evaluate('t => { t.blur(); t.scrollTop = 0; }'); pg.mouse.move(0, 0); pg.screenshot(path=os.path.join(SHOTS, 'part2-write.png'))
    sent_letter = letter()
    pg.click('[data-next]'); pg.wait_for_selector('[data-copy]', timeout=10000)
    ok(pg.evaluate('location.hash') == '#/HB2121/send' and pg.locator('h1').inner_text() == 'Send it at the Capitol', 'Next reaches #/HB2121/send')
    ok(pg.locator('main > .note').inner_text().strip() == 'The first time takes about 10 minutes.', 'one short line under the heading')
    ok(pg.locator('.steps li').nth(0).locator('[data-capitol]').count() == 1 and pg.locator('.steps li').nth(2).locator('[data-copy]').count() == 1, 'Open the Capitol page is in step 1, Copy my testimony in step 3')
    ok(pg.locator('body').inner_text().count('green box') == 1, '"green box" is said once, under Did it go through?')
    ok(pg.locator('.primary').count() == 1 and 'Open the Capitol page' in pg.locator('.primary').inner_text(), 'send: exactly one primary button, Open the Capitol page')
    ok(pg.locator('.steps li').count() == 3 and 'Fri, Mar 20' in pg.locator('.steps').inner_text(), 'three numbered steps, with the hearing’s day')
    sw = width(); bx = pg.locator('[data-sent]').bounding_box()
    ok(sw[0] <= sw[1] and bx['y'] + bx['height'] <= 844, f'send fits one view at 390x844 (Yes bottom {round(bx["y"] + bx["height"])}, {sw})')
    ok('vape' not in pg.content().lower(), 'send: no "vape"')
    if SHOTS: pg.mouse.move(0, 0); pg.screenshot(path=os.path.join(SHOTS, 'part2-send.png'))
    pg.click('[data-copy]'); pg.wait_for_function("() => /Copied/.test(document.querySelector('[data-copy]')?.textContent || '')", timeout=3000)
    full = pg.evaluate('navigator.clipboard.readText()')
    ok(full.startswith('Testimony in SUPPORT of HB 2121') and full.endswith(sent_letter), 'Copy my testimony copies the header, then the letter with their edit (fix 6)')
    # Fix 1: a "Copied" timer never paints the send screen over the letter.
    pg.click('.back'); pg.wait_for_selector('#w-letter', timeout=5000); pg.wait_for_timeout(2500)
    ok(pg.evaluate('location.hash') == '#/HB2121/write' and pg.locator('#w-letter').count() == 1 and pg.locator('[data-copy]').count() == 0, 'Copy, then Back to my letter: 2.5 s later the letter is still there (fix 1)')
    pg.click('[data-next]'); pg.wait_for_selector('[data-copy]', timeout=10000)
    ok('Copied' not in pg.locator('[data-copy]').inner_text(), 'back on send, the button says Copy again, not a stale Copied')
    pg.click('[data-capitol]'); pg.wait_for_selector('.info', timeout=3000)
    ok(len(ctx.pages) == 1 and pg.locator('.primary').count() == 1 and 'Yes, I sent it' in pg.locator('.primary').inner_text(), 'practice: the Capitol page opens nothing, and Yes, I sent it becomes the one primary')
    pg.click('[data-notyet]'); pg.wait_for_selector('.okmsg', timeout=3000)
    ok(pg.evaluate('location.hash') == '#/HB2121/send', 'Not yet stays on send')
    pg.click('[data-sent]'); pg.wait_for_function("() => location.hash === '#/HB2121/thanks'", timeout=5000); pg.wait_for_selector('h1:has-text("Mahalo")', timeout=5000)
    rec = pg.evaluate("() => { const d = JSON.parse(localStorage.getItem('hiphi_done_demo') || '[]'), m = JSON.parse(localStorage.getItem('hiphi_me') || '{}');"
                      " const L = Object.values(m.letters || {}).find(l => l.num === 'HB2121' && l.via === 'act'); return { done: d.filter(k => k.endsWith('|testimony')).length, letter: L ? L.letter : '', h: L ? L.h : '' }; }")
    ok(rec['done'] >= 1 and rec['letter'] == full and rec['h'], f'Yes, I sent it marks the testimony done and keeps the whole letter in hiphi_me ({rec["done"]} mark)')
    # Part 3: the Mahalo screen after Yes, I sent it.
    sm = pg.locator('.sum').inner_text().strip()
    ok(pg.locator('h1').inner_text().strip() == 'Mahalo!' and sm in ('Your testimony is in. The committees hear it Fri, Mar 20.', 'Your testimony is in. The committee hears it Fri, Mar 20.') and 'HB 2121' not in sm, f'thanks: "Mahalo!" and the hearing day, the number said once ({sm!r})')
    a1, a2 = pg.locator('.after a').nth(0).bounding_box(), pg.locator('.after a').nth(1).bounding_box()
    ok(a2['y'] - (a1['y'] + a1['height']) >= 15.5, f'thanks: the two quiet links stand 16px apart ({round(a2["y"] - a1["y"] - a1["height"])})')
    ok(pg.locator('.primary').count() == 1 and pg.locator('.primary').inner_text().strip() == 'Share with a friend', 'thanks: exactly one primary, Share with a friend')
    ok(pg.locator('a[href="track.html?demo=1"]').count() == 1 and pg.locator('a', has_text='See HIPHI’s other bills').count() == 1, 'thanks: one quiet link to track.html, kept in the practice copy')
    ok('vape' not in pg.content().lower(), 'thanks: no "vape"')
    if SHOTS: pg.mouse.move(0, 0); pg.screenshot(path=os.path.join(SHOTS, 'part3-thanks.png'))
    want = pg.evaluate("() => location.origin + location.pathname + '#/HB2121'")
    pg.evaluate("() => Object.defineProperty(navigator, 'share', { configurable: true, value: d => { window.__shared = d; return Promise.resolve(); } })")
    pg.click('[data-share]'); pg.wait_for_function('() => !!window.__shared', timeout=3000)
    sh = pg.evaluate('window.__shared')
    ok(sh['url'] == want and 'Disposable e-cigarette ban' in sh['title'], f'Share uses the share sheet where there is one, with the bill’s name and link ({sh})')
    pg.evaluate("() => Object.defineProperty(navigator, 'share', { configurable: true, value: undefined })")
    pg.click('[data-share]'); pg.wait_for_function("() => /Copied/.test(document.querySelector('[data-share]')?.textContent || '')", timeout=3000)
    clip = pg.evaluate('navigator.clipboard.readText()')
    ok(clip == want and '/thanks' not in clip and clip.endswith('/act.html#/HB2121'), f'Share with a friend copies the bill’s link, without /thanks ({clip})')
    # Fix 1: the "Copied" timer never brings Mahalo back over the bill.
    pg.click('.after a.back'); pg.wait_for_selector('.stand', timeout=5000); pg.wait_for_timeout(2500)
    ok(pg.evaluate('location.hash') == '#/HB2121' and pg.locator('h1').inner_text().strip() != 'Mahalo!', 'Share, then Back to the bill: 2.5 s later the bill is still there (fix 1)')
    # Fix 2: the bill remembers it was sent, and /send goes to Mahalo.
    ok('You sent it on ' in pg.locator('.okline').inner_text() and pg.locator('.primary').count() == 0 and pg.locator('a', has_text='Send again').count() == 1,
       'after Yes, the bill says "You sent it on …" with a quiet Send again, no primary (fix 2)')
    pg.goto(BASE + '#/HB2121/send'); pg.wait_for_function("() => location.hash === '#/HB2121/thanks'", timeout=10000); pg.wait_for_selector('h1:has-text("Mahalo")', timeout=10000)
    ok(pg.locator('[data-sent]').count() == 0, '#/HB2121/send after sending goes to Mahalo, never Yes, I sent it again (fix 2)')
    open_step('#/HB2121/write', '#w-letter')
    ok(pg.locator('#w-name').input_value() == 'Leilani K. Kahale' and pg.locator('#w-town').input_value() == 'Hilo', 'the name and town are prefilled next time')
    pg.click('[data-differ]')
    ok(letter() == '' and pg.evaluate("document.activeElement.id") == 'w-letter', 'I see it differently empties the letter and puts the cursor in it (fix 8)')
    pg.locator('#w-letter').fill('Aloha. I see this bill another way.')
    pg.click('[data-next]'); pg.wait_for_function("() => location.hash === '#/HB2121/thanks' || !!document.querySelector('[data-copy]')", timeout=10000)

    # The email to the chair: SB 2175 waits for a hearing.
    open_step('#/SB2175/write', '#w-letter')
    ok(pg.locator('h1').inner_text() == 'Your email to the chair' and 'Would you please schedule a hearing' in letter(), 'SB 2175: "Your email to the chair", asking for a hearing')
    ok(pg.locator('[data-differ]').count() == 1 and 'HIPHI sends nothing' in pg.locator('.note').inner_text(), 'the email path has I see it differently too, and says HIPHI sends nothing')
    pg.click('[data-next]'); pg.wait_for_selector('[data-via]', timeout=10000)
    hrefs = {a.get_attribute('data-via'): a.get_attribute('href') for a in pg.locator('[data-via]').all()}
    ok(set(hrefs) == {'app', 'gmail', 'outlook'} and hrefs['app'].startswith('mailto:') and '@capitol.hawaii.gov' in hrefs['app'] and 'subject=SB%202175' in hrefs['app'],
       'the mail app link has the chair’s address and the subject')
    ok(hrefs['gmail'].startswith('https://mail.google.com/') and hrefs['outlook'].startswith('https://outlook.live.com/') and all('body=' in h for h in hrefs.values()), 'Gmail and Outlook links, each with the message')
    ok(pg.locator('.primary').count() == 1, 'email send: exactly one primary button')
    ok(pg.locator('.steps li').nth(0).locator('[data-via]').count() == 3, 'the email’s step 1 holds the three ways to open it')
    ok('vape' not in pg.content().lower(), 'email send: no "vape"')
    pg.click('[data-sent]'); pg.wait_for_function("() => location.hash === '#/SB2175/thanks'", timeout=5000)
    ok(pg.evaluate("JSON.parse(localStorage.getItem('hiphi_done_demo') || '[]').some(k => k.endsWith('||email'))"), 'Yes, I sent it marks the email done')
    pg.wait_for_selector('h1:has-text("Mahalo")', timeout=5000)   # the hash changes before the screen is drawn
    ok(pg.locator('h1').inner_text().strip() == 'Mahalo!' and pg.locator('.sum').inner_text().strip() == 'Your email is on its way to the chair.', 'the email case: "Your email is on its way to the chair."')

    # 320 wide: no sideways scroll on either step.
    pg.set_viewport_size({'width': 320, 'height': 640}); pg.evaluate("localStorage.removeItem('hiphi_done_demo')")   # so send shows again
    for h, sel in (('#/HB2121/write', '#w-letter'), ('#/HB2121/send', '[data-copy]'), ('#/SB2175/send', '[data-via]'), ('#/HB2121/thanks', '[data-share]')):
        open_step(h, sel); sw = width()
        ok(sw[0] <= sw[1], f'{h}: no sideways scroll at 320 ({sw})')
    ok(not errs2, f'part 2 and 3: no page errors {errs2[:2]}')
    ok(not any('/rpc/log_' in u for u in reqs), f'the practice copy sends no count: no request to /rpc/log_ ({len(reqs)} requests)')
    ctx.close()

    # ---- Part 4: Bills and the tab bar ----
    ctx = br.new_context(viewport={'width': 390, 'height': 844})
    pg = ctx.new_page(); errs4 = []; pg.on('pageerror', lambda e: errs4.append(str(e)))
    def open_bills(h='#/bills'):
        pg.goto(BASE + h); pg.wait_for_selector('#b-res .r', timeout=60000); pg.evaluate(FONTS); pg.wait_for_function(IMGS, timeout=20000)
    open_bills()
    ok(pg.locator('h1').inner_text().strip() == 'Bills', 'Bills: the heading is "Bills"')
    chips = [c.inner_text().strip() for c in pg.locator('.chips .chip').all()]
    ok(len(chips) >= 4 and chips[0] == 'All' and 'Food & Nutrition' in chips and pg.locator('.chip[aria-pressed="true"]').inner_text().strip() == 'All', f'topic chips, All first and chosen ({chips[:4]})')
    dues = pg.locator('.voices a.r').evaluate_all('rs => rs.map(r => r.dataset.due)')
    ok(1 <= len(dues) <= 5 and all(dues) and dues == sorted(dues), f'Need voices now: at most five rows, testimony closing soonest first ({len(dues)})')
    ok(all(s.startswith('Testimony due ') for s in pg.locator('.voices a.r .t span').all_inner_texts()), 'each Need voices row says when testimony is due')
    n_all = pg.locator('.isec').count()
    ok(pg.locator('.isec h3').count() >= 3 and n_all >= 3, f'at least three issue sections ({n_all})')
    ok(pg.locator('#issue-disposable-e-cigarette-ban .th img.art-issue').count() == 1, 'an issue with a drawing shows it small beside its name')
    ok(pg.locator('.primary').count() == 1 and pg.locator('.primary').inner_text().strip() == 'Search', 'Bills: exactly one primary button, Search')
    budget = pg.evaluate("""() => { const H = innerHeight - document.querySelector('.tabs').getBoundingClientRect().height, inView = b => b.height && b.top < H && b.bottom > 0 && b.left < innerWidth && b.right > 0;
      const taps = [...document.querySelectorAll('#main a, #main button, #main input')].filter(e => inView(e.getBoundingClientRect())).length;
      let words = 0; const w = document.createTreeWalker(document.querySelector('#main'), NodeFilter.SHOW_TEXT);
      while (w.nextNode()) { const r = document.createRange(); r.selectNodeContents(w.currentNode); if (inView(r.getBoundingClientRect())) words += w.currentNode.textContent.trim().split(/\\s+/).filter(Boolean).length; }
      return { taps, words }; }""")
    ok(budget['taps'] <= 12 and budget['words'] <= 130, f'the first screenful: at most 12 things to tap and about 130 words, tab bar aside ({budget})')
    ok(pg.locator('.tabs a').count() == 3 and pg.locator('.tabs a[aria-current="page"]').inner_text().strip() == 'Bills' and pg.locator('.tabs').is_visible(), 'the tab bar shows on Bills, with Bills current')
    ok('vape' not in pg.content().lower(), 'Bills: no "vape"')
    sw = pg.evaluate('() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]')
    ok(sw[0] <= sw[1], f'Bills: no sideways scroll at 390 ({sw})')
    if SHOTS: pg.mouse.move(0, 0); pg.screenshot(path=os.path.join(SHOTS, 'part4-bills.png'))
    # Follow an issue: the tracker's own key, the practice copy's _demo one.
    f = pg.locator('#issue-disposable-e-cigarette-ban [data-follow]'); iid = f.get_attribute('data-follow')
    ok(f.get_attribute('aria-pressed') == 'false' and f.inner_text().strip() == 'Follow', 'an issue offers a quiet Follow')
    f.click(); f = pg.locator('#issue-disposable-e-cigarette-ban [data-follow]')
    ok(f.get_attribute('aria-pressed') == 'true' and 'Following' in f.inner_text() and iid in pg.evaluate("JSON.parse(localStorage.getItem('hiphi_issue_follows_demo') || '[]')"),
       'Follow becomes "Following ✓" and writes hiphi_issue_follows_demo, as track.html keeps it')
    f.click()
    ok(pg.locator('#issue-disposable-e-cigarette-ban [data-follow]').get_attribute('aria-pressed') == 'false' and iid not in pg.evaluate("JSON.parse(localStorage.getItem('hiphi_issue_follows_demo') || '[]')"), 'pressed again, it stops following')
    # Show N more.
    more = pg.locator('.isec [data-more]').first; sec = more.evaluate('b => b.closest(".isec").id'); before = pg.locator(f'#{sec} a.r').count()
    more.click(); ok(pg.locator(f'#{sec} a.r').count() > before and pg.locator(f'#{sec} [data-more]').count() == 0, f'"Show N more" shows the rest of the issue’s bills ({sec})')
    # Search.
    pg.fill('#b-q', 'e-cig'); pg.wait_for_timeout(100)
    n_cig = pg.locator('.isec').count(); names = pg.locator('.isec h3').all_inner_texts()
    ok(0 < n_cig < n_all and 'Disposable e-cigarette ban' in names and not any('school meals' in x.lower() for x in names) and pg.locator('.voices').count() == 0,
       f'typing "e-cig" narrows the list to the e-cigarette issues, the ban among them ({names})')
    ok(pg.locator('#b-q').evaluate('e => document.activeElement === e'), 'typing keeps the cursor in the search box')
    pg.fill('#b-q', 'hb 2121'); pg.locator('.primary').click(); pg.wait_for_timeout(100)
    ok(pg.locator('#b-res a.r[data-bill="HB2121"]').count() >= 1 and pg.locator('#b-res a.r').count() <= 3, 'a bill number with a space and Search finds the bill')
    pg.fill('#b-q', 'vape'); pg.wait_for_timeout(100)
    ok('Disposable e-cigarette ban' in pg.locator('.isec h3').all_inner_texts(), 'a search for vape still finds the e-cigarette bills (R-158)')
    pg.fill('#b-q', 'zzqx'); pg.wait_for_timeout(100)
    ok(pg.locator('.empty').inner_text().strip() == 'No bill matches. Try a word from its name.', 'no match: "No bill matches. Try a word from its name."')
    pg.fill('#b-q', ''); pg.wait_for_timeout(100)
    ok(pg.locator('.isec').count() == n_all, 'clearing the search brings every issue back')
    # The chips.
    pg.locator('.chip[data-topic="food"]').click(); pg.wait_for_timeout(100)
    names = pg.locator('.isec h3').all_inner_texts()
    ok(0 < len(names) < n_all and any('school meals' in x.lower() for x in names) and 'Disposable e-cigarette ban' not in names and pg.locator('.chip[aria-pressed="true"]').inner_text().strip() == 'Food & Nutrition',
       f'the Food & Nutrition chip narrows to its issues ({len(names)} of {n_all})')
    pg.locator('.chip[data-topic=""]').click(); pg.wait_for_timeout(100)
    # A row opens the bill; Back returns to Bills where it was.
    row = pg.locator('#issue-disposable-e-cigarette-ban a.r[data-bill="HB2121"]'); row.scroll_into_view_if_needed(); y0 = pg.evaluate('scrollY')
    row.click(); pg.wait_for_selector('.stand', timeout=10000)
    ok(pg.evaluate('location.hash') == '#/HB2121' and 'Disposable e-cigarette ban' in pg.locator('h1').inner_text().replace('\n', ' '), 'a row opens its bill')
    ok(pg.locator('.tabs').is_visible() and pg.locator('.primary').count() == 1, 'the tab bar shows on the bill, with its one primary button')
    btn = pg.locator('.primary').bounding_box(); tb = pg.locator('.tabs').bounding_box()
    ok(btn['y'] + btn['height'] <= tb['y'], f'the bill’s button is above the tab bar at 390x844 ({round(btn["y"] + btn["height"])} <= {round(tb["y"])})')
    p_of = pg.locator('.partof a')
    ok(p_of.inner_text().strip() == 'Part of Disposable e-cigarette ban' and p_of.get_attribute('href') == '#/bills/disposable-e-cigarette-ban', 'the bill says "Part of Disposable e-cigarette ban", a link to its issue on Bills')
    if SHOTS: pg.mouse.move(0, 0); pg.screenshot(path=os.path.join(SHOTS, 'part4-bill.png'))
    pg.locator('.back[data-back]').click(); pg.wait_for_selector('#b-res .r', timeout=10000)
    ok(pg.evaluate('location.hash') == '#/bills' and abs(pg.evaluate('scrollY') - y0) < 80, f'Back to Bills returns to the list where it was ({y0} -> {pg.evaluate("scrollY")})')
    # Part of: opens Bills at the issue.
    pg.goto(BASE + '#/HB2121'); pg.wait_for_selector('.partof a', timeout=10000); pg.locator('.partof a').click()
    pg.wait_for_selector('#issue-disposable-e-cigarette-ban', timeout=10000); pg.wait_for_timeout(100)
    top = pg.locator('#issue-disposable-e-cigarette-ban').bounding_box()['y']
    ok(0 <= top < 120 and pg.evaluate("document.activeElement.id") == 'ih-disposable-e-cigarette-ban', f'"Part of" opens Bills scrolled to that issue ({round(top)})')
    # The tab bar: not on Write; Home stands in for now (This week is part 5's, below).
    pg.goto(BASE + '#/HB2121/write'); pg.wait_for_selector('#w-letter', timeout=10000)
    ok(pg.locator('.tabs').count() == 0, 'no tab bar on Write')
    for h, cur, word in (('#/', 'Home', 'Home, coming next'),):
        pg.goto(BASE + h); pg.wait_for_selector('.tabs', timeout=10000)
        ok(pg.locator('h1').inner_text().strip() == word and pg.locator('.tabs a[aria-current="page"]').inner_text().strip() == cur and pg.locator('#main a[href="#/bills"]').count() == 1, f'{h}: "{word}", with a way to Bills')
    pg.locator('.tabs a[data-tab="bills"]').click(); pg.wait_for_selector('#b-res .r', timeout=10000)
    ok(pg.evaluate('location.hash') == '#/bills', 'the Bills tab opens Bills')
    pg.set_viewport_size({'width': 320, 'height': 640}); open_bills(); sw = pg.evaluate('() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]')
    ok(sw[0] <= sw[1], f'Bills: no sideways scroll at 320 ({sw})')
    ok(not errs4, f'part 4: no page errors {errs4[:2]}')
    ctx.close()

    # ---- Part 5: This week ----
    ctx = br.new_context(viewport={'width': 390, 'height': 844})
    pg = ctx.new_page(); errs5 = []; pg.on('pageerror', lambda e: errs5.append(str(e)))
    def open_week():
        pg.goto(BASE + '#/week'); pg.wait_for_selector('#main.week:not([aria-busy]) .pick', timeout=60000); pg.evaluate(FONTS)
    open_week()
    kick = pg.locator('.kicker').inner_text().strip()
    ok(kick.endswith('Mon, Mar 16') and pg.locator('h1').inner_text().strip() == 'This week at the Capitol', f'This week: the kicker has today’s date in Hawaiʻi and the heading ({kick!r})')
    # The soonest open deadline among HIPHI's bills at 9:00 am Mon 16 Mar: SB 3234's, 9:30 am today.
    one = pg.locator('.pick h2').inner_text().replace('\n', ' ').strip(); line = pg.locator('.pick .ln').inner_text().strip()
    ok(one == 'Safer walking routes next to schools' and line.startswith('Send by today 9:30 AM.') and 'Heard Tue, Mar 17.' in line, f'no follows: the one thing is the soonest deadline, SB 3234 ({one!r}, {line!r})')
    ok(pg.locator('.primary').count() == 1 and pg.locator('.pick .primary').inner_text().strip() == 'Send testimony' and pg.locator('.pick .primary').get_attribute('href') == '#/SB3234/write', 'exactly one primary button, Send testimony, to the bill’s letter')
    q = pg.locator('.wk-issues .calm a')
    ok(q.count() == 1 and q.inner_text().strip() == 'Follow an issue on Bills and its bills show here.' and q.get_attribute('href') == '#/bills', 'no follows: one quiet line to Bills under Your issues')
    days = pg.locator('.wk-hear h3.day').all_inner_texts()
    ats = pg.locator('.wk-hear a.r').evaluate_all('rs => rs.map(r => r.dataset.at)')
    subs = pg.locator('.wk-hear a.r .t span').all_inner_texts()
    import re
    ok(len(days) >= 2 and days == sorted(set(days), key=days.index) and ats == sorted(ats) and 1 <= len(ats) <= 10, f'hearings grouped by day, in order, ten rows at most ({days}, {len(ats)} rows)')
    ok(days[0].upper() == 'MON, MAR 16' and all(re.match(r'^(MON|TUE|WED|THU|FRI), ', d.upper()) for d in days), 'the days are weekdays from today, Hawaiʻi time')
    ok(all(re.match(r'^\d{1,2}:\d{2} [AP]M · (House|Senate) [A-Z]', s) for s in subs) and not any('Committee' in s or re.search(r'\b[A-Z]{3}\b', s.replace('AM', '').replace('PM', '')) for s in subs),
       f'each row: the time and the short committee name, no codes ({subs[:3]})')
    ok(any(s == '9:30 AM · House Transportation' for s in subs), '"9:30 AM · House Transportation" for SB 3234')
    ok(pg.locator('.wk-hear a', has_text='See all bills').get_attribute('href') == '#/bills', '"See all bills" goes to Bills')
    ok(pg.locator('.tabs a[aria-current="page"]').inner_text().strip() == 'This week', 'the tab bar shows This week current')
    budget = pg.evaluate("""() => { const H = innerHeight - document.querySelector('.tabs').getBoundingClientRect().height, inView = b => b.height && b.top < H && b.bottom > 0 && b.left < innerWidth && b.right > 0;
      const taps = [...document.querySelectorAll('#main a, #main button, #main input')].filter(e => inView(e.getBoundingClientRect())).length;
      let words = 0; const w = document.createTreeWalker(document.querySelector('#main'), NodeFilter.SHOW_TEXT);
      while (w.nextNode()) { const r = document.createRange(); r.selectNodeContents(w.currentNode); if (inView(r.getBoundingClientRect())) words += w.currentNode.textContent.trim().split(/\\s+/).filter(Boolean).length; }
      return { taps, words }; }""")
    ok(budget['taps'] <= 8 and budget['words'] <= 130, f'no follows, the first screenful: at most 8 things to tap and 130 words, tab bar aside ({budget})')
    ok('vape' not in pg.content().lower() and not any(c in pg.locator('#main').inner_text() for c in ('HD1', 'SD1', 'HHS', 'CPN', 'TRN')), 'This week: no "vape", no version or committee codes')
    if SHOTS: pg.mouse.move(0, 0); pg.screenshot(path=os.path.join(SHOTS, 'part5-week-nofollow.png'))
    # Follow the e-cigarette ban on Bills: the one thing comes from that issue, and Your issues lists it.
    pg.goto(BASE + '#/bills'); pg.wait_for_selector('#b-res .r', timeout=60000)
    pg.locator('#issue-disposable-e-cigarette-ban [data-follow]').click()
    pg.locator('.tabs a[data-tab="week"]').click(); pg.wait_for_selector('#main.week:not([aria-busy]) .pick', timeout=30000); pg.evaluate(FONTS)
    one = pg.locator('.pick h2').inner_text().replace('\n', ' ').strip(); line = pg.locator('.pick .ln').inner_text().strip()
    ok(one == 'Disposable e-cigarette ban' and line == 'Send by Wed 9:30 AM. Heard Fri, Mar 20.' and pg.locator('.pick .primary').get_attribute('href') == '#/HB2121/write',
       f'following the e-cigarette ban: the one thing is HB 2121 ({one!r}, {line!r})')
    ok(pg.locator('.kicker').inner_text().strip() == 'Aloha again. Mon, Mar 16', 'a person who follows an issue is greeted "Aloha again."')
    ih = pg.locator('.wk-issues h3.ih').all_inner_texts(); r1 = pg.locator('.wk-issues a.r').first
    ok(ih == ['Disposable e-cigarette ban'] and r1.get_attribute('data-bill') == 'HB2121' and r1.locator('.t span').inner_text().startswith('Heard Fri, Mar 20, 9:30 AM · Senate '),
       f'Your issues lists the issue, with HB 2121’s hearing this week ({ih}, {r1.locator(".t span").inner_text()!r})')
    ok(pg.locator('.primary').count() == 1, 'following: still exactly one primary button')
    budget = pg.evaluate("""() => { const H = innerHeight - document.querySelector('.tabs').getBoundingClientRect().height, inView = b => b.height && b.top < H && b.bottom > 0 && b.left < innerWidth && b.right > 0;
      const taps = [...document.querySelectorAll('#main a, #main button, #main input')].filter(e => inView(e.getBoundingClientRect())).length;
      let words = 0; const w = document.createTreeWalker(document.querySelector('#main'), NodeFilter.SHOW_TEXT);
      while (w.nextNode()) { const r = document.createRange(); r.selectNodeContents(w.currentNode); if (inView(r.getBoundingClientRect())) words += w.currentNode.textContent.trim().split(/\\s+/).filter(Boolean).length; }
      return { taps, words }; }""")
    ok(budget['taps'] <= 8 and budget['words'] <= 130, f'following, the first screenful: at most 8 things to tap and 130 words ({budget})')
    sw = pg.evaluate('() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]')
    ok(sw[0] <= sw[1], f'This week: no sideways scroll at 390 ({sw})')
    if SHOTS: pg.mouse.move(0, 0); pg.screenshot(path=os.path.join(SHOTS, 'part5-week.png'))
    # Follow a second issue with nothing this week: one line, the chairs' deadline (words.js).
    pg.goto(BASE + '#/bills'); pg.wait_for_selector('#b-res .r', timeout=60000)
    pg.locator('#issue-higher-liquor-taxes [data-follow]').click()
    pg.goto(BASE + '#/week'); pg.wait_for_selector('#main.week:not([aria-busy]) .pick', timeout=30000)
    wl = pg.locator('.wk-issues a.r[data-bill="HB1991"] .t span')
    ok(wl.count() == 1 and re.match(r'^No hearing yet\. The chairs have until \w{3}, \w{3} \d+\.$', wl.inner_text().strip()), f'an issue with nothing this week: "No hearing yet. The chairs have until …" ({wl.count() and wl.inner_text()!r})')
    # Send it: Yes, I sent it, and the card says so and offers the next bill.
    pg.locator('.pick .primary').click(); pg.wait_for_selector('#w-letter', timeout=10000)
    pg.fill('#w-name', 'Leilani Kahale'); pg.click('[data-next]'); pg.wait_for_selector('[data-capitol]', timeout=10000)
    pg.click('[data-capitol]'); pg.wait_for_selector('[data-sent]', timeout=3000); pg.click('[data-sent]'); pg.wait_for_selector('h1:has-text("Mahalo")', timeout=5000)
    pg.goto(BASE + '#/week')
    pg.wait_for_selector('#main.week:not([aria-busy]) .pick', timeout=30000)
    one2 = pg.locator('.pick h2').inner_text().replace('\n', ' ').strip() if pg.locator('.pick h2').count() else ''
    ok('You sent it: Disposable e-cigarette ban.' in pg.locator('.pick .okline').inner_text() and one2 and one2 != 'Disposable e-cigarette ban' and pg.locator('.primary').count() == 1,
       f'after Yes, I sent it: the card says "You sent it" and offers the next bill ({one2!r})')
    # A returning person who opens act.html with no address lands on This week.
    pg.goto(BASE); pg.wait_for_selector('#main.week:not([aria-busy])', timeout=30000)
    ok(pg.evaluate('location.hash') == '#/week' and pg.locator('.tabs a[aria-current="page"]').inner_text().strip() == 'This week', 'a returning person opening act.html lands on #/week')
    pg.set_viewport_size({'width': 320, 'height': 640}); open_week()
    sw = pg.evaluate('() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]')
    ok(sw[0] <= sw[1], f'This week: no sideways scroll at 320 ({sw})')
    ctx.close()
    # A first visit with no address still opens Home.
    ctx = br.new_context(viewport={'width': 390, 'height': 844}); pg2 = ctx.new_page(); pg2.on('pageerror', lambda e: errs5.append(str(e)))
    pg2.goto(BASE); pg2.wait_for_selector('.tabs', timeout=30000)
    ok(pg2.evaluate('location.hash') == '' and pg2.locator('.tabs a[aria-current="page"]').inner_text().strip() == 'Home', 'a first visit with no address stays on Home')
    ctx.close()
    ok(not errs5, f'part 5: no page errors {errs5[:2]}')
    br.close()

    # The failed load (B-8): the snapshot cannot be fetched, so the page says so and offers Try again.
    br = p.chromium.launch(); pg = br.new_page(viewport={'width': 390, 'height': 844})
    pg.route('**/demo/snapshot.json*', lambda r: r.abort())
    pg.goto(BASE + '#/HB2121'); pg.wait_for_selector('[data-retry]', timeout=20000)
    ok("We couldn’t load this bill" in pg.locator('h1').inner_text(), 'a failed load says "We couldn’t load this bill" with Try again, never "not found"')
    pg.unroute('**/demo/snapshot.json*'); pg.locator('[data-retry]').click(); pg.wait_for_selector('.primary:not([data-retry])', timeout=60000)
    ok('Disposable e-cigarette ban' in pg.locator('h1').inner_text().replace('\n', ' '), 'Try again loads the bill')
    br.close()
print(f"\n{sum(res)} passed, {len(res) - sum(res)} failed")
sys.exit(0 if all(res) else 1)
