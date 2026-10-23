// Staff v6 (R-336 V28, spec section 6 "Session setup"; admins): Session setup (#/setup, #/setup/<group>, #/setup/<part>).
// v5 had 15 parts in two lists (146 controls, about 16.5 screens of panels), Slack set in 6 of them, the team in one, two
// save models mixed on one page and "Forget this person" in the Save bar (X24). v6:
//   - The place opens on the season checklist ("Ready for session?", or "Running well?" from opening day), then five groups,
//     one page each and none longer than 1.5 screens (spec 8): Before each session · Alerts and messages (every Slack and
//     email setting on one page) · Connections (the keys under a closed "Technical details") · Public page (the embed, the
//     A/B tests, the tester sheet) · Privacy and safety. The checklist and the five groups are the place's page tabs (D12).
//   - The team moved to People (people.js): #/setup/people and #/setup/team open it.
//   - One save model on every page: what is on the page acts the moment it is changed (a switch saves, with Undo); what is
//     typed is changed in a sheet with its own Save (and Undo), and anything typed but not saved comes back next time.
//   - Every setting is a row: its name and its value in one plain line ("Not set up yet: ask Claude to connect it"), with one
//     control. "Forget this person" is a danger button in its own section; its sheet is the confirm.
//   - v5's part addresses (#/setup/email, /alerts, /coalitions, /templates, /privacy, /keys...) open their group at that part,
//     which keeps its v5 name, so links in Slack, Help and people's heads still land (V36, tests/staff6_links.py).
// Every setting v5 had is here (fmap F194-F210); the data calls and their arguments are v5's.
import { S, DB, DEMO, esc, fmtDate, advocate, SUPABASE_URL, SESSION_YEAR, SESSION_OVER, APP_URL, hooks } from './data.js';
import { legislativeDay, diedish, TEMPLATE_KINDS, TOKENS, parseTrackerCsv, billNum, billRoute, teamName } from './model.js';
import { icon, btn, iconBtn, row, switchRow, field, notice, empty, toast, pickerSheet, menuSheet, openSheet, closeSheet, confirmSheet, chip, pickerChip, segmented, skeleton } from './ui.js';
import { placeHead } from './steps.js';
import { qrMatrix, qrSvg, qrPng, printHtml } from './qr.js';
import { copyLink, NAMES as FV_NAMES } from './firstvisit.js';
import { afterClose, iconName } from './lists.js';

// ---- coalition and list icons (copied from app.js: the public page shows Lucide icons, so staff pick a name from
// this short list; old emoji values still display, mapped, until someone saves the coalition again) ----
export const ICON_CHOICES = [['salad', 'Healthy food'], ['apple', 'Apple'], ['bike', 'Active living'], ['utensils', 'Meals'], ['thermometer-sun', 'Heat and climate'],
  ['waves', 'Ocean'], ['sun', 'Sun'], ['leaf', 'Leaf'], ['shield-check', 'Protection'], ['wine-off', 'No alcohol'], ['cigarette-off', 'No tobacco'], ['pill', 'Medicine'],
  ['smile', 'Smile (oral health)'], ['sprout', 'Sprout (farm to school)'], ['school', 'School'], ['baby', 'Keiki'], ['syringe', 'Vaccines'], ['stethoscope', 'Health care'],
  ['heart-pulse', 'Public health'], ['heart-handshake', 'Community care'], ['handshake', 'Partnership'], ['users', 'People'], ['house', 'Housing'], ['megaphone', 'Advocacy']];
export { iconName };   // R-277 fix 15: it lives in lists.js, so the pages that draw coalitions need not load this one

// ---- small shared bits ----
const admins = () => S.advocates.filter(a => a.is_admin && a.is_active !== false).map(a => a.full_name).join(' or ') || 'an admin';
const hhmm = t => { const m = /^(\d{1,2}):(\d{2})/.exec(t || ''); if (!m) return t || ''; const h = +m[1]; return `${h % 12 || 12}:${m[2]} ${h < 12 ? 'AM' : 'PM'}`; };
const plural = (n, one, many) => `${n} ${n === 1 ? one : many || one + 's'}`;
// Server strings (readiness fixes) were written for the old screens and use arrows as path separators.
const tidy = s => String(s || '').replace(/\s*[\u2192>]\s*/g, ', then ').replace(/[\u{1F300}-\u{1FAFF}\u2600-\u27BF]\uFE0F?/gu, '').trim();
const sessionYear = () => SESSION_OVER ? SESSION_YEAR + 1 : SESSION_YEAR;
const inSession = () => !SESSION_OVER && !!legislativeDay();   // R-316 W57: from opening day
const POS_OPTS = [['strongly_support', 'Strongly support'], ['support', 'Support'], ['support_amend', 'Support with amendments'], ['strongly_oppose', 'Strongly oppose'], ['oppose', 'Oppose'], ['neutral', 'Comments'], ['monitor', 'Monitor']];
const TEMPLATE_LABEL = { hearing_alert: 'Hearing alert, one per bill', hearing_rescheduled: 'Hearing moved', hearing_cancelled: 'Hearing cancelled', draft_thread: 'Draft ready, as a thread reply',
  reminder_morning: 'Alert the morning testimony is due', reminder_before: 'Alert hours before it is due', reminder_after: 'Alert after the deadline passed', daily_head: 'Daily list heading', daily_empty: 'Daily list when nothing is coming' };


// ---- the five groups (V28), and where each v5 part lives now ----
// The tabs' words are short so the six fit one row from 768px (the critic: "Privacy and safety" fell to a second line at
// 1024, and a phone took five lines of loose words): Checklist · Each session · Alerts · Connections · Public page · Privacy.
const GROUPS = [['session', 'Each session', 'calendar-days'], ['alerts', 'Alerts', 'bell'], ['connections', 'Connections', 'plug'],
  ['public', 'Public page', 'globe'], ['privacy', 'Privacy', 'shield-check']];
const GROUP = Object.fromEntries(GROUPS.map(([k, t, ic]) => [k, { t, ic }]));
// v5's parts: [group, the element its address lands on]. "alerts", "connections" and "privacy" are both a v5 part and a v6
// group, and the group holds the part under its v5 name ("Hearing alerts", "Privacy and keeping").
const PART = { email: ['alerts', 'ss-email'], templates: ['alerts', 'ss-r-templates'], coalitions: ['session', 'ss-coalitions'], sync: ['session', 'ss-r-days'],
  import: ['session', 'ss-r-load'], committees: ['session', 'ss-r-map'], keys: ['connections', 'ss-keys'], embed: ['public', 'ss-r-embed'], lists: ['privacy', 'ss-lists'] };
// The Public page's own pages: the list of A/B tests, one test, the tester sheet (R-185).
const SUB = { tests: 'Tests', test: 'A test', room: 'Tester sheet' };
const groupOf = key => GROUP[key] ? key : PART[key]?.[0] || (SUB[key] ? 'public' : '');
const TABS = () => [['', '#/setup', 'Checklist'], ...GROUPS.map(([k, t]) => [k, '#/setup/' + k, t])];
const headOf = (view, sub = '') => placeHead('Session setup', { tabs: TABS(), view, sub, id: 'ss-h1' });

// ---- the visit's state: readiness, the keys' status, the tests, what was typed in a sheet and not saved ----
const st = () => S.st2Setup ??= { ready: null, readyErr: '', readyBusy: false, errs: null, errsErr: '', errsBusy: false, secrets: null, secretsBusy: false, logins: null, loginsBusy: false, loginsErr: '',
  teamEmail: null, teamEmailBusy: false, passOpen: false, csv: null, draft: {}, offLists: null, offListsBusy: false, offListsErr: '', arrived: '' };
function loadReady(force) {
  const s = st(); if (s.readyBusy || (s.ready && !force)) return;
  s.readyBusy = true; s.readyErr = '';
  DB.readiness().then(r => { s.ready = r || []; }).catch(e => { s.readyErr = e.message || 'Could not check.'; s.ready = s.ready || null; })
    .finally(() => { s.readyBusy = false; if (S.route?.name === 'setup') hooks.render(); });
}
// The public page's own error reports, the last 7 days (110, R-111). Loads once per visit and with "Check again".
function loadErrors(force) {
  const s = st(); if (s.errsBusy || (s.errs && !force)) return;
  s.errsBusy = true; s.errsErr = '';
  DB.publicErrors().then(r => { s.errs = r || []; }).catch(e => { s.errsErr = e.message || 'Could not load.'; s.errs = s.errs || null; })
    .finally(() => { s.errsBusy = false; if (S.route?.name === 'setup') hooks.render(); });
}
// What the public page reported: the week's total and today's, then the five most frequent errors outside the sandbox.
// Each row is a distinct error (message and screen); its file and line are for Claude, who fixes it.
const hstToday = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Pacific/Honolulu' });
const errWords = m => /fetch|network|load failed|timed? ?out/i.test(m || '') ? 'The page could not reach the tracker’s data'
  : /import|module|chunk|script/i.test(m || '') ? 'The page could not load one of its files'
  : /TypeError|ReferenceError|undefined|null|is not a function/i.test(m || '') ? 'A part of the page stopped working' : 'Something went wrong';
// Privacy (backend 159): the keeping periods and the clean-up's switch, loaded once per visit and after a change.
function loadRetention(force) {
  const s = st(); if (s.retBusy || (s.ret && !force)) return;
  s.retBusy = true; s.retErr = '';
  DB.retentionStatus().then(r => { s.ret = r; }).catch(e => { s.retErr = e.message || 'Could not load.'; s.ret = { kinds: [] }; })
    .finally(() => { s.retBusy = false; if (S.route?.name === 'setup') hooks.render(); });
}
function loadOffLists() {
  const s = st(); if (s.offListsBusy || s.offLists) return;
  s.offListsBusy = true; s.offListsErr = '';
  DB.offLists().then(r => { s.offLists = r || []; }).catch(e => { s.offListsErr = e.message || 'Could not load.'; s.offLists = []; })
    .finally(() => { s.offListsBusy = false; if (S.route?.name === 'setup') hooks.render(); });
}
function loadSecrets(force) {
  const s = st(); if (s.secretsBusy || (s.secrets && !force)) return;
  s.secretsBusy = true;
  DB.secretStatus().then(r => { s.secrets = r || {}; }).catch(() => { s.secrets = s.secrets || {}; })
    .finally(() => { s.secretsBusy = false; if (S.route?.name === 'setup') hooks.render(); });
}

// Who can sign in (Team). Loads once per visit, and again after a link is made or a person is added.
function loadLogins(force) {
  const s = st(); if (s.loginsBusy || (s.logins && !force)) return;
  s.loginsBusy = true; s.loginsErr = '';
  DB.teamLogins().then(r => { s.logins = Object.fromEntries((r || []).map(x => [x.advocate_id, x])); })
    .catch(e => { s.loginsErr = e.message || 'Could not check.'; })
    .finally(() => { s.loginsBusy = false; if (S.route?.name === 'setup') hooks.render(); });
}

// Who the tracker can reach (backend 154, M1-1, M1-3) and the team email switch. Loads with the logins.
// Email to the team (backend 154): a setting on Alerts and messages, read once per visit.
function loadTeamEmail(force) {
  const s = st(); if (s.teamEmailBusy || (s.teamEmail !== null && !force)) return;
  s.teamEmailBusy = true;
  DB.teamEmail().then(v => { s.teamEmail = !!v; }).catch(() => { s.teamEmail = null; }).finally(() => { s.teamEmailBusy = false; if (S.route?.name === 'setup') hooks.render(); });
}

// ---- readiness: every row the server checks, plus the ones the app works out here ----
// Where each problem is fixed: a group of Session setup (at the part), or People. Rows with no page in the app get a plain
// sentence instead (most are Claude's job).
const FIX = { approvers_in: '#/people', advocates_auth: '#/people', team_reach: '#/people', advocates_slack: '#/people', coalition_owners: '#/setup/session?part=coalitions',
  coalition_channels: '#/setup/session?part=coalitions', keywords: '#/setup/session?part=coalitions', slack: '#/setup/connections', calendar: '#/setup/connections',
  email: '#/setup/alerts?part=email', bulk: '#/setup/session?part=import', session_days: '#/setup/session?part=sync', template: '#/setup/alerts?part=templates' };
const FIX_TEXT = {
  deadlines: 'Claude loads the session calendar each December. Ask Claude if this stays red.',
  slots: 'The sync loads committee meeting times. Ask Claude if this stays red.',
  committees: 'The sync loads committees and chairs. Ask Claude if this stays red.',
  advocates_auth: 'Make each person a sign-in link in People and send it to them.',
  approvers_in: 'Send each approver their sign-in link from People and ask them to sign in once: a testimony draft waits on them from the first hearing.',
  committees_next: 'The sync loads the new session’s committees and chairs once the Legislature names them (December or January, after the 3 November election). Ask Claude to check after 1 December.',
  advocates_slack: 'Press Check who Slack can reach in People. Anyone still not found needs their Slack profile on their hiphi.org email.',
  team_reach: 'Press Check who Slack can reach in People. Anyone still not found needs their Slack profile on their hiphi.org email, or turn on Email to the team.',
  breakglass: 'Make a second admin in People, or keep a sealed admin login in HIPHI’s password manager and try it every 90 days. The steps are in the break-glass guide Claude wrote (docs/BREAK-GLASS.md).',
  coalition_owners: 'Give each coalition an owner.', coalition_channels: 'Give each coalition a Slack channel.', keywords: 'Add keywords so new bills get suggested.',
  slack: 'Save the Slack bot token.', calendar: 'Save the Google keys, then connect the calendar.',
  outbox: 'Messages are waiting to go out. Ask Claude to check the notify-send function.',
  sync: 'The last sync failed or is more than 8 hours old. Ask Claude to check it.',
  bulk: 'Load the session from Open States.',
  watermark: 'Open States has not moved forward in 12 hours. Ask Claude to check the sync.',
  session_days: 'Enter opening day, sine die and each recess day.',
  template: 'Open the testimony template Doc and check it uses every token listed in Message wording.',
};
// The server's people checks list initials, which are codes ("12 without an account: JM, JN, JS..."). Said here with first
// names and People's words, so the Fix lands on rows that say the same (V6-SPEC 7.12, C-15).
const firstOfIni = ini => { const a = S.advocates.find(x => String(x.initials || '').toUpperCase() === ini.trim().toUpperCase()); return a ? String(a.full_name || '').split(/\s+/)[0] : ini.trim(); };
function peopleWords(r) {
  const m = /^(\d+) (?:without an account|not matched yet): (.+)$/.exec(r.detail || '');
  if (r.key === 'advocates_auth') {
    if (r.ok) return 'Everyone has a sign-in';
    if (m) { const ns = m[2].split(/,\s*/).filter(Boolean).map(firstOfIni).sort((a, b) => a.localeCompare(b)); return `${ns.length === 1 ? '1 person has' : `${ns.length} people have`} no sign-in yet: ${andList(ns)}`; }
  }
  if (r.key === 'advocates_slack' && m) { const ns = m[2].split(/,\s*/).filter(Boolean).map(firstOfIni).sort((a, b) => a.localeCompare(b)); return `Slack has not found ${andList(ns)} yet`; }
  return r.detail;
}
function readyRows() {
  const s = st(); if (!s.ready) return null;
  const rows = s.ready.map(r => ({ ...r, detail: peopleWords(r) }));
  // The server and the settings describe the same switch; settings are what this page edits, so they win.
  const em = rows.find(r => r.key === 'email'); if (em) em.detail = (S.emailCfg || {}).enabled === false ? 'Paused. Nothing is sent.' : 'On.';
  const gaps = S.bills.filter(b => b.tracked !== false && ['strongly_support', 'strongly_oppose'].includes(b.position) && !diedish(b) && (!(b.public_summary || '').trim() || !(b.public_action || '').trim()));
  rows.push({ key: 'public_copy', level: 'warn', label: 'Public page copy on the bills we push hardest', ok: !gaps.length, gaps,
    detail: gaps.length ? `${plural(gaps.length, 'strongly supported or opposed bill')} without a one-line summary or an ask. Without an ask, the public page asks people to act on the next hearing in its own words; without a summary it shows the official title.` : 'Every strongly supported or opposed bill has a summary and an ask.' });
  // Two checks the server cannot make (R-152 D). Everyone who gives an approval has to be able to: a first testimony waits on a
  // second approval that only two people can give, and neither could sign in. And once this session has ended, the next one's
  // committees and chairs must be loaded: the chairs change after the November election, and "Committees and chairs current"
  // only says the old ones are there.
  const L = st().logins;
  if (L) {
    const who = S.advocates.filter(a => a.is_active !== false && (a.is_admin || a.can_approve || a.is_reviewer)), out = who.filter(a => !L[a.id]?.last_sign_in_at);
    rows.push({ key: 'approvers_in', level: 'warn', label: 'Everyone who approves testimony has signed in once', ok: !out.length,
      detail: out.length ? `${out.map(a => (a.full_name || '').split(' ')[0]).join(', ')} ${out.length === 1 ? 'has' : 'have'} not signed in yet` : `${plural(who.length, 'approver')}, all signed in` });
  }
  if (SESSION_OVER) {
    const nx = SESSION_YEAR + 1, n = (S.committeeMembers || []).filter(m => +m.session_year === nx).length, jan = new Date().toLocaleDateString('en-CA', { timeZone: 'Pacific/Honolulu' }) >= `${nx}-01-01`;
    rows.push({ key: 'committees_next', level: jan ? 'block' : 'warn', label: `${nx} committees and chairs loaded`, ok: n >= 100,
      detail: n >= 100 ? `${n} members on ${nx} committees` : `${n ? n + ' members so far' : 'none yet'}; the chairs are named after the November election` });
  }
  // A session-start step the server dates ("expected" from a day in December or January): before that day it is not a problem,
  // only a thing coming, so it shows as "Expected from <date>", ranks last among the open rows and is left out of the counts (Z1-6).
  const hi = new Date().toLocaleDateString('en-CA', { timeZone: 'Pacific/Honolulu' });
  for (const r of rows) if (r.expected && r.ok !== true && hi < String(r.expected).slice(0, 10)) r.waiting = true;
  const rank = r => r.ok === true ? 6 : r.waiting ? 4 : r.level === 'block' ? 0 : r.level === 'warn' ? 1 : r.level === 'manual' ? 2 : 3;
  return rows.sort((a, b) => rank(a) - rank(b));
}

// ---- each part's one-line status, shown on the index and at the top of its page ----
function status(key) {
  const cfg = S.slackCfg || {}, sec = st().secrets;
  switch (key) {
    case 'team': { const act = S.advocates.filter(a => a.is_active !== false), L = st().logins, n = plural(act.length, 'person', 'people');
      if (!L) return n; const out = act.filter(a => !L[a.id]?.last_sign_in_at).length;
      return `${n} · ${out ? `${out} not signed in yet` : 'everyone has signed in'}`; }
    case 'email': return (S.emailCfg || {}).enabled === false ? 'Paused. Nothing is sent.' : 'On';
    case 'alerts': { const d = cfg.daily || {}; return cfg.main_channel ? `Posts to ${cfg.main_channel} for ${plural((cfg.positions || []).length, 'position')}${d.enabled !== false ? ` · daily list at ${hhmm(d.time || '07:00')}` : ''}` : 'No main channel yet'; }
    case 'coalitions': { const n = S.campaigns.length, own = S.campaigns.filter(c => !c.owner_id).length, kw = S.campaigns.filter(c => !(c.keywords || []).length).length;
      // R-316 W28 (fresh-eyes): a coalition whose owner is turned off needs a new one too, so it is counted, apart from those
      // with none: "2 without an owner, 1 owner turned off" (Slipping and the coalition's page say the same).
      const off = S.campaigns.filter(c => c.owner_id && advocate(c.owner_id)?.is_active === false).length;
      const owners = [own ? `${own} without an owner` : '', off ? `${off} ${off === 1 ? 'owner' : 'owners'} turned off` : ''].filter(Boolean).join(', ');
      return [plural(n, 'coalition'), owners, kw ? `${kw} without keywords` : ''].filter(Boolean).join(' · '); }
    case 'sync': { const ld = legislativeDay(), yr = sessionYear(), cal = (S.sessionCal || []).find(c => c.session_year === yr), b = (S.syncCfg || {}).burst_until;
      return `${ld ? ld.text : cal?.opening_day ? `${yr} session days entered` : `${yr} session days not entered`} · ${b && b >= new Date().toISOString().slice(0, 10) ? `4 more syncs a day until ${fmtDate(b)}` : 'syncs 4 times a day'}`; }
    case 'import': return 'Load the session, or replace the tracked list';
    case 'connections': return sec ? `Slack ${sec.slack_bot_token ? 'connected' : 'not connected'} · Calendar ${sec.google_calendar_refresh_token ? ((S.calCfg || {}).calendar_id ? 'connected' : 'not working yet') : 'not connected'} · YouTube ${sec.youtube_api_key ? 'key set' : 'feed only'}` : 'Slack, Google Calendar and YouTube';
    case 'embed': return 'A table of our public bills for hiphi.org';
    case 'tests': { const T = st().ab?.tests; return T ? `${T.filter(t => t.is_on).length} of ${plural(T.length, 'test')} on the public page` : 'The public page’s A/B tests'; }
    case 'templates': return `${TEMPLATE_KINDS.length} Slack messages`;
    case 'committees': return `${plural((S.counterparts || []).length, 'House and Senate pair')}`;
    case 'keys': { if (!sec) return 'Slack, Google and YouTube keys'; const n = ['slack_bot_token', 'google_oauth_client_id', 'google_oauth_client_secret', 'youtube_api_key'].filter(k => sec[k]).length; return `${n} of 4 keys set`; }
    default: return '';
  }
}

