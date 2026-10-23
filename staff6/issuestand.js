// Where an issue stands, said once for My issues and All issues (R-272, Nate 10/13). His words: "If I'm searching for a
// specific issue it needs to be more intuitive. I shouldn't have to scroll alphabetically"; "an intuitive and immediately
// apparent way to ... see what has a hearing, but to see what issues are at risk of dying"; "if a bill in that issue has
// already passed the upcoming deadline, then the issue is not at risk of dying"; "it is also important to know what issues
// have bills dying despite a separate bill making it past a deadline"; and "the default view be the deadline sort, while
// there's ... a switch to flip [to] ... category". Search stays, as an extra: the page has to work without it.
//
// So an issue is judged as a whole, not bill by bill. Its bills on HIPHI's side (no Monitor, none HIPHI opposes on an issue
// it supports) are the ones that keep it alive; "at risk" keeps the app's one meaning for a bill (model.js riskOf: still
// needs a hearing, deadline a week away or less, A-14), and an issue is
//   At risk                          a bill of it is at risk and none of its bills is past that deadline (it can die);
//   Safe, but a bill on it is dying  a bill of it is at risk but another is already past that deadline;
//   Safe                             no bill of it is at risk and one is past the next deadline the others still face;
//   (ahead)                          no bill is at risk and none is past the next deadline yet: it says the deadline and
//                                    which bills still need a hearing;
//   (oppose)                         HIPHI opposes the issue: its bills dying is the goal, so never "at risk";
//   (stopped / none)                 every bill stopped, or no bills this session.
// "Past a deadline" is read from the deadline each bill is racing (stops.js billStop): a later one means it already cleared
// the earlier; one through the Legislature (Governor, law) is past every committee deadline.
//
// v6 (R-336 spec 6, V04, V19, D15): R-272's list is kept as Nate chose it (by deadline, a switch to topic, search an extra),
// restyled and trimmed. Each issue is one row of the shared shape (steps.js itemRow): its name, then ONE line that says
// where it stands in words with an icon (never colour alone, A-5): the testimony on its leading hearing in the five state
// words (V19: Writing, With an approver, Second look, Ready to file, Filed), and its mark. Bills are named by number, with
// no draft codes (D15). Nothing on a row is amber or red: "At risk" is a word and an icon (D3: amber is only late testimony
// still accepted, red only a step of yours overdue); a late step of the viewer's own keeps its colour (steps.js shownStatus).
import { S, SESSION_YEAR, SESSION_OVER, esc } from './data.js';
import { stopOf, riskOf, diedish, hearingAhead, plain, whenAt, deadlineName, gateNeed, testStep, stepKey, sittingDraft, lateLine, plainDeadlines, plainGate } from './model.js';
import { icon, iconBtn, sectionNav } from './ui.js';
import { ICONS } from '../icons.js';
import { plural } from './lists.js';
import { itemRow, billStep, shownStatus, numWords, dayWords, nw } from './steps.js';

const AGAINST = new Set(['strongly_oppose', 'oppose']);
const thisSession = b => !b.session_year || +b.session_year === +SESSION_YEAR;
const byNum = (a, b) => a.bill_number.localeCompare(b.bill_number, 'en', { numeric: true });
const dayAt = d => dayWords(d);
const WEEK = 7 * 864e5;
const billsOf = i => (S.billIssues || []).filter(x => x.issue_id === i.id).map(x => (S.bills || []).find(b => b.id === x.bill_id)).filter(Boolean);
// A bill in a line is its number (D15: no draft codes), its letters and digits kept together by a no-break space, so a phone
// never breaks "HB" from "2121" (the critic, C-15: keep a number whole).
const num = b => numWords(b).replace(' ', '\u00a0');
export const numNb = num;
// Kept for callers that name a bill by its nickname (the issue page's own lines).
export const shortName = (b, i) => b.nickname && plain(b.nickname) !== plain(i?.name) ? b.nickname : num(b);
// "HB 756", "HB 756 and SB 2175", "3 bills".
const names = l => l.length > 2 ? plural(l.length, 'bill') : l.map(num).join(' and ');
const needs = l => l.length === 1 ? 'needs' : 'need';
const THROUGH = new Set(['governor', 'law', 'ballot']);
// When an issue's hearing asks something of us: its testimony due time while open, else the hearing.
const hearWhen = x => x ? x.ts?.at || x.h.scheduled_at : undefined;

