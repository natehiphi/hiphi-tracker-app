// The model of an ask to a chair (R-398 piece 5, flow 4): worked out from the rows the app already keeps in legislator_notes (answer: asked | will_schedule | said_no | left_message,
// with the committee and the bill), the newest row of each chair winning. Nothing here draws or writes; do_reply.js and the pages read it, and the tests call the pure functions.
// Read staff6/model.js chairAskOf for the same rows seen the old way: this file keeps each chair's answer apart, which the old one folds into a single answer.
import { S, SESSION_OVER } from '../staff6/data.js';
import { legNotesAll, chairIdsOf, isAskNote, stopOf, diedish, codesOf, legById, askBy, companionsOf, billByNum, hearingAhead } from '../staff6/model.js';
import { billName, billNo, first, cmteWords, issueOf, leadsFor } from './steps.js';

const HST = { timeZone: 'Pacific/Honolulu' };
export const WAIT_DAYS = 3;     // working days of quiet before the follow-up is due (Nate's 3, R-398)
export const NOTICE_DAYS = 2;   // working days before the day a committee must announce a hearing
const DAY = 864e5;

// ---------------------------------------------------------------------------------- working days (Monday to Friday)
// Holidays are NOT taken out (R-398 build choice d): a state holiday counts as a working day, so a follow-up can fall due a day early across one. The Capitol's closed days are not in the data yet;
// when they are, isWork is the one place to change.
export const ymd = t => new Date(t).toLocaleDateString('en-CA', HST);
const noon = d => new Date(`${d}T12:00:00-10:00`);
export const isWork = d => { const w = noon(d).getUTCDay(); return w !== 0 && w !== 6; };
const step = (d, k) => { const t = noon(d); t.setUTCDate(t.getUTCDate() + k); return ymd(t); };
// n working days after (n > 0) or before (n < 0) a day; a weekend day counts from the next working day on, so Thursday + 3 is Tuesday
export function shiftWork(d, n) {
  let day = d, left = Math.abs(n); const k = n < 0 ? -1 : 1;
  while (left > 0) { day = step(day, k); if (isWork(day)) left--; }
  return day;
}
// working days from `from` up to and including `to` (negative when `to` is earlier)
export function workBetween(from, to) {
  if (from === to) return 0;
  const k = from < to ? 1 : -1; let day = from, n = 0;
  while (day !== to) { day = step(day, k); if (isWork(day)) n += k; }
  return n;
}
// "Thu, Mar 12" from a time or a day
export const dayWords = d => { if (!d) return ''; const t = String(d).length === 10 ? noon(d) : new Date(d); return t.toLocaleDateString('en-US', { ...HST, weekday: 'short', month: 'short', day: 'numeric' }); };

// ---------------------------------------------------------------------------------- who holds an ask (kept in this visit; live it will be the to-do row staff6 makes)
// key -> { to: advocate id, by: advocate id, at } ; nothing here is sent anywhere
const HK = 'hiphi7_ask_holds';
const holds = (() => { try { return JSON.parse(sessionStorage.getItem(HK)) || {}; } catch { return {}; } })();
const keepHolds = () => { try { sessionStorage.setItem(HK, JSON.stringify(holds)); } catch { /* the page still works without it */ } };
export const holdOf = key => holds[key] || null;
export function setHold(key, v) { if (v) holds[key] = v; else delete holds[key]; keepHolds(); }

// ---------------------------------------------------------------------------------- "Decide what next" closed for now (Leave it for now, or one of the other three choices)
// key -> { at: the time of the said-no row it answers, via }; a newer no opens the step again. Kept in this visit, like the holds.
const LK = 'hiphi7_ask_left';
const lefts = (() => { try { return JSON.parse(sessionStorage.getItem(LK)) || {}; } catch { return {}; } })();
export const leftOf = key => lefts[key] || null;
export function setLeft(key, v) { if (v) lefts[key] = v; else delete lefts[key]; try { sessionStorage.setItem(LK, JSON.stringify(lefts)); } catch { /* the page still works without it */ } }

