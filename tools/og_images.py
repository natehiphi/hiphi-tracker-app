# The share cards' pictures (R-169). In a text message the picture is most of the card and the title a small line under
# it, so the picture says the ask (Nate 10/5: "the share card is not specific about the action").
#
# Nate's picks, 10/5: each ask looks different, so asking for a hearing and sending testimony are told apart at a glance
# (its own wash of colour, icon and drawing); and each issue gets its own picture of every ask it is shared with, its
# topic's icon and colour and its name, so shares on different issues never look alike ("Similar images and text might
# make people think they've seen the link before"). The words: "Speak Up Before the Vote" (testimony, which "takes a few
# minutes"), "Help This Bill Get a Hearing", and "Testimony" said once with plain words around it.
#
#   pub/og/<ask>.jpg           the ask on its own (a bill with no issue, and the fallback while an issue's is drawn)
#   pub/og/<ask>/<issue>.jpg   the ask for one issue: drawn only when a share page needs it (tools/og_wanted.json, which
#                              tools/share_pages.mjs writes), so a few hundred, not every pair
#   pub/og.png                 the tracker's own card
# JPEG at quality 86: the wash of colour made each PNG about 185 KB; the JPEG is about 60 KB and looks the same.
#
#   python3 tools/og_images.py              the asks' own pictures, the tracker's, and every wanted issue picture missing
#   python3 tools/og_images.py --redraw     the same, redrawing issue pictures that exist (after a change to the look)
#   python3 tools/og_images.py --wanted-only   only the missing wanted ones (the share-pages job)
#   python3 tools/og_images.py --versions   also the share picture versions' missing pictures (R-183): tools/og_wanted_pics.json
#                              lists each (written by share_pages.mjs); tools/og_templates.py draws them under pub/og/t/<version>/
# Look at the pictures before committing a change to the look.
import os, re, json, sys, html as H
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
art = open(os.path.join(ROOT, 'pub', 'art.js'), encoding='utf-8').read()
MARK = re.search(r'export const MARK = `([^`]*)`', art).group(1)
CAPITOL = re.search(r'export const CAPITOL = `([^`]*)`', art).group(1)
VOICES = re.search(r'export const VOICES = `([^`]*)`', art).group(1)
base = open(os.path.join(ROOT, 'pub', 'base.css'), encoding='utf-8').read()
TOKENS = ';'.join(f'{k}:{v}' for k, v in re.findall(r'(--[po]\d+|--n\d+):\s*(#[0-9A-Fa-f]{6})', base))
icons_src = open(os.path.join(ROOT, 'icons.js'), encoding='utf-8').read().split('export const ICONS = ', 1)[1].split('};', 1)[0]
ICONS = {m.group(1): json.loads('"' + m.group(2) + '"') for m in re.finditer(r'"([a-z0-9-]+)":"((?:[^"\\]|\\.)*)"', icons_src)}
def icon(name, size, color, sw=1.7):
    return f'<svg width="{size}" height="{size}" viewBox="0 0 24 24" fill="none" stroke="{color}" stroke-width="{sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{ICONS[name]}</svg>'
def flowers():
    f = lambda n, c, x, y: f'<svg width="{n}" height="{n}" viewBox="-12 -12 24 24" style="position:absolute;left:{x}px;top:{y}px"><g fill="{c}">' + ''.join(f'<ellipse cx="0" cy="-5.6" rx="4.1" ry="5.6" transform="rotate({r})"/>' for r in (0, 72, 144, 216, 288)) + '</g><circle r="2.2" fill="#F9D56E"/></svg>'
    return f'<div style="position:relative;width:300px;height:230px">{f(150, "#F68B2C", 20, 40)}{f(110, "#F28CA0", 160, 0)}{f(90, "#F68B2C", 170, 120)}</div>'

# The asks' looks: (small label, the ask in large words, the line under it, wash, label ink, label edge, art colour,
# label icon, the drawing when there is no issue). Inks are dark enough to read on white (A-5).
# The words and colours live in tools/og_looks.json, shared with tools/share_pics.mjs (R-183); only the drawings are here.
ART = {'voices': lambda: VOICES, 'calendar': lambda: icon('calendar-clock', 240, '#129DCB', 1.4), 'vote': lambda: icon('vote', 240, '#7C3AED', 1.4),
       'handshake': lambda: icon('handshake', 240, '#14B8A6', 1.4), 'mail': lambda: icon('mail', 240, '#129DCB', 1.4), 'capitol': lambda: CAPITOL, 'bell': lambda: icon('bell', 220, '#7D8C93', 1.4), 'flowers': flowers}
