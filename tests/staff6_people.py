# Staff v6: each person's three most important things on their first screen (R-336, carried from R-269's per-person
# targets and tests/staff5_people.py to v6's places). On the practice copy (Mon 16 Mar 2026, 9:00 am HST unless a check
# moves the clock with &asof), laptop 1440x900, and a phone (390x844) on a hearing day for Kris (Fri 3/20) and Lauren
# (Tue 3/17). Where a thing lives moved in v6 (This week is Hearings, Team is its own place, Review is Testimony's To
# approve, the account menu is "You" at the sidebar's foot), so each check says its v6 place and its v5 one; with APP=staff5
# it runs v5's, as staff5_people.py does, to prove the harness and record the baseline. Spec words: the five testimony
# states (Writing, With an approver, Second look, Ready to file, Filed, plus Missed; "sent back" is a flag on Writing),
# "Going: Kris" / "Going: no one yet".
#
#   APP=staff6 python3 tests/staff6_people.py     exits 1 when a target is missed
#   APP=staff5 python3 tests/staff6_people.py     v5 for the baseline (prints only)
#   V4_ROOT=/path/to/worktree ...                 serves that folder straight into the browser (otherwise HOST, :8832)
import os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import staff6_lib as L

V5 = L.V5
STATE = r'\b(Writing|With an approver|Second look|Ready to file|Filed|Missed)\b'
# The viewer's own step says its verb instead of the state ("Approve by today 11:00 AM", "Resubmit · late, still accepted
# until 9:30 AM today"): it tells where the testimony stands from where this person sits, so it counts as saying it.
OWN_STEP = r'(?m)^\s*(Approve|Resubmit|File|Write|Revise|Review|Send (?:it )?for approval)\b.*\b(by|until|now|due)\b'
# R-352 (C-15): a card's time line no longer repeats the verb (the button says it: "Late, still accepted until ..." beside
# Resubmit), so the own step is said by the card's sentence, its verb and the testimony ("Revise and resubmit the testimony
# on ..."), which tells where it stands as plainly as the state word.
OWN_SAY = r'(?m)^\s*(Approve|Resubmit|File|Write|Revise|Review|Send|Make)\b[^\n]*\btestimony\b'
said_state = lambda t: re.search(STATE, t) or re.search(OWN_STEP, t) or re.search(OWN_SAY, t)
STATE_V5 = r'Testimony|No draft|draft yet|Filed|Ready to file|Sent back|in review|approval'
R = L.Results()
def check(name, ok, detail='', v6_only=False, skip=None):
  # a v6-only target is still measured on v5 (the before), marked so
  return R.check(name + (' [v6 target]' if v6_only and V5 else ''), ok, detail, skip=skip)

def at(pg, rx, in_view=False):
  return L.visible_text(pg.page, rx, 'main', in_view)
def first_screen(pg, rx):
  y = at(pg, rx); return y is not None and y < pg.h, y
def main_text(pg): return pg.text('main')
def hearings_route(): return '/?view=week' if V5 else '/hearings'
def team_route(): return '/?scope=team' if V5 else '/team'

def going_v5(pg, hid, asof):
  """v5: Today's big hearing card appears only after "I'm going" on the hearing page."""
  pg.open('/hearing/' + hid, asof)
  b = pg.page.get_by_role('button', name=re.compile(r"I.m going")).first
  if b.count(): b.click(); pg.page.wait_for_timeout(700)
  pg.nav('/')

PLACE_FILE = {'/hearings': ('Hearings', 'staff6/hearings.js'), '/team': ('Team', 'staff6/team.js'),
              '/testimony?view=approve': ('Testimony', 'staff6/testimonyplace.js'), '/testimony': ('Testimony', 'staff6/testimonyplace.js')}
# Testimony opens on the tab that holds the viewer's most urgent own step, late first; else To approve for an approver with
# items; else To write (spec 13 Changed). On the busy practice day (Mon 16 Mar 2026, 9:00 am):
OPENS = [('NT', 'Ready to file', 'HB 1562 is late, SB 3025 is due at 10:00'), ('KV', 'Sent back', 'his sent-back draft'),
         ('KR', 'To approve', 'her approval due today'), ('SY', 'To write', 'nothing of her own to approve, send back or file')]
