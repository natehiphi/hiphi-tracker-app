// Staff v2 reports its own errors, as the public page does (R-152 B; pub/errlog.js, backend migration 110). Until now only
// the public page told anyone when it broke; a staff screen that threw left a red line in one person's console and nobody
// knew. When a screen fails to draw, a promise is left rejected, a script throws or the app fails to start, one small row
// goes to log_public_error, the database function anyone may call, which checks every value again, blanks anything that
// looks like an email address or a long number, and counts the same error once an hour. The row's place starts with
// "staff/" so Session setup's list and the hourly health check tell staff errors from the public's.
//
// What leaves the browser: the kind; the screen's name (and the bill, issue or help topic, never a person's or a list's id or
// a query string); the error's first 200 characters; the file and line (the site's own path); phone, tablet or laptop; and
// whether this is the sandbox. Nothing is sent from a test run (an automated browser, or the page served from this machine).
// At most five a page load, each distinct error once. A dropped connection is not reported.
import { SUPABASE_URL, SUPABASE_KEY, DEMO } from './data.js';

const MAX = 5, seen = new Set();
const KEEP = new Set(['bill', 'issue', 'help', 'setup']);
const NOISE = /Failed to fetch|Load failed|NetworkError|network error|The Internet connection appears|cancelled|aborted|ResizeObserver loop|^timeout$/i;
const stripOrigin = s => String(s || '').replace(/^https?:\/\/[^/]+/, '').split('?')[0];
const sourceOf = err => { const m = /(https?:\/\/[^\s)]+?):(\d+):(\d+)/.exec(err?.stack || ''); return m ? `${stripOrigin(m[1])}:${m[2]}:${m[3]}` : ''; };
export const placeOf = (hash = location.hash) => {
  try {
    const seg = decodeURIComponent(hash || '').replace(/^#/, '').split('?')[0].split('/').filter(Boolean);
    if (!seg.length) return 'staff/today';
    if (seg[0] === 'bill') return 'staff/' + seg.slice(0, /^\d{4}$/.test(seg[1] || '') ? 3 : 2).join('/');
    return 'staff/' + (KEEP.has(seg[0]) && seg[1] ? `${seg[0]}/${seg[1]}` : seg[0]);
  } catch { return 'staff'; }
};
const device = () => innerWidth < 600 ? 'phone' : innerWidth < 1000 ? 'tablet' : 'laptop';
// An automated browser, or the page served from this machine, is a test: never counted.
export const testRun = () => { try { return !!navigator.webdriver || /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname); } catch { return false; } };

export function reportError(kind, err, { message = '', source = '' } = {}) {
  try {
    if (testRun() && !window.__staffErrlogTest) return;
    const msg = String(message || err?.message || err || '').replace(/\s+/g, ' ').trim().slice(0, 200);
    if (!msg || ((kind === 'rejection' || kind === 'boot') && NOISE.test(msg))) return;
    const key = `${kind}|${msg}`;
    if (seen.has(key) || seen.size >= MAX) return;
    seen.add(key);
    const p = { kind, place: placeOf(), message: msg, source: String(source || sourceOf(err)).slice(0, 120), device: device(), sandbox: DEMO };
    const send = window.__staffErrlogSend || ((url, init) => fetch(url, init));
    send(`${SUPABASE_URL}/rest/v1/rpc/log_public_error`, { method: 'POST', keepalive: true,
      headers: { 'content-type': 'application/json', apikey: SUPABASE_KEY, authorization: `Bearer ${SUPABASE_KEY}` }, body: JSON.stringify({ p }) }).catch?.(() => {});
  } catch { /* the reporter never breaks the page */ }
}
window.addEventListener('error', e => { if (e && e.message) reportError('error', e.error, { message: e.message, source: e.filename ? `${stripOrigin(e.filename)}:${e.lineno || 0}:${e.colno || 0}` : '' }); });
window.addEventListener('unhandledrejection', e => reportError('rejection', e && e.reason));
