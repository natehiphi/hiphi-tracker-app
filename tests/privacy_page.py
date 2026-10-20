# The privacy page, whole and short (J2-3, R-180 wave 2; backend 157-160).
# python3 tests/privacy_page.py [base_url]   (sandbox)
# Checks: it opens with "What we have on you, in short" (five lines, the contact and the 10 business days in the last); the details
# follow as short lists, none of them a wall of text (no paragraph over 90 words, no list line over 90); it says what the old page left
# out (staff notes, what stays after a stop or a deletion, the periods, the contact); the periods named are the ones Nate chose; the
# counts promise (10 people) is the one the database keeps (backend 159); it fits at 390 and 1440 with no sideways scroll; both
# variants (texts confirmed by a text, and by a code) work; no console errors.
# R-303: the calm redesign is the default. Its privacy page (pub/rec/you.js privacyRec) keeps the first section open as a card
# (.yu-short, its h2) and the rest as closed cards titled in their summaries (.rc-ft), Accessibility among them; the words are
# the same rows (pub/more.js), so they are read from the page's text, closed cards included.
import os, re, sys
from playwright.sync_api import sync_playwright
# Screenshots go to tests/out (git-ignored), as in the older tests: a Mac-only folder crashed the test on GitHub's machine (R-200).
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out'); os.makedirs(OUT, exist_ok=True)
BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832/track.html')
passes, fails, errors = [], [], []
def ok(c, m): (passes if c else fails).append(('PASS ' if c else 'FAIL ') + m)
with sync_playwright() as pw:
    b = pw.chromium.launch()
    for W, H, codes in ((390, 844, '&codes=0'), (1440, 900, '&codes')):
        c = b.new_context(viewport={'width': W, 'height': H}); p = c.new_page(); tag = f'@{W}{" codes" if codes == "&codes" else ""}'
        p.on('pageerror', lambda e: errors.append(str(e)[:160])); p.on('console', lambda m: errors.append(m.text[:160]) if m.type == 'error' and 'favicon' not in m.text else None)
        p.goto(BASE + f'?demo=1{codes}#/privacy'); p.wait_for_selector('.yu-pv', timeout=30000); p.wait_for_timeout(500)
        heads = [h.strip() for h in p.locator('.yu-pv h2, .yu-pv .rc-ft').all_text_contents()]
        ok(heads[0] == 'What we have on you, in short', f'{tag}: it opens with "What we have on you, in short" ({heads[0]!r})')
        first = p.locator('.yu-pv .yu-short')
        items = first.locator('li').all_inner_texts()
        ok(len(items) == 5 and 'contact@hiphi.org' in items[-1] and '10 business days' in items[-1] and 'never sell' in items[-1], f'{tag}: five lines; the last gives the contact and the 10 business days')
        ok(first.locator('a[href="mailto:contact@hiphi.org"]').count() == 1, f'{tag}: the contact is a link')
        for h in ('Accessibility', 'Notes staff keep', 'How long we keep things', 'Delete it, or ask us to', 'What we count', 'If you add your email'):
            ok(h in heads, f'{tag}: a section "{h}"')
        t = p.locator('.yu-pv').text_content()
        ok('notes, tags and follow-up reminders' in t, f'{tag}: it says staff keep notes, tags and reminders')
        ok('only the number and the day, for 4 years' in t and '30 days' in t and '7 years' in t and '3 years' in t and 'Error reports: 1 year' in t and '45 days' in t, f'{tag}: the periods: a stop 4 years, unconfirmed numbers 30 days, email 7 years, accounts 3, errors 1, Postmark 45 days')
        ok('the people who run our database could open the table that holds it' in t.lower().replace('The people', 'the people') or 'could open the table that holds it' in t, f'{tag}: it says who could open the number table')
        ok('reporters' in t, f'{tag}: sharing names the reporters choice')
        ok('emails we sent you' in t and 'which ones you opened' in t and 'stays until you reply STOP or ask us' in t, f'{tag}: what deleting erases, and that a number stays until STOP')
        ok('only once 10 people are in them' in t, f'{tag}: totals appear only from 10 people')
        long_p = p.evaluate("[...document.querySelectorAll('.yu-pv p, .yu-pv li')].map(e => e.textContent.trim().split(/\\s+/).length).filter(n => n > 90)")
        ok(not long_p, f'{tag}: no paragraph or line over 90 words ({long_p})')
        ok(p.locator('.yu-pv .mr-factlist').count() >= 8, f'{tag}: the long sections are short lists ({p.locator(".mr-factlist").count()})')
        ok(not p.evaluate('document.documentElement.scrollWidth > innerWidth + 1'), f'{tag}: no sideways scroll')
        ok(re.search(r'Updated \d+ October 2026', p.locator('main').text_content()), f'{tag}: it is dated')
        if W == 390: p.screenshot(path=os.path.join(OUT, 'privacy_page_390.png'), full_page=True)
        c.close()
    b.close()
ok(not errors, 'no console errors' + ('' if not errors else ': ' + ' | '.join(errors[:4])))
print('\n'.join(passes + fails)); print(f'\n{len(passes)} passed, {len(fails)} failed')
sys.exit(1 if fails else 0)
