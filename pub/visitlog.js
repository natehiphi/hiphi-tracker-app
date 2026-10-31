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
//   logDay({follows,...})         once per Hawaiʻi day: this browser came back, and after how long (078)
//   logAct(kind, {sp})            an action marked done: its kind, where the visit came from, a share's way out (078, R-205)
//   logTime(act, seconds, first)  how long a letter took, from opening the walkthrough to sending it (143)
//
// Two files since R-357 5c (a phone's first wave). This one is small and is what every screen imports: the privacy rules (quiet),
// the visit's id and where it came from (visit, visitVia), and the calls below, which wait their turn. pub/visitlog-send.js holds
// the rest (what an event may carry, the sending, the day and action counts, the A/B tests' and suggestions' queues). It loads
// once the first screen is drawn (app.js: holdCounts, then releaseCounts), or at once on any page that has no first screen to
// wait for (a test, a page that imports this file on its own). A call made while it is on its way is kept, up to 100, and made in
// order when it arrives, so a count asked for in a page's first moments goes out a little later than it did; one asked for as the
// tab closes inside those moments is not sent, as the tab is gone before the file is.

const KEY = 'hiphi_fv';
const SLUG = /^[a-z0-9-]{1,40}$/, UTM = /^[a-z0-9._-]{1,40}$/, SITE = /^[a-z0-9.-]{1,80}$/;
export const SP = /^(sheet|email|copy|alert)$/;   // a share's way out (logAct, in the sending half too)
export const DEBUG = /(^|[?&])debug(=|&|$)/.test(location.search);
// The privacy page promises "if your browser asks sites not to track you, we record nothing". Only Global Privacy
// Control was honoured; Do Not Track is the older way browsers ask, so it counts too (R-067).
const gpc = () => { try { return navigator.globalPrivacyControl === true || navigator.doNotTrack === '1' || window.doNotTrack === '1'; } catch { return false; } };
// A test run is never counted either (R-100): an automated browser, or the page served from the test machine. On 9/29
// the suites, which load the live page without the privacy signal, made up every visit counted since 9/27.
// tests/visitlog.py, which intercepts every request, turns counting back on with window.__hiphiCountTests (a page flag,
// not storage: the sandbox renames hiphi_ storage names).
const testRun = () => { try { return (navigator.webdriver === true || /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname)) && window.__hiphiCountTests !== true; } catch { return false; } };
// The team's own browsing and the web's crawlers are not visitors either (K1-5, R-180 wave 3). Signing in to Staff v2 marks the
// browser (staff/data.js sets hiphi_team on the same site, so the public page sees it); known crawlers are skipped by name, a
// second line behind the automated-browser rule above. Counts that mean "people" start on 20 Jan 2027, JANUARY.md.
const teamBrowser = () => { try { return localStorage.getItem('hiphi_team') === '1'; } catch { return false; } };
const CRAWLER = /bot\b|crawl|spider|slurp|facebookexternalhit|embedly|preview|lighthouse|pingdom|uptime|monitor|python-requests|curl\//i;
const crawler = () => { try { return CRAWLER.test(navigator.userAgent || ''); } catch { return false; } };
export const quiet = () => gpc() || testRun() || teamBrowser() || crawler();   // errlog.js (R-111) follows the same rules

// ---- this visit: its id and where it came from, worked out once and kept for the life of the tab ----
let mem = null;   // when sessionStorage is not available (a private window that refuses it), this page load only
const read = () => { try { return JSON.parse(sessionStorage.getItem(KEY) || 'null') || mem; } catch { return mem; } };
export const write = v => { mem = v; try { sessionStorage.setItem(KEY, JSON.stringify(v)); } catch { /* this page load only */ } };
function newId() {
  try { if (crypto.randomUUID) return crypto.randomUUID(); } catch { /* older browsers */ }
  const b = crypto.getRandomValues(new Uint8Array(16)); b[6] = (b[6] & 15) | 64; b[8] = (b[8] & 63) | 128;
  const h = [...b].map(x => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}
// The words that say where someone came from: lower case, and anything that does not fit the pattern is dropped.
function fromUrl() {
  const q = new URLSearchParams(location.search), word = (k, re) => { const v = (q.get(k) || '').trim().toLowerCase(); return re.test(v) ? v : ''; };
  // A shared link says which message brought the friend (?via=share-deadline, R-135's share test, variant.js); for every
  // other count it is a friend's link like any other: 'share'.
  // ?sp= (R-205 K2): the way a shared link was sent (the phone's share menu, an email, a copy, an alert's line).
  return { via: word('via', SLUG).replace(/^share-.*$/, 'share'), sp: word('sp', SP), utm_source: word('utm_source', UTM), utm_medium: word('utm_medium', UTM), utm_campaign: word('utm_campaign', UTM) };
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
export const device = () => { const w = window.innerWidth || document.documentElement.clientWidth || 0; return w < 600 ? 'phone' : w < 1024 ? 'tablet' : 'laptop'; };
export function visit() {
  let v = read();
  if (!v || !v.id) { v = { id: newId(), n: 0, src: { ...fromUrl(), ref_domain: refSite(), device: device() } }; write(v); }
  return v;
}
// Worked out as the page loads, before anything can change the address, so a ?via= is never lost. Nothing is sent.
if (!quiet()) { try { visit(); } catch { /* counting never gets in the way */ } }

// This visit's partner slug (?via=), or '' when there is none. Read from the address itself under Global Privacy Control,
// where nothing is kept.
export function visitVia() {
  try { if (quiet()) return fromUrl().via; return visit().src?.via || ''; } catch { return ''; }
}

// ---- the calls: kept until the sending half is in (R-357 5c) ----
let impl = null, implP = null, hold = false;
const kept = [];
// Loads the sending half once (a failed load is forgotten, so a later call asks again) and makes the kept calls in order. A kept
// call that cannot be made answers what the call answers when nothing was sent: false, or null for a partner's line.
function loadSend() {
  return implP ??= import('./visitlog-send.js').then(m => { impl = m; for (const run of kept.splice(0)) run(false); return m; })
    .catch(e => { implP = null; for (const run of kept.splice(0)) run(true); throw e; });
}
const later = (name, args, miss) => new Promise(res => {
  const run = failed => { if (failed) { res(miss); return; } try { Promise.resolve(impl[name](...args)).then(res, () => res(miss)); } catch { res(miss); } };
  if (kept.length >= 100) { res(miss); return; }
  kept.push(run);
  if (!hold) loadSend().catch(() => {});
});
const call = (name, miss) => (...args) => impl ? impl[name](...args) : later(name, args, miss);
// pub/app.js holds the calls as its first act and releases them when its first screen is drawn. Any other page holds nothing and
// loads the sending half after this file has run (the microtask comes after every module of the graph has run, app.js's first act
// among them), as this file used to be all of it: tests/abtests.py and layout.py import this file to give variant.js its sender.
export const holdCounts = () => { hold = true; };
export const releaseCounts = () => { hold = false; loadSend().catch(() => {}); };
queueMicrotask(() => { if (!hold) loadSend().catch(() => {}); });

export const logVisit = call('logVisit', false);
export const partnerWelcome = call('partnerWelcome', null);
export const logDay = call('logDay', false);
export const logAct = call('logAct', false);
export const logTime = call('logTime', false);
export const logAsk = call('logAsk', false);
export const logSuggest = ev => { call('logSuggest', undefined)(ev); };