// Closing a sheet steps history back, and that Back lands after anything pushed in the same tick; so leave a sheet
// first and navigate once its Back has happened (S.go straight from a sheet ends up back on this page).
function goAfterSheet(href) {
  addEventListener('popstate', () => setTimeout(() => S.go(href)), { once: true });
  closeSheet();
}

// ---- sub-pages. Each returns { body, save?, saveLabel?, wire? } ----
const txt = (id, label, value, { ph = '', help = '', type = 'text', attrs = '' } = {}) => field(id, label, `<input id="${id}" type="${type}" value="${esc(value ?? '')}" placeholder="${esc(ph)}" autocomplete="off"${help ? ` aria-describedby="${id}-help"` : ''} ${attrs}>`, help);
const area = (id, label, value, { rows = 4, ph = '', help = '', attrs = '' } = {}) => field(id, label, `<textarea id="${id}" rows="${rows}" placeholder="${esc(ph)}"${help ? ` aria-describedby="${id}-help"` : ''} ${attrs}>${esc(value ?? '')}</textarea>`, help);
const val = (root, id) => (root.querySelector('#' + id)?.value || '').trim();
const fieldErr = (root, id, msg) => { const el = root.querySelector('#' + id); if (!el) return toast(msg, { err: true }); el.setAttribute('aria-invalid', 'true'); el.closest('.field')?.querySelector('.err')?.remove(); el.insertAdjacentHTML('afterend', `<span class="err" id="${id}-err">${icon('circle-alert')}${esc(msg)}</span>`); el.setAttribute('aria-describedby', id + '-err'); el.focus(); };
const clearErrs = root => root.querySelectorAll('.st-form .err').forEach(e => { const f = e.closest('.field'); f?.querySelector('[aria-invalid]')?.removeAttribute('aria-invalid'); e.remove(); });

// ---- Tests: the public page's A/B tests (migration 116, R-135; ../backend/docs/AB-TESTS-PLAN.md) ----
// A person comes here to decide each A/B test of the public page: keep it running, stop it, or pick its winner (B-1).
// Nate 10/3: "turned on or off by me in my staff settings", "by default at random", "each different test should easily be
// tracked by effectiveness". One card per test: its switch (on: each new visitor gets A or B at random and keeps it;
// off: everyone gets one, today's unless a winner was picked), its numbers, one sentence on whether to trust the
// difference, then its table (A-20; R-135): one row per version, with its See link into the practice copy (a new tab, the
// same screen for each) and its Pick button on the same row (the fresh-eyes review, 10/10: each version's full name is said
// once in its row, the buttons say the short name). A switch saves the moment it is flipped, with Undo, like every switch
// here; turning on a test with a note (the email ask, waiting on a lawyer) asks first.
function loadAb(force) {
  const s = st(); if (s.abBusy || (s.ab && !force)) return;
  s.abBusy = true; s.abErr = '';
  // The share picture's counts by ask (R-183, backend 155): a version that fits only some asks is compared on the asks it shares.
  Promise.all([DB.abTests(), DB.abResults(), DB.abResultsByAsk().catch(() => [])]).then(([tests, res, byAsk]) => { s.ab = { tests: tests || [], res: res || [], byAsk: byAsk || [] }; })
    .catch(e => { s.abErr = e.message || 'Could not load.'; })
    .finally(() => { s.abBusy = false; if (S.route?.name === 'setup') hooks.render(); });
}
// The share picture's versions go by Nate's numbers (R-183: "3, the letter itself"), "T" for today's and "I" for the issue
// up front; the names carry the number already, so it is not said twice.
const PIC_CODE = { today: 'T', issue: 'I', sign: '1', calendar: '2', letter: '3', text: '4', neighbors: '5', islands: '6', before: '7', here: '8', ticket: '9', crowd: '10', stand: '11', postcard: '12' };
// R-201 (Nate 10/7: "hard to know which design I'm comparing"): plain names only, so "The week view (September’s version A)"
// reads "The week view"; the database keeps its words.
const armName = (t, a) => { const n = ((t.arm_names || {})[a] || a).replace(/\s*\((?:[^()]*’s )?version [A-Z]\)/, ''); return t.key === 'pic' ? n.replace(/^\d+ · /, '') : n; };
// A, B, ... by the version's place (the first is today's). The first-visit test has six (backend 136, R-164).
const AB = (t, a) => t.key === 'pic' ? PIC_CODE[a] || '?' : 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[t.arms.indexOf(a)] || '?';
// The versions new visitors are spread over while a test is on: all of a two-version test, the switched-on ones of a
// longer one (ab_tests.arms_on).
const armsOnOf = t => t.arms.length > 2 && Array.isArray(t.arms_on) && t.arms_on.length ? t.arms_on : t.arms;
// The versions live now (R-192, Nate 10/6: "pick that only option A is running, or only option B, or option C, or all of
// the above, or a combination"): two or more switched on, the test runs and new visitors are spread over them at random;
// one, everyone gets it and nothing is counted. The database keeps one as "off" with that version as its fallback (log_ab
// counts only while a test is on), so a page holding last visit's switches (pub/variant.js) reads it the same way.
const liveOf = t => t.is_on ? armsOnOf(t).filter(a => t.arms.includes(a)) : [t.arms.includes(t.fallback) ? t.fallback : t.arms[0]];
const livePatch = (t, on) => on.length >= 2 ? { is_on: true, arms_on: on.length === t.arms.length ? null : on, winner: null }
  : { is_on: false, fallback: on[0], arms_on: t.arms.length > 2 ? on : null };
const andList = xs => xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;
// The first-visit test says "today's" and "Plan 2", not its letters: B is Plan 1 there, and Nate thinks in plan numbers
// (the fresh-eyes review, 10/6, P-4).
// R-201: the other tests say a version by its name in quotes, not a letter (the letters differed by test and nothing on the
// page said which was which).
const vName = (t, a) => a === t.arms[0] ? 'today’s' : t.key === 'onb' ? armName(t, a).split(':')[0]
  : t.key === 'pic' ? (a === 'issue' ? 'the issue picture' : `picture ${AB(t, a)}`) : `“${armName(t, a)}”`;
const cap = x => x.replace(/^(“?)(.)/, (m, q, c) => q + c.toUpperCase());
// A version as the first words of a sentence: "Today’s version", "Plan 2", "“Starts with the deadline”".
const vSubj = (t, a) => a === t.arms[0] ? 'Today’s version' : cap(vName(t, a));
const vNamed = (t, a) => /^“/.test(vName(t, a)) ? vName(t, a) : `${vName(t, a)}, “${armName(t, a)}”`;
const liveLine = (t, on) => on.length >= 2 ? `Running: ${esc(on.length === 2 ? `${vName(t, on[0])} against ${vName(t, on[1])}` : andList(on.map(a => vName(t, a))))}. Each new visitor gets one of them at random.`
  : `Not testing: everyone sees ${esc(vNamed(t, on[0]))}. Switch on another version to test it.`;
// A version whose consent words differ from today's waits on a lawyer before the public sees it (R-149): the email ask
// after an action, and the five first-visit plans' sign-up.
const lawyerFor = (t, on) => (t.key === 'email' && on.includes('after')) || (t.key === 'onb' && on.some(a => a !== 'today'));
// Held for the lawyer (the plan's answer 3, R-149): a test that has never run and is off, while one of its versions changes
// the consent words. Its Pick would give every visitor that version at once, so its card offers none. It stops being held
// once it is switched on (Nate's switch, after the lawyer's check); a test that has run can be picked as before.
const heldForLawyer = t => !t.is_on && !t.started && t.arms.some(a => lawyerFor(t, [a]));
const pct = (n, d) => d ? `${Math.round(100 * n / d)}%` : '–';
// Where each version can be seen in the practice copy (R-135, R-187): every version has its own link, in a new tab, and
// the links of one test open the same screen, forced to their version, so they compare. [address, what to tap there to
// meet the difference, the screen's hash]. Every link is a fresh practice visit (&restart). Home and the calm Home open on
// Home with three issues followed: #/follow (pub/app.js) follows them and skips the first visit, so no visitor is picked
// on compare.html. The three are the practice copy's own issues with hearings this week (demo/snapshot.json).
const HOME_SCENE = '#/follow/safer-walking-near-schools,forgive-medical-debt,disposable-e-cigarette-ban';
const SEE = {
  end: ['track.html?demo=1&restart&ab=end.', 'Both open on a bill’s story, the last part before the end. Go through it: its last button is the difference. One goes on to “Coming up on your issues” and ends on “You’re all set”, the other says “See How I Can Help” and goes straight to Home (R-293).', '#/start/4'],
  fv: ['track.html?demo=1&restart&ab=fv.', 'Both open on the first visit’s second part: a bill’s story, or one page.', '#/start/4'],
  email: ['track.html?demo=1&restart&ab=email.', 'Both open at the first visit’s start. Pick a topic, press Next, then Follow: the first version asks for a text or email next, on “Save your profile”; the other says “Mahalo!” and goes on without asking.', '#/start/1'],
  onb: ['track.html?demo=1&restart&ab=onb.', 'Both open at the start of a first visit, in that version. Each plan has its own screens after the first.', '#/start/1'],
  join: ['track.html?demo=1&restart&ab=onb.p1,join.', 'Both open on Plan 1’s alerts sign-up. The difference is how the ask is put: an example text is shown in one, “we watch, you speak” in the other.', '#/start/5'],
  save: ['track.html?demo=1&restart&via=share&ab=save.', 'Both open on an issue, as a newcomer from a shared link. Press Follow: the difference is what comes right after (R-184).', '#/issue/fda-proof-to-sell-e-cigarettes'],
  rank: ['track.html?demo=1&restart&ab=rank.', 'Both open on Free school bus passes (HB 1780). Write practice testimony and say you sent it: the card after it is the difference.', '#/bill/HB1780'],
  share: ['track.html?demo=1&restart&ab=share.', 'Both open on Free school bus passes (HB 1780). Press Share: the message it makes is the difference.', '#/bill/HB1780'],
  home: ['track.html?demo=1&restart&ab=home.', 'Both open on Home with three issues followed. The difference is the top: one lists the soonest deadline first, the other groups it by topic.', HOME_SCENE],
  layout: ['track.html?demo=1&restart&ab=layout.', 'Each opens on Home with three issues followed. The difference is Home: the calm one (everyone’s since 11 Oct) shows one thing to do, then the issues by where they stand; the one before shows everything at once; the week view (from September) shows the week day by day (R-222).', HOME_SCENE],
  act: ['track.html?demo=1&restart&ab=act.', 'Both open at the first visit’s start. Pick a topic, press Next, then Follow, and go on to the page before the end: “Coming up on your issues” in one version, three ways to help in the other (R-150).', '#/start/1'],
  pic: ['track.html?demo=1&restart&ab=pic.', 'Both open on Free school bus passes (HB 1780). Press Share: the link it makes carries that picture; text it to yourself to see it as a friend does.', '#/bill/HB1780'],
};
// &abrest=today: every test the link does not name stays at today's version, whatever the switches (R-192), so each link
// shows only its own test's difference.
const seeUrl = (t, a) => `${APP_URL}${(SEE[t.key]?.[0] || 'track.html?demo=1&restart&ab=' + t.key + '.').replace(/^track\.html\?demo=1/, 'track.html?demo=1&abrest=today')}${a}${SEE[t.key]?.[2] || ''}`;
// "Trust it" (R-121; Nate 10/3, the plan's question 5): a two-proportion test on the measure (the share test: friends
// per share, a rate), only from 100 per version, at 99% while more than one test is on (95% for one). A real difference
// of 10 points shows at about 600 per version at 99% (400 at 95%); short of that, "no difference" is "no difference yet".
function zOf(t, a, b) {
  const p1 = a.goal / a.seen, p2 = b.goal / b.seen, p = (a.goal + b.goal) / (a.seen + b.seen);
  const se = t.rate ? Math.sqrt(a.goal / a.seen ** 2 + b.goal / b.seen ** 2) : Math.sqrt(p * (1 - p) * (1 / a.seen + 1 / b.seen));
  return { z: se ? (p1 - p2) / se : 0, p1, p2 };
}
function abVerdict(t, a, b, bar) {
  const unit = t.rate ? 'shares' : 'people', show = x => t.rate ? `${Math.round(100 * x.goal / x.seen)} per 100 shares` : pct(x.goal, x.seen);
  if (!a.seen && !b.seen) return ['hourglass', t.is_on ? 'Nobody has met this test yet. The numbers fill as people arrive, most from January.' : 'Not testing, so nothing is counted.'];
  if (a.seen < 100 || b.seen < 100) return ['hourglass', `Not enough ${unit} yet to trust a difference: ${a.seen} and ${b.seen}, and each version needs 100.`];
  const r = zOf(t, a, b), win = r.p1 >= r.p2 ? a : b, lose = win === a ? b : a;
  if (Math.abs(r.z) >= bar.z) return ['circle-check', `<b>Trust it:</b> ${esc(vSubj(t, win.arm))} does better on “${esc(t.measure.toLowerCase())}” (${show(win)} against ${show(lose)}), beyond what chance would do (${bar.pct}%).${t.winner ? '' : ' Pick it, and the other version is removed within a week.'}`, win.arm];
  const big = bar.pct === 99 ? 600 : 400;
  if (a.seen < big || b.seen < big) return ['scale', `No clear difference yet (${show(a)} against ${show(b)}). ${t.is_on ? 'Keep it running: a' : 'Not testing now, so these stay as they are. While testing, a'} real difference of 10 points shows at about ${big} ${unit} per version.`];
  return ['scale', `No real difference (${show(a)} against ${show(b)}, from ${a.seen} and ${b.seen} ${unit}). Either will do: pick on other grounds, or keep today’s.`];
}
const abBar = tests => tests.filter(t => t.is_on).length > 1 ? { z: 2.576, pct: 99 } : { z: 1.96, pct: 95 };
// A test's numbers and verdict, worked out once for its card, the page's order and the status line. ready: trusted and
// not yet picked. never: never switched on and nobody has met it, so there is nothing to show but the switch (A-14).
function abState(t, res, bar) {
  const rows = res.filter(r => r.test === t.key), get = a => rows.find(r => r.arm === a && !r.forced) || { arm: a, seen: 0, goal: 0, goal2: 0 };
  const all = t.arms.map(get), [a] = all;
  // Two versions: A against B. More (the first-visit test): today's (A) against the version doing best among those that
  // are on or have numbers, so the verdict still names one comparison a person can act on.
  const rate = r => r.seen ? r.goal / r.seen : -1;
  const b = all.length === 2 ? all[1] : all.slice(1).filter(r => r.seen || armsOnOf(t).includes(r.arm)).sort((x, y) => rate(y) - rate(x))[0] || all[1];
  const v = abVerdict(t, a, b, bar);
  return { a, b, all, v, forced: rows.filter(r => r.forced && r.seen), ready: !!v[2] && !t.winner, never: !t.started && all.every(r => !r.seen) };
}
// The share picture's numbers by ask (R-183): a picture that only fits some asks (the calendar needs a date, the ticket a
// hearing) is compared with the others on the asks they share, so each ask has its own small table.
const ASK_NAMES = { testify: 'Testimony', ask: 'Asking for a hearing', floor: 'A floor vote', conference: 'The final version', governor: 'The Governor', follow: 'Following the issue' };
function picByAsk(t, rows) {
  const by = {}; for (const r of rows.filter(r => r.test === 'pic' && !r.forced && r.grp && r.seen)) (by[r.grp] ??= []).push(r);
  const asks = Object.keys(ASK_NAMES).filter(k => by[k]); if (!asks.length) return '';
  return `<details class="ab-byask"><summary class="small">The same numbers by ask</summary>${asks.map(k => `<table class="fv-vtable ab-table"><caption class="small">${esc(ASK_NAMES[k])}</caption>
    <thead><tr><th scope="col">Version</th><th scope="col" class="num">Shares</th><th scope="col" class="num">Tapped per 100</th><th scope="col" class="num">Acted per 100</th></tr></thead>
    <tbody>${by[k].sort((p, q) => t.arms.indexOf(p.arm) - t.arms.indexOf(q.arm)).map(r => `<tr><th scope="row"><span class="ab-v" aria-hidden="true">${AB(t, r.arm)}</span>${esc(armName(t, r.arm))}</th><td class="num">${r.seen}</td><td class="num">${Math.round(100 * r.goal / r.seen)}</td><td class="num">${Math.round(100 * r.goal2 / r.seen)}</td></tr>`).join('')}</tbody></table>`).join('')}</details>`;
}
// ---- R-201: the list, one line per test, and each test on its own page with its versions side by side as pictures ----
// Nate 10/7: "It's hard to find which test I want to turn on and off and it's hard to know which design I'm comparing.
// Can the improved version have screenshots easily accessible so it's easy to compare the multiple options?" The list
// keeps one order, by where on the tracker a test shows (his answer 10/10: grouped by place), so a test is in the same
// place on every visit; its state is a word on its line, and the filter finds the running ones or those ready to decide.
const PLACES = [['The first visit', ['onb', 'fv', 'email', 'join', 'act', 'end']], ['Home', ['layout', 'home', 'rank']],
  ['An issue', ['save']], ['Sharing', ['share', 'pic']]];
// The pictures (tools/test_shots.py, R-201 part 1): phone screenshots of each version in the practice copy, retaken by the
// public repo's checks whenever a version's screen changes. shots/shots.json: {tests: {key: {arms: {arm: [{file, title,
// date}]}}}}; a path (the first visit's tests) has up to four screens, compared screen by screen.
function loadShots() {
  const s = st(); if (s.shots !== undefined || s.shotsBusy) return;
  s.shotsBusy = true;
  fetch('shots/shots.json', { cache: 'no-cache' }).then(r => r.ok ? r.json() : null).catch(() => null)
    .then(j => { s.shots = j?.tests || null; s.shotsBusy = false; if (S.route?.name === 'setup') hooks.render(); });
}
const shotsOf = (t, a) => st().shots?.[t.key]?.arms?.[a] || [];
const shotSrc = p => `shots/${p.file}${p.date ? `?d=${p.date}` : ''}`;
const stepsOf = t => Math.max(1, ...t.arms.map(a => shotsOf(t, a).length));
const stepOf = t => Math.min(st().abStep?.[t.key] || 0, stepsOf(t) - 1);
// A test's state in a word, for its line on the list, its page and the filter (A-13: what needs Nate is said first).
const abWord = (t, x) => x.ready ? ['ready', 'Ready to decide', 'ok', 'circle-check'] : t.is_on ? ['running', 'Running', 'info', 'play']
  : t.winner ? ['off', 'Picked', '', 'trophy'] : ['off', 'Off', '', ''];
const abSub = t => { const live = liveOf(t);
  return t.is_on ? `${live.length} versions, at random` : t.winner ? `Everyone sees ${vName(t, t.winner)}` : `Everyone sees ${vName(t, live[0])}`; };
