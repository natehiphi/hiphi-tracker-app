// Staff7 All bills (R-398): one table of the bills, at #/issues/bills, opened from the row under "The session" on Issues. It opens on Mine, with the Issues switch (Mine, A teammate, Everyone).
// WHAT IS IN IT: Mine is the bills on the issues Issues' own Mine list shows (issues.js setFor) PLUS any bill the person leads that is on no issue; a teammate's view is the same rule for that person;
// Everyone is every tracked bill. Six columns in Everyone (Bill, Position, Lead, Coalition, Where it is, Next date), five in Mine and a teammate's view (Lead is the person, so it is left out; a bill led by
// someone else says "Led by Kris" under its name). Position is bold text; the issue is a small link under the bill only when its name differs from the bill's.
// THE WORDS come from the app's own functions, so this table and the other pages never disagree: the deadline a bill is judged against is the one the Issues list uses for the same view (sessionOf(set).next),
// always passed to deadlineCell (a bill that cleared it is never amber); where a bill is, place.js (placeOf: two lines, line 1 its state, line 2 its committee; the same words on every page); a stopped bill's date, issue_table.js stoppedDate; Next date, nextDateOf below.
// STATE lives in the address (?who= pos coal st q sort dir), so a reload and Back keep the view; a key, a choice or a sort changes the address with replaceState and draws only the table (focus never moves).
// Nothing here writes anything.
import { S, POSITIONS, SESSION_YEAR } from '../staff6/data.js';
import { stopOf, hearingAhead } from '../staff6/model.js';
import { ic } from './icons7.js';
import { esc } from './parts.js';
import { billName, billNo, posWords, first } from './steps.js';
import { isAlive, deadlineOf } from './standing.js';
import { leadIds } from './bill_words.js';
import { deadlineCell, signalOf, markHTML, nameFor, legendHead, SIGNAL_ORDER } from './bill_cell.js';
import { stoppedWhy, stoppedDateOf } from './issue_table.js';
import { placeOf, cellOf, lineOf, placeLine, placeCompare } from './place.js';
import { stoppedISO } from './bill.js';
import { norm, matchWords } from './find.js';
import { whoOf, setFor, sessionOf, eCig, hearTxt, byWords, sameName, issueHref, billHref, ui as issuesUi } from './issues.js';

const enc = encodeURIComponent;
const n = (k, one, many) => `${k.toLocaleString('en-US')} ${k === 1 ? one : many}`;
export const ROUTE = /^#\/issues\/bills(\?|$)/;
const MINE = { kind: 'mine', code: '' };
const num = b => String(b.bill_number).replace(/\s/g, '');
const COLL = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });   // one collator: sorting 734 rows with localeCompare's options each time is slow
const byNo = (x, y) => COLL.compare(x.no, y.no);
const ts = d => new Date(String(d).slice(0, 10) + 'T12:00:00-10:00').getTime();
const camName = c => c.public_name || c.name;

// the module's own state: what is open that the address does not hold (the phone's Filters panel), the scroll of a table left for a bill, and what is on the screen now
const bui = { filt: false, scroll: new Map(), cur: null, tok: 0 };

// ---------------------------------------------------------------------------------- the set: which bills are in a view
const thisSession = b => b && b.tracked !== false && (!b.session_year || +b.session_year === +SESSION_YEAR);
// Every tracked bill of the session
export const trackedBills = () => (S.bills || []).filter(thisSession);
// The bills of a view, once each, with the issue each is shown under: { bills, set, ses, row, issueOf: Map(bill id -> issue) }. `who` is issues.js whoOf's answer for a good address.
export function billsFor(who, me) {
  const set = setFor(who, me), ses = sessionOf(set), issueOf = new Map(), seen = new Set(), bills = [];
  for (const x of set) for (const b of x.bills) if (!issueOf.has(b.id)) issueOf.set(b.id, x.issue);
  if (who.kind === 'all') bills.push(...trackedBills());
  else {
    const pid = (who.kind === 'person' ? who.person : me).id, onIssue = new Set((S.billIssues || []).filter(x => (S.issues || []).some(i => i.id === x.issue_id && !i.archived_at)).map(x => x.bill_id));
    for (const x of set) for (const b of x.bills) if (!seen.has(b.id)) { seen.add(b.id); bills.push(b); }   // the bills on the person's issues: exactly the set Issues' list uses
    for (const b of trackedBills()) if (!seen.has(b.id) && !onIssue.has(b.id) && leadIds(b, null).includes(pid)) { seen.add(b.id); bills.push(b); }   // plus a bill the person leads that is on no issue
  }
  if (who.kind === 'all') for (const b of bills) if (!issueOf.has(b.id)) { const x = (S.billIssues || []).find(y => y.bill_id === b.id), i = x && (S.issues || []).find(z => z.id === x.issue_id && !z.archived_at); if (i) issueOf.set(b.id, i); }
  return { bills, set, ses, row: ses.next ? ses.next.row : null, issueOf };
}
// "76 mine" on the Issues row: how many bills Mine holds for this person
export const mineCount = me => billsFor(MINE, me).bills.length;

