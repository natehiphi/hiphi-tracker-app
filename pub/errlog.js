// The public page reports its own errors, as numbers (R-111, the assessment's U1; backend migration 110). When a screen
// throws, a promise is left rejected, a screen fails to draw (app.js render) or the page fails to start (boot), one
// small row goes to log_public_error, a database function anyone may call, which checks every value again, blanks
// anything that looks like an email address, a long number or a query string, and counts the same error once per hour.
//
// What leaves the browser, and nothing else: the kind; the screen's address part (bill/HB2121, issue/school-meals, home:
// never a query string, a shared list's link or an account id); the error's first 200 characters; the file and line it
// came from (the site's own path, no origin); phone, tablet or laptop from the window width; and whether this is the
// sandbox. Nothing at all is sent with the privacy signal (Global Privacy Control or Do Not Track) or from a test run
// (an automated browser, or the page served from the test machine): the same rules as visitlog.js. At most five reports
// a page load, each distinct error once. A dropped connection is not reported: the page already tells the person.
//
// Errors from before this module runs are kept by a small catcher in track.html, which also reports a page whose code
// never starts; this module takes over from it. Staff see the week's list in Staff v2 > Session setup; the hourly
// health check tells the admins by Slack when ten or more arrive in an hour. The privacy page says all this
// (pub/more.js, "If the page breaks"); a lawyer should confirm the wording.
import { SUPABASE_URL, SUPABASE_KEY, DEMO } from './kernel.js';
import { quiet, device } from './visitlog.js';

const MAX = 5;
const seen = new Set();
// Screens whose first address part names a public thing (a bill, an issue, a committee, a lesson): kept, so "bill/HB2121"
// says where. Anything else is the screen's name alone: #/l/<token> is a shared list's hard-to-guess link, #/mylist/<id>
// a person's own list, #/find?q= what someone typed.
const KEEP = new Set(['bill', 'issue', 'category', 'committee', 'help', 'learn', 'start', 'list', 'legislator']);
export const placeOf = (hash = location.hash) => {
  try {
    const seg = decodeURIComponent(hash || '').replace(/^#/, '').split('?')[0].split('/').filter(Boolean);
    if (!seg.length) return 'home';
    if (seg[0] === 'bill') return seg.slice(0, /^\d{4}$/.test(seg[1] || '') ? 3 : 2).join('/');
    return KEEP.has(seg[0]) && seg[1] ? `${seg[0]}/${seg[1]}` : seg[0];
  } catch { return ''; }
};
// A dropped or slow connection is the visitor's, not the code's: the page already says "check your connection", and a
// real outage is caught by the hourly check. So neither a rejection nor a failed start is reported for one.
const NOISE = /Failed to fetch|Load failed|NetworkError|network error|The Internet connection appears|cancelled|aborted|ResizeObserver loop|^timeout$/i;
const stripOrigin = s => String(s || '').replace(/^https?:\/\/[^/]+/, '').split('?')[0];
const sourceOf = err => { const m = /(https?:\/\/[^\s)]+?):(\d+):(\d+)/.exec(err?.stack || ''); return m ? `${stripOrigin(m[1])}:${m[2]}:${m[3]}` : ''; };

export function reportError(kind, err, { message = '', source = '' } = {}) {
  try {
    if (quiet()) return;
    const msg = String(message || err?.message || err || '').replace(/\s+/g, ' ').trim().slice(0, 200);
    if (!msg || ((kind === 'rejection' || kind === 'boot') && NOISE.test(msg))) return;
    const key = `${kind}|${msg}`;
    if (seen.has(key) || seen.size >= MAX) return;
    seen.add(key);
    const p = { kind, place: placeOf(), message: msg, source: String(source || sourceOf(err)).slice(0, 120), device: device(), sandbox: DEMO };
    fetch(`${SUPABASE_URL}/rest/v1/rpc/log_public_error`, { method: 'POST', keepalive: true,
      headers: { 'content-type': 'application/json', apikey: SUPABASE_KEY, authorization: `Bearer ${SUPABASE_KEY}` }, body: JSON.stringify({ p }) }).catch(() => {});
  } catch { /* the reporter never breaks the page */ }
}
window.addEventListener('error', e => { if (e && e.message) reportError('error', e.error, { message: e.message, source: e.filename ? `${stripOrigin(e.filename)}:${e.lineno || 0}:${e.colno || 0}` : '' }); });
window.addEventListener('unhandledrejection', e => reportError('rejection', e && e.reason));
// Take over from track.html's early catcher: send what it kept, and tell it the app's code is running.
const E = window.__hiphiErrs;
if (E) { E.handled = true; (E.early || []).splice(0).forEach(x => reportError(x.kind, null, x)); }
