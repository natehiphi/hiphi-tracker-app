# Staff v6: the stage tracker at the top of a bill's page (R-336; Nate picked mockup C, "the named bar", with the flags
# improved). On the practice copy (Mon 16 Mar 2026, HB 1562 in Senate HHS with a hearing at 1:10 PM).
#   1. HB 1562 on a laptop: the stops in order (House committees, House vote, Senate committees, Senate vote, Conference,
#      Governor), done / now / still to come, the House | Senate | Final steps heading; the header's old "where" line gone.
#   2. The flags: only deadlines still ahead and not yet beaten, each a line under the last stop it needs passed ("by 4/10");
#      the next one in bold; the caption's line is the one that names it and says what it asks (the bar names it only when
#      a chair ask's card took the caption's line). Patti (no bills of her own) reads the day without the Capitol's name
#      (C-15).
#   3. The phone: the slim bar, "Step 4 of 8", the next deadline, See every step opening the list; the step card's title
#      still on the first screen; no sideways scroll at 390 and 320.
#   4. A Senate bill starts with the Senate; a bill in conference; a budget bill's own deadlines (replaces).
#   5. A stopped bill (marked where it stopped, no flags, "Stopped at ..."), a law, a veto, the Governor's desk, a resolution
#      (no Conference or Governor, "Adopted"), a stopped bill with no record (no stop marked).
#
#   V4_ROOT=/path/to/worktree python3 tests/staff6_tracker.py     exits 1 when a check fails
import os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import staff6_lib as L

R = L.Results()
def overflow(pg): return pg.page.evaluate('document.documentElement.scrollWidth - innerWidth')
# What the tracker shows: the stops (label, state, title), the group headings, the deadlines under them and the caption lines.
STATE = """() => { const t = document.querySelector('.tk'); if (!t) return null;
  const vis = e => !!e && e.offsetParent !== null && getComputedStyle(e).display !== 'none';
  return {
    stops: [...t.querySelectorAll('.tk-seg')].map(s => [s.querySelector('.tk-l').textContent.trim(), (s.className.match(/is-(\\w+)/) || [])[1], s.title]),
    slim: [...t.querySelectorAll('.tk-slim i')].map(i => (i.className.match(/is-(\\w+)/) || [])[1]),
    groups: [...t.querySelectorAll('.tk-grp')].map(g => g.textContent.trim()),
    // each deadline ahead: the stop it sits under (index and label), its words, and whether it is the next; its name is in the stop's title
    flags: [...t.querySelectorAll('.tk-seg')].map((s, i) => [s, i]).filter(([s]) => s.querySelector('.tk-d')).map(([s, i]) => ({ at: i,
      stop: s.querySelector('.tk-l').textContent.trim(), text: s.querySelector('.tk-d').textContent.trim(), title: s.title.split(' · ').slice(-1)[0],
      next: s.querySelector('.tk-d').classList.contains('is-next'),
      below: s.querySelector('.tk-d').getBoundingClientRect().top >= s.querySelector('.tk-l').getBoundingClientRect().bottom - 1,
      inside: s.querySelector('.tk-d').getBoundingClientRect().left >= s.getBoundingClientRect().left - 1 && s.querySelector('.tk-d').getBoundingClientRect().right <= s.getBoundingClientRect().right + 1 })),
    caption: [...t.querySelectorAll('.tk-cap > p')].filter(vis).map(p => p.innerText.replace(/\\s+/g, ' ').trim()),
    wide: vis(t.querySelector('.tk-wide')), slimShown: vis(t.querySelector('.tk-slim')), more: vis(t.querySelector('[data-tkmore]')),
    oldWhere: !!document.querySelector('.bw-head .bw-where'),
  }; }"""
# Make a variant in the page (a law, a veto, a resolution...): patch a practice bill, or a copy of it under another number.
VARIANT = """async ([num, patch, as]) => { const d = await import('/staff6/data.js');
  let b = d.S.bills.find(x => x.bill_number === num);
  if (as) { b = { ...b, id: 'tk-' + as, bill_number: as }; d.S.bills.push(b); }
  Object.assign(b, patch); location.hash = '#/bill/' + b.bill_number; d.hooks.render(); }"""
