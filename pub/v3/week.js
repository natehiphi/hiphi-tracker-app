// Version 3 (?v3=1, R-362 Part 4): This week, the #/bills tab. act.html's This week (one/week.js, R-360 part 5) with the layout and
// the words ported and the data rewritten over core.js: one job, see what happens at the Capitol this week and the one thing to do.
// From the top: today's date and the heading; "Your one thing", the card Home shows (pub/v3/pick.js cardHtml, the screen's one
// filled button, A-3); "Your issues", one phrase per issue followed (calm/home.js myRows, Home's words and order), the card's bill
// not said again (A-14); "Hearings on bills we follow", the followed bills' and HIPHI's, Monday to Friday in Hawaiʻi time, by day,
// ten rows then "Show N more hearings" in place, the one thing's own hearing never among the hidden ones (B-3); "Change my
// issues" to Find. Someone who follows nothing is told what the page is for, with "Pick your issues" (B-3).
// "This week" is the Capitol's week: from today to Friday; on a Saturday or a Sunday, the week ahead (nothing is heard at the
// weekend). The practice copy's clock is Mon 16 Mar 2026, 9:00 am.
import { S, app, esc, icon, headline, spaced, billPath, anyBill, followsAnything, issueBills, hstDay, timeWord, HST, codesOf, CHAMBER_NAME,
  loadBills } from '../core.js';
import { cmteInfo } from '../capitol.js';
import { skeleton, btn } from '../ui.js';
import { recSec, recRow, BOX, keep } from '../rec/kit.js';
import { myRows } from '../calm/home.js';
import { oneThing, cardHtml, wireCard } from './pick.js';
import { issueMark, loadMarks } from '../art.js';

await loadMarks();   // which issues have a mark (R-363), before the first row is drawn

const ROWS = 10, DAY = 864e5;
const noon = day => Date.parse(day + 'T12:00:00-10:00');
const dayLabel = day => new Date(noon(day)).toLocaleDateString('en-US', { timeZone: HST, weekday: 'long', month: 'long', day: 'numeric' });
// Today to Friday, or Monday to Friday of the week ahead at the weekend, as Hawaiʻi days ('2026-03-16').
function week() {
  const today = hstDay(Date.now()), dow = new Date(noon(today)).getUTCDay();   // noon in Hawaiʻi is 22:00 UTC, the same day
  const start = dow === 6 ? 2 : dow === 0 ? 1 : 0, last = dow === 6 || dow === 0 ? 4 : 5 - dow, days = [];
  for (let k = start; k <= start + last; k++) days.push(hstDay(noon(today) + k * DAY));
  return { today, days, ahead: start > 0 };
}
// "House Health", "Senate Health and Human Services, with Commerce and Consumer Protection": the chamber and the names, never a
// code (C-15); a committee not known gives nothing.
function cmteShort(code) {
  const cs = codesOf(code).map(c => cmteInfo(c, S.committees)).filter(Boolean); if (!cs.length) return '';
  return `${CHAMBER_NAME[cs[0].chamber] || ''} ${cs[0].name}`.trim() + (cs.length > 1 ? `, with ${cs.slice(1).map(c => c.name).join(' and ')}` : '');
}
const ours = b => !!b && (S.watch.has(b.id) || (!!b.hiphi_position && b.hiphi_position !== 'monitor'));
// The week's hearings on the followed bills and HIPHI's own, still ahead, by day.
function hearings(W) {
  const all = new Map([...(S.hearings || []), ...((S.pool || {}).hearings || []), ...((S.featured || {}).hearings || [])].map(h => [h.id, h]));
  const now = Date.now(), rows = [...all.values()].filter(h => h.status !== 'cancelled' && Date.parse(h.scheduled_at) > now && W.days.includes(hstDay(h.scheduled_at)) && ours(anyBill(h.bill_id)))
    .sort((x, y) => x.scheduled_at.localeCompare(y.scheduled_at) || String(x.bill_id).localeCompare(String(y.bill_id)));
  return W.days.map(day => ({ day, rows: rows.filter(h => hstDay(h.scheduled_at) === day) })).filter(g => g.rows.length);
}

