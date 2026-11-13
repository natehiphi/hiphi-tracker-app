// Staff v6 (R-336, spec 3.1 "You", 6 "Partners, My settings", V26; F188, F189, F25): My settings (#/me), from You at the
// foot of the sidebar (on a phone, More, then You). One page that saves as you change it, with no Save button:
//   1. Where your alerts go (R-387, Nate 13 Nov 2026: "people work differently"): one row per kind of alert this person can
//      get, each with a Slack DM tick and an Email tick: one, both or neither ("truly none", stand-ins included). Saved to
//      advocates.prefs.route; migration 199's notifications_route trigger applies it to every alert as it is queued. A row
//      never ticked shows what the old single choice (slack_dm, workflow, reminders) sends, so nothing changes until they
//      tick. Send me a test, one button per place in use. New hearings post in channels, as before (channels per person: later).
//   2. Deadline alert times (one closed fold, only while deadline alerts go somewhere).
//   4. Colors (Nate 10/25): the app's palette, this person's own; HIPHI Family unless they pick another. One closed fold,
//      each choice drawn in its own colours; it changes the moment it is picked and saves to advocates.prefs.palette.
//   5. Sign out.
// Same data and calls as v5: advocates.slack_dm and advocates.prefs ({ reminders, workflow }) through DB.saveMyPrefs, and
// DB.slackTest. "Only in the app" is every kind switched off, which the database reads as "send nothing". Email is described
// as working (CLAUDE.md rule 14: it is on before the public uses the tracker).
import { S, DB, DEMO, esc, hooks } from './data.js';
import { hearingAhead, diedish } from './model.js';
import { icon, btn, switchRow, field, toast } from './ui.js';
import { markNewStep } from './help.js';
import { PALETTES, FAMILIES, DEFAULT_PALETTE } from './palettes.js';
import { myPalette, applyPalette } from './app.js';
// Settings the database reads besides the seven kinds, each on unless switched off: a to-do given to you (065), "put you down
// for the hearing" (065), an issue made yours (091), a draft moved to you (088). "Only in the app" turns these off too.
const MORE_KINDS = ['todo', 'hearing', 'issue', 'draft_moved'];
// The rows of Where your alerts go: the key migration 199's alert_route_key gives a queued message, the words, who gets
// that kind (a row is shown only to them; hidden rows keep their value), and what leaving both ticks off means for them (a
// calm line under the row, only for the kinds that someone is waiting on).
const isApprover = me => me.is_admin || me.can_approve;
// Nate 13 Nov: the testimony steps are one row, "Testimony updates"; its ticks set all six kinds together (the database
// still keeps them apart, so a later split needs no migration).
const TESTIMONY = ['review_requested', 'second_review_requested', 'draft_created', 'approved', 'changes_requested', 'filed'];
const ROWS = [
  { k: 'testimony', keys: TESTIMONY, t: 'Testimony updates', s: me => `New drafts, ${isApprover(me) || me.is_reviewer ? 'drafts waiting for your approval, ' : ''}approvals, notes sent back${me.is_admin ? ' and filings' : ''}`,
    none: me => isApprover(me) || me.is_reviewer ? 'Drafts waiting for your approval will sit on Today until you open the tracker.' : '' },
  { k: 'deadlines', t: 'Testimony deadline alerts', s: 'Bills you own, until the testimony is filed', who: me => ownsBills(me), none: me => liveOwned(me) ? `Deadline alerts for your ${liveOwned(me)} bill${liveOwned(me) === 1 ? '' : 's'} with a hearing ahead won’t reach you outside the app.` : '' },
  { k: 'chat', t: 'Messages on bills I own, follow or wrote on', s: '' },
  { k: 'given', t: 'Something given to me', s: 'A to-do, a hearing, an issue or a draft' },
  { k: 'standin', t: 'Standing in for a teammate', s: 'When the person a step is for can’t be reached, it is passed to you', none: 'Steps passed to you will sit on Today until you open the tracker.' },
  { k: 'admin', t: 'Admin notices', s: 'Last hearing slots, supporter emails to approve', who: isApprover },
];
const keysOf = row => row.keys || [row.k];
const PLACES = [['slack', 'Slack DM'], ['email', 'Email']];
// The same work, kind by kind, in the old settings (before R-387): what the database sends a person who never ticked a row.
const WF_KEYS = ['review_requested', 'second_review_requested', 'draft_created', 'approved', 'changes_requested', 'filed', 'chat'];
const REM = [['morning', 'The morning testimony is due'], ['before', 'Shortly before it is due'], ['after', 'After the deadline, if it is not filed']];
const hhmm = t => { const m = /^(\d{1,2}):(\d{2})/.exec(t || ''); if (!m) return t || ''; const h = +m[1]; return `${h % 12 || 12}:${m[2]} ${h < 12 ? 'AM' : 'PM'}`; };

