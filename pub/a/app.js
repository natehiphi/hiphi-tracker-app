// Version A of the public tracker (R-071, Nate 9/28): a second page beside track.html so testers can compare the two.
// Same data, same screens for My issues, Find, bill lists, legislators and the testimony walkthrough; a new Home
// (Now · Since · This week · Where your issues stand, backend R-070 Layout A) and a bill page that opens on where the
// bill is and what's next (Layout B's tracking top). Tabs: Home · My issues · Find · You. Sandbox only: track-a.html
// sends anyone without ?demo=1 to the sandbox, so nothing here reaches the live database or its counts.
// This frame is a copy of ../app.js with those swaps; keep the router in step with it.
import { S, DEMO, SEASON_OFF, app, icon, toast, init, loadUser, loadLists, loadBills, onb, onbSet, nudge,
  wiz, firstVisit, readyForSession, sessionInfo, loadCatalog, followsAnything, hstDay, loadReference, loadPool, issueFollowed } from '../core.js';
import { dayLabel } from '../testbed.js';
import { MARK } from '../art.js';
import { skeleton, btn } from '../ui.js';
import start from '../start.js';
import mybills from '../mybills.js';
import find, { headerSuggest } from '../find.js';
import { suggest } from '../suggest.js';
import people from '../people.js';
import committees from '../committees.js';
import more from '../more.js';
import helper from '../helper.js';
import { logDay, logAct } from '../visitlog.js';
import home from './home.js';
import bill from './bill.js';
app.onAct = logAct;