export function standOf(i) {
  const bills = billsOf(i).filter(b => thisSession(b) && b.tracked !== false).sort(byNum);
  const going = bills.filter(b => !diedish(b)), gone = bills.filter(diedish);
  // R-316 W23: the hearing that leads is the one whose testimony is due first (model.js testStep, Bills' Next column's rule),
  // so an issue's line says when its testimony is due, not the hearing day; filed and stepless bills come after.
  const hears = going.map(b => { const h = hearingAhead(b), ts = h && testStep(b, h); return h && { b, h, ts, k: stepKey(ts, h) }; }).filter(Boolean).sort((x, y) => x.k.localeCompare(y.k));
  const hear = hears[0] || null, out = { i, bills, going, gone, hear, state: 'none', when: null };
  if (!bills.length) return out;
  // Between sessions every bill has stopped; saying so on each line says nothing (A-14), so the lines carry no mark.
  if (SESSION_OVER) return { ...out, state: 'off' };
  if (!going.length) return { ...out, state: 'stopped' };
  const st = new Map(going.map(b => [b.id, stopOf(b)]));
  const dl = b => { const s = st.get(b.id); return s.deadline && !s.deadline.missed ? s.deadline : null; };
  const past = (b, date) => { const s = st.get(b.id), d = dl(b); return d ? d.date > date : THROUGH.has(s.phase); };
  if (i.stance === 'oppose') {
    const next = going.map(dl).filter(Boolean).sort((x, y) => x.date.localeCompare(y.date))[0] || null;
    return { ...out, state: 'oppose', next, when: hearWhen(hear) || (next ? next.date + 'T23:59:59-10:00' : null) };
  }
  // HIPHI's side: no Monitor, and none it opposes (unless no stance and nothing else is on it).
  let side = going.filter(b => b.position && b.position !== 'monitor' && !AGAINST.has(b.position));
  if (!side.length) side = going.filter(b => !AGAINST.has(b.position));
  const risky = side.filter(riskOf).sort((x, y) => dl(x).date.localeCompare(dl(y).date));
  if (risky.length) {
    const d = dl(risky[0]), facing = risky.filter(b => dl(b).date === d.date && !hearingAhead(b)), carried = side.filter(b => past(b, d.date));
    return { ...out, state: carried.length ? 'dying' : 'risk', deadline: d, facing, carried, when: [d.date + 'T23:59:59-10:00', hearWhen(hear)].filter(Boolean).sort()[0] };
  }
  const next = side.map(dl).filter(Boolean).sort((x, y) => x.date.localeCompare(y.date))[0] || null;
  if (!next) return { ...out, state: side.some(b => THROUGH.has(st.get(b.id).phase)) ? 'safe' : 'ahead', when: hearWhen(hear) || null };
  const carried = side.filter(b => past(b, next.date)), facing = side.filter(b => dl(b)?.date === next.date && st.get(b.id).column === 'a' && !hearingAhead(b));
  return { ...out, state: carried.length ? 'safe' : 'ahead', deadline: next, facing, carried, when: hearWhen(hear) && hearWhen(hear) < next.date ? hearWhen(hear) : next.date + 'T23:59:59-10:00' };
}

