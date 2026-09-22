# Staff v2 end-to-end checks (plan section 7). python3 e2e.py
import json, os, sys, re
from playwright.sync_api import sync_playwright
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import checks
BASE = 'http://localhost:8832/staff.html?demo=1'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out', 'final'); os.makedirs(OUT, exist_ok=True)
ALLOWED = {13.0, 14.0, 16.0, 18.0, 22.0}
HEAL = '979b46c2-8bb8-44ee-a5e6-fca6235de48c'   # a coalition whose sandbox week has hearings (R-022)
GLYPH = r"""(() => { const bad = /[\p{Extended_Pictographic}✓✕★☆↗→←▸▾▴◷☰＋‹›▶⌂✉▤⚖☺⚙✎↺«☀]/u, out = [];
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); let n;
  while ((n = w.nextNode())) { const p = n.parentElement; if (p && p.offsetParent !== null && bad.test(n.nodeValue) && !p.closest('.band')) out.push(n.nodeValue.trim().slice(0, 50)); }
  return out; })()"""
FAMS = r"""(() => { const f = new Set(); document.querySelectorAll('main *, header *').forEach(e => { if (e.offsetParent === null) return; if (![...e.childNodes].some(n => n.nodeType === 3 && n.nodeValue.trim())) return; f.add(getComputedStyle(e).fontFamily.split(',')[0].replace(/["']/g, '').trim()); }); return [...f]; })()"""
results, fails, errors = [], [], []
def ok(c, m): (results if c else fails).append(('PASS ' if c else 'FAIL ') + m)

def ctx(b, w, h, **kw):
    c = b.new_context(viewport={'width': w, 'height': h}, is_mobile=w < 600, has_touch=w < 600, device_scale_factor=2 if w < 600 else 1, **kw)
    p = c.new_page(); sup = []
    p.on('pageerror', lambda e: errors.append(f'{w}: {e}'))
    p.on('console', lambda m: errors.append(f'console {w}: {m.text[:160]}') if m.type == 'error' else None)
    p.on('request', lambda r: sup.append(r.url) if 'supabase.co' in r.url else None)
    return c, p, sup

def visit(p, h, wait=2500, extra=''):
    p.goto(BASE + extra + '#' + h.lstrip('#')); p.reload(); p.wait_for_timeout(wait)

