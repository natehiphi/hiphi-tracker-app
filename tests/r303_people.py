# Your lawmakers, a lawmaker's page, Committees and a committee's page in the calm redesign (R-303, behind ?rec=1), and the
# live fixes made on the way (people-committees.md, bugs 2-7).
#   python3 tests/r303_people.py [base]     base: a server for the folder (http://localhost:8832), or wt.local (the default),
#                                           which serves this worktree from disk with no server (Playwright routes).
# Checks at phone (390) and laptop (1440) as kai, leilani and none (no follows):
#   - the finder not known yet: "Who represents you?", one field "Your street address" with a working example, the
#     directory folded to one link that opens it in place; known: two quiet person rows, ONE card, one filled button, no lede;
#     the card's email opens with the bill (kai: HB 1780 with Sen. Kim), and the mail app's button is then the one filled one;
#   - a lawmaker (Sen. Kim, 189): the head, ONE card, On your issues, three closed cards; under 1,600px on a phone; ?from= a
#     bill makes the card about that bill; the phone said once (Rep. Hussey, 302); on a laptop the card is at the side;
#   - Committees: "Hearing HIPHI's bills this week" first, the two chambers closed; Education: every meeting day, ONE card
#     with "Help me write testimony" opening HB 1780's walkthrough, HIPHI's bills by what is due, Members closed;
#   - no page errors, no sideways scroll, one h1;
#   - without ?rec the old pages still draw, with the live fixes: every meeting day; the example; the phone once; the
#     other card keeps its width when an email opens; the hello's "our district" only to one's own lawmaker; Enter before
#     the street suggestions arrive waits for them, and a different house number is never taken quietly (these two use the
#     live address table, so they need the network).
import sys, os, json
from urllib.parse import urlparse, unquote
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://wt.local').rstrip('/')
ok = fail = 0
def check(cond, what):
    global ok, fail
    if cond: ok += 1; print('PASS', what)
    else: fail += 1; print('FAIL', what)

# The sample people (compare.html's WHO): their followed issues, a finished first visit, the practice Monday.
src = open(os.path.join(ROOT, 'compare.html')).read()
WHO = src[src.index('const WHO = {'):src.index('const pick =')]
def init(who, dist=''):
    d = f"localStorage.setItem('hiphi_districts_demo', JSON.stringify({{ senate: {dist.split(',')[0]}, house: {dist.split(',')[1]}, label: 'Kalihi', island: 'oahu' }}));" if dist else ''
    return f"""(() => {{ {WHO}
  if (sessionStorage.getItem('__set')) return; sessionStorage.setItem('__set', '1');
  for (const k of Object.keys(localStorage)) if (k.startsWith('hiphi_')) localStorage.removeItem(k);
  {d}
  localStorage.setItem('hiphi_tour_home_demo', '{{"how":"test"}}'); localStorage.setItem('hiphi_tour_bill_demo', '{{"how":"test"}}');
  if ('{who}' === 'none') return;
  const p = WHO['{who}'], at = Date.parse('2026-03-16T09:00:00-10:00');
  const set = (k, v) => localStorage.setItem(k + '_demo', typeof v === 'string' ? v : JSON.stringify(v));
  set('hiphi_issue_follows', p.issues); set('hiphi_watch_ids', []); set('hiphi_cat_follows', []); set('hiphi_skips', []);
  set('hiphi_wiz', {{ done: true, issues: p.cats, name: p.name }});
  set('hiphi_onb', {{ lastVisit: new Date(at - 14 * 36e5).toISOString() }});
  set('hiphi_done', Object.keys(p.done)); set('hiphi_done_at', p.done); set('hiphi_stances', {{}}); set('hiphi_demo_seeded', '0');
}})();"""

def serve(route):
    f = os.path.join(ROOT, unquote(urlparse(route.request.url).path).lstrip('/'))
    route.fulfill(path=f) if os.path.isfile(f) else route.fulfill(status=404, body='not found')

