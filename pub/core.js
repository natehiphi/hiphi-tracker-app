// HIPHI public tracker: state, data and the plain-language layer (no screens here).
// Screens live in pub/*.js and import from this module; pub/app.js owns routing and the page frame.
// Moved out of track.js on 9/19 for the mobile-first redesign; the data code is unchanged unless a comment says so.
import { billStop, COLUMNS, BOARD_EXPLAINER, CHAMBER_NAME, hearingStream, pathwayStops, isResolution, isOneChamber, HELD_RE, stoppedAt } from '../stops.js';
import { ICONS, icon } from '../icons.js';
import { topicOf } from './topics.js';
import { rankAll, shortList, markShown, actedKind } from './rank.js';
export { billStop, COLUMNS, BOARD_EXPLAINER, CHAMBER_NAME, hearingStream, pathwayStops, isResolution, isOneChamber, HELD_RE, ICONS, icon };
// Filled in by app.js: the screens call app.render() / app.go() without importing app.js (no import cycle).
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
export const asDate = d => new Date(/^\d{4}-\d{2}-\d{2}$/.test(String(d)) ? d + 'T12:00:00-10:00' : d);   // a date-only value is a Hawaiʻi day
export const fmtDate = (d, o) => d ? asDate(d).toLocaleString('en-US', { timeZone: HST, month: 'numeric', day: 'numeric', ...o }) : '';
export const fmtDT = d => fmtDate(d, { weekday: 'short', hour: 'numeric', minute: '2-digit' });
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
export const companionsOf = b => (b?.companions || []).flatMap(c => String(c).split(/[,\s]+/))
  .map(c => c.trim().toUpperCase()).filter(c => /^[A-Z]+\d+$/.test(c) && c !== b.bill_number);
// What the bill does, in a sentence or two: HIPHI's plain summary, else the cleaned official description. Cut at the
// end of a sentence when one fits, never mid-word.
export function blurb(b, n = 110) {
  const t = (b.hiphi_summary || cleanDesc(b.description) || b.title || '').replace(/\s+/g, ' ').trim();
  if (t.length <= n) return t;
  const cut = t.slice(0, n + 1), stop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('; '));
  if (stop >= 40) return cut.slice(0, stop + 1).replace(/;$/, '.');
  return t.slice(0, n - 1).replace(/\s\S*$/, '').replace(/[,;:]$/, '') + '…';
}
// The name a card or page leads with: the nickname when there is one, else the plain summary.
export const headline = (b, n = 110) => nick(b) || blurb(b, n);
// "Bans the sale of…" reads as a fragment inside a letter; "It bans the sale of…" is a sentence. Only when the text
// clearly starts with a verb (a summary that starts with a noun, "Counties may…", is left alone).
export const asSentence = t => /^[A-Z][a-z]+s,? (?!(?:may|must|shall|will|can|are|is|who|that|and|or|of|with|in|on|under|for|from|at|by) )/.test(t) ? 'It ' + t[0].toLowerCase() + t.slice(1) : t;
export const inWhen = iso => { const ms = new Date(iso) - Date.now(); if (ms <= 0) return 'passed'; const h = Math.round(ms / 36e5); return h < 48 ? `in ${h}h` : `in ${Math.ceil(ms / 864e5)}d`; };
export const clean = r => (r || 'room TBD').replace(/\s*via videoconference/i, '').replace(/^Conference Room\s+/i, 'Rm ').replace(/^CR\s+/i, 'Rm ');
export const STAGE_LABEL = { introduced: 'Introduced', first_triple: '1st Triple', first_lateral: '1st Lateral', first_decking: '1st Decking',
  first_floor: 'Floor vote', first_crossover: 'Crossed over', second_triple: '2nd Triple', second_lateral: '2nd Lateral', second_decking: '2nd Decking',
  second_floor: 'Floor vote', second_crossover: 'Passed both', conference: 'Conference', governor: 'Governor', enacted: 'Law', vetoed: 'Vetoed',
  ballot: 'To the voters', dead: 'Dead' };
// The same stages in plain language, for people who do not live at the Capitol.
export const STAGE_PLAIN = { introduced: 'Introduced and waiting to be sent to a committee',
  first_triple: 'In its first committee; a triple-referred bill that must be heard before the Triple Filing deadline',
  first_lateral: 'In a committee of its first chamber; it must be heard before the Lateral deadline',
  first_decking: 'In the last committee of its first chamber; it must pass before the Decking deadline',
  first_floor: 'Through its committees; waiting for a vote of the full chamber before the Crossover deadline',
  first_crossover: 'Passed its first chamber; now in the other chamber',
  second_triple: 'In its first committee of the second chamber; it must be heard before the Triple Filing deadline',
  second_lateral: 'In a committee of the second chamber; it must be heard before the Lateral deadline',
  second_decking: 'In the last committee of the second chamber; it must pass before the Decking deadline',
  second_floor: 'Through the second chamber’s committees; waiting for a vote of the full chamber',
  second_crossover: 'Passed both chambers in different versions; the first chamber decides whether to agree',
  conference: 'House and Senate negotiators are reconciling their versions',
  governor: 'On the Governor’s desk, waiting for signature or veto',
  enacted: 'Signed into law', vetoed: 'Vetoed by the Governor', ballot: 'Passed the Legislature; the voters decide in November',
  dead: 'Did not advance this session' };
export const RAIL = [['introduced', 'Intro'], ['first_lateral', '1st Lat'], ['first_decking', '1st Deck'], ['first_crossover', 'Cross'],
  ['second_lateral', '2nd Lat'], ['second_decking', '2nd Deck'], ['conference', 'Conf'], ['governor', 'Gov'], ['enacted', 'Law']];
export const RAIL_IDX = { introduced: 0, first_triple: 1, first_lateral: 1, first_decking: 2, first_floor: 2, first_crossover: 3, second_triple: 4, second_lateral: 4,
  second_decking: 5, second_floor: 5, second_crossover: 5, conference: 6, governor: 7, enacted: 8, vetoed: 7, ballot: 7, dead: null };