// ---------------------------------------------------------------------------------- the asks
export const askKey = (b, code) => `${b.id}|${code}`;
const person = id => (S.advocates || []).find(a => a.id === id);
const chairName = id => { const l = legById(id); return l ? `${l.chamber === 'S' ? 'Sen.' : 'Rep.'} ${String(l.sort_name || l.name || '').split(',')[0].trim()}` : 'The chair'; };
const stamp = n => new Date(n.created_at).getTime();
const live = id => !!id && person(id)?.is_active !== false;   // a person the data does not know is not taken to be turned off
// The vice chairs of a committee (their ask rows belong to the same ask: "Ask the vice chair" after a no)
export const viceIdsOf = code => codesOf(code).flatMap(k => (S.committeeMembers || []).filter(m => m.committee === k && m.role === 'vice_chair').map(m => m.legislator_id));
export const isFollowRow = n => /^Followed up\b/.test(String(n?.body || ''));
const word = n => n.answer || 'asked';

// All the asks the app knows of: one per bill and committee, each chair's newest word kept apart.
export function allAsks(now = Date.now()) {
  const groups = new Map();
  for (const n of legNotesAll()) {
    if (!isAskNote(n) || !n.bill_id) continue;
    const b = (S.bills || []).find(x => x.id === n.bill_id); if (!b) continue;
    const code = n.committee || stopOf(b)?.committee; if (!code) continue;
    const k = askKey(b, code); if (!groups.has(k)) groups.set(k, { b, code, rows: [] });
    groups.get(k).rows.push(n);
  }
  const out = [];
  for (const [key, g] of groups) {
    const ids = new Set([...chairIdsOf(g.code), ...viceIdsOf(g.code)].map(String)); if (!chairIdsOf(g.code).length) continue;
    const rows = g.rows.filter(n => ids.has(String(n.legislator_id))).sort((x, y) => stamp(x) - stamp(y)); if (!rows.length) continue;
    out.push(describe(key, g.b, g.code, rows, now));
  }
  return out;
}

