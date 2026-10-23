# Staff v5: a legislator's profile (R-335, Nate 22 Oct 2026), on the practice copy (staff5/profile.js PROFILES). Rep. Gregg
# Takayama's page (#/legislator/130) as Nate (the sandbox's one admin) and as Kris and Lauren (not admins): the profile and
# its practice notice, "…" only on your own lines (an admin on all), add / edit ("edited", Earlier wording) / remove with
# Undo, the tip, an issue under What they care about found by the Legislators list's Cares about and on the issue's page,
# search's Profiles group, Add a note in the log, your own conversation corrected after ten minutes, and all of it kept
# across a person switch. Phone 390x844 and laptop 1440x900. Exits 1 when a check misses.
#   python3 tests/legislator_profile.py [http://localhost:8871] [screenshot folder]
# The base is the first argument, else the HOST environment variable, else http://localhost:8832 (CI serves the repo there).
import os, re, sys
from playwright.sync_api import sync_playwright

BASE = (sys.argv[1] if len(sys.argv) > 1 else os.environ.get('HOST', 'http://localhost:8832')).rstrip('/')
SHOTS = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out', 'legislator_profile')
os.makedirs(SHOTS, exist_ok=True)
LEG = 130                      # Rep. Gregg Takayama, HLT chair
ISSUE = 'Disposable e-cigarette ban'
SECTIONS = ['What they care about', 'How to work with them', 'Their office', 'Who on our team knows them', 'History with HIPHI', 'Watch out for']

results = []
def check(name, ok, detail=''):
  results.append((name, bool(ok), detail)); print(('ok   ' if ok else 'FAIL ') + name + (f'  ({detail})' if detail else ''))

def url(who=None, route=f'/legislator/{LEG}'):
  return f"{BASE}/staff5.html?demo=1{'&as=' + who if who else ''}#{route}"

def lines(pg):   # every profile line (the tip first): its words and whether it has a "…"
  return pg.evaluate("""[...document.querySelectorAll('.pf [data-pfline]')].map(e => ({ id: e.dataset.pfline, text: e.querySelector('.pf-text, .pf-tiptext').innerText.replace(/^Tip:\s*/, ''),
    sec: e.closest('[data-pfsec]')?.dataset.pfsec || 'tip', more: !!e.querySelector('[data-pfmore]') }))""")

def shot(pg, name, full=False):   # a screenshot without a toast left over from the step before
  pg.evaluate("document.querySelectorAll('.toastmsg').forEach(t => t.remove())"); pg.wait_for_timeout(100)
  pg.screenshot(path=os.path.join(SHOTS, name), full_page=full)

def item(pg, name):   # a menu item by its own title (an item's second line may hold other words)
  return pg.locator('dialog[open] .sv-menu button').filter(has=pg.locator('.title', has_text=re.compile(f'^{re.escape(name)}$')))

def menu(pg, line_id, name):
  pg.locator(f'.pf [data-pfmore="{line_id}"]').click(); pg.wait_for_timeout(350)
  item(pg, name).click(); pg.wait_for_timeout(700)

