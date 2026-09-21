// HIPHI Staff v2: the frame and the router (plan section 2). The current staff app (index.html + app.js) is option 1
// and stays untouched; this is option 2, a task-first, phone-first companion. Screens are modules with
// { render(route), wire(route, root), bar?(route), title(route), back?(route), tab, tabs?, wide?, narrow? }.
import { S, DB, DEMO, APP_URL, LINK_ERR, RECOVERY, setRecovery, hooks, esc, advocate } from './data.js';
import { icon, btn, iconBtn, toast, skeleton, empty, menuSheet, popSheet, sheetOpen, closeSheet, takeSheetEntry, avatar, keysOn } from './ui.js';
import { MARK } from '../pub/art.js';
import today, { reviewQueue } from './today.js';
import review from './review.js';
import bill from './bill.js';
import bills from './bills.js';
import triage from './triage.js';
import memo from './memo.js';
import legislators from './legislators.js';
import legislator from './legislator.js';
import search from './search.js';
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

// ---- routes ----
const SCREENS = { today, review, bill, bills, triage, memo, legislators, legislator, search, supporters, person, issues, issue, lists, list, emails, composer, me, setup, help, devui };
export function parseRoute(h = location.hash) {
  const dh = decodeURIComponent(h || '');
  let m;
  if ((m = /^#bill=([A-Za-z]+\s?\d+)/.exec(dh))) return { name: 'bill', num: m[1].replace(/\s/g, '').toUpperCase(), tab: 'overview', legacy: true };
  const [p, qs] = dh.replace(/^#/, '').split('?'), q = Object.fromEntries(new URLSearchParams(qs || '')), seg = p.split('/').filter(Boolean);
  switch (seg[0]) {
    case undefined: return { name: 'today', q };
    case 'review': return { name: 'review', id: seg[1] || '', q };
    case 'bills': return seg[1] === 'new' ? { name: 'triage', q } : seg[1] === 'memo' ? { name: 'memo', q } : { name: 'bills', muted: seg[1] === 'muted', q };
    case 'bill': return { name: 'bill', num: String(seg[1] || '').toUpperCase(), tab: seg[2] || 'overview', q };
    case 'legislators': return { name: 'legislators', q };
    case 'legislator': return { name: 'legislator', id: +seg[1] || 0, from: q.from || '', q };
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
  render();
  if (!keepScroll) window.scrollTo(0, 0);
}
S.go = go;
window.addEventListener('popstate', e => {
  if (popSheet()) return;                      // Back closed a sheet: the page underneath stays as it is
  depth = e.state?.d || 0;
  render(); const y = e.state?.y || 0; requestAnimationFrame(() => window.scrollTo(0, y));
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
// away here: Review, Sort new bills, the weekly memo, Lists, Emails, setup and help.
const SIDE = [
  ['today', '#/', 'list-todo', 'Today', [['review', '#/review', 'Review']]],
  ['bills', '#/bills', 'scroll-text', 'Bills', [['triage', '#/bills/new', 'Sort new bills'], ['memo', '#/bills/memo', 'Weekly memo']]],
  ['legislators', '#/legislators', 'landmark', 'Legislators', []],
  ['outreach', '#/outreach', 'megaphone', 'Outreach', [['supporters', '#/outreach', 'Supporters'], ['issues', '#/outreach/issues', 'Issues'], ['lists', '#/outreach/lists', 'Lists'], ['emails', '#/outreach/emails', 'Emails']]],
];
const SUB_OF = { review: 'review', triage: 'triage', memo: 'memo', supporters: 'supporters', person: 'supporters', issues: 'issues', issue: 'issues', lists: 'lists', list: 'lists', emails: 'emails', composer: 'emails' };
// Collapsing the sidebar is about this screen, not about the person, so it stays in this browser rather than
// following them to their phone (where there is no sidebar at all).
export const sideNarrow = () => { try { return localStorage.getItem('sv_side') === 'narrow'; } catch { return false; } };
const setSideNarrow = on => { try { on ? localStorage.setItem('sv_side', 'narrow') : localStorage.removeItem('sv_side'); } catch { /* private window: this visit only */ } };
function sidebar(route, scr) {
  const bd = badge(), sub = SUB_OF[route.name] || '';
  let rv = 0; try { rv = reviewQueue().length; } catch { rv = 0; }
  const count = n => n ? `<span class="sv-sn">${n > 99 ? '99+' : n}</span>` : '';
  const foot = [['help', '#/help', 'circle-help', 'Help'], ...(S.me?.is_admin ? [['setup', '#/setup', 'sliders-horizontal', 'Session setup']] : []), ['me', '#/me', 'settings', 'My settings']];
  return `<aside class="sv-side" aria-label="Sections">
    <a class="sv-sbrand" href="#/" aria-label="Bill Tracker, Today">${MARK}<span>Bill Tracker<small>HIPHI staff</small></span></a>
    <nav class="sv-snav" aria-label="Main">${SIDE.map(([t, href, ic, label, subs]) => `<div class="sv-sgrp">
      <a class="sv-sitem" href="${href}" title="${label}" ${scr.tab === t && !sub ? 'aria-current="page"' : ''}${scr.tab === t ? ' data-open' : ''}>${icon(ic)}<span class="lbl">${label}</span>${t === 'today' && bd.n ? `<span class="sv-sn${bd.late ? ' late' : ''}" aria-label="${bd.n} due${bd.late ? ', some overdue' : ''}">${bd.n > 99 ? '99+' : bd.n}</span>` : ''}</a>
      ${subs.length ? `<div class="sv-ssub">${subs.map(([k, h, l]) => `<a class="sv-sitem sub" href="${h}" ${sub === k ? 'aria-current="page"' : ''}><span class="lbl">${l}</span>${k === 'review' ? count(rv) : ''}</a>`).join('')}</div>` : ''}</div>`).join('')}</nav>
    <nav class="sv-sfoot" aria-label="Help and settings">${foot.map(([k, h, ic, l]) => `<a class="sv-sitem" href="${h}" title="${l}" ${route.name === k ? 'aria-current="page"' : ''}>${icon(ic)}<span class="lbl">${l}</span></a>`).join('')}
      <button type="button" class="sv-scollapse" data-sidecol aria-pressed="${sideNarrow()}">${icon(sideNarrow() ? 'panel-left-open' : 'panel-left-close')}<span>Collapse</span></button></nav>
  </aside>`;
}
function tabbar(scr) {
  const bd = badge();
  return `<nav class="sv-tabs" aria-label="Main">${TABS.map(([t, href, ic, label]) => `<a href="${href}" ${scr.tab === t ? 'aria-current="page"' : ''}><span class="pill">${icon(ic, { size: 24 })}</span>${label}${t === 'today' && bd.n ? `<span class="sv-badge${bd.late ? ' late' : ''}">${bd.n > 99 ? '99+' : bd.n}</span>` : ''}</a>`).join('')}</nav>`;
}
let lastKey = '';
export function render() {
  if (!S.session && !DEMO) return renderLogin();
  if (RECOVERY && !DEMO) return renderRecovery();
  const route = parseRoute(); S.route = route;
  const scr = SCREENS[route.name] || today;
  const tabs = scr.tabs !== false && !(scr.noTabs && scr.noTabs(route));
  let main, bar = '';
  try { main = scr.render(route); bar = scr.bar ? scr.bar(route) : ''; } catch (e) { console.error(e); main = empty({ title: 'Something went wrong on this page', text: 'Try again, or go back to Today.', action: btn('Back to Today', { href: '#/' }) }); }
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
  const band = DEMO ? `<div class="band">Sandbox · Mar 16, 2026 · as ${esc((S.me?.full_name || '').split(' ')[0])} · nothing is saved</div>` : '';
  app.innerHTML = `<button type="button" class="skip" data-skip>Skip to content</button>${band}${sidebar(route, scr)}<div class="sv-page">${header(route, scr, /<h1[\s>]/i.test(main || ''))}<main id="main" tabindex="-1">${main}${bar ? `<div class="actionbar"><div class="inner">${bar}</div></div>` : ''}</main></div>${tabs ? tabbar(scr) : ''}`;
  // One heading a screen reader can find, on every screen at every width. Phones hide a page's own h1 (the header
  // already shows the title), which left 12 of 22 screens with no heading at all: where the page's h1 is not drawn,
  // the header's title is the heading.
  const ownH1 = app.querySelector('main h1'), ft = app.querySelector('.sv-hdr .sv-title');
  if (ft && ft.tagName !== 'H1' && (!ownH1 || getComputedStyle(ownH1).display === 'none')) { ft.removeAttribute('aria-hidden'); ft.setAttribute('role', 'heading'); ft.setAttribute('aria-level', '1'); }
  try { clearTimeout(window.__bootT); } catch { /* ignore */ }
  document.title = (scr.title ? scr.title(route) + ' · ' : '') + 'Bill Tracker staff';
  try { scr.wire && scr.wire(route, app); } catch (e) { console.error(e); }
  wireFrame(app);
  if (location.hash !== lastKey) { lastKey = location.hash; if (!app.contains(document.activeElement) || document.activeElement === document.body) app.querySelector('main')?.focus({ preventScroll: true }); }
}
hooks.render = () => render();
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
  // Collapse: redrawn in place, so the page under it keeps its scroll position and nothing else moves.
  app.querySelector('[data-sidecol]')?.addEventListener('click', () => { setSideNarrow(!sideNarrow()); render(); document.querySelector('[data-sidecol]')?.focus(); });
  // "Skip to content" moves focus into the page. As a #main link the router read it as a page name and went to Today.
  const skip = app.querySelector('[data-skip]');
  if (skip) skip.onclick = () => { const m = document.getElementById('main'); m?.focus(); m?.scrollIntoView({ block: 'start' }); };
  const f = app.querySelector('[data-hsearch]');
  if (f) f.onsubmit = e => { e.preventDefault(); const q = f.querySelector('input').value.trim(); go('#/search' + (q ? '?q=' + encodeURIComponent(q) : '')); };
}

function avatarMenu() {
  menuSheet({ title: S.me?.full_name || 'Your menu', items: [
    { label: 'My settings', icon: 'settings', run: () => go('#/me') },
    S.me?.is_admin ? { label: 'Session setup', icon: 'sliders-horizontal', run: () => go('#/setup') } : null,
    { label: 'Help', icon: 'circle-help', run: () => go('#/help') },
    { label: 'Open the current app', icon: 'external-link', sub: 'The look you know, same data', run: () => { location.href = APP_URL + (DEMO ? '?demo=1' : ''); } },
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
  if (gPending && Date.now() - gPending < 1200) { gPending = 0; const to = { t: '#/', b: '#/bills', l: '#/legislators', o: '#/outreach', r: '#/review' }[e.key]; if (to) { e.preventDefault(); go(to); } }
});

// ---- sign in and a new password (same calls as the current app) ----
function renderLogin() {
  document.body.classList.add('staff2', 'notabs');
  document.getElementById('app').innerHTML = `<main id="main" class="sv-login">${MARK.replace('class="mark"', 'class="mark mk"')}<h1>Staff sign in</h1>
    <form id="lf" novalidate class="stack16">
      <div class="field"><label for="l-email">Email</label><input id="l-email" type="email" autocomplete="username" inputmode="email" required></div>
      <div class="field"><label for="l-pass">Password</label><input id="l-pass" type="password" autocomplete="current-password" required></div>
      <div id="l-err" role="alert">${LINK_ERR ? `<p class="inlinemsg">${icon('circle-alert')}${esc(LINK_ERR)}. Each link works only once. Request a new one.</p>` : ''}</div>
      ${btn('Sign in', { kind: 'primary', full: true, attrs: { type: 'submit', id: 'l-go' } })}
      ${btn('Forgot your password?', { kind: 'text', attrs: { id: 'l-forgot' } })}
    </form><p class="small muted">This is the new staff look. <a href="${esc(APP_URL)}">Open the current app</a></p></main>`;
  const err = m => { document.getElementById('l-err').innerHTML = m ? `<p class="inlinemsg">${icon('circle-alert')}${esc(m)}</p>` : ''; };
  document.getElementById('lf').onsubmit = async e => { e.preventDefault(); err('');
    const b = document.getElementById('l-go'); b.setAttribute('aria-busy', 'true');
    try { await DB.login(document.getElementById('l-email').value.trim(), document.getElementById('l-pass').value); }
    catch (x) { err(x.message || 'Sign-in failed'); } finally { b.removeAttribute('aria-busy'); } };
  document.getElementById('l-forgot').onclick = async () => { const email = document.getElementById('l-email').value.trim(); err('');
    if (!email) { err('Enter your email address first.'); return; }
    try { await DB.sendRecovery(email); toast('Check your email for a link to set a new password'); } catch (x) { err(x.message || 'Could not send the link'); } };
}
function renderRecovery() {
  document.body.classList.add('staff2', 'notabs');
  document.getElementById('app').innerHTML = `<main id="main" class="sv-login">${MARK.replace('class="mark"', 'class="mark mk"')}<h1>Choose a new password</h1>
    <form id="rf" novalidate class="stack16">
      <div class="field"><label for="r-pass">New password</label><input id="r-pass" type="password" autocomplete="new-password"><span class="help">At least 8 characters.</span></div>
      <div class="field"><label for="r-pass2">Type it again</label><input id="r-pass2" type="password" autocomplete="new-password"></div>
      <div id="r-err" role="alert"></div>${btn('Save password', { kind: 'primary', full: true, attrs: { type: 'submit' } })}</form></main>`;
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
    if (!S.session && !DEMO) return renderLogin();
    if (RECOVERY && !DEMO) return renderRecovery();
    if (!DEMO) {   // "since your last visit" baseline, the same keys and rule as the current app
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
    render();
  } catch (e) {
    console.error(e);
    app.innerHTML = `<main id="main">${empty({ title: 'We could not load the tracker', text: 'Check your connection and try again.', action: btn('Try again', { icon: 'rotate-ccw', attrs: { onclick: 'location.reload()' } }) })}</main>`;
  }
}
// Sandbox only: sign in as a teammate (&as=KV) to see the non-admin and reviewer rules, and two sample action alerts
// (the snapshot has none): one submitted by Kevin waiting for approval, one sent, with its numbers.
function sandboxExtras() {
  const as = new URLSearchParams(location.search).get('as');
  if (as) { const a = S.advocates.find(x => (x.initials || '').toUpperCase() === as.toUpperCase()); if (a) { S.me = a; if (S.buildDemoInbox) S.inbox = S.buildDemoInbox(); } }
  if (!S.alertsSeeded) {
    S.alertsSeeded = true;
    const kev = S.advocates.find(x => /^KV$/i.test(x.initials)) || S.advocates.find(x => !x.is_admin);
    const bill1 = S.bills.find(b => b.is_public && /support/.test(b.position || '')), now = Date.now();
    if (kev && bill1) S.alerts = [
      { id: -101, status: 'submitted', author_id: kev.id, bill_id: bill1.id, subject: `Testify on ${bill1.bill_number} this week`, body: `The committee hears ${bill1.bill_number} on Wednesday. Can you send testimony? It takes five minutes.`, body_html: `<p>The committee hears ${bill1.bill_number} on Wednesday. Can you send testimony? It takes five minutes.</p>`, ask: 'Send testimony by Tuesday', created_at: new Date(now - 3 * 36e5).toISOString(), submitted_at: new Date(now - 3 * 36e5).toISOString() },
      { id: -102, status: 'sent', author_id: S.me?.id, bill_id: bill1.id, subject: `Mahalo: ${bill1.bill_number} passed its first committee`, body: 'Thanks to everyone who testified.', body_html: '<p>Thanks to everyone who testified.</p>', created_at: new Date(now - 6 * 864e5).toISOString(), sent_at: new Date(now - 5 * 864e5).toISOString(), recipients: 31, opens: 14, clicks: 5, bounces: 0 },
      ...(S.alerts || [])];
  }
}
DB.init().then(boot).catch(e => { console.error(e); document.getElementById('app').innerHTML = `<main id="main">${empty({ title: 'We could not load the tracker', text: 'Check your connection and try again.' })}</main>`; });