const abTestOf = () => st().ab?.tests.find(t => t.key === S.route?.q?.t);
// One line of the list: a small picture of the difference (the first other version's first screen), the name, the state.
function abRow(t, x) {
  const [, word, tone, ic] = abWord(t, x), p = shotsOf(t, t.arms[1])[0] || shotsOf(t, t.arms[0])[0];
  return `<li><a class="ab-row" href="#/setup/test?t=${encodeURIComponent(t.key)}" data-abrow="${esc(t.key)}">
    <span class="ab-thumb" aria-hidden="true">${p ? `<img src="${esc(shotSrc(p))}" alt="" loading="lazy" decoding="async">` : icon('flask-conical')}</span>
    <span class="ab-rbody"><span class="ab-rt">${esc(t.name)}</span><span class="ab-rs">${chip(word, tone, ic || undefined)}<span class="small muted">${esc(abSub(t))}</span></span></span>
    ${icon('chevron-right')}</a></li>`;
}
function abList(cards, filt) {
  const keep = c => filt === 'running' ? c.t.is_on : filt === 'off' ? !c.t.is_on : filt === 'ready' ? c.x.ready : true;
  const placed = PLACES.flatMap(([, ks]) => ks), groups = [...PLACES.map(([l, ks]) => [l, ks.map(k => cards.find(c => c.t.key === k)).filter(Boolean)]),
    ['Other', cards.filter(c => !placed.includes(c.t.key)).sort((p, q) => (p.t.sort ?? 99) - (q.t.sort ?? 99))]];
  const shown = groups.map(([l, cs]) => [l, cs.filter(keep)]).filter(([, cs]) => cs.length);
  if (!shown.length) return `<p class="small muted ab-none">${filt === 'ready' ? 'No test is ready to decide yet: a test is ready once its numbers say “Trust it”.' : filt === 'running' ? 'No test is running.' : 'Every test is running.'}</p>`;
  return shown.map(([l, cs], i) => `<section class="ab-group" aria-labelledby="ab-g${i}"><h2 class="ab-gt" id="ab-g${i}">${esc(l)}</h2>
    <ul class="ab-rows" role="list">${cs.map(c => abRow(c.t, c.x)).join('')}</ul></section>`).join('');
}
// A test's page: its versions side by side, today's first, each with its picture, its switch, its numbers and its buttons
// (the plan's step 2). A path's versions are compared screen by screen: one choice of screen moves every picture at once.
function abCard(t, x) {
  const { v, all } = x, live = liveOf(t), trusted = v[2];
  const m = (r, k) => t.rate ? (r.seen ? String(Math.round(100 * r[k] / r.seen)) : '–') : pct(r[k], r.seen);
  // Who can be picked: nobody while the test is held for the lawyer, and nobody before anyone has met it (A-14: there is
  // nothing to pick from yet). The words under the versions say which.
  const held = heldForLawyer(t), noVisitors = all.every(r => !r.seen), canPick = !held && !noVisitors;
  const steps = stepsOf(t), step = stepOf(t), wide = t.key === 'pic';
  const nums = r => x.never ? '<span></span>' : `<p class="small ab-nums"><span><b>${r.seen}</b> ${t.rate ? 'shares' : 'visitors'}</span><span><b>${m(r, 'goal')}</b> ${esc(t.measure.toLowerCase())}</span><span><b>${m(r, 'goal2')}</b> ${esc(t.measure2.toLowerCase())}</span></p>`;
  const col = r => { const a = r.arm, ps = shotsOf(t, a), p = ps[step], full = armName(t, a), on = live.includes(a);
    const pic = p ? `<div class="ab-pic"><button type="button" class="ab-shot" data-abshot="${esc(a)}" aria-label="${esc(`See it larger: ${full}${p.title ? `, “${p.title}”` : ''}`)}"><img src="${esc(shotSrc(p))}" alt="" loading="lazy" decoding="async"></button>${p.title && !wide ? `<span class="small muted ab-cap">${esc(p.title)}</span>` : ''}</div>`
      : `<div class="ab-noshot small muted">${ps.length ? `This version has ${ps.length === 1 ? 'one screen' : `${ps.length} screens`} here.` : 'No picture yet. Try it to see it.'}</div>`;
    return `<li class="ab-ver${on ? ' on' : ''}">
      <div class="ab-vhead"><h3 class="ab-vt">${a === t.arms[0] ? '<span class="ab-today">Today’s</span>' : ''}${esc(full)}</h3>${a === trusted ? chip('Does better', 'ok', 'circle-check') : t.winner === a ? chip('Picked', 'ok', 'trophy') : ''}</div>
      ${pic}
      ${switchRow(`ab-arm-${t.key}-${a}`, `<span class="sr">${esc(full)}: </span>Visitors see it`, on, '', { 'data-abarm-on': `${t.key}|${a}` })}
      ${nums(r)}
      <div class="ab-vacts">${btn('Try it', { kind: 'text', sm: true, icon: 'external-link', href: seeUrl(t, a), target: '_blank', attrs: { 'data-absee': `${t.key}|${a}`, 'aria-label': `Try ${full} in the practice copy (in a new tab)` } })}${canPick ? btn('Pick', { kind: a === trusted ? 'primary' : 'secondary', sm: true, icon: 'trophy', attrs: { 'data-abpick': t.key, 'data-abarm': a, 'aria-label': `Pick ${full}: everyone gets it` } }) : ''}</div>
    </li>`; };
  const stepper = steps > 1 ? `<div class="ab-steps"><span class="small muted">Screen</span>${segmented(`abstep`, [...Array(steps).keys()].map(i => [String(i), String(i + 1)]), String(step), 'Screen, in order')}</div>` : '';
  const dated = t.arms.flatMap(a => shotsOf(t, a)).map(p => p.date).filter(Boolean).sort().pop();
  const lawyer = lawyerFor(t, live) && !(t.note && !t.is_on) ? notice('warn', 'scale', 'A lawyer should check the consent words of the versions switched on before the public sees them (R-149).') : '';
  const verdict = x.never ? '' : x.ready ? notice('ok', 'circle-check', `<span>${v[1]}</span>`) : `<p class="small ab-verdict">${icon(v[0])}<span>${v[1]}</span></p>`;
  const why = canPick ? '' : `<p class="small ab-verdict ab-why">${icon(held ? 'scale' : 'hourglass')}<span>${held ? 'Waits for the lawyer’s check' : 'Pick once people have seen it'}</span></p>`;
  const forced = x.forced.length ? `<p class="small muted">Not counted: ${x.forced.map(r => `${r.seen} ${r.seen === 1 ? 'visit' : 'visits'} to ${esc(vName(t, r.arm))}`).join(' and ')} from testers’ links.</p>` : '';
  const more = t.key === 'pic' ? `<div class="ab-more">${btn('Every picture on real bills', { kind: 'text', sm: true, icon: 'external-link', href: `${APP_URL}share-pics.html` })}</div>` : '';
  return `<section class="ab-card${x.ready ? ' ab-ready' : ''}" data-abtest="${esc(t.key)}">
    <p class="ab-q">${esc(t.question)}</p>
    ${t.note && !t.is_on ? notice('warn', 'info', esc(t.note)) : ''}${lawyer}
    ${verdict}
    <fieldset class="ab-arms ab-gal"><legend class="small ab-live">${liveLine(t, live)}</legend>
      ${stepper}
      <ul class="ab-vers${wide ? ' wide' : ''}" style="--n:${all.length}" role="list" aria-label="The versions, today’s first">${all.map(col).join('')}</ul>
    </fieldset>
    ${why}
    <p class="small muted ab-hint">${esc(SEE[t.key]?.[1] || '')}${dated ? ` Pictures from the practice copy, ${esc(fmtDate(dated))}.` : ''}</p>${more}
    ${t.key === 'pic' && !x.never ? picByAsk(t, st().ab?.byAsk || []) : ''}
    ${forced}
    ${x.never ? '' : `<p class="small muted ab-foot">${t.started ? `Counting since ${esc(fmtDate(t.started))}.` : ''}${t.changed_at ? ` Last changed ${esc(fmtDate(t.changed_at))}${t.changed_by ? ` by ${esc(t.changed_by)}` : ''}.` : ''}</p>`}
  </section>`;
}
// Tap a picture: it fills the screen, and the arrows (or a swipe) flip between the versions at the same screen, so the
// difference is seen in place (the plan's step 2). The up and down keys move along a path's screens.
function abZoom(t, arm) {
  const arms = t.arms, steps = stepsOf(t); let i = Math.max(0, arms.indexOf(arm)), k = stepOf(t);
  const draw = d => { const a = arms[i], ps = shotsOf(t, a), p = ps[Math.min(k, ps.length - 1)];
    d.querySelector('[data-zbody]').innerHTML = `<p class="ab-zname"><b>${a === arms[0] ? 'Today’s: ' : ''}${esc(armName(t, a))}</b><span class="small muted">Version ${i + 1} of ${arms.length}</span></p>
      <figure class="ab-zfig">${p ? `<img src="${esc(shotSrc(p))}" alt="${esc(`${armName(t, a)}${p.title ? `: ${p.title}` : ''}`)}">` : '<p class="muted">No picture yet.</p>'}
      <figcaption class="small muted">${p?.title ? esc(p.title) : ''}${steps > 1 && ps.length ? ` · screen ${Math.min(k, ps.length - 1) + 1} of ${ps.length}` : ''}</figcaption></figure>`;
    d.querySelectorAll('[data-zs]').forEach(b => { b.disabled = +b.dataset.zs < 0 ? k <= 0 : k >= steps - 1; }); };
  const go = (d, n) => { i = (i + n + arms.length) % arms.length; draw(d); };
  const stepBtns = steps > 1 ? `<span class="ab-zsteps">${btn('Screen before', { kind: 'text', sm: true, icon: 'chevron-up', attrs: { 'data-zs': '-1' } })}${btn('Screen after', { kind: 'text', sm: true, icon: 'chevron-down', attrs: { 'data-zs': '1' } })}</span>` : '';
  openSheet({ title: esc(t.name), size: 'full',
    body: `<div class="ab-zoom"><div data-zbody aria-live="polite"></div><div class="ab-znav">${btn('Version before', { kind: 'secondary', sm: true, icon: 'chevron-left', attrs: { 'data-zv': '-1' } })}${stepBtns}${btn('Next version', { kind: 'secondary', sm: true, icon: 'chevron-right', attrs: { 'data-zv': '1' } })}</div></div>`,
    wire: d => { draw(d);
      d.querySelectorAll('[data-zv]').forEach(b => b.onclick = () => go(d, +b.dataset.zv));
      d.querySelectorAll('[data-zs]').forEach(b => b.onclick = () => { k = Math.max(0, Math.min(steps - 1, k + +b.dataset.zs)); draw(d); });
      d.addEventListener('keydown', e => { if (e.target.closest?.('input, textarea')) return;
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); go(d, e.key === 'ArrowRight' ? 1 : -1); }
        else if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && steps > 1) { e.preventDefault(); k = Math.max(0, Math.min(steps - 1, k + (e.key === 'ArrowDown' ? 1 : -1))); draw(d); } });
      // A sideways swipe on the picture flips the version, as the arrows do.
      let x0 = null; const body = d.querySelector('[data-zbody]');
      body.addEventListener('touchstart', e => { x0 = e.touches[0].clientX; }, { passive: true });
      body.addEventListener('touchend', e => { if (x0 === null) return; const dx = e.changedTouches[0].clientX - x0; x0 = null; if (Math.abs(dx) > 50) go(d, dx < 0 ? 1 : -1); }); } });
}
const abWait = s => s.abErr ? `<div class="card">${notice('bad', 'circle-alert', `Could not load the tests. ${esc(s.abErr)}`)}${btn('Try again', { kind: 'secondary', sm: true, attrs: { 'data-abretry': '1' } })}</div>`
  : `<div aria-busy="true" aria-label="Loading the tests">${[0, 1].map(() => '<div class="card"><div class="skel" style="height:120px"></div></div>').join('')}</div>`;
// Save one test's switch, put the row the database sends back in place, and redraw.
async function saveAb(key, patch) {
  const row = await DB.setAbTest(key, patch), s = st();
  if (s.ab) s.ab.tests = s.ab.tests.map(t => t.key === key ? { ...t, ...row } : t);
  hooks.render(); return row;
}

