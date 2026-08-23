// ============================================================
// HIPHI Bill Tracker — staff app
// Views: Portfolio · Pipeline · Table  (+ bill drawer, add bills)
// Data: Supabase (RLS-protected). Demo mode: append ?demo=1
// ============================================================
const SUPABASE_URL = 'https://eivzjbnygscguqqiiuvh.supabase.co';
const SUPABASE_KEY = 'sb_publishable_uvEtw8ru3zB9lDOxAjzrUA_JEFvKyul';
const DEMO = new URLSearchParams(location.search).has('demo');

const STAGES = [
  ['introduced','Introduced'], ['first_lateral','1st Lateral'], ['first_decking','1st Decking'],
  ['first_crossover','Crossover'], ['second_lateral','2nd Lateral'], ['second_decking','2nd Decking'],
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
  tripleF: false,
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
  return m ? `https://www.capitol.hawaii.gov/session/measure_indiv.aspx?billtype=${m[1]}&billnumber=${m[2]}&year=${b.session_year||2026}`
           : (b.state_url || '#');
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

// ---------------- demo data ----------------
let DEMO_TL = [];
function demoInit() {
  const A = (n,i,c,e,adm) => ({ id:i, full_name:n, initials:i, color:c, email:e, is_admin:!!adm });
  S.advocates = [A('Nate','NT','#0E7C86','nate@hiphi.org',1), A('Kevin','KV','#5B7FBF','kevin@hiphi.org'),
                 A('Saya','SY','#3E8E63','saya@hiphi.org'), A('Kris','KR','#7E5BA6','kris@hiphi.org')];
  S.me = S.advocates[0];
  S.campaigns = [{id:'c1',name:'CTFH'},{id:'c2',name:'HEAL'},{id:'c3',name:'General HIPHI'}];
  const mk = (id,num,t,stage,pos,pri,cmte,la,lad,own,camp) => {
    S.assignments[id]=[own]; S.billCampaigns[id]=[camp];
    return { id, bill_number:num, title:t, stage, position:pos, priority:pri, committee:cmte,
      referrals: id==='b1' ? ['HLT','CPC/JHA','FIN'] : ['HLT','FIN'],
      origin_stops: id==='b1' ? 3 : 2, second_stops: 0, last_action:la, last_action_date:lad, session_year:2026,
      state_url:'https://www.capitol.hawaii.gov', tracked:true };
  };
  S.bills = [
    Object.assign(mk('b1','HB1512','Relating to Health (flavored tobacco ban)','first_decking','support',1,'FIN','Reported from HLT, referred to FIN','2026-02-10','KV','c1'),
      {description:'Beginning 1/1/2027, prohibits the sale of flavored tobacco products, including menthol cigarettes and flavored e-liquids.'}),
    mk('b2','HB1518','Relating to the Supplemental Nutrition Assistance Program','governor','support',2,'JDC','Received notice of passage','2026-05-08','KR','c2'),
    mk('b3','SB2384','Relating to Health','second_lateral','support',1,'HLT','Hearing scheduled by HLT',new Date(Date.now()-2*864e5).toISOString().slice(0,10),'KV','c1'),
    mk('b4','HB1524','Relating to Pedestrians','enacted','monitor',3,'TRS','Act 041 signed by Governor','2026-05-20','NT','c3'),
    Object.assign(mk('b5','SB1039','Relating to School Meals','dead','support',2,'WAM','Carried over / missed crossover','2026-03-05','KR','c2'),
      {description:'Requires the department of education to provide free school meals to all public school students.'}),
    mk('b6','HB814','Relating to Cannabis','conference','monitor',3,'FIN','Conference committee appointed','2026-04-12','NT','c3'),
  ];
  const now = Date.now();
  S.hearings = [{ id:'h1', bill_id:'b1', committee:'FIN',
    scheduled_at:new Date(now+30*3600e3).toISOString(), room:'Conference Room 308',
    testimony_deadline:new Date(now+6*3600e3).toISOString(), status:'scheduled' }];
  S.pulse = { b1:{last_team_touch:new Date(now-2*3600e3).toISOString(),testimony_count:2},
    b2:{last_team_touch:new Date(now-9*864e5).toISOString(),testimony_count:1},
    b3:{last_team_touch:new Date(now-864e5).toISOString(),testimony_count:0} };
  DEMO_TL = [
    { bill_id:'b1', advocate_id:'KV', type:'testimony', title:'Testimony submitted — Support',
      details:'Written + oral for HLT hearing', occurred_at:new Date(now-2*3600e3).toISOString(), source:'team' },
    { bill_id:'b1', type:'hearing_auto', title:'Hearing notice posted — FIN',
      details:'Conference Room 308', occurred_at:new Date(now-30*3600e3).toISOString(), source:'auto' },
    { bill_id:'b1', type:'status_auto', title:'Reported from HLT (Stand. Com. Rep. No. 214), referred to FIN',
      details:'Official action — House', occurred_at:'2026-02-10T18:00:00Z', source:'auto' },
  ];
  S.feed = DEMO_TL.filter(t => t.source === 'team');
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
  return `
    <div class="top">
      <span class="logo"><span class="mark">☀</span>HIPHI Bill Tracker</span>
      <div class="viewtabs">
        ${[['portfolio','Portfolio'],['pipeline','Pipeline'],['table','Table'],['cards','Cards'],['add','+ Add bills']]
          .map(([v,l]) => `<button data-view="${v}" class="${S.view===v?'on':''}">${l}</button>`).join('')}
      </div>
      <span class="fresh">2026 session · ${S.bills.length} tracked</span>
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
        ${panel('⚑ Needs your attention', 'priority bills with no team update in 7+ days',
          stale.slice(0,8).map(b => { const d = staleDays(b); return `
          <div class="prow" data-bill="${b.id}">
            <div class="pmain"><b>${esc(b.bill_number)}</b> <span class="chipx c-gray">P${b.priority}</span>
              ${esc((b.title||'').slice(0,60))}
              <div class="psmall">${statusChip(b)} · last touch: ${d>500?'never':d+'d ago'}</div></div></div>`;
          }).join('') + (stale.length>8?`<div class="pempty">…and ${stale.length-8} more — see Table view</div>`:''),
          'All priority bills touched within the week. 🤙')}
      </div>
      <div>
        ${panel('⇢ Moved in the last 7 days', 'official actions from the Capitol',
          moved.slice(0,8).map(b => `
          <div class="prow" data-bill="${b.id}">
            <div class="pmain"><b>${esc(b.bill_number)}</b> <span class="psmall" style="display:inline">${fmtDate(b.last_action_date)}</span>
              <div class="psmall">${esc((b.last_action||'').slice(0,90))}</div></div></div>`).join(''),
          'No official movement this week.')}
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
  const heads = { bill:['bill_number','Bill / title'], status:['stage','Status'],
    coal:['','Coalitions'], owner:['owner','Owner'], position:['position','Position'],
    pri:['priority','Pri'], last:['last_action_date','Last action'], pulse:['pulse','Team pulse'] };
  if (!list.length) return `<div class="empty">No bills match these filters.</div>`;
  return `<div class="tablewrap"><table class="bills">
    <thead><tr>${cols.map(c => `<th data-sort="${heads[c][0]}">${heads[c][1]}
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
            ${owners(b).slice(0,1).map(a=>av(a)).join('')}</div>
          <div class="tt">${esc(b.title||'')}</div>
          <div>${b.position ? `<span class="chipx c-gray pos-${b.position}" style="background:var(--chip)">${POSITIONS.find(p=>p[0]===b.position)?.[1]||''}</span>`:''}</div>
        </div>`).join('')}
      ${bs.length>MAX ? `<div class="colmore">+ ${bs.length-MAX} more — use filters</div>` : ''}
    </div>`).join('')}</div>`;
}

const renderTable = list => billTable(list, ['bill','coal','owner','status','position','pri','last','pulse']);


// ---------------- Cards view (advocacy print) ----------------
const SESSION_OVER = true;   // flip false when the 2027 session convenes
// Official session calendar (LRB, 2026). One place to update each December.
const DEADLINES = {
  introduced:       [['Intro cutoff','2026-01-28']],
  first_lateral:    [['Triple filing','2026-02-11'],['Lateral','2026-02-20']],
  first_decking:    [['Decking','2026-03-06']],
  first_crossover:  [['Crossover','2026-03-12']],
  second_lateral:   [['Triple filing','2026-03-19'],['Lateral','2026-03-30']],
  second_decking:   [['Decking','2026-04-10']],
  second_crossover: [['Cross back','2026-04-16']],
  conference:       [['Final decking','2026-04-29'],['Fiscal','2026-05-01']],
  governor:         [['Sine die','2026-05-08']],
};
// True triple referral: 3+ stops within a SINGLE chamber (joint committees
// count as one) — that is what races the Triple Filing deadline. Computed
// by the sync per chamber; the combined referrals list is display-only.
const isTriple = b => (b.origin_stops || 0) >= 3 || (b.second_stops || 0) >= 3;
const RAIL = [['introduced','Intro'],['first_lateral','1st\nLat'],['first_decking','1st\nDeck'],
  ['first_crossover','Cross'],['second_lateral','2nd\nLat'],['second_decking','2nd\nDeck'],
  ['conference','Conf'],['governor','Gov'],['enacted','Law']];
const RAIL_IDX = { introduced:0, first_lateral:1, first_decking:2, first_crossover:3,
  second_lateral:4, second_decking:5, second_crossover:5, conference:6, governor:7,
  enacted:8, vetoed:7, dead:null };
const diedish = b => { const st = effStage(b);
  if (st === 'dead' || st === 'vetoed') return true;
  if (S.hearings.some(h => h.bill_id === b.id && new Date(h.scheduled_at) > new Date())) return false;
  if (/deferred|failed to pass/i.test(b.last_action || '')) return true;
  return SESSION_OVER && !['enacted','governor'].includes(st); };
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
    el.onclick = e => { if (e.target.closest('select')) return; openDrawer(el.dataset.bill); });
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
