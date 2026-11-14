// The done moment: says a step is finished, who has it now, what is next, and offers Undo for 10 seconds.
import { btn, esc } from './parts.js';
import { ic } from './icons7.js';
import { approversOf, orNames, homeRows, inWeek } from './steps.js';

export const UNDO_MS = 10000;
export const undoLeft = f => Math.max(0, UNDO_MS - (Date.now() - f.at));

export function doneSheet(ctx, id) {
  const f = ctx.finished[id]; if (!f) return '';
  const s = f.step, who = orNames(approversOf(s.draft, s.hearing, ctx.me)), open = ctx.open(), nx = homeRows(open)[0];
  const week = [...open.filter(inWeek), ...Object.values(ctx.finished).map(x => x.step).filter(inWeek)];
  const doneN = Object.values(ctx.finished).map(x => x.step).filter(inWeek).length;
  const segs = week.map((_, i) => `<i class="${i < doneN ? 'on' : ''}"></i>`).join('');
  return `<div class="pn"><div class="done enter"><div class="dtile">${ic('check')}</div><h1 tabindex="-1">Sent to ${esc(who)}.</h1>`
    + `<p class="sub">Nothing else needs you on ${esc(s.name)} until ${esc(who)} approves.</p>`
    + (week.length ? `<div class="segs" role="img" aria-label="${doneN} of ${week.length} done this week">${segs}</div><p class="left">${doneN} of ${week.length} done this week</p>` : '')
    + (undoLeft(f) > 0 ? `<p class="undo" id="undoLine">${btn('Undo', { kind: 'text', id: 'undoBtn' })} for 10 seconds</p>` : '')
    + `<div class="actions">${nx ? btn('Next step: ' + nx.verb, { kind: 'filled', href: '#/do/' + nx.id, big: true }) : ''}</div>`
    + (nx ? '' : '<p class="sub">Nothing else needs you.</p>') + '</div></div>';
}

let timer = 0;
export function bindDone(ctx, id) {
  clearTimeout(timer);
  const f = ctx.finished[id], line = document.getElementById('undoLine'); if (!f || !line) return;
  timer = setTimeout(() => line.remove(), undoLeft(f));
  document.getElementById('undoBtn').addEventListener('click', () => ctx.undo(id));
}
export const stopDone = () => clearTimeout(timer);