// ---------------------------------------------------------------------------------- one bill's cells, from the shared functions
// Next date: { text, sig (the mark: bill_cell.js signalOf), amber (risk or soon only), quiet, key (when, in ms, for sorting; null when the app has no date), stop (a stopped bill: the Capitol's date it stopped, YYYY-MM-DD) }
// An alive bill: its hearing ("Hearing today 1:10 PM"), else the date its hearing must happen by ("by Mon, Mar 30 · 14 days"), always with the date. The mark comes first in the cell, from signalOf alone.
// A stopped bill: a quiet "Stopped Feb 11" (a deferred bill keeps that, and carries the dying mark until its deadline passes).
export function nextDateOf(b, row, w = null) {
  const sig = signalOf(b, row), amber = sig === 'risk' || sig === 'soon';
  if (!isAlive(b)) { const x = w || stoppedWhy(b); return { text: x.date ? stoppedDateOf(x) : '', sig, amber: false, quiet: true, key: null, stop: stoppedISO(b) }; }
  const c = deadlineCell(b, row), st = stopOf(b);
  if (c.key === 'hearing' || c.key === 'late') { const h = hearingAhead(b); return { text: `${cap1(hearTxt(h.scheduled_at))}${c.key === 'late' ? ' · after the deadline' : ''}`, sig, amber, quiet: false, key: new Date(h.scheduled_at).getTime(), stop: '' }; }
  if (c.key === 'risk') { const d = String(deadlineOf(b).date).slice(0, 10); return { text: byWords(d), sig, amber, quiet: false, key: ts(d), stop: '' }; }
  const dl = st.deadline && !st.deadline.missed ? st.deadline : null;
  if (!dl) return { text: '', sig, amber, quiet: true, key: null, stop: '' };
  return { text: byWords(String(dl.date).slice(0, 10)), sig, amber, quiet: c.key !== 'need', key: ts(dl.date), stop: '' };
}
// Where it is: place.js, one line of text ("Waiting for a hearing · Senate Education (EDU)"); the table draws the same two lines (placeCell)
export const whereOf = (b, w = null) => placeLine(b, w);
const POS_RANK = b => { const i = POSITIONS.findIndex(p => p[0] === b.position); return !b.position || i < 1 ? 99 : b.position === 'monitor' ? 90 : i; };
const cap1 = t => t.charAt(0).toUpperCase() + t.slice(1);
const trimDot = t => String(t || '').replace(/\s+/g, ' ').trim().replace(/\.$/, '');

function recOf(b, v) {
  const issue = v.issueOf.get(b.id) || null, alive = isAlive(b), lids = leadIds(b, issue), name = billName(b), no2 = billNo(b), nick = !!String(b.nickname || '').trim();
  const cs = (S.billCampaigns?.[b.id] || []).map(id => (S.campaigns || []).find(c => c.id === id)).filter(Boolean);
  const lead = lids.length ? S.advocates.find(a => a.id === lids[0]) : null, desc = trimDot(eCig(b.description || b.title)), w = alive ? null : stoppedWhy(b), next = nextDateOf(b, v.row, w), place = placeOf(b, w);
  const head = nick ? eCig(name) : no2;
  return { b, no: num(b), alive, issue, lids, lead, leadName: lead ? first(lead) : '', leadMore: lids.length - 1, cs, camp: cs.length ? camName(cs[0]) : '', nick, head, no2, desc, name, row: v.row || null,
    pos: b.position || '', posRank: POS_RANK(b), place, where: lineOf(place), cell: cellOf(place), next,
    hay: ` ${norm(`${nick ? name : ''} ${no2} ${desc}`)}`, compact: norm(no2).replace(/ /g, '') };
}

