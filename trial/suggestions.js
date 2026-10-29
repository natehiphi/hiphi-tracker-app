// R-337 part 3: the trial suggestions page, for Nate and the admins he names (trial_feedback.admins on the practice
// project). Everything the team said in trial runs: suggestions from any page and the ratings on alerts, newest first,
// filtered by kind, decision, person and words, sorted by when or by trial day. A decision (Build it / Not now / Already
// planned / Ask them) and a reply go back to the person, who sees them under Suggest in their trial (Nate 10/24).
// It reads live: the list refreshes every 30 seconds and when the tab comes back.

const PRACTICE_URL = 'https://pjbezfxxplirpbdgjrpe.supabase.co';
const PRACTICE_KEY = 'sb_publishable_MlsU3w_8VxIPR0zJ5tuY2w_yuFiIKbw';
const SUPABASE_JS = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/+esm';
const TZ = 'Pacific/Honolulu';
const HERE = location.origin + location.pathname;

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (t, o) => new Date(t).toLocaleString('en-US', { timeZone: TZ, ...o });
const when = t => { const s = fmt(t, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); return s.replace('12:00 PM', 'noon'); };
// The four trial weeks fall in different months of 2026 (trial.js WEEKS), so the month names the week.
const WEEK = { 0: 'Opening weeks', 1: 'Committee deadline', 2: 'Hearing week', 3: 'End of session' };
export const weekOf = t => WEEK[+fmt(t, { month: 'numeric' }) - 1] || '';
export const DECISIONS = [['build', 'Build it'], ['not_now', 'Not now'], ['planned', 'Already planned'], ['ask', 'Ask them']];
const STATUS = { new: 'New', ...Object.fromEntries(DECISIONS) };
const RATING = { useful: 'Useful', not_useful: 'Not useful', wrong: 'Wrong' };
const KIND = {
  draft_created: 'Testimony draft ready', draft_thread: 'Draft posted to the team', hearing_alert: 'Hearing alert',
  daily_list: 'Daily hearing list', reminder_morning: 'Testimony reminder, morning', reminder_before: 'Testimony reminder, before it is due',
  reminder_after: 'Testimony reminder, after the hearing', slot_alert: 'Last hearing slot', deadline_reminder: 'Deadline reminder',
};
const kindName = k => KIND[k] || String(k || 'Alert').replace(/_/g, ' ').replace(/^./, c => c.toUpperCase());
// Suggest saves "/hearings · Hearings" (the address and the page's heading); a rating saves the address only.
export const pageOf = p => { const i = (p || '').indexOf(' · '); return i >= 0 ? p.slice(i + 3) : (p || '/'); };

let sb, api, rows = [], summary = [], timer;
const f = { kind: 'suggest', status: 'open', person: '', words: '', sort: 'new' };
const drafts = {};   // replies being typed, kept across the 30-second refresh

