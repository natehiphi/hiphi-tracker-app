// R-337 trial runs: the front door and the band (part 1), Alerts and Suggest on the band (part 2). trial.html opens this
// file, never staff6/app.js directly.
//
// A trial plays back real days of the 2026 session on the practice project (pjbezfxxplirpbdgjrpe), never the live one.
// Each trial has its own copy of the database (trial_1 to trial_10) with its own clock; the practice project's trial_api
// functions start it, move it and report on it (backend trial/api.sql). Here: sign in with an emailed link, pick a week,
// then Staff v6 itself runs inside the trial's copy (staff6/data.js TRIAL) under a band that says the trial's day and
// time, with Next for the person who started it (Nate 10/24: they move the clock, the others see who moved it).
//
// Nate's words for the design (10/24-25): four stops a day, 9 AM, noon, 3 PM and 6 PM; skip a day; any staff member
// starts one and adds teammates by name; at a week's end the trial shows which held-back bills were found and missed.

const PRACTICE_URL = 'https://pjbezfxxplirpbdgjrpe.supabase.co';
const PRACTICE_KEY = 'sb_publishable_MlsU3w_8VxIPR0zJ5tuY2w_yuFiIKbw';   // the practice project's publishable key
const SUPABASE_JS = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/+esm';   // the version Staff v6 pins
const TZ = 'Pacific/Honolulu';
const HERE = location.origin + location.pathname;   // where an emailed sign-in link lands

// The four weeks (Nate 10/24, round 4). A trial starting at one carries on through the later ones.
export const WEEKS = [
  { n: 1, name: 'Opening weeks', days: 'Wed 21 to Fri 30 Jan', what: 'New bills to find and sort, and the deadline to introduce bills on Wed 28 Jan.' },
  { n: 2, name: 'Committee deadline (first lateral)', days: 'Tue 17 to Fri 20 Feb', what: 'Bills must clear their committees to stay alive.' },
  { n: 3, name: 'Hearing week', days: 'Mon 16 to Fri 20 Mar', what: 'Hearings almost every day, with testimony to write and send.' },
  { n: 4, name: 'End of session', days: 'Mon 13 to Fri 17 Apr', what: 'Bills cross back to the chamber they started in.' },
];

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const RealDate = Date;
const fmt = (t, o) => new RealDate(t).toLocaleString('en-US', { timeZone: TZ, ...o });
const dayOf = t => fmt(t, { weekday: 'short', month: 'short', day: 'numeric' });
const timeOf = t => { const s = fmt(t, { hour: 'numeric', minute: '2-digit' }); return s === '12:00 PM' ? 'noon' : s; };
const sameDay = (a, b) => fmt(a, { dateStyle: 'short' }) === fmt(b, { dateStyle: 'short' });
// What the Next button says: "Next: noon", or "Next: Tue 9:00 AM" when the next stop is another day.
export const nextLabel = st => !st?.next ? '' : sameDay(st.clock, st.next) ? `Next: ${timeOf(st.next)}` : `Next: ${fmt(st.next, { weekday: 'short' })} ${timeOf(st.next)}`;
const firstName = n => (n || '').split(' ')[0];

let sb, api, st, me, polling, alertsNew = 0;

// ---- the page's frame: Staff v6's own styles, so the front door and the app look alike ----
async function borrowStaff6Head() {
  // trial.html stays short: it takes Staff v6's stylesheets and the first-frame styles from staff6.html itself, so a
  // stylesheet added there reaches the trial without anyone remembering this page.
  const html = await fetch('staff6.html', { cache: 'no-cache' }).then(r => r.text());
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const waits = [];
  for (const el of doc.head.querySelectorAll('link[rel="stylesheet"], link[rel="modulepreload"], link[rel="preconnect"]')) {
    const l = document.createElement('link');
    for (const a of el.attributes) l.setAttribute(a.name, a.value);
    if (l.rel === 'stylesheet') waits.push(new Promise(ok => { l.onload = l.onerror = ok; }));
    document.head.insertBefore(l, document.getElementById('trialcss'));
  }
  const boot = doc.body.querySelector('style');   // .boot0: the brand line and the message box
  if (boot) document.head.appendChild(boot.cloneNode(true));
  const brand = doc.body.querySelector('.boot0 .bar');
  await Promise.all(waits);
  return brand ? brand.outerHTML : '<p class="bar"><b>HIPHI Bill Tracker</b></p>';
}
let BRAND = '';

