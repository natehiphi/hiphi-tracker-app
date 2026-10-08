// HIPHI Staff v2: the frame and the router (plan section 2). Since 9/21 (R-022) this is the staff app at the tracker's
// own address (index.html and staff.html both load it); the old app lives on at classic.html for a week as the way
// back, then retires. Screens are modules with
// { render(route), wire(route, root), bar?(route), title(route), back?(route), tab, tabs?, wide?, narrow? }.
import { S, DB, DEMO, DEMO_ASOF, SESSION_OVER, APP_URL, LINK_ERR, LINK_TOKEN, RECOVERY, setRecovery, hooks, esc, advocate } from './data.js';
import { icon, btn, iconBtn, toast, skeleton, empty, menuSheet, popSheet, sheetOpen, closeSheet, takeSheetEntry, avatar, keysOn } from './ui.js';
import { MARK } from '../pub/art.js';
import { reportError } from './errlog.js';
import { exactBill, inboxCount, billRoute, FACTS, draftFor, diedish } from './model.js';
import today, { reviewQueue } from './today.js';
import review from './review.js';
import inbox from './inbox.js';
import tasks from './tasks.js';
import bill from './bill.js';
import bills from './bills.js';
import triage from './triage.js';
import memo from './memo.js';
import legislators from './legislators.js';
import legislator from './legislator.js';
import search, { headerHits } from './search.js';
import { suggest } from '../pub/suggest.js';
import { keepWordsWhole } from '../pub/ui.js';
import supporters from './supporters.js';
import person from './person.js';
import lists from './lists.js';
import issues, { issuePage as issue } from './issues.js';
import list from './list.js';
import emails from './emails.js';
import composer from './composer.js';
import me from './me.js';
import setup from './setup.js';
import help from './help.js';
import devui from './devui.js';
import hearing from './hearing.js';
import coalition from './coalition.js';

keepWordsWhole(document.body);   // "e-cigarettes" never splits at its hyphen on a staff screen either (X9-1, X9-6)