LIT_TAB = r"""() => { const t = [...document.querySelectorAll('main .sv-secnav a[aria-current], main [role=tablist] [aria-current], main [role=tab][aria-selected=true]')].find(e => e.getClientRects().length);
  return t ? (t.querySelector('.sv-tl')?.innerText || t.innerText || '').replace(/\s+/g, ' ').replace(/\s*\d+$/, '').trim() : ''; }"""
def place(pg, route, extra=None):
  """Go to a v6 place. Returns None when it is there, else why not ("not built yet: ..."), so its checks are skipped
  rather than passed on the Today a missing route falls back to. v5's places are always there."""
  if extra is None: pg.nav(route)
  else: pg.open(route, extra)
  if V5 or route not in PLACE_FILE: return None
  title, f = PLACE_FILE[route]
  h1 = pg.page.evaluate("() => [...document.querySelectorAll('h1, [role=heading][aria-level=\"1\"]')].filter(e => e.getClientRects().length).map(e => e.innerText.trim())[0] || ''")
  if re.match(title, h1, re.I): return None
  return f'not built yet: {route} shows "{h1[:30]}"' + (f', {f} is a placeholder' if L.stub(f) else '')

def hearing_cards(pg):
  """v6: each hearing card (hearingCard, .v6-hcard), else each block that links to a hearing page, with its text."""
  return pg.page.evaluate("""() => { let cards = [...document.querySelectorAll('main .v6-hcard')].filter(e => e.getClientRects().length);
    if (!cards.length) cards = [...document.querySelectorAll('main a[href*="/hearing/"]')].filter(e => e.getClientRects().length).map(a => a.closest('li, article, section, .card, [class*=card]') || a);
    return [...new Set(cards)].map(c => c.innerText); }""")

