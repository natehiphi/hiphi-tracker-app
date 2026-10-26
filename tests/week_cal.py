# "Add this week’s hearings to my calendar" on My issues (R-212 Tier 2 #51; pub/rec/mybills.js weekLine, pub/actions.js
# weekHearings and downloadWeekIcs), in the practice copy (frozen at Mon 16 Mar 2026, 9:00 HST), phone 390x844 and laptop
# 1366x900, following what tests/new_draft.py follows (four issues and HB 1850 on its own).
#   W1  My issues shows the line once, between the header and the rows: a text button (never filled, A-3) reading "Add this
#       week’s hearings to my calendar", with no count, 44px tall (A-6), its icon at the h1's left edge; the rows still start
#       within 320px on a phone (A-1)
#   W2  pressing it saves one file, hiphi-hearings-2026-03-16.ics (the week's first day): CRLF line ends, one VCALENDAR, no
#       calendar name (an import, not a calendar of its own), one hearing VEVENT per hearing weekHearings() gives, with the
#       one-hearing file's UIDs (<hearing id>-hearing@bills.hiphi.org), soonest first, every hearing ahead and either inside
#       [now, now + 7 days] by the practice clock or with its testimony deadline inside them (HB 1839, HB 1886 and HB 2540:
#       testimony closes Sun 3:00 PM, the hearing is Mon 3:00 PM, just after the week); "Testimony due" (<hearing id>-due@...)
#       only for a hearing whose deadline is ahead. Everything the page promises this week is in the file: every deadline
#       Home and My issues count as due this week (dueAll's rule) has its "Testimony due", and each row's "Testimony due ...,
#       and 3 more this week" or "Hearing Wed ..." has that many deadlines and hearings of its own bills in the file
#       The deadline's event has no place (testimony is sent online) and says "Send your testimony online. It takes a few
#       minutes: <link>"; the hearing's says "Times can change: check the bill before you go." before its link
#   W3  the line then says "Calendar file ready", the next step "Open it to add 6 hearings, Wed to Mon, Mar 23" and a quiet
#       "Save again" (44px, lined up under Edit) that saves the file once more; focused; the rows below have not moved, at 390
#       or 1366, after either press; it stays so after a redraw
#   W4  while editing, no line; Done brings it back; a bill followed after the press with a hearing this week: offered again
#   W5  testimony already sent on HB 2121's hearing: its hearing is in the file, its "Testimony due" is not; HB 1965, a bill
#       HIPHI only watches (no testimony button, R-101), followed on its own: its hearing, no "Testimony due"; HB 1780, which
#       they plan to go to: its hearing event is exactly the one-hearing file's (the directions, the 90-minute reminder);
#       HB 1573, a plan to go on a bill they do not follow: in the file too; HB 1965 has no nickname: its title is "Hearing:
#       HB 1965", its summary leads the description (never a title cut mid-sentence)
#   W6  no line when nothing they follow has a hearing in the week, nor between sessions (&season=off)
#   W7  the one-hearing file from a bill page's "Add to my calendar" is what main's code made before R-212 #51, line for line
#       but DTSTAMP and exactly the ui-critic's changes to the shared events (the deadline's place and words, the hearing's
#       "Times can change" line), for a plain hearing and one they plan to go to
#   W8  no page errors, no console errors
#   W9  in Instagram's or Facebook's own browser (which drop a saved file): one grey line, "To save a calendar file, open
#       this page in Safari or Chrome.", and no button
#   python3 tests/week_cal.py [base] [outdir]    base defaults to http://localhost:8832; pictures go to [outdir]
import json, os, re, sys
from datetime import datetime, timezone
from playwright.sync_api import sync_playwright
BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832').rstrip('/')
if BASE.endswith('.html'): BASE = BASE.rsplit('/', 1)[0]
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out', 'week_cal')
os.makedirs(OUT, exist_ok=True)
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SNAP = json.load(open(os.path.join(ROOT, 'demo', 'snapshot.json')))
ID = {b['bill_number']: b['id'] for b in SNAP['bills']}
NUM = {b['id']: b['bill_number'] for b in SNAP['bills']}
ISS = {i['slug']: i['id'] for i in SNAP['issues']}
HEAR = {h['id']: h for h in SNAP['hearings']}
HID = {h['id'][:8]: h['id'] for h in SNAP['hearings']}
H2121, H1780, H1965, H1573 = HID['6585adbd'], HID['b2ad4467'], HID['d35365cb'], HID['9ebffb71']   # each bill's hearing in the practice week
res = []
def ok(c, m): res.append(bool(c)); print('PASS' if c else 'FAIL', m)