// One ask from its rows (oldest first). Pure given the data layer: the tests build rows and call it.
export function describe(key, b, code, rows, now = Date.now()) {
  const each = new Map(); for (const n of rows) each.set(String(n.legislator_id), n);   // the newest row of each chair
  const vice = new Set(viceIdsOf(code).map(String));
  const mk = lid => { const id = String(lid), n = each.get(id); return { id, lid, who: chairName(id), answer: word(n), at: stamp(n), by: n.advocate_id, row: n, vice: vice.has(id) }; };   // lid: the id as the data layer holds it (a number), for saving
  const all = [...chairIdsOf(code), ...viceIdsOf(code)].filter(id => each.has(String(id))).map(mk), asked0 = rows[0];
  // a vice chair who was asked after a no stands in for the chair who said it: that no is history, the vice chair's word is where the ask stands
  const viceAsked = all.filter(c => c.vice).length > 0;
  const chairs = viceAsked ? all.filter(c => c.vice || c.answer !== 'said_no') : all.filter(c => !c.vice);
  const earlier = viceAsked ? all.filter(c => !chairs.includes(c)) : [];
  const quiet = chairs.filter(c => c.answer === 'asked' || c.answer === 'left_message');
  const noes = chairs.filter(c => c.answer === 'said_no'), yes = chairs.filter(c => c.answer === 'will_schedule');
  const newestQuiet = quiet.slice().sort((x, y) => x.at - y.at).at(-1);
  const saidNo = noes.length > 0, answer = saidNo ? 'said_no' : !newestQuiet ? 'will_schedule' : newestQuiet.answer;   // either says no: said no; all yes: will schedule; else where the quiet ones stand
  const asked = asked0, newest = rows.at(-1);
  // the clock runs from the newest word of a chair who has not answered (a chair who said yes has nothing to chase); with no quiet chair, from the newest row of the chairs in play
  const clockRow = newestQuiet ? newestQuiet.row : chairs.slice().sort((x, y) => x.at - y.at).at(-1)?.row || newest;
  const st = stopOf(b), ab = st?.deadline?.date ? askBy(st) : null;
  const noticeDay = ab?.notice ? ymd(ab.notice) : '';   // the day the committee must announce the hearing (the notice must post by then)
  const today = ymd(now), clockDay = ymd(stamp(clockRow));
  const clockOn = shiftWork(clockDay, WAIT_DAYS);                                 // the quiet runs out on this day
  const noticeOn = noticeDay ? shiftWork(noticeDay, -NOTICE_DAYS) : '';           // 2 working days before the announce day
  // the announce-day trigger fires once: a word (a follow-up, a call) on or after that day answers it, or the step would come straight back
  const noticeLive = !!noticeOn && clockDay < noticeOn;
  const ended = endedBy(b, code, st);
  const hold = holdOf(key), all2 = chairs.length > 1;
  // who holds it: the one it was given to; a receiver (or asker) who was turned off hands it back to the asker, then to the bill's lead (R-398 build choice b)
  const lead = (S.assignments?.[b.id] || []).find(live) || leadsFor(b).find(live) || asked.advocate_id;
  const holder = hold && live(hold.to) ? hold.to : live(asked.advocate_id) ? asked.advocate_id : lead;
  let due = false, remindOn = '';
  if (!ended && !saidNo) {
    if (answer === 'will_schedule') { remindOn = noticeLive ? noticeOn : ''; due = noticeLive && today >= noticeOn; }
    else { remindOn = noticeLive && noticeOn < clockOn ? noticeOn : clockOn; due = today >= clockOn || (noticeLive && today >= noticeOn); }
  }
  const lk = leftOf(key), noAt = noes.length ? Math.max(...noes.map(c => c.at)) : 0, decided = saidNo && !!lk && lk.at === noAt;
  const followRow = (newestQuiet || chairs.slice().sort((x, y) => x.at - y.at).at(-1))?.row, followedAt = followRow && isFollowRow(followRow) ? stamp(followRow) : 0;
  // no reminder is left before the committee must announce: only a call or the public can still help (build choice a)
  const noMore = !ended && !saidNo && !!noticeDay && noticeDay >= today && (!remindOn || remindOn > noticeDay);
  // the last chance: a follow-up went out and no reminder can come before the announce day, so on the working day before it (or on the announce day itself when the follow-up was sent that day or the working day before it: a word today cannot be answered by today's step) the holder
  // gets the step again as "Call the chair's office" (with a phone listed), unless a word since then has answered it. It ends with the ask like every step (S-10).
  const callOn = noMore && followedAt && noticeDay ? (shiftWork(noticeDay, -1) <= clockDay ? noticeDay : shiftWork(noticeDay, -1)) : '';
  const callDue = !!callOn && today >= callOn && clockDay < callOn;
  const hasPhone = (quiet.length ? quiet : yes).some(c => phoneOf(c));
  if (callDue) due = true;
  return { key, b, code, cmte: cmteWords(code), chairs, earlier, all: all2, quiet, yes, noes, answer, saidNo, asker: asked.advocate_id, holder, askedAt: stamp(asked), lastAt: stamp(newest), lastBy: newest.advocate_id,
    clockDay, clockOn, noticeDay, noticeOn, remindOn, due, callOn, callDue, callStep: callDue && hasPhone, ended, deadline: st?.deadline || null, followedAt, noMore,
    decided, decide: saidNo && !decided && !ended, noAt, workQuiet: workBetween(clockDay, today) };
}

