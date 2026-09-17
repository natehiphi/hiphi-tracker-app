// ============================================================
// HIPHI Bill Tracker — staff app
// Views: Portfolio · Pipeline · Table · Desk · Cards  (+ bill drawer, add bills)
// Data: Supabase (RLS-protected). Demo mode: append ?demo=1
// ============================================================
const SUPABASE_URL = 'https://eivzjbnygscguqqiiuvh.supabase.co';
const SUPABASE_KEY = 'sb_publishable_uvEtw8ru3zB9lDOxAjzrUA_JEFvKyul';
import { billStop, COLUMNS, BOARD_EXPLAINER, CHAMBER_NAME } from './stops.js';
const DEMO = new URLSearchParams(location.search).has('demo');
// Sandbox: the real 2026 session frozen at Monday March 16, 2026, 9:00 HST
// (demo/snapshot.json, built by Bill-Tracker/tools/build_snapshot.js). The
// clock starts there and runs forward for the length of the visit, so
// countdowns tick but nothing new ever arrives.
const DEMO_ASOF = '2026-03-16T09:00:00-10:00';
if (DEMO) {
  const RD = Date, off = RD.now() - new RD(DEMO_ASOF).getTime();
  window.Date = class extends RD { constructor(...a) { a.length ? super(...a) : super(RD.now() - off); } static now() { return RD.now() - off; } };
}
const isMobile = () => matchMedia('(max-width:760px)').matches;
// Auth email links (password recovery, magic link) come back with their payload
// in the URL hash. supabase-js clears that hash the instant the client is
// created, so read what we need synchronously, before DB.init() runs.
const HASH_Q = new URLSearchParams(location.hash.slice(1));
let RECOVERY = HASH_Q.get('type') === 'recovery';
// A spent or expired link returns #error=...&error_description=... instead.
// Surfacing it matters: without it the app showed a bare sign-in form, the link
// looked like it had done nothing, and clicking again burned the next token too.
const LINK_ERR = HASH_Q.get('error_description') || '';
// Own origin + path, so the GitHub Pages subpath is picked up automatically.
const APP_URL = location.origin + location.pathname;
// January flip: see JANUARY.md in the Bill-Tracker repo. Update SESSION_YEAR
// here, plus SESSION_OVER and DEADLINES in the Cards-view block below.
let SESSION_YEAR = 2026;   // overwritten from session_deadlines at load (applySessionDeadlines)

const STAGES = [
  ['introduced','Introduced'], ['first_triple','1st Triple'], ['first_lateral','1st Lateral'],
  ['first_decking','1st Decking'], ['first_crossover','Crossover'], ['second_triple','2nd Triple'],
  ['second_lateral','2nd Lateral'], ['second_decking','2nd Decking'],
  ['second_crossover','Passed Both'], ['conference','Conference'], ['governor','Governor'],
  ['enacted','Law'], ['vetoed','Vetoed'], ['dead','Dead'],
];
const STAGE_LABEL = Object.fromEntries(STAGES);
const POSITIONS = [['','—'],['strongly_support','Strongly support'],['support','Support'],['support_amend','Support w/ amendments'],['strongly_oppose','Strongly oppose'],
  ['oppose','Oppose'],['monitor','Monitor'],['neutral','Comments (neutral)']];
const POS_CLS = { strongly_support: 'c-green', support: 'c-green', support_amend: 'c-green', strongly_oppose: 'c-red', oppose: 'c-red', monitor: 'c-gray', neutral: 'c-gold' };
const LOG_TYPES = [['testimony','Testimony'],['coalition','Coalition'],['meeting','Meeting'],
  ['action_alert','Action alert'],['note','Note']];
const COLORS = ['#0E7C86','#5B7FBF','#B9713A','#7E5BA6','#3E8E63','#A65B7E'];

// ---------------- state ----------------
const S = {
  tripleF: false, syncRuns: [], selected: new Set(), sinceVisit: 0, sinceEvents: [], compStage: {},
  supa: null, session: null, me: null,
  advocates: [], bills: [], hearings: [], pulse: {}, campaigns: [], feed: [],
  assignments: {},           // bill_id -> [advocate_id]
  billCampaigns: {},         // bill_id -> [campaign_id]
  // Validated on read: a view name persisted by an older build (or by a
  // build where that view still existed) must not leave someone staring
  // at an empty page. Unknown names fall back.
  view: (v => ['portfolio','pipeline','desk','table','cards','add','settings','help','triage'].includes(v)
              ? v : 'portfolio')(localStorage.getItem('view')),
  owner: 'me', q: '', pri: '', pris: new Set(), camps: new Set(), stageF: '', camp: '',
  drawerBill: null, logType: 'testimony', sort: ['bill_number', 1],
  todos: {},   // bill_id -> [todo]
  drafts: {},  // bill_id -> [testimony draft]
  drawerOpen: { bill: null, pub: false, notes: false, details: false, team: false, todo: false },   // per bill: survives the re-render a save causes, resets when another bill opens
  committees: {},   // code -> {name, chair, vice_chair}; empty until the committees table exists
  deskOut: false,
};
const $ = sel => document.querySelector(sel);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
  ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const toast = (msg, err) => {
  const d = document.createElement('div');
  d.className = 'toastmsg' + (err ? ' err' : ''); d.textContent = msg;
  $('#toast').append(d); setTimeout(() => d.remove(), 3600);
};
// A date-only value (2026-03-16) is a Hawaiʻi calendar day, not UTC midnight.
const asDate = d => new Date(/^\d{4}-\d{2}-\d{2}$/.test(String(d)) ? d + 'T12:00:00-10:00' : d);
const fmtDate = (d, opts) => d ? asDate(d).toLocaleString('en-US',
  { timeZone: 'Pacific/Honolulu', month: 'numeric', day: 'numeric', ...opts }) : '—';
const fmtDT = d => fmtDate(d, { hour: 'numeric', minute: '2-digit' });
const daysAgo = d => d ? Math.floor((Date.now() - new Date(d)) / 864e5) : null;
const effStage = b => b.stage_override || b.stage || 'introduced';
const advocate = id => S.advocates.find(a => a.id === id);
const owners = b => (S.assignments[b.id] || []).map(advocate).filter(Boolean);
const capitolUrl = b => {
  const m = (b.bill_number||'').match(/^([A-Z]+)(\d+)$/);
  return m ? `https://www.capitol.hawaii.gov/session/measure_indiv.aspx?billtype=${m[1]}&billnumber=${m[2]}&year=${b.session_year||SESSION_YEAR}`
           : (b.state_url || '#');
};
const AMENDED_RE = /as amended|\b[HSC]D\s*\d/i;
const sponsorText = b => {
  const sp = b.sponsors || []; if (!sp.length) return '\u2014';
  const names = sp.slice(0, 6).map((s, i) => i === 0 ? `<b>${esc(s.n)}</b>` : esc(s.n)).join(', ');
  return names + (sp.length > 6 ? ` +${sp.length - 6} more` : '');
};
const av = (a, cls='avatar') =>
  `<span class="${cls}" style="background:${a?.color || '#8FA1AD'}" title="${esc(a?.full_name||'')}">${esc(a?.initials || '?')}</span>`;

