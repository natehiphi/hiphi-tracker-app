// The issue page's bills (R-398): a real table of the bills still alive (number, name, where each waits NOW, how it stands against the issue's next deadline) and, folded away, the bills that stopped.
// The two cells come from bill_cell.js, the same functions the Issues list reads, so the list and this table never disagree. Nothing here writes.
import { S } from '../staff6/data.js';
import { ic } from './icons7.js';
import { esc, btn } from './parts.js';
import { billName, billNo, posWords } from './steps.js';
import { isAlive } from './standing.js';
import { deadlineCell, whereCell, headCell, CELL_ORDER } from './bill_cell.js';
import { codesOf, cmtesText, monD } from './bill_words.js';
import { cmteMarks } from './bill_tl.js';
import { stoppedISO } from './bill.js';
import { pathOf } from './path.js';
import { eCig, billHref } from './issues.js';

export const tui = { open: new Set() };   // issues whose stopped list is open, kept across the minute's redraw
const num = b => String(b.bill_number).replace(/\s/g, '');
const byNum = (x, y) => num(x).localeCompare(num(y), 'en', { numeric: true });

// Why a stopped bill stopped, in a few plain words: { date: 'Mar 6' or '', why, cmte: the committee codes it stopped in or '' }.
// WHAT IT TRUSTS: the date is the Capitol's own deadline date it missed (died_deadline, bill.js stoppedISO); the committee is the one cmteMarks marks as where it stopped, which is only
// set when the data names it (died_at_stage); "heard ... and held" only when a past hearing of that committee is on record; the stage says the rest (a lateral deadline is missed by a bill
// that never reached its second committee; a first-committee or decking deadline by one that was never heard). When the record cannot tell which, why is '' and the line says only where it stopped.
export function stoppedWhy(b) {
  const iso = stoppedISO(b), date = iso ? monD(`${iso}T12:00:00-10:00`) : '';
  const { refs, marks } = cmteMarks(b), at = refs.filter((_, i) => marks[i] === 'now'), codes = [...new Set(at.flatMap(codesOf))];
  if (!codes.length) return { date, why: '', cmte: '' };
  const cmte = codes.join('/'), name = `${cmtesText(cmte, b)} (${cmte})`, stage = String(b.died_at_stage || '');
  const heard = (S.hearings || []).filter(h => h.bill_id === b.id && h.status === 'scheduled' && new Date(h.scheduled_at).getTime() < Date.now() && codesOf(h.committee).some(c => codes.includes(c)))
    .sort((p, q) => String(q.scheduled_at).localeCompare(String(p.scheduled_at)))[0];
  const passed = heard && ['passed', 'passed_amended'].includes((S.outcomes?.[heard.id] || {}).outcome);
  if (heard) return { date, why: passed ? '' : `heard ${monD(heard.scheduled_at)} and held`, cmte };
  if (/_triple$/.test(stage)) return { date, why: 'no hearing in its first committee', cmte };
  if (/_lateral$/.test(stage)) return { date, why: `did not reach ${name}`, cmte };
  if (/_decking$/.test(stage)) return { date, why: `no hearing in ${name}`, cmte };
  return { date, why: '', cmte, name };
}
export const stoppedWords = b => { const w = stoppedWhy(b); return `Stopped${w.date ? ` ${w.date}` : ''}${w.why ? ` · ${w.why}` : w.cmte ? ` in ${cmtesText(w.cmte, b)} (${w.cmte})` : ''}`; };