// ---- the words ----
// The mark, in words and an icon (A-5): one short phrase with no " · " inside, so a row stays a name and one line.
// `under`: the deadline date the group heading already names (R-316 W56, FR-6), so the row does not repeat it.
// The three marks of R-272 by name: "At risk", "Safe, but a bill on it is dying", "Safe".
const dlw = d => `${deadlineName(d).toLowerCase()} ${dayAt(d.date)}`;   // "second lateral Mon 3/30" (R-316 W1, C-15)
// C-15 (R-277 ui-critic): someone who owns no bills and is not an admin (Patti, Julie) reads what a deadline asks, never its
// Capitol name: "Bills must reach their last committee by Mon 3/30"; "Safe: SB 659 reached its last committee".
const PLAIN = () => plainDeadlines();
const pastNeed = (label, n) => gateNeed(label, n).replace(/^(clear|reach|pass)\b/, '$1ed').replace(/^be settled/, n === 1 ? 'was settled' : 'were settled');
export function markOf(x, { under = null } = {}) {
  const { i } = x, by = d => under === d.date ? '' : ` by ${dayAt(d.date)}`;
  switch (x.state) {
    case 'risk': return { ic: 'triangle-alert', word: 'At risk', text: `At risk: ${names(x.facing)} ${needs(x.facing)} a hearing${by(x.deadline)}` };
    case 'dying': return { ic: 'circle-alert', word: 'Safe, but a bill on it is dying', text: `Safe, but a bill on it is dying: ${names(x.facing)} ${needs(x.facing)} a hearing${by(x.deadline)}` };
    case 'safe': return { ic: 'shield-check', word: 'Safe', text: !x.deadline ? 'Safe: through its committees'
      : PLAIN() ? `Safe: ${names(x.carried)} ${pastNeed(x.deadline.label, x.carried.length)}` : `Safe: ${names(x.carried)} past ${deadlineName(x.deadline).toLowerCase()}` };
    case 'ahead': return !x.deadline ? null : x.facing?.length ? { ic: 'clock', word: 'Needs a hearing', text: `${names(x.facing)} ${needs(x.facing)} a hearing${by(x.deadline)}` }
      : { ic: 'clock', word: '', text: under === x.deadline.date ? 'No bill waiting for a hearing' : PLAIN() ? plainGate(x.deadline.label, dayAt(x.deadline.date)) : `Next deadline: ${dlw(x.deadline)}` };
    case 'oppose': return x.hear ? null : { ic: 'circle-x', word: 'HIPHI opposes', text: `HIPHI opposes it: no hearing set${x.next && under !== x.next.date ? `, next deadline ${PLAIN() ? dayAt(x.next.date) : dlw(x.next)}` : ''}` };
    case 'stopped': return { ic: 'circle-minus', word: '', text: i.stance === 'oppose' ? 'Its bills did not advance' : 'Nothing moving this session' };
    case 'none': return { ic: 'circle-dashed', word: '', text: `No ${SESSION_YEAR} bills on it yet` };
    case 'off': return x.bills.length ? { ic: '', word: '', text: `${plural(x.bills.length, 'bill')} in ${SESSION_YEAR}` } : { ic: 'circle-dashed', word: '', text: `No ${SESSION_YEAR} bills on it` };
  }
  return null;
}
// The testimony on the issue's leading hearing, in V19's state words: "SB 3076 testimony: Writing, sent back, due today
// 2:00 PM"; filed: "HB 1573 testimony: Filed, hearing Wed 3/18, 9:30 AM". The step itself (steps.js billStep) decides the
// words and, for the viewer's own step only, the colour (shownStatus: late amber, overdue red). Due today, or within two
// hours, is neutral as D3 says: a clock and the time in bold, whoever's step it is; the row's quiet tag "Your step" says
// when it is the viewer's (the critic: bold alone said "yours" and nothing on the screen said so).
export function hearPart(x) {
  const hr = x.hear; if (!hr) return null;
  const { b, h } = hr, d = sittingDraft(h, b.id) || null, s = billStep(b, { d, h });
  if (!s?.state) { const t = `${num(b)} hearing ${whenAt(h.scheduled_at)}`; return { ic: 'calendar-days', text: t, html: nw(esc(t)), s: null }; }
  const st = s.state, sh = shownStatus(s) || {}, late = s.status?.tone === 'late';
  const tone = sh.tone && sh.tone !== 'neutral' ? sh.tone : '';
  const soon = !tone && !late && !!(sh.soon || s.status?.soon) && !['filed', 'missed'].includes(st.key) && s.due != null;
  const lead = `${num(b)} testimony: ${st.word}${st.sentBack ? ', sent back' : ''}`;
  const when = st.key === 'filed' ? `hearing ${whenAt(h.scheduled_at)}` : st.key === 'missed' ? '' : late ? lateLine(s.until, { lower: true }) : s.due != null ? `due ${whenAt(s.due)}` : '';
  const text = `${lead}${when ? `, ${when}` : ''}`;
  const html = soon ? `${nw(esc(lead))}, due <b class="i6-time">${nw(esc(whenAt(s.due)))}</b>` : nw(esc(text));
  return { ic: tone ? sh.icon : soon || late ? 'clock' : st.key === 'filed' ? 'circle-check' : 'calendar-days', text, html, tone, soon, late, you: !!s.you, s };
}
// The row's one line: risk and a dying bill lead (Nate: "see what issues are at risk of dying"); otherwise the hearing's
// testimony leads, then the mark when it adds something. At most two parts, each one fact (spec 8: four facts a row).
// Only the first part carries a colour (the critic: a green "Filed" spilt onto "HB 2340 needs a hearing", which then read
// as done; A-5); the second stays the body colour. `you`: the testimony step is the viewer's and due soon or late.
export function lineOf(x, { under = null, why = null } = {}) {
  const m = markOf(x, { under }), hp = hearPart(x);
  const urgent = ['risk', 'dying'].includes(x.state);
  // A mark that only repeats the group (an issue ahead of its deadline under "This week" because of its hearing) is left out.
  const markUseful = m && (urgent || ['safe', 'stopped', 'none', 'off', 'oppose'].includes(x.state) || (x.state === 'ahead' && x.facing?.length));
  let parts = urgent ? [m, hp] : [hp, markUseful || !hp ? m : null];
  // Found by a bill: the line says which, unless the line already names that bill ("HB 2121 testimony: ...").
  if (why) { const lead = urgent ? m : hp || m; parts = lead?.text?.includes(num(why)) ? [lead] : [{ ic: 'search', text: `Found by its bill ${num(why)}` }, lead]; }
  parts = parts.filter(p => p && p.text);
  const first = parts[0] || null;
  const ph = (p, k) => { const h = p.html || nw(esc(p.text)); return k === 0 && p.tone ? `<span class="i6-p1 t-${p.tone}">${h}</span>` : h; };
  return { parts, ic: first?.ic || '', tone: first?.tone || '', bold: false, you: !!(hp?.you && (hp.soon || hp.late || hp.tone)), html: parts.map(ph).join(' · ') };
}