async function borrowStaff6Head() {
  const html = await fetch('staff6.html', { cache: 'no-cache' }).then(r => r.text());
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const waits = [];
  for (const el of doc.head.querySelectorAll('link[rel="stylesheet"], link[rel="preconnect"]')) {
    const l = document.createElement('link');
    for (const a of el.attributes) l.setAttribute(a.name, a.value);
    if (l.rel === 'stylesheet') waits.push(new Promise(ok => { l.onload = l.onerror = ok; }));
    document.head.insertBefore(l, document.getElementById('trialcss'));
  }
  const boot = doc.body.querySelector('style');
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

function signInScreen(note = '') {
  door(`<h1 tabindex="-1">Trial suggestions</h1><p>What the team said in trial runs. For Nate and the admins he names.</p>
    ${note ? `<p class="tr-note">${esc(note)}</p>` : ''}
    <form id="tr-signin" class="tr-form"><label for="tr-email">Your HIPHI email</label>
      <input id="tr-email" type="email" autocomplete="email" required inputmode="email">
      <button class="btn primary" type="submit">Email me a sign-in link</button>
      <p class="tr-msg" role="status" aria-live="polite"></p></form>`);
  document.getElementById('tr-signin').onsubmit = async e => {
    e.preventDefault();
    const email = document.getElementById('tr-email').value.trim(), b = e.target.querySelector('button');
    b.disabled = true; say('.tr-msg', 'Sending…');
    const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: HERE, shouldCreateUser: true } });
    b.disabled = false;
    if (error) return say('.tr-msg', `The link could not be sent: ${error.message}`, true);
    door(`<h1 tabindex="-1">Check your email</h1><p>We sent a sign-in link to <b>${esc(email)}</b>. It opens this page, signed in.</p>`);
  };
}
function notAdminScreen(email) {
  door(`<h1 tabindex="-1">This page is for Nate and the admins he names</h1><p><b>${esc(email)}</b> is not one of them. To say what you would change, use Suggest in a <a href="trial.html">trial run</a>.</p>
    <p><button class="btn secondary" type="button" id="tr-out">Sign out</button></p>`);
  document.getElementById('tr-out').onclick = () => sb.auth.signOut().finally(() => location.reload());
}

// ---- the page ----
function shell() {
  clearTimeout(window.__bootT);
  document.getElementById('app').innerHTML = `<main class="sg-page" id="main">
    <header class="sg-head"><h1 tabindex="-1">Trial suggestions</h1>
      <p class="tr-quiet">What the team said in trial runs. Your decision and reply show to the person under Suggest in their trial. Updates on its own.</p></header>
    <section class="sg-sum" id="sg-sum" aria-label="How the alerts were rated"></section>
    <div class="sg-tabs" role="tablist" aria-label="What to show">
      <button type="button" role="tab" data-k="suggest">Suggestions</button><button type="button" role="tab" data-k="ratings">Alert ratings</button></div>
    <form class="sg-filters" id="sg-filters" role="search">
      <label>Decision <select id="sg-status"><option value="open">New and Ask them</option><option value="">All</option>
        ${Object.entries(STATUS).map(([k, w]) => `<option value="${k}">${esc(w)}</option>`).join('')}</select></label>
      <label>Person <select id="sg-person"><option value="">Everyone</option></select></label>
      <label>Sort <select id="sg-sort"><option value="new">Newest first</option><option value="old">Oldest first</option><option value="day">By trial day</option></select></label>
      <label class="sg-words">Words <input id="sg-words" type="search" placeholder="Search what they said, the page or the alert"></label>
    </form>
    <p class="sg-count" id="sg-count" role="status" aria-live="polite"></p>
    <ul class="sg-list" id="sg-list"></ul>
    <p class="sg-foot"><button type="button" class="tr-link" id="sg-out">Sign out</button></p>
  </main>`;
  const g = id => document.getElementById(id);
  g('sg-status').onchange = e => { f.status = e.target.value; draw(); };
  g('sg-person').onchange = e => { f.person = e.target.value; draw(); };
  g('sg-sort').onchange = e => { f.sort = e.target.value; draw(); };
  g('sg-words').oninput = e => { f.words = e.target.value.trim().toLowerCase(); draw(); };
  g('sg-filters').onsubmit = e => e.preventDefault();
  document.querySelector('.sg-tabs').onclick = e => { const b = e.target.closest('[data-k]'); if (b) { f.kind = b.dataset.k; draw(); } };
  g('sg-list').addEventListener('click', onList);
  g('sg-list').addEventListener('input', e => { const li = e.target.closest('[data-id]'); if (li && e.target.matches('textarea')) drafts[li.dataset.id] = e.target.value; });
  g('sg-out').onclick = () => sb.auth.signOut().finally(() => location.reload());
  document.querySelector('.sg-head h1').focus();
}