// ---- Tester sheet (R-185): a room of testers, each group on the versions Nate picks ----
// Nate 10/6: "make the tester sheet with QR codes. This should be made into the app so I can do this on my own later and
// easily compare the different options." Each group gets a link that forces its versions (pub/variant.js reads ?ab= and
// marks them forced: counted apart, never in a test's comparison) and a QR code. The groups sit side by side, each
// saying how it differs from today's; one print gives Nate a page comparing them and each group a page to scan, which
// never says which version it is, so nobody is steered. The practice copy (the default): a test the link does not name
// shows today's version there, so the link alone sets the path, and &restart starts every scan fresh. The live site:
// the link names every test, so no coin toss is left to chance. Kept in advocates.prefs.room, so the groups are there
// next time, on the laptop or the phone (no migration: prefs takes any key).
// The page's job (B-1): a person comes here to give each group of testers its own link and QR code, on the versions they
// pick.
const ROOM_MAX = 6;
// Each sheet and each group has a short random id (R-193): a group's link says &t=<sheet>-<group>, so what its testers do
// is filed under that group however the groups are later moved, copied or removed (pub/testerlog.js, backend 150).
const rid = n => { const a = crypto.getRandomValues(new Uint8Array(n)); return [...a].map(x => 'abcdefghijkmnpqrstuvwxyz23456789'[x % 32]).join(''); };
const RID = /^[a-z0-9]{4,12}$/, GID = /^[a-z0-9]{2,8}$/;
// A group's name (R-241, Nate 10/11: "I'd like to be able to rename each tester group"): its own words, or "Group 2" by
// its place on the sheet when it has none. The name rides with the group, not its place, so removing one above it moves
// the number but never the name; what its testers did stays filed under its id (R-193), so a rename keeps its results.
const ROOM_NAME_MAX = 24;   // three cards across on a laptop: a longer name wraps a heading to three lines (the critic, 10/11)
// A typed ' becomes ’ (the house apostrophe), so a name reads the same in a heading and in a screen reader's label.
const cleanName = x => typeof x === 'string' ? x.trim().replace(/\s+/g, ' ').replace(/'/g, '’').slice(0, ROOM_NAME_MAX) : '';
const gName = (g, i) => g.name || `Group ${i + 1}`;
const fileSlug = x => x.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
// A plan of the first-visit test replaces the screens these compare (pub/variant.js INSIDE_TODAY); 'join' is met only on
// a plan's sign-up.
const ROOM_INSIDE = ['end', 'fv', 'email', 'act'], ROOM_PLAN_ONLY = ['join'];
// Where in a visit each test's difference shows, for the page Nate keeps.
const ROOM_WHERE = { onb: 'The whole first visit.', end: 'The last screen of the first visit.', fv: 'The middle of the first visit.',
  email: 'Right after the issues are followed: the alerts sign-up, or a “Mahalo!” that does not ask.', join: 'The alerts sign-up, after their first step.',
  rank: 'After they send testimony on a bill: the card that comes next.', share: 'The message when they press Share on a bill.',
  home: 'The top of Home, once they have two or more things to do.',
  layout: 'Home, from the visit after the first one.',
  act: 'The page just before the end of the first visit: “Coming up on your issues”, or three ways to help.',
  pic: 'The picture in the text message a friend gets when they share a bill or an issue.' };
// What every group is asked to do, beyond going through the first visit, to meet a screen outside it (the fresh-eyes
// review, 10/6: a group changed on the share message produced no comparison when nobody pressed Share). The same words
// for every group, so nobody is steered. The practice copy has Free school bus passes with a hearing on its March day.
// Home keeps its welcome shape for the rest of the first visit, so the screens that differ on Home are met on the next
// visit: in the practice copy, the "Next day" link in the band at the very top (pub/app.js nextDay, R-187).
const ROOM_TASK = {
  demo: { rank: 'Find the bill “Free school bus passes” (HB 1780), write practice testimony and say you sent it.',
    share: 'Find the bill “Free school bus passes” (HB 1780) and press Share.',
    home: 'Follow two or more issues. After the first visit, press “Next day” at the very top, then look at the top of Home.',
    layout: 'After the first visit, press “Next day” at the very top, then look at Home.',
    pic: 'Find the bill “Free school bus passes” (HB 1780), press Share, and text yourself the link.' },
  live: { rank: 'Send testimony on a bill with a hearing coming up (in session only).', share: 'Open a bill and press Share.',
    home: 'Follow two or more issues, then come back another day and look at the top of Home.',
    layout: 'Come back another day, then look at Home.', pic: 'Open a bill and press Share, then text yourself the link.' } };
// One line on each plan, so "Plan 4" still means something in January (from R-164's doc; change it with the plans).
const ROOM_PLAN_SUB = { p1: 'Follow your issues, then a 2-minute email on one bill', p2: 'A real law’s road in six scenes, then your issues’ bills',
  p3: 'Your island and your two legislators first', p4: 'Four ways to help, then a first step sized to yours', p5: 'Under a minute, then one card per later visit' };
// A test added later without a line here (R-184's 'save', 10/6) says its own question instead.
const roomWhere = t => ROOM_WHERE[t.key] || t.question || '';
const roomTests = () => (st().ab?.tests || []).filter(t => Array.isArray(t.arms) && t.arms.length > 1).sort((a, b) => (a.sort ?? 99) - (b.sort ?? 99));
const roomTest = k => roomTests().find(t => t.key === k);
const armIn = (g, t) => t.arms.includes(g.v?.[t.key]) ? g.v[t.key] : t.arms[0];
const onPlan = g => { const t = roomTest('onb'); return !!t && armIn(g, t) !== t.arms[0]; };
// Every layout version but the Home before 11 Oct replaces the Home that Home's-top test compares (pub/variant.js, R-187,
// R-222: the calm Home and September's version A).
const ROOM_A_REPLACES = ['home'];
const onA = g => { const t = roomTest('layout'); return !!t && armIn(g, t) !== 'today'; };
// The ending on Home replaces the three ways to help (pub/variant.js arm0, R-150): since R-293 it skips that page and goes
// from the bill's story straight to Home. The UH class's group on 15 Oct had both, so its "three ways" half showed nothing and the sheet never said so
// (R-292, R-293).
const ROOM_END_REPLACES = ['act'];
const onEndHome = g => { const t = roomTest('end'); return !!t && armIn(g, t) === 'home'; };
const applies = (g, t) => !(ROOM_INSIDE.includes(t.key) && onPlan(g)) && !(ROOM_PLAN_ONLY.includes(t.key) && !onPlan(g)) && !(ROOM_A_REPLACES.includes(t.key) && onA(g))
  && !(ROOM_END_REPLACES.includes(t.key) && onEndHome(g));
const offWhy = (g, t) => ROOM_PLAN_ONLY.includes(t.key) ? 'Only met on a plan' : ROOM_A_REPLACES.includes(t.key) && onA(g) ? 'Replaced by the new Home'
  : ROOM_END_REPLACES.includes(t.key) && onEndHome(g) ? 'Replaced by the ending on Home' : 'Replaced by the plan';
// A version picked for this group that another of its picks hides (R-293, Nate 10/15: "make the tester sheet warn when a
// group's versions cancel each other"): said on the card in words, with what the testers will see instead, so a group is
// never sent out on a version nobody can meet.
const clashWhy = (g, t) => ROOM_PLAN_ONLY.includes(t.key) ? 'it is met only on a plan of the first visit'
  : ROOM_A_REPLACES.includes(t.key) && onA(g) ? 'this group’s Home replaces the one it changes'
  : ROOM_END_REPLACES.includes(t.key) && onEndHome(g) ? 'with the ending on Home, testers go from the bill’s story straight to Home'
  : 'this group’s plan has its own screens';
const roomClashes = g => roomTests().filter(t => t.key !== 'onb' && !applies(g, t) && t.arms.includes(g.v?.[t.key]) && g.v[t.key] !== t.arms[0]);
// The version's short name ("Three ways to help", not its whole description).
const clashText = (g, t) => `${armName(t, g.v[t.key]).split(':')[0]} will not show: ${clashWhy(g, t)}. Change one of the two.`;
// The screens other than the first visit where a group differs from today's.
const roomDiffs = g => roomTests().filter(t => t.key !== 'onb' && applies(g, t) && armIn(g, t) !== t.arms[0]);
// The screens any group changed: every card shows each of them, in the same order, so the cards compare line by line.
const roomShown = r => roomTests().filter(t => t.key !== 'onb' && r.groups.some(g => roomDiffs(g).includes(t)));
const roomTasks = r => roomShown(r).map(t => ROOM_TASK[r.where]?.[t.key]).filter(Boolean);
// A new sheet: one group per first-visit version switched on in the live test (today's and Plan 1 since R-164), at least
// two, so the first sheet already compares something.
function roomDefault() {
  const t = roomTest('onb'), on = t ? armsOnOf(t) : [];
  const firsts = on.length > 1 ? on.slice(0, ROOM_MAX) : t ? t.arms.slice(0, 2) : ['', ''];
  return { id: rid(6), where: 'demo', groups: firsts.map(a => ({ v: a && t && a !== t.arms[0] ? { onb: a } : {}, gid: rid(3) })) };
}
// What was kept, cleaned against the tests as they are now (a version removed after its test was decided is dropped).
function room() {
  const s = st(); if (s.room) return s.room;
  const kept = S.me?.prefs?.room, ok = kept && Array.isArray(kept.groups) && kept.groups.length;
  const r = ok ? { id: RID.test(kept.id || '') ? kept.id : rid(6), where: kept.where === 'live' ? 'live' : 'demo',
    groups: kept.groups.slice(0, ROOM_MAX).map(g => ({ v: { ...(g?.v || {}) }, gid: GID.test(g?.gid || '') ? g.gid : rid(3), name: cleanName(g?.name) })) } : roomDefault();
  // A sheet kept before R-193 gets its ids now, kept at the page's first wiring (roomKeep, never during a draw).
  if (ok && (r.id !== kept.id || r.groups.some((g, i) => g.gid !== kept.groups[i]?.gid))) s.roomFresh = true;
  for (const g of r.groups) for (const k of Object.keys(g.v)) { const t = roomTest(k); if (!t || !t.arms.includes(g.v[k]) || g.v[k] === t.arms[0]) delete g.v[k]; }
  return s.room = r;
}
function roomKeep() {
  const r = st().room; if (!r) return;
  DB.patchPrefs({ room: { id: r.id, where: r.where, groups: r.groups.map(g => ({ v: g.v, gid: g.gid, ...(g.name ? { name: g.name } : {}) })) } }).catch(() => toast('Your groups could not be kept for next time. They stay on this page until you leave.', { err: true }));
}
function roomUrl(g, where) {
  const T = roomTests();
  // &t=<sheet>-<group> (R-193): a tester's path is recorded and filed under this group (pub/testerlog.js).
  const tag = `&t=${room().id}-${g.gid}`;
  if (where === 'live') return `${APP_URL}track.html?ab=${T.map(t => `${t.key}.${armIn(g, t)}`).join(',')}${tag}`;
  const parts = T.filter(t => t.key === 'onb' || roomDiffs(g).includes(t)).map(t => `${t.key}.${armIn(g, t)}`);
  // &abrest=today: every test the link does not name stays today's, whatever the switches (the practice copy follows them
  // since R-192), so the link alone sets the path, as the sheet promises.
  return `${APP_URL}track.html?demo=1&restart&abrest=today${tag}${parts.length ? '&ab=' + parts.join(',') : ''}`;
}
// ---- What testers did (R-193; backend 150; pub/testerlog.js) ----
// Every tester path recorded in the last 60 days: this sheet's groups first, each with its counts and "See their paths",
// then the earlier links (printed before 6 Oct's change, or from a group no longer on the sheet), by the versions they set.
// The practice copy shows sample paths on its own groups, so the section can be seen.
const ACT_KINDS = ['testimony', 'email', 'legislators', 'intro', 'attend', 'share'];
const pathActed = p => ACT_KINDS.some(k => p.did?.[k] > 0);
const plural2 = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;
function pathCounts(ps) {
  const n = ps.length, c = f => ps.filter(f).length;
  return [plural2(n, 'tester'), `${c(p => p.did?.finished)} finished the first visit`, `${c(p => p.did?.followed > 0)} followed`,
    `${c(pathActed)} acted`, `${c(p => p.did?.contact)} gave a number or email`, c(p => p.did?.nextday) ? `${c(p => p.did?.nextday)} pressed Next day` : ''].filter(Boolean).join(' · ');
}
const HP_MODE = { testimony: 'Testimony', email: 'Email to the chair', legislators: 'Letter to your legislators', intro: 'Hello letter', helper: 'Walkthrough' };
const HP_SCREEN = { stand: 'where do you stand?', know: 'get to know the bill', 1: 'about you', 2: 'your letter', acct: 'Capitol account', 3: 'send it', mail: 'send it', done: 'mahalo' };
const SCREEN = { home: 'Home', bills: 'My issues', find: 'Find', more: 'More', profile: 'Your profile', settings: 'Your profile', help: 'Help', signin: 'Sign in',
  alerts: 'Get alerts', privacy: 'Privacy', recap: 'Your session', allbills: 'Every bill', legislators: 'Your legislators', committees: 'Committees' };
const numWords = n => String(n || '').toUpperCase().replace(/^([A-Z]+)(\d+)$/, '$1 $2');
function stepLabel(key) {
  const [base, ...dl] = String(key || '').split(':'), seg = base.split('/');
  let s;
  if (seg[0] === 'start') s = `First visit: ${dl.length ? FV_NAMES[dl.shift()] || 'a step' : `step ${seg[1] || 1}`}`;
  else if (seg[0] === 'bill') s = `Bill ${numWords(/^\d{4}$/.test(seg[1]) ? seg[2] : seg[1])}`;
  else if (seg[0] === 'issue' || (seg[0] === 'find' && seg[1] === 'issue')) { const slug = seg[0] === 'issue' ? seg[1] : seg[2]; s = `Issue: ${(S.issues || []).find(i => i.slug === slug)?.name || String(slug || '').replace(/-/g, ' ')}`; }
  else if (seg[0] === 'find' && seg[1] === 'category') s = `Topic: ${seg[2] || ''}`;
  else if (seg[0] === 'learn') s = `Lesson: ${seg[1] || ''}`;
  else if (seg[0] === 'legislator') s = 'A legislator';
  else s = SCREEN[seg[0]] || base;
  if (dl.length) s += HP_MODE[dl[0]] ? ` · ${HP_MODE[dl[0]]}${dl[1] ? `: ${HP_SCREEN[dl[1]] || dl[1]}` : ''}` : ` · a window (${dl.join(' ')})`;
  return s;
}
const secs = n => n < 60 ? `${n}s` : `${Math.floor(n / 60)}m ${String(n % 60).padStart(2, '0')}s`;
const DID_NAMES = { followed: 'followed', testimony: 'sent testimony', email: 'emailed a chair', legislators: 'wrote to their legislators', intro: 'sent a hello letter',
  attend: 'planned to go to a hearing', share: 'shared', finished: 'finished the first visit', contact: 'gave a number or email', nextday: 'pressed Next day' };
function pathHTML(p) {
  const t0 = new Date(p.started_at), mins = Math.max(1, Math.round((p.steps || []).reduce((a, x) => a + (x[1] || 0), 0) / 60));
  const did = Object.entries(p.did || {}).filter(([k, v]) => v > 0 && !/^skipped_/.test(k)).map(([k, v]) => k === 'followed' ? `followed ${plural2(v, 'issue or topic', 'issues or topics')}` : `${DID_NAMES[k] || k.replace(/_/g, ' ')}${v > 1 ? ` (${v} times)` : ''}`);
  const skipped = Object.keys(p.did || {}).filter(k => /^skipped_/.test(k)).map(k => FV_NAMES[k.slice(8)] || k.slice(8));
  return `<li class="rm-path"><p class="rm-pathh"><b>${esc(p.device === 'laptop' ? 'Laptop' : p.device === 'tablet' ? 'Tablet' : 'Phone')}</b> · ${esc(t0.toLocaleString('en-US', { timeZone: 'Pacific/Honolulu', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }))} · about ${plural2(mins, 'minute')}${p.place === 'live' ? ' · live site' : ''}</p>
    <p class="small">${did.length ? `${esc(did.join(', '))}.` : 'Did nothing yet that counts as a step.'}${skipped.length ? ` Skipped: ${esc(skipped.join(', '))}.` : ''}</p>
    <ol class="rm-steps">${(p.steps || []).map(([k, n]) => `<li><span>${esc(stepLabel(k))}</span><span class="muted">${secs(n || 0)}</span></li>`).join('')}</ol></li>`;
}
function loadPaths(force = false) {
  const s = st(); if (s.pathsBusy || (s.paths && !force)) return;
  s.pathsBusy = true;
  DB.testerPaths().then(rows => {
    s.paths = rows; s.pathsErr = null;
  }).catch(e => { s.pathsErr = e.message || 'Could not load.'; })
    .finally(() => { s.pathsBusy = false; if (S.route?.name === 'setup') hooks.render(); });
}
function roomResults(r) {
  const s = st(); loadPaths();
  const head = `<section class="card rm-res" aria-labelledby="rm-res-h"><div class="rm-reshead"><h2 id="rm-res-h">What testers did</h2>
    ${btn('Check again', { kind: 'text', sm: true, icon: 'rotate-ccw', attrs: { 'data-rmres': '1', 'aria-busy': s.pathsBusy ? 'true' : null } })}</div>
    <p class="small muted">Each tester who opens a group’s link or code is recorded under a random number: the screens in order, the seconds on each, and what they did. Not their name, and nothing they type.</p>`;
  if (!s.paths) return `${head}${s.pathsErr ? notice('bad', 'circle-alert', `Could not load what testers did. ${esc(s.pathsErr)}`) : '<div class="skel" style="height:64px" aria-busy="true" aria-label="Loading"></div>'}</section>`;
  // The practice copy: its samples land on this sheet's groups as they are now, the last one an earlier link.
  const P = (DEMO ? s.paths.map((p, i) => i < s.paths.length - 1 ? { ...p, sheet: r.id, grp: r.groups[i % r.groups.length].gid } : p) : s.paths)
    .slice().sort((p, q) => String(q.started_at).localeCompare(String(p.started_at)));   // newest first
  const on = (p, g) => p.sheet === r.id && p.grp === g.gid;
  s.pathSets = {};
  const rowFor = (key, label, ps) => { s.pathSets[key] = { label, ps };
    return `<li class="rm-resrow"><div><b>${esc(label)}</b><p class="small">${ps.length ? esc(pathCounts(ps)) : 'Nobody yet.'}</p></div>${ps.length ? btn('See their paths', { kind: 'text', sm: true, iconEnd: 'chevron-right', attrs: { 'data-rmpaths': key, 'aria-haspopup': 'dialog' } }) : ''}</li>`; };
  // A group's row names the versions its testers had (the fresh-eyes review: "Group 1 · Plan 1"); a group whose versions
  // changed between two sessions gets a row per set, so nothing is mixed. Today's version of a test is left out of the name.
  const vWords = v => v.split(',').map(x => { const [k, a] = x.split('.'), t = roomTest(k); return !t ? x : a === t.arms[0] ? '' : t.key === 'onb' ? armName(t, a).split(':')[0] : `${t.name}: ${armName(t, a)}`; }).filter(Boolean).join('; ') || 'today’s versions';
  const rows = r.groups.flatMap((g, i) => { const mine = P.filter(p => on(p, g)), sets = [...new Set(mine.map(p => p.versions || ''))];
    return sets.length ? sets.map((v, j) => rowFor(`g${i}-${j}`, `${gName(g, i)} · ${vWords(v)}`, mine.filter(p => (p.versions || '') === v))) : [rowFor('g' + i, gName(g, i), [])]; });
  const rest = P.filter(p => !r.groups.some(g => on(p, g))), byV = new Map();
  for (const p of rest) { const k = p.versions || 'today'; (byV.get(k) || byV.set(k, []).get(k)).push(p); }
  const earlier = [...byV.entries()].map(([v, ps], i) => rowFor('e' + i, `Earlier link · ${vWords(v)}`, ps));
  return `${head}<ul class="rows rm-resrows" role="list">${rows.join('')}</ul>
    ${earlier.length ? `<h3 class="rm-resh3">Earlier tester links</h3><ul class="rows rm-resrows" role="list">${earlier.join('')}</ul>` : ''}</section>`;
}
const roomQr = new Map();   // link -> the code's SVG, so a redraw never flashes "Drawing the code"
function roomCard(g, i, r) {
  const where = r.where, onb = roomTest('onb'), diffs = roomDiffs(g), shown = roomShown(r), url = roomUrl(g, where), name = gName(g, i);
  const more = roomTests().filter(t => t.key !== 'onb' && applies(g, t) && !shown.includes(t));
  const pick = (t, label) => { const a = armIn(g, t), today = a === t.arms[0];
    return `<div class="field${today && t.key !== 'onb' ? ' rm-istoday' : ''}"><span class="label" id="rm-l-${i}-${esc(t.key)}">${esc(label)}</span>
    ${pickerChip(armName(t, a) + (today && t.key !== 'onb' ? ' (today’s)' : ''), { 'data-rmpick': `${i}|${t.key}`, 'aria-haspopup': 'dialog', 'aria-labelledby': `rm-h-${i} rm-l-${i}-${t.key}` })}</div>`; };
  const off = t => `<div class="field rm-istoday"><span class="label">${esc(t.name)}</span><span class="small muted">${offWhy(g, t)}</span></div>`;
  const same = !diffs.length && !onPlan(g);
  return `<li class="card rm-group">
    <div class="rm-ghead"><h2 id="rm-h-${i}" tabindex="-1">${esc(name)}</h2>${iconBtn('ellipsis', `More for ${name}`, { 'data-rmmore': i, 'aria-haspopup': 'dialog' })}</div>
    ${onb ? pick(onb, 'First visit') : ''}
    ${shown.map(t => applies(g, t) ? pick(t, t.name) : off(t)).join('')}
    ${roomClashes(g).map(t => notice('warn', 'triangle-alert', esc(clashText(g, t)))).join('')}
    ${same ? `<p class="small rm-same">${icon('flag')}<span>Today’s version of everything, to compare the others against.</span></p>` : ''}
    ${more.length ? `<div>${btn('Change another screen', { kind: 'text', sm: true, icon: 'plus', cls: 'rm-addscr', attrs: { 'data-rmscreen': i, 'aria-haspopup': 'dialog' } })}</div>` : ''}
    <div class="rm-qr">
      <div class="rm-qrbox" data-rmqr="${i}" data-url="${esc(url)}" role="img" aria-label="QR code for ${esc(name)}">${roomQr.get(url) || '<span class="small muted">Drawing the code…</span>'}</div>
      <div class="btnrow rm-acts">${btn('Open', { kind: 'secondary', sm: true, icon: 'external-link', href: url, target: '_blank', attrs: { 'aria-label': `Open ${name}’s link in a new tab` } })}${btn('Copy link', { kind: 'text', sm: true, icon: 'copy', attrs: { 'data-rmcopy': i } })}</div>
    </div>
  </li>`;
}
// The printed sheet: a page for Nate comparing the groups screen by screen, then one page per group to scan.
async function roomPrint() {
  const r = room(), T = roomTests(), where = r.where, onb = roomTest('onb');
  const codes = await Promise.all(r.groups.map(g => qrMatrix(roomUrl(g, where))));
  const shown = roomShown(r), tasks = roomTasks(r);
  const cell = (g, t) => !applies(g, t) ? `<span class="m">${offWhy(g, t)}</span>`
    : armIn(g, t) === t.arms[0] ? `<span class="m">${esc(armName(t, t.arms[0]))}${t.key === 'onb' ? '' : ' (today’s)'}</span>` : `<b>${esc(armName(t, armIn(g, t)))}</b>`;
  const rowOf = t => `<tr><th scope="row">${esc(t.key === 'onb' ? 'First visit' : t.name)}<small>${esc(roomWhere(t))}</small></th>${r.groups.map(g => `<td>${cell(g, t)}</td>`).join('')}</tr>`;
  const day = new Date().toLocaleDateString('en-US', { timeZone: 'Pacific/Honolulu', weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  const whereLine = where === 'live' ? 'On the live site: what people do there is real, and their visits are counted apart from the public’s.' : 'On the practice copy: a day in March with hearings on. Nothing anyone does is saved.';
  return printHtml(`<!doctype html><html><head><meta charset="utf-8"><title>Tester sheet</title><style>
    @page { margin: 16mm; } body { font: 14px/1.45 system-ui, sans-serif; color: #142B35; margin: 0; }
    h1 { font-size: 22px; margin: 0 0 2mm; } .sub { margin: 0 0 6mm; color: #344852; }
    table { border-collapse: collapse; width: 100%; } th, td { text-align: left; vertical-align: top; padding: 2.5mm 3mm; border-bottom: 1px solid #C9D4D9; }
    thead th { font-size: 16px; border-bottom: 2px solid #142B35; } th small { display: block; font-weight: 400; color: #5F6F76; font-size: 12px; margin-top: 1mm; }
    .m { color: #5F6F76; } .note { margin-top: 6mm; color: #344852; font-size: 13px; } .lk td { font-size: 10px; color: #5F6F76; word-break: break-all; }
    .saw td, .saw th { height: 38mm; } .tasks { margin: 6mm 0 0; padding-left: 6mm; } .pg .t { font-size: 16px; font-weight: 700; margin: 4mm auto 0; max-width: 140mm; }
    .pg { break-before: page; text-align: center; padding-top: 8mm; } .pg .g { font-size: 40px; font-weight: 700; margin: 0 0 6mm; }
    .pg svg { width: 110mm; height: 110mm; } .pg .i { font-size: 20px; font-weight: 700; margin: 6mm 0 2mm; } .pg .i2 { font-size: 16px; margin: 0 auto; max-width: 140mm; }
    .pg .b { margin-top: 10mm; font-size: 12px; color: #5F6F76; }</style></head><body>
    <h1>Tester sheet</h1><p class="sub">${esc(day)} · ${r.groups.length} ${r.groups.length === 1 ? 'group' : 'groups'}. ${esc(whereLine)}</p>
    <table><thead><tr><th scope="col">What they see</th>${r.groups.map((g, i) => `<th scope="col">${esc(gName(g, i))}</th>`).join('')}</tr></thead>
    <tbody>${onb ? rowOf(onb) : ''}${shown.map(rowOf).join('')}
      <tr class="lk"><th scope="row">The link</th>${r.groups.map(g => `<td>${esc(roomUrl(g, where))}</td>`).join('')}</tr>
      <tr class="saw"><th scope="row">What we saw</th>${r.groups.map(() => '<td></td>').join('')}</tr></tbody></table>
    ${tasks.length ? `<p class="note">Every group is also asked to:</p><ul class="tasks">${tasks.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
    <p class="note">Every other screen is today’s version for every group. Each group’s own page follows; it does not say which version it is.
      Each tester’s path (the screens in order, the seconds on each, what they did) is recorded under a random number and shows on the tester sheet, by group; their page tells them.</p>
    ${r.groups.map((g, i) => `<div class="pg"><p class="g">${esc(gName(g, i))}</p>${qrSvg(codes[i], 416)}
      <p class="i">Scan this with your phone’s camera, then tap the link.</p>
      <p class="i2">Go through it as if a friend had just sent it to you.${where === 'live' ? '' : ' It is a practice copy: nothing you type is saved.'}</p>
      <p class="b">For this test we note which screens you visit, in order, and how long you spend on each, under a random number: not your name, and nothing you type.</p>
      ${tasks.map(x => `<p class="t">Then: ${esc(x)}</p>`).join('')}
      <p class="b">HIPHI Bill Tracker · Hawaiʻi Public Health Institute</p></div>`).join('')}
    </body></html>`);
}

// The Public page's own pages (renderSub): the A/B tests, one test, the tester sheet; v5's, unchanged but for their head.
const PAGES = {
  tests: {
    status: () => { const A = st().ab; if (!A) return ['flask-conical', 'The public page’s A/B tests.'];
      const bar = abBar(A.tests), ready = A.tests.filter(t => abState(t, A.res, bar).ready);
      return ['flask-conical', `${A.tests.filter(t => t.is_on).length} of ${plural(A.tests.length, 'test')} running.${ready.length ? ` Ready to decide: ${ready.map(t => esc(t.name)).join(', ')}.` : ' None ready to decide yet.'}`]; },
    body() { loadAb(); loadShots(); const s = st();
      if (!s.ab) return abWait(s);
      // R-201: one line per test, in a fixed order by where it shows; the filter is kept for the visit.
      const bar = abBar(s.ab.tests), cards = s.ab.tests.map(t => ({ t, x: abState(t, s.ab.res, bar) })), filt = s.abFilter || 'all';
      const n = f => cards.filter(c => f === 'running' ? c.t.is_on : f === 'off' ? !c.t.is_on : c.x.ready).length;
      // The tester sheet (R-185): each group of a room of testers on the versions Nate picks, a QR code each.
      // R-192: the switches decide what the public tracker and its practice copy show; the practice copy of this page has
      // sample switches, which change nothing (Nate's answer 1: one set of switches, the real ones).
      // The fresh-eyes review (10/17): the notice on its own line, then the filter with the two links beside it, so the
      // first test starts high and nothing is squeezed into a narrow column on a laptop.
      return `<div class="ab-intro">${DEMO ? notice('info', 'info', `Practice copy: these switches are samples and change nothing. The real ones: <a href="${esc(APP_URL)}staff6.html#/setup/tests">Tests</a>, signed in.`) : ''}</div>
        <div class="ab-filterrow"><div class="ab-filter">${segmented('abf', [['all', 'All'], ['running', `Running (${n('running')})`], ['off', `Off (${n('off')})`], ['ready', `Ready to decide (${n('ready')})`]], filt, 'Show')}</div>
        <div class="ab-introacts">${btn('Tester sheet', { kind: 'text', sm: true, icon: 'qr-code', href: '#/setup/room', attrs: { 'data-abroom': '1', title: 'Testing with a room of people: a link and QR code for each group, on the versions you pick' } })}
        ${btn('Check again', { kind: 'text', sm: true, icon: 'rotate-ccw', attrs: { 'data-abretry': '1', 'aria-busy': s.abBusy ? 'true' : null } })}</div></div>
        <div class="ab-list">${abList(cards, filt)}</div>`; },
    wire(root) {
      const s = st();
      root.querySelectorAll('[data-abretry]').forEach(b => b.onclick = () => { s.ab = null; s.shots = undefined; loadAb(true); hooks.render(); });
      root.querySelectorAll('[data-seg="abf"]').forEach(b => b.onclick = () => { s.abFilter = b.dataset.val; hooks.render(); document.querySelector(`[data-seg="abf"][data-val="${b.dataset.val}"]`)?.focus(); });
    },
  },
  // R-201: one test on its own page (#/setup/test?t=<key>), its versions side by side as pictures.
  test: {
    parent: 'tests',
    title: () => abTestOf()?.name || 'A test',
    status: () => { const t = abTestOf(), A = st().ab; if (!t) return ['flask-conical', 'One of the public page’s A/B tests.'];
      const [, word, , ic] = abWord(t, abState(t, A.res, abBar(A.tests))); return [ic || 'flask-conical', `${word}. ${esc(roomWhere(t))}`]; },
    body() { loadAb(); loadShots(); const s = st();
      if (!s.ab) return abWait(s);
      const t = abTestOf();
      if (!t) return empty({ title: 'That test is not on the list', text: 'It may have been removed once it was decided.', action: btn('See every test', { href: '#/setup/tests' }) });
      return abCard(t, abState(t, s.ab.res, abBar(s.ab.tests))); },
    wire(root) {
      const s = st(), test = k => s.ab?.tests.find(t => t.key === k), cur = abTestOf();
      root.querySelectorAll('[data-abretry]').forEach(b => b.onclick = () => { s.ab = null; loadAb(true); hooks.render(); });
      if (!cur) return;
      root.querySelectorAll('[data-seg="abstep"]').forEach(b => b.onclick = () => { (s.abStep ??= {})[cur.key] = +b.dataset.val; hooks.render(); document.querySelector(`[data-seg="abstep"][data-val="${b.dataset.val}"]`)?.focus(); });
      root.querySelectorAll('[data-abshot]').forEach(b => b.onclick = () => abZoom(cur, b.dataset.abshot));
      // One version's switch (R-164 for the first-visit test, every test since R-192): saved at once, with Undo; the last
      // one on cannot be switched off. Switching on a version a note warns about (the email ask waits on a lawyer, Home's
      // top is paused for version A) asks first.
      root.querySelectorAll('[data-abarm-on]').forEach(el => el.onchange = async () => {
        const [key, arm] = el.dataset.abarmOn.split('|'), t = test(key); if (!t) return;
        const was = liveOf(t), next = el.checked ? t.arms.filter(x => was.includes(x) || x === arm) : was.filter(x => x !== arm);
        if (!next.length) { el.checked = true; toast(`${vSubj(t, arm)} is the only version on, so everyone sees it. Switch on another version first, then this one can go off.`, { err: true }); return; }
        const before = { is_on: t.is_on, fallback: t.fallback, winner: t.winner, arms_on: t.arms_on ?? null };
        if (el.checked && t.note && arm !== t.arms[0] && !await confirmSheet({ title: `Switch on ${vName(t, arm)} of “${t.name}”?`,
          text: `${esc(t.note)} ${next.length >= 2 ? 'New visitors start getting one of the versions on, at random.' : `Everyone gets “${esc(armName(t, arm))}” at once.`}`, ok: 'Switch it on' })) { el.checked = false; return; }
        try { await saveAb(key, livePatch(t, next)); document.getElementById(el.id)?.focus({ preventScroll: true });
          toast(`Saved. ${next.length >= 2 ? `“${t.name}” is running: ${andList(next.map(a => vName(t, a)))}, at random.` : `Everyone sees ${vName(t, next[0])} of “${t.name}”, and nothing is counted.`}`, { ok: true, undo: () => saveAb(key, before) }); }
        catch (e) { el.checked = !el.checked; toast(e, { err: true }); } });
      // Try it: a plain link under each version (data-absee names the test and version), each opening the practice copy in a
      // new tab; nothing to wire.
      // Pick: one button under each version, where a test can be picked (abCard). Everyone gets that version and the test
      // stops (Undo), the way a switch saves. A test with a note (the email ask, waiting on a lawyer) asks first, as turning it
      // on does: a pick gives every visitor that version at once.
      const pick = async (t, arm) => { const before = { is_on: t.is_on, fallback: t.fallback, winner: t.winner, arms_on: t.arms_on ?? null };
        if (t.note && arm !== t.arms[0] && !await confirmSheet({ title: `Give everyone ${esc(vName(t, arm))}?`, text: `${esc(t.note)} Every visitor gets “${esc(armName(t, arm))}” at once.`, ok: 'Pick it' })) return;
        try { await saveAb(t.key, { is_on: false, fallback: arm, winner: arm, arms_on: t.arms.length > 2 ? [arm] : null });
          document.querySelector(`[data-abpick="${t.key}"][data-abarm="${arm}"]`)?.focus({ preventScroll: true });   // as a switch keeps focus (the redraw would drop it)
          toast(`Picked ${vName(t, arm)} of “${t.name}”. Everyone gets “${armName(t, arm)}”.`, { ok: true, undo: () => saveAb(t.key, before) }); }
        catch (e) { toast(e, { err: true }); } };
      root.querySelectorAll('[data-abpick]').forEach(b => b.onclick = () => { const t = test(b.dataset.abpick); if (t && b.dataset.abarm) pick(t, b.dataset.abarm); });
    },
  },
  room: {
    parent: 'tests',
    status: () => { if (!st().ab) return ['qr-code', 'A link and a QR code for each group of testers.'];
      return ['qr-code', 'Your groups are kept for next time.']; },
    body() { loadAb(); const s = st();
      if (!s.ab) return s.abErr ? `<div class="card">${notice('bad', 'circle-alert', `Could not load the tests. ${esc(s.abErr)}`)}${btn('Try again', { kind: 'secondary', sm: true, attrs: { 'data-abretry': '1' } })}</div>`
        : `<div aria-busy="true" aria-label="Loading the tests">${[0, 1].map(() => '<div class="card"><div class="skel" style="height:120px"></div></div>').join('')}</div>`;
      const r = room(), full = r.groups.length >= ROOM_MAX;
      return `<div class="rm-where"><span class="label" id="rm-wl">Where they test</span>
          ${segmented('rmwhere', [['demo', 'Practice copy'], ['live', 'Live site']], r.where, 'Where they test')}
          <p class="small muted">${r.where === 'live' ? 'The real tracker. What people do there is real, and between sessions it has no hearings. Use phones that have not opened the tracker before, or a private window.'
            : 'A day in March with hearings on. Nothing anyone does is saved, and every scan starts fresh, even on a shared phone.'}</p></div>
        <ul class="rm-groups" aria-label="Groups">${r.groups.map((g, i) => roomCard(g, i, r)).join('')}
          ${full ? '' : `<li class="rm-addli"><button type="button" class="rm-add" data-rmadd="1">${icon('plus')}<span>Add a group</span></button></li>`}</ul>
        <div class="rm-foot"><p class="small muted">Testers never see which version they have, and visits from these links never count in the tests’ results${r.where === 'live' ? ' (Tests lists them apart, as testers’ links)' : ''}.</p>
          ${btn('Start over', { kind: 'text', sm: true, icon: 'rotate-ccw', attrs: { 'data-rmreset': '1' } })}</div>
        ${roomResults(r)}`; },
    saveLabel: 'Print the sheet', track: false,
    async save() {
      if (!st().ab) return 'Nothing to print yet.';
      if (!await roomPrint()) throw new Error('Printing did not start. Try again, or open each group’s link from its card.');
      return 'The sheet is ready: a page comparing the groups, then one page for each group.';
    },
    wire(root) {
      const s = st(); if (!s.ab) { root.querySelectorAll('[data-abretry]').forEach(b => b.onclick = () => { loadAb(true); hooks.render(); }); return; }
      const r = room(), T = roomTests();
      if (s.roomFresh) { s.roomFresh = false; roomKeep(); }   // a sheet kept before R-193 keeps the ids it was just given
      const redraw = sel => { hooks.render(); if (sel) document.querySelector(sel)?.focus(); };
      root.querySelector('[data-rmres]')?.addEventListener('click', () => { loadPaths(true); hooks.render(); });
      root.querySelectorAll('[data-rmpaths]').forEach(b => b.onclick = () => { const set = s.pathSets?.[b.dataset.rmpaths]; if (!set) return;
        openSheet({ title: `${set.label}: each tester’s path`, pop: true, body: `<p class="small muted">Newest first. Each line is a screen and the time they spent on it.</p><ol class="rm-paths" role="list">${set.ps.map(pathHTML).join('')}</ol>` }); });
      const change = (sel, fn) => { fn(); roomKeep(); redraw(sel); };
      // A first visit that is a plan never meets the tests inside today's (and only a plan meets the sign-up test), and
      // version A never meets Home's-top test (R-187), so a change of first visit or of layout drops the choices that no
      // longer show.
      const setArm = (g, t, arm) => {
        const before = { ...g.v };
        if (arm === t.arms[0]) delete g.v[t.key]; else g.v[t.key] = arm;
        if (t.key !== 'onb' && t.key !== 'layout') return;
        const drop = t.key === 'onb' ? (onPlan(g) ? ROOM_INSIDE : ROOM_PLAN_ONLY) : onA(g) ? ROOM_A_REPLACES : [];
        const gone = drop.filter(k => k in g.v).map(k => roomTest(k)?.name || k);
        for (const k of drop) delete g.v[k];
        // A choice that no longer shows is taken off with a word and Undo (the fresh-eyes review, A-16).
        if (gone.length) setTimeout(() => toast(`${t.key === 'layout' ? (armIn(g, t) === 'a' ? 'Version A replaces' : 'The calm Home replaces') : onPlan(g) ? 'A plan replaces' : 'Today’s first visit never meets'} ${gone.join(' and ')}, so ${gone.length > 1 ? 'they were' : 'it was'} taken off.`,
          { undo: () => { g.v = before; roomKeep(); hooks.render(); } }));
      };
      // Rename (R-241): blank gives the group back its number. Two groups never share a name, so the printed pages and
      // What testers did can tell them apart.
      const renameGroup = (g, i) => openSheet({ title: `Rename ${esc(gName(g, i))}`, size: 'auto',
        body: `<form class="st-form" novalidate data-rmnform>
          ${field('rm-name', 'Name', `<input id="rm-name" type="text" maxlength="${ROOM_NAME_MAX}" value="${esc(g.name || '')}" autocomplete="off" enterkeyhint="done" aria-describedby="rm-name-help" autofocus>`,
            'Testers see this name at the top of their page, so do not name the version. Leave it blank to use the group’s number.')}
          <button type="submit" hidden tabindex="-1" aria-hidden="true"></button></form>`,
        foot: `${btn('Cancel', { kind: 'text', attrs: { 'data-rmncancel': '1' } })}${btn('Save name', { attrs: { 'data-rmnsave': '1' } })}`,
        wire: d => {
          const input = d.querySelector('#rm-name');
          d.querySelector('[data-rmncancel]').onclick = () => closeSheet();
          const save = async () => {
            d.querySelectorAll('.err').forEach(e => e.remove()); input.removeAttribute('aria-invalid');
            const name = cleanName(input.value), was = g.name || '';
            // "Group 4" typed as a name would collide with the next unnamed group's number (the critic, 10/11).
            if (/^group \d+$/i.test(name)) return fieldErr(d, 'rm-name', 'That looks like a group number. Pick another name.');
            if (name && r.groups.some((o, j) => j !== i && gName(o, j).toLowerCase() === name.toLowerCase())) return fieldErr(d, 'rm-name', 'Another group has that name.');
            await closeSheet({ silent: true });
            if (name === was) return;
            change(`#rm-h-${i}`, () => { g.name = name; });
            toast(name ? `Renamed to “${name}”.` : `Back to ${gName(g, i)}.`, { ok: true, undo: () => { g.name = was; roomKeep(); hooks.render(); } });
          };
          d.querySelector('[data-rmnsave]').onclick = save; d.querySelector('[data-rmnform]').onsubmit = e => { e.preventDefault(); save(); };
          setTimeout(() => input.select(), 0);
        } });
      const versions = (g, i, t) => pickerSheet({ title: `${esc(gName(g, i))}: ${t.key === 'onb' ? 'First visit' : t.name}`, value: armIn(g, t), help: esc(roomWhere(t)),
        options: t.arms.map(x => [x, armName(t, x), null, x === t.arms[0] ? 'Today’s version' : t.key === 'onb' ? ROOM_PLAN_SUB[x] || '' : '']),
        onPick: arm => { const had = roomClashes(g).length;
          change(t.key === 'onb' || arm !== t.arms[0] ? `[data-rmpick="${i}|${t.key}"]` : `#rm-h-${i}`, () => setArm(g, t, arm));
          // Said at once as well as on the card, since the pick that hides another is made in a sheet over the page.
          const now = roomClashes(g); if (now.length > had) toast(clashText(g, now[now.length - 1])); } });
      root.querySelectorAll('[data-seg="rmwhere"]').forEach(b => b.onclick = () => change(`[data-seg="rmwhere"][data-val="${b.dataset.val}"]`, () => { r.where = b.dataset.val === 'live' ? 'live' : 'demo'; }));
      root.querySelector('[data-rmadd]')?.addEventListener('click', () => {
        change(`#rm-h-${r.groups.length}`, () => r.groups.push({ v: {}, gid: rid(3) }));
        toast(`Group ${r.groups.length} added, on today’s version of everything.`, { ok: true });
      });
      root.querySelector('[data-rmreset]')?.addEventListener('click', () => {
        const before = JSON.parse(JSON.stringify(r));
        s.room = { ...roomDefault(), id: r.id }; roomKeep(); redraw('#rm-h-0');   // the same sheet: its results stay on this page
        toast('Started over.', { ok: true, undo: () => { s.room = before; roomKeep(); hooks.render(); } });
      });
      root.querySelectorAll('[data-rmpick]').forEach(b => b.onclick = () => { const [i, k] = b.dataset.rmpick.split('|'), t = T.find(x => x.key === k); if (t) versions(r.groups[+i], +i, t); });
      root.querySelectorAll('[data-rmscreen]').forEach(b => b.onclick = () => { const i = +b.dataset.rmscreen, g = r.groups[i], diffs = roomDiffs(g);
        const more = T.filter(t => t.key !== 'onb' && applies(g, t) && !diffs.includes(t));
        pickerSheet({ title: `${esc(gName(g, i))}: change another screen`, value: '', help: 'Every screen you do not change stays today’s version.',
          options: more.map(t => [t.key, t.name, null, roomWhere(t)]),
          onPick: async k => { await afterClose(); const t = T.find(x => x.key === k); if (t) versions(g, i, t); } }); });
      root.querySelectorAll('[data-rmcopy]').forEach(b => b.onclick = () => copyLink(roomUrl(r.groups[+b.dataset.rmcopy], r.where)));
      root.querySelectorAll('[data-rmmore]').forEach(b => b.onclick = () => { const i = +b.dataset.rmmore, g = r.groups[i], name = gName(g, i);
        menuSheet({ title: esc(name), items: [
          { label: 'Rename this group', icon: 'pencil', run: () => renameGroup(g, i) },
          { label: 'Download the QR code', icon: 'download', run: async () => { try { await qrPng(roomUrl(g, r.where), `hiphi-testers-${fileSlug(name) || `group-${i + 1}`}`); toast('QR code downloaded.', { ok: true }); } catch { toast('The QR code could not be made. Copy the link instead.', { err: true }); } } },
          { label: 'Copy this group', icon: 'copy', sub: 'A new group on the same versions, to change one thing', disabled: r.groups.length >= ROOM_MAX, reason: `${ROOM_MAX} groups at most.`,
            run: () => { change(`#rm-h-${r.groups.length}`, () => r.groups.push({ v: { ...g.v }, gid: rid(3) })); toast(`Group ${r.groups.length} added, a copy of ${name}.`, { ok: true }); } },
          { label: 'Remove this group', icon: 'trash-2', danger: true, disabled: r.groups.length < 2, reason: 'A sheet keeps at least one group.',
            run: () => { const before = r.groups.slice(); change(`#rm-h-${Math.max(0, i - 1)}`, () => r.groups.splice(i, 1));
              toast(`${name} removed.${i < r.groups.length ? ' The groups after it moved up one.' : ''}`, { ok: true, undo: () => { r.groups.splice(0, r.groups.length, ...before); roomKeep(); hooks.render(); } }); } },
        ] }); });
      // The codes: drawn once per link and kept, so changing one group redraws only that group's code.
      root.querySelectorAll('[data-rmqr]').forEach(async box => { const url = box.dataset.url; if (roomQr.has(url)) return;
        try { const svg = qrSvg(await qrMatrix(url), 152); roomQr.set(url, svg); if (box.isConnected && box.dataset.url === url) box.innerHTML = svg; }
        catch { if (box.isConnected) box.innerHTML = `<span class="small rm-qrerr">${icon('circle-alert')}The QR code could not be drawn. Copy the link instead, or reload the page to try again.</span>`; } });
    },
  },
};

