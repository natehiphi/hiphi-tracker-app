// My issues' five views (R-336 walk 3, Nate 25 Oct, from twelve mockups drawn on the practice copy). His goal for an issue:
// "The goal is to get one of the bills through and having as many options as possible is key, but having at least one per
// chamber is ideal, no more than that is necessary. Being able to understand that along with what to do next in a quick
// glance is crucial." His picks:
//   Coverage (the default, mockup 5 with mockup 6's health check): three counts (alive in both chambers, in one, stopped),
//     then each issue with its one-sentence health check, its next step, and a House bills | Senate bills pair of cells
//     that say each alive bill's place and whether it is past the next Capitol deadline. "Deadlines are crucial. If an
//     issue has one bill that cleared the next deadline in the house but not the senate, that needs to be clear."
//   Deadlines (mockup 1): a column per upcoming Capitol deadline, the ones already behind us ticked on top.
//   Status (mockups 7 and 8 together): Needs you · On track · Stopped, each row saying Cleared, At risk or Not yet.
//   Topics (mockup 9): shelves by topic with big icons on soft tints and jump chips.
//   Spreadsheet (mockup 12): one row per issue, sortable headers, Copy for Google Sheets (as Bills' spreadsheet).
// The switch is remembered for the person (prefs.myIssuesView, with this browser's copy for a first paint), as Bills'
// Rows | Spreadsheet is (bills.js setMode).
//
// THE WORDS, defined once here (said on the page where they are used):
//   Started in the House / Senate  the chamber a bill STARTED in (HB or SB, and HCR / SCR), not where it is now: by mid-March
//                               every live bill has crossed over, so each bill also says where it is now ("now in Senate
//                               Education"), as the issue page does (one wording with it, the coordinator's note).
//   Alive in both chambers      a House bill and a Senate bill on HIPHI's side are still moving: two chances.
//   HIPHI's side                issuestand.js's rule: no Monitor and none HIPHI opposes (unless nothing else is on it).
//   The next deadline (D)       the soonest Capitol deadline any of the issue's bills on HIPHI's side is still racing
//                               (stops.js billStop's deadline; issuestand.js standOf's own `deadline`).
//   Past it / cleared           a bill racing a LATER deadline than D already cleared D (stops.js: a bill's deadline only
//                               moves on once it is through), and one on the Governor's desk or law is past every one.
//   Cleared                     an issue with a bill already past its next deadline: it survives that deadline whatever
//                               else happens.
//   At risk                     no bill on it is past its next deadline yet, and that deadline is 14 days away or less
//                               (model.js RADAR_DAYS, the "dying quietly" radar): if none clears it, the issue stops.
//   Not yet                     no bill past it yet, the deadline more than 14 days away.
//   Needs you                   a live issue with a step now: testimony on its leading hearing not yet filed and due (or
//                               the hearing) within 7 days; or At risk; or a bill that must get a hearing for a deadline
//                               14 days away or less while no bill of its chamber is past it (a split: someone has to ask
//                               the chair). On track: every other live issue, so On track is always Cleared or Not yet,
//                               never At risk. Stopped: no bill on HIPHI's side still moving, or no bill this session.
// Nothing here is amber or red: a step of the viewer's own that is late keeps its colour from steps.js (shownStatus), and
// "At risk" is a word and an icon (D3, A-5). Calm budgets (staff6_budget.py): names at 500, numbers at 500, labels 14px.
import { S, DB, DEMO, SESSION_YEAR, esc } from './data.js';
import { stopOf, hearingAhead, deadlineName, plainDeadlines, deadlineCalendar, gateApplies, gateName, whenAt, RADAR_DAYS } from './model.js';
import { icon, iconBtn, toast } from './ui.js';
import { plural } from './lists.js';
import { numWords, dayWords, committeeName, nw } from './steps.js';
import { hearPart, markOf, byUrgency, rowOf, searchHTML, FEW } from './issuestand.js';
import { ICONS } from '../icons.js';

const AGAINST = new Set(['strongly_oppose', 'oppose']);
const THROUGH = new Set(['governor', 'law', 'ballot']);
const CH = { H: 'House', S: 'Senate' };
const WEEK = 7 * 864e5;
const origin = b => /^S/.test(String(b.bill_number || '')) ? 'S' : 'H';
const num = b => numWords(b).replace(' ', ' ');
const names = l => l.length > 2 ? plural(l.length, 'bill') : l.map(num).join(' and ');
const endOf = date => new Date(date + 'T23:59:59-10:00').getTime();
const daysTo = date => Math.floor((endOf(date) - Date.now()) / 864e5);
const href = i => `#/issue/${encodeURIComponent(i.id)}?from=mine`;
const PLAIN = () => plainDeadlines();
// A deadline by name for owners and admins ("Second lateral"), by its day for someone who owns no bills (C-15 on v6).
const dn = D => PLAIN() ? `the ${dayWords(D.date)} deadline` : deadlineName(D);
// "Second lateral yet (Mon 3/30)": the day rides at the end, so the sentence reads straight on.
const dayTail = D => PLAIN() ? '' : ` (${dayWords(D.date)})`;

