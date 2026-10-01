// HIPHI public tracker, redesign 9/19: the page frame and the router.
// Every screen is a module with { render(route), wire(route), bar?(route), tabs, tab }. This file decides which one
// shows, draws the header, the sandbox band and the bottom tab bar, and owns Back, scroll and the first load.
import { reportError } from './errlog.js';   // first, so its handlers are in place before the screens' code runs (R-111)
import { S, D, DEMO, SEASON_OFF, app, esc, icon, toast, friendly, init, loadUser, loadLists, loadBills, onb, onbSet, nudge,
  wiz, firstVisit, readyForSession, ensureBill, listBillsFor, sessionInfo, loadCatalog, followsAnything, hstDay, loadReference, loadPool, CONSENT_KEY } from './core.js';
import { MARK } from './art.js';
import { skeleton, btn } from './ui.js';
import start from './start.js';
import home from './home.js';
import mybills from './mybills.js';
import find, { headerSuggest } from './find.js';
import { suggest } from './suggest.js';
import bill from './bill.js';
import people from './people.js';
import committees from './committees.js';
import allbills from './allbills.js';
import more from './more.js';
import helper from './helper.js';
import tour from './tour.js';
import mylists, { takePlace, finishPlace } from './mylists.js';
import { logDay, logAct } from './visitlog.js';
app.onAct = logAct;   // markDone (core.js) calls it: an action marked done, counted by its kind only

// name -> screen module. More covers help, sign in, settings and privacy; people covers legislators.
const SCREENS = { start, learn: start, home, recap: home, bills: mybills, find, issue: find, category: find, list: find, bill, legislators: people, legislator: people,
  committees, committee: committees, allbills, more, help: more, signin: more, settings: more, privacy: more, mylist: mylists, shared: mylists };
// "My issues" (Nate, 9/21, R-018 answer 4): the tab shows what a person follows, issue by issue. Its address stays #/bills.
const TABS = [['home', '#/', 'house', 'Home'], ['bills', '#/bills', 'star', 'My issues'], ['find', '#/find', 'search', 'Find'], ['more', '#/more', 'menu', 'More']];

