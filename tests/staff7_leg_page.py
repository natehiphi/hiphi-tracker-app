# Staff7 legislator page, styles A and B (R-398 piece 12, part 3), on the practice copy: strip, contact bar, Yours | Whole team, stance with Undo, Log a talk with Undo, B's tabs, Page style, no sideways scroll.
#   python3 tests/staff7_leg_page.py [base] [shots folder]     base defaults to http://127.0.0.1:8876
import sys, os, re
from playwright.sync_api import sync_playwright
BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8876').rstrip('/')
SHOTS = sys.argv[2] if len(sys.argv) > 2 else ''
if SHOTS: os.makedirs(SHOTS, exist_ok=True)
res = []
def ok(c, m): res.append(bool(c)); print('PASS' if c else 'FAIL', m)
SIDE = "() => document.documentElement.scrollWidth <= innerWidth && document.body.scrollWidth <= innerWidth"
def open_as(br, w, h, who='KV', hash='#/more/legislators/130', style=None):
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
    for style in ('A', 'B'):
        pg = open_as(br, 1440, 900, 'KV', style=style)
        ok(pg.inner_text('h1').strip() == 'Gregg Takayama' and 'Representative · Democrat · District 34' in txt(pg, '.lpstrip'), f'{style} strip: name and chamber · party · district')
        ok(txt(pg, '.lpstrip').count('Log a talk') >= 1 and pg.locator('.btn.filled:visible').count() == 1, f'{style} Log a talk is the only filled button ({pg.locator(".btn.filled:visible").count()})')
        ok(pg.locator('a[href^="tel:"]:visible').first.get_attribute('href') == 'tel:808-586-6340' and pg.locator('.lpa[href="mailto:reptakayama@capitol.hawaii.gov"]:visible').count() == 1 and 'Room 404' in txt(pg, '.lpbar'), f'{style} Call tel:, Email mailto:, Room')
        ok('Capitol’s records' in txt(pg, '.lpstrip'), f'{style} source line')
        if style == 'A':
            hs = h2s(pg); order = [next((i for i, h in enumerate(hs) if h.startswith(k)), -1) for k in ('Now with Takayama', 'Latest talk', 'Our bills with them', 'What they said', 'Testimony we sent', 'About them')]
            ok(order == sorted(order) and -1 not in order, f'A one column, sections in order ({hs})')
        else:
            tabs = pg.eval_on_selector_all('[role=tab]', "els => els.map(e => e.innerText.replace(/\\s+/g,' ').trim())")
            ok(len(tabs) == 4 and tabs[0] == 'Now' and tabs[1].startswith('Bills · ') and tabs[2].startswith('Talks and asks · ') and tabs[3] == 'About' and pg.locator('[role=tablist]').count() == 1, f'B tabs ({tabs})')
            ok(pg.locator('#lpMain .lpsw').count() == 1 and 'Our bills' not in txt(pg), 'B switch is inside Now, bills are on their own tab')
        ok(pg.evaluate(SIDE), f'{style} no sideways scroll at 1440')
        snap(pg, f'page_{style}_1440.png')
        ok(not pg.errs, f'{style} no page error {pg.errs[:1]}')
        pg.context.close()

    # ---- A: switch, stance, Log a talk, staffer
    pg = open_as(br, 1440, 900, 'KR', style='A')
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
    # Page style switch
    pg.click('#lpFoot [data-style=B]'); pg.wait_for_selector('[role=tablist]', timeout=3000)
    ok(pg.get_attribute('#lpFoot [data-style=B]', 'aria-pressed') == 'true' and pg.locator('[role=tab]').count() == 4, 'Page style B switches to tabs')
    pg.reload(); pg.wait_for_selector('#lpMain h2', timeout=60000); pg.wait_for_timeout(300)
    ok(pg.locator('[role=tablist]').count() == 1, 'Page style is remembered for the tab')
    # B tabs by mouse and keyboard
    pg.click('#lpTab-bills'); ok(pg.get_attribute('#lpTab-bills', 'aria-selected') == 'true' and pg.locator('#lpMain .lpbr').count() > 0 and pg.locator('#lpMain .lpsw').count() == 1, 'B: Bills tab by mouse, with the switch')
    pg.focus('#lpTab-bills'); pg.keyboard.press('ArrowRight'); pg.wait_for_timeout(150)
    ok(pg.get_attribute('#lpTab-talks', 'aria-selected') == 'true' and pg.evaluate("document.activeElement.id") == 'lpTab-talks' and pg.locator('#lpMain .lpsw').count() == 0, 'B: ArrowRight moves to Talks and asks, no switch there')
    pg.keyboard.press('End'); ok(pg.get_attribute('#lpTab-about', 'aria-selected') == 'true' and 'About them' in txt(pg), 'B: End goes to About')
    pg.keyboard.press('ArrowRight'); ok(pg.get_attribute('#lpTab-now', 'aria-selected') == 'true', 'B: ArrowRight wraps to Now')
    pg.keyboard.press('ArrowLeft'); ok(pg.get_attribute('#lpTab-about', 'aria-selected') == 'true', 'B: ArrowLeft wraps back')
    ok(not pg.errs, f'no page error {pg.errs[:1]}'); pg.context.close()

    # ---- a staffer who leads none (found by asking the page)
    pg = open_as(br, 1440, 900, 'KV', style='A')
    none = pg.evaluate("""async () => { const D = await import('/staff7/leg_data.js'); const { S } = await import('/staff6/data.js'); const l = D.legOf(130); return S.advocates.filter(a => D.ourBills(l, a).yours === 0).map(a => a.initials); }""")
    pg.context.close()
    ok(none, f'a staffer who leads none exists ({none})')
    for style in ('A', 'B'):
        pg = open_as(br, 1440, 900, none[0], style=style)
        yb = pg.locator('.lpsegs [data-view=yours]')
        ok(yb.is_disabled() and 'Whole team' in pg.inner_text('.lpsegs [aria-current=true]') and 'You lead none of the bills with them.' in txt(pg), f'{style}: leads none, opens on Whole team with Yours disabled')
        ok(bool(h2s(pg)) and not pg.errs, f'{style}: renders, no error {pg.errs[:1]}'); pg.context.close()

    # ---- widths
    for w, h in ((1280, 800), (390, 844)):
        for style in ('A', 'B'):
            pg = open_as(br, w, h, 'KV', style=style)
            ok(pg.evaluate(SIDE), f'{style} no sideways scroll at {w}')
            if w == 390:
                vis = pg.eval_on_selector_all('.lpmob > *', "els => els.filter(e => e.getBoundingClientRect().width > 0).map(e => e.textContent.trim())")
                ok(vis == ['Call', 'Email', 'Log a talk'], f'{style} 390: Call · Email · Log a talk ({vis})')
                ok(pg.evaluate("() => document.querySelector('#lpMain .lpsw').getBoundingClientRect().width > 0"), f'{style} 390: switch shows')
                snap(pg, f'page_{style}_390.png')
            else: snap(pg, f'page_{style}_1280.png')
            ok(not pg.errs, f'{style} {w} no page error'); pg.context.close()
    br.close()
print(f'{sum(res)}/{len(res)} passed'); sys.exit(0 if all(res) else 1)
