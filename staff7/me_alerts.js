// My alerts (R-398 piece 8), #/me/alerts. One job: a person chooses where the tracker's alerts reach them (Slack, Email or Both), sends themselves
// a test, and, behind folds, sets each kind and the times of the deadline alerts. Every change saves as it is made (no Save button), says so in a
// toast with a 10-second Undo, and a failed save puts the control back and says so beside it. Nothing is sent from the practice copy.
// The data and the rule that keeps slack_dm and workflow.* in step with the route are in me_alerts_data.js.
import { S } from '../staff6/data.js';
import { ic } from './icons7.js';
import { esc, btn, plainBand, toast } from './parts.js';
import { UNDO_MS } from './done.js';
import * as D from './me_alerts_data.js';

// ---- the words ----
// The sentences below depend on what the senders really do while email to the team is off (checked against migrations 154 and 199:
// a kind routed to Email only is HELD, "not reached"; a kind routed to Both still reaches Slack). Change the words here, in one place.
export const EMAIL_OFF_BOTH = 'Email to the team is not turned on yet. Until Nate turns it on, these alerts reach you by Slack only.';
export const EMAIL_OFF_EMAIL = 'Email to the team is not turned on yet. Until Nate turns it on, email-only alerts are held and do not reach you. Pick Both to get them by Slack meanwhile.';
export const EMAIL_OFF_KIND = EMAIL_OFF_EMAIL;   // a kind row with only Email ticked
export const TEST_HELD = 'Your choice is saved. The test email was held, because email to the team is not turned on yet. Until Nate turns it on, email-only alerts do not reach you.';
export const TEST_HELD_BUTTON = 'Send a test to Slack';
const TEST_BOTH_HELD = 'The test email was held: email to the team is not turned on yet.';
const TEST_NONE = 'No place is picked, so the test goes to Slack.';
const NONE_PICKED = 'No place is picked. Alerts will sit on Home until you open the tracker.';
const LEDE = 'Choose where the tracker’s alerts reach you, then send yourself a test. Every step also stays on Home.';
const MIXED = 'Different for each kind, set below. Picking Slack, Email or Both sets every kind to it.';
const ERR_TEST = 'The test could not be queued. Try again. If it fails twice, message Nate.';
const ERR_KIND = 'Not saved, so that kind still goes where it did. Try again. If it fails twice, message Nate.';
const ERR_TIMES = 'Not saved, so your deadline times are as they were. Try again. If it fails twice, message Nate.';
const ERR_HOURS = 'Use a number of hours from 0.5 to 48.';
const NO_DEADLINES = 'No deadline alerts. Testimony due on your bills will show on Home only.';
const NAME = { slack: 'Slack', email: 'email', 'slack,email': 'Slack and email' };
const nameOf = ps => NAME[ps.join(',')] || '';

// ---- what the page remembers while it is open (not what a person saved: that is in S.me.prefs) ----
const fresh = () => ({ kinds: null, times: false, test: null, err: '', timesErr: '', typedHours: null, hoursBad: false });
let ui = fresh(), left = true;
addEventListener('hashchange', () => { if (!location.hash.split('?')[0].startsWith('#/me/alerts')) left = true; });

// ---- drawing ----
const chev = '<span class="alchev" aria-hidden="true">' + ic('chevron-down') + '</span>';
const note = (icon, words, cls = '') => `<p class="alline${cls ? ' ' + cls : ''}">${ic(icon)}<span>${esc(words)}</span></p>`;

function radiosHTML(me, o, teamEmail) {
  const row = (val, label, words) => `<label class="alrad"><input type="radio" name="alWhere" id="alR-${val.replace(',', '-')}" value="${val}"${o.pick === val ? ' checked' : ''}${words ? ` aria-describedby="alRn-${val.replace(',', '-')}"` : ''}><span class="alrb"><span class="alrt">${label}</span>${words ? `<span class="alrn" id="alRn-${val.replace(',', '-')}">${esc(words)}</span>` : ''}</span></label>`;
  return `<div class="alrads" role="radiogroup" aria-labelledby="alWhereH">${row('slack', 'Slack')}${row('email', 'Email', teamEmail ? '' : EMAIL_OFF_EMAIL)}${row('slack,email', 'Both', teamEmail ? '' : EMAIL_OFF_BOTH)}</div>`;
}
const stillWord = (o) => o.pick ? `to ${nameOf(o.pick.split(','))}` : 'where they went before';
function statusHTML(me, o) {
  if (ui.err === 'pick') return `<p class="alline err" role="alert">${ic('circle-alert')}<span>${esc(`Not saved, so alerts still go ${stillWord(o)}. Pick again. If it fails twice, message Nate.`)}</span></p>`;
  if (ui.err === 'kind') return `<p class="alline err" role="alert">${ic('circle-alert')}<span>${esc(ERR_KIND)}</span></p>`;
  if (o.mixed) return note('info', MIXED);
  if (o.none) return note('info', NONE_PICKED);
  return '';
}
const reachHTML = me => `<p class="alreach">${esc(D.slackLinked(me)
  ? `Slack: your account is linked. Email goes to ${me.email || 'your address'}.`
  : `Slack: the tracker finds you by your email the first time it messages you. Send a test to check. Email goes to ${me.email || 'your address'}.`)}</p>`;

