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
//                                  line, no button); hearingCard(sitting, {viewer, big}); billRow / itemRow (a name, the
//                                  bill number small, one 16px line, at most one tonal button, D16); listDetail (the list
//                                  with the picked item beside it, V17); placeHead (the page title and its one row of tabs).
// Every fact comes from model.js (drafts and their steps, deadlines and risk, who approves and files) and every action
// calls the same data functions v5's Today, bill page and Review call, with the same Undo and who's-next toast (P2, P3).
// The old word lists in model.js, today.js and hearing.js stay until each screen switches to these (spec section 5).
import { S, DB, esc, advocate, capitolUrl, hooks, SESSION_OVER } from './data.js';
import { stopOf, diedish, wantsHearing, hearingAhead, draftHearing, sittingDraft, filerOf, canFirstApprove, canSecondApprove,
  attendees, chairMail, chairAskOf, chairAskMail, chairIdsOf, askWords as stopAsk, gateNeed,
  whenAt, clockDay, lateLine, spanOf, roomName, blurb, billRoute, billYearPart, codesOf, movedFrom, isDecision,
  streamOf, billById, offTag, legById, askReply } from './model.js';
import { icon, btn, toast, openSheet, closeSheet, pickerSheet, goingBtn, docBtn, mayUnfile, segmented, field } from './ui.js';
import { askLine, answerSheet } from './chairask.js';
import { askTodoOf, giveAsk, logAsk } from './push.js';

const HR = 36e5, DAY = 864e5;
const HST = { timeZone: 'Pacific/Honolulu' };
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
// "House Transportation"; a joint referral names its committees together: "Senate Health and Human Services, and Commerce"
// (the comma keeps "and" inside a name from reading as the join). `chamber: false` leaves the chamber out.
export function committeeName(code, { chamber = true } = {}) {
  const cs = codesOf(code); if (!cs.length) return '';
  const ks = cs.map(c => cmteOf(c) || { code: c, ch: '', name: c });
  const chs = uniq(ks.map(k => k.ch)), one = chs.length === 1, names = ks.map(k => k.name);
  const join = xs => xs.length < 2 ? xs[0] : xs.length === 2 ? `${xs[0]}, and ${xs[1]}` : `${xs.slice(0, -1).join(', ')}, and ${xs[xs.length - 1]}`;
  if (!chamber) return join(names);
  if (one) return `${CHAMBER[chs[0]] ? CHAMBER[chs[0]] + ' ' : ''}${join(names)}`;
  return join(ks.map(k => `${CHAMBER[k.ch] ? CHAMBER[k.ch] + ' ' : ''}${k.name}`));
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
export function whereWords(b) {
  if (!b) return '';
  const st = stopOf(b), h = hearingAhead(b), dl = st.deadline && !st.deadline.missed ? st.deadline : null;
  const race = dl ? ` · ${deadlineWords(dl.label, dl.date)}` : '';
  if (h) return `Hearing ${whenAt(h.scheduled_at)} · ${committeeName(h.committee) || h.committee}`;
  if (diedish(b)) return st.phase === 'law' || st.phase === 'governor' || st.phase === 'ballot' ? String(st.says).replace(/\.$/, '') : 'Did not advance';
  if (['law', 'vetoed', 'ballot', 'governor'].includes(st.phase)) return String(st.says).replace(/\.$/, '');
  if (st.phase === 'conference') return `In conference${dl ? ` · House and Senate must agree by ${dayWords(dl.date)}` : ''}`;
  if (st.phase === 'floor') return `Through committee, waiting for the floor vote${race}`;
  if (st.hearingState === 'held' && st.committee) return `Heard in ${committeeName(st.committee)}, waiting for its vote${race}`;
  if (st.committee) return `Waiting in ${committeeName(st.committee)}${race}`;
  return `Waiting for its committees${race}`;
}

// ---- time: the one moment to act (W31) ----
// The writer hands on 12 hours before the testimony deadline, or at 4:00 PM the day before when those 12 hours land
// overnight (after 4:00 PM or before 8:00 AM), and the filer files 2 hours before (Nate, 12 and 22 Oct; R-267, R-330).
// Past the deadline and before the hearing starts, the Capitol still takes late testimony: the time is the hearing's
// start ("until 9:30 AM"). Approvals keep the testimony deadline as v5 does (W31 named only the writer and the filer).
const TESTI = new Set(['write', 'submit', 'revise', 'nodraft', 'review', 'review2', 'approve', 'second', 'file', 'stale']);
const HAND = { write: 12, submit: 12, revise: 12, nodraft: 12, file: 2 };
const VERB = { write: 'Send for approval', submit: 'Send for approval', nodraft: 'Send for approval', revise: 'Resubmit',
  review: 'Approve', review2: 'Approve', approve: 'Approve', second: 'Approve', file: 'File', stale: 'Check it',
  chair: 'Ask the chair', ask: 'Write the public ask', send: 'Send', email: 'Approve', fix: 'Fix the email' };
export function handTime(due, hours) {
  const at = due - hours * HR; if (hours < 12) return at;
  const [hh, mm] = new Date(at).toLocaleTimeString('en-GB', { ...HST, hour: '2-digit', minute: '2-digit', hour12: false }).split(':').map(Number);
  if (hh * 60 + mm <= 16 * 60 && hh >= 8) return at;
  return new Date(hday(due - DAY) + 'T16:00:00-10:00').getTime();
}
// A step's until: the hearing's start for a testimony step (late testimony), nothing otherwise.
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
    if (at > now) return { kind: 'hand', at, due, until, verb, time: whenAt(at), words: `${verb} by ${whenAt(at)}` };
    return { kind: 'now', at: due, due, until, verb, time: whenAt(due), words: `${verb} now` };
  }
  return { kind: 'due', at: due, due, until, verb, time: whenAt(due), words: verb === 'Due' ? `Due ${whenAt(due)}` : `${verb} by ${whenAt(due)}` };
}

// ---- status by exception (D3, V08) ----
// status(x) -> { tone: 'neutral'|'late'|'overdue'|'done', icon, words, time, soon }
// Due today, or within 2 hours, stays neutral: it shows by its place (first in the list), a bold time and a clock icon
// (`soon`). Amber is only late testimony the Capitol still takes. Red is only a step still to do whose own deadline has
// passed. Missed testimony (its hearing has started) is said, never coloured: nobody can act on it any more (V25, V30).
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
    if (until != null && until > now) return { tone: 'late', icon: 'clock', words: lateLine(until), time: clockDay(until), soon: true };
    if (s.kind === 'prep') return { tone: 'neutral', icon: 'clock', words: 'Still to finish', time: '', soon: false };
    return { tone: 'overdue', icon: 'circle-alert', words: `${cap(spanOf(due))} overdue`, time: whenAt(due), soon: true };
  }
  const soon = due - now <= 2 * HR || hday(due) === hday(now);
  return { tone: 'neutral', icon: soon ? 'clock' : '', words: `Due ${whenAt(due)}`, time: whenAt(due), soon };
}
// A status as a tile: the neutral sand tile, or late / overdue / done with its icon AND its word, never colour alone.
export const statusTile = (st, { cls = '' } = {}) => st && st.words ? `<span class="v6-status ${esc(st.tone)}${cls ? ' ' + cls : ''}">${st.icon ? icon(st.icon) : ''}<span>${esc(st.words)}</span></span>` : '';

