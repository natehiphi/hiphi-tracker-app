// Staff7 steps: the testimony and hearing steps a person has, taken from the current app's own list (staff6/today.js work(me).own) so the two can never disagree. No DOM is drawn here.
import { S, advocate, SESSION_YEAR, POSITIONS } from '../staff6/data.js';
import { cmteName, roomName, lateLine, approverWords, diedish, draftHearing } from '../staff6/model.js';
import { work, t6Fresh } from '../staff6/today.js';
import { billStep, shownStatus } from '../staff6/steps.js';
import { fullName, numWords } from '../staff6/steps.js';
import { myIssueIds } from '../staff6/data.js';
import { placeSteps } from './do_place.js';   // R-398 piece 9 gap E: Set position and issue (a cycle that is only used in functions)
import { checkSteps } from './do_check.js';   // R-398 piece 9 gap B: Check your testimony (a cycle that is only used in functions)
import { adminFirst } from './issue_new.js';   // R-398 piece 10: the admin who publishes, by first name (a cycle, used only inside functions)
import { missingOf, isDraft, billRows } from './issue_draft.js';   // R-398 piece 10: what a draft is missing (a cycle with issue_draft.js that is only used in functions)
import { pointsOf } from './issue_edit.js';
import { chairSteps } from './ask_data.js';   // R-398 piece 5: Follow up with the chair, Decide what next (a cycle with ask_data.js that is only used in functions)

const HST = { timeZone: 'Pacific/Honolulu' };
const HOUR = 36e5, DAY = 864e5;

// ---- the words for times: "Wed 2:00 PM" (with the date, "Wed, Mar 25 9:00 AM", when more than 6 days away) and a countdown rounded DOWN at every edge ----
export function dayTime(t) {
  const d = new Date(t), clock = d.toLocaleTimeString('en-US', { ...HST, hour: 'numeric', minute: '2-digit' });
  const day = d.toLocaleDateString('en-US', { ...HST, weekday: 'short' });
  if (Math.abs(d.getTime() - Date.now()) > 6 * DAY) return `${day}, ${d.toLocaleDateString('en-US', { ...HST, month: 'short', day: 'numeric' })}, ${clock}`;
  return `${day} ${clock}`;
}
// model.js spanOf rounds hours to the NEAREST hour; the design says rounded down (a day early is safe, R-022), so this is its own.
export function left(t) {
  const ms = Math.abs(new Date(t).getTime() - Date.now());
  if (ms < 6e4) return 'under a minute';
  const h = ms / HOUR;
  const n = h < 1 ? Math.floor(ms / 6e4) : h < 48 ? Math.floor(h) : Math.floor(h / 24);
  const unit = h < 1 ? 'min' : h < 48 ? (n === 1 ? 'hour' : 'hours') : (n === 1 ? 'day' : 'days');
  return `${n} ${unit}`;
}
export const isLate = t => new Date(t).getTime() <= Date.now();
export const soonSoon = t => t != null && new Date(t).getTime() - Date.now() < DAY;   // amber only under 24 hours, or past it

// ---- names lead, numbers follow ----
const eCig = s => String(s || '').replace(/\bvap(?:e|es|ing)\b/gi, m => /^vap(es|ing)$/i.test(m) ? 'e-cigarettes' : 'e-cigarette');   // CLAUDE.md R-158; the Legislature's own titles stay as written
export const billName = b => eCig(fullName(b));
export const billNo = b => numWords(b);
export const first = a => String(a?.full_name || '').split(' ')[0] || 'Someone';
// HIPHI's position in the data layer's own words ("Support w/ amendments"), never collapsed
export const posWords = b => (POSITIONS.find(p => p[0] === b.position) || [])[1] || 'No position yet';