function importSummary(name, r) {
  const li = (t, strong) => `<li>${strong ? `<b>${t}</b>` : t}</li>`;
  return `<div class="st-sumcard"><p class="strong">${esc(name)}</p><ul class="st-ul">
    ${li(`${r.in_file} bills in the file, ${r.in_db} found in the tracker`)}${li(`${r.newly_tracked} newly tracked`, r.newly_tracked)}
    ${r.untrack.length ? li(`${r.untrack.length} will stop being tracked: ${esc(r.untrack.slice(0, 12).join(', '))}${r.untrack.length > 12 ? ' and more' : ''}`, true) : ''}
    ${li(`${plural(r.owner_changes, 'owner change')}`)}${li(`${r.p1} at P1, ${r.p2} at P2`)}
    ${r.missing.length ? li(`Not in the database: ${esc(r.missing.join(', '))}`) : ''}</ul>
    ${r.unknown_coalitions.length ? notice('bad', 'circle-alert', `Unknown coalitions: ${esc(r.unknown_coalitions.join(', '))}. Add them under Coalitions first.`) : ''}
    <div class="btnrow st-acts">${btn('Apply to the tracker', { kind: 'primary', attrs: { 'data-apply': '1', disabled: !!r.unknown_coalitions.length } })}</div></div>`;
}
// The sandbox cannot run the server check, so it shows what the file holds from what the app already knows.
function localSummary(name, rows) {
  const have = new Set(S.bills.map(b => b.bill_number)), names = new Set(S.campaigns.map(c => c.name.toLowerCase())), coal = [...new Set(rows.map(r => r.coalition).filter(Boolean))];
  const unknown = coal.filter(c => !names.has(c.toLowerCase())), p1 = rows.filter(r => /strongly/i.test(r.position)).length;
  return `<div class="st-sumcard"><p class="strong">${esc(name)}</p><ul class="st-ul"><li>${rows.length} bills in the file, ${rows.filter(r => have.has(r.num)).length} already tracked</li>
    <li>${S.bills.filter(b => !rows.some(r => r.num === b.bill_number)).length} tracked bills are not in the file and would stop being tracked</li><li>${p1} at P1, ${rows.length - p1} at P2</li>
    ${unknown.length ? `<li><b>Unknown coalitions: ${esc(unknown.join(', '))}</b></li>` : ''}</ul></div>`;
}
function wireApply(root, rows) {
  const a = root.querySelector('[data-apply]'); if (!a || !rows) return;
  a.onclick = async () => { a.disabled = true; a.setAttribute('aria-busy', 'true');
    try { const r = await DB.importTracker(rows, true); root.querySelector('#st-import-preview').innerHTML = notice('ok', 'circle-check', `Done. ${r.newly_tracked} newly tracked, ${r.untrack.length} untracked. Reloading…`); st().csv = null; toast('Tracked list updated. Reloading.', { ok: true }); setTimeout(() => location.reload(), 1200); }
    catch (e) { toast(e, { err: true }); a.disabled = false; a.removeAttribute('aria-busy'); } };
}

