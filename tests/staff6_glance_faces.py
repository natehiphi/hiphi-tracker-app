# Staff v6 at a glance (R-344, from R-336's at-a-glance review of 26 Oct and Nate's decisions): three of the five picture
# rules, on the practice copy (Mon 16 Mar 2026, 9:00 am HST).
#   Rule 4, faces: every staff member's initials circle has a soft colour of their own (decision 3), different between
#     people and the same for one person on every screen and whoever is looking; the viewer's own carries a ring; faces lead
#     the rows of People, Team and Inbox, and the hearing page's committee members show their photo (or its initial).
#   Rule 3, time left: the colour of time (R-352, Nate 27 Oct, amending decision 2; A-5 on v6): due today plain, with a
#     clock and the distance in words; amber with the alarm clock only for late testimony
#     still accepted; red with the alert and "overdue" once the deadline has passed; neutral further out, with the distance in words (ui.js timeTone, countdown, urgentMark).
#   Rule 5, one picture one meaning: the Inbox is the tray with its number on a phone too (no bell); Mark read is not a
#     check mark; a legislator's "where they stand" is the thumbs-up; the Capitol building is Legislators only; Session
#     setup's Blocking is not the circle-x of Missed; More tools' people icons are not used four ways.
#   And no sideways scroll at 390 and 1440 on the screens this touches.
#
#   V4_ROOT=/path/to/worktree python3 tests/staff6_glance_faces.py      (otherwise HOST, :8832)
import os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import staff6_lib as L

R = L.Results()
check = R.check
AMBER, RED = 'rgb(149, 90, 0)', 'rgb(175, 51, 40)'   # --v6-late #955A00, --v6-bad #AF3328 (every palette keeps these)

# Each person's circle, by the row's name: its background colour and whether it carries the "you" ring.
FACES = """(sel) => [...document.querySelectorAll(sel)].filter(r => r.getClientRects().length).map(r => {
  const av = r.querySelector('.v6-row-lead .sv-av'); if (!av) return null;
  const name = (r.querySelector('.v6-row-name')?.textContent || '').replace(/\\s*\\(you\\)$/, '').trim();
  const cs = getComputedStyle(av); return { name, bg: cs.backgroundColor, ring: cs.boxShadow !== 'none', ini: av.textContent.trim() };
}).filter(Boolean)"""
OVER = 'document.documentElement.scrollWidth - innerWidth'
ICONS_IN = "(sel) => [...document.querySelectorAll(sel + ' svg.ic')].filter(e => e.getClientRects().length).map(e => [...e.classList].find(c => c.startsWith('ic-') && c !== 'ic'))"