// ---- one issue per step: the person's own if the bill is on one, else the bill's first; its colour is its category's ----
export function issueOf(b) {
  const mine = myIssueIds(), ids = (S.billIssues || []).filter(x => x.bill_id === b.id).map(x => x.issue_id);
  const id = ids.find(i => mine.has(String(i))) ?? ids[0], i = (S.issues || []).find(x => x.id === id);
  const cat = i && /^[a-z-]+$/.test(i.category || '') ? i.category : 'other';
  return i ? { id: i.id, name: i.name, icon: i.icon || (S.categories || []).find(c => c.key === i.category)?.icon || 'circle', cat } : { id: null, name: 'Testimony', icon: 'file-text', cat: 'other' };
}

// ---- who approves a letter this person sends: the current app's own words (model.js approverWords: an admin sender is "you", a stand-in who can approve right now is named) ----
// { main: "you or Kris", stand: "Jess can stand in from Wed 3:00 PM" | "" }
export function approverLine(d, h, me) {
  const w = approverWords(d, h, me?.id), i = w.indexOf('; ');
  return i < 0 ? { main: w, stand: '' } : { main: w.slice(0, i), stand: w.slice(i + 2) };
}
export const orNames = as => as.length ? as.map(first).join(' or ') : 'An admin';

export const VERB = { write: 'Write testimony', resubmit: 'Resubmit testimony', approve: 'Approve testimony', second: 'Second look', file: 'File testimony', ask: 'Ask for a hearing', chairfu: 'Follow up with the chair', decide: 'Decide what next', missed: 'Did we file?', stale: 'Check testimony', check: 'Check your testimony', finish: 'Finish a new issue', publish: 'Publish a new issue' };
export const LABEL = { write: 'Send for approval', resubmit: 'Resubmit', approve: 'Approve', second: 'Second look', file: 'File', stale: 'Check it', missed: 'Did we file?' };
export const BUILT = new Set(['write', 'resubmit', 'approve', 'second', 'file', 'ask', 'chairfu', 'decide', 'missed', 'check', 'place', 'finish', 'publish']);   // the kinds that have a page of their own in this piece
const KIND = { nodraft: 'write', write: 'write', submit: 'write', revise: 'resubmit', approve: 'approve', second: 'second', file: 'file', missed: 'missed', stale: 'stale', chair: 'ask' };
const ORDER = { overdue: 0, late: 1, dated: 2, missed: 3, undated: 4 };   // the current app's order inside the list

