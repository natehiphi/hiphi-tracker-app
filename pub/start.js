// The first visit (R-023, rebuilt 9/21 from the prototype Nate approved; backend docs/FIRST-VISIT-PLAN.md). Three named
// parts at the top, "Your issues · How it works · Stay connected", and no counting (HANDOFF 3.5; Nate 9/21: keep the
// named steps, remove the progress bar):
//   Your issues     topics -> issues (the four most important, then three per category; followed, then "Mahalo!")
//   How it works    one drawn page on the person's own bill, "A bill's story" (pub/lessons.js, R-062, 9/29), in three
//                   stages walked with Next: the bill itself, its road to where it is now and its next chance, and why
//                   speaking up can help (pick what you'd do: email the chair, send testimony, tell your legislators or
//                   stay quiet, and see what can happen); then the "Now you know how it works" moment
//   Stay connected  who speaks for you (street address only) -> coming up on your issues, THEN the one ask for an
//                   email (Nate 9/21: ask after the value) -> you're all set (the peak, then Home)
// Someone who arrives on a shared bill starts on the bill page itself (pub/bill.js: the easiest action first); from
// there the flow is "follow this issue?", the story of that bill, then the last part.
// People follow ISSUES, not bills (R-018). No action is pushed here; the asks to act come on later visits. The email is
// one "keep me updated" opt-in covering hearing alerts and HIPHI's own advocacy alerts (HANDOFF 3.5). Every step is its
// own route (#/start/1..N) and pushes history, so Back walks the steps. The step and the picks live in hiphi_wiz
// (wiz()/wizSet()), so a reload resumes where the person left off. Every step can be skipped, "Skip" always means "go
// to the next page" (3.5), and a primary button is never disabled. Celebrations are in proportion (DESIGN C-7 as
// rewritten 9/21): a small burst for a small win, a moment that waits for Continue for the first follow and for the
// lessons, and the peak at the end. Motion follows A-10 (pub/fx.js) and stops under Reduce Motion.










// The lessons, and the bill page's helpers they draw with, load once the topics screen is up (R-122): a newcomer's first
// screen does not need them, and on a slow phone every file competes for the same thin pipe. Until they are in, a step
// that needs the example bill shows a skeleton and is drawn again when they land; wire() asks for them at the first step.
import { S, D, DEMO, app, esc, icon, alive, sessionInfo, wiz, wizSet, HST, nudge, loadCatalog, recomputeWatch, issuesIn, issueBills, issueFollowed, followedIssues, followsAnything, issuePos, issuesOf } from './kernel.js';
import { WEIGHT, SOON_DAYS, sidePoints } from './rank.js';
import { btn } from './ui.js';
import { CAPITOL, VOICES, islands } from './art.js';
import { topics } from './topics.js';
import { burst, later, swap, reduced } from './fx.js';
import { LESSON_TITLES } from './topics.js';
import { logVisit, visitVia, partnerWelcome } from './visitlog.js';
import { wireShareLine, wireKeepLine } from './keep.js';
import { endHome, armOf, lockFirstVisit, abEvent } from './variant.js';
export let LZ = null, lzP = null;
// The rest of the first visit (start-rest.js: every step after the topics, the lessons' pages, the address and email
// steps) and the bill-level code (core.js) load after the topics screen is up (R-122, the split): a newcomer's first
// screen needs neither. Until they are in, a later step draws a skeleton and is drawn again when they land.
let REST = null, restP = null, C = null, cP = null;
const restLoad = () => restP ??= import('./start-rest.js').then(m => (REST = m)).catch(e => { restP = null; throw e; });
const coreLoad = () => cP ??= import('./core.js').then(m => (C = m)).catch(e => { cP = null; throw e; });
const restAsk = () => { if (!REST) restLoad().then(() => app.render()).catch(e => console.error(e)); return !!REST; };
export const lessons = () => LZ;   // start-rest.js reads the lessons through this (an import is read-only)
export const core = () => C;
const lessonsLoad = () => lzP ??= Promise.all([import('./lessons.js'), app.ensureCss ? app.ensureCss(['lessons']) : null]).then(([m]) => (LZ = m)).catch(e => { lzP = null; throw e; });
export const lessonsAsk = () => { if (!LZ) lessonsLoad().then(() => app.render()).catch(e => console.error(e)); return !!LZ; };




