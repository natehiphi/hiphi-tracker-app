// Motion and celebration for the public tracker (R-023, 9/21; DESIGN.md A-10 and C-7; the rules below are R-140, 10/10).
// One place for the small things that move, so every screen celebrates the same way and every one of them honours
// Reduce Motion. The rule that binds them all: a celebration never blocks. The next button stays visible and works during
// any of them, and nothing waits for a tap.
//   burst(el)      a small burst of petals just above the thing done: a stance, a pick, an address found, a part finished.
//                  Under 0.7 s, flying up and out so the button it came from stays readable. Under Reduce Motion there
//                  are no petals, only a brief colour change on the thing (tint).
//   celebrate(...) a moment that fills the screen for at most 1.5 s: the first follow, the first action sent, a law passed.
//                  No tap is needed. A tap, a key or a scroll closes it at once; a tap on the button under it works as
//                  usual; it leaves on its own at 1.5 s, and then its words stay for 4 s as a toast. Never mid-way through
//                  the first visit after the first follow: a full-screen moment there reads as the end (R-140).
//   tint(el)       the Reduce Motion stand-in: a colour change held for 0.6 s, with no movement.
//   travel(...)    moves one SVG group along a curve (the bill's trip through the Capitol, a letter to the committee).
//   swap(fn, dir)  a screen change that slides the way the person is going (a View Transition where the browser has
//                  one; otherwise the change simply happens).
//   petals()       the finale's falling petals, the peak at the end of the first visit (C-7).
// Every moment plays side by side, at full speed or slowed, on the private motion page (motion.html, X11-4).
// Orange is the celebration colour and appears in these and almost nowhere else (C-7).
import { icon, toast } from './kernel.js';

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
export function swap(fn, dir = 'fwd') {
  document.documentElement.dataset.fxdir = dir;
  if (document.startViewTransition && !reduced()) {
    try {
      // A second change while one is still sliding cancels the first; that is fine, so its promises are quietened
      // rather than reported as errors ("Transition was aborted because of invalid state").
      const t = document.startViewTransition(fn);
      [t.ready, t.finished, t.updateCallbackDone].forEach(pr => pr && pr.catch(() => {}));
      return;
    } catch { /* fall through */ }
  }
  fn();
}

// ---- the big moments ----
// A flower that opens, with a few sparks: the first follow and the first action. Done within about 0.7 s.
export function bloom() {
  const sparks = [[-15, -12], [15, -13], [18, 6], [-18, 7], [0, -19], [-9, 16], [10, 16], [0, 20]];
  return `<div class="fx-bloom" aria-hidden="true"><svg viewBox="-24 -24 48 48" focusable="false">
    ${sparks.map(([x, y], i) => `<circle class="fx-spark" r="${i % 2 ? 1.1 : 1.6}" fill="${i % 3 ? 'var(--o400)' : '#F9D56E'}" style="--sx:${x}px;--sy:${y}px;animation-delay:${240 + i * 20}ms"/>`).join('')}
    <g>${[0, 72, 144, 216, 288].map((r, i) => `<g transform="rotate(${r})"><ellipse class="fx-petal" cx="0" cy="-8.4" rx="6.1" ry="8.4" fill="var(--o400)" style="animation-delay:${i * 50}ms"/></g>`).join('')}</g>
    <circle class="fx-heart" r="3.3" fill="#F9D56E"/></svg></div>`;
}

// A moment that fills the screen for a short while, then gets out of the way (A-10, C-7; R-140, 10/10). It never blocks:
// the veil lets taps through, the page stays live, and its button is there from the first frame. It closes at once on a
// tap, a key (not Tab) or a scroll, and on its own at MOMENT_MS. `then` moves the flow on when the person continues:
// Continue, a tap on the veil, a key, or the timer (the words then stay for 4 s as a toast). A tap through to a control
// under the veil does not run `then`: that control moves on itself, so one tap is never two steps. A scroll does not either,
// since the person is reading the page.
// `alt` ({ label, act }) is an Undo for something the moment did on the person's behalf (R-067). It lives in a toast with
// its own 10 s clock, not on the moment, which is gone in 1.5 s.
let live = null;
export function celebrate({ title, sub = '', small = '', go = 'Continue', alt = null }, then = () => {}) {
  live?.('replaced');
  let m = document.getElementById('fx-moment');
  if (!m) { m = document.createElement('div'); m.id = 'fx-moment'; m.className = 'fx-moment'; document.body.appendChild(m); }
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  m.innerHTML = `<div class="fx-mcard" role="status" aria-live="polite">${bloom()}
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
