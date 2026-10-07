# The share picture versions' templates (R-183): each takes a spec from tools/share_pics.mjs (every word already final) and
# lays it out at 1200x630 in the look of the twelve mockups Nate approved on 6 Oct (docs in the backend repo,
# docs/share-picture-ideas/). Nothing here decides what is true; it only draws what the spec says, and says whether it fit.
#
# Fit: every text block that could run long carries data-fit="minimum font size" and sits in a box of fixed size with
# overflow hidden; FIT shrinks it until it fits and reports a block that still does not (the picture is then not used).
# No emoji (a build machine may have no emoji font): icons from icons.js instead. American spelling.
import os, re, json, html as H

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_art = open(os.path.join(ROOT, 'pub', 'art.js'), encoding='utf-8').read()
MARK = re.search(r'export const MARK = `([^`]*)`', _art).group(1)
CAPITOL = re.search(r'export const CAPITOL = `([^`]*)`', _art).group(1)
VOICES = re.search(r'export const VOICES = `([^`]*)`', _art).group(1)
ISL = re.findall(r"\['(\w+)', '(M[^']+)'\]", _art)
_base = open(os.path.join(ROOT, 'pub', 'base.css'), encoding='utf-8').read()
TOKENS = ';'.join(f'{k}:{v}' for k, v in re.findall(r'(--[po]\d+|--n\d+):\s*(#[0-9A-Fa-f]{6})', _base))
_icons = open(os.path.join(ROOT, 'icons.js'), encoding='utf-8').read().split('export const ICONS = ', 1)[1].split('};', 1)[0]
ICONS = {m.group(1): json.loads('"' + m.group(2) + '"') for m in re.finditer(r'"([a-z0-9-]+)":"((?:[^"\\]|\\.)*)"', _icons)}
LOOKS = json.load(open(os.path.join(ROOT, 'tools', 'og_looks.json'), encoding='utf-8'))
# Escaped, with a hyphenated word kept on one line ("E-Cigarettes" broke after "E-").
e = lambda t: re.sub(r'(\w+(?:-\w+)+)', r'<span style="white-space:nowrap">\1</span>', H.escape(str(t), quote=False))

def icon(name, size, color, sw=1.8):
    return f'<svg width="{size}" height="{size}" viewBox="0 0 24 24" fill="none" stroke="{color}" stroke-width="{sw}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{ICONS[name]}</svg>'

# The six topics: icon and colour (as og_images.py CATS, contrast checked there) and a flat drawing for each, in the style of
# pub/art.js: no outlines, overlapping flat colour. Until R-197 picks a drawing style per issue these stand in for it.
CATS = {'food': ('apple', '#2E6B30'), 'tobacco': ('cigarette-off', '#B23C0A'), 'care': ('heart-pulse', '#1D4ED8'),
        'family': ('hand-coins', '#7E22CE'), 'around': ('footprints', '#0F6E7A'), 'climate': ('leaf', '#3F6212')}
