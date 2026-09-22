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
// Issue and list icons (9/19): the public page shows Lucide icons, not emoji, so staff pick from a short list of
// names. Old emoji values still display (mapped) until they are re-saved.
export const DEMO = new URLSearchParams(location.search).has('demo');
// Sandbox: the real 2026 session frozen at Monday March 16, 2026, 9:00 HST
// (demo/snapshot.json, built by Bill-Tracker/tools/build_snapshot.js). The
// clock starts there and runs forward for the length of the visit, so
// countdowns tick but nothing new ever arrives. `&season=off` previews the months between sessions: the clock is
// 18 September instead and the session has ended, as pub/core.js does (R-022).
const DEMO_OFF = DEMO && new URLSearchParams(location.search).get('season') === 'off';
export const DEMO_ASOF = DEMO_OFF ? '2026-09-18T09:00:00-10:00' : '2026-03-16T09:00:00-10:00';
if (DEMO) {
  const RD = Date, off = RD.now() - new RD(DEMO_ASOF).getTime();
  window.Date = class extends RD { constructor(...a) { a.length ? super(...a) : super(RD.now() - off); } static now() { return RD.now() - off; } };
}
export const HASH_Q = new URLSearchParams(location.hash.slice(1));
export let RECOVERY = HASH_Q.get('type') === 'recovery';
// A spent or expired link returns #error=...&error_description=... instead.
// Surfacing it matters: without it the app showed a bare sign-in form, the link
// looked like it had done nothing, and clicking again burned the next token too.
export const LINK_ERR = HASH_Q.get('error_description') || '';
// Own origin + path, so the GitHub Pages subpath is picked up automatically: the tracker's folder address, which since
// 9/21 is Staff v2 itself (index.html; staff.html is the same page). Recovery links land there, an address already on
// Supabase's redirect list, and every Slack, email and calendar link the database writes points there too (R-022).
export const APP_URL = location.origin + location.pathname.replace(/(staff|index)\.html$/, '');
// January flip: see JANUARY.md in the Bill-Tracker repo. Update SESSION_YEAR
// here, plus SESSION_OVER and DEADLINES in the Cards-view block below.
export let SESSION_YEAR = 2026;   // overwritten from session_deadlines at load (applySessionDeadlines)
export const STAGES = [
  ['introduced','Introduced'], ['first_triple','1st Triple'], ['first_lateral','1st Lateral'],
  ['first_decking','1st Decking'], ['first_crossover','Crossover'], ['second_triple','2nd Triple'],
  ['second_lateral','2nd Lateral'], ['second_decking','2nd Decking'],
  ['second_crossover','Passed Both'], ['conference','Conference'], ['governor','Governor'],
  ['enacted','Law'], ['vetoed','Vetoed'], ['dead','Dead'],
];
export const STAGE_LABEL = Object.fromEntries(STAGES);
export const POSITIONS = [['','—'],['strongly_support','Strongly support'],['support','Support'],['support_amend','Support w/ amendments'],['strongly_oppose','Strongly oppose'],
  ['oppose','Oppose'],['monitor','Monitor'],['neutral','Comments (neutral)']];