function door(inner) {
  clearTimeout(window.__bootT);
  document.getElementById('app').innerHTML = `<div class="boot0 tr-door">${BRAND}<main class="msg" id="main">${inner}</main></div>`;
  document.querySelector('.tr-door h1')?.focus();
}
const say = (sel, msg, bad) => { const e = document.querySelector(sel); if (e) { e.textContent = msg; e.classList.toggle('bad', !!bad); } };

// ---- 1. sign in: a link by email from the practice project (staff have no practice passwords) ----
function signInScreen(note = '') {
  door(`<h1 tabindex="-1">Practise a week of session</h1>
    <p>A trial run plays back real days of the 2026 session in the tracker, on a practice copy. Nothing you do there changes the real tracker.</p>
    ${note ? `<p class="tr-note">${esc(note)}</p>` : ''}
    <form id="tr-signin" class="tr-form">
      <label for="tr-email">Your HIPHI email</label>
      <input id="tr-email" type="email" autocomplete="email" required inputmode="email">
      <button class="btn primary" type="submit">Email me a sign-in link</button>
      <p class="tr-msg" role="status" aria-live="polite"></p>
    </form>`);
  document.getElementById('tr-signin').onsubmit = async e => {
    e.preventDefault();
    const email = document.getElementById('tr-email').value.trim(), b = e.target.querySelector('button');
    b.disabled = true; say('.tr-msg', 'Sending…');
    const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: HERE, shouldCreateUser: true } });
    b.disabled = false;
    if (error) return say('.tr-msg', `The link could not be sent: ${error.message}`, true);
    door(`<h1 tabindex="-1">Check your email</h1><p>We sent a sign-in link to <b>${esc(email)}</b>. It opens this page, signed in. You can close this tab.</p>
      <p><button class="btn secondary" type="button" id="tr-again">Use another email</button></p>`);
    document.getElementById('tr-again').onclick = () => signInScreen();
  };
}

function notStaffScreen(email) {
  door(`<h1 tabindex="-1">Trials are for the HIPHI team</h1><p><b>${esc(email)}</b> is not on the team list. Sign in with the email you use for the tracker.</p>
    <p><button class="btn primary" type="button" id="tr-out">Sign out</button></p>`);
  document.getElementById('tr-out').onclick = () => sb.auth.signOut().finally(() => location.reload());
}

// ---- 2. start: pick a week ----
const weekPicker = () => `<fieldset class="tr-weeks"><legend>Start at</legend>${WEEKS.map(w => `
  <label class="tr-week"><input type="radio" name="tr-week" value="${w.n}"${w.n === 3 ? ' checked' : ''}>
    <span><b>${esc(w.name)}</b> <span class="tr-days">${esc(w.days)}</span><span class="tr-what">${esc(w.what)}</span></span></label>`).join('')}</fieldset>`;
const HOW = 'Practise a week of session on a copy of the tracker: nothing you do here reaches the real tracker or the public. The clock stops four times a day, at 9 AM, noon, 3 PM and 6 PM, and moves only when you press Next. The trial carries on through the later weeks, and you can add teammates once it starts.';

function startScreen() {
  door(`<h1 tabindex="-1">Start a trial run</h1><p>Hi ${esc(firstName(me.name))}. ${HOW}</p>
    <form id="tr-start" class="tr-form">${weekPicker()}
      <button class="btn primary" type="submit">Start the trial</button>
      <p class="tr-msg" role="status" aria-live="polite"></p></form>
    <p class="tr-quiet">Signed in as ${esc(me.email)} · <button type="button" class="tr-link" id="tr-out">Sign out</button></p>`);
  document.getElementById('tr-out').onclick = () => sb.auth.signOut().finally(() => location.reload());
  document.getElementById('tr-start').onsubmit = e => { e.preventDefault(); startTrial(+e.target.querySelector('input:checked').value, e.target); };
}

