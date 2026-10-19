// HIPHI public tracker, redesign 9/19: the page frame and the router.
// Every screen is a module with { render(route), wire(route), bar?(route), tabs, tab }. This file decides which one
// shows, draws the header, the sandbox band and the bottom tab bar, and owns Back, scroll and the first load.
import { reportError } from './errlog.js';   // first, so its handlers are in place before the screens' code runs (R-111)
import { initLang, isEn, loadDbTranslations, S, D, DEMO, SEASON_OFF, app, esc, icon, toast, friendly, init, loadUser, onb, onbSet, wiz, firstVisit, readyForSession, sessionInfo, loadCatalog, applyCachedCatalog, followsAnything, hstDay, restoreFollows, issueFollowed } from './kernel.js';
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
// Since 11 Oct (R-222) the test has three versions and the calm Home is the first, everyone's Home while the test is off
// (pub/calm/home.js, Direction 1: today's bill page and tabs); 'today' is the Home as it was before, and 'a' is R-071's
// Layout A from September (pub/a/: its Home, its bill page, "You").
const oldA = () => armOf('layout') === 'a';
// The calm redesign of the rest of the public pages (R-303, Nate 10/17), with the bill page in layout 3 (R-302): only with
// ?rec=1 until his look. Taking this switch out brings back today's pages everywhere.
const REC = () => new URLSearchParams(location.search).has('rec');
// ?demo=1&rec=1&boxes=1, the practice copy only (R-303, Nate 18 Oct: "Show me all the places that don't have a box and what
// they would look like with a box"): every list still on the page's grey is drawn in the white box, for his look (rec.css
// "The rest of the lists boxed"; Home's has it for real since his pick). Nothing changes without &boxes=1. Once he has
// picked the other seven, this line and that block go.
if (DEMO && REC() && new URLSearchParams(location.search).has('boxes')) document.documentElement.classList.add('rc-boxall');
const calmHome = () => armOf('layout') === 'calm';
const start = lazy('start', () => import('./start.js'), { tabs: false, title: 'Welcome' }), home = lazy('home', () => oldA() ? import('./a/home.js') : calmHome() ? import('./calm/home.js') : import('./home.js'), { tab: 'home', title: 'Home' });
const find = lazy('find', () => REC() ? import('./rec/find.js') : import('./find.js'), { tab: 'find', title: 'Find' }), people = lazy('people', () => import('./people.js'), { tab: 'more', title: 'Your legislators' });
const more = lazy('more', () => import('./more.js'), { tab: 'more', title: 'More' });
const profile = lazy('profile', () => import('./profile.js'), { tab: 'more', title: 'Your profile' });   // R-147
const nextask = lazy('next', () => import('./nextask.js'), { tabs: false, title: 'Welcome back' });   // R-237
const quiz = lazy('quiz', () => import('./quiz.js'), { tab: 'more', title: 'What kind of advocate are you?' });   // R-217, a draft: the practice copy only (parseRoute)
const bill = lazy('bill', () => oldA() ? import('./a/bill.js') : import('./bill.js'), { tabs: false, title: 'Bill' }), mybills = lazy('mybills', () => REC() ? import('./rec/mybills.js') : import('./mybills.js'), { tab: 'bills', title: 'My issues' });
const mylists = lazy('mylists', () => import('./mylists.js'), { tab: 'bills', title: 'A list' });
const committees = lazy('committees', () => import('./committees.js')), allbills = lazy('allbills', () => import('./allbills.js'));
// The calm redesign's issue page (R-302's option A) and category page (R-303), behind ?rec=1: their own module, so today's
// find.js draws them as before without it.
const recIssue = lazy('issue', () => import('./rec/issue.js'), { tab: 'find', title: 'Issue' });
// Each screen's stylesheet comes with it (R-122): track.html loads the base and the first screen's own, the rest come on
// first use, and all of them a moment after the first screen so a later tap never waits. The order of the original list
// is kept (a later file may override an earlier one; wide.css, the last, overrides them all).
const CSS_ORDER = ['base', 'fx', 'actions', 'start', 'next', 'lessons', 'onb', 'onb-p2', 'onb-p3', 'onb-p4', 'home', 'mybills', 'find', 'bill', 'people', 'committees', 'allbills', 'more', 'profile', 'talk', 'helper', 'tour', 'mylists', 'quiz', 'wide', 'rec/rec', 'rec/issue', 'a/a'];
// (SCREEN_CSS, not CSS: that name is the browser’s own object, CSS.escape.)
// Find, an issue, a category and a list draw their bills with mybills.js's rows, so mybills.css comes with them (R-184: an
// issue page opened from a shared link drew its rows unstyled for about two seconds, 409px wide on a 375px phone, so the
// phone zoomed the page out, and a Follow tapped then opened the profile sheet cut off at both edges).
// My issues draws its issue rows with find.css's .fd-irow, and a list its rows and back link with mybills.css and find.css:
// without them those pages drew unstyled for 1-3 seconds when opened directly (R-303, the walk of 10/17; R-184's kind).
const SCREEN_CSS = { start: ['start'], learn: ['start'], next: ['start', 'next'], home: ['home'], recap: ['home'], bills: ['mybills', 'find'], find: ['mybills', 'find'], issue: ['mybills', 'find'], category: ['mybills', 'find'], list: ['mybills', 'find'],
  bill: ['bill', 'mylists'], legislators: ['people'], legislator: ['people'], committees: ['committees'], committee: ['committees'], allbills: ['mybills', 'allbills'],   // its rows are mybills.js's (R-303: drawn unstyled and too wide for 2.5 s without it)
 
  more: ['more', 'talk', 'profile'], help: ['more', 'talk'], signin: ['more'], alerts: ['more'], settings: ['more', 'profile'], profile: ['more', 'profile'], privacy: ['more'], mylist: ['mybills', 'find', 'mylists'], shared: ['mybills', 'find', 'mylists'], quiz: ['quiz'] };