// Why an ask ended by itself (S-10), or '': a hearing is set for that committee, its deadline passed, the bill stopped, the session is over, or the bill moved on from that committee.
export function endedBy(b, code, st = stopOf(b)) {
  const cs = codesOf(code);
  if ((S.hearings || []).some(h => h.bill_id === b.id && h.status !== 'cancelled' && codesOf(h.committee).some(c => cs.includes(c)))) return 'hearing';
  if (SESSION_OVER) return 'session';
  if (diedish(b)) return 'stopped';
  if (st?.deadline?.missed) return 'deadline';
  if (st && (st.phase !== 'committee' || !codesOf(st.committee).some(c => cs.includes(c)))) return 'moved';
  return '';
}

export const askById = key => allAsks().find(a => a.key === key) || null;
// the ask a bill's page speaks of: the one at the committee it is in now, else the newest; never one that ended
export function askForBill(b) {
  const mine = allAsks().filter(a => a.b.id === b.id && !a.ended); if (!mine.length) return null;
  const cm = codesOf(stopOf(b)?.committee);
  return mine.find(a => codesOf(a.code).some(c => cm.includes(c))) || mine.sort((x, y) => y.lastAt - x.lastAt)[0];
}

// ---------------------------------------------------------------------------------- words
const names = l => l.length < 3 ? l.join(' and ') : `${l.slice(0, -1).join(', ')} and ${l.at(-1)}`;
export const whoWords = a => names(a.chairs.map(c => c.who));
const you = id => id === S.me?.id ? 'You' : first(person(id));
export const askedSentence = a => `${you(a.asker)} asked ${a.all && codesOf(a.code).length > 1 ? 'both committees' : a.cmte} for a hearing on ${dayWords(a.askedAt)}.`;
// "no reply yet", "will schedule", "said no": where the ask stands, in a few words
export function stateWords(a) {
  if (a.saidNo) return `${names(a.noes.map(c => c.who))} said no`;
  if (a.answer === 'will_schedule') return `${names(a.yes.map(c => c.who))} will schedule it`;
  if (a.yes.length) return `${names(a.yes.map(c => c.who))} will schedule it · waiting on ${names(a.quiet.map(c => c.who))}`;
  return a.followedAt ? 'followed up, no reply yet' : 'no reply yet';
}
// The Home row's second line: "Waiting on Rep. Takayama · asked Thu, Mar 12 · no reply yet"; after a follow-up: "Waiting on Rep. Takayama · followed up today · next reminder Thu, Mar 19"
const sayWhen = t => ymd(t) === ymd(Date.now()) ? 'today' : dayWords(t);
const nextWords = a => a.noMore ? `announce by ${dayWords(a.noticeDay)}` : a.remindOn ? `next reminder ${dayWords(a.remindOn)}` : '';
export function waitLine(a, me = S.me) {
  const mine = a.holder === me?.id, hold = mine ? 'Waiting on' : `${first(person(a.holder))} waits on`;
  if (a.saidNo) return `${names(a.noes.map(c => c.who))} said no · asked ${dayWords(a.askedAt)}`;
  const fu = a.followedAt ? `followed up ${sayWhen(a.followedAt)}` : '';
  if (a.answer === 'will_schedule') { const y = `${names(a.yes.map(c => c.who))} will schedule it`; return a.followedAt ? `${y} · ${fu}${nextWords(a) ? ` · ${nextWords(a)}` : ''}` : `${y}${a.remindOn ? ` · follow up if none is set by ${dayWords(a.remindOn)}` : ''}`; }
  if (a.yes.length) return `${names(a.yes.map(c => c.who))} will schedule it · ${mine ? 'waiting' : `${first(person(a.holder))} waits`} on ${names(a.quiet.map(c => c.who))}`;
  return `${hold} ${whoWords(a)} · ${fu ? `${fu} · ${nextWords(a)}` : `asked ${dayWords(a.askedAt)} · no reply yet`}`;
}
// The bill page's line: "You asked House Health for a hearing on Thu, Mar 12 · no reply yet"
export const billLine = a => `${askedSentence(a).replace(/\.$/, '')} · ${stateWords(a)}`;

