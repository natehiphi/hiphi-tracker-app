# Staff v6: every old address still opens the right place (R-336 V36, spec 3.4). Slack messages, calendar invites, emails
# and bookmarks carry the old app's, Staff v2's and Staff v5's addresses; each must land on its v6 home, never on a blank
# page, an error or a quiet Today. Two lists:
#   1. the addresses the spec moves (#bill=, #emails, #calendar=, #/tasks, #/?view=week, #/?scope=team, the bill's old tabs,
#      #/outreach/issues, #/outreach?segment=, #/bills/memo, #/coalition, #/legislators?view=holding, #/setup/people);
#   2. every other Staff v5 address, which must open the same thing it opened in v5 (the same place lit, and v5's page
#      title still on the page).
# Each address is opened as a fresh arrival (a full page load), at 1440x900 (the place lit in the sidebar) and at 390x844
# (no blank page, no error on a phone).
#
#   APP=staff6 python3 tests/staff6_links.py     exits 1 when an address misses its v6 place
#   APP=staff5 python3 tests/staff6_links.py     records where each address goes in v5 (the baseline); prints only
#   V4_ROOT=/path/to/worktree ...                serves that folder straight into the browser (otherwise HOST, :8832)
import os, re, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import staff6_lib as L

B = 'HB1562'
# old address, who opens it, the v6 address it must end on (a regex on location.hash), the v6 place lit in the sidebar,
# and words the page must show (a regex), or None
MOVED = [
  (f'#bill={B}', 'NT', rf'^#/bill/{B}$', 'Bills', B),
  (f'#bill=HB 1562', 'NT', rf'^#/bill/{B}$', 'Bills', B),
  ('#emails', 'NT', r'^#/review', 'Testimony', r'Review'),
  ('#calendar=Calendar%20connected', 'NT', r'^#/me', 'You', None),
  ('#/tasks', 'KV', r'^#/$', 'Today', None),
  ('#/?view=week', 'KV', r'^#/hearings(\?|$)', 'Hearings', None),
  ('#/?view=ahead', 'KV', r'^#/hearings(\?|$)', 'Hearings', None),
  ('#/?scope=team', 'NT', r'^#/team', 'Team', r'Slipping'),
  ('#/?scope=team', 'JS', r'^#/team', 'Team', None),
  ('#/?scope=team', 'KV', r'^#/$', 'Today', None),          # not a lead: Today, never an error
  (f'#/bill/{B}/overview', 'KV', rf'^#/bill/{B}$', 'Bills', None),
  (f'#/bill/{B}/activity', 'KV', rf'^#/bill/{B}/talk', 'Bills', r'Team talk'),
  ('#/outreach/issues', 'KV', r'^#/my-issues/all', 'My issues', r'All issues'),
  (f'#/outreach?segment={L.SEGMENT}', 'SY', r'^#/outreach/supporters', 'Outreach', r'Supporters'),
  ('#/bills/memo', 'LR', r'^#/outreach/partners', 'Outreach', r'Partner update'),
  ('#/coalition', 'PH', r'^#/my-issues/coalitions', 'My issues', r'Coalitions'),
  ('#/legislators?view=holding', 'KV', r'^#/legislators\?view=holding', 'Legislators', r'Holding our bills'),
  ('#/setup/people', 'NT', r'^#/people', 'People', None),
]
# every other v5 address: (address, who, the v6 place lit)
V5_ADDRESSES = [
  ('#/', 'KV', 'Today'), ('#/review', 'KR', 'Testimony'), ('#/review/dd1', 'KR', 'Testimony'), ('#/inbox', 'KV', 'Inbox'),
  ('#/my-issues', 'KV', 'My issues'), ('#/bills', 'KV', 'Bills'), ('#/bills/new', 'NT', 'Bills'), ('#/bills/muted', 'KV', 'Bills'),
  (f'#/bill/{B}', 'KV', 'Bills'), (f'#/bill/2026/{B}', 'KV', 'Bills'), (f'#/bill/{B}/public', 'KV', 'Bills'),
  ('#/legislators', 'KV', 'Legislators'), (f'#/legislator/{L.LEGISLATOR}', 'KV', 'Legislators'),
  ('#/hearing/' + L.TRN_TUE, 'LR', 'Hearings'), ('#/coalition/' + L.HEAL, 'PH', 'My issues'),
  ('#/outreach', 'SY', 'Outreach'), ('#/outreach/partners', 'LR', 'Outreach'), ('#/outreach/emails', 'SY', 'Outreach'),
  ('#/outreach/supporters', 'SY', 'Outreach'), ('#/outreach/lists', 'SY', 'Outreach'), ('#/person/' + L.SUPPORTER, 'SY', 'Outreach'),
  ('#/list/' + L.LIST, 'SY', 'Outreach'), ('#/email/new', 'NT', 'Outreach'), ('#/email/-101', 'NT', 'Outreach'),
  ('#/issue/' + L.ISSUE, 'KV', 'My issues'), ('#/search?q=tobacco', 'KV', None), ('#/me', 'KV', 'You'),
  ('#/setup', 'NT', 'Session setup'), ('#/setup/email', 'NT', 'Session setup'), ('#/setup/coalitions', 'NT', 'Session setup'),
  ('#/setup/alerts', 'NT', 'Session setup'), ('#/setup/templates', 'NT', 'Session setup'), ('#/setup/privacy', 'NT', 'Session setup'),
  ('#/help', 'KV', 'Help'), ('#/help/file', 'KV', 'Help'), ('#/help/keys', 'KV', 'Help'), ('#/partners', 'NT', 'Partners'),
]

