# The one question at time zero (R-357 Part 6, the frontend half): a bill link asks the database for the whole bill page in one
# request (public_bill_page) and a returner's plain Home asks for the followed bills and their numbers (public_home), both started by
# track.html's inline script before any module has arrived. The page takes the pieces of the answer that are for THIS bill or THIS
# follow set, and every read they replace stays as it was: a 404, an error, a hung answer, an answer for another bill or another
# follow set leaves today's reads running, and the page says the same words either way. The gain is time only.
#   python3 tests/page_answer.py [base]      base defaults to https://natehiphi.github.io/hiphi-tracker-app/
# The database functions (backend migrations 191 and 192) may not be applied yet: they answer 404 (PGRST202). So the answers are made
# here, as the functions make them, from the same public views read-only over REST (anon key, the one already in track.html), and
# served to the page through a route; "the real 404/answer" cases let the network answer for itself. Nothing is written, nothing is
# counted (the privacy signal is set, and a test run is never a visit). Production is between sessions, so the numbers a bill
# shows from 10 people are made up in two cases and served BOTH ways (the answer; the old views) to show the words agree.
import sys, json, re, time, urllib.request, urllib.parse
from datetime import datetime, timedelta, timezone
from playwright.sync_api import sync_playwright
BASE = (sys.argv[1] if len(sys.argv) > 1 else 'https://natehiphi.github.io/hiphi-tracker-app/').rstrip('/') + '/'
DB = 'https://eivzjbnygscguqqiiuvh.supabase.co/rest/v1/'
KEY = 'sb_publishable_uvEtw8ru3zB9lDOxAjzrUA_JEFvKyul'   # the publishable key already in track.html
res = []
def ok(c, m): res.append(bool(c)); print('PASS' if c else 'FAIL', m)
QUIET = "Object.defineProperty(navigator, 'globalPrivacyControl', { value: true });"

# ---- the database, read-only ----
def rest(q):
    return json.load(urllib.request.urlopen(urllib.request.Request(DB + q, headers={'apikey': KEY}), timeout=30))
def history(bill_id):   # the one definer function the bill page already calls (a POST, but it only reads)
    r = urllib.request.Request(DB + 'rpc/public_bill_hearing_history', data=json.dumps({'bill': bill_id}).encode(), headers={'apikey': KEY, 'content-type': 'application/json'})
    return json.load(urllib.request.urlopen(r, timeout=30))
def inlist(ids): return '(' + ','.join(ids) + ')'

def bill_answer(num, year=None, stances=None, counts=None):
    """What public_bill_page(p_bill, p_year) returns (migration 191), made from the views' own rows."""
    b = rest(f'public_all_bills?select=*&bill_number=eq.{num}' + (f'&session_year=eq.{year}' if year else '&order=session_year.desc') + '&limit=1')[0]
    i = b['id']; yr = b['session_year']
    codes = sorted({c.strip() for x in [b.get('committee') or ''] + list(b.get('referrals') or []) for c in x.split('/') if c.strip()})
    comps = [c.strip().upper() for x in (b.get('companions') or []) for c in re.split(r'[,\s]+', x) if c.strip()]
    mine = set(b.get('hiphi_issues') or [])
    enacted = rest(f'public_all_bills?select=*&session_year=eq.{yr}&stage=eq.enacted&limit=1000')
    return {
        'bill': b,
        'hearings': rest(f'public_all_hearings?select=*&bill_id=eq.{i}&order=scheduled_at'),
        'outcomes': rest(f'public_hearing_outcomes?select=*&bill_id=eq.{i}&order=scheduled_at'),
        'activity': rest(f'public_activity?select=*&bill_id=eq.{i}&order=occurred_at.desc&limit=100'),
        'stances': stances if stances is not None else rest(f'public_bill_stances?select=*&bill_id=eq.{i}'),
        'counts': counts if counts is not None else rest(f'public_action_counts?select=*&bill_id=eq.{i}'),
        'voices': rest(f'public_hearing_voices?select=*&bill_id=eq.{i}'),
        'history': history(i),
        'committees': rest('public_committees?select=*&code=in.' + inlist(codes)) if codes else [],
        'deadlines': rest(f'public_deadlines?select=*&session_year=eq.{yr}'),
        'drafts': rest(f'public_bill_drafts?select=*&bill_id=eq.{i}'),
        'partner_bills': rest(f'public_partner_bills?select=*&bill_id=eq.{i}'),
        'partners': rest('public_partners?select=*'),
        'companions': [x for x in enacted + rest(f'public_all_bills?select=*&session_year=eq.{yr}&bill_number=in.' + inlist(comps[:3])) if x['bill_number'] in comps[:3]] if comps else [],
        'same_idea': [x for x in enacted if x['id'] != i and x.get('hiphi_follows') and x.get('hiphi_position') not in (None, 'monitor') and mine & set(x.get('hiphi_issues') or [])][:40],
        'at': datetime.now(timezone.utc).isoformat() }

