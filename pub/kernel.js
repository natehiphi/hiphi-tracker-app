// HIPHI public tracker: the kernel. What every screen needs and what the first screen needs before anything else
// (R-122, the split of 2 Oct): state, the client, the catalog, follows, the first visit's state, the page's small helpers.
// Everything bill-level is in core.js, which re-exports this module, so screens keep importing from core.js; only the
// modules on the first load import from here. Nothing here may import core.js, stops.js or rank.js (tools/check_split.mjs).
import { ICONS, icon } from '../icons.js';
export { ICONS, icon };
// A copy of stops.js's HELD_RE (tools/check_split.mjs keeps them equal): the kernel must not carry the whole stops module.
export const HELD_RE = /deferred the measure(?!\s+until)|measure be deferred(?!\s+until)|failed to pass/i;
export const app = { render: () => {}, boot: () => {}, go: () => {}, openHelper: () => {} };
export const SUPABASE_URL = 'https://eivzjbnygscguqqiiuvh.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_uvEtw8ru3zB9lDOxAjzrUA_JEFvKyul';
// The public page keeps its sign-in apart from the staff app's. Both live at the same address, so with Supabase's
// default slot a staff sign-in showed up here too, and the "staff accounts use the main app" sign-out below ended the
// staff session in every tab: Nate could not stay signed in to staff while the tracker was open (9/26, R-063).
const AUTH = { auth: { storageKey: 'hiphi-public-auth' } };
export const DEMO = new URLSearchParams(location.search).has('demo');
export const LOCAL_KEY = DEMO ? 'hiphi_watch_ids_demo' : 'hiphi_watch_ids';
// Sandbox (?demo=1): the real 2026 session frozen at Monday March 16, 2026,
// 9:00 HST, from demo/snapshot.json. Same file the staff sandbox uses; no
// account, no network writes, the watchlist lives in this browser only.
export const SEASON_OFF = DEMO && new URLSearchParams(location.search).get('season') === 'off';
export const DEMO_ASOF = SEASON_OFF ? '2026-09-18T09:00:00-10:00' : '2026-03-16T09:00:00-10:00';
if (DEMO) {
  const RD = Date, off = RD.now() - new RD(DEMO_ASOF).getTime();
  window.Date = class extends RD { constructor(...a) { a.length ? super(...a) : super(RD.now() - off); } static now() { return RD.now() - off; } };
  // The sandbox and the real page share one web address, so they share this browser's storage. A practice run left
  // the real page past its first visit, with the sandbox's legislators "saved" (R-067), because only some names had a
  // _demo copy. Here every hiphi_ name gets one, whichever screen reads or writes it.
  try {
    const P = Storage.prototype, apart = k => typeof k === 'string' && k.startsWith('hiphi_') && !k.endsWith('_demo') ? k + '_demo' : k;
    for (const f of ['getItem', 'setItem', 'removeItem']) { const orig = P[f]; P[f] = function (k, ...a) { return orig.call(this, apart(k), ...a); }; }
  } catch { /* storage blocked: nothing to keep apart */ }
}
export const $ = s => document.querySelector(s);
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const HST = 'Pacific/Honolulu';
export const hstDay = d => new Date(d).toLocaleDateString('en-CA', { timeZone: HST });
// One message at a time, in one polite live region above the tab bar (a new one replaces the old). Errors are never
// raw: friendly(e) turns them into a sentence. toast(msg, { undo }) adds an Undo button and stays 10 seconds.
// toast(msg, { also: { label, action } }) offers a DIFFERENT action instead ("Follow both?"), not an undo of what
// just happened - at most one button either way, so the toast never has to choose between two competing asks.
export function toast(m, opt = {}) {
  if (opt === true) opt = { err: true };
  const box = $('#toast'); if (!box) return;
  box.innerHTML = '';
  const el = document.createElement('div'); el.className = 'toastmsg' + (opt.err ? ' err' : opt.yay ? ' yay' : '');
  const btnLabel = opt.also ? opt.also.label : opt.undo ? 'Undo' : '';
  el.innerHTML = (opt.yay ? `<svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="9.5" fill="var(--ok-text)"/><path class="ck" d="M5.5 10.4l3 3 6-6.6" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>` : '')
    + `<span>${esc(opt.err ? friendly(m) : m)}</span>` + (btnLabel ? `<button type="button" class="toastundo">${esc(btnLabel)}</button>` : '');
  const run = opt.also ? opt.also.action : opt.undo;
  if (run) el.querySelector('.toastundo').onclick = async () => { box.innerHTML = ''; try { await run(); } catch (e) { toast(e, true); } app.render(); };
  box.appendChild(el);
  // A toast someone is reading or reaching for stays put; its clock starts again when they leave it. One with a
  // button gets 10 seconds. (Undo is never only here: the star and the done card both undo in place.)
  const arm = () => { clearTimeout(toast.t); toast.t = setTimeout(() => { if (el.isConnected) el.remove(); }, run ? 10000 : 4000); };
  const hold = () => clearTimeout(toast.t);
  el.addEventListener('mouseenter', hold); el.addEventListener('mouseleave', arm); el.addEventListener('focusin', hold); el.addEventListener('focusout', arm);
  arm();
}
// Sentences, not error codes. Anything we do not recognise becomes the connection sentence.
export function friendly(e) {
  const m = String(e?.message || e || '');
  if (/rate limit|too many/i.test(m)) return 'Too many tries in a row. Wait a minute and try again.';
  if (/invalid.*email|email.*invalid/i.test(m)) return 'That email address does not look right. Try one like name@example.com.';
  // The sign-in mailer refusing or failing (an address it is not allowed to send to, or its own error) is our problem,
  // not the person's connection, which is what they were told (R-067).
  if (/not authori[sz]ed|error sending|sending.*email|smtp|signups not allowed/i.test(m)) return 'We couldn’t send the email just now. That’s on our side, not yours. What you follow is still saved in this browser; please try again later.';
  if (/^[A-Z][^{}<>]{3,120}[.!]$/.test(m) && !/(error|exception|fetch|null|undefined|column|relation|violates|jwt|token)/i.test(m)) return m;
  return 'We could not do that. Check your connection and try again.';
}
// Official descriptions end with drafting notes ("Effective 7/1/3000.  (HD1)") that mean nothing to a neighbour and
// look wrong in a letter sent under their name. Strip them wherever a description is shown or quoted.
export function cleanDesc(t) {
  let x = String(t || '').replace(/\s+/g, ' ').trim(), prev;
  do { prev = x;
    x = x.replace(/\s*\((?:[HSC]D\s?\d+[\s,]*)+\)\s*$/i, '')                              // (HD1), (HD2 SD1)
      .replace(/\s*(?:Effective|Takes effect|Sunsets?)\b[^.]*?\d{4}\.?\s*$/i, '')          // Effective 7/1/3000.
      .replace(/([.!?])\s*\d{1,2}\/\d{1,2}\/\d{4}\.?\s*$/, '$1').trim();                   // a bare trailing date after a sentence
  } while (x !== prev);
  return x;
}
// A bill's short everyday name ("Disposable vape ban"), written by staff (bills.nickname, 9/19). Empty until one exists.
export const nick = b => (b && (b.hiphi_nickname || b.nickname)) || '';
// Bare bill numbers from bills.companions: not always one clean number per array element, so split and
// normalize defensively. Excludes self-references.
export function blurb(b, n = 110) {
  const t = (b.hiphi_summary || cleanDesc(b.description) || b.title || '').replace(/\s+/g, ' ').trim();
  if (t.length <= n) return t;
  const cut = t.slice(0, n + 1), stop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('; '));
  if (stop >= 40) return cut.slice(0, stop + 1).replace(/;$/, '.');
  return t.slice(0, n - 1).replace(/\s\S*$/, '').replace(/[,;:]$/, '') + '…';
}
// The name a card or page leads with: the nickname when there is one, else the plain summary.
export function groups() {
  const g = {};
  for (const c of S.coalitions || []) { const k = c.public_name || c.name; const x = g[k] ??= { key: k, names: [], icon: c.icon, description: c.description, bills: 0, live: 0, sort_order: c.sort_order || 99 };
    x.names.push(c.name); x.bills += c.bills || 0; x.live += c.live || 0; x.icon = x.icon || c.icon; x.description = x.description || c.description; x.sort_order = Math.min(x.sort_order, c.sort_order || 99); }
  return Object.values(g);
}
export const S = { sugWhy: new Map(), supa: null, session: null, user: null, watch: new Set(), bills: [], hearings: [], activity: [], deadlines: [],
  committees: {}, coalitions: [], outcomes: {}, view: 'home', q: '', results: null, browse: null, open: null, weekOffset: 0,
  extra: {}, xh: {}, slots: [], done: new Set(), actionCounts: {}, helper: null, lists: [], listFollows: new Set(), listBills: {}, listSlug: null, consentCard: false, legislators: [], committeeMembers: [], counterparts: [], legQ: '', legPick: null, legOpen: null, mailOpen: null,
  // Following (063, R-018): what the person chose - issues, whole categories, single bills ("direct") and "Not for me"
  // (skips). S.watch is worked out from those (recomputeWatch) and is what every screen reads as "followed bills".
  direct: new Set(), issueFollows: new Set(), catFollows: new Set(), skips: new Set(), viaIssues: new Set(),
  cats: [], issues: [], issueById: new Map(), issueBySlug: new Map(), issuesByBill: new Map() };
