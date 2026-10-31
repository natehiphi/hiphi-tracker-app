// The sending half of the first visit's counts (R-023, R-067, R-135 and the rest; the privacy rules and the story are in
// pub/visitlog.js, which every screen imports). Split from it for a phone's first wave (R-357 5c): that file stays small, and this
// one comes after the first screen is drawn. Nothing below changed in the split, only where it lives.
import { DEMO, SUPABASE_URL, SUPABASE_KEY, supa } from './kernel.js';
import { tlNote, tlStep } from './testerlog.js';   // a tester's path (R-193): the first visit's screens and what they did
import { variantInfo, setAbSink, abEvent } from './variant.js';
import { quiet, device, visit, write, SP, DEBUG } from './visitlog.js';

const CAP = 60;
// 'alerts' (R-146, accepted by the database since 121) was missing here, so the alerts screen was never counted; the
// plans' steps (R-164, backend 136) come after it.
const STEPS = new Set(['topics', 'issues', 'stand', 'bill', 'session', 'hearing', 'you', 'soon', 'done', 'home', 'arrive', 'act', 'followask', 'voice', 'alerts',
  'one', 'hello', 'join', 'wrap', 'story', 'road', 'island', 'way', 'first', 'picks', 'find', 'learn', 'decide']);
const EVENTS = new Set(['view', 'next', 'skip', 'back', 'leave', 'done', 'answer']);

// ---- what an event may carry, and only that ----
// A number out of its range is dropped, as the database drops it; only seconds are held to an hour, since a long stay
// on a screen is real.
const num = (x, lo, hi) => { if (typeof x !== 'number' || !Number.isFinite(x)) return undefined; const v = Math.round(x); return v >= lo && v <= hi ? v : undefined; };
function pick(step, event, x) {
  const out = {};
  if (['in', 'off', 'link'].includes(x.path)) out.path = x.path;
  const s = typeof x.seconds === 'number' && x.seconds > 3600 ? 3600 : num(x.seconds, 0, 3600); if (s !== undefined) out.seconds = s;
  const l = num(x.lesson_step, 0, 9); if (l !== undefined) out.lesson_step = l;
  if (['right', 'wrong', 'shown'].includes(x.quiz)) out.quiz = x.quiz;
  if (x.counts && typeof x.counts === 'object') {
    const c = {}, lim = { cats: 6, issues: 300, stances: 50 };
    for (const k of Object.keys(lim)) { const v = num(x.counts[k], 0, lim[k]); if (v !== undefined) c[k] = v; }
    // Yes/no only: whether an address, an email or a mobile number was given, never the thing itself. 'phone' was dropped
    // here until 10/5, so a text sign-up never counted as an alert sign-up though the database keeps it (backend 121; Z1-7).
    for (const k of ['address', 'email', 'phone']) if (typeof x.counts[k] === 'boolean') c[k] = x.counts[k];
    if (Object.keys(c).length) out.counts = c;
  }
  if (step === 'issues' && event === 'next' && Array.isArray(x.issue_ids)) out.issue_ids = [...new Set(x.issue_ids.filter(id => typeof id === 'string'))].slice(0, 300);
  return out;
}

// ---- sending: one request, no retry, no waiting ----
// "leave" is the tab closing (or the logo): the page may be gone before an ordinary request starts, so that one goes as a
// keepalive request, started at once, which the browser finishes after the page has closed. Only the public key goes
// with it: the function records no account either way.
function send(payload, leaving) {
  if (leaving) {
    return fetch(`${SUPABASE_URL}/rest/v1/rpc/log_first_visit`, { method: 'POST', keepalive: true, headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ p: payload }) })
      .then(r => r.ok, () => false);
  }
  return supa().then(sb => sb.rpc('log_first_visit', { p: payload })).then(r => !r.error, () => false);
}

// Resolves to true when the row was sent, false when it was not (Global Privacy Control, the sandbox, the cap, a bad
// step or event, no network). Never rejects, so nobody has to catch it; nobody has to wait for it either.
export function logVisit(step, event, extra = {}) {
  try {
    tlStep(step, event);
    if (quiet()) return Promise.resolve(false);
    if (!STEPS.has(step) || !EVENTS.has(event)) { console.warn('logVisit: not a first-visit step or event:', step, event); return Promise.resolve(false); }
    const v = visit();
    if (v.n >= CAP) return Promise.resolve(false);
    const payload = { visit: v.id, step, event, ...variantInfo() };   // the version this browser has (R-121)
    for (const [k, val] of Object.entries(v.src || {})) if (val) payload[k] = val;
    Object.assign(payload, pick(step, event, extra || {}));
    if (DEMO) { if (DEBUG) console.debug('first visit (sandbox, not sent):', payload); return Promise.resolve(false); }
    v.n += 1; write(v);
    return send(payload, event === 'leave').catch(() => false);
  } catch { return Promise.resolve(false); }
}