// ---------------- the pieces ----------------
// Your issues: Home's rows (myRows), each one phrase. The card's bill is said once (A-14): a bill followed on its own that is the
// card's has no row, and the row of the issue it is on is left out, or says "Your one thing, above, and 2 more this week".
function yourIssues(o) {
  const change = `<p class="v3w-change"><a class="btn text" href="#/find"><span>Change my issues</span>${icon('arrow-right')}</a></p>`;
  if (!followsAnything()) return recSec('v3w-iss-h', 'Your issues', `<div class="v3w-empty"><p>This page shows what happens at the Capitol this week on the issues you follow: their hearings, and what you can send before them.</p>
    ${btn('Pick your issues', { kind: 'secondary', icon: 'star', href: '#/find' })}</div>`);
  const id = o?.b?.id, rows = myRows().filter(r => !(r.b && r.b.id === id)).map(r => {
    if (!id || !r.i || r.g !== 'due' || !issueBills(r.i).includes(id)) return r;
    const more = /, and (\d+) more this week$/.exec(r.text || '');
    return more ? { ...r, text: `Your one thing, above, and ${more[1]} more this week`, warn: false } : null;   // a row saying only "above" says nothing
  }).filter(Boolean).map(r => { const m = r.i ? issueMark(r.i, { size: 28 }) : ''; return m ? { ...r, leadHtml: m } : r; });   // an issue's mark at its left (R-363)
  return recSec('v3w-iss-h', 'Your issues', `${rows.length ? `<ul class="rc-rows ${BOX}" role="list">${rows.map(recRow).join('')}</ul>` : ''}${change}`);
}
// The hearings, never cut silently (B-3): the first ten rows show, the rest wait behind "Show N more hearings", and the one thing's
// own hearing always shows. A day whose rows are all hidden is hidden with them.
function hearingsSec(W, o) {
  const gs = hearings(W), pick = o?.h?.id;
  let shown = 0, hidden = 0;
  const marked = gs.map(g => ({ ...g, rows: g.rows.map(h => { const hide = h.id !== pick && shown >= ROWS; if (hide) hidden++; else shown++; return { h, hide }; }) }));
  const rowOf = ({ h, hide }) => { const b = anyBill(h.bill_id), c = cmteShort(h.committee);
    return recRow({ name: headline(b, 90), text: `${spaced(b.bill_number)} · ${timeWord(h.scheduled_at)}${c ? ` · ${c}` : ''}`, href: billPath(b), attrs: { 'data-at': h.scheduled_at, ...(h.id === pick ? { 'data-one': '1' } : {}) } })
      .replace(/^<li>/, hide ? '<li hidden>' : '<li>'); };
  const body = gs.length ? marked.map(g => `<div class="v3w-day"${g.rows.every(r => r.hide) ? ' hidden' : ''}><h3 class="v3w-dayh">${esc(dayLabel(g.day))}</h3>
      <ul class="rc-rows ${BOX}" role="list">${g.rows.map(rowOf).join('')}</ul></div>`).join('')
      + (hidden ? `<button type="button" class="btn text v3w-more" data-v3wmore aria-expanded="false">${icon('chevron-down')}<span>Show ${hidden} more ${hidden === 1 ? 'hearing' : 'hearings'}</span></button>` : '')
    : `<p class="rc-note">No hearings on these bills ${W.ahead ? 'next week' : 'the rest of this week'}. <a href="#/find">See all of HIPHI’s bills</a>.</p>`;
  return recSec('v3w-hear-h', 'Hearings on bills we follow', body);
}

let asked = false;
export default {
  tab: 'bills',
  title: () => 'This week',
  render() {
    if (!S.featured || !S.pool) {
      if (!asked) { asked = true; loadBills().catch(e => console.error(e)).finally(() => { if (document.body.dataset.screen === 'bills') app.render(); }); }
      return skeleton(4);
    }
    const W = week(), o = oneThing();
    return `<div class="rc v3w" data-page="week">
      <header class="v3w-head"><p class="v3w-date">${esc(keep(dayLabel(W.today)))}</p><h1 class="hero v3w-h1">This week</h1></header>
      <section class="v3w-one" aria-labelledby="v3w-one-h"><h2 class="rc-h2" id="v3w-one-h">Your one thing</h2>${cardHtml(o, { hl: 'h3' })}</section>
      ${yourIssues(o)}
      ${hearingsSec(W, o)}
    </div>`;
  },
  wire() {
    const root = document.querySelector('.v3w'); if (!root) return;
    wireCard(root);
    const more = root.querySelector('[data-v3wmore]');
    if (more) more.onclick = () => {
      const first = root.querySelector('#v3w-hear-h ~ .v3w-day li[hidden] a, #v3w-hear-h ~ .v3w-day[hidden] li a');
      root.querySelectorAll('.v3w-day[hidden], .v3w-day li[hidden]').forEach(x => { x.hidden = false; });
      more.remove(); first?.focus({ preventScroll: true });
    };
  },
};