export const LISTS_KEY = DEMO ? 'hiphi_list_follows_demo' : 'hiphi_list_follows';
export const ISSUES_KEY = DEMO ? 'hiphi_issue_follows_demo' : 'hiphi_issue_follows';
export const CATS_KEY = DEMO ? 'hiphi_cat_follows_demo' : 'hiphi_cat_follows';
export const SKIPS_KEY = DEMO ? 'hiphi_skips_demo' : 'hiphi_skips';
export const CONSENT_KEY = 'hiphi_consent_pending';
// ---------------- data ----------------
// The Supabase library, pinned: "@2" cost a redirect on every cold load and could change under us (R-067 speed).
// track.html preloads this same address; change both together.
export const SUPABASE_JS = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/+esm';
// One client, however many ask first (init() and supa() used to make their own, and two auth clients fight over storage).
let clientP = null;
const makeClient = () => clientP ??= import(SUPABASE_JS).then(({ createClient }) => (S.supa = createClient(SUPABASE_URL, SUPABASE_KEY, AUTH)));
export async function init() {
  if (DEMO) { await (await import('./demo.js')).demoLoad(); return; }   // the sandbox's data, loaded only with ?demo=1 (R-122)
  await makeClient();
  const { data } = await S.supa.auth.getSession(); S.session = data.session;
  S.supa.auth.onAuthStateChange((_e, sess) => { const had = !!S.session; S.session = sess; if (!!sess !== had) app.boot(); });
}
// ---------------- sandbox data ----------------
export const D = { bills: [], index: [], hearings: [], activity: [], outcomes: [], lists: [], listBills: [], cats: [], issues: [], issueLinks: [] };
export const DONE_KEY = DEMO ? 'hiphi_done_demo' : 'hiphi_done';
export function localDone() { try { return new Set(JSON.parse(localStorage.getItem(DONE_KEY) || '[]')); } catch { return new Set(); } }
export function saveDone() { try { localStorage.setItem(DONE_KEY, JSON.stringify([...S.done])); } catch { /* ignore */ } }
export const doneKey = (billId, hearingId, kind) => `${billId}|${hearingId || ''}|${kind}`;
// When each mark was made (for the session weeks and the recap), in this browser; the account has created_at.
export const DONE_AT_KEY = DEMO ? 'hiphi_done_at_demo' : 'hiphi_done_at';
export function localDoneAt() { try { return JSON.parse(localStorage.getItem(DONE_AT_KEY) || '{}') || {}; } catch { return {}; } }
export function saveDoneAt() { try { localStorage.setItem(DONE_AT_KEY, JSON.stringify(S.doneAt || {})); } catch { /* ignore */ } }
export const KINDS = ['testimony', 'email', 'legislators', 'attend', 'share'];   // 'legislators': an email to your own legislators (089, R-087)
export const STANCE_KEY = DEMO ? 'hiphi_stances_demo' : 'hiphi_stances';
export function localStances() { try { return JSON.parse(localStorage.getItem(STANCE_KEY) || '{}') || {}; } catch { return {}; } }
export function saveStances() { try { localStorage.setItem(STANCE_KEY, JSON.stringify(S.stances || {})); } catch { /* ignore */ } }
const readSet = k => { try { return new Set(JSON.parse(localStorage.getItem(k) || '[]')); } catch { return new Set(); } };
const writeSet = (k, s) => { try { localStorage.setItem(k, JSON.stringify([...s])); } catch { /* private mode */ } };
export const localWatch = () => readSet(LOCAL_KEY);   // bills followed on their own
export function saveLocal() { writeSet(LOCAL_KEY, S.direct); writeSet(ISSUES_KEY, S.issueFollows); writeSet(CATS_KEY, S.catFollows); writeSet(SKIPS_KEY, S.skips); }
// The session whose bills an issue brings: this one, or between sessions the one just ended (so its outcomes show).
export const followYear = () => { const si = sessionInfo(); return si.phase === 'in' ? si.yr : si.recapYear; };
export const issueFollowed = i => !!i && (S.issueFollows.has(i.id) || (i.categories || [i.category]).some(c => S.catFollows.has(c)));
export const issuesOf = b => (b && S.issuesByBill.get(typeof b === 'string' ? b : b.id)) || [];
// The issue a bill is followed through, or null when it is followed on its own (or not at all).
export const viaIssue = b => issuesOf(b).find(issueFollowed) || null;
export const issueBills = i => (i.bill_ids || []).filter((id, k) => +(i.bill_years || [])[k] === followYear());
export const issuesIn = key => S.issues.filter(i => (i.categories || [i.category]).includes(key));
export const followedIssues = () => S.issues.filter(issueFollowed);
// The "My issues link" (R-123, the assessment's P2): one address that follows the same issues in any browser, with no
// account and nothing personal in it: the issues' public slugs and the categories' keys. Solves Instagram's browser to
// Chrome, Safari's seven-day wipe, the iPhone home-screen app starting fresh, and a new phone.
export const issuesLink = () => {
  const parts = [...[...(S.catFollows || [])].map(k => 'cat:' + k), ...[...(S.issueFollows || [])].map(id => S.issueById?.get(id)?.slug).filter(Boolean)];
  return parts.length ? `${location.origin}${location.pathname}${DEMO ? location.search : ''}#/follow/${parts.join(',')}` : '';
};
// An issue's calendar feed (R-125, the assessment's W3): cal/<slug>.ics, built daily by tools/share_pages.mjs with every
// hearing and testimony deadline on the issue's bills; webcal:// opens the phone's calendar app to subscribe. The sandbox
// has no feeds, so it points at the issue page.
export const calendarUrl = i => DEMO ? `#/issue/${i.slug}` : `webcal://${location.host}${location.pathname.replace(/[^/]*$/, '')}cal/${i.slug}.ics`;
export async function restoreFollows(slugs) {
  const issuesOn = [], catsOn = [];
  for (const x of slugs || []) {
    if (x.startsWith('cat:')) { if ((S.cats || []).some(c => c.key === x.slice(4))) catsOn.push(x.slice(4)); }
    else { const i = (S.issues || []).find(y => y.slug === x); if (i) issuesOn.push(i.id); }
  }
  if (!issuesOn.length && !catsOn.length) { toast('That link has no issues we know. Pick yours under Find.'); return false; }
  const ok = await setFollows({ issuesOn, catsOn });
  if (!ok) return false;
  wizSet({ done: true, skipped: true });   // they have a setup: no first visit
  const n = followedIssues().length;
  toast(`Your ${n === 1 ? 'issue is' : `${n} issues are`} here. Mahalo!`, { yay: true });
  try { app.onAct?.('restore'); } catch { /* counted only */ }
  return true;
}
// "What's next" after a result (R-126, the assessment's W4): where the bill goes from here, in one line, so a result is
// never a dead end. '' when nothing follows (it became law, or stopped).
export const followsAnything = () => S.watch.size > 0 || S.issueFollows.size > 0 || S.catFollows.size > 0;
// The categories this person cares about: picked at the start, followed whole, or holding an issue they follow.
const SUPPORTS = ['strongly_support', 'support', 'support_amend'], OPPOSES = ['strongly_oppose', 'oppose'];
export const issuePos = (bills, i) => { const ps = new Set(bills.map(b => b && b.hiphi_position).filter(Boolean));
  if (i?.stance === 'mixed') return 'mixed';
  if (i?.stance === 'support') return SUPPORTS.find(p => ps.has(p)) || 'support';
  if (i?.stance === 'oppose') return OPPOSES.find(p => ps.has(p)) || 'oppose';
  return [...SUPPORTS, ...OPPOSES, 'neutral'].find(p => ps.has(p)) || null; };
