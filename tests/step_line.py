# The step line in plain words, each committee named once and one way (R-212 #45; DESIGN C-15, A-14, C-10, A-6), on the
# practice copy's bill pages at phone (390x844 and 360x740) and laptop (1280x800) sizes, every fold open:
#   - "Where it is now" says where the bill is: "In the Senate Health and Human Services Committee"; committees that hear it
#     together are stacked, "In two Senate committees, together:" and then each committee's own name on a line of its own
#     (a list), never "Health, and Human Services & Homelessness", a comma away from the Senate's Health and Human Services
#     Committee (the critic); a bill that did not advance says "Got as far as ..." in the same form.
#   - See all steps names the step in the same words, its Now / Got this far tag on the first line; the small line over it
#     does not say the chamber again; the sentence under it does not say the committee's name again ("The two committees
#     hear it together Mon, Mar 16 at 3:01 PM.").
#   - No committee code anywhere on the page. More details says each Capitol action in plain words (pub/capitol.js), a day's
#     actions in the order they happened, "Passed" only for the vote that passes a chamber; "Last official action" only when
#     the list of every action is not drawn (A-14); and a quiet link in running text to the Capitol's own wording.
# Run: python3 tests/step_line.py [base]  (no base: files served straight from this copy)
import sys, os, re, json, asyncio
from urllib.parse import urlparse, unquote
from playwright.async_api import async_playwright

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://wt.local').rstrip('/').replace('/track.html', '')
SHOTS = os.environ.get('SHOTS', '')
ok = fail = 0
def check(cond, what):
    global ok, fail
    if cond: ok += 1; print('PASS', what)
    else: fail += 1; print('FAIL', what)

async def serve(route):
    f = os.path.join(HERE, unquote(urlparse(route.request.url).path).lstrip('/'))
    await (route.fulfill(path=f) if os.path.isfile(f) else route.fulfill(status=404, body='not found'))

snap = json.load(open(os.path.join(HERE, 'demo', 'snapshot.json')))
ID = {(b['bill_number'], b['session_year']): b['id'] for b in snap['bills']}
# bill, what its step is (in the practice copy's 16 March 2026), whether it is followed (so Every official action is drawn),
# and the words expected. A stacked name is written "head: name | name".
BILLS = [
    ('HB1926', 'joint, hearing set', True, {'small': 'Step 6 of 10', 'name': 'In two Senate committees, together: Water, Land, Culture and the Arts | Public Safety and Military Affairs',
                                            'say': 'Passed the House. The two committees hear it together Mon, Mar 16 at 3:01 PM.',
                                            # 10 Mar, newest first: sent to its committees, taken up, arrived (the Capitol dates them without a time)
                                            'day': ['Sent to the Senate Water, Land, Culture and the Arts Committee and the Public Safety and Military Affairs Committee, together',
                                                    'The Senate formally took it up (its first reading).', 'Arrived in the Senate from the House.']}),
    ('HB1853', 'one committee, hearing set; the House step was two committees', True, {'small': 'Step 5 of 9', 'name': 'In the Senate Health and Human Services Committee',
                                            'say': 'Passed the House. The committee hears it Wed, Mar 18 at 1:00 PM.',
                                            'stack': ['Two House committees, together:', 'Health', 'Human Services & Homelessness']}),
    ('HB1563', 'joint, waiting', True, {'name': 'In two Senate committees, together: Health and Human Services | Energy and Intergovernmental Affairs'}),
    ('HB1314', 'did not advance, one committee', True, {'small': 'Did not advance', 'name': 'Got as far as the House Health Committee'}),
    ('HB1123', 'did not advance, joint', True, {'name': 'Got as far as two House committees, together: Health | Human Services & Homelessness',
                                                'say': 'The two committees never scheduled a hearing on it. In the House, a bill had to reach its last committee by Feb 20, so it can’t pass this year.'}),
    # its sentence names the pair before it, each name ending with "Committee"
    ('HB1617', 'did not advance, after a joint step', True, {'name': 'Got as far as the House Finance Committee',
                                                              'say_start': 'The House Energy & Environmental Protection Committee and the Agriculture & Food Systems Committee passed it'}),
    # not followed: no list of every action, so the last one has its own row and the link says where every action is
    ('HB2121', 'joint, not followed', False, {'name': 'In two Senate committees, together: Health and Human Services | Commerce and Consumer Protection'}),
]
# Past the first visit, the bills followed and every card of the page open.
INIT = """(ids => { if (sessionStorage.getItem('__set')) return; sessionStorage.setItem('__set', '1');
  for (const k of Object.keys(localStorage)) if (k.startsWith('hiphi_')) localStorage.removeItem(k);
  const set = (k, v) => localStorage.setItem(k + '_demo', JSON.stringify(v));
  set('hiphi_wiz', { done: true, issues: [] }); set('hiphi_onb', { lastVisit: new Date(Date.now() - 864e5).toISOString() });
  localStorage.setItem('hiphi_watch_ids_demo', JSON.stringify(ids));
  localStorage.setItem('hiphi_tour_home_demo', '{"how":"test"}'); localStorage.setItem('hiphi_tour_bill_demo', '{"how":"test"}');
  localStorage.setItem('hiphi_recfold', JSON.stringify(['who', 'about', 'more', 'others'])); })(%s);""" % json.dumps([ID[(n, 2026)] for n, _, f, _ in BILLS if f])

