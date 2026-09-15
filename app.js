// ============================================================
// HIPHI Bill Tracker — staff app
// Views: Portfolio · Pipeline · Table · Desk · Cards  (+ bill drawer, add bills)
// Data: Supabase (RLS-protected). Demo mode: append ?demo=1
// ============================================================
const SUPABASE_URL = 'https://eivzjbnygscguqqiiuvh.supabase.co';
const SUPABASE_KEY = 'sb_publishable_uvEtw8ru3zB9lDOxAjzrUA_JEFvKyul';
const DEMO = new URLSearchParams(location.search).has('demo');
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
const SESSION_YEAR = 2026;

const STAGES = [
  ['introduced','Introduced'], ['first_triple','1st Triple'], ['first_lateral','1st Lateral'],
  ['first_decking','1st Decking'], ['first_crossover','Crossover'], ['second_triple','2nd Triple'],
  ['second_lateral','2nd Lateral'], ['second_decking','2nd Decking'],
  ['second_crossover','Passed Both'], ['conference','Conference'], ['governor','Governor'],
  ['enacted','Law'], ['vetoed','Vetoed'], ['dead','Dead'],
];
const STAGE_LABEL = Object.fromEntries(STAGES);
const POSITIONS = [['','—'],['support','Support'],['support_amend','Support w/ amendments'],
  ['oppose','Oppose'],['monitor','Monitor'],['neutral','Comments (neutral)']];