export const LOG_TYPES = [['testimony','Testimony'],['coalition','Coalition'],['meeting','Meeting'],
  ['action_alert','Action alert'],['note','Note']];
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
  categories: [], issues: [], issueCats: [], billIssues: [],
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
// something unique, or a row can repeat or fall between two pages. The first page also asks for the total; the rest
// then come together, each the size the server gave the first. Resolves like one query: { data, error }.
export async function allRows(make) {
  const first = await make({ count: 'exact' }).range(0, 999), n = first.data?.length || 0;
  if (first.error || !n || !(first.count > n)) return first;
  const rest = await Promise.all(Array.from({ length: Math.ceil(first.count / n) - 1 }, (_, i) => make().range(n * (i + 1), n * (i + 2) - 1)));
  return rest.find(r => r.error) || { ...first, data: first.data.concat(...rest.map(r => r.data)) };
}
export const DB = {
  async init() {
    if (DEMO) { await demoInit(); return; }
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
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
    // link my login to my advocate row (no-op after first time)
    const { data: myId, error: claimErr } = await S.supa.rpc('claim_advocate');
    if (claimErr) console.warn('claim_advocate:', claimErr.message);
    // One clock for the whole load, so every page of a paged query asks for the same window.
    const loadedAt = Date.now(), daysBack = d => new Date(loadedAt - d * 864e5).toISOString();
    const [adv, bills, asg, camps, bc, hear, pulse, feed, todos, drafts, comms, scfg, ccfg, ecfg, sycfg, dls, slots, fol, att, outc, msgs, reads, inb, scal, pls, plb, plf, legs, cms, cps, sts, als, segs, fups, mut] = await Promise.all([
      S.supa.from('advocates').select('*').order('full_name'),
      allRows(o => S.supa.from('bills').select('*', o).eq('tracked', true).order('bill_number').order('id')),
      allRows(o => S.supa.from('bill_assignments').select('bill_id,advocate_id', o).order('bill_id').order('advocate_id')),
      S.supa.from('campaigns').select('*').order('sort_order'),
      allRows(o => S.supa.from('bill_campaigns').select('bill_id,campaign_id', o).order('bill_id').order('campaign_id')),
      allRows(o => S.supa.from('hearings').select('*', o).gte('scheduled_at', daysBack(60)).order('id')),
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
    ]);
    S.inbox = inb?.data || [];
    S.messages = {}; (msgs?.data || []).forEach(m => (S.messages[m.bill_id] ??= []).push(m));
    S.chatSeen = Object.fromEntries((reads?.data || []).map(r => [r.bill_id, r.seen_at]));
    S.slackCfg = scfg?.data?.value || null;
    S.calCfg = ccfg?.data?.value || null;
    S.emailCfg = ecfg?.data?.value || { enabled: true };
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
    for (const r of [adv, bills, asg, camps, bc, hear, pulse, feed])
      if (r.error) throw r.error;
    S.advocates = adv.data; S.bills = bills.data; S.campaigns = camps.data; hooks.afterLoad();
    S.hearings = hear.data;
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
    // Committee names and chairs (migration 007). Optional: without the table
    // the Next block shows the code and everything else still works.
    S.committees = {};
    if (comms.error) console.warn('committees:', comms.error.message);
    else comms.data.forEach(c => { S.committees[c.code] = c; });
    S.pulse = Object.fromEntries(pulse.data.map(p => [p.bill_id, p]));
    S.feed = feed.data;
    S.me = S.advocates.find(a => a.id === myId) ||
           S.advocates.find(a => a.email === S.session?.user?.email) || null;
    S.follows = new Set(Object.entries(S.followersBy).filter(([, ids]) => S.me && ids.includes(S.me.id)).map(([id]) => id));
    S.mutes = new Set((mut?.data || []).filter(r => S.me && r.advocate_id === S.me.id).map(r => r.bill_id));
    // Nothing owned or followed yet: the empty "My bills" page helps nobody.
    if (S.me && S.owner === 'me' && !S.bills.some(b => (S.assignments[b.id] || []).includes(S.me.id) || S.follows.has(b.id))) S.owner = 'all';
    // Freshness indicator data - never let this block the app
    try {
      const sr = await S.supa.from('sync_runs').select('finished_at,ok')
        .order('started_at', { ascending: false }).limit(10);
      S.syncRuns = sr.data || [];
    } catch { S.syncRuns = []; }
    await this.loadIssues();
    // Companion stages for the "companion alive" chip (non-fatal)
    try {
      const nums = [...new Set(S.bills.flatMap(b => b.companions || []))];
      if (nums.length) {
        const ci = await allRows(o => S.supa.from('bills').select('bill_number,stage,stage_override', o)
          .in('bill_number', nums).order('id'));
        S.compStage = Object.fromEntries((ci.data || [])
          .map(r => [r.bill_number, r.stage_override || r.stage || 'introduced']));
      }
    } catch { S.compStage = {}; }
    // Official actions found since this person's previous visit (non-fatal)
    try {
      const ev = await S.supa.from('activity_log')
        .select('bill_id,title,occurred_at,created_at')
        .eq('source', 'auto').gt('created_at', new Date(S.sinceVisit).toISOString())
        .order('created_at', { ascending: false }).limit(200);
      S.sinceEvents = ev.data || [];
    } catch { S.sinceEvents = []; }
    // Everything that happened on tracked bills in the last eight days, every source (non-fatal). Eight days covers
    // "since yesterday", "since Friday", "since your last visit" and "the last 7 days". It used to be 72 hours across
    // all 6,000 bills, capped at 300 rows: the Capitol stamps its actions 08:00, so on a Monday after 8 AM all of
    // Friday's fell outside the window, and on a busy day the cap dropped most of the rest (R-022). The inner join
    // keeps it to the bills the team tracks.
    try {
      const rc = await allRows(o => S.supa.from('activity_log')
        .select('bill_id,title,details,occurred_at,type,advocate_id,source,bills!inner(tracked)', o)
        .eq('bills.tracked', true)
        .gt('occurred_at', daysBack(8))
        .order('occurred_at', { ascending: false }).order('id'));
      S.recentEvents = (rc.data || []).map(({ bills: _b, ...e }) => e);
    } catch { S.recentEvents = []; }
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
  async setOwner(billId, advocateId) {
    S.assignments[billId] = advocateId ? [advocateId] : [];
    if (DEMO) return;
    await S.supa.from('bill_assignments').delete().eq('bill_id', billId);
    if (advocateId) {
      const { error } = await S.supa.from('bill_assignments')
        .insert({ bill_id: billId, advocate_id: advocateId, is_lead: true });
      if (error) throw error;
    }
  },
  async bulkUpdate(ids, patch) {
    const before = new Map();
    ids.forEach(id => { const b = S.bills.find(x => x.id === id); if (!b) return;
      const snap = {}; for (const k of Object.keys(patch)) snap[k] = b[k];
      before.set(id, snap); Object.assign(b, patch); });
    if (DEMO) return;
    const { error } = await S.supa.from('bills').update(patch).in('id', ids);
    if (error) {                                  // undo every row we touched
      before.forEach((snap, id) => { const b = S.bills.find(x => x.id === id);
        if (b) Object.assign(b, snap); });
      throw error;
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
    if (DEMO) { demoTransition(arr[i], action, note, url); return; }
    const { data, error } = await S.supa.rpc('testimony_transition',
      { p_draft: id, p_action: action, p_note: note || null, p_url: url || null });
    if (error) throw error;
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
  async companionInfo(nums) {
    if (DEMO) return S.bills.filter(b => nums.includes(b.bill_number));
    const { data, error } = await S.supa.from('bills')
      .select('id,bill_number,stage,stage_override,tracked,session_year,state_url')
      .in('bill_number', nums);
    if (error) throw error; return data;
  },
  async searchUntracked(q) {
    if (DEMO) { const ql = q.toLowerCase(), qn = ql.replace(/\s/g, ''); return (S.snapshot?.index || []).filter(b => b.bill_number.toLowerCase().includes(qn) || (b.title || '').toLowerCase().includes(ql)).slice(0, 40).map(b => ({ ...b, last_action: null, last_action_date: null })); }
    const safe = q.replace(/[%,()]/g, ' ').trim();
    const { data, error } = await S.supa.from('bills')
      .select('id,bill_number,title,last_action,last_action_date')
      .eq('tracked', false)
      .or(`bill_number.ilike.%${safe.replace(/\s/g,'')}%,title.ilike.%${safe}%`)
      .limit(15);
    if (error) throw error; return data;
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
    if (DEMO) return { slack_bot_token: 57 };
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
    if (DEMO) return DEMO_READINESS;
    const { data, error } = await S.supa.rpc('readiness'); if (error) throw error; return data;
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
  // Start a GitHub workflow from Settings (admin-dispatch Edge Function).
  async dispatch(event, payload) {
    if (DEMO) throw new Error('The sandbox cannot start workflows.');
    const { data } = await S.supa.auth.getSession();
    const r = await fetch(`${SUPABASE_URL}/functions/v1/admin-dispatch`, { method: 'POST', headers: { authorization: `Bearer ${data.session?.access_token}`, apikey: SUPABASE_KEY, 'content-type': 'application/json' }, body: JSON.stringify({ event, payload }) });
    const j = await r.json().catch(() => ({ ok: false, error: `HTTP ${r.status}` }));
    if (!j.ok) throw new Error(j.error || 'could not start'); return j;
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
      const [cats, iss, ic, bi] = await Promise.all([
        S.supa.from('categories').select('*').order('sort_order'),
        S.supa.from('issues').select('*').order('sort_order').order('name'),
        S.supa.from('issue_categories').select('issue_id,category'),
        allRows(o => S.supa.from('bill_issues').select('bill_id,issue_id,added_at', o).order('bill_id').order('issue_id')),
      ]);
      for (const r of [cats, iss, ic, bi]) if (r.error) throw r.error;
      S.categories = cats.data || []; S.issues = iss.data || []; S.issueCats = ic.data || []; S.billIssues = bi.data || [];
    } catch (e) { console.warn('issues:', e.message || e); }
  },
  async createIssue({ name, description, category, also = [], recommended = false }) {
    const base = name.toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'issue';
    let slug = base, n = 2; while (S.issues.some(i => i.slug === slug)) slug = `${base}-${n++}`;
    const row = { slug, name: name.trim(), description: (description || '').trim() || null, category, recommended: !!recommended, sort_order: 100 };
    let issue;
    if (DEMO) issue = { id: 'demo-' + Date.now(), created_at: new Date().toISOString(), updated_at: new Date().toISOString(), edited_at: new Date().toISOString(), archived_at: null, ...row };
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
  async setBillIssue(billId, issueId, on) {
    const had = S.billIssues.some(x => x.bill_id === billId && x.issue_id === issueId);
    if (on === had) return;
    if (on) S.billIssues.push({ bill_id: billId, issue_id: issueId, added_at: new Date().toISOString() });
    else S.billIssues = S.billIssues.filter(x => !(x.bill_id === billId && x.issue_id === issueId));
    if (DEMO) return;
    const { error } = on ? await S.supa.from('bill_issues').insert({ bill_id: billId, issue_id: issueId })
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

  // ---- the first visit (067-068, R-023): Staff v2 only, like Issues ----
  // The public first visit's weekly roll-up, staff only; the rows themselves nobody can read. The sandbox has no visits:
  // firstvisit.js draws numbers labelled as samples instead of calling this.
  async firstVisitFunnel(weeks = 12) {
    if (DEMO) return [];
    const { data, error } = await S.supa.rpc('first_visit_funnel', { weeks: Math.round(+weeks || 12) });
    if (error) throw error;
    return data || [];
  },
  // The same visits by source and the campaign word of their link (069), so two flyers for one partner can be told apart.
  async firstVisitSources(weeks = 12) {
    if (DEMO) return [];
    const { data, error } = await S.supa.rpc('first_visit_sources', { weeks: Math.round(+weeks || 12) });
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

  // ---- people (CRM) ----
  async loadPeople() {
    if (S.peopleLoaded || S.peopleLoading) return; S.peopleLoading = true;
    try { const { data, error } = await allRows(o => S.supa.from('people_overview').select('*', o).order('last_active', { ascending: false, nullsFirst: false }).order('id')); if (error) throw error; S.people = data || []; S.peopleLoaded = true; }
    finally { S.peopleLoading = false; }
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
    const row = { bill_id: a.bill_id || null, list_id: a.list_id || null, segment_id: a.segment_id || null, subject: a.subject, body: a.body, body_html: a.body_html || null, author_id: S.me?.id, updated_at: new Date().toISOString() };
    if (!a.id) { const { data, error } = await S.supa.from('action_alerts').insert(row).select('*').single(); if (error) throw error; S.alerts.unshift(data); return data; }
    const { data, error } = await S.supa.from('action_alerts').update({ subject: row.subject, body: row.body, body_html: row.body_html, updated_at: row.updated_at }).eq('id', a.id).select('*').single(); if (error) throw error;
    Object.assign(S.alerts.find(x => x.id === a.id) || {}, data); return data;
  },
  async alertStep(id, action, note) {
    if (DEMO) { const a = S.alerts.find(x => x.id === id); const next = { submit: 'submitted', approve: 'approved', unapprove: 'submitted', return: 'returned', send: 'sent', test: a.status }[action]; Object.assign(a, { status: next, review_note: action === 'return' ? note : a.review_note, sent_at: action === 'send' ? new Date().toISOString() : a.sent_at, recipients: action === 'send' ? 12 : a.recipients }); return a; }
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
    if (DEMO) return (S.legLast = {});
    const { data, error } = await allRows(o => S.supa.from('legislator_notes').select('id,legislator_id,advocate_id,body,created_at', o).order('created_at', { ascending: false }).order('id')); if (error) throw error;
    const out = {}; for (const r of data || []) if (!out[r.legislator_id]) out[r.legislator_id] = r;
    return (S.legLast = out);
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
    const row = { ...fields, created_at: new Date().toISOString(), id: 'tmp' + Date.now() + Math.random().toString(36).slice(2, 6) };
    if (!DEMO) { const { data, error } = await S.supa.from('legislator_notes').insert(fields).select('*').single(); if (error) throw error; Object.assign(row, data); }
    else (S.demoNotes ??= []).unshift(row);
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
  async saveEmailSettings(cfg) {
    S.emailCfg = cfg;
    if (DEMO) return;
    const { error } = await S.supa.from('app_settings').upsert({ key: 'email', value: cfg, updated_at: new Date().toISOString() });
    if (error) throw error;
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
  const snap = await (await fetch('demo/snapshot.json?v=20260921n', { cache: 'force-cache' })).json();   // bump v when the snapshot is rebuilt, or browsers keep the old copy
  S.snapshot = snap;
  S.advocates = snap.advocates.map(a => ({ ...a, color: a.color || '#0E7C86' }));
  S.me = S.advocates.find(a => a.is_admin) || S.advocates[0];
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
  S.categories = (snap.categories || []).map(c => ({ ...c })); S.issues = (snap.issues || []).map(i => ({ archived_at: null, ...i })); S.issueCats = (snap.issueCategories || []).map(x => ({ ...x })); S.billIssues = (snap.billIssues || []).map(x => ({ ...x }));
  S.slackCfg = { main_channel: '#hearing-alerts-2027', positions: ['strongly_support','support','support_amend','strongly_oppose','oppose','neutral'], workflow_dm: true, health_dm: true,
    reminder_defaults: { morning: '08:35', morning_on: true, hours_before: 1, before_on: true, after: '16:00', after_on: true },
    daily: { enabled: true, time: '07:00', days_ahead: 7, channel: null, post_when_empty: false },
    templates: { hearing_alert: '📅 *{{bill}}* · {{position}}{{priority}}{{owner}}\n{{title}}\n{{committee}} hearing · {{hearing}} · {{room}}\nWritten testimony due *{{deadline}}*\n<{{tracker}}|Open in tracker> · <{{pdf}}|Notice PDF>',
      draft_thread: '📝 Draft ready{{owner_for}}: <{{draft}}|Google Doc> · <{{tracker}}|tracker>' } };
  const sc = snapshotScenario(snap);
  // Between sessions (&season=off): the imagined end of 2026, as pub/core.js has it. Anything still moving stops, except
  // strongly supported bills that got far, which become law, so Today's "how the session ended" has laws to show.
  if (DEMO_OFF) { let n = 100; for (const b of sc.bills) if (!['dead', 'enacted', 'vetoed'].includes(b.stage)) {
    if (b.position === 'strongly_support' && ['conference', 'second_decking', 'second_crossover', 'governor'].includes(b.stage)) { b.stage = 'enacted'; b.last_action = `Act ${n++}, on 07/01/2026`; }
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
  const anchor = positioned.find(b => b.priority === 1 && (sc.assignments[b.id] || []).includes(S.me.id) && heardSoon(b))
    || positioned.find(heardSoon) || positioned[0] || S.bills[0];
  if (anchor && !DEMO_OFF) {   // between sessions nothing is in review
    const b0 = anchor;
    // Its next hearing: the earliest of all was often one already past, so the card said "No hearing is scheduled".
    const h0 = sc.hearings.filter(h => h.bill_id === b0.id && new Date(h.scheduled_at) > Date.now())
      .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at))[0];
    // In review, from Kevin: the admin (you, in demo) gets Approve / Request changes.
    S.drafts[b0.id] = [{ id: 'dd1', bill_id: b0.id, committee: h0 ? h0.committee : (b0.committee || 'FIN'),
      status: 'review', submitted_by: byIni.KV, submitted_at: new Date(Date.now() - 3 * 36e5).toISOString(),
      doc_url: 'https://docs.google.com/document/d/demo/edit', created_at: new Date().toISOString() }];
  }
  // And one per hearing in the coming week on a bill with a position, as the live job does: sync/testimony.js makes
  // drafts only for an actionable position, never for Monitor (the sandbox used to seed every hearing, which made
  // Today look twice as busy as live; R-022). Each draft is the bill owner's, and returned drafts carry different
  // notes, as real reviews would.
  const NOTES = ['Cite the 2024 BRFSS numbers in paragraph two.', 'Lead with the fiscal note; the chair asked for it.',
    'Name the two amendments we want in the first paragraph.', 'Shorten it to one page and list the coalition sign-ons.'];
  let n = 2, approvedSeeded = false, noteN = 0;
  for (const h of sc.hearings.filter(h => new Date(h.scheduled_at) > new Date()
      && new Date(h.scheduled_at) - Date.now() < 7 * 864e5)) {
    const hb = S.bills.find(b => b.id === h.bill_id);
    if (!hb || !ACTIONABLE.includes(hb.position)) continue;
    if ((S.drafts[h.bill_id] || []).some(d => d.committee === h.committee)) continue;
    const owner = (sc.assignments[h.bill_id] || [])[0] || null;
    // Cycle through the workflow states so every button shows up somewhere.
    let st = ['filed', 'second_review', 'draft', 'approved'][(n - 2) % 4];
    // The Desk opens on "my bills", so make sure one of Nate's has the
    // approved-not-filed state - that is the button training should practise.
    if (!approvedSeeded && (sc.assignments[h.bill_id] || []).includes(S.me.id)) { st = 'approved'; approvedSeeded = true; }
    const ago = h => new Date(Date.now() - h * 36e5).toISOString();
    (S.drafts[h.bill_id] ??= []).push({ id: 'dd' + n++, bill_id: h.bill_id, committee: h.committee,
      status: st, doc_url: 'https://docs.google.com/document/d/demo' + n + '/edit',
      created_at: ago(30), submitted_by: st === 'draft' ? null : owner, submitted_at: st === 'draft' ? null : ago(20),
      approved_by: ['approved', 'filed', 'second_review'].includes(st) ? byIni.NT : null, approved_at: ago(10),
      second_approved_by: st === 'filed' ? byIni.JS : null, second_approved_at: ago(6),
      filed_by: st === 'filed' ? owner : null, filed_at: st === 'filed' ? ago(2) : null,
      version: S.bills.find(b => b.id === h.bill_id)?.current_version || null,
      review_note: st === 'draft' ? NOTES[noteN++ % NOTES.length] : null });
  }
  // Drafts that already existed on the sandbox's day (R-027): filed, on the earlier hearings where HIPHI really filed
  // testimony in 2026 (tools/build_snapshot.js), so the Testimony tab has a history to show. A bill and committee that
  // already has a seeded draft keeps it: one Doc per bill and committee, as live.
  for (const d of snap.drafts || []) if (!(S.drafts[d.bill_id] || []).some(x => x.committee === d.committee)) (S.drafts[d.bill_id] ??= []).push({ ...d });
  S.draftHearings = { ...(snap.draftHearings || {}) };
  S.assignments = sc.assignments; S.billCampaigns = sc.billCampaigns;
  // Versions and outcomes are in the snapshot; one follow and one attendance
  // are seeded so those panels have something to show.
  S.follows = new Set(); S.mutes = new Set(); S.followersBy = {}; S.attend = {}; S.outcomes = Object.fromEntries(snap.outcomes.map(o => [o.hearing_id, o]));
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
      if (d.status === 'review' && S.me?.is_admin) out.push({ key: 'n:' + d.id, kind: 'testimony', direct: true, priority: b.priority, bill_id: b.id, bill_number: b.bill_number, title: `${advocate(d.submitted_by)?.full_name || 'Someone'} submitted testimony for your approval`, body: `${d.committee} hearing`, at: d.submitted_at || d.created_at, tab: 'details', unread: true });
      if (d.status === 'draft' && d.review_note && mineIds.has(b.id)) out.push({ key: 'n:r' + d.id, kind: 'testimony', direct: true, priority: b.priority, bill_id: b.id, bill_number: b.bill_number, title: 'Changes requested on your testimony', body: d.review_note, at: d.approved_at || d.created_at, tab: 'details', unread: true }); }
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
  if (upcoming[0] && S.advocates[1]) S.attend[upcoming[0].id] = [S.advocates[1].id];
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
    const dt = new Date(h.scheduled_at), title = `Send an email blast for the ${h.committee} hearing ${dt.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', timeZone: 'Pacific/Honolulu' })}`;
    (S.todos[b.id] ??= []).push({ id: 'eb' + h.id, bill_id: b.id, title, done: false, due_date: new Date(h.testimony_deadline || dt - 864e5).toLocaleDateString('en-CA', { timeZone: 'Pacific/Honolulu' }), assignee_id: (S.assignments[b.id] || [])[0] || null, sort_order: -1, created_at: new Date().toISOString() }); }
  if (anchor) S.todos[anchor.id] = (S.todos[anchor.id] || []).concat([
    { id: 'td1', bill_id: anchor.id, title: 'Draft testimony for the next hearing',
      done: false, due_date: day(-2), assignee_id: S.advocates[0].id, sort_order: 0,
      created_at: new Date().toISOString() },
    { id: 'td2', bill_id: anchor.id, title: 'Confirm coalition sign-ons',
      done: false, due_date: day(4), assignee_id: S.advocates[1].id, sort_order: 1,
      created_at: new Date().toISOString() },
    { id: 'td3', bill_id: anchor.id, title: 'Send one-pager to committee staff',
      done: true, due_date: null, assignee_id: S.advocates[2].id, sort_order: 2,
      created_at: new Date().toISOString() },
  ]);
  S.compStage = sc.compStage; DEMO_TL = sc.tl;
  S.feed = sc.tl.filter(t => t.source === 'team');
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

// ---------------- filtering ----------------
// Facets: within a group any selected value matches (P1 or P2); across groups
// every group must match (P1 AND Healthy eating). Flags are yes/no checks.
// Every option shows how many bills it would leave, counted against the other
// groups' selections, so nobody clicks into an empty list. One record of facts
// per bill per render keeps that cheap.
export const isOwner = b => !!S.me && (S.assignments[b.id] || []).includes(S.me.id);
export const isMuted = b => !!S.mutes?.has(b.id);
export const isMine = b => !!S.me && (isOwner(b) || !!S.follows?.has(b.id)) && !isMuted(b);
// The first hearing still ahead, which is what keeps a bill from being muted.
export let SESSION_OVER = DEMO ? DEMO_OFF : true;   // set from the calendar at load: over once sine die has passed
// Official session calendar (LRB, 2026). One place to update each December.
// The sandbox uses the same calendar, frozen at DEMO_ASOF.
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
  if (Object.keys(dl).length >= 8) { DEADLINES = dl; SESSION_YEAR = yr; }
  const sine = mine.find(r => r.key === 'sine_die');
  SESSION_OVER = DEMO ? DEMO_OFF : !!sine && Date.now() > new Date(sine.deadline_date + 'T23:59:59-10:00').getTime() + 864e5;
}
// Dying-quietly radar: committee stages where "no hearing scheduled" is the
// death signal, and the deadline each stage races. Bills still at Introduced
// race the lateral (or triple, if 3X) filing date.
export const islandOf = sd => sd >= 1 && sd <= 4 ? 'Hawaiʻi' : sd >= 5 && sd <= 7 ? 'Maui' : sd === 8 ? 'Kauaʻi' : sd >= 9 && sd <= 25 ? 'Oʻahu' : null;
export const personById = id => (S.people || []).find(p => p.id === id);
export const EMPTY_PF = () => ({ q: '', tags: [], interests: [], islands: [], house: [], senate: [], account: 'any', optin: false, bills: [], lists: [], campaigns: [], active_days: 0, acted: false });
export function peopleMatch(p, f) {
  f = { ...EMPTY_PF(), ...(f || {}) };
  const q = f.q.trim().toLowerCase();
  if (q && !`${p.name || ''} ${p.email} ${p.phone || ''}`.toLowerCase().includes(q)) return false;
  if (f.tags.length && !f.tags.some(t => (p.tags || []).includes(t))) return false;
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
];
export function bestCampaign(r) {
  if (r.lookalike?.coalition) { const c = S.campaigns.find(x => x.name === r.lookalike.coalition); if (c) return c; }
  if (r.matches?.length) { const c = S.campaigns.find(x => x.id === r.matches[0].campaign_id); if (c) return c; }
  return S.campaigns.find(c => c.name === 'General HIPHI') || S.campaigns[0];
}
// Simple: the New bills instructions show on the first visit, then fold into a "How this works" link.
export function demoTransition(d, action, note, url) {
  const me = S.me, now = new Date().toISOString();
  const bad = m => { throw new Error(m); };
  if (action === 'submit') Object.assign(d, { status: 'review', submitted_by: me.id, submitted_at: now, review_note: null });
  else if (action === 'approve' && d.status === 'review') {
    if (!me.is_admin) bad('The first approval is by an admin');
    const first = !Object.values(S.drafts).flat().some(x => x.bill_id === d.bill_id && x.id !== d.id && ['approved', 'filed'].includes(x.status));
    Object.assign(d, { status: first ? 'second_review' : 'approved', approved_by: me.id, approved_at: now, first_for_bill: first });
  } else if (action === 'approve' && d.status === 'second_review') {
    if (!me.is_reviewer) bad('The second approval is by a reviewer (Jess or Jaylen)');
    Object.assign(d, { status: 'approved', second_approved_by: me.id, second_approved_at: now });
  } else if (action === 'request_changes') Object.assign(d, { status: 'draft', review_note: note || null });
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
// v2 only: the frame clears the recovery flag after a new password is saved (an imported `let` cannot be assigned).
export const setRecovery = v => { RECOVERY = v; };