// ---------------------------------------------------------------------------------- the address: the view, the filters and the sort
const COLS6 = [['bill', 'Bill'], ['pos', 'Position'], ['lead', 'Lead'], ['coal', 'Coalition'], ['where', 'Where it is'], ['next', 'Next date']];
const COLS5 = COLS6.filter(c => c[0] !== 'lead');
export const columnsFor = who => who.kind === 'all' ? COLS6 : COLS5;
const posOpts = () => [['', 'Any position'], ['with', 'With a position'], ...POSITIONS.filter(p => p[0]).map(p => [p[0], p[1]])];
const stOpts = [['', 'Alive and stopped'], ['alive', 'Alive'], ['stopped', 'Stopped']];
// The filters of an address, each checked: a value that is none of the choices is ignored (the page then says what it would say with none)
export function readQuery(q, who) {
  const g = k => q.get(k) || '', pos = posOpts().some(o => o[0] === g('pos')) ? g('pos') : '', coal = (S.campaigns || []).some(c => String(c.id) === g('coal')) ? g('coal') : '';
  return { pos, coal, st: g('st') === 'alive' || g('st') === 'stopped' ? g('st') : '', q: g('q').slice(0, 200), sort: columnsFor(who).some(c => c[0] === g('sort')) ? g('sort') : 'next', dir: g('dir') === 'desc' ? 'desc' : 'asc' };
}
// the query part of an address ("who=KR&st=alive"), only what is not the default
export function queryOf(who, f) {
  const q = new URLSearchParams();
  if (who.code) q.set('who', who.code);
  if (f.pos) q.set('pos', f.pos); if (f.coal) q.set('coal', f.coal); if (f.st) q.set('st', f.st); if (f.q) q.set('q', f.q);
  if (f.sort && f.sort !== 'next') q.set('sort', f.sort); if (f.dir === 'desc') q.set('dir', 'desc');
  return q.toString();
}
export const hrefOf = (who, f) => { const q = queryOf(who, f); return `#/issues/bills${q ? `?${q}` : ''}`; };
const anyFilter = f => !!(f.pos || f.coal || f.st || f.q);
const noFilter = f => ({ ...f, pos: '', coal: '', st: '', q: '' });
// Where Back from a bill goes (bill.js): the table with the query the bill's address carried (`bq`), read again through the same checks, so the address can never put anything else on the page
export function backHref(bq) {
  const p = new URLSearchParams(String(bq || '').slice(0, 400)), q = new URLSearchParams();
  for (const k of ['who', 'pos', 'coal', 'st', 'q', 'sort', 'dir']) if (p.get(k)) q.set(k, p.get(k).slice(0, 200));
  const s = q.toString(); return `#/issues/bills${s ? `?${s}` : ''}`;
}
// the address of a bill's page from this table: from=bills, and the table's own query so Back comes home to it
const billLink = (who, f, r) => `${billHref(who, r.b, r.issue ? r.issue.id : '', 'bills')}&bq=${enc(queryOf(who, f))}`;