ART = {
 'food': '''<svg viewBox="0 0 300 240"><ellipse cx="150" cy="222" rx="128" ry="10" fill="#0000000F"/><rect x="26" y="130" width="248" height="82" rx="22" fill="#F4B223"/><rect x="40" y="144" width="220" height="54" rx="14" fill="#FFE29A"/>
  <circle cx="108" cy="92" r="52" fill="#D9473B"/><circle cx="142" cy="92" r="52" fill="#E85A4D"/><path d="M128 40c2-18 14-28 30-30-1 17-11 28-30 30z" fill="#3F8F3A"/><rect x="126" y="36" width="5" height="16" rx="2" fill="#6B4A1E"/>
  <rect x="186" y="62" width="58" height="84" rx="8" fill="#FFFFFF"/><rect x="186" y="62" width="58" height="26" rx="8" fill="#39BFEE"/><path d="M186 74h58" stroke="#fff" stroke-width="3"/><circle cx="215" cy="112" r="14" fill="#C4E8F6"/></svg>''',
 'tobacco': '''<svg viewBox="0 0 300 240"><ellipse cx="150" cy="222" rx="128" ry="10" fill="#0000000F"/><rect x="48" y="96" width="170" height="52" rx="26" fill="#8A98A0" transform="rotate(-18 133 122)"/><rect x="190" y="84" width="60" height="38" rx="16" fill="#5F6F76" transform="rotate(-18 220 103)"/><circle cx="92" cy="128" r="9" fill="#F68B2C"/>
  <circle cx="150" cy="120" r="94" fill="none" stroke="#D9473B" stroke-width="22"/><path d="M84 186L216 54" stroke="#D9473B" stroke-width="22" stroke-linecap="round"/></svg>''',
 'care': '''<svg viewBox="0 0 300 240"><ellipse cx="150" cy="222" rx="128" ry="10" fill="#0000000F"/><path d="M150 206C86 160 48 126 48 84c0-26 20-44 44-44 24 0 44 14 58 36 14-22 34-36 58-36 24 0 44 18 44 44 0 42-38 76-102 122z" fill="#D9473B"/>
  <path d="M150 206C96 164 66 134 58 100c20 30 56 52 92 70 36-18 72-40 92-70-8 34-38 64-92 106z" fill="#C23A30"/><path d="M62 112h52l16-34 28 66 18-32h58" fill="none" stroke="#fff" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/></svg>''',
 'family': '''<svg viewBox="0 0 300 240"><ellipse cx="150" cy="224" rx="128" ry="10" fill="#0000000F"/><circle cx="82" cy="60" r="26" fill="#7E22CE"/><path d="M42 214c0-60 18-100 40-100s40 40 40 100z" fill="#7E22CE"/><circle cx="218" cy="60" r="26" fill="#F68B2C"/><path d="M178 214c0-60 18-100 40-100s40 40 40 100z" fill="#F68B2C"/>
  <circle cx="150" cy="116" r="20" fill="#39BFEE"/><path d="M122 214c0-44 12-72 28-72s28 28 28 72z" fill="#39BFEE"/><path d="M118 150l-8 6M182 150l8 6" stroke="#fff" stroke-width="3" stroke-linecap="round"/></svg>''',
 'around': '''<svg viewBox="0 0 300 240"><ellipse cx="150" cy="226" rx="128" ry="10" fill="#0000000F"/><rect x="20" y="52" width="260" height="124" rx="22" fill="#F4B223"/><rect x="20" y="124" width="260" height="11" fill="#142B35" opacity=".85"/>
  <rect x="40" y="72" width="46" height="42" rx="7" fill="#C4E8F6"/><rect x="96" y="72" width="46" height="42" rx="7" fill="#C4E8F6"/><rect x="152" y="72" width="46" height="42" rx="7" fill="#C4E8F6"/><rect x="208" y="72" width="54" height="62" rx="7" fill="#95DCFE"/>
  <circle cx="80" cy="180" r="24" fill="#142B35"/><circle cx="80" cy="180" r="10" fill="#C2CCD1"/><circle cx="220" cy="180" r="24" fill="#142B35"/><circle cx="220" cy="180" r="10" fill="#C2CCD1"/><rect x="272" y="146" width="12" height="14" rx="3" fill="#F68B2C"/></svg>''',
 'climate': '''<svg viewBox="0 0 300 240"><ellipse cx="150" cy="226" rx="128" ry="10" fill="#0000000F"/><circle cx="210" cy="72" r="46" fill="#F4B223"/><path d="M60 196C40 120 90 52 190 40c8 80-30 150-130 156z" fill="#5E9B2A"/><path d="M60 196C90 130 130 90 190 40" fill="none" stroke="#3F6212" stroke-width="6" stroke-linecap="round"/>
  <path d="M10 214q20-14 40 0t40 0 40 0 40 0 40 0 40 0 40 0" fill="none" stroke="#39BFEE" stroke-width="9" stroke-linecap="round"/></svg>''',
}
TOPIC_NAME = {'food': 'Healthy Food', 'tobacco': 'Tobacco, Nicotine & Alcohol', 'care': 'Health Care', 'family': 'Strong Families', 'around': 'Getting Around', 'climate': 'Climate & Health'}
def art(cat, w, gray=False):
    s = ART.get(cat) or ART['care']
    s = s.replace('<svg ', f'<svg width="{w}" style="display:block{";filter:grayscale(1);opacity:.65" if gray else ""}" ', 1)
    return s
