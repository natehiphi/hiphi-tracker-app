# Where a bill stands, in six words, written once (R-212 #44), on the practice copy, with R-333 and R-309 from the same build.
#   The one rule: a bill on the Governor's desk or a change to the constitution sent to the voters has "Passed the
#     Legislature" and is still moving (the voters' amendment used to count as "did not advance" on Find and My issues);
#     law, vetoed, deferred and dead land where All bills puts them; a bill heard and waiting for the decision is with its hearing.
#   All bills: its group names are the six words, and "What the groups mean" opens Help's answer with all six.
#   R-333: Home's hearing card for a bill HIPHI opposes says "help stop it", never "help it pass".
#   R-309: the legislators' list on the address page clips sideways on every page, not only on pages trying a moment.
# Run: python3 tests/stands_page.py [base]  (no base: files served straight from this copy)
import sys, os, json, asyncio
from urllib.parse import urlparse, unquote
from playwright.async_api import async_playwright

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://wt.local').rstrip('/').replace('/track.html', '')
ok = fail = 0
def check(cond, what):
    global ok, fail
    if cond: ok += 1; print('PASS', what)
    else: fail += 1; print('FAIL', what)

STANDS = json.loads(__import__('subprocess').check_output(['node', '--input-type=module', '-e',
  f"import {{ STANDS }} from '{os.path.join(HERE, 'pub', 'stands.js')}'; console.log(JSON.stringify(STANDS))"]))
WORDS = [s['word'] for s in STANDS]

async def serve(route):
    f = os.path.join(HERE, unquote(urlparse(route.request.url).path).lstrip('/'))
    await (route.fulfill(path=f) if os.path.isfile(f) else route.fulfill(status=404, body='not found'))

# Past the first visit, nothing followed: the pages draw as for a returning visitor.
INIT = """(() => { if (sessionStorage.getItem('__set')) return; sessionStorage.setItem('__set', '1');
  for (const k of Object.keys(localStorage)) if (k.startsWith('hiphi_')) localStorage.removeItem(k);
  const set = (k, v) => localStorage.setItem(k + '_demo', JSON.stringify(v));
  set('hiphi_wiz', { done: true, issues: [] }); set('hiphi_onb', { lastVisit: new Date(Date.now() - 864e5).toISOString() });
  localStorage.setItem('hiphi_tour_home_demo', '{"how":"test"}'); localStorage.setItem('hiphi_tour_bill_demo', '{"how":"test"}'); })();"""

RULE = """async () => {
  const c = await import('./pub/core.js'), m = await import('./pub/mybills.js');
  const b = (stage, x = {}) => ({ id: 'x-' + stage + (x.last_action || ''), bill_number: 'HB9999', session_year: 2026, stage, ...x });
  const rows = { ballot: b('ballot'), governor: b('governor'), enacted: b('enacted'), vetoed: b('vetoed'), dead: b('dead'),
    deferred: b('first_lateral', { last_action: 'The committee(s) on HLT deferred the measure.' }) };
  return Object.fromEntries(Object.entries(rows).map(([k, x]) => [k, { end: c.endOf(x), stand: c.standOf(x), moving: m.moving(x), law: m.becameLaw(x), stopped: m.stopped(x) }]));
}"""

async def main():
    async with async_playwright() as p:
        br = await p.chromium.launch()
        ctx = await br.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
        await ctx.add_init_script(INIT)
        if BASE == 'http://wt.local': await ctx.route('http://wt.local/**', serve)
        pg = await ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))

        # ---- the one rule ----
        await pg.goto(f'{BASE}/track.html?demo=1#/allbills')
        await pg.wait_for_selector('.ab-grp, .ab details, .ab .empty', timeout=60000); await pg.wait_for_timeout(600)
        r = await pg.evaluate(RULE)
        for k in ('ballot', 'governor'):
            check(r[k]['stand'] == 'passed' and r[k]['moving'] and not r[k]['stopped'], f'{k}: Passed the Legislature, still moving ({r[k]})')
        check(r['enacted']['stand'] == 'law' and r['enacted']['law'] and not r['enacted']['moving'], f"enacted: Became law ({r['enacted']})")
        for k in ('vetoed', 'dead', 'deferred'):
            check(r[k]['stand'] == 'dead' and r[k]['stopped'] and not r[k]['moving'], f'{k}: Did not advance ({r[k]})')

        # ---- All bills: the six words, and what they mean ----
        heads = await pg.evaluate("[...document.querySelectorAll('.ab-grp h2, .ab details > summary')].map(e => e.innerText.replace(/\\s*·.*$/s, '').trim())")
        check(heads and all(h in WORDS for h in heads), f'All bills groups are named from the six words ({heads})')
        check('Waiting in committee' not in await pg.inner_text('main'), 'no "Waiting in committee" (one name, C-15)')
        link = pg.locator('a[href="#/help/where-a-bill-stands"]')
        check(await link.count() == 1, '"What the labels mean" below the list')
        await link.click(); await pg.wait_for_selector('.tk-turn', timeout=20000); await pg.wait_for_timeout(400)
        txt = await pg.inner_text('main')
        check('What do labels like' in txt, 'it opens Help: "What do labels like “Waiting for a hearing” mean?"')
        # Help shows the first exchange; the rest open one by one, so the words come from its data (help_talk.py checks the page)
        check(all(w in txt for w in WORDS[:2]), f'Help names the first two words on arrival ({WORDS[:2]})')

        # ---- R-333: an opposed bill's hearing card ----
        await pg.goto(f'{BASE}/track.html?demo=1#/'); await pg.wait_for_timeout(1500)
        say = await pg.evaluate("""async () => { const c = await import('./pub/core.js');
          const opp = c.S.bills.filter(b => /oppose/.test(b.hiphi_position || '') && !b.hiphi_action).map(b => b.id);
          return { opp: opp.length, cards: [...document.querySelectorAll('main')].map(m => m.innerText).join(' ') }; }""")
        check('help it pass' not in say['cards'] or say['opp'] == 0, 'Home never asks to "help it pass" when the only card is an opposed bill')
        src = open(os.path.join(HERE, 'pub', 'calm', 'home.js')).read()
        check("opp = /oppose/.test(b.hiphi_position || '')" in src and "b.position === 'oppose'" not in src, "the card reads HIPHI's side from hiphi_position, both strengths")

        # ---- R-309: the legislators' list clips sideways on every page ----
        ov = await pg.evaluate("""() => { const u = document.createElement('ul'); u.className = 'st-legs'; document.body.append(u);
          const v = getComputedStyle(u).overflowX; u.remove(); return [v, document.documentElement.classList.contains('fx-try')]; }""")
        check(ov[0] == 'clip' and not ov[1], f'.st-legs clips sideways without the trial class ({ov})')

        check(not errs, f'no page errors {errs[:3]}')
        await br.close()
    print(f'\n{ok} passed, {fail} failed')
    sys.exit(1 if fail else 0)

asyncio.run(main())