def page(br, w, h, who='kai', dist=''):
    ctx = br.new_context(viewport={'width': w, 'height': h})
    ctx.add_init_script(init(who, dist))
    if BASE == 'http://wt.local': ctx.route('http://wt.local/**', serve)
    pg = ctx.new_page(); pg.errs = []
    pg.on('pageerror', lambda e: pg.errs.append(str(e)))
    return ctx, pg

def go(pg, hash, rec=True, sel='#main h1'):
    pg.goto(f'{BASE}/track.html?demo=1{"&rec=1" if rec else ""}{hash}')
    pg.wait_for_selector(sel, timeout=40000); pg.wait_for_timeout(700)

SHAPE = """() => ({ h: document.documentElement.scrollHeight, wide: document.documentElement.scrollWidth > innerWidth + 1,
  h1: document.querySelectorAll('#main h1').length,
  filled: [...document.querySelectorAll('#main .btn.primary')].filter(b => b.offsetParent && getComputedStyle(b).visibility !== 'hidden').length })"""
ORDER = """sels => { const els = sels.map(s => document.querySelector(s)); if (els.some(e => !e)) return 'missing: ' + sels.filter((s, i) => !els[i]).join(', ');
  for (let i = 1; i < els.length; i++) if (els[i - 1].compareDocumentPosition(els[i]) & Node.DOCUMENT_POSITION_PRECEDING) return 'out of order at ' + sels[i];
  return 'ok'; }"""

