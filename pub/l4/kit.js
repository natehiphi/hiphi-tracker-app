// Look 4's kit (R-412): the parts every look-4 screen is made of, as functions that return HTML strings. Their CSS is pub/l4/kit.css
// (classes l4-*, all scoped under body.l4, which pub/app.js sets on every route while ?look4=1 is on). Mockups: Mix-Home, Mix-Bill,
// K1 to K4 (the deadline block), J6 (the bill row). Words go through t() (pub/i18n.js); a label you pass in is HTML, already escaped and
// translated by you, as today's btn() in ui.js takes it. `attrs` is an object of HTML attributes ({ href, 'data-x': 1, class: 'extra' }).
//
//   hero({ top, body, ridge = true })      The deep-ocean block: leaf print behind `top` and `body` (HTML you build), and the sand ridge at
//                                          its bottom edge. Put `<h1 class="l4-h1">` and `<p class="l4-lede">` in `body`; a picture in
//                                          `.l4-hero-pic`. The block after it (actions(...)) rides up 44px over the ridge.
//   heroTop({ back, greeting, right })     The row at the top of a hero. back: { href, label } draws the white round back button;
//                                          greeting: a string (escaped here) in Bricolage 600 ("Aloha, Keoni"); right: HTML (roundButton(...), etc.).
//   roundButton(iconName, label, attrs)    A 44px white round button with a Lucide icon (share, search), for a hero's right side.
//   actions(html, label)                   The section under a hero that holds the main button(s); overlaps the ridge.
//   deadline(args)                         The day-first deadline block, drawn inside a hero's `body` (see below). '' when nothing is due.
//   deadlineState(args)                    The same, as data: { kind, label, day, time, count, amber } or null (for rows and tests).
//   dueArgs(bill)                          { due, hearing, needsBy } for a bill, from the app's own stop rules (core.js stopOf), ready for deadline().
//   dueLine(state, withCount)              One plain line for a row's amber sub line: "Testimony due Wed 9:30 AM · 2 days left", or '' when
//                                          nothing is due; also "Needs a hearing by Mon, Mar 30" and "Testimony deadline passed Wed 9:30 AM".
//   mainButton(label, attrs)               The one orange button (52px pill). One per screen. <a> when attrs.href is set, else <button>.
//   secondButton(label, attrs)             The outline button (1.5px blue edge, transparent).
//   quietLink(label, attrs)                A text-only link-coloured control, 44px tall.
//   sectionHead(title, sub)                An h2 (Bricolage 22/700) with an optional small grey line under it.
//   row({ title, sub, sub2, href, mark, tone })   The plain row: optional `mark` (HTML: an issue mark, drawing or icon, 44px) on the left, the
//                                          title (17/600), `sub` (14px; amber-brown when tone === 'amber', else grey), `sub2` (14px grey),
//                                          and a chevron. title, sub, sub2 are plain text (escaped here). href makes it a link.
//   billRow(bill, opts)                    J6's one row for a bill: its nickname, or its whole sentence when it has none, then the amber due
//                                          line (opts.count adds "2 days left"), then "HB 2121 · HIPHI supports". opts.href overrides the link.
//   lei(n, { total = 7 })                  The lei: n flowers open (orange), the rest buds, on a sand-coloured string.
//   KIT_VERSION                            Bump when a part's markup changes shape.
//
// deadline(args) / deadlineState(args): args = { due, hearing, needsBy, now }
//   due      ISO time the written testimony is due (a hearing's testimony_deadline)
//   hearing  ISO time of the hearing (needed only to draw the "deadline passed, hearing ahead" state)
//   needsBy  'YYYY-MM-DD', the last day a committee can hear a bill that is waiting for a hearing
//   now      ms, for tests (default Date.now())
// States: 'due' (day word large, the time beside it, "N days left"), 'last' (due today: the count is "under N hours left", amber, and a
// page left open keeps it true), 'late' (due passed, hearing ahead: "Hearing", the hearing's day and time, amber "Testimony deadline passed
// ..."), 'waiting' ("Needs a hearing by", the date alone, "N days left"), or null (no block). Days are Hawaii calendar days, as today's chips.
import { esc, icon, hstDay, spaced, posInfo, nick, app, billPath } from '../kernel.js';
import { t } from '../i18n.js';
import { dayWord, timeWord, dateLong, stopOf, issuesOf } from '../core.js';
import { dayShort } from '../v2/slide.js';
import { issueMark } from '../art.js';
import { what } from '../mybills.js';

