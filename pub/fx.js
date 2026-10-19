// Motion and celebration for the public tracker (R-023, 9/21; DESIGN.md A-10 and C-7; the rules below are R-140, 10/10).
// One place for the small things that move, so every screen celebrates the same way and every one of them honours
// Reduce Motion. The rule that binds them all: a celebration never blocks. The next button stays visible and works during
// any of them, and nothing waits for a tap.
//   burst(el)      a small burst of petals just above the thing done: a stance, a pick, an address found, a part finished.
//                  Under 0.7 s, flying up and out so the button it came from stays readable. Under Reduce Motion there
//                  are no petals, only a brief colour change on the thing (tint).
//   celebrate(...) a moment that fills the screen for at most 1.5 s: the first action sent, a law passed. (The first
//                  visit's "Mahalo!" after the alerts ask is a page that waits for Next instead, with bloom() on it:
//                  start-rest.js stepThanks, onb.js stepJoin; R-140, Nate 11 Oct: the moment was "too quick". Since
//                  R-298, 17 Oct, stepThanks draws it at the moment's size, opening slowly, with drift().)
//                  No tap is needed. A tap, a key or a scroll closes it at once; a tap on the button under it works as
//                  usual; it leaves on its own at 1.5 s, and then its words stay for 4 s as a toast. Never mid-way through
//                  the first visit after the first follow: a full-screen moment there reads as the end (R-140).
//   tint(el)       the Reduce Motion stand-in: a colour change held for 0.6 s, with no movement.
//   travel(...)    moves one SVG group along a curve (the bill's trip through the Capitol, a letter to the committee).
//   swap(fn, dir)  a screen change that slides the way the person is going (a View Transition where the browser has
//                  one; otherwise the change simply happens).
//   afterMove(m, show) plays a moment once that slide is over (a moment on the next screen waits for the slide).
//   petals()       the finale's falling petals, the peak at the end of the first visit (C-7).
// Every moment plays side by side, at full speed or slowed, on the private motion page (motion.html, X11-4).
// Orange is the celebration colour and appears in these and almost nowhere else (C-7).
//   rooster(id, o)  R-308, the practice copy only (fxOn): the HIPHI rooster drawn for one moment on trial. roosterAt(el, id)
//                  floats a small one just above a thing done, like burst().
import { icon, toast, DEMO, fxHook, esc } from './kernel.js';

export const reduced = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
// A pause that only exists when things move: under Reduce Motion the next beat happens at once.
export const later = (fn, ms) => setTimeout(fn, reduced() ? 0 : ms);
// How long a full-screen moment stays before it leaves on its own (R-140: "within about 1.5 seconds").
export const MOMENT_MS = 1500;

// ---- a brief colour change that moves nothing: the Reduce Motion stand-in for a burst, and for a moment's words ----
// The class is held for `ms` and taken off with no animation, so the global reduced-motion rule does not shorten it away.
export function tint(el, ms = 600) {
  if (!el) return;
  el.classList.add('fx-tint');
  setTimeout(() => el.classList.remove('fx-tint'), ms);
}

// ---- a small burst of petals, just above an element (it flies up and out, never down over the thing it came from) ----
export function burst(el, n = 12, dist = 52) {
  if (!el) return;
  if (reduced()) { tint(el); return; }
  const r = el.getBoundingClientRect(), b = document.createElement('div');
  b.className = 'fx-burst'; b.setAttribute('aria-hidden', 'true');
  b.style.left = `${r.left + r.width / 2}px`; b.style.top = `${r.top - 10}px`;
  b.innerHTML = Array.from({ length: n }, (_, i) => {
    // The upper half of a circle only, so the petals fly over the screen above the thing and not over a button under them.
    const a = -Math.PI * (.08 + .84 * (i / Math.max(1, n - 1))), d = dist * (.65 + (i % 3) * .2);
    return `<i style="--x:${(Math.cos(a) * d).toFixed(1)}px;--y:${(Math.sin(a) * d).toFixed(1)}px;--c:${i % 3 ? 'var(--o400)' : i % 2 ? '#F9D56E' : 'var(--p400)'};animation-delay:${(i % 4) * 20}ms"></i>`;
  }).join('');
  document.body.appendChild(b); setTimeout(() => b.remove(), 700);
}

