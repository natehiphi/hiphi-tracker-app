# The story kept when written (R-212 #26; the Person Who Lived It walk: "the story is lost if the letter comes before the
# profile"). Someone with no profile writes a letter on a phone:
#   - About you has "Keep this on this device as my story about ...", ticked; at the send the reason is kept on the device
#     under the bill's issue, and the thank-you says so, with Remove it;
#   - the next letter on that issue starts from it ("kept on this device"), with the tick off (a kept story is replaced
#     only on purpose); a letter on another issue offers it ("Use your story about ..."), never fills it in;
#   - Remove it takes it off the device; unticked, nothing is kept; the new words never say "profile" without one;
#   - someone with a profile still gets the unticked "Save this to my profile" (the account is seen by HIPHI staff);
#   - no page errors.
#   python3 tests/story_kept.py [base]     base defaults to http://localhost:8832/track.html?demo=1&codes=0
import sys, os
from playwright.sync_api import sync_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832/track.html?demo=1&codes=0'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out', 'story_kept'); os.makedirs(OUT, exist_ok=True)
res = []
def ok(c, m): res.append(bool(c)); print('PASS' if c else 'FAIL', m)
def ready(pg): pg.wait_for_function("() => !!document.querySelector('main') && !document.querySelector('.skelpage')", timeout=60000); pg.wait_for_timeout(600)
def text(pg, sel): return pg.locator(sel).first.inner_text() if pg.locator(sel).count() else ''
SKIP = "() => { try { const w = JSON.parse(localStorage.getItem('hiphi_wiz') || '{}'); localStorage.setItem('hiphi_wiz', JSON.stringify({ ...w, done: true, step: 99 })); for (const k of ['hiphi_tour_bill', 'hiphi_tour_home', 'hiphi_tour_bill_demo', 'hiphi_tour_home_demo']) localStorage.setItem(k, '{\"how\":\"test\"}'); } catch {} }"
# HB 1523 and its next hearing; another bill with a hearing ahead on none of HB 1523's issues.
FIND = """async () => { const c = await import('./pub/core.js'); const next = b => c.D.hearings.filter(x => x.bill_id === b.id && new Date(x.scheduled_at) > Date.now()).sort((a, z) => a.scheduled_at.localeCompare(z.scheduled_at))[0];
  const ids = b => c.issuesOf(b).map(i => i.id); const b = c.D.bills.find(x => x.bill_number === 'HB1523'), mine = ids(b);
  const o = c.D.bills.find(x => x.is_public !== false && next(x) && ids(x).length && !ids(x).some(i => mine.includes(i)) && c.hiphiStance?.(x) !== 'oppose');
  return { b: b.id, h: next(b).id, ob: o.id, oh: next(o).id, onum: o.bill_number }; }"""
def letter(pg, b, h):
    pg.evaluate("async ([b, h]) => { const c = await import('./pub/core.js'); c.app.openHelper(b, h); }", [b, h])
    pg.wait_for_selector('#hp-dlg', timeout=15000); pg.wait_for_timeout(800)
    for _ in range(4):
        if pg.locator('#hp-form').count(): break
        st = pg.locator('#hp-dlg [data-hp="stance"][data-v="support"]')
        if st.count(): st.first.click(); pg.wait_for_timeout(500); continue
        pg.locator('#hp-dlg .hp-foot .hp-main').first.click(); pg.wait_for_timeout(600)
    if pg.locator('#hp-name').count() and not pg.input_value('#hp-name'): pg.fill('#hp-name', 'Malia Test')
def to_done(pg):
    for _ in range(6):
        if pg.locator('#hp-done-t').count(): break
        b = pg.locator('#hp-dlg [data-hp="sent"], #hp-dlg [data-hp="acct-yes"]')
        if not b.count(): b = pg.locator('#hp-dlg .hp-foot .hp-main')
        if not b.count(): break
        b.first.click(); pg.wait_for_timeout(900)
    return pg.locator('#hp-done-t').count() == 1
def close(pg, forget_why=True):
    # The helper closed, its drafts gone; forget_why also drops the per-bill reason, as a different bill of the same issue would.
    pg.evaluate("""async (fw) => { const c = await import('./pub/core.js'); c.S.helper = null; try { sessionStorage.clear(); const m = JSON.parse(localStorage.getItem('hiphi_me') || '{}');
      delete m.mail; delete m.drafts; if (fw) { delete m.why; delete m.whyBill; } localStorage.setItem('hiphi_me', JSON.stringify(m)); } catch {} c.app.render(); }""", forget_why)
    pg.wait_for_timeout(400)
STORIES = "async () => JSON.stringify((await import('./pub/myprofile.js')).myStories())"
WHY = 'Our road has no crosswalk near the school, and my son walks it every day.'

