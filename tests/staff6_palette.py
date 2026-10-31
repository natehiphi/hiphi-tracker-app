"""Staff v6 Colors (R-336, Nate 10/25): HIPHI Family is the default; anyone can pick another palette in My settings, it
changes the app at once, survives a reload, belongs to that person only, and Back to HIPHI Family undoes it. Also: the
palette files are current (tools/staff6_palettes.js --check) and no screen errors in any palette.
Usage: python3 tests/staff6_palette.py [base]   (default http://localhost:8832); SHOTS=dir saves screenshots."""
import os, sys, subprocess
from playwright.sync_api import sync_playwright

BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832').rstrip('/')
SHOTS = os.environ.get('SHOTS')
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
fails = []
def check(ok, what):
  print(('ok   ' if ok else 'FAIL ') + what)
  if not ok: fails.append(what)

r = subprocess.run(['node', os.path.join(ROOT, 'tools/staff6_palettes.js'), '--check'], capture_output=True, text=True)
check(r.returncode == 0, 'palette files current and every palette at WCAG AA: ' + (r.stdout or r.stderr).strip())

def var(pg, name): return pg.evaluate(f"getComputedStyle(document.body).getPropertyValue('{name}').trim().toUpperCase()")
def shot(pg, n):
  if SHOTS: os.makedirs(SHOTS, exist_ok=True); pg.screenshot(path=os.path.join(SHOTS, n + '.png'))

with sync_playwright() as p:
  b = p.chromium.launch(); ctx = b.new_context(viewport={'width': 1366, 'height': 900}); pg = ctx.new_page()
  errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
  pg.goto(BASE + '/staff6.html?demo=1&as=NT#/'); pg.wait_for_selector('h1', timeout=20000); pg.wait_for_timeout(1500)
  check(var(pg, '--v6-page') == '#F4F7F9' and var(pg, '--v6-action') == '#00698E', 'the default is HIPHI Family (page #F4F7F9, buttons #00698E)')
  check(pg.evaluate("document.querySelector('meta[name=theme-color]').content") == '#F4F7F9', 'the phone bar colour is the default page')
  shot(pg, 'today-default')
  pg.goto(BASE + '/staff6.html?demo=1&as=NT#/me'); pg.wait_for_selector('#me-colh', timeout=20000); pg.wait_for_timeout(800)
  check(pg.locator('.me-colors summary').inner_text().strip().startswith('Your colors: HIPHI Family'), 'My settings says "Your colors: HIPHI Family"')
  pg.click('.me-colors summary'); pg.wait_for_timeout(300)
  n = pg.locator('input[name="me-col"]').count(); check(n == 25, f'25 palettes to pick from ({n})')
  shot(pg, 'settings-open')
  pg.locator('label.me-col', has_text='Lilikoʻi').click(); pg.wait_for_timeout(1500)
  check(var(pg, '--v6-action') == '#5E3F99', 'picking Lilikoʻi changes the app at once')
  check('Lilikoʻi' in pg.locator('#toast').inner_text() and pg.locator('#toast .toastundo').count() == 1, 'a toast says the new colours, with Undo')
  check(pg.locator('[data-coldef]').is_visible(), 'Back to HIPHI Family is at the top of Colors')
  check(pg.locator('.me-colors').get_attribute('open') is not None, 'the fold stays open after a pick')
  shot(pg, 'settings-lilikoi')
  pg.reload(); pg.wait_for_selector('#me-colh', timeout=20000); pg.wait_for_timeout(600)
  check(pg.evaluate("document.documentElement.dataset.palette") == 'lilikoi' and var(pg, '--v6-action') == '#5E3F99', 'the pick survives a reload')
  for route in ['/', '/issues/bills', '/bill/HB1562', '/hearings', '/testimony', '/legislators', '/inbox', '/team']:
    pg.goto(BASE + '/staff6.html?demo=1&as=NT#' + route); pg.wait_for_timeout(1200)
  shot(pg, 'team-lilikoi')
  check(not errs, 'no errors on eight screens in Lilikoʻi' + (': ' + errs[0] if errs else ''))
  pg.goto(BASE + '/staff6.html?demo=1&as=PT#/'); pg.wait_for_selector('h1', timeout=20000); pg.wait_for_timeout(1200)
  check(var(pg, '--v6-action') == '#00698E', "Patti keeps HIPHI Family: Nate's pick is his own")
  pg.goto(BASE + '/staff6.html?demo=1&as=NT#/me'); pg.wait_for_selector('#me-colh', timeout=20000); pg.wait_for_timeout(600)
  pg.click('[data-coldef]'); pg.wait_for_timeout(700)
  check(var(pg, '--v6-action') == '#00698E' and pg.evaluate("document.documentElement.dataset.palette") is None, 'Back to HIPHI Family undoes it')
  pg.set_viewport_size({'width': 375, 'height': 812}); pg.click('.me-colors summary'); pg.wait_for_timeout(300); pg.locator('#me-colh').scroll_into_view_if_needed(); shot(pg, 'phone-open')
  b.close()
print(f'\n{len(fails)} failed' if fails else '\nall passed'); sys.exit(1 if fails else 0)
