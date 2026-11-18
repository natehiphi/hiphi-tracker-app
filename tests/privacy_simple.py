# The simpler privacy page (R-401): everyone's since 17 Nov 2026; ?pv=1 brings back the sixteen-card page.
# python3 tests/privacy_simple.py [base_url]   (sandbox; serve the repo on 127.0.0.1 with a listen backlog of 256)
# Checks: the default address opens with "In short", five lines with their bold leads (under 80 words), six cards in order with
# only Text messages open, the carriers' sentences in the open card, no Accessibility card, and #/privacy?part=access a page of
# its own; NO WORDS LOST: every li and p of the old page's cards (all but the old short card and Accessibility) is in the new
# page's text; with ?pv=1 the old page is untouched (it still opens with "What we have on you, in short").
import re, sys
from playwright.sync_api import sync_playwright
BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8832/track.html')
passes, fails, errors = [], [], []
def ok(c, m): (passes if c else fails).append(('PASS ' if c else 'FAIL ') + m)
LEADS = ['Just looking:', 'If you add your email or number:', 'Your address:', 'Testimony is public:', 'Never sold.']
FOLDS = ['privacy-texts', 'privacy-keep', 'privacy-who', 'privacy-public', 'privacy-delete', 'privacy-tech']
TITLES = ['Text messages', 'What we keep', 'Who sees it', 'What becomes public', 'Keeping and deleting', 'The technical details']
norm = lambda s: ' '.join(s.split())
with sync_playwright() as pw:
    b = pw.chromium.launch()
    for codes in ('&codes=0', '&codes'):
        tag = 'codes' if codes == '&codes' else 'no codes'
        c = b.new_context(viewport={'width': 390, 'height': 844}); p = c.new_page()
        p.on('pageerror', lambda e: errors.append(str(e)[:160])); p.on('console', lambda m: errors.append(m.text[:160]) if m.type == 'error' and 'favicon' not in m.text else None)
        # the old page, for the words and to prove it is untouched
        p.goto(BASE + f'?demo=1{codes}&pv=1#/privacy'); p.wait_for_selector('.yu-pv', timeout=30000); p.wait_for_timeout(500)
        old_head = p.locator('.yu-pv .rc-h2').first.text_content().strip()
        ok(old_head == 'What we have on you, in short', f'{tag}: with pv=1 it opens with "What we have on you, in short" ({old_head!r})')
        old = p.evaluate("[...document.querySelectorAll('.yu-pv .rc-fold')].filter(f => f.dataset.rcFold !== 'privacy-access').flatMap(f => [...f.querySelectorAll('li, p')].map(e => e.textContent))")
        ok(len(old) > 40, f'{tag}: collected the old cards\' lines ({len(old)})')
        p.goto(BASE + f'?demo=1{codes}#/privacy'); p.wait_for_selector('.yu-pv .rc-fold', timeout=30000); p.wait_for_timeout(500)
        ok(p.locator('.yu-short .rc-h2').text_content().strip() == 'In short', f'{tag}: heading "In short"')
        card = p.locator('.yu-short')
        leads = card.evaluate("s => [...s.querySelectorAll('li')].map(li => li.firstElementChild?.tagName === 'B' ? li.firstElementChild.textContent.trim() : '')")
        ok(leads == LEADS, f'{tag}: five lines, each led by its bold words ({leads})')
        ok(card.locator('ul[role=list]').count() == 1 and card.locator('a[href^="mailto:"]').count() == 1, f'{tag}: a role=list list, the contact is a mail link')
        words = len(card.text_content().split())
        ok(words < 80, f'{tag}: the card is {words} words (under 80)')
        names = p.evaluate("[...document.querySelectorAll('.yu-pv .rc-fold')].map(f => f.dataset.rcFold)")
        ok(names == FOLDS, f'{tag}: six folds in order ({names})')
        titles = [x.strip() for x in p.locator('.yu-pv .rc-ft').all_text_contents()]
        ok(titles == TITLES, f'{tag}: their titles ({titles})')
        opened = p.evaluate("[...document.querySelectorAll('.yu-pv .rc-fold[open]')].map(f => f.dataset.rcFold)")
        ok(opened == ['privacy-texts'], f'{tag}: only Text messages is open ({opened})')
        t0 = norm(p.locator('[data-rc-fold="privacy-texts"]').text_content())
        ok('We do not share, sell, or provide your mobile phone number or messaging consent data to third parties or affiliates for marketing or promotional purposes.' in t0
           and 'We text at most once a day. Message and data rates may apply.' in t0 and 'Reply STOP' in t0 and 'Reply HELP for help.' in t0, f'{tag}: the open card has the Twilio sentence, the rates line, STOP and HELP')
        ok(p.locator('[data-rc-fold="privacy-texts"] a[href="text-terms.html"]').count() == 1, f'{tag}: Text terms link')
        ok(p.locator('[data-rc-fold="privacy-access"]').count() == 0 and 'Accessibility' not in norm(p.locator('main').text_content()), f'{tag}: no Accessibility on the page')
        ok('Updated 17 November 2026.' in norm(p.locator('main').text_content()) and 'Hawaiʻi Public Health Institute (HIPHI) runs this tracker.' in norm(p.locator('main').text_content()) and p.locator('.yu-pv a[target=_blank]').count() == 1, f'{tag}: the foot')
        ok(p.locator('[data-rc-fold="privacy-who"] h3').first.text_content() == 'Your story', f'{tag}: Who sees it starts with "Your story"')
        main = norm(p.locator('main').evaluate("m => { m.querySelectorAll('details').forEach(d => d.open = true); return m.textContent; }"))
        # one phrase is reworded on purpose: the services are listed below the sharing sentence now, not above it
        old = [x.replace('the services above', 'the services that run the tracker') for x in old]
        lost = [norm(x) for x in old if norm(x) and norm(x) not in main]
        ok(not lost, f'{tag}: no words lost ({len(old)} old lines)' + ('' if not lost else ': ' + ' | '.join(l[:90] for l in lost[:5])))
        ok(not p.evaluate('document.documentElement.scrollWidth > innerWidth + 1'), f'{tag}: no sideways scroll at 390')
        p.goto(BASE + f'?demo=1{codes}#/privacy?part=access'); p.wait_for_selector('.yu-acc', timeout=30000); p.wait_for_timeout(400)
        ok(p.locator('.yu-pv h1').text_content().strip() == 'Accessibility' and 'screen readers' in p.locator('.yu-acc').text_content() and p.locator('.rc-fold').count() == 0, f'{tag}: ?part=access is the Accessibility page, no folds')
        ok(p.title().startswith('Accessibility'), f'{tag}: its document title ({p.title()!r})')
        c.close()
    # with ?rec=0 the oldest page shows, pv=1 or not
    c = b.new_context(viewport={'width': 390, 'height': 844}); p = c.new_page()
    p.goto(BASE + '?rec=0&demo=1&pv=1#/privacy'); p.wait_for_selector('.mr-facts', timeout=30000)
    ok('What we have on you, in short' in p.locator('.mr-facts').text_content(), 'rec=0 ignores pv=1 and shows the oldest page')
    c.close(); b.close()
ok(not errors, 'no console errors' + ('' if not errors else ': ' + ' | '.join(errors[:4])))
print('\n'.join(passes + fails)); print(f'\n{len(passes)} passed, {len(fails)} failed')
sys.exit(1 if fails else 0)
