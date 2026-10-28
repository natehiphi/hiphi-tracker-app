# R-337 trial runs, part 1: the front door (sign in, pick a week) and the band over Staff v6 (Next, Skip a day, the week's
# report, people). The practice project is faked here: its sign-in is a session put in the browser's storage and its
# answers come from this file, so nothing reaches either database. What is checked against the real practice project
# lives in the backend (trial/api.sql, tested in rolled-back transactions).
#
# The page is served from this folder at https://v6.test; the Supabase library comes from its CDN as on the site.
#   python3 tests/trial_band.py            (SHOTS=<folder> keeps the screenshots)
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

ME = {'id': 'aaaaaaaa-0000-4000-8000-0000000000e1', 'email': 'tester@hiphi.test', 'name': 'Tess Tester'}
ADV = {'id': 'bbbbbbbb-0000-4000-8000-0000000000e1', 'full_name': ME['name'], 'initials': 'TT', 'email': ME['email'], 'is_active': True,
       'is_admin': True, 'color': '#3b8d6e', 'auth_user_id': ME['id']}

def state(**k):
  s = {'trial_id': 9, 'schema': 'trial_2', 'week': 3, 'started_week': 3, 'clock': '2026-03-16T19:00:00+00:00',
       'next': '2026-03-16T22:00:00+00:00', 'next_day': '2026-03-17T19:00:00+00:00', 'done': False, 'last_stop_of_week': False,
       'can_move': True, 'starter_name': ME['name'], 'moved_by_name': ME['name'], 'members': []}
  s.update(k); return s

def jwt():
  b = lambda d: base64.urlsafe_b64encode(json.dumps(d).encode()).decode().rstrip('=')
  return f"{b({'alg': 'HS256', 'typ': 'JWT'})}.{b({'sub': ME['id'], 'email': ME['email'], 'role': 'authenticated', 'aud': 'authenticated', 'exp': int(time.time()) + 7200})}.sig"

SESSION = {'access_token': jwt(), 'refresh_token': 'test-refresh', 'token_type': 'bearer', 'expires_in': 7200,
           'expires_at': int(time.time()) + 7200, 'user': {'id': ME['id'], 'email': ME['email'], 'aud': 'authenticated', 'role': 'authenticated',
           'app_metadata': {}, 'user_metadata': {}, 'created_at': '2026-10-28T00:00:00Z'}}

class Fake:
  """The practice project's answers for one browser: who is signed in, the trial's state, and every call made."""
  def __init__(self, whoami, signed_in=True):
    self.whoami, self.signed_in, self.calls, self.profiles = whoami, signed_in, [], []
    self.after_next = None
  def serve_site(self, route):
    p = unquote(urlparse(route.request.url).path).lstrip('/') or 'index.html'
    f = os.path.join(ROOT, p)
    if not os.path.isfile(f): return route.fulfill(status=404, body='')
    ct = {'.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png'}.get(os.path.splitext(f)[1], 'application/octet-stream')
    route.fulfill(status=200, body=open(f, 'rb').read(), headers={'content-type': ct})
  def practice(self, route):
    r = route.request; u = urlparse(r.url); path = u.path
    if r.method == 'OPTIONS':
      return route.fulfill(status=200, headers={'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*'})
    h = {'access-control-allow-origin': '*', 'content-type': 'application/json', 'content-range': '0-0/0'}
    prof = r.headers.get('accept-profile') or r.headers.get('content-profile') or ''
    self.calls.append((r.method, path, prof));
    if path.startswith('/auth/v1/otp'): return route.fulfill(status=200, headers=h, body='{}')
    if path.startswith('/auth/v1/'): return route.fulfill(status=200, headers=h, body=json.dumps(SESSION['user']))
    if path.startswith('/rest/v1/rpc/'):
      fn = path.rsplit('/', 1)[1]
      if fn == 'whoami': body = self.whoami
      elif fn == 'state': body = self.whoami.get('trial')
      elif fn in ('next', 'next_day'):
        if self.after_next: self.whoami['trial'] = self.after_next
        body = {'clock': self.whoami['trial']['clock'], 'drafts': 'started make'}
      elif fn == 'claim_advocate': body = ADV['id']
      elif fn == 'team': body = [{'name': 'Kai Teammate', 'email': 'kai@hiphi.test', 'in_trial': False}]
      elif fn == 'add_member': body = ['kai@hiphi.test']
      elif fn == 'week_report': body = [{'bill_number': 'HB1880', 'nickname': 'Flavor ban', 'found': True, 'position_now': 'strongly_support', 'position_then': 'strongly_support'},
                                        {'bill_number': 'SB3245', 'nickname': None, 'found': False, 'position_now': None, 'position_then': 'support'}]
      elif fn == 'my_inbox': body = []
      else: body = None if fn in ('end_trial',) else []
      return route.fulfill(status=200, headers=h, body=json.dumps(body))
    if path.startswith('/rest/v1/advocates'): return route.fulfill(status=200, headers=h, body=json.dumps([ADV]))
    if path.startswith('/rest/v1/'):
      single = 'vnd.pgrst.object' in (r.headers.get('accept') or '')
      return route.fulfill(status=200, headers=h, body='null' if single else '[]')
    if path.startswith('/functions/v1/'): return route.fulfill(status=404, headers=h, body='{}')
    route.fulfill(status=404, headers=h, body='{}')