function drawSummary() {
  const tot = summary.reduce((a, r) => ({ u: a.u + +r.useful, n: a.n + +r.not_useful, w: a.w + +r.wrong }), { u: 0, n: 0, w: 0 });
  const all = tot.u + tot.n + tot.w;
  document.getElementById('sg-sum').innerHTML = !all ? `<p class="tr-quiet">No alerts rated yet. People rate them under Alerts in a trial.</p>`
    : `<p class="sg-big"><b>${Math.round(100 * tot.u / all)}%</b> of rated alerts were marked useful <span class="tr-quiet">(${tot.u} of ${all}; ${tot.n} not useful, ${tot.w} wrong)</span></p>
      <details><summary>By kind of alert</summary><table class="sg-tab"><thead><tr><th scope="col">Alert</th><th scope="col">Useful</th><th scope="col">Not useful</th><th scope="col">Wrong</th></tr></thead>
      <tbody>${summary.map(r => `<tr><th scope="row">${esc(kindName(r.alert_kind))}</th><td>${r.useful}</td><td>${r.not_useful}</td><td>${r.wrong}</td></tr>`).join('')}</tbody></table></details>`;
}

function shown() {
  const want = f.kind === 'suggest' ? r => r.kind === 'suggest' : r => r.kind !== 'suggest';
  let out = rows.filter(want)
    .filter(r => !f.status || (f.status === 'open' ? r.status === 'new' || r.status === 'ask' : r.status === f.status))
    .filter(r => !f.person || r.person === f.person)
    .filter(r => !f.words || [r.words, r.page, r.alert_text, r.reply, r.person].some(x => (x || '').toLowerCase().includes(f.words)));
  const by = f.sort === 'day' ? r => r.trial_at : r => r.created_at;
  out.sort((a, b) => (by(a) < by(b) ? -1 : by(a) > by(b) ? 1 : 0) * (f.sort === 'new' ? -1 : 1));
  return out;
}

function card(r) {
  const rated = r.kind !== 'suggest';
  const reply = drafts[r.id] ?? r.reply ?? '';
  return `<li class="sg-card sg-${esc(r.status)}" data-id="${r.id}">
    <p class="sg-meta"><b>${esc(r.person)}</b> · ${esc(pageOf(r.page))} · ${esc(when(r.trial_at))} in the trial <span class="tr-quiet">(${esc(weekOf(r.trial_at))})</span></p>
    ${rated ? `<p class="sg-rating"><span class="sg-pill sg-${esc(r.kind)}">${esc(RATING[r.kind])}</span> ${esc(kindName(r.alert_kind))}</p>` : ''}
    ${r.words ? `<p class="sg-words-said">${esc(r.words)}</p>` : rated ? '' : ''}
    ${rated && r.alert_text ? `<details class="sg-alert"><summary>The alert as it read</summary><div>${esc(r.alert_text)}</div></details>` : ''}
    <div class="sg-decide" role="group" aria-label="Decision">${DECISIONS.map(([k, w]) => `<button type="button" class="btn secondary sm" data-dec="${k}" aria-pressed="${r.status === k}">${w}</button>`).join('')}</div>
    <div class="sg-reply"><label for="rp-${r.id}">Reply ${esc((r.person || '').split(' ')[0] || 'they')} will see <span class="tr-quiet">(optional)</span></label>
      <textarea id="rp-${r.id}" rows="2" maxlength="2000">${esc(reply)}</textarea>
      <div class="tr-dacts"><button type="button" class="btn primary sm" data-save>Save reply</button><span class="tr-quiet" role="status">${r.decided_at ? `${esc(STATUS[r.status])} · ${esc(r.decided_by || '')}, ${esc(fmt(r.decided_at, { month: 'short', day: 'numeric' }))}` : ''}</span></div></div>
  </li>`;
}