// ---- the finale's petals: they fall once over the drawing (the first visit's last screen, a plan's ending, and the
// version that ends on Home), inside a .st-petals box (start.css). One definition, so the three endings keep one timing.
// Each falls for 1.2-1.8 s and starts at most 0.15 s late, so the last is down within 2 s of the screen (A-10; X11-2,
// R-180: they fell for up to 3.1 s while the recap waited on them). Not drawn under Reduce Motion (start.css, home.css).
export const petals = (n = 18) => Array.from({ length: n }, (_, i) =>
  `<i style="--x:${(i * 53) % 100}%;--r:${(i * 47) % 360}deg;--t:${(1.2 + (i % 5) * .15).toFixed(2)}s;--d:${((i % 6) * .03).toFixed(2)}s;--c:${i % 3 ? 'var(--o400)' : i % 2 ? '#F9D56E' : 'var(--p300)'}"></i>`).join('');

// ---- one SVG group moved along a quadratic curve: [from, control, to] in the SVG's own units ----
// A newer trip for the same element cancels the older one, so tapping Next quickly never leaves two running.
const trips = new WeakMap();
export function travel(el, pts, ms, done, onFrame) {
  if (!el) return;
  const id = (trips.get(el) || 0) + 1; trips.set(el, id);
  const [a, c, b] = pts, t0 = performance.now();
  const at = t => { const u = 1 - t; return [u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]]; };
  const ease = t => 1 - Math.pow(1 - t, 3);
  const put = p => { el.setAttribute('transform', `translate(${p[0].toFixed(1)} ${p[1].toFixed(1)})`); onFrame && onFrame(p); };
  if (reduced() || ms <= 0) { put(b); done && done(); return; }
  const step = now => { if (trips.get(el) !== id) return; const t = Math.min(1, (now - t0) / ms); put(at(ease(t))); if (t < 1) requestAnimationFrame(step); else done && done(); };
  requestAnimationFrame(step);
}
// Stop whatever trip an element is on (a screen redrawn mid-move).
export const stopTravel = el => { if (el) trips.set(el, (trips.get(el) || 0) + 1); };

// ---- a screen change that slides the way the person is going ----
// Returns the slide's `finished` promise when a slide started, else nothing (afterMove waits on it).
export function swap(fn, dir = 'fwd') {
  document.documentElement.dataset.fxdir = dir;
  if (document.startViewTransition && !reduced()) {
    try {
      // A second change while one is still sliding cancels the first; that is fine, so its promises are quietened
      // rather than reported as errors ("Transition was aborted because of invalid state").
      const t = document.startViewTransition(fn);
      [t.ready, t.finished, t.updateCallbackDone].forEach(pr => pr && pr.catch(() => {}));
      return t.finished;
    } catch { /* fall through */ }
  }
  fn();
}
// Plays `show` once the screen change `moved` (what swap returned) is over. A moment that plays over the next screen waits
// for that screen's slide: until the slide ends, the slide's own picture covers the page and the moment's card and button
// (the browser does not take a tap there), and the card would slide under the page. Under Reduce Motion, or where the
// browser has no slide, there is nothing to wait for and `show` runs at once (R-140, fix 10/10).
export const afterMove = (moved, show) => (moved && typeof moved.then === 'function') ? moved.then(show, show) : show();

// ---- the big moments ----
// A flower that opens, with a few sparks: the first follow and the first action. Done within about 0.7 s.
export function bloom() {
  const sparks = [[-15, -12], [15, -13], [18, 6], [-18, 7], [0, -19], [-9, 16], [10, 16], [0, 20]];
  return `<div class="fx-bloom" aria-hidden="true"><svg viewBox="-24 -24 48 48" focusable="false">
    ${sparks.map(([x, y], i) => `<circle class="fx-spark" r="${i % 2 ? 1.1 : 1.6}" fill="${i % 3 ? 'var(--o400)' : '#F9D56E'}" style="--sx:${x}px;--sy:${y}px;animation-delay:${240 + i * 20}ms"/>`).join('')}
    <g>${[0, 72, 144, 216, 288].map((r, i) => `<g transform="rotate(${r})"><ellipse class="fx-petal" cx="0" cy="-8.4" rx="6.1" ry="8.4" fill="var(--o400)" style="animation-delay:${i * 50}ms"/></g>`).join('')}</g>
    <circle class="fx-heart" r="3.3" fill="#F9D56E"/></svg></div>`;
}