def islands_svg(lit, w=640, base='#39BFEE', hi='#F4B223'):
    litset = set(lit)
    return f'<svg viewBox="0 0 336 236" width="{w}">' + ''.join(f'<path d="{d}" fill="{hi if (n in litset or not litset) else base}" opacity="{1 if (n in litset or not litset) else .55}"/>' for n, d in ISL) + '</svg>'

HEAD = '''<link href="https://fonts.googleapis.com/css2?family=Poppins:wght@500;600;700;800;900&family=Lato:wght@400;700&family=Caveat:wght@600;700&family=Bebas+Neue&display=swap" rel="stylesheet">
<style>:root{%s}*{box-sizing:border-box;margin:0}body{width:1200px;height:630px;overflow:hidden;position:relative;font-family:Lato,sans-serif;color:#142B35}
.abs{position:absolute}.P{font-family:Poppins,sans-serif}.box{overflow:hidden}
.brand{position:absolute;display:flex;align-items:center;gap:12px;font:600 22px Poppins,sans-serif;color:#344852}.brand svg{width:40px;height:40px;flex:none}
.tag{position:absolute;right:28px;top:22px;padding:6px 16px;border-radius:999px;background:#142B35;color:#fff;font:700 20px Poppins,sans-serif;z-index:9}
</style>''' % TOKENS
def brand(pos, color='#344852', short=False):
    return f'<div class="brand" style="{pos};color:{color}">{MARK}<span>Bill Tracker · {"HIPHI" if short else "Hawaiʻi Public Health Institute"}</span></div>'
def doc(body):
    return f'<!doctype html><html><head><meta charset="utf-8">{HEAD}</head>{body}</html>'
def tag(s):
    pos = 'right:28px;bottom:26px;top:auto' if s.get('v') == 'before' else ''
    return f'<div class="tag" style="{pos}">{e(s["tag"])}</div>' if s.get('tag') else ''

def L(s): return LOOKS[s['look']]

def t_issue(s):
    lk = L(s); cat = s.get('cat') or ''; col = CATS.get(cat, ('heart-pulse', '#1D4ED8'))[1]
    return f'''<body style="background:linear-gradient(160deg,{lk['wash']} 0%,#fff 72%)">{tag(s)}
<div class="abs" style="left:72px;top:46px;display:flex;align-items:center;gap:14px;font:700 26px Poppins;color:{col}">{icon(CATS.get(cat, ('heart-pulse',))[0], 34, col, 2)}{e(TOPIC_NAME.get(cat, 'Health'))}</div>
<div class="abs box P" data-fit="40" style="left:72px;top:112px;width:700px;height:290px;font:800 76px/1.06 Poppins;letter-spacing:-.025em;color:#142B35;text-wrap:balance">{e(s['name'])}</div>
<div class="abs" style="left:72px;top:416px;display:inline-flex;align-items:center;gap:14px;padding:14px 30px 14px 22px;border-radius:999px;background:{lk['ink']};color:#fff;font:700 38px Poppins">{icon(lk['icon'], 40, '#fff', 2)}<span id="ask">{e(lk['big'])}</span></div>
<div class="abs box" data-fit="18" style="left:72px;top:500px;width:700px;height:40px;font:400 28px/1.3 Lato;color:#344852">{e(lk['short'])}</div>
<div class="abs" style="right:56px;top:96px;width:330px;display:flex;flex-direction:column;align-items:center;gap:0"><div style="width:330px;height:330px;border-radius:50%;background:{col}14;border:3px solid {col}33;display:flex;align-items:center;justify-content:center"><div style="width:250px">{art(cat, 250)}</div></div></div>
{brand('left:72px;bottom:30px')}</body>'''