async function startTrial(week, form) {
  const b = form.querySelector('button[type=submit]');
  b.disabled = true; say('.tr-msg', 'Setting up your trial: about 20 seconds…');
  const { error } = await api.rpc('start_trial', { p_week: week });
  if (error) { b.disabled = false; return say('.tr-msg', error.message, true); }
  location.reload();
}

// ---- 3. in a trial: Staff v6 inside the trial's copy, under the band ----
async function enter() {
  if (/access_token|refresh_token|error_description/.test(location.hash)) history.replaceState(null, '', location.pathname + location.search);
  window.HIPHI_TRIAL = { url: PRACTICE_URL, key: PRACTICE_KEY, schema: st.schema, trial_id: st.trial_id };
  // The app's clock is the trial's: it starts at the stop and runs on while the page is open, as the practice copy's does
  // (staff6/data.js DEMO), so "in 2 hours" and "today" mean the trial's day. The database's now() is the same stop.
  const off = RealDate.now() - new RealDate(st.clock).getTime();
  window.Date = class extends RealDate { constructor(...a) { a.length ? super(...a) : super(RealDate.now() - off); } static now() { return RealDate.now() - off; } };
  document.body.classList.add('trial');
  const band = document.createElement('div');
  band.id = 'trialband'; band.className = 'tr-band'; band.setAttribute('role', 'region'); band.setAttribute('aria-label', 'Trial run');
  document.body.insertBefore(band, document.getElementById('app'));
  drawBand();
  band.addEventListener('click', onBand);
  polling = setInterval(poll, 30000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) poll(); });
  countNewAlerts();
  await import('../staff6/app.js');
}

export function bandHTML(s, { busy = '', moved = null, alerts = 0 } = {}) {
  const w = WEEKS.find(x => x.n === s.week);
  const when = `${dayOf(s.clock)}, ${timeOf(s.clock)}`;
  // A teammate always sees who moves the clock (it explains the missing Next), on a phone too; once it has moved, the
  // band says that instead.
  const who = s.can_move || moved ? '' : `<span class="tr-who"> · ${esc(firstName(s.starter_name) || 'The starter')} moves the clock</span>`;
  const others = (s.members || []).length;
  let act;
  if (moved) act = `<span class="tr-moved">${esc(firstName(moved.moved_by_name) || 'Someone')} moved to ${esc(timeOf(moved.clock))}</span><button type="button" class="btn primary sm" data-tr="catchup">Catch up</button>`;
  else if (!s.can_move) act = '';
  else if (busy) act = `<span class="tr-busy" role="status">${esc(busy)}</span>`;
  else if (s.done) act = `<button type="button" class="btn primary sm" data-tr="report">See how the week went</button>`;
  else if (s.last_stop_of_week) act = `<button type="button" class="btn primary sm" data-tr="report">End of the week</button>`;
  else act = `<button type="button" class="btn primary sm" data-tr="next">${esc(nextLabel(s))}</button>${s.next_day && sameDay(s.clock, s.next) ? `<button type="button" class="btn secondary sm" data-tr="skip">Skip to ${esc(fmt(s.next_day, { weekday: 'short' }))}</button>` : ''}`;
  return `<span class="tr-where"><b class="tr-tag">Trial run</b> <b class="tr-when">${esc(when)}</b><span class="tr-hint"> · ${esc(w?.name || '')}</span>${who}</span>
    <span class="tr-acts">${act}<button type="button" class="btn secondary sm" data-tr="alerts" aria-haspopup="dialog">Alerts${alerts ? ` <span class="tr-new">${alerts} new</span>` : ''}</button><button type="button" class="btn secondary sm" data-tr="suggest" aria-haspopup="dialog">Suggest</button><button type="button" class="btn secondary sm" data-tr="menu" aria-haspopup="dialog">${others ? `People (${others + 1})` : 'People'}</button></span>`;
}
function drawBand(o) { const b = document.getElementById('trialband'); if (b) b.innerHTML = bandHTML(st, { ...o, alerts: alertsNew }); }