// An issue opened from My issues keeps My issues lit (the review found it lit Find, R-070 problem 8).
const issueSlug = () => (/#\/(?:find\/)?issue\/([^/?]+)/.exec(location.hash) || [])[1] || '';
const issueScreen = Object.create(find, { tab: { get() { const i = S.issues.find(x => x.slug === decodeURIComponent(issueSlug())); return i && issueFollowed(i) ? 'bills' : 'find'; } } });
const SCREENS = { start, learn: start, home, bills: mybills, find, issue: issueScreen, category: find, list: find, bill, legislators: people, legislator: people,
  committees, committee: committees, more, help: more, signin: more, settings: more, privacy: more };
// "You" replaces "More": your legislators, your email and settings, help (R-070 decision 6, tried here).
const TABS = [['home', '#/', 'house', 'Home'], ['bills', '#/bills', 'star', 'My issues'], ['find', '#/find', 'search', 'Find'], ['more', '#/more', 'circle-user', 'You']];

export function parseRoute(h = location.hash) {
  let m;
  const dh = decodeURIComponent(h || '');
  if ((m = /^#bill=([A-Za-z]+\s?\d+)/.exec(dh))) return { name: 'bill', num: m[1].replace(/\s/g, '').toUpperCase(), legacy: true };
  const [p, qs] = dh.replace(/^#/, '').split('?'), q = new URLSearchParams(qs || ''), seg = p.split('/').filter(Boolean);
  switch (seg[0]) {
    case undefined: return { name: 'home' };
    case 'start': return { name: 'start', step: Math.max(1, +seg[1] || 1) };
    case 'learn': return { name: 'learn', lesson: seg[1] || 'bill', bill: seg[2] || '' };
    case 'bills': return { name: 'bills' };
    case 'find': return seg[1] === 'issue' ? { name: 'issue', slug: seg[2] || '' } : seg[1] === 'category' ? { name: 'category', key: seg[2] || '' } : { name: 'find', q: q.get('q') || '' };
    case 'issue': return { name: 'issue', slug: seg[1] || '' };
    case 'list': return { name: 'list', slug: seg[1] || '' };
    case 'bill': return { name: 'bill', num: String(seg[1] || '').toUpperCase() };
    case 'legislators': return { name: 'legislators', from: q.get('from') || '' };
    case 'legislator': return { name: 'legislator', id: +seg[1] || 0, from: q.get('from') || '' };
    case 'committee': return { name: 'committee', code: String(seg[1] || '').toUpperCase() };
    default: return SCREENS[seg[0]] ? { name: seg[0] } : { name: 'home', unknown: true };
  }
}
const toHash = r => ({ bill: `#/bill/${r.num}` })[r.name] || '#/';

function go(path, { replace = false, keepScroll = false } = {}) {
  if (!replace && path === (location.hash || '#/')) { window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); return; }
  const y = window.scrollY;
  try { history.replaceState({ ...(history.state || {}), y }, ''); } catch { /* ignore */ }
  if (replace) history.replaceState({ y: 0, prev: history.state?.prev }, '', path); else history.pushState({ y: 0, prev: location.hash || '#/' }, '', path);
  render();
  if (!keepScroll) window.scrollTo(0, 0);
}
app.go = go;
window.addEventListener('popstate', e => { render(); const y = e.state?.y || 0; requestAnimationFrame(() => window.scrollTo(0, y)); });
try { history.scrollRestoration = 'manual'; } catch { /* ignore */ }

function header(route, scr) {
  const inStart = route.name === 'start';
  const right = inStart ? '' : `<form class="hsearch" role="search" data-hsearch><label class="sr" for="hq">Search issues and bills</label>${icon('search')}<input id="hq" type="search" placeholder="Search issues and bills: vaping, school meals" autocomplete="off" enterkeyhint="search"></form>
       <a class="hbtn hsearchbtn" href="#/find" aria-label="Search issues and bills" data-focussearch>${icon('search', { size: 24 })}</a>`;
  const nav = inStart ? '' : `<nav class="hnav" aria-label="Main">${TABS.map(([t, href, ic, label]) => `<a href="${href}" ${scr.tab === t ? 'aria-current="page"' : ''}>${icon(ic)}${label}</a>`).join('')}</nav>`;
  return `${DEMO ? `<div class="band">${SEASON_OFF ? 'Sandbox · version A · after the 2026 session · nothing is saved' : `Sandbox · version A · ${dayLabel()} · nothing is saved`}</div>` : ''}
    <header class="hdr"><div class="hdrin"><a class="brand" href="#/" aria-label="Bill Tracker home">${MARK}<span class="bname"><b>Bill Tracker</b><small>Hawaiʻi health bills · from HIPHI</small></span></a>${nav}<span class="hspace"></span>${right}</div></header>`;
}
function tabbar(scr) {
  return `<nav class="tabs" aria-label="Main">${TABS.map(([t, href, ic, label]) => `<a href="${href}" ${scr.tab === t ? 'aria-current="page"' : ''}><span class="pill">${icon(ic, { size: 24 })}</span>${label}</a>`).join('')}</nav>`;
}

let lastRouteKey = '';
export function render() {
  let route = parseRoute();
  if (route.unknown) { history.replaceState(history.state, '', '#/'); setTimeout(() => toast('That page isn’t here. This is the home page.'), 50); }
  if (route.name === 'home' && firstVisit()) { history.replaceState({ y: 0 }, '', `#/start/${readyForSession() ? 2 : wiz().step || 1}`); route = parseRoute(); }
  const scr = SCREENS[route.name] || home;
  const tabs = scr.tabs !== false && !(scr.noTabs && scr.noTabs(route));
  const bar = scr.bar ? scr.bar(route) : '';
  document.body.classList.add('va');
  document.body.classList.toggle('notabs', !tabs);
  document.body.classList.toggle('withtabs', tabs);
  document.body.classList.toggle('hasbar', !!bar);
  document.body.dataset.screen = route.name;
  let main;
  try { main = scr.render(route); } catch (e) { console.error(e); main = errorCard(); }
  const keep = location.hash === lastRouteKey ? focusKey(document.activeElement) : null;
  $app().innerHTML = `<button type="button" class="skip" data-skip>Skip to content</button>${header(route, scr)}
    <main id="main" tabindex="-1">${main}${bar ? `<div class="actionbar"><div class="inner">${bar}</div></div>` : ''}</main>
    ${tabs ? tabbar(scr) : ''}
    ${helper.render()}`;
  document.title = (scr.title ? scr.title(route) + ' · ' : '') + 'HIPHI Bill Tracker (version A)';
  try { scr.wire && scr.wire(route); } catch (e) { console.error(e); }
  helper.wire();
  wireFrame();
  if (keep && !document.querySelector('dialog[open]')) { const el = findByKey(keep); if (el && el !== document.activeElement) el.focus({ preventScroll: true }); }
  const key = location.hash;
  if (key !== lastRouteKey) { lastRouteKey = key; if (document.activeElement === document.body || !$app().contains(document.activeElement)) $app().querySelector('main')?.focus({ preventScroll: true }); }
}
app.render = render;
const $app = () => document.getElementById('app');
function focusKey(el) {
  if (!el || el === document.body || !$app().contains(el)) return null;
  if (el.id) return { sel: '#' + CSS.escape(el.id) };
  const a = [...el.attributes].find(x => x.name.startsWith('data-') && x.value !== '');
  if (a) return { sel: `${el.tagName.toLowerCase()}[${a.name}="${CSS.escape(a.value)}"]` };
  const href = el.getAttribute && el.getAttribute('href');
  return href ? { sel: `a[href="${CSS.escape(href)}"]` } : null;
}
const findByKey = k => { try { return $app().querySelector(k.sel); } catch { return null; } };
const pathOf = h => String(h || '').split('?')[0];
function wireFrame() {
  $app().querySelectorAll('a[href^="#/"]').forEach(a => a.addEventListener('click', e => {
    if (e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    if (a.hasAttribute('data-back')) { const to = a.getAttribute('href'), prev = history.state?.prev;
      if (prev && pathOf(prev) === pathOf(to)) history.back(); else go(to, { replace: true }); return; }
    go(a.getAttribute('href'));
    if (a.hasAttribute('data-focussearch')) setTimeout(() => document.getElementById('q')?.focus(), 30);
  }));
  const skip = $app().querySelector('[data-skip]');
  if (skip) skip.onclick = () => { const m = document.getElementById('main'); m?.focus(); m?.scrollIntoView({ block: 'start' }); };
  const hs = $app().querySelector('[data-hsearch]');
  if (hs) { const inp = hs.querySelector('input'); const r = parseRoute(); if (r.name === 'find' && r.q) inp.value = r.q;
    hs.onsubmit = e => { e.preventDefault(); const q = inp.value.trim(); go('#/find' + (q ? '?q=' + encodeURIComponent(q) : '')); };
    suggest(inp, { source: headerSuggest, open: go, min: 3, wait: 200, when: () => parseRoute().name !== 'find', label: 'Suggested issues and bills',
      busy: 'Looking for bills', failed: 'Search didn’t work just now. Check your connection and try again.',
      empty: q => `No issues or bills match “${q}”. Try one word, like vaping, or a bill number.`,
      seeAll: (q, hits) => hits ? { href: '#/find?q=' + encodeURIComponent(q), label: `See all results for “${q}”` } : { href: '#/find', label: 'Browse all issues', icon: 'arrow-right' } }); }
}
const errorCard = () => `<div class="empty"><h2>We couldn’t load the bills</h2><p>Check your connection and try again.</p>${btn('Try again', { kind: 'primary', icon: 'rotate-ccw', attrs: { onclick: 'location.reload()' } })}</div>`;

document.addEventListener('keydown', e => {
  const t = e.target, typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
  if (typing || e.metaKey || e.ctrlKey || e.altKey || document.querySelector('dialog[open]')) return;
  if (e.key === '/') { e.preventDefault(); if (parseRoute().name !== 'find') go('#/find'); setTimeout(() => document.getElementById('q')?.focus(), 30); }
  else if (e.key === '?') { e.preventDefault(); go('#/help'); }
});

// As ../app.js: the last visit is kept for Home's "Since", and the email ask comes on the second day back.
function welcomeBack() {
  const o = onb(), last = o.lastVisit ? Date.parse(o.lastVisit) : 0;
  S.prevVisit = o.lastVisit || null;
  if (last && hstDay(last) !== hstDay(Date.now()) && (followsAnything() || S.done.size) && !S.session) nudge('back');
  onbSet({ lastVisit: new Date().toISOString() });
}
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); S.installPrompt = e; });
async function boot() {
  const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 12000));
  try {
    if (!DEMO) { loadReference().catch(() => {}); loadPool().catch(() => {}); }
    await Promise.race([(async () => { await loadCatalog(); await loadUser(); await loadLists(); await loadBills(); })(), timeout]);
    welcomeBack();
    logDay({ follows: followsAnything(), signedIn: !!S.session, season: sessionInfo().phase === 'in' ? 'in' : 'off' });
    const r = parseRoute();
    if (r.legacy) history.replaceState({ y: 0 }, '', toHash(r));
    render();
  } catch (e) {
    console.error(e);
    $app().innerHTML = `${header({ name: 'error' }, {})}<main id="main">${errorCard()}</main>`;
  }
}
app.boot = boot;
$app().innerHTML = `<div class="hdr"></div><main>${skeleton(4)}</main>`;
Promise.race([init(), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 15000))]).then(boot)
  .catch(e => { console.error(e); $app().innerHTML = `<main id="main">${errorCard()}</main>`; });