def home_answer(issue_ids, bill_ids=()):
    """What public_home(p_issue_ids, p_bill_ids) returns (migration 192): the followed set, its numbers and HIPHI's week."""
    iss = rest('public_issues?select=id,bill_ids,bill_years&id=in.' + inlist(issue_ids))
    years = [y for x in iss for y in (x.get('bill_years') or [])]
    year = max(years) if years else datetime.now().year
    ids = sorted({b for x in iss for b, y in zip(x.get('bill_ids') or [], x.get('bill_years') or []) if y == year} | set(bill_ids))
    q = inlist(ids) if ids else '()'
    now = datetime.now(timezone.utc); iso = lambda d: urllib.parse.quote(d.isoformat())
    wk = rest(f'public_all_hearings?select=*&status=eq.scheduled&scheduled_at=gt.{iso(now)}&scheduled_at=lt.{iso(now + timedelta(days=8))}&order=scheduled_at&limit=150')
    wb = rest('public_all_bills?select=*&id=in.' + inlist(sorted({h['bill_id'] for h in wk}))) if wk else []
    wb = [b for b in wb if b.get('hiphi_position') not in (None, 'monitor') and b['stage'] not in ('dead', 'vetoed', 'enacted', 'governor', 'ballot')]
    wids = {b['id'] for b in wb}; wk = [h for h in wk if h['bill_id'] in wids]
    allids = sorted(set(ids) | wids)
    return {
        'bills': rest('public_all_bills?select=*&order=bill_number&id=in.' + q) if ids else [],
        'hearings': rest('public_all_hearings?select=*&bill_id=in.' + q) if ids else [],
        'outcomes': rest('public_hearing_outcomes?select=*&bill_id=in.' + q) if ids else [],
        'activity': rest('public_activity?select=*&order=occurred_at.desc&limit=300&bill_id=in.' + q) if ids else [],
        'counts': rest('public_action_counts?select=*&bill_id=in.' + inlist(allids)) if allids else [],
        'stances': rest('public_bill_stances?select=*&bill_id=in.' + inlist(allids)) if allids else [],
        'voices': rest('public_hearing_voices?select=*&bill_id=in.' + inlist(allids)) if allids else [],
        'week': {'hearings': wk, 'bills': [b for b in wb if b['id'] not in set(ids)]},
        'committees': [], 'deadlines': rest('public_deadlines?select=*&order=deadline_date'), 'site_cards': rest('public_site_cards?select=*'),
        'year': year, 'at': now.isoformat() }

# ---- one page load, with the answer served, failed, hung or left to the network ----
CORS = {'access-control-allow-origin': '*'}
NOT_FOUND = {'code': 'PGRST202', 'details': 'Searched for the function public.public_bill_page, but no matches were found in the schema cache.', 'hint': None, 'message': 'Could not find the function'}
WORDS = """() => { const t = e => e ? e.textContent.replace(/\\s+/g, ' ').trim() : ''; return t(document.querySelector('main')) + ' | ' + t(document.querySelector('.actionbar')); }"""
# what the page holds after it has settled (ids and counts, not rows): the answer must leave the same state the reads leave
STATE = """async () => { const k = await import(new URL('pub/kernel.js', location.href).href), S = k.S, ids = o => Object.keys(o || {}).sort();
  const xs = o => Object.fromEntries(ids(o).map(b => [b, (o[b] || []).map(h => h.id || h.occurred_at).sort()]));
  return { bills: S.bills.map(b => b.id).sort(), hearings: S.hearings.map(h => h.id).sort(), activity: S.activity.length, outcomes: ids(S.outcomes), counts: ids(S.actionCounts), stances: ids(S.billStances), voices: ids(S.voices),
    extra: ids(S.extra), xh: xs(S.xh), xa: xs(S.xa), hist: ids(S.hist), drafts: [...(S.blDrafts || new Map()).entries()].map(([id, r]) => [id, r.map(d => d.version).sort()]), featured: S.featured ? S.featured.hearings.map(h => h.id).sort() : null,
    meet: S.meetCard === undefined ? 'unset' : S.meetCard === false ? false : !!S.meetCard }; }"""
def path_of(u):
    p = u.replace(DB, '').split('&apikey=')[0]
    return urllib.parse.unquote(p)