// ---- the deadline sort (the default in session) ----
// This week: a hearing within the week, at risk, or a bill dying (Nate 10/13: "For now, yes, but let's discuss later").
// Then what comes next by date, then Safe, then the folds for what is not moving and what has no bills.
export const thisWeek = x => ['risk', 'dying'].includes(x.state) || (!!x.hear && new Date(x.hear.h.scheduled_at) - Date.now() <= WEEK);
const byWhen = (a, b) => String(a.when || '9').localeCompare(String(b.when || '9')) || a.i.name.localeCompare(b.i.name);
export function deadlineGroups(list) {
  const wk = list.filter(thisWeek).sort((a, b) => (['risk', 'dying'].includes(a.state) ? 0 : 1) - (['risk', 'dying'].includes(b.state) ? 0 : 1) || byWhen(a, b));
  const rest = list.filter(x => !wk.includes(x));
  return [
    ['week', 'This week', wk, false],
    ['next', 'Next deadlines', rest.filter(x => ['ahead', 'oppose'].includes(x.state)).sort(byWhen), false],
    ['safe', 'Safe for now', rest.filter(x => x.state === 'safe').sort(byWhen), false],
    ['stopped', 'Nothing moving this session', rest.filter(x => x.state === 'stopped').sort(byWhen), true],
    ['none', 'No bills yet', rest.filter(x => x.state === 'none').sort(byWhen), true],
  ];
}
// Inside a topic, most urgent first: at risk, a bill dying, a hearing this week, then by date; no bills last.
const URGE = { risk: 0, dying: 1, ahead: 3, oppose: 3, safe: 4, off: 5, stopped: 6, none: 7 };
export const byUrgency = (a, b) => (thisWeek(a) ? 0 : 1) - (thisWeek(b) ? 0 : 1) || URGE[a.state] - URGE[b.state] || byWhen(a, b);
// A topic's own count: "1 at risk, 2 with a bill dying, 3 hearings this week" (one fact: commas, not dots).
export function topicCount(l) {
  const r = l.filter(x => x.state === 'risk').length, d = l.filter(x => x.state === 'dying').length, h = l.filter(x => x.hear && new Date(x.hear.h.scheduled_at) - Date.now() <= WEEK).length;
  return [r ? `${r} at risk` : '', d ? `${d} with a bill dying` : '', h ? `${h} with a hearing this week` : ''].filter(Boolean);
}

