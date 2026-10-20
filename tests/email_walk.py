# R-079 / R-080 (9/29): emails as a walkthrough, like testimony (pub/helper.js modes 'email', 'legislators', 'intro';
# pub/speakup.js). Sandbox, a phone (390) and a laptop (1440).
#   1. the quick email to a chair at a hearing: stance, the bill and its points, About you, the email (To, subject,
#      message), sending (copied first; mail app / Gmail / Outlook.com links carry to, subject and body; phone puts the
#      mail app first, the laptop Gmail), the copy fallbacks, "Did you send it?", "Something went wrong", Mahalo, and the
#      action counted exactly as before (<bill>|<hearing>|email)
#   2. asking the chairs for a hearing from the bill page (no hearing): the walkthrough, not a bare mailto; counted on the
#      bill with the committee's ask mark
#   3. late testimony stays testimony: the late notice, and no "Email the chair instead" (R-167, Nate 10/5)
#   4-6. your own legislator: a row at a hearing on their committee; Home's card for a bill waiting in their committee;
#      a floor vote on the bill page
#   7. the introduction card: offered once, "No thanks" is forever, and sent is forever
#   8. R-141 (10/4): the talking points tapped on "Get to know the bill" show in a box under them, on the same step, in
#      the words the email or letter will use, and can be changed there; what the box says is what is sent
# python3 tests/email_walk.py [base url]
import json, os, sys, urllib.parse
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832/track.html'
# The Home before 11 Oct (the layout test's 'today'): since R-222 automated browsers get the calm Home, which this test does not read.
SHOTS = os.environ.get('SHOTS', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out', 'email'))
os.makedirs(SHOTS, exist_ok=True)
snap = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'demo', 'snapshot.json')))
ID = {b['bill_number']: b['id'] for b in snap['bills']}
# An issue name inside a sentence (pub/hello.js inSentence, its KEEP_CAPS list mirrored): the first letter goes lower-case
# unless the first word is an acronym (all capitals) or one of the names that keep their capital (R-172, 10/10).
KEEP_CAPS = {'Hawaiʻi', 'Kauaʻi', 'Maui', 'Oʻahu', 'Molokaʻi', 'Lānaʻi', 'Medicaid', 'Medicare', 'Farm to Families food program', 'Summer Streets car-free road pilot'}
def low(n):
    w = n.split()[0]
    return n if (w in KEEP_CAPS or n in KEEP_CAPS or (len(w) > 1 and w.isupper())) else n[0].lower() + n[1:]
FOLLOW = [ID['HB1562'], ID['HB2121']]
TOUR_SEEN = "try{localStorage.setItem('hiphi_tour_bill','1');localStorage.setItem('hiphi_tour_bill_demo','1');localStorage.setItem('hiphi_voice','first');localStorage.setItem('hiphi_voice_demo','first')}catch(e){}"  # hiphi_voice: the letters' first wordings (R-259)
# Links that would leave the page (the mail app, a Gmail tab) are recorded, not followed.
CATCH = """document.addEventListener('click', e => { const a = e.target.closest && e.target.closest('a.hp-send'); if (!a) return;
  e.preventDefault(); (window.__opened ||= []).push(a.href); }, true);"""
ok = fail = 0
def check(c, m):
    global ok, fail
    print('PASS' if c else 'FAIL', m); ok += bool(c); fail += (not c)

def ctx(br, wide):
    c = br.new_context(viewport={'width': 1440, 'height': 900}) if wide else br.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
    c.add_init_script(TOUR_SEEN); c.add_init_script(CATCH)
    c.grant_permissions(['clipboard-read', 'clipboard-write'], origin=urllib.parse.urlsplit(BASE)._replace(path='').geturl().rstrip('/'))
    p = c.new_page(); p.errs = []
    p.on('pageerror', lambda e: p.errs.append(str(e)[:160]))
    return c, p
def follower(p, extra='', follow=FOLLOW, pre=''):
    p.goto(BASE + '?demo=1&ab=layout.today' + extra + '#/'); p.wait_for_timeout(600)
    p.evaluate(f"""localStorage.clear(); sessionStorage.clear(); localStorage.setItem('hiphi_voice', 'first'); localStorage.setItem('hiphi_voice_demo', 'first'); localStorage.setItem('hiphi_watch_ids_demo', JSON.stringify({json.dumps(follow)}));
      localStorage.setItem('hiphi_wiz', JSON.stringify({{step:1,done:true,skipped:true}})); {pre}""")
def visit(p, h, extra='', wait=2800):
    p.goto(BASE + '?demo=1&ab=layout.today' + extra + '#' + h); p.reload(); p.wait_for_timeout(wait)
dlg = lambda p: p.evaluate("document.getElementById('hp-dlg')?.innerText || ''")
def tap(p, rx, sel='#hp-dlg button, #hp-dlg a'):
    return p.evaluate("""([sel, rx]) => { const e = [...document.querySelectorAll(sel)].filter(x => x.offsetParent !== null).find(x => new RegExp(rx, 'i').test((x.innerText || '').trim()));
      if (!e) return false; e.click(); return true; }""", [sel, rx])
def shot(p, name): p.screenshot(path=os.path.join(SHOTS, name + '.png'))
clip = lambda p: p.evaluate("navigator.clipboard.readText().catch(() => '')")
def qs(href):
    u = urllib.parse.urlsplit(href)
    if u.scheme == 'mailto': return dict(to=urllib.parse.unquote(u.path), **{k: v[0] for k, v in urllib.parse.parse_qs(u.query).items()})
    return {k: v[0] for k, v in urllib.parse.parse_qs(u.query).items()}
done = lambda p: p.evaluate("JSON.parse(localStorage.getItem('hiphi_done_demo') || '[]')")
def one_primary(p):
    return p.evaluate("[...document.querySelectorAll('#hp-dlg .btn.primary')].filter(e => e.offsetParent !== null).length")