async function poll() {
  const { data, error } = await api.rpc('state');
  if (error) return;
  if (!data) { clearInterval(polling); return ended(); }
  if (data.clock !== st.clock) {
    if (st.can_move) { location.reload(); return; }   // the starter moved it from another tab or phone
    return drawBand({ moved: data });
  }
  st = data; drawBand();
}

function ended() {
  dialog(`<h2 tabindex="-1">This trial has ended</h2><p>${esc(firstName(st.starter_name) || 'The person who started it')} ended it. What you suggested is kept.</p>
    <div class="tr-dacts"><button class="btn primary" type="button" data-tr="reload">Start your own</button></div>`, { locked: true });
}

async function move(fn, busy) {
  drawBand({ busy });
  const { data, error } = await api.rpc(fn);
  if (error) { drawBand(); return toast(error.message); }
  if (data?.drafts && /^no /.test(data.drafts)) sessionStorage.setItem('tr-drafts-note', data.drafts);
  location.reload();   // every screen reads the trial's new day; the address after # keeps the page you were on
}

async function onBand(e) {
  const b = e.target.closest('[data-tr]'); if (!b) return;
  const k = b.dataset.tr;
  if (k === 'next') move('next', `Moving to ${timeOf(st.next)}…`);
  else if (k === 'skip') move('next_day', `Moving to ${fmt(st.next_day, { weekday: 'long' })}…`);
  else if (k === 'catchup') location.reload();
  else if (k === 'report') report();
  else if (k === 'menu') menu();
  else if (k === 'alerts') alerts();
  else if (k === 'suggest') suggestBox();
}

// ---- part 2: the alerts the trial made, each rated useful / not useful / wrong (Nate 10/24) ----
// The practice project sends no Slack and no alert email, so the alerts the tracker would have sent come here instead.
const KIND = {
  draft_created: 'Testimony draft ready', draft_thread: 'Draft posted to the team', hearing_alert: 'Hearing alert',
  daily_list: 'Daily hearing list', reminder_morning: 'Testimony reminder, morning', reminder_before: 'Testimony reminder, before it is due',
  reminder_after: 'Testimony reminder, after the hearing', slot_alert: 'Last hearing slot', deadline_reminder: 'Deadline reminder',
};
export const kindName = k => KIND[k] || String(k || 'Alert').replace(/_/g, ' ').replace(/^./, c => c.toUpperCase());
const RATE = [['useful', 'Useful'], ['not_useful', 'Not useful'], ['wrong', 'Wrong']];
const RATE_ASK = { not_useful: 'What would have made it useful? (optional)', wrong: 'What was wrong? (optional)' };
const seenKey = () => `tr-seen-${st.trial_id}`;
const seenId = () => { try { return +localStorage.getItem(seenKey()) || 0; } catch { return 0; } };
let alertRows = [];

