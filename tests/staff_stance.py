# HIPHI's stance on an issue (backend 094, R-093; staff/issues.js, staff/public.js, pub/core.js issuePos), walked in the
# sandbox at a phone, a narrow phone and a laptop width: the chip on an issue's page (pick, Undo), Edit issue's choice, a
# new issue starting with no stance chosen (B-12), the issues on a bill's Public tab (one row each, stance and ×),
# and the public issue page following the stance.
#   python3 tests/staff_stance.py      (the frontend served on :8832)
import os, sys, json
from playwright.sync_api import sync_playwright
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import checks
BASE = 'http://localhost:8832/staff.html?demo=1'
PUB = 'http://localhost:8832/track.html?demo=1'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out', 'stance'); os.makedirs(OUT, exist_ok=True)
results, fails, errors = [], [], []
def ok(c, m): (results if c else fails).append(('PASS ' if c else 'FAIL ') + m)
W8 = 'const w = ms => new Promise(r => setTimeout(r, ms));'
snap = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'demo', 'snapshot.json')))
LIQ = next(i for i in snap['issues'] if i['name'] == 'Higher liquor taxes')

def layout(p, tag, name):
    rep = checks.page_report(p, name)
    ok(not rep['overflow'], f'{tag} {name}: no sideways scroll')
    if tag != 'd': ok(not rep['small_targets'], f'{tag} {name}: targets {rep["small_targets"][:3]}')
    p.screenshot(path=f'{OUT}/{tag}_{name}.png', full_page=True)

