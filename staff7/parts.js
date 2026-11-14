// Staff7 parts: the small pieces every page is made of (button, row, due strip, sheet band, note, toast, person and status marks), each with its states in app.css.
import { ic } from './icons7.js';
import { left, soonSoon, isLate, dayTime } from './steps.js';

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Button: filled (the one action), quiet (a second), text (a link-weight action). href makes it a link. loading and disabled are states.
export function btn(label, { kind = 'quiet', id = '', href = '', big = false, disabled = false, loading = false, icon = '', attrs = '' } = {}) {
  const cls = `btn ${kind}${big ? ' big' : ''}${loading ? ' is-loading' : ''}`, inner = `${icon ? ic(icon) : ''}${esc(label)}`;
  return href ? `<a class="${cls}" href="${esc(href)}"${id ? ` id="${id}"` : ''} ${attrs}>${inner}</a>`
    : `<button class="${cls}" type="button"${id ? ` id="${id}"` : ''}${disabled ? ' disabled' : ''}${loading ? ' aria-busy="true"' : ''} ${attrs}>${inner}</button>`;
}

// Person mark: a person's initials in a circle.
export const personMark = (initials, { small = false } = {}) => `<span class="person${small ? ' sm' : ''}" aria-hidden="true">${esc(initials)}</span>`;

// Status mark: a dot or icon AND words, never colour alone.
export const statusMark = (words, { icon = '', tone = '' } = {}) => `<span class="stmark${tone ? ' ' + tone : ''}">${icon ? ic(icon) : ''}<span>${esc(words)}</span></span>`;

// Row: one step in the left list. The open one is the white pill with the teal bar (S-20).
export function stepRow(s, open) {
  const t = left(s.dueAt), late = isLate(s.dueAt), tm = soonSoon(s.dueAt)
    ? `<span class="stm soon">${ic('clock')}${esc(late ? t + ' overdue' : t)}</span>` : `<span class="stm">${esc(t)}</span>`;
  return `<li><a class="sr3${open ? ' sel' : ''}"${open ? ' aria-current="true"' : ''} href="#/do/${esc(s.id)}">${ic(KIND_ICON[s.kind])}<span class="sv"><b>${esc(s.verb)}</b> <span class="sep" aria-hidden="true">·</span> ${esc(s.name)} <span class="no">${esc(s.no)}</span></span>${tm}</a></li>`;
}
const KIND_ICON = { write: 'pencil', resubmit: 'undo-2', approve: 'badge-check', second: 'badge-check', file: 'file-text', ask: 'mail' };

// Due strip: the deadline, the time left, and the hearing it is for. As wide as the letter.
export function dueStrip(s, context) {
  const soon = soonSoon(s.dueAt), late = isLate(s.dueAt);
  return `<div class="strip${soon ? '' : ' calm'}">${ic('clock')}<strong>${late ? 'Was due' : 'Due'} ${esc(dayTime(s.dueAt))}</strong><span>${late ? esc(left(s.dueAt)) + ' ago' : 'in ' + esc(left(s.dueAt))}</span>${context ? `<span class="ctx">${esc(context)}</span>` : ''}</div>`;
}

// Sheet band: the issue's colour, its icon, the step's name and the bill's name with its number after it.
export function band(issue, title, sub, no) {
  return `<div class="hband" style="--ic:var(--cat-${esc(issue.cat)}, var(--cat-other))"><span class="imark big" aria-hidden="true">${ic(issue.icon)}</span><div class="ht"><span class="crumb">${esc(issue.name)}</span><h1 tabindex="-1">${esc(title)}</h1>${sub ? `<p class="bsub">${esc(sub)}${no ? `<span class="no">${esc(no)}</span>` : ''}</p>` : ''}</div></div>`;
}
export const plainBand = (title, sub) => `<div class="hband neutral"><div class="ht"><h1 tabindex="-1">${esc(title)}</h1>${sub ? `<p class="bsub">${esc(sub)}</p>` : ''}</div></div>`;

// Note: a person's words, with who said them. Sent-back notes name nobody (the draft records only the words).
export const note = (who, words, { flag = false, mark = '' } = {}) =>
  `<div class="note${flag ? ' flag' : ''}">${mark}<div><div class="who">${esc(who)}</div><div>${esc(words)}</div></div></div>`;

// Toast with Undo: one at a time, bottom of the screen, gone by itself.
let toastTimer = 0, undoFn = null;
export function toast(msg, { undo = null, ms = 6000 } = {}) {
  const el = document.getElementById('toast'); if (!el) return;
  undoFn = undo; el.querySelector('#toastMsg').textContent = msg;
  el.querySelector('#toastUndo').hidden = !undo;
  el.classList.add('on'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('on'), ms);
}
export function wireToast() {
  document.getElementById('toastUndo')?.addEventListener('click', () => { const f = undoFn; undoFn = null; document.getElementById('toast').classList.remove('on'); f && f(); });
}
export const toastHTML = '<div class="toast" id="toast" role="status" aria-live="polite"><div class="tin"><span id="toastMsg"></span><button class="btn text" type="button" id="toastUndo" hidden>Undo</button></div></div>';