// The partner's welcome line ("Welcome, friends of ..."), or null: no such partner, no line, or no network. Asked once
// per slug per page load. The sandbox never asks the database: it shows a made-up line so the screen can be seen.
const welcomes = new Map();
export function partnerWelcome(slug) {
  const s = String(slug || '').toLowerCase();
  if (!/^[a-z0-9-]{2,40}$/.test(s) || s === 'share' || s === 'text') return Promise.resolve(null);   // ?via=share is a friend's link, not a partner (R-114); ?via=text is HIPHI's own text (R-299)
  if (DEMO) return Promise.resolve(`Welcome, friends of ${s.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ')}!`);
  if (!welcomes.has(s)) welcomes.set(s, supa()
    .then(sb => sb.from('public_partners').select('welcome').eq('slug', s).maybeSingle())
    .then(r => (!r.error && r.data && r.data.welcome) || null, () => null));
  return welcomes.get(s);
}

// ---- coming back, and acting (R-067; backend migration 078) ----
// Nate's first goal is that people come back. Once per Hawaiʻi day this browser sends one row: how long since its last
// visit, in bands, the month it was first seen, whether it follows anything, is signed in, was opened from the home
// screen, its ?via= slug, the device kind and whether the Legislature is in session. And one row per action marked
// done: only its kind. No id of any kind, no bill, no time of day. The browser keeps its own first month and last day
// (hiphi_days) so the band can be worked out; that pair never leaves the browser as anything finer than the band and
// the month. Nothing is sent under Global Privacy Control or Do Not Track, or from the sandbox.
const DAYS_KEY = 'hiphi_days';
const hiDay = (t = Date.now()) => new Date(t).toLocaleDateString('en-CA', { timeZone: 'Pacific/Honolulu' });   // 2026-09-27
const band = d => d <= 1 ? '1d' : d <= 7 ? '2-7d' : d <= 30 ? '8-30d' : d <= 90 ? '31-90d' : '91d+';
const homeScreen = () => { try { return matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; } catch { return false; } };
const sendCount = p => supa().then(sb => sb.rpc('log_visit_count', { p })).then(r => !r.error, () => false);
export function logDay({ follows = false, signedIn = false, season = 'in' } = {}) {
  try {
    if (DEMO || quiet()) return Promise.resolve(false);
    const today = hiDay();
    let mem = null; try { mem = JSON.parse(localStorage.getItem(DAYS_KEY) || 'null'); } catch { /* private mode: counted as new each day */ }
    if (mem && mem.last === today) return Promise.resolve(false);
    const gap = mem && mem.last ? band(Math.round((Date.parse(today) - Date.parse(mem.last)) / 864e5)) : 'new';
    if (gap !== 'new') abEvent('back');   // came back on another day: a measure of several A/B tests (R-135)
    const first = (mem && /^\d{4}-\d{2}$/.test(mem.first || '') ? mem.first : today.slice(0, 7));
    try { localStorage.setItem(DAYS_KEY, JSON.stringify({ first, last: today })); } catch { /* ignore */ }
    const src = visit().src || {};
    const p = { kind: 'visit', gap, first_month: first, follows: !!follows, signed_in: !!signedIn, home_screen: homeScreen(), season: season === 'in' ? 'in' : 'off', variant: variantInfo().variant };
    if (src.via) p.via = src.via; if (src.device) p.device = src.device; if (src.via === 'share' && src.sp) p.share_path = src.sp;
    return sendCount(p).catch(() => false);
  } catch { return Promise.resolve(false); }
}
// K1 (R-205): each action carries where this visit came from (?via=: 'share' for a friend's link, 'alert' for an alert, a
// partner's word), so the counts can say whether shared links lead to testimony. share_path: for a share, the way it was
// sent (sp); for any other action, the way the shared link that brought this visit was sent. Counts only, as before.
export function logAct(kind, { sp = '' } = {}) {
  try {
    tlNote(kind);
    // 'recap' and 'moment' (R-046, migration 106): the session page opened, a result shown as a moment. 'restore' and
    // 'calendar' (114) were filtered out here and refused by the table until migration 124, so neither was ever counted.
    // The five 'again_' kinds (R-148, 124): a saved letter offered again, sent again, the warning shown, updated, replaced.
    // R-153 (126): a saved email offered again and sent again, and the reminder to the same chair sent.
    // R-156 (130): titles or a story saved, a letter sent with titles or with the saved story, the ask "How you'll help"
    // chose shown and taken, and "Add to Home Screen" steps opened from the profile.
    // R-142 (134): 'directions', the map's directions to the Capitol opened by someone who plans to go to a hearing.
    // R-178 (142): reading the bill: 'bill_more' (Read more about the bill), 'bill_text' (the whole bill at the Capitol) and
    // 'bill_capitol' (the bill's Capitol page), from pub/billtext.js.
    if (DEMO || quiet() || !['email', 'legislators', 'intro', 'testimony', 'attend', 'share', 'recap', 'moment', 'restore', 'calendar',
      'again_open', 'again_sent', 'again_warned', 'again_fixed', 'again_new', 'mail_again_open', 'mail_again_sent', 'mail_reminder_sent',
      'profile_titles', 'profile_story', 'letter_titled', 'letter_story', 'ask_shown', 'ask_acted', 'home_how', 'directions',
      'bill_more', 'bill_text', 'bill_capitol'].includes(kind)) return Promise.resolve(false);
    if (['email', 'legislators', 'intro', 'testimony', 'attend', 'share'].includes(kind)) abEvent('acted');   // acted: a measure of several A/B tests (R-135)
    const src = (() => { try { return quiet() ? {} : visit().src || {}; } catch { return {}; } })();
    const p = { kind: 'act', act: kind, device: device(), variant: variantInfo().variant };
    if (src.via) p.via = src.via;
    const path = kind === 'share' ? sp : src.via === 'share' ? src.sp : '';
    if (SP.test(path || '')) p.share_path = path;
    return sendCount(p).catch(() => false);
  } catch { return Promise.resolve(false); }
}

