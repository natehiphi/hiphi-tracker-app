// A timer that belongs to the screen it was set on (R-360 fix pass, DESIGN B-4, B-7): "Copied" coming back after two seconds,
// or the send screen redrawn after the Capitol tap, must never paint over the screen the person has gone to since. Each timer
// remembers the address it was set on and does nothing once the address has changed; app.js cancels every pending one when
// the route changes, so an old screen cannot come back ("Mahalo!" over the bill, the send screen over the letter).
const pending = new Set();
export function later(fn, ms) {
  const at = location.hash;
  const id = setTimeout(() => { pending.delete(id); if (location.hash === at) fn(); }, ms);
  pending.add(id);
  return id;
}
export function cancelLater() { for (const id of pending) clearTimeout(id); pending.clear(); }
