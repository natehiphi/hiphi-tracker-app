# The step line in plain words, each committee named once and one way (R-212 #45; DESIGN C-15, A-14, C-10), on the practice
# copy's bill pages at phone (390x844) and laptop (1280x800) sizes, every fold open:
#   - "Where it is now" says where the bill is: "In the Senate Health and Human Services Committee", or, for committees that
#     hear it together, C-15's joint form, "In two Senate committees: Water, Land, Culture and the Arts; and Public Safety and
#     Military Affairs"; a bill that did not advance says "Got as far as ..." in the same words.
#   - See all steps names the step in the same words, the small line over it does not say the chamber again, and the sentence
#     under it does not say the committee's long name again ("The two committees hear it together Mon, Mar 16 at 3:01 PM.").
#   - No committee code anywhere on the page ("Referred to HHS/EIG, CPN/JDC."): the Capitol's action lines are said through
#     pub/capitol.js, and More details points to the Capitol's own wording on its bill page.
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
# bill, what its step is (in the practice copy's 16 March 2026), and the words the brief's examples expect
BILLS = [
    ('HB1926', 'joint, hearing set', {'small': 'Step 6 of 10', 'name': 'In two Senate committees: Water, Land, Culture and the Arts; and Public Safety and Military Affairs',
                                      'say': 'Passed the House. The two committees hear it together Mon, Mar 16 at 3:01 PM.'}),
    ('HB1853', 'one committee, hearing set', {'small': 'Step 5 of 9', 'name': 'In the Senate Health and Human Services Committee', 'say': 'Passed the House. The committee hears it Wed, Mar 18 at 1:00 PM.'}),
    ('HB1563', 'joint, waiting', {'name': 'In two Senate committees: Health and Human Services, and Energy and Intergovernmental Affairs'}),
    ('HB1314', 'did not advance, one committee', {'small': 'Did not advance', 'name': 'Got as far as the House Health Committee'}),
    ('HB1123', 'did not advance, joint', {'name': 'Got as far as two House committees: Health, and Human Services & Homelessness',
                                          'say_start': 'The two committees never scheduled a hearing on it.'}),
    # its sentence names the pair before (heard together) in See all steps' words, not "the House Energy & Environmental
    # Protection Committee and Agriculture & Food Systems Committee"
    ('HB1617', 'did not advance, after a joint step', {'name': 'Got as far as the House Finance Committee',
                                                        'say_start': 'The two House committees (Energy & Environmental Protection, and Agriculture & Food Systems) passed it'}),
]
# Past the first visit, the bills followed (so Every official action is drawn) and every card of the page open.
INIT = """(ids => { if (sessionStorage.getItem('__set')) return; sessionStorage.setItem('__set', '1');
  for (const k of Object.keys(localStorage)) if (k.startsWith('hiphi_')) localStorage.removeItem(k);
  const set = (k, v) => localStorage.setItem(k + '_demo', JSON.stringify(v));
  set('hiphi_wiz', { done: true, issues: [] }); set('hiphi_onb', { lastVisit: new Date(Date.now() - 864e5).toISOString() });
  localStorage.setItem('hiphi_watch_ids_demo', JSON.stringify(ids));
  localStorage.setItem('hiphi_tour_home_demo', '{"how":"test"}'); localStorage.setItem('hiphi_tour_bill_demo', '{"how":"test"}');
  localStorage.setItem('hiphi_recfold', JSON.stringify(['who', 'about', 'more', 'others'])); })(%s);""" % json.dumps([ID[(n, 2026)] for n, _, _ in BILLS])

READ = """async () => {
  document.querySelectorAll('#main details').forEach(d => d.open = true);
  await new Promise(r => setTimeout(r, 300));
  const c = await import('./pub/core.js'), cap = await import('./pub/capitol.js');
  const w = document.querySelector('#main .bl-rwhere'), now = w.querySelector('.bl-rnow'), small = now.querySelector('small');
  const cur = w.querySelector('.bl-rsteps li.bl-s-now .bl-rsn, .bl-rsteps li.bl-s-stop .bl-rsn');
  const codes = new Set([...Object.keys(c.S.committees || {}), ...Object.keys(cap.RETIRED)]);
  const main = document.querySelector('#main').textContent;
  const found = [...new Set((main.match(/\\b[A-Z]{2,4}\\b/g) || []).filter(t => codes.has(t)))];
  const more = document.querySelector('[data-bl-rfold="more"]');
  const kv = [...(more?.querySelectorAll('.bl-kv') || [])].find(e => /Last official action/.test(e.textContent));
  const acts = [...(more?.querySelectorAll('[data-bl-fold="rd-actions"] li') || [])].map(li => li.textContent.trim());
  const orig = more?.querySelector('.bl-rorig a'), menu = document.querySelector('#main .bl-menu a[data-ab-go="capitol"]');
  return { small: small ? small.textContent.trim() : '', name: now.textContent.replace(small ? small.textContent : '', '').trim(),
    say: (w.querySelector('.bl-rsay')?.textContent || '').trim(), step: cur ? cur.childNodes[0].textContent.trim() : '',
    card: w.textContent, found, last: kv ? kv.querySelector('dd').childNodes[0].textContent : '', acts,
    orig: orig ? orig.getAttribute('href') : '', menu: menu ? menu.getAttribute('href') : '-', origText: orig ? orig.closest('p').textContent.replace(/\s+/g, ' ').replace(' .', '.').trim() : '',
    sideways: document.documentElement.scrollWidth > innerWidth + 1, nCodes: codes.size }; }"""

