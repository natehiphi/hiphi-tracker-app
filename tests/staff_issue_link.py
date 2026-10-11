# R-226 (Nate 10/10): "is it abundantly clear how to get from a bill to its issue, and does the issue page say where it stands?"
# A bill's header and Details name its issues (a chip in the header to the issue, unless the issue is the bill's own
# nickname, and a line in Details); the issue's page says where it stands (next hearing, at risk, by stage), one line per
# bill, and its Back link returns to the bill it came from ("Back to SB2175" on a phone too).
#   python3 tests/staff_issue_link.py [base]      base defaults to http://localhost:8832
import sys, os
from playwright.sync_api import sync_playwright
BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832').rstrip('/') + '/staff.html?demo=1'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out', 'issue_link'); os.makedirs(OUT, exist_ok=True)
ISSUE = '66a32660-b0a7-4a90-a71f-231963619b44'   # "Disposable e-cigarette ban": SB2175 and HB2121 are on it (their nickname is the same)
HEAT = 'a15e28e9-3112-4bb1-8e60-1d0d93b558da'    # "Protect students from extreme heat": HB1803 is on it; its nickname says it differently
res, errors = [], []
def ok(c, m): res.append(bool(c)); print('PASS' if c else 'FAIL', m)
def go(p, hash, wait=2800): p.goto(BASE + '#' + hash.lstrip('#')); p.reload(); p.wait_for_timeout(wait)
def wide_scroll(p): return p.evaluate('document.documentElement.scrollWidth > innerWidth')
with sync_playwright() as pw:
    b = pw.chromium.launch()
    for name, w, h, mob in (('laptop', 1280, 800, False), ('phone', 390, 844, True)):
        c = b.new_context(viewport={'width': w, 'height': h}, is_mobile=mob); p = c.new_page()
        p.on('pageerror', lambda e: errors.append(str(e)))
        # 1. The bill page names the issue. Where the issue's name is the bill's own nickname (SB2175: "Disposable e-cigarette
        #    ban", already the title) the header has no chip, so the title is not said twice; Details still names it. Where
        #    the names differ (HB1803) the header has a chip, with a chevron-right: a link, not a menu like Position and Owner.
        go(p, '/bill/SB2175')
        ok(p.locator('.bw-page a.bw-ichip').count() == 0, f'{name}: SB2175 has no header chip: its issue is its nickname, already the title')
        dl = p.locator('.bw-dl a[href^="#/issue/"]')
        ok(p.locator('.bw-page .bw-dt dt', has_text='Issue').count() == 1 and dl.count() == 1 and dl.first.get_attribute('href') == f'#/issue/{ISSUE}?from=SB2175',
           f'{name}: Details (Overview) lists the issue as a link, saying it came from SB2175')
        go(p, '/bill/HB1803')
        chip = p.locator('.bw-page a.bw-ichip')
        ok(chip.count() == 1 and chip.first.get_attribute('href') == f'#/issue/{HEAT}?from=HB1803',
           f'{name}: HB1803 has one issue chip in its header, to the issue, saying it came from HB1803 ({chip.count()})')
        ok('Protect students from extreme heat' in (chip.first.inner_text() if chip.count() else ''), f'{name}: the chip names the issue')
        arrow = p.evaluate("""async () => { const u = await import('./staff/ui.js'), ch = document.querySelector('.bw-page a.bw-ichip .chev');
          const t = document.createElement('span'); t.innerHTML = u.icon('chevron-right', { cls: 'chev' });
          return !!ch && ch.outerHTML === t.firstElementChild.outerHTML; }""")
        ok(arrow, f'{name}: the chip ends in a chevron-right, so it reads as a link')
        ok(p.locator('.bw-page .bw-chips a.bw-ichip').first.bounding_box()['height'] >= (44 if mob else 32) - 0.5,
           f'{name}: the chip is a touch target of at least {44 if mob else 32}px')
        # The Public tab's issue link says the bill it came from as well (the same link, one copy of the rule).
        go(p, '/bill/SB2175/public', 2600)
        pub = p.locator('a.bw-issname')
        ok(pub.count() == 1 and pub.first.get_attribute('href') == f'#/issue/{ISSUE}?from=SB2175', f'{name}: the Public tab links to the issue from SB2175')
        if not mob: p.screenshot(path=f'{OUT}/{name}-bill-public.png')
        # A bill on no issue says so in Details, and has no chip.
        lone = p.evaluate("async () => { const m = await import('./staff/data.js'); const b = m.S.bills.find(x => x.tracked !== false && !m.S.billIssues.some(y => y.bill_id === x.id)); return b ? b.bill_number : null; }")
        if lone:
            go(p, '/bill/' + lone)
            ok(p.locator('.bw-page a.bw-ichip').count() == 0 and p.locator('.bw-dt dt', has_text='Issue').count() == 1 and 'None yet' in p.locator('.bw-dl').inner_text(),
               f'{name}: {lone} (on no issue) has no chip and says "None yet" in Details')
        else:
            print('SKIP every tracked bill is on an issue in this snapshot')
        # 2. Going to the issue from the bill: the Back link returns to that bill. From SB2175 that is the Details link (no
        #    header chip); its Back says "Back to SB2175" on a phone too, since it fits (the fresh-eyes review, 10/10).
        go(p, '/bill/SB2175')
        p.locator('.bw-dl a[href^="#/issue/"]').first.click(); p.wait_for_timeout(2200)
        ok(p.evaluate('location.hash') == f'#/issue/{ISSUE}?from=SB2175', f'{name}: the Details link opens the issue ({p.evaluate("location.hash")[:40]})')
        back = p.locator('.le-deskback') if not mob else p.locator('.sv-hdr .sv-back')
        ok(back.count() == 1 and back.inner_text().strip() == 'Back to SB2175' and back.get_attribute('aria-label') in (None, 'Back to SB2175'),
           f'{name}: the Back link reads "Back to SB2175"' + (' on the phone header too' if mob else ''))
        # 3. The issue page says where it stands: a status line per bill, and the Where it stands block above the bills.
        stand = p.locator('.is-stand')
        ok(stand.count() == 1 and all(k in stand.inner_text() for k in ('Where it stands', 'Next hearing', 'At risk', 'By stage')),
           f'{name}: "Where it stands" names next hearing, at risk and by stage')
        ok(stand.count() == 1 and stand.first.bounding_box()['y'] < p.locator('#is-bh').bounding_box()['y'],
           f'{name}: "Where it stands" is above the bills')
        # This session's bills: the list directly under the Bills heading (the earlier sessions fold in a details below it).
        bill_rows = p.locator('section[aria-labelledby="is-bh"] > ol.le-bills > li.le-brow')
        stats = p.locator('section[aria-labelledby="is-bh"] > ol.le-bills .is-bstat')
        ok(bill_rows.count() == 2 and stats.count() == 2, f'{name}: each bill row has its one-line status ({stats.count()} of {bill_rows.count()})')
        sb = bill_rows.filter(has_text='SB2175').locator('.is-bstat')
        ok(sb.count() == 1 and 'Needs a hearing in HLT' in sb.inner_text() and 'days left' in sb.inner_text() and 'Owner:' in sb.inner_text(),
           f'{name}: SB2175 says what it needs, its deadline and days left, and its owner ({sb.inner_text() if sb.count() else ""!r})')
        hb = bill_rows.filter(has_text='HB2121').locator('.is-bstat')
        ok(hb.count() == 1 and 'Hearing Fri 3/20' in hb.inner_text() and 'Testimony filed' in hb.inner_text(),
           f'{name}: HB2121 has its next hearing and its testimony status ({hb.inner_text() if hb.count() else ""!r})')
        ok(p.locator('.le-bills .le-brow .le-bmain .chip, .le-bills .le-brow .le-bmain .sv-chip').count() >= 2,
           f'{name}: each row keeps its position chip')
        ok(p.locator('.is-stand a[href^="#/hearing/"]').count() == 1, f'{name}: the next hearing links to its page')
        ok(not wide_scroll(p), f'{name}: the issue page has no sideways scroll')
        p.locator('.le-bills').first.scroll_into_view_if_needed()
        p.screenshot(path=f'{OUT}/{name}-issue.png')
        # 4. Back returns to SB2175.
        back.click(); p.wait_for_timeout(2200)
        ok(p.evaluate('location.hash') == '#/bill/SB2175', f'{name}: Back returns to SB2175 ({p.evaluate("location.hash")})')
        ok(p.locator('.bw-page').count() == 1 and 'SB2175' in p.locator('.bw-num').first.inner_text(), f'{name}: and it shows SB2175')
        # 5. From the catalogue, the issue's Back still says Issues.
        go(p, '/outreach/issues'); p.locator(f'a[href="#/issue/{ISSUE}"]').first.click(); p.wait_for_timeout(2000)
        cat = p.locator('.le-deskback') if not mob else p.locator('.sv-hdr .sv-back')
        ok(cat.count() == 1 and cat.inner_text().strip() == 'Issues' and 'Back to' not in cat.inner_text(),
           f'{name}: opened from the catalogue, Back says Issues')
        ok(not wide_scroll(p), f'{name}: no sideways scroll after the catalogue visit')
        c.close()
    # 6. Between sessions: the stand block says so in one line, with no numbers.
    c = b.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True); p = c.new_page(); p.on('pageerror', lambda e: errors.append(str(e)))
    p.goto(BASE.replace('?demo=1', '?demo=1&season=off') + f'#/issue/{ISSUE}'); p.reload(); p.wait_for_timeout(2600)
    st = p.locator('.is-stand')
    ok(st.count() == 1 and 'Between sessions' in st.inner_text() and 'Next hearing' not in st.inner_text(),
       f'between sessions: one line that says so, no numbers ({st.inner_text()[:90] if st.count() else ""!r})')
    ok(not wide_scroll(p), 'between sessions, phone: no sideways scroll')
    c.close()
    b.close()
ok(not [e for e in errors if 'Failed to fetch' not in e], f'no page errors {errors[:3]}')
print(f'{sum(res)} passed, {len(res) - sum(res)} failed')
sys.exit(1 if not all(res) else 0)