// ---- testimony: one state, five words and Missed (V12, V19) ----
export const STATE_WORDS = { write: 'Writing', approve: 'With an approver', second: 'Second look', file: 'Ready to file', filed: 'Filed', missed: 'Missed' };
// testimonyState(d, b, { h }) -> { key, word, label, sentBack, noDraft, stale } (toString: the word), or null for a
// draft whose sitting was cancelled with no new date (that is the hearing's fact, said by the hearing line).
// `d` null: the hearing is set and no draft exists yet, which is Writing too ("Writing · no draft yet").
// "Sent back" is a flag on Writing: the draft does not record who sent it back (migration 098 keeps the note only), so
// it says "Writing · sent back" and names nobody rather than guess (R-152 C).
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
  const label = sentBack ? `${word} · sent back` : noDraft ? `${word} · no draft yet` : word;
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
  // A draft nobody holds (no owner, nobody sent it) is open to anyone, as on v5's Today ("Open to anyone").
  const anyone = !ids.length && (role === 'write' || role === 'file');
  return { key: st?.key || null, ids, words: anyone ? 'anyone' : orWords(ids, v), you: (!!v && ids.includes(v.id)) || (anyone && !!v), anyone, role, state: st };
}
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
const goingOn = (h, v) => !!v && sittingRows(h).some(r => (S.attend?.[r.id] || []).includes(v.id));
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
// asker, answer, followUp, decide, st, m } (toString: the words), or null when the bill is not waiting for a hearing.
// One wording on every screen: "Ask the chair by Wed 3/25" (the day the notice must post, W1), "Kris is asking · by Wed
// 3/25", "Asked by Kevin Mon 3/16 · no reply yet" (chairask.js askLine, the record of W3), "Scheduled". A bill heard and
// not voted on waits for decision making (W33): "Ask the chair for decision making". Never on a bill HIPHI opposes (W2).
export function askWords(b, { viewer } = {}) {
  if (!b || !wantsHearing(b) || diedish(b) || SESSION_OVER) return null;
  const words = w => ({ toString() { return w; } });
  const ahead = hearingAhead(b);
  if (ahead) return { ...words('Scheduled'), key: 'scheduled', words: 'Scheduled', h: ahead, code: ahead.committee };
  const st = stopOf(b);
  if (st.phase !== 'committee' || st.column !== 'a' && st.hearingState !== 'held' || !st.committee || !st.deadline || st.deadline.missed) return null;
  const code = st.committee, m = chairMail(code), aw = stopAsk(st), decide = st.hearingState === 'held';
  const a = chairAskOf(b, code);
  if (a) {
    const key = a.answer === 'said_no' ? 'said_no' : 'waiting', w = askLine(a);
    const quiet = ['asked', 'left_message'].includes(a.answer);
    const followUp = quiet && (workingDays(a.at, Date.now()) >= 3 || (!!aw && !aw.a.passed && workingDays(Date.now(), aw.a.at) <= 2));
    return { ...words(w), key, words: w, code, asker: a.by, at: a.at, answer: a.answer, followUp, decide, st, m, aw };
  }
  const t = askTodoOf(b);
  if (t && live(t.assignee_id)) { const w = `${cap(firstWords(t.assignee_id, viewer))} ${t.assignee_id === meOf(viewer)?.id ? 'are' : 'is'} asking${aw && !aw.a.passed ? ` · by ${aw.day}` : ''}`;
    return { ...words(w), key: 'giving', words: w, code, who: t.assignee_id, todo: t, decide, st, m, aw, by: aw?.a.at ?? null }; }
  if (aw?.a.passed) { const w = 'Notice time passed · only the chair can help now'; return { ...words(w), key: 'passed', words: w, code, decide, st, m, aw, by: aw.a.at }; }
  const w = decide ? `Ask the chair for decision making${aw ? ` by ${aw.day}` : ''}` : `Ask the chair by ${aw ? aw.day : dayWords(st.deadline.date)}`;
  return { ...words(w), key: 'ask', words: w, code, decide, st, m, aw, by: aw?.a.at ?? null };
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
      const step = { kind, b, d: pick.d, h: pick.h, state: st, whose, you: whose.you, due, until: off ? null : ms(pick.h?.scheduled_at), off };
      step.act = actBy(step); step.status = status(step);
      if (st.key === 'filed') step.doneWords = `Filed${pick.d.filed_by ? ` by ${firstWords(pick.d.filed_by, v)}` : ''}${pick.d.filed_at ? ` ${whenAt(pick.d.filed_at)}` : ''}`;
      step.line = rowLine(step, v);
      return step;
    }
  }
  const ask = askWords(b, { viewer: v });
  if (ask && ask.key !== 'scheduled') {
    const owners = ownersOf(b);
    const ids = ask.key === 'giving' ? [ask.who] : ask.key === 'waiting' || ask.key === 'said_no' ? uniq([live(ask.asker) ? ask.asker : null, ...owners]) : owners;
    const whose = { key: 'chair', ids, words: orWords(ids, v), you: !!v && ids.includes(v.id), role: 'ask' };
    const step = { kind: 'chair', b, d: null, h: null, state: null, ask, whose, you: whose.you, due: ask.key === 'ask' || ask.key === 'giving' ? ask.by : null, until: null };
    step.act = ask.key === 'ask' || ask.key === 'giving' ? { kind: 'due', at: ask.by, due: ask.by, verb: 'Ask the chair', time: ask.aw?.day || '', words: ask.words } : { kind: 'none', at: null, words: ask.words };
    step.status = ask.key === 'passed' ? { tone: 'neutral', icon: 'circle-alert', words: ask.words, time: '', soon: false } : status({ due: step.due });
    step.line = rowLine(step, v);
    return step;
  }
  const says = whereWords(b);
  const step = { kind: 'none', b, d: null, h: ask?.h || null, state: null, whose: { ids: [], words: '', you: false }, you: false, due: null, until: null, says };
  step.act = actBy({}); step.status = status({}); step.line = says;
  return step;
}
// The row's one line: verb and when for the viewer's own step ("Send for approval by today 4:00 PM"); the state, whose
// and when for someone else's ("With an approver · Kris or Nate · due today 3:00 PM", "Ready to file · Nate files it").
function rowLine(s, v) {
  if (s.kind === 'chair') return s.you || !s.whose.ids.length || s.ask.key === 'waiting' || s.ask.key === 'said_no' || s.ask.key === 'giving' || s.ask.key === 'passed' ? s.ask.words : `${s.ask.words} · ${cap(s.whose.words)} asks`;
  const st = s.state, late = s.status.tone === 'late';
  if (st.key === 'filed') return s.doneWords;
  if (st.key === 'missed') return `Missed · the hearing started ${whenAt(s.h.scheduled_at)}`;
  if (s.off) return `${st.label} · hearing cancelled, no new date yet`;
  if (s.you) {
    if (late) return `${s.act.verb} · ${lateLine(s.until, { lower: true })}`;
    if (s.kind === 'nodraft') return `Make the draft · testimony due ${whenAt(s.due)}`;
    if (st.sentBack) return `Revise and resubmit · by ${s.act.time || whenAt(s.due)}`;
    return s.act.words;
  }
  const who = s.whose.ids.length ? s.whose.words : 'no one yet', when = late ? lateLine(s.until, { lower: true }) : s.due != null ? `due ${whenAt(s.due)}` : '';
  const what = st.key === 'file' ? `Ready to file · ${cap(who)} files it` : st.key === 'write' ? `${st.label} · ${cap(who)}` : `${st.word} · ${cap(who)}`;
  return st.key === 'file' ? `${what}${late ? ' · ' + when : ''}` : [what, when].filter(Boolean).join(' · ');
}