// ---- By deadline · By topic (the switch) ----
// Remembered on this device (B-6). Between sessions there are no deadlines to sort by, so it opens By topic.
const KEY = 'sv_issues_view';
export function viewOf() {
  let v = null; try { v = localStorage.getItem(KEY); } catch { /* private window */ }
  return v === 'topic' || v === 'deadline' ? v : SESSION_OVER ? 'topic' : 'deadline';
}
export const setView = v => { try { localStorage.setItem(KEY, v); } catch { /* this visit only */ } S.isView = v; };
export const currentView = () => S.isView || viewOf();

// ---- search, an extra (R-272): every word, any order, the start of a word is enough ----
// It matches the words a person would use, not only the issue's name: its description, goal and talking points, its topic,
// the bills on it (number with or without the letters, nickname, title, summary), and a short list of words for the same
// thing. "vape" stays searchable though HIPHI writes "e-cigarettes" (R-158).
const SAME = [['e-cigarette', 'e-cigarettes', 'ecig', 'vape', 'vapes', 'vaping', 'e-liquid'], ['tobacco', 'cigarette', 'cigarettes', 'smoking', 'nicotine', 'cigar'],
  ['snap', 'food stamps', 'ebt', 'hunger', 'food assistance'], ['kupuna', 'seniors', 'elderly', 'older adults', 'aging'],
  ['keiki', 'children', 'kids', 'youth', 'students', 'school'], ['alcohol', 'liquor', 'beer', 'wine', 'drinking'],
  ['sugar', 'soda', 'sugary drinks', 'sweetened beverages'], ['housing', 'rent', 'homeless', 'houseless'],
  ['bike', 'bicycle', 'cycling', 'pedestrian', 'walking', 'crosswalk', 'traffic'], ['climate', 'heat', 'emissions', 'carbon'],
  ['medicaid', 'med-quest', 'medquest', 'insurance', 'coverage'], ['mental health', 'behavioral health', 'counseling', 'suicide'],
  ['minimum wage', 'wages', 'pay'], ['tax credit', 'earned income', 'eitc', 'tax']];
// Hyphens drop out on both sides, so "e-cigarette", "ecigarette" and "e cigarette" are one word.
const norm = s => plain(s).replace(/(\b\w)-(?=\w)/g, '$1').replace(/-/g, ' ');
const words = s => norm(s).split(/[^a-z0-9]+/).filter(Boolean);
function expand(t) {
  const out = [t];
  for (const g of SAME) if (g.some(w => norm(w).startsWith(t) || t.startsWith(norm(w).split(' ')[0]))) out.push(...g.map(norm));
  return [...new Set(out)];
}
// Each match carries a score, so the best one leads: the word itself in the issue's name, then a word for the same thing in
// its name, then its description, goal, points or topic, then one of its bills (and that bill is named on the line).
// "HB 2121" as the app now prints it (D15, with its space) is one word to match, as are "hb 2121" and "HB2121" (the critic:
// a number copied off the screen found nothing).
export const joinNums = q => String(q || '').replace(/\b(hb|sb|hr|sr|hcr|scr|gm)\s+(\d)/gi, '$1$2');
export function searcher(q) {
  const ts = words(joinNums(q)); if (!ts.length) return null;
  const cat = k => (S.categories || []).find(c => c.key === k)?.name || '';
  const has = (ws, text, alts) => ws.some(w => alts.some(a => !a.includes(' ') && w.startsWith(a))) || alts.some(a => a.includes(' ') && norm(text).includes(a));
  return x => {
    const { i } = x, all = billsOf(i).filter(thisSession);
    const nameT = i.name, ownT = `${i.description || ''} ${i.goal || ''} ${(i.talking_points || []).join(' ')} ${cat(i.category)}`;
    let why = null, score = 0;
    for (const t of ts) {
      const alts = expand(t);
      if (has(words(nameT), nameT, [t])) continue;
      if (has(words(nameT), nameT, alts)) { score += 1; continue; }
      if (has(words(ownT), ownT, alts)) { score += 2; continue; }
      const n = t.replace(/^(hb|sb|hr|sr|hcr|scr|gm)/, ''), bt = b => `${b.nickname || ''} ${b.title || ''} ${b.public_summary || ''}`, bn = b => plain(b.bill_number).replace(/\s+/g, '');
      const b = all.find(b => /\d/.test(t) && (bn(b).includes(t) || bn(b).replace(/^[a-z]+/, '').startsWith(n)))
        || all.find(b => has(words(bt(b)), bt(b), [t])) || all.find(b => has(words(bt(b)), bt(b), alts));
      if (!b) return null;
      score += 3; why ??= b;
    }
    return { why, score };
  };
}

