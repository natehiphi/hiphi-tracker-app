// Staff7 parts: the small pieces every page is made of (button, row, due strip, sheet band, file row, note, toast, person and status marks), each with its states in app.css.
import { ic } from './icons7.js';
import { left, soonSoon, dayTime, lateLine, LABEL, pastDue } from './steps.js';

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Button: filled (the one action), quiet (a second), text (a link-weight action). href makes it a link. loading and disabled are states.
export function btn(label, { kind = 'quiet', id = '', href = '', big = false, disabled = false, loading = false, icon = '', attrs = '' } = {}) {
  const cls = `btn ${kind}${big ? ' big' : ''}${loading ? ' is-loading' : ''}`, inner = `${icon ? ic(icon) : ''}${esc(label)}`;
  return href ? `<a class="${cls}" href="${esc(href)}"${id ? ` id="${id}"` : ''} ${attrs}>${inner}</a>`
    : `<button class="${cls}" type="button"${id ? ` id="${id}"` : ''}${disabled ? ' disabled' : ''}${loading ? ' aria-busy="true"' : ''} ${attrs}>${inner}</button>`;
}

// Person mark: a person's initials in a circle.
export const personMark = (initials, { small = false } = {}) => `<span class="person${small ? ' sm' : ''}${String(initials).length > 2 ? ' p3' : ''}" aria-hidden="true">${esc(initials)}</span>`;   // p3: three letters (JMM) shrink to fit (team.css)

// Status mark: a dot or icon AND words, never colour alone.
export const statusMark = (words, { icon = '', tone = '' } = {}) => `<span class="stmark${tone ? ' ' + tone : ''}">${icon ? ic(icon) : ''}<span>${esc(words)}</span></span>`;

// The list column never cuts a fact off, so a row's second line wraps, and a count of days stays in one piece when it does ("14 days", "in 14 days"), and every "·" stays with the word after it, so a line
// breaks before a separator and never ends on one. Takes text that is already escaped; only what is drawn changes, never the words. ("kd" has a rule only at 900px and up: a phone draws it as plain text.)
const KEEP_DAYS = /· (?:in )?\d+ days?\b|· \S+|(?:in )?\d+ days?\b/g;
export const keepWords = html => String(html).replace(KEEP_DAYS, m => `<span class="kd">${m}</span>`);
// the same for a line that already holds tags (a joint committee's codes): only the text between the tags is touched
export const keepWordsHTML = html => String(html).replace(/(<[^>]*>)|([^<]+)/g, (m, tag, txt) => tag ? tag : keepWords(txt));
// "e-cigarette" never breaks after "e-": on plain escaped text (a marked name is done inside mark(), on the text before any tag exists)
export const KEEP_ECIG = /\be-cigarettes?\b/gi;
export const keepEcig = html => String(html).replace(KEEP_ECIG, m => `<span class="kd">${m}</span>`);

// A row's words: a hyphenated word never breaks after its hyphen, and the number stays with the name's last word.
const nb = s => esc(s).replace(/\S*-\S*/g, '<span class="nb">$&</span>');
const tight = s => nb(String(s).replace(/ (\S+)$/, '\u00a0$1'));

// Row: one step in the left list. The open one is the white pill with the teal bar (S-20).
const KIND_ICON = { write: 'pencil', resubmit: 'undo-2', approve: 'badge-check', second: 'badge-check', file: 'file-text', ask: 'mail', chairfu: 'mail', decide: 'mail', missed: 'circle-help', stale: 'triangle-alert', check: 'file-text' };
// `opts.risk`: a bill on this row is about to stop (a small amber triangle, with words for a screen reader, before the time). `opts.quiet`: a later step, a step quieter than To do.
export function stepRow(s, open, opts = {}) {
  const t = s.at == null ? '' : left(s.at), late = pastDue(s), amber = !opts.quiet && !late && soonSoon(s.at);
  const risk = opts.risk ? `<span class="rmark">${ic('triangle-alert')}<span class="sr">A bill is about to stop. </span></span>` : '';
  const tm = s.kind === 'missed' || (s.at == null && !late) ? '' : late ? `<span class="stm past">${risk}${ic('circle-alert')}<span>Past due</span></span>`
    : amber ? `<span class="stm soon">${risk}${ic('clock')}${esc(t)}</span>` : `<span class="stm">${risk}${esc(t)}</span>`;
  const mark = s.mark ? `<span class="stm">${risk}${ic('clock')}${esc(s.mark)}</span>` : !tm && risk ? `<span class="stm">${risk}</span>` : tm;   // a step with no time of its own says when it is for ("Today")
  return `<li><a class="sr3${opts.quiet ? ' lt' : ''}${open ? ' sel' : ''}"${open ? ' aria-current="true"' : ''} href="#/do/${encodeURIComponent(s.id)}">${ic(KIND_ICON[s.kind])}<span class="sv"><b>${esc(s.verb)}</b> <span class="sep" aria-hidden="true">·</span> ${tight(s.name)}&nbsp;<span class="no">${esc(s.no)}</span></span>${mark}</a></li>`;
}

