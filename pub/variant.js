// The versions of the public page under test, and how a browser gets one (R-121 the process; R-135, Nate 10/3: several
// tests at once, "turned on or off by me in my staff settings", "by default at random", "each different test should
// easily be tracked by effectiveness"). The plan: ../backend/docs/AB-TESTS-PLAN.md; the process: AB-TESTING.md.
//
// The tests (the first version of each is today's; the database's ab_tests, migration 116, holds the same keys and
// versions with the switches staff flip in Staff v2 > Session setup > Tests):
//   end    the first visit's ending: "You're all set" | ends on Home with "What you can do right now" (R-098)
//   fv     the first visit's length: the lesson | one page, "Your voice counts here" (R-067 #11)
//   rank   after testimony: no main button | the next strongest step leads (R-005)
//   email  the email ask: in the first visit | not in it, first asked after an action or on coming back
//   share  the share message: what the bill does first | the deadline first
//   home   Home's top: the soonest deadline first | grouped by your issues
//   onb    the first visit itself (R-164, 10/5): today's | Plan 1 start with one bill | Plan 2 a bill's journey | Plan 3 meet
//          your people | Plan 4 how do you like to help | Plan 5 a light start. Six versions, each with its own switch
//          (ab_tests.arms_on, backend 136; Nate: "a switch per version"); a new visitor is spread evenly over the ones that
//          are on. While a plan runs, the three tests inside today's first visit (end, fv, email) are not met or counted:
//          the plan replaces the screens they compare.
//   join   the plans' alerts sign-up (R-164, backend 138): an example text shown | "we watch, you speak". Met only on a
//          plan's sign-up screen (pub/onb.js), never on today's first visit.
//   save   the ask for a number or email (R-184, backend 148): "Save your profile", the first thing seen after a follow or
//          a letter | the "Get alerts" ask as it was before 6 Oct. The other way round from the rest: the FIRST version is
//          the new one, which everyone gets while the test is off (Nate 10/6: "Replace, leave the current method as an
//          alternative backup that could be tested later"). Met wherever the two differ on screen (alerts.js saveArm).
//   layout Home, the bill page and the tabs (R-187, backend 149; Nate 10/6: "put it on the A/B testing now"): today's |
//          version A (R-070 Layout A, R-071): Now · Since · This week day by day · Where your issues stand; the bill page
//          opens on where the bill is; tabs Home · My issues · Find · You (pub/a/). Met the first time the two differ on
//          screen: a bill page, or Home in session with something followed after the first visit (app.js). While a browser
//          is on version A, the Home's-top test is not met or counted: version A replaces the Home it compares.
//
// How a browser gets a version:
//   the coin toss   the first time a browser opens the tracker it gets one version of every test, each by its own toss,
//                   half and half, and keeps them (hiphi_ab). A test that is off shows everyone its fallback (today's,
//                   unless staff picked another); its toss is kept for when it is on again.
//   the lock        a first-visit test (end, fv, email) keeps the version the first visit started with, so a switch
//                   flipped mid-visit never changes a visit under way; end and fv keep it for good (Home's welcome reads it).
//   the link        ?ab=home.by-issue (several: ?ab=end.home,fv.short), and the testers' older ?end=, ?fv=, ?rank, set a
//                   version and mark it forced: counted apart, never in the comparison (a tester is not the public).
//                   &abrest=today also sets every test the link does not name to today's version (the tester sheet, the
//                   compare page and Tests' See it: a group sees exactly what its card says, whatever the switches, R-192).
//   the practice copy (R-192, Nate 10/6: "These changes should impact how the experience is for public users in the
//                   sandbox"; his answers: the real switches, a random pick): ?demo=1 reads the same switches and tosses the
//                   same way, kept for the practice visit (&restart, Start over, tosses again); nothing it does is counted.
//   no toss         automated browsers get today's version unless a link says otherwise (a page flag,
//                   window.__hiphiTossTests, lets tests/abtests.py watch the toss).
// The switches come from public_ab_tests, fetched by track.html alongside the catalog (window.__hiphiAB) and kept for the
// next visit; before any answer, the tests as built (all on but the email ask).
//
// What is counted (visitlog.js sends it, with the same privacy rules as every count, to log_ab): per test, "met it" once
// (the moment the versions differ on screen; a share test, every share) and each of its two measures once, within its
// window of days. No identifier leaves the browser; it remembers itself what it already sent.
import { DEMO, wiz, hstDay, SUPABASE_URL, SUPABASE_KEY } from './kernel.js';

