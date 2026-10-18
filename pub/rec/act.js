// The one thing to do on the pages about lawmakers and committees (R-303, behind ?rec=1), in the bill page's look (bill.js
// recDo, .bl-ract): the moment and how near it is, what to do in a few words, one sentence why, one filled button, how long
// it takes, and at most a way or two more. And the words every one of those pages uses for a bill: what is due next, with
// HIPHI's stance, so a bill reads the same on a lawmaker's page, a committee's page and Home ("Hearing Wed 1:00 PM").
import { app, esc, icon, nick, headline, spaced, alive, posInfo, stopOf, hearingsOf, hearingWhen, dateLong, plainStatus, codesOf, CHAMBER_NAME } from '../core.js';
import { recBack } from './kit.js';

const DAY = 864e5;
// A Capitol deadline is a date: it runs to the end of that day in Hawaiʻi.
const endOf = date => Date.parse(date + 'T23:59:59-10:00');
const dayLong = date => dateLong(date + 'T12:00:00-10:00');
// How near a moment is, for the card's pill: "Today", "Tomorrow", "In 3 days" (a hearing); "5 days left" (a deadline).
const daysTo = t => Math.max(0, Math.round((new Date(new Date(t).toLocaleDateString('en-CA', { timeZone: 'Pacific/Honolulu' }) + 'T12:00:00-10:00')
  - new Date(new Date().toLocaleDateString('en-CA', { timeZone: 'Pacific/Honolulu' }) + 'T12:00:00-10:00')) / DAY));
// "today at 1:00 PM", "on Wed at 1:00 PM", "on Wed 3/25, 1:00 PM": a hearing's moment inside a sentence.
export const atWords = iso => { const w = hearingWhen(iso); return /^(today|tomorrow) /.test(w) ? w.replace(' ', ' at ') : 'on ' + w.replace(/^(\w{3}) (\d+:\d+)/, '$1 at $2'); };
// No pill when the moment already says "today" or "tomorrow" (said once, A-14).
export const pillFor = iso => /^(today|tomorrow)/.test(hearingWhen(iso)) ? '' : soon(iso);
export const soon = t => { const d = daysTo(t); return d === 0 ? 'Today' : d === 1 ? 'Tomorrow' : `In ${d} days`; };
export const daysLeft = t => { const d = daysTo(t); return d === 0 ? 'Today' : d === 1 ? '1 day left' : `${d} days left`; };

// Hearings still ahead for a bill, in one committee when code is given (a joint hearing counts for both).
export const upcoming = (b, code = '') => hearingsOf(b).filter(h => h.status === 'scheduled' && Date.parse(h.scheduled_at) > Date.now()
  && (!code || codesOf(h.committee).includes(code)));

// What is due next on a bill, the soonest first: testimony open, a hearing, the cut-off for a hearing, a floor vote. A hearing
// counts only in the committee the bill is at now (stopOf, as the bill page reads it), or in code when one is given: the
// practice copy keeps a committee's hearing "scheduled" after its report is in and the bill has moved on (HB 1562 read
// "Hearing today" while it waited in Ways and Means). t orders rows (soonest first; Infinity when nothing is dated). warn:
// within a day (amber only then, A-5).
export function dueOf(b, code = '') {
  const now = Date.now();
  if (!alive(b)) return { kind: 'over', t: Infinity, text: plainStatus(b).short };
  const st = stopOf(b), at = codesOf(code || (st.phase === 'committee' ? st.committee : ''));
  const h = at.length ? upcoming(b).find(x => codesOf(x.committee).some(c => at.includes(c))) : null;
  if (h && h.testimony_deadline && Date.parse(h.testimony_deadline) > now && posInfo(b)) {
    const t = Date.parse(h.testimony_deadline); return { kind: 'testify', t, h, st, warn: t - now < DAY, text: `Testimony due ${hearingWhen(h.testimony_deadline)}` };
  }
  if (h) return { kind: 'hearing', t: Date.parse(h.scheduled_at), h, st, warn: Date.parse(h.scheduled_at) - now < DAY, text: `Hearing ${hearingWhen(h.scheduled_at)}` };
  const dl = st.deadline && !st.deadline.missed ? st.deadline : null;
  if (dl && st.phase === 'committee') { const t = endOf(dl.date); return { kind: 'needs', t, st, warn: t - now < DAY, text: `Needs a hearing by ${dayLong(dl.date)}` }; }
  if (dl && st.phase === 'floor') { const t = endOf(dl.date); return { kind: 'floor', t, st, warn: t - now < DAY, text: `The ${CHAMBER_NAME[st.chamber] || 'full chamber'} votes by ${dayLong(dl.date)}` }; }
  return { kind: 'other', t: Infinity, st, text: plainStatus(b).short };
}
export const byDue = (x, y) => (x.due.t - y.due.t) || x.b.bill_number.localeCompare(y.b.bill_number, 'en', { numeric: true });

// A bill named the way every page names it: the nickname first, the number always (frontend CLAUDE.md).
export const billWords = b => nick(b) ? `${nick(b)} (${spaced(b.bill_number)})` : spaced(b.bill_number);
// One quiet row for a bill: its name, then the number, HIPHI's stance and what is due ("HB 1780 · HIPHI supports · Hearing
// Wed 1:00 PM"). note replaces what is due ("Comes to Ways and Means next").
export const billRow = (b, due, { note = '', href } = {}) => ({ name: headline(b, 90), href,
  text: [spaced(b.bill_number), posInfo(b)?.text || '', note || due.text].filter(Boolean).join(' · '), warn: !note && due.warn });

// The card. when: the moment ("Hearing Wed 1:00 PM"); left: how near ("Tomorrow"); title: what to do; text: one sentence
// why (escaped here); button: the one filled button (html); more: how long it takes; after: what opens inside (an email);
// ways: rows (kit recWay) for another way to help.
export const recAct = ({ id, when = '', left = '', warn = false, title, text = '', button = '', more = '', after = '', ways = '' }) =>
  `<section class="rc-card rc-act" aria-labelledby="${esc(id)}">${when ? `<p class="rc-awhen${warn ? ' warn' : ''}">${icon('clock')}<span>${esc(when)}</span>${left ? `<span class="rc-apill">${esc(left)}</span>` : ''}</p>` : ''}
    <h2 class="rc-ah" id="${esc(id)}">${esc(title)}</h2>${text ? `<p class="rc-atext">${esc(text)}</p>` : ''}
    ${button}${more ? `<p class="rc-amore">${esc(more)}</p>` : ''}${after}${ways ? `<div class="rc-aways">${ways}</div>` : ''}</section>`;

// The back row (R-303 decision 2): the page this one was opened from when it is one of these, else the default; named as
// app.placeName names it, "Your lawmakers" for the finder (C-15: lawmakers).
const NAME = h => /^#\/legislators/.test(h) ? 'Your lawmakers' : app.placeName?.(h) || 'Back';
const PREV_OK = /^#\/(committee\/|committees|legislators|legislator\/|bill\/|issue\/|find|bills|more|$)/;
// force: the default always (a lawmaker opened from a bill goes back to that bill, ?from=).
export function backRow(def, label = '', force = false) {
  const prev = history.state?.prev || '', here = location.hash || '#/';
  const to = !force && prev && prev !== here && PREV_OK.test(prev) ? prev : def;
  return `<div class="rc-top">${recBack(to, to === def && label ? label : NAME(to))}</div>`;
}
