// R-316 W53 (live 10/22 at Nate's yes, R-330). When the Capitol moves a
// hearing, "I'm going" and the public ask move with it. With Kevin going to a sitting that moved, the new sitting's page
// said "Nobody from the team yet" and the hearing dropped off his calendar; the public page showed no ask from 2/10 until
// the 2/13 hearing, because the ask ended on the old date.
//   - anyone going to the cancelled sitting gets a Today row: "Your HLT/CPC hearing moved to Wed 2/11, 2:00 PM: still
//     going?" with "Yes, move me" and "No" (the cancelled sitting's Who's going card has the same buttons);
//   - when the new date is after the day the public ask is set to end, the owner gets "Keep the ask up until Fri 2/13?",
//     one tap with Undo. It only extends an ask HIPHI already approved.
// Staff v6 (R-336, spec 6 Hearings): the question is asked where the hearing is shown too. On Hearings > This week the
// sitting it moved to carries "You were going on Mon 2/9. Still going?" above its card (movedAskHTML), and committees are
// named in words ("House Health", steps.js committeeName), not codes (D15).
import { S, DB, DEMO, esc } from './data.js';
import { hstDayOf } from './model.js';
import { committeeName } from './steps.js';

export const MOVE_GOING = () => true;   // live 10/22 at Nate's yes (R-330)
const DAY = 864e5;
const dayAt = t => new Date(t).toLocaleDateString('en-US', { timeZone: 'Pacific/Honolulu', weekday: 'short', month: 'numeric', day: 'numeric' }).replace(',', '');
const timeAt = t => new Date(t).toLocaleTimeString('en-US', { timeZone: 'Pacific/Honolulu', hour: 'numeric', minute: '2-digit' });
export const whenAtMoved = t => `${dayAt(t)}, ${timeAt(t)}`;
const cmte = code => committeeName(code) || code;

// The sitting a hearing replaced: the same bill and committee, cancelled, within two weeks (model.js movedFrom's rule,
// without its three-day window: the question stays until it is answered).
export function oldSitting(h) {
  if (!h || h.status === 'cancelled') return null;
  const t = new Date(h.scheduled_at).getTime();
  return (S.hearings || []).filter(x => x.bill_id === h.bill_id && x.committee === h.committee && x.status === 'cancelled' && x.id !== h.id && Math.abs(new Date(x.scheduled_at).getTime() - t) < 14 * DAY)
    .sort((a, b) => b.scheduled_at.localeCompare(a.scheduled_at))[0] || null;
}
// The sitting that replaced a cancelled one, if the Capitol has posted it.
export const newSitting = old => (S.hearings || []).filter(h => h.status !== 'cancelled' && oldSitting(h)?.id === old.id).sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))[0] || null;
const going = (h, id) => (S.attend?.[h.id] || []).includes(id);

// The practice copy has no one marked going to the sittings that moved, so it puts each moved bill's owner down for the
// old one, once per tab (kept in sessionStorage: a "No" stays answered). Only real moves, a day or more (HB1523's TRS
// sitting moved five minutes).
const SEED = 'hiphi5_w53seed';
export function seedMoved() {
  if (!DEMO || !MOVE_GOING()) return;
  try { if (sessionStorage.getItem(SEED)) return; sessionStorage.setItem(SEED, '1'); } catch { return; }
  for (const h of S.hearings || []) { const o = oldSitting(h); if (!o || new Date(h.scheduled_at) - new Date(o.scheduled_at) < DAY) continue;
    const own = (S.assignments?.[h.bill_id] || [])[0]; if (own && !going(h, own)) (S.attend[o.id] ??= []).includes(own) || S.attend[o.id].push(own); }
}

