// HIPHI Staff v6 (R-336, Nate 22-23 Oct: "too much per screen", rebuilt around the jobs; docs/requests/R-336/V6-SPEC.md):
// a copy of Staff v5 at staff6.html. The frame: a labelled sidebar from 768px wide (places, Inbox with its count, Help, Lead
// tools by role, More tools, You at the foot), a laptop header that is only the search box, and on a phone a top bar (Back
// or the mark, the title, Search, the Inbox bell) with the 5-tab bar Today · Hearings · Testimony · Bills · More on every
// route (spec 3.1, 3.2, D2, D11, D12, V02, V03, V21). Every v5 address still opens (spec 3.4, V36).
// Before it, HIPHI Staff v5 (R-277, Nate 13 Oct: "make a staffv5 and implement the 1-21 fixes"): a copy of Staff v4 at staff5.html
// for the ease-of-use review's fixes; v4 stays as it was, to compare. Before that, Staff v3 (R-264, Nate 12 Oct: "make all these changes, but make them on a staff v3 so I can explore and compare"):
// the laptop-first, calmer copy of Staff v2 at staff3.html. The frame differs from v2 in three ways: the sidebar is the five
// main places and nothing else (no sub-items, so it never shifts and carries one count, Today's: B-13, A-14); sections with
// sub-pages show one row of tabs at the top of the page at every width (ui.js sectionNav); and your menu is short.
// v4 (R-269, Nate 12 Oct: "Make all these changes in a staffv4 page"): Outreach opens on this week's asks (asks.js), the
// partner update is its second tab (memo.js, from Bills' "…"), Supporters moves to #/outreach/supporters; each place has
// one way in on a laptop (Help, My settings and Session setup are the sidebar's foot, not also your menu); and the Tasks
// page retires (#/tasks opens Today: its rows are Today's and each bill's To do).
// Original v2 note: the frame and the router (plan section 2). Since 9/21 (R-022) this is the staff app at the tracker's
// own address (index.html and staff.html both load it); the old app lives on at classic.html for a week as the way
// back, then retires. Screens are modules with
// { render(route), wire(route, root), bar?(route), title(route), back?(route), tab, tabs?, wide?, narrow? }.
import { S, DB, DEMO, DEMO_ASOF, LIVE_REFRESH, SESSION_OVER, APP_URL, LINK_ERR, LINK_TOKEN, RECOVERY, setRecovery, hooks, esc, advocate, clearPractice, practiceRestarted, undoStartOver } from './data.js';
import { icon, btn, toast, skeleton, empty, menuSheet, popSheet, sheetOpen, takeSheetEntry, avatar, keysOn } from './ui.js';
import { MARK } from '../pub/art.js';
import { reportError } from './errlog.js';
import { installAskWatch, loadAsks } from './chairask.js';   // R-316 W3
import { exactBill, inboxCount, billRoute, FACTS, draftFor, diedish } from './model.js';
import today, { todayItems } from './today.js';
import review from './review.js';
import inbox from './inbox.js';
import bill from './bill.js';
import bills from './bills.js';
import asks from './asks.js';
import legislators from './legislators.js';
import legislator from './legislator.js';
import search, { headerHits } from './search.js';
import { suggest } from '../pub/suggest.js';
import { keepWordsWhole } from '../pub/ui.js';
import lists from './lists.js';
import issues, { issuePage as issue } from './issues.js';
import myissues from './myissues.js';
import composer from './composer.js';
import help from './help.js';
import hearing from './hearing.js';
import coalition from './coalition.js';
import hearings from './hearings.js';            // v6 places (R-336, spec 3.3); stubs until each place is built
import testimonyplace from './testimonyplace.js';
import team from './team.js';
import people from './people.js';
import tools from './tools.js';
import more, { PLACES, MAIN, BAR, leadKeys, isLead, youName } from './more.js';

keepWordsWhole(document.body);   // "e-cigarettes" never splits at its hyphen on a staff screen either (X9-1, X9-6)

// ---- screens loaded when first opened (R-277 fix 15, E-8) ----
// On slow Capitol wifi the first load took about 8 s because every screen's code came before Today could draw. The
// screens nobody needs on arrival (Session setup, Outreach's supporters, lists and emails, Sort new bills, the partner
// update, My settings, the dev page) now load the first time they are opened: the page shows its loading rows for that
// moment, then draws. `base` is what the frame needs before the code arrives (which tab to light, the title). staff5.html
// preloads the modules the first screen does need, so they come in one round rather than one import level at a time.
function lazy(load, pick, base) {
  let p = null;
  const stub = { ...base, lazy: true, render() { get(); return skeleton(5); } };
  const get = () => p ??= load().then(m => {
    for (const [name, scr] of Object.entries(pick(m))) SCREENS[name] = scr;   // from now on the real screen draws
    if (S.route && SCREENS[S.route.name] && !SCREENS[S.route.name].lazy) render();
  }).catch(e => { p = null; console.error(e); reportError('boot', e); toast('That page did not load. Check your connection and try again.', { err: true }); });
  return [stub, get];
}
const [setup] = lazy(() => import('./setup.js'), m => ({ setup: m.default }), { tab: '', title: () => 'Session setup' });
const [triage] = lazy(() => import('./triage.js'), m => ({ triage: m.default }), { tab: 'bills', tabs: false, title: () => 'Sort new bills' });
const [memo, memoGet] = lazy(() => import('./memo.js'), m => ({ memo: m.default, partners: m.partners }), { tab: 'bills', tabs: false, title: () => 'Partner update' });
const partners = { ...memo, tab: 'outreach', tabs: true, render() { memoGet(); return skeleton(5); } };
const [supporters] = lazy(() => import('./supporters.js'), m => ({ supporters: m.default }), { tab: 'outreach', title: () => 'Supporters' });
const [person] = lazy(() => import('./person.js'), m => ({ person: m.default }), { tab: 'outreach', title: () => 'Supporter' });
const [list] = lazy(() => import('./list.js'), m => ({ list: m.default }), { tab: 'bills', title: () => 'List' });
const [emails] = lazy(() => import('./emails.js'), m => ({ emails: m.default }), { tab: 'outreach', title: () => 'Emails' });
const [me] = lazy(() => import('./me.js'), m => ({ me: m.default }), { tab: '', narrow: true, title: () => 'My settings' });
const [devui] = lazy(() => import('./devui.js'), m => ({ devui: m.default }), { tab: '', title: () => 'Parts' });
// R-328 B: the groups that write on the public tracker (#/partners, where the database's Slack messages link). Its key is
// pgroups: `partners` is Outreach's Partner update tab, whose address (#/outreach/partners) is older.
const [pgroups] = lazy(() => import('./partnergroups.js'), m => ({ pgroups: m.default }), { tab: '', title: () => 'Partners' });

