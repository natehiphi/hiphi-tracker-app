// Motion and celebration for the public tracker (R-023, 9/21; DESIGN.md A-10 and C-7 as rewritten that day).
// One place for the small things that move, so every screen celebrates the same way and every one of them honours
// Reduce Motion:
//   burst(el)      a small burst of petals on the thing just done: a stance, a right answer, an address found, an email
//                  sent, a part of the first visit finished. Skipped entirely under Reduce Motion.
//   celebrate(...) a moment that fills the screen and waits for Continue (WCAG 2.2.1): the first follow, the first
//                  action sent, a law passed. Under Reduce Motion it still appears, without movement. Never mid-way
//                  through the first visit after the first follow: a full-screen moment there reads as the end (R-140).
//   travel(...)    moves one SVG group along a curve (the bill's trip through the Capitol, a letter to the committee).
//   swap(fn, dir)  a screen change that slides the way the person is going (a View Transition where the browser has
//                  one; otherwise the change simply happens).
//   petals()       the finale's falling petals, the peak at the end of the first visit (C-7).
// Every moment plays side by side, at full speed or slowed, on the private motion page (motion.html, X11-4).
// Orange is the celebration colour and appears in these and almost nowhere else (C-7).
import { icon } from './kernel.js';

export const reduced = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
// A pause that only exists when things move: under Reduce Motion the next beat happens at once.
export const later = (fn, ms) => setTimeout(fn, reduced() ? 0 : ms);

// ---- a small burst of petals, centred on an element ----
export function burst(el, n = 12, dist = 52) {
  if (!el || reduced()) return;
  const r = el.getBoundingClientRect(), b = document.createElement('div');
  b.className = 'fx-burst'; b.setAttribute('aria-hidden', 'true');
  b.style.left = `${r.left + r.width / 2}px`; b.style.top = `${r.top + r.height / 2}px`;
  b.innerHTML = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2 + (i % 2) * .3, d = dist * (.65 + (i % 3) * .2);
    return `<i style="--x:${(Math.cos(a) * d).toFixed(1)}px;--y:${(Math.sin(a) * d).toFixed(1)}px;--c:${i % 3 ? 'var(--o400)' : i % 2 ? '#F9D56E' : 'var(--p400)'};animation-delay:${(i % 4) * 30}ms"></i>`;
  }).join('');
  document.body.appendChild(b); setTimeout(() => b.remove(), 1100);
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
// A flower that opens, with a few sparks: the first follow and the first action.
export function bloom() {
  const sparks = [[-15, -12], [15, -13], [18, 6], [-18, 7], [0, -19], [-9, 16], [10, 16], [0, 20]];
  return `<div class="fx-bloom" aria-hidden="true"><svg viewBox="-24 -24 48 48" focusable="false">
    ${sparks.map(([x, y], i) => `<circle class="fx-spark" r="${i % 2 ? 1.1 : 1.6}" fill="${i % 3 ? 'var(--o400)' : '#F9D56E'}" style="--sx:${x}px;--sy:${y}px;animation-delay:${520 + i * 25}ms"/>`).join('')}
    <g>${[0, 72, 144, 216, 288].map((r, i) => `<g transform="rotate(${r})"><ellipse class="fx-petal" cx="0" cy="-8.4" rx="6.1" ry="8.4" fill="var(--o400)" style="animation-delay:${i * 80}ms"/></g>`).join('')}</g>
    <circle class="fx-heart" r="3.3" fill="#F9D56E"/></svg></div>`;
}

// A moment that fills the screen and waits for Continue (never moves on by itself: WCAG 2.2.1). The page behind is
// inert while it shows; Esc, a tap outside the card, or Continue closes it, then `then` runs.
// `alt` ({ label, act }) adds a quiet second button under Continue: it runs act, then closes like Continue (an Undo
// for something the moment did on the person's behalf, R-067).
export function celebrate({ title, sub = '', small = '', go = 'Continue', alt = null }, then = () => {}) {
  let m = document.getElementById('fx-moment');
  if (!m) { m = document.createElement('div'); m.id = 'fx-moment'; m.className = 'fx-moment'; document.body.appendChild(m); }
  const app = document.getElementById('app');
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  m.innerHTML = `<div class="fx-mcard" role="dialog" aria-modal="true" aria-labelledby="fx-mt" aria-describedby="fx-ms">${bloom()}
    <p class="fx-mtitle" id="fx-mt">${esc(title)}</p>
    <div id="fx-ms">${sub ? `<p class="fx-msub">${esc(sub)}</p>` : ''}${small ? `<p class="fx-msmall">${esc(small)}</p>` : ''}</div>
    <button type="button" class="btn primary fx-mgo" id="fx-mgo"><span>${esc(go)}</span>${icon('arrow-right')}</button>${alt ? `<button type="button" class="btn text fx-malt" id="fx-malt">${esc(alt.label)}</button>` : ''}</div>`;
  m.hidden = false; m.classList.remove('fx-out');
  if (app) app.inert = true;
  let done = false;
  const finish = () => {
    if (done) return; done = true; document.removeEventListener('keydown', key, true);
    m.classList.add('fx-out');
    setTimeout(() => { m.hidden = true; m.classList.remove('fx-out'); m.innerHTML = ''; if (app) app.inert = false; then(); }, reduced() ? 0 : 240);
  };
  const key = e => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); finish(); } };
  m.querySelector('#fx-mgo').onclick = finish;
  if (alt) m.querySelector('#fx-malt').onclick = async () => { try { await alt.act(); } catch { /* the moment still closes */ } finish(); };
  m.onclick = e => { if (e.target === m) finish(); };
  document.addEventListener('keydown', key, true);
  m.querySelector('#fx-mgo').focus({ preventScroll: true });
  return finish;
}
