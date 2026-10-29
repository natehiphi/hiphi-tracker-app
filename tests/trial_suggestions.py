# R-337 part 3: the trial suggestions page (trial-suggestions.html) for Nate and admins. The practice project is faked
# as in tests/trial_band.py: the sign-in is a session in the browser's storage and the answers come from this file, so
# nothing reaches either database. The database side (admins only, a decision reaching the person) is tested on the
# practice project in rolled-back transactions (backend trial/feedback.sql).
#   python3 tests/trial_suggestions.py            (SHOTS=<folder> keeps the screenshots)
import base64, json, os, sys, time
from urllib.parse import urlparse, unquote
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HOST = 'https://v6.test'
PRACTICE = 'https://pjbezfxxplirpbdgjrpe.supabase.co'
LIVE = 'eivzjbnygscguqqiiuvh'
SHOTS = os.environ.get('SHOTS', '')
fails = []
def ok(c, msg):
  print(('PASS ' if c else 'FAIL ') + msg)
  if not c: fails.append(msg)

ME = {'id': 'aaaaaaaa-0000-4000-8000-0000000000e1', 'email': 'boss@hiphi.test'}
def jwt():
  b = lambda d: base64.urlsafe_b64encode(json.dumps(d).encode()).decode().rstrip('=')
  return f"{b({'alg': 'HS256', 'typ': 'JWT'})}.{b({'sub': ME['id'], 'email': ME['email'], 'role': 'authenticated', 'aud': 'authenticated', 'exp': int(time.time()) + 7200})}.sig"
SESSION = {'access_token': jwt(), 'refresh_token': 'r', 'token_type': 'bearer', 'expires_in': 7200, 'expires_at': int(time.time()) + 7200,
           'user': {'id': ME['id'], 'email': ME['email'], 'aud': 'authenticated', 'role': 'authenticated', 'app_metadata': {}, 'user_metadata': {}, 'created_at': '2026-10-28T00:00:00Z'}}

def row(i, **k):
  r = {'id': i, 'trial_id': 7, 'auth_user_id': ME['id'], 'person': 'Kai Teammate', 'kind': 'suggest', 'page': '/hearings · Hearings',
       'trial_at': '2026-03-16T19:00:00+00:00', 'notification_id': None, 'alert_kind': None, 'alert_text': None, 'words': 'Put the room number first',
       'screenshot': None, 'status': 'new', 'reply': None, 'decided_by': None, 'decided_at': None, 'created_at': f'2026-10-29T0{i}:00:00+00:00'}
  r.update(k); return r

class Fake:
  def __init__(self, admin=True, signed_in=True):
    self.admin, self.signed_in, self.posts = admin, signed_in, []
    self.rows = [row(1), row(2, person='Nate Hix', words='The bills list should open on my issues', page='/bills · Bills', trial_at='2026-02-17T19:00:00+00:00'),
                 row(3, person='Kai Teammate', words='Old idea', status='planned', reply='On the list for January', decided_by='boss@hiphi.test', decided_at='2026-10-29T05:00:00+00:00'),
                 row(4, kind='wrong', words='Due before the hearing was noticed', page='/', alert_kind='draft_created', alert_text='Testimony draft ready — HB1562', notification_id=41),
                 row(5, kind='useful', words=None, page='/', alert_kind='daily_list', alert_text='Upcoming hearings', notification_id=40, person='Nate Hix')]
    self.summary = [{'alert_kind': 'draft_created', 'useful': 1, 'not_useful': 0, 'wrong': 1}, {'alert_kind': 'daily_list', 'useful': 1, 'not_useful': 0, 'wrong': 0}]
  def serve_site(self, route):
    p = unquote(urlparse(route.request.url).path).lstrip('/') or 'index.html'
    f = os.path.join(ROOT, p)
    if not os.path.isfile(f): return route.fulfill(status=404, body='')
    ct = {'.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png'}.get(os.path.splitext(f)[1], 'application/octet-stream')
    route.fulfill(status=200, body=open(f, 'rb').read(), headers={'content-type': ct})
  def practice(self, route):
    r = route.request; path = urlparse(r.url).path
    if r.method == 'OPTIONS':
      return route.fulfill(status=200, headers={'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*'})
    h = {'access-control-allow-origin': '*', 'content-type': 'application/json'}
    if path.startswith('/auth/v1/otp'): return route.fulfill(status=200, headers=h, body='{}')
    if path.startswith('/auth/v1/'): return route.fulfill(status=200, headers=h, body=json.dumps(SESSION['user']))
    if path.startswith('/rest/v1/rpc/'):
      fn = path.rsplit('/', 1)[1]; a = json.loads(r.post_data or '{}'); self.posts.append((fn, a))
      if fn == 'whoami': body = {'email': ME['email'], 'staff': True, 'admin': self.admin, 'name': 'Boss', 'trial': None}
      elif fn == 'suggestions': body = self.rows
      elif fn == 'alert_summary': body = self.summary
      elif fn == 'decide':
        x = next(x for x in self.rows if x['id'] == a['p_id'])
        x.update(status=a['p_status'], reply=(a.get('p_reply') or '').strip() or None, decided_by=ME['email'], decided_at='2026-10-29T08:00:00+00:00')
        body = x
      else: body = []
      return route.fulfill(status=200, headers=h, body=json.dumps(body))
    route.fulfill(status=404, headers=h, body='{}')

