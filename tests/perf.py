# The first screen's speed (R-122, the assessment's P5): how long a newcomer waits for the topics screen, and someone on
# a shared link for the bill's name, on a slow phone and on 4G, measured the same way every time so before and after
# can be compared. Chromium's own throttling (CDP): "slow" is 400 kbit/s down, 400 ms latency and a 4x slower processor;
# "4g" is 4 Mbit/s, 150 ms, 2x. Three runs each, the middle one reported. Nothing is counted (the privacy signal is set).
#   python3 tests/perf.py [base]      base defaults to https://natehiphi.github.io/hiphi-tracker-app/
import sys, time, statistics
from playwright.sync_api import sync_playwright
BASE = (sys.argv[1] if len(sys.argv) > 1 else 'https://natehiphi.github.io/hiphi-tracker-app/').rstrip('/') + '/'
PROFILES = { 'slow': dict(down=400 * 1024 / 8, up=200 * 1024 / 8, latency=400, cpu=4), '4g': dict(down=4 * 1024 * 1024 / 8, up=1024 * 1024 / 8, latency=150, cpu=2) }
TARGETS = { 'topics (a newcomer, #/)': ('track.html#/', "() => !!document.querySelector('.st-topics, [data-stpick], .st1 .st-tiles, .st-tile')"),
            'a shared bill (#/bill/SB2175)': ('track.html?via=share#/bill/SB2175', "() => !!document.querySelector('.bl-head h1')") }
def once(br, prof, url, ready):
    ctx = br.new_context(viewport={'width': 390, 'height': 844}, bypass_csp=True)
    ctx.add_init_script("Object.defineProperty(navigator, 'globalPrivacyControl', { value: true });")
    pg = ctx.new_page(); cdp = ctx.new_cdp_session(pg)
    cdp.send('Network.enable'); cdp.send('Network.setCacheDisabled', { 'cacheDisabled': True })
    cdp.send('Network.emulateNetworkConditions', { 'offline': False, 'downloadThroughput': prof['down'], 'uploadThroughput': prof['up'], 'latency': prof['latency'] })
    cdp.send('Emulation.setCPUThrottlingRate', { 'rate': prof['cpu'] })
    t0 = time.time()
    try:
        pg.goto(BASE + url, wait_until='commit', timeout=90000)
        pg.wait_for_function(ready, timeout=90000)
        t = time.time() - t0
    except Exception as e:
        t = float('inf'); print('   (timed out or failed:', str(e)[:80], ')')
    ctx.close(); return t
with sync_playwright() as p:
    br = p.chromium.launch()
    out = {}
    for pname, prof in PROFILES.items():
        for tname, (url, ready) in TARGETS.items():
            runs = sorted(once(br, prof, url, ready) for _ in range(3))
            out[(pname, tname)] = runs[1]
            print(f'{pname:5} {tname:32} {runs[1]:6.1f} s   (runs: {", ".join(f"{r:.1f}" for r in runs)})')
    br.close()
slow, fourg = out[('slow', 'topics (a newcomer, #/)')], out[('4g', 'topics (a newcomer, #/)')]
print(f'targets: topics under 5 s slow, under 3 s 4G -> {"met" if slow < 5 and fourg < 3 else "not met"} (slow {slow:.1f} s, 4G {fourg:.1f} s)')