function draw() {
  document.querySelectorAll('.sg-tabs [role=tab]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.k === f.kind)));
  const people = [...new Set(rows.map(r => r.person))].sort();
  const ps = document.getElementById('sg-person');
  ps.innerHTML = `<option value="">Everyone</option>${people.map(p => `<option${p === f.person ? ' selected' : ''}>${esc(p)}</option>`).join('')}`;
  const list = shown(), total = rows.filter(r => (f.kind === 'suggest') === (r.kind === 'suggest')).length;
  say('#sg-count', total ? `${list.length} of ${total} ${f.kind === 'suggest' ? 'suggestions' : 'alert ratings'}` : '');
  document.getElementById('sg-list').innerHTML = list.length ? list.map(card).join('')
    : `<li class="sg-empty">${total ? 'Nothing matches. Try All under Decision, or clear the words.' : f.kind === 'suggest' ? 'No suggestions yet. They come from Suggest on the band in a trial run.' : 'No alerts rated yet.'}</li>`;
}

async function decide(id, status, reply, msg) {
  msg.textContent = 'Saving…';
  const { data, error } = await api.rpc('decide', { p_id: +id, p_status: status, p_reply: reply });
  if (error) { msg.textContent = error.message; msg.classList.add('bad'); return; }
  const i = rows.findIndex(r => r.id === +id); if (i >= 0) rows[i] = data;
  delete drafts[id];
  const li = document.querySelector(`.sg-card[data-id="${id}"]`);
  const keep = document.activeElement?.dataset?.dec || (document.activeElement?.hasAttribute('data-save') ? 'save' : '');
  if (li) li.outerHTML = card(data);
  const nli = document.querySelector(`.sg-card[data-id="${id}"]`);
  const st = nli?.querySelector('[role=status]'); if (st) st.textContent = `Saved · ${STATUS[data.status]}`;
  (keep === 'save' ? nli?.querySelector('[data-save]') : nli?.querySelector(`[data-dec="${keep || data.status}"]`))?.focus();
}

function onList(e) {
  const li = e.target.closest('.sg-card'); if (!li) return;
  const r = rows.find(x => x.id === +li.dataset.id); if (!r) return;
  const msg = li.querySelector('.sg-reply [role=status]'), reply = li.querySelector('textarea').value;
  const d = e.target.closest('[data-dec]');
  if (d) return decide(r.id, d.dataset.dec === r.status ? 'new' : d.dataset.dec, reply, msg);   // a second tap undoes it
  if (e.target.closest('[data-save]')) return decide(r.id, r.status, reply, msg);
}

async function load() {
  const [a, b] = await Promise.all([api.rpc('suggestions', { p_limit: 2000 }), api.rpc('alert_summary')]);
  if (a.error) throw a.error;
  rows = a.data || []; summary = b.data || [];
  // A reply being typed is not redrawn away: the refresh waits while a reply box has the cursor.
  if (document.activeElement?.matches('.sg-reply textarea')) return;
  drawSummary(); draw();
}

async function boot() {
  try {
    const [head, mod] = await Promise.all([borrowStaff6Head(), import(SUPABASE_JS)]);
    BRAND = head;
    sb = mod.createClient(PRACTICE_URL, PRACTICE_KEY);
    api = sb.schema('trial_api');
    if (/access_token|refresh_token/.test(location.hash)) history.replaceState(null, '', location.pathname + location.search);
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return signInScreen();
    const { data: me, error } = await api.rpc('whoami');
    if (error) throw error;
    if (!me?.admin) return notAdminScreen(me?.email || session.user.email);
    shell();
    await load();
    timer = setInterval(() => load().catch(() => {}), 30000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) load().catch(() => {}); });
  } catch (e) {
    console.error(e);
    door(`<h1 tabindex="-1">We could not open the suggestions</h1><p>${esc(e?.message || e)}</p><button class="btn primary" type="button" onclick="location.reload()">Try again</button>`);
  }
}
if (!window.__TRIAL_TEST) boot();
