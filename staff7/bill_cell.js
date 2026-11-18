// One answer per ALIVE bill about the issue's next deadline (R-398). The Issues list groups and the issue page's bills table both read deadlineCell, so the two can never disagree.
// Imports only the data layer and staff7 leaf files (never issues.js), so no module cycle. Functions only: nothing here writes.
import { stopOf, hearingAhead, wantsHearing, POS_GROUP } from '../staff6/model.js';
import { effStage, SESSION_OVER } from '../staff6/data.js';
import { isOneChamber, HELD_RE } from '../stops.js';
import { isAlive, isAtRisk, deadlineOf } from './standing.js';
import { dateWords, daysTo } from './words.js';
import { placeOf } from './place.js';
import { ic } from './icons7.js';

// ---------------------------------------------------------------------------------- has a bill passed a deadline?
// Has this alive bill already passed the deadline of `row`? 'yes', 'no' (the deadline is not one of its steps, or it has not got there) or 'unknown' (the data cannot say).
// The data layer's stopOf names the deadline each bill races NEXT (its deadlineKey) and the order of a bill's road is fixed, so a bill that is racing a LATER gate has passed this one, provided
// this gate is one of its steps: the second chamber's gates depend on how many committees the bill was sent to there (Triple filing: three or more; Lateral: two or more; Decking: any).
const RANK = { first_triple: 1, first_lateral: 2, first_decking: 3, first_crossover: 4, second_triple: 5, second_lateral: 6, second_decking: 7, second_crossover: 8, conference: 9 };
export const GATE = k => k === 'first_triple_senate' ? 'first_triple' : k === 'final_decking' || k === 'fiscal' ? 'conference' : k;
const secondCmtes = (b, st) => {   // how many committees the bill was sent to in the second chamber
  if (st.leg === 'second') return st.stops;
  const refs = Array.isArray(b.referrals) ? b.referrals : [], o = Math.min(b.origin_stops || 0, refs.length);
  return o ? refs.length - o : 0;
};
export function clearedOf(b, row) {
  if (!row || !b || !isAlive(b)) return 'no';
  const k = row.key, st = stopOf(b);
  if (k === 'governor' || GATE(st.deadlineKey) === k) return 'no';   // the last day is nobody's "cleared"; racing it is the opposite
  const here = RANK[GATE(st.deadlineKey)] ?? (['governor', 'law', 'ballot'].includes(st.phase) ? 9.5 : null);
  if (RANK[k] == null || here == null) return 'unknown';
  if (k === 'first_crossover') return isOneChamber(b) || st.leg === 'first' ? 'no' : 'yes';
  if (k === 'conference') return here > RANK.conference ? 'yes' : 'no';
  if (st.leg === 'first') return 'no';   // still in its first chamber: the second chamber's gates are not its steps yet
  const c = secondCmtes(b, st);
  if (!c) return 'unknown';   // sent on, but the referral list does not say to how many committees
  return c < (k === 'second_triple' ? 3 : k === 'second_lateral' ? 2 : 1) ? 'no' : here > RANK[k] ? 'yes' : 'no';
}

// ---------------------------------------------------------------------------------- the deadline cell
export const CELL_ORDER = ['risk', 'late', 'hearing', 'need', 'until', 'unsure', 'cleared', 'noask', 'past'];
const ymdHST = t => new Date(t).toLocaleDateString('en-CA', { timeZone: 'Pacific/Honolulu' });
const short = d => dateWords(d).split(', ')[1] || dateWords(d);   // "Mar 30" (no weekday: the column is narrow)
const dayWord = d => { const k = daysTo(d); return k <= 0 ? 'today' : k === 1 ? 'tomorrow' : short(d); };
const cell = (key, text, at = null) => ({ key, text, amber: key === 'risk' || key === 'late', quiet: ['past', 'until', 'unsure', 'noask'].includes(key), at });

// `row` is the issue's own next deadline row (issues.js sessionOf(...).next?.row), or null. The order of the tests is Nate's: a bill that cleared the next deadline is never amber.
export function deadlineCell(b, row) {
  const st = stopOf(b);
  if (st.phase !== 'committee') return cell('past', 'Past committees');
  const cleared = row ? clearedOf(b, row) : 'no';
  if (cleared === 'yes') return cell('cleared', 'Cleared the deadline');
  const h = hearingAhead(b);
  if (h) {
    const day = ymdHST(h.scheduled_at), own = st.deadline?.date, at = new Date(h.scheduled_at).getTime();
    return own && day > String(own).slice(0, 10) ? cell('late', `Hearing ${short(day)}, after the deadline`, at) : cell('hearing', `Hearing ${dayWord(day)}`, at);
  }
  if (cleared === 'unknown') return cell('unsure', 'Not sure yet');
  if (!wantsHearing(b)) return cell('noask', 'Not asking for a hearing');
  const dl = deadlineOf(b), own = row && GATE(st.deadlineKey) === row.key;
  if (isAtRisk(b)) return cell('risk', own || !row ? 'Needs a hearing' : `Needs a hearing by ${short(dl.date)}`, dl.date);
  if (own && dl) return cell('need', 'Needs a hearing', dl.date);
  return st.deadline && !st.deadline.missed ? cell('until', `Has until ${short(st.deadline.date)}`, st.deadline.date) : cell('past', 'Past committees');
}

