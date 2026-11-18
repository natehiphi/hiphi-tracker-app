// The issue page's bills (R-398): a real table of the bills still alive (number, name, where each waits NOW, how it stands against the issue's next deadline) and, folded away, the bills that stopped.
// The two cells come from bill_cell.js, the same functions the Issues list reads, so the list and this table never disagree. Nothing here writes.
import { S } from '../staff6/data.js';
import { ic } from './icons7.js';
import { esc, btn } from './parts.js';
import { billName, billNo, posWords } from './steps.js';
import { isAlive } from './standing.js';
import { deadlineCell, headCell, CELL_ORDER, signalOf, markHTML } from './bill_cell.js';
import { placeCell, stoppedLine } from './place.js';
import { codesOf, cmteLabel, monD, ymdH } from './bill_words.js';
import { cmteMarks } from './bill_tl.js';
import { stoppedISO } from './bill.js';
import { pathOf } from './path.js';
import { eCig, billHref } from './issues.js';

export const tui = { open: new Set() };   // issues whose stopped list is open, kept across the minute's redraw
const num = b => String(b.bill_number).replace(/\s/g, '');
const byNum = (x, y) => num(x).localeCompare(num(y), 'en', { numeric: true });

// The FACTS about a stopped bill, everywhere in the app (the All bills table, the Issues list, the issue page's table and the bill page); the WORDS for them are place.js (placeOf), the one source of a bill's place.
//   the date         said once and quietly: "Stopped Feb 11" (stoppedDate); a page with one line for both says "Stopped Feb 11 · No hearing, missed the deadline · House Health (HLT)" (stoppedWords)
// stoppedWhy(b) -> { date: 'Feb 11' or '', kind: 'none' | 'held' | '' , heard: 'Feb 6' (kind held), cmte: 'HLT/HSH' (the committee codes it stopped in) or '', codes: ['HLT', 'HSH'], name: 'House Health (HLT) with House Human Services & Homelessness (HSH)' }
// WHAT IT TRUSTS: the date is the Capitol's own deadline date it missed (died_deadline, bill.js stoppedISO); the committee is the one cmteMarks marks as where it stopped, which is only
// set when the data names it (died_at_stage); "heard ... and held" only when a past hearing of that committee is on record; the stage says the rest (a lateral deadline is missed by a bill
// that never reached its second committee; a first-committee or decking deadline by one that was never heard). When the record cannot tell which, kind is '' and the page says only where it stopped.
export const cmteNames = (codes, b) => codes.map(c => `${cmteLabel(c, b)} (${c})`).join(' with ');
// The Capitol's last action can say a hearing never took place: "This measure has been deleted from the meeting scheduled on Wednesday 02-25-26 2:00PM". That hearing is not a hearing held.
// Only when the action names a date (MM-DD-YY) and it is the hearing's own Honolulu day; an action with no date ignores nothing.
export function deletedFrom(b, h) {
  const a = String(b.last_action || ''); if (!/deleted from the meeting/i.test(a)) return false;
  const m = /\b(\d{1,2})-(\d{1,2})-(\d{2,4})\b/.exec(a); if (!m) return false;
  const y = +m[3] < 100 ? 2000 + +m[3] : +m[3];
  return ymdH(h.scheduled_at) === `${y}-${String(m[1]).padStart(2, '0')}-${String(m[2]).padStart(2, '0')}`;
}
export function stoppedWhy(b) {
  const iso = stoppedISO(b), date = iso ? monD(`${iso}T12:00:00-10:00`) : '';
  const { refs, marks } = cmteMarks(b), at = refs.filter((_, i) => marks[i] === 'now'), codes = [...new Set(at.flatMap(codesOf))];
  if (!codes.length) return { date, kind: '', cmte: '', codes: [], name: '' };
  const cmte = codes.join('/'), name = cmteNames(codes, b), stage = String(b.died_at_stage || '');
  const heard = (S.hearings || []).filter(h => h.bill_id === b.id && h.status === 'scheduled' && new Date(h.scheduled_at).getTime() < Date.now() && codesOf(h.committee).some(c => codes.includes(c)) && !deletedFrom(b, h))
    .sort((p, q) => String(q.scheduled_at).localeCompare(String(p.scheduled_at)))[0];
  const passed = heard && ['passed', 'passed_amended'].includes((S.outcomes?.[heard.id] || {}).outcome);
  if (heard) return passed ? { date, kind: '', cmte, codes, name } : { date, kind: 'held', heard: monD(heard.scheduled_at), cmte, codes, name };
  if (/_(triple|lateral|decking)$/.test(stage)) return { date, kind: 'none', cmte, codes, name };
  return { date, kind: '', cmte, codes, name };
}
// (the -Of form takes what stoppedWhy answered, so a table that needs the date and more works the bill out once)
export const stoppedDateOf = w => `Stopped${w.date ? ` ${w.date}` : ''}`;
// "Stopped Feb 11" (just "Stopped" when the Capitol's date is not known)
export const stoppedDate = b => stoppedDateOf(stoppedWhy(b));
// both in one line, for a page that has one line to say it in: "Stopped Feb 11 · No hearing, missed the deadline · House Health (HLT)"
export const stoppedWords = b => stoppedLine(b);

