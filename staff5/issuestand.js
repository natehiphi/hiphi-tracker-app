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
//   At risk         when a bill of it is at risk and none of its bills is already past that deadline (the issue can die);
//   Bill dying      when a bill of it is at risk but another is already past that deadline (the issue lives on, a bill dies);
//   Safe            when no bill of it is at risk and one is past the next deadline the others still face;
//   Ahead           when no bill is at risk and none is past the next deadline yet (it says the deadline and how many need
//                   a hearing);
//   Opposed         HIPHI opposes the issue: its bills dying is the goal, so never "at risk"; it says the hearing or the deadline;
//   Stopped / none  every bill stopped, or no bills this session.
// "Past a deadline" is read from the deadline each bill is racing (stops.js billStop): a later one means it already cleared
// the earlier; one through the Legislature (Governor, law) is past every committee deadline.
import { S, SESSION_YEAR, SESSION_OVER, esc, fmtDT } from './data.js';
import { stopOf, riskOf, diedish, hearingAhead, billNum, plain, whenAt } from './model.js';
import { icon, iconBtn } from './ui.js';
import { plural } from './lists.js';
import { dayOf } from './standing.js';

const FOR = new Set(['strongly_support', 'support', 'support_amend']), AGAINST = new Set(['strongly_oppose', 'oppose']);
const thisSession = b => !b.session_year || +b.session_year === +SESSION_YEAR;
const byNum = (a, b) => a.bill_number.localeCompare(b.bill_number, 'en', { numeric: true });
const dayAt = d => dayOf(d + 'T12:00:00-10:00');
const WEEK = 7 * 864e5;
const billsOf = i => (S.billIssues || []).filter(x => x.issue_id === i.id).map(x => (S.bills || []).find(b => b.id === x.bill_id)).filter(Boolean);
// A bill's short name in a mark: its nickname, or its number when it has none or its nickname is the issue's own name.
const num = b => billNum(b).replace(/ /g, '\u00a0');   // never "HB1562 / HD1" across two lines on a phone
export const shortName = (b, i) => b.nickname && plain(b.nickname) !== plain(i?.name) ? b.nickname : num(b);
// Two bills with one nickname (a House bill and its Senate twin) are named by number, so the line never says a name twice.
const names = (l, i) => { if (l.length > 2) return plural(l.length, 'bill');
  const n = l.map(b => shortName(b, i)), twin = n.length === 2 && n[0] === n[1];
  return twin ? `${num(l[0])} and ${num(l[1])}` : n.join(' and '); };
const THROUGH = new Set(['governor', 'law', 'ballot']);

export function standOf(i) {
  const bills = billsOf(i).filter(b => thisSession(b) && b.tracked !== false).sort(byNum);
  const going = bills.filter(b => !diedish(b)), gone = bills.filter(diedish);
  const hears = going.map(b => ({ b, h: hearingAhead(b) })).filter(x => x.h).sort((x, y) => x.h.scheduled_at.localeCompare(y.h.scheduled_at));
  const hear = hears[0] || null, out = { i, bills, going, gone, hear, state: 'none', when: null, mark: '' };
  if (!bills.length) return out;
  // Between sessions every bill has stopped; saying so on each line says nothing (A-14), so the lines carry no mark.
  if (SESSION_OVER) return { ...out, state: 'off' };
  if (!going.length) return { ...out, state: 'stopped' };
  const st = new Map(going.map(b => [b.id, stopOf(b)]));
  const dl = b => { const s = st.get(b.id); return s.deadline && !s.deadline.missed ? s.deadline : null; };
  const past = (b, date) => { const s = st.get(b.id), d = dl(b); return d ? d.date > date : THROUGH.has(s.phase); };
  if (i.stance === 'oppose') {
    const next = going.map(dl).filter(Boolean).sort((x, y) => x.date.localeCompare(y.date))[0] || null;
    return { ...out, state: 'oppose', next, when: hear?.h.scheduled_at || (next ? next.date + 'T23:59:59-10:00' : null) };
  }
  // HIPHI's side: no Monitor, and none it opposes (unless no stance and nothing else is on it).
  let side = going.filter(b => b.position && b.position !== 'monitor' && !AGAINST.has(b.position));
  if (!side.length) side = going.filter(b => !AGAINST.has(b.position));
  const risky = side.filter(riskOf).sort((x, y) => dl(x).date.localeCompare(dl(y).date));
  if (risky.length) {
    const d = dl(risky[0]), facing = risky.filter(b => dl(b).date === d.date && !hearingAhead(b)), carried = side.filter(b => past(b, d.date));
    return { ...out, state: carried.length ? 'dying' : 'risk', deadline: d, facing, carried, when: [d.date + 'T23:59:59-10:00', hear?.h.scheduled_at].filter(Boolean).sort()[0] };
  }
  const next = side.map(dl).filter(Boolean).sort((x, y) => x.date.localeCompare(y.date))[0] || null;
  if (!next) return { ...out, state: side.some(b => THROUGH.has(st.get(b.id).phase)) ? 'safe' : 'ahead', when: hear?.h.scheduled_at || null };
  const carried = side.filter(b => past(b, next.date)), facing = side.filter(b => dl(b)?.date === next.date && st.get(b.id).column === 'a' && !hearingAhead(b));
  return { ...out, state: carried.length ? 'safe' : 'ahead', deadline: next, facing, carried, when: hear?.h.scheduled_at && hear.h.scheduled_at < next.date ? hear.h.scheduled_at : next.date + 'T23:59:59-10:00' };
}

