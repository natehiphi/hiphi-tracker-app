"""Keep browser tests from cooking the laptop (R-384, Nate 12 Nov 2026).

Why: Nate's Mac is a fanless MacBook Air (M2, 8 cores, 8 GB). With several Claude chats building at once, the layout
tests each opened up to 6 headless browsers next to other chats' tests. On 12 Nov the load was 22 on 8 cores, memory
was swapping, and macOS throttled the processor for heat (kernel_task at 148%), so everything slowed to a crawl.

Two things here, both off on GitHub's machines (CI is set there), which have their own cores and the old speed:
  workers()        how many browsers a parallel test opens: 2 on the laptop (was up to 6)
  wait_if_busy()   before a heavy test: if the Mac is already busy, wait for it to calm down (at most 3 minutes),
                   then go ahead anyway, so a test is never stuck behind a long job

  python3 tests/busy.py          says how busy the Mac is now, and waits like a test would
  HIPHI_WORKERS=4                more browsers at once for one run (or --workers N on the test itself)
  HIPHI_NO_WAIT=1                skip the wait
"""
import os, sys, time

CORES = os.cpu_count() or 4
ON_CI = bool(os.environ.get('CI'))
LAPTOP_WORKERS = 2
BUSY = 1.25      # load per core above which the Mac counts as busy: more work waiting than cores to run it
CALM = 1.0       # and below which it has room again
MAX_WAIT = 180   # seconds; past this the test runs anyway


def load():
  try: return os.getloadavg()[0]
  except OSError: return 0.0


def workers(cap=6):
  """Browsers a parallel test opens at once: the old 'cores minus two, at most 6' on CI, 2 on the laptop."""
  if os.environ.get('HIPHI_WORKERS'): return max(1, int(os.environ['HIPHI_WORKERS']))
  if ON_CI: return max(1, min(cap, CORES - 2))
  return max(1, min(cap, LAPTOP_WORKERS))


def wait_if_busy(label=None, max_wait=MAX_WAIT):
  """Wait while the Mac is busier than its cores can handle; returns the seconds waited."""
  if ON_CI or os.environ.get('HIPHI_NO_WAIT'): return 0
  name = label or os.path.basename(sys.argv[0])
  if load() <= BUSY * CORES: return 0
  print(f'{name}: the Mac is busy (load {load():.0f} on {CORES} cores); waiting up to {max_wait // 60} min so it can cool down'
        f' (HIPHI_NO_WAIT=1 skips this)', flush=True)
  t0 = time.time()
  while time.time() - t0 < max_wait:
    time.sleep(10)
    if load() <= CALM * CORES:
      print(f'{name}: load {load():.0f}, going ahead after {round(time.time() - t0)} s', flush=True)
      return time.time() - t0
  print(f'{name}: still busy (load {load():.0f}) after {max_wait // 60} min; going ahead anyway', flush=True)
  return time.time() - t0


if __name__ == '__main__':
  print(f'load {load():.1f} on {CORES} cores (busy above {BUSY * CORES:.0f}); parallel tests open {workers()} browsers'
        f'{" (CI)" if ON_CI else ""}')
  wait_if_busy('busy.py')