export const KIT_VERSION = 1;

const HST_NOON = d => new Date(`${hstDay(d)}T12:00:00-10:00`).getTime();
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const attrs = a => Object.entries(a || {}).filter(([k, v]) => k !== 'class' && k !== 'href' && v !== false && v != null).map(([k, v]) => v === true ? ` ${k}` : ` ${k}="${esc(String(v))}"`).join('');
const daysLeft = n => n === 1 ? t('1 day left') : t('{n} days left', { n });
const hoursLeft = ms => { const h = Math.ceil(ms / 36e5); return h <= 1 ? t('under an hour left') : t('under {n} hours left', { n: h }); };

// ---- the deadline block (BRIEF-DEADLINE.md) ----
export function deadlineState({ due, hearing, needsBy, now = Date.now() } = {}) {
  if (due) {
    const left = Date.parse(due) - now;
    if (left > 0) {
      const today = hstDay(now) === hstDay(due), n = Math.round((HST_NOON(due) - HST_NOON(now)) / 864e5), d = dayShort(due);
      const day = d === 'today' ? t('Today') : d === 'tomorrow' ? t('Tomorrow') : d;
      return { kind: today ? 'last' : 'due', label: t('Testimony due'), day, dayLow: d, time: timeWord(due), count: today ? hoursLeft(left) : daysLeft(Math.max(n, 1)), amber: today, due };
    }
    if (hearing && Date.parse(hearing) > now) {
      const was = hstDay(now) === hstDay(due) ? `${t('today')} ${timeWord(due)}` : `${dateLong(due)} ${t('at')} ${timeWord(due)}`;
      return { kind: 'late', label: t('Hearing'), day: cap(dayShort(hearing)), time: timeWord(hearing), count: `${t('Testimony deadline passed')} ${was}`, amber: true };
    }
    return null;
  }
  if (needsBy) {
    const n = Math.round((HST_NOON(needsBy + 'T12:00:00-10:00') - HST_NOON(now)) / 864e5);
    if (n < 0) return null;
    const day = new Date(`${needsBy}T12:00:00-10:00`).toLocaleDateString('en-US', { timeZone: 'Pacific/Honolulu', month: 'short', day: 'numeric' });
    return { kind: 'waiting', label: t('Needs a hearing by'), day, time: '', count: n === 0 ? t('Last day') : daysLeft(n), amber: false };
  }
  return null;
}
export function deadline(args) {
  const s = deadlineState(args); if (!s) return '';
  return `<div class="l4-dl" data-dl="${s.kind}"><div class="l4-dl-label">${esc(s.label)}</div>
    <div class="l4-dl-when"><span class="l4-dl-day">${esc(s.day)}</span>${s.time ? `<span class="l4-dl-time">${esc(s.time)}</span>` : ''}</div>
    <div class="l4-dl-count${s.amber ? ' amber' : ''}"${s.kind === 'last' ? ` data-l4due="${esc(s.due)}"` : ''}>${esc(s.count)}</div></div>`;
}
// A page left open on the last day keeps its hours true; when the time runs out the screen is drawn again, in its late state.
if (typeof window !== 'undefined') setInterval(() => {
  if (document.hidden) return;
  let over = false;
  document.querySelectorAll('[data-l4due]').forEach(el => { const left = Date.parse(el.dataset.l4due) - Date.now(); if (left <= 0) over = true; else { const w = hoursLeft(left); if (el.textContent !== w) el.textContent = w; } });
  if (over) app.render?.();
}, 60000);
// For a bill: what to hand deadline(). A scheduled hearing gives its testimony deadline; a bill waiting in committee gives the last day for a hearing.
export function dueArgs(b) {
  if (!b) return {};
  const st = stopOf(b);
  if (st.hearingState === 'scheduled' && st.hearing) return { due: st.hearing.testimony_deadline || '', hearing: st.hearing.scheduled_at };
  if (st.phase === 'committee' && st.hearingState === 'none' && st.deadline && !st.deadline.missed) return { needsBy: String(st.deadline.date).slice(0, 10) };
  return {};
}
export function dueLine(s, withCount = false) {
  if (!s) return '';
  const when = s.kind === 'waiting' ? `${s.label} ${s.day}` : s.kind === 'late' ? s.count : `${s.label} ${s.dayLow === 'today' || s.dayLow === 'tomorrow' ? t(s.dayLow) : s.day} ${s.time}`;
  return withCount && (s.kind === 'due' || s.kind === 'last' || s.kind === 'waiting') ? `${when} · ${s.count}` : when;
}

