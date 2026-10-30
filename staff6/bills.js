// Staff v6 · Bills (#/bills, #/bills/muted): R-336 spec section 6, V04, V05, V17, V32, D9, D15, D16.
// v5's Bills put 90 controls and 42 Capitol codes on Kris's first laptop screen (assessment X4, X28), a second search box
// 70px under the header's (A-14), three quick pills, a "…" that mixed table tools with places (X6), and on Kris's phone 6.8
// screens of rows. v6 keeps every job and shows less at once (Nate, 22 Oct: "too much per screen"):
//   - the place head: "Bills" with one whose switch at its right, Mine | My coalitions | Team (owners open on Mine, people
//     who own none on My coalitions, people with nothing in Mine and no coalition on Team), and the page tabs under it
//     (Bills · Sort new bills · Muted, billshead.js);
//   - over the whole list only, one line about the bills still to ask for a hearing ("20 to ask · first by Mon 3/23 · Bills
//     That Need Hearings ›", Today's and Hearings' words; leadLine below);
//   - the list's toolbar: one box that filters this list ("Filter these bills", V32; the header's box searches everything),
//     the one Filter sheet (filters.js: 4 groups, More filters, presets in place of the quick pills, saved views), a visible
//     Select (bulk.js; on a phone at the right of the first group's heading), and Rows | Spreadsheet (D9: anyone may pick
//     the spreadsheet; it is remembered for the person). The spreadsheet adds Columns, Export and Copy for Google Sheets on a
//     line of their own (F88, F92; R-336);
//   - the rows (default): two-line rows (steps.js billRow: the name, the bill number small, one plain line, D15), each its
//     own soft card led by its issue's tile (R-352 D, A-18: it tells bills on different issues apart); no bar or job tile; no
//     step buttons, spec 11 settled 1) grouped by where they stand, with Monitoring and Did not advance folded and the
//     viewer's own steps never behind "Show all", and the picked bill open beside the list (steps.js listDetail +
//     billpane.js openItem, V17): from 1100px the panel waits beside the list ("Pick a bill to see its next step");
//     below 1100px the bill is its own page with Back to the list.
// The spreadsheet is v5's table (sorting, columns, select with shift-click, the docked bill) with Capitol codes turned into
// words where it can, the bill number kept (D15); R-336 (Nate 25 Oct) made every column sort, a team cell (position, owner,
// nickname) a button that opens its picker with Undo (no Edit mode), added Priority and Nickname, and Copy for Google Sheets. Keys on a laptop (F96): j/k walk the rows, Space or o opens
// the bill beside the list, Enter opens its page, x selects, Esc closes, "/" puts the cursor in the filter box (app.js).
import { S, DB, DEMO, esc, fmtDate, effStage, isOwner, myIssuesOf, daysAgo, STAGES, STAGE_LABEL, hooks, seesTeam } from './data.js';
import { factsOf, stopOf, whyDead, billNum, gateNeed, billSay, deadlineName, billRoute, billRef, whenAt, lateLine } from './model.js';
import { HELD_RE, stoppedAt } from '../stops.js';
import { icon, btn, iconBtn, empty, toast, menuSheet, pickerSheet, openSheet, closeSheet, switchRow, avatar, ownerOf, keysOn, keysUsed, POS_WORD, posIcons, whoseSeg, showAllBtn, filterBtn } from './ui.js';
import { bl, save, setCompact, shownBills, freshFacts, isOn, toggle, clearAll, changed, activeFilters, openFilters, placePop, wideNow, hoverNow, typingIn,
  views, curView, viewName, openEditViews, scopeOpts, posWord, openCoalition, viewState } from './filters.js';
import { openLook } from './look.js';
import { bulkBar, wireBulkBar, startSelect, stopSelect, dropSelect, selIds, FIELD } from './bulk.js';
import { offTag, teamName, teamFirst, newOwnerTag, FACTS } from './model.js';   // R-316 W28: a turned-off owner says so
import { GROUPS, groupKey, stanceMark } from './standing.js';
import { billStep, billRow, listDetail, nameWords, numWords, dayWords, committeeName, whereWords, deadlineWords, nw, wireSteps } from './steps.js';
import { openItem, closeBtn, aboutBill } from './billpane.js';
import { billsHead, loadSortCount, refreshTabs } from './billshead.js';
import { issuesOfBill } from './issues.js';
import { issueLead } from './issuestand.js';   // R-352 D: each row's issue tile

// ---- groups, in stage order: GROUPS and groupKey live in standing.js, shared with an issue's page (R-226) ----
const FOLDED = new Set(['mon', 'dead']);
// One word per fact (spec rule 6, A-14): the state is "No hearing yet" in the group, the Filter sheet, its chip and the
// deadline line alike; standing.js GROUPS says it too, so an issue's page matches (kept here as the one override point).
const TITLE = { wait: 'No hearing yet' };
// Rows an open group shows before "Show all N": a phone keeps each group to a glance (Kris's phone Bills was 6.8 screens
// in v5), a laptop's roomy rows to eight (roomy must not mean longer, V16), the dense table to v5's 25 (R-277 fix 11).
const foldAt = () => tableOn() ? 25 : wideNow() ? 8 : 5;
const moreRows = g => g.open && g.hides > 0 ? showAllBtn(g.all, { 'data-full': g.k }, { open: !!bl().full?.[g.k], what: 'bills' }) : '';
const ST = new Map();   // stopOf per render: it filters every hearing, so each bill is worked out once
const stOf = b => { let s = ST.get(b.id); if (!s) ST.set(b.id, s = stopOf(b)); return s; };
const STEP = new Map();   // billStep per render, for the same reason
const stepOf = b => { let s = STEP.get(b.id); if (!s) STEP.set(b.id, s = billStep(b, { viewer: S.me })); return s; };
// The viewer has something to do on it: their own step with a time to act (a chair ask still waiting on a reply is not).
const ownStep = b => { const s = stepOf(b); return !!s?.you && s.kind !== 'filed' && s.act?.kind !== 'none'; };
const byNum = (a, b) => a.bill_number.localeCompare(b.bill_number, 'en', { numeric: true });
const byPri = (a, b) => (a.priority || 9) - (b.priority || 9);
const hearAt = b => stOf(b).hearing?.scheduled_at || '9';
const dlDays = b => stOf(b).deadline?.days ?? 999;
const NATURAL = {
  hear: (a, b) => hearAt(a).localeCompare(hearAt(b)) || byPri(a, b) || byNum(a, b),
  risk: (a, b) => dlDays(a) - dlDays(b) || byPri(a, b) || byNum(a, b),
  wait: (a, b) => byPri(a, b) || dlDays(a) - dlDays(b) || byNum(a, b),
  thru: (a, b) => byPri(a, b) || String(b.last_action_date || '').localeCompare(String(a.last_action_date || '')) || byNum(a, b),
  done: (a, b) => byPri(a, b) || byNum(a, b), mon: byNum, dead: (a, b) => byPri(a, b) || byNum(a, b),
};
// The table's column sorts, inside each group (dead bills stay at the bottom because their group does).
const STAGE_ORDER = Object.fromEntries(STAGES.map(([k], i) => [k, i]));
const POS_ORDER = ['strongly_support', 'support', 'support_amend', 'neutral', 'oppose', 'strongly_oppose', 'monitor'];
// The Next column sorts by the step's one time to act (steps.js actBy), else the hearing, else the deadline it races.
const nextKey = b => { const s = stepOf(b), st = stOf(b), t = s?.act?.at ?? s?.due;
  return t != null ? new Date(t).toISOString() : st.hearing?.scheduled_at || (st.deadline && !st.deadline.missed ? st.deadline.date : '9'); };
// Every column sorts by its header (R-336, Nate: "scan and sort everything"); an empty cell sorts last ('~').
const lower = t => String(t || '').toLowerCase() || '~';
const SORTS = { num: null, stage: b => STAGE_ORDER[effStage(b)] ?? 99, next: nextKey, pos: b => POS_ORDER.indexOf(b.position || 'monitor'),
  own: b => ownerOf(b)?.full_name || '~', last: b => b.last_action_date || '', pulse: b => S.pulse[b.id]?.last_team_touch || '',
  title: b => lower(b.nickname || summaryOf(b)), pri: b => b.priority || 9, nick: b => lower(b.nickname),
  cmte: b => lower((b.referrals || []).map(x => committeeName(x)).join(', ')), coal: b => lower(coalNames(b)) };
function sorter() {
  const s = bl().sort; if (!s || !tableOn()) return null;
  const [k, dir] = s, f = SORTS[k];
  if (k === 'own' && bl().scope === 'me') return null;   // Mine has no Owner column to sort by (or to turn the sort off)
  return (a, b) => { if (!f) return byNum(a, b) * dir; const x = f(a), y = f(b); return (x > y ? 1 : x < y ? -1 : 0) * dir || byNum(a, b); };
}
let NAV = [];   // the bills in the order shown, for the bill page's Previous and Next and the j/k keys
// A cell edit in the spreadsheet (R-106, R-336): after it every row keeps its group and its place, so a bill just changed
// does not jump away and leave another bill under the pointer (P-3). Each spreadsheet draw keeps the order it showed; an
// edit (v.edited) holds that order. A new sort, filter, search or scope is a new order, and so is Rows, or coming back to Bills.
const freezeKey = () => { const v = bl(); return JSON.stringify([viewState(), v.q.trim(), v.sort]); };
function build() {
  freshFacts(); ST.clear(); STEP.clear();
  const v = bl(), list = shownBills(), by = Object.fromEntries(GROUPS.map(([k]) => [k, []]));
  const hold = tableOn(), fk = hold ? freezeKey() : null;
  if (v.edited && (!hold || v.frozen?.key !== fk)) v.edited = false;
  const fz = v.edited ? v.frozen : null;
  if (fz) { const have = new Set(list.map(b => b.id)); for (const id of fz.order) if (!have.has(id)) { const b = S.bills.find(x => x.id === id); if (b) list.push(b); } }
  for (const b of list) by[fz?.group.get(b.id) || groupKey(b)].push(b);
  const srt = sorter(), at = b => fz.pos.get(b.id) ?? 1e9;
  // A sort in the spreadsheet is one list (critic, R-336): sorting inside each group read as no sort at all. "Where it stands"
  // still says each bill's place; stopping the sort (the heading's third click) brings the groups back.
  const groups = srt ? [{ k: 'all', title: 'Every bill', flat: true, rows: (fz ? list.slice().sort((a, b) => at(a) - at(b)) : list.slice().sort(srt)) }].filter(g => g.rows.length)
    : GROUPS.map(([k, title]) => ({ k, title: TITLE[k] || title, rows: by[k].sort(fz ? (a, b) => at(a) - at(b) : NATURAL[k]) })).filter(g => g.rows.length);
  if (hold && !fz) { const order = groups.flatMap(g => g.rows.map(b => b.id));
    v.frozen = { key: fk, order, group: new Map(groups.flatMap(g => g.rows.map(b => [b.id, g.k]))), pos: new Map(order.map((id, i) => [id, i])) }; }
  if (!hold) v.frozen = null;
  // Monitoring and Did not advance start folded only in the plain list: once a search or a filter asks for something,
  // every bill it found is on screen.
  const asked = !!v.q.trim() || activeFilters().length > 0, only = groups.length === 1;
  for (const g of groups) g.open = g.flat || (v.folds[g.k] ?? (asked || only || !FOLDED.has(g.k)));
  const cap = foldAt();
  // Nothing a person must do waits behind "Show all" (spec 7 rule 3): the viewer's own steps always show, in their place,
  // and only the other rows count toward the fold.
  // A fold that would hide 3 bills or fewer is no fold (Nate's walk: "No hearing yet" showed 19 of 20 and then "Show all
  // 20 bills" for one): the whole group shows, with no Show all (P-5, A-14).
  for (const g of groups) { g.all = g.rows.length; let k = 0;
    let folded = g.rows.length > cap && !g.flat ? g.rows.filter(b => ownStep(b) || k++ < cap) : g.rows;
    if (g.rows.length - folded.length <= 3) folded = g.rows;
    g.hides = g.rows.length - folded.length; g.shown = g.hides && !(v.full ??= {})[g.k] ? folded : g.rows; }
  NAV = groups.filter(g => g.open).flatMap(g => g.shown.map(b => b.id));
  return { list, groups };
}