def walk_to_letter(p, tag, stance='I support it', name='Kai Ho', points=1):
    if 'Where do you stand' in dlg(p):
        shot(p, f'{tag}_1_stand'); tap(p, '^' + stance); p.wait_for_timeout(500)
    check('Get to know the bill' in dlg(p), f'{tag}: "Get to know the bill" follows')
    picked = []
    for i in range(points):
        pt = p.locator('#hp-dlg .hp-pt').nth(i)
        if pt.count(): picked.append(p.locator('#hp-dlg .hp-ptrow').nth(i).locator('.hp-ptt').inner_text().strip()); pt.click(); p.wait_for_timeout(250)
    shot(p, f'{tag}_2_know'); tap(p, '^Next'); p.wait_for_timeout(500)
    check(p.locator('#hp-name').count() == 1, f'{tag}: About you')
    p.fill('#hp-name', name); shot(p, f'{tag}_3_about'); tap(p, 'See my email'); p.wait_for_timeout(600)
    check(p.locator('#hp-letter').count() == 1 and p.locator('#hp-subject').count() == 1, f'{tag}: the email, with a subject to change')
    shot(p, f'{tag}_4_letter')
    return picked

def send_step(p, tag, wide, to_expect=None, subj_rx=None):
    letter = p.input_value('#hp-letter'); subject = p.input_value('#hp-subject')
    tap(p, '^Next'); p.wait_for_timeout(900)
    check('Send your email' in dlg(p), f'{tag}: the sending step')
    check(clip(p) == letter, f'{tag}: the message is copied as soon as the sending step opens')
    labels = p.evaluate("[...document.querySelectorAll('#hp-dlg .hp-send')].map(a => a.innerText.trim())")
    first = 'Open in Gmail' if wide else 'Open in my mail app'
    check(labels and labels[0] == first and len(labels) == 3, f'{tag}: {"laptop: Gmail" if wide else "phone: the mail app"} first, three ways ({labels})')
    check(one_primary(p) == 1, f'{tag}: one main button in view (A-3)')
    hrefs = p.evaluate("Object.fromEntries([...document.querySelectorAll('#hp-dlg .hp-send')].map(a => [a.dataset.via, a.href]))")
    for via in ('app', 'gmail', 'outlook'):
        q = qs(hrefs[via]); to = q.get('to', ''); su = q.get('su', q.get('subject', '')); body = q.get('body', '')
        check((to_expect is None or all(t in to for t in to_expect)) and su == subject and body.replace('\r\n', '\n') == letter,
              f'{tag}: {via} link carries to/subject/body ({to[:60]})')
    check(hrefs['gmail'].startswith('https://mail.google.com/mail/?view=cm&fs=1&') and hrefs['outlook'].startswith('https://outlook.live.com/mail/0/deeplink/compose?') and hrefs['app'].startswith('mailto:'),
          f'{tag}: the three kinds of link')
    if subj_rx: check(__import__('re').search(subj_rx, subject) is not None, f'{tag}: subject "{subject}"')
    shot(p, f'{tag}_5_send')
    # the quiet fallbacks for any other email service
    for part, want in (('to', ', '.join(to_expect or [])), ('subject', subject), ('body', letter)):
        p.locator(f'#hp-dlg [data-part="{part}"]').click(); p.wait_for_timeout(300)
        got = clip(p)
        check(got == want if part != 'to' or to_expect else bool(got), f'{tag}: Copy {part}')
    p.locator('#hp-dlg .hp-send').first.click(); p.wait_for_timeout(1300)
    check(p.evaluate("(window.__opened || []).length") >= 1, f'{tag}: a send button opens the email')
    check('Did you send it?' in dlg(p) and p.locator('#hp-dlg .hp-foot .btn.primary', has_text='Yes, I sent it').count() == 1, f'{tag}: then "Did you send it?"')
    check(one_primary(p) == 1, f'{tag}: after opening, "Yes, I sent it" is the one main button')
    tap(p, 'Something went wrong'); p.wait_for_timeout(400)
    check('Nothing opened?' in dlg(p) and 'Public Access Room' in dlg(p), f'{tag}: "Something went wrong" says what to try')
    shot(p, f'{tag}_6_didyou')
    tap(p, '^Yes, I sent it'); p.wait_for_timeout(1500)
    check('Mahalo' in dlg(p) and 'What happens next' in dlg(p), f'{tag}: the Mahalo screen')
    shot(p, f'{tag}_7_mahalo')

