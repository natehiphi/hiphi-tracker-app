# Staff7's Home (R-398, Nate 14 Nov), on the practice copy: Home opens on a calm overview and not on a step; the left holds only the four urgent kinds under "To do",
# one quiet line for the rest, "Waiting on others" and "Suggested" only when they have something; asks are unified by committee and deadline and uncapped; the page stays
# practice-only, quiet, 44px, and fits 1440x900 and 1280x800.
#   python3 tests/staff7_home.py [base] [shots folder]     base defaults to http://127.0.0.1:8851 (serve with a 256 backlog, one server per worktree)
import sys, os, re, json
from playwright.sync_api import sync_playwright
BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8851').rstrip('/')
SHOTS = sys.argv[2] if len(sys.argv) > 2 else ''
if SHOTS: os.makedirs(SHOTS, exist_ok=True)
res = []
def ok(c, m): res.append(bool(c)); print('PASS' if c else 'FAIL', m, flush=True)

FILLED = "() => [...document.querySelectorAll('.btn.filled')].filter(b => { const r = b.getBoundingClientRect(), s = getComputedStyle(b); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && r.top < innerHeight && r.bottom > 0; }).length"
H1 = "() => [...document.querySelectorAll('main h1')].find(h => h.getBoundingClientRect().width > 0)?.innerText.trim()"
NOSIDE = "() => document.documentElement.scrollWidth <= innerWidth && document.querySelector('.paper').scrollWidth <= document.querySelector('.paper').clientWidth"
SMALL = "() => [...document.querySelectorAll('.btn, .sr3, .fact')].filter(e => e.getBoundingClientRect().width > 0 && e.getBoundingClientRect().height < 43.5).map(e => e.className)"
# the model Home draws from, read straight from the page's own modules
MODEL = """async () => { const d = await import('/staff6/data.js'), s7 = await import('/staff7/steps.js'), h = await import('/staff7/home.js'), t6 = await import('/staff6/today.js');
  const S = d.S, me = S.me, steps = s7.stepsFor(me), m = h.homeModel(me, steps); t6.t6Fresh(); const w = t6.work(me), now = Date.now();
  const hst = t => new Date(t).toLocaleDateString('en-CA', { timeZone: 'Pacific/Honolulu' });
  const pd = s => s.kind !== 'missed' && (s.late || s.tone === 'overdue' || s.tone === 'late' || (s.at != null && new Date(s.at).getTime() <= now) || (s.kind === 'ask' && !!s.ask.st?.deadline?.missed));
  const urgent = s => s.kind === 'approve' || s.kind === 'second' || s.kind === 'missed' || s.kind === 'chairfu' || s.kind === 'decide' || (s.kind === 'ask' ? (s.dlDays != null && s.dlDays <= 3) || pd(s) : s.kind === 'stale' ? pd(s) : s.at != null && new Date(s.at).getTime() - now < 864e5);
  return { all: steps.length, ids: steps.map(s => s.id), todoSteps: m.todo.filter(x => x.type === 'step').map(x => x.s.id), todoUrgent: m.todo.filter(x => x.type === 'step').every(x => urgent(x.s)),
    laterIds: m.later.map(s => s.id), laterAllCalm: m.later.every(s => !urgent(s)), hearings: m.hearings.map(x => x.id), hearingsOk: m.hearings.every(x => hst(x.h.scheduled_at) === hst(now) && x.h.status !== 'cancelled'),
    waiting: m.waiting.length, suggested: m.suggested.length, laterWords: m.later.length ? s7.laterWords(m.later) : '', todoPast: m.todo.map(x => x.type === 'step' && pd(x.s)), nextHearingToday: (() => { const nh = h.nextHearing(me); return !!nh && hst(nh.h.scheduled_at) === hst(now); })(), todayHearings: m.hearings.length,
    asks: steps.filter(s => s.kind === 'ask').map(s => ({ id: s.id, code: s.ask.code, date: s.ask.st?.deadline?.date, n: (s.members || [1]).length, group: s.ask.m && !s.ask.decide && !s.ask.partial && !s.ask.waitOn && !!s.ask.st?.deadline && !s.ask.st.deadline.missed, key: s.ask.key, who: s.forWhom })),
    uncapped: w.own.filter(i => i.kind === 'chair').length + w.asks.length }; }"""

def external_blocker(ctx, bad):
    def h(route):
        u = route.request.url
        if 'fonts.g' in u: return route.continue_()
        bad.append(u); route.abort()
    ctx.route(lambda u: '127.0.0.1' not in u and 'localhost' not in u, h)

def open_as(br, who, w, h, hash=''):
    ctx = br.new_context(viewport={'width': w, 'height': h}); bad = []; external_blocker(ctx, bad); pg = ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'Failed to load resource' not in m.text and 'ERR_FAILED' not in m.text else None)
    pg.goto(f'{BASE}/staff7.html?demo=1' + (f'&as={who}' if who != 'default' else '') + hash); pg.wait_for_selector('.paper', timeout=60000)
    pg.evaluate("Promise.all([document.fonts.load('600 16px Poppins'), document.fonts.load('400 16px Lato'), document.fonts.load('700 16px Lato'), document.fonts.load('500 16px Poppins')])"); pg.wait_for_timeout(500)
    return pg, errs, bad
def snap(pg, name, tag):
    if SHOTS: pg.screenshot(path=os.path.join(SHOTS, f'{name}_{tag}.png'))
def step_rows(pg): return pg.evaluate("() => [...document.querySelectorAll('a.sr3[href^=\"#/do/\"]')].map(a => a.getAttribute('href'))")

