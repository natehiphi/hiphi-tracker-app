// The counts of act.html (R-360 part 3): a visit, the bill screen's arrival, the minutes a letter took, and the action
// "Yes, I sent it". Only the database calls the tracker's first visit and action counts make, copied from pub/visitlog.js
// (logDay, logAct, logTime, the 'arrive' row of logVisit) and pub/visitlog-send.js (send, sendCount), with the same keys
// (sessionStorage 'hiphi_fv' for the visit's id, localStorage 'hiphi_days' for the once-a-day visitor key) and the same
// privacy rules: nothing under Global Privacy Control or Do Not Track, nothing from a test run on this machine, a team
// browser (hiphi_team) or a crawler. Nothing sent is a name, a town, a letter, an email or a bill's words.
//
// The calls (argument names as visitlog sends them; the variant is always 'act'):
//   log_visit_count   { p: { kind: 'visit', gap, first_month, follows, signed_in, home_screen, season, variant, via?, device?, share_path? } }
//   log_first_visit   { p: { visit, step: 'arrive', event: 'view', variant, via?, sp?, utm_source?, utm_medium?, utm_campaign?, ref_domain?, device? } }
//   log_visit_count   { p: { kind: 'act', act: 'testimony' | 'email', device, variant, via?, share_path? } }
//   log_act_time      { p: { act, seconds, device, variant, first_time? (testimony only) } }
//
// Every call is fire and forget: never throws, never waits, never retries. The practice copy (?demo=1) sends nothing and
// only prints each call to the console.
import { URL_, KEY, DEMO } from './data.js';
import { isDone } from './done.js';

const VARIANT = 'act';
const KEY_VISIT = 'hiphi_fv', KEY_DAYS = 'hiphi_days', DONE = DEMO ? 'hiphi_done_demo' : 'hiphi_done';
const SLUG = /^[a-z0-9-]{1,40}$/, UTM = /^[a-z0-9._-]{1,40}$/, SITE = /^[a-z0-9.-]{1,80}$/, SP = /^(sheet|email|copy|alert)$/;
const LOCAL = /^(localhost|127\.0\.0\.1|\[::1\])$/;
const CRAWLER = /bot\b|crawl|spider|slurp|facebookexternalhit|embedly|preview|lighthouse|pingdom|uptime|monitor|python-requests|curl\//i;

// The privacy rules of visitlog.js (gpc, testRun, teamBrowser, crawler), copied small. A test run is the page served from this
// machine unless a test turns counting on with window.__hiphiCountTests (a page flag, as visitlog.js reads it).
function quiet() {
  try {
    if (navigator.globalPrivacyControl === true || navigator.doNotTrack === '1' || window.doNotTrack === '1') return true;
    if (LOCAL.test(location.hostname) && window.__hiphiCountTests !== true) return true;
    if (localStorage.getItem('hiphi_team') === '1') return true;
    return CRAWLER.test(navigator.userAgent || '');
  } catch { return true; }
}

const device = () => { const w = window.innerWidth || document.documentElement.clientWidth || 0; return w < 600 ? 'phone' : w < 1024 ? 'tablet' : 'laptop'; };
const hiDay = (t = Date.now()) => new Date(t).toLocaleDateString('en-CA', { timeZone: 'Pacific/Honolulu' });   // 2026-09-27
const band = d => d <= 1 ? '1d' : d <= 7 ? '2-7d' : d <= 30 ? '8-30d' : d <= 90 ? '31-90d' : '91d+';
const homeScreen = () => { try { return matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; } catch { return false; } };

