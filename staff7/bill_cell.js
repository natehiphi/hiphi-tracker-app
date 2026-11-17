// One answer per ALIVE bill about the issue's next deadline (R-398). The Issues list groups and the issue page's bills table both read deadlineCell, so the two can never disagree.
// Imports only the data layer and staff7 leaf files (never issues.js), so no module cycle. Functions only: nothing here writes.
import { stopOf, hearingAhead, wantsHearing } from '../staff6/model.js';
import { CHAMBER_NAME, isOneChamber } from '../stops.js';
import { isAlive, isAtRisk, deadlineOf } from './standing.js';
import { dateWords, daysTo } from './words.js';
import { cmteLink, cmteLabel, codesOf } from './bill_words.js';
import { whereWords } from '../staff6/steps.js';
import { esc } from './parts.js';

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
const cell = (key, text, icon = '', at = null) => ({ key, text, icon, amber: key === 'risk' || key === 'late', quiet: ['past', 'until', 'unsure', 'noask'].includes(key), at });

// `row` is the issue's own next deadline row (issues.js sessionOf(...).next?.row), or null. The order of the tests is Nate's: a bill that cleared the next deadline is never amber.
export function deadlineCell(b, row) {
  const st = stopOf(b);
  if (st.phase !== 'committee') return cell('past', 'Past committees');
  const cleared = row ? clearedOf(b, row) : 'no';
  if (cleared === 'yes') return cell('cleared', 'Cleared the deadline', 'check');
  const h = hearingAhead(b);
  if (h) {
    const day = ymdHST(h.scheduled_at), own = st.deadline?.date, at = new Date(h.scheduled_at).getTime();
    return own && day > String(own).slice(0, 10) ? cell('late', `Hearing ${short(day)}, after the deadline`, 'triangle-alert', at) : cell('hearing', `Hearing ${dayWord(day)}`, 'calendar', at);
  }
  if (cleared === 'unknown') return cell('unsure', 'Not sure yet');
  if (!wantsHearing(b)) return cell('noask', 'Not asking for a hearing');
  const dl = deadlineOf(b), own = row && GATE(st.deadlineKey) === row.key;
  if (isAtRisk(b)) return cell('risk', own || !row ? 'Needs a hearing' : `Needs a hearing by ${short(dl.date)}`, 'triangle-alert', dl.date);
  if (own && dl) return cell('need', 'Needs a hearing', 'clock', dl.date);
  return st.deadline && !st.deadline.missed ? cell('until', `Has until ${short(st.deadline.date)}`, '', st.deadline.date) : cell('past', 'Past committees');
}

// ---------------------------------------------------------------------------------- the deadline column's heading
// "Deadline Mar 30 · 14 days"; "Deadline" alone when the issue has no next deadline
export function headCell(row) {
  if (!row) return 'Deadline';
  const k = daysTo(row.date);
  return `Deadline ${short(row.date)}${k < 0 ? '' : ` · ${k === 0 ? 'today' : k === 1 ? 'tomorrow' : `${k} days`}`}`;
}

// ---------------------------------------------------------------------------------- the "Now waiting" column
// Where the bill waits NOW, as HTML (every piece escaped): a committee is a link with its code after it, a joint stop names each committee joined by "with".
const PHASES = { conference: 'Conference', governor: 'Governor', law: 'Signed into law', ballot: 'Going to the voters' };
export function whereCell(b) {
  const st = stopOf(b), ch = CHAMBER_NAME[st.chamber] || '';
  if (!isAlive(b)) return 'Stopped this year';
  if (st.phase === 'floor') return esc(ch ? `Floor vote, ${ch}` : 'Floor vote');
  if (PHASES[st.phase]) return esc(PHASES[st.phase]);
  if (st.phase !== 'committee') return esc(st.says || 'Not in a committee');
  const codes = codesOf(st.committee);
  if (codes.length) return codes.map(c => `${cmteLink(c, b)} (${esc(c)})`).join(' with ');
  return esc(st.leg === 'second' && ch ? `Crossed to the ${ch} · no committee yet` : 'No committee yet');
}

// ---------------------------------------------------------------------------------- "Where it is", as plain words for one bill (the All bills table; the Issues list's own line is issues.js placeWords, which sums a joint stop up as "In 2 Senate committees")
// An alive bill: its committees, each with its own code ("In Senate Education (EDU)", a joint stop "In House Water & Land (WAL) with House Public Safety (PBS)", at most `max` and then "and 1 more");
// otherwise the phase in words ("In conference"). A stopped bill's words are issue_table.js stoppedReason.
export const PHASE_WORDS = { floor: 'Ready for the floor vote', conference: 'In conference', governor: 'With the Governor', law: 'Signed into law', ballot: 'Going to the voters' };
export function whereLine(b, max = 2) {
  const st = stopOf(b);
  if (st.phase === 'committee') {
    const codes = codesOf(st.committee);
    if (codes.length) { const names = codes.map(c => `${cmteLabel(c, b)} (${c})`); return `In ${names.slice(0, max).join(' with ')}${names.length > max ? ` and ${names.length - max} more` : ''}`; }
  }
  return PHASE_WORDS[st.phase] || whereWords(b, { deadline: false });
}