// ---------------- data layer ----------------
const DB = {
  async init() {
    if (DEMO) { await demoInit(); return; }
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
    S.supa = createClient(SUPABASE_URL, SUPABASE_KEY);
    const { data } = await S.supa.auth.getSession();
    S.session = data.session;
    S.supa.auth.onAuthStateChange((e, sess) => {
      const had = !!S.session; S.session = sess;
      // A recovery link creates a real session, so without this branch boot()
      // would just load the app and never offer to set a new password.
      if (e === 'PASSWORD_RECOVERY') { RECOVERY = true; renderRecovery(); return; }
      if (!!sess !== had) boot();
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
    const [adv, bills, asg, camps, bc, hear, pulse, feed, todos, drafts, comms, scfg, ccfg, ecfg, sycfg, dls, slots, fol, att, outc, msgs, reads] = await Promise.all([
      S.supa.from('advocates').select('*').order('full_name'),
      S.supa.from('bills').select('*').eq('tracked', true).order('bill_number').limit(2000),
      S.supa.from('bill_assignments').select('bill_id,advocate_id'),
      S.supa.from('campaigns').select('*').order('sort_order'),
      S.supa.from('bill_campaigns').select('bill_id,campaign_id'),
      S.supa.from('hearings').select('*').gte('scheduled_at', new Date(Date.now()-60*864e5).toISOString()),
      S.supa.from('bill_pulse').select('*'),
      S.supa.from('activity_log').select('*').eq('source','team')
        .order('occurred_at', { ascending: false }).limit(25),
      S.supa.from('bill_todos').select('*').order('sort_order').order('created_at'),
      S.supa.from('testimony_drafts').select('*').order('created_at'),
      S.supa.from('committees').select('*'),
      S.supa.from('app_settings').select('value').eq('key', 'slack').maybeSingle(),
      S.supa.from('app_settings').select('value').eq('key', 'calendar').maybeSingle(),
      S.supa.from('app_settings').select('value').eq('key', 'email').maybeSingle(),
      S.supa.from('app_settings').select('value').eq('key', 'sync').maybeSingle(),
      S.supa.from('session_deadlines').select('*'),
      S.supa.from('committee_slots').select('*'),
      S.supa.from('bill_follows').select('advocate_id,bill_id'),
      S.supa.from('hearing_attendance').select('hearing_id,advocate_id'),
      S.supa.from('hearing_outcomes').select('*').gte('scheduled_at', new Date(Date.now() - 14 * 864e5).toISOString()),
      S.supa.from('bill_messages').select('*').is('deleted_at', null).gte('created_at', new Date(Date.now() - 90 * 864e5).toISOString()).order('created_at'),
      S.supa.from('bill_message_reads').select('*'),
    ]);
    S.messages = {}; (msgs?.data || []).forEach(m => (S.messages[m.bill_id] ??= []).push(m));
    S.chatSeen = Object.fromEntries((reads?.data || []).map(r => [r.bill_id, r.seen_at]));
    S.slackCfg = scfg?.data?.value || null;
    S.calCfg = ccfg?.data?.value || null;
    S.emailCfg = ecfg?.data?.value || { enabled: true };
    S.syncCfg = sycfg?.data?.value || {};
    applySessionDeadlines(dls?.data || []);
    S.slots = slots?.data || [];
    S.followersBy = {}; (fol?.data || []).forEach(r => (S.followersBy[r.bill_id] ??= []).push(r.advocate_id));
    S.attend = {}; (att?.data || []).forEach(r => (S.attend[r.hearing_id] ??= []).push(r.advocate_id));
    S.outcomes = Object.fromEntries((outc?.data || []).map(o => [o.hearing_id, o]));
    for (const r of [adv, bills, asg, camps, bc, hear, pulse, feed])
      if (r.error) throw r.error;
    S.advocates = adv.data; S.bills = bills.data; S.campaigns = camps.data;
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
    // Nothing owned or followed yet: the empty "My bills" page helps nobody.
    if (S.me && S.owner === 'me' && !S.bills.some(b => (S.assignments[b.id] || []).includes(S.me.id) || S.follows.has(b.id))) S.owner = 'all';
    // Freshness indicator data - never let this block the app
    try {
      const sr = await S.supa.from('sync_runs').select('finished_at,ok')
        .order('started_at', { ascending: false }).limit(10);
      S.syncRuns = sr.data || [];
    } catch { S.syncRuns = []; }
    // Companion stages for the "companion alive" chip (non-fatal)
    try {
      const nums = [...new Set(S.bills.flatMap(b => b.companions || []))];
      if (nums.length) {
        const ci = await S.supa.from('bills').select('bill_number,stage,stage_override')
          .in('bill_number', nums);
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
    // Everything that happened in the last 72 hours, every source (non-fatal)
    try {
      const rc = await S.supa.from('activity_log')
        .select('bill_id,title,details,occurred_at,type,advocate_id,source')
        .gt('occurred_at', new Date(Date.now() - 72 * 3600e3).toISOString())
        .order('occurred_at', { ascending: false }).limit(300);
      S.recentEvents = rc.data || [];
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
  async attend(hearingId, on) {
    S.attend ??= {}; const cur = S.attend[hearingId] || [];
    S.attend[hearingId] = on ? [...new Set([...cur, S.me.id])] : cur.filter(id => id !== S.me.id);
    if (DEMO) return;
    const r = on ? await S.supa.from('hearing_attendance').insert({ hearing_id: hearingId, advocate_id: S.me.id })
                 : await S.supa.from('hearing_attendance').delete().eq('hearing_id', hearingId).eq('advocate_id', S.me.id);
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
    const tok = S.session?.access_token;
    if (tok) fetch(`${SUPABASE_URL}/functions/v1/notify-send`, { method: 'POST',
      headers: { Authorization: `Bearer ${tok}`, apikey: SUPABASE_KEY } }).catch(() => {});
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
    if (DEMO) { toast('Sandbox: nothing to connect'); return; }
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
    if (DEMO) return;
    await S.supa.from('bill_message_reads').upsert({ advocate_id: S.me.id, bill_id: billId, seen_at: S.chatSeen[billId] });
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
function snapshotScenario(snap) {
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
let DEMO_TL = [];
async function demoInit() {
  const snap = await (await fetch('demo/snapshot.json', { cache: 'force-cache' })).json();
  S.snapshot = snap;
  S.advocates = snap.advocates.map(a => ({ ...a, color: a.color || '#0E7C86' }));
  S.me = S.advocates.find(a => a.is_admin) || S.advocates[0];
  const byIni = Object.fromEntries(S.advocates.map(a => [a.initials, a.id]));
  S.campaigns = snap.campaigns;
  S.slots = snap.slots;
  applySessionDeadlines(snap.deadlines);
  S.slackCfg = { main_channel: '#hearing-alerts-2027', positions: ['strongly_support','support','support_amend','strongly_oppose','oppose','neutral'], workflow_dm: true, health_dm: true,
    reminder_defaults: { morning: '08:35', morning_on: true, hours_before: 1, before_on: true, after: '16:00', after_on: true },
    daily: { enabled: true, time: '07:00', days_ahead: 7, channel: null, post_when_empty: false },
    templates: { hearing_alert: '📅 *{{bill}}* · {{position}}{{priority}}{{owner}}\n{{title}}\n{{committee}} hearing · {{hearing}} · {{room}}\nWritten testimony due *{{deadline}}*\n<{{tracker}}|Open in tracker> · <{{pdf}}|Notice PDF>',
      draft_thread: '📝 Draft ready{{owner_for}}: <{{draft}}|Google Doc> · <{{tracker}}|tracker>' } };
  const sc = snapshotScenario(snap);
  S.bills = sc.bills; S.hearings = sc.hearings; S.pulse = sc.pulse;
  S.committees = Object.fromEntries(snap.committees.map(c => [c.code, c]));
  // A testimony draft on the soonest upcoming hearing, so the drawer section
  // and the Desk link have something to show in the sandbox.
  // Seeded on the first bill (same one the To do seed uses) so the drawer
  // always has a Testimony section to show; the committee is that bill's
  // soonest hearing if it has one, so the Desk link appears too when that
  // hearing is inside the 48-hour window.
  S.drafts = {};
  const anchor = S.bills.find(b => b.priority === 1 && b.stage !== 'dead' && (sc.assignments[b.id] || []).includes(S.me.id) && sc.hearings.some(h => h.bill_id === b.id && new Date(h.scheduled_at) > Date.now())) || S.bills.find(b => b.stage !== 'dead') || S.bills[0];
  if (anchor) {
    const b0 = anchor;
    const h0 = sc.hearings.filter(h => h.bill_id === b0.id)
      .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at))[0];
    // In review, from Kevin: the admin (you, in demo) gets Approve / Request changes.
    S.drafts[b0.id] = [{ id: 'dd1', bill_id: b0.id, committee: h0 ? h0.committee : (b0.committee || 'FIN'),
      status: 'review', submitted_by: byIni.KV, submitted_at: new Date(Date.now() - 3 * 36e5).toISOString(),
      doc_url: 'https://docs.google.com/document/d/demo/edit', created_at: new Date().toISOString() }];
  }
  // And one per hearing in the coming week, so whichever bills the Desk
  // "hearing posted" band shows under the current lens, a link is there.
  // (Demo hearings carry no testimony_deadline; scheduled_at is the key.)
  let n = 2, approvedSeeded = false;
  for (const h of sc.hearings.filter(h => new Date(h.scheduled_at) > new Date()
      && new Date(h.scheduled_at) - Date.now() < 7 * 864e5)) {
    if ((S.drafts[h.bill_id] || []).some(d => d.committee === h.committee)) continue;
    // Cycle through the workflow states so every button shows up somewhere.
    let st = ['filed', 'second_review', 'draft', 'approved'][(n - 2) % 4];
    // The Desk opens on "my bills", so make sure one of Nate's has the
    // approved-not-filed state - that is the button training should practise.
    if (!approvedSeeded && (sc.assignments[h.bill_id] || []).includes(S.me.id)) { st = 'approved'; approvedSeeded = true; }
    const ago = h => new Date(Date.now() - h * 36e5).toISOString();
    (S.drafts[h.bill_id] ??= []).push({ id: 'dd' + n++, bill_id: h.bill_id, committee: h.committee,
      status: st, doc_url: 'https://docs.google.com/document/d/demo' + n + '/edit',
      created_at: ago(30), submitted_by: st === 'draft' ? null : byIni.KR, submitted_at: st === 'draft' ? null : ago(20),
      approved_by: ['approved', 'filed', 'second_review'].includes(st) ? byIni.NT : null, approved_at: ago(10),
      second_approved_by: st === 'filed' ? byIni.JS : null, second_approved_at: ago(6),
      filed_by: st === 'filed' ? byIni.KR : null, filed_at: st === 'filed' ? ago(2) : null,
      version: S.bills.find(b => b.id === h.bill_id)?.current_version || null,
      review_note: st === 'draft' ? 'Cite the 2024 BRFSS numbers in paragraph two.' : null });
  }
  S.assignments = sc.assignments; S.billCampaigns = sc.billCampaigns;
  // Versions and outcomes are in the snapshot; one follow and one attendance
  // are seeded so those panels have something to show.
  S.follows = new Set(); S.followersBy = {}; S.attend = {}; S.outcomes = Object.fromEntries(snap.outcomes.map(o => [o.hearing_id, o]));
  S.demoTriaged = new Set();
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
}

// ---------------- filtering ----------------
function visibleBills() {
  let list = S.bills;
  if (S.owner === 'me' && S.me) list = list.filter(b => (S.assignments[b.id]||[]).includes(S.me.id) || (S.follows || new Set()).has(b.id));
  else if (S.owner && S.owner !== 'all' && S.owner !== 'me')
    list = list.filter(b => (S.assignments[b.id]||[]).includes(S.owner));
  if (S.pris.size) list = list.filter(b => S.pris.has(b.priority));
  if (S.camps.size) list = list.filter(b => (S.billCampaigns[b.id] || []).some(c => S.camps.has(c)));
  if (S.stageF) list = list.filter(b => effStage(b) === S.stageF);
  if (S.tripleF) list = list.filter(isTriple);
  if (S.q) {
    const q = S.q.toLowerCase(), qn = q.replace(/\s/g,'');
    list = list.filter(b => b.bill_number.toLowerCase().includes(qn) ||
      (b.title||'').toLowerCase().includes(q));
  }
  const [key, dir] = S.sort;
  return [...list].sort((a,b) => {
    const va = key==='owner' ? (owners(a)[0]?.full_name||'') : key==='pulse'
      ? (S.pulse[a.id]?.last_team_touch||'') : (a[key] ?? '');
    const vb = key==='owner' ? (owners(b)[0]?.full_name||'') : key==='pulse'
      ? (S.pulse[b.id]?.last_team_touch||'') : (b[key] ?? '');
    return (va > vb ? 1 : va < vb ? -1 : 0) * dir;
  });
}

// ---------------- shared chrome ----------------
// Portfolio is the home page (Nate, 9/14). The other views stay available
// under "More" (Table is desktop-only: it never worked at phone width).
const MORE_VIEWS = [['triage','Triage'],['desk','Desk'],['pipeline','Pipeline'],['table','Table'],['cards','Cards'],['settings','Settings'],['help','Help']];
const lensName = () => S.owner === 'me' ? 'My bills' : S.owner === 'all' ? 'Everyone' : (advocate(S.owner)?.full_name || 'My bills');
const filterCount = () => S.pris.size + S.camps.size + (S.tripleF ? 1 : 0) + (S.stageF ? 1 : 0);
const filterLabel = () => [S.pris.size ? [...S.pris].sort().map(p => 'P' + p).join(', ') : null,
  S.camps.size ? [...S.camps].map(id => S.campaigns.find(c => c.id === id)?.name).filter(Boolean).join(', ') : null,
  S.tripleF ? 'triple-referred' : null,
  S.stageF ? (STAGE_LABEL[S.stageF] || S.stageF) : null].filter(Boolean).join(' · ');
function filterSummary() {
  const who = S.owner === 'me' ? 'My bills' : S.owner === 'all' ? 'All tracked' : (advocate(S.owner)?.full_name || '');
  return [who, S.q ? `“${S.q}”` : null, S.pris.size ? [...S.pris].sort().map(p => 'P' + p).join(', ') : null,
    S.stageF ? (STAGE_LABEL[S.stageF] || S.stageF) : null, S.tripleF ? '3X' : null].filter(Boolean).join(' · ');
}
function chrome(inner) {
  const upcoming = S.hearings
    .filter(h => new Date(h.scheduled_at) > new Date())
    .sort((a,b) => a.scheduled_at.localeCompare(b.scheduled_at));
  const in48 = upcoming.filter(h =>
    h.testimony_deadline && new Date(h.testimony_deadline) - Date.now() < 48*3600e3);
  const banner = in48.length ? `
    <div class="alert"><div class="ic">⏱</div>
      <div><b>${in48.length} bill${in48.length>1?'s':''} in the testimony window</b><br>
      <span style="font-size:12px;color:#E7B7AE">Deadlines computed from posted hearing notices</span></div>
      ${in48.slice(0,3).map(h => { const b = S.bills.find(x=>x.id===h.bill_id); return b ? `
        <span class="item"><b>${esc(b.bill_number)}</b> · ${esc(h.committee)} · testimony due ${fmtDT(h.testimony_deadline)}</span>` : ''; }).join('')}
    </div>` : '';
  const lastOk = (S.syncRuns || []).find(r => r.ok)?.finished_at;
  const latestFailed = (S.syncRuns || [])[0]?.ok === false;
  const hrs = lastOk ? Math.round((Date.now() - new Date(lastOk)) / 36e5) : null;
  const stale = !DEMO && (latestFailed || hrs == null || hrs > 36);
  const freshTxt = DEMO ? 'demo data'
    : hrs == null ? 'no sync recorded'
    : hrs < 1 ? 'data current'
    : hrs < 48 ? `data ${hrs}h old` : `data ${Math.round(hrs / 24)}d old`;
  return `
    <div class="top staff">
      <span class="logo"><span class="mark">☀</span>HIPHI Bill Tracker</span>
      <div class="viewtabs">
        <button data-view="portfolio" class="${S.view==='portfolio'?'on':''}">Portfolio</button>
        <button data-view="add" class="${S.view==='add'?'on':''}">+ Add bills</button>
        <details class="more">
          <summary class="${MORE_VIEWS.some(([v]) => v === S.view) ? 'on' : ''}">${MORE_VIEWS.find(([v]) => v === S.view)?.[1] || 'More'} ▾</summary>
          <div class="menu">
            ${MORE_VIEWS.map(([v,l]) => `<button data-view="${v}" class="${S.view===v?'on':''}">${l}</button>`).join('')}
            <button id="logout2">Sign out</button>
          </div>
        </details>
      </div>
      <input type="search" class="qbox topq" placeholder="Search any bill…" value="${esc(S.q)}" aria-label="Search any bill">
      <span class="fresh"${stale ? ' style="color:#C2483B;font-weight:600" title="The daily sync has not completed successfully recently - data may be stale"' : ''}>${SESSION_YEAR} session · ${S.bills.length} tracked · ${freshTxt}</span>
      <span class="who">${av(S.me)}<button id="logout">sign out</button></span>
    </div>
    <div class="controls">
      <input type="search" class="qbox rowq" placeholder="Search any bill…" value="${esc(S.q)}" aria-label="Search any bill">
      <details class="pillmenu lens"><summary class="fchip on">Viewing: ${esc(lensName())} ▾</summary>
        <div class="menu">
          <button data-owner="me" class="${S.owner==='me'?'on':''}">${S.me ? av(S.me, 'avatar sm') : ''}<span>My bills</span></button>
          <button data-owner="all" class="${S.owner==='all'?'on':''}"><span class="avatar sm all">☀</span><span>Everyone</span></button>
          ${S.advocates.filter(a => a.is_active !== false && a.id !== S.me?.id).map(a => `<button data-owner="${a.id}" class="${S.owner===a.id?'on':''}">${av(a, 'avatar sm')}<span>${esc(a.full_name)}</span></button>`).join('')}
        </div></details>
      <details class="pillmenu filt"><summary class="fchip ${filterCount() ? 'on' : ''}">${filterCount() ? 'Filter: ' + esc(filterLabel()) : 'Filter'} ▾</summary>
        <div class="menu">
          <div class="mh">Priority</div>
          ${[1,2,3].map(p => `<label><input type="checkbox" data-prif="${p}" ${S.pris.has(p)?'checked':''}> P${p}${p===1?' · highest':p===3?' · lowest':''}</label>`).join('')}
          <div class="mh">Coalition</div>
          ${S.campaigns.map(c => `<label><input type="checkbox" data-campf="${c.id}" ${S.camps.has(c.id)?'checked':''}> ${esc(c.name)}</label>`).join('')}
          <div class="mh">Referral</div>
          <label><input type="checkbox" id="triplef" ${S.tripleF?'checked':''}> Triple-referred only</label>
          ${S.view==='table' ? `<div class="mh">Stage</div><select id="stagef"><option value="">Any stage</option>${STAGES.map(([v,l])=>`<option ${S.stageF===v?'selected':''} value="${v}">${l}</option>`).join('')}</select>` : ''}
          ${filterCount() ? '<button class="clear" id="clearf">Clear filters</button>' : ''}
        </div></details>
      ${S.view==='table' ? '<button class="fchip" id="csv">⬇ Export CSV</button>' : ''}
      ${filterCount() ? `<span class="filtline">Showing ${esc(filterLabel())} only · <a id="clearf2">clear</a></span>` : ''}
    </div>
    ${inner}`;
}

function statusChip(b) {
  const st = effStage(b);
  const h = S.hearings.find(h => h.bill_id === b.id && new Date(h.scheduled_at) > new Date());
  if (h) {
    const urgent = h.testimony_deadline && new Date(h.testimony_deadline) - Date.now() < 48*3600e3;
    return `<span class="chipx ${urgent?'c-red':'c-gold'}">◷ Hearing ${fmtDT(h.scheduled_at)} · ${esc(h.committee)}</span>`;
  }
  const cls = st==='enacted' ? 'c-green' : (st==='dead'||st==='vetoed') ? 'c-gray' :
              st==='governor' ? 'c-navy' : 'c-teal';
  return `<span class="chipx ${cls}">${STAGE_LABEL[st]}</span>`;
}
function pulseCell(b) {
  const p = S.pulse[b.id], d = daysAgo(p?.last_team_touch);
  const dot = d==null ? 'd-n' : d<=3 ? 'd-g' : d<=7 ? 'd-a' : 'd-r';
  return `<span class="pulse"><span class="dot ${dot}"></span>${d==null?'never':d===0?'today':d+'d ago'}</span>`;
}

// ---------------- views ----------------
// ---------- the deadline board: three columns keyed to the session's current deadline ----------
// A bill's stage names the phase it is racing (introduced / 1st triple /
// 1st lateral / 1st decking ...). The session calendar (DEADLINES) has one
// date per phase. The board picks the next deadline on the calendar and
// sorts every live bill by where it stands against it: needs a hearing,
// hearing on the books, or already past that phase. When the date passes the
// board re-keys itself to the next deadline and the same bill can be back in
// column A, waiting for its next hearing. Triple-filing deadlines only bind
// 3-stop bills; everyone else is measured against the lateral that follows.
const STAGE_ORDER = Object.fromEntries(STAGES.map(([v], i) => [v, i]));
const BOARD_CAP = 15;
function deadlineCalendar() {
  return Object.entries(DEADLINES).flatMap(([phase, arr]) => arr.map(([label, date]) => ({ phase, label, date })))
    .sort((a, b) => a.date.localeCompare(b.date));
}
function currentDeadline() {
  const now = Date.now();
  return deadlineCalendar().find(d => new Date(d.date + 'T23:59:59-10:00') > now) || null;
}
// The deadline a given bill is racing right now: the date for the phase its
// stage names (nextDeadline). A bill still in a committee phase whose date has
// already passed is flagged as missed rather than hidden.
function billDeadline(b) {
  return stopOf(b).deadline;
}
// Last regular meeting slot of a committee on or before a date (from the
// Capitol's published schedules, committee_slots), and the 48-hour notice
// cutoff for it. Joint committees use the first code. Null without a schedule.
function lastSlotBefore(code, dateStr, slots) {
  const c = String(code || '').split('/')[0];
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

// "waiting in HHS · Chair Rep. Takayama": the person to call when a bill is stuck.
function chairOf(code) {
  const c = S.committees?.[String(code || '').split('/')[0]];
  if (!c?.chair) return '';
  const m = chairMail(code);
  return ` · Chair <a class="chairmail" href="mailto:${esc(m.email)}" onclick="event.stopPropagation()" title="${esc(m.email)}">${esc(m.title)} ${esc(m.last)}</a>`;
}
function pfBoard(list) {
  const cur = currentDeadline();
  if (SESSION_OVER || !cur) return { html: '', a: [], b: [], c: [] };
  const now = Date.now();
  // Each live bill is placed by where it stands (stops.js): needs a hearing,
  // hearing scheduled or held, or through committee. Monitor bills, dead
  // bills and bills that missed their deadline stay off the board.
  const cols = { a: [], b: [], c: [] };
  for (const b of list) {
    if (b.position === 'monitor' || diedish(b)) continue;
    const st = stopOf(b);
    if (!st.column) continue;
    cols[st.column].push({ b, st, h: st.hearing, dl: st.deadline });
  }
  const { a, b: bcol, c } = cols;
  const days = d => Math.ceil((new Date(d + 'T23:59:59-10:00') - now) / 864e5);
  a.sort((x, y) => byPri(x, y) || (x.dl ? days(x.dl.date) : 999) - (y.dl ? days(y.dl.date) : 999) || x.b.bill_number.localeCompare(y.b.bill_number));
  bcol.sort((x, y) => byPri(x, y) || x.h.scheduled_at.localeCompare(y.h.scheduled_at));
  c.sort((x, y) => byPri(x, y) || (y.b.last_action_date || '').localeCompare(x.b.last_action_date || '') || x.b.bill_number.localeCompare(y.b.bill_number));
  const more = S.boardMore || {};
  const col = (key, rows, rowFn, empty) => {
    const C = COLUMNS[key], shown = more[key] ? rows : rows.slice(0, BOARD_CAP);
    return `<div class="panel bcol bcol-${key}" id="pf-board-${key}"><div class="ph"><span>${C.icon} ${C.title} <span class="cnt">${rows.length}</span></span><span class="psub">${C.sub}</span></div>
      ${rows.length ? `<div class="chips">${shown.map(rowFn).join('')}</div>` : `<div class="pempty">${empty}</div>`}
      ${rows.length > BOARD_CAP ? `<button class="pempty boardmore" data-boardmore="${key}">${more[key] ? 'Show fewer' : `…and ${rows.length - BOARD_CAP} more`}</button>` : ''}
    </div>`;
  };
  const who = b => owners(b)[0] ? av(owners(b)[0], 'avatar sm') : '';
  const pri = b => b.priority ? `<span class="pri">P${b.priority}</span>` : '';
  const stopn = st => st.stops ? `<span class="stopn">${CHAMBER_NAME[st.chamber]} · stop ${st.stop} of ${st.stops}</span>` : `<span class="stopn">${CHAMBER_NAME[st.chamber]}</span>`;
  const phaseLabel = st => st.phase === 'conference' ? 'Conference' : `${CHAMBER_NAME[st.chamber]} floor`;
  const html = `
    <div class="dashhead boardhead"><h1>Where every bill stands</h1>
      <span class="sub">Next deadline: <b>${esc(cur.label)}</b> · ${fmtDate(cur.date)} · <b>${days(cur.date)}d</b> away. Each bill shows the deadline it is racing; bills re-sort as dates pass.</span></div>
    <p class="boardhow">${BOARD_EXPLAINER}</p>
    <div class="board3">
      ${col('a', a, ({ b, st, dl }) => `
        <div class="chip3 ${posCls(b)}${priCls(b)}" data-bill="${b.id}">
          <span class="l1"><b>${esc(billNum(b))}</b>${pri(b)}<span class="cm">${st.committee ? esc(st.committee) + chairOf(st.committee) : 'awaiting referral'}</span>${who(b)}</span>
          <span class="lstop">Waiting in ${st.committee ? `${esc(st.committee)}, the ${CHAMBER_NAME[st.chamber]}’s ${['first', 'second', 'third', 'fourth'][st.stop - 1] || st.stop + 'th'} of ${st.stops} committee${st.stops === 1 ? '' : 's'}` : `the ${CHAMBER_NAME[st.chamber]} for a committee referral`}</span>
          <span class="ldesc">${esc(blurb(b, 120))}</span>
          <span class="l2">${dl ? (dl.days <= 5 ? `<span class="hot">Needs a hearing by ${fmtDate(dl.date)} — ${dl.days}d left (${esc(dl.label)})</span>` : `Needs a hearing by ${fmtDate(dl.date)} · ${dl.days}d (${esc(dl.label)})`) : 'no deadline on the calendar'}${(sl => sl ? (now > sl.noticeBy ? ' · <span class="hot">notice window closed — call the chair</span>' : ` · last slot ${fmtDT(sl.at)} · notice by ${fmtDT(sl.noticeBy)}`) : '')(dl && st.committee ? lastSlotBefore(st.committee, dl.date, S.slots) : null)}</span>
        </div>`, 'Every live bill in committee has a hearing on the books. 🤙')}
      ${col('b', bcol, ({ b, st, h }) => `
        <div class="chip3 ${posCls(b)}${priCls(b)}" data-bill="${b.id}">
          <span class="l1"><b>${esc(billNum(b))}</b>${pri(b)}<span class="cm">${esc(h.committee)}</span>${who(b)}</span>
          <span class="lstop">${stopn(st)}</span>
          <span class="ldesc">${esc(blurb(b, 120))}</span>
          <span class="l2">${st.hearingState === 'held' ? `held ${fmtDate(h.scheduled_at)} · waiting for the report` : fmtDT(h.scheduled_at)}${draftChip(b)}</span>
        </div>`, 'No hearings on the books.')}
      ${col('c', c, ({ b, st }) => `
        <div class="chip3 ${posCls(b)}${priCls(b)}" data-bill="${b.id}" title="${esc(b.last_action || '')}">
          <span class="l1"><b>${esc(billNum(b))}</b>${pri(b)}<span class="cm">${phaseLabel(st)}</span>${who(b)}</span>
          <span class="lstop">${st.stops ? `through ${st.stops} ${CHAMBER_NAME[st.chamber]} committee${st.stops === 1 ? '' : 's'}` : ''}${st.deadline && !st.deadline.missed ? ` · ${esc(st.deadline.label)} ${fmtDate(st.deadline.date)}` : ''}</span>
          <span class="ldesc">${esc(blurb(b, 120))}</span>
          <span class="l2">${esc((b.last_action || '').slice(0, 60))}${b.last_action_date ? ' · ' + fmtDate(b.last_action_date) : ''}</span>
        </div>`, 'Nothing is through committee yet.')}
    </div>`;
  return { html, a, b: bcol, c };
}

// The home page. In session: what is waiting on you, this week's hearings
// (each bill once), the dying-quietly radar, then folded/optional context.
// With text in the search box it becomes a search across every bill in the
// database, tracked or not, so anything can be added from here.
function renderPortfolio(list) {
  const ids = new Set(list.map(b => b.id));
  const now = Date.now(), wk = now + 7*864e5, day = 864e5;
  const bill = id => S.bills.find(b => b.id === id);
  const me = S.me || {};
  const who = S.owner==='me' ? (S.me?.full_name || 'My') :
    S.owner==='all' ? 'Team' : (advocate(S.owner)?.full_name || '');
  const today = new Date().toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',timeZone:'Pacific/Honolulu'});
  const mobile = isMobile();
  const panel = (id, title, sub, rowsHtml, emptyMsg) => `
    <div class="panel" id="${id}"><div class="ph"><span>${title}</span><span class="psub">${sub}</span></div>
      ${rowsHtml || `<div class="pempty">${emptyMsg}</div>`}</div>`;
  const hrsLeft = d => Math.max(0, Math.round((new Date(d) - now)/36e5));
  const head = (h1, sub) => `<div class="dashhead"><h1>${h1}</h1><span class="sub">${sub}</span></div>`;

  // ---------- between sessions: results, open tasks, the January checklist ----------
  if (SESSION_OVER && S.q.trim().length < 2) {
    const alive = list.filter(b => b.position !== 'monitor');
    const byOutcome = o => alive.filter(b => dkOutcome(b) === o);
    const law = byOutcome('law'), vetoed = byOutcome('vetoed'), gov = byOutcome('governor'), died = byOutcome('died');
    const open = alive.filter(b => dkOutcome(b) === null);
    const byNum = (a, b) => a.bill_number.localeCompare(b.bill_number);
    const actOf = b => (b.last_action || '').match(/Act\s+\d+[^.]*/i)?.[0] || '';
    const todos = Object.entries(S.todos || {}).flatMap(([bid, arr]) => arr.filter(t => !t.done).map(t => ({ t, b: bill(bid) })))
      .filter(x => x.b && ids.has(x.b.id)).sort((x, y) => (x.t.due_date || '9999').localeCompare(y.t.due_date || '9999'));
    const stat = (v, l) => `<div class="stat"><div class="v">${v}</div><div class="l">${l}</div></div>`;
    const jan = [
      ['Testimony template Doc has {{DATE}}, {{CHAIR}}, {{VICE_CHAIR}}', 'Settings → nothing to click; edit the Doc in Drive'],
      ['Every coalition has its Slack channel set', 'More → Settings → Hearing alerts'],
      ['Kevin, Saya, Kris, Jess, Jaylen can sign in', 'Supabase → Authentication → Add user'],
      ['Postmark inbound address is subscribed to the Capitol notice list', 'capitol.hawaii.gov → mailing lists'],
      ['Test date-shift removed from notice-inbox', 'Supabase → Edge Functions → notice-inbox → Secrets'],
      ['Next session deadlines loaded', 'ask Claude: load the ' + (SESSION_YEAR + 1) + ' calendar'],
      ['Committee chairs refreshed from the Capitol', 'ask Claude: refresh committees'],
    ];
    return head(`${esc(who)}'s Portfolio`, `${today} · session adjourned sine die · the live desk returns when the ${SESSION_YEAR + 1} session convenes`) + `
      <div class="stats pf">
        ${stat(law.length, 'Signed into law')}${stat(vetoed.length, 'Vetoed')}${stat(died.length, 'Died / deferred')}${stat(open.length + gov.length, 'No final action')}
      </div>
      <div class="dash">
        <div>
          ${todos.length ? panel('pf-todo', '☑ Open tasks', 'from every bill in this lens', todos.slice(0, 12).map(({ t, b }) => `
            <div class="prow ${posCls(b)}" data-bill="${b.id}"><div class="pmain">${esc(t.title)}
              <div class="psmall">${esc(b.bill_number)} · ${esc(blurb(b, 70))}${t.due_date ? ' · due ' + fmtDate(t.due_date) : ''}</div></div>
              ${t.assignee_id && advocate(t.assignee_id) ? av(advocate(t.assignee_id)) : ''}</div>`).join(''), '') : ''}
          ${dkBand('✅', 'Signed into law', 'wins from this session', [...law].sort(byNum),
            b => dkRow(b, actOf(b) ? `<span style="flex:0 0 auto;color:#3E8E63;font-size:11px">${esc(actOf(b))}</span>` : ''))}
          ${dkBand('⛔', 'Vetoed', 'passed both chambers, then vetoed', [...vetoed].sort(byNum))}
        </div>
        <div>
          ${panel('pf-jan', '🗓 Before the ' + (SESSION_YEAR + 1) + ' session', 'the once-a-year setup, in order', jan.map(([what, where]) => `
            <div class="prow"><div class="pmain">${esc(what)}<div class="psmall">${esc(where)}</div></div></div>`).join(''), '')}
          ${dkBand('✖️', 'Died', 'missed a deadline, deferred, or failed a vote', [...died].sort(byNum),
            b => dkRow(b, `<span style="flex:0 0 auto;font-size:11px;color:var(--muted)">${esc(b.died_deadline ? `missed ${b.died_deadline}${b.died_at_stage ? ' at ' + (STAGE_LABEL[b.died_at_stage] || b.died_at_stage) : ''}` : (b.committee || ''))}</span>`))}
        </div>
      </div>`;
  }

  // ---------- search mode: every bill, not just this lens ----------
  const q = S.q.trim();
  if (q.length >= 2) {
    const ql = q.toLowerCase(), qn = ql.replace(/\s/g,'');
    // Number, title, summary, description, committee/referrals, owner, coalition, sponsor, position or stage.
    const hay = b => [b.bill_number, b.title, b.public_summary, b.description, b.committee, (b.referrals || []).join(' '),
      owners(b).map(a => a.full_name + ' ' + a.initials).join(' '), (S.billCampaigns[b.id] || []).map(id => S.campaigns.find(c => c.id === id)?.name).join(' '),
      (b.sponsors || []).map(x => typeof x === 'string' ? x : x.n || x.name || '').join(' '), POSITIONS.find(p => p[0] === b.position)?.[1], STAGE_LABEL[effStage(b)]].join(' | ').toLowerCase();
    const terms = ql.split(/\s+/).filter(Boolean);
    const hit = b => b.bill_number.toLowerCase().includes(qn) || terms.every(t => hay(b).includes(t));
    const tracked = S.bills.filter(hit).sort((a, b) => (diedish(a) - diedish(b)) || (a.priority || 9) - (b.priority || 9) || a.bill_number.localeCompare(b.bill_number)).slice(0, 30);
    const sa = S.searchAll || {};
    const untracked = sa.q === q ? (sa.rows || []) : null;
    const row = b => `<div class="prow" data-bill="${b.id}">
        <div class="pmain"><b>${esc(b.bill_number)}</b> ${esc(b.title||'')}
          <div class="psmall">${statusChip(b)}${owners(b)[0] ? ' · ' + esc(owners(b)[0].full_name) : ' · no owner'}${b.position ? ' · ' + esc(POSITIONS.find(p=>p[0]===b.position)?.[1]||'') : ''}</div></div>
        <span class="dkav">${owners(b)[0] ? av(owners(b)[0]) : ''}</span></div>`;
    return head(`Search: “${esc(q)}”`, `${tracked.length} tracked match${tracked.length===1?'':'es'} · ${untracked ? untracked.length + ' not tracked yet' : 'looking through every bill…'} · matches number, title, committee, owner, coalition, sponsor, position`) + `
      <div class="browse">Browse by coalition: ${S.campaigns.map(c => `<button class="fchip" data-browse="${c.id}">${esc(c.name)}</button>`).join('')}</div>
      <div class="dash one">
        <div>
          ${panel('pf-hits', '✓ Tracked', 'already on the tracker, any owner', tracked.map(row).join(''), 'No tracked bill matches.')}
          ${panel('pf-untracked', '＋ Not tracked yet', 'every measure in the session · tap Track to add it',
            q.length < 3 ? `<div class="pempty">Type at least 3 characters to search bills that are not tracked yet.</div>`
            : untracked === null ? `<div class="pempty">Searching…</div>`
            : untracked.map(r => `<div class="prow" data-track-row="${r.id}">
                <div class="pmain"><b>${esc(r.bill_number)}</b> ${esc(r.title||'')}
                  <div class="psmall">${esc(r.last_action||'')}${r.last_action_date ? ' · ' + fmtDate(r.last_action_date) : ''}</div></div>
                <button class="btn sm" data-track="${r.id}">Track</button>
                <a class="btn sm ghost" href="${esc(capitolUrl(r))}" target="_blank" rel="noopener" onclick="event.stopPropagation()">Capitol ↗</a>
              </div>`).join(''),
            'No untracked bill matches.')}
        </div>
      </div>`;
  }

  // Monitor-only bills are watched, not worked: they stay off the home page.
  list = list.filter(b => b.position !== 'monitor');
  const ids2 = new Set(list.map(b => b.id)); ids.clear(); list.forEach(b => ids.add(b.id));

  // ---------- waiting on you (whole team, ignores the lens) ----------
  const isMine = b => (S.assignments[b.id]||[]).includes(me.id);
  const hstDay = d => new Date(d).toLocaleDateString('en-CA', { timeZone: 'Pacific/Honolulu' });
  const hearingFor = d => S.hearings.find(h => h.id === d.hearing_id) ||
    S.hearings.filter(h => h.bill_id === d.bill_id && h.committee === d.committee && new Date(h.scheduled_at) > new Date())
      .sort((a,b) => a.scheduled_at.localeCompare(b.scheduled_at))[0] || null;
  const waiting = Object.values(S.drafts).flat().filter(d => d.status !== 'cancelled').map(d => {
    const b = bill(d.bill_id); if (!b || b.position === 'monitor') return null;
    // mine: the next step is literally mine. others: someone else's step, visible to admins.
    let why = null, mine = false;
    if (d.status === 'review') { why = 'Waiting for admin approval'; mine = !!me.is_admin; if (!mine && !me.is_admin) return null; }
    else if (d.status === 'second_review') { why = 'Needs a reviewer\u2019s approval (first testimony on this bill)'; mine = !!me.is_reviewer; if (!mine && !me.is_admin) return null; }
    else if (d.status === 'approved') { why = 'Approved — file it at the Capitol'; mine = isMine(b) || d.submitted_by === me.id; if (!mine && !me.is_admin) return null; }
    else if (d.status === 'draft' && d.review_note) { why = 'Sent back: ' + d.review_note; mine = d.submitted_by === me.id || isMine(b); if (!mine && !me.is_admin) return null; }
    else if (d.status === 'draft' && !d.submitted_at) { why = 'Draft ready — write it, then submit for review'; mine = isMine(b); if (!mine && !me.is_admin) return null; }
    else return null;
    const h = hearingFor(d);
    return { d, b, why, h, mine, t: h?.testimony_deadline ? +new Date(h.testimony_deadline) : h ? +new Date(h.scheduled_at) : Infinity };
  }).filter(Boolean).sort((x,y) => byPri(x, y) || x.t - y.t);
  const waitingOthers = waiting.filter(x => !x.mine); const waitingMine = waiting.filter(x => x.mine);
  const WAIT_CAP = 8;
  // Situations beyond the testimony workflow, on the bills in this lens:
  // nobody attending, a draft for an old version, no draft yet, a P1 stuck
  // without a hearing as the deadline nears, no public ask on a bill about
  // to be heard, an unread chat. One card each, with the button that fixes it.
  const situations = [];
  for (const b of list) {
    if (b.position === 'monitor' || diedish(b)) continue;
    const ups = S.hearings.filter(h => h.bill_id === b.id && h.status !== 'cancelled' && new Date(h.scheduled_at) > now && new Date(h.scheduled_at) - now < 7 * day).sort((x, y) => x.scheduled_at.localeCompare(y.scheduled_at));
    for (const h of ups) {
      const dr = draftFor(b.id, h.committee);
      if (!attendees(h).length) situations.push({ b, t: +new Date(h.scheduled_at), kind: 'attend', verb: 'Attend the hearing', why: `No one has said they are attending the ${h.committee} hearing ${fmtDT(h.scheduled_at)}${h.room ? ' · ' + roomShort(h.room) : ''}`, btn: `<button class="btn sm pri" data-attend="${h.id}">I’m attending</button>` });
      if (!dr) situations.push({ b, t: +new Date(h.testimony_deadline || h.scheduled_at), kind: 'nodraft', verb: 'No draft yet', why: `The ${h.committee} hearing is ${fmtDT(h.scheduled_at)} and no testimony draft exists. It is created from the notice within the hour; if it does not appear, ask Nate.`, btn: `<button class="btn sm ghost" data-bill-open="${b.id}">Open bill</button>` });
      else if (dr.status !== 'filed' && b.current_version && dr.version !== b.current_version) situations.push({ b, t: +new Date(h.testimony_deadline || h.scheduled_at), kind: 'stale', verb: 'Check the draft', why: `Written for ${dr.version || 'the introduced bill'}; the bill is now ${b.current_version}. Make sure the testimony still fits before it goes in.`, btn: `<a class="btn sm pri" href="${esc(dr.doc_url)}" target="_blank" rel="noopener">Google Doc ↗</a>` });
      if (['strongly_support', 'strongly_oppose'].includes(b.position) && !(b.public_action || '').trim()) situations.push({ b, t: +new Date(h.scheduled_at), kind: 'ask', verb: 'Write the public ask', why: `Hearing ${fmtDT(h.scheduled_at)} and the public page has no ask on this bill — supporters see the official title instead of what to say.`, btn: `<button class="btn sm pri" data-opentab="${b.id}" data-tab="public">Open Public tab</button>` });
    }
    if (!ups.length && b.priority === 1) { const st = stopOf(b); if (st.column === 'a' && st.deadline && !st.deadline.missed && st.deadline.days <= 14 && st.committee) { const m = chairMail(st.committee); situations.push({ b, t: +new Date(st.deadline.date + 'T23:59:59-10:00'), kind: 'chair', verb: 'Call the chair', why: `P1 stuck in ${st.committee} — needs a hearing by ${fmtDate(st.deadline.date)} (${st.deadline.days}d)${m ? ' · ' + m.title + ' ' + m.last : ''}`, btn: m ? `<a class="btn sm pri" href="mailto:${esc(m.email)}?subject=${encodeURIComponent('Request for a hearing on ' + b.bill_number)}">Email the chair</a>` : `<button class="btn sm ghost" data-bill-open="${b.id}">Open bill</button>` }); } }
    if (unreadCount(b)) situations.push({ b, t: now, kind: 'chat', verb: 'Reply in chat', why: `${unreadCount(b)} new message${unreadCount(b) === 1 ? '' : 's'} on this bill`, btn: `<button class="btn sm pri" data-opentab="${b.id}" data-tab="chat">Open chat</button>` });
  }
  situations.sort((x, y) => byPri(x, y) || x.t - y.t);
  const SIT_CAP = 8, sitMore = (S.boardMore || {}).situations;
  const sitRow = ({ b, verb, why, btn }) => `
    <div class="prow wrow srow ${posCls(b)}${priCls(b)}" data-bill="${b.id}">
      ${btn}
      <div class="pmain"><b class="verb">${esc(verb)}</b> ${esc(billNum(b))}
        <div class="pdesc">${esc(blurb(b, 110))}</div>
        <div class="psmall">${why}</div></div>
      <span class="dkav">${owners(b)[0] ? av(owners(b)[0]) : ''}</span>
    </div>`;
  const situationsHtml = (sitMore ? situations : situations.slice(0, SIT_CAP)).map(sitRow).join('') + (situations.length > SIT_CAP ? `<button class="pempty boardmore" data-boardmore="situations">${sitMore ? 'Show fewer' : `…and ${situations.length - SIT_CAP} more`}</button>` : '');
  const verbOf = d => d.status === 'review' ? 'Approve testimony' : d.status === 'second_review' ? '2nd approval · testimony'
    : d.status === 'approved' ? 'File testimony' : d.review_note ? 'Revise testimony' : 'Write testimony';
  const waitRow = ({ d, b, why, h }) => { const soon = h?.testimony_deadline && hrsLeft(h.testimony_deadline) < 48; return `
    <div class="prow wrow ${posCls(b)}${priCls(b)}" data-bill="${b.id}">
      ${draftActionBtn(b, d.committee)}
      <div class="pmain"><b class="verb">${verbOf(d)}</b> ${esc(billNum(b))} · ${esc(d.committee)}
        <div class="pdesc">${esc(blurb(b, 110))}</div>
        <div class="psmall">${esc(why)}${h ? ` · hearing ${fmtDT(h.scheduled_at)}${h.testimony_deadline ? (inWhen(h.testimony_deadline) === 'passed' ? ' · testimony deadline passed' : ` · testimony due <b${soon ? ' class="hot"' : ''}>${inWhen(h.testimony_deadline)}</b>`) : ''}` : ''}</div></div>
      <span class="dkav">${owners(b)[0] ? av(owners(b)[0]) : ''}</span>
    </div>`; };
  const waitingHtml = waitingMine.slice(0, WAIT_CAP).map(waitRow).join('') + (waitingMine.length > WAIT_CAP ? `<div class="pempty">…and ${waitingMine.length - WAIT_CAP} more</div>` : '')
    + (situations.length ? `<div class="sitsep">Also on your bills</div>${situationsHtml}` : '');
  const othersHtml = waitingOthers.length ? `<details class="panel sincefold" id="pf-others" ${(S.folds || {}).others ? 'open' : ''}>
      <summary class="ph"><span>👥 Waiting on others <span class="chipx c-gray">${waitingOthers.length}</span></span><span class="psub">the team\u2019s open testimony steps · tap</span></summary>
      ${waitingOthers.slice(0, 12).map(waitRow).join('')}${waitingOthers.length > 12 ? `<div class="pempty">…and ${waitingOthers.length - 12} more</div>` : ''}</details>` : '';

  // ---------- this week: each bill once ----------
  const hUp = S.hearings.filter(h => ids.has(h.bill_id) && new Date(h.scheduled_at) > new Date())
    .sort((a,b) => a.scheduled_at.localeCompare(b.scheduled_at));
  const due = hUp.filter(h => h.testimony_deadline && new Date(h.testimony_deadline) - now < 48*3600e3);
  // The calendar can page through weeks; the stats and "hearings this week" stay on the current one.
  const wkOff = S.weekOffset || 0;
  const mondayOf = t => { const d = new Date(hstDay(t) + 'T12:00:00-10:00'); const dow = (d.getUTCDay() + 6) % 7; return t - dow * 864e5; };
  // Every page is a calendar week (Mon–Sun), including the current one; earlier
  // days of this week stay visible, dimmed, so paging back and forward never skips a day.
  const wkStart = mondayOf(now + wkOff * 7 * 864e5), wkEnd = wkStart + 7 * 864e5;
  const inWindow = S.hearings.filter(h => ids.has(h.bill_id) && h.status !== 'cancelled' &&
      new Date(h.scheduled_at) >= new Date(hstDay(wkStart) + 'T00:00:00-10:00') && new Date(h.scheduled_at) < new Date(hstDay(wkEnd) + 'T00:00:00-10:00'))
    .sort((a,b) => a.scheduled_at.localeCompare(b.scheduled_at));
  const weekByBill = new Map();
  for (const h of inWindow) if (!weekByBill.has(h.bill_id)) weekByBill.set(h.bill_id, h);
  const week = [...weekByBill.values()].sort((a,b) =>
    (a.testimony_deadline || a.scheduled_at).localeCompare(b.testimony_deadline || b.scheduled_at));
  const isNew = h => h.notice_posted_at && new Date(h.notice_posted_at).getTime() > S.sinceVisit;
  // Calendar layout: seven day blocks starting today (or the paged week), hearings under each.
  const dayLabel = iso => new Date(iso + 'T12:00:00-10:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'Pacific/Honolulu' });
  const all7 = [...Array(7)].map((_, i) => hstDay(wkStart + i * 864e5));
  const isWeekend = d => [0, 6].includes(new Date(d + 'T12:00:00-10:00').getDay());
  // Weekdays always; a weekend day only when something is actually scheduled on it.
  const days7 = all7.filter(d => !isWeekend(d) || week.some(h => hstDay(h.scheduled_at) === d));
  const weekRow = h => { const b = bill(h.bill_id); if (!b) return '';
    const dueSoon = h.testimony_deadline && hrsLeft(h.testimony_deadline) < 48;
    const past = h.testimony_deadline && new Date(h.testimony_deadline) < now;
    return `
    <div class="prow calrow ${posCls(b)}${priCls(b)}" data-bill="${b.id}">
      <span class="caltime">${new Date(h.scheduled_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'Pacific/Honolulu' })}<span class="calwho">${isNew(h) ? '<span class="tag n">NEW</span>' : ''}${owners(b)[0] ? av(owners(b)[0], 'avatar sm') : ''}</span></span>
      <div class="pmain"><b>${esc(billNum(b))}</b> <span class="cm">${esc(h.committee)} · ${esc(clean(h.room))}</span><div class="tagline">${draftChip(b)}${(att => att.length ? `<span class="attend">${att.map(a => av(a, 'avatar sm')).join('')}<span>attending</span></span>` : (draftFor(b.id, h.committee) && new Date(h.scheduled_at) - now < 7 * 864e5) ? '<span class="tag n red">NO ONE ATTENDING</span>' : '')(attendees(h))}</div>
        <div class="pdesc">${esc(blurb(b, 96))}</div>
        <div class="psmall">${h.testimony_deadline ? (past ? 'testimony deadline passed' : `testimony due <b${dueSoon ? ' class="hot"' : ''}>${inWhen(h.testimony_deadline)}</b>`) : ''}</div></div>
      <div class="calbtns">${draftActionBtn(b, h.committee)}
      <a class="btn sm ghost" href="${esc(capitolUrl(b))}" target="_blank" rel="noopener" onclick="event.stopPropagation()">Capitol ↗</a></div>
    </div>`; };
  const clean = r => (r || 'room TBD').replace(/\s*via videoconference/i, '').replace(/^Conference Room\s+/i, 'Rm ');
  const railParts = iso => { const dt = new Date(iso + 'T12:00:00-10:00');
    return [dt.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'Pacific/Honolulu' }), dt.getDate()]; };
  const weekHtml = (week.length || wkOff !== 0) ? `<div class="calweek" style="--ndays:${days7.length}">` + days7.map((d, i) => {
    const hs = week.filter(h => hstDay(h.scheduled_at) === d).sort((x, y) => x.scheduled_at.localeCompare(y.scheduled_at));
    const [dow, dom] = railParts(d);
    const isToday = d === hstDay(now), isPast = d < hstDay(now);
    return `<div class="calday${hs.length ? '' : ' nohear'}${isToday ? ' today' : ''}${isPast ? ' past' : ''}">
      <div class="calrail"><span class="dow">${dow}</span><span class="dom">${dom}</span>${isToday ? '<span class="tod">today</span>' : ''}${hs.length ? `<span class="cnt">${hs.length}</span>` : ''}</div>
      <div class="calbody">${hs.length ? hs.map(weekRow).join('') : '<div class="calnone">no hearings</div>'}</div></div>`; }).join('') + `</div>` : '';

  // ---------- recent hearings: what the committee did ----------
  const recentH = S.hearings.filter(h => ids.has(h.bill_id) && h.status !== 'cancelled' && new Date(h.scheduled_at) <= now && new Date(h.scheduled_at) > now - 7 * 864e5)
    .sort((x, y) => y.scheduled_at.localeCompare(x.scheduled_at));
  const recentHearingsHtml = recentH.length ? panel('pf-outcomes', '🏛 Recent hearings', 'what the committee did', recentH.slice(0, 10).map(h => { const b = bill(h.bill_id); const o = S.outcomes?.[h.id]; return `
      <div class="prow ${posCls(b)}" data-bill="${b.id}">
        <div class="pmain"><b>${esc(billNum(b))}</b> · ${esc(h.committee)} · ${fmtDT(h.scheduled_at)} ${o?.outcome ? `<span class="chipx ${OUTCOME_CLS[o.outcome] || 'c-gray'}">${OUTCOME_LABEL[o.outcome] || o.outcome}</span>` : '<span class="chipx c-gray">no report yet</span>'}
          <div class="psmall">${esc(o?.report ? o.report.slice(0, 110) : blurb(b, 90))}</div></div>
        ${owners(b)[0] ? av(owners(b)[0]) : ''}</div>`; }).join(''), '') : '';

  // ---------- last 72 hours: everything that happened, newest first ----------
  const seen = new Set();
  const recent = (S.recentEvents || []).filter(ev => ids.has(ev.bill_id) && bill(ev.bill_id) &&
    now - new Date(ev.occurred_at) < 72 * 3600e3 &&
    !seen.has(ev.bill_id + '|' + ev.title + '|' + ev.occurred_at) && seen.add(ev.bill_id + '|' + ev.title + '|' + ev.occurred_at));
  const REC_CAP = 12, recMore = (S.boardMore || {}).recent;
  const ago = iso => { const h = Math.round((now - new Date(iso)) / 36e5); return h < 1 ? 'just now' : h < 24 ? `${h}h ago` : `${Math.round(h / 24)}d ago`; };
  const evKind = ev => ev.advocate_id ? 'team' : /hearing notice|hearing/i.test(ev.title || '') ? 'notice'
    : /third reading|final reading|passed|failed to pass|vetoed|signed|act \d+/i.test(ev.title || '') ? 'vote' : 'ref';
  const tlStamp = iso => new Date(iso).toLocaleString('en-US', { timeZone: 'Pacific/Honolulu', month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit' }).replace(', ', ' ');
  const recentHtml = recent.length ? `
    <div class="panel sec-feed" id="pf-recent"><div class="ph"><span>⚡ Last 72 hours <span class="chipx c-gray">${recent.length}</span></span><span class="psub">newest first</span></div>
      <div class="tl72">${(recMore ? recent : recent.slice(0, REC_CAP)).map(ev => { const b = bill(ev.bill_id), a = ev.advocate_id ? advocate(ev.advocate_id) : null; return `
      <div class="tlrow ${evKind(ev)}${priCls(b)}" data-bill="${b.id}">
        <span class="tldot"></span><span class="tlts">${tlStamp(ev.occurred_at)}</span>
        <div class="tltext"><b>${esc(b.bill_number)}</b> ${esc((ev.title || '').slice(0, 90))}${a ? ` <span class="tlwho">${esc(a.full_name)}</span>` : ''}<span class="tltitle">${esc(blurb(b, 120))}</span></div>
      </div>`; }).join('')}</div>
      ${recent.length > REC_CAP ? `<button class="pempty boardmore" data-boardmore="recent">${recMore ? 'Show fewer' : `…and ${recent.length - REC_CAP} more`}</button>` : ''}
    </div>` : '';

  const board = pfBoard(list);

  const moved = list.filter(b => b.last_action_date && (now - new Date(b.last_action_date)) < 7*day);

  // Progress: testimony marked filed today, by anyone.
  const todayHst = hstDay(now);
  const filedToday = Object.values(S.drafts).flat().filter(d => d.status === 'filed' && d.filed_at && hstDay(d.filed_at) === todayHst).length;
  const waitSub = `your steps first${me.is_admin ? ' · the team’s are under Waiting on others' : ''}${filedToday ? ` · <span class="done">${filedToday} filed today ✓</span>` : ''}`;
  const waitPanel = ((waitingMine.length || filedToday || situations.length)
    ? panel('pf-wait', '✊ Do this now', waitSub, waitingHtml,
        `All caught up${filedToday ? ` — ${filedToday} filed today` : ''}. 🤙`).replace('class="panel"', 'class="panel sec-wait"') : '') + othersHtml;
  // Layout adapts: a short feed sits under the checklist instead of beside it.
  const stacked = false;
  const foldable = (id, title, count, inner, openByDefault) => !mobile ? inner : `
    <details class="fold" id="fold-${id}" ${(S.folds || {})[id] ?? openByDefault ? 'open' : ''}>
      <summary><span>${title}</span><span class="chipx c-gray">${count}</span></summary>${inner}</details>`;
  const legend = `<span class="legend"><i class="sw s"></i>support <i class="sw o"></i>oppose <i class="sw n"></i>comments</span>`;
  const wkLabel = wkOff === 0 ? 'This week' : wkOff === 1 ? 'Next week' : wkOff === -1 ? 'Last week'
    : 'Week of ' + new Date(hstDay(wkStart) + 'T12:00:00-10:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'Pacific/Honolulu' });
  const calNav = `<span class="calnav"><button data-week="-1" title="Previous week">‹</button>${wkOff ? '<button data-week="0">Today</button>' : ''}<button data-week="1" title="Next week">›</button></span>`;
  const calPanel = panel('pf-week', `◷ ${wkLabel} ${calNav}`, 'each bill once · hearing, deadline, and the draft’s next step', weekHtml,
      SESSION_OVER ? 'Session is over — hearings return when the next session convenes.' : 'No hearings on these bills in the next 7 days.');
  const cur = currentDeadline();
  const dlDays = cur ? Math.ceil((new Date(cur.date + 'T23:59:59-10:00') - now) / 864e5) : null;
  const strip = [
    `${list.length} bill${list.length===1?'':'s'}`,
    waitingMine.length ? `<a data-jump="pf-wait" class="hot">${waitingMine.length} testimony step${waitingMine.length === 1 ? '' : 's'} waiting</a>` : null,
    waitingOthers.length ? `<a data-jump="pf-others">${waitingOthers.length} on others</a>` : null,
    due.length ? `<a data-jump="pf-week">${due.length} due in 48h</a>` : null,
    `<a data-jump="pf-week">${week.length} hearing${week.length===1?'':'s'} this week</a>`,
    board.a.length ? `<a data-jump="pf-board-a">${board.a.length} need a hearing</a>` : null,
    recent.length ? `<a data-jump="pf-recent">${recent.length} action${recent.length===1?'':'s'} in 72h</a>` : null,
    cur ? `next deadline <b>${esc(cur.label)}</b> in ${dlDays}d` : null,
    filterCount() ? `<span class="filtnote">showing ${esc(filterLabel())} only</span>` : null,
  ].filter(Boolean).join(' · ');
  const openWeeks = (() => { const c = (DEADLINES.introduced || [])[0]; if (!c) return false; const cut = new Date(c[1] + 'T23:59:59-10:00').getTime(); return now > cut - 18 * 864e5 && now < cut + 3 * 864e5; })();
  if (openWeeks && !S.triageCounts && !S.triageCountsLoading) { S.triageCountsLoading = true; DB.triageCounts().then(c => { S.triageCounts = c; rerenderKeep(); }).catch(() => {}); }
  const banner = openWeeks ? `<div class="openbanner"><span><b>Opening weeks.</b> ${S.triageCounts ? `${S.triageCounts.introduced} bills introduced · <b>${S.triageCounts.undecided}</b> waiting for a decision · ${S.triageCounts.suggested} suggested · ${S.triageCounts.tracked} tracked` : 'Every new bill needs one decision: track it or skip it.'}</span><button class="btn sm" data-view="triage">Open Triage</button></div>` : '';
  const todayHearings = S.hearings.filter(h => ids.has(h.bill_id) && h.status !== 'cancelled' && hstDay(h.scheduled_at) === hstDay(now)).sort((x, y) => x.scheduled_at.localeCompare(y.scheduled_at));
  const dueToday = hUp.filter(h => h.testimony_deadline && hstDay(h.testimony_deadline) === hstDay(now) && new Date(h.testimony_deadline) > now);
  const todayStrip = mobile && (todayHearings.length || dueToday.length) ? `<div class="todaystrip"><div class="th"><b>Today</b> · ${todayHearings.length} hearing${todayHearings.length === 1 ? '' : 's'}${dueToday.length ? ` · <span class="hot">${dueToday.length} testimony due</span>` : ''}</div>
      ${todayHearings.map(h => { const b = bill(h.bill_id); if (!b) return ''; const att = attendees(h); return `<div class="trow2" data-bill="${b.id}"><span class="tt">${new Date(h.scheduled_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'Pacific/Honolulu' })}</span><span class="tb"><b>${esc(billNum(b))}</b> ${esc(h.committee)} · ${esc(roomShort(h.room))}${att.length ? ` · ${att.map(a => esc(a.initials)).join('/')} attending` : ' · <span class="hot">no one attending</span>'}</span>${draftActionBtn(b, h.committee)}</div>`; }).join('')}
      ${dueToday.filter(h => !todayHearings.includes(h)).map(h => { const b = bill(h.bill_id); if (!b) return ''; return `<div class="trow2" data-bill="${b.id}"><span class="tt">${new Date(h.testimony_deadline).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'Pacific/Honolulu' })}</span><span class="tb"><b>${esc(billNum(b))}</b> testimony due · ${esc(h.committee)} hearing tomorrow</span>${draftActionBtn(b, h.committee)}</div>`; }).join('')}
    </div>` : '';
  return head(`${esc(who)}'s Portfolio`, `${today} · ${strip}`) + banner + todayStrip + `
    <div class="dash${recentHearingsHtml ? '' : ' one'}">
      <div>${waitPanel}</div>
      ${recentHearingsHtml ? `<div>${recentHearingsHtml}</div>` : ''}
    </div>
    <div class="calwrap">${foldable('week', '◷ ' + wkLabel + ' ' + calNav, week.length, calPanel, false)}</div>
    ${foldable('board', '🗂 Where every bill stands', board.a.length + board.b.length + board.c.length, board.html.replace('bills re-sort as dates pass.</span>', 'bills re-sort as dates pass. ' + legend + '</span>'), false)}
    ${recent.length ? `<div class="calwrap">${foldable('recent', '⚡ Last 72 hours', recent.length, recentHtml, false)}</div>` : ''}
    ${(dead => dead.length ? `<div class="calwrap"><details class="panel dead fold" id="pf-dead"><summary class="ph"><span>🪦 Did not advance <span class="chipx c-gray">${dead.length}</span></span><span class="psub">why each one stopped</span></summary>
      ${dead.map(b => `<div class="prow ${posCls(b)}" data-bill="${b.id}"><div class="pmain"><b>${esc(billNum(b))}</b> ${b.priority ? `<span class="pri">P${b.priority}</span>` : ''} <span class="chipx c-gray">${esc(b.died_at_stage ? (STAGE_LABEL[b.died_at_stage] || b.died_at_stage) : STAGE_LABEL[effStage(b)] || '')}</span><div class="pdesc">${esc(blurb(b, 120))}</div><div class="psmall">${whyDead(b)}</div></div>${owners(b)[0] ? av(owners(b)[0], 'avatar sm') : ''}</div>`).join('')}</details></div>` : '')
      (list.filter(b => diedish(b) && b.position !== 'monitor').sort((x, y) => (x.priority || 9) - (y.priority || 9) || x.bill_number.localeCompare(y.bill_number)))}`;
}

function cell(b, c) {
  switch (c) {
    case 'sel': return `<td class="selcell"><input type="checkbox" data-selb="${b.id}" ${S.selected.has(b.id)?'checked':''}></td>`;
    case 'bill': return `<td><div class="bno">${esc(b.bill_number.replace(/^(\D+)/,'$1 '))}</div>
      <div class="bti">${esc(b.title||'')}<div class="bsub">${esc(b.committee||'')}${b.referrals?.length?' · '+esc(b.referrals.join(', ')):''}</div></div></td>`;
    case 'status': return `<td>${statusChip(b)}</td>`;
    case 'coal': return `<td style="font-size:11.5px;color:var(--muted)">${(S.billCampaigns[b.id]||[])
      .map(cid => esc(S.campaigns.find(x=>x.id===cid)?.name||'')).join(', ')}</td>`;
    case 'owner': return `<td><select data-own="${b.id}"><option value="">—</option>
      ${S.advocates.map(a=>`<option value="${a.id}" ${(S.assignments[b.id]||[])[0]===a.id?'selected':''}>${esc(a.full_name)}</option>`).join('')}</select></td>`;
    case 'position': return `<td><select data-pos="${b.id}">
      ${POSITIONS.map(([v,l])=>`<option value="${v}" ${(b.position||'')===v?'selected':''}>${l}</option>`).join('')}</select></td>`;
    case 'pri': return `<td><select data-pri="${b.id}"><option value="">—</option>
      ${[1,2,3].map(p=>`<option ${b.priority===p?'selected':''}>${p}</option>`).join('')}</select></td>`;
    case 'last': return `<td style="font-size:12px;max-width:220px">${esc(b.last_action||'—')}
      <div class="bsub">${fmtDate(b.last_action_date,{year:'2-digit'})}</div></td>`;
    case 'pulse': return `<td>${pulseCell(b)}</td>`;
  }
}
function billTable(list, cols) {
  const heads = { sel:['',''], bill:['bill_number','Bill / title'], status:['stage','Status'],
    coal:['','Coalitions'], owner:['owner','Owner'], position:['position','Position'],
    pri:['priority','Pri'], last:['last_action_date','Last action'], pulse:['pulse','Team pulse'] };
  if (!list.length) return `<div class="empty">No bills match these filters.</div>`;
  const allSel = list.length && list.every(b => S.selected.has(b.id));
  return `<div class="tablewrap"><table class="bills">
    <thead><tr>${cols.map(c => c === 'sel'
      ? `<th class="selcell"><input type="checkbox" id="selall" ${allSel?'checked':''} title="Select all shown"></th>`
      : `<th data-sort="${heads[c][0]}">${heads[c][1]}
      ${S.sort[0]===heads[c][0] ? (S.sort[1]>0?'▲':'▼') : ''}</th>`).join('')}</tr></thead>
    <tbody>${list.map(b => `<tr data-bill="${b.id}">${cols.map(c => cell(b, c)).join('')}</tr>`).join('')}</tbody></table></div>`;
}

function renderPipeline(list) {
  const groups = Object.fromEntries(STAGES.map(([v]) => [v, []]));
  list.forEach(b => (groups[effStage(b)] ??= []).push(b));
  const final = ['enacted','vetoed','dead'];
  const cols = STAGES.filter(([v]) => !final.includes(v)).map(([v,l]) => [v,l,groups[v]]);
  cols.push(['final','Outcome', final.flatMap(v => groups[v])]);
  const MAX = 25;
  const dlchips = v => (DEADLINES[v]||[]).map(([lab,d]) => {
    const past = new Date(d) < new Date();
    return `<span class="dlchip ${past?'past':''}">${lab} · ${new Date(d+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'})}</span>`;
  }).join('');
  return `<div class="board">${cols.map(([v,l,bs]) => `
    <div class="col"><div class="colh"><span class="nm">${l}</span><span class="n">${bs.length}</span></div>
      <div class="dlrow">${dlchips(v)}</div>
      ${bs.slice(0,MAX).map(b => `
        <div class="card p${b.priority||3}" data-bill="${b.id}">
          <div class="r1"><span class="bno">${esc(b.bill_number)}</span>
            ${isTriple(b) ? '<span class="chipx c-navy" style="font-size:9px" title="Triple referral — races the Triple Filing deadline">3X</span>' : ''}
            ${v==='final' ? `<span class="chipx ${effStage(b)==='enacted'?'c-green':'c-gray'}" style="font-size:9.5px">${STAGE_LABEL[effStage(b)]}</span>`
              : (diedish(b) ? '<span class="chipx c-red" style="font-size:9px">DIED</span>' : '')}
            ${compChip(b)}
            ${owners(b).slice(0,1).map(a=>av(a)).join('')}</div>
          <div class="tt">${esc(b.title||'')}</div>
          <div>${b.position ? `<span class="chipx c-gray pos-${b.position}" style="background:var(--chip)">${POSITIONS.find(p=>p[0]===b.position)?.[1]||''}</span>`:''}</div>
        </div>`).join('')}
      ${bs.length>MAX ? `<div class="colmore">+ ${bs.length-MAX} more — use filters</div>` : ''}
    </div>`).join('')}</div>`;
}

function bulkBar() {
  const n = S.selected.size;
  if (!n) return '';
  // The selection survives filter changes, so a bulk action can reach bills
  // that scrolled out of view three filters ago. Rather than silently
  // dropping them (losing work) or silently writing them (the hazard), say
  // so and offer one click to trim.
  const vis = new Set(visibleBills().map(b => b.id));
  const hidden = [...S.selected].filter(id => !vis.has(id)).length;
  return `<div class="bulkbar">
    <b>${n} selected</b>
    <select id="bk-pos"><option value="">Set position…</option>
      ${POSITIONS.slice(1).map(([v,l]) => `<option value="${v}">${l}</option>`).join('')}</select>
    <select id="bk-pri"><option value="">Set priority…</option>
      ${[1,2,3].map(p => `<option value="${p}">P${p}</option>`).join('')}</select>
    <select id="bk-own"><option value="">Assign owner…</option>
      ${S.advocates.map(a => `<option value="${a.id}">${esc(a.full_name)}</option>`).join('')}
      <option value="__none">Unassign</option></select>
    <select id="bk-camp"><option value="">Add to coalition…</option>
      ${S.campaigns.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select>
    <button class="clear" id="bk-clear">Clear selection</button>
  </div>` + (hidden ? `<div class="bulkwarn">
    <span><b>${hidden}</b> of these ${hidden === 1 ? 'is' : 'are'} hidden by the current
    filters. Bulk actions will still apply to all ${n}.</span>
    <button id="bk-trim">Limit to the ${n - hidden} shown</button>
  </div>` : '');
}
function renderTable(list) {
  return bulkBar() + billTable(list, ['sel','bill','coal','owner','status','position','pri','last','pulse']);
}

// ---------------- Desk view ----------------
// Mini 9-square rail showing this bill's progress through key stages.
// Squares: done=teal, current=gold (dead=red), future=light gray.
const DK_RAIL_STAGES = ['introduced','first_lateral','first_decking','first_crossover',
  'second_lateral','second_decking','second_crossover','governor','enacted'];
const DK_RAIL_IDX = { introduced:0, first_triple:1, first_lateral:1, first_decking:2,
  first_crossover:3, second_triple:4, second_lateral:4, second_decking:5,
  second_crossover:6, conference:6, governor:7, enacted:8, vetoed:7, dead:null };
// The rail a bill actually walks: a triple-referred bill gets its Triple stop
// in that chamber (racing the Triple Filing date) before Lateral.
const railFor = b => { const r = ['introduced']; if ((b.origin_stops || 0) >= 3) r.push('first_triple');
  r.push('first_lateral', 'first_decking', 'first_crossover'); if ((b.second_stops || 0) >= 3) r.push('second_triple');
  r.push('second_lateral', 'second_decking', 'second_crossover', 'governor', 'enacted'); return r; };
const railIdx = (b, rail) => { let st = effStage(b);
  if (st === 'dead' && b.died_at_stage) st = b.died_at_stage;
  // Died before its first hearing: it was racing the Triple (or Lateral) date, so mark that stop.
  if (diedish(b) && st === 'introduced') st = rail.includes('first_triple') ? 'first_triple' : 'first_lateral';
  const alias = { conference: 'second_crossover', vetoed: 'governor', dead: 'introduced', first_triple: 'first_lateral', second_triple: 'second_lateral' };
  if (!rail.includes(st)) st = alias[st] || 'introduced';
  return Math.max(0, rail.indexOf(st)); };
function dkRail(b) {
  const dead = diedish(b);
  const DK_RAIL_STAGES = railFor(b); const idx = railIdx(b, DK_RAIL_STAGES);
  const sq = (i) => {
    const cls = i < idx ? '#0E7C86' : (i === idx && !dead) ? '#C9A227' : (i === idx && dead) ? '#C2483B' : '#D7E0E4';
    return `<span style="display:inline-block;width:7px;height:7px;border-radius:1px;background:${cls};margin:0 1px"></span>`;
  };
  return `<span style="white-space:nowrap">${DK_RAIL_STAGES.map((_,i) => sq(i)).join('')}</span>`;
}
// Stage groups for the distribution bar
const DK_COMMITTEE = ['introduced','first_triple','first_lateral','first_decking',
  'second_triple','second_lateral','second_decking'];
const DK_CROSSED = ['first_crossover','second_crossover','conference'];
// True outcome of a bill, independent of the off-season blanket in diedish().
// Between sessions diedish() calls almost everything dead, which is right for
// the Cards view but useless here - the Desk needs to tell "the Governor
// vetoed it" apart from "it quietly never got a hearing".
const dkOutcome = b => {
  const st = effStage(b);
  if (st === 'enacted') return 'law';
  if (st === 'vetoed') return 'vetoed';
  if (st === 'governor') return 'governor';
  if (st === 'dead' || /deferred|failed to pass/i.test(b.last_action || '')) return 'died';
  return null;                       // still somewhere in the process
};
const DK_CAP = 10;                   // rows per band before "+N more"

// One row. Shared by every band in both season modes.
// Grid, not flex: each cell gets a fixed track so rows line up as columns.
// Under flex the title absorbed all slack, which pushed the rail and avatar
// to the far edge on wide screens and left `extra` at a different horizontal
// position in every band. Every cell is emitted even when empty — a missing
// cell shifts everything after it out of alignment.
function dkRow(b, extra = '') {
  const d = daysAgo(S.pulse[b.id]?.last_team_touch);
  const dot = d == null ? 'd-n' : d <= 3 ? 'd-g' : d <= 7 ? 'd-a' : 'd-r';
  const o = owners(b)[0];
  return `<div class="prow dkrow" data-bill="${b.id}">
    <span class="dksel"><input type="checkbox" data-selb="${b.id}" ${S.selected.has(b.id) ? 'checked' : ''} onclick="event.stopPropagation()"></span>
    <span class="dkid"><span class="bno">${esc(b.bill_number)}</span>${
      b.priority ? `<span class="chipx c-gray dkpri">P${b.priority}</span>` : ''}</span>
    <span class="dkt">${esc(b.title || '')}${draftChip(b)}</span>
    <span class="dkx">${extra}</span>
    <span class="dkrail">${dkRail(b)}</span>
    <span class="dkav">${o ? av(o) : ''}</span>
    <span class="pulse dkpulse" title="last team touch"><span class="dot ${dot}"></span></span>
  </div>`;
}
// A titled group of rows, capped, with an overflow line. Renders nothing when empty.
function dkBand(icon, title, sub, rows, rowFn) {
  if (!rows.length) return '';
  const shown = rows.slice(0, DK_CAP);
  return `<div class="panel" style="margin-bottom:8px">
    <div class="ph"><span>${icon} ${title}</span><span class="psub">${sub} · ${rows.length}</span></div>
    ${shown.map(rowFn || (b => dkRow(b))).join('')}
    ${rows.length > DK_CAP ? `<div class="pempty">…and ${rows.length - DK_CAP} more — see Table view</div>` : ''}
  </div>`;
}

function renderDesk(list) {
  const now = Date.now();
  const ids = new Set(list.map(b => b.id));
  const bill = id => S.bills.find(b => b.id === id);
  const who = S.owner === 'me' ? (S.me?.full_name || 'My') :
    S.owner === 'all' ? 'Team' : (advocate(S.owner)?.full_name || '');
  const today = new Date().toLocaleDateString('en-US',
    { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'Pacific/Honolulu' });

  if (!list.length) return `
    <div class="dashhead"><h1>${esc(who)}'s desk</h1><span class="sub">${today}</span></div>
    <div class="empty">No bills match these filters. Try “All tracked”, or clear the filters above.</div>`;

  // Stage mix - always meaningful, in or out of session.
  const byOutcome = o => list.filter(b => dkOutcome(b) === o);
  const law = byOutcome('law'), vetoed = byOutcome('vetoed'),
        gov = byOutcome('governor'), died = byOutcome('died');
  const open = list.filter(b => dkOutcome(b) === null);
  const dist = [
    ['In committee', '#0E7C86', open.filter(b => DK_COMMITTEE.includes(effStage(b))).length],
    ['Crossed over', '#5B7FBF', open.filter(b => DK_CROSSED.includes(effStage(b))).length],
    ['Governor', '#7E5BA6', gov.length],
    ['Signed into law', '#3E8E63', law.length],
    ['Vetoed', '#B9713A', vetoed.length],
    ['Died / deferred', '#8FA1AD', died.length],
  ].filter(([, , n]) => n > 0);
  const distBlock = dist.length ? `
    <div style="margin:0 0 16px">
      <div style="display:flex;gap:3px;margin-bottom:5px">${dist.map(([l, c, n]) =>
        `<span title="${l}: ${n}" style="flex:${n};background:${c};height:9px;border-radius:2px"></span>`).join('')}</div>
      <div>${dist.map(([l, c, n]) =>
        `<span style="font-size:10.5px;color:var(--muted);margin-right:12px;white-space:nowrap"><span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${c};margin-right:4px"></span>${l} <b>${n}</b></span>`).join('')}</div>
    </div>` : '';

  // ============ BETWEEN SESSIONS ============
  // Nothing is pending, so "what needs doing today" is the wrong question.
  // Show what the session actually did, grouped by real outcome, expanded.
  if (SESSION_OVER) {
    const stat = (v, l, warn) => `<div class="stat ${warn ? 'warn' : ''}"><div class="v">${v}</div><div class="l">${l}</div></div>`;
    const byNum = (a, b) => a.bill_number.localeCompare(b.bill_number);
    const actOf = b => (b.last_action || '').match(/Act\s+\d+[^.]*/i)?.[0] || '';
    return `
      <div class="dashhead">
        <h1>${esc(who)}'s desk — ${SESSION_YEAR} session results</h1>
        <span class="sub">${today} · session adjourned sine die · ${list.length} bill${list.length !== 1 ? 's' : ''} tracked
          · the live desk (hearings, testimony deadlines, radar) returns when the ${SESSION_YEAR + 1} session convenes</span>
      </div>
      <div class="stats">
        ${stat(law.length, 'Signed into law')}
        ${stat(vetoed.length, 'Vetoed', vetoed.length > 0)}
        ${stat(died.length, 'Died / deferred')}
        ${stat(open.length + gov.length, 'No final action')}
      </div>
      ${distBlock}
      ${bulkBar()}
      ${dkBand('✅', 'Signed into law', 'wins from this session', [...law].sort(byNum),
        b => dkRow(b, actOf(b) ? `<b style="flex:0 0 auto;color:#3E8E63;font-size:11px">${esc(actOf(b))}</b>` : ''))}
      ${dkBand('⛔', 'Vetoed', 'passed both chambers, then vetoed', [...vetoed].sort(byNum),
        b => dkRow(b, `<b style="flex:0 0 auto;color:#C2483B;font-size:11px">VETOED</b>`))}
      ${dkBand('⏳', 'Still with the Governor', 'awaiting signature or veto', [...gov].sort(byNum))}
      ${dkBand('✖️', 'Died or deferred', 'killed in committee or on the floor', [...died].sort(byNum),
        b => dkRow(b, `<span style="flex:0 0 auto;font-size:11px;color:var(--muted)">${esc(b.committee || '')}</span>`))}
      ${dkBand('☰', 'No recorded final action', 'stalled without a formal kill', [...open].sort(byNum),
        b => dkRow(b, `<span style="flex:0 0 auto;font-size:11px;color:var(--muted)">${STAGE_LABEL[effStage(b)]}</span>`))}`;
  }

  // ============ IN SESSION ============
  const hUp = S.hearings.filter(h => ids.has(h.bill_id) && new Date(h.scheduled_at) > new Date())
    .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
  const hFor = b => hUp.find(h => h.bill_id === b.id);
  const due48 = hUp.filter(h => h.testimony_deadline &&
    new Date(h.testimony_deadline) > new Date() &&
    new Date(h.testimony_deadline) - now < 48 * 3600e3);
  const todayStr = new Date().toLocaleDateString('en-US', { timeZone: 'Pacific/Honolulu' });
  const todayH = hUp.filter(h => !due48.includes(h) &&
    new Date(h.scheduled_at).toLocaleDateString('en-US', { timeZone: 'Pacific/Honolulu' }) === todayStr);
  const radar = open.map(b => ({ b, dl: nextDeadline(b) }))
    .filter(x => x.dl && x.dl.days >= 0 && x.dl.days <= RADAR_DAYS && !hFor(x.b))
    .sort((x, y) => x.dl.days - y.dl.days || (x.b.priority || 3) - (y.b.priority || 3));
  const radarDl = new Map(radar.map(x => [x.b.id, x.dl]));

  // NOW strip: everything time-critical, clock-sorted, at most 6.
  const tiles = [
    ...due48.map(h => ({ k: 'due', b: bill(h.bill_id), h, t: +new Date(h.testimony_deadline) })),
    ...todayH.map(h => ({ k: 'today', b: bill(h.bill_id), h, t: +new Date(h.scheduled_at) })),
    ...radar.filter(x => x.dl.days <= 5).map(x => ({ k: 'radar', b: x.b, dl: x.dl,
      t: +new Date(x.dl.date + 'T23:59:59-10:00') })),
  ].filter(x => x.b).sort((a, b) => a.t - b.t).slice(0, 6);
  const COL = { due: '#C2483B', today: '#C9A227', radar: '#7E5BA6' };
  const tileHtml = it => {
    const c = COL[it.k];
    const head = it.k === 'due' ? `TESTIMONY DUE IN ${Math.max(0, Math.round((it.t - now) / 36e5))}H`
      : it.k === 'today' ? `HEARING TODAY ${fmtDT(it.h.scheduled_at).split(', ').pop()}`
      : `${it.dl.label.toUpperCase()} IN ${it.dl.days}D`;
    const sub = it.h ? `${esc(it.h.committee)} · ${esc(it.h.room || 'room TBD')}`
      : `waiting in ${esc(it.b.committee || 'committee')} — no hearing`;
    return `<div class="dk-tile" data-bill="${it.b.id}" style="flex:0 0 auto;min-width:190px;max-width:250px;
      border:1px solid var(--line);border-left:4px solid ${c};border-radius:10px;padding:9px 11px;background:var(--panel);cursor:pointer">
      <div style="font-size:9.5px;font-weight:700;letter-spacing:.03em;color:${c}">${head}</div>
      <div style="font-weight:700;font-size:13px;margin-top:2px">${esc(it.b.bill_number)}</div>
      <div style="font-size:11px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${sub}</div>
      <div style="margin-top:7px;display:flex;gap:5px">
        ${it.k === 'due' ? draftActionBtn(it.b, it.h.committee) : ''}
        <a class="btn sm ghost" href="${esc(capitolUrl(it.b))}" target="_blank" rel="noopener" onclick="event.stopPropagation()">Capitol ↗</a>
      </div></div>`;
  };

  // Since your last visit
  const sinceH = S.hearings.filter(h => ids.has(h.bill_id) && h.notice_posted_at &&
    new Date(h.notice_posted_at).getTime() > S.sinceVisit && new Date(h.scheduled_at) > new Date()).slice(0, 6);
  const evBy = {};
  for (const ev of (S.sinceEvents || [])) if (ids.has(ev.bill_id)) (evBy[ev.bill_id] ||= []).push(ev);
  const sinceRows = Object.entries(evBy).map(([bid, evs]) => ({ b: bill(bid), evs }))
    .filter(x => x.b).slice(0, 6);
  const nNew = sinceH.length + sinceRows.length;

  // Bands, each bill in exactly one
  const hearBills = hUp.map(h => bill(h.bill_id)).filter(Boolean)
    .filter((b, i, a) => a.findIndex(x => x.id === b.id) === i);
  const inBand = new Set(hearBills.map(b => b.id));
  const waitBills = radar.map(x => x.b).filter(b => !inBand.has(b.id));
  waitBills.forEach(b => inBand.add(b.id));
  const movedBills = open.filter(b => !inBand.has(b.id) &&
    b.last_action_date && now - new Date(b.last_action_date) < 7 * 864e5)
    .sort((a, b) => (b.last_action_date || '').localeCompare(a.last_action_date || ''));
  movedBills.forEach(b => inBand.add(b.id));
  const restBills = open.filter(b => !inBand.has(b.id))
    .sort((a, b) => (a.priority || 3) - (b.priority || 3) || a.bill_number.localeCompare(b.bill_number));
  const settled = [...law, ...vetoed, ...died];

  return `
    <div class="dashhead">
      <h1>${esc(who)}'s desk — one view</h1>
      <span class="sub">${today} · ${list.length} bills · ${hUp.length} hearing${hUp.length !== 1 ? 's' : ''} ahead${
        nNew ? ` · <b style="color:#C9A227">${nNew} new since your last visit</b>` : ''}</span>
    </div>
    <div style="display:flex;gap:8px;overflow-x:auto;padding:0 0 12px">${
      tiles.length ? tiles.map(tileHtml).join('')
        : `<div style="font-size:13px;color:var(--muted);padding:4px 2px">Nothing time-critical right now — no testimony deadlines, hearings today, or deadlines inside 5 days. 🤙</div>`}</div>
    ${nNew ? `<details class="panel sincefold" style="margin-bottom:8px" ${isMobile() ? '' : 'open'}>
      <summary class="ph"><span>⚡ Since your last visit <span class="chipx c-gold">${nNew}</span></span><span class="psub">after ${fmtDT(S.sinceVisit)}${isMobile() ? ' · tap' : ''}</span></summary>
      ${sinceH.map(h => { const b = bill(h.bill_id); return b ? `
        <div class="prow" data-bill="${b.id}"><div class="pmain">📅 <b>${esc(b.bill_number)}</b> — ${esc(h.committee)} hearing posted${
          (dr => dr ? ` <a class="draftlink" href="${esc(dr.doc_url)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">\ud83d\udcc4 ${dr.status === 'filed' ? 'filed' : 'draft'} \u2197</a>` : '')(draftFor(b.id, h.committee))}
          <div class="psmall">${fmtDT(h.scheduled_at)} · ${esc(h.room || 'room TBD')}</div></div></div>` : ''; }).join('')}
      ${sinceRows.map(({ b, evs }) => `
        <div class="prow" data-bill="${b.id}"><div class="pmain">${AMENDED_RE.test(evs[0].title) ? '✏️ ' : ''}<b>${esc(b.bill_number)}</b> — ${esc(evs[0].title.slice(0, 78))}
          <div class="psmall">${fmtDate(evs[0].occurred_at)}${evs.length > 1 ? ` · +${evs.length - 1} more` : ''}</div></div></div>`).join('')}
    </details>` : ''}
    ${distBlock}
    ${bulkBar()}
    ${dkBand('◷', 'Hearing scheduled', 'soonest first', hearBills, b => { const h = hFor(b);
      const urgent = h.testimony_deadline && new Date(h.testimony_deadline) > new Date() &&
        new Date(h.testimony_deadline) - now < 48 * 3600e3;
      return dkRow(b, `<span style="flex:0 0 auto;font-size:11px;${urgent ? 'color:#C2483B;font-weight:700' : 'color:var(--muted)'}">${esc(h.committee)} ${fmtDT(h.scheduled_at)}</span>`); })}
    ${dkBand('📡', 'Waiting — deadline near', `no hearing on the books`, waitBills, b => { const dl = radarDl.get(b.id);
      return dkRow(b, `<span style="flex:0 0 auto;font-size:11px;${dl.days <= 5 ? 'color:#C2483B;font-weight:700' : 'color:var(--muted)'}">${esc(dl.label)} ${dl.days}d</span>`); })}
    ${dkBand('⚡', 'Moved this week', 'official action in the last 7 days', movedBills,
      b => dkRow(b, `<span style="flex:0 0 auto;font-size:11px;color:var(--muted)">${fmtDate(b.last_action_date)}</span>`))}
    ${dkBand('☰', 'In progress', 'active, nothing scheduled', restBills,
      b => dkRow(b, `<span style="flex:0 0 auto;font-size:11px;color:var(--muted)">${STAGE_LABEL[effStage(b)]}</span>`))}
    ${settled.length ? `<div class="panel" style="margin-bottom:8px">
      <div class="ph" id="dk-out" style="cursor:pointer"><span>${S.deskOut ? '▾' : '▸'} Outcomes — law · vetoed · died</span>
        <span class="psub">${settled.length} · tap to ${S.deskOut ? 'collapse' : 'expand'}</span></div>
      ${S.deskOut ? settled.map(b => dkRow(b, dkOutcome(b) === 'law'
        ? `<b style="flex:0 0 auto;color:#3E8E63;font-size:11px">LAW</b>`
        : `<span style="flex:0 0 auto;font-size:11px;color:var(--muted)">${STAGE_LABEL[effStage(b)]}</span>`)).join('') : ''}
    </div>` : ''}`;
}

// ---------------- Cards view (advocacy print) ----------------
let SESSION_OVER = DEMO ? false : true;   // set from the calendar at load: over once sine die has passed
// Official session calendar (LRB, 2026). One place to update each December.
// The sandbox uses the same calendar, frozen at DEMO_ASOF.
let DEADLINES = {   // fallback only; the real calendar comes from session_deadlines
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
function applySessionDeadlines(rows) {
  if (!rows || !rows.length) return;
  const yr = Math.max(...rows.map(r => r.session_year));
  const mine = rows.filter(r => r.session_year === yr).sort((a, b) => a.deadline_date.localeCompare(b.deadline_date));
  const bucket = { intro_cutoff: 'introduced', final_decking: 'conference', fiscal: 'conference', sine_die: 'governor' };
  const dl = {};
  for (const r of mine) { const k = bucket[r.key] || r.key; (dl[k] ??= []).push([r.label, String(r.deadline_date).slice(0, 10)]); }
  if (Object.keys(dl).length >= 8) { DEADLINES = dl; SESSION_YEAR = yr; }
  const sine = mine.find(r => r.key === 'sine_die');
  SESSION_OVER = DEMO ? false : !!sine && Date.now() > new Date(sine.deadline_date + 'T23:59:59-10:00').getTime() + 864e5;
}
// Dying-quietly radar: committee stages where "no hearing scheduled" is the
// death signal, and the deadline each stage races. Bills still at Introduced
// race the lateral (or triple, if 3X) filing date.
const RADAR_DAYS = 14;
const RADAR_STAGES = ['introduced','first_triple','first_lateral','first_decking',
                      'second_triple','second_lateral','second_decking'];
// The referral path, one line per chamber, with the current stop marked.
// bills.referrals holds both chambers' committees in order; origin_stops
// says how many belong to the chamber the bill started in.
function referralPath(b) {
  const refs = b.referrals || []; if (!refs.length) return '—';
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
// Where the bill stands (stops.js): leg, committee, position, deadline, hearing, board column.
function stopOf(b) {
  return billStop(b, { stage: effStage(b), hearings: S.hearings.filter(h => h.bill_id === b.id), outcomes: S.outcomes || {},
    deadlineFor: key => { const last = (DEADLINES[key] || []).slice(-1)[0]; return last ? { label: last[0], date: last[1] } : null; } });
}
// The committee deadline a bill still has to make (null once it is through committee or has missed it).
const nextDeadline = b => { const st = stopOf(b); return st.phase === 'committee' && st.deadline && !st.deadline.missed ? st.deadline : null; };
// True triple referral: 3+ stops within a SINGLE chamber (joint committees
// count as one) — that is what races the Triple Filing deadline. Computed
// by the sync per chamber; the combined referrals list is display-only.
const isTriple = b => (b.origin_stops || 0) >= 3 || (b.second_stops || 0) >= 3;
const RAIL = [['introduced','Intro'],['first_lateral','1st\nLat'],['first_decking','1st\nDeck'],
  ['first_crossover','Cross'],['second_lateral','2nd\nLat'],['second_decking','2nd\nDeck'],
  ['conference','Conf'],['governor','Gov'],['enacted','Law']];
const RAIL_IDX = { introduced:0, first_triple:1, first_lateral:1, first_decking:2, first_crossover:3,
  second_triple:4, second_lateral:4, second_decking:5, second_crossover:5, conference:6, governor:7,
  enacted:8, vetoed:7, dead:null };
// "First Lateral 2/20/26" -> a sentence, for the Did not advance fold and the panel.
function whyDead(b) {
  const m = /^(.*?)\s+(\d+\/\d+\/\d+)$/.exec(b.died_deadline || '');
  if (m) return `Missed the ${esc(m[1])} deadline on ${m[2]}${b.committee ? ` while waiting in ${esc(b.committee)}` : ''}.`;
  if (b.died_deadline) return `Missed the ${esc(b.died_deadline)} deadline.`;
  if (/deferred/i.test(b.last_action || '')) return 'Deferred by the committee, which ends it for the year.';
  if (/failed to pass/i.test(b.last_action || '')) return 'Failed a floor vote.';
  return effStage(b) === 'vetoed' ? 'Vetoed by the Governor.' : 'Did not advance.';
}
const diedish = b => { const st = effStage(b);
  if (st === 'dead' || st === 'vetoed') return true;
  if (S.hearings.some(h => h.bill_id === b.id && new Date(h.scheduled_at) > new Date())) return false;
  if (/deferred|failed to pass/i.test(b.last_action || '')) return true;
  return SESSION_OVER && !['enacted','governor'].includes(st); };
// Companion-alive chip: my bill died but its cross-chamber twin is moving.
const compChip = (b, pv) => {
  if (!diedish(b)) return '';
  const alive = (b.companions || []).find(n => {
    const st = S.compStage[n];
    if (!st || st === 'dead' || st === 'vetoed') return false;
    return SESSION_OVER ? (st === 'enacted' || st === 'governor') : true;
  });
  if (!alive) return '';
  return pv
    ? `<span class="pv-tag" style="color:var(--pgreen);border-color:var(--pgreen)">COMPANION ${esc(alive)} ALIVE</span>`
    : `<span class="chipx c-green" style="font-size:9px" title="Companion bill is still moving — consider switching vehicles">${esc(alive)} ALIVE</span>`;
};
const tierOf = b => {
  const p = b.position;
  if ((p === 'support' || p === 'oppose') && b.priority === 1) return 0;   // strongly
  if (p === 'strongly_support' || p === 'support' || p === 'support_amend' || p === 'strongly_oppose' || p === 'oppose' || p === 'neutral') return 1;
  return 2;                                                                 // monitor / unset
};
const posLabel = b => {
  const strong = b.priority === 1 ? 'STRONGLY ' : '';
  return { strongly_support: 'STRONGLY SUPPORT', strongly_oppose: 'STRONGLY OPPOSE', support: strong + 'SUPPORT', support_amend: 'SUPPORT W/ AMENDMENTS',
    oppose: strong + 'OPPOSE', neutral: 'COMMENT', monitor: 'MONITOR' }[b.position] || 'MONITOR';
};
const headClass = b => {
  const p = b.position;
  if (tierOf(b) === 0) return p === 'oppose' ? 'solid-r' : 'solid-g';
  if (p === 'strongly_support') return 'solid-g';
  if (p === 'strongly_oppose') return 'solid-r';
  if (p === 'support' || p === 'support_amend') return 'hatch-g';
  if (p === 'oppose') return 'hatch-r';
  if (p === 'neutral') return 'hatch-t';
  return 'plain';
};
function pvRail(b) {
  const dead = diedish(b);
  let idx = RAIL_IDX[effStage(b)]; if (idx == null) idx = 0;
  return `<div class="pv-rail">${RAIL.map(([v,l], i) => `
    <div class="pv-stop ${i < idx ? 'done' : ''} ${i === idx && !dead ? 'now' : (i === idx ? 'done' : '')}">
      <span class="sq"></span><span class="sl">${l.replace('\n','<br>')}</span></div>`).join('')}</div>`;
}
function pvCard(b) {
  const camps = (S.billCampaigns[b.id]||[]).map(c => S.campaigns.find(x=>x.id===c)?.name).filter(Boolean);
  const filed = (S.pulse[b.id]?.testimony_count || 0) > 0;
  return `<div class="pv-card ${diedish(b) ? 'dead' : ''}" data-bill="${b.id}">
    <div class="pv-head ${headClass(b)}">${posLabel(b)}</div>
    ${diedish(b) ? '<div class="pv-stamp">DIED / STALLED</div>' : ''}
    <div class="pv-body">
      <div class="pv-meta"><span class="pv-bno">${esc(b.bill_number)}</span>
        ${b.priority ? `<span class="pv-tag ${b.priority===1?'hi':''}">${['','HIGH','MEDIUM','LOW'][b.priority]}</span>` : ''}
        ${isTriple(b) ? '<span class="pv-tag">TRIPLE REFERRAL</span>' : ''}
        ${compChip(b, true)}
        ${camps.map(c => `<span class="pv-tag coal">${esc(c)}</span>`).join('')}</div>
      <div class="pv-title">${esc(b.title||'')}</div>
      ${b.description ? `<div class="pv-desc">${esc(b.description)}</div>` : ''}
      <div class="pv-kv">
        <span class="k">Latest</span><span>${esc(b.last_action||'—')} <span class="date">${fmtDate(b.last_action_date,{year:'2-digit'})}</span></span>
        <span class="k">Committees</span><span>${esc((b.referrals||[]).join(', ') || b.committee || '—')}</span>
        ${filed ? `<span class="k">Testimony</span><span><span class="pv-tag">FILED</span></span>` : ''}
      </div>
      ${pvRail(b)}
    </div>
    <div class="pv-foot"><a href="${esc(capitolUrl(b))}" target="_blank" rel="noopener" onclick="event.stopPropagation()">Official page ↗</a>
      <span style="color:var(--ptealD)">Open in tracker ▸</span></div>
  </div>`;
}
function renderCards(list) {
  if (S.camp) list = list.filter(b => (S.billCampaigns[b.id]||[]).includes(S.camp));
  const now = new Date(), soon = Date.now() + 7*864e5;
  const hearingsUp = S.hearings.filter(h => list.some(b => b.id === h.bill_id) && new Date(h.scheduled_at) > now);
  const stats = [
    [list.length, 'Bills tracked'],
    [hearingsUp.length, 'Hearings scheduled'],
    [hearingsUp.filter(h => h.testimony_deadline && new Date(h.testimony_deadline) < new Date(soon)).length, 'Deadline soon'],
    [list.filter(b => effStage(b) === 'enacted').length, 'Enacted / adopted'],
    [list.filter(diedish).length, 'Died / stalled'],
  ];
  const campCounts = {};
  visibleBills().forEach(b => (S.billCampaigns[b.id]||[]).forEach(c => campCounts[c] = (campCounts[c]||0)+1));
  const tiers = [['ACTIVE — STRONGLY SUPPORT · STRONGLY OPPOSE', b => !diedish(b) && tierOf(b)===0],
    ['ACTIVE — SUPPORT · OPPOSE · COMMENT', b => !diedish(b) && tierOf(b)===1],
    ['ACTIVE — MONITOR', b => !diedish(b) && tierOf(b)===2],
    ['DIED / STALLED — STRONGLY SUPPORT · STRONGLY OPPOSE', b => diedish(b) && tierOf(b)===0],
    ['DIED / STALLED — SUPPORT · OPPOSE · COMMENT', b => diedish(b) && tierOf(b)===1],
    ['DIED / STALLED — MONITOR', b => diedish(b) && tierOf(b)===2]];
  const tix = hearingsUp.slice(0,6).map(h => { const b = S.bills.find(x=>x.id===h.bill_id); if (!b) return '';
    const hrs = h.testimony_deadline ? Math.max(0, Math.round((new Date(h.testimony_deadline)-Date.now())/36e5)) : null;
    return `<div class="pv-tick"><div class="bn">${esc(b.bill_number)}</div>
      <div class="when">${fmtDT(h.scheduled_at)} · ${esc(h.committee)}</div>
      ${hrs != null ? `<div class="due">TESTIMONY DUE IN ${hrs}H</div>` : ''}</div>`; }).join('');
  return `<div class="pv">
    ${hearingsUp.length ? `<div class="pv-testify"><div class="h"><span class="t">TESTIFY</span>
      <span class="s">Upcoming hearings &amp; committee meetings</span></div>
      <div class="pv-tix">${tix}</div></div>` : ''}
    <div class="pv-stats">${stats.map(([v,l]) =>
      `<div class="pv-stat"><div class="v pdisp">${v}</div><div class="l">${l}</div></div>`).join('')}</div>
    <div class="pv-tabs"><button class="pv-tab ${!S.camp?'on':''}" data-camp="">All coalitions<span class="n">${visibleBills().length}</span></button>
      ${S.campaigns.filter(c => campCounts[c.id]).map(c =>
        `<button class="pv-tab ${S.camp===c.id?'on':''}" data-camp="${c.id}">${esc(c.name)}<span class="n">${campCounts[c.id]}</span></button>`).join('')}</div>
    ${tiers.map(([label, fn]) => { const bs = list.filter(fn); return bs.length ? `
      <div class="pv-sechead">${label}</div>
      <div class="pv-grid">${bs.map(pvCard).join('')}</div>` : ''; }).join('') ||
      '<div class="empty">No bills match these filters.</div>'}
  </div>`;
}

// ---------------- settings: your Slack messages, and (admins) the alert rules ----------------
const WORKFLOW_KINDS = [['chat', 'Someone wrote in the chat on a bill I own, follow or took part in'], ['draft_created', 'A draft was created for one of my bills'],
  ['review_requested', 'Someone submitted testimony for my approval'],
  ['second_review_requested', 'A first-time testimony needs my second approval'],
  ['approved', 'Testimony I submitted was approved'],
  ['changes_requested', 'A reviewer asked me for changes'],
  ['filed', 'Someone marked testimony filed']];
const TEMPLATE_KINDS = [['hearing_alert', 'Hearing alert (per bill)'], ['hearing_rescheduled', 'Hearing moved'],
  ['hearing_cancelled', 'Hearing cancelled'], ['draft_thread', 'Draft ready (thread reply)'],
  ['reminder_morning', 'Reminder: morning of deadline'], ['reminder_before', 'Reminder: hours before'],
  ['reminder_after', 'Reminder: deadline passed'], ['daily_head', 'Daily list heading'], ['daily_empty', 'Daily list, nothing due']];
const TOKENS = '{{bill}} {{title}} {{position}} {{priority}} {{owner}} {{committee}} {{hearing}} {{room}} {{deadline}} {{deadline_time}} {{hours}} {{status}} {{draft}} {{tracker}} {{pdf}} {{days}} {{date}}';
function renderSettings() {
  const me = S.me || {}, prefs = me.prefs || {}, rem = prefs.reminders || {}, wf = prefs.workflow || {};
  const cfg = S.slackCfg || {}, dflt = cfg.reminder_defaults || {}, daily = cfg.daily || {}, tpl = cfg.templates || {};
  const v = (x, d) => x == null ? d : x;
  const chk = (id, on, label, hint) => `<label class="row"><input type="checkbox" id="${id}" ${on ? 'checked' : ''}><span>${label}${hint ? `<span class="tok"> · ${hint}</span>` : ''}</span></label>`;
  const slackState = DEMO ? 'sandbox' : me.slack_user_id ? 'connected' : 'not matched yet - matched by email on the first message';
  const mine = `
    <section>
      <h2>Your Slack messages</h2>
      <p class="tok">Slack account: ${esc(slackState)}. Anything switched off here arrives by email instead when it is a workflow step, and not at all when it is a reminder.</p>
      ${chk('st-dm', me.slack_dm !== false, 'Send me Slack direct messages')}
      <h3>Testimony deadline reminders</h3>
      <p class="tok">Only for bills I own, and only while the testimony is not marked filed.</p>
      <label class="row"><input type="checkbox" id="st-mon" ${v(rem.morning_on, dflt.morning_on !== false) ? 'checked' : ''}><span>The morning of the deadline at</span>
        <input type="time" id="st-mont" value="${esc(v(rem.morning, dflt.morning || '08:35'))}"></label>
      <label class="row"><input type="checkbox" id="st-bef" ${v(rem.before_on, dflt.before_on !== false) ? 'checked' : ''}><span></span>
        <input type="number" id="st-befh" min="0.5" max="48" step="0.5" value="${esc(v(rem.hours_before, dflt.hours_before || 1))}"><span>hour(s) before the deadline</span></label>
      <label class="row"><input type="checkbox" id="st-aft" ${v(rem.after_on, dflt.after_on !== false) ? 'checked' : ''}><span>After the deadline has passed, at</span>
        <input type="time" id="st-aftt" value="${esc(v(rem.after, dflt.after || '16:00'))}"></label>
      <h3>Workflow messages</h3>
      ${WORKFLOW_KINDS.map(([k, l]) => chk('st-wf-' + k, wf[k] !== false, l)).join('')}
      <div class="btns"><button class="btn" id="st-save-me">Save my settings</button>
        <button class="btn ghost" id="st-test">Send me a test DM</button></div>
    </section>`;
  const admin = !me.is_admin ? '' : `
    <section>
      <h2>Hearing alerts <span class="tag a">admin</span></h2>
      <label class="row"><span style="min-width:140px">Main channel</span><input id="st-main" value="${esc(cfg.main_channel || '')}" placeholder="#hearing-alerts-2027"></label>
      <p class="tok">Alert on bills with these positions:</p>
      ${POSITIONS.filter(p => p[0]).map(([val, l]) => chk('st-pos-' + val, (cfg.positions || []).includes(val), l)).join('')}
      <h3>Coalition channels</h3>
      <p class="tok">Each bill also posts to its coalition's channel. Leave blank for main channel only. The app must be invited to private channels.</p>
      ${S.campaigns.map(c => `<label class="row"><span style="min-width:140px">${esc(c.name)}</span><input data-coal="${c.id}" value="${esc(c.slack_channel || '')}" placeholder="#channel-name"></label>`).join('')}
      <h3>Daily hearings list</h3>
      <label class="row"><input type="checkbox" id="st-d-on" ${daily.enabled !== false ? 'checked' : ''}><span>Post every day at</span>
        <input type="time" id="st-d-time" value="${esc(daily.time || '07:00')}"><span>looking</span>
        <input type="number" id="st-d-days" min="1" max="30" value="${esc(daily.days_ahead || 7)}"><span>days ahead</span></label>
      <label class="row"><span style="min-width:140px">To channel</span><input id="st-d-chan" value="${esc(daily.channel || '')}" placeholder="(main channel)"></label>
      ${chk('st-d-empty', !!daily.post_when_empty, 'Post even when there are no hearings')}
      <h3>Other</h3>
      ${chk('st-wfdm', cfg.workflow_dm !== false, 'Workflow steps go to Slack DMs', 'off = everyone gets email')}
      ${chk('st-health', cfg.health_dm !== false, 'Pipeline health alerts DM the admins')}
      ${chk('st-quiet', cfg.quiet_dm !== false, 'DM the admins when a notice arrives that alerts nobody', 'no tracked bills, or none with a position')}
      <h3>Message wording</h3>
      <p class="tok">Tokens: ${esc(TOKENS)}. Slack formatting: *bold*, _italic_, &lt;url|label&gt;. A link whose token is empty disappears on its own.</p>
      ${TEMPLATE_KINDS.map(([k, l]) => `<label class="col"><span>${l}</span><textarea data-tpl="${k}">${esc(tpl[k] || '')}</textarea></label>`).join('')}
      <div class="btns"><button class="btn" id="st-save-admin">Save alert settings</button></div>
    </section>
    <section id="st-ready">
      <h2>Session readiness <span class="tag a">admin</span></h2>
      <p class="tok">Everything that has to be true before session opens (SESSION_START.md). Automatic rows re-check each time this page opens; tick the manual ones yourself. <button class="btn sm ghost" id="st-recheck">Re-check</button></p>
      <div id="readymount" class="ready"><div class="pempty">Checking…</div></div>
      ${(gaps => `<div class="rrow ${gaps.length ? 'bad warn' : 'ok'}"><span class="rstat">${gaps.length ? '⚠️' : '✅'}</span><span class="rlab">Public page content on the bills we push hardest<span class="rdet">${gaps.length ? `${gaps.length} strongly supported or opposed bill${gaps.length === 1 ? '' : 's'} without a one-line summary or an ask — the public page shows the official title instead` : 'every strongly supported or opposed bill has a summary and an ask'}</span>${gaps.length ? `<span class="rfix">Open each one → Public tab. ${gaps.slice(0, 40).map(b => `<a data-bill="${b.id}" style="cursor:pointer;margin-right:6px">${esc(b.bill_number)}${!b.public_summary ? '*' : ''}</a>`).join('')}${gaps.length > 40 ? ` +${gaps.length - 40} more` : ''}<br><span class="tok">* no summary either</span></span>` : ''}</span></div>`)(S.bills.filter(b => b.tracked && ['strongly_support', 'strongly_oppose'].includes(b.position) && !diedish(b) && (!(b.public_summary || '').trim() || !(b.public_action || '').trim())))}
      <h3>Import the session</h3>
      <p class="tok">When Open States publishes the new session, paste the CSV export link from <a href="https://open.pluralpolicy.com/data/session-csv" target="_blank" rel="noopener">open.pluralpolicy.com/data/session-csv ↗</a> (Hawaii, the new year). It loads every introduced measure with full histories; safe to re-run.</p>
      <label class="row"><span style="min-width:200px">Session year</span><input type="number" id="st-bulk-year" style="width:110px" value="${SESSION_OVER ? SESSION_YEAR + 1 : SESSION_YEAR}"></label>
      <label class="row"><span style="min-width:200px">CSV export URL</span><input id="st-bulk-url" placeholder="https://data.openstates.org/csv/latest/HI_${SESSION_YEAR + 1}_csv_….zip"><button class="btn sm" id="st-bulk-run">Import</button></label>
      <p class="tok" id="st-bulk-status"></p>
      <label class="row" style="margin-top:10px"><span style="min-width:200px">Hourly sync (opening weeks) until</span><input type="date" id="st-burst" value="${esc((S.syncCfg || {}).burst_until || '')}"><button class="btn sm" id="st-save-burst">Save</button><span class="tok">blank = four times a day</span></label>
    </section>
    <section id="st-coal">
      <h2>Coalitions <span class="tag a">admin</span></h2>
      <p class="tok">The owner gets every bill tracked under the coalition. Keywords feed the Triage suggestions: comma-separated, matched anywhere in the title or description (a fragment like <i>fluorid</i> catches fluoride and fluoridation).</p>
      <div class="coaltab">${S.campaigns.map(c => `<div class="coalrow" data-coal="${c.id}"><b>${esc(c.name)}</b>
        <select data-cowner><option value="">no owner</option>${S.advocates.filter(a => a.is_active).map(a => `<option value="${a.id}" ${c.owner_id === a.id ? 'selected' : ''}>${esc(a.full_name)}</option>`).join('')}</select>
        <input data-cchan value="${esc(c.slack_channel || '')}" placeholder="#slack-channel">
        <input data-ckw value="${esc((c.keywords || []).join(', '))}" placeholder="keywords, comma-separated">
        <input data-cpub value="${esc(c.public_name || '')}" placeholder="public name (what visitors see)">
        <input data-cicon value="${esc(c.icon || '')}" placeholder="icon" title="One emoji for the public page tile" maxlength="4">
        <input data-cdesc value="${esc(c.description || '')}" placeholder="one friendly sentence for the public page tile"></div>`).join('')}</div>
      <div class="btns"><button class="btn" id="st-save-coal">Save coalitions</button></div>
    </section>
    <section id="st-import">
      <h2>Import the tracked list <span class="tag a">admin</span></h2>
      <p class="tok">Upload the <b>All Tracked Bills</b> CSV export from the team spreadsheet (columns: Bill Number, Coalition, Coalition Position). The bills in the file become the tracked list and anything else is untracked; Strongly Support / Strongly Oppose become P1, everything else P2; the owner follows the coalition. You see a summary before anything changes.</p>
      <input type="file" id="st-csv" accept=".csv,text/csv"><div id="st-import-preview"></div>
    </section>
    <section id="st-conn">
      <h2>Connections <span class="tag a">admin</span></h2>
      <p class="tok">Keys are saved write-only: once saved they show as set, never shown again. Leave a field blank to keep what is there; type <b>clear</b> to remove it.</p>
      <h3>Email</h3>
      <p class="tok">${(S.emailCfg || {}).enabled === false ? '⏸ <b>All outgoing email is paused.</b> Alerts, reminders, digests and public hearing emails are held and never sent; Slack still works.' : '✅ Email is on.'}</p>
      ${chk('st-email-on', (S.emailCfg || {}).enabled !== false, 'Send email', 'switch off to hold every outgoing email; held messages are not sent later')}
      <div class="btns"><button class="btn" id="st-save-email">Save email setting</button></div>
      <h3>Google Calendar</h3>
      <p class="tok" id="st-cal-status">Checking…</p>
      <label class="row"><span style="min-width:140px">Client ID</span><input id="st-gid" placeholder="…apps.googleusercontent.com" autocomplete="off"></label>
      <label class="row"><span style="min-width:140px">Client secret</span><input id="st-gsec" type="password" placeholder="GOCSPX-…" autocomplete="new-password"></label>
      <p class="tok">The OAuth client must be a <b>Web application</b> with this authorised redirect URI:<br><code>${SUPABASE_URL}/functions/v1/google-connect</code></p>
      ${chk('st-cal-on', (S.calCfg || {}).enabled !== false, 'Create calendar events for hearings')}
      ${chk('st-cal-test', (S.calCfg || {}).include_test !== false, 'Include [TEST] hearings')}
      <div class="btns"><button class="btn ghost" id="st-save-google">Save Google keys</button>
        <button class="btn" id="st-connect-cal">Connect Google Calendar</button>
        <button class="btn ghost" id="st-save-cal">Save calendar settings</button></div>
      <h3>Slack</h3>
      <p class="tok" id="st-slack-status"></p>
      <label class="row"><span style="min-width:140px">Bot token</span><input id="st-slacktok" type="password" placeholder="xoxb-…" autocomplete="new-password"></label>
      <div class="btns"><button class="btn ghost" id="st-save-slacktok">Save Slack token</button></div>
    </section>`;
  return `<div class="settings"><h1>Settings</h1>${mine}${admin}</div>`;
}
function wireSettings() {
  if (!$('#st-save-me')) return;
  $('#st-save-me').onclick = async () => {
    const prefs = { ...(S.me.prefs || {}),
      reminders: { morning_on: $('#st-mon').checked, morning: $('#st-mont').value || '08:35',
        before_on: $('#st-bef').checked, hours_before: Number($('#st-befh').value) || 1,
        after_on: $('#st-aft').checked, after: $('#st-aftt').value || '16:00' },
      workflow: Object.fromEntries(WORKFLOW_KINDS.map(([k]) => [k, $('#st-wf-' + k).checked])) };
    try { await DB.saveMyPrefs({ slack_dm: $('#st-dm').checked, prefs }); toast('Saved'); render(); }
    catch (e) { toast(e.message, true); }
  };
  $('#st-test').onclick = async () => {
    try { await DB.slackTest(); toast('Test DM on its way'); } catch (e) { toast(e.message, true); }
  };
  const conn = $('#st-conn');
  if (conn) {
    const showStatus = async () => {
      try {
        const st = await DB.secretStatus();
        const cal = S.calCfg || {};
        $('#st-cal-status').innerHTML = st.google_calendar_refresh_token
          ? `✅ Connected${cal.calendar_id ? ' · calendar "' + esc(cal.name || 'HIPHI Hearings') + '" is set' : ' · calendar not created yet, press Connect again'}`
          : `Not connected. Keys: Client ID ${st.google_oauth_client_id ? 'set ✓' : 'missing'} · Client secret ${st.google_oauth_client_secret ? 'set ✓' : 'missing'}. Save both, then press Connect.`;
        $('#st-slack-status').textContent = st.slack_bot_token ? '✅ Bot token set' : 'No bot token saved.';
      } catch (e) { $('#st-cal-status').textContent = e.message; }
    };
    showStatus();
    const saveKeys = async pairs => {
      for (const [k, el] of pairs) {
        const v = $(el).value.trim(); if (!v) continue;
        await DB.setSecret(k, v.toLowerCase() === 'clear' ? '' : v); $(el).value = '';
      }
    };
    $('#st-save-google').onclick = async () => {
      try { await saveKeys([['google_oauth_client_id', '#st-gid'], ['google_oauth_client_secret', '#st-gsec']]); toast('Google keys saved'); showStatus(); }
      catch (e) { toast(e.message, true); }
    };
    $('#st-save-slacktok').onclick = async () => {
      try { await saveKeys([['slack_bot_token', '#st-slacktok']]); toast('Slack token saved'); showStatus(); }
      catch (e) { toast(e.message, true); }
    };
    $('#st-connect-cal').onclick = async () => { try { await DB.connectCalendar(); } catch (e) { toast(e.message, true); } };
    // Session readiness
    const mountReadiness = async () => { const el = $('#readymount'); if (!el) return;
      try { const rows = await DB.readiness(); const bad = rows.filter(r => r.level === 'block' && r.ok === false).length, warn = rows.filter(r => r.level === 'warn' && r.ok === false).length, todo = rows.filter(r => r.level === 'manual' && !r.ok).length;
        el.innerHTML = `<div class="rsum ${bad ? 'bad' : 'ok'}">${bad ? `${bad} blocking issue${bad === 1 ? '' : 's'}` : 'Nothing blocking'}${warn ? ` · ${warn} warning${warn === 1 ? '' : 's'}` : ''}${todo ? ` · ${todo} manual item${todo === 1 ? '' : 's'} to tick` : ''}</div>` +
          rows.map(r => `<div class="rrow ${r.level} ${r.ok === true ? 'ok' : r.ok === false ? 'bad' : ''}"><span class="rstat">${r.level === 'manual' ? `<input type="checkbox" data-rman="${r.key}" ${r.ok ? 'checked' : ''}>` : r.ok === true ? '✅' : r.ok === false ? (r.level === 'block' ? '❌' : '⚠️') : 'ℹ️'}</span><span class="rlab">${esc(r.label)}${r.detail ? `<span class="rdet">${esc(r.detail)}</span>` : ''}${r.ok === false && r.fix ? `<span class="rfix">${esc(r.fix)}</span>` : ''}</span></div>`).join('');
        el.querySelectorAll('[data-rman]').forEach(cb => cb.onchange = async () => { try { await DB.saveReadinessManual(cb.dataset.rman, cb.checked); toast(cb.checked ? 'Ticked' : 'Unticked'); mountReadiness(); } catch (e) { toast(e.message, true); } });
      } catch (e) { el.innerHTML = `<div class="pempty">Could not check: ${esc(e.message)}</div>`; } };
    if ($('#readymount')) mountReadiness();
    $('#st-recheck') && ($('#st-recheck').onclick = () => { $('#readymount').innerHTML = '<div class="pempty">Checking…</div>'; mountReadiness(); });
    $('#st-bulk-run') && ($('#st-bulk-run').onclick = async () => { const url = $('#st-bulk-url').value.trim(), session = $('#st-bulk-year').value.trim();
      if (!/^https:\/\/data\.openstates\.org\/.+\.zip$/.test(url)) { toast('That does not look like an Open States CSV export link', true); return; }
      $('#st-bulk-run').disabled = true; $('#st-bulk-status').textContent = 'Starting…';
      try { await DB.dispatch('bulk-import', { url, session }); $('#st-bulk-status').innerHTML = `Import started for ${esc(session)}. It takes 10–30 minutes; the readiness row "${esc(session)} bills imported" turns green when it lands (re-check).`; toast('Import started'); }
      catch (e) { $('#st-bulk-status').textContent = e.message; toast(e.message, true); $('#st-bulk-run').disabled = false; } });
    $('#st-save-burst') && ($('#st-save-burst').onclick = async () => { const until = $('#st-burst').value || null;
      try { await DB.saveSyncSettings({ ...(S.syncCfg || {}), burst_until: until }); toast(until ? `Hourly sync until ${until}` : 'Back to four syncs a day'); } catch (e) { toast(e.message, true); } });
    // Coalitions
    $('#st-save-coal') && ($('#st-save-coal').onclick = async () => {
      try { for (const row of document.querySelectorAll('.coalrow')) {
          const keywords = row.querySelector('[data-ckw]').value.split(',').map(x => x.trim()).filter(Boolean);
          await DB.saveCampaign(row.dataset.coal, { owner_id: row.querySelector('[data-cowner]').value || null, slack_channel: row.querySelector('[data-cchan]').value.trim() || null, keywords, icon: row.querySelector('[data-cicon]').value.trim() || null, description: row.querySelector('[data-cdesc]').value.trim() || null, public_name: row.querySelector('[data-cpub]').value.trim() || null }); }
        toast('Coalitions saved'); if (S.triage) S.triage.rows = null; } catch (e) { toast(e.message, true); } });
    // Import the tracked list from the spreadsheet export
    $('#st-csv') && ($('#st-csv').onchange = async () => { const f = $('#st-csv').files[0]; if (!f) return; const out = $('#st-import-preview');
      const rows = parseTrackerCsv(await f.text()); if (!rows.length) { out.innerHTML = '<p class="tok">No bill rows found. The header row must contain Bill Number, Coalition and Coalition Position.</p>'; return; }
      out.innerHTML = '<p class="tok">Checking…</p>';
      try { const r = await DB.importTracker(rows, false);
        const sum = r => `<b>${r.in_file}</b> bills in the file · ${r.in_db} found · <b>${r.newly_tracked}</b> newly tracked · ${r.owner_changes} owner changes · ${r.p1} P1, ${r.p2} P2${r.untrack.length ? ` · <b class="hot">${r.untrack.length} untracked</b> (${r.untrack.slice(0, 12).join(', ')}${r.untrack.length > 12 ? '…' : ''})` : ''}${r.missing.length ? ` · not in the database: ${r.missing.join(', ')}` : ''}${r.unknown_coalitions.length ? ` · <b class="hot">unknown coalitions: ${r.unknown_coalitions.join(', ')}</b> (add them under Coalitions first)` : ''}`;
        out.innerHTML = `<p class="tok">${sum(r)}</p><div class="btns"><button class="btn" id="st-import-apply" ${r.unknown_coalitions.length ? 'disabled' : ''}>Apply to the tracker</button></div>`;
        $('#st-import-apply').onclick = async () => { $('#st-import-apply').disabled = true; try { const a = await DB.importTracker(rows, true); out.innerHTML = `<p class="tok">Done. ${sum(a)}</p>`; toast('Tracked list updated — reloading'); setTimeout(() => location.reload(), 1200); } catch (e) { toast(e.message, true); $('#st-import-apply').disabled = false; } };
      } catch (e) { out.innerHTML = `<p class="tok hot">${esc(e.message)}</p>`; } });
    $('#st-save-email') && ($('#st-save-email').onclick = async () => {
      const on = $('#st-email-on').checked;
      try { await DB.saveEmailSettings({ ...(S.emailCfg || {}), enabled: on, changed_at: new Date().toISOString(), changed_by: S.me?.initials || null }); toast(on ? 'Email is on' : 'Email paused — nothing will be sent'); rerenderKeep(); }
      catch (e) { toast(e.message, true); }
    });
    $('#st-save-cal').onclick = async () => {
      try { await DB.saveCalendarSettings({ ...(S.calCfg || {}), enabled: $('#st-cal-on').checked, include_test: $('#st-cal-test').checked }); toast('Calendar settings saved'); }
      catch (e) { toast(e.message, true); }
    };
  }
  const sa = $('#st-save-admin');
  if (sa) sa.onclick = async () => {
    const cfg = { ...(S.slackCfg || {}),
      main_channel: $('#st-main').value.trim() || '#hearing-alerts-2027',
      positions: POSITIONS.filter(p => p[0] && $('#st-pos-' + p[0]).checked).map(p => p[0]),
      daily: { enabled: $('#st-d-on').checked, time: $('#st-d-time').value || '07:00',
        days_ahead: Number($('#st-d-days').value) || 7, channel: $('#st-d-chan').value.trim() || null,
        post_when_empty: $('#st-d-empty').checked },
      workflow_dm: $('#st-wfdm').checked, health_dm: $('#st-health').checked, quiet_dm: $('#st-quiet').checked,
      templates: { ...((S.slackCfg || {}).templates || {}),
        ...Object.fromEntries([...document.querySelectorAll('[data-tpl]')].map(t => [t.dataset.tpl, t.value])) } };
    const chans = [...document.querySelectorAll('[data-coal]')].map(i => [i.dataset.coal, i.value.trim() || null]);
    try { await DB.saveSlackSettings(cfg, chans); toast('Alert settings saved'); render(); }
    catch (e) { toast(e.message, true); }
  };
}

const SHORTCUTS = [
  ['/', 'Jump to search'], ['j / k', 'Next / previous bill on the page'], ['Enter or o', 'Open the highlighted bill'], ['Esc', 'Close the bill, a menu, or search'],
  ['f', 'Follow / unfollow the open bill'], ['a', 'I\u2019m attending / not attending the open bill\u2019s next hearing'],
  ['1 – 5', 'Bill tabs: Details, Team, Public, Notes, Timeline'], ['n / p', 'Next / previous week on the calendar'],
  ['g then p / d / t / c / s / i', 'Go to Portfolio, Desk, Table, Cards, Settings, Triage (intake)'], ['t / s / u (Triage)', 'Track / skip the highlighted bill, undo the last decision'], ['1 – 9 (Triage)', 'Track as the nth coalition'], ['?', 'This help page'],
];
function renderHelp() {
  const row = (k, v) => `<div class="krow"><kbd>${esc(k)}</kbd><span>${esc(v)}</span></div>`;
  return `<div class="settings help"><h1>Help</h1>
    <section><h2>Keyboard shortcuts</h2><div class="keys">${SHORTCUTS.map(([k, v]) => row(k, v)).join('')}</div>
      <p class="tok">Shortcuts are off while you are typing in a field.</p></section>
    <section><h2>The home page</h2>
      <p><b>Testimony waiting on you</b> lists the next step that is yours on each draft: write, submit, approve, file. Admins also see <b>Waiting on others</b>. <b>This week</b> is the hearing calendar for the bills in your lens, with the draft\u2019s next step on each card. <b>Where every bill stands</b> sorts live bills by the deadline they are racing: needs a hearing, hearing scheduled, cleared committee. <b>Last 72 hours</b> is everything the Legislature and the team did, newest first.</p>
      <p><b>Viewing</b> picks whose bills you see: My bills (owned or followed), Everyone, or a colleague. <b>Filter</b> narrows by priority, coalition, or triple referral and stays on until cleared.</p></section>
    <section><h2>Testimony workflow</h2>
      <p>A hearing notice arrives → the draft Doc is created in Drive and the owner is told → the owner writes it and presses <b>Submit for review</b> → Nate approves → if it is HIPHI\u2019s first testimony on that bill, Jess or Jaylen also approves → the owner files it at the Capitol and presses <b>Mark filed</b>. Written testimony is due 24 hours before the hearing.</p></section>
    <section><h2>Stages, in plain language</h2>
      ${[['Introduced','Filed, waiting for its first committee hearing'],['1st Triple','Triple-referred bill still at its first stop, racing the Triple Filing date'],['1st Lateral','In a non-final committee of its first chamber, racing the Lateral date'],['1st Decking','In the money committee (FIN or WAM) of its first chamber, racing the Decking date'],['Crossed over','Passed its first chamber, now in the other one'],['2nd Lateral / 2nd Decking','The same steps in the second chamber'],['Passed both','Passed both chambers; may need agreement on amendments'],['Conference','The two chambers are reconciling their versions'],['Governor','Waiting for signature or veto'],['Law','Signed, or became law without signature'],['Dead','Missed a deadline, was deferred, or failed a vote']].map(([k, v]) => `<div class="krow"><b>${k}</b><span>${v}</span></div>`).join('')}</section>
    <section><h2>Deadlines</h2><p>Bills must clear each stage by the session calendar\u2019s dates or they die. The board shows the date each bill is racing and the last regular committee slot before it; the 48-hour notice rule means a hearing has to be announced two days before that slot.</p></section>
    <section><h2>Where things live</h2><p>Drafts: Google Drive, Testimony / year / coalition / bill. Alerts: Slack #hearing-alerts-2027 and coalition channels; DMs for your own steps. Calendar: the HIPHI Hearings Google Calendar. Settings: your DM and reminder preferences under More → Settings. Questions: Nate.</p></section>
  </div>`;
}
// The spreadsheet export: a banner line, then a header with Bill Number /
// Coalition / Coalition Position; quoted fields with embedded newlines.
function parseTrackerCsv(text) {
  const rows = []; let row = [], field = '', q = false; text = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < text.length; i++) { const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; } else field += ch; }
    else if (ch === '"') q = true; else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(field); rows.push(row); row = []; field = ''; }
    else field += ch; }
  if (field || row.length) { row.push(field); rows.push(row); }
  const hi = rows.findIndex(r => r.includes('Bill Number')); if (hi < 0) return [];
  const h = rows[hi], ix = n => h.indexOf(n);
  return rows.slice(hi + 1).map(r => ({ num: (r[ix('Bill Number')] || '').replace(/\s+/g, '').toUpperCase(), coalition: (r[ix('Coalition')] || '').trim(), position: (r[ix('Coalition Position')] || '').trim() }))
    .filter(r => /^(HB|SB)\d+$/.test(r.num));
}
// ---------------- Triage: every introduced bill gets one decision ----------------
// Sandbox: keyword rules against the untracked index (titles + descriptions).
function demoTriageQueue(campaignId, matchedOnly) {
  const idx = (S.snapshot?.index || []).filter(b => !/^GM/.test(b.bill_number) && !S.demoTriaged?.has(b.id) && !S.bills.some(x => x.id === b.id));
  const rules = S.campaigns.filter(c => (c.keywords || []).length);
  const rows = idx.map(b => { const txt = ((b.title || '') + ' ' + (b.description || '')).toLowerCase();
    const matches = rules.map(c => ({ campaign_id: c.id, name: c.name, terms: c.keywords.filter(k => txt.includes(k.toLowerCase())) })).filter(m => m.terms.length);
    return { id: b.id, bill_number: b.bill_number, chamber: b.chamber, title: b.title, description: b.description || null, introduced_at: null, companions: [], matches: matches.length ? matches : null, lookalike: null }; });
  return rows.filter(r => (!campaignId || (r.matches || []).some(m => m.campaign_id === campaignId)) && (!matchedOnly || r.matches))
    .sort((a, b) => (b.matches ? 1 : 0) - (a.matches ? 1 : 0) || a.bill_number.localeCompare(b.bill_number));
}
const DEMO_READINESS = [
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
async function loadTriage() {
  S.triage ??= { camp: null, matchedOnly: true, rows: null, counts: null, focus: 0, last: null };
  try {
    const [rows, counts] = await Promise.all([DB.triageQueue(S.triage.camp, S.triage.matchedOnly), DB.triageCounts()]);
    S.triage.rows = rows; S.triage.counts = counts; S.triage.focus = Math.min(S.triage.focus, Math.max(0, rows.length - 1));
  } catch (e) { S.triage.rows = []; toast('Could not load the triage queue: ' + e.message, true); }
  if (S.view === 'triage') rerenderKeep();
}
function bestCampaign(r) {
  if (r.lookalike?.coalition) { const c = S.campaigns.find(x => x.name === r.lookalike.coalition); if (c) return c; }
  if (r.matches?.length) { const c = S.campaigns.find(x => x.id === r.matches[0].campaign_id); if (c) return c; }
  return S.campaigns.find(c => c.name === 'General HIPHI') || S.campaigns[0];
}
function renderTriage() {
  const t = S.triage ??= { camp: null, matchedOnly: true, rows: null, counts: null, focus: 0, last: null };
  if (t.rows === null) loadTriage();
  const c = t.counts || {};
  const chips = `<div class="tchips">
      <button class="fchip ${!t.camp ? 'on' : ''}" data-tcamp="">All coalitions</button>
      ${S.campaigns.filter(x => (x.keywords || []).length).map(x => `<button class="fchip ${t.camp === x.id ? 'on' : ''}" data-tcamp="${x.id}">${esc(x.name)}${x.owner_id && advocate(x.owner_id) ? ` <span class="cnt">${esc(advocate(x.owner_id).initials)}</span>` : ''}</button>`).join('')}
      <label class="row" style="margin-left:auto"><input type="checkbox" id="t-matched" ${t.matchedOnly ? 'checked' : ''}><span>suggestions only</span></label></div>`;
  const hi = (text, terms) => { let out = esc(text || ''); for (const k of terms) { const re = new RegExp('(' + k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig'); out = out.replace(re, '<mark>$1</mark>'); } return out; };
  const row = (r, i) => { const best = bestCampaign(r); const terms = (r.matches || []).flatMap(m => m.terms); return `
    <div class="trow ${i === t.focus ? 'kfocus' : ''}" data-tid="${r.id}" data-ti="${i}">
      <div class="tmain">
        <div class="tl1"><b>${esc(r.bill_number)}</b> <span class="ttitle">${hi(titleCaseHI(r.title), terms)}</span>${(r.companions || []).length ? ` <span class="chipx c-gray" title="companion">${esc(r.companions.join(', '))}</span>` : ''}</div>
        ${r.description ? `<div class="tdesc">${hi(r.description, terms)}</div>` : ''}
        <div class="tsig">${(r.matches || []).map(m => `<span class="chipx c-navy">${esc(m.name)}</span> <span class="tterms">${m.terms.map(esc).join(', ')}</span>`).join(' · ')}
          ${r.lookalike ? `<span class="tlook">Looks like <b>${esc(r.lookalike.bill_number)}</b> (${r.lookalike.session_year})${r.lookalike.coalition ? ' · ' + esc(r.lookalike.coalition) : ''}${r.lookalike.position ? ' · ' + esc(POSITIONS.find(p => p[0] === r.lookalike.position)?.[1] || r.lookalike.position) : ''}${r.lookalike.priority ? ' · P' + r.lookalike.priority : ''}</span>` : ''}
          ${!r.matches && !r.lookalike ? '<span class="muted">no keyword matched</span>' : ''}</div>
      </div>
      <div class="tacts">
        <button class="btn sm" data-ttrack="${r.id}" data-tcampid="${best.id}">Track as ${esc(best.name)}</button>
        <select class="tsel" data-tsel="${r.id}" title="Track as another coalition"><option value="">other…</option>${S.campaigns.map(x => `<option value="${x.id}">${esc(x.name)}</option>`).join('')}</select>
        <button class="btn sm ghost" data-tskip="${r.id}">Skip</button>
        <a class="btn sm ghost" href="https://www.capitol.hawaii.gov/session/measure_indiv.aspx?billtype=${esc(r.bill_number.replace(/\d+/, ''))}&billnumber=${esc(r.bill_number.replace(/\D+/, ''))}&year=${SESSION_YEAR}" target="_blank" rel="noopener">Capitol ↗</a>
      </div>
    </div>`; };
  const rows = t.rows === null ? '<div class="pempty">Loading the queue…</div>'
    : t.rows.length ? t.rows.map(row).join('') : `<div class="pempty">Nothing waiting${t.matchedOnly ? ' among the suggestions — untick "suggestions only" to see every undecided bill' : ''}. 🤙</div>`;
  return `<div class="triage">
    <div class="dashhead"><h1>Triage</h1><span class="sub">${c.introduced != null ? `${c.introduced} bills introduced in ${c.year} · <b>${c.undecided}</b> undecided · ${c.suggested} suggested · ${c.tracked} tracked` : 'every introduced bill gets one decision: track it or skip it'}${t.last ? ` · <a data-tundo="${t.last.id}">undo ${esc(t.last.bill_number)}</a>` : ''}</span></div>
    <p class="boardhow">Each row is a bill nobody has decided on. <b>Track</b> puts it on the tracker under that coalition with the coalition’s owner, Monitor, P2 — change any of that on the bill page later. <b>Skip</b> hides it for good (undo is one click). Keys: <kbd>j</kbd>/<kbd>k</kbd> move, <kbd>t</kbd> track, <kbd>s</kbd> skip, <kbd>u</kbd> undo.</p>
    ${chips}
    <div class="tlist">${rows}</div>
  </div>`;
}
function wireTriage() {
  const t = S.triage; if (!t) return;
  document.querySelectorAll('[data-tcamp]').forEach(el => el.onclick = () => { t.camp = el.dataset.tcamp || null; t.rows = null; t.focus = 0; render(); });
  $('#t-matched') && ($('#t-matched').onchange = () => { t.matchedOnly = $('#t-matched').checked; t.rows = null; render(); });
  const act = async (id, fn) => { const r = (t.rows || []).find(x => x.id === id); if (!r) return;
    try { await fn(r); t.rows = t.rows.filter(x => x.id !== id); t.focus = Math.min(t.focus, Math.max(0, t.rows.length - 1)); if (t.counts) { t.counts.undecided--; } rerenderKeep(); }
    catch (e) { toast(e.message, true); } };
  document.querySelectorAll('[data-ttrack]').forEach(el => el.onclick = () => act(el.dataset.ttrack, async r => { await DB.triageTrack(r, el.dataset.tcampid); t.last = { ...r, tracked: true }; if (t.counts) t.counts.tracked++; toast(`${r.bill_number} tracked as ${S.campaigns.find(c => c.id === el.dataset.tcampid)?.name || ''}`); }));
  document.querySelectorAll('[data-tsel]').forEach(el => el.onchange = () => { if (!el.value) return; act(el.dataset.tsel, async r => { await DB.triageTrack(r, el.value); t.last = { ...r, tracked: true }; if (t.counts) t.counts.tracked++; toast(`${r.bill_number} tracked as ${S.campaigns.find(c => c.id === el.value)?.name || ''}`); }); });
  document.querySelectorAll('[data-tskip]').forEach(el => el.onclick = () => act(el.dataset.tskip, async r => { await DB.triageSkip(r); t.last = { ...r, tracked: false }; }));
  document.querySelectorAll('[data-tundo]').forEach(el => el.onclick = async () => { const r = t.last; if (!r) return; try { await DB.triageUndo(r); t.last = null; t.rows = null; render(); toast(`${r.bill_number} is back in the queue`); } catch (e) { toast(e.message, true); } });
  document.querySelectorAll('.trow').forEach(el => el.onclick = e => { if (e.target.closest('button, select, a')) return; t.focus = Number(el.dataset.ti); document.querySelectorAll('.trow').forEach(x => x.classList.toggle('kfocus', x === el)); });
}
const titleCaseHI = t => String(t || '').replace(/^RELATING TO /i, 'Relating to ').replace(/\b([A-Z]{2,})\b/g, w => w.charAt(0) + w.slice(1).toLowerCase()).replace(/\bHawaii\b/g, 'Hawaiʻi');
function renderAdd() {
  return `<div class="addbill">
    <h2 style="margin:16px 0 4px">Add bills to the tracker</h2>
    <p style="color:var(--muted);font-size:13px;margin-bottom:12px">
      Search the full imported session (every introduced measure) and start tracking anything new.</p>
    <input type="search" id="addq" placeholder="Search by number (SB123) or keyword…">
    <div class="results" id="addresults"><div class="row" style="color:var(--muted)">Type at least 3 characters…</div></div>
  </div>`;
}

// ---------------- drawer ----------------
async function openDrawer(billId) {
  S.drawerBill = billId; render();
  const b = S.bills.find(x => x.id === billId);
  if (b?.companions?.length) {
    DB.companionInfo(b.companions).then(rows => {
      const el = $('#compmount'); if (!el) return;
      el.innerHTML = b.companions.map(num => {
        const r = rows.find(x => x.bill_number === num);
        if (!r) return esc(num);
        const st = r.stage_override || r.stage || 'introduced';
        const cls = st === 'enacted' ? 'c-green' : (st === 'dead' || st === 'vetoed') ? 'c-gray' : 'c-teal';
        const inApp = S.bills.find(x => x.id === r.id);
        const link = inApp ? `<a href="#" data-comp="${r.id}">${esc(num)}</a>`
          : `<a href="${esc(capitolUrl(r))}" target="_blank" rel="noopener">${esc(num)} ↗</a>`;
        return `<span class="comp">${link}<span class="chipx ${cls}">${STAGE_LABEL[st]||st}</span>${r.tracked ? '' : '<span class="chipx c-gray">not tracked</span>'}</span>`;
      }).join('');
      el.querySelectorAll('[data-comp]').forEach(a =>
        a.onclick = ev => { ev.preventDefault(); openDrawer(a.dataset.comp); });
    }).catch(() => {});
  }
  try {
    const tl = await DB.timeline(billId);
    const el = $('#tlmount'); if (el) el.innerHTML = timelineHTML(tl);
  } catch (e) { toast('Could not load timeline: ' + e.message, true); }
}
function timelineHTML(tlIn) {
  let tl = tlIn;
  if (!tl.length) return `<div style="color:var(--muted);font-size:12.5px">No activity yet.</div>`;
  // The whole history, newest first (the Timeline tab is the last one, so it
  // gets the room). Sandbox: nothing after the frozen date exists.
  // "Hearing notice posted - X" rows are the sync's own bookkeeping, dated when
  // the hearing was imported; the official "has scheduled a public hearing"
  // action already tells the story, so they stay out of the timeline.
  const shown = tl.filter(ev => !(ev.type === 'hearing_auto' && /^Hearing notice posted/.test(ev.title || '')));
  tl = shown;
  return `<div class="tlcap">${tl.length} action${tl.length === 1 ? '' : 's'} · newest first${DEMO ? ` · sandbox is frozen at ${fmtDate(DEMO_ASOF, { year: 'numeric' })}, later actions are not here` : ''}</div>` +
    `<div class="tl">${shown.map(ev => {
    const team = ev.source === 'team', a = advocate(ev.advocate_id);
    return `<div class="ev ${team?'team':''}">
      <div class="when">${fmtDT(ev.occurred_at)}</div>
      <div class="what">${esc(ev.title)}<span class="tag ${team?'t':'a'}">${team?'team':'auto'}</span></div>
      <div class="who">${team && a ? esc(a.full_name)+' · ' : ''}${esc(ev.details||'')}</div>
    </div>`; }).join('')}</div>`;
}
// What the public page is actually showing for this bill right now.
// public_bills gates the action ask on public_action_until >= current_date,
// so an ask with a past date (or no date) silently shows nothing. Staff had
// no way to see that, because these fields had no interface at all.
const hiToday = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Pacific/Honolulu' });
function pubStateCls(b) {
  if (!b.tracked || !b.is_public) return 'pubstate off';
  if (!b.public_summary) return 'pubstate warn';
  if (b.public_action && (!b.public_action_until || b.public_action_until < hiToday()))
    return 'pubstate warn';
  return 'pubstate live';
}
function pubStateText(b) {
  if (!b.tracked) return 'Not tracked, so it does not appear on the public page.';
  if (!b.is_public) return 'Hidden from the public page.';
  if (!b.public_summary)
    return 'Live with no summary — visitors see the bill title and status only.';
  if (b.public_action && !b.public_action_until)
    return 'Action ask written but no expiry date, so it is NOT being shown. Set a date.';
  if (b.public_action && b.public_action_until < hiToday())
    return `Action ask expired ${fmtDate(b.public_action_until)} and is no longer shown.`;
  if (b.public_action)
    return `Summary live. Action ask runs through ${fmtDate(b.public_action_until)}.`;
  return 'Summary live. No action ask set.';
}

// One row per draft document, newest first. Only rendered when a draft
// exists - most bills never have one, and the drawer is long enough.
const DRAFT_LABEL = { draft: 'Draft', review: 'In review', second_review: 'Needs 2nd approval',
  approved: 'Approved', filed: 'Filed', cancelled: 'Hearing cancelled' };
const DRAFT_TAG = { draft: 'a', review: 'w', second_review: 'w', approved: 'g', filed: 't', cancelled: 'a' };
const dWhen = iso => iso ? new Date(iso).toLocaleString('en-US', { timeZone: 'Pacific/Honolulu',
  weekday: 'short', month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';
const nameOf = id => advocate(id)?.full_name || 'someone';
const listNames = (pred, sep) => S.advocates.filter(a => pred(a) && a.is_active !== false)
  .map(a => a.full_name).join(sep) || 'an admin';
// One line that says where the draft is and who it is waiting on.
function draftWho(d) {
  switch (d.status) {
    case 'review': return `Sent by ${nameOf(d.submitted_by)} ${dWhen(d.submitted_at)} \u00b7 waiting for ${listNames(a => a.is_admin, ' or ')}`;
    case 'second_review': return `Approved by ${nameOf(d.approved_by)} \u00b7 first testimony on this bill, needs ${listNames(a => a.is_reviewer, ' or ')}`;
    case 'approved': return `Approved by ${nameOf(d.second_approved_by || d.approved_by)} ${dWhen(d.second_approved_at || d.approved_at)} \u00b7 file it at the Capitol, then mark it filed`;
    case 'filed': return `Filed by ${nameOf(d.filed_by)} ${dWhen(d.filed_at)}`;
    case 'draft': return d.submitted_at ? 'Back to draft' : 'Write it in the Doc, then submit for review';
    default: return '';
  }
}
// Which buttons this user gets on this draft.
function draftActions(d) {
  const me = S.me || {};
  const mine = d.submitted_by && d.submitted_by === me.id;
  switch (d.status) {
    case 'draft': return [['submit', 'Submit for review', 'pri']];
    case 'review': return me.is_admin ? [['approve', 'Approve', 'pri'], ['changes', 'Request changes']]
      : mine ? [['withdraw', 'Withdraw']] : [];
    case 'second_review': return me.is_reviewer ? [['approve', 'Approve', 'pri'], ['changes', 'Request changes']]
      : mine ? [['withdraw', 'Withdraw']] : [];
    case 'approved': return [['filed', 'Mark filed', 'pri']];
    case 'filed': return [['unfile', 'Unmark filed']];
    default: return [];
  }
}
// The one button on a due card is whatever the draft needs next. It opens
// the bill, where the real buttons live - one workflow, not two.
function draftActionBtn(b, committee) {
  const d = draftFor(b.id, committee), me = S.me || {};
  const [label, cls] = !d ? ['No draft yet', 'ghost']
    : d.status === 'draft' ? ['Submit for review', '']
    : d.status === 'review' ? (me.is_admin ? ['Approve', ''] : ['In review', 'ghost'])
    : d.status === 'second_review' ? (me.is_reviewer ? ['Approve', ''] : ['Needs 2nd approval', 'ghost'])
    : d.status === 'approved' ? ['Mark filed', '']
    : d.status === 'filed' ? ['Filed ✓', 'ghost'] : ['Open draft', 'ghost'];
  return `<button class="btn sm ${cls}" data-openbill="${b.id}">${label}</button>`;
}
// One way to say how long is left: "in 40h" under two days, "in 3d" beyond.
const inWhen = iso => { const ms = new Date(iso) - Date.now(); if (ms <= 0) return 'passed';   // callers say "deadline passed"
  const h = Math.round(ms / 36e5); return h < 48 ? `in ${h}h` : `in ${Math.ceil(ms / 864e5)}d`; };
// A bill number is easy to forget; every home-page row carries the plain-language
// summary (public summary, else the official description, else the title).
const blurb = (b, n = 90) => { const t = (b.public_summary || b.description || b.title || '').replace(/\s+/g, ' ').trim();
  return t.length > n ? t.slice(0, n - 1).replace(/\s\S*$/, '') + '…' : t; };
const priCls = b => b.priority === 1 ? ' p3' : '';   // class name kept; P1 rows are double height
// Default order everywhere on the home page: priority first, then the closest deadline.
const byPri = (x, y) => (x.b.priority || 9) - (y.b.priority || 9);
// "HB 1563 HD1": the draft the bill is currently on rides along with the number.
const billNum = b => b.bill_number + (b.current_version ? ' ' + b.current_version : '');
const roomShort = r => (r || 'room TBD').replace(/\s*via videoconference/i, '').replace(/^Conference Room\s+/i, 'Rm ');
// Legislators' addresses follow one pattern: rep/sen + last name @capitol.hawaii.gov.
function chairMail(code) {
  const c = S.committees?.[String(code || '').split('/')[0]];
  if (!c?.chair) return null;
  const clean = c.chair.replace(/^(rep\.|sen\.|representative|senator)\s+/i, '').replace(/\s*(jr\.?|sr\.?|ii|iii|iv)$/i, '').trim();
  const last = clean.split(/\s+/).pop().toLowerCase().replace(/[^a-z]/g, '');
  return { name: c.chair, last: clean.split(/\s+/).pop(), title: c.chamber === 'S' ? 'Sen.' : 'Rep.', email: `${c.chamber === 'S' ? 'sen' : 'rep'}${last}@capitol.hawaii.gov` };
}
const attendees = h => (S.attend?.[h.id] || []).map(advocate).filter(Boolean);
const OUTCOME_LABEL = { passed: 'Passed', passed_amended: 'Passed with amendments', deferred: 'Deferred', recommitted: 'Recommitted' };
const OUTCOME_CLS = { passed: 'c-green', passed_amended: 'c-green', deferred: 'c-red', recommitted: 'c-gold' };
// Left-edge stripe by position: the same bill looks the same in every section.
const posCls = b => ({ strongly_support: 'pos-support', support: 'pos-support', support_amend: 'pos-support', strongly_oppose: 'pos-oppose', oppose: 'pos-oppose',
  neutral: 'pos-neutral', monitor: 'pos-monitor' }[b.position] || 'pos-none');
// Status priority for the one chip a Desk row can afford.
const DRAFT_RANK = { approved: 5, second_review: 4, review: 3, draft: 2, filed: 1 };
const unreadCount = b => (S.messages?.[b.id] || []).filter(m => m.advocate_id !== S.me?.id && (!S.chatSeen?.[b.id] || m.created_at > S.chatSeen[b.id])).length;
const chatChip = b => { const n = unreadCount(b); return n ? `<span class="chipx c-gold chatchip" title="${n} new message${n === 1 ? '' : 's'} in the chat">💬 ${n}</span>` : ''; };
function draftChip(b) { return draftChipBase(b) + chatChip(b); }
function draftChipBase(b) {
  const d = (S.drafts[b.id] || []).filter(x => x.status !== 'cancelled')
    .sort((x, y) => (DRAFT_RANK[y.status] || 0) - (DRAFT_RANK[x.status] || 0))[0];
  if (!d) return '';
  const label = d.status === 'filed' ? `Filed \u00b7 ${advocate(d.filed_by)?.initials || ''}`.trim()
    : d.status === 'approved' ? 'Approved, not filed' : DRAFT_LABEL[d.status];
  return `<span class="chipx dkdraft t-${DRAFT_TAG[d.status]}">${esc(label)}</span>`;
}
// Demo mode plays the same state machine locally so training can click through it.
function demoTransition(d, action, note, url) {
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
  else bad('Unknown action');
}
function draftFor(billId, committee) {
  return (S.drafts[billId] || []).find(d => d.committee === committee && d.status !== 'cancelled');
}
function draftsHTML(b) {
  const list = (S.drafts[b.id] || []).slice().sort((x, y) => String(y.created_at).localeCompare(String(x.created_at)));
  if (!list.length) return '';
  const ui = S.draftUI || {};
  return `<div class="sec">Testimony <span class="tag a">from hearing notices</span></div>
    <div class="drafts">${list.map(d => {
      const acts = d.status === 'cancelled' ? [] : draftActions(d);
      const form = ui.id === d.id ? (ui.mode === 'changes'
        ? `<div class="draftform"><input class="dfnote" placeholder="What should change?" aria-label="What should change">
             <button class="draftbtn pri" data-act="request_changes">Send</button><button class="draftbtn" data-act="cancelui">Cancel</button></div>`
        : `<div class="draftform"><input class="dfurl" placeholder="Capitol confirmation link (optional)" aria-label="Confirmation link">
             <button class="draftbtn pri" data-act="file">Filed</button><button class="draftbtn" data-act="cancelui">Cancel</button></div>`) : '';
      return `<div class="draftrow${d.status === 'cancelled' ? ' off' : ''}" data-draft="${esc(d.id)}">
      <span class="tag ${DRAFT_TAG[d.status] || 'a'}">${DRAFT_LABEL[d.status] || esc(d.status)}</span>
      <span class="draftc">${esc(d.committee)}</span>
      <a class="draftlink" href="${esc(d.doc_url)}" target="_blank" rel="noopener">Open draft \u2197</a>
      ${d.filed_url ? `<a class="draftlink" href="${esc(d.filed_url)}" target="_blank" rel="noopener">Confirmation \u2197</a>` : ''}
      ${d.status === 'approved' ? `<a class="draftlink" href="${esc(capitolUrl(b))}" target="_blank" rel="noopener">File at Capitol \u2197</a>` : ''}
      <span class="draftacts">${acts.map(([a, l, c]) => `<button class="draftbtn${c ? ' ' + c : ''}" data-act="${a}">${l}</button>`).join('')}</span>
      <span class="draftwho">${esc(draftWho(d))}</span>
      ${d.status === 'draft' && d.review_note ? `<span class="draftnote">Changes requested: ${esc(d.review_note)}</span>` : ''}
      ${form}
    </div>`; }).join('')}</div>`;
}

// Open items first, then finished ones. Overdue is called out in red, since a
// missed testimony deadline is the whole point of tracking these.
// ---------------- chat: the team talking inside the bill ----------------
function chatHTML(b) {
  const list = (S.messages[b.id] || []).slice().sort((x, y) => String(x.created_at).localeCompare(String(y.created_at)));
  const unread = unreadCount(b);
  const open = S.drawerOpen.chat || list.length;
  if (!open) return `<button class="todoline" id="d-chatopen">💬 Message the team about this bill</button>`;
  const when = iso => { const d = new Date(iso), ms = Date.now() - d; return ms < 36e5 ? `${Math.max(1, Math.round(ms / 6e4))}m ago` : ms < 864e5 ? fmtDT(iso).replace(/^.*?, /, '') : fmtDT(iso); };
  const shown = S.drawerOpen.chatAll ? list : list.slice(-12);
  const linkBills = t => esc(t).replace(/\b([HS]B ?\d{1,4})\b/g, (m, n) => `<a data-jumpbill="${n.replace(/\s/g, '')}">${m}</a>`);
  const row = m => { const a = advocate(m.advocate_id), mine = m.advocate_id === S.me?.id, fresh = !mine && (!S.chatSeen[b.id] || m.created_at > S.chatSeen[b.id]); return `
    <div class="msg ${mine ? 'mine' : ''} ${fresh ? 'fresh' : ''}" data-msg="${esc(m.id)}">
      ${a ? av(a, 'avatar sm') : '<span class="avatar sm">?</span>'}
      <div class="msgb"><div class="msgh"><b>${esc(a?.full_name || 'Someone')}</b><span class="msgt">${when(m.created_at)}</span>${mine || S.me?.is_admin ? `<button class="msgdel" data-msgdel="${esc(m.id)}" title="Delete">✕</button>` : ''}</div>
        <div class="msgtext">${linkBills(m.body).replace(/\n/g, '<br>')}</div></div>
    </div>`; };
  return `<div class="sec">Chat${unread ? ` <span class="tag t">${unread} new</span>` : ''}${list.length ? ` <span class="tok">· owners, followers and anyone @mentioned get a Slack DM</span>` : ''}</div>
    <div class="chat" id="d-chat">
      ${list.length > shown.length ? `<button class="morelink" id="d-chatall">earlier messages (${list.length - shown.length})</button>` : ''}
      ${shown.map(row).join('') || '<div class="msgempty">No messages yet. Say something — the owners get a DM.</div>'}
      <div class="chatadd"><textarea id="d-chatnew" rows="1" placeholder="Message the team… (@Kevin to mention, Enter to send)" maxlength="4000"></textarea><button class="btn sm" id="d-chatsend">Send</button></div>
    </div>`;
}
function todosHTML(b) {
  const list = (S.todos[b.id] || []).slice().sort((x, y) =>
    (x.done - y.done) || (x.sort_order - y.sort_order) ||
    String(x.created_at).localeCompare(String(y.created_at)));
  const today = new Date().toISOString().slice(0, 10);
  const rows = list.map(t => {
    const over = !t.done && t.due_date && t.due_date < today;
    return `<div class="todorow" data-todo="${esc(t.id)}">
      <input type="checkbox" class="tdchk" ${t.done ? 'checked' : ''} aria-label="Mark done">
      <span class="tdtitle${t.done ? ' done' : ''}">${esc(t.title)}</span>
      <span class="tdmeta">
        <input type="date" class="tddue${over ? ' over' : ''}" value="${esc(t.due_date || '')}"
          title="${over ? 'Overdue' : 'Due date'}" aria-label="Due date">
        <select class="tdown" aria-label="Owner"><option value="">Anyone</option>
          ${S.advocates.map(a => `<option value="${a.id}" ${t.assignee_id === a.id ? 'selected' : ''}>${esc(a.full_name)}</option>`).join('')}</select>
      </span>
      <button class="tddel" title="Remove this task" aria-label="Remove task">\u2715</button>
    </div>`;
  }).join('');
  const open = list.filter(t => !t.done).length;
  // No tasks and not adding one: a single line, not an empty section.
  if (!list.length && !S.drawerOpen.todo)
    return `<button class="todoline" id="d-todoplus">+ Add a task</button>`;
  return `<div class="sec">To do${open ? ` <span class="tag a">${open} open</span>` : ''}</div>
    <div class="todos">${rows}
      <div class="todoadd">
        <input id="d-tdnew" placeholder="Add a task\u2026" maxlength="200">
        <button class="btn sm" id="d-tdadd">Add</button>
      </div></div>`;
}

// The stage calendar: the Desk rail's nine steps with their labels, plus
// one plain sentence - cleared / now / next - so a phone reader does not
// have to decode dots.
function stageCalHTML(b) {
  const dead = diedish(b);
  const DK_RAIL_STAGES = railFor(b); const idx = railIdx(b, DK_RAIL_STAGES);
  const lab = s => STAGE_LABEL[s] || s;
  const steps = DK_RAIL_STAGES.map((s, i) => {
    const k = i < idx ? 'done' : i === idx ? (dead ? 'dead' : 'now') : 'todo';
    return `<span class="stp ${k}" title="${esc(lab(s))}"><i></i><b>${esc(lab(s))}</b></span>`;
  }).join('');
  const cleared = DK_RAIL_STAGES.slice(0, idx).map(lab);
  const line = dead
    ? `Stopped at ${lab(DK_RAIL_STAGES[idx])}.`
    : `${cleared.length ? 'Cleared ' + cleared.slice(-2).join(', ') + ' · ' : ''}Now ${lab(DK_RAIL_STAGES[idx])}`;
  return `<div class="stagecal">${steps}</div><div class="stageline">${esc(line)}</div>`;
}
// The next stage after the current one, for the Next block when no hearing
// is on the books.
function nextStageLabel(b) {
  if (diedish(b)) return null;
  const rail = railFor(b), idx = railIdx(b, rail);
  const s = rail[idx + 1];
  return s ? (STAGE_LABEL[s] || s) : null;
}

// The next thing on this bill's calendar: its soonest scheduled hearing,
// with the committee's full name and chair when the committees table has
// them, the room, the testimony deadline, and the draft if one exists.
function nextHTML(b) {
  const now = Date.now();
  const h = S.hearings.filter(x => x.bill_id === b.id && x.status !== 'cancelled' && new Date(x.scheduled_at) > now)
    .sort((x, y) => new Date(x.scheduled_at) - new Date(y.scheduled_at))[0];
  if (!h) {
    const ns = nextStageLabel(b);
    return `<div class="next"><div class="nextk">Next</div><div class="nextv">
      <b>${ns ? esc(ns) : 'No further steps'}</b>${ns ? ' - no hearing scheduled yet' : ''}
      </div></div>`;
  }
  const c = S.committees[h.committee];
  const dr = draftFor(b.id, h.committee);
  const due = h.testimony_deadline ? fmtDT(h.testimony_deadline) : null;
  return `<div class="next">
    <div class="nextk">Next</div>
    <div class="nextv">
      <b>${esc(c ? c.name : h.committee)}</b>${c ? ` <span class="code">${esc(h.committee)}</span>` : ''} hearing
      <div class="nextline">${fmtDT(h.scheduled_at)}${h.room ? ` · ${esc(h.room)}` : ''}</div>
      ${c && c.chair ? `<div class="nextline">Chair ${esc(c.chair)}${c.vice_chair ? ` · Vice Chair ${esc(c.vice_chair)}` : ''}</div>` : ''}
      ${due ? `<div class="nextline due">Testimony due ${due}</div>` : ''}
      ${dr ? `<div class="nextline"><a class="draftlink" href="${esc(dr.doc_url)}" target="_blank" rel="noopener">${dr.status === 'filed' ? 'Testimony filed' : dr.status === 'approved' ? 'Testimony approved, file it' : dr.status === 'review' || dr.status === 'second_review' ? 'Testimony in review' : 'Open testimony draft'} ↗</a></div>` : ''}
    </div></div>`;
}

function drawerHTML(b) {
  // Four blocks and a tab row. Header: the one-second facts. Next: the
  // hearing, the deadline, and the testimony step with its button. Summary.
  // Tasks. Then Timeline · Details · Team · Public · Notes as tabs.
  if (S.drawerOpen.bill !== b.id)
    S.drawerOpen = { bill: b.id, tab: 'details', more: false, log: false, tlAll: false, todo: false };
  const open = S.drawerOpen;
  const now = Date.now();
  const owner = owners(b)[0];
  const coalitions = (S.billCampaigns[b.id] || []).map(id => S.campaigns.find(c => c.id === id)?.name).filter(Boolean);
  const notesHead = (b.internal_notes || '').trim().split('\n')[0].slice(0, 70);
  const text = b.public_summary || b.description || '';
  const dead = diedish(b), st = effStage(b);
  const chips = [
    b.position ? `<span class="chipx ${POS_CLS[b.position] || 'c-gray'}">${esc(POSITIONS.find(p => p[0] === b.position)?.[1] || b.position)}</span>` : '<span class="chipx c-gray">no position</span>',
    b.priority ? `<span class="chipx c-gray">P${b.priority}</span>` : '',
    owner ? `<span class="chipx c-gray who">${av(owner, 'avatar sm')}${esc(owner.full_name)}</span>` : '<span class="chipx c-gray">no owner</span>',
    ...coalitions.map(c => `<span class="chipx c-navy">${esc(c)}</span>`),
    `<span class="chipx ${dead ? 'c-gray' : st === 'enacted' ? 'c-green' : 'c-teal'}">${STAGE_LABEL[st]}${b.stage_override ? ' · override' : ''}</span>`,
    b.current_version ? `<span class="chipx c-navy" title="The draft the bill is currently on">${esc(b.current_version)}</span>` : '',
    `<button class="chipx tool ${S.follows?.has(b.id) ? 'on' : ''}" data-follow="${b.id}">${S.follows?.has(b.id) ? '★ Following' : '☆ Follow'}</button>`,
    `<button class="chipx tool" data-copylink="${esc(b.bill_number)}" title="Copy a link to this bill">🔗 Copy link</button>`,
  ].filter(Boolean).join('');

  // ---- Next: hearings ahead, each with its testimony row ----
  const ups = S.hearings.filter(x => x.bill_id === b.id && x.status !== 'cancelled' && new Date(x.scheduled_at) > now)
    .sort((x, y) => new Date(x.scheduled_at) - new Date(y.scheduled_at));
  const draftRow = d => {
    const acts = d.status === 'cancelled' ? [] : draftActions(d);
    const ui = S.draftUI || {};
    const form = ui.id === d.id ? (ui.mode === 'changes'
      ? `<div class="draftform"><input class="dfnote" placeholder="What should change?" aria-label="What should change"><button class="draftbtn pri" data-act="request_changes">Send</button><button class="draftbtn" data-act="cancelui">Cancel</button></div>`
      : `<div class="draftform"><input class="dfurl" placeholder="Capitol confirmation link (optional)" aria-label="Confirmation link"><button class="draftbtn pri" data-act="file">Filed</button><button class="draftbtn" data-act="cancelui">Cancel</button></div>`) : '';
    return `<div class="draftrow nx" data-draft="${esc(d.id)}">
      <span class="tag ${DRAFT_TAG[d.status] || 'a'}">${DRAFT_LABEL[d.status] || esc(d.status)}</span>
      <span class="draftwho">${esc(draftWho(d))}${d.version || b.current_version ? ` · written for ${esc(d.version || 'the introduced bill')}` : ''}${d.version !== (b.current_version || null) && b.current_version && d.status !== 'filed' ? ` <span class="hot">— bill is now ${esc(b.current_version)}, check the draft</span>` : ''}</span>
      <span class="draftacts">${acts.map(([a, l, c]) => `<button class="draftbtn${c ? ' ' + c : ''}" data-act="${a}">${l}</button>`).join('')}</span>
      <span class="dlinks"><a class="draftlink" href="${esc(d.doc_url)}" target="_blank" rel="noopener">Google Doc ↗</a>
        ${d.status === 'approved' ? `<a class="draftlink" href="${esc(capitolUrl(b))}" target="_blank" rel="noopener">File at Capitol ↗</a>` : ''}
        ${d.filed_url ? `<a class="draftlink" href="${esc(d.filed_url)}" target="_blank" rel="noopener">Confirmation ↗</a>` : ''}</span>
      ${d.status === 'draft' && d.review_note ? `<span class="draftnote">Changes requested: ${esc(d.review_note)}</span>` : ''}
      ${form}
    </div>`; };
  const seen = new Set();
  let nextHtml = '';
  if (dead) {
    nextHtml = `<div class="next"><div class="nextk">Next</div><div class="nextv"><b>${b.died_deadline ? `Died — missed ${esc(b.died_deadline)}${b.died_at_stage ? ' at ' + (STAGE_LABEL[b.died_at_stage] || b.died_at_stage) : ''}` : st === 'vetoed' ? 'Vetoed' : 'Died'}</b>
      <div class="nextline">${esc(b.last_action || '')} ${b.last_action_date ? `<span class="when">${fmtDate(b.last_action_date, { year: '2-digit' })}</span>` : ''}</div></div></div>`;
  } else if (st === 'enacted' || st === 'governor') {
    nextHtml = `<div class="next"><div class="nextk">Next</div><div class="nextv"><b>${st === 'enacted' ? 'Signed into law' : 'With the Governor'}</b>
      <div class="nextline">${esc(b.last_action || '')} ${b.last_action_date ? `<span class="when">${fmtDate(b.last_action_date, { year: '2-digit' })}</span>` : ''}</div></div></div>`;
  } else if (ups.length) {
    nextHtml = ups.map(h => { const c = S.committees[h.committee]; const dr = draftFor(b.id, h.committee); if (dr) seen.add(dr.id);
      const dueSoon = h.testimony_deadline && new Date(h.testimony_deadline) - now < 48 * 3600e3 && new Date(h.testimony_deadline) > now;
      const duePast = h.testimony_deadline && inWhen(h.testimony_deadline) === 'passed';
      const att = attendees(h), meIn = att.some(a => a.id === S.me?.id), m = chairMail(h.committee);
      const room = (h.room || '').replace(/\s*via videoconference/i, '').replace(/^Conference Room\s+/i, 'Rm ');
      const row = (l, v, cls = '') => `<div class="nr ${cls}"><span class="nl">${l}</span><span class="nv">${v}</span></div>`;
      return `<div class="next v3">
        <div class="nexthead"><span class="nextk">Next</span><b>${esc(c ? c.name : h.committee)}</b>${c ? `<span class="code">${esc(h.committee)}</span>` : ''}<span class="muted">hearing</span></div>
        <div class="nextgrid">
          ${row('When', `${fmtDT(h.scheduled_at)}${room ? ` · ${esc(room)}` : ''}`)}
          ${c && c.chair ? row('Chair', `${m ? `<a class="chairmail" href="mailto:${esc(m.email)}" title="${esc(m.email)}">${esc(c.chair)}</a>` : esc(c.chair)}${c.vice_chair ? `<span class="muted"> · Vice Chair ${esc(c.vice_chair)}</span>` : ''}`) : ''}
          ${row('Attending', `${att.length ? att.map(a => esc(a.full_name)).join(', ') : '<span class="muted">no one yet</span>'}<button class="draftbtn ${meIn ? '' : 'pri'}" data-attend="${h.id}">${meIn ? 'Not attending' : 'I\u2019m attending'}</button>`)}
          ${h.testimony_deadline ? row('Testimony', duePast ? `due ${fmtDT(h.testimony_deadline)} <span class="muted">· passed</span>` : `due ${fmtDT(h.testimony_deadline)} · <b${dueSoon ? ' class="hot"' : ''}>${inWhen(h.testimony_deadline)}</b>`, dueSoon ? 'due' : '') : ''}
        </div>
        ${dr ? draftRow(dr) : `<div class="nextline muted">No testimony draft yet${b.position && b.position !== 'monitor' ? ' — it is created automatically from the notice' : ' — Monitor bills get no draft'}</div>`}
      </div>`; }).join('');
  } else {
    const stp = stopOf(b); const dl = stp.deadline && !stp.deadline.missed ? stp.deadline : null;
    const sl = dl && stp.phase === 'committee' && stp.committee ? lastSlotBefore(stp.committee, dl.date, S.slots) : null;
    nextHtml = `<div class="next"><div class="nextk">Next</div><div class="nextv"><b>${esc(stp.says)}</b>
      ${stp.phase === 'committee' && stp.committee ? `<div class="nextline">${CHAMBER_NAME[stp.chamber]} · <b>${esc(stp.committee)}</b>${chairOf(stp.committee)}${stp.stops ? ` · stop ${stp.stop} of ${stp.stops}` : ''}${dl ? ` · hearing needed before <b>${esc(dl.label)}</b> ${fmtDate(dl.date)} (${dl.days}d)` : ''}</div>` : ''}
      ${sl ? `<div class="nextline ${now > sl.noticeBy ? 'hot' : ''}">${now > sl.noticeBy ? 'Notice window for the last regular slot has closed — call the chair' : `Last regular slot ${fmtDT(sl.at)} · notice by ${fmtDT(sl.noticeBy)}`}</div>` : ''}
    </div></div>`;
  }
  const otherDrafts = (S.drafts[b.id] || []).filter(d => !seen.has(d.id) && d.status !== 'cancelled');
  const primary = (() => { const d = ups.map(h => draftFor(b.id, h.committee)).find(Boolean); if (!d) return null; const a = draftActions(d)[0]; return a ? { id: d.id, act: a[0], label: a[1] } : null; })();
  const summary = text ? `<p class="desc${open.more ? '' : ' clamp'}" id="d-desc">${esc(text)}</p>${text.length > 220 ? `<button class="morelink" id="d-more">${open.more ? 'less' : 'more'}</button>` : ''}` : '<p class="desc"><i>No summary yet.</i></p>';
  const tab = (k, l) => `<button class="dtab ${open.tab === k ? 'on' : ''}" data-dtab="${k}">${l}</button>`;
  const pane = (k, inner) => `<div class="dpane" data-pane="${k}" ${open.tab === k ? '' : 'hidden'}>${inner}</div>`;
  return `<div class="scrim" id="scrim"></div>
  <div class="drawer v2">
    <div class="dhead">
      <button class="close" id="dclose">✕</button>
      <h2>${esc(b.bill_number.replace(/^(\D+)/,'$1 '))}</h2>
      <div class="sub">${esc(b.title||'')}</div>
      <div class="dchips">${chips}</div>
      ${primary ? `<button class="btn sm dprimary" data-primary="${esc(primary.id)}" data-primaryact="${primary.act}">${primary.label}</button>` : ''}
    </div>
    <div class="dbody">
      ${stageCalHTML(b)}
      ${b.last_action ? `<div class="lastact"><span class="lal">Last action</span> ${b.last_action_date ? `<span class="when">${fmtDate(b.last_action_date, { year: '2-digit' })}</span> · ` : ''}${esc(b.last_action)}</div>` : ''}
      ${nextHtml}
      ${otherDrafts.length ? `<div class="drafts other">${otherDrafts.map(draftRow).join('')}</div>` : ''}
      ${(past => past.length ? `<div class="pastheard">${past.map(h => { const o = S.outcomes?.[h.id]; return `<div class="nextline"><b>${esc(h.committee)}</b> heard ${fmtDT(h.scheduled_at)} · ${o?.outcome ? `<span class="chipx ${OUTCOME_CLS[o.outcome] || 'c-gray'}">${OUTCOME_LABEL[o.outcome] || o.outcome}</span>` : '<span class="chipx c-gray">no report yet</span>'}${o?.report ? ` <span class="muted">${esc(o.report.slice(0, 90))}</span>` : ''}</div>`; }).join('')}</div>` : '')(S.hearings.filter(x => x.bill_id === b.id && x.status !== 'cancelled' && new Date(x.scheduled_at) <= now && new Date(x.scheduled_at) > now - 14 * 864e5).sort((x, y) => y.scheduled_at.localeCompare(x.scheduled_at)))}
      <div class="sec">Summary</div>
      ${summary}
      ${todosHTML(b)}
      ${chatHTML(b)}
      <div class="dtabs">${tab('details', 'Details')}${tab('team', 'Team')}${tab('public', 'Public')}${tab('notes', 'Notes' + (notesHead ? ' •' : ''))}${tab('timeline', 'Timeline')}</div>
      ${pane('timeline', `
        ${open.log ? `<div class="logform">
          <div class="typechips">${LOG_TYPES.map(([v,l]) => `<button data-lt="${v}" class="${S.logType===v?'on':''}">${l}</button>`).join('')}</div>
          <input id="d-ltitle" placeholder="${S.logType==='testimony'?'e.g. Testimony submitted — Support (written + oral)':'What happened?'}">
          <textarea id="d-ldetails" placeholder="Details (optional)"></textarea>
          <button class="btn sm" id="d-log">Add to timeline</button> <button class="draftbtn" id="d-logclose">Cancel</button>
        </div>` : `<button class="morelink" id="d-logopen">+ Add a note or log an action</button>`}
        <div id="tlmount" style="min-height:40px;color:var(--muted);font-size:12.5px">Loading…</div>`)}
      ${pane('details', `<div class="kv">
          <span class="k">Committee</span><span>${(st => st.committee ? `${esc(st.committee)}${chairOf(st.committee)} · ${CHAMBER_NAME[st.chamber]}${st.stops ? `, stop ${st.stop} of ${st.stops}` : ''}` : st.phase === 'committee' ? `awaiting referral in the ${CHAMBER_NAME[st.chamber]}` : esc(st.says))(stopOf(b))}</span>
          <span class="k">Referrals</span><span>${referralPath(b)}</span>
          ${(b.sponsors||[]).length ? `<span class="k">Sponsors</span><span title="${esc((b.sponsors||[]).map(s=>s.n).join(', '))}">${sponsorText(b)}</span>` : ''}
          ${(b.companions||[]).length ? `<span class="k">Companion</span><span class="complist" id="compmount">${(b.companions||[]).map(esc).join(', ')}</span>` : ''}
          ${b.public_summary && b.description ? `<span class="k">Official description</span><span>${esc(b.description)}</span>` : ''}
          <span class="k">Last action</span><span>${esc(b.last_action||'—')} ${b.last_action_date ? `<span class="when">${fmtDate(b.last_action_date,{year:'2-digit'})}</span>` : ''}</span>
          <span class="k">Source</span><span><a href="${esc(capitolUrl(b))}" target="_blank" rel="noopener">capitol.hawaii.gov ↗</a></span>
        </div>`)}
      ${pane('team', `<div class="teamgrid">
          <div><label>Position</label><select id="d-pos">${POSITIONS.map(([v,l])=>`<option value="${v}" ${(b.position||'')===v?'selected':''}>${l}</option>`).join('')}</select></div>
          <div><label>Priority</label><select id="d-pri"><option value="">—</option>${[1,2,3].map(p=>`<option ${b.priority===p?'selected':''}>${p}</option>`).join('')}</select></div>
          <div><label>Owner</label><select id="d-own"><option value="">—</option>${S.advocates.map(a=>`<option value="${a.id}" ${(S.assignments[b.id]||[])[0]===a.id?'selected':''}>${esc(a.full_name)}</option>`).join('')}</select></div>
          <div><label>Stage override</label><select id="d-so"><option value="">Auto</option>${STAGES.map(([v,l])=>`<option value="${v}" ${b.stage_override===v?'selected':''}>${l}</option>`).join('')}</select></div>
        </div>
        <label class="lbl">Coalitions</label>
        <div class="typechips">${S.campaigns.length
          ? S.campaigns.map(c => { const on = (S.billCampaigns[b.id] || []).includes(c.id);
              return `<button data-campt="${c.id}" class="${on ? 'on' : ''}" aria-pressed="${on}" title="${on ? 'Remove from' : 'Add to'} ${esc(c.name)}">${on ? '✓ ' : '+ '}${esc(c.name)}</button>`; }).join('')
          : '<span style="font-size:12px;color:var(--muted)">No coalitions set up yet — an admin can add them.</span>'}</div>`)}
      ${pane('public', `<div class="pubnote${pubStateCls(b).includes('warn') ? ' warn' : ''}">${esc(pubStateText(b))}</div>
        <div class="pubgrid">
          <label for="d-psum">Plain-language summary</label>
          <textarea id="d-psum" maxlength="280" placeholder="One sentence a neighbour would understand. No jargon, no bill numbers.">${esc(b.public_summary || '')}</textarea>
          <label for="d-pact">Take Action ask</label>
          <textarea id="d-pact" maxlength="280" placeholder="What should someone do today? Left blank, the hearing itself is the ask.">${esc(b.public_action || '')}</textarea>
          <div class="pubrow">
            <span><label for="d-puntil">Ask expires</label><input type="date" id="d-puntil" value="${esc(b.public_action_until || '')}"></span>
            <label class="pubchk"><input type="checkbox" id="d-ispub" ${b.is_public ? 'checked' : ''}> Show on public page</label>
          </div>
          <button class="btn sm" id="d-savepub">Save public copy</button>
        </div>`)}
      ${pane('notes', `<div class="notes"><textarea id="d-notes" placeholder="Never public. Context for the team.">${esc(b.internal_notes||'')}</textarea>
          <button class="btn sm" id="d-savenotes" style="margin-top:6px">Save notes</button></div>`)}
    </div>
  </div>`;
}

// ---------------- login ----------------
function renderLogin() {
  $('#app').innerHTML = `<div class="loginwrap"><div class="loginbox">
    <div class="logo"><span class="mark" style="width:26px;height:26px;border-radius:8px;background:linear-gradient(135deg,#12A0AC,#0E7C86);display:inline-flex;align-items:center;justify-content:center">☀</span>
      HIPHI Bill Tracker</div>
    <p>Hawai'i Public Health Institute · staff sign in</p>
    <label>Email</label><input id="l-email" type="email" autocomplete="username">
    <label>Password</label><input id="l-pass" type="password" autocomplete="current-password">
    <button class="btn" id="l-go">Sign in</button>
    <div class="loginerr" id="l-err"></div>
    <button class="loginlink" id="l-forgot">Forgot password?</button>
    <div class="loginnote" id="l-note"></div>
  </div></div>`;
  const go = async () => {
    $('#l-err').textContent = '';
    try { await DB.login($('#l-email').value.trim(), $('#l-pass').value); }
    catch (e) { $('#l-err').textContent = e.message || 'Sign-in failed'; }
  };
  $('#l-go').onclick = go;
  $('#l-pass').addEventListener('keydown', e => e.key === 'Enter' && go());
  if (LINK_ERR) $('#l-err').textContent = LINK_ERR + ' - each link works only once. Request a new one.';
  $('#l-forgot').onclick = async () => {
    const email = $('#l-email').value.trim();
    $('#l-err').textContent = '';
    if (!email) { $('#l-err').textContent = 'Enter your email address first.'; return; }
    const btn = $('#l-forgot');
    btn.disabled = true; btn.textContent = 'Sending...';
    try {
      await DB.sendRecovery(email);
      // Reported the same way whether or not the address has an account, so this
      // cannot be used to enumerate staff emails.
      btn.textContent = 'Check your email';
      $('#l-note').textContent = 'If ' + email + ' has an account, a reset link is on its way. '
        + 'It works once - open it in this browser, and do not click it twice.';
    } catch (err) {
      btn.disabled = false; btn.textContent = 'Forgot password?';
      $('#l-err').textContent = err.message || 'Could not send the reset email.';
    }
  };
}

// Arrived from a reset link: the link already established a session, so the only
// thing left is choosing a new password.
function renderRecovery() {
  $('#app').innerHTML = `<div class="loginwrap"><div class="loginbox">
    <div class="logo"><span class="mark" style="width:26px;height:26px;border-radius:8px;background:linear-gradient(135deg,#12A0AC,#0E7C86);display:inline-flex;align-items:center;justify-content:center">\u2600</span>
      HIPHI Bill Tracker</div>
    <p>Choose a new password</p>
    <label>New password</label><input id="r-pass" type="password" autocomplete="new-password">
    <label>Confirm password</label><input id="r-pass2" type="password" autocomplete="new-password">
    <button class="btn" id="r-go">Save password</button>
    <div class="loginerr" id="r-err"></div>
  </div></div>`;
  const go = async () => {
    const a = $('#r-pass').value, b = $('#r-pass2').value;
    $('#r-err').textContent = '';
    if (a.length < 8) { $('#r-err').textContent = 'Use at least 8 characters.'; return; }
    if (a !== b) { $('#r-err').textContent = 'Those two passwords do not match.'; return; }
    const btn = $('#r-go');
    btn.disabled = true; btn.textContent = 'Saving...';
    try {
      await DB.setPassword(a);
      RECOVERY = false;
      history.replaceState(null, '', APP_URL);   // drop the recovery hash
      toast('Password updated');
      boot();
    } catch (err) {
      btn.disabled = false; btn.textContent = 'Save password';
      $('#r-err').textContent = err.message || 'Could not save the password.';
    }
  };
  $('#r-go').onclick = go;
  $('#r-pass2').addEventListener('keydown', e => e.key === 'Enter' && go());
}

// ---------------- render + events ----------------
function render() {
  if (isMobile() && S.view === 'table') S.view = 'portfolio';
  const list = visibleBills();
  const body = S.view === 'portfolio' ? renderPortfolio(list)
    : S.view === 'pipeline' ? renderPipeline(list)
    : S.view === 'desk' ? renderDesk(list)
    : S.view === 'cards' ? renderCards(list)
    : S.view === 'settings' ? renderSettings()
    : S.view === 'triage' ? renderTriage()
    : S.view === 'help' ? renderHelp()
    : S.view === 'add' ? renderAdd() : renderTable(list);
  const b = S.bills.find(x => x.id === S.drawerBill);
  $('#app').innerHTML = chrome(body) + (b ? drawerHTML(b) : '');
  wire();
  if (b) DB.timeline(b.id).then(tl => { const el = $('#tlmount'); if (!el) return; el.innerHTML = timelineHTML(tl);
      const m = $('#d-tlmore'); if (m) m.onclick = () => { S.drawerOpen.tlAll = true; el.innerHTML = timelineHTML(tl); }; })
    .catch(()=>{});
}
function wire() {
  if (S.view === 'triage') wireTriage();
  document.querySelectorAll('.srow [data-attend], .todaystrip [data-attend]').forEach(el => el.onclick = async e => { e.stopPropagation();
    const on = !(S.attend?.[el.dataset.attend] || []).includes(S.me?.id);
    try { await DB.attend(el.dataset.attend, on); toast(on ? 'Marked as attending' : 'No longer attending'); rerenderKeep(); } catch (e) { toast(e.message, true); } });
  document.querySelectorAll('[data-view]').forEach(el => el.onclick = () => {
    S.view = el.dataset.view; localStorage.setItem('view', S.view); S.drawerBill = null; render();
    if (S.view === 'add') $('#addq')?.focus();
  });
  $('#logout') && ($('#logout').onclick = () => DB.logout());
  $('#logout2') && ($('#logout2').onclick = () => DB.logout());
  document.querySelectorAll('[data-week]').forEach(el => el.onclick = e => {
    e.stopPropagation(); e.preventDefault(); const v = Number(el.dataset.week); S.weekOffset = v === 0 ? 0 : (S.weekOffset || 0) + v;
    rerenderKeep(isMobile() ? '#fold-week' : null, isMobile() ? 'fold-week' : 'pf-week');
  });
  document.querySelectorAll('details.fold').forEach(d => d.ontoggle = () => { S.folds = S.folds || {}; S.folds[d.id.replace('fold-', '')] = d.open; });
  document.querySelectorAll('[data-boardmore]').forEach(el => el.onclick = e => {
    e.stopPropagation(); S.boardMore = S.boardMore || {}; const k = el.dataset.boardmore;
    S.boardMore[k] = !S.boardMore[k]; rerenderKeep(isMobile() ? '#fold-board' : null, 'pf-board-' + k);
  });
  document.querySelectorAll('[data-browse]').forEach(el => el.onclick = () => { S.q = ''; S.camps = new Set([el.dataset.browse]); S.owner = 'all'; render(); });
  document.querySelectorAll('[data-jump]').forEach(el => el.onclick = () =>
    document.getElementById(el.dataset.jump)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  // Portfolio search reaches every bill: the untracked half comes from the
  // database, debounced, and the page re-renders when it lands.
  if (S.view === 'portfolio') {
    const q = S.q.trim();
    if (q.length >= 3 && S.searchAll?.q !== q) {
      S.searchAll = { q, rows: null };
      clearTimeout(S.searchTimer);
      S.searchTimer = setTimeout(async () => {
        try {
          const rows = await DB.searchUntracked(q);
          if (S.q.trim() === q) { S.searchAll = { q, rows }; rerenderBody(); }
        } catch (e) { toast(e.message, true); }
      }, 350);
    }
    document.querySelectorAll('[data-track]').forEach(btn => btn.onclick = async e => {
      e.stopPropagation();
      const r = (S.searchAll?.rows || []).find(x => x.id === btn.dataset.track); if (!r) return;
      btn.disabled = true;
      try { await DB.track(r); toast(r.bill_number + ' is now tracked — set position and owner'); S.searchAll.rows = S.searchAll.rows.filter(x => x.id !== r.id); openDrawer(r.id); }
      catch (err) { btn.disabled = false; toast(err.message, true); }
    });
  }
  $('#ftoggle') && ($('#ftoggle').onclick = () => { S.filtersOpen = !S.filtersOpen; render(); if (S.filtersOpen) $('#q')?.focus(); });
  document.querySelectorAll('[data-openbill]').forEach(el => el.onclick = e => {
    e.stopPropagation(); openDrawer(el.dataset.openbill);
  });
  document.querySelectorAll('.qbox').forEach(el => el.oninput = e => { S.q = e.target.value; S.qFocus = el.classList.contains('topq') ? 'topq' : 'rowq'; rerenderBody(); });
  document.querySelectorAll('[data-owner]').forEach(el =>
    el.onclick = () => { S.owner = el.dataset.owner; render(); });
  document.querySelectorAll('[data-prif]').forEach(el => el.onchange = () => { const p = Number(el.dataset.prif); el.checked ? S.pris.add(p) : S.pris.delete(p); rerenderKeep('.pillmenu.filt'); });
  $('#stagef') && ($('#stagef').onchange = e => { S.stageF = e.target.value; rerenderKeep('.pillmenu.filt'); });
  $('#triplef') && ($('#triplef').onchange = () => { S.tripleF = $('#triplef').checked; rerenderKeep('.pillmenu.filt'); });
  document.querySelectorAll('[data-campf]').forEach(el => el.onchange = () => { const id = el.dataset.campf; el.checked ? S.camps.add(id) : S.camps.delete(id); rerenderKeep('.pillmenu.filt'); });
  $('#clearf') && ($('#clearf').onclick = () => { S.pris = new Set(); S.camps = new Set(); S.tripleF = false; S.stageF = ''; render(); });
  $('#clearf2') && ($('#clearf2').onclick = () => { S.pris = new Set(); S.camps = new Set(); S.tripleF = false; S.stageF = ''; render(); });
  document.querySelectorAll('.pillmenu').forEach(d => d.addEventListener('toggle', () => { if (d.open) document.querySelectorAll('.pillmenu').forEach(o => { if (o !== d) o.open = false; }); }));
  document.addEventListener('click', e => { if (!e.target.closest('.pillmenu')) document.querySelectorAll('.pillmenu[open]').forEach(d => d.open = false); }, { once: true });
  $('#csv') && ($('#csv').onclick = exportCSV);
  $('#dk-out') && ($('#dk-out').onclick = () => { S.deskOut = !S.deskOut; render(); });
  document.querySelectorAll('[data-camp]').forEach(el =>
    el.onclick = () => { S.camp = el.dataset.camp; render(); });
  document.querySelectorAll('th[data-sort]').forEach(th => th.onclick = () => {
    const k = th.dataset.sort; if (!k) return;
    S.sort = S.sort[0] === k ? [k, -S.sort[1]] : [k, 1]; render();
  });
  document.querySelectorAll('tr[data-bill],.card[data-bill],.pv-card[data-bill],.prow[data-bill],.dk-tile[data-bill],.chip3[data-bill],.tlrow[data-bill]').forEach(el =>
    el.onclick = e => { if (e.target.closest('select,input,a,button')) return; openDrawer(el.dataset.bill); });
  $('#selall') && ($('#selall').onchange = e => {
    const vis = visibleBills().map(b => b.id);
    vis.forEach(id => e.target.checked ? S.selected.add(id) : S.selected.delete(id));
    render();
  });
  document.querySelectorAll('[data-selb]').forEach(el => {
    el.onclick = e => e.stopPropagation();
    el.onchange = () => { el.checked ? S.selected.add(el.dataset.selb) : S.selected.delete(el.dataset.selb); render(); };
  });
  const bulkGo = async (fn, msg) => { try { await fn(); toast(msg); render(); } catch (e) { toast(e.message, true); } };
  $('#bk-pos') && ($('#bk-pos').onchange = e => { const v = e.target.value; if (v)
    bulkGo(() => DB.bulkUpdate([...S.selected], { position: v }), `Position set on ${S.selected.size} bills`); });
  $('#bk-pri') && ($('#bk-pri').onchange = e => { const v = e.target.value; if (v)
    bulkGo(() => DB.bulkUpdate([...S.selected], { priority: +v }), `Priority set on ${S.selected.size} bills`); });
  $('#bk-own') && ($('#bk-own').onchange = e => { const v = e.target.value; if (v)
    bulkGo(async () => { for (const id of S.selected) await DB.setOwner(id, v === '__none' ? null : v); },
      v === '__none' ? `Unassigned ${S.selected.size} bills` : `Owner set on ${S.selected.size} bills`); });
  $('#bk-camp') && ($('#bk-camp').onchange = e => { const v = e.target.value; if (v)
    bulkGo(() => DB.addToCampaign([...S.selected], v), `Added ${S.selected.size} bills to coalition`); });
  $('#bk-clear') && ($('#bk-clear').onclick = () => { S.selected.clear(); render(); });
  $('#bk-trim') && ($('#bk-trim').onclick = () => {
    const vis = new Set(visibleBills().map(b => b.id));
    [...S.selected].forEach(id => vis.has(id) || S.selected.delete(id));
    render();
  });
  const upd = (sel, fn) => document.querySelectorAll(sel).forEach(el => {
    el.onclick = e => e.stopPropagation();
    el.onchange = e => fn(el, e).then(() => toast('Saved')).catch(err => toast(err.message, true));
  });
  upd('[data-pos]', el => DB.updateBill(el.dataset.pos, { position: el.value || null }));
  upd('[data-pri]', el => DB.updateBill(el.dataset.pri, { priority: el.value ? +el.value : null }));
  upd('[data-own]', el => DB.setOwner(el.dataset.own, el.value || null));
  document.querySelectorAll('[data-logt]').forEach(el => el.onclick = e => {
    e.stopPropagation(); S.logType = 'testimony'; openDrawer(el.dataset.logt);
  });
  wireDrawer(); wireAdd(); wireSettings();
}
function rerenderBody() {   // keep focus in the search box being typed in
  const y = window.scrollY; render(); window.scrollTo(0, y);
  const q = document.querySelector('.qbox.' + (S.qFocus || 'topq')) || document.querySelector('.qbox');
  if (q && q.checkVisibility()) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); }
}
// Re-render without the page jumping: keep the scroll position, and reopen a
// menu the user was inside (the filter menu stays open between checkbox taps).
function rerenderKeep(openSel, anchorId) {
  // Anchor: keep the named element at the same place on screen, even though
  // the content above or inside it changes height (week paging, show more).
  const a = anchorId && document.getElementById(anchorId);
  const before = a ? a.getBoundingClientRect().top : null;
  const y = window.scrollY;
  render();
  if (openSel) { const d = document.querySelector(openSel); if (d) d.open = true; }
  const b = anchorId && document.getElementById(anchorId);
  if (a && b) {
    window.scrollBy(0, b.getBoundingClientRect().top - before);
    // Near the bottom of a page that just got shorter, the browser cannot
    // scroll far enough; add room below so the anchor stays put.
    const off = b.getBoundingClientRect().top - before;
    if (Math.abs(off) > 2) { $('#app').style.paddingBottom = (parseFloat($('#app').style.paddingBottom) || 0) + off + 'px'; window.scrollBy(0, off); }
  } else window.scrollTo(0, y);
}
function wireDrawer() {
  // ---- chat ----
  const chatBill = S.drawerBill;
  $('#d-chatopen') && ($('#d-chatopen').onclick = () => keep(() => { S.drawerOpen.chat = true; }) || setTimeout(() => $('#d-chatnew')?.focus(), 50));
  $('#d-chatall') && ($('#d-chatall').onclick = () => keep(() => { S.drawerOpen.chatAll = true; }));
  if ($('#d-chat') && chatBill && unreadCount({ id: chatBill })) DB.markChatSeen(chatBill).catch(() => {});
  const sendChat = async () => { const ta = $('#d-chatnew'); const body = (ta?.value || '').trim(); if (!body || !chatBill) return;
    ta.disabled = true; try { await DB.sendMessage(chatBill, body); keep(() => { S.drawerOpen.chat = true; }); setTimeout(() => { const el = $('#d-chat'); if (el) el.scrollTop = el.scrollHeight; $('#d-chatnew')?.focus(); }, 30); }
    catch (e) { toast(e.message, true); ta.disabled = false; } };
  $('#d-chatsend') && ($('#d-chatsend').onclick = sendChat);
  $('#d-chatnew') && ($('#d-chatnew').onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); } });
  document.querySelectorAll('[data-msgdel]').forEach(el => el.onclick = async () => { const m = (S.messages[chatBill] || []).find(x => String(x.id) === el.dataset.msgdel); if (!m) return; try { await DB.deleteMessage(m); keep(() => {}); } catch (e) { toast(e.message, true); } });
  document.querySelectorAll('[data-jumpbill]').forEach(el => el.onclick = () => { const b = S.bills.find(x => x.bill_number === el.dataset.jumpbill); if (b) openDrawer(b.id); });
  const b = S.bills.find(x => x.id === S.drawerBill); if (!b) return;
  $('#scrim').onclick = $('#dclose').onclick = () => { S.drawerBill = null; render(); };
  // render() rebuilds the drawer after every save; remember which editors
  // were open so a save does not fold the section the user is working in.
  const ps = $('#d-pubsec'), ns = $('#d-notesec'), ds = $('#d-detsec');
  if (ps) ps.ontoggle = () => { S.drawerOpen.pub = ps.open; };
  if (ns) ns.ontoggle = () => { S.drawerOpen.notes = ns.open; };
  if (ds) ds.ontoggle = () => { S.drawerOpen.details = ds.open; };
  const ts = $('#d-teamsec'); if (ts) ts.ontoggle = () => { S.drawerOpen.team = ts.open; };
  const tp = $('#d-todoplus'); if (tp) tp.onclick = () => { S.drawerOpen.todo = true; render(); $('#d-tdnew')?.focus(); };
  const keep = fn => { const y = $('.dbody')?.scrollTop || 0; fn(); render(); const db = $('.dbody'); if (db) db.scrollTop = y; };
  document.querySelectorAll('[data-dtab]').forEach(el => el.onclick = () => keep(() => { S.drawerOpen.tab = el.dataset.dtab; }));
  $('#d-more') && ($('#d-more').onclick = () => keep(() => { S.drawerOpen.more = !S.drawerOpen.more; }));
  $('#d-logopen') && ($('#d-logopen').onclick = () => { keep(() => { S.drawerOpen.log = true; }); $('#d-ltitle')?.focus(); });
  $('#d-logclose') && ($('#d-logclose').onclick = () => keep(() => { S.drawerOpen.log = false; }));
  document.querySelectorAll('[data-follow]').forEach(el => el.onclick = async () => {
    const on = !S.follows?.has(el.dataset.follow);
    try { await DB.follow(el.dataset.follow, on); toast(on ? 'Following — it shows in My bills now' : 'Unfollowed'); keep(() => {}); } catch (e) { toast(e.message, true); }
  });
  document.querySelectorAll('[data-opentab]').forEach(el => el.onclick = async e => { e.stopPropagation(); const id = el.dataset.opentab, tab = el.dataset.tab; await openDrawer(id); if (tab === 'chat') { S.drawerOpen.chat = true; } else S.drawerOpen.tab = tab; render(); });
  document.querySelectorAll('[data-bill-open]').forEach(el => el.onclick = e => { e.stopPropagation(); openDrawer(el.dataset.billOpen); });
  document.querySelectorAll('[data-copylink]').forEach(el => el.onclick = async () => {
    const url = `${APP_URL}#bill=${el.dataset.copylink}`;
    try { await navigator.clipboard.writeText(url); toast('Link copied'); } catch { prompt('Copy this link', url); }
  });
  document.querySelectorAll('.drawer [data-attend]').forEach(el => el.onclick = async () => {
    const on = !(S.attend?.[el.dataset.attend] || []).includes(S.me?.id);
    try { await DB.attend(el.dataset.attend, on); toast(on ? 'Marked as attending' : 'No longer attending'); keep(() => {}); } catch (e) { toast(e.message, true); }
  });
  $('.dprimary') && ($('.dprimary').onclick = () => { const row = document.querySelector(`[data-draft="${$('.dprimary').dataset.primary}"]`);
    const btn = row?.querySelector(`[data-act="${$('.dprimary').dataset.primaryact}"]`); if (btn) { row.scrollIntoView({ block: 'center' }); btn.click(); } });
  const save = (patch, msg) => DB.updateBill(b.id, patch)
    .then(() => { toast(msg || 'Saved'); render(); })
    .catch(e => toast(e.message, true));
  $('#d-pos').onchange = e => save({ position: e.target.value || null });
  $('#d-pri').onchange = e => save({ priority: e.target.value ? +e.target.value : null });
  $('#d-so').onchange = e => save({ stage_override: e.target.value || null });
  $('#d-own').onchange = e => DB.setOwner(b.id, e.target.value || null)
    .then(() => { toast('Owner updated'); render(); }).catch(er => toast(er.message, true));
  $('#d-savenotes').onclick = () => save({ internal_notes: $('#d-notes').value || null }, 'Notes saved');
  $('#d-savepub').onclick = () => {
    const action = $('#d-pact').value.trim(), until = $('#d-puntil').value;
    // An ask without an expiry never renders — public_bills requires
    // public_action_until >= current_date. Refuse rather than save something
    // that looks published and isn't.
    if (action && !until)
      return toast('An action ask needs an expiry date, or it will never show', true);
    if (action && until < hiToday())
      return toast('That expiry date has passed — the ask would not be shown', true);
    save({
      public_summary: $('#d-psum').value.trim() || null,
      public_action: action || null,
      public_action_until: until || null,
      is_public: $('#d-ispub').checked,
    }, 'Public copy saved');
  };
  document.querySelectorAll('[data-campt]').forEach(el => el.onclick = async () => {
    const id = el.dataset.campt, on = !el.classList.contains('on');
    const nm = S.campaigns.find(c => c.id === id)?.name || 'coalition';
    el.disabled = true;
    try { await DB.toggleCampaign(b.id, id, on);
      toast(on ? `Added to ${nm}` : `Removed from ${nm}`); render(); }
    catch (e) { el.disabled = false; toast(e.message, true); }
  });
  document.querySelectorAll('[data-lt]').forEach(el => el.onclick = () => {
    S.logType = el.dataset.lt;
    document.querySelectorAll('[data-lt]').forEach(x => x.classList.toggle('on', x === el));
  });
  document.querySelectorAll('[data-draft]').forEach(row => {
    const id = row.dataset.draft;
    row.querySelectorAll('[data-act]').forEach(btn => btn.onclick = async () => {
      const act = btn.dataset.act;
      // Two actions want a word from the user first: an inline field, not a prompt().
      if (act === 'changes' || act === 'filed') {
        S.draftUI = { id, mode: act }; render();
        document.querySelector(`[data-draft="${id}"] input`)?.focus(); return;
      }
      if (act === 'cancelui') { S.draftUI = null; render(); return; }
      const note = row.querySelector('.dfnote')?.value, url = row.querySelector('.dfurl')?.value;
      btn.disabled = true;
      try {
        await DB.transition(b.id, id, act, note, url);
        S.draftUI = null;
        toast({ submit: 'Sent for review', approve: 'Approved', request_changes: 'Sent back with your note',
          withdraw: 'Back to draft', file: 'Marked filed', unfile: 'Unmarked' }[act] || 'Done');
        if (act === 'file' && !DEMO) openDrawer(b.id); else render();
      } catch (e) { btn.disabled = false; toast(e.message, true); }
    });
  });
  document.querySelectorAll('[data-todo]').forEach(row => {
    const id = row.dataset.todo;
    row.querySelector('.tdchk').onchange = async e => {
      const el = e.target; el.disabled = true;
      try { await DB.updateTodo(b.id, id, { done: el.checked }); render(); }
      catch (err) { el.checked = !el.checked; el.disabled = false; toast(err.message, true); }
    };
    row.querySelector('.tddue').onchange = async e => {
      try { await DB.updateTodo(b.id, id, { due_date: e.target.value || null }); render(); }
      catch (err) { toast(err.message, true); }
    };
    row.querySelector('.tdown').onchange = async e => {
      try { await DB.updateTodo(b.id, id, { assignee_id: e.target.value || null }); render(); }
      catch (err) { toast(err.message, true); }
    };
    row.querySelector('.tddel').onclick = async () => {
      try { await DB.deleteTodo(b.id, id); toast('Task removed'); render(); }
      catch (err) { toast(err.message, true); }
    };
  });
  const addTodo = async () => {
    const inp = $('#d-tdnew'), title = inp.value.trim();
    if (!title) return toast('Type the task first', true);
    const btn = $('#d-tdadd'); btn.disabled = true;
    try { await DB.addTodo(b.id, title); inp.value = ''; render(); }
    catch (e) { btn.disabled = false; toast(e.message, true); }
  };
  // Absent when To do is collapsed to its one-line control.
  if ($('#d-tdadd')) {
    $('#d-tdadd').onclick = addTodo;
    $('#d-tdnew').addEventListener('keydown', e => e.key === 'Enter' && addTodo());
  }
  if ($('#d-log')) $('#d-log').onclick = async () => {
    const title = $('#d-ltitle').value.trim();
    if (!title) return toast('Add a short summary first', true);
    if (!S.me) return toast('Your login isn\'t linked to an advocate yet — ask your admin', true);
    try {
      await DB.addActivity(b.id, S.logType, title, $('#d-ldetails').value.trim());
      toast('Logged'); $('#d-ltitle').value = ''; $('#d-ldetails').value = '';
      const tl = await DB.timeline(b.id); $('#tlmount').innerHTML = timelineHTML(tl);
    } catch (e) { toast(e.message, true); }
  };
}
function wireAdd() {
  const q = $('#addq'); if (!q) return;
  let t; q.oninput = () => { clearTimeout(t); t = setTimeout(doSearch, 350); };
  async function doSearch() {
    const val = q.value.trim(), box = $('#addresults');
    if (val.length < 3) { box.innerHTML = '<div class="row" style="color:var(--muted)">Type at least 3 characters…</div>'; return; }
    box.innerHTML = '<div class="row" style="color:var(--muted)">Searching…</div>';
    try {
      const rows = await DB.searchUntracked(val);
      box.innerHTML = rows.length ? rows.map(r => `
        <div class="row"><span class="bno">${esc(r.bill_number)}</span>
          <span style="flex:1">${esc(r.title||'')}</span>
          <button class="btn sm" data-track="${r.id}">Track</button></div>`).join('')
        : '<div class="row" style="color:var(--muted)">No untracked bills match.</div>';
      box.querySelectorAll('[data-track]').forEach(btn => btn.onclick = async () => {
        const bill = rows.find(r => r.id === btn.dataset.track);
        try { await DB.track(bill); toast(bill.bill_number + ' is now tracked'); btn.textContent = '✓'; btn.disabled = true; }
        catch (e) { toast(e.message, true); }
      });
    } catch (e) { box.innerHTML = ''; toast(e.message, true); }
  }
}
function exportCSV() {
  const rows = [['Bill','Title','Coalitions','Owner','Stage','Position','Priority','Committee','Last action','Last action date']];
  visibleBills().forEach(b => rows.push([b.bill_number, b.title,
    (S.billCampaigns[b.id]||[]).map(c=>S.campaigns.find(x=>x.id===c)?.name).join('; '),
    owners(b).map(a=>a.full_name).join('; '), STAGE_LABEL[effStage(b)], b.position||'',
    b.priority||'', b.committee||'', b.last_action||'', b.last_action_date||'']));
  const csv = rows.map(r => r.map(c => `"${String(c??'').replace(/"/g,'""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = 'hiphi-bill-tracker.csv'; a.click();
}

// ---------------- boot ----------------
async function boot() {
  try {
    if (!S.session) return renderLogin();
    if (RECOVERY && !DEMO) return renderRecovery();
    // Visit-session boundary (per device): reloads within 30 min keep the
    // same "since your last visit" baseline; first-ever visit starts at now.
    if (!DEMO) {
      const nowT = Date.now();
      const last = +localStorage.getItem('lastVisit') || 0;
      if (!last) {
        localStorage.setItem('lastVisit', String(nowT));
        localStorage.setItem('prevVisit', String(nowT));
        S.sinceVisit = nowT;
      } else if (nowT - last > 30 * 60e3) {
        localStorage.setItem('prevVisit', String(last));
        localStorage.setItem('lastVisit', String(nowT));
        S.sinceVisit = last;
      } else S.sinceVisit = +localStorage.getItem('prevVisit') || last;
    }
    $('#app').innerHTML = '<div class="boot">Loading your bills…</div>';
    await DB.loadAll();
    if (!S.me) toast('Signed in, but no matching advocate record — ask your admin', true);
    // Back from Google's consent screen: say how it went and open Settings.
    const calMsg = HASH_Q.get('calendar');
    if (calMsg) {
      S.view = 'settings'; history.replaceState(null, '', location.pathname + location.search);
      setTimeout(() => toast(calMsg.startsWith('error:') ? 'Google Calendar: ' + calMsg.slice(6) : 'Google Calendar ' + calMsg, calMsg.startsWith('error:')), 300);
    }
    // Emails link straight to a bill: app/#bill=HB123
    const want = (HASH_Q.get('bill') || '').replace(/\s+/g, '').toUpperCase();
    const target = want && S.bills.find(x => (x.bill_number || '').replace(/\s+/g, '').toUpperCase() === want);
    if (target) { S.drawerBill = target.id; history.replaceState(null, '', location.pathname + location.search); }
    render();
  } catch (e) {
    $('#app').innerHTML = `<div class="boot">Something went wrong: ${esc(e.message)}<br><br>
      <button class="btn" onclick="location.reload()">Retry</button></div>`;
  }
}
// Escape closes the bill drawer. Registered once here rather than in wireDrawer,
// which re-runs on every render and would stack a listener each time.
// ---------------- keyboard ----------------
let KEY_PENDING_G = false;
function kRows() { return [...document.querySelectorAll('.prow[data-bill], .chip3[data-bill], .tlrow[data-bill], tr[data-bill], .card[data-bill]')].filter(el => el.checkVisibility()); }
document.addEventListener('keydown', e => {
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName) || document.activeElement?.isContentEditable;
  if (e.key === 'Escape') {
    if (typing) { document.activeElement.blur(); return; }
    if (S.drawerBill) { S.drawerBill = null; render(); return; }
    const open = document.querySelector('.pillmenu[open], .viewtabs details[open]'); if (open) { open.open = false; return; }
    if (S.q) { S.q = ''; render(); }
    return;
  }
  if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
  const k = e.key;
  if (KEY_PENDING_G) { KEY_PENDING_G = false; const m = { p: 'portfolio', d: 'desk', t: 'table', c: 'cards', s: 'settings', h: 'help', i: 'triage' }[k]; if (m) { S.view = m; S.drawerBill = null; localStorage.setItem('view', m); render(); } return; }
  if (k === 'g') { KEY_PENDING_G = true; setTimeout(() => { KEY_PENDING_G = false; }, 1200); return; }
  if (k === '/') { e.preventDefault(); const q = [...document.querySelectorAll('.qbox')].find(el => el.checkVisibility()); if (q) { q.focus(); q.select(); } return; }
  if (k === '?') { e.preventDefault(); S.view = 'help'; S.drawerBill = null; render(); return; }
  if (S.drawerBill) {
    const b = S.bills.find(x => x.id === S.drawerBill);
    if ('12345'.includes(k) && k) { const tab = ['details', 'team', 'public', 'notes', 'timeline'][Number(k) - 1]; document.querySelector(`[data-dtab="${tab}"]`)?.click(); return; }
    if (k === 'f') { document.querySelector('[data-follow]')?.click(); return; }
    if (k === 'a') { document.querySelector('[data-attend]')?.click(); return; }
    return;
  }
  if (k === 'n' || k === 'p') { const el = document.querySelector(`[data-week="${k === 'n' ? 1 : -1}"]`); if (el && el.checkVisibility()) el.click(); return; }
  if (S.view === 'triage' && S.triage?.rows?.length) {
    const t = S.triage, rows = [...document.querySelectorAll('.trow')];
    if (k === 'j' || k === 'k') { e.preventDefault(); t.focus = Math.max(0, Math.min(rows.length - 1, t.focus + (k === 'j' ? 1 : -1))); rows.forEach((r, i) => r.classList.toggle('kfocus', i === t.focus)); rows[t.focus]?.scrollIntoView({ block: 'nearest' }); return; }
    const cur = rows[t.focus]; if (!cur) return;
    if (k === 't') { cur.querySelector('[data-ttrack]')?.click(); return; }
    if (k === 's') { cur.querySelector('[data-tskip]')?.click(); return; }
    if (k === 'u') { document.querySelector('[data-tundo]')?.click(); return; }
    if (/^[1-9]$/.test(k)) { const sel = cur.querySelector('[data-tsel]'); const opt = sel?.options[Number(k)]; if (opt) { sel.value = opt.value; sel.dispatchEvent(new Event('change')); } return; }
  }
  if (k === 'j' || k === 'k') {
    e.preventDefault(); const rows = kRows(); if (!rows.length) return;
    let i = rows.findIndex(r => r.classList.contains('kfocus'));
    rows.forEach(r => r.classList.remove('kfocus'));
    i = k === 'j' ? Math.min(rows.length - 1, i + 1) : Math.max(0, i - 1);
    rows[i].classList.add('kfocus'); rows[i].scrollIntoView({ block: 'nearest' }); return;
  }
  if (k === 'Enter' || k === 'o') { const r = document.querySelector('.kfocus[data-bill]'); if (r) { e.preventDefault(); openDrawer(r.dataset.bill); } }
});
DB.init().then(boot);