const ownsBills = me => (S.bills || []).some(b => (S.assignments[b.id] || []).includes(me.id));
// Bills this person owns that are still live with a hearing ahead: whose deadline alerts leaving both ticks off silences.
const liveOwned = me => (S.bills || []).filter(b => (S.assignments[b.id] || []).includes(me.id) && !diedish(b) && hearingAhead(b)).length;
function reminders(me) {
  const rem = (me.prefs || {}).reminders || {}, dflt = (S.slackCfg || {}).reminder_defaults || {};
  const v = (x, d) => x == null ? d : x;
  return { morning_on: v(rem.morning_on, dflt.morning_on !== false), morning: v(rem.morning, dflt.morning || '08:35'), before_on: v(rem.before_on, dflt.before_on !== false),
    hours_before: v(rem.hours_before, dflt.hours_before || 1), after_on: v(rem.after_on, dflt.after_on !== false), after: v(rem.after, dflt.after || '16:00') };
}
function oldPlaces(me, k) {
  const wf = (me.prefs || {}).workflow || {}, r = reminders(me), one = [me.slack_dm !== false ? 'slack' : 'email'];
  const remOn = r.morning_on || r.before_on || r.after_on;
  const quiet = !remOn && WF_KEYS.every(x => wf[x] === false);   // the old "Only in the app"
  if (k === 'standin' || k === 'admin') return one;               // these always came
  if (quiet) return [];
  if (k === 'deadlines') return me.slack_dm !== false && remOn ? ['slack'] : [];   // deadline alerts came only by Slack DM
  if (k === 'given') return MORE_KINDS.every(x => wf[x] === false) ? [] : one;
  return wf[k] === false ? [] : one;
}
const places = (me, k) => { const r = ((me.prefs || {}).route || {})[k]; return Array.isArray(r) ? r.filter(x => x === 'slack' || x === 'email') : oldPlaces(me, k); };
// Every row's places, shown or not, so a save never loses a hidden row's choice.
const allRoutes = me => Object.fromEntries(ROWS.flatMap(keysOf).map(k => [k, places(me, k)]));
const rowPlaces = (me, row) => PLACES.map(([p]) => p).filter(p => keysOf(row).every(k => places(me, k).includes(p)));
// What the queue functions read besides the route, kept in step with it: a kind with no place is switched off (so it is not
// even queued), deadline alerts with a place have at least one time on, and slack_dm stays on when Slack or deadline alerts
// are wanted (queue_deadline_reminders queues only for slack_dm; the route then moves each alert where it was ticked).
function prefsFor(me, route) {
  const prefs = me.prefs || {}, wf = { ...(prefs.workflow || {}) };
  WF_KEYS.forEach(k => { wf[k] = route[k].length > 0; });
  MORE_KINDS.forEach(k => { wf[k] = route.given.length > 0; });
  const rem = reminders(me);
  if (route.deadlines.length && !(rem.morning_on || rem.before_on || rem.after_on)) Object.assign(rem, { morning_on: true, before_on: true, after_on: true });
  const slack_dm = Object.values(route).some(a => a.includes('slack')) || route.deadlines.length > 0;
  return { slack_dm, prefs: { ...prefs, route, workflow: wf, reminders: rem } };
}

// ---- Colors: a small drawing of the app in each palette (page, a card with a name and a line, the button, a done check) ----
const swatch = sw => { const [page, card, action, awash, leaf, coral, ink] = sw;
  return `<span class="me-pv" aria-hidden="true" style="background:${page}"><span class="me-pvc" style="background:${card}"><i style="background:${ink}"></i><i style="background:${awash}"></i></span><span class="me-pvb"><b style="background:${action}"></b><em style="background:${leaf}"></em><em style="background:${coral}"></em></span></span>`; };