def open_page(b, fake, w=1280, h=900):
  mobile = w < 768
  ctx = b.new_context(viewport={'width': w, 'height': h}, is_mobile=mobile, has_touch=mobile, reduced_motion='reduce')
  live = []
  ctx.route(lambda u: LIVE in u, lambda r: (live.append(r.request.url), r.abort()))
  ctx.route(HOST + '/**', fake.serve_site)
  ctx.route(PRACTICE + '/**', fake.practice)
  if fake.signed_in:
    ctx.add_init_script(f"try {{ localStorage.setItem('sb-pjbezfxxplirpbdgjrpe-auth-token', {json.dumps(json.dumps(SESSION))}); }} catch (e) {{}}")
  pg = ctx.new_page(); errs = []
  pg.on('pageerror', lambda e: errs.append(str(e)))
  pg.goto(f'{HOST}/trial-suggestions.html')
  return ctx, pg, errs, live
def shot(pg, name):
  if SHOTS: os.makedirs(SHOTS, exist_ok=True); pg.screenshot(path=os.path.join(SHOTS, name), full_page=True)

with sync_playwright() as pw:
  b = pw.chromium.launch()

  f = Fake(signed_in=False); ctx, pg, errs, live = open_page(b, f, 390, 844)
  pg.wait_for_selector('#tr-email', timeout=15000)
  ok('Trial suggestions' in pg.inner_text('h1'), 'signed out: asks for an email'); ctx.close()

  f = Fake(admin=False); ctx, pg, errs, live = open_page(b, f, 390, 844)
  pg.wait_for_selector('text=This page is for Nate', timeout=15000)
  ok(not any(fn == 'suggestions' for fn, _ in f.posts), 'not an admin: told so, and the suggestions are not asked for'); ctx.close()

  for w, h, tag in ((1280, 900, 'laptop'), (390, 844, 'phone')):
    f = Fake(); ctx, pg, errs, live = open_page(b, f, w, h)
    pg.wait_for_selector('.sg-card', timeout=15000)
    ok('67%' in pg.inner_text('#sg-sum') and '2 of 3' in pg.inner_text('#sg-sum'), f'{tag}: the share of rated alerts marked useful')
    cards = pg.locator('.sg-card').all_inner_texts()
    ok(len(cards) == 2 and 'bills list' in cards[0] and 'Put the room number first' in cards[1], f'{tag}: new suggestions, newest first, decided ones hidden ({len(cards)})')
    ok('Kai Teammate' in cards[1] and 'Hearings' in cards[1] and 'Mon, Mar 16, 9:00 AM' in cards[1] and 'Hearing week' in cards[1], f'{tag}: each says who, which page and the trial day')
    over = pg.evaluate("() => document.documentElement.scrollWidth > innerWidth")
    ok(not over, f'{tag}: nothing runs off the side')
    pw_ = pg.evaluate("() => document.querySelector('.sg-page').getBoundingClientRect().width")
    ok(pw_ >= min(w, 880) - 2, f'{tag}: the page uses the width it has ({pw_})')
    small = pg.evaluate("() => [...document.querySelectorAll('.sg-page button, .sg-page select, .sg-page input')].filter(e => e.offsetParent && e.getBoundingClientRect().height < 44).map(e => e.textContent || e.id)")
    ok(not small, f'{tag}: every control is at least 44px tall ({small[:3]})')
    shot(pg, f'suggestions-{tag}.png')
    # A decision, then a reply.
    pg.click('.sg-card[data-id="1"] [data-dec="build"]')
    pg.wait_for_selector('.sg-card[data-id="1"] [data-dec="build"][aria-pressed="true"]', timeout=8000)
    ok(('decide', {'p_id': 1, 'p_status': 'build', 'p_reply': ''}) in f.posts, f'{tag}: Build it is saved')
    pg.fill('.sg-card[data-id="1"] textarea', 'Good idea, it is in the next build')
    pg.click('.sg-card[data-id="1"] [data-save]'); pg.wait_for_selector('.sg-card[data-id="1"] >> text=Saved', timeout=8000)
    ok(f.rows[0]['reply'] == 'Good idea, it is in the next build' and f.rows[0]['status'] == 'build', f'{tag}: the reply is saved with the decision')
    pg.click('.sg-card[data-id="1"] [data-dec="build"]')
    pg.wait_for_selector('.sg-card[data-id="1"] [data-dec="build"][aria-pressed="false"]', timeout=8000)
    ok(f.rows[0]['status'] == 'new', f'{tag}: a second tap undoes the decision')
    # Filters.
    pg.select_option('#sg-status', '')
    ok(pg.locator('.sg-card').count() == 3, f'{tag}: All shows the decided one too')
    pg.select_option('#sg-person', 'Nate Hix')
    ok(pg.locator('.sg-card').count() == 1, f'{tag}: Person narrows the list')
    pg.select_option('#sg-person', '')
    pg.fill('#sg-words', 'january')
    ok(pg.locator('.sg-card').count() == 1 and 'Old idea' in pg.inner_text('.sg-card'), f'{tag}: Words searches the replies too')
    pg.fill('#sg-words', '')
    pg.select_option('#sg-sort', 'day')
    ok('bills list' in pg.inner_text('.sg-card >> nth=0'), f'{tag}: By trial day puts February first')
    pg.click('.sg-tabs [data-k="ratings"]')
    rt = pg.locator('.sg-card').all_inner_texts()
    ok(len(rt) == 2 and any('Wrong' in t and 'Testimony draft ready' in t and 'Due before' in t for t in rt), f'{tag}: Alert ratings shows the rating, the alert and why')
    # Live: a new suggestion arrives while a reply is being typed; the typing is kept.
    pg.click('.sg-tabs [data-k="suggest"]'); pg.select_option('#sg-sort', 'new')
    pg.fill('.sg-card[data-id="2"] textarea', 'half typed')
    f.rows.append(row(9, words='Brand new one', person='Lee'))
    pg.locator('#sg-words').focus()
    pg.evaluate("document.dispatchEvent(new Event('visibilitychange'))")
    pg.wait_for_selector('text=Brand new one', timeout=8000)
    ok(pg.input_value('.sg-card[data-id="2"] textarea') == 'half typed', f'{tag}: a new one appears on its own and a half-typed reply stays')
    ok(not errs and not live, f'{tag}: no page errors, nothing to the live project ({errs[:2]})')
    ctx.close()
  b.close()

print(f"\n{'FAILED: ' + str(len(fails)) if fails else 'all passed'}")
sys.exit(1 if fails else 0)