// The mark on an issue's line, in words and an icon, never colour alone (A-5). The hearing, when one is set, leads.
export function markHTML(x) {
  const { i, hear } = x, parts = [];
  if (hear) parts.push(`<span class="ist-m ist-hear">${icon('calendar-days')}<span>Hearing ${esc(whenAt(hear.h.scheduled_at))} · ${esc(shortName(hear.b, i))}</span></span>`);
  const dlw = d => `${d.label} ${dayAt(d.date)}`;
  const say = {
    risk: () => `<span class="ist-m ist-risk">${icon('triangle-alert')}<span><b>At risk</b> · ${esc(dlw(x.deadline))} · ${esc(names(x.facing, i))} still ${x.facing.length === 1 ? 'needs' : 'need'} a hearing, no bill past it</span></span>`,
    dying: () => `<span class="ist-m ist-dying">${icon('circle-alert')}<span><b>Safe, a bill dying</b> · ${esc(names(x.carried, i))} past ${esc(x.deadline.label)} · ${esc(names(x.facing, i))} ${x.facing.length === 1 ? 'dies' : 'die'} ${esc(dayAt(x.deadline.date))} without a hearing</span></span>`,
    safe: () => `<span class="ist-m ist-safe">${icon('shield-check')}<span><b>Safe</b>${x.deadline ? ` · ${hear && x.carried.length === 1 && x.carried[0] === hear.b ? '' : esc(names(x.carried, i)) + ' '}past ${esc(x.deadline.label)}` : ' · through its committees'}</span></span>`,
    // No bill past the next deadline and some still unheard: the issue dies then unless one gets a hearing. Said in the at-risk
    // words with the warning icon, in plain dark text; red and "At risk" stay for the last week (A-5, the critic's high).
    ahead: () => !x.deadline ? '' : x.facing?.length ? `<span class="ist-m ist-need">${icon('triangle-alert')}<span><b>Needs a hearing by ${esc(dlw(x.deadline))}</b> · ${esc(names(x.facing, i))}, no bill past it</span></span>`
      : `<span class="ist-m ist-ahead">${icon('clock')}<span>${esc(dlw(x.deadline))}</span></span>`,
    oppose: () => hear ? '' : `<span class="ist-m ist-ahead">${icon('circle-x')}<span>HIPHI opposes · no hearing set${x.next ? ` · ${esc(dlw(x.next))}` : ''}</span></span>`,
    stopped: () => `<span class="ist-m ist-off">${icon('circle-minus')}<span>${i.stance === 'oppose' ? 'Its bills did not advance' : 'Nothing moving this session'}</span></span>`,
    none: () => `<span class="ist-m ist-off">${icon('circle-dashed')}<span>No ${esc(SESSION_YEAR)} bills on it yet</span></span>`,
    off: () => '',
  }[x.state];
  const m = say ? say() : '';
  if (m) parts.push(m);
  return parts.join('');
}

