// HIPHI Staff v2: My settings (#/me, plan 3.11). One short page that saves as you change it, with no Save button.
// Same data as app.js renderSettings/wireSettings: advocates.slack_dm (Slack DM or email) and advocates.prefs
// ({ reminders, workflow }), written with DB.saveMyPrefs, plus DB.slackTest. "Only in the app" is not a new setting:
// it is every nudge switched off, which is exactly what the database reads as "send nothing" (the Inbox in Today
// never depends on these), so it works the same whichever app wrote it.
// R-022 (decision 7): "Coalitions I support" - support staff help with whole coalitions rather than owning bills (Kris
// supports every one, Saya CTFH). Saved as advocates.prefs.coalitions ('all' or a list of campaign ids) with
// DB.patchPrefs, so it follows the person; Bills then offers "My coalitions" beside Mine and Everyone.
import { S, DB, DEMO, APP_URL, esc, hooks } from './data.js';
import { WORKFLOW_KINDS } from './model.js';
import { icon, btn, switchRow, field, toast, keysOn, setKeys } from './ui.js';

// Plain, verb-free labels for what each nudge is about (app.js WORKFLOW_KINDS keys, same order).
const WF_LABEL = { chat: ['Messages on bills I own, follow or joined', ''], draft_created: ['A new testimony draft for one of my bills', ''],
  review_requested: ['Testimony waiting for my approval', 'Admins approve first'], second_review_requested: ['A first testimony that needs my second approval', 'Reviewers give the second approval'],
  approved: ['My testimony was approved', ''], changes_requested: ['A reviewer asked me for changes', ''], filed: ['Someone filed testimony on my bill', ''] };
const REM = [['morning', 'The morning testimony is due'], ['before', 'Shortly before it is due'], ['after', 'After the deadline, if it is not filed']];
const FR_KEY = DEMO ? 'hiphi2_firstrun_demo' : 'hiphi2_firstrun';
const hhmm = t => { const m = /^(\d{1,2}):(\d{2})/.exec(t || ''); if (!m) return t || ''; const h = +m[1]; return `${h % 12 || 12}:${m[2]} ${h < 12 ? 'AM' : 'PM'}`; };

// Which workflow switches apply to me: approvals only reach admins, second approvals only reviewers. Hidden ones keep
// whatever value they had.
const kindsFor = me => WORKFLOW_KINDS.map(([k]) => k).filter(k => (k !== 'review_requested' || me.is_admin) && (k !== 'second_review_requested' || me.is_reviewer));
function current() {
  const me = S.me || {}, prefs = me.prefs || {}, rem = prefs.reminders || {}, wf = prefs.workflow || {}, dflt = (S.slackCfg || {}).reminder_defaults || {};
  const v = (x, d) => x == null ? d : x;
  const r = { morning_on: v(rem.morning_on, dflt.morning_on !== false), morning: v(rem.morning, dflt.morning || '08:35'), before_on: v(rem.before_on, dflt.before_on !== false),
    hours_before: v(rem.hours_before, dflt.hours_before || 1), after_on: v(rem.after_on, dflt.after_on !== false), after: v(rem.after, dflt.after || '16:00') };
  const w = Object.fromEntries(WORKFLOW_KINDS.map(([k]) => [k, wf[k] !== false]));
  const quiet = !r.morning_on && !r.before_on && !r.after_on && Object.values(w).every(x => !x);
  return { me, prefs, r, w, mode: quiet ? 'app' : me.slack_dm !== false ? 'slack' : 'email' };
}