def variant(B, w, h, num, patch, as_=None, who='NT'):
  pg = B.page(who, w, h); pg.open('/bill/HB1562'); pg.page.evaluate(VARIANT, [num, patch, as_]); pg.page.wait_for_timeout(400); return pg

with L.browser() as B:
  # ---- 1 and 2. HB 1562 on a laptop ----
  pg = B.page('NT', 1440, 900); pg.open('/bill/HB1562'); s = pg.page.evaluate(STATE)
  labels = [x[0] for x in s['stops']]
  R.check('HB 1562: the stops in order (each vote is "Vote", under its chamber\'s heading)', labels == ['HLT/HSH', 'FIN', 'Vote', 'HHS', 'WAM', 'Vote', 'Conference', 'Governor'], labels)
  R.check('HB 1562: three done, HHS now, four still to come', [x[1] for x in s['stops']] == ['done'] * 3 + ['now'] + ['next'] * 4, [x[1] for x in s['stops']])
  R.check('HB 1562: the committee\'s full name is the segment\'s title', s['stops'][3][2].startswith('Senate Health and Human Services'), s['stops'][3][2])
  R.check('the group headings: House | Senate | Final steps', s['groups'] == ['House', 'Senate', 'Final steps'], s['groups'])
  R.check('the header\'s old "where" line is gone (the caption says it, A-14)', not s['oldWhere'])
  fl = s['flags']
  R.check('flags: only deadlines still ahead (no First lateral, First decking, Crossover)', fl and not any(re.search(r'First|^Crossover', f['title']) for f in fl), [f['title'] for f in fl])
  R.check('flags: four ahead (Second lateral, Second decking, Cross back, Fiscal)', [' '.join(f['title'].split(' ')[:-2]) for f in fl] == ['Second lateral', 'Second decking', 'Cross back', 'Fiscal'], [f['title'] for f in fl])
  R.check('flags: exactly one is next, in bold, its date only (the caption names it)', sum(f['next'] for f in fl) == 1 and fl[0]['next'] and fl[0]['text'] == 'by 3/30', [f['text'] for f in fl])
  R.check('flags: the others say a short date', [f['text'] for f in fl[1:]] == ['by 4/10', 'by 4/16', 'by 5/1'], [f['text'] for f in fl[1:]])
  R.check('flags: each under the stop it gates (lateral HHS, decking WAM, cross back the Senate vote, fiscal Conference)',
          [f['at'] for f in fl] == [3, 4, 5, 6], [(f['at'], f['stop']) for f in fl])
  R.check('flags: each a line under its stop\'s label, inside the stop', all(f['below'] and f['inside'] for f in fl), [(f['stop'], f['below'], f['inside']) for f in fl])
  cap = s['caption']
  R.check('caption: where it is, in words, naming the committee (R-344 D2)', cap[0] == 'Now: in Health and Human Services, Senate committee 1 of 2.', cap)
  R.check('caption: the next deadline and what it asks', any(c == 'Next deadline Second lateral, Mon 3/30: must pass the committee it is in now.' for c in cap), cap)
  R.check('the step card still leads with its title, and the hearing is said once', pg.text().count('today 1:10 PM') == 1, pg.text().count('today 1:10 PM'))
  R.check('no page errors', not pg.errors, pg.errors[:2]); pg.close()
  # Team talk has no step card: the caption names the committee and its hearing.
  pg = B.page('NT', 1440, 900); pg.open('/bill/HB1562/talk'); s = pg.page.evaluate(STATE)
  R.check('Team talk: the tracker is there too, naming the committee and its hearing', s and s['caption'][0] == 'Now: Senate Health and Human Services, hearing today 1:10 PM.', s and s['caption'])
  pg.close()
  # Patti owns no bills and is not an admin: the deadline as its day and what it asks, not the Capitol's name (C-15).
  pg = B.page('PH', 1440, 900); pg.open('/bill/HB1562/talk'); s = pg.page.evaluate(STATE)
  nxt = [c for c in s['caption'] if c.startswith('Next deadline')]
  R.check('Patti: "Next deadline Mon 3/30: must pass ...", no Capitol name', nxt and nxt[0].startswith('Next deadline Mon 3/30: must pass') and 'lateral' not in ' '.join(s['caption']), s['caption'])
  pg.close()

  # ---- 3. the phone ----
  for w, h in [(390, 844), (320, 640)]:
    pg = B.page('NT', w, h); pg.open('/bill/HB1562'); s = pg.page.evaluate(STATE)
    R.check(f'{w}: the slim bar only (no labels), 8 segments, the 4th now', not s['wide'] and s['slimShown'] and s['slim'] == ['done'] * 3 + ['now'] + ['next'] * 4, s['slim'])
    # at 320 the words after the step number give way on Next step (the card names the committee)
    R.check(f'{w}: "Step 4 of 8 · in Senate Health and Human Services" and the next deadline', (s['caption'][0] == 'Step 4 of 8 · in Senate Health and Human Services' if w > 320 else s['caption'][0] == 'Step 4 of 8') and any(c.startswith('Next deadline Second lateral, Mon 3/30') for c in s['caption']), s['caption'])
    top = pg.page.evaluate("document.querySelector('.v6-step-what').getBoundingClientRect().bottom")
    R.check(f'{w}: the step card\'s title is still on the first screen', top <= h - 56, round(top))
    R.check(f'{w}: See every step is shown, the list folded', s['more'] and pg.page.evaluate("document.getElementById('tk-list').hidden"))
    pg.page.click('[data-tkmore]'); pg.page.wait_for_timeout(150)
    lst = pg.page.evaluate("[...document.querySelectorAll('#tk-list > li')].map(l => l.innerText.replace(/\\s+/g, ' ').trim())")
    R.check(f'{w}: the list opens with every stop, the passed ones with their day', pg.page.evaluate("document.querySelector('[data-tkmore]').getAttribute('aria-expanded')") == 'true'
            and 'House Finance · Passed Fri 2/27' in lst and 'Senate Health and Human Services · Now' in lst, lst[:8])
    i = lst.index('Senate Health and Human Services · Now') if 'Senate Health and Human Services · Now' in lst else -1
    R.check(f'{w}: the deadline ahead sits under the stop it gates', i >= 0 and lst[i + 1] == 'Second lateral, Mon 3/30', lst[i:i + 2])
    R.check(f'{w}: no past deadline in the list', not any(re.search(r'First|Crossover', x) for x in lst), lst)
    R.check(f'{w}: no sideways scroll', overflow(pg) <= 0, overflow(pg))
    R.check(f'{w}: no page errors', not pg.errors, pg.errors[:2]); pg.close()

  # ---- 4. a Senate bill, a bill in conference, a budget bill ----
  pg = B.page('NT', 1440, 900); pg.open('/bill/SB1250'); s = pg.page.evaluate(STATE)
  R.check('SB 1250: the Senate first', s['groups'] == ['Senate', 'House', 'Final steps'] and [x[0] for x in s['stops']][:3] == ['AEN', 'WAM', 'Vote'], (s['groups'], [x[0] for x in s['stops']]))
  R.check('SB 1250: now in House Finance, its next deadline Second decking', [x[0] for x in s['stops'] if x[1] == 'now'] == ['FIN'] and s['flags'][0]['stop'] == 'FIN', (s['stops'], s['flags'][:1]))
  R.check('SB 1250: with no caption line for it, the bar\'s next deadline keeps its name', s['flags'][0]['text'] == 'Second decking 4/10', s['flags'][:1])
  R.check('SB 1250: the chair ask\'s card says the deadline, so the caption does not repeat it (A-14)', not any(c.startswith('Next deadline') for c in s['caption']) and 'It must clear its last committee by Fri 4/10' in pg.text(), s['caption'])
  pg.close()
  pg = B.page('NT', 1440, 900); pg.open('/bill/HB244'); s = pg.page.evaluate(STATE)
  R.check('HB 244: in conference, all before it done', [x[1] for x in s['stops']] == ['done'] * 6 + ['now', 'next'], [x[1] for x in s['stops']])
  R.check('HB 244: one flag, Fiscal (it went to FIN), after conference', [(f['text'], f['stop'], f['title']) for f in s['flags']] == [('by 5/1', 'Conference', 'Fiscal Fri 5/1')], s['flags'])
  R.check('HB 244: the caption says conference and what the deadline asks', s['caption'][0].startswith('Now: in conference') and 'must be agreed by the House and Senate' in s['caption'][-1], s['caption'])
  pg.close()
  pg = variant(B, 1440, 900, 'HB1562', {'stage': 'first_decking', 'referrals': ['FIN'], 'origin_stops': 1, 'second_stops': 0}, 'HB1800'); s = pg.page.evaluate(STATE)
  R.check('a budget bill: its own decking and crossover (replaces), Budget decking today is next',
          [f['title'].split(' ')[:2] for f in s['flags']][:2] == [['Budget', 'decking'], ['Budget', 'crossover']] and s['flags'][0]['next'] and s['flags'][0]['text'] in ('by 3/16', 'Budget decking 3/16'), [(f['title'], f['text']) for f in s['flags']])
  R.check('a budget bill: no general First decking or Crossover', not any(re.match(r'(First decking|Crossover)', f['title']) for f in s['flags']), [f['title'] for f in s['flags']])
  R.check('a chamber with no referral yet: one "Committees" stop', 'Committees' in [x[0] for x in s['stops']], [x[0] for x in s['stops']])
  pg.close()

  # ---- 5. stopped, finished, resolutions ----
  for w, h in [(1440, 900), (390, 844)]:
    pg = B.page('NT', w, h); pg.open('/bill/HB1084'); s = pg.page.evaluate(STATE)
    st = [x[1] for x in s['stops']] if w > 600 else s['slim']
    R.check(f'{w} HB 1084 (stopped at the first lateral): marked stopped where it stopped, nothing after it done', st[0] == 'stopped' and set(st[1:]) == {'next'}, st)
    R.check(f'{w} HB 1084: no flags and no next deadline', not s['flags'] and not any('deadline' in c for c in s['caption']), (s['flags'], s['caption']))
    R.check(f'{w} HB 1084: "Stopped at House Transportation: did not reach its last committee by Fri 2/20."', s['caption'][0] == 'Stopped at House Transportation: did not reach its last committee by Fri 2/20.', s['caption'])
    R.check(f'{w} HB 1084: stopped is neutral, never red (A-5 on v6)', 'bad' not in pg.page.evaluate("getComputedStyle(document.querySelector('.tk .is-stopped')).backgroundImage") and pg.page.evaluate("!/rgb\\(175, 51, 40\\)/.test(getComputedStyle(document.querySelector('.tk .is-stopped')).backgroundImage)"))
    pg.close()
  cases = [
    ('a law', 'HB244', {'stage': 'enacted'}, None, lambda s: all(x[1] == 'done' for x in s['stops']) and s['caption'] == ['Signed into law.'] and not s['flags']),
    ('a veto', 'HB244', {'stage': 'vetoed'}, None, lambda s: [x[1] for x in s['stops']][-2:] == ['done', 'stopped'] and s['caption'] == ['Vetoed by the Governor.'] and not s['flags']),
    ('on the Governor\'s desk', 'HB244', {'stage': 'governor'}, None, lambda s: [x[1] for x in s['stops']][-1] == 'now' and s['caption'][0] == 'Now: on the Governor’s desk.' and not s['flags']),
    ('a concurrent resolution adopted', 'HB1562', {'stage': 'enacted'}, 'HCR6', lambda s: [x[0] for x in s['stops']] == ['HLT/HSH', 'FIN', 'Vote', 'HHS', 'WAM', 'Vote'] and s['caption'] == ['Adopted.'] and s['groups'] == ['House', 'Senate']),
    ('a House resolution: one chamber, no flags', 'HB1562', {'referrals': ['HLT'], 'origin_stops': 1, 'second_stops': 0, 'stage': 'first_lateral'}, 'HR7', lambda s: [x[0] for x in s['stops']] == ['HLT', 'Vote'] and not s['flags']),
    ('stopped with no record of where: no stop marked', 'HB1084', {'died_at_stage': None}, None, lambda s: all(x[1] == 'next' for x in s['stops']) and s['caption'][0].startswith('Stopped: ')),
    ('a stage set by the team says so', 'HB1562', {'stage_override': 'first_floor'}, None, lambda s: [x[2] for x in s['stops'] if x[1] == 'now'] == ['A vote of the full House'] and '(set by the team)' in s['caption'][0]),
  ]
  for name, num, patch, as_, ok in cases:
    pg = variant(B, 1440, 900, num, patch, as_); s = pg.page.evaluate(STATE)
    R.check(name, bool(s) and ok(s), s and (s['stops'], s['caption'], s['flags']))
    R.check(f'{name}: no page errors', not pg.errors, pg.errors[:2]); pg.close()

R.done()