def open_page(b, fake, w=1440, h=900, hash_=''):
  mobile = w < 768
  ctx = b.new_context(viewport={'width': w, 'height': h}, is_mobile=mobile, has_touch=mobile, reduced_motion='reduce')
  live = []
  ctx.route(lambda u: LIVE in u, lambda r: (live.append(r.request.url), r.abort()))
  ctx.route(HOST + '/**', fake.serve_site)
  ctx.route(PRACTICE + '/**', fake.practice)
  if fake.signed_in:
    ctx.add_init_script(f"try {{ localStorage.setItem('sb-pjbezfxxplirpbdgjrpe-auth-token', {json.dumps(json.dumps(SESSION))}); }} catch (e) {{}}")
  pg = ctx.new_page()
  errs = []
  pg.on('pageerror', lambda e: errs.append(str(e)))
  pg.goto(f'{HOST}/trial.html{hash_}')
  return ctx, pg, errs, live

def shot(pg, name):
  if SHOTS: os.makedirs(SHOTS, exist_ok=True); pg.screenshot(path=os.path.join(SHOTS, name))

with sync_playwright() as pw:
  b = pw.chromium.launch()

  # 1. Not signed in: the front door asks for an email and sends a link from the practice project.
  f = Fake({}, signed_in=False)
  ctx, pg, errs, live = open_page(b, f, 390, 844)
  pg.wait_for_selector('#tr-email', timeout=15000)
  ok('Practise a week of session' in pg.inner_text('h1'), 'signed out: the front door says what a trial is')
  pg.fill('#tr-email', ME['email']); pg.click('#tr-signin button')
  pg.wait_for_selector('text=Check your email', timeout=8000)
  ok(any(p.startswith('/auth/v1/otp') for _, p, _ in f.calls), 'Email me a sign-in link asks the practice project for one')
  shot(pg, 'door-phone.png'); ctx.close()

  # 2. Signed in with an email that is not on the team.
  f = Fake({'email': 'someone@else.test', 'staff': False, 'admin': False, 'name': None, 'trial': None})
  ctx, pg, errs, live = open_page(b, f, 390, 844)
  pg.wait_for_selector('text=Trials are for the HIPHI team', timeout=15000)
  ok(pg.is_visible('#tr-out'), 'not on the team: told so, with Sign out'); ctx.close()

  # 3. Staff, no trial yet: pick a week, hearing week first.
  f = Fake({'email': ME['email'], 'staff': True, 'admin': False, 'name': ME['name'], 'trial': None})
  ctx, pg, errs, live = open_page(b, f, 1280, 800)
  pg.wait_for_selector('#tr-start', timeout=15000)
  weeks = pg.locator('.tr-week').all_inner_texts()
  ok(len(weeks) == 4 and 'Hearing week' in weeks[2], f'the start page offers the four weeks ({len(weeks)})')
  ok(pg.is_checked('.tr-week input[value="3"]'), 'hearing week is picked to begin with')
  shot(pg, 'start-laptop.png'); ctx.close()

  # 4. In a trial, the starter, on a laptop: Staff v6 runs inside the trial's copy, under the band.
  f = Fake({'email': ME['email'], 'staff': True, 'admin': True, 'name': ME['name'], 'trial': state()})
  f.after_next = state(clock='2026-03-16T22:00:00+00:00', next='2026-03-17T01:00:00+00:00')
  ctx, pg, errs, live = open_page(b, f, 1280, 800)
  pg.wait_for_selector('#trialband [data-tr="next"]', timeout=15000)
  pg.wait_for_selector('#app .sv-page, #app main', timeout=20000)
  pg.wait_for_timeout(1500)
  band = pg.inner_text('#trialband')
  ok('trial run' in band.lower() and 'Mon, Mar 16, 9:00 AM' in band, f'the band says the trial day and time ({band[:60]!r})')
  ok(pg.inner_text('[data-tr="next"]') == 'Next: noon', 'Next names the next stop: noon')
  ok(pg.is_visible('[data-tr="skip"]') and 'Tue' in pg.inner_text('[data-tr="skip"]'), 'Skip to Tue is there')
  now = pg.evaluate('new Date().toISOString()')
  ok(now.startswith('2026-03-16T19:0'), f"the app's clock is the trial's ({now})")
  reads = [(p, prof) for m, p, prof in f.calls if p.startswith('/rest/v1/') and '/rpc/' not in p]
  ok(reads and all(prof == 'trial_2' for _, prof in reads), f'every table read goes to the trial copy ({len(reads)} reads)')
  rpcs = [(p, prof) for m, p, prof in f.calls if '/rpc/' in p]
  app_rpcs = [(p, prof) for p, prof in rpcs if p.rsplit('/', 1)[1] in ('claim_advocate', 'my_inbox')]
  ok(app_rpcs and all(prof == 'trial_2' for _, prof in app_rpcs), "the app's own functions run in the trial copy")
  ok(all(prof == 'trial_api' for p, prof in rpcs if p.rsplit('/', 1)[1] in ('whoami', 'state')), 'the trial functions run in trial_api')
  ok(not live, f'nothing reaches the live project ({live[:2]})')
  ok(not errs, f'no page errors ({errs[:2]})')
  geo = pg.evaluate("""() => { const b = document.getElementById('trialband').getBoundingClientRect(), h = document.querySelector('.sv-hdr');
    scrollTo(0, 600); const b2 = document.getElementById('trialband').getBoundingClientRect(), h2 = h && h.getBoundingClientRect(); scrollTo(0, 0);
    const btn = document.querySelector('[data-tr="next"]').getBoundingClientRect();
    return { bh: b.height, top2: b2.top, htop: h2 ? h2.top : null, btn: btn.height }; }""")
  ok(geo['top2'] == 0, 'laptop: the band stays at the top as the page scrolls')
  ok(geo['htop'] is None or abs(geo['htop'] - geo['bh']) < 2, f"laptop: Staff v6's header sits under the band, not behind it ({geo})")
  ok(geo['btn'] >= 44, f"the band's buttons are 44px ({geo['btn']})")
  shot(pg, 'band-laptop.png')
  pg.click('[data-tr="next"]')
  pg.wait_for_function("() => (document.querySelector('#trialband') || {}).innerText?.includes('Mar 16, noon')", timeout=15000)
  ok(any(p.endswith('/rpc/next') for _, p, _ in f.calls), 'Next moves the trial')
  ok('Mon, Mar 16, noon' in pg.inner_text('#trialband'), 'after Next the band says noon')
  # People: the starter adds a teammate by name, and their sign-in link is sent.
  pg.click('[data-tr="menu"]'); pg.wait_for_selector('[data-tr="add"]', timeout=8000)
  pg.click('[data-tr="add"]'); pg.wait_for_selector('text=Added · sign-in link sent', timeout=8000)
  ok(any(p.endswith('/rpc/add_member') for _, p, _ in f.calls), 'Add puts the teammate in the trial')
  shot(pg, 'people-laptop.png'); ctx.close()

  # 5. The week's last stop: the button opens the week's report first.
  f = Fake({'email': ME['email'], 'staff': True, 'admin': False, 'name': ME['name'], 'trial': state(clock='2026-03-21T04:00:00+00:00', next='2026-04-13T19:00:00+00:00', next_day='2026-04-13T19:00:00+00:00', last_stop_of_week=True)})
  ctx, pg, errs, live = open_page(b, f, 390, 844)
  pg.wait_for_selector('[data-tr="report"]', timeout=15000)
  ok(not pg.is_visible('[data-tr="skip"]'), 'at 6 PM there is no Skip (Next already goes to the next day)')
  pg.click('[data-tr="report"]'); pg.wait_for_selector('.tr-rep li', timeout=8000)
  rep = pg.inner_text('dialog.tr-dlg')
  ok('1 of 2' in rep and 'Missed' in rep and 'Go on to the End of session week' in rep, "the week's report shows found and missed, then the next week")
  shot(pg, 'report-phone.png'); ctx.close()

  # 6. A teammate: no Next; when the starter moves the clock the band says so, with Catch up.
  f = Fake({'email': ME['email'], 'staff': True, 'admin': False, 'name': ME['name'], 'trial': state(can_move=False, starter_name='Nate Hix')})
  ctx, pg, errs, live = open_page(b, f, 1280, 800)
  pg.wait_for_selector('#trialband .tr-where', timeout=15000)
  ok(not pg.is_visible('[data-tr="next"]') and 'Nate moves the clock' in pg.inner_text('#trialband'), 'a teammate sees who moves the clock, and no Next')
  f.whoami['trial'] = state(can_move=False, starter_name='Nate Hix', moved_by_name='Nate Hix', clock='2026-03-16T22:00:00+00:00')
  pg.evaluate("document.dispatchEvent(new Event('visibilitychange'))")
  pg.wait_for_selector('[data-tr="catchup"]', timeout=8000)
  ok('Nate moved to noon' in pg.inner_text('#trialband') and 'moves the clock' not in pg.inner_text('#trialband'), 'the band says the starter moved it, with Catch up')
  shot(pg, 'member-laptop.png'); ctx.close()
  # ... and on a phone, where the week's name is dropped, "moves the clock" stays.
  f = Fake({'email': ME['email'], 'staff': True, 'admin': False, 'name': ME['name'], 'trial': state(can_move=False, starter_name='Nate Hix')})
  ctx, pg, errs, live = open_page(b, f, 390, 844)
  pg.wait_for_selector('#trialband .tr-where', timeout=15000)
  ok(pg.is_visible('.tr-who') and 'Nate moves the clock' in pg.inner_text('#trialband'), 'phone: a teammate still sees who moves the clock')
  shot(pg, 'member-phone.png'); ctx.close()

  b.close()

print(f"\n{'FAILED: ' + str(len(fails)) if fails else 'all passed'}")
sys.exit(1 if fails else 0)