// ---------------------------------------------------------------------------------- the deadline column's heading
// "Deadline Mar 30 · 14 days"; "Deadline" alone when the issue has no next deadline
export function headCell(row) {
  if (!row) return 'Deadline';
  const k = daysTo(row.date);
  return `Deadline ${short(row.date)}${k < 0 ? '' : ` · ${k === 0 ? 'today' : k === 1 ? 'tomorrow' : `${k} days`}`}`;
}
// Where a bill is, in words, is place.js (placeOf / placeHTML / placeLine): the one source every page reads.

// ---------------------------------------------------------------------------------- the mark (R-398, Nate 18 Nov)
// ONE answer per bill about the issue's next deadline, drawn as one small line icon before its date. signalOf(b, row) gives the key; markHTML(key) draws it; every page reads these, so no page decides a mark itself.
// The tests run in this order and the first match wins (Nate's table of 18 Nov). Support = strongly_support, support, support_amend; oppose = oppose, strongly_oppose; anything else counts as neither.
// Words: the accessible name, the hover title and the legend (Claude's draft, to be checked by Nate).
export const SIGNAL = {
  risk: { icon: 'triangle-alert', name: 'At risk' },
  soon: { icon: 'hourglass', name: 'Vote needed soon' },
  dying: { icon: 'ban', name: 'Deferred' },
  hear: { icon: 'calendar', name: 'Hearing set' },
  heard: { icon: 'hourglass', name: 'Heard, waiting for the vote' },
  time: { icon: 'clock', name: 'On time' },
  clear: { icon: 'check', name: 'In the clear' },
};
export const SIGNAL_ORDER = ['risk', 'soon', 'dying', 'hear', 'heard', 'time', 'clear'];   // most urgent first: the Issues list order
const SESSION_DONE = ['governor', 'enacted', 'ballot'];
// the Capitol's own last action says deferred: the same test as place.js DEFERRED
const DEFERRED = b => HELD_RE.test(b.last_action || '') && !/failed to pass/i.test(b.last_action || '');
export function signalOf(b, row) {
  if (!b) return '';
  const st = stopOf(b), stage = effStage(b), grp = POS_GROUP[b.position] || '', live = !!st.deadline && !st.deadline.missed;
  if (SESSION_OVER) return SESSION_DONE.includes(stage) ? 'clear' : '';
  if (['governor', 'law', 'ballot'].includes(st.phase)) return 'clear';
  // a deferred bill shows the dying mark until its deadline passes; no hearing ahead (a hearing beats it), and not dead or vetoed. Its isAlive is false (diedish), so this runs before the alive test
  if (DEFERRED(b) && !isAlive(b) && !['dead', 'vetoed'].includes(stage) && !hearingAhead(b) && live) return 'dying';
  if (!isAlive(b)) return '';
  if (st.phase === 'floor') return 'clear';
  if (st.phase === 'conference') {
    if (grp !== 'support' && grp !== 'oppose') return '';
    if (st.deadline && st.deadline.missed) return '';   // a missed conference deadline is no longer a mark to show
    if (!st.deadline) return 'time';
    return daysTo(st.deadline.date) <= 7 ? 'risk' : 'time';
  }
  if (st.phase !== 'committee') return '';
  if (clearedOf(b, row) === 'yes') return 'clear';
  if (hearingAhead(b)) return 'hear';
  if (st.hearingState === 'held') return grp === 'support' && live && daysTo(st.deadline.date) <= 3 ? 'soon' : 'heard';
  if (clearedOf(b, row) === 'unknown' || placeOf(b).key === 'not_referred') return '';
  if (grp !== 'support') return '';   // only the bills we support are asked for a hearing (wantsHearing would let in neutral)
  if (isAtRisk(b)) return 'risk';
  return live ? 'time' : '';
}
// the most urgent mark among a list of bills (SIGNAL_ORDER), with the bill that has it: { key, b }, key '' when none has one
export function urgentBillOf(bills, row) {
  let best = { key: '', b: null }, rank = Infinity;
  for (const b of bills) { const k = signalOf(b, row), r = SIGNAL_ORDER.indexOf(k); if (k && r < rank) { best = { key: k, b }; rank = r; } }
  return best;
}
export const urgentOf = (bills, row) => urgentBillOf(bills, row).key;
// the mark as HTML: a 14px line icon in a fixed slot. '' gives an empty slot, so the dates share one left edge
export function markHTML(key) {
  const s = SIGNAL[key];
  return s ? `<span class="sgm sgm-${key}" role="img" aria-label="${s.name}" title="${s.name}">${ic(s.icon)}</span>` : '<span class="sgm sgm-none" aria-hidden="true"></span>';
}
