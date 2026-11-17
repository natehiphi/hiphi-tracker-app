// The list column's width (R-398): a handle between the list and the page, dragged or moved with the keys, remembered per person on this device.
// Every size comes from tokens.css (--list-w, --list-lo, --list-hi, --list-share, --list-step, --rail); the person's width is one inline --list-w on the root.
// The page redraws #app often (the minute's tick, a new route, the find box), which drops pointer capture and replaces the handle, so nothing here keeps a node:
// the drag lives in this module, listens on the document, and looks the handle up each time it needs it.
const KEY = 'hiphi.staff7.listw', ROOT = document.documentElement, ST = ROOT.style, $ = id => document.getElementById(id);
let who = '', drag = null, raf = 0, wantX = 0;

const tok = name => parseFloat(getComputedStyle(ROOT).getPropertyValue(name)) || 0;
const share = () => { const v = getComputedStyle(ROOT).getPropertyValue('--list-share').trim(); return (parseFloat(v) || 0) / (v.endsWith('%') ? 100 : 1); };
// the default comes from the stylesheet, so it is read with the person's own width taken off for a moment
function usual() { const v = ST.getPropertyValue('--list-w'); if (v) ST.removeProperty('--list-w'); const d = tok('--list-w'); if (v) ST.setProperty('--list-w', v); return d; }
// the smallest and largest: the page column (.ws, the window less the rail) gives the share; before the first draw it is the window less the rail
function limits() {
  const ws = document.querySelector('.ws'), w = ws ? ws.getBoundingClientRect().width : innerWidth - tok('--rail');
  return { lo: tok('--list-lo'), hi: Math.max(tok('--list-lo'), Math.min(tok('--list-hi'), Math.floor(w * share()))) };
}
const clamp = n => { const { lo, hi } = limits(); return Math.round(Math.min(hi, Math.max(lo, n))); };
// the column's real width as one whole number: rounded, then held to the limits, so the number a screen reader hears never passes the largest it is told (the style's width is not a whole pixel; the limits floor)
const real = () => { const wl = $('wl'), { lo, hi } = limits(); return Math.min(hi, Math.max(lo, wl ? Math.round(wl.getBoundingClientRect().width) : (parseFloat(ST.getPropertyValue('--list-w')) || usual()))); };

function read() { try { const o = JSON.parse(localStorage.getItem(KEY)); return o && typeof o === 'object' ? o : {}; } catch { return {}; } }
function store(n) {
  if (!who) return;
  try { const o = read(); if (n == null) delete o[who]; else o[who] = n; localStorage.setItem(KEY, JSON.stringify(o)); } catch { /* the page works without it */ }
}
const put = n => ST.setProperty('--list-w', Math.round(n) + 'px');

// Read once before the first draw: the stored width of this person, if it is a number, kept inside the limits
export function initWidth(me) {
  who = String(me?.initials || '').trim().toUpperCase();
  if (!who) return;
  const v = read()[who];
  if (typeof v === 'number' && Number.isFinite(v)) put(Math.round(Math.min(tok('--list-hi'), Math.max(tok('--list-lo'), v))));   // held to the token limits only: a narrow window's share is the style's job, so a wider window gets the width back
}

// The handle's markup: the numbers are real from the first draw, syncHandle() then reads them from the drawn column
export function handleHTML() {
  const { lo, hi } = limits(), now = clamp(parseFloat(ST.getPropertyValue('--list-w')) || usual());
  return `<div class="wsz" id="wsz" role="separator" aria-orientation="vertical" tabindex="0" aria-label="Width of the list" aria-controls="wl" aria-describedby="wszd" aria-valuemin="${lo}" aria-valuemax="${hi}" aria-valuenow="${now}" aria-valuetext="${now} pixels wide" title="Drag to change the width. Double-click for the usual width."></div><span class="sr" id="wszd">Arrow keys change the width. Home and End go to the smallest and largest. Enter restores the usual width.</span>`;
}

export const dragging = () => !!drag;