LOOK = r"""() => { const main = document.querySelector('main'); const t = main ? main.innerText : '';
  const side = [...document.querySelectorAll('aside [aria-current=page], aside [aria-current=true]')].filter(e => e.getClientRects().length).map(e => e.innerText.split('\n')[0].replace(/\s*\d+\+?$/, '').trim());
  const tab = [...document.querySelectorAll('main [aria-current=page], main [aria-selected=true], main [aria-pressed=true]')].filter(e => e.getClientRects().length).map(e => e.innerText.trim()).slice(0, 4);
  const h1 = [...document.querySelectorAll('h1, [role=heading][aria-level="1"]')].filter(e => e.getClientRects().length).map(e => e.innerText.trim())[0] || '';
  const h2 = [...document.querySelectorAll('main h2')].filter(e => e.getClientRects().length).map(e => e.innerText.trim().replace(/\s*\d+$/, ''))[0] || '';
  return { hash: location.hash, side, tab, h1, h2, len: t.trim().length, broken: /Something went wrong on this page|We could not load the tracker|That page did not load/.test(t), text: t.slice(0, 3000) }; }"""

def arrive(b, who, addr, w, h, i):
  pg = b.page(who, w, h)
  try:
    pg.page.goto(f"{L.HOST}/{L.APP}.html?demo=1&as={who}&_={i}{addr}"); pg.page.wait_for_timeout(700); pg.ready(9000)
    x = pg.page.evaluate(LOOK); x['errors'] = pg.errors[:2]; return x
  finally: pg.close()

def placename(x):
  # Staff v5's sidebar names "My settings"; v6's account door is "You". Either is the same place.
  return (x['side'] or [''])[0]

def main():
  R = L.Results(); seen = {}; i = 0
  with L.browser() as b:
    print(f'{L.APP}: the addresses the spec moves (3.4)')
    for addr, who, want_hash, want_place, words in MOVED:
      i += 1; x = arrive(b, who, addr, 1440, 900, i); ph = arrive(b, who, addr, 390, 844, i + 500)
      where = f"{who}: ended on {x['hash']}, lit {placename(x) or 'nothing'}, h1 \"{x['h1'][:40]}\""
      seen[f'{addr}|{who}'] = {'hash': x['hash'], 'place': placename(x), 'h1': x['h1']}
      if L.V5: print(f'  v5  {addr:34} {where}'); continue
      ok = (not x['broken'] and x['len'] > 20 and not x['errors'] and re.search(want_hash, x['hash'])
            and (placename(x) == want_place or (want_place == 'You' and placename(x) in ('You', 'My settings')))
            and (not words or re.search(words, x['text'], re.I)))
      phone = not ph['broken'] and ph['len'] > 20 and not ph['errors']
      R.check(f'{addr} opens {want_place} ({want_hash.strip("^$")}), on a laptop and a phone', ok and phone,
              (where if not ok else '') + ('' if phone else f"; on a phone: {ph['hash']} {'error page' if ph['broken'] else ''} {ph['errors'][:1]}"))

    print(f'\n{L.APP}: every other Staff v5 address opens the same thing it did in v5')
    base = L.load_baseline().get('links', {})
    for addr, who, place in V5_ADDRESSES:
      i += 1; x = arrive(b, who, addr, 1440, 900, i); ph = arrive(b, who, addr, 390, 844, i + 500)
      seen[f'{addr}|{who}'] = {'hash': x['hash'], 'place': placename(x), 'h1': x['h1'], 'h2': x['h2'], 'broken': x['broken']}
      if L.V5:
        bad = x['broken'] or x['len'] <= 20 or x['errors']
        print(f"  {'FAIL' if bad else 'v5  '} {addr:40} {who}: lit {placename(x) or 'nothing'}, h1 \"{x['h1'][:40]}\"" + (f" {x['errors'][:1]}" if x['errors'] else ''))
        continue
      v5 = base.get(f'{addr}|{who}', {})
      # "the same thing": v5's page title still names the page (an h1, a tab or a heading), and the right place is lit
      title = re.split(r'\s+·\s+', v5.get('h1') or '')[0].strip()
      shown = (x['text'] + ' ' + x['h1'] + ' ' + ' '.join(x['tab'])).lower()
      # a sub-page (a Session setup part, a Help topic) must also still show what v5 headed it with
      sub = (v5.get('h2') or '').strip() if re.match(r'#/(setup|help)/', addr) else ''
      same = (not title or title.lower() in shown) and (not sub or sub.lower() in shown)
      if sub and sub.lower() not in shown: title = f'{title}: {sub}'
      lit = place is None or placename(x) == place or (place == 'You' and placename(x) in ('You', 'My settings'))
      ok = not x['broken'] and x['len'] > 20 and not x['errors'] and same and lit and not (x['hash'] in ('#/', '') and addr not in ('#/',))
      phone = not ph['broken'] and ph['len'] > 20 and not ph['errors']
      R.check(f'{addr} opens {place or "its page"}' + (f' ("{title}")' if title else '') + ', on a laptop and a phone', ok and phone,
              (f"{who}: ended on {x['hash']}, lit {placename(x) or 'nothing'}, h1 \"{x['h1'][:40]}\"" + (f", v5 said \"{title}\" and it is not on the page" if not same else '') + (f" {x['errors'][:1]}" if x['errors'] else '') if not ok else '')
              + ('' if phone else f"; on a phone: {ph['hash']} {'error page' if ph['broken'] else ''} {ph['errors'][:1]}"))
  if L.V5:
    L.save_baseline('links', seen); print(f'\nv5 baseline saved to {os.path.relpath(L.BASELINE)}'); sys.exit(0)
  R.done()

if __name__ == '__main__':
  main()