def load(br, url, rpc=None, init='', rest_mocks=None, viewport=(390, 844), settle=3.0, ready="() => !!document.querySelector('.bl-head h1')", limit=45):
    """rpc: None (the network answers), ('json', obj), ('status', code), 'hang'. rest_mocks: {view: rows} served for the old reads."""
    ctx = br.new_context(viewport={'width': viewport[0], 'height': viewport[1]}); ctx.add_init_script(QUIET)
    if init: ctx.add_init_script(init)
    out = dict(reqs=[], errs=[], status={}, words='', h1='', secs=None, state=None)
    hung = []
    def rpc_route(route):
        if rpc == 'hang': hung.append(route); return   # never answered: track.html gives up at ten seconds, the page at four
        kind, val = rpc
        if kind == 'json': route.fulfill(status=200, content_type='application/json', headers=CORS, body=json.dumps(val))
        else: route.fulfill(status=val, content_type='application/json', headers=CORS, body=json.dumps(NOT_FOUND if val == 404 else {'message': 'boom'}))
    if rpc: ctx.route(re.compile(r'.*/rest/v1/rpc/public_(bill_page|home)\b.*'), rpc_route)
    for pat, rows in (rest_mocks or {}).items():   # pat: the part of the address after /rest/v1/, as a regular expression
        ctx.route(re.compile(r'.*/rest/v1/' + pat + r'.*'), lambda route, request=None, rows=rows: route.fulfill(status=200, content_type='application/json', headers=CORS, body=json.dumps(rows)))
    pg = ctx.new_page(); t0 = time.time(); last = [t0]
    def seen(r):
        if 'supabase.co' in r.url:
            out['reqs'].append((r.method, path_of(r.url), {k.lower() for k in r.headers})); last[0] = time.time()
    pg.on('request', seen)
    pg.on('response', lambda r: out['status'].__setitem__(path_of(r.url).split('?')[0], r.status) if 'rpc/public_bill_page' in r.url or 'rpc/public_home' in r.url else None)
    pg.on('pageerror', lambda e: out['errs'].append(str(e)[:200]))
    try:
        pg.goto(url, wait_until='commit', timeout=60000)
        pg.wait_for_function(ready, timeout=limit * 1000)
        out['secs'] = time.time() - t0
        # quiet: no new database request for `settle` seconds and the words have stopped changing
        prev = None
        for _ in range(60):
            pg.wait_for_timeout(500); w = pg.evaluate(WORDS)
            if w == prev and time.time() - last[0] > settle: break
            prev = w
        out['words'] = pg.evaluate(WORDS); out['state'] = pg.evaluate(STATE)
        out['h1'] = pg.evaluate("() => (document.querySelector('main h1') || {}).textContent || ''")
    except Exception as e:
        out['errs'].append('load: ' + str(e)[:120])
    for r in hung:
        try: r.abort()
        except Exception: pass
    ctx.close(); return out

# which reads each case is judged by. A bill's own reads (by its id), then the whole-table partner reads the bill page asks for.
def bill_reads(o, bid):
    r = [p for _, p, _ in o['reqs']]
    f = lambda pat: any(re.search(pat, p) for p in r)
    return dict(bill=f(r'^public_all_bills\?.*bill_number=eq\.'), hearings=f(r'^public_all_hearings\?.*bill_id=eq\.' + bid), outcomes=f(r'^public_hearing_outcomes\?.*bill_id=eq\.' + bid),
                stances=f(r'^public_bill_stances\?.*bill_id=eq\.' + bid), counts=f(r'^public_action_counts\?.*bill_id=eq\.' + bid), drafts=f(r'^public_bill_drafts\?'),
                history=f(r'^rpc/public_bill_hearing_history'), partners=f(r'^public_partner_bills\?'))
def diff(a, b): return '; '.join(f'{k}: {json.dumps(a[k])[:90]} vs {json.dumps(b[k])[:90]}' for k in a if a[k] != b[k])
def names(d): return ', '.join(k for k, v in d.items() if v) or 'none'
BILL_READS = ['hearings', 'outcomes', 'stances', 'counts', 'drafts', 'history', 'partners']

