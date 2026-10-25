// Staff v6 (R-336, spec 3.1 "You", 6 "Partners, My settings", V26; F188, F189, F25): My settings (#/me), from You at the
// foot of the sidebar (on a phone, More, then You). One page that saves as you change it, with no Save button:
//   1. How the tracker reaches you: Slack DM, Email or Only in the app, and Send me a test DM.
//   2. Where each alert goes: said truthfully, person by person, from the same settings the database reads (V26: "My
//      settings says so"): testimony steps and messages follow your choice; deadline alerts go only by Slack DM and only to
//      a bill's owner (queue_deadline_reminders); stand-ins for an approver always come; new hearings post in channels.
//   3. Fine-tune what you are told, and when: each kind on or off, and the alert times (one closed fold: details wait until
//      asked for).
//   4. Colors (Nate 10/25): the app's palette, this person's own; HIPHI Family unless they pick another. One closed fold,
//      each choice drawn in its own colours; it changes the moment it is picked and saves to advocates.prefs.palette.
//   5. Sign out.
// Same data and calls as v5: advocates.slack_dm and advocates.prefs ({ reminders, workflow }) through DB.saveMyPrefs, and
// DB.slackTest. "Only in the app" is every kind switched off, which the database reads as "send nothing". Email is described
// as working (CLAUDE.md rule 14: it is on before the public uses the tracker).
import { S, DB, DEMO, esc, hooks } from './data.js';
import { WORKFLOW_KINDS, hearingAhead, diedish } from './model.js';
import { icon, btn, switchRow, field, toast } from './ui.js';
import { markNewStep } from './help.js';
import { PALETTES, FAMILIES, DEFAULT_PALETTE } from './palettes.js';
import { myPalette, applyPalette } from './app.js';
// Settings the database reads besides the seven kinds, each on unless switched off: a to-do given to you (065), "put you down
// for the hearing" (065), an issue made yours (091), a draft moved to you (088). "Only in the app" turns these off too.
const MORE_KINDS = ['todo', 'hearing', 'issue', 'draft_moved'];
// Plain labels for what each kind is about (WORKFLOW_KINDS keys, the same order).
const WF_LABEL = { chat: ['Messages on bills I own, follow or wrote on', ''], draft_created: ['A new testimony draft for one of my bills', ''],
  review_requested: ['Testimony waiting for my approval', 'Admins and approvers give the first approval'], second_review_requested: ['A first testimony that needs my second look', 'Second approvers give it'],
  approved: ['My testimony was approved', ''], changes_requested: ['My testimony was sent back with a note', ''], filed: ['Someone filed testimony on my bill', ''] };
// Each kind in a few words, for Where each alert goes ("a new draft, waiting for your approval and sent back").
const STEP_WORD = { draft_created: 'a new draft', review_requested: 'waiting for your approval', second_review_requested: 'a second look', approved: 'approved', changes_requested: 'sent back', filed: 'filed' };
const REM = [['morning', 'The morning testimony is due'], ['before', 'Shortly before it is due'], ['after', 'After the deadline, if it is not filed']];
const hhmm = t => { const m = /^(\d{1,2}):(\d{2})/.exec(t || ''); if (!m) return t || ''; const h = +m[1]; return `${h % 12 || 12}:${m[2]} ${h < 12 ? 'AM' : 'PM'}`; };
const andList = xs => xs.length <= 1 ? (xs[0] || '') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;

// The switches that can fire for this person: first approvals reach admins and approvers, the second look only second
// approvers; someone who owns no bills gets no draft for one; "filed" goes to admins only (154). Hidden ones keep their value.
const ownsBills = me => (S.bills || []).some(b => (S.assignments[b.id] || []).includes(me.id));
const kindsFor = me => WORKFLOW_KINDS.map(([k]) => k).filter(k => (k !== 'review_requested' || me.is_admin || me.can_approve) && (k !== 'second_review_requested' || me.is_reviewer)
  && (k !== 'draft_created' || ownsBills(me)) && (k !== 'filed' || me.is_admin));