// "all of Food & Nutrition and 3 more issues", "7 issues": what this person follows, in words.
export function recomputeWatch() {
  const via = new Set();
  for (const i of S.issues) if (issueFollowed(i)) for (const id of issueBills(i)) via.add(id);
  const out = new Set([...S.direct, ...via]);
  for (const id of S.skips) if (!S.direct.has(id)) out.delete(id);   // "Not for me", unless also followed on its own
  S.viaIssues = via; S.watch = out;
}
// Categories and issues: loaded before anything else, because what a person follows is worked out from them.
export async function loadCatalog() {
  if (S.catalogLive === 'full') return;   // already in from the network this page life (the early path, R-122)
  let cats = [], issues = [], links = [], got = false, slim = false;
  if (DEMO) { cats = D.cats; issues = D.issues; links = D.issueLinks; got = true; }
  else {
    // track.html asks for the catalog before any module arrives (plain fetches, the key in the address, so no preflight),
    // with the issues slim: only what the topics screen shows. Its answer is taken first; the full rows (the bill lists,
    // the outlook) come with the library, and only they are kept for next time. Without either the page still works, by bills.
    if (window.__hiphiCatalog && !S.catalogLive) { try { [cats, issues, links] = await window.__hiphiCatalog; got = Array.isArray(cats) && Array.isArray(issues); slim = got && !!issues.length && !('bill_ids' in issues[0]); } catch { got = false; } }
    if (!got && S.supa) {
      try { const [c, i, l] = await Promise.all([S.supa.from('public_categories').select('*').order('sort_order'), S.supa.from('public_issues').select('*').order('sort_order'),
          S.supa.from('public_issue_links').select('issue_a,issue_b')]);
        cats = c.data || []; issues = i.data || []; links = l.data || []; got = true; } catch (e) { console.error(e); }
    }
    if (!got) return;   // the early path without a network answer: boot() asks again with the library
  }
  S.catalogLive = slim ? 'slim' : 'full';
  applyCatalog(cats, issues, links);
  if (slim) return;   // the slim rows draw the first screen; nothing from them is kept
  // A copy for next time (R-122): a returning browser draws its first screen from it before the network answers.
  if (!DEMO && cats.length) { try { localStorage.setItem(CATALOG_KEY, JSON.stringify({ at: Date.now(), cats, issues, links })); } catch { /* storage blocked */ } }
}
const CATALOG_KEY = 'hiphi_catalog';
function applyCatalog(cats, issues, links) {
  // Related issues (095, R-094): each issue's neighbours, both ways. Only the suggested bill reads them.
  S.issueLinks = new Map();
  for (const { issue_a: a, issue_b: b } of links) { (S.issueLinks.get(a) || S.issueLinks.set(a, new Set()).get(a)).add(b); (S.issueLinks.get(b) || S.issueLinks.set(b, new Set()).get(b)).add(a); }
  S.cats = cats;
  S.issues = issues.map(i => ({ ...i, categories: i.categories?.length ? i.categories : [i.category], bill_ids: i.bill_ids || [], bill_years: i.bill_years || [] }));
  S.issueById = new Map(S.issues.map(i => [i.id, i])); S.issueBySlug = new Map(S.issues.map(i => [i.slug, i]));
  S.issuesByBill = new Map();
  for (const i of S.issues) for (const id of i.bill_ids) (S.issuesByBill.get(id) || S.issuesByBill.set(id, []).get(id)).push(i);
}
// The catalog kept from the last visit, no older than a week: true when it was applied (R-122).
export function applyCachedCatalog() {
  try { const c = JSON.parse(localStorage.getItem(CATALOG_KEY) || 'null'); if (!c || !c.cats?.length || Date.now() - c.at > 7 * 864e5) return false; applyCatalog(c.cats, c.issues || [], c.links || []); return true; } catch { return false; }
}
// Follow or unfollow issues and whole categories in one go (the first visit, a category or issue page, Undo).
export async function setFollows({ issuesOn = [], issuesOff = [], catsOn = [], catsOff = [] } = {}) {
  const before = { i: new Set(S.issueFollows), c: new Set(S.catFollows) };
  issuesOn.forEach(x => S.issueFollows.add(x)); issuesOff.forEach(x => S.issueFollows.delete(x));
  catsOn.forEach(x => S.catFollows.add(x)); catsOff.forEach(x => S.catFollows.delete(x));
  recomputeWatch(); saveLocal();
  if (S.user && !DEMO) {
    const uid = S.user.id, calls = [];
    const addI = [...new Set(issuesOn)].filter(x => !before.i.has(x)), delI = issuesOff.filter(x => before.i.has(x));
    const addC = [...new Set(catsOn)].filter(x => !before.c.has(x)), delC = catsOff.filter(x => before.c.has(x));
    if (addI.length) calls.push(S.supa.from('issue_follows').insert(addI.map(issue_id => ({ user_id: uid, issue_id }))));
    if (delI.length) calls.push(S.supa.from('issue_follows').delete().eq('user_id', uid).in('issue_id', delI));
    if (addC.length) calls.push(S.supa.from('category_follows').insert(addC.map(category => ({ user_id: uid, category }))));
    if (delC.length) calls.push(S.supa.from('category_follows').delete().eq('user_id', uid).in('category', delC));
    const err = (await Promise.all(calls)).find(r => r.error)?.error;
    if (err) { toast(err, true); S.issueFollows = before.i; S.catFollows = before.c; recomputeWatch(); saveLocal(); return false; }
  }
  try { await (await import('./core.js')).loadBills(); } catch (e) { console.error(e); }   // core.js, from the kernel: a dynamic import, never a static cycle (R-122)
  return true;
}
// Stop following one issue. If it came with a whole category, that category becomes its other issues, one by one:
// "Follow all" also covered issues HIPHI takes up later, and taking one out ends that (the screen says so).
export async function loadUser() {
  S.user = null;
  S.stances = localStances();
  // This browser's own actions, now rather than with the bills (R-122): the first screen is drawn before the bills
  // arrive, and firstVisit() must see an action taken on a shared bill, or it would start the first visit over.
  S.done = localDone(); S.doneAt = localDoneAt();
  if (DEMO || !S.session) {
    S.direct = localWatch(); S.issueFollows = readSet(ISSUES_KEY); S.catFollows = readSet(CATS_KEY); S.skips = readSet(SKIPS_KEY);
    recomputeWatch(); return;
  }
  const { data, error } = await S.supa.rpc('ensure_public_user');
  if (error) { if (/staff/.test(error.message)) { toast('Staff accounts use the main app', true); await S.supa.auth.signOut({ scope: 'local' }); return; } throw error; }
  S.user = data;
  // Choices made on the sign-in page, before the account existed.
  let pending = null; try { pending = JSON.parse(localStorage.getItem(CONSENT_KEY) || 'null'); } catch {}
  // A new account takes them as given. An account that already recorded its choices (a returning person adding their
  // email on a second device) only ever gains what was asked for here: every email ask sends action_alerts false by
  // default, and that default must never switch off something the person chose earlier (9/19).
  if (pending) {
    const had = S.user.prefs || {}, first = !had.consent_at;
    const hearing_alerts = first ? !!pending.hearing_alerts : !!(had.hearing_alerts || pending.hearing_alerts);
    const action_alerts = first ? !!pending.action_alerts : !!(had.action_alerts || pending.action_alerts);
    // The name given in the wizard joins the account the same way issues do below: it fills in an account that
    // has none, and never overwrites one the account already has (it may have been set on another device since).
    // Read straight from this device's wiz() rather than the pending object: the magic link is opened on the
    // same device, and the name step comes AFTER the email step, so it wasn't typed yet when the link was sent.
    const name = had.name || (wiz().name || '').trim();
    const changed = first || hearing_alerts !== !!had.hearing_alerts || action_alerts !== !!had.action_alerts || name !== (had.name || '');
    if (changed) { const prefs = { ...had, hearing_alerts, action_alerts, ...(name ? { name } : {}), consent_at: new Date().toISOString() };
      const r = await S.supa.from('public_users').update({ prefs }).eq('id', S.user.id); if (!r.error) S.user.prefs = prefs; }
    try { localStorage.removeItem(CONSENT_KEY); } catch {}
  }
  S.consentCard = !(S.user.prefs || {}).consent_at;
  // Issues: this device's picks join an account that has none; otherwise the account's picks come to this device.
  { const mine = wiz().issues || [], theirs = (S.user.prefs || {}).issues || [];
    if (mine.length && !theirs.length) saveIssues(mine);
    else if (theirs.length && JSON.stringify(mine) !== JSON.stringify(theirs)) { const w = { ...wiz(), issues: theirs }; try { localStorage.setItem('hiphi_wiz', JSON.stringify(w)); } catch { /* ignore */ } } }
  // Name: the account's name (now possibly just set above) comes to this device too, so a returning visit on
  // another device is greeted by name without asking again.
  { const acctName = (S.user.prefs || {}).name || ''; if (acctName && acctName !== (wiz().name || '')) wizSet({ name: acctName }); }
  try { const pr = await S.supa.rpc('my_profile'); S.profile = pr.data?.[0] || {}; } catch { S.profile = {}; }
  // Lists followed on this device join the account (and stay in sync from here on).
  const lf = await S.supa.from('list_follows').select('list_id'); S.listFollows = new Set((lf.data || []).map(r => r.list_id));
  for (const id of localListFollows()) if (!S.listFollows.has(id)) { const r = await S.supa.rpc('follow_list', { p_list: id }); if (!r.error) S.listFollows.add(id); }
  try { localStorage.removeItem(LISTS_KEY); } catch {}
  // Lists people shared, followed on this device before signing in (R-013, pub/mylists.js), join the account the same way.
  { let toks = []; try { toks = JSON.parse(localStorage.getItem('hiphi_ulist_follows') || '[]'); } catch { /* none */ }
    for (const t of toks) { const r = await S.supa.rpc('follow_user_list', { p_token: t }); if (r.error) console.warn('shared list:', r.error.message); }
    if (toks.length) { try { localStorage.removeItem('hiphi_ulist_follows'); } catch { /* private mode */ } if (S.ul) S.ul.mine = null; } }
  const [wl, isf, caf, sk] = await Promise.all([S.supa.from('watchlist').select('bill_id,stance'), S.supa.from('issue_follows').select('issue_id'),
    S.supa.from('category_follows').select('category'), S.supa.from('bill_skips').select('bill_id')]);
  const server = new Set((wl.data || []).map(r => r.bill_id));
  // Issues, whole categories and "Not for me" chosen on this device join the account, as bills and lists do.
  const merge = async (table, col, local, have) => {
    const add = [...local].filter(x => !have.has(x));
    if (add.length) { const r = await S.supa.from(table).insert(add.map(x => ({ user_id: S.user.id, [col]: x }))); if (!r.error) add.forEach(x => have.add(x)); }
    return have;
  };
  S.issueFollows = await merge('issue_follows', 'issue_id', [...readSet(ISSUES_KEY)].filter(id => S.issueById.has(id)), new Set((isf.data || []).map(r => r.issue_id)));
  S.catFollows = await merge('category_follows', 'category', [...readSet(CATS_KEY)].filter(k => S.cats.some(c => c.key === k)), new Set((caf.data || []).map(r => r.category)));
  S.skips = await merge('bill_skips', 'bill_id', readSet(SKIPS_KEY), new Set((sk.data || []).map(r => r.bill_id)));
  // First sign-in: what was starred on this device joins the account, with the stance taken on it.
  const local = localWatch(); const missing = [...local].filter(id => !server.has(id));
  if (missing.length) { await S.supa.from('watchlist').insert(missing.map(bill_id => ({ user_id: S.user.id, bill_id, stance: S.stances[bill_id] || null }))); missing.forEach(id => server.add(id)); }
  // Stances: the account wins where it has one; a stance taken on this device for a bill already followed is sent up.
  for (const r of wl.data || []) { if (r.stance) S.stances[r.bill_id] = r.stance; else if (S.stances[r.bill_id]) await S.supa.from('watchlist').update({ stance: S.stances[r.bill_id] }).eq('user_id', S.user.id).eq('bill_id', r.bill_id); }
  saveStances();
  S.direct = server; recomputeWatch(); saveLocal();
}
// ---------------- curated lists ----------------
// HIPHI staff curate lists of public bills. Following a list follows every
// bill on it now and every bill added later (the database does that for
// signed-in members; signed-out follows live in this browser and join the
// account at sign-in).
export function localListFollows() { try { return new Set(JSON.parse(localStorage.getItem(LISTS_KEY) || '[]')); } catch { return new Set(); } }
export async function supa() { return S.supa || makeClient(); }
export function onb() { try { return JSON.parse(localStorage.getItem('hiphi_onb') || '{}'); } catch { return {}; } }
export function onbSet(patch) { const o = { ...onb(), ...patch }; try { localStorage.setItem('hiphi_onb', JSON.stringify(o)); } catch { /* ignore */ } return o; }
// The star on one bill. A bill that came with an issue: pressing it is "Not for me" (the issue stays followed). A bill
// nobody's issue covers: it follows or unfollows that bill on its own. Pressing it again undoes either.
export const bill = id => S.bills.find(b => b.id === id);
export const alive = b => !['dead', 'vetoed', 'enacted', 'governor', 'ballot'].includes(b.stage || '') && !HELD_RE.test(b.last_action || '');
export function nudgeOk() {
  if (S.session || S.nudgedThisVisit) return false;
  const o = onb(), n = o.nudgeNo || 0, at = o.nudgeNoAt ? Date.parse(o.nudgeNoAt) : 0;
  return !n || Date.now() - at > (n === 1 ? 14 : 60) * 864e5;
}
export function nudge(kind) { if (nudgeOk()) { S.nudge = kind; S.nudgedThisVisit = true; } }
// ---- the session calendar: opens the third Wednesday of January, ends at sine die ----
export const thirdWed = y => { const dow = new Date(Date.UTC(y, 0, 1)).getUTCDay(); return `${y}-01-${String(1 + ((3 - dow + 7) % 7) + 14).padStart(2, '0')}`; };
export const hiT = d => new Date(String(d).slice(0, 10) + 'T12:00:00-10:00').getTime();
export function sessionInfo() {
  const sd = S.deadlines.find(d => d.key === 'sine_die') || S.deadlines[S.deadlines.length - 1];
  const yr = sd ? +String(sd.deadline_date).slice(0, 4) : new Date().getFullYear(), end = sd ? String(sd.deadline_date).slice(0, 10) : `${yr}-05-08`, open = thirdWed(yr);
  let phase = Date.now() < hiT(open) ? 'before' : Date.now() <= hiT(end) + 864e5 ? 'in' : 'after';
  if (DEMO && new URLSearchParams(location.search).get('season') === 'off') phase = 'after';   // sandbox preview of the recap
  return { yr, open, end, phase, recapYear: phase === 'before' ? yr - 1 : yr, nextOpen: phase === 'in' ? null : thirdWed(phase === 'before' ? yr : yr + 1) };
}
export function myActions() {
  return [...S.done].map(k => { const [bill_id, hearing_id, kind] = k.split('|'), at = (S.doneAt || {})[k] || null;
    return { k, bill_id, hearing_id: hearing_id || null, kind, at, year: at ? +hstDay(at).slice(0, 4) : null }; }).filter(a => KINDS.includes(a.kind));
}
export function wiz() { try { return JSON.parse(localStorage.getItem('hiphi_wiz') || '{"step":1,"issues":[]}'); } catch { return { step: 1, issues: [] }; } }
export function wizSet(patch) { const w = { ...wiz(), ...patch }; try { localStorage.setItem('hiphi_wiz', JSON.stringify(w)); } catch { /* ignore */ }
  if ('issues' in patch) saveIssues(w.issues);
  return w; }
