// Staff v6 (R-336, V6-SPEC section 5): the one word for each fact and the one card for each step (V07, V19).
// v5 said where testimony stands in 7 word lists and "sent back" about 10 ways (assessment X8); a chair ask had 9 button
// names in 8 places (X7). Every v6 screen asks this file instead:
//   status(x)            the tone, icon and words of any step, row or badge: amber ONLY for "Late, still accepted until",
//                        red ONLY for overdue, green ONLY for done, everything else neutral (D3, A-5 as amended)
//   testimonyState(d,b)  Writing · With an approver · Second look · Ready to file · Filed, and Missed (five words + one)
//   whoseStep(d,b)       who acts next ("Kris, Jess or Nate" for a shared approval) and whether it is the viewer
//   goingWords(h)        "Going: Kris" / "Going: no one yet"
//   askWords(b)          "Ask the chair by Wed 3/25" / "Asked by Kevin Mon 3/16 · no reply yet" / "Scheduled"
//   actBy(step)          the one time to act: the W31 hand-on time, "until 9:30 AM" when late
//   committeeName(code)  "House Transportation", "Senate Health and Human Services, and Commerce"
//   versionWords(v)      "House draft 1";  deadlineWords(name, date) "must reach its last committee by Mon 3/30"
// and the shared parts, each a pure HTML string builder (events are delegated once, below, like terms.js):
//   stepCard(b, {viewer, where})   the ONE card for a bill's current step (own step: its button; someone else's: a status
//                                  line, no button; nobody's: "No owner yet" with Take it); hearingCard(sitting,
//                                  {viewer, big}); billRow / itemRow (a name, the bill number small, one 16px line, at
//                                  most one tonal button, D16); listDetail (the list with the picked item beside it, V17);
//                                  placeHead (the page title and its one row of tabs).
//   billStep(b, {viewer})          the step behind them: kind, whose, act (actBy), status, `mine` (the viewer's step or
//                                  bill: only then late shows amber, shownStatus), `nobody`, `takeFor`, and the row's line.
//   finish(el)                     the calm finish motion every step's button runs before the redraw and its Undo toast.
// Every fact comes from model.js (drafts and their steps, deadlines and risk, who approves and files) and every action
// calls the same data functions v5's Today, bill page and Review call, with the same Undo and who's-next toast (P2, P3).
// The old word lists in model.js, today.js and hearing.js stay until each screen switches to these (spec section 5).
import { S, DB, esc, advocate, capitolUrl, hooks, SESSION_OVER } from './data.js';
import { stopOf, diedish, wantsHearing, hearingAhead, draftHearing, sittingDraft, filerOf, canFirstApprove, canSecondApprove, standingIn,
  attendees, chairMail, chairAskOf, chairAskMail, chairIdsOf, askWords as stopAsk, gateNeed,
  whenAt, clockDay, lateLine, timeFirst, spanOf, roomName, blurb, billRoute, billYearPart, codesOf, movedFrom, isDecision,
  streamOf, billById, offTag, legById, askReply, billRef } from './model.js';
import { icon, btn, toast, openSheet, closeSheet, pickerSheet, goingBtn, docBtn, mayUnfile, segmented, field, avatar } from './ui.js';
import { ACTS as PIC, rowLead, iconizeButtons, testimonyTrack, STATES, chairKey, BTN_ICON, dropVerb } from './verbs.js';   // R-344: the one table of action pictures and status shapes
import { issueIcon } from './issuegrid.js';   // R-339: an issue's own icon wherever an issue is named (used in functions only)
import { askLine, answerSheet } from './chairask.js';
import { askTodoOf, giveAsk, logAsk } from './push.js';
import { issuesOfBill, issueLinkHref } from './issues.js';

const HR = 36e5, DAY = 864e5;
const HST = { timeZone: 'Pacific/Honolulu' };
// Spec 12.1: item names at Poppins 500. staff6.html loads Poppins 600 and 700 only (FRAME's file, asked to add 500), and a
// browser with no 500 face draws the nearest heavier one, so names stayed as bold as before (the critic). Until the page's
// own link carries 500 this adds that one face, once; it does nothing when the page already loads it, or no Google fonts.
if (typeof document !== 'undefined' && document.head?.insertAdjacentHTML && document.querySelectorAll) {
  const links = [...document.querySelectorAll('link[rel="stylesheet"][href*="fonts.googleapis.com"]')];
  if (links.length && !links.some(l => /family=Poppins:(?:ital,)?wght@[^&]*\b500\b/.test(decodeURIComponent(l.getAttribute('href') || ''))))
    document.head.insertAdjacentHTML('beforeend', '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Poppins:wght@500&display=swap" data-v6font="500">');
}
const ms = t => t == null || t === '' ? null : typeof t === 'number' ? t : new Date(t).getTime();
const hday = t => new Date(t).toLocaleDateString('en-CA', HST);
const live = id => { const a = id && advocate(id); return !!a && a.is_active !== false; };
const uniq = xs => [...new Set(xs.filter(Boolean))];
const meOf = viewer => viewer || S.me || null;

// ---- small words ----
// "Wed 3/25": a day the way every v6 screen says it.
export const dayWords = t => new Date(typeof t === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(t) ? t + 'T12:00:00-10:00' : t)
  .toLocaleDateString('en-US', { ...HST, weekday: 'short', month: 'numeric', day: 'numeric' }).replace(',', '');
// "9:30 AM"
export const timeWords = t => new Date(t).toLocaleTimeString('en-US', { ...HST, hour: 'numeric', minute: '2-digit' });
// A bill number as staff and chairs say it, with its space and without the draft code (D15): "HB 1562", and an earlier
// session's says its year, "HB 5 (2026)", so two bills of one number are never two identical rows (R-152 B).
export const numWords = b => b ? `${String(b.bill_number || '').replace(/^([A-Z]+)\s*(\d)/, '$1 $2')}${billYearPart(b) ? ` (${b.session_year})` : ''}` : '';
// A bill's name in a row: its nickname, else (a bill we only monitor) its short description (R-271).
export const nameWords = (b, n = 72) => b ? (String(b.nickname || '').trim() || blurb(b, n) || numWords(b)) : '';
// A row's or a card's name in full (A-1, nothing cut; rows wrap): the nickname, else the bill's whole description (R-271).
// One longer than about 170 characters ends at its last clause before 160 (a ";", "," or ":"), else its last word, with
// no typed "…" (a monitored bill's "Department of Health…" cut its subject off mid-name).
export function fullName(b) {
  if (!b) return '';
  const nick = String(b.nickname || '').trim(); if (nick) return nick;
  const t = blurb(b, 1e4); if (!t) return numWords(b);
  if (t.length <= 170) return t;
  const cut = t.slice(0, 160), at = Math.max(cut.lastIndexOf('; '), cut.lastIndexOf(', '), cut.lastIndexOf(': '));
  return (at > 80 ? cut.slice(0, at) : cut.replace(/\s\S*$/, '')).replace(/[\s,;:]+$/, '');
}
// A teammate's first name, "you" for the viewer, and "(turned off)" for someone who is (R-316 W28).
export const firstWords = (id, viewer) => { const v = meOf(viewer); if (v && id === v.id) return 'you';
  const a = advocate(id); return a ? (String(a.full_name || '').split(' ')[0] || 'Someone') + offTag(a) : 'Someone'; };
// "Kris", "Kris or Nate", "Kris, Jess or Nate"; the viewer first, as "you".
export function orWords(ids, viewer, { and = false } = {}) {
  const v = meOf(viewer), list = uniq(ids), mine = v && list.includes(v.id);
  const names = [...(mine ? ['you'] : []), ...list.filter(id => !v || id !== v.id).map(id => firstWords(id, v))];
  const w = and ? 'and' : 'or';
  return names.length < 2 ? (names[0] || '') : `${names.slice(0, -1).join(', ')} ${w} ${names[names.length - 1]}`;
}
const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;
// A bill in a toast or a sheet's title: "Youth mental health app pilot (HB 1562)" (no draft code, D15).
// One name per bill (decision 9): the bill as a card or row of an ISSUE names it, the nickname Bills uses; when that is the issue's
// own name (the card's heading says it already) the number stands in, as the issue page's "Its issue" does.
export const billInIssue = (b, i, { max = 1e4 } = {}) => { const n = nameWords(b, 40); return !n || n.length > max || String(n).trim().toLowerCase() === String(i?.name || '').trim().toLowerCase() ? numWords(b) : n; };
export const sayWords = b => b ? (b.nickname ? `${b.nickname} (${numWords(b)})` : numWords(b)) : '';

// ---- committees, versions and deadlines in plain words (V05, D15) ----
// Short names, chamber first: the Capitol's own names are long ("Consumer Protection & Commerce", "Water, Land, Culture
// and the Arts") and two committees share some ("Transportation" in each chamber), so a row says "House Transportation".
// Every code in the practice data is here, the joint referrals' halves included, and the 2025 Senate codes that still
// sit on older bills' referrals (TCA, WTL, HRE). A code that is not here falls back to the committee list's own name,
// then to the code itself (still searchable). The code stays small beside the words only where the Capitol uses it (the
// filing card, About this bill: spec section 5).
export const COMMITTEES = {
  // House
  AGR: ['H', 'Agriculture'], CAA: ['H', 'Culture and Arts'], CPC: ['H', 'Consumer Protection'], ECD: ['H', 'Economic Development'],
  EDN: ['H', 'Education'], EEP: ['H', 'Energy and Environment'], FIN: ['H', 'Finance'], HED: ['H', 'Higher Education'],
  HLT: ['H', 'Health'], HSG: ['H', 'Housing'], HSH: ['H', 'Human Services'], JHA: ['H', 'Judiciary'], LAB: ['H', 'Labor'],
  LMG: ['H', 'Legislative Management'], PBS: ['H', 'Public Safety'], TOU: ['H', 'Tourism'], TRN: ['H', 'Transportation'],
  WAL: ['H', 'Water and Land'],
  // Senate
  AEN: ['S', 'Agriculture and Environment'], CPN: ['S', 'Commerce'], EDT: ['S', 'Economic Development'], EDU: ['S', 'Education'],
  EIG: ['S', 'Energy'], GVO: ['S', 'Government Operations'], HHS: ['S', 'Health and Human Services'], HOU: ['S', 'Housing'],
  HWN: ['S', 'Hawaiian Affairs'], JDC: ['S', 'Judiciary'], LBT: ['S', 'Labor'], PSM: ['S', 'Public Safety'],
  TRS: ['S', 'Transportation'], WAM: ['S', 'Ways and Means'], WLA: ['S', 'Water and Land'],
  // Senate, 2025 (older bills' referrals)
  TCA: ['S', 'Transportation and Culture'], WTL: ['S', 'Water and Land'], HRE: ['S', 'Higher Education'],
};
const CHAMBER = { H: 'House', S: 'Senate' };
const cmteOf = c => { const k = String(c || '').trim().toUpperCase(), t = COMMITTEES[k], row = S.committees?.[k];
  if (t) return { code: k, ch: row?.chamber || t[0], name: t[1] };
  if (row) return { code: k, ch: row.chamber, name: String(row.name || k).replace(/\s*&\s*/g, ' and ') };
  return null; };
