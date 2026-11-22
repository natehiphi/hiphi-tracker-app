// Staff7's fifth door, More (R-398 piece 11, Nate 20 Nov): a short menu of places that have no steady way in. On a laptop it is a popover beside the rail; on a phone it is a modal
// sheet above the bottom bar. The menu holds Team, A teammate's Home (look only), Public words, then Capitol words and Committees. Personal things live in the name picker, not here.
// This file also routes the pages opened from it (#/more/words, #/more/committees, #/more/team, #/more/team/<initials>) to their own files.
import { ic } from './icons7.js';
import { esc } from './parts.js';
import { wordsPage } from './more_words.js';
import { committeesPage } from './more_committees.js';
import { pickerPage, mateHomePage } from './more_team.js';

try { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = new URL('./more.css', import.meta.url).href; document.head.appendChild(l); } catch { /* the page still works unstyled */ }

const PHONE = matchMedia('(max-width: 899px)');
export const ITEMS = [
  { href: '#/team', icon: 'users', name: 'Team', line: 'Late steps · bills with no lead' },
  { href: '#/more/team', icon: 'user', name: 'A teammate’s Home', line: 'Look only' },
  { href: '#/public', icon: 'globe', name: 'Public words', line: '' },
  { rule: true },
  { href: '#/more/words', icon: 'book-open', name: 'Capitol words', line: '' },
  { href: '#/more/committees', icon: 'landmark', name: 'Committees', line: '' },
];
let isOpen = false, layer = null, wasPhone = false;
export const moreIsOpen = () => isOpen;
const btn = () => document.getElementById('moreBtn');
const items = () => layer ? [...layer.querySelectorAll('a.mi, button.mclose')].filter(e => e.getBoundingClientRect().width > 0) : [];

// The door: a button, not a route. aria-current marks it lit while one of its pages shows; aria-expanded is its pressed look.
export const doorHTML = (name, icon, lit) => `<li><button class="bi" id="moreBtn" type="button" aria-haspopup="menu" aria-expanded="${isOpen}" aria-controls="moreMenu"${lit ? ' aria-current="page"' : ''}><span class="rpill">${ic(icon)}</span><span>${esc(name)}</span></button></li>`;

const itemHTML = it => it.rule ? '<li class="mrule" role="separator"></li>' : `<li role="none"><a class="mi" role="${wasPhone ? 'link' : 'menuitem'}" href="${it.href}"><span class="mii">${ic(it.icon)}</span><span class="mit"><b>${esc(it.name)}</b>${it.line ? ' ' : ''}${it.line ? `<span class="mu">${esc(it.line)}</span>` : ''}</span></a></li>`;

export function open() {
  if (isOpen) return; const b = btn(); if (!b) return;
  wasPhone = PHONE.matches; isOpen = true;
  layer = document.createElement('div'); layer.id = 'moreLayer'; layer.className = wasPhone ? 'mlayer phone' : 'mlayer';
  const list = `<ul class="mlist"${wasPhone ? '' : ' role="menu" aria-label="More"'}>${ITEMS.map(itemHTML).join('')}</ul>`;
  layer.innerHTML = wasPhone
    ? `<div class="mback" data-mclose></div><div class="msheet" id="moreMenu" role="dialog" aria-modal="true" aria-label="More"><div class="mgrip" aria-hidden="true"></div><div class="mtop"><button class="btn text mclose" type="button">Close</button></div>${list}</div>`
    : `<div class="msheet" id="moreMenu">${list}</div>`;
  document.body.appendChild(layer); b.setAttribute('aria-expanded', 'true');
  if (wasPhone) layer.style.setProperty('--mbar', `${Math.round(innerHeight - b.closest('.bar').getBoundingClientRect().top)}px`);   // the bar's real height: the sheet sits exactly on it
  if (!wasPhone) { const r = b.getBoundingClientRect(), m = layer.querySelector('.msheet'), bar = b.closest('.bar').getBoundingClientRect(); m.style.left = `${Math.round(bar.right + 4)}px`; m.style.top = `${Math.max(8, Math.min(Math.round(r.top - 16), innerHeight - m.offsetHeight - 16))}px`; }
  const first = layer.querySelector('a.mi'); first && first.focus({ preventScroll: true });
}
export function close(back = true) {
  if (!isOpen) return; isOpen = false;
  if (layer) { layer.remove(); layer = null; }
  const b = btn(); if (b) { b.setAttribute('aria-expanded', 'false'); if (back) b.focus({ preventScroll: true }); }
}