// ---- the one step card (V07, V11, V22) ----
const SENT = { // the card's sentence, the viewer's own step
  nodraft: () => 'Make the testimony draft', write: () => 'Write the testimony, then send it for approval', submit: () => 'Send the testimony for approval',
  revise: () => 'Revise the testimony and resubmit it',
  approve: (s, v) => `Approve ${s.d?.submitted_by ? (s.d.submitted_by === v?.id ? 'your own' : `${cap(firstWords(s.d.submitted_by, v))}’s`) : 'the'} testimony`,
  second: (s, v) => `Give the second look to ${s.d?.submitted_by && s.d.submitted_by !== v?.id ? `${cap(firstWords(s.d.submitted_by, v))}’s` : 'the'} testimony`,
  file: s => `File the ${s.status.tone === 'late' ? 'late ' : ''}testimony at the Capitol`,
};
const OTHERS = { // someone else's step: who, then what
  nodraft: w => `${w} makes the draft`, write: w => `${w} writes it`, submit: w => `${w} sends it for approval`,
  revise: w => `${w} revises it`, approve: w => `${w} approves it`, second: w => `${w} gives the second look`, file: w => `${w} files it at the Capitol`,
};
const TRACK = [['write', 'Write'], ['approve', 'Approve'], ['second', 'Second look'], ['file', 'File']];
// The Write -> Approve -> File track: done steps ticked, the current one named for screen readers (aria-current="step").
// A quiet line, not tabs (V35: the v5 step bar read as tabs). The second look shows only when this bill needs one.
function trackHTML(s) {
  const d = s.d, key = s.state?.key; if (!key || key === 'missed') return '';
  const second = key === 'second' || !!d?.second_approved_by || !!d?.first_for_bill || (d && ['draft', 'review'].includes(d.status) && !Object.values(S.drafts || {}).flat().some(x => x.bill_id === d.bill_id && x.id !== d.id && (['approved', 'filed'].includes(x.status) || x.second_approved_at)));
  const steps = TRACK.filter(([k]) => k !== 'second' || second), order = steps.map(x => x[0]);
  const cur = key === 'filed' ? steps.length : Math.max(0, order.indexOf(key));
  return `<ol class="v6-track" aria-label="Testimony steps">${steps.map(([k, l], i) => `<li class="${i < cur ? 'done' : i === cur ? 'cur' : ''}"${i === cur ? ' aria-current="step"' : ''}>${i < cur ? icon('check') : `<span class="v6-track-dot" aria-hidden="true"></span>`}<span>${esc(l)}</span></li>`).join('')}</ol>`;
}
const A = (act, s, extra = {}) => ({ 'data-v6act': act, 'data-v6b': s.b.id, ...(s.d ? { 'data-v6d': s.d.id } : {}), ...(s.h ? { 'data-v6h': s.h.id } : {}), ...extra });
// The buttons of the viewer's own step: the first is the filled one where the card holds the screen's one filled button
// (`primary`), else tonal; the rest tonal or text (spec section 4: at most 4 looks).
function stepButtons(s, v, primary) {
  const k = primary ? 'primary' : 'secondary', out = [], d = s.d;
  const doc = d?.doc_url ? docBtn(d.doc_url, { kind: 'secondary' }) : '';
  switch (s.kind) {
    case 'nodraft': out.push(btn(S.draftAsked?.[s.h.id] ? 'Making the draft…' : 'Make the draft now', { kind: k, icon: 'file-text', attrs: A('draftnow', s) })); break;
    case 'write': case 'submit': out.push(btn('Send for approval', { kind: k, icon: 'send', attrs: A('submit', s) }), doc); break;
    case 'revise': out.push(btn('Resubmit', { kind: k, icon: 'send', attrs: A('submit', s) }), doc); break;
    case 'approve': case 'second': out.push(btn('Approve', { kind: k, icon: 'check', attrs: A('approve', s) }), btn('Send back', { kind: 'secondary', icon: 'undo-2', attrs: A('sendback', s) }), d?.doc_url ? docBtn(d.doc_url, { kind: 'text' }) : ''); break;
    case 'file': out.push(btn('Mark filed', { kind: k, icon: 'clipboard-check', attrs: A('filed', s) }), btn('File at the Capitol', { kind: 'secondary', iconEnd: 'external-link', href: capitolUrl(s.b), target: '_blank' }), d?.doc_url ? docBtn(d.doc_url, { kind: 'text' }) : ''); break;
    case 'missed': out.push(btn('Yes, mark filed (late)', { kind: 'secondary', icon: 'clipboard-check', attrs: A('filed', s, { 'data-v6late': '1' }) }), btn('No, we didn’t file', { kind: 'text', attrs: A('nofile', s) }), btn('How did it go?', { kind: 'text', icon: 'message-square', href: `${billRoute(s.b, 'activity')}?reply=1` })); break;
    case 'chair': {
      const a = s.ask, m = a.m, mail = m && (a.key === 'ask' || a.key === 'giving') ? chairAskMail(a.code, [s.b], a.decide ? { dl: a.st.deadline, heardAt: new Date().toISOString() } : { dl: a.st.deadline }) : null;
      const to = m ? (m.n > 1 ? 'Email the chairs' : 'Email the chair') : '';
      if (a.key === 'ask' && mail) out.push(btn(to, { kind: k, icon: 'mail', href: mail.href }), btn('Give to…', { kind: 'text', icon: 'user-round', attrs: A('giveask', s, { 'data-v6code': a.code, 'aria-haspopup': 'dialog' }) }));
      else if (a.key === 'giving' && mail) out.push(btn(to, { kind: k, icon: 'mail', href: mail.href }), btn('Done, I asked', { kind: 'secondary', icon: 'check', attrs: A('askdone', s, { 'data-v6code': a.code }) }));
      else if (a.key === 'waiting' || a.key === 'said_no') out.push(btn('They replied', { kind: a.followUp ? k : 'secondary', icon: 'message-square', attrs: A('replied', s, { 'data-v6code': a.code, 'aria-haspopup': 'dialog' }) }));
      break;
    }
    case 'filed': if (mayUnfile(d, s.b)) out.push(`<button type="button" class="linkbtn v6-unfile" ${Object.entries(A('unfile', s)).map(([x, y]) => `${x}="${esc(y)}"`).join(' ')}>Undo filed</button>`); break;
  }
  return out.filter(Boolean).join('');
}
// The hearing line under a testimony step: committee in words, day, time and room, who is going, and the I'm going
// toggle, opening the sitting's page. "Moved from Mon 3/9" for 3 days after a sitting moved (W24); a cancelled sitting
// with no new date says only that.
function hearingLineHTML(h, v, from) {
  if (!h) return '';
  const name = committeeName(h.committee) || h.committee, href = `#/hearing/${encodeURIComponent(h.id)}${from ? `?from=${encodeURIComponent(from)}` : ''}`;
  if (h.status === 'cancelled') return `<div class="v6-step-hear"><a class="v6-step-hl" href="${esc(href)}">${icon('landmark')}<span><b>${esc(name)}</b> · hearing cancelled, no new date yet</span>${icon('chevron-right', { cls: 'v6-chev' })}</a></div>`;
  const past = ms(h.scheduled_at) <= Date.now(), moved = movedFrom(h), lead = leadRow(h), on = goingOn(h, v);
  return `<div class="v6-step-hear"><a class="v6-step-hl" href="${esc(href)}">${icon('landmark')}<span><b>${esc(name)}</b> · ${esc(whenAt(h.scheduled_at))}${h.room ? ` · ${esc(roomName(h.room))}` : ''}${moved ? ` · moved from ${esc(moved)}` : ''}</span>${icon('chevron-right', { cls: 'v6-chev' })}</a>
    <p class="v6-step-go">${icon('users')}<span>${esc(goingWords(h, { viewer: v }))}</span>${past ? '' : goingBtn(on, { 'data-v6act': 'going', 'data-v6h': lead.id }, { kind: 'secondary', sm: true })}</p></div>`;
}
// stepCard(b, { viewer, where, d, h, primary, big, id }) -> the card for a bill's current step.
//   where: 'today' (the next-step card), 'pane' (the open item), 'bill', 'hearing' (no hearing line: the page is it),
//          'testimony', 'team' (read-only: no buttons for anyone).
//   primary: false when another filled button owns the screen (spec section 4: one filled per screen or region).
// The viewer's own step gets its buttons; someone else's gets its status line and no button ("Ready to file · Nate files
// it"). Same words, same order everywhere (V07). The tile at the top carries the one time to act (or, for someone else's
// step, where it stands); the lines under the sentence never say it again (A-14).
export function stepCard(b, { viewer, where = 'pane', d, h, primary = true, big = false, id = '' } = {}) {
  const v = meOf(viewer), s = billStep(b, { viewer: v, ...(d !== undefined ? { d } : {}), ...(h !== undefined ? { h } : {}) }); if (!s) return '';
  const ro = where === 'team', own = s.you && !ro, hid = id || `v6s-${esc(b.id)}${s.d ? '-' + esc(s.d.id) : ''}`;
  const c = s.kind === 'chair' ? chairCard(s, v, own) : s.kind === 'none' ? { what: s.says || 'Nothing to do on it now' } : testimonyCard(s, v, own);
  const eyebrow = s.kind === 'chair' ? `Getting a hearing${s.ask.code ? ' · ' + committeeName(s.ask.code) : ''}` : s.h ? `Testimony · ${committeeName(s.h.committee) || s.h.committee}` : 'Where it stands';
  const acts = own || (s.kind === 'filed' && !ro) ? stepButtons(s, v, primary) : '';
  const hear = where === 'hearing' || s.kind === 'chair' ? '' : hearingLineHTML(s.h, v, where === 'pane' ? 'today' : where);
  return `<section class="v6-step ${own ? 'own' : 'others'} k-${esc(s.kind)}${big ? ' big' : ''}${s.kind === 'missed' ? ' closing' : ''} w-${esc(where)}" data-v6step="${esc(b.id)}" aria-labelledby="${hid}">
    <p class="v6-step-eyebrow">${esc(eyebrow)}</p>
    <h3 class="v6-step-what" id="${hid}">${esc(c.what)}</h3>
    ${c.tile?.words || c.when ? `<div class="v6-step-meta">${statusTile(c.tile)}${c.when ? `<span class="v6-step-when">${esc(c.when)}</span>` : ''}</div>` : ''}
    ${s.kind === 'chair' || s.kind === 'none' ? '' : trackHTML(s)}${c.note || ''}
    ${c.who ? `<p class="v6-step-who">${esc(c.who)}</p>` : ''}
    ${acts ? `<div class="v6-step-acts">${acts}</div>` : ''}
    ${noOwnerHTML(b, v, ro)}${hear}
  </section>`;
}
// A testimony step's words. Own: the tile is the time to act ("Send for approval by today 4:00 PM"), with the Capitol's
// deadline under the sentence when the hand-on time is earlier. Someone else's: the tile is the state ("With an
// approver"), the sentence who does it, the line when testimony is due. Late is amber, overdue red, on either.
function testimonyCard(s, v, own) {
  const st = s.state, tone = s.status.tone;
  if (st.key === 'filed') return { tile: s.status, what: s.doneWords };
  if (st.key === 'missed') return { tile: s.status, what: own || !s.whose.ids.length ? 'The hearing has started. Did we file?' : 'Not filed before the hearing',
    when: `The hearing started ${whenAt(s.h.scheduled_at)}.` };
  const tile = tone === 'late' || tone === 'overdue' ? s.status
    : own ? (s.act.words ? { tone: 'neutral', icon: s.status.soon ? 'clock' : 'calendar', words: s.act.words } : null)
    : { tone: 'neutral', icon: '', words: st.label };
  const what = own ? SENT[s.kind](s, v) : OTHERS[s.kind](cap(s.whose.words || 'No one yet'));
  let when = '';
  if (s.off) when = 'The hearing was cancelled; no new date yet.';
  else if (s.due != null && (own ? ['hand', 'now'].includes(s.act.kind) : tone !== 'late')) when = `Testimony is due ${whenAt(s.due)}.`;
  let note = '';
  if (st.sentBack) note = `<blockquote class="v6-step-note"><span class="v6-step-nl">Sent back</span>${esc(s.d.review_note)}</blockquote>`;
  if (st.stale && st.key === 'write') note += `<p class="v6-step-warn">${icon('triangle-alert')}<span>The bill is now ${esc(versionWords(s.b.current_version))}: check the testimony before it goes out.</span></p>`;
  return { tile, what, when, note, who: s.whose.anyone ? 'Open to anyone: nobody holds it yet.' : filerWords(s.d, s.b, v, own) };
}
// A chair ask's words: "Ask Rep. Takayama for a hearing" with the notice day as the tile; once asked, "Kevin asked Rep.
// Takayama for a hearing" with the reply as the tile, and after 3 working days with no reply (or 2 before the notice)
// the line says to follow up, with the office phone (V13).
function chairCard(s, v, own) {
  const a = s.ask, chair = a.m ? a.m.who : 'the chair', what0 = a.decide ? 'to schedule decision making' : 'for a hearing';
  if (a.key === 'waiting' || a.key === 'said_no') {
    const reply = askReply(a), ph = phoneOf(a.code);
    return { tile: { tone: 'neutral', icon: a.answer === 'said_no' ? 'circle-x' : a.answer === 'will_schedule' ? 'calendar' : 'hourglass', words: cap(reply) },
      what: `${cap(firstWords(a.asker, v))} asked ${chair} ${what0}`,
      when: a.followUp && own ? `Asked ${dayWords(a.at)}. No reply yet: follow up${ph ? ` at ${ph}` : ''}.` : `Asked ${dayWords(a.at)}.` };
  }
  if (a.key === 'passed') return { tile: { tone: 'neutral', icon: 'circle-alert', words: 'Notice time passed' }, what: `Only ${chair} can help now`,
    when: cap(deadlineWords(a.st.deadline.label, a.st.deadline.date)) + '.' };
  const due = status({ due: a.by }), tile = { ...due, icon: due.tone === 'neutral' ? (due.soon ? 'clock' : 'calendar') : due.icon, words: due.tone === 'neutral' ? `Ask by ${a.aw?.day || dayWords(a.st.deadline.date)}` : due.words };
  const who = s.whose.ids.length ? cap(s.whose.words) : '';
  const what = own ? `Ask ${chair} ${what0}` : a.key === 'giving' ? `${who} ${s.whose.ids.length > 1 ? 'are' : 'is'} asking ${chair} ${what0}` : who ? `${who} ${s.whose.ids.length > 1 ? 'ask' : 'asks'} ${chair} ${what0}` : `Ask ${chair} ${what0}`;
  const when = a.aw?.a.notice ? `The notice has to post by ${dayWords(a.aw.a.notice)} for it to ${gateNeed(a.st.deadline.label, 1)} by ${dayWords(a.st.deadline.date)}.` : cap(deadlineWords(a.st.deadline.label, a.st.deadline.date)) + '.';
  return { tile, what, when, who: !own && !s.whose.ids.length ? 'No owner yet' : '' };
}
const phoneOf = code => { const id = chairIdsOf(code)[0], l = id && legById(id); return l?.phone || ''; };
// A live bill with a position and no owner says so, with Take it (R-330, W42); Give to… for admins and its issue's owner.
function noOwnerHTML(b, v, ro) {
  if (ro || !v || ownersOf(b).length || !b.position || b.position === 'monitor' || b.tracked === false || diedish(b)) return '';
  const io = (S.billIssues || []).filter(x => x.bill_id === b.id).map(x => (S.issues || []).find(i => i.id === x.issue_id)).find(i => i && live(i.owner_id));
  const give = v.is_admin || io?.owner_id === v.id;
  return `<p class="v6-step-noown">${icon('user-round')}<span>${esc(io ? `No owner yet · ${io.owner_id === v.id ? 'you own' : cap(firstWords(io.owner_id, v)) + ' owns'} its issue` : 'No owner yet')}</span>${btn('Take it', { kind: 'secondary', sm: true, attrs: { 'data-v6act': 'take', 'data-v6b': b.id } })}${give ? btn('Give to…', { kind: 'text', sm: true, attrs: { 'data-v6act': 'giveto', 'data-v6b': b.id, 'aria-haspopup': 'dialog' } }) : ''}</p>`;
}