// ---- routes ----
const SCREENS = { today, review, inbox, tasks, bill, bills, triage, memo, legislators, legislator, search, supporters, person, issues, issue, lists, list, emails, composer, me, setup, help, devui, hearing, coalition };
export function parseRoute(h = location.hash) {
  // A "%" that is not part of a code (a stray one in a pasted link) made decodeURIComponent throw, and the page never drew (R-152 D).
  let dh; try { dh = decodeURIComponent(h || ''); } catch { dh = String(h || '').replace(/%(?![0-9a-fA-F]{2})/g, '%25'); try { dh = decodeURIComponent(dh); } catch { dh = '#/'; } }
  let m;
  if ((m = /^#bill=([A-Za-z]+\s?\d+)/.exec(dh))) return { name: 'bill', num: m[1].replace(/\s/g, '').toUpperCase(), tab: 'overview', legacy: true };
  // The old app's other addresses, still written into Slack and calendar links: approvals, and the calendar connect.
  if (/^#emails\b/.test(dh)) return { name: 'review', id: '', q: {}, legacyTo: '#/review' };
  if ((m = /^#calendar=(.*)$/.exec(dh))) return { name: 'me', q: {}, legacyTo: '#/me', note: m[1] };
  const [p, qs] = dh.replace(/^#/, '').split('?'), q = Object.fromEntries(new URLSearchParams(qs || '')), seg = p.split('/').filter(Boolean);
  switch (seg[0]) {
    case undefined: return { name: 'today', q };
    case 'review': return { name: 'review', id: seg[1] || '', q };
    case 'inbox': return { name: 'inbox', q };
    case 'tasks': return { name: 'tasks', q };
    case 'bills': return seg[1] === 'new' ? { name: 'triage', q } : seg[1] === 'memo' ? { name: 'memo', q } : { name: 'bills', muted: seg[1] === 'muted', q };
    // #/bill/HB2121 is the current session's bill; an earlier session's is #/bill/2026/HB2121 (R-152 B, as the public page since R-110).
    case 'bill': { const yr = /^\d{4}$/.test(seg[1] || ''); return { name: 'bill', year: yr ? seg[1] : '', num: String(seg[yr ? 2 : 1] || '').toUpperCase(), tab: seg[yr ? 3 : 2] || 'overview', q }; }
    case 'legislators': return { name: 'legislators', q };
    case 'legislator': return { name: 'legislator', id: +seg[1] || 0, from: q.from || '', q };
    case 'hearing': return { name: 'hearing', id: seg[1] || '', q };
    case 'coalition': return { name: 'coalition', id: seg[1] || '', q };
    case 'outreach': return seg[1] === 'lists' ? { name: 'lists', q } : seg[1] === 'emails' ? { name: 'emails', q } : seg[1] === 'issues' ? { name: 'issues', q } : { name: 'supporters', q };
    case 'issue': return { name: 'issue', id: seg[1] || '', q };
    case 'person': return { name: 'person', id: seg[1] || '', q };
    case 'list': return { name: 'list', id: seg[1] || '', q };
    case 'email': return seg[1] === 'new' ? { name: 'composer', id: '', q } : { name: 'composer', id: seg[1] || '', q };
    case 'search': return { name: 'search', q };
    case 'me': return { name: 'me', q };
    case 'setup': return { name: 'setup', section: seg[1] || '', q };
    case 'help': return { name: 'help', topic: seg[1] || '', q };
    case 'dev': return { name: 'devui', q };
    default: return { name: 'today', q };
  }
}
const TABS = [['today', '#/', 'list-todo', 'Today'], ['bills', '#/bills', 'scroll-text', 'Bills'], ['legislators', '#/legislators', 'landmark', 'Legislators'], ['outreach', '#/outreach', 'megaphone', 'Outreach']];

// go('#/bills') pushes history (Back works); { replace: true } swaps the current entry.
let depth = 0;   // in-app steps behind this page (history.state.d), so a back link knows whether real Back stays in the app
export function go(path, { replace = false, keepScroll = false, force = false } = {}) {
  // A screen with unsaved work can ask first, for the frame's own jumps too (your menu, the header search, a g
  // shortcut): it registers (S.leaveGuards ??= []).push(proceed => boolean). True means "I am asking; I will call
  // proceed() if they choose to leave". A guard must answer false at once when it has nothing unsaved.
  if (!force) for (const g of S.leaveGuards || []) { let held = false; try { held = g(() => go(path, { replace, keepScroll, force: true })) === true; } catch (e) { console.error(e); } if (held) return; }
  if (takeSheetEntry()) replace = true;   // the sheet's history entry becomes this page, so no late Back undoes it
  try { history.replaceState({ ...(history.state || {}), y: window.scrollY }, ''); } catch { /* ignore */ }
  if (replace) history.replaceState({ y: 0, d: depth }, '', path); else history.pushState({ y: 0, d: ++depth }, '', path);
  render(); S.scrollClaimed = false;   // go() puts the page at the top itself; a page's own later scroll still runs
  if (!keepScroll) window.scrollTo(0, 0);
}
S.go = go;
window.addEventListener('popstate', e => {
  if (popSheet()) return;                      // Back closed a sheet: the page underneath stays as it is
  depth = e.state?.d || 0;
  render(); const y = e.state?.y || 0;
  // A page that scrolls to something itself (Today's "Write it" lands at the ask box, X10-3) claims the scroll with S.scrollClaimed; this restore, queued after it, would put the page back at the top.
  requestAnimationFrame(() => { if (S.scrollClaimed) { S.scrollClaimed = false; return; } window.scrollTo(0, y); });
});
try { history.scrollRestoration = 'manual'; } catch { /* ignore */ }
// Crossing a layout width (a rotated tablet, a resized window) redraws the page, so screens that draw differently for
// desktop are never left in the wrong shape.
for (const q of ['(min-width: 900px)', '(min-width: 1100px)']) { try { matchMedia(q).addEventListener('change', () => { if (S.route && !document.querySelector('dialog[open]')) render(); }); } catch { /* old browsers */ } }

// ---- the frame ----
export function badge() { try { return (today.badge && today.badge()) || { n: 0, late: false }; } catch { return { n: 0, late: false }; } }
function header(route, scr, pageH1 = false) {
  const b = scr.back ? scr.back(route) : null, title = scr.title ? scr.title(route) : '';
  const bd = badge();
  const pill = bd.n ? `<span class="sv-badge${bd.late ? ' late' : ''}" aria-label="${bd.n} due${bd.late ? ', some overdue' : ''}">${bd.n > 99 ? '99+' : bd.n}</span>` : '';
  return `<header class="sv-hdr">
    ${b ? `<a class="sv-back phone" href="${esc(b.href)}" data-back${b.label.length > 12 ? ` aria-label="Back to ${esc(b.label)}"` : ''}>${icon('chevron-left')}<span>${esc(b.label.length > 12 ? 'Back' : b.label)}</span></a>` : ''}
    <a class="sv-brand" href="#/" aria-label="Today">${MARK}<span>Bill Tracker</span></a>
    ${pageH1 ? `<span class="sv-title" aria-hidden="true">${esc(b ? '' : title)}</span>` : `<h1 class="sv-title">${esc(title)}</h1>`}
    <nav class="sv-nav" aria-label="Main">${TABS.map(([t, href, ic, label]) => `<a href="${href}" ${scr.tab === t ? 'aria-current="page"' : ''}>${icon(ic)}${label}${t === 'today' ? pill : ''}</a>`).join('')}</nav>
    <form class="sv-search" role="search" data-hsearch><label class="sr" for="hq">Search bills, legislators, people</label>${icon('search')}<input id="hq" type="search" placeholder="Search bills, legislators, people" autocomplete="off"></form>
    <a class="iconbtn sv-srchbtn" href="#/search" aria-label="Search">${icon('search')}</a>
    <button type="button" class="sv-avbtn" data-avatar aria-label="Your menu" aria-haspopup="menu">${avatar(S.me, 32)}${icon('chevron-down', { cls: 'sv-avchev' })}</button>
  </header>`;
}
// The desktop sidebar (1100px and wider; staff.css hides it below that, where the header carries the four tabs).
// A wide screen has room to show where everything is, so the pages that sit behind a menu on a phone are one click
// away here: Review, the Inbox, Sort new bills, the weekly memo, Lists, Emails, setup and help.
const SIDE = [
  ['today', '#/', 'list-todo', 'Today', [['review', '#/review', 'Review'], ['inbox', '#/inbox', 'Inbox'], ['tasks', '#/tasks', 'Tasks']]],
  ['bills', '#/bills', 'scroll-text', 'Bills', [['triage', '#/bills/new', 'Sort new bills'], ['memo', '#/bills/memo', 'Weekly memo']]],
  ['legislators', '#/legislators', 'landmark', 'Legislators', []],
  ['outreach', '#/outreach', 'megaphone', 'Outreach', [['supporters', '#/outreach', 'Supporters'], ['issues', '#/outreach/issues', 'Issues'], ['coalitions', '#/coalition', 'Coalitions'], ['lists', '#/outreach/lists', 'Lists'], ['emails', '#/outreach/emails', 'Emails']]],
];
const SUB_OF = { review: 'review', inbox: 'inbox', tasks: 'tasks', triage: 'triage', memo: 'memo', supporters: 'supporters', person: 'supporters', issues: 'issues', issue: 'issues', coalition: 'coalitions', lists: 'lists', list: 'lists', emails: 'emails', composer: 'emails' };
// Collapsing the sidebar is about this screen, not about the person, so it stays in this browser rather than
// following them to their phone (where there is no sidebar at all).
export const sideNarrow = () => { try { return localStorage.getItem('sv_side') === 'narrow'; } catch { return false; } };
const setSideNarrow = on => { try { on ? localStorage.setItem('sv_side', 'narrow') : localStorage.removeItem('sv_side'); } catch { /* private window: this visit only */ } };
function sidebar(route, scr) {
  const bd = badge(), sub = SUB_OF[route.name] || '';
  let rv = 0, ib = 0; try { rv = reviewQueue().length; ib = inboxCount(); } catch { rv = rv || 0; }
  const count = n => n ? `<span class="sv-sn">${n > 99 ? '99+' : n}</span>` : '';
  const foot = [['help', '#/help', 'circle-help', 'Help'], ...(S.me?.is_admin ? [['setup', '#/setup', 'sliders-horizontal', 'Session setup']] : []), ['me', '#/me', 'settings', 'My settings']];
  return `<aside class="sv-side" aria-label="Sections">
    <a class="sv-sbrand" href="#/" aria-label="Bill Tracker, Today">${MARK}<span>Bill Tracker<small>HIPHI staff</small></span></a>
    <nav class="sv-snav" aria-label="Main">${SIDE.map(([t, href, ic, label, subs]) => `<div class="sv-sgrp">
      <a class="sv-sitem" href="${href}" title="${label}" ${scr.tab === t && !sub ? 'aria-current="page"' : ''}${scr.tab === t ? ' data-open' : ''}>${icon(ic)}<span class="lbl">${label}</span>${t === 'today' && bd.n ? `<span class="sv-sn${bd.late ? ' late' : ''}" aria-label="${bd.n} due${bd.late ? ', some overdue' : ''}">${bd.n > 99 ? '99+' : bd.n}</span>` : ''}</a>
      ${subs.length ? `<div class="sv-ssub">${subs.map(([k, h, l]) => `<a class="sv-sitem sub" href="${h}" ${sub === k ? 'aria-current="page"' : ''}><span class="lbl">${l}</span>${k === 'review' ? count(rv) : k === 'inbox' ? count(ib) : ''}</a>`).join('')}</div>` : ''}</div>`).join('')}</nav>
    <nav class="sv-sfoot" aria-label="Help and settings">${foot.map(([k, h, ic, l]) => `<a class="sv-sitem" href="${h}" title="${l}" ${route.name === k ? 'aria-current="page"' : ''}>${icon(ic)}<span class="lbl">${l}</span></a>`).join('')}
      ${syncLine()}
      <button type="button" class="sv-scollapse" data-sidecol aria-pressed="${sideNarrow()}">${icon(sideNarrow() ? 'panel-left-open' : 'panel-left-close')}<span>Collapse</span></button></nav>
  </aside>`;
}
// How fresh the Capitol data is, for everyone (the old app showed it to all; v2 had it for admins only; B-7).
function syncLine() {
  if (DEMO) return `<p class="sv-sync">${icon('refresh-cw', { size: 14 })}<span>Sandbox data, as of ${new Date(DEMO_ASOF).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'Pacific/Honolulu' })}</span></p>`;
  const last = (S.syncRuns || []).find(r => r.ok)?.finished_at; if (!last) return '';
  const h = Math.floor((Date.now() - new Date(last).getTime()) / 36e5), stale = h >= 12;
  const ago = h < 1 ? 'less than an hour ago' : h < 48 ? `${h} hour${h === 1 ? '' : 's'} ago` : `${Math.floor(h / 24)} days ago`;
  return `<p class="sv-sync${stale ? ' late' : ''}">${icon(stale ? 'circle-alert' : 'refresh-cw', { size: 14 })}<span>Capitol data synced ${ago}</span></p>`;
}
function tabbar(scr) {
  const bd = badge();
  return `<nav class="sv-tabs" aria-label="Main">${TABS.map(([t, href, ic, label]) => `<a href="${href}" ${scr.tab === t ? 'aria-current="page"' : ''}><span class="pill">${icon(ic, { size: 24 })}</span>${label}${t === 'today' && bd.n ? `<span class="sv-badge${bd.late ? ' late' : ''}">${bd.n > 99 ? '99+' : bd.n}</span>` : ''}</a>`).join('')}</nav>`;
}
// A read that failed is said at the top of every screen, with a Reload (R-152 B). Before, eight of about fifty sign-in reads
// stopped the app and the rest quietly became empty lists. S.loadFailed names them (data.js loadAll).
function loadNotice() {
  const f = S.loadFailed || [];
  if (!f.length || DEMO) return '';
  return `<div class="sv-failnote" role="alert"><p><b>Some of this did not load:</b> ${esc(f.join(', '))}. What you see may be missing things.</p>${btn('Reload', { kind: 'secondary', sm: true, icon: 'rotate-ccw', attrs: { 'data-reload': '1' } })}</div>`;
}
// Fresh data (R-152 B). The app read the database once, at sign-in, and never again, so an approval from a phone or a new
// draft stayed invisible on a teammate's open laptop. It now reads again when someone comes back to the tab after five
// minutes away, and "Refresh" in the menu does it on demand. The screen is redrawn only when that cannot lose anything:
// not while a dialog or sheet is open or a box is being typed in (the data is still updated underneath; the next move shows it).
const STALE_MS = 5 * 60e3;
let hiddenAt = 0, refreshing = false;
const busyTyping = () => { const a = document.activeElement; return !!document.querySelector('dialog[open]') || sheetOpen() || !!(a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT' || a.isContentEditable)); };
export async function refreshData({ say = false } = {}) {
  if (refreshing) return false;
  if (DEMO) { if (say) toast('This is the sandbox, so there is nothing newer to read.'); return false; }
  refreshing = true;
  try {
    await DB.loadAll();
    FACTS.clear();
    if (!busyTyping()) render();
    if (say) toast((S.loadFailed || []).length ? 'Reloaded, but some of it still did not load.' : 'Up to date.', (S.loadFailed || []).length ? { err: true } : { ok: true });
    return true;
  } catch (e) {
    console.error(e);
    if (say) toast('Could not reload. Check your connection and try again.', { err: true });
    return false;
  } finally { refreshing = false; }
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') { hiddenAt = Date.now(); return; }
  if (hiddenAt && Date.now() - hiddenAt >= STALE_MS && S.session) refreshData();
  hiddenAt = 0;
});
let lastKey = '';
export function render() {
  if (LINK_TOKEN && !S.linkUsed) return renderLink();
  if (!S.session && !DEMO) return renderLogin();
  if (RECOVERY && !DEMO) return renderRecovery();
  const route = parseRoute(); S.route = route;
  const scr = SCREENS[route.name] || today;
  const tabs = scr.tabs !== false && !(scr.noTabs && scr.noTabs(route));
  let main, bar = '';
  try { main = loadNotice() + scr.render(route); bar = scr.bar ? scr.bar(route) : ''; } catch (e) { console.error(e); reportError('render', e); main = empty({ title: 'Something went wrong on this page', text: 'Try again, or go back to Today.', action: btn('Back to Today', { href: '#/' }) }); }
  const cls = document.body.classList;
  cls.add('staff2'); cls.toggle('sidenarrow', sideNarrow()); cls.toggle('notabs', !tabs); cls.toggle('withtabs', tabs); cls.toggle('hasbar', !!bar); cls.toggle('wide', !!(scr.wide && scr.wide(route)));
  document.body.dataset.screen = route.name;
  // Desktop widths: a screen is 1120px by default; `wide` (tables) uses the whole window; `narrow` (one focused task
  // or a form: review, settings) stays a 760px reading column.
  document.body.toggleAttribute('data-narrow', !!(typeof scr.narrow === 'function' ? scr.narrow(route) : scr.narrow));
  const app = document.getElementById('app');
  // One h1 per page: the page's own when it has one, else the frame's title (hidden visually on desktop).
  // The action bar lives inside <main>, as its last child: fixed to the bottom on phones, and on a wide screen it
  // sits right under the content it acts on (staff.css), never a screen-height away from it.
  // Sandbox: practise as anyone on the team from your menu (it used to take editing the address, &as=LR, which nobody
  // would find). The band stays plain text: a control inside a 28px band cannot be a 44px target (A-6).
  const band = DEMO ? `<div class="band">Sandbox · ${new Date(DEMO_ASOF).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Pacific/Honolulu' })} · as ${esc((S.me?.full_name || '').split(' ')[0])} · nothing is saved<span class="band-hint"> · switch person in your menu</span></div>` : '';
  app.innerHTML = `<button type="button" class="skip" data-skip>Skip to content</button>${band}${sidebar(route, scr)}<div class="sv-page">${header(route, scr, /<h1[\s>]/i.test(main || ''))}<main id="main" tabindex="-1">${main}${bar ? `<div class="actionbar"><div class="inner">${bar}</div></div>` : ''}</main></div>${tabs ? tabbar(scr) : ''}`;
  // One heading a screen reader can find, on every screen at every width. Phones hide a page's own h1 (the header
  // already shows the title), which left 12 of 22 screens with no heading at all: where the page's h1 is not drawn,
  // the header's title is the heading.
  const ownH1 = app.querySelector('main h1'), ft = app.querySelector('.sv-hdr .sv-title');
  if (ft && ft.tagName !== 'H1' && (!ownH1 || getComputedStyle(ownH1).display === 'none')) { ft.removeAttribute('aria-hidden'); ft.setAttribute('role', 'heading'); ft.setAttribute('aria-level', '1'); }
  try { clearTimeout(window.__bootT); } catch { /* ignore */ }
  document.title = (scr.title ? scr.title(route) + ' · ' : '') + 'Bill Tracker staff';
  try { scr.wire && scr.wire(route, app); } catch (e) { console.error(e); reportError('error', e); }
  wireFrame(app);
  if (location.hash !== lastKey) { lastKey = location.hash; if (!app.contains(document.activeElement) || document.activeElement === document.body) app.querySelector('main')?.focus({ preventScroll: true }); }
}
hooks.render = () => render();
hooks.afterLoad = () => FACTS.clear();   // the derived facts are rebuilt from the new rows (R-152 B)
hooks.toast = (m, err) => toast(m, err ? { err: true } : {});
hooks.onAuth = () => boot();
hooks.onRecovery = () => renderRecovery();
function wireFrame(app) {
  app.querySelectorAll('a[href^="#/"]').forEach(a => a.addEventListener('click', e => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.defaultPrevented) return;
    e.preventDefault();
    // A back link uses real Back when this page was opened from inside the app, so the list comes back where it was.
    if (a.hasAttribute('data-back') && depth > 0) { history.back(); return; }
    go(a.getAttribute('href'));
  }));
  app.querySelector('[data-avatar]')?.addEventListener('click', avatarMenu);
  app.querySelector('[data-reload]')?.addEventListener('click', () => refreshData({ say: true }));
  // Collapse: redrawn in place, so the page under it keeps its scroll position and nothing else moves.
  app.querySelector('[data-sidecol]')?.addEventListener('click', () => { setSideNarrow(!sideNarrow()); render(); document.querySelector('[data-sidecol]')?.focus(); });
  // "Skip to content" moves focus into the page. As a #main link the router read it as a page name and went to Today.
  const skip = app.querySelector('[data-skip]');
  if (skip) skip.onclick = () => { const m = document.getElementById('main'); m?.focus(); m?.scrollIntoView({ block: 'start' }); };
  const f = app.querySelector('[data-hsearch]');
  if (f) { f.onsubmit = e => { e.preventDefault(); const q = f.querySelector('input').value.trim(); const b = exactBill(q); go(b ? billRoute(b) : '#/search' + (q ? '?q=' + encodeURIComponent(q) : '')); };
    // Bills (tracked and not), issues, legislators and supporters listed as you type (R-032, the same list as the public
    // header's). On the Search page the results under the box are the list. With nothing named that way, Search still
    // looks through sponsors, owners and committees, so the last row says so.
    suggest(f.querySelector('input'), { source: headerHits, open: go, when: () => S.route?.name !== 'search', label: 'Suggested bills, issues, legislators and supporters',
      busy: 'Looking through every bill', empty: q => `No bill, issue, legislator or supporter matches “${q}”.`,
      seeAll: (q, hits) => ({ href: '#/search?q=' + encodeURIComponent(q), label: hits ? `See all results for “${q}”` : `Look for “${q}” in sponsors, owners and committees` }) }); }
  app.querySelector('[data-asbtn]')?.addEventListener('click', practiseAs);
}
function practiseAs() {
  menuSheet({ title: 'Practise as', items: S.advocates.filter(a => a.is_active !== false).map(a => ({
    label: a.full_name + (a.id === S.me?.id ? ' (now)' : ''), icon: 'user-round', sub: a.is_admin ? 'Admin: approves, sets up the session' : a.can_approve ? 'Approver: testimony and supporter emails' : a.is_reviewer ? 'Reviewer: second approvals' : (billsOwned(a.id) ? `${billsOwned(a.id)} bills` : 'No bills of their own'),
    run: () => { const u = new URL(location.href); u.searchParams.set('as', a.initials); location.href = u.toString(); } })) });
}
const billsOwned = id => S.bills.filter(b => (S.assignments[b.id] || []).includes(id)).length;
function avatarMenu() {
  menuSheet({ title: S.me?.full_name || 'Your menu', items: [
    DEMO ? { label: 'Practise as someone else', icon: 'users-round', sub: 'Sandbox: see the app as a teammate sees it', run: () => setTimeout(practiseAs, 50) } : null,
    { label: 'Inbox', icon: 'inbox', sub: (n => n ? `${n} unread that need${n === 1 ? 's' : ''} you` : 'Everything sent to you, read or not')(inboxCount()), run: () => go('#/inbox') },
    { label: 'Tasks', icon: 'list-checks', sub: 'Every task on your bills, with its due date', run: () => go('#/tasks') },
    { label: 'Refresh', icon: 'refresh-cw', sub: 'Read what your teammates changed since this page loaded', run: () => setTimeout(() => refreshData({ say: true }), 50) },
    { label: 'My settings', icon: 'settings', run: () => go('#/me') },
    S.me?.is_admin ? { label: 'Session setup', icon: 'sliders-horizontal', run: () => go('#/setup') } : null,
    { label: 'Help', icon: 'circle-help', run: () => go('#/help') },
    { label: 'Open the old app', icon: 'external-link', sub: 'The old staff app, look-only', run: () => { location.href = APP_URL + 'classic.html' + (DEMO ? '?demo=1' : ''); } },
    DEMO ? null : { label: 'Sign out', icon: 'log-out', run: async () => { await DB.logout(); } },
  ] });
}

// ---- keyboard: desktop only (Help lists these; never shown on touch screens) ----
let gPending = 0;
document.addEventListener('keydown', e => {
  const t = e.target, typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
  if (typing || e.metaKey || e.ctrlKey || e.altKey || document.querySelector('dialog[open]') || !keysOn()) return;
  if (e.key === '?') { e.preventDefault(); go('#/help/keys'); return; }
  if (e.key === '/') { e.preventDefault(); const q = document.getElementById('hq'); if (q && q.offsetParent) q.focus(); else go('#/search'); return; }
  if (e.key === 'g') { gPending = Date.now(); return; }
  if (gPending && Date.now() - gPending < 1200) { gPending = 0; const to = { t: '#/', b: '#/bills', l: '#/legislators', o: '#/outreach', r: '#/review', i: '#/inbox', k: '#/tasks' }[e.key]; if (to) { e.preventDefault(); go(to); } }
});

// ---- sign in and a new password (same calls as the current app) ----
// Both pages say whose tracker this is and point anyone from the public to their own page: the main address is this
// app, so a resident who types it lands here (X9-2, C-11, B-3). staff.css centres them across the whole window; on a
// laptop they used to land in the 248px side column of the signed-in frame's grid.
const LOGIN_NAME = 'HIPHI Bill Tracker · for the HIPHI team';
const loginTop = h1 => { document.body.classList.add('staff2', 'notabs'); document.title = `${h1} · ${LOGIN_NAME}`;
  return `<p class="sv-lbrand">${MARK.replace('class="mark"', 'class="mark mk"')}<span><b>HIPHI Bill Tracker</b><span class="sv-lsep" aria-hidden="true"> · </span><span class="sv-lfor">for the HIPHI team</span></span></p><h1>${h1}</h1>`; };
const loginFoot = `<p class="sv-lpub">Looking for the public tracker? <a href="track.html">Follow bills and speak up there</a></p>`;
function renderLogin() {
  document.getElementById('app').innerHTML = `<main id="main" class="sv-login">${loginTop('Staff sign in')}
    <form id="lf" novalidate class="stack16 card sv-lcard">
      <div class="field"><label for="l-email">Email</label><input id="l-email" type="email" autocomplete="username" inputmode="email" required></div>
      <div class="field"><label for="l-pass">Password</label><input id="l-pass" type="password" autocomplete="current-password" required></div>
      <div id="l-err" role="alert">${LINK_ERR ? `<p class="inlinemsg">${icon('circle-alert')}${esc(LINK_ERR)}. Each link works only once. Request a new one.</p>` : ''}</div>
      ${btn('Sign in', { kind: 'primary', full: true, attrs: { type: 'submit', id: 'l-go' } })}
      ${btn('Forgot your password?', { kind: 'text', attrs: { id: 'l-forgot', 'aria-expanded': 'false', 'aria-controls': 'l-help' } })}
      <div id="l-help" hidden></div>
    </form>${loginFoot}</main>`;
  const err = m => { document.getElementById('l-err').innerHTML = m ? `<p class="inlinemsg">${icon('circle-alert')}${esc(m)}</p>` : ''; };
  document.getElementById('lf').onsubmit = async e => { e.preventDefault(); err('');
    const b = document.getElementById('l-go'); b.setAttribute('aria-busy', 'true');
    try { await DB.login(document.getElementById('l-email').value.trim(), document.getElementById('l-pass').value); }
    catch (x) { err(x.message || 'Sign-in failed'); } finally { b.removeAttribute('aria-busy'); } };
  // Forgot your password? (M1-6, R-199). Supabase can only email a reset to its own account's team until its sign-in email
  // goes through HIPHI's email service (Nate's step, R-101 and R-002), so today the button asks the admin, in Slack, to
  // send a new sign-in link, and says so. SELF_RESET turns the email reset back on once that step is done.
  document.getElementById('l-forgot').onclick = async () => { const email = document.getElementById('l-email').value.trim(); err('');
    const help = document.getElementById('l-help'), b = document.getElementById('l-forgot');
    if (!email) { err('Enter your email address first, then press Forgot your password? again.'); document.getElementById('l-email').focus(); return; }
    b.setAttribute('aria-busy', 'true');
    try {
      if (SELF_RESET) { await DB.sendRecovery(email); help.innerHTML = `<p class="sv-lhelp" role="status">${icon('mail')}If ${esc(email)} is on the team, a link to choose a new password is on its way. It works once.</p>`; }
      else { await DB.askPasswordHelp(email); help.innerHTML = `<p class="sv-lhelp" role="status">${icon('send')}We've let the tracker's admin (Nate) know in Slack. If ${esc(email)} is on the team, Nate will email you a new sign-in link. Open it, press Continue, and choose a new password.</p>`; }
      help.hidden = false; b.setAttribute('aria-expanded', 'true');
    } catch (x) { console.warn(x); err('That did not go through. Ask Nate directly for a new sign-in link.'); }   // B-8: plain words, never the server's
    finally { b.removeAttribute('aria-busy'); } };
}
const SELF_RESET = false;   // true after Supabase Auth sends through Postmark (docs/BREAK-GLASS.md, R-101)
// A sign-in link from Session setup > Team opens here first (M1-3): nothing is used until Continue is pressed, so a link
// preview cannot spend it. Continue turns the link into a session and goes on to "Choose a new password".
function renderLink() {
  document.getElementById('app').innerHTML = `<main id="main" class="sv-login">${loginTop('Welcome to the Bill Tracker')}
    <div class="stack16 card sv-lcard"><p>Press Continue to choose your password and sign in. This link works once.</p>
      <div id="k-err" role="alert"></div>
      ${btn('Continue', { kind: 'primary', full: true, attrs: { id: 'k-go' } })}</div>${loginFoot}</main>`;
  const err = m => { document.getElementById('k-err').innerHTML = m ? `<p class="inlinemsg">${icon('circle-alert')}${m}</p>` : ''; };
  document.getElementById('k-go').onclick = async () => { const b = document.getElementById('k-go'); if (b.getAttribute('aria-busy')) return; err('');
    if (DEMO) { toast('The practice copy signs nobody in. In the live app, Continue goes on to choose a password.'); return; }
    b.setAttribute('aria-busy', 'true'); S.linkUsed = true; setRecovery(true);
    try { await DB.verifyLink(LINK_TOKEN); history.replaceState(null, '', location.pathname + location.search); renderRecovery(); }
    catch (x) { S.linkUsed = false; setRecovery(false); b.removeAttribute('aria-busy');
      err(`This link has already been used or has run out. Ask Nate for a new one, or <a href="${esc(location.pathname + location.search)}">sign in</a> if you have a password.`); } };
}
function renderRecovery() {
  document.getElementById('app').innerHTML = `<main id="main" class="sv-login">${loginTop('Choose a new password')}
    <form id="rf" novalidate class="stack16 card sv-lcard">
      <div class="field"><label for="r-pass">New password</label><input id="r-pass" type="password" autocomplete="new-password"><span class="help">At least 8 characters.</span></div>
      <div class="field"><label for="r-pass2">Type it again</label><input id="r-pass2" type="password" autocomplete="new-password"></div>
      <div id="r-err" role="alert"></div>${btn('Save password', { kind: 'primary', full: true, attrs: { type: 'submit' } })}</form>${loginFoot}</main>`;
  const err = m => { document.getElementById('r-err').innerHTML = m ? `<p class="inlinemsg">${icon('circle-alert')}${esc(m)}</p>` : ''; };
  document.getElementById('rf').onsubmit = async e => { e.preventDefault();
    const a = document.getElementById('r-pass').value, b2 = document.getElementById('r-pass2').value;
    if (a.length < 8) return err('Use at least 8 characters.');
    if (a !== b2) return err('Those two passwords do not match.');
    try { await DB.setPassword(a); setRecovery(false); history.replaceState(null, '', location.pathname + location.search); toast('Password updated', { ok: true }); boot(); }
    catch (x) { err(x.message || 'Could not save the password.'); } };
}

// ---- first load ----
async function boot() {
  const app = document.getElementById('app');
  try {
    if (LINK_TOKEN && !S.linkUsed) return renderLink();
    if (!S.session && !DEMO) return renderLogin();
    if (RECOVERY && !DEMO) return renderRecovery();
    if (!DEMO) {   // "since your last visit" baseline (the old app keeps its own since R-199, F7-1)
      const nowT = Date.now(), last = +localStorage.getItem('lastVisit') || 0;
      if (!last) { localStorage.setItem('lastVisit', String(nowT)); localStorage.setItem('prevVisit', String(nowT)); S.sinceVisit = nowT; }
      else if (nowT - last > 30 * 60e3) { localStorage.setItem('prevVisit', String(last)); localStorage.setItem('lastVisit', String(nowT)); S.sinceVisit = last; }
      else S.sinceVisit = +localStorage.getItem('prevVisit') || last;
    }
    app.innerHTML = `<div class="sv-hdr"></div><main>${skeleton(5)}</main>`;
    await DB.loadAll();
    if (DEMO) sandboxExtras();
    if (!S.me) toast('Signed in, but no matching staff record. Ask your admin.', { err: true });
    // Slack and email links use #bill=HB123: they land on the bill page, and Back goes to Today.
    const r = parseRoute();
    if (r.legacy) { history.replaceState({ y: 0 }, '', '#/'); history.pushState({ y: 0 }, '', `#/bill/${r.num}`); }
    else if (r.legacyTo) { history.replaceState({ y: 0 }, '', r.legacyTo); if (r.note) setTimeout(() => toast(decodeURIComponent(r.note)), 300); }
    render();
  } catch (e) {
    console.error(e); reportError('boot', e);
    app.innerHTML = `<main id="main">${empty({ title: 'We could not load the tracker', text: 'Check your connection and try again.', action: btn('Try again', { icon: 'rotate-ccw', attrs: { onclick: 'location.reload()' } }) })}</main>`;
  }
}
// Sandbox only: sign in as a teammate (&as=KV) to see the non-admin and reviewer rules, and two sample action alerts
// (the snapshot has none): one submitted by Kevin waiting for approval, one sent, with its numbers.
function sandboxExtras() {
  const as = new URLSearchParams(location.search).get('as');
  if (as) { const a = S.advocates.find(x => (x.initials || '').toUpperCase() === as.toUpperCase());
    if (a) { S.me = a;
      // Follows are per person: the seeded one is Nate's, so a teammate starts from their own, as live (R-022).
      S.follows = new Set(Object.entries(S.followersBy || {}).filter(([, ids]) => ids.includes(a.id)).map(([id]) => id));
      if (S.buildDemoInbox) S.inbox = S.buildDemoInbox(); } }
  // One hearing this week with no testimony draft, so the card people will meet in January ("No testimony draft yet ... Make the
  // draft now") can be practised: the sandbox gave every hearing its draft (R-152 D). The last such hearing in the next week.
  if (!S.noDraftSeeded && !SESSION_OVER) {
    S.noDraftSeeded = true;
    const t0 = Date.now(), c = S.hearings.filter(h => h.status === 'scheduled' && new Date(h.scheduled_at) - t0 > 2 * 864e5 && new Date(h.scheduled_at) - t0 < 6 * 864e5)
      .map(h => ({ h, b: S.bills.find(x => x.id === h.bill_id) })).filter(x => x.b && x.b.position && x.b.position !== 'monitor' && !diedish(x.b) && draftFor(x.b.id, x.h.committee))
      .sort((x, y) => x.h.scheduled_at.localeCompare(y.h.scheduled_at));
    // The signed-in person's own bill when there is one, so Today's "Mine" shows the card (the sandbox opens as the admin).
    // Not a strongly supported or opposed bill: those also carry the public-ask card, and two cards on one bill hide each other in a short list.
    const own = c.filter(x => !/^strongly_/.test(x.b.position) && (S.assignments[x.b.id] || []).includes(S.me?.id)), pick = own.slice(-1)[0];
    if (pick) { const gone = draftFor(pick.b.id, pick.h.committee); S.drafts[pick.b.id] = (S.drafts[pick.b.id] || []).filter(d => d.id !== gone.id); }
    // And one set far ahead (X10-5): a hearing with no draft is work the day it is set, however far off it is.
    const far = S.hearings.filter(h => h.status === 'scheduled' && new Date(h.scheduled_at) - t0 > 9 * 864e5 && new Date(h.scheduled_at) - t0 < 40 * 864e5)
      .map(h => ({ h, b: S.bills.find(x => x.id === h.bill_id) })).filter(x => x.b && x.b.position && x.b.position !== 'monitor' && !diedish(x.b) && draftFor(x.b.id, x.h.committee) && (!pick || x.b.id !== pick.b.id))
      .sort((x, y) => x.h.scheduled_at.localeCompare(y.h.scheduled_at))[0];
    if (far) { const gone = draftFor(far.b.id, far.h.committee); S.drafts[far.b.id] = (S.drafts[far.b.id] || []).filter(d => d.id !== gone.id); }
  }
  if (!S.alertsSeeded && !SESSION_OVER) {   // between sessions (&season=off) nothing is waiting for approval
    S.alertsSeeded = true;
    const kev = S.advocates.find(x => /^KV$/i.test(x.initials)) || S.advocates.find(x => !x.is_admin);
    const now = Date.now(), alive = b => !['dead', 'law', 'vetoed'].includes(b.stage) && S.hearings.some(h => h.bill_id === b.id && new Date(h.scheduled_at) > now);
    const bill1 = S.bills.find(b => b.is_public && /support/.test(b.position || '') && alive(b)) || S.bills.find(b => b.is_public && /support/.test(b.position || ''));
    // The sample email names the weekday of the bill's real next hearing and of the day testimony closes (it said "Wednesday" and
    // "Tuesday" whatever the hearing was; R-152 D).
    const nextH = bill1 && S.hearings.filter(h => h.bill_id === bill1.id && new Date(h.scheduled_at) > now).sort((x, y) => x.scheduled_at.localeCompare(y.scheduled_at))[0];
    const wd = ms => new Date(ms).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'Pacific/Honolulu' });
    const hearDay = nextH ? wd(new Date(nextH.scheduled_at)) : 'this week', dueDay = nextH ? wd(+new Date(nextH.testimony_deadline || +new Date(nextH.scheduled_at) - 864e5)) : 'the deadline';
    if (kev && bill1) S.alerts = [
      { id: -101, status: 'submitted', author_id: kev.id, bill_id: bill1.id, subject: `Testify on ${bill1.bill_number} this week`, body: `The committee hears ${bill1.bill_number} on ${hearDay}. Can you send testimony? It takes five minutes.`, body_html: `<p>The committee hears ${bill1.bill_number} on ${hearDay}. Can you send testimony? It takes five minutes.</p>`, ask: `Send testimony by ${dueDay}`, created_at: new Date(now - 3 * 36e5).toISOString(), submitted_at: new Date(now - 3 * 36e5).toISOString() },
      { id: -102, status: 'sent', author_id: S.me?.id, bill_id: bill1.id, subject: `Mahalo: ${bill1.bill_number} passed its first committee`, body: 'Thanks to everyone who testified.', body_html: '<p>Thanks to everyone who testified.</p>', created_at: new Date(now - 6 * 864e5).toISOString(), sent_at: new Date(now - 5 * 864e5).toISOString(), recipients: 31, opens: 14, clicks: 5, bounces: 0 },
      ...(S.alerts || [])];
  }
}
DB.init().then(boot).catch(e => { console.error(e); reportError('boot', e); document.getElementById('app').innerHTML = `<main id="main">${empty({ title: 'We could not load the tracker', text: 'Check your connection and try again.' })}</main>`; });