LOOKS = json.load(open(os.path.join(ROOT, 'tools', 'og_looks.json'), encoding='utf-8'))
ASKS = {k: (v['label'], v['big'], v['sub'], v['wash'], v['ink'], v['edge'], v['accent'], v['icon'], ART[v['art']]) for k, v in LOOKS.items() if not k.startswith('_')}
TRACKER = ('Hawaiʻi Health Bills', 'Speak Up for a Healthier Hawaiʻi', 'Follow the issues you care about. Speak up in a few minutes.',
           '#EDF9FF', '#984B0B', '#FCD09D', '#F68B2C', 'megaphone', lambda: CAPITOL)
# The six topics: icon and colour (dark enough to read on white, checked below). Tobacco's is the crossed-out cigarette:
# a lit one on a public-health card reads the wrong way.
CATS = {'food': ('apple', '#2E6B30'), 'tobacco': ('cigarette-off', '#B23C0A'), 'care': ('heart-pulse', '#1D4ED8'),
        'family': ('hand-coins', '#7E22CE'), 'around': ('footprints', '#0F6E7A'), 'climate': ('leaf', '#3F6212')}
def lum(h):
    c = [int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    c = [x / 12.92 if x <= 0.03928 else ((x + 0.055) / 1.055) ** 2.4 for x in c]
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
for k, (_, col) in CATS.items():
    assert (1.05) / (lum(col) + 0.05) >= 4.5, f'{k} colour {col} is too light to read on white'

# Every heading on the picture is in title case (Nate 10/6, R-186): the label, the ask and the issue's name. The line
# under the ask is a sentence and stays one. Issue names are written in sentence case for the app, so the picture
# capitalizes them here: each word and each part of a hyphenated one ("E-Cigarettes"), but not a, an, the, and, or, nor,
# but, for, so, yet or a preposition of three letters or fewer (AP style), unless it is first or last. A word that
# already has a capital (FDA, SNAP, Hawaiʻi, Maui) is left as written.
SMALL = set('a an the and or nor but for so yet as at by in of off on per to via vs'.split())
def title(t):
    ws = t.split(' ')
    def cap(w):
        if any(c.isupper() for c in w): return w
        return re.sub(r'[^\W\d_]', lambda m: m.group(0).upper(), w, count=1)
    return ' '.join(w if (0 < i < len(ws) - 1 and w.lower() in SMALL) else '-'.join(cap(x) for x in w.split('-')) for i, w in enumerate(ws))
# An issue's name, escaped, with a hyphenated word kept on one line ("e-cigarette" broke after "e-").
whole = lambda t: re.sub(r'(\w+(?:-\w+)+)', r'<span style="white-space:nowrap">\1</span>', H.escape(title(t)))

def html(look, issue=None):
    label, big, sub, wash, ink, edge, accent, chip_icon, drawing = look
    if issue:
        icn, col = CATS.get(issue.get('category'), ('heart-pulse', '#1D4ED8'))
        right = f'''<div class="iss"><div class="disc" style="background:{col}14;border-color:{col}33">{icon(icn, 132, col, 1.5)}</div>
          <div class="nm" style="color:{col}">{whole(issue['name'])}</div></div>'''
    else:
        right = f'<div class="art">{drawing()}</div>'
    return f"""<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@600;700&family=Lato:wght@400;700&display=swap" rel="stylesheet">
<style>
:root {{ {TOKENS} }}
* {{ box-sizing: border-box; margin: 0; }}
body {{ width: 1200px; height: 630px; overflow: hidden; background: linear-gradient(160deg, {wash} 0%, #fff 72%); font-family: Lato, sans-serif; color: var(--n900); position: relative; }}
.brand {{ position: absolute; left: 72px; top: 56px; display: flex; align-items: center; gap: 18px; }}
.brand > svg {{ width: 76px; height: 76px; }}
.brand b {{ display: block; font: 700 38px/1.1 Poppins, sans-serif; letter-spacing: -.01em; }}
.brand span {{ display: block; font: 400 24px/1.3 Lato, sans-serif; color: var(--n500); }}
.label {{ position: absolute; left: 72px; top: 178px; display: inline-flex; align-items: center; gap: 10px; padding: 8px 22px 8px 16px; border-radius: 999px; background: #fff; border: 2px solid {edge}; color: {ink}; font: 600 28px/1.3 Poppins, sans-serif; }}
h1 {{ position: absolute; left: 72px; top: 246px; width: 740px; font: 700 76px/1.08 Poppins, sans-serif; letter-spacing: -.025em; color: var(--n900); text-wrap: balance; }}
p {{ position: absolute; left: 72px; width: 700px; font: 400 30px/1.35 Lato, sans-serif; color: var(--n700); text-wrap: pretty; }}
.art {{ position: absolute; right: 48px; top: 170px; width: 340px; height: 400px; display: flex; align-items: center; justify-content: center; }}
.art svg.art {{ width: 330px; height: auto; }}
.iss {{ position: absolute; right: 48px; top: 150px; width: 330px; display: flex; flex-direction: column; align-items: center; gap: 20px; }}
.disc {{ width: 220px; height: 220px; border-radius: 50%; border: 3px solid; display: flex; align-items: center; justify-content: center; }}
.nm {{ width: 330px; text-align: center; font: 700 30px/1.2 Poppins, sans-serif; text-wrap: balance; }}
</style></head><body>
<div class="brand">{MARK}<div><b>Bill Tracker</b><span>Hawaiʻi Public Health Institute</span></div></div>
<div class="label">{icon(chip_icon, 30, ink, 2)}{label}</div>
<h1 id="h">{big}</h1>
<p id="p">{sub}</p>
{right}
</body></html>"""

# Fit once the fonts are in: the ask on at most two lines (smaller type for a long one), the line under it below it, and
# a long issue name smaller, on at most three lines.
FIT = """() => { const h = document.getElementById('h'); let f = 76; while (h.offsetHeight > 170 && f > 54) { f -= 4; h.style.fontSize = f + 'px'; }
  document.getElementById('p').style.top = (h.offsetTop + h.offsetHeight + 22) + 'px';
  const n = document.querySelector('.nm'); if (n) { let g = 30; while (n.offsetHeight > 112 && g > 20) { g -= 2; n.style.fontSize = g + 'px'; } }
  return document.getElementById('p').getBoundingClientRect().bottom <= 610 && (!n || n.getBoundingClientRect().bottom <= 610); }"""

def draw(pg, look, out, issue=None):
    pg.set_content(html(look, issue), wait_until='networkidle'); pg.evaluate('document.fonts.ready'); pg.wait_for_timeout(150)
    fits = pg.evaluate(FIT)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    pg.screenshot(path=out, **({'type': 'jpeg', 'quality': 86} if out.endswith('.jpg') else {}))
    return fits

if __name__ == '__main__':
    redraw, only = '--redraw' in sys.argv, '--wanted-only' in sys.argv
    wf = os.path.join(ROOT, 'tools', 'og_wanted.json')
    wanted = json.load(open(wf, encoding='utf-8')) if os.path.exists(wf) else []
    jobs = [] if only else [(ASKS[a], os.path.join(ROOT, 'pub', 'og', f'{a}.jpg'), None) for a in ASKS] + [(TRACKER, os.path.join(ROOT, 'pub', 'og.png'), None)]
    for w in wanted:
        out = os.path.join(ROOT, 'pub', 'og', w['img'], f"{w['slug']}.jpg")
        if w['img'] in ASKS and re.fullmatch(r'[a-z0-9-]+', w['slug']) and (redraw or not os.path.exists(out)): jobs.append((ASKS[w['img']], out, w))
    # (each entry's 'have' is what share_pages saw; the file itself decides here)
    versions, seen = [], set()
    if '--versions' in sys.argv:
        # og_wanted_pics.json: the share pages' (written by share_pages.mjs); og_wanted_gallery.json: share-pics.html's.
        for name in ('og_wanted_pics.json', 'og_wanted_gallery.json'):
            vf = os.path.join(ROOT, 'tools', name)
            if not os.path.exists(vf): continue
            for w in json.load(open(vf, encoding='utf-8')):
                if w['file'] in seen or not re.fullmatch(r'og/t/[a-z0-9-]+/[0-9a-f]{12}\.jpg', w['file']): continue
                seen.add(w['file'])
                if redraw or not os.path.exists(os.path.join(ROOT, 'pub', w['file'])): versions.append(w)
    if not jobs and not versions: print('nothing to draw'); sys.exit(0)
    with sync_playwright() as pw:
        br = pw.chromium.launch(); pg = br.new_page(viewport={'width': 1200, 'height': 630})
        bad = [os.path.relpath(out, ROOT) for look, out, issue in jobs if not draw(pg, look, out, issue)]
        if versions:
            import og_templates as T
            bad += [w['file'] for w in versions if not T.render(pg, w['spec'], os.path.join(ROOT, 'pub', w['file']))]
        br.close()
    print(f'{len(jobs)} pictures drawn, {len(versions)} version pictures drawn' + (f'; TOO TALL: {bad}' if bad else ''))
    # A version picture whose words did not fit is removed, so no page uses it (share_pages builds a page only for a picture
    # that exists); the others are kept.
    for f in bad:
        fp = f if os.path.isabs(f) else os.path.join(ROOT, 'pub', f) if f.startswith('og/t/') else os.path.join(ROOT, f)
        if '/og/t/' in fp.replace(os.sep, '/') and os.path.exists(fp): os.remove(fp)
    sys.exit(1 if [b for b in bad if 'og/t/' not in b] else 0)