// "House Transportation"; a joint referral names each of its committees in full, chamber and all: "House Health and House
// Human Services", "Senate Health and Human Services and Senate Commerce", "House Health, House Human Services and House
// Consumer Protection". It read "House Health, and Human Services", which still sounded like one committee (fresh-eyes
// review of the stage tracker, R-336); the chamber repeated marks where one name ends. `chamber: false` leaves the chamber
// out (one committee's name, "Health"; several keep the comma before the last, "Health, and Human Services").
export function committeeName(code, { chamber = true } = {}) {
  const cs = codesOf(code); if (!cs.length) return '';
  const ks = cs.map(c => cmteOf(c) || { code: c, ch: '', name: c });
  const names = ks.map(k => k.name);
  if (!chamber) return names.length < 2 ? names[0] : `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
  const full = ks.map(k => `${CHAMBER[k.ch] ? CHAMBER[k.ch] + ' ' : ''}${k.name}`);
  return full.length < 2 ? full[0] : `${full.slice(0, -1).join(', ')} and ${full[full.length - 1]}`;
}
// "HD1" -> "House draft 1"; "SD2" -> "Senate draft 2"; "CD1" -> "Conference draft 1"; none -> "As introduced".
const VER = { H: 'House draft', S: 'Senate draft', C: 'Conference draft', F: 'Floor draft' };
export function versionWords(v) {
  if (!v) return 'As introduced';
  const m = /^([HSCF])D(\d+)$/i.exec(String(v).trim());
  return m ? `${VER[m[1].toUpperCase()]} ${+m[2]}` : String(v);
}
// What a Capitol deadline asks, with its day: deadlineWords('Second lateral', '2026-03-30') -> "must reach its last
// committee by Mon 3/30" (n > 1: "their"). The session's last day says so. The name itself stays in Help and About.
export function deadlineWords(name, date, { n = 1 } = {}) {
  const day = date != null && date !== '' ? dayWords(date) : '';
  if (/sine die/i.test(name || '')) return day ? `the session ends ${day}` : 'the session ends';
  return `must ${gateNeed(name, n)}${day ? ` by ${day}` : ''}`;
}

// Where a bill stands, in one plain line for a row or a card with no step (stops.js says it with codes: "Needs a hearing in
// CPN/HHS · committee 1 of 2 in the Senate · Lateral 3/30 (14d)"): "Waiting in Senate Commerce, and Health and Human
// Services · must reach its last committee by Mon 3/30", "Hearing tomorrow 9:30 AM · House Transportation".
// `hearing: false` leaves the hearing ahead out (the step card's hearing line beside it says it, A-14: "In Senate
// Transportation", not "…, its hearing set", which read oddly in About's Where it stands); `pos: true` adds
// which committee of how many ("committee 1 of 2 in the Senate"), for About this bill; `deadline: false` leaves out the
// deadline it races (About has its own Deadline row).
export function whereWords(b, { hearing = true, pos = false, deadline = true } = {}) {
  if (!b) return '';
  const st = stopOf(b), h = hearingAhead(b), dl = deadline && st.deadline && !st.deadline.missed ? st.deadline : null;
  const race = `${pos && st.stops && st.phase === 'committee' ? ` · committee ${st.stop} of ${st.stops} in the ${CHAMBER[st.chamber] || 'chamber'}` : ''}${dl ? ` · ${deadlineWords(dl.label, dl.date)}` : ''}`;
  if (h && hearing) return `Hearing ${whenAt(h.scheduled_at)} · ${committeeName(h.committee) || h.committee}`;
  if (h) return `In ${committeeName(st.committee || h.committee) || h.committee}${race}`;
  if (diedish(b)) return st.phase === 'law' || st.phase === 'governor' || st.phase === 'ballot' ? String(st.says).replace(/\.$/, '') : 'Did not advance';
  if (['law', 'vetoed', 'ballot', 'governor'].includes(st.phase)) return String(st.says).replace(/\.$/, '');
  if (st.phase === 'conference') return `In conference${dl ? ` · House and Senate must agree by ${dayWords(dl.date)}` : ''}`;
  if (st.phase === 'floor') return `Through committee, waiting for the floor vote${race}`;
  // A sitting under three hours old with no outcome yet is still going (askWords waits for it too).
  if (beingHeard(st) && st.committee) return `Being heard in ${committeeName(st.committee)}${race}`;
  if (st.hearingState === 'held' && st.committee) return `Heard in ${committeeName(st.committee)}, waiting for its vote${race}`;
  if (st.committee) return `Waiting in ${committeeName(st.committee)}${race}`;
  return `Waiting for its committees${race}`;
}

// ---- time: the one moment to act (W31) ----
// The writer hands on 12 hours before the testimony deadline, or at 4:00 PM the day before when those 12 hours land
// overnight (after 4:00 PM or before 8:00 AM), and the filer files 2 hours before (Nate, 12 and 22 Oct; R-267, R-330).
// Past the deadline and before the hearing starts, the Capitol still takes late testimony: the time is the hearing's
// start ("until 9:30 AM").
// Approvals sit between the two, so an approver who keeps to the time shown never makes the filing late (fresh-eyes
// review: "Approve by 3:00 PM" beside "File by 1:00 PM" did): the first approval 4 hours before the deadline, the second
// look 3 hours before. When that lands before 8:00 AM it is the evening before instead, 6:00 PM (the second look 7:00 PM),
// after the writer's 4:00 PM, so nobody is asked to approve at 5:30 AM; and never later in an evening than those. A
// builder's choice inside W31's spirit (Nate set only the writer's and the filer's times); the test walks every half hour
// of a day to keep writer, approver, second look and filer in that order.
const TESTI = new Set(['write', 'submit', 'revise', 'nodraft', 'review', 'review2', 'approve', 'second', 'file', 'stale']);
const HAND = { write: 12, submit: 12, revise: 12, nodraft: 12, approve: 4, review: 4, second: 3, review2: 3, file: 2 };
// The verbs are verbs.js ACTS's words (imported here as PIC: this file's ACTS is its button handlers) (R-344: one table gives each action its word, icon and tile, so a row and its button
// always match); a step with no draft yet is timed by when it must be sent for approval.
const VERB = { ...Object.fromEntries(['write', 'submit', 'revise', 'review', 'review2', 'approve', 'second', 'file', 'stale', 'chair', 'ask', 'send', 'email', 'fix'].map(k => [k, PIC[k].word])),
  nodraft: PIC.write.word };
const hourOf = t => new Date(t).toLocaleTimeString('en-GB', { ...HST, hour: '2-digit', minute: '2-digit', hour12: false }).split(':').map(Number);
export function handTime(due, hours) {
  const at = due - hours * HR;
  if (hours === 3 || hours === 4) {   // an approval: inside 8:00 AM to 6:00 PM (the second look 7:00 PM)
    const [hh, mm] = hourOf(at), last = hours === 4 ? 18 : 19;
    if (hh < 8) return new Date(hday(at - DAY) + `T${last}:00:00-10:00`).getTime();
    if (hh * 60 + mm > last * 60) return new Date(hday(at) + `T${last}:00:00-10:00`).getTime();
    return at;
  }
  if (hours < 12) return at;
  const [hh, mm] = hourOf(at);
  if (hh * 60 + mm <= 16 * 60 && hh >= 8) return at;
  return new Date(hday(due - DAY) + 'T16:00:00-10:00').getTime();
}
// A step's until: the hearing's start for a testimony step (late testimony), nothing otherwise.
// R-352 (Nate 27 Oct, A-5 on v6): a deadline under about 3 hours away says how long is left in words beside its time
// ("Due today 10:00 AM, in 1 hour", "in 25 min"), so due today is found by its words and its bold time, not by amber. A
// comma, not " · ": it is part of the time, and a row's line keeps two parts at most (spec 8's four facts).
export const SOON_HOURS = 3;
export const leftSoon = at => { const d = at - Date.now(); return d > 0 && d < SOON_HOURS * HR ? `, in ${spanOf(at)}` : ''; };
const untilOfStep = s => s.until !== undefined ? ms(s.until) : TESTI.has(s.kind) && s.h && s.h.status !== 'cancelled' ? ms(s.h.scheduled_at) : null;
// actBy(step) -> { kind: 'hand'|'now'|'due'|'late'|'overdue'|'none', at, due, until, verb, time, words }
// `step`: a v6 step (billStep), a v5 Today task ({ kind, due, h }), or { kind, due, h }.
export function actBy(step) {
  const s = step || {}, kind = s.kind || '', due = ms(s.due), until = untilOfStep(s), now = Date.now();
  const verb = s.verb || VERB[kind] || 'Due';
  if (due == null) return { kind: 'none', at: null, due: null, until, verb, time: '', words: '' };
  if (due <= now) {
    if (until != null && until > now) return { kind: 'late', at: until, due, until, verb, time: clockDay(until), words: lateLine(until) };
    return { kind: 'overdue', at: due, due, until, verb, time: whenAt(due), words: `${verb === 'Due' ? 'Was due' : verb + ', was due'} ${whenAt(due)}` };
  }
  const hours = HAND[kind];
  if (hours) {
    const at = handTime(due, hours);
    if (at > now) return { kind: 'hand', at, due, until, verb, time: whenAt(at), words: `${verb} by ${timeFirst(at)}${leftSoon(at)}` };
    // The hand-on time is gone and the deadline is still ahead: "File now · due today 10:00 AM", the same words on the row
    // and the card (V19).
    return { kind: 'now', at: due, due, until, verb, time: whenAt(due), words: `${verb} now · due ${whenAt(due)}${leftSoon(due)}` };
  }
  return { kind: 'due', at: due, due, until, verb, time: whenAt(due), words: `${verb === 'Due' ? `Due ${whenAt(due)}` : `${verb} by ${timeFirst(due)}`}${leftSoon(due)}` };
}

// ---- status by exception (D3, V08) ----
// status(x) -> { tone: 'neutral'|'today'|'late'|'overdue'|'done', icon, words, time, soon }
// R-352 (Nate 27 Oct, amending R-344's Decision 2; A-5 on v6): amber only when late. Due today ('today') is drawn in the
// plain body colour, with a neutral clock, its time in bold and, under 3 hours, the time left in words; the screens put it
// first. Amber, with the alarm clock, is only late testimony the Capitol still takes ('late'). Red, with the alert and the
// word "overdue", is a step still to do whose own deadline has passed ('overdue'). Missed testimony (its hearing has
// started) is said in words, in neutral, never coloured: nobody can act on it any more (V25, V30).
// A 2027 prep date that has passed is "Still to finish", never red (spec section 6, My issues).
export function status(x) {
  const s = x || {}, now = Date.now();
  if (s.state && typeof s.state === 'object') {   // a v6 step: its testimony state decides done and missed
    if (s.state.key === 'filed') return { tone: 'done', icon: 'circle-check', words: 'Filed', time: '', soon: false };
    if (s.state.key === 'missed') return { tone: 'neutral', icon: 'circle-x', words: 'Missed', time: '', soon: false };
  }
  if (s.done) return { tone: 'done', icon: 'circle-check', words: s.doneWords || 'Done', time: '', soon: false };
  if (s.missed) return { tone: 'neutral', icon: 'circle-x', words: 'Missed', time: '', soon: false };
  const due = ms(s.due), until = untilOfStep(s);
  if (due == null) return { tone: 'neutral', icon: '', words: '', time: '', soon: false };
  if (due <= now) {
    if (until != null && until > now) return { tone: 'late', icon: 'alarm-clock', words: lateLine(until), time: clockDay(until), soon: true };   // R-344: the alarm clock is late's own picture; the plain clock is due today's
    if (s.kind === 'prep') return { tone: 'neutral', icon: 'clock', words: 'Still to finish', time: '', soon: false };
    return { tone: 'overdue', icon: 'circle-alert', words: `${cap(spanOf(due))} overdue`, time: whenAt(due), soon: true };
  }
  // R-352: due today keeps the 'today' tone (the screens order and bold by it) but no colour; the clock is neutral.
  const today = hday(due) === hday(now), soon = due - now <= 2 * HR || today;
  return { tone: today ? 'today' : 'neutral', icon: soon ? 'clock' : '', words: `Due ${whenAt(due)}${leftSoon(due)}`, time: whenAt(due), soon };
}
// A status as a tile: the neutral sand tile, or late / overdue / done with its icon AND its word, never colour alone.
export const statusTile = (st, { cls = '' } = {}) => st && st.words ? `<span class="v6-status ${esc(st.tone)}${cls ? ' ' + cls : ''}">${st.icon ? icon(st.icon) : ''}<span>${nw(esc(st.words))}</span></span>` : '';
// Someone else's late or overdue step is said in neutral words with its clock, never amber or red: a wall of alarm about
// work the viewer cannot act on is not calm (D3, rule 7 status by exception, A-5). The step's own person, and the bill's
// owner, see the colour. Done stays leaf for everyone.
export const shownStatus = s => !s?.status || s.mine || !['late', 'overdue', 'today'].includes(s.status.tone) ? s?.status
  : { ...s.status, tone: 'neutral', icon: 'clock', soon: false };
// A time and its AM/PM, a room and its number, and a day and its date never part at a line's end ("2:00 / PM",
// "Room / 329"): wrapped in a no-wrap span, so the text itself (and what tests read) keeps its plain spaces. `s` is
// already escaped.
const NW = /(\b\d{1,2}:\d{2}[\s  ]?[AP]M\b|\bRoom [\w-]+|\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun) \d{1,2}\/\d{1,2}(?:, \d{1,2}:\d{2}[\s  ]?[AP]M\b)?)/g;
// A span holding a time of day also carries .v6-tm, the one part a due-today line bolds (spec 12.1, A-13: bolding every
// no-wrap span made "Fri 3/20" and "Room 430" read as second deadlines beside the due time).
export const nw = s => String(s ?? '').replace(NW, m => `<span class="v6-nw${/\d:\d{2}/.test(m) ? ' v6-tm' : ''}">${m}</span>`);

// ---- testimony: one state, five words and Missed (V12, V19) ----
export const STATE_WORDS = { write: 'Writing', approve: 'With an approver', second: 'Second look', file: 'Ready to file', filed: 'Filed', missed: 'Missed' };
// testimonyState(d, b, { h }) -> { key, word, label, sentBack, noDraft, stale } (toString: the word), or null for a
// draft whose sitting was cancelled with no new date (that is the hearing's fact, said by the hearing line).
// `d` null: the hearing is set and no draft exists yet, which is Writing too ("Writing · not started", spec 12.6: the one
// wording). "Sent back" is a flag on Writing: the draft does not record who sent it back (migration 098 keeps the note
// only), so it says "Writing · sent back" and names nobody rather than guess (R-152 C, spec 11.5).
export function testimonyState(d, b, { h } = {}) {
  if (d && d.status === 'cancelled') return null;
  const hr = h !== undefined ? h : d ? draftHearing(d) : null, now = Date.now();
  let key;
  if (d && d.status === 'filed') key = 'filed';
  else if (hr && hr.status !== 'cancelled' && ms(hr.scheduled_at) <= now) key = 'missed';
  else key = !d || d.status === 'draft' ? 'write' : d.status === 'review' ? 'approve' : d.status === 'second_review' ? 'second' : d.status === 'approved' ? 'file' : 'write';
  const sentBack = key === 'write' && !!d?.review_note, noDraft = !d && key === 'write';
  const stale = !!d && !!b?.current_version && (d.version || null) !== b.current_version && !['filed', 'cancelled'].includes(d.status);
  const word = STATE_WORDS[key];
  const label = sentBack ? `${word} · sent back` : noDraft ? `${word} · not started` : word;
  return { key, word, label, sentBack, noDraft, stale, toString() { return word; } };
}

// The coalition's helpers (advocates.prefs.coalitions names the coalition; "all" is Kris helping everywhere as an
// approver, not a writer) on a bill's coalitions.
export const helpersOf = b => { const cs = S.billCampaigns?.[b?.id] || [];
  return (S.advocates || []).filter(a => a.is_active !== false && Array.isArray(a.prefs?.coalitions) && a.prefs.coalitions.some(c => cs.includes(c))).map(a => a.id); };
const ownersOf = b => (S.assignments?.[b?.id] || []).filter(live);
// Who writes a draft (W6, no migration: spec section 6). Whoever sent it for approval holds it, with the bill's owner;
// a draft nobody has sent yet is the coalition's helpers' and the owner's (Patti writes on Lauren's HEAL bills). The
// writer sees it from the day the notice lands, because these ids are who the step belongs to.
export function writersOf(d, b) {
  const sender = live(d?.submitted_by) ? d.submitted_by : null, owners = ownersOf(b);
  return sender ? uniq([sender, ...owners]) : uniq([...helpersOf(b), ...owners]);
}
// whoseStep(d, b, { viewer, h }) -> { key, ids, words, you, role } : who acts next on this testimony.
// Approvals are shared ("Kris, Jess or Nate": whoever can give it now, the stand-ins once they may), so one review asked
// of four people shows once, not as four people's own rows (V12).
export function whoseStep(d, b, { viewer, h } = {}) {
  const v = meOf(viewer), hr = h !== undefined ? h : d ? draftHearing(d) : null, st = testimonyState(d, b, { h: hr });
  const act = (S.advocates || []).filter(a => a.is_active !== false);
  let ids = [], role = null;
  if (st?.key === 'write') { ids = writersOf(d, b); role = 'write'; }
  else if (st?.key === 'approve') { ids = act.filter(a => canFirstApprove(a, d, hr)).map(a => a.id); role = 'approve'; }
  else if (st?.key === 'second') { ids = act.filter(a => canSecondApprove(a, d)).map(a => a.id); role = 'second'; }
  else if (st?.key === 'file') { const f = filerOf(d); ids = f && live(f) ? [f] : ownersOf(b); role = 'file'; }
  // The hearing started with nothing filed (V25): the person who was to file it answers "Did we file?".
  else if (st?.key === 'missed' && d) { const f = filerOf(d); ids = f && live(f) ? [f] : ownersOf(b); role = 'close'; }
  ids = uniq(ids);
  // A draft nobody holds (no owner, no helper, nobody sent it) is nobody's step: never every viewer's own row with a
  // filled button (v5's "Open to anyone" put HB2300's Mark filed on Julie's Today). The card says "No owner yet"
  // with Take it; it reaches Today only for the issue's owner and admins (R-330's no-owner line, `takeFor`).
  const nobody = !ids.length && (role === 'write' || role === 'file');
  return { key: st?.key || null, ids, words: nobody ? 'no one yet' : orWords(ids, v), you: !!v && ids.includes(v.id), nobody, anyone: nobody, role, state: st };
}
// Who may hand a bill nobody holds (R-330 W42): an admin, or the owner of the bill's issue. They see it on Today.
const issueOwnerOf = b => (S.billIssues || []).filter(x => x.bill_id === b?.id).map(x => (S.issues || []).find(i => i.id === x.issue_id)).find(i => i && live(i.owner_id))?.owner_id || null;
export const takeFor = (b, viewer) => { const v = meOf(viewer); return !!v && (!!v.is_admin || issueOwnerOf(b) === v.id); };
// "Patti files it once it is approved": the filer named before Resubmit (spec section 6). Whoever sends it for approval
// files it (model.js filerOf), so on the writer's own card that is the viewer.
function filerWords(d, b, v, own) {
  if (!d || !['draft', 'review', 'second_review'].includes(d.status)) return '';
  if (d.status === 'draft') return own ? 'You file it once it is approved.' : '';
  const f = filerOf(d); if (!f) return '';
  return f === v?.id ? 'You file it once it is approved.' : `${cap(firstWords(f, v))} files it once it is approved.`;
}

// ---- hearings: who is going (V19) ----
const sittingRows = h => (S.hearings || []).filter(x => x.committee === h.committee && x.scheduled_at === h.scheduled_at);
const goersOf = h => { const seen = new Set(); return sittingRows(h).flatMap(r => attendees(r)).filter(a => !seen.has(a.id) && seen.add(a.id)); };
// "Going: Kris", "Going: you and Kris", "Going: no one yet": read across every row of the sitting (a person is marked on
// one of them, R-022).
export function goingWords(sitting, { viewer } = {}) {
  const h = sitting?.h || sitting; if (!h) return '';
  const ids = goersOf(h).map(a => a.id);
  return ids.length ? `Going: ${orWords(ids, viewer, { and: true })}` : 'Going: no one yet';
}
// R-344 Rule 4: who is going as their faces (each person's own colour, ui.js avatar), the words beside them saying who; with
// nobody going yet, the people icon (Rule 5: faces for people, never a generic icon where a face can stand).
const goingPic = h => { const g = goersOf(h); return g.length ? `<span class="v6-gofaces" aria-hidden="true">${g.slice(0, 3).map(a => avatar(a, 24, { deco: true })).join('')}</span>` : icon('users'); };
const goingOn = (h, v) => !!v && sittingRows(h).some(r => (S.attend?.[r.id] || []).includes(v.id));
// Who is going and the I'm going toggle on one line, as under a testimony step (the bill page's hearing card, R-346).
export const goingRowHTML = (h, { viewer } = {}) => { if (!h) return ''; const v = meOf(viewer), past = ms(h.scheduled_at) <= Date.now();
  return `<p class="v6-step-go">${goingPic(h)}<span>${esc(goingWords(h, { viewer: v }))}</span>${past ? '' : goingBtn(goingOn(h, v), { 'data-v6act': 'going', 'data-v6h': leadRow(h).id }, { kind: 'secondary', sm: true })}</p>`; };
// The row a person is marked on: a bill with a position, so the hearing reaches their calendar (hearing.js leadOf).
const leadRow = h => { const rows = sittingRows(h).filter(r => r.status !== 'cancelled'), pos = rows.find(r => { const b = billById(r.bill_id); return b && b.position && b.position !== 'monitor'; });
  return pos || rows[0] || h; };

// ---- getting a hearing: the chair ask (V13, V24) ----
// Working days between two moments (weekends left out), for "no reply in 3 working days".
function workingDays(from, to) {
  let n = 0; const end = hday(to);
  for (let d = new Date(hday(from) + 'T12:00:00-10:00'); hday(d.getTime()) < end; d.setUTCDate(d.getUTCDate() + 1)) {
    const next = new Date(d.getTime() + DAY), dow = new Date(hday(next.getTime()) + 'T12:00:00-10:00').getUTCDay();
    if (dow !== 0 && dow !== 6) n++;
  }
  return n;
}
// askWords(b, { viewer }) -> { key: 'ask'|'giving'|'waiting'|'said_no'|'passed'|'scheduled', words, code, by, at, who,
// asker, answer, followUp, decide, st, m, day, partial } (toString: the words), or null when the bill is not waiting for a
// hearing. One wording on every screen: "Ask the chair by Wed 3/25" (the day the notice must post, W1), "Kris is asking
// for Rick · by Fri 3/20" (a handed ask: its to-do's own day, 2 working days before the notice, V24), "Asked by Kevin Mon
// 3/16 · no reply yet" (chairask.js askLine, the record of W3), "Scheduled". A bill heard and not voted on waits for
// a vote (W33): "Ask the chair to schedule a vote" (C-15: one name for the act; the Capitol's "decision making" is in Help's
// Capitol words); not while it is still being heard (a sitting under three
// hours old with no outcome, BILL's 1:12 PM finding: the ask came two minutes after a 1:10 PM start). A joint committee
// with one chair asked asks the other by name ("Ask Sen. Keohokalole by Mon 3/23", V24). Never on a bill HIPHI opposes (W2).
const BEING_HEARD = 3 * HR;
export const beingHeard = st => !!st && st.hearingState === 'held' && !!st.hearing && Date.now() - ms(st.hearing.scheduled_at) < BEING_HEARD;
export function askWords(b, { viewer } = {}) {
  if (!b || !wantsHearing(b) || diedish(b) || SESSION_OVER) return null;
  const words = w => ({ toString() { return w; } });
  const ahead = hearingAhead(b);
  if (ahead) return { ...words('Scheduled'), key: 'scheduled', words: 'Scheduled', h: ahead, code: ahead.committee };
  const st = stopOf(b);
  if (st.phase !== 'committee' || st.column !== 'a' && st.hearingState !== 'held' || !st.committee || !st.deadline || st.deadline.missed) return null;
  if (beingHeard(st)) return null;
  const code = st.committee, aw = stopAsk(st), decide = st.hearingState === 'held';
  let m = chairMail(code);
  const a = chairAskOf(b, code);
  if (a && !a.partial) {
    const key = a.answer === 'said_no' ? 'said_no' : 'waiting', w = askLine(a);
    const quiet = ['asked', 'left_message'].includes(a.answer);
    // The clock runs from the newest word with the chair, so a follow-up email logged with "Did you send it?" starts it
    // again (the row still says who asked first, and when).
    const lastAt = ms(a.last?.created_at) ?? a.at;
    const followUp = quiet && (workingDays(lastAt, Date.now()) >= 3 || (!!aw && !aw.a.passed && workingDays(Date.now(), aw.a.at) <= 2));
    // One chair of a joint committee answered: the follow-up goes to the chair still to reply, by name (model.js waitOn).
    if (a.waitOn?.length) { const k = codesOf(code).find(c => a.waitOn.includes(chairIdsOf(c)[0])), pm = k && chairMail(k);
      if (pm) m = { ...pm, n: a.waitOn.length, legId: a.waitOn.length === 1 ? a.waitOn[0] : undefined }; }
    return { ...words(w), key, words: w, code, asker: a.by, at: a.at, lastAt, answer: a.answer, followUp, decide, st, m, aw, waitOn: a.waitOn || null };
  }
  // One chair of a joint committee asked: the ask is to the others, by name, and its email goes to them alone.
  let partial = null;
  if (a?.partial) { const k = codesOf(code).find(c => a.missing.includes(chairIdsOf(c)[0])), pm = k && chairMail(k);
    if (pm) { m = { ...pm, n: a.missing.length, legId: a.missing.length === 1 ? a.missing[0] : undefined }; partial = a; } }
  // A joint committee's ask goes to its chairs ("Ask the chairs by Fri 3/27", beside "Email the chairs": the critic's
  // HB 1563); a joint committee with one chair asked names the other.
  const chair = partial ? m.who : (m ? m.n > 1 : codesOf(code).length > 1) ? 'the chairs' : 'the chair';
  const t = askTodoOf(b);
  if (t && live(t.assignee_id)) {
    // A handed ask leads with its verb, as the ask itself does (C-10, V19): "Ask the chairs for Rick · by Mon 3/23" to the
    // asker, "Kris asks the chairs for you · by Mon 3/23" to the owner, "Kris asks the chairs for Rick" to the rest
    // ("You are asking for Rick" read as asking for Rick and named neither the chair nor the hearing).
    const v = meOf(viewer), mine = t.assignee_id === v?.id, owner = ownersOf(b).find(id => id !== t.assignee_id);
    const due = t.due_date ? ms(String(t.due_date).length === 10 ? t.due_date + 'T17:00:00-10:00' : t.due_date) : null;
    const day = due != null ? dayWords(due) : aw && !aw.a.passed ? aw.day : '';
    const forWhom = owner ? ` for ${owner === v?.id ? 'you' : firstWords(owner, v)}` : '';
    const w = `${mine ? 'Ask' : `${cap(firstWords(t.assignee_id, viewer))} asks`} ${chair}${forWhom}${day ? ` · by ${day}` : ''}`;
    return { ...words(w), key: 'giving', words: w, day, code, chair, who: t.assignee_id, todo: t, decide, st, m, aw, partial, by: due ?? aw?.a.at ?? null };
  }
  if (aw?.a.passed) { const w = `Notice time passed · only ${chair} can help now`; return { ...words(w), key: 'passed', words: w, code, chair, decide, st, m, aw, partial, by: aw.a.at }; }
  const day = aw ? aw.day : decide ? '' : dayWords(st.deadline.date);
  const w = decide ? `Ask ${chair} to schedule a vote${day ? ` by ${day}` : ''}` : `Ask ${chair} by ${day}`;
  return { ...words(w), key: 'ask', words: w, day, code, chair, decide, st, m, aw, partial, by: aw?.a.at ?? null };
}

// ---- a bill's current step (the model behind stepCard and billRow) ----
// The testimony that matters most: an open draft (or a set hearing with no draft yet) by its due time; else testimony
// missed today; else the testimony filed for the next sitting. A monitor bill's automatic draft is not a step until
// someone touches it (v5 Today). A draft whose sitting ended more than two days ago is history (the bill page keeps it).
const testDue = h => h && h.status !== 'cancelled' ? ms(h.testimony_deadline) ?? ms(h.scheduled_at) - DAY : null;
function testimonyStepOf(b) {
  const now = Date.now(), cands = [], mon = b.position === 'monitor';
  for (const d of S.drafts?.[b.id] || []) {
    if (d.status === 'cancelled' || notFiled(d, b)) continue;
    if (mon && !d.submitted_at && !d.review_note && d.status !== 'filed') continue;
    const h = draftHearing(d); if (!h) continue;
    const at = ms(h.scheduled_at), off = h.status === 'cancelled';
    if (d.status === 'filed') { if (!off && at > now - 12 * HR) cands.push({ d, h, rank: 3, at }); continue; }
    if (!off && at < now - 2 * DAY) continue;
    const started = !off && at <= now;
    cands.push({ d, h, rank: started ? 2 : 1, at: off ? Infinity : testDue(h) });
  }
  if (!mon && !S.failed?.('testimony drafts')) for (const h of S.hearings || []) {
    if (h.bill_id !== b.id || h.status === 'cancelled' || ms(h.scheduled_at) <= now) continue;
    if (!(S.drafts?.[b.id] || []).some(d => d.committee === h.committee && d.status !== 'cancelled')) cands.push({ d: null, h, rank: 1, at: testDue(h) });
  }
  cands.sort((x, y) => x.rank - y.rank || x.at - y.at);
  return cands[0] || null;
}
const KIND_OF = { write: d => !d ? 'nodraft' : d.review_note ? 'revise' : d.submitted_at ? 'submit' : 'write', approve: () => 'approve', second: () => 'second', file: () => 'file', filed: () => 'filed', missed: () => 'missed' };
// billStep(b, { viewer, d, h }) -> the step: { kind, b, d, h, state, whose, you, due, until, act, status, ask, line, others }
// kind: nodraft · write · submit · revise · approve · second · file · filed · missed · chair · none.
export function billStep(b, { viewer, d, h } = {}) {
  const v = meOf(viewer); if (!b) return null;
  let pick = d !== undefined || h !== undefined ? { d: d || null, h: h !== undefined ? h : d ? draftHearing(d) : null } : testimonyStepOf(b);
  if (pick && pick.d === null && !pick.h) pick = null;
  if (pick) {
    const st = testimonyState(pick.d, b, { h: pick.h });
    if (st) {
      const whose = whoseStep(pick.d, b, { viewer: v, h: pick.h }), kind = KIND_OF[st.key](pick.d);
      const off = pick.h?.status === 'cancelled', due = off ? null : testDue(pick.h);
      const step = { kind, b, d: pick.d, h: pick.h, state: st, whose, you: whose.you, nobody: whose.nobody, due, until: off ? null : ms(pick.h?.scheduled_at), off };
      return finishStep(step, v);
    }
  }
  const ask = askWords(b, { viewer: v });
  if (ask && ask.key !== 'scheduled') {
    const owners = ownersOf(b);
    const ids = ask.key === 'giving' ? [ask.who] : ask.key === 'waiting' || ask.key === 'said_no' ? uniq([live(ask.asker) ? ask.asker : null, ...owners]) : owners;
    const nobody = !ids.length && ask.key === 'ask';
    const whose = { key: 'chair', ids, words: nobody ? 'no one yet' : orWords(ids, v), you: !!v && ids.includes(v.id), nobody, anyone: nobody, role: 'ask' };
    const step = { kind: 'chair', b, d: null, h: null, state: null, ask, whose, you: whose.you, nobody, due: ask.key === 'ask' || ask.key === 'giving' ? ask.by : null, until: null };
    step.act = ask.key === 'ask' || ask.key === 'giving' ? { kind: 'due', at: ask.by, due: ask.by, verb: 'Ask the chair', time: ask.aw?.day || '', words: ask.words } : { kind: 'none', at: null, words: ask.words };
    return finishStep(step, v);
  }
  const says = whereWords(b);
  const step = { kind: 'none', b, d: null, h: ask?.h || null, state: null, whose: { ids: [], words: '', you: false }, you: false, due: null, until: null, says };
  step.act = actBy({}); step.status = status({}); step.line = says; step.mine = false;
  return step;
}
// The rest of a step, worked out once: its time to act, its status, whether its colour shows (`mine`: the step's own
// person, or the bill's owner), whether whoever may hand it sees it (`takeFor`), and the row's line.
function finishStep(step, v) {
  const b = step.b, now = Date.now();
  if (step.kind !== 'chair') step.act = actBy(step);
  step.status = step.kind === 'chair' && step.ask.key === 'passed' ? { tone: 'neutral', icon: 'circle-alert', words: step.ask.words, time: '', soon: false } : status(step);
  // The viewer's own hand-on time today is today's work, though the Capitol's deadline is tomorrow morning: a clock and
  // a bold line, as for anything due today (D3).
  // A hand-on time today is due today too (plain, its time bold; R-352); once it has passed with the Capitol's deadline
  // still ahead (actBy's 'now') it stays due today, never late.
  if (step.you && step.status.tone === 'neutral' && step.act?.at != null && step.act.at > now && (step.act.at - now <= 2 * HR || hday(step.act.at) === hday(now)))
    step.status = { ...step.status, tone: hday(step.act.at) === hday(now) ? 'today' : 'neutral', icon: 'clock', soon: true };
  if (step.you && step.act?.kind === 'now' && step.status.tone === 'neutral') step.status = { ...step.status, tone: 'today', icon: 'clock', soon: true };
  if (step.state?.key === 'filed') step.doneWords = `Filed${step.d.filed_by ? ` by ${firstWords(step.d.filed_by, v)}` : ''}${step.d.filed_at ? ` ${whenAt(step.d.filed_at)}` : ''}`;
  step.mine = step.you || (!!v && ownersOf(b).includes(v.id));
  step.takeFor = step.nobody && takeFor(b, v);
  step.line = rowLine(step, v);
  return step;
}
// The row's one line, two parts at most, so a row holds four facts with its name and number (spec 8, D15): the verb and
// when for the viewer's own step ("Send for approval by today 4:00 PM", the same words as the card's tile, V19, R-279:
// the step in plain words at the start); for someone else's, who does what, then when ("Kris or Nate approves it · due
// today 3:00 PM", spec 6's Testimony example; Bills, Today and Team say it so); and a step nobody holds says "No owner
// yet", as the bill page's header, Bills and the hearing page say it (one wording for the fact, C-15).
// Someone else's step in one phrase on every screen (rule 6, spec 8: one wording per state; the critic found three for a
// second look): "Kris or Nate approves it", "Second look from Jaylen or Jess" (Testimony's words, which lead with the state
// word, so a hearing card says it without repeating it), "Nate files it". othersWords is that phrase; rowLine adds when.
const VERB_OTHER = { nodraft: 'makes the draft', write: 'writes it', submit: 'sends it for approval', revise: 'revises it', approve: 'approves it',
  file: 'files it' };
export const NO_OWNER = 'No owner yet';
export function othersWords(s) {
  if (!s?.whose) return '';
  if (s.nobody) return NO_OWNER;
  if (s.kind === 'second') return `Second look from ${s.whose.words}`;
  return `${cap(s.whose.words)} ${VERB_OTHER[s.kind] || 'has it'}`;
}
function rowLine(s, v) {
  if (s.kind === 'chair') return chairLine(s, v);
  return statusLine(s);
}
// Decision 9 (Nate 31 Oct), C-10, C-14, C-15: THE status line of a testimony step, the same words on Today, Hearings, Issues,
// Bills, Testimony, Team and the issue page: "<state> · <flag, whose, and the one time, joined by commas>". The state is
// the step's own word (Writing, With an approver, Second look, Ready to file); the part after the dot holds, in this order,
// the flag ("sent back", "not started"), whose step it is when it is not the viewer's ("Kris or Nate approves it"), and the
// one time. Two pieces at most, so a row stays at four facts with its name and number (spec 8, A-14). Each time says whose it
// is (decision 9, spec 5): "by Wed 3/18, 7:30 AM (team cut-off)" is the team's, "due today 9:30 AM (Capitol)" the Capitol's,
// and never both on one row. Late and overdue keep their one word, amber and red only by shownStatus.
// Filed, missed, cancelled, chair asks and no step are said by their own record (s.line).
// `lateSaid`: the hearing card already says the late window once, so a late row says only "late" (toned) or nothing.
// `soon: false` leaves out ", in 59 min" (a small card). `flat`: one piece, a comma for the dot, for a row whose name already holds a dot (Today's "File testimony · Bill").
export function stepTime(s, { lateSaid = false, toned = false, soon = true } = {}) {
  const tone = s.status?.tone, a = s.act, now = Date.now(), ls = t => soon ? leftSoon(t) : '';
  if (tone === 'late') return lateSaid ? (toned ? 'late' : '') : lateLine(s.until, { lower: true });
  if (tone === 'overdue') return `was due ${whenAt(s.due)} (Capitol)`;
  if (a?.kind === 'hand' && a.at > now) return `by ${timeFirst(a.at)} (team cut-off)${ls(a.at)}`;
  if (s.due != null) return `due ${whenAt(s.due)} (Capitol)${ls(s.due)}`;
  return '';
}
export function stateWords(s) { const st = s.state; return st ? st.word : ''; }
export function whoWords(s) {
  if (s.you) return '';
  if (s.nobody) return NO_OWNER;
  if (s.kind === 'second') return `from ${s.whose.words}`;
  return `${cap(s.whose.words)} ${VERB_OTHER[s.kind] || 'has it'}`;
}
export function statusLine(s, { lateSaid = false, toned = false, flat = false, who = true, soon = true } = {}) {
  if (!s) return '';
  if (s.kind === 'chair' || s.kind === 'none' || !s.state) return s.line || '';
  const st = s.state;
  if (st.key === 'filed') return s.doneWords || s.line || '';
  if (st.key === 'missed') return `Missed · the hearing started ${whenAt(s.h.scheduled_at)}`;
  if (s.off) return `${st.word} · hearing cancelled, no new date yet`;
  const flag = st.sentBack ? 'sent back' : st.noDraft || s.kind === 'nodraft' ? 'not started' : '';
  const rest = [flag, who ? whoWords(s) : '', stepTime(s, { lateSaid, toned, soon })].filter(Boolean).join(', ');
  return rest ? `${st.word}${flat ? ', ' : ' · '}${rest}` : st.word;
}
const lc = w => w ? w[0].toLowerCase() + w.slice(1) : w;
// A chair ask's line: the asker's own Follow up after 3 working days with no reply (spec 6), whose first for someone
// else's ask ("Kevin asks the chair by Fri 3/27"; a joint committee's "the chairs"), and the record once asked ("Asked by
// Kevin Tue 3/10 · no reply yet").
function chairLine(s, v) {
  const a = s.ask, chair = a.m ? a.m.who : 'the chair', ask = a.chair || 'the chair';
  if ((a.key === 'waiting') && a.followUp && s.you) return `Follow up with ${chair} · asked ${dayWords(a.at)}, ${a.answer === 'left_message' ? 'left a message' : 'no reply'}`;
  if (a.key !== 'ask' || s.you) return a.words;
  const by = a.decide ? `to schedule a vote${a.day ? ` by ${a.day}` : ''}` : `by ${a.day}`;
  if (s.nobody) return `${NO_OWNER} · ask ${ask} ${by}`;
  return `${cap(s.whose.words)} ${s.whose.ids.length > 1 ? 'ask' : 'asks'} ${ask} ${by}`;
}
// A hearing card's line for one of its bills (spec 5: "each of our bills on it with its testimony state"; the people
// test: every card says where its testimony stands): the state first, then one more part, so the row keeps four facts.
// Same words, same order as the row on Today and Bills (spec 5, V19): the viewer's own step is the state, "you" and the
// row's own words ("Writing · you resubmit by today 4:00 PM", "Ready to file · you file now, due today 10:00 AM"; late,
// "With an approver · you approve, late, still accepted until 9:30 AM today": without the "you" it read as someone else's
// job, Kris's finding). Someone else's: the state and othersWords ("With an approver · Kris or Nate approves it", "Second
// look from Jaylen or Jess"), and when it is late or overdue, the time after the person ("Ready to file · Kevin files it,
// late, still accepted until 9:30 AM today"): on a hearing day those are the people to nudge, so the person is never
// dropped. The flags of Writing replace the who ("not started"; "sent back, due today 2:00 PM", the time Testimony says
// too); the card's own time says when the sitting is (A-14). Four facts: name, number, state, one more part (spec 8).
// `lateSaid`: the card says the late window once over its rows ("Late, still accepted until 9:30 AM today"), so a
// late row gives only its state and step ("With an approver · you approve", "Ready to file · Kevin files it"): Kris's
// 9:30 AM card said "late, still accepted until 9:30 AM today" on three rows under a heading that already said 9:30 AM
// (the fresh-eyes check, A-14). The viewer's own draft that came back carries the flag in its own lower-case words, as
// someone else's does ("Writing · sent back, you resubmit now"; spec 12.6), where Hearings had said only "Writing · you
// resubmit now" beside Today's and Testimony's Sent back. `toned`: the row is drawn in the late colour (the viewer's own,
// or a teammate's on their bill), so it keeps the one word "late" beside its colour (D3), never the time again.
// `button`: the row carries the viewer's own button (R-352, C-15): the button says the verb, so the line says the state and
// the time in status()'s one wording ("Ready to file · due today 10:00 AM, in 59 min", "Ready to file · late"); with no
// button the line keeps "you" and the verb, as Bills' rows keep "File now · ...".
export function hearingLine(s, { lateSaid = false, toned = false } = {}) {
  if (!s) return '';
  return statusLine(s, { lateSaid, toned });
}

// ---- the one step card (V07, V11, V22) ----
// One verb per step across the card's sentence, its tile, the row and the button (V19, rule 6): "Make the draft", "Send
// for approval", "Resubmit", "Approve", "File".
// Nate 10/26 (option E): where nothing else on the screen names the bill, the sentence does, "Ask for a hearing on
// Hygienists can place temporary fillings", the name a link to the bill. x is that name's placeholder (BILL_IN) or ''.
const on = x => x ? ` on ${x}` : '';
const SENT = { // the card's sentence, the viewer's own step
  nodraft: (s, v, x) => x ? `Make the testimony draft for ${x}` : 'Make the draft',
  write: (s, v, x) => x ? `Write the testimony on ${x}` : 'Write the testimony, then send it for approval',
  submit: (s, v, x) => x ? `Send the testimony on ${x} for approval` : 'Send the testimony for approval',
  // Says plainly that it came back, in the flag's own lower-case words (spec 12.6; a capitalised "Sent back" reads as a sixth
  // state): Patti's first screen said only "Revise and resubmit" over "The approver's note", and nothing said it was sent back.
  revise: (s, v, x) => x ? `Revise and resubmit the testimony on ${x}` : 'Revise and resubmit: it was sent back',
  approve: (s, v, x) => `Approve ${s.d?.submitted_by ? (s.d.submitted_by === v?.id ? 'your own' : `${cap(firstWords(s.d.submitted_by, v))}’s`) : 'the'} testimony${on(x)}`,
  second: (s, v, x) => `Give the second look to ${s.d?.submitted_by && s.d.submitted_by !== v?.id ? `${cap(firstWords(s.d.submitted_by, v))}’s` : 'the'} testimony${on(x)}`,
  file: (s, v, x) => `File the ${s.status.tone === 'late' ? 'late ' : ''}testimony${on(x)} at the Capitol`,
};
const OTHERS = { // someone else's step: who, then what
  nodraft: (w, x) => `${w} makes the draft${x ? ` for ${x}` : ''}`, write: (w, x) => `${w} writes the testimony${on(x)}`,
  submit: (w, x) => `${w} sends the testimony${on(x)} for approval`, revise: (w, x) => `${w} revises the testimony${on(x)}`,
  approve: (w, x) => `${w} approves the testimony${on(x)}`, second: (w, x) => `${w} gives the testimony${on(x)} its second look`,
  file: (w, x) => `${w} files the testimony${on(x)} at the Capitol`,
};
// The words over an approver's note (the step card, the hearing card's row, the Resubmit sheet): not a state word.
const NOTE_HEAD = 'The approver’s note';
const TRACK = [['write', 'Write'], ['approve', 'Approve'], ['second', 'Second look'], ['file', 'File']];
// The Write -> Approve -> File track: done steps ticked, the current one named for screen readers (aria-current="step").
// A quiet line, not tabs (V35: the v5 step bar read as tabs). The second look shows only when this bill needs one.
function trackHTML(s) {
  const d = s.d, key = s.state?.key; if (!key || key === 'missed') return '';
  const second = key === 'second' || !!d?.second_approved_by || !!d?.first_for_bill || (d && ['draft', 'review'].includes(d.status) && !Object.values(S.drafts || {}).flat().some(x => x.bill_id === d.bill_id && x.id !== d.id && (['approved', 'filed'].includes(x.status) || x.second_approved_at)));
  const steps = TRACK.filter(([k]) => k !== 'second' || second), order = steps.map(x => x[0]);
  // R-344 Rule 2 (C5): verbs.js testimonyTrack draws it: 20px dots, words beside every step (the done ones too: an icon-only
  // tick said nothing), one line, and a sent-back draft's own shape ("Revise").
  return testimonyTrack(s, { second });
}
const A = (act, s, extra = {}) => ({ 'data-v6act': act, 'data-v6b': s.b.id, ...(s.d ? { 'data-v6d': s.d.id } : {}), ...(s.h ? { 'data-v6h': s.h.id } : {}), ...extra });
// P1 (review mode reads the draft first): until its Doc has been opened here, an approval's filled button opens Review
// mode ("Review", the row's and the hearing card's word for the same act: C-15); once read, Approve approves in place. One route, so the row's Review and the card's button
// never do different things to one step.
const DOC_OPENED = new Set();
// The chair ask's email, with the hearing it follows when asking the chair to schedule a vote (W33).
// A joint committee with one chair already asked emails the other alone (V24; model.js remembers the chair, so "Did you
// send it?" records that chair's ask only).
const askMailOf = (s, o = {}) => { const a = s.ask; if (!a.m) return null;
  return chairAskMail(a.code, [s.b], { dl: a.st.deadline, ...(a.decide ? { heardAt: a.st.hearing?.scheduled_at || new Date().toISOString() } : {}),
    ...((a.partial || a.waitOn) && a.m.legId ? { to: { who: a.m.who, email: a.m.email, legId: a.m.legId, n: 1 } } : {}), ...o }); };
const telOf = ph => `tel:${String(ph).replace(/[^\d+]/g, '')}`;
// The buttons of the viewer's own step: the first is the filled one where the card holds the screen's one filled button
// (`primary`), else tonal; the rest tonal or text (spec section 4: at most 4 looks).
function stepButtons(s, v, primary) {
  const k = primary ? 'primary' : 'secondary', out = [], d = s.d;
  // Open Doc is a plain link beside the step's button everywhere (R-352 FIX-2, A-3 on v6: one tonal button per row).
  const doc = (kind = 'text') => d?.doc_url ? docBtn(d.doc_url, { kind, attrs: { 'data-v6doc': d.id } }) : '';
  switch (s.kind) {
    case 'nodraft': out.push(btn(S.draftAsked?.[s.h.id] ? 'Making the draft…' : 'Make the draft', { kind: k, icon: PIC.nodraft.btnIcon, attrs: A('draftnow', s) })); break;
    case 'write': case 'submit': out.push(btn('Send for approval', { kind: k, icon: 'send', attrs: A('submit', s) }), doc()); break;
    case 'revise': out.push(btn('Resubmit', { kind: k, icon: 'send', attrs: A('submit', s) }), doc()); break;
    case 'approve': case 'second': {
      const read = !d?.doc_url || DOC_OPENED.has(String(d.id));
      out.push(read ? btn('Approve', { kind: k, icon: PIC.approve.icon, attrs: A('approve', s) }) : btn('Review', { kind: k, icon: BTN_ICON.Review, href: `#/review/${encodeURIComponent(d.id)}` }),
        btn('Send back', { kind: 'secondary', icon: 'undo-2', attrs: A('sendback', s) }), doc('text'));
      break;
    }
    // File at the Capitol first, Mark filed after it (v5's order and the filing card's, V25): a newcomer files before
    // marking it filed. With the filing card in place (Testimony's setStepHook('file')), one File button opens it: the
    // PDF, the Capitol's page for this hearing, the form's answers, then Mark filed (V25; a bare link to the Capitol
    // skipped the PDF and the answers, and took a Today journey out of the app).
    case 'file': if (HOOKS.file) out.push(btn('File', { kind: k, icon: 'clipboard-check', attrs: A('filed', s, { 'aria-haspopup': 'dialog' }) }), doc('text'));
      else out.push(btn('File at the Capitol', { kind: k, iconEnd: 'external-link', href: capitolUrl(s.b), target: '_blank' }),
        btn('Mark filed', { kind: 'secondary', icon: 'clipboard-check', attrs: A('filed', s) }), doc('text')); break;
    case 'missed': out.push(btn('Yes, mark filed (late)', { kind: 'secondary', icon: 'clipboard-check', attrs: A('filed', s, { 'data-v6late': '1' }) }), btn('No, we didn’t file', { kind: 'text', attrs: A('nofile', s) }), btn('How did it go?', { kind: 'text', icon: 'message-square', href: `${billRoute(s.b, 'activity')}?reply=1` })); break;
    case 'chair': {
      const a = s.ask, m = a.m, to = m ? (m.n > 1 ? 'Email the chairs' : 'Email the chair') : '';
      const replied = kind => btn('They replied', { kind, icon: PIC.replied.icon, attrs: A('replied', s, { 'data-v6code': a.code, 'aria-haspopup': 'dialog' }) });
      if (a.key === 'ask') { const ml = askMailOf(s); if (ml) out.push(btn(to, { kind: k, icon: 'mail', href: ml.href }), btn('Give this ask to…', { kind: 'text', icon: 'user-round', attrs: A('giveask', s, { 'data-v6code': a.code, 'aria-haspopup': 'dialog' }) })); }
      else if (a.key === 'giving') { const ml = askMailOf(s); if (ml) out.push(btn(to, { kind: k, icon: 'mail', href: ml.href }), btn('Done, I asked', { kind: 'secondary', icon: STATES.chair.asked.icon, attrs: A('askdone', s, { 'data-v6code': a.code }) })); }
      // Spec 6: after 3 working days with no reply (or 2 before the notice) the asker follows up: the same approved email
      // again (its subject says it follows up), or a call to the office when the Capitol lists its number.
      else if (a.key === 'waiting' && a.followUp) {
        const ml = askMailOf(s, { followUp: true }), ph = phoneOf(a.code);
        if (ml) out.push(btn(`${to} again`, { kind: k, icon: 'mail', href: ml.href }));
        if (ph) out.push(btn('Call the office', { kind: ml ? 'secondary' : k, icon: 'phone', href: telOf(ph) }));
        out.push(replied('secondary'));
      } else if (a.key === 'waiting' || a.key === 'said_no') out.push(replied('secondary'));
      break;
    }
    // F37: Undo filed only while the hearing is still ahead (after it, the filing is the record).
    case 'filed': if (mayUnfile(d, s.b) && (!s.h || s.h.status === 'cancelled' || ms(s.h.scheduled_at) > Date.now())) out.push(btn('Undo filed', { kind: 'text', icon: 'undo-2', attrs: A('unfile', s) })); break;
  }
  return out.filter(Boolean).join('');
}
// A step nobody holds: "No owner yet" beside Take it (tonal, never the screen's filled button), and Give to… for whoever
// may hand it (R-330); read-only (Team), the words alone. The same line as a bill with no owner (noOwnerHTML).
const nobodyHTML = (s, ro) => `<p class="v6-step-noown">${icon('user-round')}<span>${esc(NO_OWNER)}</span>${ro ? '' : btn('Take it', { kind: 'secondary', sm: true, attrs: { 'data-v6act': 'take', 'data-v6b': s.b.id } })
  + (s.takeFor ? btn('Give to…', { kind: 'text', sm: true, attrs: { 'data-v6act': 'giveto', 'data-v6b': s.b.id, 'aria-haspopup': 'dialog' } }) : '')}</p>`;