export const isOff = () => sessionInfo().phase !== 'in';
// The first visit as named screens (the same in and out of session since "Where do you stand?" left it, R-053). From a
// shared bill (wiz().via is its number), the first part happened on the bill page.
// 'bill' is the one lesson, "A bill's story" (R-062, Nate 9/29: "Let's use concept 1 as a primer for how session works
// during onboarding"; the first visit teaches the drawn story only, and hearings are taught in the moment, on the bill
// page). It replaced three lessons, 'bill', 'session' and 'hearing'; the screen keeps the name 'bill' because that is the
// step name the private counting records and the database accepts (visitlog.js, backend 067), so no migration was
// needed, and 'session' and 'hearing' are simply no longer recorded. Those three lessons still open on their own at
// #/learn/<bill|session|hearing>.
const FLOW_IN = ['topics', 'issues', 'bill', 'you', 'soon', 'done'];
const FLOW_OFF = ['topics', 'issues', 'bill', 'you', 'soon', 'done'];
const FLOW_LINK = ['followask', 'bill', 'you', 'soon', 'done'];
// The short version (R-067 #11, Nate 9/27: "teaching can happen in the moment; the educational pieces condensed into one
// very brief page"): one page on why your voice matters stands where the lesson was, and the lessons are offered where
// they are needed (#/learn/..., linked from bill pages and Help; the short page offers the drawn story). It is tested
// against the full version by coin toss since R-135 (variant.js, the test 'fv'; the testers' ?fv=short and ?fv=full still
// force one). The counting records the page as 'voice' (backend 080).
const SHORT = () => armOf('fv') === 'short';
const shorten = f => SHORT() ? f.map(n => n === 'bill' ? 'voice' : n) : f;
// The version that ends on Home (?end=home, R-098) has no "You're all set" screen: the last step goes straight to Home,
// where the celebration plays (pub/home.js).
const flowOf = off => { const f = shorten(wiz().via ? FLOW_LINK : off ? FLOW_OFF : FLOW_IN); return endHome() ? f.filter(n => n !== 'done') : f; };
const nameAt = (step, off) => { const f = flowOf(off); return f[Math.min(Math.max(step | 0, 1), f.length) - 1]; };
const stepOf = (name, off) => flowOf(off).indexOf(name) + 1;
export const total = off => flowOf(off).length;
const pathKey = () => wiz().via ? 'link' : isOff() ? 'off' : 'in';
export const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;
export const andList = a => a.length <= 1 ? (a[0] || '') : `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}`;
// "Wednesday, January 20" for a Hawaiʻi calendar day
const longDay = d => new Date(String(d).slice(0, 10) + 'T12:00:00-10:00').toLocaleDateString('en-US', { timeZone: HST, weekday: 'long', month: 'long', day: 'numeric' });
export const shortDay = d => new Date(String(d).slice(0, 10) + 'T12:00:00-10:00').toLocaleDateString('en-US', { timeZone: HST, month: 'long', day: 'numeric' });
export const hasPos = b => b && b.hiphi_position && b.hiphi_position !== 'monitor';
// Which island to pick out in the drawing, when this device or the account knows the person's Senate district:
// 1-4 Hawaiʻi Island, 5-6 Maui, 8 Kauaʻi, 9-25 Oʻahu (7 spans Maui, Molokaʻi and Lānaʻi, so it picks none).
function myIsland() {
  let sd = +((S.profile || {}).senate_district) || 0;
  if (!sd) { try { sd = +JSON.parse(localStorage.getItem('hiphi_districts') || 'null')?.senate || 0; } catch { sd = 0; } }
  return sd >= 9 ? 'oahu' : sd === 8 ? 'kauai' : sd >= 5 && sd <= 6 ? 'maui' : sd >= 1 && sd <= 4 ? 'hawaii' : '';
}

// ---------- the private visit counts (R-023 decision 8): one row per screen reached and how it was left ----------
let viewKey = '', viewAt = 0;
export const track = (step, event, extra = {}) => { try {
  // Reaching the end (the finale, or Home in the version that ends there) is the first-visit tests' measure (R-135).
  if (step === 'done' && (event === 'view' || event === 'done')) abEvent('finished');
  logVisit(step, event, { path: pathKey(), seconds: viewAt ? Math.round((Date.now() - viewAt) / 1000) : undefined, ...extra }); } catch { /* never in the way */ } };

// Closing the tab (or leaving the site) mid-visit is counted as leaving that screen, with the seconds spent on it.
window.addEventListener('pagehide', () => { if (document.body.dataset.screen === 'start' && viewKey) track(viewKey.split('|')[1], 'leave'); });