// the test's words for what happened to each place it went to
function testWords(t) {
  const r = t.res, slack = r.slack, email = r.email, has = p => p in r;
  const prefix = t.none ? TEST_NONE + ' ' : '';
  if (has('email') && !has('slack') && email === 'held') return { icon: 'info', text: prefix + TEST_HELD, again: TEST_HELD_BUTTON, slackOnly: true };
  const ok = ['slack', 'email'].filter(p => r[p] === 'queued'), held = has('email') && email === 'held', to = nameOf(ok);
  if (t.practice) return { icon: 'info', text: `${prefix}Practice copy: a test would be on its way to ${to}.${held ? ' ' + TEST_BOTH_HELD : ''} Nothing is sent.`, again: 'Send another' };
  if (held) return { icon: 'info', text: `${prefix}Test on its way to ${to}. ${TEST_BOTH_HELD}`, again: 'Send another' };
  return { icon: 'circle-check', text: `${prefix}Test on its way to ${to}. It comes from HIPHI Bill Tracker. If it has not arrived in a minute, message Nate in Slack.`, again: 'Send another' };
}
function testHTML() {
  const t = ui.test;
  if (!t || t.busy && !t.res) return btn('Send me a test message', { kind: 'filled', icon: 'send', id: 'alTest', loading: !!t?.busy });
  if (t.fail) return `<div class="albox err" id="alBox">${ic('circle-alert')}<div><p>${esc(ERR_TEST)}</p>${btn('Send another', { kind: 'text', id: 'alAgain' })}</div></div>`;
  const w = testWords(t);
  return `<div class="albox${w.icon === 'circle-check' ? ' ok' : ''}" id="alBox">${ic(w.icon)}<div><p>${esc(w.text)}</p>${btn(w.again, { kind: 'text', id: 'alAgain', loading: !!t.busy })}</div></div>`;
}