with sync_playwright() as p:
    br = p.chromium.launch()
    for w, h, size in [(390, 844, 'phone'), (1440, 900, 'laptop')]:
        for who in ['kai', 'leilani', 'none']:
            tag = f'{size} {who}'
            # ---- your lawmakers, not known yet ----
            ctx, pg = page(br, w, h, who)
            go(pg, '#/legislators')
            s = pg.evaluate(SHAPE)
            check(pg.inner_text('#main h1') == 'Who represents you?' and pg.inner_text('label[for=pp-q]') == 'Your street address', f'{tag}: not known yet, "Who represents you?" and one field')
            check('415 S Beretania St' in (pg.get_attribute('#pp-q', 'placeholder') or ''), f'{tag}: the field\'s example is an address that resolves')
            check(pg.locator('.pp-isle').count() == 0 and pg.locator('[data-pp-dir]').count() == 1, f'{tag}: the island directory folds to one link')
            pg.click('[data-pp-dir]'); pg.wait_for_timeout(300)
            check(pg.locator('.pp-isle').count() == 4 and pg.locator('#pp-dir a[href="#/committees"]').count() == 1, f'{tag}: the link opens the islands and Committees in place')
            check(s['h1'] == 1 and not s['wide'] and not pg.errs, f'{tag}: finder: one h1, no sideways scroll, no errors {pg.errs[:1]}')
            ctx.close()
            # ---- your lawmakers, known (Sen. Kim, Rep. Hussey) ----
            ctx, pg = page(br, w, h, who, '14,29')
            go(pg, '#/legislators')
            s = pg.evaluate(SHAPE)
            rows = pg.locator('.pp-rppl .rc-row').all_inner_texts()
            check(len(rows) == 2 and 'Your senator' in rows[0] and 'Your representative' in rows[1], f'{tag}: known, two quiet person rows ({[r.split(chr(10))[0] for r in rows]})')
            check(pg.locator('.rc-act').count() == 1 and s['filled'] == 1 and pg.locator('.rc-lede').count() == 0, f'{tag}: known, ONE card, one filled button ({s["filled"]}), the lede not repeated')
            title = pg.inner_text('.rc-act .rc-ah')
            if who == 'kai': check(title == 'Ask Sen. Kim to support Free school bus passes' and 'HB 1780' in pg.inner_text('.rc-act .rc-atext'), f'{tag}: the card asks Sen. Kim about the followed bill her committee hears, by its name ({title})')
            if who == 'none': check(title == 'Say aloha to your lawmakers', f'{tag}: following nothing, the card is the hello ({title})')
            check(pg.locator('[data-pp-change]').count() == 1 and pg.locator('[data-pp-forget]').count() == 1 and 'saved on this device' in pg.inner_text('.pp-rfoot'),
                  f'{tag}: "Change address" and "Saved on this device · Forget" as text')
            if size == 'phone': check(s['h'] < 1100, f'{tag}: known finder height {s["h"]}px')
            else: check(pg.locator('.rc-side .rc-act').count() == 1, f'{tag}: known finder: on a laptop the card is at the side')
            pg.click('.rc-act [data-pp-mail]'); pg.wait_for_timeout(500)
            letter = pg.input_value('.rc-act textarea[data-pp-msg]') if pg.locator('.rc-act textarea[data-pp-msg]').count() else ''
            s2 = pg.evaluate(SHAPE)
            if who == 'kai': check('HB 1780' in letter and 'Senator Kim' in letter, f'{tag}: the email is about HB 1780, to Sen. Kim')
            else: check(len(letter) > 80 and 'Kim' in letter, f'{tag}: the email opens in the card, to Sen. Kim')
            check(s2['filled'] == 1 and pg.locator('.rc-act [data-pp-mailto].btn.primary').count() == 1, f'{tag}: with the email open the mail app\'s button is the one filled ({s2["filled"]})')
            pg.click('[data-pp-forget]'); pg.wait_for_timeout(300)
            check(pg.evaluate("localStorage.getItem('hiphi_districts_demo')") is None and pg.locator('[data-pp-save]').count() == 1, f'{tag}: Forget removes the districts and offers Save')
            check(not s['wide'] and s['h1'] == 1 and not pg.errs, f'{tag}: known finder: one h1, no sideways scroll, no errors {pg.errs[:1]}')
            ctx.close()
            # ---- a lawmaker: Sen. Kim ----
            ctx, pg = page(br, w, h, who)
            go(pg, '#/legislator/189')
            s = pg.evaluate(SHAPE)
            order = pg.evaluate(ORDER, ['.pp-rhead', '.rc-act', '.rc-folds'])
            check(order == 'ok', f'{tag}: Sen. Kim: the head, the card, then the closed cards ({order})')
            folds = pg.evaluate("[...document.querySelectorAll('.rc-fold')].map(d => d.dataset.rcFold + (d.open ? '+' : '')).join()")
            check(folds == 'pp-cmtes,pp-allbills,pp-office', f'{tag}: three closed cards: their committees, all HIPHI bills, office and contact ({folds})')
            check(s['filled'] == 1 and pg.locator('.rc-act').count() == 1, f'{tag}: Sen. Kim: ONE card, one filled button ({s["filled"]})')
            if who == 'kai':
                check(pg.inner_text('.rc-act .rc-ah') == 'Ask Sen. Kim to support Free school bus passes' and pg.inner_text('.rc-act .rc-awhen').startswith('Hearing'), f'{tag}: the most pressing followed bill in her committees leads, with her committee\'s hearing')
                check('Due tomorrow' in pg.inner_text('.rc-act .rc-aways'), f'{tag}: the testimony deadline is said on the testimony row, not over the email')
                check(pg.locator('#pp-yi').count() == 1 and 'HB 2300' in pg.inner_text('.rc-sec'), f'{tag}: On your issues lists the other followed bill in her committees')
            if who == 'none': check(pg.inner_text('.rc-act .rc-ah') == 'Write to Sen. Kim' and pg.locator('#pp-yi').count() == 0, f'{tag}: no follows, the hello and no On your issues')
            if size == 'phone': check(s['h'] < 1600, f'{tag}: Sen. Kim is {s["h"]}px on a phone (budget 1,600; 4,698 before)')
            else: check(pg.locator('.rc-side .rc-act').count() == 1, f'{tag}: on a laptop the card is at the side')
            pg.click('.rc-fold[data-rc-fold=pp-allbills] > summary'); pg.wait_for_timeout(200)
            first = pg.locator('.rc-fold[data-rc-fold=pp-allbills] .rc-rstat').first.inner_text()
            check('HIPHI' in first, f'{tag}: every HIPHI bill in her committees, with the stance ({first})')
            check(not s['wide'] and s['h1'] == 1 and not pg.errs, f'{tag}: Sen. Kim: one h1, no sideways scroll, no errors {pg.errs[:1]}')
            go(pg, '#/legislator/189?from=HB2121')
            t = pg.inner_text('.rc-act .rc-ah')
            check('Disposable e-cigarette ban' in t and 'HB 2121' in pg.inner_text('.rc-act .rc-atext') and pg.locator('.rc-top a[href="#/bill/HB2121"]').count() == 1, f'{tag}: ?from= a bill: the card is about it and the back row goes to it ({t})')
            ctx.close()
            # ---- committees ----
            ctx, pg = page(br, w, h, who)
            go(pg, '#/committees')
            s = pg.evaluate(SHAPE)
            check(pg.evaluate(ORDER, ['#cmt-wk', '.rc-fold[data-rc-fold=cmt-S]', '.rc-fold[data-rc-fold=cmt-H]']) == 'ok', f'{tag}: Committees: this week\'s hearings first, then the two chambers closed')
            wk = pg.locator('section[aria-labelledby=cmt-wk] .rc-rstat').all_inner_texts()
            check(len(wk) >= 3 and all('(' in t and ')' in t for t in wk), f'{tag}: each of this week\'s hearings names its bill ({wk[:1]})')
            check(pg.locator('.rc-top a[href="#/legislators"]').count() == 1, f'{tag}: Committees goes back to Your lawmakers')
            check(not s['wide'] and s['h1'] == 1 and not pg.errs, f'{tag}: Committees: one h1, no sideways scroll, no errors {pg.errs[:1]}')
            go(pg, '#/committee/EDU')
            s = pg.evaluate(SHAPE)
            check('Mon, Wed and Fri' in pg.inner_text('.rc-lede'), f'{tag}: Education says every meeting day ({pg.inner_text(".rc-lede")})')
            href = pg.get_attribute('.rc-act .btn.primary', 'href') or ''
            check(pg.inner_text('.rc-act .rc-ah') == 'Speak up for Free school bus passes', f'{tag}: Education\'s card names the bill ({pg.inner_text(".rc-act .rc-ah")})')
            if size == 'laptop': check(pg.locator('.rc-side .rc-act').count() == 1, f'{tag}: Education: on a laptop the card is at the side')
            check(s['filled'] == 1 and 'HB1780' in href and href.endswith('/testify') and 'Help me write testimony' in pg.inner_text('.rc-act .btn.primary'),
                  f'{tag}: Education: ONE card, "Help me write testimony" opens HB 1780\'s walkthrough ({href})')
            check(pg.evaluate(ORDER, ['.rc-act', '#cmt-bills', '.rc-fold[data-rc-fold=cmt-members]']) == 'ok', f'{tag}: Education: the card, HIPHI\'s bills here, then Members closed')
            check(not s['wide'] and s['h1'] == 1 and not pg.errs, f'{tag}: Education: one h1, no sideways scroll, no errors {pg.errs[:1]}')
            ctx.close()

    # ---- without ?rec: the old pages, with the live fixes ----
    ctx, pg = page(br, 390, 844, 'kai')
    go(pg, '#/legislators', rec=False)
    check(pg.locator('.pp-isle').count() == 4 and pg.inner_text('#main h1') == 'Your legislators' and pg.locator('.rc').count() == 0, 'without ?rec the finder is today\'s (the islands)')
    check('415 S Beretania St' in (pg.get_attribute('#pp-q', 'placeholder') or ''), 'live: the finder\'s example resolves (it was "Kailua", which is split)')
    go(pg, '#/legislator/189', rec=False)
    check(pg.locator('.pp-person .pp-billrow').count() > 5, 'without ?rec a lawmaker\'s page is today\'s')
    go(pg, '#/legislator/302', rec=False)
    n = pg.evaluate("document.querySelector('.pp-person').textContent.split('808-586-6050').length - 1")
    check(n == 1, f'live: the phone is said once on a lawmaker\'s page ({n})')
    go(pg, '#/committees', rec=False)
    check(pg.locator('.cmt .sechead').count() >= 2 and pg.locator('.cmt-rec').count() == 0, 'without ?rec Committees is today\'s')
    go(pg, '#/committee/EDU', rec=False)
    check('Meets Mon, Wed and Fri' in pg.inner_text('.cmt .lede'), f'live: a committee says every meeting day ({pg.inner_text(".cmt .lede")})')
    # the hello to someone else's lawmaker does not say "our district"
    go(pg, '#/legislator/189', rec=False)
    pg.locator('[data-pp-mail]').first.click(); pg.wait_for_timeout(500)
    L = pg.input_value('textarea[data-pp-msg]')
    check('our district' not in L and 'our community' not in L and any(x in L for x in ['Mahalo for your work.', 'Mahalo for all you do.', 'Thank you for your public service.']),
          'live: a hello to a lawmaker who is not theirs claims no district')
    ctx.close()
    ctx, pg = page(br, 390, 844, 'kai', '14,29')
    go(pg, '#/legislator/189', rec=False)
    pg.locator('[data-pp-mail]').first.click(); pg.wait_for_timeout(500)
    L = pg.input_value('textarea[data-pp-msg]')
    check(any(x in L for x in ['for our district.', 'for our community.']), 'live: a hello to their own senator thanks them for their work for the district')
    go(pg, '#/legislators', rec=False)
    w0 = pg.evaluate("[...document.querySelectorAll('.pp-slots > .card')].map(c => Math.round(c.getBoundingClientRect().width))")
    pg.locator('.pp-slots [data-pp-mail]').first.click(); pg.wait_for_timeout(500)
    w1 = pg.evaluate("[...document.querySelectorAll('.pp-slots > .card')].map(c => Math.round(c.getBoundingClientRect().width))")
    check(len(w0) == 2 and w0 == w1, f'live: opening one email leaves the other card its width on a phone ({w0} -> {w1})')
    ctx.close()
    # Enter before the street suggestions arrive (the live address table: needs the network)
    ctx, pg = page(br, 390, 844, 'none')
    go(pg, '#/legislators', rec=False)
    pg.fill('#pp-q', '45 Kainalu Dr, Kailua'); pg.press('#pp-q', 'Enter'); pg.wait_for_timeout(3500)
    note = pg.locator('.pp-sugnote').all_inner_texts()
    check(pg.locator('#pp-for').count() == 0 and any('exact address' in t for t in note), f'live: Enter on a house number the table lacks picks no other house and says so ({note[:1]})')
    subs = pg.locator('[data-pp-sug] .pp-sugsub').all_inner_texts()
    check(any('closest match' in t for t in subs), f'live: the nearby houses say "closest match" ({subs[:2]})')
    go(pg, '#/legislators', rec=False)
    pg.fill('#pp-q', '415 S Beretania St'); pg.press('#pp-q', 'Enter'); pg.wait_for_timeout(4000)
    check(pg.locator('#pp-for').count() == 1 and pg.locator('.pp-slots .pp-card').count() == 2, 'live: Enter before the suggestions waits for them and finds the two lawmakers')
    check(not pg.errs, f'live: no page errors {pg.errs[:1]}')
    ctx.close()
    br.close()
print(f'\n{ok} passed, {fail} failed'); sys.exit(1 if fail else 0)
