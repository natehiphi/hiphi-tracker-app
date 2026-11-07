// act.html (R-360): one bill, one action. The address names the bill: #/HB2121 (any case, a space allowed), the tracker's
// own #/bill/HB2121 and #/bill/2026/HB2121 too, so a link made for track.html opens here unchanged. Then the one action:
// #/HB2121/write (one/write.js), #/HB2121/send (one/send.js) and #/HB2121/thanks (part 3; a stand-in for now).
import { loadBill, loadPeople, LoadError } from './data.js';
import { billScreen, thanksScreen, loadingScreen, missingScreen, failScreen } from './bill.js';
import { writeScreen, wireWrite, loadMe } from './write.js';
import { sendScreen, wireSend } from './send.js';

const root = document.getElementById('app');
const ROUTE = /^#\/(?:bill\/)?(?:(\d{4})\/)?([A-Za-z]+)\s?(\d+)(?:\/(write|send|thanks))?\/?$/;
let cur = { key: '', bill: null, p: null };

function parse() {
  let h = location.hash || '';
  try { h = decodeURIComponent(h); } catch { /* as typed */ }
  const m = ROUTE.exec(h);
  return m ? { year: m[1] ? +m[1] : null, num: (m[2] + m[3]).toUpperCase(), step: m[4] || '' } : null;
}

// A new screen takes the focus to its heading, so a screen reader hears where it is and the page starts at the top (B-7).
function show(html, { keepFocus = '' } = {}) {
  root.innerHTML = html;
  if (keepFocus) { root.querySelector(keepFocus)?.focus({ preventScroll: true }); return; }   // a redraw in place: the focus stays where the person is
  window.scrollTo(0, 0);
  root.querySelector('h1')?.focus({ preventScroll: true });
}
// The directory (surnames, chairs' addresses) for the letter: asked for at most three seconds; without it the letter
// still writes itself (letter.js falls back to the name's last word and the Capitol's address pattern).
const people = () => Promise.race([loadPeople(), new Promise(r => setTimeout(() => r([]), 3000))]);

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
  const B = cur.bill, base = `#/${r.year ? r.year + '/' : ''}${B.number}`, go = step => { location.hash = `${base}/${step}`; };
  // The steps need the bill's one action; a bill with none (it is over for the year) shows the bill, which says why.
  // Send before a name is given goes back to Write, where the letter is signed.
  let step = r.step;
  if (step && step !== 'thanks' && !B.action) step = '';
  if (step === 'send' && !String(loadMe().name || '').trim()) step = 'write';
  if (step !== r.step) { history.replaceState(null, '', step ? `${base}/${step}` : base); }
  if (step === 'write' || step === 'send') {
    const at = location.hash, P = await people();
    if (location.hash !== at) return;   // the person went elsewhere meanwhile
    if (step === 'write') { show(writeScreen(B, P)); wireWrite(root, B, P, go); return; }
    const draw = (o = {}) => { show(sendScreen(B, P), o); wireSend(root, B, P, go, draw); };
    draw(); return;
  }
  show(step === 'thanks' ? thanksScreen(B) : billScreen(B));
}

root.addEventListener('click', e => { if (e.target.closest('[data-retry]')) { cur.p = null; cur.bill = null; route(); } });
window.addEventListener('hashchange', route);
// The connection came back while the failed card is showing: ask again, once (as pub/app.js presses data-loadfail).
window.addEventListener('online', () => { if (root.querySelector('[data-retry]')) route(); });
route();
