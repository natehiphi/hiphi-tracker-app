# The English page is the same after the words moved into t() (R-166 step 3): the same screens drawn by two trees, the one before
# (OLD) and this one, with the markup compared exactly. Not in CI (it needs the old tree served): run it after a conversion.
#   python3 tests/i18n_same.py http://localhost:8890/track.html http://localhost:8879/track.html
import re, sys
from playwright.sync_api import sync_playwright
OLD, NEW = sys.argv[1], sys.argv[2]
SCREENS = [('first screen, in session', '?demo=1&restart#/start/1'), ('first screen, between sessions', '?demo=1&restart&season=off#/start/1'),
           ('More', '?demo=1&codes=0&fv=full&end=today#/more'), ('More, with a profile', '?demo=1&codes=0&fv=full&end=today&profile#/more')]
def grab(b, base, q):
    p = b.new_page(viewport={'width': 390, 'height': 844}); p.goto(base + q); p.wait_for_timeout(3500)
    h = p.evaluate("document.querySelector('#main, main, #app')?.innerHTML || ''"); p.close(); return re.sub(r'\s+', ' ', h)   # blank lines where a part draws nothing are not a difference
bad = 0
with sync_playwright() as pw:
    b = pw.chromium.launch()
    for name, q in SCREENS:
        a, c = grab(b, OLD, q), grab(b, NEW, q)
        same = a == c and len(a) > 200
        print(('PASS ' if same else 'FAIL ') + f'{name}: {len(a)} / {len(c)} characters of markup', '' if same else '(differs)')
        if not same:
            bad += 1
            for i, (x, y) in enumerate(zip(a, c)):
                if x != y: print('  first difference at', i, repr(a[max(0, i - 60):i + 80]), '<>', repr(c[max(0, i - 60):i + 80])); break
    b.close()
sys.exit(1 if bad else 0)