with sync_playwright() as p:
    br = p.chromium.launch()
    ctx = br.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True); ctx.add_init_script(f"({SKIP})()")
    pg = ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(BASE + '#/bill/HB1523'); ready(pg)
    t = pg.evaluate(FIND)
    ok(not pg.evaluate("async () => (await import('./pub/myprofile.js')).hasProfile()"), 'a fresh phone has no profile')

    # 1. The first letter: the tick is there and on; the reason is kept at the send
    letter(pg, t['b'], t['h'])
    lab = text(pg, 'label.hp-savest')
    ok(pg.locator('#hp-savestory').count() == 1 and pg.is_checked('#hp-savestory'), 'no profile: the keep tick is on About you, ticked')
    ok(lab.startswith('Keep this on this device as my story about “') and 'ready for my next letter' in lab and 'profile' not in lab, f'its words: {lab[:90]}')
    pg.fill('#hp-why', WHY); pg.locator('#hp-savestory').scroll_into_view_if_needed(); pg.screenshot(path=os.path.join(OUT, 'about_you.png'))
    ok(to_done(pg), 'the letter can be marked sent')
    st = pg.evaluate(STORIES)
    ok('crosswalk' in st and st.count('":"') == 1, f'kept on the device under one issue ({st[:70]})')
    pl = text(pg, '.hp-profline')
    ok('Your story is kept on this device, ready for your next letter' in pl and pg.locator('.hp-profline [data-hp="storyforget"]').count() == 1, f'the thank-you says so, with Remove it ({pl[:70]})')
    ok(pg.locator('.hp-storyask').count() == 0 and 'profile' not in pl.lower(), 'no story ask, and the kept line never says "profile" without one (the invitation to make one may show)')
    pg.locator('.hp-profline').scroll_into_view_if_needed(); pg.screenshot(path=os.path.join(OUT, 'done_kept.png'))
    close(pg)

    # 2. The next letter on that issue starts from it; the tick is off
    letter(pg, t['b'], t['h'])
    ok(pg.input_value('#hp-why') == WHY, 'the next letter on that issue starts from the kept story')
    ok('kept on this device. Change it to fit this bill.' in text(pg, '#hp-why-help'), f'and says where it came from ({text(pg, "#hp-why-help")[:80]})')
    ok(not pg.is_checked('#hp-savestory'), 'with a story kept, the tick starts off (replaced only on purpose)')
    close(pg)

    # 3. A letter on another issue offers it, never fills it in
    letter(pg, t['ob'], t['oh'])
    ok(pg.input_value('#hp-why') == '' and 'Use your story about “' in text(pg, '.hp-offer'), f'{t["onum"]}, another issue: the story is offered, not filled in')
    ok(pg.is_checked('#hp-savestory'), 'and its own story would be kept (no story for that issue yet)')
    pg.click('.hp-offer [data-hp="usestory"]'); pg.wait_for_timeout(300)
    ok(pg.input_value('#hp-why') == WHY, 'one tap puts it in')
    close(pg)

    # 4. Remove it
    pg.evaluate("async () => { const m = await import('./pub/myprofile.js'); await m.saveProfile({ story: '', stories: {} }); }")
    letter(pg, t['b'], t['h']); pg.fill('#hp-why', WHY); to_done(pg)
    pg.click('.hp-profline [data-hp="storyforget"]'); pg.wait_for_timeout(500)
    ok(pg.evaluate(STORIES) == '{}' and 'Removed. Your story won’t be filled in for your next letter.' in text(pg, '.hp-profline'), 'Remove it takes the story off the device and says so')
    ok(pg.evaluate("document.activeElement && document.activeElement.id") == 'hp-kept', 'focus stays on that line')
    close(pg, forget_why=False)
    letter(pg, t['b'], t['h'])
    ok(pg.input_value('#hp-why') == '', 'reopening the same bill does not fill it in again (the critic)')
    close(pg)

    # 5. Unticked: nothing kept
    letter(pg, t['b'], t['h']); pg.fill('#hp-why', WHY); pg.uncheck('#hp-savestory'); to_done(pg)
    ok(pg.evaluate(STORIES) == '{}' and pg.locator('.hp-profline').count() == 0, 'unticked: nothing is kept, nothing said')
    close(pg)

    # 6. With a profile (a confirmed number in the sandbox): the account's tick, unticked as before
    pg.evaluate("() => { for (const k of ['hiphi_text', 'hiphi_text_demo']) localStorage.setItem(k, JSON.stringify({ phone: '8085550123', token: 'test' })); }")
    if pg.evaluate("async () => (await import('./pub/myprofile.js')).hasProfile()"):
        letter(pg, t['b'], t['h'])
        lab = text(pg, 'label.hp-savest')
        ok(lab.startswith('Save this to my profile') and not pg.is_checked('#hp-savestory'), f'with a profile: "Save this to my profile", unticked ({lab[:50]})')
        close(pg)
    else:
        print('NOTE could not make a sandbox profile here; the profile case is covered by tests/profile.py')
    ok(not errs, 'no page errors: ' + '; '.join(errs[:2]))
    ctx.close(); br.close()
print(f'\n{sum(res)} passed, {len(res) - sum(res)} failed'); sys.exit(0 if all(res) else 1)
