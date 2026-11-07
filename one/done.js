// The done mark (R-360 fix pass, DESIGN B-6: the app remembers). "Yes, I sent it" writes it the way the walkthrough does
// (core.js markDone: hiphi_done, and when in hiphi_done_at; the practice copy's own keys), so the full tracker shows the bill
// as done too. The bill screen reads it to say "You sent it on ..." instead of offering the same action again, app.js sends
// a return to /send on to /thanks, and counts.js does not count the same action twice.
import { DEMO } from './data.js';

export const DONE = DEMO ? 'hiphi_done_demo' : 'hiphi_done';
export const DONE_AT = DEMO ? 'hiphi_done_at_demo' : 'hiphi_done_at';
export const isMail = B => B.action !== 'testimony' || !B.hearing;
// The marks this action writes: a hearing's testimony, or the email to the chair (with the chair's ask mark, core.js askMark).
export const doneKeys = B => isMail(B) ? [`${B.id}||email`, ...(B.committee?.code ? [`${B.id}|${B.committee.code}|ask`] : [])] : [`${B.id}|${B.hearing.id}|testimony`];
const read = (k, empty) => { try { return JSON.parse(localStorage.getItem(k) || 'null') || empty; } catch { return empty; } };
export const doneSet = () => new Set(read(DONE, []));
// Done: the action the bill offers now has its mark (a new hearing is a new action, so it offers testimony again).
export const isDone = B => !!B.action && doneSet().has(doneKeys(B)[0]);
// When it was marked, or '' (a mark from before hiphi_done_at was kept).
export const sentAt = B => read(DONE_AT, {})[doneKeys(B)[0]] || '';
export function markDone(B, now = new Date().toISOString()) {
  try {
    const done = doneSet(), at = read(DONE_AT, {});
    for (const k of doneKeys(B)) { done.add(k); if (!/\|ask$/.test(k)) at[k] = now; }
    localStorage.setItem(DONE, JSON.stringify([...done])); localStorage.setItem(DONE_AT, JSON.stringify(at));
  } catch { /* private mode: thanked all the same */ }
}
