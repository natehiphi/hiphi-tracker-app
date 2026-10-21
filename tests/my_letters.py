# Your letters (R-212 #27; the Capitol Regular walk: "a sent letter could not be found again once its hearing was past").
# In the practice copy with ?letter (testimony on HB 2121 for its House Health hearing) and ?email (an email on HB 1563):
#   - "Your session" (#/recap): each acted row says the stance and the day acted ("HB 2121 · You testified in support on Tue, Feb 17."),
#     and "Your letter" / "Your email" under it open the reader with the right words, title, file name and copy button;
#   - the profile (with a hiphi_text number, so it is a profile; the practice copy keeps it as hiphi_text_demo) has "Your letters": every kept letter, newest first, each
#     saying "House Health Committee hearing" (the chamber kept), and a row opens it;
#   - a letter whose hearing the page no longer holds still opens (from its committee and date);
#   - no page errors, on a phone and a laptop.
#   python3 tests/my_letters.py [base]     base defaults to http://localhost:8832/track.html?demo=1&letter&email
import sys, os
from playwright.sync_api import sync_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832/track.html?demo=1&letter&email'
if 'letter' not in BASE: BASE += ('&' if '?' in BASE else '?') + 'letter&email'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out', 'my_letters'); os.makedirs(OUT, exist_ok=True)
res = []
def ok(c, m): res.append(bool(c)); print('PASS' if c else 'FAIL', m)
def ready(pg): pg.wait_for_function("() => !!document.querySelector('main') && !document.querySelector('.skelpage')", timeout=60000); pg.wait_for_timeout(900)
SKIP = "() => { try { const w = JSON.parse(localStorage.getItem('hiphi_wiz') || '{}'); localStorage.setItem('hiphi_wiz', JSON.stringify({ ...w, done: true, step: 99 })); for (const k of ['hiphi_tour_bill', 'hiphi_tour_home', 'hiphi_tour_bill_demo', 'hiphi_tour_home_demo']) localStorage.setItem(k, '{\"how\":\"test\"}'); for (const k of ['hiphi_text', 'hiphi_text_demo']) localStorage.setItem(k, JSON.stringify({ token: 'test-token', phone: '8085550142', at: '2026-02-01T00:00:00.000Z' })); } catch {} }"
dlg = lambda pg: pg.locator('#hp-dlg').inner_text() if pg.locator('#hp-dlg').count() else ''
def close(pg):
    pg.locator('#hp-dlg [data-hp="close"]').first.click(); pg.wait_for_timeout(600)
def reader(pg, sel, label):
    pg.locator(sel).first.click(); pg.wait_for_selector('#hp-dlg', timeout=15000); pg.wait_for_timeout(800)
    return dlg(pg), (pg.input_value('#hp-letter') if pg.locator('#hp-letter').count() else '')