// One checklist row: its state as an icon and a word (never colour alone; amber and red are kept for late and overdue
// steps, D3, so a blocking check is said, not painted), what it checks, what it found, and its one way to fix it.
function readyRowHTML(r) {
  const [ic, cls, word] = r.waiting ? ['calendar-clock', 'info', 'Expected'] : r.ok === true ? ['circle-check', 'ok', 'Done'] : r.level === 'manual' ? ['circle-dashed', 'todo', 'To do']
    : r.ok === null || r.level === 'info' ? ['info', 'info', 'For your information'] : r.level === 'block' ? ['circle-x', 'bad', 'Blocking'] : ['circle-alert', 'warn', 'Check'];
  const fixText = !r.waiting && (r.ok === false || (r.level === 'manual' && !r.ok)) ? (FIX_TEXT[r.key] || tidy(r.fix)) : '';
  const to = r.ok !== true && !r.waiting && FIX[r.key];
  const act = r.waiting ? '' : r.level === 'manual'
    ? btn(r.ok ? 'Undo' : 'Mark done', { kind: r.ok ? 'text' : 'secondary', sm: true, attrs: { 'data-rman': r.key, 'data-on': r.ok ? '' : '1', 'aria-label': `${r.ok ? 'Mark not done' : 'Mark done'}: ${r.label}` } })
    : r.key === 'public_copy' && !r.ok ? btn('See them', { kind: 'text', sm: true, iconEnd: 'chevron-right', attrs: { 'data-gaps': '1', 'aria-haspopup': 'dialog' } })
    : to ? btn(r.ok === false ? 'Fix' : 'Open', { kind: 'text', sm: true, iconEnd: 'chevron-right', href: to, attrs: { 'aria-label': `${r.ok === false ? 'Fix' : 'Open'}: ${r.label}` } }) : '';
  const detail = r.waiting ? `Expected from ${new Date(String(r.expected).slice(0, 10) + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}. ${tidy(r.detail || '')}` : tidy(r.detail || '');
  return `<li class="ss-check ${cls}"><span class="ss-cic">${icon(ic)}</span>
    <div class="ss-cbody"><span class="ss-ct">${cls === 'bad' || cls === 'warn' ? `<span class="ss-cword">${word}:</span> ` : `<span class="sr">${word}: </span>`}${esc(r.label)}</span>${detail ? `<span class="ss-cl">${esc(detail)}</span>` : ''}${fixText ? `<span class="ss-cfix">${esc(fixText)}</span>` : ''}</div>${act ? `<span class="ss-cact">${act}</span>` : ''}</li>`;
}
// What the public page reported: the week's total and today's, then the five most frequent errors outside the sandbox. Each
// row is a distinct error (message and screen) in plain words; the browser's own message and file are folded away for Claude.
function errorsHTML() {
  const s = st(); loadErrors();
  if (!s.errs) return s.errsErr ? notice('bad', 'circle-alert', `Could not load the public page’s error reports. ${esc(s.errsErr)}`) : '<div class="skel" style="height:64px" aria-busy="true" aria-label="Loading"></div>';
  const today = hstToday(), live = s.errs.filter(e => !e.sandbox), sum = l => l.reduce((a, e) => a + (e.reports || 0), 0);
  const n = sum(live), nToday = sum(live.filter(e => e.day === today)), sb = sum(s.errs.filter(e => e.sandbox));
  const by = new Map();
  for (const e of live) { const k = `${e.message}|${e.place}`, g = by.get(k) || { ...e, reports: 0 }; g.reports += e.reports || 0; if (e.last_at > g.last_at) { g.last_at = e.last_at; g.day = e.day; g.source = e.source; } by.set(k, g); }
  const top = [...by.values()].sort((a, b) => b.reports - a.reports).slice(0, 5);
  const words = n ? `${plural(n, 'error report')} from visitors’ browsers in the last 7 days, ${nToday} today${sb ? `, and ${sb} in the sandbox` : ''}.`
    : `None reported by visitors’ browsers in the last 7 days${sb ? ` (${sb} in the sandbox)` : ''}.`;
  const rowH = e => `<li class="ss-check info"><span class="ss-cic">${icon(e.day === today ? 'circle-alert' : 'info')}</span>
    <div class="ss-cbody"><span class="ss-ct">${esc(errWords(e.message))}${e.place ? ` on ${esc(e.place)}` : ''}</span><span class="ss-cl">${esc([`${e.reports} ${e.reports === 1 ? 'report' : 'reports'}`, `last ${fmtDate(e.last_at)}`].join(' · '))}</span>
      <details class="ss-errd"><summary>Details for Claude</summary><code>${esc([e.message, e.source].filter(Boolean).join('\n'))}</code></details></div></li>`;
  return `<p class="ss-sum">${icon(n ? 'circle-alert' : 'circle-check')}<span><b>${n ? (nToday ? 'Errors today.' : 'Errors this week.') : 'No errors.'}</b> ${esc(words)}</span></p>
    ${top.length ? `<ul class="ss-checks" role="list" aria-label="The errors">${top.map(rowH).join('')}</ul>` : ''}
    <p class="ss-note">A report names the screen that broke and the error, never the person; nothing is sent with the privacy signal. Admins get a Slack message when ten or more arrive in an hour. Ask Claude to fix what shows here.</p>`;
}

// ---- the front page: the season checklist ----
function renderIndex() {
  const s = st(); loadReady(); loadSecrets(); loadLogins();
  // The tab row sits at the same height on all six pages (the critic: the checklist's own subtitle moved it 36px), so the
  // guide's link is a note under the checks instead.
  const rows = readyRows(), help = `<p class="ss-note ss-guide">${icon('book-open')}<a href="#/help/session">What changes when a session starts</a></p>`;
  const recheck = rows || s.readyErr ? btn('Check again', { kind: 'text', icon: 'rotate-ccw', attrs: { 'data-recheck': '1', ...(s.readyBusy ? { 'aria-busy': 'true' } : {}) } }) : '';
  let ready;
  if (!rows) ready = s.readyErr ? notice('bad', 'circle-alert', `Could not run the checks. ${esc(s.readyErr)}`, btn('Try again', { kind: 'secondary', sm: true, attrs: { 'data-recheck': '1' } }))
    : '<div class="skel" style="height:160px" aria-busy="true" aria-label="Checking"></div>';
  else {
    const live = rows.filter(r => !r.waiting), soon = rows.length - live.length;
    const bad = live.filter(r => r.level === 'block' && r.ok === false).length, warn = live.filter(r => r.level === 'warn' && r.ok === false).length,
      todo = live.filter(r => r.level === 'manual' && !r.ok).length, open = rows.filter(r => r.ok !== true), pass = rows.filter(r => r.ok === true);
    const sum = [bad ? plural(bad, 'blocking problem') : 'Nothing is blocking', warn ? `${warn} to check` : '', todo ? `${todo} to tick off` : '', soon ? `${soon} not due yet` : ''].filter(Boolean).join(', ');
    ready = `<p class="ss-sum">${icon(bad ? 'circle-x' : 'circle-check')}<span><b>${bad ? 'Not ready yet.' : 'Ready.'}</b> ${esc(sum)}.</span></p>
      ${open.length ? `<ul class="ss-checks" role="list" aria-label="To fix or tick off">${open.map(readyRowHTML).join('')}</ul>` : ''}
      ${pass.length ? `<details class="ss-fold" data-pass${s.passOpen ? ' open' : ''}><summary>${icon('chevron-down', { cls: 'chev' })}<span>${plural(pass.length, 'check passes', 'checks pass')}</span></summary><ul class="ss-checks" role="list" aria-label="Passing">${pass.map(readyRowHTML).join('')}</ul></details>` : ''}`;
  }
  const errs = `<section class="ss-sec" aria-labelledby="ss-h-errs"><h2 class="ss-h2" id="ss-h-errs">The public page’s errors</h2>${errorsHTML()}</section>`;
  // From opening day the health checks lead ("Running well?") and the January checklist folds to one line (R-316 W57).
  if (inSession() && rows) {
    const health = rows.filter(r => !r.waiting && r.level !== 'manual' && r.ok === false);
    return `<div class="ss-page">${headOf('')}
      <section class="ss-sec" aria-labelledby="ss-h-run"><div class="ss-sechead"><h2 class="ss-h2" id="ss-h-run">Running well?</h2>${recheck}</div>
        ${health.length ? `<ul class="ss-checks" role="list" aria-label="To fix">${health.map(readyRowHTML).join('')}</ul>` : `<p class="ss-sum">${icon('circle-check')}<span><b>Running well.</b> Nothing needs you.</span></p>`}
        <details class="ss-fold"><summary>${icon('chevron-down', { cls: 'chev' })}<span>Ready for session? The checklist from before opening day</span></summary>${ready}</details>${help}</section>
      ${errs}</div>`;
  }
  return `<div class="ss-page">${headOf('')}
    <section class="ss-sec" aria-labelledby="ss-h-ready"><div class="ss-sechead"><h2 class="ss-h2" id="ss-h-ready">Ready for session?</h2>${recheck}</div>${ready}${help}</section>${errs}</div>`;
}

// ---- the rows of a group: each a setting's name and its value in one line, with one control (spec 7.2, D16) ----
const ssList = (label, rows, cls = '') => `<ul class="ss-list${cls ? ' ' + cls : ''}" role="list" aria-label="${esc(label)}">${rows.filter(Boolean).join('')}</ul>`;
const ssSec = (id, title, body, sub = '') => `<section class="ss-sec" id="ss-${id}" aria-labelledby="ss-h-${id}"><h2 class="ss-h2" id="ss-h-${id}" tabindex="-1">${esc(title)}</h2>${sub ? `<p class="ss-sub">${sub}</p>` : ''}${body}</section>`;
const rowIn = (name, line) => `<span class="ss-rtext"><span class="ss-rt">${esc(name)}</span>${line ? `<span class="ss-rl">${line}</span>` : ''}</span>`;
// The whole row opens the sheet where the setting is typed.
const openRow = (key, name, line, id = key) => `<li class="ss-row" id="ss-r-${esc(id)}"><button type="button" class="ss-rmain" data-ssopen="${esc(key)}" aria-haspopup="dialog">${rowIn(name, line)}${icon('chevron-right', { cls: 'ss-chev' })}</button></li>`;
const linkRow = (href, name, line, id) => `<li class="ss-row"${id ? ` id="ss-r-${esc(id)}"` : ''}><a class="ss-rmain" href="${esc(href)}">${rowIn(name, line)}${icon('chevron-right', { cls: 'ss-chev' })}</a></li>`;
// A switch saves the moment it is flipped, with Undo.
const swRow = (id, name, on, line, a = {}) => `<li class="ss-row ss-sw" id="ss-r-${esc(id)}">${switchRow(id, esc(name), on, line, { 'data-ssauto': id, ...a })}</li>`;
// A row that does one thing on the spot (a test message, Connect).
const actRow = (id, name, line, button) => `<li class="ss-row ss-act" id="ss-r-${esc(id)}">${rowIn(name, line)}${button ? `<span class="ss-ract">${button}</span>` : ''}</li>`;
const hstDay = d => new Date(String(d).slice(0, 10) + 'T12:00:00-10:00').toLocaleDateString('en-US', { timeZone: 'Pacific/Honolulu', weekday: 'short', month: 'numeric', day: 'numeric' }).replace(',', '');

// Before each session: the coalitions, then the session's days, its bills and the committee map.
function groupSession() {
  const yr = sessionYear(), cal = (S.sessionCal || []).find(x => x.session_year === yr) || {}, off = cal.off_days || [], b = (S.syncCfg || {}).burst_until;
  const coal = S.campaigns.map(c => { const own = advocate(c.owner_id), kw = (c.keywords || []).length;
    return openRow('coal:' + c.id, c.name, esc([own ? `${own.full_name.split(' ')[0]}${own.is_active === false ? ' (turned off)' : ''}` : 'No owner', plural(kw, 'keyword'), c.slack_channel || 'no Slack channel'].join(' · ')), 'coal-' + c.id); });
  const days = cal.opening_day ? `Opens ${hstDay(cal.opening_day)}${cal.sine_die ? ` · ends ${hstDay(cal.sine_die)}` : ''} · ${plural(off.length, 'day')} off` : 'Not entered yet';
  const sync = b && b >= new Date().toISOString().slice(0, 10) ? `4 more syncs a day until ${fmtDate(b)}` : 'Syncs 4 times a day';
  return ssSec('coalitions', 'Coalitions', ssList('Coalitions', coal, 'ss-two'), esc(status('coalitions')) + '. The owner gets every bill tracked under it; keywords suggest new bills.')
    + ssSec('session', `The ${yr} session`, ssList('The session', [
      openRow('days', 'Session days', esc(days)),
      openRow('sync', 'Bill sync', esc(sync)),
      openRow('load', 'Load the session’s bills', 'From Open States, once a session'),
      openRow('tracked', 'Replace the tracked list', 'From the team spreadsheet’s export'),
      openRow('map', 'Committee map', esc(plural((S.counterparts || []).length, 'House and Senate pair'))),
    ], 'ss-two'));
}
// The positions alerts post for, said as what we do with a bill (the critic: "6 positions" did not say which).
function posWords(ps) {
  const has = ks => ks.filter(k => ps.includes(k)).length, or = xs => xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} or ${xs[xs.length - 1]}`;
  const sup = has(['strongly_support', 'support', 'support_amend']), opp = has(['strongly_oppose', 'oppose']);
  const vs = [sup ? (sup === 1 && ps.includes('strongly_support') ? 'strongly support' : 'support') : '', opp ? (opp === 1 && ps.includes('strongly_oppose') ? 'strongly oppose' : 'oppose') : '',
    ps.includes('neutral') ? 'comment on' : '', ps.includes('monitor') ? 'monitor' : ''].filter(Boolean);
  return vs.length ? `for bills we ${or(vs)}` : 'for no bills yet: pick the positions';
}
// Alerts and messages: every email and Slack setting on one page (V28: Slack was set in 6 parts).
function groupAlerts() {
  const c = S.emailCfg || {}, cfg = S.slackCfg || {}, d = cfg.daily || {}, s = st(); loadTeamEmail();
  const tpl = cfg.templates || {}, changed = TEMPLATE_KINDS.filter(([k]) => String(tpl[k] || '').trim()).length, withCh = S.campaigns.filter(x => x.slack_channel).length;
  const emailLine = S.emailCfgErr ? esc(`${S.emailCfgErr} Until then the app treats email as paused.`)
    : c.enabled === false ? `Paused: nothing is sent${c.changed_at ? ` · since ${esc(fmtDate(c.changed_at))}` : ''}` : 'On: alerts and approved emails go out';
  const sender = [`From ${c.from_email || 'alerts@hiphi.org'}`, `replies to ${c.reply_to || 'info@hiphi.org'}`, c.postal ? 'postal address set' : 'hiphi.org’s postal address'].join(' · ');
  const dChan = d.channel || 'the main channel';
  return ssSec('email', 'Email', ssList('Email', [
      swRow('ss-email-on', 'Send email', c.enabled !== false, emailLine),
      openRow('sender', 'Sender and postal address', esc(sender)),
      s.teamEmail === null ? '' : swRow('ss-teamemail', 'Email to the team', !!s.teamEmail, s.teamEmail ? 'On: someone Slack cannot find gets their messages by email' : 'Off: their messages go to the next person Slack can reach'),
    ]))
    + ssSec('slack', 'Hearing alerts in Slack', ssList('Slack', [
      openRow('where', 'Where hearing alerts post', esc(`${cfg.main_channel ? `${cfg.main_channel} ` : 'No main channel yet · alerts '}${posWords(cfg.positions || [])} · ${withCh} of ${plural(S.campaigns.length, 'coalition')} also post to their own channel`)),
      // One row for the daily list (the critic: its time was said in two rows): whether it posts, when and where, in one sheet.
      openRow('daily', 'Daily list of hearings', esc(d.enabled !== false ? `On: posts at ${hhmm(d.time || '07:00')} in ${dChan} · ${d.days_ahead || 7} days ahead${d.post_when_empty ? ' · even with none coming' : ''}` : 'Off')),
      swRow('ss-wfdm', 'Testimony steps as Slack messages', cfg.workflow_dm !== false, cfg.workflow_dm !== false ? 'On: each step reaches its person in Slack' : 'Off: they go by email instead'),
      swRow('ss-health', 'Tell admins about pipeline problems', cfg.health_dm !== false, 'A Slack message to each admin'),
      swRow('ss-quiet', 'Tell admins when a notice alerts nobody', cfg.quiet_dm !== false, 'A hearing for bills we do not track, or have no position on'),
      openRow('templates', 'Message wording', esc(`${plural(TEMPLATE_KINDS.length, 'Slack message')} · ${changed ? `${changed} changed from the standard` : 'all standard'}`)),
    ]));
}
// Connections: plain status lines that name Claude's part, the keys under a closed "Technical details".
function groupConnections(route) {
  loadSecrets(); const sec = st().secrets, cal = S.calCfg || {}, cfg = S.slackCfg || {}, wait = 'Checking…';
  const slack = !sec ? wait : sec.slack_bot_token ? `Connected: alerts post to ${esc(cfg.main_channel || 'the main channel')}` : 'Not set up yet: ask Claude to connect it';
  const calLine = !sec ? wait : sec.google_calendar_refresh_token ? (cal.calendar_id ? `Connected: hearings go to the “${esc(cal.name || 'HIPHI Hearings')}” calendar` : 'Connected, but the calendar is not made yet: press Connect again')
    : sec.google_oauth_client_id && sec.google_oauth_client_secret ? 'Not connected yet: press Connect' : 'Not set up yet: ask Claude to connect it';
  const yt = !sec ? wait : sec.youtube_api_key ? 'Key set: the daily sync searches the week’s hearing videos' : 'Feed only: the newest 15 videos per chamber. Ask Claude for a key to search the whole week';
  const k = (id, key, label, ph, help = '') => { const set = sec?.[key]; return field(id, label + (sec ? ` · ${set ? 'set' : 'not set'}` : ''), `<input id="${id}" type="password" placeholder="${esc(set ? 'Saved. Type a new one to replace it' : ph)}" autocomplete="new-password" data-key="${key}"${help ? ` aria-describedby="${id}-help"` : ''}>`, help); };
  const open = route.section === 'keys' || route.q?.part === 'keys';
  const keys = `<details class="ss-tech" id="ss-keys"${open ? ' open' : ''}><summary>${icon('chevron-down', { cls: 'chev' })}<span>Technical details: the keys</span></summary>
    <div class="ss-techin st-form"><p class="ss-note">Keys are write-only: once saved they show as set and are never shown again. Leave a box blank to keep what is there; type clear to remove a key.</p>
      ${k('st-slacktok', 'slack_bot_token', 'Slack bot token', 'xoxb-…')}
      ${k('st-gid', 'google_oauth_client_id', 'Google client ID', '….apps.googleusercontent.com')}${k('st-gsec', 'google_oauth_client_secret', 'Google client secret', 'GOCSPX-…')}
      <p class="ss-note">The Google client must be a Web application with this redirect address:</p><p class="ss-uri"><code id="st-redir">${esc(SUPABASE_URL)}/functions/v1/google-connect</code>${btn('Copy', { kind: 'text', sm: true, icon: 'copy', attrs: { 'data-copyredir': '1', 'aria-label': 'Copy the redirect address' } })}</p>
      ${k('st-ytkey', 'youtube_api_key', 'YouTube API key', 'AIza…', 'In Google Cloud: the HIPHI project, APIs and Services, enable YouTube Data API v3, then make an API key under Credentials.')}
      <div class="btnrow">${btn('Save keys', { kind: 'secondary', icon: 'key-round', attrs: { 'data-sskeys': '1' } })}</div></div></details>`;
  return ssSec('conn', 'Slack, Google Calendar and YouTube', ssList('Connections', [
      actRow('slack', 'Slack', slack, sec?.slack_bot_token ? btn('Send me a test message', { kind: 'secondary', sm: true, icon: 'send', attrs: { 'data-slacktest': '1' } }) : ''),
      actRow('cal', 'Google Calendar', calLine, sec && (sec.google_calendar_refresh_token || (sec.google_oauth_client_id && sec.google_oauth_client_secret)) ? btn(sec.google_calendar_refresh_token ? 'Connect again' : 'Connect', { kind: 'secondary', sm: true, icon: 'calendar-plus', attrs: { 'data-connect': '1' } }) : ''),
      swRow('ss-cal-on', 'Calendar events for hearings', cal.enabled !== false, cal.enabled !== false ? 'On: each hearing we follow goes on the calendar' : 'Off'),
      swRow('ss-cal-test', 'Include [TEST] hearings', cal.include_test !== false, 'The practice hearings Claude uses to check the pipeline'),
      actRow('yt', 'YouTube', yt, ''),
    ]), 'What the tracker is connected to. Claude sets each one up; the keys are under Technical details.') + keys;
}
// Public page: the embed, the A/B tests (those ready to decide in sight) and the tester sheet.
function groupPublic() {
  loadAb(); const A = st().ab, bar = A && abBar(A.tests), ready = A ? A.tests.filter(t => abState(t, A.res, bar).ready) : [];
  const tests = A ? `${A.tests.filter(t => t.is_on).length} of ${plural(A.tests.length, 'test')} running · ${ready.length ? `${ready.length} ready to decide` : 'none ready to decide'}` : 'The public page’s A/B tests';
  return ssSec('pub', 'The public tracker', ssList('The public page', [
    openRow('embed', 'Website embed', 'A table of the bills we take a public position on, for hiphi.org'),
    linkRow('#/setup/tests', 'A/B tests', esc(tests), 'tests'),
    ...ready.map(t => linkRow(`#/setup/test?t=${encodeURIComponent(t.key)}`, t.name, 'Ready to decide: its numbers say “Trust it”')),
    linkRow('#/setup/room', 'Tester sheet', 'A link and a QR code for each group of testers', 'room'),
  ]), 'What the public sees on hiphi.org and the tracker, and the tests that try new versions of it.');
}
// Privacy and safety: Forget a person in its own section, people's lists, how long things are kept.
function groupPrivacy() {
  loadRetention(); loadOffLists(); const s = st(), r = s.ret, offs = s.offLists || [];
  const forget = ssSec('forget', 'Forget a person', `<div class="ss-box"><p class="ss-p">For someone who writes to <a href="mailto:contact@hiphi.org">contact@hiphi.org</a> asking HIPHI to delete what it has; the tracker promises an answer within 10 business days. It cannot be undone, and never touches a team member.</p>
    ${btn('Forget a person…', { kind: 'secondary', icon: 'trash-2', attrs: { 'data-ssopen': 'forget', 'aria-haspopup': 'dialog' } })}</div>`);
  const lists = ssSec('lists', 'People’s lists', ssList('People’s lists', [
    actRow('turnoff', 'Turn off a shared list', 'When a list shared on the public page is used to harm; nothing is erased', btn('Turn off a list', { kind: 'secondary', sm: true, attrs: { 'data-ssopen': 'turnoff', 'aria-haspopup': 'dialog' } })),
    ...offs.map(l => actRow('ul-' + l.id, l.title, esc(`Turned off ${fmtDate(l.blocked_at)}${l.blocked_by ? ` by ${l.blocked_by}` : ''}${l.blocked_reason ? `: ${l.blocked_reason}` : ''}`), btn('Turn back on', { kind: 'text', sm: true, attrs: { 'data-ulon': l.id, 'aria-label': `Turn ${l.title} back on` } }))),
  ]), s.offListsErr ? esc(`Could not load the lists turned off. ${s.offListsErr}`) : '');
  let keep;
  if (s.retErr) keep = notice('bad', 'circle-alert', `Could not load the keeping periods. ${esc(s.retErr)}`);
  else if (!r) keep = '<div class="skel" style="height:120px" aria-busy="true" aria-label="Loading"></div>';
  else { const k = r.kinds || [], due = k.reduce((n, x) => n + (+x.due || 0), 0), soon = k.reduce((n, x) => n + (+x.soon || 0), 0);
    const counts = due || soon ? `${plural(due, 'record')} past ${due === 1 ? 'its' : 'their'} period, ${soon} more within 30 days` : 'nothing past its period';
    keep = `${ssList('The clean-up', [swRow('ss-ret', 'Nightly clean-up', !!r.on, esc(`${r.on ? 'On: it deletes what is past its period' : 'Off: it only counts'} · ${counts}`))])}
      <p class="ss-note">${r.last_run ? `Last counted ${esc(fmtDate(r.last_run))}.` : 'The nightly clean-up has not run yet; these counts are from now.'} ${btn('Count again', { kind: 'text', sm: true, icon: 'refresh-cw', attrs: { 'data-kpcount': '1' } })}</p>
      <details class="ss-fold"><summary>${icon('chevron-down', { cls: 'chev' })}<span>How long each kind of record is kept</span></summary>
      <div class="ss-tablewrap"><table class="ss-table"><caption class="sr">How long each kind of record is kept</caption><thead><tr><th scope="col">Kind</th><th scope="col">Kept</th><th scope="col" class="num">Past it</th><th scope="col" class="num">Within 30 days</th></tr></thead>
        <tbody>${k.map(x => `<tr><th scope="row">${esc(x.label)}</th><td>${esc(x.period)}</td><td class="num">${x.due}</td><td class="num">${x.soon}</td></tr>`).join('')}</tbody></table></div>
      <p class="ss-note">The periods are Nate’s, set 5 October. Numbers never confirmed are held until texts really go out; accounts unused for two years are counted, and the warning email needs a sender that does not exist yet. Postmark keeps sent email for 45 days on its side, as the privacy page says.</p></details>`; }
  return forget + lists + ssSec('keeping', 'Privacy and keeping', keep);
}
const GROUP_HTML = { session: groupSession, alerts: groupAlerts, connections: groupConnections, public: groupPublic, privacy: groupPrivacy };
// The tabs name each group; a group's own words are its sections' (A-14: say it once).
const GROUP_SUB = {};
function renderGroup(key, route) {
  return `<div class="ss-page ss-g-${key}">${headOf(key, GROUP_SUB[key] || '')}${GROUP_HTML[key](route)}</div>`;
}
// A page under the Public page says where Back goes above its title on a laptop too (B-4; the critic: only the phone's top bar
// drew it). It says what the frame's Back says: the page it was opened from, else its parent. Styled in partners.css (.pe-back).
const backOf = k => SUB[k] ? { href: k === 'test' ? '#/setup/tests' : '#/setup/public', label: k === 'test' ? 'Tests' : 'Public page' } : null;
const backLink = b => { if (!b) return ''; let from = ''; try { from = history.state?.d > 0 ? history.state?.from || '' : ''; } catch { from = ''; }
  return `<a class="pe-back" href="${esc(b.href)}" data-back>${icon('chevron-left')}<span>${esc(from || b.label)}</span></a>`; };