def t_sign(s):
    return f'''<body style="background:#FFF4EE">{tag(s)}
<div class="abs" style="left:300px;top:40px;width:600px;height:400px;background:#fff;border:10px solid #142B35;border-radius:10px;transform:rotate(-3deg);box-shadow:12px 14px 0 #F68B2C;display:flex;align-items:center;justify-content:center;text-align:center;padding:10px 30px">
<div class="box" data-fit="40" style="width:520px;height:340px;display:flex;text-align:center;align-items:center;justify-content:center;font:400 120px/0.92 'Bebas Neue';letter-spacing:2px;color:#142B35"><div>{e(s['slogan'])}</div></div></div>
<div class="abs" style="left:585px;top:430px;width:30px;height:200px;background:#8A5A00;border-radius:6px"></div>
<div class="abs box P" data-fit="22" style="left:40px;top:462px;width:500px;height:110px;font:800 40px/1.1 Poppins">{e(s['foot'])}</div>
<div class="abs box" data-fit="18" style="left:40px;top:40px;width:240px;height:170px;font:700 26px/1.25 Poppins;color:#984B0B">{e(s['kicker'])}</div>
{brand('left:auto;right:30px;bottom:30px')}</body>'''

def t_calendar(s):
    return f'''<body style="background:#EDF9FF">{tag(s)}
<div class="abs" style="left:70px;top:60px;width:380px;height:470px;background:#fff;border-radius:22px;box-shadow:0 18px 40px #09354622;overflow:hidden;text-align:center">
<div style="background:#D9473B;color:#fff;font:800 54px/1 Poppins;padding:26px 0">{e(s['dow'].upper())}</div>
<div style="font:900 230px/1 Poppins;color:#142B35;margin-top:20px">{e(s['day'])}</div><div style="font:700 44px Poppins;color:#5F6F76">{e(s['month'].upper())}</div></div>
<div class="abs box P" data-fit="34" style="left:510px;top:96px;width:640px;height:270px;font:800 64px/1.08 Poppins">{e(s['head'])}</div>
<div class="abs box" data-fit="18" style="left:510px;top:382px;width:640px;height:130px;font:400 30px/1.35 Lato;color:#344852">{e(s['sub'])}</div>{brand('left:510px;bottom:30px')}</body>'''

def t_letter(s):
    return f'''<body style="background:#F4F7F9">{tag(s)}
<div class="abs" style="left:60px;top:40px;width:600px;height:550px;border-radius:6px;box-shadow:0 10px 30px #14293522;transform:rotate(-2deg);padding:36px 46px;background:#FFFDF6 repeating-linear-gradient(#FFFDF6 0 46px,#C4E8F6 46px 48px)">
<div class="box" data-fit="26" style="width:508px;height:380px;font:700 44px/48px Caveat;color:#093546">{e(s['greet'])}<br>{e(s['body'])}</div>
<div style="font:700 44px/48px Caveat;color:#093546;margin-top:8px">Mahalo,</div><div style="width:260px;border-bottom:3px solid #093546;height:30px"></div><div style="font:600 18px Poppins;color:#5F6F76;margin-top:4px">your name here</div></div>
<div class="abs" style="left:710px;top:70px;width:450px"><div class="box" data-fit="30" style="height:200px;font:800 56px/1.1 Poppins">{e(s['head'])}</div>
<div class="box" data-fit="18" style="height:170px;margin-top:24px;font:400 30px/1.35 Lato;color:#344852">{e(s['sub'])}</div></div>{brand('left:710px;bottom:30px;width:450px')}</body>'''

def t_text(s):
    return f'''<body style="background:linear-gradient(160deg,#F5F1FF,#fff)">{tag(s)}
<div class="abs" style="left:90px;top:30px;width:400px;height:640px;background:#142B35;border-radius:56px;padding:18px"><div style="background:#fff;border-radius:42px;height:100%;padding:60px 22px 0;font:400 26px/1.3 Lato">
<div class="box" data-fit="18" style="background:#E9E9EB;border-radius:22px;padding:14px 18px;width:310px;height:140px;margin-bottom:14px">{e(s['b1'])}</div>
<div class="box" data-fit="18" style="background:#E9E9EB;border-radius:22px;padding:14px 18px;width:310px;height:160px;margin-bottom:14px">{e(s['b2'])}</div>
<div style="background:#0B7CA5;color:#fff;border-radius:22px;padding:14px 18px;width:190px;margin-left:auto;display:flex;align-items:center;gap:10px">{e(s['reply'])}{icon('check', 28, '#fff', 3)}</div></div></div>
<div class="abs" style="left:560px;top:80px;width:600px"><div class="box P" data-fit="34" style="height:250px;font:800 64px/1.08 Poppins">{e(s['head'])}</div>
<div class="box" data-fit="18" style="height:120px;margin-top:20px;font:400 30px/1.35 Lato;color:#344852">{e(s['sub'])}</div></div>{brand('left:560px;bottom:30px')}</body>'''

