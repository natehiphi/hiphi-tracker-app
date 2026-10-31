# R-357 Part 2 (Nate, 30 Oct 2026): the letter in three screens, behind ?v2=1 (pub/v2/letter.js, pub/v2/letter.css, the hooks in pub/helper.js).
#   ?demo=1&v2=1#/bill/HB2300, a phone (375x812), a newcomer with no profile:
#     - Help me write testimony opens one sheet, "1 of 3": the stance as one line ("Your letter supports it · change", HIPHI's side chosen)
#       with the hint "Tap a line to keep it or leave it out." directly under it, the letter already written from HIPHI's three talking points
#       (two kept with a check, one left out with a plus, in the same slot), "Add a line of your own (optional)", "Signed by" with a name
#       box, one filled button that says what is next ("Next: your Capitol account" for a first-timer, else "Next: send it"); nothing else of About
#       you (no email, no title or sign-off chips, no keep-my-story, no quote question)
#     - a tap on a point greys it (plus, aria-pressed) and the letter that is copied loses that line; a tap on the grey one puts it back
#     - Next with no name stops with a plain message at the name box; with a name, "2 of 3": the Capitol account (the honest words, the two
#       choices, the Public Access Room's number) and the way out, "Email the chair instead · 2 min, no account"
#     - "No, this is my first time", "3 of 3": one button, "Copy and open the Capitol page"; pressed, "Did it go through?" (Yes, Not yet)
#     - Yes records the act as "I already sent it" did (the kept mark) and shows today's Mahalo; 5 taps from the bill page in all
#     - Not yet folds the question away and leaves the button and the steps; I'll finish later keeps the letter: the bill page says
#       "Finish sending your testimony", Home offers it, and it comes back on "3 of 3"
#   a profile and a Capitol account: the name is plain text in the letter, no account screen, "1 of 2", 4 taps
#   the email (R-357 pE, Nate 31 Oct: "why is drafting testimony not the same process as writing an email to the chair. Shouldn't they be aligned?"):
#     "Email the chair instead" is the same letter as an email, "1 of 2", then a send screen in testimony's shape: one filled button in the bar
#     ("Open my email app"), one small row of other ways (Gmail, Outlook.com, Copy the email), no "I already sent it", no three copy buttons; a tap
#     on any of them (the link is followed, the message is copied too) brings the same question, "Did it go through?" (Yes records the email and
#     shows the Mahalo; Not yet keeps the sheet and the draft); 4 taps from the bill page to Yes; the account screen's way out lands there
#   "change" shows Support / Oppose / Not sure; the opposite side goes to the Capitol's own form
#   today's page (no v2): the six-part walkthrough, none of version 2 loaded, and its email path still ends on "Send your email" with its three buttons
#   nothing in the console but what the page always says
# usage: python3 tests/v2_letter.py [BASE]   (BASE defaults to http://localhost:8832); V2_LETTER_OUT=<folder> also saves the screenshots
import os, re, sys, urllib.parse
from playwright.sync_api import sync_playwright

BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832').split('/track.html')[0].rstrip('/')
OUT = os.environ.get('V2_LETTER_OUT')
fails = 0
def ok(cond, what):
  global fails
  print(('PASS ' if cond else 'FAIL ') + what)
  if not cond: fails += 1

RETURNING = "const w = JSON.stringify({step: 9, issues: [], done: true}); localStorage.setItem('hiphi_wiz', w); localStorage.setItem('hiphi_wiz_demo', w)"
# a profile and a Capitol account: the sandbox reads and writes hiphi_me as hiphi_me_demo
PROFILE = "if (!localStorage.getItem('hiphi_me_demo')) localStorage.setItem('hiphi_me_demo', JSON.stringify({name: 'Leilani Kahale', capitolAcct: true}))"
KAI = """try { const set = (k, v) => localStorage.setItem(k + '_demo', typeof v === 'string' ? v : JSON.stringify(v));
  if (!localStorage.getItem('hiphi_wiz_demo')) {
  set('hiphi_issue_follows', ['66a32660-b0a7-4a90-a71f-231963619b44', '1dcec7ca-ed94-4a19-9c9c-235514ca7491', '2616613e-a363-418b-ae19-4add60957cd8']);
  set('hiphi_watch_ids', []); set('hiphi_cat_follows', []); set('hiphi_skips', []); set('hiphi_wiz', { done: true, issues: ['tobacco', 'food', 'around'], name: 'Kai' });
  set('hiphi_onb', { lastVisit: new Date(Date.parse('2026-03-15T19:00:00-10:00')).toISOString() }); set('hiphi_done', []); set('hiphi_done_at', {}); set('hiphi_stances', {});
  set('hiphi_demo_seeded', '0'); localStorage.setItem('hiphi_tour_bill_demo', '{"how":"test"}'); localStorage.setItem('hiphi_tour_home_demo', '{"how":"test"}'); } } catch {}"""
PHONE = dict(viewport={'width': 375, 'height': 812}, is_mobile=True, has_touch=True)
PHONE390 = dict(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)   # the email's send screen is judged at the phone Nate uses
# a link that would leave the page (the mail app, a Gmail tab) is recorded, not followed; the dialog's own click handler still runs
CATCH = """document.addEventListener('click', e => { const a = e.target.closest && e.target.closest('a[data-hp=send]'); if (!a) return;
  e.preventDefault(); (window.__opened ||= []).push(a.href); }, true);"""