// ---- routes ----
// New form: #/, #/start/2, #/bills, #/find?q=, #/find/category/<key>, #/issue/<slug> (#/find/issue/<slug> too), #/list/<slug>, #/bill/HB1563 (#/bill/2026/HB1563 for an earlier session's bill), #/legislators,
// #/legislator/<id>, #/more, #/help, #/signin, #/settings, #/privacy. Links shared before 9/19 (#bill=HB1563,
// #list=slug, #legislator=id, #legislators) still open the same pages.
export function parseRoute(h = location.hash) {
  let m;
  const dh = decodeURIComponent(h || '');
  if ((m = /^#bill=([A-Za-z]+\s?\d+)/.exec(dh))) return { name: 'bill', num: m[1].replace(/\s/g, '').toUpperCase(), legacy: true };
  if ((m = /^#list=([a-z0-9-]+)/i.exec(dh))) return { name: 'list', slug: m[1], legacy: true };
  if ((m = /^#legislator=(\d+)/.exec(dh))) return { name: 'legislator', id: +m[1], legacy: true };
  if (/^#legislators$/.test(dh)) return { name: 'legislators', legacy: true };
  const [p, qs] = dh.replace(/^#/, '').split('?'), q = new URLSearchParams(qs || ''), seg = p.split('/').filter(Boolean);
  switch (seg[0]) {
    case undefined: return { name: 'home' };
    // No upper bound here on purpose. The guided start decides its own length (pub/start.js FLOW_IN)
    // and redirectFor sends anything past the end back to the last screen. Every hard cap written in
    // this file has been wrong within a day of the flow growing - first 4, then 9 - and the symptom is
    // silent: the hash moves, the screen does not.
    case 'start': return { name: 'start', step: Math.max(1, +seg[1] || 1) };
    // One lesson on its own, in the moment it is needed (R-067 #11): #/learn/hearing, or #/learn/hearing/<bill id> to
    // teach it on that bill.
    case 'learn': return { name: 'learn', lesson: seg[1] || 'bill', bill: seg[2] || '' };
    case 'bills': return { name: 'bills' };
    case 'find': return seg[1] === 'issue' ? { name: 'issue', slug: seg[2] || '' } : seg[1] === 'category' ? { name: 'category', key: seg[2] || '' } : { name: 'find', q: q.get('q') || '' };
    case 'issue': return { name: 'issue', slug: seg[1] || '' };
    case 'list': return { name: 'list', slug: seg[1] || '' };
    case 'mylist': return { name: 'mylist', id: seg[1] || '' };   // a person's own list, or one shared with them (R-013, pub/mylists.js)
    case 'l': return { name: 'shared', token: seg[1] || '' };      // a list shared by its link
    // #/bill/HB1563 means the current session's bill; #/bill/2026/HB1563 names the session, because numbers start
    // again at HB 1 every January (R-110).
    case 'bill': { const yr = /^\d{4}$/.test(seg[1] || '') ? +seg[1] : 0; return { name: 'bill', num: String((yr ? seg[2] : seg[1]) || '').toUpperCase(), year: yr || undefined }; }
    case 'legislators': return { name: 'legislators', from: q.get('from') || '' };
    case 'legislator': return { name: 'legislator', id: +seg[1] || 0, from: q.get('from') || '' };
    case 'committee': return { name: 'committee', code: String(seg[1] || '').toUpperCase() };
    case 'help': return { name: 'help', slug: seg[1] || '' };   // #/help/<slug> opens one conversation (R-075, pub/talk.js)
    default: return SCREENS[seg[0]] ? { name: seg[0] } : { name: 'home', unknown: true };   // a mistyped or old address: Home, with a word (R-067)
  }
}
export const toHash = r => ({ bill: `#/bill/${r.year ? r.year + '/' : ''}${r.num}`, list: `#/list/${r.slug}`, issue: `#/issue/${r.slug}`, category: `#/find/category/${r.key}`, legislator: `#/legislator/${r.id}`, legislators: '#/legislators',
  committee: `#/committee/${r.code}`, committees: '#/committees', help: r.slug ? `#/help/${r.slug}` : '#/help' })[r.name] || '#/';

// go('#/bills') pushes a history entry (Back works); { replace: true } swaps the current one.
function go(path, { replace = false, keepScroll = false } = {}) {
  if (!replace && path === (location.hash || '#/')) { window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); return; }
  const y = window.scrollY;
  try { history.replaceState({ ...(history.state || {}), y }, ''); } catch { /* ignore */ }
  // prev: the page this step was opened from, so a back link can tell whether real Back leads where it says (R-041).
  if (replace) history.replaceState({ y: 0, prev: history.state?.prev }, '', path); else history.pushState({ y: 0, prev: location.hash || '#/' }, '', path);
  render();
  if (!keepScroll) window.scrollTo(0, 0);
}
app.go = go;
window.addEventListener('popstate', e => { render(); const y = e.state?.y || 0; requestAnimationFrame(() => window.scrollTo(0, y)); });
try { history.scrollRestoration = 'manual'; } catch { /* ignore */ }

// ---- the frame ----
function header(route, scr) {
  const inStart = route.name === 'start';
  const account = S.session ? `<a class="hbtn hacct" href="#/settings">${icon('user')}<span>Account</span></a>` : DEMO ? '' : `<a class="hbtn hacct" href="#/signin">${icon('log-in')}<span>Sign in</span></a>`;
  const right = inStart ? (S.session || DEMO ? '' : `<a class="hbtn" href="#/signin">Sign in</a>`)
    : `<form class="hsearch" role="search" data-hsearch><label class="sr" for="hq">Search issues and bills</label>${icon('search')}<input id="hq" type="search" placeholder="Search issues and bills: vaping, school meals" autocomplete="off" enterkeyhint="search"></form>
       <a class="hbtn hsearchbtn" href="#/find" aria-label="Search issues and bills" data-focussearch>${icon('search', { size: 24 })}</a>${account}`;
  const nav = inStart ? '' : `<nav class="hnav" aria-label="Main">${TABS.map(([t, href, ic, label]) => `<a href="${href}" ${scr.tab === t ? 'aria-current="page"' : ''}>${icon(ic)}${label}</a>`).join('')}</nav>`;
  return `${DEMO ? `<div class="band">${SEASON_OFF ? 'Sandbox · after the 2026 session · nothing is saved' : 'Sandbox · Mon, Mar 16, 2026 · nothing is saved'}</div>` : ''}
    <header class="hdr"><div class="hdrin"><a class="brand" href="#/" aria-label="Bill Tracker home">${MARK}<span class="bname"><b>Bill Tracker</b><small>Hawaiʻi health bills · from HIPHI</small></span></a>${nav}<span class="hspace"></span>${right}</div></header>`;
}
function tabbar(scr) {
  return `<nav class="tabs" aria-label="Main">${TABS.map(([t, href, ic, label]) => `<a href="${href}" ${scr.tab === t ? 'aria-current="page"' : ''}><span class="pill">${icon(ic, { size: 24 })}</span>${label}</a>`).join('')}</nav>`;
}

let lastRouteKey = '';
export function render() {
  let route = parseRoute();
  // A mistyped or old address lands on Home with one line saying so, then becomes the plain Home address (R-067).
  if (route.unknown) { history.replaceState(history.state, '', '#/'); setTimeout(() => toast('That page isn’t here. This is the home page.'), 50); }
  // A first visit to the home page starts the guided start where the person left it.
  if (route.name === 'home' && firstVisit()) { history.replaceState({ y: 0 }, '', `#/start/${readyForSession() ? 2 : wiz().step || 1}`); route = parseRoute(); }
  const scr = SCREENS[route.name] || home;
  const tabs = scr.tabs !== false && !(scr.noTabs && scr.noTabs(route));
  const bar = scr.bar ? scr.bar(route) : '';
  document.body.classList.toggle('notabs', !tabs);
  document.body.classList.toggle('withtabs', tabs);
  document.body.classList.toggle('hasbar', !!bar);
  document.body.dataset.screen = route.name;
  let main;
  try { main = scr.render(route); } catch (e) { console.error(e); reportError('render', e); main = errorCard(); }
  const keep = location.hash === lastRouteKey ? focusKey(document.activeElement) : null;
  // The sticky action bar is part of the page's main content (it holds the page's main button), so it sits inside <main>.
  $app().innerHTML = `<button type="button" class="skip" data-skip>Skip to content</button>${header(route, scr)}
    <main id="main" tabindex="-1">${main}${bar ? `<div class="actionbar"><div class="inner">${bar}</div></div>` : ''}</main>
    ${tabs ? tabbar(scr) : ''}
    ${helper.render()}`;
  document.title = (scr.title ? scr.title(route) + ' · ' : '') + 'HIPHI Bill Tracker';
  try { scr.wire && scr.wire(route); } catch (e) { console.error(e); }
  helper.wire();
  wireFrame();
  if (keep && !document.querySelector('dialog[open]')) { const el = findByKey(keep); if (el && el !== document.activeElement) el.focus({ preventScroll: true }); }
  // Screen changes move focus to the page for screen readers (not on re-renders of the same screen).
  const key = location.hash;
  if (key !== lastRouteKey) { lastRouteKey = key; if (document.activeElement === document.body || !$app().contains(document.activeElement)) $app().querySelector('main')?.focus({ preventScroll: true }); }
  // The first bill page anyone opens gets a short tour (R-062, pub/tour.js); it decides for itself, and closes if the page moves on.
  try { tour.after(route); } catch (e) { console.error(e); }
}
app.render = render;
const $app = () => document.getElementById('app');
// A redraw replaces every element, which used to drop keyboard and screen-reader focus to the top of the page after
// "More ways to help", a follow star, a stance chip... Remember what had focus (its id, or its first data-* hook) and
// give focus back to the same control afterwards.
function focusKey(el) {
  if (!el || el === document.body || !$app().contains(el)) return null;
  if (el.id) return { sel: '#' + CSS.escape(el.id) };
  const a = [...el.attributes].find(x => x.name.startsWith('data-') && x.value !== '');
  if (a) return { sel: `${el.tagName.toLowerCase()}[${a.name}="${CSS.escape(a.value)}"]` };
  const href = el.getAttribute && el.getAttribute('href');
  return href ? { sel: `a[href="${CSS.escape(href)}"]` } : null;
}
const findByKey = k => { try { return $app().querySelector(k.sel); } catch { return null; } };
const pathOf = h => String(h || '').split('?')[0];   // "#/find?q=vape" and "#/find" are the same page
function wireFrame() {
  // Plain <a href="#/..."> links push history on their own; keep them in-app and reset scroll.
  $app().querySelectorAll('a[href^="#/"]').forEach(a => a.addEventListener('click', e => {
    if (e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    // A back link ("Back to HB 1234", "All issues") is real Back when the page behind is the one it names. Otherwise it
    // takes this page's place instead of stacking a new one on top (R-041): stacking made a loop with the bill page's
    // own Back, which is real Back - bill -> senator -> "Back to HB 1234" (a new bill page) -> Back (the senator again).
    if (a.hasAttribute('data-back')) { const to = a.getAttribute('href'), prev = history.state?.prev;
      if (prev && pathOf(prev) === pathOf(to)) history.back(); else go(to, { replace: true }); return; }
    go(a.getAttribute('href'));
    if (a.hasAttribute('data-focussearch')) setTimeout(() => document.getElementById('q')?.focus(), 30);
  }));
  // "Skip to content" moves focus into the page. It used to be a #main link, which the router read as a page name.
  const skip = $app().querySelector('[data-skip]');
  if (skip) skip.onclick = () => { const m = document.getElementById('main'); m?.focus(); m?.scrollIntoView({ block: 'start' }); };
  const hs = $app().querySelector('[data-hsearch]');
  if (hs) { const inp = hs.querySelector('input'); const r = parseRoute(); if (r.name === 'find' && r.q) inp.value = r.q;
    hs.onsubmit = e => { e.preventDefault(); const q = inp.value.trim(); go('#/find' + (q ? '?q=' + encodeURIComponent(q) : '')); };
    // Matching issues and bills listed as you type (R-032). On Find itself the results under the page's box are the list.
    suggest(inp, { source: headerSuggest, open: go, min: 3, wait: 200, when: () => parseRoute().name !== 'find', label: 'Suggested issues and bills',
      busy: 'Looking for bills', failed: 'Search didn’t work just now. Check your connection and try again.',
      empty: q => `No issues or bills match “${q}”. Try one word, like vaping, or a bill number.`,
      seeAll: (q, hits) => hits ? { href: '#/find?q=' + encodeURIComponent(q), label: `See all results for “${q}”` } : { href: '#/find', label: 'Browse all issues', icon: 'arrow-right' } }); }
}
const errorCard = () => `<div class="empty"><h2>We couldn’t load the bills</h2><p>Check your connection and try again.</p>${btn('Try again', { kind: 'primary', icon: 'rotate-ccw', attrs: { onclick: 'location.reload()' } })}</div>`;

// ---- keyboard (people with a keyboard only; Help lists these) ----
document.addEventListener('keydown', e => {
  const t = e.target, typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
  if (typing || e.metaKey || e.ctrlKey || e.altKey || document.querySelector('dialog[open]')) return;
  if (e.key === '/') { e.preventDefault(); if (parseRoute().name !== 'find') go('#/find'); setTimeout(() => document.getElementById('q')?.focus(), 30); }
  else if (e.key === '?') { e.preventDefault(); go('#/help'); }
});

// ---- first load ----
// Back after a month with things saved only in this browser: the one moment their loss is a real risk.
// Since R-067 it is the second visit, not the thirtieth day: an iPhone clears a site's storage after a week away, so
// the ask for an email ("so your issues are still here in January") comes the first time they are back on another day.
// nudge() keeps its own spacing after "Not now". The last visit is kept for Home's "Since you were here".
function welcomeBack() {
  const o = onb(), last = o.lastVisit ? Date.parse(o.lastVisit) : 0;
  S.prevVisit = o.lastVisit || null;
  // Not when this browser already sent a sign-in link (R-098): they gave their email, and were asked for it again.
  let gave = false; try { gave = !!(sessionStorage.getItem('hiphi_link_sent') || localStorage.getItem(CONSENT_KEY)); } catch { /* ignore */ }
  if (last && hstDay(last) !== hstDay(Date.now()) && (followsAnything() || S.done.size) && !S.session && !gave) nudge('back');
  onbSet({ lastVisit: new Date().toISOString() });
  // No navigator.storage.persist() here: some browsers answer it with a "store data in persistent storage?" prompt,
  // a permission box a visitor should never meet (Nate, 9/29). The email ask above is how saved issues are kept.
}
// Android's "add to home screen" prompt, kept for Home's card rather than shown when the browser chooses.
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); S.installPrompt = e; });
async function boot() {
  const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 12000));
  try {
    // The issues come first: what a person follows is worked out from them (063, R-018). HIPHI's live bills and the
    // session's reference data do not depend on that, so they start now, alongside (R-067 speed).
    if (!DEMO) { loadReference().catch(() => {}); loadPool().catch(() => {}); }
    await Promise.race([(async () => { await loadCatalog(); await loadUser(); await loadLists(); await loadBills(); })(), timeout]);
    welcomeBack();
    // Once a day, privately: did this browser come back, and after how long (R-067; visitlog.js, migration 078).
    logDay({ follows: followsAnything(), signedIn: !!S.session, season: sessionInfo().phase === 'in' ? 'in' : 'off' });
    // Links shared before 9/19 become the new addresses; a first visit that arrives on a shared link gets the
    // guided start behind it, so Back goes somewhere helpful.
    // Someone who went to add their email in the middle of a list task comes back to it once the emailed link signs
    // them in (R-013): that link opens the plain address, so the place was kept in this browser (pub/mylists.js).
    const place = takePlace();
    if (place) history.replaceState({ y: 0 }, '', place.hash);
    const r = parseRoute();
    if (r.legacy) {
      if (firstVisit()) { history.replaceState({ y: 0 }, '', '#/start/1'); history.pushState({ y: 0, arrived: true }, '', toHash(r)); }
      else history.replaceState({ y: 0 }, '', toHash(r));
    }
    render();
    if (window.__hiphiErrs) window.__hiphiErrs.booted = true;   // track.html's catcher: the app started (R-111)
    finishPlace(place);
  } catch (e) {
    console.error(e); reportError('boot', e);
    $app().innerHTML = `${header({ name: 'error' }, {})}<main id="main">${errorCard()}</main>`;
  }
}
app.boot = boot;
$app().innerHTML = `<div class="hdr"></div><main>${skeleton(4)}</main>`;
// The clock starts with the script, so a start that hangs anywhere (the data file, the Supabase client) ends in the
// "Try again" card instead of a skeleton that never goes away.
Promise.race([init(), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 15000))]).then(boot)
  .catch(e => { console.error(e); reportError('boot', e); $app().innerHTML = `<main id="main">${errorCard()}</main>`; });