// A few petals that come off the opened flower and drift down and away, once, slowly (R-298, Nate 17 Oct: the first
// visit's "Mahalo!" should be "a very warm animation" again). Calm, not a shower (R-281: motion in the app's calm style):
// six petals, each 2 s, the last gone 3.4 s after the page arrives; they sit in the flower's box and never cover the words (they
// fade before they reach them). Under Reduce Motion they are not drawn at all (fx.css).
export function drift() {
  // [x drift px, fall px, turn deg, delay ms, size]: spread both ways, uneven, so it reads as a breeze, not a pattern.
  const ps = [[-58, 70, -140, 700, 1], [52, 82, 160, 820, .8], [-30, 96, 120, 980, .7], [70, 58, -110, 1100, .9], [-76, 44, 200, 1260, .6], [28, 104, -180, 1400, .75]];
  return `<div class="fx-drift" aria-hidden="true">${ps.map(([x, y, r, d, k]) => `<svg viewBox="-6 -8 12 16" focusable="false" style="--dx:${x}px;--dy:${y}px;--dr:${r}deg;--k:${k};animation-delay:${d}ms"><ellipse cx="0" cy="0" rx="5" ry="7" fill="var(--o400)"/></svg>`).join('')}</div>`;
}

// A moment that fills the screen for a short while, then gets out of the way (A-10, C-7; R-140, 10/10). It never blocks:
// the veil lets taps through, the page stays live, and its button is there from the first frame. It closes at once on a
// tap, a key (not Tab) or a scroll, and on its own at MOMENT_MS. The flow moves on BEFORE the moment is called (R-140, fix
// 10/10; start-rest.js mahalo, onb.js leaveJoin, bill.js): the screen under the veil is then the next one, so the button a
// tap reaches is that screen's own, and the old screen's bar is never live under the moment. `then` is an optional hook
// for a caller that must run something when the person continues (Continue, a tap on the veil, a key, or the timer; the
// words then stay for 4 s as a toast). No caller needs it now. A tap through to a control under the veil does not run
// `then`: that control does its own job, so one tap is never two steps. A scroll does not either, since the person is
// reading the page.
// `alt` ({ label, act }) is an Undo for something the moment did on the person's behalf (R-067). It lives in a toast with
// its own 10 s clock, not on the moment, which is gone in 1.5 s.
let live = null;
// `art` (R-308, the practice copy's rooster on trial) is drawn in the flower's place.
export function celebrate({ title, sub = '', small = '', go = 'Continue', alt = null, art = '' }, then = () => {}) {
  live?.('replaced');
  let m = document.getElementById('fx-moment');
  if (!m) { m = document.createElement('div'); m.id = 'fx-moment'; m.className = 'fx-moment'; document.body.appendChild(m); }
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  m.innerHTML = `<div class="fx-mcard" role="status" aria-live="polite">${art || bloom()}
    <p class="fx-mtitle" id="fx-mt">${esc(title)}</p>
    <div id="fx-ms">${sub ? `<p class="fx-msub">${esc(sub)}</p>` : ''}${small ? `<p class="fx-msmall">${esc(small)}</p>` : ''}</div>
    <button type="button" class="btn primary fx-mgo" id="fx-mgo"><span>${esc(go)}</span>${icon('arrow-right')}</button></div>`;
  m.hidden = false; m.classList.remove('fx-out');
  const words = [title, sub].filter(Boolean).join(' ');
  let closed = false, tFade = 0, tEnd = 0;
  // `how` says why it closed. Continue, a tap on the veil, a key and the timer move the flow on; a tap through and a
  // scroll leave it where the person put it. A moment replaced by another goes at once, silently.
  const close = how => {
    if (closed) return; closed = true;
    if (live === close) live = null;
    clearTimeout(tFade); clearTimeout(tEnd);
    document.removeEventListener('pointerdown', onDown, true); document.removeEventListener('keydown', onKey, true);
    window.removeEventListener('wheel', onScroll, true); window.removeEventListener('touchmove', onScroll, true);
    const moves = ['continue', 'tap', 'key', 'timeout'].includes(how);
    if (alt) toast(words, { yay: true, also: { label: alt.label, action: alt.act } });
    else if (how === 'timeout') toast(words, { yay: true });
    const hide = () => { m.hidden = true; m.classList.remove('fx-out'); m.innerHTML = ''; if (moves) then(); };
    if (how === 'timeout' || how === 'replaced' || reduced()) hide(); else { m.classList.add('fx-out'); setTimeout(hide, 240); }
  };
  const onDown = e => {
    if (m.contains(e.target)) return;   // the card's own button closes it through its click
    // A control takes the tap through; plain text (even a heading that is only focusable by script, tabindex -1) closes it.
    close(e.target.closest?.('a,button,input,select,textarea,label,summary,[role=button],[role=link],[role=tab],[tabindex]:not([tabindex="-1"])') ? 'through' : 'tap');
  };
  const onKey = e => {
    if (['Tab', 'Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return;   // Tab moves focus; it does not move the flow on
    close('key');
  };
  const onScroll = () => close('scroll');
  m.querySelector('#fx-mgo').onclick = () => close('continue');
  document.addEventListener('pointerdown', onDown, true);
  document.addEventListener('keydown', onKey, true);
  window.addEventListener('wheel', onScroll, { capture: true, passive: true });
  window.addEventListener('touchmove', onScroll, { capture: true, passive: true });
  if (reduced()) tint(m.querySelector('.fx-mtitle'));   // Reduce Motion: the words and a brief colour change, nothing moves
  else tFade = setTimeout(() => m.classList.add('fx-out'), MOMENT_MS - 300);
  tEnd = setTimeout(() => close('timeout'), MOMENT_MS);
  m.querySelector('#fx-mgo').focus({ preventScroll: true });
  live = close;
  return close;
}

// ================= R-308: the rooster, on trial on the practice copy only =================
// Nate (18 Oct): the rooster "everywhere it fits" (wins big and small, empty lists, errors, sending, reminders; never the
// streak or idle ones), warm but calm (R-281's cartoon was over the top). Each moment is switched on by name in the
// address, ?demo=1&fx=voice,toast or fx=all, so he can see each one beside today's; without it every screen is exactly as
// it was, and the live page never downloads the rooster (no DEMO, no fx: nothing here runs).
const FXS = DEMO ? (new URLSearchParams(location.search).get('fx') || '').split(',').map(x => x.trim()).filter(Boolean) : [];
export const fxOn = id => FXS.length > 0 && (FXS.includes('all') || FXS.includes(id));
// The packed animations (pub/rooster.js, made by tools/rooster_pack.mjs): META {id: {ms, loop}}, STAGE {id: markup of a
// 480x480 stage with the bird, about 240 px of it, in the middle}. Loaded only when a moment is switched on: the stylesheet
// as a link, the markup as a module. Nothing waits for them: a rooster asked for before they land is drawn as an empty box
// and filled the moment they do (fill()).
let RO = null;
export const fxReady = FXS.length ? Promise.all([
  new Promise(res => { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'pub/rooster.css'; l.onload = l.onerror = res; document.head.appendChild(l); }),
  // The stages are drawn with <div>s; inside a <p> (the hello's "Aloha!" line, a card's "Testimony due" line) the page's
  // parser would close the <p> at the first <div> and spill the bird out of its box, full size. So they become <span>s,
  // drawn as blocks (fx.css), which may sit anywhere.
  import('./rooster.js').then(m => { RO = { META: m.META, STAGE: Object.fromEntries(Object.entries(m.STAGE).map(([k, v]) => [k, v.replace(/<div\b/g, '<span data-rb').replace(/<\/div>/g, '</span>')])) }; })]).then(() => { fill(document); }).catch(e => console.error(e)) : Promise.resolve();
const META = id => (RO && RO.META[id]) || { ms: 0, loop: false };
// Moments already started on this page load, by key, with when they started: a screen drawn again (a redraw on data
// landing, Back) picks the rooster up where it was, or shows it still in its last pose once it is over, instead of
// playing it again (A-10: nothing replays by itself).
const played = new Map();
// rooster(id, { size, cls, key, at, fit, delay, stop, still }) returns the markup: a box `size` px square (size 0: the
// page's CSS sets --ro; the bird fills most of it) that takes no taps and is hidden from screen readers; the words beside it always say what it means (A-10).
//   key    once per page load under this key; after that, still        at     start this many ms into it (the law: the bloom)
//   fit    play it in this many ms (big-win's 1.6 s in a 1.5 s moment)  delay  hold the first pose this long, then play
//   stop   loops only: pause after this many ms (submitting at 5 s, empty-state after one cycle; A-10's 5 s)
//   still  drawn in its last pose, nothing moves
export function rooster(id, { size = 48, cls = '', key = '', at = 0, fit = 0, delay = 0, stop = 0, still = false } = {}) {
  const d = Object.entries({ key, at, fit, delay, stop }).filter(([, v]) => v).map(([k, v]) => ` data-ro-${k}="${esc(v)}"`).join('');
  return `<span class="ro${cls ? ' ' + cls : ''}" data-ro="${id}"${still ? ' data-ro-still="1"' : ''}${d}${size ? ` style="--ro:${size}"` : ''} aria-hidden="true"><span class="ro-st">${RO ? RO.STAGE[id] || '' : ''}</span></span>`;
}
// What the markup asks for, done once it is in the page: its animations are the CSS ones of rooster.css, steered here
// with the Web Animations API (each element's getAnimations()), so a rooster can start part-way, end sooner or stop.
function steer(r) {
  if (r.dataset.roOn) return; r.dataset.roOn = '1';
  if (reduced()) return;   // rooster.css draws it still under Reduce Motion; nothing to time
  const an = r.getAnimations ? r.getAnimations({ subtree: true }) : [];
  const ds = r.dataset, m = META(ds.ro);
  let gone = 0;   // ms of it already played under this key (a redraw)
  if (ds.roKey) { const t0 = played.get(ds.roKey), now = performance.now(); if (t0 === undefined) played.set(ds.roKey, now); else gone = now - t0; }
  const lasts = m.loop ? (+ds.roStop || m.ms) : (+ds.roFit || m.ms) - (+ds.roAt || 0) + (+ds.roDelay || 0);   // how long it plays, ms
  if (gone && gone >= lasts) ds.roStill = '1';
  if (ds.roStill) { an.forEach(a => { try { if (a.effect?.getTiming().iterations === Infinity) a.pause(); else a.finish(); } catch { a.pause(); } }); return; }
  if (+ds.roFit && m.ms) an.forEach(a => { a.playbackRate = m.ms / +ds.roFit; });
  const from = (+ds.roAt || 0) + gone * (+ds.roFit && m.ms ? m.ms / +ds.roFit : 1);
  if (from) an.forEach(a => { a.currentTime = from; });
  if (+ds.roDelay && !gone) { an.forEach(a => a.pause()); setTimeout(() => an.forEach(a => { if (a.playState === 'paused') a.play(); }), +ds.roDelay); }
  if (+ds.roStop) setTimeout(() => r.classList.add('ro-paused'), Math.max(0, +ds.roStop + (gone ? 0 : +ds.roDelay || 0) - gone));
}
// Fill any box drawn before the rooster arrived, and steer every new one (a screen's markup goes in as a string, so the
// page is watched rather than each screen calling in).
function fill(root) {
  if (!RO) return;
  root.querySelectorAll?.('.ro[data-ro]').forEach(r => { const st = r.firstElementChild; if (st && !st.firstElementChild) st.innerHTML = RO.STAGE[r.dataset.ro] || ''; steer(r); });
}
// html.fx-try marks a page with a moment on trial, for fixes that should reach only those pages until Nate decides (fx.css).
if (FXS.length) document.documentElement.classList.add('fx-try');
if (FXS.length) {
  const watch = () => new MutationObserver(ms => { if (!RO) return; for (const x of ms) for (const n of x.addedNodes) if (n.nodeType === 1) { if (n.matches('.ro[data-ro]')) fill(n.parentNode || n); else if (n.querySelector('.ro[data-ro]')) fill(n); } })
    .observe(document.body, { childList: true, subtree: true });
  if (document.body) watch(); else document.addEventListener('DOMContentLoaded', watch);
}
// A small rooster just above a thing done (an address found, a stance, alerts on), floating like burst()'s petals: it takes
// no taps and sits above the element, never over it or under it, so the button just pressed and Next stay clear (A-10).
// Gone with its animation (+150 ms). Under Reduce Motion it is drawn still for a moment instead.
export function roosterAt(el, id = 'small-win', { size = 44, side = 'above' } = {}) {
  if (!el || !RO || !el.isConnected) return null;
  const r = el.getBoundingClientRect(), f = document.createElement('div');
  f.className = 'ro-float'; f.setAttribute('aria-hidden', 'true');
  // 'above' (centred on its top edge), 'right' (beside it), 'on' (over it: a card's icon), or 'text' (just after the last
  // word of a heading, in the clear space beside it; where the line runs to the edge, just above that last word).
  let x = side === 'right' ? r.right + 6 + size / 2 : r.left + r.width / 2;
  let y = side === 'right' ? r.top + r.height / 2 + size / 2 : side === 'on' ? r.top + r.height / 2 + size / 2 : r.top - 2;
  if (side === 'text') {
    const rg = document.createRange(); rg.selectNodeContents(el); const ls = [...rg.getClientRects()].filter(q => q.width), q = ls[ls.length - 1] || r;
    x = q.right + 8 + size / 2; y = q.top + q.height / 2 + size / 2;
    if (x + size / 2 > innerWidth - 4) { x = q.right - size / 2; y = q.top - 2; }
  }
  f.style.left = `${Math.round(Math.min(innerWidth - size / 2 - 4, Math.max(size / 2 + 4, x)))}px`; f.style.top = `${Math.round(Math.max(size + 4, y))}px`;
  f.innerHTML = rooster(id, { size });
  document.body.appendChild(f);
  setTimeout(() => f.remove(), reduced() ? 900 : (META(id).ms || 600) + 150);
  return f;
}
// burst() with the rooster beside it when that moment is switched on: the one call the small wins make (C-7).
// o.at: the rooster stands by another element than the one the petals leave (the heading beside a list found).
// o.alone: the rooster only if no other rooster is already on screen (a tap that also brings a toast with its own).
export function cheer(id, el, n, dist, o = {}) {
  burst(el, n, dist);
  if (!fxOn(id) || (o.alone && document.querySelector('.toastmsg .ro, .ro-float'))) return;
  roosterAt(o.at || el, 'small-win', o);
}
// The hooks the kernel asks through (kernel.js fxHook): the yay toast's mark, and the art of an error or an empty list.
if (FXS.length) {
  fxHook.cheer = (id, el, n, dist, o) => { if (fxOn(id)) cheer(id, el, n, dist, o); };
  if (fxOn('toast')) fxHook.yay = () => rooster('small-win', { size: 32, cls: 'ro-toast', delay: 180 });
  fxHook.art = (id, o = {}) => {
    if (id === 'error' && fxOn('error')) return rooster('error', { size: o.size || 96, cls: 'ro-art', key: o.key || '' });
    if (id === 'empty' && fxOn('empty')) return rooster('empty-state', { size: o.size || 96, cls: 'ro-art', key: o.key || '', stop: 5000 });
    if (id === 'reminder' && fxOn('reminder')) return rooster('deadline-reminder', { size: o.size || 30, cls: 'ro-due', key: o.key || '' });
    if (id === 'sending' && fxOn('sending')) return rooster('submitting', { size: o.size || 26, cls: 'ro-busy', stop: 5000 });
    return '';
  };
}