// Bills this person owns that are still live with a hearing ahead: whose deadline alerts "Only in the app" silences.
const liveOwned = me => (S.bills || []).filter(b => (S.assignments[b.id] || []).includes(me.id) && !diedish(b) && hearingAhead(b)).length;
function current() {
  const me = S.me || {}, prefs = me.prefs || {}, rem = prefs.reminders || {}, wf = prefs.workflow || {}, dflt = (S.slackCfg || {}).reminder_defaults || {};
  const v = (x, d) => x == null ? d : x;
  const r = { morning_on: v(rem.morning_on, dflt.morning_on !== false), morning: v(rem.morning, dflt.morning || '08:35'), before_on: v(rem.before_on, dflt.before_on !== false),
    hours_before: v(rem.hours_before, dflt.hours_before || 1), after_on: v(rem.after_on, dflt.after_on !== false), after: v(rem.after, dflt.after || '16:00') };
  const w = Object.fromEntries(WORKFLOW_KINDS.map(([k]) => [k, wf[k] !== false]));
  const more = Object.fromEntries(MORE_KINDS.map(k => [k, wf[k] !== false]));
  const quiet = !r.morning_on && !r.before_on && !r.after_on && Object.values(w).every(x => !x);
  return { me, prefs, r, w, more, mode: quiet ? 'app' : me.slack_dm !== false ? 'slack' : 'email' };
}

