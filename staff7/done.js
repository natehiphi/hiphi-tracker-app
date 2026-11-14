// The done moment: says a step is finished, who has it now, what is next, and offers Undo for 10 seconds (or, after filing or asking, a text link that puts the step back).
import { S } from '../staff6/data.js';
import { btn, esc } from './parts.js';
import { ic } from './icons7.js';
import { approversOf, orNames, homeRows, inWeek, first } from './steps.js';
import { writerOf } from './do_approve.js';

export const UNDO_MS = 10000;
export const undoLeft = f => f.noUndo ? 0 : Math.max(0, UNDO_MS - (Date.now() - f.at));

// Filing, asking and the missed answers keep no timed Undo: a text link under the words puts the step back for as long as the page is there.
// A No to "Did we file?" is a line on the bill's timeline the app cannot take off again, so it has no link.
export const reverseWords = f => f.noUndo ? '' : f.kind === 'filed' ? 'I have not filed it yet' : f.kind === 'asked' ? 'I have not sent it yet' : f.kind === 'recorded' && f.answer === 'yes' ? 'Change my answer' : '';

export function doneSheet(ctx, id, fresh) {
  const f = ctx.finished[id]; if (!f) return '';
  const s = f.step, open = ctx.open(), nx = homeRows(open)[0];
  let title, sub;
  if (f.kind === 'filed') { title = 'Filed.'; sub = `Nothing else needs you on ${s.name}.`; }
  else if (f.kind === 'asked') { title = 'Asked.'; sub = `Nothing else needs you on ${s.name} until ${(s.ask?.m?.n || 1) > 1 ? 'the chairs answer' : 'the chair answers'}.`; }
  else if (f.kind === 'recorded') { title = 'Recorded.'; sub = f.answer === 'yes' ? `Noted on ${s.name}: the testimony was filed.` : `Noted on ${s.name}: the testimony was not filed.`; }
  else {
    const d = fresh(f) || s.draft, W = first(writerOf({ ...s, draft: d })), who = orNames(approversOf(d, s.hearing, ctx.me));
    if (f.kind === 'approved') {   // from the draft as it is NOW (live, the transition replaces the row)
      title = 'Approved.';
      sub = d.status === 'second_review' ? `${orNames((S.advocates || []).filter(a => a.is_active !== false && a.is_reviewer && a.id !== ctx.me?.id && a.id !== d.approved_by))} gives the second look next.` : `${W} can file it.`;
    } else if (f.kind === 'back') { title = `Sent back to ${W}.`; sub = `Nothing else needs you on ${s.name} until ${W} resubmits.`; }
    else { title = `Sent to ${who}.`; sub = `Nothing else needs you on ${s.name} until ${who} approves.`; }
  }
  const week = [...open.filter(inWeek), ...Object.values(ctx.finished).map(x => x.step).filter(inWeek)];
  const doneN = Object.values(ctx.finished).map(x => x.step).filter(inWeek).length;
  const segs = week.map((_, i) => `<i class="${i < doneN ? 'on' : ''}"></i>`).join('');
  return `<div class="pn"><div class="done enter"><div class="dtile">${ic('check')}</div><h1 tabindex="-1">${esc(title)}</h1>`
    + `<p class="sub">${esc(sub)}</p>`
    + (week.length ? `<div class="segs" role="img" aria-label="${doneN} of ${week.length} done this week">${segs}</div><p class="left">${doneN} of ${week.length} done this week</p>` : '')
    + (reverseWords(f) ? `<p class="undo" id="undoLine">${btn(reverseWords(f), { kind: 'text', id: 'undoBtn' })}</p>`
      : ['filed', 'asked', 'recorded'].includes(f.kind) ? '' : undoLeft(f) > 0 ? `<p class="undo" id="undoLine">${btn('Undo', { kind: 'text', id: 'undoBtn' })} for 10 seconds</p>` : '')
    + `<div class="actions">${nx ? btn(`Next step: ${nx.verb} · ${nx.name}`, { kind: 'filled', href: '#/do/' + encodeURIComponent(nx.id), big: true }) : btn('Back to Home', { kind: 'text', href: '#/' })}</div></div></div>`;
}

let timer = 0;
export function bindDone(ctx, id) {
  clearTimeout(timer);
  const f = ctx.finished[id], line = document.getElementById('undoLine'); if (!f || !line) return;
  if (!reverseWords(f)) timer = setTimeout(() => line.remove(), undoLeft(f));   // the timed Undo goes after 10 seconds; the reverse link stays
  document.getElementById('undoBtn').addEventListener('click', () => ctx.undo(id));
}
export const stopDone = () => clearTimeout(timer);
