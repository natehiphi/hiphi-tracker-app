# Staff v5: partner asks in the 4:30 pm email (R-328 batch G, backend migration 185). On the practice copy (Mon 16 Mar 2026,
# 9:00 am HST) as Nate, a partner approver:
#   - Today's approval card shows the ask on its own, with one switch "Also by text" (off), its helper line, and for an
#     ask longer than a text (110 characters) a "Line for the text" with a counter; Approve refuses a missing, short or long
#     line in the database's words and approves nothing; an ask that fits a text needs no line.
#   - Approve with an ask says which 4:30 pm email it joins (today's; tomorrow's after 4:30 pm; held while email is paused)
#     and its 10-second Undo still works; after the 10 seconds the ask is on the Partners screen, "Going out at 4:30 pm".
#   - Partners: Take it back (and its Undo), Send again on a taken-back ask (and its Undo), the fold of taken-back and
#     ended asks; a teammate who does not approve partners sees the list without buttons.
#   - At 1366x900 and 390x844: no sideways scroll, one h1, no console errors. Screenshots in tests/out/staff5-partner-asks/.
# Exits 1 when a check misses.
#   HOST=http://localhost:8872 python3 tests/staff5_partner_asks.py     against a served worktree (CI serves the repo on 8832)
#   V4_ROOT=/path/to/worktree python3 tests/staff5_partner_asks.py      serves that folder straight into the browser
import os, re, sys
from playwright.sync_api import sync_playwright
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from staff5_people import router, HOST   # one way to serve the practice copy for every staff5 test (and &asof= moves the clock)

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out', 'staff5-partner-asks')
os.makedirs(OUT, exist_ok=True)
LONG_LINE = 'Ask the Senate Health committee to pass SB 2073 for fluoride in tap water.'   # 74 characters
results = []
def check(name, ok, detail=''):
  results.append((name, bool(ok), detail)); print(('ok   ' if ok else 'FAIL ') + name + (f'  ({detail})' if detail else ''))

FRAME = """(() => ({ wide: document.documentElement.scrollWidth > innerWidth + 1,
  h1: [...document.querySelectorAll('h1, [role=heading][aria-level="1"]')].filter(e => e.getClientRects().length && !e.closest('[aria-hidden="true"]')).length }))()"""
# (a phone hides the page's own h1 and makes the header's title the heading: app.js render)
EMAIL_ON = "(async () => { const m = await import('/staff5/data.js'); m.S.emailCfg = { ...(m.S.emailCfg || {}), enabled: true }; m.hooks.render(); })()"

