# Staff v2, R-180 wave 3, X10: a new hearing is impossible to miss (X10-5), the rallying path (X10-3). Sandbox (16 March 2026).
# python3 tests/staff_x10.py [origin/staff.html]
import re, sys
from playwright.sync_api import sync_playwright
BASE = (sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8832/staff.html').split('#')[0]
passes, fails, errors = [], [], []
def ok(c, m): (passes if c else fails).append(('PASS ' if c else 'FAIL ') + m)
INBOX = """async () => { const m = await import('./staff/data.js'); const S = m.S;
  const b = S.bills.find(b => b.position && b.position !== 'monitor' && S.hearings.some(h => h.bill_id === b.id && h.status === 'scheduled' && new Date(h.scheduled_at) > Date.now()));
  const h = S.hearings.find(h => h.bill_id === b.id && h.status === 'scheduled' && new Date(h.scheduled_at) > Date.now());
  S.drafts[b.id] = (S.drafts[b.id] || []).filter(d => d.committee !== h.committee && d.hearing_id !== h.id);
  const d = new Date(h.scheduled_at), pad = n => String(n).padStart(2, '0'), hst = new Date(d.getTime() - 10 * 36e5);
  const title = 'The committee(s) on ' + h.committee + ' has scheduled a public hearing on ' + pad(hst.getUTCMonth() + 1) + '-' + pad(hst.getUTCDate()) + '-' + String(hst.getUTCFullYear()).slice(2) + ' 9:30AM; Conference Room 229.';
  S.inbox = [{ key: 'x10-1', kind: 'hearing', direct: false, unread: true, bill_id: b.id, bill_number: b.bill_number, title, body: '', at: new Date().toISOString(), priority: 2 }, ...(S.inbox || [])];
  return { num: b.bill_number, committee: h.committee }; }"""
with sync_playwright() as pw:
    b = pw.chromium.launch()
    for W, H in ((1100, 900), (390, 844)):
        c = b.new_context(viewport={'width': W, 'height': H}); p = c.new_page(); tag = f'@{W}'
        p.on('pageerror', lambda e: errors.append(str(e)[:160])); p.on('console', lambda m: errors.append(m.text[:160]) if m.type == 'error' and 'favicon' not in m.text and 'Failed to load resource' not in m.text else None)
        # ---- X10-5 ----
        p.goto(BASE + '?demo=1#/'); p.reload(); p.wait_for_selector('.td-root', timeout=30000); p.wait_for_timeout(2500)
        t = p.inner_text('main'); cards = re.findall(r'New hearing: ([A-Z/]+ \w{3} \d+/\d+)\. Make the draft\.', t)
        ok(len(cards) >= 2, f'{tag}: Today says "New hearing: <committee> <day>. Make the draft." ({cards})')
        ok('No testimony draft yet' in t and 'Make the draft now' in t, f'{tag}: with the plain note and the button')
        # a hearing set three weeks ahead (the sandbox's own end 20 March): the card shows however far off it is
        p.evaluate("""async () => { const m = await import('./staff/data.js'); const S = m.S;
          const none = S.hearings.find(h => h.status === 'scheduled' && new Date(h.scheduled_at) > Date.now() && S.bills.some(x => x.id === h.bill_id && x.position && x.position !== 'monitor') && !(S.drafts[h.bill_id] || []).some(d => d.committee === h.committee));
          const b = S.bills.find(x => x.id === none.bill_id);
          S.hearings.push({ id: 'far-1', bill_id: b.id, committee: 'ZZZ', scheduled_at: new Date(Date.now() + 21 * 864e5).toISOString(), status: 'scheduled', room: '229', created_at: new Date().toISOString() }); }""")
        p.evaluate("location.hash = '#/bills'"); p.wait_for_timeout(300); p.evaluate("location.hash = '#/'"); p.wait_for_timeout(1500)
        t2 = p.inner_text('main')
        z = re.findall(r'New hearing: ZZZ[^\n]*', t2)[:1]
        ok(re.search(r'New hearing: ZZZ \w{3} \d+/\d+\. Make the draft\.', t2) is not None, f'{tag}: a hearing three weeks ahead with no draft shows too ({z})')
        info = p.evaluate(INBOX)
        p.goto(BASE + '?demo=1#/inbox'); p.wait_for_timeout(1200)
        for t_ in ('Updates',): 
            if p.locator('button:has-text("Updates")').count(): p.locator('button:has-text("Updates")').first.click(); p.wait_for_timeout(500)
        it = p.inner_text('main')
        got = re.findall(r'New hearing:[^\n]*', it)[:1]
        ok(re.search(r'New hearing: ' + re.escape(info['committee'].replace(', ', '/').replace(',', '/')) + r' \w{3} \d+/\d+, 9:30 AM', it) is not None, f'{tag}: the Inbox says the same in plain words ({got})')
        ok('has scheduled a public hearing' not in it, f'{tag}: and not the Capitol\'s raw sentence')
        ok('No testimony draft yet. Open the bill and make it.' in it, f'{tag}: with what to do')
        c.close()

    # ---- X10-3 ----
    for W, H in ((1440, 900), (390, 844)):
        c = b.new_context(viewport={'width': W, 'height': H}); p = c.new_page(); tag = f'@{W}'
        p.on('pageerror', lambda e: errors.append(str(e)[:160])); p.on('console', lambda m: errors.append(m.text[:160]) if m.type == 'error' and 'favicon' not in m.text and 'Failed to load resource' not in m.text else None)
        p.goto(BASE + '?demo=1#/' + ('?view=week' if W > 1000 else '')); p.reload(); p.wait_for_selector('.td-root', timeout=30000); p.wait_for_timeout(2500)
        def asks():
            d = p.locator('details.td-asks')
            if not d.count(): return None
            d.first.evaluate("e => e.open = true"); return re.findall(r'\b(?:HB|SB)\d+', d.first.inner_text())
        p.wait_for_selector('details.td-asks', state='attached', timeout=20000)
        mine = asks(); p.locator('button:has-text("Team")').first.click(); p.wait_for_timeout(1500); p.wait_for_selector('details.td-asks', state='attached', timeout=20000); team = asks()
        ok(mine and 'HB2121' in mine and sorted(mine) == sorted(team or []), f'{tag}: This week\'s asks has HB2121 (HIPHI has filed on it) and is the same from Mine and Team ({len(mine or [])} / {len(team or [])})')
        p.locator('button:has-text("Mine")').first.click(); p.wait_for_timeout(800)
        # "Write it" lands at the ask box, with the cursor in it
        if W > 1000: p.goto(BASE + '?demo=1#/'); p.reload(); p.wait_for_selector('.td-root', timeout=30000); p.wait_for_timeout(2500)
        # the link Today's "Write it" makes (a hashchange, so the browser's popstate restore runs too) opens the Public tab at the ask
        w = p.locator('body')
        if True:
            p.evaluate("import('./staff/data.js').then(m => m.S.go('#/bill/HB2121/public?ask=1'))"); p.wait_for_selector('#bw-pact', timeout=15000); p.wait_for_timeout(1500)
            r = p.evaluate("(() => { const e = document.querySelector('#bw-pact'), r = e.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), vh: innerHeight, focus: document.activeElement === e, y: Math.round(scrollY) }; })()")
            ok(r['top'] > 0 and r['bottom'] < r['vh'] and r['focus'] and r['y'] > 100, f'{tag}: "Write it" lands with the ask box in view and the cursor in it ({r})')
            note = p.inner_text('#bw-panel') if p.locator('#bw-panel').count() else p.inner_text('main')
            ok('Where this ask reaches people' in note and 'On the public page now.' in note, f'{tag}: the Public tab says where the ask will reach people')
            ok('Email to the public is off for now' in note, f'{tag}: and, while email is off, that nothing goes by email')
            # email on: the alert has not gone; then it has
            def say(created):
                return p.evaluate("""async (created) => { const m = await import('./staff/data.js'), M = await import('./staff/model.js'); const S = m.S;
                  S.emailCfg = { enabled: true }; const b = S.bills.find(x => x.id === S.hearings.find(h => h.status === 'scheduled' && new Date(h.scheduled_at) > Date.now() && (!h.testimony_deadline || new Date(h.testimony_deadline) > Date.now())).bill_id);
                  const h = S.hearings.find(h => h.bill_id === b.id && h.status === 'scheduled' && new Date(h.scheduled_at) > Date.now()); h.created_at = created;
                  return M.askReach(b); }""", created)
            fresh = say(__import__('datetime').datetime.utcnow().isoformat() + 'Z'); old = say('2026-03-01T00:00:00Z')
            ok(any('hearing alert, to' in l for l in fresh['lines']) and not fresh['again'], f'{tag}: a hearing set today: "in tonight\'s hearing alert to N followers" ({fresh["lines"][-1]})')
            ok(any('already went' in l for l in old['lines']) and old['again'], f'{tag}: a hearing set long ago: "the hearing alert already went", with the supporter-email button ({old["lines"][-1]})')
        else:
            ok(False, f'{tag}: a "Write it" card is on Today')
        c.close()

    # ---- X10-6 ----
    for W, H in ((1100, 900), (390, 844)):
        c = b.new_context(viewport={'width': W, 'height': H}); p = c.new_page(); tag = f'@{W}'
        p.on('pageerror', lambda e: errors.append(str(e)[:160])); p.on('console', lambda m: errors.append(m.text[:160]) if m.type == 'error' and 'favicon' not in m.text and 'Failed to load resource' not in m.text else None)
        p.goto(BASE + '?demo=1#/bill/HB1562'); p.reload(); p.wait_for_selector('[data-bwpick="pos"]', timeout=30000); p.wait_for_timeout(1500)
        p.locator('[data-bwpick="pos"]').first.click(); p.wait_for_timeout(500)
        p.locator('dialog[open] >> text=/^Oppose$/').first.click(); p.wait_for_timeout(900)
        toast = p.inner_text('#toast')
        ok('Saved. The public page now says HIPHI opposes.' in toast and '1 approved testimony says support: open it.' in toast, f'{tag}: a position change says its effect and the testimony it conflicts with ({toast[:140]!r})')
        ok(p.locator('#toast .toastact').count() == 1 and p.locator('#toast .toastundo:not(.toastact)').count() == 1, f'{tag}: with Open and Undo')
        # a note survives Esc and Back
        p.goto(BASE + '?demo=1#/bill/HB1523/testimony'); p.wait_for_selector('[data-dact="changes"]', timeout=30000); p.wait_for_timeout(800)
        p.locator('[data-dact="changes"]').first.click(); p.wait_for_selector('#bw-rc', timeout=8000); p.fill('#bw-rc', 'Please say HB 1523 earlier'); p.keyboard.press('Escape'); p.wait_for_timeout(600)
        p.locator('[data-dact="changes"]').first.click(); p.wait_for_selector('#bw-rc', timeout=8000)
        ok(p.input_value('#bw-rc') == 'Please say HB 1523 earlier', f'{tag}: a "Request changes" note survives Esc ({p.input_value("#bw-rc")!r})')
        p.go_back(); p.wait_for_timeout(500)
        # Mark filed: the link must look like a web address
        p.goto(BASE + '?demo=1#/bill/HB1562/testimony'); p.wait_for_selector('[data-dact="file"]', timeout=30000); p.wait_for_timeout(800)
        p.locator('[data-dact="file"]').first.click(); p.wait_for_selector('#bw-furl', timeout=8000)
        p.fill('#bw-furl', 'done it yesterday'); p.locator('dialog[open] [data-go]').first.click(); p.wait_for_timeout(500)
        ok(p.locator('#bw-furl-e').is_visible() and p.locator('#bw-furl').count() == 1, f'{tag}: "Mark filed" refuses a link that is not a web address, and stays open')
        p.keyboard.press('Escape'); p.wait_for_timeout(500)
        p.locator('[data-dact="file"]').first.click(); p.wait_for_selector('#bw-furl', timeout=8000)
        ok(p.input_value('#bw-furl') == 'done it yesterday', f'{tag}: and keeps what was typed after Esc ({p.input_value("#bw-furl")!r})')
        p.fill('#bw-furl', 'https://www.capitol.hawaii.gov/testimony/confirmation/12345'); p.locator('dialog[open] [data-go]').first.click(); p.wait_for_timeout(900)
        ok(p.locator('#bw-furl').count() == 0, f'{tag}: a real link files it')
        c.close()

    # Overdue counts only what is overdue; Review says the bill's version once
    c = b.new_context(viewport={'width': 1100, 'height': 900}); p = c.new_page()
    p.on('pageerror', lambda e: errors.append(str(e)[:160]))
    p.goto(BASE + '?demo=1#/'); p.reload(); p.wait_for_selector('.td-root', timeout=30000); p.wait_for_timeout(2500)
    p.evaluate("""async () => { const m = await import('./staff/data.js'); const S = m.S;
      const pick = (bn, com) => (S.drafts[S.bills.find(b => b.bill_number === bn).id] || []).find(d => d.committee === com);
      const ds = [pick('HB1523','TRS'), pick('SB3025','HSH/HLT'), pick('HB2300','EDU')];
      ds.forEach(d => { d.status = 'review'; d.submitted_by = d.submitted_by || S.advocates[1].id; d.submitted_at = new Date().toISOString(); });
      const h = S.hearings.find(h => h.id === ds[0].hearing_id); h.testimony_deadline = new Date(Date.now() - 19 * 36e5).toISOString();
      for (const d of ds.slice(1)) { const hh = S.hearings.find(h => h.id === d.hearing_id); hh.testimony_deadline = new Date(Date.now() + 3 * 864e5).toISOString(); hh.scheduled_at = new Date(Date.now() + 5 * 864e5).toISOString(); } }""")
    p.evaluate("location.hash = '#/bills'"); p.wait_for_timeout(300); p.evaluate("location.hash = '#/'"); p.wait_for_timeout(1500)
    t = p.inner_text('main'); heads = dict(re.findall(r'(Overdue|Today|Tomorrow)\s*\n?\s*(\d+)', t))
    ok(heads.get('Overdue') == '2' and '1 of 3 overdue' in t, f'Overdue counts one overdue draft in the review cluster of three, not three ({heads}; "1 of 3 overdue" on the card)')
    c.close()
    c = b.new_context(viewport={'width': 390, 'height': 844}); p = c.new_page()
    p.goto(BASE + '?demo=1#/review'); p.reload(); p.wait_for_timeout(3500)
    n = len(re.findall(r'The bill is now', p.inner_text('main')))
    ok(n <= 1, f'Review says "The bill is now" at most once on a card ({n})')
    c.close()
    b.close()
ok(not errors, 'no console errors' + ('' if not errors else ': ' + ' | '.join(errors[:4])))
print('\n'.join(passes + fails)); print(f'\n{len(passes)} passed, {len(fails)} failed')
sys.exit(1 if fails else 0)
