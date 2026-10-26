// HIPHI Staff v2: the data layer. A VERBATIM copy of the current staff app's data code (app.js at commit ac1acb7,
// source line ranges 6-6, 7-11, 20-24, 25-25, 26-29, 35-35… — see tools/parity.mjs), so the new look talks to Supabase exactly the way
// the current app does and the current app stays untouched. Mechanical edits only: `export` on every declaration, and
// the four calls into the old screens (boot, renderRecovery, loadFilters, toast) go through `hooks`, which the v2
// frame fills in. When app.js changes a query, run `node staff/tools/parity.mjs` and copy the change here.
import { billStop, hearingStream, pathwayStops } from '../stops.js';
export { billStop, hearingStream, pathwayStops };
export const hooks = { onAuth: () => {}, onRecovery: () => {}, afterLoad: () => {}, toast: () => {}, render: () => {} };
export const SUPABASE_URL = 'https://eivzjbnygscguqqiiuvh.supabase.co';
export const SUPABASE_KEY = 'sb_publishable_uvEtw8ru3zB9lDOxAjzrUA_JEFvKyul';
// What every email-settings save says when the settings could not be read (Z1-5).
export const EMAIL_UNREAD = 'Couldn’t read the email settings. Reload, then save.';
// The email settings from their read (Z1-5): a read that failed is not "no row yet". The database counts a missing row as
// email on (email_enabled(), backend 020), so no row reads as on; a failed read counts as paused, and saveEmailSettings
// refuses every email save until a reload reads it, so a Save can never write a guess over the real switch.
export const emailCfgOf = r => !r || r.error ? { err: EMAIL_UNREAD, cfg: { enabled: false } } : { err: '', cfg: r.data?.value || { enabled: false } }; // no row counts as paused, as the database's email_enabled() does since 145 (R-180)
// Issue and list icons (9/19): the public page shows Lucide icons, not emoji, so staff pick from a short list of
// names. Old emoji values still display (mapped) until they are re-saved.
export const DEMO = new URLSearchParams(location.search).has('demo');
// R-316 W43 (C-5): an open page looks for drafts and to-dos a teammate changed, about every 2 minutes (app.js), and a
// button refused because someone else already acted says who and when. Show me lane: on the practice copy first; Nate's
// yes flips this to `() => true` (as prep.js SELF_APPROVE). The practice copy has no server, so its poll reads nothing;
// its refused-button path is the one to try (see raced below).
export const LIVE_REFRESH = () => true;   // live 10/22 at Nate's yes (R-330)
// Sandbox: the real 2026 session frozen at Monday March 16, 2026, 9:00 HST
// (demo/snapshot.json, built by Bill-Tracker/tools/build_snapshot.js). The
// clock starts there and runs forward for the length of the visit, so
// countdowns tick but nothing new ever arrives. `&season=off` previews the months between sessions: the clock is
// 18 September instead and the session has ended, as pub/core.js does (R-022).
const DEMO_OFF = DEMO && new URLSearchParams(location.search).get('season') === 'off';
// `&season=opening` (R-118) starts the clock on 22 January, inside the opening weeks (10 to 31 January), so Today shows the
// new bills to sort and an issue's prep card folds. The bills stay the March snapshot, as with season=off.
const DEMO_OPENING = DEMO && new URLSearchParams(location.search).get('season') === 'opening';
// R-316: `&season=off&day=2026-11-05` starts that between-sessions clock on another autumn day instead (9:00 HST), so the
// 2027 issue prep's last week and the days after its due date (Fri 6 Nov) can be checked on the practice copy.
const DEMO_OFFDAY = (d => DEMO_OFF && /^2026-(09|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(d || '') ? d : '')(new URLSearchParams(location.search).get('day'));
export const DEMO_ASOF = DEMO_OFFDAY ? `${DEMO_OFFDAY}T09:00:00-10:00` : DEMO_OFF ? '2026-09-18T09:00:00-10:00' : DEMO_OPENING ? '2026-01-22T09:00:00-10:00' : '2026-03-16T09:00:00-10:00';
// R-316 W38: the practice copy's changes (drafts, to-dos, who is going, notes, owners, follows) are kept in this tab when the
// page reloads, as switching person does (&as=), until Start over in your menu. Only for the same practice day; the clock
// carries on from where it was, so a draft sent at 9:20 is not "sent in the future" after the switch.
const PRACTICE_KEY = 'hiphi5_practice', PRACTICE_V = 1;
const PRACTICE = DEMO ? (() => { try { const p = JSON.parse(sessionStorage.getItem(PRACTICE_KEY) || 'null'); return p && p.v === PRACTICE_V && p.asof === DEMO_ASOF ? p : null; } catch { return null; } })() : null;
if (DEMO) {
  const RD = Date, off = RD.now() - (PRACTICE?.clock || new RD(DEMO_ASOF).getTime());
  window.Date = class extends RD { constructor(...a) { a.length ? super(...a) : super(RD.now() - off); } static now() { return RD.now() - off; } };
}
export const HASH_Q = new URLSearchParams(location.hash.slice(1));
export let RECOVERY = HASH_Q.get('type') === 'recovery';
// A spent or expired link returns #error=...&error_description=... instead.
// Surfacing it matters: without it the app showed a bare sign-in form, the link
// looked like it had done nothing, and clicking again burned the next token too.
export const LINK_ERR = HASH_Q.get('error_description') || '';
// A sign-in link from Session setup > Team (M1-3): #/link/<token hash>. Read before the client starts, like the others.
export const LINK_TOKEN = (/^#\/link\/([0-9a-f]{20,128})$/i.exec(location.hash) || [])[1] || '';
// Own origin + path, so the GitHub Pages subpath is picked up automatically: the tracker's folder address, which since
// 9/21 is Staff v2 itself (index.html; staff.html is the same page). Recovery links land there, an address already on
// Supabase's redirect list, and every Slack, email and calendar link the database writes points there too (R-022).
export const APP_URL = location.origin + location.pathname.replace(/(staff\d*|index)\.html$/, '')  // staff5.html too (R-277 E-1: the old pattern left "Open the old app" blank);
// January flip: see JANUARY.md in the Bill-Tracker repo. Update SESSION_YEAR
// here, plus SESSION_OVER and DEADLINES in the Cards-view block below.
export let SESSION_YEAR = 2026;   // overwritten from session_deadlines at load (applySessionDeadlines)
// first_floor / second_floor (through committee, waiting for the floor vote) and ballot (a constitutional amendment for
// the voters) since R-072; the ribbon draws them on the deadline they race (staff/ui.js ribbonKey).
export const STAGES = [
  ['introduced','Introduced'], ['first_triple','First triple filing'], ['first_lateral','First lateral'],
  ['first_decking','First decking'], ['first_floor','First floor vote'], ['first_crossover','Crossover'], ['second_triple','Second triple filing'],
  ['second_lateral','Second lateral'], ['second_decking','Second decking'], ['second_floor','Second floor vote'],
  ['second_crossover','Passed Both'], ['conference','Conference'], ['governor','Governor'],
  ['enacted','Law'], ['vetoed','Vetoed'], ['ballot','To the voters'], ['dead','Dead'],
];
export const STAGE_LABEL = Object.fromEntries(STAGES);
export const POSITIONS = [['','—'],['strongly_support','Strongly support'],['support','Support'],['support_amend','Support w/ amendments'],['strongly_oppose','Strongly oppose'],
  ['oppose','Oppose'],['monitor','Monitor'],['neutral','Comments (neutral)']];
export const LOG_TYPES = [['testimony','Testimony'],['coalition','Coalition'],['meeting','Meeting'],
  ['action_alert','Supporter email'],['note','Note']];
export const S = {
  tripleF: false, syncRuns: [], selected: new Set(), sinceVisit: 0, sinceEvents: [], compStage: {},
  supa: null, session: null, me: null,
  advocates: [], bills: [], hearings: [], pulse: {}, campaigns: [], feed: [],
  assignments: {},           // bill_id -> [advocate_id]
  billCampaigns: {},         // bill_id -> [campaign_id]
  // Validated on read: a view name persisted by an older build (or by a
  // build where that view still existed) must not leave someone staring
  // at an empty page. Unknown names fall back.
  view: (v => ['portfolio','table','add','settings','help','triage','inbox','memo','lists','setup','legislators','emails','people','dead'].includes(v)
              ? v : 'portfolio')(localStorage.getItem('view')),
  owner: 'me', q: '', pri: '', pris: new Set(), camps: new Set(), lsts: new Set(), poss: new Set(), stands: new Set(), hearF: false, riskF: false, aliveF: false, filterOpen: false, stageF: '', camp: '',
  drawerBill: null, logType: 'testimony', sort: ['bill_number', 1],
  todos: {},   // bill_id -> [todo]
  drafts: {},  // bill_id -> [testimony draft]
  drawerOpen: { bill: null, pub: false, notes: false, details: false, team: false, todo: false },   // per bill: survives the re-render a save causes, resets when another bill opens
  committees: {},   // code -> {name, chair, vice_chair}; empty until the committees table exists
  deskOut: false,
  // Issues (063, R-018): what the public follows. Categories (the six) -> issues -> the bills that carry them.
  categories: [], issues: [], issueCats: [], billIssues: [], issueLinks: [], issueLinkChoices: [],
  // The issues' prep for 2027 (091, R-088): each issue's helpers, and the due date (app_settings 'issue_prep').
  issueHelpers: [], issuePrep: { due: '2026-11-06' },
};
export const $ = sel => document.querySelector(sel);
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
  ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const asDate = d => new Date(/^\d{4}-\d{2}-\d{2}$/.test(String(d)) ? d + 'T12:00:00-10:00' : d);
export const fmtDate = (d, opts) => d ? asDate(d).toLocaleString('en-US',
  { timeZone: 'Pacific/Honolulu', month: 'numeric', day: 'numeric', ...opts }) : '—';
export const fmtDT = d => fmtDate(d, { weekday: 'short', hour: 'numeric', minute: '2-digit' }).replace(/^(\w{3}),/, '$1');   // "Wed 3/18, 1:00 PM": nobody should have to work out the weekday
export const daysAgo = d => d ? Math.floor((Date.now() - new Date(d)) / 864e5) : null;
export const effStage = b => b.stage_override || b.stage || 'introduced';
export const advocate = id => S.advocates.find(a => a.id === id);
export const owners = b => (S.assignments[b.id] || []).map(advocate).filter(Boolean);
export const capitolUrl = b => {
  const m = (b.bill_number||'').match(/^([A-Z]+)(\d+)$/);
  return m ? `https://www.capitol.hawaii.gov/session/measure_indiv.aspx?billtype=${m[1]}&billnumber=${m[2]}&year=${b.session_year||SESSION_YEAR}`
           : (b.state_url || '#');
};
export const sponsorText = b => {
  const sp = b.sponsors || []; if (!sp.length) return '\u2014';
  const names = sp.slice(0, 6).map((s, i) => i === 0 ? `<b>${esc(s.n)}</b>` : esc(s.n)).join(', ');
  return names + (sp.length > 6 ? ` +${sp.length - 6} more` : '');
};
// Supabase answers one request with at most 1,000 rows (the project's API "Max rows"), whatever .limit() asks for, and
// says nothing when it cuts: .limit(2000) on 1,400 tracked bills quietly returns the first 1,000 by number, and 60 days
// of hearings in session (up to 4,000 rows) came back as the oldest 1,000, without the week ahead. So every load that
// can grow is read in pages. make(opts) builds the query afresh for each page, passes opts to select(), and orders by
// something unique, or a row can repeat or fall between two pages. A short first page is the whole answer and costs
// one request, exactly as before; only a full page asks how many there are and fetches the rest together. Asking for
// the total up front instead made every load count its rows a second time, which doubled the slowest query of Nate's
// sign-in (R-034). Resolves like one query: { data, error }. PAGE is the server's cap: lower it if "Max rows" is.
const PAGE = 1000;
export async function allRows(make) {
  const first = await make().range(0, PAGE - 1);
  if (first.error || (first.data || []).length < PAGE) return first;
  const { count, error } = await make({ count: 'exact', head: true });
  if (error) return { ...first, data: null, error };
  const rest = await Promise.all(Array.from({ length: Math.max(0, Math.ceil(count / PAGE) - 1) },
    (_, i) => make().range(PAGE * (i + 1), PAGE * (i + 2) - 1)));
  return rest.find(r => r.error) || { ...first, data: first.data.concat(...rest.map(r => r.data)) };
}
// The roll-up as profile_rollup (backend 130) returns it, from rows of people_overview (the sandbox).
function rollupOf(people) {
  const hasStory = p => !!p.story || Object.keys(p.stories || {}).length > 0, count = new Map(), own = new Map();
  for (const p of people) for (const t of p.titles || []) { if (/^own:/.test(t)) { const w = t.slice(4).toLowerCase(); own.set(w, (own.get(w) || 0) + 1); } else count.set(t, (count.get(t) || 0) + 1); }
  const top = m => [...m].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  return { accounts: people.filter(p => p.user_id || p.has_account).length, with_titles: people.filter(p => (p.titles || []).length).length,
    with_story: people.filter(hasStory).length, quote: people.filter(p => hasStory(p) && (p.interests || []).includes('quote')).length,
    list: top(count).map(([k, n]) => ({ k, n })), own: top(own).slice(0, 50).map(([t, n]) => ({ t, n })) };
}
// Priority follows the position (R-175, Nate 10/5): strongly support is P1, every other position P2, no position none.
// It is not its own choice any more; the database sets it the same way (migration 143), and this keeps the screen in
// step with it, Undo included, without a reload.
export const priorityOf = pos => !pos ? null : pos === 'strongly_support' ? 1 : 2;
const withPriority = p => 'position' in p ? { ...p, priority: priorityOf(p.position) } : p;
export const DB = {
  async init() {
    if (DEMO) { await demoInit(); return; }
    // Pinned to the version the public page uses (pub/kernel.js SUPABASE_JS; R-152 D): "@2" let a new release change the staff app overnight.
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.2/+esm');
    S.supa = createClient(SUPABASE_URL, SUPABASE_KEY);
    const { data } = await S.supa.auth.getSession();
    S.session = data.session;
    S.supa.auth.onAuthStateChange((e, sess) => {
      const had = !!S.session; S.session = sess;
      // A recovery link creates a real session, so without this branch hooks.onAuth()
      // would just load the app and never offer to set a new password.
      if (e === 'PASSWORD_RECOVERY') { RECOVERY = true; hooks.onRecovery(); return; }
      if (!!sess !== had) hooks.onAuth();
    });
  },
  async login(email, password) {
    const { error } = await S.supa.auth.signInWithPassword({ email, password });
    if (error) throw error;
  },
  async sendRecovery(email) {
    // redirectTo must also be on the Supabase redirect allowlist, and Site URL
    // must point at this app - otherwise the link verifies, then bounces the
    // browser to a dead address and spends the token for nothing.
    const { error } = await S.supa.auth.resetPasswordForEmail(email, { redirectTo: APP_URL });
    if (error) throw error;
  },
  async setPassword(password) {
    const { error } = await S.supa.auth.updateUser({ password });
    if (error) throw error;
  },
  logout() { DEMO ? location.reload() : S.supa.auth.signOut(); },
  async loadAll() {
    if (DEMO) return;
    S.pq = undefined; S.pg = undefined; S.pAsks = undefined;   // R-328 B, G: Today's partner words, the Partners screen and the partner asks read again too
    // link my login to my advocate row (no-op after first time)
    const { data: myId, error: claimErr } = await S.supa.rpc('claim_advocate');
    if (claimErr) console.warn('claim_advocate:', claimErr.message);
    // One clock for the whole load, so every page of a paged query asks for the same window.
    const loadedAt = Date.now(), daysBack = d => new Date(loadedAt - d * 864e5).toISOString();
    // These four need nothing from the main load, so they go out with it instead of one after another after it. They
    // used to be four more round trips, each with its own CORS preflight: about three of the eight seconds Nate's
    // sign-in took on 9/21 (R-034). Each falls back to empty, as before; none of them can fail the load.
    const extras = Promise.all([
      // Freshness indicator data
      // Bill syncs only (R-180 Z1-4): a draft run or a bulk import finishing is not the bills being fresh.
      S.supa.from('sync_runs').select('finished_at,ok').not('kind', 'in', '("testimony","bulk:openstates")').order('started_at', { ascending: false }).limit(10),
      // Official actions found since this person's previous visit
      S.supa.from('activity_log').select('bill_id,title,occurred_at,created_at')
        .eq('source', 'auto').gt('created_at', new Date(S.sinceVisit).toISOString())
        .order('created_at', { ascending: false }).limit(200),
      // Everything that happened on tracked bills in the last eight days, every source. Eight days covers "since
      // yesterday", "since Friday", "since your last visit" and "the last 7 days". It used to be 72 hours across all
      // 6,000 bills, capped at 300 rows: the Capitol stamps its actions 08:00, so on a Monday after 8 AM all of
      // Friday's fell outside the window, and on a busy day the cap dropped most of the rest (R-022). The inner join
      // keeps it to the bills the team tracks.
      allRows(o => S.supa.from('activity_log')
        .select('bill_id,title,details,occurred_at,type,advocate_id,source,bills!inner(tracked)', o)
        .eq('bills.tracked', true)
        .gt('occurred_at', daysBack(8))
        .order('occurred_at', { ascending: false }).order('id')),
      this.loadIssues(),
    ].map(p => Promise.resolve(p).catch(() => null)));
    // The partners' queue (partner_queue, 184) goes out as soon as the advocates come back and say this person admits partners
    // (an admin or a partner approver: partnerq.js admitsPartners), alongside the rest of the load, so a live first frame
    // already counts their words to approve in Today's number (it was asked for after the load, and Today's count changed a
    // moment after the page drew). One promise for the advocates read: a query is sent again each time it is awaited.
    const advP = Promise.resolve(S.supa.from('advocates').select('*').order('full_name'));
    // A failed read says so on Today's line, with Try again (partnerq.js wantQueue keeps the same three fields).
    S.pqLoading = true; S.pqErr = false;
    const pqP = advP.then(r => {
      const rows = r?.data || [], me = rows.find(a => a.id === myId) || rows.find(a => a.email === S.session?.user?.email);
      if (!me || me.is_active === false || !(me.is_admin || me.approves_partners)) return;
      return this.partnerQueue().then(q => { S.pq = q; });
    }).catch(e => { console.warn('partner_queue:', e?.message || e); S.pq = null; S.pqErr = true; }).finally(() => { S.pqLoading = false; });
    const [adv, bills, asg, camps, bc, hear, pulse, feed, todos, drafts, comms, scfg, ccfg, ecfg, sycfg, dls, slots, fol, att, outc, msgs, reads, inb, scal, pls, plb, plf, legs, cms, cps, sts, als, segs, fups, mut, pac, wc] = await Promise.all([
      advP,
      allRows(o => S.supa.from('bills').select('*', o).eq('tracked', true).order('bill_number').order('id')),
      allRows(o => S.supa.from('bill_assignments').select('bill_id,advocate_id', o).order('bill_id').order('advocate_id')),
      S.supa.from('campaigns').select('*').order('sort_order'),
      allRows(o => S.supa.from('bill_campaigns').select('bill_id,campaign_id', o).order('bill_id').order('campaign_id')),
      // Hearings of tracked bills only (R-152 B): on a peak day that is about a tenth of the rows (the sign-in read 4,602
      // hearings when 499 were needed). The inner join keeps it to the bills the team tracks, as the activity read above does.
      allRows(o => S.supa.from('hearings').select('*, bills!inner(tracked)', o).eq('bills.tracked', true).gte('scheduled_at', daysBack(60)).order('id')),
      allRows(o => S.supa.from('bill_pulse').select('*', o).order('bill_id')),
      S.supa.from('activity_log').select('*').eq('source','team')
        .order('occurred_at', { ascending: false }).limit(25),
      allRows(o => S.supa.from('bill_todos').select('*', o).order('sort_order').order('created_at').order('id')),
      allRows(o => S.supa.from('testimony_drafts').select('*', o).order('created_at').order('id')),
      S.supa.from('committees').select('*'),
      S.supa.from('app_settings').select('value').eq('key', 'slack').maybeSingle(),
      S.supa.from('app_settings').select('value').eq('key', 'calendar').maybeSingle(),
      S.supa.from('app_settings').select('value').eq('key', 'email').maybeSingle(),
      S.supa.from('app_settings').select('value').eq('key', 'sync').maybeSingle(),
      S.supa.from('session_deadlines').select('*'),
      S.supa.from('committee_slots').select('*'),
      allRows(o => S.supa.from('bill_follows').select('advocate_id,bill_id', o).order('advocate_id').order('bill_id')),
      allRows(o => S.supa.from('hearing_attendance').select('hearing_id,advocate_id', o).order('hearing_id').order('advocate_id')),
      allRows(o => S.supa.from('hearing_outcomes').select('*', o).gte('scheduled_at', daysBack(14)).order('hearing_id')),
      allRows(o => S.supa.from('bill_messages').select('*', o).is('deleted_at', null).gte('created_at', daysBack(90)).order('created_at').order('id')),
      allRows(o => S.supa.from('bill_message_reads').select('*', o).order('advocate_id').order('bill_id')),
      S.supa.rpc('my_inbox', { p_limit: 300 }),
      S.supa.from('session_calendar').select('*'),
      S.supa.from('public_lists').select('*').is('archived_at', null).order('sort_order').order('created_at'),
      S.supa.from('public_list_bills').select('*').order('sort_order').order('added_at'),
      S.supa.rpc('list_follow_counts'),
      S.supa.from('legislators').select('*').eq('active', true).order('chamber').order('district'),
      allRows(o => S.supa.from('committee_members').select('*', o).order('session_year').order('committee').order('legislator_id')),
      S.supa.from('committee_counterparts').select('*'),
      allRows(o => S.supa.from('legislator_stances').select('*', o).order('bill_id').order('legislator_id')),
      S.supa.from('action_alerts').select('*').order('created_at', { ascending: false }).limit(200),
      S.supa.from('people_segments').select('*').order('name'),
      S.supa.from('people_followups').select('*, person:people(id,name,email,phone)').is('done_at', null).order('due', { nullsFirst: false }),
      allRows(o => S.supa.from('bill_mutes').select('advocate_id,bill_id', o).is('unmuted_at', null).order('advocate_id').order('bill_id')),
      S.supa.from('public_action_counts').select('*'),   // the public's response, counts only (R-117)
      // The public's follower number, the stored count the public page shows (follow_set: bill, issue and category
      // follows; backend 115, refreshed every five minutes). watch_counts() counted direct bill follows only, so staff's
      // number sat far below the public one (Z1-7).
      allRows(o => S.supa.from('follower_counts').select('bill_id,n', o).order('bill_id')),
    ]);
    // A read that fails must say so (R-152 B). Only eight of these stop the app; the rest fell back to an empty list without a
    // word, so a failed drafts read made Today say "No testimony draft yet" on every hearing. Each failed read is named
    // here and the frame shows one notice with a Reload (S.loadFailed, app.js loadNotice); the screens that would otherwise
    // state something false from an empty list check S.failed(key) instead (Today's no-draft card, the bill page).
    const READS = { 'to-dos': [todos], 'testimony drafts': [drafts], committees: [comms], 'settings': [scfg, ccfg, ecfg, sycfg], 'session deadlines': [dls], 'committee slots': [slots],
      follows: [fol], 'who is going': [att], 'hearing results': [outc], 'chat messages': [msgs, reads], 'your inbox': [inb], 'the session calendar': [scal],
      lists: [pls, plb, plf], legislators: [legs, cms, cps, sts], 'supporter emails': [als], people: [segs, fups], mutes: [mut], 'the public response': [pac, wc] };
    S.loadFailed = Object.entries(READS).filter(([, rs]) => rs.some(r => !r || r.error)).map(([k]) => k);
    S.failed = key => (S.loadFailed || []).includes(key);
    S.inbox = inb?.data || [];
    S.messages = {}; (msgs?.data || []).forEach(m => (S.messages[m.bill_id] ??= []).push(m));
    S.chatSeen = Object.fromEntries((reads?.data || []).map(r => [r.bill_id, r.seen_at]));
    S.slackCfg = scfg?.data?.value || null;
    S.calCfg = ccfg?.data?.value || null;
    ({ err: S.emailCfgErr, cfg: S.emailCfg } = emailCfgOf(ecfg));
    S.syncCfg = sycfg?.data?.value || {};
    applySessionDeadlines(dls?.data || []);
    S.sessionCal = scal?.data || [];
    S.alerts = als?.data || [];
    S.people = []; S.peopleLoaded = false; S.segments = segs?.data || []; S.followups = fups?.data || []; S.peopleNotes = {}; S.personTL = {};
    S.legislators = legs?.data || []; S.committeeMembers = cms?.data || []; S.counterparts = cps?.data || []; S.stances = sts?.data || []; S.legNotes = {};
    S.lists = pls?.data || []; S.listBills = plb?.data || []; S.listFollowers = Object.fromEntries((plf?.data || []).map(r => [r.list_id, Number(r.followers)]));
    S.slots = slots?.data || [];
    S.followersBy = {}; (fol?.data || []).forEach(r => (S.followersBy[r.bill_id] ??= []).push(r.advocate_id));
    S.attend = {}; (att?.data || []).forEach(r => (S.attend[r.hearing_id] ??= []).push(r.advocate_id));
    S.outcomes = Object.fromEntries((outc?.data || []).map(o => [o.hearing_id, o]));
    // The public's response per bill (R-117): follows, and the actions people with accounts marked. Counts only.
    S.pubCounts = {};
    (wc?.data || []).forEach(r => { (S.pubCounts[r.bill_id] ??= {}).followers = Number(r.n) || 0; });
    (pac?.data || []).forEach(r => { Object.assign(S.pubCounts[r.bill_id] ??= {}, { emails: Number(r.emails) || 0, testimonies: Number(r.testimonies) || 0, attending: Number(r.attending) || 0, shares: Number(r.shares) || 0, people: Number(r.people) || 0 }); });
    for (const r of [adv, bills, asg, camps, bc, hear, pulse, feed])
      if (r.error) throw r.error;
    S.advocates = adv.data; S.bills = bills.data; S.campaigns = camps.data; hooks.afterLoad();
    S.hearings = hear.data.map(({ bills: _b, ...h }) => h);
    S.assignments = {}; asg.data.forEach(r =>
      (S.assignments[r.bill_id] ??= []).push(r.advocate_id));
    S.billCampaigns = {}; bc.data.forEach(r =>
      (S.billCampaigns[r.bill_id] ??= []).push(r.campaign_id));
    // Additive feature: if migration 004 has not run on this database yet, the
    // rest of the app must still load. Same treatment as sync_runs below.
    S.todos = {};
    if (todos.error) console.warn('bill_todos:', todos.error.message);
    else todos.data.forEach(t => (S.todos[t.bill_id] ??= []).push(t));
    // Testimony drafts are made by the backend job (migration 005); the app
    // only links to them and lets staff mark one filed. Non-fatal as above.
    S.drafts = {};
    if (drafts.error) console.warn('testimony_drafts:', drafts.error.message);
    else drafts.data.forEach(d => (S.drafts[d.bill_id] ??= []).push(d));
    // R-316 W43: where the 2-minute look starts. The newest updated_at the database gave (its clock, not this
    // laptop's, which may be minutes off); with no rows at all, a minute before now.
    lastLook = [...(todos.data || []), ...(drafts.data || [])].reduce((m, r) => r.updated_at > m ? r.updated_at : m, '') || new Date(Date.now() - 6e4).toISOString();
    // Committee names and chairs (migration 007). Optional: without the table
    // the Next block shows the code and everything else still works.
    S.committees = {};
    if (comms.error) console.warn('committees:', comms.error.message);
    else comms.data.forEach(c => { S.committees[c.code] = c; });
    S.pulse = Object.fromEntries(pulse.data.map(p => [p.bill_id, p]));
    S.feed = feed.data;
    S.me = S.advocates.find(a => a.id === myId) ||
           S.advocates.find(a => a.email === S.session?.user?.email) || null;
    // This browser is the team's now: the public page counts nothing from it (K1-5). Same site, same storage; not set in the sandbox.
    if (S.me) try { localStorage.setItem('hiphi_team', '1'); } catch { /* private window: this visit only */ }
    S.follows = new Set(Object.entries(S.followersBy).filter(([, ids]) => S.me && ids.includes(S.me.id)).map(([id]) => id));
    S.mutes = new Set((mut?.data || []).filter(r => S.me && r.advocate_id === S.me.id).map(r => r.bill_id));
    // Nothing owned or followed yet: the empty "My bills" page helps nobody.
    if (S.me && S.owner === 'me' && !S.bills.some(isMine)) S.owner = 'all';
    // The four that went out with the main load, in the same order as above.
    const [sr, ev, rc, iss] = await extras;
    await pqP;   // the partners' queue, read beside the load (above), is in before the first frame
    if (!sr || sr.error) S.loadFailed.push('the sync status');
    if (!ev || ev.error || !rc || rc.error) S.loadFailed.push('what changed lately');
    if (iss === 'failed') S.loadFailed.push('issues');
    S.syncRuns = sr?.data || [];
    S.sinceEvents = ev?.data || [];
    S.recentEvents = (rc?.data || []).map(({ bills: _b, ...e }) => e);
    // No companion-stage load here: the "companion alive" chip is the old app's, and Staff v2 never reads
    // S.compStage. It was a round trip of its own for 400 rows nothing looked at (R-034).
  },
  async timeline(billId) {
    if (DEMO) return DEMO_TL.filter(t => t.bill_id === billId);
    const { data, error } = await S.supa.from('activity_log')
      .select('*').eq('bill_id', billId).order('occurred_at', { ascending: false }).limit(200);
    if (error) throw error; return data;
  },
  async addActivity(billId, type, title, details) {
    if (DEMO) { DEMO_TL.unshift({ bill_id: billId, advocate_id: S.me.id, type,
      title, details, occurred_at: new Date().toISOString(), source: 'team' }); return; }
    const { error } = await S.supa.from('activity_log').insert({
      bill_id: billId, advocate_id: S.me.id, type, title, details: details || null });
    if (error) throw error;
  },
  async updateBill(billId, patch) {
    patch = withPriority(patch);
    // Optimistic: patch local state first so the UI feels instant, but keep
    // a snapshot of just the touched keys so a rejected write can be undone.
    // Without this a failed save leaves the screen showing a value the
    // database never accepted.
    const b = S.bills.find(x => x.id === billId);
    const before = {};
    if (b) { for (const k of Object.keys(patch)) before[k] = b[k]; Object.assign(b, patch); }
    if (DEMO) return;
    const { error } = await S.supa.from('bills').update(patch).eq('id', billId);
    if (error) { if (b) Object.assign(b, before); throw error; }
  },
  // Saving a bill's team fields without erasing a teammate (R-152 B). The Public tab used to send all its fields, changed or
  // not, from the copy loaded at sign-in, and the team note was one whole text, so Lauren's save at 11:00 could undo the
  // ask Kevin wrote at 10:00. Now: `base` is what the person's screen held when they began editing; only the keys that
  // differ from it are written; and before writing, those keys are read fresh. If a teammate changed one since `base`
  // (and to something other than the same thing), nothing is written: the answer lists { key, theirs, mine } for the screen
  // to show them, and the local copy takes the teammate's value. { force: true } skips the check (the person chose "Replace
  // with mine"). Returns { changed, conflicts, prev }: prev holds each written key's value just before, for Undo.
  async saveBillFields(billId, patch, base, { force = false } = {}) {
    const norm = v => v == null ? null : typeof v === 'string' ? (v.trim() || null) : v, same = (a, b) => JSON.stringify(norm(a)) === JSON.stringify(norm(b));
    const b = S.bills.find(x => x.id === billId);
    const changed = Object.keys(patch).filter(k => !same(patch[k], base?.[k]));
    if (!changed.length) return { changed: [], conflicts: [], prev: {} };
    const out = Object.fromEntries(changed.map(k => [k, patch[k]]));
    const nowRow = await this.billNow(billId, changed);
    const prev = Object.fromEntries(changed.map(k => [k, nowRow ? nowRow[k] ?? null : b?.[k] ?? null]));
    const conflicts = force || !nowRow ? [] : changed.filter(k => !/_edited_at$/.test(k) && !same(nowRow[k], base?.[k]) && !same(nowRow[k], patch[k])).map(k => ({ key: k, theirs: nowRow[k] ?? null, mine: patch[k] ?? null }));
    if (conflicts.length) {
      if (b) for (const c of conflicts) b[c.key] = c.theirs;
      return { changed, conflicts, prev };
    }
    await this.updateBill(billId, out);
    return { changed, conflicts: [], prev };
  },
  // One bill's current values for some columns, read now. The sandbox has no other writer, so a test can plant one in
  // S.demoTheirs[billId] to stand in for a teammate's save.
  async billNow(billId, keys) {
    if (DEMO) { const t = S.demoTheirs?.[billId]; return t ? Object.fromEntries(keys.map(k => [k, k in t ? t[k] : S.bills.find(x => x.id === billId)?.[k]])) : null; }
    const { data, error } = await S.supa.from('bills').select(keys.join(',')).eq('id', billId).maybeSingle();
    if (error) throw error; return data;
  },
  async follow(billId, on) {
    S.follows ??= new Set(); if (on) S.follows.add(billId); else S.follows.delete(billId);
    if (DEMO) return;
    const r = on ? await S.supa.from('bill_follows').insert({ advocate_id: S.me.id, bill_id: billId })
                 : await S.supa.from('bill_follows').delete().eq('advocate_id', S.me.id).eq('bill_id', billId);
    if (r.error) { if (on) S.follows.delete(billId); else S.follows.add(billId); throw r.error; }
  },
  // Mute (migration 052): off my dashboard and out of my alerts until a hearing is scheduled. The server
  // refuses while a hearing is still ahead, and says so.
  async mute(billId, on) {
    S.mutes ??= new Set(); if (on) S.mutes.add(billId); else S.mutes.delete(billId);
    if (DEMO) return;
    const { error } = await S.supa.rpc('set_bill_mute', { p_bill: billId, p_muted: on });
    if (error) { if (on) S.mutes.delete(billId); else S.mutes.add(billId); throw error; }
  },
  // who defaults to you; an admin may pass a teammate's id (064), and that teammate is told by Slack.
  async attend(hearingId, on, who = S.me.id) {
    S.attend ??= {}; const cur = S.attend[hearingId] || [];
    S.attend[hearingId] = on ? [...new Set([...cur, who])] : cur.filter(id => id !== who);
    if (DEMO) return;
    const r = on ? await S.supa.from('hearing_attendance').insert({ hearing_id: hearingId, advocate_id: who })
                 : await S.supa.from('hearing_attendance').delete().eq('hearing_id', hearingId).eq('advocate_id', who);
    if (r.error) { S.attend[hearingId] = cur; throw r.error; }
  },
  // Changing an owner adds the new one first, then takes the others off (R-152 D). It used to delete every owner, ignore the
  // answer, then add the new one: a failure in between left the bill with no owner and the screen showing the new one.
  async setOwner(billId, advocateId) {
    const was = S.assignments[billId] || [];
    S.assignments[billId] = advocateId ? [advocateId] : [];
    if (DEMO) return;
    let partial = false;
    try {
      if (advocateId) {
        const { error: ie } = await S.supa.from('bill_assignments').upsert({ bill_id: billId, advocate_id: advocateId, is_lead: true }, { onConflict: 'bill_id,advocate_id', ignoreDuplicates: true });
        if (ie) throw ie;
        const { error: de } = await S.supa.from('bill_assignments').delete().eq('bill_id', billId).neq('advocate_id', advocateId);
        if (de) { partial = true; S.assignments[billId] = [...new Set([advocateId, ...was])]; throw new Error('The new owner was added, but the old one could not be taken off. ' + de.message); }
      } else {
        const { error } = await S.supa.from('bill_assignments').delete().eq('bill_id', billId);
        if (error) throw error;
      }
    } catch (e) { if (!partial) S.assignments[billId] = was; throw e; }
  },
  async bulkUpdate(ids, patch) {
    patch = withPriority(patch);
    const before = new Map();
    ids.forEach(id => { const b = S.bills.find(x => x.id === id); if (!b) return;
      const snap = {}; for (const k of Object.keys(patch)) snap[k] = b[k];
      before.set(id, snap); Object.assign(b, patch); });
    if (DEMO) return;
    // In slices of 150: the ids go in the web address, and selecting every bill (about 670 and up) made one address too long
    // for the API and the whole edit failed (R-152 D). A slice that fails undoes its own rows and the ones after it, and says
    // how many were saved.
    let done = 0;
    for (let i = 0; i < ids.length; i += 150) {
      const part = ids.slice(i, i + 150), { error } = await S.supa.from('bills').update(patch).in('id', part);
      if (error) {
        ids.slice(i).forEach(id => { const b = S.bills.find(x => x.id === id), snap = before.get(id); if (b && snap) Object.assign(b, snap); });
        throw done ? new Error(`${done} of ${ids.length} bills were saved before a problem: ${error.message}. Try again for the rest.`) : error;
      }
      done += part.length;
    }
  },
  async addToCampaign(ids, campaignId) {
    ids.forEach(id => { const arr = (S.billCampaigns[id] ??= []);
      if (!arr.includes(campaignId)) arr.push(campaignId); });
    if (DEMO) return;
    const rows = ids.map(id => ({ bill_id: id, campaign_id: campaignId }));
    const { error } = await S.supa.from('bill_campaigns')
      .upsert(rows, { onConflict: 'bill_id,campaign_id', ignoreDuplicates: true });
    if (error) throw error;
  },
  async toggleCampaign(billId, campaignId, on) {
    const arr = (S.billCampaigns[billId] ??= []);
    if (on) { if (!arr.includes(campaignId)) arr.push(campaignId); }
    else S.billCampaigns[billId] = arr.filter(c => c !== campaignId);
    if (DEMO) return;
    const q = on
      ? S.supa.from('bill_campaigns').upsert({ bill_id: billId, campaign_id: campaignId },
          { onConflict: 'bill_id,campaign_id', ignoreDuplicates: true })
      : S.supa.from('bill_campaigns').delete().eq('bill_id', billId).eq('campaign_id', campaignId);
    const { error } = await q;
    if (error) throw error;
  },
  async addTodo(billId, title) {
    const order = (S.todos[billId] || []).length;
    if (DEMO) {
      (S.todos[billId] ??= []).push({ id: crypto.randomUUID(), bill_id: billId, title,
        done: false, due_date: null, assignee_id: S.me?.id || null, sort_order: order,
        created_at: new Date().toISOString() });
      return;
    }
    const { data, error } = await S.supa.from('bill_todos').insert({
      bill_id: billId, title, sort_order: order,
      assignee_id: S.me?.id || null, created_by: S.me?.id || null }).select().single();
    if (error) throw error;
    (S.todos[billId] ??= []).push(data);
  },
  async updateTodo(billId, id, patch) {
    const t = (S.todos[billId] || []).find(x => x.id === id);
    if (!t) return;
    const prev = { ...t };
    Object.assign(t, patch);
    if (DEMO) return;
    const { error } = await S.supa.from('bill_todos').update(patch).eq('id', id);
    if (error) { Object.assign(t, prev); throw error; }
  },
  // Testimony workflow. The database function checks who may do what
  // (admin for first approval, Jess/Jaylen for the second, anyone to file)
  // and queues the emails; the browser only asks for a transition and then
  // nudges notify-send so those emails go out now rather than at the next
  // 30-minute sweep.
  async transition(billId, id, action, note, url) {
    const arr = S.drafts[billId] || [];
    const i = arr.findIndex(x => x.id === id);
    if (i < 0) return;
    // A confirmation link is opened from the filing record, so it must be a web address, never a script or a file (R-152 D).
    if (url && !/^https:\/\/[^\s]+$/i.test(String(url).trim())) throw new Error('The confirmation link must start with https:// and have no spaces. Paste it again, or leave it empty.');
    const before = { ...arr[i] };
    // The practice copy has no server to refuse a step that no longer fits (its demoTransition re-files a filed draft), so
    // it asks the same question the database does first (R-316 W43).
    if (DEMO) { try { if (!fits(arr[i], action)) throw new Error('Nothing to do on it now.'); demoTransition(arr[i], action, note, url); } catch (e) { throw await raced(billId, before, action, e); } return; }
    const { data, error } = await S.supa.rpc('testimony_transition',
      { p_draft: id, p_action: action, p_note: note || null, p_url: url || null });
    if (error) throw await raced(billId, before, action, error);
    arr[i] = data;
    // An approval can be undone for a few seconds (migration 058). Its messages wait out that window before the
    // outbox is nudged, so an Undo holds them before anyone is told; everything else goes at once.
    const tok = S.session?.access_token;
    if (tok) setTimeout(() => fetch(`${SUPABASE_URL}/functions/v1/notify-send`, { method: 'POST',
      headers: { Authorization: `Bearer ${tok}`, apikey: SUPABASE_KEY } }).catch(() => {}), action === 'approve' ? 12000 : 0);
  },
  async deleteTodo(billId, id) {
    const arr = S.todos[billId] || [];
    const i = arr.findIndex(x => x.id === id);
    if (i < 0) return;
    const [gone] = arr.splice(i, 1);
    if (DEMO) return;
    const { error } = await S.supa.from('bill_todos').delete().eq('id', id);
    if (error) { arr.splice(i, 0, gone); throw error; }
  },
  // One bill the team does not track (or any bill), by number and session, for the read-only page (R-058). The sandbox has only the
  // bills' number, title and description for these (the snapshot's index).
  async untrackedBill(num, year) {
    if (DEMO) { const r = (S.snapshot?.index || []).find(x => x.bill_number === num); return r ? { ...r, session_year: SESSION_YEAR, tracked: false, referrals: [], sponsors: [], companions: [] } : null; }
    const { data, error } = await S.supa.from('bills').select('*').eq('bill_number', num).eq('session_year', year || SESSION_YEAR).limit(1);
    if (error) throw error; return data?.[0] || null;
  },
  // Takes a bill off the team's list again (the Undo of Track on the read-only page); its position and owner were never set.
  async untrack(billId) {
    S.bills = S.bills.filter(b => b.id !== billId); S.hearings = S.hearings.filter(h => h.bill_id !== billId);
    if (DEMO) return;
    const { error } = await S.supa.from('bills').update({ tracked: false }).eq('id', billId); if (error) throw error;
  },
  // `year`: the bill's own session, so last session's twin of the same number is not taken for it (R-316 W34).
  async companionInfo(nums, year = null) {
    if (DEMO) return S.bills.filter(b => nums.includes(b.bill_number) && (!year || !b.session_year || +b.session_year === +year));
    let q = S.supa.from('bills')
      .select('id,bill_number,stage,stage_override,tracked,session_year,state_url')
      .in('bill_number', nums);
    if (year) q = q.eq('session_year', year);
    const { data, error } = await q;
    if (error) throw error; return data;
  },
  // Every bill not tracked yet, by its number, or with every word somewhere in its title or official description (R-032,
  // 9/26: search looks through every bill, not only the tracked ones; the title alone is "RELATING TO HEALTH." and
  // missed most words). The most recently active first. Used by Search and by the header's suggestions.
  async searchUntracked(q) {
    const words = String(q).toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, ' ').split(/\s+/).filter(w => w.length > 1), num = words.join('');
    if (DEMO) return (S.snapshot?.index || []).filter(b => b.bill_number.toLowerCase().includes(num) || (words.length && words.every(w => (b.title || '').toLowerCase().includes(w))))
      .sort((x, y) => (y.bill_number.toLowerCase() === num) - (x.bill_number.toLowerCase() === num))
      .slice(0, 40).map(b => ({ ...b, description: null, stage: null, last_action: null, last_action_date: null }));
    if (!num) return [];
    const cols = 'id,bill_number,title,description,stage,last_action,last_action_date';
    const byWords = words.length ? `,and(${words.map(w => `or(title.ilike.*${w}*,description.ilike.*${w}*)`).join(',')})` : '';
    // A bill number typed whole comes first, even when fifteen more recently active bills contain it ("HB13").
    const exact = /^[a-z]{1,3}\d{1,4}$/.test(num) ? S.supa.from('bills').select(cols).eq('tracked', false).eq('bill_number', num.toUpperCase()) : null;
    const [a, b] = await Promise.all([exact || { data: [] }, S.supa.from('bills').select(cols).eq('tracked', false)
      .or(`bill_number.ilike.*${num}*${byWords}`).order('last_action_date', { ascending: false, nullsFirst: false }).limit(15)]);
    if (a.error || b.error) throw a.error || b.error;
    const seen = new Set((a.data || []).map(r => r.id));
    return [...(a.data || []), ...(b.data || []).filter(r => !seen.has(r.id))];
  },
  async saveMyPrefs({ slack_dm, prefs }) {
    Object.assign(S.me, { slack_dm, prefs });
    if (DEMO) return;
    const { error } = await S.supa.from('advocates').update({ slack_dm, prefs }).eq('id', S.me.id);
    if (error) throw error;
  },
  // One corner of advocates.prefs, merged and saved. Used for the things that used to live in localStorage and so
  // did not follow anyone from their laptop to their phone: which messages you have seen, which suggestions you
  // have put off, your saved views on Bills. Optimistic, and it puts the old value back if the write is refused.
  async patchPrefs(patch) {
    const before = S.me?.prefs || {};
    if (!S.me) return;
    S.me.prefs = { ...before, ...patch };
    if (DEMO) return;
    const { error } = await S.supa.from('advocates').update({ prefs: S.me.prefs }).eq('id', S.me.id);
    if (error) { S.me.prefs = before; throw error; }
  },
  async saveSlackSettings(cfg, coalitionChannels) {
    S.slackCfg = cfg;
    for (const [id, ch] of coalitionChannels) { const c = S.campaigns.find(x => x.id === id); if (c) c.slack_channel = ch; }
    if (DEMO) return;
    const { error } = await S.supa.from('app_settings').upsert({ key: 'slack', value: cfg, updated_at: new Date().toISOString() });
    if (error) throw error;
    for (const [id, ch] of coalitionChannels) {
      const { error: e2 } = await S.supa.from('campaigns').update({ slack_channel: ch }).eq('id', id);
      if (e2) throw e2;
    }
  },
  async setSecret(key, value) {
    if (DEMO) return 'saved';
    const { data, error } = await S.supa.rpc('set_secret', { p_key: key, p_value: value });
    if (error) throw error; return data;
  },
  async secretStatus() {
    if (DEMO) return { slack_bot_token: 57, google_calendar_refresh_token: 57 };   // the real tracker has both connected (R-152 D: the sandbox said the calendar was not)
    const { data, error } = await S.supa.rpc('secret_status');
    if (error) throw error; return data || {};
  },
  async connectCalendar() {
    if (DEMO) { hooks.toast('Sandbox: nothing to connect'); return; }
    const { data, error } = await S.supa.rpc('calendar_connect_state');
    if (error) throw error;
    location.href = `${SUPABASE_URL}/functions/v1/google-connect?state=${encodeURIComponent(data)}`;
  },
  // ---- opening weeks (migration 021) ----
  async readiness() {
    // The practice copy's checklist agrees with its Team page (R-152 D): both said who had signed in, in two different ways. Only the
    // admin has a login here (teamLogins), so the others are the ones without an account, as on the real tracker today.
    if (DEMO) { const miss = S.advocates.filter(a => a.is_active !== false && !a.is_admin).map(a => a.initials);
      return DEMO_READINESS.map(r => r.key === 'advocates_auth' ? { ...r, ok: !miss.length, detail: miss.length ? `${miss.length} without an account: ${miss.join(', ')}` : 'everyone can sign in' } : r); }
    const { data, error } = await S.supa.rpc('readiness'); if (error) throw error; return data;
  },
  // The public page's own error reports, the last 7 days (110, R-111): staff only, nothing personal in them.
  // The public page's A/B tests (116, R-135; Session setup > Tests): the switches and their words, and the sums per test
  // and version (met it, measure, second measure; forced rows apart). Only is_on, fallback, winner and arms_on (a version's own switch, backend 136) can be changed,
  // and only by an admin (the database refuses anything else).
  async abTests() {
    if (DEMO) return DEMO_AB.tests;
    const { data, error } = await S.supa.from('ab_tests').select('*').order('sort');
    if (error) throw error; return data || [];
  },
  // The same sums split by the ask a share was for (155, R-183): staff only.
  async abResultsByAsk() {
    if (DEMO) return DEMO_AB.byAsk || [];
    const { data, error } = await S.supa.rpc('ab_results_by_ask');
    if (error) throw error; return data || [];
  },
  async abResults() {
    if (DEMO) return DEMO_AB.results;
    const { data, error } = await S.supa.rpc('ab_results');
    if (error) throw error; return data || [];
  },
  // Testers' paths (R-193, backend 150): the last 60 days, newest first; staff read them, the public key cannot.
  async testerPaths(days = 60) {
    if (DEMO) return DEMO_TESTER_PATHS;
    const since = new Date(Date.now() - days * 864e5).toLocaleDateString('en-CA', { timeZone: 'Pacific/Honolulu' });
    const { data, error } = await allRows(o => S.supa.from('tester_paths').select('*', o).gte('day', since).order('started_at', { ascending: false }).order('id'));
    if (error) throw error; return data || [];
  },
  async setAbTest(key, patch) {
    const p = Object.fromEntries(Object.entries(patch).filter(([k]) => ['is_on', 'fallback', 'winner', 'arms_on'].includes(k)));
    if (DEMO) { const t = DEMO_AB.tests.find(x => x.key === key); Object.assign(t, p, { changed_at: new Date().toISOString(), changed_by: S.me?.initials || null }); if (t.is_on && !t.started) t.started = DEMO_DAY(0); return { ...t }; }
    const { data, error } = await S.supa.from('ab_tests').update(p).eq('key', key).select('*');
    if (error) throw error;
    if (!data?.length) throw new Error('Only an admin can change a test.');
    return data[0];
  },
  async publicErrors() {
    if (DEMO) return DEMO_PUBLIC_ERRORS;
    const { data, error } = await S.supa.from('public_errors_recent').select('*').order('last_at', { ascending: false }).limit(200);
    if (error) throw error; return data || [];
  },
  async saveReadinessManual(key, done, note) {
    const cur = { ...(S.readinessManual || {}) }; cur[key] = { done, note: note || '', by: S.me?.initials || null, at: new Date().toISOString() };
    S.readinessManual = cur;
    if (DEMO) return;
    const { error } = await S.supa.from('app_settings').upsert({ key: 'readiness', value: cur, updated_at: new Date().toISOString() });
    if (error) throw error;
  },
  async triageQueue(campaignId, matchedOnly) {
    if (DEMO) return demoTriageQueue(campaignId, matchedOnly).slice(0, 400);
    const { data, error } = await S.supa.rpc('triage_queue', { p_campaign: campaignId || null, p_matched_only: !!matchedOnly, p_limit: 400 });
    if (error) throw error; return data;
  },
  async triageCounts() {
    if (DEMO) { const q = demoTriageQueue(null, false); return { year: SESSION_YEAR, introduced: S.bills.length + (S.snapshot?.index || []).length, tracked: S.bills.length, undecided: q.length, suggested: q.filter(r => r.matches).length }; }
    const { data, error } = await S.supa.rpc('triage_counts'); if (error) throw error; return data;
  },
  // Bills people follow on the public tracker that the team does not track (migration 074, R-059). The sandbox has no
  // public accounts, so it shows two bills with sample counts, the way it has sample supporters.
  async triageFollowed() {
    if (DEMO) {
      const done = S.demoTriaged || new Set(), tracked = new Set(S.bills.map(b => b.id));
      return (S.snapshot?.index || []).filter(b => /^(HB|SB)\d+$/.test(b.bill_number) && /TOBACCO|VAP|SCHOOL MEAL|SUGAR/i.test(b.title || '') && !done.has(b.id) && !tracked.has(b.id))
        .slice(0, 2).map((b, i) => ({ id: b.id, bill_number: b.bill_number, chamber: b.chamber, title: b.title, description: null, introduced_at: null,
          companions: [], matches: null, lookalike: null, followers: [4, 1][i], followed_at: '2026-03-14T20:00:00Z', set_aside_at: null }));
    }
    const { data, error } = await S.supa.rpc('triage_followed'); if (error) throw error; return data || [];
  },
  async triageTrack(row, campaignId) {
    const camp = S.campaigns.find(c => c.id === campaignId);
    if (DEMO) {
      const b = { ...row, tracked: true, is_public: true, position: 'monitor', priority: 2, stage: 'introduced', referrals: [], sponsors: [], companions: row.companions || [], session_year: SESSION_YEAR, state_url: 'https://www.capitol.hawaii.gov', last_action: 'Introduced and Pass First Reading.', last_action_date: new Date().toLocaleDateString('en-CA', { timeZone: 'Pacific/Honolulu' }) };
      S.bills.push(b); S.bills.sort((a, b2) => a.bill_number.localeCompare(b2.bill_number));
      if (camp) { S.billCampaigns[b.id] = [camp.id]; if (camp.owner_id) S.assignments[b.id] = [camp.owner_id]; }
      S.demoTriaged.add(row.id); return b;
    }
    const { error } = await S.supa.rpc('triage_track', { p_bill: row.id, p_campaign: campaignId || null }); if (error) throw error;
    const { data } = await S.supa.from('bills').select('*').eq('id', row.id).single();
    if (data) { S.bills = S.bills.filter(x => x.id !== data.id).concat(data).sort((a, b2) => a.bill_number.localeCompare(b2.bill_number)); }
    if (camp) { S.billCampaigns[row.id] = [camp.id]; if (camp.owner_id && !(S.assignments[row.id] || []).length) S.assignments[row.id] = [camp.owner_id]; }
    await this.adoptHearings(row.id);
    return data;
  },
  async triageSkip(row) {
    if (DEMO) { S.demoTriaged.add(row.id); return; }
    const { error } = await S.supa.rpc('triage_skip', { p_bill: row.id }); if (error) throw error;
  },
  async triageUndo(row) {
    if (DEMO) { S.demoTriaged.delete(row.id); S.bills = S.bills.filter(b => b.id !== row.id); return; }
    const { error } = await S.supa.rpc('triage_undo', { p_bill: row.id }); if (error) throw error;
    if (row.tracked) { await S.supa.from('bills').update({ tracked: false }).eq('id', row.id); S.bills = S.bills.filter(b => b.id !== row.id); }
  },
  async saveCampaign(id, patch) {
    const c = S.campaigns.find(x => x.id === id); if (c) Object.assign(c, patch);
    if (DEMO) return;
    const { error } = await S.supa.from('campaigns').update(patch).eq('id', id); if (error) throw error;
  },
  async importTracker(rows, apply) {
    if (DEMO) throw new Error('The sandbox does not import; use the live app.');
    const { data, error } = await S.supa.rpc('import_tracker', { p_rows: rows, p_apply: !!apply }); if (error) throw error; return data;
  },
  // "Make the draft now" (R-102): the draft job makes this one hearing's Doc, whichever lane found the hearing. Any staff
  // member may ask (admin-dispatch v3 checks the hearing, and builds the job's payload itself). The sandbox makes a
  // practice draft a moment later instead.
  async draftNow(h) {
    if (DEMO) { await new Promise(r => setTimeout(r, 900)); const b = S.bills.find(x => x.id === h.bill_id);
      (S.drafts[h.bill_id] ??= []).push({ id: 'dn' + Date.now(), bill_id: h.bill_id, committee: h.committee, hearing_id: h.id, status: 'draft',
        doc_url: 'https://docs.google.com/document/d/demo-now/edit', created_at: new Date().toISOString(), version: b?.current_version || null });
      return { ok: true, sandbox: true }; }
    // Recorded first (R-180 Z1-4, backend 166): GitHub keeps one waiting run, so a request that was only a message could be cancelled and
    // lost. As a row it waits for the next run, whichever starts it; the message below only hurries it. If that cannot be sent the request
    // still stands, and the page says so.
    const { data: rec, error: re } = await S.supa.rpc('request_draft', { p_hearing: h.id }); if (re) throw re;
    if (!rec?.ok) throw new Error(rec?.why === 'not_ahead' ? 'That hearing has already happened, so there is no draft to make.' : 'That hearing is not on file any more.');
    try { return { ...(await this.dispatch('draft-now', { hearing_id: h.id })), recorded: true }; }
    catch (e) { return { ok: true, recorded: true, nudged: false, error: String(e.message || e) }; }
  },
  // R-316 W43 (C-5): the light look, about every 2 minutes while the page is in view (app.js). Only the drafts and to-dos
  // changed since the last look (both tables carry updated_at, kept by their touch triggers, 004 and 005), so most looks
  // come back empty: two small reads, never loadAll. Rows are merged into S.drafts / S.todos by id; true when anything
  // differs from what the page holds (its own writes come back equal, so they do not count). A to-do deleted elsewhere
  // is not seen here (a delete leaves no row to find); the 5-minute-away reload and Refresh still catch it.
  async pollChanges() {
    if (DEMO || !S.supa || !S.session || !lastLook) return false;
    const since = lastLook;
    const [dr, td] = await Promise.all([
      S.supa.from('testimony_drafts').select('*').gt('updated_at', since).order('updated_at').limit(PAGE),
      S.supa.from('bill_todos').select('*').gt('updated_at', since).order('updated_at').limit(PAGE)]);
    if (dr.error) throw dr.error; if (td.error) throw td.error;
    let changed = false;
    const merge = (map, row) => {
      const arr = map[row.bill_id] ??= [], i = arr.findIndex(x => x.id === row.id);
      if (row.updated_at > lastLook) lastLook = row.updated_at;
      if (i >= 0 && arr[i].updated_at === row.updated_at) return;
      if (i >= 0) arr[i] = row; else arr.push(row);
      changed = true;
    };
    (dr.data || []).forEach(r => merge(S.drafts, r));
    (td.data || []).forEach(r => merge(S.todos, r));
    if (changed) for (const arr of Object.values(S.todos)) arr.sort((x, y) => (x.sort_order ?? 0) - (y.sort_order ?? 0) || String(x.created_at).localeCompare(String(y.created_at)));
    return changed;
  },
  // One bill's drafts again (after "Make the draft now", while the job works).
  async reloadDrafts(billId) {
    if (DEMO) return S.drafts[billId] || [];
    const { data, error } = await S.supa.from('testimony_drafts').select('*').eq('bill_id', billId).order('created_at'); if (error) throw error;
    S.drafts[billId] = data || []; return S.drafts[billId];
  },
  // Start a GitHub workflow from Settings (admin-dispatch Edge Function).
  async dispatch(event, payload) {
    if (DEMO) throw new Error('The sandbox cannot start workflows.');
    const { data } = await S.supa.auth.getSession();
    const r = await fetch(`${SUPABASE_URL}/functions/v1/admin-dispatch`, { method: 'POST', headers: { authorization: `Bearer ${data.session?.access_token}`, apikey: SUPABASE_KEY, 'content-type': 'application/json' }, body: JSON.stringify({ event, payload }) });
    const j = await r.json().catch(() => ({ ok: false, error: `HTTP ${r.status}` }));
    if (!j.ok) throw new Error(j.error || 'could not start'); return j;
  },
  // ---- the team: Session setup > Team (backend migration 093 and the team-admin function; R-092). Admins only. ----
  // Who can sign in, and when they last did. The sandbox has no logins, so there only the admin has one.
  async teamLogins() {
    if (DEMO) return S.advocates.map(a => ({ advocate_id: a.id, has_login: !!a.is_admin, last_sign_in_at: a.is_admin ? DEMO_ASOF : null, link_made_at: null }));
    const { data, error } = await S.supa.rpc('team_logins'); if (error) throw error; return data || [];
  },
  // Add a person (id null) or change one. The server checks everything; the sandbox checks the two things people
  // trip on, so practising there answers the same way.
  async teamSave(id, p) {
    const row = { full_name: p.full_name.trim(), initials: p.initials.trim().toUpperCase(), email: p.email.trim().toLowerCase(), is_admin: !!p.is_admin, is_reviewer: !!p.is_reviewer, is_active: p.is_active !== false };
    if (p.can_approve !== undefined) row.can_approve = !!p.can_approve;   // 098: the Approver switch (team_set_approver)
    if (DEMO) {
      const other = S.advocates.filter(a => a.id !== id);
      if (other.some(a => (a.email || '').toLowerCase() === row.email)) throw new Error(`Someone on the team already has the email ${row.email}.`);
      if (other.some(a => (a.initials || '').toUpperCase() === row.initials)) throw new Error(`Someone on the team already uses the initials ${row.initials}.`);
      if (id) Object.assign(advocate(id), row); else { id = crypto.randomUUID(); S.advocates.push({ id, color: '#9A4E9E', ...row }); }
      S.advocates.sort((a, b) => a.full_name.localeCompare(b.full_name)); return id;
    }
    const { data, error } = await S.supa.rpc('team_save', { p_id: id || null, p_full_name: row.full_name, p_initials: row.initials, p_email: row.email, p_is_admin: row.is_admin, p_is_reviewer: row.is_reviewer, p_is_active: row.is_active });
    if (error) throw error;
    if (row.can_approve !== undefined) { const r2 = await S.supa.rpc('team_set_approver', { p_id: data, p_on: row.can_approve }); if (r2.error) throw r2.error; }
    const adv = await S.supa.from('advocates').select('*').order('full_name');
    if (!adv.error) { S.advocates = adv.data; S.me = adv.data.find(a => a.id === S.me?.id) || S.me; }
    return data;
  },
  // Make the person's login if they have none, and a one-time set-up link for the admin to send them. Nothing is emailed.
  async teamLink(id) {
    if (DEMO) throw new Error('The sandbox does not make sign-in links. Use the live app.');
    const { data } = await S.supa.auth.getSession();
    const r = await fetch(`${SUPABASE_URL}/functions/v1/team-admin`, { method: 'POST', headers: { authorization: `Bearer ${data.session?.access_token}`, apikey: SUPABASE_KEY, 'content-type': 'application/json' }, body: JSON.stringify({ advocate_id: id, redirect_to: APP_URL }) });
    const j = await r.json().catch(() => ({ ok: false, error: `The link could not be made (${r.status}). Try again.` }));
    if (!j.ok) throw new Error(j.error || 'The link could not be made. Try again.'); return j;
  },
  // ---- who the tracker can reach (backend 154, M1-1 and M1-3; R-199). Admins only. ----
  // Per person: 'slack' or 'email' (reachable), 'unknown' (never looked up in Slack), 'off' or 'none', why not, and how
  // many messages did not reach them in 30 days. The practice copy copies today's real picture: the admin, Kevin and
  // Lauren are matched in Slack, nobody else has been looked up.
  async teamReach() {
    if (DEMO) return S.advocates.map(a => { const r = a.is_active === false ? 'off' : ['NT', 'KV', 'LR'].includes(a.initials) || a.is_admin ? 'slack' : 'unknown';
      return { advocate_id: a.id, reach: r, why: r === 'unknown' ? 'not matched in Slack yet' : r === 'off' ? 'turned off' : null, not_reached: 0, passed_on: 0 }; });
    const { data, error } = await S.supa.rpc('team_reach'); if (error) throw error; return data || [];
  },
  // Ask Slack about each person by their email, through team-admin. Nobody is messaged.
  async slackReach() {
    if (DEMO) throw new Error('The practice copy does not ask Slack. In the live app this looks each person up by email; nobody is messaged.');
    const { data } = await S.supa.auth.getSession();
    const r = await fetch(`${SUPABASE_URL}/functions/v1/team-admin`, { method: 'POST', headers: { authorization: `Bearer ${data.session?.access_token}`, apikey: SUPABASE_KEY, 'content-type': 'application/json' }, body: JSON.stringify({ action: 'slack_reach' }) });
    const j = await r.json().catch(() => ({ ok: false, error: `Slack could not be asked (${r.status}). Try again.` }));
    if (!j.ok) throw new Error(j.error || 'Slack could not be asked. Try again.');
    if (!Array.isArray(j.people)) throw new Error('This check needs the newer team-admin function, which is not live yet. Ask Claude.');
    return j.people;
  },
  // Email to the team, apart from the public pause (backend 154): off unless an admin turns it on.
  async teamEmail() {
    if (DEMO) return !!S.demoTeamEmail;
    const { data, error } = await S.supa.from('app_settings').select('value').eq('key', 'team_email').maybeSingle(); if (error) throw error;
    return !!data?.value?.enabled;
  },
  async setTeamEmail(on) {
    if (DEMO) { S.demoTeamEmail = on; return; }
    const { error } = await S.supa.from('app_settings').upsert({ key: 'team_email', value: { enabled: !!on, changed_by: S.me?.full_name || null, changed_at: new Date().toISOString() }, updated_at: new Date().toISOString() });
    if (error) throw error;
  },
  // "Forgot your password?" (M1-6): until Supabase's sign-in email goes through HIPHI's own email service (R-101, R-002),
  // Supabase cannot email staff a reset, so the admins are told in Slack instead. The same answer for any address.
  async askPasswordHelp(email) {
    if (DEMO) return;
    const { error } = await S.supa.rpc('ask_password_help', { p_email: email }); if (error) throw error;
  },
  // A sign-in link from Team opens a Continue page first (M1-3): the link carries only the token's hash, and nothing is
  // used until the person presses Continue, so a link preview (Slack's, an email scanner's) cannot spend it.
  async verifyLink(tokenHash) {
    const { error } = await S.supa.auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' }); if (error) throw error;
  },
  // ---- inbox (migration 032): everything addressed to me, read or unread ----
  async loadInbox() {
    if (DEMO) return S.inbox;
    const { data, error } = await S.supa.rpc('my_inbox', { p_limit: 300 }); if (error) throw error; S.inbox = data || []; return S.inbox;
  },
  async inboxMark(keys) {
    const set = new Set(keys); (S.inbox || []).forEach(i => { if (set.has(i.key)) i.unread = false; });
    if (DEMO || !keys.length) return;
    const { error } = await S.supa.rpc('inbox_mark', { p_keys: keys }); if (error) throw error;
  },
  async inboxUnmark(keys) {
    const set = new Set(keys); (S.inbox || []).forEach(i => { if (set.has(i.key)) i.unread = true; });
    if (DEMO || !keys.length) return;
    const { error } = await S.supa.rpc('inbox_unmark', { p_keys: keys }); if (error) throw error;
  },
  // ---- bill chat (migration 025) ----
  async sendMessage(billId, body) {
    const m = { id: 'm' + Date.now(), bill_id: billId, advocate_id: S.me?.id, body, created_at: new Date().toISOString() };
    if (!DEMO) { const { data, error } = await S.supa.from('bill_messages').insert({ bill_id: billId, advocate_id: S.me.id, body }).select().single(); if (error) throw error; Object.assign(m, data); }
    (S.messages[billId] ??= []).push(m); S.chatSeen[billId] = new Date().toISOString(); return m;
  },
  async deleteMessage(m) {
    if (!DEMO) { const { error } = await S.supa.from('bill_messages').update({ deleted_at: new Date().toISOString() }).eq('id', m.id); if (error) throw error; }
    S.messages[m.bill_id] = (S.messages[m.bill_id] || []).filter(x => x.id !== m.id);
  },
  async markChatSeen(billId) {
    S.chatSeen[billId] = new Date().toISOString();
    const keys = (S.inbox || []).filter(i => i.unread && i.kind === 'message' && i.bill_id === billId).map(i => i.key);
    if (keys.length) DB.inboxMark(keys).catch(() => {});
    if (DEMO) return;
    await S.supa.from('bill_message_reads').upsert({ advocate_id: S.me.id, bill_id: billId, seen_at: S.chatSeen[billId] });
  },

  // ---- earlier testimony (R-027): Staff v2 loads 60 days of hearings, but a draft can point to an older hearing, and
  // its bill may no longer be tracked. The Testimony tab asks for both once, the first time it opens, in batches of 100
  // ids so the request stays short. Returns true when anything new arrived, so the tab knows to redraw.
  // Every hearing of one bill, any year, with what the committee did (R-033, 9/26). The app loads 60 days of hearings
  // (14 of outcomes) for Today and the Week; a bill page asks for the rest of its own history once. The sandbox
  // already holds the whole frozen session.
  async billHearings(billId) {
    if (DEMO) return { hearings: S.hearings.filter(h => h.bill_id === billId), outcomes: [] };
    const [h, o] = await Promise.all([S.supa.from('hearings').select('*').eq('bill_id', billId).order('scheduled_at').order('id'),
      S.supa.from('hearing_outcomes').select('*').eq('bill_id', billId)]);
    if (h.error) throw h.error; if (o.error) throw o.error;
    return { hearings: (h.data || []).filter(x => !/^\[TEST\]/.test(x.description || '')), outcomes: o.data || [] };
  },
  async loadDraftHearings() {
    if (DEMO) return false;
    S.draftHearings ??= {}; S.draftBills ??= {};
    const drafts = Object.values(S.drafts).flat();
    const hIds = [...new Set(drafts.map(d => d.hearing_id).filter(id => id && !S.hearings.some(h => h.id === id) && !S.draftHearings[id]))];
    const bIds = [...new Set(drafts.map(d => d.bill_id).filter(id => id && !S.bills.some(b => b.id === id) && !S.draftBills[id]))];
    const chunks = ids => Array.from({ length: Math.ceil(ids.length / 100) }, (_, i) => ids.slice(i * 100, i * 100 + 100));
    const res = await Promise.all([
      ...chunks(hIds).map(ids => S.supa.from('hearings').select('id,bill_id,committee,scheduled_at,status').in('id', ids).then(r => ['h', r])),
      ...chunks(bIds).map(ids => S.supa.from('bills').select('id,bill_number,session_year,nickname,public_summary,title,companions').in('id', ids).then(r => ['b', r])),
    ]);
    let got = 0;
    for (const [k, r] of res) { if (r.error) throw r.error; for (const x of r.data || []) { (k === 'h' ? S.draftHearings : S.draftBills)[x.id] = x; got++; } }
    return got > 0;
  },

  // ---- issues (063, R-018): Staff v2 only; the current app is retiring and has no Issues page ----
  // Non-fatal like the other additive loads: without them the rest of the app still works.
  async loadIssues() {
    if (DEMO) return;
    try {
      const [cats, iss, ic, bi, hl, prep, ln, lc] = await Promise.all([
        S.supa.from('categories').select('*').order('sort_order'),
        S.supa.from('issues').select('*').order('sort_order').order('name'),
        S.supa.from('issue_categories').select('issue_id,category'),
        allRows(o => S.supa.from('bill_issues').select('bill_id,issue_id,added_at', o).order('bill_id').order('issue_id')),
        S.supa.from('issue_helpers').select('issue_id,advocate_id,added_at'),
        S.supa.from('app_settings').select('value').eq('key', 'issue_prep').maybeSingle(),
        S.supa.from('issue_links').select('issue_a,issue_b,score').eq('related', true),
        S.supa.from('issue_link_choices').select('issue_a,issue_b,related,set_by,set_at'),
      ]);
      for (const r of [cats, iss, ic, bi]) if (r.error) throw r.error;
      S.categories = cats.data || []; S.issues = iss.data || []; S.issueCats = ic.data || []; S.billIssues = bi.data || [];
      S.issueHelpers = hl.error ? [] : hl.data || []; if (prep.data?.value) S.issuePrep = prep.data.value;
      S.issueLinks = ln.error ? [] : ln.data || []; S.issueLinkChoices = lc.error ? [] : lc.data || [];   // related issues (095, R-094)
    } catch (e) { console.warn('issues:', e.message || e); return 'failed'; }   // loadAll names it in S.loadFailed (R-152 B)
  },
  // A new issue is a draft the public never sees until an admin publishes it (091); its owner is its maker unless chosen.
  async createIssue({ name, description, category, also = [], recommended = false, goal = null, talking_points = null, owner_id = null, stance = null }) {
    const base = name.toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'issue';
    let slug = base, n = 2; while (S.issues.some(i => i.slug === slug)) slug = `${base}-${n++}`;
    const row = { slug, name: name.trim(), description: (description || '').trim() || null, category, recommended: !!recommended, sort_order: 100,
      goal: (goal || '').trim() || null, talking_points: talking_points?.length ? talking_points : null, ...(talking_points?.length ? { talking_points_edited_at: new Date().toISOString() } : {}),
      owner_id: owner_id || S.me?.id || null, stance: stance || null };
    let issue;
    if (DEMO) issue = { id: 'demo-' + Date.now(), created_at: new Date().toISOString(), updated_at: new Date().toISOString(), edited_at: new Date().toISOString(), archived_at: null, published_at: null, prep_state: 'todo', created_by: S.me?.id, ...row };
    else { const { data, error } = await S.supa.from('issues').insert(row).select('*').single(); if (error) throw error; issue = data; }
    S.issues.push(issue);
    if (also.length) await this.setIssueAlso(issue.id, also);
    return issue;
  },
  async updateIssue(id, patch) {
    const i = S.issues.find(x => x.id === id); if (!i) return;
    const before = { ...i };
    Object.assign(i, patch, { updated_at: new Date().toISOString() });
    if (DEMO) return;
    const { error } = await S.supa.from('issues').update(patch).eq('id', id);
    if (error) { Object.assign(i, before); throw error; }
  },
  // The categories an issue also sits in, besides its own (the DUI limit: alcohol policy, and getting around safely).
  async setIssueAlso(id, cats) {
    const i = S.issues.find(x => x.id === id); if (!i) return;
    const want = new Set(cats.filter(c => c !== i.category)), had = new Set(S.issueCats.filter(x => x.issue_id === id).map(x => x.category));
    const add = [...want].filter(c => !had.has(c)), drop = [...had].filter(c => !want.has(c));
    if (!DEMO) {
      if (drop.length) { const { error } = await S.supa.from('issue_categories').delete().eq('issue_id', id).in('category', drop); if (error) throw error; }
      if (add.length) { const { error } = await S.supa.from('issue_categories').insert(add.map(category => ({ issue_id: id, category }))); if (error) throw error; }
    }
    S.issueCats = [...S.issueCats.filter(x => !(x.issue_id === id && drop.includes(x.category))), ...add.map(category => ({ issue_id: id, category }))];
  },
  // Staff link or unlink two issues (095, R-094). A choice always wins over the related-issues tool's; it is changed,
  // never deleted, so it holds when the tool runs again. A pair is stored smaller id first.
  async setIssueLink(x, y, on) {
    const [issue_a, issue_b] = String(x) < String(y) ? [x, y] : [y, x];
    const was = S.issueLinkChoices.find(c => c.issue_a === issue_a && c.issue_b === issue_b), before = was ? { ...was } : null;
    const row = { issue_a, issue_b, related: !!on, set_by: S.me?.id || null, set_at: new Date().toISOString() };
    if (was) Object.assign(was, row); else S.issueLinkChoices.push(row);
    if (DEMO) return;
    const { error } = await S.supa.from('issue_link_choices').upsert(row, { onConflict: 'issue_a,issue_b' });
    if (error) { if (before) Object.assign(was, before); else S.issueLinkChoices = S.issueLinkChoices.filter(c => c !== row); throw error; }
  },
  // ---- where partners stand on an issue (issue_partner_positions, migration 189, R-336 walk 4) ----
  // One row per partner, per session year, per bill (bill_id null: the issue as a whole). set_by and set_at are filled by
  // the database from the signed-in advocate, so they are never sent. The practice copy keeps the rows in memory only.
  async partnerPositions(issueId) {
    if (DEMO) return demoPositions().filter(r => r.issue_id === issueId).map(r => ({ ...r }));
    const { data, error } = await S.supa.from('issue_partner_positions').select('*').eq('issue_id', issueId);
    if (error) throw error; return data || [];
  },
  // p: { id?, issue_id, partner_name, stance, source, bill_id, note, session_year }. Without an id it is added; with one it
  // is changed; insert: true with an id puts a removed row back (the Undo of a removal).
  async savePartnerPosition(p, { insert = !p.id } = {}) {
    const row = { issue_id: p.issue_id, partner_name: String(p.partner_name || '').trim().replace(/\s+/g, ' '), stance: p.stance || 'unknown',
      source: p.source || 'staff', session_year: +(p.session_year || SESSION_YEAR), bill_id: p.bill_id || null, note: String(p.note || '').trim().slice(0, 2000) || null };
    const twice = () => `${row.partner_name} already has a position for ${row.session_year} ${row.bill_id ? 'on that bill' : 'on the issue as a whole'}. Change that one instead.`;
    if (DEMO) {
      const all = demoPositions(), key = r => [r.issue_id, r.partner_name.toLowerCase(), r.session_year, r.bill_id || ''].join('|');
      if (all.some(r => r.id !== p.id && key(r) === key(row))) throw Object.assign(new Error(twice()), { code: '23505' });
      const was = !insert && all.find(r => r.id === p.id), stamp = { set_by: S.me?.id || null, set_at: new Date().toISOString() };
      if (was) { Object.assign(was, row, stamp); return { ...was }; }
      const out = { id: p.id || crypto.randomUUID(), ...row, ...(p.set_at ? { set_by: p.set_by || null, set_at: p.set_at } : stamp) };
      all.push(out); return { ...out };
    }
    const t = S.supa.from('issue_partner_positions');
    const { data, error } = await (insert ? t.insert(p.id ? { id: p.id, ...row } : row) : t.update(row).eq('id', p.id)).select().single();
    if (error) { if (error.code === '23505') error.message = twice(); throw error; }
    return data;
  },
  async removePartnerPosition(id) {
    if (DEMO) { const all = demoPositions(), k = all.findIndex(r => r.id === id); if (k >= 0) all.splice(k, 1); return; }
    const { error } = await S.supa.from('issue_partner_positions').delete().eq('id', id); if (error) throw error;
  },
  // via (R-088 part 2, migration 119): 'suggested' or 'changed' from Sort new bills' suggestion, else 'staff'.
  async setBillIssue(billId, issueId, on, { via = 'staff' } = {}) {
    const had = S.billIssues.some(x => x.bill_id === billId && x.issue_id === issueId);
    if (on === had) return;
    if (on) S.billIssues.push({ bill_id: billId, issue_id: issueId, added_at: new Date().toISOString() });
    else S.billIssues = S.billIssues.filter(x => !(x.bill_id === billId && x.issue_id === issueId));
    // What the database does when a bill goes on an issue (091): the issue's owner leads a bill nobody leads, and a bill
    // with no talking points gets a copy of the issue's. Mirrored here so the screen shows it without a reload.
    const iss = on && S.issues.find(x => x.id === issueId), bill = on && S.bills.find(x => x.id === billId);
    if (iss && bill) {
      if (iss.owner_id && !(S.assignments[billId] || []).length) S.assignments[billId] = [iss.owner_id];
      if (iss.talking_points?.length && !bill.talking_points?.length) Object.assign(bill, { talking_points: [...iss.talking_points], talking_points_edited_at: new Date().toISOString() });
    }
    if (DEMO) return;
    const { error } = on ? await S.supa.from('bill_issues').insert({ bill_id: billId, issue_id: issueId, added_via: ['suggested', 'changed'].includes(via) ? via : 'staff' })
      : await S.supa.from('bill_issues').delete().eq('bill_id', billId).eq('issue_id', issueId);
    if (error) {
      if (on) S.billIssues = S.billIssues.filter(x => !(x.bill_id === billId && x.issue_id === issueId));
      else S.billIssues.push({ bill_id: billId, issue_id: issueId, added_at: new Date().toISOString() });
      throw error;
    }
  },
  // Two issues that are really one: the first one's bills, extra categories and followers move to the second, and
  // the first is archived (merge_issues, 063). Nobody following either one loses a bill.
  async mergeIssues(fromId, intoId) {
    if (DEMO) {
      const from = S.issues.find(i => i.id === fromId), into = S.issues.find(i => i.id === intoId); if (!from || !into) return;
      for (const x of S.billIssues.filter(r => r.issue_id === fromId)) if (!S.billIssues.some(r => r.issue_id === intoId && r.bill_id === x.bill_id)) S.billIssues.push({ ...x, issue_id: intoId });
      S.billIssues = S.billIssues.filter(r => r.issue_id !== fromId);
      const cats = new Set([...S.issueCats.filter(r => r.issue_id === fromId).map(r => r.category), from.category]);
      for (const c of cats) if (c !== into.category && !S.issueCats.some(r => r.issue_id === intoId && r.category === c)) S.issueCats.push({ issue_id: intoId, category: c });
      for (const p of S.people || []) if ((p.issue_ids || []).includes(fromId)) p.issue_ids = [...new Set(p.issue_ids.map(x => x === fromId ? intoId : x))];
      from.archived_at = new Date().toISOString();
      return;
    }
    const { error } = await S.supa.rpc('merge_issues', { p_from: fromId, p_into: intoId }); if (error) throw error;
    await this.loadIssues();
    if (S.peopleLoaded) { S.peopleLoaded = false; await this.loadPeople().catch(() => {}); }
  },

  // ---- the issues' prep for 2027 (091, R-088) ----
  // The owner (or an admin) adds helpers; a helper can step off. The database checks who may.
  async addIssueHelper(issueId, advocateId) {
    if (S.issueHelpers.some(h => h.issue_id === issueId && h.advocate_id === advocateId)) return;
    const row = { issue_id: issueId, advocate_id: advocateId, added_at: new Date().toISOString() };
    S.issueHelpers.push(row);
    if (DEMO) return;
    const { error } = await S.supa.from('issue_helpers').insert({ issue_id: issueId, advocate_id: advocateId });
    if (error) { S.issueHelpers = S.issueHelpers.filter(h => h !== row); throw error; }
  },
  async removeIssueHelper(issueId, advocateId) {
    const had = S.issueHelpers.find(h => h.issue_id === issueId && h.advocate_id === advocateId); if (!had) return;
    S.issueHelpers = S.issueHelpers.filter(h => h !== had);
    if (DEMO) return;
    const { error } = await S.supa.from('issue_helpers').delete().eq('issue_id', issueId).eq('advocate_id', advocateId);
    if (error) { S.issueHelpers.push(had); throw error; }
  },
  // Approve (applies the owner's keep / merge / retire), send back with a note, or undo an approval. Admins only.
  async reviewIssue(id, action, note = null) {
    const i = S.issues.find(x => x.id === id); if (!i) return;
    if (DEMO) {
      if (action === 'send_back' && !String(note || '').trim()) throw new Error('Say what needs changing, so the owner knows.');
      if (action === 'approve') {
        if (i.proposal === 'merge' && i.proposal_into) await this.mergeIssues(i.id, i.proposal_into);
        else if (i.proposal === 'retire') i.archived_at = new Date().toISOString();
      }
      if (action === 'undo' && i.archived_at && ['merge', 'retire'].includes(i.proposal)) throw new Error('This approval merged or retired the issue. Restore it from Issues, under Archived.');
      Object.assign(i, { prep_state: action === 'approve' ? 'approved' : action === 'send_back' ? 'sent_back' : 'ready', prep_note: action === 'undo' ? null : (String(note || '').trim() || null), prep_by: S.me?.id, prep_at: new Date().toISOString() });
      return;
    }
    const { data, error } = await S.supa.rpc('review_issue', { p_id: id, p_action: action, p_note: note });
    if (error) throw error;
    if (action === 'approve' && ['merge', 'retire'].includes(i.proposal)) await this.loadIssues();
    else if (data) Object.assign(i, data);
  },
  // One Slack message to each owner about the issues they were not told about yet. Returns how many people were messaged.
  async tellIssueOwners() {
    const now = new Date().toISOString(), untold = S.issues.filter(i => i.owner_id && !i.owner_told_at && !i.archived_at);
    const people = new Set(untold.map(i => i.owner_id)); people.delete(S.me?.id);
    if (DEMO) { untold.forEach(i => { i.owner_told_at = now; }); return people.size; }
    const { data, error } = await S.supa.rpc('tell_issue_owners'); if (error) throw error;
    // Since backend 154 (M1-1) an owner is marked told when their message is actually sent, not now, and someone the
    // tracker cannot reach is not messaged; the board catches up on the next load.
    return data;
  },

  // ---- the first visit (067-068, R-023): Staff v2 only, like Issues ----
  // The public first visit's weekly roll-up, staff only; the rows themselves nobody can read. The sandbox has no visits:
  // firstvisit.js draws numbers labelled as samples instead of calling this.
  async firstVisitFunnel(weeks = 12) {
    if (DEMO) return [];
    const { data, error } = await S.supa.rpc('first_visit_funnel', { weeks: Math.round(+weeks || 12) });
    if (error) throw error;
    return data || [];
  },
  // Per version of the first visit (113, R-121): visits, finished, gave an email, came back, actions. Forced (by a
  // tester's or a staff link) are their own rows and never in the comparison.
  // What each draft of a bill changed (120, R-060): Claude drafts from the committee reports, staff edit here. A save
  // from the app is stamped as the team's (the database's trigger), so the drafting tool never overwrites it.
  async billDrafts(billId) {
    if (DEMO) { S.demoDrafts ??= fetch('demo/drafts.json?v=20261005a', { cache: 'force-cache' }).then(r => r.json()).catch(() => []);
      return (await S.demoDrafts).filter(d => d.bill_id === billId).map(d => ({ written_by: 'claude', changes_letters: false, changes_suggested: false, ...d })); }
    const { data, error } = await S.supa.from('bill_drafts').select('*').eq('bill_id', billId);
    if (error) throw error; return data || [];
  },
  // Every bill's notes at once (R-148): Today's "say what the new draft changed" and the testimony cards' "what changed
  // since". A few hundred rows a session.
  async allBillDrafts() {
    if (DEMO) { S.demoDrafts ??= fetch('demo/drafts.json?v=20261005a', { cache: 'force-cache' }).then(r => r.json()).catch(() => []);
      return (await S.demoDrafts).map(d => ({ written_by: 'claude', changes_letters: false, changes_suggested: false, ...d })); }
    const { data, error } = await S.supa.from('bill_drafts').select('bill_id,version,summary,written_by,changes_letters,changes_suggested,letter_note,source_url');
    if (error) throw error; return data || [];
  },
  // extra (R-148, migration 124): { changes_letters, letter_note }, staff's tick on the draft and what to tell people who
  // wrote before. Left out, the database keeps what it has (a "Looks right" never touches the tick).
  async saveBillDraft(billId, version, summary, extra = {}) {
    const row = { bill_id: billId, version, summary: String(summary || '').trim().replace(/\s+/g, ' ') };
    if ('changes_letters' in extra) row.changes_letters = !!extra.changes_letters;
    if ('letter_note' in extra) row.letter_note = String(extra.letter_note || '').trim().replace(/\s+/g, ' ').slice(0, 300) || null;
    if (DEMO) { const list = await S.demoDrafts || []; const i = list.findIndex(d => d.bill_id === billId && d.version === version);
      const r = { ...(i >= 0 ? list[i] : {}), ...row, written_by: 'staff', edited_at: new Date().toISOString() }; if (i >= 0) list[i] = r; else list.push(r); return r; }   // keeps the report link, as the database does
    const { data, error } = await S.supa.from('bill_drafts').upsert(row, { onConflict: 'bill_id,version' }).select('*').single();
    if (error) throw error; return data;
  },
  // The suggested bills, counted (118, R-094 step 5): per week, where and in which place of the short list.
  async suggestSummary(weeks = 12) {
    if (DEMO) return [];
    const { data, error } = await S.supa.rpc('suggest_summary', { weeks: Math.round(+weeks || 12) });
    if (error) throw error; return data || [];
  },
  // A later visit's one full-page ask, counted (170, R-237): per week and ask, shown, done and Not now. Staff only.
  async laterAsksWeekly(weeks = 12) {
    if (DEMO) return [];
    const { data, error } = await S.supa.rpc('later_asks_weekly', { weeks: Math.round(+weeks || 12) });
    if (error) throw error; return data || [];
  },
  // The same visits by source and the campaign word of their link (069), so two flyers for one partner can be told apart.
  // Text sign-ups, confirmations and stops by day and source: counts only, never a number (backend 156, D1-7). Staff only.
  async textSignupCounts(days = 30) {
    if (DEMO) return null;
    const { data, error } = await S.supa.rpc('text_signup_counts', { p_days: days });
    if (error) throw error; return data;
  },
  async firstVisitSources(weeks = 12) {
    if (DEMO) return [];
    const { data, error } = await S.supa.rpc('first_visit_sources', { weeks: Math.round(+weeks || 12) });
    if (error) throw error;
    return data || [];
  },
  // The Meet HIPHI card (079, R-067): one card on the public page about the next HIPHI event or training. Staff read
  // and write site_cards; the public reads public_site_cards (only cards that have not ended). Taking it down sets its
  // end date to yesterday rather than deleting it, so it can be put back.
  async loadSiteCard() {
    if (DEMO) return S.siteCard ??= null;
    const { data, error } = await S.supa.from('site_cards').select('*').eq('kind', 'meet').maybeSingle();
    if (error) throw error;
    return S.siteCard = data || null;
  },
  async saveSiteCard(card) {
    const row = { kind: 'meet', title: card.title, body: card.body || null, link_url: card.link_url || null, link_label: card.link_label || null, ends_on: card.ends_on || null, updated_at: new Date().toISOString() };
    if (DEMO) return S.siteCard = row;
    const { data, error } = await S.supa.from('site_cards').upsert(row, { onConflict: 'kind' }).select('*').single();
    if (error) throw error;
    return S.siteCard = data;
  },
  // Coming back and acting (078, R-067): per week, browsers that opened the public page (one per browser per day), new
  // and returning ones by how long since their last visit, and actions marked done by kind. Staff only.
  // The day the private counts start (097, R-109): app_settings 'counts'.from, a Hawaiʻi date. The three summaries above
  // count nothing before it; our own test runs filled 9/27 to 9/30. Admins change it (settings are admin-write).
  async countsFrom() {
    if (DEMO) return S.demoCountsFrom || '2026-10-01';
    const { data, error } = await S.supa.from('app_settings').select('value').eq('key', 'counts').maybeSingle();
    if (error) throw error;
    return data?.value?.from || null;
  },
  async setCountsFrom(day) {
    if (DEMO) { S.demoCountsFrom = day; return; }
    const { error } = await S.supa.from('app_settings').upsert({ key: 'counts', value: { from: day }, updated_at: new Date().toISOString() });
    if (error) throw error;
  },
  async visitCountsWeekly(weeks = 12) {
    if (DEMO) return [];
    const { data, error } = await S.supa.rpc('visit_counts_weekly', { weeks: Math.round(+weeks || 12) });
    if (error) throw error;
    return data || [];
  },
  // Partners behind a first-visit link (track.html?via=slug): staff read and write them; the public reads only the slug
  // and the welcome line (public_partners). The sandbox has one sample partner, kept in memory like everything there.
  async loadPartners() {
    if (DEMO) { S.partners ??= [{ slug: 'keiki-health-fair', name: 'Keiki health fair (sample)', welcome: 'Welcome, friends from the keiki health fair!', created_at: DEMO_ASOF }]; S.partnersLoaded = true; return S.partners; }
    const { data, error } = await S.supa.from('partners').select('slug,name,welcome,created_at').order('name').order('slug');
    if (error) throw error;
    S.partners = data || []; S.partnersLoaded = true; return S.partners;
  },
  async addPartner({ slug, name, welcome = null }) {
    const row = { slug, name, welcome: welcome || null };
    if (!DEMO) { const { error } = await S.supa.from('partners').insert(row); if (error) throw error; }
    S.partners = [...(S.partners || []), { ...row, created_at: new Date().toISOString() }];
    return row;
  },
  // Name and welcome line only: the slug is in links already given out, so it never changes.
  async updatePartner(slug, patch) {
    const p = (S.partners || []).find(x => x.slug === slug); if (!p) return;
    const before = { name: p.name, welcome: p.welcome };
    Object.assign(p, patch);
    if (DEMO) return;
    const { error } = await S.supa.from('partners').update({ name: p.name, welcome: p.welcome }).eq('slug', slug);
    if (error) { Object.assign(p, before); throw error; }
  },

  // ---- partner groups that write on the public tracker (backend 184, R-328 batch B) ----
  // Staff v5's Partners screen (partnergroups.js) and Today's "Partner words to approve" (partnerq.js). Any staff member
  // may read the tables; every write is one of 184's functions, which refuse in plain words (shown as they are, B-8). A
  // "link" partner is still the Make a link kind above. The sandbox keeps a sample group, Keiki Smiles Alliance, with its
  // words, a group waiting for approval and a request to join, in memory (demoPartners), kept across a person switch.
  // partner_queue(): the words and issues sent, groups waiting, new requests; plus the names of a group's own issues
  // that its words are placed under (HIPHI's own are in S.issues).
  async partnerQueue() {
    if (DEMO) { const d = demoPartners(); return { bills: d.queue.filter(x => x.kind === 'bill').map(x => ({ ...x })), issues: d.queue.filter(x => x.kind === 'issue').map(x => ({ ...x })),
      groups: d.groups.filter(g => g.status === 'waiting').map(g => ({ ...g })), requests: d.requests.filter(r => r.state === 'new').map(r => ({ ...r })), issueNames: { ...d.issueNames } }; }
    const { data, error } = await S.supa.rpc('partner_queue'); if (error) throw error;
    const q = data || {}; q.issueNames = {};
    const ids = [...new Set((q.bills || []).flatMap(b => [...(b.words?.issue_ids || []), ...(b.live?.issue_ids || [])]))].filter(id => !(S.issues || []).some(i => i.id === id));
    if (ids.length) { const r = await S.supa.from('partner_issue_words').select('partner_issue_id,name,state').in('partner_issue_id', ids).in('state', ['live', 'sent', 'changes', 'draft']);
      for (const w of r.data || []) if (!q.issueNames[w.partner_issue_id] || w.state === 'live') q.issueNames[w.partner_issue_id] = w.name; }
    return q;
  },
  // Approve (approve: true) or Ask for a change (a note the group sees). it: a queue item ({ kind, id }). ask: the approval
  // card's { also_text, text_line } (185, R-328 G), each sent only when given; approved bill words come back with
  // partner_ask, the ask they carry as it now goes out (null when they carry none).
  async partnerReview(it, approve, note = null, ask = {}) {
    const extra = { ...('also_text' in ask ? { also_text: !!ask.also_text } : {}), ...('text_line' in ask ? { text_line: ask.text_line || null } : {}) };
    if (DEMO) {
      if (!pApprover()) throw pErr('Only a partner approver decides on partner words');
      if (!approve && !String(note || '').trim()) throw pErr('Say what to change');
      const d = demoPartners(), x = d.queue.find(q => q.kind === it.kind && q.id === it.id); if (!x) throw pErr('Already decided, or taken back by the group');
      const pa = approve && x.kind === 'bill' ? demoAskOnApprove(d, x, extra) : undefined;   // checks the text line first: a refusal changes nothing
      d.queue = d.queue.filter(q => q !== x);
      if (x.kind === 'bill') { const c = d.counts[x.partner_slug] ??= { live: 0, waiting: 0, changes: 0 }; c.waiting = Math.max(0, c.waiting - 1); if (!approve) c.changes++; else if (!x.live) c.live++; }
      return x.kind === 'bill' && approve ? { ...x.words, state: 'live', partner_ask: pa ? demoAskJson(d, pa) : null } : undefined;
    }
    const { data, error } = await S.supa.rpc('partner_review', { p: { kind: it.kind, id: it.id, approve: !!approve, note: note || null, ...extra } }); if (error) throw error; return data;
  },
  // ---- partner asks in the 4:30 pm email (backend 185, R-328 batch G) ----
  // Every current partner ask whose end date is less than two weeks past, newest first; state: going_out (before its first
  // 4:30 pm), sending (it went in an email and still goes to those it waited for), taken_back, ended. Any staff member.
  async partnerAsks() {
    if (DEMO) { const d = demoPartners(); return demoAsks(d).filter(a => !a.replaced_at && a.ask_until >= hstToday(-14))
      .sort((x, y) => String(y.scheduled_for).localeCompare(String(x.scheduled_for)) || y.id - x.id).map(a => demoAskJson(d, a)); }
    const { data, error } = await S.supa.rpc('partner_asks_list'); if (error) throw error; return data || [];
  },
  // Take it back (do: 'take_back'), send it again at the next 4:30 pm ('send': its Undo; nobody who got it gets it twice),
  // or Also by text ('text', with also_text and text_line). Partner approvers only; refusals in the database's words.
  async partnerAskStep(p) {
    if (DEMO) {
      if (!pApprover()) throw pErr('Only a partner approver decides on partner asks');
      const d = demoPartners(), a = demoAsks(d).find(x => x.id === +p.id); if (!a) throw pErr('No such partner ask');
      if (a.replaced_at) throw pErr('Newer words from the group replaced this ask');
      if (p.do === 'take_back') { if (a.taken_back_at) throw pErr('Already taken back'); a.taken_back_at = new Date().toISOString(); }
      else if (p.do === 'send') { if (!a.taken_back_at) throw pErr('It is already going out'); if (a.ask_until < hstToday() || a.ended) throw pErr('This ask has ended');
        Object.assign(a, { taken_back_at: null, scheduled_for: nextEmail() }); }
      else if (p.do === 'text') Object.assign(a, demoTextCheck(a, { ...('also_text' in p ? { also_text: !!p.also_text } : {}), ...('text_line' in p ? { text_line: p.text_line } : {}) }));
      else throw pErr('Unknown step');
      return demoAskJson(d, a);
    }
    const { data, error } = await S.supa.rpc('partner_ask_step', { p }); if (error) throw error; return data;
  },
  // The Partners screen: every group (link-only ones too), its people (not removed), its bills' counts (live, waiting for
  // approval, changes asked) and its link's first visits in 12 weeks (first_visit_sources; null when that read fails).
  async loadPartnerGroups() {
    if (DEMO) { const d = demoPartners(); await this.loadPartners();
      const groups = [...d.groups, ...(S.partners || []).filter(p => !d.groups.some(g => g.slug === p.slug)).map(p => ({ website: null, about: null, status: 'link', added_by: null, ...p }))];
      return S.pg = { groups: groups.map(g => ({ ...g })), people: d.people.filter(p => !p.removed_at).map(p => ({ ...p })), counts: JSON.parse(JSON.stringify(d.counts)), visits: { ...d.visits }, sample: true, at: Date.now() }; }
    const [g, pp, pb, pw, fv] = await Promise.all([
      S.supa.from('partners').select('*').order('name').order('slug'),
      S.supa.from('partner_people').select('id,partner_slug,email,name,role,user_id,invited_at,joined_at,terms_at,removed_at').is('removed_at', null).order('invited_at').order('id'),
      allRows(o => S.supa.from('partner_bills').select('id,partner_slug,removed_at,hidden_at,side_clash_at', o).order('id')),
      allRows(o => S.supa.from('partner_bill_words').select('id,partner_bill_id,state', o).in('state', ['live', 'sent', 'changes']).order('id')),
      this.firstVisitSources(12).catch(() => null),
    ]);
    for (const r of [g, pp, pb, pw]) if (r.error) throw r.error;
    const states = new Map(); for (const w of pw.data || []) (states.get(w.partner_bill_id) || states.set(w.partner_bill_id, new Set()).get(w.partner_bill_id)).add(w.state);
    const counts = {};
    for (const b of pb.data || []) { if (b.removed_at) continue; const st = states.get(b.id) || new Set(), c = counts[b.partner_slug] ??= { live: 0, waiting: 0, changes: 0 };
      if (st.has('live') && !b.hidden_at && !b.side_clash_at) c.live++; if (st.has('sent')) c.waiting++; if (st.has('changes')) c.changes++; }
    const visits = fv ? {} : null; for (const r of fv || []) visits[r.source] = (visits[r.source] || 0) + (Number(r.visits) || 0);
    return S.pg = { groups: g.data || [], people: pp.data || [], counts, visits, at: Date.now() };
  },
  // Add a group, or change its details. p: { slug?, name, website, about, welcome }. A new group comes back 'waiting'
  // (a second approver turns it on); write: true also turns a link-only partner into a writing group.
  async partnerGroupSave(p) {
    const row = { ...(p.slug ? { slug: p.slug } : {}), name: String(p.name || '').trim(), website: p.website || null, about: p.about || null, welcome: p.welcome || null, write: p.write !== false };
    let out;
    if (DEMO) {
      if (!pAdmitter()) throw pErr('Only an admin or a partner approver adds partner groups');
      const d = demoPartners(), slug = row.slug || partnerSlug(row.name), was = d.groups.find(g => g.slug === slug), link = (S.partners || []).find(x => x.slug === slug);
      if (was) { Object.assign(was, { name: row.name || was.name, website: row.website, about: row.about, welcome: row.welcome }); out = was; }
      else { out = { slug, name: row.name, website: row.website, about: row.about, welcome: row.welcome, status: row.write ? 'waiting' : 'link', added_by: S.me?.id || null, approved_by: null, approved_at: null, paused_at: null, created_at: link?.created_at || new Date().toISOString() }; d.groups.push(out); }
      out = { ...out };
    } else { const { data, error } = await S.supa.rpc('partner_group_save', { p: row }); if (error) throw error; out = data; }
    // The Make a link list (firstvisit.js) is the same table: keep it in step.
    const pl = S.partners?.find(x => x.slug === out.slug);
    if (pl) Object.assign(pl, { name: out.name, welcome: out.welcome }); else if (S.partners) S.partners.push({ slug: out.slug, name: out.name, welcome: out.welcome, created_at: out.created_at });
    return out;
  },
  // Approve (a second approver), pause or resume a group. act: 'approve' | 'pause' | 'resume'.
  async partnerGroupSet(slug, act) {
    if (DEMO) {
      const g = demoPartners().groups.find(x => x.slug === slug); if (!g) throw pErr('No such partner group');
      if (act === 'approve') { if (g.status !== 'waiting') throw pErr(`A partner group cannot go from ${g.status} to active`); if (!pApprover()) throw pErr('Only a partner approver approves a group');
        if (g.added_by === S.me?.id) throw pErr('Someone other than the person who added the group approves it'); Object.assign(g, { status: 'active', approved_by: S.me.id, approved_at: new Date().toISOString() }); }
      else { if (!pAdmitter()) throw pErr('Only an admin or a partner approver changes a partner group');
        const to = act === 'pause' ? ['active', 'paused'] : ['paused', 'active']; if (g.status !== to[0]) throw pErr(`A partner group cannot go from ${g.status} to ${to[1]}`);
        Object.assign(g, { status: to[1], paused_at: act === 'pause' ? new Date().toISOString() : null }); }
      return { ...g };
    }
    const { data, error } = await S.supa.rpc('partner_group_set', { p: { slug, do: act } }); if (error) throw error; return data;
  },
  // Add a person to a group (the first is its lead) or put a removed one back. p: { slug, email, name, role? }.
  async partnerPersonSave(p) {
    const row = { slug: p.slug, email: String(p.email || '').trim().toLowerCase(), name: String(p.name || '').trim() || null, ...(p.role ? { role: p.role } : {}) };
    if (DEMO) {
      if (!pAdmitter()) throw pErr('Only an admin or a partner approver adds partner people');
      const d = demoPartners(), g = d.groups.find(x => x.slug === row.slug); if (!g || g.status === 'link') throw pErr('Add the group first');
      if (S.advocates.some(a => (a.email || '').toLowerCase() === row.email)) throw pErr('That is a HIPHI team address');
      let x = d.people.find(q => q.partner_slug === row.slug && q.email.toLowerCase() === row.email);
      const lead = d.people.some(q => q.partner_slug === row.slug && q.role === 'lead' && !q.removed_at);
      if (x) Object.assign(x, { removed_at: null, name: row.name || x.name, role: row.role || x.role });
      else { x = { id: crypto.randomUUID(), partner_slug: row.slug, email: row.email, name: row.name, role: row.role || (lead ? 'member' : 'lead'), user_id: null, invited_at: new Date().toISOString(), joined_at: null, terms_at: null, removed_at: null }; d.people.push(x); }
      return { ...x };
    }
    const { data, error } = await S.supa.rpc('partner_person_save', { p: row }); if (error) throw error; return data;
  },
  async partnerPersonRemove(id) {
    if (DEMO) { if (!pAdmitter()) throw pErr('Only an admin or a partner approver adds partner people');
      const x = demoPartners().people.find(q => q.id === id && !q.removed_at); if (!x) throw pErr('That person is not on a group'); x.removed_at = new Date().toISOString(); return; }
    const { error } = await S.supa.rpc('partner_person_save', { p: { remove: id } }); if (error) throw error;
  },
  // Who approves partners (admins name them; Nate and Jess, Nate 10/22).
  async partnerSetApprover(advocateId, on) {
    if (DEMO) { if (!S.me?.is_admin) throw pErr('Only an admin names partner approvers'); const d = demoPartners();
      d.approvers = on ? [...new Set([...d.approvers, advocateId])] : d.approvers.filter(x => x !== advocateId); }
    else { const { error } = await S.supa.rpc('partner_set_approver', { p_advocate: advocateId, p_on: !!on }); if (error) throw error; }
    const a = advocate(advocateId); if (a) a.approves_partners = !!on;
  },
  // A request to join: 'added' (with the group it became), 'declined', or 'new' again (Undo).
  async partnerRequestHandle(id, state, slug = null) {
    if (DEMO) { if (!pAdmitter()) throw pErr('Only an admin or a partner approver handles requests');
      const r = demoPartners().requests.find(x => x.id === id); if (!r) throw pErr('No such request'); Object.assign(r, { state, partner_slug: slug || null }); return { ...r }; }
    const { data, error } = await S.supa.rpc('partner_request_handle', { p: { id, state, partner_slug: slug || null } }); if (error) throw error; return data;
  },
  // A partner person's one-time sign-in link, for the admitter to send from their own email (team-admin's partner_link,
  // R-328 B). Nothing is emailed. Until that function is deployed the answer has no action: 'partner_link', and this says so
  // in plain words (err.setup) rather than passing on the old function's "Which person?".
  async partnerLink(personId) {
    const setup = () => Object.assign(new Error('Sign-in links need a one-time setup by Nate; until then ask the person to sign in on the tracker with their email.'), { setup: true });
    if (DEMO) throw Object.assign(new Error('The practice copy makes no sign-in links. In the live app this gives the person’s one-time link, to copy and send from your own email.'), { practice: true });
    const { data } = await S.supa.auth.getSession();
    let r; try { r = await fetch(`${SUPABASE_URL}/functions/v1/team-admin`, { method: 'POST', headers: { authorization: `Bearer ${data.session?.access_token}`, apikey: SUPABASE_KEY, 'content-type': 'application/json' }, body: JSON.stringify({ action: 'partner_link', person_id: personId, redirect_to: APP_URL + 'track.html' }) }); }
    catch (e) { if (typeof navigator !== 'undefined' && navigator.onLine === false) throw new Error('You’re offline. Try again when you are connected.'); throw setup(); }
    const j = await r.json().catch(() => null);
    if (!j || j.action !== 'partner_link') throw setup();
    if (!j.ok) throw new Error(j.error || 'The link could not be made. Try again.');
    return j;
  },

  // ---- people (CRM) ----
  async loadPeople() {
    if (S.peopleLoaded || S.peopleLoading) return; S.peopleLoading = true;
    try { const { data, error } = await allRows(o => S.supa.from('people_overview').select('*', o).order('last_active', { ascending: false, nullsFirst: false }).order('id')); if (error) throw error; S.people = data || []; S.peopleLoaded = true; }
    finally { S.peopleLoading = false; }
  },
  // How supporters describe themselves (R-156 E1, E2; backend 130 profile_rollup): counts and title words only, never a
  // story's text. The sandbox counts its own copy of the people.
  async profileRollup() {
    if (DEMO) return rollupOf(S.people || []);
    const { data, error } = await S.supa.rpc('profile_rollup'); if (error) throw error; return data || {};
  },
  async ensurePerson(id) { if (personById(id)) return personById(id); if (DEMO) return null; return this.refreshPerson(id); },
  async bulkTag(ids, tag, add) { if (DEMO) { for (const id of ids) { const p = personById(id); p.tags = add ? [...new Set([...p.tags, tag])] : p.tags.filter(t => t !== tag); } return ids.length; } const { data, error } = await S.supa.rpc('people_bulk_tag', { p_ids: ids, p_tag: tag, p_add: add }); if (error) throw error; for (const id of ids) { const p = personById(id); if (p) p.tags = add ? [...new Set([...p.tags, tag])] : p.tags.filter(t => t !== tag); } return data; },
  async bulkFollowup(ids, advocateId, what, due) { if (DEMO) { for (const id of ids) S.followups.push({ id: Date.now() + Math.random(), person_id: id, advocate_id: advocateId, what, due: due || null, created_by: S.me.id, created_at: new Date().toISOString(), person: personById(id) }); return ids.length; } const { data, error } = await S.supa.rpc('people_bulk_followup', { p_ids: ids, p_advocate: advocateId, p_what: what, p_due: due || null }); if (error) throw error; const { data: f } = await S.supa.from('people_followups').select('*, person:people(id,name,email,phone)').is('done_at', null).order('due', { nullsFirst: false }); if (f) S.followups = f; return data; },
  async refreshPerson(id) { const { data, error } = await S.supa.from('people_overview').select('*').eq('id', id).maybeSingle(); if (error) throw error; const i = S.people.findIndex(p => p.id === id); if (data) { if (i >= 0) S.people[i] = data; else S.people.unshift(data); } else if (i >= 0) S.people.splice(i, 1); return data; },
  async savePerson(id, patch) {
    if (DEMO) { const p = personById(id); Object.assign(p, patch, { island: islandOf(patch.senate_district ?? p.senate_district) }); if (!p.has_account && 'action_alerts' in patch) p.action_optin = !!patch.action_alerts; return p; }
    const { error } = await S.supa.from('people').update({ ...patch, island: 'senate_district' in patch ? islandOf(patch.senate_district) : undefined, updated_at: new Date().toISOString() }).eq('id', id); if (error) throw error;
    return this.refreshPerson(id);
  },
  async addPerson(fields) {
    if (DEMO) { const p = { id: 'p' + Date.now(), tags: [], interests: [], ...fields, source: 'manual', created_at: new Date().toISOString(), last_active: new Date().toISOString(), has_account: false, action_optin: !!fields.action_alerts, bill_ids: [], list_ids: [], actions: 0, testimonies: 0, emails_sent: 0, emails_opened: 0, emails_clicked: 0, score: 0, island: islandOf(fields.senate_district) }; S.people.unshift(p); S.personTL[p.id] = [{ at: p.created_at, kind: 'added', label: 'Added by hand' }]; return p; }
    const { data, error } = await S.supa.from('people').insert({ ...fields, island: islandOf(fields.senate_district), source: 'manual', created_by: S.me?.id }).select('id').single(); if (error) throw error;
    return this.refreshPerson(data.id);
  },
  async deletePerson(id) { if (!DEMO) { const { error } = await S.supa.from('people').delete().eq('id', id); if (error) throw error; } S.people = S.people.filter(p => p.id !== id); },
  async mergePeople(keep, drop) { if (DEMO) { const k = personById(keep), d = personById(drop); k.tags = [...new Set([...k.tags, ...d.tags])]; S.people = S.people.filter(p => p.id !== drop); return k; } const { error } = await S.supa.rpc('merge_people', { p_keep: keep, p_drop: drop }); if (error) throw error; S.people = S.people.filter(p => p.id !== drop); return this.refreshPerson(keep); },
  async importPeople(rows, note) { if (DEMO) { let added = 0, updated = 0, skipped = 0; for (const r of rows) { if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(r.email || '')) { skipped++; continue; } const ex = S.people.find(p => p.email.toLowerCase() === r.email.toLowerCase()); if (ex) { ex.tags = [...new Set([...ex.tags, ...(r.tags || [])])]; updated++; } else { await this.addPerson({ email: r.email.toLowerCase(), name: r.name || null, phone: r.phone || null, tags: r.tags || [], interests: r.interests || [], action_alerts: r.action_alerts ?? null }); S.people[0].source = 'import'; S.people[0].source_note = note; added++; } } return { added, updated, skipped }; }
    let tot = { added: 0, updated: 0, skipped: 0 };
    for (let i = 0; i < rows.length; i += 500) { const { data, error } = await S.supa.rpc('import_people', { p_rows: rows.slice(i, i + 500), p_source_note: note || null }); if (error) throw error; const r = data?.[0] || {}; tot = { added: tot.added + (r.added || 0), updated: tot.updated + (r.updated || 0), skipped: tot.skipped + (r.skipped || 0) }; }
    S.peopleLoaded = false; await this.loadPeople();
    return tot;
  },
  async personNotes(id) { if (DEMO) return S.peopleNotes[id] ??= []; const { data, error } = await S.supa.from('people_notes').select('*').eq('person_id', id).order('created_at', { ascending: false }); if (error) throw error; return S.peopleNotes[id] = data || []; },
  async addPersonNote(id, body) { if (DEMO) { (S.peopleNotes[id] ??= []).unshift({ id: Date.now(), person_id: id, advocate_id: S.me.id, body, created_at: new Date().toISOString() }); return; } const { error } = await S.supa.from('people_notes').insert({ person_id: id, advocate_id: S.me.id, body }); if (error) throw error; await this.personNotes(id); },
  async delPersonNote(noteId, id) { if (DEMO) { S.peopleNotes[id] = (S.peopleNotes[id] || []).filter(n => String(n.id) !== String(noteId)); return; } const { error } = await S.supa.from('people_notes').delete().eq('id', noteId); if (error) throw error; await this.personNotes(id); },
  async personTimeline(id) { if (DEMO) return S.personTL[id] ??= []; const { data, error } = await S.supa.rpc('person_timeline', { p_person: id }); if (error) throw error; return S.personTL[id] = data || []; },
  async addFollowup(personId, advocateId, what, due) { if (DEMO) { S.followups.push({ id: Date.now(), person_id: personId, advocate_id: advocateId, what, due: due || null, created_by: S.me.id, created_at: new Date().toISOString(), person: personById(personId) }); return; } const { data, error } = await S.supa.from('people_followups').insert({ person_id: personId, advocate_id: advocateId, what, due: due || null, created_by: S.me.id }).select('*, person:people(id,name,email,phone)').single(); if (error) throw error; S.followups.push(data); },
  async doneFollowup(id) { if (!DEMO) { const { error } = await S.supa.from('people_followups').update({ done_at: new Date().toISOString() }).eq('id', id); if (error) throw error; } S.followups = S.followups.filter(f => f.id !== id); },
  async saveSegment(seg) {
    if (DEMO) { if (seg.id) Object.assign(S.segments.find(x => x.id === seg.id), seg); else { seg.id = 's' + Date.now(); seg.created_by = S.me.id; S.segments.push(seg); } S.segments.sort((a, b) => a.name.localeCompare(b.name)); return seg; }
    const { data, error } = seg.id ? await S.supa.from('people_segments').update({ name: seg.name, filter: seg.filter }).eq('id', seg.id).select('*').single() : await S.supa.from('people_segments').insert({ name: seg.name, filter: seg.filter, created_by: S.me.id }).select('*').single(); if (error) throw error;
    const i = S.segments.findIndex(x => x.id === data.id); if (i >= 0) S.segments[i] = data; else S.segments.push(data); S.segments.sort((a, b) => a.name.localeCompare(b.name)); return data;
  },
  async deleteSegment(id) { if (!DEMO) { const { error } = await S.supa.from('people_segments').delete().eq('id', id); if (error) throw error; } S.segments = S.segments.filter(x => x.id !== id); },
  // ---- action alerts (email to followers) ----
  async alertAudience(billId, listId, segmentId) { if (DEMO) return segmentId ? segmentPeople(segmentId).filter(p => p.action_optin).length : billId ? 12 : 31; const { data, error } = await S.supa.rpc('alert_audience', { p_bill: billId || null, p_list: listId || null, p_segment: segmentId || null }); if (error) throw error; return data || 0; },
  async canAlert(billId, listId, segmentId) { if (DEMO) return true; const { data } = await S.supa.rpc('can_alert', { p_bill: billId || null, p_list: listId || null, p_segment: segmentId || null }); return !!data; },
  async saveAlert(a) {
    if (DEMO) { if (!a.id) { a.id = -Date.now(); a.status = 'draft'; a.created_at = new Date().toISOString(); a.author_id = S.me?.id; S.alerts.unshift(a); } else Object.assign(S.alerts.find(x => x.id === a.id) || {}, a); return a; }
    // A big push (R-299, backend 181: big_push, text_line) is written only when the composer sends it, so an email without
    // one saves the same before and after the migration.
    const push = 'big_push' in a ? { big_push: !!a.big_push, text_line: a.big_push ? a.text_line || null : null } : {};
    const row = { bill_id: a.bill_id || null, list_id: a.list_id || null, segment_id: a.segment_id || null, subject: a.subject, body: a.body, body_html: a.body_html || null, author_id: S.me?.id, updated_at: new Date().toISOString(), ...push };
    if (!a.id) { const { data, error } = await S.supa.from('action_alerts').insert(row).select('*').single(); if (error) throw error; S.alerts.unshift(data); return data; }
    const { data, error } = await S.supa.from('action_alerts').update({ subject: row.subject, body: row.body, body_html: row.body_html, updated_at: row.updated_at, ...push }).eq('id', a.id).select('*').single(); if (error) throw error;
    Object.assign(S.alerts.find(x => x.id === a.id) || {}, data); return data;
  },
  async alertStep(id, action, note) {
    // Sandbox: the same steps as action_alert_step. Send waits for the 4:30 pm email (migration 109, R-101); Unsend takes it back.
    if (DEMO) { const a = S.alerts.find(x => x.id === id); const now = new Date(), hst = new Date(now.toLocaleString('en-US', { timeZone: 'Pacific/Honolulu' }));
      const at = new Date(now.getTime() + ((hst.getHours() * 60 + hst.getMinutes() < 990 ? 0 : 1440) + 990 - hst.getHours() * 60 - hst.getMinutes()) * 60000 - hst.getSeconds() * 1000);
      if (action === 'send') { if (a.status !== 'approved' || a.scheduled_for) throw new Error('approve it first'); Object.assign(a, { scheduled_for: at.toISOString(), recipients: a.recipients ?? 12, updated_at: now.toISOString() }); return a; }
      if (action === 'unsend') { if (!a.scheduled_for) throw new Error('Nothing is waiting to go out.'); Object.assign(a, { scheduled_for: null, updated_at: now.toISOString() }); return a; }
      const next = { submit: 'submitted', approve: 'approved', unapprove: 'submitted', return: 'returned', test: a.status }[action]; Object.assign(a, { status: next, review_note: action === 'return' ? note : a.review_note, sent_at: action === 'send' ? new Date().toISOString() : a.sent_at, recipients: action === 'send' ? 12 : a.recipients }); return a; }
    const { data, error } = await S.supa.rpc('action_alert_step', { p_id: id, p_action: action, p_note: note || null }); if (error) throw error;
    Object.assign(S.alerts.find(x => x.id === id) || {}, data);
    const tok = S.session?.access_token;   // nudge the outbox so DMs, tests and sends go now
    if (tok) fetch(`${SUPABASE_URL}/functions/v1/notify-send`, { method: 'POST', headers: { Authorization: `Bearer ${tok}`, apikey: SUPABASE_KEY } }).catch(() => {});
    return data;
  },
  async deleteAlert(id) { if (!DEMO) { const { error } = await S.supa.from('action_alerts').delete().eq('id', id); if (error) throw error; } S.alerts = S.alerts.filter(x => x.id !== id); },
  // ---- legislators: stances, notes ----
  async setStance(billId, legId, patch) {
    let row = S.stances.find(x => x.bill_id === billId && x.legislator_id === legId);
    if (!row) { row = { bill_id: billId, legislator_id: legId, stance: 'unknown', note: null, contact_id: null }; S.stances.push(row); }
    Object.assign(row, patch, { updated_by: S.me?.id, updated_at: new Date().toISOString() });
    if (DEMO) return;
    const { error } = await S.supa.from('legislator_stances').upsert({ bill_id: billId, legislator_id: legId, stance: row.stance, note: row.note, contact_id: row.contact_id, updated_by: S.me?.id, updated_at: row.updated_at }); if (error) throw error;
  },
  // The newest logged conversation for every legislator, in one request (the Legislators table's "Last contact").
  async legLatestNotes() {
    if (S.legLast) return S.legLast;
    // The practice copy's own conversations (a chair ask made there is the chair's Last contact too, R-316 W3).
    // R-335: a note (Add a note, practice copy) is not a contact, so it never counts as the last one.
    if (DEMO) { const out = {}; for (const r of [...(S.demoNotes || [])].filter(r => r.kind !== 'note').sort((x, y) => String(y.created_at).localeCompare(String(x.created_at)))) if (!out[r.legislator_id]) out[r.legislator_id] = r; return (S.legLast = out); }
    const { data, error } = await allRows(o => S.supa.from('legislator_notes').select('id,legislator_id,advocate_id,body,created_at', o).order('created_at', { ascending: false }).order('id')); if (error) throw error;
    const out = {}; for (const r of data || []) if (!out[r.legislator_id]) out[r.legislator_id] = r;
    return (S.legLast = out);
  },
  // R-316 W3: every chair ask, for every teammate's rows (a few hundred a session at most). Live only once 183 is in.
  async chairAsks() {
    if (DEMO) return (S.chairAsks = []);
    const { data, error } = await allRows(o => S.supa.from('legislator_notes').select('id,legislator_id,bill_id,advocate_id,body,answer,committee,created_at', o).not('answer', 'is', null).order('created_at').order('id'));
    if (error) throw error; return (S.chairAsks = data || []);
  },
  async legNotes(legId) {
    if (S.legNotes[legId]) return S.legNotes[legId];
    if (DEMO) return (S.legNotes[legId] = (S.demoNotes || []).filter(n => n.legislator_id === legId));
    const { data, error } = await S.supa.from('legislator_notes').select('*').eq('legislator_id', legId).order('created_at', { ascending: false }).limit(50); if (error) throw error;
    return (S.legNotes[legId] = data || []);
  },
  // A conversation with a legislator is about an issue more than a bill (Nate, 9/21; migration 064). One meeting with
  // several legislators is one row per legislator sharing conversation_id. opts: { issueId, metOn (YYYY-MM-DD),
  // conversationId }. Returns the row.
  async addLegNote(legId, billId, body, opts = {}) {
    const fields = { legislator_id: legId, bill_id: billId || null, advocate_id: S.me?.id, body,
      issue_id: opts.issueId || null, met_on: opts.metOn || null, conversation_id: opts.conversationId || null };
    // R-316 W3 (migration 183): a chair ask carries its answer and committee. Sent only when set, so a plain
    // conversation saves the same way before 183 is applied.
    if (opts.answer) Object.assign(fields, { answer: opts.answer, committee: opts.committee || null });
    const row = { ...fields, created_at: new Date().toISOString(), id: 'tmp' + Date.now() + Math.random().toString(36).slice(2, 6) };
    if (!DEMO) { const { data, error } = await S.supa.from('legislator_notes').insert(fields).select('*').single(); if (error) throw error; Object.assign(row, data); }
    else { if (opts.kind) row.kind = opts.kind; (S.demoNotes ??= []).unshift(row); }   // R-335: a note (kind 'note') is a practice row only, until its migration
    // Only a legislator whose notes are already loaded gets the row added; creating the cache here would make their
    // page show this one note and skip loading the rest.
    if (S.legNotes[legId]) S.legNotes[legId].unshift(row);
    S.convCache = {}; S.legLast = null; return row;
  },
  // Your own note can be corrected for ten minutes (the database enforces it; 064).
  async updateLegNote(id, patch) {
    const all = [...Object.values(S.legNotes || {}).flat(), ...(S.demoNotes || [])].filter(n => String(n.id) === String(id));
    const before = all.map(n => Object.fromEntries(Object.keys(patch).map(k => [k, n[k]])));
    const put = (i, v) => all.forEach((n, j) => Object.assign(n, i === 'patch' ? v : before[j]));
    put('patch', patch); S.convCache = {};
    if (DEMO) return;
    try {
      const { data, error } = await S.supa.from('legislator_notes').update(patch).eq('id', id).select('id');
      if (error) throw error;
      if (!(data || []).length) throw new Error('This note can no longer be changed: notes can be corrected for ten minutes after they are saved.');
    } catch (e) { put('before'); S.convCache = {}; throw e; }   // put it back as the database still has it
  },
  async delLegNote(id, legId) {
    if (!DEMO) { const { error } = await S.supa.from('legislator_notes').delete().eq('id', id); if (error) throw error; }
    else S.demoNotes = (S.demoNotes || []).filter(n => String(n.id) !== String(id));
    if (S.legNotes[legId]) S.legNotes[legId] = S.legNotes[legId].filter(n => n.id !== id);
    S.convCache = {}; S.legLast = null;
  },
  // Every row of the given conversations (one per legislator at the meeting), so a legislator's page can name the
  // others who were there.
  async conversationRows(ids) {
    if (!ids.length) return [];
    if (DEMO) return (S.demoNotes || []).filter(n => ids.includes(n.conversation_id));
    const { data, error } = await S.supa.from('legislator_notes').select('*').in('conversation_id', ids).limit(500);
    if (error) throw error; return data || [];
  },
  // Every conversation about a bill: logged on the bill itself, or under any issue the bill carries. Newest first.
  async conversations({ billId = null, issueIds = [] } = {}) {
    const key = (billId || '') + '|' + [...issueIds].sort().join(',');
    if ((S.convCache ??= {})[key]) return S.convCache[key];
    let rows;
    if (DEMO) rows = (S.demoNotes || []).filter(n => (billId && n.bill_id === billId) || (n.issue_id && issueIds.includes(n.issue_id)));
    else {
      const ors = [billId ? `bill_id.eq.${billId}` : null, issueIds.length ? `issue_id.in.(${issueIds.join(',')})` : null].filter(Boolean);
      if (!ors.length) return [];
      const { data, error } = await S.supa.from('legislator_notes').select('*').or(ors.join(',')).order('created_at', { ascending: false }).limit(100);
      if (error) throw error; rows = data || [];
    }
    return (S.convCache[key] = rows.slice().sort((a, b) => String(b.met_on || b.created_at).localeCompare(String(a.met_on || a.created_at))));
  },
  async saveCounterparts(pairs) {
    S.counterparts = pairs;
    if (DEMO) return;
    const { error: e1 } = await S.supa.from('committee_counterparts').delete().neq('house_code', ''); if (e1) throw e1;
    if (pairs.length) { const { error } = await S.supa.from('committee_counterparts').insert(pairs); if (error) throw error; }
  },
  // ---- people's own lists (R-013, migration 103): an admin turns off a shared list by its link ----
  // Privacy (backend 159, R-180 J2-1 and J2-2). forgetPerson answers counts, never contents; the sandbox pretends.
  async forgetPerson(email, phone) {
    if (DEMO) return { ok: true, accounts_deleted: email ? 1 : 0, numbers_stopped: phone ? 1 : 0, supporter_records: email ? 1 : 0, trail: { asks_waiting: 0, emails_unsent: 1, emails_sent_erased: 2, opens_clicks_erased: 3 }, demo: true };
    const { data, error } = await S.supa.rpc('forget_person', { p: { email: email || '', phone: phone || '' } }); if (error) throw error; return data;
  },
  async retentionStatus() {
    if (DEMO) return S.demoRetention ??= { on: false, texts_live: false, last_run: null, kinds: [
      { kind: 'sent_email_text', label: 'Email text we sent', period: '7 years', due: 0, soon: 0 }, { kind: 'opens_clicks', label: 'Which emails were opened or clicked', period: '7 years', due: 0, soon: 0 },
      { kind: 'unconfirmed_numbers', label: 'Numbers never confirmed', period: '30 days', due: 2, soon: 5 }, { kind: 'stopped_numbers', label: 'Stopped numbers (the bare stop record)', period: '4 years', due: 0, soon: 0 },
      { kind: 'unused_accounts', label: 'Accounts not used', period: '3 years (a warning at 2)', due: 0, soon: 0 }, { kind: 'error_reports', label: 'The page’s error reports', period: '1 year', due: 0, soon: 0 }] };
    const { data, error } = await S.supa.rpc('retention_status'); if (error) throw error; return data;
  },
  async retentionSet(on) {
    if (DEMO) { (S.demoRetention ??= {}).on = !!on; return { on: !!on }; }
    const { data, error } = await S.supa.rpc('retention_set', { p_on: !!on }); if (error) throw error; return data;
  },
  async retentionCount() {   // counts only: the clean-up run with apply off, which deletes nothing
    if (DEMO) return { applied: false };
    const { data, error } = await S.supa.rpc('retention_run', { p_apply: false }); if (error) throw error; return data;
  },
  async turnOffList(link, reason) {
    if (DEMO) { const title = 'A list from the sandbox'; (S.demoOffLists ??= []).unshift({ id: 'demo-ul-' + Date.now(), title, blocked_at: new Date().toISOString(), blocked_by: S.me?.initials || '', blocked_reason: reason || null }); return title; }
    const { data, error } = await S.supa.rpc('turn_off_user_list', { p_link: link, p_reason: reason || null }); if (error) throw error; return data;
  },
  async offLists() {
    if (DEMO) return S.demoOffLists ??= [];
    const { data, error } = await S.supa.rpc('turned_off_user_lists'); if (error) throw error; return data || [];
  },
  async turnOnList(id) {
    if (DEMO) { S.demoOffLists = (S.demoOffLists || []).filter(l => l.id !== id); return; }
    const { error } = await S.supa.rpc('turn_on_user_list', { p_list: id }); if (error) throw error;
  },
  // ---- curated lists ----
  async createList({ title, description, icon }) {
    const base = title.toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'list';
    let slug = base, i = 2; while (S.lists.some(l => l.slug === slug)) slug = `${base}-${i++}`;
    const row = { slug, title: title.trim(), description: (description || '').trim() || null, icon: (icon || '').trim() || null, owner_id: S.me?.id || null, is_published: false, sort_order: 100 + S.lists.length };
    if (DEMO) { const l = { id: 'demo-' + Date.now(), created_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...row }; S.lists.push(l); return l; }
    const { data, error } = await S.supa.from('public_lists').insert(row).select('*').single(); if (error) throw error; S.lists.push(data); return data;
  },
  async updateList(id, patch) {
    const l = S.lists.find(x => x.id === id); if (!l) return; Object.assign(l, patch, { updated_at: new Date().toISOString() });
    if (DEMO) return;
    const { error } = await S.supa.from('public_lists').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', id); if (error) throw error;
  },
  async archiveList(id) { await this.updateList(id, { archived_at: new Date().toISOString(), is_published: false }); S.lists = S.lists.filter(l => l.id !== id); },
  async addListBills(listId, billIds) {
    const have = new Set(S.listBills.filter(x => x.list_id === listId).map(x => x.bill_id));
    const ids = billIds.filter(id => !have.has(id) && S.bills.some(b => b.id === id && b.tracked !== false && b.is_public));
    if (!ids.length) return 0;
    const base = S.listBills.filter(x => x.list_id === listId).length;
    const rows = ids.map((bill_id, i) => ({ list_id: listId, bill_id, note: null, sort_order: 100 + base + i, added_at: new Date().toISOString() }));
    if (!DEMO) { const { error } = await S.supa.from('public_list_bills').insert(rows.map(({ added_at, ...r }) => r)); if (error) throw error; }
    S.listBills.push(...rows); return rows.length;
  },
  async removeListBill(listId, billId) {
    if (!DEMO) { const { error } = await S.supa.from('public_list_bills').delete().eq('list_id', listId).eq('bill_id', billId); if (error) throw error; }
    S.listBills = S.listBills.filter(x => !(x.list_id === listId && x.bill_id === billId));
  },
  async setListBill(listId, billId, patch) {
    const x = S.listBills.find(r => r.list_id === listId && r.bill_id === billId); if (!x) return; Object.assign(x, patch);
    if (!DEMO) { const { error } = await S.supa.from('public_list_bills').update(patch).eq('list_id', listId).eq('bill_id', billId); if (error) throw error; }
  },
  async setHearingStream(hearingId, url) {
    const h = S.hearings.find(x => x.id === hearingId); if (!h) return;
    if (!DEMO) { const { data, error } = await S.supa.rpc('set_hearing_stream', { p_hearing: hearingId, p_url: url || '' }); if (error) throw error; h.stream_url = data || null; }
    else h.stream_url = url || null;
  },
  async saveSessionCalendar(row) {
    S.sessionCal = [...(S.sessionCal || []).filter(c => c.session_year !== row.session_year), row];
    if (DEMO) return;
    const { error } = await S.supa.from('session_calendar').upsert({ ...row, updated_at: new Date().toISOString() }); if (error) throw error;
  },
  async saveSyncSettings(cfg) {
    S.syncCfg = cfg;
    if (DEMO) return;
    const { error } = await S.supa.from('app_settings').upsert({ key: 'sync', value: cfg, updated_at: new Date().toISOString() }); if (error) throw error;
  },
  // Email settings are one stored object, and its "enabled" keeps email to the public paused until Nate says so. A save
  // merges only the fields it is given into what is stored now, read fresh, so a form never writes back a stale or
  // guessed "enabled" (Z1-5); when the settings cannot be read, nothing is saved.
  async saveEmailSettings(patch) {
    if (S.emailCfgErr) throw new Error(EMAIL_UNREAD);
    if (DEMO) { S.emailCfg = { ...(S.emailCfg || {}), ...patch }; return; }
    const { data, error: rerr } = await S.supa.from('app_settings').select('value').eq('key', 'email').maybeSingle();
    if (rerr) throw new Error(EMAIL_UNREAD);
    const cfg = { ...(data?.value || {}), ...patch };
    const { error } = await S.supa.from('app_settings').upsert({ key: 'email', value: cfg, updated_at: new Date().toISOString() });
    if (error) throw error;
    S.emailCfg = cfg;
  },
  async saveCalendarSettings(cfg) {
    S.calCfg = cfg;
    if (DEMO) return;
    const { error } = await S.supa.from('app_settings').upsert({ key: 'calendar', value: cfg, updated_at: new Date().toISOString() });
    if (error) throw error;
  },
  async slackTest() {
    if (DEMO) return;
    const { error } = await S.supa.rpc('slack_test');
    if (error) throw error;
    const tok = S.session?.access_token;
    if (tok) await fetch(`${SUPABASE_URL}/functions/v1/notify-send`, { method: 'POST',
      headers: { Authorization: `Bearer ${tok}`, apikey: SUPABASE_KEY } }).catch(() => {});
  },
  async track(bill) {
    if (!DEMO) {
      const { error } = await S.supa.from('bills')
        .update({ tracked: true }).eq('id', bill.id);
      if (error) throw error;
    }
    bill.tracked = true; S.bills.push(bill);
    S.bills.sort((a,b) => a.bill_number.localeCompare(b.bill_number));
    await this.adoptHearings(bill.id);
  },
  // Sign-in reads the hearings of tracked bills only (R-152 B), so a bill tracked since then brings its own hearings in.
  async adoptHearings(billId) {
    if (DEMO) return;
    try { const { hearings } = await this.billHearings(billId); S.hearings = S.hearings.filter(h => h.bill_id !== billId).concat(hearings); }
    catch (e) { console.warn('hearings of a newly tracked bill:', e.message || e); }
  },
};