// ---- rows or the spreadsheet (D9; R-336, Nate 25 Oct: "We also need a spreadsheet view of bills somewhere"): anyone may
// pick it; the choice is kept for the person (their prefs, so it follows them to another computer, with this browser's copy
// for a first paint). Its stored value stays 'table' (prefs.billsView), so nobody's choice from before the rename is lost. ----
const VKEY = () => `hiphi6_blview_${S.me?.id || ''}${DEMO ? '_demo' : ''}`;
function viewMode() {
  const v = bl(), who = S.me?.id || '';
  if (v.modeFor !== who) { let m = S.me?.prefs?.billsView; if (!m) { try { m = localStorage.getItem(VKEY()); } catch { m = null; } } v.mode = m === 'table' ? 'table' : 'rows'; v.modeFor = who; }
  return v.mode;
}
// Anyone may have the table at any width (D9; spec 7.10: 200% zoom at 1280 is 640px wide, and lost the switch and its
// Columns, Edit and Export): it scrolls inside its own box when it does not fit (data tables are exempt from reflow).
export const tableOn = () => viewMode() === 'table';
const switchNow = () => matchMedia('(min-width: 600px)').matches;
function setMode(m) {
  const v = bl(); viewMode(); if (v.mode === m) return;
  v.mode = m; v.look = null; v.edited = false; v.sort = v.sort || null;
  try { localStorage.setItem(VKEY(), m); } catch { /* this visit only */ }
  DB.patchPrefs({ billsView: m }).catch(() => { /* kept in this browser */ });
}