async def main():
    async with async_playwright() as p:
        br = await p.chromium.launch()
        for W, H, tag in ((390, 844, 'phone'), (1280, 800, 'laptop')):
            ctx = await br.new_context(viewport={'width': W, 'height': H}, is_mobile=W < 600, has_touch=W < 600)
            await ctx.add_init_script(INIT)
            if BASE == 'http://wt.local': await ctx.route('http://wt.local/**', serve)
            pg = await ctx.new_page(); errs = []
            pg.on('pageerror', lambda e: errs.append(str(e)))
            for num, kind, want in BILLS:
                await pg.goto(f'{BASE}/track.html?demo=1#/bill/2026/{num}')
                await pg.wait_for_selector('#main .bl-rwhere .bl-rnow', timeout=60000); await pg.wait_for_timeout(1200)
                r = await pg.evaluate(READ)
                t = f'{tag} {num} ({kind})'
                if SHOTS: await pg.screenshot(path=os.path.join(SHOTS, f'step_line_{tag}_{num}.png'), full_page=True)
                for k in ('small', 'name', 'say'):
                    if k in want: check(r[k] == want[k], f'{t}: {k} reads {want[k]!r} ({r[k]!r})')
                if 'say_start' in want: check(r['say'].startswith(want['say_start']), f'{t}: the sentence starts {want["say_start"]!r} ({r["say"][:140]!r})')
                # the step line names the committee: "In the ... Committee", "In two Senate committees: ...", "Got as far as ..."
                m = re.match(r'^(In|Got as far as) (?:the )?(.*)$', r['name'])
                check(m and (m.group(2).endswith('Committee') or re.match(r'^(two|three|four) (Senate|House) committees: ', m.group(2))), f'{t}: the step line says it is a committee ({r["name"]!r})')
                named = m.group(2) if m else ''
                # one way on the card: See all steps names the step in the same words
                check(r['step'].lower() == named.lower(), f'{t}: See all steps names it the same way ({r["step"]!r})')
                # the chamber once: the small line does not say it when the step line does
                ch = 'Senate' if 'Senate' in r['name'] else 'House' if 'House' in r['name'] else ''
                check(not ch or ch not in r['small'], f'{t}: "{ch}" is said once ({r["small"]!r} over {r["name"]!r})')
                # said once (A-14): the sentence does not name the step's committee(s) again
                names = re.split(r'; and |; |, and | and (?=[A-Z])|, ', named.split(': ', 1)[1]) if ': ' in named else [re.sub(r'^(Senate|House) | Committee$', '', named)]
                again = [n for n in names if n and re.search(r'\b' + re.escape(n) + r'\b', r['say'])]
                check(not again, f'{t}: the sentence under it does not name {again or "the committee"} again ({r["say"][:120]!r})')
                # never the two-forms joint ("the Senate X Committee and Y Committee") on the card, never a code on the page
                check(not re.search(r'Committee and [A-Z][^.]* Committee', r['card']), f'{t}: no committee pair in the sentence form on the card')
                check(r['nCodes'] > 20 and not r['found'], f'{t}: no committee code anywhere on the page, every fold open ({r["found"]})')
                # More details: the Capitol's lines in plain words, and where its own wording is
                check(r['acts'] and all(not re.search(r'deferred|measure|recommend', a, re.I) for a in r['acts']), f'{t}: Every official action, {len(r["acts"])} lines in plain words ({(r["acts"] or [""])[0][:90]!r})')
                check(r['last'] and not re.search(r'deferred|measure|recommend', r['last'], re.I), f'{t}: Last official action in plain words ({r["last"][:110]!r})')
                # the same address as the menu's "Capitol bill page" (the Capitol's, or Open States' copy of it where the sync has that)
                check(r['orig'] and r['orig'] == r['menu'] and 'own wording' in r['origText'], f'{t}: a quiet line points to the Capitol\'s own wording ({r["origText"]!r}, {r["orig"]})')
                check(not r['sideways'], f'{t}: no sideways scroll')
            check(not errs, f'{tag}: no page errors {errs[:3]}')
            await ctx.close()
        await br.close()
    print(f'\n{ok} passed, {fail} failed')
    sys.exit(1 if fail else 0)

asyncio.run(main())
