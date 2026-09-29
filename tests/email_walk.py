# R-079 / R-080 (9/29): emails as a walkthrough, like testimony (pub/helper.js modes 'email', 'legislators', 'intro';
# pub/speakup.js). Sandbox, a phone (390) and a laptop (1440).
#   1. the quick email to a chair at a hearing: stance, the bill and its points, About you, the email (To, subject,
#      message), sending (copied first; mail app / Gmail / Outlook.com links carry to, subject and body; phone puts the
#      mail app first, the laptop Gmail), the copy fallbacks, "Did you send it?", "Something went wrong", Mahalo, and the
#      action counted exactly as before (<bill>|<hearing>|email)
#   2. asking the chairs for a hearing from the bill page (no hearing): the walkthrough, not a bare mailto; counted on the
#      bill with the committee's ask mark
#   3. late testimony's "Email the chair instead" opens the email walkthrough with the stance carried over
#   4-6. your own legislator: a row at a hearing on their committee; Home's card for a bill waiting in their committee;
#      a floor vote on the bill page
#   7. the introduction card: offered once, "No thanks" is forever, and sent is forever
# python3 tests/email_walk.py [base url]
import json, os, sys, urllib.parse
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832/track.html'
SHOTS = os.environ.get('SHOTS', os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out', 'email'))
os.makedirs(SHOTS, exist_ok=True)
snap = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'demo', 'snapshot.json')))
ID = {b['bill_number']: b['id'] for b in snap['bills']}
FOLLOW = [ID['HB1562'], ID['HB2121']]
TOUR_SEEN = "try{localStorage.setItem('hiphi_tour_bill','1');localStorage.setItem('hiphi_tour_bill_demo','1')}catch(e){}"
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
    p.goto(BASE + '?demo=1' + extra + '#/'); p.wait_for_timeout(600)
    p.evaluate(f"""localStorage.clear(); sessionStorage.clear(); localStorage.setItem('hiphi_watch_ids_demo', JSON.stringify({json.dumps(follow)}));
      localStorage.setItem('hiphi_wiz', JSON.stringify({{step:1,done:true,skipped:true}})); {pre}""")
