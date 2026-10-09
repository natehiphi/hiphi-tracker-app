// HIPHI public tracker, redesign 9/19: the page frame and the router.
// Every screen is a module with { render(route), wire(route), bar?(route), tabs, tab }. This file decides which one
// shows, draws the header, the sandbox band and the bottom tab bar, and owns Back, scroll and the first load.
import { reportError } from './errlog.js';   // first, so its handlers are in place before the screens' code runs (R-111)
import { initLang, isEn, loadDbTranslations, S, D, DEMO, SEASON_OFF, app, esc, icon, toast, friendly, init, loadUser, onb, onbSet, nudge, wiz, firstVisit, readyForSession, sessionInfo, loadCatalog, applyCachedCatalog, followsAnything, hstDay, CONSENT_KEY, restoreFollows, issueFollowed } from './kernel.js';
import { MARK } from './art.js';
import { skeleton, btn, keepWordsWhole } from './ui.js';
import { logDay, logAct } from './visitlog.js';
import { abSettled, armOf, abSeen } from './variant.js';
import { testerActive } from './testerlog.js';   // a tester's path (R-193): starts itself on a tester-sheet link
app.onAct = logAct;   // markDone (core.js) calls it: an action marked done, counted by its kind only

// Screens load on first use (R-122, the assessment's P5): a newcomer's first load carries the first visit and not Home,
// Find, People or More; a returning person's carries Home and not the first visit and its lessons (track.html preloads
// the right one from what this browser remembers, so the first screen costs no extra round trip); the committee pages,
// every bill, the tour and the walkthrough (helper.js, the largest module, which sets app.openHelper and app.openMail
// itself once loaded) come when first asked for. Until a module is in, a stand-in draws a skeleton under the right tab
// and asks for it; `load()` fetches it once and puts it in SCREENS in the stand-in's place.
const lazy = (key, load, o = {}) => {
  const ph = { tab: o.tab || 'find', tabs: o.tabs !== false, title: () => o.title || 'Loading', wire() {},
    load() { if (!ph.p) ph.p = load().then(m => { for (const n of Object.keys(SCREENS)) if (SCREENS[n] === ph) SCREENS[n] = m.default; return m; }).catch(e => { ph.p = null; throw e; }); return ph.p; },
    render() { ph.load().then(() => render()).catch(e => { console.error(e); reportError('render', e); }); return `<div class="skelpage">${skeleton(4)}</div>`; } };
  return ph;
};
// The layout test (R-187, pub/variant.js 'layout'): a browser on version A gets its Home and its bill page (pub/a/), which
// draw today's screens wherever version A has nothing of its own; every other screen is the same in both. The version is
// read as the module loads and kept for the page load (variant.js pins it), so the two never mix on one page.
const layoutA = () => armOf('layout') === 'a';
const start = lazy('start', () => import('./start.js'), { tabs: false, title: 'Welcome' }), home = lazy('home', () => layoutA() ? import('./a/home.js') : import('./home.js'), { tab: 'home', title: 'Home' });
const find = lazy('find', () => import('./find.js'), { tab: 'find', title: 'Find' }), people = lazy('people', () => import('./people.js'), { tab: 'more', title: 'Your legislators' });
const more = lazy('more', () => import('./more.js'), { tab: 'more', title: 'More' });
const profile = lazy('profile', () => import('./profile.js'), { tab: 'more', title: 'Your profile' });   // R-147
const quiz = lazy('quiz', () => import('./quiz.js'), { tab: 'more', title: 'What kind of advocate are you?' });   // R-217, a draft: the practice copy only (parseRoute)
const bill = lazy('bill', () => layoutA() ? import('./a/bill.js') : import('./bill.js'), { tabs: false, title: 'Bill' }), mybills = lazy('mybills', () => import('./mybills.js'), { tab: 'bills', title: 'My issues' });
const mylists = lazy('mylists', () => import('./mylists.js'), { tab: 'bills', title: 'A list' });
const committees = lazy('committees', () => import('./committees.js')), allbills = lazy('allbills', () => import('./allbills.js'));
// Each screen's stylesheet comes with it (R-122): track.html loads the base and the first screen's own, the rest come on
// first use, and all of them a moment after the first screen so a later tap never waits. The order of the original list
// is kept (a later file may override an earlier one; wide.css, the last, overrides them all).
const CSS_ORDER = ['base', 'fx', 'actions', 'start', 'lessons', 'onb', 'onb-p2', 'onb-p3', 'onb-p4', 'home', 'mybills', 'find', 'bill', 'people', 'committees', 'allbills', 'more', 'profile', 'talk', 'helper', 'tour', 'mylists', 'quiz', 'wide', 'a/a'];
// (SCREEN_CSS, not CSS: that name is the browser’s own object, CSS.escape.)
// Find, an issue, a category and a list draw their bills with mybills.js's rows, so mybills.css comes with them (R-184: an
// issue page opened from a shared link drew its rows unstyled for about two seconds, 409px wide on a 375px phone, so the
// phone zoomed the page out, and a Follow tapped then opened the profile sheet cut off at both edges).
const SCREEN_CSS = { start: ['start'], learn: ['start'], home: ['home'], recap: ['home'], bills: ['mybills'], find: ['mybills', 'find'], issue: ['mybills', 'find'], category: ['mybills', 'find'], list: ['mybills', 'find'],
  bill: ['bill', 'mylists'], legislators: ['people'], legislator: ['people'], committees: ['committees'], committee: ['committees'], allbills: ['allbills'],
  more: ['more', 'talk', 'profile'], help: ['more', 'talk'], signin: ['more'], alerts: ['more'], settings: ['more', 'profile'], profile: ['more', 'profile'], privacy: ['more'], mylist: ['mylists'], shared: ['mylists'], quiz: ['quiz'] };
