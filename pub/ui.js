// Shared building blocks for every public screen: buttons, chips, rows, empty states, skeletons, the step bar.
// Screens compose these so a button, a chip or a row looks and behaves the same everywhere.
import { esc, icon, posInfo, issueIcon } from './kernel.js';

const attrs = a => Object.entries(a || {}).filter(([, v]) => v !== undefined && v !== null && v !== false)
  .map(([k, v]) => v === true ? ` ${k}` : ` ${k}="${esc(v)}"`).join('');
// btn('Write my testimony', { kind: 'primary', icon: 'notebook-pen', full: true, attrs: { 'data-helper': id } })
export function btn(label, { kind = 'primary', icon: ic, iconEnd, full, sm, href, attrs: a, cls = '' } = {}) {
  const c = `btn ${kind}${full ? ' full' : ''}${sm ? ' sm' : ''}${cls ? ' ' + cls : ''}`;
  const inner = `${ic ? icon(ic) : ''}<span>${label}</span>${iconEnd ? icon(iconEnd) : ''}`;
  const { type = 'button', ...rest } = a || {};   // a submit button passes attrs: { type: 'submit' }
  return href ? `<a class="${c}" href="${esc(href)}"${attrs(a)}>${inner}</a>` : `<button type="${esc(type)}" class="${c}"${attrs(rest)}>${inner}</button>`;
}
export const iconBtn = (ic, label, a = {}, cls = '') => `<button type="button" class="iconbtn${cls ? ' ' + cls : ''}" aria-label="${esc(label)}" title="${esc(label)}"${attrs(a)}>${icon(ic)}</button>`;
// status chip (not a button): tone '' | info | warn | danger | ok | yay
export const chip = (text, tone = '', ic) => `<span class="chip${tone ? ' ' + tone : ''}">${ic ? icon(ic) : ''}${esc(text)}</span>`;
// A strong position gets its icon twice - two thumbs up for "strongly supports" (Nate, 9/20). The
// text already says it; the pair is what makes it readable at a glance down a list.
export const posChip = b => { const p = posInfo(b); if (!p) return '';
  return p.strong ? `<span class="chip info">${icon(p.icon)}${icon(p.icon)}${esc(p.text)}</span>` : chip(p.text, 'info', p.icon); };
export const issueLine = (iss, extra = '') => iss ? `<span class="issueline">${icon(issueIcon(iss.icon))}<span>${esc(iss.key)}</span>${extra}</span>` : '';
// A whole-row button or link: row({ lead: 'salad', title, sub, end, href | attrs })
export function row({ lead, leadHtml, title, sub, end = '', chevron = true, href, attrs: a, cls = '' }) {
  const inner = `${leadHtml || (lead ? `<span class="lead">${icon(lead)}</span>` : '')}<span class="body"><span class="title">${title}</span>${sub ? `<span class="sub">${sub}</span>` : ''}</span><span class="end">${end}${chevron ? icon('chevron-right', { cls: 'chev' }) : ''}</span>`;
  return href ? `<a class="row${cls ? ' ' + cls : ''}" href="${esc(href)}"${attrs(a)}>${inner}</a>` : `<button type="button" class="row${cls ? ' ' + cls : ''}"${attrs(a)}>${inner}</button>`;
}
export const empty = ({ art = '', title, text = '', action = '', h = 'h2' }) => `<div class="empty">${art ? `<div class="art">${art}</div>` : ''}${title ? `<${h}>${title}</${h}>` : ''}${text ? `<p>${text}</p>` : ''}${action}</div>`;
export const skeleton = (n = 4) => `<div class="skelpage" aria-busy="true" aria-label="Loading"><div class="skel" style="height:96px"></div>${Array.from({ length: n }, () => '<div class="skel" style="height:64px"></div>').join('')}</div>`;
export const notice = (tone, ic, html) => `<div class="notice ${tone}">${icon(ic)}<div>${html}</div></div>`;
// "e-cigarettes" (and any "e-" word: e-liquids, e-bikes) stays whole on a line (X9-1, R-180). A browser may break a line
// after a hyphen, so a 28px title read "Disposable e-" / "cigarette ban" on a phone, like a typo. Display only: each match
// is wrapped in a no-break span as it reaches the page (one observer for every screen, sheet and list), so the data,
// search, share text and copied text are unchanged. Never inside a field, a select's options, a drawing or a script.
const EWORD = /\b[Ee]-[A-Za-z]+/g, EWORD1 = /\b[Ee]-[A-Za-z]/;
const NOWRAP_SKIP = 'textarea, script, style, option, select, svg, .nobr, [contenteditable]';
function wrapWords(t) {
  const el = t.parentElement, v = t.nodeValue;
  if (!el || !EWORD1.test(v) || el.closest(NOWRAP_SKIP)) return;
  const frag = document.createDocumentFragment(); let at = 0;
  for (const m of v.matchAll(EWORD)) {
    if (m.index > at) frag.append(v.slice(at, m.index));
    const s = document.createElement('span'); s.className = 'nobr'; s.textContent = m[0]; frag.append(s);
    at = m.index + m[0].length;
  }
  if (at < v.length) frag.append(v.slice(at));
  // In a flex or grid box every child is laid out on its own and the spaces at its edges vanish, so a link in version A's
  // week read "Disposablee-cigaretteban" (found 10/6, R-195): there the pieces stay one item inside a plain span.
  let out = frag;
  try { if (/flex|grid/.test(getComputedStyle(el).display)) { out = document.createElement('span'); out.append(frag); } } catch { /* the pieces as they are */ }
  t.replaceWith(out);
}
function wrapIn(node) {
  if (node.nodeType === 3) return wrapWords(node);
  if (node.nodeType !== 1 || !EWORD1.test(node.textContent || '') || node.closest(NOWRAP_SKIP)) return;
  const w = document.createTreeWalker(node, NodeFilter.SHOW_TEXT), list = [];
  for (let t; (t = w.nextNode());) if (EWORD1.test(t.nodeValue)) list.push(t);
  list.forEach(wrapWords);
}
export function keepWordsWhole(root = document.body) {
  try {
    wrapIn(root);
    new MutationObserver(recs => { for (const r of recs) r.addedNodes.forEach(wrapIn); }).observe(root, { childList: true, subtree: true });
  } catch { /* without the observer every word still shows, only with the browser's own line breaks */ }
}
export const inlineErr = (id, text) => `<div class="inlinemsg" id="${id}" role="alert">${icon('circle-alert')}<span>${esc(text)}</span></div>`;
