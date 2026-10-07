# A fake Supabase for testing Staff v2's LIVE path (R-152 B). The sandbox (?demo=1) skips every database read and write, so
# until now nothing tested sign-in's reads, a failed read, a refresh, or what a save actually sends. This serves the
# snapshot's rows (demo/snapshot.json) as the REST tables a signed-in staff page reads, over Playwright's request
# interception, with a stored login: no real login, no network to the database, nothing written anywhere real.
#   from livefake import Fake; fake = Fake(); fake.install(context)      then open staff.html (no ?demo)
# What a test can do: fake.fail.add('testimony_drafts') makes a table answer 500; fake.set('bills', id, nickname='x') is a
# teammate's save (later reads see it); fake.log lists every write (method, table, query, body); fake.reads lists every
# read URL; fake.rows(table) the current rows.
import json, os, re, urllib.parse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HOST = 'eivzjbnygscguqqiiuvh.supabase.co'
CORS = {'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,PATCH,DELETE,OPTIONS',
        'access-control-expose-headers': 'content-range', 'access-control-max-age': '600'}

class Fake:
    def __init__(self, me_initials='NT', extra_bills=()):
        s = json.load(open(os.path.join(ROOT, 'demo', 'snapshot.json')))
        self.snap = s
        self.me = next(a for a in s['advocates'] if a['initials'] == me_initials)
        bills = [dict(b, tracked=True) for b in s['bills']] + [dict(b) for b in extra_bills]
        self.t = {
            'advocates': [dict(a) for a in s['advocates']], 'bills': bills, 'bill_assignments': s['assignments'], 'campaigns': s['campaigns'],
            'bill_campaigns': s['billCampaigns'], 'hearings': [dict(h) for h in s['hearings']], 'hearing_outcomes': s['outcomes'],
            'testimony_drafts': [dict(d) for d in s['drafts']], 'committees': s['committees'], 'committee_slots': s['slots'],
            'session_deadlines': s['deadlines'], 'session_calendar': s['calendar'], 'public_lists': s['lists'], 'public_list_bills': s['listBills'],
            'legislators': [dict(l, active=True) for l in s['legislators']], 'committee_members': s['committeeMembers'], 'committee_counterparts': s['counterparts'],
            'categories': s['categories'], 'issues': s['issues'], 'issue_categories': s['issueCategories'], 'bill_issues': s['billIssues'],
        }
        self.fail = set(); self.log = []; self.reads = []; self.rpcs = []; self.delay = {}

    # ---- the teammate and the tests ----
    def rows(self, table): return self.t.setdefault(table, [])
    def get(self, table, id): return next(r for r in self.rows(table) if r.get('id') == id)
    def set(self, table, id, **kw): self.get(table, id).update(kw)
    def writes(self, table=None, method=None): return [w for w in self.log if (not table or w[1] == table) and (not method or w[0] == method)]

    # ---- the login the page finds in its own storage ----
    def session_script(self):
        sess = {'access_token': 'x.y.z', 'token_type': 'bearer', 'expires_in': 36000, 'expires_at': 4102444800, 'refresh_token': 'r',
                'user': {'id': 'user-' + self.me['id'], 'aud': 'authenticated', 'role': 'authenticated', 'email': self.me['email'], 'app_metadata': {}, 'user_metadata': {}, 'created_at': '2026-01-01T00:00:00Z'}}
        return f"try {{ localStorage.setItem('sb-{HOST.split('.')[0]}-auth-token', {json.dumps(json.dumps(sess))}); }} catch (e) {{}}"

    def install(self, ctx):
        ctx.add_init_script(self.session_script())
        ctx.route(re.compile(r'https://' + re.escape(HOST) + '/.*'), self._handle)

    # ---- the REST server ----
    def _filters(self, q):
        out = []
        for k, v in q.items():
            if k in ('select', 'order', 'limit', 'offset', 'and', 'or', 'on_conflict', 'columns') or '.' in k: continue
            m = re.match(r'^(not\.)?(eq|is|in|neq)\.(.*)$', v)
            if m: out.append((k, m.group(1) or '', m.group(2), m.group(3)))
        return out
    @staticmethod
    def _match(row, f):
        k, neg, op, val = f; cur = row.get(k)
        if op == 'is': hit = (cur is None) if val == 'null' else (str(cur).lower() == val)
        elif op == 'in': hit = str(cur) in [x.strip('"') for x in val.strip('()').split(',')]
        elif op == 'neq': hit = str(cur).lower() != val.lower()
        else: hit = str(cur).lower() == val.lower() if not isinstance(cur, bool) else (str(cur).lower() == val.lower())
        return (not hit) if neg else hit

    def _handle(self, route):
        req = route.request; u = urllib.parse.urlparse(req.url); path = u.path
        q = {k: v[0] for k, v in urllib.parse.parse_qs(u.query, keep_blank_values=True).items()}
        if req.method == 'OPTIONS': return route.fulfill(status=204, headers=CORS)
        def send(status=200, body=None, extra=None):
            h = dict(CORS); h['content-type'] = 'application/json'
            if extra: h.update(extra)
            route.fulfill(status=status, headers=h, body=json.dumps(body) if body is not None else '')
        if path.startswith('/auth/v1/'):
            return send(200, {'user': {'id': 'user-' + self.me['id'], 'email': self.me['email']}})
        if path.startswith('/functions/v1/'): return send(200, {})
        if not path.startswith('/rest/v1/'): return send(404, {})
        name = path[len('/rest/v1/'):]
        if name.startswith('rpc/'):
            fn = name[4:]; body = json.loads(req.post_data or '{}') if req.post_data else {}; self.rpcs.append((fn, body))
            if fn == 'claim_advocate': return send(200, self.me['id'])
            if fn == 'my_inbox': return send(200, [])
            return send(200, [])
        table = name
        if req.method == 'GET' or req.method == 'HEAD':
            self.reads.append(req.url)
            if table in self.fail: return send(500, {'message': 'fake outage', 'code': 'XX000'})
            rows = [r for r in self.rows(table) if all(self._match(r, f) for f in self._filters(q))]
            if table == 'bills' and q.get('tracked') == 'eq.true': rows = [r for r in rows if r.get('tracked')]
            if table == 'hearings' and 'bills!inner' in q.get('select', ''):
                bt = {b['id']: b.get('tracked') for b in self.rows('bills')}
                rows = [dict(r, bills={'tracked': bt.get(r.get('bill_id'), False)}) for r in rows if bt.get(r.get('bill_id'))]
            if table == 'activity_log': rows = []
            off, lim = int(q.get('offset', 0)), int(q.get('limit', 10**9))
            if req.headers.get('range'):
                a, _, z = req.headers['range'].partition('-'); off, lim = int(a), int(z) - int(a) + 1
            page = rows[off:off + lim]
            hdr = {'content-range': f'{off}-{max(off, off + len(page) - 1)}/{len(rows)}'}
            if req.method == 'HEAD': return route.fulfill(status=200, headers={**CORS, **hdr, 'content-type': 'application/json'})
            if 'pgrst.object' in (req.headers.get('accept') or ''):
                return send(200, page[0], hdr) if page else send(406, {'message': 'no rows', 'code': 'PGRST116'}, hdr)
            return send(200, page, hdr)
        body = json.loads(req.post_data) if req.post_data else None
        self.log.append((req.method, table, dict(q), body))
        if table in self.fail and req.method != 'GET': return send(500, {'message': 'fake outage'})
        if req.method == 'PATCH':
            for r in self.rows(table):
                if all(self._match(r, f) for f in self._filters(q)): r.update(body or {})
            return route.fulfill(status=204, headers=CORS)
        if req.method == 'POST':
            rows = body if isinstance(body, list) else [body]
            for r in rows: self.rows(table).append(dict(r))
            return send(201, rows)
        if req.method == 'DELETE':
            self.t[table] = [r for r in self.rows(table) if not all(self._match(r, f) for f in self._filters(q))]
            return route.fulfill(status=204, headers=CORS)
        return send(200, [])
