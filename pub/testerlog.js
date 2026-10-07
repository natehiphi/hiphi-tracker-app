// What testers do (R-193, Nate 10/6: "We also should start tracking testers actions beginning now"). His answers: who
// counts, "Tester-sheet links" (anyone who starts from a tester sheet's link or QR code, in the practice copy or on the live
// site, links printed before this included; staff looking around the practice copy on their own are not counted); how
// much, "Each tester's path" (one anonymous step-by-step path per tester: which screens, in what order, the seconds on
// each, and what they did). Backend migration 150: tester_paths, written only through log_tester_path.
//
// A tester session starts on a tester-sheet link: &t=<sheet>-<group> since R-193; before it, any link that set versions
// (?ab=, and the testers' older ?end=, ?fv=, ?rank) without &abrest (the tester sheet's own links until 6 Oct). Tests' See
// it and compare.html carry &abrest and no &t, so Nate's own looks are not counted. The session lasts the tab (sessionStorage:
// hiphi_tester, hiphi_tester_demo in the practice copy), so the practice copy's Next day carries on the same path and
// &restart (a new scan of the code) starts a new one.
// Kept: a random id made here (no account, no name), the sheet and group, the versions the link set, practice or live, the
// device kind, the screens in order with their seconds (paused while the tab is hidden) and running totals of what they
// did. Never anything typed, never a number or an email. Nothing under the privacy signal (Global Privacy Control, Do Not
// Track) or from an automated test run, as for every count (visitlog.js). Testers are told on their page of the sheet,
// and the practice copy's band says it while it records.
// Kernel-only on purpose: app.js, visitlog.js and variant.js (the first wave) import it.
import { S, DEMO, SUPABASE_URL, SUPABASE_KEY } from './kernel.js';

