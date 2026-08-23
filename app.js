// ============================================================
// HIPHI Bill Tracker — staff app
// Views: Portfolio · Pipeline · Table  (+ bill drawer, add bills)
// Data: Supabase (RLS-protected). Demo mode: append ?demo=1
// ============================================================
const SUPABASE_URL = 'https://eivzjbnygscguqqiiuvh.supabase.co';
const SUPABASE_KEY = 'sb_publishable_uvEtw8ru3zB9lDOxAjzrUA_JEFvKyul';
const DEMO = new URLSearchParams(location.search).has('demo');
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
  view: localStorage.getItem('view') || 'portfolio',
  owner: 'me', q: '', pri: '', stageF: '', camp: '',
  drawerBill: null, logType: 'testimony', sort: ['bill_number', 1],
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
    S.supa.auth.onAuthStateChange((_e, sess) => {
      const had = !!S.session; S.session = sess;
      if (!!sess !== had) boot();
    });
  },
  async login(email, password) {
    const { error } = await S.supa.auth.signInWithPassword({ email, password });
    if (error) throw error;
  },
  logout() { DEMO ? location.reload() : S.supa.auth.signOut(); },
  async loadAll() {
    if (DEMO) return;
    // link my login to my advocate row (no-op after first time)
    const { data: myId, error: claimErr } = await S.supa.rpc('claim_advocate');
    if (claimErr) console.warn('claim_advocate:', claimErr.message);
    const [adv, bills, asg, camps, bc, hear, pulse, feed] = await Promise.all([
      S.supa.from('advocates').select('*').order('full_name'),
      S.supa.from('bills').select('*').eq('tracked', true).order('bill_number').limit(2000),
      S.supa.from('bill_assignments').select('bill_id,advocate_id'),
      S.supa.from('campaigns').select('*').order('sort_order'),
      S.supa.from('bill_campaigns').select('bill_id,campaign_id'),
      S.supa.from('hearings').select('*').gte('scheduled_at', new Date(Date.now()-864e5).toISOString()),
      S.supa.from('bill_pulse').select('*'),
      S.supa.from('activity_log').select('*').eq('source','team')
        .order('occurred_at', { ascending: false }).limit(25),
    ]);
    for (const r of [adv, bills, asg, camps, bc, hear, pulse, feed])
      if (r.error) throw r.error;
    S.advocates = adv.data; S.bills = bills.data; S.campaigns = camps.data;
    S.hearings = hear.data;
    S.assignments = {}; asg.data.forEach(r =>
      (S.assignments[r.bill_id] ??= []).push(r.advocate_id));
    S.billCampaigns = {}; bc.data.forEach(r =>
      (S.billCampaigns[r.bill_id] ??= []).push(r.campaign_id));
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
    const b = S.bills.find(x => x.id === billId); Object.assign(b, patch);
    if (DEMO) return;
    const { error } = await S.supa.from('bills').update(patch).eq('id', billId);
    if (error) throw error;
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
    ids.forEach(id => { const b = S.bills.find(x => x.id === id); if (b) Object.assign(b, patch); });
    if (DEMO) return;
    const { error } = await S.supa.from('bills').update(patch).in('id', ids);
    if (error) throw error;
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
  const A = (n,i,c,e,adm) => ({ id:i, full_name:n, initials:i, color:c, email:e, is_admin:!!adm });
  S.advocates = [A('Nate','NT','#0E7C86','nate@hiphi.org',1), A('Kevin','KV','#5B7FBF','kevin@hiphi.org'),
                 A('Saya','SY','#3E8E63','saya@hiphi.org'), A('Kris','KR','#7E5BA6','kris@hiphi.org')];
  S.me = S.advocates[0];
  S.campaigns = [{id:'c1',name:'CTFH'},{id:'c2',name:'HEAL'},{id:'c3',name:'General HIPHI'}];
  const sc = buildScenario(Date.now());
  S.bills = sc.bills; S.hearings = sc.hearings; S.pulse = sc.pulse;
  S.assignments = sc.assignments; S.billCampaigns = sc.billCampaigns;
  S.compStage = sc.compStage; DEMO_TL = sc.tl;
  S.feed = sc.tl.filter(t => t.source === 'team');
  S.sinceVisit = Date.now() - 3*864e5;
  S.sinceEvents = sc.since;
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
    <div class="top">
      <span class="logo"><span class="mark">☀</span>HIPHI Bill Tracker</span>
      <div class="viewtabs">
        ${[['portfolio','Portfolio'],['pipeline','Pipeline'],['table','Table'],['cards','Cards'],['add','+ Add bills']]
          .map(([v,l]) => `<button data-view="${v}" class="${S.view===v?'on':''}">${l}</button>`).join('')}
      </div>
      <span class="fresh"${stale ? ' style="color:#C2483B;font-weight:600" title="The daily sync has not completed successfully recently - data may be stale"' : ''}>${SESSION_YEAR} session · ${S.bills.length} tracked · ${freshTxt}</span>
      <span class="who">${av(S.me)}<button id="logout">sign out</button></span>
    </div>
    ${banner}
    <div class="filters">
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
function renderPortfolio(list) {
  const ids = new Set(list.map(b => b.id));
  const now = Date.now(), wk = now + 7*864e5, day = 864e5;
  const bill = id => S.bills.find(b => b.id === id);
  const who = S.owner==='me' ? (S.me?.full_name || 'My') :
    S.owner==='all' ? 'Team' : (advocate(S.owner)?.full_name || '');
  const hUp = S.hearings.filter(h => ids.has(h.bill_id) && new Date(h.scheduled_at) > new Date())
    .sort((a,b) => a.scheduled_at.localeCompare(b.scheduled_at));
  const due = hUp.filter(h => h.testimony_deadline && new Date(h.testimony_deadline) - now < 48*3600e3);
  const hearingsWk = hUp.filter(h => new Date(h.scheduled_at) < new Date(wk));
  const staleDays = b => { const d = daysAgo(S.pulse[b.id]?.last_team_touch); return d == null ? 9999 : d; };
  const stale = list.filter(b => (b.priority||3) <= 2 && staleDays(b) > 7)
    .sort((a,b) => (a.priority||3)-(b.priority||3) || staleDays(b)-staleDays(a));
  const moved = list.filter(b => b.last_action_date && (now - new Date(b.last_action_date)) < 7*day)
    .sort((a,b) => (b.last_action_date||'').localeCompare(a.last_action_date||''));
  const feed = (S.feed||[]).filter(ev => ids.has(ev.bill_id)).slice(0, 8);
  const hrsLeft = d => Math.max(0, Math.round((new Date(d) - now)/36e5));
  // Dying-quietly radar: a filing deadline is close and no hearing is on the books
  const radar = list.filter(b => !diedish(b))
    .map(b => ({ b, dl: nextDeadline(b) }))
    .filter(x => x.dl && x.dl.days >= 0 && x.dl.days <= RADAR_DAYS &&
      !S.hearings.some(h => h.bill_id === x.b.id && new Date(h.scheduled_at) > new Date()))
    .sort((x,y) => x.dl.days - y.dl.days || (x.b.priority||3) - (y.b.priority||3));
  // Since your last visit: hearing notices + official actions found since then
  const sinceH = S.hearings.filter(h => ids.has(h.bill_id) && h.notice_posted_at &&
    new Date(h.notice_posted_at).getTime() > S.sinceVisit && new Date(h.scheduled_at) > new Date());
  const evByBill = {};
  for (const ev of (S.sinceEvents||[])) if (ids.has(ev.bill_id))
    (evByBill[ev.bill_id] ||= []).push(ev);
  const sinceRows = Object.entries(evByBill).map(([bid, evs]) => ({ b: bill(bid), evs }))
    .filter(x => x.b).sort((x,y) => (x.b.priority||3) - (y.b.priority||3));
  const nSince = sinceH.length + sinceRows.length;

  const panel = (title, sub, rowsHtml, emptyMsg) => `
    <div class="panel"><div class="ph"><span>${title}</span><span class="psub">${sub}</span></div>
      ${rowsHtml || `<div class="pempty">${emptyMsg}</div>`}</div>`;

  return `
    <div class="dashhead">
      <h1>${esc(who)}'s desk</h1>
      <span class="sub">${new Date().toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',timeZone:'Pacific/Honolulu'})}
        · ${list.length} bills in portfolio</span>
    </div>
    <div class="stats">
      <div class="stat ${due.length?'warn':''}"><div class="v">${due.length}</div><div class="l">Testimony due (48h)</div></div>
      <div class="stat"><div class="v">${hearingsWk.length}</div><div class="l">Hearings next 7 days</div></div>
      <div class="stat"><div class="v">${moved.length}</div><div class="l">Moved this week</div></div>
      <div class="stat ${stale.length?'warn':''}"><div class="v">${stale.length}</div><div class="l">P1–P2 needing an update</div></div>
    </div>
    <div class="dash">
      <div>
        ${panel('⏱ Testimony window', 'deadlines inside 48 hours',
          due.map(h => { const b = bill(h.bill_id); if (!b) return ''; return `
          <div class="prow urgent" data-bill="${b.id}">
            <div class="pmain"><b>${esc(b.bill_number)}</b> · ${esc(h.committee)} — due in <b>${hrsLeft(h.testimony_deadline)}h</b>
              <div class="psmall">Hearing ${fmtDT(h.scheduled_at)} · ${esc(h.room||'room TBD')}</div></div>
            <button class="btn sm" data-logt="${b.id}">Log testimony</button>
            <a class="btn sm ghost" href="${esc(capitolUrl(b))}" target="_blank" rel="noopener" onclick="event.stopPropagation()">Capitol ↗</a>
          </div>`; }).join(''), 'No testimony deadlines in the next 48 hours.')}
        ${panel('◷ Hearings this week', 'scheduled on these bills',
          hearingsWk.map(h => { const b = bill(h.bill_id); if (!b) return ''; return `
          <div class="prow" data-bill="${b.id}">
            <div class="pmain"><b>${esc(b.bill_number)}</b> · ${esc(h.committee)} · ${fmtDT(h.scheduled_at)}
              <div class="psmall">${esc(b.title||'')}</div></div></div>`; }).join(''),
          'No hearings scheduled this week.')}
        ${panel('📡 No hearing before the deadline', `${RADAR_DAYS}-day radar — unscheduled bills die quietly`,
          radar.slice(0,8).map(({b, dl}) => `
          <div class="prow ${dl.days<=5?'urgent':''}" data-bill="${b.id}">
            <div class="pmain"><b>${esc(b.bill_number)}</b>${b.priority?` <span class="chipx c-gray">P${b.priority}</span>`:''}
              waiting in <b>${esc(b.committee||'committee')}</b> — no hearing scheduled
              <div class="psmall">${esc(dl.label)} deadline in <b>${dl.days}d</b> (${fmtDate(dl.date)}) · ${STAGE_LABEL[effStage(b)]} — consider calling the chair's office</div></div></div>`
          ).join('') + (radar.length>8?`<div class="pempty">…and ${radar.length-8} more at risk</div>`:''),
          SESSION_OVER ? 'Session is over — the radar activates when 2027 deadlines are loaded.'
                       : `Nothing in this portfolio is inside ${RADAR_DAYS} days of a deadline without a hearing. 🤙`)}
      </div>
      <div>
        ${panel('⚡ Since your last visit', S.sinceVisit ? 'changes found after ' + fmtDT(S.sinceVisit) : '',
          sinceH.map(h => { const b = bill(h.bill_id); return b ? `
          <div class="prow" data-bill="${b.id}">
            <div class="pmain">📅 <b>${esc(b.bill_number)}</b> — ${esc(h.committee)} hearing posted
              <div class="psmall">${fmtDT(h.scheduled_at)} · ${esc(h.room||'room TBD')}</div></div></div>` : ''; }).join('') +
          sinceRows.slice(0,10).map(({b, evs}) => `
          <div class="prow" data-bill="${b.id}">
            <div class="pmain">${AMENDED_RE.test(evs[0].title)?'✏️ ':''}<b>${esc(b.bill_number)}</b> — ${esc(evs[0].title.slice(0,80))}
              <div class="psmall">${fmtDate(evs[0].occurred_at)}${evs.length>1?` · +${evs.length-1} more action${evs.length>2?'s':''}`:''}</div></div></div>`).join('') +
          (sinceRows.length>10?`<div class="pempty">…and ${sinceRows.length-10} more bills changed</div>`:''),
          'Nothing new on these bills since your last visit.')}
        ${panel('⚑ Needs your attention', 'priority bills with no team update in 7+ days',
          stale.slice(0,8).map(b => { const d = staleDays(b); return `
          <div class="prow" data-bill="${b.id}">
            <div class="pmain"><b>${esc(b.bill_number)}</b> <span class="chipx c-gray">P${b.priority}</span>
              ${esc((b.title||'').slice(0,60))}
              <div class="psmall">${statusChip(b)} · last touch: ${d>500?'never':d+'d ago'}</div></div></div>`;
          }).join('') + (stale.length>8?`<div class="pempty">…and ${stale.length-8} more — see Table view</div>`:''),
          'All priority bills touched within the week. 🤙')}
        ${panel('✎ Latest team activity', 'across this portfolio',
          feed.map(ev => { const b = bill(ev.bill_id), a = advocate(ev.advocate_id); return `
          <div class="prow" data-bill="${ev.bill_id}">
            ${av(a)}<div class="pmain"><b>${esc(ev.title)}</b>
              <div class="psmall">${esc(b?.bill_number||'')} · ${a?esc(a.full_name):''} · ${fmtDT(ev.occurred_at)}</div></div></div>`;
          }).join(''), 'No team activity logged yet — open any bill to add the first entry.')}
      </div>
    </div>`;
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

function renderTable(list) {
  const n = S.selected.size;
  const bar = n ? `<div class="bulkbar">
    <b>${n} selected</b>
    <select id="bk-pos"><option value="">Set position\u2026</option>
      ${POSITIONS.slice(1).map(([v,l]) => `<option value="${v}">${l}</option>`).join('')}</select>
    <select id="bk-pri"><option value="">Set priority\u2026</option>
      ${[1,2,3].map(p => `<option value="${p}">P${p}</option>`).join('')}</select>
    <select id="bk-own"><option value="">Assign owner\u2026</option>
      ${S.advocates.map(a => `<option value="${a.id}">${esc(a.full_name)}</option>`).join('')}
      <option value="__none">Unassign</option></select>
    <select id="bk-camp"><option value="">Add to coalition\u2026</option>
      ${S.campaigns.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}</select>
    <button class="clear" id="bk-clear">Clear selection</button>
  </div>` : '';
  return bar + billTable(list, ['sel','bill','coal','owner','status','position','pri','last','pulse']);
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
function drawerHTML(b) {
  return `<div class="scrim" id="scrim"></div>
  <div class="drawer">
    <div class="dhead">
      <button class="close" id="dclose">✕</button>
      <h2>${esc(b.bill_number.replace(/^(\D+)/,'$1 '))}</h2>
      <div class="sub">${esc(b.title||'')}</div>
    </div>
    <div class="dbody">
      <div class="sec">Official status <span class="tag a">auto</span></div>
      <div class="kv">
        <span class="k">Stage</span><span>${STAGE_LABEL[effStage(b)]}${b.stage_override?' (manual override)':''}</span>
        <span class="k">Committee</span><span>${esc(b.committee||'—')}</span>
        <span class="k">Referrals</span><span>${esc((b.referrals||[]).join(', ')||'—')}</span>
        ${(b.sponsors||[]).length ? `<span class="k">Sponsors</span><span title="${esc((b.sponsors||[]).map(s=>s.n).join(', '))}">${sponsorText(b)}</span>` : ''}
        ${(b.companions||[]).length ? `<span class="k">Companion</span><span class="complist" id="compmount">${(b.companions||[]).map(esc).join(', ')}</span>` : ''}
        <span class="k">Last action</span><span>${esc(b.last_action||'—')} <span style="color:var(--muted)">(${fmtDate(b.last_action_date,{year:'2-digit'})})</span></span>
        <span class="k">Source</span><span><a href="${esc(capitolUrl(b))}" target="_blank" rel="noopener">capitol.hawaii.gov ↗</a></span>
      </div>
      <div class="sec">HIPHI layer</div>
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
      <div class="notes" style="margin-top:9px"><label style="font-size:11px;font-weight:600;color:var(--muted)">Internal notes (never public)</label>
        <textarea id="d-notes">${esc(b.internal_notes||'')}</textarea>
        <button class="btn sm" id="d-savenotes" style="margin-top:6px">Save notes</button></div>
      <div class="sec">Log an update</div>
      <div class="logform">
        <div class="typechips">${LOG_TYPES.map(([v,l]) =>
          `<button data-lt="${v}" class="${S.logType===v?'on':''}">${l}</button>`).join('')}</div>
        <input id="d-ltitle" placeholder="${S.logType==='testimony'?'e.g. Testimony submitted — Support (written + oral)':'Short summary…'}">
        <textarea id="d-ldetails" placeholder="Details (optional)"></textarea>
        <button class="btn" id="d-log">Add to timeline</button>
      </div>
      <div class="sec">Timeline — official + team</div>
      <div id="tlmount" style="min-height:60px;color:var(--muted);font-size:12.5px">Loading…</div>
    </div>
  </div>`;
}

// ---------------- login ----------------
function renderLogin() {
  $('#app').innerHTML = `<div class="loginwrap"><div class="loginbox">
    <div class="logo"><span class="mark" style="width:26px;height:26px;border-radius:8px;background:linear-gradient(135deg,#12A0AC,#0E7C86);display:inline-flex;align-items:center;justify-content:center">☀</span>
      HIPHI Bill Tracker</div>
    <p>Hawai‘i Public Health Institute · staff sign in</p>
    <label>Email</label><input id="l-email" type="email" autocomplete="username">
    <label>Password</label><input id="l-pass" type="password" autocomplete="current-password">
    <button class="btn" id="l-go">Sign in</button>
    <div class="loginerr" id="l-err"></div>
  </div></div>`;
  const go = async () => {
    $('#l-err').textContent = '';
    try { await DB.login($('#l-email').value.trim(), $('#l-pass').value); }
    catch (e) { $('#l-err').textContent = e.message || 'Sign-in failed'; }
  };
  $('#l-go').onclick = go;
  $('#l-pass').addEventListener('keydown', e => e.key === 'Enter' && go());
}

// ---------------- render + events ----------------
function render() {
  const list = visibleBills();
  const body = S.view === 'portfolio' ? renderPortfolio(list)
    : S.view === 'pipeline' ? renderPipeline(list)
    : S.view === 'cards' ? renderCards(list)
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
  $('#q') && ($('#q').oninput = e => { S.q = e.target.value; rerenderBody(); });
  document.querySelectorAll('[data-owner]').forEach(el =>
    el.onclick = () => { S.owner = el.dataset.owner; render(); });
  $('#prif') && ($('#prif').onchange = e => { S.pri = e.target.value; render(); });
  $('#stagef') && ($('#stagef').onchange = e => { S.stageF = e.target.value; render(); });
  $('#triplef') && ($('#triplef').onclick = () => { S.tripleF = !S.tripleF; render(); });
  $('#csv') && ($('#csv').onclick = exportCSV);
  document.querySelectorAll('[data-camp]').forEach(el =>
    el.onclick = () => { S.camp = el.dataset.camp; render(); });
  document.querySelectorAll('th[data-sort]').forEach(th => th.onclick = () => {
    const k = th.dataset.sort; if (!k) return;
    S.sort = S.sort[0] === k ? [k, -S.sort[1]] : [k, 1]; render();
  });
  document.querySelectorAll('tr[data-bill],.card[data-bill],.pv-card[data-bill]').forEach(el =>
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
  wireDrawer(); wireAdd();
}
function rerenderBody() {   // keep focus in search box while typing
  const app = $('#app'), old = app.querySelector('.tablewrap, .board, .stats')?.parentNode;
  render(); const q = $('#q'); if (q) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); }
}
function wireDrawer() {
  const b = S.bills.find(x => x.id === S.drawerBill); if (!b) return;
  $('#scrim').onclick = $('#dclose').onclick = () => { S.drawerBill = null; render(); };
  const save = (patch, msg) => DB.updateBill(b.id, patch)
    .then(() => { toast(msg || 'Saved'); render(); })
    .catch(e => toast(e.message, true));
  $('#d-pos').onchange = e => save({ position: e.target.value || null });
  $('#d-pri').onchange = e => save({ priority: e.target.value ? +e.target.value : null });
  $('#d-so').onchange = e => save({ stage_override: e.target.value || null });
  $('#d-own').onchange = e => DB.setOwner(b.id, e.target.value || null)
    .then(() => { toast('Owner updated'); render(); }).catch(er => toast(er.message, true));
  $('#d-savenotes').onclick = () => save({ internal_notes: $('#d-notes').value || null }, 'Notes saved');
  document.querySelectorAll('[data-lt]').forEach(el => el.onclick = () => {
    S.logType = el.dataset.lt;
    document.querySelectorAll('[data-lt]').forEach(x => x.classList.toggle('on', x === el));
  });
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
    render();
  } catch (e) {
    $('#app').innerHTML = `<div class="boot">Something went wrong: ${esc(e.message)}<br><br>
      <button class="btn" onclick="location.reload()">Retry</button></div>`;
  }
}
DB.init().then(boot);
