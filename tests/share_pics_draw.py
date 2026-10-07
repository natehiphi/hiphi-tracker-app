# Draws every picture version of every bill (as the practice copy has them, from the dump tests/share_pics_test.mjs writes
# with DUMP=file) into a scratch folder and reports any whose words did not fit its template (R-183). Slow (a third of a
# second a picture); run it before a change to a template or to the words, not on every push.
#   DUMP=/tmp/pics.json node tests/share_pics_test.mjs && python3 tests/share_pics_draw.py /tmp/pics.json [every N-th]
import sys, os, json, tempfile, time
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'tools'))
from playwright.sync_api import sync_playwright
import og_templates as T
items = json.load(open(sys.argv[1])); step = int(sys.argv[2]) if len(sys.argv) > 2 else 1
items = items[::step]; out = tempfile.mkdtemp(prefix='pics-draw-'); long = []; t0 = time.time()
with sync_playwright() as pw:
    br = pw.chromium.launch(); pg = br.new_page(viewport={'width': 1200, 'height': 630})
    for i, it in enumerate(items):
        if not T.render(pg, it['spec'], os.path.join(out, it['file'].replace('/', '_'))): long.append(it)
        if i % 200 == 199: print(f'{i + 1}/{len(items)} drawn, {len(long)} too long, {int(time.time() - t0)}s', flush=True)
    br.close()
size = sum(os.path.getsize(os.path.join(out, f)) for f in os.listdir(out))
print(f'{len(items)} pictures drawn, {len(long)} too long; {size / 1048576:.0f} MB in {out}')
for it in long[:30]: print('TOO LONG', it['spec']['v'], json.dumps({k: v for k, v in it['spec'].items() if isinstance(v, str)})[:300])
sys.exit(1 if long else 0)
