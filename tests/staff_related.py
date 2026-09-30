# Staff v2: an issue's "Related issues" (095, R-094). python3 tests/staff_related.py [base]
# Someone following an issue is shown its related issues' bills first on the public tracker. The related-issues tool
# finds them from the words their bills use (checked by Nate 9/30); staff unlink one, link another, and undo either.
# Checks, in the sandbox at a phone and a laptop: the section lists the related issues with each one's bill count;
# Unlink moves a row to "Unlinked by staff" and Undo brings it back; "Link another issue" opens a picker that leaves
# out the issue itself and those already linked, and a pick lands in the list as "Linked by staff"; "Link again"
# restores; every control is a real button with a name, 44px on a phone (A-6); no page errors.
import re, sys
from playwright.sync_api import sync_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832/staff.html?demo=1'
ok = fail = 0
def check(c, m):
    global ok, fail
    print('PASS' if c else 'FAIL', m); ok += bool(c); fail += (not c)

ROWS = """() => { const s = document.getElementById('is-rh')?.closest('section'); if (!s) return null;
  const on = [...s.querySelectorAll(':scope > ol .le-brow')].map(li => ({ name: li.querySelector('.le-nick')?.textContent, sub: li.querySelector('.le-bsum')?.textContent }));
  const off = [...s.querySelectorAll('details .le-brow')].map(li => li.querySelector('.le-nick')?.textContent);
  return { on, off, count: s.querySelector('.le-sechead .meta')?.textContent || '' }; }"""

with sync_playwright() as p:
    br = p.chromium.launch()
    for w, h, mob in [(390, 844, True), (1280, 900, False)]:
        errs = []
        ctx = br.new_context(viewport={'width': w, 'height': h}, is_mobile=mob, has_touch=mob)
        pg = ctx.new_page(); pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
        pg.on('console', lambda m: errs.append(m.text[:200]) if m.type == 'error' else None)
        pg.goto(BASE + '#/outreach/issues'); pg.wait_for_timeout(4000)
        iid = pg.evaluate("""async () => { const d = await import('./staff/data.js'); return d.S.issues.find(i => i.name.startsWith('Free school meals for every'))?.id; }""")
        pg.evaluate(f"location.hash = '#/issue/{iid}'"); pg.wait_for_timeout(1500)
        r = pg.evaluate(ROWS)
        tag = f'{w}px:'
        check(r and len(r['on']) == 4, f"{tag} the section lists the four related school-meal issues ({[x['name'] for x in (r or {}).get('on', [])]})")
        check(r and all(re.match(r'^\d+ bills?$', x['sub'] or '') for x in r['on']), f"{tag} each row gives the other issue's bill count, nothing repeated ({[x['sub'] for x in r['on']]})")
        check(r and r['count'] == '4 issues', f"{tag} the heading counts them once ({r and r['count']})")
        # Unlink the first, then Undo.
        first = r['on'][0]['name']
        pg.locator(f'[aria-label="Unlink {first} from Free school meals for every student"]').click(); pg.wait_for_timeout(600)
        r2 = pg.evaluate(ROWS)
        check(first not in [x['name'] for x in r2['on']] and first in r2['off'], f'{tag} Unlink moves it to "Unlinked by staff"')
        offsub = pg.evaluate("document.querySelector('details.is-arch:last-of-type .le-bsum')?.textContent || ''")
        check('Unlinked by NT' in offsub, f'{tag} and says who unlinked it and when ({offsub})')
        toast = pg.evaluate("document.querySelector('.toastmsg')?.innerText || ''")
        check('Unlinked' in toast, f'{tag} a toast says so ({toast[:40]!r})')
        pg.get_by_role('button', name='Undo').first.click(); pg.wait_for_timeout(700)
        r3 = pg.evaluate(ROWS)
        check(first in [x['name'] for x in r3['on']] and not r3['off'], f'{tag} Undo puts it back')
        # Link another issue through the picker.
        pg.locator('[data-is="link"]').click(); pg.wait_for_timeout(700)
        names = pg.evaluate("[...document.querySelectorAll('[data-linkto] .title')].map(e => e.textContent)")
        check(names and 'Free school meals for every student' not in names and first not in names, f'{tag} the picker leaves out the issue itself and those already linked ({len(names)} shown)')
        pg.locator('#is-lq').fill('SNAP'); pg.wait_for_timeout(300)
        pick = pg.evaluate("document.querySelector('[data-linkto] .title')?.textContent")
        pg.locator('[data-linkto]').first.click(); pg.wait_for_timeout(900)
        r4 = pg.evaluate(ROWS)
        new = next((x for x in r4['on'] if x['name'] == pick), None)
        check(new is not None and new['sub'].endswith('Linked by staff'), f"{tag} the picked issue is linked, marked 'Linked by staff' ({pick}: {new and new['sub']})")
        # Unlink a found one and use "Link again".
        pg.locator(f'[aria-label="Unlink {first} from Free school meals for every student"]').click(); pg.wait_for_timeout(600)
        pg.locator('details.is-arch summary').last.click(); pg.wait_for_timeout(300)
        pg.locator('[data-isrelink]').first.click(); pg.wait_for_timeout(700)
        r5 = pg.evaluate(ROWS)
        check(first in [x['name'] for x in r5['on']] and not r5['off'], f'{tag} "Link again" restores it')
        # A-6 and names.
        small = pg.evaluate("""() => { const s = document.getElementById('is-rh').closest('section');
          return [...s.querySelectorAll('button, a')].filter(e => e.offsetParent).map(e => { const r = e.getBoundingClientRect(); return { n: e.getAttribute('aria-label') || e.textContent.trim(), h: Math.round(r.height), w: Math.round(r.width) }; })
            .filter(x => x.h < 44 || !x.n); }""")
        check(not mob or not small, f'{tag} every control in the section is at least 44px tall and named ({small[:3]})')
        check(not errs, f'{tag} no page errors ({errs[:2]})')
        ctx.close()
    br.close()
print(f'{ok} passed, {fail} failed'); sys.exit(1 if fail else 0)
