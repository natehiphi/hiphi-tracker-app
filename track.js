// ============================================================
// HIPHI Bill Tracker — public watch page (track.html)
// Anyone can search every bill and watch it. A free account (magic link)
// keeps the watchlist across devices and turns on email alerts. Reads only
// the public_* views; the account's own rows are the only thing it writes.
// ============================================================
const SUPABASE_URL = 'https://eivzjbnygscguqqiiuvh.supabase.co';
const SUPABASE_KEY = 'sb_publishable_uvEtw8ru3zB9lDOxAjzrUA_JEFvKyul';
const LOCAL_KEY = 'hiphi_watch_ids';
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const HST = 'Pacific/Honolulu';
const fmtDate = (d, o) => d ? new Date(d).toLocaleString('en-US', { timeZone: HST, month: 'numeric', day: 'numeric', ...o }) : '';
const fmtDT = d => fmtDate(d, { weekday: 'short', hour: 'numeric', minute: '2-digit' });
const hstDay = d => new Date(d).toLocaleDateString('en-CA', { timeZone: HST });
const toast = (m, err) => { const el = document.createElement('div'); el.className = 'toastmsg' + (err ? ' err' : ''); el.textContent = m; $('#toast').appendChild(el); setTimeout(() => el.remove(), 3600); };
const blurb = (b, n = 110) => { const t = (b.hiphi_summary || b.description || b.title || '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1).replace(/\s\S*$/, '') + '…' : t; };
const inWhen = iso => { const ms = new Date(iso) - Date.now(); if (ms <= 0) return 'passed'; const h = Math.round(ms / 36e5); return h < 48 ? `in ${h}h` : `in ${Math.ceil(ms / 864e5)}d`; };
const STAGE_LABEL = { introduced: 'Introduced', first_triple: '1st Triple', first_lateral: '1st Lateral', first_decking: '1st Decking',
  first_crossover: 'Crossed over', second_triple: '2nd Triple', second_lateral: '2nd Lateral', second_decking: '2nd Decking',
  second_crossover: 'Passed both', conference: 'Conference', governor: 'Governor', enacted: 'Law', vetoed: 'Vetoed', dead: 'Dead' };
const RAIL = [['introduced', 'Intro'], ['first_lateral', '1st Lat'], ['first_decking', '1st Deck'], ['first_crossover', 'Cross'],
  ['second_lateral', '2nd Lat'], ['second_decking', '2nd Deck'], ['conference', 'Conf'], ['governor', 'Gov'], ['enacted', 'Law']];
const RAIL_IDX = { introduced: 0, first_triple: 1, first_lateral: 1, first_decking: 2, first_crossover: 3, second_triple: 4, second_lateral: 4,
  second_decking: 5, second_crossover: 5, conference: 6, governor: 7, enacted: 8, vetoed: 7, dead: null };
const COMMITTEE_STAGES = ['introduced', 'first_triple', 'first_lateral', 'first_decking', 'second_triple', 'second_lateral', 'second_decking'];
const POS = { support: 'Supports', support_amend: 'Supports with amendments', oppose: 'Opposes', neutral: 'Comments', monitor: 'Monitoring' };

const S = { supa: null, session: null, user: null, watch: new Set(), bills: [], hearings: [], activity: [], deadlines: [],
  committees: {}, view: 'home', q: '', results: null, open: null, weekOffset: 0 };

// ---------------- data ----------------
async function init() {
  const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
  S.supa = createClient(SUPABASE_URL, SUPABASE_KEY);
  const { data } = await S.supa.auth.getSession(); S.session = data.session;
  S.supa.auth.onAuthStateChange((_e, sess) => { const had = !!S.session; S.session = sess; if (!!sess !== had) boot(); });
}
function localWatch() { try { return new Set(JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]')); } catch { return new Set(); } }
function saveLocal() { try { localStorage.setItem(LOCAL_KEY, JSON.stringify([...S.watch])); } catch { /* private mode */ } }
async function loadUser() {
  S.user = null;
  if (!S.session) { S.watch = localWatch(); return; }
  const { data, error } = await S.supa.rpc('ensure_public_user');
  if (error) { if (/staff/.test(error.message)) { toast('Staff accounts use the main app', true); await S.supa.auth.signOut(); return; } throw error; }
  S.user = data;
  const wl = await S.supa.from('watchlist').select('bill_id');
  const server = new Set((wl.data || []).map(r => r.bill_id));
  // First sign-in: what was starred on this device joins the account.
  const local = localWatch(); const missing = [...local].filter(id => !server.has(id));
  if (missing.length) { await S.supa.from('watchlist').insert(missing.map(bill_id => ({ user_id: S.user.id, bill_id }))); missing.forEach(id => server.add(id)); }
  S.watch = server; saveLocal();
}
async function loadBills() {
  const ids = [...S.watch];
  if (!ids.length) { S.bills = []; S.hearings = []; S.activity = []; }
  else {
    const [b, h, a] = await Promise.all([
      S.supa.from('public_all_bills').select('*').in('id', ids),
      S.supa.from('public_all_hearings').select('*').in('bill_id', ids),
      S.supa.from('public_activity').select('*').in('bill_id', ids).order('occurred_at', { ascending: false }).limit(300),
    ]);
    S.bills = b.data || []; S.hearings = h.data || []; S.activity = a.data || [];
  }
  const [d, c, sl] = await Promise.all([S.supa.from('public_deadlines').select('*'), S.supa.from('public_committees').select('*'), S.supa.from('public_committee_slots').select('*')]);
  S.slots = sl.data || [];
  S.deadlines = (d.data || []).sort((x, y) => x.deadline_date.localeCompare(y.deadline_date));
  S.committees = Object.fromEntries((c.data || []).map(x => [x.code, x]));
}
async function toggleWatch(id) {
  const on = S.watch.has(id);
  if (on) S.watch.delete(id); else S.watch.add(id);
  saveLocal();
  if (S.user) {
    const r = on ? await S.supa.from('watchlist').delete().eq('user_id', S.user.id).eq('bill_id', id)
                 : await S.supa.from('watchlist').insert({ user_id: S.user.id, bill_id: id });
    if (r.error) { toast(r.error.message, true); if (on) S.watch.add(id); else S.watch.delete(id); saveLocal(); return; }
  }
  await loadBills(); render();
}
async function search(q) {
  const safe = q.replace(/[%,()]/g, ' ').trim();
  const { data, error } = await S.supa.from('public_all_bills').select('*')
    .or(`bill_number.ilike.%${safe.replace(/\s/g, '')}%,title.ilike.%${safe}%,description.ilike.%${safe}%`)
    .order('bill_number').limit(25);
  if (error) throw error; return data;
}

// ---------------- helpers ----------------
const bill = id => S.bills.find(b => b.id === id);
const isTriple = b => (b.origin_stops || 0) >= 3 || (b.second_stops || 0) >= 3;
function nextDeadline(b) {
  if (!COMMITTEE_STAGES.includes(b.stage || 'introduced')) return null;
  const key = (b.stage || 'introduced') === 'introduced' ? (isTriple(b) ? 'first_triple' : 'first_lateral') : b.stage;
  const fut = S.deadlines.filter(d => d.key === key && new Date(d.deadline_date + 'T23:59:59-10:00') > Date.now());
  if (!fut.length) return null;
  const d = fut[0]; return { label: d.label, date: d.deadline_date, days: Math.ceil((new Date(d.deadline_date + 'T23:59:59-10:00') - Date.now()) / 864e5) };
}
const alive = b => !['dead', 'vetoed', 'enacted', 'governor'].includes(b.stage || '') && !/deferred|failed to pass/i.test(b.last_action || '');
const posCls = b => ({ support: 'pos-support', support_amend: 'pos-support', oppose: 'pos-oppose', neutral: 'pos-neutral' }[b.hiphi_position] || 'pos-none');
const watchBtn = (b, small) => `<button class="watchbtn ${S.watch.has(b.id) ? 'on' : ''}" data-watch="${b.id}">${S.watch.has(b.id) ? '★ Watching' : '☆ Watch'}</button>`;
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

const chairOf = code => { const c = S.committees[String(code || '').split('/')[0]]; if (!c?.chair) return '';
  const last = c.chair.replace(/^(rep\.|sen\.|representative|senator)\s+/i, '').replace(/\s*(jr\.?|sr\.?|ii|iii|iv)$/i, '').trim().split(/\s+/).pop();
  return ` · Chair ${c.chamber === 'S' ? 'Sen.' : 'Rep.'} ${esc(last)}`; };
function rail(b) {
  let idx = RAIL_IDX[b.stage || 'introduced']; if (idx == null) idx = 0;
  const dead = !alive(b) && !['enacted', 'governor'].includes(b.stage || '');
  return `<div class="pv-rail">${RAIL.map(([, l], i) => `<div class="pv-stop ${i < idx ? 'done' : ''} ${i === idx && !dead ? 'now' : (i === idx ? 'done' : '')}"><span class="sq"></span><span class="sl">${l}</span></div>`).join('')}</div>`;
}

// ---------------- render ----------------
function chrome(inner) {
  const who = S.session ? `<span>${esc(S.session.user.email)}</span><button data-nav="settings">Settings</button><button id="signout">Sign out</button>`
    : `<button data-nav="signin">Sign in</button>`;
  return `<div class="top pub"><span class="logo"><span class="mark">☀</span>HIPHI Bill Tracker<small>watch</small></span>
      <span class="who">${who}</span></div>
    <div class="pubwrap">${inner}</div>`;
}
function searchBox() {
  return `<div class="search"><input type="search" id="q" placeholder="Search any Hawaiʻi bill by number (SB123) or words in the title…" value="${esc(S.q)}"></div>
    ${S.results ? `<div class="results">${S.results.length ? S.results.map(b => `
      <div class="row" data-open="${b.id}"><span class="bno">${esc(b.bill_number)}</span>
        <span class="t">${esc(b.title || '')}<small>${esc(blurb(b, 120))}${b.hiphi_follows ? ' · HIPHI follows this bill' : ''}${b.watchers ? ` · ${b.watchers} watching` : ''}</small></span>
        ${watchBtn(b)}</div>`).join('') : '<div class="row" style="color:var(--muted)">No bill matches. Try the number, like HB1563, or a word from the title.</div>'}</div>` : ''}`;
}
function home() {
  const now = Date.now();
  if (!S.watch.size) return `
    <div class="pubhead"><h1>Watch the bills you care about</h1></div>
    ${searchBox()}
    <div class="hint"><b>How it works.</b> Search any bill in the ${S.deadlines[0]?.session_year || new Date().getFullYear()} Hawaiʻi Legislature and press Watch. This page then shows you their hearings this week, where each one stands against the session's deadlines, and what changed in the last three days. Sign in with your email to keep your list on every device and get hearing alerts by email. HIPHI's positions appear on bills where we have published one.</div>`;
  const hUp = S.hearings.filter(h => h.status === 'scheduled' && new Date(h.scheduled_at) > now).sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
  const wk = now + 7 * 864e5;
  const mondayOf = t => { const d = new Date(hstDay(t) + 'T12:00:00-10:00'); return t - ((d.getUTCDay() + 6) % 7) * 864e5; };
  const off = S.weekOffset, wkStart = off === 0 ? now : mondayOf(now + off * 7 * 864e5), wkEnd = wkStart + 7 * 864e5;
  const week = (off === 0 ? hUp.filter(h => new Date(h.scheduled_at) < wk)
    : S.hearings.filter(h => h.status !== 'cancelled' && new Date(h.scheduled_at) >= new Date(hstDay(wkStart) + 'T00:00:00-10:00') && new Date(h.scheduled_at) < new Date(hstDay(wkEnd) + 'T00:00:00-10:00')))
    .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
  const all7 = [...Array(7)].map((_, i) => hstDay(wkStart + i * 864e5));
  const isWeekend = d => [0, 6].includes(new Date(d + 'T12:00:00-10:00').getDay());
  const days = all7.filter((d, i) => !isWeekend(d) || (i === 0 && off === 0) || week.some(h => hstDay(h.scheduled_at) === d));
  const wkLabel = off === 0 ? 'This week' : off === 1 ? 'Next week' : off === -1 ? 'Last week' : 'Week of ' + fmtDate(hstDay(wkStart) + 'T12:00:00-10:00', { month: 'short' });
  const calRow = h => { const b = bill(h.bill_id); if (!b) return ''; const dueSoon = h.testimony_deadline && (new Date(h.testimony_deadline) - now) < 48 * 3600e3 && new Date(h.testimony_deadline) > now; return `
    <div class="prow calrow ${posCls(b)}" data-open="${b.id}">
      <span class="caltime">${new Date(h.scheduled_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: HST })}</span>
      <div class="pmain"><b>${esc(b.bill_number)}</b> · ${esc(h.committee)} · ${esc((h.room || 'room TBD').replace(/\s*via videoconference/i, ''))}
        <div class="pdesc">${esc(blurb(b, 96))}</div>
        <div class="psmall">${h.testimony_deadline ? (inWhen(h.testimony_deadline) === 'passed' ? 'testimony deadline passed' : `written testimony due <b${dueSoon ? ' class="hot"' : ''}>${inWhen(h.testimony_deadline)}</b>`) : ''}</div></div>
      ${b.state_url ? `<a class="btn sm ghost" href="${esc(b.state_url)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">Submit testimony ↗</a>` : ''}
    </div>`; };
  const calHtml = `<div class="calweek" style="--ndays:${days.length}">${days.map(d => { const hs = week.filter(h => hstDay(h.scheduled_at) === d); const dt = new Date(d + 'T12:00:00-10:00'); const isToday = d === hstDay(now); return `
    <div class="calday${hs.length ? '' : ' nohear'}${isToday ? ' today' : ''}"><div class="calrail"><span class="dow">${dt.toLocaleDateString('en-US', { weekday: 'short', timeZone: HST })}</span><span class="dom">${dt.getDate()}</span>${isToday ? '<span class="tod">today</span>' : ''}${hs.length ? `<span class="cnt">${hs.length}</span>` : ''}</div>
      <div class="calbody">${hs.length ? hs.map(calRow).join('') : '<div class="calnone">no hearings</div>'}</div></div>`; }).join('')}</div>`;
  const calNav = `<span class="calnav"><button data-week="-1">‹</button>${off ? '<button data-week="0">Today</button>' : ''}<button data-week="1">›</button></span>`;

  // board
  const cur = S.deadlines.find(d => new Date(d.deadline_date + 'T23:59:59-10:00') > now) || null;
  const a = [], bcol = [], c = [];
  for (const b of S.bills.filter(alive)) {
    const h = hUp.find(x => x.bill_id === b.id);
    if (h) { bcol.push({ b, h }); continue; }
    if (COMMITTEE_STAGES.includes(b.stage || 'introduced')) { const dl = nextDeadline(b); if (dl) a.push({ b, dl }); continue; }
    c.push({ b });
  }
  a.sort((x, y) => x.dl.days - y.dl.days); bcol.sort((x, y) => x.h.scheduled_at.localeCompare(y.h.scheduled_at));
  const chip = (b, cls, l2) => `<div class="chip3 ${posCls(b)}" data-open="${b.id}"><span class="l1"><b>${esc(b.bill_number)}</b><span class="cm">${cls}</span></span><span class="ldesc">${esc(blurb(b, 120))}</span><span class="l2">${l2}</span></div>`;
  const col = (key, icon, title, sub, rows, empty) => `<div class="panel bcol bcol-${key}"><div class="ph"><span>${icon} ${title} <span class="cnt">${rows.length}</span></span><span class="psub">${sub}</span></div>${rows.length ? `<div class="chips">${rows.join('')}</div>` : `<div class="pempty">${empty}</div>`}</div>`;
  const board = cur ? `
    <div class="dashhead boardhead"><h1>Where your bills stand</h1><span class="sub">Next deadline: <b>${esc(cur.label)}</b> · ${fmtDate(cur.deadline_date + 'T12:00:00-10:00')}. A bill still in committee needs a hearing before its deadline or it dies.</span></div>
    <div class="board3">
      ${col('a', '📡', 'Needs a hearing', 'in committee, nothing scheduled', a.map(({ b, dl }) => { const sl = lastSlotBefore(b.committee, dl.date, S.slots); return chip(b, esc(b.committee || '—') + chairOf(b.committee), (dl.days <= 5 ? `<span class="hot">${esc(dl.label)} in ${dl.days}d</span>` : `${esc(dl.label)} in ${dl.days}d`) + (sl ? `<br>${now > sl.noticeBy ? '<span class="hot">last regular slot has passed</span>' : `last regular slot ${fmtDT(sl.at)}`}` : '')); }), 'Every bill you watch has a hearing or has cleared committee.')}
      ${col('b', '◷', 'Hearing scheduled', 'or held, awaiting the committee', bcol.map(({ b, h }) => chip(b, esc(h.committee), fmtDT(h.scheduled_at))), 'No hearings on the books.')}
      ${col('c', '✅', 'Cleared committee', 'floor votes, conference, governor', c.map(({ b }) => chip(b, STAGE_LABEL[b.stage] || '', esc((b.last_action || '').slice(0, 60)))), 'Nothing has cleared committee yet.')}
    </div>` : '';

  // feed
  const recent = S.activity.filter(ev => now - new Date(ev.occurred_at) < 72 * 3600e3);
  const feed = recent.length ? `<div class="panel sec-feed"><div class="ph"><span>⚡ Last 72 hours <span class="chipx c-gray">${recent.length}</span></span><span class="psub">newest first</span></div>
    <div class="tl72">${recent.slice(0, 20).map(ev => { const b = bill(ev.bill_id); return `<div class="tlrow ${/hearing/i.test(ev.title) ? 'notice' : /reading|passed|failed|vetoed|signed|act \d+/i.test(ev.title) ? 'vote' : 'ref'}" data-open="${b.id}"><span class="tldot"></span><span class="tlts">${esc(fmtDT(ev.occurred_at))}</span><div class="tltext"><b>${esc(b.bill_number)}</b> ${esc(ev.title.slice(0, 100))}<span class="tltitle">${esc(blurb(b, 100))}</span></div></div>`; }).join('')}</div></div>` : '';
  const due48 = hUp.filter(h => h.testimony_deadline && new Date(h.testimony_deadline) > now && new Date(h.testimony_deadline) - now < 48 * 3600e3).length;
  return `
    <div class="pubhead"><h1>${S.user ? 'Your bills' : 'Bills on this device'}</h1><span class="sub">${S.watch.size} watched · ${S.user ? 'signed in' : 'sign in to keep this list everywhere and get email alerts'}</span></div>
    ${searchBox()}
    <div class="stats pub"><div class="stat ${due48 ? 'warn' : ''}"><div class="v">${due48}</div><div class="l">Testimony due (48h)</div></div>
      <div class="stat"><div class="v">${week.length}</div><div class="l">Hearings this week</div></div>
      <div class="stat"><div class="v">${recent.length}</div><div class="l">Actions, last 72h</div></div></div>
    <div class="panel" id="pf-week"><div class="ph"><span>◷ ${wkLabel} ${calNav}</span><span class="psub">hearings on the bills you watch</span></div>${(week.length || off) ? calHtml : '<div class="pempty">No hearings on your bills in the next 7 days.</div>'}</div>
    ${board}
    ${feed}
    <div class="panel"><div class="ph"><span>★ Your watchlist</span><span class="psub">${S.bills.length} bills</span></div>
      ${S.bills.sort((x, y) => x.bill_number.localeCompare(y.bill_number)).map(b => `<div class="prow ${posCls(b)}" data-open="${b.id}"><div class="pmain"><b>${esc(b.bill_number)}</b> <span class="chipx c-gray">${STAGE_LABEL[b.stage] || 'Introduced'}</span>${b.hiphi_position ? ` <span class="chipx c-teal">HIPHI ${POS[b.hiphi_position] || ''}</span>` : ''}<div class="pdesc">${esc(blurb(b, 120))}</div></div>${watchBtn(b)}</div>`).join('')}</div>`;
}
function panelFor(b) {
  const hs = S.hearings.filter(h => h.bill_id === b.id).sort((x, y) => x.scheduled_at.localeCompare(y.scheduled_at));
  return `<div class="scrim" id="scrim"></div><div class="drawer"><div class="dhead"><button class="close" id="dclose">✕</button>
      <h2>${esc(b.bill_number.replace(/^(\D+)/, '$1 '))}</h2><div class="sub">${esc(b.title || '')}</div></div>
    <div class="dbody">
      <div class="status"><div class="stagenow">${STAGE_LABEL[b.stage] || 'Introduced'}<span class="lastact">${esc(b.last_action || '')} <span class="when">${fmtDate(b.last_action_date, { year: '2-digit' })}</span></span></div>${rail(b)}</div>
      ${b.hiphi_position ? `<div class="next"><span class="nk">HIPHI</span><div><b>${POS[b.hiphi_position] || ''}</b>${b.hiphi_action ? '<br>' + esc(b.hiphi_action) : ''}</div></div>` : ''}
      <div class="sec">Summary</div><p class="desc">${esc(b.hiphi_summary || b.description || 'No summary available yet.')}</p>
      <div class="sec">Hearings</div>
      ${hs.length ? hs.map(h => `<div class="prow"><div class="pmain"><b>${esc(h.committee)}</b> · ${fmtDT(h.scheduled_at)} · ${esc((h.room || 'room TBD').replace(/\s*via videoconference/i, ''))}${h.status !== 'scheduled' ? ` · ${esc(h.status)}` : ''}
        <div class="psmall">${h.testimony_deadline ? 'written testimony due ' + fmtDT(h.testimony_deadline) : ''}${h.notice_url ? ` · <a href="${esc(h.notice_url)}" target="_blank" rel="noopener">notice ↗</a>` : ''}</div></div></div>`).join('') : '<p class="desc"><i>No hearings on record.</i></p>'}
      <div class="testify"><b>How to testify.</b> Written testimony is due 24 hours before the hearing. Open the bill on the Capitol site, press "Submit Testimony", sign in with a free capitol.hawaii.gov account, choose the hearing, and upload or type your testimony. Say who you are, which bill, whether you support or oppose, and why in a few sentences.</div>
      <div class="sec">Details</div>
      <div class="kv"><span class="k">Committees</span><span>${esc((b.referrals || []).join(', ') || b.committee || '—')}</span></div>
      ${b.sponsors?.length ? `<div class="kv"><span class="k">Sponsors</span><span>${esc(b.sponsors.slice(0, 8).join(', '))}</span></div>` : ''}
      ${b.companions?.length ? `<div class="kv"><span class="k">Companion</span><span>${esc(b.companions.join(', '))}</span></div>` : ''}
      <div class="kv"><span class="k">Watching</span><span>${b.watchers || 0} ${b.watchers === 1 ? 'person' : 'people'}</span></div>
      <p style="margin-top:12px">${b.state_url ? `<a class="btn sm ghost" href="${esc(b.state_url)}" target="_blank" rel="noopener">Capitol bill page ↗</a>` : ''} ${watchBtn(b)}</p>
    </div></div>`;
}
function signin() {
  return `<div class="pubhead"><h1>Sign in</h1></div>
    <div class="signin"><p class="tok">Enter your email and we send a sign-in link. No password. Your watchlist follows you to any device, and you can turn on email alerts for hearings on your bills.</p>
      <input type="email" id="si-email" placeholder="you@example.com" autocomplete="email">
      <button class="btn" id="si-send">Send me a sign-in link</button>
      <p class="tok" style="margin-top:12px"><b>Privacy.</b> We keep your email and the list of bills you watch, nothing else. HIPHI staff can see how many people watch each bill, never who. You can delete your account and everything with it at any time from Settings.</p>
    </div>`;
}
function settings() {
  const p = S.user?.prefs || {};
  return `<div class="pubhead"><h1>Settings</h1><span class="sub">${esc(S.session.user.email)}</span></div>
    <div class="settings pub"><section>
      <h3>Email</h3>
      <label class="row"><span style="min-width:120px">Digest</span><select id="st-digest" style="width:auto">
        <option value="weekly" ${(p.digest || 'weekly') === 'weekly' ? 'selected' : ''}>Weekly, Monday morning</option>
        <option value="daily" ${p.digest === 'daily' ? 'selected' : ''}>Every morning</option>
        <option value="off" ${p.digest === 'off' ? 'selected' : ''}>Off</option></select></label>
      <label class="row"><input type="checkbox" id="st-alerts" ${p.hearing_alerts !== false ? 'checked' : ''}><span>Email me when a hearing is scheduled on a bill I watch</span></label>
      <div class="btns"><button class="btn" id="st-save">Save</button></div>
      <h3>Your data</h3>
      <p class="tok">We keep your email and your watchlist. Deleting your account removes both immediately and cannot be undone.</p>
      <div class="btns"><button class="btn ghost danger" id="st-delete">Delete my account</button></div>
    </section></div>`;
}
function render() {
  const inner = S.view === 'signin' ? signin() : S.view === 'settings' && S.session ? settings() : home();
  const b = S.open && (S.bills.find(x => x.id === S.open) || (S.results || []).find(x => x.id === S.open));
  $('#app').innerHTML = chrome(inner) + (b ? panelFor(b) : '');
  wire();
}
function wire() {
  document.querySelectorAll('[data-nav]').forEach(el => el.onclick = () => { S.view = el.dataset.nav; S.open = null; render(); });
  $('#signout') && ($('#signout').onclick = async () => { await S.supa.auth.signOut(); S.view = 'home'; });
  const q = $('#q');
  if (q) { let t; q.oninput = () => { S.q = q.value; clearTimeout(t); t = setTimeout(async () => {
      if (S.q.trim().length < 2) { S.results = null; render(); return; }
      try { S.results = await search(S.q.trim()); render(); const el = $('#q'); if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } }
      catch (e) { toast(e.message, true); } }, 300); }; }
  document.querySelectorAll('[data-watch]').forEach(el => el.onclick = e => { e.stopPropagation(); toggleWatch(el.dataset.watch); });
  document.querySelectorAll('[data-open]').forEach(el => el.onclick = () => { S.open = el.dataset.open; render(); });
  document.querySelectorAll('[data-week]').forEach(el => el.onclick = e => { e.stopPropagation(); const v = Number(el.dataset.week); S.weekOffset = v === 0 ? 0 : S.weekOffset + v; render(); });
  const close = () => { S.open = null; render(); };
  $('#scrim') && ($('#scrim').onclick = close); $('#dclose') && ($('#dclose').onclick = close);
  $('#si-send') && ($('#si-send').onclick = async () => {
    const email = $('#si-email').value.trim(); if (!email) return;
    const { error } = await S.supa.auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin + location.pathname } });
    if (error) toast(error.message, true); else { toast('Check your email for the link'); $('#si-send').disabled = true; }
  });
  $('#st-save') && ($('#st-save').onclick = async () => {
    const prefs = { ...(S.user.prefs || {}), digest: $('#st-digest').value, hearing_alerts: $('#st-alerts').checked };
    const { error } = await S.supa.from('public_users').update({ prefs }).eq('id', S.user.id);
    if (error) toast(error.message, true); else { S.user.prefs = prefs; toast('Saved'); }
  });
  $('#st-delete') && ($('#st-delete').onclick = async () => {
    if (!confirm('Delete your account and your watchlist? This cannot be undone.')) return;
    const { error } = await S.supa.rpc('delete_my_account');
    if (error) { toast(error.message, true); return; }
    try { localStorage.removeItem(LOCAL_KEY); } catch { /* ignore */ }
    await S.supa.auth.signOut(); S.watch = new Set(); S.view = 'home'; toast('Account deleted'); render();
  });
}
document.addEventListener('keydown', e => { if (e.key === 'Escape' && S.open) { S.open = null; render(); } });
async function boot() {
  try { await loadUser(); await loadBills(); render(); }
  catch (e) { $('#app').innerHTML = `<div class="boot">Something went wrong: ${esc(e.message)}<br><br><button class="btn" onclick="location.reload()">Retry</button></div>`; }
}
init().then(boot);