// Version A's look (pub/a/a.css, scoped to body.va and its own classes) comes after wide.css, as track-a.html had it, on
// every screen but the first visit, which both versions share and other tests compare (R-187).
const cssFor = name => layoutA() && !FIRST_VISIT.includes(name) ? [...(SCREEN_CSS[name] || []), 'a/a'] : SCREEN_CSS[name];
const FIRST_VISIT = ['start', 'learn'];
const cssLink = n => document.querySelector(`link[rel="stylesheet"][href="pub/${n}.css"]`);
const cssDone = new Set(), cssP = {};
const cssOne = n => cssP[n] ??= new Promise(res => {
  const done = () => { cssDone.add(n); res(); };
  const have = cssLink(n); if (have && have.sheet) return done();
  const l = have || document.createElement('link'); l.rel = 'stylesheet'; l.href = `pub/${n}.css`; l.onload = l.onerror = done;
  if (!have) { const after = CSS_ORDER.slice(CSS_ORDER.indexOf(n) + 1).map(cssLink).find(Boolean); document.head.insertBefore(l, after || null); }
});
const ensureCss = names => Promise.all((names || []).map(cssOne));
const cssReady = names => (names || []).every(n => cssDone.has(n) || !!cssLink(n)?.sheet);
// The screen a route needs, module and stylesheet, loaded before its first draw (no skeleton for the first screen).
const ensureScreen = route => { const s = SCREENS[route.name] || SCREENS.home; return Promise.all([s.load ? s.load() : null, ensureCss(cssFor(route.name))]); };
// The bill page's and Home's tour (pub/tour.js) loads only when this browser has not finished it.
let tourMod = null; const tourLoad = () => tourMod ? Promise.resolve(tourMod) : Promise.all([import('./tour.js'), ensureCss(['tour'])]).then(([m]) => tourMod = m.default);
app.billTour = () => tourLoad().then(t => t.startBill()).catch(e => console.error(e));   // the bill page's "Take the tour" (X10-4)
const tourWanted = route => { try { return (route.name === 'bill' && !localStorage.getItem('hiphi_tour_bill')) || (route.name === 'home' && !localStorage.getItem('hiphi_tour_home')); } catch { return false; } };
let helperMod = null;
const helperLoad = () => helperMod ? Promise.resolve(helperMod) : Promise.all([import('./helper.js'), ensureCss(['helper', 'profile'])]).then(([m]) => { helperMod = m.default; return helperMod; });
app.openHelper = (...a) => helperLoad().then(() => app.openHelper(...a));
app.openMail = o => helperLoad().then(() => app.openMail(o));
// A tab that reloads with the walkthrough open (iOS does this to a background tab while the person is in their mail app)
// comes back to it: helper.js's tryReopen runs from its wire(), so when its mark is set (its OPEN_KEY) it loads at once.
try { if (sessionStorage.getItem('hiphi_helper_open')) helperLoad().then(() => render()); } catch { /* storage blocked */ }

