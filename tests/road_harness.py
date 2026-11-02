# Proof run for pub/v2/road.js (R-357 phase 1): serves the worktree on a free port (one server, backlog 256), steps the harness
# through pages 1-4 with both choices and page 5, takes phone shots, mid-motion frames and a reduced-motion run, prints console errors.
#   python3 tests/road_harness.py [outdir]
import sys, os, socket, threading, http.server, functools
from playwright.sync_api import sync_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'tests', 'out', 'road')
os.makedirs(OUT, exist_ok=True)
class Q(http.server.ThreadingHTTPServer):
    request_queue_size = 256
    def server_bind(self):
        self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1); super().server_bind()
class H(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = Q(('127.0.0.1', 0), functools.partial(H, directory=ROOT)); PORT = srv.server_address[1]
threading.Thread(target=srv.serve_forever, daemon=True).start()
BASE = f'http://127.0.0.1:{PORT}/tests/road_harness.html'
errs = []
def fonts(pg): pg.evaluate("Promise.all([document.fonts.load('700 13px Lato'),document.fonts.load('700 22px Poppins'),document.fonts.ready])")
def settle(pg, ms=3800): pg.wait_for_timeout(ms)
def shot(pg, n): pg.screenshot(path=f'{OUT}/{n}.png')
def load(br, w, h, bill, reduced=False, speed=None):
    ctx = br.new_context(viewport={'width': w, 'height': h}, device_scale_factor=2, reduced_motion='reduce' if reduced else 'no-preference')
    pg = ctx.new_page(); pg.on('console', lambda m: errs.append(m.text) if m.type in ('error', 'warning') else None); pg.on('pageerror', lambda e: errs.append(str(e)))
    if speed: pg.add_init_script(f'globalThis.TR_SPEED={speed}')
    pg.goto(f'{BASE}?bill={bill}&demo=1'); pg.wait_for_function('window.H && H.ready'); fonts(pg); return ctx, pg
with sync_playwright() as p:
    br = p.chromium.launch()
    for (w, h) in [(375, 812), (320, 568)]:
        for bill in ('sb', 'hb'):
            ctx, pg = load(br, w, h, bill); pre = f'{bill}-{w}'
            pg.evaluate('H.start()'); settle(pg); shot(pg, f'{pre}-p1')
            pg.click('#next'); settle(pg, 3600); shot(pg, f'{pre}-p2')
            pg.click('#next'); settle(pg, 300); shot(pg, f'{pre}-p3-before')
            for v, tag in (('chair', 'chair'), ('none', 'none')):
                pg.click(f'[data-tr={v}]'); settle(pg, 2600); shot(pg, f'{pre}-p3-{tag}')
            pg.click('[data-tr=chair]'); settle(pg, 2600)
            pg.click('#next'); settle(pg, 1600); shot(pg, f'{pre}-p4-before')
            for v, tag in (('testimony', 'test'), ('none', 'none')):
                pg.click(f'[data-tr={v}]'); settle(pg, 3600); shot(pg, f'{pre}-p4-{tag}')
            pg.click('[data-tr=testimony]'); settle(pg, 3600)
            pg.evaluate('H.plan(false)'); settle(pg, 1500); shot(pg, f'{pre}-p5')
            # back from 4 shows the end picture at once
            pg.evaluate('H.start({back:true})'); pg.wait_for_timeout(100); shot(pg, f'{pre}-back4')
            print(pre, 'overflow-x:', pg.evaluate('document.documentElement.scrollWidth - innerWidth'),
                  'min label px:', pg.evaluate("(() => { const s = document.querySelector('.tr-sv'); if (!s) return null; const k = s.getBoundingClientRect().width / 360; return +(13 * k).toFixed(1); })()"))
            ctx.close()
    # mid-motion frames: motion slowed 5x so three stills catch the email arc, the card, the testimony notes
    ctx, pg = load(br, 375, 812, 'sb', speed=5)
    pg.evaluate('H.start()'); pg.wait_for_timeout(500); pg.evaluate('H.road.teachNext()'); pg.wait_for_timeout(500); pg.evaluate('H.road.teachNext()'); pg.wait_for_timeout(400)
    pg.click('[data-tr=chair]')
    for i, ms in enumerate((2600, 2600, 3500)): pg.wait_for_timeout(ms); shot(pg, f'mid-p3-chair-{i}')
    pg.wait_for_timeout(4000); pg.click('#next'); pg.wait_for_timeout(2500)
    pg.click('[data-tr=testimony]')
    for i, ms in enumerate((3000, 3000, 3500)): pg.wait_for_timeout(ms); shot(pg, f'mid-p4-test-{i}')
    pg.wait_for_timeout(3000); pg.click('[data-tr=none]'); pg.wait_for_timeout(3500); shot(pg, 'mid-p4-none')
    ctx.close()
    # reduced motion: every page shows its end picture at once
    ctx, pg = load(br, 375, 812, 'sb', reduced=True)
    pg.evaluate('H.start()'); pg.wait_for_timeout(120); shot(pg, 'rm-p1'); pg.click('#next'); pg.wait_for_timeout(120); shot(pg, 'rm-p2')
    pg.click('#next'); pg.click('[data-tr=chair]'); pg.wait_for_timeout(120); shot(pg, 'rm-p3-chair'); pg.click('#next'); pg.click('[data-tr=testimony]'); pg.wait_for_timeout(120); shot(pg, 'rm-p4-test')
    ctx.close(); br.close()
print('console problems:', errs or 'none'); srv.shutdown()