// Below 768px the six tabs are one row that scrolls sideways (partners.css), so the open one is scrolled into sight.
function placeTabs(root) {
  const nav = root.querySelector('.ss-page .v6-tabs'), cur = nav?.querySelector('[aria-current="page"]'); if (!cur || nav.scrollWidth <= nav.clientWidth + 1) return;
  const n = nav.getBoundingClientRect(), c = cur.getBoundingClientRect();
  if (c.right > n.right - 16) nav.scrollLeft += c.right - n.right + 48; else if (c.left < n.left + 16) nav.scrollLeft -= n.left - c.left + 48;
}
// The Public page's own pages (the tests, one test, the tester sheet) keep v5's content under the place's tabs.
function renderSub(key) {
  const p = PAGES[key], [ic, line] = p.status(), title = p.title ? p.title() : SUB[key];
  const act = key === 'room' ? btn('Print the sheet', { icon: 'printer', attrs: { 'data-ssprint': '1' } }) : '';
  return `<div class="ss-page ss-subpage">${backLink(backOf(key))}${headOf('public')}
    <div class="ss-subhead"><div><h2 class="ss-h2" id="ss-h-sub" tabindex="-1">${esc(title)}</h2><p class="ss-status">${icon(ic)}<span>${line}</span></p></div>${act}</div>
    <div class="st-formwrap" data-stform>${p.body()}</div></div>`;
}

// ---- the sheets: one per typed setting, with its own Save (and Undo); anything typed and not saved comes back ----
function formSheet(key, { title, body, save, saveLabel = 'Save', size = 'auto', wire, danger = false, intro = '' }) {
  const s = st(), was = s.draft[key];
  openSheet({ title, size,
    body: `${intro}${was ? `<p class="ss-unsaved">${icon('circle-dot')}<span>Not saved yet: what you typed last time is back.</span></p>` : ''}<form class="st-form ss-form" novalidate data-ssform>${body}<button type="submit" hidden tabindex="-1" aria-hidden="true"></button></form>`,
    foot: `${btn('Cancel', { kind: 'text', attrs: { 'data-sscancel': '1' } })}${btn(saveLabel, { kind: danger ? 'danger' : 'primary', attrs: { 'data-sssave': '1' } })}`,
    wire: d => {
      const form = d.querySelector('[data-ssform]');
      const fields = () => [...form.querySelectorAll('input, select, textarea')].filter(el => el.id && el.type !== 'file' && !el.readOnly);
      if (was) for (const el of fields()) if (el.id in was) { if (el.type === 'checkbox' || el.type === 'radio') el.checked = !!was[el.id]; else el.value = was[el.id]; }
      const keep = () => { s.draft[key] = Object.fromEntries(fields().map(el => [el.id, el.type === 'checkbox' || el.type === 'radio' ? el.checked : el.value])); };
      form.addEventListener('input', keep); form.addEventListener('change', keep);
      if (wire) wire(d, form);
      d.querySelector('[data-sscancel]').onclick = () => { delete s.draft[key]; closeSheet(); };
      const go = async () => {
        const b = d.querySelector('[data-sssave]'); if (b.getAttribute('aria-busy')) return;
        clearErrs(d); b.setAttribute('aria-busy', 'true');
        try { const out = await save(form); if (!out) return;
          delete s.draft[key]; if (d.isConnected) await closeSheet({ silent: true }); hooks.render();
          const o = typeof out === 'string' ? { text: out } : out;
          toast(o.text, { ok: !o.plain, ...(o.undo ? { undo: async () => { await o.undo(); hooks.render(); toast('Undone.'); } } : {}) });
          document.querySelector(`[data-ssopen="${CSS.escape(key)}"]`)?.focus({ preventScroll: true });
        } catch (e) { toast(e, { err: true }); }
        finally { b.removeAttribute('aria-busy'); }
      };
      d.querySelector('[data-sssave]').onclick = go; form.onsubmit = e => { e.preventDefault(); go(); };
    } });
}
const okMail = v => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
const SHEETS = {
  sender() { const c = S.emailCfg || {};
    formSheet('sender', { title: 'Sender and postal address',
      body: `${txt('st-email-postal', 'Postal address', c.postal || '', { ph: '707 Richards Street, Suite 300, Honolulu, HI 96813', help: 'Printed at the foot of every email to the public: the law asks for a real mailing address. Blank uses the hiphi.org address.' })}
        ${txt('st-email-from', 'Public email comes from', c.from_email || '', { type: 'email', ph: 'alerts@hiphi.org', help: 'Shown as “HIPHI Bill Tracker”. It must be a hiphi.org address Postmark sends from.' })}
        ${txt('st-email-reply', 'Replies go to', c.reply_to || '', { type: 'email', ph: 'info@hiphi.org', help: 'A mailbox a person reads. Replies to a supporter email go to whoever wrote it.' })}`,
      // The sender fields only, never "enabled" (Z1-5): the save merges them into what is stored, and refuses when the settings
      // could not be read. From "HIPHI Bill Tracker", replies to a person (R-101 rule 7).
      save: async f => { const from = val(f, 'st-email-from'), reply = val(f, 'st-email-reply');
        if (!okMail(from)) { fieldErr(f, 'st-email-from', 'Enter an email address like alerts@hiphi.org, or leave it blank.'); return null; }
        if (!okMail(reply)) { fieldErr(f, 'st-email-reply', 'Enter an email address like info@hiphi.org, or leave it blank.'); return null; }
        const before = { postal: c.postal || '', from_email: c.from_email || '', reply_to: c.reply_to || '', from_name: 'HIPHI Bill Tracker' };
        await DB.saveEmailSettings({ postal: val(f, 'st-email-postal'), from_email: from, from_name: 'HIPHI Bill Tracker', reply_to: reply });
        return { text: 'Saved.', undo: () => DB.saveEmailSettings(before) }; } }); },
  where() { const c = S.slackCfg || {}, pos = new Set(c.positions || []);
    formSheet('where', { title: 'Where hearing alerts post',
      body: `${txt('st-main', 'Main Slack channel', c.main_channel || '', { ph: '#hearing-alerts-2027', help: 'Every hearing alert posts here. Each bill also posts to its coalition’s channel, set on the coalition under Each session.' })}
        <fieldset class="ss-fs"><legend>Post alerts for bills we</legend><div class="ss-checks2">${POS_OPTS.map(([v, l]) => `<label class="ss-check2"><input type="checkbox" id="ss-pos-${v}" value="${v}"${pos.has(v) ? ' checked' : ''}><span>${esc(l)}</span></label>`).join('')}</div></fieldset>`,
      save: async f => { const positions = POS_OPTS.map(([v]) => v).filter(v => f.querySelector('#ss-pos-' + v)?.checked);
        await DB.saveSlackSettings({ ...c, main_channel: val(f, 'st-main') || '#hearing-alerts-2027', positions }, []);
        return { text: 'Saved. Alerts post where you said.', undo: () => DB.saveSlackSettings(c, []) }; } }); },
  daily() { const c = S.slackCfg || {}, d = c.daily || {};
    formSheet('daily', { title: 'Daily list of hearings',
      body: `<label class="ss-check2"><input type="checkbox" id="st-d-on"${d.enabled !== false ? ' checked' : ''}><span>Post a daily list of the coming hearings in Slack</span></label>
        <div class="ss-grid">${txt('st-d-time', 'Post at', d.time || '07:00', { type: 'time' })}${txt('st-d-days', 'Days ahead', d.days_ahead || 7, { type: 'number', attrs: 'min="1" max="30" inputmode="numeric"' })}</div>
        ${txt('st-d-chan', 'Channel', d.channel || '', { ph: 'The main channel', help: 'Leave it blank to use the main channel.' })}
        <label class="ss-check2"><input type="checkbox" id="st-d-empty"${d.post_when_empty ? ' checked' : ''}><span>Post even when no hearings are coming</span></label>`,
      save: async f => { const n = Number(val(f, 'st-d-days')) || 7;
        if (n < 1 || n > 30) { fieldErr(f, 'st-d-days', 'Between 1 and 30 days.'); return null; }
        await DB.saveSlackSettings({ ...c, daily: { ...d, enabled: !!f.querySelector('#st-d-on')?.checked, time: val(f, 'st-d-time') || '07:00', days_ahead: n, channel: val(f, 'st-d-chan') || null, post_when_empty: !!f.querySelector('#st-d-empty')?.checked } }, []);
        return { text: f.querySelector('#st-d-on')?.checked ? 'Saved. The daily list posts as you said.' : 'Saved. The daily list is off.', undo: () => DB.saveSlackSettings(c, []) }; } }); },
  templates() { const c = S.slackCfg || {}, tpl = c.templates || {};
    formSheet('templates', { title: 'Message wording', size: 'full',
      intro: `<p class="ss-note">Leave a message blank to use the standard wording. Tokens you can use: ${esc(TOKENS)}. Slack formatting: *bold*, _italic_ and &lt;link|label&gt;; a link whose token is empty disappears on its own.</p>`,
      body: TEMPLATE_KINDS.map(([k]) => area('st-tpl-' + k, TEMPLATE_LABEL[k] || k, tpl[k] || '', { rows: 3, ph: 'Blank uses the standard wording', attrs: `data-tpl="${k}"` })).join(''),
      save: async f => { await DB.saveSlackSettings({ ...c, templates: { ...tpl, ...Object.fromEntries([...f.querySelectorAll('[data-tpl]')].map(t => [t.dataset.tpl, t.value])) } }, []);
        return { text: 'Wording saved.', undo: () => DB.saveSlackSettings(c, []) }; } }); },
  days() { const yr = sessionYear(), c = (S.sessionCal || []).find(x => x.session_year === yr) || {};
    formSheet('days', { title: `Session days, ${yr}`,
      intro: '<p class="ss-note">These drive “Legislative day 27 of 58”. Copy them from the Public Access Room’s session calendar; weekends are skipped on their own.</p>',
      body: `<div class="ss-grid">${txt('st-sd-open', 'Opening day', String(c.opening_day || '').slice(0, 10), { type: 'date' })}${txt('st-sd-end', 'Adjournment sine die', String(c.sine_die || '').slice(0, 10), { type: 'date' })}</div>
        ${area('st-sd-off', 'Weekdays the chambers do not meet', (c.off_days || []).map(d => String(d).slice(0, 10)).join('\n'), { rows: 5, ph: '2027-02-15\n2027-02-25', help: 'Recess days, holidays and closures, one date per line, like 2027-02-15. Or send the calendar PDF to Claude.' })}`,
      save: async f => { const open = val(f, 'st-sd-open'), end = val(f, 'st-sd-end') || null, raw = val(f, 'st-sd-off').split(/[\s,;]+/).map(x => x.trim()).filter(Boolean);
        const bad = raw.filter(x => !/^\d{4}-\d{2}-\d{2}$/.test(x)), off = [...new Set(raw)].sort();
        if (!open) { fieldErr(f, 'st-sd-open', 'Enter the opening day.'); return null; }
        if (bad.length) { fieldErr(f, 'st-sd-off', `Not a date (use 2027-02-15): ${bad.slice(0, 3).join(', ')}`); return null; }
        const before = { session_year: yr, opening_day: c.opening_day || null, sine_die: c.sine_die || null, off_days: c.off_days || [] };
        await DB.saveSessionCalendar({ session_year: yr, opening_day: open, sine_die: end, off_days: off });
        return { text: `Saved the ${yr} session days.`, undo: before.opening_day ? () => DB.saveSessionCalendar(before) : null }; } }); },
  sync() { const cfg = S.syncCfg || {};
    formSheet('sync', { title: 'Bill sync',
      body: txt('st-burst', '4 more syncs a day until', cfg.burst_until || '', { type: 'date', help: 'For the opening weeks, when new bills arrive fast. Leave it blank to sync 4 times a day.' }),
      save: async f => { const until = val(f, 'st-burst') || null;
        await DB.saveSyncSettings({ ...cfg, burst_until: until });
        return { text: until ? `Saved. 4 more syncs a day until ${fmtDate(until)}.` : 'Saved. The bills sync 4 times a day.', undo: () => DB.saveSyncSettings(cfg) }; } }); },
  load() {
    formSheet('load', { title: 'Load the session’s bills', saveLabel: 'Start the import',
      intro: `<p class="ss-note">When Open States publishes a new session, paste its CSV export link. It loads every introduced bill with its full history and is safe to run again; it takes 10 to 30 minutes. <a href="https://open.pluralpolicy.com/data/session-csv" target="_blank" rel="noopener">Find the link on Plural ${icon('external-link')}</a></p>`,
      body: `<div class="ss-grid ss-grid-yr">${txt('st-bulk-year', 'Session year', sessionYear(), { type: 'number', attrs: 'inputmode="numeric"' })}${txt('st-bulk-url', 'CSV export link', '', { type: 'url', ph: `https://data.openstates.org/csv/latest/HI_${SESSION_YEAR + 1}_csv_….zip` })}</div>`,
      save: async f => { const url = val(f, 'st-bulk-url'), session = val(f, 'st-bulk-year');
        if (!/^https:\/\/data\.openstates\.org\/.+\.zip$/.test(url)) { fieldErr(f, 'st-bulk-url', 'That does not look like an Open States CSV export link (https://data.openstates.org/…zip).'); return null; }
        await DB.dispatch('bulk-import', { url, session });
        return { text: `Import started for ${session}. The checklist’s “${session} bills imported” turns to Done when it lands.`, plain: true }; } }); },
  // The team spreadsheet's export: what will change shows first; Apply makes the change (and reloads the app).
  tracked() { const s = st();
    openSheet({ title: 'Replace the tracked list', size: 'auto',
      body: `<p class="ss-p">Upload the All Tracked Bills export from the team spreadsheet, with the columns Bill Number, Coalition and Coalition Position. The bills in the file become the tracked list and every other bill is untracked; Strongly support becomes P1, every other position P2, and each bill goes to its coalition’s owner. You see what will change before anything does.</p>
        <div class="btnrow"><label class="btn secondary" for="st-csv">${icon('upload')}<span>${s.csv ? 'Choose another file' : 'Choose the CSV file'}</span></label><input type="file" id="st-csv" class="sr" accept=".csv,text/csv"></div>
        <div id="st-import-preview" aria-live="polite">${s.csv ? s.csv.html : ''}</div>`,
      wire: d => { const inp = d.querySelector('#st-csv');
        inp.onchange = async () => { const file = inp.files[0]; if (!file) return; const out = d.querySelector('#st-import-preview');
          const rows = parseTrackerCsv(await file.text());
          const show = html => { s.csv = { rows, html }; out.innerHTML = html; wireApply(d, rows); };
          if (!rows.length) return show(notice('bad', 'circle-alert', 'No bill rows found. The header row needs Bill Number, Coalition and Coalition Position.'));
          out.innerHTML = '<p class="ss-note">Checking the file…</p>';
          try { const r = await DB.importTracker(rows, false); show(importSummary(file.name, r)); }
          catch (e) { show(localSummary(file.name, rows) + notice('info', 'info', esc(DEMO ? 'The practice copy does not import. Use the live app to apply the file.' : e.message || 'Could not check the file.'))); } };
        wireApply(d, s.csv?.rows); } }); },
  map() {
    const codes = ch => Object.values(S.committees || {}).filter(c => c.chamber === ch).map(c => c.code).sort().join(', ');
    formSheet('map', { title: 'Committee map',
      intro: '<p class="ss-note">One pair per line, House code first, like HLT = HHS. A House committee can pair with several Senate ones, and the other way round. Used to guess the other chamber’s committees before a referral is posted; a companion bill’s real referral always comes first.</p>',
      body: `${area('st-cp', 'House = Senate pairs', (S.counterparts || []).map(p => `${p.house_code} = ${p.senate_code}`).join('\n'), { rows: 10 })}
        <p class="ss-note">House: ${esc(codes('H'))}</p><p class="ss-note">Senate: ${esc(codes('S'))}</p>`,
      save: async f => { const codes = new Set(Object.keys(S.committees || {})), pairs = [], bad = [], before = (S.counterparts || []).map(p => ({ house_code: p.house_code, senate_code: p.senate_code }));
        for (const line of val(f, 'st-cp').split('\n')) { const t = line.trim(); if (!t) continue; const m = /^([A-Z]{2,4})\s*[=→>-]+\s*([A-Z]{2,4})$/i.exec(t); if (!m) { bad.push(t); continue; }
          const h = m[1].toUpperCase(), sn = m[2].toUpperCase(); if (!codes.has(h) || !codes.has(sn)) { bad.push(t); continue; } if (!pairs.some(p => p.house_code === h && p.senate_code === sn)) pairs.push({ house_code: h, senate_code: sn }); }
        if (bad.length) { fieldErr(f, 'st-cp', `Not understood: ${bad.slice(0, 3).join(', ')}. Use two committee codes, like HLT = HHS.`); return null; }
        await DB.saveCounterparts(pairs); return { text: `${plural(pairs.length, 'pair')} saved.`, undo: () => DB.saveCounterparts(before) }; } }); },
  embed() {
    openSheet({ title: 'Website embed', size: 'auto',
      body: `<p class="ss-p">A table of each bill we take a public position on, its position and where it stands. It reads the public page’s own data, so notes, owners and drafts never show. Paste the code into an HTML block on hiphi.org or a coalition site.</p>
        <div class="st-form"><div class="ss-grid">${field('st-emb-coal', 'Show', `<select id="st-emb-coal"><option value="">Every coalition</option>${S.campaigns.filter(c => c.is_public && c.slug).map(c => `<option value="${esc(c.slug)}">${esc(c.public_name || c.name)}</option>`).join('')}</select>`)}
          ${field('st-emb-limit', 'How many bills', '<select id="st-emb-limit"><option value="">Up to 50</option><option value="10">10</option><option value="25">25</option><option value="200">All of them</option></select>')}</div>
        ${field('st-emb-code', 'The code', '<textarea id="st-emb-code" rows="5" readonly class="ss-code"></textarea>')}</div>`,
      foot: `<a class="btn text" id="st-emb-open" target="_blank" rel="noopener"><span>Preview</span>${icon('external-link')}</a>${btn('Copy the code', { icon: 'copy', attrs: { 'data-embcopy': '1' } })}`,
      wire: d => { const code = () => { const base = new URL('embed.html', location.href); base.search = ''; base.hash = ''; const c = d.querySelector('#st-emb-coal').value, l = d.querySelector('#st-emb-limit').value;
          if (c) base.searchParams.set('coalition', c); if (l) base.searchParams.set('limit', l);
          d.querySelector('#st-emb-open').href = base.href + (DEMO ? (base.search ? '&' : '?') + 'demo=1' : '');
          d.querySelector('#st-emb-code').value = `<iframe id="hiphi-tracker" src="${base.href}" title="HIPHI bill tracker" style="width:100%;border:0;min-height:420px" loading="lazy"></iframe>\n<script>addEventListener('message',function(e){if(e.data&&e.data.hiphiTrackerHeight)document.getElementById('hiphi-tracker').style.height=e.data.hiphiTrackerHeight+'px'})<\/script>`; };
        code(); d.querySelector('#st-emb-coal').onchange = code; d.querySelector('#st-emb-limit').onchange = code;
        d.querySelector('[data-embcopy]').onclick = async () => { const t = d.querySelector('#st-emb-code');
          try { await navigator.clipboard.writeText(t.value); toast('Code copied.', { ok: true }); } catch { t.focus(); t.select(); toast('Selected. Copy it with Ctrl+C or Cmd+C.'); } }; } }); },
  // Forget a person: the sheet is the confirm (its button is the danger one), so nothing asks twice (B-5: it cannot be undone).
  forget() {
    formSheet('forget', { title: 'Forget a person', saveLabel: 'Forget them', danger: true,
      intro: '<p class="ss-p">Give the email, the mobile number, or both. It stops their texts, deletes their tracker account and everything saved with it, erases the emails we kept for them and which ones they opened, and empties their supporter record down to “do not contact”, so a list upload cannot add them back. <b>It cannot be undone.</b></p>',
      body: `${txt('st-fg-email', 'Their email', '', { ph: 'name@example.com', type: 'email', attrs: 'inputmode="email" autocapitalize="off"' })}${txt('st-fg-phone', 'Their mobile number', '', { ph: '(808) 555-0123', type: 'tel', attrs: 'inputmode="tel"' })}`,
      save: async f => { const email = val(f, 'st-fg-email'), phone = val(f, 'st-fg-phone');
        if (!email && !phone) { fieldErr(f, 'st-fg-email', 'Give an email, a mobile number, or both.'); return null; }
        if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { fieldErr(f, 'st-fg-email', 'That does not look like an email address.'); return null; }
        if (phone && !/^\+?1?[\s().-]*[2-9]\d{2}[\s().-]*[2-9]\d{2}[\s.-]*\d{4}$/.test(phone)) { fieldErr(f, 'st-fg-phone', 'Enter a 10-digit mobile number, like (808) 555-0123.'); return null; }
        const r = await DB.forgetPerson(email, phone);
        const why = { nothing: 'Give an email or a number.', phone: 'That number is not a mobile number we can use.', email: 'That does not look like an email address.', team: 'That is a team member. Turn them off in People instead.' };
        if (!r.ok) { fieldErr(f, r.why === 'phone' ? 'st-fg-phone' : 'st-fg-email', why[r.why] || 'It could not be done.'); return null; }
        const t = r.trail || {}, bits = [r.accounts_deleted ? plural(r.accounts_deleted, 'account') + ' deleted' : '', r.numbers_stopped ? plural(r.numbers_stopped, 'number') + ' stopped' : '', t.emails_unsent || t.emails_sent_erased ? `${(t.emails_unsent || 0) + (t.emails_sent_erased || 0)} emails erased` : '', t.opens_clicks_erased ? `${t.opens_clicks_erased} open or click records erased` : '', r.supporter_records ? 'supporter record emptied' : ''].filter(Boolean);
        return `Done${r.demo ? ' (the practice copy: nothing was changed)' : ''}: ${bits.join(', ') || 'nothing was on file'}. Reply to the person to say so.`; } }); },
  turnoff() {
    formSheet('turnoff', { title: 'Turn off a shared list', saveLabel: 'Turn off this list', danger: true,
      intro: '<p class="ss-p">Anyone who adds their email on the public page can make lists of bills and share one by a link. If someone sends you a link to a list that misuses HIPHI’s page, paste it here: its link stops working, the people who followed it stop seeing it, and its maker cannot share it again. Nothing is erased, and you can turn it back on.</p>',
      body: `${txt('st-ul-link', 'The list’s link', '', { ph: 'https://…/track.html#/l/…' })}${area('st-ul-why', 'Why, for the record (optional)', '', { rows: 2, ph: 'For example: used to harass someone' })}`,
      save: async f => { const link = val(f, 'st-ul-link');
        if (!/[0-9a-f]{40}/.test(link)) { fieldErr(f, 'st-ul-link', 'Paste the whole link. It ends in #/l/ and 40 letters and numbers.'); return null; }
        const title = await DB.turnOffList(link, val(f, 'st-ul-why')); st().offLists = null; return `Turned off ${title}.`; } }); },
};
// A coalition's sheet: owner, Slack channel, keywords, the public name, icon and line (v5's Coalitions part, one at a time).
function coalSheet(id) {
  const c = S.campaigns.find(x => x.id === id); if (!c) return;
  const act = S.advocates.filter(a => a.is_active !== false), own = advocate(c.owner_id), who = own && own.is_active === false ? [...act, own] : act, ic = iconName(c.icon);
  formSheet('coal:' + id, { title: esc(c.name), size: 'auto',
    body: `${field('co-own', 'Owner', `<select id="co-own"><option value="">No owner</option>${who.map(a => `<option value="${esc(a.id)}"${c.owner_id === a.id ? ' selected' : ''}>${esc(teamName(a))}</option>`).join('')}</select>`, 'Gets every bill tracked under the coalition.')}
      ${txt('co-ch', 'Slack channel', c.slack_channel || '', { ph: '#channel-name', help: 'Its bills’ hearing alerts post here too.' })}
      ${area('co-kw', 'Keywords', (c.keywords || []).join(', '), { rows: 2, ph: 'tobacco, e-cigarette, nicotine', help: 'Separate them with commas. A short fragment catches longer words: fluorid finds fluoride and fluoridation.' })}
      ${txt('co-pub', 'Name on the public page', c.public_name || '', { ph: 'What visitors see' })}
      ${txt('co-desc', 'One friendly sentence for its tile', c.description || '', { ph: 'What this coalition works on' })}
      <fieldset class="ss-fs"><legend>Icon on the public page</legend><div class="ss-icons">${ICON_CHOICES.map(([n, l]) => `<label class="ss-ic" title="${esc(l)}"><input type="radio" name="co-ic" id="co-ic-${n}" value="${n}"${ic === n ? ' checked' : ''}><span class="ss-icb">${icon(n)}</span><span class="sr">${esc(l)}</span></label>`).join('')}</div></fieldset>`,
    save: async f => {
      const keywords = val(f, 'co-kw').split(',').map(x => x.trim()).filter(Boolean);
      const patch = { owner_id: f.querySelector('#co-own').value || null, slack_channel: val(f, 'co-ch') || null, keywords, icon: f.querySelector('[name="co-ic"]:checked')?.value || ic,
        description: val(f, 'co-desc') || null, public_name: val(f, 'co-pub') || null };
      const before = Object.fromEntries(Object.keys(patch).map(k => [k, c[k] ?? null]));
      await DB.saveCampaign(c.id, patch); if (S.triage) S.triage.rows = null;   // new keywords change Sort new bills' suggestions
      return { text: `${c.name} saved.`, undo: () => DB.saveCampaign(c.id, before) }; } });
}