// ---- Coalitions I support ----
// A tick box per coalition, named as the public knows it with the team's own name under it where they differ (two are
// "General Public Health" to the public). "All coalitions" also covers any added later, so it hides the list rather
// than ticking ten boxes that would then have to be unticked one by one.
function coalSection() {
  const c = S.me?.prefs?.coalitions, all = c === 'all', on = new Set(Array.isArray(c) ? c : []);
  const camps = S.campaigns.slice().sort((a, b) => (a.public_name || a.name).localeCompare(b.public_name || b.name) || a.name.localeCompare(b.name));
  const same = t => String(t || '').toLowerCase().replace(/[^a-z]/g, '');   // "Climate & Health" is "Climate Health": no second line
  const box = (id, title, sub, checked, attr) => `<label class="st-cbox" for="${id}"><input type="checkbox" id="${id}" ${checked ? 'checked' : ''} ${attr}><span class="st-cmark" aria-hidden="true">${icon('check')}</span><span class="body"><span class="title">${esc(title)}</span>${sub ? `<span class="sub">${esc(sub)}</span>` : ''}</span></label>`;
  return `<section class="st-sec" aria-labelledby="st-coals">
    <h2 id="st-coals">Coalitions I support</h2>
    <p class="small muted st-note st-top">For helping with a coalition’s bills without owning them: Today shows their week, and Bills lists them under <b>My coalitions</b>.</p>
    <div class="card st-coalpick">
      ${box('st-coal-all', 'All coalitions', 'Every coalition, and any added later', all, 'data-coalall')}
      ${all ? '' : `<div class="st-cgrid" role="group" aria-label="Coalitions">${camps.map(x => box('st-coal-' + x.id, x.public_name || x.name, x.public_name && same(x.public_name) !== same(x.name) ? x.name : '', on.has(x.id), `data-coal="${esc(x.id)}"`)).join('')}</div>`}
    </div>
  </section>`;
}

