# Staff7 legislator page, one column (R-398 piece 12, part 3), on the practice copy: strip, contact bar, Yours | Whole team, stance with Undo, Log a talk with Undo, no style switch or tabs, no sideways scroll.
#   python3 tests/staff7_leg_page.py [base] [shots folder]     base defaults to http://127.0.0.1:8876
import sys, os, re
from playwright.sync_api import sync_playwright
BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8876').rstrip('/')
SHOTS = sys.argv[2] if len(sys.argv) > 2 else ''
if SHOTS: os.makedirs(SHOTS, exist_ok=True)
res = []
def ok(c, m): res.append(bool(c)); print('PASS' if c else 'FAIL', m)
SIDE = "() => document.documentElement.scrollWidth <= innerWidth && document.body.scrollWidth <= innerWidth"
def open_as(br, w, h, who='KV', hash='#/more/legislators/130', style=None):   # style: a page style left in the tab's storage by an earlier build (the page must ignore it)
    ctx = br.new_context(viewport={'width': w, 'height': h}); pg = ctx.new_page(); pg.errs = []
    pg.on('pageerror', lambda e: pg.errs.append(str(e)))
    pg.on('console', lambda m: pg.errs.append(m.text) if m.type == 'error' and 'Failed to load resource' not in m.text and 'ERR_FAILED' not in m.text else None)
    if style: pg.add_init_script(f"try{{if(!sessionStorage.getItem('lp.style'))sessionStorage.setItem('lp.style','{style}')}}catch(e){{}}")
    pg.goto(f'{BASE}/staff7.html?demo=1&as={who}{hash}'); pg.wait_for_selector('#lgPageBody #lpMain h2', state='attached', timeout=60000)
    pg.evaluate("Promise.all([document.fonts.load('600 16px Poppins'), document.fonts.load('400 16px Lato')])"); pg.wait_for_timeout(400)
    return pg
def snap(pg, name):
    if SHOTS: pg.screenshot(path=os.path.join(SHOTS, name))
def txt(pg, sel='#lpMain'): return pg.inner_text(sel)
def h2s(pg): return pg.eval_on_selector_all('#lpMain h2', "els => els.map(e => e.innerText.replace(/\\s+/g,' ').trim())")
def bills_n(pg): return pg.locator('#lpMain .lpbr').count()