def main():
  with L.browser() as b:
    # ---- rule 4: People, as Nate, at 1440 ----
    pg = b.page('NT', 1440, 900); pg.open('/people'); p = pg.page
    ppl = p.evaluate(FACES, '.v6-row')
    by = {x['name']: x for x in ppl}
    check('People: every row leads with a face', len(ppl) >= 12 and len(ppl) == p.evaluate("document.querySelectorAll('.v6-ld-list .v6-row').length"), f'{len(ppl)} faces')
    tints = {x['bg'] for x in ppl}
    check('People: the faces use at least 5 different colours (not all one teal)', len(tints) >= 5, sorted(tints))
    check('People: no colour is shared by more than 3 people', max([sum(1 for x in ppl if x['bg'] == t) for t in tints] or [99]) <= 3, '')
    check('People: no face uses status amber, red or green, or the action teal', not tints & {AMBER, RED, 'rgb(46, 118, 80)', 'rgb(0, 105, 142)', 'rgb(251, 239, 217)', 'rgb(251, 233, 229)'}, sorted(tints))
    # the fresh-eyes review (27 Oct): no face in an action tile's hue (verbs.js: write, approve, file, chair, rally, take), so
    # a face never reads as a job; and at most two letters in a circle (Julie's "JMM" spilt out of hers)
    hues = p.evaluate("""() => ['write', 'approve', 'file', 'chair', 'rally', 'take'].map(k => { const d = document.createElement('span'); d.className = 'v6-at h-' + k; document.body.append(d); const c = getComputedStyle(d).backgroundColor; d.remove(); return c; })""")
    check('People: no face uses an action tile\'s colour', not tints & set(hues), sorted(tints & set(hues)))
    ini = p.evaluate("[...document.querySelectorAll('.v6-row-lead .sv-av')].map(a => (getComputedStyle(a, '::before').content || '').replace(/[\"']/g, '') || a.innerText.trim())")
    check('People: at most two letters in every face', ini and all(len(x) <= 2 for x in ini), [x for x in ini if len(x) > 2])
    check('People: Nate and Kevin look different', by.get('Nate', {}).get('bg') != by.get('Kevin', {}).get('bg'), (by.get('Nate', {}).get('bg'), by.get('Kevin', {}).get('bg')))
    check('People: only your own face has the ring', [x['name'] for x in ppl if x['ring']] == ['Nate'], [x['name'] for x in ppl if x['ring']])
    contrast = p.evaluate("""() => { const lum = c => { const v = c.match(/\\d+/g).slice(0, 3).map(n => { n /= 255; return n <= 0.03928 ? n / 12.92 : ((n + 0.055) / 1.055) ** 2.4; }); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
      return [...document.querySelectorAll('.v6-row-lead .sv-av')].map(a => { const s = getComputedStyle(a), x = lum(s.color), y = lum(s.backgroundColor); return +((Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)).toFixed(2); }); }""")
    check('People: initials on every tint at WCAG AA, 4.5:1 or more (A-7)', contrast and min(contrast) >= 4.5, min(contrast or [0]))
    kevin = by.get('Kevin', {}).get('bg')
    # a person is their colour in every palette (fixed tints; every palette's card is white or near it)
    pals = p.evaluate("""async () => { const { PALETTES } = await import('/staff6/palettes.js'), out = {}, was = document.documentElement.dataset.palette;
      for (const x of PALETTES) { document.documentElement.dataset.palette = x.id; await new Promise(r => requestAnimationFrame(r));
        const r = [...document.querySelectorAll('.v6-row')].find(e => /^Kevin$/.test(e.querySelector('.v6-row-name')?.textContent || ''));
        out[x.id] = r ? getComputedStyle(r.querySelector('.v6-row-lead .sv-av')).backgroundColor : null; }
      if (was) document.documentElement.dataset.palette = was; else delete document.documentElement.dataset.palette; return out; }""")
    check("Every palette (all 25): Kevin keeps his colour", pals and len(pals) >= 25 and set(pals.values()) == {kevin}, {k: v for k, v in pals.items() if v != kevin})
    # the same colour on Team's Who is on what and in the Inbox
    pg.nav('/team'); p.click('details[data-tmfold="who"] > summary'); p.wait_for_timeout(250)
    team = p.evaluate("""() => Object.fromEntries([...document.querySelectorAll('details[data-tmfold="who"] .tm6-load')].map(a => [a.querySelector('.tm6-ln')?.textContent.trim(), getComputedStyle(a.querySelector('.sv-av')).backgroundColor]))""")
    check("Team: Kevin's face is his People colour (stable by person)", team.get('Kevin') == kevin, (team.get('Kevin'), kevin))
    slip = p.evaluate("() => [...document.querySelectorAll('[data-block=\"slip\"] .v6-row')].map(r => !!r.querySelector('.v6-row-lead .sv-av'))")
    check("Team: each of Slipping's rows leads with whose it is (a face, or the dashed No owner circle)", slip and all(slip), slip)
    risk = p.evaluate("() => [...document.querySelectorAll('[data-block=\"slip\"] .v6-row')].map(r => r.innerText).filter(t => /Hearing at risk/.test(t) && /Alert (\\w+)/.test(t))")
    check('Team: a row whose Alert button names the owner does not say "owns it" too (A-25)', all(not re.search(r'\b\w+ owns it', t) for t in risk), [t[:80] for t in risk][:2])
    pg.nav('/inbox')
    inbox = p.evaluate(FACES, '.ib-msgrow')
    kv = [x for x in inbox if x['name'] == 'Kevin']
    check("Inbox: a teammate's message leads with their face, Kevin's in his colour", kv and all(x['bg'] == kevin for x in kv), [x['bg'] for x in kv][:2])
    tiles = p.evaluate("() => [...document.querySelectorAll('.ib-msgrow')].filter(r => !r.querySelector('.v6-row-lead .sv-av')).map(r => !!r.querySelector('.v6-row-lead.sv-tile svg'))")
    check("Inbox: a tracker note leads with a soft round tile instead (decision 1)", all(tiles), tiles)
    check("Inbox: the row's speech-bubble icon is gone where the face replaced it (A-25)", p.evaluate("() => [...document.querySelectorAll('.ib-msgrow .v6-row-line svg.ic-message-square')].length") == 0, '')
    pg.close()
    # the same colour whoever is looking
    pg = b.page('KV', 1440, 900); pg.open('/people')
    kv2 = {x['name']: x for x in pg.page.evaluate(FACES, '.v6-row')}
    if kv2:
      check("Kevin's colour is the same when Kevin looks", kv2.get('Kevin', {}).get('bg') == kevin, (kv2.get('Kevin', {}).get('bg'), kevin))
      check('As Kevin, the ring is on Kevin', [n for n, x in kv2.items() if x['ring']] == ['Kevin'], [n for n, x in kv2.items() if x['ring']])
    else:
      pg.nav('/team')
      kv2 = {x['name']: x for x in pg.page.evaluate(FACES, '.v6-row')}
      check("Kevin's colour for Nate is the same when Kevin looks (his teammate list)", kv2.get('Nate', {}).get('bg') == by.get('Nate', {}).get('bg'), (kv2.get('Nate', {}).get('bg'), by.get('Nate', {}).get('bg')))
    check('no page errors as Kevin', not pg.errors, pg.errors[:1]); pg.close()

    # ---- rule 4 and 5 on the hearing page ----
    pg = b.page('NT', 1440, 900); pg.open('/hearing/' + L.HHSCPN_FRI); p = pg.page
    mem = p.evaluate("() => [...document.querySelectorAll('.hr-mrow')].map(r => !!r.querySelector('.v6-row-lead .lg6-rph'))")
    check("Hearing: every committee member's row leads with their photo (its initial when no photo loads)", mem and all(mem), f'{sum(mem)} of {len(mem)}')
    check("Hearing: each of our bills shows its owner's face beside whose bill it is", p.evaluate("document.querySelectorAll('.v6-hcard-facts .hr-ownface .sv-av').length") >= 1, '')
    check('Hearing: no Capitol building (it is Legislators only)', 'ic-landmark' not in p.evaluate(ICONS_IN, 'main'), '')
    due = p.evaluate("document.querySelector('.hr-due')?.innerText || ''")
    check('Hearing: the Capitol deadline says how long is left in words', not due or re.search(r'· in \d+ (min|hours?|days)', due), due)
    check('no page errors on the hearing page', not pg.errors, pg.errors[:1]); pg.close()

    # ---- rule 3: the colour of time, from the one function every countdown uses ----
    pg = b.page('NT', 1440, 900); pg.open('/'); p = pg.page
    t = p.evaluate("""async () => { const ui = await import('/staff6/ui.js'); const now = Date.now(), H = 36e5;
      const hst = ms => new Date(ms).toLocaleDateString('en-CA', { timeZone: 'Pacific/Honolulu' });
      const tomorrow = Date.parse(hst(now + 864e5) + 'T08:00:00-10:00'), iso = ms => new Date(ms).toISOString();
      const cases = { today: [iso(now + 2 * H + 6e4)], late: [iso(now - 3 * H)], later: [iso(now + 3 * 864e5 + H)], tomorrow: [iso(tomorrow)], lateok: [iso(now - H), iso(now + 2 * H)] };
      const box = document.createElement('div'); box.className = 'g-test'; document.querySelector('main').appendChild(box);
      const out = {};
      for (const [k, [a, until]] of Object.entries(cases)) {
        box.innerHTML = ui.countdown(a, { until: until || null, at: true }) + ui.urgentMark(a, { until: until || null, act: 'to file' });
        const c = box.querySelector('.sv-count'), u = box.querySelector('.sv-urg');
        out[k] = { tone: ui.timeTone(a, { until: until || null }), cls: c.className, color: getComputedStyle(c).color, text: c.textContent, ucls: u.className, ucolor: getComputedStyle(u).color, icons: [...box.querySelectorAll('svg.ic')].map(s => [...s.classList].find(x => x.startsWith('ic-') && x !== 'ic')) };
      }
      box.remove(); return out; }""")
    check('Time: due later today is plain (never amber or red), with a clock (R-352)', t['today']['tone'] == 'today' and t['today']['color'] not in (AMBER, RED) and t['today']['ucolor'] not in (AMBER, RED) and 'ic-clock' in t['today']['icons'], t['today'])
    check('Time: due today says the time and the distance ("11:00 AM today · in 2 hours")', re.search(r'\d:\d\d [AP]M today · in \d+ hours?', t['today']['text']), t['today']['text'])
    check('Time: passed is red, with the alert and "overdue", never amber or the alarm clock', t['late']['tone'] == 'late' and t['late']['color'] == RED and t['late']['ucolor'] == RED and 'ic-circle-alert' in t['late']['icons'] and 'ic-alarm-clock' not in t['late']['icons'] and 'overdue' in t['late']['text'], t['late'])
    check('Time: late testimony still accepted stays amber', t['lateok']['tone'] == 'lateok' and t['lateok']['color'] == AMBER and 'still accepted' in t['lateok']['text'], t['lateok'])
    check('Time: three days out is neutral, the date and "in 3 days" beside it', t['later']['tone'] == '' and t['later']['color'] not in (AMBER, RED) and re.search(r'\w{3} \d+/\d+, .* · in 3 days', t['later']['text']), t['later'])
    check('Time: tomorrow morning is neutral, though under 24 hours away', t['tomorrow']['tone'] == '' and t['tomorrow']['color'] not in (AMBER, RED) and 'tomorrow' in t['tomorrow']['text'], t['tomorrow'])
    pg.close()

    # ---- rule 5: one picture, one meaning ----
    lap = b.page('NT', 1440, 900); lap.open('/inbox'); lp = lap.page
    side = lp.evaluate("document.querySelector('.sv-side a[href=\"#/inbox\"] .sv-sn')?.textContent.trim() || ''")
    side_ic = lp.evaluate("[...(document.querySelector('.sv-side a[href=\"#/inbox\"] svg.ic')?.classList || [])].join(' ')")
    reads = lp.evaluate(ICONS_IN, '.ib-read')
    check('Inbox: Mark read is not a check mark (the check is done and approve only)', reads and 'ic-check' not in reads, sorted(set(reads)))
    lap.close()
    ph = b.page('NT', 390, 844); ph.open('/inbox'); pp = ph.page
    tray = pp.evaluate("""() => { const a = document.querySelector('.sv-hdr a[href="#/inbox"]'); return a ? { ic: [...a.querySelector('svg.ic').classList].join(' '), n: a.querySelector('.sv-trayn')?.textContent.trim() || '', label: a.getAttribute('aria-label') } : null; }""")
    check('Phone: the Inbox is the tray, as in the sidebar (no bell)', tray and 'ic-inbox' in tray['ic'] and 'ic-inbox' in side_ic and 'ic-bell' not in tray['ic'], (tray, side_ic))
    check("Phone: the tray shows the sidebar's number", tray and side and tray['n'] == side, (tray and tray['n'], side))
    check('390: Inbox, no sideways scroll', pp.evaluate(OVER) <= 0, pp.evaluate(OVER)); ph.close()

    pg = b.page('NT', 1440, 900); pg.open(f'/legislator/{L.LEGISLATOR}'); p = pg.page
    # R-352 part 8b (A-18, one picture one meaning): an unknown stand is the words "Mark stand", no thumbs-up (the thumbs-up
    # means a yes); its spoken name says whose stand on which bill
    st = p.evaluate("() => [...document.querySelectorAll('.lg6-standb')].map(e => [e.innerText.trim(), e.querySelectorAll('svg.ic-thumbs-up').length, e.getAttribute('aria-label') || ''])")
    check('Legislator: an unknown stand reads "Mark stand", with no thumbs-up', st and all(x[0] == 'Mark stand' and x[1] == 0 for x in st), st[:3])
    check('Legislator: each "Mark stand" says whose stand on which bill to a screen reader', st and all(x[2].startswith('Mark stand: where ') for x in st), [x[2] for x in st][:2])
    check('Legislator: their Capitol page link is not the Capitol building (Legislators place only)', 'ic-landmark' not in p.evaluate(ICONS_IN, 'main .lg6-page ul'), '')
    pg.nav('/tools')
    rows = p.evaluate("() => [...document.querySelectorAll('main .v6-more-row')].map(r => [r.querySelector('.v6-more-nm')?.textContent.trim(), [...(r.querySelector('.v6-more-ic svg')?.classList || [])].find(c => c.startsWith('ic-') && c !== 'ic')])")
    peopleish = [r for r in rows if r[1] in ('ic-users', 'ic-users-round', 'ic-user-round', 'ic-user')]
    check('More tools: a people icon only on Team and People (not four ways)', all(n in ('Team', 'People') for n, _ in peopleish) and len({i for _, i in peopleish}) == len(peopleish), peopleish)
    check('More tools: the Capitol building only on rows that open Legislators', all(re.search(r'Legislator|Holding', n or '') for n, i in rows if i == 'ic-landmark'), [n for n, i in rows if i == 'ic-landmark'])
    check('More tools: the session calendar is not the Hearings calendar', all(i not in ('ic-calendar', 'ic-calendar-days') for n, i in rows if n == 'Session calendar'), [r for r in rows if r[0] == 'Session calendar'])
    pg.nav('/setup')
    blk = p.evaluate("() => [...document.querySelectorAll('main li')].filter(li => /\\bBlocking\\b/.test(li.innerText)).map(li => [...li.querySelectorAll('svg.ic')].map(s => [...s.classList].find(c => c.startsWith('ic-') && c !== 'ic')))")
    src = (L._raw('staff6/setup.js') or b'').decode('utf-8', 'replace')
    check("Session setup: Blocking is the warning triangle, not Missed's circle-x", ("['triangle-alert', 'bad', 'Blocking']" in src) and all('ic-circle-x' not in x for x in blk), blk[:2])
    check('no page errors (legislator, tools, setup)', not pg.errors, pg.errors[:1]); pg.close()

    # ---- no sideways scroll on the screens this touches ----
    for who in ('NT', 'KV'):
      for w, h in ((1440, 900), (390, 844)):
        pg = b.page(who, w, h); over = {}
        for i, r in enumerate(['/team', '/people', '/inbox', '/hearing/' + L.HHSCPN_FRI, '/tools']):
          pg.open(r) if i == 0 else pg.nav(r)
          o = pg.page.evaluate(OVER)
          if o > 0: over[r] = o
        check(f'{who} {w}: no sideways scroll on Team, People, Inbox, a hearing and More tools', not over, over)
        check(f'{who} {w}: no page errors', not pg.errors, pg.errors[:1]); pg.close()
  R.done()

if __name__ == '__main__': main()
