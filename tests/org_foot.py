# The organisation's name, address and site at the end of every public page (R-402).
# python3 tests/org_foot.py [base_url]   (practice copy; serve the repo on 127.0.0.1 with a listen backlog of 256, not 8832)
# Checks, at 390x844 and 1280x800 on #/, #/find, #/bills, a bill page, #/privacy and #/more: exactly one footer.orgfoot holding the three
# strings, address in a non-italic <address>, hiphi.org a new-tab link, small type, muted colour at 4.5:1 or better; on the phone, scrolled
# to the bottom, the tab bar does not cover it and there is no sideways scroll; not on the first visit; not inside the walkthrough; not on embed.html.
import sys, json
from playwright.sync_api import sync_playwright
BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8873/track.html')
ROOT = BASE.rsplit('/', 1)[0]
passes, fails, errors = [], [], []
def ok(c, m): (passes if c else fails).append(('PASS ' if c else 'FAIL ') + m)
PAGES = {'Home': '#/', 'Find': '#/find', 'My issues': '#/bills', 'a bill page': '#/bill/HB1523', 'Privacy': '#/privacy', 'More': '#/more'}
FOLLOWS = ['f707d3fd-f830-491c-8f46-06dcfd847cbf', '5aa2ef38-47b1-4376-a41d-39983afe15d3']   # as tests/density.py: someone with a setup and two followed bills
ISSUE = '66a32660-b0a7-4a90-a71f-231963619b44'
SEED = "try { localStorage.setItem('hiphi_watch_ids_demo', %s); localStorage.setItem('hiphi_issue_follows_demo', %s); localStorage.setItem('hiphi_wiz', JSON.stringify({done:true, issues:['vaping']})); localStorage.setItem('hiphi_tour_bill','1'); localStorage.setItem('hiphi_tour_bill_demo','1'); } catch (e) {}" % (json.dumps(json.dumps(FOLLOWS)), json.dumps(json.dumps([ISSUE])))
LUM = """c => { const m = c.match(/[\\d.]+/g).map(Number).slice(0, 3).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }); return .2126 * m[0] + .7152 * m[1] + .0722 * m[2]; }"""
with sync_playwright() as pw:
    b = pw.chromium.launch()
    for w, h, tag in ((390, 844, 'phone'), (320, 640, 'narrow phone'), (1280, 800, 'laptop')):
        c = b.new_context(viewport={'width': w, 'height': h}); p = c.new_page()
        p.on('pageerror', lambda e: errors.append(str(e)[:160]))
        p.add_init_script(SEED)
        for name, hash_ in PAGES.items():
            if tag == 'narrow phone' and name not in ('Home', 'a bill page'): continue
            p.goto(BASE + '?demo=1&codes=0' + hash_); p.wait_for_selector('main#main', timeout=30000)
            p.evaluate("document.fonts.load('700 13px Lato')"); p.wait_for_timeout(1500)
            n = p.locator('footer.orgfoot').count()
            ok(n == 1, f'{tag} {name}: one footer ({n}) at {p.url.split("#")[-1]}')
            if n != 1: continue
            f = p.locator('footer.orgfoot')
            ok(f.locator('.of-name').text_content() == 'Hawaiʻi Public Health Institute', f'{tag} {name}: the name')
            ok(f.locator('address').text_content() == '707 Richards Street, Suite 300, Honolulu, HI 96813' and f.locator('address').evaluate('a => getComputedStyle(a).fontStyle') == 'normal', f'{tag} {name}: the address, not italic')
            a = f.locator('a')
            ok(a.count() == 1 and a.get_attribute('href') == 'https://www.hiphi.org/' and a.get_attribute('target') == '_blank' and 'noopener' in a.get_attribute('rel') and a.evaluate("a => [...a.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim()") == 'hiphi.org', f'{tag} {name}: the hiphi.org link (visible words exactly hiphi.org, text nodes only)')
            ok(a.locator('.sr').count() == 1 and a.locator('.sr').text_content() == ' (opens in a new tab)', f'{tag} {name}: a .sr span holds "(opens in a new tab)"')
            ok(a.locator('svg.ic').count() == 1 and a.locator('svg').count() == 1 and a.locator('svg').get_attribute('aria-hidden') == 'true', f'{tag} {name}: the link holds one svg icon, aria-hidden')
            lb = a.evaluate("a => a.getClientRects().length")
            ok(lb == 1, f'{tag} {name}: the link is one box ({lb} client rect(s)), so the arrow is on its line')
            sv = a.locator('svg').bounding_box(); lr = a.evaluate("a => { const r = a.getClientRects()[0]; return [r.top, r.bottom]; }")
            ok(lr[0] <= sv['y'] + sv['height'] / 2 <= lr[1], f'{tag} {name}: the arrow centre ({sv["y"] + sv["height"] / 2:.1f}) is inside the link line ({lr[0]:.1f}-{lr[1]:.1f})')
            fs = f.evaluate('e => parseFloat(getComputedStyle(e).fontSize)')
            ok(fs <= 13.5, f'{tag} {name}: small type ({fs}px)')
            col = f.evaluate('e => getComputedStyle(e).color'); bg = p.evaluate('getComputedStyle(document.body).backgroundColor')
            l1, l2 = p.evaluate(f'({LUM})({col!r})'), p.evaluate(f'({LUM})({bg!r})')
            ratio = (max(l1, l2) + .05) / (min(l1, l2) + .05)
            ok(ratio >= 4.5, f'{tag} {name}: contrast {ratio:.2f}:1 ({col} on {bg})')
            ok(not p.evaluate('document.querySelector(".orgfoot").closest("dialog, .helper, [role=dialog], .sheet")'), f'{tag} {name}: not inside a dialog')
            p.evaluate('window.scrollTo(0, document.documentElement.scrollHeight)'); p.wait_for_timeout(300)
            r = f.bounding_box()
            ok(r['y'] + r['height'] <= h + 1 and r['y'] >= 0, f'{tag} {name}: in view at the bottom (y {r["y"]:.0f}-{r["y"] + r["height"]:.0f} of {h})')
            tb = p.locator('.tabs')
            if tag != 'laptop' and tb.count() and tb.is_visible():
                t = tb.bounding_box(); ok(r['y'] + r['height'] <= t['y'] + 1, f'{tag} {name}: above the tab bar (footer ends {r["y"] + r["height"]:.0f}, bar starts {t["y"]:.0f})')
            ok(p.evaluate('document.documentElement.scrollWidth <= innerWidth'), f'{tag} {name}: no sideways scroll')
            if tag == 'phone' and name == 'Home':
                ok(r['height'] <= 46, f'phone: no taller than two short lines and its 8px of room above ({r["height"]:.0f}px)')
                ah = f.locator('address').bounding_box()['height']; ok(ah <= 20, f'phone: the address is on one line, not split ({ah:.0f}px)')
                nd = f.locator('.of-name').evaluate('e => getComputedStyle(e, "::after").content'); ok(nd in ('none', 'normal'), f'phone: no dot left hanging after the name on its own line ({nd})')
                ok(not f.evaluate('e => [...e.children].some(k => /^\\s*·/.test(k.textContent))') and f.evaluate('e => getComputedStyle(e).borderTopWidth') == '0px', 'phone: no rule above, and the dots are not text')
                tap = f.locator('a').evaluate('a => { const b = a.getBoundingClientRect(), s = getComputedStyle(a, "::before"); return b.height - parseFloat(s.top) - parseFloat(s.bottom); }')
                ok(tap >= 44, f'phone: the link keeps a 44px touch area without the height ({tap:.0f}px)')
            if name == 'My issues':   # a page shorter than the window: the footer sits at the window's foot, not floating under the content
                floor = p.locator('.tabs').bounding_box()['y'] if (tag != 'laptop' and p.locator('.tabs').is_visible()) else h
                ok(floor - (r['y'] + r['height']) <= 26, f'{tag} {name}: on a short page the footer is at the bottom of the window ({floor - (r["y"] + r["height"]):.0f}px above it)')
            if tag == 'laptop' and name == 'Home':
                ys = f.evaluate('e => [...e.children].map(k => Math.round(k.getBoundingClientRect().top + k.getBoundingClientRect().height / 2))')
                ok(max(ys) - min(ys) < 8, f'laptop: one line ({ys})')
            if tag == 'phone' and name == 'a bill page':   # the walkthrough opens over the page and carries no footer of its own
                btn = p.get_by_role('button', name='Help me write testimony').first
                if btn.count():
                    btn.click(); p.wait_for_timeout(1500)
                    inside = p.evaluate('[...document.querySelectorAll("dialog[open] .orgfoot, .helper .orgfoot, [role=dialog] .orgfoot")].length')
                    ok(inside == 0 and p.locator('.orgfoot').count() == 1, f'phone: the walkthrough has no footer of its own (inside {inside}, total {p.locator(".orgfoot").count()})')
                else: ok(False, 'phone: found no Help me write testimony button on the bill page to open the walkthrough')
        c.close()
    c = b.new_context(viewport={'width': 390, 'height': 844}); p = c.new_page()
    p.goto(ROOT + '/embed.html'); p.wait_for_timeout(1500)
    ok(p.locator('.orgfoot').count() == 0, 'embed.html: no footer')
    c2 = b.new_context(viewport={'width': 390, 'height': 660}); p = c2.new_page(); p.goto(BASE + '?demo=1#/start/1'); p.wait_for_timeout(2500)
    ok(p.locator('.orgfoot').count() == 0, f'the first visit (#/start/1) has none ({p.url.split("#")[-1]})')
    # R-406: the foot's lines at each width on Home. Lines are the distinct tops of the foot's parts (name, address, link), with tops within
    # 4px counted as one line. Expected: three lines at 344-375 (link alone on the third), two at 384-430 (link on the address's line), one at 640.
    EXPECT = {344: 3, 360: 3, 375: 3, 384: 2, 385: 2, 390: 2, 414: 2, 430: 2, 640: 1}
    c3 = b.new_context(viewport={'width': 390, 'height': 844}); p = c3.new_page()
    p.on('pageerror', lambda e: errors.append(str(e)[:160]))
    p.add_init_script(SEED)
    for wd in EXPECT:
        p.set_viewport_size({'width': wd, 'height': 844})
        p.goto(BASE + '?demo=1&codes=0#/'); p.wait_for_selector('main#main', timeout=30000)
        p.evaluate("document.fonts.load('400 13px Lato').then(()=>1)"); p.evaluate("document.fonts.load('700 13px Lato').then(()=>1)")
        p.wait_for_timeout(1500)
        p.evaluate("document.fonts.ready.then(()=>1)")
        f = p.locator('footer.orgfoot')
        if f.count() != 1:
            ok(False, f'{wd}px: one footer on Home ({f.count()})'); continue
        info = f.evaluate("""e => {
            const kids = [...e.children], tops = [];
            const parts = kids.map(k => { const r = k.getClientRects(); return { cls: k.className || k.tagName, top: Math.round(r[0].top), bottom: Math.round(r[r.length - 1].bottom), left: r[0].left, right: r[r.length - 1].right }; });
            for (const pt of parts) { const hit = tops.find(t => Math.abs(t.top - pt.top) <= 4); if (hit) hit.items.push(pt.cls); else tops.push({ top: pt.top, items: [pt.cls] }); }
            return { lines: tops.length, tops: tops.map(t => [t.top, t.items]), footerWidth: e.getBoundingClientRect().width, parts };
        }""")
        lines = info['lines']
        link = next(x for x in info['parts'] if 'of-site' in x['cls'])
        addr = next((x for x in info['parts'] if 'of-addr' in x['cls']), None)
        same = addr is not None and abs(addr['top'] - link['top']) <= 4
        sw = p.evaluate('document.documentElement.scrollWidth <= innerWidth')
        # The focus ring is the page's :focus-visible outline, 2px wide at 2px offset: 4px out from the link's box; it must stay on screen.
        fe = f.locator('a'); fe.focus(); p.wait_for_timeout(100)
        vis = fe.evaluate('a => a.matches(":focus-visible")')
        bb = fe.bounding_box()
        left_edge = bb['x'] - 4; innerW = wd - (bb['x'] + bb['width'])
        print(f'  {wd}px: lines={lines} tops={info["tops"]} link=({bb["x"]:.1f}..{bb["x"] + bb["width"]:.1f}) same-line-as-address={same} '
              f'footer={info["footerWidth"]:.1f} spare-right={innerW - 4:.1f} spare-left={left_edge:.1f} focus-visible={vis} scrollWidth-ok={sw}')
        ok(lines == EXPECT[wd], f'{wd}px: the foot is {EXPECT[wd]} line(s) on Home ({lines})')
        if EXPECT[wd] == 3:
            ok(not same and lines == 3, f'{wd}px: the link alone on the third line')
        if EXPECT[wd] == 2:
            ok(same, f'{wd}px: the link is on the address line')
        ok(sw, f'{wd}px: no sideways scroll')
        ok(left_edge >= 0 and innerW - 4 >= 0, f'{wd}px: the focus ring is on screen (left edge {left_edge:.1f}px, right edge {innerW - 4:.1f}px spare)')
    c3.close()
    b.close()
print('\n'.join(passes + fails)); print(f'\n{len(passes)} passed, {len(fails)} failed, {len(errors)} page errors'); [print('ERR', e) for e in errors[:5]]
sys.exit(1 if fails or errors else 0)