// The hearing line under a testimony step: committee in words, day, time and room, who is going, and the I'm going
// toggle, opening the sitting's page. "Moved from Mon 3/9" for 3 days after a sitting moved (W24); a cancelled sitting
// with no new date says only that. `from` is where the hearing page's Back returns to.
// The committee's name is in regular weight (the card's sentence is its one bold line: spec 4, at most a quarter bold;
// BILL measured this name as the bill page's largest bold run). `going: false` leaves the going row out (Today's
// next-step card and Testimony's filing card say it elsewhere).
function hearingLineHTML(h, v, from, { going = true } = {}) {
  if (!h) return '';
  const name = committeeName(h.committee) || h.committee, href = `#/hearing/${encodeURIComponent(h.id)}${from ? `?from=${encodeURIComponent(from)}` : ''}`;
  if (h.status === 'cancelled') return `<div class="v6-step-hear"><a class="v6-step-hl" href="${esc(href)}">${icon('gavel')}<span><span class="v6-step-cn">${esc(name)}</span> · hearing cancelled, no new date yet</span>${icon('chevron-right', { cls: 'v6-chev' })}</a></div>`;
  const past = ms(h.scheduled_at) <= Date.now(), moved = movedFrom(h), lead = leadRow(h), on = goingOn(h, v);
  return `<div class="v6-step-hear"><a class="v6-step-hl" href="${esc(href)}">${icon('gavel')}<span><span class="v6-step-cn">${esc(name)}</span> · ${nw(esc(whenAt(h.scheduled_at)))}${h.room ? ` · ${nw(esc(roomName(h.room)))}` : ''}${moved ? ` · moved from ${nw(esc(moved))}` : ''}</span>${icon('chevron-right', { cls: 'v6-chev' })}</a>
    ${going ? `<p class="v6-step-go">${goingPic(h)}<span>${esc(goingWords(h, { viewer: v }))}</span>${past ? '' : goingBtn(on, { 'data-v6act': 'going', 'data-v6h': lead.id }, { kind: 'secondary', sm: true })}</p>` : ''}</div>`;
}
// stepCard(b, { viewer, where, d, h, primary, big, id, from, named, compact, track, who, going, acts, title, lead, hear })
//   -> the card for a bill's current step.
//   where: 'today' (the next-step card), 'pane' (the open item), 'bill', 'hearing' (no hearing line: the page is it),
//          'testimony', 'team' (read-only: no buttons for anyone).
//   primary: false when another filled button owns the screen (spec section 4: one filled per screen or region).
//   from: the hearing page's Back ('today', 'bills', 'week', a bill number; default by `where`: a bill page passes its
//         number, the open item 'today').
//   named: the bill's name on the card (default: on Today, Testimony, Team and a hearing, where nothing else names it;
//          openItem's h2 names it in the pane, the bill page's title on the bill).
//   compact: Today's next-step card, which leaves the Write -> Approve -> File track, "You file it once it is approved"
//          and the going row to the open item and the bill (V01: <=12 controls on the first screen). Or each alone:
//          track: false, who: false, going: false.
//   acts:  HTML that takes the place of the card's buttons (Testimony's filing card: its four steps; '' for none).
//   title: the card's sentence in other words (Testimony's answered Missed card: "Not filed before the hearing").
//   lead:  a short word that leads the card's top line ("Your step" on the bill page, where the tab says Next step).
// The viewer's own step gets its buttons; someone else's gets its status line and no button ("Nate files the testimony
// at the Capitol"); a step nobody holds says so, with Take it. Same words, same order everywhere (V07). The tile at the
// top carries the one time to act (or, for someone else's step, where it stands); the lines under the sentence never say
// it again (A-14). The viewer's own step whose bill has a deadline alert they have not read shows a small quiet dot and
// who sent what, where ("We alerted you in Slack at 8:00 AM"), until the step is done (F49, V26: alerts live on the step,
// not in the Inbox; C-15 says "alert", never "reminder").
// The bill's issue, a quiet link on the card's top line (R-226: the way from a bill to its issue is always clear): "Its
// issue" when it shares the bill's name, else the issue's own name; at most two.
const sameIssueName = (i, b) => (i.name || '').trim().toLowerCase() === (b?.nickname || '').trim().toLowerCase();
export const issueLinksHTML = b => (b?.id ? issuesOfBill(b.id).slice(0, 2) : []).map(i => `<a class="v6-step-iss" href="${esc(issueLinkHref(i, b))}" aria-label="Issue: ${esc(i.name)}. Open it">${icon(issueIcon(i))}<span>${sameIssueName(i, b) ? 'Its issue' : esc(i.name)}</span></a>`).join('');
const BILL_IN = '\u0001bill\u0001';
// The bill's name inside the sentence: the app's in-sentence link (the bill page's chair name, bill.css .bw-chairl): the
// action colour, underlined at rest (A-12, B-9). It keeps the sentence's size and weight, so the card has one heading.
// R-352: its number follows small, as on every row ("Disposable e-cigarette ban HB 2121"), now that no quiet line over the
// sentence carries it: two bills can share a name (HB 2121 and SB 2175), and the number tells them apart.
export const billNumHTML = b => fullName(b) === numWords(b) ? "" : ` <span class="v6-step-num">${esc(numWords(b))}</span>`;
const billInHTML = b => `<a class="v6-step-in" href="${esc(billRoute(b))}">${esc(fullName(b))}</a>${billNumHTML(b)}`;
// The chair's name opens their page, wherever the card names them (R-316 W18 did it on the bill page only; option E moves
// the chair to a line of its own, so the link moves with it and now works on Today, Testimony and Team too). Same words
// chairAskMail writes ("Sen. San Buenaventura"), so the name is found in the line.
// The head of a card that is not a bill step (Today's small cards, partner words) in the same shape (option E): the quiet
// line (kind · number · issue) and the sentence, its {bill} the bill's name as the in-sentence link. No bill: the
// sentence alone, under the kind.
// R-352 (A-18 on v6, B-2): no job tile at the head (the filled button below carries the job's icon), and where the sentence
// already names the bill as its link (with its number small after it), no quiet line at all: "Testimony · SB 3076 · Its
// issue" over a sentence naming the bill made the card a line taller and pushed Kevin's Email the chair off his first screen. The bill's page, one tap on the
// name, has its number and issue.
export function stepHeadHTML(b, { kind = '', sentence = '', id = '' } = {}) {
  const named = !!b && sentence.includes('{bill}');
  const top = named ? '' : [kind ? esc(kind) : '', b ? `<span class="v6-row-num">${esc(numWords(b))}</span>` : '', b ? issueLinksHTML(b) : ''].filter(Boolean).join('<span class="v6-sep" aria-hidden="true"> · </span>');
  const said = nw(esc(sentence)).split('{bill}').join(b ? billInHTML(b) : '');
  return `${top ? `<p class="v6-step-eyebrow v6-step-eyeb">${top}</p>` : ''}<h3 class="v6-step-what"${id ? ` id="${esc(id)}"` : ''}>${said}</h3>`;
}
export function linkChairs(b, html, code) {
  if (!code || !html) return html;
  let out = html;
  for (const k of codesOf(code)) {
    const c = S.committees?.[k], m = (S.committeeMembers || []).find(y => y.committee === k && y.role === 'chair');
    const l = m && (S.legislators || []).find(y => y.id === m.legislator_id); if (!c || !l) continue;
    const sur = l.sort_name ? l.sort_name.split(',')[0] : String(c.chair || '').replace(/\s*(jr\.?|sr\.?|ii|iii|iv)$/i, '').trim().split(/\s+/).pop();
    const name = esc(`${c.chamber === 'S' ? 'Sen.' : 'Rep.'} ${sur}`);
    if (out.includes(`>${name}</a>`)) continue;
    out = out.replace(name, `<a class="v6-step-in" href="#/legislator/${esc(l.id)}?from=${esc(billRef(b))}">${name}</a>`);
  }
  return out;
}
export function stepCard(b, { viewer, where = 'pane', d, h, primary = true, big = false, id = '', from, named, compact = false, track, who, going, acts: actsHTML, title, lead = '', hear: hearOn = true } = {}) {
  const v = meOf(viewer), s = billStep(b, { viewer: v, ...(d !== undefined ? { d } : {}), ...(h !== undefined ? { h } : {}) }); if (!s) return '';
  const ro = where === 'team', own = s.you && !ro, hid = id || `v6s-${esc(b.id)}${s.d ? '-' + esc(s.d.id) : ''}`;
  const showName = named ?? ['today', 'testimony', 'team', 'hearing'].includes(where);
  const showTrack = track ?? !compact, showWho = who ?? !compact, showGoing = going ?? !compact;
  // Option E (Nate 10/26): where nothing else names the bill, its name is inside the sentence, as a link (BILL_IN, swapped
  // for the link after the sentence is escaped); the line above says what kind of step, the number and its issue.
  const x = showName ? BILL_IN : '';
  const c = s.kind === 'chair' ? chairCard(s, v, own, x) : s.kind === 'none' ? (x ? { what: x, when: s.says || 'Nothing to do on it now' } : { what: s.says || 'Nothing to do on it now' }) : testimonyCard(s, v, own, x);
  if (title) c.what = x && !title.includes(BILL_IN) ? `${title}: ${x}` : title;
  // The committee is named once: by the hearing line under a testimony step, by the chair's line (named) or this small line
  // (the bill page, the open item) on a chair ask.
  const kindW = s.kind === 'chair' ? (s.ask.decide ? 'Getting a vote' : 'Getting a hearing') : s.kind === 'none' ? 'Where it stands' : 'Testimony';
  const eye = x ? '' : s.kind === 'chair' ? `${kindW}${s.ask.code ? ' · ' + committeeName(s.ask.code) : ''}` : s.kind === 'none' ? kindW : '';
  // R-352 (B-2, A-14): where the sentence names the bill (x, its number small after the link), no quiet line over it:
  // "Testimony · SB 3076 · Its issue" said again what the sentence and its link say, and made Today's card a line taller. The bill's page has its number and issue.
  // No job tile either (A-18 on v6): the filled button carries the job's icon.
  const eyebrow = x ? '' : [lead ? `<span class="v6-step-lead">${esc(lead)}</span>` : '', eye ? esc(eye) : ''].filter(Boolean).join(' · ');
  const say = t => nw(esc(t)).split(BILL_IN).join(billInHTML(b));
  const chairH = c.chairLine ? linkChairs(b, say(c.chairLine), s.ask?.code) : '';
  // Someone else's step: Open Doc for everyone, and where the step is done (the open item, the bill) a teammate who may
  // approve covers it (File it for Kevin, Resubmit for Lauren: v5 kept both). The viewer's shared writing step: Message
  // the other writer, to say "I've got it" (v5's "Message Lauren").
  const more = actsHTML != null || ro ? { html: '' } : own ? { html: sharedMsg(s, v, where) } : coverButtons(s, v, where);
  const acts = actsHTML != null ? actsHTML : iconizeButtons((own || (s.kind === 'filed' && !ro) ? stepButtons(s, v, primary) : '') + more.html);
  if (more.who) c.who = more.who;
  const back = from ?? (where === 'bill' ? b.bill_number : where === 'pane' ? 'today' : where);
  // hear: false leaves the hearing line out (the bill page's own hearing card in its right column says it, R-346).
  const hear = !hearOn || where === 'hearing' || s.kind === 'chair' ? '' : hearingLineHTML(s.h, v, back, { going: showGoing });
  const rem = own ? reminderHTML(s) : '';
  // Who sent the draft and who else may act on it: said on every card, Today's compact one too (its own class: Today hides
  // .v6-step-who), so the bill's owner and a stand-in know whose draft it is without opening Review (v5's card said it).
  const sent = sentWords(s, v);
  const fit = actsHTML == null ? actsFit(acts) : '';
  return `<section class="v6-step ${own ? 'own' : 'others'} k-${esc(s.kind)}${big ? ' big' : ''}${s.kind === 'missed' ? ' closing' : ''}${showName ? ' named' : ''} w-${esc(where)}" data-v6step="${esc(b.id)}" aria-labelledby="${hid}">
    ${eyebrow ? `<p class="v6-step-eyebrow">${eyebrow}</p>` : ''}
    <h3 class="v6-step-what" id="${hid}">${say(c.what)}</h3>
    ${chairH ? `<p class="v6-step-chair">${chairH}</p>` : ''}
    ${c.tile?.words || c.when || rem ? `<div class="v6-step-meta">${[statusTile(c.tile), rem, c.when ? `<span class="v6-step-when">${s.kind === 'chair' && x ? linkChairs(b, say(c.when), s.ask?.code) : say(c.when)}</span>` : ''].filter(Boolean).join(' ')}</div>` : ''}
    ${sent ? `<p class="v6-step-sent">${nw(esc(sent))}</p>` : ''}
    ${s.kind === 'chair' || s.kind === 'none' || !showTrack ? '' : trackHTML(s)}${c.note || ''}
    ${c.who && showWho ? `<p class="v6-step-who">${nw(esc(c.who))}</p>` : ''}
    ${acts ? `<div class="v6-step-acts${fit ? ' v6-fit' : ''}"${fit ? ` style="--v6-fit:${fit}px"` : ''}>${acts}</div>` : ''}
    ${s.nobody ? nobodyHTML(s, ro) : noOwnerHTML(b, v, ro)}${hear}
  </section>`;
}
// The width a card's buttons need on one line, about (Lato 16, the buttons' padding, icons and gaps; a little over, never
// under): below it they all stack, full width, so a row never leaves one button alone on a line of its own (A-8: "Open
// Doc" dropped alone under Review and Send back at 1280). '' for a single button, which needs no rule.
function actsFit(html) {
  const btns = String(html).match(/<(?:a|button)\b[^>]*class="btn[\s\S]*?<\/(?:a|button)>/g) || [];
  if (btns.length < 2) return '';
  const w = btns.reduce((n, x) => { const label = (x.match(/<span>([^<]*)<\/span>/) || ['', ''])[1].replace(/&[a-z#0-9]+;/gi, 'x');
    return n + Math.ceil(label.length * 8.6) + 40 + (x.match(/<svg/g) || []).length * 28; }, 0);
  return Math.round(w + 12 * (btns.length - 1));
}
// Who may cover a teammate's filing or resubmit (v5 let them): an approver, a second approver or an admin.
const covers = v => { const a = v && (advocate(v.id) || v); return !!a && a.is_active !== false && (!!a.is_admin || !!a.can_approve || !!a.is_reviewer); };
// A sent-back draft may also be resubmitted by the bill's coalition helpers and its owners (v5's bill page let anyone on
// the bill press Resubmit; keep every feature, rule 9): Patti can resubmit Lauren's HEAL draft when Lauren is out.
const coversRevise = (v, b) => covers(v) || (!!v && (helpersOf(b).includes(v.id) || ownersOf(b).includes(v.id)));
// Someone else's step on the card: Open Doc (a text button: the draft is not the viewer's to change), and, in the open item
// and on the bill only (spec 11.1: a step's buttons live where it is done), File it for <the filer> and Resubmit for <the
// writer> for whoever covers (Resubmit: a coalition helper or owner of the bill too). Both are the filer's and the writer's own acts (the same filing card and Mark filed; the
// same Resubmit, sent at once, with Undo and the who's-next toast). The database makes whoever resubmits its sender, so
// its filer: the line before Resubmit says so ({ who }).
function coverButtons(s, v, where) {
  const out = [], d = s.d; let who = '';
  if (!d || !s.state || s.you || s.nobody || !s.b) return { html: '' };
  const home = ['pane', 'bill', 'testimony'].includes(where), first = id => cap(firstWords(id, v)), mate = (s.whose.ids || []).find(id => id !== v?.id);
  if (home && mate && covers(v) && s.kind === 'file')
    out.push(btn(`File it for ${first(mate)}`, { kind: 'secondary', icon: 'clipboard-check', attrs: A('filed', s, { 'aria-haspopup': 'dialog' }) }));
  // Two writers share it ("Patti or Lauren revises the testimony", said once in the card's sentence): the button and the
  // line say no one name (R-352 FIX-2: "Resubmit for Patti" under "Patti or Lauren" named the writer twice, differently).
  const mates = (s.whose.ids || []).filter(id => id !== v?.id), forW = mates.length === 1 ? ` for ${first(mate)}` : '';
  if (home && mate && coversRevise(v, s.b) && s.kind === 'revise' && d.status === 'draft') {
    out.push(btn(`Resubmit${forW}`, { kind: 'secondary', icon: 'send', attrs: A('submit', s) }));
    who = `If you resubmit it${forW}, you file it once it is approved.`;
  }
  if (d.doc_url && s.state.key !== 'filed') out.push(docBtn(d.doc_url, { kind: 'text', attrs: { 'data-v6doc': d.id } }));
  return { html: out.join(''), who };
}
// The viewer's writing step that another writer shares ("Shared with Lauren: whoever does it first", Today): a text
// button opens the bill's Team talk with them @-named, to say "I've got it" (Testimony's "Message Kevin" does the same).
function sharedMsg(s, v, where) {
  const wh = s.whose; if (!wh || wh.role !== 'write' || ['hearing', 'team'].includes(where)) return '';
  const to = (wh.ids || []).filter(id => id && id !== v?.id && advocate(id));
  if (!to.length) return '';
  const ini = to.map(id => advocate(id)?.initials).filter(Boolean).join(',');
  return btn(`Message ${orWords(to, v, { and: true })}`, { kind: 'text', icon: 'message-square', href: `${billRoute(s.b, 'activity')}?mention=${encodeURIComponent(ini)}` });
}
// "Patti sent it today 6:00 AM" on With an approver, with who else may give the approval when it is the viewer's own
// ("· Jess or Nate can approve it too"; a second approver standing in, "· you’re standing in for Kris or Nate"); a second
// look says who approved it ("Kris approved it today 7:00 AM · Jaylen can give it too"). Someone else's card names who
// approves in its sentence already, so its line is who sent it (A-14). model.js approverWords and draftWho say the same.
function sentWords(s, v) {
  const d = s.d; if (!d || !['approve', 'second'].includes(s.kind)) return '';
  const name = id => id === v?.id ? 'You' : cap(firstWords(id, v));
  const others = (s.whose.ids || []).filter(id => id !== v?.id);
  if (s.kind === 'approve') {
    const by = d.submitted_by ? `${name(d.submitted_by)} sent it${d.submitted_at ? ' ' + whenAt(d.submitted_at) : ''}` : '';
    let rest = '';
    if (s.you) {
      const me = advocate(v.id) || v;
      if (standingIn(me, s.h)) { const main = others.filter(id => { const a = advocate(id); return a && (a.is_admin || a.can_approve); });
        rest = main.length ? `you’re standing in for ${orWords(main, v)}` : 'you’re standing in'; }
      else if (others.length) rest = `${orWords(others, v)} can approve it too`;
    }
    return [by, rest].filter(Boolean).join(' · ');
  }
  const by = d.approved_by ? `${name(d.approved_by)} approved it${d.approved_at ? ' ' + whenAt(d.approved_at) : ''}` : '';
  return [by, s.you && others.length ? `${orWords(others, v)} can give it too` : ''].filter(Boolean).join(' · ');
}
// F49 (V26): the deadline reminders the tracker sent the viewer about this step (Inbox items of kind 'deadline' on this
// bill, for this draft's committee), unread. The Inbox no longer lists them; they are cleared when the step is done.
export function remindersOf(b, d) {
  if (!b) return [];
  return (S.inbox || []).filter(i => i && i.kind === 'deadline' && i.unread && i.bill_id === b.id
    && (!d || i.key === 'n:dl' + d.id || !/^n:dl/.test(String(i.key || '')) && (!d.committee || !i.title || String(i.title).includes(d.committee))));
}
// The dot is muted, not the action colour (A-5: nothing on it can be pressed), and its words say who alerted whom, where
// and when (the critic: "Reminder sent" read as a reminder to the approver, or one Lauren had sent). Deadline alerts go
// only by Slack DM (queue_deadline_reminders; My settings says so).
export function alertWords(b, d) {
  const at = remindersOf(b, d).map(i => ms(i.at)).filter(t => t != null && !Number.isNaN(t)).sort((x, y) => y - x)[0];
  if (!remindersOf(b, d).length) return '';
  return `We alerted you in Slack${at == null ? '' : hday(at) === hday(Date.now()) ? ` at ${timeWords(at)}` : ` ${whenAt(at)}`}`;
}
const reminderHTML = s => { if (!s.state || ['filed', 'missed'].includes(s.state.key)) return ''; const w = alertWords(s.b, s.d);
  return w ? `<span class="v6-step-rem"><span class="v6-dot" aria-hidden="true"></span><span>${nw(esc(w))}</span></span>` : ''; };
// A step done (sent, approved, filed, or answered "we didn’t file") takes its reminders with it (V26); filing.js calls it
// after its own Mark filed.
export function clearReminders(b, d) {
  const keys = remindersOf(b, d).map(i => i.key).filter(Boolean);
  if (keys.length && DB.inboxMark) DB.inboxMark(keys).catch(() => { /* the dot stays until the next load */ });
}
// A testimony step's words. Own: the tile is the time to act ("Send for approval by today 4:00 PM"), with the Capitol's
// deadline under the sentence when the hand-on time is earlier. Someone else's: the tile is the state ("With an
// approver"), the sentence who does it, the line when testimony is due. Late is amber and overdue red only for the
// step's own person and the bill's owner (shownStatus); anyone else reads the same words, neutral, with the clock.
function testimonyCard(s, v, own, x = '') {
  const st = s.state, shown = shownStatus(s);
  // Said once (A-14): the sentence says what happened, the leaf tile who filed it and when.
  if (st.key === 'filed') return { tile: { ...s.status, words: s.doneWords }, what: `The testimony${on(x)} is filed` };
  if (st.key === 'missed') return { tile: s.status, what: own ? `The hearing${on(x)} has started. Did we file?` : x ? `The testimony on ${x} was not filed before the hearing` : 'Not filed before the hearing',
    when: `The hearing started ${whenAt(s.h.scheduled_at)}.` };
  // Decision 9: the tile is statusLine's words (state, flag, the one time and whose it is), as every row says them; the
  // sentence beside it says who. Colour only from shownStatus (amber late, red overdue, the viewer's own).
  const words = statusLine(s, { who: false });
  const tile = ['late', 'overdue'].includes(s.status.tone) ? { ...shown, words }
    : own ? (words ? { tone: s.status.tone === 'today' ? 'today' : 'neutral', icon: 'clock', words } : null)
    : { tone: 'neutral', icon: '', words };
  // A step nobody holds is titled with the step itself ("File the testimony at the Capitol"); "No owner yet" sits beside
  // Take it, in the bill header's words (the critic: a card titled "No owner" under a header saying "No owner yet").
  const what = own || s.nobody ? SENT[s.kind](s, v, x) : OTHERS[s.kind](cap(s.whose.words), x);
  let when = '';
  if (s.off) when = 'The hearing was cancelled; no new date yet.';
  // R-344 Rule 3, one time per step: the tile says the team's time to act ("File by today 7:30 AM"); this line says whose the
  // other time is, the Capitol's, so the two never read as two deadlines for one step.
  // With the time left, as every other time on the screen (R-352 FIX-2: "today 9:30 AM, in 1 hour").
  else if (s.due != null && (own ? s.act.kind === 'hand' : s.status.tone !== 'late')) when = `The Capitol’s deadline: ${whenAt(s.due)}${s.due > Date.now() ? `, in ${spanOf(s.due)}` : ''}.`;
  let note = '';
  // Headed with words that are not a state: a capitalised "Sent back" over the note read as a sixth state beside the tile's
  // "Writing · sent back" (spec 12.6: "sent back", lower case, is the flag on Writing; C-15).
  if (st.sentBack) note = `<blockquote class="v6-step-note"><span class="v6-step-nl">${NOTE_HEAD}</span>${esc(s.d.review_note)}</blockquote>`;
  if (st.stale && st.key === 'write') note += `<p class="v6-step-warn">${icon('triangle-alert')}<span>The bill is now ${esc(versionWords(s.b.current_version))}: check the testimony before it goes out.</span></p>`;
  return { tile, what, when, note, who: filerWords(s.d, s.b, v, own) };
}
// A chair ask's words: "Ask Rep. Takayama for a hearing" with the notice day as the tile; once asked, "Kevin asked Rep.
// Takayama for a hearing" with the reply as the tile; and the asker's own Follow up after 3 working days with no reply
// (or 2 before the notice), with the office's phone when the Capitol lists it (V13, spec 6).
function chairCard(s, v, own, x = '') {
  const a = s.ask, chair = a.m ? a.m.who : 'the chair', what0 = a.decide ? 'to schedule a vote' : 'for a hearing';
  if (a.key === 'waiting' || a.key === 'said_no') {
    const reply = askReply(a), ph = phoneOf(a.code), asker = cap(firstWords(a.asker, v));
    const tile = { tone: 'neutral', icon: STATES.chair[chairKey(a)].icon, words: cap(reply) };   // the chair-ask set's shapes (R-344 Rule 2)
    const again = a.lastAt && hday(a.lastAt) !== hday(a.at) ? `, then again ${dayWords(a.lastAt)}` : '';
    if (a.followUp && own) return x ? { tile, what: `Follow up on the ${a.decide ? 'vote' : 'hearing'} ask for ${x}`,
      when: `${asker} asked ${chair} ${dayWords(a.at)}${again}.${ph ? ` Their office: ${ph}.` : ''}` }
      : { tile, what: `Follow up with ${chair}`, when: `${asker} asked ${dayWords(a.at)}${again}.${ph ? ` Their office: ${ph}.` : ''}` };
    return x ? { tile, what: `${asker} asked ${what0}${on(x)}`, when: `Asked ${chair} ${dayWords(a.at)}.` }
      : { tile, what: `${asker} asked ${chair} ${what0}`, when: `On ${dayWords(a.at)}.` };
  }
  if (a.key === 'passed') return { tile: { tone: 'neutral', icon: 'circle-alert', words: 'Notice time passed' },
    what: x ? `Only ${chair} can still ${a.decide ? 'schedule a vote on' : 'give a hearing to'} ${x}` : `Only ${chair} can help now`,
    when: cap(deadlineWords(a.st.deadline.label, a.st.deadline.date)) + '.' };
  const due = shownStatus({ status: status({ due: a.by }), mine: s.mine });
  const calm = ['neutral', 'today'].includes(due.tone);
  const tile = { ...due, icon: calm ? 'clock' : due.icon, words: calm ? `Ask by ${a.day || a.aw?.day || dayWords(a.st.deadline.date)}` : due.words };
  const who = cap(s.whose.words), n = s.whose.ids.length;
  // The step itself for the asker and for a step nobody holds ("No owner yet" sits beside Take it); someone else's, who
  // asks: the same verb as the row, handed or not ("Kris asks Sen. DeCoite and Sen. Keohokalole for a hearing", V19).
  // Named (option E): the sentence is the ask and the bill, "Ask for a hearing on <bill>", and the chair has a line of its
  // own under it, "Ask Sen. San Buenaventura, chair of Senate Health and Human Services." (next to Email the chair).
  const what = x ? (own || s.nobody ? `Ask ${what0}${on(x)}` : `${who} ${n > 1 ? 'ask' : 'asks'} ${what0}${on(x)}`)
    : own || s.nobody ? `Ask ${chair} ${what0}` : `${who} ${n > 1 ? 'ask' : 'asks'} ${chair} ${what0}`;
  const chairs = / and /.test(chair), cn = a.code ? committeeName(a.code) : '';
  const chairLine = x ? `${own || s.nobody ? 'Ask ' : ''}${chair}${cn ? `, ${chairs ? 'chairs' : 'chair'} of ${cn}` : ''}.` : '';
  // When the tile already says the day to ask by, the sentence says only what the day is for (A-14: the date was said
  // twice in 100px, HB1991): "It must reach its last committee by Mon 3/30."
  const askDay = calm, must = deadlineWords(a.st.deadline.label, a.st.deadline.date);
  const when = askDay ? (/^must /.test(must) ? `It ${must}.` : cap(must) + '.')
    : a.aw?.a.notice ? `The notice has to post by ${dayWords(a.aw.a.notice)} for it to ${gateNeed(a.st.deadline.label, 1)} by ${dayWords(a.st.deadline.date)}.` : cap(must) + '.';
  return { tile, what, when, chairLine };
}
const phoneOf = code => { const id = chairIdsOf(code)[0], l = id && legById(id); return l?.phone || ''; };
// R-346 (Today's rows lead with the job, option E): the step card's own words for a step, so a row says exactly what its
// card says. -> { kind, sentence, chair } with '{bill}' where the bill's name goes (stepHeadHTML's placeholder), the kind
// word the card's quiet line uses, and a chair ask's chair line ("Ask Sen. X, chair of Y."), or null for no step.
export function stepSentence(b, s, viewer) {
  if (!b || !s || s.kind === 'none') return null;
  const v = meOf(viewer), own = !!s.you;
  const c = s.kind === 'chair' ? chairCard(s, v, own, BILL_IN) : testimonyCard(s, v, own, BILL_IN);
  const un = t => String(t || '').split(BILL_IN).join('{bill}');
  return { kind: s.kind === 'chair' ? (s.ask.decide ? 'Getting a vote' : 'Getting a hearing') : 'Testimony', sentence: un(c.what), chair: un(c.chairLine || '') };
}
// A live bill with a position and no owner, whose current step someone does hold (Patti writes it), says so with Take it
// (R-330, W42); Give to… for admins and its issue's owner. A step nobody holds says it once, on the card itself.
function noOwnerHTML(b, v, ro) {
  if (ro || !v || ownersOf(b).length || !b.position || b.position === 'monitor' || b.tracked === false || diedish(b)) return '';
  const io = issueOwnerOf(b), give = v.is_admin || io === v.id;
  return `<p class="v6-step-noown">${icon('user-round')}<span>${esc(io ? `${NO_OWNER} · ${io === v.id ? 'you own' : cap(firstWords(io, v)) + ' owns'} its issue` : NO_OWNER)}</span>${btn('Take it', { kind: 'secondary', sm: true, attrs: { 'data-v6act': 'take', 'data-v6b': b.id } })}${give ? btn('Give to…', { kind: 'text', sm: true, attrs: { 'data-v6act': 'giveto', 'data-v6b': b.id, 'aria-haspopup': 'dialog' } }) : ''}</p>`;
}

// The bill's owner in the open item (Bills' panel, the quick look): "Lauren owns it", with Change owner for an admin and the
// owner of the bill's issue (who may hand a bill, R-330), so changing an owner takes no trip to the bill (A-24, B-6). A bill
// with no owner says so on its card already (Take it, Give to…), so this says nothing for it.
export function ownerLine(b, { viewer } = {}) {
  const v = meOf(viewer), owners = b ? ownersOf(b) : []; if (!owners.length) return '';
  const words = owners.length === 1 ? (owners[0] === v?.id ? 'You own it' : `${cap(firstWords(owners[0], v))} owns it`) : `${cap(orWords(owners, v, { and: true }))} own it`;
  const may = !!v && (!!v.is_admin || issueOwnerOf(b) === v.id);
  return `<p class="v6-item-owner">${icon('user-round')}<span>${esc(words)}</span>${may ? btn('Change owner', { kind: 'text', sm: true, attrs: { 'data-v6act': 'giveto', 'data-v6b': b.id, 'aria-haspopup': 'dialog' } }) : ''}</p>`;
}
// Each active teammate's open steps (their own Today's, as Team counts them), for a menu that hands a bill on: { id: n }.
// bill.js's "Give HB 2458 to…" can show the same load as Change owner here (B-6).
export async function openCounts() {
  const out = {};
  try { const { work } = await import('./today.js');
    for (const a of (S.advocates || []).filter(x => x.is_active !== false)) { try { out[a.id] = work(a).own.length; } catch { /* no count for them */ } } } catch { /* no counts */ }
  return out;
}

// ---- the hearing card (V13, V14) ----
// hearingCard(sitting, { viewer, big, from, id, omit, lead, self, week, facts }): time and room large, who is going with
// the I'm going toggle on the card, and each of our bills on it with where its testimony stands (hearingLine: the state
// word first). `sitting`: a hearing row (its sitting is every row with the same committee and start), or { h }.
//   big:   the phone's hearing-day card (time 28px, 56px rows).
//   from:  where the hearing page's Back returns to.
//   omit:  bill ids whose step the page already draws (Today's next-step card): each own step is said once (A-14).
//   lead:  a bill id whose row comes first, its button the screen's one filled button and full size, its line in its own
//          colour when late (Today's phone hearing day, V14, D3).
//   self:  on the sitting's own page: no door to the page (it would open itself), no monitored-bills line (the page lists
//          them); the committee's name is the card's heading.
//   week:  as Hearings › This week draws it: no day word (the day's heading says it), "Watch it live" inside the going
//          words, and from 600px I'm going on the committee's line (A-24, the week at a glance). On by default when the
//          card's Back returns to the week (from: 'week'), so This week needs no surgery on the card's HTML.
//   facts: b => text, one quiet line under each bill (the sitting page's "Strong support · Kevin's bill", F129).
// The way into the sitting's page is a labelled door, as on the step card's hearing line: the committee's name, "Open the
// hearing" and a chevron, the full width and 44px tall (B-9, A-6). Monitor bills are one quiet line at the end that opens
// the same page, so the card is about the bills we work on (R-022 decision 4) and the others are still a tap away. The
// parts are joined by real spaces and " · " (screen readers and copied text read "Today · Room 430", not "TodayRoom 430").
// A moved sitting says so ("Moved from Mon 3/9"); whether to still go is asked by Hearings' own strip (moved.js), of the
// people who were going to the old one.
export function hearingCard(sitting, { viewer, big = false, from = '', id = '', omit = null, lead = null, self = false, week = from === 'week', facts = null, watchLink = true, buttons = true } = {}) {
  const h = sitting?.h || sitting; if (!h) return '';
  const v = meOf(viewer), rows = sittingRows(h), now = Date.now(), at = ms(h.scheduled_at), cancelled = rows.every(r => r.status === 'cancelled');
  const hid = id || `v6h-${esc(h.id)}`, href = `#/hearing/${encodeURIComponent(h.id)}${from ? `?from=${encodeURIComponent(from)}` : ''}`;
  const gone = new Set([...(omit || [])].map(String));
  const items = rows.map(r => ({ h: r, b: billById(r.bill_id) })).filter(x => x.b && x.b.tracked !== false && x.h.status !== 'cancelled' && !gone.has(String(x.b.id)));
  let pos = items.filter(x => x.b.position && x.b.position !== 'monitor'); const mon = items.filter(x => !x.b.position || x.b.position === 'monitor');
  if (lead != null) pos = [...pos.filter(x => String(x.b.id) === String(lead)), ...pos.filter(x => String(x.b.id) !== String(lead))];
  const today = hday(at) === hday(now), past = at <= now, moved = movedFrom(h);
  const day = today ? 'Today' : hday(at) === hday(now + DAY) ? 'Tomorrow' : dayWords(at);
  // The lead row, and the viewer's own writing step on the phone's big card, is where that step is done that day (V14): it
  // says what the approver asked ("Sent back: …", quiet, under the line) and opens the Doc beside Resubmit or Send for
  // approval, as the step card does (P-3, P-4, B-11; spec 2's P1 reads the draft first). Lauren's hearing-day phone
  // showed only "Writing · late" and a filled Resubmit, so one tap sent the unrevised draft back (the critic's high).
  const steps = new Map(), stepOf = x => { if (!steps.has(x)) steps.set(x, billStep(x.b, { viewer: v, d: sittingDraft(x.h, x.b.id) || null, h: x.h })); return steps.get(x); };
  // The late window said once, over the rows (A-14; the card's time is the hearing's, which is when the window closes).
  const lateAny = !past && !cancelled && pos.some(x => { const s = stepOf(x); return !!s?.state && !['filed', 'missed'].includes(s.state.key) && !s.off && s.status?.tone === 'late'; });
  // R-344: amber when one of those late steps is the viewer's own (or on their bill), as its row is (shownStatus)
  const lateMine = lateAny && pos.some(x => { const s = stepOf(x); return s?.status?.tone === 'late' && s.mine && !['filed', 'missed'].includes(s.state?.key); });
  const bill = x => { const s = stepOf(x), first = lead != null && String(x.b.id) === String(lead);
    // Wherever the card offers Resubmit, the note is beside it (Hearings › This week too), so the button resubmits at once.
    // `buttons: false` (R-356 round 1, decision 5; A-14, D15): Hearings > This week shows each bill's testimony status as words;
    // the step's button is on Today and on Testimony.
    const ok = buttons && rowButtonOK(s), home = buttons && (first || big) && s.you && ['revise', 'write', 'submit'].includes(s.kind);
    const sbOn = s.you && s.kind === 'revise' && !!s.state?.sentBack && !!s.d?.review_note && (home || ok);
    const sb = sbOn ? `<p class="v6-hcard-sb"><span class="v6-hcard-sbl">${NOTE_HEAD}:</span> ${esc(s.d.review_note)}</p>` : '';
    // Open Doc beside Resubmit (the Doc is where the writer revises; Patti's finding), a plain link as on the step card:
    // one tonal button per row (A-3 on v6, R-352 FIX-2: Resubmit and Open Doc were two tonal buttons side by side).
    const doc = (home || sbOn) && s.d?.doc_url ? docBtn(s.d.doc_url, { kind: 'text', sm: true, attrs: { 'data-v6doc': s.d.id } }) : '';
    const own = !buttons ? '' : ok ? rowButton(s, { ...(first ? { kind: 'primary', sm: false } : {}), confirm: !sbOn }) : rowButtonFor(s);
    const btnHtml = own + doc, t = lineTone(s);
    const more = facts ? facts(x.b) : '';
    return `<li class="v6-hcard-bill${first ? ' lead' : ''}"><a class="v6-hcard-bl" href="${esc(billRoute(x.b))}"><span class="v6-row-top"><span class="v6-row-name">${esc(fullName(x.b))}</span> <span class="v6-row-num">${esc(numWords(x.b))}</span></span>
      <span class="v6-row-line${t.tone !== 'neutral' ? ' t-' + esc(t.tone) : ''}${t.bold ? ' soon' : ''}">${t.icon ? icon(t.icon) : ''}<span>${nw(esc(hearingLine(s, { lateSaid: lateAny, toned: t.tone === 'late'})))}</span></span>${more ? `<span class="v6-hcard-facts">${nw(esc(more))}</span>` : ''}</a>${sb ? ` ${sb}` : ''}${btnHtml ? ` <span class="v6-row-act">${btnHtml}</span>` : ''}</li>`; };
  // I'm going is the card's tonal button only on a hearing that is today or where the viewer owns a step (theirs to do, or
  // their bill); elsewhere it is a quiet link, so This week is not a column of the same button (A-3, A-2 on v6; R-352 FIX-2).
  const owns = pos.some(x => { const s = stepOf(x); return !!s && (s.you || s.mine); });
  const going = past || cancelled ? '' : goingBtn(goingOn(h, v), { 'data-v6act': 'going', 'data-v6h': leadRow(h).id }, { kind: 'secondary', sm: !big });
  // The lead bill (the viewer's own step, Today's hearing day) in a list of its own, so the narrowest phones can draw it
  // right under the committee, before Going: at 320x640 Kris's Review sat under the bottom bar (steps.css, below 380px).
  const first1 = lead != null && pos.length && String(pos[0].b.id) === String(lead) ? pos[0] : null, rest = first1 ? pos.slice(1) : pos;
  // On the sitting's own page (self) its Notice and video says Watch on YouTube: one link to one video (A-14). The link has
  // its own class, so staff.css's bare-link rule (inline-block below 900px) cannot take its icon's gap away.
  // `watchLink: false` (Today's cards): the stream is the sitting page's and This week's detail, one tap away (Open the hearing).
  const stream = !cancelled && today && !self && watchLink ? streamOf(h) : null;
  const watch = stream ? `<a class="v6-watch" href="${esc(stream.url)}" target="_blank" rel="noopener">${icon('video')}<span>Watch it live</span></a>` : '';
  const name = `${committeeName(h.committee) || h.committee}${isDecision(h) ? ' · decision making' : ''}`;
  const room = h.room && !cancelled ? `<span class="v6-hcard-sep"> · </span><span class="v6-hcard-room">${nw(esc(roomName(h.room)))}</span>` : '';
  const dayP = week ? (room ? `<p class="v6-hcard-day">${room.replace('<span class="v6-hcard-sep"> · </span>', '')}</p>` : '') : `<p class="v6-hcard-day">${esc(day)}${room}</p>`;
  const head = self ? `<h3 class="v6-hcard-name"><span class="v6-hcard-cn" id="${hid}">${esc(name)}</span></h3>`
    : `<h3 class="v6-hcard-name"><a class="v6-hcard-door" href="${esc(href)}"><span class="v6-hcard-cn" id="${hid}">${esc(name)}</span> <span class="v6-hcard-open">Open the hearing${icon('chevron-right', { cls: 'v6-chev' })}</span></a></h3>`;
  return `<article class="v6-hcard${big ? ' big' : ''}${week ? ' week' : ''}${self ? ' self' : ''}${cancelled ? ' cancelled' : ''}${past ? ' past' : ''}" aria-labelledby="${hid}">
    <div class="v6-hcard-when"><p class="v6-hcard-time">${nw(esc(timeWords(at)))}</p> ${dayP}</div>
    <div class="v6-hcard-body">
      ${head}
      ${cancelled ? '<p class="v6-hcard-note">Cancelled, no new date yet</p>' : moved ? `<p class="v6-hcard-note">${icon('clock')}<span>Moved from ${nw(esc(moved))}</span></p>` : ''}
      ${lateAny ? `<p class="v6-hcard-note v6-hcard-late${lateMine ? ' t-late' : ''}">${icon('alarm-clock')}<span>${nw(esc(lateLine(h.scheduled_at)))}</span></p>` : ''}
      ${cancelled ? '' : `<p class="v6-hcard-going">${goingPic(h)}<span>${esc(goingWords(h, { viewer: v }))}${week && watch ? ` <span class="v6-hcard-watchin"><span class="v6-hcard-wdot">· </span>${watch}</span>` : ''}</span> ${going}</p>`}
      ${first1 ? `<ul class="v6-hcard-bills v6-hcard-lead1">${bill(first1)}</ul>` : ''}${rest.length ? `<ul class="v6-hcard-bills">${rest.map(bill).join('')}</ul>` : ''}
      ${mon.length && !self ? `<a class="v6-hcard-mon" href="${esc(href)}"><span>${pos.length ? 'Also heard: ' : ''}${mon.length === 1 ? '1 bill we monitor' : `${mon.length} bills we monitor`}</span>${icon('chevron-right', { cls: 'v6-chev' })}</a>` : ''}
      ${watch && !week ? `<p class="v6-hcard-watch">${watch}</p>` : ''}
    </div>
  </article>`;
}

// ---- rows (V04, D15, D16) ----
// D16: a row carries its one tonal button only when the step is the viewer's own and is due today, late, or a chair ask
// inside its notice window (a week or less to the day the notice must post), or the asker's Follow up. Other rows open
// on click.
export function rowButtonOK(s) {
  if (!s || !s.you) return false;
  if (s.kind === 'chair') return s.ask.key === 'waiting' ? !!s.ask.followUp : (s.ask.key === 'ask' || s.ask.key === 'giving') && s.ask.by != null && s.ask.by - Date.now() <= 7 * DAY;
  if (['filed', 'none'].includes(s.kind)) return false;
  if (s.kind === 'missed') return true;
  const t = s.status.tone; if (t === 'late' || t === 'overdue') return true;
  const at = s.act?.at ?? s.due; return at != null && hday(at) <= hday(Date.now());
}
// The row's button: the step's own verb, tonal. An approval goes to Review mode, which reads the draft first (P1); filing
// opens the filing sheet, File at the Capitol first and Mark filed after it. A sent-back draft's Resubmit shows the
// approver's note and the Doc first (a one-question sheet), since a row has no room for the note and one tap sent the
// unrevised draft back (the critic's high, P1 for the writer); `confirm: false` where the note is beside it already.
// R-344 Rule 1: every row button carries its icon, verbs.js's one per action (iconizeButtons adds it by the button's words).
export const rowButton = (s, o = {}) => iconizeButtons(rowButton0(s, o));
function rowButton0(s, { kind = 'secondary', sm = true, confirm = true } = {}) {
  const a = (act, x = {}) => A(act, s, x);
  switch (s.kind) {
    case 'nodraft': return btn('Make the draft', { kind, sm, attrs: a('draftnow') });
    case 'write': case 'submit': return btn('Send for approval', { kind, sm, attrs: a('submit') });
    case 'revise': return btn('Resubmit', { kind, sm, attrs: a('submit', confirm && s.d?.review_note ? { 'data-v6confirm': '1', 'aria-haspopup': 'dialog' } : {}) });
    case 'approve': case 'second': return btn('Review', { kind, sm, href: `#/review/${encodeURIComponent(s.d.id)}` });
    case 'file': return btn('File', { kind, sm, attrs: a('filed', { 'aria-haspopup': 'dialog' }) });
    case 'missed': return btn('Did we file?', { kind, sm, attrs: a('filed', { 'data-v6late': '1', 'aria-haspopup': 'dialog' }) });
    case 'chair': { const x = s.ask, to = x.m ? (x.m.n > 1 ? 'Email the chairs' : 'Email the chair') : '';
      if (x.key === 'waiting') {
        const ml = x.followUp ? askMailOf(s, { followUp: true }) : null, ph = x.followUp && !ml ? phoneOf(x.code) : '';
        if (ml) return btn(`${to} again`, { kind, sm, href: ml.href });
        if (ph) return btn('Call the office', { kind, sm, href: telOf(ph) });
        return btn('They replied', { kind, sm, attrs: a('replied', { 'data-v6code': x.code, 'aria-haspopup': 'dialog' }) });
      }
      const ml = askMailOf(s);
      return ml ? btn(to, { kind, sm, href: ml.href }) : ''; }
  }
  return '';
}
// The one button a row shows, if any: the viewer's own step (D16), or Take it on a step nobody holds for whoever may hand
// it (an admin, or the issue's owner: R-330); everyone else takes it from the open item.
const rowButtonFor = s => rowButtonOK(s) ? rowButton(s) : s.nobody && s.takeFor ? btn('Take it', { kind: 'secondary', sm: true, icon: PIC.take.btnIcon, attrs: { 'data-v6act': 'take', 'data-v6b': s.b.id } }) : '';
// The line's look: late or overdue in its colour, with its icon, only for the viewer's own step or bill (shownStatus);
// due today bold with a clock for the viewer's own step; done leaf for everyone.
function lineTone(s) {
  const st = shownStatus(s), tone = st.tone, hushed = st !== s.status;
  return { tone, icon: tone !== 'neutral' ? st.icon : (st.soon && s.you) || hushed ? 'clock' : '', bold: st.soon && s.you && tone === 'neutral' };
}
// billRow(b, { viewer, line, button, href, pick, selected, hint, step, cls }) -> one bill: its name (Poppins 18), its
// number small, and one 16px line; the whole row opens it (a link, or `pick` for a list with the item beside it). No
// tiles, no "+N on this bill", no room, codes or history (those live in the open item). `line` and `button` override
// what the step says; `button: false` draws none. Rows sit in a role="list" box (.v6-list, or listDetail's).
// `act: true` (R-344 Rule 1): the row leads with its job's tile (verbs.js rowLead), the viewer's own steps only; any other
// row keeps an empty slot of the same width, so every name in the list starts at one edge. Lists that opt in: Today's.
export function billRow(b, { viewer, line, button, href, pick, selected = false, hint = false, step, cls = '', lead = '', act = false } = {}) {
  if (!b) return '';
  const v = meOf(viewer), s = step || billStep(b, { viewer: v }), t = line == null ? lineTone(s) : { tone: '', icon: '', bold: false };
  if (act && !lead) lead = actLead(s);
  const text = line != null ? line : nw(esc(s.line));
  const btnHtml = button === false ? '' : button ? button : rowButtonFor(s);
  return rowHTML({ key: b.id, name: fullName(b), num: numWords(b), line: text, tone: t.tone, icon: t.icon, bold: t.bold, href: href || billRoute(b), pick, selected, hint, button: btnHtml, cls, bill: b.id, lead });
}
// itemRow({ key, name, num, line, tone, icon, href, pick, button, selected, hint, cls }) -> any other item (a to-do, an
// email, a person) in the same shape. `line` is HTML (escape it); `name` and `num` are text.
export const itemRow = o => rowHTML(o);
// The job's tile for a step row, or the empty slot (see billRow's `act`). Someone else's step leads with the job too where
// it is the viewer's list to clear (a teammate's read-only list, Testimony's tabs); filed and missed wear their state.
export const actLead = s => !s || ['none'].includes(s.kind) || !PIC[s.kind] ? '<span class="v6-row-lead v6-act-lead none" aria-hidden="true"></span>' : rowLead(s.kind);
// `lead` (R-339, a trial behind ?icons=1): HTML for a small mark before the name, inside the link so it opens the row too;
// the row's text moves into a second column so every name still starts at the same place.
function rowHTML({ key = '', name = '', num = '', line = '', tone = '', icon: ic = '', bold = false, href = '', pick, selected = false, hint = false, button = '', cls = '', bill = '', lead = '' }) {
  const tag = href ? 'a' : 'button', attr = `${href ? `href="${esc(href)}"` : 'type="button"'}${pick != null ? ` data-v6pick="${esc(pick)}"` : ''}${selected ? ' aria-current="true"' : ''}${bill ? ` data-bill="${esc(bill)}"` : ''}`;
  return `<div class="v6-row${selected ? ' sel' : ''}${hint ? ' hint' : ''}${cls ? ' ' + cls : ''}" role="listitem"${key ? ` data-v6row="${esc(key)}"` : ''}>
    <${tag} class="v6-row-main${lead ? ' has-lead' : ''}" ${attr}>${lead}<span class="v6-row-top"><span class="v6-row-name">${esc(name)}</span>${num ? ` <span class="v6-row-num">${esc(num)}</span>` : ''}</span>${line ? ` <span class="v6-row-line${tone && tone !== 'neutral' ? ' t-' + esc(tone) : ''}${bold ? ' soon' : ''}">${ic ? icon(ic) : ''}<span>${line}</span></span>` : ''}</${tag}>${button ? `<span class="v6-row-act">${button}</span>` : ''}</div>`;
}

// ---- the list with the picked item beside it (V17) ----
// listDetail({ id, label, rows, picked, detail, empty, back, listRole }) -> the list and the panel. Designed at 1280 first:
// the panel is about 380px beside the list from 1100px; nothing opens by itself (a calm "Pick one to see its steps" fills
// the panel, and the first row is highlighted as a hint). Below 1100px the picked item is its own page with Back, which
// says where it goes (`back`: "Back to Messages", B-4) every time it is drawn.
// `listRole: false`: `rows` brings its own role="list" boxes (Bills' one list per group), so the column is not a list.
// The screen keeps what is picked in ldPicked(id) and passes `detail` (its HTML) on each draw; wireListDetail does the rest.
export const ldPicked = id => S.v6ld?.[id]?.key ?? null;
const backBtn = label => `<button type="button" class="v6-ld-back" data-v6ldback>${icon('chevron-left')}<span>${esc(label)}</span></button>`;
const emptyHTML = text => `<p class="v6-ld-empty">${icon('arrow-left')}<span>${esc(text)}</span></p>`;
export function listDetail({ id, label = 'List', rows = '', picked = ldPicked(id), detail = '', empty = 'Pick one to see its steps', back = 'Back to the list', listRole = true }) {
  const open = picked != null && !!detail;
  const list = rows.replace(/class="v6-row(?![\w-])/, open ? 'class="v6-row' : 'class="v6-row hint');
  return `<div class="v6-ld${open ? ' open' : ''}" data-v6ld="${esc(id)}" data-v6ld-label="${esc(back)}" data-v6ld-empty="${esc(empty)}">
    <div class="v6-ld-list"${listRole ? ` role="list" aria-label="${esc(label)}"` : ''}>${list}</div>
    <aside class="v6-ld-detail" aria-label="The item you picked">${open ? `${backBtn(back)}${detail}` : emptyHTML(empty)}</aside>
  </div>`;
}
const wide = () => { try { return matchMedia('(min-width: 1100px)').matches; } catch { return true; } };
// The panel's height from its top to the window's foot (24px short of it), so its last step shows from the first view
// (TESTIMONY's Mark filed, LEAD's Add an email), kept as the page scrolls and the window changes size.
// An item under about 1.3 windows tall grows with the page instead, sticking by its foot once that is in view (LEAD's
// People record), so nothing of it is cut at the panel's edge (the critic: Testimony at 1280x800 cut "3:00 PM · Room 229"
// through the line); a taller one scrolls inside with a 24px fade at its foot (.v6-ld-more), never a hard cut (A-8).
// A growing item opens with its top in view (Back and its name: the critic landed mid-item, "Keiki Smiles Alliance on SB
// 2345" above the window, when it stuck by its foot from the start), then moves with the page as the person scrolls,
// until its foot shows, and sticks there; scrolling back up brings its top back the same way (B-4). Where it sits is kept
// per list and item (PTOP), so a redraw after a step leaves it in place; `fresh` (just opened) starts at the top.
const PTOP = new Map();
// Where a panel's top may rest: the screen's own sticky top (Today 16px, Bills under the header), and never under the
// app's sticky header (a growing item's Back and name hid under it).
function panelBase(aside) {
  if (aside.dataset.v6base == null) { const was = aside.style.top; aside.style.removeProperty('top');
    aside.dataset.v6base = String(parseFloat(getComputedStyle(aside).top) || 24); if (was) aside.style.top = was; }
  const hdr = document.querySelector('.sv-hdr'), hb = hdr && /sticky|fixed/.test(getComputedStyle(hdr).position) ? Math.max(0, hdr.getBoundingClientRect().bottom) : 0;
  return Math.round(Math.max(+aside.dataset.v6base, hb ? hb + 16 : 0));
}
function fitPanel(box, { fresh = false } = {}) {
  const aside = box?.querySelector?.('.v6-ld-detail'); if (!aside) return;
  const id = box.dataset?.v6ld || '', key = S.v6ld?.[id]?.key ?? null;
  // Only a top (and a room below the list) this function set is taken back (People sets its own for a record it lets grow).
  const unroom = () => { if (box.dataset.v6room) { box.style.removeProperty('min-height'); delete box.dataset.v6room; } };
  const untop = () => { PTOP.delete(id); unroom(); if (aside.dataset.v6top) { aside.style.removeProperty('top'); delete aside.dataset.v6top; } };
  if (!wide()) { aside.style.removeProperty('--v6-ld-max'); aside.classList.remove('v6-ld-grow', 'v6-ld-more'); untop(); return; }
  if (fresh) unroom();
  const top = Math.max(24, aside.getBoundingClientRect().top), avail = Math.max(240, Math.round(innerHeight - top - 24));
  aside.style.setProperty('--v6-ld-max', `${avail}px`);
  const h = aside.scrollHeight, grow = h > avail + 1 && h <= 1.3 * innerHeight;
  aside.classList.toggle('v6-ld-grow', grow);
  if (grow && h > innerHeight - 48) {
    const base = panelBase(aside), lo = Math.min(base, Math.round(innerHeight - h - 24)), y = window.scrollY, p = !fresh && PTOP.get(id);
    const tp = Math.min(base, Math.max(lo, p && p.key === key ? p.t - (y - p.y) : base));
    aside.style.top = `${tp}px`; aside.dataset.v6top = '1'; PTOP.set(id, { key, t: tp, y });
    // A sticky panel never leaves its list's box: opened from a row near the list's end, the box ended before the panel
    // could, so it rode up past the window's top. The box gets the room the panel needs while it is open (kept, never
    // shrunk, so the panel does not jump), and gives it back when the item closes.
    // Only while its top is still showing: once its foot is in view it scrolls on with the list's end, so the page never
    // grows as the person scrolls.
    const need = Math.ceil(tp + h - box.getBoundingClientRect().top);
    if (tp > lo && need > box.offsetHeight) { box.style.minHeight = `${need}px`; box.dataset.v6room = '1'; }
  } else untop();
  // The fade only where the panel itself scrolls (a screen may let a tall item grow its own way: People's pe-tall).
  let scrolls = false; try { scrolls = !grow && aside.scrollHeight > aside.clientHeight + 1 && getComputedStyle(aside).overflowY !== 'visible'; } catch { /* no styles: no fade */ }
  aside.classList.toggle('v6-ld-more', scrolls);
}
let fitting = null;
const fitAll = () => { if (fitting) return; fitting = requestAnimationFrame(() => { fitting = null; document.querySelectorAll?.('.v6-ld.open').forEach(b => fitPanel(b)); }); };
if (typeof window !== 'undefined' && window.addEventListener) { window.addEventListener('scroll', fitAll, { passive: true }); window.addEventListener('resize', fitAll); }
// wireListDetail(root, { id, open: key => html, onChange }) -> { open(key), close() } : a click on a row's [data-v6pick]
// opens it beside the list (or as its own page below 1100px); Back (the browser's, the phone's gesture or the Back
// button) closes it, keeps the list's scroll and puts the focus back on the row (spec 7.10). A row's own button never
// opens the item. The screen may open and close items itself through what it returns (Bills' j and k, F90).
export function wireListDetail(root, { id, open, onChange } = {}) {
  const box = root?.querySelector?.(`[data-v6ld="${CSS.escape(id)}"]`); if (!box) return { open: () => {}, close: () => {} };
  if (box.v6api) return box.v6api;
  box.dataset.v6wired = '1';
  const st = () => (S.v6ld ??= {})[id] ??= { key: null, y: 0 };
  const backLabel = box.dataset.v6ldLabel || 'Back to the list', emptyText = box.dataset.v6ldEmpty || 'Pick one to see its steps';
  const draw = key => {
    const aside = box.querySelector('.v6-ld-detail'), html = key != null ? open?.(key) || '' : '';
    box.classList.toggle('open', !!html);
    box.querySelectorAll('.v6-row').forEach(r => { const on = r.querySelector('[data-v6pick]')?.dataset.v6pick === String(key); r.classList.toggle('sel', on); r.classList.remove('hint'); r.querySelector('[data-v6pick]')?.toggleAttribute('aria-current', on); });
    if (!html) { const f = box.querySelector('.v6-row'); f?.classList.add('hint'); aside.innerHTML = emptyHTML(emptyText); aside.style.removeProperty('--v6-ld-max'); aside.classList.remove('v6-ld-grow', 'v6-ld-more'); if (aside.dataset.v6top) { aside.style.removeProperty('top'); delete aside.dataset.v6top; }
      if (box.dataset.v6room) { box.style.removeProperty('min-height'); delete box.dataset.v6room; } return; }
    aside.innerHTML = `${backBtn(backLabel)}${html}`;
    wireClose();
    aside.scrollTop = 0; fitPanel(box, { fresh: true });
    const head = aside.querySelector('h2, h3'); if (head) { head.setAttribute('tabindex', '-1'); head.focus({ preventScroll: true }); }
    if (!wide()) window.scrollTo(0, Math.max(0, box.getBoundingClientRect().top + window.scrollY - 72));
  };
  const close = ({ fromButton = false, fromBack = false } = {}) => {
    const s = st(), key = s.key; s.key = null; draw(null); onChange?.(null);
    if (!fromBack) S.panelClosed?.();
    if (!wide()) window.scrollTo(0, s.y || 0);
    const row = [...box.querySelectorAll('[data-v6pick]')].find(x => x.dataset.v6pick === String(key)); row?.focus({ preventScroll: true });
  };
  const pick = key => {
    const s = st(), was = s.key; if (s.key == null) s.y = window.scrollY;
    s.key = key == null ? null : String(key); draw(s.key); onChange?.(s.key);
    if (was == null && s.key != null) S.panelOpened?.(() => close({ fromBack: true }));
  };
  box.addEventListener('click', e => {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button > 0) return;
    if (e.target.closest('.v6-row-act, .v6-ld-detail')) return;
    const p = e.target.closest('[data-v6pick]'); if (!p) return;
    e.preventDefault();
    const s = st(); if (s.key == null) s.y = window.scrollY;
    s.key = p.dataset.v6pick; draw(s.key); onChange?.(s.key);
    S.panelOpened?.(() => close({ fromBack: true }));
  });
  // Back to the list (below 1100px) and the item's own close X (openItem's closeBtn, or any [data-v6ldclose]) close it.
  const wireClose = () => box.querySelectorAll('.v6-ld-detail [data-v6ldback], .v6-ld-detail .v6-item-close, .v6-ld-detail [data-v6ldclose]').forEach(x => { x.onclick = () => close({ fromButton: true }); });
  wireClose();
  if (box.classList.contains('open')) fitPanel(box);
  if (st().key != null && box.classList.contains('open') && history.state?.panel) S.panelOpened?.(() => close({ fromBack: true }));
  box.v6api = { open: key => (key == null ? close() : pick(key)), close: () => { if (st().key != null) close({ fromButton: true }); } };
  return box.v6api;
}

// ---- the place head (D12) ----
// placeHead(title, { tabs, view, sub, actions, id, switcher }) -> the page title (one h1, 28px) with the place's one row
// of page tabs ([[key, href, label, count?]], `view` the current key) or one view switch ({ name, opts, value, label }).
export function placeHead(title, { tabs = null, view = '', sub = '', actions = '', id = 'v6-h1', switcher = null } = {}) {
  const tabRow = tabs && tabs.length ? `<nav class="v6-tabs" aria-label="${esc(title)} pages">${tabs.map(([k, href, label, n]) => `<a href="${esc(href)}"${k === view ? ' aria-current="page"' : ''}><span>${esc(label)}</span>${n ? `<span class="v6-tab-n">${esc(n)}</span>` : ''}</a>`).join('')}</nav>` : '';
  const sw = switcher ? `<div class="v6-head-switch">${segmented(switcher.name, switcher.opts, switcher.value, switcher.label || title)}</div>` : '';
  return `<header class="v6-head"><div class="v6-head-top"><h1 class="v6-head-title" id="${esc(id)}" tabindex="-1">${esc(title)}</h1>${actions ? `<div class="v6-head-acts">${actions}</div>` : ''}</div>${sub ? `<p class="v6-head-sub">${sub}</p>` : ''}${tabRow}${sw}</header>`;
}

// ---- actions: one listener for the whole app (as terms.js), so a card drawn anywhere works with nothing to wire ----
// Each calls the same data function as v5 (DB.transition, DB.attend, DB.setOwner, the chair ask's record) and says who is
// next, with Undo (P2, P3; B-5, A-16). A screen may replace a step's flow with its own (the filing card: setStepHook).
const HOOKS = {};
export const setStepHook = (name, fn) => { HOOKS[name] = fn; };
let AFTER = () => hooks.render();
// wireSteps(root, { after }): what to redraw after a step (the page, by default). The buttons themselves need no wiring.
export function wireSteps(root, { after } = {}) { if (after) AFTER = after; return root; }
const redraw = () => { try { AFTER(); } catch { hooks.render(); } };
const draftById = (bid, did) => (S.drafts?.[bid] || []).find(x => String(x.id) === String(did));
async function busy(el, fn) {
  if (el) { el.setAttribute('aria-busy', 'true'); el.disabled = true; }
  try { await fn(); } catch (e) { toast(e, { err: true }); if (el?.isConnected) { el.removeAttribute('aria-busy'); el.disabled = false; } }
}
// The calm finish every step shares (spec section 4 Motion, A-10, pub/fx.js style): the button's check fills (150ms),
// then its row fades and closes (250ms, ease-out) or its card fades (200ms), then the page redraws and the Undo toast
// says who is next. Nothing moves under Reduce Motion; a screen's count crossfade is the screen's own.
const reduced = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return true; } };
const pause = t => new Promise(r => setTimeout(r, t));
export async function finish(el) {
  if (!el?.isConnected || typeof el.animate !== 'function' || reduced()) return;
  try {
    const b = el.closest('.btn') || el, ic = b.querySelector('svg');
    b.classList.add('v6-fin'); b.removeAttribute('aria-busy');
    if (ic) ic.outerHTML = icon('check'); else b.insertAdjacentHTML('afterbegin', icon('check'));
    await pause(150);
    const row = el.closest('.v6-row, .v6-hcard-bill'), card = !row && el.closest('.v6-step');
    if (row) { const hgt = row.offsetHeight;
      await row.animate([{ opacity: 1, height: `${hgt}px`, minHeight: `${hgt}px` }, { opacity: 0, height: '0px', minHeight: '0px', paddingTop: '0px', paddingBottom: '0px' }], { duration: 250, easing: 'ease-out', fill: 'forwards' }).finished; }
    else if (card) await card.animate([{ opacity: 1 }, { opacity: 0.35 }], { duration: 200, easing: 'ease-out', fill: 'forwards' }).finished;
  } catch { /* a step is never held up by its motion */ }
}
// A button inside a sheet (a card drawn in a quick look) closes the sheet first, unless its own step opens a sheet,
// which takes the sheet's place (ui.js openSheet), so no button is ever dead (B-3).
const OPENS_SHEET = new Set(['sendback', 'filed', 'replied', 'giveask', 'giveto']);
let approvedAt = -1e4;
// A row's Resubmit on a sent-back draft: the approver's note, Open Doc, then Resubmit (one sheet, one question). The
// card's own Resubmit, with the note above it, sends at once.
function confirmResubmit(el, b, d) {
  openSheet({ title: 'Did you make the changes?', size: 'auto',
    body: `<blockquote class="v6-step-note"><span class="v6-step-nl">${NOTE_HEAD}</span>${esc(d.review_note)}</blockquote>${d.doc_url ? `<p class="v6-rs-doc">${docBtn(d.doc_url, { kind: 'text', attrs: { 'data-v6doc': d.id } })}</p>` : ''}`,
    foot: btn('Resubmit', { kind: 'primary', icon: 'send', attrs: { 'data-go': '1' } }),
    wire: dlg => { dlg.querySelector('[data-go]').onclick = () => { closeSheet({ silent: true }); delete el.dataset.v6confirm; ACTS.submit(el, b, d); }; } });
}
const ACTS = {
  async submit(el, b, d) {
    if (el?.dataset?.v6confirm === '1' && d.review_note) return confirmResubmit(el, b, d);
    await busy(el, async () => {
    await DB.transition(b.id, d.id, 'submit'); clearReminders(b, d);
    const who = whoseStep(draftById(b.id, d.id) || d, b).words;
    await finish(el); redraw();
    toast(who ? `Sent to ${who} for approval. You file it once it is approved.` : 'Sent for approval.', { ok: true, undo: async () => { await DB.transition(b.id, d.id, 'withdraw'); toast('Pulled back to draft.'); redraw(); } }); }); },
  async approve(el, b, d) {
    // A leftover second tap never approves the next step that lands in the same spot (review mode's guard, build 3).
    if (performance.now() - approvedAt < 1000) return;
    await busy(el, async () => {
      await DB.transition(b.id, d.id, 'approve'); approvedAt = performance.now(); clearReminders(b, d);
      const nd = draftById(b.id, d.id) || d, f = filerOf(nd);
      const next = nd.status === 'second_review' ? `Approved. ${cap(whoseStep(nd, b).words) || 'A second approver'} gives the second look next.`
        : f === S.me?.id ? 'Approved. File it at the Capitol next.' : `Approved. ${f ? cap(firstWords(f)) : 'The owner'} files it next.`;
      await finish(el); redraw();
      toast(next, { ok: true, undo: async () => { await DB.transition(b.id, nd.id, 'unapprove'); toast('Approval undone. It is waiting for you again.'); redraw(); } }); }); },
  sendback(el, b, d) {
    const to = d.submitted_by && d.submitted_by !== S.me?.id ? cap(firstWords(d.submitted_by)) : '';
    openSheet({ title: 'What should change?', size: 'auto',
      body: `<div class="field"><label for="v6-sb">${to ? `Your note for ${esc(to)}` : 'Your note'}</label><textarea id="v6-sb" rows="4" required aria-describedby="v6-sb-e" placeholder="${to ? `What should ${esc(to)} change?` : 'What should change?'}"></textarea><span class="err" id="v6-sb-e" hidden>${icon('circle-alert')}Write what should change first.</span></div>`,
      foot: btn(to ? `Send back to ${esc(to)}` : 'Send it back', { kind: 'primary', icon: 'undo-2', attrs: { 'data-go': '1' } }),
      wire: dlg => {
        const ta = dlg.querySelector('#v6-sb'), er = dlg.querySelector('#v6-sb-e'); ta.value = (S.v6Held ??= {})['sb:' + d.id] || ''; ta.focus();
        ta.oninput = () => { er.hidden = true; ta.removeAttribute('aria-invalid'); S.v6Held['sb:' + d.id] = ta.value; };
        dlg.querySelector('[data-go]').onclick = async () => {
          const note = ta.value.trim(); if (!note) { er.hidden = false; ta.setAttribute('aria-invalid', 'true'); ta.focus(); return; }
          // Held ten seconds so Undo can cancel it before the writer is told (review.js holdBack, B-5).
          const { holdBack } = await import('./review.js');
          const undo = holdBack({ key: d.id, target: d, patch: { status: 'draft', review_note: note }, send: () => DB.transition(b.id, d.id, 'request_changes', note),
            onFail: () => { redraw(); toast(`${sayWords(b)} was not sent back. It is still waiting for you; try again.`, { err: true }); } });
          delete S.v6Held['sb:' + d.id]; closeSheet({ silent: true }); await finish(el); redraw();
          toast(to ? `Sent back to ${to} with your note. ${to} revises and resubmits it.` : 'Sent back with your note.', { undo: async () => { if (await undo()) { redraw(); toast('Not sent back. It is waiting for you again.'); } } });
        };
      } });
  },
  // The filing sheet (the card's Mark filed, the row's File): File at the Capitol first, then the confirmation link and
  // Mark filed (V25's order). After the hearing started ("Yes, mark filed (late)") only the second half is asked. The
  // Testimony screen's filing card replaces it with setStepHook('file', ...).
  filed(el, b, d) {
    const late = el?.dataset.v6late === '1';
    if (HOOKS.file) return HOOKS.file(b, d, { late, after: redraw, el });
    const first = late ? '' : `<p class="v6-fsheet-step">Step 1: file it on the Capitol’s page for ${esc(sayWords(b))}.</p><p class="v6-fsheet-go">${btn('File at the Capitol', { kind: 'secondary', href: capitolUrl(b), target: '_blank', iconEnd: 'external-link' })}</p><p class="v6-fsheet-step">Step 2: mark it filed here.</p>`;
    openSheet({ title: late ? `Filed the ${esc(sayWords(b))} testimony (late)?` : `File the ${esc(sayWords(b))} testimony`, size: 'auto',
      body: `${first}${field('v6-furl', 'Capitol confirmation link (optional)', '<input id="v6-furl" type="url" inputmode="url" autocomplete="off" placeholder="https://">', 'Paste the link from the Capitol’s confirmation, if you have it.')}<p class="err" id="v6-furl-e" role="alert" hidden>That does not look like a web address. It starts with https://</p>`,
      foot: btn('Mark filed', { kind: 'primary', icon: 'clipboard-check', attrs: { 'data-go': '1' } }),
      wire: dlg => {
        const go = dlg.querySelector('[data-go]'), inp = dlg.querySelector('#v6-furl'), er = dlg.querySelector('#v6-furl-e');
        inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); go.click(); } });
        go.onclick = () => { const url = inp.value.trim();
          if (url && !/^https?:\/\/[^\s/$.?#][^\s]*\.[^\s]{2,}$/i.test(url)) { er.hidden = false; inp.setAttribute('aria-invalid', 'true'); inp.focus(); return; }
          busy(go, async () => {
            await DB.transition(b.id, d.id, 'file', null, url); closeSheet({ silent: true }); clearReminders(b, d);
            await finish(el); redraw();
            toast(`Filed. ${sayWords(b)} is done for ${committeeName(d.committee) || d.committee}.`, { ok: true, undo: async () => { await DB.transition(b.id, d.id, 'unfile'); toast('Filing undone. It is approved and ready to file again.'); redraw(); } }); }); };
      } });
  },
  async unfile(el, b, d) { const url = d.filed_url || null; await busy(el, async () => {
    await DB.transition(b.id, d.id, 'unfile'); redraw();
    toast('Filing undone. It is approved and ready to file again.', { undo: async () => { await DB.transition(b.id, d.id, 'file', null, url); redraw(); } }); }); },
  // V25: "No, we didn't file" is recorded on the bill's timeline (no red, no migration) and leaves Today with Undo.
  // The toast says what happened only: on Today the card leaves, on Testimony the row stays under The record, so "It
  // leaves your list" was true on one screen alone (TESTIMONY asked). A button may carry its own words (data-v6say).
  async nofile(el, b, d) { await busy(el, async () => {
    await DB.addActivity(b.id, 'testimony', noFileTitle(d)); (S.v6NoFile ??= new Set()).add(String(d.id)); clearReminders(b, d);
    await finish(el); redraw();
    toast(el?.dataset?.v6say || 'Noted on the bill: not filed.', { undo: async () => { S.v6NoFile.delete(String(d.id)); redraw(); } }); }); },
  async draftnow(el, b, d, h) { const { makeDraftNow } = await import('./testimony.js'); return makeDraftNow(h); },
  async going(el, b, d, h) {
    const rows = sittingRows(h), mine = rows.filter(r => (S.attend?.[r.id] || []).includes(S.me?.id)), on = mine.length > 0, name = committeeName(h.committee) || h.committee;
    await busy(el, async () => {
      if (!on) await DB.attend(h.id, true); else for (const r of mine) await DB.attend(r.id, false);
      redraw();
      toast(on ? `Taken off the list for the ${name} hearing.` : `You’re going to the ${name} hearing ${whenAt(h.scheduled_at)}.`, { ok: !on,
        undo: async () => { if (on) { for (const r of mine) await DB.attend(r.id, true); } else await DB.attend(h.id, false); redraw(); } }); });
  },
  replied(el, b, d, h, code) { return answerSheet([b.id], code); },
  giveask(el, b, d, h, code) { return giveAsk([{ b, st: stopOf(b) }], code, redraw); },
  async askdone(el, b, d, h, code) { const t = askTodoOf(b); await busy(el, async () => {
    if (t) await DB.updateTodo(b.id, t.id, { done: true });
    const unlog = await logAsk(b, code);
    await finish(el); redraw();
    toast(`Done: the ask is logged, so the team sees “Asked by ${firstWords(S.me?.id, { id: null })}” on ${sayWords(b)}.`, { ok: true, undo: async () => { if (t) await DB.updateTodo(b.id, t.id, { done: false }); await unlog(); redraw(); } }); }); },
  async take(el, b) { await busy(el, async () => { await DB.setOwner(b.id, S.me.id); redraw();
    toast(`You own ${sayWords(b)} now.`, { ok: true, undo: async () => { await DB.setOwner(b.id, null); redraw(); } }); }); },
  // As v5's Give to… on Today: the toast names who owns it now and promises no message (migration 064 messages a
  // to-do or a hearing given to someone, not an owner change), and the draft stays with whoever sent it.
  // Each person's row says their load, the open steps on their own Today ("6 open", as Team counts them: today.js work),
  // so a bill goes to someone with room (B-6). Read when the menu opens; a load that cannot be worked out says nothing.
  async giveto(el, b) {
    const owner = ownersOf(b)[0] || '', s = billStep(b), by = s?.d?.submitted_by && live(s.d.submitted_by) ? s.d.submitted_by : null;
    const n = await openCounts();
    const sub = a => [a.id === owner ? 'Owns it now' : '', n[a.id] == null ? '' : `${n[a.id]} open`].filter(Boolean).join(' · ');
    pickerSheet({ title: `Who owns ${esc(sayWords(b))}?`, value: owner, help: by ? esc(`The draft stays with ${cap(firstWords(by))}, who sent it.`) : '',
      options: (S.advocates || []).filter(a => a.is_active !== false).map(a => [a.id, a.id === S.me?.id ? `${a.full_name} (you)` : a.full_name, 'user-round', sub(a)]),
      onPick: async id => { if (id === owner) return; try { await DB.setOwner(b.id, id); redraw(); toast(id === S.me?.id ? `You own ${sayWords(b)} now.` : `${cap(firstWords(id))} owns ${sayWords(b)} now.`, { ok: true, undo: async () => { await DB.setOwner(b.id, owner || null); redraw(); } }); } catch (e) { toast(e, { err: true }); } } });
  },
};
// Delegated once (capture is not needed: nothing here sits inside another clickable row's handler, and a row's button
// sits beside its link, never inside it).
if (typeof document !== 'undefined' && document.addEventListener) document.addEventListener('click', e => {
  // P1: an approver who opened the Doc from a card has read it, so its filled button turns from "Review" into Approve (after the new tab opens).
  const doc = e.target?.closest?.('[data-v6doc]');
  if (doc) { DOC_OPENED.add(String(doc.dataset.v6doc)); setTimeout(redraw, 400); return; }
  const el = e.target?.closest?.('[data-v6act]'); if (!el || el.tagName === 'A') return;
  const act = el.dataset.v6act, fn = ACTS[act]; if (!fn) return;
  e.preventDefault(); e.stopPropagation();
  const b = billById(el.dataset.v6b), d = b && el.dataset.v6d ? draftById(b.id, el.dataset.v6d) : null;
  const h = el.dataset.v6h ? (S.hearings || []).find(x => String(x.id) === el.dataset.v6h) || null : null;
  if (!b && act !== 'going') return;
  if (['submit', 'approve', 'sendback', 'filed', 'unfile', 'nofile'].includes(act) && !d) return;
  if (el.closest('dialog') && !OPENS_SHEET.has(act) && el.dataset.v6confirm !== '1') closeSheet({ silent: true });
  fn(el, b, d, h, el.dataset.v6code || '');
});
// "No, we didn't file" (V25): recorded this visit, or on the bill's timeline ("Testimony not filed for the Senate Health
// and Human Services hearing Mon 3/16"), the card is not asked again.
// The bill's timeline line "No, we didn't file" writes, and notFiled reads (filing.js writes the same line with it).
export const noFileTitle = d => { const h = draftHearing(d); return `Testimony not filed for the ${committeeName(d.committee) || d.committee} hearing${h ? ' ' + dayWords(h.scheduled_at) : ''}`; };
export function notFiled(d, b = billById(d?.bill_id)) {
  if (!d || d.status === 'filed') return false;
  if (S.v6NoFile?.has(String(d.id))) return true;
  const t = noFileTitle(d);
  return [...(S.feed || []), ...(S.recentEvents || [])].some(e => e.bill_id === b?.id && e.title === t);
}