// ---- where each alert goes, in words, from the settings as they are now (V26) ----
function routes() {
  const { me, r, w, more, mode } = current(), toEmail = (S.slackCfg || {}).workflow_dm === false;
  const way = mode === 'app' ? '' : mode === 'email' || toEmail ? `Email, to ${me.email || 'your address'}` : 'Slack DM';
  const on = ks => ks.some(k => w[k]);
  const steps = kindsFor(me).filter(k => k !== 'chat');
  const say = (yes, extra = '') => mode === 'app' || !yes ? 'Off: only in the app' : `${way}${extra}`;
  const remOn = REM.filter(([k]) => r[k + '_on']).map(([k]) => ({ morning: `the morning it is due (${hhmm(r.morning)})`, before: `${r.hours_before} hour${Number(r.hours_before) === 1 ? '' : 's'} before`, after: `after the deadline (${hhmm(r.after)})` }[k]));
  const deadline = !ownsBills(me) ? 'To each bill’s owner, not to you: you own no bills'
    : mode !== 'slack' || toEmail ? 'Off: deadline alerts come only by Slack DM'
      : remOn.length ? `Slack DM: ${andList(remOn)}` : 'Off: only in the app';
  const approver = me.is_admin || me.can_approve || me.is_reviewer;
  const ch = esc((S.slackCfg || {}).main_channel || '#hearing-alerts');
  return [
    ['file-text', 'Your testimony steps', say(on(steps), steps.length ? `: ${andList(steps.filter(k => w[k]).map(k => STEP_WORD[k]))}` : '')],
    ['message-square', 'Messages on your bills', say(w.chat)],
    ['clock', 'Testimony deadline alerts', deadline],
    ['user-plus', 'Something given to you', say(Object.values(more).some(Boolean), ': a to-do, a hearing, an issue or a draft')],
    ...(approver ? [['user-check', 'Standing in for an approver', mode === 'app' ? `Always comes, ${me.slack_dm !== false ? 'by Slack DM' : 'by email'}, even with Only in the app` : `Always comes, ${way.startsWith('Email') ? 'by email' : 'by Slack DM'}`]] : []),
    ['megaphone', 'New hearings', `Posted in ${ch} and your coalition’s channel, not to you alone`],
    ['inbox', 'Messages and the tracker’s notes', 'Kept in your Inbox, whatever you pick here'],
  ];
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
    const { me, r, w, mode } = current(), helper = !ownsBills(me), toEmail = (S.slackCfg || {}).workflow_dm === false;
    const slackState = DEMO ? 'Practice copy: nothing is sent' : me.slack_user_id ? 'Your Slack account is linked' : 'Linked by your email the first time the tracker messages you';
    const opt = (val, title, sub) => `<label class="me-opt"><input type="radio" name="me-reach" value="${val}" ${mode === val ? 'checked' : ''}><span class="me-dot" aria-hidden="true"></span><span class="me-optx"><span class="me-optt">${title}</span><span class="me-opts">${sub}</span></span></label>`;
    const remTimes = { morning: `At ${hhmm(r.morning)}`, before: `${r.hours_before} hour${Number(r.hours_before) === 1 ? '' : 's'} before`, after: `At ${hhmm(r.after)}` };
    // Everything a person changes now and then sits behind one fold, closed until they open it (B-12).
    const fine = mode === 'app' ? '' : `<details class="me-fine"${S.meFine ? ' open' : ''}><summary><span>Fine-tune what you are told, and when</span>${icon('chevron-down', { cls: 'me-fchev' })}</summary><div class="me-finein">
        ${helper ? '' : mode === 'slack' ? `<h3 class="me-h3">Testimony deadlines</h3><p class="me-note">Only for bills you own, until the testimony is marked filed.</p>
        <div class="me-card">${REM.map(([k, l]) => switchRow('me-rem-' + k, l, r[k + '_on'], remTimes[k], { 'data-rem': k })).join('')}</div>
        ${r.morning_on || r.before_on || r.after_on ? `<h3 class="me-h3">Alert times</h3>
        <div class="me-card me-times">${r.morning_on ? field('me-mont', 'Morning alert', `<input id="me-mont" type="time" value="${esc(r.morning)}" data-remv="morning">`) : ''}
          ${r.before_on ? field('me-befh', 'Hours before', `<input id="me-befh" type="number" min="0.5" max="48" step="0.5" inputmode="decimal" value="${esc(r.hours_before)}" data-remv="hours_before">`) : ''}
          ${r.after_on ? field('me-aftt', 'After the deadline', `<input id="me-aftt" type="time" value="${esc(r.after)}" data-remv="after">`) : ''}</div>` : ''}`
        : `<p class="me-note">${icon('info')}<span>Deadline alerts come only by Slack DM. Pick Slack DM to get them.</span></p>`}
        <h3 class="me-h3">Testimony and messages</h3>
        <div class="me-card">${kindsFor(me).map(k => switchRow('me-wf-' + k, WF_LABEL[k][0], w[k], WF_LABEL[k][1], { 'data-wf': k })).join('')}</div>
      </div></details>`;
    const rt = routes();
    return `<div class="me-page">
      <h1 class="v6-ptitle sv-h1">My settings</h1>
      <section class="me-sec" aria-labelledby="me-reach">
        <h2 class="me-h2" id="me-reach">How the tracker reaches you</h2>
        <p class="me-lede">Today lists every step that is yours, whatever you pick here.</p>
        <fieldset class="me-fs"><legend class="sr">Alerts come by</legend>
          <div class="me-opts-card">
            ${opt('slack', 'Slack DM', esc(slackState) + (toEmail ? '. An admin has sent testimony steps to email for everyone.' : ''))}
            ${opt('email', 'Email', `To ${esc(me.email || 'your address')}. Testimony steps and messages; deadline alerts come only by Slack.`)}
            ${opt('app', 'Only in the app', `No alerts, except when ${me.is_admin || me.can_approve || me.is_reviewer ? 'you stand in for an approver or ' : ''}a step is passed to you.${mode === 'app' && liveOwned(me) ? ` <b>Deadline alerts for your ${liveOwned(me)} bill${liveOwned(me) === 1 ? '' : 's'} with a hearing ahead won’t reach anyone.</b> Pick Slack DM to get them.` : ''}`)}
          </div></fieldset>
        ${mode === 'slack' ? `<div class="me-acts">${btn('Send me a test DM', { kind: 'secondary', icon: 'send', attrs: { 'data-test': '1' } })}</div>` : ''}
      </section>
      <section class="me-sec" aria-labelledby="me-where">
        <h2 class="me-h2" id="me-where">Where each alert goes</h2>
        <ul class="me-routes" role="list">${rt.map(([ic, name, to]) => `<li class="me-route">${icon(ic)}<span class="me-rtx"><span class="me-rn">${esc(name)}</span><span class="me-rt">${esc(to)}</span></span></li>`).join('')}</ul>
        ${fine}
      </section>
      ${colors()}
      <section class="me-sec" aria-labelledby="me-acc">
        <h2 class="sr" id="me-acc">Account</h2>
        <div class="me-acts">${btn('Sign out', { kind: 'text', icon: 'log-out', attrs: { 'data-signout': '1' } })}${DEMO ? '<span class="me-note me-inline">In the practice copy this starts it over.</span>' : ''}</div>
      </section>
    </div>`;
  },
  wire(route, root) {
    // Read every visible control plus the hidden values, and save the whole prefs object (as v5 did).
    const collect = () => {
      const { me, prefs, r, w } = current();
      const rem = { ...r }; root.querySelectorAll('[data-rem]').forEach(i => { rem[i.dataset.rem + '_on'] = i.checked; });
      root.querySelectorAll('[data-remv]').forEach(i => { const k = i.dataset.remv; rem[k] = k === 'hours_before' ? (Number(i.value) || 1) : (i.value || r[k]); });
      const wf = { ...(prefs.workflow || {}), ...w }; root.querySelectorAll('[data-wf]').forEach(i => { wf[i.dataset.wf] = i.checked; });
      return { me, prefs, rem, wf };
    };
    const save = async (slack_dm, prefs, msg = 'Saved.') => {
      const before = { slack_dm: S.me.slack_dm, prefs: S.me.prefs };
      // Getting started's settings step ticks when a setting is saved, not from opening this page (kept in their settings,
      // so it follows them to the phone, R-316 W7).
      try { await DB.saveMyPrefs({ slack_dm, prefs }); toast(msg, { ok: true }); markNewStep({ settings: 1 }); }
      catch (e) { Object.assign(S.me, before); toast(e, { err: true }); }
      const y = window.scrollY, id = document.activeElement?.id; hooks.render(); window.scrollTo(0, y); if (id) document.getElementById(id)?.focus({ preventScroll: true });
    };
    root.querySelectorAll('input[name="me-reach"]').forEach(i => i.onchange = () => {
      const { me, prefs, rem, wf } = collect(), was = current().mode, to = i.value;
      if (to === 'app') {
        // Keep the choices for this visit, so switching back restores them instead of turning everything on.
        S.st2NudgeBackup = { rem: { ...rem }, wf: { ...wf } };
        const off = { ...rem, morning_on: false, before_on: false, after_on: false };
        return save(me.slack_dm, { ...prefs, reminders: off, workflow: Object.fromEntries([...Object.keys(wf), ...MORE_KINDS].map(k => [k, false])) }, `Saved. Only ${me.is_admin || me.can_approve || me.is_reviewer ? 'approval stand-ins and ' : ''}steps passed to you will reach you.`);
      }
      let r2 = rem, w2 = wf;
      if (was === 'app') { const b = S.st2NudgeBackup; r2 = b ? b.rem : { ...rem, morning_on: true, before_on: true, after_on: true }; w2 = b ? b.wf : Object.fromEntries([...Object.keys(wf), ...MORE_KINDS].map(k => [k, true])); }
      if (was === 'app') w2 = { ...Object.fromEntries(MORE_KINDS.map(k => [k, true])), ...w2 };   // the four "Only in the app" turned off come back on
      save(to === 'slack', { ...prefs, reminders: r2, workflow: w2 }, to === 'slack' ? 'Saved. Alerts come by Slack DM.' : 'Saved. Alerts come by email.');
    });
    root.querySelectorAll('[data-rem], [data-wf], [data-remv]').forEach(i => i.onchange = () => {
      const { me, prefs, rem, wf } = collect();
      if (i.dataset.remv === 'hours_before' && !(Number(i.value) >= 0.5 && Number(i.value) <= 48)) { toast('Use a number of hours from 0.5 to 48.', { err: true }); return; }
      save(me.slack_dm !== false, { ...prefs, reminders: rem, workflow: wf });
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
    const t = root.querySelector('[data-test]');
    if (t) t.onclick = async () => { t.setAttribute('aria-busy', 'true');
      try { await DB.slackTest(); toast(DEMO ? 'Practice copy: a test DM would be on its way.' : 'Test DM on its way. Check Slack.', { ok: true }); } catch (e) { toast(e, { err: true }); }
      finally { t.removeAttribute('aria-busy'); } };
    const so = root.querySelector('[data-signout]');
    if (so) so.onclick = () => DB.logout();
  },
};
