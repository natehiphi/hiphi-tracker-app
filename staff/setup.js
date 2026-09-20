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
import { S, DB, DEMO, esc, fmtDate, advocate, SUPABASE_URL, SESSION_YEAR, SESSION_OVER, hooks } from './data.js';
import { legislativeDay, diedish, TEMPLATE_KINDS, TOKENS, parseTrackerCsv, billNum } from './model.js';
import { icon, btn, row, switchRow, field, notice, empty, toast, pickerSheet, openSheet, closeSheet, confirmSheet, chip, pickerChip } from './ui.js';
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
const SUPA_USERS = `https://supabase.com/dashboard/project/${new URL(SUPABASE_URL).host.split('.')[0]}/auth/users`;
const POS_OPTS = [['strongly_support', 'Strongly support'], ['support', 'Support'], ['support_amend', 'Support with amendments'], ['strongly_oppose', 'Strongly oppose'], ['oppose', 'Oppose'], ['neutral', 'Comments'], ['monitor', 'Monitor']];
const TEMPLATE_LABEL = { hearing_alert: 'Hearing alert, one per bill', hearing_rescheduled: 'Hearing moved', hearing_cancelled: 'Hearing cancelled', draft_thread: 'Draft ready, as a thread reply',
  reminder_morning: 'Reminder the morning testimony is due', reminder_before: 'Reminder hours before it is due', reminder_after: 'Reminder after the deadline passed', daily_head: 'Daily list heading', daily_empty: 'Daily list when nothing is coming' };

// The sub-pages, in the order the index lists them. Advanced ones are listed under "Advanced", closed by default.
const SECTIONS = [['email', 'Email', 'mail'], ['alerts', 'Hearing alerts', 'bell'], ['coalitions', 'Coalitions', 'users'], ['sync', 'Session days and sync', 'calendar-days'],
  ['import', 'Import', 'upload'], ['connections', 'Connections', 'plug'], ['embed', 'Website embed', 'globe']];
const ADVANCED = [['templates', 'Message wording', 'square-pen'], ['committees', 'Committee map', 'route'], ['keys', 'Keys', 'key-round']];
const ALL = Object.fromEntries([...SECTIONS, ...ADVANCED].map(([k, t, ic]) => [k, { t, ic }]));

// ---- async state: readiness and secret status load once per visit and on "Check again" ----
const st = () => S.st2Setup ??= { ready: null, readyErr: '', readyBusy: false, secrets: null, secretsBusy: false, advOpen: false, passOpen: false, coalOpen: new Set(), csv: null, draft: {}, focus: null };
const DESK = () => { try { return matchMedia('(min-width: 900px)').matches; } catch { return false; } };
function loadReady(force) {
  const s = st(); if (s.readyBusy || (s.ready && !force)) return;
  s.readyBusy = true; s.readyErr = '';
  DB.readiness().then(r => { s.ready = r || []; }).catch(e => { s.readyErr = e.message || 'Could not check.'; s.ready = s.ready || null; })
    .finally(() => { s.readyBusy = false; if (S.route?.name === 'setup') hooks.render(); });
}
function loadSecrets(force) {
  const s = st(); if (s.secretsBusy || (s.secrets && !force)) return;
  s.secretsBusy = true;
  DB.secretStatus().then(r => { s.secrets = r || {}; }).catch(() => { s.secrets = s.secrets || {}; })
    .finally(() => { s.secretsBusy = false; if (S.route?.name === 'setup') hooks.render(); });
}

// ---- readiness: every row the server checks, plus the one the current app computes here (public page copy) ----
// Where each problem is fixed. Rows with no page in the app get a plain sentence instead (most are Claude's job).
const FIX = { coalition_owners: 'coalitions', coalition_channels: 'coalitions', keywords: 'coalitions', slack: 'connections', calendar: 'connections', email: 'email', bulk: 'import', session_days: 'sync', template: 'templates' };
const FIX_TEXT = {
  deadlines: 'Claude loads the session calendar each December. Ask Claude if this stays red.',
  slots: 'The sync loads committee meeting times. Ask Claude if this stays red.',
  committees: 'The sync loads committees and chairs. Ask Claude if this stays red.',
  advocates_auth: 'In Supabase, open Authentication, then Users, and add each person with their hiphi.org email.',
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
    detail: gaps.length ? `${plural(gaps.length, 'strongly supported or opposed bill')} without a one-line summary or an ask. The public page shows the official title instead.` : 'Every strongly supported or opposed bill has a summary and an ask.' });
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
    : r.key === 'advocates_auth' && !r.ok ? btn('Supabase', { kind: 'text', sm: true, iconEnd: 'external-link', href: SUPA_USERS, target: '_blank', attrs: { 'aria-label': 'Open Supabase users (new tab)' } })
    : to ? btn(r.ok === false ? 'Fix' : 'Open', { kind: 'text', sm: true, iconEnd: 'chevron-right', href: '#/setup/' + to, attrs: { 'aria-label': `${r.ok === false ? 'Fix' : 'Open'}: ${r.label}` } }) : '';
  return `<div class="st-rrow ${cls}"><span class="st-ric">${icon(ic)}<span class="sr">${word}:</span></span>
    <div class="st-rbody"><span class="st-rlab">${esc(r.label)}</span>${r.detail ? `<span class="st-rdet">${esc(tidy(r.detail))}</span>` : ''}${fixText ? `<span class="st-rfix">${esc(fixText)}</span>` : ''}</div>${act ? `<span class="st-ract">${act}</span>` : ''}</div>`;
}