// ---- one issue, judged for these views ----
// x: issuestand.js standOf(i) with `own`. Returns what every view draws from, so they all say the same thing.
export function judge(x) {
  const { i, going = [], gone = [] } = x;
  let side = going.filter(b => b.position && b.position !== 'monitor' && !AGAINST.has(b.position));
  if (!side.length) side = going.filter(b => !AGAINST.has(b.position));
  const oppose = i.stance === 'oppose';
  if (oppose) side = going;
  const st = new Map(side.map(b => [b.id, stopOf(b)]));
  const dlOf = b => { const s = st.get(b.id); return s?.deadline && !s.deadline.missed ? s.deadline : null; };
  const D = (oppose ? x.next : x.deadline) || side.map(dlOf).filter(Boolean).sort((a, b) => a.date.localeCompare(b.date))[0] || null;
  const bills = side.map(b => { const s = st.get(b.id), d = dlOf(b);
    return { b, st: s, ch: origin(b), dl: d, past: D ? (d ? d.date > D.date : THROUGH.has(s.phase)) : THROUGH.has(s.phase) }; });
  const H = bills.filter(y => y.ch === 'H'), Sn = bills.filter(y => y.ch === 'S');
  const goneOf = c => gone.filter(b => origin(b) === c && b.tracked !== false);
  const alive = !['stopped', 'none', 'off'].includes(x.state) && bills.length > 0;
  const kind = !alive ? 'stopped' : oppose ? 'oppose' : H.length && Sn.length ? 'both' : 'one';
  const cleared = bills.filter(y => y.past);
  const dstate = !alive || oppose ? '' : !D ? (cleared.length ? 'cleared' : '') : cleared.length ? 'cleared' : daysTo(D.date) <= RADAR_DAYS ? 'risk' : 'notyet';
  // Bills that must still get a hearing for D, in a chamber with no bill past D yet: someone has to ask a chair.
  const chPast = c => bills.some(y => y.ch === c && y.past);
  const ask = !alive || oppose || !D ? [] : bills.filter(y => !y.past && y.dl?.date === D.date && y.st.column === 'a' && !hearingAhead(y.b) && !chPast(y.ch));
  const hp = hearPart(x);
  const open = hp && hp.s && !['filed', 'missed'].includes(hp.s.state?.key);
  // The testimony's own due time when it has one (a Monday hearing's testimony is due the day before), else the hearing.
  const soon = !!(x.hear && new Date(hp?.s?.due ?? x.hear.h.scheduled_at) - Date.now() <= WEEK);
  const needs = alive && !oppose && ((open && soon) || dstate === 'risk' || (ask.length > 0 && daysTo(D.date) <= RADAR_DAYS));
  const j = { x, i, own: x.own, D, bills, H, S: Sn, goneH: goneOf('H'), goneS: goneOf('S'), alive, kind, cleared, dstate, ask, hp, needs };
  j.health = healthOf(j); j.next = nextOf(j); j.dline = deadlineLine(j);
  return j;
}