// Version A's look (pub/a/a.css, scoped to body.va and its own classes) comes after wide.css, as track-a.html had it, on
// every screen but the first visit, which both versions share and other tests compare (R-187).
const cssFor0 = name => oldA() && !FIRST_VISIT.includes(name) ? [...(SCREEN_CSS[name] || []), 'a/a'] : SCREEN_CSS[name];
// The calm redesign of the other pages (R-303) brings its one stylesheet to every page after the first visit, with ?rec=1.
// The issue page draws the bill page's own action card and "Where it is now" (bill.css), and it and the category page have
// a few rules of their own (rec/issue.css).
const REC_CSS = { issue: ['bill', 'rec/issue'], category: ['rec/issue'] };
const cssFor = name => REC() && !FIRST_VISIT.includes(name) ? [...(cssFor0(name) || []), ...(REC_CSS[name] || []), 'rec/rec'] : cssFor0(name);
const FIRST_VISIT = ['start', 'learn', 'next'];   // and a later visit's ask (R-237), drawn in the first visit's frame
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
const SCREENS = { start, learn: start, home, recap: home, bills: mybills, find, issue: REC() ? recIssue : find, category: REC() ? recIssue : find, list: find, bill, legislators: people, legislator: people,
  committees, committee: committees, allbills, more, help: more, signin: more, alerts: more, settings: profile, profile, privacy: more, mylist: mylists, shared: mylists, quiz, next: nextask };