// swipe down on the phone sheet closes it
function bindSwipe() {
  const s = layer.querySelector('.msheet'); let y0 = null, dy = 0;
  s.addEventListener('touchstart', e => { y0 = e.touches[0].clientY; dy = 0; }, { passive: true });
  s.addEventListener('touchmove', e => { if (y0 == null) return; dy = Math.max(0, e.touches[0].clientY - y0); s.style.transform = dy ? `translateY(${dy}px)` : ''; }, { passive: true });
  s.addEventListener('touchend', () => { if (y0 == null) return; y0 = null; if (dy > 60) close(); else s.style.transform = ''; });
}

// called after each draw of the bar: the button is new each time
export function bindMore() {
  const b = btn(); if (!b) return;
  b.addEventListener('click', () => { if (isOpen) close(); else { open(); if (wasPhone && layer) bindSwipe(); } });
  if (isOpen && !layer) isOpen = false;
}

document.addEventListener('keydown', e => {
  if (!isOpen) return;
  if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); return; }
  const list = items(), i = list.indexOf(document.activeElement);
  if (e.key === 'Tab' && wasPhone) { if (!list.length) return; e.preventDefault(); list[(i + (e.shiftKey ? list.length - 1 : 1)) % list.length].focus(); return; }   // focus stays inside the sheet
  if (e.key === 'Tab') { close(true); return; }   // focus goes back to the door; the browser's Tab then moves on from there
  const mi = list.filter(x => x.classList.contains('mi')), k = mi.indexOf(document.activeElement);
  if (e.key === 'ArrowDown') { e.preventDefault(); mi[(k + 1) % mi.length].focus(); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); mi[(k <= 0 ? mi.length : k) - 1].focus(); }
  else if (e.key === 'Home') { e.preventDefault(); mi[0].focus(); }
  else if (e.key === 'End') { e.preventDefault(); mi[mi.length - 1].focus(); }
}, true);
document.addEventListener('click', e => {
  if (!isOpen || !layer) return;
  const t = e.target;
  if (t.closest?.('#moreBtn')) return;   // the door's own handler toggles
  if (t.closest?.('.mclose, [data-mclose]')) { close(); return; }
  if (t.closest?.('a.mi')) { setTimeout(() => close(false), 0); return; }   // the link goes where it goes; the page that opens takes the focus
  if (!t.closest?.('.msheet')) close(!t.closest?.('a, button, input, select, textarea, summary'));   // a click outside; focus goes back to the door unless the click took focus elsewhere
}, true);
addEventListener('hashchange', () => close(false));
PHONE.addEventListener('change', () => close(false));

// ---- the pages opened from More ----
const PAGES = { words: ['Capitol words', 'Capitol words'], committees: ['Committees', 'Committees'] };
export const moreName = id => id === 'team' ? 'teammates' : id.startsWith('team/') ? 'a teammate’s Home' : (PAGES[id] || ['the page'])[0];
// the model the frame draws: sheet, list column, label, bind, and where Back goes
export function moreModel({ me, rt, phone }) {
  const id = String(rt.id || '').replace(/\/+$/, '');
  if (id === 'words') { const p = wordsPage(); return { sheet: p.html, bind: p.bind, label: 'Capitol words', solo: true, back: '#/', backLabel: 'Home', col: '' }; }
  if (id === 'committees') { const p = committeesPage(); return { sheet: p.html, bind: p.bind, label: 'Committees', solo: true, back: '#/', backLabel: 'Home', col: '' }; }
  if (id === 'team') { const p = pickerPage(me); return { sheet: p.html, bind: p.bind, label: 'A teammate’s Home', solo: true, back: '#/', backLabel: 'Home', col: '' }; }
  if (id.startsWith('team/')) {
    const p = mateHomePage({ me, id: id.slice(5), phone });
    if (p.missing) return { sheet: p.html, bind: null, label: p.label, solo: true, back: '#/more/team', backLabel: 'teammates', col: '' };
    return { sheet: p.html, col: p.col, bind: null, label: p.label, picked: true, back: '#/more/team', backLabel: 'teammates' };
  }
  return { sheet: '<div class="pn"><div class="hband neutral"><div class="ht"><h1 tabindex="-1">That page is not here.</h1></div></div><div class="pbody"></div></div>', bind: null, label: 'More', solo: true, back: '#/', backLabel: 'Home', col: '' };
}
