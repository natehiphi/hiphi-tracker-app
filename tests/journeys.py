# Flow measurement for DESIGN.md Part B: does a person get where they are going, and in how
# many steps.  python3 tests/journeys.py  [--json]
#
# Closes gap G-1. Until this existed, Part B was enforced by review only and the step budgets in
# B-2 were aspirations. A journey here does two jobs at once: it COUNTS the steps against the
# budget, and it proves the journey still completes at all - so a flow that silently breaks is a
# failing test rather than something Nate finds.
#
# Each step is one thing a person does. `do` is the click or the typing; `reach` is what must be
# true afterwards, which is what makes a step a step rather than a mouse movement. A journey runs
# with storage cleared, so it is also the cold-start test for B-11: nothing here reads Help.
import json, os, sys
from playwright.sync_api import sync_playwright
# The bill page tour (pub/tour.js) shows on the first bill page a fresh browser opens; tests/bill_tour.py covers it.
TOUR_SEEN = "try{localStorage.setItem('hiphi_tour_bill','1');localStorage.setItem('hiphi_tour_bill_demo','1')}catch(e){}"

HOST = os.environ.get('HOST', 'http://localhost:8832')   # HOST=http://localhost:NNNN for another server
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out', 'journeys')
os.makedirs(OUT, exist_ok=True)

click_text = lambda sel, rx: f"""(()=>{{const e=[...document.querySelectorAll({json.dumps(sel)})]
  .filter(x=>x.offsetParent!==null).find(x=>/{rx}/i.test((x.innerText||'').trim()));
  if(!e)return false; e.click(); return true;}})()"""
seen = lambda rx: f"""(()=>/{rx}/i.test((document.querySelector('main')||document.body).innerText))()"""

PUBLIC = HOST + '/track.html?demo=1'
# The testimony walkthrough's last hop: one tap copies the letter and opens the Capitol site in a new tab; coming back to
# this tab is what turns the button into "Yes, I saw the green box" (helper.js listens for the page becoming visible again).
hp_seen = lambda rx: f"""(()=>{{const d=document.getElementById('hp-dlg'); return !!d && /{rx}/i.test(d.innerText);}})()"""   # the walkthrough is a dialog outside main
LEAVE_AND_RETURN = """(()=>{const b=[...document.querySelectorAll('#hp-dlg button')].find(x=>/Copy my letter and open/.test(x.innerText)); if(!b) return false;
  window.open=()=>null; b.click();
  Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>'hidden'}); document.dispatchEvent(new Event('visibilitychange'));
  Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>'visible'}); document.dispatchEvent(new Event('visibilitychange')); return true;})()"""
# The email walkthrough's mail-app button is a mailto link: tapped, but kept from leaving the test browser.
OPEN_MAIL_APP = """(()=>{const a=[...document.querySelectorAll('#hp-dlg a.hp-send')].find(x=>/mail app/i.test(x.innerText)); if(!a) return false;
  a.addEventListener('click', e=>e.preventDefault(), {once:true}); a.click(); return true;})()"""
STAFF  = HOST + '/staff.html?demo=1'