// "My issues" (Nate, 9/21, R-018 answer 4): the tab shows what a person follows, issue by issue. Its address stays #/bills.
const TABS = [['home', '#/', 'house', 'Home'], ['bills', '#/bills', 'star', 'My issues'], ['find', '#/find', 'search', 'Find'], ['more', '#/more', 'menu', 'More']];
// Version A's tabs (R-070 decision 6, tried there): "You" in More's place, for your legislators, your profile and help.
// The calm redesign has them too (R-303 decision 1, behind ?rec=1): what is left on More is all about the person. The tab
// still opens #/more and carries the initials once there is a profile.
const TABS_A = [...TABS.slice(0, 3), ['more', '#/more', 'circle-user', 'You']];
const tabsNow = () => oldA() || REC() ? TABS_A : TABS;
// Version A keeps My issues lit on an issue the person follows (R-070 problem 8: it lit Find).
// Under ?rec=1 an issue or a bill lights the tab the person came from (R-303 decision 3): opened from My issues it lights My
// issues, from Find Find, from Home Home, and a bill opened from that issue keeps it. go() writes the tab lit on the page a
// link was followed from into the new entry's history.state.from; Back returns to an entry with its own. Opened directly
// (a shared link), an issue they follow lights My issues and any other Find, as version A did.
const LIT_FOLLOWS = ['issue', 'bill'];
const tabOf = (route, scr) => REC() && LIT_FOLLOWS.includes(route.name) && history.state?.from ? history.state.from
  : (oldA() || REC()) && route.name === 'issue' && issueFollowed(S.issueBySlug.get(route.slug)) ? 'bills' : scr.tab;
let litTab = '';   // the tab lit on the page drawn last (go() hands it on)

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
    case 'start': return { name: 'start', step: seg[1] === '0' ? 0 : Math.max(1, +seg[1] || 1) };   // 0: the welcome (R-297)
    // One lesson on its own, in the moment it is needed (R-067 #11): #/learn/hearing, or #/learn/hearing/<bill id> to
    // teach it on that bill.
    case 'learn': return { name: 'learn', lesson: seg[1] || 'bill', bill: seg[2] || '' };
    // A later visit's one ask, as a full page (R-237, pub/nextask.js): boot() puts it here on a new day's first arrival.
    case 'next': return { name: 'next', kind: seg[1] || '' };
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

