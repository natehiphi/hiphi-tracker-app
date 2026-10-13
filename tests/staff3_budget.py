# Staff v3 on a laptop: what is in view at once (DESIGN.md A-24, R-264). For each screen at 1280x800, 1440x900 and
# 1920x1080, on the practice copy as Nate (the admin, who sees the most): side panels in view (at most 1), separate boxes in
# the first screen (at most 5; a run of sibling boxes of the same kind, like a list's rows, counts as one), text colours
# (at most 7) and filled buttons outside a list (at most 1). Prints a table; exits 1 when a screen is over.
#   python3 tests/staff3_budget.py                  against http://localhost:8832 (CI serves the repo there)
#   V3_ROOT=/path/to/worktree python3 tests/staff3_budget.py    serves that folder straight into the browser (no server)
import json, mimetypes, os, sys
from urllib.parse import urlparse, unquote
from playwright.sync_api import sync_playwright

ROOT = os.environ.get('V3_ROOT', '')
HOST = 'http://v3.test' if ROOT else os.environ.get('HOST', 'http://localhost:8832')
SIZES = [(1280, 800), (1440, 900), (1920, 1080)]
SCREENS = [
  ('today', '/'), ('this week', '/?view=week'), ('my issues', '/my-issues'), ('bills', '/bills'), ('a bill', '/bill/HB1562'),
  ('its activity', '/bill/HB1562/activity'), ('its public tab', '/bill/HB1562/public'), ('all issues', '/outreach/issues'),
  ('an issue', '/issue/05e0d6a9-4ea7-456c-b219-e3632ade358b'), ('a coalition', '/coalition/979b46c2-8bb8-44ee-a5e6-fca6235de48c'),
  ('supporters', '/outreach'), ('emails', '/outreach/emails'), ('legislators', '/legislators'), ('my settings', '/me'),
]
LIMITS = {'side': 1, 'boxes': 5, 'colors': 7, 'filled': 1}

def serve(route):
  path = unquote(urlparse(route.request.url).path) or '/'
  f = os.path.join(ROOT, path.lstrip('/') or 'index.html')
  if not os.path.isfile(f): return route.fulfill(status=404, body='')
  t = {'.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.json': 'application/json'}.get(os.path.splitext(f)[1]) or mimetypes.guess_type(f)[0] or 'application/octet-stream'
  route.fulfill(status=200, body=open(f, 'rb').read(), headers={'content-type': t})

