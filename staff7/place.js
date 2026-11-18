// "Where it is" (R-398, settled design 17 Nov 2026): the ONE source of a bill's place. Every page that words where a single bill stands (the All bills table, the Issues list, the issue page, the bill page, Search)
// calls placeOf / placeHTML / placeLine, so the same bill reads the same everywhere. Two short lines: line 1 says what state the bill is in, line 2 (muted) names the committee.
//   placeOf(b)   -> { key, order, line1, cmte: { text, codes, names, chamber, joint }, date, label }   (date: the day a stopped bill stopped, "Feb 11", said by the page once, quietly; label: the accessible name of a joint stop)
//   placeHTML(b) -> the two lines as HTML (every piece escaped), for a table cell;   placeLine(b) -> one line of text, "Line 1 · Line 2";   placeLineHTML(b) -> the one line as HTML (a joint stop keeps its codes' titles)
// One committee is named in full with its code ("Senate Education (EDU)"); joint committees are all codes joined by "/", the chamber said once ("Senate EIG/PSM/EDT"), each code carrying its full name.
// A bill that passed an earlier committee does not name it: line 1 says "Passed 1 of 2 committees" and line 2 names the one it waits in. No status colour, no icon.
// Every status has a stable key and an order number (the design's journey order, which is also the "Where it is" column's sort order): see PLACES.
// WHAT THE DATA CANNOT TELL (and so is never said): a bill sent back to a committee ("recommitted"); a failed floor vote beyond the Capitol's own status ("Failed a vote") or last action ("failed to pass");
// whether a bill back in its first chamber agreed or disagreed (only that it is back: stage second_crossover); a resolution's "adopted" is read from the Capitol's stage "enacted".
// Imports only the data layer and staff7 files that already exist; every function here only reads.
import { effStage } from '../staff6/data.js';
import { stopOf, hearingAhead, isDecision } from '../staff6/model.js';
import { beingHeard } from '../staff6/steps.js';
import { CHAMBER_NAME, HELD_RE, isResolution } from '../stops.js';
import { isAlive } from './standing.js';
import { codesOf, cmteLabel, cmteLink, monD } from './bill_words.js';
import { stoppedWhy } from './issue_table.js';
import { esc } from './parts.js';

// ---------------------------------------------------------------------------------- the statuses, in journey order (key, order, what line 1 says)
export const PLACES = [
  { key: 'not_referred', order: 1, line1: 'Not referred yet' },
  { key: 'waiting', order: 2, line1: 'Waiting for a hearing' },
  { key: 'passed_some', order: 3, line1: 'Passed N of M committees' },
  { key: 'crossed', order: 4, line1: 'Crossed over, waiting for a hearing' },
  { key: 'hearing', order: 5, line1: 'Hearing scheduled' },
  { key: 'decision', order: 5, line1: 'Decision making scheduled' },
  { key: 'being_heard', order: 6, line1: 'Being heard today' },
  { key: 'heard_held', order: 7, line1: 'Hearing held, no vote recorded' },
  { key: 'floor', order: 8, line1: 'Passed committee, waiting for the floor vote' },
  { key: 'back', order: 9, line1: 'Back in the House (or Senate) to agree or disagree' },
  { key: 'conference', order: 10, line1: 'In conference' },
  { key: 'governor', order: 11, line1: 'With the Governor' },
  { key: 'law', order: 12, line1: 'Signed into law' },
  { key: 'adopted', order: 12, line1: 'Adopted' },
  { key: 'ballot', order: 12, line1: 'Going to the voters' },
  { key: 'no_hearing', order: 13, line1: 'No hearing, missed the deadline' },
  { key: 'deferred', order: 14, line1: 'Deferred Feb 25' },
  { key: 'heard_stopped', order: 15, line1: 'Heard Feb 25, no vote recorded' },
  { key: 'vetoed', order: 16, line1: 'Vetoed' },
  { key: 'failed_floor', order: 17, line1: 'Failed a floor vote' },
  { key: 'stopped', order: 18, line1: 'Stopped' },
];
const ORDER = Object.fromEntries(PLACES.map(p => [p.key, p.order]));

