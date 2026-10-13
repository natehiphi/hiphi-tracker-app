# A sent letter, opened again (W1-1, R-239): a regular who gets a call from the committee, or closed the Capitol tab, finds
# the words they sent. python3 tests/letter_view.py [base_url]   (sandbox ?letter: HB 2121's letter for House Health, 18 Feb)
# Checks: the bill page's hearing it was sent for says "Your letter" (and no other hearing does); it opens the walkthrough on
# one screen, "Your letter", with no "Part 1 of 1", the letter read only, Copy (the clipboard gets it), Email it to myself,
# Download, how to change it, Close and "Copy my letter" in the bar, and no "send it again" for a hearing that is over; closing it saves
# no draft, marks nothing, and a reload does not reopen it; a bill with no letter has no button; phone, iPhone SE and laptop
# screenshots in tests/out/letter_view/; no console errors.
import os, sys, json
from playwright.sync_api import sync_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832/track.html'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out', 'letter_view'); os.makedirs(OUT, exist_ok=True)
passes, fails, errors = [], [], []
def ok(c, m): (passes if c else fails).append(('PASS ' if c else 'FAIL ') + m)
SKIP = "() => { try { localStorage.setItem('hiphi_wiz_demo', JSON.stringify({ done: true, step: 99 })); localStorage.setItem('hiphi_tour_bill_demo', '{\"how\":\"test\"}'); localStorage.setItem('hiphi_tour_home_demo', '{\"how\":\"test\"}'); localStorage.setItem('hiphi_wiz', JSON.stringify({ done: true, step: 99 })); localStorage.setItem('hiphi_tour_bill', '{\"how\":\"test\"}'); localStorage.setItem('hiphi_tour_home', '{\"how\":\"test\"}'); } catch {} }"
def me(p): return p.evaluate("JSON.parse(localStorage.getItem('hiphi_me') || '{}')")

with sync_playwright() as pw:
    b = pw.chromium.launch()
    for (w, h, tag, dark) in [(390, 844, 'phone', False), (375, 667, 'se', False), (1366, 900, 'laptop', False)]:
        c = b.new_context(viewport={'width': w, 'height': h}, is_mobile=w < 600, has_touch=w < 600, device_scale_factor=2 if w < 600 else 1,
                          color_scheme='dark' if dark else 'light', permissions=['clipboard-read', 'clipboard-write'])
        c.add_init_script("(" + SKIP + ")()")
        p = c.new_page(); p.on('pageerror', lambda e: errors.append(f'{tag}: {e}'))
        p.on('console', lambda m: errors.append(f'console {tag}: {m.text[:160]}') if m.type == 'error' and 'favicon' not in m.text else None)
        p.goto(BASE + '?demo=1&letter#/bill/HB2121'); p.wait_for_selector('.bl-hr', timeout=15000); p.wait_for_timeout(1500)
        rows = p.locator('.bl-hr:has([data-myletter])')
        ok(rows.count() == 1 and 'House Health' in rows.first.inner_text(), f'{tag}: "Your letter" on the House Health hearing only')
        btn = p.locator('[data-myletter]').first; btn.scroll_into_view_if_needed(); p.wait_for_timeout(300)
        p.screenshot(path=os.path.join(OUT, f'bill-{tag}.png'))
        before = me(p); drafts0 = json.dumps(before.get('drafts') or {}); done0 = p.evaluate("localStorage.getItem('hiphi_done_demo') || localStorage.getItem('hiphi_done') || ''")
        btn.click(); p.wait_for_selector('#hp-letter', timeout=8000); p.wait_for_timeout(800)
        txt = p.input_value('#hp-letter')
        ok(p.inner_text('#hp-sh').strip() == 'Your letter', f'{tag}: the walkthrough opens on "Your letter"')
        ok('written again from your answers' in p.inner_text('#hp-lsub') and 'House Health' in p.inner_text('#hp-lsub') and 'Feb 18' in p.inner_text('#hp-lsub'), f'{tag}: it says which hearing it was for')
        ok('HB 2121' in txt and 'Kalani Practice' in txt and 'As a parent of two teenagers' in txt and 'House Health' in txt, f'{tag}: the letter as sent, for that hearing')
        ok(p.get_attribute('#hp-letter', 'readonly') is not None, f'{tag}: read only')
        ok(p.locator('.hp-count').count() == 0, f'{tag}: no "Part 1 of 1"')
        ok(p.locator('[data-hp="selfmail"]').count() == 1 and p.locator('#hp-dl').count() == 1, f'{tag}: Email it to myself and Download')
        ok('Need to change it?' in p.inner_text('.hp-body'), f'{tag}: how to change it once sent')
        ok(p.locator('a[data-hp="capitol"]').count() == 0 and 'send it again' not in p.inner_text('#hp-lsub'), f'{tag}: a past hearing offers no "send it again" (the critic, 12 Oct)')
        cp = p.locator('.hp-foot #hp-cp')
        ok(cp.count() == 1 and cp.inner_text().strip() == 'Copy my letter' and 'primary' in (cp.get_attribute('class') or ''), f'{tag}: "Copy my letter" is the bar\'s one button')
        bb = cp.bounding_box(); ok(bb and bb['y'] + bb['height'] <= h, f'{tag}: Copy is on the first screen')
        p.screenshot(path=os.path.join(OUT, f'view-{tag}.png'))
        p.click('#hp-cp'); p.wait_for_timeout(500)
        clip = p.evaluate("navigator.clipboard.readText().catch(() => '')")
        ok(clip == txt and 'Copied' in p.inner_text('.hp-foot'), f'{tag}: Copy puts the letter on the clipboard and says Copied')
        p.click('.hp-foot [data-hp="close"]'); p.wait_for_timeout(900)
        ok(p.locator('#hp-letter').count() == 0, f'{tag}: Close closes it')
        after = me(p)
        ok(json.dumps(after.get('drafts') or {}) == drafts0, f'{tag}: no draft saved')
        ok(p.evaluate("localStorage.getItem('hiphi_done_demo') || localStorage.getItem('hiphi_done') || ''") == done0, f'{tag}: nothing newly marked done')
        ok((after.get('letters') or {}) == (before.get('letters') or {}), f'{tag}: the kept letter is unchanged')
        if tag == 'phone':
            btn = p.locator('[data-myletter]').first; btn.click(); p.wait_for_selector('#hp-letter', timeout=8000); p.wait_for_timeout(500)
            p.reload(); p.wait_for_timeout(3000)
            ok(p.locator('#hp-letter').count() == 0, 'phone: a reload does not reopen it')
            p.goto(BASE + '?demo=1&letter#/bill/HB1563'); p.wait_for_selector('.bl-hr', timeout=15000); p.wait_for_timeout(1200)
            ok(p.locator('[data-myletter]').count() == 0, 'phone: a bill with no letter has no "Your letter"')
        c.close()
    b.close()
ok(not errors, 'no console errors' + (': ' + '; '.join(errors[:3]) if errors else ''))
print('\n'.join(passes + fails)); print(f'\n{len(passes)} passed, {len(fails)} failed'); sys.exit(1 if fails else 0)