def main():
  with L.browser() as b:
    # ---- Nate: what is slipping, from one line on Today; Team opens on it whole; his own next step leads ----
    pg = b.page('NT'); pg.open('/')
    ok, y = first_screen(pg, r'\d+\s+slipping|slipping on the team')
    check('Nate: "N slipping" on his Today\'s first screen', ok, y)
    if not V5:
      door = pg.page.evaluate("() => [...document.querySelectorAll('main a[href^=\"#/team\"]')].some(a => { const r = a.getBoundingClientRect(); return a.getClientRects().length && r.top < innerHeight && r.bottom > 0; })")
      check('Nate: the slipping line opens Team in one click', door, '' if door else 'no link to #/team on his first screen')
    m = pg.measure()
    check('Nate: one filled button on Today\'s first screen, for his own next step', m['filled'] == 1 and (V5 or re.search(r'your next step', main_text(pg), re.I)),
          f"{m['filled']} filled" + ('' if V5 else '; "Your next step" ' + ('shown' if re.search(r'your next step', main_text(pg), re.I) else 'not shown')))
    nb = place(pg, team_route()); txt = main_text(pg)
    check('Nate: Team opens on the Slipping list', 'Slipping' in txt[:400], txt[:80].replace('\n', ' '), skip=nb)
    end = pg.page.evaluate("(() => { const s = [...document.querySelectorAll('main section, main .v6-team-block, main [data-block]')].find(x => /^\\s*Slipping/.test(x.innerText)); return s ? Math.round(s.getBoundingClientRect().bottom) : null; })()")
    check("Nate: the whole Slipping list on Team's first screen", end is not None and end <= pg.h, end, skip=nb)
    # R-352 part 2: the side column says it as "Partners · 3 sets of words and 1 group to approve"
    pg.nav('/'); check('Nate: partner words to approve stay on his Today (R-328)', re.search(r'partner words|Partners\b[^\n]*\bwords\b[^\n]*\bto approve', main_text(pg), re.I), '')
    check('Nate: no page errors', not pg.errors, pg.errors[:1]); pg.close()

    # ---- Jess: her approvals on every visit, even after a look at Team; late but open is never red "Overdue" ----
    pg = b.page('JS'); pg.open('/')
    if V5:
      t = pg.page.get_by_role('button', name='Team', exact=True).first
      if t.count(): t.click(); pg.page.wait_for_timeout(800)
    else: pg.nav('/team')
    pg.open('/'); txt = main_text(pg)
    check('Jess: Today reopens on hers after a look at Team', 'Team: today' not in txt[:200], txt[:60].replace('\n', ' '))
    if not V5: check('Jess: no Mine | Team switch on Today (V01)', L.find(pg.page, 'Team', 'Mine', roles=('button', 'tab', 'radio'), scope='main') is None, '')
    ok, y = first_screen(pg, r'second look' if not V5 else r'second approval')
    check('Jess: her second approvals on her first screen' + ('' if V5 else ' ("Second look")'), ok, y)
    check('Jess: late but open testimony is not headed "Overdue"', 'Overdue' not in txt, '')
    check('Jess: "to approve", not "to file", on her approvals', 'to file' not in txt, '')
    pg.close()

    # ---- Kris: every hearing says where its testimony stands; on a phone on Friday her hearing leads ----
    pg = b.page('KR'); pg.open('/')
    if V5:
      if pg.page.query_selector('[data-fold="coal"]') and not pg.page.query_selector('.td-coal a.td-crow'): pg.page.click('[data-fold="coal"]'); pg.page.wait_for_timeout(600)
      rows = pg.page.evaluate("[...document.querySelectorAll('.td-coal a.td-crow[href*=\"/hearing/\"]')].map(a => a.innerText)")
      told = [r for r in rows if re.search(STATE_V5, r, re.I)]
    else:
      nb = place(pg, '/hearings'); rows = hearing_cards(pg); told = [r for r in rows if said_state(r)]
    check('Kris: every hearing ' + ('row on Today' if V5 else 'card on Hearings') + ' says where its testimony stands', rows and len(told) == len(rows), f'{len(told)} of {len(rows)}', skip=None if V5 else nb)
    nobody = sum(len(re.findall(r'Nobody from the team yet|Nobody going yet', r)) for r in rows)
    check('Kris: no "Nobody going" nag on the hearings (R-276, D5)', nobody == 0, nobody, skip=None if V5 else nb)
    pg.close()
    pg = b.page('KR', 390, 844)
    if V5: going_v5(pg, L.HHSCPN_FRI, L.KRIS_DAY); ok, y = first_screen(pg, 'Your hearing today'); y_ok = y is not None and y < 0.3 * 844
    else:
      pg.open('/', L.KRIS_DAY); y = at(pg, r'9:30'); y2 = at(pg, r'\b229\b'); y_ok = y is not None and y2 is not None and max(y, y2) < 0.3 * 844
    check("Kris, phone, Friday: her hearing's time and room in the top third", y_ok, y)
    if not V5:
      # the hearing card's time (.v6-hcard-time), else the smallest visible element that says 9:30 (never a wrapper around it)
      size = pg.page.evaluate("""() => { const card = [...document.querySelectorAll('main .v6-hcard-time')].find(x => /9:30/.test(x.innerText || '') && x.getClientRects().length);
        const e = card || [...document.querySelectorAll('main *')].filter(x => /9:30/.test(x.innerText || '') && x.getClientRects().length).sort((a, b) => (a.innerText || '').length - (b.innerText || '').length)[0];
        return e ? parseFloat(getComputedStyle(e).fontSize) : 0; }""")
      check('Kris, phone, Friday: the time in large type (18px or more)', size >= 18, f'{size}px')
      going = L.find(pg.page, re.compile(r"^\s*I.m going", re.I), roles=('button', 'switch', 'checkbox'), in_view=True)
      check("Kris, phone, Friday: I'm going on the first screen (1 tap)", going is not None, '')
    h = pg.page.evaluate('document.documentElement.scrollHeight'); check('Kris, phone, Friday: Today under 1.5 screens', h < 1.5 * 844, h)
    pg.close()

    # ---- Patti: her sent-back draft and its deadline first, never "nothing of your own"; Hearings is HEAL's ----
    pg = b.page('PH'); pg.open('/'); txt = main_text(pg)
    check('Patti: no "Nothing of your own" over a draft due today', 'Nothing of your own' not in txt, '')
    # Where she acts on it, her own step says its verb, as OWN_STEP reads the states: "Revise and resubmit the testimony",
    # with the approver's note under it, is her sent-back draft on her Today; elsewhere it carries the flag "sent back".
    ok, y = first_screen(pg, r'sent back|revise and resubmit')
    check('Patti: her sent-back draft on her first screen ("sent back", or her own step "Revise and resubmit")', ok, y)
    ok2, y2 = first_screen(pg, r'9:30'); check('Patti: its due time (9:30 AM) on her first screen', ok2, y2)
    m = pg.measure(); check("Patti: at most 4 labelled buttons in view (spec 8, D4)", m['labelled_buttons'] <= 4, f"{m['labelled_buttons']}: {', '.join(m['labelled_list'][:8])}", v6_only=True)
    nb = place(pg, hearings_route()); check("Patti: " + ('This week' if V5 else 'Hearings') + " shows HEAL's SB3234", re.search(r'SB\s?3234', main_text(pg)), '', skip=nb)
    pg.close()

    # ---- Kevin: on his deadline day the P1 testimony leads; Today is always his own; the chair ask is in sight ----
    pg = b.page('KV'); pg.open('/', L.KEVIN_DAY)
    first = pg.page.evaluate("""() => { const r = document.querySelector('main .v6-step, main .td-row, main .v6-row'); return r ? (r.dataset.num || '') + ' ' + r.innerText : ''; }""")
    check('Kevin, Wednesday: HB2121 testimony leads', re.search(r'HB\s?2121', first[:200]) and re.search(r'testimony|file|approve|writ', first, re.I), first[:70].replace('\n', ' '))
    if V5:
      t = pg.page.get_by_role('button', name='Team', exact=True).first
      if t.count(): t.click(); pg.page.wait_for_timeout(800)
      pg.open('/', L.KEVIN_DAY)
    else: pg.open('/?scope=team', L.KEVIN_DAY)
    check('Kevin: Today opens on his own (an old Team link too)', 'Team: today' not in main_text(pg)[:200], pg.hash())
    pg.open('/')
    ask = L.find(pg.page, re.compile(r'^\s*(Email the chairs?|Ask the chairs?)\b', re.I), roles=('link', 'button'), in_view=True)
    check("Kevin: a chair ask's Email the chair on his first screen", ask is not None, '')
    pg.close()

    # ---- Saya: Outreach opens on this week's asks, CTFH's; sharing is one click from Today ----
    pg = b.page('SY'); pg.open('/outreach')
    heads = pg.page.evaluate("[...document.querySelectorAll('main h1, main h2, main [aria-current=page]')].map(h => h.innerText).join(' | ')")
    check("Saya: Outreach opens on this week's asks", re.search(r'asks', heads, re.I) and not re.match(r'\s*Supporters', heads), heads[:80])
    txt = main_text(pg); check("Saya: the asks are CTFH's, not every coalition's", re.search(r'HB\s?2121', txt) and not re.search(r'SB\s?3234', txt), '')
    pg.nav('/')
    # (Today's button for the ask is Outreach's own name for it, "Write the public ask", and opens its card: C-15, one name per act)
    share = L.find(pg.page, re.compile(r'share|copy (link|message|post)|this week.s asks|open the ask|write the public ask', re.I), roles=('link', 'button'), in_view=True)
    check('Saya: sharing one click from Today', share is not None, '')
    pg.close()

    # ---- R-356 round 1 (decision 2): Team is for leads and people with Sees Team (Nate, Jess, Jaylen, Kris) ----
    # Kevin, Saya, Patti, Julie have no Team option on Hearings, Bills, Legislators or Outreach; Kris has one on all four and
    # reaches Team. Saya has no switch at all on Outreach (her list is the asks she writes, HB 2121's among them).
    if not V5:
      OPT = "() => [...document.querySelectorAll('[data-seg=hscope],[data-seg=blscope],[data-seg=lgask],[data-seg=otwho]')].filter(e => e.textContent.trim() === 'Team').length"
      for who, want in (('KV', 0), ('SY', 0), ('PH', 0), ('JMM', 0), ('KR', 1)):
        n = 0
        for path in ('/hearings/week', '/issues/bills', '/hearings/ask', '/outreach'):
          pg = b.page(who); pg.open(path); n += pg.page.evaluate(OPT); pg.close()
        check(f'{L.NAMES[who]}: {"no Team option" if not want else "a Team option"} on Hearings, Bills, Bills That Need Hearings and Outreach', n == 4 * want, f'{n} of 4')
      pg = b.page('KR'); pg.open('/team')
      check('Kris: Team opens with its tabs (Sees Team)', bool(pg.page.query_selector('nav.sv-secnav[aria-label="Team"]')), main_text(pg)[:60]); pg.close()
      pg = b.page('KV'); pg.open('/team')
      check('Kevin: #/team is the teammate picker, never an error', not pg.page.query_selector('nav.sv-secnav[aria-label="Team"]') and not pg.errors, main_text(pg)[:60]); pg.close()
      pg = b.page('SY'); pg.open('/outreach'); sw = pg.page.query_selector('[data-seg="otwho"]')
      check('Saya: Outreach draws no switch (her list follows the asks she writes)', sw is None and bool(pg.page.query_selector('.ot-card')), ''); pg.close()

    # ---- Lauren: on a phone on her hearing day, her hearing and its testimony first; the partner update in 2 clicks ----
    pg = b.page('LR', 390, 844)
    if V5:
      going_v5(pg, L.TRN_TUE, L.LAUREN_DAY); y = at(pg, 'Your hearing today'); y_ok = y is not None and y < 0.3 * 844
      card = pg.page.evaluate("(() => { const h = [...document.querySelectorAll('main h2, main h3')].find(x => /Your hearing today/.test(x.innerText)); const s = h && h.closest('section'); return s ? s.innerText : ''; })()")
    else:
      pg.open('/', L.LAUREN_DAY); y = at(pg, r'9:30'); y_ok = y is not None and y < 0.3 * 844
      cards = hearing_cards(pg); card = cards[0] if cards else ''
    check('Lauren, phone, Tuesday: her hearing first', y_ok, y)
    check('Lauren: the card says room 430 and the testimony', '430' in card and (re.search(r'testimony', card, re.I) if V5 else said_state(card)), card[:80].replace('\n', ' '))
    pg.close()
    pg = b.page('LR'); pg.open('/'); clicks = 0
    o = L.find(pg.page, 'Outreach', roles=('link',))
    if o: o.click(); pg.ready(); clicks += 1
    t = L.find(pg.page, 'Partner update', roles=('link', 'tab'))
    if t: t.click(); pg.ready(); clicks += 1
    check('Lauren: the partner update in 2 clicks from Today', clicks == 2 and re.search(r'partner update', pg.text('main')[:300], re.I), f'{clicks} clicks, at {pg.hash()}')
    pg.close()

    # ---- Julie: a quiet week says so once; a week with alcohol hearings shows them; others' steps are not her buttons ----
    pg = b.page('JMM'); pg.open('/')
    if V5: ok, y = first_screen(pg, 'No hearings this week'); check('Julie: "No hearings this week" on her first screen', ok, y)
    else:
      nb = place(pg, '/hearings'); ok, y = first_screen(pg, r'no hearings'); check('Julie: Hearings says there are no hearings this week, on its first screen', ok, y, skip=nb)
      pg.nav('/'); n = len(re.findall(r'no hearings', main_text(pg), re.I)); check('Julie: Today says "no hearings" at most once', n <= 1, n)
    pg.nav('/'); m = pg.measure()
    check("Julie: at most 4 labelled buttons in view (D4)", m['labelled_buttons'] <= 4, f"{m['labelled_buttons']}: {', '.join(m['labelled_list'][:8])}", v6_only=True)
    nb = place(pg, hearings_route(), '&asof=2026-02-23T09:00:00-10:00')
    check("Julie: " + ('This week' if V5 else 'Hearings') + " shows HIAPA's SB2463 (Fri 27 Feb)", re.search(r'SB\s?2463', main_text(pg)), '', skip=nb)
    pg.close()

    # ---- Testimony opens where each person's most urgent own step is (spec 13 Changed; v6 only: v5 opened Review) ----
    if not V5:
      for who, tab, why in OPENS:
        pg = b.page(who); nb = place(pg, '/testimony', ''); lit = pg.page.evaluate(LIT_TAB)
        check(f'{L.NAMES[who]}: Testimony opens on {tab} ({why})', lit.lower() == tab.lower(), f'opens on "{lit or "no tab lit"}" at {pg.hash()}', skip=nb)
        if pg.errors: check(f'{L.NAMES[who]}: Testimony: no page errors', False, pg.errors[:1])
        pg.close()

    # ---- Two people in one tab (R-316 W38): Kevin sends a draft for approval and adds a to-do, switches to Nate from the
    # account menu ("You" at the sidebar's foot in v6), Nate finds both; Start over puts the practice day back. ----
    pg = b.page('KV'); pg.open('/')
    sent = pg.page.evaluate("""async (app) => { const m = await import(`./${app}/data.js`), S = m.S;
      const d = Object.values(S.drafts).flat().find(d => d.status === 'draft' && (S.assignments[d.bill_id] || [])[0] === S.me.id);
      if (!d) return null; await m.DB.transition(d.bill_id, d.id, 'submit'); await m.DB.addTodo(d.bill_id, 'Two-person check: call the chair');
      return S.bills.find(b => b.id === d.bill_id).bill_number; }""", L.APP)
    check('Kevin: has a draft of his own to send', sent, sent)
    def menu(label):
      if V5: pg.page.click('.sv-avbtn')
      else:
        you = L.find(pg.page, re.compile(r'^\s*You\b', re.I), roles=('button', 'link'))
        if not you: return False
        you.click()
      pg.page.wait_for_timeout(500)
      it = L.find(pg.page, label, roles=('button', 'menuitem', 'link'))
      if not it: return False
      it.click(); pg.page.wait_for_timeout(600); return True
    went = menu(re.compile(r'practi[cs]e as someone else|switch person', re.I))
    if went: pg.page.get_by_text('Nate').last.click(); pg.page.wait_for_timeout(3500)
    check("Kevin -> Nate: the account menu switched person", went and '&as=NT' in pg.page.url, pg.page.url[-60:])
    pg.who = 'NT'
    nb = place(pg, '/inbox' if V5 else '/testimony?view=approve', ''); t = main_text(pg)
    num = re.sub(r'^([A-Z]+)\s?(\d+)$', r'\1\\s?\2', sent or '')   # v6 writes 'SB 3076' (D15), v5 'SB3076'
    check("Nate: Kevin's draft waits for his approval after the switch (" + ('Inbox' if V5 else 'Testimony, To approve') + ')',
          sent and re.search(rf'{num}[\s\S]{{0,300}}approv|approv[\s\S]{{0,300}}{num}', t), '', skip=nb if went else None)
    pg.open(f'/bill/{sent}'); check("Nate: Kevin's to-do is on the bill", 'Two-person check' in main_text(pg), '')
    so = menu(re.compile(r'start (the practice )?over', re.I)); pg.page.wait_for_timeout(3000)
    pg.open(f'/bill/{sent}'); check('Start over: the practice day is back as it began', so and 'Two-person check' not in main_text(pg), '')
    check('Two people in one tab: no page errors', not pg.errors, pg.errors[:1]); pg.close()
  if V5: L.save_baseline('people', {n: s for n, s, d in R.rows})
  R.done(enforce=not V5)

if __name__ == '__main__':
  main()