// name -> screen module. More covers help, sign in, alerts (R-146) and privacy; people covers legislators. The profile
// (R-147) is its own module, and Settings' old address opens it.
const SCREENS = { start, learn: start, home, recap: home, bills: mybills, find, issue: find, category: find, list: find, bill, legislators: people, legislator: people,
  committees, committee: committees, allbills, more, help: more, signin: more, alerts: more, settings: profile, profile, privacy: more, mylist: mylists, shared: mylists, quiz };
// "My issues" (Nate, 9/21, R-018 answer 4): the tab shows what a person follows, issue by issue. Its address stays #/bills.
const TABS = [['home', '#/', 'house', 'Home'], ['bills', '#/bills', 'star', 'My issues'], ['find', '#/find', 'search', 'Find'], ['more', '#/more', 'menu', 'More']];
// Version A's tabs (R-070 decision 6, tried there): "You" in More's place, for your legislators, your profile and help.
const TABS_A = [...TABS.slice(0, 3), ['more', '#/more', 'circle-user', 'You']];
const tabsNow = () => layoutA() ? TABS_A : TABS;
// Version A keeps My issues lit on an issue the person follows (R-070 problem 8: it lit Find).
const tabOf = (route, scr) => layoutA() && route.name === 'issue' && issueFollowed(S.issueBySlug.get(route.slug)) ? 'bills' : scr.tab;

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
    // #/bill/HB1780/testify (or /email) opens the bill with its walkthrough already open: for emails, texts and the calendar feed (R-124).
    // /ask, /floor, /conference and /governor open those asks the same way: the share pages' links (R-169, bill.js openAsk).
    // /attend (R-205) opens the hearing's when-and-where, for a friend asked to come to it.
    case 'bill': { const yr = /^\d{4}$/.test(seg[1] || '') ? +seg[1] : 0, open = seg[yr ? 3 : 2]; return { name: 'bill', num: String((yr ? seg[2] : seg[1]) || '').toUpperCase(), year: yr || undefined, open: ['testify', 'email', 'attend', 'ask', 'floor', 'conference', 'governor'].includes(open) ? open : undefined }; }
    // #/follow/flavored-tobacco-ban,cat:keiki: a "My issues link" (R-123): follows those issues in this browser, then Home.
    case 'follow': return { name: 'follow', slugs: String(seg[1] || '').split(',').map(x => x.trim()).filter(Boolean) };
    case 'legislators': return { name: 'legislators', from: q.get('from') || '' };
    case 'legislator': return { name: 'legislator', id: +seg[1] || 0, from: q.get('from') || '' };
    case 'committee': return { name: 'committee', code: String(seg[1] || '').toUpperCase() };
    case 'help': return { name: 'help', slug: seg[1] || '' };   // #/help/<slug> opens one conversation (R-075, pub/talk.js)
    // R-217: a draft, the practice copy only until Nate says yes. #/quiz the start (or the kept result), #/quiz/1 to #/quiz/5 the questions
    // (each step its own history entry, so a phone's back gesture steps back through them), #/quiz/result.
    case 'quiz': return DEMO ? { name: 'quiz', step: seg[1] === 'result' ? 6 : Math.min(5, Math.max(0, +seg[1] || 0)) } : { name: 'home', unknown: true };
    default: return SCREENS[seg[0]] ? { name: seg[0] } : { name: 'home', unknown: true };   // a mistyped or old address: Home, with a word (R-067)
  }
}
export const toHash = r => ({ bill: `#/bill/${r.year ? r.year + '/' : ''}${r.num}${r.open ? '/' + r.open : ''}`, list: `#/list/${r.slug}`, issue: `#/issue/${r.slug}`, category: `#/find/category/${r.key}`, legislator: `#/legislator/${r.id}`, legislators: '#/legislators',
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
// Who is here (R-147): a profile is an email (signed in) or a text-alert number on this device (Nate 10/4: "only work with
// an email or phone number"). The name comes from the account, the letter helper or the first visit, whichever has one.
// Kernel-only on purpose (this file is on the first wave); pub/myprofile.js has the same rules for the lazy screens.
function whoAmI() {
  let me = {}, text = null; try { me = JSON.parse(localStorage.getItem('hiphi_me') || '{}') || {}; text = JSON.parse(localStorage.getItem('hiphi_text') || 'null'); } catch { /* private mode */ }
  if (!S.session && !(text && text.token && /^\d{10}$/.test(text.phone || ''))) return null;
  // One name (R-156): the account's, else the device's even when cleared, else the first visit's (myprofile.js myName).
  const name = String((S.session && S.profile?.name) || (typeof me.name === 'string' ? me.name : (S.user?.prefs || {}).name || wiz().name) || '').trim();
  // The ʻokina is a letter to Unicode, never an initial: "IK" for ʻIlima Kahale (myprofile.js initials).
  const w = name.normalize('NFC').replace(/[ʻʼ‘’'`-]/g, '').replace(/[^\p{L}\p{M}\s]/gu, ' ').trim().split(/\s+/).filter(Boolean);
  const one = x => (x.match(/\p{L}\p{M}*/u) || [''])[0];
  return { name, first: String(name.split(/\s+/)[0] || ''), ini: w.length ? (one(w[0]) + (w.length > 1 ? one(w[w.length - 1]) : '')).toUpperCase() : '' };
}
const avatar = (me, cls = 'hav') => `<span class="${cls}" aria-hidden="true">${me.ini ? esc(me.ini) : icon('user', { size: 18 })}</span>`;
function header(route, scr) {
  const inStart = route.name === 'start';
  // R-147: someone with a profile (an email or a text number) sees their initials at the top right, the usual place on a
  // laptop; everyone else keeps "Sign in" for a returning email.
  const me = whoAmI();
  const account = me ? `<a class="hbtn hacct" href="#/profile" aria-label="Your profile${me.name ? `, ${esc(me.name)}` : ''}">${avatar(me)}<span>${me.name ? esc(me.first) : 'Profile'}</span></a>`
    : DEMO ? '' : `<a class="hbtn hacct" href="#/signin?by=number">${icon('log-in')}<span>Sign in</span></a>`;
  const right = inStart ? (S.session || DEMO ? '' : `<a class="hbtn" href="#/signin?by=number">Sign in</a>`)
    : `<form class="hsearch" role="search" data-hsearch><label class="sr" for="hq">Search issues and bills</label>${icon('search')}<input id="hq" type="search" placeholder="Search issues and bills: e-cigarettes, school meals" autocomplete="off" enterkeyhint="search"></form>
       <a class="hbtn hsearchbtn" href="#/find" aria-label="Search issues and bills" data-focussearch>${icon('search', { size: 24 })}</a>${account}`;
  const tab = tabOf(route, scr), nav = inStart ? '' : `<nav class="hnav" aria-label="Main">${tabsNow().map(([t, href, ic, label]) => `<a href="${href}" ${tab === t ? 'aria-current="page"' : ''}>${icon(ic)}${label}</a>`).join('')}</nav>`;
  return `${DEMO ? `<div class="band">${SEASON_OFF ? 'Sandbox · after the 2026 session · nothing is saved' : `<p>Sandbox · <span data-band-day>Mon, Mar 16, 2026</span> · ${testerActive() ? 'the screens you visit are noted for this test' : 'nothing is saved'}${nextDay()}</p>`}</div>` : ''}
    <header class="hdr"><div class="hdrin"><a class="brand" href="#/" aria-label="Bill Tracker home">${MARK}<span class="bname"><b>Bill Tracker</b><small>Hawaiʻi health bills · from HIPHI</small></span></a>${nav}<span class="hspace"></span>${right}</div></header>`;
}
function tabbar(route, scr) {
  // R-147: the More tab carries the person's initials once they have a profile, so having one shows from every screen.
  const me = whoAmI(), tab = tabOf(route, scr);
  return `<nav class="tabs" aria-label="Main">${tabsNow().map(([t, href, ic, label]) => `<a href="${href}" ${tab === t ? 'aria-current="page"' : ''}><span class="pill">${t === 'more' && me ? avatar(me, 'tab-av') : icon(ic, { size: 24 })}</span>${label}</a>`).join('')}</nav>`;
}
// The practice copy's next day (R-187): Monday 16 March to Tuesday to Wednesday, with that day's real committee decisions
// (pub/testbed.js). A tester who has just finished the first visit sees Home in its welcome shape for the rest of that
// visit; "Next day" is the visit after, the Home the layout and Home's-top tests compare (the tester sheet says to press
// it). &later (track.html) ends the first visit's welcome; everything they followed stays.
const DAYS_ON = ['mon', 'tue', 'wed'];
function nextDay() {
  const q = new URLSearchParams(location.search), i = DAYS_ON.indexOf(q.get('day') || 'mon');
  if (i < 0 || i >= DAYS_ON.length - 1 || firstVisit()) return '';
  q.set('day', DAYS_ON[i + 1]); q.set('later', '1'); q.delete('restart');
  return ` · <a href="${esc(location.pathname + '?' + q.toString())}#/" data-nextday>Next day</a>`;
}

let lastRouteKey = '';
export function render() {
  let route = parseRoute();
  // A "My issues link" (R-123): follow its issues, say so, and land on Home (the first visit is skipped: they have a setup).
  if (route.name === 'follow') { restoreFollows(route.slugs); history.replaceState({ y: 0 }, '', '#/'); route = parseRoute(); }
  // A mistyped or old address lands on Home with one line saying so, then becomes the plain Home address (R-067).
  if (route.unknown) { history.replaceState(history.state, '', '#/'); setTimeout(() => toast('That page isn’t here. This is the home page.'), 50); }
  // A first visit to the home page starts the guided start where the person left it.
  if (route.name === 'home' && firstVisit()) { history.replaceState({ y: 0 }, '', `#/start/${readyForSession() ? 2 : wiz().step || 1}`); route = parseRoute(); }
  const scr = SCREENS[route.name] || SCREENS.home;
  const tabs = scr.tabs !== false && !(scr.noTabs && scr.noTabs(route));
  const bar = scr.bar ? scr.bar(route) : '';
  document.body.classList.toggle('va', layoutA() && !FIRST_VISIT.includes(route.name));
  document.body.classList.toggle('notabs', !tabs);
  document.body.classList.toggle('withtabs', tabs);
  document.body.classList.toggle('hasbar', !!bar);
  document.body.dataset.screen = route.name;
  // The screen's stylesheet first: until it is in, a skeleton under the right header, redrawn when it lands.
  const need = cssFor(route.name), styled = cssReady(need);
  if (!styled) ensureCss(need).then(() => render()).catch(e => console.error(e));
  const draw = styled ? scr : { render: () => `<div class="skelpage">${skeleton(4)}</div>`, wire() {} };
  let main;
  try { main = draw.render(route); } catch (e) { console.error(e); reportError('render', e); main = errorCard(); }
  const keep = location.hash === lastRouteKey ? focusKey(document.activeElement) : null;
  // The sticky action bar is part of the page's main content (it holds the page's main button), so it sits inside <main>.
  $app().innerHTML = `<button type="button" class="skip" data-skip>Skip to content</button>${header(route, scr)}
    <main id="main" tabindex="-1">${main}${bar ? `<div class="actionbar"><div class="inner">${bar}</div></div>` : ''}</main>
    ${tabs ? tabbar(route, scr) : ''}
    ${helperMod ? helperMod.render() : ''}`;
  document.title = (scr.title ? scr.title(route) + ' · ' : '') + 'HIPHI Bill Tracker';
  try { draw.wire && draw.wire(route); } catch (e) { console.error(e); }
  helperMod?.wire();
  wireFrame();
  // The layout test (R-187) is met where its two versions differ on screen: a bill page, or Home in session with something
  // followed once the first visit is behind them (version A's own Home, or today's everyday one; both keep today's
  // welcome shape right after the first visit, and today's Home between sessions or for someone following nothing).
  if (styled && ((route.name === 'bill' && $app().querySelector('#main .bl-head')) || (route.name === 'home' && $app().querySelector('#main .ah, #main .hm-follow:not(.hm-welcome)')))) abSeen('layout');
  if (keep && !document.querySelector('dialog[open]')) { const el = findByKey(keep); if (el && el !== document.activeElement) el.focus({ preventScroll: true }); }
  // Screen changes move focus to the page for screen readers (not on re-renders of the same screen).
  const key = location.hash;
  if (key !== lastRouteKey) { lastRouteKey = key; if (document.activeElement === document.body || !$app().contains(document.activeElement)) $app().querySelector('main')?.focus({ preventScroll: true }); }
  // The first bill page anyone opens gets a short tour (R-062, pub/tour.js); it decides for itself, and closes if the page moves on.
  try { if (tourMod) tourMod.after(route); else if (tourWanted(route)) tourLoad().then(t => t.after(parseRoute())).catch(e => console.error(e)); } catch (e) { console.error(e); }
}
let findMod = null, suggestMod = null;
const suggestLoad = () => suggestMod ? Promise.resolve(suggestMod) : import('./suggest.js').then(m => (suggestMod = m));
app.render = render;
app.ensureCss = ensureCss;   // start.js asks for the lessons' stylesheet with their module
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
const pathOf = h => String(h || '').split('?')[0];   // "#/find?q=meals" and "#/find" are the same page
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
    // Find's search code loads at the first letters typed, and the suggestions are asked for again once it is in; the
    // combobox itself (suggest.js) loads when the box is first focused (R-122: the first screen has no search box).
    const source = q => { if (findMod) return findMod.headerSuggest(q); find.load().then(m => { findMod = m; inp.dispatchEvent(new Event('input', { bubbles: true })); }).catch(e => console.error(e)); return { groups: [] }; };
    const arm = () => suggestLoad().then(({ suggest }) => suggest(inp, { source, open: go, min: 3, wait: 200, when: () => parseRoute().name !== 'find', label: 'Suggested issues and bills',
      busy: 'Looking for bills', failed: 'Search didn’t work just now. Check your connection and try again.',
      empty: q => `No issues or bills match “${q}”. Try one word, like e-cigarettes, or a bill number.`,
      seeAll: (q, hits) => hits ? { href: '#/find?q=' + encodeURIComponent(q), label: `See all results for “${q}”` } : { href: '#/find', label: 'Browse all issues', icon: 'arrow-right' } })).catch(e => console.error(e));
    if (suggestMod) arm(); else inp.addEventListener('focus', arm, { once: true }); }
}
// Honest words (R-122): offline is the person's connection; anything else is ours, and says so.
const errorCard = () => `<div class="empty"><h2>We couldn’t load the bills</h2><p>${navigator.onLine === false ? 'You’re offline. Check your connection and try again.' : 'The tracker can’t reach its data right now. It’s not you. Check your connection and try again in a minute.'}</p>${btn('Try again', { kind: 'primary', icon: 'rotate-ccw', attrs: { onclick: 'location.reload()' } })}</div>`;

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
  await initLang(); if (!isEn()) loadDbTranslations();   // the person's language (R-166 step 3): English at once; another language waits for its words, so no screen is drawn half in each
  // The practice copy is one big file (about 6 MB; the testers' links), so it gets far longer than the live page (R-122).
  const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), DEMO ? 45000 : 12000));
  try {
    // The issues come first: what a person follows is worked out from them (063, R-018). HIPHI's live bills and the
    // session's reference data do not depend on that, so they start now, alongside (R-067 speed).
    // The bill-level code (core.js: the bills, the lists, the reference data) comes after the first screen (R-122): the
    // kernel is all app.js carries; track.html preloads core.js for a browser that has been here before.
    const C = await import('./core.js');
    if (!DEMO) { C.loadReference().catch(() => {}); C.loadPool().catch(() => {}); }
    // A first visit's first screen needs only the categories and issues (R-122): a copy kept from the last visit draws
    // it before the network answers, the live catalog draws it as soon as it lands, and the bills and lists follow.
    // Only when firstVisit() can already be trusted: never for a signed-in person (their actions come with the bills)
    // and never in the practice copy (one file, so nothing is early; and its seeded actions come with the bills too).
    // 10/1: an early render that judged wrong rewrote the address to #/start/1, and the bills' arrival could not undo it.
    const early = () => { if (!DEMO && !S.session && firstVisit() && parseRoute().name === 'home') start.load().then(() => render()).catch(e => console.error(e)); };
    if (!DEMO && applyCachedCatalog()) { await loadUser(); early(); }
    await Promise.race([(async () => { await loadCatalog(); await loadUser(); early(); await C.loadLists(); await C.loadBills(); })(), timeout]);
    // The practice copy follows the real A/B switches (R-192): its first screen waits for them (they come in a moment,
    // long before the practice copy's one big file), so a version never changes under the person.
    if (DEMO) await abSettled(5000);
    await ensureScreen(parseRoute());
    welcomeBack();
    // Once a day, privately: did this browser come back, and after how long (R-067; visitlog.js, migration 078).
    logDay({ follows: followsAnything(), signedIn: !!S.session, season: sessionInfo().phase === 'in' ? 'in' : 'off' });
    // Links shared before 9/19 become the new addresses; a first visit that arrives on a shared link gets the
    // guided start behind it, so Back goes somewhere helpful.
    // Someone who went to add their email in the middle of a list task comes back to it once the emailed link signs
    // them in (R-013): that link opens the plain address, so the place was kept in this browser (pub/mylists.js).
    let place = null, lists = null;
    if (S.user) { lists = await import('./mylists.js'); place = lists.takePlace(); if (place) history.replaceState({ y: 0 }, '', place.hash); }
    const r = parseRoute();
    if (r.legacy) {
      if (firstVisit()) { history.replaceState({ y: 0 }, '', '#/start/1'); history.pushState({ y: 0, arrived: true }, '', toHash(r)); }
      else history.replaceState({ y: 0 }, '', toHash(r));
    }
    render();
    if (window.__hiphiErrs) window.__hiphiErrs.booted = true;   // track.html's catcher: the app started (R-111)
    setTimeout(() => ensureCss(CSS_ORDER.filter(n => n !== 'wide' && n !== 'a/a')).catch(() => {}), 2500);   // the other screens' styles, after the first screen
    lists?.finishPlace(place);
  } catch (e) {
    console.error(e); reportError('boot', e);
    $app().innerHTML = `${header({ name: 'error' }, {})}<main id="main">${errorCard()}</main>`;
  }
}
app.boot = boot;
keepWordsWhole(document.body);   // "e-cigarettes" never splits at its hyphen, on any screen (X9-1)
$app().innerHTML = `<div class="hdr"></div><main>${DEMO ? '<p class="meta boot-note">Loading the practice copy: one big file, up to half a minute on a weak signal.</p>' : ''}${skeleton(4)}</main>`;
// The clock starts with the script, so a start that hangs anywhere (the data file, the Supabase client) ends in the
// "Try again" card instead of a skeleton that never goes away.
// The first screen before the library (R-122): a browser with no stored sign-in and a first visit to do draws the topics
// from the catalog track.html asked for before any module arrived (or from the copy kept last time), and only then asks
// for the library, the lists and the bills: on a slow phone every file competes for the same thin pipe, so the first
// screen's files go first. boot() redraws once everything is in. A stored sign-in means a session may exist, and that
// is only known once the library answers, so such a browser goes straight to the library. track.html's catalog promise
// settles within ten seconds either way, so this never waits longer than that.
const storedSession = () => { try { return !!localStorage.getItem('hiphi-public-auth'); } catch { return false; } };
async function earlyFirst() {
  if (DEMO || storedSession() || parseRoute().name !== 'home') return;
  // The A/B switches come in the same moment as the catalog; abSettled waits for them a moment at most (R-135).
  const draw = async () => { await loadUser(); if (firstVisit() && parseRoute().name === 'home') { await Promise.all([start.load(), ensureCss(SCREEN_CSS.start), abSettled()]); render(); } };
  if (applyCachedCatalog()) await draw();
  if (window.__hiphiCatalog) { await loadCatalog(); if (S.cats.length) await draw(); }
}
const initP = () => Promise.race([init(), new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), DEMO ? 60000 : 15000))]);
// An ended tester link (R-204): track.html is already on its way to test-ended.html, so the app does not start.
if (!(DEMO && new URLSearchParams(location.search).has('ended'))) earlyFirst().catch(e => console.error(e)).then(initP).then(boot)
  .catch(e => { console.error(e); reportError('boot', e); $app().innerHTML = `<main id="main">${errorCard()}</main>`; });