// ---- the hearing card (V13, V14) ----
// hearingCard(sitting, { viewer, big, from, id }): time and room large, who is going with the I'm going toggle on the
// card, and each of our bills on it with its testimony state. `sitting`: a hearing row (its sitting is every row with
// the same committee and start), or { h }. `big`: the phone's hearing-day card (time 28px, 56px rows).
// Monitor bills are one quiet line at the end, so the card is about the bills we work on (R-022 decision 4).
export function hearingCard(sitting, { viewer, big = false, from = '', id = '' } = {}) {
  const h = sitting?.h || sitting; if (!h) return '';
  const v = meOf(viewer), rows = sittingRows(h), now = Date.now(), at = ms(h.scheduled_at), cancelled = rows.every(r => r.status === 'cancelled');
  const hid = id || `v6h-${esc(h.id)}`, href = `#/hearing/${encodeURIComponent(h.id)}${from ? `?from=${encodeURIComponent(from)}` : ''}`;
  const items = rows.map(r => ({ h: r, b: billById(r.bill_id) })).filter(x => x.b && x.b.tracked !== false && x.h.status !== 'cancelled');
  const pos = items.filter(x => x.b.position && x.b.position !== 'monitor'), mon = items.filter(x => !x.b.position || x.b.position === 'monitor');
  const today = hday(at) === hday(now), past = at <= now, moved = movedFrom(h);
  const day = today ? 'Today' : hday(at) === hday(now + DAY) ? 'Tomorrow' : dayWords(at);
  const bill = x => { const d = sittingDraft(x.h, x.b.id), s = billStep(x.b, { viewer: v, d: d || null, h: x.h }), own = s.you && rowButtonOK(s);
    return `<li class="v6-hcard-bill"><a class="v6-hcard-bl" href="${esc(billRoute(x.b))}"><span class="v6-row-top"><span class="v6-row-name">${esc(nameWords(x.b))}</span><span class="v6-row-num">${esc(numWords(x.b))}</span></span>
      <span class="v6-row-line${s.status.tone !== 'neutral' ? ' t-' + esc(s.status.tone) : s.status.soon && s.you ? ' soon' : ''}">${s.status.tone !== 'neutral' && s.status.icon ? icon(s.status.icon) : s.status.soon && s.you ? icon('clock') : ''}<span>${esc(s.line)}</span></span></a>${own ? `<span class="v6-row-act">${rowButton(s)}</span>` : ''}</li>`; };
  const going = past || cancelled ? '' : goingBtn(goingOn(h, v), { 'data-v6act': 'going', 'data-v6h': leadRow(h).id }, { kind: 'secondary', sm: !big });
  const stream = !cancelled && today ? streamOf(h) : null;
  return `<article class="v6-hcard${big ? ' big' : ''}${cancelled ? ' cancelled' : ''}${past ? ' past' : ''}" aria-labelledby="${hid}">
    <div class="v6-hcard-when"><p class="v6-hcard-time">${esc(timeWords(at))}</p><p class="v6-hcard-day">${esc(day)}${h.room && !cancelled ? `<span class="v6-hcard-room">${esc(roomName(h.room))}</span>` : ''}</p></div>
    <div class="v6-hcard-body">
      <h3 class="v6-hcard-name" id="${hid}"><a href="${esc(href)}">${esc(committeeName(h.committee) || h.committee)}${isDecision(h) ? ' · decision making' : ''}</a></h3>
      ${cancelled ? '<p class="v6-hcard-note">Cancelled, no new date yet</p>' : moved ? `<p class="v6-hcard-note">${icon('calendar')}<span>Moved from ${esc(moved)}${goingOn(h, v) ? ' · still going?' : ''}</span></p>` : ''}
      ${cancelled ? '' : `<p class="v6-hcard-going">${icon('users')}<span>${esc(goingWords(h, { viewer: v }))}</span>${going}</p>`}
      ${pos.length ? `<ul class="v6-hcard-bills">${pos.map(bill).join('')}</ul>` : ''}
      ${mon.length ? `<p class="v6-hcard-mon">${pos.length ? 'Also heard: ' : ''}${mon.length === 1 ? `1 bill we monitor` : `${mon.length} bills we monitor`}</p>` : ''}
      ${stream ? `<p class="v6-hcard-watch"><a href="${esc(stream.url)}" target="_blank" rel="noopener">${icon('video')}<span>Watch it live</span></a></p>` : ''}
    </div>
  </article>`;
}

