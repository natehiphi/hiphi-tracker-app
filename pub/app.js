// HIPHI public tracker, redesign 9/19: the page frame and the router.
// Every screen is a module with { render(route), wire(route), bar?(route), tabs, tab }. This file decides which one
// shows, draws the header, the sandbox band and the bottom tab bar, and owns Back, scroll and the first load.
import { S, D, DEMO, SEASON_OFF, app, esc, icon, toast, friendly, init, loadUser, loadLists, loadBills, onb, onbSet, nudge,
  wiz, firstVisit, readyForSession, ensureBill, listBillsFor, sessionInfo } from './core.js';
import { MARK } from './art.js';
import { skeleton, btn } from './ui.js';
import start from './start.js';
import home from './home.js';
import mybills from './mybills.js';
import find from './find.js';
import bill from './bill.js';
import people from './people.js';
import more from './more.js';
import helper from './helper.js';

// name -> screen module. More covers help, sign in, settings and privacy; people covers legislators.
const SCREENS = { start, home, bills: mybills, find, issue: find, list: find, bill, legislators: people, legislator: people,
  more, help: more, signin: more, settings: more, privacy: more };
const TABS = [['home', '#/', 'house', 'Home'], ['bills', '#/bills', 'star', 'My bills'], ['find', '#/find', 'search', 'Find'], ['more', '#/more', 'menu', 'More']];

// ---- routes ----
// New form: #/, #/start/2, #/bills, #/find?q=, #/find/issue/<slug>, #/list/<slug>, #/bill/HB1563, #/legislators,
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
    case 'bills': return { name: 'bills' };
    case 'find': return seg[1] === 'issue' ? { name: 'issue', slug: seg[2] || '' } : { name: 'find', q: q.get('q') || '' };
    case 'list': return { name: 'list', slug: seg[1] || '' };
    case 'bill': return { name: 'bill', num: String(seg[1] || '').toUpperCase() };
    case 'legislators': return { name: 'legislators', from: q.get('from') || '' };
    case 'legislator': return { name: 'legislator', id: +seg[1] || 0, from: q.get('from') || '' };
    default: return SCREENS[seg[0]] ? { name: seg[0] } : { name: 'home' };
  }
}
export const toHash = r => ({ bill: `#/bill/${r.num}`, list: `#/list/${r.slug}`, legislator: `#/legislator/${r.id}`, legislators: '#/legislators' })[r.name] || '#/';

// go('#/bills') pushes a history entry (Back works); { replace: true } swaps the current one.
function go(path, { replace = false, keepScroll = false } = {}) {
  if (!replace && path === (location.hash || '#/')) { window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); return; }
  const y = window.scrollY;
  try { history.replaceState({ ...(history.state || {}), y }, ''); } catch { /* ignore */ }
  if (replace) history.replaceState({ y: 0 }, '', path); else history.pushState({ y: 0 }, '', path);
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
    : `<form class="hsearch" role="search" data-hsearch><label class="sr" for="hq">Search bills</label>${icon('search')}<input id="hq" type="search" placeholder="Search bills: vaping, school meals, HB 1563" autocomplete="off" enterkeyhint="search"></form>
       <a class="hbtn hsearchbtn" href="#/find" aria-label="Search bills" data-focussearch>${icon('search', { size: 24 })}</a>${account}`;
  const nav = inStart ? '' : `<nav class="hnav" aria-label="Main">${TABS.map(([t, href, ic, label]) => `<a href="${href}" ${scr.tab === t ? 'aria-current="page"' : ''}>${icon(ic)}${label}</a>`).join('')}</nav>`;
  return `${DEMO ? `<div class="band">${SEASON_OFF ? 'Sandbox · an imagined end of the 2026 session · nothing is saved' : 'Sandbox · Mon, Mar 16, 2026 · nothing is saved'}</div>` : ''}
    <header class="hdr"><div class="hdrin"><a class="brand" href="#/" aria-label="Bill Tracker home">${MARK}<span class="bname"><b>Bill Tracker</b><small>Hawaiʻi Public Health Institute</small></span></a>${nav}<span class="hspace"></span>${right}</div></header>`;
}
function tabbar(scr) {
  return `<nav class="tabs" aria-label="Main">${TABS.map(([t, href, ic, label]) => `<a href="${href}" ${scr.tab === t ? 'aria-current="page"' : ''}><span class="pill">${icon(ic, { size: 24 })}</span>${label}</a>`).join('')}</nav>`;
}

let lastRouteKey = '';
export function render() {
  let route = parseRoute();
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
  try { main = scr.render(route); } catch (e) { console.error(e); main = errorCard(); }
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
function wireFrame() {
  // Plain <a href="#/..."> links push history on their own; keep them in-app and reset scroll.
  $app().querySelectorAll('a[href^="#/"]').forEach(a => a.addEventListener('click', e => {
    if (e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault(); go(a.getAttribute('href'));
    if (a.hasAttribute('data-focussearch')) setTimeout(() => document.getElementById('q')?.focus(), 30);
  }));
  // "Skip to content" moves focus into the page. It used to be a #main link, which the router read as a page name.
  const skip = $app().querySelector('[data-skip]');
  if (skip) skip.onclick = () => { const m = document.getElementById('main'); m?.focus(); m?.scrollIntoView({ block: 'start' }); };
  const hs = $app().querySelector('[data-hsearch]');
  if (hs) { const inp = hs.querySelector('input'); const r = parseRoute(); if (r.name === 'find' && r.q) inp.value = r.q;
    hs.onsubmit = e => { e.preventDefault(); const q = inp.value.trim(); go('#/find' + (q ? '?q=' + encodeURIComponent(q) : '')); }; }
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
function welcomeBack() {
  const o = onb(), last = o.lastVisit ? Date.parse(o.lastVisit) : 0;
  if (last && Date.now() - last > 30 * 864e5 && (S.watch.size >= 3 || S.done.size)) nudge('back');
  onbSet({ lastVisit: new Date().toISOString() });
}
async function boot() {
  const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 12000));
  try {
    await Promise.race([(async () => { await loadUser(); await loadLists(); await loadBills(); })(), timeout]);
    welcomeBack();
    // Links shared before 9/19 become the new addresses; a first visit that arrives on a shared link gets the
    // guided start behind it, so Back goes somewhere helpful.
    const r = parseRoute();
    if (r.legacy) {
      if (firstVisit()) { history.replaceState({ y: 0 }, '', '#/start/1'); history.pushState({ y: 0, arrived: true }, '', toHash(r)); }
      else history.replaceState({ y: 0 }, '', toHash(r));
    }
    render();
  } catch (e) {
    console.error(e);
    $app().innerHTML = `${header({ name: 'error' }, {})}<main id="main">${errorCard()}</main>`;
  }
}
app.boot = boot;
$app().innerHTML = `<div class="hdr"></div><main>${skeleton(4)}</main>`;
// The clock starts with the script, so a start that hangs anywhere (the data file, the Supabase client) ends in the
// "Try again" card instead of a skeleton that never goes away.
Promise.race([init(), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 15000))]).then(boot)
  .catch(e => { console.error(e); $app().innerHTML = `<main id="main">${errorCard()}</main>`; });
