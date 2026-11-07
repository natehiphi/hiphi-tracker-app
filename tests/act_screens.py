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
# Part 6: Home (#/), the front door: what HIPHI does, This week's one thing as a card with the one primary button, four issues
# opening Bills at each, All issues, the footer to the tracker's pages. Saves part6-home (390x844) and part6-home-laptop.
# Fix pass 2 (R-360): one deadline wording everywhere ("Send testimony by ..."), "Hearing" for hearings ahead, every hearing
# reachable on This week (Show N more hearings), Back links that go back in the history, Bills remembered across a reload,
# the bill lighting the tab it came from, no "Part of" when the names match, amber only within 24 hours.
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
    ok(first.startswith('Send testimony by Wed 9:30 AM.') and 'Two Senate committees hear it Fri, Mar 20. You don’t need to go.' in first, f'the deadline leads in the shared wording, then who hears it and when ({first!r})')
    second = pg.locator('.stand .ln').nth(1).inner_text().strip()
    ok(second == 'Passed the House. Now in the Senate.', f'the second line says only where it has been and is, the committees being named above ({second!r}) (fix 7)')
    ok(pg.locator('.partof').count() == 0, 'no "Part of Disposable e-cigarette ban" under a bill of that name (fix 7, A-14)')
    ok(pg.locator('.tabs a[aria-current]').count() == 0, 'a bill opened first from a link lights no tab (B-4)')
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
    ok(pg.locator('a', has_text='See HIPHI’s other bills').get_attribute('href') == '#/bills' and pg.locator('#main a[href^="track.html"]').count() == 0, 'thanks: "See HIPHI’s other bills" goes to Bills, in the app (part 6)')
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
    ok(pg.locator('.voices h2').inner_text().strip() == 'Needs voices this week' and 1 <= len(dues) <= 5 and all(dues) and dues == sorted(dues) and all(d < '2026-03-23T10:00' for d in dues),
       f'"Needs voices this week", as Home names it: at most five rows, this week’s deadlines, soonest first ({len(dues)}) (fix 9)')
    vs = pg.locator('.voices a.r .t > span').all_inner_texts()
    ok(all(s.startswith('Send testimony by ') for s in vs) and 'Send testimony by today 9:30 AM' in vs, f'each row says the deadline in the shared wording ({vs[:2]}) (fix 6)')
    n_all = pg.locator('.isec').count()
    ok(pg.locator('.isec h3').count() >= 3 and n_all >= 3, f'at least three issue sections ({n_all})')
    ok(pg.locator('#issue-disposable-e-cigarette-ban .th img.art-issue').count() == 1, 'an issue with a drawing shows it small beside its name')
    ok(pg.locator('.primary').count() == 0 and pg.locator('.find .secondary').inner_text().strip() == 'Search', 'Bills: Search is an outlined button, and Bills has no filled one (fix 12)')
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
    pg.reload(); pg.wait_for_selector('#b-res .r', timeout=60000)
    ok(pg.locator('#b-q').input_value() == 'e-cig' and pg.locator('.isec').count() == n_cig, f'a reload keeps the search and its results ({pg.locator("#b-q").input_value()!r}) (fix 3, B-6)')
    pg.fill('#b-q', 'hb 2121'); pg.locator('.find .secondary').click(); pg.wait_for_timeout(100)
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
    ok(pg.locator('.tabs a[aria-current="page"]').inner_text().strip() == 'Bills', 'a bill opened from Bills lights Bills (fix 4)')
    btn = pg.locator('.primary').bounding_box(); tb = pg.locator('.tabs').bounding_box()
    ok(btn['y'] + btn['height'] <= tb['y'], f'the bill’s button is above the tab bar at 390x844 ({round(btn["y"] + btn["height"])} <= {round(tb["y"])})')
    ok(pg.locator('.partof').count() == 0, 'HB 2121 is called what its issue is called: no "Part of" line (fix 7)')
    if SHOTS: pg.mouse.move(0, 0); pg.screenshot(path=os.path.join(SHOTS, 'part4-bill.png'))
    pg.locator('.back[data-back]').click(); pg.wait_for_selector('#b-res .r', timeout=10000)
    ok(pg.evaluate('location.hash') == '#/bills' and abs(pg.evaluate('scrollY') - y0) < 80, f'Back to Bills returns to the list where it was ({y0} -> {pg.evaluate("scrollY")})')
    # Fix 2 (B-4): Back to Bills goes back in the history, so the browser's Back then goes to where Bills was opened from,
    # never to the bill again; Write's Back to the bill does the same.
    pg.goto(BASE + '#/week'); pg.wait_for_selector('#main.week:not([aria-busy]) .pick', timeout=30000)
    pg.locator('.tabs a[data-tab="bills"]').click(); pg.wait_for_selector('#b-res .r', timeout=10000)
    pg.locator('#issue-disposable-e-cigarette-ban a.r[data-bill="HB2121"]').click(); pg.wait_for_selector('.stand', timeout=10000)
    pg.locator('.back[data-back]').click(); pg.wait_for_selector('#b-res .r', timeout=10000)
    pg.go_back(); pg.wait_for_timeout(300)
    ok(pg.evaluate('location.hash') == '#/week', f'after Back to Bills, the browser’s Back goes to This week, not to the bill ({pg.evaluate("location.hash")}) (fix 2)')
    pg.go_forward(); pg.wait_for_selector('#b-res .r', timeout=10000)
    pg.locator('#issue-disposable-e-cigarette-ban a.r[data-bill="HB2121"]').click(); pg.wait_for_selector('.stand', timeout=10000)
    pg.locator('.cta .primary').click(); pg.wait_for_selector('#w-letter', timeout=10000)
    pg.locator('.back').click(); pg.wait_for_selector('.stand', timeout=10000)
    pg.go_back(); pg.wait_for_timeout(300)
    ok(pg.evaluate('location.hash') == '#/bills', f'after Write’s Back to the bill, the browser’s Back goes to Bills, not to Write ({pg.evaluate("location.hash")}) (fix 2)')
    # Part of: opens Bills at the issue (HB 108, "Beer and spirits shipped to homes", is part of "Looser alcohol sales rules").
    pg.goto(BASE + '#/HB108'); pg.wait_for_selector('.partof a', timeout=10000)
    p_of = pg.locator('.partof a')
    ok(p_of.inner_text().strip() == 'Part of Looser alcohol sales rules' and p_of.get_attribute('href') == '#/bills/looser-alcohol-sales-rules', 'a bill named apart from its issue says "Part of Looser alcohol sales rules", a link to its issue on Bills')
    p_of.click()
    pg.wait_for_selector('#issue-looser-alcohol-sales-rules', timeout=10000); pg.wait_for_timeout(100)
    top = pg.locator('#issue-looser-alcohol-sales-rules').bounding_box()['y']
    ok(0 <= top < 120 and pg.evaluate("document.activeElement.id") == 'ih-looser-alcohol-sales-rules', f'"Part of" opens Bills scrolled to that issue ({round(top)})')
    # The tab bar: not on Write; on Home (part 6, below), with Home current.
    pg.goto(BASE + '#/HB2121/write'); pg.wait_for_selector('#w-letter', timeout=10000)
    ok(pg.locator('.tabs').count() == 0, 'no tab bar on Write')
    pg.goto(BASE + '#/'); pg.wait_for_selector('#main.home:not([aria-busy])', timeout=30000)
    ok(pg.locator('.tabs a[aria-current="page"]').inner_text().strip() == 'Home' and pg.locator('#main a[href="#/bills"]').count() >= 1, '#/: Home, current in the tab bar, with a way to Bills')
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
    ok(one == 'Safer walking routes next to schools' and line == 'Send testimony by today 9:30 AM. The committee hears it Tue, Mar 17.', f'no follows: the one thing is the soonest deadline, SB 3234, in the shared wording, the hearing ahead ({one!r}, {line!r}) (fixes 5, 6)')
    ok(pg.locator('.pick .lab1').evaluate('e => getComputedStyle(e).color') == 'rgb(0, 105, 142)', 'the "Your one thing this week" label is blue (--p700), not orange (fix 11, A-5)')
    ok(pg.locator('.primary').count() == 1 and pg.locator('.pick .primary').inner_text().strip() == 'Send testimony' and pg.locator('.pick .primary').get_attribute('href') == '#/SB3234/write', 'exactly one primary button, Send testimony, to the bill’s letter')
    q = pg.locator('.wk-issues .calm a')
    ok(q.count() == 1 and q.inner_text().strip() == 'Bills' and q.get_attribute('href') == '#/bills' and pg.locator('.wk-issues .calm').inner_text().strip() == 'Follow an issue on Bills, and its hearings will show here.',
       'no follows: "Follow an issue on Bills, and its hearings will show here.", only "Bills" a link (fix 10)')
    ok(pg.locator('.wk-hear h2').inner_text().strip() == 'Hearings on bills we follow', 'the section is "Hearings on bills we follow" (fix 10)')
    days = pg.locator('.wk-hear h3.day').evaluate_all('hs => hs.map(h => h.textContent.trim())')
    ats = pg.locator('.wk-hear a.r').evaluate_all('rs => rs.map(r => r.dataset.at)')
    shown = pg.locator('.wk-hear a.r:not([hidden])').count()
    subs = pg.locator('.wk-hear a.r .t > span').evaluate_all('ss => ss.map(s => s.textContent)')
    import re
    ok(len(days) >= 2 and days == sorted(set(days), key=days.index) and ats == sorted(ats) and 1 <= shown <= 10 and len(ats) > shown, f'hearings grouped by day, in order, ten rows shown of all of them ({days}, {shown} of {len(ats)})')
    ok(all(re.search(r'\S[HS]B \d+$', n) and not re.match(r'^[HS]B \d+$', n) for n in pg.locator('.wk-hear a.r .t b').evaluate_all('bs => bs.map(b => b.textContent.trim())')), 'each row is titled by its everyday name, the number small after it (fix 8)')
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
    # Fix 1 (B-3): nothing is cut silently. Thursday's and Friday's hearings wait behind "Show N more hearings", which shows them.
    vis = lambda: pg.evaluate("() => [...document.querySelectorAll('.wk-hear .dgrp')].filter(g => !g.hidden).map(g => g.querySelector('h3').textContent.trim().slice(0, 3).toUpperCase())")
    more = pg.locator('[data-morehear]'); before = vis()
    ok(more.count() == 1 and re.match(r'^Show \d+ more hearings?$', more.inner_text().strip()) and 'THU' not in before and 'FRI' not in before, f'"{more.inner_text().strip() if more.count() else ""}" holds the rest of the week ({before})')
    more.click(); after = vis()
    ok('THU' in after and 'FRI' in after and pg.locator('.wk-hear a.r[hidden]').count() == 0 and pg.locator('[data-morehear]').count() == 0 and pg.evaluate("document.activeElement.matches('.wk-hear a.r')"),
       f'Show more reveals every hearing, Thursday’s and Friday’s among them, and moves the focus to the first one shown ({after}) (fix 1)')
    last = pg.locator('.wk-hear a').last
    ok(last.inner_text().strip() == 'See all bills', '"See all bills" stays at the end')
    # Fix 4: a bill opened from This week lights This week.
    pg.locator('.wk-hear a.r[data-bill="SB3234"]').click(); pg.wait_for_selector('.stand', timeout=10000)
    ok(pg.locator('.tabs a[aria-current="page"]').inner_text().strip() == 'This week' and pg.locator('.back[data-back]').count() == 0, 'a bill opened from This week lights This week (fix 4)')
    # Follow the e-cigarette ban on Bills: the one thing comes from that issue, and Your issues lists it.
    pg.goto(BASE + '#/bills'); pg.wait_for_selector('#b-res .r', timeout=60000)
    pg.locator('#issue-disposable-e-cigarette-ban [data-follow]').click()
    pg.locator('.tabs a[data-tab="week"]').click(); pg.wait_for_selector('#main.week:not([aria-busy]) .pick', timeout=30000); pg.evaluate(FONTS)
    one = pg.locator('.pick h2').inner_text().replace('\n', ' ').strip(); line = pg.locator('.pick .ln').inner_text().strip()
    ok(one == 'Disposable e-cigarette ban' and line == 'Send testimony by Wed 9:30 AM. The committees hear it Fri, Mar 20.' and pg.locator('.pick .primary').get_attribute('href') == '#/HB2121/write',
       f'following the e-cigarette ban: the one thing is HB 2121, its hearing ahead said as ahead ({one!r}, {line!r}) (fix 5)')
    ok(pg.locator('.pick .ln.soon').count() == 0, 'a deadline two days out is not amber (fix 11, A-5: amber only within 24 hours)')
    fr = pg.locator('.wk-hear a.r[data-bill="HB2121"]')
    ok(fr.count() == 1 and fr.is_visible() and 'FRI' in pg.evaluate("() => [...document.querySelectorAll('.wk-hear .dgrp')].filter(g => !g.hidden).map(g => g.querySelector('h3').textContent.trim().slice(0, 3).toUpperCase())"),
       'the one thing’s own Friday hearing is never among the hidden ones (fix 1)')
    ok(pg.locator('.kicker').inner_text().strip() == 'Aloha again. Mon, Mar 16', 'a person who follows an issue is greeted "Aloha again."')
    ih = pg.locator('.wk-issues h3.ih').all_inner_texts()
    ok(ih == ['Disposable e-cigarette ban'] and pg.locator('.wk-issues a.r[data-bill="HB2121"]').count() == 0 and pg.locator('.wk-issues .calm.quiet').inner_text().strip() == 'Its bill is your one thing above.',
       f'Your issues lists the issue and leaves its bill to the card above, with one quiet line ({ih}) (fix 8)')
    hs = pg.locator('.wk-issues a.r .t > span').all_inner_texts()
    ok(not any(x.startswith('Heard ') for x in hs) and all(x.startswith(('Hearing ', 'Send testimony by ')) for x in hs), f'an issue’s rows say "Hearing ..." for hearings ahead, never "Heard" ({hs[:2]}) (fix 5)')
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
    wl = pg.locator('.wk-issues a.r[data-bill="HB1991"] .t > span')
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

    # ---- Part 6: Home, the front door ----
    ctx = br.new_context(viewport={'width': 390, 'height': 844})
    pg = ctx.new_page(); errs6 = []; pg.on('pageerror', lambda e: errs6.append(str(e)))
    def open_home(h=''):
        pg.goto(BASE + h); pg.wait_for_selector('#main.home:not([aria-busy]) .pick', timeout=60000); pg.evaluate(FONTS); pg.wait_for_function(IMGS, timeout=20000)
    open_home()
    ok(pg.evaluate('location.hash') == '' and pg.locator('.tabs a[aria-current="page"]').inner_text().strip() == 'Home', 'Home: a first visit with no address lands on Home, Home current')
    ok(pg.title() == 'HIPHI Bill Tracker', f'act.html is titled "HIPHI Bill Tracker" ({pg.title()!r})')
    ok(pg.locator('h1').inner_text().replace('\n', ' ').strip() == 'Speak up for a healthier Hawaiʻi' and pg.locator('.lede').inner_text().strip() == 'We follow the health bills at the Capitol and tell you when your voice counts.', 'Home: the heading and what HIPHI does')
    ok(pg.locator('.hd svg.art-hello').count() == 1 and 'HIPHI Bill Tracker' in pg.locator('.hd .brand').inner_text(), 'Home: the rainbow-and-people drawing, with the HIPHI pill')
    ok(pg.locator('h2.sec').all_inner_texts()[:2] == ['Needs voices this week', 'Or start with what you care about'], 'Home: the two sections in order')
    # The one thing is This week's (week.js weekData): with no follows at 9:00 am Mon 16 Mar, SB 3234.
    nm, ln = pg.locator('.pick h3').inner_text().replace('\n', ' ').strip(), pg.locator('.pick .ln').inner_text().strip()
    ok(nm == 'Safer walking routes next to schools' and pg.locator('.pick .num').inner_text().strip() == 'SB 3234' and pg.locator('.pick .pos').inner_text().strip() == 'HIPHI supports', f'the card: the one thing This week offers, its number and position ({nm!r})')
    ok(ln == 'Send testimony by today 9:30 AM. The House Transportation Committee meets on it Tue, Mar 17. You don’t need to go.', f'the card: when to send by, in the shared wording, who meets on it and when ({ln!r}) (fixes 6, 10)')
    hb = pg.locator('.hd.hello').bounding_box(); cy = pg.locator('.pick').bounding_box()['y']
    ok(135 <= hb['height'] <= 150 and cy <= 335, f'Home: the drawing about 140px tall, so the card starts near 320px ({round(hb["height"])}, card at {round(cy)}) (fix 13, A-1)')
    ok(pg.locator('.tabs a').first.evaluate('e => getComputedStyle(e).fontSize') == '13px', 'tab labels at the 13px token (fix 13, A-4)')
    hw = pg.locator('.foot a').first.bounding_box()
    ok(hw['width'] >= 44 and hw['height'] >= 44, f'the footer’s Help is at least 44 by 44 ({round(hw["width"])}x{round(hw["height"])}) (fix 13, A-6)')
    ps = pg.locator('.pick .psum').inner_text().strip()
    ok(ps.endswith('.') and ps.count('. ') == 0, f'the card: a one-sentence summary ({ps!r})')
    ok(pg.locator('.primary').count() == 1 and pg.locator('.pick .primary').inner_text().strip() == 'Send testimony' and pg.locator('.pick .primary').get_attribute('href') == '#/SB3234/write'
       and pg.locator('.pick .small').inner_text().strip() == 'About 10 minutes. We help you write it.', 'Home: exactly one primary button, Send testimony to the letter, "About 10 minutes"')
    rows = pg.locator('a.ri'); slugs = rows.evaluate_all('rs => rs.map(r => r.dataset.issue)')
    ok(rows.count() == 4 and all(rows.nth(k).get_attribute('href') == '#/bills/' + slugs[k] for k in range(4)) and all(rows.nth(k).locator('.lab').count() == 1 for k in range(4)), f'four issues, each with its topic, each to Bills at the issue ({slugs})')
    ok(rows.locator('.th img').count() >= 1, 'an issue with a drawing shows it small')
    ok(pg.locator('#main a', has_text='All issues').get_attribute('href') == '#/bills', '"All issues" goes to Bills')
    feet = pg.locator('.foot a').evaluate_all('as => as.map(a => [a.textContent.trim(), a.getAttribute("href")])')
    ok(feet == [['Help', 'track.html?demo=1#/help'], ['Privacy', 'track.html?demo=1#/privacy'], ['For advocacy groups', 'track.html?demo=1#/groups'], ['The full tracker', 'track.html?demo=1']], f'the footer: Help, Privacy, For advocacy groups, The full tracker, in the practice copy ({feet})')
    budget = pg.evaluate("""() => { const H = innerHeight - document.querySelector('.tabs').getBoundingClientRect().height, inView = b => b.height && b.top < H && b.bottom > 0 && b.left < innerWidth && b.right > 0;
      const taps = [...document.querySelectorAll('#app a, #app button, #app input')].filter(e => !e.closest('.tabs') && inView(e.getBoundingClientRect())).length;
      const words = document.querySelector('#main').innerText.split(/\\s+/).filter(Boolean).length;
      return { taps, words }; }""")
    # 130 words, as This week's budget: fix pass 2 (item 10) added the committee's name and "You don't need to go." (126).
    ok(budget['taps'] <= 8 and budget['words'] <= 130, f'Home: the first screenful at most 8 things to tap (tab bar aside), the page at most 130 words ({budget})')
    ok('vape' not in pg.content().lower(), 'Home: no "vape"')
    sw = pg.evaluate('() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]')
    ok(sw[0] <= sw[1], f'Home: no sideways scroll at 390 ({sw})')
    if SHOTS: pg.mouse.move(0, 0); pg.screenshot(path=os.path.join(SHOTS, 'part6-home.png'))
    # Each issue row opens Bills scrolled to that issue.
    good = 0
    for sl in slugs:
        open_home('#/'); pg.locator(f'a.ri[data-issue="{sl}"]').click()
        pg.wait_for_selector(f'#issue-{sl}', timeout=10000); pg.wait_for_timeout(100)
        top = pg.locator(f'#issue-{sl}').bounding_box()['y']
        good += pg.evaluate('location.hash') == '#/bills/' + sl and 0 <= top < 120 and pg.evaluate('document.activeElement.id') == 'ih-' + sl
    ok(good == 4, f'each of the four issues opens Bills at that issue ({good} of 4)')
    # A followed issue comes first: follow the fourth on Bills, and Home leads with it.
    pg.goto(BASE + '#/bills'); pg.wait_for_selector('#b-res .r', timeout=60000)
    pg.locator(f'#issue-{slugs[3]} [data-follow]').click()
    pg.locator('.tabs a[data-tab="home"]').click(); pg.wait_for_selector('#main.home:not([aria-busy]) .pick', timeout=30000)
    ok(pg.locator('a.ri').first.get_attribute('data-issue') == slugs[3] and pg.locator('a.ri').count() == 4, f'a followed issue leads the four ({pg.locator("a.ri").first.get_attribute("data-issue")})')
    ok(pg.locator('.tabs a[aria-current="page"]').inner_text().strip() == 'Home', 'the Home tab opens Home, current')
    # The bill screen keeps "Read the whole bill at the Capitol"; the inner screens' slim band keeps the HIPHI pill.
    pg.goto(BASE + '#/HB2121'); pg.wait_for_selector('#main:not([aria-busy]) .primary', timeout=30000)
    ok(pg.locator('a', has_text='Read the whole bill at the Capitol').count() == 1, 'the bill screen keeps "Read the whole bill at the Capitol"')
    pg.goto(BASE + '#/bills'); pg.wait_for_selector('#b-res .r', timeout=30000)
    ok(pg.locator('.hd.slim .brand').inner_text().strip() == 'HIPHI', 'the slim band on the inner screens keeps the HIPHI pill')
    ctx.close()
    # Nothing needs voices (no hearings ahead): a calm line, and the one primary becomes See the bills.
    ctx = br.new_context(viewport={'width': 390, 'height': 844}); pg = ctx.new_page(); pg.on('pageerror', lambda e: errs6.append(str(e)))
    import json
    def quiet(route):
        r = route.fetch(); d = r.json(); d['hearings'] = []; route.fulfill(response=r, body=json.dumps(d), headers={**r.headers, 'content-type': 'application/json'})
    pg.route('**/demo/snapshot.json*', quiet)
    pg.goto(BASE + '#/'); pg.wait_for_selector('#main.home:not([aria-busy]) .pick', timeout=60000)
    ok(pg.locator('.primary').count() == 1 and pg.locator('.pick .primary').inner_text().strip() == 'See the bills' and pg.locator('.pick .primary').get_attribute('href') == '#/bills'
       and 'Nothing needs your voice this week' in pg.locator('.pick .calm').inner_text(), 'nothing needs voices: a calm line, and the one primary is See the bills')
    ctx.close()
    # Phones' narrowest width, and a laptop: the centred column holds.
    ctx = br.new_context(viewport={'width': 320, 'height': 640}); pg = ctx.new_page(); pg.on('pageerror', lambda e: errs6.append(str(e)))
    open_home('#/'); sw = pg.evaluate('() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]')
    ok(sw[0] <= sw[1], f'Home: no sideways scroll at 320 ({sw})')
    ctx.close()
    ctx = br.new_context(viewport={'width': 1280, 'height': 800}); pg = ctx.new_page(); pg.on('pageerror', lambda e: errs6.append(str(e)))
    open_home('#/')
    box = pg.locator('#app').bounding_box(); tb = pg.locator('.tabs').bounding_box()
    # Fix 13: at 600 wide no head meets the sheet's edge (the drawing's heads all end above the sheet's top).
    heads = pg.evaluate("() => { const s = document.querySelector('.sheet').getBoundingClientRect().top; return [...document.querySelectorAll('.hd.hello ellipse')].map(e => e.getBoundingClientRect().bottom - s); }")
    ok(heads and max(heads) <= 0, f'laptop: every head in the drawing ends above the sheet ({[round(h) for h in heads]}) (fix 13)')
    bub = pg.locator('.hd.hello .bubble').bounding_box(); chip = pg.locator('.hd .demo').bounding_box()
    ok(bub['x'] + bub['width'] <= chip['x'] or bub['y'] >= chip['y'] + chip['height'], 'laptop: the practice chip does not cover the speech bubble (fix 13)')
    ok(box['width'] <= 600 and abs(box['x'] + box['width'] / 2 - 640) < 2 and abs(tb['x'] - box['x']) < 2 and tb['width'] <= 600, f'laptop: one centred column, the tab bar under it ({box["x"]}, {box["width"]})')
    if SHOTS: pg.mouse.move(0, 0); pg.screenshot(path=os.path.join(SHOTS, 'part6-home-laptop.png'))
    pg.goto(BASE + '#/bills'); pg.wait_for_selector('#b-res .r', timeout=30000)
    cr = pg.locator('.chips').bounding_box(); last = pg.locator('.chips .chip').last.bounding_box()
    ok(pg.locator('.chips').evaluate('e => getComputedStyle(e).flexWrap') == 'wrap' and last['x'] + last['width'] <= cr['x'] + cr['width'] + 1, 'laptop: the topic chips wrap, so a mouse reaches every one (fix 13, A-9)')
    ctx.close()
    ok(not errs6, f'part 6: no page errors {errs6[:2]}')
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