// ---------------------------------------------------------------------------------- the rows: filter, find, sort
function matches(r, f) {
  if (f.pos && (f.pos === 'with' ? !(r.pos && r.pos !== 'monitor') : r.pos !== f.pos)) return false;
  if (f.coal && !r.cs.some(c => String(c.id) === f.coal)) return false;
  if (f.st === 'alive' && !r.alive) return false;
  if (f.st === 'stopped' && r.alive) return false;
  return true;
}
// A typed word must START a word of the name, number or description (case, accents and punctuation do not matter; "vape" finds e-cigarettes, as in the Issues find: find.js matchWords); every word must be found.
// A query that is a bill number ("SB 11", "sb11") is read as a number only, so the two spellings find the same bills: the numbers that start with it.
const NUMQ = /^[a-z]{1,4}\d+$/;
const findWords = q => { const ws = matchWords(q); return ws.length ? ws : norm(q).split(' ').filter(Boolean).slice(0, 8).map(w => [w]); };   // one letter is not enough for the Issues find; here it still narrows
const found = (r, ws, qc) => NUMQ.test(qc) ? r.compact.startsWith(qc) : ws.every(alts => alts.some(w => r.hay.includes(` ${w}`)));
// an empty cell sorts last in either direction
const emptyLast = (a, b, dir, cmp) => (!a && !b) ? 0 : !a ? 1 : !b ? -1 : dir * cmp(a, b);
const txt = (a, b) => COLL.compare(a, b);
const PRIMARY = {
  // Bill: the bills with our own name first (A to Z), then the bills shown by their number, in number order (HB before SB); descending turns each group round, the groups stay
  bill: (x, y, d) => (x.nick ? 0 : 1) - (y.nick ? 0 : 1) || d * txt(x.head, y.head),
  pos: (x, y, d) => d * (x.posRank - y.posRank),
  lead: (x, y, d) => emptyLast(x.leadName, y.leadName, d, txt),
  coal: (x, y, d) => emptyLast(x.camp, y.camp, d, txt),
  // Where it is: the journey order (place.js), ties by the committee's text; the bill number is the last tie (sortRecs)
  where: (x, y, d) => d * placeCompare(x.place, y.place),
  // Next date: bills with a date (soonest first), then alive bills with none, then stopped bills (most recently stopped first). Descending turns each group round, the groups stay where they are (alive before stopped).
  next: (x, y, d) => { const g = r => r.alive ? (r.next.key == null ? 1 : 0) : 2; return g(x) - g(y) || (g(x) === 0 ? d * (x.next.key - y.next.key) : g(x) === 2 ? d * String(y.next.stop).localeCompare(String(x.next.stop)) : 0); },
};
// Sorting never reorders two bills that tie: alive comes before stopped, then the bill number
export function sortRecs(list, sort, dir) {
  const d = dir === 'desc' ? -1 : 1, p = PRIMARY[sort] || PRIMARY.next;
  return list.slice().sort((x, y) => p(x, y, d) || (x.alive ? 0 : 1) - (y.alive ? 0 : 1) || byNo(x, y));
}
export function rowsFor(recs, f) {
  let rs = recs.filter(r => matches(r, f));
  const ws = findWords(f.q), qc = norm(f.q).replace(/ /g, '');
  if (ws.length) rs = rs.filter(r => found(r, ws, qc));
  rs = sortRecs(rs, f.sort, f.dir);
  if (ws.length) { const ex = rs.filter(r => r.compact === qc); if (ex.length) rs = [...ex, ...rs.filter(r => r.compact !== qc)]; }   // an exact bill number comes first ("SB 11" before SB 1120)
  return rs;
}

