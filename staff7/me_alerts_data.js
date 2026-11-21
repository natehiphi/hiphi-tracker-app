// My alerts' data (R-398 piece 8): the rule that turns a person's picks into what the database reads, and the calls.
// It is the same rule as staff6/me.js prefsFor, written again here because staff7 links nothing in staff6 except staff6/data.js:
//   advocates.prefs.route.<key> = a list of 'slack' and/or 'email' (an empty list is "truly none"), for the six testimony keys and
//   deadlines, hearings, chat, given, standin, admin; prefs.workflow.<kind> = a boolean kept in step with the route; slack_dm stays on
//   while Slack or deadline alerts are wanted (queue_deadline_reminders queues only for slack_dm, and the route then moves each alert
//   to the place ticked: migration 199's notifications_route); prefs.reminders = the three deadline alerts (migration 010).
// The practice copy keeps a change in memory, as DB.saveMyPrefs does. Nothing here sends anything.
import { S, DB, DEMO } from '../staff6/data.js';

// ---- what a person can have, and where it goes ----
export const PLACES = ['slack', 'email'];
export const TESTIMONY = ['review_requested', 'second_review_requested', 'draft_created', 'approved', 'changes_requested', 'filed'];
const WF_KEYS = [...TESTIMONY, 'chat'];
// the other settings the database reads: a step given to you, "put you down for the hearing", an issue made yours, a draft moved to you
const MORE_KINDS = ['todo', 'hearing', 'issue', 'draft_moved'];
export const isApprover = me => !!(me && (me.is_admin || me.can_approve));
export const leadsBills = me => !!me && (S.bills || []).some(b => b.tracked !== false && (S.assignments?.[b.id] || []).includes(me.id));
// The kinds drawn in "Choose for each kind", in order. who: a row is shown only to them (a hidden row keeps its saved value).
export const KINDS = [
  { k: 'approvals', keys: TESTIMONY, t: 'Testimony approvals', s: 'Drafts waiting for your approval, approvals, testimony sent back, testimony filed',
    none: 'Testimony waiting for your approval will sit on Home until you open the tracker.' },
  { k: 'deadlines', keys: ['deadlines'], t: 'Testimony deadlines', s: 'Bills you lead, until the testimony is filed', who: leadsBills },
  { k: 'hearings', keys: ['hearings'], t: 'Hearings on your bills', s: 'New, moved or cancelled hearings on bills you lead or follow' },
  { k: 'chat', keys: ['chat'], t: 'Questions and notes from teammates', s: 'On bills you lead, follow or wrote on' },
  { k: 'given', keys: ['given'], t: 'Handed to you', s: 'A step, hearing, issue or draft a teammate handed you' },
  { k: 'standin', keys: ['standin'], t: 'Standing in for a teammate', s: 'A step passed to you when its person cannot be reached' },
  { k: 'admin', keys: ['admin'], t: 'Admin notices', s: 'Bills close to their last chance for a hearing, public changes to approve', who: isApprover },
];
export const NONE_GENERIC = 'These will sit on Home until you open the tracker.';
export const kindsFor = me => KINDS.filter(r => !r.who || r.who(me));

// ---- the deadline alerts ----
export const REM = [['morning', 'The morning testimony is due'], ['before', 'Shortly before it is due'], ['after', 'After the deadline, if it is not filed']];
const dflt = () => (S.slackCfg || {}).reminder_defaults || {};
// The team's times, as the settings hold them (the database's own fall-backs when a setting is missing).
export function teamTimes() {
  const d = dflt();
  return { morning_on: d.morning_on !== false, morning: d.morning || '08:35', before_on: d.before_on !== false, hours_before: d.hours_before || 1, after_on: d.after_on !== false, after: d.after || '16:00' };
}
export function reminders(me) {
  const rem = (me.prefs || {}).reminders || {}, t = teamTimes(), v = (x, d) => x == null ? d : x;
  return { morning_on: v(rem.morning_on, t.morning_on), morning: v(rem.morning, t.morning), before_on: v(rem.before_on, t.before_on),
    hours_before: v(rem.hours_before, t.hours_before), after_on: v(rem.after_on, t.after_on), after: v(rem.after, t.after) };
}
export const sameAsTeam = me => { const r = reminders(me), t = teamTimes(); return Object.keys(t).every(k => String(r[k]) === String(t[k])); };
export const hhmm = t => { const m = /^(\d{1,2}):(\d{2})/.exec(t || ''); if (!m) return t || ''; const h = +m[1]; return `${h % 12 || 12}:${m[2]} ${h < 12 ? 'AM' : 'PM'}`; };
export const hoursWord = h => `${h} ${Number(h) === 1 ? 'hour' : 'hours'}`;
// The closed row's line. A part switched off drops out; all off reads "Off".
export function timesSummary(me) {
  const r = reminders(me), out = [];
  if (r.morning_on) out.push(`${hhmm(r.morning)} on the day testimony is due`);
  if (r.before_on) out.push(`${hoursWord(r.hours_before)} before`);
  if (r.after_on) out.push(`${hhmm(r.after)} if it is not filed`);
  return out.length ? out.join(' · ') : 'Off';
}
export const validHours = v => { const n = Number(v); return String(v).trim() !== '' && Number.isFinite(n) && n >= 0.5 && n <= 48; };