with sync_playwright() as pw:
    b = pw.chromium.launch()
    for W, H, tag in ((390, 844, 'p'), (320, 700, 'n'), (1440, 900, 'd')):
        c = b.new_context(viewport={'width': W, 'height': H}, is_mobile=W < 600, has_touch=W < 600)
        p = c.new_page(); sup = []
        p.on('pageerror', lambda e: errors.append(f'{W}: {e}'))
        p.on('request', lambda r: sup.append(r.url) if 'supabase.co' in r.url else None)
        # ---- the issue's page: the chip, a pick, Undo ----
        p.goto(BASE + '#/issue/' + LIQ['id']); p.reload(); p.wait_for_timeout(3500)
        chip = p.evaluate("document.querySelector('[data-is=\"stance\"]')?.innerText.trim()")
        ok(chip == 'Support', f'{tag}: the issue page shows the starting stance ({chip!r})')
        layout(p, tag, 'issue')
        res = p.evaluate(W8 + """(async () => {
          const out = {}, chip = () => document.querySelector('[data-is="stance"]');
          chip().focus(); chip().click(); await w(500);
          out.opts = [...document.querySelectorAll('[data-pv]')].map(x => x.dataset.pv + ':' + x.getAttribute('aria-checked'));
          document.querySelector('[data-pv="mixed"]').click(); await w(700);
          out.after = chip().innerText.trim(); out.focus = document.activeElement === chip();
          out.toast = [...document.querySelectorAll('.toastmsg')].pop()?.innerText || '';
          const undo = [...document.querySelectorAll('.toastmsg .toastundo')].pop();
          if (undo) { undo.click(); await w(700); }
          out.undone = chip().innerText.trim();
          return out; })()""")
        ok(res['opts'] == ['support:true', 'oppose:false', 'mixed:false', ':false'], f'{tag}: the picker offers Support, Oppose, Mixed and Not set, the current one ticked ({res["opts"]})')
        ok(res['after'] == 'Mixed' and res['focus'], f'{tag}: a pick saves at once and the chip keeps focus ({res["after"]}, focus {res["focus"]})')
        ok('HIPHI’s stance on Higher liquor taxes: Mixed' in res['toast'] and 'Undo' in res['toast'], f'{tag}: it says so, with Undo ({res["toast"][:50]!r})')
        ok(res['undone'] == 'Support', f'{tag}: Undo puts it back ({res["undone"]})')
        # ---- Edit issue ----
        res = p.evaluate(W8 + """(async () => {
          const out = {};
          document.querySelector('[data-is="more"]').click(); await w(400);
          out.sub = document.querySelector('[data-mi="0"]').innerText;
          document.querySelector('[data-mi="0"]').click(); await w(800);
          out.radios = [...document.querySelectorAll('input[name="is-stance"]')].map(x => x.value + ':' + x.checked);
          out.legend = document.querySelector('.is-stance legend')?.innerText.trim();
          document.querySelector('input[name="is-stance"][value="oppose"]').click();
          document.querySelector('[data-issave]').click(); await w(900);
          out.saved = document.querySelector('[data-is="stance"]').innerText.trim();
          return out; })()""")
        ok('stance' in res['sub'], f'{tag}: the menu says Edit covers the stance ({res["sub"][:60]!r})')
        ok(res['legend'] == 'HIPHI’s stance' and res['radios'] == ['support:true', 'oppose:false', 'mixed:false'], f'{tag}: Edit issue has the stance, the current one chosen ({res["radios"]})')
        ok(res['saved'] == 'Oppose', f'{tag}: Save changes saves a new stance ({res["saved"]})')
        # ---- the bill page's Public tab (the sandbox keeps the Oppose saved above) ----
        p.goto(BASE + '#/bill/HB1991/public'); p.wait_for_timeout(1500)
        res = p.evaluate(W8 + """(async () => {
          const out = {}, row = () => document.querySelector('.bw-issrow');
          row().scrollIntoView({ block: 'center' }); await w(200);
          out.help = document.querySelector('#bw-iss-h').nextElementSibling.innerText;
          out.name = row().querySelector('.bw-issname').innerText.trim(); out.href = row().querySelector('.bw-issname').getAttribute('href');
          out.chip = row().querySelector('[data-isstance]').innerText.trim();
          out.label = row().querySelector('[data-isstance]').getAttribute('aria-label');
          out.x = row().querySelector('[data-issoff]').getAttribute('aria-label');
          const top = sel => Math.round(row().querySelector(sel).getBoundingClientRect().top);
          out.xWithName = Math.abs(top('.bw-issname') - top('[data-issoff]')) < 30; out.stacked = top('[data-isstance]') > top('.bw-issname') + 20;
          out.icon = row().querySelector('[data-isstance] svg')?.getAttribute('class') || '';
          const btn = row().querySelector('[data-isstance]'); btn.focus(); btn.click(); await w(500);
          out.sheetHelp = document.querySelector('.sv-sh-help')?.innerText || '';
          document.querySelector('[data-pv="support"]').click(); await w(700);
          out.after = row().querySelector('[data-isstance]').innerText.trim();
          out.focus = document.activeElement?.dataset?.isstance === btn.dataset.isstance;
          out.change = document.querySelector('[data-ispick]').innerText.trim();
          return out; })()""")
        ok(res['name'] == 'Higher liquor taxes' and res['href'] == '#/issue/' + LIQ['id'], f'{tag}: the bill page lists its issue by name, linked to the issue ({res["name"]})')
        ok(res['chip'] == 'Oppose' and 'stance on Higher liquor taxes' in res['label'], f'{tag}: each issue carries its stance chip, named for the issue ({res["chip"]}; {res["label"]!r})')
        ok('stance on the issue as a whole' in res['help'], f'{tag}: the section says the chip is the issue\'s stance, not the bill\'s position ({res["help"][-60:]!r})')
        ok(res['x'] == 'Take it off Higher liquor taxes' and res['xWithName'], f'{tag}: × takes it off, beside the issue name')
        ok(res['stacked'] == (W < 900), f'{tag}: the stance goes under the name below 900px, and shares its line from 900 ({res["stacked"]})')
        ok('thumbs' not in res['icon'], f'{tag}: the issue stance never uses the thumbs a bill position uses ({res["icon"][:40]!r})')
        ok('not only HB 1991' in res['sheetHelp'] or 'not only HB1991' in res['sheetHelp'], f'{tag}: from a bill page the sheet says it is the whole issue, not this bill ({res["sheetHelp"][:90]!r})')
        ok(res['after'] == 'Support' and res['focus'], f'{tag}: the stance changes from the bill page, focus kept ({res["after"]})')
        ok(res['change'] == 'Change issues', f'{tag}: the button that opens every issue says what it does ({res["change"]})')
        layout(p, tag, 'bill_public')
        # ---- a new issue starts with no stance chosen (B-12: never pre-select a stance) ----
        res = p.evaluate(W8 + """(async () => {
          document.querySelector('[data-ispick]').click(); await w(500);
          document.querySelector('[data-isnew]').click(); await w(900);
          return [...document.querySelectorAll('input[name="is-stance"]')].map(x => x.value + ':' + x.checked); })()""")
        ok(res == ['support:false', 'oppose:false', 'mixed:false'], f'{tag}: a new issue starts with no stance chosen ({res})')
        ok(not sup, f'{tag}: no supabase.co requests in the sandbox ({len(sup)})')
        c.close()
    # ---- the public page follows the stance ----
    c = b.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
    p = c.new_page(); p.on('pageerror', lambda e: errors.append(f'public: {e}'))
    p.goto(PUB + '#/issue/' + LIQ['slug']); p.wait_for_timeout(3500)
    res = p.evaluate(W8 + """(async () => {
      const m = await import('/pub/core.js'), out = {};
      out.start = document.querySelector('.fd-ihead .chips')?.innerText.trim();
      const bills = [{ hiphi_position: 'strongly_support' }, { hiphi_position: 'strongly_oppose' }];
      out.calc = [m.issuePos(bills), m.issuePos(bills, { stance: 'support' }), m.issuePos(bills, { stance: 'oppose' }), m.issuePos(bills, { stance: 'mixed' }),
        m.issuePos([{ hiphi_position: 'neutral' }], { stance: 'oppose' }), m.issuePos([{ hiphi_position: 'neutral' }], {})];
      m.S.issues.find(x => x.slug === '""" + LIQ['slug'] + """').stance = 'mixed';
      location.hash = '#/find'; await w(300); location.hash = '#/issue/""" + LIQ['slug'] + """'; await w(700);
      out.mixed = document.querySelector('.fd-ihead .chips')?.innerText.trim();
      return out; })()""")
    ok(res['start'] == 'HIPHI strongly supports', f'public: Support, with a strongly supported bill, still reads "strongly supports" ({res["start"]!r})')
    ok(res['calc'] == ['strongly_support', 'strongly_support', 'strongly_oppose', 'mixed', 'oppose', 'neutral'], f'public: the stance decides the side, the bills how strongly; unset works it out as before ({res["calc"]})')
    ok(res['mixed'] == 'HIPHI’s side depends on the bill', f'public: Mixed says so in words ({res["mixed"]!r})')
    p.screenshot(path=f'{OUT}/public_mixed.png')
    c.close()
    b.close()
print('\n'.join(fails)); print(f'{len(fails)} failed, {len(results)} passed'); print('errors:', errors[:12])
sys.exit(1 if fails or errors else 0)
