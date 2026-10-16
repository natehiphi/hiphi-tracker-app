# R-212 #11: when HIPHI strongly supports (or opposes) a bill, the stand screen says the letter will say "strongly", and
# "Just “I support it”, not strongly" keeps "strongly" out of the letter. A bill HIPHI only supports shows neither.
#   python3 tests/strong_words.py [base]     base defaults to http://localhost:8832/track.html?demo=1
import sys
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832/track.html?demo=1'
res = []
def ok(c, m): res.append(bool(c)); print('PASS' if c else 'FAIL', m)
SKIP = "() => { try { for (const s of ['', '_demo']) { localStorage.setItem('hiphi_wiz' + s, JSON.stringify({ done: true, step: 99 })); localStorage.setItem('hiphi_tour_bill' + s, '{\"how\":\"test\"}'); localStorage.setItem('hiphi_tour_home' + s, '{\"how\":\"test\"}'); } } catch {} }"
# A bill with a hearing ahead, by HIPHI's position.
FIND = """async (pos) => { const c = await import('./pub/core.js');
  for (const b of c.D.bills.filter(x => x.hiphi_position === pos)) {
    const h = c.D.hearings.filter(x => x.bill_id === b.id && new Date(x.scheduled_at) > Date.now()).sort((a, z) => a.scheduled_at.localeCompare(z.scheduled_at))[0];
    if (h) return { b: b.id, h: h.id, n: b.bill_number }; }
  return null; }"""
LOAD = lambda pg: (pg.goto(BASE + '#/'), pg.reload(), pg.wait_for_function("() => !!document.querySelector('main') && !document.querySelector('.skelpage')", timeout=60000))
OPEN = """async ([t, mode]) => { const c = await import('./pub/core.js'); c.S.helper = null; c.S.stances = {};
  try { const k = Object.keys(localStorage).find(k => /hiphi_me/.test(k)); if (k) { const m = JSON.parse(localStorage.getItem(k) || '{}'); delete m.mail; delete m.drafts; localStorage.setItem(k, JSON.stringify(m)); } } catch {}
  if (mode === 'testimony') c.app.openHelper(t.b, t.h); else c.app.openMail({ mode: 'email', hearing: t.h, bill: t.b }); }"""
# The letter as it would be written now, from the helper's own answers (the screens after this one only add to it).
MILD = "async () => (await import('./pub/core.js')).S.helper.mild"
LETTER = """async () => { const x = (await import('./pub/core.js')).S.helper; return x.letter || ''; }"""
choice = lambda pg, v: pg.locator(f'#hp-dlg .hp-choice[data-v="{v}"]')
plain = lambda pg: pg.locator('#hp-dlg .hp-plain')

def walk_to_letter(pg):
    # Next until the letter is written (the box or the letter screen); at most ten steps.
    for _ in range(10):
        txt = pg.evaluate(LETTER)
        if txt: return txt
        n = pg.locator('#hp-dlg .hp-foot [data-hp="next"]')
        if not n.count() or not n.first.is_enabled(): break
        n.first.click(); pg.wait_for_timeout(500)
    return pg.evaluate(LETTER)

with sync_playwright() as p:
    br = p.chromium.launch()
    for w, h, tag in ((390, 844, 'phone'), (1280, 900, 'laptop')):
        ctx = br.new_context(viewport={'width': w, 'height': h}, is_mobile=w < 600); ctx.add_init_script(f"({SKIP})()")
        pg = ctx.new_page(); errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(BASE + '#/'); pg.wait_for_function("() => !!document.querySelector('main') && !document.querySelector('.skelpage')", timeout=60000)
        t = pg.evaluate(FIND, 'strongly_support')
        ok(t, f'{tag}: the practice copy has a bill HIPHI strongly supports with a hearing ahead')
        if not t: continue
        for mode in ('testimony', 'email'):
            k = f'{tag} {mode} {t["n"]}:'
            LOAD(pg); pg.evaluate(OPEN, [t, mode]); pg.wait_for_selector('#hp-dlg #hp-sh', timeout=15000); pg.wait_for_timeout(500)
            word = 'email' if mode == 'email' else 'testimony'
            ok(f'Your {word} will say you strongly support it, as HIPHI does' in choice(pg, 'support').inner_text(), f'{k} "I support it" says the {word} will say "strongly", before any letter')
            ok(plain(pg).count() == 1 and 'not strongly' in plain(pg).inner_text(), f'{k} one plain answer, right under it')
            box = plain(pg).bounding_box()
            ok(box and box['height'] >= 44, f'{k} the plain answer is a 44px target ({box and round(box["height"])})')
            plain(pg).click(); pg.wait_for_timeout(500)
            ok(pg.evaluate(MILD) is True, f'{k} the plain answer is kept (mild) and moves on')
            L = walk_to_letter(pg)
            ok(L and 'strong' not in L.lower() and 'support' in L.lower(), f'{k} the letter says "support" without "strongly" ({L[:120]!r})')
            # Back to the stand screen and the strong answer: "strongly" is back.
            LOAD(pg); pg.evaluate(OPEN, [t, mode]); pg.wait_for_selector('#hp-dlg #hp-sh', timeout=15000); pg.wait_for_timeout(500)
            choice(pg, 'support').click(); pg.wait_for_timeout(500)
            ok(pg.evaluate(MILD) is False, f'{k} "I support it" is not mild')
            L = walk_to_letter(pg)
            ok(L and 'strong' in L.lower(), f'{k} that letter says "strongly", as the choice said ({L[:120]!r})')
        t2 = pg.evaluate(FIND, 'support')
        if t2:
            LOAD(pg); pg.evaluate(OPEN, [t2, 'testimony']); pg.wait_for_selector('#hp-dlg #hp-sh', timeout=15000); pg.wait_for_timeout(500)
            ok(plain(pg).count() == 0 and 'strongly' not in choice(pg, 'support').inner_text(), f'{tag} {t2["n"]} (HIPHI supports): no "strongly" note, no plain answer')
        ok(not errs, f'{tag}: no page errors {errs[:2]}')
        ctx.close()
    br.close()
print(f'\n{sum(res)}/{len(res)} passed'); sys.exit(0 if all(res) else 1)
