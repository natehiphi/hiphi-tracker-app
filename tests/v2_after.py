# R-357 part A (Nate, 28 and 30 Oct 2026): what the letter no longer asks moves to after the Mahalo, behind ?v2=1
# (pub/helper.js, pub/v2/letter.js, pub/nextask.js, pub/profile.js; the letter itself is tests/v2_letter.py's).
#   ?demo=1&v2=1, a phone (390x844):
#   keep my story, then the quote question (the Mahalo)
#     - someone with a profile and no story for the topic: the Mahalo draws the story card, "Save a sentence on why this matters to you?", right
#       under the thank-you, with their own line (the letter's "Add a line of your own") already in its box, a screen-reader-only label (the heading
#       asks it) and two lines of help that say who sees it first; the quote question is not asked yet. Its answers are the BAR's: a filled "Save to
#       my profile" and an outlined "No thanks", never Done (the critic, 30 Oct: Done closed the sheet over the unsaved sentence)
#     - "Save to my profile" saves a FIRST story: the card's place says it is saved and asks, once, "Can HIPHI quote your stories?" in the
#       profile's own words with its three choices (none chosen); the bar holds a filled Save and an outlined Not now, no second ask (the friend
#       card) shows beside it; Save with no choice says so and stays
#     - Not now saves nothing, is remembered (hiphi_me.quoteAsked), leaves one line ("Okay. You can answer any time on your profile."), Done comes
#       back and the friend card comes; a second letter's story save asks nothing
#     - an answer is saved as the profile saves it (hiphi_me.quote); a story that is not the first never asks
#     - someone with no profile meets the profile ask first, and no story card beside it; once a number is saved there, the same Mahalo asks for
#       the story (and still says the profile is saved); "Not now" to the profile ask asks no story
#   the title, a later visit's page (C-16)
#     - version 2, a profile, a letter or email sent, no title: the next day opens "Add a title to your letters" in the first visit's frame
#       (no tabs, "Welcome back"), the profile's picker, Save the one filled button and an equal Not now; Save with none says so; Not now
#       lands on Home and quiets it (14 days); Save keeps the title in the profile, and the next letter says it
#     - the ask comes only with version 2, a profile, a letter or email sent and no title, and after the districts ask
#   the sign-off
#     - the letter's closing word has a "change" beside it, as the name has: it opens, below the name, the five ideas and a box ("Or type your own
#       sign-off"), in place; a pick writes the letter and hiphi_me.closing; their own words follow as they type; Enter folds it away; the copied
#       letter ends with it
#     - the profile page (version 2 only) has "How you sign off" with the same ideas and box, saved as chosen ("Mahalo" marked while nothing is
#       saved), and the letter follows it
#   nothing in the console but what the page always says
# usage: python3 tests/v2_after.py [BASE]   (BASE defaults to http://localhost:8832); screenshots go to tests/out/v2_after/
import json, os, sys
from playwright.sync_api import sync_playwright

BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832').split('/track.html')[0].rstrip('/')
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out', 'v2_after'); os.makedirs(OUT, exist_ok=True)
fails = 0
def ok(cond, what):
  global fails
  print(('PASS ' if cond else 'FAIL ') + what)
  if not cond: fails += 1

RETURNING = "const w = JSON.stringify({step: 9, issues: [], done: true}); localStorage.setItem('hiphi_wiz', w); localStorage.setItem('hiphi_wiz_demo', w)"
# a profile and a Capitol account: the sandbox reads and writes hiphi_me as hiphi_me_demo (the init script writes the copy itself)
def profile(extra=None):
  me = {'name': 'Leilani Kahale', 'capitolAcct': True, **(extra or {})}
  return "if (!localStorage.getItem('hiphi_me_demo')) localStorage.setItem('hiphi_me_demo', JSON.stringify(%s))" % json.dumps(me)