function colors() {
  const now = myPalette(), cur = PALETTES.find(p => p.id === now);
  const opt = p => `<label class="me-col"><input type="radio" name="me-col" value="${p.id}" ${p.id === now ? 'checked' : ''}>${swatch(p.sw)}<span class="me-colx"><span class="me-coln">${esc(p.name)}</span><span class="me-colt">${esc(p.note)}</span></span></label>`;
  return `<section class="me-sec" aria-labelledby="me-colh">
        <h2 class="me-h2" id="me-colh">Colors</h2>
        <p class="me-lede">Pick the colors you like to work in. Only you see them. Teammates see their own.</p>
        ${now !== DEFAULT_PALETTE ? `<div class="me-acts me-colback">${btn('Back to HIPHI Family', { kind: 'text', icon: 'rotate-ccw', attrs: { 'data-coldef': '1' } })}</div>` : ''}
        <details class="me-fine me-colors"${S.meColors ? ' open' : ''}><summary><span class="me-colsum">${swatch(cur.sw)}<span>Your colors: <b class="me-colcur">${esc(cur.name)}</b></span></span>${icon('chevron-down', { cls: 'me-fchev' })}</summary><div class="me-finein">
          <fieldset class="me-fs"><legend class="sr">Colors</legend>
          ${FAMILIES.map(f => `<h3 class="me-colfam">${esc(f)}</h3><div class="me-colgrid">${PALETTES.filter(p => p.family === f).map(opt).join('')}</div>`).join('')}
          </fieldset>
        </div></details>
      </section>`;
}