// ---- the words ----
// The one-sentence health check (mockup 6), with the deadline in it: a split chamber reads as a split.
function healthOf(j) {
  const { kind, D, H, S: Sn, x } = j;
  if (kind === 'stopped') return { ic: 'circle-minus', text: markOf(x)?.text || 'Nothing moving this session' };
  if (kind === 'oppose') return { ic: 'circle-x', text: markOf(x)?.text || 'HIPHI opposes it: its bills are still moving' };
  const one = (c, l) => l.length === 1 ? `a ${CH[c]} bill is` : `${CH[c]} bills are`;
  if (kind === 'both') {
    if (!D) return { ic: 'circle-check', tone: 'done', text: 'Alive in both chambers: two chances' };
    const hc = H.some(y => y.past), sc = Sn.some(y => y.past);
    if (hc && sc) return { ic: 'circle-check', tone: 'done', text: `Past ${dn(D)} in both chambers` };
    if (hc || sc) { const [a, b] = hc ? ['H', 'S'] : ['S', 'H'], la = hc ? H : Sn, lb = hc ? Sn : H;
      return { ic: 'scale', text: `Split: ${la.length === 1 ? `the ${CH[a]} bill is` : `a ${CH[a]} bill is`} past ${dn(D)}, ${lb.length === 1 ? `the ${CH[b]} bill is` : `no ${CH[b]} bill is`} not yet` }; }
    return { ic: 'clock', text: `Two chances, neither past ${dn(D)} yet${dayTail(D)}` };
  }
  const c = H.length ? 'H' : 'S', l = H.length ? H : Sn;
  if (!D) return { ic: 'circle-dot', text: `Only ${one(c, l)} alive` };
  return l.some(y => y.past) ? { ic: 'circle-dot', text: `Only ${one(c, l)} alive, and ${l.length === 1 ? 'it is' : 'one is'} past ${dn(D)}` }
    : { ic: 'circle-dot', text: `Only ${one(c, l)} alive, not past ${dn(D)} yet${dayTail(D)}` };
}
// The next step: the testimony on the leading hearing in steps.js's words (issuestand.js hearPart), else the hearing a
// bill still needs, else nothing to do yet.
function nextOf(j) {
  const { hp, ask, D, kind, x } = j;
  if (kind === 'stopped') return null;
  if (hp) return { ic: hp.ic, html: hp.tone ? `<span class="i6-p1 t-${hp.tone}">${hp.html}</span>` : hp.html, text: hp.text, tone: hp.tone, you: !!(hp.you && (hp.soon || hp.late || hp.tone)) };
  if (ask.length) { const t = `Get ${names(ask.map(y => y.b))} a hearing by ${dayWords(D.date)}`; return { ic: 'calendar-plus', html: nw(esc(t)), text: t }; }
  if (kind === 'oppose') return null;
  const later = j.bills.map(y => y.dl).filter(d => d && (!D || d.date > D.date || j.dstate !== 'cleared')).sort((a, b) => a.date.localeCompare(b.date))[0] || D;
  const t = later ? `Nothing to do yet: next deadline ${dayWords(later.date)}` : 'Nothing to do yet';
  return { ic: 'eye', html: nw(esc(t)), text: t, quiet: true };
}
// Cleared / At risk / Not yet for the next deadline, with the reason (mockup 8).
function deadlineLine(j) {
  const { dstate, D, cleared, bills } = j;
  if (!dstate) return null;
  if (dstate === 'cleared') return { ic: 'circle-check', tone: 'done', word: 'Cleared', text: D ? `Cleared: ${names(cleared.map(y => y.b))} ${cleared.length === 1 ? 'is' : 'are'} past ${dn(D)}` : 'Cleared: through its committees' };
  const racing = bills.filter(y => y.dl?.date === D.date), set = racing.filter(y => y.st.hearingState === 'scheduled' || y.st.hearingState === 'held');
  const why = set.length ? `${names(set.map(y => y.b))} ${set.length === 1 ? 'has' : 'have'} a hearing` : racing.some(y => y.st.column === 'a') ? `${names(racing.filter(y => y.st.column === 'a').map(y => y.b))} ${racing.length === 1 ? 'needs' : 'need'} a hearing` : 'waiting for a floor vote';
  return dstate === 'risk' ? { ic: 'triangle-alert', word: 'At risk', text: `At risk: no bill past ${dn(D)} yet${dayTail(D)}; ${why}` }
    : { ic: 'clock', word: 'Not yet', text: `Not yet: no bill past ${dn(D)}${dayTail(D)}; ${why}` };
}
// Where a bill is now, in words (C-15: committees by name, never a code).
function whereNow(st) {
  if (st.phase === 'committee') return st.committee ? `now in ${committeeName(st.committee)}` : `waiting for a ${CH[st.chamber]} committee`;
  if (st.phase === 'floor') return `on the ${CH[st.chamber]} floor`;
  if (st.phase === 'conference') return 'in conference';
  if (st.phase === 'governor') return 'on the Governor’s desk';
  if (st.phase === 'law') return 'law';
  return '';
}
// A bill's state against the issue's next deadline: past it, or what it still needs by when.
function billState(y, D) {
  const { st } = y;
  if (st.phase === 'law') return { ic: 'circle-check', tone: 'done', text: 'Signed into law' };
  if (THROUGH.has(st.phase)) return { ic: 'circle-check', tone: 'done', text: 'Passed the Legislature' };
  if (D && y.past) return { ic: 'circle-check', tone: 'done', text: `Past ${dn(D)}` };
  const by = y.dl ? ` by ${dayWords(y.dl.date)}` : '';
  if (st.phase === 'committee') {
    if (st.hearingState === 'scheduled') return { ic: 'calendar-days', text: `Hearing ${whenAt(st.hearing.scheduled_at)}` };
    if (st.hearingState === 'held') return { ic: 'hourglass', text: 'Heard, waiting for the vote' };
    if (st.hearingState === 'decided') return { ic: 'circle-dot', text: /passed/.test(st.decided || '') ? 'Passed its committee' : 'Decided by its committee' };
    return { ic: 'clock', text: `Needs a hearing${by}` };
  }
  if (st.phase === 'floor') return { ic: 'clock', text: `Needs a floor vote${by}` };
  if (st.phase === 'conference') return { ic: 'clock', text: `House and Senate must agree${by}` };
  return { ic: 'circle-dot', text: st.says || '' };
}
const lineSpan = (p, cls = 'mi-ln') => p ? `<span class="${cls}${p.tone ? ' t-' + p.tone : ''}${p.quiet ? ' q' : ''}">${p.ic && ICONS[p.ic] ? icon(p.ic) : ''}<span>${p.html || nw(esc(p.text))}</span></span>` : '';
const tagsOf = j => [j.own ? '' : 'You help', j.next?.you ? 'Your step' : ''].filter(Boolean);
const tagHTML = j => tagsOf(j).map(t => `<span class="mi-tag">${esc(t)}</span>`).join('');
const catOf = i => (S.categories || []).find(c => c.key === i.category);
const topicIc = (i, cls = 'mi-tic') => { const c = catOf(i); return `<span class="${cls} mi-c-${esc(i.category || 'none')}" aria-hidden="true">${icon(c?.icon || 'tag')}</span>`; };