// ---- hero ----
const PRINT = `<svg class="l4-print" aria-hidden="true" width="390" height="640" viewBox="0 0 390 640"><defs><pattern id="l4print" width="132" height="132" patternUnits="userSpaceOnUse" patternTransform="rotate(-14)"><g transform="translate(34 34) rotate(-38) scale(0.82)" fill="#FFFFFF"><path d="M0 -20C11 -10 11 10 0 20C-11 10 -11 -10 0 -20Z"/></g><g transform="translate(100 58) rotate(32)" fill="#FFFFFF"><path d="M0 -20C11 -10 11 10 0 20C-11 10 -11 -10 0 -20Z"/></g></pattern></defs><rect width="390" height="640" fill="url(#l4print)"/></svg>`;
const RIDGE = `<svg class="l4-ridge" aria-hidden="true" viewBox="0 0 390 84" preserveAspectRatio="none"><path d="M0 31L47.3 13.7Q52 12 56.9 13.2L107.1 25.8Q112 27 116.8 25.5L173.2 7.5Q178 6 182.8 7.5L233.2 23.5Q238 25 242.8 23.7L297.2 9.3Q302 8 306.8 9.4L347.2 21.6Q352 23 356.8 21.6L390 12L390 84L0 84Z" fill="#0E5473"/><path d="M0 56L37.3 42.7Q42 41 46.9 42.0L81.1 49.0Q86 50 90.7 48.2L147.3 26.8Q152 25 156.7 26.8L197.3 42.2Q202 44 206.9 43.0L259.1 33.0Q264 32 268.8 30.7L317.2 18.3Q322 17 326.4 19.3L357.6 35.7Q362 38 366.8 36.6L390 30L390 84L0 84Z" fill="#FFF8EF"/></svg>`;
export const hero = ({ top = '', body = '', ridge = true } = {}) => `<header class="l4-hero">${PRINT}<div class="l4-hero-in">${top}${body}</div>${ridge ? RIDGE : ''}</header>`;
export const heroTop = ({ back, greeting, right = '' } = {}) => `<div class="l4-top${back ? ' has-back' : ''}">${back ? `<a class="l4-round" href="${esc(back.href)}" aria-label="${esc(back.label || t('Back'))}">${icon('arrow-left', { size: 24 })}</a>` : ''}${greeting ? `<div class="l4-greet">${esc(greeting)}</div>` : ''}<span class="l4-top-gap"></span>${right}</div>`;
export const roundButton = (ic, label, a = {}) => `<${a.href ? 'a' : 'button type="button"'} class="l4-round${a.class ? ' ' + esc(a.class) : ''}" aria-label="${esc(label)}"${a.href ? ` href="${esc(a.href)}"` : ''}${attrs(a)}>${icon(ic, { size: 22 })}</${a.href ? 'a' : 'button'}>`;
export const actions = (html, label = '') => `<section class="l4-actions"${label ? ` aria-label="${esc(label)}"` : ''}>${html}</section>`;