// Where the visit came from: the same words visitlog.js reads from the address, and the referring site's name only.
function fromUrl() {
  const q = new URLSearchParams(location.search), word = (k, re) => { const v = (q.get(k) || '').trim().toLowerCase(); return re.test(v) ? v : ''; };
  return { via: word('via', SLUG).replace(/^share-.*$/, 'share'), sp: word('sp', SP), utm_source: word('utm_source', UTM), utm_medium: word('utm_medium', UTM), utm_campaign: word('utm_campaign', UTM) };
}
function refSite() {
  try {
    if (!document.referrer) return '';
    const u = new URL(document.referrer);
    if (!/^https?:$/.test(u.protocol) || u.hostname === location.hostname) return '';
    let h = u.hostname.toLowerCase();
    for (let k = 0; k < 3 && /^(www|m|l|lm)\./.test(h); k++) h = h.replace(/^(www|m|l|lm)\./, '');
    return SITE.test(h) ? h : '';
  } catch { return ''; }
}
function newId() {
  try { if (crypto.randomUUID) return crypto.randomUUID(); } catch { /* older browsers */ }
  const b = crypto.getRandomValues(new Uint8Array(16)); b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
  const h = [...b].map(x => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

// This visit (the tab's id and where it came from), shared with the tracker's pages in the same tab through the same key.
let mem = null;
function visit() {
  let v = null;
  try { v = JSON.parse(sessionStorage.getItem(KEY_VISIT) || 'null') || mem; } catch { v = mem; }
  if (!v || !v.id) {
    v = { id: newId(), n: 0, src: { ...fromUrl(), ref_domain: refSite(), device: device() } };
    mem = v;
    try { sessionStorage.setItem(KEY_VISIT, JSON.stringify(v)); } catch { /* this page load only */ }
  }
  return v;
}

// One POST to one RPC, as visitlog-send.js sends it (the body is { p }, the public key in the header). Never throws.
function send(fn, p) {
  if (DEMO) { console.debug(`act counts: ${fn} (practice copy, not sent)`, p); return; }
  try {
    fetch(`${URL_}rpc/${fn}`, { method: 'POST', keepalive: true, headers: { apikey: KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ p }) })
      .catch(() => {});
  } catch { /* never in the way */ }
}
// The visit's source words and device, as visitlog.js adds them: only the ones that have a value.
function addSrc(p, src) {
  for (const [k, val] of Object.entries(src || {})) if (val) p[k] = val;
  return p;
}

// ---- once per page load: a visit, once a Hawaiʻi day (visitlog.js logDay) ----
let visited = false;
export function countVisit() {
  try {
    if (visited) return; visited = true;
    if (!DEMO && quiet()) return;
    const today = hiDay();
    let last = null;
    try { last = JSON.parse(localStorage.getItem(KEY_DAYS) || 'null'); } catch { /* private mode: counted as new each day */ }
    if (!DEMO && last && last.last === today) return;
    const gap = last && last.last ? band(Math.round((Date.parse(today) - Date.parse(last.last)) / 864e5)) : 'new';
    const first = last && /^\d{4}-\d{2}$/.test(last.first || '') ? last.first : today.slice(0, 7);
    if (!DEMO) { try { localStorage.setItem(KEY_DAYS, JSON.stringify({ first, last: today })); } catch { /* ignore */ } }
    const src = visit().src || {};
    // follows and signed_in: this page reads neither, so it sends what visitlog sends for a visitor with none (false).
    // season: visitlog's own default when the page does not say ('in'); this page does not read the session's calendar.
    const p = { kind: 'visit', gap, first_month: first, follows: false, signed_in: false, home_screen: homeScreen(), season: 'in', variant: VARIANT };
    if (src.via) p.via = src.via;
    if (src.device) p.device = src.device;
    if (src.via === 'share' && src.sp) p.share_path = src.sp;
    send('log_visit_count', p);
  } catch { /* counting never gets in the way */ }
}

// ---- the bill screen's arrival, once per page load: the 'arrive' row of the first visit (visitlog.js logVisit) ----
let arrived = false;
export function arrive() {
  try {
    if (arrived) return; arrived = true;
    if (!DEMO && quiet()) return;
    const v = visit();
    send('log_first_visit', addSrc({ visit: v.id, step: 'arrive', event: 'view', variant: VARIANT }, v.src));
  } catch { /* counting never gets in the way */ }
}

// ---- the letter's clock: from the first time the Write screen shows, for each bill ----
const started = new Map();
export function letterShown(B) {
  if (!started.has(B.id)) started.set(B.id, Date.now());
}

// ---- "Yes, I sent it": the action (visitlog.js logAct), and how long the letter took (logTime) ----
// Called before the done mark is written, so the first-testimony check still sees the old marks. kind: 'testimony' | 'email'.
export function countSent(B, kind) {
  try {
    const at = started.get(B.id); started.delete(B.id);
    if (isDone(B)) return;   // this action was counted when it was first marked sent (B-6): "Send again" is not a second one
    if (!DEMO && quiet()) return;
    const device_ = device();
    const src = visit().src || {};
    const p = { kind: 'act', act: kind, device: device_, variant: VARIANT };
    if (src.via) p.via = src.via;
    // share_path: for a visit that came by a shared link, the way it was sent (visitlog.js logAct, R-205).
    const path = src.via === 'share' ? src.sp : '';
    if (SP.test(path || '')) p.share_path = path;
    send('log_visit_count', p);
    if (at === undefined) return;   // the letter was opened some other way (a link to this step): no time to count
    const tp = { act: kind, seconds: Math.min(Math.max(0, Math.round((Date.now() - at) / 1000)), 3600), device: device_, variant: VARIANT };
    if (kind === 'testimony') {
      // first_time: no testimony was marked done on this device before (visitlog.js: the done set's testimony keys).
      let before = [];
      try { before = JSON.parse(localStorage.getItem(DONE) || '[]'); } catch { /* private mode */ }
      tp.first_time = !before.some(k => /\|testimony$/.test(k));
    }
    send('log_act_time', tp);
  } catch { /* counting never gets in the way */ }
}