with sync_playwright() as p:
    br = p.chromium.launch()
    # ---- the bill page ----
    # HB 2121 (stopped; its drafts, five hearings of history, and "the same idea became law as SB 2175" exercise most of the answer's
    # keys); SB 2175 is the other bill an answer must not be taken for.
    NUM, OTHER = 'HB2121', 'SB2175'
    A = bill_answer(NUM); B = A['bill']['id']; ANS_OTHER = bill_answer(OTHER)
    ok(A['drafts'] and A['history'] and A['bill']['stage'] == 'dead', f"the test bill {NUM} has drafts ({len(A['drafts'])}) and a history ({len(A['history'])} hearings) on production")
    URL = BASE + f'track.html?via=share#/bill/{NUM}'   # a shared link: ?via=share, the commonest way in
    # a. the 404 the database gives today: the page asks the old way (the baseline of the words)
    base = load(br, URL, rpc=('status', 404)); W0 = base['words']; rd = bill_reads(base, B)
    ok(base['h1'].strip() and 'We couldn' not in W0, f'a. with the 404 the page draws the bill ({base["h1"].strip()!r}) in {base["secs"] and round(base["secs"], 1)} s')
    ok(all(rd[k] for k in ['bill', 'hearings', 'outcomes', 'drafts', 'history']), f'a. with the 404 the old reads happen (asked: {names(rd)})')
    ok(not base['errs'], 'a. no page errors with the 404: ' + '; '.join(base['errs'][:2]))
    # b. the answer served: the same words, and none of the reads it replaces
    got = load(br, URL, rpc=('json', A)); rd2 = bill_reads(got, B)
    ok(got['words'] == W0, 'b. with the answer the page says the same words' + ('' if got['words'] == W0 else f'\n   without: {W0[:300]}\n   with:    {got["words"][:300]}'))
    ok(not any(rd2[k] for k in BILL_READS + ['bill']), f'b. with the answer none of these reads happen (asked: {names(rd2)})')
    ok(not got['errs'], 'b. no page errors with the answer: ' + '; '.join(got['errs'][:2]))
    ok(got['state'] == base['state'], 'b. the page holds the same state with the answer as with the reads' + ('' if got['state'] == base['state'] else '\n   ' + diff(got['state'], base['state'])))
    g = [r for r in got['reqs'] if 'rpc/public_bill_page' in r[1]]
    ok(len(g) == 1 and g[0][0] == 'GET' and f'p_bill={NUM}' in g[0][1] and 'p_year' not in g[0][1], f'b. the question is one GET for the address: {g[0][1][:60] if g else None}')
    ok(g and not ({'authorization', 'content-type', 'x-client-info', 'accept-profile'} & g[0][2]), 'b. a plain request (no authorization, content-type or client header), so no preflight')
    ok('the same idea became law' in W0.lower() or 'became law' in W0.lower(), 'b. the line "the same idea became law" (same_idea, companions) is on the page')
    # b2. a year in the address goes into the question
    y = load(br, BASE + f'track.html?via=share#/bill/2026/{NUM}', rpc=('json', A)); gy = [r for r in y['reqs'] if 'rpc/public_bill_page' in r[1]]
    ok(gy and 'p_year=2026' in gy[0][1] and y['words'] == W0 and not bill_reads(y, B)['hearings'], 'b2. #/bill/2026/' + NUM + ' asks with p_year=2026 and is answered the same')
    # c. numbers a bill shows from 10 people (made up: production is between sessions), served as the answer and as the old views
    st = [{'bill_id': B, 'support': 15, 'oppose': 3, 'people': 18}]; ct = [{'bill_id': B, 'testimonies': 12, 'emails': 4, 'attending': 2, 'actions': 18, 'shares': None, 'people': 18}]
    A2 = bill_answer(NUM, stances=st, counts=ct)
    via_a = load(br, URL, rpc=('json', A2)); via_v = load(br, URL, rpc=('status', 404), rest_mocks={r'public_bill_stances\?': st, r'public_action_counts\?': ct})
    ok('Of 18 people who took a stand' in via_a['words'], 'c. the answer\'s stances and counts draw the "others following" lines')
    ok(via_a['words'] == via_v['words'], 'c. the answer and the old views (same numbers) say the same words' + ('' if via_a['words'] == via_v['words'] else f'\n   answer: {via_a["words"][:300]}\n   views:  {via_v["words"][:300]}'))
    rc = bill_reads(via_a, B); ok(not rc['stances'] and not rc['counts'], f'c. with the answer neither social read happens (asked: {names(rc)})')
    ok(via_a['state'] == via_v['state'], 'c. and the page holds the same state either way (bills, hearings, outcomes, counts, stances, history, drafts)' + ('' if via_a['state'] == via_v['state'] else '\n   ' + diff(via_a['state'], via_v['state'])))
    # c2. a partner's approved words on this bill (made up: none are live yet), from the answer and from the three whole-table reads. The
    # answer seeds that one bill's page only: the page's copy of everyone's words (PUB) is not marked complete by it
    PB = [{'id': '00000000-0000-4000-8000-0000000000b1', 'partner_slug': 'keiki-smiles', 'partner_name': 'Keiki Smiles Alliance', 'bill_id': B, 'bill_number': NUM, 'session_year': 2026, 'side': 'support', 'nickname': None,
           'summary': 'Keeps flavored products away from keiki.', 'points': ['Flavors hook kids early.'], 'ask': None, 'ask_until': None, 'draft_version': None, 'draft_note': None, 'issue_ids': [], 'approved_at': '2026-03-01T00:00:00+00:00'},
          {'id': '00000000-0000-4000-8000-0000000000b2', 'partner_slug': 'keiki-smiles', 'partner_name': 'Keiki Smiles Alliance', 'bill_id': ANS_OTHER['bill']['id'], 'bill_number': OTHER, 'session_year': 2026, 'side': 'support', 'nickname': None,
           'summary': 'Good for keiki.', 'points': [], 'ask': None, 'ask_until': None, 'draft_version': None, 'draft_note': None, 'issue_ids': [], 'approved_at': '2026-03-01T00:00:00+00:00'}]
    PS = [{'slug': 'keiki-smiles', 'welcome': 'Aloha from the alliance.', 'name': 'Keiki Smiles Alliance', 'website': 'https://example.org', 'about': 'Dentists and parents.', 'writes': True}]
    pw_a = load(br, URL, rpc=('json', {**A, 'partner_bills': PB[:1], 'partners': PS}))
    pw_v = load(br, URL, rpc=('status', 404), rest_mocks={r'public_partner_bills\?': PB, r'public_partner_issues\?': [], r'public_partners\?': PS})
    ok('Keiki Smiles Alliance' in pw_v['words'] and pw_a['words'] == pw_v['words'], 'c2. a partner\'s words on the bill: the answer and the three reads say the same words' + ('' if pw_a['words'] == pw_v['words'] else f'\n   answer: {pw_a["words"][:200]}\n   reads:  {pw_v["words"][:200]}'))
    ok(not bill_reads(pw_a, B)['partners'] and not any(re.match(r'public_partner_(issues|bills)|public_partners', p) for _, p, _ in pw_a['reqs']), 'c2. and with the answer none of the three partner reads happens on the bill page')
    ctx = br.new_context(viewport={'width': 390, 'height': 844}); ctx.add_init_script(QUIET)
    ctx.route(re.compile(r'.*/rest/v1/rpc/public_bill_page.*'), lambda route, request=None: route.fulfill(status=200, content_type='application/json', headers=CORS, body=json.dumps({**A, 'partner_bills': [], 'partners': []})))
    ctx.route(re.compile(r'.*/rest/v1/public_partner_bills\?.*'), lambda route, request=None: route.fulfill(status=200, content_type='application/json', headers=CORS, body=json.dumps(PB[1:])))   # (words on the other bill only)
    ctx.route(re.compile(r'.*/rest/v1/public_partner_issues\?.*'), lambda route, request=None: route.fulfill(status=200, content_type='application/json', headers=CORS, body='[]'))
    ctx.route(re.compile(r'.*/rest/v1/public_partners\?.*'), lambda route, request=None: route.fulfill(status=200, content_type='application/json', headers=CORS, body=json.dumps(PS)))
    pg = ctx.new_page(); pg.goto(URL); pg.wait_for_function("() => !!document.querySelector('.bl-head h1')"); pg.wait_for_timeout(1500)
    pp = pg.evaluate("""async (ids) => { const P = await import(new URL('pub/partners.js', location.href).href); const before = P.pubNow(); await P.loadPublic(); return { before: before === null, here: P.onBill(ids[0]).length, other: P.onBill(ids[1]).length }; }""", [B, ANS_OTHER['bill']['id']])
    ok(pp['before'] and pp['here'] == 0 and pp['other'] == 1, f'c2. an answer with no words for this bill does not make the page\'s copy of everyone\'s words complete: another bill\'s words still arrive with the real copy ({pp})')
    ctx.close()
    # d. an answer for ANOTHER bill is ignored
    other = load(br, URL, rpc=('json', ANS_OTHER)); ro = bill_reads(other, B)
    ok(other['words'] == W0, 'd. an answer for ' + OTHER + ' at the address of ' + NUM + ': the words are the bill\'s own')
    ok(all(ro[k] for k in ['bill', 'hearings', 'outcomes', 'drafts', 'history']), f'd. the old reads happen (asked: {names(ro)})')
    # e. "no such bill" in an answer is not believed on its own; an error, and an answer that never comes, leave the old reads
    nul = load(br, URL, rpc=('json', {**A, 'bill': None})); ok(nul['words'] == W0 and bill_reads(nul, B)['bill'], 'e. an answer with bill: null: the page looks the bill up itself and draws it')
    er = load(br, URL, rpc=('status', 500)); ok(er['words'] == W0 and bill_reads(er, B)['hearings'], 'e. a 500 from the function: the old reads, the same words')
    hang = load(br, URL, rpc='hang', limit=60); ok(hang['words'] == W0 and bill_reads(hang, B)['hearings'], f'e. an answer that never comes: the page waits about four seconds, then asks the old way, the same words (drawn at {hang["secs"] and round(hang["secs"], 1)} s)')
    ok(hang['secs'] is not None and hang['secs'] < 14, 'e. and does not hang for the ten seconds track.html allows more than that')
    # f. the network answers for itself (a 404 today; the answer once the functions are applied)
    real = load(br, URL); st_real = real['status'].get('rpc/public_bill_page')
    ok(real['words'] == W0, f'f. the real network (rpc/public_bill_page answered {st_real}): the same words')
    rr = bill_reads(real, B)
    ok((st_real == 200 and not rr['stances']) or (st_real != 200 and rr['hearings']), f'f. and the reads are consistent with it (asked: {names(rr)})')
    # a partner's own link (?via=<a group's slug>) still reads the partner tables, as it always did: the page needs the group's welcome line
    via = load(br, BASE + f'track.html?via=keiki-smiles#/bill/{NUM}', rpc=('json', A)); ok(bill_reads(via, B)['partners'] and via['h1'].strip(), 'e2. a ?via=<group> link still reads the partner tables (the group\'s own welcome needs them)')
    # g. the same on a laptop
    wide = load(br, URL, rpc=('json', A), viewport=(1280, 800), ready="() => !!document.querySelector('.bl-head h1, main h1')"); wide0 = load(br, URL, rpc=('status', 404), viewport=(1280, 800), ready="() => !!document.querySelector('.bl-head h1, main h1')")
    ok(wide['words'] == wide0['words'] and not bill_reads(wide, B)['hearings'], 'g. at 1280 wide: the same words with and without the answer, no hearings read')

    # ---- Home as a returner ----
    iss = rest('public_issues?select=id,slug,bill_ids,bill_years&slug=in.(disposable-e-cigarette-ban,more-local-food-in-school-meals)')
    X = next(i for i in iss if i['slug'] == 'disposable-e-cigarette-ban'); Y = next(i for i in iss if i['slug'] == 'more-local-food-in-school-meals')
    today = datetime.now(timezone(timedelta(hours=-10))).strftime('%Y-%m-%d')
    def returner(*issue_ids, skips=()):
        return QUIET + ("try { localStorage.setItem('hiphi_wiz', JSON.stringify({ step: 99, done: true, skipped: true })); localStorage.setItem('hiphi_issue_follows', JSON.stringify(%s)); localStorage.setItem('hiphi_askday', '%s'); %s } catch (e) {}"
                        % (json.dumps(list(issue_ids)), today, ("localStorage.setItem('hiphi_skips', JSON.stringify(%s));" % json.dumps(list(skips))) if skips else ''))
    HOME = BASE + 'track.html#/'; HREADY = "() => !!document.querySelector('main .cm, main h1') && !document.querySelector('.skelpage') && !document.querySelector('.boot0')"
    def home_reads(o, ids):
        r = [p for _, p, _ in o['reqs']]
        f = lambda pat: any(re.search(pat, p) for p in r)
        return dict(bills=f(r'^public_all_bills\?(?!.*hiphi_position).*id=in\.'), hearings=f(r'^public_all_hearings\?(?!.*status=eq\.scheduled).*bill_id=in\.'), activity=f(r'^public_activity\?'),
                    outcomes=f(r'^public_hearing_outcomes\?'), counts=f(r'^public_action_counts\?'), stances=f(r'^public_bill_stances\?'), cards=f(r'^public_site_cards\?'))
    H = home_answer([X['id']]); ids = set(b['id'] for b in H['bills'])
    ok(len(H['bills']) >= 2, f'the followed issue brings {len(H["bills"])} bills on production')
    h0 = load(br, HOME, rpc=('status', 404), init=returner(X['id']), ready=HREADY); hr0 = home_reads(h0, ids)
    ok(h0['words'] and not h0['errs'], 'h. Home as a returner with the 404 draws (' + h0['words'][:60] + ')' + ' '.join(h0['errs'][:2]))
    ok(hr0['bills'] and hr0['hearings'] and hr0['activity'] and hr0['outcomes'], f'h. with the 404 the four reads for the followed set happen (asked: {names(hr0)})')
    h1 = load(br, HOME, rpc=('json', H), init=returner(X['id']), ready=HREADY); hr1 = home_reads(h1, ids)
    ok(h1['words'] == h0['words'], 'i. with the answer Home says the same words' + ('' if h1['words'] == h0['words'] else f'\n   without: {h0["words"][:300]}\n   with:    {h1["words"][:300]}'))
    ok(not (hr1['bills'] or hr1['hearings'] or hr1['activity'] or hr1['outcomes']), f'i. with the answer the followed set\'s reads do not happen (asked: {names(hr1)})')
    ok(h1['state'] == h0['state'], 'i. and Home holds the same state either way' + ('' if h1['state'] == h0['state'] else '\n   ' + diff(h1['state'], h0['state'])))
    gh = [r for r in h1['reqs'] if 'rpc/public_home' in r[1]]
    ok(len(gh) == 1 and gh[0][0] == 'GET' and 'p_issue_ids=' in gh[0][1] and X['id'] in gh[0][1] and not ({'authorization', 'content-type', 'x-client-info'} & gh[0][2]), f'i. the question is one plain GET with the followed issue in it: {gh[0][1][:80] if gh else None}')
    ok(not hr1['cards'], 'i. Home\'s site cards are not read again (they are in the answer)')
    # j. an answer for other follows: what it lacks is asked the old way, the words are the person's own
    h2 = load(br, HOME, rpc=('status', 404), init=returner(X['id'], Y['id']), ready=HREADY)
    h3 = load(br, HOME, rpc=('json', H), init=returner(X['id'], Y['id']), ready=HREADY); hr3 = home_reads(h3, ids)
    ok(h3['words'] == h2['words'], 'j. an answer for one of two followed issues: Home says the same words as with none' + ('' if h3['words'] == h2['words'] else f'\n   without: {h2["words"][:300]}\n   with:    {h3["words"][:300]}'))
    ok(hr3['bills'] and hr3['hearings'], f'j. and the bills it lacks are asked for the old way (asked: {names(hr3)})')
    ok(h3['state'] == h2['state'], 'j. and Home holds the same state' + ('' if h3['state'] == h2['state'] else '\n   ' + diff(h3['state'], h2['state'])))
    # k. "Not for me": the answer holds the skipped bill, which the person has put away
    skip = sorted(ids)[0]
    h4 = load(br, HOME, rpc=('status', 404), init=returner(X['id'], skips=[skip]), ready=HREADY)
    h5 = load(br, HOME, rpc=('json', H), init=returner(X['id'], skips=[skip]), ready=HREADY); hr5 = home_reads(h5, ids)
    ok(h5['words'] == h4['words'], 'k. with a bill put away ("Not for me") the answer\'s extra bill is left out: the same words' + ('' if h5['words'] == h4['words'] else f'\n   without: {h4["words"][:300]}\n   with:    {h5["words"][:300]}'))
    ok(not (hr5['bills'] or hr5['hearings']), f'k. and the followed set\'s reads still do not happen (asked: {names(hr5)})')
    ok(h5['state'] == h4['state'], 'k. and Home holds the same state' + ('' if h5['state'] == h4['state'] else '\n   ' + diff(h5['state'], h4['state'])))
    # k2. the answer's activity ends at 300 rows; when a put-away bill's rows took some of them, the rest of the followed set's are asked
    # the old way (made-up rows: production has none between sessions). 200 newest rows on the put-away bill, then 100 of the other's 150.
    b1, b2 = sorted(ids)[0], sorted(ids)[1]
    mk = lambda b, n, d0: [{'bill_id': b, 'bill_number': 'X', 'title': f'Action {d0}-{i}', 'details': '', 'occurred_at': (datetime(2026, 5, 1, tzinfo=timezone.utc) - timedelta(hours=d0 + i)).isoformat()} for i in range(n)]
    rows1, rows2 = mk(b1, 200, 0), mk(b2, 150, 300)
    Hc = {**H, 'activity': sorted(rows1 + rows2[:100], key=lambda r: r['occurred_at'], reverse=True)}
    ok(len(Hc['activity']) == 300, 'k2. (the made-up answer is cut at 300 rows)')
    c0 = load(br, HOME, rpc=('status', 404), init=returner(X['id'], skips=[b1]), ready=HREADY, rest_mocks={r'public_activity\?': rows2})
    c1 = load(br, HOME, rpc=('json', Hc), init=returner(X['id'], skips=[b1]), ready=HREADY, rest_mocks={r'public_activity\?': rows2})
    ok(c0['state']['activity'] == 150 and c1['state']['activity'] == 150 and home_reads(c1, ids)['activity'], f'k2. the cut answer\'s activity is asked again for the followed set ({c1["state"]["activity"]} rows, as the reads give {c0["state"]["activity"]})')
    # l. an answer made for a bill page is not Home's
    hb = load(br, HOME, rpc=('json', A), init=returner(X['id']), ready=HREADY); ok(hb['words'] == h0['words'] and home_reads(hb, ids)['bills'], 'l. a bill\'s answer given to Home is ignored')

    # m. a hearing this week on a bill the person does not follow (made up: production is between sessions): the pool finds it, and the
    # numbers for it are in Home's answer as well as in the views; the same words and state, and the three number reads do not happen
    Bw = next(b for b in rest('public_all_bills?select=*&id=in.' + inlist(sorted(set(Y['bill_ids']) - set(X['bill_ids']))[:5])) if b['stage'] == 'enacted')
    Bw = {**Bw, 'stage': 'senate_committee', 'last_action': 'Referred to CPN.', 'committee': 'CPN', 'hiphi_position': 'support'}
    soon = (datetime.now(timezone.utc) + timedelta(days=2)).replace(microsecond=0)
    Hw = {'id': '00000000-0000-4000-8000-0000000000a1', 'bill_id': Bw['id'], 'bill_number': Bw['bill_number'], 'committee': 'CPN', 'scheduled_at': soon.isoformat(), 'room': '229', 'status': 'scheduled',
          'testimony_deadline': (soon - timedelta(days=1)).isoformat(), 'notice_url': None, 'stream_url': None, 'notice_posted_at': datetime.now(timezone.utc).isoformat()}
    ctw = [{'bill_id': Bw['id'], 'testimonies': 12, 'emails': 3, 'attending': 1, 'actions': 16, 'shares': None, 'people': 16}]
    vow = [{'hearing_id': Hw['id'], 'bill_id': Bw['id'], 'people': 11, 'actions': 11}]
    pool = {r'public_all_bills\?.*hiphi_position=not\.is\.null': [Bw], r'public_all_hearings\?.*status=eq\.scheduled': [Hw]}
    HW = {**H, 'week': {'hearings': [Hw], 'bills': [Bw]}, 'counts': H['counts'] + ctw, 'voices': H['voices'] + vow}
    wk0 = load(br, HOME, rpc=('status', 404), init=returner(X['id']), ready=HREADY, rest_mocks={**pool, r'public_action_counts\?': ctw, r'public_hearing_voices\?': vow, r'public_bill_stances\?': []})
    wk1 = load(br, HOME, rpc=('json', HW), init=returner(X['id']), ready=HREADY, rest_mocks=pool)
    n_with = lambda o, v: any(p.startswith(v + '?') for _, p, _ in o['reqs'])
    ok(Bw['id'] in wk0['state']['counts'] and Hw['id'] in wk0['state']['voices'], 'm. (the old reads give the week\'s bill its numbers and its hearing its voices)')
    ok(wk1['words'] == wk0['words'] and wk1['state'] == wk0['state'], 'm. a hearing this week on a bill not followed: the answer leaves the same words and state' + ('' if wk1['state'] == wk0['state'] else '\n   ' + diff(wk1['state'], wk0['state'])))
    ok(not any(n_with(wk1, v) for v in ('public_action_counts', 'public_hearing_voices', 'public_bill_stances')) and all(n_with(wk0, v) for v in ('public_action_counts', 'public_hearing_voices')),
       'm. and with the answer the three number reads do not happen (with the 404 they do)')
    # m2. the same hearing, but the answer lacks the week (an answer asked with p_week=false, or made before the hearing was posted): only those are asked
    wk2 = load(br, HOME, rpc=('json', H), init=returner(X['id']), ready=HREADY, rest_mocks={**pool, r'public_action_counts\?': ctw, r'public_hearing_voices\?': vow, r'public_bill_stances\?': []})
    ok(wk2['state'] == wk0['state'] and n_with(wk2, 'public_action_counts'), 'm2. an answer without the week: the numbers for the week\'s bill are asked the old way, the same state')

    # ---- the practice copy and a first visit ask nothing ----
    demo = load(br, BASE + 'track.html?demo=1#/bill/HB1523', rpc=('json', A), limit=90)
    ok(not any('rpc/public_bill_page' in p or 'rpc/public_home' in p for _, p, _ in demo['reqs']) and demo['h1'].strip(), 'o. ?demo=1: no question to the database at all, and the bill draws')
    demo_h = load(br, BASE + 'track.html?demo=1#/', rpc=('json', H), init=returner(X['id']), ready="() => !!document.querySelector('main h1, main .cm')", limit=90)
    ok(not any('rpc/public_home' in p for _, p, _ in demo_h['reqs']), 'o. ?demo=1 Home as a returner: no question either')
    first = load(br, BASE + 'track.html#/', rpc=('json', H), ready="() => !!document.querySelector('.st-hellobar, .st-topics, .st1')")
    ok(not any('rpc/public_home' in p for _, p, _ in first['reqs']), 'p. a first visit (no hiphi_wiz) asks no Home question')
    br.close()
print(f'{sum(res)}/{len(res)} passed'); sys.exit(0 if all(res) else 1)