// Picked issues ride along with the account (public_users.prefs.issues), so "we saved your issues" is true on any
// device. Signed out, they live in this browser only. A failed save is silent: the local copy still works.
function saveIssues(list) {
  if (DEMO || !S.user) return;
  const issues = [...new Set(list || [])].slice(0, 20), had = (S.user.prefs || {}).issues || [];
  if (JSON.stringify(had) === JSON.stringify(issues)) return;
  const prefs = { ...(S.user.prefs || {}), issues }; S.user.prefs = prefs;
  S.supa.from('public_users').update({ prefs }).eq('id', S.user.id).then(r => { if (r.error) console.error(r.error); });
}
// ---------------- plain language (redesign 9/19) ----------------
// Newcomers never see Capitol shorthand ("2nd Lateral", "Decking", "HHS/CPN", "Rm 229") outside "More details".
// Every screen words bills, hearings and deadlines through these helpers so the whole page says things one way.
export const EMOJI_TO_ICON = { '🥗': 'salad', '🌊': 'thermometer-sun', '🍺': 'shield-check', '🚭': 'cigarette-off', '🦷': 'smile', '🌱': 'sprout',
  '💉': 'syringe', '🤝': 'heart-handshake', '🏥': 'heart-pulse', '☀️': 'heart-pulse', '☀': 'heart-pulse', '🧒': 'baby', '📋': 'heart-pulse', '☰': 'list-checks' };