with sync_playwright() as pw:
    b = pw.chromium.launch()
    for W, H, tag in ((390, 844, 'p'), (1440, 900, 'd')):
        c, p, sup = ctx(b, W, H)
        visit(p, '/', 4000)
        leg = p.evaluate("(()=>{ const a=document.querySelector('a[href^=\"#/legislator/\"]'); return a && a.getAttribute('href') })()")
        routes = ['/', '/review', '/bills', '/bills/new', '/bills/memo', '/bills/muted', '/bill/HB1562', '/bill/HB1562/activity', '/bill/HB1562/pathway', '/bill/HB1562/public',
                  '/legislators', '/search?q=vaping', '/outreach', '/outreach/lists', '/outreach/emails', '/email/new', '/me', '/setup', '/help']
        # R-022: the coalition and hearing pages. Hearing ids change when the snapshot is rebuilt, so take one from HEAL's week.
        visit(p, '/coalition/' + HEAL, 3000)
        hr = p.evaluate("(()=>{ const a=document.querySelector('a[href^=\"#/hearing/\"]'); return a && a.getAttribute('href').slice(1).split('?')[0] })()")
        ok(bool(hr), f'{tag}: the HEAL coalition page links a hearing')
        routes += ['/coalition', '/coalition/' + HEAL] + ([hr] if hr else [])
        for r in routes:
            visit(p, r, 3000)
            name = r.strip('/').replace('/', '_').replace('?', '_') or 'today'
            p.screenshot(path=f'{OUT}/{tag}_{name}.png', full_page=False)
            rep = checks.page_report(p, name)
            fs = set(rep['font_sizes']) - ALLOWED
            glyph = p.evaluate(GLYPH); fam = [f for f in p.evaluate(FAMS) if f not in ('Lato', 'Poppins')]
            ok(not rep['overflow'], f'{tag} {name}: no sideways scroll')
            if W < 600: ok(not rep['small_targets'], f'{tag} {name}: targets {rep["small_targets"][:3]}')
            ok(not fs, f'{tag} {name}: font sizes {sorted(fs)}')
            ok(not glyph, f'{tag} {name}: no emoji/glyph {glyph[:3]}')
            ok(not fam, f'{tag} {name}: font families {fam}')
        ok(not sup, f'{tag}: no supabase.co requests in the sandbox ({len(sup)})')
        c.close()

    # ---- flows (phone) ----
    c, p, sup = ctx(b, 390, 844)
    visit(p, '/', 4000)
    first = p.evaluate("(()=>{ const c=document.querySelector('main [data-bill], main article, main .card'); return c ? Math.round(c.getBoundingClientRect().top) : -1 })()")
    ok(0 < first <= 320, f'Today: first card top {first}px')   # the Hearings today strip sits above the first card (9/19)
    ids = p.evaluate("[...document.querySelectorAll('main [data-bill]')].map(e=>e.dataset.bill)")
    ok(len(ids) == len(set(ids)), f'Today: one card per bill ({len(ids)} cards, {len(set(ids))} bills)')
    # review queue: approve through
    visit(p, '/review', 3000)
    counter = p.evaluate("document.querySelector('main')?.innerText.match(/(\\d+) of (\\d+)/)?.[0] || ''")
    ok(bool(counter), f'Review shows a counter ({counter})')
    p.screenshot(path=f'{OUT}/flow_review.png')
    # legacy link lands on the bill page
    p.goto(BASE + '#bill=HB1562'); p.reload(); p.wait_for_timeout(3500)
    ok(p.evaluate('location.hash') == '#/bill/HB1562', f"legacy #bill= -> {p.evaluate('location.hash')}")
    # pathway -> legislator -> back
    visit(p, '/bill/HB1562/pathway', 3000)
    p.evaluate("(()=>{ const a=document.querySelector('main a[href^=\"#/legislator/\"]'); a && a.click(); })()"); p.wait_for_timeout(1500)
    h1 = p.evaluate('location.hash')
    back = p.evaluate("(()=>{ const a=document.querySelector('.sv-back'); return a ? a.innerText.trim() : '' })()")
    p.go_back(); p.wait_for_timeout(1200)
    ok(h1.startswith('#/legislator/') and 'HB1562' in back and p.evaluate('location.hash').startswith('#/bill/HB1562'), f'pathway -> legislator ({h1}, back "{back}") -> back to {p.evaluate("location.hash")}')
    # sheets close with Back
    visit(p, '/bill/HB1562', 3000)
    opened = p.evaluate("(()=>{ const b=document.querySelector('main .sv-pick'); if(!b) return false; b.click(); return true })()"); p.wait_for_timeout(500)
    was = p.evaluate("!!document.querySelector('dialog[open]')"); p.go_back(); p.wait_for_timeout(500)
    ok(opened and was and not p.evaluate("!!document.querySelector('dialog[open]')") and p.evaluate('location.hash').startswith('#/bill/HB1562'), 'a picker sheet opens and Back closes it without leaving the page')
    c.close()
    # reduced motion: nothing animating forever
    c, p, sup = ctx(b, 390, 844, reduced_motion='reduce'); visit(p, '/', 3500)
    n = p.evaluate("document.getAnimations().filter(a=>a.playState==='running').length"); ok(n == 0, f'reduced motion: {n} running animations')
    c.close(); b.close()

# both staff apps share one data layer by hand: their Supabase calls must match
import subprocess
root = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
d = subprocess.run(['node', os.path.join(root, 'staff', 'tools', 'parity.mjs')], capture_output=True, text=True, cwd=root)
ok(d.returncode == 0 and 'parity ok' in d.stdout, f'staff data layers match ({(d.stdout or d.stderr).strip()[-80:]})')
print('\n'.join(fails)); print(f'{len(fails)} failed, {len(results)} passed'); print('errors:', errors[:12])