def t_neighbors(s):
    v = VOICES.replace('class="art art-voices"', 'width="620"')
    return f'''<body style="background:#EDF9FF">{tag(s)}
<div class="abs" style="left:60px;top:170px;width:620px">{v}</div>
<div class="abs box" data-fit="22" style="left:130px;top:36px;width:470px;height:130px;background:#fff;border:6px solid #142B35;border-radius:12px;text-align:center;padding:12px 14px;display:flex;align-items:center;justify-content:center;font:800 40px/1.1 Poppins;transform:rotate(2deg)"><div>{e(s['sign'])}</div></div>
<div class="abs" style="left:720px;top:90px;width:440px"><div class="box" data-fit="30" style="height:260px;font:800 54px/1.1 Poppins">{e(s['head'])}</div>
<div class="box" data-fit="18" style="height:130px;margin-top:20px;font:400 30px/1.35 Lato;color:#344852">{e(s['sub'])}</div></div>{brand('left:720px;bottom:30px;width:440px')}</body>'''

def t_islands(s):
    return f'''<body style="background:#093546;color:#fff">{tag(s)}
<div class="abs" style="left:40px;top:60px;width:640px">{islands_svg(s['lit'])}</div>
<div class="abs" style="left:700px;top:70px;width:460px"><div class="box" data-fit="32" style="height:190px;font:800 56px/1.08 Poppins">{e(s['head'])}</div>
<div class="box" data-fit="22" style="height:100px;margin-top:14px;font:700 34px/1.2 Poppins;color:#FCD09D">{e(s['subject'])}</div>
<div class="box" data-fit="18" style="height:100px;margin-top:14px;font:400 28px/1.35 Lato;color:#C4E8F6">{e(s['sub'])}</div></div>{brand('left:700px;bottom:30px', '#C4E8F6', True)}</body>'''

def t_before(s):
    bad = s.get('bad'); cat = s.get('cat') or ''
    return f'''<body style="background:#fff">{tag(s)}
<div class="abs" style="left:0;top:0;width:600px;height:430px;background:#F4F7F9;text-align:center;padding-top:34px"><div style="font:700 34px Poppins;color:#5F6F76;letter-spacing:2px">{e(s['beforeLabel'].upper())}</div><div style="width:200px;margin:14px auto">{art(cat, 200, True)}</div>
<div class="box P" data-fit="26" style="width:520px;height:110px;margin:0 auto;display:flex;text-align:center;align-items:center;justify-content:center;font:800 50px/1.1 Poppins;color:#5F6F76"><div>{e(s['beforeText'])}</div></div></div>
<div class="abs" style="left:600px;top:0;width:600px;height:430px;background:{'#FFEDEA' if bad else '#E6FAE9'};text-align:center;padding-top:34px"><div style="font:700 34px Poppins;color:{'#9B2C1F' if bad else '#056639'};letter-spacing:2px">{e(s['afterLabel'].upper())}</div><div style="width:200px;margin:14px auto">{art(cat, 200)}</div>
<div class="box P" data-fit="26" style="width:520px;height:110px;margin:0 auto;display:flex;text-align:center;align-items:center;justify-content:center;font:800 50px/1.1 Poppins;color:{'#9B2C1F' if bad else '#056639'}"><div>{e(s['afterText'])}</div></div></div>
<div class="abs box P" data-fit="22" style="left:60px;top:448px;width:1080px;height:100px;display:flex;align-items:center;justify-content:center;text-align:center;font:800 44px/1.15 Poppins"><div>{e(s['tail'])}</div></div>{brand('left:380px;bottom:22px')}</body>'''

