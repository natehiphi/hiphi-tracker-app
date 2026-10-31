# The first screen's speed (R-122, the assessment's P5; moved to the welcome by R-297 and R-357 5a): how long a newcomer
# waits to see anything and for the welcome's "Let's begin" to be tappable, then for the topics after that tap, and someone
# on a shared link for the bill's name, on a slow phone and on 4G, measured the same way every time so before and after can
# be compared. Chromium's own throttling (CDP): "slow" is 400 kbit/s down, 400 ms latency and a 4x slower processor; "4g" is
# 4 Mbit/s, 150 ms, 2x. Three runs each, the middle one reported. Nothing is counted (the privacy signal is set).
# Since 17 Oct (R-297) the front door opens on the welcome, not the topics, so the old wait for the topics tiles timed out:
# the newcomer's run now waits for the button, notes the first paint, taps it and then waits for the topics.
# Since R-357 5c it also lists the first wave: every file asked for by the time the screen was ready (the middle run), its
# size as it crossed the network (the published site gzips; a plain local server does not), and checks that a newcomer's phone
# has not asked for what the first screen does not need: actions.css, wide.css, print.css and the sending half of the counts
# (judged by the page's own mark, 'hiphi-first-screen', set by pub/app.js when the first screen has been drawn).
#   python3 tests/perf.py [base]      base defaults to https://natehiphi.github.io/hiphi-tracker-app/ (a local https server's
#                                     self-signed certificate is accepted)
import sys, time, statistics
from playwright.sync_api import sync_playwright
BASE = (sys.argv[1] if len(sys.argv) > 1 else 'https://natehiphi.github.io/hiphi-tracker-app/').rstrip('/') + '/'
PROFILES = { 'slow': dict(down=400 * 1024 / 8, up=200 * 1024 / 8, latency=400, cpu=4), '4g': dict(down=4 * 1024 * 1024 / 8, up=1024 * 1024 / 8, latency=150, cpu=2) }
# Each target: the address, what "ready" is, and (for the front door) the tap that comes next and what it opens.
WELCOME = "() => { const b = document.querySelector('.st-hellobar [data-stnext]'); return !!b && b.getBoundingClientRect().height > 0; }"
TOPICS = "() => !!document.querySelector('.st-topics, [data-stpick], .st1 .st-tiles, .st-tile')"
TARGETS = { 'welcome (a newcomer, #/)': dict(url='track.html#/', ready=WELCOME, tap=('.st-hellobar [data-stnext]', TOPICS)),
            'a shared bill (#/bill/SB2175)': dict(url='track.html?via=share#/bill/SB2175', ready="() => !!document.querySelector('.bl-head h1')") }
def once(br, prof, tg):
    ctx = br.new_context(viewport={'width': 390, 'height': 844}, bypass_csp=True, ignore_https_errors=True)
    ctx.add_init_script("Object.defineProperty(navigator, 'globalPrivacyControl', { value: true });")
    pg = ctx.new_page(); cdp = ctx.new_cdp_session(pg)
    cdp.send('Network.enable'); cdp.send('Network.setCacheDisabled', { 'cacheDisabled': True })
    cdp.send('Network.emulateNetworkConditions', { 'offline': False, 'downloadThroughput': prof['down'], 'uploadThroughput': prof['up'], 'latency': prof['latency'] })
    cdp.send('Emulation.setCPUThrottlingRate', { 'rate': prof['cpu'] })
    r = dict(ready=float('inf'), paint=float('inf'), topics=float('inf'), wave=[], early=None)
    # every request with the size it came to, kept as it goes (CDP), so the first wave can be read at the moment the screen is ready
    reqs = {}
    cdp.on('Network.requestWillBeSent', lambda e: reqs.setdefault(e['requestId'], dict(url=e['request']['url'], size=0, done=False)))
    def fin(e):
        if e['requestId'] in reqs: reqs[e['requestId']].update(size=e['encodedDataLength'], done=True)
    cdp.on('Network.loadingFinished', fin)
    t0 = time.time()
    try:
        pg.goto(BASE + tg['url'], wait_until='commit', timeout=90000)
        pg.wait_for_function(tg['ready'], timeout=90000)
        r['ready'] = time.time() - t0
        r['wave'] = [(v['url'].replace(BASE, ''), v['size']) for v in reqs.values() if v['url'].startswith('http') and not v['url'].startswith('data:')]
        # what the page asked for before it had drawn its first screen, by its own clock (the mark and each request's start)
        r['early'] = pg.evaluate("() => { const m = performance.getEntriesByName('hiphi-first-screen')[0]; if (!m) return null; return performance.getEntriesByType('resource').filter(e => e.startTime < m.startTime).map(e => e.name); }")
        # the browser's own first paint of anything (the skeleton counts: it is what a person sees first)
        fcp = pg.evaluate("() => { const e = performance.getEntriesByName('first-contentful-paint')[0]; return e ? e.startTime : null; }")
        if fcp is not None: r['paint'] = fcp / 1000
        if 'tap' in tg:
            pg.click(tg['tap'][0]); pg.wait_for_function(tg['tap'][1], timeout=90000); r['topics'] = time.time() - t0
    except Exception as e:
        print('   (timed out or failed:', str(e)[:80], ')')
    ctx.close(); return r