// ---------------- demo data: the mock training session ----------------
// ===SANDBOX=== the real session as it stood at DEMO_ASOF, from demo/snapshot.json.
// Bills, positions, owners, coalitions, committees, schedules and deadlines are
// real; stage, version, hearings and deadline deaths were recomputed for that
// day. Team activity (drafts, to-dos, follows) is seeded below so every button
// has something to press. Rebuild: node tools/build_snapshot.js in Bill-Tracker.
export function snapshotScenario(snap) {
  const nowMs = Date.now();
  const bills = snap.bills.map(b => ({ ...b, internal_notes: null }));
  const tl = snap.activity.map(a => ({ bill_id: a.bill_id, type: a.type || 'status_auto', title: a.title, details: a.details, occurred_at: a.occurred_at, source: 'auto' }))
    .sort((x, y) => y.occurred_at.localeCompare(x.occurred_at));
  const since = tl.filter(a => new Date(a.occurred_at) > nowMs - 3 * 864e5).map(a => ({ bill_id: a.bill_id, title: a.title, occurred_at: a.occurred_at }));
  const assignments = {}; for (const r of snap.assignments) (assignments[r.bill_id] ??= []).push(r.advocate_id);
  const billCampaigns = {}; for (const r of snap.billCampaigns) (billCampaigns[r.bill_id] ??= []).push(r.campaign_id);
  const compStage = {}; for (const b of bills) compStage[b.bill_number] = b.stage;
  return { bills, hearings: snap.hearings, tl, since, pulse: {}, assignments, billCampaigns, compStage };
}
export let DEMO_TL = [];
export async function demoInit() {
  const snap = await (await fetch('demo/snapshot.json?v=20261025b', { cache: 'force-cache' })).json();   // bump v when the snapshot is rebuilt, or browsers keep the old copy
  S.snapshot = snap;
  S.advocates = snap.advocates.map(a => ({ ...a, color: a.color || '#0E7C86' }));
  // v4 (R-269): Patti (HEAL) and Julie (alcohol, under HIAPA) are not in the tracker yet, so the practice copy adds them, owning
  // nothing and supporting their coalition, as Nate described them (R-267). Practise as either from your menu; once they are
  // added for real (Session setup > Team) and the snapshot is rebuilt, these two lines find them and add nothing.
  const coalId = n => snap.campaigns.find(c => c.name === n)?.id;
  for (const [id, full_name, initials, color, co] of [['aaaaaaaa-0000-4000-8000-00000000a011', 'Patti', 'PH', '#8e5ea2', 'HEAL'], ['aaaaaaaa-0000-4000-8000-00000000a012', 'Julie', 'JMM', '#3b8d6e', 'HIAPA']])
    if (!S.advocates.some(a => a.initials === initials) && coalId(co)) S.advocates.push({ id, full_name, initials, color, email: null, is_admin: false, is_reviewer: false, can_approve: false, is_active: true, focus_areas: null, prefs: { coalitions: [coalId(co)] } });
  S.me = S.advocates.find(a => a.is_admin) || S.advocates[0];
  // R-328 B: Nate and Jess approve partners (Nate 10/22); a practice change to who does is kept with the sample partner.
  { const ap = PRACTICE?.partners?.approvers || S.advocates.filter(a => ['NT', 'JS'].includes(a.initials)).map(a => a.id); for (const a of S.advocates) a.approves_partners = ap.includes(a.id); }
  const byIni = Object.fromEntries(S.advocates.map(a => [a.initials, a.id]));
  S.campaigns = snap.campaigns; hooks.afterLoad();
  S.slots = snap.slots;
  applySessionDeadlines(snap.deadlines);
  S.sessionCal = snap.calendar || [];
  S.alerts = [];
  S.emailCfg = { enabled: false };   // as on production: email is paused until Nate says so
  S.people = (snap.people || []).map(x => ({ ...x })); S.peopleLoaded = true; S.segments = (snap.segments || []).map(x => ({ ...x })); S.followups = (snap.followups || []).map(x => ({ ...x, person: (snap.people || []).find(p => p.id === x.person_id) })); S.peopleNotes = {}; S.personTL = Object.fromEntries((snap.people || []).map(x => [x.id, x.timeline || []]));
  S.legislators = snap.legislators || []; S.committeeMembers = snap.committeeMembers || []; S.counterparts = snap.counterparts || []; S.stances = []; S.legNotes = {};
  S.lists = (snap.lists || []).map(l => ({ ...l })); S.listBills = (snap.listBills || []).map(x => ({ ...x })); hooks.afterLoad(); S.listFollowers = Object.fromEntries((snap.lists || []).map(l => [l.id, l.followers || 0]));
  S.categories = (snap.categories || []).map(c => ({ ...c })); S.issues = (snap.issues || []).map(i => ({ archived_at: null, published_at: '2026-09-21T00:00:00Z', prep_state: 'todo', ...i })); S.issueHelpers = []; S.issueLinks = (snap.issueLinks || []).map(x => ({ ...x, related: true })); S.issueLinkChoices = []; S.issueCats = (snap.issueCategories || []).map(x => ({ ...x })); S.billIssues = (snap.billIssues || []).map(x => ({ ...x }));
  S.slackCfg = { main_channel: '#hearing-alerts-2027', positions: ['strongly_support','support','support_amend','strongly_oppose','oppose','neutral'], workflow_dm: true, health_dm: true,
    reminder_defaults: { morning: '08:35', morning_on: true, hours_before: 1, before_on: true, after: '16:00', after_on: true },
    daily: { enabled: true, time: '07:00', days_ahead: 7, channel: null, post_when_empty: false },
    templates: { hearing_alert: '📅 *{{bill}}* · {{position}}{{priority}}{{owner}}\n{{title}}\n{{committee}} hearing · {{hearing}} · {{room}}\nWritten testimony due *{{deadline}}*\n<{{tracker}}|Open in tracker> · <{{pdf}}|Notice PDF>',
      draft_thread: '📝 Draft ready{{owner_for}}: <{{draft}}|Google Doc> · <{{tracker}}|tracker>' } };
  const sc = snapshotScenario(snap);
  // Between sessions (&season=off): the imagined end of 2026, as pub/core.js has it. Anything still moving stops, except
  // strongly supported bills that got far, which become law, so Today's "how the session ended" has laws to show.
  if (DEMO_OFF) { let n = 100; for (const b of sc.bills) if (!['dead', 'enacted', 'vetoed'].includes(b.stage)) {
    if (b.position === 'strongly_support' && ['conference', 'second_decking', 'second_floor', 'second_crossover', 'governor'].includes(b.stage)) { b.stage = 'enacted'; b.last_action = `Act ${n++}, on 07/01/2026`; }
    else { b.stage = 'dead'; b.died_deadline ||= 'Sine die'; } } }
  S.bills = sc.bills; S.hearings = sc.hearings; S.pulse = sc.pulse;
  S.committees = Object.fromEntries(snap.committees.map(c => [c.code, c]));
  // A testimony draft on the soonest upcoming hearing, so the drawer section
  // and the Desk link have something to show in the sandbox.
  // Seeded on the first bill (same one the To do seed uses) so the drawer
  // always has a Testimony section to show; the committee is that bill's
  // soonest hearing if it has one, so the Desk link appears too when that
  // hearing is inside the 48-hour window.
  S.drafts = {};
  // Drafts exist only for an actionable position, as live: sync/testimony.js never makes one for Monitor (R-022).
  const ACTIONABLE = ['strongly_support', 'strongly_oppose', 'support', 'support_amend', 'oppose', 'neutral'];
  const heardSoon = b => sc.hearings.some(h => h.bill_id === b.id && new Date(h.scheduled_at) > Date.now());
  const positioned = S.bills.filter(b => b.stage !== 'dead' && ACTIONABLE.includes(b.position));
  // The one in review (Approve / Request changes) sits on a bill with a position; when "as" has no P1 bill with a
  // hearing ahead it used to fall back to the first bill of all, a Monitor one ("HIPHI only monitors this bill").
  // v4 (R-269, R-267 #13): seeded around Nate, not around whoever is practising, so every teammate sees the same drafts
  // (one bill read "sent back" to Patti and "Make the draft now" to Lauren, and people practising together disagreed).
  const SEED = byIni.NT || S.me.id;
  // R-336 V33 (fair to a cold test): the seeded drafts' sent, approved and filed times are set on the practice week, from
  // the practice day's 9:00 AM start (Mon 16 Mar 2026), not from the clock: "Filed by Patti today 7:00 AM" on Monday read
  // "today 6:00 AM" with the clock moved to Tuesday, while Testimony › Filed said Mon 3/16. With a clock set early, a time
  // stays in the past (never later than five minutes ago); outside the practice weeks (the prep day, the opening weeks)
  // they count back from the clock as before.
  const T0 = new Date('2026-03-16T09:00:00-10:00').getTime(), inWeek = Math.abs(Date.now() - T0) < 21 * 864e5;
  const seedAt = x => new Date(inWeek ? Math.min(T0 - x * 36e5, Date.now() - 5 * 6e4) : Date.now() - x * 36e5).toISOString();
  const anchor = positioned.find(b => b.priority === 1 && (sc.assignments[b.id] || []).includes(SEED) && heardSoon(b))
    || positioned.find(heardSoon) || positioned[0] || S.bills[0];
  if (anchor && !DEMO_OFF) {   // between sessions nothing is in review
    const b0 = anchor;
    // Its next hearing: the earliest of all was often one already past, so the card said "No hearing is scheduled".
    const h0 = sc.hearings.filter(h => h.bill_id === b0.id && new Date(h.scheduled_at) > Date.now())
      .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at))[0];
    // In review, from Kevin: the admin (you, in demo) gets Approve / Request changes.
    S.drafts[b0.id] = [{ id: 'dd1', bill_id: b0.id, committee: h0 ? h0.committee : (b0.committee || 'FIN'), hearing_id: h0?.id || null,
      status: 'review', submitted_by: byIni.KV, submitted_at: seedAt(3),
      doc_url: 'https://docs.google.com/document/d/demo/edit', created_at: new Date().toISOString(),
      // written for the bill as it stands, as the live job stamps it (without it the card said both "written for the
      // introduced bill" and "the bill is now the bill as introduced" beside the HD1 it started from)
      version: b0.current_version || null }];
  }
  // And one per hearing in the coming week on a bill with a position, as the live job does: sync/testimony.js makes
  // drafts only for an actionable position, never for Monitor (the sandbox used to seed every hearing, which made
  // Today look twice as busy as live; R-022). Each draft is the bill owner's, and returned drafts carry different
  // notes, as real reviews would.
  const NOTES = ['Cite the 2024 BRFSS numbers in paragraph two.', 'Lead with the fiscal note; the chair asked for it.',
    'Name the two amendments we want in the first paragraph.', 'Shorten it to one page and list the coalition sign-ons.'];
  // R-316 W38 (C-18): each draft's state comes from its hearing's id, so it holds when the practice clock moves (it used to
  // cycle over the week's hearings in order, and moving the clock a day changed every bill's state). The approved one of
  // Nate's is his first hearing after the practice day's 9:00 AM start, whatever the clock now says.
  const hidSeed = id => [...String(id)].reduce((x, ch) => (x * 31 + ch.charCodeAt(0)) >>> 0, 7);
  const BASE_ASOF = new Date('2026-03-16T09:00:00-10:00').getTime();
  const natesFirst = sc.hearings.filter(h => h.status !== 'cancelled' && new Date(h.scheduled_at) > BASE_ASOF && (sc.assignments[h.bill_id] || []).includes(SEED)
      && ACTIONABLE.includes(S.bills.find(b => b.id === h.bill_id)?.position) && !(S.drafts[h.bill_id] || []).some(d => d.committee === h.committee))
    .sort((x, y) => x.scheduled_at.localeCompare(y.scheduled_at))[0];
  let n = 2;
  // R-316 W24 (G1-1): never for a cancelled sitting, as the live draft job (sync/testimony.js makes drafts for scheduled ones only).
  for (const h of sc.hearings.filter(h => h.status !== 'cancelled' && new Date(h.scheduled_at) > new Date()
      && new Date(h.scheduled_at) - Date.now() < 7 * 864e5)) {
    const hb = S.bills.find(b => b.id === h.bill_id);
    if (!hb || !ACTIONABLE.includes(hb.position)) continue;
    if ((S.drafts[h.bill_id] || []).some(d => d.committee === h.committee)) continue;
    const owner = (sc.assignments[h.bill_id] || [])[0] || null;
    // Spread over the workflow states so every button shows up somewhere.
    const hs = hidSeed(h.id);
    let st = ['filed', 'second_review', 'draft', 'approved'][hs % 4];
    // The Desk opens on "my bills", so one of Nate's has the approved-not-filed state: the button training should practise.
    if (h === natesFirst) st = 'approved';
    const ago = seedAt;
    (S.drafts[h.bill_id] ??= []).push({ id: 'dd' + n++, bill_id: h.bill_id, committee: h.committee, hearing_id: h.id,   // as the live job links it
      status: st, doc_url: 'https://docs.google.com/document/d/demo' + n + '/edit',
      // W38: a sent-back draft was sent by someone (its owner here), as live
      created_at: ago(30), submitted_by: owner, submitted_at: st === 'draft' ? null : ago(20),
      approved_by: ['approved', 'filed', 'second_review'].includes(st) ? byIni.NT : null, approved_at: ago(10),
      second_approved_by: st === 'filed' ? byIni.JS : null, second_approved_at: ago(6),
      filed_by: st === 'filed' ? owner : null, filed_at: st === 'filed' ? ago(2) : null,
      version: S.bills.find(b => b.id === h.bill_id)?.current_version || null,
      review_note: st === 'draft' ? NOTES[(hs >>> 2) % NOTES.length] : null });
  }
  // Staff v6 (R-336, BILL's 1:12 PM finding): with the clock moved past the practice day's start (&asof), the sittings
  // between that start and the clock had no draft at all, so a hearing that had just begun lost its testimony and the
  // "Did we file?" card (V25) could never show in practice. They get theirs here, as the live job would have made them:
  // a sitting under three hours old keeps its seeded state (an unfiled one asks "Did we file?"), an older one was filed
  // on time. Their ids ('dp') are their own, so the week's seeded ids above never move.
  { let k = 1; const nowT = Date.now();
    if (nowT > BASE_ASOF) for (const h of sc.hearings.filter(h => h.status !== 'cancelled' && new Date(h.scheduled_at) > BASE_ASOF && new Date(h.scheduled_at) <= nowT)) {
      const hb = S.bills.find(b => b.id === h.bill_id);
      if (!hb || !ACTIONABLE.includes(hb.position) || (S.drafts[h.bill_id] || []).some(d => d.committee === h.committee)) continue;
      const owner = (sc.assignments[h.bill_id] || [])[0] || null, at = new Date(h.scheduled_at).getTime(), ago = x => new Date(Math.min(nowT, at) - x * 36e5).toISOString();
      // the same state the week's loop gives it at the practice day's start (Nate's first stays approved, W38 C-18)
      const st = nowT - at < 3 * 36e5 ? (h === natesFirst ? 'approved' : ['filed', 'second_review', 'draft', 'approved'][hidSeed(h.id) % 4]) : 'filed';
      (S.drafts[h.bill_id] ??= []).push({ id: 'dp' + k++, bill_id: h.bill_id, committee: h.committee, hearing_id: h.id, status: st,
        doc_url: 'https://docs.google.com/document/d/demo-p' + k + '/edit', created_at: ago(40), submitted_by: owner, submitted_at: st === 'draft' ? null : ago(30),
        approved_by: ['approved', 'filed', 'second_review'].includes(st) ? byIni.NT : null, approved_at: ago(20),
        second_approved_by: st === 'filed' ? byIni.JS : null, second_approved_at: ago(18),
        filed_by: st === 'filed' ? owner : null, filed_at: st === 'filed' ? ago(16) : null,
        version: hb.current_version || null, review_note: st === 'draft' ? NOTES[(hidSeed(h.id) >>> 2) % NOTES.length] : null });
    } }
  // Drafts that already existed on the sandbox's day (R-027): filed, on the earlier hearings where HIPHI really filed
  // testimony in 2026 (tools/build_snapshot.js), so the Testimony tab has a history to show. A bill and committee that
  // already has a seeded draft keeps it: one Doc per bill and committee, as live.
  for (const d of snap.drafts || []) if (!(S.drafts[d.bill_id] || []).some(x => x.committee === d.committee)) (S.drafts[d.bill_id] ??= []).push({ ...d });
  S.draftHearings = { ...(snap.draftHearings || {}) };
  // As the live job does since R-148: an open draft on a bill HIPHI already testified on for another committee started
  // from that testimony (sync/testimony.js), so the sandbox's card shows "Started from HIPHI's ... testimony".
  for (const list of Object.values(S.drafts)) for (const d of list) {
    if (['filed', 'cancelled'].includes(d.status) || d.from_draft_id) continue;
    const src = list.filter(x => x !== d && x.committee !== d.committee && ['filed', 'approved'].includes(x.status)).sort((x, y) => String(y.filed_at || y.approved_at || '').localeCompare(String(x.filed_at || x.approved_at || '')))[0];
    if (src) d.from_draft_id = src.id;
  }
  S.assignments = sc.assignments; S.billCampaigns = sc.billCampaigns;
  // Each issue's owner, the way tools/propose_issue_owners.js picks it live (R-088): whoever owns most of its bills, else
  // the admin. The snapshot is public, so it carries no owners, goals or points of its own.
  for (const i of S.issues) { const n = {}; for (const x of S.billIssues) if (x.issue_id === i.id) for (const a of sc.assignments[x.bill_id] || []) n[a] = (n[a] || 0) + 1;
    i.owner_id ??= Object.entries(n).sort((a, b) => b[1] - a[1])[0]?.[0] || S.me.id; }
  // Two issues someone else owns, each with a hearing ahead, with this person as a helper, so the sandbox's My issues shows "You help on it" (R-263).
  // Between sessions no hearing is ahead, so any two (R-316 W4: a helper's Today shows the prep they help with).
  S.issueHelpers = S.issues.filter(i => i.owner_id !== S.me.id && (DEMO_OFF || S.billIssues.some(x => x.issue_id === i.id && (S.hearings || []).some(h => h.bill_id === x.bill_id && h.status === 'scheduled' && new Date(h.scheduled_at) > new Date(DEMO_ASOF))))).sort((x, y) => x.name.localeCompare(y.name)).slice(0, 2)
    .map(i => ({ issue_id: i.id, advocate_id: S.me.id, added_by: i.owner_id, added_at: '2026-10-01T00:00:00Z' }));
  // Versions and outcomes are in the snapshot; one follow and one attendance
  // are seeded so those panels have something to show.
  S.follows = new Set(); S.mutes = new Set(); S.followersBy = {}; S.attend = {}; S.outcomes = Object.fromEntries(snap.outcomes.map(o => [o.hearing_id, o]));
  // Sample public response for the sandbox (R-117): made up from each bill's id, as the public sandbox's follower counts are.
  { const seed = id => [...id].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);
    S.pubCounts = Object.fromEntries(snap.bills.filter(b => b.position && b.position !== 'monitor').map(b => { const s = seed(b.id);
      // R-316 W45: as live (089), actions count only from 10 people, so a bill with fewer shows none here either.
      const people = b.priority === 1 ? 10 + s % 20 : s % 9, act = people >= 10;
      return [b.id, { followers: b.priority === 1 ? 12 + s % 40 : s % 9, emails: act ? 3 + s % 5 : 0, testimonies: act ? 2 + s % 7 : 0, attending: act ? s % 3 : 0, shares: act ? 1 + s % 4 : 0, people }]; })); }
  S.demoTriaged = new Set();
  // Sandbox inbox: messages from others, the seeded workflow, and official actions on my bills.
  // A message reaches the bill's owners and followers, anyone who wrote on it lately, and anyone @mentioned, as the
  // live trigger does (queue_message_dms); the sandbox used to hand every message to everyone (R-022).
  S.buildDemoInbox = () => { const mineIds = new Set(S.bills.filter(isMine).map(b => b.id)); const out = [];
    const first = (S.me.full_name || '').split(' ')[0];
    const named = body => new RegExp('@(' + S.me.initials + (first ? '|' + first.replace(/[^\w]/g, '') : '') + ')\\b', 'i').test(body || '');
    for (const [bid, list] of Object.entries(S.messages || {})) for (const m of list) if (m.advocate_id !== S.me.id
      && (mineIds.has(bid) || list.some(x => x.advocate_id === S.me.id) || named(m.body))) out.push({ key: 'm:' + m.id, kind: 'message', direct: true, priority: S.bills.find(b => b.id === bid)?.priority, bill_id: bid, bill_number: S.bills.find(b => b.id === bid)?.bill_number, title: (advocate(m.advocate_id)?.full_name || 'Someone') + ' wrote', body: m.body, at: m.created_at, tab: 'chat', unread: true });
    for (const d of Object.values(S.drafts).flat()) { const b = S.bills.find(x => x.id === d.bill_id); if (!b) continue;
      if (d.status === 'review' && (S.me?.is_admin || S.me?.can_approve) && d.submitted_by !== S.me.id) out.push({ key: 'n:' + d.id, kind: 'testimony', direct: true, priority: b.priority, bill_id: b.id, bill_number: b.bill_number, title: `${advocate(d.submitted_by)?.full_name || 'Someone'} submitted testimony for your approval`, body: `${d.committee} hearing`, at: d.submitted_at || d.created_at, tab: 'details', unread: true });
      // R-316 W38 (A-15): the deadline reminder the tracker really sends an owner (queue_deadline_reminders, its words),
      // for their open testimony due within a day, so the practice Inbox shows the alerts staff will get.
      const dh = (S.hearings || []).find(h => h.id === d.hearing_id), dueAt = dh && (dh.testimony_deadline ? new Date(dh.testimony_deadline).getTime() : new Date(dh.scheduled_at).getTime() - 864e5);
      if (dh && dh.status !== 'cancelled' && !['filed', 'cancelled'].includes(d.status) && (S.assignments[b.id] || [])[0] === S.me.id && dueAt > Date.now() && dueAt - Date.now() < 864e5) {
        const hrs = Math.max(1, Math.round((dueAt - Date.now()) / 36e5));
        out.push({ key: 'n:dl' + d.id, kind: 'deadline', direct: true, priority: b.priority, bill_id: b.id, bill_number: b.bill_number, title: `Testimony due in ${hrs} hour${hrs === 1 ? '' : 's'} (${fmtDT(new Date(dueAt).toISOString())}) · ${d.committee}`, body: 'The reminder the tracker sends you in Slack before a testimony deadline.', at: new Date(Date.now() - 36e5).toISOString(), unread: true }); }
      // R-316 W38 (C-18, A-15): as live (migration 154), "sent back" reaches only the person who sent the draft.
      if (d.status === 'draft' && d.review_note && (d.submitted_by ? d.submitted_by === S.me.id : (S.assignments[b.id] || [])[0] === S.me.id)) out.push({ key: 'n:r' + d.id, kind: 'testimony', direct: true, priority: b.priority, bill_id: b.id, bill_number: b.bill_number, title: 'Your testimony was sent back', body: d.review_note, at: d.approved_at || d.created_at, tab: 'details', unread: true }); }
    for (const a of DEMO_TL) { const ab = S.bills.find(b => b.id === a.bill_id); if (!ab || (ab.position === 'monitor' && !S.follows.has(ab.id))) continue;
      if (mineIds.has(a.bill_id) && Date.now() - new Date(a.occurred_at) < 30 * 864e5 && a.source === 'auto') out.push({ key: 'a:' + a.bill_id + a.occurred_at + a.title.slice(0, 12), direct: false, priority: ab.priority, kind: /hearing|decision making|briefing/i.test(a.title) ? 'hearing' : 'status', bill_id: a.bill_id, bill_number: S.bills.find(b => b.id === a.bill_id)?.bill_number, title: a.title, body: a.details, at: a.occurred_at, tab: 'timeline', unread: Date.now() - new Date(a.occurred_at) < 7 * 864e5 }); }
    return out.sort((x, y) => String(y.at).localeCompare(String(x.at))).slice(0, 200); };
  S.messages = {}; S.chatSeen = {};
  if (anchor) { const kv = byIni.KV || S.advocates[1]?.id, ago = h => new Date(Date.now() - h * 36e5).toISOString();
    S.messages[anchor.id] = [
      { id: 'dm1', bill_id: anchor.id, advocate_id: kv, body: 'Chair’s office says they want the amended language before the hearing — can we get the CTFH letter attached to the draft?', created_at: ago(26) },
      { id: 'dm2', bill_id: anchor.id, advocate_id: S.me.id, body: 'Yes. @Kevin add it to the Doc and I’ll approve tonight.', created_at: ago(25) },
      { id: 'dm3', bill_id: anchor.id, advocate_id: kv, body: 'Done. Also SB2201 has the same section, worth a look.', created_at: ago(2) } ]; }
  const nowMs = Date.now();
  const upcoming = S.hearings.filter(h => new Date(h.scheduled_at) > nowMs && h.status !== 'cancelled').sort((x, y) => x.scheduled_at.localeCompare(y.scheduled_at));
  // R-336 V33: the one person going is on the practice week's first sitting from the practice day's 9:00 AM start, wherever
  // the clock is (the same sitting read "Going: Jaylen" at 8:00 and "Going: no one yet" at 9:45).
  { const first = inWeek ? S.hearings.filter(h => new Date(h.scheduled_at).getTime() >= T0 && h.status !== 'cancelled').sort((x, y) => x.scheduled_at.localeCompare(y.scheduled_at))[0] : upcoming[0];
    if (first && S.advocates[1]) S.attend[first.id] = [S.advocates[1].id]; }
  // ...and a short thread on this week's first hearing, so the unread chip shows on the home page.
  const vis = upcoming.find(h => { const b = S.bills.find(x => x.id === h.bill_id); return b && b.position && b.position !== 'monitor'; });
  if (vis && !S.messages[vis.bill_id]) { const kv = byIni.KV || S.advocates[1]?.id;
    S.messages[vis.bill_id] = [{ id: 'dm4', bill_id: vis.bill_id, advocate_id: kv, body: 'Heads up: the chair asked for testimony to lead with the fiscal note. Who is attending?', created_at: new Date(nowMs - 5 * 36e5).toISOString() }]; }
  const unowned = S.bills.find(b => b.tracked && b.position && b.position !== 'monitor' && !(S.assignments[b.id] || []).length);
  if (unowned && S.me) { S.followersBy[unowned.id] = [S.me.id]; S.follows.add(unowned.id); }
  // Seed the To do section so the sandbox shows all three states: overdue,
  // upcoming, and finished.
  const day = n => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
  S.todos = {};
  // Strongly supported bills get an email-blast task per scheduled hearing (the database adds it live, migration 027b).
  for (const h of S.hearings) { const b = S.bills.find(x => x.id === h.bill_id); if (!b || b.position !== 'strongly_support' || h.status !== 'scheduled' || new Date(h.scheduled_at) <= Date.now()) continue;
    // As the database makes it (email_blast_todo_for_hearing): the words follow the email switch (paused here), and it is due in time
    // to reach people, the notice day or twelve hours before testimony closes, whichever is earlier, never before today (R-152 D;
    // the sandbox still used the timing from before R-116: the day before the hearing).
    const dt = new Date(h.scheduled_at), hd = ms => new Date(ms).toLocaleDateString('en-CA', { timeZone: 'Pacific/Honolulu' }), m = dt.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', timeZone: 'Pacific/Honolulu' });
    const title = `${S.emailCfg?.enabled === false ? 'Send the ask to HIPHI’s list and partners for the' : 'Send an email blast for the'} ${h.committee} hearing ${m}`;
    const early = [hd(+new Date(h.notice_posted_at || Date.now()) + 4 * 36e5), hd(+new Date(h.testimony_deadline || dt - 864e5) - 12 * 36e5)].sort()[0], today = hd(Date.now()), due = early > today ? early : today;
    (S.todos[b.id] ??= []).push({ id: 'eb' + h.id, bill_id: b.id, title, done: false, due_date: due, assignee_id: (S.assignments[b.id] || [])[0] || null, sort_order: -1, created_at: new Date().toISOString() }); }
  if (anchor) S.todos[anchor.id] = (S.todos[anchor.id] || []).concat([
    // v4 (R-269): a task that does not contradict the bill's own testimony, which is in review (this one read "Draft testimony
    // for the next hearing" beside Kevin's draft waiting for approval, and Nate's Slipping list led with it).
    { id: 'td1', bill_id: anchor.id, title: 'Ask the chair\u2019s office for a meeting before the hearing',
      done: false, due_date: day(-2), assignee_id: S.advocates[0].id, sort_order: 0,
      created_at: new Date().toISOString() },
    { id: 'td2', bill_id: anchor.id, title: 'Confirm coalition sign-ons',
      done: false, due_date: day(4), assignee_id: S.advocates[1].id, sort_order: 1,
      created_at: new Date().toISOString() },
    { id: 'td3', bill_id: anchor.id, title: 'Send one-pager to committee staff',
      done: true, due_date: null, assignee_id: S.advocates[2].id, sort_order: 2,
      created_at: new Date().toISOString() },
  ]);
  // R-316 W38 (FD-16): at 9:00 on the practice day a committee's result from its 1:10 PM hearing is not known yet. The
  // snapshot stamps the Capitol's actions 8:00 AM, so such a result (and any outcome of a hearing still ahead) is left out
  // here. Since 21 Oct the snapshot leaves such a result out of the bill's own stage too (backend tools/snapshot_rewind.js);
  // this still matters when the walk tool moves the clock (&asof).
  const hday = t => new Date(t).toLocaleDateString('en-CA', { timeZone: 'Pacific/Honolulu' }), nowD = hday(Date.now());
  const ahead = S.hearings.filter(h => h.status !== 'cancelled' && new Date(h.scheduled_at) > Date.now());
  for (const h of ahead) delete S.outcomes[h.id];
  const leak = e => /recommend|deferred|passed/i.test(e.title || '') && ahead.some(h => h.bill_id === e.bill_id && hday(h.scheduled_at) === nowD && hday(e.occurred_at) === nowD
    && String(h.committee).split(/[\/,\s]+/).some(c => c && String(e.title).includes(c)));
  sc.tl = sc.tl.filter(e => !leak(e)); sc.since = sc.since.filter(e => !leak(e));
  S.compStage = sc.compStage; DEMO_TL = sc.tl;
  await seedV6(byIni);   // R-336 V33: Patti, Julie and the chair asks (Staff v6's practice copy only)
  // R-316 W38: what was changed in this tab before a person switch (savePractice), back on top of the seeds.
  if (PRACTICE) {
    for (const k of ['drafts', 'todos', 'attend', 'messages', 'followersBy', 'assignments', 'billCampaigns', 'demoNotes', 'legProfiles']) if (PRACTICE[k]) S[k] = PRACTICE[k];   // R-335: legislators' profiles (a store from before has none)
    for (const b of S.bills) Object.assign(b, PRACTICE.bills?.[b.id] || {});
    DEMO_TL = [...(PRACTICE.tl || []), ...DEMO_TL.filter(t => t.source === 'auto')].sort((x, y) => String(y.occurred_at).localeCompare(String(x.occurred_at)));
    S.follows = new Set(Object.entries(S.followersBy).filter(([, ids]) => ids.includes(S.me.id)).map(([id]) => id));
    S.legNotes = {}; S.convCache = {};
    S.noDraftSeeded = true;   // the kept drafts already have the "Make the draft now" hearings without a draft (app.js sandboxExtras)
    if (PRACTICE.partners) S.pDemo = PRACTICE.partners;   // R-328 B: the sample partner's groups, people and words as practised
  }
  if (DEMO) addEventListener('pagehide', savePractice);
  S.feed = DEMO_TL.filter(t => t.source === 'team');
  S.sinceVisit = Date.now() - 3*864e5;
  S.sinceEvents = sc.since;
  // Sandbox: the scripted "since" events double as the last-72-hours feed.
  S.recentEvents = [...sc.since.map(e => ({ ...e, source: 'auto', type: 'status_auto' })), ...DEMO_TL]
    .filter(e => e.occurred_at).sort((a, b) => String(b.occurred_at).localeCompare(String(a.occurred_at)));
  S.session = { user: { email: 'nate@hiphi.org' } };
  // Between sessions the seeds above would be March's work, 184 days overdue: no chat, to-dos or follow-ups.
  if (DEMO_OFF) { S.messages = {}; S.todos = {}; S.followups = []; }
  S.inbox = S.buildDemoInbox();
}

