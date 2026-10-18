// The calm redesign of the rest of the public pages (R-303, Nate 10/17), behind ?rec=1 with the bill page in layout 3
// (R-302) until his look. Today's pages stay the default; taking the switch out of pub/app.js (REC) and this folder away
// brings them all back. These are the pieces every redesigned page shares, so they read as one product with Home (R-300)
// and the bill page: a small label over a big plain name and one sentence, one card with the one thing to do, quiet rows
// like Home's, and closed cards that show a one-line preview of what is inside and stay open for the person who opened them.
import { esc, icon } from '../kernel.js';

export const REC = () => new URLSearchParams(location.search).has('rec');

// The page's top: a small label (what kind of page, or a bill number), the name as the one h1, one plain sentence.
// `extra` is a row under it (a stance chip, a link); `back` is a link that says where it goes (B-4).
export const recHead = ({ eye = '', title, lede = '', extra = '', back = '' }) => `<header class="rc-head">${back}
  ${eye ? `<p class="rc-eye">${esc(eye)}</p>` : ''}<h1 class="rc-h1">${esc(title)}</h1>${lede ? `<p class="rc-lede">${esc(lede)}</p>` : ''}${extra ? `<div class="rc-hrow">${extra}</div>` : ''}</header>`;

// A back link that names the page behind (iOS, GOV.UK; R-238 A4-5).
export const recBack = (href, label) => `<a class="rc-back" href="${esc(href)}" data-back>${icon('arrow-left')}<span>${esc(label)}</span></a>`;

// A section heading in the bill page's size (Poppins 18), never with a count after it (R-300: counts overwhelm).
export const recSec = (id, title, inner, { note = '' } = {}) => `<section class="rc-sec" aria-labelledby="${esc(id)}"><h2 class="rc-h2" id="${esc(id)}">${esc(title)}</h2>${note ? `<p class="rc-note">${esc(note)}</p>` : ''}${inner}</section>`;

// Quiet rows, Home's shape (R-300 "the list, quieter"): a name, one status line, a chevron; the whole row is the link.
// r: { name, text, href, warn, attrs, lead } (lead: an icon name drawn in a soft circle, for people and places).
// cls BOX puts the list in one white box with a hairline between rows, as today's lists are (Nate 18 Oct, Keep or Undo
// cards 6, 7, 8, 10 and 19: "Can we include the white container box?"; rec.css .rc-box).
export const recRow = r => `<li><a class="rc-row" href="${esc(r.href)}"${Object.entries(r.attrs || {}).map(([k, v]) => ` ${k}="${esc(v)}"`).join('')}>${r.lead ? `<span class="rc-lead">${r.leadHtml || icon(r.lead)}</span>` : r.leadHtml ? `<span class="rc-lead">${r.leadHtml}</span>` : ''}
  <span class="rc-rtext"><span class="rc-rname">${esc(r.name)}</span>${r.text ? `<span class="rc-rstat${r.warn ? ' warn' : ''}">${esc(r.text)}</span>` : ''}</span>${icon('chevron-right', { cls: 'rc-chev' })}</a></li>`;
export const BOX = 'rc-box';
export const recRows = (rows, cls = '') => rows.length ? `<ul class="rc-rows${cls ? ' ' + cls : ''}" role="list">${rows.map(recRow).join('')}</ul>` : '';

// "Show all 12" in place, for long lists (C-15's words); the rest are in the page, hidden, so nothing reloads. They are rows of
// the same list (laterRow), so a boxed list opens as one box, not a second one under it.
export const laterRow = li => li.replace(/^\s*<li\b/, '<li hidden');
export const showAll = (key, words) => `<button type="button" class="btn text rc-showall" data-rc-showall="${esc(key)}" aria-expanded="false" aria-controls="rc-more-${esc(key)}">${icon('chevron-down')}<span>${esc(words)}</span></button>`;
export const recMore = (rows, n, key, cls = '') => rows.length <= n ? recRows(rows, cls)
  : `<ul class="rc-rows${cls ? ' ' + cls : ''}" role="list" id="rc-more-${esc(key)}">${rows.map((r, i) => i < n ? recRow(r) : laterRow(recRow(r))).join('')}</ul>
    ${showAll(key, `Show all ${rows.length}`)}`;

