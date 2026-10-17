"""Find's search matches whole words and says when it widened or cut the list (R-212 #2).

"tax" must not find a bill only for "taxi" or "taxpayer"; a plural typed finds the singular; synonyms are named in a
quiet line (never the "vape" words, R-158); half a word falls back to word starts and says so; a list cut at 80 says so
after the bills. Runs on the practice copy, and with LIVE=1 on the live data path (the database matches whole words too).

  python3 tests/search_words.py [http://localhost:8832]
"""
import os, re, sys
from playwright.sync_api import sync_playwright

HOST = sys.argv[1] if len(sys.argv) > 1 else os.environ.get('HOST', 'http://localhost:8832')
PAGE = f"{HOST}/track.html{'' if os.environ.get('LIVE') else '?demo=1'}"
fails = passes = 0

def check(ok, what):
    global fails, passes
    print(('PASS ' if ok else 'FAIL ') + what)
    if ok: passes += 1
    else: fails += 1

def search(pg, q):
    pg.goto(f'{PAGE}#/find?q={q}')
    pg.wait_for_function("() => { const s = document.getElementById('fd-status'); return s && /found|No bills/.test(s.textContent) }", timeout=20000)
    notes = pg.locator('.fd-note').all_text_contents()
    n = re.match(r'(\d+)', pg.locator('#fd-status').text_content() or '')
    return int(n.group(1)) if n else 0, ' '.join(notes)

with sync_playwright() as p:
    br = p.chromium.launch(); pg = br.new_page(viewport={'width': 390, 'height': 844})
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    n, note = search(pg, 'tax')
    check(n > 0, f'"tax" finds bills ({n})')
    check('That’s the first 80' in note if n == 80 else 'first 80' not in note, f'the cut at 80 is said only when the list stopped there ({n}: "{note}")')
    n1, _ = search(pg, 'taxes')
    check(n1 >= n * 0.9, f'"taxes" finds the singular too ({n1} vs {n})')
    n, note = search(pg, 'vape')
    check(n > 0 and 'Also shows bills that say' in note and 'e-cigarette' in note, f'"vape" names its synonyms ("{note}")')
    check('vap' not in note.split('say', 1)[-1], 'the note never prints a "vape" word (R-158)')
    n2, _ = search(pg, 'e-cigarettes')
    check(n2 == n, f'"e-cigarettes" and "vape" find the same bills ({n2} and {n})')
    n, note = search(pg, 'educat')
    check(n > 0 and 'start with “educat”' in note, f'half a word falls back to word starts and says so ("{note}")')
    n, note = search(pg, 'educat%20funding')
    check(n > 0 and 'start with what you typed' in note, f'half a word beside a whole word: word starts for every word first ("{note}")')
    n, note = search(pg, 'HB1563')
    check(n == 1 and not note, f'a bill number finds one bill with no note ({n}, "{note}")')
    check(not errs, f'no page errors {errs[:2]}')
    br.close()
print(f'\n{passes} passed, {fails} failed')
sys.exit(1 if fails else 0)