// goal, goal2: [event, days]: the event that is the measure, and within how many days of meeting the test (0: any time).
export const TESTS = {
  end: { arms: ['today', 'home'], first: 'keep', goal: ['finished', 0], goal2: ['back', 14] },
  fv: { arms: ['full', 'short'], first: 'keep', goal: ['finished', 0], goal2: ['acted', 14] },
  rank: { arms: ['today', 'ranked'], goal: ['step2', 14], goal2: ['back', 14] },
  email: { arms: ['finale', 'after'], first: 'visit', goal: ['email', 14], goal2: ['back', 14] },
  share: { arms: ['summary', 'deadline'], rate: true },
  home: { arms: ['by-day', 'by-issue'], goal: ['acted', 7], goal2: ['back', 14] },
  onb: { arms: ['today', 'p1', 'p2', 'p3', 'p4', 'p5'], first: 'keep', goal: ['acted', 14], goal2: ['back', 14], multi: true },
  join: { arms: ['shown', 'watch'], goal: ['email', 1], goal2: ['back', 14] },
  save: { arms: ['profile', 'alerts'], goal: ['email', 1], goal2: ['back', 14] },
  layout: { arms: ['today', 'a'], goal: ['back', 14], goal2: ['acted', 14], page: true },
};
const BUILT = { end: true, fv: true, rank: true, email: false, share: true, home: false, onb: false, join: false, save: false, layout: true };
// The tests that compare screens of today's first visit: a browser on one of the plans never meets them (R-164).
const INSIDE_TODAY = ['end', 'fv', 'email'];
const KEY = 'hiphi_ab', CFG = 'hiphi_ab_cfg';
const BOT = (() => { try { return navigator.webdriver === true && window.__hiphiTossTests !== true; } catch { return false; } })();
const today = () => hstDay(Date.now());
const days = (a, b) => Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 864e5);

// ---- this browser's versions and what it has counted ----
let mem = null;
const st = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null') || mem || {}; } catch { return mem || {}; } };
const save = s => { mem = s; try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* this page load only */ } };

// ---- the switches ----
let cfg = null;
const cached = () => { try { const c = JSON.parse(localStorage.getItem(CFG) || 'null'); return c && typeof c === 'object' ? c : null; } catch { return null; } };
// A test the database does not list, or lists with other versions than this code has, is off: a migration can never
// switch on a version the page cannot draw.
function applyRows(rows) {
  if (!Array.isArray(rows)) return;
  const c = {};
  for (const r of rows) { const t = TESTS[r?.key]; if (!t || !Array.isArray(r.arms) || r.arms.join() !== t.arms.join()) continue;
    const on = Array.isArray(r.arms_on) ? r.arms_on.filter(a => t.arms.includes(a)) : null;
    c[r.key] = { on: r.is_on === true, fallback: t.arms.includes(r.fallback) ? r.fallback : t.arms[0], arms: on && on.length ? on : null }; }
  cfg = c; try { localStorage.setItem(CFG, JSON.stringify(c)); } catch { /* this page load only */ }
}
const cfgOf = key => { const c = cfg || cached(); return c ? c[key] || { on: false, fallback: TESTS[key].arms[0] } : { on: BUILT[key], fallback: TESTS[key].arms[0] }; };
// The versions a new visitor can get: every version of a two-version test, and of a multi one those switched on.
const armsOn = key => { const t = TESTS[key], c = cfgOf(key); return t.multi && c.arms ? c.arms : t.arms; };
let settled = false;
// The practice copy too (R-192): track.html's early fetch is skipped there, so this asks; a read of a few public rows.
export const abReady = (window.__hiphiAB
  || fetch(`${SUPABASE_URL}/rest/v1/public_ab_tests?select=key,arms,is_on,fallback,arms_on&apikey=${SUPABASE_KEY}`).then(r => r.ok ? r.json() : Promise.reject(new Error('ab ' + r.status))))
  .then(applyRows, () => { /* the switches kept from the last visit, or the tests as built */ }).finally(() => { settled = true; });
// The first screen waits for the switches at most this long, and not at all when it has them from a last visit; they
// come in the same moment as the catalog, which it waits for anyway (R-122).
export const abSettled = (ms = 300) => settled || cached() ? Promise.resolve() : Promise.race([abReady, new Promise(r => setTimeout(r, ms))]);