with sync_playwright() as p:
    br = p.chromium.launch()
    for name, vp, mob in (('phone', {'width': 390, 'height': 844}, True), ('laptop', {'width': 1280, 'height': 860}, False)):
        ctx = br.new_context(viewport=vp, is_mobile=mob, has_touch=mob); ctx.add_init_script(f"({SKIP})()")
        pg = ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(BASE + '#/recap'); ready(pg)

        # 1. The session page: day and stance lead each acted row; the buttons sit under it.
        rows = [w.inner_text() for w in pg.locator('.hm-impw').all()]
        r2121 = next((r for r in rows if 'HB 2121' in r), ''); r1563 = next((r for r in rows if 'HB 1563' in r), '')
        ok('HB 2121 · You testified in support on Tue, Feb 17.' in r2121, f'{name}: HB 2121 leads with its day and stance ({r2121[:90]!r})')
        ok('HB 1563 · You emailed the chair in support on Wed, Feb 25.' in r1563, f'{name}: HB 1563 leads with its day and stance ({r1563[:90]!r})')
        ok('Your letter' in r2121 and 'Your email' not in r2121, f'{name}: "Your letter" under HB 2121, no email button')
        ok('Your email' in r1563 and 'Your letter' not in r1563, f'{name}: "Your email" under HB 1563')
        ok(pg.locator('.hm-impw .hm-implet [data-myl]').count() == 2 and pg.locator('a.hm-imp [data-myl]').count() == 0,
           f'{name}: the two buttons sit outside the rows\' links')
        if name == 'phone': pg.screenshot(path=os.path.join(OUT, f'recap-{name}.png'), full_page=True)

        # 2. "Your letter" opens the reader on the letter.
        t, words = reader(pg, '.hm-implet [data-myl]:not([data-myl^="email:"])', 'letter')
        ok('Your letter on HB 2121' in t and 'House Health Committee hearing' in t and 'Tue, Feb 17' in t and 'Wed, Feb 18' in t, f'{name}: "Your letter" opens "Your letter on HB 2121": sent Tue, Feb 17, for the House Health hearing of Wed, Feb 18')
        ok('Copy my letter' in t and 'Download as a file' in t and 'Email it to myself' in t, f'{name}: the letter reader copies, downloads, emails to myself')
        ok('HB 2121' in words or 'H.B. 2121' in words or len(words) > 200, f'{name}: the letter has its words ({len(words)} characters)')
        if name == 'phone':
            with pg.expect_download() as d: pg.locator('#hp-dlg [data-hp="dl"], #hp-dlg :text("Download as a file")').first.click()
            ok(d.value.suggested_filename == 'HB2121-testimony.txt', f'{name}: it downloads as HB2121-testimony.txt ({d.value.suggested_filename})')
        close(pg); ok(not pg.locator('#hp-dlg').count() or not pg.locator('#hp-dlg').is_visible(), f'{name}: Close closes the reader')

        # 3. "Your email" opens it as an email.
        t, words = reader(pg, '.hm-implet [data-myl^="email:"]', 'email')
        ok('Your email about HB 1563' in t, f'{name}: "Your email" opens "Your email about HB 1563"')
        ok('Copy my email' in t and 'Copy my letter' not in t, f'{name}: the email reader\'s button says "Copy my email"')
        ok('The email as you sent it on Wed, Feb 25' in t and 'House Finance' in t, f'{name}: it says when and to which chair it went')
        ok(words.startswith('Aloha Chair') and 'support HB 1563' in words, f'{name}: the email has its words')
        ok('Need to change it?' not in t, f'{name}: no "change it at the committee" line on an email')
        if name == 'phone':
            with pg.expect_download() as d: pg.locator('#hp-dlg :text("Download as a file")').first.click()
            ok(d.value.suggested_filename == 'HB1563-email.txt', f'{name}: it downloads as HB1563-email.txt ({d.value.suggested_filename})')
        close(pg)

        # 4. The profile lists both, newest first, with the committee's full name.
        pg.goto(BASE + '#/profile'); ready(pg)
        sec = pg.locator('.myl-rows')
        ok(sec.count() == 1, f'{name}: the profile has "Your letters"')
        ok(pg.get_by_text('The Capitol posts testimony publicly').count() >= 1 and not pg.get_by_text('Only you can see').count(), f'{name}: its lede says testimony is public, never "only you can see them"')
        lst = [r.inner_text().replace('\n', ' ') for r in pg.locator('.myl-rows [data-myl]').all()]
        ok(len(lst) == 2 and 'Email on HB 1563' in lst[0] and 'Letter on HB 2121' in lst[1], f'{name}: email (25 Feb) above testimony (17 Feb): {lst}')
        ok(any('House Health Committee hearing' in r for r in lst) and not any(' Health hearing' in r.replace('Health Committee hearing', '') for r in lst),
           f'{name}: the testimony row says "House Health Committee hearing", not "Health hearing"')
        ok(any('To the House Finance Committee chair' in r for r in lst), f'{name}: the email row says which chair')
        if name == 'phone': pg.locator('.myl-rows').first.scroll_into_view_if_needed(); pg.screenshot(path=os.path.join(OUT, f'profile-{name}.png'))
        t, _ = reader(pg, '.myl-rows [data-myl]:not([data-myl^="email:"])', 'letter')
        ok('Your letter on HB 2121' in t, f'{name}: a profile row opens the letter')
        close(pg)

        # 5. A letter whose hearing is no longer loaded still opens, from its committee and date.
        pg.evaluate("""() => { const m = JSON.parse(localStorage.getItem('hiphi_me') || '{}'); for (const [k, L] of Object.entries(m.letters || {}))
          if (!k.startsWith('email:')) m.letters[k] = { ...L, h: 'gone-hearing-0000' }; localStorage.setItem('hiphi_me', JSON.stringify(m)); }""")
        pg.reload(); ready(pg)
        t, words = reader(pg, '.myl-rows [data-myl]:not([data-myl^="email:"])', 'letter')
        ok('Your letter on HB 2121' in t and 'House Health Committee hearing' in t, f'{name}: a letter whose hearing is gone opens, for its committee')
        ok(not pg.locator('.toast.err, [role="alert"]:has-text("couldn’t open")').count(), f'{name}: no "couldn’t open" message')
        close(pg)

        ok(not errs, f'{name}: no page errors {errs[:2]}')
        ctx.close()
    br.close()
print(f'{sum(res)}/{len(res)} passed')
sys.exit(0 if all(res) else 1)
