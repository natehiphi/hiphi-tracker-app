// HIPHI Staff v2: Session setup (#/setup, #/setup/:section; plan 3.11). Admins only. The current app puts every
// admin setting in one 9,000px scroll with 15 Save buttons; here the page opens on "Ready for session?" (the readiness
// checklist, each problem with a Fix link to the page that fixes it), then one short sub-page per part, each with a
// status line and its own Save. Message wording, the committee map and keys sit under "Advanced", closed by default.
// Every setting in app.js renderSettings/wireSettings is reachable here or in My settings (me.js); the DB calls and
// their arguments are the same as app.js.
// Build 3 (9/19): nothing is dropped without a word any more. Switches (and the position chips) save the moment they
// are flipped, like My settings, with a "Saved." toast and the old value put back if the save fails; turning email
// ON asks first, because that one starts mail to the public. Typed fields keep their Save button: the page says
// "Not saved yet" beside it, keeps what was typed for the visit, and asks "Save changes?" before you leave. On a
// desktop the page is two columns: the list of parts stays in view on the left, and the chosen part is a form
// column on the right with its Save right under it.
import { S, DB, DEMO, esc, fmtDate, advocate, SUPABASE_URL, SESSION_YEAR, SESSION_OVER, APP_URL, hooks } from './data.js';
import { legislativeDay, diedish, TEMPLATE_KINDS, TOKENS, parseTrackerCsv, billNum } from './model.js';
import { icon, btn, row, switchRow, field, notice, empty, toast, pickerSheet, openSheet, closeSheet, confirmSheet, chip, pickerChip, avatar } from './ui.js';
import { ICONS } from '../icons.js';

// ---- coalition and list icons (copied from app.js: the public page shows Lucide icons, so staff pick a name from
// this short list; old emoji values still display, mapped, until someone saves the coalition again) ----
export const ICON_CHOICES = [['salad', 'Healthy food'], ['apple', 'Apple'], ['bike', 'Active living'], ['utensils', 'Meals'], ['thermometer-sun', 'Heat and climate'],
  ['waves', 'Ocean'], ['sun', 'Sun'], ['leaf', 'Leaf'], ['shield-check', 'Protection'], ['wine-off', 'No alcohol'], ['cigarette-off', 'No tobacco'], ['pill', 'Medicine'],
  ['smile', 'Smile (oral health)'], ['sprout', 'Sprout (farm to school)'], ['school', 'School'], ['baby', 'Keiki'], ['syringe', 'Vaccines'], ['stethoscope', 'Health care'],
  ['heart-pulse', 'Public health'], ['heart-handshake', 'Community care'], ['handshake', 'Partnership'], ['users', 'People'], ['house', 'Housing'], ['megaphone', 'Advocacy']];
const EMOJI_ICON = { '🥗': 'salad', '🌊': 'thermometer-sun', '🍺': 'shield-check', '🚭': 'cigarette-off', '🦷': 'smile', '🌱': 'sprout', '💉': 'syringe', '🤝': 'heart-handshake', '🏥': 'heart-pulse', '☀️': 'heart-pulse', '☀': 'heart-pulse', '🧒': 'baby' };
export const iconName = (v, kind) => { const x = String(v || '').trim(); return ICONS[x] ? x : EMOJI_ICON[x] || EMOJI_ICON[x.replace(/\ufe0f/g, '')] || (kind === 'list' ? 'list-checks' : 'heart-pulse'); };
const iconLabel = n => (ICON_CHOICES.find(c => c[0] === n) || [n, n])[1];
const showIcon = (card, v) => { const b = card.querySelector('[data-ciconpick]'); if (b) b.innerHTML = `${icon(v)}<span>${esc(iconLabel(v))}</span>${icon('chevron-down', { cls: 'chev' })}`; const h = card.querySelector('.st-coalic'); if (h) h.innerHTML = icon(v); };

// ---- small shared bits ----
const admins = () => S.advocates.filter(a => a.is_admin && a.is_active !== false).map(a => a.full_name).join(' or ') || 'an admin';
const hhmm = t => { const m = /^(\d{1,2}):(\d{2})/.exec(t || ''); if (!m) return t || ''; const h = +m[1]; return `${h % 12 || 12}:${m[2]} ${h < 12 ? 'AM' : 'PM'}`; };
const plural = (n, one, many) => `${n} ${n === 1 ? one : many || one + 's'}`;
// Server strings (readiness fixes) were written for the old screens and use arrows as path separators.
const tidy = s => String(s || '').replace(/\s*[\u2192>]\s*/g, ', then ').replace(/[\u{1F300}-\u{1FAFF}\u2600-\u27BF]\uFE0F?/gu, '').trim();
const sessionYear = () => SESSION_OVER ? SESSION_YEAR + 1 : SESSION_YEAR;
const POS_OPTS = [['strongly_support', 'Strongly support'], ['support', 'Support'], ['support_amend', 'Support with amendments'], ['strongly_oppose', 'Strongly oppose'], ['oppose', 'Oppose'], ['neutral', 'Comments'], ['monitor', 'Monitor']];
const TEMPLATE_LABEL = { hearing_alert: 'Hearing alert, one per bill', hearing_rescheduled: 'Hearing moved', hearing_cancelled: 'Hearing cancelled', draft_thread: 'Draft ready, as a thread reply',
  reminder_morning: 'Reminder the morning testimony is due', reminder_before: 'Reminder hours before it is due', reminder_after: 'Reminder after the deadline passed', daily_head: 'Daily list heading', daily_empty: 'Daily list when nothing is coming' };

// The sub-pages, in the order the index lists them. Advanced ones are listed under "Advanced", closed by default.
const SECTIONS = [['team', 'Team', 'users-round'], ['email', 'Email', 'mail'], ['alerts', 'Hearing alerts', 'bell'], ['coalitions', 'Coalitions', 'users'], ['sync', 'Session days and sync', 'calendar-days'],
  ['import', 'Import', 'upload'], ['connections', 'Connections', 'plug'], ['embed', 'Website embed', 'globe'], ['tests', 'Tests', 'flask-conical']];
const ADVANCED = [['templates', 'Message wording', 'square-pen'], ['committees', 'Committee map', 'route'], ['keys', 'Keys', 'key-round'], ['lists', 'People’s lists', 'list-checks']];
const ALL = Object.fromEntries([...SECTIONS, ...ADVANCED].map(([k, t, ic]) => [k, { t, ic }]));

// ---- async state: readiness and secret status load once per visit and on "Check again" ----
const st = () => S.st2Setup ??= { ready: null, readyErr: '', readyBusy: false, errs: null, errsErr: '', errsBusy: false, secrets: null, secretsBusy: false, logins: null, loginsBusy: false, loginsErr: '', offOpen: false, advOpen: false, passOpen: false, coalOpen: new Set(), csv: null, draft: {}, focus: null, offLists: null, offListsBusy: false, offListsErr: '' };
const DESK = () => { try { return matchMedia('(min-width: 900px)').matches; } catch { return false; } };
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
function errorsHTML() {
  const s = st(); loadErrors();
  if (!s.errs) return s.errsErr ? `<div class="card">${notice('bad', 'circle-alert', `Could not load the public page's error reports. ${esc(s.errsErr)}`)}</div>`
    : `<div class="rows st-ready" aria-busy="true"><div class="st-rrow"><div class="skel" style="height:40px;flex:1"></div></div></div>`;
  const today = hstToday(), live = s.errs.filter(e => !e.sandbox), sum = l => l.reduce((a, e) => a + (e.reports || 0), 0);
  const n = sum(live), nToday = sum(live.filter(e => e.day === today)), sb = sum(s.errs.filter(e => e.sandbox));
  const by = new Map();
  for (const e of live) { const k = `${e.message}|${e.place}`, g = by.get(k) || { ...e, reports: 0 }; g.reports += e.reports || 0; if (e.last_at > g.last_at) { g.last_at = e.last_at; g.day = e.day; g.source = e.source; } by.set(k, g); }
  const top = [...by.values()].sort((a, b) => b.reports - a.reports).slice(0, 5);
  const words = n ? `${plural(n, 'error report')} from visitors' browsers in the last 7 days, ${nToday} today${sb ? `, and ${sb} in the sandbox` : ''}.`
    : `No errors reported by visitors' browsers in the last 7 days${sb ? ` (${sb} in the sandbox)` : ''}.`;
  const rowH = e => `<div class="st-rrow ${e.day === today ? 'bad' : 'info'}"><span class="st-ric">${icon(e.day === today ? 'circle-x' : 'info')}</span>
    <div class="st-rbody"><span class="st-rlab">${esc(e.message)}</span><span class="st-rdet">${esc([`${e.reports} ${e.reports === 1 ? 'report' : 'reports'}`, e.place ? `on ${e.place}` : '', e.source || '', `last ${fmtDate(e.last_at)}`].filter(Boolean).join(' · '))}</span></div></div>`;
  return `<p class="st-sum">${n ? chip(nToday ? 'Errors today' : 'Errors this week', nToday ? 'danger' : 'info', 'circle-alert') : chip('No errors', 'ok', 'circle-check')}<span>${esc(words)}</span></p>
    ${top.length ? `<div class="rows st-ready">${top.map(rowH).join('')}</div>` : ''}
    <p class="st-rfix">A report says which screen broke, what the error said and the file it came from, never who the person is; nothing is sent with the privacy signal. The hourly health check tells admins by Slack when ten or more arrive in an hour. Ask Claude to fix what shows here.</p>`;
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

// ---- readiness: every row the server checks, plus the one the current app computes here (public page copy) ----
// Where each problem is fixed. Rows with no page in the app get a plain sentence instead (most are Claude's job).
const FIX = { advocates_auth: 'team', coalition_owners: 'coalitions', coalition_channels: 'coalitions', keywords: 'coalitions', slack: 'connections', calendar: 'connections', email: 'email', bulk: 'import', session_days: 'sync', template: 'templates' };
const FIX_TEXT = {
  deadlines: 'Claude loads the session calendar each December. Ask Claude if this stays red.',
  slots: 'The sync loads committee meeting times. Ask Claude if this stays red.',
  committees: 'The sync loads committees and chairs. Ask Claude if this stays red.',
  advocates_auth: 'Make each person a sign-in link under Team and send it to them.',
  advocates_slack: 'People are matched by email the first time the tracker messages them. Check that their Slack email is their hiphi.org address.',
  coalition_owners: 'Give each coalition an owner.', coalition_channels: 'Give each coalition a Slack channel.', keywords: 'Add keywords so new bills get suggested.',
  slack: 'Save the Slack bot token.', calendar: 'Save the Google keys, then connect the calendar.',
  outbox: 'Messages are waiting to go out. Ask Claude to check the notify-send function.',
  sync: 'The last sync failed or is more than 8 hours old. Ask Claude to check it.',
  bulk: 'Load the session from Open States.',
  watermark: 'Open States has not moved forward in 12 hours. Ask Claude to check the sync.',
  session_days: 'Enter opening day, sine die and each recess day.',
  template: 'Open the testimony template Doc and check it uses every token listed under Message wording.',
};
function readyRows() {
  const s = st(); if (!s.ready) return null;
  const rows = s.ready.map(r => ({ ...r }));
  // The server and the settings describe the same switch; settings are what this page edits, so they win.
  const em = rows.find(r => r.key === 'email'); if (em) em.detail = (S.emailCfg || {}).enabled === false ? 'Paused. Nothing is sent.' : 'On.';
  const gaps = S.bills.filter(b => b.tracked !== false && ['strongly_support', 'strongly_oppose'].includes(b.position) && !diedish(b) && (!(b.public_summary || '').trim() || !(b.public_action || '').trim()));
  rows.push({ key: 'public_copy', level: 'warn', label: 'Public page copy on the bills we push hardest', ok: !gaps.length, gaps,
    detail: gaps.length ? `${plural(gaps.length, 'strongly supported or opposed bill')} without a one-line summary or an ask. Without an ask, the public page asks people to act on the next hearing in its own words; without a summary it shows the official title.` : 'Every strongly supported or opposed bill has a summary and an ask.' });
  const rank = r => r.ok === true ? 5 : r.level === 'block' ? 0 : r.level === 'warn' ? 1 : r.level === 'manual' ? 2 : 3;
  return rows.sort((a, b) => rank(a) - rank(b));
}
function readyRowHTML(r) {
  const [ic, cls, word] = r.ok === true ? ['circle-check', 'ok', 'Done'] : r.level === 'manual' ? ['circle-dashed', 'todo', 'To do'] : r.ok === null || r.level === 'info' ? ['info', 'info', 'For your information'] : r.level === 'block' ? ['circle-x', 'bad', 'Blocking'] : ['triangle-alert', 'warn', 'Check'];
  const fixText = r.ok === false || (r.level === 'manual' && !r.ok) ? (FIX_TEXT[r.key] || tidy(r.fix)) : '';
  const to = r.ok !== true && FIX[r.key];
  const act = r.level === 'manual'
    ? btn(r.ok ? 'Undo' : 'Mark done', { kind: r.ok ? 'text' : 'secondary', sm: true, attrs: { 'data-rman': r.key, 'data-on': r.ok ? '' : '1', 'aria-label': `${r.ok ? 'Mark not done' : 'Mark done'}: ${r.label}` } })
    : r.key === 'public_copy' && !r.ok ? btn('See them', { kind: 'text', sm: true, iconEnd: 'chevron-right', attrs: { 'data-gaps': '1' } })
    : to ? btn(r.ok === false ? 'Fix' : 'Open', { kind: 'text', sm: true, iconEnd: 'chevron-right', href: '#/setup/' + to, attrs: { 'aria-label': `${r.ok === false ? 'Fix' : 'Open'}: ${r.label}` } }) : '';
  return `<div class="st-rrow ${cls}"><span class="st-ric">${icon(ic)}<span class="sr">${word}:</span></span>
    <div class="st-rbody"><span class="st-rlab">${esc(r.label)}</span>${r.detail ? `<span class="st-rdet">${esc(tidy(r.detail))}</span>` : ''}${fixText ? `<span class="st-rfix">${esc(fixText)}</span>` : ''}</div>${act ? `<span class="st-ract">${act}</span>` : ''}</div>`;
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
      return [plural(n, 'coalition'), own ? `${own} without an owner` : '', kw ? `${kw} without keywords` : ''].filter(Boolean).join(' · '); }
    case 'sync': { const ld = legislativeDay(), yr = sessionYear(), cal = (S.sessionCal || []).find(c => c.session_year === yr), b = (S.syncCfg || {}).burst_until;
      return `${ld ? ld.text : cal?.opening_day ? `${yr} session days entered` : `${yr} session days not entered`} · ${b && b >= new Date().toISOString().slice(0, 10) ? `hourly sync until ${fmtDate(b)}` : 'syncs 4 times a day'}`; }
    case 'import': return 'Load the session, or replace the tracked list';
    case 'connections': return sec ? `Slack ${sec.slack_bot_token ? 'connected' : 'not connected'} · Calendar ${sec.google_calendar_refresh_token ? 'connected' : 'not connected'} · YouTube ${sec.youtube_api_key ? 'key set' : 'feed only'}` : 'Slack, Google Calendar and YouTube';
    case 'embed': return 'A table of our public bills for hiphi.org';
    case 'tests': { const T = st().ab?.tests; return T ? `${T.filter(t => t.is_on).length} of ${plural(T.length, 'test')} on the public page` : 'The public page’s A/B tests'; }
    case 'templates': return `${TEMPLATE_KINDS.length} Slack messages`;
    case 'committees': return `${plural((S.counterparts || []).length, 'House and Senate pair')}`;
    case 'keys': { if (!sec) return 'Slack, Google and YouTube keys'; const n = ['slack_bot_token', 'google_oauth_client_id', 'google_oauth_client_secret', 'youtube_api_key'].filter(k => sec[k]).length; return `${n} of 4 keys set`; }
    default: return '';
  }
}