FOLLOWS = [ISS['disposable-e-cigarette-ban'], ISS['safety-for-immigrant-families'], ISS['hygienists-temporary-fillings'], ISS['free-bus-rides-for-kids']]
def scene(issues=FOLLOWS, own=(ID['HB1850'],), done=()):
    return f"""(() => {{ if (sessionStorage.getItem('__set')) return; sessionStorage.setItem('__set', '1');
  for (const k of Object.keys(localStorage)) if (k.startsWith('hiphi_')) localStorage.removeItem(k);
  const set = (k, v) => localStorage.setItem(k + '_demo', typeof v === 'string' ? v : JSON.stringify(v));
  set('hiphi_issue_follows', {json.dumps(list(issues))}); set('hiphi_watch_ids', {json.dumps(list(own))}); set('hiphi_cat_follows', []); set('hiphi_skips', []);
  set('hiphi_wiz', {{ done: true, issues: ['tobacco'], name: 'Kalani' }}); set('hiphi_done', {json.dumps(list(done))}); set('hiphi_done_at', {{}}); set('hiphi_stances', {{}}); set('hiphi_demo_seeded', '1');
  localStorage.setItem('hiphi_tour_home_demo', '{{"how":"test"}}'); localStorage.setItem('hiphi_tour_bill_demo', '{{"how":"test"}}');
}})();"""
done = lambda num, hid, kind: f"{ID[num]}|{hid}|{kind}"

