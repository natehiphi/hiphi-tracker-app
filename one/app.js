// act.html (R-360): one bill, one action. The address names the bill: #/HB2121 (any case, a space allowed), the tracker's
// own #/bill/HB2121 and #/bill/2026/HB2121 too, so a link made for track.html opens here unchanged. #/HB2121/write is
// the next step (part 2 builds it; part 1 shows a stand-in).
import { loadBill, LoadError } from './data.js';
import { billScreen, writeScreen, loadingScreen, missingScreen, failScreen } from './bill.js';

const root = document.getElementById('app');
const ROUTE = /^#\/(?:bill\/)?(?:(\d{4})\/)?([A-Za-z]+)\s?(\d+)(\/write)?\/?$/;
let cur = { key: '', bill: null, p: null };

function parse() {
  let h = location.hash || '';
  try { h = decodeURIComponent(h); } catch { /* as typed */ }
  const m = ROUTE.exec(h);
  return m ? { year: m[1] ? +m[1] : null, num: (m[2] + m[3]).toUpperCase(), write: !!m[4] } : null;
}

// A new screen takes the focus to its heading, so a screen reader hears where it is and the page starts at the top (B-7).
function show(html) {
  root.innerHTML = html;
  window.scrollTo(0, 0);
  root.querySelector('h1')?.focus({ preventScroll: true });
}

async function route() {
  const r = parse();
  if (!r) { show(missingScreen()); return; }
  const key = `${r.year || ''}/${r.num}`;
  if (cur.key !== key || !cur.bill) {
    if (cur.key !== key || !cur.p) { cur = { key, bill: null, p: loadBill(r.num, r.year) }; }
    const p = cur.p;
    show(loadingScreen());
    let B;
    try { B = await p; }
    catch (e) {
      if (p !== cur.p) return;   // the person went elsewhere meanwhile
      cur.p = null;              // Try again asks again
      if (!(e instanceof LoadError)) console.error(e);
      show(failScreen()); return;
    }
    if (p !== cur.p) return;
    if (!B) { cur.p = null; show(missingScreen()); return; }
    cur.bill = B;
  }
  show(r.write ? writeScreen(cur.bill) : billScreen(cur.bill));
}

root.addEventListener('click', e => { if (e.target.closest('[data-retry]')) { cur.p = null; cur.bill = null; route(); } });
window.addEventListener('hashchange', route);
// The connection came back while the failed card is showing: ask again, once (as pub/app.js presses data-loadfail).
window.addEventListener('online', () => { if (root.querySelector('[data-retry]')) route(); });
route();