// ---------- moving between screens: forward steps are tagged, so the on-screen Back can use the real Back ----------
export function goStep(from, to) {
  LZ?.lessonStop();
  // Past the last step: Home (only the version that ends on Home gets here; today's last screen calls finish() itself).
  if (to > total(isOff())) { finish(); return; }
  swap(() => {
    app.go('#/start/' + to);
    try { history.replaceState({ ...(history.state || {}), stFrom: from }, ''); } catch { /* ignore */ }
  }, 'fwd');
}
function goBack(step) {
  const off = isOff();
  let to = step - 1;
  // A screen that would only send the person on again is passed over: from a shared bill whose issue they just followed,
  // Back from the story went to "Follow this issue?", which moves straight back to the story, so Back seemed to do nothing.
  while (to >= 1 && redirectFor(to, off)) to--;
  if (to < 1) { history.back(); return; }
  track(nameAt(step, off), 'back');
  LZ?.lessonStop();
  S.stBack = true;
  // A person who resumed straight onto a later step has no step behind them; history.back() would leave the site.
  swap(() => { if (history.state?.stFrom === to) history.back(); else app.go('#/start/' + to); }, 'back');
}
// Home shows a calm welcome for the rest of this visit instead of pushing actions (home.js reads this key). It is set
// as soon as issues are followed, so leaving early by Skip or the logo still lands on the calm Home.
export const welcome = () => { try { sessionStorage.setItem('hiphi_welcome', '1'); } catch { /* private mode */ } };
// Finishing the first visit. Between sessions we also note when the next session opens, so the start can greet them
// with HIPHI's picks then (core: readyForSession).
export function finish() {
  const si = sessionInfo();
  // The version that ends on Home (R-098) has no finale screen, so the finale's count is taken here, and Home plays the
  // celebration once for this page (S.hmFinale, pub/home.js).
  if (endHome()) {
    track('done', 'view', { counts: { issues: followedIssues().length, address: !!S.stAddr.pick, email: !!(S.session || mailSent()) } });
    S.hmFinale = { at: Date.now(), learned: !!S.stLearned, legs: !!S.stAddr.pick, told: !!(S.session || mailSent()), sent: mailSent() };
  }
  track('done', 'done');
  wizSet({ done: true, step: 1, ...(endHome() ? { finale: true } : {}), ...(si.phase !== 'in' ? { ready: si.nextOpen } : {}) });
  welcome();
  app.go('#/', { replace: true });
}
const skipAll = () => { wizSet({ skipped: true }); app.go('#/'); };

// ---------- the three named parts at the top: a signpost, not controls (A-12) ----------
// Done is a green tick and the name, now is the name in bold after a solid dot, still to come is a small grey dot and
// a quiet name. No rings or boxes (they read as radio buttons), no bar, no numbers. Below 360px only the current name
// is written out (start.css); a screen reader hears all three.
// "How a bill becomes law" was "How it works", which read as how the app works (R-067: testers liked it but were
// confused about what it is).
const CHAPTERS = ['Your issues', 'How a bill becomes law', 'Stay connected'];
const CHAPTER_OF = { topics: 0, issues: 0, followask: 0, bill: 1, voice: 1, you: 2, soon: 2, done: 3 };
// The version that ends on Home (R-098) names its last part after where it ends: "Stay connected" read as "give us your
// email and you're done".
const chapterNames = () => [CHAPTERS[0], SHORT() ? 'Why your voice matters' : CHAPTERS[1], endHome() ? 'Your home page' : CHAPTERS[2]];
let lastChapter = -1;
function chaptersRow(name) {
  const k = CHAPTER_OF[name] ?? -1; if (k < 0) return '';
  return `<nav class="st-chapters" aria-label="Your first visit"><ol>${chapterNames().map((c, i) => `<li class="${i < k ? 'done' : i === k ? 'on' : ''}"${i === k ? ' aria-current="step"' : ''}>
    <span class="st-cm" aria-hidden="true">${i < k ? icon('check') : ''}</span><span class="st-cl">${c}</span>${i < k ? '<span class="sr"> (done)</span>' : ''}</li>`).join('')}</ol></nav>`;
}
// Finishing a part ticks it with a small burst: one of the stage celebrations (C-7).
function tickChapter(name, back) {
  const k = CHAPTER_OF[name] ?? -1;
  if (!back && lastChapter >= 0 && k > lastChapter) later(() => burst(document.querySelectorAll('.st-chapters li')[k - 1]?.querySelector('.st-cm'), 10, 34), 350);
  if (k >= 0) lastChapter = k;
}