const q = new URLSearchParams(location.search);
const T = /^([a-z0-9]{4,12})-([a-z0-9]{2,8})$/.exec(q.get('t') || '');
const viaLink = !!T || (!q.has('abrest') && (q.has('ab') || ['home', 'today'].includes(q.get('end')) || ['short', 'full'].includes(q.get('fv')) || q.has('rank')));
const quiet = (() => { try {
  return navigator.globalPrivacyControl === true || navigator.doNotTrack === '1' || window.doNotTrack === '1'
    || ((navigator.webdriver === true || /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)) && window.__hiphiCountTests !== true);
} catch { return true; } })();
const KEY = 'hiphi_tester';
const read = () => { try { return JSON.parse(sessionStorage.getItem(KEY) || 'null'); } catch { return null; } };
const write = s => { try { sessionStorage.setItem(KEY, JSON.stringify(s)); } catch { /* this page load only */ } };
const newId = () => { try { if (crypto.randomUUID) return crypto.randomUUID(); } catch { /* older browsers */ }
  const b = crypto.getRandomValues(new Uint8Array(16)); b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
  const h = [...b].map(x => x.toString(16).padStart(2, '0')).join(''); return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`; };
const device = () => { const w = window.innerWidth || document.documentElement.clientWidth || 0; return w < 600 ? 'phone' : w < 1024 ? 'tablet' : 'laptop'; };
// The versions the link set, as one short line: "onb.p1,layout.a" (the testers' older ?end=, ?fv=, ?rank written the same way).
function versionsOf() {
  const parts = (q.get('ab') || '').split(',').filter(x => /^[a-z0-9-]{1,20}\.[a-z0-9-]{1,20}$/.test(x));
  if (['home', 'today'].includes(q.get('end'))) parts.push('end.' + q.get('end'));
  if (['short', 'full'].includes(q.get('fv'))) parts.push('fv.' + q.get('fv'));
  if (q.has('rank')) parts.push(q.get('rank') === '0' ? 'rank.today' : 'rank.ranked');
  return parts.join(',').slice(0, 300);
}

let sess = null;
try {
  const kept = read();
  if (!quiet && (viaLink || kept)) {
    sess = kept && (!T || (kept.sheet === T[1] && kept.grp === T[2])) ? kept
      : { id: newId(), sheet: T ? T[1] : null, grp: T ? T[2] : null, versions: versionsOf(), place: DEMO ? 'practice' : 'live', day: q.get('day') || 'mon', did: {} };
    // The practice copy's Next day reloads on a later day: the same tester, one more day (app.js nextDay).
    const day = q.get('day') || 'mon'; if (DEMO && sess.day !== day) { sess.did.nextday = (sess.did.nextday || 0) + 1; sess.day = day; }
    write(sess);
  }
} catch { sess = null; }
// The practice copy's band says so while it records (app.js).
export const testerActive = () => !!sess;

// ---- what they did ----
let changed = !!sess;
// The kinds come from visitlog.js (an action marked done: testimony, email, share, attend ...), variant.js (finished the
// first visit, gave a number or email) and the first visit's own steps (a step skipped).
export function tlNote(kind) {
  if (!sess || !/^[a-z0-9_]{1,30}$/.test(kind || '')) return;
  sess.did[kind] = Math.min(500, (sess.did[kind] || 0) + 1); changed = true; write(sess);
}
// Once is enough for these: finished the first visit, gave a number or email (variant.js abEvent).
export function tlMark(kind) { if (sess && !sess.did[kind]) tlNote(kind); }
// The first visit's screens are named by their step (start.js logs a view of each), not by their number in the address.
let fvStep = '';
export function tlStep(step, event) {
  if (!sess) return;
  if (event === 'view') fvStep = String(step || '');
  else if (event === 'skip') tlNote('skipped_' + String(step || '').replace(/[^a-z0-9_]/g, '').slice(0, 20));
}

// ---- the screens, in order, with their seconds ----
const clean = s => String(s).toLowerCase().replace(/[^a-z0-9/:._-]+/g, '-').slice(0, 80);
function screenKey() {
  const h = decodeURIComponent(location.hash || '#/').replace(/^#\/?/, '').split('?')[0], seg = h.split('/').filter(Boolean);
  let k = !seg.length ? 'home' : seg[0] === 'start' ? (fvStep ? `start:${fvStep}` : `start/${seg[1] || 1}`) : seg.slice(0, 3).join('/');
  // A sheet over the page: the walkthrough by its kind and step ("bill/hb1780:testimony:know"), any other by its name.
  const dlg = document.querySelector('dialog[open]');
  if (dlg) { const x = S.helper; k += dlg.id === 'hp-dlg' && x ? `:${x.mode || 'helper'}:${x.screen || ''}` : `:${dlg.id || String(dlg.className || '').split(' ')[0] || 'sheet'}`; }
  return clean(k);
}
let cur = null; const pending = [];
const close = () => { if (cur) { pending.push([cur.key, Math.round((Date.now() - cur.t0) / 1000)]); cur = null; changed = true; } };
let follows = -1;
function tick() {
  if (!sess || document.visibilityState === 'hidden') return;
  const k = screenKey();
  if (!cur || cur.key !== k) { close(); cur = { key: k, t0: Date.now() }; }
  // A follow from anywhere: the count of what they follow going up (issues, whole topics, bills on their own).
  const n = (S.issueFollows?.size || 0) + (S.catFollows?.size || 0) + (S.direct?.size || 0);
  if (follows >= 0 && n > follows) { sess.did.followed = Math.min(500, (sess.did.followed || 0) + (n - follows)); changed = true; write(sess); }
  follows = n;
}

// ---- sending: a few steps at a time, and what is left as the tab closes ----
function flush() {
  if (!sess || !changed) return;
  try {
    do {
      const steps = pending.splice(0, 60);
      fetch(`${SUPABASE_URL}/rest/v1/rpc/log_tester_path`, { method: 'POST', keepalive: true, headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p: { id: sess.id, sheet: sess.sheet, grp: sess.grp, versions: sess.versions, place: sess.place, device: device(), steps, did: sess.did } }) }).catch(() => {});
    } while (pending.length);
    changed = false;
  } catch { /* never in the way */ }
}
if (sess) {
  setInterval(tick, 1000);
  setInterval(flush, 10000);
  setTimeout(() => { tick(); flush(); }, 1500);   // the path exists from the first screen
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') { close(); flush(); } else tick(); });
  window.addEventListener('pagehide', () => { close(); flush(); });
}