// ---------------------------------------------------------------------------------- the committee line
// codes -> { text, codes, names (each code's full name, no code), chamber ('House' | 'Senate' | '' when the codes do not share one or are unknown), joint }
export function cmteOf(codes, b) {
  const cs = [...new Set(codes)], names = cs.map(c => cmteLabel(c, b));
  const ch = names.map(n => (/^(House|Senate)\b/.exec(n) || [])[1] || ''), chamber = ch.length && ch.every(x => x && x === ch[0]) ? ch[0] : '';
  const text = !cs.length ? '' : cs.length === 1 ? `${names[0]} (${cs[0]})` : `${chamber ? `${chamber} ` : ''}${cs.join('/')}`;
  return { text, codes: cs, names, chamber, joint: cs.length > 1 };
}
const NONE = { text: '', codes: [], names: [], chamber: '', joint: false };
const lastRef = b => { const r = (Array.isArray(b.referrals) ? b.referrals : []).map(String).filter(x => codesOf(x).length); return r.length ? codesOf(r[r.length - 1]) : []; };

// ---------------------------------------------------------------------------------- one bill's place
const DEFERRED = b => HELD_RE.test(b.last_action || '') && !/failed to pass/i.test(b.last_action || '');   // the Capitol's own last action says deferred (stops.js HELD_RE, as model.js whyDead reads it)
const FAILED = b => b.status_text === 'Failed a vote' || (!b.died_deadline && /failed to pass/i.test(b.last_action || ''));   // the same two facts whyDead reads
const lastDay = b => { const d = String(b.last_action_date || '').slice(0, 10); return /^\d{4}-\d\d-\d\d$/.test(d) ? monD(`${d}T12:00:00-10:00`) : ''; };
// `w`: a stopped bill's stoppedWhy(b), when the caller already has it (a table works it out once)
export function placeOf(b, w = null) {
  const out = (key, line1, cmte = NONE, date = '') => ({ key, order: ORDER[key], line1, cmte, date, label: cmte.joint ? `${line1}. ${cmte.names.join(', ')}` : '' });
  if (!b) return out('stopped', 'Stopped');
  const st = stopOf(b), stage = effStage(b);
  if (!isAlive(b)) {
    const x = w || stoppedWhy(b), date = x.date || '';
    const at = x.codes.length ? x.codes : lastRef(b), cm = cmteOf(at, b);
    if (stage === 'vetoed') return out('vetoed', 'Vetoed', NONE, date);
    if (FAILED(b)) return out('failed_floor', 'Failed a floor vote', NONE, date);
    if (DEFERRED(b) && ['held', 'none', ''].includes(x.kind) && at.length) { const d = lastDay(b) || (x.kind === 'held' ? x.heard : ''); return out('deferred', d ? `Deferred ${d}` : 'Deferred', cm, date); }   // the Capitol's own deferral action carries its date; the hearing's date only when the action has none
    if (x.kind === 'none') return out('no_hearing', b.died_deadline ? 'No hearing, missed the deadline' : 'No hearing', cm, date);
    if (x.kind === 'held') return out('heard_stopped', `Heard ${x.heard}, no vote recorded`, cm, date);
    return out('stopped', 'Stopped', cm, date);
  }
  const ch = CHAMBER_NAME[st.chamber] || '';
  if (st.phase === 'floor') return out('floor', 'Passed committee, waiting for the floor vote');
  if (st.phase === 'conference') return stage === 'second_crossover' ? out('back', `Back in the ${ch || 'first chamber'} to agree or disagree`) : out('conference', 'In conference');
  if (st.phase === 'governor') return out('governor', 'With the Governor');
  if (st.phase === 'law') return isResolution(b) ? out('adopted', 'Adopted') : out('law', 'Signed into law');
  if (st.phase === 'ballot') return out('ballot', 'Going to the voters');
  const h = hearingAhead(b), codes = codesOf(h ? h.committee : st.committee);
  if (h) return out(isDecision(h) ? 'decision' : 'hearing', isDecision(h) ? 'Decision making scheduled' : 'Hearing scheduled', cmteOf(codes, b));
  if (!codes.length) return out('not_referred', 'Not referred yet');
  const cm = cmteOf(codes, b);
  if (beingHeard(st)) return out('being_heard', 'Being heard today', cm);
  if (st.hearingState === 'held') return out('heard_held', 'Hearing held, no vote recorded', cm);
  if (st.stop > 1) { const n = st.stop - 1; return out('passed_some', st.stops > n ? `Passed ${n} of ${st.stops} committees` : `Passed ${n} ${n === 1 ? 'committee' : 'committees'}`, cm); }
  return st.leg === 'second' ? out('crossed', 'Crossed over, waiting for a hearing', cm) : out('waiting', 'Waiting for a hearing', cm);
}