// Due strip: the team's time to act first, the Capitol's own deadline second, then the hearing. As wide as the letter.
export function dueStrip(s, { hearing = '' } = {}) {
  const now = Date.now(), a = s.act, word = s.kind === 'ask' ? 'Ask by' : s.kind === 'missed' ? '' : `${LABEL[s.kind] || 'Due'} by`;
  let strong = '', inw = '', cap = '';
  if (s.kind === 'missed') { strong = `The hearing started ${dayTime(s.hearing.scheduled_at)}`; }
  else if (a?.kind === 'late') { strong = lateLine(s.until); cap = `The Capitol’s deadline was ${dayTime(s.due)}.`; }
  else if (a?.kind === 'overdue') { strong = `Was due ${dayTime(s.due)}`; inw = `${left(s.due)} ago`; }
  else if (a?.kind === 'now') { strong = `${LABEL[s.kind] || 'Do it'} now`; cap = `The Capitol’s deadline is ${dayTime(s.due)}, in ${left(s.due)}.`; }
  else if (s.at != null) { strong = `${word} ${dayTime(s.at)}`; inw = `in ${left(s.at)}`; if (s.due != null && s.kind !== 'ask' && Math.abs(s.due - s.at) > 6e4) cap = `The Capitol’s deadline is ${dayTime(s.due)}.`; }
  const soon = s.kind !== 'missed' && (s.late || (s.at != null && soonSoon(s.at)) || a?.kind === 'now' || a?.kind === 'overdue');   // a missed hearing is past, never amber
  return `<div class="strip${soon ? '' : ' calm'}">${ic('clock')}${strong ? `<strong>${esc(strong)}</strong>` : ''}${inw ? `<span>${esc(inw)}</span>` : ''}${cap ? `<span class="hl">${esc(cap)}</span>` : ''}${hearing ? `<span class="hl">${esc(hearing)}</span>` : ''}</div>`;
}

// File row: one document, its name, where it started, and a quiet button at the right (the part of the sample's PDF row).
export const fileRow = (name, sub, button) => `<div class="pdfrow">${ic('file-text')}<div class="g"><b>${esc(name)}</b>${sub ? `<span>${esc(sub)}</span>` : ''}</div>${button}</div>`;

// Sheet band: the issue's colour, its icon, the step's name and the bill's name with its number after it. The small issue line is left out when it is the bill's own name.
export function band(issue, title, sub, no) {
  const same = String(issue.name).trim().toLowerCase() === String(sub || '').trim().toLowerCase();
  return `<div class="hband" style="--ic:var(--cat-${esc(issue.cat)}, var(--cat-other))"><span class="imark big" aria-hidden="true">${ic(issue.icon)}</span><div class="ht">${same ? '' : `<span class="crumb">${esc(issue.name)}</span>`}<h1 tabindex="-1">${esc(title)}</h1>${sub ? `<p class="bsub">${esc(sub)}${no ? `<span class="no">${esc(no)}</span>` : ''}</p>` : ''}</div></div>`;
}
export const plainBand = (title, sub) => `<div class="hband neutral"><div class="ht"><h1 tabindex="-1">${esc(title)}</h1>${sub ? `<p class="bsub">${esc(sub)}</p>` : ''}</div></div>`;

// Note: a person's words, with who said them. Sent-back notes name nobody (the draft records only the words).
export const note = (who, words, { flag = false, mark = '' } = {}) =>
  `<div class="note${flag ? ' flag' : ''}">${mark}<div><div class="who">${esc(who)}</div><div>${esc(words)}</div></div></div>`;

// Toast with Undo: one at a time, above the docked footer, gone by itself.
let toastTimer = 0, undoFn = null;
export function toast(msg, { undo = null, ms = 6000, key = '' } = {}) {   // key: a shortcut shown beside Undo (Sort new bills: U)
  const el = document.getElementById('toast'); if (!el) return;
  undoFn = undo; el.querySelector('#toastMsg').textContent = msg;
  // above the docked footer, from its measured height (a wrapped footnote makes it taller)
  const f = document.querySelector('.sfoot'), r = f && getComputedStyle(f).position === 'sticky' ? f.getBoundingClientRect() : null;
  if (r && r.height && r.top < innerHeight && r.bottom > 0) el.style.setProperty('--toast-b', `${Math.ceil(innerHeight - r.top) + 8}px`); else el.style.removeProperty('--toast-b');
  const ub = el.querySelector('#toastUndo'); ub.hidden = !undo; ub.innerHTML = key ? `Undo <kbd class="fkey" aria-hidden="true">${esc(key)}</kbd>` : 'Undo'; if (key) ub.setAttribute('aria-keyshortcuts', key); else ub.removeAttribute('aria-keyshortcuts');
  el.classList.add('on'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('on'), ms);
}
export const clearToast = () => { clearTimeout(toastTimer); undoFn = null; document.getElementById('toast')?.classList.remove('on'); };
export function wireToast() {
  document.getElementById('toastUndo')?.addEventListener('click', () => { const f = undoFn; undoFn = null; document.getElementById('toast').classList.remove('on'); f && f(); });
}
export const toastHTML = '<div class="toast" id="toast" role="status" aria-live="polite"><div class="tin"><span id="toastMsg"></span><button class="btn text" type="button" id="toastUndo" hidden>Undo</button></div></div>';