// ---- which version ----
export function isForced(key) { try { return !!st().forced?.[key] && TESTS[key]?.arms.includes(st().arms?.[key]); } catch { return false; } }
const firstOpen = () => { const w = wiz(); return !(w.done || w.skipped); };
// A test that swaps whole screens (page: true, the layout test) keeps one version for the rest of the page load from the
// first time it is asked with switches it can trust (the ones kept from the last visit, or the database's answer), so a
// switch flipped meanwhile, or an answer that differs from last visit's, never swaps Home or the bill page under a finger:
// it takes effect at the next page load.
const pinned = {};
export function armOf(key) {
  const t = TESTS[key]; if (!t) return null;
  if (t.page) { if (pinned[key]) return pinned[key]; const a = arm0(key, t); if (settled || cached()) pinned[key] = a; return a; }
  return arm0(key, t);
}
function arm0(key, t) {
  try {
    const s = st(), a = s.arms?.[key];
    if (s.forced?.[key] && t.arms.includes(a)) return a;
    // A plan of the first-visit test replaces the screens these tests compare: today's version of each (R-164).
    if (INSIDE_TODAY.includes(key) && onPlan()) return t.arms[0];
    if (BOT) return t.arms[0];
    const lock = s.lock?.[key];
    if (lock && t.arms.includes(lock) && (t.first === 'keep' || firstOpen())) return lock;
    const c = cfgOf(key);
    if (!c.on) return c.fallback;
    // A multi-version test keeps a number from the toss rather than a version, so a new visitor is spread evenly over
    // whichever versions are switched on when their first visit starts (the lock keeps it from then on).
    if (t.multi) { const on = armsOn(key), u = typeof s.u?.[key] === 'number' ? s.u[key] : 0; return on[Math.min(on.length - 1, Math.floor(u * on.length))]; }
    return t.arms.includes(a) ? a : t.arms[0];
  } catch { return t.arms[0]; }
}
// Counted only when the version came from the toss of a test that is on, or from a tester's link; never a test inside
// today's first visit while the browser is on a plan (R-164).
const counted = key => (INSIDE_TODAY.includes(key) && onPlan()) || (key === 'home' && armOf('layout') === 'a') ? false : isForced(key) || (!DEMO && !BOT && cfgOf(key).on);
// The plan this browser's first visit follows ('' for today's): Plan 1 to 5 of the first-visit test (R-164).
function onPlan() { try { const a = armOf('onb'); return a && a !== 'today' ? a : ''; } catch { return ''; } }
export const plan = onPlan;

// ---- sending (before the toss below, which may count a friend's arrival) ----
let sink = null; const waiting = [];
// visitlog.js hands over its sender as it loads (it imports this file, so the sender cannot be imported here).
export function setAbSink(fn) { sink = fn; if (waiting.length) fn(waiting.splice(0)); }
function emit(ev) { if (DEMO) return; if (sink) sink([ev]); else waiting.push(ev); }

// ---- the coin toss, the testers' links, and R-121's ending carried over, once as the page loads ----
function fromUrl() {
  const q = new URLSearchParams(location.search), out = {};
  for (const part of (q.get('ab') || '').split(',')) { const [k, a] = part.split('.'); if (TESTS[k]?.arms.includes(a)) out[k] = a; }
  if (['home', 'today'].includes(q.get('end'))) out.end = q.get('end');
  if (['short', 'full'].includes(q.get('fv'))) out.fv = q.get('fv');
  if (q.has('rank')) out.rank = q.get('rank') === '0' ? 'today' : 'ranked';
  // Everything the link does not name: today's version, so the link alone sets the path (R-192).
  if (q.get('abrest') === 'today') for (const [k, t] of Object.entries(TESTS)) if (!(k in out)) out[k] = t.arms[0];
  return out;
}
try {
  const s = st(); s.arms ??= {}; s.forced ??= {};
  if (!s.v) {   // R-121 kept the ending in the first visit's own state, and ?fv=short kept the short version there
    const w = wiz();
    if (TESTS.end.arms.includes(w.arm)) { s.arms.end = w.arm; if (w.forced) s.forced.end = true; } else if (w.end === 'home') { s.arms.end = 'home'; if (w.forced) s.forced.end = true; }
    if (w.fv === 'short') { s.arms.fv = 'short'; s.forced.fv = true; }
    s.v = 1;
  }
  for (const [k, a] of Object.entries(fromUrl())) { s.arms[k] = a; s.forced[k] = true; }
  if (!BOT) for (const [k, t] of Object.entries(TESTS)) {
    if (t.multi) { if (typeof s.u?.[k] !== 'number') (s.u ??= {})[k] = Math.random(); continue; }
    if (!t.arms.includes(s.arms[k])) { s.arms[k] = t.arms[Math.random() < 0.5 ? 0 : 1]; delete s.forced[k]; }
  }
  // A friend who came by a shared link that said which message brought them (?via=share-deadline): their arrival is the
  // share test's measure, credited once to that message.
  const via = /^share-([a-z0-9-]{1,20})$/.exec(new URLSearchParams(location.search).get('via') || '');
  if (via && TESTS.share.arms.includes(via[1]) && !s.arrived && !DEMO) { s.arrived = { arm: via[1], day: today() }; emit({ t: 'share', a: via[1], k: 'goal', f: false }); }
  save(s);
} catch { /* storage blocked: today's versions, nothing counted */ }