// How long speaking up takes (R-169, backend migration 143; Nate 10/5: "Yes let's record the time."): the screens say
// testimony takes "a few minutes" and a chair's email "about 2 minutes", and this checks them. Only the kind, the seconds
// from opening the walkthrough to saying it was sent, whether it was the first testimony on this device, the device kind
// and the A/B version: no id, no bill, no time of day. Nothing under the privacy signal, from a test run or the sandbox.
export function logTime(act, seconds, firstTime) {
  try {
    if (DEMO || quiet() || !['testimony', 'email'].includes(act) || !(seconds >= 0)) return Promise.resolve(false);
    const p = { act, seconds: Math.min(Math.round(seconds), 3600), device: device(), variant: variantInfo().variant };
    if (act === 'testimony' && typeof firstTime === 'boolean') p.first_time = firstTime;
    return supa().then(sb => sb.rpc('log_act_time', { p })).then(r => !r.error, () => false);
  } catch { return Promise.resolve(false); }
}

// A later visit's one ask, a full page before Home (R-237, backend migration 170; Nate 10/11: "Yes keep track"): which ask,
// shown, done or "Not now", and how many Not nows came before (0 to 3), with the device kind and the A/B version: no id, no
// address, number, email or issue. Nothing under the privacy signal, from a test run, the team's browsers or the sandbox.
export function logAsk(ask, outcome, rests) {
  try {
    if (DEMO || quiet() || !['legs', 'alerts', 'issues', 'learn', 'share', 'phone'].includes(ask) || !['shown', 'done', 'no'].includes(outcome)) return Promise.resolve(false);
    const p = { ask, outcome, device: device(), variant: variantInfo().variant };
    if (rests >= 0 && rests <= 3) p.rests = rests;
    return supa().then(sb => sb.rpc('log_later_ask', { p })).then(r => !r.error, () => false);
  } catch { return Promise.resolve(false); }
}

// ---- the A/B tests' counts (R-135, backend migration 116) and the suggested bills' (R-094, migration 118) ----
// variant.js and core.js decide what to count (a test met, a measure done, a suggestion shown or followed, each once);
// this sends it, under the same rules as every count here: nothing with the privacy signal, from a test run or from the
// sandbox. A plain request, gathered for a moment so the first screen's three "met it" go as one, and never the database
// library (the first screen does not wait for it, R-122). log_ab and log_suggest take at most 12 events a call.
const queues = { log_ab: [], log_suggest: [] };
let flushT = 0;
function flushCounts() {
  clearTimeout(flushT); flushT = 0;
  for (const [fn, q] of Object.entries(queues)) while (q.length) {
    const e = q.splice(0, 12);
    try { fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, { method: 'POST', keepalive: true, headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ p: { e } }) }).catch(() => {}); } catch { /* never in the way */ }
  }
}
const queue = (fn, evs) => { try { if (DEMO || quiet()) return; queues[fn].push(...evs); if (!flushT) flushT = setTimeout(flushCounts, 1500); } catch { /* never in the way */ } };
setAbSink(evs => queue('log_ab', evs));
// A suggested bill's event: { s: 'home' | 'find', l: 'pick' | 'yours' | 'other', k: 'shown' | 'followed' | 'dismissed' |
// 'acted' }. No bill, no issue: core.js keeps which bill it was, in this browser, only to send each event once.
export const logSuggest = ev => queue('log_suggest', [ev]);
addEventListener('pagehide', flushCounts);