// A closed card with its title and a one-line preview of what is inside (the bill page's "Who decides next"), remembered
// open per person on this device (B-6). `name` is unique per page kind ("issue-about"), so one page's choice is not another's.
const KEY = 'hiphi_recfold2';
const opened = () => { try { const a = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(a) ? a : []; } catch { return []; } };
const remember = (name, open) => { try { const s = new Set(opened()); if (open) s.add(name); else s.delete(name); localStorage.setItem(KEY, JSON.stringify([...s])); } catch { /* private mode: closed next time */ } };
export const recFold = (name, title, prev, inner, { open = false } = {}) => `<details class="rc-fold" data-rc-fold="${esc(name)}"${open || opened().includes(name) ? ' open' : ''}><summary><span><span class="rc-ft">${esc(title)}</span>${prev ? `<span class="rc-fp">${esc(prev)}</span>` : ''}</span>${icon('chevron-down', { cls: 'rc-fchev' })}</summary><div class="rc-fin">${inner}</div></details>`;
export const recFolds = cards => cards.filter(Boolean).length ? `<div class="rc-folds">${cards.filter(Boolean).join('')}</div>` : '';

// A row inside a card that leads somewhere or does something (the bill page's "More ways to help" rows).
export const recWay = (ic, t, s, attrs = {}) => { const tag = attrs.href ? 'a' : 'button';
  return `<${tag}${tag === 'button' ? ' type="button"' : ''} class="rc-way" ${Object.entries(attrs).map(([k, v]) => `${k}="${esc(v)}"`).join(' ')}><span class="rc-wic">${icon(ic)}</span><span><span class="rc-wt">${esc(t)}</span>${s ? `<span class="rc-ws">${esc(s)}</span>` : ''}</span>${icon('chevron-right', { cls: 'rc-chev' })}</${tag}>`; };

// Follow beside an issue in a list (the category page, search): one outlined pill, "☆ Follow", or once followed the issue
// page's pale "✓ Following", which stops following with Undo (R-061: followed looks followed). One drawing for one act on
// every page (the wrap-up review of 10/18 found search drawing it as a plain button and a word). cls: a page's own hook.
export const recFollow = (i, on, cls = '') => on
  ? `<button type="button" class="rc-fpill on${cls ? ' ' + cls : ''}" data-fdissue="${esc(i.id)}" aria-pressed="true" aria-label="Following ${esc(i.name)}. Press to stop following." title="Following. Press to stop following.">${icon('check')}<span>Following</span></button>`
  : `<button type="button" class="rc-fpill${cls ? ' ' + cls : ''}" data-fdissue="${esc(i.id)}" aria-pressed="false" aria-label="Follow ${esc(i.name)}">${icon('star')}<span>Follow</span></button>`;

// A calm empty state: one sentence of what is true and one way on (B-3), no drawing (Nate: warm is words and space).
export const recEmpty = (text, action = '') => `<div class="rc-empty"><p>${esc(text)}</p>${action}</div>`;

// Wiring every page needs: the folds remember, "Show all" opens in place.
export function wireKit(root = document) {
  root.querySelectorAll('.rc-fold').forEach(d => d.addEventListener('toggle', () => remember(d.dataset.rcFold, d.open)));
  root.querySelectorAll('[data-rc-showall]').forEach(b => b.onclick = () => {
    const list = document.getElementById('rc-more-' + b.dataset.rcShowall); if (!list) return;
    const rest = [...list.querySelectorAll(':scope > li[hidden]')]; rest.forEach(li => { li.hidden = false; });
    b.remove(); rest[0]?.querySelector('a, button')?.focus({ preventScroll: true });
  });
}
