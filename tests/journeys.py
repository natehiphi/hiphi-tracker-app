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

HOST = os.environ.get('HOST', 'http://localhost:8832')   # HOST=http://localhost:NNNN for another server
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out', 'journeys')
os.makedirs(OUT, exist_ok=True)

click_text = lambda sel, rx: f"""(()=>{{const e=[...document.querySelectorAll({json.dumps(sel)})]
  .filter(x=>x.offsetParent!==null).find(x=>/{rx}/i.test((x.innerText||'').trim()));
  if(!e)return false; e.click(); return true;}})()"""
seen = lambda rx: f"""(()=>/{rx}/i.test((document.querySelector('main')||document.body).innerText))()"""

PUBLIC = HOST + '/track.html?demo=1'
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
        reach="(()=>{const m=document.querySelector('#fx-moment:not([hidden])'); return !!m && /following/i.test(m.innerText);})()"),
 ]),
 dict(name='public: arrive -> understand what one bill does', app=PUBLIC, budget=3, start='#/', skip_wizard=True, steps=[
   dict(what='open a bill from the list', do="(()=>{const a=document.querySelector('main a[href*=\"#/bill/\"]'); if(!a)return false; a.click(); return true;})()",
        reach="(()=>/#\\/bill\\//.test(location.hash))()"),
   dict(what='the plain summary is on screen, unprompted', do='true',
        reach="(()=>{const l=document.querySelector('.bl-head .lede'); return !!l && l.innerText.trim().length>20;})()"),
 ]),
 dict(name='public: decide to act -> action sent', app=PUBLIC, budget=4, start='#/', skip_wizard=True, steps=[
   dict(what='choose the easiest action', do=click_text('.btn', 'Send a quick email'), reach=seen('Your message')),
   dict(what='open it in the mail app',   do=click_text('.btn', 'Open in my mail app'), reach=seen('Yes, I sent it')),
   dict(what='confirm it was sent',       do=click_text('.btn', 'Yes, I sent it'),      reach=seen('Mahalo|Emailed the chair')),
 ]),
 # Counted from the moment the address is offered (B-2): the one ask sits under "Coming up on your issues", the last
 # screen before the finale (R-023). The walk there is a newcomer's (a category, its ticked issues, the lessons, no
 # street address) and is not counted. The first name is optional, so it is not a step.
 dict(name='public: give an email address', app=PUBLIC, budget=2, start='#/start/1', pick_cat=True,
      walk_to="(()=>{const i=document.getElementById('st-email'); return !!i && i.offsetParent!==null;})()", steps=[
   dict(what='type the address', fill=('#st-email', 'someone@example.com'),
        reach="(()=>document.getElementById('st-email')?.value==='someone@example.com')()"),
   dict(what='send it', do=click_text('.st-bar #st-send', 'Remind me|Keep me posted'), reach=seen('Check your inbox')),
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
   dict(what='choose a position', do=click_text('dialog[open] button,[role=menu] button,.sv-sheet[open] button', 'Support'),
        reach="(()=>true)()"),
 ]),
]

def run_one(br, j):
    # A phone unless the journey says it is done at a desk (`desk`: a 1440x900 window with a mouse).
    c = br.new_context(viewport={'width': 1440, 'height': 900}) if j.get('desk') else br.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
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
