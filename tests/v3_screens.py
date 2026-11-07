# R-362: every Version 3 (?v3=1) screen's test in one run, against one server: the first visit, Home, Find and This week, the bill
# page, the letter and its Mahalo. Exits non-zero when any of them fails, and names which.
# usage: python3 tests/v3_screens.py [BASE]   (BASE defaults to http://localhost:8832)
#
# The files these tests cover (so node tools/tests_for.mjs lists this runner for a change to any of them):
#   pub/v3/pick.js, pub/v3/home.js, pub/v3/bills.js, pub/v3/week.js, pub/v3/bill.js, pub/v3/thanks.js, pub/v3/card.css,
#   pub/start.js, pub/start-rest.js, pub/v2/letter.js, pub/app.js, pub/variant.js, pub/kernel.js, pub/helper.js
import os, subprocess, sys, time

BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832').split('/track.html')[0].rstrip('/')
HERE = os.path.dirname(os.path.abspath(__file__))
TESTS = ['v3_first_visit.py', 'v3_home.py', 'v3_bills_week.py', 'v3_bill.py', 'v3_letter.py']

red = []
for t in TESTS:
  print(f'\n===== {t} =====', flush=True)
  t0 = time.time()
  r = subprocess.run([sys.executable, os.path.join(HERE, t), BASE])
  print(f'===== {t}: {"pass" if r.returncode == 0 else "FAILED"} ({time.time() - t0:.0f}s)', flush=True)
  if r.returncode: red.append(t)
print(f'\nVersion 3 screens: {len(TESTS) - len(red)} of {len(TESTS)} tests pass' + (f'; failed: {", ".join(red)}' if red else ''))
sys.exit(1 if red else 0)