// The line's second row: its bills by short name, so an issue is known even when its name is not the words you had in mind.
export function billsLine(x) {
  const said = new Set([x.hear?.b, ...(['risk', 'dying', 'safe', 'ahead'].includes(x.state) ? [...(x.facing?.length <= 2 ? x.facing : []), ...(x.state !== 'risk' && x.carried?.length <= 2 ? x.carried : [])] : [])].filter(Boolean).map(b => b.id));
  const rest = x.going.filter(b => !said.has(b.id)).map(b => shortName(b, x.i));
  return !rest.length ? '' : rest.length === x.going.length ? rest.join(' · ') : `Also on it: ${rest.join(' · ')}`;
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
// A topic's own count: "1 at risk · 2 with a bill dying · 3 hearings this week".
export function topicCount(l) {
  const r = l.filter(x => x.state === 'risk').length, d = l.filter(x => x.state === 'dying').length, h = l.filter(x => x.hear && new Date(x.hear.h.scheduled_at) - Date.now() <= WEEK).length;
  return [r ? `${r} at risk` : '', d ? `${d} with a bill dying` : '', h ? plural(h, 'hearing') + ' this week' : ''].filter(Boolean);
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
export function searcher(q) {
  const ts = words(q); if (!ts.length) return null;
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
      const num = t.replace(/^(hb|sb|hr|sr|hcr|scr)/, ''), bt = b => `${b.nickname || ''} ${b.title || ''} ${b.public_summary || ''}`;
      const b = all.find(b => /\d/.test(t) && (plain(b.bill_number).includes(t) || plain(b.bill_number).replace(/^[a-z]+/, '').startsWith(num)))
        || all.find(b => has(words(bt(b)), bt(b), [t])) || all.find(b => has(words(bt(b)), bt(b), alts));
      if (!b) return null;
      score += 3; why ??= b;
    }
    return { why, score };
  };
}
// ---- the page body, the same on both pages ----
// One line per issue: its topic's icon, its name (with "You help" or "Draft" where it applies), the mark, and its bills by
// short name. The whole line opens the issue's page, where its week and every bill are (R-226).
const catOf = k => (S.categories || []).find(c => c.key === k) || null;
export function lineHTML(x, { from = '', tags = [], why = null, noIcon = false } = {}) {
  const { i } = x, c = catOf(i.category), href = `#/issue/${encodeURIComponent(i.id)}${from ? `?from=${from}` : ''}`;
  const mark = markHTML(x), bl = why ? `Found by its bill ${shortName(why, i)}` : billsLine(x);
  return `<a class="ist-row" href="${href}">${noIcon ? '' : `<span class="ist-ic" aria-hidden="true">${icon(c?.icon || 'tag')}</span>`}
    <span class="ist-body"><span class="ist-name"><span class="ist-nm">${esc(i.name)}</span>${tags.map(t => `<span class="ist-tag">${esc(t)}</span>`).join('')}</span>
      ${mark ? `<span class="ist-marks">${mark}</span>` : ''}${bl ? `<span class="ist-bills">${esc(bl)}</span>` : ''}</span>${icon('chevron-right', { cls: 'chev' })}</a>`;
}
const listHTML = (l, o) => `<div class="ist-list">${l.map(x => lineHTML(x, { ...o, tags: o.tagsOf ? o.tagsOf(x) : [] })).join('')}</div>`;
const fold = (id, title, l, o) => `<details class="ist-fold" data-fold="${id}"><summary>${icon('chevron-down', { cls: 'is-chev' })}<span>${esc(title)} (${l.length})</span></summary>${listHTML(l, o)}</details>`;

