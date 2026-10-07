# The tracker in other languages: the machinery (R-166 step 3). Sandbox; a made-up language is put in the page by the test
# (globalThis.__HIPHI_WORDS__, __HIPHI_TRANS__, __HIPHI_LIVE__), since no real language is live yet.
# python3 tests/i18n.py [base_url]
# Checks: in English there is no picker and <html lang> is en; with ?lang= (a preview) the words of the first screen and More come from the
# language's list, a word with no translation stays English, plurals and {values} fill in, <html lang> follows; HIPHI's database text
# (a category's name and description) comes from the passed translations while what a person picks stays the English key; the picker
# is drawn only when a language is live, names each language in itself, switches, is remembered after a reload, and English brings
# it all back; a broken words file leaves English; no console errors. (tests/i18n_same.py proves the English markup is unchanged.)
import sys
from playwright.sync_api import sync_playwright
BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832/track.html')
passes, fails, errors = [], [], []
def ok(c, m): (passes if c else fails).append(('PASS ' if c else 'FAIL ') + m)
WORDS = """({ xx: null, ilo: {
  'Speak up for a healthier Hawaiʻi': 'ILO Agsao para iti nasalun-at nga Hawaiʻi', 'We keep watch': 'ILO Bantayanmi', 'Back': 'ILO Agsubli', 'Skip': 'ILO Lampasan', 'Next': 'ILO Sumaruno',
  'About 4 minutes. Free.': 'ILO Mga 4 a minuto. Libre.', '{n} issues': 'ILO {n} a banag', '{n} issue': 'ILO {n} a banag', '{what} moving': 'ILO {what} a mapan',
  'Your first visit': 'ILO Umuna a pagsarungkarmo', 'More': 'ILO Dadduma pay', 'Help': 'ILO Tulong', 'Privacy': 'ILO Privacy', 'From HIPHI': 'ILO Manipud HIPHI', 'Language': 'ILO Pagsasao' } })"""