// Today's rows for `me` (todayItems pushes them): still going? and keep the ask up?
export function movedTasks(me, self, billById, owns) {
  if (!MOVE_GOING() || !me) return [];
  const now = Date.now(), out = [], seen = new Set();
  for (const h of S.hearings || []) {
    if (h.status === 'cancelled' || new Date(h.scheduled_at).getTime() < now) continue;
    const o = oldSitting(h), b = o && billById(h.bill_id); if (!o || !b) continue;
    const at = new Date(h.scheduled_at).getTime();
    if (going(o, me.id) && !going(h, me.id) && !seen.has('g' + o.id)) { seen.add('g' + o.id);
      out.push({ kind: 'moved', key: `mv:${o.id}`, b, h, old: o, due: at, who: 'yours', kd: ['landmark', 'Hearing moved'],
        s: `${self ? 'Your' : 'The'} ${esc(cmte(h.committee))} hearing moved to ${esc(whenAtMoved(at))}: still going?`,
        btns: [{ label: 'Yes, move me', act: 'moveme' }, { label: 'No', act: 'notgoing', text: true }] }); }
    const until = b.public_action_until && String(b.public_action).trim() ? String(b.public_action_until).slice(0, 10) : '';
    if (until && hstDayOf(at) > until && owns(me.id, b) && !seen.has('a' + b.id)) { seen.add('a' + b.id);
      out.push({ kind: 'askup', key: `au:${b.id}`, b, h, due: Math.min(at, new Date(until + 'T23:59:59-10:00').getTime()), who: 'yours', kd: ['megaphone', 'Public ask'],
        s: `The ${esc(cmte(h.committee))} hearing moved to ${esc(dayAt(at))}: keep the public ask up until ${esc(dayAt(at))}?`,
        why: `It ends ${esc(dayAt(until + 'T12:00:00-10:00'))} now`, btns: [{ label: `Keep it up until ${dayAt(at)}`, act: 'askup' }] }); }
  }
  return out;
}
// The answers, each with Undo. `toast` and `redraw` come from the caller.
export async function moveMe(t, { toast, redraw }) {
  const me = S.me.id; await DB.attend(t.h.id, true, me); await DB.attend(t.old.id, false, me);
  toast(`You’re going to the ${cmte(t.h.committee)} hearing ${whenAtMoved(t.h.scheduled_at)}.`, { ok: true, undo: async () => { await DB.attend(t.h.id, false, me); await DB.attend(t.old.id, true, me); redraw(); } }); redraw();
}
export async function notGoing(t, { toast, redraw }) {
  const me = S.me.id; await DB.attend(t.old.id, false, me);
  toast('You’re not going.', { undo: async () => { await DB.attend(t.old.id, true, me); redraw(); } }); redraw();
}
export async function keepAskUp(t, { toast, redraw }) {
  const b = t.b, prev = b.public_action_until, day = hstDayOf(t.h.scheduled_at);
  await DB.updateBill(b.id, { public_action_until: day });
  toast(`The public ask stays up until ${dayAt(day + 'T12:00:00-10:00')}.`, { ok: true, undo: async () => { await DB.updateBill(b.id, { public_action_until: prev }); redraw(); } }); redraw();
}
// The cancelled sitting's Who's going card (hearing.js): the same question, for whoever is still down for it.
export function movedGoingHTML(old, btn) {
  if (!MOVE_GOING() || !S.me || !going(old, S.me.id)) return '';
  const h = newSitting(old); if (!h) return '';
  return `<p class="mv-ask">${esc(`It moved to ${whenAtMoved(h.scheduled_at)}. Still going?`)}</p><div class="mv-acts">${btn('Yes, move me', { kind: 'secondary', sm: true, attrs: { 'data-mvyes': old.id } })}${btn('No', { kind: 'text', sm: true, attrs: { 'data-mvno': old.id } })}</div>`;
}
// Hearings > This week: above the card of a sitting that replaced one you were going to, while you are not yet down for
// the new one. The same two answers, with Undo (wireMoved).
export function movedAskHTML(h, btn) {
  if (!MOVE_GOING() || !S.me || !h || h.status === 'cancelled') return '';
  const old = oldSitting(h); if (!old || !going(old, S.me.id) || (S.hearings || []).some(r => r.committee === h.committee && r.scheduled_at === h.scheduled_at && going(r, S.me.id))) return '';
  return `<div class="mv-strip" role="group" aria-label="This hearing moved"><p class="mv-ask">${esc(`You were going on ${whenAtMoved(old.scheduled_at)}. It moved here: still going?`)}</p><div class="mv-acts">${btn('Yes, move me', { kind: 'secondary', sm: true, attrs: { 'data-mvyes': old.id } })}${btn('No', { kind: 'text', sm: true, attrs: { 'data-mvno': old.id } })}</div></div>`;
}
export function wireMoved(root, { toast, redraw }) {
  root.querySelectorAll('[data-mvyes]').forEach(el => el.onclick = () => { const old = (S.hearings || []).find(x => String(x.id) === el.dataset.mvyes), h = old && newSitting(old); if (h) moveMe({ h, old }, { toast, redraw }); });
  root.querySelectorAll('[data-mvno]').forEach(el => el.onclick = () => { const old = (S.hearings || []).find(x => String(x.id) === el.dataset.mvno); if (old) notGoing({ old }, { toast, redraw }); });
}