// ---- the switches: each saves the moment it is flipped, with Undo for ten seconds (B-5); one that would turn email ON asks
// first, because that starts mail to the public, and a failed save puts the switch back ----
const slackAuto = (k, daily) => ({ cfg: 'slackCfg', save: c => DB.saveSlackSettings(c, []), apply: (c, v) => daily ? { ...c, daily: { ...(c.daily || {}), [k]: v } } : { ...c, [k]: v } });
const AUTO = {
  'ss-email-on': { cfg: 'emailCfg', save: c => DB.saveEmailSettings({ enabled: c.enabled, changed_at: c.changed_at, changed_by: c.changed_by }),
    apply: (c, v) => ({ ...c, enabled: v, changed_at: new Date().toISOString(), changed_by: S.me?.initials || null }),
    confirm: v => { if (!v || S.emailCfgErr) return null; const n = (S.alerts || []).filter(a => a.status === 'approved' && a.scheduled_for).length;
      return { title: 'Turn email on?', text: `Staff alerts, and alerts and hearing emails to the public, start going out again. Alerts held while it was paused are not sent.${n ? ` ${n === 1 ? 'One approved supporter email has' : `${n} approved supporter emails have`} waited, and ${n === 1 ? 'goes' : 'go'} out in the next 4:30 pm email.` : ''}`, ok: 'Turn email on' }; },
    msg: v => v ? 'Saved. Email is on.' : 'Saved. Email is paused: nothing will be sent.' },
  'ss-wfdm': slackAuto('workflow_dm'), 'ss-health': slackAuto('health_dm'), 'ss-quiet': slackAuto('quiet_dm'),
  'ss-cal-on': { cfg: 'calCfg', save: c => DB.saveCalendarSettings(c), apply: (c, v) => ({ ...c, enabled: v }) },
  'ss-cal-test': { cfg: 'calCfg', save: c => DB.saveCalendarSettings(c), apply: (c, v) => ({ ...c, include_test: v }) },
};
// Two switches keep their own value: Email to the team (app_settings) and the nightly clean-up (backend 159).
const OWN = {
  'ss-teamemail': { set: async v => { await DB.setTeamEmail(v); st().teamEmail = v; }, msg: v => v ? 'Email to the team is on.' : 'Email to the team is off.' },
  'ss-ret': { set: async v => { await DB.retentionSet(v); st().ret = null; loadRetention(true); }, msg: v => v ? 'The nightly clean-up is on.' : 'The nightly clean-up is off.',
    confirm: v => v ? { title: 'Turn the clean-up on?', text: 'Each night the database will delete what is past its keeping period: email text and open and click history after 7 years, stopped numbers after 4, accounts unused for 3 years, and error reports after a year. Nothing in the database is that old yet. You can turn it off again here.', ok: 'Turn it on' } : null },
};
async function flip(id, v) {
  const a = AUTO[id], o = OWN[id], ask = (a || o)?.confirm?.(v);
  if (ask && !(await confirmSheet(ask))) return false;
  if (o) { try { await o.set(v); } catch (e) { toast(e, { err: true }); return false; } hooks.render(); return true; }
  const before = S[a.cfg];
  try { await a.save(a.apply({ ...(before || {}) }, v)); } catch (e) { S[a.cfg] = before; toast(e, { err: true }); return false; }
  hooks.render(); return true;
}
const sayFlip = (id, v) => (AUTO[id]?.msg || OWN[id]?.msg || (() => 'Saved.'))(v);

// ---- wiring ----
function wirePage(route, root) {
  const s = st(), main = root.querySelector('.ss-page'); if (!main) return;
  main.querySelectorAll('[data-recheck]').forEach(b => b.onclick = () => { s.ready = null; loadReady(true); loadErrors(true); hooks.render(); });
  main.querySelector('[data-pass]')?.addEventListener('toggle', e => { s.passOpen = e.target.open; });
  main.querySelectorAll('[data-rman]').forEach(b => b.onclick = async () => {
    const on = !!b.dataset.on, r = (s.ready || []).find(x => x.key === b.dataset.rman); b.setAttribute('aria-busy', 'true');
    try { await DB.saveReadinessManual(b.dataset.rman, on); if (r) r.ok = on; hooks.render(); toast(on ? 'Marked done.' : 'Marked not done.', { ok: on, undo: async () => { await DB.saveReadinessManual(b.dataset.rman, !on); if (r) r.ok = !on; hooks.render(); } }); }
    catch (e) { toast(e, { err: true }); b.removeAttribute('aria-busy'); } });
  const g = main.querySelector('[data-gaps]');
  if (g) g.onclick = () => { const r = readyRows().find(x => x.key === 'public_copy');
    openSheet({ title: 'Bills missing public copy', size: 'full', body: `<p class="ss-p">Open each one and fill in its Public tab.</p><div class="rows">${r.gaps.map(b => row({ title: b.nickname ? `<b class="bn-nick">${esc(b.nickname)}</b> <span class="bn-num">${esc(billNum(b))}</span>` : `<b>${esc(billNum(b))}</b>`, sub: [!(b.public_summary || '').trim() ? 'No summary' : '', !(b.public_action || '').trim() ? 'No ask' : ''].filter(Boolean).join(' · '), href: billRoute(b, 'public') })).join('')}</div>`,
      wire: d => d.querySelectorAll('a[href^="#/"]').forEach(a => a.onclick = e => { e.preventDefault(); goAfterSheet(a.getAttribute('href')); }) }); };
  main.querySelectorAll('[data-ssopen]').forEach(b => b.onclick = () => { const k = b.dataset.ssopen; if (k.startsWith('coal:')) coalSheet(k.slice(5)); else SHEETS[k]?.(); });
  main.querySelectorAll('[data-ssauto]').forEach(el => el.onchange = async () => {
    const id = el.dataset.ssauto, v = el.checked;
    if (!(await flip(id, v))) { const x = document.getElementById(id); if (x) { x.checked = !v; x.focus(); } return; }
    document.getElementById(id)?.focus({ preventScroll: true });
    toast(sayFlip(id, v), { ok: true, undo: async () => { if (await flip(id, !v)) toast(`Undone. ${sayFlip(id, !v).replace(/^Saved\.\s*/, '')}`); } });
  });
  const t = main.querySelector('[data-slacktest]'); if (t) t.onclick = async () => { t.setAttribute('aria-busy', 'true'); try { await DB.slackTest(); toast(DEMO ? 'Practice copy: a test message would be on its way to you in Slack.' : 'A test message is on its way to you in Slack.', { ok: true }); } catch (e) { toast(e, { err: true }); } finally { t.removeAttribute('aria-busy'); } };
  const cn = main.querySelector('[data-connect]'); if (cn) cn.onclick = async () => { try { await DB.connectCalendar(); } catch (e) { toast(e, { err: true }); } };
  const cr = main.querySelector('[data-copyredir]'); if (cr) cr.onclick = async () => { try { await navigator.clipboard.writeText(main.querySelector('#st-redir').textContent); toast('Address copied.'); } catch { toast('Select the address and copy it.'); } };
  const sk = main.querySelector('[data-sskeys]');
  if (sk) sk.onclick = async () => { if (sk.getAttribute('aria-busy')) return; sk.setAttribute('aria-busy', 'true'); let n = 0;
    try { for (const el of main.querySelectorAll('[data-key]')) { const v = el.value.trim(); if (!v) continue; await DB.setSecret(el.dataset.key, v.toLowerCase() === 'clear' ? '' : v); el.value = ''; n++; }
      if (!n) toast('Nothing to save. Type a key first.'); else { loadSecrets(true); toast(`${plural(n, 'key')} saved.`, { ok: true }); } }
    catch (e) { toast(e, { err: true }); } finally { sk.removeAttribute('aria-busy'); } };
  main.querySelectorAll('[data-ulon]').forEach(b => b.onclick = async () => { const l = (s.offLists || []).find(x => String(x.id) === b.dataset.ulon); if (!l) return;
    if (!await confirmSheet({ title: `Turn ${esc(l.title)} back on?`, text: 'Its maker can share it again, with a new link. The people who followed it see it again.', ok: 'Turn it back on' })) return;
    b.setAttribute('aria-busy', 'true');
    try { await DB.turnOnList(l.id); s.offLists = null; toast(`${l.title} is back on.`, { ok: true }); hooks.render(); } catch (e) { toast(e, { err: true }); b.removeAttribute('aria-busy'); } });
  main.querySelector('[data-kpcount]')?.addEventListener('click', async e => { const b = e.currentTarget; if (b.getAttribute('aria-busy')) return; b.setAttribute('aria-busy', 'true');
    try { await DB.retentionCount(); s.ret = null; loadRetention(true); toast('Counted. Nothing was deleted.', { ok: true }); } catch (er) { toast(er, { err: true }); b.removeAttribute('aria-busy'); } });
  // Arriving at a part (v5's address, or ?part= from the checklist's Fix): its section or row comes into view, with focus.
  const part = PART[route.section]?.[1] || (route.q?.part && (PART[route.q.part]?.[1] || `ss-${route.q.part}`));
  if (part && s.arrived !== location.hash) { s.arrived = location.hash;
    requestAnimationFrame(() => { const el = document.getElementById(part); if (!el) return; el.scrollIntoView({ block: 'start' });
      (el.querySelector('summary, .ss-rmain, h2') || el).focus({ preventScroll: true }); }); }
}

const isAdmin = () => !!S.me?.is_admin;
// The page an address opens: the checklist (''), a group, one of the Public page's own pages, or People's redirect.
const keyOf = route => route.section === 'team' ? 'team' : SUB[route.section] ? route.section : groupOf(route.section);
export default {
  tab: '',
  title: route => { const k = keyOf(route); return k === 'test' ? (abTestOf()?.name || 'A test') : SUB[k] || 'Session setup'; },
  back: route => backOf(keyOf(route)),
  render(route) {
    if (!isAdmin()) return `<div class="ss-page"><h1 class="v6-ptitle sv-h1">Session setup</h1>${empty({ title: 'Session setup is for admins', text: `Ask ${esc(admins())} to change a setting. Your own choices are in My settings.`, action: btn('Open My settings', { kind: 'secondary', href: '#/me' }) })}</div>`;
    const k = keyOf(route);
    // The team is People now (V28): v5's #/setup/team lands there (app.js sends #/setup/people there too).
    if (k === 'team') { setTimeout(() => S.go('#/people', { replace: true })); return skeleton(3); }
    if (SUB[k]) return renderSub(k);
    return k ? renderGroup(k, route) : renderIndex();
  },
  wire(route, root) {
    if (!isAdmin()) return;
    const k = keyOf(route); placeTabs(root);
    if (SUB[k]) { const p = PAGES[k], form = root.querySelector('[data-stform]'); if (form && p.wire) p.wire(form, { refresh: () => hooks.render() });
      root.querySelector('[data-ssprint]')?.addEventListener('click', async e => { const b = e.currentTarget; if (b.getAttribute('aria-busy')) return; b.setAttribute('aria-busy', 'true');
        try { toast(await PAGES.room.save(), { ok: true }); } catch (er) { toast(er.message || String(er), { err: true }); } finally { b.removeAttribute('aria-busy'); } });
      return; }
    wirePage(route, root);
  },
};