// ---- the index: readiness first, then the parts ----
function renderIndex() {
  const s = st(); loadReady(); loadSecrets();
  const rows = readyRows();
  let ready;
  if (!rows) ready = s.readyErr ? `<div class="card">${notice('bad', 'circle-alert', `Could not run the checks. ${esc(s.readyErr)}`)}${btn('Try again', { kind: 'secondary', sm: true, attrs: { 'data-recheck': '1' } })}</div>`
    : `<div class="rows st-ready" aria-busy="true">${[0, 1, 2].map(() => '<div class="st-rrow"><div class="skel" style="height:40px;flex:1"></div></div>').join('')}</div>`;
  else {
    const bad = rows.filter(r => r.level === 'block' && r.ok === false).length, warn = rows.filter(r => r.level === 'warn' && r.ok === false).length,
      todo = rows.filter(r => r.level === 'manual' && !r.ok).length, open = rows.filter(r => r.ok !== true), pass = rows.filter(r => r.ok === true);
    const sum = [bad ? plural(bad, 'blocking issue') : 'Nothing is blocking', warn ? `${warn} to check` : '', todo ? `${todo} to tick off` : ''].filter(Boolean).join(', ');
    ready = `<p class="st-sum">${bad ? chip('Not ready', 'danger', 'circle-x') : chip('Ready', 'ok', 'circle-check')}<span>${sum}.</span></p>
      <div class="rows st-ready">${open.map(readyRowHTML).join('')}
        ${pass.length ? `<button type="button" class="st-fold" data-pass aria-expanded="${s.passOpen}">${icon('circle-check')}<span>${plural(pass.length, 'check passes', 'checks pass')}</span>${icon(s.passOpen ? 'chevron-up' : 'chevron-down', { cls: 'chev' })}</button>${s.passOpen ? pass.map(readyRowHTML).join('') : ''}` : ''}</div>`;
  }
  const secRow = ([k, t, ic]) => row({ lead: ic, title: esc(t), sub: esc(status(k)), href: '#/setup/' + k, end: s.draft[k] ? chip('Not saved yet', 'info', 'circle-dot') : '' });
  const recheck = rows || s.readyErr ? btn('Check again', { kind: 'text', sm: true, icon: 'rotate-ccw', attrs: { 'data-recheck': '1', 'aria-busy': s.readyBusy ? 'true' : null } }) : '';
  const parts = `<section class="st-sec" aria-labelledby="st-ph">
      <h2 id="st-ph" class="st-h2">Settings</h2>
      <div class="rows">${SECTIONS.map(secRow).join('')}</div>
      <div class="rows st-advbox">
        <button type="button" class="row st-adv" data-adv aria-expanded="${s.advOpen}" aria-controls="st-advlist"><span class="lead">${icon('settings')}</span><span class="body"><span class="title">Advanced</span><span class="sub">Message wording, committee map, keys and people’s lists</span></span><span class="end">${icon(s.advOpen ? 'chevron-up' : 'chevron-down', { cls: 'chev' })}</span></button>
        <div id="st-advlist" ${s.advOpen ? '' : 'hidden'}>${ADVANCED.map(secRow).join('')}</div>
      </div>
    </section>`;
  // Desktop: the checklist is the page (its heading is the h1); the list of parts is also in the left column.
  if (DESK()) return shell('', `<div class="st-head st-headrow"><div><h1>Ready for session?</h1><p class="st-lede">For admins. Everything the season needs, one part at a time. <a href="#/help/session">What changes when a session starts</a></p></div>${recheck}</div>
    <section class="st-sec" aria-label="Readiness checklist">${ready}</section>
    <section class="st-sec" aria-labelledby="st-eh"><div class="st-sechead"><h2 id="st-eh" class="st-h2">The public page's errors</h2></div>${errorsHTML()}</section>${parts}`);
  return `<div class="st-page st-setup">
    <div class="st-head"><h1 class="st-dup">Session setup</h1><p class="st-lede">For admins. Everything the season needs, one part at a time. <a href="#/help/session">What changes when a session starts</a></p></div>
    <section class="st-sec" aria-labelledby="st-rh">
      <div class="st-sechead"><h2 id="st-rh">Ready for session?</h2>${recheck}</div>
      ${ready}
    </section>
    <section class="st-sec" aria-labelledby="st-eh">
      <div class="st-sechead"><h2 id="st-eh">The public page's errors</h2></div>
      ${errorsHTML()}
    </section>
    ${parts}
  </div>`;
}
// The desktop page: the list of parts on the left stays in view; the chosen part (or the checklist) is on the right.
const NAV_DOT = `<span class="st-navd" title="Not saved yet"><span class="sr">Not saved yet</span></span>`;
function shell(cur, pane) {
  loadReady();   // the count beside "Ready for session?" shows on every part, not only after a visit to the checklist
  const s = st(), rows = readyRows();
  const open = rows ? rows.filter(r => (r.level === 'block' || r.level === 'warn') && r.ok === false || (r.level === 'manual' && !r.ok)).length : 0, bad = rows ? rows.some(r => r.level === 'block' && r.ok === false) : false;
  const item = ([k, t, ic]) => `<a class="st-navi" href="#/setup/${k}"${cur === k ? ' aria-current="page"' : ''}>${icon(ic)}<span class="st-navl">${esc(t)}</span>${s.draft[k] ? NAV_DOT : ''}</a>`;
  return `<div class="st-page st-setup st-duo"><div class="st-cols2">
    <nav class="st-nav2" aria-label="Session setup">
      <p class="st-navt">Session setup</p>
      <a class="st-navi" href="#/setup"${cur ? '' : ' aria-current="page"'}>${icon('clipboard-check')}<span class="st-navl">Ready for session?</span>${open ? `<span class="st-navn${bad ? ' bad' : ''}"><span aria-hidden="true">${open}</span><span class="sr">${open} to fix or tick off${bad ? ', some blocking' : ''}</span></span>` : ''}</a>
      <p class="st-navg">Settings</p>${SECTIONS.map(item).join('')}
      <p class="st-navg">Advanced</p>${ADVANCED.map(item).join('')}
    </nav>
    <div class="st-pane">${pane}</div>
  </div></div>`;
}
function wireIndex(root) {
  const s = st();
  root.querySelectorAll('[data-recheck]').forEach(b => b.onclick = () => { s.ready = null; loadReady(true); loadErrors(true); hooks.render(); });
  const adv = root.querySelector('[data-adv]');
  if (adv) adv.onclick = () => { s.advOpen = !s.advOpen; hooks.render(); root.querySelector('[data-adv]')?.focus(); };
  const pass = root.querySelector('[data-pass]');
  if (pass) pass.onclick = () => { s.passOpen = !s.passOpen; hooks.render(); document.querySelector('[data-pass]')?.focus(); };
  root.querySelectorAll('[data-rman]').forEach(b => b.onclick = async () => {
    const on = !!b.dataset.on, r = (s.ready || []).find(x => x.key === b.dataset.rman);
    b.setAttribute('aria-busy', 'true');
    try { await DB.saveReadinessManual(b.dataset.rman, on); if (r) r.ok = on; toast(on ? 'Marked done.' : 'Marked not done.', { ok: on }); hooks.render(); }
    catch (e) { toast(e, { err: true }); b.removeAttribute('aria-busy'); }
  });
  const g = root.querySelector('[data-gaps]');
  if (g) g.onclick = () => { const r = readyRows().find(x => x.key === 'public_copy');
    openSheet({ title: 'Bills missing public copy', size: 'full', body: `<p class="small muted st-shp">Open each one and fill in the Public tab.</p><div class="rows">${r.gaps.map(b => row({ title: `<b>${esc(billNum(b))}</b>`, sub: [!(b.public_summary || '').trim() ? 'No summary' : '', !(b.public_action || '').trim() ? 'No ask' : ''].filter(Boolean).join(' · '), href: `#/bill/${b.bill_number}/public` })).join('')}</div>`,
      wire: d => d.querySelectorAll('a[href^="#/"]').forEach(a => a.onclick = e => { e.preventDefault(); goAfterSheet(a.getAttribute('href')); }) }); };
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

// ---- Team (R-092): the people who use this app. An admin adds someone, then makes them a one-time sign-in link and
// sends it by Slack or email (nothing is emailed from here: Supabase's own mailer refuses outside addresses). Nobody
// is deleted: turning someone off stops their sign-in and keeps their name on everything they did. ----
const firstOf = a => (a.full_name || '').split(/\s+/)[0];
const ownedBy = id => S.bills.filter(b => (S.assignments[b.id] || []).includes(id)).length;
const initialsOf = name => { const w = name.trim().split(/\s+/).filter(Boolean); return (w.length > 1 ? w[0][0] + w[w.length - 1][0] : (w[0] || '').slice(0, 2)).toUpperCase().replace(/[^A-Z]/g, ''); };
function loginWord(a) {
  const s = st(), l = s.logins?.[a.id];
  if (!s.logins) return s.loginsErr ? 'Sign-in not checked' : 'Checking sign-in…';
  if (l?.last_sign_in_at) return `Last signed in ${fmtDate(l.last_sign_in_at)}`;
  if (l?.has_login && l.link_made_at) return `Link made ${fmtDate(l.link_made_at)}, not signed in yet`;
  return 'Cannot sign in yet';
}
function tmRow(a) {
  const me = a.id === S.me?.id, l = st().logins?.[a.id], role = a.is_admin ? 'Admin' : a.can_approve ? 'Approver' : a.is_reviewer ? 'Reviewer' : '';
  const sub = [esc(a.email || 'No email'), role, a.is_active === false ? 'Turned off' : loginWord(a)].filter(Boolean).join(' · ');
  // A link is offered on the row only while someone still has to sign in for the first time; a forgotten password
  // is rarer, so that link is in the person's sheet.
  const link = !me && a.is_active !== false && st().logins && !l?.last_sign_in_at
    ? btn(l?.link_made_at ? 'New link' : 'Sign-in link', { kind: 'secondary', sm: true, icon: 'link', attrs: { 'data-tmlink': a.id, 'aria-label': `Make a sign-in link for ${a.full_name}` } }) : '';
  return `<div class="st-tm">${row({ leadHtml: `<span class="lead st-tmav">${avatar(a, 32)}</span>`, title: `${esc(a.full_name)}${me ? ' <span class="muted">(you)</span>' : ''}`, sub, attrs: { 'data-tmedit': a.id, 'aria-label': `${a.full_name}${me ? ' (you)' : ''}: edit` } })}${link ? `<span class="st-tmlink">${link}</span>` : ''}</div>`;
}
function personSheet(a) {
  const me = a && a.id === S.me?.id, l = a && st().logins?.[a.id], locked = !!l?.has_login, off = a && a.is_active === false, n = a ? ownedBy(a.id) : 0;
  const email = `<input id="tm-email" type="email" value="${esc(a?.email || '')}" placeholder="name@hiphi.org" autocomplete="off" inputmode="email"${locked ? ' readonly aria-describedby="tm-email-help"' : ''}>`;
  const extra = a && !me ? `<div class="st-tmmore">
      ${!off && l?.last_sign_in_at ? `<div class="st-tmact"><div><p class="strong">Forgot their password?</p><p class="small muted">Make a new sign-in link and send it to them.</p></div>${btn('New sign-in link', { kind: 'secondary', sm: true, icon: 'link', attrs: { 'data-tmlink2': a.id } })}</div>` : ''}
      <div class="st-tmact"><div><p class="strong">${off ? 'Turned off' : 'Leaving the team?'}</p><p class="small muted">${off ? `${esc(firstOf(a))} cannot sign in. Turn them back on to let them in again.` : `Turning ${esc(firstOf(a))} off stops their sign-in. Their notes and approvals keep their name${n ? `, and their ${plural(n, 'bill')} keep them as owner until you give them to someone else` : ''}.`}</p></div>
        ${btn(off ? 'Turn back on' : 'Turn off', { kind: off ? 'secondary' : 'text', sm: true, cls: off ? '' : 'st-danger', attrs: { 'data-tmoff': off ? '' : '1' } })}</div></div>` : '';
  openSheet({ title: a ? esc(a.full_name) : 'Add a person', size: 'auto',
    body: `<form class="st-form st-tmform" novalidate data-tmform>
      ${field('tm-name', 'Name', `<input id="tm-name" type="text" value="${esc(a?.full_name || '')}" autocomplete="off"${a ? '' : ' autofocus'}>`)}
      ${field('tm-email', 'Email', email, locked ? 'They sign in with this email. Ask Claude to change it.' : 'Their hiphi.org address. It is how they sign in and how Slack finds them.')}
      ${field('tm-ini', 'Initials', `<input id="tm-ini" type="text" value="${esc(a?.initials || '')}" maxlength="3" autocomplete="off" autocapitalize="characters" aria-describedby="tm-ini-help">`, 'Shown in the small circle beside their bills.')}
      ${switchRow('tm-admin', 'Admin', !!a?.is_admin, me ? 'You cannot take away your own admin. Ask another admin.' : 'Approves testimony and emails, and can open Session setup.', me ? { disabled: true } : {})}
      ${switchRow('tm-appr', 'Approver', !!a?.can_approve, 'Approves testimony and supporter emails, without the rest of an admin’s powers.')}
      ${switchRow('tm-rev', 'Reviewer', !!a?.is_reviewer, 'Gives the second approval on testimony, and can stand in for the first from 6 hours before the deadline.')}
      <button type="submit" hidden tabindex="-1" aria-hidden="true"></button></form>${extra}`,
    foot: `${btn('Cancel', { kind: 'text', attrs: { 'data-tmcancel': '1' } })}${btn(a ? 'Save' : 'Add', { attrs: { 'data-tmsave': '1' } })}`,
    wire: d => {
      const f = d.querySelector('[data-tmform]'), v = id => d.querySelector('#' + id);
      // On a new person the initials follow the name until someone types their own.
      let own = !!a; v('tm-ini').addEventListener('input', () => { own = true; });
      if (!a) v('tm-name').addEventListener('input', () => { if (!own) v('tm-ini').value = initialsOf(v('tm-name').value).slice(0, 3); });
      d.querySelector('[data-tmcancel]').onclick = () => closeSheet();
      const save = async () => {
        const b = d.querySelector('[data-tmsave]'); if (b.getAttribute('aria-busy')) return;
        d.querySelectorAll('.err').forEach(e => e.remove()); d.querySelectorAll('[aria-invalid]').forEach(e => e.removeAttribute('aria-invalid'));
        const p = { full_name: v('tm-name').value, email: v('tm-email').value, initials: v('tm-ini').value, is_admin: v('tm-admin').checked, can_approve: v('tm-appr').checked, is_reviewer: v('tm-rev').checked, is_active: !off };
        if (!p.full_name.trim()) return fieldErr(d, 'tm-name', 'Enter a name.');
        if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(p.email.trim())) return fieldErr(d, 'tm-email', 'Enter an email address, like name@hiphi.org.');
        if (!/^[A-Za-z]{1,3}$/.test(p.initials.trim())) return fieldErr(d, 'tm-ini', 'Initials are one to three letters, like KV.');
        b.setAttribute('aria-busy', 'true');
        try {
          const id = await DB.teamSave(a?.id || null, p);
          await closeSheet({ silent: true }); loadLogins(true); hooks.render();
          const who = advocate(id) || { id, full_name: p.full_name.trim() };
          if (a) toast('Saved.', { ok: true });
          else toast(`${who.full_name} added. Next, make their sign-in link.`, { ok: true, action: { label: 'Make the link', run: () => makeLink(who) } });
        } catch (e) {
          const m = e.message || '';
          if (/email/i.test(m)) fieldErr(d, 'tm-email', m); else if (/initials/i.test(m)) fieldErr(d, 'tm-ini', m); else if (/name/i.test(m) && !/admin/i.test(m)) fieldErr(d, 'tm-name', m); else toast(e, { err: true });
        } finally { d.querySelector('[data-tmsave]')?.removeAttribute('aria-busy'); }
      };
      d.querySelector('[data-tmsave]').onclick = save; f.onsubmit = e => { e.preventDefault(); save(); };
      const l2 = d.querySelector('[data-tmlink2]'); if (l2) l2.onclick = async () => { await closeSheet({ silent: true }); makeLink(a); };
      const t = d.querySelector('[data-tmoff]');
      if (t) t.onclick = async () => { await closeSheet({ silent: true }); setActive(a, !!off); };
    } });
}
// Turning someone off (or back on) happens at once, with Undo (B-5), rather than behind an "Are you sure?".
async function setActive(a, on) {
  const save = v => DB.teamSave(a.id, { ...a, is_active: v });
  try { await save(on); } catch (e) { toast(e, { err: true }); return; }
  hooks.render();
  toast(on ? `${a.full_name} is back on and can sign in.` : `${a.full_name} is turned off and can no longer sign in.`, { ok: on, undo: async () => { await save(!on); hooks.render(); toast('Undone.'); } });
}
async function makeLink(a) {
  const b = document.querySelector(`[data-tmlink="${CSS.escape(a.id)}"]`); if (b?.getAttribute('aria-busy')) return;
  b?.setAttribute('aria-busy', 'true');
  let r; try { r = await DB.teamLink(a.id); } catch (e) { b?.removeAttribute('aria-busy'); toast(e.message || String(e), { err: true }); return; }
  b?.removeAttribute('aria-busy'); loadLogins(true);
  const first = firstOf(a), email = r.email || a.email;
  const msg = `Aloha ${first},\n\nHere is your link to the HIPHI Bill Tracker, the team's staff app:\n${r.link}\n\nOpen it, choose a password, and you are in. The link works once, and only for about an hour. From then on, sign in at ${APP_URL} with ${email} and your password.\n\n${S.me ? firstOf(S.me) : ''}`.trim();
  const mail = `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent('Your sign-in for the HIPHI Bill Tracker')}&body=${encodeURIComponent(msg)}`;
  openSheet({ title: `Sign-in link for ${esc(first)}`, size: 'auto',
    body: `<p class="st-shp">${r.created ? `${esc(first)} now has a login. ` : ''}Send ${esc(first)} this message yourself, by Slack or email. The link works once and only for about an hour, so send it when they are ready. If it runs out, make a new one here.</p>
      ${field('tm-msg', 'The message', `<textarea id="tm-msg" rows="9" readonly>${esc(msg)}</textarea>`)}
      ${notice('info', 'shield-check', `Anyone who opens this link is signed in as ${esc(first)}, so send it only to them.`)}`,
    foot: `${btn('Copy link', { kind: 'text', icon: 'link', attrs: { 'data-cp': 'link' } })}${btn('Email it', { kind: 'secondary', icon: 'mail', href: mail })}${btn('Copy message', { icon: 'copy', attrs: { 'data-cp': 'msg' } })}`,
    wire: d => d.querySelectorAll('[data-cp]').forEach(x => x.onclick = async () => {
      const text = x.dataset.cp === 'link' ? r.link : msg;
      try { await navigator.clipboard.writeText(text); toast(x.dataset.cp === 'link' ? 'Link copied.' : 'Message copied. Paste it into Slack or an email.', { ok: true }); }
      catch { const t = d.querySelector('#tm-msg'); t.focus(); t.select(); toast('Select the message and copy it.'); }
    }) });
}