const POS_CLS = { support: 'c-green', support_amend: 'c-green', oppose: 'c-red', monitor: 'c-gray', neutral: 'c-gold' };
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
  view: (v => ['portfolio','pipeline','desk','table','cards','add','settings'].includes(v)
              ? v : 'portfolio')(localStorage.getItem('view')),
  owner: 'me', q: '', pri: '', stageF: '', camp: '',
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
const fmtDate = (d, opts) => d ? new Date(d).toLocaleString('en-US',
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
    if (DEMO) { demoInit(); return; }
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
    const [adv, bills, asg, camps, bc, hear, pulse, feed, todos, drafts, comms, scfg, ccfg] = await Promise.all([
      S.supa.from('advocates').select('*').order('full_name'),
      S.supa.from('bills').select('*').eq('tracked', true).order('bill_number').limit(2000),
      S.supa.from('bill_assignments').select('bill_id,advocate_id'),
      S.supa.from('campaigns').select('*').order('sort_order'),
      S.supa.from('bill_campaigns').select('bill_id,campaign_id'),
      S.supa.from('hearings').select('*').gte('scheduled_at', new Date(Date.now()-864e5).toISOString()),
      S.supa.from('bill_pulse').select('*'),
      S.supa.from('activity_log').select('*').eq('source','team')
        .order('occurred_at', { ascending: false }).limit(25),
      S.supa.from('bill_todos').select('*').order('sort_order').order('created_at'),
      S.supa.from('testimony_drafts').select('*').order('created_at'),
      S.supa.from('committees').select('*'),
      S.supa.from('app_settings').select('value').eq('key', 'slack').maybeSingle(),
      S.supa.from('app_settings').select('value').eq('key', 'calendar').maybeSingle(),
    ]);
    S.slackCfg = scfg?.data?.value || null;
    S.calCfg = ccfg?.data?.value || null;
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
    if (DEMO) return [];
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
// ===SCENARIO-START===
// A scripted Aug 3 - Oct 30 legislative session. Every bill carries a dated
// event timeline; buildScenario() derives the state visible "today" from the
// real calendar, so the sandbox plays itself forward week by week: hearing
// notices post, deadlines approach, bills pass and die on schedule.
// Facilitator guide: TRAINING.md in the Bill-Tracker repo.
// Event row: [date, stage, committee, action]. Hearing row:
// [hearing ISO, committee, room, notice date, testimony-deadline ISO].
const SCRIPT = [
{id:'m0',num:'HB2100',title:'Relating to Emergency Appropriations (wildfire health response)',ch:'H',refs:['FIN'],st:[1,0],camp:'c3',own:'NT',pos:'support',pri:2,touch:12,tc:0,
 ev:[['2026-08-03','introduced','','Introduced and Pass First Reading.'],
     ['2026-08-05','first_decking','FIN','Referred to FIN, referral sheet 1'],
     ['2026-08-06','first_decking','FIN','The committee on FIN recommend that the measure be PASSED, UNAMENDED.'],
     ['2026-08-07','first_crossover','','Passed Third Reading.'],
     ['2026-08-10','second_crossover','','Passed Final Reading in Senate. Received notice of passage.'],
     ['2026-08-12','governor','','Enrolled to Governor.'],
     ['2026-08-19','enacted','','Act 201, 08/19/2026 (Gov. Msg. No. 1150).']],hr:[]},
{id:'m1',num:'HB2101',title:'Relating to Health (flavored tobacco ban)',desc:'Prohibits the sale of flavored tobacco products, including menthol cigarettes and flavored e-liquids, beginning 7/1/2027.',ch:'H',refs:['HLT','CPC','FIN'],st:[3,2],camp:'c1',own:'KV',pos:'support',pri:1,touch:0,tc:1,comps:['SB2201'],
 spon:[{n:'LOWEN',p:true},{n:'TAKAYAMA',p:true},{n:'AMATO',p:true},{n:'PERRUSO',p:true}],
 ev:[['2026-08-03','introduced','','Introduced and Pass First Reading.'],
     ['2026-08-05','first_triple','HLT','Referred to HLT, CPC, FIN, referral sheet 2'],
     ['2026-08-10','first_triple','HLT','Bill scheduled to be heard by HLT on 08-12-26 9:00AM in conference room 329.'],
     ['2026-08-12','first_triple','HLT','The committee on HLT recommend that the measure be PASSED, WITH AMENDMENTS.'],
     ['2026-08-14','first_lateral','CPC','Reported from HLT as amended in HD 1; referred to CPC.'],
     ['2026-08-26','first_lateral','CPC','The committee on CPC recommend that the measure be PASSED, WITH AMENDMENTS.'],
     ['2026-08-28','first_decking','FIN','Reported from CPC as amended in HD 2; referred to FIN.'],
     ['2026-09-03','first_decking','FIN','The committee on FIN recommend that the measure be PASSED, UNAMENDED.'],
     ['2026-09-08','first_crossover','','Passed Third Reading (HD 2). Transmitted to Senate.'],
     ['2026-09-11','second_lateral','HHS','Referred to HHS, WAM.'],
     ['2026-09-16','second_lateral','HHS','The committee on HHS recommend that the measure be PASSED, WITH AMENDMENTS (SD 1).'],
     ['2026-09-22','second_decking','WAM','Reported from HHS; referred to WAM.'],
     ['2026-09-30','second_decking','WAM','The committee on WAM recommend that the measure be PASSED, WITH AMENDMENTS (SD 2).'],
     ['2026-10-06','second_crossover','','Passed Third Reading in Senate (SD 2). Returned to House.'],
     ['2026-10-09','conference','','House disagrees with Senate amendments.'],
     ['2026-10-13','conference','','House and Senate conferees appointed.'],
     ['2026-10-22','conference','','The Conference Committee recommends that the measure be PASSED, WITH AMENDMENTS (CD 1).'],
     ['2026-10-27','governor','','Passed Final Reading (CD 1) in both chambers.'],
     ['2026-10-28','governor','','Enrolled to Governor.']],
 hr:[['2026-08-26T14:00:00-10:00','CPC','Conference Room 329','2026-08-21','2026-08-25T14:00:00-10:00'],
     ['2026-09-02T14:00:00-10:00','FIN','Conference Room 308','2026-08-30','2026-09-01T14:00:00-10:00'],
     ['2026-09-16T13:00:00-10:00','HHS','Conference Room 229','2026-09-12','2026-09-15T13:00:00-10:00'],
     ['2026-09-30T10:00:00-10:00','WAM','Conference Room 211','2026-09-26','2026-09-29T10:00:00-10:00']]},
{id:'m2',num:'SB2201',title:'Relating to Health (flavored tobacco ban)',desc:'Senate companion to HB2101.',ch:'S',refs:['HHS','WAM'],st:[2,2],camp:'c1',own:'SY',pos:'support',pri:1,touch:1,tc:1,comps:['HB2101'],
 spon:[{n:'ELEFANTE',p:true},{n:'SAN BUENAVENTURA',p:true},{n:'KEOHOKALOLE',p:true}],
 ev:[['2026-08-03','introduced','','Introduced and passed First Reading.'],
     ['2026-08-05','first_lateral','HHS','Referred to HHS, WAM.'],
     ['2026-08-11','first_lateral','HHS','The committee on HHS recommend that the measure be PASSED, WITH AMENDMENTS (SD 1).'],
     ['2026-08-18','first_decking','WAM','Reported from HHS (SD 1); referred to WAM.'],
     ['2026-09-02','first_decking','WAM','The committee on WAM recommend that the measure be PASSED, UNAMENDED.'],
     ['2026-09-08','first_crossover','','Passed Third Reading. Transmitted to House.'],
     ['2026-09-11','second_lateral','HLT','Referred to HLT, FIN.'],
     ['2026-09-17','second_lateral','HLT','The committee on HLT recommend that the measure be PASSED, WITH AMENDMENTS (HD 1).'],
     ['2026-09-23','second_decking','FIN','Reported from HLT; referred to FIN.'],
     ['2026-10-01','second_decking','FIN','The committee on FIN deferred the measure.']],
 hr:[['2026-08-31T10:00:00-10:00','WAM','Conference Room 211','2026-08-26','2026-08-30T10:00:00-10:00'],
     ['2026-09-17T13:00:00-10:00','HLT','Conference Room 329','2026-09-13','2026-09-16T13:00:00-10:00']]},
{id:'m3',num:'HB2102',title:'Relating to School Meals (universal free school meals)',ch:'H',refs:['HSG','WAL','FIN'],st:[3,0],camp:'c2',own:'KR',pos:'support',pri:1,touch:3,tc:1,
 spon:[{n:'MARTEN',p:true},{n:'KILA',p:true}],
 ev:[['2026-08-03','introduced','','Introduced and Pass First Reading.'],
     ['2026-08-05','first_triple','HSG','Referred to HSG, WAL, FIN, referral sheet 2'],
     ['2026-08-10','first_triple','HSG','The committee on HSG recommend that the measure be PASSED, WITH AMENDMENTS.'],
     ['2026-08-13','first_lateral','WAL','Reported from HSG as amended in HD 1; referred to WAL.']],hr:[]},
{id:'m4',num:'HB2104',title:'Relating to Transportation (safe routes to school funding)',ch:'H',refs:['TRN','FIN'],st:[2,0],camp:'c3',own:'SY',pos:'support',pri:2,touch:2,tc:1,comps:['SB2204'],
 ev:[['2026-08-03','introduced','','Introduced and Pass First Reading.'],
     ['2026-08-05','first_lateral','TRN','Referred to TRN, FIN, referral sheet 2'],
     ['2026-08-11','first_lateral','TRN','The committee on TRN recommend that the measure be PASSED, UNAMENDED.'],
     ['2026-08-13','first_decking','FIN','Reported from TRN; referred to FIN.'],
     ['2026-08-17','first_decking','FIN','The committee on FIN recommend that the measure be PASSED, UNAMENDED.'],
     ['2026-08-20','dead','','Failed to pass Third Reading. Ayes, 24; Noes, 27.']],hr:[]},
{id:'m5',num:'SB2204',title:'Relating to Transportation (safe routes to school funding)',desc:'Senate companion to HB2104.',ch:'S',refs:['TRS','WAM'],st:[2,2],camp:'c3',own:'SY',pos:'support',pri:2,touch:5,tc:0,comps:['HB2104'],
 ev:[['2026-08-03','introduced','','Introduced and passed First Reading.'],
     ['2026-08-05','first_lateral','TRS','Referred to TRS, WAM.'],
     ['2026-08-13','first_lateral','TRS','The committee on TRS recommend that the measure be PASSED, WITH AMENDMENTS (SD 1).'],
     ['2026-08-19','first_decking','WAM','Reported from TRS (SD 1); referred to WAM.'],
     ['2026-08-31','first_decking','WAM','The committee on WAM recommend that the measure be PASSED, WITH AMENDMENTS (SD 2).'],
     ['2026-09-08','first_crossover','','Passed Third Reading (SD 2). Transmitted to House.'],
     ['2026-09-11','second_lateral','TRN','Referred to TRN, FIN.'],
     ['2026-09-18','second_lateral','TRN','The committee on TRN recommend that the measure be PASSED, UNAMENDED.'],
     ['2026-09-24','second_decking','FIN','Reported from TRN; referred to FIN.'],
     ['2026-10-01','second_decking','FIN','The committee on FIN recommend that the measure be PASSED, WITH AMENDMENTS.'],
     ['2026-10-07','second_crossover','','Passed Third Reading (HD 1). Returned to Senate.'],
     ['2026-10-09','conference','','Senate disagrees with House amendments.'],
     ['2026-10-14','conference','','House and Senate conferees appointed.'],
     ['2026-10-21','conference','','The Conference Committee recommends that the measure be PASSED, WITH AMENDMENTS (CD 1).'],
     ['2026-10-26','governor','','Passed Final Reading (CD 1) in both chambers.'],
     ['2026-10-28','governor','','Enrolled to Governor.'],
     ['2026-10-30','enacted','','Act 245, 10/30/2026.']],
 hr:[['2026-08-28T10:00:00-10:00','WAM','Conference Room 211','2026-08-23','2026-08-27T10:00:00-10:00'],
     ['2026-09-18T09:00:00-10:00','TRN','Conference Room 016','2026-09-14','2026-09-17T09:00:00-10:00']]},
{id:'m6',num:'HB2105',title:'Relating to Electronic Smoking Devices (retail enforcement)',ch:'H',refs:['HLT','JHA'],st:[2,0],camp:'c1',own:'KV',pos:'support',pri:2,touch:8,tc:0,
 ev:[['2026-08-04','introduced','','Introduced and Pass First Reading.'],
     ['2026-08-06','first_lateral','HLT','Referred to HLT, JHA, referral sheet 3']],hr:[]},
{id:'m7',num:'HB2107',title:'Relating to Counties (preemption of county tobacco regulation)',desc:'Preempts counties from adopting tobacco retail rules stricter than state law.',ch:'H',refs:['CPC','JHA'],st:[2,2],camp:'c1',own:'NT',pos:'oppose',pri:1,touch:1,tc:1,
 ev:[['2026-08-03','introduced','','Introduced and Pass First Reading.'],
     ['2026-08-05','first_lateral','CPC','Referred to CPC, JHA, referral sheet 2'],
     ['2026-08-13','first_lateral','CPC','The committee on CPC recommend that the measure be PASSED, WITH AMENDMENTS.'],
     ['2026-08-15','first_decking','JHA','Reported from CPC as amended in HD 1; referred to JHA.'],
     ['2026-08-27','first_decking','JHA','The committee on JHA recommend that the measure be PASSED, WITH AMENDMENTS.'],
     ['2026-09-03','first_crossover','','Passed Third Reading (HD 2). Transmitted to Senate.'],
     ['2026-09-12','second_lateral','CPN','Referred to CPN, JDC.'],
     ['2026-09-25','second_lateral','CPN','Bill scheduled to be heard by CPN on 10-01-26 9:30AM.'],
     ['2026-10-01','second_lateral','CPN','The committee on CPN deferred the measure.']],
 hr:[['2026-08-27T10:00:00-10:00','JHA','Conference Room 325','2026-08-22','2026-08-26T10:00:00-10:00'],
     ['2026-10-01T09:30:00-10:00','CPN','Conference Room 229','2026-09-27','2026-09-30T09:30:00-10:00']]},
{id:'m8',num:'SB2203',title:'Relating to Human Services (SNAP outreach and enrollment)',ch:'S',refs:['HHS','JDC'],st:[2,2],camp:'c2',own:'KR',pos:'support',pri:2,touch:9,tc:0,
 ev:[['2026-08-03','introduced','','Introduced and passed First Reading.'],
     ['2026-08-05','first_lateral','HHS','Referred to HHS, JDC.'],
     ['2026-08-12','first_lateral','HHS','The committee on HHS recommend that the measure be PASSED, WITH AMENDMENTS (SD 1).'],
     ['2026-08-17','first_decking','JDC','Reported from HHS (SD 1); referred to JDC.'],
     ['2026-08-27','first_decking','JDC','The committee on JDC recommend that the measure be PASSED, WITH AMENDMENTS.'],
     ['2026-09-08','first_crossover','','Passed Third Reading (SD 2). Transmitted to House.'],
     ['2026-09-12','second_lateral','HSG','Referred to HSG, WAL.'],
     ['2026-09-18','second_lateral','HSG','The committee on HSG recommend that the measure be PASSED, WITH AMENDMENTS (HD 1).'],
     ['2026-09-24','second_decking','WAL','Reported from HSG; referred to WAL.']],
 hr:[['2026-08-27T10:00:00-10:00','JDC','Conference Room 016','2026-08-22','2026-08-26T10:00:00-10:00'],
     ['2026-09-18T10:00:00-10:00','HSG','Conference Room 325','2026-09-14','2026-09-17T10:00:00-10:00']]},
{id:'m9',num:'SB2208',title:'Relating to Health (mobile health outreach vans)',ch:'S',refs:['HHS/CPN','WAM'],st:[2,0],camp:'c2',own:'KR',pos:'monitor',pri:3,touch:null,tc:0,
 ev:[['2026-08-03','introduced','','Introduced and passed First Reading.'],
     ['2026-08-05','first_lateral','HHS/CPN','Referred to HHS/CPN, WAM.'],
     ['2026-08-14','first_lateral','HHS/CPN','The committees on HHS/CPN recommend that the measure be PASSED, UNAMENDED.'],
     ['2026-08-19','first_decking','WAM','Reported from HHS/CPN; referred to WAM.']],hr:[]},
{id:'m10',num:'SB2210',title:'Relating to Hospitals (emergency department staffing)',ch:'S',refs:['HHS'],st:[1,2],camp:'c3',own:'NT',pos:'support',pri:2,touch:4,tc:0,
 ev:[['2026-08-04','introduced','','Introduced and passed First Reading.'],
     ['2026-08-06','first_decking','HHS','Referred to HHS. Public notice requirement waived.'],
     ['2026-08-12','first_decking','HHS','The committee on HHS recommend that the measure be PASSED, UNAMENDED.'],
     ['2026-08-18','first_crossover','','Passed Third Reading. Ayes, 25. Transmitted to House.'],
     ['2026-08-20','first_crossover','','Referred to HLT, FIN.'],
     ['2026-09-16','second_lateral','HLT','The committee on HLT recommend that the measure be PASSED, UNAMENDED.'],
     ['2026-09-23','second_decking','FIN','Reported from HLT; referred to FIN.'],
     ['2026-10-02','second_decking','FIN','The committee on FIN recommend that the measure be PASSED, UNAMENDED.'],
     ['2026-10-08','second_crossover','','Passed Third Reading. Received notice of passage on Final Reading.'],
     ['2026-10-12','governor','','Enrolled to Governor.'],
     ['2026-10-20','enacted','','Act 230, 10/20/2026.']],
 hr:[['2026-09-16T09:00:00-10:00','HLT','Conference Room 329','2026-09-11','2026-09-15T09:00:00-10:00']]},
{id:'m11',num:'HB2112',title:'Relating to Health Care (rural clinic loan repayment program)',ch:'H',refs:['HLT','FIN'],st:[2,2],camp:'c2',own:'SY',pos:'support_amend',pri:2,touch:6,tc:0,
 spon:[{n:'COCHRAN',p:true},{n:'PERRUSO',p:true}],
 ev:[['2026-08-03','introduced','','Introduced and Pass First Reading.'],
     ['2026-08-05','first_lateral','HLT','Referred to HLT, FIN, referral sheet 2'],
     ['2026-08-18','first_lateral','HLT','The committee on HLT recommend that the measure be PASSED, WITH AMENDMENTS.'],
     ['2026-08-20','first_decking','FIN','Reported from HLT as amended in HD 1; referred to FIN.'],
     ['2026-09-02','first_decking','FIN','The committee on FIN recommend that the measure be PASSED, UNAMENDED.'],
     ['2026-09-09','first_crossover','','Passed Third Reading (HD 1). Transmitted to Senate.'],
     ['2026-09-15','second_lateral','HHS','Referred to HHS, WAM. The committee on HHS recommend PASSED (SD 1).'],
     ['2026-09-25','second_decking','WAM','Reported from HHS; referred to WAM.'],
     ['2026-10-02','second_decking','WAM','The committee on WAM recommend that the measure be PASSED, WITH AMENDMENTS (SD 2).'],
     ['2026-10-07','second_crossover','','Passed Third Reading in Senate (SD 2). Returned to House.'],
     ['2026-10-10','conference','','House disagrees with Senate amendments.'],
     ['2026-10-15','conference','','House and Senate conferees appointed.'],
     ['2026-10-22','conference','','The Conference Committee recommends that the measure be PASSED, WITH AMENDMENTS (CD 1).'],
     ['2026-10-27','governor','','Passed Final Reading (CD 1) in both chambers.'],
     ['2026-10-29','vetoed','','Vetoed. Returned from the Governor without approval.']],
 hr:[['2026-09-01T14:00:00-10:00','FIN','Conference Room 308','2026-08-28','2026-08-31T14:00:00-10:00'],
     ['2026-09-15T09:00:00-10:00','HHS','Conference Room 016','2026-09-11','2026-09-14T09:00:00-10:00']]},
{id:'m12',num:'HB2113',title:'Relating to Health (sugary drink warning labels)',ch:'H',refs:['CPC'],st:[1,0],camp:'c1',own:'KV',pos:'neutral',pri:3,touch:10,tc:0,
 ev:[['2026-08-04','introduced','','Introduced and Pass First Reading.'],
     ['2026-08-06','first_decking','CPC','Referred to CPC, referral sheet 3'],
     ['2026-08-19','first_decking','CPC','The committee on CPC recommend that the measure be deferred until 08-28-26.'],
     ['2026-08-28','first_decking','CPC','The committee on CPC deferred the measure.']],
 hr:[['2026-08-28T14:00:00-10:00','CPC','Conference Room 329','2026-08-19','2026-08-27T14:00:00-10:00']]},
{id:'m13',num:'HB2115',title:'Relating to Health Data (interoperability standards)',ch:'H',refs:['JHA','FIN'],st:[2,0],camp:'c3',own:'NT',pos:'monitor',pri:3,touch:null,tc:0,
 ev:[['2026-08-10','introduced','','Introduced and Pass First Reading.'],
     ['2026-08-12','introduced','JHA','Referred to JHA, FIN, referral sheet 6']],hr:[]},
{id:'m14',num:'HB2118',title:'Relating to Schools (water bottle filling stations)',ch:'H',refs:['EDN','FIN'],st:[2,2],camp:'c2',own:'KR',pos:'support',pri:1,touch:2,tc:1,comps:['SB2218'],
 ev:[['2026-08-03','introduced','','Introduced and Pass First Reading.'],
     ['2026-08-05','introduced','EDN','Referred to EDN, FIN, referral sheet 2'],
     ['2026-08-12','first_decking','FIN','The committee on EDN recommend that the measure be PASSED, WITH AMENDMENTS (HD 1). Referred to FIN.'],
     ['2026-09-01','first_decking','FIN','The committee on FIN recommend that the measure be PASSED, UNAMENDED.'],
     ['2026-09-09','first_crossover','','Passed Third Reading (HD 1). Transmitted to Senate.'],
     ['2026-09-11','second_lateral','HRE','Referred to HRE, WAM.'],
     ['2026-09-15','second_lateral','HRE','The committee on HRE deferred the measure.']],
 hr:[['2026-09-15T13:00:00-10:00','HRE','Conference Room 229','2026-09-11','2026-09-14T13:00:00-10:00']]},
{id:'m15',num:'SB2218',title:'Relating to Schools (water bottle filling stations)',desc:'Senate companion to HB2118.',ch:'S',refs:['HRE','WAM'],st:[2,2],camp:'c2',own:'KR',pos:'support',pri:1,touch:4,tc:0,comps:['HB2118'],
 ev:[['2026-08-03','introduced','','Introduced and passed First Reading.'],
     ['2026-08-05','introduced','HRE','Referred to HRE, WAM.'],
     ['2026-08-14','first_decking','WAM','The committee on HRE recommend that the measure be PASSED, WITH AMENDMENTS (SD 1). Referred to WAM.'],
     ['2026-08-31','first_decking','WAM','The committee on WAM recommend that the measure be PASSED, UNAMENDED.'],
     ['2026-09-09','first_crossover','','Passed Third Reading (SD 1). Transmitted to House.'],
     ['2026-09-12','second_lateral','EDN','Referred to EDN, FIN.'],
     ['2026-09-18','second_decking','FIN','The committee on EDN recommend that the measure be PASSED, WITH AMENDMENTS (HD 1). Referred to FIN.'],
     ['2026-10-01','second_decking','FIN','The committee on FIN recommend that the measure be PASSED, UNAMENDED.'],
     ['2026-10-07','second_crossover','','Passed Third Reading (HD 1). Returned to Senate.'],
     ['2026-10-08','second_crossover','','Senate agrees with House amendments.'],
     ['2026-10-12','governor','','Enrolled to Governor.'],
     ['2026-10-26','enacted','','Act 238, 10/26/2026.']],
 hr:[['2026-09-17T14:00:00-10:00','EDN','Conference Room 329','2026-09-14','2026-09-16T14:00:00-10:00']]},
{id:'m16',num:'SB2216',title:'Relating to Tobacco (statewide flavor standards; county rollback)',desc:'Sets weaker statewide flavor rules and rolls back stricter county ordinances.',ch:'S',refs:['CPN','WAM'],st:[2,2],camp:'c1',own:'NT',pos:'oppose',pri:1,touch:2,tc:1,
 ev:[['2026-08-03','introduced','','Introduced and passed First Reading.'],
     ['2026-08-05','introduced','CPN','Referred to CPN, WAM.'],
     ['2026-08-13','first_decking','WAM','The committee on CPN recommend that the measure be PASSED, WITH AMENDMENTS (SD 1). Referred to WAM.'],
     ['2026-09-01','first_decking','WAM','The committee on WAM recommend that the measure be PASSED, UNAMENDED.'],
     ['2026-09-09','first_crossover','','Passed Third Reading (SD 1). Transmitted to House.'],
     ['2026-09-11','second_lateral','CPC','Referred to CPC, JHA.'],
     ['2026-09-17','second_lateral','CPC','The committee on CPC recommend that the measure be PASSED, WITH AMENDMENTS (HD 1).'],
     ['2026-10-06','second_lateral','JHA','The committee on JHA deferred the measure.']],
 hr:[['2026-09-16T10:00:00-10:00','CPC','Conference Room 329','2026-09-12','2026-09-15T10:00:00-10:00']]},
];
// 47 ensemble bills, generated from compact archetype rows:
// [num, title, camp, own, pos, pri, type, c1, c2, d]
//   q1=first-chamber stall-out  dfloor=died at crossover  enact=fast-track Act
//   xw=crossed & waiting (radar)  xw3=crossed, triple-referred (red radar,
//   races the 2nd Triple filing Sep 18)  xh=hearing during Sep 15-18
//   xdef=deferred to death during Sep 15-18   d staggers dates/rooms.
const ENS = [
['HB2120','Relating to Sunscreen (reef-safe standards)','c3','SY','monitor',3,'q1','HLT','FIN',0],
['HB2121','Relating to Tobacco Taxes (e-liquid parity)','c1','KV','support',2,'q1','FIN','',1],
['HB2122','Relating to Physical Education (elementary minimums)','c2','SY','monitor',3,'q1','EDN','FIN',2],
['HB2123','Relating to Menu Labeling (chain restaurants)','c2','KR','monitor',3,'q1','CPC','FIN',3],
['HB2124','Relating to Smoke-Free Parks','c1','KV','support',3,'q1','HLT','JHA',4],
['HB2125','Relating to Farm to School (procurement targets)','c2','KR','support',2,'q1','AGR','FIN',5],
['HB2126','Relating to Health Equity (data disaggregation)','c3','NT','monitor',3,'q1','HLT','FIN',6],
['HB2143','Relating to Bicycles (safe passing education)','c3','SY','monitor',3,'q1','TRN','',2],
['SB2220','Relating to Sugar-Sweetened Beverages (excise)','c1','KV','support',2,'q1','WAM','',7],
['SB2221','Relating to Active Transportation (complete streets audits)','c3','SY','monitor',3,'q1','TRS','WAM',8],
['SB2222','Relating to Vaping (school possession diversion)','c1','KV','monitor',3,'q1','EDU','JDC',9],
['SB2223','Relating to Food Safety (cottage foods)','c2','SY','monitor',3,'q1','CPN','WAM',0],
['SB2224','Relating to Kupuna Health (fall prevention)','c2','NT','monitor',3,'q1','HHS','WAM',1],
['SB2242','Relating to Health Literacy (plain language standards)','c3','NT','monitor',3,'q1','HHS','',3],
['HB2127','Relating to Alcohol (outlet density)','c3','NT','support',2,'dfloor','CPC','FIN',2],
['HB2128','Relating to Housing and Health (mold standards)','c3','SY','monitor',3,'dfloor','HSG','FIN',3],
['HB2129','Relating to Emergency Medical Services (rural units)','c3','NT','monitor',3,'dfloor','HLT','FIN',6],
['SB2225','Relating to Pesticides (school buffer zones)','c2','KR','support',2,'dfloor','AEN','WAM',4],
['SB2226','Relating to Tobacco (retail license caps)','c1','KV','support',2,'dfloor','CPN','WAM',5],
['SB2227','Relating to Oral Health (school sealant program)','c2','KR','support',3,'dfloor','HHS','WAM',7],
['HB2130','Relating to Clean Water (cesspool conversion aid)','c3','SY','support',2,'xw','HLT','FIN',0],
['HB2131','Relating to Tobacco (online sales verification)','c1','KV','support',2,'xw','CPC','FIN',1],
['HB2132','Relating to Maternal Health (doula coverage)','c2','KR','support',1,'xw','HLT','FIN',2],
['HB2133','Relating to Parks (shade structure fund)','c3','SY','monitor',3,'xw','TRN','FIN',3],
['SB2228','Relating to Nutrition (produce prescription pilot)','c2','KR','support',2,'xw','HHS','WAM',4],
['SB2229','Relating to Tobacco Cessation (quitline funding)','c1','KV','support',2,'xw','HHS','WAM',5],
['SB2230','Relating to Traffic Safety (speed cameras)','c3','NT','support',2,'xw','TRS','WAM',6],
['SB2231','Relating to Behavioral Health (school counselors)','c2','KR','support',2,'xw','EDU','WAM',7],
['HB2134','Relating to Health Insurance (permanent telehealth parity)','c3','NT','support',1,'xw3','HLT','FIN',8],
['HB2135','Relating to Cannabis (youth prevention fund)','c1','KV','support',2,'xw3','JHA','FIN',9],
['SB2232','Relating to Firearm Injury Prevention (safe storage)','c3','NT','support',1,'xw3','JDC','WAM',0],
['SB2233','Relating to Climate and Health (heat plans for schools)','c2','KR','support',2,'xw3','EDU','WAM',1],
['HB2136','Relating to School Gardens (grant program)','c2','KR','support',2,'xh','EDN','FIN',0],
['HB2137','Relating to Lead (school water testing)','c3','SY','support',1,'xh','HLT','FIN',1],
['HB2138','Relating to Aging (age-friendly communities)','c2','KR','monitor',3,'xh','HSG','FIN',2],
['HB2139','Relating to Sun Safety (free sunscreen in parks)','c3','SY','support',3,'xh','CPC','FIN',3],
['SB2234','Relating to Youth Vaping (flavored liquid penalties)','c1','KV','support',1,'xh','CPN','WAM',0],
['SB2235','Relating to Food Banks (tax credit)','c2','KR','support',2,'xh','HHS','WAM',1],
['SB2236','Relating to Pedestrian Safety (crosswalk fund)','c3','NT','support',2,'xh','TRS','WAM',2],
['SB2237','Relating to Rural Health (mobile dental)','c2','KR','support',2,'xh','HHS','WAM',3],
['HB2140','Relating to Sugary Drinks (vending limits in state buildings)','c1','KV','support',2,'xdef','CPC','FIN',0],
['SB2238','Relating to Alcohol (happy hour advertising)','c3','NT','monitor',3,'xdef','CPN','WAM',1],
['HB2141','Relating to Tobacco 21 Enforcement (compliance checks)','c1','KV','support',2,'xdef','HLT','JHA',2],
['SB2239','Relating to School Health Aides','c2','KR','support',2,'xdef','EDU','WAM',3],
['HB2142','Relating to Emergency Appropriations (vector control)','c3','NT','support',3,'enact','FIN','',4],
['SB2240','Relating to Hospitals (disaster staffing compact)','c3','NT','support',2,'enact','HHS','',5],
['SB2241','Relating to Public Health Emergencies (lab capacity)','c2','KR','support',2,'enact','HHS','',6],
];
const ENS_H2 = [['HLT','FIN'],['CPC','FIN'],['JHA','FIN'],['HSG','WAL']];
const ENS_S2 = [['HHS','WAM'],['CPN','WAM'],['JDC','WAM'],['HRE','WAM']];
const ENS_H3 = [['HLT','CPC','FIN'],['EDN','JHA','FIN']];
const ENS_S3 = [['HHS','CPN','WAM'],['EDU','JDC','WAM']];
const ENS_ROOMS = ['Conference Room 308','Conference Room 329','Conference Room 229',
  'Conference Room 325','Conference Room 211','Conference Room 016'];
function expandEns(r) {
  const [num, title, camp, own, pos, pri, type, c1, c2, d] = r;
  const ch = num[0] === 'H' ? 'H' : 'S';
  const refs = c2 ? [c1, c2] : [c1];
  const a1 = ch === 'H' ? 'HD 1' : 'SD 1', a2 = ch === 'H' ? 'SD 1' : 'HD 1';
  const other = ch === 'H' ? 'Senate' : 'House';
  const dd = (m, day) => `2026-${String(m).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
  const firstRead = ch === 'H' ? 'Introduced and Pass First Reading.' : 'Introduced and passed First Reading.';
  const ev = [[dd(8, 3 + (d % 5)), 'introduced', '', firstRead],
    [dd(8, 5 + (d % 5)), 'introduced', c1, `Referred to ${refs.join(', ')}, referral sheet ${1 + (d % 6)}`]];
  const hr = [];
  let st = [refs.length, 0];
  const pass1 = () => ev.push([dd(8, 11 + (d % 5)), c2 ? 'first_decking' : 'first_decking', c2 || c1,
    `The committee on ${c1} recommend that the measure be PASSED, ${d % 2 ? `WITH AMENDMENTS (${a1}).` : 'UNAMENDED.'}${c2 ? ` Referred to ${c2}.` : ''}`]);
  const crossRun = () => {
    pass1();
    if (c2) ev.push([dd(9, 1 + (d % 3)), 'first_decking', c2,
      `The committee on ${c2} recommend that the measure be PASSED, UNAMENDED.`]);
    ev.push([dd(9, 8 + (d % 2)), 'first_crossover', '',
      `Passed Third Reading${d % 2 ? ` (${a1})` : ''}. Transmitted to ${other}.`]);
    const r2 = type === 'xw3' ? (ch === 'H' ? ENS_S3 : ENS_H3)[d % 2] : (ch === 'H' ? ENS_S2 : ENS_H2)[d % 4];
    ev.push([dd(9, 11 + (d % 2)), type === 'xw3' ? 'second_triple' : 'second_lateral', r2[0],
      `Referred to ${r2.join(', ')}.`]);
    st = [refs.length, r2.length];
    return r2;
  };
  if (type === 'q1') {
    if (c2 && d % 3) pass1();
  } else if (type === 'dfloor') {
    pass1();
    if (d % 2) ev.push([dd(9, 2 + (d % 3)), 'first_decking', c2 || c1,
      `The committee on ${c2 || c1} deferred the measure.`]);
    else {
      if (c2) ev.push([dd(9, 1 + (d % 3)), 'first_decking', c2,
        `The committee on ${c2} recommend that the measure be PASSED, UNAMENDED.`]);
      ev.push([dd(9, 9 + (d % 2)), 'dead', '', 'Failed to pass Third Reading. Ayes, 23; Noes, 28.']);
    }
  } else if (type === 'enact') {
    ev.push([dd(8, 9 + (d % 3)), 'first_decking', c1,
      `The committee on ${c1} recommend that the measure be PASSED, UNAMENDED. Public notice requirement waived.`]);
    ev.push([dd(8, 13 + (d % 3)), 'first_crossover', '', 'Passed Third Reading.']);
    ev.push([dd(8, 18 + (d % 3)), 'second_crossover', '', `Passed Final Reading in ${other}. Received notice of passage.`]);
    ev.push([dd(8, 22 + (d % 3)), 'governor', '', 'Enrolled to Governor.']);
    ev.push([dd(d % 2 ? 9 : 8, d % 2 ? 1 + (d % 4) : 27 + (d % 3)), 'enacted', '',
      `Act ${210 + d}, ${d % 2 ? '09/0' + (1 + (d % 4)) : '08/' + (27 + (d % 3))}/2026.`]);
  } else {   // xw, xw3, xh, xdef
    const r2 = crossRun();
    if (type === 'xh' || type === 'xdef') {
      const hDay = 15 + (d % 4), HH = [9, 10, 13, 14][d % 4];
      const iso = h => `2026-09-${h}T${String(HH).padStart(2,'0')}:00:00-10:00`;
      hr.push([iso(hDay), r2[0], ENS_ROOMS[d % 6], dd(9, hDay - 3), iso(hDay - 1)]);
      if (type === 'xdef')
        ev.push([dd(9, hDay), 'second_lateral', r2[0], `The committee on ${r2[0]} deferred the measure.`]);
      else
        ev.push([dd(9, hDay + 1), 'second_decking', r2[1],
          `The committee on ${r2[0]} recommend that the measure be PASSED, ${d % 2 ? `WITH AMENDMENTS (${a2}).` : 'UNAMENDED.'} Referred to ${r2[1]}.`]);
    }
  }
  const touch = pos === 'monitor' ? (d % 2 ? null : 12 + (d % 9)) : (d * 3) % 15;
  const tc = pos !== 'monitor' && d % 3 === 0 ? 1 : 0;
  return { id: 'e' + num, num, title, ch, refs, st, camp, own, pos, pri, touch, tc, ev, hr };
}
const TEAM_TL = [
  ['m1','KV','testimony','Testimony submitted — Support (written + oral)','HLT hearing, 42 co-signers on org letter','2026-08-12T10:00:00-10:00'],
  ['m2','SY','coalition','CTFH coalition call — companion strategy','Agreed SB2201 is backup vehicle if House side stalls','2026-08-21T14:00:00-10:00'],
  ['m7','NT','action_alert','Action alert sent — OPPOSE HB2107','1,200 recipients; asks calls to JHA members before hearing','2026-08-21T09:00:00-10:00'],
  ['m4','SY','note','Post-mortem: floor vote lost 24-27','Pivoting effort to SB2204 (companion). Talking to TRS chair.','2026-08-20T16:00:00-10:00'],
];
function buildScenario(nowMs) {
  const T = d => new Date(d.length > 10 ? d : d + 'T08:00:00-10:00').getTime();
  const bills = [], hearings = [], tl = [], since = [], pulse = {},
        assignments = {}, billCampaigns = {}, compStage = {};
  let hid = 0;
  for (const s of SCRIPT.concat(ENS.map(expandEns))) {
    const past = s.ev.filter(e => T(e[0]) <= nowMs);
    if (!past.length) continue;
    const cur = past[past.length - 1];
    bills.push({ id: s.id, bill_number: s.num, title: s.title, description: s.desc || null,
      stage: cur[1], committee: cur[2] || null, last_action: cur[3], last_action_date: cur[0],
      referrals: s.refs, origin_stops: s.st[0], second_stops: s.st[1],
      companions: s.comps || [], sponsors: s.spon || [], position: s.pos, priority: s.pri,
      session_year: 2026, state_url: 'https://www.capitol.hawaii.gov', tracked: true });
    compStage[s.num] = cur[1];
    assignments[s.id] = [s.own]; billCampaigns[s.id] = [s.camp];
    if (s.touch != null) pulse[s.id] = {
      last_team_touch: new Date(nowMs - s.touch * 864e5).toISOString(), testimony_count: s.tc };
    for (const h of s.hr) if (T(h[3]) <= nowMs && new Date(h[0]).getTime() >= nowMs - 864e5)
      hearings.push({ id: 'mh' + (hid++), bill_id: s.id, committee: h[1],
        scheduled_at: h[0], room: h[2], testimony_deadline: h[4], status: 'scheduled',
        notice_posted_at: h[3] + 'T16:00:00-10:00' });
    for (const e of past) {
      tl.push({ bill_id: s.id, type: 'status_auto', title: e[3],
        details: 'Official action - ' + (s.ch === 'S' ? 'Senate' : 'House'),
        occurred_at: e[0] + 'T08:00:00-10:00', source: 'auto' });
      if (T(e[0]) > nowMs - 3 * 864e5)
        since.push({ bill_id: s.id, title: e[3], occurred_at: e[0] + 'T08:00:00-10:00' });
    }
  }
  for (const [bid, adv, type, title, details, at] of TEAM_TL)
    if (new Date(at).getTime() <= nowMs)
      tl.push({ bill_id: bid, advocate_id: adv, type, title, details, occurred_at: at, source: 'team' });
  tl.sort((a, b) => b.occurred_at.localeCompare(a.occurred_at));
  return { bills, hearings, tl, since, pulse, assignments, billCampaigns, compStage };
}
// ===SCENARIO-END===
let DEMO_TL = [];
function demoInit() {
  const A = (n,i,c,e,adm,rev) => ({ id:i, full_name:n, initials:i, color:c, email:e, is_admin:!!adm, is_reviewer:!!rev, is_active:true });
  S.advocates = [A('Nate','NT','#0E7C86','nate@hiphi.org',1), A('Kevin','KV','#5B7FBF','kevin@hiphi.org'),
                 A('Saya','SY','#3E8E63','saya@hiphi.org'), A('Kris','KR','#7E5BA6','kris@hiphi.org'),
                 A('Jess','JS','#B45309','jessica@hiphi.org',0,1), A('Jaylen','JN','#BE185D','jaylen@hiphi.org',0,1)];
  S.me = S.advocates[0];
  S.campaigns = [{id:'c1',name:'CTFH',slack_channel:'#ctfh'},{id:'c2',name:'HEAL',slack_channel:'#heal'},{id:'c3',name:'General HIPHI'}];
  S.slackCfg = { main_channel: '#hearing-alerts-2027', positions: ['support','support_amend','oppose','neutral'], workflow_dm: true, health_dm: true,
    reminder_defaults: { morning: '08:35', morning_on: true, hours_before: 1, before_on: true, after: '16:00', after_on: true },
    daily: { enabled: true, time: '07:00', days_ahead: 7, channel: null, post_when_empty: false },
    templates: { hearing_alert: '📅 *{{bill}}* · {{position}}{{priority}}{{owner}}\n{{title}}\n{{committee}} hearing · {{hearing}} · {{room}}\nWritten testimony due *{{deadline}}*\n<{{tracker}}|Open in tracker> · <{{pdf}}|Notice PDF>',
      draft_thread: '📝 Draft ready{{owner_for}}: <{{draft}}|Google Doc> · <{{tracker}}|tracker>' } };
  const sc = buildScenario(Date.now());
  S.bills = sc.bills; S.hearings = sc.hearings; S.pulse = sc.pulse;
  // Production bills carry an official description (521 of 522); the
  // scripted scenario does not, so give each one a sentence to render.
  for (const b of S.bills) b.description ||= `Establishes requirements and appropriates funds ${b.title.replace(/^Relating to /i, 'relating to ')}. (sandbox description)`;
  // Committee names and chairs for the sandbox's common codes (illustrative).
  S.committees = {
    HLT: { code: 'HLT', name: 'Health', chair: 'Rep. Demo Chair', vice_chair: 'Rep. Demo Vice' },
    CPC: { code: 'CPC', name: 'Consumer Protection & Commerce', chair: 'Rep. Demo Chair' },
    FIN: { code: 'FIN', name: 'Finance', chair: 'Rep. Demo Chair', vice_chair: 'Rep. Demo Vice' },
    JDC: { code: 'JDC', name: 'Judiciary', chair: 'Sen. Demo Chair' },
    WAM: { code: 'WAM', name: 'Ways and Means', chair: 'Sen. Demo Chair' },
  };
  // A testimony draft on the soonest upcoming hearing, so the drawer section
  // and the Desk link have something to show in the sandbox.
  // Seeded on the first bill (same one the To do seed uses) so the drawer
  // always has a Testimony section to show; the committee is that bill's
  // soonest hearing if it has one, so the Desk link appears too when that
  // hearing is inside the 48-hour window.
  S.drafts = {};
  if (S.bills[0]) {
    const b0 = S.bills[0];
    const h0 = sc.hearings.filter(h => h.bill_id === b0.id)
      .sort((a, b) => new Date(a.scheduled_at) - new Date(b.scheduled_at))[0];
    // In review, from Kevin: the admin (you, in demo) gets Approve / Request changes.
    S.drafts[b0.id] = [{ id: 'dd1', bill_id: b0.id, committee: h0 ? h0.committee : (b0.committee || 'FIN'),
      status: 'review', submitted_by: 'KV', submitted_at: new Date(Date.now() - 3 * 36e5).toISOString(),
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
    if (!approvedSeeded && (sc.assignments[h.bill_id] || []).includes('NT')) { st = 'approved'; approvedSeeded = true; }
    const ago = h => new Date(Date.now() - h * 36e5).toISOString();
    (S.drafts[h.bill_id] ??= []).push({ id: 'dd' + n++, bill_id: h.bill_id, committee: h.committee,
      status: st, doc_url: 'https://docs.google.com/document/d/demo' + n + '/edit',
      created_at: ago(30), submitted_by: st === 'draft' ? null : 'KR', submitted_at: st === 'draft' ? null : ago(20),
      approved_by: ['approved', 'filed', 'second_review'].includes(st) ? 'NT' : null, approved_at: ago(10),
      second_approved_by: st === 'filed' ? 'JS' : null, second_approved_at: ago(6),
      filed_by: st === 'filed' ? 'KR' : null, filed_at: st === 'filed' ? ago(2) : null,
      review_note: st === 'draft' ? 'Cite the 2024 BRFSS numbers in paragraph two.' : null });
  }
  S.assignments = sc.assignments; S.billCampaigns = sc.billCampaigns;
  // Seed the To do section so the sandbox shows all three states: overdue,
  // upcoming, and finished.
  const day = n => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
  S.todos = {};
  if (S.bills[0]) S.todos[S.bills[0].id] = [
    { id: 'td1', bill_id: S.bills[0].id, title: 'Draft testimony for WAM hearing',
      done: false, due_date: day(-2), assignee_id: S.advocates[0].id, sort_order: 0,
      created_at: new Date().toISOString() },
    { id: 'td2', bill_id: S.bills[0].id, title: 'Confirm coalition sign-ons',
      done: false, due_date: day(4), assignee_id: S.advocates[1].id, sort_order: 1,
      created_at: new Date().toISOString() },
    { id: 'td3', bill_id: S.bills[0].id, title: 'Send one-pager to committee staff',
      done: true, due_date: null, assignee_id: S.advocates[2].id, sort_order: 2,
      created_at: new Date().toISOString() },
  ];
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
  if (S.owner === 'me' && S.me) list = list.filter(b => (S.assignments[b.id]||[]).includes(S.me.id));
  else if (S.owner && S.owner !== 'all' && S.owner !== 'me')
    list = list.filter(b => (S.assignments[b.id]||[]).includes(S.owner));
  if (S.pri) list = list.filter(b => String(b.priority) === S.pri);
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
const MORE_VIEWS = [['desk','Desk'],['pipeline','Pipeline'],['table','Table'],['cards','Cards'],['settings','Settings']];
function filterSummary() {
  const who = S.owner === 'me' ? 'My bills' : S.owner === 'all' ? 'All tracked' : (advocate(S.owner)?.full_name || '');
  return [who, S.q ? `“${S.q}”` : null, S.pri ? 'P' + S.pri : null,
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
      <span class="fresh"${stale ? ' style="color:#C2483B;font-weight:600" title="The daily sync has not completed successfully recently - data may be stale"' : ''}>${SESSION_YEAR} session · ${S.bills.length} tracked · ${freshTxt}</span>
      <span class="who">${av(S.me)}<button id="logout">sign out</button></span>
    </div>
    ${banner}
    <div class="ftoggle"><button class="fchip ${S.filtersOpen?'on':''}" id="ftoggle">${esc(filterSummary())} · filters ${S.filtersOpen?'▴':'▾'}</button></div>
    <div class="filters${S.filtersOpen?' open':''}">
      <input type="search" id="q" placeholder="Search bill # or title…" value="${esc(S.q)}">
      <button class="fchip ${S.owner==='me'?'on':''}" data-owner="me">My bills</button>
      <button class="fchip ${S.owner==='all'?'on':''}" data-owner="all">All tracked</button>
      <span class="ownerchips">${S.advocates.map(a =>
        av(a, 'avatar ' + (S.owner===a.id?'on':'')).replace('class="','data-owner="'+a.id+'" class="')).join('')}</span>
      <select id="prif" style="width:auto"><option value="">Priority: all</option>
        ${[1,2,3].map(p=>`<option ${S.pri==p?'selected':''} value="${p}">P${p}</option>`).join('')}</select>
      <select id="stagef" style="width:auto"><option value="">Stage: all</option>
        ${STAGES.map(([v,l])=>`<option ${S.stageF===v?'selected':''} value="${v}">${l}</option>`).join('')}</select>
      <button class="fchip ${S.tripleF?'on':''}" id="triplef" title="Only bills with a triple referral (3+ committee stops in one chamber)">3X only</button>
      <span class="spacer"></span>
      ${S.view==='table' ? '<button class="fchip" id="csv">⬇ Export CSV</button>' : ''}
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
  const dl = nextDeadline(b);
  if (dl) return dl;
  const st = effStage(b);
  const key = st === 'introduced' ? (isTriple(b) ? 'first_triple' : 'first_lateral') : st;
  const last = (DEADLINES[key] || []).slice(-1)[0];
  return last ? { label: last[0], date: last[1], days: Math.ceil((new Date(last[1] + 'T23:59:59-10:00') - Date.now()) / 864e5), missed: true } : null;
}
function pfBoard(list) {
  const cur = currentDeadline();
  if (SESSION_OVER || !cur) return { html: '', a: [], b: [], c: [] };
  const now = Date.now();
  const alive = list.filter(b => b.position !== 'monitor' && !diedish(b) && !['enacted', 'vetoed', 'dead', 'governor'].includes(effStage(b)));
  const hearingFor = b => S.hearings.filter(h => h.bill_id === b.id && h.status !== 'cancelled' &&
      new Date(h.scheduled_at) > now - 10 * 864e5)
    .sort((x, y) => x.scheduled_at.localeCompare(y.scheduled_at))
    .find(h => new Date(h.scheduled_at) > now || !b.last_action_date || b.last_action_date < h.scheduled_at.slice(0, 10));
  // A: in a committee phase, no hearing on the books (racing its own next deadline,
  //    or already past it). B: hearing scheduled or just held. C: nothing to race
  //    right now - past the committees for this leg (floor, crossover, conference).
  const a = [], bcol = [], c = [];
  for (const b of alive) {
    const h = hearingFor(b);
    const inCommittee = RADAR_STAGES.includes(effStage(b));
    if (h) { bcol.push({ b, h, dl: billDeadline(b) }); continue; }
    if (inCommittee) { a.push({ b, dl: billDeadline(b) || cur }); continue; }
    c.push({ b, dl: cur });
  }
  const days = d => Math.ceil((new Date(d + 'T23:59:59-10:00') - now) / 864e5);
  // Within a priority: closest approaching deadline first; already-missed ones last.
  const race = x => x.dl.missed ? 9999 : days(x.dl.date);
  a.sort((x, y) => byPri(x, y) || race(x) - race(y) || x.b.bill_number.localeCompare(y.b.bill_number));
  bcol.sort((x, y) => byPri(x, y) || x.h.scheduled_at.localeCompare(y.h.scheduled_at));
  c.sort((x, y) => byPri(x, y) || (y.b.last_action_date || '').localeCompare(x.b.last_action_date || '') || x.b.bill_number.localeCompare(y.b.bill_number));
  const more = S.boardMore || {};
  const col = (key, icon, title, sub, rows, rowFn, empty) => {
    const shown = more[key] ? rows : rows.slice(0, BOARD_CAP);
    return `<div class="panel bcol bcol-${key}" id="pf-board-${key}"><div class="ph"><span>${icon} ${title} <span class="cnt">${rows.length}</span></span><span class="psub">${sub}</span></div>
      ${rows.length ? `<div class="chips">${shown.map(rowFn).join('')}</div>` : `<div class="pempty">${empty}</div>`}
      ${rows.length > BOARD_CAP ? `<button class="pempty boardmore" data-boardmore="${key}">${more[key] ? 'Show fewer' : `…and ${rows.length - BOARD_CAP} more`}</button>` : ''}
    </div>`;
  };
  const who = b => owners(b)[0] ? av(owners(b)[0], 'avatar sm') : '';
  const pri = b => b.priority ? `<span class="pri">P${b.priority}</span>` : '';
  const html = `
    <div class="dashhead boardhead"><h1>Where every bill stands</h1>
      <span class="sub">Next deadline: <b>${esc(cur.label)}</b> · ${fmtDate(cur.date)} · <b>${days(cur.date)}d</b> away. Each bill shows the deadline it is racing; bills re-sort as dates pass.</span></div>
    <div class="board3">
      ${col('a', '📡', 'Needs a hearing', 'in committee, nothing scheduled', a, ({ b, dl }) => `
        <div class="chip3 ${posCls(b)}${priCls(b)}" data-bill="${b.id}">
          <span class="l1"><b>${esc(b.bill_number)}</b>${pri(b)}<span class="cm">${esc(b.committee || '—')}</span>${who(b)}</span>
          <span class="ldesc">${esc(blurb(b, 120))}</span>
          <span class="l2">${dl.missed ? `<span class="hot">missed ${esc(dl.label)} ${fmtDate(dl.date)}</span>`
            : days(dl.date) <= 5 ? `<span class="hot">${esc(dl.label)} in ${days(dl.date)}d</span>`
            : `${esc(dl.label)} ${fmtDate(dl.date)} · ${days(dl.date)}d`}</span>
        </div>`, 'Every live bill in committee has a hearing on the books. 🤙')}
      ${col('b', '◷', 'Hearing scheduled', 'or held, awaiting the committee', bcol, ({ b, h }) => `
        <div class="chip3 ${posCls(b)}${priCls(b)}" data-bill="${b.id}">
          <span class="l1"><b>${esc(b.bill_number)}</b>${pri(b)}<span class="cm">${esc(h.committee)}</span>${who(b)}</span>
          <span class="ldesc">${esc(blurb(b, 120))}</span>
          <span class="l2">${new Date(h.scheduled_at) > now ? fmtDT(h.scheduled_at) : 'held ' + fmtDate(h.scheduled_at)}${draftChip(b)}</span>
        </div>`, 'No hearings on the books for this deadline.')}
      ${col('c', '✅', 'Cleared committee', 'no hearing needed until the next stage', c, ({ b }) => `
        <div class="chip3 ${posCls(b)}${priCls(b)}" data-bill="${b.id}" title="${esc(b.last_action || '')}">
          <span class="l1"><b>${esc(b.bill_number)}</b>${pri(b)}<span class="cm">${STAGE_LABEL[effStage(b)]}</span>${who(b)}</span>
          <span class="ldesc">${esc(blurb(b, 120))}</span>
          <span class="l2">${esc((b.last_action || '').slice(0, 60))}${b.last_action_date ? ' · ' + fmtDate(b.last_action_date) : ''}</span>
        </div>`, 'Nothing has cleared this deadline yet.')}
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

  // ---------- search mode: every bill, not just this lens ----------
  const q = S.q.trim();
  if (q.length >= 2) {
    const ql = q.toLowerCase(), qn = ql.replace(/\s/g,'');
    const hit = b => b.bill_number.toLowerCase().includes(qn) || (b.title||'').toLowerCase().includes(ql);
    const tracked = S.bills.filter(hit).slice(0, 30);
    const sa = S.searchAll || {};
    const untracked = sa.q === q ? (sa.rows || []) : null;
    const row = b => `<div class="prow" data-bill="${b.id}">
        <div class="pmain"><b>${esc(b.bill_number)}</b> ${esc(b.title||'')}
          <div class="psmall">${statusChip(b)}${owners(b)[0] ? ' · ' + esc(owners(b)[0].full_name) : ' · no owner'}${b.position ? ' · ' + esc(POSITIONS.find(p=>p[0]===b.position)?.[1]||'') : ''}</div></div>
        <span class="dkav">${owners(b)[0] ? av(owners(b)[0]) : ''}</span></div>`;
    return head(`Search: “${esc(q)}”`, `${tracked.length} tracked match${tracked.length===1?'':'es'} · ${untracked ? untracked.length + ' not tracked yet' : 'looking through every bill…'}`) + `
      <div class="dash one">
        <div>
          ${panel('pf-hits', '✓ Tracked', 'already on the tracker, any owner', tracked.map(row).join(''), 'No tracked bill matches.')}
          ${panel('pf-untracked', '＋ Not tracked yet', 'every measure in the session · tap Track to add it',
            DEMO ? `<div class="pempty">The sandbox holds only its 64 scripted bills; in the live app this lists every introduced measure that matches.</div>`
            : q.length < 3 ? `<div class="pempty">Type at least 3 characters to search bills that are not tracked yet.</div>`
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
  const hearingFor = d => S.hearings.find(h => h.id === d.hearing_id) ||
    S.hearings.filter(h => h.bill_id === d.bill_id && h.committee === d.committee && new Date(h.scheduled_at) > new Date())
      .sort((a,b) => a.scheduled_at.localeCompare(b.scheduled_at))[0] || null;
  const waiting = Object.values(S.drafts).flat().filter(d => d.status !== 'cancelled').map(d => {
    const b = bill(d.bill_id); if (!b || b.position === 'monitor') return null;
    const why = d.status === 'review' && me.is_admin ? 'Waiting for your approval'
      : d.status === 'second_review' && me.is_reviewer ? 'Needs your approval (first testimony on this bill)'
      : d.status === 'approved' && (isMine(b) || d.submitted_by === me.id || me.is_admin) ? 'Approved — file it at the Capitol'
      : d.status === 'draft' && d.review_note && d.submitted_by === me.id ? 'Sent back: ' + d.review_note
      : d.status === 'draft' && !d.submitted_at && isMine(b) ? 'Draft ready — write it, then submit for review'
      : null;
    if (!why) return null;
    const h = hearingFor(d);
    return { d, b, why, h, t: h?.testimony_deadline ? +new Date(h.testimony_deadline) : h ? +new Date(h.scheduled_at) : Infinity };
  }).filter(Boolean).sort((x,y) => byPri(x, y) || x.t - y.t);
  const WAIT_CAP = 8;
  const verbOf = d => d.status === 'review' ? 'Approve' : d.status === 'second_review' ? 'Second approval'
    : d.status === 'approved' ? 'File' : d.review_note ? 'Revise' : 'Write';
  const waitingHtml = waiting.slice(0, WAIT_CAP).map(({ d, b, why, h }) => { const soon = h?.testimony_deadline && hrsLeft(h.testimony_deadline) < 48; return `
    <div class="prow wrow ${posCls(b)}${priCls(b)}" data-bill="${b.id}">
      ${draftActionBtn(b, d.committee)}
      <div class="pmain"><b class="verb">${verbOf(d)}</b> ${esc(b.bill_number)} · ${esc(d.committee)}
        <div class="pdesc">${esc(blurb(b, 110))}</div>
        <div class="psmall">${esc(why)}${h ? ` · hearing ${fmtDT(h.scheduled_at)}${h.testimony_deadline ? ` · due in <b${soon ? ' class="hot"' : ''}>${hrsLeft(h.testimony_deadline)}h</b>` : ''}` : ''}</div></div>
    </div>`; }).join('') + (waiting.length > WAIT_CAP ? `<div class="pempty">…and ${waiting.length - WAIT_CAP} more</div>` : '');

  // ---------- this week: each bill once ----------
  const hUp = S.hearings.filter(h => ids.has(h.bill_id) && new Date(h.scheduled_at) > new Date())
    .sort((a,b) => a.scheduled_at.localeCompare(b.scheduled_at));
  const due = hUp.filter(h => h.testimony_deadline && new Date(h.testimony_deadline) - now < 48*3600e3);
  const weekByBill = new Map();
  for (const h of hUp) if (new Date(h.scheduled_at) < new Date(wk) && !weekByBill.has(h.bill_id)) weekByBill.set(h.bill_id, h);
  const week = [...weekByBill.values()].sort((a,b) =>
    (a.testimony_deadline || a.scheduled_at).localeCompare(b.testimony_deadline || b.scheduled_at));
  const isNew = h => h.notice_posted_at && new Date(h.notice_posted_at).getTime() > S.sinceVisit;
  // Calendar layout: seven day blocks starting today, hearings under each.
  const hstDay = d => new Date(d).toLocaleDateString('en-CA', { timeZone: 'Pacific/Honolulu' });
  const dayLabel = iso => new Date(iso + 'T12:00:00-10:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'Pacific/Honolulu' });
  const days7 = [...Array(7)].map((_, i) => hstDay(now + i * 864e5));
  const weekRow = h => { const b = bill(h.bill_id); if (!b) return '';
    const dueSoon = h.testimony_deadline && hrsLeft(h.testimony_deadline) < 48;
    const past = h.testimony_deadline && new Date(h.testimony_deadline) < now;
    return `
    <div class="prow calrow ${posCls(b)}${priCls(b)}" data-bill="${b.id}">
      <span class="caltime">${new Date(h.scheduled_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'Pacific/Honolulu' })}${isNew(h) ? '<span class="tag n">NEW</span>' : ''}</span>
      <div class="pmain"><b>${esc(b.bill_number)}</b> · ${esc(h.committee)} · ${esc(clean(h.room))}${draftChip(b)}
        <div class="pdesc">${esc(blurb(b, 96))}</div>
        <div class="psmall">${h.testimony_deadline ? (past ? 'testimony deadline passed' : `testimony due in <b${dueSoon ? ' class="hot"' : ''}>${hrsLeft(h.testimony_deadline)}h</b>`) : ''}</div></div>
      <div class="calbtns">${draftActionBtn(b, h.committee)}
      <a class="btn sm ghost" href="${esc(capitolUrl(b))}" target="_blank" rel="noopener" onclick="event.stopPropagation()">Capitol ↗</a></div>
    </div>`; };
  const clean = r => (r || 'room TBD').replace(/\s*via videoconference/i, '').replace(/^Conference Room\s+/i, 'Rm ');
  const railParts = iso => { const dt = new Date(iso + 'T12:00:00-10:00');
    return [dt.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'Pacific/Honolulu' }), dt.getDate()]; };
  const weekHtml = week.length ? `<div class="calweek">` + days7.map((d, i) => {
    const hs = week.filter(h => hstDay(h.scheduled_at) === d).sort((x, y) => x.scheduled_at.localeCompare(y.scheduled_at));
    const [dow, dom] = railParts(d);
    return `<div class="calday${hs.length ? '' : ' nohear'}${i === 0 ? ' today' : ''}">
      <div class="calrail"><span class="dow">${dow}</span><span class="dom">${dom}</span>${i === 0 ? '<span class="tod">today</span>' : ''}${hs.length ? `<span class="cnt">${hs.length}</span>` : ''}</div>
      <div class="calbody">${hs.length ? hs.map(weekRow).join('') : '<div class="calnone">no hearings</div>'}</div></div>`; }).join('') + `</div>` : '';

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
        <div class="tltext"><b>${esc(b.bill_number)}</b> ${esc((ev.title || '').slice(0, 90))}${a ? ` <span class="tlwho">${esc(a.full_name)}</span>` : ''}<span class="tltitle">${esc(blurb(b, 80))}</span></div>
      </div>`; }).join('')}</div>
      ${recent.length > REC_CAP ? `<button class="pempty boardmore" data-boardmore="recent">${recMore ? 'Show fewer' : `…and ${recent.length - REC_CAP} more`}</button>` : ''}
    </div>` : '';

  const board = pfBoard(list);

  // ---------- needs a touch, team activity: only when there is something ----------
  const feed = (S.feed||[]).filter(ev => ids.has(ev.bill_id)).slice(0, 3);
  const feedHtml = feed.length ? panel('pf-feed', '✎ Latest team activity', 'across this portfolio',
    feed.map(ev => { const b = bill(ev.bill_id), a = advocate(ev.advocate_id); return `
      <div class="prow" data-bill="${ev.bill_id}">
        ${av(a)}<div class="pmain"><b>${esc(ev.title)}</b>
          <div class="psmall">${esc(b?.bill_number||'')} · ${a?esc(a.full_name):''} · ${fmtDT(ev.occurred_at)}</div></div></div>`; }).join('')) : '';
  const moved = list.filter(b => b.last_action_date && (now - new Date(b.last_action_date)) < 7*day);

  const right = recentHtml + feedHtml;
  return head(`${esc(who)}'s Portfolio`, `${today} · ${list.length} bill${list.length===1?'':'s'}${waiting.length ? ` · <b style="color:var(--red)">${waiting.length} waiting on you</b>` : ''}`) + `
    <div class="stats pf">
      <button class="stat ${due.length?'warn':''}" data-jump="pf-week"><div class="v">${due.length}</div><div class="l">Testimony due (48h)</div></button>
      <button class="stat" data-jump="pf-week"><div class="v">${week.length}</div><div class="l">Hearings next 7 days</div></button>
      <button class="stat" data-jump="pf-recent"><div class="v">${recent.length}</div><div class="l">Actions, last 72h</div></button>
      <button class="stat ${board.a.length?'warn':''}" data-jump="pf-board-a"><div class="v">${board.a.length}</div><div class="l">Need a hearing</div></button>
    </div>
    <div class="dash${right ? '' : ' one'}">
      <div>
        ${waiting.length ? panel('pf-wait', '✋ Waiting on you', 'across the whole team, whatever the lens', waitingHtml, '').replace('class="panel"', 'class="panel sec-wait"') : ''}
      </div>
      ${right ? `<div>${right}</div>` : ''}
    </div>
    <div class="calwrap">${panel('pf-week', '◷ This week', 'each bill once · hearing, deadline, and the draft’s next step', weekHtml,
      SESSION_OVER ? 'Session is over — hearings return when the next session convenes.' : 'No hearings on these bills in the next 7 days.')}</div>
    ${board.html}`;
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
function dkRail(b) {
  const dead = diedish(b);
  let idx = DK_RAIL_IDX[effStage(b)]; if (idx == null) idx = 0;
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
const SESSION_OVER = DEMO ? false : true;   // flip false when the 2027 session convenes
// Official session calendar (LRB, 2026). One place to update each December.
// Demo mode runs the mock training session (Aug 3 - Oct 30) instead.
const DEADLINES = DEMO ? {
  introduced:       [['Intro cutoff','2026-08-14']],
  first_triple:     [['Triple filing','2026-08-21']],
  first_lateral:    [['Lateral','2026-08-28']],
  first_decking:    [['Decking','2026-09-04']],
  first_crossover:  [['Crossover','2026-09-10']],
  second_triple:    [['Triple filing','2026-09-18']],
  second_lateral:   [['Lateral','2026-09-25']],
  second_decking:   [['Decking','2026-10-02']],
  second_crossover: [['Cross back','2026-10-08']],
  conference:       [['Final decking','2026-10-23'],['Fiscal','2026-10-26']],
  governor:         [['Sine die','2026-10-30']],
} : {
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
// Dying-quietly radar: committee stages where "no hearing scheduled" is the
// death signal, and the deadline each stage races. Bills still at Introduced
// race the lateral (or triple, if 3X) filing date.
const RADAR_DAYS = 14;
const RADAR_STAGES = ['introduced','first_triple','first_lateral','first_decking',
                      'second_triple','second_lateral','second_decking'];
const nextDeadline = b => {
  const st = effStage(b);
  if (!RADAR_STAGES.includes(st)) return null;
  const key = st === 'introduced' ? (isTriple(b) ? 'first_triple' : 'first_lateral') : st;
  const fut = (DEADLINES[key] || []).filter(([, d]) => new Date(d + 'T23:59:59-10:00') > new Date());
  if (!fut.length) return null;
  const [label, date] = fut[0];
  return { label, date, days: Math.ceil((new Date(date + 'T23:59:59-10:00') - Date.now()) / 864e5) };
};
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
  if (p === 'support' || p === 'support_amend' || p === 'oppose' || p === 'neutral') return 1;
  return 2;                                                                 // monitor / unset
};
const posLabel = b => {
  const strong = b.priority === 1 ? 'STRONGLY ' : '';
  return { support: strong + 'SUPPORT', support_amend: 'SUPPORT W/ AMENDMENTS',
    oppose: strong + 'OPPOSE', neutral: 'COMMENT', monitor: 'MONITOR' }[b.position] || 'MONITOR';
};
const headClass = b => {
  const p = b.position;
  if (tierOf(b) === 0) return p === 'oppose' ? 'solid-r' : 'solid-g';
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
const WORKFLOW_KINDS = [['draft_created', 'A draft was created for one of my bills'],
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
    <section id="st-conn">
      <h2>Connections <span class="tag a">admin</span></h2>
      <p class="tok">Keys are saved write-only: once saved they show as set, never shown again. Leave a field blank to keep what is there; type <b>clear</b> to remove it.</p>
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
function timelineHTML(tl) {
  if (!tl.length) return `<div style="color:var(--muted);font-size:12.5px">No activity yet.</div>`;
  return `<div class="tl">${tl.map(ev => {
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
// A bill number is easy to forget; every home-page row carries the plain-language
// summary (public summary, else the official description, else the title).
const blurb = (b, n = 90) => { const t = (b.public_summary || b.description || b.title || '').replace(/\s+/g, ' ').trim();
  return t.length > n ? t.slice(0, n - 1).replace(/\s\S*$/, '') + '…' : t; };
const priCls = b => b.priority === 1 ? ' p3' : '';   // class name kept; P1 rows are double height
// Default order everywhere on the home page: priority first, then the closest deadline.
const byPri = (x, y) => (x.b.priority || 9) - (y.b.priority || 9);
// Left-edge stripe by position: the same bill looks the same in every section.
const posCls = b => ({ support: 'pos-support', support_amend: 'pos-support', oppose: 'pos-oppose',
  neutral: 'pos-neutral', monitor: 'pos-monitor' }[b.position] || 'pos-none');
// Status priority for the one chip a Desk row can afford.
const DRAFT_RANK = { approved: 5, second_review: 4, review: 3, draft: 2, filed: 1 };
function draftChip(b) {
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
  let idx = DK_RAIL_IDX[effStage(b)]; if (idx == null) idx = 0;
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
  let idx = DK_RAIL_IDX[effStage(b)]; if (idx == null) idx = 0;
  const s = DK_RAIL_STAGES[idx + 1];
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
  // Top: where the bill stands and what it does. Then testimony and to-dos.
  // Team settings, details and the editors fold away. Timeline last, led by
  // what comes next.
  if (S.drawerOpen.bill !== b.id)
    S.drawerOpen = { bill: b.id, pub: false, notes: false, details: false, team: false, todo: false };
  const open = S.drawerOpen;
  const notesHead = (b.internal_notes || '').trim().split('\n')[0].slice(0, 70);
  const owner = owners(b)[0];
  const coalitions = (S.billCampaigns[b.id] || []).map(id => S.campaigns.find(c => c.id === id)?.name).filter(Boolean);
  const teamHint = [POSITIONS.find(p => p[0] === (b.position || ''))?.[1] || '—',
    b.priority ? 'P' + b.priority : null, owner ? owner.full_name : null, ...coalitions].filter(Boolean).join(' · ');
  const text = b.public_summary || b.description || '';
  return `<div class="scrim" id="scrim"></div>
  <div class="drawer">
    <div class="dhead">
      <button class="close" id="dclose">✕</button>
      <h2>${esc(b.bill_number.replace(/^(\D+)/,'$1 '))}${b.position ? `<span class="chipx poschip ${POS_CLS[b.position] || 'c-gray'}">${esc(POSITIONS.find(p => p[0] === b.position)?.[1] || b.position)}</span>` : ''}</h2>
      <div class="sub">${esc(b.title||'')}</div>
    </div>
    <div class="dbody">
      <div class="status">
        <div class="stagenow">${STAGE_LABEL[effStage(b)]}${b.stage_override?' <span class="ovr">manual override</span>':''}
          <span class="lastact">${esc(b.last_action||'')} <span class="when">${b.last_action_date ? fmtDate(b.last_action_date,{year:'2-digit'}) : ''}</span></span></div>
        ${stageCalHTML(b)}
        ${nextHTML(b)}
      </div>
      <div class="sec">Bill summary</div>
      ${text ? `<p class="desc">${esc(text)}</p>` : '<p class="desc"><i>No summary yet.</i></p>'}
      <div class="pubnote${pubStateCls(b).includes('warn') ? ' warn' : ''}">${esc(pubStateText(b))}</div>
      ${draftsHTML(b)}
      ${todosHTML(b)}
      <details class="dsec" id="d-teamsec" ${open.team ? 'open' : ''}>
        <summary><span class="sec">Team settings</span><span class="dhint">${esc(teamHint)}</span></summary>
        <div class="teamgrid">
          <div><label>Position</label><select id="d-pos">
            ${POSITIONS.map(([v,l])=>`<option value="${v}" ${(b.position||'')===v?'selected':''}>${l}</option>`).join('')}</select></div>
          <div><label>Priority</label><select id="d-pri"><option value="">—</option>
            ${[1,2,3].map(p=>`<option ${b.priority===p?'selected':''}>${p}</option>`).join('')}</select></div>
          <div><label>Owner</label><select id="d-own"><option value="">—</option>
            ${S.advocates.map(a=>`<option value="${a.id}" ${(S.assignments[b.id]||[])[0]===a.id?'selected':''}>${esc(a.full_name)}</option>`).join('')}</select></div>
          <div><label>Stage override</label><select id="d-so"><option value="">Auto</option>
            ${STAGES.map(([v,l])=>`<option value="${v}" ${b.stage_override===v?'selected':''}>${l}</option>`).join('')}</select></div>
        </div>
        <label class="lbl">Coalitions</label>
        <div class="typechips">${S.campaigns.length
          ? S.campaigns.map(c => { const on = (S.billCampaigns[b.id] || []).includes(c.id);
              return `<button data-campt="${c.id}" class="${on ? 'on' : ''}" aria-pressed="${on}"
                title="${on ? 'Remove from' : 'Add to'} ${esc(c.name)}">${on ? '✓ ' : '+ '}${esc(c.name)}</button>`; }).join('')
          : '<span style="font-size:12px;color:var(--muted)">No coalitions set up yet — an admin can add them.</span>'}</div>
      </details>
      <details class="dsec" ${open.details ? 'open' : ''} id="d-detsec">
        <summary><span class="sec">Details</span><span class="dhint">${esc(b.committee||'—')} · ${esc((b.referrals||[]).join(', ')||'no referrals')}</span></summary>
        <div class="kv">
          <span class="k">Committee</span><span>${esc(b.committee||'—')}</span>
          <span class="k">Referrals</span><span>${esc((b.referrals||[]).join(', ')||'—')}</span>
          ${(b.sponsors||[]).length ? `<span class="k">Sponsors</span><span title="${esc((b.sponsors||[]).map(s=>s.n).join(', '))}">${sponsorText(b)}</span>` : ''}
          ${(b.companions||[]).length ? `<span class="k">Companion</span><span class="complist" id="compmount">${(b.companions||[]).map(esc).join(', ')}</span>` : ''}
          ${b.public_summary && b.description ? `<span class="k">Official description</span><span>${esc(b.description)}</span>` : ''}
          <span class="k">Source</span><span><a href="${esc(capitolUrl(b))}" target="_blank" rel="noopener">capitol.hawaii.gov ↗</a></span>
        </div>
      </details>
      <details class="dsec" id="d-pubsec" ${open.pub ? 'open' : ''}>
        <summary><span class="sec">Public page</span><span class="dhint">edit summary and action ask</span></summary>
        <div class="pubgrid">
          <label for="d-psum">Plain-language summary</label>
          <textarea id="d-psum" maxlength="280"
            placeholder="One sentence a neighbour would understand. No jargon, no bill numbers."
            >${esc(b.public_summary || '')}</textarea>
          <label for="d-pact">Take Action ask</label>
          <textarea id="d-pact" maxlength="280"
            placeholder="What should someone do today? Left blank, no ask appears."
            >${esc(b.public_action || '')}</textarea>
          <div class="pubrow">
            <span><label for="d-puntil">Ask expires</label>
              <input type="date" id="d-puntil" value="${esc(b.public_action_until || '')}"></span>
            <label class="pubchk"><input type="checkbox" id="d-ispub" ${b.is_public ? 'checked' : ''}>
              Show on public page</label>
          </div>
          <button class="btn sm" id="d-savepub">Save public copy</button>
        </div>
      </details>
      <details class="dsec" id="d-notesec" ${open.notes ? 'open' : ''}>
        <summary><span class="sec">Internal notes</span><span class="dhint">${notesHead ? esc(notesHead) : 'never public'}</span></summary>
        <div class="notes">
          <textarea id="d-notes">${esc(b.internal_notes||'')}</textarea>
          <button class="btn sm" id="d-savenotes" style="margin-top:6px">Save notes</button>
        </div>
      </details>
      <div class="sec">Timeline</div>
      <div class="logform">
        <div class="typechips">${LOG_TYPES.map(([v,l]) =>
          `<button data-lt="${v}" class="${S.logType===v?'on':''}">${l}</button>`).join('')}</div>
        <input id="d-ltitle" placeholder="${S.logType==='testimony'?'e.g. Testimony submitted — Support (written + oral)':'Add to the timeline…'}">
        <textarea id="d-ldetails" placeholder="Details (optional)"></textarea>
        <button class="btn sm" id="d-log">Add to timeline</button>
      </div>
      <div id="tlmount" style="min-height:60px;color:var(--muted);font-size:12.5px">Loading…</div>
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
    : S.view === 'add' ? renderAdd() : renderTable(list);
  const b = S.bills.find(x => x.id === S.drawerBill);
  $('#app').innerHTML = chrome(body) + (b ? drawerHTML(b) : '');
  wire();
  if (b) DB.timeline(b.id).then(tl => { const el = $('#tlmount'); if (el) el.innerHTML = timelineHTML(tl); })
    .catch(()=>{});
}
function wire() {
  document.querySelectorAll('[data-view]').forEach(el => el.onclick = () => {
    S.view = el.dataset.view; localStorage.setItem('view', S.view); S.drawerBill = null; render();
    if (S.view === 'add') $('#addq')?.focus();
  });
  $('#logout') && ($('#logout').onclick = () => DB.logout());
  $('#logout2') && ($('#logout2').onclick = () => DB.logout());
  // P1 rows are shown at exactly twice their natural height (Nate, 9/15).
  document.querySelectorAll('.p3').forEach(el => {
    el.classList.remove('p3'); el.style.minHeight = '';
    const h = el.getBoundingClientRect().height;
    el.classList.add('p3'); el.style.minHeight = Math.round(h * 2) + 'px';
  });
  document.querySelectorAll('[data-boardmore]').forEach(el => el.onclick = e => {
    e.stopPropagation(); S.boardMore = S.boardMore || {}; const k = el.dataset.boardmore;
    S.boardMore[k] = !S.boardMore[k]; render(); document.getElementById('pf-board-' + k)?.scrollIntoView({ block: 'start' });
  });
  document.querySelectorAll('[data-jump]').forEach(el => el.onclick = () =>
    document.getElementById(el.dataset.jump)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  // Portfolio search reaches every bill: the untracked half comes from the
  // database, debounced, and the page re-renders when it lands.
  if (S.view === 'portfolio') {
    const q = S.q.trim();
    if (q.length >= 3 && !DEMO && S.searchAll?.q !== q) {
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
  $('#q') && ($('#q').oninput = e => { S.q = e.target.value; rerenderBody(); });
  document.querySelectorAll('[data-owner]').forEach(el =>
    el.onclick = () => { S.owner = el.dataset.owner; render(); });
  $('#prif') && ($('#prif').onchange = e => { S.pri = e.target.value; render(); });
  $('#stagef') && ($('#stagef').onchange = e => { S.stageF = e.target.value; render(); });
  $('#triplef') && ($('#triplef').onclick = () => { S.tripleF = !S.tripleF; render(); });
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
function rerenderBody() {   // keep focus in search box while typing
  const app = $('#app'), old = app.querySelector('.tablewrap, .board, .stats')?.parentNode;
  render(); const q = $('#q'); if (q) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); }
}
function wireDrawer() {
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
  $('#d-log').onclick = async () => {
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
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && S.drawerBill) { S.drawerBill = null; render(); }
});
DB.init().then(boot);