// ---------------------------------------------------------------------------------- the words
// the committee line as HTML: one committee is plain text; a joint stop is "Senate" and the codes, each code a span whose title is its full name.
// `link`: each committee (each code of a joint stop) is a link to the committee's page (bill_words.js cmteLink), when the data layer has that committee
const codeHTML = (c, k, link) => { const t = c.codes[k], a = link ? cmteLink(t, null, '', t) : esc(t); return `<span class="cc" title="${esc(c.names[k])}">${a}</span>`; };
const cmteHTML = (c, link = false) => !c.joint ? (link && c.codes.length ? cmteLink(c.codes[0], null, '', c.text) : esc(c.text)) : `${c.chamber ? `${esc(c.chamber)} ` : ''}${c.codes.map((k, i) => codeHTML(c, i, link)).join('/')}`;
// the same words from a placeOf answer already in hand (a table works each bill out once)
export const lineOf = p => p.cmte.text ? `${p.line1} · ${p.cmte.text}` : p.line1;
export const cellOf = (p, o = {}) => ({ html: `<span class="w1">${esc(p.line1)}</span>${p.cmte.text ? `<span class="w2">${cmteHTML(p.cmte, o.link)}</span>` : ''}`, attr: p.label ? ` aria-label="${esc(p.label)}"` : '', p });
// a table cell: the two lines, and the accessible name a joint stop carries (the full names of its codes), as an attribute string for the <td>
export const placeCell = (b, w = null, o = {}) => cellOf(placeOf(b, w), o);
export const placeHTML = (b, w = null, o = {}) => placeCell(b, w, o).html;
export const placeLine = (b, w = null) => lineOf(placeOf(b, w));
// the committee line inside one line of HTML: a joint stop's codes are grouped under an accessible name holding the full names
// o.group false: inside a list row (a listbox option) a group role would be invalid, so the codes keep their titles and nothing more
const cmteInline = (c, link = false, group = true) => c.joint && group ? `<span role="group" aria-label="${esc(c.names.join(', '))}">${cmteHTML(c, link)}</span>` : cmteHTML(c, link);
// one line of HTML for a page that writes its own markup. o.link: committees are links;  o.bare: leave out line 1 when it is only "Stopped" (a page that has already said it)
export const placeLineHTML = (b, w = null, o = {}) => { const p = placeOf(b, w), c = p.cmte, l1 = o.bare && p.key === 'stopped' ? '' : esc(p.line1); return `${l1}${c.text ? `${l1 ? ' · ' : ''}${cmteInline(c, o.link, o.group !== false)}` : ''}`; };
// a stopped bill on a page with one line: "Stopped Feb 11 · No hearing, missed the deadline · House Health (HLT)" (the date said once; a bill the record cannot say more about is "Stopped Feb 11 · House Health (HLT)")
const stoppedParts = (b, w) => { const p = placeOf(b, w); return { p, head: `Stopped${p.date ? ` ${p.date}` : ''}`, rest: p.key === 'stopped' ? '' : p.line1 }; };
export const stoppedLine = (b, w = null) => { const { p, head, rest } = stoppedParts(b, w); return [head, rest, p.cmte.text].filter(Boolean).join(' · '); };
// the same as HTML, "Stopped Feb 11" in bold (the bill page); o.bold false: plain (Search)
export const stoppedLineHTML = (b, w = null, o = {}) => { const { p, head, rest } = stoppedParts(b, w), h = esc(head); return `${o.bold === false ? h : `<b>${h}</b>`}${rest ? ` · ${esc(rest)}` : ''}${p.cmte.text ? ` · ${cmteInline(p.cmte, o.link, o.group !== false)}` : ''}`; };
// the sort of the "Where it is" column: the journey order, then the committee's text (the caller's last tie is the bill number)
export const placeCompare = (p, q) => p.order - q.order || String(p.cmte.text).localeCompare(String(q.cmte.text), 'en', { numeric: true });