// ---- rows (V04, D15, D16) ----
// D16: a row carries its one tonal button only when the step is the viewer's own and is due today, late, or a chair ask
// inside its notice window (a week or less to the day the notice must post). Other rows open on click.
export function rowButtonOK(s) {
  if (!s || !s.you) return false;
  if (s.kind === 'chair') return s.ask.key === 'waiting' ? !!s.ask.followUp : (s.ask.key === 'ask' || s.ask.key === 'giving') && s.ask.by != null && s.ask.by - Date.now() <= 7 * DAY;
  if (['filed', 'none'].includes(s.kind)) return false;
  if (s.kind === 'missed') return true;
  const t = s.status.tone; if (t === 'late' || t === 'overdue') return true;
  const at = s.act?.at ?? s.due; return at != null && hday(at) <= hday(Date.now());
}
// The row's button: the step's own verb, tonal. An approval goes to Review mode, which reads the draft first (P1).
export function rowButton(s, { kind = 'secondary' } = {}) {
  const a = (act, x = {}) => A(act, s, x);
  switch (s.kind) {
    case 'nodraft': return btn('Make the draft now', { kind, sm: true, attrs: a('draftnow') });
    case 'write': case 'submit': return btn('Send for approval', { kind, sm: true, attrs: a('submit') });
    case 'revise': return btn('Resubmit', { kind, sm: true, attrs: a('submit') });
    case 'approve': case 'second': return btn('Review', { kind, sm: true, href: `#/review/${encodeURIComponent(s.d.id)}` });
    case 'file': return btn('Mark filed', { kind, sm: true, attrs: a('filed') });
    case 'missed': return btn('Did we file?', { kind, sm: true, attrs: a('filed', { 'data-v6late': '1' }) });
    case 'chair': { const x = s.ask;
      if (x.key === 'waiting') return btn('They replied', { kind, sm: true, attrs: a('replied', { 'data-v6code': x.code, 'aria-haspopup': 'dialog' }) });
      const mail = x.m ? chairAskMail(x.code, [s.b], { dl: x.st.deadline }) : null;
      return mail ? btn(x.m.n > 1 ? 'Email the chairs' : 'Email the chair', { kind, sm: true, href: mail.href }) : ''; }
  }
  return '';
}
// billRow(b, { viewer, line, button, href, pick, selected, hint, step, cls }) -> one bill: its name (Poppins 18), its
// number small, and one 16px line; the whole row opens it (a link, or `pick` for a list with the item beside it). No
// tiles, no "+N on this bill", no room, codes or history (those live in the open item). `line` and `button` override
// what the step says; `button: false` draws none.
export function billRow(b, { viewer, line, button, href, pick, selected = false, hint = false, step, cls = '' } = {}) {
  if (!b) return '';
  const v = meOf(viewer), s = step || billStep(b, { viewer: v });
  const tone = line == null ? s.status.tone : '', ic = line != null ? '' : tone !== 'neutral' ? s.status.icon : s.status.soon && s.you ? 'clock' : '';
  const text = line != null ? line : esc(s.line);
  const btnHtml = button === false ? '' : button ? button : rowButtonOK(s) ? rowButton(s) : '';
  return rowHTML({ key: b.id, name: nameWords(b), num: numWords(b), line: text, tone, icon: ic, bold: line == null && s.status.soon && s.you, href: href || billRoute(b), pick, selected, hint, button: btnHtml, cls, bill: b.id });
}
// itemRow({ key, name, num, line, tone, icon, href, pick, button, selected, hint, cls }) -> any other item (a to-do, an
// email, a person) in the same shape. `line` is HTML (escape it); `name` and `num` are text.
export const itemRow = o => rowHTML(o);
function rowHTML({ key = '', name = '', num = '', line = '', tone = '', icon: ic = '', bold = false, href = '', pick, selected = false, hint = false, button = '', cls = '', bill = '' }) {
  const tag = href ? 'a' : 'button', attr = `${href ? `href="${esc(href)}"` : 'type="button"'}${pick != null ? ` data-v6pick="${esc(pick)}"` : ''}${selected ? ' aria-current="true"' : ''}${bill ? ` data-bill="${esc(bill)}"` : ''}`;
  return `<div class="v6-row${selected ? ' sel' : ''}${hint ? ' hint' : ''}${cls ? ' ' + cls : ''}"${key ? ` data-v6row="${esc(key)}"` : ''}>
    <${tag} class="v6-row-main" ${attr}><span class="v6-row-top"><span class="v6-row-name">${esc(name)}</span>${num ? `<span class="v6-row-num">${esc(num)}</span>` : ''}</span>${line ? `<span class="v6-row-line${tone && tone !== 'neutral' ? ' t-' + esc(tone) : ''}${bold ? ' soon' : ''}">${ic ? icon(ic) : ''}<span>${line}</span></span>` : ''}</${tag}>${button ? `<span class="v6-row-act">${button}</span>` : ''}</div>`;
}