// ---------------------------------------------------------------------------------- drawing
const titleOf = who => who.kind === 'mine' ? 'Your bills' : who.kind === 'all' ? 'All bills' : `${first(who.person)}’s bills`;
const posCell = r => !r.pos ? '<span class="pnone">No position yet</span>' : r.pos === 'monitor' ? `<span class="pmon">${esc(posWords(r.b))}</span>` : `<b class="pside">${esc(posWords(r.b))}</b>`;
// the Next date cell: the mark first (always, so the dates share one left edge), then the words when there are any
const nextCell = r => `<span class="dl${r.next.amber ? ' amber' : ''}${r.next.quiet && !r.next.amber ? ' quiet' : ''}">${markHTML(r.next.sig, r.row)}${r.next.text ? `<span class="dt">${esc(r.next.text)}</span>` : ''}</span>`;
// the legend under the count: when the view has an upcoming deadline, its date first (bold), then each mark in view, in SIGNAL_ORDER, as its icon and name, " · " between; nothing when no bill in view has a mark
const legendOf = (rows, row) => { const have = new Set(rows.map(r => r.next.sig)), marks = SIGNAL_ORDER.filter(k => have.has(k)).map(k => `<span class="lgi"><span aria-hidden="true">${markHTML(k, row)}</span>${nameFor(k, row)}</span>`).join('<span class="lgsep" aria-hidden="true"> · </span>'); return marks && row ? `<b>${esc(legendHead(row))}</b> ${marks}` : marks; };
const legendTag = (rows, row) => { const h = legendOf(rows, row); return `<p class="sglegend" id="abLegend"${h ? '' : ' hidden'}>${h}</p>`; };
function billCell(r, v, f) {
  const href = esc(billLink(v.who, f, r)), led = v.who.kind !== 'all' && r.lead && !r.lids.includes(v.pid) ? `<span class="ledby">Led by ${esc(first(r.lead))}</span>` : '';
  const iss = r.issue && !sameName(r.b, r.issue) ? `<a class="lk issl" href="${esc(issueHref(v.who, r.issue.id))}">${esc(eCig(r.issue.name))}</a>` : '';
  return (r.nick ? `<a class="lk bn" href="${href}">${esc(r.head)}</a><span class="bsub2">${esc(r.no2)}</span>` : `<a class="lk bn" href="${href}">${esc(r.head)}</a><span class="bdesc">${esc(r.desc)}</span>`) + iss + led;
}
const lab = (k, t) => `<span class="albl">${k}: </span>${t}`;
function rowHTML(r, v, f) {
  const coal = r.cs.length ? `${esc(r.camp)}${r.cs.length > 1 ? ` <span class="more1">+${r.cs.length - 1}</span>` : ''}` : '';
  return `<tr role="row" class="${r.alive ? '' : 'stopped'}" data-no="${esc(r.no)}"><th scope="row" role="rowheader" class="c-bill">${billCell(r, v, f)}</th><td role="cell" class="c-pos">${posCell(r)}</td>`
    + (v.who.kind === 'all' ? `<td role="cell" class="c-lead">${r.lead ? lab('Lead', `${esc(r.leadName)}${r.leadMore > 0 ? ` <span class="more1">+${r.leadMore}</span>` : ''}`) : '<span class="mu">No lead</span>'}</td>` : '')
    + `<td role="cell" class="c-coal">${coal ? lab('Coalition', coal) : '<span class="mu">No coalition</span>'}</td><td role="cell" class="c-where"${r.cell.attr}>${r.cell.html}</td><td role="cell" class="c-next">${nextCell(r)}</td></tr>`;
}
function headHTML(v, f) {
  return `<tr role="row">${columnsFor(v.who).map(([k, l]) => { const on = f.sort === k;
    return `<th scope="col" role="columnheader"${on ? ` aria-sort="${f.dir === 'desc' ? 'descending' : 'ascending'}"` : ''}><button class="sorth" type="button" id="abH-${k}" data-sort="${k}">${esc(l)}${ic(on ? (f.dir === 'desc' ? 'chevron-down' : 'chevron-up') : 'chevrons-up-down', on ? '' : 'idle')}</button></th>`; }).join('')}</tr>`;
}
const COLGROUP = who => `<colgroup>${columnsFor(who).map(c => `<col class="k-${c[0]}">`).join('')}</colgroup>`;
// "76 bills", or "83 of 734 bills" when something narrows the list
const countLine = (rows, total) => rows === total ? n(rows, 'bill', 'bills') : `${rows.toLocaleString('en-US')} of ${n(total, 'bill', 'bills')}`;
function emptyHTML(v, f) {
  if (!anyFilter(f)) return `<div class="aempty"><h2>${v.who.kind === 'mine' ? 'You have no bills' : `${esc(first(v.who.person))} has no bills`}. <a class="lk" href="#/issues/bills?who=all${f.sort !== 'next' ? `&sort=${f.sort}` : ''}${f.dir === 'desc' ? '&dir=desc' : ''}">See Everyone</a>.</h2></div>`;
  return `<div class="aempty"><h2>No bill matches. <a class="lk" id="abNone" href="${esc(hrefOf(v.who, noFilter(f)))}">Clear filters</a>.</h2></div>`;
}
// the table (or the empty words): the part that is drawn again on a key, a choice or a sort (the count above it is updated in place)
// The first FIRST rows are drawn at once and the rest follow in chunks (fill below), so a key or a sort shows its answer in a few milliseconds and never waits for 734 rows
const FIRST = 60, CHUNK = 150;
function resultHTML(v, f, rows) {
  const cap = `${titleOf(v.who)}, ${countLine(rows.length, v.recs.length)}`;
  if (!rows.length) return emptyHTML(v, f);
  return `<table class="atab ${v.who.kind === 'all' ? 'six' : 'five'}" id="aTab" role="table"><caption class="vh">${esc(cap)}</caption>${COLGROUP(v.who)}<thead role="rowgroup">${headHTML(v, f)}</thead><tbody role="rowgroup">${rows.slice(0, FIRST).map(r => rowHTML(r, v, f)).join('')}</tbody></table>`;
}
const sel = (id, label, opts, val, cls = '') => `<select class="field fsel${cls}" id="${id}" aria-label="${esc(label)}">${opts.map(([k, l]) => `<option value="${esc(k)}"${val === k ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
function pageHTML(v, f, rows) {
  const who = v.who, me = v.me, pick = issuesUi.pick || who.kind === 'person', P = who.kind === 'person' ? who.person : null;
  const seg = (id, label, on, href) => `<a class="seg" id="${id}" href="${href}"${on ? ' aria-current="true"' : ''}>${label}</a>`;
  const mates = v.people.filter(a => (!me || a.id !== me.id) && a.is_active !== false).sort((p, q) => String(p.full_name).localeCompare(String(q.full_name), 'en'));
  const at = w => hrefOf(w, f), mate = who.kind === 'person', any = anyFilter(f);
  const camps = (S.campaigns || []).filter(c => trackedBills().some(b => (S.billCampaigns?.[b.id] || []).includes(c.id)));
  const sortOpts = columnsFor(who).map(([k, l]) => [k, `Sort by ${l}`]);
  const picker = `<ul class="whopick" id="whoPick" aria-label="Which teammate"${pick ? '' : ' hidden'}>${mates.map(a => `<li><a class="pk${P && P.id === a.id ? ' on' : ''}" id="who-${esc(String(a.initials).replace(/[^A-Za-z0-9]/g, ''))}" href="${esc(at({ kind: 'person', code: a.initials, person: a }))}"${P && P.id === a.id ? ' aria-current="true"' : ''}>${esc(a.full_name)}</a></li>`).join('')}</ul>`;
  return `<div class="pn atab-wrap"><div class="trailbar"><a class="lk" href="#/issues">Issues</a><span aria-hidden="true">${ic('chevron-right')}</span><h1 tabindex="-1">${esc(titleOf(who))}</h1></div>`
    + `<div class="pbody"><div class="atool"><div class="segs3" role="group" aria-label="Whose bills">${seg('whoMine', 'Mine', who.kind === 'mine', at(MINE))}`
    + `<button class="seg" type="button" id="whoMate" aria-expanded="${pick}" aria-controls="whoPick"${mate ? ' aria-current="true"' : ''}>A teammate</button>${seg('whoAll', 'Everyone', who.kind === 'all', at({ kind: 'all', code: 'all' }))}</div>`
    + `<div class="findw"><div class="findb">${ic('search')}<input id="abFind" type="text" autocomplete="off" aria-label="Find a bill by name or number" placeholder="Find a bill by name or number" value="${esc(f.q)}"></div></div>`
    + `<button class="btn quiet afbtn" type="button" id="abFilt" aria-expanded="${bui.filt}" aria-controls="abFilters">${ic('sliders-horizontal')}Filters${any ? ' · on' : ''}</button>`
    + `<div class="afilters${bui.filt ? ' open' : ''}" id="abFilters">${sel('abPos', 'Position', posOpts(), f.pos)}${sel('abCoal', 'Coalition', [['', 'Any coalition'], ...camps.map(c => [String(c.id), camName(c)])], f.coal)}${sel('abSt', 'Status', stOpts, f.st)}`
    + `<a class="lk clr" id="abClear" href="${esc(hrefOf(who, noFilter(f)))}"${any ? '' : ' hidden'}>Clear</a></div>`
    + `<div class="asortsel"><label class="vh" for="abSort">Sort by</label>${sel('abSort', 'Sort by', sortOpts, f.sort)}<button class="btn quiet" type="button" id="abRev" aria-label="${f.dir === 'desc' ? 'Descending, press for ascending' : 'Ascending, press for descending'}">${ic(f.dir === 'desc' ? 'chevron-down' : 'chevron-up')}</button></div></div>`
    + picker + `<p class="acount" id="abCount" role="status">${esc(countLine(rows.length, v.recs.length))}</p>${legendTag(rows, v.row)}<div id="abResult">${resultHTML(v, f, rows)}</div></div></div>`;   // the count is one element that stays, so a screen reader hears it change
}

// The view as the page draws it: { who, me, people, pid, bills, set, ses, row, issueOf, recs } (recs: one record per bill, with the cells' words)
export function viewOf(who, me, people = S.advocates) {
  const bv = billsFor(who, me), v = { who, me, people, pid: (who.kind === 'person' ? who.person : me).id, ...bv };
  v.recs = bv.bills.map(b => recOf(b, v));
  return v;
}
// ---------------------------------------------------------------------------------- put together
// rt: { r: 'issues', id: 'bills', q }. Returns what the frame draws (issues.js issuesModel hands this back for #/issues/bills).
export function billsModel({ me, rt, people }) {
  const who0 = whoOf(rt.q.get('who'), me, people), base = { who: MINE, set: [], ses: null, label: 'All bills', back: '#/issues', backLabel: 'Issues', picked: false, solo: true, pageIssue: null };
  if (who0.bad || (who0.kind === 'person' && !who0.person)) {
    const sheet = `<div class="pn" data-notfound="1"><div class="hband neutral"><div class="ht"><h1 tabindex="-1">We could not find that list of bills.</h1><p class="bsub">It may have been renamed, or it is not on the practice copy.</p></div></div><div class="pbody"><p class="lead"><a class="btn text" href="#/issues">Back to Issues</a></p></div></div>`;
    return { ...base, col: '', sheet, notFound: true, bind: () => {}, label: 'Not found' };
  }
  const who = who0, f = readQuery(rt.q, who), v = viewOf(who, me, people), bv = v;
  const rows = rowsFor(v.recs, f);
  bui.cur = { v, f, rows };
  return { ...base, who: { ...who, show: '', topic: '' }, set: bv.set, ses: bv.ses, col: '', sheet: pageHTML(v, f, rows), notFound: false, bind: api => bindBills(api), key: JSON.stringify([who.code, f]) };
}

// ---------------------------------------------------------------------------------- the controls
const $ = id => document.getElementById(id);
// the address says what the table shows now; replaceState, so Back goes where it went before and not through every key
function say(api) {
  const { v, f } = bui.cur, h = hrefOf(v.who, f);
  if (location.hash !== h) { history.replaceState(history.state, '', location.pathname + location.search + h); api?.sync?.(); }
  $('abClear')?.setAttribute('href', hrefOf(v.who, noFilter(f))); const on = anyFilter(f); if ($('abClear')) $('abClear').hidden = !on;
  const fb = $('abFilt'); if (fb) fb.lastChild.textContent = `Filters${on ? ' · on' : ''}`;
  for (const [id, w] of [['whoMine', MINE], ['whoAll', { kind: 'all', code: 'all' }]]) $(id)?.setAttribute('href', hrefOf(w, f));
  document.querySelectorAll('#whoPick a.pk').forEach(a => { const p = v.people.find(x => `who-${String(x.initials).replace(/[^A-Za-z0-9]/g, '')}` === a.id); if (p) a.setAttribute('href', hrefOf({ kind: 'person', code: p.initials, person: p }, f)); });
}
// draw the table again (count, rows, headers) from the state; `focus`: a header button to give the focus back to
function redraw(api, focus = '') {
  const { v, f } = bui.cur, host = $('abResult'); if (!host) return;
  const rows = bui.cur.rows = rowsFor(v.recs, f);
  host.innerHTML = resultHTML(v, f, rows); fill(false);
  const c = $('abCount'); if (c) c.textContent = countLine(rows.length, v.recs.length);
  const lg = $('abLegend'), lh = legendOf(rows, v.row); if (lg) { lg.innerHTML = lh; lg.hidden = !lh; }
  const s = $('abSort'); if (s) s.value = f.sort;
  const rv = $('abRev'); if (rv) { rv.innerHTML = ic(f.dir === 'desc' ? 'chevron-down' : 'chevron-up'); rv.setAttribute('aria-label', f.dir === 'desc' ? 'Descending, press for ascending' : 'Ascending, press for descending'); }
  say(api);
  if (focus) $(focus)?.focus({ preventScroll: true });
}
// The rows after the first ones, drawn in chunks (or all at once: `now`, when a scroll place has to be found again). A newer draw cancels what is still waiting.
function fill(now) {
  const my = ++bui.tok, { v, f, rows } = bui.cur; let i = FIRST;
  const done = () => { const t = $('aTab'); if (t) t.dataset.all = '1'; };
  if (rows.length <= i) return done();
  const step = () => {
    if (my !== bui.tok) return;
    const tb = document.querySelector('#aTab tbody'); if (!tb) return;
    const end = now ? rows.length : Math.min(rows.length, i + CHUNK);
    tb.insertAdjacentHTML('beforeend', rows.slice(i, end).map(r => rowHTML(r, v, f)).join('')); i = end;
    if (i < rows.length) setTimeout(step, 0); else done();
  };
  if (now) step(); else setTimeout(step, 0);
}
const scroller = () => document.querySelector('.paper');
const scrollNow = () => { const p = scroller(); return p && p.scrollHeight > p.clientHeight ? p.scrollTop : (window.scrollY || 0); };
function rememberScroll() { bui.scroll.set(location.hash, scrollNow()); }
function clearAll() {
  const { f } = bui.cur; Object.assign(f, { pos: '', coal: '', st: '', q: '' });
  $('abFind').value = ''; $('abPos').value = ''; $('abCoal').value = ''; $('abSt').value = '';
  redraw(bui.api);
}
function bindBills(api) {
  bui.api = api; const { f } = bui.cur;
  const y = bui.scroll.get(location.hash);   // a table opened again at the address a bill was opened from keeps its place; so does the minute's redraw (the frame puts the scroll back after this)
  fill(!!(api && api.tick) || y != null);
  const set = (k, val) => { f[k] = val; redraw(api); };
  $('abFind')?.addEventListener('input', e => set('q', e.target.value));
  $('abPos')?.addEventListener('change', e => set('pos', e.target.value));
  $('abCoal')?.addEventListener('change', e => set('coal', e.target.value));
  $('abSt')?.addEventListener('change', e => set('st', e.target.value));
  $('abSort')?.addEventListener('change', e => { f.sort = e.target.value; f.dir = 'asc'; redraw(api); });
  $('abRev')?.addEventListener('click', () => { f.dir = f.dir === 'desc' ? 'asc' : 'desc'; redraw(api); $('abRev')?.focus({ preventScroll: true }); });
  $('abClear')?.addEventListener('click', e => { if (e.button || e.metaKey || e.ctrlKey || e.shiftKey) return; e.preventDefault(); clearAll(); $('abFind')?.focus({ preventScroll: true }); });
  $('abFilt')?.addEventListener('click', () => { bui.filt = !bui.filt; $('abFilters')?.classList.toggle('open', bui.filt); $('abFilt').setAttribute('aria-expanded', String(bui.filt)); });
  // the teammate picker opens and closes in place (the same buttons as the Issues list, so its handler binds them): a choice is a link
  const b = $('whoMate'), l = $('whoPick');
  if (b && l) {
    const open = on => { issuesUi.pick = on; l.hidden = !on; b.setAttribute('aria-expanded', String(on)); };
    b.addEventListener('click', () => open(l.hidden));
    l.addEventListener('click', e => { if (e.target.closest('a')) open(false); });
    $('whoMine')?.addEventListener('click', () => open(false)); $('whoAll')?.addEventListener('click', () => open(false));
  }
  // one listener for the whole result: a sort header, a bill or issue link (its place is kept for Back), "Clear filters"
  $('abResult')?.addEventListener('click', e => {
    const h = e.target.closest('.sorth'), a = e.target.closest('a.bn, a.issl'), none = e.target.closest('#abNone');
    if (h) { const k = h.dataset.sort; if (f.sort === k) f.dir = f.dir === 'desc' ? 'asc' : 'desc'; else { f.sort = k; f.dir = 'asc'; } redraw(api, `abH-${k}`); }
    else if (a) rememberScroll();
    else if (none && !(e.button || e.metaKey || e.ctrlKey || e.shiftKey)) { e.preventDefault(); clearAll(); }
  });
  if (y != null) { bui.scroll.delete(location.hash); const p = scroller(); if (p && p.scrollHeight > p.clientHeight) p.scrollTop = y; else window.scrollTo(0, y); }
}