// ---- routes ----
// v6 (R-336, spec 3.3, 3.4): the places Hearings, Testimony, Team, People, More tools and More join the v5 screens. Every v5
// address still opens the same thing (V36): an old one is redirected (replaced, never pushed) to its v6 address, keeping its
// query (#/outreach/issues?view=links opens #/my-issues/all?view=links). tests/staff6_links.py proves it.
const SCREENS = { today, myissues, review, inbox, bill, bills, triage, memo, partners, asks, legislators, legislator, search, supporters, person, issues, issue, lists, list, emails, composer, me, setup, help, devui, hearing, coalition, pgroups,
  hearings, testimony: testimonyplace, team, people, tools, more };
export function parseRoute(h = location.hash) {
  // A "%" that is not part of a code (a stray one in a pasted link) made decodeURIComponent throw, and the page never drew (R-152 D).
  let dh; try { dh = decodeURIComponent(h || ''); } catch { dh = String(h || '').replace(/%(?![0-9a-fA-F]{2})/g, '%25'); try { dh = decodeURIComponent(dh); } catch { dh = '#/'; } }
  let m;
  if ((m = /^#bill=([A-Za-z]+\s?\d+)/.exec(dh))) return { name: 'bill', num: m[1].replace(/\s/g, '').toUpperCase(), tab: 'overview', legacy: true };
  // The old app's other addresses, still written into Slack and calendar links: approvals, and the calendar connect.
  if (/^#emails\b/.test(dh)) return { name: 'review', id: '', q: {}, legacyTo: '#/review' };
  if ((m = /^#calendar=(.*)$/.exec(dh))) return { name: 'me', q: {}, legacyTo: '#/me', note: m[1] };
  const [p, qs] = dh.replace(/^#/, '').split('?'), q = Object.fromEntries(new URLSearchParams(qs || '')), seg = p.split('/').filter(Boolean);
  // An old address's new home, with the same query (less what the move itself answered).
  const to = (path, drop = []) => { const u = new URLSearchParams(qs || ''); drop.forEach(k => u.delete(k)); const s = u.toString(); return path + (s ? '?' + s : ''); };
  switch (seg[0]) {
    case undefined:
      // v5's Today | This week and Mine | Team switches: This week is Hearings, Team is Team (spec 6, Today; 3.4).
      if (q.view === 'week') return { name: 'hearings', view: '', q: {}, redirect: '#/hearings' };
      if (q.scope === 'team') return { name: 'team', who: '', q: {}, redirect: '#/team', leads: true };
      return { name: 'today', q };
    case 'tasks': return { name: 'today', q: {}, redirect: '#/' };   // v4 (R-269): retired; an old link opens Today
    case 'hearings': return { name: 'hearings', view: seg[1] === 'ask' ? 'ask' : seg[1] === 'week' ? 'week' : (q.view || ''), q };
    case 'hearing': return { name: 'hearing', id: seg[1] || '', q };
    case 'testimony': return { name: 'testimony', view: q.view || '', q };
    case 'review': return { name: 'review', id: seg[1] || '', q };
    case 'inbox': return { name: 'inbox', view: q.view || '', q };
    // My issues (R-263) with its tabs Coalitions and All issues (spec 3.3): v5's #/coalition and #/outreach/issues move here.
    case 'my-issues': return seg[1] === 'coalitions' ? { name: 'coalition', id: '', q } : seg[1] === 'all' ? { name: 'issues', q } : { name: 'myissues', q };
    case 'coalition': return seg[1] ? { name: 'coalition', id: seg[1], q } : { name: 'coalition', id: '', q, redirect: to('#/my-issues/coalitions') };
    case 'issue': return { name: 'issue', id: seg[1] || '', q };
    case 'bills': return seg[1] === 'new' ? { name: 'triage', q } : seg[1] === 'memo' ? { name: 'partners', q, redirect: to('#/outreach/partners') } : { name: 'bills', muted: seg[1] === 'muted', q };
    // #/bill/HB2121 is the current session's bill; an earlier session's is #/bill/2026/HB2121 (R-152 B, as the public page since R-110).
    // v6 tabs: Next step (the bare address) · Team talk (/talk) · Public. v5's /overview and /activity redirect; /talk reaches
    // bill.js as tab 'activity', the name its code knows, until the BILL builder renames it (route.view says 'talk').
    case 'bill': {
      const yr = /^\d{4}$/.test(seg[1] || ''), num = String(seg[yr ? 2 : 1] || '').toUpperCase(), t = seg[yr ? 3 : 2] || '', base = `#/bill/${yr ? seg[1] + '/' : ''}${num}`;
      if (t === 'overview') return { name: 'bill', year: yr ? seg[1] : '', num, tab: 'overview', q, redirect: to(base) };
      if (t === 'activity') return { name: 'bill', year: yr ? seg[1] : '', num, tab: 'activity', q, redirect: to(base + '/talk') };
      return { name: 'bill', year: yr ? seg[1] : '', num, tab: t === 'talk' ? 'activity' : (t || 'overview'), view: t, q };
    }
    case 'legislators': return { name: 'legislators', view: q.view || '', q };
    case 'legislator': return { name: 'legislator', id: +seg[1] || 0, from: q.from || '', q };
    // v4 (R-269): #/outreach is This week's asks; Supporters is #/outreach/supporters (an older #/outreach?segment= link opens
    // Supporters on that segment, now at its own address).
    case 'outreach':
      if (seg[1] === 'issues') return { name: 'issues', q, redirect: to('#/my-issues/all') };
      if (!seg[1] && q.segment) return { name: 'supporters', q, redirect: to('#/outreach/supporters') };
      return seg[1] === 'lists' ? { name: 'lists', q } : seg[1] === 'emails' ? { name: 'emails', q } : seg[1] === 'supporters' ? { name: 'supporters', q } : seg[1] === 'partners' ? { name: 'partners', q } : { name: 'asks', q };
    case 'person': return { name: 'person', id: seg[1] || '', q };
    case 'list': return { name: 'list', id: seg[1] || '', q };
    case 'email': return seg[1] === 'new' ? { name: 'composer', id: '', q } : { name: 'composer', id: seg[1] || '', q };
    case 'search': return { name: 'search', q };
    case 'me': return { name: 'me', q };
    case 'team': return { name: 'team', who: q.who || '', q };
    case 'people': return { name: 'people', id: seg[1] || '', q };
    case 'setup': return seg[1] === 'people' ? { name: 'people', id: '', q, redirect: '#/people' } : { name: 'setup', section: seg[1] || '', q };
    case 'help': return { name: 'help', topic: seg[1] || '', q };
    case 'tools': return { name: 'tools', q };
    case 'more': return { name: 'more', q };
    case 'dev': return { name: 'devui', q };
    case 'partners': return seg[1] === 'request' ? { name: 'pgroups', id: '', req: seg[2] || '', q } : { name: 'pgroups', id: seg[1] || '', req: '', q };   // R-328 B
    default: return { name: 'today', q };
  }
}
// Which place a screen belongs to (spec 3.3): it lights that place in the sidebar and the phone bar, whatever the screen's
// own v5 `tab` says (Review is Testimony's now, a sitting Hearings', Lists Outreach's).
const PLACE_OF = { today: 'today', hearings: 'hearings', hearing: 'hearings', testimony: 'testimony', review: 'testimony', outreach: 'outreach', asks: 'outreach', partners: 'outreach', memo: 'outreach',
  emails: 'outreach', composer: 'outreach', supporters: 'outreach', person: 'outreach', lists: 'outreach', list: 'outreach', bills: 'bills', triage: 'bills', bill: 'bills',
  legislators: 'legislators', legislator: 'legislators', myissues: 'myissues', issues: 'myissues', issue: 'myissues', coalition: 'myissues', inbox: 'inbox', help: 'help',
  team: 'team', people: 'people', pgroups: 'partners', setup: 'setup', tools: 'tools', devui: 'tools', more: 'more', me: 'you', search: '' };
const placeOf = route => !route ? '' : route.name === 'bill' && S.billFrom ? S.billFrom : PLACE_OF[route.name] ?? '';
// The phone bar lights More for every place that is not one of its five.
const barOf = k => BAR.includes(k) ? k : k ? 'more' : '';

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
  panelAt = null;
  render(); S.scrollClaimed = false;   // go() puts the page at the top itself; a page's own later scroll still runs
  if (!keepScroll) window.scrollTo(0, 0);
}
S.go = go;
// ---- Back closes a side panel (R-277 fix 5, U-2, E-4) ----
// Opening a side panel beside a list (Today's open item, the bill docked beside Bills' table) is a step of its own, so
// Back (the browser's, or a phone's back gesture) closes the panel and leaves the list as it was: its filters, its
// scroll and its focus. It used to leave the page. A screen calls panelOpened(close) when someone opens a panel: the
// first one pushes a history entry on the same address; `close` is how the screen closes it in place. The screen's own
// close X calls panelClosed(), which takes that entry back, so Back after it leaves the page as before.
let panelAt = null, panelClose = null, panelSkip = false;   // the address whose entry is a panel's, and its closer
export function panelOpened(close) {
  panelClose = close;
  if (panelAt === location.hash && history.state?.panel) return;
  try { history.replaceState({ ...(history.state || {}), y: window.scrollY }, ''); history.pushState({ ...(history.state || {}), panel: 1, y: window.scrollY }, ''); panelAt = location.hash; } catch { /* ignore */ }
}
export function panelClosed() {
  panelClose = null;
  if (panelAt === location.hash && history.state?.panel) { panelAt = null; panelSkip = true; history.back(); }
}
S.panelOpened = panelOpened; S.panelClosed = panelClosed;
window.addEventListener('popstate', e => {
  if (popSheet()) return;                      // Back closed a sheet: the page underneath stays as it is
  if (panelSkip) { panelSkip = false; return; }   // the screen's own X closed the panel and took its entry back
  // Back from a panel's entry to the same address: close the panel in place; the list does not move.
  if (panelAt && panelAt === location.hash && !e.state?.panel) { panelAt = null; const c = panelClose; panelClose = null; if (c) { try { c(); } catch (x) { console.error(x); render(); } return; } }
  // Forward (or Back from a bill page) onto a panel's entry: the screen draws its panel open again, as it was left.
  panelAt = e.state?.panel ? location.hash : null;
  depth = e.state?.d || 0;
  render(); const y = e.state?.y || 0;
  // A page that scrolls to something itself (Today's "Write it" lands at the ask box, X10-3) claims the scroll with S.scrollClaimed; this restore, queued after it, would put the page back at the top.
  requestAnimationFrame(() => { if (S.scrollClaimed) { S.scrollClaimed = false; return; } window.scrollTo(0, y); });
});
try { history.scrollRestoration = 'manual'; } catch { /* ignore */ }
// R-277 fix 8 (E-9): "You're offline" while the browser has no connection, gone when it is back. Nothing said so, and a
// change made meanwhile failed with a message that vanished. It sits with the messages at the foot of the page (#toast,
// outside the redrawn page, so a redraw never takes it away) and stays until the connection returns.
function offlineLine() {
  const box = document.getElementById('toast'); if (!box) return;
  let el = document.getElementById('sv-offline');
  if (navigator.onLine === false) {
    if (el) return;
    el = document.createElement('p'); el.id = 'sv-offline'; el.className = 'sv-offline'; el.setAttribute('role', 'status');
    el.innerHTML = `${icon('circle-alert')}<span>You’re offline. What you change will not save until the connection is back.</span>`;
    box.prepend(el);
  } else if (el) { el.remove(); toast('Back online.', { ok: true }); }
}
addEventListener('offline', offlineLine); addEventListener('online', offlineLine); offlineLine();
// Crossing a layout width (a rotated tablet, a resized window) redraws the page, so screens that draw differently for
// desktop are never left in the wrong shape.
for (const q of ['(min-width: 768px)', '(min-width: 900px)', '(min-width: 1100px)']) { try { matchMedia(q).addEventListener('change', () => { if (S.route && !document.querySelector('dialog[open]')) render(); }); } catch { /* old browsers */ } }

// ---- the frame (spec 3.1, 3.2) ----
// Today's count is "needs you today" only (today.js badge); when something is overdue it says so in words (D3).
export function badge() { try { return (today.badge && today.badge()) || { n: 0, late: false }; } catch { return { n: 0, late: false }; } }
function lateCount(bd) {
  if (!bd.late) return 0;
  if (Number.isFinite(bd.lateN)) return bd.lateN;   // today.js may hand it over itself
  try { return todayItems('mine').late || 1; } catch { return 1; }
}
const countWords = (bd, lateN) => `${bd.n} need${bd.n === 1 ? 's' : ''} you today${lateN ? `, ${lateN} overdue` : ''}`;
// The header. A phone: Back (deeper than a place) or the mark, the page's title, Search and the Inbox bell with a dot. A laptop
// or tablet (768px and wider): only the search box, which Cmd/Ctrl-K or "/" focuses (V32); the sidebar holds the rest.
function header(route, scr) {
  const b = scr.back ? scr.back(route) : null, title = scr.title ? scr.title(route) : '';
  let unread = 0; try { unread = inboxCount(); } catch { unread = 0; }
  // A long label shortens to "Back" on a phone, unless the screen marks it full (the issue page's "Back to SB2175" fits).
  const short = !!b && b.label.length > 12 && !b.full;
  const mac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '');
  return `<header class="sv-hdr">
    ${b ? `<a class="sv-back phone" href="${esc(b.href)}" data-back${short ? ` aria-label="${esc(/^Back\b/.test(b.label) ? b.label : 'Back to ' + b.label)}"` : ''}>${icon('chevron-left')}<span>${esc(short ? 'Back' : b.label)}</span></a>`
      : `<a class="sv-brand" href="#/" aria-label="Bill Tracker, Today">${MARK}</a>`}
    <span class="sv-title" aria-hidden="true">${esc(title)}</span>
    <form class="sv-search" role="search" data-hsearch><label class="sr" for="hq">Search bills, legislators, people and places</label>${icon('search')}<input id="hq" type="search" placeholder="Search bills, legislators, people" autocomplete="off" aria-keyshortcuts="${mac ? 'Meta+K' : 'Control+K'} /"><span class="sv-kbd" aria-hidden="true">${mac ? '⌘K' : 'Ctrl K'}</span></form>
    <a class="iconbtn sv-srchbtn" href="#/search" aria-label="Search">${icon('search')}</a>
    <a class="iconbtn sv-bell" href="#/inbox" aria-label="Inbox${unread ? `, ${unread} unread` : ''}">${icon('bell')}${unread ? '<span class="sv-dot" aria-hidden="true"></span>' : ''}</a>
  </header>`;
}
// The sidebar (768px and wider): every place, labelled, in the same order for everyone (V02, V18, D11, D12). Exactly two
// counts, Today's and the Inbox's. Lead tools appear, under their heading, only for people who have one. More tools and You
// stay at the foot, in view on a short laptop screen (the places scroll above them if they must); You opens the account
// menu (the header's initials menu is gone). Collapse is opt-in and keeps short labels.
function sideItem(k, now, extra = '') {
  const [href, ic, label, shortL] = PLACES[k];
  return `<a class="sv-sitem" href="${href}"${now === k ? ' aria-current="page"' : ''}>${icon(ic)}<span class="lbl">${label}</span><span class="lbs" aria-hidden="true">${shortL}</span>${extra}</a>`;
}
function sidebar(route) {
  const now = placeOf(route), bd = badge(), lateN = lateCount(bd), leads = leadKeys(), narrow = sideNarrow();
  let unread = 0; try { unread = inboxCount(); } catch { unread = 0; }
  const todayN = bd.n ? (lateN ? `<span class="sv-sn bad" aria-label="${esc(countWords(bd, lateN))}">${icon('circle-alert')}<span class="sn-n">${lateN}</span><span class="sn-w"> overdue</span></span>`
    : `<span class="sv-sn" aria-label="${esc(countWords(bd, 0))}">${bd.n > 99 ? '99+' : bd.n}</span>`) : '';
  const inboxN = unread ? `<span class="sv-sn" aria-label="${unread} unread">${unread > 99 ? '99+' : unread}</span>` : '';
  return `<aside class="sv-side" aria-label="Places">
    <a class="sv-sbrand" href="#/" aria-label="Bill Tracker, Today">${MARK}<span>Bill Tracker<small>HIPHI staff</small></span></a>
    <nav class="sv-snav" aria-label="Places">
      <div class="sv-sgrp">${MAIN.map(k => sideItem(k, now, k === 'today' ? todayN : '')).join('')}</div>
      <div class="sv-sgrp">${sideItem('inbox', now, inboxN)}${sideItem('help', now)}</div>
      ${leads.length ? `<div class="sv-sgrp" role="group" aria-labelledby="sv-leadh"><p class="sv-shd" id="sv-leadh">Lead tools</p>${leads.map(k => sideItem(k, now)).join('')}</div>` : ''}
    </nav>
    <div class="sv-sfoot">${sideItem('tools', now)}${syncLine()}
      <div class="sv-you"><button type="button" class="sv-sitem sv-youbtn" data-you aria-haspopup="menu"${now === 'you' ? ' aria-current="page"' : ''}>${avatar(S.me, 28)}<span class="lbl">You · ${esc(youName())}</span><span class="lbs" aria-hidden="true">You</span></button>
        <button type="button" class="sv-scollapse" data-sidecol aria-pressed="${narrow}" aria-label="${narrow ? 'Widen the sidebar' : 'Narrow the sidebar'}" title="${narrow ? 'Widen the sidebar' : 'Narrow the sidebar'}">${icon(narrow ? 'panel-left-open' : 'panel-left-close')}</button></div>
    </div>
  </aside>`;
}
// Collapsing the sidebar is about this screen, not about the person, so it stays in this browser rather than
// following them to their phone (where there is no sidebar at all).
export const sideNarrow = () => { try { return localStorage.getItem('sv_side') === 'narrow'; } catch { return false; } };
const setSideNarrow = on => { try { on ? localStorage.setItem('sv_side', 'narrow') : localStorage.removeItem('sv_side'); } catch { /* private window: this visit only */ } };
// How fresh the Capitol data is (F9). v6 says it in the sidebar only when it is 12 hours old or more (status by exception,
// D3); the More page always says it, and the practice band carries the practice date.
function syncLine() {
  if (DEMO) return '';
  const last = (S.syncRuns || []).find(r => r.ok)?.finished_at; if (!last) return '';
  const h = Math.floor((Date.now() - new Date(last).getTime()) / 36e5); if (h < 12) return '';
  return `<p class="sv-sync" role="status">${icon('circle-alert')}<span>Capitol data synced ${h < 48 ? `${h} hours ago` : `${Math.floor(h / 24)} days ago`}</span></p>`;
}
// The phone bar (below 768px): Today · Hearings · Testimony · Bills · More, on every route (D2, V21). One word each.
function tabbar(route) {
  const now = barOf(placeOf(route)), bd = badge(), lateN = lateCount(bd);
  return `<nav class="sv-tabs" aria-label="Places">${BAR.map(k => { const [href, ic, label] = PLACES[k];
    const n = k === 'today' && bd.n ? `<span class="sv-badge${lateN ? ' bad' : ''}" aria-label="${esc(countWords(bd, lateN))}">${bd.n > 99 ? '99+' : bd.n}</span>` : '';
    return `<a href="${href}"${now === k ? ' aria-current="page"' : ''}><span class="pill">${icon(ic, { size: 24 })}</span>${label}${n}</a>`; }).join('')}</nav>`;
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
// R-316 W43 (C-5): between those reloads, a light look about every 2 minutes while the page is in view, and at once when
// it comes back into view: only the drafts and to-dos changed since the last look (DB.pollChanges, two small reads; most
// come back empty), never the whole loadAll. A teammate's approval then shows within about 2 minutes instead of after a
// Refresh. Redrawn only when something changed and nothing is being typed or open (as above). Gated: LIVE_REFRESH.
const LOOK_MS = 2 * 60e3;
let looking = false;
async function lookAgain() {
  if (!LIVE_REFRESH() || DEMO || !S.session || refreshing || looking || document.visibilityState !== 'visible') return;
  looking = true;
  try { if (await DB.pollChanges()) { FACTS.clear(); if (!busyTyping()) render(); } }
  catch (e) { console.warn('look for changes:', e?.message || e); }   // a missed look is retried in 2 minutes; nothing to say
  finally { looking = false; }
}
setInterval(lookAgain, LOOK_MS);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') { hiddenAt = Date.now(); return; }
  if (hiddenAt && Date.now() - hiddenAt >= STALE_MS && S.session) refreshData();
  else if (hiddenAt) lookAgain();
  hiddenAt = 0;
});
let lastKey = '';
export function render() {
  if (LINK_TOKEN && !S.linkUsed) return renderLink();
  if (!S.session && !DEMO) return renderLogin();
  if (RECOVERY && !DEMO) return renderRecovery();
  const route = parseRoute();
  // v5's #/?scope=team is Team for leads and Today for everyone else (spec 3.4).
  if (route.leads && !isLead()) route.redirect = '#/';
  // The old app's forms (#bill=, #emails, #calendar=) met after the first load (a link opened in the same tab): the same
  // place as boot() gives them.
  if (route.legacy) route.redirect = `#/bill/${route.num}`;
  else if (route.legacyTo) { route.redirect = route.legacyTo; if (route.note) setTimeout(() => toast(route.note), 300); }
  // A retired address (v4: #/tasks) is replaced, not pushed, so Back never lands on it again.
  if (route.redirect) { try { history.replaceState(history.state, '', route.redirect); } catch { /* ignore */ } return render(); }
  // R-277 ui-critic: a bill opened from Today (or My issues, Outreach...) keeps that place lit in the tab bar and sidebar,
  // so a phone does not jump to Bills under you; a bill opened from nowhere (a link) lights Bills.
  if (route.name === 'bill' && S.route?.name !== 'bill') { const pt = placeOf(S.route); S.billFrom = pt && pt !== 'more' ? pt : null; }
  S.route = route;
  const scr = SCREENS[route.name] || today;
  let main, bar = '';
  try { main = loadNotice() + scr.render(route); bar = scr.bar ? scr.bar(route) : ''; } catch (e) { console.error(e); reportError('render', e); main = empty({ title: 'Something went wrong on this page', text: 'Try again, or go back to Today.', action: btn('Back to Today', { href: '#/' }) }); }
  // Every page names itself (spec 3.1): a screen without its own h1 gets the frame's, at the top of the work column.
  const title = scr.title ? scr.title(route) : '';
  if (!/<h1[\s>]/i.test(main || '') && title) main = `<h1 class="v6-ptitle">${esc(title)}</h1>` + main;
  const cls = document.body.classList;
  // v6: the phone bar shows on every route (V21), so `withtabs` always; a screen's v5 `tabs: false` no longer hides it.
  cls.add('staff2', 'staff6'); cls.toggle('sidenarrow', sideNarrow()); cls.remove('notabs'); cls.add('withtabs'); cls.toggle('hasbar', !!bar); cls.toggle('wide', !!(scr.wide && scr.wide(route)));
  document.body.dataset.screen = route.name;
  document.body.dataset.place = placeOf(route) || 'none';
  // Desktop widths: a screen is 1120px by default; `wide` (tables) uses the whole window; `narrow` (one focused task
  // or a form: review, settings) stays a 760px reading column.
  document.body.toggleAttribute('data-narrow', !!(typeof scr.narrow === 'function' ? scr.narrow(route) : scr.narrow));
  const app = document.getElementById('app');
  // The action bar lives inside <main>, as its last child: fixed above the phone bar, and on a wide screen it sits right
  // under the content it acts on (staff.css), never a screen-height away from it.
  // The practice copy's band (warm dark, V33): the date and who you practise as; the switch is in the You menu (A-6: no
  // control inside a 28px band).
  const band = DEMO ? `<div class="band"><span class="band-hint"><b>Staff v6</b> · Practice copy · </span>${new Date(DEMO_ASOF).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Pacific/Honolulu' })} · as ${esc((S.me?.full_name || '').split(' ')[0])} · practice only<span class="band-hint"> · your changes stay in this tab · switch person or start over under You</span></div>` : '';
  const navTop = document.querySelector('.sv-snav')?.scrollTop || 0;   // a redraw keeps the sidebar where it was scrolled
  app.innerHTML = `<button type="button" class="skip" data-skip>Skip to content</button>${band}${sidebar(route)}<div class="sv-page">${header(route, scr)}<main id="main" tabindex="-1">${main}${bar ? `<div class="actionbar"><div class="inner">${bar}</div></div>` : ''}</main></div>${tabbar(route)}`;
  // One heading a screen reader can find, on every screen at every width. Phones hide a page's own h1 (the top bar shows
  // the title): where the page's h1 is not drawn, the top bar's title is the heading.
  // From 768px there is no top bar: a screen that hides its own h1 below 900px (its phone layout, made when the header carried
  // the title) gets the frame's title in its place, so the page still names itself.
  const ft = app.querySelector('.sv-hdr .sv-title'), mainEl = app.querySelector('main');
  let shown = [...app.querySelectorAll('main h1')].find(h => h.getClientRects().length > 0);   // drawn (a hidden parent hides it too)
  if (!shown && title && mainEl && matchMedia('(min-width: 768px)').matches) { mainEl.insertAdjacentHTML('afterbegin', `<h1 class="v6-ptitle">${esc(title)}</h1>`); shown = mainEl.firstElementChild; }
  if (ft && !shown) { ft.removeAttribute('aria-hidden'); ft.setAttribute('role', 'heading'); ft.setAttribute('aria-level', '1'); }
  try { clearTimeout(window.__bootT); } catch { /* ignore */ }
  document.title = (title ? title + ' · ' : '') + 'Bill Tracker staff';
  try { scr.wire && scr.wire(route, app); } catch (e) { console.error(e); reportError('error', e); }
  wireFrame(app);
  const nav = app.querySelector('.sv-snav'); if (nav && navTop) nav.scrollTop = navTop;
  hdrShadow(); tabRows(app);
  if (location.hash !== lastKey) { lastKey = location.hash; if (!app.contains(document.activeElement) || document.activeElement === document.body) app.querySelector('main')?.focus({ preventScroll: true }); }
}
hooks.render = () => render();
hooks.afterLoad = () => { FACTS.clear(); loadAsks(); };   // the derived facts are rebuilt from the new rows (R-152 B); R-316 W3's chair asks
installAskWatch();
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
  // You (the sidebar's foot, the More page's last row): the account menu.
  app.querySelectorAll('[data-you]').forEach(el => el.addEventListener('click', accountMenu));
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
    suggest(f.querySelector('input'), { source: headerHits, open: go, when: () => S.route?.name !== 'search', label: 'Suggested places, bills, issues, legislators and supporters',   // R-277 fix 19: places first
      busy: 'Looking through every bill', empty: q => `No place, bill, issue, legislator or supporter matches “${q}”.`,
      seeAll: (q, hits) => ({ href: '#/search?q=' + encodeURIComponent(q), label: hits ? `See all results for “${q}”` : `Look for “${q}” in sponsors, owners and committees` }) }); }
}
// A place's page tabs that run past a phone's width scroll sideways: the open tab is brought into view, and the row fades at
// the edge that has more (B-9: a hidden scrollbar is the only other cue).
function tabRows(app) {
  app.querySelectorAll('.sv-tabrow').forEach(r => {
    const over = r.scrollWidth > r.clientWidth + 1; r.classList.toggle('ovf', over); if (!over) return;
    const c = r.querySelector('[aria-current="page"], [aria-pressed="true"]');
    if (c && !r.dataset.placed) { r.scrollLeft = Math.max(0, c.offsetLeft - (r.clientWidth - c.offsetWidth) / 2); r.dataset.placed = '1'; }
    const ends = () => { r.classList.toggle('atstart', r.scrollLeft <= 2); r.classList.toggle('atend', r.scrollLeft + r.clientWidth >= r.scrollWidth - 2); };
    ends(); if (!r.dataset.w) { r.dataset.w = '1'; r.addEventListener('scroll', ends, { passive: true }); }
  });
  // The sidebar's places, when a short window makes them scroll above the foot: the cut edge fades, so more is seen to be there.
  const nav = app.querySelector('.sv-snav');
  if (nav) { const ends = () => { const over = nav.scrollHeight > nav.clientHeight + 1; nav.classList.toggle('ovf', over); nav.classList.toggle('atend', !over || nav.scrollTop + nav.clientHeight >= nav.scrollHeight - 2); };
    ends(); if (!nav.dataset.w) { nav.dataset.w = '1'; nav.addEventListener('scroll', ends, { passive: true }); } }
}
addEventListener('resize', () => { const app = document.getElementById('app'); if (app && S.route) tabRows(app); }, { passive: true });
// No rule under the header (V16): a soft shadow shows only once the page has scrolled under it.
function hdrShadow() { const h = document.querySelector('.sv-hdr'); if (h) h.classList.toggle('scrolled', window.scrollY > 4); }
addEventListener('scroll', () => { if (!hdrShadow.raf) hdrShadow.raf = requestAnimationFrame(() => { hdrShadow.raf = 0; hdrShadow(); }); }, { passive: true });
function practiseAs() {
  menuSheet({ title: 'Practice as', items: S.advocates.filter(a => a.is_active !== false).map(a => ({
    label: a.full_name + (a.id === S.me?.id ? ' (now)' : ''), icon: 'user-round', sub: a.is_admin ? 'Admin: approves, sets up the session' : a.can_approve ? 'Approver: testimony and supporter emails' : a.is_reviewer ? 'Second approver' : (billsOwned(a.id) ? `${billsOwned(a.id)} bills` : 'No bills of their own'),
    run: () => { const u = new URL(location.href); u.searchParams.set('as', a.initials); location.href = u.toString(); } })) });
}
const billsOwned = id => S.bills.filter(b => (S.assignments[b.id] || []).includes(id)).length;
// You: the account menu (spec 3.1, V03). It holds only the person's own things: My settings, Refresh, Sign out, and in the
// practice copy who to practise as and Start over. Inbox and Help have their own doors in the sidebar and on More; the
// version-compare links moved to More tools (admins). The phone's More page lists the same items as rows (more.js), so
// My settings is two labelled taps there too.
function accountItems() {
  return [
    { label: 'My settings', icon: 'settings', sub: 'How the tracker reaches you', run: () => go('#/me') },
    DEMO ? { label: 'Practice as someone else', icon: 'users-round', sub: 'See the app as a teammate sees it, with your changes', run: () => setTimeout(practiseAs, 50) } : null,
    { label: 'Refresh', icon: 'refresh-cw', sub: 'Read what your teammates changed since this page loaded', run: () => setTimeout(() => refreshData({ say: true }), 50) },
    // R-316 W38: the changes made in this tab go with a person switch, so two people can be tried in turn; this puts the day
    // back, with Undo in the toast after the reload.
    DEMO ? { label: 'Start the practice over', icon: 'rotate-ccw', sub: 'Undoes every change kept in this tab, whoever you practised as', run: () => { clearPractice(); location.reload(); } } : null,
    DEMO ? null : { label: 'Sign out', icon: 'log-out', run: async () => { await DB.logout(); } },
  ].filter(Boolean);
}
function accountMenu() { menuSheet({ title: S.me?.full_name || 'You', items: accountItems() }); }
S.accountMenu = accountMenu; S.accountItems = accountItems;   // more.js lists the same items as rows

// ---- keyboard: desktop only (Help lists these; never shown on touch screens) ----
// v6 (V32): Cmd/Ctrl-K, from anywhere, puts the cursor in the header's search box (on a phone, the Search page); "/" does the
// same outside a text box (a page's own find box first, while one is on screen). g then a letter goes to a place: t Today,
// h Hearings, w Testimony (write), b Bills, l Legislators, o Outreach, m My issues, r Review, i Inbox.
let gPending = 0;
const focusSearch = () => { const q = document.getElementById('hq'); if (q && q.offsetParent && getComputedStyle(q).visibility !== 'hidden') { q.focus(); q.select?.(); } else go('#/search'); };
document.addEventListener('keydown', e => {
  if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && (e.key === 'k' || e.key === 'K')) {
    if (document.querySelector('dialog[open]') || !S.route) return;
    e.preventDefault(); focusSearch(); return;
  }
  const t = e.target, typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
  if (typing || e.metaKey || e.ctrlKey || e.altKey || document.querySelector('dialog[open]') || !keysOn()) return;
  if (e.key === '?') { e.preventDefault(); go('#/help/keys'); return; }
  if (e.key === '/') { e.preventDefault(); const own = document.querySelector('main .bl-search input'); if (own && own.offsetParent) own.focus(); else focusSearch(); return; }
  if (e.key === 'g') { gPending = Date.now(); return; }
  if (gPending && Date.now() - gPending < 1200) { gPending = 0; const to = { t: '#/', h: '#/hearings', w: '#/testimony', m: '#/my-issues', b: '#/bills', l: '#/legislators', o: '#/outreach', r: '#/review', i: '#/inbox' }[e.key]; if (to) { e.preventDefault(); go(to); } }
});