// ---- Staff v6 (R-336, V33, spec section 6): a practice copy fair to a cold test with Kris, Patti and Julie ----
// Practice only: demoInit runs only with ?demo=1, so none of this reaches live mode, and demo/snapshot.json (which the
// other apps read) is not touched. Patti (PH) and Julie (JMM) are added above, once (the walk tool may have added them
// to the snapshot already; the initials check finds them and adds nothing). Here:
//   - Patti writes on Lauren's HEAL bills: this week's testimony on them that was sent for approval was sent by her, so
//     she revises what comes back and files what is approved (model.js filerOf); a draft not sent yet is hers and
//     Lauren's (steps.js writersOf: a coalition's helpers write its drafts with the owner, W6 without a migration).
//   - Julie helps Rick on HIAPA, and Patti Lauren: each a helper on two of the owner's issues.
//   - A non-admin partner approver: Jess, already (R-328: "only Nate and Jess" approve partner words, Nate 10/22).
//   - Three chair asks, so each state of Hearings > Get hearings can be practised: one "will schedule" (Lauren's), one
//     asked 4 working days ago with no reply (Kevin's, so he is due a Follow up), one handed to Kris (Rick's).
// Between sessions and on the opening day nothing waits for a hearing, so none are seeded there.
async function seedV6(byIni) {
  if (DEMO_OFF || DEMO_OPENING) return;
  const M = await import('./model.js');   // model.js imports this file, so it is read when the seeds run, not at load
  const { PH: ph, JMM: jmm, LR: lr, RK: rk, KV: kv, KR: kr } = byIni;
  const coal = n => S.campaigns.find(c => c.name === n)?.id, heal = coal('HEAL');
  const ownerOf = b => (S.assignments[b.id] || [])[0] || null;
  if (ph && lr && heal) for (const d of Object.values(S.drafts).flat()) {
    const b = S.bills.find(x => x.id === d.bill_id);
    if (!b || ownerOf(b) !== lr || !(S.billCampaigns[b.id] || []).includes(heal) || !/^dd\d+$/.test(String(d.id))) continue;   // this week's seeds, not 2026's real filings
    if (d.submitted_by) d.submitted_by = ph;
    if (d.status === 'filed' && d.filed_by) d.filed_by = ph;
  }
  const helps = (who, owner) => !who || !owner ? [] : S.issues.filter(i => i.owner_id === owner && !i.archived_at).sort((x, y) => x.name.localeCompare(y.name)).slice(0, 2)
    .map(i => ({ issue_id: i.id, advocate_id: who, added_by: owner, added_at: '2026-10-01T00:00:00Z' }));
  S.issueHelpers = [...(S.issueHelpers || []), ...helps(jmm, rk), ...helps(ph, lr)];
  // Bills waiting for a hearing whose chair is known, top priority first, then the soonest deadline.
  const waiting = S.bills.filter(b => M.wantsHearing(b) && !M.diedish(b) && !M.hearingAhead(b) && ownerOf(b)).map(b => ({ b, st: M.stopOf(b) }))
    .filter(x => x.st.phase === 'committee' && x.st.column === 'a' && x.st.committee && x.st.deadline && !x.st.deadline.missed && M.chairIdsOf(x.st.committee).length)
    .sort((x, y) => (x.b.priority || 9) - (y.b.priority || 9) || x.st.deadline.date.localeCompare(y.st.deadline.date) || x.b.bill_number.localeCompare(y.b.bill_number, 'en', { numeric: true }));
  const used = new Set(), pick = who => { const x = waiting.find(y => !used.has(y.b.id) && ownerOf(y.b) === who) || waiting.find(y => !used.has(y.b.id)); if (x) used.add(x.b.id); return x; };
  const hday = t => new Date(t).toLocaleDateString('en-CA', { timeZone: 'Pacific/Honolulu' });
  const ago = days => new Date(Date.now() - days * 864e5).toISOString();
  // N working days back (weekends skipped), at the same time of day.
  const workAgo = n => { let t = Date.now(), k = 0; while (k < n) { t -= 864e5; const dow = new Date(hday(t) + 'T12:00:00-10:00').getUTCDay(); if (dow !== 0 && dow !== 6) k++; } return new Date(t).toISOString(); };
  // One row per chair, as recordAsk saves it (chairask.js), with the words its sentence() writes.
  const ask = (x, by, answer, at, words) => M.chairIdsOf(x.st.committee).map(id => ({ id: `v6ask-${x.b.id}-${id}-${answer}`, legislator_id: id, bill_id: x.b.id, advocate_id: by,
    body: words, answer, committee: x.st.committee, issue_id: null, met_on: null, conversation_id: null, created_at: at }));
  const notes = [], said = x => `${x.b.bill_number} (${x.st.committee})`;
  const w = pick(lr); if (w) notes.push(...ask(w, ownerOf(w.b), 'asked', workAgo(3), `Asked for a hearing on ${said(w)}.`),
    ...ask(w, ownerOf(w.b), 'will_schedule', workAgo(2), `${M.chairMail(w.st.committee)?.who || 'The chair'} will schedule a hearing on ${said(w)}.`));
  const q = pick(kv); if (q) notes.push(...ask(q, ownerOf(q.b), 'asked', workAgo(4), `Asked for a hearing on ${said(q)}.`));
  S.demoNotes = [...notes, ...(S.demoNotes || [])];
  const g = pick(rk);
  if (g && kr) { const m = M.chairMail(g.st.committee), aw = M.askWords(g.st);   // the to-do push.js assignAsk makes (W14)
    (S.todos[g.b.id] ??= []).push({ id: 'v6give-' + g.b.id, bill_id: g.b.id, title: `Ask ${m ? m.who : 'the chair'} for a hearing on ${said(g)}`, done: false,
      due_date: aw && !aw.a.passed ? hday(aw.a.at) : null, assignee_id: kr, sort_order: 0, created_at: ago(1) }); }
}