// After every draw and every window resize: the numbers a screen reader hears are the column's real width, and a drag still going keeps its mark
export function syncHandle() {
  const h = $('wsz'), wl = $('wl'); if (!h || !wl) return;
  const { lo, hi } = limits(), w = real();
  h.setAttribute('aria-valuemin', lo); h.setAttribute('aria-valuemax', hi); h.setAttribute('aria-valuenow', w); h.setAttribute('aria-valuetext', w + ' pixels wide');
  h.classList.toggle('on', !!drag);
}

function setTo(n, save) {
  put(clamp(n)); if (save) store(clamp(n)); syncHandle();
}
function reset() { ST.removeProperty('--list-w'); store(null); syncHandle(); }

// ---- the drag ----
function frame() {
  raf = 0; if (!drag) return;
  const ws = document.querySelector('.ws'); if (!ws) return;
  const w = clamp(wantX - ws.getBoundingClientRect().left - drag.grab);
  if (w !== drag.last) { drag.last = w; drag.moved = true; put(w); }
  syncHandle();
}
function move(e) { if (!drag || e.pointerId !== drag.id) return; if (e.buttons === 0) { end(e, true); return; }   // the button came up where no pointerup reached us: the drag is over
  wantX = e.clientX; if (!raf) raf = requestAnimationFrame(frame); }
function end(e, keep) {
  if (!drag || (e && e.pointerId !== drag.id)) return;
  if (raf) { cancelAnimationFrame(raf); raf = 0; }
  if (keep) frame();
  const d = drag; drag = null;
  removeEventListener('blur', lost); document.removeEventListener('pointermove', move); document.removeEventListener('pointerup', up); document.removeEventListener('pointercancel', up);
  document.body.classList.remove('wdrag'); $('wsz')?.classList.remove('on');
  if (keep && d.moved) store(clamp(real()));
  else if (!keep) { if (d.inline) ST.setProperty('--list-w', d.inline); else ST.removeProperty('--list-w'); }
  syncHandle();
}
const up = e => end(e, true), lost = () => end(null, true);   // the window lost focus mid-drag (an alert, Alt+Tab, a menu): the drag ends where it is
function down(e) {
  const h = e.target instanceof Element ? e.target.closest('.wsz') : null;
  if (!h || e.button > 0 || drag) return;
  const ws = document.querySelector('.ws'); if (!ws) return;
  e.preventDefault();   // no text selection, no native drag
  const w0 = real();
  drag = { id: e.pointerId, grab: e.clientX - ws.getBoundingClientRect().left - w0, last: w0, moved: false, inline: ST.getPropertyValue('--list-w') };   // where on the handle it was taken: the column's edge follows the pointer from there
  wantX = e.clientX;
  h.classList.add('on'); document.body.classList.add('wdrag');   // no focus is moved: a mouse drag leaves nothing focused or lit afterwards (the strong line is for the keyboard and for the drag itself)
  addEventListener('blur', lost); document.addEventListener('pointermove', move); document.addEventListener('pointerup', up); document.addEventListener('pointercancel', up);
}

// ---- the keys: on the focused handle only ----
function key(e) {
  if (drag) { if (e.key === 'Escape') { e.preventDefault(); end(null, false); } return; }
  if (!(e.target instanceof Element) || e.target.id !== 'wsz' || e.ctrlKey || e.metaKey || e.altKey) return;
  const { lo, hi } = limits(), step = tok('--list-step') * (e.shiftKey ? 4 : 1), w = real();
  if (e.key === 'ArrowRight') setTo(w + step, true);
  else if (e.key === 'ArrowLeft') setTo(w - step, true);
  else if (e.key === 'Home') setTo(lo, true);
  else if (e.key === 'End') setTo(hi, true);
  else if (e.key === 'Enter') reset();
  else return;
  e.preventDefault();
}

// Bound once: #app's HTML is replaced on every draw, so everything is on the document
document.addEventListener('pointerdown', down);
document.addEventListener('keydown', key);
document.addEventListener('dblclick', e => { if (e.target instanceof Element && e.target.closest('.wsz')) { e.preventDefault(); reset(); } });
addEventListener('resize', syncHandle);