// ---- what a row says (V04, D15): the step in steps.js words, kept to two parts so a row holds four facts at most (the name,
// the number, what, when). Someone else's testimony step reads "Kris or Nate approves it · due today 3:00 PM" (spec 6,
// Testimony's example), not the state, who and when as three; the viewer's own step and everything else are steps.js's
// own line. ----
// Someone else's step in steps.js's one phrase (othersWords: "Patti or Lauren revises it", "Second look from Jaylen or
// Jess", "No owner yet"), the same on Today, Team, Testimony and the hearing cards (rule 6, spec 5; Nate's walk found
// "gives it the second look" and "No one is filing it yet" here only). steps.js's row line already says it so.
export function lineFor(s) {
  return s ? s.line : '';
}
const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;
// A bill that stopped: the reason in plain words, with its day as every row says a day ("Missed the deadline to reach its
// last committee, Fri 2/20"; Nate's walk: "Missed the lateral deadline 2/20/26" was jargon in another date format), and
// the session's end said so ("Did not pass before the session ended", never "the Sine die deadline."). No full stop: a
// row's line is a phrase (D15, C-15).
function stoppedLine(b) {
  const dd = String(b.died_deadline || ''), m = /^(.*?)\s+(\d+)\/(\d+)\/(\d+)$/.exec(dd);
  if (/sine die/i.test(dd)) return 'Did not pass before the session ended';
  if (m) { const y = m[4].length === 2 ? '20' + m[4] : m[4], iso = `${y}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
    return `Missed the deadline to ${gateNeed(m[1], 1)}, ${dayWords(iso)}`; }
  if (HELD_RE.test(b.last_action || '') && !/failed to pass/i.test(b.last_action || '') && !b.died_deadline) return 'Deferred by the committee';
  if (/failed to pass/i.test(b.last_action || '') && !b.died_deadline) return 'Failed a floor vote';
  return String(whyDead(b)).replace(/<[^>]+>/g, '').replace(/\.$/, '');
}
const rowStep = b => { const s = stepOf(b); if (!s) return s;
  const line = factsOf(b).stand === 'dead' && s.kind === 'none' ? stoppedLine(b) : lineFor(s);
  return line === s.line ? s : { ...s, line }; };

// ---- the page ----
// R-356 decision 2: Team (scope 'all') is a choice only for people who see Team; with one choice left no switch is drawn.
// A remembered or linked Team scope (a saved view, a coalition's bills opened from Issues) for someone without it falls back
// to My coalitions when they have some, else Mine, so the page is never empty or in error. Done on every draw, before any
// count is worked out from bl().scope.
function clampScope() {
  const v = bl(); if (v.scope !== 'all' || seesTeam()) return;
  v.scope = scopeOpts().some(([k]) => k === 'coal') && !S.bills.some(isMine) ? 'coal' : 'me'; if (v.view) v.view = '';
}
function scopeSwitch() {
  const v = bl(), co = scopeOpts().some(([k]) => k === 'coal'), team = seesTeam();
  if (!co && !team) return '';
  // C-15's words from ui.js WHOSE, as Hearings, Legislators and Outreach say them ("Mine · My coalitions · Team").
  return whoseSeg('blscope', { mine: 'me', coal: co ? 'coal' : null, team: team ? 'all' : null }, v.scope, { label: 'Whose bills' });
}
// R-356 round 1, decision 5 (A-14, D1): the "N to ask · first by … · Bills That Need Hearings" line that stood over this list
// (F95, V19) is gone: "bills need a hearing" is said once on Hearings (the line under its days) and once as a line on Today,
// each with the pile's one count (push.js toAskWords). Bills lists the bills; it does not count the ask pile.
// A filter in Mine (or My coalitions) says when the team has more, and offers the switch (F83 "N more under Team").
const moreLine = (n, more, q) => `<p class="bl-sum">${more ? `<button type="button" class="linkbtn" data-scopeall="1">${more} more under Team</button>` : ''}<span class="sr" aria-live="polite">${q ? `${n} bill${n === 1 ? ' matches' : 's match'}` : ''}</span></p>`;
// The list's toolbar: the filter box, Filter, Select, then (on a laptop) Rows | Table; the table adds Columns, Edit, Export.
function toolbar() {
  const v = bl(), n = activeFilters().length, wide = wideNow(), tbl = tableOn(), mode = viewMode();
  const box = `<div class="searchbox bl-search"><label class="sr" for="bl-q">Filter these bills by number or words</label>${icon('list-filter')}<input id="bl-q" class="input" type="search" placeholder="Filter these bills" value="${esc(v.q)}" autocomplete="off" enterkeyhint="search">${iconBtn('x', 'Clear the box', { 'data-qclear': '1', hidden: !v.q })}</div>`;
  // Nothing to pick or lay out in an empty list: Select and Rows | Table wait for bills (Jess's empty Mine, A-24).
  const has = shownBills().length > 0, sel = v.selecting || !has ? '' : `<span class="bl-tsel">${selectBtn()}</span>`;
  // The spreadsheet's three tools (F88, F92): Columns, Export (a file) and Copy (R-336: "copy out to Excel / Google Sheets",
  // pasted straight in). No Edit mode: a team cell is a button that opens its picker, so editing needs no mode to enter.
  const tools = tbl && switchNow() ? `<span class="bl-ttools">${btn('Columns', { kind: 'text', sm: true, icon: 'columns-3', attrs: { 'data-cols': '1', 'aria-haspopup': 'dialog' } })}${btn('Export', { kind: 'text', sm: true, icon: 'download', attrs: { 'data-export': '1', title: 'These bills, with your filters, as a spreadsheet file' } })}${btn(COPY_LABEL, { kind: 'text', sm: true, icon: 'copy', attrs: { 'data-copy': '1', title: 'The rows and columns shown, ready to paste into Google Sheets or Excel' } })}</span>` : '';
  // Rows | Spreadsheet and its tools from 600px; below that they are all in the toolbar's menu (D9: anyone, any width).
  const sw = !(has || tbl) ? '' : switchNow() ? `<div class="sv-seg bl-viewsw" role="group" aria-label="Show bills as">${[['rows', 'Rows', 'rows-3'], ['table', 'Spreadsheet', 'table-2']].map(([k, l, ic]) => `<button type="button" data-blview="${k}" aria-pressed="${mode === k}">${icon(ic)}<span>${l}</span></button>`).join('')}</div>`
    : iconBtn('ellipsis', 'Show as a spreadsheet, or export', { 'data-blmenu': '1', 'aria-haspopup': 'dialog' });
  // R-352 (D): Mine | Team leads the toolbar row, at its left under the tabs, as on Hearings and Legislators (it sat at the
  // title's right); a phone gives it a row of its own at its own compact width, the box and Filter under it.
  return `<div class="bl-tools" role="group" aria-label="This list"><div class="bl-whose">${scopeSwitch()}</div>${box}${filterBtn(n, { 'data-filter': '' })}${sel}<span class="bl-sp"></span>${tools}${sw}</div>`;
}
let BACK_AT = 0;   // when the browser's Back (or the top bar's) last landed, for the focus above
if (typeof addEventListener === 'function') addEventListener('popstate', () => { BACK_AT = Date.now(); });
const selectBtn = () => btn('Select', { kind: 'secondary', sm: true, icon: 'square-check-big', attrs: { 'data-blselect': '1', title: 'Pick bills to change several at once' } });
// Filters that are on, each a chip that comes off in one click, and Clear all; a saved view says its name first.
function onRow() {
  const act = activeFilters(), vw = curView(); if (!act.length && !vw) return '';
  const clear = act.length ? btn('Clear all', { kind: 'text', sm: true, attrs: { 'data-fclearall': '1' } }) : '';
  return `<div class="bl-on" role="group" aria-label="Filters that are on">${vw ? `<span class="bl-onview">${icon('bookmark-check')}<span>${esc(viewName(vw))}</span></span>` : ''}${act.map(([s, l]) => `<button type="button" class="chip bl-onchip" data-ft="${esc(s)}" aria-label="Remove the filter ${esc(l)}"><span>${esc(l)}</span>${icon('x')}</button>`).join('')}${clear}</div>`;
}
function emptyState(q, nf) {
  const v = bl(), whose = { me: 'of yours ', coal: 'in your coalitions ' }[v.scope] || '';
  if (q) {
    const elsewhere = v.scope !== 'all' && seesTeam() ? shownBills('all').length : 0;   // "N match under Team" only for people who see Team
    return empty({ title: `No bills ${whose}match “${esc(q)}”`, text: elsewhere ? `${elsewhere} match under Team.` : nf ? 'Your filters may be hiding it.' : 'Bills the team does not track yet are found by the search box at the top.',
      action: elsewhere ? btn('Show the team’s', { kind: 'secondary', attrs: { 'data-scopeall': '1' } }) : nf ? btn('Clear all filters', { kind: 'secondary', attrs: { 'data-fclearall': '1' } }) : btn('Search every bill', { kind: 'secondary', href: '#/search?q=' + encodeURIComponent(q) }) });
  }
  if (nf) return empty({ title: 'No bills match these filters', text: 'Take one off, or clear them all.', action: btn('Clear all filters', { kind: 'secondary', attrs: { 'data-fclearall': '1' } }) });
  if (v.scope === 'me') return empty({ title: 'You have no bills yet', text: 'Your bills are the ones you own or follow, and those on your issues. Follow a bill from its page.',
    action: scopeOpts().some(([k]) => k === 'coal') ? btn('Show my coalitions’ bills', { kind: 'secondary', attrs: { 'data-scopecoal': '1' } }) : seesTeam() ? btn('Show the team’s bills', { kind: 'secondary', attrs: { 'data-scopeall': '1' } }) : '' });
  if (v.scope === 'coal') return empty({ title: 'No bills in your coalitions yet', text: 'Bills tracked under the coalitions you help on show here. Choose them in My settings.', action: seesTeam() ? btn('Show the team’s bills', { kind: 'secondary', attrs: { 'data-scopeall': '1' } }) : '' });
  return empty({ title: 'No bills are tracked yet', text: 'Sort the new bills to start.', action: btn('Sort new bills', { kind: 'secondary', href: '#/bills/new' }) });
}
function parts() {
  const v = bl(), q = v.q.trim(), { list, groups } = build(), act = activeFilters();
  const more = q && v.scope !== 'all' && seesTeam() && list.length ? (() => { const n = shownBills('all').length; return n > list.length ? n - list.length : 0; })() : 0;
  // Searching, the line under the head is about the search; with any filter on (the deadline link's own included) there
  // is none; over the whole list, the deadline line.
  const lead = !list.length ? '' : q ? moreLine(list.length, more, q) : '';   // no ask-pile line over the list (see above)
  const selHead = v.selecting && list.length ? (() => { const all = NAV.length && NAV.every(id => v.sel.has(id)), ids = selIds(), vis = new Set(list.map(b => b.id)), hid = ids.filter(id => !vis.has(id)).length;
    return `<div class="bl-selhead"><span>${hid ? `${hid} of the ${ids.length} you picked ${hid === 1 ? 'is' : 'are'} hidden by your filters.` : wideNow() ? 'Click bills to pick them.' : 'Tap bills to pick them.'}</span>${btn(all ? 'Pick none' : `Pick the ${NAV.length} shown`, { kind: 'text', sm: true, attrs: { 'data-selall': all ? 'none' : 'all' } })}</div>`; })() : '';
  const body = !list.length ? emptyState(q, act.length) : tableOn() ? tableView(groups) : rowsView(groups);
  return { lead, chips: onRow(), body: `${selHead}${body}` };
}
const keysHint = () => !hoverNow() || !keysOn() || !keysUsed() ? '' : `<p class="bl-keys"><kbd>J</kbd> <kbd>K</kbd> next and previous bill · <kbd>Space</kbd> ${dockNow() ? 'opens it beside the list' : 'a quick look'} · <kbd>Enter</kbd> opens its page · <kbd>X</kbd> picks it · <kbd>Esc</kbd> closes</p>`;

// ---- rows (the default, every size): one card per group, the picked bill beside the list (V17) ----
function selRow(b) {
  const v = bl(), on = v.sel.has(b.id), s = rowStep(b);
  return `<div class="v6-row bl-selrow${on ? ' sel' : ''}${v.cur === b.id ? ' bl-cur' : ''}" role="listitem" data-v6row="${esc(b.id)}"><button type="button" class="v6-row-main bl-selmain" data-blsel="${esc(b.id)}" aria-pressed="${on}">
    <span class="bl-check" aria-hidden="true">${icon(on ? 'square-check-big' : 'square')}</span><span class="bl-seltx"><span class="v6-row-top"><span class="v6-row-name">${esc(nameWords(b))}</span><span class="v6-row-num">${esc(numWords(b))}</span></span>${s?.line ? `<span class="v6-row-line"><span>${nw(esc(s.line))}</span></span>` : ''}</span></button></div>`;
}
// ---- R-344 (the at-a-glance review's "the bill's own picture", Rules 1 and 2): what a row shows at a glance ----
// glanceRow(html, b, { stance, twins }) adds to a steps.js billRow, without changing it:
//   - a twin: when another bill in the same list goes by the same name (HB 2121 and SB 2175, "Disposable e-cigarette ban"),
//     each says "twin of SB 2175" inside its number, so the right one is picked (D3) and nobody reads it as where the bill is
//     now (the fresh-eyes review: "House" sat beside "Waiting in Senate Commerce"); `twins` is twinsAmong(the shown bills);
//   - (HIPHI's stance as its shape and one word, D1, only with `stance: true`: see below).
// Bills' rows and search's bill results take the twin only (R-352, A-18: a list of one kind, so no job tile, and the verb
// stays: "File now · due today 10:00 AM"; the progress bar, Now and the trophy wait on the bill's page).
export function glanceRow(html, b, { stance = false, twins = null } = {}) {
  if (!html || !b) return html;
  const tw = twins?.get(b.id);
  // inside the number ("HB 2121 twin of SB 2175"): one fact, the bill's name in the Capitol's words (spec 8: four a row)
  if (tw) html = html.replace(/(<span class="v6-row-num">[^<]*)(<\/span>)/, `$1 <span class="v6-twin" title="${esc(`Another bill goes by the same name: ${numWords(tw)}`)}">twin of ${esc(numWords(tw))}</span>$2`);
  // HIPHI's stance (D1) waits for a trade: a row already holds spec 8's four facts (name, number, a two-part line), and a
  // fifth on every row of a long list is what spec 8 forbids. stanceMark is ready (standing.js); `stance: true` draws it.
  if (stance === true) { const sm = stanceMark(b, { cls: 'bl-stance' });
    if (sm) html = html.replace(tw ? /(<span class="v6-row-num">[^<]*<span class="v6-twin"[^>]*>[^<]*<\/span><\/span>)/ : /(<span class="v6-row-num">[^<]*<\/span>)/, `$1${sm}`); }
  return html;
}
// Among the bills a list shows, each one whose name another of them shares (the same session): id -> that other bill.
export function twinsAmong(bills) {
  const by = new Map(), out = new Map();
  for (const x of bills || []) { const k = String(x.nickname || '').trim().toLowerCase(); if (!k) continue; const key = `${x.session_year}|${k}`; (by.get(key) || by.set(key, []).get(key)).push(x); }
  for (const list of by.values()) if (list.length > 1) for (const x of list) out.set(x.id, list.find(y => y.id !== x.id));
  return out;
}
// ---- each row leads with its issue's tile, inside its own soft card (R-352 D, Nate 28 Oct: with only words and hairlines
// "they all blur together"; he picked D of five tried): the issue's icon on its topic's soft tint, All issues' 32px tile, so
// bills on different issues look different at a glance (A-18 on v6: an icon that tells two things apart; A-5: topic tints
// only). A bill on several issues shows the viewer's own issue first, else the first by name; a bill on none keeps an
// empty slot of the same width, so every name starts at one edge. The cards are css/bills.css's (.bl-rowsv). ----
const issueOfBill = b => myIssuesOf(b)[0] || issuesOfBill(b.id)[0] || null;
const issueSlot = b => { const i = issueOfBill(b); return i ? issueLead(i) : '<span class="v6-row-lead i6-lead bl-noiss" aria-hidden="true"></span>'; };
const groupHead = g => FOLDED.has(g.k)
  ? `<h2 class="bl-gh" id="bl-g-${g.k}"><button type="button" class="bl-ghb" data-fold="${g.k}" aria-expanded="${g.open}"><span>${esc(g.title)}</span><span class="bl-gn">${g.all}</span>${icon(g.open ? 'chevron-up' : 'chevron-down', { cls: 'chev' })}</button></h2>`
  : `<h2 class="bl-gh" id="bl-g-${g.k}"><span>${esc(g.title)}</span><span class="bl-gn">${g.all}</span></h2>`;
function rowsView(groups) {
  const v = bl(), pick = !v.selecting;
  // No step buttons in Bills' rows (spec 11, settled 1): a viewer's own step has its button in the open bill beside the list,
  // on Today and on the bill's page; a row here says the step and opens the bill.
  const twins = twinsAmong(groups.filter(g => g.open).flatMap(g => g.shown));
  const rowOf = (b, g) => v.selecting ? selRow(b) : glanceRow(billRow(b, { viewer: S.me, pick: b.id, selected: v.look === b.id, step: rowStep(b), button: false, cls: v.cur === b.id ? 'bl-cur' : '', lead: issueSlot(b) }), b, { twins });
  // A phone's toolbar holds the filter box and Filter only; Select (F91: a visible tonal button) sits at the right of the
  // first group's heading, where a list's Select usually is on a phone (CSS shows it below 768px only).
  const selBtn = pick ? `<span class="bl-ghsel">${selectBtn()}</span>` : '';
  const html = groups.map((g, i) => `<section class="bl-grp" aria-labelledby="bl-g-${g.k}">${i === 0 && selBtn ? `<div class="bl-ghbar">${groupHead(g)}${selBtn}</div>` : groupHead(g)}${g.open ? `<div class="v6-list" role="list" aria-labelledby="bl-g-${g.k}">${g.shown.map(b => rowOf(b, g)).join('')}</div>${moreRows(g) ? `<div class="bl-more">${moreRows(g)}</div>` : ''}` : ''}</section>`).join('');
  if (!pick) return `<div class="bl-groups bl-selecting">${html}</div>${keysHint()}`;
  const b = v.look ? S.bills.find(x => x.id === v.look) : null;
  // listDetail's one list becomes one card per group, so the list box itself carries no role (each group's card is the list).
  return listDetail({ id: 'bills', label: 'Bills', rows: html, picked: b ? b.id : null, detail: b ? itemHTML(b) : '', empty: 'Pick one to see its steps', back: 'Back to the bills' })
    .replace('class="v6-ld-list" role="list" aria-label="Bills"', 'class="v6-ld-list bl-groups"') + keysHint();
}
// The open bill (billpane.js openItem): its step card holds this screen's one filled button when the step is the viewer's.
// About this bill says the position and owner too, which the rows do not.
function itemHTML(b) {
  const o = ownerOf(b), who = o ? (o.id === S.me?.id ? 'You' : `${teamName(o)}${newOwnerTag(o)}`) : 'No owner yet';
  const iss = myIssuesOf(b), mine = iss.length ? `<div><dt>Your issue${iss.length > 1 ? 's' : ''}</dt><dd>${iss.map(i => esc(i.name)).join(', ')}</dd></div>` : '';
  const about = aboutBill(b, { hearing: !stepOf(b)?.h }).replace('<dl class="v6-facts">', `<dl class="v6-facts"><div><dt>Position</dt><dd>${esc(posWord(b.position || ''))}</dd></div><div><dt>Owner</dt><dd>${esc(who)}</dd></div>${mine}`);
  return openItem(b, { viewer: S.me, where: 'pane', from: 'bills', close: closeBtn({ 'data-bldclose': '1' }), headId: 'bl-item-h', about });
}

// ---- the table (D9, F88, F89): v5's, with words for codes (V05) ----
// The columns a person may add (Columns), remembered for them (prefs.billsCols, with this browser's copy): Priority and
// Nickname are R-336's (Nate: "pick his own columns"). Priority is read-only: it follows the position (R-175).
const OPT_COLS = [['pri', 'Priority', 'Top tier or standard; it follows the position'], ['nick', 'Nickname', 'The short name the team and the public page use. Click one to change it'],
  ['cmte', 'Committees', 'Every committee the bill is sent to, in order'], ['coal', 'Coalitions', 'The coalitions working on it'], ['last', 'Last action', 'The Capitol’s latest step and its date'], ['pulse', 'Team pulse', 'When the team last did something on it']];
const COL_KEYS = OPT_COLS.map(c => c[0]);
const CKEY = () => `hiphi6_blcols_${S.me?.id || ''}${DEMO ? '_demo' : ''}`;
// The person's columns: their prefs first (they follow them to another computer), else this browser's copy, else the list's
// own (filters.js, which keeps the four older ones).
function colsOf() {
  const v = bl(), who = S.me?.id || '';
  if (v.colsFor !== who) { let c = S.me?.prefs?.billsCols; if (!Array.isArray(c)) { try { c = JSON.parse(localStorage.getItem(CKEY()) || 'null'); } catch { c = null; } }
    if (Array.isArray(c)) v.cols = new Set(c.filter(k => COL_KEYS.includes(k))); v.colsFor = who; }
  return v.cols;
}
function saveCols() {
  const c = COL_KEYS.filter(k => bl().cols.has(k)); save();
  try { localStorage.setItem(CKEY(), JSON.stringify(c)); } catch { /* this visit only */ }
  DB.patchPrefs({ billsCols: c }).catch(() => { /* kept in this browser */ });
}
const PRI_WORD = { 1: 'Top tier', 2: 'Standard' };
const POS_SHORT = { strongly_support: 'Strong', support: 'Support', support_amend: 'Amend', strongly_oppose: 'Strong no', oppose: 'Oppose', neutral: 'Comments', monitor: 'Monitor', '': 'None' };
// Column widths, in px, as [roomy, compact] (v5's measures; Owner now holds a first name, not initials).
const COLS = [
  { k: 'sel', w: [44, 40] }, { k: 'bill', label: 'Bill', min: [92, 96], ideal: [104, 104], sort: 'num' }, { k: 'title', label: 'Title', min: [180, 176], sort: 'title' },
  { k: 'where', label: 'Where it stands', min: [128, 128], ideal: [176, 176], sort: 'stage' }, { k: 'next', label: 'Next', min: [160, 156], ideal: [220, 220], sort: 'next' },
  { k: 'pos', label: 'Position', min: [132, 124], ideal: [156, 184], sort: 'pos' }, { k: 'own', label: 'Owner', w: [96, 96], sort: 'own' },
  { k: 'pri', label: 'Priority', w: [112, 112], opt: 1, sort: 'pri' }, { k: 'nick', label: 'Nickname', min: [148, 148], ideal: [220, 220], opt: 1, sort: 'nick' },
  { k: 'cmte', label: 'Committees', min: [148, 148], ideal: [220, 220], opt: 1, sort: 'cmte' }, { k: 'coal', label: 'Coalitions', min: [128, 128], ideal: [176, 168], opt: 1, sort: 'coal' },
  { k: 'last', label: 'Last action', min: [172, 172], ideal: [320, 300], opt: 1, sort: 'last' }, { k: 'pulse', label: 'Team pulse', w: [112, 112], opt: 1, sort: 'pulse' },
];
// Lucide's arrow-up-down, drawn here (icons.js is shared): every sortable heading shows it faintly, so sorting is seen at rest.
const UPDOWN = '<svg class="ic ic-arrow-up-down" width="1.25em" height="1.25em" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="m21 16-4 4-4-4"/><path d="M17 20V4"/><path d="m3 8 4-4 4 4"/><path d="M7 4v16"/></svg>';
let MEASURED = null, SHOWN_COLS = [];   // the columns the spreadsheet drew last, in order (Copy copies those)
const DOCK_W = 380, DOCK_GAP = 24;   // the open item's width beside the table: listDetail's (steps.css)
const estimateAvail = () => { const w = document.documentElement.clientWidth || innerWidth, page = w >= 1100 ? w - 248 - 64 : w >= 768 ? w - 216 - 48 : w - 32; return (docked() ? page - DOCK_W - DOCK_GAP : page) - 2; };
const measureKey = () => `${innerWidth}:${docked()}`;
const tableAvail = () => MEASURED && MEASURED.key === measureKey() ? MEASURED.avail : estimateAvail();
function widths(cols, avail, ci) {
  const W = new Map(cols.map(c => [c.k, c.w ? c.w[ci] : c.min[ci]]));
  let spare = avail - [...W.values()].reduce((t, x) => t + x, 0);
  const give = (keys, capTo) => {
    const need = keys.filter(k => W.has(k)).map(k => [k, Math.max(0, capTo(k) - W.get(k))]).filter(x => x[1] > 0), tot = need.reduce((t, x) => t + x[1], 0);
    if (spare <= 0 || !tot) return; const f = Math.min(1, spare / tot);
    for (const [k, n] of need) W.set(k, W.get(k) + n * f); spare -= tot * f;
  };
  const ideal = k => { const c = cols.find(x => x.k === k); return c.ideal ? c.ideal[ci] : W.get(k); };
  if (ci) { give(['title'], () => 270); give(['next'], ideal); give(['pos'], ideal); give(['where', 'bill'], ideal); give(['title'], () => 360); give(['nick', 'cmte', 'coal', 'last'], ideal); give(['title'], () => 720); }
  else { give(['title'], () => 440); give(['pos', 'where', 'next', 'bill', 'nick', 'cmte', 'coal', 'last'], ideal); give(['title'], () => 720); }
  give(['title'], () => 960); give(['where', 'next', 'pos', 'nick', 'cmte', 'coal', 'last'], k => ideal(k) * 1.5);
  return W;
}
const GUTTERED = new Set(['bill', 'title', 'where', 'next', 'pos', 'nick', 'cmte', 'coal', 'last']);
function squeezed(cols, avail, ci) {
  const W = new Map(cols.map(c => [c.k, (c.w ? c.w[ci] : c.min[ci]) - (!ci && GUTTERED.has(c.k) ? 8 : 0)])), soft = ['title', 'where', 'pos'];
  const over = [...W.values()].reduce((t, x) => t + x, 0) - avail, pool = soft.reduce((t, k) => t + W.get(k), 0);
  if (over > pool * .17) return null;
  for (const k of soft) W.set(k, W.get(k) * (1 - over / pool));
  return W;
}
// "Where it stands" in words: "Senate Commerce" and "1st of 2" under it; "Senate floor"; "Stopped" and where.
const ORD = ['', '1st', '2nd', '3rd', '4th', '5th'];
const CH = { H: 'House', S: 'Senate' };
function whereCell(b) {
  const s = stOf(b), f = factsOf(b), ch = CH[s.chamber] || 'Chamber';
  if (f.stand === 'dead') { const at = b.died_at_stage ? STAGE_LABEL[b.died_at_stage] : ''; return ['Stopped', at ? 'at ' + esc(at) : '', ''] }
  if (s.phase === 'law') return ['Law', '', ''];
  if (s.phase === 'governor') return ['With the governor', '', ''];
  if (s.phase === 'floor') return [`${ch} floor`, '', `Through its ${ch} committees, waiting for the full ${ch} to vote`];
  if (s.phase === 'conference') return ['Conference', '', 'House and Senate negotiators settling one version'];
  if (s.committee) return [esc(committeeName(s.committee)), s.stops > 1 ? `${ORD[s.stop] || s.stop} of ${s.stops}` : '', `${committeeName(s.committee)}${s.stops > 1 ? `: committee ${s.stop} of ${s.stops} in the ${ch}, which it must clear in order` : ''}`];
  return [ch, 'no committee yet', ''];
}
// "Next": the step in steps.js words (V19), the same line as the rows; with no step, the deadline the bill races. The
// fourth part is the compact table's one line, the time first ("Wed 3/18, 9:30 AM · Kevin files it"): a narrow cell cuts
// its end, and the when is what a weekly reader of the table looks for (B-9, A-24).
const timeFirst = (what, when) => `${nw(esc(cap(when)))} · ${nw(esc(what))}`;
// The when at the end of a step line ("… due today 2:00 PM", "… send for approval by Sat 3/21, 4:00 PM", "… until 1:10 PM
// today"); "Filed by James" and "Asked by Kevin" have none. Late testimony says so first: "Late, until 1:10 PM today · File".
const WHEN_AT = /(?:^|\s)(?:due|by|until) ((?:today|tomorrow|(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)\b|\d{1,2}:\d\d).*)$/;
function compactLine(line) {
  const m = WHEN_AT.exec(line); if (!m) return null;
  let what = line.slice(0, m.index).replace(/\s*·\s*$/, '').trim(), when = m[1];
  if (/late, still accepted$/.test(what)) { what = what.replace(/\s*·?\s*late, still accepted$/, ''); when = `late, until ${when}`; }
  return what ? timeFirst(what, when) : null;
}
function nextCell(b) {
  const s = rowStep(b), st = stOf(b);
  if (s && s.kind !== 'none') { const line = String(s.line || ''), [a, ...rest] = line.split(' · '), r = rest.join(' · ');
    return [nw(esc(a)), nw(esc(r)), line, compactLine(line)]; }
  if (factsOf(b).stand === 'dead') { const [a, ...rest] = stoppedLine(b).split(' · '); return [esc(a), esc(rest.join(' · ')), stoppedLine(b)]; }
  if (st.hearingState === 'held') return ['Waiting for the committee’s vote', `heard ${esc(fmtDate(st.hearing.scheduled_at))}`, ''];
  if (st.phase === 'law') { const act = /\bAct \d+/i.exec(b.last_action || ''); return [act ? esc(act[0]) : '', '', ''] }
  if (!st.deadline || st.deadline.missed) return ['', '', ''];
  const w = deadlineWords(st.deadline.label, st.deadline.date), [what, day] = w.split(/ by (?=[A-Z][a-z]{2} \d)/);
  return [nw(esc(cap(what))), day ? `by <span class="v6-nw">${esc(day)}</span>` : '', `${deadlineName(st.deadline)}: ${cap(w)}`, day ? timeFirst(cap(what), day) : null];
}
const pulseText = b => { const d = daysAgo(S.pulse[b.id]?.last_team_touch); return d == null ? 'Never' : d <= 0 ? 'Today' : d === 1 ? 'Yesterday' : `${d} days ago`; };
const summaryOf = b => b.public_summary || b.description || b.title || '';
const fullTitle = b => b.nickname ? `${b.nickname}. ${summaryOf(b)}` : summaryOf(b);
const coalNames = b => (S.billCampaigns[b.id] || []).map(id => S.campaigns.find(x => x.id === id)?.name).filter(Boolean).join(', ');
const ownAv = (o, size) => offTag(o) ? `<span class="bl-offav">${avatar({ ...o, full_name: `${teamName(o)}${newOwnerTag(o)}` }, size)}</span>` : avatar(o, size);
const firstOf = o => o.id === S.me?.id ? 'You' : String(o.full_name || '').split(' ')[0] || 'Someone';
function tableView(groups) {
  const v = bl(), ci = v.compact ? 1 : 0, avail = tableAvail(), dk = docked();
  const least = cs => cs.reduce((t, c) => t + (c.w ? c.w[ci] : c.min[ci]), 0);
  // Mine has no Owner column: every row would say "you" (A-14, R-022); nor a list whose bills all have one owner.
  const owns = new Set(groups.filter(g => g.open).flatMap(g => g.shown).map(b => ownerOf(b)?.id || ''));
  const oneOwner = owns.size === 1 && !owns.has('') && !offTag([...owns][0]), mine = colsOf();
  let cols = COLS.filter(c => (c.k !== 'sel' || v.selecting) && (!c.opt || mine.has(c.k)) && (c.k !== 'own' || (v.scope !== 'me' && !oneOwner)))
    .map(c => c.k === 'own' && (owns.has('') || [...owns].some(id => offTag(id))) ? { ...c, w: [112, 112] } : c)
    // Mine marks the bills it follows with a small icon after the number: the column makes room for it (critic: it was cut).
    .map(c => c.k === 'bill' && v.scope === 'me' ? { ...c, min: [116, 116], ideal: [124, 124] } : c);
  // With Nickname on, it comes right after the bill and the Title column is the Description (critic, R-336).
  if (cols.some(c => c.k === 'nick')) { const nk = cols.find(c => c.k === 'nick'), at = cols.findIndex(c => c.k === 'bill') + 1;
    cols = cols.filter(c => c !== nk); cols.splice(at, 0, nk); cols = cols.map(c => c.k === 'title' ? { ...c, label: 'Description' } : c); }
  // A phone: the columns a person changes (position, owner) come before the Capitol's, so they start on screen.
  const phone = !switchNow();
  if (phone) { const ed = cols.filter(c => c.k === 'pos' || c.k === 'own'), ti = cols.findIndex(c => c.k === 'title');
    cols = cols.filter(c => !ed.includes(c)); cols.splice(ti + 1, 0, ...ed); }
  // With the bill open beside the table, the table gives up, in turn, what the open bill also says: the added columns,
  // the position's word, "Where it stands", then the owner.
  if (dk) { const room = cs => least(cs) + 124 + (cs.some(c => c.k === 'pos' && !c.icon) ? 60 : 0) <= avail;
    const steps = [cs => cs.filter(c => !c.opt), cs => cs.map(c => c.k === 'pos' ? { ...c, w: [124, 120], icon: 1 } : c), cs => cs.filter(c => c.k !== 'where'), cs => cs.filter(c => c.k !== 'own')];
    for (const step of steps) if (!room(cols)) cols = step(cols); }
  const std = cols.filter(c => !c.opt), nickCol = cols.some(c => c.k === 'nick');
  SHOWN_COLS = cols.filter(c => c.k !== 'sel').map(c => [c.k, c.label]);
  const fits = least(cols) <= avail, tight = fits ? null : squeezed(cols, avail, ci), scroll = !fits && !tight, fitsStd = least(std) <= avail;
  const W = tight || (scroll ? (fitsStd ? widths(std, avail, ci) : squeezed(std, avail, ci) || widths(std, least(std), ci)) : widths(cols, avail, ci));
  if (scroll) for (const c of cols) if (c.opt) W.set(c.k, c.w ? c.w[ci] : c.ideal[ci]);
  if (scroll && phone && W.has('title')) W.set('title', 132);   // a narrow title, so Position starts on a phone's screen
  const total = cols.reduce((t, c) => t + W.get(c.k), 0), capW = !scroll && !dk && total < avail - 1 ? Math.round(total) + 2 : 0;
  const colg = `<colgroup>${cols.map(c => `<col style="width:${scroll ? Math.round(W.get(c.k)) + 'px' : (W.get(c.k) / total * 100).toFixed(3) + '%'}">`).join('')}</colgroup>`;
  const rowsShown = groups.filter(g => g.open).flatMap(g => g.shown), selShown = rowsShown.filter(b => v.sel.has(b.id)).length;
  const [sk, sd] = v.sort || [];
  const th = c => {
    if (c.k === 'sel') return `<th scope="col" class="bl-ck"><label title="Pick every bill shown"><input type="checkbox" id="bl-all" ${rowsShown.length && selShown === rowsShown.length ? 'checked' : ''} aria-label="Pick every bill shown"></label></th>`;
    if (!c.sort) return `<th scope="col" class="bl-h-${c.k}">${c.label}</th>`;
    const on = sk === c.sort, l = c.label.toLowerCase(), tip = !on ? `Sort every bill by ${l}, in one list` : sd > 0 ? `Sorted by ${l}, first to last, in one list. Click for last to first` : `Sorted by ${l}, last to first. Click to stop sorting and see the groups again`;
    return `<th scope="col" class="bl-h-${c.k}" aria-sort="${on ? (sd > 0 ? 'ascending' : 'descending') : 'none'}"><button type="button" class="bl-sort${on ? ' on' : ''}" data-sort="${c.sort}" title="${tip}"><span>${c.label}</span>${on ? icon(sd < 0 ? 'move-down' : 'move-up') : UPDOWN}</button></th>`;
  };
  const two = (html, t) => `<span class="bl-c2"${t ? ` title="${esc(t)}"` : ''}>${html}</span>`;
  const lines = ([l1, l2, t]) => `<span class="bl-lns"${t ? ` title="${esc(t)}"` : ''}><span class="bl-ln">${l1}</span>${l2 ? `<span class="bl-ln bl-l2">${l2}</span>` : ''}</span>`;
  const none = '<span class="bl-dash">None</span>';
  const folMark = b => { if (v.scope !== 'me' || isOwner(b)) return ''; const o = ownerOf(b), iss = myIssuesOf(b), who = o ? `${teamName(o)} owns it${newOwnerTag(o)}` : 'It has no owner';
    const t = iss.length ? `On your issue ${iss.map(i => i.name).join(' and ')}. ${who}.` : `You follow it. ${who}.`;
    return `<span class="bl-fol" role="img" aria-label="${esc(t)}" title="${esc(t)}">${icon(iss.length ? 'tag' : 'bell')}</span>`; };
  const cell = (c, b) => {
    switch (c.k) {
      case 'sel': return `<td class="bl-ck"><label><input type="checkbox" data-sel="${b.id}" ${v.sel.has(b.id) ? 'checked' : ''} aria-label="Pick ${esc(billSay(b))}"></label></td>`;
      case 'bill': return `<td class="bl-num"><a href="${billRoute(b)}" data-bill="${b.id}"><span>${esc(numWords(b))}</span></a>${folMark(b)}</td>`;
      // With a Nickname column the title says the summary only: the nickname is said once, in its own cell (A-14).
      case 'title': return `<td class="bl-ti">${nickCol ? two(esc(summaryOf(b)), summaryOf(b)) : two(ci ? (b.nickname ? `<b>${esc(b.nickname)}</b>` : esc(summaryOf(b))) : `${b.nickname ? `<b>${esc(b.nickname)}</b> <br>` : ''}${esc(summaryOf(b))}`, fullTitle(b))}</td>`;
      case 'pri': return `<td><span title="It follows the position: Strong support is the top tier">${b.priority ? esc(PRI_WORD[b.priority] || 'Standard') : none}</span></td>`;
      case 'nick': return `<td><button type="button" class="bl-cell bl-nick" data-edit="nick" data-id="${b.id}" aria-label="Nickname of ${esc(billSay(b))}: ${esc(b.nickname || 'none')}. Change it">${b.nickname ? `<span>${esc(b.nickname)}</span>` : '<span class="bl-dash">None</span>'}${icon('chevron-down', { cls: 'bl-chev' })}</button></td>`;
      case 'where': return `<td>${lines(whereCell(b))}</td>`;
      case 'next': { const c0 = nextCell(b), s = stepOf(b), c3 = ci && c0[1] ? [c0[3] || `${c0[0]} · ${c0[1]}`, '', c0[2]] : ci && c0[3] ? [c0[3], '', c0[2]] : c0;   // a compact row: one line, the time first
        return `<td${s?.state ? ` data-step="${esc(s.state.word)}" data-due="${esc(s.due ? new Date(s.due).toISOString() : '')}"` : ''}>${c3[0] ? lines(c3) : none}</td>`; }
      case 'cmte': { const r = (b.referrals || []).map(x => committeeName(x)).join(', then '); return `<td>${r ? two(esc(r), r) : none}</td>`; }
      case 'coal': { const n = coalNames(b); return `<td>${n ? two(esc(n), n) : none}</td>`; }
      case 'last': return `<td>${b.last_action ? two(`${b.last_action_date ? `<span class="bl-date">${fmtDate(b.last_action_date)}</span> ` : ''}${esc(b.last_action)}`, b.last_action) : none}</td>`;
      case 'pulse': return `<td>${pulseText(b)}</td>`;
      case 'pos': { const p = b.position || '', w = p ? POS_WORD[p] || p : posWord(''); return `<td><button type="button" class="bl-cell" data-edit="pos" data-id="${b.id}" aria-label="Position for ${esc(billSay(b))}: ${esc(w)}. Change it"${c.icon ? ` title="${esc(w)}"` : ''}>${posIcons(p)}<span>${esc(c.icon ? POS_SHORT[p] ?? w : w)}</span>${icon('chevron-down', { cls: 'bl-chev' })}</button></td>`; }
      case 'own': { const o = ownerOf(b);
        return `<td><button type="button" class="bl-cell bl-own" data-edit="own" data-id="${b.id}" aria-label="Owner of ${esc(billSay(b))}: ${esc(o ? (o.id === S.me?.id ? 'you' : `${teamName(o)}${newOwnerTag(o)}`) : 'nobody')}. Change it">${o ? offTag(o) ? `<span class="bl-noown">${ownAv(o, 20)}<span class="bl-noword">Turned off</span></span>` : `<span>${esc(firstOf(o))}</span>` : `<span class="bl-noown">${icon('circle-dashed')}<span class="bl-noword">No owner</span></span>`}${icon('chevron-down', { cls: 'bl-chev' })}</button></td>`; }
    }
    return '<td></td>';
  };
  const n = cols.length, pin = W.get('sel') || 0, extra = cols.filter(c => c.opt).map(c => c.label);
  const words = extra.length > 1 ? `${extra.slice(0, -1).join(', ')} and ${extra[extra.length - 1]}` : extra[0];
  const table = `${scroll ? `<p class="bl-tnote" id="bl-tnote">${icon('arrow-right')}<span>${phone ? 'Scroll sideways for more columns.' : extra.length ? `${esc(words)} ${extra.length === 1 ? 'is' : 'are'} to the right: this window is too narrow for every column, so the spreadsheet scrolls sideways.` : 'This window is too narrow for the whole spreadsheet, so it scrolls sideways.'}</span></p>
    <div class="bl-twrap"><div class="bl-tscroll" role="region" aria-label="Bills spreadsheet" aria-describedby="bl-tnote" tabindex="0" style="--bl-pin:${pin}px">` : ''}<table class="bl-table${v.compact ? ' bl-compact' : ''}${tight || scroll && !fitsStd ? ' bl-tight' : ''}"${scroll ? ` style="width:${Math.round(total)}px"` : capW ? ` style="max-width:${capW}px"` : ''}>${colg}<caption class="sr">${groups[0]?.flat ? 'Bills, sorted' : 'Bills, grouped by where they stand'}</caption>
    <thead><tr>${cols.map(th).join('')}</tr></thead>
    ${groups.map(g => `<tbody class="bl-tg${g.flat ? ' bl-flat' : ''}">${g.flat ? '' : `<tr class="bl-gr"><th colspan="${n}" scope="colgroup"><button type="button" class="sv-group bl-grb" data-fold="${g.k}" aria-expanded="${g.open}"${scroll ? ` style="width:${avail}px"` : ''}><span>${esc(g.title)}</span><span class="n">${g.rows.length}</span>${icon(g.open ? 'chevron-up' : 'chevron-down', { cls: 'chev' })}</button></th></tr>`}
      ${g.open ? g.shown.map(b => { const lk = dk && v.look === b.id;
        return `<tr data-row="${b.id}" data-num="${esc(billRef(b))}" class="${v.selecting && v.sel.has(b.id) ? 'sel' : ''}${v.cur === b.id ? ' bl-cur' : ''}${lk ? ' bl-look' : ''}"${lk ? ' aria-current="true"' : ''}>${cols.map(c => cell(c, b)).join('')}</tr>`; }).join('') + (moreRows(g) ? `<tr class="bl-morer"><td colspan="${n}">${moreRows(g)}</td></tr>` : '') : ''}</tbody>`).join('')}
  </table>${scroll ? '</div></div>' : ''}${keysHint()}`;
  const b = dk ? S.bills.find(x => x.id === v.look) : null;
  return b ? `<div class="bl-split"><div class="bl-main">${table}</div><aside class="bl-dock" aria-label="The bill you picked">${itemHTML(b)}</aside></div>` : table;
}

// ---- muted bills (#/bills/muted, F93): the page tab, each bill with Unmute and Undo ----
function renderMuted() {
  const rows = S.bills.filter(b => S.mutes?.has(b.id)).sort(byNum);
  ST.clear(); STEP.clear(); freshFacts();
  return `<div class="bl-page bl-muted">${billsHead('muted')}
    <p class="bl-lede">Muted bills stay off your lists and send you no alerts. A new hearing brings a bill back on its own.</p>
    ${rows.length ? `<div class="v6-list" role="list" aria-label="Muted bills">${rows.map(b => billRow(b, { viewer: S.me, line: nw(esc(factsOf(b).stand === 'dead' ? stoppedLine(b) : whereWords(b))),
      button: btn('Unmute', { kind: 'secondary', sm: true, attrs: { 'data-unmute': b.id, 'aria-label': `Unmute ${billSay(b)}` } }) })).join('')}</div>`
      : empty({ title: 'No muted bills', text: 'Mute a bill from its page when you do not need its alerts for a while.', action: btn('Back to Bills', { href: '#/bills', kind: 'secondary' }) })}
  </div>`;
}
function wireMuted(page) {
  page.querySelectorAll('[data-unmute]').forEach(el => el.onclick = async () => {
    const b = S.bills.find(x => x.id === el.dataset.unmute); if (!b) return;
    el.setAttribute('aria-busy', 'true');
    try {
      await DB.mute(b.id, false); hooks.render();
      toast(`${billSay(b)} is back on your list.`, { undo: async () => { await DB.mute(b.id, true); hooks.render(); } });
    } catch (e) { el.removeAttribute('aria-busy'); toast(e, { err: true }); }
  });
}

// ---- export, columns, single-cell edits ----
function exportCSV(list) {
  const rows = [['Bill', 'Title', 'Coalitions', 'Owner', 'Stage', 'Position', 'Priority', 'Committee', 'Last action', 'Last action date']];
  list.forEach(b => rows.push([b.bill_number, b.title, (S.billCampaigns[b.id] || []).map(c => S.campaigns.find(x => x.id === c)?.name).join('; '),
    (S.assignments[b.id] || []).map(id => teamName(id)).join('; '), STAGE_LABEL[effStage(b)], b.position || '', b.priority || '', b.committee || '', b.last_action || '', b.last_action_date || '']));
  const csv = rows.map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = 'hiphi-bill-tracker.csv'; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast(`Downloaded ${list.length} bill${list.length === 1 ? '' : 's'} as a spreadsheet file.`);
}
const listInOrder = () => build().groups.flatMap(g => g.rows);
// More tools › Export (#/bills?export=1), the spreadsheet's Export and the phone's menu: the file downloads at once, and the
// message says how many bills it holds (critic: a sheet with one item in it was a step for nothing).
const exportSheet = () => exportCSV(listInOrder());
function columnsSheet(anchor) {
  const v = bl();
  colsOf();
  openSheet({ title: 'Columns', size: 'auto bl-pop', body: `<p class="small muted bl-colhelp">Bill, title, where it stands, next, position and owner always show. These come after them, and stay as you leave them.</p>${OPT_COLS.map(([k, l, help]) => switchRow('bl-col-' + k, l, v.cols.has(k), help, { 'data-col': k })).join('')}
      <div class="bl-colsep"></div>${switchRow('bl-compact', 'Compact rows', v.compact, 'One line a bill, so more bills fit on the screen', { 'data-compact': '1' })}`,
    wire: d => { placePop(d, anchor);
      d.querySelectorAll('[data-col]').forEach(el => el.onchange = () => { el.checked ? v.cols.add(el.dataset.col) : v.cols.delete(el.dataset.col); saveCols(); hooks.render(); });
      d.querySelector('[data-compact]').onchange = e => { setCompact(e.target.checked); hooks.render(); }; } });
}
// A team cell's picker (position, owner) or the nickname's box: the same people who change them on the bill's page change
// them here (anyone on staff, R-106), saved through the same calls, each with Undo (A-16). Capitol facts have no button.
function editCell(field, id) {
  const b = S.bills.find(x => x.id === id); if (!b) return;
  const cellSel = `[data-edit="${field}"][data-id="${CSS.escape(String(id))}"]`;
  if (field === 'nick') return nickSheet(b, cellSel);
  const F = FIELD[field], cur = F.cur(b);
  pickerSheet({ title: `${F.word[0].toUpperCase() + F.word.slice(1)} for ${esc(billSay(b))}`, options: F.opts(), value: cur, onPick: val => saveCell(field, id, val, cellSel) });
}
// One bill's position or owner, from its cell's picker: saved at once, with Undo, naming the bill. The rows then hold their
// places (v.edited), so the bill just changed stays under the pointer.
async function saveCell(field, id, val, cellSel) {
  const b = S.bills.find(x => x.id === id); if (!b) return;
  const was = FIELD[field].cur(b); if (val === '' || val === was) return;
  const said = `${billSay(b)} ${FIELD[field].word}: ${wordOf(field, was)} to ${wordOf(field, val)}`;
  bl().edited = true;
  try {
    if (field === 'own') {
      const prev = (S.assignments[id] || [])[0] || null;
      await DB.setOwner(id, val === 'none' ? null : val); repaint(cellSel);
      toast(said, { undo: async () => { await DB.setOwner(id, prev); repaint(cellSel); } });
    } else {
      const prev = b.position ?? null;
      await DB.updateBill(id, { position: val }); repaint(cellSel);
      toast(said, { undo: async () => { await DB.updateBill(id, { position: prev }); repaint(cellSel); } });
    }
  } catch (e) { repaint(); toast(e, { err: true }); }
}
// The nickname, as the bill's page edits it (bill.js, V22): 3 to 40 characters, or empty for the description; saved against
// what it was when the box opened, so a teammate's newer one is never quietly replaced (R-152 B).
function nickSheet(b, cellSel) {
  const was = b.nickname || null;
  const d = openSheet({ title: `Nickname for ${esc(billSay(b))}`, size: 'auto', pop: true,
    body: `<form class="bl-nickf" data-nickf novalidate><label class="sr" for="bl-nickin">Nickname</label><input id="bl-nickin" class="input" maxlength="40" autocomplete="off" value="${esc(was || '')}" placeholder="Disposable e-cigarette ban" aria-describedby="bl-nick-help bl-nick-err">
      <p class="small muted" id="bl-nick-help">A few words the team says. It shows on the public page too. Leave it empty to use the bill’s description.</p>
      <p class="err" id="bl-nick-err" role="alert" hidden>${icon('circle-alert')}A nickname needs at least 3 characters.</p></form>`,
    foot: `${btn('Cancel', { kind: 'text', attrs: { 'data-nickno': '1' } })}${btn('Save nickname', { kind: 'secondary', icon: 'check', attrs: { 'data-nickok': '1' } })}`,
    wire: dlg => {
      const inp = dlg.querySelector('#bl-nickin'), err = dlg.querySelector('#bl-nick-err'), form = dlg.querySelector('[data-nickf]');
      setTimeout(() => { inp.focus(); try { inp.setSelectionRange(inp.value.length, inp.value.length); } catch { /* ignore */ } }, 30);
      inp.oninput = () => { err.hidden = true; inp.removeAttribute('aria-invalid'); };
      dlg.querySelector('[data-nickno]').onclick = () => closeSheet();
      const go = async () => {
        const v = inp.value.trim().replace(/\s+/g, ' ');
        if (v && v.length < 3) { err.hidden = false; inp.setAttribute('aria-invalid', 'true'); inp.focus(); return; }
        await closeSheet({ silent: true });
        if ((v || null) === was) return;
        const who = `${was || summaryOf(b)} (${numWords(b)})`;   // said by the name it had, so the message names the bill it was
        bl().edited = true;
        try {
          const res = await DB.saveBillFields(b.id, { nickname: v || null }, { nickname: was });
          FACTS.clear(); repaint(cellSel);
          if (res.conflicts?.length) return toast('A teammate changed this nickname a moment ago, so yours was not saved. Their nickname is shown now.');
          if (!res.changed?.length) return toast('Nothing to save: the nickname already says this.');
          toast(v ? `${who} nickname: “${v}”` : `${who} goes by its description now`, { undo: async () => { await DB.updateBill(b.id, { nickname: was }); FACTS.clear(); repaint(cellSel); } });
        } catch (e) { repaint(); toast(e, { err: true }); }
      };
      form.onsubmit = e => { e.preventDefault(); go(); };
      dlg.querySelector('[data-nickok]').onclick = go;
    } });
  return d;
}
const wordOf = (field, v) => !v || v === 'none' ? (field === 'own' ? 'no owner' : 'none') : field === 'pos' ? POS_WORD[v] || v
  : v === S.me?.id ? 'you' : firstNames().get(v) || (offTag(v) ? teamFirst(v) : 'someone');
const firstNames = () => { const act = S.advocates.filter(a => a.is_active !== false), fn = a => a.full_name.split(' ')[0];
  return new Map(act.map(a => [a.id, act.filter(x => fn(x) === fn(a)).length > 1 ? `${fn(a)} ${(a.full_name.split(' ')[1] || '')[0] || ''}.` : fn(a)])); };

// ---- Copy for Google Sheets (R-336, Nate: "copy out to Excel / Google Sheets"): every bill in the list (as Export, folded
// groups and rows behind "Show all" too), in the order and with the columns shown, as tab-separated plain words with a
// header row, which both paste into cells as they are. ----
const COPY_LABEL = 'Copy for Google Sheets';
const plain = h => { const d = document.createElement('div'); d.innerHTML = String(h ?? ''); return d.textContent.replace(/\s+/g, ' ').trim(); };
function copyValue(k, b) {
  switch (k) {
    case 'bill': return numWords(b);
    case 'title': return SHOWN_COLS.some(([k]) => k === 'nick') ? summaryOf(b) : fullTitle(b);
    case 'where': { const [a, c] = whereCell(b); return [plain(a), plain(c)].filter(Boolean).join(', '); }
    case 'next': { const c = nextCell(b); return c[2] ? plain(c[2]) : [plain(c[0]), plain(c[1])].filter(Boolean).join(' '); }
    case 'pos': return b.position ? POS_WORD[b.position] || b.position : posWord('');
    case 'own': { const o = ownerOf(b); return o ? teamName(o) : 'No owner'; }
    case 'pri': return b.priority ? PRI_WORD[b.priority] || 'Standard' : '';
    case 'nick': return b.nickname || '';
    case 'cmte': return (b.referrals || []).map(x => committeeName(x)).join(', then ');
    case 'coal': return coalNames(b);
    case 'last': return [b.last_action_date ? fmtDate(b.last_action_date) : '', b.last_action || ''].filter(Boolean).join(' ');
    case 'pulse': return pulseText(b);
  }
  return '';
}
export function sheetText() {
  const rows = listInOrder(), cols = SHOWN_COLS.length ? SHOWN_COLS : COLS.filter(c => c.label && !c.opt).map(c => [c.k, c.label]);
  const cellOf = t => String(t ?? '').replace(/[\t\r\n]+/g, ' ').trim();
  return { n: rows.length, text: [cols.map(([, l]) => l), ...rows.map(b => cols.map(([k]) => cellOf(copyValue(k, b))))].map(r => r.join('\t')).join('\n') };
}
async function copySheet() {
  const { n, text } = sheetText();
  if (!n) return toast('No bills are shown, so there is nothing to copy.');
  let ok = false;
  try { await navigator.clipboard.writeText(text); ok = true; } catch { /* below: the older way */ }
  if (!ok) { const t = document.createElement('textarea'); t.value = text; t.setAttribute('readonly', ''); t.style.cssText = 'position:fixed;left:-9999px;top:0';
    document.body.appendChild(t); t.select(); try { ok = document.execCommand('copy'); } catch { ok = false; } t.remove(); }
  toast(ok ? `Copied ${n} bill${n === 1 ? '' : 's'}. Paste into Google Sheets or Excel.` : 'This browser would not copy. Use Export for a spreadsheet file.', ok ? { ok: true } : { err: true });
}

// ---- drawing and wiring ----
// The whole page again, keeping the reader where they were: the same scroll, the focus back on the same control.
function repaint(focusSel, fallback = '[data-filter]') {
  const y = scrollY; hooks.render(); if (scrollY !== y) scrollTo(0, y);
  if (focusSel) (document.querySelector(focusSel) || document.querySelector(fallback))?.focus({ preventScroll: true });
}
let ROOT = null, longAt = 0, fixing = false;
// Only what the list shows (typing in the box keeps its focus, caret and keyboard).
function repaintDyn() {
  const page = document.querySelector('main .bl-page:not(.bl-muted)'); if (!page) return;
  const p = parts();
  page.querySelector('#bl-lead').innerHTML = p.lead;
  page.querySelector('#bl-chips').innerHTML = p.chips;
  page.querySelector('#bl-dyn').innerHTML = p.body;
  wireDyn(page); measureStick();
  const inner = ROOT?.querySelector('.actionbar .inner'); if (inner) { inner.innerHTML = bulkBar(); wireBulkBar(ROOT); }
}
function measureStick() {
  const page = document.querySelector('.bl-page'), st = page?.querySelector('.bl-stick'); if (!st) return;
  page.style.setProperty('--bl-sh', (tableOn() ? Math.round(st.getBoundingClientRect().height) : 0) + 'px');
}
const newTab = num => window.open(`${location.pathname}${location.search}#/bill/${encodeURIComponent(num)}`, '_blank', 'noopener');

// ---- the picked bill (V17): beside the list from 1100px, its own page below; Back closes it and keeps the scroll ----
const dockNow = () => matchMedia('(min-width: 1100px)').matches;
function docked() { const v = bl(); return !!v.look && tableOn() && dockNow() && !v.selecting && S.bills.some(b => b.id === v.look); }
// The rows (or table rows) on screen, in order, and the bill each is.
const rowEls = () => tableOn() ? [...document.querySelectorAll('.bl-table tr[data-row]')] : [...document.querySelectorAll('.bl-page .bl-groups .v6-row[data-v6row]')];
const idOf = el => el?.dataset.row || el?.dataset.v6row || '';
const focusTarget = el => el?.querySelector('a[data-bill], a.v6-row-main, button.v6-row-main');
function markRow(focus) {
  const v = bl(), rows = rowEls(), dk = docked(); const tr = rows.find(r => idOf(r) === v.cur);
  rows.forEach(r => { r.classList.toggle('bl-cur', r === tr); if (tableOn()) { const lk = dk && idOf(r) === v.look; r.classList.toggle('bl-look', lk); lk ? r.setAttribute('aria-current', 'true') : r.removeAttribute('aria-current'); } });
  if (tr) v.curAt = rows.indexOf(tr);
  if (tr && focus) { focusTarget(tr)?.focus({ preventScroll: true }); tr.scrollIntoView({ block: 'nearest' }); }
  return tr;
}
// The rows view's open bill: drawn into listDetail's panel (as wireListDetail would), with this screen's own keys.
function drawItem() {
  const v = bl(), box = document.querySelector('.bl-page [data-v6ld="bills"]'); if (!box) return repaintDyn();
  const b = v.look ? S.bills.find(x => x.id === v.look) : null, aside = box.querySelector('.v6-ld-detail');
  box.classList.toggle('open', !!b);
  box.querySelectorAll('.v6-row').forEach(r => { const on = !!b && r.dataset.v6row === b.id; r.classList.toggle('sel', on); r.classList.remove('hint'); r.querySelector('[data-v6pick]')?.toggleAttribute('aria-current', on); });
  document.querySelector('.bl-page')?.classList.toggle('bl-itemopen', !!b);
  if (!b) { box.querySelector('.v6-row')?.classList.add('hint'); aside.innerHTML = `<p class="v6-ld-empty">${icon('arrow-left')}<span>Pick one to see its steps</span></p>`; return; }
  aside.innerHTML = `<button type="button" class="v6-ld-back" data-v6ldback>${icon('chevron-left')}<span>Back to the bills</span></button>${itemHTML(b)}`;
  aside.scrollTop = 0; wireItem(aside);
}
function wireItem(el) {
  if (!el) return;
  el.querySelectorAll('[data-v6ldback], [data-bldclose]').forEach(x => x.onclick = () => closeItem());
  routeLinks(el.querySelectorAll('a[href^="#/"]'));
}
// Links drawn after the frame wired the page (a redraw of the list, the open bill): routed as the frame routes them, and a
// bill's link hands its page the list's order for Previous and Next.
function routeLinks(list) {
  list.forEach(a => { if (a.dataset.blw) return; a.dataset.blw = '1';
    a.addEventListener('click', e => { if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.defaultPrevented) return; e.preventDefault(); if (a.dataset.bill) S.billNav = NAV.slice(); S.go(a.getAttribute('href')); }); });
}
function pickBill(id, { keys = false } = {}) {
  const v = bl(), b = S.bills.find(x => x.id === id); if (!b) return;
  if (tableOn()) {
    if (!dockNow()) { v.cur = id; markRow(false); return lookAtRow(id); }
    const was = docked(); v.look = id; v.cur = id; v.keys = keys;
    if (!was) S.panelOpened?.(() => closeItem({ fromBack: true }));
    if (!was) { repaintDyn(); markRow(keys); rowEls().find(r => idOf(r) === id)?.scrollIntoView({ block: 'nearest' }); return; }
    const el = document.querySelector('.bl-dock');
    if (el) { el.innerHTML = itemHTML(b); wireItem(el); } else repaintDyn();
    markRow(keys); return;
  }
  const was = !!v.look;
  if (!was) { v.y = scrollY; S.panelOpened?.(() => closeItem({ fromBack: true })); }
  v.look = id; v.cur = id; v.keys = keys; drawItem(); markRow(false);
  if (dockNow()) { if (keys) rowEls().find(r => idOf(r) === id)?.scrollIntoView({ block: 'nearest' }); }
  else window.scrollTo(0, 0);
  const h = document.getElementById('bl-item-h'); if (h && (!dockNow() || !keys)) h.focus({ preventScroll: true });
}
function closeItem({ fromBack = false } = {}) {
  const v = bl(), id = v.look; if (!id) return;
  v.look = null;
  if (tableOn()) { const y = scrollY; repaintDyn(); scrollTo(0, y); }
  else { drawItem(); if (!dockNow()) window.scrollTo(0, v.y || 0); }
  if (!fromBack) S.panelClosed?.();
  const row = rowEls().find(r => idOf(r) === id); focusTarget(row)?.focus({ preventScroll: true });
}
function lookAtRow(id) {
  const m = new Map(S.bills.map(b => [b.id, b])), list = NAV.map(x => m.get(x)).filter(Boolean), i = list.findIndex(b => b.id === id);
  const b = m.get(id); if (!b) return;
  openLook(b, { list: list.length ? list : [b], index: Math.max(0, i), from: 'bills' });
}
const openBill = id => { const b = S.bills.find(x => x.id === id); if (!b) return; S.billNav = NAV.slice(); S.go(billRoute(b)); };
function moveRow(step) {
  const v = bl(), rows = rowEls(); if (!rows.length) return;
  let i = rows.findIndex(r => idOf(r) === v.cur);
  if (i < 0) i = v.curAt == null ? (step > 0 ? -1 : rows.length) : Math.min(v.curAt, rows.length) - (step > 0 ? 1 : 0);
  const to = rows[Math.max(0, Math.min(rows.length - 1, i + step))];
  if (v.look && !v.selecting && (dockNow() || !tableOn())) return pickBill(idOf(to), { keys: true });   // the open bill follows the marker
  v.cur = idOf(to); v.keys = true; markRow(true);
}
function toggleSel(id) { const v = bl(); v.sel.has(id) ? v.sel.delete(id) : v.sel.add(id); v.cur = id; repaintDyn(); markRow(false); document.querySelector(`[data-blsel="${CSS.escape(id)}"], [data-sel="${CSS.escape(id)}"]`)?.focus({ preventScroll: true }); }
function wireDyn(page) {
  const v = bl();
  page.querySelectorAll('#bl-lead [data-ft], #bl-chips [data-ft]').forEach(el => el.onclick = () => { const spec = el.dataset.ft; toggle(spec); repaint(`#bl-chips [data-ft="${CSS.escape(spec)}"]`); });
  page.querySelectorAll('[data-fclearall]').forEach(el => el.onclick = () => { clearAll(); repaint('[data-filter]'); });
  page.querySelectorAll('[data-scopeall], [data-scopecoal]').forEach(el => el.onclick = () => { v.scope = el.hasAttribute('data-scopecoal') ? 'coal' : 'all'; changed(); repaint(`[data-seg="blscope"][data-val="${v.scope}"]`); });
  page.querySelectorAll('#bl-dyn [data-fold]').forEach(el => el.onclick = () => { v.folds[el.dataset.fold] = el.getAttribute('aria-expanded') !== 'true'; repaint(`[data-fold="${el.dataset.fold}"]`); });
  page.querySelectorAll('[data-full]').forEach(el => el.onclick = () => { const k = el.dataset.full; (v.full ??= {})[k] = !v.full[k]; repaint(`[data-full="${k}"]`); });
  page.querySelectorAll('[data-selall]').forEach(el => el.onclick = () => { if (el.dataset.selall === 'all') NAV.forEach(id => v.sel.add(id)); else NAV.forEach(id => v.sel.delete(id)); repaint('[data-selall]'); });
  page.querySelectorAll('[data-blsel]').forEach(el => el.onclick = () => toggleSel(el.dataset.blsel));
  page.querySelectorAll('[data-blselect]').forEach(el => el.onclick = () => { v.look = null; startSelect(); });
  routeLinks(page.querySelectorAll('#bl-dyn a[href^="#/"]:not([data-v6pick]), #bl-lead a[href^="#/"]'));
  const box = page.querySelector('[data-v6ld="bills"]');
  if (box) {
    // A row's plain click opens it beside the list. Taken in the capture phase, before the frame's own link handler (which
    // would open the bill's page): Cmd, Ctrl or Shift, the middle button and a keyboard's Enter still open the page (F96).
    box.addEventListener('click', e => {
      const p = e.target.closest('[data-v6pick]'); if (!p || e.target.closest('.v6-row-act')) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button > 0) return;
      if (e.detail === 0) { S.billNav = NAV.slice(); return; }
      if (Date.now() - longAt < 600) { e.preventDefault(); e.stopPropagation(); return; }
      e.preventDefault(); e.stopPropagation(); pickBill(p.dataset.v6pick);
    }, true);
    wireItem(box.querySelector('.v6-ld-detail'));
    // A phone: press and hold a row to start picking with it.
    let t = null, x0 = 0, y0 = 0;
    const cancel = () => { clearTimeout(t); t = null; };
    box.addEventListener('pointerdown', e => { const row = e.target.closest('.v6-ld-list [data-v6pick]'); if (!row || e.button > 0 || e.pointerType === 'mouse') return; x0 = e.clientX; y0 = e.clientY;
      t = setTimeout(() => { t = null; longAt = Date.now(); navigator.vibrate?.(12); v.look = null; startSelect(row.dataset.v6pick); }, 520); });
    box.addEventListener('pointermove', e => { if (t && Math.hypot(e.clientX - x0, e.clientY - y0) > 10) cancel(); });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(k => box.addEventListener(k, cancel));
    box.addEventListener('contextmenu', e => { if (e.target.closest('.v6-ld-list .v6-row') && Date.now() - longAt < 1000) e.preventDefault(); });
  }
  const tbl = page.querySelector('.bl-table');
  if (!tbl) { markRow(v.keys && keyFocusLost()); return; }
  const dock = page.querySelector('.bl-dock'); if (dock) wireItem(dock);
  // The widths were worked out for the room the frame should give; if the real box differs, lay it out once more.
  const real = (page.querySelector('.bl-main') || page.querySelector('#bl-dyn')).clientWidth - 2;
  if (!fixing && real > 0 && Math.abs(real - tableAvail()) > 1) { MEASURED = { key: measureKey(), avail: real }; fixing = true; try { repaintDyn(); } finally { fixing = false; } return; }
  const all = tbl.querySelector('#bl-all'), boxes = [...tbl.querySelectorAll('[data-sel]')];
  if (all) { const n = boxes.filter(b => b.checked).length; all.indeterminate = n > 0 && n < boxes.length;
    all.onchange = () => { boxes.forEach(b => all.checked ? v.sel.add(b.dataset.sel) : v.sel.delete(b.dataset.sel)); repaint('#bl-all'); }; }
  boxes.forEach((el, i) => el.onclick = e => {
    const on = el.checked, from = e.shiftKey && lastBox != null ? Math.min(lastBox, i) : i, to = e.shiftKey && lastBox != null ? Math.max(lastBox, i) : i;
    for (let j = from; j <= to; j++) on ? v.sel.add(boxes[j].dataset.sel) : v.sel.delete(boxes[j].dataset.sel);
    lastBox = i; v.cur = el.dataset.sel; repaint(`[data-sel="${el.dataset.sel}"]`);
  });
  tbl.querySelectorAll('[data-sort]').forEach(el => el.onclick = () => { const k = el.dataset.sort, s = v.sort; v.sort = s && s[0] === k ? (s[1] > 0 ? [k, -1] : null) : [k, 1]; repaint(`[data-sort="${k}"]`); });
  tbl.querySelectorAll('[data-edit]').forEach(el => el.onclick = () => { v.cur = el.dataset.id; markRow(false); editCell(el.dataset.edit, el.dataset.id); });
  const rowOf = e => { const tr = e.target.closest('tr[data-row]'); return tr && !e.target.closest('a, button, input, label, select') ? tr : null; };
  // A click on a row opens its bill: beside the table from 1100px, as a quick look from 900 to 1099px; picking, it ticks the
  // row. The bill number is a link and acts as one with Cmd or Ctrl, the middle button or the keyboard's Enter.
  const plainLink = e => e.detail > 0 && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && e.target.closest('a[data-bill]');
  tbl.addEventListener('click', e => { if (plainLink(e)) { e.preventDefault(); e.stopPropagation(); onRowClick(e); } }, true);
  tbl.addEventListener('click', e => { if (!plainLink(e)) onRowClick(e); });
  function onRowClick(e) {
    const a = e.target.closest('a[data-bill]'), tr = a && plainLink(e) ? a.closest('tr[data-row]') : rowOf(e);
    if (a && !tr) { v.cur = a.dataset.bill; S.billNav = NAV.slice(); return; }
    if (!tr || getSelection()?.toString()) return;
    v.cur = tr.dataset.row;
    if (e.metaKey || e.ctrlKey) { markRow(false); newTab(tr.dataset.num); return; }
    if (v.selecting) { const id = tr.dataset.row; v.sel.has(id) ? v.sel.delete(id) : v.sel.add(id); lastBox = boxes.findIndex(b => b.dataset.sel === id); repaint(`[data-sel="${CSS.escape(id)}"]`); return; }
    pickBill(tr.dataset.row);
  }
  tbl.addEventListener('dblclick', e => { const tr = rowOf(e) || (plainLink(e) && e.target.closest('tr[data-row]')); if (tr && docked() && v.look === tr.dataset.row) { getSelection()?.removeAllRanges(); openBill(tr.dataset.row); } });
  tbl.addEventListener('auxclick', e => { const tr = e.button === 1 && rowOf(e); if (tr) { e.preventDefault(); newTab(tr.dataset.num); } });
  tbl.addEventListener('pointerdown', () => { v.keys = false; });
  markRow(v.keys && keyFocusLost());
  holdHead();
  const sb = page.querySelector('.bl-tscroll');
  if (sb) { if (v.sx) sb.scrollLeft = v.sx; edgeCue(sb); sb.addEventListener('scroll', () => { v.sx = sb.scrollLeft; edgeCue(sb); }, { passive: true }); }
}
const keyFocusLost = () => { const at = document.activeElement; return !at || at === document.body || at.id === 'main' || !at.isConnected; };
let lastBox = null;
function stickBottom() {
  const st = document.querySelector('.bl-page .bl-stick');
  if (st && getComputedStyle(st).position === 'sticky') return Math.max(0, Math.round(st.getBoundingClientRect().bottom));
  return Math.max(0, Math.round(document.querySelector('.sv-hdr')?.getBoundingClientRect().bottom || 64));
}
// In the sideways-scrolling table neither the column headers nor the group rows can use position: sticky (their scroll box
// is the table's, not the window's), so both are held by hand while the table is on screen.
function holdHead() {
  const box = document.querySelector('.bl-tscroll'), head = box?.querySelector('thead'); if (!head) return;
  const top = stickBottom(), r = box.getBoundingClientRect(), hh = head.offsetHeight;
  const dy = Math.round(Math.max(0, Math.min(top - r.top, r.height - hh - 56)));
  box.style.setProperty('--bl-hy', dy + 'px'); box.classList.toggle('bl-held', dy > 0);
  for (const tb of box.querySelectorAll('tbody.bl-tg')) {
    const g = tb.querySelector('.bl-grb'); if (!g) continue;
    const rb = tb.getBoundingClientRect(), gh = g.offsetHeight;
    const d = Math.round(Math.max(0, Math.min(top + hh - rb.top, rb.height - gh)));
    g.style.transform = d ? `translateY(${d}px)` : '';
    g.classList.toggle('bl-held', d > 0);
  }
}
function edgeCue(box) { box.parentElement?.classList.toggle('bl-end', box.scrollLeft + box.clientWidth >= box.scrollWidth - 2); }