function kindsHTML(me, o, teamEmail, open) {
  const rows = D.kindsFor(me).map(r => {
    const on = D.rowPlaces(me, r), sig = D.rowSig(me, r);
    const line = !on.length && sig !== 'mixed' ? note('info', r.none || D.NONE_GENERIC, 'muted') : (!teamEmail && on.length === 1 && on[0] === 'email' ? note('info', EMAIL_OFF_KIND, 'muted') : '');
    const cell = p => `<td><label class="alck"><input type="checkbox" id="alC-${r.k}-${p}" data-k="${r.k}" data-p="${p}"${on.includes(p) ? ' checked' : ''} aria-label="${esc(r.t)}: ${p === 'slack' ? 'Slack' : 'Email'}"><span class="alcb" aria-hidden="true">${ic('check')}</span></label></td>`;
    return `<tr><th scope="row"><span class="alkn">${esc(r.t)}</span><span class="alks">${esc(r.s)}</span>${line}</th>${cell('slack')}${cell('email')}</tr>`;
  }).join('');
  return `<section class="alfold"><h2 class="alfh"><button class="alfb" type="button" id="alKindsB" aria-expanded="${open}" aria-controls="alKinds"><span class="alft">Choose for each kind</span>${chev}</button></h2>
    <div class="alfbody" id="alKinds"${open ? '' : ' hidden'}><table class="alt"><caption class="sr">Where each kind of alert goes</caption><thead><tr><th scope="col"><span class="sr">Kind of alert</span></th><th scope="col">Slack</th><th scope="col">Email</th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
}

function timesHTML(me, open) {
  const r = D.reminders(me), allOff = !(r.morning_on || r.before_on || r.after_on);
  const hours = ui.typedHours != null ? ui.typedHours : r.hours_before;
  const sw = (k, label, on) => `<button class="alsw" type="button" role="switch" id="alS-${k}" data-rem="${k}" aria-checked="${on}" aria-labelledby="alRL-${k}"><span class="alswt" aria-hidden="true"><span class="alswk"></span></span></button>`;
  const lab = (k, label) => `<span class="alremlab" id="alRL-${k}">${esc(label)}</span>`;
  const time = (k, id, v, on) => `<input class="alin" type="time" id="${id}" data-remv="${k}" value="${esc(v)}" aria-labelledby="alRL-${k}"${on ? '' : ' disabled'}>`;
  const list = D.REM.map(([k, label]) => {
    const on = r[k + '_on'];
    const field = k === 'before'
      ? `<input class="alin alin-n${ui.hoursBad ? ' bad' : ''}" type="number" id="alHours" data-remv="hours_before" min="0.5" max="48" step="0.5" inputmode="decimal" value="${esc(hours)}" aria-labelledby="alRL-before"${ui.hoursBad ? ' aria-invalid="true" aria-describedby="alHoursErr"' : ''}${on ? '' : ' disabled'}><span class="alunit">${Number(hours) === 1 ? 'hour' : 'hours'} before</span>`
      : time(k, k === 'morning' ? 'alMorning' : 'alAfter', r[k], on);
    return `<li class="alremrow${k === 'before' ? ' wide' : ''}">${sw(k, label, on)}${lab(k, label)}<span class="alremf">${field}</span>${k === 'before' && ui.hoursBad ? `<p class="alline err alremerr" id="alHoursErr">${ic('circle-alert')}<span>${esc(ERR_HOURS)}</span></p>` : ''}</li>`;
  }).join('');
  return `<section class="alfold"><h2 class="alfh"><button class="alfb two" type="button" id="alTimesB" aria-expanded="${open}" aria-controls="alTimes"><span class="alfx"><span class="alft">When deadline alerts arrive</span>${open ? '' : `<span class="alsum">${esc(D.timesSummary(me))}</span>`}</span>${chev}</button></h2>
    <div class="alfbody" id="alTimes"${open ? '' : ' hidden'}><p class="alhint">For bills you lead. Saves as soon as you change it. Other alerts arrive when the thing happens.</p><ul class="alrem" role="list">${list}</ul>
      ${ui.timesErr ? `<p class="alline err" role="alert">${ic('circle-alert')}<span>${esc(ERR_TIMES)}</span></p>` : ''}
      ${D.sameAsTeam(me) ? '' : `<p class="alteam">${btn('Use the team’s times', { kind: 'text', id: 'alTeam' })}</p>`}
      ${allOff ? note('info', NO_DEADLINES, 'muted') : ''}</div></section>`;
}

function bodyHTML() {
  const me = S.me, o = D.overall(me), teamEmail = D.teamEmailOn(), leads = D.leadsBills(me);
  if (ui.kinds === null && o.mixed) ui.kinds = true;   // the kinds differ: the fold opens by itself, and stays open
  const ch = esc((S.slackCfg || {}).main_channel || '#hearing-alerts');
  return `<section class="alsec" aria-labelledby="alWhereH"><h2 class="alh" id="alWhereH">Where should alerts reach you?</h2><p class="alhint">Saves as soon as you pick.</p>
      ${radiosHTML(me, o, teamEmail)}${statusHTML(me, o)}${reachHTML(me)}<div class="altest" id="alTestSlot">${testHTML()}</div><div class="sr" role="status" id="alLive"></div></section>
    ${kindsHTML(me, o, teamEmail, !!ui.kinds)}
    ${leads ? timesHTML(me, ui.times) : ''}
    <section class="alteamline"><h2 class="alh sm">The same for the whole team</h2><p>Whatever you pick, the morning list of hearings goes to ${ch} in Slack for everyone.</p></section>`;
}

// ---- doing ----
function draw(focusId) {
  const root = document.getElementById('alRoot'); if (!root) return;
  const body = root.querySelector('.al-body'), paper = root.closest('.paper'), y = paper ? paper.scrollTop : 0;
  const had = focusId || document.activeElement?.id;
  body.innerHTML = bodyHTML();
  if (paper) paper.scrollTop = y;
  const live = document.getElementById('alLive'), box = document.querySelector('#alBox p'); if (live && ui.announce && box) { live.textContent = box.textContent; ui.announce = false; }
  const again = had && document.getElementById(had); if (again && !again.disabled) again.focus({ preventScroll: true });
}
// Save, say so with a 10-second Undo, or put the control back and say so beside it. fn saves and returns what Undo needs.
async function commit(fn, msg, errKind, undo) {
  try { const before = await fn(); ui.err = ''; ui.timesErr = ''; ui.test = null; draw(); toast(msg, { undo: () => undo(before), ms: UNDO_MS }); }
  catch { if (errKind === 'times') ui.timesErr = true; else ui.err = errKind; draw(); }
}
function undoer(restore) { return async before => { try { await restore(before); } catch { /* the control shows what is saved */ } ui.err = ''; ui.timesErr = ''; ui.test = null; draw(); toast('Undone.', { ms: 4000 }); }; }
const undoPick = undoer(D.restore), undoTimes = undoer(D.restoreReminders);

function pick(val) {
  const me = S.me, was = D.overall(me), want = val.split(',');
  commit(() => D.saveRoute(D.routeFor(me, want)), was.mixed ? `Saved. Every kind now goes to ${nameOf(want)}.` : `Saved. Alerts reach you by ${nameOf(want)}.`, 'pick', undoPick);
}
function tickKind(k, p, on) {
  const me = S.me, row = D.KINDS.find(r => r.k === k), route = D.routeWith(me, row, p, on), want = D.PLACES.filter(x => route[row.keys[0]].includes(x));
  commit(() => D.saveRoute(route), `Saved. ${row.t}: ${want.length ? 'by ' + nameOf(want) : 'on Home only'}.`, 'kind', undoPick);
}
const remMsg = {
  morning: (r, on) => on ? `Saved. Morning alert on at ${D.hhmm(r.morning)}.` : 'Saved. Morning alert off.',
  before: (r, on) => on ? `Saved. Alert ${D.hoursWord(r.hours_before)} before it is due is on.` : 'Saved. Alert shortly before it is due is off.',
  after: (r, on) => on ? `Saved. Alert at ${D.hhmm(r.after)} if it is not filed is on.` : 'Saved. Alert after the deadline is off.',
};
function saveRem(change, msg) {
  const me = S.me, rem = { ...D.reminders(me), ...change };
  commit(() => D.saveReminders(rem), typeof msg === 'function' ? msg(rem) : msg, 'times', undoTimes);
}
async function runTest(only) {
  const me = S.me; let ps = only || D.usedPlaces(me); const none = !ps.length; if (none) ps = ['slack'];
  const keep = ui.test && ui.test.res ? ui.test : null;
  ui.test = { ...(keep || {}), busy: true }; draw(keep ? 'alAgain' : 'alTest');
  const res = {};
  try { for (const p of ps) res[p] = await D.testTo(p); } catch { ui.test = { fail: true }; draw('alAgain'); return; }
  ui.test = { res, none, practice: D.practiceWords() }; ui.announce = true; draw('alAgain');
}

function bind(root) {
  root.addEventListener('change', e => {
    const t = e.target;
    if (t.matches('input[name="alWhere"]')) pick(t.value);
    else if (t.matches('input[data-k]')) tickKind(t.dataset.k, t.dataset.p, t.checked);
    else if (t.matches('input[data-remv]')) {
      const k = t.dataset.remv;
      if (k === 'hours_before') {
        if (!D.validHours(t.value)) { ui.typedHours = t.value; ui.hoursBad = true; draw(t.id); return; }   // the typed words stay in the field, with the reason beside it
        ui.typedHours = null; ui.hoursBad = false; saveRem({ hours_before: Number(t.value) }, r => `Saved. Alert ${D.hoursWord(r.hours_before)} before it is due.`);
      } else if (!t.value) draw(t.id);   // a cleared time goes back to the saved one
      else saveRem({ [k]: t.value }, r => k === 'morning' ? `Saved. Morning alert at ${D.hhmm(r.morning)}.` : `Saved. Alert at ${D.hhmm(r.after)} if it is not filed.`);
    }
  });
  root.addEventListener('input', e => {
    const t = e.target;
    if (t.id === 'alHours' && ui.hoursBad && D.validHours(t.value)) { ui.hoursBad = false; ui.typedHours = t.value; t.classList.remove('bad'); t.removeAttribute('aria-invalid'); document.getElementById('alHoursErr')?.remove(); }
  });
  root.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || !root.contains(b)) return;
    if (b.id === 'alTest' || b.id === 'alAgain') { if (b.getAttribute('aria-busy') === 'true') return; runTest(b.id === 'alAgain' && ui.test?.res && testWords(ui.test).slackOnly ? ['slack'] : undefined); }
    else if (b.id === 'alKindsB') { ui.kinds = b.getAttribute('aria-expanded') !== 'true'; draw(b.id); }
    else if (b.id === 'alTimesB') { ui.times = b.getAttribute('aria-expanded') !== 'true'; draw(b.id); }
    else if (b.dataset.rem) {
      const k = b.dataset.rem, on = b.getAttribute('aria-checked') !== 'true';
      saveRem({ [k + '_on']: on }, r => remMsg[k](r, on));
    } else if (b.id === 'alTeam') saveRem(D.teamTimes(), 'Saved. Deadline alerts use the team’s times.');
  });
}

// the page: the frame draws .html into the sheet and calls .bind() once it is on the screen
export function alertsPage(me) {
  if (left) { ui = fresh(); left = false; }
  lastTeam = D.teamEmailOn();
  D.loadTeamEmail().then(on => { if (on !== lastTeam) { lastTeam = on; draw(); } });
  const html = `<div class="pn al" id="alRoot">${plainBand('My alerts', LEDE)}<div class="pbody al-body">${bodyHTML()}</div></div>`;
  return { html, bind: () => { const root = document.getElementById('alRoot'); root && bind(root); } };
}
let lastTeam = null;