def t_here(s):
    steps = s['steps']; n = len(steps); W = 1000; x0 = 100; gap = W / (n - 1)
    cur = next((i for i, p in enumerate(steps) if p['at'] == 'here'), n - 1)   # a law: every step is done, the marker sits on the last
    bar_done = x0 + gap * min(cur, n - 1)
    nodes = ''
    for i, p in enumerate(steps):
        cx = x0 + gap * i; r = 35 if p['at'] == 'here' else 23
        col = '#F68B2C' if p['at'] == 'here' else '#00698E' if p['at'] == 'done' else '#DBE3E7'
        chk = icon('check', 28, '#fff', 3) if p['at'] == 'done' else ''
        ink = '#984B0B' if p['at'] == 'here' else '#344852'
        nodes += f'<div class="abs" style="left:{cx - r}px;top:{304 - r}px;width:{2 * r}px;height:{2 * r}px;border-radius:50%;background:{col};display:flex;align-items:center;justify-content:center">{chk}</div>'
        nodes += f'<div class="abs box" data-fit="14" style="left:{cx - 90}px;top:352px;width:180px;height:70px;text-align:center;font:{"800 25px" if p["at"] == "here" else "600 21px"}/1.15 Poppins;color:{ink}">{e(p["label"])}</div>'
    mx = x0 + gap * cur
    return f'''<body style="background:#FFF8E1">{tag(s)}
<div class="abs box P" data-fit="36" style="left:60px;top:46px;width:1080px;height:150px;font:800 60px/1.08 Poppins">{e(s['head'])}</div>
<div class="abs" style="left:{x0}px;top:300px;width:{W}px;height:8px;background:#DBE3E7;border-radius:4px"></div><div class="abs" style="left:{x0}px;top:300px;width:{bar_done - x0}px;height:8px;background:#00698E;border-radius:4px"></div>
{nodes}<div class="abs" style="left:{mx - 90}px;top:218px;width:180px;white-space:nowrap;text-align:center;font:800 24px Poppins;color:#142B35;background:#F68B2C;padding:4px 0;border-radius:999px">{e(s['marker'])}</div>
<div class="abs box" data-fit="18" style="left:60px;top:452px;width:1080px;height:90px;font:400 30px/1.35 Lato;color:#344852">{e(s['sub'])}</div>{brand('left:auto;right:40px;bottom:24px')}</body>'''

def t_ticket(s):
    return f'''<body style="background:#142B35">{tag(s)}
<div class="abs" style="left:80px;top:90px;width:1040px;height:430px;background:#FCD09D;border-radius:24px;display:flex;overflow:hidden">
<div style="flex:1;padding:40px 50px"><div style="font:700 28px Poppins;letter-spacing:4px;color:#7A3A06">{e(s['kicker'])}</div>
<div class="box P" data-fit="34" style="width:640px;height:150px;margin:14px 0;font:800 64px/1.05 Poppins">{e(s['head'])}</div>
<div class="box" data-fit="18" style="width:640px;height:110px;font:600 32px/1.4 Lato;color:#344852">{e(s['line1'])}<br>{e(s['line2'])}</div></div>
<div style="width:290px;border-left:6px dashed #142B35;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#F68B2C;color:#142B35"><div style="font:800 40px Poppins">{e(s['num'])}</div><div style="font:600 26px Poppins;margin-top:10px">{e(s['minutes'])}</div></div></div>
{brand('left:40px;bottom:26px', '#C4E8F6', True)}</body>'''

def t_crowd(s):
    cols = ['#056639', '#16A34A', '#9FDDB0', '#056639', '#F68B2C', '#16A34A', '#056639', '#9FDDB0', '#16A34A', '#056639', '#F68B2C', '#9FDDB0', '#16A34A', '#056639', '#16A34A', '#9FDDB0', '#056639', '#16A34A', '#F68B2C', '#056639', '#9FDDB0', '#16A34A', '#056639', '#16A34A']
    dots = ''.join(f'<span style="display:inline-block;width:56px;height:56px;margin:5px;border-radius:50%;background:{c}"></span>' for c in cols)
    return f'''<body style="background:linear-gradient(160deg,#E6FAE9,#fff)">{tag(s)}
<div class="abs box" data-fit="90" style="left:60px;top:30px;width:660px;height:260px;font:900 250px/1.05 Poppins;color:#056639;white-space:nowrap">{e(s['n'])}</div>
<div class="abs box P" data-fit="26" style="left:70px;top:300px;width:640px;height:130px;font:800 48px/1.1 Poppins">{e(s['line'])}</div>
<div class="abs box" data-fit="18" style="left:70px;top:446px;width:620px;height:90px;font:400 30px/1.35 Lato;color:#344852">{e(s['sub'])}</div>
<div class="abs" style="left:760px;top:120px;width:380px">{dots}</div>{brand('left:760px;bottom:30px;width:400px')}</body>'''

