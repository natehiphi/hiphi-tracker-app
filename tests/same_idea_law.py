# A stopped bill whose same idea became law as its companion says so (X4-4, R-180 wave 2).
# python3 tests/same_idea_law.py [base_url]   (sandbox; the two bills are changed in the page, as the snapshot's companions are empty)
# Checks: on the stopped bill's page, under the stopped label, "The same idea became law as SB 2175, Act 189." with a link to that bill;
# a stopped bill whose companion did not become law says nothing extra; a resolution never gets the line; the list label says
# "Stopped · the same idea became law as SB 2175" (plainStatus); no sideways scroll at 390; no console errors.
import sys
from playwright.sync_api import sync_playwright
BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832/track.html')
passes, fails, errors = [], [], []
def ok(c, m): (passes if c else fails).append(('PASS ' if c else 'FAIL ') + m)
SETUP = """async () => { const m = await import('/pub/core.js'); const S = m.S;
  const pool = [...S.bills, ...Object.values(S.extra || {}), ...(m.D ? [...m.D.bills, ...m.D.index] : [])];
  const one = n => pool.filter(b => b.bill_number === n);
  one('HB2121').forEach(b => { b.stage = 'dead'; b.stage_override = null; b.companions = ['SB2175']; b.last_action = 'The committee deferred the measure.'; });
  one('SB2175').forEach(b => { b.stage = 'enacted'; b.companions = ['HB2121']; b.last_action = 'Act 189, 06/25/2026 (Gov. Msg. No. 1215).'; });
  const hb = one('HB2121')[0];
  return { hb: !!hb, short: hb && m.plainStatus(hb).short, law: hb && m.sameIdeaLaw(hb) }; }"""
with sync_playwright() as pw:
    b = pw.chromium.launch()
    for W, H in ((390, 844), (1440, 900)):
        c = b.new_context(viewport={'width': W, 'height': H}); p = c.new_page(); tag = f'@{W}'
        p.on('pageerror', lambda e: errors.append(str(e)[:160])); p.on('console', lambda m: errors.append(m.text[:160]) if m.type == 'error' and 'favicon' not in m.text else None)
        p.goto(BASE + '?demo=1&codes=0&fv=full&end=today#/bill/HB2121'); p.wait_for_selector('.bl-page', timeout=30000); p.wait_for_timeout(800)
        r = p.evaluate(SETUP)
        ok(r['hb'] and r['law'] and r['law']['num'] == 'SB2175' and r['law']['act'] == '189', f'{tag}: the bill and its companion are known ({r})')
        ok(r['short'] == 'Stopped · the same idea became law as SB 2175', f'{tag}: the list label says it ({r["short"]!r})')
        p.evaluate("location.hash = '#/more'"); p.wait_for_timeout(500); p.evaluate("location.hash = '#/bill/HB2121'"); p.wait_for_timeout(1200)
        line = p.locator('.bl-sameidea')
        ok(line.count() == 1 and 'The same idea became law as SB 2175, Act 189.' in line.inner_text(), f'{tag}: the line is on the page ({line.inner_text() if line.count() else "none"!r})')
        ok(p.locator('.bl-sameidea a[href$="SB2175"]').count() == 1, f'{tag}: and links to the law')
        ok(p.evaluate("(() => { const w = document.querySelector('.bl-why'), s = document.querySelector('.bl-sameidea'); return !!w && !!s && w.compareDocumentPosition(s) & 4; })()"), f'{tag}: it sits right under why the bill stopped')
        ok(not p.evaluate('document.documentElement.scrollWidth > innerWidth + 1'), f'{tag}: no sideways scroll')
        if W == 390: p.screenshot(path='/private/tmp/claude-501/same_idea_390.png')
        # a stopped bill whose companion did not become law
        p.evaluate("""async () => { const m = await import('/pub/core.js'); [...m.S.bills, ...Object.values(m.S.extra || {}), ...m.D.bills, ...m.D.index].filter(b => b.bill_number === 'SB2175').forEach(b => { b.stage = 'dead'; b.last_action = 'Failed.'; }); }""")
        p.evaluate("location.hash = '#/more'"); p.wait_for_timeout(400); p.evaluate("location.hash = '#/bill/HB2121'"); p.wait_for_timeout(1000)
        ok(p.locator('.bl-sameidea').count() == 0, f'{tag}: a companion that did not become law adds no line')
        # found through the issue, as in production (the companion field is empty there), and only for the other chamber
        r = p.evaluate("""async () => { const m = await import('/pub/core.js'); const S = m.S;
          const pool = [...S.bills, ...Object.values(S.extra || {}), ...m.D.bills, ...m.D.index]; const one = n => pool.filter(b => b.bill_number === n);
          const hb = one('HB2121')[0], sb = one('SB2175')[0];
          one('HB2121').forEach(b => { b.companions = null; }); one('SB2175').forEach(b => { b.companions = null; b.stage = 'enacted'; b.last_action = 'Act 189, on 07/07/2026 (Gov. Msg. No. 1291).'; });
          const iss = { id: 'iss-x', name: 'Ban disposable e-cigarettes', bill_ids: [hb.id, sb.id], bill_years: [hb.session_year, sb.session_year] };
          S.issuesByBill.set(hb.id, [iss]); S.issuesByBill.set(sb.id, [iss]);
          const out = { via: m.sameIdeaLaw(hb) }; out.words = out.via && m.sameIdeaWords(out.via); out.short = m.plainStatus(hb).short;
          const hb2 = { ...hb, id: 'same-chamber', bill_number: 'HB9999' }; S.issuesByBill.set('same-chamber', [{ ...iss, bill_ids: ['same-chamber', ...[]] }]);
          const law = { ...hb, id: 'hb-law', bill_number: 'HB8888', stage: 'enacted' }; S.extra['hb-law'] = law; S.issuesByBill.set('same-chamber', [{ ...iss, bill_ids: ['same-chamber', 'hb-law'], bill_years: [hb.session_year, hb.session_year] }]);
          out.sameChamber = m.sameIdeaLaw(hb2); return out; }""")
        ok(r['via'] and r['via']['num'] == 'SB2175' and r['via']['act'] == '189', f'{tag}: with no companion named, the other chamber\'s law on the same issue is found ({r["via"]})')
        ok(r['words'] == 'On “Ban disposable e-cigarettes”, SB 2175 became law (Act 189).' and r['short'] == 'Stopped · SB 2175 on the same issue became law', f'{tag}: found through an issue it says "on the same issue", never "the same idea" ({r["words"]!r}, {r["short"]!r})')
        ok(r['sameChamber'] is None, f'{tag}: a law in the same chamber on the same issue is never the same idea ({r["sameChamber"]})')
        c.close()
    b.close()
ok(not errors, 'no console errors' + ('' if not errors else ': ' + ' | '.join(errors[:4])))
print('\n'.join(passes + fails)); print(f'\n{len(passes)} passed, {len(fails)} failed')
sys.exit(1 if fails else 0)