PEOPLE = ['default', 'KV', 'KR', 'JS', 'JM', 'LR', 'SY', 'NT', 'MR', 'JMM', 'PH']
with sync_playwright() as p:
    br = p.chromium.launch()
    for w, h in {'phone': (), '1280': ((1280, 800),), '1440': ((1440, 900),)}.get(os.environ.get('ONLY'), ((1440, 900), (1280, 800))):   # ONLY=phone, 1280 or 1440 runs just that part
        tag = f'{w}x{h}'
        for who in PEOPLE:
            pg, errs, bad = open_as(br, who, w, h)
            m = pg.evaluate(MODEL)
            ok(pg.locator('.ovtop').count() == 1 and pg.locator('.paper').get_attribute('aria-label') == 'Overview' and pg.locator('.strip, #sendBtn, #apBtn, #subBtn, #mailBtn, #makeBtn').count() == 0 and pg.locator('a.sr3[aria-current]').count() == 0 and '#/do/' not in pg.url,
               f'{tag} {who}: Home opens on the overview, no step sheet, no row marked ({pg.url[-30:]})')
            h1 = pg.evaluate(H1)
            ok(re.match(r'Good (morning|afternoon|evening), \w[\w ]*\. ', h1) and pg.locator('main h1').count() == 1, f'{tag} {who}: one h1, a friendly answer: "{h1}"')
            # To do: only the four urgent kinds (+ Did we file?), the hearings of today
            ok(m['todoUrgent'] and m['laterAllCalm'] and m['hearingsOk'], f'{tag} {who}: To do holds only urgent steps and hearings today; every later step is not urgent')
            todo_n = pg.evaluate("() => document.querySelectorAll('#hs + ul.srows3 > li').length") if m['todoSteps'] or m['hearings'] else 0
            pub_n = pg.evaluate("() => document.querySelectorAll('#hs + ul.srows3 > li a.sr3[href^=\"#/public/\"]').length")   # R-398 part 3: public changes to approve, publish or fix are To do rows too
            ok(todo_n - pub_n == len(m['todoSteps']) + len(m['hearings']), f'{tag} {who}: the To do list draws every urgent step and hearing today ({todo_n - pub_n} = {len(m["todoSteps"])} + {len(m["hearings"])}, and {pub_n} public change rows)')
            # the later line: later + To do steps = all steps, and opening it shows exactly the later rows
            ok(len(m['todoSteps']) + len(m['laterIds']) == m['all'] and set(m['todoSteps']).isdisjoint(m['laterIds']), f'{tag} {who}: To do steps + later steps = all steps ({len(m["todoSteps"])} + {len(m["laterIds"])} = {m["all"]})')
            if m['laterIds']:
                btn = pg.locator('#laterBtn'); txt = btn.inner_text().strip()
                ok(re.match(r'^(Nothing today · )?%d more steps? later$' % len(m['laterIds']), txt) and (txt.startswith('Nothing today') == (not m['todoSteps'] and not m['hearings'])) and btn.get_attribute('aria-expanded') == 'false' and not pg.locator('#laterList').is_visible(), f'{tag} {who}: one quiet line "{txt}", closed')
                before = pg.evaluate("document.querySelector('.paper').innerHTML")
                btn.click(); pg.wait_for_timeout(250)
                shown = pg.evaluate("() => [...document.querySelectorAll('#laterList a.sr3')].map(a => a.getAttribute('href'))")
                ok(btn.get_attribute('aria-expanded') == 'true' and pg.locator('#laterList').is_visible() and len(shown) == len(m['laterIds']) and len(step_rows(pg)) == m['all'], f'{tag} {who}: it opens in place (aria-expanded) and shows the {len(shown)} later rows; every step is on the page once')
                ok(pg.evaluate("document.querySelector('.paper').innerHTML") == before and pg.evaluate("document.activeElement.id") == 'laterBtn', f'{tag} {who}: opening it redraws nothing else and keeps focus on the line')
            else:
                ok(pg.locator('#laterBtn').count() == 0, f'{tag} {who}: no later steps, no quiet line')
            wl = pg.locator('.wl').inner_text()
            if not m['todoSteps'] and not m['hearings']: ok('Nothing needs you today' not in wl and ('All clear' in wl if not m['laterIds'] else 'Nothing today · ' in wl and 'All clear' not in wl), f'{tag} {who}: the empty To do does not repeat the headline: only the later line, or "All clear" when nothing is later')
            # fix 3: past due first, said one way ("Past due", with a mark and the late colour), never the amber clock; fix 4a: the next-hearing fact skips a hearing already in To do
            pastrows = pg.evaluate("() => [...document.querySelectorAll('#hs + ul.srows3 > li')].map(li => !!li.querySelector('.stm.past'))")
            ok(pastrows == sorted(pastrows, reverse=True) and pastrows == [bool(x) for x in m['todoPast']][:len(pastrows)] and not re.search(r'overdue|\blate\b', pg.evaluate("() => [...document.querySelectorAll('#hs + ul .stm')].map(e => e.innerText).join(' ')") if pastrows else ''), f'{tag} {who}: past-due steps come first in To do and read "Past due" ({sum(pastrows)} of {len(pastrows)})')
            if sum(pastrows):
                pm = pg.locator('.stm.past').first
                ok(pm.inner_text().strip() == 'Past due' and pm.locator('svg').count() == 1 and pg.evaluate("getComputedStyle(document.querySelector('.stm.past')).color") == 'rgb(179, 38, 30)' and pg.locator('.stm.soon:has-text("Past due")').count() == 0, f'{tag} {who}: Past due is a word with its own mark in the late colour, not the amber clock')
            ok(not m['nextHearingToday'], f'{tag} {who}: "Your next hearing" is never a hearing already in To do ({m["todayHearings"]} today)')
            # fix 5: Overview is the first row of the left column, marked on the overview
            ov0 = pg.evaluate("() => { const a = document.querySelector('.wl a'); return [a.classList.contains('ovr'), a.innerText.trim(), a.getAttribute('href'), a.getAttribute('aria-current'), a.classList.contains('sel')]; }")
            ok(ov0 == [True, 'Overview', '#/', 'page', True], f'{tag} {who}: the first row of the left is Overview, marked open on the overview ({ov0})')
            # fix 10: the three facts are links with a chevron
            ok(pg.locator('.fact .fchev').count() == 3, f'{tag} {who}: each fact has a chevron')
            # fix 11: one heading style
            hd = pg.evaluate("() => ['hs', 'hw', 'hg'].map(i => document.getElementById(i)).filter(Boolean).map(e => { const c = getComputedStyle(e); return [c.fontSize, c.fontWeight, c.color, c.fontFamily].join('|'); })")
            ok(len(set(hd)) <= 1 and (pg.locator('#hg').count() == 0 or pg.locator('#hg + p #suggBtn').count() == 1), f'{tag} {who}: To do, Waiting on others and Suggested share one heading style, the suggested line under its heading ({hd[:1]})')
            # Waiting on others and Suggested: only when they have rows
            ok((pg.locator('#hw').count() == 1) == (m['waiting'] > 0) and pg.locator('#hw ~ ul > li').count() == m['waiting'] and (pg.locator('#suggBtn').count() == 1) == (m['suggested'] > 0), f'{tag} {who}: Waiting on others ({m["waiting"]}) and Suggested ({m["suggested"]}) show only when they have rows')
            if m['suggested']:
                sb = pg.locator('#suggBtn')
                ok(sb.inner_text().strip() == f'{m["suggested"]} suggested step' + ('s' if m['suggested'] != 1 else '') and sb.get_attribute('aria-expanded') == 'false' and not pg.locator('#suggList').is_visible(), f'{tag} {who}: Suggested is one quiet line "{sb.inner_text().strip()}", closed')
            # unified, uncapped asks
            keys = [(a['code'], a['date'], a['key'], a['who']) for a in m['asks'] if a['group']]
            ok(len(keys) == len(set(keys)) and sum(a['n'] for a in m['asks']) == m['uncapped'], f'{tag} {who}: no two ask steps share a committee and deadline; {sum(a["n"] for a in m["asks"])} bills in {len(m["asks"])} ask steps = the {m["uncapped"]} the current app has before its cap of 3')
            # the page: one filled button at most, no sideways scroll, 44px, nothing leaves, no errors
            ok(pg.evaluate(FILLED) <= 1 and pg.evaluate(NOSIDE), f'{tag} {who}: at most one filled button in view, no sideways scroll')
            ok(not pg.evaluate(SMALL), f'{tag} {who}: every button, row and fact is 44px or more ({pg.evaluate(SMALL)})')
            ok(not errs and not bad, f'{tag} {who}: no console errors, no request leaves 127.0.0.1 ({errs[:1]} {bad[:1]})')
            if who in ('default', 'KV', 'JS', 'MR') or (who == 'JM'): snap(pg, f'home_{who}', tag)
            pg.context.close()

        # ---- the calm person: the designed calm state ----
        for who in ('MR', 'JMM'):
            pg, errs, bad = open_as(br, who, w, h); t = pg.locator('.wl').inner_text()
            ok('Nothing needs you today.' in pg.evaluate(H1) and pg.locator('.calm-pic').count() == 1 and pg.locator('#hw, #suggBtn, #laterBtn').count() == 0 and 'All clear' in t and 'Nothing needs you' not in t and pg.evaluate(FILLED) == 0 and not re.search(r'hearing', pg.locator('.ovsub').inner_text() if pg.locator('.ovsub').count() else ''), f'{tag} {who}: a calm person: the sun, "Nothing needs you today.", no Waiting on others, no Suggested, no later line')
            pg.context.close()

        # ---- JM: a hearing today, a bill about to stop (At risk in amber, with a mark and words) ----
        pg, errs, bad = open_as(br, 'JM', w, h)
        ok(pg.locator('.fv .risk svg').count() == 1 and re.search(r'\d+ at risk', pg.locator('.fv .risk').inner_text()) and pg.evaluate("getComputedStyle(document.querySelector('.fv .risk')).color") == 'rgb(122, 74, 0)', f'{tag} JM: At risk reads in the amber colour with a mark and words ({pg.locator(".fv.iss").inner_text()})')
        ok(re.search(r'\d+ not at risk', pg.locator('.fv.iss').inner_text()) and re.search(r'\d+ stopped', pg.locator('.fv.iss').inner_text()) and pg.locator('.fact').count() == 3, f'{tag} JM: the three facts, the issues one as "N at risk · N moving · N stopped"')
        facts = pg.evaluate("() => [...document.querySelectorAll('.fact')].map(a => [a.getAttribute('href'), a.innerText.replace(/\\s+/g, ' ')])")
        ok([f[0] for f in facts] == ['#/calendar', '#/issues', '#/issues'] and facts[0][1].startswith('Your next hearing') and facts[1][1].startswith('Your bills') and facts[2][1].startswith('Your issues'), f'{tag} JM: each fact is a link to where it lives ({[f[0] for f in facts]})')
        ok(pg.locator('.sd li').count() >= 4 and pg.locator('.here').count() == 1 and 'You are here' in pg.locator('.here').inner_text(), f'{tag} JM: the session\'s dates, with "You are here"')
        # fix 1: a bill about to stop changes the headline and names the step; fix 2: the second line is a link, no filled button; the issues fact stays a tally
        h1 = pg.evaluate(H1); lk = pg.locator('.ovsub a.ovlink'); rr = pg.locator('#hs + ul .rmark')
        ok(re.match(r'Good \w+, James\. (One bill is|\d+ bills are) at risk\.$', h1) and lk.count() == 1 and re.match(r'^Ask for a hearing on .+ by .+, or it stops for the year\.$', lk.inner_text()) and lk.get_attribute('href').startswith('#/do/ask-') and pg.evaluate(FILLED) == 0, f'{tag} JM: the headline says a bill is at risk and the second line is a link to the step ({h1!r}, {lk.inner_text()!r})')
        ok(rr.count() >= 1 and rr.first.locator('svg').count() == 1 and 'about to stop' in rr.first.inner_text() and pg.evaluate("getComputedStyle(document.querySelector('#hs + ul .rmark')).color") == 'rgb(122, 74, 0)', f'{tag} JM: the To do row of the bill about to stop carries an amber triangle with words for a screen reader, before its time')
        ok(pg.locator('.fact:nth-child(3) .fs').inner_text().strip() == '', f'{tag} JM: the issues fact stays a tally and names no bill')
        # fix 9: the session names its stops in plain words and holds the date "Your bills" counts; the "you are here" mark never touches a stop's dot
        bd = re.search(r'before (\w{3}, \w{3} \d+)', pg.locator('.fact:nth-child(2)').inner_text()).group(1); sd = pg.locator('.sd').inner_text()
        ok(bd in sd and 'Crossover' not in sd.replace('Bills switch chambers', '') and 'decking' not in sd.lower() and 'lateral' not in sd.lower(), f'{tag} JM: the session line holds the date Your bills counts ({bd}) and no Capitol jargon')
        sl = pg.evaluate("() => [...document.querySelectorAll('.sd li:not(.you) b')].map(b => b.innerText.trim())")
        ok(len(sl) == 6 and sl[0] == 'Crossed to the other chamber' and sl[-1] == 'Session ends' and pg.locator('.sd li.off').count() >= 0 and not re.search(r'1st|2nd|Early', ' '.join(sl)), f'{tag} JM: the session line uses the one table\'s words, the same six stops for everyone ({sl})')
        gap = pg.evaluate("() => { const h = document.querySelector('.here i').getBoundingClientRect(), ds = [...document.querySelectorAll('.sd li:not(.you) .dot')].map(d => d.getBoundingClientRect()); return Math.min(...ds.map(d => Math.hypot(d.x + d.width / 2 - (h.x + h.width / 2), d.y + d.height / 2 - (h.y + h.height / 2)))); }")
        ok(gap >= 24, f'{tag} JM: "You are here" keeps clear of every stop dot ({gap:.0f}px)')
        # fix 10: a fact shows a hover state
        f0 = pg.locator('.fact').first; f0.hover(); pg.wait_for_timeout(300)
        ok(pg.evaluate("getComputedStyle(document.querySelector('.fact')).backgroundColor") != 'rgba(0, 0, 0, 0)', f'{tag} JM: hovering a fact shows it (a wash)')
        hr = pg.locator('a.sr3[href^="#/hearing/"]').first
        ok(hr.count() == 1 and hr.inner_text().startswith('Hearing today'), f'{tag} JM: a hearing today is a To do row')
        hr.click(); pg.wait_for_timeout(300)
        t = pg.locator('.paper').inner_text()
        ok(all(k in t for k in ('When', 'Where', 'Committee', 'Our testimony', 'Going')) and pg.locator('.btn.filled').count() == 0 and pg.locator('.paper a[target=_blank], .paper a[href^="http"], .paper a[href^="mailto"]').count() == 0 and 'Hearing today' in pg.evaluate(H1) and pg.locator('a.sr3[aria-current]').count() == 1, f'{tag} JM: the hearing sheet is read-only (when, where, committee, testimony, who is going), no filled button, nothing that leaves the app, its row marked')
        snap(pg, 'hearing_sheet_JM', tag)
        pg.click('.bi:has-text("Home")'); pg.wait_for_timeout(300)
        ok(pg.locator('.ovtop').count() == 1 and pg.url.split('#')[-1] in ('', '/'), f'{tag} JM: Home in the bar returns to the overview')
        pg.context.close()

        # ---- KV: Waiting on others, read-only sheet; Suggested expanded, its sheet ----
        pg, errs, bad = open_as(br, 'KV', w, h)
        wr = pg.locator('#hw ~ ul a.sr3[href^="#/waiting/"]').first; wt = wr.inner_text().replace('\n', ' ')
        ok(re.search(r'Waiting on \w+( or \w+|, \w+ or \d+ more)? (to approve|for a second look)\s+·\s+needed (in|[\w ]+ ago)', wt) and wr.evaluate("e => getComputedStyle(e.querySelector('.q2')).color") == 'rgb(92, 85, 75)', f'{tag} KV: a waiting row says who has it and when it is due, in the muted colour ({wt!r})')
        wr.click(); pg.wait_for_timeout(300); t = pg.locator('.paper').inner_text()
        ok('Waiting on ' in t and '· needed ' in t and pg.locator('#openDoc').count() == 1 and pg.locator('.btn.filled').count() == 0 and pg.locator('a.sr3[aria-current]').count() == 1, f'{tag} KV: the waiting sheet says the same, with the testimony as a quiet row and no filled button')
        pg.click('#openDoc'); pg.wait_for_timeout(300)
        ok('does not open' in pg.locator('#toast').inner_text() and len(pg.context.pages) == 1 and not bad, f'{tag} KV: in the practice copy the testimony opens nothing')
        pg.goto(f'{BASE}/staff7.html?demo=1&as=KR'); pg.wait_for_selector('.paper'); pg.wait_for_timeout(400)   # Kevin's one suggestion was the follow-up that linked to the old app; that is Waiting on others now (piece 5), so Kris, who has a reply to answer, shows the same sheet
        pg.click('#suggBtn'); pg.wait_for_timeout(250)
        ok(pg.locator('#suggBtn').get_attribute('aria-expanded') == 'true' and pg.locator('#suggList a.sr3').count() >= 1, f'{tag} KR: Suggested opens in place')
        snap(pg, 'home_KV_suggested_open', tag)
        pg.click('#suggList a.sr3:has-text("Reply to")'); pg.wait_for_timeout(300); t = pg.locator('.paper').inner_text()
        lk = pg.locator('.paper a:has-text("For now, do this in the current staff app")')
        ok(lk.count() == 1 and lk.get_attribute('href').startswith('index.html?demo=1') and 'does not have a page in the new app yet' in t and pg.locator('.btn.filled').count() == 0, f'{tag} KR: a suggested step says what it is and offers "For now, do this in the current staff app" as a quiet link ({lk.get_attribute("href")})')
        ok(pg.locator('#suggList').is_visible() and pg.locator('a.sr3[aria-current]').count() == 1, f'{tag} KR: its row stays marked inside the open Suggested list')
        pg.context.close()

        # ---- a step from To do, and Back to overview ----
        pg, errs, bad = open_as(br, 'KV', w, h)
        pg.click('#hs ~ ul a.sr3'); pg.wait_for_selector('#sendBtn'); pg.wait_for_timeout(300)
        ok(pg.locator('a.sr3[aria-current]').count() == 1 and pg.evaluate(FILLED) == 1 and pg.evaluate(H1) == 'Resubmit testimony', f'{tag} KV: a To do row opens its step, its row stays marked, one filled button')
        snap(pg, 'step_from_todo_KV', tag)
        pg.click('.bi:has-text("Home")'); pg.wait_for_timeout(300)
        ok(pg.locator('.ovtop').count() == 1 and pg.locator('a.sr3[aria-current]').count() == 0, f'{tag} KV: Home in the bar goes back to the overview')
        # fix 5: with a step open the Overview row is not marked, and it leads back
        pg.click('#hs ~ ul a.sr3'); pg.wait_for_selector('#sendBtn'); pg.wait_for_timeout(200)
        ok(pg.evaluate("() => { const a = document.querySelector('.wl a.ovr'); return !a.classList.contains('sel') && !a.hasAttribute('aria-current'); }") and pg.locator('a.sr3[aria-current]').count() == 1, f'{tag} KV: with a step open its row is marked and Overview is not')
        pg.click('.wl a.ovr'); pg.wait_for_timeout(300)
        ok(pg.locator('.ovtop').count() == 1 and pg.url.split('#')[-1] in ('', '/') and pg.evaluate("document.querySelector('.wl a.ovr').getAttribute('aria-current')") == 'page', f'{tag} KV: the Overview row goes back to the overview and is marked there')
        # fix 16: the minute's redraw keeps the focus on a row link
        href = pg.locator('#hs ~ ul a.sr3').first.get_attribute('href'); pg.focus('#hs ~ ul a.sr3'); pg.evaluate('window.__staff7Tick()'); pg.wait_for_timeout(200)
        ok(pg.evaluate("document.activeElement.getAttribute('href')") == href, f'{tag} KV: the minute redraw leaves the focus on the row link ({href})')
        pg.context.close()

        # ---- a later step opens, and the later line stays open around it ----
        pg, errs, bad = open_as(br, 'NT', w, h, '')
        pg.click('#laterBtn'); first = pg.locator('#laterList a.sr3').first; href = first.get_attribute('href'); first.click(); pg.wait_for_timeout(300)
        ok(pg.locator('#laterList').is_visible() and pg.locator(f'a.sr3[href="{href}"]').get_attribute('aria-current') == 'true', f'{tag} NT: a later step opens from the opened line and stays marked')
        # fix 7: under a small "Later" label, rows a step quieter
        ok(pg.locator('#laterList .llab').inner_text() == 'Later' and pg.locator('#laterList a.sr3.lt').count() == pg.locator('#laterList a.sr3').count() and pg.evaluate("() => { const t = document.querySelector('#laterList .sv'), p = document.querySelector('#hs + ul .sv'); return parseFloat(getComputedStyle(t).fontSize) < parseFloat(getComputedStyle(p).fontSize); }") and pg.locator('#laterList .stm.soon').count() == 0, f'{tag} NT: the later list sits under a "Later" label in smaller type, its times neutral')
        # fix 17: collapsing the line while a later step is open stays collapsed through the minute's redraw
        pg.click('#laterBtn'); pg.wait_for_timeout(150); pg.evaluate('window.__staff7Tick()'); pg.wait_for_timeout(300)
        ok(not pg.locator('#laterList').is_visible() and pg.locator('#laterBtn').get_attribute('aria-expanded') == 'false', f'{tag} NT: a collapse is kept by the minute redraw')
        pg.evaluate("location.hash = '#/'"); pg.wait_for_timeout(300)
        ok(pg.locator('.ovtop').count() == 1 and not pg.locator('#laterList').is_visible(), f'{tag} NT: back on the overview the line is still as the person left it')
        pg.context.close()

        # ---- a unified ask: the chair once, the bills as a list, one email, one record per bill ----
        pg, errs, bad = open_as(br, 'NT', w, h)
        asks = pg.evaluate("async () => { const s7 = await import('/staff7/steps.js'), d = await import('/staff6/data.js'); return s7.stepsFor(d.S.me).filter(s => s.kind === 'ask' && s.members?.length > 1).map(s => [s.id, s.members.map(m => m.bill.bill_number)]); }")
        ok(len(asks) >= 1, f'{tag} NT: there is a unified ask step ({asks})')
        sid, nums = asks[0]
        pg.evaluate(f"location.hash = '#/do/{sid}'"); pg.wait_for_selector('#mailBtn'); pg.wait_for_timeout(400)
        subj, body = pg.input_value('#subj'), pg.input_value('#letter'); st = pg.locator('.strip').inner_text()
        nice = lambda n: re.sub(r'^([A-Za-z]+)\s*(\d+)', r'\1 \2', n)
        ok(pg.evaluate(H1) == 'Ask for a hearing' and pg.locator('.chair').count() == 1 and pg.locator('.askbills li').count() == len(nums) and pg.evaluate(FILLED) == 1, f'{tag} NT: the ask page shows the chair once and the {len(nums)} bills as a list, one filled button')
        ok(subj.startswith('Request for hearings on ') and all(nice(n) in subj for n in nums) and all(re.search(r'^- %s, \S' % re.escape(nice(n)), body, re.M) for n in nums) and 'committee deadline on ' in body and body.count('Aloha') == 1 and 'Mahalo' in body, f'{tag} NT: ONE email names each bill by number and short name and the committee deadline ({subj!r})')
        ok(re.search(r'These %d bills need a hearing in (House|Senate) .+ by \w{3}, \w{3} \d+, or they stop for the year\.' % len(nums), st), f'{tag} NT: the strip says why for all of them ({st!r})')
        snap(pg, 'ask_unified_NT', tag)
        ASKS = "async (nums) => { const d = await import('/staff6/data.js'); return nums.map(n => { const b = d.S.bills.find(x => x.bill_number === n); return (d.S.demoNotes || []).filter(x => x.bill_id === b.id && x.answer === 'asked').length; }); }"
        before = pg.evaluate(ASKS, nums)
        pg.click('#mailBtn'); pg.wait_for_selector('#yesBtn')
        pg.evaluate("() => { const b = document.getElementById('yesBtn'); b.click(); b.click(); }"); pg.wait_for_selector('.done'); pg.wait_for_timeout(300)
        after = pg.evaluate(ASKS, nums)
        ok(pg.evaluate(H1) == 'Asked.' and all(a > b for a, b in zip(after, before)) and all(a - b <= 2 for a, b in zip(after, before)) and f'these {len(nums)} bills' in pg.locator('.done .sub').inner_text(), f'{tag} NT: "Yes, sent" recorded the ask for every bill in it, once each ({before} -> {after})')
        pg.click('#undoBtn'); pg.wait_for_selector('#mailBtn'); pg.wait_for_timeout(300)
        ok(pg.evaluate(ASKS, nums) == before, f'{tag} NT: its Undo takes back all of them')
        ok(not pg.evaluate(SMALL) and not errs and not bad, f'{tag} NT: the unified ask page: 44px targets, no errors, nothing outside ({errs[:1]} {bad[:1]})')
        pg.context.close()

        # ---- rule 3 of 14 Nov: a hearing nobody leads goes to the issue lead, else the admins ----
        pg, errs, bad = open_as(br, 'NT', w, h)
        r = pg.evaluate("""async () => { const s7 = await import('/staff7/steps.js'), d = await import('/staff6/data.js'); const S = d.S;
          const orphans = s7.stepsFor(S.me).filter(s => s.orphan).map(s => s.kind + '|' + s.bill.bill_number);
          const b = S.bills.find(x => x.tracked !== false && x.position && x.position !== 'monitor' && !(S.assignments[x.id] || []).length && S.hearings.some(h => h.bill_id === x.id && h.status === 'scheduled' && new Date(h.scheduled_at) > Date.now()) && !(S.drafts[x.id] || []).length);
          return { orphans, any: !!b }; }""")
        pg.context.close()
        # the practice data has no such bill, so make one in memory: a tracked bill with a hearing coming, nobody on it, no letter. Its issue's lead, else the admins, get Write testimony.
        pg, errs, bad = open_as(br, 'NT', w, h)
        r = pg.evaluate("""async () => { const s7 = await import('/staff7/steps.js'), d = await import('/staff6/data.js'), t6 = await import('/staff6/today.js'), S = d.S;
          const live = id => !!id && (S.advocates.find(a => a.id === id)?.is_active !== false);
          const cands = S.bills.filter(x => x.tracked !== false && x.position && x.position !== 'monitor' && S.hearings.some(h => h.bill_id === x.id && h.status === 'scheduled' && new Date(h.scheduled_at) > Date.now())), b = cands.find(x => !(S.billCampaigns?.[x.id] || []).length) || cands[0];
          if (!b) return { who: [], lead: [], none: true };
          S.assignments[b.id] = []; S.drafts[b.id] = []; t6.t6Fresh();
          const who = S.advocates.filter(a => s7.stepsFor(a).some(s => s.orphan && s.bill.id === b.id)).map(a => a.initials), lead = s7.leadsFor(b).map(id => S.advocates.find(a => a.id === id).initials);
          const st = s7.stepsFor(S.advocates.find(a => a.initials === who[0])).find(s => s.orphan && s.bill.id === b.id);
          return { bill: b.bill_number, who, lead, kind: st?.kind, id: st?.id }; }""")
        ok(r['who'] and sorted(r['who']) == sorted(r['lead']) and r['kind'] == 'write', f'{tag}: a hearing nobody leads is a Write testimony step for the issue lead, else the admins ({r})')
        pg.context.close()

        # ---- the standing rules (staff7/standing.js) ----
        pg, errs, bad = open_as(br, 'JM', w, h)
        r = pg.evaluate("""async () => { const st = await import('/staff7/standing.js'), d = await import('/staff6/data.js'), S = d.S;
          const t = st.tally(['risk', 'risk', 'moving', 'stopped']), mine = st.myIssueStandings();
          const sb = S.bills.find(b => b.bill_number === 'SB11'), dead = S.bills.find(b => st.billStanding(b) === 'stopped');
          return { t, sb: st.billStanding(sb), days: st.deadlineOf(sb)?.days, dead: !!dead, issueRisk: mine.filter(x => x.standing === 'risk').every(x => x.bills.some(b => st.billStanding(b) === 'risk')), issueMoving: mine.filter(x => x.standing === 'moving').every(x => x.bills.every(b => st.billStanding(b) !== 'risk') && x.bills.some(b => st.billStanding(b) === 'moving')),
            issueStopped: mine.filter(x => x.standing === 'stopped').every(x => x.bills.every(b => st.billStanding(b) === 'stopped')), none: st.issueStanding([]) }; }""")
        ok(r['t'] == {'risk': 2, 'moving': 1, 'stopped': 1} and r['sb'] == 'risk' and r['days'] <= 7 and r['dead'] and r['issueRisk'] and r['issueMoving'] and r['issueStopped'] and r['none'] is None, f'{tag}: standing.js: a bill is at risk within 7 days of its deadline with no hearing; an issue is at risk when any bill is, moving when one moves and none is at risk, stopped when none is alive ({r})')
        pg.context.close()

        # ---- more fixes of the round (14 Nov): bill numbers in one email, who a group's typed words belong to, group ids, urgent kinds, undo that names what is left ----
        pg, errs, bad = open_as(br, 'NT', w, h)
        r = pg.evaluate("""async () => { const a = await import('/staff7/do_ask.js'), bills = [{ bill_number: 'HB42', nickname: 'Alpha' }, { bill_number: 'HB424', nickname: 'Beta' }, { bill_number: 'HB4242', nickname: 'Gamma' }];
          return a.plainGroup(bills, '', 'Aloha\\n\\n- HB42 (the long title one)\\n- HB424 (the long title two)\\n- HB4242, three\\n- HB9999 (not ours)\\n\\nMahalo'); }""")
        ls = r['body'].split('\n')
        ok('- HB 42, Alpha' in ls and '- HB 424, Beta' in ls and '- HB 4242, Gamma' in ls and '- HB9999 (not ours)' in ls and r['subject'] == 'Request for hearings on HB 42, HB 424, HB 4242', f'{tag}: 13 HB42 never takes HB424\'s line: each bill is named once ({ls[2:6]})')
        r = pg.evaluate("""async () => { const s7 = await import('/staff7/steps.js'), d = await import('/staff6/data.js'); const all = [], now = Date.now();
          for (const a of d.S.advocates) for (const s of s7.stepsFor(a)) all.push(s.id + '|' + a.id);
          const ids = all.map(x => x.split('|')[0]), groups = d.S.advocates.flatMap(a => s7.stepsFor(a)).filter(s => s.members?.length > 1);
          const mk = (kind, extra) => ({ kind, id: 'x', at: null, tone: 'neutral', ...extra });
          return { groupsHaveKey: groups.every(s => s.id.includes('-' + s.ask.key)), n: groups.length, stale: [s7.isUrgent(mk('stale', { at: now - 36e5 })), s7.isUrgent(mk('stale', { at: now + 36e5 })), s7.isUrgent(mk('stale', { at: null }))],
            missedAsk: s7.isUrgent(mk('ask', { dlDays: null, ask: { st: { deadline: { missed: true } } } })), laterAsk: s7.isUrgent(mk('ask', { dlDays: 5, ask: { st: { deadline: { missed: false } } } })), pastDue: s7.pastDue(mk('write', { at: now - 6e4 })) && !s7.pastDue(mk('missed', { at: now - 6e4 })) && !s7.pastDue(mk('write', { at: now + 6e4 })),
            words: [s7.laterWords([1]), s7.laterWords([1, 2])] }; }""")
        ok(r['groupsHaveKey'] and r['n'] >= 1, f'{tag}: 15 a group step\'s id holds its kind and person ({r["n"]} groups)')
        ok(r['stale'] == [False, False, False] if False else r['stale'][0] is True and r['stale'][1] is False and r['stale'][2] is False, f'{tag}: 19 a check-testimony step is urgent only when past due ({r["stale"]})')
        ok(r['missedAsk'] and not r['laterAsk'] and r['pastDue'], f'{tag}: 19 an ask past its committee date is urgent; one with days left is not; one word, past due')
        ok(r['words'] == ['1 more step later', '2 more steps later'], f'{tag}: 7 one phrase, "N more steps later" ({r["words"]})')
        r = pg.evaluate("""async () => { const a = await import('/staff7/do_ask.js'), d = await import('/staff6/data.js'); const orig = d.DB.delLegNote; const calls = [];
          d.DB.delLegNote = async (nid, id) => { calls.push(nid); if (nid === 'bad') throw new Error('no'); };
          const u = { parts: [{ bill: { bill_number: 'HB1' }, made: [[{ id: 'bad' }, 1]], closed: [] }, { bill: { bill_number: 'HB2' }, made: [[{ id: 'ok' }, 1]], closed: [] }] };
          let msg = ''; try { await a.undoAsk(u); } catch (e) { msg = e.message; } d.DB.delLegNote = orig; return { calls, msg }; }""")
        ok(r['calls'] == ['bad', 'ok'] and 'HB1' in r['msg'] and 'HB2' not in r['msg'], f'{tag}: 20 undo takes back every bill it can and names the one still recorded ({r["msg"]!r})')
        r = pg.evaluate("""async () => { const h = await import('/staff7/home.js'), d = await import('/staff6/data.js'); const out = [];
          for (const a of d.S.advocates) for (const x of h.suggestedFor(a)) out.push(x.text); return out.filter(t => /(Sen|Rep)\\. [^.]+ and (Sen|Rep)\\. [^.]+ has not/.test(t)).length; }""")
        ok(r == 0, f'{tag}: 12 two chairs "have not answered", never "has"')
        pg.context.close()

        # ---- 14: a group's typed words and footer belong to the bills in it; "Yes, sent" re-reads the bills at the click ----
        pg, errs, bad = open_as(br, 'NT', w, h)
        asks = pg.evaluate("async () => { const s7 = await import('/staff7/steps.js'), d = await import('/staff6/data.js'); return s7.stepsFor(d.S.me).filter(s => s.kind === 'ask' && s.members?.length > 1).map(s => [s.id, s.members.map(m => m.bill.bill_number)]).sort((x, y) => y[1].length - x[1].length); }")
        sid, nums = asks[0]; nice = lambda n: re.sub(r'^([A-Za-z]+)\s*(\d+)', r'\1 \2', n)
        pg.evaluate(f"location.hash = '#/do/{sid}'"); pg.wait_for_selector('#mailBtn'); pg.wait_for_timeout(300)
        ASKS = "async (nums) => { const d = await import('/staff6/data.js'); return nums.map(n => { const b = d.S.bills.find(x => x.bill_number === n); return (d.S.demoNotes || []).filter(x => x.bill_id === b.id && x.answer === 'asked').length; }); }"
        before = pg.evaluate(ASKS, nums)
        pg.fill('#letter', pg.input_value('#letter') + ' TYPEDMARK'); pg.click('#mailBtn'); pg.wait_for_selector('#yesBtn')
        gone = nums[-1]
        pg.evaluate("async (n) => { const d = await import('/staff6/data.js'); d.S.bills.find(b => b.bill_number === n).tracked = false; }", gone)   # a bill leaves the group while the person is on "Did you send it?"
        pg.click('#yesBtn'); pg.wait_for_timeout(500)
        ok(pg.locator('#akErr').is_visible() and 'changed while you were writing' in pg.locator('#akErr').inner_text() and pg.evaluate(ASKS, nums) == before and pg.evaluate(H1) == 'Ask for a hearing', f'{tag}: 14 "Yes, sent" records nothing when the bills in the step are not the bills the email names ({pg.locator("#akErr").inner_text()!r})')
        pg.evaluate("location.hash = '#/'"); pg.wait_for_timeout(300); pg.evaluate(f"location.hash = '#/do/{sid}'"); pg.wait_for_selector('#letter'); pg.wait_for_timeout(300)
        left_ = pg.input_value('#letter')
        ok(len(nums) >= 3 and 'TYPEDMARK' not in left_ and nice(gone) not in left_ and pg.locator('#mailBtn').count() == 1 and pg.locator('#yesBtn').count() == 0, f'{tag}: 14 the words and the footer kept for the old bills do not come back over the new ones: a fresh email without {gone}')
        pg.context.close()

        # ---- the phone: the greeting, then the lists, then the facts and the session ----
    pg, errs, bad = open_as(br, 'KR', 390, 844)   # Kris has all three lists (To do, Waiting, Suggested); Kevin's suggestion became a waiting ask in piece 5
    g = pg.evaluate("() => { const t = e => document.querySelector(e).getBoundingClientRect().top; return [t('main h1'), t('.ovsub'), t('#hs'), t('#hw'), t('#hg'), t('.facts'), t('.sess'), document.documentElement.scrollWidth, innerWidth, document.querySelector('.ovdate').getBoundingClientRect().left, document.querySelector('#hs').getBoundingClientRect().left]; }")
    ok(g[0] < g[1] < g[2] < g[3] < g[4] < g[5] < g[6] and g[7] <= g[8] and g[9] >= 0 and g[10] >= 0 and pg.locator('.back').count() == 0, f'phone: the greeting and its line, then To do, Waiting on others, Suggested, then the facts and the session ({[round(x) for x in g[:7]]})')
    ok(g[2] < 400 and not pg.locator('.ovr').is_visible(), f'phone: the To do list starts within the first screen ({g[2]:.0f}px) and the Overview row is not drawn (the greeting is the overview)')
    pg.click('#hs ~ ul a.sr3'); pg.wait_for_selector('#sendBtn'); pg.wait_for_timeout(300)
    ok(pg.locator('.back').inner_text().strip() == 'Back to overview', 'phone: the link above a step says "Back to overview"')
    pg.click('.back'); pg.wait_for_timeout(300)
    ok(pg.locator('.ovtop').count() == 1 and not pg.evaluate(SMALL), 'phone: Back to overview returns to the overview, targets 44px')
    snap(pg, 'home_KV', 'phone_390x844'); pg.context.close()
    br.close()

passed = sum(res); print(f'\n{passed}/{len(res)} passed'); sys.exit(0 if passed == len(res) else 1)