// ---------- the page frame of a step: the story (left on wide screens) and the choices (right) ----------
const backBtn = step => btn('Back', { kind: 'text', icon: 'arrow-left', cls: 'st-back', attrs: { 'data-stback': String(step) } });
export const topRow = (name, step) => `${chaptersRow(name)}${step > 1 ? `<div class="steps st-steps">${backBtn(step)}</div>` : ''}`;
export const shell = (cls, intro, main, busy = false) => `<div class="st ${cls}"${busy ? ' aria-busy="true"' : ''}><div class="st-intro">${intro}</div><div class="st-main">${main}</div></div>`;
// The drawing of each step (wide screens show one on every step; phones only where there is room, see start.css).
export const artFor = name => `<div class="st-art">${name === 'you' ? islands(myIsland()) : name === 'followask' ? VOICES : CAPITOL}</div>`;
// One line above the choices: a reassurance, which the "pick at least one" message replaces in place (so nothing
// below it moves and no choice gets covered).
export const sayRow = (ic, sure) => `<div class="st-say"><p class="st-sure">${icon(ic)}<span>${sure}</span></p><p class="st-alert" id="st-alert" role="alert"></p></div>`;
// On wide screens the reassurance belongs with the story on the left, and only the message shows above the choices.
export const sureWide = (ic, sure) => `<p class="st-sure st-surewide">${icon(ic)}<span>${sure}</span></p>`;

// ---------- the bar: one Skip, one primary ----------
export const bar2 = (label, opt = {}, attrs = { 'data-stnext': '1' }, skip = 'Skip') => `<div class="st-bar"><div class="st-btns">
  ${btn(skip, { kind: 'text', attrs: { 'data-stskip': '1' } })}${btn(label, { kind: 'primary', ...opt, attrs })}</div></div>`;
// While the issues load the primary says so, and when they could not be loaded it is the way to try again, so the
// one button on the screen is never a dead one.
export const barBusy = () => bar2('Finding issues…', { icon: 'loader-circle' }, { 'data-stnext': '1', 'aria-busy': 'true' });
export const barRetry = () => bar2('Try again', { icon: 'rotate-ccw' }, { 'data-stretry': '1' });
export const bar1 = (label, ic = 'arrow-right', attrs = { 'data-stnext': '1' }) => `<div class="st-bar st-one">${btn(label, { kind: 'primary', iconEnd: ic, attrs })}</div>`;
// Only Skip, as a quiet full-width button: an optional screen before anything is done on it (A-3: no primary yet).
export const barSkip = () => `<div class="st-bar st-one">${btn('Skip', { kind: 'secondary', attrs: { 'data-stskip': '1' } })}</div>`;
const supports = b => /support/.test(b.hiphi_position || b.position || '');
// A bill the page already has (core.js's anyBill without core.js: the topics screen must not wait for it).
const billById = id => S.bills.find(b => b.id === id) || (S.extra || {})[id] || (DEMO ? D.bills.find(b => b.id === id) : null) || null;
export const poolBills = () => (S.pool && S.pool.bills) || [];
let poolRef = null, poolSet = new Set();
const poolIds = () => { if (poolRef !== S.pool) { poolRef = S.pool; poolSet = new Set(poolBills().map(b => b.id)); } return poolSet; };
export const shown = i => i.first_visit !== false;
const inPlay = i => shown(i) && (isOff() ? issueBills(i).length > 0 : issueBills(i).some(id => poolIds().has(id)));
// Soonest upcoming hearing per bill, from what the page already loaded (the next two weeks).
export function ranker() {
  const now = Date.now(), soon = new Map();
  for (const h of [...((S.pool || {}).hearings || []), ...((S.featured || {}).hearings || []), ...S.hearings]) {
    if (h.status !== 'scheduled' || new Date(h.scheduled_at) <= now) continue;
    const c = soon.get(h.bill_id); if (!c || h.scheduled_at < c.scheduled_at) soon.set(h.bill_id, h);
  }
  const info = b => { const h = soon.get(b.id) || null, open = !!h && (!h.testimony_deadline || new Date(h.testimony_deadline) > now);
    return { h, tier: open ? 0 : h ? 1 : /^strongly/.test(b.hiphi_position || '') ? 2 : 3, when: h ? ((open && h.testimony_deadline) || h.scheduled_at) : '' }; };
  const POS_W = { strongly_support: 0, strongly_oppose: 0, support: 1, oppose: 1, support_amend: 2, neutral: 3 };
  const cmp = (a, b) => { const x = info(a), y = info(b); return x.tier - y.tier || x.when.localeCompare(y.when)
    || (POS_W[a.hiphi_position] ?? 9) - (POS_W[b.hiphi_position] ?? 9) || a.bill_number.localeCompare(b.bill_number, 'en', { numeric: true }); };
  return { info, cmp, soon };
}
// One issue as the first visit sees it: its bills (this session's, or last session's between sessions), HIPHI's
// position on it, what is happening, and how important it is.
export function issueInfo(i, R) {
  const off = isOff(), from = off ? ((S.recapPool && S.recapPool.bills) || []) : poolBills();
  const bills = issueBills(i).map(id => from.find(b => b.id === id) || billById(id)).filter(Boolean);
  const live = bills.filter(b => alive(b) || b.stage === 'governor');
  const lead = (off ? bills : live).slice().sort(R.cmp)[0] || bills[0] || null;
  const law = bills.some(b => b.stage === 'enacted');
  const moving = off ? bills : live, strong = moving.some(b => b.hiphi_position === 'strongly_support');
  const rec = !!i.recommended || bills.some(b => b.hiphi_recommended);
  const inf = lead && !off ? R.info(lead) : null, soon7 = !off && live.some(b => { const h = R.soon.get(b.id); return h && new Date(h.scheduled_at) - Date.now() < SOON_DAYS * 864e5; });
  // The same numbers as the suggested bill on Home and Find (rank.js WEIGHT, R-094), plus what only an issue has.
  // A strongly opposed bill with a hearing counts like a strongly supported one (Nate 9/29, R-094 decision 6).
  const score = sidePoints(moving, b => R.soon.has(b.id)) + (i.top_priority ? WEIGHT.top : 0) + (rec ? WEIGHT.promoted : 0) + (soon7 ? WEIGHT.soon : 0) + Math.min(moving.length, 3) * 3 - (off && law ? 25 : 0);
  // Ticked for you (silently: no "HIPHI recommends" label, R-022): staff-recommended, or strongly supported and not
  // already won.
  return { i, bills, live, lead, law, pos: issuePos(off ? bills : live.length ? live : bills, i), promoted: rec || (strong && !(off && law)), inf, score };
}
export const byScore = (x, y) => y.score - x.score || (x.i.sort_order ?? 100) - (y.i.sort_order ?? 100) || x.i.name.localeCompare(y.i.name);
const TOP = 4;
// R-039 (Nate 9/22: "the list is way too long"): the four most important issues across the chosen categories come
// first, then three more in each category, and nothing else on this screen. The rest stay in Find, and later visits
// can suggest them.
export const TOP_PICKS = 4;
export const PER_CAT = 3;
export const catScore = rows => rows.slice(0, TOP).reduce((n, x) => n + x.score, 0);
// The six categories, most important first (R-018's categories; if they did not load, the old six from topics.js
// stand in, counted by bills, so the screen still works).
function catList() {
  if (!S.cats.length) return topics(poolBills().filter(supports)).map(t => ({ ...t, count: t.bills, fallback: true, rows: [], score: 0 }));
  const R = ranker();
  return S.cats.map(c => { const iss = issuesIn(c.key).filter(inPlay), rows = iss.map(i => issueInfo(i, R)).sort(byScore);
    return { key: c.name, topicKey: c.key, names: [c.key], icon: c.icon, description: c.description, issues: iss, count: iss.length,
      wins: rows.filter(x => x.law).length, rows, score: catScore(rows) }; })
    .sort((a, b) => b.score - a.score || (b.count || 0) - (a.count || 0));
}
const topicList = catList;
// The picks on screen 1 are categories (R-018).
export const pickedIssues = () => { const sel = new Set(wiz().issues || []); return topicList().filter(i => sel.has(i.key) || i.names.some(n => sel.has(n))); };