// ---- partners (R-328 batch B): who may, the link name, and the sandbox's sample group ----
const pApprover = () => !!S.me && S.me.is_active !== false && !!S.me.approves_partners;
const pAdmitter = () => !!S.me && S.me.is_active !== false && (!!S.me.is_admin || !!S.me.approves_partners);
// A refusal in the database's own words, as 184's functions raise them (ui.js friendly() shows a P0001 as it is).
const pErr = m => Object.assign(new Error(m), { code: 'P0001' });
// The ?via= name a group's name makes, as the database's partner_slugify(name, 40) does: lower case, kahakō vowels as
// their plain letter, the ʻokina and straight apostrophes dropped, anything else between words a dash.
export const partnerSlug = s => String(s || '').toLowerCase().replace(/[āēīōū]/g, c => ({ ā: 'a', ē: 'e', ī: 'i', ō: 'o', ū: 'u' })[c])
  .replace(/[ʻ']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40);
// Nate's sample (brief of 22 Oct): Keiki Smiles Alliance, its lead Leilani K., an edit waiting on a bill HIPHI supports
// (SB 2345, warning labels on sugary drinks), new words on a bill HIPHI has no position on (SB 2073, water fluoridation,
// untracked), an issue of its own, a request to join and a group waiting for approval (added by Jess, so Nate can
// practise Approve; one he adds himself waits for Jess). Times are set from the practice clock when first asked for.
// Where partners stand (issue_partner_positions, 189, R-336 walk 4): three sample rows on the Disposable e-cigarette ban, so
// the issue page's list and its Add, change and remove can be practised. In memory only, like every practice change here.
function demoPositions() {
  if (S.ppDemo) return S.ppDemo;
  const id = x => S.advocates.find(a => a.initials === x)?.id || null, bill = n => S.bills.find(b => b.bill_number === n)?.id || null;
  const iss = '66a32660-b0a7-4a90-a71f-231963619b44', at = d => `${d}T10:00:00-10:00`;
  return S.ppDemo = [
    { id: 'aaaaaaaa-0000-4000-8000-0000000c0001', issue_id: iss, partner_name: 'American Heart Association', stance: 'support', source: 'staff', session_year: 2026, bill_id: null,
      note: 'Will send a member to the Senate hearing.', set_by: id('KV'), set_at: at('2026-03-02') },
    { id: 'aaaaaaaa-0000-4000-8000-0000000c0002', issue_id: iss, partner_name: 'American Lung Association', stance: 'support', source: 'testimony', session_year: 2026, bill_id: bill('HB2121'),
      note: null, set_by: id('KV'), set_at: at('2026-03-03') },
    { id: 'aaaaaaaa-0000-4000-8000-0000000c0003', issue_id: iss, partner_name: 'Island Convenience Retailers', stance: 'oppose', source: 'testimony', session_year: 2026, bill_id: bill('SB2175'),
      note: 'Says a ban costs small stores; asks for a later start date.', set_by: id('NT'), set_at: at('2026-02-27') },
  ];
}
const KS = 'keiki-smiles';   // the same slug as the public practice copy's sample group (pub/partners.js), so ?via= links match
function demoPartners() {
  if (S.pDemo) return S.pDemo;
  const id = x => S.advocates.find(a => a.initials === x)?.id || null, nate = id('NT'), jess = id('JS');
  const ago = m => new Date(Date.now() - m * 60e3).toISOString(), days = n => ago(n * 1440);
  const inDays = n => new Date(Date.now() + n * 864e5).toLocaleDateString('en-CA', { timeZone: 'Pacific/Honolulu' });
  const b1 = S.bills.find(b => b.bill_number === 'SB2345') || S.bills.find(b => b.is_public && b.position === 'support');
  const b2 = (S.snapshot?.index || []).find(b => b.bill_number === 'SB2073') || (S.snapshot?.index || []).find(b => /^SB\d+$/.test(b.bill_number));
  const iss = (S.issues || []).find(i => i.slug === 'sugary-drink-warning-labels'), own = 'aaaaaaaa-0000-4000-8000-0000000b0001';
  const live = { id: 'aaaaaaaa-0000-4000-8000-0000000b0010', state: 'live', side: 'support', nickname: 'Warning labels on sugary drinks',
    summary: 'Puts warning labels on high-sugar drinks from July 2027, so families see the risk before they buy.',
    points: ['Sugary drinks are a leading cause of tooth decay in keiki.', 'A label at the shelf reaches parents when they choose a drink.', 'Labels cost stores little and need no new staff.'],
    ask: null, ask_until: null, draft_version: null, draft_note: null, issue_ids: iss ? [iss.id] : [], written_at: days(15), sent_at: days(15), reviewed_at: days(14), review_note: null };
  const edit = { ...live, id: 'aaaaaaaa-0000-4000-8000-0000000b0011', state: 'sent', reviewed_at: null,
    summary: 'Puts warning labels on high-sugar drinks from July 2027, so families see the risk to keiki teeth before they buy.',
    points: ['Sugary drinks are a leading cause of tooth decay in keiki.', 'Tooth decay is one of the most common childhood illnesses in Hawaiʻi.', 'A label at the shelf reaches parents when they choose a drink.', 'Labels cost stores little and need no new staff.'],
    ask: 'Ask your senator to vote yes on SB 2345.', ask_until: inDays(11), issue_ids: [...(iss ? [iss.id] : []), own], written_at: ago(75), sent_at: ago(48) };
  const fresh = { id: 'aaaaaaaa-0000-4000-8000-0000000b0012', state: 'sent', side: 'support', nickname: 'Fluoride in public water',
    summary: 'Has the bigger public water systems add fluoride at the level health experts recommend, which helps keep teeth free of cavities.',
    points: ['Fluoride in water is one of the cheapest ways to prevent tooth decay.', 'Families on every island would get it without an extra trip to the dentist.'],
    // R-328 G: an ask too long for a text (128 characters), so Also by text asks for a line of its own
    ask: b2 ? `Ask the Senate Health and Human Services committee to pass ${b2.bill_number.replace(/^([A-Z]+)(\d)/, '$1 $2')}, so families on every island get fluoride in their tap water.` : null,
    ask_until: b2 ? inDays(9) : null, draft_version: null, draft_note: null, issue_ids: [own], written_at: ago(17 * 60 + 30), sent_at: ago(17 * 60 + 20), reviewed_at: null, review_note: null };
  const base = { partner_slug: KS, partner_name: 'Keiki Smiles Alliance', by: 'Leilani K.' };
  S.pDemo = {
    approvers: [nate, jess].filter(Boolean),
    groups: [
      { slug: KS, name: 'Keiki Smiles Alliance', welcome: 'Aloha, friends of Keiki Smiles Alliance! These are the bills we care about.', website: 'https://example.org', about: 'Oral health for keiki',
        status: 'active', added_by: nate, approved_by: jess, approved_at: days(20), paused_at: null, created_at: days(21) },
      { slug: 'hana-healthy-families', name: 'Hāna Healthy Families', welcome: null, website: 'https://example.net', about: 'Healthy food and drinks for families in East Maui',
        status: 'waiting', added_by: jess, approved_by: null, approved_at: null, paused_at: null, created_at: ago(40) },
    ],
    people: [
      { id: 'aaaaaaaa-0000-4000-8000-0000000b0101', partner_slug: KS, email: 'leilani@example.org', name: 'Leilani K.', role: 'lead', user_id: 'demo', invited_at: days(20), joined_at: days(19), terms_at: days(19), removed_at: null },
      { id: 'aaaaaaaa-0000-4000-8000-0000000b0102', partner_slug: KS, email: 'kawika@example.org', name: 'Kawika M.', role: 'member', user_id: null, invited_at: days(4), joined_at: null, terms_at: null, removed_at: null },
      { id: 'aaaaaaaa-0000-4000-8000-0000000b0103', partner_slug: 'hana-healthy-families', email: 'noelani@example.net', name: 'Noelani P.', role: 'lead', user_id: null, invited_at: ago(38), joined_at: null, terms_at: null, removed_at: null },
    ],
    queue: [
      ...(b1 ? [{ kind: 'bill', ...base, id: edit.id, bill_id: b1.id, bill_number: b1.bill_number, title: b1.title, hiphi_position: b1.position, hiphi_public: b1.is_public, flag: null, words: edit, live }] : []),
      ...(b2 ? [{ kind: 'bill', ...base, id: fresh.id, bill_id: b2.id, bill_number: b2.bill_number, title: b2.title, hiphi_position: null, hiphi_public: false, flag: 'none', words: fresh, live: null }] : []),
      { kind: 'issue', ...base, id: 'aaaaaaaa-0000-4000-8000-0000000b0020', issue_id: own, live: null,
        words: { id: 'aaaaaaaa-0000-4000-8000-0000000b0020', partner_issue_id: own, state: 'sent', name: 'Healthy keiki teeth', description: 'Bills that help keiki keep healthy teeth: fluoride in water, dental checkups and fewer sugary drinks.', stance: 'support', written_at: ago(30), sent_at: ago(25), reviewed_at: null, review_note: null } },
    ],
    issueNames: { [own]: 'Healthy keiki teeth' },
    requests: [{ id: 'aaaaaaaa-0000-4000-8000-0000000b0201', created_at: days(3), group_name: 'Kauaʻi Youth Breathe Easy', website: 'https://example.com', about: 'Youth leaders keeping e-cigarettes away from Kauaʻi teens',
      contact_name: 'Malia S.', contact_email: 'malia@example.com', note: 'We testified on the disposable e-cigarette ban last year and would like to share our talking points.', state: 'new', partner_slug: null }],
    counts: { [KS]: { live: 3, waiting: b1 && b2 ? 2 : 1, changes: 0 } },
    visits: { [KS]: 140 },
  };
  return S.pDemo;
}
// ---- the sample partner's asks (R-328 G): the same rules as 185's partner_ask_on_approve, partner_ask_step and
// partner_ask_json, kept with the sample group (so a person switch keeps them). The practice copy sends nothing.
// Today's date in Honolulu, or `days` from it; the next 4:30 pm there (109's next_daily_email: today's, or tomorrow's once
// it has passed; Hawaiʻi keeps no daylight saving, so -10:00 always).
const hstToday = (days = 0) => new Date(Date.now() + days * 864e5).toLocaleDateString('en-CA', { timeZone: 'Pacific/Honolulu' });
const nextEmail = (t = Date.now()) => { const at = new Date(`${new Date(t).toLocaleDateString('en-CA', { timeZone: 'Pacific/Honolulu' })}T16:30:00-10:00`).getTime(); return new Date(t < at ? at : at + 864e5).toISOString(); };
// Two of Keiki Smiles Alliance's three live bills carry an ask: one Jess approved this morning, going out at 4:30 pm, and
// one Nate took back yesterday before it went (Send again still works: its end date allows).
function demoAsks(d) {
  if (d.asks) return d.asks;
  const id = x => S.advocates.find(a => a.initials === x)?.id || null, ago = m => new Date(Date.now() - m * 60e3).toISOString();
  const row = (n, num, ask, until, extra) => { const b = S.bills.find(x => x.bill_number === num); return b ? [{ id: n, partner_slug: KS, bill_id: b.id, bill_number: b.bill_number,
    words_id: `aaaaaaaa-0000-4000-8000-0000000b00${12 + n}`, ask, ask_until: hstToday(until), also_text: false, text_line: null, approved_by: id('JS'), approved_at: ago(95),
    scheduled_for: nextEmail(), taken_back_at: null, replaced_at: null, sent: 0, ...extra }] : []; };
  d.asks = [
    ...row(1, 'HB2146', 'Ask your representative to vote yes on HB 2146.', 5, {}),
    ...row(2, 'SB2458', 'Thank your senator for voting yes on SB 2458.', 2, { approved_by: id('NT'), approved_at: ago(26 * 60), scheduled_for: nextEmail(Date.now() - 26 * 36e5), taken_back_at: ago(25 * 60) }),
  ];
  return d.asks;
}
// One ask as the team sees it (partner_ask_json): the state in the database's order.
function demoAskJson(d, a) {
  const g = d.groups.find(x => x.slug === a.partner_slug), b = S.bills.find(x => x.id === a.bill_id) || (S.snapshot?.index || []).find(x => x.id === a.bill_id);
  const state = a.replaced_at ? 'replaced' : a.taken_back_at ? 'taken_back' : a.ended || a.ask_until < hstToday() || g?.status !== 'active' ? 'ended'
    : new Date(a.scheduled_for).getTime() > Date.now() ? 'going_out' : 'sending';
  return { id: a.id, partner_slug: a.partner_slug, partner_name: g?.name || a.partner_slug, partner_bill_id: null, bill_id: a.bill_id, bill_number: b?.bill_number || a.bill_number,
    session_year: b?.session_year ?? null, words_id: a.words_id, ask: a.ask, ask_until: a.ask_until, also_text: !!a.also_text, text_line: a.text_line,
    approved_at: a.approved_at, approved_by: S.advocates.find(x => x.id === a.approved_by)?.full_name || null, scheduled_for: a.scheduled_for,
    taken_back_at: a.taken_back_at, replaced_at: a.replaced_at, state, sent: a.sent || 0 };
}
// Also by text and its line, as 185 checks them: a line is 10 to 110 characters, and an ask longer than a text needs one.
function demoTextCheck(a, p) {
  const line = 'text_line' in p ? String(p.text_line ?? '').trim() || null : a.text_line;
  if ('text_line' in p && line && (line.length < 10 || line.length > 110)) throw pErr('The line for the text is 10 to 110 characters');
  const also = 'also_text' in p ? !!p.also_text : !!a.also_text;
  if (also && !line && String(a.ask).trim().length > 110) throw Object.assign(pErr('A text has room for 110 characters: write a shorter line for the text'), { hint: 'text_line' });
  return { also_text: also, text_line: line };
}
// Approving bill words x: an ask on them goes out at the next 4:30 pm; the same ask as the current one keeps its row (it
// goes out once, and a taken-back ask stays taken back); another ask replaces it; no ask, or one already ended, ends it.
function demoAskOnApprove(d, x, p) {
  const w = x.words || {}, asks = demoAsks(d), now = new Date().toISOString();
  const cur = asks.find(a => a.partner_slug === x.partner_slug && a.bill_id === x.bill_id && !a.replaced_at);
  if ('text_line' in p) demoTextCheck({ ask: '' }, { text_line: p.text_line });
  if (!w.ask || !w.ask_until || w.ask_until < hstToday()) { if (cur) cur.replaced_at = now; return null; }
  if (cur && cur.ask === w.ask) return Object.assign(cur, demoTextCheck(cur, p), { words_id: w.id, ask_until: w.ask_until });
  const row = { id: Math.max(0, ...asks.map(a => a.id)) + 1, partner_slug: x.partner_slug, bill_id: x.bill_id, bill_number: x.bill_number, words_id: w.id, ask: w.ask, ask_until: w.ask_until,
    also_text: false, text_line: null, approved_by: S.me?.id || null, approved_at: now, scheduled_for: nextEmail(), taken_back_at: null, replaced_at: null, sent: 0 };
  Object.assign(row, demoTextCheck(row, p));
  if (cur) cur.replaced_at = now;
  asks.push(row); return row;
}

// R-316 W38: keep this tab's practice changes for the next load (a person switch reloads the page with &as=). The team's
// columns on each bill, not the Capitol's; follows are filed under whoever is practising, as each person's own.
const TEAM_COLS = ['tracked', 'position', 'priority', 'stage_override', 'internal_notes', 'is_public', 'public_summary', 'public_action', 'public_action_until', 'nickname'];
export function savePractice() {
  if (!DEMO || S.practiceCleared || !S.bills || !S.me) return;
  const fb = S.followersBy ??= {}, me = S.me.id;
  for (const id of Object.keys(fb)) if (!S.follows?.has(id)) fb[id] = fb[id].filter(x => x !== me);
  for (const id of S.follows || []) if (!(fb[id] ??= []).includes(me)) fb[id].push(me);
  const p = { v: PRACTICE_V, asof: DEMO_ASOF, clock: Date.now(), drafts: S.drafts, todos: S.todos, attend: S.attend, messages: S.messages, followersBy: fb,
    assignments: S.assignments, billCampaigns: S.billCampaigns, demoNotes: S.demoNotes || [], tl: DEMO_TL.filter(t => t.source !== 'auto'), partners: S.pDemo || null, legProfiles: S.legProfiles || null,
    bills: Object.fromEntries(S.bills.map(b => [b.id, Object.fromEntries(TEAM_COLS.map(k => [k, b[k] ?? null]))])) };
  try { sessionStorage.setItem(PRACTICE_KEY, JSON.stringify(p)); } catch { /* a full or blocked store: the next load starts fresh */ }
}
// Start over: the practice day as it began, in this tab. What was there is put aside first, so the toast after the reload
// can offer Undo (a mis-tap on a phone must not wipe a morning's practice; ui-critic, B-5).
export function clearPractice() {
  savePractice(); S.practiceCleared = true;
  try { const p = sessionStorage.getItem(PRACTICE_KEY); if (p) sessionStorage.setItem(PRACTICE_KEY + '_undo', p);
    sessionStorage.removeItem(PRACTICE_KEY); sessionStorage.setItem(PRACTICE_KEY + '_restarted', '1'); } catch { /* nothing kept */ }
}
// Once, on the load after Start over: true, so the page can say so.
export function practiceRestarted() {
  try { const r = sessionStorage.getItem(PRACTICE_KEY + '_restarted'); sessionStorage.removeItem(PRACTICE_KEY + '_restarted'); return !!r; } catch { return false; }
}
export function undoStartOver() {
  S.practiceCleared = true;   // the reload must not save the fresh day over what comes back
  try { const p = sessionStorage.getItem(PRACTICE_KEY + '_undo'); if (p) sessionStorage.setItem(PRACTICE_KEY, p); } catch { /* nothing to put back */ }
}
export const practiceKept = () => !!PRACTICE;

// ---------------- filtering ----------------
// Facets: within a group any selected value matches (P1 or P2); across groups
// every group must match (P1 AND Healthy eating). Flags are yes/no checks.
// Every option shows how many bills it would leave, counted against the other
// groups' selections, so nobody clicks into an empty list. One record of facts
// per bill per render keeps that cheap.
export const isOwner = b => !!S.me && (S.assignments[b.id] || []).includes(S.me.id);
export const isMuted = b => !!S.mutes?.has(b.id);
// Staff own issues and work bills (R-263, Nate 10/12): every bill on an issue someone owns or helps on is theirs too, so it
// is in their Mine, Today and alerts without anyone handing it over bill by bill (helpers too, his word). Worked out from
// the issue's owner and helpers each time, never copied onto the bill, so a new owner or helper takes the bills with them.
// The database's inbox and chat alerts do the same (backend migration 172). Muting a bill still takes it out.
export const myIssueIds = () => {
  if (!S.me) return new Set();
  const help = new Set((S.issueHelpers || []).filter(h => h.advocate_id === S.me.id).map(h => String(h.issue_id)));
  return new Set((S.issues || []).filter(i => !i.archived_at && (i.owner_id === S.me.id || help.has(String(i.id)))).map(i => String(i.id)));
};
// The bills on my issues, worked out once per change: isMine runs for every bill on every render.
let MIB = { sig: '', ids: new Set() };
export const myIssueBills = () => {
  const mine = myIssueIds(), sig = `${S.me?.id}|${(S.billIssues || []).length}|${[...mine].join(',')}`;
  if (sig !== MIB.sig) MIB = { sig, ids: new Set((S.billIssues || []).filter(x => mine.has(String(x.issue_id))).map(x => x.bill_id)) };
  return MIB.ids;
};
export const viaMyIssue = b => !!S.me && myIssueBills().has(b.id);
// The issues of mine a bill is on, by name: what a row says when the bill is mine because of them.
export const myIssuesOf = b => { const mine = myIssueIds(), on = new Set((S.billIssues || []).filter(x => x.bill_id === b.id && mine.has(String(x.issue_id))).map(x => String(x.issue_id)));
  return (S.issues || []).filter(i => on.has(String(i.id))).sort((x, y) => x.name.localeCompare(y.name)); };
export const isMine = b => !!S.me && (isOwner(b) || !!S.follows?.has(b.id) || viaMyIssue(b)) && !isMuted(b);
// The first hearing still ahead, which is what keeps a bill from being muted.
export let SESSION_OVER = DEMO ? DEMO_OFF : true;   // set from the calendar at load: over once sine die has passed
// Official session calendar (LRB, 2026). One place to update each December.
// The sandbox uses the same calendar, frozen at DEMO_ASOF.
// The rows themselves, for the budget bills' own deadlines (a row with `bills` replaces another for those bills; 087).
export let DEADLINE_ROWS = [];
export let DEADLINES = {   // fallback only; the real calendar comes from session_deadlines
  introduced:       [['Intro cutoff','2026-01-28']],
  first_triple:     [['Triple filing','2026-02-11']],
  first_lateral:    [['Lateral','2026-02-20']],
  first_decking:    [['Decking','2026-03-06']],
  first_crossover:  [['Crossover','2026-03-12']],
  second_triple:    [['Triple filing','2026-03-19']],
  second_lateral:   [['Lateral','2026-03-30']],
  second_decking:   [['Decking','2026-04-10']],
  second_crossover: [['Cross back','2026-04-16']],
  conference:       [['Final decking','2026-04-29'],['Fiscal','2026-05-01']],
  governor:         [['Sine die','2026-05-08']],
};
// The calendar lives in session_deadlines (one row per deadline; JANUARY.md).
// Maps the table's keys onto the phase buckets the app uses. Session year =
// the latest year in the table; the session is over once sine die has passed.
// Legislative day: the Legislature numbers only the days the chambers convene.
// session_calendar holds opening day, sine die and the weekdays that do not
// count (recess, holidays, closures). Null when the year has no calendar or
// today is outside the session, so a wrong number is never shown.
export function applySessionDeadlines(rows) {
  if (!rows || !rows.length) return;
  const yr = Math.max(...rows.map(r => r.session_year));
  const mine = rows.filter(r => r.session_year === yr).sort((a, b) => a.deadline_date.localeCompare(b.deadline_date));
  const bucket = { intro_cutoff: 'introduced', final_decking: 'conference', fiscal: 'conference', sine_die: 'governor' };
  const dl = {};
  for (const r of mine) { const k = bucket[r.key] || r.key; (dl[k] ??= []).push([r.label, String(r.deadline_date).slice(0, 10)]); }
  if (Object.keys(dl).length >= 8) { DEADLINES = dl; SESSION_YEAR = yr; DEADLINE_ROWS = mine; }
  const sine = mine.find(r => r.key === 'sine_die');
  SESSION_OVER = DEMO ? DEMO_OFF : !!sine && Date.now() > new Date(sine.deadline_date + 'T23:59:59-10:00').getTime() + 864e5;
}
// Dying-quietly radar: committee stages where "no hearing scheduled" is the
// death signal, and the deadline each stage races. Bills still at Introduced
// race the lateral (or triple, if 3X) filing date.
export const islandOf = sd => sd >= 1 && sd <= 4 ? 'Hawaiʻi' : sd >= 5 && sd <= 7 ? 'Maui' : sd === 8 ? 'Kauaʻi' : sd >= 9 && sd <= 25 ? 'Oʻahu' : null;
export const personById = id => (S.people || []).find(p => p.id === id);
export const EMPTY_PF = () => ({ q: '', tags: [], titles: [], interests: [], islands: [], house: [], senate: [], account: 'any', optin: false, bills: [], lists: [], campaigns: [], active_days: 0, acted: false });
export function peopleMatch(p, f) {
  f = { ...EMPTY_PF(), ...(f || {}) };
  const q = f.q.trim().toLowerCase();
  if (q && !`${p.name || ''} ${p.email} ${p.phone || ''}`.toLowerCase().includes(q)) return false;
  if (f.tags.length && !f.tags.some(t => (p.tags || []).includes(t))) return false;
  if ((f.titles || []).length && !f.titles.some(t => (p.titles || []).includes(t))) return false;   // R-147, backend 127
  if (f.interests.length && !f.interests.some(t => (p.interests || []).includes(t))) return false;
  if (f.islands.length && !f.islands.includes(p.island)) return false;
  if (f.house.length && !f.house.map(Number).includes(p.house_district)) return false;
  if (f.senate.length && !f.senate.map(Number).includes(p.senate_district)) return false;
  if (f.account !== 'any' && (f.account === 'yes') !== !!p.has_account) return false;
  if (f.optin && !p.action_optin) return false;
  if (f.bills.length && !f.bills.some(id => (p.bill_ids || []).includes(id))) return false;
  if (f.lists.length && !f.lists.some(id => (p.list_ids || []).includes(id))) return false;
  if (f.campaigns.length && !(p.bill_ids || []).some(id => (S.billCampaigns[id] || []).some(c => f.campaigns.includes(c)))) return false;
  if (f.active_days && !(p.last_active && Date.now() - new Date(p.last_active) < f.active_days * 864e5)) return false;
  if (f.acted && !(p.actions > 0)) return false;
  return true;
}
export const segmentPeople = id => { const sg = (S.segments || []).find(x => x.id === id); return sg ? (S.people || []).filter(p => peopleMatch(p, sg.filter)) : []; };
export function demoTriageQueue(campaignId, matchedOnly) {
  const idx = (S.snapshot?.index || []).filter(b => !/^GM/.test(b.bill_number) && !S.demoTriaged?.has(b.id) && !S.bills.some(x => x.id === b.id));
  const rules = S.campaigns.filter(c => (c.keywords || []).length);
  const rows = idx.map(b => { const txt = ((b.title || '') + ' ' + (b.description || '')).toLowerCase();
    const matches = rules.map(c => ({ campaign_id: c.id, name: c.name, terms: c.keywords.filter(k => txt.includes(k.toLowerCase())) })).filter(m => m.terms.length);
    return { id: b.id, bill_number: b.bill_number, chamber: b.chamber, title: b.title, description: b.description || null, introduced_at: null, companions: [], matches: matches.length ? matches : null, lookalike: null }; });
  return rows.filter(r => (!campaignId || (r.matches || []).some(m => m.campaign_id === campaignId)) && (!matchedOnly || r.matches))
    .sort((a, b) => (b.matches ? 1 : 0) - (a.matches ? 1 : 0) || a.bill_number.localeCompare(b.bill_number));
}
// Sample error reports for the sandbox's Session setup (110, R-111): one from yesterday, one from today, one in the sandbox.
const DEMO_DAY = d => new Date(Date.now() - d * 864e5).toLocaleDateString('en-CA', { timeZone: 'Pacific/Honolulu' });
const DEMO_AT = (d, h) => new Date(Date.now() - d * 864e5 - h * 36e5).toISOString();
// The practice copy's A/B tests: the six from migration 116, with made-up sums so the page can be seen (nothing is saved).
const abSample = (key, a, b, n, ga, gb, g2a, g2b) => [{ test: key, arm: a, forced: false, seen: n, goal: Math.round(n * ga), goal2: Math.round(n * g2a) },
  { test: key, arm: b, forced: false, seen: n - 7, goal: Math.round((n - 7) * gb), goal2: Math.round((n - 7) * g2b) }];
export const DEMO_AB = {
  tests: [
    { key: 'end', sort: 1, name: 'How the first visit ends', question: 'Does ending on Home, with what you can do right now, get more people to the end?', arms: ['today', 'home'], arm_names: { today: 'Ends on “You’re all set”', home: 'Ends on Home, with what you can do right now' }, measure: 'Finished the first visit', measure2: 'Came back within 14 days', rate: false, is_on: true, fallback: 'today', winner: null, started: '2026-10-01', note: '' },
    { key: 'fv', sort: 2, name: 'How long the first visit is', question: 'Does one short page instead of the lesson get more people to the end?', arms: ['full', 'short'], arm_names: { full: 'The lesson: a bill’s story', short: 'One page: Your voice counts here' }, measure: 'Finished the first visit', measure2: 'Acted within 14 days', rate: false, is_on: true, fallback: 'full', winner: null, started: '2026-10-03', note: '' },
    { key: 'rank', sort: 3, name: 'The next step after testimony', question: 'Once someone has sent testimony, does offering the next strongest step get them to do more?', arms: ['today', 'ranked'], arm_names: { today: 'No main button once testimony is sent', ranked: 'The next strongest step leads: email the chair, go, share' }, measure: 'Took another step on that hearing', measure2: 'Came back within 14 days', rate: false, is_on: true, fallback: 'today', winner: null, started: '2026-10-03', note: '' },
    { key: 'email', sort: 4, name: 'Where the email ask goes', question: 'Do more people give an email when the first ask comes after their first action instead of in the first visit?', arms: ['finale', 'after'], arm_names: { finale: 'Asked in the first visit', after: 'Not asked in the first visit: first asked after an action, or on coming back' }, measure: 'Gave an email within 14 days', measure2: 'Came back within 14 days', rate: false, is_on: false, fallback: 'finale', winner: null, started: null, note: 'Off until a lawyer checks both versions: they ask for consent at different moments.' },
    { key: 'share', sort: 5, name: 'The share message', question: 'Do more friends come and act when the shared message starts with the deadline?', arms: ['summary', 'deadline'], arm_names: { summary: 'Starts with what the bill does', deadline: 'Starts with the deadline' }, measure: 'Friends who arrived, per 100 shares', measure2: 'Friends who acted, per 100 shares', rate: true, is_on: true, fallback: 'summary', winner: null, started: '2026-10-03', note: '' },
    { key: 'home', sort: 6, name: 'Home’s top', question: 'Do people act more when Home groups what they can do by topic?', arms: ['by-day', 'by-issue'], arm_names: { 'by-day': 'The soonest deadline first', 'by-issue': 'Grouped by topic, the six on the first screen' }, measure: 'Acted within 7 days', measure2: 'Came back within 14 days', rate: false, is_on: false, fallback: 'by-day', winner: null, started: '2026-10-03', note: 'Paused: it compares the top of the Home before 11 Oct, which only the layout test’s “Home before 11 Oct” version shows now. Its numbers so far are kept.' },
    { key: 'layout', sort: 9, name: 'Home: the calm Home and the others', question: 'Do people come back and act more on the calm Home (one thing to do, then the issues by where they stand) than on the Home before it or the week view?', arms: ['calm', 'today', 'a'], arm_names: { calm: 'The calm Home', today: 'The Home before 11 Oct', a: 'The week view (September’s version A)' }, measure: 'Came back within 14 days', measure2: 'Acted within 14 days', rate: false, is_on: false, fallback: 'calm', winner: null, started: '2026-10-06', note: '' },
    { key: 'onb', sort: 0, name: 'The first visit, six ways', question: 'Which first visit gets the most newcomers to act and to come back?', arms: ['today', 'p1', 'p2', 'p3', 'p4', 'p5'], arm_names: { today: 'Today’s first visit', p1: 'Plan 1: Start with one bill', p2: 'Plan 2: A bill’s journey', p3: 'Plan 3: Meet your people', p4: 'Plan 4: How do you like to help?', p5: 'Plan 5: A light start' }, measure: 'Acted within 14 days', measure2: 'Came back within 14 days', rate: false, is_on: false, fallback: 'today', arms_on: ['today', 'p1'], winner: null, started: null, note: 'Plans 2 to 5 are working versions with stand-in drawings: switch each on once you have seen it. Plan 3 asks for the street address before showing any bills. The sign-up words need a lawyer’s look (R-149).' },
    { key: 'join', sort: 7, name: 'The plans’ alerts sign-up', question: 'Do more people give a number or email when they see an example of the text they would get?', arms: ['shown', 'watch'], arm_names: { shown: 'Your next text, shown: an example text right after you act', watch: 'We watch, you speak: three steps from a hearing to your note' }, measure: 'Gave a number or email that day', measure2: 'Came back within 14 days', rate: false, is_on: false, fallback: 'shown', winner: null, started: null, note: 'Met only on the five first-visit plans. The consent words are the same in both.' },
    { key: 'save', sort: 8, name: 'The ask for a number or email', question: 'Do more people give a number or email when the ask is to save their profile, right after they act, than when it is the old alerts ask?', arms: ['profile', 'alerts'], arm_names: { profile: 'Save your profile: the first thing seen after a follow or a letter', alerts: 'Get alerts: the ask as it was before 6 Oct 2026 (the backup)' }, measure: 'Gave a number or email that day', measure2: 'Came back within 14 days', rate: false, is_on: false, fallback: 'profile', winner: null, started: null, note: 'The new ask replaced the old one for everyone on 6 Oct 2026 (Nate). The old one is kept here as a backup to test later. The consent words are the same in both.' },
    { key: 'act', sort: 10, name: 'The page before the end: three ways to help', question: 'Do more newcomers act on the day of their first visit when the page before the end offers three ways to help, one tap each?', arms: ['today', 'three'], arm_names: { today: 'Coming up on your issues', three: 'Three ways to help: testimony, an email, send to a friend' }, measure: 'Acted on the day of the first visit', measure2: 'Came back within 7 days', rate: false, is_on: true, fallback: 'today', winner: null, started: '2026-10-06', note: '' },
    { key: 'pic', sort: 11, name: 'The picture a shared link shows', question: 'Which picture makes friends tap a shared link, and act when they get there?', arms: ['today', 'issue', 'sign', 'calendar', 'letter', 'text', 'neighbors', 'islands', 'before', 'here', 'ticket', 'crowd', 'stand', 'postcard'], arm_names: { today: 'Today’s picture: the ask in large words', issue: 'The issue up front', sign: '1 · The rally sign', calendar: '2 · The tear-off calendar', letter: '3 · The letter itself', text: '4 · A text from a friend', neighbors: '5 · Neighbors with a sign', islands: '6 · Every island has a say', before: '7 · Before and after', here: '8 · You are here', ticket: '9 · Admit one', crowd: '10 · The crowd count', stand: '11 · Where do you stand?', postcard: '12 · Aloha from the Capitol' }, measure: 'Friends who tapped, per 100 shares', measure2: 'Friends who acted, per 100 shares', rate: true, is_on: true, fallback: 'today', arms_on: ['today', 'issue', 'calendar', 'letter', 'here'], winner: null, started: '2026-10-06', note: '' },
  ],
  results: [
    ...abSample('end', 'today', 'home', 640, 0.41, 0.52, 0.30, 0.36), { test: 'end', arm: 'home', forced: true, seen: 5, goal: 4, goal2: 1 },
    ...abSample('fv', 'full', 'short', 640, 0.46, 0.47, 0.18, 0.17),
    ...abSample('rank', 'today', 'ranked', 74, 0.22, 0.31, 0.5, 0.55),
    ...abSample('share', 'summary', 'deadline', 130, 0.62, 0.81, 0.21, 0.29),
    ...abSample('home', 'by-day', 'by-issue', 310, 0.38, 0.41, 0.52, 0.55),
    ...[['today', 120, 0.55, 0.20], ['issue', 118, 0.63, 0.24], ['calendar', 60, 0.70, 0.27], ['letter', 119, 0.66, 0.31], ['here', 90, 0.58, 0.22]]
      .map(([arm, n, a, b]) => ({ test: 'pic', arm, forced: false, seen: n, goal: Math.round(n * a), goal2: Math.round(n * b) })),
  ],
  // The share picture by ask (made up, for the practice copy).
  byAsk: [['testify', 'today', 70, 0.6, 0.22], ['testify', 'letter', 69, 0.7, 0.33], ['testify', 'calendar', 60, 0.7, 0.27], ['follow', 'today', 50, 0.48, 0.17], ['follow', 'issue', 58, 0.6, 0.2]]
    .map(([grp, arm, n, a, b]) => ({ test: 'pic', arm, forced: false, grp, seen: n, goal: Math.round(n * a), goal2: Math.round(n * b) })),
};
// The practice copy's tester paths (R-193): made up, so the tester sheet's results can be seen; the page puts all but the
// last on its own groups.
const DEMO_TP_AT = m => new Date(Date.now() - m * 6e4).toISOString();
export const DEMO_TESTER_PATHS = [
  { id: 'demo-1', sheet: null, grp: null, versions: 'onb.today', place: 'practice', device: 'phone', started_at: DEMO_TP_AT(30), steps: [['start:topics', 34], ['start:issues', 51], ['start:alerts', 22], ['start:bill', 63], ['start:done', 12], ['home', 40], ['bill/hb1780', 28], ['bill/hb1780:testimony:know', 55], ['bill/hb1780:testimony:1', 38], ['bill/hb1780:testimony:2', 71], ['bill/hb1780:testimony:done', 9]], did: { followed: 3, skipped_alerts: 1, finished: 1, testimony: 1 } },
  { id: 'demo-2', sheet: null, grp: null, versions: 'onb.p1', place: 'practice', device: 'phone', started_at: DEMO_TP_AT(35), steps: [['start:topics', 21], ['start:one', 48], ['start:join', 30], ['start:wrap', 8], ['home', 25], ['find', 19], ['issue/disposable-e-cigarette-ban', 31]], did: { followed: 2, contact: 1, finished: 1 } },
  { id: 'demo-3', sheet: null, grp: null, versions: 'onb.today', place: 'practice', device: 'laptop', started_at: DEMO_TP_AT(42), steps: [['start:topics', 40], ['start:issues', 66], ['start:alerts', 15]], did: { followed: 1, skipped_alerts: 1 } },
  { id: 'demo-4', sheet: null, grp: null, versions: 'onb.today,share.deadline', place: 'practice', device: 'phone', started_at: DEMO_TP_AT(2000), steps: [['start:topics', 25], ['start:issues', 40], ['home', 20], ['bill/hb1780', 33]], did: { followed: 2, share: 1 } },
];
export const DEMO_PUBLIC_ERRORS = [
  { day: DEMO_DAY(0), at_hour: DEMO_AT(0, 2), kind: 'render', place: 'bill/HB1075', message: "TypeError: Cannot read properties of undefined (reading 'scheduled_at')", source: '/hiphi-tracker-app/pub/bill.js:412:31', device: 'phone', sandbox: false, reports: 3, first_at: DEMO_AT(0, 2), last_at: DEMO_AT(0, 1) },
  { day: DEMO_DAY(1), at_hour: DEMO_AT(1, 5), kind: 'error', place: 'home', message: 'ReferenceError: fmtWhen is not defined', source: '/hiphi-tracker-app/pub/home.js:88:9', device: 'laptop', sandbox: false, reports: 1, first_at: DEMO_AT(1, 5), last_at: DEMO_AT(1, 5) },
  { day: DEMO_DAY(2), at_hour: DEMO_AT(2, 3), kind: 'rejection', place: 'start/4', message: 'Error: the lesson example has no hearings', source: '', device: 'tablet', sandbox: true, reports: 2, first_at: DEMO_AT(2, 3), last_at: DEMO_AT(2, 3) },
];
export const DEMO_READINESS = [
  { key: 'deadlines', level: 'block', label: '2026 session calendar loaded', ok: true, detail: '12 deadlines for 2026', fix: '' },
  { key: 'slots', level: 'block', label: 'Committee hearing schedules loaded', ok: true, detail: '91 meeting slots', fix: '' },
  { key: 'committees', level: 'block', label: 'Committees and chairs current', ok: true, detail: '33 committees with a chair', fix: '' },
  { key: 'advocates_auth', level: 'block', label: 'Every team member can sign in', ok: false, detail: '2 without an account: LR, RK', fix: 'Supabase → Authentication → Users → Add user (hiphi.org email).' },
  { key: 'slack', level: 'block', label: 'Slack connected', ok: true, detail: '#hearing-alerts-2027', fix: '' },
  { key: 'sync', level: 'block', label: 'Bill sync healthy', ok: true, detail: 'last run 6:10 AM ok', fix: '' },
  { key: 'email', level: 'info', label: 'Email', ok: null, detail: 'paused — nothing is sent', fix: '' },
  { key: 'template', level: 'manual', label: 'Testimony template Doc has every token', ok: false, detail: '', fix: 'Open the template; tokens are listed under Settings → Slack.' },
  { key: 'rehearsal', level: 'manual', label: 'Full rehearsal done', ok: false, detail: '', fix: 'One afternoon the week of January 4 with a [TEST] hearing.' },
  // The session-start steps the server dates (migration 167, Z1-6): not problems before their day, so they show as "Expected".
  { key: 'burst_syncs', level: 'warn', label: 'The opening weeks’ extra syncs are set (4 more a day)', ok: false, expected: '2027-01-10', detail: 'not set', fix: 'Session setup > Session days and sync > "4 more syncs a day until": set it to the middle of February.' },
  { key: 'notice_received', level: 'warn', label: 'A hearing-notice email has come in lately', ok: false, expected: '2027-01-22', detail: 'no notice email received yet', fix: 'The Capitol page lane covers hearings meanwhile.' },
];
export function bestCampaign(r) {
  if (r.lookalike?.coalition) { const c = S.campaigns.find(x => x.name === r.lookalike.coalition); if (c) return c; }
  if (r.matches?.length) { const c = S.campaigns.find(x => x.id === r.matches[0].campaign_id); if (c) return c; }
  return S.campaigns.find(c => c.name === 'General HIPHI') || S.campaigns[0];
}
// The first approval, as the database decides it (098, R-103): an admin; an approver (Kris) on testimony someone else
// sent; a reviewer standing in from 6 hours before the testimony deadline, on testimony someone else sent.
function firstStep(d, me, bad, changes = false) {
  if (me.is_admin) return;
  if (!me.can_approve) {
    const h = S.hearings.find(x => x.id === d.hearing_id), due = h?.testimony_deadline ? new Date(h.testimony_deadline).getTime() : null;
    if (!(me.is_reviewer && due != null && due <= Date.now() + 6 * 36e5))
      bad(changes ? 'Only an admin or an approver can act on a draft in first review (a second approver can from 6 hours before the testimony deadline)'
        : 'The first approval is by an admin or an approver; a second approver can give it from 6 hours before the testimony deadline');
  }
  if (!changes && d.submitted_by === me.id) bad('Someone else has to approve testimony you sent for approval');
}
// Simple: the New bills instructions show on the first visit, then fold into a "How this works" link.
export function demoTransition(d, action, note, url) {
  const me = S.me, now = new Date().toISOString();
  const bad = m => { throw new Error(m); };
  if (action === 'submit') Object.assign(d, { status: 'review', submitted_by: me.id, submitted_at: now, review_note: null });
  else if (action === 'approve' && d.status === 'review') {
    firstStep(d, me, bad);
    const first = !Object.values(S.drafts).flat().some(x => x.bill_id === d.bill_id && x.id !== d.id && (['approved', 'filed'].includes(x.status) || x.second_approved_at));
    Object.assign(d, { status: first ? 'second_review' : 'approved', approved_by: me.id, approved_at: now, first_for_bill: first });
  } else if (action === 'approve' && d.status === 'second_review') {
    if (!me.is_reviewer) bad('The second approval is by a reviewer (Jess or Jaylen)');
    if (d.approved_by === me.id) bad('The second approval has to come from someone other than the first');
    Object.assign(d, { status: 'approved', second_approved_by: me.id, second_approved_at: now });
  } else if (action === 'request_changes') {
    if (d.status === 'review') firstStep(d, me, bad, true);
    else if (d.status === 'second_review' && !me.is_reviewer) bad('Only a reviewer can act on a draft in second review');
    Object.assign(d, { status: 'draft', review_note: note || null });
  }
  else if (action === 'withdraw') d.status = 'draft';
  else if (action === 'file') Object.assign(d, { status: 'filed', filed_by: me.id, filed_at: now, filed_url: url || null });
  else if (action === 'unfile') Object.assign(d, { status: 'approved', filed_by: null, filed_at: null, filed_url: null });
  else if (action === 'unapprove') {   // as the server does (058): the approver, while nothing further has happened
    if (d.status === 'approved' && d.second_approved_by === me.id) Object.assign(d, { status: 'second_review', second_approved_by: null, second_approved_at: null });
    else if (['second_review', 'approved'].includes(d.status) && d.approved_by === me.id && !d.second_approved_by) Object.assign(d, { status: 'review', approved_by: null, approved_at: null, first_for_bill: null });
    else bad('This approval can no longer be undone.');
  }
  else bad('Unknown action');
}
// R-316 W43: a button refused because someone else already acted. Kris pressed Approve after Nate had, and the server's
// "Nothing to approve." left the Approve button showing; Mark filed and Send back failed the same way. On a refusal the
// bill's drafts are read again; if the draft moved on (its status changed, or this step no longer fits it), the screen is
// redrawn from the fresh row and the refusal becomes who acted and when: "Nate approved it at 9:42 AM." Any other
// refusal (permissions, a bad link) comes back as it was. The error carries .raced, so the toast is plain, not red.
let lastLook = '';
const FITS = { approve: ['review', 'second_review'], request_changes: ['review', 'second_review'], file: ['approved'], unfile: ['filed'], submit: ['draft'], withdraw: ['review', 'second_review'] };
const fits = (d, action) => (FITS[action] || [d.status]).includes(d.status) && !(d.status === 'second_review' && ['approve', 'request_changes'].includes(action) && (!S.me?.is_reviewer || (action === 'approve' && d.approved_by === S.me?.id)));
const clockAt = t => new Date(t).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'Pacific/Honolulu' });
const hstDay = t => new Date(t).toLocaleDateString('en-CA', { timeZone: 'Pacific/Honolulu' });
// "at 9:42 AM" today (Hawaiʻi time), "yesterday at 2:00 PM", "on Fri 3/13, 2:00 PM" another day: the app's fmtDT, as whenAt (model.js) says it.
const atWhen = t => !t ? '' : hstDay(t) === hstDay(Date.now()) ? ` at ${clockAt(t)}` : hstDay(t) === hstDay(Date.now() - 864e5) ? ` yesterday at ${clockAt(t)}` : ` on ${fmtDT(t)}`;
const whoDid = id => id && id === S.me?.id ? 'You' : (advocate(id)?.full_name || '').split(' ')[0] || 'Someone';
export function raceLine(d) {
  if (d.status === 'filed') return `${whoDid(d.filed_by)} filed it${atWhen(d.filed_at)}.`;
  if (d.status === 'approved') return d.second_approved_by ? `${whoDid(d.second_approved_by)} gave it the second approval${atWhen(d.second_approved_at)}.` : `${whoDid(d.approved_by)} approved it${atWhen(d.approved_at)}.`;
  if (d.status === 'second_review') return `${whoDid(d.approved_by)} approved it${atWhen(d.approved_at)}.`;
  if (d.status === 'review') return `${whoDid(d.submitted_by)} sent it for approval${atWhen(d.submitted_at)}.`;
  // A send-back keeps no name on the draft (098 records the note only), so it says what happened and when.
  if (d.status === 'draft') return `It was already sent back to its writer${d.review_note ? ' with a note' : ''}${atWhen(d.updated_at)}.`;
  if (d.status === 'cancelled') return 'Its hearing was cancelled, so there is nothing to do on it.';
  return '';
}
async function raced(billId, before, action, err) {
  let fresh;
  try { fresh = (await DB.reloadDrafts(billId)).find(x => x.id === before.id); } catch { return err; }
  if (!fresh || (fresh.status === before.status && fits(fresh, action))) return err;
  const line = raceLine(fresh); if (!line) return err;
  hooks.afterLoad();                                   // the derived facts are rebuilt from the fresh row
  // Redrawn now, so the refused button goes; not under an open sheet (Mark filed's link box), whose own page redraws on close.
  if (!document.querySelector('dialog[open]')) hooks.render();
  return Object.assign(new Error(line), { raced: true, draft: fresh });
}
// v2 only: the frame clears the recovery flag after a new password is saved (an imported `let` cannot be assigned).
export const setRecovery = v => { RECOVERY = v; };