export const COMMITTEE_STAGES = ['introduced', 'first_triple', 'first_lateral', 'first_decking', 'second_triple', 'second_lateral', 'second_decking'];
export const SMALL = new Set(['a','an','and','as','at','but','by','for','in','of','on','or','the','to','via','with','nor','per','from']);
export const titleCase = t => String(t || '').toLowerCase().split(/\s+/).map((w, i, a) => (i && i < a.length - 1 && SMALL.has(w.replace(/[^a-z]/g, ''))) ? w : w.replace(/(^|[-("'/])([a-z])/g, (m, p, c) => p + c.toUpperCase())).join(' ');
export const POS = { strongly_support: 'Strongly supports', support: 'Supports', support_amend: 'Supports with amendments', strongly_oppose: 'Strongly opposes', oppose: 'Opposes', neutral: 'Comments', monitor: 'Monitoring' };
export const OUTCOME_LABEL = { passed: 'Passed', passed_amended: 'Passed with amendments', deferred: 'Deferred', recommitted: 'Recommitted' };
export const OUTCOME_CLS = { passed: 'c-green', passed_amended: 'c-gold', deferred: 'c-red', recommitted: 'c-gray' };
export const billNum = b => b.bill_number + (b.current_version ? ' ' + b.current_version : '');
// Coalitions keep their internal name as the key; the public sees public_name.
export const cname = n => (S.coalitions || []).find(c => c.name === n)?.public_name || n;
// Tiles are grouped by public name: two internal coalitions can share one tile.
export function groups() {
  const g = {};
  for (const c of S.coalitions || []) { const k = c.public_name || c.name; const x = g[k] ??= { key: k, names: [], icon: c.icon, description: c.description, bills: 0, live: 0, sort_order: c.sort_order || 99 };
    x.names.push(c.name); x.bills += c.bills || 0; x.live += c.live || 0; x.icon = x.icon || c.icon; x.description = x.description || c.description; x.sort_order = Math.min(x.sort_order, c.sort_order || 99); }
  return Object.values(g);
}
export const groupNames = k => (groups().find(g => g.key === k || g.names.includes(k)) || { names: [k] }).names;
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
export async function init() {
  if (DEMO) { await demoLoad(); return; }
  const { createClient } = await import(SUPABASE_JS);
  S.supa = createClient(SUPABASE_URL, SUPABASE_KEY, AUTH);
  const { data } = await S.supa.auth.getSession(); S.session = data.session;
  S.supa.auth.onAuthStateChange((_e, sess) => { const had = !!S.session; S.session = sess; if (!!sess !== had) app.boot(); });
}
// ---------------- sandbox data ----------------
export const D = { bills: [], index: [], hearings: [], activity: [], outcomes: [], lists: [], listBills: [], cats: [], issues: [], issueLinks: [] };
export async function demoLoad() {
  const snap = await (await fetch('demo/snapshot.json?v=20260930b', { cache: 'force-cache' })).json();   // bump v when the snapshot is rebuilt, or browsers keep the old copy
  const campName = Object.fromEntries(snap.campaigns.map(c => [c.id, c]));
  const coalOf = {}; for (const r of snap.billCampaigns) { const c = campName[r.campaign_id]; if (c?.is_public) (coalOf[r.bill_id] ??= []).push(c.name); }
  const seed = id => [...id].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);
  // Shape tracked bills like public_all_bills; every tracked bill is public.
  D.bills = snap.bills.map(b => ({ id: b.id, bill_number: b.bill_number, session_year: b.session_year, chamber: b.chamber, title: b.title, description: b.description,
    committee: b.committee, referrals: b.referrals, stage: b.stage, last_action: b.last_action, last_action_date: b.last_action_date, state_url: b.state_url,
    sponsors: b.sponsors, companions: b.companions, origin_stops: b.origin_stops, second_stops: b.second_stops, current_version: b.current_version,
    died_deadline: b.died_deadline, died_at_stage: b.died_at_stage, hiphi_position: b.position, hiphi_summary: b.public_summary, hiphi_action: b.public_action,
    hiphi_nickname: b.is_public ? b.nickname || null : null,   // as public_all_bills does
    hiphi_recommended: !!b.recommended, hiphi_points: b.is_public && b.talking_points?.length ? b.talking_points : null,   // 084, the testimony walkthrough's talking points (R-068)
    hiphi_follows: true, coalitions: coalOf[b.id] || [], watchers: b.priority === 1 ? 12 + seed(b.id) % 40 : seed(b.id) % 9 }));
  D.index = snap.index.map(b => ({ id: b.id, bill_number: b.bill_number, chamber: b.chamber, title: b.title, description: null, stage: 'introduced', referrals: [], sponsors: [], companions: [], coalitions: [], watchers: 0, hiphi_follows: false, sandbox_untracked: true }));
  D.hearings = snap.hearings.map(h => ({ ...h, bill_number: snap.bills.find(b => b.id === h.bill_id)?.bill_number }));
  D.activity = snap.activity.map(a => ({ bill_id: a.bill_id, title: a.title, details: a.details, occurred_at: a.occurred_at }));
  D.outcomes = snap.outcomes;
  if (SEASON_OFF) {
    // The real end of the 2026 session, from the snapshot's b.final (R-067: an imagined ending showed SB 2175, which became
    // law, as stopped, so the between-sessions sandbox disagreed with the live page). A snapshot built before 9/28 has
    // no final: then the old imagined ending stands in.
    const fin = new Map(snap.bills.filter(b => b.final).map(b => [b.id, b.final]));
    for (const b of D.bills) {
      const f = fin.get(b.id);
      if (f) Object.assign(b, { stage: f.stage, last_action: f.last_action, last_action_date: f.last_action_date, died_at_stage: f.died_at_stage, died_deadline: f.died_deadline });
      else if (!['dead', 'enacted', 'vetoed'].includes(b.stage)) {
        b.stage = b.hiphi_position === 'strongly_support' && ['conference', 'second_decking', 'second_crossover', 'governor'].includes(b.stage) ? 'enacted' : 'dead';
        if (b.stage === 'dead' && !b.died_deadline) b.died_deadline = 'Sine die'; }
    }
  }
  D.lists = (snap.lists || []).map(l => ({ ...l, is_published: true })); D.listBills = snap.listBills || [];
  // Categories and issues, shaped like public_categories / public_issues: an issue lists the position bills that carry
  // it, with each one's session, and every bill knows its issues (public_all_bills.hiphi_issues).
  D.cats = (snap.categories || []).slice().sort((x, y) => x.sort_order - y.sort_order);
  { const extra = {}; for (const r of snap.issueCategories || []) (extra[r.issue_id] ??= []).push(r.category);
    const byId = new Map(D.bills.map(b => [b.id, b])), byIssue = {}, ofBill = {};
    for (const r of snap.billIssues || []) { const b = byId.get(r.bill_id); if (!b || !b.hiphi_position || b.hiphi_position === 'monitor') continue;
      (byIssue[r.issue_id] ??= []).push(b); (ofBill[b.id] ??= []).push(r.issue_id); }
    // As public_issues does (R-023): top_priority is true when one of the issue's position bills in the latest session is the
    // team's priority 1 (only that flag is public, never a bill's priority); first_visit is the staff switch "Show in the
    // first visit" (true unless staff turned it off).
    const prio = new Map(snap.bills.map(x => [x.id, x.priority])), latest = Math.max(...snap.bills.map(x => +x.session_year || 0));
    D.issues = (snap.issues || []).map(i => { const bs = (byIssue[i.id] || []).sort((a, b) => a.bill_number.localeCompare(b.bill_number));
      return { ...i, categories: [i.category, ...(extra[i.id] || []).filter(c => c !== i.category)], bill_ids: bs.map(b => b.id), bill_years: bs.map(b => b.session_year), followers: 0,
        first_visit: i.first_visit !== false, top_priority: bs.some(b => +b.session_year === latest && prio.get(b.id) === 1) }; });
    for (const b of D.bills) b.hiphi_issues = ofBill[b.id] || null;
    D.issueLinks = snap.issueLinks || []; }   // public_issue_links: pairs of related issues (095, R-094)
  S.legislators = snap.legislators || []; S.committeeMembers = snap.committeeMembers || []; S.counterparts = snap.counterparts || [];
  S.deadlines = snap.deadlines.slice().sort((x, y) => x.deadline_date.localeCompare(y.deadline_date));
  S.committees = Object.fromEntries(snap.committees.map(c => [c.code, c]));
  S.slots = snap.slots;
  const counts = {}, live = {}; for (const b of D.bills) for (const n of b.coalitions) { counts[n] = (counts[n] || 0) + 1; if (alive(b)) live[n] = (live[n] || 0) + 1; }
  S.coalitions = snap.campaigns.filter(c => c.is_public && counts[c.name]).map(c => ({ name: c.name, public_name: c.public_name || c.name, slug: c.slug, description: c.description, icon: c.icon, bills: counts[c.name], live: live[c.name] || 0, sort_order: c.sort_order }));
}
export const dmatch = (b, q) => { const ql = q.toLowerCase(), qn = ql.replace(/\s/g, ''); return b.bill_number.toLowerCase().includes(qn) || (b.title || '').toLowerCase().includes(ql) || (b.description || '').toLowerCase().includes(ql); };
// "I did it" marks: in this browser until sign-in, then in public_actions.
export const DONE_KEY = DEMO ? 'hiphi_done_demo' : 'hiphi_done';
export function localDone() { try { return new Set(JSON.parse(localStorage.getItem(DONE_KEY) || '[]')); } catch { return new Set(); } }
export function saveDone() { try { localStorage.setItem(DONE_KEY, JSON.stringify([...S.done])); } catch { /* ignore */ } }
export const doneKey = (billId, hearingId, kind) => `${billId}|${hearingId || ''}|${kind}`;
// When each mark was made (for the session weeks and the recap), in this browser; the account has created_at.
export const DONE_AT_KEY = DEMO ? 'hiphi_done_at_demo' : 'hiphi_done_at';
export function localDoneAt() { try { return JSON.parse(localStorage.getItem(DONE_AT_KEY) || '{}') || {}; } catch { return {}; } }
export function saveDoneAt() { try { localStorage.setItem(DONE_AT_KEY, JSON.stringify(S.doneAt || {})); } catch { /* ignore */ } }
export const KINDS = ['testimony', 'email', 'legislators', 'attend', 'share'];   // 'legislators': an email to your own legislators (089, R-087)
export async function loadActions(ids) {
  S.done = localDone(); S.doneAt = localDoneAt();
  if (DEMO) { if (new URLSearchParams(location.search).has('seed')) seedDemoActions();
    for (const id of ids) if (!S.actionCounts[id]) { const n = [...id].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 3) % 60; S.actionCounts[id] = { testimonies: n, emails: n >> 2, attending: n >> 3 }; }
    // sandbox numbers for one hearing and one bill, so those lines have something to show
    S.voices = Object.fromEntries(D.hearings.map(h => [h.id, [...h.id].reduce((a, ch) => (a * 33 + ch.charCodeAt(0)) >>> 0, 7) % 50]).filter(([, n]) => n >= 10));
    S.billStances = Object.fromEntries(ids.map(id => { const n = [...id].reduce((a, ch) => (a * 29 + ch.charCodeAt(0)) >>> 0, 5) % 90; return [id, { bill_id: id, people: n, support: Math.round(n * 0.86), oppose: n - Math.round(n * 0.86) }]; }).filter(([, r]) => r.people >= 10));
    S.totals = {}; return; }
  if (S.session && S.user) {
    const { data } = await S.supa.from('public_actions').select('bill_id,hearing_id,kind,created_at');
    const server = new Set();
    (data || []).forEach(a => { const k = doneKey(a.bill_id, a.hearing_id, a.kind); server.add(k); S.doneAt[k] = a.created_at; });
    // Marks made on this device before signing in join the account, so they count in the totals and follow the person.
    const up = [...S.done].filter(k => !server.has(k)).map(k => { const [bill_id, hearing_id, kind] = k.split('|');
      return { user_id: S.session.user.id, bill_id, hearing_id: hearing_id || null, kind, ...(S.doneAt[k] ? { created_at: S.doneAt[k] } : {}) }; }).filter(r => KINDS.includes(r.kind));
    if (up.length) { const r = await S.supa.from('public_actions').upsert(up, { onConflict: 'user_id,bill_id,hearing_id,kind', ignoreDuplicates: true });
      if (r.error) for (const row of up) await S.supa.from('public_actions').upsert(row, { onConflict: 'user_id,bill_id,hearing_id,kind', ignoreDuplicates: true }); }
    server.forEach(k => S.done.add(k)); saveDone(); saveDoneAt();
  }
  const hids = [...new Set([...S.hearings, ...((S.featured || {}).hearings || [])].map(h => h.id))];
  const [c, v, st] = await Promise.all([
    inChunks(ids, ch => S.supa.from('public_action_counts').select('*').in('bill_id', ch)),
    inChunks(hids.slice(0, 300), ch => S.supa.from('public_hearing_voices').select('hearing_id,people').in('hearing_id', ch)),
    inChunks(ids, ch => S.supa.from('public_bill_stances').select('*').in('bill_id', ch))]);
  c.forEach(r => { S.actionCounts[r.bill_id] = r; });
  S.voices = Object.fromEntries(v.map(r => [r.hearing_id, r.people]));
  S.billStances = { ...(S.billStances || {}), ...Object.fromEntries(st.map(r => [r.bill_id, r])) };
  S.totals = {};   // community-wide totals are no longer shown (9/19); numbers live inside one bill or one hearing
}
export async function markDone(billId, hearingId, kind, on = true, { quiet = false } = {}) {
  const k = doneKey(billId, hearingId, kind);
  const firstTestimony = on && kind === 'testimony' && ![...S.done].some(x => x.endsWith('|testimony'));   // across devices once signed in
  if (on) { S.done.add(k); S.doneAt[k] = new Date().toISOString(); S.justDone = billId + '|' + (hearingId || ''); setTimeout(() => { S.justDone = null; }, 1200); }
  else { S.done.delete(k); delete S.doneAt[k]; }
  saveDone(); saveDoneAt();
  if (on && !quiet) { celebrate(kind, firstTestimony); }
  if (on) app.onAct?.(kind);   // counted privately, its kind only (visitlog.js logAct, migration 078)
  if (on && !S.session) nudge('action');
  const c = S.actionCounts[billId] ??= { testimonies: 0, emails: 0, attending: 0 };
  const col = { testimony: 'testimonies', email: 'emails', legislators: 'emails', attend: 'attending' }[kind]; if (col) c[col] = Math.max(0, (c[col] || 0) + (on ? 1 : -1));
  if (!DEMO && S.session && S.user) {
    const r = on ? await S.supa.from('public_actions').insert({ user_id: S.session.user.id, bill_id: billId, hearing_id: hearingId || null, kind })
                 : await S.supa.from('public_actions').delete().eq('user_id', S.session.user.id).eq('bill_id', billId).eq('kind', kind).is('hearing_id', hearingId || null);
    if (r.error && !/duplicate/.test(r.error.message)) toast(r.error, true);
  }
  return { firstTestimony };
}
// Where the person stands on a bill: 'support' | 'oppose' | 'unsure'. Kept in this browser; for a signed-in person it
// also rides on their follow (watchlist.stance, migration 056). A first visit is "follow a few bills and say where
// you stand" (Nate, 9/19); the asks to act come on later visits.
export const STANCE_KEY = DEMO ? 'hiphi_stances_demo' : 'hiphi_stances';
export function localStances() { try { return JSON.parse(localStorage.getItem(STANCE_KEY) || '{}') || {}; } catch { return {}; } }
export function saveStances() { try { localStorage.setItem(STANCE_KEY, JSON.stringify(S.stances || {})); } catch { /* ignore */ } }
export const myStance = id => (S.stances || {})[id] || null;
export async function setStance(id, stance) {
  S.stances ??= {};
  if (stance) S.stances[id] = stance; else delete S.stances[id];
  saveStances();
  if (!DEMO && S.session && S.user && S.watch.has(id)) {
    // A stance lives on the bill's own follow row. A bill followed through an issue has none, so taking a stand on it
    // gives it one (and keeps it followed if the issue is later unfollowed: you took a stand on it). Clearing a stance
    // never adds a row.
    const r = stance
      ? await S.supa.from('watchlist').upsert({ user_id: S.user.id, bill_id: id, stance }, { onConflict: 'user_id,bill_id' })
      : await S.supa.from('watchlist').update({ stance: null }).eq('user_id', S.user.id).eq('bill_id', id);
    if (r.error) toast(r.error, true);
    else if (stance && !S.direct.has(id)) { S.direct.add(id); saveLocal(); }
  }
}
// Does the person's stance match HIPHI's? null when either side has none. HIPHI's scripted letters and emails are
// offered only when it matches or the person has not said; someone who disagrees is pointed to the Capitol's own form.
export function agrees(b) {
  const mine = myStance(b.id), p = b.hiphi_position || '';
  if (!mine || mine === 'unsure' || !/support|oppose/.test(p)) return null;
  return (mine === 'support') === /support/.test(p);
}
// ---------------- following: issues, whole categories, single bills (063, R-018) ----------------
// Nate, 9/21: people follow issues, not bills; the bills come to them because of the issue. What a person chose is kept
// as four sets - issues, whole categories ("Follow all": Nate, it also brings issues HIPHI takes up there later), bills
// followed on their own, and bills marked "Not for me" - and S.watch, the followed bills every screen reads, is worked
// out from them here, the same way the database's follow_set decides who gets a hearing alert.
const readSet = k => { try { return new Set(JSON.parse(localStorage.getItem(k) || '[]')); } catch { return new Set(); } };
const writeSet = (k, s) => { try { localStorage.setItem(k, JSON.stringify([...s])); } catch { /* private mode */ } };
export const localWatch = () => readSet(LOCAL_KEY);   // bills followed on their own
export function saveLocal() { writeSet(LOCAL_KEY, S.direct); writeSet(ISSUES_KEY, S.issueFollows); writeSet(CATS_KEY, S.catFollows); writeSet(SKIPS_KEY, S.skips); }
// The session whose bills an issue brings: this one, or between sessions the one just ended (so its outcomes show).
export const followYear = () => { const si = sessionInfo(); return si.phase === 'in' ? si.yr : si.recapYear; };
export const catOf = key => S.cats.find(c => c.key === key) || null;
export const issueFollowed = i => !!i && (S.issueFollows.has(i.id) || (i.categories || [i.category]).some(c => S.catFollows.has(c)));
export const issuesOf = b => (b && S.issuesByBill.get(typeof b === 'string' ? b : b.id)) || [];
// The issue a bill is followed through, or null when it is followed on its own (or not at all).
export const viaIssue = b => issuesOf(b).find(issueFollowed) || null;
export const issueBills = i => (i.bill_ids || []).filter((id, k) => +(i.bill_years || [])[k] === followYear());
export const issuesIn = key => S.issues.filter(i => (i.categories || [i.category]).includes(key));
export const followedIssues = () => S.issues.filter(issueFollowed);
export const followsAnything = () => S.watch.size > 0 || S.issueFollows.size > 0 || S.catFollows.size > 0;
// The categories this person cares about: picked at the start, followed whole, or holding an issue they follow.
export const likedCats = () => new Set([...(wiz().issues || []), ...S.catFollows, ...followedIssues().flatMap(i => i.categories)]);
// HIPHI's position on an issue. Staff set its stance (094, R-093): support, oppose or mixed, and the bills only say how
// strongly ("HIPHI strongly supports" when one of them is strongly supported). Not set, it comes from the bills that carry
// it: what it is for, when it is for any of them (an issue can hold a bill HIPHI opposes because it would push the other
// way), else what it opposes, else comments.
const SUPPORTS = ['strongly_support', 'support', 'support_amend'], OPPOSES = ['strongly_oppose', 'oppose'];
export const issuePos = (bills, i) => { const ps = new Set(bills.map(b => b && b.hiphi_position).filter(Boolean));
  if (i?.stance === 'mixed') return 'mixed';
  if (i?.stance === 'support') return SUPPORTS.find(p => ps.has(p)) || 'support';
  if (i?.stance === 'oppose') return OPPOSES.find(p => ps.has(p)) || 'oppose';
  return [...SUPPORTS, ...OPPOSES, 'neutral'].find(p => ps.has(p)) || null; };
// "all of Food & Nutrition and 3 more issues", "7 issues": what this person follows, in words.
export function followSummary() {
  const cats = S.cats.filter(c => S.catFollows.has(c.key));
  const rest = S.issues.filter(i => S.issueFollows.has(i.id) && !(i.categories || [i.category]).some(c => S.catFollows.has(c))).length;
  const parts = [...cats.map(c => `all of ${c.name}`), ...(rest ? [`${rest}${cats.length ? ' more' : ''} ${rest === 1 ? 'issue' : 'issues'}`] : [])];
  return parts.length <= 1 ? (parts[0] || '') : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}
export function recomputeWatch() {
  const via = new Set();
  for (const i of S.issues) if (issueFollowed(i)) for (const id of issueBills(i)) via.add(id);
  const out = new Set([...S.direct, ...via]);
  for (const id of S.skips) if (!S.direct.has(id)) out.delete(id);   // "Not for me", unless also followed on its own
  S.viaIssues = via; S.watch = out;
}
// Categories and issues: loaded before anything else, because what a person follows is worked out from them.
export async function loadCatalog() {
  let cats = [], issues = [], links = [];
  if (DEMO) { cats = D.cats; issues = D.issues; links = D.issueLinks; }
  else {
    try { const [c, i, l] = await Promise.all([S.supa.from('public_categories').select('*').order('sort_order'), S.supa.from('public_issues').select('*').order('sort_order'),
        S.supa.from('public_issue_links').select('issue_a,issue_b')]);
      cats = c.data || []; issues = i.data || []; links = l.data || []; } catch (e) { console.error(e); }   // without them the page still works, by bills
  }
  // Related issues (095, R-094): each issue's neighbours, both ways. Only the suggested bill reads them.
  S.issueLinks = new Map();
  for (const { issue_a: a, issue_b: b } of links) { (S.issueLinks.get(a) || S.issueLinks.set(a, new Set()).get(a)).add(b); (S.issueLinks.get(b) || S.issueLinks.set(b, new Set()).get(b)).add(a); }
  S.cats = cats;
  S.issues = issues.map(i => ({ ...i, categories: i.categories?.length ? i.categories : [i.category], bill_ids: i.bill_ids || [], bill_years: i.bill_years || [] }));
  S.issueById = new Map(S.issues.map(i => [i.id, i])); S.issueBySlug = new Map(S.issues.map(i => [i.slug, i]));
  S.issuesByBill = new Map();
  for (const i of S.issues) for (const id of i.bill_ids) (S.issuesByBill.get(id) || S.issuesByBill.set(id, []).get(id)).push(i);
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
  try { await loadBills(); } catch (e) { console.error(e); }
  return true;
}
// Stop following one issue. If it came with a whole category, that category becomes its other issues, one by one:
// "Follow all" also covered issues HIPHI takes up later, and taking one out ends that (the screen says so).
export function unfollowIssue(i) {
  const cats = (i.categories || [i.category]).filter(c => S.catFollows.has(c));
  const others = [...new Set(cats.flatMap(issuesIn).map(x => x.id))].filter(id => id !== i.id);
  return setFollows({ issuesOff: [i.id], catsOff: cats, issuesOn: others });
}
export async function loadUser() {
  S.user = null;
  S.stances = localStances();
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
export function saveListFollows() { try { localStorage.setItem(LISTS_KEY, JSON.stringify([...S.listFollows])); } catch {} }
export async function loadLists() {
  if (DEMO) { S.lists = D.lists.map(l => ({ ...l, bills: D.listBills.filter(x => x.list_id === l.id).length, followers: l.followers || 0, curated_by: 'HIPHI' })); }
  else { const { data } = await S.supa.from('public_lists_v').select('*').order('featured', { ascending: false }).order('sort_order'); S.lists = data || []; }
  if (!S.user) S.listFollows = localListFollows();
}
export async function listBillsFor(slug) {
  if (S.listBills[slug]) return S.listBills[slug];
  const l = S.lists.find(x => x.slug === slug); if (!l) return null;
  let rows, bills;
  if (DEMO) { rows = D.listBills.filter(x => x.list_id === l.id); bills = D.bills.filter(b => rows.some(r => r.bill_id === b.id)); }
  else { const r = await S.supa.from('public_list_bills_v').select('*').eq('slug', slug); rows = r.data || [];
    const ids = rows.map(x => x.bill_id); bills = ids.length ? (await S.supa.from('public_all_bills').select('*').in('id', ids)).data || [] : []; }
  const out = rows.sort((a, b) => a.sort_order - b.sort_order || String(a.added_at).localeCompare(String(b.added_at))).map(x => ({ note: x.note, b: bills.find(b => b.id === x.bill_id) })).filter(x => x.b);
  out.forEach(({ b }) => { S.extra[b.id] = b; });
  S.listBills[slug] = out; return out;
}
// { quiet: true }: no toast, for a screen that states the result itself (the guided start's list rows).
export async function followList(slug, on, { quiet = false } = {}) {
  const l = S.lists.find(x => x.slug === slug); if (!l) return;
  const rows = await listBillsFor(slug) || [];
  if (on) S.listFollows.add(l.id); else S.listFollows.delete(l.id);
  if (S.user && !DEMO) {
    const r = on ? await S.supa.rpc('follow_list', { p_list: l.id }) : await S.supa.rpc('unfollow_list', { p_list: l.id });
    if (r.error) { toast(r.error, true); if (on) S.listFollows.delete(l.id); else S.listFollows.add(l.id); return; }
  } else saveListFollows();
  const live = rows.filter(({ b }) => alive(b) || b.stage === 'governor');
  if (on) { live.forEach(({ b }) => S.direct.add(b.id)); recomputeWatch(); saveLocal(); }
  l.followers = Math.max(0, (Number(l.followers) || 0) + (on ? 1 : -1));
  await loadBills();
  if (on) nudge('follow');
  app.render();
  if (quiet) return;
  // Between sessions a list has no bills still moving: never cheer "Following 0 bills" (assessment, 9/19).
  toast(!on ? `You no longer follow ${l.title}. Its bills stay in My issues.`
    : live.length ? `Following ${live.length} bill${live.length === 1 ? '' : 's'} on ${l.title}. Any HIPHI adds later will follow too.`
    : `You follow ${l.title}. HIPHI’s bills will show up in My issues when the next session opens.`, on ? { yay: true } : {});
}
export const POS_SAYS = { strongly_support: 'HIPHI strongly supports', support: 'HIPHI supports', support_amend: 'HIPHI supports with changes', strongly_oppose: 'HIPHI strongly opposes', oppose: 'HIPHI opposes', neutral: 'HIPHI is commenting', monitor: 'HIPHI is watching' };
// ---------------- legislators ----------------
// Official profiles from the Capitol's pages. "Find my legislators" takes a
// street address (sent to the U.S. Census geocoder through our proxy, not
// stored), a district, a town, or a name; the box suggests as you type.
export const plain = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[ʻ‘’`]/g, '').toLowerCase();
export const legById = id => S.legislators.find(l => l.id === Number(id));
export const legTitle = l => l.chamber === 'S' ? 'Sen.' : 'Rep.';
// A joint referral ("HLT/HSH") is one hearing held by two committees together: both chairs decide, both
// committees vote, and testimony is addressed to both. Every lookup by code goes through codesOf.
export const codesOf = code => String(code || '').split('/').map(c => c.trim()).filter(Boolean);
export const cmtesOf = code => codesOf(code).map(c => S.committees[c]).filter(Boolean);
// "Health / Human Services & Homelessness" (not "and": the Senate has a Health and Human Services committee)
export const cmteName = code => codesOf(code).map(c => S.committees[c]?.name || c).join(' / ');
export const chairLast = c => (c.chair || '').replace(/^(rep\.|sen\.|representative|senator)\s+/i, '').replace(/\s*(jr\.?|sr\.?|ii|iii|iv)$/i, '').trim().split(/\s+/).pop();
export const chairEmail = c => `${c.chamber === 'S' ? 'sen' : 'rep'}${chairLast(c).toLowerCase().replace(/[^a-z]/g, '')}@capitol.hawaii.gov`;
// every chair of a stop: emails comma-joined for one mailto, "Chair Takayama and Chair Marten" for the greeting
export const chairsOf = code => { const cs = cmtesOf(code).filter(c => c.chair);
  return cs.length ? { emails: cs.map(chairEmail).join(','), dear: cs.map(c => `Chair ${c.chair}`).join(' and '), names: cs.map(c => c.chair).join(' and '), n: cs.length } : null; };
export const legsOf = code => { const cs = codesOf(code), rank = { chair: 0, vice_chair: 1, member: 2 }, by = new Map();
  for (const m of S.committeeMembers) { if (!cs.includes(m.committee)) continue; const l = legById(m.legislator_id); if (!l) continue;
    const x = by.get(l.id); if (!x) { by.set(l.id, { ...m, l, roles: { [m.committee]: m.role } }); continue; }
    x.roles[m.committee] = m.role; if (rank[m.role] < rank[x.role]) { x.role = m.role; x.committee = m.committee; } }
  return [...by.values()].sort((a, b) => rank[a.role] - rank[b.role] || cs.indexOf(a.committee) - cs.indexOf(b.committee) || a.l.sort_name.localeCompare(b.l.sort_name)); };
export const legPhoto = (l, cls = 'lphoto') => l.photo_url ? `<img class="${cls}" src="${esc(l.photo_url)}" alt="" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'${cls} none',textContent:'${esc((l.name || '?')[0])}'}))">` : `<span class="${cls} none">${esc((l.name || '?')[0])}</span>`;
export const legChips = l => S.committeeMembers.filter(m => m.legislator_id === l.id).sort((a, b) => ({ chair: 0, vice_chair: 1, member: 2 }[a.role]) - ({ chair: 0, vice_chair: 1, member: 2 }[b.role])).map(m => `<span class="chipx ${m.role === 'chair' ? 'c-teal' : m.role === 'vice_chair' ? 'c-navy' : 'c-gray'}" title="${esc(S.committees[m.committee]?.name || m.committee)}">${esc(S.committees[m.committee]?.name || m.committee)}${m.role === 'chair' ? ' · Chair' : m.role === 'vice_chair' ? ' · Vice Chair' : ''}</span>`).join('');
// the places a legislator's district covers, one name each
export const placesOf = l => (l.places || '').split(/,\s*/).map(x => x.replace(/^(a )?portions? of\s+/i, '').trim()).filter(Boolean);
// what the box suggests
export const looksLikeAddress = q => q.trim().length >= 3 && !/^(senate|house|sd|hd)?\s*(district)?\s*\d{1,2}$/i.test(q.trim());
// Suggestions come from our own table of every Hawaiʻi street address (with districts), one fast query.
export async function supa() { if (!S.supa) { const { createClient } = await import(SUPABASE_JS); S.supa = createClient(SUPABASE_URL, SUPABASE_KEY, AUTH); } return S.supa; }
export async function fetchAddrSuggest(q) {
  const { data, error } = await (await supa()).rpc('address_suggest', { q, n: 8 }); if (error) throw error;
  return (data || []).map(x => ({ label: x.label, lat: x.lat, lon: x.lon, sd: x.sd, hd: x.hd, exact: x.exact }));
}
export function legSuggest(q) {
  const k = plain(q.trim()); if (k.length < 2) return [];
  const out = [];
  if (S.addrSug && S.addrSug.q === q.trim()) out.push(...S.addrSug.results.map(x => ({ kind: 'addr', ...x })));
  if (/^\d/.test(k) && k.length >= 5 && !out.some(x => x.exact)) out.push({ kind: 'address', label: `Look up “${q.trim()}” as typed`, q: q.trim() });
  const dm = /^(senate|house|sd|hd)?\s*(district)?\s*(\d{1,2})$/.exec(k);
  if (dm) { const n = +dm[3]; if (!dm[1] || /^s/.test(dm[1])) out.push({ kind: 'district', label: `Senate District ${n}`, chamber: 'S', district: n }); if (!dm[1] || /^h/.test(dm[1])) out.push({ kind: 'district', label: `House District ${n}`, chamber: 'H', district: n }); }
  const places = new Map();
  for (const l of S.legislators) for (const pl of placesOf(l)) if (plain(pl).includes(k)) { const key = plain(pl); if (!places.has(key)) places.set(key, { kind: 'place', label: pl, ids: [] }); if (!places.get(key).ids.includes(l.id)) places.get(key).ids.push(l.id); }
  out.push(...[...places.values()].sort((a, b) => a.label.localeCompare(b.label)).slice(0, 8));
  out.push(...S.legislators.filter(l => plain(l.name).includes(k) || plain(l.sort_name).includes(k)).slice(0, 6).map(l => ({ kind: 'person', label: `${legTitle(l)} ${l.name}`, ids: [l.id] })));
  return out.slice(0, 12);
}
export async function legLookupAddress(q, pt) {
  const byDistrict = (sd, hd) => S.legislators.filter(l => (l.chamber === 'S' && l.district === sd) || (l.chamber === 'H' && l.district === hd)).map(l => l.id);
  if (pt && pt.sd && pt.hd) return { matched: pt.label, ids: byDistrict(pt.sd, pt.hd) };
  if (pt) { const { data } = await (await supa()).rpc('districts_at', { lat: pt.lat, lon: pt.lon }); const d = data?.[0]; if (d?.sd || d?.hd) return { matched: pt.label, ids: byDistrict(d.sd, d.hd) }; }
  const r = await fetch(`${SUPABASE_URL}/functions/v1/geo-lookup?address=${encodeURIComponent(q)}`, { headers: { apikey: SUPABASE_KEY } });
  const j = await r.json(); if (!j.found) return { none: true };
  return { matched: j.matched || q, ids: byDistrict(j.senate, j.house) };
}
// mail draft for a legislator about a bill (or a general note)
export function legDraft(l, b) {
  const ask = b && (b.hiphi_action || '').trim();
  const subject = b ? `${b.bill_number.replace(/^(\D+)/, '$1 ')}${b.hiphi_position ? ' — ' + ({ strongly_support: 'please support', support: 'please support', support_amend: 'please support with amendments', strongly_oppose: 'please oppose', oppose: 'please oppose', neutral: 'comments' }[b.hiphi_position] || '') : ''}` : `A constituent from ${S.legTown || 'your district'}`;
  const surname = (l.sort_name || l.name).split(',')[0].trim();
  const body = `Aloha ${legTitle(l)} ${surname},\n\nMy name is [your name] and I live in [your town].${b ? `\n\nI am writing about ${b.bill_number.replace(/^(\D+)/, '$1 ')}, ${blurb(b, 140)}${ask ? `\n\n${ask}` : ''}` : ''}\n\n[Why this matters to you, in a sentence or two.]\n\nMahalo,\n[your name]`;
  return { subject, body, mailto: `mailto:${l.email || ''}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}` };
}
export async function loadBills() {
  const ids = [...S.watch];
  if (!S.pool) { try { await loadPool(); } catch { S.pool = { bills: [], hearings: [] }; } }
  if (!S.featured) { try { await loadFeatured(); } catch { S.featured = { hearings: [], bills: [] }; } }
  if (DEMO) {
    const w = new Set(ids);
    S.bills = D.bills.filter(b => w.has(b.id)); S.hearings = D.hearings.filter(h => w.has(h.bill_id));
    S.activity = D.activity.filter(a => w.has(a.bill_id)).sort((x, y) => y.occurred_at.localeCompare(x.occurred_at));
    Object.assign(S.outcomes, Object.fromEntries(D.outcomes.filter(o => w.has(o.bill_id)).map(o => [o.hearing_id, o])));
    await loadActions([...ids, ...((S.featured || {}).bills || []).map(b => b.id)]);
    return;
  }
  if (!ids.length) { S.bills = []; S.hearings = []; S.activity = []; }
  else {
    // Following a whole category can mean 60 or more bills: asked for in slices (inChunks).
    const [b, h, a, o] = await Promise.all([
      inChunks(ids, ch => S.supa.from('public_all_bills').select('*').in('id', ch)),
      inChunks(ids, ch => S.supa.from('public_all_hearings').select('*').in('bill_id', ch)),
      inChunks(ids, ch => S.supa.from('public_activity').select('*').in('bill_id', ch).order('occurred_at', { ascending: false }).limit(300)),
      inChunks(ids, ch => S.supa.from('public_hearing_outcomes').select('*').in('bill_id', ch)),
    ]);
    S.bills = b; S.hearings = h; S.activity = a.sort((x, y) => y.occurred_at.localeCompare(x.occurred_at)).slice(0, 300);
    Object.assign(S.outcomes, Object.fromEntries(o.map(x => [x.hearing_id, x])));
  }
  try { await loadActions([...ids, ...((S.featured || {}).bills || []).map(b => b.id)]); } catch { /* counts are decoration */ }
  if (!S.deadlines.length) {
    const [d, c, sl, co, lg, cm, cp] = await loadReference();
    S.legislators = lg.data || []; S.committeeMembers = cm.data || []; S.counterparts = cp.data || [];
    S.slots = sl.data || [];
    S.deadlines = (d.data || []).sort((x, y) => x.deadline_date.localeCompare(y.deadline_date));
    S.committees = Object.fromEntries((c.data || []).map(x => [x.code, x]));
    S.coalitions = (co.data || []).filter(x => x.bills > 0);
    // The session dates are known now; if they change which session's bills an issue brings, load those instead.
    const had = [...S.watch].sort().join(); recomputeWatch();
    if ([...S.watch].sort().join() !== had) return loadBills();
  }
}
// Supabase takes an id list in the URL, so a long list is asked for in slices and put back together.
async function inChunks(ids, make, size = 80) {
  const parts = []; for (let k = 0; k < ids.length; k += size) parts.push(ids.slice(k, k + size));
  const rs = await Promise.all(parts.map(make));
  return rs.flatMap(r => { if (r?.error) throw r.error; return r?.data || []; });
}
// This week at the Capitol: upcoming hearings on bills HIPHI has a position on,
// so a first visit has something to watch in one tap.
// The pool suggestions come from: every live bill HIPHI has a position on, with
// hearings in the next two weeks. Loaded once per visit.
// The session's reference data (deadlines, committees, legislators, ...): nothing in it depends on what the person
// follows, so app.js starts it with the other first requests instead of after them (R-067 speed: it was the last of
// five waves). Asked once; loadBills waits for it.
export function loadReference() {
  return S.refP ??= Promise.all([S.supa.from('public_deadlines').select('*'), S.supa.from('public_committees').select('*'),
    S.supa.from('public_committee_slots').select('*'), S.supa.from('public_coalitions').select('*'),
    S.supa.from('public_legislators').select('*').order('chamber').order('district'), S.supa.from('public_committee_members').select('*'), S.supa.from('public_committee_counterparts').select('*')])
    .catch(e => { S.refP = null; throw e; });
}
export async function loadPool() {
  if (!DEMO) { S.poolP ??= loadPool0().finally(() => { S.poolP = null; }); return S.poolP; }
  return loadPool0();
}
async function loadPool0() {
  const now = Date.now(), until = new Date(now + 15 * 864e5).toISOString();
  if (DEMO) {
    const bills = D.bills.filter(b => alive(b) && b.hiphi_position && b.hiphi_position !== 'monitor');
    const ids = new Set(bills.map(b => b.id));
    S.pool = { bills, hearings: D.hearings.filter(h => ids.has(h.bill_id) && h.status === 'scheduled' && h.scheduled_at < until) }; return;
  }
  const { data: bills } = await S.supa.from('public_all_bills').select('*').not('hiphi_position', 'is', null).neq('hiphi_position', 'monitor').not('stage', 'in', '("dead","vetoed","enacted","governor")').limit(500);
  const ids = (bills || []).map(b => b.id);
  const { data: hs } = ids.length ? await S.supa.from('public_all_hearings').select('*').in('bill_id', ids).eq('status', 'scheduled').gt('scheduled_at', new Date(now - 864e5).toISOString()).lt('scheduled_at', until) : { data: [] };
  S.pool = { bills: (bills || []).filter(alive), hearings: hs || [] };
}
// Every bill HIPHI took a position on in one session, whatever became of it. The pool above holds only bills still
// moving, so between sessions it is empty - which is how every topic came to say "0 bills in 2026" and the recap
// "HIPHI worked on 0 bills" (9/21, REQUESTS R-019). Loaded once per visit, for the start's counts and recap and
// for Home's "Your issues".
export async function loadRecapPool(yr) {
  if (S.recapPool && S.recapPool.yr === yr) return S.recapPool.bills;
  let bills;
  if (DEMO) bills = D.bills.filter(b => b.hiphi_position && b.hiphi_position !== 'monitor' && (!b.session_year || +b.session_year === yr));
  else {
    const { data, error } = await S.supa.from('public_all_bills').select('*').eq('session_year', yr).not('hiphi_position', 'is', null).neq('hiphi_position', 'monitor').limit(1000);
    if (error) throw error; bills = data || [];
  }
  S.recapPool = { yr, bills };
  return bills;
}
// For a screen that only shows counts from it: start the load once and redraw when it lands. A failure is not retried
// (a redraw would call this again and spin); the counts are simply left out for the rest of the visit.
// HIPHI's wins from before this tracker's records begin (it holds the 2025-2026 bills as 2026 records; a bill that
// became law in 2025 is not in it). Nate gave these on 9/27 (R-067); add a line here for any other win to name.
export const EARLIER_WINS = [
  { year: 2025, text: 'More students can get free school meals', bill: 'SB 1300' },
  { year: 2025, text: 'Dedicated funding for Safe Routes to School' },
];
// The bills HIPHI backed that became law in a session, from the recap pool (null until it has loaded).
export const winsIn = yr => S.recapPool && S.recapPool.yr === yr ? S.recapPool.bills.filter(b => b.stage === 'enacted' && /support/.test(b.hiphi_position || '')) : null;
export function ensureRecapPool(yr) {
  if ((S.recapPool && S.recapPool.yr === yr) || S.recapLoading || S.recapFailed === yr) return;
  S.recapLoading = true;
  loadRecapPool(yr).catch(e => { console.error(e); S.recapFailed = yr; }).finally(() => { S.recapLoading = false; app.render(); });
}
// The topic keys picked in the guided start ('food', 'tobacco'...). Since 9/20 the start stores topics, not
// coalition names, so anything matching picks against b.coalitions has to ask topicOf() as well (R-019).
// A bill in a category this person cares about (likedCats). A bill with no issue yet falls back to the old word
// patterns of topics.js.
export const pickedTopic = b => { const liked = likedCats(), iss = issuesOf(b);
  if (iss.length) return iss.some(i => (i.categories || [i.category]).some(c => liked.has(c)));
  const k = topicOf(b)?.key; return !!k && liked.has(k); };
export function dismissed() { try { return new Set(JSON.parse(localStorage.getItem('hiphi_dismiss') || '[]')); } catch { return new Set(); } }
export function dismiss(id) { const d = dismissed(); d.add(id); try { localStorage.setItem('hiphi_dismiss', JSON.stringify([...d])); } catch { /* ignore */ } }
// ---------------- the suggested bill (R-094) ----------------
// The scoring lives in pub/rank.js (pure, so the 2026 replay runs the same code); this builds the person it needs from
// what the page already holds. Everything is worked out here in the browser: nothing about the person is sent anywhere.
export { WEIGHT, SOON_DAYS, sidePoints } from './rank.js';
const SEEN_KEY = DEMO ? 'hiphi_sugg_seen_demo' : 'hiphi_sugg_seen';
const readSeen = () => { try { return JSON.parse(localStorage.getItem(SEEN_KEY) || '{}') || {}; } catch { return {}; } };
const catsOfBill = b => { const iss = issuesOf(b); if (iss.length) return [...new Set(iss.flatMap(i => i.categories || [i.category]))];
  const k = topicOf(b)?.key; return k ? [k] : []; };
function person() {
  const followCats = new Set([...S.catFollows, ...followedIssues().flatMap(i => i.categories || [i.category])]);
  const picks = wiz().issues || [], pickedCats = new Set(picks);
  const likedCoalitions = new Set([...S.bills.flatMap(b => b.coalitions || []), ...picks.flatMap(groupNames)]);
  const actedCats = new Set(myActions().filter(a => actedKind(a.kind)).flatMap(a => issuesOf(a.bill_id).flatMap(i => i.categories || [i.category])));
  // Issues related to one the person follows (and not followed themselves), each with the followed issue's name.
  const relatedTo = new Map(), mine = followedIssues();
  for (const f of mine) for (const id of (S.issueLinks || new Map()).get(f.id) || []) if (!relatedTo.has(id) && !mine.some(m => m.id === id)) relatedTo.set(id, f.name);
  return { now: Date.now(), issuesOf, catsOf: catsOfBill, relatedTo, catName: k => catOf(k)?.name || k,
    follows: S.watch, dismissed: dismissed(), skips: S.skips, against: b => agrees(b) === false,
    followCats, pickedCats, likedCoalitions, actedCats, seen: readSeen(),
    people: b => { const c = S.actionCounts[b.id]; return c ? (c.actions ?? ((c.testimonies || 0) + (c.emails || 0) + (c.attending || 0))) : null; },
    likedCount: new Set([...followCats, ...pickedCats]).size };
}
// Every live HIPHI bill with its hearing, as rank.js takes them.
function candidates() {
  const pool = S.pool; if (!pool) return [];
  return pool.bills.map(b => {
    const st = billStop(b, { hearings: pool.hearings.filter(h => h.bill_id === b.id), outcomes: {}, deadlineFor: k => deadlineOf(b, k) });
    const h = st.hearingState === 'scheduled' ? st.hearing : null;
    return { b, st, hearing: h, due: h ? new Date(h.testimony_deadline || h.scheduled_at).getTime() : null, kind: 'testify' };
  });
}
// Every bill that may be suggested, scored and in order. Each item: { b, st, hearing, when, score, why, ... }.
export function recommendations(limit = 50) { return rankAll(candidates(), person()).slice(0, limit); }
// The short list: Find shows n = 4, Home the first. Its reason lines are kept for the cards (reasonOf).
export function suggestionList(n = 4) {
  const p = person(), list = shortList(rankAll(candidates(), p), n, p.likedCount);
  for (const r of list) S.sugWhy.set(r.b.id, r.why);
  return list;
}
export const reasonOf = b => S.sugWhy.get(b.id) || '';
// Called when suggestions are put on screen: a bill shown on three separate days and never followed, acted on or
// dismissed drops; after five it is not suggested again until it has a new hearing (FATIGUE in rank.js).
export function noteShown(list) {
  if (!list.length) return;
  try { localStorage.setItem(SEEN_KEY, JSON.stringify(markShown(readSeen(), list, Date.now()))); } catch { /* ignore */ }
}
export async function loadFeatured() {
  const now = Date.now(), until = new Date(now + 8 * 864e5).toISOString();
  if (DEMO) {
    const hs = D.hearings.filter(h => h.status === 'scheduled' && new Date(h.scheduled_at) > now && h.scheduled_at < until);
    const ids = new Set(hs.map(h => h.bill_id));
    const bills = D.bills.filter(b => ids.has(b.id) && b.hiphi_position && b.hiphi_position !== 'monitor');
    S.featured = { hearings: hs.filter(h => bills.some(b => b.id === h.bill_id)), bills }; return;
  }
  // HIPHI's own bills first, then their hearings. It used to take the first 60 hearings of every bill and keep
  // HIPHI's afterwards: replayed on 2026, the busiest week had 52 HIPHI hearings and 4 would have shown (R-067).
  // The pool already holds exactly HIPHI's live bills and their hearings for the next two weeks.
  if (!S.pool) await loadPool();
  const hs = S.pool.hearings.filter(h => h.status === 'scheduled' && new Date(h.scheduled_at) > now && new Date(h.scheduled_at) < new Date(until))
    .sort((x, y) => new Date(x.scheduled_at) - new Date(y.scheduled_at));
  const ids = new Set(hs.map(h => h.bill_id));
  S.featured = { hearings: hs, bills: S.pool.bills.filter(b => ids.has(b.id)) };
}
// Onboarding state lives in this browser: which steps are done, nudges shown, tour seen.
export function onb() { try { return JSON.parse(localStorage.getItem('hiphi_onb') || '{}'); } catch { return {}; } }
export function onbSet(patch) { const o = { ...onb(), ...patch }; try { localStorage.setItem('hiphi_onb', JSON.stringify(o)); } catch { /* ignore */ } return o; }
// The star on one bill. A bill that came with an issue: pressing it is "Not for me" (the issue stays followed). A bill
// nobody's issue covers: it follows or unfollows that bill on its own. Pressing it again undoes either.
export async function toggleWatch(id) {
  const on = S.watch.has(id), covered = S.viaIssues.has(id), wasDirect = S.direct.has(id), wasSkip = S.skips.has(id);
  if (on) { S.direct.delete(id); if (covered) S.skips.add(id); }
  else { S.skips.delete(id); if (!covered) S.direct.add(id); }
  recomputeWatch(); saveLocal();
  if (S.user && !DEMO) {
    const uid = S.user.id, calls = [];
    if (wasDirect && !S.direct.has(id)) calls.push(S.supa.from('watchlist').delete().eq('user_id', uid).eq('bill_id', id));
    if (!wasDirect && S.direct.has(id)) calls.push(S.supa.from('watchlist').insert({ user_id: uid, bill_id: id, stance: (S.stances || {})[id] || null }));
    if (!wasSkip && S.skips.has(id)) calls.push(S.supa.from('bill_skips').insert({ user_id: uid, bill_id: id }));
    if (wasSkip && !S.skips.has(id)) calls.push(S.supa.from('bill_skips').delete().eq('user_id', uid).eq('bill_id', id));
    const err = (await Promise.all(calls)).find(r => r.error)?.error;
    if (err) { toast(err, true);
      if (wasDirect) S.direct.add(id); else S.direct.delete(id); if (wasSkip) S.skips.add(id); else S.skips.delete(id);
      recomputeWatch(); saveLocal(); return; }
  }
  await loadBills();
  // Signed in, first bill followed, no districts yet: ask for a home address once (it is the field HIPHI needs most).
  if (!on && S.user && !DEMO && S.watch.size >= 1 && !(S.profile || {}).senate_district && !onb().addrAsked) { S.addrCard = true; onbSet({ addrAsked: true }); }
  // Sign-in nudge after the first and third Watch, never a modal, never before a Watch.
  if (!on && S.watch.size && [1, 3].includes(S.watch.size)) nudge('follow');
  app.render();
}
export async function search(q) {
  if (DEMO) return [...D.bills.filter(b => dmatch(b, q)), ...D.index.filter(b => dmatch(b, q))].slice(0, 25);
  const safe = q.replace(/[%,()]/g, ' ').trim();
  const { data, error } = await S.supa.from('public_all_bills').select('*')
    .or(`bill_number.ilike.%${safe.replace(/\s/g, '')}%,title.ilike.%${safe}%,description.ilike.%${safe}%`)
    .order('bill_number').limit(25);
  if (error) throw error; return data;
}
// Every public bill HIPHI has tagged with a coalition (public_all_bills.coalitions).
export async function browseCoalition(name) {
  const names = groupNames(name);
  if (DEMO) { S.browse = { name: names[0], rows: D.bills.filter(b => b.coalitions.some(n => names.includes(n))) }; S.results = null; S.q = ''; return; }
  const { data, error } = await S.supa.from('public_all_bills').select('*').overlaps('coalitions', names).order('bill_number').limit(300);
  if (error) throw error;
  S.browse = { name: names[0], rows: data || [] }; S.results = null; S.q = '';
}
// ---------------- helpers ----------------
export const bill = id => S.bills.find(b => b.id === id);
export const findBill = id => bill(id) || (S.results || []).find(x => x.id === id) || (S.browse?.rows || []).find(x => x.id === id) || ((S.featured || {}).bills || []).find(x => x.id === id) || ((S.pool || {}).bills || []).find(x => x.id === id) || ((S.recapPool || {}).bills || []).find(x => x.id === id) || S.extra[id] || null;
// A bill page shows every hearing of the bill, not only the 30 days the lists load (R-033, 9/26): its whole history,
// each with its recording, which since 9/26 opens at the bill's own minute where the video's description has one
// (public_bill_hearing_history, migration 075). Asked for once per bill and merged in; a failure leaves the 30 days.
S.hist ??= {};
export async function ensureHistory(b) {
  if (DEMO || !b || S.hist[b.id]) return false;
  S.hist[b.id] = 'loading';
  try {
    const { data, error } = await (await supa()).rpc('public_bill_hearing_history', { bill: b.id });
    if (error) throw error;
    const have = new Map(hearingsOf(b).map(h => [h.id, h]));
    // A row already loaded keeps its place; it only gains a recording found since the lists loaded.
    for (const h of data || []) { const o = have.get(h.id); if (o && !o.stream_url && h.stream_url) o.stream_url = h.stream_url; }
    S.xh[b.id] = [...(S.xh[b.id] || []), ...(data || []).filter(h => !have.has(h.id)).map(({ outcome, ...h }) => h)];
    for (const h of data || []) if (h.outcome && !S.outcomes[h.id]) S.outcomes[h.id] = { hearing_id: h.id, bill_id: h.bill_id, outcome: h.outcome };
    S.hist[b.id] = true; return true;
  } catch (e) { delete S.hist[b.id]; console.warn('hearing history', e); return false; }
}
export const hearingsOf = b => [...new Map([...S.hearings.filter(h => h.bill_id === b.id), ...(S.xh[b.id] || [])].map(h => [h.id, h])).values()].sort((x, y) => x.scheduled_at.localeCompare(y.scheduled_at));
export const isTriple = b => (b.origin_stops || 0) >= 3 || (b.second_stops || 0) >= 3;
export function stopOf(b) {
  return billStop(b, { hearings: hearingsOf(b), outcomes: S.outcomes || {},
    deadlineFor: key => deadlineOf(b, key) });
}
// A deadline row by its key, or the budget bills' own row that replaces it (Budget Decking 3/16 for HB1800 and HB2095,
// migration 087; R-072). A row that lists bills never applies to any other bill.
export function deadlineOf(b, key) {
  const alt = S.deadlines.find(x => x.replaces === key && (x.bills || []).includes(b.bill_number));
  const d = alt || S.deadlines.filter(x => x.key === key && !(x.bills || []).length).slice(-1)[0];
  return d ? { label: d.label, date: d.deadline_date } : null;
}
// The referral path, one line per chamber, current stop marked (same as the staff app).
export function referralPath(b) {
  const refs = b.referrals || []; if (!refs.length) return esc(b.committee || '—');
  const n = Math.min(b.origin_stops || refs.length, refs.length);
  const st = stopOf(b), origin = b.chamber || (b.bill_number?.startsWith('S') ? 'S' : 'H'), otherCh = origin === 'H' ? 'S' : 'H';
  // A dead bill stopped at the stop its death stage names: triple = first, decking = last, lateral = in between.
  const ds = st.phase === 'dead' ? (b.died_at_stage || '') : '';
  const deadLeg = /^first|^introduced/.test(ds) ? 'first' : /^second/.test(ds) ? 'second' : null;
  const deadIdx = list => /triple|introduced/.test(ds) ? 0 : /decking/.test(ds) ? list.length - 1 : list.length <= 2 ? 0 : 1;
  const line = (ch, list, leg) => list.length ? `<span class="refline"><span class="refch">${CHAMBER_NAME[ch]}</span>${list.map((c, i) => {
      if (ds) { const di = deadLeg === leg ? deadIdx(list) : -1; const cls = deadLeg === leg ? (i === di ? 'dead' : i < di ? 'past' : '') : (leg === 'first' && deadLeg === 'second' ? 'past' : ''); return `<span class="refstop ${cls}">${esc(c)}</span>`; }
      const here = st.leg === leg && st.phase === 'committee' && st.stop === i + 1;
      const past = st.leg !== leg ? (leg === 'first') : (st.phase !== 'committee' || st.stop > i + 1);
      return `<span class="refstop ${here ? 'here' : past ? 'past' : ''}">${esc(c)}</span>`; }).join('<span class="refarrow">→</span>')}</span>` : '';
  const second = refs.slice(n);
  return line(origin, refs.slice(0, n), 'first') + (second.length ? line(otherCh, second, 'second') : (st.leg === 'second' && st.phase === 'committee' ? `<span class="refline"><span class="refch">${CHAMBER_NAME[otherCh]}</span><span class="refstop muted">awaiting referral</span></span>` : ''));
}
export function nextDeadline(b) { const st = stopOf(b); return st.phase === 'committee' && st.deadline && !st.deadline.missed ? st.deadline : null; }
export const alive = b => !['dead', 'vetoed', 'enacted', 'governor', 'ballot'].includes(b.stage || '') && !HELD_RE.test(b.last_action || '');
export const posCls = b => ({ strongly_support: 'pos-support', support: 'pos-support', support_amend: 'pos-support', strongly_oppose: 'pos-oppose', oppose: 'pos-oppose', neutral: 'pos-neutral' }[b.hiphi_position] || 'pos-none');
// "First Lateral 2/20/26" -> a sentence a neighbour would understand.
export function whyDead(b) {
  if (b.stage !== 'dead' && alive(b)) return '';
  const m = /^(.*?)\s+(\d+\/\d+\/\d+)$/.exec(b.died_deadline || '');
  if (m) { const at = stoppedAt(b); return `Missed the ${m[1]} deadline on ${m[2]}${at ? ` while waiting in ${esc(at.committee)}` : ''}.`; }
  if (b.died_deadline) return `Missed the ${esc(b.died_deadline)} deadline.`;
  if (HELD_RE.test(b.last_action || '') && !/failed to pass/i.test(b.last_action || '')) return 'Deferred by the committee, which ends it for the year.';
  if (/failed to pass/i.test(b.last_action || '')) return 'Failed a floor vote.';
  return b.stage === 'vetoed' ? 'Vetoed by the Governor.' : 'Did not advance.';
}
// Last regular meeting slot of a committee on or before a date (from the
// Capitol's published schedules, committee_slots), and the 48-hour notice
// cutoff for it. A joint hearing is held in the lead (first) committee's slot. Null without a schedule.
export function lastSlotBefore(code, dateStr, slots) {
  const c = codesOf(code)[0];
  const mine = (slots || []).filter(s => s.code === c);
  if (!mine.length || !dateStr) return null;
  for (let i = 0; i <= 6; i++) {
    const d = new Date(dateStr + 'T12:00:00-10:00'); d.setUTCDate(d.getUTCDate() - i);
    const day = d.toISOString().slice(0, 10);
    const dow = new Date(day + 'T12:00:00-10:00').getUTCDay();
    const s = mine.filter(x => x.weekday === dow).sort((a, b) => b.start_time.localeCompare(a.start_time))[0];
    if (s) { const at = new Date(`${day}T${s.start_time.slice(0, 8)}-10:00`); return { at, noticeBy: new Date(at - 48 * 3600e3), room: s.room }; }
  }
  return null;
}
export const streamOf = h => hearingStream(h, S.committees[codesOf(h.committee)[0]]?.chamber);
export const chairOf = code => { const cs = cmtesOf(code).filter(c => c.chair); if (!cs.length) return '';
  return ` · ${cs.length > 1 ? 'Chairs' : 'Chair'} ${cs.map(c => `<a class="chairmail" href="mailto:${esc(chairEmail(c))}" onclick="event.stopPropagation()" title="Email the chair">${c.chamber === 'S' ? 'Sen.' : 'Rep.'} ${esc(chairLast(c))}</a>`).join(' and ')}`; };
export const RAIL_SHORT = { introduced: 'Intro', first_triple: '1st Triple', first_lateral: '1st Lat', first_decking: '1st Deck', first_crossover: 'Cross',
  second_triple: '2nd Triple', second_lateral: '2nd Lat', second_decking: '2nd Deck', conference: 'Conf', governor: 'Gov', enacted: 'Law' };
// A triple-referred bill gets its Triple stop in that chamber, before Lateral.
export const railFor = b => { const r = ['introduced']; if ((b.origin_stops || 0) >= 3) r.push('first_triple');
  r.push('first_lateral', 'first_decking', 'first_crossover'); if ((b.second_stops || 0) >= 3) r.push('second_triple');
  r.push('second_lateral', 'second_decking', 'conference', 'governor', 'enacted'); return r; };
// ---------------- Do this now: one card per open opportunity ----------------
export const POS_VERB = { strongly_support: 'support', support: 'support', support_amend: 'support with amendments', strongly_oppose: 'oppose', oppose: 'oppose', neutral: 'comment on' };
export const POS_WORD = { strongly_support: 'SUPPORT', support: 'SUPPORT', support_amend: 'SUPPORT WITH AMENDMENTS', strongly_oppose: 'OPPOSITION', oppose: 'OPPOSITION', neutral: 'COMMENTS' };
export function actionsList(bills, hearings) {
  const now = Date.now();
  return hearings.filter(h => h.status === 'scheduled' && new Date(h.scheduled_at) > now)
    .map(h => ({ h, b: bills.find(b => b.id === h.bill_id) }))
    .filter(x => x.b && x.b.hiphi_position && x.b.hiphi_position !== 'monitor' && alive(x.b))
    .sort((x, y) => (x.h.testimony_deadline || x.h.scheduled_at).localeCompare(y.h.testimony_deadline || y.h.scheduled_at));
}
// ---------------- progress: what you did, what it led to, the community ----------------
// Nate, 9/18: a game-like page that stays positive. Best practice for civic tools: show what an action led to,
// show the group's progress, never rank people, never guilt. So: no points, no leaderboard, no daily streak (the
// legislature meets January to May, in bursts); every kind of action counts (testimony, a sent email, going to a
// hearing, sharing); group totals appear only from 10 people; a small Hawaiʻi-flavoured celebration for real acts
// only, and none at all for people who ask their device to reduce motion; between sessions, a recap.
// No account is needed. Signing in is what makes an action count in the community totals.
export const reduceMotion = () => !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
export const MAHALO = { testimony: 'Mahalo for testifying! Your voice is on the record.', email: 'Mahalo! Your email helps the chair see people care.',
  attend: 'Mahalo! See you at the Capitol.', share: 'Mahalo for spreading the word.' };
export function yay(msg) { toast(msg, { yay: true }); }
// five-petal hibiscus, in the page's warm colours
export const flowerSVG = (c, n = 24) => `<svg viewBox="-12 -12 24 24" width="${n}" height="${n}" aria-hidden="true"><g fill="${c}">${[0, 72, 144, 216, 288].map(r => `<ellipse cx="0" cy="-5.6" rx="4.1" ry="5.6" transform="rotate(${r})"/>`).join('')}</g><circle r="2.2" fill="#F9D56E"/></svg>`;
// The one bigger moment: someone's first testimony ever. Twelve hibiscus drift out and fade in about 0.7 s, once.
export function hibiscus() {
  if (reduceMotion()) return;
  const C = ['#E8505B', '#F28CA0', '#F4B942', '#E8505B', '#D9465F', '#F28CA0'];
  const box = document.createElement('div'); box.className = 'burst'; box.setAttribute('aria-hidden', 'true');
  box.innerHTML = [...Array(12)].map((_, i) => { const a = i / 12 * Math.PI * 2 + (i % 2) * 0.22, d = 80 + (i % 3) * 36;
    return `<span class="fl" style="--x:${Math.round(Math.cos(a) * d)}px;--y:${Math.round(Math.sin(a) * d)}px;--r:${(i % 2 ? 1 : -1) * (80 + i * 14)}deg;animation-delay:${(i % 4) * 35}ms">${flowerSVG(C[i % C.length])}</span>`; }).join('');
  document.body.appendChild(box); setTimeout(() => box.remove(), 1200);
}
export function celebrate(kind, firstTestimony) {
  if (firstTestimony) { hibiscus(); yay('Your first testimony! Imua: this is how laws get made in Hawaiʻi. Mahalo nui loa.'); return; }
  yay(MAHALO[kind] || 'Mahalo!');
}
// ---- asking for an email, gently (research 9/18: ask after something worthwhile is done, name the benefit,
// inline and never a pop-up, one ask per visit, and after "Not now" wait 14 days, then 60) ----
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
export const anyBill = id => findBill(id) || (DEMO ? D.bills.find(b => b.id === id) : null);
export const anyHearing = id => id ? ([...S.hearings, ...((S.featured || {}).hearings || []), ...((S.pool || {}).hearings || []), ...Object.values(S.xh || {}).flat(), ...(DEMO ? D.hearings : [])].find(h => h.id === id) || null) : null;
export const outcomeOf = h => S.outcomes[h.id] || (DEMO ? D.outcomes.find(o => o.hearing_id === h.id) : null);
// Milestones mark real acts, are shown only to the person, and never expire.
export const MILESTONES = [
  ['follow', 'Following along', 'follow your first issue', () => followsAnything()],
  ['stance', 'Took a stand', 'say where you stand on a bill', () => Object.values(S.stances || {}).some(v => v === 'support' || v === 'oppose')],
  ['first', 'First action', 'your first action on a bill', a => a.length >= 1],
  ['testimony', 'First testimony', 'testimony to a committee', a => a.some(x => x.kind === 'testimony')],
  ['share', 'Spread the word', 'share a bill with someone', a => a.some(x => x.kind === 'share')],
  ['attend', 'Showed up', 'go to a hearing in person', a => a.some(x => x.kind === 'attend')],
  ['three', 'Three hearings', 'act on three different hearings', a => new Set(a.filter(x => x.hearing_id).map(x => x.hearing_id)).size >= 3],
  ['ten', 'Ten actions', 'ten actions in all', a => a.length >= 10],
  ['both', 'Both chambers', 'act on one bill in the House and in the Senate', a => { const m = {};
    for (const x of a) { const h = anyHearing(x.hearing_id), ch = h && S.committees[codesOf(h.committee)[0]]?.chamber; if (ch) (m[x.bill_id] ??= new Set()).add(ch); }
    return Object.values(m).some(v => v.size > 1); }],
  ['law', 'Made it law', 'a bill you acted on becomes law', a => a.some(x => anyBill(x.bill_id)?.stage === 'enacted')],
];
// "You testified on HB 123 → the Health committee passed it": the result is the reward.
export function impactRows(acts, limit = 5) {
  const by = new Map();
  for (const a of acts) { const key = a.bill_id + '|' + (a.hearing_id || ''), x = by.get(key) || { bill_id: a.bill_id, hearing_id: a.hearing_id, kinds: [], at: '' };
    if (!x.kinds.includes(a.kind)) x.kinds.push(a.kind); if ((a.at || '') > x.at) x.at = a.at || ''; by.set(key, x); }
  const WORD = { testimony: 'testified', email: 'emailed the chair', legislators: 'wrote to their legislators', attend: 'went in person', share: 'shared it' };
  return [...by.values()].sort((x, y) => y.at.localeCompare(x.at)).map(x => {
    const b = anyBill(x.bill_id); if (!b) return null;
    const h = anyHearing(x.hearing_id), o = h && outcomeOf(h), past = h && new Date(h.scheduled_at) < Date.now(), who = h ? cmteName(h.committee) : '';
    const [tone, text] = b.stage === 'enacted' ? ['law', `${isResolution(b) ? 'Adopted' : 'Became law'}. Mahalo for your part in it.`]
      : b.stage === 'ballot' ? ['law', 'Passed the Legislature. The voters decide in November.']
      : b.stage === 'vetoed' ? ['stop', 'Vetoed by the Governor.']
      : o && /passed/.test(o.outcome || '') ? ['up', `${who} passed it${o.outcome === 'passed_amended' ? ' with changes' : ''}.`]
      : o && o.outcome === 'deferred' ? ['stop', `${who} put it on hold. Your testimony stays on the record for next time.`]
      : h && !past ? ['wait', `${who} hears it ${fmtDT(h.scheduled_at)}.`]
      : h ? ['wait', `Heard ${fmtDate(h.scheduled_at, { month: 'short' })}; waiting for the committee’s decision.`]
      : !alive(b) ? ['stop', 'Did not advance this session.'] : ['wait', STAGE_PLAIN[b.stage] ? STAGE_PLAIN[b.stage] + '.' : ''];
    return `<div class="imp imp-${tone}" data-open="${b.id}"><span class="impdot" aria-hidden="true"></span><div><b>${esc(billNum(b))}</b> <span class="impdid">You ${x.kinds.map(k => WORD[k]).join(', ')}</span><div class="impres">${esc(text)}</div></div></div>`;
  }).filter(Boolean).slice(0, limit).join('');
}
// The community, this session: only from 10 people (the view hides smaller totals). The bar fills toward the
// next round number; passing one since this device last looked gets a line of thanks, once.
export const RUNGS = [25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 25000];
export const COMM_KEY = DEMO ? 'hiphi_comm_rung_demo' : 'hiphi_comm_rung';
// Sandbox: three real March hearings the committee passed, marked as if you had acted, so the panel shows.
export function seedDemoActions() {
  try { if (S.done.size || localStorage.getItem('hiphi_demo_seeded')) { S.demoSeeded = localStorage.getItem('hiphi_demo_seeded') === '1' && S.done.size > 0; return; } } catch { return; }
  const now = Date.now(), hs = D.hearings.filter(h => new Date(h.scheduled_at) < now && new Date(h.scheduled_at) > now - 20 * 864e5 && D.outcomes.some(o => o.hearing_id === h.id && /passed/.test(o.outcome || '')))
    .filter(h => D.bills.some(b => b.id === h.bill_id && b.hiphi_position && b.hiphi_position !== 'monitor')).slice(-3);
  hs.forEach((h, i) => { const k = doneKey(h.bill_id, h.id, i === 1 ? 'email' : 'testimony'); S.done.add(k); S.doneAt[k] = new Date(new Date(h.scheduled_at).getTime() - 864e5).toISOString(); });
  if (hs.length) { saveDone(); saveDoneAt(); S.demoSeeded = true; try { localStorage.setItem('hiphi_demo_seeded', '1'); } catch { /* ignore */ } }
}
// HIPHI's picks for a coalition: strongly supported/opposed first, then bills
// with a position and a hearing coming up, then the rest with a position. Dead
// bills stay out. Capped so a first-timer sees a handful, not hundreds.
export const POS_RANK = { strongly_support: 0, strongly_oppose: 0, support: 1, oppose: 1, support_amend: 2, neutral: 3 };
export function curate(rows, cap = 6) {
  const now = Date.now(), up = new Set([...S.hearings, ...((S.featured || {}).hearings || [])].filter(h => new Date(h.scheduled_at) > now).map(h => h.bill_id));
  const live = rows.filter(b => alive(b) && b.hiphi_position && b.hiphi_position !== 'monitor');
  live.sort((a, b) => (POS_RANK[a.hiphi_position] ?? 9) - (POS_RANK[b.hiphi_position] ?? 9) || (up.has(b.id) - up.has(a.id)) || a.bill_number.localeCompare(b.bill_number));
  return { picks: live.slice(0, cap), rest: rows.filter(b => !live.slice(0, cap).includes(b)) };
}
export async function billsForCoalitions(names) {
  if (DEMO) return D.bills.filter(b => b.coalitions.some(n => names.includes(n)));
  const { data, error } = await S.supa.from('public_all_bills').select('*').overlaps('coalitions', names).not('hiphi_position', 'is', null).neq('hiphi_position', 'monitor').limit(400);
  if (error) throw error; return data || [];
}
// ---------- the guided start: pick issues -> pick bills -> done ----------
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
export const countOk = n => (Number(n) >= 10 ? Number(n) : 0);   // a group number is shown only from 10 people
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
export function issueOf(b) {
  const iss = issuesOf(b)[0], cat = iss && catOf(iss.category);
  if (cat) return { key: cat.name, names: [cat.key], icon: cat.icon };
  const n = (b.coalitions || [])[0]; if (!n) return null;
  const g = issues().find(x => x.names.includes(n));
  return g || { key: cname(n), names: [n], icon: 'heart-pulse' };
}
// "HIPHI supports" with its icon; position is a chip with an icon, never a colour stripe.
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
const DOW = { timeZone: HST, weekday: 'short' };
export const dayWord = iso => {   // "today", "tomorrow (Tue)", "Thu", "Mon, Mar 30"
  const d = hstDay(iso), today = hstDay(Date.now()), tmr = hstDay(Date.now() + 864e5), days = (new Date(d + 'T12:00:00-10:00') - new Date(today + 'T12:00:00-10:00')) / 864e5;
  const wd = new Date(iso).toLocaleDateString('en-US', DOW);
  return d === today ? 'today' : d === tmr ? `tomorrow (${wd})` : days > 0 && days < 7 ? wd : new Date(iso).toLocaleDateString('en-US', { timeZone: HST, weekday: 'short', month: 'short', day: 'numeric' });
};
export const timeWord = iso => new Date(iso).toLocaleTimeString('en-US', { timeZone: HST, hour: 'numeric', minute: '2-digit' });
// A date from another year says its year: a bill carried over from 2025 read "heard on Tue, Feb 11" and looked like
// last February (R-067).
export const dateLong = iso => { const d = new Date(iso), other = hstDay(d).slice(0, 4) !== hstDay(Date.now()).slice(0, 4);
  return d.toLocaleDateString('en-US', { timeZone: HST, weekday: 'short', month: 'short', day: 'numeric', ...(other ? { year: 'numeric' } : {}) }); };
// "Senate Health and Human Services Committee"; joint committees joined with "and" and "Committees".
export function cmteLabel(code, { short = false } = {}) {
  const cs = codesOf(code).map(c => S.committees[c]).filter(Boolean);
  if (!cs.length) return code ? `the ${code} committee` : 'a committee';
  const ch = CHAMBER_NAME[cs[0].chamber] || '';
  const names = cs.map(c => c.name);
  // Committee names often contain "and" themselves, so a joint pair repeats "Committee" to keep the two apart:
  // "Senate Health and Human Services Committee and Commerce and Consumer Protection Committee".
  if (names.length > 1) return short ? names.join(' / ') : `${ch} ${names.map(n => n + ' Committee').join(' and ')}`.trim();
  return short ? names[0] : `${ch} ${names[0]} Committee`.trim();
}
export const roomLabel = r => { const x = clean(r); return /^Rm /.test(x) ? 'Room ' + x.slice(3) : x === 'room TBD' ? 'room to be announced' : x; };
// Testimony deadline wording and urgency: danger under 24 hours, warning under 48.
export function dueInfo(h) {
  if (!h?.testimony_deadline) return null;
  const t = new Date(h.testimony_deadline).getTime(), left = t - Date.now();
  if (left <= 0) return { text: `Testimony deadline passed ${dateLong(h.testimony_deadline)} at ${timeWord(h.testimony_deadline)}`, tone: 'warn', late: true };
  return { text: `Testimony due ${dayWord(h.testimony_deadline)} at ${timeWord(h.testimony_deadline)}`, tone: left < 864e5 ? 'danger' : left < 2 * 864e5 ? 'warn' : '', late: false };
}
export const hearingText = h => h ? `Hearing ${dateLong(h.scheduled_at)} at ${timeWord(h.scheduled_at)} · ${roomLabel(h.room)}` : '';
// One plain sentence for where a bill is and what happens next.
export function plainStatus(b) {
  const st = stopOf(b);
  if (b.stage === 'enacted' || st.phase === 'law') return isResolution(b) ? { text: 'Adopted.', short: 'Adopted', tone: 'ok' } : { text: 'Became law.', short: 'Became law', tone: 'ok' };
  // A constitutional amendment the Legislature passed goes on the November ballot, not to the Governor (R-072).
  if (b.stage === 'ballot' || st.phase === 'ballot') return { text: 'Passed the House and Senate. The voters decide on it in the November election.', short: 'Goes to the voters', tone: 'ok' };
  if (b.stage === 'vetoed' || st.phase === 'vetoed') return { text: 'Vetoed by the Governor.', short: 'Vetoed', tone: '' };
  if (b.stage === 'governor' || st.phase === 'governor') return { text: 'Passed the House and Senate. It is on the Governor’s desk.', short: 'On the Governor’s desk', tone: 'info' };
  if (!alive(b) || st.phase === 'dead') return { text: whyStopped(b), short: isResolution(b) ? 'Not adopted this session' : 'Stopped this session', tone: '' };
  const ch = CHAMBER_NAME[st.chamber] || '';
  if (st.phase === 'conference') return { text: 'The House and Senate passed different versions. They are working out one version now.', short: 'House and Senate working out one version', tone: 'info' };
  if (st.phase === 'floor') return { text: `Through its ${ch} committees. Next is a vote of the full ${ch}.`, short: `Waiting for a ${ch} vote`, tone: 'info' };
  const where = st.committee ? `the ${cmteLabel(st.committee)}` : `a ${ch} committee`;
  const other = st.chamber === 'H' ? 'Senate' : 'House';
  const passed = st.leg === 'second' ? `Passed the ${other}. ` : '';
  if (st.hearingState === 'scheduled') {
    const d = dueInfo(st.hearing);
    return { text: `${passed}${cap(where)} ${codesOf(st.committee).length > 1 ? 'hear' : 'hears'} it ${dateLong(st.hearing.scheduled_at)} at ${timeWord(st.hearing.scheduled_at)}.`, short: d && !d.late ? `Hearing ${dayWord(st.hearing.scheduled_at)} · ${d.text.replace('Testimony ', 'testimony ')}` : `Hearing ${dayWord(st.hearing.scheduled_at)}`, tone: d?.tone || 'info' };
  }
  if (st.hearingState === 'held') return { text: `${passed}${cap(where)} heard it ${dateLong(st.hearing.scheduled_at)}. Waiting for ${codesOf(st.committee).length > 1 ? 'their' : 'its'} decision.`, short: 'Heard, waiting for the decision', tone: 'info' };
  if (!st.committee) return { text: `${passed}Waiting to be sent to a ${ch} committee.`, short: `Waiting for a ${ch} committee`, tone: '' };
  const dl = st.deadline && !st.deadline.missed ? st.deadline : null;
  return { text: `${passed}Waiting for a hearing in ${where}.${dl ? ` If it is not heard by ${dateLong(dl.date + 'T12:00:00-10:00')}, it stops for this year.` : ''}`,
    short: dl ? `Waiting for a hearing · ${dl.days} day${dl.days === 1 ? '' : 's'} left` : 'Waiting for a hearing', tone: dl && dl.days <= 7 ? 'warn' : '' };
}
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
// Why a bill stopped, exactly (R-083, Nate 9/29: "when a bill dies it doesn't say exactly why"). Three facts: where it got
// to, what happened there, and the rule it missed with its date, in plain words and without Capitol shorthand (no
// "Lateral" or "Decking"; DESIGN C-10). stopDetail is shown under the step bar's "Stopped in ..." (Nate 9/29: "These
// notes need to be in the steps section"; the sentence at the top went back to whyStopped); whyStoppedShort is the
// lists' few words.
// The rule each committee deadline sets, from the Legislature's deadline guide (the same rules stops.js follows, R-072).
const RULE_OF = { triple: 'bills sent to three or more committees had to be through all but their last two', lateral: 'bills had to be through all but their last committee', decking: 'bills had to be through all their committees' };
const theCmte = code => { const l = cmteLabel(code); return /^(the|a) /.test(l) ? l : `the ${l}`; };
const shortCmte = code => { const c = S.committees[codesOf(code)[0]]; return c ? `${CHAMBER_NAME[c.chamber] || ''} ${cmteLabel(code, { short: true })}`.trim() : code; };
const sameCmte = (h, code) => codesOf(h.committee).some(k => codesOf(code).includes(k));
export function stopFacts(b) {
  const origin = b.chamber || (String(b.bill_number || '').startsWith('S') ? 'S' : 'H'), other = origin === 'H' ? 'S' : 'H';
  const d = b.died_at_stage || '', m = /^(.*?)\s+(\d+\/\d+\/\d+)$/.exec(b.died_deadline || '');
  const f = { res: isResolution(b), when: m ? shortDate(m[2]) : '', label: m ? m[1] : (b.died_deadline || ''), d, dead: b.stage === 'dead',
    ch: CHAMBER_NAME[/^second/.test(d) ? other : origin] };
  // Only this session's hearings: a hearing a year earlier is not why it stopped (HB1278 was heard by WTL in 2025 and
  // stopped in WLA in 2026 without a hearing there; R-077).
  const yr = m ? '20' + m[2].slice(-2) : null;
  const past = hearingsOf(b).filter(h => h.status !== 'cancelled' && new Date(h.scheduled_at) < Date.now() && (!yr || String(h.scheduled_at).startsWith(yr)));
  const passed = h => /passed/.test(outcomeOf(h)?.outcome || '');
  if (b.stage === 'vetoed') return { ...f, kind: 'vetoed' };
  // A failed floor vote: the sync marks it (status_text) and records where it stood (died_at_stage), since a later line,
  // such as a recommittal, can follow the vote (HB1516; R-072's every-bill test).
  if (b.status_text === 'Failed a vote' || /failed to pass/i.test(b.last_action || '')) return { ...f, kind: 'failed' };
  // Held ("deferred"): the committee is in the Capitol's own line ("The committee(s) on CPN recommend(s) that the measure
  // be deferred"), the day is its hearing there.
  // "recommend(s) that the measure be HELD" is a hold too (SB2383, PSM; its outcome row reads Passed).
  if (HELD_RE.test(b.last_action || '') || /measure be HELD/i.test(b.last_action || '')) {
    const c = (/committee(?:\(s\))? on\s+([A-Z][A-Z\/]*)/.exec(b.last_action) || [])[1] || null;
    return { ...f, kind: 'held', cmte: c, heard: c ? past.filter(h => sameCmte(h, c)).pop() || null : null };
  }
  if (/^(first|second)_floor$/.test(d)) return { ...f, kind: 'floor' };
  // Stopped after both chambers passed it: in different versions, and no one final version (HB 1782; Nate 9/26).
  if (/^(second_crossover|conference)$/.test(d)) return { ...f, kind: 'final' };
  const at = stoppedAt(b);
  if (at) {
    // The committee it stopped in, what that committee did, and the one before it in the same chamber that passed it.
    const heard = past.filter(h => sameCmte(h, at.committee)).pop() || null;
    const before = past.filter(h => !sameCmte(h, at.committee) && S.committees[codesOf(h.committee)[0]]?.chamber === at.chamber && passed(h)).pop() || null;
    // Not heard there this year, but heard a year earlier (about 300 bills were put on hold in 2025 by the committee they
    // stopped in, carried over, and never taken up again), or a hearing it cancelled (SB654's in 2025): "never scheduled"
    // would be false.
    const all = hearingsOf(b).filter(h => sameCmte(h, at.committee) && new Date(h.scheduled_at) < Date.now());
    const prior = !heard && all.filter(h => h.status !== 'cancelled').pop() || null;
    const cancelled = !heard && !prior && all.filter(h => h.status === 'cancelled').pop() || null;
    return { ...f, kind: heard ? 'heard' : 'noHearing', cmte: at.committee, chamber: at.chamber, rule: /_(triple|lateral|decking)$/.exec(d)[1], heard, before,
      cancelled, prior, yr, outcome: heard ? outcomeOf(heard)?.outcome || null : null };
  }
  // A resolution with no stage to go on: say what hearings there were.
  const last = past.pop() || null;
  return { ...f, kind: last ? 'heard' : 'noHearing', cmte: last ? last.committee : null, heard: last, outcome: last ? outcomeOf(last)?.outcome || null : null };
}
export function stopDetail(b) {
  const f = stopFacts(b), end = f.res ? 'so it was not adopted this session.' : 'so it stopped for this session.';
  if (f.kind === 'vetoed') return 'Vetoed by the Governor.';
  if (f.kind === 'failed') {
    const o = b.chamber || (String(b.bill_number || '').startsWith('S') ? 'S' : 'H');
    return /^(conference|second_crossover)$/.test(f.d) ? 'It did not pass its final vote, so it stopped for this session.'
      : /^second/.test(f.d) ? `It did not pass the vote of the full ${CHAMBER_NAME[o === 'H' ? 'S' : 'H']}, so it stopped for this session.`
      : /^first/.test(f.d) ? `It did not pass the vote of the full ${CHAMBER_NAME[o]}, so it stopped for this session.` : 'Did not pass a vote.';
  }
  // The rule it missed, as its own sentence: "In the Senate, bills had to be through all but their last committee by Mar 30,
  // so it stopped for this session." Resolutions and bills that stopped when the session ended have no other deadline.
  const ended = f.res || /sine die/i.test(f.label);
  const rule = ended ? (f.when ? ` The session ended on ${f.when}, ${end}` : ` The session ended, ${end}`)
    : f.kind === 'floor' ? ` Bills had to pass the full ${f.ch} by ${f.when}, ${end}`
    : f.kind === 'final' ? (/fiscal/i.test(f.label) ? ` Bills that spend money needed a final version by ${f.when}, ${end}` : ` The final version had to be ready for its last vote by ${f.when}, ${end}`)
    : f.rule && f.when ? ` In the ${CHAMBER_NAME[f.chamber]}, ${RULE_OF[f.rule]} by ${f.when}, ${end}`
    : f.when ? ` Its deadline was ${f.when}, ${end}` : ` ${cap(end)}`;
  if (f.kind === 'held') {
    const who = f.cmte ? cap(theCmte(f.cmte)) : 'A committee', on = f.heard ? ` on ${dateLong(f.heard.scheduled_at)}` : '';
    // Held during the session: it could in theory come back, and almost never does.
    if (!f.dead && !f.res) return `${who} put it on hold${on} instead of passing it, which usually stops a bill for the rest of the session.`;
    return `${who} ${f.heard ? 'heard it' + on + ' and ' : ''}put it on hold instead of passing it, ${end}`;
  }
  if (f.kind === 'floor') return `Its ${f.ch} committees passed it, but the full ${f.ch} did not vote on it.${rule}`;
  if (f.kind === 'final') return `The House and the Senate each passed it, but in different versions, and they did not agree on one final version.${rule}`;
  if (f.kind === 'noHearing') {
    if (!f.cmte) return `No committee held a hearing on it.${rule}`;
    // The chair decides which bills a committee hears: "never scheduled a hearing" is the reason, not a missing step.
    const did = f.cancelled ? `scheduled a hearing for ${dateLong(f.cancelled.scheduled_at)}, then cancelled it and did not hold another`
      : f.prior ? `heard it on ${dateLong(f.prior.scheduled_at)}${outcomeOf(f.prior)?.outcome === 'deferred' ? ' and put it on hold' : ''}, and did not take it up again${f.yr ? ` in ${f.yr}` : ''}`
      : 'never scheduled a hearing on it';
    return f.before ? `${cap(theCmte(f.before.committee))} passed it on ${dateLong(f.before.scheduled_at)}, but the next committee, ${theCmte(f.cmte)}, ${did}.${rule}`
      : `${cap(theCmte(f.cmte))} ${did}.${rule}`;
  }
  if (f.kind === 'heard') {
    const who = cap(theCmte(f.heard.committee)), on = dateLong(f.heard.scheduled_at);
    // A committee that passed it where it stopped. Usually the full chamber turned down the committee's report ("The
    // recommendation was not adopted", HB1880); otherwise it did not reach its next step in time (HB 1779, R-067).
    const hc = CHAMBER_NAME[S.committees[codesOf(f.heard.committee)[0]]?.chamber];
    if (/passed/.test(f.outcome || '') && /recommendation was not adopted/i.test(b.last_action || '') && hc) return `${who} passed it on ${on}, but the full ${hc} voted not to accept the committee’s report.${rule}`;
    // The committee's vote is the Capitol's last line: its written report never reached the floor (HB1985, SB2243).
    if (/passed/.test(f.outcome || '') && /measure be PASSED/i.test(b.last_action || '') && hc) return `${who} passed it on ${on}, but its report did not reach the full ${hc} in time.${rule}`;
    if (/passed/.test(f.outcome || '')) return `${who} passed it on ${on}, but it did not reach its next step in time.${rule}`;
    // Taken off a decision-making agenda: the Capitol's line says so (HB2114, WAM, 4/9).
    if (/deleted the measure from decision making/i.test(b.last_action || '')) return `${who} was due to decide on it on ${on}, then took it off the list.${rule}`;
    if (f.outcome === 'deferred') return `${who} heard it on ${on} and put it on hold instead of passing it.${rule}`;
    return `${who} heard it on ${on} but did not vote to pass it.${rule}`;
  }
  return rule.trim();
}
// The lists' "What happened" column: the same facts in a few words ("No hearing in Senate Health by Mar 30").
export function whyStoppedShort(b) {
  const f = stopFacts(b), by = f.when ? ` by ${f.when}` : '';
  if (f.kind === 'vetoed') return 'Vetoed by the Governor';
  if (f.kind === 'failed') return 'Did not pass a vote';
  if (f.kind === 'held') return f.cmte ? `Put on hold by ${shortCmte(f.cmte)}` : 'Put on hold by a committee';
  if (f.kind === 'floor') return `No vote of the full ${f.ch}${by}`;
  if (f.kind === 'final') return `House and Senate did not agree${by}`;
  if (f.kind === 'noHearing') return f.cmte ? (f.prior && outcomeOf(f.prior)?.outcome === 'deferred' ? `Put on hold by ${shortCmte(f.cmte)} in ${f.prior.scheduled_at.slice(0, 4)}`
    : f.cancelled ? `Hearing cancelled in ${shortCmte(f.cmte)}` : `No hearing in ${shortCmte(f.cmte)}${by}`) : f.res ? 'Not heard before the session ended' : `No hearing${by}`;
  if (f.kind === 'heard' && /recommendation was not adopted/i.test(b.last_action || '')) return `Committee report turned down by the full ${CHAMBER_NAME[S.committees[codesOf(f.heard.committee)[0]]?.chamber] || 'chamber'}`;
  if (f.kind === 'heard' && /deleted the measure from decision making/i.test(b.last_action || '')) return `Taken off the decision list in ${shortCmte(f.heard.committee)}`;
  if (f.kind === 'heard') return f.outcome === 'deferred' ? `Put on hold by ${shortCmte(f.heard.committee)}` : /passed/.test(f.outcome || '') ? `Passed ${shortCmte(f.heard.committee)}, then stalled` : `Heard, not passed, in ${shortCmte(f.heard.committee)}`;
  return f.res ? 'Not adopted this session' : 'Stopped this session';
}
// Why a bill stopped, in words: "Put on hold by the Senate Education Committee, which usually stops it this year."
export function whyStopped(b) {
  if (b.stage === 'vetoed') return 'Vetoed by the Governor.';
  // The committee it stopped in, and only a hearing there: a hearing in another committee, or a year earlier, is not why it
  // stopped (HB1278 stopped in WLA in 2026, never heard there; it was heard by WTL in 2025; R-077).
  const at = stoppedAt(b), same = h => !at || codesOf(h.committee).some(k => codesOf(at.committee).includes(k));
  const heard = hearingsOf(b).filter(h => h.status !== 'cancelled' && new Date(h.scheduled_at) < Date.now() && same(h)).pop();
  // A failed floor vote: the sync marks it (status_text) and records where it stood (died_at_stage), since a later line,
  // such as a recommittal, can follow the vote (HB1516; R-072's every-bill test).
  if (b.status_text === 'Failed a vote' || /failed to pass/i.test(b.last_action || '')) {
    const o = b.chamber || (String(b.bill_number || '').startsWith('S') ? 'S' : 'H'), d = b.died_at_stage || '';
    return /^(conference|second_crossover)$/.test(d) ? 'It did not pass its final vote, so it stopped for this session.'
      : /^second/.test(d) ? `It did not pass the vote of the full ${CHAMBER_NAME[o === 'H' ? 'S' : 'H']}, so it stopped for this session.`
      : /^first/.test(d) ? `It did not pass the vote of the full ${CHAMBER_NAME[o]}, so it stopped for this session.` : 'Did not pass a vote.';
  }
  if (HELD_RE.test(b.last_action || '')) return 'Put on hold by a committee, which usually stops it for this year.';
  const m = /^(.*?)\s+(\d+\/\d+\/\d+)$/.exec(b.died_deadline || '');
  if (isResolution(b)) return 'It was not adopted this session.';
  // Through its committees, then no floor vote before Crossover (R-072: the backend now says so instead of Decking).
  const fl = /^(first|second)_floor$/.exec(b.died_at_stage || '');
  if (fl) { const o = b.chamber || (String(b.bill_number || '').startsWith('S') ? 'S' : 'H'), ch = CHAMBER_NAME[fl[1] === 'first' ? o : (o === 'H' ? 'S' : 'H')];
    return `It got through its ${ch} committees, but the full ${ch} did not vote on it before the deadline${m ? ` on ${shortDate(m[2])}` : ''}, so it stopped for this session.`; }
  // Stopped after both chambers passed it. Its last hearing was weeks earlier, so "heard on ... but did not move
  // forward" read as if a committee had stopped it (HB 1782, which died in conference; Nate 9/26).
  if (/^(second_crossover|conference)$/.test(b.died_at_stage || '')) return `It passed the House and the Senate, but the two did not agree on one final version before the deadline${m ? ` on ${shortDate(m[2])}` : ''}, so it stopped for this session.`;
  // A bill that passed its last hearing and then stalled was told it "did not move forward" there, right above that
  // hearing marked Passed (HB 1779, R-067). Say what the committee did when we know it, and nothing false when we don't.
  if ((m || b.died_deadline) && heard) {
    const o = outcomeOf(heard), who = S.committees[codesOf(heard.committee)[0]] ? `The ${cmteLabel(heard.committee)}` : 'A committee';
    if (o && /passed/.test(o.outcome || '')) return `${who} passed it on ${dateLong(heard.scheduled_at)}, but the next step did not happen before the deadline${m ? ` on ${shortDate(m[2])}` : ''}, so it stopped for this session.`;
    return `It was heard on ${dateLong(heard.scheduled_at)}, but it did not get through every step before the deadline${m ? ` on ${shortDate(m[2])}` : ''}, so it stopped for this session.`;
  }
  if (m || b.died_deadline) return `It did not get a hearing${at ? ` in the ${cmteLabel(at.committee)}` : ''} before the deadline${m ? ` on ${shortDate(m[2])}` : ''}, so it stopped for this session.`;
  return 'It stopped for this session.';
}
// A Capitol deadline date, "4/29/26", as "Apr 29".
const shortDate = mdy => new Date(mdy.replace(/(\d+)\/(\d+)\/(\d+)/, (x, mo, d, y) => `20${y.slice(-2)}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`) + 'T12:00:00-10:00').toLocaleDateString('en-US', { timeZone: HST, month: 'short', day: 'numeric' });
export const OUTCOME_PLAIN = { passed: 'Passed', passed_amended: 'Passed with changes', deferred: 'Put on hold (usually stops it this year)', recommitted: 'Sent back to the committee' };
// The chair's real address when the directory has it, else the Capitol pattern.
export function chairContacts(code) {
  return cmtesOf(code).filter(c => c.chair).map(c => {
    const m = (S.committeeMembers || []).find(x => x.committee === c.code && x.role === 'chair');
    const last = chairLast(c), leg = (m && legById(m.legislator_id)) || (S.legislators || []).find(l => l.chamber === c.chamber && (l.sort_name || '').split(',')[0].toLowerCase() === last.toLowerCase());
    return { name: c.chair, last: leg ? (leg.sort_name || '').split(',')[0] : last, title: c.chamber === 'S' ? 'Sen.' : 'Rep.', email: leg?.email || chairEmail(c), phone: leg?.phone || '', committee: c.name, code: c.code, leg };
  });
}
// Actions a person can take now: open testimony windows first (soonest deadline), then hearings whose written
// deadline passed but which have not been held yet ("late": emailing the chair is the quick way to be heard).
export function openActions(bills, hearings) {
  const now = Date.now();
  return hearings.filter(h => h.status === 'scheduled' && new Date(h.scheduled_at) > now)
    .map(h => ({ h, b: bills.find(b => b.id === h.bill_id) }))
    .filter(x => x.b && posInfo(x.b) && alive(x.b))
    .map(x => ({ ...x, late: !!(x.h.testimony_deadline && new Date(x.h.testimony_deadline) < now) }))
    .sort((x, y) => x.late - y.late || (x.h.testimony_deadline || x.h.scheduled_at).localeCompare(y.h.testimony_deadline || y.h.scheduled_at));
}
// Every action counts: any kind done on a hearing means the card is done for "Do this now".
export const actedOn = (b, h) => KINDS.some(k => S.done.has(doneKey(b.id, h?.id, k)));
export const didKind = (b, h, k) => S.done.has(doneKey(b.id, h?.id, k));
// A testimony letter saved in the walkthrough for this hearing and not sent yet (helper.js, hiphi_me.drafts; R-068).
export const testimonyDraft = h => { try { return !!h && !!JSON.parse(localStorage.getItem('hiphi_me') || '{}')?.drafts?.[h.id]; } catch { return false; } };
// Settled: the person has taken a real step for this hearing - testimony, an email to the chair, or going in person.
// A two-second Share alone settles it only once testimony can no longer be sent (late, or HIPHI's letter is not theirs
// to send). It used to count as done, which folded the card into "Done this week" with testimony still open (R-005,
// Nate 9/26). actedOn still says "they did something" (the card's Mahalo line); settledOn decides what folds away.
export const settledOn = (b, h) => ['testimony', 'email', 'attend'].some(k => didKind(b, h, k))
  || (didKind(b, h, 'share') && (!!dueInfo(h)?.late || agrees(b) === false || !posInfo(b)));
// A bill by number ("HB1563"), loaded with its hearings and outcomes even when nobody follows it (shared links, search).
export async function ensureBill(num) {
  const n = String(num || '').replace(/\s/g, '').toUpperCase();
  let b = S.bills.find(x => x.bill_number === n) || Object.values(S.extra).find(x => x.bill_number === n) || (S.results || []).find(x => x.bill_number === n);
  if (!b && DEMO) b = D.bills.find(x => x.bill_number === n) || D.index.find(x => x.bill_number === n);
  // The Supabase client hands back a dropped connection as an error value, not a throw. Throw it, so a caller can tell
  // "no such bill" (null) from "could not ask" (an error) and never blames the person for a weak signal.
  if (!b && !DEMO) { const { data, error } = await S.supa.from('public_all_bills').select('*').eq('bill_number', n).limit(1); if (error) throw error; b = data?.[0]; }
  if (!b) return null;
  if (!S.bills.some(x => x.id === b.id)) S.extra[b.id] = b;
  if (DEMO && !S.bills.some(x => x.id === b.id) && !S.xh[b.id]) { S.xh[b.id] = D.hearings.filter(h => h.bill_id === b.id); D.outcomes.filter(o => o.bill_id === b.id).forEach(o => { S.outcomes[o.hearing_id] = o; }); }
  if (!DEMO && !S.bills.some(x => x.id === b.id) && !S.xh[b.id]) {
    const [h, o] = await Promise.all([S.supa.from('public_all_hearings').select('*').eq('bill_id', b.id), S.supa.from('public_hearing_outcomes').select('*').eq('bill_id', b.id)]);
    if (h.error || o.error) throw (h.error || o.error);   // a bill drawn with no hearings because the fetch failed would read as "no hearing yet"
    S.xh[b.id] = h.data || []; (o.data || []).forEach(x => { S.outcomes[x.hearing_id] = x; });
  }
  // The bill page's conference and Governor steps read the bill's recent Capitol actions (who chairs the conference, a
  // veto notice); a bill opened without being followed has none loaded yet (R-056). Decoration: a failure leaves the
  // step with its fallback (your own legislators), never an error.
  if (!S.bills.some(x => x.id === b.id) && !(S.xa ??= {})[b.id] && ['conference', 'governor'].includes(b.stage)) {
    if (DEMO) S.xa[b.id] = (D.activity || []).filter(a => a.bill_id === b.id);
    else { const { data, error } = await S.supa.from('public_activity').select('*').eq('bill_id', b.id).order('occurred_at', { ascending: false }).limit(100); if (!error) S.xa[b.id] = data || []; }
  }
  return b;
}
// Where a person is in the guided start: a first visit is someone who has not finished or skipped it, follows nothing
// and has done nothing. Someone who sent the quick email from a link, then said "Don't follow it", came back to the
// start as if new (R-067): an action they marked counts as having been here.
export const firstVisit = () => !followsAnything() && !myActions().length && !hasDrafts() && ((!wiz().done && !wiz().skipped) || readyForSession());
const hasDrafts = () => { try { return Object.keys(JSON.parse(localStorage.getItem('hiphi_me') || '{}')?.drafts || {}).length > 0; } catch { return false; } };
// Picked issues off-season (step O3 saves the opening day in wiz().ready): once the session is open, show them the bills.
export const readyForSession = () => !!wiz().ready && !followsAnything() && sessionInfo().phase === 'in' && Date.now() >= hiT(wiz().ready);
export const billPath = b => '#/bill/' + String(b.bill_number).replace(/\s/g, '');
export const spaced = n => String(n || '').replace(/^([A-Z]+)\s*(\d)/, '$1 $2');   // "HB1563" -> "HB 1563"
// Asking a chair for a hearing is remembered per committee, so a bill asked about in its House committee is offered
// again when it later waits in the Senate. The email itself is still the person's action under the usual key
// (<bill id>||email): that is what is counted and what reaches their account. The committee mark,
// <bill id>|<committee code as referred, e.g. HHS/EIG>|ask, lives in this browser only: 'ask' is not an action kind, so
// it is neither counted nor uploaded. A mark from before 9/19 (the usual key, with no committee mark on the bill at
// all) still counts, for every committee.
export const askMark = (b, code) => `${b.id}|${code}|ask`;
export const askedChair = (b, code) => S.done.has(askMark(b, code))
  || (S.done.has(doneKey(b.id, '', 'email')) && ![...S.done].some(k => k.startsWith(b.id + '|') && k.endsWith('|ask')));
// Bills waiting for a hearing, soonest deadline first: on Home these become a lighter "ask the chair" card, so a
// follower is never told "all caught up" while a bill of theirs is running out of time (assessment, 9/19).
export function waitingBills(bills) {
  return bills.filter(b => alive(b) && posInfo(b)).map(b => ({ b, st: stopOf(b) }))
    .filter(x => x.st.phase === 'committee' && x.st.hearingState === 'none' && x.st.committee && x.st.deadline && !x.st.deadline.missed)
    .sort((x, y) => x.st.deadline.days - y.st.deadline.days);
}
// The email step (Nate, 9/19; bundled into one "keep me updated" ask per HANDOFF 3.5, 9/20): asking for an email
// is part of the flow, and saying yes IS the consent for both hearing alerts and HIPHI's own advocacy alerts -
// one opt-in, not two. The choices wait in this browser until the link is opened (loadUser applies them), exactly
// like the sign-in page.
export async function sendEmailLink(email, { hearing_alerts = true, action_alerts = true } = {}) {
  // The sandbox sends nothing, but it remembers the email was given, as the live page does: otherwise Home asked a tester
  // for their email again a minute after they gave it (R-098). Its storage is the sandbox's own (every hiphi_ name is
  // hiphi_*_demo there, see the top of this file), so no consent reaches the live page in this browser.
  if (DEMO) { try { sessionStorage.setItem('hiphi_link_sent', email); localStorage.setItem(CONSENT_KEY, JSON.stringify({ hearing_alerts, action_alerts })); } catch { /* ignore */ } return { demo: true }; }
  try { localStorage.setItem(CONSENT_KEY, JSON.stringify({ hearing_alerts, action_alerts })); } catch { /* ignore */ }
  const sb = await supa();
  const { error } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + location.pathname } });
  if (error) throw error;
  try { sessionStorage.setItem('hiphi_link_sent', email); } catch { /* ignore */ }
  return { sent: true };
}
export const validEmail = e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e || '').trim());
