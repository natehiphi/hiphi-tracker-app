# R-072: what the public bill page says for the stages the backend's audit added or corrected. Sandbox, phone and desktop.
# Real sandbox bills are put at each state in the page's memory only (nothing is saved), as tests/bill_stages.py does.
#   first_floor / second_floor  through committee, waiting for the floor vote (not "Stopped", not "waiting for a hearing")
#   ballot                      a constitutional amendment the Legislature passed: the voters decide, no Governor ask
#   an adopted resolution       "Adopted", never "Became law", and a short path with no Governor
#   "deferred ... until"        a decision moved to a date is not "Stopped"; a deferral with no date is "Put on hold"
#   stopped at the floor vote   says its committees passed it, and the step bar stops at the vote
#   the Senate's Triple filing  12 Feb for a Senate bill, 11 Feb for a House bill
import sys
from playwright.sync_api import sync_playwright
# The bill page tour (pub/tour.js) shows on the first bill page a fresh browser opens; tests/bill_tour.py covers it.
TOUR_SEEN = "try{localStorage.setItem('hiphi_tour_bill','1');localStorage.setItem('hiphi_tour_bill_demo','1')}catch(e){}"
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832/track.html?demo=1&seed=1'
ok = fail = 0
def check(c, m):
    global ok, fail
    print('PASS' if c else 'FAIL', m); ok += bool(c); fail += (not c)
SET = """async ({ pick, patch }) => {
  const c = await import('./pub/core.js');
  window.__used ??= new Set();
  const want = new RegExp(pick);
  const b = c.D.bills.find(x => want.test(x.bill_number) && !window.__used.has(x.id) && (x.referrals || []).length >= 2
    && !c.D.hearings.some(h => h.bill_id === x.id && new Date(h.scheduled_at) > new Date('2026-03-01')));
  window.__used.add(b.id);
  Object.assign(b, patch);
  const inS = (c.S.bills || []).find(x => x.id === b.id); if (inS) Object.assign(inS, patch);
  for (const k of Object.keys(c.S.extra || {})) if (c.S.extra[k].id === b.id) Object.assign(c.S.extra[k], patch);
  return b.bill_number; }"""
def show(pg, pick, patch):
    num = pg.evaluate(SET, {'pick': pick, 'patch': patch})
    pg.evaluate("location.hash = '#/find'"); pg.wait_for_timeout(300)
    pg.evaluate(f"location.hash = '#/bill/{num}'"); pg.wait_for_timeout(1800)
    return num, pg.inner_text('main')
def status(pg, num, patch):
    return pg.evaluate("""async ({ num, patch }) => { const c = await import('./pub/core.js'); const b = { ...c.D.bills.find(x => x.bill_number === num), ...patch };
      const p = c.plainStatus(b), st = c.stopOf(b); return { text: p.text, short: p.short, dl: st.deadline && st.deadline.date, key: st.deadlineKey }; }""", {'num': num, 'patch': patch})