// ---- counting ----
// Met a test: the moment its versions differ on screen. Once per browser; a share test counts each bill shared once.
export function abSeen(key, { bill } = {}) {
  const t = TESTS[key]; if (!t || !counted(key)) return;
  try {
    const s = st(), arm = armOf(key), f = isForced(key);
    if (t.rate) { s.shared ??= {}; if (bill && s.shared[bill]) return; if (bill) s.shared[bill] = 1; save(s); emit({ t: key, a: arm, k: 'seen', f }); return; }
    if ((s.seen ??= {})[key]) return;
    s.seen[key] = { day: today(), arm, f }; save(s);
    emit({ t: key, a: arm, k: 'seen', f });
  } catch { /* never in the way */ }
}
// Something happened that may be a test's measure: 'finished' (the first visit), 'back' (a visit on a later day),
// 'acted' (an action marked done), 'email' (an email given), 'step2' (another step on a hearing where the rank test was
// met). Each test's measure is sent once, credited to the version it met, within its window.
export function abEvent(name) {
  try {
    const s = st(), t0 = today(); let changed = false;
    for (const [key, t] of Object.entries(TESTS)) for (const which of ['goal', 'goal2']) {
      const g = t[which], seen = s.seen?.[key]; if (!g || g[0] !== name || !seen) continue;
      const id = key + ':' + which, d = days(seen.day, t0); if (s.sent?.[id]) continue;
      if ((g[1] && d > g[1]) || (name === 'back' && d < 1)) continue;
      (s.sent ??= {})[id] = 1; changed = true;
      emit({ t: key, a: seen.arm, k: which, f: !!seen.f });
    }
    // The share test's second measure: the friend who came by a shared link acted within 14 days.
    if (name === 'acted' && s.arrived && !s.sent?.['share:goal2'] && days(s.arrived.day, t0) <= 14) {
      (s.sent ??= {})['share:goal2'] = 1; changed = true; emit({ t: 'share', a: s.arrived.arm, k: 'goal2', f: false });
    }
    if (changed) save(s);
  } catch { /* never in the way */ }
}

// ---- the tests' own moments ----
// The first visit started: its tests take the version they have now and keep it (the lock), and are met.
export function lockFirstVisit() {
  try {
    if (!firstOpen()) return;
    const s = st(); let changed = false;
    for (const [key, t] of Object.entries(TESTS)) if (t.first && !s.lock?.[key]) { (s.lock ??= {})[key] = armOf(key); changed = true; }
    // A newcomer from a shared bill follows today's link path whatever the plan test gave them, so they never meet it.
    if (changed) { save(s); for (const [key, t] of Object.entries(TESTS)) if (t.first && !(key === 'onb' && wiz().via)) abSeen(key); }
  } catch { /* never in the way */ }
}
// The rank test is met on a hearing where testimony is sent and another step is still open; another step later on any
// such hearing is its measure.
export function abRankMet(hearingId) {
  abSeen('rank');
  try { const s = st(); if (!s.seen?.rank) return; s.rankH ??= []; if (!s.rankH.includes(hearingId)) { s.rankH = [...s.rankH, hearingId].slice(-50); save(s); } } catch { /* ignore */ }
}
export function abStep(hearingId, kind) {
  try { if (kind !== 'testimony' && (st().rankH || []).includes(hearingId)) abEvent('step2'); } catch { /* ignore */ }
}
// The word a shared link carries, so a friend's arrival is credited to the message that brought them ('' when the share
// test is not running for this browser).
export const shareTag = () => counted('share') ? `share-${armOf('share')}` : '';

// R-121's names, kept: the ending, and the version word every private count carries (first_visit_events.variant,
// visit_counts.variant, migration 113).
export const endHome = () => armOf('end') === 'home';
// On a plan (R-164), the version word is the plan's ('p1' to 'p5'), so the First visit page's rows per version compare them.
export const variantInfo = () => onPlan() ? { variant: onPlan(), forced: isForced('onb') } : { variant: armOf('end'), forced: isForced('end') };