// ================= Your issues, 1: what do you care about? =================
// Six tiles, most important first (Nate 9/21), each saying what is in play: in session the issues still moving,
// between sessions the wins of last session (or its issues).
const SURE1 = 'About 4 minutes. Free, and no account needed.';
// What the app does, said on the first screen (R-067, Nate's pick 9/27, Version A): testers liked the first visit but
// were confused about what it is, and the only plain description was on the finale. In session only; between sessions
// the screen already leads with the opening day.
// The version that ends on Home (R-098) says the home page shows it: "we tell you" sold an alert service, so testers
// took the email as the end of it. Since R-099 (Nate's go 10/3) that version also says how, not only when: the person is
// the one who speaks up, and the app helps them do it ("an active tool rather than just an alert system"). Today's version
// keeps its words, so the ending test (R-135) compares the two first visits whole.
const promise = () => `<ol class="st-promise" role="list" aria-label="What happens next"><li>${icon('eye')}<span>We keep watch</span></li><li>${icon(endHome() ? 'notebook-pen' : 'bell')}<span>${endHome() ? 'When it’s time, we help you speak up' : 'We tell you when it’s your moment'}</span></li><li>${icon('circle-check')}<span>You see what happened</span></li></ol>`;
function tiles(off, yr) {
  // Between sessions the tiles count last session's wins, which live in the recap pool. It used to load only on
  // screen 2, so a newcomer never saw a win here, and the tiles reordered under their finger on Back (R-067). Hold
  // the six tiles for the moment it takes; if it fails they fall back to issue counts.
  if (off && !(S.recapPool && S.recapPool.yr === yr) && S.recapFailed !== yr) {
    if (C) C.ensureRecapPool(yr);   // once the bill-level code is in (wire() asks for it right after this paint)
    return `<div class="st-tiles" aria-busy="true" aria-label="Loading">${'<div class="skel" style="min-height:176px"></div>'.repeat(6)}</div>`;
  }
  const sel = new Set(wiz().issues || []);
  return `<div class="st-tiles" role="group" aria-labelledby="st-h">${catList().map(i => {
    const on = sel.has(i.key) || i.names.some(n => sel.has(n));
    const meta = i.fallback ? plural(i.count || 0, 'bill') : off ? (i.wins ? `${plural(i.wins, 'win')} in ${yr}` : `${plural(i.count, 'issue')} in ${yr}`) : `${plural(i.count, 'issue')} moving`;
    return `<button type="button" class="st-issue st-tile" data-stissue="${esc(i.names[0])}" aria-pressed="${on}">
      <span class="st-ilead">${icon(i.icon)}</span><span class="st-tick" aria-hidden="true">${icon('check')}</span>
      <span class="st-iname">${esc(i.key)}</span>${i.description ? `<span class="st-idesc">${esc(i.description)}</span>` : ''}<span class="st-icount">${esc(meta)}</span></button>`;
  }).join('')}</div>`;
}
// Someone who came from a partner's link or flyer (?via=slug) is welcomed in that partner's words, once, above the
// heading (the line staff wrote in Staff v2; nothing when there is none).
S.stWelcome ??= undefined;
function partnerLine() {
  const via = visitVia(); if (!via) return '';
  if (S.stWelcome === undefined) { S.stWelcome = null; partnerWelcome(via).then(t => { if (t) { S.stWelcome = t; app.render(); } }).catch(() => {}); }
  return S.stWelcome ? `<p class="st-partner">${icon('sparkles')}<span>${esc(S.stWelcome)}</span></p>` : '';
}
function stepTopics(step) {
  const si = sessionInfo(), off = si.phase !== 'in', yr = off ? si.recapYear : si.yr;
  const next = si.nextOpen ? +si.nextOpen.slice(0, 4) : yr + 1;
  const w = off && C ? C.winsIn(yr) : null;   // between sessions, the proof it works (R-067); said once core.js is in
  return shell('st1 st-topics', `${topRow('topics', step)}${partnerLine()}${artFor('topics')}
    <h1 class="hero" id="st-h">${off ? `Get ready for the ${next} session` : 'Speak up for a healthier Hawaiʻi'}</h1>
    <p class="lede">${off ? `The Legislature opens ${esc(shortDay(si.nextOpen))}.${w && w.length ? ` In ${yr}, ${w.length} ${w.length === 1 ? 'bill' : 'bills'} HIPHI backed became law.` : ''} ${endHome() ? 'Pick what you care about. When your voice can count, you’ll see what to do, and we’ll help you do it.' : 'Pick what you care about, and we’ll tell you when your voice can count.'}`
      : `HIPHI follows the health bills at the Hawaiʻi Legislature. ${endHome() ? 'Pick what you care about.' : 'Pick what you care about, and we’ll tell you when a few minutes of your time can help get bills passed.'}`}</p>${off ? '' : promise()}${sureWide('clock', SURE1)}`,
    `${sayRow('clock', SURE1)}${tiles(off, yr)}`);
}

