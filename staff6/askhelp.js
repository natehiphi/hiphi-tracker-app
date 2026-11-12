// The public ask, written in two places (Outreach's box, asks.js, and the bill's Public tab, public.js): the pieces both share
// (R-370 second walk, fix 2). Staff published asks without noticing what they had said: Saya wrote "Thu 3/19" for a Friday 3/20
// hearing, an "until" date was asked for only after Save, and nothing on the card said the ask was live. So: the hearing and
// the testimony deadline are said above the box, a gentle check names a day that is neither, and a live ask says so and can
// be taken down.
import { esc, fmtDate, fmtDT, DB, TRIAL } from './data.js';
import { hstDayOf, liveAsk, FACTS } from './model.js';
import { icon, toast, confirmSheet } from './ui.js';

const DAY = 864e5;
// When the public's written testimony closes: the hearing's deadline, else a day before it (as Today and Outreach count it).
export const testimonyAt = h => h ? new Date(h.testimony_deadline || new Date(h.scheduled_at).getTime() - DAY).getTime() : null;
// "Fri 3/20": the weekday and date, in the app's words (fmtDT without the clock).
export const dayWord = t => fmtDate(typeof t === 'number' ? new Date(t).toISOString() : t, { weekday: 'short' }).replace(/^(\w{3}),/, '$1');
// The hearing's day as the date field holds it (Hawaiʻi time), the default for "show the ask through".
export const hearingDay = h => h ? hstDayOf(new Date(h.scheduled_at).getTime()) : '';

// One line above the box: "Hearing Fri 3/20, 9:30 AM · Testimony due Wed 3/18, 9:30 AM".
export function hearingLine(h) {
  if (!h) return '';
  return `<p class="ask-hear">${icon('calendar-days')}<span>Hearing ${esc(fmtDT(h.scheduled_at))} · Testimony due ${esc(fmtDT(new Date(testimonyAt(h)).toISOString()))}</span></p>`;
}

// ---- the date check ----
const DAYS = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
const FULL = /\b(sunday|monday|tuesday|wednesday|thursday|friday|saturday|tues|thurs)\b/gi;
const ABBR = /\b(Sun|Mon|Tue|Wed|Thu|Fri|Sat)\b/g;   // capitalised only: "sat" and "mon" are words
const MD = /(^|[^\d/])(\d{1,2})\/(\d{1,2})(?![\d/])/g;
// The weekdays and dates the ask names that are neither the hearing day nor the testimony deadline's day. Returns '' when all
// is well. It never blocks saving: some asks name a rally or a meeting on another day on purpose.
export function dateNote(text, h) {
  if (!h || !String(text || '').trim()) return '';
  const hearing = new Date(h.scheduled_at).getTime(), due = testimonyAt(h);
  const wd = t => DAYS[new Date(t).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'Pacific/Honolulu' }).slice(0, 3).toLowerCase()];
  const md = t => new Date(t).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', timeZone: 'Pacific/Honolulu' });
  const okDays = new Set([wd(hearing), wd(due)]), okDates = new Set([md(hearing), md(due)]);
  const s = String(text);
  let bad = false;
  for (const m of s.matchAll(FULL)) { const k = m[1].slice(0, 3).toLowerCase(); if (!okDays.has(DAYS[k])) bad = true; }
  for (const m of s.matchAll(ABBR)) if (!okDays.has(DAYS[m[1].toLowerCase()])) bad = true;
  for (const m of s.matchAll(MD)) { const mo = +m[2], d = +m[3]; if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31 && !okDates.has(`${mo}/${d}`)) bad = true; }
  return bad ? `The hearing is ${dayWord(hearing)} and testimony closes ${dayWord(due)}. Check the date in your ask.` : '';
}
export const noteHTML = (text, h, id) => { const n = dateNote(text, h); return `<p class="inlinemsg ask-datenote" id="${id}" role="status"${n ? '' : ' hidden'}>${n ? icon('triangle-alert') + '<span>' + esc(n) + '</span>' : ''}</p>`; };
// Repaint a note made by noteHTML as the words change.
export function paintNote(el, text, h) { if (!el) return; const n = dateNote(text, h); el.hidden = !n; el.innerHTML = n ? `${icon('triangle-alert')}<span>${esc(n)}</span>` : ''; }

// ---- one tap used to publish (R-370 third walk) ----
// Publishing goes on the public page at once, so it asks first, in the same words from Outreach's box and the bill's Public tab.
// `updating`: the bill already has a live ask, so the words are about changing what people see. `until` is the date field's value.
export function confirmPublish(b, until, updating) {
  const num = String(b.bill_number || '').replace(/^([A-Z]+)\s*(\d)/, '$1 $2'), where = TRIAL ? 'the practice copy' : 'the public page';
  const thru = until ? `, through ${dayWord(until)}` : '';
  return updating
    ? confirmSheet({ title: 'Update the live public ask?', text: `${esc(num)}’s public ask is live now. This changes it on ${where} now${thru}. You can take it down any time.`, ok: 'Update' })
    : confirmSheet({ title: `Publish the public ask for ${esc(num)}?`, text: `It goes on ${where} now${thru}. You can take it down any time.`, ok: 'Publish' });
}
// Said beside the button, not below the date field.
export const goesLive = () => `<span class="ask-golive">Goes live on the ${TRIAL ? 'practice copy' : 'public page'} now</span>`;

// ---- once it is live ----
// "Live on the public page through Fri 3/20 · Take down". `take` is the button's attribute (data-asktake / data-pubtake).
export function liveLine(b, attr) {
  if (!liveAsk(b)) return '';
  return `<p class="ask-live">${icon('globe')}<span>Live on the ${TRIAL ? 'practice copy' : 'public page'} through ${esc(dayWord(b.public_action_until))} · <button type="button" class="ask-take" ${attr}="${esc(b.id)}">Take down</button></span></p>`;
}
// Take it down the way Undo does: the ask and its date go back to empty (DB.updateBill, the Undo path), and Undo puts them back.
export async function takeDown(b, after) {
  const prev = { public_action: b.public_action ?? null, public_action_until: b.public_action_until ?? null };
  await DB.updateBill(b.id, { public_action: null, public_action_until: null });
  FACTS.clear(); after();
  toast('The public ask is off the public page.', { ok: true, undo: async () => { await DB.updateBill(b.id, prev); FACTS.clear(); after(); toast('The public ask is back on the public page.'); } });
}