// Issue and list icons are Lucide names now; an emoji left in the data still maps to one.
export function issueIcon(v, kind = 'issue') {
  const x = String(v || '').trim();
  return ICONS[x] ? x : EMOJI_TO_ICON[x] || EMOJI_TO_ICON[x.replace(/️/g, '')] || (kind === 'list' ? 'list-checks' : 'heart-pulse');
}
// Issues in the order a newcomer should see them: the most live bills first, the catch-all last.
export function issues() {
  return groups().map(g => ({ ...g, icon: issueIcon(g.icon), general: /general/i.test(g.key) }))
    .sort((a, b) => a.general - b.general || (b.live > 0) - (a.live > 0) || (b.live || 0) - (a.live || 0) || a.sort_order - b.sort_order);
}
// The category a bill's issue sits in, as a line on a card ("Food & Nutrition", its icon). Coalition names are HIPHI's
// own way of organising its partners and no longer show on the public page (R-018, answer 5); a bill with no issue
// falls back to its coalition only until staff give it one.
export function posInfo(b) {
  const p = b?.hiphi_position;
  if (/support/.test(p || '')) return { text: p === 'support_amend' ? 'HIPHI supports with changes' : p === 'strongly_support' ? 'HIPHI strongly supports' : 'HIPHI supports',
    icon: 'thumbs-up', strong: p === 'strongly_support', verb: 'support' };
  if (/oppose/.test(p || '')) return { text: p === 'strongly_oppose' ? 'HIPHI strongly opposes' : 'HIPHI opposes',
    icon: 'thumbs-down', strong: p === 'strongly_oppose', verb: 'oppose' };
  if (p === 'neutral') return { text: 'HIPHI has comments', icon: 'message-square', verb: 'comment on' };
  if (p === 'mixed') return { text: 'HIPHI’s side depends on the bill', icon: 'scale' };   // an issue's stance only (094)
  return null;
}
export const firstVisit = () => !followsAnything() && !myActions().length && !hasDrafts() && ((!wiz().done && !wiz().skipped) || readyForSession());
const hasDrafts = () => { try { return Object.keys(JSON.parse(localStorage.getItem('hiphi_me') || '{}')?.drafts || {}).length > 0; } catch { return false; } };
// Picked issues off-season (step O3 saves the opening day in wiz().ready): once the session is open, show them the bills.
export const readyForSession = () => !!wiz().ready && !followsAnything() && sessionInfo().phase === 'in' && Date.now() >= hiT(wiz().ready);
// A bill's address (R-110). Numbers start again at HB 1 every session, so a bill from an earlier session carries its
// year (#/bill/2026/HB2121) and the current session's bills keep the short form (#/bill/HB2121), which opens the
// current session's bill when a number repeats. yearPrefix: '' for the current session, '2026/' for an earlier one.
export const yearPrefix = b => b && b.session_year && +b.session_year !== sessionInfo().yr ? `${b.session_year}/` : '';
export const billRef = b => yearPrefix(b) + String(b.bill_number).replace(/\s/g, '');
export const billPath = b => '#/bill/' + billRef(b);
// The address to share a bill at (R-067, R-113): a bill HIPHI has a position on has its own share page (b/HB2121, or
// b/2026/HB2121 for an earlier session; built daily by tools/share_pages.mjs), so a link pasted into a text or a post
// previews with the bill's name, and the friend's arrival counts as a share (?via=share); 404.html catches a page not
// built yet. Other bills, and the sandbox, share the tracker's own address. An issue has i/<slug> the same way.
export const spaced = n => String(n || '').replace(/^([A-Z]+)\s*(\d)/, '$1 $2');   // "HB1563" -> "HB 1563"
// Asking a chair for a hearing is remembered per committee, so a bill asked about in its House committee is offered
// again when it later waits in the Senate. The email itself is still the person's action under the usual key
// (<bill id>||email): that is what is counted and what reaches their account. The committee mark,
// <bill id>|<committee code as referred, e.g. HHS/EIG>|ask, lives in this browser only: 'ask' is not an action kind, so
// it is neither counted nor uploaded. A mark from before 9/19 (the usual key, with no committee mark on the bill at
// all) still counts, for every committee.