// The asks a person holds or made, for Home's Waiting on others: not the ones that ended by themselves
export function waitingAsks(me) {
  // what needs the holder is a step now (Follow up with the chair, Decide what next) and leaves this list; a no that was decided waits on nothing
  return allAsks().filter(a => !a.ended && (a.holder === me?.id || a.asker === me?.id) && !(a.holder === me?.id && (a.due || a.decide)) && !(a.saidNo && a.decided)).sort((x, y) => x.askedAt - y.askedAt)
    .map(a => ({ id: 'ask:' + a.key, kind: 'ask', b: a.b, name: billName(a.b), no: billNo(a.b), href: '#/ask/' + encodeURIComponent(a.key), line: waitLine(a, me), at: null, with: [], who: '', second: false, ask: a }));
}

// ---------------------------------------------------------------------------------- the steps an ask makes for the one who holds it (steps.js adds these to stepsFor)
// Follow up with the chair: the quiet ran out (3 working days) or the committee must announce within 2 working days, or a chair who said yes has set no hearing by then.
// Decide what next: a chair said no and nobody has answered that yet. Both end by themselves with the ask (S-10: `ended`), and no click is needed.
const stepOf = (a, kind, verb, id) => ({ id, kind, bill: a.b, hearing: null, draft: null, at: null, due: null, until: null, act: null, tone: 'neutral', late: false, issue: issueOf(a.b), name: billName(a.b), no: billNo(a.b),
  forWhom: '', sentBack: '', ask: null, verb, mark: 'Today', askKey: a.key });
export function chairSteps(me) {
  if (!me) return [];
  return allAsks().filter(a => !a.ended && a.holder === me.id && a.b.tracked !== false && (a.decide || a.due))
    .sort((x, y) => x.askedAt - y.askedAt).map(a => a.decide ? stepOf(a, 'decide', 'Decide what next', 'dc-' + a.key) : stepOf(a, 'chairfu', a.callStep ? "Call the chair's office" : 'Follow up with the chair', 'fu-' + a.key));
}
export const phoneOf = c => String((legById(c.id) || {}).phone || '').trim();
// who a follow-up goes to: the chairs who have not answered; when all of them said yes, those (no hearing is set)
export const followTargets = a => a.quiet.length ? a.quiet : a.yes;
// the bill's companion that has a hearing ahead, for "Work on the companion"
export const companionAhead = b => companionsOf(b).map(n => billByNum(n, b.session_year)).filter(x => x && x.id !== b.id).map(x => ({ b: x, h: hearingAhead(x) })).find(x => x.h) || null;

// ---------------------------------------------------------------------------------- the practice copy's asks (seeded relative to today, so they never go stale)
// Kevin asked House Health about SB 2175 four working days ago and has heard nothing. (Staff6's practice seeds already hold Kevin's two-chair ask for HB 756.)
export function seedAsks() {
  const kv = (S.advocates || []).find(a => a.initials === 'KV'), b = (S.bills || []).find(x => String(x.bill_number).replace(/\s/g, '') === 'SB2175'); if (!kv || !b) return;
  const code = stopOf(b)?.committee; if (!code) return;
  const at = new Date(`${shiftWork(ymd(Date.now()), -4)}T09:00:00-10:00`).toISOString();
  for (const id of chairIdsOf(code)) {
    const rid = `v7ask-${b.id}-${id}-asked`;
    if ((S.demoNotes || []).some(n => n.id === rid)) continue;
    (S.demoNotes ??= []).unshift({ id: rid, legislator_id: id, bill_id: b.id, advocate_id: kv.id, body: `Asked for a hearing on ${b.bill_number} (${code}).`, answer: 'asked', committee: code, issue_id: null, met_on: null, conversation_id: null, created_at: at });
  }
}