export function deadlineHTML(list, o = {}) {
  return deadlineGroups(list).map(([k, title, l, folded]) => {
    if (folded) return l.length ? fold(k, title, l, o) : '';
    if (!l.length && k !== 'week') return '';
    // R-277 fix 13 (A-24: numbers only where they ask for action): an open group's rows are in view, so its heading no
    // longer counts them ("This week 9"); a folded group keeps its count, the only sign of what is inside.
    return `<section class="ist-sec ist-sec-${k}" aria-labelledby="ist-h-${k}"><h2 class="ist-h" id="ist-h-${k}">${esc(title)}</h2>
      ${l.length ? listHTML(l, o) : '<p class="ist-empty">Nothing at risk and no hearing this week.</p>'}</section>`;
  }).join('');
}
// By topic: the six topics in their order. `folded` (All issues, about 90 issues) keeps one topic open at a time with its
// counts on its line; My issues shows each topic open with a heading.
export function topicHTML(list, o = {}) {
  const html = (S.categories || []).map(c => {
    // Under its topic's heading a line does not repeat the topic's icon (A-14).
    const l = list.filter(x => x.i.category === c.key).sort(byUrgency); if (!l.length && !o.folded) return '';
    o = { ...o, noIcon: true };
    const cnt = topicCount(l), head = `<span class="is-catic">${icon(c.icon || 'tag')}</span>`;
    if (o.folded) return `<details class="is-catf" data-cat="${esc(c.key)}"${o.open === c.key ? ' open' : ''}><summary>${head}
        <span class="is-catb"><span class="is-catn">${esc(c.name)}</span><span class="is-catm">${plural(l.length, 'issue')}${cnt.map(t => `<span class="is-catw"><span class="is-catd" aria-hidden="true"> · </span>${esc(t)}</span>`).join('')}</span></span>${icon('chevron-down', { cls: 'is-chev' })}</summary>
      ${l.length ? listHTML(l, o) : '<p class="le-none">No issues in it yet.</p>'}</details>`;
    return `<section class="ist-sec ist-topic" aria-labelledby="ist-t-${esc(c.key)}"><h2 class="ist-h ist-th" id="ist-t-${esc(c.key)}">${head}<span>${esc(c.name)}</span>${cnt.length ? `<span class="ist-tc">${esc(cnt.join(' · '))}</span>` : ''}</h2>${listHTML(l, o)}</section>`;
  }).join('');
  return o.folded ? `<div class="is-cats">${html}</div>` : html;
}
export function searchHTML(list, q, o = {}) {
  const f = searcher(q), hits = f ? list.map(x => ({ x, m: f(x) })).filter(y => y.m) : [];
  if (!hits.length) return `<p class="le-none">No issue matches “${esc(q.trim())}”. Try a bill number, a bill’s nickname or another word for it.</p>`;
  hits.sort((a, b) => a.m.score - b.m.score || byUrgency(a.x, b.x));
  return `<p class="ist-found" role="status">${plural(hits.length, 'issue')} ${hits.length === 1 ? 'matches' : 'match'}</p>
    <div class="ist-list">${hits.map(({ x, m }) => lineHTML(x, { ...o, why: m.why, tags: o.tagsOf ? o.tagsOf(x) : [] })).join('')}</div>`;
}
// The body for the view in force: a search shows its matches; else By deadline or By topic. Between sessions By deadline
// has nothing to sort, so it says so once and shows the topics.
export function bodyHTML(list, { q = '', ...o } = {}) {
  if (q.trim()) return searchHTML(list, q, o);
  if (currentView() === 'topic') return topicHTML(list, o);
  if (SESSION_OVER) return `<p class="ist-off">Between sessions there are no hearings or deadlines to sort by; the issues are by topic until the next session opens.</p>${topicHTML(list, o)}`;
  return deadlineHTML(list, o);
}
// The search box and the switch, side by side on a laptop, stacked on a phone.
export const toolsHTML = (q, id) => `<div class="ist-tools">
    <div class="le-search ist-find">${icon('search')}<input id="${id}" type="search" placeholder="Find an issue by any word or bill" value="${esc(q)}" autocomplete="off" aria-label="Find an issue by a word, a bill number or a bill’s nickname" aria-controls="${id}-body">${iconBtn('x', 'Clear the search', { 'data-istq': 'clear', hidden: !q })}</div>
    <div class="sv-seg ist-seg" role="group" aria-label="Sort the issues">${[['deadline', 'By deadline'], ['topic', 'By topic']].map(([v, l]) => `<button type="button" data-isview="${v}" aria-pressed="${currentView() === v}">${l}</button>`).join('')}</div>
  </div>`;
// Wires the box and the switch; `paint()` redraws only the body, so typing keeps the focus in the box.
export function wireTools(root, id, { get, set, paint }) {
  const q = root.querySelector('#' + id), x = root.querySelector('[data-istq="clear"]');
  if (q) q.oninput = () => { set(q.value); x.hidden = !q.value; paint(); };
  if (x) x.onclick = () => { set(''); q.value = ''; x.hidden = true; paint(); q.focus(); };
  root.querySelectorAll('[data-isview]').forEach(b => b.onclick = () => {
    setView(b.dataset.isview); root.querySelectorAll('[data-isview]').forEach(o => o.setAttribute('aria-pressed', String(o === b))); paint(); });
}