// ---- the switch (remembered for the person) ----
export const VIEWS = [['cover', 'Coverage', 'scale'], ['deadlines', 'Deadlines', 'flag'], ['status', 'Status', 'list-checks'], ['topics', 'Topics', 'tag'], ['sheet', 'Spreadsheet', 'table-2']];
const VKEY = () => `hiphi6_miview_${S.me?.id || ''}${DEMO ? '_demo' : ''}`;
export function viewNow() {
  const who = S.me?.id || '', st = (S.miView ??= {});
  if (st.for !== who) { let m = S.me?.prefs?.myIssuesView; if (!m) { try { m = localStorage.getItem(VKEY()); } catch { m = null; } }
    st.v = VIEWS.some(([k]) => k === m) ? m : 'cover'; st.for = who; }
  return st.v;
}
export function setViewNow(m) {
  viewNow(); const st = S.miView; if (st.v === m || !VIEWS.some(([k]) => k === m)) return;
  st.v = m;
  try { localStorage.setItem(VKEY(), m); } catch { /* this visit only */ }
  if (S.me) S.me.prefs = { ...(S.me.prefs || {}), myIssuesView: m };
  DB.patchPrefs?.({ myIssuesView: m })?.catch?.(() => { /* kept in this browser */ });
}
// The filter box (issuestand.js's, wired by its wireTools) and the switch: buttons from 768px, a select on a phone (one
// control in place of five). A short list (under 6 issues) needs no filter, but keeps the switch.
export function toolsHTML(q, count) {
  const v = viewNow(), filter = count >= FEW || q;
  const FI = ICONS['list-filter'] ? 'list-filter' : 'sliders-horizontal';
  return `<div class="i6-tools mi-tools${q ? ' open' : ''}" data-istools="mi-q">
    ${filter ? `${iconBtn(FI, 'Filter your issues', { 'data-istq': 'open', 'aria-expanded': String(!!q), 'aria-controls': 'mi-q-find' }, 'i6-findbtn')}
    <div class="i6-find" id="mi-q-find">${icon(FI)}<input id="mi-q" type="search" placeholder="Filter your issues" value="${esc(q)}" autocomplete="off" aria-label="Filter your issues: a word, a bill number or a bill’s nickname" aria-controls="mi-q-body">${iconBtn('x', 'Clear the filter', { 'data-istq': 'clear', hidden: !q })}</div>` : ''}
    <div class="sv-seg mi-seg" role="group" aria-label="Show your issues as">${VIEWS.map(([k, l, ic]) => `<button type="button" data-miview="${k}" aria-pressed="${v === k}">${icon(ic)}<span>${l}</span></button>`).join('')}</div>
    <label class="mi-sel"><span class="sr">Show your issues as</span><select data-misel aria-label="Show your issues as">${VIEWS.map(([k, l]) => `<option value="${k}"${v === k ? ' selected' : ''}>${l}</option>`).join('')}</select>${icon('chevron-down')}</label>
  </div>`;
}

// ---- the body for the view in force ----
export function bodyHTML(list, { q = '', opts = {} } = {}) {
  if (q.trim()) return searchHTML(list, q, opts);
  const js = list.map(judge);
  switch (viewNow()) {
    case 'deadlines': return deadlinesHTML(js);
    case 'status': return statusHTML(js, opts);
    case 'topics': return topicsHTML(js);
    case 'sheet': return sheetHTML(js);
    default: return coverHTML(js, opts);
  }
}
const sortUrgent = l => [...l].sort((a, b) => (a.needs ? 0 : 1) - (b.needs ? 0 : 1) || byUrgency(a.x, b.x));
const stoppedFold = (l, opts, title = 'Stopped') => l.length ? `<details class="i6-fold mi-stopped" data-fold="mi-stopped"><summary>${icon('chevron-down', { cls: 'i6-chev' })}<span>${esc(title)} (${l.length})</span></summary>
  <div class="v6-list i6-list" role="list">${l.map(j => rowOf(j.x, { from: 'mine', tags: opts.tagsOf ? opts.tagsOf(j.x) : [] })).join('')}</div></details>` : '';
export const counts = js => ({ both: js.filter(j => j.kind === 'both').length, one: js.filter(j => j.kind === 'one').length, stopped: js.filter(j => j.kind === 'stopped').length,
  none: js.filter(j => j.kind === 'stopped' && j.x.state === 'none').length, oppose: js.filter(j => j.kind === 'oppose').length });