def t_stand(s):
    btn = lambda ic, t, bg, fg, bd: f'<div style="width:400px;padding:26px 0;border-radius:24px;background:{bg};color:{fg};border:3px solid {bd};display:flex;align-items:center;justify-content:center;gap:14px;font:800 42px Poppins;margin-bottom:24px">{icon(ic, 46, fg, 2.4)}{e(t)}</div>'
    b = s['buttons']
    return f'''<body style="background:#F4F7F9">{tag(s)}
<div class="abs box P" data-fit="34" style="left:60px;top:60px;width:620px;height:250px;font:800 66px/1.08 Poppins">{e(s['head'])}</div>
<div class="abs box" data-fit="18" style="left:60px;top:330px;width:600px;height:180px;font:400 32px/1.35 Lato;color:#344852">{e(s['sub'])}</div>
<div class="abs" style="left:740px;top:100px">{btn('thumbs-up', b[0], '#fff', '#142B35', '#9AAAB2')}{btn('thumbs-down', b[1], '#fff', '#142B35', '#9AAAB2')}{btn('circle-help', b[2], '#fff', '#142B35', '#9AAAB2')}</div>{brand('left:60px;bottom:30px')}</body>'''

def t_postcard(s):
    cat = s.get('cat') or ''; ic, col = CATS.get(cat, ('megaphone', '#1D4ED8'))
    if cat not in CATS: ic = 'megaphone'
    cap = CAPITOL
    for k, v in {'var(--o400)': '#F68B2C', 'var(--p300)': '#6BCDF8', 'var(--p900)': '#093546', 'var(--p800)': '#024F69', 'var(--p700)': '#00698E', 'var(--p100)': '#C4E8F6'}.items(): cap = cap.replace(k, v)
    return f'''<body style="background:#EDF9FF">{tag(s)}
<div class="abs" style="left:50px;top:40px;width:1100px;height:550px;background:#FFFDF6;border-radius:10px;box-shadow:0 12px 30px #09354622;display:flex">
<div style="width:560px;padding:44px;border-right:3px solid #C2CCD1"><div style="font:400 92px/0.95 'Bebas Neue';color:#D9473B">ALOHA FROM<br>THE CAPITOL</div><div style="width:440px;margin-top:20px">{cap.replace('class="art art-capitol"', 'width="440"')}</div></div>
<div style="flex:1;padding:40px;position:relative"><div style="position:absolute;right:36px;top:30px;width:120px;height:140px;background:#F4B223;border:6px dashed #fff;outline:3px solid #F4B223;display:flex;align-items:center;justify-content:center">{icon(ic, 70, '#142B35', 1.8)}</div>
<div class="box" data-fit="22" style="position:absolute;left:40px;top:190px;width:440px;height:310px;font:700 44px/1.22 Caveat;color:#093546">{e(s['note'])}<div style="margin-top:14px">{e(s.get('from', ''))}</div></div></div></div></body>'''

TEMPLATES = {k[2:]: v for k, v in globals().items() if k.startswith('t_')}

# Shrink every data-fit block until it fits its box (width and height), and say whether all of them do.
FIT = """() => { let ok = true;
  for (const el of document.querySelectorAll('[data-fit]')) { const min = +el.dataset.fit; let f = parseFloat(getComputedStyle(el).fontSize);
    const over = () => el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1;
    while (over() && f > min) { f -= 2; el.style.fontSize = f + 'px'; }
    if (over()) ok = false; }
  return ok; }"""

def render(pg, spec, out):
    """Draw one spec to out (a .jpg path); True when every text block fit."""
    pg.set_content(doc(TEMPLATES[spec['v']](spec)), wait_until='networkidle'); pg.evaluate('document.fonts.ready'); pg.wait_for_timeout(120)
    fits = pg.evaluate(FIT)
    os.makedirs(os.path.dirname(out), exist_ok=True)
    pg.screenshot(path=out, type='jpeg', quality=82)
    return fits