// ---- the page body, the same on both pages ----
// One row per issue (steps.js itemRow): its name, a quiet tag beside it ("You help", "Draft") where it applies, and the
// one line. The whole row opens the issue's page, where its week and every bill are (R-226). No topic icon on the row
// (X33: My issues carried 127 icons); the topic's icon heads its group in the topic view.
export function rowOf(x, { from = '', tags = [], why = null, under = null } = {}) {
  const { i } = x, href = `#/issue/${encodeURIComponent(i.id)}${from ? `?from=${from}` : ''}`, l = lineOf(x, { under, why });
  // The tone is on the line's first part only (lineOf); the row's class colours its icon to match.
  return itemRow({ key: i.id, name: i.name, num: [...tags, l.you ? 'Your step' : ''].filter(Boolean).join(', '), line: l.html, icon: l.ic, href, cls: `i6-row${l.tone ? ' i6-ic-' + l.tone : ''}` });
}
export const lineHTML = rowOf;   // v5's name for the row
// R-316 W56 (FR-6, R-277's 25-row rule): a long group shows its first 8 rows, then "Show the other N" in place.
const SHOW = 8;
export const listBox = rows => `<div class="v6-list i6-list" role="list">${rows}</div>`;
function listHTML(l, o) {
  const one = x => rowOf(x, { ...o, tags: o.tagsOf ? o.tagsOf(x) : [] });
  if (!o.cut || l.length <= SHOW + 2) return listBox(l.map(one).join(''));
  return `${listBox(l.slice(0, SHOW).map(one).join(''))}<details class="i6-more"><summary>${icon('chevron-down', { cls: 'i6-chev' })}<span>Show the other ${l.length - SHOW}</span></summary>${listBox(l.slice(SHOW).map(one).join(''))}</details>`;
}
// Next deadlines, one group per deadline, its date said once in its heading: "Second lateral, Mon 3/30: bills must reach
// their last committee".
function byDeadline(l, o) {
  const keyOf = x => (x.state === 'oppose' ? x.next : x.deadline) || null, groups = new Map();
  for (const x of l) { const d = keyOf(x), k = d ? d.date : ''; if (!groups.has(k)) groups.set(k, { d, l: [] }); groups.get(k).l.push(x); }
  return [...groups.values()].map(({ d, l }) => `<h3 class="i6-sub">${!d ? 'No deadline set' : PLAIN() ? esc(plainGate(d.label, dayAt(d.date)))
      : `${esc(deadlineName(d))}, ${esc(dayAt(d.date))}: <span class="i6-subw">bills must ${esc(gateNeed(d.label, 2))}</span>`}</h3>
    ${listHTML(l, { ...o, under: d?.date || null, cut: true })}`).join('');
}
const fold = (id, title, l, o) => `<details class="i6-fold" data-fold="${id}"><summary>${icon('chevron-down', { cls: 'i6-chev' })}<span>${esc(title)} (${l.length})</span></summary>${listHTML(l, o)}</details>`;