JS = r"""(() => {
  const H = innerHeight, main = document.querySelector('main') || document.body;
  const vis = e => e.offsetParent !== null && getComputedStyle(e).visibility !== 'hidden';
  const seen = r => r.bottom > 30 && r.top < H && r.width > 0 && r.height > 0;
  const bodyBg = getComputedStyle(document.body).backgroundColor, mainBg = getComputedStyle(main).backgroundColor;
  // tab rows and menus are furniture (B-13), and what a closed fold holds is not in view
  const boxed = e => { if (/^(BUTTON|A|INPUT|SELECT|TEXTAREA|SUMMARY|IMG|svg|NAV)$/i.test(e.tagName) || e.closest('nav')) return false;
    { const f = e.closest('details:not([open])'); if (f && f !== e && !e.closest('summary')) return false; }
    const r = e.getBoundingClientRect(); if (r.width < 160 || r.height < 44) return false; const s = getComputedStyle(e);
    const sides = ['Top', 'Right', 'Bottom', 'Left'].filter(k => parseFloat(s['border' + k + 'Width']) > 0 && !/rgba\(0, 0, 0, 0\)|transparent/.test(s['border' + k + 'Color'])).length;
    const bg = s.backgroundColor, fill = bg && !/rgba\(0, 0, 0, 0\)|transparent/.test(bg) && bg !== bodyBg && bg !== mainBg;
    return sides >= 3 || (s.boxShadow && s.boxShadow !== 'none') || fill; };
  const tops = []; main.querySelectorAll('*').forEach(e => { if (!vis(e) || !boxed(e) || !seen(e.getBoundingClientRect())) return; if (tops.some(b => b.contains(e))) return; tops.push(e); });
  // A list's rows, a table or the week's grid is one thing however many rows show (A-2: repetition does not compete with
  // itself): every box inside the same list counts once, as that list.
  const LIST = 'ul, ol, table, [role=list], [role=grid], .rows, .td-list, .td-weekgrid, .wk-bills, .le-bills';
  // ...and so is a run of sibling cards with exactly the same classes (My issues' issue cards).
  // Today's groups (Overdue, Today, Tomorrow…) are one list under headings.
  const keys = new Set(tops.map(e => { if (e.matches('.td-rows') && e.closest('.td-main')) return e.closest('.td-main'); const l = e.closest(LIST); if (l && main.contains(l)) return l;
    const twins = e.parentElement ? [...e.parentElement.children].filter(c => c.className === e.className && c.tagName === e.tagName) : [];
    return twins.length >= 3 ? e.parentElement : e; }));
  // Side panels: the columns an <aside> in the page lays out side by side (Today at 1600px and wider had two).
  const sides = [...main.querySelectorAll('aside, .sv-aside, [data-pane]')].filter(e => vis(e) && seen(e.getBoundingClientRect()) && e.getBoundingClientRect().width > 160 && !e.parentElement.closest('aside, .sv-aside, [data-pane]'))
    .reduce((n, a) => n + Math.max(1, new Set([...a.children].filter(c => vis(c) && c.getBoundingClientRect().width > 160).map(c => Math.round(c.getBoundingClientRect().left / 20))).size), 0);
  const colors = new Set(); const w = document.createTreeWalker(main, NodeFilter.SHOW_TEXT); let n;
  while ((n = w.nextNode())) { if (!n.nodeValue.trim()) continue; const el = n.parentElement; if (!el || !vis(el)) continue; const r = document.createRange(); r.selectNodeContents(n); const rr = r.getBoundingClientRect(); if (!seen(rr) || rr.width <= 2 || rr.height <= 2 || el.closest('.sr')) continue; colors.add(getComputedStyle(el).color); }   // screen-reader-only words are not seen
  // a filled button is one that looks filled: a strong background (an outlined one keeps a white ground)
  const strong = e => { const m = getComputedStyle(e).backgroundColor.match(/\d+(\.\d+)?/g); if (!m) return false; const [r, g, b, al = 1] = m.map(Number); return al > 0.5 && (r + g + b) / 3 < 160; };
  const filled = [...main.querySelectorAll('.btn, button, a.btn')].filter(e => vis(e) && seen(e.getBoundingClientRect()) && strong(e));
  const inList = e => { const row = e.closest('tr, li, .row, article, [data-row], .td-row'); return row && row.parentElement && [...row.parentElement.children].filter(c => c.tagName === row.tagName).length > 1; };
  const outside = filled.filter(e => !inList(e)).length + (filled.some(inList) ? 1 : 0);
  return { side: sides, boxes: keys.size, colors: colors.size, filled: outside };
})()"""

def main():
  rows, over = [], []
  with sync_playwright() as p:
    b = p.chromium.launch()
    for W, H in SIZES:
      ctx = b.new_context(viewport={'width': W, 'height': H})
      if ROOT: ctx.route(HOST + '/**', serve)
      pg = ctx.new_page()
      for name, route in SCREENS:
        pg.goto(f'{HOST}/staff3.html?demo=1&as=NT#{route}'); pg.wait_for_timeout(1300)
        m = pg.evaluate(JS); rows.append((W, name, m))
        bad = [k for k, lim in LIMITS.items() if m[k] > lim]
        if bad: over.append((W, name, bad))
      ctx.close()
    b.close()
  print(f"{'width':>5}  {'screen':16} side boxes colours filled")
  for W, name, m in rows:
    flag = ' <' if any(m[k] > LIMITS[k] for k in LIMITS) else ''
    print(f"{W:>5}  {name:16} {m['side']:>4} {m['boxes']:>5} {m['colors']:>7} {m['filled']:>6}{flag}")
  print(f"limits: {json.dumps(LIMITS)}; over: {len(over)}")
  if '--json' in sys.argv: print(json.dumps(rows))
  sys.exit(1 if over else 0)

if __name__ == '__main__':
  main()