// ---- Coverage (the default) ----
function cellHTML(j, c) {
  const l = c === 'H' ? j.H : j.S, g = c === 'H' ? j.goneH : j.goneS;
  // "Started in the House" (the issue page's words, the coordinator's fresh-eyes note: "House bills" read as where a bill is
  // now); a phone says "From the House".
  const head = `<span class="mi-chh"><span class="mi-chl">Started in the ${CH[c]}</span><span class="mi-chs" aria-hidden="true">From the ${CH[c]}</span></span>`;
  if (!l.length) return `<div class="mi-cell off">${head}<span class="mi-cl q">${icon('circle-dashed')}<span>${g.length ? `No bill that started in the ${CH[c]} is still alive (${g.length} stopped)` : `No bill started in the ${CH[c]} in ${SESSION_YEAR}`}</span></span></div>`;
  const shown = l.slice(0, 2), more = l.length - shown.length;
  return `<div class="mi-cell${l.some(y => y.past) ? ' ok' : ''}">${head}${shown.map(y => { const s = billState(y, j.D), w = whereNow(y.st);
    return `<span class="mi-cb"><span class="mi-cn">${esc(num(y.b))}${w ? ` <span class="mi-cw">· ${esc(w)}</span>` : ''}</span>${lineSpan(s, 'mi-cl')}</span>`; }).join('')}${more ? `<span class="mi-cmore">and ${plural(more, 'more bill')}</span>` : ''}</div>`;
}
function covItem(j) {
  return `<a class="mi-cov" href="${href(j.i)}" data-mirow="${esc(j.i.id)}">${topicIc(j.i)}
    <span class="mi-cvt"><span class="mi-name">${esc(j.i.name)}${tagHTML(j)}</span>${lineSpan(j.health)}${lineSpan(j.next)}</span>
    <span class="mi-cells">${cellHTML(j, 'H')}${cellHTML(j, 'S')}</span></a>`;
}
function coverHTML(js, opts) {
  const n = counts(js), both = sortUrgent(js.filter(j => j.kind === 'both')), one = sortUrgent(js.filter(j => j.kind === 'one'));
  const opp = sortUrgent(js.filter(j => j.kind === 'oppose')), stop = js.filter(j => j.kind === 'stopped').sort((a, b) => a.i.name.localeCompare(b.i.name));
  const tile = (mark, k, words) => `<p class="mi-tile">${mark}<span class="mi-tn">${k}</span><span class="mi-tw">${words}</span></p>`;
  const grp = (id, t, sub, l) => l.length ? `<section class="i6-sec mi-grp" aria-labelledby="mi-g-${id}"><h2 class="i6-h" id="mi-g-${id}">${esc(t)}</h2><p class="mi-sub">${esc(sub)}</p>
    <div class="mi-card">${l.map(covItem).join('')}</div></section>` : '';
  return `<div class="mi-tiles" role="group" aria-label="Your issues at a glance">
      ${tile(`<span class="mi-dot full">${icon('check')}</span>`, n.both, 'alive in both chambers')}
      ${tile('<span class="mi-dot half"></span>', n.one, 'alive in one chamber')}
      ${tile('<span class="mi-dot none"></span>', n.stopped, n.none ? 'stopped or no bill yet' : 'stopped this session')}
    </div>
    ${grp('both', 'Both chambers', 'A bill that started in the House and one that started in the Senate are still alive: two chances.', both)}
    ${grp('one', 'One chamber', 'Only bills that started in one chamber are still alive: one chance left.', one)}
    ${grp('opp', 'HIPHI opposes', 'Here HIPHI wants the bills to stop.', opp)}
    ${!both.length && !one.length && !opp.length ? `<p class="i6-quiet">None of your issues has a bill moving now.</p>` : ''}
    ${stoppedFold(stop, opts)}`;
}

// ---- Deadlines (the board) ----
const MAIN = new Set(['first_lateral', 'first_decking', 'first_crossover', 'second_lateral', 'second_decking', 'second_crossover']);
function boardOf(js) {
  const live = js.filter(j => j.alive), bills = live.flatMap(j => j.bills.map(y => y.b)), now = Date.now();
  const cal = deadlineCalendar().filter(g => gateApplies(g, bills) && !['introduced', 'governor'].includes(g.phase));
  const nameOf = g => gateName(g), seen = new Set(), past = [];
  for (const g of cal.filter(g => endOf(g.date) < now)) { const n = nameOf(g); if (!seen.has(n)) { seen.add(n); past.push({ name: n, date: g.date }); } }
  const cols = [], byDate = new Map();
  for (const g of cal.filter(g => endOf(g.date) >= now)) {
    if (byDate.has(g.date)) continue;
    const l = live.filter(j => j.D?.date === g.date), main = MAIN.has(g.phase) || (g.phase === 'conference' && /final/i.test(g.label));
    if (!l.length && !main) continue;
    const col = { name: nameOf(g), date: g.date, label: g.label, l: sortUrgent(l) }; byDate.set(g.date, col); cols.push(col);
  }
  const rest = live.filter(j => !j.D || !byDate.has(j.D.date));
  if (rest.length) cols.push({ name: 'No committee deadline ahead', date: null, l: sortUrgent(rest) });
  return { past, cols, live };
}
function boardCard(j, col) {
  const others = col.date ? j.bills.filter(y => y.past) : [];
  const racing = col.date ? j.bills.filter(y => y.dl?.date === col.date) : j.bills;
  const facts = [racing.length ? `${names(racing.map(y => y.b))} ${racing.length === 1 ? 'races' : 'race'} it` : '', others.length ? `${names(others.map(y => y.b))} already past it` : ''].filter(Boolean).join('; ');
  return `<a class="mi-bc" href="${href(j.i)}" data-mirow="${esc(j.i.id)}">${topicIc(j.i, 'mi-tic sm')}<span class="mi-bct"><span class="mi-name">${esc(j.i.name)}${tagHTML(j)}</span>
    ${others.length ? lineSpan({ ic: 'circle-check', tone: 'done', text: `Cleared: ${names(others.map(y => y.b))} already past it` }) : j.next?.quiet || !j.next ? lineSpan({ ic: 'circle-dot', text: facts || j.health.text }) : ''}${lineSpan(j.next)}</span></a>`;
}
function deadlinesHTML(js) {
  const { past, cols, live } = boardOf(js), stopped = js.length - live.length;
  const first = cols.find(c => c.date);
  return `<div class="mi-past">${past.length ? `<span class="mi-pastl">Behind us</span>${past.map(p => `<span class="mi-pastd">${icon('circle-check')}${esc(p.name)} <span class="mi-q">${esc(dayWords(p.date))}</span></span>`).join('')}` : ''}
      <span class="mi-pasts">${esc(`${live.length} of ${plural(js.length, 'issue')} still alive`)}${stopped ? `, ${stopped} stopped` : ''}</span></div>
    ${cols.length > 1 ? `<div class="mi-btabs" role="group" aria-label="Go to a deadline">${cols.map((c, k) => `<button type="button" data-micol="${k}" aria-pressed="${k === 0}">${esc(c.name)} <span class="mi-q">${c.l.length}</span></button>`).join('')}</div>` : ''}
    <div class="mi-board" data-miboard>${cols.map((c, k) => `<section class="mi-col" data-colk="${k}" aria-labelledby="mi-col-${k}"><h2 class="mi-colh" id="mi-col-${k}">${esc(c.name)}${c === first ? '<span class="mi-next">Next</span>' : ''}</h2>
      <p class="mi-cols">${c.date ? esc(`${dayWords(c.date)} · in ${plural(Math.max(0, daysTo(c.date)), 'day')} · ${plural(c.l.length, 'issue')}`) : esc(plural(c.l.length, 'issue'))}</p>
      ${c.l.length ? c.l.map(j => boardCard(j, c)).join('') : '<p class="mi-empty">No issue waits on this deadline yet. Issues move here as their bills clear the ones before.</p>'}</section>`).join('')}</div>`;
}