with sync_playwright() as p:
    br = p.chromium.launch()
    for w, h, mob in [(390, 844, True), (1280, 800, False)]:
        ctx = br.new_context(viewport={'width': w, 'height': h}, is_mobile=mob, has_touch=mob); ctx.add_init_script(TOUR_SEEN); pg = ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.goto(BASE + '#/'); pg.reload(); pg.wait_for_timeout(3000)
        # waiting for the floor vote, in each chamber
        num, t = show(pg, '^HB', {'stage': 'first_floor', 'last_action': 'Reported from FIN, recommending passage on Third Reading.', 'died_at_stage': None, 'died_deadline': None})
        check('Next is a vote of the full House' in t and 'Stopped' not in t, f'{w} {num} first_floor: "Next is a vote of the full House", not stopped')
        num, t = show(pg, '^SB', {'stage': 'second_floor', 'last_action': 'Reported from FIN, recommending passage on Third Reading.', 'died_at_stage': None, 'died_deadline': None})
        cap = pg.evaluate("document.querySelector('.bl-nowlbl')?.textContent || ''")
        check('Next is a vote of the full House' in t and cap == 'Now: Waiting for the House vote', f'{w} {num} second_floor: waiting for the House vote ("{cap}")')
        # a constitutional amendment for the ballot
        num, t = show(pg, '^HB', {'stage': 'ballot', 'last_action': 'Enrolled to Governor.', 'died_at_stage': None, 'died_deadline': None})
        check('The voters decide' in t and 'Goes to the voters' in t, f'{w} {num} ballot: the voters decide in November')
        check('Ask the Governor' not in t and 'on the Governor' not in t.lower(), f'{w} {num} ballot: no Governor ask, not "on the Governor\'s desk"')
        check('The voters' in t and 'Constitution' in t, f'{w} {num} ballot: the step bar ends with The voters and Constitution')
        # an adopted resolution: pretend a bill is a House resolution
        num, t = show(pg, '^HB', {'stage': 'enacted', 'died_at_stage': None, 'died_deadline': None})
        st = status(pg, num, {'bill_number': 'HR33', 'stage': 'enacted'})
        check(st['short'] == 'Adopted' and st['text'] == 'Adopted.', f'{w} HR33 enacted: "Adopted", not "Became law" ({st})')
        st = status(pg, num, {'bill_number': 'HCR121', 'stage': 'dead', 'died_at_stage': 'second_decking', 'died_deadline': 'Sine die 5/8/26'})
        check(st['short'] == 'Not adopted this session' and 'not adopted' in st['text'], f'{w} HCR121 not adopted: says so ({st})')
        # a deferral to a date is not stopped; one with no date is
        num, t = show(pg, '^SB', {'stage': 'first_lateral', 'last_action': 'The committee(s) on WAM deferred the measure until 04-08-26 10:00AM; Conference Room 211 & Videoconference.', 'died_at_stage': None, 'died_deadline': None})
        check('Stopped this session' not in t and 'Put on hold' not in t, f'{w} {num} "deferred the measure until": not stopped')
        st = status(pg, num, {'last_action': 'The committee on HHS deferred the measure.'})
        check(st['short'] == 'Stopped this session' and 'Put on hold' in st['text'], f'{w} "deferred the measure." with no date: put on hold ({st["short"]})')
        # stopped at the floor vote
        num, t = show(pg, '^HB', {'stage': 'dead', 'died_at_stage': 'first_floor', 'died_deadline': 'Crossover 3/12/26', 'last_action': 'Reported from FIN, recommending passage on Third Reading.'})
        check('got through its House committees' in t and 'did not vote on it' in t, f'{w} {num} stopped at first_floor: its committees passed it, no floor vote')
        cap = pg.evaluate("document.querySelector('.bl-nowlbl')?.textContent || ''")
        check(cap == 'Stopped before the House vote', f'{w} {num} stopped at first_floor: the step bar stops at the House vote ("{cap}")')
        # the Senate's own Triple filing date
        s = status(pg, num, {'bill_number': 'SB9999', 'chamber': 'S', 'stage': 'first_triple', 'referrals': ['HHS', 'CPN', 'WAM'], 'origin_stops': 3, 'last_action': 'Referred to HHS, CPN, WAM.', 'died_at_stage': None, 'died_deadline': None})
        hs = status(pg, num, {'bill_number': 'HB9999', 'chamber': 'H', 'stage': 'first_triple', 'referrals': ['HLT', 'CPC', 'FIN'], 'origin_stops': 3, 'last_action': 'Referred to HLT, CPC, FIN, referral sheet 1', 'died_at_stage': None, 'died_deadline': None})
        check(s['dl'] == '2026-02-12' and hs['dl'] == '2026-02-11', f'{w}: Triple filing is 2/12 for a Senate bill ({s["dl"]}), 2/11 for a House bill ({hs["dl"]})')
        check(not errs, f'{w}: no page errors {errs[:2]}')
        ctx.close()
    br.close()
print(f'\n{ok} passed, {fail} failed')
sys.exit(1 if fail else 0)