MAILDRAFTS = "() => Object.values(JSON.parse(localStorage.getItem('hiphi_me') || '{}').mail || {}).map(v => ({ screen: v.screen, v2: v.v2, tried: v.tried }))"
H = '86f499e6-7bab-4943-ad6e-5f4d23e85e34'   # HB 2300 in the sandbox; its hearing of Wed 18 Mar is 62da6ef7-6c9a-4a03-975b-4b5155e564dc
# what the sheet shows: its title, count, heading, filled buttons in view, the fields it asks, the text (for words)
SHEET = """() => {
  const d = document.querySelector('#hp-dlg'); if (!d) return null;
  const vis = e => { const r = e.getBoundingClientRect(); return e.checkVisibility({ visibilityProperty: true }) && r.width > 0 && r.top < innerHeight && r.bottom > 0; };
  return { title: d.querySelector('.hp-title')?.textContent.trim(), count: d.querySelector('.hp-count')?.textContent.trim() || '', h: d.querySelector('.hp-h')?.textContent.replace(/^\\s*(Part )?\\d+ of \\d+:\\s*/, '').trim() || '',
    filled: [...d.querySelectorAll('.btn.primary')].filter(vis).map(e => e.textContent.trim()), text: d.querySelector('.hp-in').innerText.replace(/\\s+/g, ' ').trim(),
    inputs: [...d.querySelectorAll('.hp-in input:not([type=hidden]), .hp-in textarea, .hp-in select')].map(e => e.id || e.name),
    foot: d.querySelector('.hp-foot').innerText.replace(/\\s+/g, ' ').trim(), prog: d.querySelectorAll('.hp-prog i').length,
    wide: document.documentElement.scrollWidth > innerWidth + 1, dlgW: Math.round(d.getBoundingClientRect().width) }; }"""
POINTS = "() => [...document.querySelectorAll('#hp-dlg .v2-pt')].map(b => ({ on: b.getAttribute('aria-pressed') === 'true', out: b.classList.contains('out'), plus: !!b.querySelector('.ic-plus'), check: !!b.querySelector('.ic-check'), x: Math.round(b.querySelector('.v2-ptt').getBoundingClientRect().left), th: Math.round(b.querySelector('.v2-ptt').getBoundingClientRect().height), h: Math.round(b.getBoundingClientRect().height), text: [...b.querySelector('.v2-ptt').childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim() }))"
DRAFTS = "() => Object.values(JSON.parse(localStorage.getItem('hiphi_me') || '{}').drafts || {}).map(v => ({ screen: v.screen, v2: v.v2, tried: v.tried }))"
MARKS = "() => JSON.parse(localStorage.getItem('hiphi_done_demo') || '[]')"

def shot(pg, name):
  if OUT: os.makedirs(OUT, exist_ok=True); pg.screenshot(path=os.path.join(OUT, name + '.png'))

def ready(pg):
  pg.wait_for_selector('#main .v2-slide', timeout=30000); pg.wait_for_timeout(700)

def page(br, kw, url, init=(), errs=None, scale=1):
  ctx = br.new_context(**kw, device_scale_factor=scale if OUT else 1); ctx.grant_permissions(['clipboard-read', 'clipboard-write'])
  for s in init: ctx.add_init_script(s)
  pg = ctx.new_page()
  if errs is not None:
    pg.on('pageerror', lambda e: errs.append('pageerror ' + str(e)))
    pg.on('console', lambda m: errs.append('console ' + m.text) if m.type == 'error' else None)
  pg.goto(url, wait_until='domcontentloaded'); return ctx, pg   # (the page waits for its own selectors; a slow font or CDN must not fail the test)

class Taps:   # the taps of a journey: every click is counted, typing is not
  def __init__(s, pg): s.pg = pg; s.n = 0
  def __call__(s, sel):
    s.pg.click(sel); s.n += 1; s.pg.wait_for_timeout(350)