export default {
  tab: 'you', narrow: true,   // a form: a reading column on a wide screen
  title: () => 'My settings',
  render() {
    const me = S.me || {}, r = reminders(me), toEmail = (S.slackCfg || {}).workflow_dm === false;
    const rows = ROWS.filter(x => !x.who || x.who(me));
    const reach = DEMO ? `Practice copy: nothing is actually sent. Email would go to ${me.email || 'your address'}.`
      : `Slack: ${me.slack_user_id ? 'your account is linked' : 'linked by your email the first time the tracker messages you'}. Email goes to ${me.email || 'your address'}.`;
    const cell = (row, [pl, name], on) => `<label class="me-tick"><input type="checkbox" data-route="${row.k}" data-place="${pl}" ${on ? 'checked' : ''} aria-label="${esc(row.t)}: ${name}"><span class="me-box" aria-hidden="true">${icon('check')}</span><span class="me-tcap" aria-hidden="true">${pl === 'slack' ? 'Slack' : 'Email'}</span></label>`;
    const line = row => {
      const now = rowPlaces(me, row), none = !now.length && row.none ? (typeof row.none === 'function' ? row.none(me) : row.none) : '';
      return `<div class="me-rrow" role="row"><span class="me-rlab" role="rowheader"><span class="me-rn">${esc(row.t)}</span>${row.s ? `<span class="me-rt">${esc(typeof row.s === 'function' ? row.s(me) : row.s)}</span>` : ''}${none ? `<span class="me-rnone">${icon('info')}<span>${esc(none)}</span></span>` : ''}</span>
        ${PLACES.map(p => `<span class="me-rcell" role="cell">${cell(row, p, now.includes(p[0]))}</span>`).join('')}</div>`;
    };
    // Every alert: one tick per column that sets every row shown (critic: switching all to email was 20 taps).
    const allOn = pl => rows.every(x => rowPlaces(me, x).includes(pl));
    const every = `<div class="me-rrow me-rall" role="row"><span class="me-rlab" role="rowheader"><span class="me-rn"><b>Every alert</b></span><span class="me-rt">Tick or clear a whole column</span></span>
        ${PLACES.map(([pl, name]) => `<span class="me-rcell" role="cell"><label class="me-tick"><input type="checkbox" data-all="${pl}" ${allOn(pl) ? 'checked' : ''} aria-label="Every alert: ${name}"><span class="me-box" aria-hidden="true">${icon('check')}</span><span class="me-tcap" aria-hidden="true">${pl === 'slack' ? 'Slack' : 'Email'}</span></label></span>`).join('')}</div>`;
    const used = new Set(rows.flatMap(x => rowPlaces(me, x)));
    const tests = PLACES.filter(([pl]) => used.has(pl)).map(([pl, name]) => btn(pl === 'slack' ? 'Send me a test DM' : 'Send me a test email', { kind: 'secondary', icon: 'send', attrs: { 'data-test': pl } })).join('');
    const remTimes = { morning: `At ${hhmm(r.morning)}`, before: `${r.hours_before} hour${Number(r.hours_before) === 1 ? '' : 's'} before`, after: `At ${hhmm(r.after)}` };
    // Deadline alert times sit behind one fold, closed until opened (B-12), and only while deadline alerts go somewhere.
    const fine = !ownsBills(me) || !places(me, 'deadlines').length ? '' : `<details class="me-fine"${S.meFine ? ' open' : ''}><summary><span>When deadline alerts arrive</span>${icon('chevron-down', { cls: 'me-fchev' })}</summary><div class="me-finein">
        <div class="me-card">${REM.map(([k, l]) => switchRow('me-rem-' + k, l, r[k + '_on'], remTimes[k], { 'data-rem': k })).join('')}</div>
        ${r.morning_on || r.before_on || r.after_on ? `<h3 class="me-h3">Alert times</h3>
        <div class="me-card me-times">${r.morning_on ? field('me-mont', 'Morning alert', `<input id="me-mont" type="time" value="${esc(r.morning)}" data-remv="morning">`) : ''}
          ${r.before_on ? field('me-befh', 'Hours before', `<input id="me-befh" type="number" min="0.5" max="48" step="0.5" inputmode="decimal" value="${esc(r.hours_before)}" data-remv="hours_before">`) : ''}
          ${r.after_on ? field('me-aftt', 'After the deadline', `<input id="me-aftt" type="time" value="${esc(r.after)}" data-remv="after">`) : ''}</div>` : ''}
      </div></details>`;
    const ch = esc((S.slackCfg || {}).main_channel || '#hearing-alerts');
    return `<div class="me-page">
      <h1 class="v6-ptitle sv-h1">My settings</h1>
      <section class="me-sec" aria-labelledby="me-where">
        <h2 class="me-h2" id="me-where">Where your alerts go</h2>
        <p class="me-lede">Tick Slack DM, Email, both or neither for each kind. Whatever you pick, Today lists every step that is yours.</p>
        ${toEmail ? `<p class="me-note">${icon('info')}<span>An admin sends testimony steps and messages by email for everyone, so those come by email if either box is ticked.</span></p>` : ''}
        <div class="me-rtable" role="table" aria-label="Where your alerts go">
          <div class="me-rrow me-rhead" role="row"><span class="me-rlab" role="columnheader"><span class="sr">Alert</span></span>${PLACES.map(([, n]) => `<span class="me-rcell" role="columnheader">${n}</span>`).join('')}</div>
          ${every}
          ${rows.map(line).join('')}
        </div>
        <p class="me-note me-reach">${icon('info')}<span>${esc(reach)}</span></p>
        ${tests ? `<div class="me-acts">${tests}</div>` : ''}
        ${fine}
        <ul class="me-routes" role="list">
          <li class="me-route">${icon('newspaper')}<span class="me-rtx"><span class="me-rn">New hearings</span><span class="me-rt">Posted in ${ch} and your coalition’s channel, not to you alone</span></span></li>
          <li class="me-route">${icon('inbox')}<span class="me-rtx"><span class="me-rn">Messages and the tracker’s notes</span><span class="me-rt">Kept in your Inbox, whatever you pick here</span></span></li>
        </ul>
      </section>
      ${colors()}
      <section class="me-sec" aria-labelledby="me-acc">
        <h2 class="sr" id="me-acc">Account</h2>
        <div class="me-acts">${btn('Sign out', { kind: 'text', icon: 'log-out', attrs: { 'data-signout': '1' } })}${DEMO ? '<span class="me-note me-inline">In the practice copy this starts it over.</span>' : ''}</div>
      </section>
    </div>`;
  },
  wire(route, root) {
    const save = async (slack_dm, prefs, msg = 'Saved.') => {
      const before = { slack_dm: S.me.slack_dm, prefs: S.me.prefs };
      // Getting started's settings step ticks when a setting is saved, not from opening this page (kept in their settings,
      // so it follows them to the phone, R-316 W7).
      try { await DB.saveMyPrefs({ slack_dm, prefs }); toast(msg, { ok: true }); markNewStep({ settings: 1 }); }
      catch (e) { Object.assign(S.me, before); toast(e, { err: true }); }
      const y = window.scrollY, id = document.activeElement?.id, rk = document.activeElement?.dataset?.route, pk = document.activeElement?.dataset?.place;
      hooks.render(); window.scrollTo(0, y);
      const ak = document.activeElement?.dataset?.all;
      const back = id ? document.getElementById(id) : rk ? document.querySelector(`[data-route="${rk}"][data-place="${pk}"]`) : ak ? document.querySelector(`[data-all="${ak}"]`) : null;
      back?.focus({ preventScroll: true });
    };
    // A tick saves every row at once (R-387), in words that say where that kind now goes.
    root.querySelectorAll('[data-route]').forEach(i => i.onchange = () => {
      const me = S.me, route = allRoutes(me), k = i.dataset.route, pl = i.dataset.place;
      const row = ROWS.find(x => x.k === k), was = rowPlaces(me, row);
      const want = PLACES.map(([p]) => p).filter(p => p === pl ? i.checked : was.includes(p));
      keysOf(row).forEach(x => { route[x] = want; });
      const { slack_dm, prefs } = prefsFor(me, route);
      const to = want.length === 2 ? 'Slack DM and email' : want[0] === 'slack' ? 'Slack DM' : want[0] === 'email' ? 'email' : null;
      save(slack_dm, prefs, to ? `Saved. ${row.t}: by ${to}.` : `Saved. ${row.t}: only in the app.`);
    });
    root.querySelectorAll('[data-all]').forEach(i => i.onchange = () => {
      const me = S.me, route = allRoutes(me), pl = i.dataset.all, name = pl === 'slack' ? 'Slack DM' : 'email';
      ROWS.filter(x => !x.who || x.who(me)).flatMap(keysOf).forEach(k => {
        route[k] = PLACES.map(([p]) => p).filter(p => p === pl ? i.checked : route[k].includes(p)); });
      const { slack_dm, prefs } = prefsFor(me, route);
      save(slack_dm, prefs, i.checked ? `Saved. Every alert by ${name}.` : `Saved. No alerts by ${name}.`);
    });
    root.querySelectorAll('[data-rem], [data-remv]').forEach(i => i.onchange = () => {
      const me = S.me, rem = reminders(me);
      if (i.dataset.remv === 'hours_before' && !(Number(i.value) >= 0.5 && Number(i.value) <= 48)) { toast('Use a number of hours from 0.5 to 48.', { err: true }); return; }
      root.querySelectorAll('[data-rem]').forEach(x => { rem[x.dataset.rem + '_on'] = x.checked; });
      root.querySelectorAll('[data-remv]').forEach(x => { const k = x.dataset.remv; rem[k] = k === 'hours_before' ? (Number(x.value) || 1) : (x.value || rem[k]); });
      save(me.slack_dm !== false, { ...(me.prefs || {}), reminders: rem });
    });
    root.querySelector('.me-fine:not(.me-colors)')?.addEventListener('toggle', e => { S.meFine = e.currentTarget.open; });
    root.querySelector('.me-colors')?.addEventListener('toggle', e => { S.meColors = e.currentTarget.open; });
    // A pick shows at once (no Save) and goes to their settings; if the save is refused it stays in this browser.
    const pickColors = (id, { now = false } = {}) => {
      const p = PALETTES.find(x => x.id === id); if (!p) return;
      if (S.colWas == null) S.colWas = myPalette();   // what they had before this run of picks, for Undo
      applyPalette(id, { save: true });
      const cur = root.querySelector('.me-colcur'); if (cur) cur.textContent = p.name;
      clearTimeout(S.colT);
      S.colT = setTimeout(async () => {
        const was = S.colWas; S.colWas = null;
        let msg = `Your colors: ${p.name}.`;
        try { await DB.patchPrefs({ palette: id }); markNewStep({ settings: 1 }); } catch { msg = `Your colors: ${p.name}, on this computer. They could not be saved to your settings.`; }
        toast(msg, { ok: true, undo: was && was !== id ? () => pickColors(was, { now: true }) : null });
        const y = window.scrollY; hooks.render(); window.scrollTo(0, y);
        document.querySelector(`input[name="me-col"][value="${id}"]`)?.focus({ preventScroll: true });
      }, now ? 0 : 800);
    };    root.querySelectorAll('input[name="me-col"]').forEach(i => i.onchange = () => pickColors(i.value));
    const cd = root.querySelector('[data-coldef]'); if (cd) cd.onclick = () => pickColors(DEFAULT_PALETTE);
    root.querySelectorAll('[data-test]').forEach(t => t.onclick = async () => { t.setAttribute('aria-busy', 'true');
      const pl = t.dataset.test;
      try {
        const r = await DB.alertTest(pl);
        toast(DEMO ? `Practice copy: a test ${pl === 'slack' ? 'DM' : 'email'} would be on its way.`
          : r === 'held' ? 'Email to the team is paused in Settings, so the test is held. An admin can turn it on.'
          : pl === 'slack' ? 'Test DM on its way. Check Slack.' : `Test email on its way to ${S.me.email || 'your address'}.`, { ok: true });
      } catch (e) { toast(e, { err: true }); }
      finally { t.removeAttribute('aria-busy'); } });
    const so = root.querySelector('[data-signout]');
    if (so) so.onclick = () => DB.logout();
  },
};