// One bill's draft notes from DB.allBillDrafts, loaded once on first use (R-148); null until they arrive, and the screen
// redraws when they do. A save on the Public tab updates the same list (public.js put).
export function draftNotesOf(billId) {
  if (S.allDrafts === undefined) {
    S.allDrafts = null;
    DB.allBillDrafts().then(rows => { const m = {}; for (const r of rows) (m[r.bill_id] ??= []).push(r); S.allDrafts = m; hooks.render?.(); })
      .catch(() => { S.allDrafts = {}; });
  }
  return S.allDrafts ? S.allDrafts[billId] || [] : null;
}

// What each draft since `from` changed, in words (R-148): "House draft 2 (HD2): Took out the money. HIPHI marked it as
// changing what people should say." '' when no note covers those drafts yet. `from` null is the bill as introduced.
const DW = { HD: 'House draft', SD: 'Senate draft', CD: 'Conference committee draft', FD: 'Floor draft' };
const dname = v => { const m = /^(HD|SD|CD|FD)(\d+)$/.exec(v || ''); return m ? `${DW[m[1]]} ${m[2]} (${v})` : 'the bill as introduced'; };
const drank = (b, v) => { const m = /^(HD|SD|CD|FD)(\d+)$/.exec(v || ''); if (!m) return 0; const own = (b.bill_number || '')[0] === 'S' ? ['SD', 'HD'] : ['HD', 'SD'];
  return (({ [own[0]]: 0, [own[1]]: 1, FD: 2, CD: 3 }[m[1]] ?? 4) + 1) * 100 + (+m[2] || 0); };