// ---- Tests: the public page's A/B tests (migration 116, R-135; ../backend/docs/AB-TESTS-PLAN.md) ----
// A person comes here to decide each A/B test of the public page: keep it running, stop it, or pick its winner (B-1).
// Nate 10/3: "turned on or off by me in my staff settings", "by default at random", "each different test should easily be
// tracked by effectiveness". One card per test: its switch (on: each new visitor gets A or B at random and keeps it;
// off: everyone gets one, today's unless a winner was picked), its numbers, one sentence on whether to trust the
// difference, and two actions (A-20): Pick the winner, and See it (a sheet with a link to each version in the practice
// copy, and where on it the difference is). A switch saves the moment it is flipped, with Undo, like every switch here;
// turning on a test with a note (the email ask, waiting on a lawyer) asks first.
function loadAb(force) {
  const s = st(); if (s.abBusy || (s.ab && !force)) return;
  s.abBusy = true; s.abErr = '';
  Promise.all([DB.abTests(), DB.abResults()]).then(([tests, res]) => { s.ab = { tests: tests || [], res: res || [] }; })
    .catch(e => { s.abErr = e.message || 'Could not load.'; })
    .finally(() => { s.abBusy = false; if (S.route?.name === 'setup') hooks.render(); });
}
const armName = (t, a) => (t.arm_names || {})[a] || a;
// A, B, ... by the version's place (the first is today's). The first-visit test has six (backend 136, R-164).
const AB = (t, a) => 'ABCDEF'[t.arms.indexOf(a)] || '?';
// The versions new visitors are spread over while a test is on: all of a two-version test, the switched-on ones of a
// longer one (ab_tests.arms_on).
const armsOnOf = t => t.arms.length > 2 && Array.isArray(t.arms_on) && t.arms_on.length ? t.arms_on : t.arms;
const pct = (n, d) => d ? `${Math.round(100 * n / d)}%` : '–';
// Where each version can be seen in the practice copy, and what to do there to meet the difference.
const SEE = {
  end: ['track.html?demo=1&restart&ab=end.', 'A practice first visit from the start: the difference is at its end.'],
  fv: ['track.html?demo=1&restart&ab=fv.', 'A practice first visit from the start: the difference is its second part.'],
  email: ['track.html?demo=1&restart&ab=email.', 'A practice first visit: the difference is on “Coming up on your issues”.'],
  onb: ['track.html?demo=1&restart&ab=onb.', 'A practice first visit from the start, in that version.'],
  join: ['track.html?demo=1&restart&ab=onb.p1,join.', 'A practice first visit on Plan 1: the difference is the alerts sign-up, after the email.'],
  rank: ['track.html?demo=1&ab=rank.', 'Free school bus passes: write practice testimony and say you sent it. The difference is the card after.', '#/bill/HB1780'],
  share: ['track.html?demo=1&ab=share.', 'Free school bus passes: press Share. The difference is the message.', '#/bill/HB1780'],
  home: ['compare.html?ab=home.', 'Pick Leilani (16 issues), then Open today’s version. The difference is the top of Home.'],
};
const seeUrl = (t, a) => `${APP_URL}${SEE[t.key]?.[0] || 'track.html?demo=1&ab=' + t.key + '.'}${a}${SEE[t.key]?.[2] || ''}`;
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
  if (!a.seen && !b.seen) return ['hourglass', t.is_on ? 'Nobody has met this test yet. The numbers fill as people arrive, most from January.' : 'Off, so nobody meets it.'];
  if (a.seen < 100 || b.seen < 100) return ['hourglass', `Not enough ${unit} yet to trust a difference: ${a.seen} and ${b.seen}, and each version needs 100.`];
  const r = zOf(t, a, b), win = r.p1 >= r.p2 ? a : b, lose = win === a ? b : a;
  if (Math.abs(r.z) >= bar.z) return ['circle-check', `<b>Trust it:</b> ${AB(t, win.arm)} does better on “${esc(t.measure.toLowerCase())}” (${show(win)} against ${show(lose)}), beyond what chance would do (${bar.pct}%).${t.winner ? '' : ' Pick it, and the other version is removed within a week.'}`, win.arm];
  const big = bar.pct === 99 ? 600 : 400;
  if (a.seen < big || b.seen < big) return ['scale', `No clear difference yet (${show(a)} against ${show(b)}). Keep it running: a real difference of 10 points shows at about ${big} ${unit} per version.`];
  return ['scale', `No real difference (${show(a)} against ${show(b)}, from ${a.seen} and ${b.seen} ${unit}). Either will do: pick on other grounds, or keep A.`];
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
// Ready to decide first, then running, then picked, then off: the card that needs Nate is the first one he sees (A-13).
const abRank = (t, x) => x.ready ? 0 : t.is_on ? 1 : t.winner ? 2 : 3;
function abCard(t, x) {
  const { a, b, v, all } = x, multi = t.arms.length > 2, on = armsOnOf(t);
  const m = (r, k) => t.rate ? (r.seen ? String(Math.round(100 * r[k] / r.seen)) : '–') : pct(r[k], r.seen);
  // On a phone each version's numbers are one line under its name ("640 visitors · 41% finished the first visit"): the
  // cells carry their words in data-l (staff.css).
  const tr = r => `<tr><th scope="row"><span class="ab-v" aria-hidden="true">${AB(t, r.arm)}</span><span class="sr">${AB(t, r.arm)}: </span>${esc(armName(t, r.arm))}${r.arm === t.arms[0] ? ' <span class="muted">(today’s)</span>' : ''}</th>`
    + `<td class="num" data-l="${t.rate ? 'shares' : 'visitors'}">${r.seen}</td><td class="num" data-l="${esc(t.measure.toLowerCase())}">${m(r, 'goal')}</td><td class="num" data-l="${esc(t.measure2.toLowerCase())}">${m(r, 'goal2')}</td></tr>`;
  const offLine = `Off: everyone gets ${AB(t, t.fallback)}, “${esc(armName(t, t.fallback))}”.`;
  // A test with more than two versions has a switch for each: new visitors are spread evenly over the ones that are on
  // (Nate 10/5: "a switch per version"). At least one stays on.
  const armSwitches = multi ? `<fieldset class="ab-arms"><legend class="small">${t.is_on ? 'New visitors are spread over the versions switched on' : 'When it is on, new visitors are spread over the versions switched on'}</legend>
    ${t.arms.map(x => switchRow(`ab-arm-${t.key}-${x}`, `${AB(t, x)}: ${armName(t, x)}`, on.includes(x), '', { 'data-abarm-on': `${t.key}|${x}` })).join('')}</fieldset>` : '';
  const verdict = x.never ? '' : x.ready ? notice('ok', 'circle-check', `<span>${v[1]}</span>`) : `<p class="small ab-verdict">${icon(v[0])}<span>${v[1]}</span></p>`;
  const pick = x.ready ? btn(`Pick ${AB(t, v[2])}`, { kind: 'primary', sm: true, icon: 'trophy', attrs: { 'data-abpick': t.key, 'data-abarm': v[2] } })
    : x.never ? '' : btn(t.winner ? 'Change the pick' : 'Pick the winner', { kind: 'text', sm: true, icon: 'trophy', attrs: { 'data-abpick': t.key, 'aria-haspopup': 'dialog' } });
  return `<section class="card ab-card${x.ready ? ' ab-ready' : ''}" aria-labelledby="ab-h-${esc(t.key)}">
    <div class="ab-head"><h2 class="ab-t" id="ab-h-${esc(t.key)}">${esc(t.name)}</h2>${t.winner ? chip(`Picked ${AB(t, t.winner)}`, 'ok', 'trophy') : ''}</div>
    <p class="small ab-q">${esc(t.question)}</p>
    ${t.note && !t.is_on ? notice('warn', 'info', esc(t.note)) : ''}
    ${verdict}
    ${switchRow('ab-on-' + t.key, 'Test it on new visitors', t.is_on, t.is_on ? '' : offLine, { 'data-abon': t.key })}${armSwitches}
    ${x.never ? '' : `<div class="fv-tablewrap"><table class="fv-vtable ab-table"><caption class="sr">${esc(t.name)}: the numbers${t.started ? ` since ${esc(fmtDate(t.started))}` : ''}</caption>
      <thead><tr><th scope="col">Version</th><th scope="col" class="num">${t.rate ? 'Shares' : 'Visitors'}</th><th scope="col" class="num">${esc(t.measure)}<span class="ab-dec">Decides</span></th><th scope="col" class="num">${esc(t.measure2)}</th></tr></thead>
      <tbody>${(multi ? all : [a, b]).map(tr).join('')}</tbody></table></div>`}
    ${x.forced.length ? `<p class="small muted">Not counted: ${x.forced.map(r => `${r.seen} ${r.seen === 1 ? 'visit' : 'visits'} to ${AB(t, r.arm)}`).join(' and ')} from testers’ links.</p>` : ''}
    <div class="btnrow ab-acts">${pick}${btn('See it', { kind: 'text', sm: true, icon: 'eye', attrs: { 'data-absee': t.key, 'aria-haspopup': 'dialog' } })}</div>
    ${x.never ? '' : `<p class="small muted ab-foot">${t.started ? `Counting since ${esc(fmtDate(t.started))}.` : ''}${t.changed_at ? ` Last changed ${esc(fmtDate(t.changed_at))}${t.changed_by ? ` by ${esc(t.changed_by)}` : ''}.` : ''}</p>`}
  </section>`;
}
// Save one test's switch, put the row the database sends back in place, and redraw.
async function saveAb(key, patch) {
  const row = await DB.setAbTest(key, patch), s = st();
  if (s.ab) s.ab.tests = s.ab.tests.map(t => t.key === key ? { ...t, ...row } : t);
  hooks.render(); return row;
}

