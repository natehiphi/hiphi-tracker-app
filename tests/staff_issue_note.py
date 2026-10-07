# R-095 (Nate 10/5, "Build it"): a quiet note on an issue's staff page when one of its bills goes against the issue's stance. Nothing
# changes by itself; staff decide whether the issue should become Mixed.
#   python3 tests/staff_issue_note.py [base]      base defaults to http://localhost:8832
import sys, os, re
from playwright.sync_api import sync_playwright
BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832').rstrip('/') + '/staff.html?demo=1'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out', 'issue_note'); os.makedirs(OUT, exist_ok=True)
res, errors = [], []
def ok(c, m): res.append(bool(c)); print('PASS' if c else 'FAIL', m)
def go(p, hash, wait=2800): p.goto(BASE + '#' + hash.lstrip('#')); p.reload(); p.wait_for_timeout(wait)
def issue(p, slug):   # the staff page is addressed by the issue's id
    iid = p.evaluate("async (s) => (await import('./staff/data.js')).S.issues.find(x => x.slug === s).id", slug)
    go(p, f'/issue/{iid}')
with sync_playwright() as pw:
    b = pw.chromium.launch()
    for name, w, h, mob in (('laptop', 1280, 900, False), ('phone', 390, 844, True)):
        c = b.new_context(viewport={'width': w, 'height': h}, is_mobile=mob); p = c.new_page(); p.on('pageerror', lambda e: errors.append(str(e)))
        go(p, '/'); issue(p, 'higher-liquor-taxes')
        t = p.locator('.is-stnote')
        ok(t.count() == 1, f'{name}: "Higher liquor taxes" (Support) has the note: its tax-cut bills are opposed')
        txt = t.inner_text() if t.count() else ''
        ok('go against its stance' in txt and 'HIPHI supports it' in txt and 'HB939' in txt and 'opposes it' in txt and 'nothing has changed' in txt.lower() and 'Mixed' in txt, f'{name}: it names the bills, what HIPHI says of each, and that nothing changed ({txt[:150]!r})')
        ok(t.locator('a[href^="#/bill/"]').count() >= 3 and 'more' in txt or t.locator('a[href^="#/bill/"]').count() >= 1, f'{name}: each bill is a link')
        ok(p.locator('.is-stnote .notice, .is-stnote .chip').count() == 0 and p.evaluate("getComputedStyle(document.querySelector('.is-stnote')).backgroundColor") in ('rgba(0, 0, 0, 0)', 'transparent'), f'{name}: quiet: no box and no chip')
        ok(p.evaluate("(() => { const e = document.querySelector('.is-stnote'); return parseFloat(getComputedStyle(e).fontSize) <= 14.5; })()"), f'{name}: small type')
        p.screenshot(path=f'{OUT}/{name}.png')
        p.locator('.is-stnote [data-is=stance]').click(); p.wait_for_timeout(600)
        ok(p.locator('dialog[open]').count() == 1 and 'stance' in p.locator('dialog[open]').inner_text().lower(), f'{name}: "Change the stance" opens the same picker as the chip')
        p.keyboard.press('Escape'); p.wait_for_timeout(300)
        ok(not p.evaluate('document.documentElement.scrollWidth > innerWidth'), f'{name}: no sideways scroll')
        # Mixed: the issue says so itself, no note
        p.evaluate("async () => { const m = await import('./staff/data.js'); m.S.issues.find(x => x.slug === 'higher-liquor-taxes').stance = 'mixed'; m.hooks.render(); }"); p.wait_for_timeout(500)
        ok(p.locator('.is-stnote').count() == 0, f'{name}: set to Mixed, the note goes (there is nothing left to point out)')
        issue(p, 'looser-alcohol-sales-rules'); ok(p.locator('.is-stnote').count() == 0, f'{name}: an Oppose issue whose bills all oppose has no note')
        issue(p, 'disposable-e-cigarette-ban'); ok(p.locator('.is-stnote').count() == 0, f'{name}: a Support issue whose bills all support has no note')
        issue(p, 'end-non-medical-vaccine-exemptions'); tx = p.locator('.is-stnote').inner_text() if p.locator('.is-stnote').count() else ''
        ok('One bill on this issue goes against' in tx and 'HB2166' in tx, f'{name}: one bill says "One bill ... goes" ({tx[:80]!r})')
        c.close()
    b.close()
ok(not [e for e in errors if 'Failed to fetch' not in e], f'no page errors {errors[:3]}')
print(f'{sum(res)} passed, {len(res) - sum(res)} failed')
sys.exit(1 if not all(res) else 0)
