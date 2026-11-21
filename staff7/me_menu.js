// The door to a person's own things (R-398 piece 8): the initials at the foot of the rail (on a phone, a 44px circle at the top right of Home)
// open a small menu: the name, "My alerts", and "Sign out" (not in the practice copy; piece 12 makes it real).
// The menu is a real menu: Escape and a click outside close it and give the circle the focus back, arrow keys, Home and End move between
// its items, Tab leaves it. It is drawn into the page body, so the frame's redraws (the minute's tick) never lose it: the bar is drawn by
// doorHTML, which knows whether the menu is open, and a small observer puts the menu back against the new circle.
import { S } from '../staff6/data.js';
import { ic } from './icons7.js';
import { esc } from './parts.js';

const PAGE = '#/me/alerts';
const SIGN_OUT_NOTE = 'Not in the practice copy';
let openBy = '', menu = null, started = false;
const firstName = me => String(me?.full_name || '').trim().split(/\s+/)[0] || 'You';
const onPage = () => location.hash.split('?')[0].startsWith(PAGE);
const attrs = (id, me) => `id="${id}" type="button" aria-haspopup="menu" aria-expanded="${openBy === id}" aria-controls="meMenu" aria-label="${esc(firstName(me))}, Practice, menu"${onPage() ? ' aria-current="page"' : ''}`;

// the rail's door: the circle, the first name and "Practice" under it (the frame draws it in place of the old plain circle)
export const doorHTML = me => `<span class="who"><button class="medoor${openBy === 'meDoor' ? ' open' : ''}" ${attrs('meDoor', me)}><span class="person" aria-hidden="true">${esc(me?.initials)}</span><span class="mename">${esc(firstName(me))}</span><span class="prac">Practice</span></button></span>`;
// the phone's door: only the circle, at the top right of Home (me.css shows it below 900px)
export const phoneDoorHTML = me => `<button class="medoor medoor-p person${openBy === 'meDoorP' ? ' open' : ''}" ${attrs('meDoorP', me)}>${esc(me?.initials)}</button>`;

const items = () => menu ? [...menu.querySelectorAll('[role="menuitem"]')] : [];
function build() {
  const me = S.me;
  const el = document.createElement('div');
  el.id = 'meMenu'; el.className = 'memenu'; el.setAttribute('role', 'menu'); el.setAttribute('aria-label', `${firstName(me)}, account`); el.hidden = true;
  el.innerHTML = `<p class="memname" role="presentation">${esc(firstName(me))}</p>`
    + `<a class="memi" role="menuitem" tabindex="-1" href="${PAGE}">${ic('bell')}<span class="memt"><b>My alerts</b></span></a>`
    + `<div class="memi dis" role="menuitem" tabindex="-1" aria-disabled="true">${ic('log-out')}<span class="memt"><b>Sign out</b><span>${SIGN_OUT_NOTE}</span></span></div>`;
  document.body.appendChild(el);
  return el;
}
// put the menu against its circle: above the rail's circle, below the phone's
function place() {
  const d = openBy && document.getElementById(openBy);
  if (!menu || !d) return;
  const r = d.getBoundingClientRect();
  if (!r.width) { close(); return; }
  menu.style.top = menu.style.bottom = menu.style.left = menu.style.right = 'auto';
  if (openBy === 'meDoorP') { menu.style.top = `${Math.round(r.bottom + 8)}px`; menu.style.right = `${Math.max(8, Math.round(innerWidth - r.right))}px`; }
  else { menu.style.left = `${Math.max(8, Math.round(r.left - 8))}px`; menu.style.bottom = `${Math.round(innerHeight - r.top + 8)}px`; }
}
function setExpanded() { document.querySelectorAll('#meDoor, #meDoorP').forEach(b => { const on = b.id === openBy; b.setAttribute('aria-expanded', String(on)); b.classList.toggle('open', on); }); }
export function openMenu(id) {
  if (openBy === id) return;
  if (openBy) close();
  menu = menu || build(); menu.hidden = false; openBy = id; setExpanded(); place();
  items()[0]?.focus({ preventScroll: true });
}
export function close({ focus = false } = {}) {
  if (!openBy) return;
  const d = document.getElementById(openBy);
  openBy = ''; if (menu) menu.hidden = true; setExpanded();
  if (focus && d) d.focus({ preventScroll: true });
}
export const menuOpen = () => !!openBy;

export function initMenu() {
  if (started) return; started = true;
  document.addEventListener('click', e => {
    const d = e.target.closest?.('#meDoor, #meDoorP');
    if (d) { e.preventDefault(); if (openBy === d.id) close({ focus: true }); else openMenu(d.id); return; }
    if (!openBy) return;
    if (e.target.closest?.('#meMenu')) { if (e.target.closest('a.memi')) close(); return; }   // My alerts: the page opens, the menu goes
    close({ focus: !e.target.closest?.('a, button, input, select, textarea, summary') });   // a click on nothing hands the focus back to the circle; a click on a control keeps its own
  });
  document.addEventListener('keydown', e => {
    if (!openBy) return;
    const list = items(), at = list.indexOf(document.activeElement);
    if (e.key === 'Escape') { e.preventDefault(); close({ focus: true }); return; }
    if (e.key === 'Tab') { e.preventDefault(); close({ focus: true }); return; }
    if (!menu.contains(document.activeElement)) return;
    const go = i => { e.preventDefault(); list[(i + list.length) % list.length]?.focus({ preventScroll: true }); };
    if (e.key === 'ArrowDown') go(at + 1); else if (e.key === 'ArrowUp') go(at - 1);
    else if (e.key === 'Home') go(0); else if (e.key === 'End') go(list.length - 1);
    else if (e.key === ' ' && document.activeElement.matches('a')) { e.preventDefault(); document.activeElement.click(); }
  }, true);
  addEventListener('hashchange', () => close());
  addEventListener('resize', place);
  // the frame draws the bar and the page again: the new circle says "open" (doorHTML) and the menu moves back against it
  const mo = new MutationObserver(() => { if (openBy) { setExpanded(); place(); } });
  for (const id of ['bar-slot', 'app']) { const n = document.getElementById(id); n && mo.observe(n, { childList: true }); }
}
