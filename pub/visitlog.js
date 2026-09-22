// The first visit, counted privately (R-023 decision 8; backend migrations 067-068, docs/FIRST-VISIT-PLAN.md
// "Measurement"). One small row per screen event goes to log_first_visit, a database function anyone may call, which
// checks every value again and drops what does not fit. Staff read the weekly roll-up in Staff v2 (Outreach > Issues >
// First visit); nobody can read the rows themselves.
//
// What leaves the browser, and nothing else: a random id for this visit (sessionStorage, so it is gone when the tab
// closes; no cookie; never tied to an account), the screen and how it was left, seconds on it, the path, the lesson step
// and the "Try it" answer, counts (never an email, a name, an address or which stance), the ids of the issues followed,
// and where the person came from: ?via=, the utm_ words, and the referring site's name only (instagram.com, never the
// page). Phone, tablet or laptop comes from the window width, never the browser's identity string.
// Nothing at all is sent when the browser asks for Global Privacy Control, or from the sandbox (?demo=1), where the
// payload is printed to the console instead when the address also has `debug`.
//
//   logVisit(step, event, extra)  fire and forget: never throws, never waits, never retries; at most 60 a visit
//   visitVia()                    this visit's ?via= slug, or ''
//   partnerWelcome(slug)          the partner's welcome line (public_partners), or null; asked once per slug
import { DEMO, SUPABASE_URL, SUPABASE_KEY, supa } from './core.js';

const KEY = 'hiphi_fv', CAP = 60;
const STEPS = new Set(['topics', 'issues', 'stand', 'bill', 'session', 'hearing', 'you', 'soon', 'done', 'home', 'arrive', 'act', 'followask']);
const EVENTS = new Set(['view', 'next', 'skip', 'back', 'leave', 'done', 'answer']);
const SLUG = /^[a-z0-9-]{1,40}$/, UTM = /^[a-z0-9._-]{1,40}$/, SITE = /^[a-z0-9.-]{1,80}$/;
const DEBUG = /(^|[?&])debug(=|&|$)/.test(location.search);
const gpc = () => { try { return navigator.globalPrivacyControl === true; } catch { return false; } };

// ---- this visit: its id and where it came from, worked out once and kept for the life of the tab ----
let mem = null;   // when sessionStorage is not available (a private window that refuses it), this page load only
const read = () => { try { return JSON.parse(sessionStorage.getItem(KEY) || 'null') || mem; } catch { return mem; } };
const write = v => { mem = v; try { sessionStorage.setItem(KEY, JSON.stringify(v)); } catch { /* this page load only */ } };
function newId() {
  try { if (crypto.randomUUID) return crypto.randomUUID(); } catch { /* older browsers */ }
  const b = crypto.getRandomValues(new Uint8Array(16)); b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
  const h = [...b].map(x => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
// The words that say where someone came from: lower case, and anything that does not fit the pattern is dropped.
function fromUrl() {
  const q = new URLSearchParams(location.search), word = (k, re) => { const v = (q.get(k) || '').trim().toLowerCase(); return re.test(v) ? v : ''; };
  return { via: word('via', SLUG), utm_source: word('utm_source', UTM), utm_medium: word('utm_medium', UTM), utm_campaign: word('utm_campaign', UTM) };
}
// The referring site's name only, when it is another site: l.instagram.com and lm.facebook.com are the apps' link
// wrappers, m. and www. the same site again.
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
const device = () => { const w = window.innerWidth || document.documentElement.clientWidth || 0; return w < 600 ? 'phone' : w < 1024 ? 'tablet' : 'laptop'; };
function visit() {
  let v = read();
  if (!v || !v.id) { v = { id: newId(), n: 0, src: { ...fromUrl(), ref_domain: refSite(), device: device() } }; write(v); }
  return v;
}
// Worked out as the page loads, before anything can change the address, so a ?via= is never lost. Nothing is sent.
if (!gpc()) { try { visit(); } catch { /* counting never gets in the way */ } }

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
    for (const k of ['address', 'email']) if (typeof x.counts[k] === 'boolean') c[k] = x.counts[k];
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
    if (gpc()) return Promise.resolve(false);
    if (!STEPS.has(step) || !EVENTS.has(event)) { console.warn('logVisit: not a first-visit step or event:', step, event); return Promise.resolve(false); }
    const v = visit();
    if (v.n >= CAP) return Promise.resolve(false);
    const payload = { visit: v.id, step, event };
    for (const [k, val] of Object.entries(v.src || {})) if (val) payload[k] = val;
    Object.assign(payload, pick(step, event, extra || {}));
    if (DEMO) { if (DEBUG) console.debug('first visit (sandbox, not sent):', payload); return Promise.resolve(false); }
    v.n += 1; write(v);
    return send(payload, event === 'leave').catch(() => false);
  } catch { return Promise.resolve(false); }
}

// This visit's partner slug (?via=), or '' when there is none. Read from the address itself under Global Privacy Control,
// where nothing is kept.
export function visitVia() {
  try { if (gpc()) return fromUrl().via; return visit().src?.via || ''; } catch { return ''; }
}

// The partner's welcome line ("Welcome, friends of ..."), or null: no such partner, no line, or no network. Asked once
// per slug per page load. The sandbox never asks the database: it shows a made-up line so the screen can be seen.
const welcomes = new Map();
export function partnerWelcome(slug) {
  const s = String(slug || '').toLowerCase();
  if (!/^[a-z0-9-]{2,40}$/.test(s)) return Promise.resolve(null);
  if (DEMO) return Promise.resolve(`Welcome, friends of ${s.split('-').map(w => w[0].toUpperCase() + w.slice(1)).join(' ')}!`);
  if (!welcomes.has(s)) welcomes.set(s, supa()
    .then(sb => sb.from('public_partners').select('welcome').eq('slug', s).maybeSingle())
    .then(r => (!r.error && r.data && r.data.welcome) || null, () => null));
  return welcomes.get(s);
}
