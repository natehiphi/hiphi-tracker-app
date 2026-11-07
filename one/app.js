// act.html (R-360): one bill, one action. The address names the bill: #/HB2121 (any case, a space allowed), the tracker's
// own #/bill/HB2121 and #/bill/2026/HB2121 too, so a link made for track.html opens here unchanged. Then the one action:
// #/HB2121/write (one/write.js), #/HB2121/send (one/send.js) and #/HB2121/thanks (one/thanks.js). The counts (one/counts.js)
// are the only calls to the database: a visit, the bill's arrival, the letter's clock and the action.
// Part 4 makes it the start of the whole public app: #/ is Home (one/home.js, part 6), #/bills is Bills (one/bills.js; #/bills/<issue-slug> opens
// it at that issue), #/week is This week (one/week.js, part 5), with the tab bar (one/tabs.js) on those three and on the bill.
// A returning person (a done mark, or an issue followed) who opens act.html with no address at all lands on This week.
import { loadBill, loadPeople, loadList, LoadError } from './data.js';
import { billScreen, loadingScreen, missingScreen, failScreen } from './bill.js';
import { billsScreen, billsLoading, wireBills, atIssue, state as billsState, keep as keepBills, followsAny } from './bills.js';
import { weekScreen, weekLoading, weekData, wireWeek } from './week.js';
import { tabs } from './tabs.js';
import { homeScreen, homeLoading } from './home.js';
import { thanksScreen, wireThanks, freshThanks } from './thanks.js';
import { countVisit, arrive, letterShown } from './counts.js';
import { writeScreen, wireWrite, loadMe } from './write.js';
import { sendScreen, wireSend, freshSend } from './send.js';
import { isDone, doneSet } from './done.js';
import { cancelLater } from './later.js';

const root = document.getElementById('app');
const ROUTE = /^#\/(?:bill\/)?(?:(\d{4})\/)?([A-Za-z]+)\s?(\d+)(?:\/(write|send|thanks))?\/?$/;
let cur = { key: '', bill: null, p: null };
// Where the person was before this screen ('home', 'bills', 'week' or 'bill:<key>'): Bills, back from a bill, finds the list
// where it was left.
let last = '';
const OTHER = /^#\/(?:(bills)(?:\/([a-z0-9-]+))?|(week))?\/?$/;

function parse(h = location.hash || '') {
  try { h = decodeURIComponent(h); } catch { /* as typed */ }
  const m = ROUTE.exec(h);
  return m ? { year: m[1] ? +m[1] : null, num: (m[2] + m[3]).toUpperCase(), step: m[4] || '' } : null;
}