// ---- where each kind goes today ----
// A kind never ticked shows what the old fields imply (so nothing changes until they pick): staff6/me.js oldPlaces.
function oldPlaces(me, k) {
  const wf = (me.prefs || {}).workflow || {}, r = reminders(me), one = [me.slack_dm !== false ? 'slack' : 'email'];
  const remOn = r.morning_on || r.before_on || r.after_on;
  const quiet = !remOn && WF_KEYS.every(x => wf[x] === false);   // the old "only in the app"
  if (k === 'standin' || k === 'admin') return one;
  if (quiet) return [];
  if (k === 'deadlines') return me.slack_dm !== false && remOn ? ['slack'] : [];
  if (k === 'given') return MORE_KINDS.every(x => wf[x] === false) ? [] : one;
  return wf[k] === false ? [] : one;
}
export const places = (me, k) => { const r = ((me.prefs || {}).route || {})[k]; return Array.isArray(r) ? PLACES.filter(p => r.includes(p)) : oldPlaces(me, k); };
// every key's places, shown or not, so a save never loses a hidden row's choice
export const allRoutes = me => Object.fromEntries(KINDS.flatMap(r => r.keys).map(k => [k, places(me, k)]));
// one kind row's places: the places every one of its keys has. 'mixed' marks a row whose own keys differ (the six testimony keys can).
export function rowSig(me, row) {
  const sigs = row.keys.map(k => places(me, k).join(','));
  return sigs.every(x => x === sigs[0]) ? sigs[0] : 'mixed';
}
export const rowPlaces = (me, row) => PLACES.filter(p => row.keys.every(k => places(me, k).includes(p)));
// The one choice at the top: what every shown kind shares. null when they differ (no radio filled) or none is picked.
export function overall(me) {
  const sigs = kindsFor(me).map(r => rowSig(me, r));
  const same = sigs.every(x => x === sigs[0]);
  return { mixed: !same || sigs[0] === 'mixed', pick: same && ['slack', 'email', 'slack,email'].includes(sigs[0]) ? sigs[0] : null, none: same && sigs[0] === '' };
}
export const usedPlaces = me => PLACES.filter(p => kindsFor(me).some(r => rowPlaces(me, r).includes(p)));

// What the senders read besides the route, kept in step with it (staff6/me.js prefsFor). A kind with no place is switched off (so it is
// not even queued); deadline alerts with a place have at least one time on; slack_dm stays on while Slack or deadline alerts are wanted.
export function prefsFor(me, route) {
  const prefs = me.prefs || {}, wf = { ...(prefs.workflow || {}) };
  WF_KEYS.forEach(k => { wf[k] = route[k].length > 0; });
  MORE_KINDS.forEach(k => { wf[k] = route.given.length > 0; });
  const rem = reminders(me);
  if (route.deadlines.length && !(rem.morning_on || rem.before_on || rem.after_on)) Object.assign(rem, { morning_on: true, before_on: true, after_on: true });
  const slack_dm = Object.values(route).some(a => a.includes('slack')) || route.deadlines.length > 0;
  return { slack_dm, prefs: { ...prefs, route, workflow: wf, reminders: rem } };
}
// the route that gives every shown kind these places (a hidden kind keeps its own)
export function routeFor(me, want) {
  const route = allRoutes(me);
  kindsFor(me).forEach(r => r.keys.forEach(k => { route[k] = [...want]; }));
  return route;
}
export function routeWith(me, row, place, on) {
  const route = allRoutes(me), was = rowPlaces(me, row), want = PLACES.filter(p => p === place ? on : was.includes(p));
  row.keys.forEach(k => { route[k] = want; });
  return route;
}