def mid(xs): return sorted(xs)[len(xs) // 2]
with sync_playwright() as p:
    br = p.chromium.launch()
    out = {}
    for pname, prof in PROFILES.items():
        for tname, tg in TARGETS.items():
            runs = [once(br, prof, tg) for _ in range(3)]
            ready, paint = mid([r['ready'] for r in runs]), mid([r['paint'] for r in runs])
            wave = sorted(runs, key=lambda r: r['ready'])[1]['wave']
            out[(pname, tname)] = dict(ready=ready, paint=paint, wave=wave, early=sorted(runs, key=lambda r: r['ready'])[1]['early'])
            print(f'{pname:5} {tname:32} ready {ready:6.1f} s   first paint {paint:5.1f} s   (ready runs: {", ".join("%.1f" % r["ready"] for r in runs)})')
            print(f'      first wave: {len(wave)} requests, {sum(b for _, b in wave) / 1024:.0f} KB; the biggest: ' + ', '.join(f'{u.split("/")[-1].split("?")[0]} {b / 1024:.0f}' for u, b in sorted(wave, key=lambda x: -x[1])[:5]))
            if 'tap' in tg:
                topics = mid([r['topics'] for r in runs]); out[(pname, 'topics after the tap')] = dict(ready=topics)
                print(f'{pname:5} {"topics after the tap on it":32} ready {topics:6.1f} s   ({mid([r["topics"] - r["ready"] for r in runs]):.1f} s after the button)')
    br.close()
W, B = 'welcome (a newcomer, #/)', 'a shared bill (#/bill/SB2175)'
slow, fourg = out[('slow', W)], out[('4g', W)]
print(f'targets: welcome button under 5 s slow, under 3 s 4G -> {"met" if slow["ready"] < 5 and fourg["ready"] < 3 else "not met"} (slow {slow["ready"]:.1f} s, 4G {fourg["ready"]:.1f} s)')
print(f'         first paint under 1 s slow (R-357 5a) -> {"met" if slow["paint"] < 1 else "not met"} (slow {slow["paint"]:.1f} s, 4G {fourg["paint"]:.1f} s)')
# A newcomer's phone asks for none of these before the welcome is ready (R-357 5c): the first screen does not draw them.
LATE = ['pub/actions.css', 'pub/wide.css', 'pub/print.css', 'pub/visitlog-send.js']
for pname in ('slow', '4g'):
    asked = out[(pname, W)]['early']
    early = [n for n in LATE if any(u.split('?')[0].endswith(n) for u in (asked or [u for u, _ in out[(pname, W)]['wave']]))]
    print(f'         not in the welcome\u2019s first wave ({pname}): {", ".join(n.split("/")[-1] for n in LATE)} -> {"met" if not early else "not met, asked for: " + ", ".join(early)}')
bs, bf = out[('slow', B)]['ready'], out[('4g', B)]['ready']
print(f'         bill link under 10 s slow, under 3 s 4G (R-357 5) -> {"met" if bs < 10 and bf < 3 else "not met"} (slow {bs:.1f} s, 4G {bf:.1f} s)')