// ---- Status: Needs you · On track · Stopped, each with Cleared / At risk / Not yet ----
function statusRow(j) {
  return `<div class="v6-row i6-row mi-srow" role="listitem" data-v6row="${esc(j.i.id)}"><a class="v6-row-main" href="${href(j.i)}"><span class="v6-row-top"><span class="v6-row-name">${esc(j.i.name)}</span>${tagsOf(j).length ? ` <span class="v6-row-num">${esc(tagsOf(j).join(', '))}</span>` : ''}</span>
    ${lineSpan(j.next || j.health, 'v6-row-line')}${j.dline ? lineSpan(j.dline, 'v6-row-line mi-dl') : ''}</a></div>`;
}
function statusHTML(js, opts) {
  const need = sortUrgent(js.filter(j => j.needs)), ok = sortUrgent(js.filter(j => j.alive && !j.needs)), stop = js.filter(j => !j.alive).sort((a, b) => a.i.name.localeCompare(b.i.name));
  const sec = (id, t, sub, l, empty) => `<section class="i6-sec mi-ssec" aria-labelledby="mi-s-${id}"><h2 class="i6-h" id="mi-s-${id}">${esc(t)}</h2><p class="mi-sub">${esc(sub)}</p>
    ${l.length ? `<div class="v6-list i6-list" role="list">${l.map(statusRow).join('')}</div>` : `<p class="i6-quiet">${esc(empty)}</p>`}</section>`;
  return `<p class="mi-def">Cleared: a bill on it is already past its next deadline. At risk: none is yet, and the deadline is two weeks away or less. Not yet: none is, with more time.</p>
    <div class="mi-status">
      ${sec('need', 'Needs you', `${plural(need.length, 'issue')}: testimony this week, at risk, or a chamber still to clear its deadline`, need, 'Nothing on your issues needs you this week.')}
      <div class="mi-sside">${sec('ok', 'On track', `${plural(ok.length, 'issue')}: cleared, or the deadline more than two weeks away`, ok, 'No other issue is moving.')}
      ${stop.length ? `<section class="i6-sec mi-ssec"><h2 class="i6-h">Stopped</h2><p class="mi-sub">${esc(plural(stop.length, 'issue'))}: nothing moving this session</p>${stoppedFold(stop, opts, 'Show them')}</section>` : ''}</div>
    </div>`;
}

// ---- Topics: shelves with big icons on soft tints ----
function topicsHTML(js) {
  const cats = (S.categories || []).map(c => ({ c, l: js.filter(j => j.i.category === c.key) })).filter(g => g.l.length);
  const other = js.filter(j => !cats.some(g => g.c.key === j.i.category));
  if (other.length) cats.push({ c: { key: 'none', name: 'Other', icon: 'tag' }, l: other });
  const badge = j => j.kind === 'both' ? `<span class="mi-badge ok">${icon('circle-check')}Both chambers</span>` : j.kind === 'one' ? `<span class="mi-badge">${icon('circle-dot')}One chamber</span>`
    : j.kind === 'oppose' ? `<span class="mi-badge">${icon('circle-x')}HIPHI opposes</span>` : `<span class="mi-badge">${icon('circle-minus')}Stopped</span>`;
  const card = j => `<a class="mi-tcard${j.alive ? '' : ' off'}" href="${href(j.i)}" data-mirow="${esc(j.i.id)}"><span class="mi-tart mi-c-${esc(j.i.category || 'none')}">${badge(j)}${icon(catOf(j.i)?.icon || 'tag')}</span>
    <span class="mi-tbody"><span class="mi-name">${esc(j.i.name)}${tagHTML(j)}</span>${lineSpan(j.alive ? j.next || j.health : j.health)}</span></a>`;
  return `${cats.length > 1 ? `<div class="mi-jump" role="group" aria-label="Jump to a topic">${cats.map(g => `<button type="button" data-mijump="${esc(g.c.key)}"><span class="mi-jic mi-c-${esc(g.c.key)}" aria-hidden="true">${icon(g.c.icon || 'tag')}</span>${esc(g.c.name)} <span class="mi-q">${g.l.length}</span></button>`).join('')}</div>` : ''}
    ${cats.map(g => { const live = g.l.filter(j => j.alive).length, l = [...g.l].sort((a, b) => (a.alive ? 0 : 1) - (b.alive ? 0 : 1) || byUrgency(a.x, b.x));
      return `<section class="i6-sec mi-shelf" id="mi-t-${esc(g.c.key)}" aria-labelledby="mi-th-${esc(g.c.key)}"><div class="mi-shead"><span class="mi-sic mi-c-${esc(g.c.key)}" aria-hidden="true">${icon(g.c.icon || 'tag')}</span>
        <div><h2 class="i6-h" id="mi-th-${esc(g.c.key)}">${esc(g.c.name)}</h2><p class="mi-sub">${esc(`${plural(g.l.length, 'issue')} · ${live} still alive`)}</p></div></div>
        <div class="mi-tgrid">${l.map(card).join('')}</div></section>`; }).join('')}`;
}