with sync_playwright() as pw:
  br = pw.chromium.launch()
  # ---------------- a newcomer, no profile: the whole letter, 5 taps ----------------
  errs = []; ctx, pg = page(br, PHONE, f'{BASE}/track.html?demo=1&v2=1#/bill/HB2300', [RETURNING], errs, 2)
  ready(pg); tap = Taps(pg)
  tap('.v2-go .btn.primary'); pg.wait_for_selector('#hp-dlg[open] .v2-paper', timeout=10000); pg.wait_for_timeout(300)
  r = pg.evaluate(SHEET)
  ok(r['title'] == 'Testimony on HB 2300' and r['count'] == '1 of 3' and r['h'] == 'Your letter' and r['prog'] == 3, f"the frame: title, \"1 of 3\", three parts, and the screen's heading ({r['title']!r}, {r['count']!r}, {r['h']!r})")
  ok(re.search(r'Your letter Your letter supports it · change Tap a line to keep it or leave it out\. Testimony in SUPPORT', r['text']) is not None, f"the stance is one line, the hint is one line under it, then the letter; HIPHI's side chosen: {r['text'][:80]!r}")
  ok('Dear Chair Kim, Vice Chair Kidani, and members of the committee,' in r['text'] and re.search(r'support (of )?HB 2300\.', r['text']) is not None and re.search(r'pass HB 2300', r['text']) is not None, 'the letter is in today\'s format: the greeting, the position, the ask')
  pts = pg.evaluate(POINTS)
  ok(len(pts) == 3 and [p['on'] for p in pts] == [True, True, False] and pts[2]['out'] and pts[2]['plus'] and not pts[2]['check'] and pts[0]['check'] and not pts[0]['plus'] and pts[0]['x'] == pts[2]['x'], f"HIPHI's three points are lines in the letter: two kept with a check, one left out, grey, with a plus, the words starting at the same place ({[(p['on'], p['check'], p['plus'], p['x']) for p in pts]})")
  ok(all(p['h'] >= 44 for p in pts), f"each line is a 44px target (A-6): {[p['h'] for p in pts]}")
  ok('Add a line of your own (optional)' in r['text'] and 'Signed by' in r['text'] and r['text'].count('Tap a line to keep it or leave it out.') == 1 and r['text'].count('Mahalo,') == 1, 'the line of your own, the sign-off and "Signed by" are in the letter')
  ok(r['inputs'] == ['hp-why', 'hp-name'], f"only the line of your own and the name are asked: {r['inputs']} (no email, no titles, no sign-off chips, no story, no quote)")
  ok(r['filled'] == ['Next: your Capitol account'], f"one filled button, and it says the Capitol account is next (A-3, C-6): {r['filled']}")
  hint = pg.evaluate("() => { const h = document.querySelector('.v2-hint'), s = document.querySelector('.v2-stance'); return [Math.round(h.getBoundingClientRect().height / parseFloat(getComputedStyle(h).lineHeight)), h.getBoundingClientRect().top >= s.getBoundingClientRect().bottom - 1, h.getBoundingClientRect().bottom <= document.querySelector('.v2-paper').getBoundingClientRect().top + 1]; }")
  ok(hint == [1, True, True], f'the hint is one line, directly under the stance line and above the letter {hint}')
  ok(r['foot'].endswith('I’ll finish later') and 'Back' in r['foot'], f"Back and I'll finish later are in the bar: {r['foot']!r}")
  ok('Testimony is a short letter to the committee' in r['text'] and 'posted on the Capitol website' in r['text'], 'the notice that testimony is public stays on the letter, in its words')
  shot(pg, 'letter-1-newcomer')
  # a point is a tap: grey with a plus; the letter loses it; a tap puts it back
  first = pts[0]['text'].split('. ')[0][:40]
  pg.click('#hp-v2pt-0'); pg.wait_for_timeout(250)    # (a tap inside the letter, not a step of the journey)
  p2 = pg.evaluate(POINTS)
  ok(not p2[0]['on'] and p2[0]['out'] and p2[0]['plus'] and not p2[0]['check'] and p2[1]['on'], 'tapping a kept line leaves it out: grey, the check becomes a plus')
  ok((p2[0]['x'], p2[0]['th']) == (pts[0]['x'], pts[0]['th']), f"and its words stay where they were and keep their lines ({(pts[0]['x'], pts[0]['th'])} then {(p2[0]['x'], p2[0]['th'])})")
  shot(pg, 'letter-1-point-left-out')
  # Next with no name: the plain message at the box, nothing moves on (not a step of the journey: it did not go on)
  pg.click('button[data-hp=next]'); pg.wait_for_timeout(350)
  r = pg.evaluate(SHEET)
  ok(r['count'] == '1 of 3' and 'Add your name to sign the letter' in r['text'], f"Next with no name stops, with a plain message at the box ({r['count']!r})")
  ok(pg.evaluate("() => document.activeElement.id") == 'hp-name' and pg.evaluate("() => document.querySelector('#hp-name').getAttribute('aria-invalid')") == 'true', 'and the name box has the focus')
  shot(pg, 'letter-1-name-needed')
  pg.fill('#hp-name', 'Leilani Kahale'); pg.wait_for_timeout(150)
  ok('My name is Leilani Kahale' in pg.evaluate(SHEET)['text'] or 'I’m Leilani Kahale' in pg.evaluate(SHEET)['text'], 'the name goes into the letter as it is typed')
  tap('button[data-hp=next]')
  r = pg.evaluate(SHEET)
  ok(r['count'] == '2 of 3' and r['h'] == 'Your Capitol account', f"with a name: 2 of 3, the Capitol account ({r['count']!r}, {r['h']!r})")
  ok('About 10 minutes: the Capitol asks you to make an account. We’ll walk you through it.' in r['text'], 'the honest words: about 10 minutes, a Capitol account, we will walk you through it')
  ok('Yes, I have an account' in r['text'] and 'No, this is my first time' in r['text'] and '(808) 587-0478' in r['text'], "today's two choices and the Public Access Room's number")
  ok('Email the chair instead · 2 min, no account' in r['text'] and r['filled'] == [], f"the way out is a plain link, and nothing on the screen is filled (A-3): {r['filled']}")
  shot(pg, 'letter-2-account')
  tap('[data-hp=v2-acct-no]')
  r = pg.evaluate(SHEET)
  ok(r['count'] == '3 of 3' and r['h'] == 'Send it at the Capitol' and r['filled'] == ['Copy and open the Capitol page'], f"3 of 3: one button, Copy and open the Capitol page ({r['count']!r}, {r['filled']})")
  ok('Sign in, pick the hearing' in r['text'] and 'green box' in r['text'] and 'Register' in r['text'] and 'Did it go through?' not in r['text'], 'what to do there, with the account first for a first-timer; the question waits for the button')
  ok(r['text'].count('Your letter stays saved here') == 1, 'the first-timer\'s screen says the letter is saved once, in the clock note')
  shot(pg, 'letter-3-send')
  tap('[data-hp=copyopen]')
  r = pg.evaluate(SHEET)
  ok('Did it go through?' in r['text'] and r['filled'] == ['Yes'] and 'Not yet' in r['text'], f"pressed: one question, Did it go through? Yes · Not yet, and Yes is the one filled button ({r['filled']})")
  shot(pg, 'letter-3-did-it-go-through')
  clip = pg.evaluate("() => navigator.clipboard.readText()")
  ok('Leilani Kahale' in clip and pts[1]['text'].rstrip('.') in clip and pts[0]['text'].rstrip('.') not in clip and pts[2]['text'].rstrip('.') not in clip and clip.startswith('Testimony in SUPPORT of HB 2300'),
     'the copy is the letter as shown: the kept line, the name, and neither the line left out here nor the one left out from the start')
  tap('[data-hp=confirm]'); pg.wait_for_selector('#hp-dlg .hp-mahalo', timeout=15000); pg.wait_for_timeout(300)   # the act is kept first, then the Mahalo
  r = pg.evaluate(SHEET)
  ok(r['h'] == '' and 'Mahalo, Leilani!' in r['text'] and 'public record' in r['text'], 'Yes: today\'s Mahalo')
  ok(any(m.endswith('|testimony') for m in pg.evaluate(MARKS)), 'and the act is kept, as "I already sent it" keeps it')
  ok(pg.evaluate(DRAFTS) == [], 'no draft is left behind')
  shot(pg, 'letter-mahalo')
  ok(tap.n == 5, f'a newcomer from the bill page: {tap.n} taps (the button, Next, This is my first time, Copy and open, Yes); the name is typed, the Capitol is outside')
  ok(not errs, f'no errors {errs[:2]}'); ctx.close()

  # ---------------- a profile and a Capitol account: two screens, 4 taps ----------------
  errs = []; ctx, pg = page(br, PHONE, f'{BASE}/track.html?demo=1&v2=1#/bill/HB2300', [RETURNING, PROFILE], errs)
  ready(pg); tap = Taps(pg)
  tap('.v2-go .btn.primary'); pg.wait_for_selector('#hp-dlg[open] .v2-paper', timeout=10000); pg.wait_for_timeout(300)
  r = pg.evaluate(SHEET)
  ok(r['count'] == '1 of 2' and r['prog'] == 2 and r['inputs'] == ['hp-why'], f"with a profile and an account the name is plain text and there are two screens ({r['count']!r}, {r['inputs']})")
  ok('Leilani Kahale' in r['text'] and 'Signed by' not in r['text'], 'the profile\'s name signs the letter')
  tap('button[data-hp=next]')
  r = pg.evaluate(SHEET)
  ok(r['count'] == '2 of 2' and r['h'] == 'Send it at the Capitol' and 'Register' not in r['text'] and r['filled'] == ['Copy and open the Capitol page'], f"no account screen, and no account steps ({r['count']!r}, {r['h']!r})")
  tap('[data-hp=copyopen]'); tap('[data-hp=confirm]'); pg.wait_for_selector('#hp-dlg .hp-mahalo', timeout=15000)
  ok('Mahalo, Leilani!' in pg.evaluate(SHEET)['text'] and tap.n == 4, f'a returner: {tap.n} taps (the button, Next, Copy and open, Yes)')
  ok(not errs, f'no errors {errs[:2]}'); ctx.close()

  # ---------------- Not yet keeps the letter; the bill page and Home offer it; it comes back where it was left ----------------
  errs = []; ctx, pg = page(br, PHONE, f'{BASE}/track.html?demo=1&v2=1#/bill/HB2300', [KAI, PROFILE], errs)
  ready(pg)
  pg.click('.v2-go .btn.primary'); pg.wait_for_selector('#hp-dlg[open] .v2-paper', timeout=10000); pg.wait_for_timeout(300)
  ok(pg.evaluate(SHEET)['filled'] == ['Next: send it'], 'with an account the one button says Next: send it')
  pg.click('button[data-hp=next]'); pg.wait_for_timeout(350); pg.click('[data-hp=copyopen]'); pg.wait_for_timeout(350)
  before = pg.evaluate(SHEET)['text']
  pg.click('#hp-dlg [data-hp=v2-notyet]'); pg.wait_for_timeout(400)
  r = pg.evaluate(SHEET)
  ok(r is not None and 'Did it go through?' not in r['text'] and r['filled'] == ['Copy and open the Capitol page'], f"Not yet folds the question away and leaves the one button ({r and r['filled']})")
  ok('Sign in, pick the hearing' in r['text'] and 'green box' in r['text'] and 'Did it go through?' in before, 'and the steps stay where they were')
  ok(pg.evaluate(DRAFTS) == [{'screen': 'v2s', 'v2': 1, 'tried': False}], f"the letter is kept as unfinished ({pg.evaluate(DRAFTS)})")
  ok(pg.evaluate("() => document.activeElement.id") == 'v2-copyopen', 'and the focus goes to the button')
  pg.click('[data-hp=copyopen]'); pg.wait_for_timeout(350)
  ok('Did it go through?' in pg.evaluate(SHEET)['text'], 'pressing it again brings the question back')
  pg.click('#hp-dlg .hp-foot [data-hp=later]'); pg.wait_for_function("() => !document.querySelector('#hp-dlg[open]')", timeout=8000); pg.wait_for_timeout(300)
  ok(pg.evaluate("() => !document.querySelector('#hp-dlg[open]')"), "I'll finish later closes the sheet")
  ok(pg.evaluate(DRAFTS) == [{'screen': 'v2s', 'v2': 1, 'tried': True}], f"and keeps the letter, at the screen it left ({pg.evaluate(DRAFTS)})")
  ok(any('Saved on this device' in t for t in pg.evaluate("() => [...document.querySelectorAll('.toastmsg')].map(t => t.innerText)")), 'a line says where it is kept')
  pg.evaluate("window.scrollTo(0, 0)")
  ok(pg.evaluate("() => document.querySelector('.v2-go .btn.primary').textContent.trim()") == 'Finish sending your testimony', 'the bill page\'s one button now says Finish sending your testimony')
  pg.click('.v2-go .btn.primary'); pg.wait_for_selector('#hp-dlg[open] .v2-ask', timeout=10000); pg.wait_for_timeout(300)
  r = pg.evaluate(SHEET)
  ok(r['count'] == '2 of 2' and 'Welcome back. Your letter is saved right where you left it.' in r['text'] and 'Did it go through?' in r['text'], 'it comes back on the screen it left, with its question')
  pg.keyboard.press('Escape'); pg.wait_for_timeout(500)
  pg.goto(f'{BASE}/track.html?demo=1#/'); pg.wait_for_function("() => !!document.querySelector('main') && !document.querySelector('.skelpage')", timeout=60000); pg.wait_for_timeout(1200)
  home = pg.evaluate("() => document.querySelector('#main').innerText")
  ok('Finish sending your testimony' in home or 'Finish sending it' in home or 'Your letter is started' in home, 'Home (today\'s, no v2) offers to finish it')
  ok(not errs, f'no errors {errs[:2]}'); ctx.close()

  # ---------------- the email: the same letter, then send in testimony's shape; 4 taps ----------------
  errs = []; ctx, pg = page(br, PHONE390, f'{BASE}/track.html?demo=1&v2=1#/bill/HB2300', [RETURNING, PROFILE, CATCH], errs, 2)
  ready(pg); tap = Taps(pg)
  tap('.v2-go .btn.text'); pg.wait_for_selector('#hp-dlg[open] .v2-paper', timeout=10000); pg.wait_for_timeout(300)
  r = pg.evaluate(SHEET)
  ok(r['title'] == 'Email about HB 2300' and r['count'] == '1 of 2' and r['h'] == 'Your email', f"the email kind: two screens ({r['title']!r}, {r['count']!r}, {r['h']!r})")
  ok(re.search(r'To Sen\. .* Subject HB 2300: please vote yes', r['text']) is not None and re.search(r'(Aloha|Dear) Senator', r['text']) is not None and len(pg.evaluate(POINTS)) == 3, 'to the chair, with a subject, in the email\'s own words, the same tappable points')
  ok(r['filled'] == ['Next: send your email'] and 'goes from your own email account' in r['text'], 'Next: send your email, and the note about where an email goes stays')
  shot(pg, 'letter-1-email')
  tap('button[data-hp=next]')
  r = pg.evaluate(SHEET)
  ok(r['count'] == '2 of 2' and r['h'] == 'Send your email' and r['title'] == 'Email about HB 2300', f"then send: \"2 of 2\", the heading Send your email ({r['count']!r}, {r['h']!r})")
  ok('Your email opens in your mail app with everything filled in. Send it there, then come back.' in r['text'], 'one sentence says what the button does and what to do after')
  ok(r['filled'] == ['Open my email app'], f"one filled button, the bar's, as testimony's send screen has (A-3): {r['filled']}")
  ok(re.search(r'Or open in Gmail .*· Outlook\.com .*· Copy the email', r['text']) is not None, f"under it one small row of other ways: Or open in Gmail · Outlook.com · Copy the email ({r['text'][:200]!r})")
  ok(not any(w in r['text'] for w in ('Copy address', 'Copy subject', 'Copy message', 'Open in my mail app', 'Open in Gmail', 'Use another email service', 'Send your email Choose')) and pg.locator('#hp-dlg [data-hp=copypart], #hp-dlg .hp-send, #hp-dlg [data-hp=mailsent]').count() == 0,
     "today's three stacked buttons, the three copy buttons and the \"Use another email service\" block are gone")
  ok('It also copies your message, just in case.' in r['text'] and 'Did it go through?' not in r['text'], 'one small line says the message is copied too; the question waits for a tap')
  ok('Back' in r['foot'] and r['foot'].endswith('I’ll finish later') and 'Open my email app' in r['foot'] and 'I already sent it' not in r['foot'] and 'Something went wrong' not in r['foot'], f"the bar: Back, the one button, I'll finish later, and no \"I already sent it\" ({r['foot']!r})")
  hs = pg.evaluate("() => [...document.querySelectorAll('#hp-dlg .v2-alt .btn')].map(e => Math.round(e.getBoundingClientRect().height))")
  ok(len(hs) == 3 and all(h >= 44 for h in hs) and not r['wide'], f"each of the three small links is a 44px target and nothing runs sideways ({hs})")
  hrefs = pg.evaluate("() => Object.fromEntries([...document.querySelectorAll('#hp-dlg [data-hp=send]')].map(a => [a.dataset.via, a.href]))")
  qs = lambda u: {k: v[0] for k, v in urllib.parse.parse_qs(urllib.parse.urlsplit(u).query).items()}
  m, g, o = urllib.parse.urlsplit(hrefs['app']), qs(hrefs['gmail']), qs(hrefs['outlook'])
  mq = qs(hrefs['app']); to = urllib.parse.unquote(m.path)
  body = mq.get('body', '').replace('\r\n', '\n')
  ok(m.scheme == 'mailto' and '@' in to and mq['subject'].startswith('HB 2300: please vote yes on ') and re.match(r'(Aloha|Dear) Senator', body) is not None and 'Leilani Kahale' in body, f"the button is the mail app's link, with the chair's address, the subject and the whole message ({to}, {mq.get('subject')!r})")
  ok(hrefs['gmail'].startswith('https://mail.google.com/mail/?view=cm&fs=1&') and g['to'] == to and g['su'] == mq['subject'] and g['body'].replace('\r\n', '\n') == body
     and hrefs['outlook'].startswith('https://outlook.live.com/mail/0/deeplink/compose?') and o['to'] == to and o['subject'] == mq['subject'] and o['body'].replace('\r\n', '\n') == body, 'Gmail and Outlook.com carry the same address, subject and message')
  ok(pg.evaluate("() => [...document.querySelectorAll('#hp-dlg .v2-alt a')].every(a => a.target === '_blank' && /noopener/.test(a.rel))"), 'Gmail and Outlook.com open in a new tab')
  shot(pg, 'send-before')
  tap('#hp-dlg .hp-foot [data-via=app]'); pg.wait_for_selector('#hp-dlg .v2-ask', timeout=8000); pg.wait_for_timeout(300)
  r = pg.evaluate(SHEET)
  ok(pg.evaluate("window.__opened") == [hrefs['app']], 'the tap opens the mail app (the link is followed once, not by a script)')
  ok('Did it go through?' in r['text'] and r['filled'] == ['Yes'] and 'Not yet' in r['text'] and 'A copy in your Sent folder means it did.' in r['text'], f"then the same question as testimony's, Yes the one filled button ({r['filled']})")
  ok(pg.evaluate("() => document.querySelector('#hp-dlg .hp-foot .hp-main').classList.contains('secondary')") and 'Open my email app' in r['foot'], 'and the bar\'s button is outlined now, still there to open it again')
  ok(pg.evaluate("() => navigator.clipboard.readText()").replace('\r\n', '\n') == body, 'the message is on the clipboard too, as the older step kept it, "just in case"')
  ok(pg.evaluate(MAILDRAFTS) == [{'screen': 'v2m', 'v2': 1, 'tried': True}], f"the email is kept as started, at this screen ({pg.evaluate(MAILDRAFTS)})")
  shot(pg, 'send-after')
  tap('[data-hp=mailsent]'); pg.wait_for_selector('#hp-dlg .hp-mahalo', timeout=15000)
  r = pg.evaluate(SHEET)
  ok('Mahalo, Leilani!' in r['text'] and any(m.endswith('|email') for m in pg.evaluate(MARKS)), 'Yes: the Mahalo, and the email is kept as sent')
  ok(pg.evaluate(MAILDRAFTS) == [], 'no draft is left behind')
  ok(tap.n == 4, f'from the bill page: {tap.n} taps to Yes (Email the chair, Next: send your email, Open my email app, Yes), 3 to the mail app opening')
  ok(not errs, f'no errors {errs[:2]}'); ctx.close()

  # ---------------- the email's other ways, Not yet, and finishing later ----------------
  errs = []; ctx, pg = page(br, PHONE390, f'{BASE}/track.html?demo=1&v2=1#/bill/HB2300', [RETURNING, PROFILE, CATCH], errs)
  ready(pg)
  pg.click('.v2-go .btn.text'); pg.wait_for_selector('#hp-dlg[open] .v2-paper', timeout=10000); pg.wait_for_timeout(300)
  pg.click('button[data-hp=next]'); pg.wait_for_timeout(400)
  ok(pg.evaluate(MAILDRAFTS) == [{'screen': 'v2m', 'v2': 1, 'tried': False}], f"arriving at the send screen already keeps the email, as testimony's does ({pg.evaluate(MAILDRAFTS)})")
  pg.click('#v2-copyall'); pg.wait_for_selector('#hp-dlg .v2-ask', timeout=5000); pg.wait_for_timeout(200)
  clip = pg.evaluate("() => navigator.clipboard.readText()").replace('\r\n', '\n'); r = pg.evaluate(SHEET)
  ok(re.match(r'To: \S+@\S+\nSubject: HB 2300: please vote yes on [^\n]+\n\n(Aloha|Dear) Senator', clip) is not None and clip.endswith('Leilani Kahale'), f"Copy the email copies the address, the subject and the message as one text ({clip[:90]!r})")
  ok('Copied' in r['text'] and 'Did it go through?' in r['text'] and r['filled'] == ['Yes'], 'a small "Copied" says so, and the question follows, as after the button')
  ok(pg.evaluate("() => document.activeElement.id") == 'v2-copyall', 'the focus stays on the link that was tapped')
  shot(pg, 'send-copied')
  pg.wait_for_timeout(2800)
  ok('Copied' not in pg.evaluate(SHEET)['text'] and 'Did it go through?' in pg.evaluate(SHEET)['text'], '"Copied" goes after a moment; the question stays')
  pg.click('#hp-dlg [data-hp=v2-notyet]'); pg.wait_for_timeout(400)
  r = pg.evaluate(SHEET)
  ok(r is not None and 'Did it go through?' not in r['text'] and r['filled'] == ['Open my email app'] and r['count'] == '2 of 2', f"Not yet folds the question away, keeps the sheet and puts the one button back ({r and r['filled']})")
  ok(pg.evaluate(MAILDRAFTS) == [{'screen': 'v2m', 'v2': 1, 'tried': False}] and pg.evaluate("() => document.activeElement.id") == 'v2-app', 'the email is kept as unfinished, and the focus goes to the button')
  ok('Your email is saved here. Open your mail app again when you are ready.' in pg.evaluate("() => document.querySelector('#hp-live').textContent"), 'and a screen reader is told: Okay. Your email is saved here. Open your mail app again when you are ready.')
  pg.click('#v2-gmail'); pg.wait_for_selector('#hp-dlg .v2-ask', timeout=8000)
  ok(pg.evaluate("window.__opened").pop().startswith('https://mail.google.com/mail/?view=cm&fs=1&'), 'Gmail opens the same way, and brings the question back')
  pg.click('#hp-dlg .hp-foot [data-hp=later]'); pg.wait_for_function("() => !document.querySelector('#hp-dlg[open]')", timeout=8000); pg.wait_for_timeout(300)
  ok(pg.evaluate(MAILDRAFTS) == [{'screen': 'v2m', 'v2': 1, 'tried': True}], f"I'll finish later keeps the email at the screen it left ({pg.evaluate(MAILDRAFTS)})")
  pg.evaluate("window.scrollTo(0, 0)")
  pg.click('.v2-go .btn.text'); pg.wait_for_selector('#hp-dlg[open] .v2-ask', timeout=10000); pg.wait_for_timeout(300)
  r = pg.evaluate(SHEET)
  ok(r['count'] == '2 of 2' and 'Welcome back. Your email is saved right where you left it.' in r['text'] and 'Did it go through?' in r['text'], 'it comes back on the send screen with its question')
  pg.keyboard.press('Escape'); pg.wait_for_timeout(500)
  ok(not errs, f'no errors {errs[:2]}'); ctx.close()

  # ---------------- the Capitol account screen's way out is the email ----------------
  errs = []; ctx, pg = page(br, PHONE, f'{BASE}/track.html?demo=1&v2=1#/bill/HB2300', [RETURNING], errs)
  ready(pg)
  pg.click('.v2-go .btn.primary'); pg.wait_for_selector('#hp-dlg[open] .v2-paper', timeout=10000); pg.wait_for_timeout(300)
  pg.fill('#hp-name', 'Leilani Kahale'); pg.click('button[data-hp=next]'); pg.wait_for_timeout(350)
  pg.click('[data-hp=v2-email]'); pg.wait_for_timeout(700)
  r = pg.evaluate(SHEET)
  ok(r['title'] == 'Email about HB 2300' and r['count'] == '2 of 2' and r['h'] == 'Send your email' and r['filled'] == ['Open my email app'], f"Email the chair instead goes to the email's send screen ({r['title']!r}, {r['count']!r}, {r['filled']})")
  ok(pg.evaluate(MAILDRAFTS) == [{'screen': 'v2m', 'v2': 1, 'tried': False}], f"and keeps the email at that screen ({pg.evaluate(MAILDRAFTS)})")
  pg.click('[data-hp=back]'); pg.wait_for_timeout(400)
  t = pg.evaluate(SHEET)['text']
  ok(re.search(r'(Aloha|Dear) Senator', t) is not None and 'Leilani Kahale' in t, 'Back shows the email, written from the same answers')
  ok(pg.evaluate(DRAFTS) == [], 'the testimony draft went with the choice')
  ok(not errs, f'no errors {errs[:2]}'); ctx.close()

  # ---------------- where they stand: change shows three chips; the other side goes to the Capitol's own form ----------------
  errs = []; ctx, pg = page(br, PHONE, f'{BASE}/track.html?demo=1&v2=1#/bill/HB2300', [RETURNING, PROFILE], errs, 2)
  ready(pg)
  pg.click('.v2-go .btn.primary'); pg.wait_for_selector('#hp-dlg[open] .v2-paper', timeout=10000); pg.wait_for_timeout(300)
  pg.click('#v2-change'); pg.wait_for_timeout(250)
  chips = pg.evaluate("() => [...document.querySelectorAll('[data-hp=v2-stance]')].map(b => [b.textContent.trim(), b.getAttribute('aria-pressed')])")
  ok(chips == [['Support', 'true'], ['Oppose', 'false'], ['Not sure', 'false']], f'change: Support / Oppose / Not sure, HIPHI\'s side chosen {chips}')
  pg.click('[data-hp=v2-stance][data-v=comments]'); pg.wait_for_timeout(300)
  r = pg.evaluate(SHEET)
  ok('Your letter shares your thoughts' in r['text'] and len(pg.evaluate(POINTS)) == 0 and 'What you think, and why' in r['text'], 'Not sure: no HIPHI points, and the letter is theirs to say')
  pg.click('button[data-hp=next]'); pg.wait_for_timeout(300)
  ok(pg.evaluate(SHEET)['count'] == '1 of 2' and 'Say what you think in a sentence or two' in pg.evaluate(SHEET)['text'], 'and it asks for their words before it goes on')
  pg.click('#v2-change'); pg.click('[data-hp=v2-stance][data-v=support]'); pg.wait_for_timeout(300)
  ok([p['on'] for p in pg.evaluate(POINTS)] == [True, True, False], 'back to Support: HIPHI\'s points are as they were')
  pg.click('#v2-change'); pg.click('[data-hp=v2-stance][data-v=oppose]'); pg.wait_for_timeout(500)
  r = pg.evaluate(SHEET)
  ok(r['h'] == 'Say it in your own words' and 'Testify at the Capitol site' in r['foot'] and 'Write a letter here in my own words' in r['text'], f"Oppose: the Capitol's own form ({r['h']!r})")
  shot(pg, 'letter-own-form')
  ok(pg.evaluate("() => JSON.parse(localStorage.getItem('hiphi_stances_demo') || localStorage.getItem('hiphi_stances') || '{}')['" + H + "']") == 'oppose', 'their side is kept on the bill, as the older question kept it')
  pg.click('[data-hp=v2-write]'); pg.wait_for_timeout(400)
  r = pg.evaluate(SHEET)
  ok('Your letter opposes it' in r['text'] and 'Testimony in OPPOSITION to HB 2300' in r['text'] and len(pg.evaluate(POINTS)) == 0, 'they can still write it here, in their own words')
  ok(not errs, f'no errors {errs[:2]}'); ctx.close()

  # ---------------- a laptop: the same sheet as a card ----------------
  errs = []; ctx, pg = page(br, dict(viewport={'width': 1280, 'height': 800}), f'{BASE}/track.html?demo=1&v2=1#/bill/HB2300', [RETURNING, PROFILE], errs)
  ready(pg)
  pg.click('.v2-go .btn.primary'); pg.wait_for_selector('#hp-dlg[open] .v2-paper', timeout=10000); pg.wait_for_timeout(300)
  r = pg.evaluate(SHEET)
  ok(r['dlgW'] <= 700 and not r['wide'] and r['filled'] == ['Next: send it'], f"a laptop: a card, not wider than a letter ({r['dlgW']}px), one filled button")
  pg.keyboard.press('Tab'); pg.keyboard.press('Escape'); pg.wait_for_timeout(500)
  ok(pg.evaluate("() => !document.querySelector('#hp-dlg[open]')"), 'Esc closes it')
  ok(not errs, f'no errors {errs[:2]}'); ctx.close()

  # ---------------- today's page: the six parts, none of version 2 ----------------
  errs = []; ctx, pg = page(br, PHONE, f'{BASE}/track.html?demo=1#/bill/HB2300', [RETURNING], errs)
  pg.wait_for_selector('#main [data-bl-go=testify]', timeout=30000); pg.wait_for_timeout(600)
  pg.click('#main [data-bl-go=testify]'); pg.wait_for_selector('#hp-dlg[open]', timeout=10000); pg.wait_for_timeout(500)
  r = pg.evaluate(SHEET)
  ok(r['count'] == 'Part 1 of 6' and r['h'].startswith('Where do you stand on HB 2300?'), f"no v2: today's six parts ({r['count']!r}, {r['h']!r})")
  ok(pg.evaluate("() => !document.querySelector('#hp-dlg').classList.contains('hp-v2') && !document.querySelector('link[href=\"pub/v2/letter.css\"]')"), 'and version 2\'s stylesheet is not loaded')
  ok(not errs, f'no errors {errs[:2]}'); ctx.close()

  # ---------------- today's email path (no v2): "Send your email" with its three buttons, as it was ----------------
  errs = []; ctx, pg = page(br, PHONE, f'{BASE}/track.html?demo=1#/bill/HB2300', [RETURNING, PROFILE], errs)
  pg.wait_for_selector('#main [data-bl-go=testify]', timeout=30000); pg.wait_for_timeout(600)
  pg.evaluate("document.querySelector('[data-bl-compose]').click()"); pg.wait_for_selector('#hp-dlg[open]', timeout=10000); pg.wait_for_timeout(500)
  step = lambda rx: pg.evaluate("""rx => { const e = [...document.querySelectorAll('#hp-dlg button, #hp-dlg a')].filter(x => x.offsetParent !== null).find(x => new RegExp(rx, 'i').test((x.innerText || '').trim()));
    if (!e) return false; e.click(); return true; }""", rx)
  for rx in ('^I support it', '^Next', '^See my email', '^Next'): step(rx); pg.wait_for_timeout(600)
  r = pg.evaluate(SHEET)
  ok(r['count'] == 'Part 5 of 5' and r['h'] == 'Send your email' and 'Choose where you write email' in r['text'], f"no v2: the older email walkthrough ends on Send your email ({r['count']!r}, {r['h']!r})")
  ok(pg.evaluate("() => [...document.querySelectorAll('#hp-dlg .hp-send')].map(a => a.innerText.trim())") == ['Open in my mail app', 'Open in Gmail', 'Open in Outlook.com'] and all(w in r['text'] for w in ('Copy address', 'Copy subject', 'Copy message')) and 'I already sent it' in r['foot'],
     "with its three buttons, its three copy buttons and \"I already sent it\", unchanged")
  ok(pg.evaluate("() => !document.querySelector('#hp-dlg').classList.contains('hp-v2') && !document.querySelector('.v2-alt')"), 'and none of version 2')
  ok(not errs, f'no errors {errs[:2]}'); ctx.close()

  br.close()
print(f"\n{'ALL PASS' if not fails else str(fails) + ' FAILED'}")
sys.exit(1 if fails else 0)