export function deadlineHTML(list, o = {}) {
  return deadlineGroups(list).map(([k, title, l, folded]) => {
    if (folded) return l.length ? fold(k, title, l, o) : '';
    // An empty This week is one quiet line, not a heading over a sentence (the critic; A-14).
    if (!l.length) return k === 'week' ? `<p class="i6-quiet i6-weekq">${icon('calendar-check')}<span>No issue here is at risk or has a hearing this week.</span></p>` : '';
    // A group's rows are in view, so its heading does not count them (A-24); a folded group keeps its count.
    return `<section class="i6-sec" aria-labelledby="i6-h-${k}"><h2 class="i6-h" id="i6-h-${k}">${esc(title)}</h2>
      ${k === 'next' ? byDeadline(l, o) : listHTML(l, { ...o, cut: k !== 'week' || l.length > 25 })}</section>`;   // This week stays whole: it is what is due
  }).join('');
}
// By topic: the six topics in their order, each with its icon and its count. `folded` (All issues, about 90 issues) keeps
// one topic open at a time with its counts on its line; My issues shows each topic open under its heading.
export function topicHTML(list, o = {}) {
  const html = (S.categories || []).map(c => {
    const l = list.filter(x => x.i.category === c.key).sort(byUrgency); if (!l.length && !o.folded) return '';
    const cnt = topicCount(l), head = `<span class="i6-catic" aria-hidden="true">${icon(c.icon || 'tag')}</span>`;
    if (o.folded) return `<details class="i6-catf" data-cat="${esc(c.key)}"${o.open === c.key ? ' open' : ''}><summary>${head}
        <span class="i6-catb"><span class="i6-catn">${esc(c.name)}</span><span class="i6-catm">${esc([plural(l.length, 'issue'), ...cnt].join(', '))}</span></span>${icon('chevron-down', { cls: 'i6-chev' })}</summary>
      ${l.length ? listHTML(l, o) : '<p class="i6-quiet">No issues in it yet.</p>'}</details>`;
    return `<section class="i6-sec i6-topic" aria-labelledby="i6-t-${esc(c.key)}"><h2 class="i6-h i6-th" id="i6-t-${esc(c.key)}">${head}<span>${esc(c.name)}</span></h2>${cnt.length ? `<p class="i6-tc">${esc(cnt.join(', '))}</p>` : ''}${listHTML(l, o)}</section>`;
  }).join('');
  return o.folded ? `<div class="i6-cats">${html}</div>` : html;
}
export function searchHTML(list, q, o = {}) {
  const f = searcher(q), hits = f ? list.map(x => ({ x, m: f(x) })).filter(y => y.m) : [];
  if (!hits.length) return `<p class="i6-quiet">No issue matches “${esc(q.trim())}”. Try a bill number, a bill’s nickname or another word for it.</p>`;
  hits.sort((a, b) => a.m.score - b.m.score || byUrgency(a.x, b.x));
  return `<p class="i6-found" role="status">${plural(hits.length, 'issue')} ${hits.length === 1 ? 'matches' : 'match'}</p>
    ${listBox(hits.map(({ x, m }) => rowOf(x, { ...o, why: m.why, tags: o.tagsOf ? o.tagsOf(x) : [] })).join(''))}`;
}
// The body for the view in force: a search shows its matches; else By deadline or By topic. Between sessions By deadline
// has nothing to sort, so it says so once and shows the topics.
export function bodyHTML(list, { q = '', ...o } = {}) {
  if (q.trim()) return searchHTML(list, q, o);
  if (currentView() === 'topic') return topicHTML(list, o);
  if (SESSION_OVER) return `<p class="i6-quiet">Between sessions there are no hearings or deadlines to sort by, so the issues are by topic until the next session opens.</p>${topicHTML(list, o)}`;
  return deadlineHTML(list, o);
}
// The filter box and the switch, side by side on a laptop. On a phone they share one line: a 44px Filter button that opens
// the box, beside the switch (the critic: three rows of look-alike pills pushed the first issue below the fold). The
// header's search finds anything; this box only narrows this list, so it says Filter (the frame's rule). A short list (under
// 6 issues) has neither: two rows need no filter and no sort (spec 0, less per screen). `extra`: the page's own phone button
// (All issues' New issue), which sits at the end of this line on a phone.
// The filter's icon: Lucide's list-filter once icons.js has it (FRAME adds it for Bills), the sliders until then.
const FILTER_IC = ICONS['list-filter'] ? 'list-filter' : 'sliders-horizontal';
export const FEW = 6;
export const toolsHTML = (q, id, { label = 'Filter these issues', count = 99, extra = '' } = {}) => count < FEW && !q ? (extra ? `<div class="i6-tools i6-tools-x">${extra}</div>` : '') : `<div class="i6-tools${q ? ' open' : ''}" data-istools="${id}">
    ${iconBtn(FILTER_IC, label, { 'data-istq': 'open', 'aria-expanded': String(!!q), 'aria-controls': `${id}-find` }, 'i6-findbtn')}
    <div class="i6-find" id="${id}-find">${icon(FILTER_IC)}<input id="${id}" type="search" placeholder="${esc(label)}" value="${esc(q)}" autocomplete="off" aria-label="${esc(label)}: a word, a bill number or a bill’s nickname" aria-controls="${id}-body">${iconBtn('x', 'Clear the filter', { 'data-istq': 'clear', hidden: !q })}</div>
    <div class="sv-seg i6-seg" role="group" aria-label="Sort the issues">${[['deadline', 'By deadline'], ['topic', 'By topic']].map(([v, l]) => `<button type="button" data-isview="${v}" aria-pressed="${currentView() === v}">${l}</button>`).join('')}</div>
    ${extra}
  </div>`;