# What main's code (before R-212 #51) made for one hearing, DTSTAMP lines left out, the page's address as {BASE}.
GOLD = {'plain': [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//HIPHI//Bill Tracker//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    'UID:6585adbd-60ab-4eb3-a0b7-303405b87be5-due@bills.hiphi.org',
    'DTSTART:20260318T193000Z',
    'DTEND:20260318T194500Z',
    'SUMMARY:Testimony due: HB 2121 (Disposable e-cigarette ban)',
    'DESCRIPTION:Send testimony in 5 minutes: {BASE}/track.html#/bill/2026/HB2121',
    'LOCATION:Hawaiʻi State Capitol\\, 415 S Beretania St\\, Honolulu\\, HI 96813\\, Room 229',
    'URL:{BASE}/track.html#/bill/2026/HB2121',
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'DESCRIPTION:Testimony due: HB 2121 (Disposable e-cigarette ban)',
    'TRIGGER:-PT2H',
    'END:VALARM',
    'END:VEVENT',
    'BEGIN:VEVENT',
    'UID:6585adbd-60ab-4eb3-a0b7-303405b87be5-hearing@bills.hiphi.org',
    'DTSTART:20260320T193000Z',
    'DTEND:20260320T203000Z',
    'SUMMARY:Hearing: HB 2121 (Disposable e-cigarette ban)',
    'DESCRIPTION:Senate Health and Human Services Committee and Commerce and Consumer Protection Committee. Anyone can attend. {BASE}/track.html#/bill/2026/HB2121',
    'LOCATION:Hawaiʻi State Capitol\\, 415 S Beretania St\\, Honolulu\\, HI 96813\\, Room 229',
    'URL:{BASE}/track.html#/bill/2026/HB2121',
    'END:VEVENT',
    'END:VCALENDAR'], 'going': [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//HIPHI//Bill Tracker//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    'UID:b2ad4467-5afa-4de2-9a0f-4832eb5acd33-due@bills.hiphi.org',
    'DTSTART:20260317T230000Z',
    'DTEND:20260317T231500Z',
    'SUMMARY:Testimony due: HB 1780 (Free school bus passes)',
    'DESCRIPTION:Send testimony in 5 minutes: {BASE}/track.html#/bill/2026/HB1780',
    'LOCATION:Hawaiʻi State Capitol\\, 415 S Beretania St\\, Honolulu\\, HI 96813\\, Room 229\\, 2nd floor',
    'URL:{BASE}/track.html#/bill/2026/HB1780',
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'DESCRIPTION:Testimony due: HB 1780 (Free school bus passes)',
    'TRIGGER:-PT2H',
    'END:VALARM',
    'END:VEVENT',
    'BEGIN:VEVENT',
    'UID:b2ad4467-5afa-4de2-9a0f-4832eb5acd33-hearing@bills.hiphi.org',
    'DTSTART:20260318T230000Z',
    'DTEND:20260319T000000Z',
    'SUMMARY:Hearing: HB 1780 (Free school bus passes)',
    'DESCRIPTION:Senate Education Committee. You plan to go. Arrive by 12:40 PM with a photo ID. Room 229 is on the 2nd floor. Take an elevator up. TheBus routes A and 4 stop at Beretania and Punchbowl\\, by the Capitol\\, and many more run along Beretania Street. Times: thebus.org. Driving? There’s paid parking under the Capitol (enter from Miller Street) and in the state lots nearby. Questions on the day? The Public Access Room\\, Room 401\\, helps for free: (808) 587-0478. {BASE}/track.html#/bill/2026/HB1780',
    'LOCATION:Hawaiʻi State Capitol\\, 415 S Beretania St\\, Honolulu\\, HI 96813\\, Room 229\\, 2nd floor',
    'URL:{BASE}/track.html#/bill/2026/HB1780',
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'DESCRIPTION:Hearing: HB 1780 (Free school bus passes)',
    'TRIGGER:-PT90M',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR']}

def expected(name):   # main's one-hearing file with exactly the ui-critic's changes (R-212 #51), and nothing else
    out, kind = [], ''
    for l in GOLD[name]:
        l = l.replace('{BASE}', BASE)
        if l.startswith('UID:'): kind = 'due' if l.endswith('-due@bills.hiphi.org') else 'hearing'
        if l == 'BEGIN:VALARM': kind = 'alarm'
        if kind == 'due' and l.startswith('LOCATION:'): continue
        if kind == 'due' and l.startswith('DESCRIPTION:Send testimony in 5 minutes: '): l = 'DESCRIPTION:Send your testimony online. It takes a few minutes: ' + l.split(': ', 1)[1]
        if kind == 'hearing' and l.startswith('DESCRIPTION:'): head, url = l.rsplit(' ', 1); l = f'{head} Times can change: check the bill before you go. {url}'
        out.append(l)
    return out
def events(text):   # [{ 'lines': [...], 'UID': ..., ... }] for each VEVENT
    out = []
    for m in re.finditer(r'BEGIN:VEVENT\r\n(.*?)\r\nEND:VEVENT', text, re.S):
        lines = m.group(1).split('\r\n'); d = {'lines': lines}
        for l in lines:
            k = l.split(':', 1)[0]
            if k not in d: d[k] = l.split(':', 1)[1] if ':' in l else ''
        out.append(d)
    return out
def ics_time(s): return datetime.strptime(s, '%Y%m%dT%H%M%SZ').replace(tzinfo=timezone.utc).timestamp() * 1000
nostamp = lambda lines: [l for l in lines if not l.startswith('DTSTAMP:')]

WEEK = """async () => { const a = await import('./pub/actions.js'); return { now: Date.now(), start: a.weekStart(),
  list: a.weekHearings().map(({ b, h }) => ({ num: b.bill_number, hid: h.id, at: h.scheduled_at, due: h.testimony_deadline, pos: b.hiphi_position || '' })) }; }"""
# What My issues' rows say (calm/home.js myRows) and their bills, and the deadlines Home's dueAll counts as due this week (its
# rule on core.js openActions: on time, not settled, closing inside seven days).
PROMISE = """async () => { const h = await import('./pub/calm/home.js'), c = await import('./pub/core.js'), now = Date.now();
  const rows = h.myRows().map(r => ({ name: r.name, text: String(r.text || '').replace(/\\u00a0/g, ' '), ids: r.b ? [r.b.id] : r.i ? [...c.issueBills(r.i)] : [] }));
  const due = c.openActions(c.S.bills, c.S.hearings).filter(x => !x.late && !c.settledOn(x.b, x.h) && x.h.testimony_deadline && Date.parse(x.h.testimony_deadline) < now + 7 * 864e5).map(x => x.h.id);
  return { rows, due }; }"""
DAYW = r'(today|tomorrow|Mon|Tue|Wed|Thu|Fri|Sat|Sun) '
LINE = """() => { const root = document.querySelector('.rc-mine'), ls = root ? [...root.querySelectorAll('.rc-wkcal')] : [], l = ls[0];
  const b = l && l.querySelector('.rc-wkbtn'), a = l && l.querySelector('.rc-wkagain'), ed = root && root.querySelector('[data-rc-edit]'), h1 = root && root.querySelector('.rc-h1'), head = root && root.querySelector('.rc-mhead'), rows = root && root.querySelector('.rc-mrows');
  const bi = b && b.querySelector('.ic');
  return { n: ls.length, text: l ? l.textContent.replace(/\\u00a0/g, ' ').trim() : '', btn: !!b, cls: b ? b.className : '', h: l ? l.getBoundingClientRect().height : 0, bh: b ? b.getBoundingClientRect().height : 0,
    between: !!(l && head && rows && (head.compareDocumentPosition(l) & 4) && (l.compareDocumentPosition(rows) & 4)),
    iconX: bi ? Math.round(bi.getBoundingClientRect().left) : null, h1X: h1 ? Math.round(h1.getBoundingClientRect().left) : null,
    rowsTop: rows ? Math.round(rows.getBoundingClientRect().top + scrollY) : null, chip: !!(l && l.querySelector('.chip.ok')),
    what: l && l.querySelector('.rc-wkwhat') ? l.querySelector('.rc-wkwhat').textContent.replace(/\\u00a0/g, ' ') : '',
    again: !!a, againH: a ? a.getBoundingClientRect().height : 0, againX: a ? Math.round(a.querySelector('span').getBoundingClientRect().right) : null,
    editX: ed ? Math.round(ed.getBoundingClientRect().right - parseFloat(getComputedStyle(ed).paddingRight)) : null, againFocused: !!(a && document.activeElement === a), note: !!(l && l.classList.contains('rc-wknote')),
    focused: !!(l && document.activeElement === l), sideways: document.documentElement.scrollWidth > innerWidth }; }"""

with sync_playwright() as p:
    br = p.chromium.launch(); errs = []
    def page(init, w, h):
        c = br.new_context(viewport={'width': w, 'height': h}, is_mobile=(w < 600), has_touch=(w < 600), accept_downloads=True); c.add_init_script(init)
        pg = c.new_page(); pg.on('pageerror', lambda e: errs.append('page: ' + str(e)[:200]))
        pg.on('console', lambda m: m.type == 'error' and errs.append('console: ' + m.text[:200])); return c, pg
    def mine(pg, q=''):
        pg.goto(f'{BASE}/track.html?demo=1{q}#/bills'); pg.wait_for_selector('.rc-mine', timeout=60000); pg.wait_for_timeout(2500)
    def promises(pg, ev, when, tag):   # everything the page says is happening this week is in the file
        P = pg.evaluate(PROMISE)
        duev = {e['UID'][:-len('-due@bills.hiphi.org')] for e in ev if e['UID'].endswith('-due@bills.hiphi.org')}
        hearv = {e['UID'][:-len('-hearing@bills.hiphi.org')] for e in ev if e['UID'].endswith('-hearing@bills.hiphi.org')}
        ok(P['due'] and set(P['due']) <= duev, f'{when} {tag}: every deadline counted as due this week has its "Testimony due" in the file ({len(P["due"])}; missing {sorted(NUM[HEAR[x]["bill_id"]] for x in set(P["due"]) - duev)})')
        short, said = [], 0
        for r in P['rows']:
            m = re.search(r'and (\d+) more this week', r['text'])
            n_due = int(m.group(1)) + 1 if m else (1 if re.match(r'(Testimony due|Your letter is started · due) ' + DAYW, r['text']) else 0)
            n_hear = 1 if re.search(r'(^|· )[Hh]earing ' + DAYW, r['text']) else 0
            ids = set(r['ids']); said += n_due + n_hear
            got_due = sum(1 for x in duev if HEAR.get(x, {}).get('bill_id') in ids); got_hear = sum(1 for x in hearv if HEAR.get(x, {}).get('bill_id') in ids)
            if got_due < n_due or got_hear < max(n_due, n_hear): short.append((r['name'], r['text'], got_due, got_hear))
        ok(said and not short, f'{when} {tag}: each row’s "this week" is in the file, its deadlines and hearings ({said} promised; short: {short})')
    def press(pg):
        got = []; pg.on('download', lambda d: got.append(d))
        with pg.expect_download() as dl: pg.locator('.rc-mine [data-rc-wkcal]').click()
        pg.wait_for_timeout(800)
        return dl.value, open(dl.value.path(), newline='', encoding='utf-8').read(), len(got)

    for w, h, tag in ((390, 844, 'phone'), (1366, 900, 'laptop')):
        # W1 the line
        c, pg = page(scene(), w, h); mine(pg)
        L = pg.evaluate(LINE); wk = pg.evaluate(WEEK)
        ok(L['n'] == 1 and L['text'] == 'Add this week’s hearings to my calendar' and L['btn'], f'W1 {tag}: the line, once: "{L["text"]}"')
        ok(L['between'], f'W1 {tag}: between the header and the rows')
        ok('text' in L['cls'].split() and 'primary' not in L['cls'].split() and not re.search(r'\d', L['text']), f'W1 {tag}: a text button with no count ({L["cls"]})')
        ok(L['bh'] >= 44, f'W1 {tag}: 44px of target ({L["bh"]})')
        ok(L['iconX'] is not None and abs(L['iconX'] - L['h1X']) <= 2, f'W1 {tag}: its icon at the h1’s left edge ({L["iconX"]} vs {L["h1X"]})')
        ok(tag != 'phone' or L['rowsTop'] <= 320, f'W1 {tag}: the rows start at {L["rowsTop"]}px (A-1: within 320 on a phone)')
        ok(not L['sideways'], f'W1 {tag}: no sideways scroll')
        nums = [x['num'] for x in wk['list']]
        ok({'HB2121', 'HB1870', 'HB1780'} <= set(nums), f'W1 {tag}: the week’s hearings on followed bills: {nums}')
        ok({'HB1839', 'HB1886', 'HB2540'} <= set(nums), f'W1 {tag}: and the Monday-afternoon hearings whose testimony closes on Sunday, inside the week')
        pg.screenshot(path=os.path.join(OUT, f'mine-before-{tag}.png'), full_page=True)
        before = L['rowsTop']
        # W2 the file
        d, text, n = press(pg)
        ok(n == 1, f'W2 {tag}: one press, one download ({n})')
        ok(d.suggested_filename == f'hiphi-hearings-{wk["start"]}.ics' and wk['start'] == '2026-03-16', f'W2 {tag}: saved as {d.suggested_filename}')
        ok('\n' not in text.replace('\r\n', '') and text.startswith('BEGIN:VCALENDAR\r\n') and text.endswith('\r\nEND:VCALENDAR') and text.count('BEGIN:VCALENDAR') == 1,
           f'W2 {tag}: CRLF line ends, one VCALENDAR from BEGIN to END')
        ok('X-WR-CALNAME' not in text, f'W2 {tag}: no calendar name (an import)')
        ev = events(text); hear = [e for e in ev if e['UID'].endswith('-hearing@bills.hiphi.org')]; dues = [e for e in ev if e['UID'].endswith('-due@bills.hiphi.org')]
        ok(len(hear) == len(wk['list']) and [e['UID'] for e in hear] == [f'{x["hid"]}-hearing@bills.hiphi.org' for x in wk['list']],
           f'W2 {tag}: one hearing event per hearing in the week, the one-hearing file’s UIDs, soonest first ({len(hear)})')
        ok(len(ev) == len(hear) + len(dues), f'W2 {tag}: nothing else in it')
        now, end = wk['now'], wk['now'] + 7 * 864e5; duet = {e['UID'][:-len('-due@bills.hiphi.org')]: ics_time(e['DTSTART']) for e in dues}
        inwk = [now < ics_time(e['DTSTART']) and (ics_time(e['DTSTART']) <= end or duet.get(e['UID'][:-len('-hearing@bills.hiphi.org')], end) < end) for e in hear]
        ok(all(inwk), f'W2 {tag}: every hearing ahead, inside [now, now + 7 days] by the practice clock or its deadline inside them')
        promises(pg, ev, 'W2', tag)
        ok(all('LOCATION' not in e and e['DESCRIPTION'].startswith('Send your testimony online. It takes a few minutes: ') for e in dues) and all('LOCATION' in e for e in hear),
           f'W2 {tag}: the deadline’s event has no place and says to send testimony online; each hearing has its room')
        ok(all(re.search(r' Times can change: check the bill before you go\. http\S+$', e['DESCRIPTION']) for e in hear), f'W2 {tag}: each hearing says to check the bill before going, before its link')
        ok(all(e['SUMMARY'].startswith('Hearing: ') for e in hear) and all(e['SUMMARY'].startswith('Testimony due: ') for e in dues), f'W2 {tag}: the summaries are the one-hearing file’s')
        byhid = {x['hid']: x for x in wk['list']}
        ok(dues and all(byhid.get(e['UID'][:-len('-due@bills.hiphi.org')], {}).get('pos') not in ('', 'monitor') and ics_time(e['DTSTART']) > now for e in dues),
           f'W2 {tag}: "Testimony due" only on a bill HIPHI takes a side on, its deadline ahead ({len(dues)} of {len(hear)})')
        if tag == 'phone': open(os.path.join(OUT, 'week.ics'), 'w', newline='', encoding='utf-8').write(text)
        # W3 the done line
        L = pg.evaluate(LINE)
        ok(L['n'] == 1 and L['chip'] and L['text'].startswith('Calendar file ready') and not L['btn'], f'W3 {tag}: the line says "{L["text"]}"')
        ok(L['what'] == 'Open it to add 6 hearings, Wed to Mon, Mar 23', f'W3 {tag}: the next step: "{L["what"]}"')
        ok(L['again'] and L['againH'] >= 44 and L['againX'] is not None and abs(L['againX'] - L['editX']) <= 2, f'W3 {tag}: "Save again" at the line’s end, 44px, under Edit ({L["againH"]}, {L["againX"]} vs {L["editX"]})')
        ok(L['focused'], f'W3 {tag}: the done line has the focus (a screen reader says it)')
        ok(L['rowsTop'] == before and L['h'] >= 44, f'W3 {tag}: the rows did not move ({before} -> {L["rowsTop"]})')
        pg.screenshot(path=os.path.join(OUT, f'mine-after-{tag}.png'), full_page=True)
        got = []; pg.on('download', lambda d_: got.append(d_))
        with pg.expect_download() as dl2: pg.locator('.rc-mine .rc-wkagain').click()
        pg.wait_for_timeout(800); L2 = pg.evaluate(LINE)
        ok(len(got) == 1 and dl2.value.suggested_filename == d.suggested_filename and len(events(open(dl2.value.path(), newline='', encoding='utf-8').read())) == len(ev),
           f'W3 {tag}: "Save again" saves the same file once more ({dl2.value.suggested_filename})')
        ok(L2['what'] == L['what'] and L2['again'] and L2['againFocused'] and L2['rowsTop'] == before, f'W3 {tag}: and the line stays, the focus on Save again, the rows where they were ({L2["rowsTop"]})')
        pg.evaluate("async () => (await import('./pub/core.js')).app.render()"); pg.wait_for_timeout(400)
        ok(pg.evaluate(LINE)['text'].startswith('Calendar file ready'), f'W3 {tag}: and still after a redraw')
        # W4 editing
        pg.locator('[data-rc-edit]').click(); pg.wait_for_timeout(500)
        ok(pg.locator('.rc-mine.editing').count() == 1 and pg.locator('.rc-wkcal').count() == 0, f'W4 {tag}: while editing, no line')
        pg.locator('[data-rc-edit]').click(); pg.wait_for_timeout(500)
        ok(pg.locator('.rc-wkcal').count() == 1 and pg.evaluate(LINE)['text'].startswith('Calendar file ready'), f'W4 {tag}: Done brings it back, still done')
        # a bill followed after the press, with a hearing this week: the file no longer holds the week, so it is offered again
        pg.evaluate("async id => { const c = await import('./pub/core.js'); await c.toggleWatch(id); }", ID['HB1898']); pg.wait_for_timeout(800)
        L = pg.evaluate(LINE)
        ok(L['btn'] and L['text'] == 'Add this week’s hearings to my calendar', f'W4 {tag}: a hearing joins the week after the press (HB 1898 followed): offered again')
        c.close()

        # W5 testimony sent on HB 2121's hearing; HB 1965 (watch only) followed on its own; going to HB 1780's; going to HB 1573's,
        # a bill they do not follow
        c, pg = page(scene(own=(ID['HB1850'], ID['HB1965']), done=(done('HB2121', H2121, 'testimony'), done('HB1780', H1780, 'attend'), done('HB1573', H1573, 'attend'))), w, h); mine(pg)
        wk = pg.evaluate(WEEK); d, text, n = press(pg); ev = events(text)
        uids = [e['UID'] for e in ev]
        promises(pg, ev, 'W5', tag)
        ok(f'{H2121}-hearing@bills.hiphi.org' in uids and f'{H2121}-due@bills.hiphi.org' not in uids, f'W5 {tag}: testimony sent on HB 2121: its hearing, no "Testimony due"')
        ok(f'{H1965}-hearing@bills.hiphi.org' in uids and f'{H1965}-due@bills.hiphi.org' not in uids, f'W5 {tag}: HB 1965, watched only: its hearing, no "Testimony due"')
        ok(f'{HID["6266ffd5"]}-due@bills.hiphi.org' in uids, f'W5 {tag}: HB 1870, testimony still open: its "Testimony due" is in')
        ok(f'{H1573}-hearing@bills.hiphi.org' in uids and 'HB1573' in [x['num'] for x in wk['list']], f'W5 {tag}: HB 1573, a plan to go on a bill not followed: in the file')
        g = next((e for e in ev if e['UID'] == f'{H1780}-hearing@bills.hiphi.org'), None)
        gold = expected('going')
        ghear = gold[gold.index(f'UID:{H1780}-hearing@bills.hiphi.org'):]; ghear = ghear[:ghear.index('END:VEVENT')]
        ok(g and nostamp(g['lines']) == ghear, f'W5 {tag}: HB 1780, going: its hearing event is the one-hearing file’s, line for line (directions, TRIGGER:-PT90M)')
        gd = next((e for e in ev if e['UID'] == f'{H1780}-due@bills.hiphi.org'), None)
        gdue = gold[gold.index(f'UID:{H1780}-due@bills.hiphi.org'):]; gdue = gdue[:gdue.index('END:VEVENT')]
        ok(gd and nostamp(gd['lines']) == gdue, f'W5 {tag}: and its "Testimony due" is the one-hearing file’s too')
        ok(pg.evaluate(LINE)['what'] == 'Open it to add ' + pg.evaluate("async () => (await import('./pub/rec/mybills.js')).weekWords((await import('./pub/actions.js')).weekHearings())"),
           f'W5 {tag}: the done line says what this file held ("{pg.evaluate(LINE)["what"]}")')
        nn = next((e for e in ev if e['UID'] == f'{H1965}-hearing@bills.hiphi.org'), {})
        ok(nn.get('SUMMARY') == 'Hearing: HB 1965' and nn.get('DESCRIPTION', '').startswith('Creates a working group') and '…' not in nn.get('SUMMARY', ''),
           f'W5 {tag}: HB 1965 has no nickname: "{nn.get("SUMMARY")}", its summary leads the description ("{nn.get("DESCRIPTION", "")[:60]}…")')
        if tag == 'phone': open(os.path.join(OUT, 'week-cases.ics'), 'w', newline='', encoding='utf-8').write(text)
        c.close()

        # W6 nothing in the week: only an issue whose bill was heard in February
        c, pg = page(scene(issues=[ISS['hygienists-temporary-fillings']], own=()), w, h); mine(pg)
        ok(pg.locator('.rc-mrows .rc-row').count() >= 1 and pg.locator('.rc-wkcal').count() == 0, f'W6 {tag}: no hearing they follow in the week: no line')
        c.close()
        c, pg = page(scene(), w, h); mine(pg, '&season=off')
        ok(pg.locator('.rc-mine').count() == 1 and pg.locator('.rc-wkcal').count() == 0, f'W6 {tag}: between sessions: no line')
        c.close()

        # W7 the one-hearing file, as main made it
        for name, num, hid, dn in (('plain', 'HB2121', H2121, ()), ('going', 'HB1780', H1780, (done('HB1780', H1780, 'attend'),))):
            c, pg = page(scene(done=dn), w, h)
            pg.goto(f'{BASE}/track.html?demo=1#/bill/2026/{num}'); pg.wait_for_selector('.bl-head', timeout=60000); pg.wait_for_timeout(2500)
            sel = f'[data-ics="{ID[num]}|{hid}"]'
            if not pg.locator(sel).count(): pg.locator('[data-moreways]').first.click(); pg.wait_for_timeout(500)
            with pg.expect_download() as dl: pg.locator(sel).first.click()
            t = open(dl.value.path(), newline='', encoding='utf-8').read()
            ok(dl.value.suggested_filename == f'{num}-hearing.ics' and nostamp(t.split('\r\n')) == expected(name),
               f'W7 {tag}: {num}’s own file ({name}) is main’s, line for line but DTSTAMP and the ui-critic’s changes')
            c.close()

    # W9 Instagram's and Facebook's own browsers
    for app_, ua in (('Instagram', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 330.0.0.40.92 (iPhone14,5; iOS 17_5; en_US; en; scale=3.00; 1170x2532; 590000000)'),
                     ('Facebook', 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/470.0.0.40.92;FBBV/600000000;FBDV/iPhone14,5;FBMD/iPhone;FBSN/iOS;FBSV/17.5;FBSS/3;FBID/phone;FBLC/en_US;FBOP/5]')):
        c = br.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True, user_agent=ua); c.add_init_script(scene())
        pg = c.new_page(); pg.on('pageerror', lambda e: errs.append('page: ' + str(e)[:200])); mine(pg)
        L = pg.evaluate(LINE)
        ok(L['n'] == 1 and L['note'] and L['text'] == 'To save a calendar file, open this page in Safari or Chrome.' and not L['btn'] and not pg.locator('.rc-wkcal button').count(),
           f'W9 {app_}’s own browser: "{L["text"]}", no button')
        if app_ == 'Instagram': pg.screenshot(path=os.path.join(OUT, 'mine-instagram-phone.png'), clip={'x': 0, 'y': 0, 'width': 390, 'height': 420})
        c.close()
    ok(not errs, f'W8 no page or console errors ({errs[:3]})')
    br.close()
print(f'{sum(res)}/{len(res)} passed'); sys.exit(0 if all(res) else 1)
