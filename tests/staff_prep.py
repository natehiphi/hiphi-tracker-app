# The issues' prep for 2027 (backend 091, R-088; staff/prep.js), walked in the sandbox at a phone and a laptop width: an
# owner works down the five steps and marks the issue ready, the admin sends it back and approves it, the board changes an
# owner and tells the owners, and a new issue is a draft until it has everything and is published.
#   python3 tests/staff_prep.py      (the frontend served on :8832)
import os, sys
from playwright.sync_api import sync_playwright
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import checks
BASE = 'http://localhost:8832/staff.html?demo=1&season=off'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out', 'prep'); os.makedirs(OUT, exist_ok=True)
results, fails, errors = [], [], []
def ok(c, m): (results if c else fails).append(('PASS ' if c else 'FAIL ') + m)
W8 = 'const w = ms => new Promise(r => setTimeout(r, ms));'

def layout(p, tag, name):
    rep = checks.page_report(p, name)
    ok(not rep['overflow'], f'{tag} {name}: no sideways scroll')
    if tag == 'p': ok(not rep['small_targets'], f'{tag} {name}: targets {rep["small_targets"][:3]}')
    p.screenshot(path=f'{OUT}/{tag}_{name}.png', full_page=True)

with sync_playwright() as pw:
    b = pw.chromium.launch()
    for W, H, tag in ((390, 844, 'p'), (1440, 900, 'd')):
        c = b.new_context(viewport={'width': W, 'height': H}, is_mobile=W < 600, has_touch=W < 600)
        p = c.new_page(); sup = []
        p.on('pageerror', lambda e: errors.append(f'{W}: {e}'))
        p.on('request', lambda r: sup.append(r.url) if 'supabase.co' in r.url else None)
        p.goto(BASE + '#/outreach/issues'); p.reload(); p.wait_for_timeout(3500)
        links = p.evaluate("[...document.querySelectorAll('.pr-links a')].map(a => a.innerText.trim())")
        ok(any(l.startswith('My issues') for l in links) and any(l.startswith('Prep board') for l in links), f'{tag}: Issues links My issues and the prep board ({links})')
        # Today tells the owner what is left
        p.goto(BASE + '#/today'); p.wait_for_timeout(1500)
        t = p.evaluate("document.querySelector('.sv-notice')?.innerText || ''")
        ok('Your issues for 2027' in t and 'Due Fri 6 Nov' in t, f'{tag}: Today says how many issues are ready and when they are due ({t[:60]!r})')
        # My issues
        p.goto(BASE + '#/outreach/issues?view=mine'); p.wait_for_timeout(1200)
        rows = p.evaluate("document.querySelectorAll('.pr-row').length")
        ok(rows > 0 and p.evaluate("document.querySelector('.pr-top h1')?.innerText") == 'My issues', f'{tag}: My issues lists {rows} issues under its own heading')
        layout(p, tag, 'mine')
        # one issue: the five steps
        p.evaluate("document.querySelector('.pr-main').click()"); p.wait_for_timeout(1200)
        ok(p.evaluate("location.hash").startswith('#/issue/'), f'{tag}: a row opens the issue')
        ok(p.evaluate("document.querySelector('[data-pr=\"ready\"]')?.getAttribute('aria-disabled')") == 'true', f'{tag}: Mark ready waits until every step is done')
        layout(p, tag, 'issue')
        res = p.evaluate(W8 + """(async () => {
          const set = (sel, v) => { const t = document.querySelector(sel); t.value = v; t.dispatchEvent(new Event('input')); };
          const out = {};
          document.querySelector('[data-prstep="wording"]').click(); await w(400);
          out.lbl = document.querySelector('[data-prsave]').innerText.trim();
          document.querySelector('[data-prsave]').click(); await w(600);
          document.querySelector('[data-prstep="outlook"]').click(); await w(400); document.querySelector('[data-prsave]').click(); await w(600);
          document.querySelector('[data-prstep="goal"]').click(); await w(400); set('#pr-goal', 'Pass it in 2027.'); document.querySelector('[data-prsave]').click(); await w(600);
          document.querySelector('[data-prstep="points"]').click(); await w(400); set('#pr-points', 'One.\\nTwo.'); document.querySelector('[data-prsave]').click(); await w(300);
          out.tooFew = document.querySelector('#pr-points-err').innerText.trim();
          set('#pr-points', 'One.\\nTwo.\\nThree.'); document.querySelector('[data-prsave]').click(); await w(600);
          document.querySelector('[data-prstep="plan"]').click(); await w(400); document.querySelector('[data-pv="keep"]').click(); await w(700);
          out.done = document.querySelectorAll('.pr-step.done').length + ' of 5 done';
          document.querySelector('[data-pr="ready"]').click(); await w(700);
          out.ready = document.querySelector('.pr-card .chip').innerText.trim();
          document.querySelector('[data-pr="sendback"]').click(); await w(400); document.querySelector('[data-prsave]').click(); await w(300);
          out.noteNeeded = document.querySelector('#pr-note-err').innerText.trim();
          set('#pr-note', 'Say by when.'); document.querySelector('[data-prsave]').click(); await w(700);
          out.back = document.querySelector('.pr-card').innerText.includes('sent it back: Say by when.');
          document.querySelector('[data-pr="ready"]').click(); await w(700);
          document.querySelector('[data-pr="approve"]').click(); await w(700);
          out.approved = document.querySelector('.pr-card .chip').innerText.trim();
          return out; })()""")
        ok(res['lbl'] == 'Looks right', f'{tag}: an unchanged name and description are confirmed with "Looks right" ({res["lbl"]})')
        ok('three' in res['tooFew'], f'{tag}: two talking points are refused ({res["tooFew"]!r})')
        ok(res['done'].startswith('5 of 5 done'), f'{tag}: all five steps done ({res["done"]!r})')
        ok(res['ready'] == 'Waiting for approval', f'{tag}: Mark ready puts it in front of the admin ({res["ready"]})')
        ok('Say what needs changing' in res['noteNeeded'] and res['back'], f'{tag}: sending back needs a note, and the note shows on the issue')
        ok(res['approved'] == 'Approved', f'{tag}: the admin approves it ({res["approved"]})')
        # the board: an owner change, Tell owners, the filters
        p.goto(BASE + '#/outreach/issues?view=prep'); p.wait_for_timeout(1200)
        layout(p, tag, 'board')
        res = p.evaluate(W8 + """(async () => {
          const out = {};
          out.lede = document.querySelector('.pr-top .le-lede').innerText;
          const btn = document.querySelector('[data-prown]'), id = btn.dataset.prown; btn.click(); await w(400);
          [...document.querySelectorAll('[data-pv]')].find(b => b.innerText.startsWith('Saya')).click(); await w(600);
          out.owner = document.querySelector(`[data-prown="${id}"]`).innerText.trim();
          document.querySelector('[data-pr="tell"]').click(); await w(600);
          out.told = document.querySelector('.pr-told')?.innerText || '';
          document.querySelector('[data-seg="prf"][data-val="wait"]').click(); await w(400);
          out.wait = document.querySelector('#pr-body').innerText.trim();
          return out; })()""")
        ok(res['lede'].startswith('1 of 91 approved'), f'{tag}: the board counts the approval ({res["lede"][:30]!r})')
        ok(res['owner'].endswith('Saya'), f'{tag}: the owner is changed from the board ({res["owner"]!r})')
        ok('Owners have been told' in res['told'], f'{tag}: Tell owners marks them told')
        ok(res['wait'] == 'Nothing is waiting for you.', f'{tag}: "Waiting for you" is empty once approved')
        # a new issue is a draft until it has everything
        p.goto(BASE + '#/outreach/issues'); p.wait_for_timeout(1000)
        res = p.evaluate(W8 + """(async () => {
          const set = (sel, v) => { const t = document.querySelector(sel); t.value = v; t.dispatchEvent(new Event('input')); };
          const out = {};
          document.querySelector('[data-is="new"]').click(); await w(400);
          set('#is-name', 'Test prep issue'); document.querySelector('#is-desc').value = 'A test.';
          out.btn = document.querySelector('[data-issave]').innerText.trim();
          document.querySelector('[data-issave]').click(); await w(1200);
          out.draft = document.querySelector('.pr-card .chip')?.innerText.trim();
          out.missing = document.querySelector('.pr-card .pr-lede').innerText;
          out.publicCard = !!document.querySelector('.le-pubcard');
          document.querySelector('[data-pr="publish"]').click(); await w(500);
          out.stillDraft = !document.querySelector('[data-yes]');
          if (document.querySelector('dialog[open]')) { history.back(); await w(500); }
          if (!document.querySelector('#pr-goal')) { document.querySelector('[data-prstep="goal"]').click(); await w(400); }
          set('#pr-goal', 'Win.'); document.querySelector('[data-prsave]').click(); await w(600);
          document.querySelector('[data-prstep="points"]').click(); await w(400); set('#pr-points', 'A.\\nB.\\nC.'); document.querySelector('[data-prsave]').click(); await w(600);
          set('#is-bq', 'tobacco'); await w(400); document.querySelector('[data-add]').click(); await w(800);
          document.querySelector('[data-pr="publish"]').click(); await w(500); document.querySelector('[data-yes]').click(); await w(800);
          out.published = !document.querySelector('.pr-draft') && !!document.querySelector('.le-pubcard');
          out.after = document.querySelectorAll('.pr-step.done').length + ' of 5 done';
          return out; })()""")
        ok(res['btn'] == 'Save as draft' and res['draft'] == 'Draft' and not res['publicCard'], f'{tag}: a new issue is saved as a draft with no public card ({res["btn"]}, {res["draft"]})')
        ok('a goal, three talking points and a bill' in res['missing'], f'{tag}: the draft says what it still needs ({res["missing"][-60:]!r})')
        ok(res['stillDraft'], f'{tag}: Publish does nothing until it has everything')
        ok(res['published'] and res['after'].startswith('5 of 5'), f'{tag}: once complete it is published, with its prep counted as done ({res["after"][:20]!r})')
        ok(not sup, f'{tag}: no supabase.co requests in the sandbox ({len(sup)})')
        c.close()
    b.close()
print('\n'.join(fails)); print(f'{len(fails)} failed, {len(results)} passed'); print('errors:', errors[:12])