export function changedSince(b, from, to = b.current_version) {
  const notes = draftNotesOf(b.id) || [], lo = drank(b, from), hi = drank(b, to);
  return notes.filter(n => drank(b, n.version) > lo && drank(b, n.version) <= hi).sort((x, y) => drank(b, x.version) - drank(b, y.version))
    .map(n => `${dname(n.version)}: ${n.summary}${n.changes_letters ? ' HIPHI marked it as changing what people should say.' : ''}`).join(' ');
}
// A testimony draft the job started from HIPHI's earlier testimony on the bill (R-148, sync/testimony.js): one line for its
// card, "Started from HIPHI's HLT testimony, written for the bill as introduced. Since then: ...". '' for one from the template.
export function startedFromLine(b, d) {
  if (!d.from_draft_id) return '';
  const src = Object.values(S.drafts || {}).flat().find(x => x.id === d.from_draft_id);
  const head = `Started from HIPHI’s ${src ? `${src.committee} ` : ''}testimony`;
  if (!src) return `${head}, with this hearing’s committee, names, date and room put in.`;
  // R-316 W24 (G1-8): compared with the bill as it is now, not with the draft, so it never says "hasn't changed" right
  // above "The bill is now SD1".
  if ((src.version || null) === (b.current_version || d.version || null)) return `${head}, with this hearing’s details put in. The bill hasn’t changed since.`;
  const since = changedSince(b, src.version, d.version);
  return `${head}, written for ${dname(src.version)}. ${since ? `Since then: ${since}` : `No note yet on what changed since then.`}`;   // the bill's own version is said once, in the warning under it (X10-6)
}