// ---- the practice copy's states the tests set (nothing here is on a real person's page) ----
// teamEmail: email to the team is a separate admin switch (app_settings 'team_email'); the practice copy keeps it in S.demoTeamEmail (off, as on
// production). slackLinked: the practice people have no Slack id, so the practice copy says "linked" unless told otherwise (the drawn default).
const Q = new URLSearchParams(location.search);
const dev = { slackLinked: Q.get('slack') !== 'unlinked', fail: Q.get('fail') === 'save' ? 1e9 : 0, live: Q.get('alerts') === 'live' };
if (Q.get('teamemail') === 'on') S.demoTeamEmail = true;
export const teamEmailOn = () => DEMO ? !!S.demoTeamEmail : teamEmailCache;
let teamEmailCache = false;
export const loadTeamEmail = async () => { if (DEMO) return !!S.demoTeamEmail; try { teamEmailCache = await DB.teamEmail(); } catch { teamEmailCache = false; } return teamEmailCache; };
export const slackLinked = me => DEMO ? dev.slackLinked || !!me.slack_user_id : !!me.slack_user_id;
// "practice words": the practice copy says a test would be sent. alerts=live (or the hook) shows the words a real person would read.
export const practiceWords = () => DEMO && !dev.live;
// the test hook: window.__alerts7 (practice copy only; staff7 refuses to run without ?demo)
if (DEMO) window.__alerts7 = {
  setTeamEmail: on => { S.demoTeamEmail = !!on; },
  setSlackLinked: on => { dev.slackLinked = !!on; },
  failSaves: n => { dev.fail = n === true ? 1e9 : (n | 0); },
  liveWords: on => { dev.live = !!on; },
  state: () => JSON.parse(JSON.stringify({ slack_dm: S.me.slack_dm ?? null, prefs: S.me.prefs || {} })),
  setPrefs: (slack_dm, prefs) => { Object.assign(S.me, { slack_dm, prefs }); },
};

// ---- the calls ----
const snap = me => JSON.parse(JSON.stringify({ slack_dm: me.slack_dm ?? null, prefs: me.prefs || {} }));
const KEYS = ['route', 'workflow', 'reminders'];
// Merge into the latest prefs: whatever else sits in them (colours, seen messages, coalitions) is read again here, at the save, and kept.
async function write(slack_dm, change) {
  const keep = { slack_dm: S.me.slack_dm, prefs: S.me.prefs };   // DB.saveMyPrefs changes S.me BEFORE it writes: a refused write must put this back
  // live: read the person's own row again and merge into that, so a setting changed on another screen or device is never overwritten with a stale copy
  let base = { ...(S.me.prefs || {}) };
  if (!DEMO) {
    const { data, error } = await S.supa.from('advocates').select('prefs').eq('id', S.me.id).single();
    if (error) throw error;
    base = { ...(data?.prefs || {}) };
  }
  const prefs = base;
  for (const k of KEYS) if (k in change) { if (change[k] === undefined) delete prefs[k]; else prefs[k] = change[k]; }
  try {
    if (dev.fail > 0) { dev.fail--; Object.assign(S.me, { slack_dm, prefs }); throw new Error('Not saved'); }   // the practice copy's forced failure, after the assign as in the real call
    await DB.saveMyPrefs({ slack_dm, prefs });
  } catch (e) { Object.assign(S.me, keep); throw e; }
}
// Save a new route (the pick, or one kind's boxes). Returns what Undo needs: the three parts and slack_dm exactly as they were.
export async function saveRoute(route) {
  const me = S.me, before = snap(me), next = prefsFor(me, route);
  await write(next.slack_dm, { route: next.prefs.route, workflow: next.prefs.workflow, reminders: next.prefs.reminders });
  return before;
}
export async function saveReminders(rem) {
  const me = S.me, before = snap(me);
  await write(me.slack_dm !== false, { reminders: rem });   // as staff6's time change: slack_dm stays what it was, a person who never chose is on Slack
  return before;
}
// Undo: the three parts and slack_dm go back as they were; any other setting the person changed meanwhile stays.
export async function restore(before) {
  const change = {}; KEYS.forEach(k => { change[k] = before.prefs[k]; });
  await write(before.slack_dm, change);
}
// Undo of a time change: only the times go back (a pick made since stays).
export async function restoreReminders(before) { await write(S.me.slack_dm !== false, { reminders: before.prefs.reminders }); }
// One test to one place: 'queued', or 'held' when email to the team is off. Nothing is sent from the practice copy (DB.alertTest answers 'queued').
export async function testTo(place) {
  const r = await DB.alertTest(place);
  return place === 'email' && DEMO && !teamEmailOn() ? 'held' : r;
}