// ================= Your issues, 2: the issues inside them =================
// Each category picked on screen 1 opens to its issues, most important first: the top four, the rest behind "Show N
// more issues" (Nate 9/21). What gets saved is the issue itself, so its bills - this session's, later ones, next
// session's - reach the person without them doing anything more. Only the four shown can start ticked, so nothing is
// followed unseen: HIPHI's strongly supported and staff-recommended ones among them, else the most important one. One
// "Follow all" per category, which also brings issues HIPHI takes up there later (R-018).
export const skel = (step, said = 'Finding HIPHI’s issues for you') => shell('', `<p class="sr" role="status">${said}</p>
  <div class="skel" style="height:34px;width:80%"></div><div class="skel" style="height:64px"></div>`, '<div class="skel" style="height:128px"></div>'.repeat(3), true);
export const loadErr = step => shell('', `${topRow('issues', step)}`, `<div class="empty st-err"><h1 class="st-errh" id="st-h">We couldn’t load the issues</h1><p>Check your connection and try again.</p></div>`);
const LEARN = ['story', 'bill', 'session', 'hearing'];
const STEPS = ['issues', 'bill', 'voice', 'you', 'soon', 'done', 'followask'];   // the steps start-rest.js draws
export const learnName = route => LEARN.includes(route.lesson) ? route.lesson : 'bill';
export function mailSent() {
  if (!S.stMail.sent) { try { S.stMail.sent = sessionStorage.getItem('hiphi_link_sent') || ''; } catch { /* ignore */ } }
  return S.stMail.sent;
}
export function viaIssueOf() { const b = REST ? REST.exampleBill() : null; return b ? issuesOf(b).find(shown) || issuesOf(b)[0] || null : null; }
export const viaFollowed = () => { const b = REST ? REST.exampleBill() : null, i = viaIssueOf(); return !!b && (i ? issueFollowed(i) : S.watch.has(b.id)); };
export function flash(text) {
  const el = document.getElementById('st-alert'); if (!el) return;
  el.innerHTML = `${icon('circle-alert')}<span>${esc(text)}</span>`;
  const box = el.closest('.st-say'); box.classList.add('st-alerting');
  const r = box.getBoundingClientRect();
  if (r.top < 64 || r.bottom > window.innerHeight - 96) box.scrollIntoView({ block: 'center', behavior: reduced() ? 'auto' : 'smooth' });
}
export function clearFlash() {
  const el = document.getElementById('st-alert'); if (!el || !el.innerHTML) return;
  el.innerHTML = ''; el.closest('.st-say').classList.remove('st-alerting');
}
function toggleTick(el) {
  const on = el.getAttribute('aria-pressed') !== 'true';
  el.setAttribute('aria-pressed', String(on));
  el.closest('.st-pcard')?.classList.toggle('on', on);
  const t = el.querySelector('.st-tick'); if (t && on && !reduced()) { t.classList.remove('st-draw'); void t.offsetWidth; t.classList.add('st-draw'); }
  return on;
}
// Follow what is ticked on the issues screen. Coming back to it and unticking undoes what this screen followed a moment
// ago, and nothing else, so "Follow 7 issues" always ends with exactly those.
export const busy = (el, label) => { if (!el) return; el.setAttribute('aria-busy', 'true'); el.innerHTML = `${icon('loader-circle')}${label ? `<span>${esc(label)}</span>` : ''}`; };

