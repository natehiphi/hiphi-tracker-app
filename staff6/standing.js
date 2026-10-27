// Staff v2 · where a group of bills stands (R-226). The coalition page, the issue page and the Bills page all ask the same
// questions of a set of bills: which need a hearing and are at risk before their deadline, when is the next one, and which
// stage group each bill is in. They are answered here, once, so the three pages cannot disagree about a bill (A-14).
// Each takes the bills it is given; a coalition passes its own, an issue passes its own.
import { SESSION_OVER, fmtDate } from './data.js';
import { stopOf, riskOf, diedish, factsOf, whenAt } from './model.js';
import { stateMark, stanceKey } from './verbs.js';

// HIPHI's stance on a bill as its one shape and one word (R-344 Rule 2, verbs.js STATES.stance): Support, Oppose, Comments,
// Monitor; nothing for a bill with no position. Bills' rows and search results show it; the bill and issue pages can too.
export const stanceMark = (b, o = {}) => { const k = stanceKey(b?.position || ''); return k === 'none' ? '' : stateMark('stance', k, { size: 20, ...o }); };

export const isPos = b => !!b.position && b.position !== 'monitor';
export const byPri = (a, b) => (a.priority || 9) - (b.priority || 9) || a.bill_number.localeCompare(b.bill_number, 'en', { numeric: true });
// "Thu 3/19": the weekday rides along so nobody has to work it out. Takes a date string or an ISO time.
export const dayOf = d => fmtDate(d, { weekday: 'short' }).replace(/^(\w{3}),/, '$1');
// "9:30 AM today", "9:30 AM tomorrow", "Mon 9:30 AM": when testimony is due, from a row that already shows the hearing's day.
// R-277 fix 3 (W-6): the one way to say a moment, model.js whenAt ("today 9:30 AM", "Tue 3/17, 9:30 AM").
export const dueWhen = iso => whenAt(iso);

// Its bills still waiting for a hearing, split the way the weekly memo splits them (model.js memoData): at risk (the app's
// one meaning, a deadline a week away or less; A-14), then the bills racing the next deadline after that week. The pool
// is Today's for a coalition (today.js coalSection runs sessionClock over the same bills: Monitor out, dead bills out),
// so every bill Today counts as "still needs a hearing" is in one of the two lists.
export function waitingOfBills(bills) {
  if (SESSION_OVER) return { risk: [], next: null, race: [] };
  const w = bills.filter(b => b.position !== 'monitor' && !diedish(b)).map(b => ({ b, st: stopOf(b) }))
    .filter(x => x.st.column === 'a' && x.st.deadline && !x.st.deadline.missed);
  const risk = w.filter(x => riskOf(x.b)).map(x => ({ b: x.b, st: riskOf(x.b) })).sort((x, y) => x.st.deadline.days - y.st.deadline.days || byPri(x.b, y.b));
  const later = w.filter(x => !riskOf(x.b)), next = later.map(x => x.st.deadline.date).sort()[0] || null;
  return { risk, next, race: later.filter(x => x.st.deadline.date === next).sort((x, y) => byPri(x.b, y.b)) };
}

// ---- the stage groups (the Bills page's groups; Bills and an issue's count use these) ----
// R-277 fix 11 (V-2): At risk comes first. In stage order it sat under "Hearing scheduled", which at session volume ran
// to 40 rows and more, so the bills that need someone to act today were a long scroll down. Stage order after it.
export const GROUPS = [['risk', 'At risk: no hearing yet'], ['hear', 'Hearing scheduled'], ['wait', 'No hearing yet'], ['thru', 'Through its committees'],
  ['done', 'At the governor or law'], ['mon', 'Monitoring'], ['dead', 'Did not advance']];
// 'No hearing yet' (BILLS, 23 Oct): the Bills group, its Filter chip and its deadline line say it, so an issue's page does too
// (one word per fact, rule 6).
// The stand comes from factsOf, the same fact the filter counts use, so a group and its filter always agree.
export const groupKey = b => { const f = factsOf(b);
  if (f.stand === 'dead') return 'dead';
  if (b.position === 'monitor') return 'mon';
  return f.stand === 'b' ? 'hear' : f.stand === 'a' ? (f.risk ? 'risk' : 'wait') : f.stand === 'done' ? 'done' : 'thru'; };