with sync_playwright() as pw:
    br = pw.chromium.launch()
    # ---- 1. the quick email at a hearing, phone and laptop ----
    for wide in (False, True):
        tag = 'laptop' if wide else 'phone'
        c, p = ctx(br, wide); follower(p); visit(p, '/')
        card = p.evaluate("[...document.querySelectorAll('[data-card]')].map(e => e.dataset.card).find(k => k.startsWith('" + ID['HB2121'] + "'))")
        p.evaluate("k => { const c = [...document.querySelectorAll('[data-card]')].find(e => e.dataset.card === k); c.querySelector('[data-moreways]').click(); }", card); p.wait_for_timeout(500)
        p.evaluate("k => { const c = [...document.querySelectorAll('[data-card]')].find(e => e.dataset.card === k); [...c.querySelectorAll('.mwrow')].find(r => /quick email/i.test(r.innerText)).click(); }", card); p.wait_for_timeout(900)
        check('Email about HB 2121' in dlg(p), f'{tag}: "Send a quick email" opens the walkthrough')
        check(p.locator('.composer, [id^="cmp-"]').count() == 0, f'{tag}: no inline composer any more')
        picked = walk_to_letter(p, tag)
        letter = p.input_value('#hp-letter')
        check(picked and picked[0].rstrip('.') in letter, f'{tag}: the point tapped is in the email')
        check(__import__('re').match(r'Aloha (Senator|Representative) ', letter) is not None and 'Kai Ho' in letter and 'pass HB 2121 at the hearing' in letter, f'{tag}: the email greets the chair by title, asks to pass it at the hearing (R-259)')
        send_step(p, tag, wide, to_expect=None, subj_rx=r'^HB 2121: please vote yes on ')
        bid, hid = card.split('|')
        check(f'{bid}|{hid}|email' in done(p), f'{tag}: counted as before: <bill>|<hearing>|email')
        (p.locator('#hp-dlg [data-hp="ngno"]').click() if p.locator('#hp-dlg [data-hp="ngno"]').count() else None); tap(p, '^Done'); p.wait_for_timeout(1500)   # R-205 C4
        check(p.locator('#hp-dlg').count() == 0, f'{tag}: Done closes it')
        emailed = p.evaluate("k => { const c = [...document.querySelectorAll('[data-card]')].find(e => e.dataset.card === k); return c ? c.innerText : ''; }", card)
        check('Emailed the chair' in emailed, f'{tag}: the card says "Emailed the chair"')
        check(not p.errs, f'{tag}: no page errors {p.errs}')
        c.close()

    # ---- 2. asking the chairs for a hearing, from the bill page ----
    for wide in (False, True):
        tag = 'ask_' + ('laptop' if wide else 'phone')
        c, p = ctx(br, wide); follower(p, follow=FOLLOW + [ID['HB1563']]); visit(p, '/bill/HB1563')
        btn = p.locator('[data-bl-main="ask"]:visible').first
        check(btn.count() == 1 and 'Ask the chairs for a hearing' in btn.inner_text(), f'{tag}: the bill page offers "Ask the chairs for a hearing"')
        shot(p, f'{tag}_0_bill'); btn.click(); p.wait_for_timeout(900)
        check('Email about HB 1563' in dlg(p), f'{tag}: it opens the walkthrough, not a bare mailto')
        check(p.locator('.bl-barq').count() == 0, f'{tag}: the old "Did you send your email?" bar does not appear')
        walk_to_letter(p, tag, points=0)
        letter = p.input_value('#hp-letter'); tos = p.evaluate("[...document.querySelectorAll('#hp-dlg .hp-toaddr')].map(e => e.innerText.trim())")
        check(letter.count('Senator') + letter.count('Representative') >= 2 and 'schedule a hearing' in letter, f'{tag}: to both chairs, asking for a hearing')
        send_step(p, tag, wide, to_expect=tos, subj_rx=r'^HB 1563: please schedule a hearing$')
        d = done(p)
        check(f'{ID["HB1563"]}||email' in d and f'{ID["HB1563"]}|HHS/EIG|ask' in d, f'{tag}: counted on the bill, with the committee ask mark ({[x for x in d if ID["HB1563"] in x]})')
        (p.locator('#hp-dlg [data-hp="ngno"]').click() if p.locator('#hp-dlg [data-hp="ngno"]').count() else None); tap(p, '^Done'); p.wait_for_timeout(1500)   # R-205 C4
        check(p.locator('[data-bl-main="ask"]:visible').count() == 0, f'{tag}: the bill page no longer asks')
        check(not p.errs, f'{tag}: no page errors {p.errs}')
        c.close()

    # ---- 2b. a phone that reloads the page while the person is in their mail app comes back to the question; Back closes ----
    c, p = ctx(br, False); follower(p, follow=FOLLOW + [ID['HB1563']]); visit(p, '/bill/HB1563')
    p.locator('[data-bl-main="ask"]:visible').first.click(); p.wait_for_timeout(900)
    walk_to_letter(p, 'reload', points=0); tap(p, '^Next'); p.wait_for_timeout(700)
    p.locator('#hp-dlg .hp-send').first.click(); p.wait_for_timeout(300)
    p.reload(); p.wait_for_timeout(4000)
    check('Did you send it?' in dlg(p) and 'Welcome back' in dlg(p), f'reload: back at "Did you send it?" ({dlg(p)[:50]!r})')
    p.go_back(); p.wait_for_timeout(1200)
    check(p.locator('#hp-dlg').count() == 0 and '/bill/HB1563' in p.evaluate('location.hash'), 'reload: the phone\'s Back closes the walkthrough and stays on the bill')
    check(not p.errs, f'reload: no page errors {p.errs}')
    c.close()

    # ---- 2c. "Email" beside a chair in "Who decides next", with a hearing coming ----
    for wide in (False, True):
        c, p = ctx(br, wide); follower(p); visit(p, '/bill/HB2121')
        e = p.locator('[data-bl-compose]').first
        check(e.count() == 1, f'who decides ({wide}): an Email button beside the chair')
        e.scroll_into_view_if_needed(); e.click(); p.wait_for_timeout(900)
        check('Email about HB 2121' in dlg(p), f'who decides ({wide}): it opens the email walkthrough')
        p.keyboard.press('Escape'); p.wait_for_timeout(1000)
        check(p.locator('#hp-dlg').count() == 0 and p.locator('.bl-side .btn.primary, .actionbar .btn.primary').filter(has_text='testimony').count() >= 1,
              f'who decides ({wide}): Esc closes it and the page\'s main button is still "Help me write testimony"')
        check(not p.errs, f'who decides ({wide}): no page errors {p.errs}')
        c.close()

    # ---- 3. late testimony stays testimony (R-167, Nate 10/5: "We shouldn't have late testimony hand over to an email") ----
    c, p = ctx(br, False); follower(p); visit(p, '/bill/HB1562')
    tap(p, 'Send late testimony', '.btn'); p.wait_for_timeout(900)
    check('Where do you stand' in dlg(p), 'late: the testimony walkthrough begins with "Where do you stand?"')
    tap(p, '^I support it'); p.wait_for_timeout(500)
    d = dlg(p)
    check('Testimony on HB 1562' in d and 'You can still send it. It will be marked late' in d, 'late: the late notice says it can still be sent, marked late')
    check('Email the chair instead' not in d and 'quickest way to be heard' not in d and p.locator('#hp-dlg [data-hp="email"]').count() == 0, 'late: no "Email the chair instead", and no line steering to an email')
    shot(p, 'late_1_banner')
    check(not p.errs, f'late: no page errors {p.errs}')
    c.close()

    # ---- 4-6. your own legislators ----
    c, p = ctx(br, False); follower(p); visit(p, '/')
    sen = p.evaluate("""async () => { const { S, legById } = await import('./pub/core.js');
      const m = S.committeeMembers.find(x => x.committee === 'HHS' && x.role === 'member' && legById(x.legislator_id)?.email);
      const l = legById(m.legislator_id), h = S.legislators.find(x => x.chamber === 'H' && x.email);
      return { id: l.id, d: l.district, last: l.sort_name.split(',')[0].trim(), email: l.email, house: h.district }; }""")
    c.close()
    districts = f"localStorage.setItem('hiphi_districts', JSON.stringify({{senate:{sen['d']}, house:{sen['house']}}}));"
    for wide in (False, True):
        tag = 'legs_' + ('laptop' if wide else 'phone')
        c, p = ctx(br, wide); follower(p, follow=FOLLOW + [ID['HB1563']], pre=districts); visit(p, '/')
        # 4. a hearing on their committee: a row under More ways to help (HB 2121, HHS/CPN)
        card = p.evaluate("[...document.querySelectorAll('[data-card]')].map(e => e.dataset.card).find(k => k.startsWith('" + ID['HB2121'] + "'))")
        p.evaluate("k => [...document.querySelectorAll('[data-card]')].find(e => e.dataset.card === k).querySelector('[data-moreways]').click()", card); p.wait_for_timeout(500)
        row = p.evaluate("k => { const r = [...[...document.querySelectorAll('[data-card]')].find(e => e.dataset.card === k).querySelectorAll('.mwrow')].find(r => /Write to Sen/.test(r.innerText)); return r ? r.innerText : ''; }", card)
        check(f'Sen. {sen["last"]}' in row and 'sits on this committee' in row, f'{tag}: a hearing on your senator\'s committee adds "Write to Sen. {sen["last"]}" ({row[:60]!r})')
        prim = p.evaluate("k => [...document.querySelectorAll('[data-card]')].find(e => e.dataset.card === k).querySelector('.btncol .btn.primary')?.innerText || ''", card)
        check('testimony' in prim.lower(), f'{tag}: testimony still leads the card ({prim!r})')
        # 5. a bill waiting in their committee: Home's card (HB 1563 waits in HHS/EIG), beside the more urgent cards
        mc = p.locator('[data-sp="moment"]')
        check(mc.count() == 1 and f'Sen. {sen["last"]}' in mc.inner_text(), f'{tag}: Home offers writing to your senator about a bill waiting in their committee')
        check(mc.locator('.btn.secondary').count() == 1, f'{tag}: a secondary button, since testimony is more urgent (A-3)')
        shot(p, f'{tag}_0_home'); mc.scroll_into_view_if_needed(); shot(p, f'{tag}_0_card')
        mc.locator('[data-speak]').click(); p.wait_for_timeout(900)
        check(f'Write to Sen. {sen["last"]}' in dlg(p), f'{tag}: it opens the walkthrough addressed to your senator')
        walk_to_letter(p, tag, points=0)
        letter = p.input_value('#hp-letter')
        check(f'Aloha Senator {sen["last"]}' in letter and 'in your district' in letter and 'District' not in letter.replace('your district', '') and 'where you’re a member' in letter, f'{tag}: a constituent, their district, the ask ({letter[:90]!r})')
        check('(from a constituent' in p.input_value('#hp-subject') and 'District' not in p.input_value('#hp-subject'), f'{tag}: the subject says a constituent, no district number (R-259)')
        send_step(p, tag, wide, to_expect=[sen['email']])
        check(f'{ID["HB1563"]}|cmte-HHS/EIG|ask' in done(p), f'{tag}: that moment is marked done')
        d = done(p)   # 089 (R-087): an email to your own legislators is counted as its own kind, not as a chair email
        check(f'{ID["HB1563"]}||legislators' in d and f'{ID["HB1563"]}||email' not in d, f'{tag}: counted as an email to your own legislators ({[x for x in d if ID["HB1563"] in x]})')
        (p.locator('#hp-dlg [data-hp="ngno"]').click() if p.locator('#hp-dlg [data-hp="ngno"]').count() else None); tap(p, '^Done'); p.wait_for_timeout(1500)   # R-205 C4
        again = p.evaluate("[...document.querySelectorAll('[data-sp=moment] [data-speak]')].map(e => e.dataset.speak)")
        check(not any(k.startswith(ID['HB1563']) for k in again), f'{tag}: and not offered again ({again})')
        check(not p.errs, f'{tag}: no page errors {p.errs}')
        c.close()
    # 6. a floor vote on the bill page: the bill made to wait for the Senate vote in this browser only
    c, p = ctx(br, False); follower(p, pre=districts); visit(p, '/bill/HB2121')
    p.evaluate("""async id => { const c = await import('./pub/core.js'); const b = c.anyBill(id); b.stage = 'second_floor'; c.S.hearings = c.S.hearings.filter(h => h.bill_id !== id); if (c.S.xh[id]) c.S.xh[id] = []; if (c.S.pool) c.S.pool.hearings = (c.S.pool.hearings || []).filter(h => h.bill_id !== id); if (c.S.featured) c.S.featured.hearings = (c.S.featured.hearings || []).filter(h => h.bill_id !== id); c.app.render(); }""", ID['HB2121']); p.wait_for_timeout(1200)
    fb = p.locator('[data-bl-main="floor"]:visible').first
    check(fb.count() == 1 and f'Sen. {sen["last"]}' in fb.inner_text(), f'floor: the bill page asks your senator to vote ({fb.inner_text() if fb.count() else ""!r})')
    fb.click(); p.wait_for_timeout(900)
    check(f'Write to Sen. {sen["last"]}' in dlg(p), 'floor: the walkthrough opens, not a bare mailto')
    walk_to_letter(p, 'floor', points=0)
    check('vote in the full Senate soon. Please vote yes.' in p.input_value('#hp-letter') and 'Please vote yes on HB 2121' in p.input_value('#hp-subject'), 'floor: the email asks for a yes vote')
    c.close()

    # ---- 7. the introduction ----
    for wide in (False, True):
        tag = 'intro_' + ('laptop' if wide else 'phone')
        issue = snap['issues'][0]['id']
        pre = districts + f"localStorage.setItem('hiphi_issue_follows_demo', JSON.stringify([{json.dumps(issue)}]));"
        c, p = ctx(br, wide); follower(p, pre=pre); visit(p, '/')
        ic = p.locator('[data-sp="intro"]')
        check(ic.count() == 1, f'{tag}: Home offers "Introduce yourself to your legislators"')
        ic.scroll_into_view_if_needed(); shot(p, f'{tag}_0_card')
        tap(p, '^No thanks', '[data-sp="intro"] button'); p.wait_for_timeout(900)
        check(p.locator('[data-sp="intro"]').count() == 0, f'{tag}: "No thanks" hides it')
        visit(p, '/'); check(p.locator('[data-sp="intro"]').count() == 0, f'{tag}: and it never comes back')
        p.evaluate("localStorage.removeItem('hiphi_intro')"); visit(p, '/')
        p.locator('[data-sp="intro"] [data-speak-intro]').click(); p.wait_for_timeout(900)
        check('Introduce yourself' in dlg(p) and p.locator('#hp-name').count() == 1, f'{tag}: it starts with About you (no bill)')
        p.fill('#hp-name', 'Kai Ho'); p.fill('#hp-why', 'I am a nurse on Oʻahu.'); shot(p, f'{tag}_1_about')
        tap(p, 'See my email'); p.wait_for_timeout(600)
        letter = p.input_value('#hp-letter'); iname = low(snap['issues'][0]['name'])
        check(letter.startswith('Aloha Senator') and 'Representative' in letter and ('I care about most is' in letter or 'I also follow' in letter) and f'I care about most is {iname}.' in letter and 'Where do you stand' in letter, f'{tag}: to both, the issue they care about most and one question (R-172)')
        check('I am a nurse on Oʻahu.' in letter and 'Kai Ho' in letter, f'{tag}: their own words and name')
        shot(p, f'{tag}_2_letter')
        tos = p.evaluate("[...document.querySelectorAll('#hp-dlg .hp-toaddr')].map(e => e.innerText.trim())")
        send_step(p, tag, wide, to_expect=tos, subj_rx=r'^A question from your constituent')
        check(p.evaluate("JSON.parse(localStorage.getItem('hiphi_intro') || 'null')?.how") == 'sent', f'{tag}: remembered as sent')
        (p.locator('#hp-dlg [data-hp="ngno"]').click() if p.locator('#hp-dlg [data-hp="ngno"]').count() else None); tap(p, '^Done'); p.wait_for_timeout(1500)   # R-205 C4
        visit(p, '/'); check(p.locator('[data-sp="intro"]').count() == 0, f'{tag}: never offered again')
        check(not p.errs, f'{tag}: no page errors {p.errs}')
        c.close()

    # ---- 7b. R-172 (Nate 10/10: "The blank 'why these issues matter to you' is difficult because someone picked many issues.
    #      Rethink this part. The email should autofill a 'mahalo' or 'thank you' if nothing is picked."): the hello names ONE
    #      issue, picked from the ones they follow (the first picked to start); the reason is optional and a thank-you line
    #      closes the letter when it is blank; one issue leaves nothing to pick; the legislators page writes the same letter ----
    many = [snap['issues'][0]['id'], snap['issues'][20]['id'], snap['issues'][50]['id']]
    def hello(wide, follow, extra=''):
        c, p = ctx(br, wide); follower(p, pre=districts + f"localStorage.setItem('hiphi_issue_follows_demo', JSON.stringify({json.dumps(follow)}));" + extra); visit(p, '/')
        p.evaluate("localStorage.removeItem('hiphi_intro')"); visit(p, '/')
        p.locator('[data-sp="intro"] [data-speak-intro]').click(); p.wait_for_timeout(900)
        return c, p
    chips = lambda p: p.evaluate("[...document.querySelectorAll('#hp-dlg [data-hp=\"topic\"]')].map(b => [b.dataset.v, b.getAttribute('aria-pressed'), b.innerText.trim()])")
    see = lambda p: (p.evaluate("[...document.querySelectorAll('#hp-dlg button')].find(b => /See my email/.test(b.innerText)).click()"), p.wait_for_timeout(600))
    BAD = ['[', 'undefined', 'null', '\n\n\n', '  ']
    for wide in (False, True):
        tag = 'hello_' + ('laptop' if wide else 'phone')
        # many issues: a chip each, the first one picked; one tap picks another, and the letter names only that one
        c, p = hello(wide, many); ch = chips(p)
        check(len(ch) == 3 and ch[0][1] == 'true' and sum(x[1] == 'true' for x in ch) == 1, f'{tag}: many issues, a chip each, one picked to start ({[x[2][:16] for x in ch]})')
        other = ch[2]
        p.locator(f'#hp-dlg [data-hp="topic"][data-v="{other[0]}"]').click(); p.wait_for_timeout(300)
        check(chips(p)[2][1] == 'true' and chips(p)[0][1] == 'false', f'{tag}: one tap changes the pick')
        p.fill('#hp-name', 'Kai Ho'); p.fill('#hp-why', 'My mom pays too much for her medicine.')
        p.locator('#hp-topic-l').scroll_into_view_if_needed(); shot(p, f'{tag}_hello_0_pick')
        see(p); letter = p.input_value('#hp-letter')
        others_line = letter.split('I also follow')[1].split('\n')[0]
        check(f'The health issue I care about most is {low(other[2])}.' in letter and f'care about most is {low(ch[0][2])}' not in letter and low(ch[0][2]) in others_line and low(other[2]) not in others_line,
              f'{tag}: the letter names only the picked issue, the others in one line above the question')
        check('My mom pays too much for her medicine.' in letter and 'Where do you stand on it?' in letter, f'{tag}: their reason and the one question are in it')
        paras = letter.split('\n\n')
        check(letter.index('I also follow') < letter.index('Where do you stand') and paras[-2].startswith('Where do you stand') and paras[-1].startswith('Mahalo'),
              f'{tag}: "I also follow" is above the question, and the letter ends on its ask and the sign-off')
        shot(p, f'{tag}_hello_1_letter_reason'); c.close()
        # no reason: nothing blank, nothing in brackets, the thank-you line closes it, and the question is still asked
        c, p = hello(wide, many); p.fill('#hp-name', 'Kai Ho'); see(p); letter = p.input_value('#hp-letter')
        check('Mahalo for your work for our district.\nKai Ho' in letter and 'My mom' not in letter, f'{tag}: no reason, the letter closes with the thank-you line')
        check(not any(t in letter for t in BAD) and 'Where do you stand on it?' in letter, f'{tag}: no reason, no blank or placeholder, the question still asked')
        shot(p, f'{tag}_hello_2_letter_noreason'); c.close()
        # a sign-off of their own replaces the thank-you line
        c, p = hello(wide, many); p.fill('#hp-name', 'Kai Ho'); p.fill('#hp-closing', 'Sincerely'); see(p); letter = p.input_value('#hp-letter')
        check('Sincerely,\nKai Ho' in letter and 'Mahalo for your work' not in letter, f'{tag}: their own sign-off is used instead of the thank-you line')
        c.close()
        # one issue followed: nothing to pick, the letter names that one issue
        c, p = hello(wide, [many[0]])
        check(chips(p) == [] and 'The issue that matters most to you' not in dlg(p), f'{tag}: one issue followed, no picking step')
        p.fill('#hp-name', 'Kai Ho'); see(p); letter = p.input_value('#hp-letter')
        check(f'The health issue I care about most is {low(snap["issues"][0]["name"])}.' in letter and 'I also follow' not in letter, f'{tag}: one issue is named, no other line')
        c.close()
        # nothing followed: the letter claims no bills it has not followed (Nate 10/10), and it still asks its one question.
        # Nothing at all is followed here (no bill either), so this reads the legislators page's letter (the same builder).
        c, p = ctx(br, wide); follower(p, follow=[], pre=districts + "localStorage.setItem('hiphi_issue_follows_demo', '[]');" + "localStorage.setItem('hiphi_me', JSON.stringify({ name: 'Kai Ho' }));"); visit(p, f"/legislator/{sen['id']}")
        p.locator('[data-pp-mail]').first.click(); p.wait_for_timeout(700)
        nl = p.locator('textarea[data-pp-msg]').first.input_value() if p.locator('textarea[data-pp-msg]').count() else ''
        check('I care about the health of our community.' in nl and 'I follow' not in nl and 'The health issue' not in nl and 'What health issues are you working on' in nl and not any(t in nl for t in BAD),
              f'{tag}: nothing followed, the letter says the person cares and makes no claim of following ({nl.splitlines()[2:3]})')
        c.close()
        # R-212 #25: bills followed one by one and no issue: the letter names the issue of a followed bill.
        c, p = ctx(br, wide); follower(p, pre=districts + "localStorage.setItem('hiphi_issue_follows_demo', '[]');" + "localStorage.setItem('hiphi_me', JSON.stringify({ name: 'Kai Ho' }));"); visit(p, f"/legislator/{sen['id']}")
        p.locator('[data-pp-mail]').first.click(); p.wait_for_timeout(700)
        nl = p.locator('textarea[data-pp-msg]').first.input_value() if p.locator('textarea[data-pp-msg]').count() else ''
        check(('The health issue' in nl or 'What I care about most' in nl) and not any(t in nl for t in BAD), f'{tag}: bills followed, no issue: the letter names a followed bill\'s issue ({nl.splitlines()[4:5]})')
        shot(p, f'{tag}_hello_3_letter_nothing_followed'); c.close()
        # six issues: four show (the one picked among them), "Show all" opens the rest, and a pick made among the hidden ones stays shown
        six = [i['id'] for i in snap['issues'][0:6]]
        c, p = hello(wide, six); n0 = len(chips(p))
        check(n0 == 4 and p.locator('#hp-topic-all').count() == 1 and 'Show all 6 issues' in dlg(p), f'{tag}: six issues, four show and "Show all 6 issues" opens the rest ({n0})')
        p.locator('#hp-topic-all').click(); p.wait_for_timeout(300)
        allc = chips(p); check(len(allc) == 6, f'{tag}: Show all lists all six ({len(allc)})')
        hidden = allc[-1]; p.locator(f'#hp-dlg [data-hp="topic"][data-v="{hidden[0]}"]').click(); p.wait_for_timeout(300)
        p.locator('#hp-topic-all').click(); p.wait_for_timeout(300)
        vis = chips(p)
        check(len(vis) == 4 and any(x[0] == hidden[0] and x[1] == 'true' for x in vis), f'{tag}: a pick made among the hidden ones stays shown when the list closes')
        c.close()
        # the legislators page writes the same letter, with the reason and sign-off given in the walkthrough (people.js, hello.js)
        c, p = ctx(br, wide); follower(p, pre=districts + f"localStorage.setItem('hiphi_issue_follows_demo', JSON.stringify({json.dumps(many)}));"
          + "localStorage.setItem('hiphi_me', JSON.stringify({ name: 'Kai Ho', introWhy: 'My mom pays too much for her medicine.' }));"); visit(p, f"/legislator/{sen['id']}")
        p.locator('[data-pp-mail]').first.click(); p.wait_for_timeout(700)
        pl = p.locator('textarea[data-pp-msg]').first.input_value() if p.locator('textarea[data-pp-msg]').count() else ''
        check(pl.startswith(f'Aloha Senator {sen["last"]}') and 'My mom pays too much for her medicine.' in pl and 'Mahalo for your work for our district.' in pl and not any(t in pl for t in BAD),
              f'{tag}: the legislators page writes the same letter, with the reason, and no placeholder')
        check(not p.errs, f'{tag}: no page errors {p.errs}')
        c.close()

    # ---- 8. R-141 (Nate 10/4: "selecting talking points should show up in an editable box that they can see. It shouldn't
    # be on a different page."; Nate 10/5: "The box should already be prefilled in with the other info and be visible already.
    # Clicking the plus button will add the text to the rest of the text."). The box holds the whole email from the start,
    # written by the same builder the letter uses; each point's plus button writes its words into it ----
    pts_text = lambda p: p.evaluate("[...document.querySelectorAll('#hp-dlg .hp-ptrow .hp-ptt')].map(e => e.innerText.trim())")
    pressed = lambda p: p.evaluate("[...document.querySelectorAll('#hp-dlg .hp-pt')].map(e => e.getAttribute('aria-pressed') === 'true')")
    box = lambda p: p.input_value('#hp-letter')
    sent_of = lambda s: s if s[-1:] in '.!?…' else s + '.'
    NAME = "localStorage.setItem('hiphi_me', JSON.stringify({name: 'Kai Ho'}));"
    for wide in (False, True):
        tag = 'box_' + ('laptop' if wide else 'phone')
        c, p = ctx(br, wide); follower(p, pre=NAME); visit(p, '/bill/HB2121')
        e = p.locator('[data-bl-compose]').first; e.scroll_into_view_if_needed(); e.click(); p.wait_for_timeout(900)
        if 'Where do you stand' in dlg(p): tap(p, '^I support it'); p.wait_for_timeout(500)
        P = [sent_of(s) for s in pts_text(p)]
        B0 = box(p)
        check(len(P) >= 3 and p.locator('#hp-letter').count() == 1 and p.locator('#hp-letter').is_visible(), f'{tag}: three points or more, and the box is there from the start ({len(P)})')
        check(B0.startswith('Aloha ') and 'My name is Kai Ho.' in B0 and 'Please vote to pass' in B0 and not any(s in B0 for s in P), f'{tag}: on arrival the box holds the email, prefilled with the greeting, their name and the ask, and no point yet')
        check(pressed(p) == [False] * len(P) and p.locator('#hp-dlg .hp-pt').first.get_attribute('aria-label') == 'Add this point', f'{tag}: each point has an "Add this point" button, none added yet')
        check('In your email' in dlg(p) and p.locator('label[for="hp-letter"]').count() == 1, f'{tag}: the box is labelled "In your email"')
        shot(p, f'{tag}_0_arrive')
        check('What the bill does, and points you can add to your email below.' in dlg(p), f'{tag}: the lead line says what the points are for')
        # the first Add in a visit brings the box into view (plain clicks, so Playwright does not scroll for them)
        p.evaluate("document.querySelectorAll('#hp-dlg .hp-pt')[0].click()"); p.wait_for_timeout(900)
        in_view = p.evaluate("(() => { const b = document.querySelector('#hp-dlg .hp-body'), x = document.querySelector('#hp-dlg .hp-ptbox'); if (!b || !x) return null; const r = x.getBoundingClientRect(), v = b.getBoundingClientRect(); return r.top >= v.top - 1 && r.bottom <= v.bottom + 1; })()")
        check(in_view is True, f'{tag}: the first Add brings the box into view, so the words land where they can be seen ({in_view})')
        B1 = box(p)
        check(P[0] in B1 and B1.index('My name is Kai Ho.') < B1.index(P[0]) < B1.index('Please vote to pass'), f'{tag}: a plus puts the point in the email after the opening and before the ask')
        check(pressed(p)[0] is True and p.locator('#hp-dlg .hp-pt').nth(0).inner_text().strip().endswith('Added'), f'{tag}: its button shows Added')
        p.evaluate("document.querySelector('#hp-dlg .hp-body').scrollTop = 0"); p.evaluate("document.querySelectorAll('#hp-dlg .hp-pt')[2].click()"); p.wait_for_timeout(400)
        B2 = box(p)
        check(B2.index(P[0]) < B2.index(P[2]) < B2.index('Please vote to pass'), f'{tag}: a second point joins the first, in the order the bill lists them')
        check(p.evaluate("document.querySelector('#hp-dlg .hp-body').scrollTop") == 0, f'{tag}: a later Add does not scroll the walkthrough')
        shot(p, f'{tag}_1_two_added')
        p.locator('#hp-dlg .hp-pt').nth(0).click(); p.wait_for_timeout(400)
        check(P[0] not in box(p) and P[2] in box(p) and pressed(p)[:3] == [False, False, True], f'{tag}: a second press takes that point out, and only that one')
        # what they type stays: a paragraph of their own, then one point is added and taken out again
        mine = 'My niece is 14 and uses them.'
        p.fill('#hp-letter', box(p) + '\n\n' + mine); p.wait_for_timeout(250)
        p.locator('#hp-dlg .hp-pt').nth(1).click(); p.wait_for_timeout(400)
        check(P[1] in box(p) and mine in box(p), f'{tag}: a point added after words they typed keeps those words')
        p.locator('#hp-dlg .hp-pt').nth(1).click(); p.wait_for_timeout(400)
        check(P[1] not in box(p) and mine in box(p), f'{tag}: taking that point out again leaves their words')
        # a point they rewrote is never cut by a plus: it is selected in the box, and one Delete takes it out
        own2 = P[2].rstrip('.') + ', and my niece started using e-cigarettes at 14.'
        before = box(p).replace(P[2], own2); p.fill('#hp-letter', before); p.wait_for_timeout(250)
        check(pressed(p)[2] is True, f'{tag}: a point with words added to it still reads Added')
        p.locator('#hp-dlg .hp-pt').nth(2).click(); p.wait_for_timeout(300)
        sel = p.evaluate("(() => { const t = document.getElementById('hp-letter'); return [document.activeElement === t, t.value.slice(t.selectionStart, t.selectionEnd)]; })()")
        check(box(p) == before and sel == [True, own2], f'{tag}: a plus on a rewritten point selects it in the box instead of cutting it ({sel[1][:40]!r})')
        shot(p, f'{tag}_2_edited')
        p.keyboard.press('Delete'); p.wait_for_timeout(300)
        check(own2 not in box(p) and pressed(p)[2] is False, f'{tag}: Delete takes it out, and its button reads Add')
        # a reload brings the box back as it was; the email is the box's own words
        before = box(p)
        p.reload(); p.wait_for_timeout(3500)
        if 'Where do you stand' in dlg(p): tap(p, '^I support it'); p.wait_for_timeout(600)
        check(box(p) == before, f'{tag}: after a reload the box still has the same words')
        tap(p, '^Next'); p.wait_for_timeout(500)
        check(p.locator('#hp-name').count() == 1 and p.input_value('#hp-name') == 'Kai Ho', f'{tag}: About you, with the name ready')
        tap(p, 'See my email'); p.wait_for_timeout(600)
        letter = p.input_value('#hp-letter')
        check(letter == before, f'{tag}: the email says exactly what the box said')
        check(P[0] not in letter and P[1] not in letter and mine in letter, f'{tag}: the email has the points picked, and no others')
        shot(p, f'{tag}_3_letter')
        tap(p, '^Back'); p.wait_for_timeout(400); tap(p, '^Back'); p.wait_for_timeout(500)
        check(box(p) == before, f'{tag}: Back to the bill step: the box still has their words')
        check(not p.errs, f'{tag}: no page errors {p.errs}')
        c.close()

    # testimony uses the same step: "In your letter", the whole letter in the box, its heading and greeting too
    c, p = ctx(br, False); follower(p, pre=NAME); visit(p, '/bill/HB2121')
    tb = p.locator('.bl-side .btn.primary, .actionbar .btn.primary').filter(has_text='testimony').first
    tb.scroll_into_view_if_needed(); tb.click(); p.wait_for_timeout(900)
    if 'Where do you stand' in dlg(p): tap(p, '^I support it'); p.wait_for_timeout(500)
    P = [sent_of(s) for s in pts_text(p)]; B0 = box(p)
    check('In your letter' in dlg(p) and B0.startswith('Testimony in') and 'Dear Chair' in B0 and not any(s in B0 for s in P), 'testimony: the box says "In your letter" and holds the whole letter from the start, no point yet')
    p.locator('#hp-dlg .hp-pt').nth(1).click(); p.wait_for_timeout(600)
    B1 = box(p)
    check(P[1] in B1 and B1.index('My name is Kai Ho.') < B1.index(P[1]) < B1.index('Please pass HB 2121'), 'testimony: a plus puts the point after the opening, before the ask')
    p.fill('#hp-letter', B1.replace(P[1], 'As a school nurse, ' + P[1][0].lower() + P[1][1:])); p.wait_for_timeout(250)
    check(pressed(p)[:3] == [False, True, False], f'testimony: a lead-in before a point keeps it Added ({pressed(p)[:3]})')
    tap(p, '^Next'); p.wait_for_timeout(400); tap(p, 'See my letter'); p.wait_for_timeout(600)
    check('As a school nurse, ' in p.input_value('#hp-letter'), 'testimony: the letter has the box\'s words')
    shot(p, 'box_testimony')
    before = p.input_value('#hp-letter')
    p.reload(); p.wait_for_timeout(4000)
    check(p.evaluate("document.getElementById('hp-letter')?.value || ''") == before and 'As a school nurse, ' in before, 'testimony: a reload keeps the letter as it was (the saved draft)')
    check(not p.errs, f'testimony: no page errors {p.errs}')
    c.close()

    # someone who changes their stance to one HIPHI's points argue against never sends the points they had tapped
    c, p = ctx(br, False); follower(p, pre=NAME); visit(p, '/bill/HB2121')
    e = p.locator('[data-bl-compose]').first; e.scroll_into_view_if_needed(); e.click(); p.wait_for_timeout(900)
    tap(p, '^I support it'); p.wait_for_timeout(500)
    P = pts_text(p); p.locator('#hp-dlg .hp-pt').nth(0).click(); p.wait_for_timeout(400)
    tap(p, '^Back'); p.wait_for_timeout(400); tap(p, '^I oppose it'); p.wait_for_timeout(500)
    check(p.locator('#hp-dlg .hp-pt').count() == 0 and p.locator('#hp-letter').count() == 0, 'stance: no points and no box for someone who opposes it')
    tap(p, '^Next'); p.wait_for_timeout(400); p.fill('#hp-name', 'Kai Ho'); p.fill('#hp-why', 'I think it goes too far.'); tap(p, 'See my email'); p.wait_for_timeout(600)
    check(P[0] not in p.input_value('#hp-letter') and 'I think it goes too far.' in p.input_value('#hp-letter'), 'stance: the email has their own words and none of the points')
    check(not p.errs, f'stance: no page errors {p.errs}')
    c.close()
    br.close()
print(f'\n{ok} passed, {fail} failed   screenshots: {SHOTS}')
sys.exit(1 if fail else 0)