// With no bill alive the status line at the top tells why the issue's last bill stopped (issue.js stoppedLines); that bill's row then says only when
const toldAbove = b => { const w = stoppedWhy(b); return !!w.cmte; };
const stoppedShort = stoppedDate;
const COLS = '<colgroup><col class="cn"><col class="cm"><col class="cw"><col class="cd"></colgroup>';   // widths in app.css: the number fits its words, the name takes the rest
const COLS3 = '<colgroup><col class="cn"><col class="cm"><col class="cw"></colgroup>';
// the Next-date cell of the table: the one mark (bill_cell.js signalOf, the same answer as All bills and the Issues list), then the words; amber words only beside risk or soon
const cellHTML = (b, row, c) => { const sig = signalOf(b, row), amber = sig === 'risk' || sig === 'soon'; return `<span class="dl${amber ? ' amber' : ''}${c.quiet && !amber ? ' quiet' : ''}">${markHTML(sig, row)}<span>${esc(c.text)}</span></span>`; };
const nameCell = (b, issue) => `<span class="tn">${esc(eCig(billName(b)))}</span>${b.position && b.position !== issue.stance ? `<span class="tpos">Our position: ${esc(posWords(b))}</span>` : ''}`;

// The alive bills, most urgent first: by the order of the cell's key, then by its date or time, then by bill number
export function sortedAlive(bills, row) {
  return bills.filter(isAlive).map(b => ({ b, c: deadlineCell(b, row) }))
    .sort((p, q) => CELL_ORDER.indexOf(p.c.key) - CELL_ORDER.indexOf(q.c.key) || String(p.c.at ?? '￿').localeCompare(String(q.c.at ?? '￿'), 'en', { numeric: true }) || byNum(p.b, q.b));
}

// The stopped bills in one order, for the issue page's status line (its first is "the last bill") and the table's folded list (its first row is told above): the one that got furthest, then the latest action, then the number
export const deadOrder = bills => bills.filter(b => !isAlive(b)).sort((x, y) => pathOf(y).i - pathOf(x).i || String(y.last_action_date || '').localeCompare(String(x.last_action_date || '')) || byNum(x, y));
export function billsHTML(issue, bills, row, who) {
  if (!bills.length) return '';
  const alive = sortedAlive(bills, row), dead = deadOrder(bills), link = b => `<a class="lk" href="${esc(billHref(who, b, issue.id))}">${esc(billNo(b))}</a>`;
  let h = '<h2 class="sh" id="tBillsH">Bills</h2>';
  if (alive.length) {
    h += `<table class="btab" id="tBills"><caption class="sr">Bills of this issue that are still alive, where each waits now, and how each stands against the next deadline</caption>${COLS}<thead><tr><th scope="col" colspan="2">Bill</th><th scope="col">Where it is</th><th scope="col" class="dh">${esc(headCell(row))}</th></tr></thead><tbody>`
      + alive.map(({ b, c }) => { const pc = placeCell(b, null, { link: true }); return `<tr><th scope="row">${link(b)}</th><td class="tnm">${nameCell(b, issue)}</td><td class="tw"${pc.attr}>${pc.html}</td><td class="dc">${cellHTML(b, row, c)}</td></tr>`; }).join('') + '</tbody></table>';
  }
  if (dead.length) {
    const open = !alive.length || tui.open.has(issue.id), n = dead.length;
    const rows = `<table class="btab dead" id="tDead"${open ? '' : ' hidden'}><caption class="sr">Bills of this issue that stopped this year</caption>${COLS3}<thead class="sr"><tr><th scope="col">Bill</th><th scope="col">Name</th><th scope="col">What happened</th></tr></thead><tbody>`
      + dead.map((b, i) => `<tr><th scope="row">${link(b)}</th><td class="tnm">${nameCell(b, issue)}</td><td class="tw quiet">${stoppedCell(b, row, !alive.length && i === 0 && toldAbove(b) ? stoppedShort(b) : stoppedWords(b))}</td></tr>`).join('') + '</tbody></table>';
    h += alive.length ? `<p class="ifold" id="tFold">${n} ${n === 1 ? 'bill' : 'bills'} stopped this year · ${btn(open ? 'Show fewer' : `Show ${n}`, { kind: 'text', id: 'tFoldBtn', attrs: `aria-expanded="${open}" aria-controls="tDead" data-shown="${n}"` })}</p>${rows}` : rows;
  }
  return h;
}

// a stopped bill in the folded list: its words, with its mark only when it has one (the deferred bill's dying mark until its deadline passes)
const stoppedCell = (b, row, text) => { const sig = signalOf(b, row); return sig ? `<span class="dl">${markHTML(sig, row)}<span>${esc(text)}</span></span>` : esc(text); };

export function bindTable(issue) {
  const bt = document.getElementById('tFoldBtn'); if (!bt) return;
  bt.addEventListener('click', () => {
    const on = bt.getAttribute('aria-expanded') !== 'true';
    if (on) tui.open.add(issue.id); else tui.open.delete(issue.id);
    bt.setAttribute('aria-expanded', String(on)); bt.textContent = on ? 'Show fewer' : `Show ${bt.dataset.shown}`;
    document.getElementById('tDead')?.toggleAttribute('hidden', !on);
  });
}