// ---- sign in and a new password (same calls as the current app) ----
// Both pages say whose tracker this is and point anyone from the public to their own page: the main address is this
// app, so a resident who types it lands here (X9-2, C-11, B-3). staff.css centres them across the whole window; on a
// laptop they used to land in the 248px side column of the signed-in frame's grid.
const LOGIN_NAME = 'HIPHI Bill Tracker · for the HIPHI team';
const loginTop = h1 => { document.body.classList.add('staff2', 'staff6', 'notabs'); document.title = `${h1} · ${LOGIN_NAME}`;
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
  // R-316 W7 (L-12): someone arriving by their invite link is choosing a password for the first time.
  document.getElementById('app').innerHTML = `<main id="main" class="sv-login">${loginTop(S.linkUsed ? 'Choose your password' : 'Choose a new password')}
    <form id="rf" novalidate class="stack16 card sv-lcard">
      <div class="field"><label for="r-pass">New password</label><input id="r-pass" type="password" autocomplete="new-password"><span class="help">At least 8 characters.</span></div>
      <div class="field"><label for="r-pass2">Type it again</label><input id="r-pass2" type="password" autocomplete="new-password"></div>
      <div id="r-err" role="alert"></div>${btn('Save password', { kind: 'primary', full: true, attrs: { type: 'submit' } })}</form>${loginFoot}</main>`;
  const err = m => { document.getElementById('r-err').innerHTML = m ? `<p class="inlinemsg">${icon('circle-alert')}${esc(m)}</p>` : ''; };
  document.getElementById('rf').onsubmit = async e => { e.preventDefault();
    const a = document.getElementById('r-pass').value, b2 = document.getElementById('r-pass2').value;
    if (a.length < 8) return err('Use at least 8 characters.');
    if (a !== b2) return err('Those two passwords do not match.');
    try { await DB.setPassword(a); setRecovery(false); history.replaceState(null, '', location.pathname + location.search);
      // R-316 W7 (L-12): a first sign-in opens on Today with Getting started open, and says hello by name.
      const first = S.linkUsed; if (first) S.tdStartOpen = true;
      await boot();
      toast(first && S.me ? `Welcome, ${S.me.full_name.split(' ')[0]}. Start here: Getting started is on Today.` : 'Password updated', { ok: true }); }
    catch (x) { err(x.message || 'Could not save the password.'); } };
}