// ---- each part's one-line status, shown on the index and at the top of its page ----
function status(key) {
  const cfg = S.slackCfg || {}, sec = st().secrets;
  switch (key) {
    case 'email': return (S.emailCfg || {}).enabled === false ? 'Paused. Nothing is sent.' : 'On';
    case 'alerts': { const d = cfg.daily || {}; return cfg.main_channel ? `Posts to ${cfg.main_channel} for ${plural((cfg.positions || []).length, 'position')}${d.enabled !== false ? ` · daily list at ${hhmm(d.time || '07:00')}` : ''}` : 'No main channel yet'; }
    case 'coalitions': { const n = S.campaigns.length, own = S.campaigns.filter(c => !c.owner_id).length, kw = S.campaigns.filter(c => !(c.keywords || []).length).length;
      return [plural(n, 'coalition'), own ? `${own} without an owner` : '', kw ? `${kw} without keywords` : ''].filter(Boolean).join(' · '); }
    case 'sync': { const ld = legislativeDay(), yr = sessionYear(), cal = (S.sessionCal || []).find(c => c.session_year === yr), b = (S.syncCfg || {}).burst_until;
      return `${ld ? ld.text : cal?.opening_day ? `${yr} session days entered` : `${yr} session days not entered`} · ${b && b >= new Date().toISOString().slice(0, 10) ? `hourly sync until ${fmtDate(b)}` : 'syncs 4 times a day'}`; }
    case 'import': return 'Load the session, or replace the tracked list';
    case 'connections': return sec ? `Slack ${sec.slack_bot_token ? 'connected' : 'not connected'} · Calendar ${sec.google_calendar_refresh_token ? 'connected' : 'not connected'} · YouTube ${sec.youtube_api_key ? 'key set' : 'feed only'}` : 'Slack, Google Calendar and YouTube';
    case 'embed': return 'A table of our public bills for hiphi.org';
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
        <button type="button" class="row st-adv" data-adv aria-expanded="${s.advOpen}" aria-controls="st-advlist"><span class="lead">${icon('settings')}</span><span class="body"><span class="title">Advanced</span><span class="sub">Message wording, committee map and keys</span></span><span class="end">${icon(s.advOpen ? 'chevron-up' : 'chevron-down', { cls: 'chev' })}</span></button>
        <div id="st-advlist" ${s.advOpen ? '' : 'hidden'}>${ADVANCED.map(secRow).join('')}</div>
      </div>
    </section>`;
  // Desktop: the checklist is the page (its heading is the h1); the list of parts is also in the left column.
  if (DESK()) return shell('', `<div class="st-head st-headrow"><div><h1>Ready for session?</h1><p class="st-lede">For admins. Everything the season needs, one part at a time.</p></div>${recheck}</div>
    <section class="st-sec" aria-label="Readiness checklist">${ready}</section>${parts}`);
  return `<div class="st-page st-setup">
    <div class="st-head"><h1 class="st-dup">Session setup</h1><p class="st-lede">For admins. Everything the season needs, one part at a time.</p></div>
    <section class="st-sec" aria-labelledby="st-rh">
      <div class="st-sechead"><h2 id="st-rh">Ready for session?</h2>${recheck}</div>
      ${ready}
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
  root.querySelectorAll('[data-recheck]').forEach(b => b.onclick = () => { s.ready = null; loadReady(true); hooks.render(); });
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

const PAGES = {
  email: {
    status: () => (S.emailCfg || {}).enabled === false ? ['circle-alert', 'Email is paused. Alerts, reminders, digests and public hearing emails are held and never sent. Slack still works.'] : ['circle-check', 'Email is on.'],
    note() { const c = S.emailCfg || {}; return c.changed_at ? `${c.enabled === false ? 'Paused' : 'Last turned on'}${c.changed_by ? ` by ${esc(c.changed_by)}` : ''} on ${esc(fmtDate(c.changed_at, { year: 'numeric' }))}.` : ''; },
    body() { const c = S.emailCfg || {};
      return `<div class="card st-form">${switchRow('st-email-on', 'Send email', c.enabled !== false, 'Off holds every outgoing email. Held email is not sent later. This switch saves as soon as you flip it.')}
        <p class="small muted st-note" id="st-email-note">${this.note()}</p>
        ${txt('st-email-postal', 'Postal address', c.postal || '', { ph: '707 Richards Street, Suite 300, Honolulu, HI 96813', help: 'Printed at the bottom of every email to the public. The law requires a real mailing address. Leave it blank to use the hiphi.org address.' })}</div>`; },
    // The switch saves itself. Pausing is the safe direction, so it just happens; turning email back ON starts mail
    // to the public again, so it asks first (a stray tap must never do that).
    auto: { 'st-email-on': { cfg: 'emailCfg', save: c => DB.saveEmailSettings(c),
      apply: (c, v) => ({ ...c, enabled: v, changed_at: new Date().toISOString(), changed_by: S.me?.initials || null }),
      confirm: v => v ? { title: 'Turn email on?', text: 'Alerts, reminders, digests and hearing emails to the public start going out again. Email held while it was paused is not sent.', ok: 'Turn email on' } : null,
      msg: v => v ? 'Saved. Email is on.' : 'Saved. Email is paused: nothing will be sent.' } },
    after(root) { const n = root.querySelector('#st-email-note'); if (n) n.innerHTML = this.note(); },
    saveLabel: 'Save the address',
    // Only the address: the switch has already saved itself, and a Save here must never flip it.
    async save(root) { await DB.saveEmailSettings({ ...(S.emailCfg || {}), postal: val(root, 'st-email-postal') }); return 'Postal address saved.'; },
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
    // The position chips are switches too: a press saves, and a failed save puts the chip back.
    wire(root, { refresh }) { const paint = (b, v) => { b.setAttribute('aria-pressed', v); b.innerHTML = (v ? icon('check') : '') + esc(POS_OPTS.find(p => p[0] === b.dataset.pos)[1]); };
      root.querySelectorAll('[data-pos]').forEach(b => b.onclick = async () => { const now = b.getAttribute('aria-pressed') !== 'true', before = S.slackCfg; paint(b, now);
        try { await DB.saveSlackSettings({ ...(before || {}), positions: [...root.querySelectorAll('[data-pos][aria-pressed="true"]')].map(x => x.dataset.pos) }, []); refresh(); toast('Saved.', { ok: true }); }
        catch (e) { S.slackCfg = before; paint(b, !now); toast(e, { err: true }); } }); },
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
            ${area('co-kw-' + c.id, 'Keywords', (c.keywords || []).join(', '), { rows: 2, ph: 'tobacco, vape, nicotine', attrs: 'data-ckw' })}
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
      <div class="card st-form"><p class="small st-note st-top">Upload the All Tracked Bills export from the team spreadsheet, with the columns Bill Number, Coalition and Coalition Position. The bills in the file become the tracked list and every other bill is untracked. Strongly support and strongly oppose become P1, the rest P2, and each bill goes to its coalition's owner. You see what will change before anything does.</p>
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
  if (DESK()) return shell(key, `${head}${form}${saveBar(key, true)}`);
  return `<div class="st-page st-setup st-subpage">
    <a class="st-crumb" href="#/setup" data-back>${icon('arrow-left')}<span>Session setup</span></a>
    ${head}${form}
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
    // Switches: flip, save, say so. A failed save puts the switch and the setting back.
    for (const [id, a] of Object.entries(p.auto || {})) {
      const el = form.querySelector('#' + id); if (!el) continue;
      el.onchange = async () => {
        const v = el.checked, ask = a.confirm && a.confirm(v);
        if (ask && !(await confirmSheet(ask))) { el.checked = !v; el.focus(); return; }
        const before = S[a.cfg];
        try { await a.save(a.apply({ ...(before || {}) }, v)); }
        catch (e) { S[a.cfg] = before; el.checked = !v; toast(e, { err: true }); return; }
        refresh(); toast(a.msg ? a.msg(v) : 'Saved.', { ok: true });
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