// Where a step cannot be shown, where to go instead.
function redirectFor(step, off) {
  const n = nameAt(step, off), T = total(off);
  if (step > T) return T;
  if (wiz().via) return n === 'followask' && (viaFollowed() || wiz().viaSkipAsk) ? step + 1 : 0;
  if (n === 'issues') return pickedIssues().length ? 0 : stepOf('topics', off);
  return 0;
}

// A lesson on its own: Next walks it; after its last step the button says Done and goes back where they came from.
// The story's three stages: its button says Next, then Done on the last stage; Back steps back a stage before it leaves.
// The page can be drawn again while it is open (its bill's hearings landing): the story then keeps its stage.
function wire(route) {
  // After this screen's own paint: the rest of the first visit, the bill-level code and the lessons (R-122).
  if (!REST || !C || !LZ) setTimeout(() => Promise.all([restLoad(), coreLoad()]).then(() => { if (!LZ) lessonsLoad().catch(() => {}); app.render(); }).catch(e => console.error(e)), 400);
  if (route.name === 'learn') { if (REST) REST.wireLearn(route); return; }
  const step = route.step || 1, off = isOff(), name = nameAt(step, off);
  const $ = s => document.querySelector(s), $$ = s => document.querySelectorAll(s);
  const to = redirectFor(step, off);
  if (to) { setTimeout(() => app.go('#/start/' + to, { replace: true }), 0); return; }
  if (wiz().step !== step) wizSet({ step });
  const back = !!S.stBack; S.stBack = false;
  // The lesson pages put their button right under the lesson on a wide screen (start.css).
  document.body.classList.toggle('st-lessonpage', name === 'bill');
  document.body.classList.toggle('st-onecol', name === 'followask');
  const key = `${pathKey()}|${name}`, fresh = key !== viewKey;
  if (fresh) {
    viewKey = key; viewAt = Date.now(); tickChapter(name, back);
    track(name, 'view', name === 'done' ? { counts: { issues: followedIssues().length, stances: Object.values(S.stances || {}).filter(v => v === 'support' || v === 'oppose').length,
      address: !!S.stAddr.pick, email: !!mailSent() } } : {});
  }
  const next = () => { track(name, 'next'); goStep(step, step + 1); };

  // Skip always means "go to the next page" (HANDOFF 3.5).
  $$('[data-stskip]').forEach(el => el.onclick = () => {
    track(name, 'skip');
    // Nothing picked on the first screen: the issues screen needs a pick, so Skip goes on to the story, which uses one
    // of HIPHI's bills (R-019: Skip must never lead back to where it started).
    // (It named the lesson's step, which the short version does not have, so there Skip went to #/start/0, the first
    // screen again; now it is simply the screen after the issues: the story, or the short version's one page.)
    if (name === 'topics' && !pickedIssues().length) { LZ?.lessonStop(); swap(() => app.go('#/start/' + (stepOf('issues', off) + 1)), 'fwd'); return; }
    // Skip on "Your issues" follows nothing (the approved prototype; C-4: nothing is followed without a yes). It used to
    // follow whatever was ticked, which with HIPHI's picks ticked for them followed several issues nobody chose (the
    // review, 9/21). Home asks again later, once.
    if (name === 'issues') { if (!followsAnything()) nudge('follow'); goStep(step, step + 1); return; }
    if (name === 'soon' || name === 'you') LZ?.lessonStop();
    goStep(step, step + 1);
  });
  // Back leaves the screen (B-4). The story walks back through its stages first (lessonPrev).
  $$('[data-stback]').forEach(el => el.onclick = () => { if (name === 'bill' && LZ?.lessonPrev('story')) return; goBack(+el.dataset.stback); });
  $$('[data-stretry]').forEach(el => el.onclick = async () => { S.recapFailed = null;
    if (!S.issues.length) { try { await loadCatalog(); recomputeWatch(); } catch (e) { console.error(e); } }
    app.render(); });
  $$('[data-stdone]').forEach(el => el.onclick = () => finish());
  $$('[data-sthome]').forEach(el => el.onclick = () => { track(name, 'skip'); LZ?.lessonStop(); finish(); });   // R-114: after acting from a link, Home now
  wireShareLine(document); wireKeepLine(document);

  if (name === 'topics') {
    $$('[data-stissue]').forEach(el => el.onclick = () => {
      const on = toggleTick(el), set = new Set(wiz().issues || []), nm = el.dataset.stissue;
      const t = topicList().find(i => i.names.includes(nm) || i.key === nm);
      (t ? [t.key, ...t.names] : [nm]).forEach(n => set.delete(n));
      if (on) set.add(nm);
      wizSet({ issues: [...set] }); clearFlash();
    });
    const nb = $('[data-stnext]');
    if (nb) nb.onclick = () => {
      if (!pickedIssues().length) { flash('Pick at least one, or select Skip.'); return; }
      track(name, 'next', { counts: { cats: pickedIssues().length } });
      goStep(step, stepOf('issues', off));
    };
  }

  if (name !== 'topics' && REST) REST.wireStep(name, { step, off, back, fresh, next, $, $$ });

}

