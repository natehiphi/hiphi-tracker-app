// Staff7's words for the session and for where a bill stands (R-398). ONE table names each Capitol deadline and each stop on a bill's path, so Home's session line, the Issues
// session sheet, the path drawing and "Why" never give the same event two names. The meanings are the data layer's own (staff6/model.js GATE_WORDS, checked against the Public
// Access Room's calendar): triple filing = a bill sent to 3 or more committees clears its first; lateral = it reaches its last committee; decking = it clears the last one, ready for
// the floor vote; crossover = it passes its first chamber; cross back = it passes the second; final decking = the House and Senate agree on one version; sine die = the last day.
// One time form everywhere: "Thu, Mar 19 · 3 days" (whenWords). Nothing here draws or writes.
import { DEADLINES } from '../staff6/data.js';
import { stopOf, whyDead } from '../staff6/model.js';
import { isAlive } from './standing.js';

const HST = { timeZone: 'Pacific/Honolulu' };
const DAY = 864e5;
const ymd = t => new Date(t).toLocaleDateString('en-CA', HST);
const at = d => new Date(String(d).slice(0, 10) + 'T12:00:00-10:00');

// "Thursday": the weekday alone, for "before Thursday’s deadline"
export const dayName = d => at(d).toLocaleDateString('en-US', { ...HST, weekday: 'long' });
// "Thu, Mar 19"
export const dateWords = d => at(d).toLocaleDateString('en-US', { ...HST, weekday: 'short', month: 'short', day: 'numeric' });
// whole days from today (Honolulu's day) to a date: 0 today, negative past
export const daysTo = d => Math.round((at(d).getTime() - at(ymd(Date.now())).getTime()) / DAY);
// "Thu, Mar 19 · 3 days"; today says "today"; a date that has passed is the date alone
export function whenWords(d) {
  const k = daysTo(d);
  return `${dateWords(d)}${k < 0 ? '' : ` · ${k === 0 ? 'today' : k === 1 ? '1 day' : `${k} days`}`}`;
}

// name: what the event is called wherever it is named (two lines at most under a dot); says: what it asks of a bill
export const WORDS = {
  first_triple: { name: 'First committee deadline', says: 'Bills sent to three or more committees must clear their first committee.' },
  first_lateral: { name: 'Committee deadline', says: 'Bills must reach their last committee.' },
  first_decking: { name: 'Last committee deadline', says: 'Bills must clear their last committee, ready for the floor vote.' },
  first_crossover: { name: 'Crossed to the other chamber', says: 'Bills must pass their first chamber and cross to the other one.' },
  second_triple: { name: 'First committee deadline', says: 'Bills sent to three or more committees must clear their first committee.' },
  second_lateral: { name: 'Committee deadline', says: 'Bills must reach their last committee.' },
  second_decking: { name: 'Last committee deadline', says: 'Bills must clear their last committee, ready for the floor vote.' },
  second_crossover: { name: 'Crossed back to the first chamber', says: 'Bills must pass the second chamber and go back to the first.' },
  conference: { name: 'House and Senate must agree', says: 'The House and Senate must agree on one version of each bill.' },
  governor: { name: 'Session ends', says: 'The session’s last day. A bill that has not passed both chambers stops for the year.' },
};
for (const k of ['first_triple_senate']) WORDS[k] = WORDS.first_triple;
WORDS.final_decking = WORDS.fiscal = WORDS.conference;
export const nameOf = (key, fallback = '') => WORDS[key]?.name || fallback;
// The path's five stops, named with the same words (path.js)
export const PATH_NAMES = ['Introduced', 'First committees', WORDS.first_crossover.name, 'Second chamber', 'Governor'];

// ---------------------------------------------------------------------------------- the session's dates
// The same stops for everyone. `extra` is a date Home's "Your bills" counts when it is not one of them (a sandbox day early in the session).
export const SESSION_KEYS = ['first_crossover', 'second_triple', 'second_lateral', 'second_decking', 'conference', 'governor'];
export function sessionDates(extra) {
  const rows = SESSION_KEYS.map(k => { const e = (DEADLINES || {})[k], d = e && e[0] && e[0][1]; return d ? { key: k, label: WORDS[k].name, says: WORDS[k].says, date: String(d).slice(0, 10) } : null; }).filter(Boolean);
  if (extra && extra.date && !rows.some(r => r.date === extra.date)) rows.push({ key: extra.key, label: nameOf(extra.key, extra.label), says: WORDS[extra.key]?.says || '', date: String(extra.date).slice(0, 10) });
  return rows.sort((x, y) => x.date.localeCompare(y.date));
}
// Which row of the session a bill is racing: the deadline stopOf names, folded onto a row's key. The last day touches every bill still alive.
const ROWKEY = k => k === 'first_triple_senate' ? 'first_triple' : k === 'final_decking' || k === 'fiscal' ? 'conference' : k;
// Map of row key -> the alive bills it touches
export function touchMap(bills) {
  const m = new Map(), seen = new Set();
  for (const b of bills) {
    if (!b || seen.has(b.id) || !isAlive(b)) continue; seen.add(b.id);
    for (const k of [ROWKEY(stopOf(b).deadline?.key), 'governor']) if (k) m.set(k, [...(m.get(k) || []), b]);
  }
  return m;
}
// The next deadline that touches the bills in `touch`, else simply the next one: { row, touched: [bills] } or null once the session has ended
export function nextStop(rows, touch) {
  const today = ymd(Date.now()), ahead = rows.filter(r => r.date >= today);
  const row = ahead.find(r => r.key !== 'governor' && (touch.get(r.key) || []).length) || ahead.find(r => (touch.get(r.key) || []).length) || ahead[0];
  return row ? { row, touched: touch.get(row.key) || [] } : null;
}

// ---------------------------------------------------------------------------------- why a bill stopped
const unesc = s => String(s).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');   // model.js whyDead escapes its own pieces
const kindOf = lab => /final decking|fiscal/i.test(lab) ? 'deadline for the House and Senate to agree' : /triple|lateral|decking/i.test(lab) ? 'committee deadline' : /cross/i.test(lab) ? 'deadline to cross chambers' : /sine die/i.test(lab) ? 'end of the session' : 'deadline';
const mdy = (m, d, y) => dateWords(`${+y < 100 ? 2000 + +y : +y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
// "Missed the committee deadline on Fri, Feb 20, while waiting in HLT": the data layer's sentence with the Capitol's name and its m/d/yy date put into the words and dates above
export function whyWords(b) {
  return unesc(whyDead(b))
    .replace(/Through committee, but no floor vote before the .*? deadline on (\d+)\/(\d+)\/(\d+)/, (_, m, d, y) => `Through committee, but no floor vote by ${mdy(m, d, y)}`)
    .replace(/Missed the (.*?) deadline on (\d+)\/(\d+)\/(\d+)( while)?/, (_, lab, m, d, y, w) => `Missed the ${kindOf(lab)} on ${mdy(m, d, y)}${w ? ', while' : ''}`)
    .replace(/Missed the ([A-Za-z ]+) deadline\./, (_, lab) => `Missed the ${kindOf(lab)}.`);
}