PROFILE = profile()
# a confirmed text number is what makes a profile (myprofile.js hasProfile)
TEXT = "localStorage.setItem('hiphi_text_demo', JSON.stringify({token: 't-test', phone: '8085550123', at: new Date().toISOString(), confirmed: true}))"
DIST = "localStorage.setItem('hiphi_districts_demo', JSON.stringify({senate: '1', house: '1'}))"
H = '86f499e6-7bab-4943-ad6e-5f4d23e85e34'; HR = '62da6ef7-6c9a-4a03-975b-4b5155e564dc'   # HB 2300 and its hearing of Wed 18 Mar
DONE = "localStorage.setItem('hiphi_done_demo', JSON.stringify(['%s|%s|testimony']))" % (H, HR)
DAY = "localStorage.setItem('hiphi_askday_demo', 'mon')"   # the last visit was Monday: "?day=wed" is a new day's first arrival
PHONE = dict(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
LINE = 'My daughter eats school lunch every day, and it matters that it is good food.'
SHEET = """() => {
  const d = document.querySelector('#hp-dlg'); if (!d) return null;
  const vis = e => { const r = e.getBoundingClientRect(); return e.checkVisibility({ visibilityProperty: true }) && r.width > 0 && r.top < innerHeight && r.bottom > 0; };
  return { filled: [...d.querySelectorAll('.btn.primary')].filter(vis).map(e => e.textContent.trim()), text: d.querySelector('.hp-in').innerText.replace(/\\s+/g, ' ').trim(),
    inputs: [...d.querySelectorAll('.hp-in input:not([type=hidden]), .hp-in textarea, .hp-in select')].map(e => e.id || e.name),
    foot: d.querySelector('.hp-foot').innerText.replace(/\\s+/g, ' ').trim(), wide: document.documentElement.scrollWidth > innerWidth + 1 }; }"""
ME = "() => JSON.parse(localStorage.getItem('hiphi_me_demo') || '{}')"

def shot(pg, name): pg.screenshot(path=os.path.join(OUT, name + '.png'))

def page(br, url, init=(), errs=None, kw=PHONE):
  ctx = br.new_context(**kw, device_scale_factor=2); ctx.grant_permissions(['clipboard-read', 'clipboard-write'])
  for s in init: ctx.add_init_script(s)
  pg = ctx.new_page()
  if errs is not None:
    pg.on('pageerror', lambda e: errs.append('pageerror ' + str(e)))
    pg.on('console', lambda m: errs.append('console ' + m.text) if m.type == 'error' else None)
  pg.goto(url, wait_until='domcontentloaded'); return ctx, pg

def bill(pg, num):   # the bill page's slide for this bill (a hash change in the same document: wait until the slide names it)
  pg.goto(f'{BASE}/track.html?demo=1&v2=1#/bill/{num}', wait_until='domcontentloaded')
  pg.wait_for_function("n => (document.querySelector('#main .v2-slide')?.innerText || '').replace(/\\s+/g, '').includes(n)", arg=num, timeout=30000); pg.wait_for_timeout(700)

def open_letter(pg):
  pg.click('.v2-go .btn.primary'); pg.wait_for_selector('#hp-dlg[open] .v2-paper', timeout=10000); pg.wait_for_timeout(350)

def send(pg, line=LINE):   # a letter from the bill page to the Mahalo, for someone with a Capitol account (two screens)
  open_letter(pg)
  if line: pg.fill('#hp-why', line)
  for sel in ('button[data-hp=next]', '[data-hp=copyopen]', '[data-hp=confirm]'):
    pg.click(sel); pg.wait_for_timeout(350)
  pg.wait_for_selector('#hp-dlg .hp-mahalo', timeout=15000); pg.wait_for_timeout(500)

NOQUOTE = lambda pg: pg.evaluate("() => document.querySelectorAll('#hp-dlg .hp-quoteask').length") == 0
FRIEND = lambda pg: pg.evaluate("() => document.querySelectorAll('#hp-dlg .hp-friend').length")

with sync_playwright() as pw:
  br = pw.chromium.launch()

  # ---------------- keep my story, then the quote question ----------------
  errs = []; ctx, pg = page(br, f'{BASE}/track.html?demo=1&v2=1#/bill/HB2300', [RETURNING, PROFILE, TEXT], errs)
  pg.wait_for_selector('#main .v2-slide', timeout=30000); pg.wait_for_timeout(700)
  send(pg)
  r = pg.evaluate(SHEET)
  ok('Mahalo, Leilani!' in r['text'] and 'Save a sentence on why this matters to you?' in r['text'], 'the Mahalo of someone with a profile draws the story card')
  ok(pg.input_value('#hp-sa') == LINE, 'its box already holds their own line from the letter')
  ok(pg.evaluate("() => { const s = document.querySelector('.hp-storyask'), n = document.querySelector('.hp-next'); return !!s && !!n && !!(s.compareDocumentPosition(n) & Node.DOCUMENT_POSITION_FOLLOWING); }"), 'and it sits right under the thank-you, above "What happens next"')
  ok(pg.evaluate("() => document.querySelector('#hp-sa-t').getBoundingClientRect().top < innerHeight - 100"), 'so its heading is on the first screen')
  ok(NOQUOTE(pg) and 'Can HIPHI quote your stories?' not in r['text'], 'the quote question is not asked yet')
  ok(pg.evaluate("() => document.querySelector('label[for=hp-sa]').classList.contains('sr') && document.querySelector('label[for=hp-sa]').getBoundingClientRect().width <= 1"), 'the box\'s label is for screen readers: the heading asks the question once')
  ok(pg.evaluate("document.querySelector('#hp-sa-h').innerText") == 'HIPHI staff can see it. We put it in your next letters on this topic; change it any time.', 'two lines of help, who sees it first')
  ok(pg.evaluate("() => document.querySelectorAll('.hp-storyask .btn').length") == 0, 'the card has no buttons of its own: its answers are in the bar')
  ok(r['filled'] == ['Save to my profile'] and 'Done' not in r['foot'] and 'No thanks' in r['foot'] and FRIEND(pg) == 0, f"the bar holds the answers, a filled one and an outlined one, and not Done: {r['filled']}, {r['foot']!r}")
  ok(pg.evaluate("() => { const b = [...document.querySelectorAll('.hp-foot .btn')].map(e => [e.textContent.trim(), e.className.replace(/\\s+/g, ' ')]); return b.length === 2 && b[0][1].includes('secondary') && b[1][1].includes('primary'); }"), 'No thanks outlined, Save to my profile filled')
  shot(pg, 'mahalo-story')
  pg.click('.hp-foot [data-hp=storysave]'); pg.wait_for_selector('#hp-dlg .hp-quoteask', timeout=8000); pg.wait_for_timeout(350)
  r = pg.evaluate(SHEET); me = pg.evaluate(ME)
  ok(len(me.get('stories') or {}) == 1 and list(me['stories'].values())[0] == LINE and 'quote' not in me, f"a FIRST story is saved in the profile, and no answer to the quote question yet ({me.get('stories')}, quote {me.get('quote')!r})")
  ok('Saved in your profile as your story' in r['text'] and 'Can HIPHI quote your stories?' in r['text'], 'the saved card\'s place says so and asks the quote question')
  ok('This applies to all of them. HIPHI asks you again before using one anywhere public.' in r['text'], 'in the profile\'s own words (R-304: not one changed)')
  labels = pg.evaluate("() => [...document.querySelectorAll('#hp-dlg .hp-quoteask label')].map(l => l.textContent.trim())")
  ok(labels == ['My first name and island', 'My full name', 'My full name, and HIPHI may share it with reporters'], f'the three choices {labels}')
  ok(pg.evaluate("() => document.querySelectorAll('#hp-dlg .hp-quoteask input:checked').length") == 0, 'none is chosen for them (B-12)')
  btns = pg.evaluate("() => [...document.querySelectorAll('.hp-foot .btn')].map(b => [b.textContent.trim(), b.className.replace(/\\s+/g, ' ')])")
  ok([b[0] for b in btns] == ['Not now', 'Save'] and 'secondary' in btns[0][1] and 'primary' in btns[1][1] and pg.evaluate("() => document.querySelectorAll('.hp-quoteask .btn').length") == 0, f'the bar holds an outlined Not now and a filled Save, the card none {btns}')
  ok(r['filled'] == ['Save'] and FRIEND(pg) == 0 and 'Ask a friend' not in r['foot'] and 'Done' not in r['foot'], f"no Done and no second ask while it is open: {r['filled']}, {r['foot']!r}")
  shot(pg, 'mahalo-quote')
  pg.click('.hp-foot [data-hp=quotesave]'); pg.wait_for_timeout(300)
  ok('Pick one, or choose Not now.' in pg.evaluate(SHEET)['text'] and not NOQUOTE(pg) and 'quote' not in pg.evaluate(ME), 'Save with no choice says so, stays, and saves nothing')
  pg.click('.hp-foot [data-hp=quoteno]'); pg.wait_for_timeout(400)
  me = pg.evaluate(ME); r = pg.evaluate(SHEET)
  ok('Okay. You can answer any time on your profile.' in r['text'] and 'Done' in r['foot'], 'Not now leaves one line behind, and Done is back in the bar')
  ok(NOQUOTE(pg) and 'quote' not in me and me.get('quoteAsked') is True, f"Not now saves no answer and is remembered ({me.get('quote')!r}, quoteAsked {me.get('quoteAsked')})")
  ok(FRIEND(pg) == 1 and 'Saved in your profile as your story' in r['text'], 'the card closes, the story stays saved, and the next ask (a friend) comes')
  ok(not pg.evaluate("() => !!document.querySelector('#hp-dlg [data-hp=quotesave]')"), 'the question is gone, with its buttons')
  # a second letter, on another bill (another topic): its story is asked, its quote question is not
  pg.keyboard.press('Escape'); pg.wait_for_timeout(500)
  bill(pg, 'HB1780'); send(pg, 'The bus is how my son gets to school.')
  r = pg.evaluate(SHEET)
  ok('Save a sentence on why this matters to you?' in r['text'], 'a second letter, on another topic, is asked for its story as before')
  pg.click('.hp-foot [data-hp=storysave]'); pg.wait_for_timeout(500)
  ok(NOQUOTE(pg) and 'Saved in your profile as your story' in pg.evaluate(SHEET)['text'] and len(pg.evaluate(ME)['stories']) == 2, 'and saving it asks no quote question (once is enough)')
  ok(not errs, f'no errors {errs[:2]}'); ctx.close()

  # an answer is saved as the profile saves it
  errs = []; ctx, pg = page(br, f'{BASE}/track.html?demo=1&v2=1#/bill/HB2300', [RETURNING, PROFILE, TEXT], errs)
  pg.wait_for_selector('#main .v2-slide', timeout=30000); pg.wait_for_timeout(700)
  send(pg); pg.click('.hp-foot [data-hp=storysave]'); pg.wait_for_selector('#hp-dlg .hp-quoteask', timeout=8000)
  pg.click('label[for=hp-qa-name]'); pg.click('.hp-foot [data-hp=quotesave]'); pg.wait_for_timeout(500)
  me = pg.evaluate(ME); r = pg.evaluate(SHEET)
  ok(me.get('quote') == 'name' and me.get('quoteAsked') is True, f"My full name, Save: the profile keeps it ({me.get('quote')!r})")
  ok(NOQUOTE(pg) and 'Your answer is saved. You can change it in your profile.' in r['text'] and FRIEND(pg) == 1, 'a line says so, the card closes, and the friend card comes')
  ok(not errs, f'no errors {errs[:2]}'); ctx.close()

  # a story that is not their first never asks
  errs = []; ctx, pg = page(br, f'{BASE}/track.html?demo=1&v2=1#/bill/HB2300', [RETURNING, profile({'stories': {'another-issue': 'A story I saved before.'}}), TEXT], errs)
  pg.wait_for_selector('#main .v2-slide', timeout=30000); pg.wait_for_timeout(700)
  send(pg); pg.click('.hp-foot [data-hp=storysave]'); pg.wait_for_timeout(500)
  ok(NOQUOTE(pg) and 'Saved in your profile as your story' in pg.evaluate(SHEET)['text'], 'with a story already kept, saving another asks no quote question')
  ok(not errs, f'no errors {errs[:2]}'); ctx.close()

  # no profile yet: the profile ask comes first, and the story ask waits for it
  errs = []; ctx, pg = page(br, f'{BASE}/track.html?demo=1&v2=1#/bill/HB2300', [RETURNING, PROFILE], errs)
  pg.wait_for_selector('#main .v2-slide', timeout=30000); pg.wait_for_timeout(700)
  send(pg)
  r = pg.evaluate(SHEET)
  ok('Save your profile' in r['text'] and 'Save a sentence on why this matters to you?' not in r['text'], 'with no profile yet the Mahalo asks for the profile, and not for a story beside it')
  ok(FRIEND(pg) == 0, 'one ask at a time: no friend card either')
  pg.fill('#hp-ng-phone', '8085550123'); pg.click('.hp-foot .hp-main'); pg.wait_for_timeout(900)
  ok('Save a sentence on why this matters to you?' not in pg.evaluate(SHEET)['text'], 'the code step is still the profile ask: still no story ask')
  pg.fill('#hp-ng-code', '123456'); pg.wait_for_selector('#hp-dlg .hp-storyask', timeout=8000); pg.wait_for_timeout(400)
  r = pg.evaluate(SHEET)
  ok(r['filled'] == ['Save to my profile'] and FRIEND(pg) == 0, f"once a number is saved, the same Mahalo asks for the story, with its answers in the bar ({r['filled']})")
  ok(pg.input_value('#hp-sa') == LINE and 'Your profile is saved' in r['text'], 'the story box holds their line, and the page still says the profile is saved')
  shot(pg, 'mahalo-late-story')
  ok(not errs, f'no errors {errs[:2]}'); ctx.close()
  errs = []; ctx, pg = page(br, f'{BASE}/track.html?demo=1&v2=1#/bill/HB2300', [RETURNING, PROFILE], errs)
  pg.wait_for_selector('#main .v2-slide', timeout=30000); pg.wait_for_timeout(700)
  send(pg); pg.click('.hp-foot [data-hp=ngno]'); pg.wait_for_timeout(500)
  ok(not pg.evaluate("() => !!document.querySelector('#hp-dlg .hp-storyask')") and FRIEND(pg) == 1, 'Not now to the profile ask: no story ask (a story needs a profile), the friend card comes')
  ok(not errs, f'no errors {errs[:2]}'); ctx.close()

  # ---------------- the title, a later visit's page ----------------
  INIT = [RETURNING, PROFILE, TEXT, DIST, DONE, DAY]
  errs = []; ctx, pg = page(br, f'{BASE}/track.html?demo=1&v2=1&day=wed#/', INIT, errs)
  pg.wait_for_selector('#main .nx-title', timeout=30000); pg.wait_for_selector('#nx-tp-host .tp-chips [data-tp]', timeout=15000); pg.wait_for_timeout(700)
  ok(pg.evaluate('location.hash') == '#/next/title', f"the next day opens on the title page, before Home ({pg.evaluate('location.hash')})")
  info = pg.evaluate("""() => ({ h1: document.querySelector('main h1').innerText, lede: document.querySelector('.nx .lede').innerText, eye: document.querySelector('.nx-eyebrow').innerText,
    notabs: document.body.classList.contains('notabs') && !document.querySelector('nav.tabs'), chips: document.querySelectorAll('#nx-tp-host .tp-chips [data-tp]').length,
    bar: [...document.querySelectorAll('.actionbar .btn')].map(b => [b.textContent.trim(), b.classList.contains('primary')]),
    filled: [...document.querySelectorAll('.btn.primary')].filter(b => b.getBoundingClientRect().width > 0).map(b => b.textContent.trim()), wide: document.documentElement.scrollWidth > innerWidth + 1 })""")
  ok(info['h1'] == 'Add a title to your letters', f"the heading {info['h1']!r}")
  ok(info['lede'].startswith('A nurse, a parent, a small business owner: a title tells lawmakers who is writing.'), f"one line under it {info['lede']!r}")
  ok('Welcome back' in info['eye'] and info['notabs'], 'in the first visit\'s frame: "Welcome back", no tabs')
  ok(info['chips'] >= 8 and not info['wide'], f"the profile's picker ({info['chips']} titles) and no sideways scroll")
  ok(pg.evaluate("document.querySelector('#nx-tp-host .tp-lede').innerText") == 'Pick one or two that fit, or type your own.', 'the hint says one or two, as a letter uses up to two')
  ok(info['bar'] == [['Not now', False], ['Save', True]] and info['filled'] == ['Save'], f"Save is the one filled button, with an equal Not now beside it {info['bar']}")
  shot(pg, 'title-page')
  pg.click('.actionbar [data-nxgo]'); pg.wait_for_timeout(300)
  ok(pg.evaluate('location.hash') == '#/next/title' and 'Pick a title, or choose Not now.' in pg.evaluate("document.querySelector('#nx-t-msg').innerText"), 'Save with no title says so and stays')
  pg.click('.actionbar [data-nxno]'); pg.wait_for_timeout(1200)
  ok(pg.evaluate('location.hash') == '#/' and pg.evaluate("document.querySelectorAll('#main .nx').length") == 0, f"Not now lands on Home ({pg.evaluate('location.hash')})")
  ok(pg.evaluate("(JSON.parse(localStorage.getItem('hiphi_asks_demo') || '{}').title || {}).no") == 1 and pg.evaluate(ME).get('titles') in (None, []), 'it is quieted as the others are, and nothing was saved')
  ok(not errs, f'no errors {errs[:2]}'); ctx.close()

  errs = []; ctx, pg = page(br, f'{BASE}/track.html?demo=1&v2=1&day=wed#/', INIT, errs)
  pg.wait_for_selector('#nx-tp-host .tp-chips [data-tp]', timeout=30000); pg.wait_for_timeout(500)
  pg.click('#nx-tp-host [data-tp=nurse]'); pg.wait_for_timeout(250)
  ok(pg.evaluate("document.querySelector('#nx-tp-host [data-tp=nurse]').getAttribute('aria-pressed')") == 'true', 'a title picked stays in view, ticked')
  pg.click('.actionbar [data-nxgo]'); pg.wait_for_timeout(1200)
  ok(pg.evaluate('location.hash') == '#/' and pg.evaluate(ME).get('titles') == ['nurse'], f"Save keeps it in the profile and lands on Home ({pg.evaluate(ME).get('titles')})")
  ok((pg.evaluate("JSON.parse(localStorage.getItem('hiphi_asks_demo') || '{}').title") or {}).get('done') is True, 'and the ask is done for good')
  bill(pg, 'HB1780'); open_letter(pg)   # (HB 2300's letter was sent already)
  ok('nurse' in pg.evaluate(SHEET)['text'], 'the next letter says it')
  ok(not errs, f'no errors {errs[:2]}'); ctx.close()

  # who gets the page: version 2, a profile, a letter or email sent, no title; after the districts ask
  def asks(init, url='?demo=1&v2=1'):
    c, p = page(br, f'{BASE}/track.html{url}#/', init)
    p.wait_for_selector('#main .hm, #main .ah, #main .cm, #main .nx', timeout=60000); p.wait_for_timeout(800)
    k = p.evaluate("import('./pub/nextask.js').then(m => m.pickAsk())"); c.close(); return k
  ok(asks(INIT) == 'title', 'pickAsk: version 2, a profile, a letter sent, no title: the title')
  ok(asks([RETURNING, PROFILE, TEXT, DONE, DAY]) == 'legs', 'the districts ask comes first')
  ok(asks(INIT, '?demo=1') != 'title', 'without version 2 it is never asked')
  ok(asks([RETURNING, PROFILE, TEXT, DIST, DAY]) != 'title', 'with no letter or email sent, it is not asked')
  ok(asks([RETURNING, profile({'titles': ['parent']}), TEXT, DIST, DONE, DAY]) != 'title', 'with a title already, it is not asked')
  ok(asks([RETURNING, PROFILE, DIST, DONE, DAY]) != 'title', 'with no profile (no number, no account), it is not asked')

  # ---------------- the sign-off ----------------
  errs = []; ctx, pg = page(br, f'{BASE}/track.html?demo=1&v2=1#/bill/HB2300', [RETURNING, PROFILE], errs)
  pg.wait_for_selector('#main .v2-slide', timeout=30000); pg.wait_for_timeout(700)
  open_letter(pg)
  c0 = pg.evaluate("() => { const b = document.querySelector('#v2-closing'); return { tag: b.tagName, text: b.textContent.trim(), exp: b.getAttribute('aria-expanded'), h: Math.round(b.getBoundingClientRect().height), cls: b.className, word: document.querySelector('.v2-cw').textContent.trim(), same: b.parentElement === document.querySelector('.v2-cw').parentElement }; }")
  ok(c0['word'] == 'Mahalo,' and c0['tag'] == 'BUTTON' and c0['text'] == 'change' and c0['exp'] == 'false' and c0['h'] >= 44 and 'v2-rename' in c0['cls'] and c0['same'], f"the closing word has a visible \"change\" beside it, as the name has, a 44px target {c0}")
  ok(pg.evaluate(SHEET)['inputs'] == ['hp-why'], 'and nothing else of the sign-off shows until it is tapped')
  pg.click('#v2-closing'); pg.wait_for_timeout(300)
  r = pg.evaluate(SHEET)
  chips = pg.evaluate("() => [...document.querySelectorAll('#v2-closeopt [data-hp=v2-closing-pick]')].map(b => [b.textContent.trim(), b.getAttribute('aria-pressed')])")
  ok(chips == [['Mahalo', 'true'], ['Thank you', 'false'], ['Sincerely', 'false'], ['Respectfully', 'false'], ['Aloha', 'false']], f'a tap opens the five ideas, in place {chips}')
  ok('Or type your own sign-off' in r['text'] and 'v2-closing-own' in r['inputs'] and pg.evaluate("document.querySelector('#v2-closing').getAttribute('aria-expanded')") == 'true', 'and a small box for their own words')
  ok(pg.evaluate("() => { const w = document.querySelector('.v2-cw').getBoundingClientRect(), n = document.querySelector('.v2-name').getBoundingClientRect(), o = document.querySelector('#v2-closeopt').getBoundingClientRect(); return w.bottom <= n.top + 1 && n.bottom <= o.top + 1; }"), 'the name stays directly under the closing word, the ideas and the box below both')
  shot(pg, 'letter-closing-open')
  pg.click('[data-hp=v2-closing-pick][data-v=Sincerely]'); pg.wait_for_timeout(300)
  r = pg.evaluate(SHEET)
  ok('v2-closing-own' not in r['inputs'] and pg.evaluate("document.querySelector('.v2-cw').textContent.trim()") == 'Sincerely,', 'a pick folds the options away and the letter says it')
  ok(pg.evaluate(ME).get('closing') == 'Sincerely', f"and it is kept in hiphi_me ({pg.evaluate(ME).get('closing')!r})")
  ok(pg.evaluate("document.activeElement.id") == 'v2-closing', 'the focus goes back to the word')
  pg.click('#v2-closing'); pg.fill('#v2-closing-own', 'Warmly'); pg.wait_for_timeout(250)
  pressed = pg.evaluate("() => [...document.querySelectorAll('#v2-closeopt [data-hp=v2-closing-pick][aria-pressed=true]')].length")
  ok(pg.evaluate("document.querySelector('.v2-cw').textContent.trim()") == 'Warmly,' and pg.evaluate(ME).get('closing') == 'Warmly' and pressed == 0, 'their own words follow as they type, and are kept')
  pg.keyboard.press('Enter'); pg.wait_for_timeout(250)
  ok('v2-closing-own' not in pg.evaluate(SHEET)['inputs'] and pg.evaluate("document.activeElement.id") == 'v2-closing', 'Enter folds it away')
  pg.click('button[data-hp=next]'); pg.wait_for_timeout(350)
  pg.click('[data-hp=copyopen]'); pg.wait_for_timeout(350)
  clip = pg.evaluate("() => navigator.clipboard.readText()")
  ok(clip.rstrip().endswith('Warmly,\nLeilani Kahale'), f"the copied letter ends with it {clip[-40:]!r}")
  ok(not errs, f'no errors {errs[:2]}'); ctx.close()

  # ---------------- the profile page ----------------
  errs = []; ctx, pg = page(br, f'{BASE}/track.html?demo=1&v2=1#/profile', [RETURNING, PROFILE, TEXT], errs)
  pg.wait_for_selector('#pf-signoff', timeout=30000); pg.wait_for_timeout(800)
  ok(pg.evaluate("() => { const s = [...document.querySelectorAll('.pf-sec')].map(e => e.id); return s.indexOf('pf-signoff') === s.indexOf('pf-story') + 1; }"), 'version 2\'s profile has "How you sign off", right after Your stories')
  pg.locator('#pf-signoff').scroll_into_view_if_needed(); pg.wait_for_timeout(250)
  ok(pg.evaluate("[...document.querySelectorAll('#pf-signoff [data-pf-so]')].map(b => b.textContent.trim())") == ['Mahalo', 'Thank you', 'Sincerely', 'Respectfully', 'Aloha'], 'the same five ideas')
  ok(pg.evaluate("[...document.querySelectorAll('#pf-signoff [aria-pressed=true]')].map(b => b.textContent.trim())") == ['Mahalo'], 'with nothing saved, Mahalo is marked: it is the default the line names')
  shot(pg, 'profile-signoff')
  pg.click('[data-pf-so=Aloha]'); pg.wait_for_timeout(300)
  ok(pg.evaluate(ME).get('closing') == 'Aloha' and pg.evaluate("document.querySelector('[data-pf-so=Aloha]').getAttribute('aria-pressed')") == 'true' and 'Saved. Your letters end with “Aloha”.' in pg.evaluate("document.querySelector('#pf-so-st').innerText"), 'a tap saves it as it is chosen, and says so')
  pg.fill('#pf-so-own', 'With thanks'); pg.wait_for_timeout(250)
  ok(pg.evaluate(ME).get('closing') == 'With thanks' and pg.evaluate("document.querySelectorAll('#pf-signoff [aria-pressed=true]').length") == 0, 'their own words are kept as they type')
  ok(not pg.evaluate("() => !!document.querySelector('.pf-bar')"), 'it does not wake the Save bar: it keeps itself')
  bill(pg, 'HB2300'); open_letter(pg)
  ok(pg.evaluate("document.querySelector('.v2-cw').textContent.trim()") == 'With thanks,', 'the next letter closes with it')
  ok(not errs, f'no errors {errs[:2]}'); ctx.close()
  errs = []; ctx, pg = page(br, f'{BASE}/track.html?demo=1#/profile', [RETURNING, PROFILE, TEXT], errs)
  pg.wait_for_selector('#pf-about', timeout=30000); pg.wait_for_timeout(600)
  ok(pg.evaluate("document.querySelectorAll('#pf-signoff').length") == 0, 'today\'s profile (no v2) has no such section')
  ok(not errs, f'no errors {errs[:2]}'); ctx.close()

  br.close()
print(f"\n{'ALL PASS' if not fails else str(fails) + ' FAILED'}")
sys.exit(1 if fails else 0)