// Someone on their first visit who arrived on a link (a friend's shared bill, an issue, a legislator) rather than at the
// front door (R-238, A4-1): their calm place to go is Find, the browse page, never the sign-up. The logo, the bill
// page's Back on a bill opened first, and the page put behind an old-form link all lead there; the Home tab is still
// Home (the sign-up, for them). The arrival is the first address this page load opened on, kept by boot().
const linkNewcomer = () => firstVisit() && !!S.arrivedOn && !FIRST_VISIT.includes(S.arrivedOn) && S.arrivedOn !== 'home';
const calmPlace = () => linkNewcomer() ? '#/find' : '#/';
app.calmPlace = calmPlace;
// The name of a page, for a Back button that says where it goes (R-238, A4-5; iOS names the screen behind, GOV.UK's back
// link says where). Short, so it fits the bill page's top bar beside the number; an issue's name is cut by CSS.
app.placeName = h => {
  const r = parseRoute(h); const sp = n => String(n || '').replace(/^([A-Z]+)(\d+)$/, '$1 $2');
  switch (r.name) {
    case 'home': case 'recap': return 'Home';
    case 'start': case 'learn': case 'next': return 'Welcome';
    case 'bills': return 'My issues';
    case 'find': return 'Find';
    case 'issue': return S.issueBySlug?.get(r.slug)?.name || 'Issue';
    case 'category': return (S.cats || []).find(c => c.key === r.key)?.name || 'Issues';
    case 'list': case 'shared': return (S.lists || []).find(l => l.slug === r.slug)?.title || 'List';
    case 'mylist': return 'Your list';
    case 'bill': return sp(r.num) || 'Bill';
    case 'legislators': return REC() ? 'Your lawmakers' : 'Legislators';   // C-15's word under ?rec=1 (R-303), the You row's name
    case 'legislator': { const l = (S.legislators || []).find(x => x.id === r.id); return l ? `${l.chamber === 'S' ? 'Sen.' : 'Rep.'} ${l.name}` : 'Legislator'; }
    case 'committees': return 'Committees';
    case 'committee': return S.committees?.[r.code]?.name || 'Committee';
    case 'more': return REC() ? 'You' : 'More';
    case 'help': return 'Help';
    case 'profile': case 'settings': return 'Your profile';
    case 'quiz': return 'Quiz';
    default: return '';
  }
};
// go('#/bills') pushes a history entry (Back works); { replace: true } swaps the current one.
function go(path, { replace = false, keepScroll = false } = {}) {
  if (!replace && path === (location.hash || '#/')) { window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); return; }
  const y = window.scrollY;
  try { history.replaceState({ ...(history.state || {}), y }, ''); } catch { /* ignore */ }
  // prev: the page this step was opened from, so a back link can tell whether real Back leads where it says (R-041).
  // from: the tab lit here, which an issue or a bill opened from this page keeps lit under ?rec=1 (tabOf).
  if (replace) history.replaceState({ y: 0, prev: history.state?.prev, from: history.state?.from }, '', path); else history.pushState({ y: 0, prev: location.hash || '#/', from: litTab }, '', path);
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
  // Find has its own search box, so the header's box and its magnifier (phones) stay away there (R-238, A4-4: two
  // boxes kept in step read as two searches, and two ways into one search is one too many).
  // Under ?rec=1 the box says it finds lawmakers too (R-303 decision 4), as search does since R-238.
  const sw = REC() ? ['Search issues, bills and lawmakers', 'Search issues, bills, lawmakers'] : ['Search issues and bills', 'Search issues and bills: e-cigarettes, school meals'];
  const box = route.name === 'find' ? '' : `<form class="hsearch" role="search" data-hsearch><label class="sr" for="hq">${sw[0]}</label>${icon('search')}<input id="hq" type="search" placeholder="${sw[1]}" autocomplete="off" enterkeyhint="search"></form>`;
  const right = inStart ? (S.session || DEMO ? '' : `<a class="hbtn" href="#/signin?by=number">Sign in</a>`)
    : `${box}${route.name === 'find' ? '' : `<a class="hbtn hsearchbtn" href="#/find" aria-label="${sw[0]}" data-focussearch>${icon('search', { size: 24 })}</a>`}${account}`;
  const tab = tabOf(route, scr), nav = inStart ? '' : `<nav class="hnav" aria-label="Main">${tabsNow().map(([t, href, ic, label]) => `<a href="${href}" ${tab === t ? 'aria-current="page"' : ''}>${icon(ic)}${label}</a>`).join('')}</nav>`;
  // "nothing is sent" (R-212 #1): the practice copy keeps drafts on this device but sends nothing anywhere. "nothing is saved or
  // sent" wrapped the band to two lines on a phone, pushing every practice screen down (density, 15 Oct); this fits one line at 360px.
  return `${DEMO ? `<div class="band">${SEASON_OFF ? 'Sandbox · after the 2026 session · nothing is sent' : `<p>Sandbox · <span data-band-day>Mon, Mar 16, 2026</span> · ${testerActive() ? 'the screens you visit are noted for this test' : 'nothing is sent'}${nextDay()}</p>`}</div>` : ''}
    <header class="hdr"><div class="hdrin"><a class="brand" href="${calmPlace()}" aria-label="Bill Tracker home">${MARK}<span class="bname"><b>Bill Tracker</b><small>Hawaiʻi health bills · from HIPHI</small></span></a>${nav}<span class="hspace"></span>${right}</div></header>`;
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
  // The redraw after the restore (R-187): restoreFollows loads the followed bills after this first draw, so without it Home
  // could stay on "finished for this session" until the next reload (seen on the practice copy's See it links).
  if (route.name === 'follow') { restoreFollows(route.slugs).then(() => render()).catch(e => console.error(e)); history.replaceState({ y: 0 }, '', '#/'); route = parseRoute(); }
  // A mistyped or old address lands on Home with one line saying so, then becomes the plain Home address (R-067).
  if (route.unknown) { history.replaceState(history.state, '', '#/'); setTimeout(() => toast('That page isn’t here. This is the home page.'), 50); }
  // A first visit to the home page starts the guided start where the person left it.
  // One who has not begun yet opens on the welcome, step 0 (R-297); start.js passes the plans and a shared bill on to step 1.
  // Begun: any step drawn (start.js sets begun), or, for a first visit already under way before the welcome, a step past
  // the first or an issue ticked.
  if (route.name === 'home' && firstVisit()) { const w = wiz(), begun = w.begun || w.step > 1 || (w.issues || []).length;
    history.replaceState({ y: 0 }, '', `#/start/${readyForSession() ? 2 : begun ? w.step || 1 : 0}`); route = parseRoute(); }
  const scr = SCREENS[route.name] || SCREENS.home;
  litTab = tabOf(route, scr);
  const tabs = scr.tabs !== false && !(scr.noTabs && scr.noTabs(route));
  const bar = scr.bar ? scr.bar(route) : '';
  document.body.classList.toggle('va', oldA() && !FIRST_VISIT.includes(route.name));
  document.body.classList.toggle('notabs', !tabs);
  document.body.classList.toggle('withtabs', tabs);
  document.body.classList.toggle('hasbar', !!bar);
  document.body.dataset.screen = route.name;
  document.body.classList.toggle('rec', REC() && !FIRST_VISIT.includes(route.name));   // R-303, behind ?rec=1
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
  // The layout test (R-187) is met where its versions differ on screen: Home, in session with something followed once the
  // first visit is behind them (the calm Home's .cm-met, version A's .ah, or today's everyday one).
  if (styled && route.name === 'home' && $app().querySelector('#main .cm-met, #main .ah, #main .hm-follow:not(.hm-welcome)')) abSeen('layout');
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
      empty: q => `No issues, bills or legislators match “${q}”. Try one word, like e-cigarettes, a bill number or a name.`,
      seeAll: (q, hits) => hits ? { href: '#/find?q=' + encodeURIComponent(q), label: `See all results for “${q}”` } : { href: '#/find', label: 'Browse all issues', icon: 'arrow-right' } })).catch(e => console.error(e));
    if (suggestMod) arm(); else inp.addEventListener('focus', arm, { once: true }); }
}
// Honest words (R-122): offline is the person's connection; anything else is ours, and says so.
const errorCard = () => `<div class="empty"><h2>We couldn’t load the bills</h2><p>${navigator.onLine === false ? 'You’re offline. Check your connection and try again.' : 'The tracker can’t reach its data right now. It’s not you. Check your connection and try again in a minute.'}</p>${btn('Try again', { kind: 'primary', icon: 'rotate-ccw', attrs: { onclick: 'location.reload()' } })}</div>`;