// ---- Spreadsheet: one row per issue, sortable, Copy for Google Sheets ----
const ownerName = i => i.owner_id && i.owner_id === S.me?.id ? 'You' : (S.advocates || []).find(a => a.id === i.owner_id)?.full_name || 'No owner yet';
const DSTATE = { cleared: 'Cleared', risk: 'At risk', notyet: 'Not yet' };
const COLS = [
  ['issue', 'Issue', j => j.i.name],
  ['house', 'Alive, started in the House', j => j.H.length ? j.H.map(y => numWords(y.b)).join(', ') : `none${j.goneH.length ? ` · ${j.goneH.length} stopped` : ''}`],
  ['senate', 'Alive, started in the Senate', j => j.S.length ? j.S.map(y => numWords(y.b)).join(', ') : `none${j.goneS.length ? ` · ${j.goneS.length} stopped` : ''}`],
  ['deadline', 'Next deadline', j => j.D && j.alive ? `${dayWords(j.D.date)} ${PLAIN() ? '' : deadlineName(j.D)}`.trim() : ''],
  ['state', 'Cleared?', j => j.alive ? (j.kind === 'oppose' ? 'HIPHI opposes' : DSTATE[j.dstate] || '') : 'Stopped'],
  ['next', 'Next step', j => j.next?.text || j.health.text],
  ['owner', 'Owner', j => ownerName(j.i)],
];
const SORTV = { deadline: j => j.D && j.alive ? j.D.date : '9', state: j => ({ risk: 0, notyet: 1, cleared: 2 })[j.dstate] ?? 3 };
function sorted(js) {
  const s = S.miSort; if (!s) return [...js].sort((a, b) => (a.alive ? 0 : 1) - (b.alive ? 0 : 1) || (a.needs ? 0 : 1) - (b.needs ? 0 : 1) || byUrgency(a.x, b.x));
  const c = COLS.find(x => x[0] === s[0]), val = SORTV[s[0]] || c[2];
  return [...js].sort((a, b) => String(val(a)).localeCompare(String(val(b)), 'en', { numeric: true }) * s[1] || a.i.name.localeCompare(b.i.name));
}
// Lucide's arrow-up-down, as Bills' spreadsheet draws it (bills.js UPDOWN), so icons.js stays as it is.
const UPDOWN = '<svg class="ic ic-arrow-up-down" width="1.25em" height="1.25em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="m21 16-4 4-4-4"/><path d="M17 20V4"/><path d="m3 8 4-4 4 4"/><path d="M7 4v16"/></svg>';
let LAST = [];
function sheetHTML(js) {
  const s = S.miSort, rows = sorted(js); LAST = rows;
  const cell = (k, j) => {
    if (k === 'issue') return `<a class="mi-tlink" href="${href(j.i)}" data-mirow="${esc(j.i.id)}">${esc(j.i.name)}</a>${tagsOf(j).length ? `<span class="mi-q mi-ttag">${esc(tagsOf(j).join(', '))}</span>` : ''}`;
    if (k === 'state') { const t = COLS[4][2](j), ic = { Cleared: 'circle-check', 'At risk': 'triangle-alert', 'Not yet': 'clock', Stopped: 'circle-minus', 'HIPHI opposes': 'circle-x' }[t];
      return t ? `<span class="mi-st${t === 'Cleared' ? ' t-done' : ''}">${ic ? icon(ic) : ''}${esc(t)}</span>` : ''; }
    if (k === 'next') return j.next ? `<span class="mi-tnext">${j.next.html}</span>` : esc(j.health.text);
    if (k === 'deadline') return j.D && j.alive ? `${esc(dayWords(j.D.date))}${PLAIN() ? '' : `<span class="mi-q mi-tsub">${esc(deadlineName(j.D))}</span>`}` : '';
    const col = COLS.find(x => x[0] === k); return esc(col[2](j));
  };
  return `<div class="mi-sheetbar"><p class="mi-sub">${esc(plural(rows.length, 'issue'))}. Press a heading to sort.</p><button type="button" class="btn text sm mi-copy" data-micopy>${icon('copy')}<span>Copy for Google Sheets</span></button></div>
    <div class="mi-tblbox"><table class="mi-tbl"><caption class="sr">Your issues, one row each</caption><thead><tr>${COLS.map(([k, l]) => { const on = s && s[0] === k;
      return `<th scope="col" class="mi-th-${k}" aria-sort="${on ? (s[1] > 0 ? 'ascending' : 'descending') : 'none'}"><button type="button" class="mi-sort${on ? ' on' : ''}" data-misort="${k}"><span>${esc(l)}</span>${on ? icon(s[1] > 0 ? 'move-up' : 'move-down') : UPDOWN}</button></th>`; }).join('')}</tr></thead>
    <tbody>${rows.map(j => `<tr class="${j.alive ? '' : 'off'}">${COLS.map(([k]) => k === 'issue' ? `<th scope="row" class="mi-td-issue">${cell(k, j)}</th>` : `<td class="mi-td-${k}">${cell(k, j)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
export function sheetText(rows = LAST) {
  const clean = t => String(t ?? '').replace(/[\t\r\n]+/g, ' ').replace(/ /g, ' ').trim();
  return [COLS.map(c => c[1]), ...rows.map(j => COLS.map(c => clean(c[2](j))))].map(r => r.join('\t')).join('\n');
}
async function copySheet() {
  const n = LAST.length; if (!n) return toast('No issues are shown, so there is nothing to copy.');
  const text = sheetText(); let ok = false;
  try { await navigator.clipboard.writeText(text); ok = true; } catch { /* below: the older way */ }
  if (!ok) { const t = document.createElement('textarea'); t.value = text; t.setAttribute('readonly', ''); t.style.cssText = 'position:fixed;left:-9999px;top:0';
    document.body.appendChild(t); t.select(); try { ok = document.execCommand('copy'); } catch { ok = false; } t.remove(); }
  toast(ok ? `Copied ${plural(n, 'issue')}. Paste into Google Sheets or Excel.` : 'This browser would not copy. Select the table and copy it by hand.', ok ? { ok: true } : { err: true });
}

// ---- wiring: everything inside the body is wired again after each paint ----
export function wireBody(root, { paint }) {
  const body = root.querySelector('#mi-q-body'); if (!body) return;
  body.querySelectorAll('[data-misort]').forEach(b => b.onclick = () => { const k = b.dataset.misort, s = S.miSort;
    S.miSort = s && s[0] === k ? (s[1] > 0 ? [k, -1] : null) : [k, 1]; paint(); root.querySelector(`[data-misort="${k}"]`)?.focus(); });
  body.querySelector('[data-micopy]')?.addEventListener('click', copySheet);
  body.querySelectorAll('[data-mijump]').forEach(b => b.onclick = () => { const t = body.querySelector(`#mi-t-${CSS.escape(b.dataset.mijump)}`);
    if (t) { t.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); t.querySelector('h2')?.setAttribute('tabindex', '-1'); t.querySelector('h2')?.focus({ preventScroll: true }); } });
  // The board: the tabs scroll to their column; scrolling the board marks the column in view (a phone's swipe).
  const board = body.querySelector('[data-miboard]'), tabs = [...body.querySelectorAll('[data-micol]')];
  if (board && tabs.length) {
    const mark = k => tabs.forEach(t => t.setAttribute('aria-pressed', String(+t.dataset.micol === k)));
    tabs.forEach(t => t.onclick = () => { const col = board.querySelector(`[data-colk="${t.dataset.micol}"]`); if (!col) return;
      board.scrollTo({ left: col.offsetLeft - board.offsetLeft, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); mark(+t.dataset.micol); });
    let tick = 0; board.addEventListener('scroll', () => { cancelAnimationFrame(tick); tick = requestAnimationFrame(() => {
      const cols = [...board.querySelectorAll('[data-colk]')], x = board.scrollLeft + board.offsetLeft;
      const k = cols.reduce((best, c) => Math.abs(c.offsetLeft - x) < Math.abs(best.offsetLeft - x) ? c : best, cols[0]); if (k) mark(+k.dataset.colk); }); }, { passive: true });
  }
}
export function wireSwitch(root, { paint }) {
  const pick = v => { setViewNow(v); root.querySelectorAll('[data-miview]').forEach(o => o.setAttribute('aria-pressed', String(o.dataset.miview === v)));
    const sel = root.querySelector('[data-misel]'); if (sel) sel.value = v; paint(); };
  root.querySelectorAll('[data-miview]').forEach(b => b.onclick = () => pick(b.dataset.miview));
  const sel = root.querySelector('[data-misel]'); if (sel) sel.onchange = () => pick(sel.value);
}
// Back from an issue opened here puts the focus on the item it was opened from (rule 10), on any view.
export function restoreMine(root, recent) {
  const id = S.i6Back; if (!id) return false;
  const a = root.querySelector(`[data-mirow="${CSS.escape(id)}"]`); if (!a) return false;
  S.i6Back = null;
  setTimeout(() => { if (!recent()) return; a.focus({ preventScroll: true }); const r = a.getBoundingClientRect(); if (r.top < 0 || r.bottom > innerHeight) a.scrollIntoView({ block: 'center' }); }, 30);
  return true;
}