// ---- first load ----
// Loading and a failed load are first impressions too (spec 4): the warm page, the mark, one calm line, no frame yet.
const markBrand = () => `<p class="sv-lbrand">${MARK.replace('class="mark"', 'class="mark mk"')}<span><b>HIPHI Bill Tracker</b><span class="sv-lfor">for the HIPHI team</span></span></p>`;
const loadingScreen = () => { document.body.classList.add('staff2', 'staff6', 'notabs'); return `<main id="main" class="sv-load" aria-busy="true">${markBrand()}<p class="sv-lsay" role="status">Getting your day ready…</p>${skeleton(3)}</main>`; };
const failScreen = () => { document.body.classList.add('staff2', 'staff6', 'notabs'); return `<main id="main" class="sv-load sv-fail">${markBrand()}${empty({ title: 'We could not load the tracker', h: 'h1', text: 'Check your connection and try again.', action: btn('Try again', { kind: 'primary', icon: 'rotate-ccw', attrs: { onclick: 'location.reload()' } }) })}</main>`; };
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
    app.innerHTML = loadingScreen();
    await DB.loadAll();
    if (DEMO) sandboxExtras();
    if (DEMO && practiceRestarted()) setTimeout(() => toast('Practice started over: the changes made in this tab are gone.', { undo: () => { undoStartOver(); location.reload(); } }), 800);
    if (!S.me) toast('Signed in, but no matching staff record. Ask your admin.', { err: true });
    // Slack and email links use #bill=HB123: they land on the bill page, and Back goes to Today.
    const r = parseRoute();
    if (r.legacy) { history.replaceState({ y: 0 }, '', '#/'); history.pushState({ y: 0 }, '', `#/bill/${r.num}`); }
    else if (r.legacyTo) { history.replaceState({ y: 0 }, '', r.legacyTo); if (r.note) setTimeout(() => toast(decodeURIComponent(r.note)), 300); }
    render();
  } catch (e) {
    console.error(e); reportError('boot', e);
    app.innerHTML = failScreen();
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
      if (S.buildDemoInbox) S.inbox = S.buildDemoInbox();
      // Between sessions, someone who owns no issue (Patti, Julie) helps on two, so a helper's prep on Today can be seen (R-316 W4).
      if (SESSION_OVER && !S.issues.some(i => i.owner_id === a.id)) S.issueHelpers = S.issues.filter(i => i.owner_id && !i.archived_at).sort((x, y) => x.name.localeCompare(y.name)).slice(0, 2)
        .map(i => ({ issue_id: i.id, advocate_id: a.id, added_by: i.owner_id, added_at: '2026-10-01T00:00:00Z' })); } }
  // One hearing this week with no testimony draft, so the card people will meet in January ("No testimony draft yet ... Make the
  // draft now") can be practised: the sandbox gave every hearing its draft (R-152 D). The last such hearing in the next week.
  if (!S.noDraftSeeded && !SESSION_OVER) {
    S.noDraftSeeded = true;
    const t0 = Date.now(), c = S.hearings.filter(h => h.status === 'scheduled' && new Date(h.scheduled_at) - t0 > 2 * 864e5 && new Date(h.scheduled_at) - t0 < 6 * 864e5)
      .map(h => ({ h, b: S.bills.find(x => x.id === h.bill_id) })).filter(x => x.b && x.b.position && x.b.position !== 'monitor' && !diedish(x.b) && draftFor(x.b.id, x.h.committee))
      .sort((x, y) => x.h.scheduled_at.localeCompare(y.h.scheduled_at));
    // Nate's bill (the sandbox opens as the admin), whoever is practising: v4 (R-269, R-267 #13) seeds the same drafts for
    // everyone, or one bill read "Make the draft now" to its owner and "sent back" to the teammates practising beside them.
    // Not a strongly supported or opposed bill: those also carry the public-ask card, and two cards on one bill hide each other in a short list.
    const seed = S.advocates.find(x => x.initials === 'NT')?.id || S.me?.id;
    const own = c.filter(x => !/^strongly_/.test(x.b.position) && (S.assignments[x.b.id] || []).includes(seed)), pick = own.slice(-1)[0];
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
DB.init().then(boot).catch(e => { console.error(e); reportError('boot', e); document.getElementById('app').innerHTML = failScreen(); });