READ = """async () => {
  document.querySelectorAll('#main details').forEach(d => d.open = true);
  await new Promise(r => setTimeout(r, 300));
  const c = await import('./pub/core.js'), cap = await import('./pub/capitol.js');
  const txt = e => (e?.textContent || '').replace(/\\s+/g, ' ').trim();
  // a step's name as text: "head: name | name" when stacked; the tag left out
  const nameOf = el => { if (!el) return ''; const e = el.cloneNode(true); e.querySelectorAll('.bl-stag, small').forEach(x => x.remove());
    const h = e.querySelector('.bl-cmh'); return h ? `${txt(h)} ${[...e.querySelectorAll('.bl-cm')].map(txt).join(' | ')}` : txt(e); };
  const w = document.querySelector('#main .bl-rwhere'), now = w.querySelector('.bl-rnow'), small = now.querySelector('small');
  const cur = w.querySelector('.bl-rsteps li.bl-s-now .bl-rsn, .bl-rsteps li.bl-s-stop .bl-rsn');
  const list = now.querySelector('.bl-cms'), items = [...now.querySelectorAll('.bl-cm')].map(e => e.getBoundingClientRect());
  const codes = new Set([...Object.keys(c.S.committees || {}), ...Object.keys(cap.RETIRED)]);
  const main = document.querySelector('#main').textContent;
  const found = [...new Set((main.match(/\\b[A-Z]{2,4}\\b/g) || []).filter(t => codes.has(t)))];
  const more = document.querySelector('[data-bl-rfold="more"]');
  const kv = [...(more?.querySelectorAll('.bl-kv') || [])].find(e => /Last official action/.test(e.textContent));
  const acts = [...(more?.querySelectorAll('[data-bl-fold="rd-actions"] li') || [])].map(li => ({ t: txt(li.querySelector('.bl-rlt')), d: txt(li.querySelector('.bl-rls')) }));
  const orig = more?.querySelector('.bl-rorig a'), menu = document.querySelector('#main .bl-menu a[data-ab-go="capitol"]');
  const stacks = [...w.querySelectorAll('.bl-rsteps .bl-rsn')].filter(e => e.querySelector('.bl-cmh')).map(e => { const x = e.cloneNode(true); x.querySelectorAll('.bl-stag').forEach(t => t.remove());
    return [txt(x.querySelector('.bl-cmh')), ...[...x.querySelectorAll('.bl-cm')].map(txt)]; });
  const curTag = cur ? (cur.querySelector('.bl-cmh .bl-stag') ? 'head' : cur.querySelector('.bl-stag') ? 'end' : 'none') : 'none';
  return { small: txt(small), name: nameOf(now), say: txt(w.querySelector('.bl-rsay')), step: nameOf(cur), curTag, stacked: !!list,
    listOk: !list || (list.getAttribute('role') === 'list' && [...list.children].every(e => e.getAttribute('role') === 'listitem')),
    oneLine: items.every((r, i) => !i || r.top >= items[i - 1].bottom - 1), stacks, card: w.textContent, found,
    last: kv ? txt(kv.querySelector('dd').childNodes[0]) : '', acts, foldSays: txt(more?.querySelector('.bl-rfp')),
    orig: orig ? orig.getAttribute('href') : '', menu: menu ? menu.getAttribute('href') : '-', origText: txt(orig?.closest('p')).replace(' .', '.'),
    origH: orig ? orig.getBoundingClientRect().height : 0,
    sideways: document.documentElement.scrollWidth > innerWidth + 1, nCodes: codes.size }; }"""