def main():
  with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': 1440, 'height': 900}); pg = ctx.new_page()
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))

    # ---- 1. The profile, as Nate (admin), laptop ----
    pg.goto(url()); pg.wait_for_selector('.pf'); pg.wait_for_timeout(800)
    heads = pg.evaluate("[...document.querySelectorAll('.pf h3')].map(h => h.innerText.trim())")
    check('Profile: the six sections, in Nate\'s order', heads == SECTIONS, heads)
    note = pg.inner_text('.pf .pf-note') if pg.locator('.pf .pf-note').count() else ''
    check('Profile: the practice notice says Placeholder lines are sample text', 'Practice copy' in note and 'Placeholder' in note and 'not facts' in note, note[:90])
    L = lines(pg)
    seeded = [x for x in L]
    check('Profile: a tip first, then one line per section', len(L) == 7 and L[0]['sec'] == 'tip' and sorted({x['sec'] for x in L[1:]}) == sorted(['cares', 'how', 'office', 'knows', 'history', 'watch']), [x['sec'] for x in L])
    check('Profile: every seeded line starts with "Placeholder"', all(re.match(r'^(Placeholder|\w+ knows them · Placeholder)', x['text']) for x in seeded), [x['text'][:30] for x in seeded if not re.match(r'^(Placeholder|\w+ knows them · Placeholder)', x['text'])])
    check('Profile: no issue is pre-filled under What they care about', pg.locator('.pf .pf-ichip').count() == 0, pg.locator('.pf .pf-ichip').count())
    auto = pg.inner_text('.pf [data-pfsec="history"] .pf-auto')
    check('History with HIPHI: one line from the tracker, its bill numbers linking to the bills', auto.startswith('From the tracker:') and pg.locator('.pf .pf-auto a[href*="#/bill/"]').count() >= 1, auto[:100])
    order = pg.evaluate("""(() => { const m = document.querySelector('.lg-main'), pf = m && m.querySelector('.pf'), first = m && [...m.querySelectorAll('.lg-sec')].find(s => s !== pf);
      return !!pf && !!first && !!(pf.compareDocumentPosition(first) & 4) && document.querySelector('.lg-head').compareDocumentPosition(pf) & 4; })()""")
    check('Laptop: the profile is in the left column, under the heading, before the bills', order, '')
    check('Admin (Nate): a "…" on every line, the tip included', all(x['more'] for x in L), [x['sec'] for x in L if not x['more']])
    check('Edited: one seeded line already says "edited" (with its earlier wording)', pg.locator('.pf .pf-ed').count() == 1, pg.locator('.pf .pf-ed').count())
    check('Add a note beside Log a conversation, in the contact card', pg.locator('.lg-cacts [data-lglog] + [data-lgaddnote]').count() == 1, '')
    # Opened from a bill (?from=), the stance row for that bill still comes first, then the Profile
    pg.goto(url(route=f'/legislator/{LEG}?from=SB2175')); pg.wait_for_selector('.pf'); pg.wait_for_timeout(600)
    first = pg.evaluate("(() => { const s = document.querySelector('#lg-s1')?.closest('section'), pf = document.querySelector('.pf'); return !!s && !!(s.compareDocumentPosition(pf) & 4) && !!s.querySelector('.lg-brow.from'); })()")
    check('Opened from a bill: that bill\'s stance row comes before the Profile', first, '')
    pg.goto(url()); pg.wait_for_selector('.pf'); pg.wait_for_timeout(600)
    check('The log is "Conversations and notes"', 'Conversations and notes' in pg.inner_text('#lg-s4'), pg.inner_text('#lg-s4'))
    pg.evaluate("scrollTo(0, 0)"); pg.wait_for_timeout(200)
    shot(pg, '1_laptop_profile_nate.png')
    # "edited" opens the earlier wording, for anyone (the seeded line is Kris's, read here by Nate)
    pg.locator('.pf [data-pfsec="how"] .pf-ed').click(); pg.wait_for_timeout(600)
    ew = pg.inner_text('dialog[open]') if pg.locator('dialog[open]').count() else ''
    check('Earlier wording ("edited"): the words now and the first version, each with who and when', ew.startswith('Earlier wording') and 'Now · Kris' in ew and 'First written · Kris' in ew and 'Placeholder: how they like to be approached.' in ew, ew[:200].replace('\n', ' | '))
    shot(pg, '5_earlier_wording.png')
    pg.keyboard.press('Escape'); pg.wait_for_timeout(500)
    check('Earlier wording: closing it puts the focus back on "edited"', pg.evaluate("document.activeElement?.classList.contains('pf-ed')"), '')

    # ---- 2. An issue they care about (Nate adds it): the chip, the Legislators filter and the issue's page ----
    pg.locator('.pf [data-pfiadd]').click(); pg.wait_for_timeout(400)
    pg.fill('#pf-iq', 'disposable'); pg.wait_for_timeout(200)
    pg.locator('dialog[open] [data-pfpick]', has_text=ISSUE).first.click(); pg.wait_for_timeout(700)
    chips = pg.evaluate("[...document.querySelectorAll('.pf .pf-ichip a')].map(a => a.innerText.trim())")
    check(f'Cares about: "{ISSUE}" added as an issue chip, which links to the issue', chips == [ISSUE] and pg.locator('.pf .pf-ichip a[href^="#/issue/"]').count() == 1, chips)
    iid = pg.evaluate(f"import('/staff5/data.js').then(m => m.S.issues.find(i => i.name === {ISSUE!r}).id)")
    pg.evaluate("location.hash = '#/legislators'"); pg.wait_for_timeout(1500)
    pg.locator('[data-lgfilter]').click(); pg.wait_for_timeout(400)
    items = pg.evaluate("[...document.querySelectorAll('dialog[open] .sv-menu .title')].map(t => t.innerText)")
    check('Legislators, laptop: the Filter sheet\'s fourth item is "Cares about"', items[:4] == ['Chamber', 'Island', 'Committee', 'Cares about'], items)
    item(pg, 'Cares about').click(); pg.wait_for_timeout(800)
    first = pg.locator('dialog[open] [data-pfpick]').first.inner_text()
    check('Cares about: the issues someone cares about come first, with their count', first.startswith(ISSUE) and '1 legislator care' in first, first.replace('\n', ' | '))
    pg.locator('dialog[open] [data-pfpick]', has_text=ISSUE).first.click(); pg.wait_for_timeout(900)
    cap = pg.inner_text('#lg-body .lg-cap'); rows = pg.evaluate("[...document.querySelectorAll('#lg-body tbody tr')].map(r => r.dataset.lgrow)")
    check('Legislators, laptop: "1 of 77 legislators cares about …", listing Rep. Takayama', re.search(rf'1 of \d+ legislators cares about {re.escape(ISSUE)}', cap) and rows == [str(LEG)], f'{cap} {rows}')
    check('Legislators, laptop: the Filter button counts it', '1' in pg.inner_text('[data-lgfilter]'), pg.inner_text('[data-lgfilter]'))
    shot(pg, '3_laptop_legislators_cares_about.png')
    # an issue nobody cares about: the empty state says how to add one
    pg.locator('[data-lgfilter]').click(); pg.wait_for_timeout(400); item(pg, 'Cares about').click(); pg.wait_for_timeout(700)
    pg.fill('#pf-iq', 'school meals for every'); pg.wait_for_timeout(200); pg.locator('dialog[open] [data-pfpick]').first.click(); pg.wait_for_timeout(800)
    t = pg.inner_text('#lg-body')
    check('Legislators: an issue nobody cares about says to add it under What they care about', 'No legislator cares about' in t and 'What they care about' in t, t[:120].replace('\n', ' | '))
    pg.locator('#lg-body .lg-cap [data-lgclear]').click(); pg.wait_for_timeout(700)
    check('Legislators: Clear takes the filter off', pg.locator('#lg-body .lg-cap', has_text='care').count() == 0 and not pg.locator('[data-lgfilter] .sv-fn').count(), pg.inner_text('#lg-body .lg-cap')[:80] if pg.locator('#lg-body .lg-cap').count() else '')
    pg.evaluate(f"location.hash = '#/issue/{iid}'"); pg.wait_for_timeout(1500)
    side = pg.locator('aside .pf-cares')
    check('Issue page, laptop: "Legislators who care about this" in the side panel, naming Rep. Takayama with a link', side.count() == 1 and 'Gregg Takayama' in side.inner_text() and side.locator(f'a[href="#/legislator/{LEG}"]').count() == 1, side.inner_text()[:80] if side.count() else 'none')
    side.scroll_into_view_if_needed(); pg.wait_for_timeout(200)
    shot(pg, '4_laptop_issue_legislators_who_care.png')
    pg.evaluate("location.hash = '#/issue/05e0d6a9-4ea7-456c-b219-e3632ade358b'"); pg.wait_for_timeout(1200)
    check('Issue page: with nobody caring, a quiet line says how', 'None yet. Add this issue under What they care about' in pg.inner_text('.pf-cares'), '')

    # ---- 3. Search finds a profile line ----
    pg.evaluate("location.hash = '#/search?q=fact sheet'"); pg.wait_for_timeout(1500)
    grp = pg.locator('#lg-sres section', has=pg.locator('h2', has_text='Profiles'))
    rowt = grp.locator('.lg-pfrow').first.inner_text() if grp.count() else ''
    check('Search: "fact sheet" finds the profile line, naming the legislator, the section and the words', 'Takayama' in rowt and 'How to work with them' in rowt and 'fact sheet' in rowt, rowt.replace('\n', ' | ')[:140])
    hdr = pg.evaluate("import('/staff5/search.js').then(m => m.headerHits('fact sheet').groups.filter(g => g.label === 'Profiles').flatMap(g => g.items.map(i => i.title)))")
    check('Search box suggestions: a Profiles group too', hdr and 'Takayama' in hdr[0], hdr[:1])
    grp.locator('.lg-pfrow').first.click(); pg.wait_for_timeout(1500)
    check('Search: the result opens the legislator\'s page at that line, marked', f'#/legislator/{LEG}' in pg.url and pg.locator('.pf .pf-land').count() == 1, pg.url)

    # ---- 4. Add a note, and the 10 minutes lifted for your own conversation ----
    pg.goto(url()); pg.wait_for_selector('.pf'); pg.wait_for_timeout(600)
    pg.locator('[data-lgaddnote]').click(); pg.wait_for_timeout(400)
    check('Add a note: a small sheet with the words and a date set to today', pg.locator('dialog[open] #cv-ntext').count() == 1 and pg.input_value('dialog[open] #cv-nday') == pg.evaluate("import('/staff5/model.js').then(m => m.hiToday())"), '')
    pg.fill('#cv-ntext', 'Test note from the practice run: nothing about this legislator.'); pg.locator('[data-cvnsave]').click(); pg.wait_for_timeout(900)
    nt = pg.locator('#lg-cvbox .cv-item', has_text='Test note from the practice run')
    meta = nt.locator('.cv-meta').inner_text() if nt.count() else ''
    check('Add a note: it shows in the log as a note ("Note · You")', nt.count() == 1 and 'Note · You' in meta, meta)
    # A conversation Nate logged 30 minutes ago: before R-335 it could no longer be corrected.
    pg.evaluate("""import('/staff5/data.js').then(async m => { const r = await m.DB.addLegNote(130, null, 'Test conversation logged half an hour ago.', { conversationId: 'test-cv-30' });
      r.created_at = new Date(Date.now() - 30 * 60e3).toISOString(); m.hooks.render(); })"""); pg.wait_for_timeout(700)
    cv = pg.locator('#lg-cvbox .cv-item', has_text='half an hour ago')
    cv.locator('[data-cvmore]').click(); pg.wait_for_timeout(400)
    ed = item(pg, 'Edit')
    check('Your own conversation, 30 minutes on: Edit is offered, not refused', ed.count() == 1 and ed.get_attribute('aria-disabled') is None, ed.inner_text().replace('\n', ' | ') if ed.count() else '')
    ed.click(); pg.wait_for_timeout(800)
    pg.fill('#cv-text', 'Test conversation logged half an hour ago, corrected.'); pg.locator('[data-cvsave]').click(); pg.wait_for_timeout(900)
    cv = pg.locator('#lg-cvbox .cv-item', has_text='corrected')
    check('Corrected conversation: the entry says "edited"', cv.count() == 1 and cv.locator('.cv-ed').count() == 1, cv.inner_text()[:80] if cv.count() else '')
    cv.locator('.cv-ed').click(); pg.wait_for_timeout(500)
    ew = pg.inner_text('dialog[open]') if pg.locator('dialog[open]').count() else ''
    check('Corrected conversation: Earlier wording lists the words before', 'Test conversation logged half an hour ago.' in ew and 'corrected' in ew, ew[:120].replace('\n', ' | '))
    pg.keyboard.press('Escape'); pg.wait_for_timeout(500)

    # ---- 5. Kris (not an admin): only her own lines; add, edit, Earlier wording, remove with Undo ----
    pg.goto(url('KR')); pg.wait_for_selector('.pf'); pg.wait_for_timeout(800)
    L = lines(pg); own = [x for x in L if x['more']]
    check('Kris: a "…" only on her own lines (the tip and How to work with them)', sorted(x['sec'] for x in own) == ['how', 'tip'] and all('Kris' not in x['text'] or 'You' in x['text'] for x in own), [(x['sec'], x['text'][-24:]) for x in own])
    check('Person switch: Nate\'s issue chip is still there for Kris', pg.evaluate("[...document.querySelectorAll('.pf .pf-ichip a')].map(a => a.innerText.trim())") == [ISSUE], '')
    check('Person switch: Nate\'s note and the corrected conversation are still in the log', pg.locator('#lg-cvbox .cv-item', has_text='Test note from the practice run').count() == 1 and pg.locator('#lg-cvbox .cv-item', has_text='corrected').count() == 1, '')
    check('Kris: no remove on Nate\'s issue chip', pg.locator('.pf [data-pfirm]').count() == 0, '')
    pg.locator('.pf [data-pfadd="watch"]').click(); pg.wait_for_timeout(400)
    pg.fill('#pf-text', 'Test line one, written by Kris in practice.'); pg.locator('[data-pfsave]').click(); pg.wait_for_timeout(700)
    new = [x for x in lines(pg) if x['text'].startswith('Test line one')]
    check('Add: Kris\'s line shows in Watch out for, signed "You", with a "…"', len(new) == 1 and new[0]['sec'] == 'watch' and 'You ·' in new[0]['text'] and new[0]['more'], new)
    nid = new[0]['id'] if new else ''
    check('Add: focus is on the new line\'s "…" after the sheet closes', pg.evaluate("document.activeElement?.dataset?.pfmore || ''") == nid, pg.evaluate("document.activeElement?.outerHTML?.slice(0, 80) || ''"))
    menu(pg, nid, 'Edit')
    pg.fill('#pf-text', 'Test line one, written by Kris in practice, then changed.'); pg.locator('[data-pfsave]').click(); pg.wait_for_timeout(700)
    x = next((y for y in lines(pg) if y['id'] == nid), None)
    check('Edit: the line has the new words and says "edited"', x and 'then changed' in x['text'] and 'edited' in x['text'], x)
    pg.locator(f'.pf [data-pfmore="{nid}"]').click(); pg.wait_for_timeout(350)
    mi = pg.evaluate("[...document.querySelectorAll('dialog[open] .sv-menu .title')].map(t => t.innerText)")
    check('Edit: the "…" menu is Edit · Earlier wording · Remove', mi == ['Edit', 'Earlier wording', 'Remove'], mi)
    item(pg, 'Earlier wording').click(); pg.wait_for_timeout(700)
    ew = pg.inner_text('dialog[open]') if pg.locator('dialog[open]').count() else ''
    check('Earlier wording: the old words, with who wrote them and when', 'Test line one, written by Kris in practice.' in ew and 'First written' in ew and 'You' in ew, ew[:160].replace('\n', ' | '))
    pg.keyboard.press('Escape'); pg.wait_for_timeout(500)
    menu(pg, nid, 'Remove')
    gone = not any(y['id'] == nid for y in lines(pg)); tt = pg.inner_text('#toast')
    check('Remove: the line goes at once, and the toast offers Undo', gone and 'Undo' in tt, tt[:80])
    pg.locator('#toast .toastundo').first.click(); pg.wait_for_timeout(600)
    check('Remove: Undo puts it back', any(y['id'] == nid for y in lines(pg)), '')
    # The fold: four lines in a section show the newest two and one "Show all 4" (U-4)
    for n in (2, 3):
      pg.locator('.pf [data-pfadd="watch"]').click(); pg.wait_for_timeout(350); pg.fill('#pf-text', f'Test line {n} by Kris.'); pg.locator('[data-pfsave]').click(); pg.wait_for_timeout(600)
    shown = pg.locator('.pf [data-pfsec="watch"] .pf-line').count(); sa = pg.locator('.pf [data-pfsec="watch"] [data-pfall]')
    check('Fold: four lines show two and "Show all 4"', shown == 2 and sa.count() == 1 and 'Show all 4' in sa.inner_text(), f'{shown} {sa.inner_text() if sa.count() else ""}')
    sa.click(); pg.wait_for_timeout(500)
    check('Fold: "Show all 4" opens them in place', pg.locator('.pf [data-pfsec="watch"] .pf-line').count() == 4, '')
    # The tip is Kris's: she changes it
    tip = lines(pg)[0]['id']; menu(pg, tip, 'Edit')
    pg.fill('#pf-text', 'Test tip set by Kris in practice.'); pg.locator('[data-pfsave]').click(); pg.wait_for_timeout(700)
    check('Tip: its writer changes it', lines(pg)[0]['text'].startswith('Test tip set by Kris in practice.'), lines(pg)[0]['text'][:60])
    # I know them
    pg.locator('.pf [data-pfknow]').click(); pg.wait_for_timeout(400)
    pg.fill('#pf-text', 'Test: met in a practice run.'); pg.locator('[data-pfsave]').click(); pg.wait_for_timeout(700)
    kn = pg.inner_text('.pf [data-pfsec="knows"]')
    check('I know them: "You know them" and the line, and the button goes', 'You know them · Test: met in a practice run.' in kn and pg.locator('.pf [data-pfknow]').count() == 0, kn[:160].replace('\n', ' | '))

    # ---- 6. Lauren (not an admin): Kris's tip is not hers; Nate removes it, and anyone may set one ----
    pg.goto(url('LR')); pg.wait_for_selector('.pf'); pg.wait_for_timeout(800)
    L = lines(pg)
    check('Lauren: no "…" on Kris\'s tip, and no Add a tip while it is set', not L[0]['more'] and pg.locator('.pf [data-pftip]').count() == 0 and L[0]['text'].startswith('Test tip set by Kris'), L[0])
    check('Person switch: Kris\'s lines are still there for Lauren (the newest two of four), without a "…"', any(x['text'].startswith('Test line 3 by Kris') and not x['more'] for x in L) and 'Show all 4' in pg.inner_text('.pf [data-pfsec="watch"]'), '')
    pg.goto(url('NT')); pg.wait_for_selector('.pf'); pg.wait_for_timeout(800)
    menu(pg, lines(pg)[0]['id'], 'Remove')
    check('Admin (Nate): removes Kris\'s tip, and "Add a tip" takes its place', pg.locator('.pf [data-pftip]').count() == 1, '')
    pg.goto(url('LR')); pg.wait_for_selector('.pf'); pg.wait_for_timeout(800)
    pg.locator('.pf [data-pftip]').click(); pg.wait_for_timeout(400)
    pg.fill('#pf-text', 'Test tip set by Lauren in practice.'); pg.keyboard.press('Enter'); pg.wait_for_timeout(700)
    L = lines(pg)
    check('Tip: with none set, Lauren sets one, and it is hers to change', L[0]['sec'] == 'tip' and L[0]['text'].startswith('Test tip set by Lauren') and L[0]['more'], L[0])
    pg.goto(url('NT')); pg.wait_for_selector('.pf'); pg.wait_for_timeout(800)
    check('Person switch back to Nate: Lauren\'s tip and Kris\'s lines are kept', lines(pg)[0]['text'].startswith('Test tip set by Lauren') and any(x['text'].startswith('Test line 3 by Kris') for x in lines(pg)), '')
    wide = pg.evaluate("document.documentElement.scrollWidth > innerWidth + 1")
    check('Laptop: no sideways scroll', not wide, '')
    check('No page errors on the laptop', not errs, errs[:2])
    ctx.close()

    # ---- 7. Phone 390x844, a fresh tab as Nate ----
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True); pg = ctx.new_page()
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(url()); pg.wait_for_selector('.pf'); pg.wait_for_timeout(800)
    order = pg.evaluate("""(() => { const acts = document.querySelector('.lg-acts'), pf = document.querySelector('.pf'), bills = document.querySelector('#lg-s1, #lg-s2');
      return !!(acts && pf && bills) && !!(acts.compareDocumentPosition(pf) & 4) && !!(pf.compareDocumentPosition(bills) & 4); })()""")
    check('Phone: the profile comes after the action row, before the bills', order, '')
    acts = pg.evaluate("[...document.querySelectorAll('.lg-acts .btn')].map(b => b.innerText.trim())")
    check('Phone: the action row is Email · Call · Add a note, then Log a conversation (the filled one) on its own line', acts == ['Email', 'Call', 'Add a note', 'Log a conversation']
      and pg.evaluate("(() => { const n = document.querySelector('.lg-acts [data-lgaddnote]').getBoundingClientRect(), g = document.querySelector('.lg-acts [data-lglog]').getBoundingClientRect(); return g.top > n.bottom - 1 && g.width > 300; })()"), acts)
    small = pg.evaluate("[...document.querySelectorAll('.pf button, .pf a')].filter(e => e.getClientRects().length && !e.closest('.pf-text')).map(e => e.getBoundingClientRect()).filter(r => r.height < 43.5).length")
    check('Phone: every control in the profile is at least 44px tall', small == 0, small)
    wide = pg.evaluate("document.documentElement.scrollWidth > innerWidth + 1")
    check('Phone: no sideways scroll', not wide, '')
    shot(pg, '2_phone_profile_nate.png'); shot(pg, '2b_phone_profile_nate_full.png', True)
    pg.locator('.pf [data-pfiadd]').click(); pg.wait_for_timeout(400); pg.fill('#pf-iq', 'disposable'); pg.wait_for_timeout(200)
    pg.locator('dialog[open] [data-pfpick]', has_text=ISSUE).first.click(); pg.wait_for_timeout(700)
    pg.evaluate("location.hash = '#/legislators'"); pg.wait_for_timeout(1500)
    ch = pg.locator('#lg-chips [data-lgcares]')
    check('Phone, Legislators: a "Cares about" chip', ch.count() == 1 and 'Cares about' in ch.inner_text(), '')
    ch.click(); pg.wait_for_timeout(500); pg.locator('dialog[open] [data-pfpick]', has_text=ISSUE).first.click(); pg.wait_for_timeout(900)
    cap = pg.inner_text('#lg-body .lg-cap') if pg.locator('#lg-body .lg-cap').count() else ''
    rows = pg.evaluate("[...document.querySelectorAll('#lg-body .lg-row')].map(a => a.getAttribute('href'))")
    check('Phone, Legislators: picking the issue lists who cares, with Clear', re.search(rf'1 of \d+ legislators cares about {re.escape(ISSUE)}', cap) and rows == [f'#/legislator/{LEG}'] and 'Clear' in cap, f'{cap} {rows}')
    check('Phone, Legislators: the chip is pressed and names the issue', pg.locator('#lg-chips [data-lgcares][aria-pressed="true"]', has_text=ISSUE).count() == 1, '')
    iid = pg.evaluate(f"import('/staff5/data.js').then(m => m.S.issues.find(i => i.name === {ISSUE!r}).id)")
    pg.evaluate(f"location.hash = '#/issue/{iid}'"); pg.wait_for_timeout(1500)
    pos = pg.evaluate("""(() => { const c = document.querySelector('.pf-cares'), w = document.querySelector('.is-bills') || document.querySelector('.is-stand'); return !!c && !!w && !!(w.compareDocumentPosition(c) & 4); })()""")
    check('Phone, issue page: "Legislators who care about this" after the work', pos and 'Gregg Takayama' in pg.inner_text('.pf-cares'), '')
    # The day-one state (no lines yet, as most profiles will start once it is live): short, every section one row with its Add
    pg.evaluate(f"import('/staff5/data.js').then(m => {{ m.S.legProfiles[{LEG}] = {{ lines: [], issues: [] }}; location.hash = '#/legislator/{LEG}'; }})"); pg.wait_for_timeout(1500)
    h = pg.evaluate("Math.round(document.querySelector('.pf').getBoundingClientRect().height)")
    # 587px on 22 Oct: the practice notice (about 90px), the tip's Add, the issue chip's Add, five one-row sections and the
    # tracker's own History line. A guard against it growing, not a target.
    check(f'Phone: an empty profile stays short ({h}px with the practice notice, under 600)', h < 600 and pg.locator('.pf [data-pftip]').count() == 1, h)
    shot(pg, '6_phone_empty_profile.png')
    check('No page errors on the phone', not errs, errs[:2])
    ctx.close()

    # ---- 8. A busy profile on a laptop: several real-length lines, folded to two a section ----
    ctx = b.new_context(viewport={'width': 1440, 'height': 900}); pg = ctx.new_page()
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(url()); pg.wait_for_selector('.pf'); pg.wait_for_timeout(600)
    pg.evaluate(f"""import('/staff5/data.js').then(m => {{ const S = m.S, p = S.legProfiles[{LEG}], ini = k => S.advocates.find(a => a.initials === k)?.id, t = d => new Date(Date.now() - d * 864e5).toISOString();
      const long = 'Placeholder: a longer line, two or three sentences, to show how a real note sits in this section. It wraps onto a second and third line on a laptop. Sample text only.';
      [['how', 'KV', 1], ['how', 'LR', 2], ['how', 'JS', 3], ['office', 'KR', 1], ['history', 'KV', 1], ['history', 'LR', 2], ['watch', 'KR', 2], ['cares', 'NT', 1]].forEach(([sec, w, d], i) => p.lines.push({{ id: 'busy' + i, sec, body: long, by: ini(w), at: t(d), history: [] }}));
      m.hooks.render(); }})"""); pg.wait_for_timeout(800)
    check('Busy laptop: a section with four lines shows two and "Show all 4"', 'Show all 4' in pg.inner_text('.pf [data-pfsec="how"]'), '')
    pg.evaluate("scrollTo(0, 0)"); shot(pg, '7_laptop_busy_profile.png')
    check('No page errors on the busy laptop profile', not errs, errs[:2])
    ctx.close(); b.close()

  bad = [r for r in results if not r[1]]
  print(f"\n{len(results) - len(bad)} of {len(results)} checks passed. Screenshots: {SHOTS}")
  sys.exit(1 if bad else 0)

if __name__ == '__main__':
  main()
