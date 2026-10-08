# R-210 (Nate 10/8): the Bills filter's Issue and Sponsor choices, the Tasks page, and Help's shortcut line, walked in the
# sandbox at a phone and a laptop width.
#   python3 tests/power_tools.py      (the frontend served on :8832)
import os, sys
from playwright.sync_api import sync_playwright
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import checks
BASE = 'http://localhost:8832/staff.html?demo=1'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out', 'power'); os.makedirs(OUT, exist_ok=True)
results, fails, errors = [], [], []
def ok(c, m): (results if c else fails).append(('PASS ' if c else 'FAIL ') + m)
W8 = 'const w = ms => new Promise(r => setTimeout(r, ms));'

with sync_playwright() as pw:
    b = pw.chromium.launch()
    for W, H, tag in ((390, 844, 'p'), (1440, 900, 'd')):
        c = b.new_context(viewport={'width': W, 'height': H}, is_mobile=W < 600, has_touch=W < 600)
        p = c.new_page(); sup = []
        p.on('pageerror', lambda e: errors.append(f'{W}: {e}'))
        p.on('request', lambda r: sup.append(r.url) if 'supabase.co' in r.url else None)
        # ---- Bills: Issue and Sponsor in the filter sheet ----
        p.goto(BASE + '#/bills'); p.evaluate("localStorage.setItem('hiphi2_bills_demo', JSON.stringify({ scope: 'all' }))"); p.reload(); p.wait_for_timeout(3500)
        res = p.evaluate(W8 + """(async () => {
          const nm = b => (b.innerText.trim() || b.getAttribute('aria-label') || ''); const click = t => [...document.querySelectorAll('button')].find(b => nm(b) === t || nm(b).startsWith(t))?.click();
          document.querySelector('[data-filter]').click(); await w(600);
          const fs = document.querySelector('.bl-fs'); fs.querySelectorAll('details').forEach(d => d.open = true);
          const out = { folds: [...fs.querySelectorAll('summary h3')].map(h => h.innerText), foot0: document.querySelector('.sv-sh-foot').innerText,
            issVis: [...fs.querySelectorAll('[data-pcrows="issues"] .bl-crow')].filter(r => !r.hidden).length, issAll: fs.querySelectorAll('[data-pcrows="issues"] .bl-crow').length };
          const q = fs.querySelector('[data-pq="spons"]'); q.value = 'tarn'; q.dispatchEvent(new Event('input'));
          const vis = [...fs.querySelectorAll('[data-pcrows="spons"] .bl-crow')].filter(r => !r.hidden);
          out.typed = vis.map(r => r.innerText.replace(/\\s+/g, ' ')); const n = +vis[0].querySelector('.bl-n').innerText; vis[0].click(); await w(500);
          out.foot1 = document.querySelector('.sv-sh-foot').innerText; out.n = n;
          out.sub = [...document.querySelectorAll('.bl-fs summary')].map(s => s.innerText.replace(/\\n/g, ' | '));
          const i = document.querySelector('[data-pcrows="issues"] .bl-crow:not(:disabled)'); i.click(); await w(500);
          out.foot2 = document.querySelector('.sv-sh-foot').innerText;
          out.saved = JSON.parse(localStorage.getItem('hiphi2_bills_demo') || '{}');
          document.querySelector('[data-fclear]').click(); await w(400); out.foot3 = document.querySelector('.sv-sh-foot').innerText;
          return out; })()""")
        ok('Issue' in res['folds'] and 'Sponsor' in res['folds'], f'{tag}: the filter has Issue and Sponsor ({res["folds"]})')
        ok(res['issVis'] == 12 and res['issAll'] > 12, f'{tag}: issues show twelve until you type ({res["issVis"]} of {res["issAll"]})')
        ok(len(res['typed']) == 1 and 'Tarnas' in res['typed'][0], f'{tag}: typing narrows the sponsors ({res["typed"]})')
        ok(f'Show {res["n"]} bill' in res['foot1'], f'{tag}: choosing a sponsor leaves exactly the count beside it ({res["n"]} vs {res["foot1"]!r})')
        ok(any(s.startswith('Sponsor | Tarnas') for s in res['sub']), f'{tag}: the Sponsor fold names the choice ({res["sub"]})')
        ok(res['foot2'] != res['foot1'], f'{tag}: an issue narrows it further ({res["foot1"]!r} then {res["foot2"]!r})')
        ok(res['saved'].get('spons') == ['TARNAS'] and len(res['saved'].get('issues', [])) == 1, f'{tag}: both are remembered with the filters ({res["saved"].get("spons")}, {res["saved"].get("issues")})')
        ok('Show 340' in res['foot3'] or res['foot3'].split('\n')[1].startswith('Show') and res['n'] < int(res['foot3'].split('Show ')[1].split(' ')[0]), f'{tag}: Clear all clears them ({res["foot3"]!r})')
        # ---- Tasks ----
        p.goto(BASE + '#/tasks'); p.reload(); p.wait_for_timeout(3500)
        ok(p.evaluate("document.querySelector('h1')?.innerText || document.title").startswith('Tasks'), f'{tag}: Tasks opens')
        res = p.evaluate(W8 + """(async () => {
          document.querySelector('[data-val="all"]').click(); await w(300);
          const out = { n0: document.querySelectorAll('.tk-tick').length, groups: [...document.querySelectorAll('.tk-gh')].map(h => h.innerText.replace(/\\s+/g, ' ')), count: document.querySelector('.tk-count').innerText };
          document.querySelector('.tk-tick').click(); await w(500);
          out.n1 = document.querySelectorAll('.tk-tick').length; out.focus = document.activeElement.classList.contains('tk-tick');
          [...document.querySelectorAll('button')].find(b => b.innerText.trim() === 'Undo')?.click(); await w(400); out.n2 = document.querySelectorAll('.tk-tick').length;
          return out; })()""")
        ok(res['n0'] >= 1 and res['groups'][0].startswith('Overdue'), f'{tag}: Everyone lists open tasks, overdue first ({res["groups"]})')
        ok(res['n1'] == res['n0'] - 1 and res['focus'], f'{tag}: ticking one removes it and keeps the keyboard on the list ({res["n0"]} to {res["n1"]})')
        ok(res['n2'] == res['n0'], f'{tag}: Undo puts it back ({res["n2"]})')
        p.screenshot(path=f'{OUT}/{tag}_tasks.png', full_page=True)
        rep = checks.page_report(p, 'tasks')
        ok(not rep['overflow'], f'{tag}: Tasks has no sideways scroll')
        if tag == 'p': ok(not rep['small_targets'], f'{tag}: Tasks targets {rep["small_targets"][:3]}')
        # ---- the way in, and Help ----
        p.goto(BASE + '#/help/keys'); p.wait_for_timeout(1500)
        t = p.evaluate("document.body.innerText")
        ok('1 to 5' in t and '1 to 4' not in t, f'{tag}: Help says 1 to 5 for the bill tabs')
        ok('Tasks: next and previous task' in t, f'{tag}: Help lists the Tasks keys')
        if tag == 'd':
            p.goto(BASE + '#/'); p.wait_for_timeout(1800)
            ok(p.evaluate("[...document.querySelectorAll('.sv-sitem.sub .lbl')].map(e => e.innerText).includes('Tasks')"), f'{tag}: the sidebar has Tasks under Today')
            p.keyboard.press('g'); p.keyboard.press('k'); p.wait_for_timeout(600)
            ok(p.evaluate("location.hash") == '#/tasks', f'{tag}: g then k goes to Tasks')
        ok(not sup, f'{tag}: no supabase.co requests in the sandbox ({len(sup)})')
        c.close()
    b.close()
print('\n'.join(fails)); print(f'{len(fails)} failed, {len(results)} passed'); print('errors:', errors[:12])