// stepsFor(person) -> that person's testimony and hearing steps, in the current app's order. `at` is the TEAM's time to act
// (handTime, e.g. an approval by 11:00 AM for a 3:00 PM Capitol deadline); `due` is the Capitol's own deadline.
// Out of this slice, on purpose: follow-ups, replies, to-dos, public asks, emails and the other kinds in work(me).own (suggestedFor below has some of them).
// Three deliberate differences from work(me).own (R-398, Nate 14 Nov), each marked on the step it makes:
//   1. no cap on asks (the current app shows at most three Email-the-chair rows, ASK_ROWS in staff6/today.js): every bill of the person's that needs a hearing has its ask;
//   2. asks to one committee with one deadline are ONE step naming all its bills (`bills`, `members`);
//   3. "whoever is lead on the bill is the testimony writer": a hearing, letter or filing nobody holds (no owner, no helper) goes to the bill's issue lead, else the admins (`orphan`).
const slug = c => String(c || '').replace(/[^A-Za-z0-9]+/g, '_');
const TONE = { overdue: 0, late: 1, neutral: 2 };
export function stepsFor(me) {
  if (!me) return [];
  const prev = S.me; S.me = me;   // work() reads who is looking from S.me for "mine"
  t6Fresh();   // the current app's list is kept for one task; this asks for it worked out again from the data as it is now
  let own, asks, orphans = [];
  try { const w = work(me); own = w.own; asks = w.asks; orphans = orphanItems(me); } finally { S.me = prev; }
  const out = new Map();
  const base = (id, kind, it, extra) => {
    const b = it.b, s = it.s, h = it.h || null;
    const at = it.at ?? null, sentBack = it.d?.review_note || '';
    return { id, kind, bill: b, hearing: h, draft: it.d || null, at, due: s.due ?? null, until: s.until ?? null, act: s.act || null, tone: it.tone || 'neutral', late: s.act?.kind === 'late',
      issue: issueOf(b), name: billName(b), no: billNo(b), forWhom: '', sentBack, ask: null, verb: VERB[kind], ...extra };
  };
  for (const it of [...own, ...orphans]) {
    const kind = KIND[it.kind]; if (!kind || kind === 'ask' || !it.s || !it.b) continue;
    const b = it.b, h = it.h || null, num = String(b.bill_number).replace(/\s/g, '');
    let id = `t-${num}-${h?.id}`;
    if (out.has(id) && it.d?.id) id += `-${it.d.id}`;   // two open drafts on one hearing both show
    if (out.has(id)) continue;
    out.set(id, base(id, kind, it, it.orphan ? { orphan: true } : {}));
  }
  // ---- the asks: the capped rows and the rest, all of them, then one step for each committee and deadline ----
  const all = [...own.filter(i => i.kind === 'chair').map(i => ({ b: i.b, s: i.s, at: i.at, tone: i.tone })), ...(asks || []).map(r => ({ b: r.b, s: r.s, at: r.by, tone: shownStatus(r.s)?.tone || 'neutral' }))]
    .filter(r => r.s?.ask && r.b).sort((x, y) => String(x.b.bill_number).localeCompare(String(y.b.bill_number), 'en', { numeric: true }));
  const groups = new Map();
  for (const r of all) {
    const a = r.s.ask, num = String(r.b.bill_number).replace(/\s/g, '');
    let forWhom = '', forId = '';
    if (a.key === 'giving') { const o = (S.assignments?.[r.b.id] || []).map(advocate).find(x => x && x.id !== me.id); forWhom = o ? first(o) : ''; forId = o ? String(o.id) : ''; }   // the person's id, not their first name: two people can share one
    const together = !!a.m && !a.decide && !a.partial && !a.waitOn && !!a.st?.deadline && !a.st.deadline.missed;   // a vote ask, a joint committee's one chair and a missed date stay one bill each
    const key = together ? `${a.code}|${a.st.deadline.date}|${a.key}|${forId}` : `one|${num}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ ...r, forWhom, forId, num });
  }
  for (const list of groups.values()) {
    const f = list[0], a = f.s.ask, many = list.length > 1, yr = f.b.session_year || SESSION_YEAR;
    const id = many ? `ask-${slug(a.code)}-${a.st.deadline.date}-${yr}-${slug(a.key)}${f.forId ? '-' + slug(f.forId) : ''}` : `ask-${f.num}-${yr}`;   // the kind and the person are in it: the same committee and date can hold an ask and a giving
    const ats = list.map(r => r.at).filter(x => x != null), days = list.map(r => r.s.ask.st?.deadline).filter(d => d && !d.missed && d.days != null).map(d => d.days);
    const tone = list.map(r => r.tone || 'neutral').sort((x, y) => (TONE[x] ?? 2) - (TONE[y] ?? 2))[0];
    const cm = cmteWords(a.code);
    const st = base(id, 'ask', { ...f, at: ats.length ? Math.min(...ats) : null, tone }, {
      forWhom: f.forWhom, ask: a, due: f.s.due ?? null, verb: a.decide ? 'Ask for a vote' : VERB.ask, dlDays: days.length ? Math.min(...days) : null,
      members: list.map(r => ({ bill: r.b, ask: r.s.ask, at: r.at, name: billName(r.b), no: billNo(r.b) })), bills: list.map(r => ({ bill: r.b, name: billName(r.b), no: billNo(r.b) })) });
    if (many) { st.name = cm; st.no = `${list.length} bills`; const cats = new Set(list.map(r => issueOf(r.b).cat)); st.issue = { id: null, name: cm, icon: 'mail', cat: cats.size === 1 ? [...cats][0] : 'other' }; }
    out.set(id, st);
  }
  for (const st of chairSteps(me)) out.set(st.id, st);
  for (const st of placeSteps(me)) out.set(st.id, st);   // gap E: a bill the person tracked from Search and leads, until its position and issue are set
  for (const st of draftSteps(me)) out.set(st.id, st);   // R-398 piece 10: Finish a new issue, Publish a new issue (no clock)
  for (const st of checkSteps(me)) out.set(st.id, st);   // R-398 piece 9 gap B: the testimony whose position changed after it was approved (do_check.js)   // R-398 piece 5: the steps an ask to a chair makes for the one who holds it (ask_data.js)
  const ord = s => s.kind === 'check' || s.kind === 'place' ? -1 : noClock(s) ? ORDER.undated + 1 : s.tone === 'overdue' ? ORDER.overdue : s.tone === 'late' ? ORDER.late : s.kind === 'missed' ? ORDER.missed : s.at != null ? ORDER.dated : ORDER.undated;
  return [...out.values()].sort((x, y) => ord(x) - ord(y) || (x.at ?? Infinity) - (y.at ?? Infinity) || x.id.localeCompare(y.id, 'en', { numeric: true }));
}


// ---- R-398 piece 10: a new issue nobody finds by looking (S-19). Worked out from the data each time, never stored (S-10); no clock, so they sit below the timed steps and are never First up.
// The lead (the starter, until it is handed to someone) has "Finish a new issue" until nothing is missing; an admin who is not its lead has it under Waiting on others, and once the draft is ready,
// "Publish a new issue". Each opens the draft's own page.
export const noClock = s => s.kind === 'finish' || s.kind === 'publish';
const listOf = a => a.length < 2 ? a.join('') : `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`;
const cap = t => t.charAt(0).toUpperCase() + t.slice(1);
const draftsNow = () => (S.issues || []).filter(isDraft);
const leadId = i => i.owner_id || i.created_by || null;
const nameBy = (id, me) => id && me && id === me.id ? 'You' : id ? first(advocate(id)) : 'Someone';
// "A goal and three talking points to write", then "a bill to put on it" (the same words issue_draft.js's missingOf names)
export function finishLine(i) {
  const m = missingOf(i), bill = m.includes('a bill'), w = m.filter(x => x !== 'a bill'), out = [];
  if (w.length) out.push(`${cap(listOf(w))} to write`);
  if (bill) out.push(w.length ? 'a bill to put on it' : 'A bill to put on it');
  return out.join(', and ');
}
const issueMark = i => { const cat = /^[a-z-]+$/.test(i.category || '') ? i.category : 'other'; return { id: i.id, name: i.name, icon: i.icon || (S.categories || []).find(c => c.key === i.category)?.icon || 'circle', cat }; };
const draftStep = (i, kind, line, icon) => ({ id: `${kind === 'finish' ? 'fi' : 'pi'}-${i.id}`, kind, bill: null, hearing: null, draft: null, at: null, due: null, until: null, act: null, tone: 'neutral', late: false, issue: issueMark(i),
  name: eCig(i.name), no: '', forWhom: '', sentBack: '', ask: null, verb: VERB[kind], line, icon, href: `#/issue/${encodeURIComponent(i.id)}` });
const NUM = { 3: 'three', 4: 'four', 5: 'five' };
export function draftSteps(me) {
  if (!me) return [];
  const out = [];
  for (const i of draftsNow()) {
    const missing = missingOf(i).length, mine = leadId(i) === me.id;
    if (mine && missing) out.push(draftStep(i, 'finish', finishLine(i), 'pencil'));
    else if (!missing && me.is_admin) {
      const k = billRows(i).length, t = pointsOf(i).length, by = nameBy(i.created_by || leadId(i), me);
      out.push(draftStep(i, 'publish', `${by} started it. It has a goal, ${NUM[t] || t} talking points and ${k} ${k === 1 ? 'bill' : 'bills'}.`, 'globe'));
    }
  }
  return out;
}
// An admin's rows under Waiting on others: "<name>" / "Waiting on Kevin for a goal and talking points", for a draft somebody else leads and that is not ready yet.
export function draftWaits(me) {
  if (!me) return [];
  const href = i => `#/issue/${encodeURIComponent(i.id)}`, row = (i, line) => ({ id: `dw-${i.id}`, kind: 'public', b: null, name: eCig(i.name), no: '', who: '', second: false, at: null, with: [], line, href: href(i) });
  // the lead of a ready draft, who cannot publish it: "<name> · Waiting on <admin> to publish" (gone by itself once it is published or removed, since drafts come from the data)
  if (!me.is_admin) return draftsNow().filter(i => leadId(i) === me.id && !missingOf(i).length).map(i => row(i, `Waiting on ${adminFirst()} to publish`));
  return draftsNow().filter(i => leadId(i) !== me.id && missingOf(i).length).map(i => {
    const lead = nameBy(leadId(i), me), what = listOf(missingOf(i).map(x => x === 'three talking points' ? 'talking points' : x));
    return row(i, `Waiting on ${lead} for ${what}`);
  });
}

// ---- rule 1 of 14 Nov: whoever leads the bill writes its testimony. work(me).own gives a hearing with no letter to the bill's owner or helpers; a bill nobody holds is only a line
// for its issue's lead or an admin to hand over. Here it is the lead's own step: the bill's issue lead, else the admins. (Also the letter, the filing and the question after, once the letter is made, or the step would vanish at "Make the letter".)
const live = id => !!id && advocate(id)?.is_active !== false;
const issueLead = b => (S.billIssues || []).filter(x => x.bill_id === b.id).map(x => (S.issues || []).find(i => i.id === x.issue_id)).find(i => i && live(i.owner_id))?.owner_id || null;
export const leadsFor = b => { const io = issueLead(b); return io ? [io] : (S.advocates || []).filter(a => a.is_admin && a.is_active !== false).map(a => a.id); };
function orphanItems(me) {
  const out = [], now = Date.now();
  for (const b of S.bills || []) {
    if (b.tracked === false || !b.position || b.position === 'monitor' || diedish(b) || (S.assignments?.[b.id] || []).some(live)) continue;
    if (!leadsFor(b).includes(me.id)) continue;
    const drafts = (S.drafts?.[b.id] || []).filter(d => d.status !== 'cancelled');
    const add = (d, h) => { const s = billStep(b, { viewer: me, d, h }); if (!s || !s.nobody || s.kind === 'none' || s.kind === 'filed') return;
      out.push({ kind: s.kind, orphan: true, b, d, h, s, at: s.kind === 'missed' ? new Date(h.scheduled_at).getTime() : s.act?.at ?? s.due ?? null, tone: s.kind === 'missed' ? 'neutral' : (shownStatus(s)?.tone || 'neutral') }); };
    for (const d of drafts) { if (d.status === 'filed') continue; const h = draftHearing(d); if (h && (h.status === 'cancelled' || new Date(h.scheduled_at).getTime() >= now - 2 * DAY)) add(d, h); }
    for (const h of S.hearings || []) { if (h.bill_id !== b.id || h.status === 'cancelled' || new Date(h.scheduled_at).getTime() <= now || drafts.some(d => d.committee === h.committee)) continue; add(null, h); }
  }
  return out;
}

// ---- what Home lists (Nate, 14 Nov): To do holds four urgent kinds and "Did we file?"; everything else is one quiet line, "N more steps later" ----
// testimony due within a day (or past), a letter waiting on this person's approval or second look, a bill about to stop (an ask whose committee deadline is 3 days off or less), and a hearing already past with nothing filed.
export const URGENT_DAYS = 3;
// Past due, said one way everywhere: the team's time to act has gone (or the letter is late, or an ask's committee date is behind us). A "Did we file?" is a question, not a time.
export const pastDue = s => s.kind !== 'missed' && s.kind !== 'check' && s.kind !== 'place' && (!!s.late || s.tone === 'overdue' || s.tone === 'late' || (s.at != null && new Date(s.at).getTime() <= Date.now()) || (s.kind === 'ask' && !!s.ask?.st?.deadline?.missed));
// A "check testimony" step is not one of the four kinds: it waits in the later line unless it is past due. A bill whose committee date has already passed is as urgent as one about to stop.
export const isUrgent = s => s.kind === 'check' || s.kind === 'place' || noClock(s) || s.kind === 'approve' || s.kind === 'second' || s.kind === 'missed' || s.kind === 'chairfu' || s.kind === 'decide'
  || (s.kind === 'ask' ? (s.dlDays != null && s.dlDays <= URGENT_DAYS) || pastDue(s) : s.kind === 'stale' ? pastDue(s) : s.at != null && new Date(s.at).getTime() - Date.now() < DAY);
const byTime = (x, y) => ((y.kind === 'check' || y.kind === 'place') - (x.kind === 'check' || x.kind === 'place')) || (pastDue(y) - pastDue(x)) || (noClock(x) - noClock(y)) || (x.at ?? Infinity) - (y.at ?? Infinity) || x.id.localeCompare(y.id, 'en', { numeric: true });
// homeRows(steps) -> the steps To do shows, past due first, then soonest. laterRows(steps) -> the rest, in the order stepsFor gave them.
export const homeRows = steps => steps.filter(isUrgent).sort(byTime);
export const laterRows = steps => steps.filter(s => !isUrgent(s));
// "3 more steps later" (one phrase everywhere), "1 more step later".
export const laterWords = rest => `${rest.length} more ${rest.length === 1 ? 'step' : 'steps'} later`;
// The key the page remembers a typed email and its footer under: a step that holds several bills also holds who they are, so a bill joining or leaving never carries old words over.
export const memoKey = s => s.members?.length > 1 ? `${s.id}|${s.members.map(m => String(m.bill.id)).sort().join(',')}` : s.id;

// A committee in words with its chamber in front ("House Judiciary & Hawaiian Affairs"); a joint hearing joins its committees with "with".
export function cmteWords(codes) {
  return String(codes || '').split('/').map(c => c.trim()).filter(Boolean).map(c => {
    const n = cmteName(c), ch = S.committees?.[c]?.chamber;
    return /^(House|Senate)\b/.test(n) || !ch ? n : `${ch === 'S' ? 'Senate' : 'House'} ${n}`;
  }).join(' with ');
}
// The hearing in words: "Hearing Thu 2:00 PM · House Health · Room 329".
export function hearingLine(h) {
  if (!h) return '';
  if (h.status === 'cancelled') return 'Hearing cancelled, no new date yet.';   // the current app's words (staff6/steps.js); never a coming day and time
  return ['Hearing ' + dayTime(h.scheduled_at), cmteWords(h.committee), roomName(h.room)].filter(Boolean).join(' · ');
}
export { lateLine };

// This week's steps (Monday to Sunday, Hawaiʻi time): one each, open or finished, so "1 of 5 done" is a true count.
export function weekBounds(t = Date.now()) {
  const ymd = new Date(t).toLocaleDateString('en-CA', HST), d0 = new Date(`${ymd}T00:00:00-10:00`).getTime();
  const dow = (new Date(`${ymd}T12:00:00-10:00`).getUTCDay() + 6) % 7;   // Monday 0
  return [d0 - dow * DAY, d0 + (7 - dow) * DAY];
}
export const inWeek = s => { const [, end] = weekBounds(); return s.at != null && new Date(s.at).getTime() < end; };   // an overdue step is this week's too
export { advocate };