// Wires the box and the switch; `paint()` redraws only the body, so typing keeps the focus in the box.
export function wireTools(root, id, { get, set, paint }) {
  const q = root.querySelector('#' + id), x = root.querySelector('[data-istq="clear"]'), bar = root.querySelector(`[data-istools="${id}"]`), opener = bar?.querySelector('[data-istq="open"]');
  const setOpen = on => { if (!bar) return; bar.classList.toggle('open', on); opener?.setAttribute('aria-expanded', String(on)); };
  if (opener) opener.onclick = () => { setOpen(true); q?.focus(); };
  // Once opened it stays open for this visit: closing it on blur moved the list under a tap on its first row.
  if (q) q.oninput = () => { set(q.value); x.hidden = !q.value; paint(); };
  if (x) x.onclick = () => { set(''); q.value = ''; x.hidden = true; paint(); q.focus(); };
  root.querySelectorAll('[data-isview]').forEach(b => b.onclick = () => {
    setView(b.dataset.isview); root.querySelectorAll('[data-isview]').forEach(o => o.setAttribute('aria-pressed', String(o === b))); paint(); });
  void get;
}

// ---- the place's head, the same on its three tabs (spec 5 placeHead, A-8, A-12) ----
// The title and the page's one button on one row, the tabs straight under it at the same height on every tab, and what is
// said about the list (a lede, the one-line notes) under the tabs, never between the title and the tabs (the critic: the
// tab row sat at three heights). A phone's top bar carries the title, so the tabs come first there.
export const headHTML = (cur, { action = '' } = {}) => `<header class="i6-head"><div class="i6-htop"><h1 class="i6-h1">My issues</h1>${action ? `<div class="i6-hacts">${action}</div>` : ''}</div>${sectionNav('issues', cur)}</header>`;

// ---- rule 10: Back from an issue or a coalition puts the focus on the row it was opened from ----
// The page that was open says which row (rememberRow); the list, drawn again by Back, focuses that row once and scrolls it
// into view if the window does not show it. Only after Back (a popstate): arriving another way starts at the top as usual.
let popAt = 0;
try { addEventListener('popstate', () => { popAt = Date.now(); }); } catch { /* not a browser */ }
export const rememberRow = id => { S.i6Back = String(id); };
export function restoreRow(root) {
  const id = S.i6Back; if (!id) return; S.i6Back = null;
  setTimeout(() => {
    if (Date.now() - popAt > 2500) return;
    const a = root.querySelector(`[data-v6row="${CSS.escape(id)}"] .v6-row-main`); if (!a) return;
    a.focus({ preventScroll: true });
    const r = a.getBoundingClientRect(); if (r.top < 0 || r.bottom > innerHeight) a.scrollIntoView({ block: 'center' });
  }, 30);
}