const TITLE = { topics: 'What do you care about?', issues: 'Your issues', bill: LESSON_TITLES.story,
  you: 'Who speaks for you', soon: 'Coming up on your issues', done: 'You’re all set', followask: 'Follow this issue?', voice: 'Why your voice matters' };
// The steps after the topics, wired (start-rest.js). ctx: the step, the flow, Back, whether the screen is new, the
// next() helper and the page's two query helpers from wire().
export default {
  tab: 'home',
  tabs: false,
  // The first visit's A/B versions are fixed as it starts (variant.js lockFirstVisit, R-135), before anything asks which.
  title: route => route.name === 'learn' ? LESSON_TITLES[learnName(route)] : (lockFirstVisit(), TITLE[nameAt(route.step || 1, isOff())] || 'Get started'),
  render(route) {
    if (route.name === 'learn') return restAsk() ? REST.stepLearn(route) : skel(1);
    lockFirstVisit();
    const step = route.step || 1, off = isOff();
    if (redirectFor(step, off)) return skel(Math.min(step, total(off)));   // wire() sends them on
    const name = nameAt(step, off);
    if (name === 'topics' || !STEPS.includes(name)) return stepTopics(step);
    return restAsk() ? REST.renderStep(name, step) : skel(step);   // the rest of the first visit, once it is in
  },
  wire,
  bar(route) {
    // A lesson on its own: Next, and on the story's last stage Done (wireLearn changes the words), which goes back where
    // it was opened.
    if (route.name === 'learn') return bar1('Next', 'arrow-right', { 'data-stlearnnext': '1' });
    const step = route.step || 1, off = isOff();
    if (redirectFor(step, off)) return '';
    const name = nameAt(step, off);
    if (name === 'topics') return bar2('Next', { iconEnd: 'arrow-right' });
    return REST ? REST.barStep(name, step, off) : '';
  },
};