async def main():
    async with async_playwright() as p:
        br = await p.chromium.launch()
        for W, H, tag in ((390, 844, 'phone'), (360, 740, 'phone360'), (1280, 800, 'laptop')):
            ctx = await br.new_context(viewport={'width': W, 'height': H}, is_mobile=W < 600, has_touch=W < 600)
            await ctx.add_init_script(INIT)
            if BASE == 'http://wt.local': await ctx.route('http://wt.local/**', serve)
            pg = await ctx.new_page(); errs = []
            pg.on('pageerror', lambda e: errs.append(str(e)))
            for num, kind, followed, want in BILLS:
                await pg.goto(f'{BASE}/track.html?demo=1#/bill/2026/{num}')
                await pg.wait_for_selector('#main .bl-rwhere .bl-rnow', timeout=60000); await pg.wait_for_timeout(1200)
                r = await pg.evaluate(READ)
                t = f'{tag} {num} ({kind})'
                if SHOTS: await pg.screenshot(path=os.path.join(SHOTS, f'step_line_{tag}_{num}.png'), full_page=True)
                for k in ('small', 'name', 'say'):
                    if k in want: check(r[k] == want[k], f'{t}: {k} reads {want[k]!r} ({r[k]!r})')
                if 'say_start' in want: check(r['say'].startswith(want['say_start']), f'{t}: the sentence starts {want["say_start"]!r} ({r["say"][:140]!r})')
                # the step line names the committee: "In the ... Committee", or stacked under "In two Senate committees, together:"
                m = re.match(r'^(In|Got as far as) (?:the )?(.*)$', r['name'])
                joint = bool(m and re.match(r'^(two|three|four) (Senate|House) committees, together: ', m.group(2)))
                check(m and (m.group(2).endswith('Committee') or joint), f'{t}: the step line says it is a committee ({r["name"]!r})')
                check(joint == r['stacked'] and r['listOk'], f'{t}: committees heard together are a list, one name per line ({r["stacked"]})')
                check(r['oneLine'], f'{t}: each committee starts a line of its own at {W}px')
                named = m.group(2) if m else ''
                # one way on the card: See all steps names the step in the same words, its tag on the first line
                check(r['step'].lower() == named.lower(), f'{t}: See all steps names it the same way ({r["step"]!r})')
                check(not joint or r['curTag'] == 'head', f'{t}: the step\'s tag sits on its first line ({r["curTag"]})')
                # the chamber once: the small line does not say it when the step line does
                ch = 'Senate' if 'Senate' in r['name'] else 'House' if 'House' in r['name'] else ''
                check(not ch or ch not in r['small'], f'{t}: "{ch}" is said once ({r["small"]!r} over {r["name"]!r})')
                # said once (A-14): the sentence does not name the step's committee(s) again
                names = named.split(': ', 1)[1].split(' | ') if joint else [re.sub(r'^(Senate|House) | Committee$', '', named)]
                again = [n for n in names if n and re.search(r'\b' + re.escape(n) + r' Committee\b', r['say'])]
                check(not again, f'{t}: the sentence under it does not name {again or "the committee"} again ({r["say"][:120]!r})')
                # never the old joint forms on the card: "two Senate committees: A, and B", nor "the X Committee and Y Committee"
                check(not re.search(r'\b(?:[Tt]wo|[Tt]hree|[Ff]our) (?:Senate|House) committees: |Committee and (?!the )[A-Z]', r['card']), f'{t}: no run-on joint name on the card')
                check(r['nCodes'] > 20 and not r['found'], f'{t}: no committee code anywhere on the page, every fold open ({r["found"]})')
                if 'stack' in want: check(want['stack'] in r['stacks'], f'{t}: See all steps stacks the earlier pair ({r["stacks"]})')
                # More details
                acts = [a['t'] for a in r['acts']]
                check(not any(re.search(r'deferred|measure|recommend|passed a vote', a, re.I) for a in acts), f'{t}: Every official action in plain words, "Passed" only for a chamber\'s passing vote')
                if followed:
                    check(len(acts) > 3 and not r['last'], f'{t}: {len(acts)} official actions, and no separate "Last official action" (it is the first row, A-14)')
                    check('official action' in r['foldSays'] and r['origText'].startswith('The Capitol’s own wording for each action is on the'), f'{t}: the fold and the link name the list ({r["foldSays"]!r}, {r["origText"]!r})')
                else:
                    check(not acts and r['last'] and not re.search(r'deferred|measure|recommend|[A-Z]{3}', r['last']), f'{t}: no list, so the last action has its row, in plain words ({r["last"][:100]!r})')
                    check('official action' not in r['foldSays'] and r['origText'] == 'Every official action is on the Capitol bill page.', f'{t}: the fold promises no list, the link says where every action is ({r["foldSays"]!r}, {r["origText"]!r})')
                if 'day' in want:
                    i = next((k for k, a in enumerate(acts) if a.startswith(want['day'][0])), -1)
                    check(i >= 0 and acts[i + 1:i + 3] == want['day'][1:] and r['acts'][i]['d'] == r['acts'][i + 2]['d'],
                          f'{t}: one day\'s actions in the order they happened, newest first ({acts[max(i, 0):i + 3]})')
                # the same address as the menu's "Capitol bill page" (the Capitol's, or Open States' copy of it where the sync has that), a link in its sentence
                check(r['orig'] and r['orig'] == r['menu'], f'{t}: a quiet line points to the Capitol\'s own wording ({r["orig"]})')
                check(0 < r['origH'] < 32, f'{t}: its link stays in the running text, not a 44px block ({r["origH"]:.0f}px)')
                check(not r['sideways'], f'{t}: no sideways scroll')
            check(not errs, f'{tag}: no page errors {errs[:3]}')
            await ctx.close()
        await br.close()
    print(f'\n{ok} passed, {fail} failed')
    sys.exit(1 if fail else 0)

asyncio.run(main())
