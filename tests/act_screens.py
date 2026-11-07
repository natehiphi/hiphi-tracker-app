# R-360: act.html, one bill and one action, in the practice copy (frozen 16 Mar 2026, when HB 2121 has a Senate
# hearing on Fri 20 Mar and testimony is open). Part 1: the bill screen at a phone's size, the one button, the words, and
# the not-found state. Part 2: writing the letter (#/HB2121/write), sending it (#/HB2121/send: the copy, the Capitol's
# steps, "Yes, I sent it" recorded as the tracker records it) and the email to the chair for SB 2175. Saves screenshots
# at 390x844 (part1-390, part2-write, part2-send) and 320x640. Part 3: the Mahalo screen (part3-thanks at 390x844), Share with
# a friend (the bill's link, without /thanks), the email case, and that the practice copy sends no count to /rpc/log_.
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