const PAGES = {
  team: {
    status: () => ['users-round', status('team') + '.'],
    body() { loadLogins(); const s = st(), act = S.advocates.filter(a => a.is_active !== false), off = S.advocates.filter(a => a.is_active === false);
      return `<p class="small muted st-intro">Everyone who uses the staff app. Add someone, then make them a sign-in link and send it to them by Slack or email.</p>
      <div class="btnrow st-acts st-top">${btn('Add a person', { icon: 'user-plus', attrs: { 'data-tmadd': '1' } })}</div>
      ${s.loginsErr ? notice('warn', 'triangle-alert', `Could not check who has signed in. ${esc(s.loginsErr)}`) : ''}
      <div class="rows st-team">${act.map(tmRow).join('')}</div>
      ${off.length ? `<div class="rows st-team st-teamoff"><button type="button" class="st-fold" data-tmoffopen aria-expanded="${s.offOpen}">${icon('eye-off')}<span>${plural(off.length, 'person', 'people')} turned off</span>${icon(s.offOpen ? 'chevron-up' : 'chevron-down', { cls: 'chev' })}</button>${s.offOpen ? off.map(tmRow).join('') : ''}</div>` : ''}`; },
    wire(root) { const s = st();
      root.querySelector('[data-tmadd]')?.addEventListener('click', () => personSheet(null));
      root.querySelectorAll('[data-tmedit]').forEach(b => b.onclick = () => personSheet(advocate(b.dataset.tmedit)));
      root.querySelectorAll('[data-tmlink]').forEach(b => b.onclick = () => makeLink(advocate(b.dataset.tmlink)));
      const o = root.querySelector('[data-tmoffopen]'); if (o) o.onclick = () => { s.offOpen = !s.offOpen; hooks.render(); document.querySelector('[data-tmoffopen]')?.focus(); }; },
  },
  email: {
    // A failed read counts as paused and every save here is refused until a reload reads it (Z1-5, data.js).
    status: () => S.emailCfgErr ? ['circle-alert', `${esc(S.emailCfgErr)} Until then the app treats email as paused.`]
      : (S.emailCfg || {}).enabled === false ? ['circle-alert', 'Email is paused. Alerts, reminders and hearing emails to the public are held and never sent; approved supporter emails wait and go out once it is back on. Slack still works.'] : ['circle-check', 'Email is on.'],
    note() { const c = S.emailCfg || {}; return c.changed_at ? `${c.enabled === false ? 'Paused' : 'Last turned on'}${c.changed_by ? ` by ${esc(c.changed_by)}` : ''} on ${esc(fmtDate(c.changed_at, { year: 'numeric' }))}.` : ''; },
    body() { const c = S.emailCfg || {};
      return `<div class="card st-form">${switchRow('st-email-on', 'Send email', c.enabled !== false, 'Off holds every outgoing email. Alerts and reminders held while it is off are never sent; approved supporter emails wait for it. This switch saves as soon as you flip it.')}
        <p class="small muted st-note" id="st-email-note">${this.note()}</p>
        ${txt('st-email-postal', 'Postal address', c.postal || '', { ph: '707 Richards Street, Suite 300, Honolulu, HI 96813', help: 'Printed at the bottom of every email to the public. The law requires a real mailing address. Leave it blank to use the hiphi.org address.' })}
        ${txt('st-email-from', 'Public email comes from', c.from_email || '', { type: 'email', ph: 'alerts@hiphi.org', help: 'Shown as “HIPHI Bill Tracker”. It must be an address Postmark is set up to send from (a hiphi.org sender).' })}
        ${txt('st-email-reply', 'Replies go to', c.reply_to || '', { type: 'email', ph: 'info@hiphi.org', help: 'A mailbox a person reads. Replies to a supporter email sent by someone on the team go to its writer instead.' })}</div>`; },
    // The switch saves itself: only itself and who flipped it, merged into what is stored (data.js saveEmailSettings).
    // Pausing is the safe direction, so it just happens; turning email back ON starts mail to the public again, so it asks
    // first (a stray tap must never do that), and says which held supporter emails go out with the next 4:30 pm email
    // (while email is paused the 4:30 pm job leaves them approved, Z1-3). With the settings unread it asks nothing: the
    // save is refused.
    auto: { 'st-email-on': { cfg: 'emailCfg', save: c => DB.saveEmailSettings({ enabled: c.enabled, changed_at: c.changed_at, changed_by: c.changed_by }),
      apply: (c, v) => ({ ...c, enabled: v, changed_at: new Date().toISOString(), changed_by: S.me?.initials || null }),
      confirm: v => { if (!v || S.emailCfgErr) return null; const n = (S.alerts || []).filter(a => a.status === 'approved' && a.scheduled_for).length;
        return { title: 'Turn email on?', text: `Alerts, reminders and hearing emails to the public start going out again. Alerts held while it was paused are not sent.${n ? ` ${n === 1 ? 'One approved supporter email has' : `${n} approved supporter emails have`} waited, and ${n === 1 ? 'goes' : 'go'} out in the next 4:30 pm email.` : ''}`, ok: 'Turn email on' }; },
      msg: v => v ? 'Saved. Email is on.' : 'Saved. Email is paused: nothing will be sent.' } },
    after(root) { const n = root.querySelector('#st-email-note'); if (n) n.innerHTML = this.note(); },
    saveLabel: 'Save',
    // Only the fields: the switch has already saved itself, and a Save here must never flip it. The sender and the reply
    // address are R-101's rule 7 (Nate 10/1): from "HIPHI Bill Tracker", replies to a person.
    async save(root) {
      const okMail = v => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), from = val(root, 'st-email-from'), reply = val(root, 'st-email-reply');
      if (!okMail(from)) { fieldErr(root, 'st-email-from', 'Enter an email address like alerts@hiphi.org, or leave it blank.'); return null; }
      if (!okMail(reply)) { fieldErr(root, 'st-email-reply', 'Enter an email address like info@hiphi.org, or leave it blank.'); return null; }
      // The sender fields only, never "enabled" (Z1-5): the save merges them into what is stored, and refuses when the
      // settings could not be read.
      await DB.saveEmailSettings({ postal: val(root, 'st-email-postal'), from_email: from, from_name: 'HIPHI Bill Tracker', reply_to: reply });
      return 'Saved.'; },
  },
  alerts: {
    status: () => ['bell', status('alerts') + '.'],
    body() { const c = S.slackCfg || {}, d = c.daily || {}, pos = new Set(c.positions || []), withCh = S.campaigns.filter(x => x.slack_channel).length;
      return `<div class="card st-form">
        ${txt('st-main', 'Main Slack channel', c.main_channel || '', { ph: '#hearing-alerts-2027', help: 'Every hearing alert posts here.' })}
        <fieldset class="st-fs"><legend>Post alerts for bills we</legend><div class="chips">${POS_OPTS.map(([v, l]) => `<button type="button" class="chip" data-pos="${v}" aria-pressed="${pos.has(v)}">${pos.has(v) ? icon('check') : ''}${esc(l)}</button>`).join('')}</div></fieldset>
        <p class="small muted st-note">Each bill also posts to its coalition's channel. ${withCh} of ${S.campaigns.length} coalitions have one. <a href="#/setup/coalitions">Set coalition channels</a></p>
      </div>
      <h2 class="st-h2">Daily hearings list</h2>
      <div class="card st-form">${switchRow('st-d-on', 'Post a daily list of hearings', d.enabled !== false)}
        <div class="st-grid">${txt('st-d-time', 'Post at', d.time || '07:00', { type: 'time' })}${txt('st-d-days', 'Days ahead', d.days_ahead || 7, { type: 'number', attrs: 'min="1" max="30" inputmode="numeric"' })}</div>
        ${txt('st-d-chan', 'Channel', d.channel || '', { ph: 'The main channel', help: 'Leave blank to use the main channel.' })}
        ${switchRow('st-d-empty', 'Post even when no hearings are coming', !!d.post_when_empty)}</div>
      <h2 class="st-h2">Direct messages</h2>
      <div class="card st-form st-list">${switchRow('st-wfdm', 'Send testimony steps as Slack DMs', c.workflow_dm !== false, 'Off sends them to everyone by email.')}
        ${switchRow('st-health', 'Tell admins when the pipeline has a problem', c.health_dm !== false, 'A DM to each admin.')}
        ${switchRow('st-quiet', 'Tell admins when a notice alerts nobody', c.quiet_dm !== false, 'A hearing notice for bills we do not track, or have no position on.')}</div>`; },
    // The position chips are switches too: a press saves, a failed save puts the chip back, and Undo takes that one
    // position back out (or in) again for ten seconds (B-5, R-022).
    wire(root, { refresh }) { const paint = (b, v) => { b.setAttribute('aria-pressed', v); b.innerHTML = (v ? icon('check') : '') + esc(POS_OPTS.find(p => p[0] === b.dataset.pos)[1]); };
      const withPos = (pos, on) => { const set = new Set((S.slackCfg || {}).positions || []); if (on) set.add(pos); else set.delete(pos); return POS_OPTS.map(([k]) => k).filter(k => set.has(k)); };
      root.querySelectorAll('[data-pos]').forEach(b => b.onclick = async () => { const pos = b.dataset.pos, now = b.getAttribute('aria-pressed') !== 'true', before = S.slackCfg; paint(b, now);
        try { await DB.saveSlackSettings({ ...(before || {}), positions: withPos(pos, now) }, []); refresh(); }
        catch (e) { S.slackCfg = before; paint(b, !now); toast(e, { err: true }); return; }
        const word = POS_OPTS.find(p => p[0] === pos)[1];
        toast(`Saved. ${now ? 'Alerts now post' : 'Alerts no longer post'} for “${word}”.`, { ok: true, undo: async () => {
          await DB.saveSlackSettings({ ...(S.slackCfg || {}), positions: withPos(pos, !now) }, []);
          const chip = document.querySelector(`[data-pos="${pos}"]`); if (chip) paint(chip, !now);
          refresh(); toast('Undone.');
        } }); }); },
    auto: Object.fromEntries([['st-d-on', 'enabled', 1], ['st-d-empty', 'post_when_empty', 1], ['st-wfdm', 'workflow_dm'], ['st-health', 'health_dm'], ['st-quiet', 'quiet_dm']]
      .map(([id, k, daily]) => [id, { cfg: 'slackCfg', save: c => DB.saveSlackSettings(c, []), apply: (c, v) => daily ? { ...c, daily: { ...(c.daily || {}), [k]: v } } : { ...c, [k]: v } }])),
    saveLabel: 'Save channels and times',
    // The typed fields only. Switches and chips have saved themselves, so their stored values are kept as they are.
    async save(root) { const c = S.slackCfg || {};
      const cfg = { ...c, main_channel: val(root, 'st-main') || '#hearing-alerts-2027',
        daily: { ...(c.daily || {}), time: val(root, 'st-d-time') || '07:00', days_ahead: Number(val(root, 'st-d-days')) || 7, channel: val(root, 'st-d-chan') || null } };
      await DB.saveSlackSettings(cfg, []);   // coalition channels are edited (and saved) under Coalitions
      return 'Channels and times saved.'; },
  },
  coalitions: {
    status: () => ['users', status('coalitions') + '.'],
    body() { const s = st(), act = S.advocates.filter(a => a.is_active !== false);
      return `<p class="small muted st-intro">The owner gets every bill tracked under the coalition. Keywords suggest new bills in Sort new bills: separate them with commas. A short fragment catches longer words, so fluorid finds fluoride and fluoridation.</p>
      ${S.campaigns.map(c => { const open = s.coalOpen.has(c.id), ic = iconName(c.icon), own = advocate(c.owner_id);
        const sub = [c.public_name && c.public_name !== c.name ? c.public_name : '', own ? own.full_name : 'No owner', plural((c.keywords || []).length, 'keyword'), c.slack_channel || 'no channel'].filter(Boolean).join(' · ');
        return `<div class="card st-coal" data-coal="${esc(c.id)}">
          <button type="button" class="st-coalhead" data-coalopen="${esc(c.id)}" aria-expanded="${open}" aria-controls="st-cb-${esc(c.id)}"><span class="st-coalic">${icon(ic)}</span><span class="body"><span class="title">${esc(c.name)}</span><span class="sub">${esc(sub)}</span></span>${icon(open ? 'chevron-up' : 'chevron-down', { cls: 'chev' })}</button>
          <div class="st-coalbody st-form" id="st-cb-${esc(c.id)}" ${open ? '' : 'hidden'}>
            ${field('co-own-' + c.id, 'Owner', `<select id="co-own-${esc(c.id)}" data-cowner><option value="">No owner</option>${act.map(a => `<option value="${esc(a.id)}" ${c.owner_id === a.id ? 'selected' : ''}>${esc(a.full_name)}</option>`).join('')}</select>`)}
            ${txt('co-ch-' + c.id, 'Slack channel', c.slack_channel || '', { ph: '#channel-name', attrs: 'data-cchan' })}
            ${area('co-kw-' + c.id, 'Keywords', (c.keywords || []).join(', '), { rows: 2, ph: 'tobacco, e-cigarette, nicotine', attrs: 'data-ckw' })}
            ${txt('co-pub-' + c.id, 'Name on the public page', c.public_name || '', { ph: 'What visitors see', attrs: 'data-cpub' })}
            <div class="field"><span class="label" id="co-icl-${esc(c.id)}">Icon on the public page</span>${pickerChip(iconLabel(ic), { 'data-ciconpick': c.id, 'aria-describedby': 'co-icl-' + c.id }, ic)}<input type="hidden" id="co-ic-${esc(c.id)}" data-cicon value=""></div>
            ${txt('co-desc-' + c.id, 'One friendly sentence for its tile', c.description || '', { ph: 'What this coalition works on', attrs: 'data-cdesc' })}
          </div></div>`; }).join('')}`; },
    wire(root) { const s = st();
      root.querySelectorAll('[data-coalopen]').forEach(b => b.onclick = () => { const id = b.dataset.coalopen, now = b.getAttribute('aria-expanded') !== 'true';
        if (now) s.coalOpen.add(id); else s.coalOpen.delete(id);
        b.setAttribute('aria-expanded', now); root.querySelector('#st-cb-' + CSS.escape(id)).hidden = !now; b.querySelector('.chev').outerHTML = icon(now ? 'chevron-up' : 'chevron-down', { cls: 'chev' }); });
      root.querySelectorAll('[data-ciconpick]').forEach(b => b.onclick = () => { const card = b.closest('[data-coal]'), hid = card.querySelector('[data-cicon]'), c = S.campaigns.find(x => x.id === b.dataset.ciconpick);
        const cur = hid.value || iconName(c?.icon);
        pickerSheet({ title: `Icon for ${c?.name || 'this coalition'}`, value: cur, options: ICON_CHOICES.map(([n, l]) => [n, l, n]),
          onPick: v => { hid.value = v; showIcon(card, v); hid.dispatchEvent(new Event('input', { bubbles: true })); b.focus(); } }); });
    },
    // An icon picked but not saved yet comes back with the rest of the typed changes.
    // A coalition with changes waiting is opened, so "Not saved yet" is never about a card that looks closed and untouched.
    afterDraft(root, base) { root.querySelectorAll('[data-coal]').forEach(card => { const v = card.querySelector('[data-cicon]').value; if (v) showIcon(card, v);
      if (![...card.querySelectorAll('input, select, textarea')].some(el => el.id && el.value !== (base[el.id] ?? ''))) return;
      const b = card.querySelector('[data-coalopen]'); if (b.getAttribute('aria-expanded') !== 'true') b.click(); }); },
    saveLabel: 'Save coalitions',
    async save(root) { let n = 0;
      for (const card of root.querySelectorAll('[data-coal]')) {
        const c = S.campaigns.find(x => x.id === card.dataset.coal); if (!c) continue;
        const keywords = card.querySelector('[data-ckw]').value.split(',').map(x => x.trim()).filter(Boolean);
        const patch = { owner_id: card.querySelector('[data-cowner]').value || null, slack_channel: card.querySelector('[data-cchan]').value.trim() || null, keywords,
          icon: card.querySelector('[data-cicon]').value || iconName(c.icon), description: card.querySelector('[data-cdesc]').value.trim() || null, public_name: card.querySelector('[data-cpub]').value.trim() || null };
        const same = (patch.owner_id || null) === (c.owner_id || null) && (patch.slack_channel || null) === (c.slack_channel || null) && keywords.join(',') === (c.keywords || []).join(',')
          && !card.querySelector('[data-cicon]').value && (patch.description || null) === (c.description || null) && (patch.public_name || null) === (c.public_name || null);
        if (same) continue;
        await DB.saveCampaign(c.id, patch); n++;
      }
      if (S.triage) S.triage.rows = null;   // new keywords change the suggestions
      return n ? `${plural(n, 'coalition')} saved.` : 'Nothing had changed.'; },
  },
  sync: {
    status: () => ['calendar-days', status('sync').replace(/^./, c => c.toUpperCase()) + '.'],
    body() { const yr = sessionYear(), c = (S.sessionCal || []).find(x => x.session_year === yr) || {};
      return `<h2 class="st-h2">Session days, ${yr}</h2>
      <div class="card st-form"><p class="small muted st-note st-top">These drive "Legislative day 27 of 58". Copy them from the Public Access Room's session calendar. Weekends are skipped on their own.</p>
        <div class="st-grid">${txt('st-sd-open', 'Opening day', String(c.opening_day || '').slice(0, 10), { type: 'date' })}${txt('st-sd-end', 'Adjournment sine die', String(c.sine_die || '').slice(0, 10), { type: 'date' })}</div>
        ${area('st-sd-off', 'Weekdays the chambers do not meet', (c.off_days || []).map(d => String(d).slice(0, 10)).join('\n'), { rows: 5, ph: '2027-02-15\n2027-02-25', help: 'Recess days, holidays and closures, one date per line, like 2027-02-15. Or send the calendar PDF to Claude.' })}</div>
      <h2 class="st-h2">Bill sync</h2>
      <div class="card st-form">${txt('st-burst', 'Sync every hour until', (S.syncCfg || {}).burst_until || '', { type: 'date', help: 'For the opening weeks, when new bills arrive fast. Leave it blank to sync 4 times a day.' })}</div>`; },
    saveLabel: 'Save session days and sync',
    async save(root) { const yr = sessionYear(), c = (S.sessionCal || []).find(x => x.session_year === yr) || {};
      const open = val(root, 'st-sd-open'), end = val(root, 'st-sd-end') || null, raw = val(root, 'st-sd-off').split(/[\s,;]+/).map(x => x.trim()).filter(Boolean);
      const bad = raw.filter(x => !/^\d{4}-\d{2}-\d{2}$/.test(x)), off = [...new Set(raw)].sort();
      const calChanged = open !== String(c.opening_day || '').slice(0, 10) || (end || '') !== String(c.sine_die || '').slice(0, 10) || off.join() !== (c.off_days || []).map(d => String(d).slice(0, 10)).sort().join();
      if (calChanged && !open) { fieldErr(root, 'st-sd-open', 'Enter the opening day.'); return null; }
      if (bad.length) { fieldErr(root, 'st-sd-off', `Not a date (use 2027-02-15): ${bad.slice(0, 3).join(', ')}`); return null; }
      if (calChanged) await DB.saveSessionCalendar({ session_year: yr, opening_day: open, sine_die: end, off_days: off });
      const until = val(root, 'st-burst') || null;
      if (until !== ((S.syncCfg || {}).burst_until || null)) await DB.saveSyncSettings({ ...(S.syncCfg || {}), burst_until: until });
      return calChanged || until !== null ? (until ? `Saved. Hourly sync until ${fmtDate(until)}.` : 'Saved. The bills sync 4 times a day.') : 'Saved.'; },
  },
  import: {
    status: () => ['upload', 'Load a new session, or make the team spreadsheet the tracked list.'],
    body() { const s = st();
      return `<h2 class="st-h2">Load the session's bills</h2>
      <div class="card st-form"><p class="small st-note st-top">When Open States publishes a new session, paste its CSV export link. It loads every introduced bill with its full history and is safe to run again. <a href="https://open.pluralpolicy.com/data/session-csv" target="_blank" rel="noopener">Find the link on Plural ${icon('external-link')}</a></p>
        <div class="st-grid st-grid-yr">${txt('st-bulk-year', 'Session year', sessionYear(), { type: 'number', attrs: 'inputmode="numeric"' })}${txt('st-bulk-url', 'CSV export link', '', { type: 'url', ph: `https://data.openstates.org/csv/latest/HI_${SESSION_YEAR + 1}_csv_….zip` })}</div>
        <div class="btnrow st-acts">${btn('Start the import', { kind: 'primary', attrs: { 'data-bulk': '1' } })}</div><p class="small st-note" id="st-bulk-status" role="status"></p></div>
      <h2 class="st-h2">Replace the tracked list</h2>
      <div class="card st-form"><p class="small st-note st-top">Upload the All Tracked Bills export from the team spreadsheet, with the columns Bill Number, Coalition and Coalition Position. The bills in the file become the tracked list and every other bill is untracked. Strongly support becomes P1 and every other position P2, and each bill goes to its coalition's owner. You see what will change before anything does.</p>
        <div class="btnrow st-acts"><label class="btn secondary" for="st-csv">${icon('upload')}<span>${s.csv ? 'Choose another file' : 'Choose the CSV file'}</span></label><input type="file" id="st-csv" class="sr" accept=".csv,text/csv"></div>
        <div id="st-import-preview" aria-live="polite">${s.csv ? s.csv.html : ''}</div></div>`; },
    wire(root) { const s = st();
      const bulk = root.querySelector('[data-bulk]');
      if (bulk) bulk.onclick = async () => { clearErrs(root); const url = val(root, 'st-bulk-url'), session = val(root, 'st-bulk-year'), out = root.querySelector('#st-bulk-status');
        if (!/^https:\/\/data\.openstates\.org\/.+\.zip$/.test(url)) return fieldErr(root, 'st-bulk-url', 'That does not look like an Open States CSV export link (https://data.openstates.org/…zip).');
        bulk.setAttribute('aria-busy', 'true'); bulk.disabled = true; out.textContent = 'Starting…';
        try { await DB.dispatch('bulk-import', { url, session }); out.textContent = `Import started for ${session}. It takes 10 to 30 minutes. The readiness row "${session} bills imported" turns green when it lands.`; toast('Import started.', { ok: true }); }
        catch (e) { out.textContent = e.message || 'Could not start the import.'; toast(e, { err: true }); bulk.disabled = false; }
        finally { bulk.removeAttribute('aria-busy'); } };
      const inp = root.querySelector('#st-csv');
      if (inp) inp.onchange = async () => { const f = inp.files[0]; if (!f) return; const out = root.querySelector('#st-import-preview');
        const rows = parseTrackerCsv(await f.text());
        const show = html => { s.csv = { rows, html }; out.innerHTML = html; wireApply(root, rows); };
        if (!rows.length) return show(notice('bad', 'circle-alert', 'No bill rows found. The header row needs Bill Number, Coalition and Coalition Position.'));
        out.innerHTML = '<p class="small muted st-note">Checking the file…</p>';
        try { const r = await DB.importTracker(rows, false); show(importSummary(f.name, r)); }
        catch (e) { show(localSummary(f.name, rows) + notice(DEMO ? 'info' : 'bad', DEMO ? 'info' : 'circle-alert', esc(DEMO ? 'The sandbox does not import. Use the live app to apply the file.' : e.message || 'Could not check the file.'))); } };
      wireApply(root, s.csv?.rows);
    },
  },
  connections: {
    status: () => ['plug', status('connections') + '.'],
    body() { loadSecrets(); const sec = st().secrets, cal = S.calCfg || {}, cfg = S.slackCfg || {};
      const state = (okv, yes, no) => sec ? (okv ? chip(yes, 'ok', 'circle-check') : chip(no, '', 'circle-dashed')) : chip('Checking…');
      const calLine = !sec ? 'Checking…' : sec.google_calendar_refresh_token ? (cal.calendar_id ? `Hearings go to the "${esc(cal.name || 'HIPHI Hearings')}" calendar.` : 'Connected, but the calendar is not made yet. Press Connect again.')
        : `Not connected. Client ID ${sec.google_oauth_client_id ? 'saved' : 'missing'}, client secret ${sec.google_oauth_client_secret ? 'saved' : 'missing'}. Save both under Keys, then connect.`;
      return `<div class="card st-conn"><div class="st-connhead"><h2 class="st-h3">Slack</h2>${state(sec?.slack_bot_token, 'Connected', 'Not connected')}</div>
          <p class="small st-note">${sec?.slack_bot_token ? `Alerts post to ${esc(cfg.main_channel || 'the main channel')}; DMs go to each person.` : 'No bot token saved, so nothing posts to Slack.'}</p>
          <div class="btnrow st-acts">${btn('Send me a test DM', { kind: 'secondary', sm: true, icon: 'send', attrs: { 'data-slacktest': '1' } })}${btn('Change the bot token', { kind: 'text', sm: true, href: '#/setup/keys' })}</div></div>
        <div class="card st-conn st-form"><div class="st-connhead"><h2 class="st-h3">Google Calendar</h2>${state(sec?.google_calendar_refresh_token, 'Connected', 'Not connected')}</div>
          <p class="small st-note">${calLine}</p>
          ${switchRow('st-cal-on', 'Make calendar events for hearings', cal.enabled !== false, 'Saves as soon as you flip it.')}${switchRow('st-cal-test', 'Include [TEST] hearings', cal.include_test !== false)}
          <div class="btnrow st-acts">${btn(sec?.google_calendar_refresh_token ? 'Connect again' : 'Connect Google Calendar', { kind: 'secondary', sm: true, icon: 'calendar-plus', attrs: { 'data-connect': '1' } })}${btn('Enter the Google keys', { kind: 'text', sm: true, href: '#/setup/keys' })}</div></div>
        <div class="card st-conn"><div class="st-connhead"><h2 class="st-h3">YouTube</h2>${state(sec?.youtube_api_key, 'Key set', 'Feed only')}</div>
          <p class="small st-note">${sec?.youtube_api_key ? 'The daily sync searches the last week of hearing videos.' : 'Hearing videos come from the chambers\' feeds, the newest 15 per chamber. A key lets the sync search the whole week.'}</p>
          <div class="btnrow st-acts">${btn('Add or change the key', { kind: 'text', sm: true, href: '#/setup/keys' })}</div></div>`; },
    wire(root) {
      const t = root.querySelector('[data-slacktest]'); if (t) t.onclick = async () => { t.setAttribute('aria-busy', 'true'); try { await DB.slackTest(); toast(DEMO ? 'Sandbox: a test DM would be on its way.' : 'Test DM on its way.', { ok: true }); } catch (e) { toast(e, { err: true }); } finally { t.removeAttribute('aria-busy'); } };
      const c = root.querySelector('[data-connect]'); if (c) c.onclick = async () => { try { await DB.connectCalendar(); } catch (e) { toast(e, { err: true }); } };
    },
    auto: Object.fromEntries([['st-cal-on', 'enabled'], ['st-cal-test', 'include_test']].map(([id, k]) => [id, { cfg: 'calCfg', save: c => DB.saveCalendarSettings(c), apply: (c, v) => ({ ...c, [k]: v }) }])),
  },
  // People's own lists (R-013, migration 103). Anyone signed in on the public page can make a list and share it by a
  // link; staff cannot browse them. When someone reports a list that misuses HIPHI's page, an admin pastes its link here.
  lists: {
    status: () => ['list-checks', 'Turn off a list someone shared on the public page, if it is used to say something harmful.'],
    body() { loadOffLists();
      return `<div class="card st-form"><p class="small st-note st-top">Anyone who adds their email on the public page can make lists of bills and share one by a link. Lists are private: staff can’t browse them. If someone sends you a link to a list that misuses HIPHI’s page, paste it here. Its link stops working, the people who followed it stop seeing it, and its maker can’t share it again. Nothing is erased.</p>
        ${txt('st-ul-link', 'The list’s link', '', { ph: 'https://…/track.html#/l/…' })}
        ${area('st-ul-why', 'Why, for the record (optional)', '', { rows: 2, ph: 'For example: used to harass someone' })}</div>`; },
    tail() { const s = st(), offs = s.offLists || [];
      const offRow = l => `<div class="row st-ulrow"><span class="lead">${icon('eye-off')}</span><span class="body"><span class="title">${esc(l.title)}</span>
          <span class="sub">Turned off ${esc(fmtDate(l.blocked_at))}${l.blocked_by ? ` by ${esc(l.blocked_by)}` : ''}${l.blocked_reason ? `: ${esc(l.blocked_reason)}` : ''}</span></span>
          <span class="end">${btn('Turn back on', { kind: 'text', sm: true, attrs: { 'data-ulon': l.id, 'aria-label': `Turn ${l.title} back on` } })}</span></div>`;
      return s.offListsErr ? notice('bad', 'circle-alert', `Could not load the lists turned off. ${esc(s.offListsErr)}`) : offs.length ? `<section class="st-sec st-ultail" aria-labelledby="st-ul-off"><h2 class="st-h2" id="st-ul-off">Turned off</h2><div class="rows">${offs.map(offRow).join('')}</div></section>` : ''; },
    wireTail(root) {
      root.querySelectorAll('[data-ulon]').forEach(b => b.onclick = async () => { const l = (st().offLists || []).find(x => String(x.id) === b.dataset.ulon); if (!l) return;
        if (!await confirmSheet({ title: `Turn ${l.title} back on?`, text: 'Its maker can share it again, with a new link. The people who followed it see it again.', ok: 'Turn it back on' })) return;
        b.setAttribute('aria-busy', 'true');
        try { await DB.turnOnList(l.id); st().offLists = null; toast(`${l.title} is back on.`, { ok: true }); hooks.render(); }
        catch (e) { toast(e, { err: true }); b.removeAttribute('aria-busy'); } });
    },
    saveLabel: 'Turn off this list', track: false,
    async save(root) {
      const link = val(root, 'st-ul-link');
      if (!/[0-9a-f]{40}/.test(link)) { fieldErr(root, 'st-ul-link', 'Paste the whole link. It ends in #/l/ and 40 letters and numbers.'); return null; }
      if (!await confirmSheet({ title: 'Turn off this list?', text: 'Its link stops working for everyone, the people who followed it stop seeing it, and its maker can’t share it again. You can turn it back on here.', ok: 'Turn it off', danger: true })) return null;
      const title = await DB.turnOffList(link, val(root, 'st-ul-why'));
      st().offLists = null;
      return `Turned off ${title}.`;
    },
  },
  embed: {
    status: () => ['globe', 'Put a table of the bills we have a public position on into any web page.'],
    body() { return `<div class="card st-form"><p class="small st-note st-top">It shows each bill, our position and where it stands. It reads the same public data as the public page, so notes, owners and drafts never appear. Paste the code into an HTML block on hiphi.org or a coalition site.</p>
      <div class="st-grid">${field('st-emb-coal', 'Show', `<select id="st-emb-coal"><option value="">Every coalition</option>${S.campaigns.filter(c => c.is_public && c.slug).map(c => `<option value="${esc(c.slug)}">${esc(c.public_name || c.name)}</option>`).join('')}</select>`)}
        ${field('st-emb-limit', 'How many bills', `<select id="st-emb-limit"><option value="">Up to 50</option><option value="10">10</option><option value="25">25</option><option value="200">All of them</option></select>`)}</div>
      ${field('st-emb-code', 'The code', '<textarea id="st-emb-code" rows="5" readonly class="st-code"></textarea>')}
      <div class="btnrow st-acts"><a class="btn text sm" id="st-emb-open" target="_blank" rel="noopener"><span>Preview</span>${icon('external-link')}</a></div></div>`; },
    wire(root) { const code = () => { const base = new URL('embed.html', location.href); base.search = ''; base.hash = ''; const c = root.querySelector('#st-emb-coal').value, l = root.querySelector('#st-emb-limit').value;
        if (c) base.searchParams.set('coalition', c); if (l) base.searchParams.set('limit', l);
        root.querySelector('#st-emb-open').href = base.href + (DEMO ? (base.search ? '&' : '?') + 'demo=1' : '');
        root.querySelector('#st-emb-code').value = `<iframe id="hiphi-tracker" src="${base.href}" title="HIPHI bill tracker" style="width:100%;border:0;min-height:420px" loading="lazy"></iframe>\n<script>addEventListener('message',function(e){if(e.data&&e.data.hiphiTrackerHeight)document.getElementById('hiphi-tracker').style.height=e.data.hiphiTrackerHeight+'px'})<\/script>`; };
      code(); root.querySelector('#st-emb-coal').onchange = code; root.querySelector('#st-emb-limit').onchange = code; },
    saveLabel: 'Copy the code', track: false,
    async save(root) { const t = root.querySelector('#st-emb-code');
      try { await navigator.clipboard.writeText(t.value); return 'Code copied.'; } catch { t.focus(); t.select(); return 'Selected. Copy it with Ctrl+C or Cmd+C.'; } },
  },
  tests: {
    status: () => { const A = st().ab; if (!A) return ['flask-conical', 'The public page’s A/B tests.'];
      const bar = abBar(A.tests), ready = A.tests.filter(t => abState(t, A.res, bar).ready);
      return ['flask-conical', `${A.tests.filter(t => t.is_on).length} of ${plural(A.tests.length, 'test')} on.${ready.length ? ` Ready to decide: ${ready.map(t => esc(t.name)).join(', ')}.` : ' None ready to decide yet.'}`]; },
    body() { loadAb(); const s = st();
      if (!s.ab) return s.abErr ? `<div class="card">${notice('bad', 'circle-alert', `Could not load the tests. ${esc(s.abErr)}`)}${btn('Try again', { kind: 'secondary', sm: true, attrs: { 'data-abretry': '1' } })}</div>`
        : `<div aria-busy="true" aria-label="Loading the tests">${[0, 1].map(() => '<div class="card"><div class="skel" style="height:120px"></div></div>').join('')}</div>`;
      const bar = abBar(s.ab.tests), cards = s.ab.tests.map(t => ({ t, x: abState(t, s.ab.res, bar) })).sort((p, q) => abRank(p.t, p.x) - abRank(q.t, q.x) || p.t.sort - q.t.sort);
      return `<div class="ab-intro"><p class="small muted">Each new visitor gets A or B of every test that is on, at random. A card says “Trust it” when the difference is real.</p>
        ${btn('Check again', { kind: 'text', sm: true, icon: 'rotate-ccw', attrs: { 'data-abretry': '1', 'aria-busy': s.abBusy ? 'true' : null } })}</div>
        <div class="ab-list">${cards.map(c => abCard(c.t, c.x)).join('')}</div>`; },
    wire(root) {
      const s = st(), test = k => s.ab?.tests.find(t => t.key === k);
      root.querySelectorAll('[data-abretry]').forEach(b => b.onclick = () => { s.ab = null; loadAb(true); hooks.render(); });
      root.querySelectorAll('[data-abon]').forEach(el => el.onchange = async () => {
        const t = test(el.dataset.abon); if (!t) return;
        const on = el.checked, before = { is_on: t.is_on, fallback: t.fallback, winner: t.winner };
        if (on && t.note && !await confirmSheet({ title: `Turn on “${t.name}”?`, text: `${esc(t.note)} New visitors start getting A or B at once.`, ok: 'Turn it on' })) { el.checked = false; return; }
        try { await saveAb(t.key, on ? { is_on: true, winner: null } : { is_on: false });
          toast(on ? `Saved. New visitors get ${t.arms.length > 2 ? `one of the ${armsOnOf(t).length} versions switched on` : 'A or B'} of “${t.name}” at random.` : `Saved. Everyone gets ${AB(t, t.fallback)} of “${t.name}”.`, { ok: true, undo: () => saveAb(t.key, before) }); }
        catch (e) { el.checked = !on; toast(e, { err: true }); } });
      // One version's switch (R-164): saved at once, with Undo; the last one on cannot be switched off.
      root.querySelectorAll('[data-abarm-on]').forEach(el => el.onchange = async () => {
        const [key, arm] = el.dataset.abarmOn.split('|'), t = test(key); if (!t) return;
        const was = armsOnOf(t), next = el.checked ? t.arms.filter(x => was.includes(x) || x === arm) : was.filter(x => x !== arm);
        if (!next.length) { el.checked = true; toast('At least one version stays on. Turn the test off instead.', { err: true }); return; }
        try { await saveAb(key, { arms_on: next });
          toast(`Saved. ${AB(t, arm)}, “${armName(t, arm)}”, is ${el.checked ? 'on' : 'off'} for new visitors.`, { ok: true, undo: () => saveAb(key, { arms_on: was }) }); }
        catch (e) { el.checked = !el.checked; toast(e, { err: true }); } });
      // See it: the practice copy forced to each version, in a new tab, with where on it the difference is.
      root.querySelectorAll('[data-absee]').forEach(b => b.onclick = () => { const t = test(b.dataset.absee); if (!t) return;
        openSheet({ title: `See it: ${t.name}`, pop: true, body: `<p class="small muted ab-seehint">${esc(SEE[t.key]?.[1] || '')} The practice copy opens in a new tab; nothing there is saved or counted.</p>
          <div class="rows">${t.arms.map(x => row({ lead: 'external-link', title: `See ${AB(t, x)}`, sub: esc(armName(t, x)), href: seeUrl(t, x), chevron: false, attrs: { target: '_blank', rel: 'noopener' } })).join('')}</div>` }); });
      // Pick: everyone gets that version and the test stops (Undo). A test with a note (the email ask, waiting on a lawyer)
      // asks first, as turning it on does: picking B gives every visitor that version at once.
      const pick = async (t, arm) => { const before = { is_on: t.is_on, fallback: t.fallback, winner: t.winner };
        if (t.note && arm !== t.arms[0] && !await confirmSheet({ title: `Give everyone ${AB(t, arm)}?`, text: `${esc(t.note)} Every visitor gets “${esc(armName(t, arm))}” at once.`, ok: `Pick ${AB(t, arm)}` })) return;
        try { await saveAb(t.key, { is_on: false, fallback: arm, winner: arm }); toast(`Picked ${AB(t, arm)}. Everyone gets “${armName(t, arm)}”.`, { ok: true, undo: () => saveAb(t.key, before) }); }
        catch (e) { toast(e, { err: true }); } };
      root.querySelectorAll('[data-abpick]').forEach(b => b.onclick = () => { const t = test(b.dataset.abpick); if (!t) return;
        if (b.dataset.abarm) { pick(t, b.dataset.abarm); return; }
        pickerSheet({ title: `Pick the winner: ${t.name}`, value: t.winner || '', help: 'Everyone gets it from now on, and the test stops. The other version is removed within a week. Undo, or turn the test back on, to take it back.',
          options: t.arms.map(x => [x, `${AB(t, x)}: ${armName(t, x)}`, x === t.winner ? 'trophy' : null, x === t.arms[0] ? 'Today’s version' : '']),
          onPick: arm => pick(t, arm) }); });
    },
  },
  templates: {
    status: () => ['square-pen', 'The wording of each Slack message. Leave one blank to use the standard wording.'],
    body() { const tpl = (S.slackCfg || {}).templates || {};
      return `<div class="card st-form"><p class="small st-note st-top">Tokens you can use: ${esc(TOKENS)}. Slack formatting: *bold*, _italic_ and &lt;link|label&gt;. A link whose token is empty disappears on its own.</p>
        ${TEMPLATE_KINDS.map(([k]) => area('st-tpl-' + k, TEMPLATE_LABEL[k] || k, tpl[k] || '', { rows: 3, ph: 'Blank uses the standard wording', attrs: `data-tpl="${k}"` })).join('')}</div>`; },
    saveLabel: 'Save the wording',
    async save(root) { const cfg = { ...(S.slackCfg || {}), templates: { ...((S.slackCfg || {}).templates || {}), ...Object.fromEntries([...root.querySelectorAll('[data-tpl]')].map(t => [t.dataset.tpl, t.value])) } };
      await DB.saveSlackSettings(cfg, []); return 'Wording saved.'; },
  },
  committees: {
    status: () => ['route', `${status('committees')}. Used to guess the other chamber's committees on a bill's Pathway before the referral is posted.`],
    body() { const codes = ch => Object.values(S.committees || {}).filter(c => c.chamber === ch).map(c => c.code).sort().join(', ');
      return `<div class="card st-form"><p class="small st-note st-top">One pair per line, House code first, like HLT = HHS. A House committee can pair with several Senate ones, and the other way round. A companion bill's real referral is always used first.</p>
        ${area('st-cp', 'House = Senate pairs', (S.counterparts || []).map(p => `${p.house_code} = ${p.senate_code}`).join('\n'), { rows: 10 })}
        <p class="small muted st-note">House: ${esc(codes('H'))}</p><p class="small muted st-note">Senate: ${esc(codes('S'))}</p></div>`; },
    saveLabel: 'Save the map',
    async save(root) { const codes = new Set(Object.keys(S.committees || {})), pairs = [], bad = [];
      for (const line of val(root, 'st-cp').split('\n')) { const t = line.trim(); if (!t) continue; const m = /^([A-Z]{2,4})\s*[=→>-]+\s*([A-Z]{2,4})$/i.exec(t); if (!m) { bad.push(t); continue; }
        const h = m[1].toUpperCase(), sn = m[2].toUpperCase(); if (!codes.has(h) || !codes.has(sn)) { bad.push(t); continue; } if (!pairs.some(p => p.house_code === h && p.senate_code === sn)) pairs.push({ house_code: h, senate_code: sn }); }
      if (bad.length) { fieldErr(root, 'st-cp', `Not understood: ${bad.slice(0, 3).join(', ')}. Use two committee codes, like HLT = HHS.`); return null; }
      await DB.saveCounterparts(pairs); return `${plural(pairs.length, 'pair')} saved.`; },
  },
  keys: {
    status: () => ['key-round', `${status('keys')}. Keys are write-only: once saved they show as set and are never shown again.`],
    body() { loadSecrets(); const sec = st().secrets;
      const k = (id, key, label, ph, help = '') => { const set = sec?.[key]; return field(id, label + (sec ? ` · ${set ? 'set' : 'not set'}` : ''), `<input id="${id}" type="password" placeholder="${esc(set ? 'Saved. Type a new one to replace it' : ph)}" autocomplete="new-password" data-key="${key}"${help ? ` aria-describedby="${id}-help"` : ''}>`, help); };
      return `<p class="small muted st-intro">Leave a field blank to keep what is there. Type clear to remove a key.</p>
      <h2 class="st-h2">Slack</h2><div class="card st-form">${k('st-slacktok', 'slack_bot_token', 'Bot token', 'xoxb-…')}</div>
      <h2 class="st-h2">Google Calendar</h2><div class="card st-form">${k('st-gid', 'google_oauth_client_id', 'Client ID', '….apps.googleusercontent.com')}${k('st-gsec', 'google_oauth_client_secret', 'Client secret', 'GOCSPX-…')}
        <p class="small st-note">The OAuth client must be a Web application with this authorised redirect address:</p><p class="st-uri"><span id="st-redir">${esc(SUPABASE_URL)}/functions/v1/google-connect</span>${btn('Copy', { kind: 'text', sm: true, icon: 'copy', attrs: { 'data-copyredir': '1', 'aria-label': 'Copy the redirect address' } })}</p></div>
      <h2 class="st-h2">YouTube</h2><div class="card st-form">${k('st-ytkey', 'youtube_api_key', 'API key', 'AIza…', 'In Google Cloud, open the HIPHI project, then APIs and Services. Enable YouTube Data API v3, then make an API key under Credentials.')}</div>`; },
    wire(root) { const b = root.querySelector('[data-copyredir]'); if (b) b.onclick = async () => { try { await navigator.clipboard.writeText(root.querySelector('#st-redir').textContent); toast('Address copied.'); } catch { toast('Select the address and copy it.'); } }; },
    saveLabel: 'Save keys',
    async save(root) { let n = 0;
      for (const el of root.querySelectorAll('[data-key]')) { const v = el.value.trim(); if (!v) continue; await DB.setSecret(el.dataset.key, v.toLowerCase() === 'clear' ? '' : v); el.value = ''; n++; }
      if (!n) return 'Nothing to save. Type a key first.';
      loadSecrets(true); return `${plural(n, 'key')} saved.`; },
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

// The Save bar of a part: what state the typed fields are in, then the button. On a phone it is the frame's bottom
// bar; on a desktop it sits right under the form it saves.
function saveBar(key, desk) {
  const p = PAGES[key]; if (!p.save) return '';
  const tracked = p.track !== false;
  return `<div class="st-bar st-sbar${desk ? ' st-sbar2' : ''}">${tracked ? `<span class="st-savestate" data-ststate role="status"></span>${p.auto ? `<span class="st-savehint" data-sthint>Switches save on their own.</span>` : ''}` : ''}
    ${btn(p.saveLabel, { kind: 'primary', icon: key === 'embed' ? 'copy' : null, attrs: { 'data-stsave': '1', 'aria-disabled': tracked ? 'true' : null } })}</div>`;
}
const statusHTML = p => { const [ic, line] = p.status(); return `${icon(ic)}<span>${line}</span>`; };
function renderSection(key) {
  const p = PAGES[key], head = `<div class="st-head"><h1>${esc(ALL[key].t)}</h1><p class="st-status" data-ststatus>${statusHTML(p)}</p></div>`;
  const form = `<form class="st-formwrap" novalidate data-stform>${p.body()}<button type="submit" hidden tabindex="-1" aria-hidden="true"></button></form>`;
  // tail: what a part lists below its Save, so the button sits under the fields it acts on (People's lists, R-013).
  const tail = p.tail ? p.tail() : '';
  if (DESK()) return shell(key, `${head}${form}${saveBar(key, true)}${tail}`);
  return `<div class="st-page st-setup st-subpage">
    <a class="st-crumb" href="#/setup" data-back>${icon('arrow-left')}<span>Session setup</span></a>
    ${head}${form}${tail}
  </div>`;
}
const section = route => PAGES[route.section] ? route.section : '';
const isAdmin = () => !!S.me?.is_admin;

// ---- unsaved changes ----
// What counts: every field you type in or choose from (not the switches, which save themselves; not file pickers or
// read-only boxes). What was typed is kept for the visit (st().draft), so a redraw of the page (the window crossing
// a layout width, a status arriving) or a trip to another page never loses it.
const fields = form => [...form.querySelectorAll('input, select, textarea')].filter(el => el.id && el.type !== 'checkbox' && el.type !== 'file' && !el.readOnly);
const snap = form => Object.fromEntries(fields(form).map(el => [el.id, el.value]));
let guard = null;   // { key, hash, state, title, dirty(), save(), drop() } while a part with typed fields is on screen
const guardOn = () => { try { return !!guard && S.route?.name === 'setup' && S.route.section === guard.key && guard.dirty(); } catch { return false; } };
// "Save changes?": Cancel, Don't save, or Save, the same three answers (and words) the email composer gives. Esc,
// Back, the x and a click outside all mean Cancel. Never window.confirm.
const leaveSheet = title => new Promise(res => { let done = false;
  openSheet({ title: 'Save changes?', size: 'auto', body: `<p>Your changes to ${esc(title)} are not saved yet.</p>`,
    foot: `${btn('Cancel', { kind: 'text', attrs: { 'data-lv': 'stay' } })}${btn('Don’t save', { kind: 'text', attrs: { 'data-lv': 'drop' } })}${btn('Save', { attrs: { 'data-lv': 'save' } })}`,
    onClose: () => { if (!done) res('stay'); },
    wire: d => d.querySelectorAll('[data-lv]').forEach(b => b.onclick = async () => { done = true; await closeSheet({ silent: true }); res(b.dataset.lv); }) }); });
// True when it is fine to go: saved, or thrown away on purpose. A Save that fails (a field error, no connection)
// stays on the page with the error showing.
async function askLeave() {
  const g = guard; if (!g) return true;
  const r = await leaveSheet(g.title);
  if (r === 'save') { const ok = await g.save(); if (ok) guard = null; return ok; }
  if (r === 'drop') { g.drop(); guard = null; return true; }
  return false;
}
// The frame's own jumps (your menu, the header search, a g shortcut, any S.go) ask through the frame's hook: true
// means "I am asking", and proceed() is only called when the answer lets them go.
(S.leaveGuards ??= []).push(proceed => { if (!guardOn()) return false; askLeave().then(ok => { if (ok) proceed(); }); return true; });
// Leaving by a link (the back link, the list of parts, the sidebar, the tabs): ask first, then go where it pointed.
document.addEventListener('click', e => {
  if (e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || !guardOn()) return;
  const a = e.target.closest?.('a[href]'); if (!a || a.target === '_blank' || a.closest('dialog')) return;
  const href = a.getAttribute('href'); if (href === guard.hash) return;
  e.preventDefault(); e.stopImmediatePropagation();
  askLeave().then(ok => { if (!ok) return;
    if (!href.startsWith('#')) { location.href = a.href; return; }
    if (a.hasAttribute('data-back') && (history.state?.d || 0) > 0) history.back(); else S.go(href); });
}, true);
// Leaving by Back (the browser's, or a phone's): the address has already moved, so put this page's entry back (the
// form on screen is untouched), ask, and only then really go back. This listener is registered before the frame's
// (the frame imports this file first), so the frame never draws the other page underneath the question.
addEventListener('popstate', e => {
  if (!guardOn() || location.hash === guard.hash) return;   // the same address means Back only closed a sheet
  e.stopImmediatePropagation();
  history.pushState(guard.state, '', guard.hash);
  askLeave().then(ok => { if (ok) history.back(); });
});
// Closing the tab or reloading: the browser's own question (the only one a page is allowed there).
addEventListener('beforeunload', e => { if (guardOn()) { e.preventDefault(); e.returnValue = ''; } });
// A safety net for any way out that is not a link, Back or the frame's go(): nothing is lost there either. What was
// typed is kept for the visit, and a toast says so, with the way back.
let shown = null;
try { new MutationObserver(() => {
  const now = S.route?.name === 'setup' && PAGES[S.route.section] ? S.route.section : null;
  if (shown && shown !== now && st().draft[shown]) { const k = shown; toast(`Your changes to ${ALL[k].t} are not saved yet.`, { action: { label: 'Go back', run: () => S.go('#/setup/' + k) } }); }
  shown = now;
}).observe(document.body, { attributes: true, attributeFilter: ['data-screen'] }); } catch { /* no observer: the index still marks the part */ }

export default {
  tab: '',
  // The two columns need more than the 720px the frame gives a plain page between 900 and 1099px.
  wide: () => DESK() && isAdmin(),
  title: route => section(route) ? ALL[section(route)].t : 'Session setup',
  back: route => section(route) ? { href: '#/setup', label: 'Session setup' } : null,
  noTabs: route => !!section(route) && isAdmin(),
  render(route) {
    if (!isAdmin()) return `<div class="st-page st-setup"><div class="st-head"><h1 class="st-dup">Session setup</h1></div>${empty({ title: 'Session setup is for admins', text: `Ask ${esc(admins())} to change a setting. Your own choices are in My settings.`, action: btn('Open My settings', { href: '#/me' }) })}</div>`;
    return section(route) ? renderSection(section(route)) : renderIndex();
  },
  bar(route) {
    const key = section(route); if (!key || !isAdmin() || DESK()) return '';
    return saveBar(key, false);
  },
  wire(route, root) {
    guard = null;
    if (!isAdmin()) return;
    const key = section(route);
    if (!key) return wireIndex(root);
    const p = PAGES[key], form = root.querySelector('[data-stform]'), s = st();
    const refresh = () => { const el = root.querySelector('[data-ststatus]'); if (el) el.innerHTML = statusHTML(p); p.after && p.after(form); };
    p.wire && p.wire(form, { refresh });
    p.wireTail && p.wireTail(root);
    // Switches: flip, save, say so, with Undo for ten seconds (B-5, R-022: they saved on the spot and could only be
    // flipped back by hand). A failed save puts the switch and the setting back. Undo is the same flip the other way:
    // one that would turn email ON asks first, exactly as the switch does - a stray tap must never start mail.
    const flip = async (id, a, v) => {
      const ask = a.confirm && a.confirm(v);
      if (ask && !(await confirmSheet(ask))) return false;
      const before = S[a.cfg];
      try { await a.save(a.apply({ ...(before || {}) }, v)); }
      catch (e) { S[a.cfg] = before; toast(e, { err: true }); return false; }
      const el = document.getElementById(id); if (el) el.checked = v;
      refresh(); return true;
    };
    for (const [id, a] of Object.entries(p.auto || {})) {
      const el = form.querySelector('#' + id); if (!el) continue;
      el.onchange = async () => {
        const v = el.checked;
        if (!(await flip(id, a, v))) { el.checked = !v; el.focus(); return; }
        toast(a.msg ? a.msg(v) : 'Saved.', { ok: true, undo: async () => { if (await flip(id, a, !v)) toast(a.msg ? `Undone. ${a.msg(!v).replace(/^Saved\.\s*/, '')}` : 'Undone.'); } });
      };
    }
    if (!p.save) return;
    const tracked = p.track !== false;
    let base = {};
    const dirty = () => tracked && form.isConnected && fields(form).some(el => el.value !== (base[el.id] ?? ''));
    const mark = () => {
      if (!tracked) return;
      const on = dirty(); if (on) s.draft[key] = snap(form); else delete s.draft[key];
      const stEl = root.querySelector('[data-ststate]'), hint = root.querySelector('[data-sthint]'), b = root.querySelector('[data-stsave]');
      if (stEl) { const html = on ? `${icon('circle-dot')}<span>Not saved yet</span>` : ''; if (stEl.innerHTML !== html) stEl.innerHTML = html; }
      if (hint) hint.hidden = on;
      if (b) { if (on) b.removeAttribute('aria-disabled'); else b.setAttribute('aria-disabled', 'true'); }
      // the list of parts (desktop) marks this one while its changes wait
      const nav = root.querySelector(`.st-nav2 a[href="#/setup/${key}"]`), dot = nav?.querySelector('.st-navd');
      if (nav && on && !dot) nav.insertAdjacentHTML('beforeend', NAV_DOT); else if (dot && !on) dot.remove();
    };
    const save = async () => {
      const b = root.querySelector('[data-stsave]'); if (!b || b.getAttribute('aria-busy')) return false;
      if (b.getAttribute('aria-disabled') === 'true') { toast(p.auto ? 'Nothing to save. Switches save on their own.' : 'Nothing to save yet.'); return false; }
      clearErrs(form); b.setAttribute('aria-busy', 'true');
      try {
        const msg = await p.save(form); if (!msg) return false;   // a field error is showing
        if (tracked) delete s.draft[key];
        toast(msg, { ok: !/^Nothing|^Selected/.test(msg) });
        if (key !== 'embed' && key !== 'keys') hooks.render(); else { base = snap(form); mark(); }
        return true;
      } catch (e) { toast(e, { err: true }); return false; }
      finally { root.querySelector('[data-stsave]')?.removeAttribute('aria-busy'); }
    };
    root.querySelector('[data-stsave]')?.addEventListener('click', save);
    form.onsubmit = e => { e.preventDefault(); save(); };
    if (!tracked) return;
    // What is stored is the baseline; then what was typed earlier this visit goes back into its fields.
    base = snap(form);
    const d = s.draft[key];
    if (d) { for (const el of fields(form)) if (el.id in d && d[el.id] !== el.value) el.value = d[el.id]; p.afterDraft && p.afterDraft(form, base); }
    form.addEventListener('input', mark); form.addEventListener('change', mark);
    mark();
    // A redraw while you type (a status arriving, the window changing layout) gives the field its cursor back.
    form.addEventListener('focusin', e => { if (e.target.id) s.focus = { hash: location.hash, id: e.target.id, at: performance.now() }; });
    form.addEventListener('input', e => { if (e.target.id) s.focus = { hash: location.hash, id: e.target.id, at: performance.now() }; });
    if (s.focus && s.focus.hash === location.hash && performance.now() - s.focus.at < 4000 && (!document.activeElement || document.activeElement === document.body)) {
      const el = form.querySelector('#' + CSS.escape(s.focus.id)); if (el) { el.focus({ preventScroll: true }); try { const n = el.value.length; el.setSelectionRange(n, n); } catch { /* not a text field */ } }
    }
    guard = { key, hash: location.hash, state: history.state, title: ALL[key].t, dirty, save, drop: () => { delete s.draft[key]; } };
  },
};