JOURNEYS = [
 # People follow issues, not bills (R-018, 9/21): a bill comes to them because it is on an issue they follow. Walks the
 # first visit rebuilt 9/21 (R-023, pub/start.js): tick a category tile, Next, then the issues screen, where HIPHI's own
 # picks among the four shown start ticked (B-12), so reading them and deciding is the same step as "Follow N issues".
 # Following is done when the "Mahalo!" moment says so; its Continue belongs to the next part of the visit.
 dict(name='public: arrive -> follow a first issue', app=PUBLIC, budget=3, start='#/', steps=[
   dict(what='tick a category', do="""(()=>{const e=[...document.querySelectorAll('[data-stissue]')].find(x=>x.offsetParent!==null); if(!e)return false; e.click(); return true;})()""",
        reach="(()=>!!document.querySelector('[data-stissue][aria-pressed=true]'))()"),
   dict(what='Next, to its issues', do=click_text('.st-bar [data-stnext]', '^Next$'),
        reach="(()=>document.getElementById('st-h')?.innerText.trim()==='Your issues' && !!document.querySelector('[data-stpick]'))()"),
   dict(what='read the ticked issues and follow them', do=click_text('.st-bar [data-stnext]', 'Follow \\d+ issue'),
        # Since R-146 the alerts screen comes right after the follow (it shows only once something is followed), and the
        # "Mahalo!" after it; either proves the follow.
        reach="(()=>{const m=document.querySelector('#fx-moment:not([hidden])'); return (!!m && /following/i.test(m.innerText)) || !!document.querySelector('.st-alertspage #st-h');})()"),
 ]),
 dict(name='public: arrive -> understand what one bill does', app=PUBLIC, budget=3, start='#/', skip_wizard=True, steps=[
   dict(what='open a bill from the list', do="(()=>{const a=document.querySelector('main a[href*=\"#/bill/\"]'); if(!a)return false; a.click(); return true;})()",
        reach="(()=>/#\\/bill\\//.test(location.hash))()"),
   dict(what='the plain summary is on screen, unprompted', do='true',
        reach="(()=>{const l=document.querySelector('.bl-head .lede'); return !!l && l.innerText.trim().length>20;})()"),
 ]),
 # R-068 (Nate 9/27): testimony is the main action wherever there is a hearing, so "decide to act" is testimony now,
 # budgeted for a first-timer (B-2): the stance question, the bill and its talking points (9/28), the name, the letter, the one-time Capitol account step,
 # one tap to copy and open the Capitol page, and the green box. The quick email is still one of the other ways.
 dict(name='public: decide to act -> testimony sent (first time)', app=PUBLIC, budget=9, start='#/bill/HB2121', skip_wizard=True, steps=[
   dict(what='choose to testify',        do=click_text('.btn', 'Write my testimony'), reach=hp_seen('Where do you stand')),
   dict(what='say where you stand',      do=click_text('#hp-dlg button', 'I support it'), reach=hp_seen('Get to know the bill')),
   dict(what='move on from the bill',     do=click_text('#hp-dlg button', '^Next'), reach="(()=>!!document.getElementById('hp-name'))()"),
   dict(what='type your name',           fill=('#hp-name', 'Kai Ho'), reach="(()=>document.getElementById('hp-name')?.value==='Kai Ho')()"),
   dict(what='see the letter',           do=click_text('#hp-dlg button', 'See my letter'), reach="(()=>!!document.getElementById('hp-letter'))()"),
   dict(what='move on from the letter',  do=click_text('#hp-dlg button', '^Next'), reach=hp_seen('Have you sent testimony')),
   dict(what='say you have an account',  do=click_text('#hp-dlg button', 'Yes, I have an account'), reach=hp_seen('Copy my letter and open')),
   dict(what='copy it and open the Capitol page (and come back)', do=LEAVE_AND_RETURN, reach=hp_seen('Did you see the green box')),
   dict(what='confirm the green box',    do=click_text('#hp-dlg button', 'Yes, I saw the green box'), reach=hp_seen('Mahalo')),
 ]),
 # R-079 (Nate 9/29): the quick email is a walkthrough like testimony: where you stand, the bill and its points, your
 # name, the email to read over, then sending (the mail app first on a phone) and "Did you send it?". 4 steps became 9.
 dict(name='public: quick email (more ways to help) -> sent', app=PUBLIC, budget=9, start='#/', skip_wizard=True, steps=[
   dict(what='open more ways to help',   do=click_text('.btn', 'More ways to help'), reach=seen('Send a quick email')),
   dict(what='choose the quick email',   do=click_text('.mwrow, .btn', 'Send a quick email'), reach=hp_seen('Where do you stand')),
   dict(what='say where you stand',      do=click_text('#hp-dlg button', 'I support it'), reach=hp_seen('Get to know the bill')),
   dict(what='move on from the bill',    do=click_text('#hp-dlg button', '^Next'), reach="(()=>!!document.getElementById('hp-name'))()"),
   dict(what='type your name',           fill=('#hp-name', 'Kai Ho'), reach="(()=>document.getElementById('hp-name')?.value==='Kai Ho')()"),
   dict(what='see the email',            do=click_text('#hp-dlg button', 'See my email'), reach="(()=>!!document.getElementById('hp-letter'))()"),
   dict(what='move on to sending',       do=click_text('#hp-dlg button', '^Next'), reach=hp_seen('Send your email')),
   dict(what='open it in the mail app',  do=OPEN_MAIL_APP, reach=hp_seen('Did you send it')),
   dict(what='confirm it was sent',      do=click_text('#hp-dlg button', 'Yes, I sent it'), reach=hp_seen('Mahalo')),
 ]),
 # Counted from the moment the alerts are offered (B-2): right after the issues are followed (R-146, Nate 10/4; it was
 # under "Coming up on your issues" until then). The walk there is a newcomer's (a category, its ticked issues) and is
 # not counted. A mobile number is the box shown first; the "Mahalo!" that follows is the proof it was taken.
 # The code (R-155 "Code at sign-up"; the practice copy shows it by default since R-176): the code typed is the third
 # step, and six digits send themselves (phones offer the code above the keyboard). Before codes are on it is 2.
 dict(name='public: sign up for alerts', app=PUBLIC, budget=3, start='#/start/1', pick_cat=True,
      walk_to="(()=>{const i=document.getElementById('st-a-phone'); return !!i && i.offsetParent!==null;})()", steps=[
   dict(what='type the number', fill=('#st-a-phone', '(808) 555-0123'),
        reach="(()=>document.getElementById('st-a-phone')?.value==='(808) 555-0123')()"),
   dict(what='ask for the code', do=click_text('.st-bar #st-send', 'Text me a code'), reach="(()=>{const i=document.getElementById('st-a-code'); return !!i && i.offsetParent!==null;})()"),
   dict(what='type the code from the text', fill=('#st-a-code', '123456'), reach="(()=>{const m=document.getElementById('fx-moment'); return !!m && !m.hidden && /text alerts are on/i.test(m.innerText);})()"),
 ]),
 dict(name='staff: open the app -> the first thing due is on screen', app=STAFF, budget=1, start='#/', steps=[
   dict(what='it is already there', do='true',
        reach="(()=>{const c=document.querySelector('.td-card,.td-root .row'); return !!c && c.getBoundingClientRect().top < window.innerHeight;})()"),
 ]),
 # Starts where a person really starts, on Today, with the number typed into the header search and Enter pressed
 # (R-022). It used to start on the results page, so it counted 1 step while a real person took 3 or 4. The header
 # search is a desktop control (a phone has the magnifier), and the team works on desktops, so this one runs at 1440.
 dict(name='staff: a bill number in hand -> that bill page', app=STAFF, budget=2, start='#/', desk=True, steps=[
   dict(what='type the number into the header search', fill=('#hq', 'HB1562'),
        reach="(()=>{const i=document.getElementById('hq'); return !!i && i.offsetParent!==null && i.value==='HB1562';})()"),
   dict(what='press Enter', press=('#hq', 'Enter'),
        reach="(()=>/^#\\/bill\\/HB1562$/i.test(location.hash) && !!document.querySelector('main h1, main .bw-page'))()"),
 ]),
 dict(name='staff: bill page -> position changed and saved', app=STAFF, budget=3, start='#/bill/HB1562', steps=[
   dict(what='open the position control', do=click_text('button,.btn,.sv-pick', 'Position|Support|Oppose|Monitor|No position'),
        reach="(()=>!!document.querySelector('dialog[open],.sv-sheet[open],[role=menu]'))()"),
   # X10-7 (R-180 wave 3): the step used to reach (()=>true)(), so a save that never happened passed. The proof is the toast that says
   # what the save did (X10-6): "Saved. The public page now says HIPHI opposes."
   dict(what='choose a position (and it saves)', do=click_text('dialog[open] button,[role=menu] button,.sv-sheet[open] button', '^Oppose'),
        reach="(()=>/Saved\\. The public page now says HIPHI opposes/i.test(document.getElementById('toast')?.innerText||''))()"),
 ]),
 # X10-5: a hearing is set and its draft is not there: Today says "New hearing: ... Make the draft." and one tap asks for it.
 dict(name='staff: a new hearing -> its draft asked for', app=STAFF, budget=5, start='#/', steps=[
   dict(what='the new hearing is on Today, with its button', do='true', reach="(()=>/New hearing: [A-Z/]+ \\w{3} \\d+\\/\\d+\\. Make the draft\\./.test(document.querySelector('main').innerText))()"),
   dict(what='ask for the draft', do=click_text('main .btn,main button', 'Make the draft now'),
        reach="(()=>/Draft made|Making the draft|Asked for it/i.test(document.getElementById('toast').innerText + document.querySelector('main').innerText))()"),
   dict(what='write it, then send it for review', do=click_text('main .btn,main button', 'Submit for review'),
        reach="(()=>/Sent .*for review|Sent for review/i.test(document.getElementById('toast')?.innerText||''))()"),
 ]),
 # X10-7 / X10-4: someone who follows a bill and starts on Home opens the bill from there with the bill page's tour ON (a fresh browser
 # meets it as a person would): it waits to be asked for ("Take the tour"), so "Write my testimony" is there to press. Counted to the
 # first answer in the walkthrough; the rest of it is the journey above.
 dict(name='public: Home -> testimony begun (a returning follower, tour on)', app=PUBLIC, budget=3, start='#/', skip_wizard=True, tour=True, steps=[
   dict(what='open the bill from Home', do="(()=>{const a=document.querySelector('main a[href*=\"#/bill/\"]'); if(!a) return false; a.click(); return true;})()",
        reach="(()=>/#\\/bill\\//.test(location.hash) && !document.querySelector('[data-tour]'))()"),
   dict(what='choose to testify',        do=click_text('.btn', 'Write my testimony|Send late testimony'), reach=hp_seen('Where do you stand')),
   dict(what='say where you stand',      do=click_text('#hp-dlg button', 'I support it'), reach=hp_seen('Get to know the bill')),
 ]),
 # X10-7: an approver arrives from the Slack link (it opens Review on the draft) and approves it: one tap on Approve.
 dict(name='staff: from the Slack link -> a draft approved', app=STAFF, budget=2, start='#/review', steps=[
   dict(what='the draft is in front of them', do='true', reach="(()=>!!document.querySelector('.td-rvcard') && !!document.querySelector('[data-approve]'))()"),
   dict(what='approve it', do="(()=>{const b=document.querySelector('[data-approve]'); if(!b) return false; b.click(); return true;})()",
        reach="(()=>/Approved/i.test(document.getElementById('toast')?.innerText||''))()"),
 ]),
 # X10-7: the public ask (R-117): Write it lands on the ask box (X10-3); type, pick the last day, Save.
 dict(name='staff: write the public ask -> saved', app=STAFF, budget=4, start='#/bill/HB1523/public?ask=1', desk=True, steps=[
   dict(what='type the ask', fill=('#bw-pact', 'Please speak up for kids this week.'), reach="(()=>document.getElementById('bw-pact')?.value.length>10)()"),
   dict(what='pick the last day it shows', fill=('#bw-puntil', '2099-12-31'), reach="(()=>document.getElementById('bw-puntil')?.value==='2099-12-31')()"),
   dict(what='save', do="(()=>{const b=[...document.querySelectorAll('.bw-pubsave .btn,[type=submit]')].filter(x=>x.offsetParent&&/Save/i.test(x.innerText))[0]; if(!b) return false; b.click(); return true;})()",
        reach="(()=>/Public page saved/i.test(document.getElementById('toast')?.innerText||''))()"),
 ]),
 # X10-7: the phone's bill search (a bill number in hand, on a phone, which the staff journey above covers only at a desk)
 dict(name='public: a bill number in hand -> that bill page', app=PUBLIC, budget=2, start='#/find', skip_wizard=True, steps=[
   dict(what='type the number', fill=('#q', 'HB2121'), reach="(()=>document.getElementById('q')?.value==='HB2121')()"),
   dict(what='open the bill', do="(()=>{const a=[...document.querySelectorAll('main a[href*=\"#/bill/\"]')].find(x=>/2121/.test(x.getAttribute('href')+x.innerText)); if(!a)return false; a.click(); return true;})()",
        reach="(()=>/#\\/bill\\/(2026\\/)?HB2121/i.test(location.hash))()"),
 ]),
]