// ---- arriving with a step to take (More tools, spec 3.5): #/bills?select=1 starts picking, ?views=1 opens the saved views
// (or, with none yet, the Filter sheet at Save this view), ?export=1 opens Export; ?coalition=<id or slug> opens every bill of
// one coalition (the coalition page's link, R-022). The address then goes back to plain #/bills, so a reload does not repeat it.
function arrival(route) {
  const q = route.q || {}, any = q.select || q.views || q.export || q.coalition; if (!any) return null;
  if (q.coalition) {
    const c = S.campaigns.find(x => x.id === q.coalition || x.slug === q.coalition);
    if (c) openCoalition(c.id); else setTimeout(() => toast('That coalition is not in the tracker, so this is your usual list.'), 0);
  }
  try { history.replaceState(history.state, '', '#/bills'); } catch { /* the list still opens */ }
  if (route.q) route.q = {};
  return () => {
    if (q.select) { bl().look = null; startSelect(); }
    else if (q.views) { if (views().length) openEditViews(() => repaintDyn()); else openFilters(document.querySelector('main [data-filter]'), { focus: 'save' }); }
    else if (q.export) exportSheet();
  };
}

export default {
  tab: 'bills',
  title: r => r.muted ? 'Muted bills' : 'Bills',
  wide: r => !r.muted,
  narrow: r => !!r.muted,
  render(route) {
    clampScope();
    const v = bl();
    loadSortCount(() => { if (S.route?.name === 'bills') refreshTabs(route.muted ? 'muted' : 'bills'); });
    if (route.muted) { dropSelect(); const html = renderMuted(); v.lastMuted = true; return html; }
    // Picking belongs to the list: arriving from any other page starts without it.
    if ((document.body.dataset.screen || 'bills') !== 'bills' || v.lastMuted) { dropSelect(); v.edited = false; }
    v.lastMuted = false;
    this._after = arrival(route);
    const p = parts();
    return `<div class="bl-page ${tableOn() ? 'bl-tablev' : 'bl-rowsv'}${v.look && !tableOn() ? ' bl-itemopen' : ''}">${billsHead('bills')}<div id="bl-lead">${p.lead}</div>
      <div class="bl-stick">${toolbar()}<div id="bl-chips">${p.chips}</div></div><div id="bl-dyn">${p.body}</div></div>`;
  },
  bar(route) {
    if (route.muted) return '';
    return wideNow() || bl().selecting ? bulkBar() : '';
  },
  wire(route, root) {
    ROOT = root;
    const page = root.querySelector('.bl-page'); if (!page) return;
    if (route.muted) return wireMuted(page);
    const v = bl();
    // Back from a bill's page puts the focus on the row that opened it (spec 7.10, B-4), not on the page: the bill opened
    // by a row is remembered, and Back (popstate, a moment ago) finds its row again.
    page.addEventListener('click', e => { const a = e.target?.closest?.('a[data-bill]'); if (a) S.blLast = a.dataset.bill; }, true);
    if (S.blLast && Date.now() - BACK_AT < 2000) { const a = page.querySelector(`a[data-bill="${CSS.escape(S.blLast)}"]`); if (a) a.focus({ preventScroll: true }); }
    // A step taken in the open bill redraws the list and keeps the bill open; once Bills is left, the page that is showing.
    wireSteps(root, { after: () => document.querySelector('main .bl-page:not(.bl-muted) #bl-dyn') ? repaintDyn() : hooks.render() });
    wireDyn(page);
    wireBulkBar(root);
    if (v.look && history.state?.panel) S.panelOpened?.(() => closeItem({ fromBack: true }));   // back on the entry where a bill was open
    page.addEventListener('click', e => { if (e.target.closest('a[data-bill]')) S.billNav = NAV.slice(); }, true);
    page.querySelectorAll('[data-seg="blscope"]').forEach(el => el.onclick = () => { if (v.scope === el.dataset.val) return; v.scope = el.dataset.val; v.look = null; changed(); repaint(`[data-seg="blscope"][data-val="${v.scope}"]`); });
    page.querySelectorAll('[data-blview]').forEach(el => el.onclick = () => { setMode(el.dataset.blview); repaint(`[data-blview="${el.dataset.blview}"]`); });
    page.querySelector('[data-blmenu]')?.addEventListener('click', () => menuSheet({ title: 'This list', items: [
      tableOn() ? { label: 'Show as rows', icon: 'rows-3', sub: 'Two-line rows, grouped by where they stand', run: () => { setMode('rows'); repaint('[data-blmenu]'); } }
        : { label: 'Show as a spreadsheet', icon: 'table-2', sub: 'Every column, sorted and edited in place; it scrolls sideways in its own box', run: () => { setMode('table'); repaint('[data-blmenu]'); } },
      // Below 600px the spreadsheet's tools live here (A-20 on v6: the phone has no room for their line).
      tableOn() ? { label: 'Columns', icon: 'columns-3', sub: 'Pick the columns, and compact or roomy rows', run: () => columnsSheet(page.querySelector('[data-blmenu]')) } : null,
      { label: 'Export', icon: 'download', sub: 'These bills, with your filters, as a spreadsheet file', run: () => exportSheet() },
      tableOn() ? { label: COPY_LABEL, icon: 'copy', sub: 'Every bill in this list, ready to paste', run: () => copySheet() } : null] }));
    const qi = page.querySelector('#bl-q'), qx = page.querySelector('[data-qclear]');
    qi.oninput = () => { v.q = qi.value; v.folds = {}; qx.hidden = !qi.value; repaintDyn(); };
    qi.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); qi.blur(); } if (e.key === 'Escape' && qi.value) { e.stopPropagation(); qi.value = ''; qi.oninput(); } };
    qx.onclick = () => { qi.value = ''; qi.oninput(); qi.focus(); };
    page.querySelector('[data-filter]').onclick = e => openFilters(e.currentTarget);
    const cols = page.querySelector('[data-cols]'); if (cols) cols.onclick = e => columnsSheet(e.currentTarget);
    const cp = page.querySelector('[data-copy]'); if (cp) cp.onclick = () => copySheet();
    const ex = page.querySelector('[data-export]'); if (ex) ex.onclick = () => exportSheet();
    measureStick();
    STICK?.disconnect();
    const st = page.querySelector('.bl-stick');
    if (st && typeof ResizeObserver === 'function') { STICK = new ResizeObserver(() => measureStick()); STICK.observe(st); }
    const after = this._after; this._after = null; if (after) setTimeout(after, 0);
  },
};
let STICK = null;