export default {
  tab: '', narrow: true,   // a form: a reading column on a wide screen
  title: () => 'My settings',
  render() {
    const { me, r, w, mode } = current(), paused = (S.emailCfg || {}).enabled === false, toEmail = (S.slackCfg || {}).workflow_dm === false;
    const slackState = DEMO ? 'Sandbox' : me.slack_user_id ? 'Your Slack account is linked' : 'Linked by email the first time the tracker messages you';
    const opt = (val, title, sub) => `<label class="st-opt"><input type="radio" name="st-nudge" value="${val}" ${mode === val ? 'checked' : ''}><span class="st-dot" aria-hidden="true"></span><span class="body"><span class="title">${title}</span><span class="sub">${sub}</span></span></label>`;
    const remTimes = { morning: `At ${hhmm(r.morning)}`, before: `${r.hours_before} hour${Number(r.hours_before) === 1 ? '' : 's'} before`, after: `At ${hhmm(r.after)}` };
    return `<div class="st-page st-me">
      <div class="st-head"><h1 class="st-dup">My settings</h1></div>
      <section class="st-sec" aria-labelledby="st-reach">
        <h2 id="st-reach">How the tracker reaches you</h2>
        <p class="st-always">${icon('list-todo')}<span>The Inbox in Today is always on. Everything that needs you is listed there, whatever you pick below.</span></p>
        <fieldset class="st-fs"><legend class="st-legend">Nudges come by</legend>
          <div class="card st-opts">
            ${opt('slack', 'Slack DM', esc(slackState) + (toEmail ? '. An admin has sent testimony steps to email for everyone.' : ''))}
            ${opt('email', 'Email', `To ${esc(me.email || 'your address')}. Testimony steps only; deadline reminders come only by Slack.${paused ? ' <b>Email is paused by an admin, so these are held.</b>' : ''}`)}
            ${opt('app', 'Only in the app', 'No nudges. Today still lists everything.')}
          </div></fieldset>
      </section>
      ${mode === 'app' ? '' : `<section class="st-sec" aria-labelledby="st-about">
        <h2 id="st-about">Nudge me about</h2>
        ${mode === 'slack' ? `<h3 class="st-h3">Testimony deadlines</h3><p class="small muted st-note">Only for bills you own, until the testimony is marked filed.</p>
        <div class="card st-list">${REM.map(([k, l]) => switchRow('st-rem-' + k, l, r[k + '_on'], remTimes[k], { 'data-rem': k })).join('')}</div>`
        : `<p class="small muted st-note">${icon('info')} Deadline reminders come only by Slack DM. Pick Slack DM to get them.</p>`}
        <h3 class="st-h3">Testimony and messages</h3>
        <div class="card st-list">${kindsFor(me).map(k => switchRow('st-wf-' + k, WF_LABEL[k][0], w[k], WF_LABEL[k][1], { 'data-wf': k })).join('')}</div>
      </section>
      ${mode === 'slack' && (r.morning_on || r.before_on || r.after_on) ? `<section class="st-sec" aria-labelledby="st-times">
        <h2 id="st-times">Reminder times</h2>
        <div class="card st-grid st-times">${r.morning_on ? field('st-mont', 'Morning reminder', `<input id="st-mont" type="time" value="${esc(r.morning)}" data-remv="morning">`) : ''}
          ${r.before_on ? field('st-befh', 'Hours before', `<input id="st-befh" type="number" min="0.5" max="48" step="0.5" inputmode="decimal" value="${esc(r.hours_before)}" data-remv="hours_before">`) : ''}
          ${r.after_on ? field('st-aftt', 'Missed-deadline reminder', `<input id="st-aftt" type="time" value="${esc(r.after)}" data-remv="after">`) : ''}</div>
      </section>` : ''}`}
      ${coalSection()}
      <section class="st-sec st-keysec" aria-labelledby="st-keys">
        <h2 id="st-keys">Keyboard shortcuts</h2>
        <div class="card st-list">${switchRow('st-keyson', 'Use keyboard shortcuts', keysOn(), 'For a laptop or desktop. Off means a stray letter never does anything. Approving always takes Shift+A.', { 'data-keys': '1' })}</div>
        <p class="small muted"><a href="#/help/keys">See the shortcuts</a>. This setting is kept on this device.</p>
      </section>
      <section class="st-sec" aria-labelledby="st-test">
        <h2 id="st-test" class="sr">Test and account</h2>
        <div class="btnrow st-acts">${btn('Send me a test DM', { kind: 'secondary', icon: 'send', attrs: { 'data-test': '1' } })}</div>
        <div class="rows st-acct">
          <a class="row" href="${esc(APP_URL + (DEMO ? '?demo=1' : ''))}"><span class="lead">${icon('external-link')}</span><span class="body"><span class="title">Open the current app</span><span class="sub">The look you know, with the same data</span></span></a>
          <button type="button" class="row" data-signout><span class="lead">${icon('log-out')}</span><span class="body"><span class="title">Sign out</span>${DEMO ? '<span class="sub">In the sandbox this starts it over</span>' : ''}</span></button>
        </div>
      </section>
    </div>`;
  },
  wire(route, root) {
    try { const o = JSON.parse(localStorage.getItem(FR_KEY) || '{}'); if (!o.settings) localStorage.setItem(FR_KEY, JSON.stringify({ ...o, settings: 1 })); } catch { /* private mode */ }
    // Read every visible control plus the hidden values, and save the whole prefs object (as app.js does).
    const collect = () => {
      const { me, prefs, r, w } = current();
      const rem = { ...r }; root.querySelectorAll('[data-rem]').forEach(i => { rem[i.dataset.rem + '_on'] = i.checked; });
      root.querySelectorAll('[data-remv]').forEach(i => { const k = i.dataset.remv; rem[k] = k === 'hours_before' ? (Number(i.value) || 1) : (i.value || r[k]); });
      const wf = { ...w }; root.querySelectorAll('[data-wf]').forEach(i => { wf[i.dataset.wf] = i.checked; });
      return { me, prefs, rem, wf };
    };
    const save = async (slack_dm, prefs, msg = 'Saved.') => {
      const before = { slack_dm: S.me.slack_dm, prefs: S.me.prefs };
      try { await DB.saveMyPrefs({ slack_dm, prefs }); toast(msg, { ok: true }); }
      catch (e) { Object.assign(S.me, before); toast(e, { err: true }); }
      const y = window.scrollY, id = document.activeElement?.id; hooks.render(); window.scrollTo(0, y); if (id) document.getElementById(id)?.focus({ preventScroll: true });
    };
    root.querySelectorAll('input[name="st-nudge"]').forEach(i => i.onchange = () => {
      const { me, prefs, rem, wf } = collect(), was = current().mode, to = i.value;
      if (to === 'app') {
        // Keep the choices for this visit, so switching back restores them instead of turning everything on.
        S.st2NudgeBackup = { rem: { ...rem }, wf: { ...wf } };
        const off = { ...rem, morning_on: false, before_on: false, after_on: false };
        return save(me.slack_dm, { ...prefs, reminders: off, workflow: Object.fromEntries(Object.keys(wf).map(k => [k, false])) }, 'Saved. Nothing will nudge you.');
      }
      let r2 = rem, w2 = wf;
      if (was === 'app') { const b = S.st2NudgeBackup; r2 = b ? b.rem : { ...rem, morning_on: true, before_on: true, after_on: true }; w2 = b ? b.wf : Object.fromEntries(Object.keys(wf).map(k => [k, true])); }
      save(to === 'slack', { ...prefs, reminders: r2, workflow: w2 }, to === 'slack' ? 'Saved. Nudges come by Slack DM.' : 'Saved. Nudges come by email.');
    });
    root.querySelectorAll('[data-rem], [data-wf], [data-remv]').forEach(i => i.onchange = () => {
      const { me, prefs, rem, wf } = collect();
      if (i.dataset.remv === 'hours_before' && !(Number(i.value) >= 0.5 && Number(i.value) <= 48)) { toast('Use a number of hours from 0.5 to 48.', { err: true }); return; }
      save(me.slack_dm !== false, { ...prefs, reminders: rem, workflow: wf });
    });
    // Coalitions I support: each tick saves at once (as everything on this page does), and says what changed.
    const coals = async (value, msg, focusId) => {
      try { await DB.patchPrefs({ coalitions: value }); toast(msg, { ok: true }); }
      catch (e) { toast(e, { err: true }); }
      const y = window.scrollY; hooks.render(); window.scrollTo(0, y); document.getElementById(focusId)?.focus({ preventScroll: true });
    };
    const all = root.querySelector('[data-coalall]');
    if (all) all.onchange = () => coals(all.checked ? 'all' : [], all.checked ? 'Saved. You support every coalition.' : 'Saved. Pick the coalitions you support.', 'st-coal-all');
    root.querySelectorAll('[data-coal]').forEach(el => el.onchange = () => {
      const ids = [...root.querySelectorAll('[data-coal]')].filter(x => x.checked).map(x => x.dataset.coal);
      const c = S.campaigns.find(x => x.id === el.dataset.coal), name = c ? c.public_name || c.name : 'that coalition';
      coals(ids, `Saved. ${el.checked ? `You support ${name}.` : `You no longer support ${name}.`}`, el.id);
    });
    const ks = root.querySelector('[data-keys]');
    if (ks) ks.onchange = () => { setKeys(ks.checked); toast(ks.checked ? 'Keyboard shortcuts are on.' : 'Keyboard shortcuts are off.', { ok: true }); };
    const t = root.querySelector('[data-test]');
    if (t) t.onclick = async () => { t.setAttribute('aria-busy', 'true');
      try { await DB.slackTest(); toast(DEMO ? 'Sandbox: a test DM would be on its way.' : 'Test DM on its way. Check Slack.', { ok: true }); } catch (e) { toast(e, { err: true }); }
      finally { t.removeAttribute('aria-busy'); } };
    const so = root.querySelector('[data-signout]');
    if (so) so.onclick = () => DB.logout();
  },
};