def main():
  with sync_playwright() as p:
    b = p.chromium.launch()
    def page(who, W=1366, H=900, mobile=False):
      ctx = b.new_context(viewport={'width': W, 'height': H}, is_mobile=mobile, has_touch=mobile)
      ctx.route(HOST + '/**', router); pg = ctx.new_page(); pg.errs = []
      pg.on('pageerror', lambda e: pg.errs.append(str(e)))
      pg.on('console', lambda m: m.type == 'error' and pg.errs.append(m.text))
      pg.who = who; pg.ctx = ctx; return pg
    def go(pg, route='/', asof='', wait=3000):
      pg.goto(f"{HOST}/staff5.html?demo=1&as={pg.who}{'&asof=' + asof if asof else ''}#{route}"); pg.wait_for_timeout(wait)
    def hop(pg, route, wait=1500):   # within the visit (the practice changes stay in memory)
      pg.evaluate(f"location.hash = '#{route}'"); pg.wait_for_timeout(wait)
    toast = lambda pg: ' '.join(pg.locator('.toastmsg').all_inner_texts())
    def frame(pg, tag):
      f = pg.evaluate(FRAME)
      check(f'{tag}: no sideways scroll', not f['wide'])
      check(f'{tag}: one h1', f['h1'] == 1, f['h1'])
    def open_row(pg, num):
      rows = pg.locator('.pq-row [data-sel]')
      for i in range(rows.count()):
        if num in rows.nth(i).inner_text(): rows.nth(i).click(); pg.wait_for_timeout(500); return True
      return False

    # ---- laptop, Nate: the approval card ----
    pg = page('NT'); go(pg)
    check('Today (laptop): the fluoride words say "with an ask" on their row', any('with an ask' in t for t in pg.locator('.pq-row').all_inner_texts() if 'SB2073' in t))
    check('Today (laptop): the fluoride words open beside the list', open_row(pg, 'SB2073') and pg.locator('#td-pane .pq-ask').count() == 1)
    pane = pg.locator('#td-pane')
    ask = pane.locator('.pq-ask').inner_text()
    check('Card: the ask shows on its own, with its end date', 'The ask' in ask and 'until ' in ask and 'fluoride in their tap water' in ask, ask[:90].replace('\n', ' '))
    check('Card: the ask is said once (not again in the words)', pane.inner_text().count('fluoride in their tap water') == 1)
    check('Card: email paused says the ask is held', 'Email is paused' in ask, ask)
    sw = pane.locator('[data-pqtext]')
    check('Card: one switch "Also by text", off', sw.count() == 1 and not sw.is_checked() and 'Also by text' in pane.locator('.pq-ask .sv-switchrow').inner_text())
    check('Card: the helper line', 'Texted only to people who chose “As they come”, on a day HIPHI isn’t texting them. Texts are off until they’re set up.' in ask, ask)
    check('Card: no line for the text while the switch is off', not pane.locator('.pq-tline').is_visible())
    pg.evaluate(EMAIL_ON); pg.wait_for_timeout(400)
    ask = pane.locator('.pq-ask').inner_text()
    check('Card: email on says today’s 4:30 pm email', 'Once you approve, it goes out in today’s 4:30 pm email' in ask, ask[ask.find('Once'):][:90] if 'Once' in ask else ask)
    pane.locator('.pq-ask .sv-switchrow').click(); pg.wait_for_timeout(200)
    check('Also by text on: the switch is on', sw.is_checked())
    check('Also by text on, ask of 128 characters: "Line for the text" shows', pane.locator('.pq-tline').is_visible() and 'Line for the text' in pane.locator('.pq-tline').inner_text())
    cnt = lambda: pane.locator('.pq-count').inner_text()
    check('Line: the counter starts at 0 of 110', cnt() == '0 of 110', cnt())
    rows0 = pg.locator('.pq-row').count()
    pane.locator('[data-pqok]').click(); pg.wait_for_timeout(300)
    err = pane.locator('[data-pqterr]').inner_text()
    check('Approve with no line: refused in the database’s words', 'A text has room for 110 characters: write a shorter line for the text' in err, err)
    check('Approve with no line: nothing approved', pg.locator('.pq-row').count() == rows0 and 'Approved' not in toast(pg))
    check('Approve with no line: the focus goes to the line', pg.evaluate("document.activeElement?.matches('[data-pqline]')"))
    pane.locator('[data-pqline]').fill('Too short')
    check('Line: a short line says "at least 10"', cnt() == '9 of 110: at least 10', cnt())
    check('Line: typing clears the refusal', pane.locator('[data-pqterr]').inner_text().strip() == '')
    pane.locator('[data-pqok]').click(); pg.wait_for_timeout(300)
    check('Approve with 9 characters: "The line for the text is 10 to 110 characters"', 'The line for the text is 10 to 110 characters' in pane.locator('[data-pqterr]').inner_text())
    pane.locator('[data-pqline]').fill('x' * 130)
    check('Line: a long line says how many too many', cnt() == '130 of 110: 20 too many', cnt())
    pane.locator('[data-pqok]').click(); pg.wait_for_timeout(300)
    check('Approve with 130 characters: refused, nothing approved', 'The line for the text is 10 to 110 characters' in pane.locator('[data-pqterr]').inner_text() and pg.locator('.pq-row').count() == rows0)
    pane.locator('[data-pqline]').fill(LONG_LINE)
    check('Line: a good line counts plainly', cnt() == f'{len(LONG_LINE)} of 110', cnt())
    pane.screenshot(path=os.path.join(OUT, 'card-laptop.png'))
    pane.locator('[data-pqok]').click(); pg.wait_for_timeout(500)
    t = toast(pg)
    check('Approve: the toast says the words go live and the ask joins today’s 4:30 pm email', 'Approved:' in t and 'The ask goes out in today’s 4:30 pm email.' in t, t)
    check('Approve: the words leave the list for their 10 seconds', pg.locator('.pq-row').count() == rows0 - 1)
    pg.locator('.toastmsg .toastundo', has_text='Undo').click(); pg.wait_for_timeout(500)
    check('Undo: the words wait again', pg.locator('.pq-row').count() == rows0 and 'Undone' in toast(pg), toast(pg))
    open_row(pg, 'SB2073')
    check('Undo: Also by text and the line are as they were left', pane.locator('[data-pqtext]').is_checked() and pane.locator('[data-pqline]').input_value() == LONG_LINE)
    pane.locator('[data-pqok]').click(); pg.wait_for_timeout(10800)
    check('After the 10 seconds: the words are approved (off the list)', pg.locator('.pq-row').count() == rows0 - 1 and not any('SB2073' in x for x in pg.locator('.pq-row').all_inner_texts()))
    # The edit on SB 2345: an ask that fits a text needs no line of its own.
    check('The edit on SB 2345 opens', open_row(pg, 'SB2345'))
    ptxt = pane.inner_text()
    check('An edit: the ask is said once, with what it was', ptxt.count('vote yes on SB 2345') == 1 and 'New in this edit: their live words have no ask.' in ptxt)
    pane.locator('.pq-ask .sv-switchrow').click(); pg.wait_for_timeout(200)
    check('An ask that fits a text: Also by text on, no line asked for', pane.locator('[data-pqtext]').is_checked() and pane.locator('.pq-tline').count() == 0)
    pane.screenshot(path=os.path.join(OUT, 'card-edit-laptop.png'))
    check('Today (laptop): no console errors', not pg.errs, pg.errs[:2])
    frame(pg, 'Today (laptop)')
    pg.screenshot(path=os.path.join(OUT, 'today-laptop.png'))

    # ---- laptop, Nate: the Partners screen ----
    hop(pg, '/partners')
    head = pg.locator('#pg-h-ask').inner_text() if pg.locator('#pg-h-ask').count() else ''
    check('Partners: "Going out at 4:30 pm" with email on', head.startswith('Going out at 4:30 pm'), head)
    going = pg.locator('.pg-sec').first.locator('ul.pg-asks').first
    gtxt = going.inner_text()
    check('Partners: the approved ask is going out, by email and text, today at 4:30 pm', 'fluoride in their tap water' in gtxt and 'Email, and text once texts are on' in gtxt and 'Goes out today at 4:30 pm' in gtxt, gtxt[:160].replace('\n', ' '))
    check('Partners: the sample ask Jess approved is going out too', 'vote yes on HB 2146' in gtxt)
    n_on = going.locator('li').count()
    check('Partners: each going-out ask has Take it back', going.locator('[data-pgtake]').count() == n_on and n_on == 2, n_on)
    fold = pg.locator('.pg-fold')
    check('Partners: taken-back asks wait in a closed fold', fold.count() == 1 and not fold.evaluate('d => d.open') and 'Asks taken back or ended' in fold.locator('summary').inner_text())
    frame(pg, 'Partners (laptop)')
    pg.screenshot(path=os.path.join(OUT, 'partners-laptop.png'))
    row = going.locator('li', has_text='fluoride')
    row.locator('[data-pgtake]').click(); pg.wait_for_timeout(600)
    t = toast(pg)
    check('Take it back: the toast says it will not go out, with Undo', 'Taken back:' in t and 'will not go out' in t and pg.locator('.toastmsg .toastundo', has_text='Undo').count() == 1, t)
    check('Take it back: one ask going out, two in the fold', pg.locator('.pg-sec').first.locator('ul.pg-asks').first.locator('[data-pgtake]').count() == 1 and fold.locator('summary .n').inner_text() == '2')
    pg.locator('.toastmsg .toastundo', has_text='Undo').click(); pg.wait_for_timeout(600)
    t = toast(pg)
    check('Undo Take it back: going out again at today’s 4:30 pm', 'Undone. It goes out in today’s 4:30 pm email.' in t and pg.locator('[data-pgtake]').count() == 2, t)
    fold.locator('summary').click(); pg.wait_for_timeout(200)
    resend = pg.locator('.pg-fold [data-pgresend]')
    check('The fold: Send again on the ask taken back yesterday', resend.count() == 1 and 'Taken back yesterday' in pg.locator('.pg-fold').inner_text())
    resend.click(); pg.wait_for_timeout(600)
    t = toast(pg)
    check('Send again: it goes out in today’s 4:30 pm email, with Undo', 'goes out in today’s 4:30 pm email' in t and pg.locator('[data-pgtake]').count() == 3 and pg.locator('.pg-fold').count() == 0, t)
    pg.locator('.toastmsg .toastundo', has_text='Undo').click(); pg.wait_for_timeout(600)
    check('Undo Send again: taken back again', 'stays taken back' in toast(pg) and pg.locator('[data-pgtake]').count() == 2 and pg.locator('.pg-fold [data-pgresend]').count() == 1, toast(pg))
    check('Partners (laptop): no console errors', not pg.errs, pg.errs[:2])
    pg.ctx.close()

    # ---- email paused (as on production): held, as HIPHI's own ----
    pg = page('NT'); go(pg, '/partners')
    head = pg.locator('#pg-h-ask').inner_text() if pg.locator('#pg-h-ask').count() else ''
    check('Partners, email paused: "Held while email is paused", as on Emails', head.startswith('Held while email is paused'), head)
    check('Partners, email paused: the line says who approved it, not a time', 'Approved by Jess' in pg.locator('ul.pg-asks').first.inner_text())
    pg.screenshot(path=os.path.join(OUT, 'partners-paused-laptop.png'))
    pg.ctx.close()

    # ---- after 4:30 pm: tomorrow's email ----
    pg = page('NT'); go(pg, '/', asof='2026-03-16T17:00:00-10:00'); pg.evaluate(EMAIL_ON); pg.wait_for_timeout(400)
    open_row(pg, 'SB2345')
    ask = pg.locator('#td-pane .pq-ask').inner_text() if pg.locator('#td-pane .pq-ask').count() else ''
    check('After 4:30 pm: the card says tomorrow’s 4:30 pm email', 'tomorrow’s 4:30 pm email' in ask, ask[-140:].replace('\n', ' '))
    pg.locator('#td-pane [data-pqok]').click(); pg.wait_for_timeout(400)
    check('After 4:30 pm: the toast says tomorrow’s 4:30 pm email', 'The ask goes out in tomorrow’s 4:30 pm email.' in toast(pg), toast(pg))
    pg.wait_for_timeout(10800); hop(pg, '/partners')
    check('After 4:30 pm: Partners says it goes out tomorrow', 'Goes out tomorrow at 4:30 pm' in pg.locator('li.pg-ask', has_text='SB 2345').inner_text())
    check('After 4:30 pm: no console errors', not pg.errs, pg.errs[:2])
    pg.ctx.close()

    # ---- a teammate who does not approve partners: the list, read only ----
    pg = page('LR'); go(pg, '/partners')
    check('Lauren: the asks show on Partners', pg.locator('li.pg-ask').count() >= 1)
    check('Lauren: no Take it back or Send again', pg.locator('[data-pgtake], [data-pgresend]').count() == 0)
    go(pg, '/')
    check('Lauren: no partner words to approve on Today', pg.locator('.pq-row, .pq-card').count() == 0)
    check('Lauren: no console errors', not pg.errs, pg.errs[:2])
    pg.ctx.close()

    # ---- phone, Nate ----
    pg = page('NT', 390, 844, mobile=True); go(pg)
    card = pg.locator('[data-pqcard]', has_text='SB2073')
    check('Phone: the fluoride card shows the ask and the switch', card.count() == 1 and card.locator('.pq-ask [data-pqtext]').count() == 1)
    card.locator('.pq-ask .sv-switchrow').click(); pg.wait_for_timeout(200)
    check('Phone: Also by text on shows the line for the text', card.locator('.pq-tline').is_visible())
    card.locator('[data-pqline]').fill('Fluoride for every island: ask the Senate to pass SB 2073.')
    sz = card.locator('.pq-ask .sv-switchrow').bounding_box()
    check('Phone: the switch row is a full touch target', sz and sz['height'] >= 44, sz and sz['height'])
    card.scroll_into_view_if_needed(); card.screenshot(path=os.path.join(OUT, 'card-phone.png'))
    frame(pg, 'Today (phone)')
    card.locator('[data-pqok]').click(); pg.wait_for_timeout(400)
    check('Phone: Approve says the ask is held while email is paused', 'The ask goes out in the first 4:30 pm email after email is turned on.' in toast(pg), toast(pg))
    pg.locator('.toastmsg .toastundo', has_text='Undo').click(); pg.wait_for_timeout(400)
    check('Phone: Undo puts the card back', pg.locator('[data-pqcard]', has_text='SB2073').count() == 1)
    hop(pg, '/partners')
    frame(pg, 'Partners (phone)')
    tb = pg.locator('[data-pgtake]').first.bounding_box()
    check('Phone: Take it back is a full touch target', tb and tb['height'] >= 44, tb and tb['height'])
    pg.screenshot(path=os.path.join(OUT, 'partners-phone.png'), full_page=True)
    check('Phone: no console errors', not pg.errs, pg.errs[:2])
    pg.ctx.close()
    b.close()
  bad = [r for r in results if not r[1]]
  print(f'{len(results) - len(bad)} of {len(results)} checks passed')
  sys.exit(1 if bad else 0)

if __name__ == '__main__':
  main()