// v5's phone row, kept for search.js (its "Bills" results): the same parts as a v5 bill row.
export function blRow(b, { sub = '', href, selectable = false, selected = false } = {}) {
  const nick = b.nickname || '', sum = summaryOf(b);
  const inner = `${selectable ? `<span class="sv-check" aria-hidden="true">${icon(selected ? 'square-check-big' : 'square')}</span>` : ''}<span class="body"><span class="title bl-rt">${nick ? `<b class="bl-nk">${esc(nick)}</b> <span class="bn-num">${esc(billNum(b))}</span>` : `<b class="bn-num0">${esc(billNum(b))}</b>`} <span class="sv-t">${esc(sum)}</span></span>${sub ? `<span class="sub">${sub}</span>` : ''}</span>`;
  return href && !selectable ? `<a class="row sv-billrow bl-row" href="${esc(href)}" data-bill="${esc(b.id)}">${inner}</a>`
    : `<button type="button" class="row sv-billrow bl-row${selected ? ' sel' : ''}" data-bill="${esc(b.id)}" aria-pressed="${selected ? 'true' : 'false'}">${inner}</button>`;
}

// Once for the app (the frame redraws the page at 900px and 1100px): the table's widths on a resize, the keys, and a press
// and hold must not also count as a tap on the row that appears under the finger.
if (typeof window !== 'undefined') {
  let rz = 0, lastW = innerWidth;
  addEventListener('resize', () => { if (innerWidth === lastW) return; lastW = innerWidth; clearTimeout(rz); rz = setTimeout(() => { if (S.route?.name === 'bills' && !S.route.muted && tableOn() && !document.querySelector('dialog[open]') && !document.activeElement?.matches?.('input')) repaint(); }, 200); });
  addEventListener('scroll', () => { if (S.route?.name !== 'bills') return; if (document.querySelector('.bl-tscroll')) holdHead(); }, { passive: true });
  // Every key here is a shortcut, so each waits for keysOn() (My settings can switch them off), is ignored while someone types
  // or a sheet is open, and leaves "g then a letter" to the frame.
  let lastG = 0;
  document.addEventListener('keydown', e => {
    if (!keysOn() || S.route?.name !== 'bills' || !S.bl || e.metaKey || e.ctrlKey || e.altKey || document.querySelector('dialog[open]')) return;
    if (e.key === 'Escape') {
      if (typingIn(e.target) || S.route.muted) return;
      // One thing at a time: the open bill closes first, then picking ends.
      if (S.bl.look && (!tableOn() || docked())) { e.preventDefault(); closeItem(); return; }
      if (S.bl.selecting) stopSelect(); else if (S.bl.sel.size && wideNow()) { S.bl.sel.clear(); repaint(); }
      return;
    }
    if (S.route.muted || !wideNow() || !hoverNow() || typingIn(e.target) || e.repeat && !/^([jk]|ArrowDown|ArrowUp)$/i.test(e.key)) return;
    if (e.key === 'g') { lastG = Date.now(); return; }
    if (Date.now() - lastG < 1200) return;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key, v = S.bl, tr = rowEls().find(r => idOf(r) === v.cur);
    const inItem = !!e.target?.closest?.('.bl-dock, .v6-ld-detail'), onControl = !!e.target?.closest?.('a, button, input, select, textarea, summary, [role="button"]');
    if (k === 'j' || k === 'k') { e.preventDefault(); moveRow(k === 'j' ? 1 : -1); }
    else if ((k === 'ArrowDown' || k === 'ArrowUp') && v.look && !inItem) { e.preventDefault(); moveRow(k === 'ArrowDown' ? 1 : -1); }
    // Space or o on the marked row: its bill beside the list; again, and it closes. It changes nothing, so one key is safe.
    else if ((k === ' ' || k === 'o') && tr && !inItem && !(k === ' ' && e.target?.closest?.('button, [role="button"], summary'))) { e.preventDefault(); v.keys = true;
      if (v.selecting) return toggleSel(idOf(tr));
      if (v.look === idOf(tr) && (!tableOn() || docked())) closeItem(); else pickBill(idOf(tr), { keys: true }); }
    else if (k === 'x' && tr) { e.preventDefault(); v.keys = true; if (!v.selecting) { v.look = null; startSelect(v.cur); } else toggleSel(v.cur); }
    // Enter on the page itself (or in the open bill away from its links) opens the bill's page.
    else if (k === 'Enter' && (e.target === document.body || e.target.id === 'main' || inItem && !onControl)) {
      const id = v.look || idOf(tr); if (id) { e.preventDefault(); openBill(id); } }
  });
  document.addEventListener('pointerup', () => { if (longAt) setTimeout(() => { longAt = 0; }, 350); }, true);
  document.addEventListener('click', e => { if (longAt && Date.now() - longAt < 600 && S.route?.name === 'bills') { e.preventDefault(); e.stopPropagation(); longAt = 0; } }, true);
}