// ---- buttons, links, heads ----
const control = (cls, label, a) => a?.href ? `<a class="${cls}${a.class ? ' ' + esc(a.class) : ''}" href="${esc(a.href)}"${attrs(a)}>${label}</a>` : `<button type="button" class="${cls}${a?.class ? ' ' + esc(a.class) : ''}"${attrs(a)}>${label}</button>`;
export const mainButton = (label, a) => control('l4-main', label, a);
export const secondButton = (label, a) => control('l4-second', label, a);
export const quietLink = (label, a) => control('l4-quiet', label, a);
export const sectionHead = (title, sub = '') => `<div class="l4-head"><h2>${esc(title)}</h2>${sub ? `<p>${esc(sub)}</p>` : ''}</div>`;

// ---- rows ----
const CHEV = icon('chevron-right', { size: 20 });
export function row({ title, sub = '', sub2 = '', href = '', mark = '', tone = '' } = {}) {
  const inner = `${mark ? `<span class="l4-mark">${mark}</span>` : ''}<span class="l4-row-text"><span class="l4-row-t">${esc(title)}</span>${sub ? `<span class="l4-row-s${tone === 'amber' ? ' amber' : ''}">${esc(sub)}</span>` : ''}${sub2 ? `<span class="l4-row-s">${esc(sub2)}</span>` : ''}</span><span class="l4-chev">${CHEV}</span>`;
  return href ? `<a class="l4-row" href="${esc(href)}">${inner}</a>` : `<div class="l4-row">${inner}</div>`;
}
export function billRow(b, o = {}) {
  const name = nick(b), num = spaced(b.bill_number), p = posInfo(b), s = deadlineState(dueArgs(b));
  const line = dueLine(s, !!o.count), id = [num, p?.text].filter(Boolean).join(' · ');
  return row({ title: name || what(b, 200), sub: line, tone: line ? 'amber' : '', sub2: id, href: o.href || billPath(b), mark: issueMark(issuesOf(b)[0], { size: 44 }) });
}

// ---- the lei ----
const FLOWER = '<ellipse cx="0" cy="-6.6" rx="4.6" ry="6.6" fill="#F68B2C" transform="rotate(R)"/>';
const CORE = '<ellipse cx="0" cy="-6.2" rx="1.7" ry="4.2" fill="#FBB368" transform="rotate(R)"/>';
const turns = [0, 72, 144, 216, 288];
const OPEN = `${turns.map(r => FLOWER.replace('R', r)).join('')}${turns.map(r => CORE.replace('R', r)).join('')}<circle cx="0" cy="0" r="2.8" fill="#F4B223"/>`;
const BUD = '<path d="M0 -11 C7 -6 8.5 3 0 10 C-8.5 3 -7 -6 0 -11Z" fill="#F3C79C"/><path d="M0 -11 C7 -6 8.5 3 0 10 C4.2 4 3.4 -5 0 -11Z" fill="#F8B57A"/>';
const SPOTS = [[49, 24.5], [91, 32], [133, 36.5], [175, 38], [217, 36.5], [259, 32], [301, 24.5]];
export function lei(n = 0, { total = 7 } = {}) {
  const open = Math.max(0, Math.min(total, n | 0)), at = SPOTS.slice(0, total);
  const label = open === 1 ? t('A lei with one opened flower and {n} buds', { n: total - 1 }) : t('A lei with {a} opened flowers and {n} buds', { a: open, n: total - open });
  return `<svg class="l4-lei" viewBox="0 0 350 54" role="img" aria-label="${esc(label)}"><path d="M0 12 Q175 64 350 12" fill="none" stroke="#DCC6A2" stroke-width="2" stroke-linecap="round"/>${at.map(([x, y], i) => i < open ? `<g transform="translate(${x} ${y}) scale(1.5)">${OPEN}</g>` : `<g transform="translate(${x} ${y})">${BUD}</g>`).join('')}</svg>`;
}