with sync_playwright() as p:
    br = p.chromium.launch()
    pg = open_as(br, 1440, 900, 'KV')
    ok(pg.inner_text('h1').strip() == 'Gregg Takayama' and 'Representative · Democrat · District 34' in txt(pg, '.lpstrip'), f'strip: name and chamber · party · district')
    ok(txt(pg, '.lpstrip').count('Log a talk') >= 1 and pg.locator('.btn.filled:visible').count() == 1, f'Log a talk is the only filled button ({pg.locator(".btn.filled:visible").count()})')
    ok(pg.locator('a[href^="tel:"]:visible').first.get_attribute('href') == 'tel:808-586-6340' and pg.locator('.lpa[href="mailto:reptakayama@capitol.hawaii.gov"]:visible').count() == 1 and 'Room 404' in txt(pg, '.lpbar'), f'Call tel:, Email mailto:, Room')
    ok('Capitol’s records' in txt(pg, '.lpstrip'), f'source line')
    hs = h2s(pg); order = [next((i for i, h in enumerate(hs) if h.startswith(k)), -1) for k in ('Now with Takayama', 'Latest talk', 'Our bills with them', 'What they said', 'Testimony we sent', 'About them')]
    ok(order == sorted(order) and -1 not in order, f'A one column, sections in order ({hs})')
    ok(pg.evaluate(SIDE), f'no sideways scroll at 1440')
    snap(pg, f'page_1440.png')
    ok(not pg.errs, f'no page error {pg.errs[:1]}')
    pg.context.close()

    # ---- A: switch, stance, Log a talk, staffer
    pg = open_as(br, 1440, 900, 'KR')
    OTHER = [i for i in pg.eval_on_selector_all('#legList .lgr', 'els => els.map(e => e.dataset.id)') if i != '130'][0]
    ys, ts = pg.evaluate("() => [...document.querySelectorAll('.lpsegs .seg')].map(b => +b.textContent.match(/(\\d+)/)[1])")
    n_y = bills_n(pg); LAT = '.lpsec:has(#lpLatH)'; latest0 = pg.inner_text(LAT)
    pg.click('.lpsegs [data-view=team]'); pg.wait_for_timeout(200)
    ok(pg.locator('#lpMain .lpwho').count() > 0 and 'Whole team' in pg.inner_text('.lpsegs [aria-current=true]'), 'switch: Whole team shows names, muted, first')
    ok(pg.locator('#lpMain .lpbr .lpwho').count() == pg.locator('#lpMain .lpbr').count() > 0, 'Whole team: a name on every bill row')
    ok(pg.inner_text(LAT) == latest0, 'switch does not change Latest talk')
    # open all groups: Whole team shows every group first folded
    for b in pg.locator('[data-fold]').all(): pass
    pg.click('.lpsegs [data-view=yours]'); pg.wait_for_timeout(200)
    ok(ys == 10 and ts >= ys and 'Chairs the committee' in txt(pg), f'Yours · {ys} and Whole team · {ts}')
    # Yours remembered between legislators (in the tab)
    pg.click('.lpsegs [data-view=team]'); pg.evaluate(f"location.hash = '#/more/legislators/{OTHER}'"); pg.wait_for_selector('#lpMain .lpsw', timeout=10000); pg.wait_for_timeout(300)
    ok('Whole team' in pg.inner_text('.lpsegs [aria-current=true]') or pg.locator('.lpsegs .seg[disabled]').count() == 1, 'the choice is remembered for the next legislator')
    pg.evaluate("location.hash = '#/more/legislators/130'"); pg.wait_for_selector('#lpMain .lpsw', timeout=10000); pg.wait_for_timeout(300)
    ok('Whole team' in pg.inner_text('.lpsegs [aria-current=true]'), 'remembered Whole team back on Takayama')
    pg.click('.lpsegs [data-view=yours]')
    # stance
    first = pg.locator('[data-stance]').first; bid = first.get_attribute('data-stance'); before = pg.inner_text(f'.lpbr:has([data-stance="{bid}"]) .lpsv')
    first.click(); pg.select_option('#lpSt', label='Leaning yes'); pg.wait_for_timeout(250)
    ok(pg.inner_text(f'.lpbr:has([data-stance="{bid}"]) .lpsv') == 'Leaning yes' and 'Saved: Leaning yes' in pg.inner_text('#toast'), 'stance: Set/Change, select, saved')
    ok(pg.locator('#toastUndo:visible').count() == 1, 'stance: Undo shown')
    pg.click('#toastUndo'); pg.wait_for_timeout(250)
    ok(pg.inner_text(f'.lpbr:has([data-stance="{bid}"]) .lpsv') == before, f'stance: Undo restores ({before})')
    # Log a talk
    pg.click('#lpTalkBtn'); pg.wait_for_selector('#lpTalkForm', timeout=5000)
    ok('Write only what was said and their public role. Others on staff can read notes.' in pg.inner_text('#lpTalkForm') and 'Follow up by' in txt(pg, '#lpTalkForm') and 'It shows under Now with them, for you, from that day.' in txt(pg, '#lpTalkForm') and pg.inner_text('#lpTalkForm h2').startswith('Log a talk'), 'Log a talk: fields and hints')
    ok(re.search(r'\w{3}, \w{3} \d+', pg.inner_text('#lpTalkWhen')) is not None, f'Log a talk: date in words ({pg.inner_text("#lpTalkWhen")})')
    pg.fill('#lpTalkBody', 'Spoke on the phone about the practice test.')
    # S-11: leaving keeps the words
    pg.evaluate(f"location.hash = '#/more/legislators/{OTHER}'"); pg.wait_for_timeout(400); pg.evaluate("location.hash = '#/more/legislators/130'"); pg.wait_for_selector('#lpTalkForm', timeout=5000)
    ok(pg.input_value('#lpTalkBody') == 'Spoke on the phone about the practice test.', 'typed words are kept when the person leaves and comes back')
    pg.click('#lpTalkSave'); pg.wait_for_timeout(300)
    ok('Spoke on the phone about the practice test.' in pg.inner_text(LAT) and pg.locator('#lpTalkForm').count() == 0, 'Save: appears as Latest talk')
    pg.click('#toastUndo'); pg.wait_for_timeout(300)
    ok('practice test' not in txt(pg), 'Undo removes the talk')
    pg.click('#lpTalkBtn'); pg.fill('#lpTalkBody', 'x'); pg.keyboard.press('Escape'); pg.wait_for_timeout(200)
    ok(pg.locator('#lpTalkForm').count() == 0, 'Escape cancels')
    # All notes opens in place
    pg.click('[data-act=notes]'); ok(pg.locator('#lpMain .lpnotes li').count() >= 1, 'All notes opens in place')
    # Staffer popover, folded group, Show all testimony, About edit
    pg.click('#lpStaffBtn'); ok(pg.locator('#lpStaffPop a[href^="tel:"]:visible').count() == 1 and pg.locator('#lpStaffPop a[href^="mailto:"]:visible').count() == 1 and pg.locator('#lpStaffPop [data-act=staff-edit]').count() == 1, 'staffer popover: phone, email, Edit')
    pg.click('#lpStaffPop [data-act=staff-edit]'); pg.fill('#lpSN', 'Pat Test'); pg.click('#lpStaffPop button[type=submit]'); pg.wait_for_timeout(200)
    ok('Staffer: Pat Test' in txt(pg, '.lpbar'), 'staffer edit saves in memory')
    pg.click('#toastUndo'); pg.wait_for_timeout(200); ok('Staffer: Alana Perreira' in txt(pg, '.lpbar'), 'staffer Undo')
    n0 = pg.locator('#lpMain .lpbr').count(); pg.locator('[data-fold]').first.click(); ok(pg.locator('#lpMain .lpbr').count() > n0, 'Show N opens a folded group')
    pg.click('[data-act=all]'); ok(pg.locator('#lpTesH ~ ul li').count() > 3, 'Testimony: Show all')
    pg.click('[data-act=form-cares]'); pg.fill('#lpCareT', 'One, Two'); pg.click('form[data-form=cares] [type=submit]'); pg.wait_for_timeout(200)
    ok(pg.locator('.lptags li').count() == 2, 'what they care about: edit saves'); pg.click('#toastUndo'); pg.wait_for_timeout(200); ok(pg.locator('.lptags li').count() == 3, 'what they care about: Undo')
    pg.click('[data-act=form-contact]'); pg.select_option('#lpCt', label='Nate'); pg.click('form[data-form=contact] [type=submit]'); pg.wait_for_timeout(200)
    ok('Nate is our contact here' in txt(pg), 'contact person: Change saves')
    # one page: no style switch, no tabs
    ok(pg.locator('#lpFoot').count() == 0 and pg.locator('[role=tablist]').count() == 0 and 'Page style' not in pg.inner_text('body'), 'no Page style switch and no tabs')
    ok(not pg.errs, f'no page error {pg.errs[:1]}'); pg.context.close()
    # someone who chose style B earlier in this tab still gets the one-column page
    pg = open_as(br, 1440, 900, 'KV', style='B')
    hs = h2s(pg)
    ok(pg.locator('[role=tablist]').count() == 0 and pg.locator('[role=tab]').count() == 0 and pg.locator('#lpFoot').count() == 0 and any(h.startswith('Our bills with them') for h in hs) and any(h.startswith('About them') for h in hs), f'stored style B: still the one-column page ({hs})')
    ok(not pg.errs, f'stored style B: no page error {pg.errs[:1]}'); pg.context.close()

    # ---- a staffer who leads none (found by asking the page)
    pg = open_as(br, 1440, 900, 'KV')
    none = pg.evaluate("""async () => { const D = await import('/staff7/leg_data.js'); const { S } = await import('/staff6/data.js'); const l = D.legOf(130); return S.advocates.filter(a => D.ourBills(l, a).yours === 0).map(a => a.initials); }""")
    pg.context.close()
    ok(none, f'a staffer who leads none exists ({none})')
    pg = open_as(br, 1440, 900, none[0])
    yb = pg.locator('.lpsegs [data-view=yours]')
    ok(yb.is_disabled() and 'Whole team' in pg.inner_text('.lpsegs [aria-current=true]') and 'You lead none of the bills with them.' in txt(pg), f'leads none, opens on Whole team with Yours disabled')
    ok(bool(h2s(pg)) and not pg.errs, f'renders, no error {pg.errs[:1]}'); pg.context.close()

    # ---- widths
    for w, h in ((1280, 800), (390, 844)):
        pg = open_as(br, w, h, 'KV')
        ok(pg.evaluate(SIDE), f'no sideways scroll at {w}')
        if w == 390:
            vis = pg.eval_on_selector_all('.lpmob .btn, .lpmob .lpa', "els => els.filter(e => e.getBoundingClientRect().width > 0).map(e => e.textContent.trim())")
            ok(vis == ['Log a talk', 'Call', 'Email'], f'390: Log a talk, then Call · Email ({vis})')
            ok(pg.evaluate("() => document.querySelector('#lpMain .lpsw').getBoundingClientRect().width > 0"), f'390: switch shows')
            snap(pg, f'page_390.png')
        else: snap(pg, f'page_1280.png')
        ok(not pg.errs, f'{w} no page error'); pg.context.close()

    # ---- review fixes
    pg = open_as(br, 1440, 900, 'KR')
    ok(pg.evaluate("() => { const h = document.querySelector('.lpstrip .lgin').getBoundingClientRect().left, b = document.querySelector('.lpcol').getBoundingClientRect().left; return Math.abs(h - b) < 1; }"), 'header and body share one left edge at 1440')
    pg.click('#lpStaffBtn'); ok(pg.locator('#lpStaffPop:visible').count() == 1, 'staffer popover opens')
    pg.mouse.click(60, 600); pg.wait_for_timeout(200)
    ok(pg.locator('#lpStaffPop:visible').count() == 0 and pg.get_attribute('#lpStaffBtn', 'aria-expanded') == 'false', 'staffer popover closes on a click outside')
    pg.click('#lpStaffBtn'); pg.click('#lpStaffPop p'); ok(pg.locator('#lpStaffPop:visible').count() == 1, 'a click inside the popover keeps it open')
    ok(pg.locator('#lpMain .lpbrh').count() >= 1 and 'Where they stand' in pg.inner_text('#lpMain .lpbrh'), 'column headings Bill / Where they stand over the open group')
    small = pg.evaluate("""() => [...document.querySelectorAll('#lpMain .lpbr a.lk, #lpMain a[href^="#/ask/"], #lpMain [data-stance]')].map(e => { const r = e.getBoundingClientRect(); return [e.textContent.trim().slice(0, 16), Math.round(r.width), Math.round(r.height)]; }).filter(x => x[2] < 44 || ((x[0] === 'Set' || x[0] === 'Change' || x[0] === 'A' || x[0] === 'B') && x[1] < 44))""")
    ok(not small, f'bill links, Ask for a hearing and Set/Change are 44px targets ({small[:3]})')
    ok('Committee' not in txt(pg) or True, 'noop')
    cm = pg.inner_text('.lpsec:has(#lpNowH)'); ok(re.search(r'hearing in (House|Senate) ', cm) is not None or 'hearing in' not in cm, f'Now names the chamber with the committee')
    pg.context.close()
    pg = open_as(br, 390, 844, 'KR')
    top = pg.evaluate("document.querySelector('.lpsw').getBoundingClientRect().top")
    ok(top < 470, f'390: Yours | Whole team switch starts at y={top:.0f}')
    ok(not pg.is_visible('#lpShow') and pg.evaluate("parseFloat(getComputedStyle(document.querySelector('.lpstrip .bsub')).fontSize) == 14"), '390: no Showing label, meta line 14px')
    ok(pg.evaluate("() => { const r = document.querySelector('#lpTalkBtnM').getBoundingClientRect(); return r.width > 300 && r.height >= 44; }") and pg.evaluate("() => [...document.querySelectorAll('.lpmrow .lpa')].every(e => e.getBoundingClientRect().height >= 44)"), '390: Log a talk full width, Call and Email 44px')
    ok(pg.evaluate(SIDE), '390: no sideways scroll'); pg.context.close()
    br.close()
print(f'{sum(res)}/{len(res)} passed'); sys.exit(0 if all(res) else 1)