// Each history entry remembers where it was reached from (history.state: prev, the address before it, and tab, the tab bar's
// screen the person came through), so it holds across Back, Forward and a reload (R-360 fix pass):
//  - the bill lights the tab it came from, Home, Bills or This week (A-12), and none when a link opened it first (B-4);
//    its Write, Send and Mahalo steps carry the same tab;
//  - a back link marked data-hist ("Back to Bills", Write's "Back to the bill") goes back in the history when the entry
//    before is that place, so it never adds an entry and the browser's Back never lands on the screen just left (B-4).
let lastHash = null, lastTab = '';
const tabOf = h => h == null ? null : /^#?\/?$/.test(h) ? 'home' : /^#\/bills(\/|$)/.test(h) ? 'bills' : /^#\/week\/?$/.test(h) ? 'week' : null;
function entry() {
  let s = history.state;
  if (!s || !('prev' in s)) {
    const prev = lastHash;
    s = { prev, tab: tabOf(prev) ?? (prev != null ? lastTab : '') };
    try { history.replaceState(s, ''); } catch { /* the entry stays plain: no tab is lit, links add an entry */ }
  }
  lastHash = location.hash || '#/'; lastTab = tabOf(lastHash) ?? s.tab ?? '';
  return s;
}
// A step corrected in place (Send before a name, Mahalo after sending) keeps the entry's memory.
const fix = url => { history.replaceState(history.state, '', url); lastHash = location.hash; };
// Is the entry before this one the place a back link names? "#/bills" matches any Bills address; a bill, its main screen.
function isPrev(target) {
  const prev = history.state?.prev;
  if (prev == null) return false;
  if (target === '#/bills') return /^#\/bills(\/|$)/.test(prev);
  const a = parse(prev), b = parse(target);
  return !!(a && b && a.num === b.num && !a.step && !b.step);
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
  cancelLater();   // a "Copied" or a redraw set on the last screen never paints over this one (B-4, B-7)
  const here = entry(), o = OTHER.exec(location.hash || '#/'), was = last;
  if (o) {
    last = o[1] || o[3] || 'home';
    // Back from a bill, or the page loaded afresh (a reload): the list where it was (B-6).
    if (o[1]) return bills(o[2] || '', was.startsWith('bill:') || was === '');
    if (o[3]) return week();
    return home();
  }
  const r = parse();
  if (!r) { last = ''; show(missingScreen()); return; }
  const key = `${r.year || ''}/${r.num}`, tab = here.tab || '';
  last = 'bill:' + key;
  if (cur.key !== key || !cur.bill) {
    if (cur.key !== key || !cur.p) { cur = { key, bill: null, p: loadBill(r.num, r.year) }; }
    const p = cur.p;
    show(loadingScreen() + tabs(tab));
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
  // Already sent (the done mark, B-6): a return to /send (Back, or an old link) shows Mahalo, never Yes, I sent it again.
  if (step === 'send' && isDone(B)) step = 'thanks';
  if (step !== r.step) fix(step ? `${base}/${step}` : base);
  if (step === 'write' || step === 'send') {
    const at = location.hash, P = await people();
    if (location.hash !== at) return;   // the person went elsewhere meanwhile
    if (step === 'write') { show(writeScreen(B, P)); letterShown(B); wireWrite(root, B, P, go); return; }
    const draw = (o = {}) => { show(sendScreen(B, P), o); wireSend(root, B, P, go, draw); };
    freshSend(B); draw(); return;
  }
  if (step === 'thanks') { const draw = (o = {}) => { show(thanksScreen(B), o); wireThanks(root, B, draw); }; freshThanks(B); draw(); return; }
  show(billScreen(B, { back: tab === 'bills' }) + tabs(tab)); arrive();
}

// Bills: the list loads once a page life (data.js keeps it); a failed load says so, with Try again (B-8).
// back: returning from a bill, so the list is where it was left. slug: open at that issue, with all its bills.
async function bills(slug, back) {
  const at = location.hash, p = loadList();
  let L = null;
  p.then(x => { L = x; }, () => {});
  await Promise.resolve();
  if (!L) show(billsLoading());
  try { L = await p; }
  catch (e) { if (location.hash !== at) return; if (!(e instanceof LoadError)) console.error(e); show(failScreen('list')); return; }
  if (location.hash !== at) return;
  const i = slug ? L.issues.find(x => x.slug === slug) : null;
  if (i) { billsState.topic = ''; billsState.q = ''; billsState.open.add(i.id); keepBills(); }
  show(billsScreen(L)); wireBills(root, L);
  if (i && atIssue(root, slug)) return;
  if (back && billsState.y) window.scrollTo(0, billsState.y);
}

// Home (part 6): the list and This week's one thing (weekData), drawn afresh each visit as This week is.
async function home() {
  const at = location.hash;
  show(homeLoading());
  let D, L;
  try { L = await loadList(); D = await weekData(L); }
  catch (e) { if (location.hash !== at) return; if (!(e instanceof LoadError)) console.error(e); show(failScreen('list')); return; }
  if (location.hash !== at) return;
  show(homeScreen(D, L));
}

// This week: the list (as Bills has it), then the bills the screen looks at; drawn afresh each visit, so a bill sent
// meanwhile shows as sent and the next one is offered.
const returning = () => doneSet().size > 0 || followsAny();
async function week() {
  const at = location.hash;
  show(weekLoading());
  let D, L;
  try { L = await loadList(); D = await weekData(L); }
  catch (e) { if (location.hash !== at) return; if (!(e instanceof LoadError)) console.error(e); show(failScreen('list')); return; }
  if (location.hash !== at) return;
  show(weekScreen(D, L, { returning: returning() })); wireWeek(root);
}

root.addEventListener('click', e => {
  if (e.target.closest('[data-retry]')) { cur.p = null; cur.bill = null; route(); return; }
  const a = e.target.closest('a[data-hist]');
  if (a && !e.metaKey && !e.ctrlKey && !e.shiftKey && isPrev(a.dataset.hist)) { e.preventDefault(); history.back(); }
});
window.addEventListener('hashchange', route);
// The connection came back while the failed card is showing: ask again, once (as pub/app.js presses data-loadfail).
window.addEventListener('online', () => { if (root.querySelector('[data-retry]')) route(); });
// No address at all: a person who has been here before (sent something, or follows an issue) starts on This week; #/ stays Home.
if (!location.hash && returning()) history.replaceState(null, '', '#/week');
countVisit();   // once per page load (a Hawaiʻi day's visit, as the tracker counts it)
route();