def visit(p, h, extra='', wait=2800):
    p.goto(BASE + '?demo=1' + extra + '#' + h); p.reload(); p.wait_for_timeout(wait)
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
        if pt.count(): picked.append(pt.locator('.hp-ptt').inner_text().strip()); pt.click(); p.wait_for_timeout(250)
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
        check(letter.startswith('Dear Chair') and 'Kai Ho' in letter and 'pass HB 2121 at the hearing' in letter, f'{tag}: the email greets the chair, asks to pass it at the hearing')
        send_step(p, tag, wide, to_expect=None, subj_rx=r'^HB 2121: please pass it \(hearing ')
        bid, hid = card.split('|')
        check(f'{bid}|{hid}|email' in done(p), f'{tag}: counted as before: <bill>|<hearing>|email')
        tap(p, '^Done'); p.wait_for_timeout(1500)
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
        check(letter.count('Chair') >= 2 and 'give HB 1563 a hearing' in letter, f'{tag}: to both chairs, asking for a hearing')
        send_step(p, tag, wide, to_expect=tos, subj_rx=r'^HB 1563: please give it a hearing$')
        d = done(p)
        check(f'{ID["HB1563"]}||email' in d and f'{ID["HB1563"]}|HHS/EIG|ask' in d, f'{tag}: counted on the bill, with the committee ask mark ({[x for x in d if ID["HB1563"] in x]})')
        tap(p, '^Done'); p.wait_for_timeout(1500)
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
              f'who decides ({wide}): Esc closes it and the page\'s main button is still "Write my testimony"')
        check(not p.errs, f'who decides ({wide}): no page errors {p.errs}')
        c.close()

    # ---- 3. late testimony: "Email the chair instead" ----
    c, p = ctx(br, False); follower(p); visit(p, '/bill/HB1562')
    tap(p, 'Send late testimony', '.btn'); p.wait_for_timeout(900)
    if 'Where do you stand' in dlg(p): tap(p, '^I support it'); p.wait_for_timeout(500)
    check('Email the chair instead' in dlg(p), 'late: the testimony walkthrough offers "Email the chair instead"')
    shot(p, 'late_1_banner')
    tap(p, 'Email the chair instead'); p.wait_for_timeout(1800)
    check('Email about HB 1562' in dlg(p) and 'Get to know the bill' in dlg(p), f'late: the email walkthrough opens on the same bill, stance carried over ({dlg(p)[:60]!r})')
    shot(p, 'late_2_email')
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
        check(f'Dear Senator {sen["last"]}' in letter and f'Senate District {sen["d"]}' in letter and 'where you are a member' in letter, f'{tag}: a constituent, their district, the ask ({letter[:90]!r})')
        check('Senate District' in p.input_value('#hp-subject'), f'{tag}: the subject says constituent and district')
        send_step(p, tag, wide, to_expect=[sen['email']])
        check(f'{ID["HB1563"]}|cmte-HHS/EIG|ask' in done(p), f'{tag}: that moment is marked done')
        tap(p, '^Done'); p.wait_for_timeout(1500)
        again = p.evaluate("[...document.querySelectorAll('[data-sp=moment] [data-speak]')].map(e => e.dataset.speak)")
        check(not any(k.startswith(ID['HB1563']) for k in again), f'{tag}: and not offered again ({again})')
        check(not p.errs, f'{tag}: no page errors {p.errs}')
        c.close()
    # 6. a floor vote on the bill page: the bill made to wait for the Senate vote in this browser only
    c, p = ctx(br, False); follower(p, pre=districts); visit(p, '/bill/HB2121')
    p.evaluate("""async id => { const c = await import('./pub/core.js'); const b = c.anyBill(id); b.stage = 'second_floor'; c.S.hearings = c.S.hearings.filter(h => h.bill_id !== id); if (c.S.xh[id]) c.S.xh[id] = []; c.app.render(); }""", ID['HB2121']); p.wait_for_timeout(1200)
    fb = p.locator('[data-bl-main="floor"]:visible').first
    check(fb.count() == 1 and f'Sen. {sen["last"]}' in fb.inner_text(), f'floor: the bill page asks your senator to vote ({fb.inner_text() if fb.count() else ""!r})')
    fb.click(); p.wait_for_timeout(900)
    check(f'Write to Sen. {sen["last"]}' in dlg(p), 'floor: the walkthrough opens, not a bare mailto')
    walk_to_letter(p, 'floor', points=0)
    check('vote of the full Senate soon. Please vote yes.' in p.input_value('#hp-letter') and 'please vote yes on HB 2121' in p.input_value('#hp-subject'), 'floor: the email asks for a yes vote')
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
        letter = p.input_value('#hp-letter'); iname = snap['issues'][0]['name']
        check(letter.startswith('Dear Senator') and 'Representative' in letter and 'The issues I follow:' in letter and iname in letter, f'{tag}: to both, listing the issues they follow')
        check('I am a nurse on Oʻahu.' in letter and 'Kai Ho' in letter, f'{tag}: their own words and name')
        shot(p, f'{tag}_2_letter')
        tos = p.evaluate("[...document.querySelectorAll('#hp-dlg .hp-toaddr')].map(e => e.innerText.trim())")
        send_step(p, tag, wide, to_expect=tos, subj_rx=r'^Aloha from a constituent in Senate District \d+ and House District \d+$')
        check(p.evaluate("JSON.parse(localStorage.getItem('hiphi_intro') || 'null')?.how") == 'sent', f'{tag}: remembered as sent')
        tap(p, '^Done'); p.wait_for_timeout(1500)
        visit(p, '/'); check(p.locator('[data-sp="intro"]').count() == 0, f'{tag}: never offered again')
        check(not p.errs, f'{tag}: no page errors {p.errs}')
        c.close()
    br.close()
print(f'\n{ok} passed, {fail} failed   screenshots: {SHOTS}')
sys.exit(1 if fail else 0)