// ---- keyboard (people with a keyboard only; Help lists these) ----
document.addEventListener('keydown', e => {
  const t = e.target, typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
  if (typing || e.metaKey || e.ctrlKey || e.altKey || document.querySelector('dialog[open]')) return;
  // "/" puts the cursor in the search box, as on GitHub and Gmail (R-238, A4-4): the header's where it shows (laptops),
  // else Find's own (phones, and Find itself, where the header has none).
  if (e.key === '/') { e.preventDefault(); const hq = document.getElementById('hq');
    if (hq && hq.offsetParent) { hq.focus(); hq.select(); return; }
    if (parseRoute().name !== 'find') go('#/find'); setTimeout(() => document.getElementById('q')?.focus(), 30); }
  else if (e.key === '?') { e.preventDefault(); go('#/help'); }
});

// ---- first load ----
// Back after a month with things saved only in this browser: the one moment their loss is a real risk.
// Since R-067 it is the second visit, not the thirtieth day: an iPhone clears a site's storage after a week away, so
// the ask for an email ("so your issues are still here in January") comes the first time they are back on another day.
// nudge() keeps its own spacing after "Not now". The last visit is kept for Home's "Since you were here".
// Since R-237 (Nate 10/11) that ask is not a card on Home: it is one of the later visit's full pages (pub/nextask.js), and
// this says whether this is a new day's first arrival, when that page may come. The practice copy's days are its own
// ("Next day", ?day=), kept in hiphi_askday (the practice copy's copy, kernel.js), so a tester's next day counts.
function welcomeBack() {
  const o = onb(), last = o.lastVisit ? Date.parse(o.lastVisit) : 0;
  S.prevVisit = o.lastVisit || null;
  let fresh = !!last && hstDay(last) !== hstDay(Date.now());
  if (DEMO) { const day = new URLSearchParams(location.search).get('day') || 'mon';
    try { const was = localStorage.getItem('hiphi_askday'); fresh = !!was && was !== day; localStorage.setItem('hiphi_askday', day); } catch { fresh = false; } }
  onbSet({ lastVisit: new Date().toISOString() });
  // No navigator.storage.persist() here: some browsers answer it with a "store data in persistent storage?" prompt,
  // a permission box a visitor should never meet (Nate, 9/29). The profile ask (pub/nextask.js) is how saved issues are kept.
  return fresh;
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
    // The practice copy's direct link to one step of the first visit (R-188): ?demo=1&fvstep=save (pub/fvjump.js). Before the
    // route is read, so the page opens on that step; the live page never loads that file.
    if (DEMO && /[?&]fvstep=/.test(location.search)) await (await import('./fvjump.js')).fvJumpFromAddress().catch(e => console.error(e));
    await ensureScreen(parseRoute());
    const fresh = welcomeBack();
    // Once a day, privately: did this browser come back, and after how long (R-067; visitlog.js, migration 078).
    logDay({ follows: followsAnything(), signedIn: !!S.session, season: sessionInfo().phase === 'in' ? 'in' : 'off' });
    // Links shared before 9/19 become the new addresses; a first visit that arrives on a shared link gets Find behind
    // it, so Back goes somewhere helpful (R-238: it was the sign-up, and Back should never lead forward into a form).
    // Someone who went to add their email in the middle of a list task comes back to it once the emailed link signs
    // them in (R-013): that link opens the plain address, so the place was kept in this browser (pub/mylists.js).
    let place = null, lists = null;
    if (S.user) { lists = await import('./mylists.js'); place = lists.takePlace(); if (place) history.replaceState({ y: 0 }, '', place.hash); }
    const r = parseRoute();
    S.arrivedOn = r.name;   // where this page load began (linkNewcomer, R-238)
    // A later visit's one ask (R-237): only when they opened the tracker itself (plain Home), never on arrival from an alert,
    // an email or a shared link (those open their own address), and only on a new day's first arrival. pickAsk says which,
    // if any (none with testimony due within a day on what they follow).
    if (fresh && r.name === 'home' && !r.unknown && !place) {
      try { const k = (await import('./nextask.js')).pickAsk(); if (k) { history.replaceState({ y: 0 }, '', `#/next/${k}`); await ensureScreen(parseRoute()); } } catch (e) { console.error(e); }
    }
    if (r.legacy) {
      if (firstVisit()) { history.replaceState({ y: 0 }, '', '#/find'); history.pushState({ y: 0, arrived: true, prev: '#/find' }, '', toHash(r)); }
      else history.replaceState({ y: 0 }, '', toHash(r));
    }
    render();
    if (window.__hiphiErrs) window.__hiphiErrs.booted = true;   // track.html's catcher: the app started (R-111)
    setTimeout(() => ensureCss(CSS_ORDER.filter(n => n !== 'wide' && n !== 'a/a' && (REC() || !n.startsWith('rec/')))).catch(() => {}), 2500);   // the other screens' styles, after the first screen (the calm redesign's only with ?rec=1)
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