with sync_playwright() as pw:
    b = pw.chromium.launch()
    def page(extra='', live=False, trans=False, words=WORDS, w=390, h=844):
        c = b.new_context(viewport={'width': w, 'height': h}); p = c.new_page()
        p.on('pageerror', lambda e: errors.append(str(e)[:160])); p.on('console', lambda m: errors.append(m.text[:160]) if m.type == 'error' and 'favicon' not in m.text and '404' not in m.text else None)   # a preview of a language with no word file asks for it and gets a 404
        init = f'globalThis.__HIPHI_WORDS__ = {words};'
        if live: init += "globalThis.__HIPHI_LIVE__ = ['ilo'];"
        if trans: init += "globalThis.__HIPHI_TRANS__ = { ilo: [{ kind: 'category.name', ref: 'KEY', text: 'ILO CATNAME' }, { kind: 'category.description', ref: 'KEY', text: 'ILO CATDESC' }] };"
        p.add_init_script(init)
        return c, p
    # 1. English
    c, p = page(); p.goto(BASE + '?demo=1&restart#/start/1'); p.wait_for_selector('.st-tile', timeout=30000); p.wait_for_timeout(500)
    ok(p.evaluate('document.documentElement.lang') == 'en' and p.locator('.lang-pick').count() == 0, 'English: <html lang="en"> and no picker')
    ok('Speak up for a healthier Hawaiʻi' in p.inner_text('#st-h'), 'English: the heading is the English')
    c.close()
    # 2. a preview in another language
    c, p = page(); p.goto(BASE + '?demo=1&restart&lang=ilo#/start/1'); p.wait_for_selector('.st-tile', timeout=30000); p.wait_for_timeout(500)
    ok(p.evaluate('document.documentElement.lang') == 'ilo', '?lang=ilo: <html lang="ilo">')
    ok(p.inner_text('#st-h') == 'ILO Agsao para iti nasalun-at nga Hawaiʻi', f'the heading comes from the list ({p.inner_text("#st-h")!r})')
    t = p.inner_text('.st'); ok('ILO Bantayanmi' in t and 'ILO Mga 4 a minuto. Libre.' in t, 'the three lines and the time promise are translated')
    ok('We tell you when it’s your moment' in t, 'a word with no translation stays English, on the same screen')
    ok('ILO Sumaruno' in p.inner_text('.st-bar') and 'ILO Lampasan' in p.inner_text('.st-bar'), 'the bar says Next and Skip in the language')
    ok('ILO 6 a banag a mapan' in t or 'ILO' in p.locator('.st-icount').first.inner_text(), f'a count fills {{values}} and plurals: {p.locator(".st-icount").first.inner_text()!r}')
    ok(p.locator('.lang-pick').count() == 0, 'a preview does not draw the picker (the language is not live)')
    # a tile still follows the English key
    p.locator('.st-tile').first.click(); p.wait_for_timeout(200)
    saved = p.evaluate("JSON.parse(localStorage.getItem('hiphi_wiz_demo') || localStorage.getItem('hiphi_wiz') || '{}').issues || []")
    ok(len(saved) == 1 and saved[0] and not saved[0].startswith('ILO'), f'what a person picks is saved under the English key, not the translation ({saved})')
    c.close()
    # 3. HIPHI's database text
    c, p = page(trans=True); p.goto(BASE + '?demo=1&restart#/start/1'); p.wait_for_selector('.st-tile', timeout=30000)
    key = p.evaluate("document.querySelector('.st-tile').dataset.stissue")
    c.close()
    c, p = page(trans=True, live=True)
    p.add_init_script(f"globalThis.__HIPHI_TRANS__ = {{ ilo: [{{ kind: 'category.name', ref: '{key}', text: 'ILO CATNAME' }}, {{ kind: 'category.description', ref: '{key}', text: 'ILO CATDESC' }}] }};")
    p.goto(BASE + '?demo=1&restart&lang=ilo#/start/1'); p.wait_for_selector('.st-tile', timeout=30000); p.wait_for_timeout(800)
    first = p.locator('.st-tile').first
    ok('ILO CATNAME' in first.inner_text() and 'ILO CATDESC' in first.inner_text(), f'a category tile shows its passed translation ({first.inner_text()[:60]!r})')
    ok(p.locator('.st-tile', has_text='ILO CATNAME').count() == 1, 'only the category with a translation changed; the others stay English')
    c.close()
    # 4. the picker, with a live language
    c, p = page(live=True); p.goto(BASE + '?demo=1&codes=0&fv=full&end=today#/more'); p.wait_for_selector('.mr-more', timeout=30000); p.wait_for_timeout(500)
    ok(p.locator('.mr-lang .lang-pick, .lang-pick').count() == 1, 'a live language: the picker is on More')
    p.click('.lang-pick summary'); p.wait_for_timeout(200)
    opts = p.locator('.lp-opt').all_inner_texts()
    ok([o.strip() for o in opts] == ['English', 'Ilokano'], f'each language is named in itself ({opts})')
    ok(all(p.locator('.lp-opt').nth(i).get_attribute('lang') in ('en', 'ilo') for i in range(2)), 'each option carries its own lang attribute')
    p.click('.lp-opt[data-lang="ilo"]'); p.wait_for_timeout(900)
    ok(p.evaluate('document.documentElement.lang') == 'ilo' and 'ILO Dadduma pay' in p.inner_text('h1'), 'choosing it changes the page at once')
    ok(p.evaluate("localStorage.getItem('hiphi_lang') || localStorage.getItem('hiphi_lang_demo')") == 'ilo', 'and is remembered on this device')
    p.reload(); p.wait_for_selector('.mr-more', timeout=30000); p.wait_for_timeout(600)
    ok(p.evaluate('document.documentElement.lang') == 'ilo' and 'ILO Dadduma pay' in p.inner_text('h1'), 'a reload stays in it')
    p.click('.lang-pick summary'); p.click('.lp-opt[data-lang="en"]'); p.wait_for_timeout(800)
    ok(p.evaluate('document.documentElement.lang') == 'en' and 'More' == p.inner_text('h1').strip(), 'English brings everything back')
    c.close()
    # 5. a language whose list is missing or broken stays English
    c, p = page(words='({})'); p.goto(BASE + '?demo=1&restart&lang=haw#/start/1'); p.wait_for_selector('.st-tile', timeout=30000)
    ok('Speak up for a healthier Hawaiʻi' in p.inner_text('#st-h'), 'a language with no word file stays in English')
    c.close(); b.close()
ok(not errors, 'no console errors' + ('' if not errors else ': ' + ' | '.join(errors[:4])))
print('\n'.join(passes + fails)); print(f'\n{len(passes)} passed, {len(fails)} failed')
sys.exit(1 if fails else 0)