// With no bill alive the status line at the top tells why the issue's last bill stopped (issue.js stoppedLines); that bill's row then says only when
const toldAbove = b => { const w = stoppedWhy(b); return !!(w.why || w.cmte); };
const stoppedShort = b => `Stopped${stoppedWhy(b).date ? ` ${stoppedWhy(b).date}` : ''}`;
const COLS = '<colgroup><col class="cn"><col class="cm"><col class="cw"><col class="cd"></colgroup>';   // widths in app.css: the number fits its words, the name takes the rest
const COLS3 = '<colgroup><col class="cn"><col class="cm"><col class="cw"></colgroup>';
const cellHTML = c => `<span class="dl${c.amber ? ' amber' : ''}${c.quiet ? ' quiet' : ''}">${c.icon ? ic(c.icon) : ''}<span>${esc(c.text)}</span></span>`;
const nameCell = (b, issue) => `<span class="tn">${esc(eCig(billName(b)))}</span>${b.position && b.position !== issue.stance ? `<span class="tpos">Our position: ${esc(posWords(b))}</span>` : ''}`;

// The alive bills, most urgent first: by the order of the cell's key, then by its date or time, then by bill number
export function sortedAlive(bills, row) {
  return bills.filter(isAlive).map(b => ({ b, c: deadlineCell(b, row) }))
    .sort((p, q) => CELL_ORDER.indexOf(p.c.key) - CELL_ORDER.indexOf(q.c.key) || String(p.c.at ?? '￿').localeCompare(String(q.c.at ?? '￿'), 'en', { numeric: true }) || byNum(p.b, q.b));
}

export function billsHTML(issue, bills, row, who) {
  if (!bills.length) return '';
  const alive = sortedAlive(bills, row), dead = bills.filter(b => !isAlive(b)).sort((x, y) => pathOf(y).i - pathOf(x).i || String(y.last_action_date || '').localeCompare(String(x.last_action_date || '')) || byNum(x, y))   , link = b => `<a class="lk" href="${esc(billHref(who, b, issue.id))}">${esc(billNo(b))}</a>`;
  let h = '<h2 class="sh" id="tBillsH">Bills</h2>';
  if (alive.length) {
    h += `<table class="btab" id="tBills"><caption class="sr">Bills of this issue that are still alive, where each waits now, and how each stands against the next deadline</caption>${COLS}<thead><tr><th scope="col" colspan="2">Bill</th><th scope="col">Now waiting</th><th scope="col" class="dh">${esc(headCell(row))}</th></tr></thead><tbody>`
      + alive.map(({ b, c }) => `<tr><th scope="row">${link(b)}</th><td class="tnm">${nameCell(b, issue)}</td><td class="tw">${whereCell(b)}</td><td class="dc">${cellHTML(c)}</td></tr>`).join('') + '</tbody></table>';
  }
  if (dead.length) {
    const open = !alive.length || tui.open.has(issue.id), n = dead.length;
    const rows = `<table class="btab dead" id="tDead"${open ? '' : ' hidden'}><caption class="sr">Bills of this issue that stopped this year</caption>${COLS3}<thead class="sr"><tr><th scope="col">Bill</th><th scope="col">Name</th><th scope="col">What happened</th></tr></thead><tbody>`
      + dead.map((b, i) => `<tr><th scope="row">${link(b)}</th><td class="tnm">${nameCell(b, issue)}</td><td class="tw quiet">${esc(!alive.length && i === 0 && toldAbove(b) ? stoppedShort(b) : stoppedWords(b))}</td></tr>`).join('') + '</tbody></table>';
    h += alive.length ? `<p class="ifold" id="tFold">${n} ${n === 1 ? 'bill' : 'bills'} stopped this year · ${btn(open ? 'Show fewer' : `Show ${n}`, { kind: 'text', id: 'tFoldBtn', attrs: `aria-expanded="${open}" aria-controls="tDead" data-shown="${n}"` })}</p>${rows}` : rows;
  }
  return h;
}

export function bindTable(issue) {
  const bt = document.getElementById('tFoldBtn'); if (!bt) return;
  bt.addEventListener('click', () => {
    const on = bt.getAttribute('aria-expanded') !== 'true';
    if (on) tui.open.add(issue.id); else tui.open.delete(issue.id);
    bt.setAttribute('aria-expanded', String(on)); bt.textContent = on ? 'Show fewer' : `Show ${bt.dataset.shown}`;
    document.getElementById('tDead')?.toggleAttribute('hidden', !on);
  });
}