// Slack's own marks (*bold*, _italic_, <url|words>) as the alert would read there. Links to the tracker stay in the trial
// (#bill=HB123 opens that bill in the trial's copy); others (the Google Doc) open in a new tab.
const TRACKER = /^https:\/\/natehiphi\.github\.io\/hiphi-tracker-app\/[^#]*(#.*)?$/;
export function slackText(s) {
  const out = []; let last = 0; const re = /<(https?:\/\/[^|>\s]+)(?:\|([^>]+))?>|(https?:\/\/[^\s<>]+)/g; let m;
  const plain = t => esc(t).replace(/\*([^*\n]+)\*/g, '<b>$1</b>').replace(/(^|[\s(])_([^_\n]+)_(?=$|[\s.,)])/g, '$1<i>$2</i>');
  while ((m = re.exec(s || ''))) {
    out.push(plain(s.slice(last, m.index)));
    const url = m[1] || m[3], words = m[2] || (TRACKER.test(url) ? 'Open in the trial' : url.replace(/^https?:\/\/(www\.)?/, '').slice(0, 40) + (url.length > 48 ? '…' : ''));
    const t = TRACKER.exec(url);
    out.push(t ? `<a href="${esc(t[1] || '#/')}" data-tr="inlink">${esc(words)}</a>` : `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(words)}</a>`);
    last = re.lastIndex;
  }
  out.push(plain((s || '').slice(last)));
  return out.join('');
}

async function countNewAlerts() {
  const { data } = await api.rpc('my_alerts', { p_limit: 200 });
  alertRows = data || [];
  const seen = seenId();
  alertsNew = alertRows.filter(a => a.id > seen).length;
  drawBand();
}

function alertHTML(a, seen) {
  const where = a.to_channel ? 'Team channel' : 'To you';
  const ask = a.rating && RATE_ASK[a.rating];
  return `<li class="tr-alert${a.id > seen ? ' new' : ''}" data-id="${a.id}">
    <p class="tr-ahead"><b>${esc(kindName(a.kind))}</b> <span class="tr-quiet">${esc(where)} · ${esc(dayOf(a.at))}, ${esc(timeOf(a.at))}</span>${a.id > seen ? ' <span class="tr-new">New</span>' : ''}</p>
    <div class="tr-abody">${slackText(a.body || a.subject)}</div>
    <div class="tr-rate" role="group" aria-label="Was this alert useful?">${RATE.map(([k, w]) => `<button type="button" class="btn secondary sm" data-tr="rate" data-k="${k}" aria-pressed="${a.rating === k}">${w}</button>`).join('')}</div>
    ${ask ? `<form class="tr-why" data-tr-why><label for="why-${a.id}">${esc(ask)}</label><textarea id="why-${a.id}" rows="2" maxlength="4000">${esc(a.rating_words || '')}</textarea>
      <div class="tr-dacts"><button type="submit" class="btn primary sm">Save</button><span class="tr-quiet" role="status"></span></div></form>` : ''}
  </li>`;
}

async function alerts() {
  dialog(`<h2 tabindex="-1">Your alerts in this trial</h2><p class="tr-msg" role="status">Reading your alerts…</p>`, { wide: true });
  await countNewAlerts();
  const seen = seenId();
  const top = alertRows.reduce((m, a) => Math.max(m, a.id), 0);
  try { if (top) localStorage.setItem(seenKey(), String(top)); } catch { /* private window */ }
  alertsNew = 0; drawBand();
  setDialog(`<h2 tabindex="-1">Your alerts in this trial</h2>
    <p class="tr-quiet">Slack and email are off in a trial, so the alerts the tracker would have sent you are here, newest first. Mark each one: it shows what to keep and what to fix.</p>
    ${alertRows.length ? `<ul class="tr-alerts">${alertRows.map(a => alertHTML(a, seen)).join('')}</ul>`
      : `<p>No alerts yet. They come as the trial's days pass: hearing notices, testimony drafts and reminders.</p>`}
    <div class="tr-dacts"><button class="btn secondary" type="button" data-tr="close">Close</button></div>`);
}

async function rate(b) {
  const li = b.closest('.tr-alert'), a = alertRows.find(x => x.id === +li.dataset.id), k = b.dataset.k;
  if (!a || a.rating === k) return;
  li.querySelectorAll('[data-tr="rate"]').forEach(x => { x.disabled = true; });
  const { error } = await api.rpc('suggest', { kind: k, page: location.hash.slice(1) || '/', notification_id: a.id, alert_kind: a.kind, alert_text: (a.body || a.subject || '').slice(0, 2000) });
  if (error) { li.querySelectorAll('[data-tr="rate"]').forEach(x => { x.disabled = false; }); return toast(error.message); }
  a.rating = k; a.rating_words = null;
  li.outerHTML = alertHTML(a, Infinity);
  const nli = dlg.querySelector(`.tr-alert[data-id="${a.id}"]`);
  (nli.querySelector('textarea') || nli.querySelector(`[data-k="${k}"]`))?.focus();
}

async function saveWhy(form) {
  const li = form.closest('.tr-alert'), a = alertRows.find(x => x.id === +li.dataset.id), msg = form.querySelector('[role=status]');
  const words = form.querySelector('textarea').value, btn = form.querySelector('button');
  btn.disabled = true; msg.textContent = 'Saving…';
  const { error } = await api.rpc('suggest', { kind: a.rating, page: location.hash.slice(1) || '/', words, notification_id: a.id, alert_kind: a.kind, alert_text: (a.body || a.subject || '').slice(0, 2000) });
  btn.disabled = false;
  if (error) { msg.textContent = error.message; return; }
  a.rating_words = words; msg.textContent = 'Saved';
}

// ---- part 2: Suggest, on every page, with what the person suggested before and Nate's decision on each ----
const DECIDED = { new: 'Waiting for Nate', build: 'Will be built', not_now: 'Not now', planned: 'Already planned', ask: 'Nate would like to ask you about it' };
function pageName() {
  const h = document.querySelector('#app h1');
  return (h?.textContent || '').trim() || (location.hash.slice(1) || '/');
}
async function suggestBox() {
  const here = pageName();
  dialog(`<h2 tabindex="-1">Suggest a change</h2>
    <form id="tr-sug" class="tr-form">
      <p class="tr-quiet">About <b>${esc(here)}</b> · ${esc(dayOf(st.clock))}, ${esc(timeOf(st.clock))} in the trial. Nate reads every one.</p>
      <label for="tr-words">What would you change, or what got in your way?</label>
      <textarea id="tr-words" rows="4" maxlength="4000" required></textarea>
      <div class="tr-dacts"><button class="btn primary" type="submit">Send</button><button class="btn secondary" type="button" data-tr="close">Cancel</button></div>
      <p class="tr-msg" role="status" aria-live="polite"></p>
    </form>
    <h3>What you have suggested</h3><ul class="tr-people tr-mine" id="tr-mine"><li class="tr-quiet">Reading…</li></ul>`, { wide: true });
  dlg.querySelector('#tr-words').focus();
  dlg.querySelector('#tr-sug').onsubmit = async ev => {
    ev.preventDefault();
    const f = ev.target, words = f.querySelector('textarea').value.trim(), btn = f.querySelector('[type=submit]');
    if (!words) return say('#tr-sug .tr-msg', 'Say what you would change first.', true);
    btn.disabled = true; say('#tr-sug .tr-msg', 'Sending…');
    const { error } = await api.rpc('suggest', { kind: 'suggest', page: (location.hash.slice(1) || '/') + ' · ' + here.slice(0, 120), words });
    btn.disabled = false;
    if (error) return say('#tr-sug .tr-msg', error.message, true);
    f.querySelector('textarea').value = '';
    say('#tr-sug .tr-msg', 'Sent. Thank you: Nate will see it on the suggestions page.');
    mine();
  };
  mine();
}
async function mine() {
  const ul = document.getElementById('tr-mine'); if (!ul) return;
  const { data, error } = await api.rpc('my_suggestions');
  if (error) { ul.innerHTML = `<li class="bad">${esc(error.message)}</li>`; return; }
  const rows = (data || []).filter(r => r.kind === 'suggest');
  ul.innerHTML = rows.length ? rows.slice(0, 20).map(r => `<li class="tr-sugrow"><span>${esc(r.words)}</span>
      <span class="tr-quiet">${esc(DECIDED[r.status] || r.status)}${r.reply ? `: ${esc(r.reply)}` : ''}</span></li>`).join('')
    : '<li class="tr-quiet">Nothing yet.</li>';
}

// ---- the week's report: the held-back bills found and missed (Nate 10/24) ----
async function report() {
  const w = WEEKS.find(x => x.n === st.week), nx = WEEKS.find(x => x.n === st.week + 1);
  dialog(`<h2 tabindex="-1">${esc(w.name)}: how it went</h2><p class="tr-msg" role="status">Reading the week…</p>`);
  const { data, error } = await api.rpc('week_report', { p_week: st.week });
  const rows = data || [], found = rows.filter(r => r.found).length;
  const list = rows.length ? `<p>${found} of ${rows.length} bills HIPHI would have wanted were found and tracked this week.</p>
    <ul class="tr-rep">${rows.map(r => `<li class="${r.found ? 'ok' : 'miss'}"><b>${esc(r.bill_number)}</b>${r.nickname ? ` ${esc(r.nickname)}` : ''} <span>${r.found ? '✓ Found' : 'Missed'}${r.found && r.position_then && r.position_now !== r.position_then ? ` · HIPHI's stand was ${esc(r.position_then.replace(/_/g, ' '))}` : ''}</span></li>`).join('')}</ul>`
    : `<p>No bills were held back this week${st.week === 4 ? ': no hearings are noticed in the last week' : ''}.</p>`;
  const go = st.done ? `<button class="btn primary" type="button" data-tr="end">End the trial</button>`
    : `<button class="btn primary" type="button" data-tr="go">Go on to the ${esc(nx?.name || 'next')} week</button>`;
  setDialog(`<h2 tabindex="-1">${esc(w.name)}: how it went</h2>${error ? `<p class="tr-msg bad">${esc(error.message)}</p>` : list}
    <div class="tr-dacts">${go}<button class="btn secondary" type="button" data-tr="close">Stay on this week</button></div>`);
}

// ---- the menu: people, start over, end ----
async function menu() {
  const mine = st.can_move;
  dialog(`<h2 tabindex="-1">This trial</h2>${mine ? '' : `<p>${esc(firstName(st.starter_name) || 'The person who started it')} moves the clock.</p>`}
    <h3>People</h3><ul class="tr-people" id="tr-people"><li>Reading the team…</li></ul>
    ${mine ? `<h3>Start over or end</h3><p class="tr-quiet">Start over begins a new trial at the week you pick. Ending clears the trial's copy; what people suggested is kept.</p>
      <div class="tr-dacts"><button class="btn secondary" type="button" data-tr="over">Start over</button><button class="btn secondary" type="button" data-tr="end">End the trial</button></div>` : ''}
    <div class="tr-dacts"><button class="btn secondary" type="button" data-tr="close">Close</button><button type="button" class="tr-link" data-tr="signout">Sign out</button></div>`);
  const ul = document.getElementById('tr-people');
  if (!mine) { ul.innerHTML = [st.starter_name, ...(st.members || []).map(m => m.name)].map(n => `<li>${esc(n)}</li>`).join(''); return; }
  const { data, error } = await api.rpc('team');
  if (error) { ul.innerHTML = `<li class="bad">${esc(error.message)}</li>`; return; }
  ul.innerHTML = `<li><b>${esc(me.name)}</b> <span class="tr-quiet">you, moving the clock</span></li>` + (data || []).map(p => `<li><span>${esc(p.name)}</span>${p.in_trial
    ? '<span class="tr-quiet">In the trial</span>'
    : `<button type="button" class="btn secondary sm" data-tr="add" data-email="${esc(p.email)}">Add</button>`}</li>`).join('');
}

async function addPerson(b) {
  const email = b.dataset.email; b.disabled = true; b.textContent = 'Adding…';
  const { error } = await api.rpc('add_member', { p_email: email });
  if (error) { b.disabled = false; b.textContent = 'Add'; return toast(error.message); }
  // Their sign-in link, from the practice project: it opens this page and puts them in the trial.
  const { error: e2 } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: HERE, shouldCreateUser: true } });
  b.outerHTML = `<span class="tr-quiet">${e2 ? `Added. The sign-in email did not go: ${esc(e2.message)}. Send them ${esc(HERE)}.` : 'Added · sign-in link sent'}</span>`;
  const s = await api.rpc('state'); if (s.data) { st = s.data; drawBand(); }
}

// ---- a small dialog of its own (Staff v6's sheets belong to its screens) ----
let dlg;
function dialog(html, { locked = false, wide = false } = {}) {
  if (!dlg) {
    dlg = document.createElement('dialog'); dlg.className = 'tr-dlg'; document.body.appendChild(dlg);
    dlg.addEventListener('click', onDialog);
    dlg.addEventListener('submit', e => { if (e.target.matches('[data-tr-why]')) { e.preventDefault(); saveWhy(e.target); } });
  }
  dlg.dataset.locked = locked ? '1' : '';
  dlg.classList.toggle('wide', wide);
  dlg.oncancel = e => { if (dlg.dataset.locked) e.preventDefault(); };
  setDialog(html);
  if (!dlg.open) dlg.showModal();
}
function setDialog(html) { dlg.innerHTML = `<div class="tr-dbody">${html}</div>`; dlg.querySelector('h2')?.focus(); }
async function onDialog(e) {
  if (e.target === dlg && !dlg.dataset.locked) return dlg.close();   // a click on the backdrop
  const b = e.target.closest('[data-tr]'); if (!b) return;
  const k = b.dataset.tr;
  if (k === 'close') dlg.close();
  else if (k === 'inlink') dlg.close();   // the link's own #address opens the bill in the trial
  else if (k === 'rate') rate(b);
  else if (k === 'reload') location.reload();
  else if (k === 'add') addPerson(b);
  else if (k === 'signout') sb.auth.signOut().finally(() => location.reload());
  else if (k === 'go') { dlg.close(); move('next', `Moving to ${WEEKS.find(x => x.n === st.week + 1)?.name || 'the next week'}…`); }
  else if (k === 'over') { setDialog(`<h2 tabindex="-1">Start over</h2><form id="tr-start" class="tr-form">${weekPicker()}
      <p class="tr-quiet">This trial ends and its copy is cleared. ${HOW}</p>
      <div class="tr-dacts"><button class="btn primary" type="submit">Start over</button><button class="btn secondary" type="button" data-tr="close">Keep this trial</button></div>
      <p class="tr-msg" role="status" aria-live="polite"></p></form>`);
    dlg.querySelector('#tr-start').onsubmit = ev => { ev.preventDefault(); startTrial(+ev.target.querySelector('input:checked').value, ev.target); }; }
  else if (k === 'end') setDialog(`<h2 tabindex="-1">End the trial?</h2><p>Everyone in it goes back to the start page, and its practice testimony Docs go to the trash. What people suggested is kept.</p>
      <div class="tr-dacts"><button class="btn primary" type="button" data-tr="endyes">End the trial</button><button class="btn secondary" type="button" data-tr="close">Keep going</button></div>`);
  else if (k === 'endyes') { b.disabled = true; b.textContent = 'Ending…'; const { error } = await api.rpc('end_trial'); if (error) { b.disabled = false; b.textContent = 'End the trial'; return toast(error.message); } location.reload(); }
}

function toast(msg) {
  const t = document.getElementById('toast');
  if (t) { t.textContent = msg; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 6000); } else alert(msg);
}

// ---- boot ----
async function boot() {
  try {
    const [head, mod] = await Promise.all([borrowStaff6Head(), import(SUPABASE_JS)]);
    BRAND = head;
    sb = mod.createClient(PRACTICE_URL, PRACTICE_KEY);
    api = sb.schema('trial_api');
    const linkErr = new URLSearchParams(location.hash.slice(1)).get('error_description');
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return signInScreen(linkErr ? `That link did not work: ${linkErr}. Ask for a new one.` : '');
    const { data, error } = await api.rpc('whoami');
    if (error) throw error;
    me = data;
    if (!me?.staff) return notStaffScreen(me?.email || session.user.email);
    if (!me.trial) return startScreen();
    st = me.trial;
    await enter();
    const dn = sessionStorage.getItem('tr-drafts-note'); if (dn) { sessionStorage.removeItem('tr-drafts-note'); setTimeout(() => toast(`Testimony drafts were not made: ${dn}`), 1500); }
  } catch (e) {
    console.error(e);
    door(`<h1 tabindex="-1">We could not open the trial</h1><p>${esc(e?.message || e)}</p><button class="btn primary" type="button" onclick="location.reload()">Try again</button>`);
  }
}
if (!window.__TRIAL_TEST) boot();
