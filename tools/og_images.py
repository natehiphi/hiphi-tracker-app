# The share cards' pictures (R-169, Nate 10/5: "the share card is not specific about the action. It should be."). In a text
# message the picture is most of the card and the title is a small line under it, so each ask gets its own picture saying
# the ask in large words: pub/og/testify.png, ask.png, hold.png, floor-yes.png, floor-no.png, conference-yes.png,
# conference-no.png, governor-sign.png, governor-veto.png, follow.png, law.png, and pub/og.png, the tracker's own.
# tools/share_cards.mjs picks one per card (imageFor). The brand's own mark, Capitol drawing, colours and fonts.
#   python3 tools/og_images.py          writes the PNGs (1200 x 630); look at them before committing
import os, re
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
art = open(os.path.join(ROOT, 'pub', 'art.js'), encoding='utf-8').read()
MARK = re.search(r'export const MARK = `([^`]*)`', art).group(1)
CAPITOL = re.search(r'export const CAPITOL = `([^`]*)`', art).group(1)
base = open(os.path.join(ROOT, 'pub', 'base.css'), encoding='utf-8').read()
TOKENS = ';'.join(f'{k}:{v}' for k, v in re.findall(r'(--[po]\d+|--n\d+):\s*(#[0-9A-Fa-f]{6})', base))

# name: (the small label, the ask in large words, the line under it)
CARDS = {
    'testify':        ('Testimony needed', 'Tell lawmakers what you think', 'Send testimony before the hearing. About 10 minutes, and we help you write it.'),
    'ask':            ('A bill needs a hearing', 'Ask the chair for a hearing', 'Without one, the bill stops for this year. A short email takes about 2 minutes.'),
    'hold':           ('A bill is waiting for a hearing', 'Ask the chair not to hear it', 'A short email to the chair takes about 2 minutes, and we help you write it.'),
    'floor-yes':      ('A vote is coming', 'Ask your legislator to vote yes', 'A short email to your own legislator takes about 2 minutes.'),
    'floor-no':       ('A vote is coming', 'Ask your legislator to vote no', 'A short email to your own legislator takes about 2 minutes.'),
    'conference-yes': ('The final version', 'Ask lawmakers to pass it', 'The House and Senate are writing one final version. A short email takes about 2 minutes.'),
    'conference-no':  ('The final version', 'Ask lawmakers not to pass it', 'The House and Senate are writing one final version. A short email takes about 2 minutes.'),
    'governor-sign':  ('On the Governor’s desk', 'Ask the Governor to sign it', 'It passed the Legislature. A short message takes about 2 minutes.'),
    'governor-veto':  ('On the Governor’s desk', 'Ask the Governor to veto it', 'It passed the Legislature. A short message takes about 2 minutes.'),
    'follow':         ('Stay in the loop', 'Follow the issue', 'We’ll tell you when there’s a hearing or a way to help.'),
    'law':            ('Good news', 'It became law. Follow what’s next.', 'Follow the issue and we’ll tell you when your voice can count.'),
    '../og':          ('Hawaiʻi health bills', 'Speak up for a healthier Hawaiʻi', 'Follow the issues you care about. Speak up in a few minutes.'),
}

def html(label, big, sub):
    return f"""<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@600;700&family=Lato:wght@400;700&display=swap" rel="stylesheet">
<style>
:root {{ {TOKENS} }}
* {{ box-sizing: border-box; margin: 0; }}
body {{ width: 1200px; height: 630px; overflow: hidden; background: linear-gradient(180deg, var(--p50) 0%, #fff 78%); font-family: Lato, sans-serif; color: var(--n900); position: relative; }}
.brand {{ position: absolute; left: 72px; top: 56px; display: flex; align-items: center; gap: 18px; }}
.brand svg {{ width: 76px; height: 76px; }}
.brand b {{ display: block; font: 700 38px/1.1 Poppins, sans-serif; letter-spacing: -.01em; }}
.brand span {{ display: block; font: 400 24px/1.3 Lato, sans-serif; color: var(--n500); }}
.label {{ position: absolute; left: 72px; top: 182px; display: inline-block; padding: 8px 22px; border-radius: 999px; background: var(--o50); border: 2px solid var(--o200); color: var(--o700); font: 600 28px/1.3 Poppins, sans-serif; }}
h1 {{ position: absolute; left: 72px; top: 248px; width: 1010px; font: 700 80px/1.08 Poppins, sans-serif; letter-spacing: -.025em; color: var(--n900); text-wrap: balance; }}
p {{ position: absolute; left: 72px; width: 760px; font: 400 32px/1.35 Lato, sans-serif; color: var(--n700); text-wrap: pretty; }}
.cap {{ position: absolute; right: 36px; bottom: 14px; width: 330px; opacity: .95; }}
.cap svg {{ width: 330px; height: auto; display: block; }}
</style></head><body>
<div class="brand">{MARK}<div><b>Bill Tracker</b><span>Hawaiʻi Public Health Institute</span></div></div>
<div class="label">{label}</div>
<h1 id="h">{big}</h1>
<p id="p">{sub}</p>
<div class="cap">{CAPITOL}</div>
<script>
  // The line under the ask starts below the ask, whether the ask takes one line or two.
  const h = document.getElementById('h').getBoundingClientRect();
  document.getElementById('p').style.top = (h.bottom + 22) + 'px';
</script>
</body></html>"""

os.makedirs(os.path.join(ROOT, 'pub', 'og'), exist_ok=True)
with sync_playwright() as pw:
    br = pw.chromium.launch(); pg = br.new_page(viewport={'width': 1200, 'height': 630})
    for name, (label, big, sub) in CARDS.items():
        pg.set_content(html(label, big, sub), wait_until='networkidle'); pg.evaluate('document.fonts.ready')
        pg.wait_for_timeout(300)
        # Re-run the placement once the fonts are in, since the ask's height depends on them.
        pg.evaluate("() => { const h = document.getElementById('h').getBoundingClientRect(); document.getElementById('p').style.top = (h.bottom + 22) + 'px'; }")
        over = pg.evaluate("() => document.getElementById('p').getBoundingClientRect().bottom > 600 || document.getElementById('h').getBoundingClientRect().height > 190")
        out = os.path.join(ROOT, 'pub', 'og', f'{name}.png') if not name.startswith('../') else os.path.join(ROOT, 'pub', 'og.png')
        pg.screenshot(path=out)
        print(('TOO TALL ' if over else '') + os.path.relpath(out, ROOT))
    br.close()