// ---- the list with the picked item beside it (V17) ----
// listDetail({ id, label, rows, picked, detail, empty, back }) -> the list and the panel. Designed at 1280 first: the
// panel is about 380px beside the list from 1100px; nothing opens by itself (a calm "Pick one to see its steps" fills
// the panel, and the first row is highlighted as a hint). Below 1100px the picked item is its own page with Back.
// The screen keeps what is picked in ldPicked(id) and passes `detail` (its HTML) on each draw; wireListDetail does the rest.
export const ldPicked = id => S.v6ld?.[id]?.key ?? null;
export function listDetail({ id, label = 'List', rows = '', picked = ldPicked(id), detail = '', empty = 'Pick one to see its steps', back = 'Back to the list' }) {
  const open = picked != null && !!detail;
  const list = rows.replace(/class="v6-row(?![\w-])/, open ? 'class="v6-row' : 'class="v6-row hint');
  return `<div class="v6-ld${open ? ' open' : ''}" data-v6ld="${esc(id)}">
    <div class="v6-ld-list" role="list" aria-label="${esc(label)}">${list}</div>
    <aside class="v6-ld-detail" aria-label="The item you picked">${open ? `<button type="button" class="v6-ld-back" data-v6ldback>${icon('chevron-left')}<span>${esc(back)}</span></button>${detail}` : `<p class="v6-ld-empty">${icon('arrow-left')}<span>${esc(empty)}</span></p>`}</aside>
  </div>`;
}
const wide = () => { try { return matchMedia('(min-width: 1100px)').matches; } catch { return true; } };
// wireListDetail(root, { id, open: key => html, onChange }) : a click on a row's [data-v6pick] opens it beside the list
// (or as its own page below 1100px); Back (the browser's, the phone's gesture or the Back button) closes it, keeps the
// list's scroll and puts the focus back on the row (spec 7.10). A row's own button never opens the item.
export function wireListDetail(root, { id, open, onChange } = {}) {
  const box = root?.querySelector?.(`[data-v6ld="${CSS.escape(id)}"]`); if (!box || box.dataset.v6wired) return;
  box.dataset.v6wired = '1';
  const st = () => (S.v6ld ??= {})[id] ??= { key: null, y: 0 };
  const draw = key => {
    const aside = box.querySelector('.v6-ld-detail'), html = key != null ? open?.(key) || '' : '';
    box.classList.toggle('open', !!html);
    box.querySelectorAll('.v6-row').forEach(r => { const on = r.querySelector('[data-v6pick]')?.dataset.v6pick === String(key); r.classList.toggle('sel', on); r.classList.remove('hint'); r.querySelector('[data-v6pick]')?.toggleAttribute('aria-current', on); });
    if (!html) { const f = box.querySelector('.v6-row'); f?.classList.add('hint'); aside.innerHTML = `<p class="v6-ld-empty">${icon('arrow-left')}<span>Pick one to see its steps</span></p>`; return; }
    aside.innerHTML = `<button type="button" class="v6-ld-back" data-v6ldback>${icon('chevron-left')}<span>Back to the list</span></button>${html}`;
    wireClose();
    aside.scrollTop = 0;
    const head = aside.querySelector('h2, h3'); if (head) { head.setAttribute('tabindex', '-1'); head.focus({ preventScroll: true }); }
    if (!wide()) window.scrollTo(0, Math.max(0, box.getBoundingClientRect().top + window.scrollY - 72));
  };
  const close = ({ fromButton = false, fromBack = false } = {}) => {
    const s = st(), key = s.key; s.key = null; draw(null); onChange?.(null);
    if (!fromBack) S.panelClosed?.();
    if (!wide()) window.scrollTo(0, s.y || 0);
    const row = [...box.querySelectorAll('[data-v6pick]')].find(x => x.dataset.v6pick === String(key)); row?.focus({ preventScroll: true });
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
  if (st().key != null && box.classList.contains('open') && history.state?.panel) S.panelOpened?.(() => close({ fromBack: true }));
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
let approvedAt = -1e4;
const ACTS = {
  async submit(el, b, d) { await busy(el, async () => {
    await DB.transition(b.id, d.id, 'submit');
    const who = whoseStep(draftById(b.id, d.id) || d, b).words;
    toast(who ? `Sent to ${who} for approval. You file it once it is approved.` : 'Sent for approval.', { ok: true, undo: async () => { await DB.transition(b.id, d.id, 'withdraw'); toast('Pulled back to draft.'); redraw(); } });
    redraw(); }); },
  async approve(el, b, d) {
    // A leftover second tap never approves the next step that lands in the same spot (review mode's guard, build 3).
    if (performance.now() - approvedAt < 1000) return;
    await busy(el, async () => {
      await DB.transition(b.id, d.id, 'approve'); approvedAt = performance.now();
      const nd = draftById(b.id, d.id) || d, f = filerOf(nd);
      const next = nd.status === 'second_review' ? `Approved. ${cap(whoseStep(nd, b).words) || 'A second approver'} gives the second look next.`
        : f === S.me?.id ? 'Approved. File it at the Capitol next.' : `Approved. ${f ? cap(firstWords(f)) : 'The owner'} files it next.`;
      toast(next, { ok: true, undo: async () => { await DB.transition(b.id, nd.id, 'unapprove'); toast('Approval undone. It is waiting for you again.'); redraw(); } });
      redraw(); }); },
  sendback(el, b, d) {
    const to = d.submitted_by && d.submitted_by !== S.me?.id ? cap(firstWords(d.submitted_by)) : '';
    openSheet({ title: 'What should change?', size: 'auto',
      body: `<div class="field"><label for="v6-sb">${to ? `Your note for ${esc(to)}` : 'Your note'}</label><textarea id="v6-sb" rows="4" required aria-describedby="v6-sb-e" placeholder="Say what to fix, so the next version is the last one."></textarea><span class="err" id="v6-sb-e" hidden>${icon('circle-alert')}Write what should change first.</span></div>`,
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
          delete S.v6Held['sb:' + d.id]; closeSheet({ silent: true }); redraw();
          toast(to ? `Sent back to ${to} with your note. ${to} revises and resubmits it.` : 'Sent back with your note.', { undo: async () => { if (await undo()) { redraw(); toast('Not sent back. It is waiting for you again.'); } } });
        };
      } });
  },
  filed(el, b, d) {
    if (HOOKS.file) return HOOKS.file(b, d, { late: el?.dataset.v6late === '1', after: redraw });
    const late = el?.dataset.v6late === '1';
    openSheet({ title: `Filed the ${esc(sayWords(b))} testimony${late ? ' (late)' : ''}?`, size: 'auto',
      body: `${field('v6-furl', 'Capitol confirmation link (optional)', '<input id="v6-furl" type="url" inputmode="url" autocomplete="off" placeholder="https://">', 'Paste the link from the Capitol’s confirmation, if you have it.')}<p class="err" id="v6-furl-e" role="alert" hidden>That does not look like a web address. It starts with https://</p>`,
      foot: `${btn('File at the Capitol', { kind: 'text', href: capitolUrl(b), target: '_blank', iconEnd: 'external-link' })}${btn('Mark filed', { kind: 'primary', icon: 'clipboard-check', attrs: { 'data-go': '1' } })}`,
      wire: dlg => {
        const go = dlg.querySelector('[data-go]'), inp = dlg.querySelector('#v6-furl'), er = dlg.querySelector('#v6-furl-e');
        inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); go.click(); } });
        go.onclick = () => { const url = inp.value.trim();
          if (url && !/^https?:\/\/[^\s/$.?#][^\s]*\.[^\s]{2,}$/i.test(url)) { er.hidden = false; inp.setAttribute('aria-invalid', 'true'); inp.focus(); return; }
          busy(go, async () => {
            await DB.transition(b.id, d.id, 'file', null, url); closeSheet({ silent: true });
            toast(`Filed. ${sayWords(b)} is done for ${committeeName(d.committee) || d.committee}.`, { ok: true, undo: async () => { await DB.transition(b.id, d.id, 'unfile'); toast('Filing undone. It is approved and ready to file again.'); redraw(); } });
            redraw(); }); };
      } });
  },
  async unfile(el, b, d) { const url = d.filed_url || null; await busy(el, async () => {
    await DB.transition(b.id, d.id, 'unfile');
    toast('Filing undone. It is approved and ready to file again.', { undo: async () => { await DB.transition(b.id, d.id, 'file', null, url); redraw(); } }); redraw(); }); },
  // V25: "No, we didn't file" is recorded on the bill's timeline (no red, no migration) and leaves Today with Undo.
  async nofile(el, b, d) { await busy(el, async () => {
    const h = draftHearing(d), title = `Testimony not filed for the ${committeeName(d.committee) || d.committee} hearing${h ? ' ' + dayWords(h.scheduled_at) : ''}`;
    await DB.addActivity(b.id, 'testimony', title); (S.v6NoFile ??= new Set()).add(String(d.id));
    toast('Noted on the bill: not filed. It leaves your list.', { undo: async () => { S.v6NoFile.delete(String(d.id)); redraw(); } }); redraw(); }); },
  async draftnow(el, b, d, h) { const { makeDraftNow } = await import('./testimony.js'); return makeDraftNow(h); },
  async going(el, b, d, h) {
    const rows = sittingRows(h), mine = rows.filter(r => (S.attend?.[r.id] || []).includes(S.me?.id)), on = mine.length > 0, name = committeeName(h.committee) || h.committee;
    await busy(el, async () => {
      if (!on) await DB.attend(h.id, true); else for (const r of mine) await DB.attend(r.id, false);
      toast(on ? `Taken off the list for the ${name} hearing.` : `You’re going to the ${name} hearing ${whenAt(h.scheduled_at)}.`, { ok: !on,
        undo: async () => { if (on) { for (const r of mine) await DB.attend(r.id, true); } else await DB.attend(h.id, false); redraw(); } });
      redraw(); });
  },
  replied(el, b, d, h, code) { return answerSheet([b.id], code); },
  giveask(el, b, d, h, code) { return giveAsk([{ b, st: stopOf(b) }], code, redraw); },
  async askdone(el, b, d, h, code) { const t = askTodoOf(b); await busy(el, async () => {
    if (t) await DB.updateTodo(b.id, t.id, { done: true });
    const unlog = await logAsk(b, code);
    toast(`Done: the ask is logged, so the team sees “Asked by ${firstWords(S.me?.id, { id: null })}” on ${sayWords(b)}.`, { ok: true, undo: async () => { if (t) await DB.updateTodo(b.id, t.id, { done: false }); await unlog(); redraw(); } });
    redraw(); }); },
  async take(el, b) { await busy(el, async () => { await DB.setOwner(b.id, S.me.id);
    toast(`You own ${sayWords(b)} now.`, { ok: true, undo: async () => { await DB.setOwner(b.id, null); redraw(); } }); redraw(); }); },
  giveto(el, b) {
    const owner = ownersOf(b)[0] || '';
    pickerSheet({ title: `Who owns ${esc(sayWords(b))}?`, value: owner, options: (S.advocates || []).filter(a => a.is_active !== false).map(a => [a.id, a.id === S.me?.id ? `${a.full_name} (you)` : a.full_name, 'user-round']),
      onPick: async id => { if (id === owner) return; try { await DB.setOwner(b.id, id); toast(id === S.me?.id ? `${sayWords(b)} is yours now.` : `${sayWords(b)} is ${cap(firstWords(id))}’s now. They get a Slack message.`, { ok: true, undo: async () => { await DB.setOwner(b.id, owner || null); redraw(); } }); redraw(); } catch (e) { toast(e, { err: true }); } } });
  },
};
// Delegated once (capture is not needed: nothing here sits inside another clickable row's handler, and a row's button
// sits beside its link, never inside it).
if (typeof document !== 'undefined' && document.addEventListener) document.addEventListener('click', e => {
  const el = e.target?.closest?.('[data-v6act]'); if (!el || el.closest('dialog') || el.tagName === 'A') return;
  const fn = ACTS[el.dataset.v6act]; if (!fn) return;
  e.preventDefault(); e.stopPropagation();
  const b = billById(el.dataset.v6b), d = b && el.dataset.v6d ? draftById(b.id, el.dataset.v6d) : null;
  const h = el.dataset.v6h ? (S.hearings || []).find(x => String(x.id) === el.dataset.v6h) || null : null;
  if (!b && el.dataset.v6act !== 'going') return;
  if (['submit', 'approve', 'sendback', 'filed', 'unfile', 'nofile'].includes(el.dataset.v6act) && !d) return;
  fn(el, b, d, h, el.dataset.v6code || '');
});
// "No, we didn't file" (V25): recorded this visit, or on the bill's timeline ("Testimony not filed for the Senate Health
// and Human Services hearing Mon 3/16"), the card is not asked again.
export function notFiled(d, b = billById(d?.bill_id)) {
  if (!d || d.status === 'filed') return false;
  if (S.v6NoFile?.has(String(d.id))) return true;
  const h = draftHearing(d), t = `Testimony not filed for the ${committeeName(d.committee) || d.committee} hearing${h ? ' ' + dayWords(h.scheduled_at) : ''}`;
  return [...(S.feed || []), ...(S.recentEvents || [])].some(e => e.bill_id === b?.id && e.title === t);
}
