# The privacy page, whole and short (J2-3, R-180 wave 2; backend 157-160).
# python3 tests/privacy_page.py [base_url]   (sandbox)
# Checks: it opens with "What we have on you, in short", the whole page in short (R-212 #52): eight lines, each led by its bold
# words (Just looking, A mobile number, Your email, Your story, Testimony, Your address, Never sold, Delete it), so the story,
# public testimony, the address never kept and deleting it yourself are all answered at the top; the number and story lines in
# the sign-in-by-code words with &codes; the contact and the 10 business days in the last; the details
# follow as short lists, none of them a wall of text (no paragraph over 90 words, no list line over 90); it says what the old page left
# out (staff notes, what stays after a stop or a deletion, the periods, the contact); the periods named are the ones Nate chose; the
# counts promise (10 people) is the one the database keeps (backend 159); it fits at 390 and 1440 with no sideways scroll; both
# variants (texts confirmed by a text, and by a code) work; the fourth tab is named as the person sees it: "under You" on the
# calm page, "under More" on the old one (?rec=0), which still draws every section open; no console errors.
# R-303: the calm redesign is the default. Its privacy page (pub/rec/you.js privacyRec) keeps the first section open as a card
# (.yu-short, its h2) and the rest as closed cards titled in their summaries (.rc-ft), Accessibility among them; the words are
# the same rows (pub/more.js), so they are read from the page's text, closed cards included.
import os, re, sys
from playwright.sync_api import sync_playwright
# Screenshots go to tests/out (git-ignored), as in the older tests: a Mac-only folder crashed the test on GitHub's machine (R-200).
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out'); os.makedirs(OUT, exist_ok=True)
BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832/track.html')
passes, fails, errors = [], [], []
LEADS = ['Just looking:', 'A mobile number:', 'Your email:', 'Your story:', 'Testimony:', 'Your address:', 'Never sold:', 'Delete it:']
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
        items = [' '.join(x.split()) for x in first.locator('li').all_inner_texts()]
        leads = first.evaluate("s => [...s.querySelectorAll('li')].map(li => li.firstElementChild?.tagName === 'B' && li.textContent.trim().startsWith(li.firstElementChild.textContent) ? li.firstElementChild.textContent.trim() : '')")
        ok(len(items) == 8, f'{tag}: eight lines in short ({len(items)})')
        ok(leads == LEADS, f'{tag}: each line starts with its bold lead words ({leads})')
        line = dict(zip(LEADS, items + [''] * 8))
        ok('contact@hiphi.org' in items[-1] and '10 business days' in items[-1] and 'delete your account any time' in items[-1], f'{tag}: the last says you can delete your account, with the contact and the 10 business days')
        ok(first.locator('a[href="mailto:contact@hiphi.org"]').count() == 1, f'{tag}: the contact is a link')
        ok('the Capitol posts your name and letter online' in line['Testimony:'] and 'HIPHI staff can’t see them' in line['Testimony:'], f'{tag}: testimony is public on the Capitol site; the copies kept are only yours')
        ok('never kept' in line['Your address:'] and 'just your districts' in line['Your address:'], f'{tag}: the address is never kept, staff see just the districts')
        ok('quotes it only if you say yes' in line['Your story:'] and 'asks you again before any public use' in line['Your story:'], f'{tag}: the story line names the quote choice')
        ok('never sell' in line['Never sold:'], f'{tag}: never sold')
        if codes == '&codes':
            ok('it signs you in' in line['A mobile number:'] and 'never the number' in line['A mobile number:'] and 'Your account keeps your profile' in line['A mobile number:'], f'{tag}: with codes, the number signs you in and the account keeps the rest, never the number shown')
            ok('until you add your email or number;' in line['Your story:'], f'{tag}: with codes, the story joins the account with an email or a number')
        else:
            ok('signs you in' not in line['A mobile number:'] and 'Staff never see the number' in line['A mobile number:'], f'{tag}: before codes, the number line keeps the number from staff and signs no one in')
            ok('until you add your email;' in line['Your story:'], f'{tag}: before codes, the story stays on this device until an email')
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
        # The fourth tab is "You" here (pub/app.js TABS_A); its "Your alerts" row is where texts stop (more.js youWords).
        ok('under More' not in t and 'from your profile under You' in t and 'use Your alerts, under You' in t, f'{tag}: the calm page names the tab "You" and its "Your alerts" row')
        if W == 390: p.screenshot(path=os.path.join(OUT, 'privacy_page_390.png'), full_page=True)
        c.close()
    # The old page (?rec=0), its fourth tab still "More": every section open, the same eight lines, its own tab's words.
    for codes in ('&codes=0', '&codes'):
        c = b.new_context(viewport={'width': 390, 'height': 844}); p = c.new_page(); tag = f'?rec=0{" codes" if codes == "&codes" else ""}'
        p.on('pageerror', lambda e: errors.append(str(e)[:160])); p.on('console', lambda m: errors.append(m.text[:160]) if m.type == 'error' and 'favicon' not in m.text else None)
        p.goto(BASE + f'?rec=0&demo=1{codes}#/privacy'); p.wait_for_selector('.mr-facts', timeout=30000); p.wait_for_timeout(500)
        t = p.locator('.mr-privacy').text_content()
        leads = p.evaluate("[...document.querySelectorAll('.mr-facts > section:first-child li')].map(li => li.firstElementChild?.tagName === 'B' ? li.firstElementChild.textContent.trim() : '')")
        ok(leads == LEADS, f'{tag}: the same eight lines in short ({leads})')
        ok('under You' not in t and 'from your profile under More' in t and 'use Alerts in your profile, under More' in t, f'{tag}: the old page names the tab "More" and the profile\'s Alerts')
        ok(not p.evaluate('document.documentElement.scrollWidth > innerWidth + 1'), f'{tag}: no sideways scroll')
        c.close()
    b.close()
ok(not errors, 'no console errors' + ('' if not errors else ': ' + ' | '.join(errors[:4])))
print('\n'.join(passes + fails)); print(f'\n{len(passes)} passed, {len(fails)} failed')
sys.exit(1 if fails else 0)