def run_one(br, j):
    # A phone unless the journey says it is done at a desk (`desk`: a 1440x900 window with a mouse).
    c = br.new_context(viewport={'width': 1440, 'height': 900}) if j.get('desk') else br.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
    if not j.get('tour'): c.add_init_script(TOUR_SEEN)   # past the bill page tour (tests/bill_tour.py); `tour` journeys meet it as a person would
    p = c.new_page(); errs = []
    p.on('pageerror', lambda e: errs.append(str(e)[:120]))
    p.goto(j['app'] + '#/'); p.wait_for_timeout(4000)
    if j.get('skip_wizard'):                     # a returning visitor who is past onboarding
        p.evaluate("try{localStorage.setItem('hiphi_wiz',JSON.stringify({done:true,issues:['tobacco']}));"
                   "localStorage.setItem('hiphi_watch_ids_demo',JSON.stringify("
                   "['5f8d9c39-8a21-415c-a725-2b4dbc8cb7d9','8ef79794-9605-4c2c-924f-0f706ab99f8d']));}catch(e){}")
    if j.get('pick_cat'):                        # a newcomer who ticked the first category on the first screen
        p.goto(j['app'] + '#/start/1'); p.wait_for_timeout(1500)
        p.evaluate("document.querySelector('[data-stissue]')?.click()")
    p.goto(j['app'] + j['start']); p.reload(); p.wait_for_timeout(2800)
    if j.get('walk_to'):                         # getting to where the journey starts; these taps are not counted
        for _ in range(16):
            if p.evaluate(j['walk_to']): break
            if p.locator('#fx-moment:not([hidden]) #fx-mgo').count(): p.click('#fx-mgo')
            else:
                at = p.evaluate('location.hash')
                if p.locator('.st-bar [data-stnext]:visible').count(): p.click('.st-bar [data-stnext]')
                p.wait_for_timeout(1200)
                if p.evaluate('location.hash') == at and not p.locator('#fx-moment:not([hidden])').count() \
                   and p.locator('.st-bar [data-stskip]:visible').count(): p.click('.st-bar [data-stskip]')
            p.wait_for_timeout(1500)
    steps, failed = 0, None
    for s in j['steps']:
        # A step is a click done in the page (`do`), or real typing (`fill`) or a real key press (`press`) into a field,
        # so a form's own Enter handling is what is tested rather than a script calling it.
        try:
            if 'fill' in s: p.fill(*s['fill']); did = True
            elif 'press' in s: p.press(*s['press']); did = True
            else: did = p.evaluate(s['do'])
        except Exception as e: did = False
        if did is False: failed = f"could not: {s['what']}"; break
        p.wait_for_timeout(1600)
        if not p.evaluate(s['reach']): failed = f"did not arrive after: {s['what']}"; break
        steps += 1
    p.screenshot(path=os.path.join(OUT, j['name'].replace(':', '').replace(' ', '_').replace('>', '')[:60] + '.png'))
    c.close()
    return dict(name=j['name'], budget=j['budget'], steps=steps, total=len(j['steps']),
                ok=failed is None, failed=failed, errors=errs[:2])

def main():
    res = []
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        for j in JOURNEYS: res.append(run_one(b, j))
        b.close()
    if '--json' in sys.argv: print(json.dumps(res, indent=1)); return
    print(f'{"journey":52} {"steps":>6} {"budget":>7}  result')
    print('-' * 88)
    bad = 0
    for r in res:
        mark = 'ok' if r['ok'] and r['steps'] <= r['budget'] else ('OVER BUDGET' if r['ok'] else 'BROKEN')
        if mark != 'ok': bad += 1
        print(f'{r["name"][:52]:52} {r["steps"]:>6} {r["budget"]:>7}  {mark}'
              + (f'  - {r["failed"]}' if r['failed'] else ''))
    print(f'\n{len(res)-bad}/{len(res)} journeys within budget and working.   screenshots: {OUT}')
    print('budgets: DESIGN.md B-2.  A broken journey is a flow regression, not a flaky test.')

main()
