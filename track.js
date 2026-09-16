// ============================================================
// HIPHI Bill Tracker — public watch page (track.html)
// Anyone can search every bill and watch it. A free account (magic link)
// keeps the watchlist across devices and turns on email alerts. Reads only
// the public_* views; the account's own rows are the only thing it writes.
// Layout mirrors the staff home: summary line, Last 72 hours + Recent
// hearings, This week calendar, the three-column board, then the watchlist.
// ============================================================
import { billStop, COLUMNS, BOARD_EXPLAINER, CHAMBER_NAME } from './stops.js';
const SUPABASE_URL = 'https://eivzjbnygscguqqiiuvh.supabase.co';
const SUPABASE_KEY = 'sb_publishable_uvEtw8ru3zB9lDOxAjzrUA_JEFvKyul';
const DEMO = new URLSearchParams(location.search).has('demo');
const LOCAL_KEY = DEMO ? 'hiphi_watch_ids_demo' : 'hiphi_watch_ids';
// Sandbox (?demo=1): the real 2026 session frozen at Monday March 16, 2026,
// 9:00 HST, from demo/snapshot.json. Same file the staff sandbox uses; no
// account, no network writes, the watchlist lives in this browser only.
const DEMO_ASOF = '2026-03-16T09:00:00-10:00';
if (DEMO) {
  const RD = Date, off = RD.now() - new RD(DEMO_ASOF).getTime();
  window.Date = class extends RD { constructor(...a) { a.length ? super(...a) : super(RD.now() - off); } static now() { return RD.now() - off; } };
}
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const HST = 'Pacific/Honolulu';
const asDate = d => new Date(/^\d{4}-\d{2}-\d{2}$/.test(String(d)) ? d + 'T12:00:00-10:00' : d);   // a date-only value is a Hawaiʻi day
const fmtDate = (d, o) => d ? asDate(d).toLocaleString('en-US', { timeZone: HST, month: 'numeric', day: 'numeric', ...o }) : '';
const fmtDT = d => fmtDate(d, { weekday: 'short', hour: 'numeric', minute: '2-digit' });
const hstDay = d => new Date(d).toLocaleDateString('en-CA', { timeZone: HST });
const toast = (m, err) => { const el = document.createElement('div'); el.className = 'toastmsg' + (err ? ' err' : ''); el.textContent = m; $('#toast').appendChild(el); setTimeout(() => el.remove(), 3600); };
const blurb = (b, n = 110) => { const t = (b.hiphi_summary || b.description || b.title || '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1).replace(/\s\S*$/, '') + '…' : t; };
const inWhen = iso => { const ms = new Date(iso) - Date.now(); if (ms <= 0) return 'passed'; const h = Math.round(ms / 36e5); return h < 48 ? `in ${h}h` : `in ${Math.ceil(ms / 864e5)}d`; };
const clean = r => (r || 'room TBD').replace(/\s*via videoconference/i, '').replace(/^Conference Room\s+/i, 'Rm ').replace(/^CR\s+/i, 'Rm ');
const STAGE_LABEL = { introduced: 'Introduced', first_triple: '1st Triple', first_lateral: '1st Lateral', first_decking: '1st Decking',
  first_crossover: 'Crossed over', second_triple: '2nd Triple', second_lateral: '2nd Lateral', second_decking: '2nd Decking',
  second_crossover: 'Passed both', conference: 'Conference', governor: 'Governor', enacted: 'Law', vetoed: 'Vetoed', dead: 'Dead' };
// The same stages in plain language, for people who do not live at the Capitol.
const STAGE_PLAIN = { introduced: 'Introduced and waiting for its first committee hearing',
  first_triple: 'In its first committee; a triple-referred bill racing the Triple Filing deadline',
  first_lateral: 'In a committee of its first chamber, racing the Lateral deadline',
  first_decking: 'In the money committee of its first chamber, racing the Decking deadline',
  first_crossover: 'Passed its first chamber; now in the other chamber',
  second_triple: 'In its first committee of the second chamber, racing the Triple Filing deadline',
  second_lateral: 'In a committee of the second chamber, racing the Lateral deadline',
  second_decking: 'In the money committee of the second chamber, racing the Decking deadline',
  second_crossover: 'Passed both chambers; the two versions may need to be reconciled',
  conference: 'House and Senate negotiators are reconciling their versions',
  governor: 'On the Governor’s desk, waiting for signature or veto',
  enacted: 'Signed into law', vetoed: 'Vetoed by the Governor', dead: 'Did not advance this session' };
const RAIL = [['introduced', 'Intro'], ['first_lateral', '1st Lat'], ['first_decking', '1st Deck'], ['first_crossover', 'Cross'],
  ['second_lateral', '2nd Lat'], ['second_decking', '2nd Deck'], ['conference', 'Conf'], ['governor', 'Gov'], ['enacted', 'Law']];
const RAIL_IDX = { introduced: 0, first_triple: 1, first_lateral: 1, first_decking: 2, first_crossover: 3, second_triple: 4, second_lateral: 4,
  second_decking: 5, second_crossover: 5, conference: 6, governor: 7, enacted: 8, vetoed: 7, dead: null };
const COMMITTEE_STAGES = ['introduced', 'first_triple', 'first_lateral', 'first_decking', 'second_triple', 'second_lateral', 'second_decking'];
const SMALL = new Set(['a','an','and','as','at','but','by','for','in','of','on','or','the','to','via','with','nor','per','from']);
const titleCase = t => String(t || '').toLowerCase().split(/\s+/).map((w, i, a) => (i && i < a.length - 1 && SMALL.has(w.replace(/[^a-z]/g, ''))) ? w : w.replace(/(^|[-("'/])([a-z])/g, (m, p, c) => p + c.toUpperCase())).join(' ');
const POS = { support: 'Supports', support_amend: 'Supports with amendments', oppose: 'Opposes', neutral: 'Comments', monitor: 'Monitoring' };
const OUTCOME_LABEL = { passed: 'Passed', passed_amended: 'Passed with amendments', deferred: 'Deferred', recommitted: 'Recommitted' };
const OUTCOME_CLS = { passed: 'c-green', passed_amended: 'c-gold', deferred: 'c-red', recommitted: 'c-gray' };
const billNum = b => b.bill_number + (b.current_version ? ' ' + b.current_version : '');
const SHORTCUTS = [
  ['/', 'Jump to search'], ['j / k', 'Next / previous bill on the page'], ['Enter', 'Open the highlighted bill'],
  ['Esc', 'Close the bill, or clear the search'], ['w', 'Watch / unwatch the open or highlighted bill'],
  ['c', 'Copy a link to the open bill'], ['n / p', 'Next / previous week on the calendar'],
  ['g then h', 'Go home'], ['?', 'This help page'],
];

const S = { supa: null, session: null, user: null, watch: new Set(), bills: [], hearings: [], activity: [], deadlines: [],
  committees: {}, coalitions: [], outcomes: {}, view: 'home', q: '', results: null, browse: null, open: null, weekOffset: 0,
  extra: {}, xh: {}, slots: [] };

// ---------------- data ----------------
async function init() {
  if (DEMO) { await demoLoad(); return; }
  const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
  S.supa = createClient(SUPABASE_URL, SUPABASE_KEY);
  const { data } = await S.supa.auth.getSession(); S.session = data.session;
  S.supa.auth.onAuthStateChange((_e, sess) => { const had = !!S.session; S.session = sess; if (!!sess !== had) boot(); });
}
// ---------------- sandbox data ----------------
const D = { bills: [], index: [], hearings: [], activity: [], outcomes: [] };
async function demoLoad() {
  const snap = await (await fetch('demo/snapshot.json', { cache: 'force-cache' })).json();
  const campName = Object.fromEntries(snap.campaigns.map(c => [c.id, c]));
  const coalOf = {}; for (const r of snap.billCampaigns) { const c = campName[r.campaign_id]; if (c?.is_public) (coalOf[r.bill_id] ??= []).push(c.name); }
  const seed = id => [...id].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);
  // Shape tracked bills like public_all_bills; every tracked bill is public.
  D.bills = snap.bills.map(b => ({ id: b.id, bill_number: b.bill_number, session_year: b.session_year, chamber: b.chamber, title: b.title, description: b.description,
    committee: b.committee, referrals: b.referrals, stage: b.stage, last_action: b.last_action, last_action_date: b.last_action_date, state_url: b.state_url,
    sponsors: b.sponsors, companions: b.companions, origin_stops: b.origin_stops, second_stops: b.second_stops, current_version: b.current_version,
    died_deadline: b.died_deadline, died_at_stage: b.died_at_stage, hiphi_position: b.position, hiphi_summary: b.public_summary, hiphi_action: b.public_action,
    hiphi_follows: true, coalitions: coalOf[b.id] || [], watchers: b.priority === 1 ? 12 + seed(b.id) % 40 : seed(b.id) % 9 }));
  D.index = snap.index.map(b => ({ id: b.id, bill_number: b.bill_number, chamber: b.chamber, title: b.title, description: null, stage: 'introduced', referrals: [], sponsors: [], companions: [], coalitions: [], watchers: 0, hiphi_follows: false, sandbox_untracked: true }));
  D.hearings = snap.hearings.map(h => ({ ...h, bill_number: snap.bills.find(b => b.id === h.bill_id)?.bill_number }));
  D.activity = snap.activity.map(a => ({ bill_id: a.bill_id, title: a.title, details: a.details, occurred_at: a.occurred_at }));
  D.outcomes = snap.outcomes;
  S.deadlines = snap.deadlines.slice().sort((x, y) => x.deadline_date.localeCompare(y.deadline_date));
  S.committees = Object.fromEntries(snap.committees.map(c => [c.code, c]));
  S.slots = snap.slots;
  const counts = {}; for (const b of D.bills) for (const n of b.coalitions) counts[n] = (counts[n] || 0) + 1;
  S.coalitions = snap.campaigns.filter(c => c.is_public && counts[c.name]).map(c => ({ name: c.name, slug: c.slug, bills: counts[c.name] }));
  // A starter watchlist for a first visit: HIPHI's live priority bills with a hearing coming up.
  if (!localWatch().size) {
    const up = new Set(D.hearings.filter(h => new Date(h.scheduled_at) > Date.now()).map(h => h.bill_id));
    const pick = D.bills.filter(b => b.stage !== 'dead' && b.hiphi_position && b.hiphi_position !== 'monitor' && up.has(b.id)).slice(0, 6)
      .concat(D.bills.filter(b => b.stage === 'dead' && b.hiphi_position && b.hiphi_position !== 'monitor').slice(0, 2));
    S.watch = new Set(pick.map(b => b.id)); saveLocal();
  }
}
const dmatch = (b, q) => { const ql = q.toLowerCase(), qn = ql.replace(/\s/g, ''); return b.bill_number.toLowerCase().includes(qn) || (b.title || '').toLowerCase().includes(ql) || (b.description || '').toLowerCase().includes(ql); };
function localWatch() { try { return new Set(JSON.parse(localStorage.getItem(LOCAL_KEY) || '[]')); } catch { return new Set(); } }
function saveLocal() { try { localStorage.setItem(LOCAL_KEY, JSON.stringify([...S.watch])); } catch { /* private mode */ } }
async function loadUser() {
  S.user = null;
  if (DEMO || !S.session) { S.watch = localWatch(); return; }
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
  if (DEMO) {
    const w = new Set(ids);
    S.bills = D.bills.filter(b => w.has(b.id)); S.hearings = D.hearings.filter(h => w.has(h.bill_id));
    S.activity = D.activity.filter(a => w.has(a.bill_id)).sort((x, y) => y.occurred_at.localeCompare(x.occurred_at));
    S.outcomes = Object.fromEntries(D.outcomes.filter(o => w.has(o.bill_id)).map(o => [o.hearing_id, o]));
    return;
  }
  if (!ids.length) { S.bills = []; S.hearings = []; S.activity = []; S.outcomes = {}; }
  else {
    const [b, h, a, o] = await Promise.all([
      S.supa.from('public_all_bills').select('*').in('id', ids),
      S.supa.from('public_all_hearings').select('*').in('bill_id', ids),
      S.supa.from('public_activity').select('*').in('bill_id', ids).order('occurred_at', { ascending: false }).limit(300),
      S.supa.from('public_hearing_outcomes').select('*').in('bill_id', ids),
    ]);
    S.bills = b.data || []; S.hearings = h.data || []; S.activity = a.data || [];
    S.outcomes = Object.fromEntries((o.data || []).map(x => [x.hearing_id, x]));
  }
  if (!S.deadlines.length) {
    const [d, c, sl, co] = await Promise.all([S.supa.from('public_deadlines').select('*'), S.supa.from('public_committees').select('*'),
      S.supa.from('public_committee_slots').select('*'), S.supa.from('public_coalitions').select('*')]);
    S.slots = sl.data || [];
    S.deadlines = (d.data || []).sort((x, y) => x.deadline_date.localeCompare(y.deadline_date));
    S.committees = Object.fromEntries((c.data || []).map(x => [x.code, x]));
    S.coalitions = (co.data || []).filter(x => x.bills > 0);
  }
}
async function toggleWatch(id) {
  const on = S.watch.has(id);
  if (on) S.watch.delete(id); else S.watch.add(id);
  saveLocal();
  if (S.user && !DEMO) {
    const r = on ? await S.supa.from('watchlist').delete().eq('user_id', S.user.id).eq('bill_id', id)
                 : await S.supa.from('watchlist').insert({ user_id: S.user.id, bill_id: id });
    if (r.error) { toast(r.error.message, true); if (on) S.watch.add(id); else S.watch.delete(id); saveLocal(); return; }
  }
  await loadBills(); render();
}
async function search(q) {
  if (DEMO) return [...D.bills.filter(b => dmatch(b, q)), ...D.index.filter(b => dmatch(b, q))].slice(0, 25);
  const safe = q.replace(/[%,()]/g, ' ').trim();
  const { data, error } = await S.supa.from('public_all_bills').select('*')
    .or(`bill_number.ilike.%${safe.replace(/\s/g, '')}%,title.ilike.%${safe}%,description.ilike.%${safe}%`)
    .order('bill_number').limit(25);
  if (error) throw error; return data;
}
// Every public bill HIPHI has tagged with a coalition (public_all_bills.coalitions).
async function browseCoalition(name) {
  if (DEMO) { S.browse = { name, rows: D.bills.filter(b => b.coalitions.includes(name)) }; S.results = null; S.q = ''; return; }
  const { data, error } = await S.supa.from('public_all_bills').select('*').contains('coalitions', [name]).order('bill_number').limit(200);
  if (error) throw error;
  S.browse = { name, rows: data || [] }; S.results = null; S.q = '';
}
// A bill opened from search, browse, or a #bill= link is not in S.bills, so
// its hearings and outcomes are fetched on demand and kept in S.xh.
async function openBill(id, known) {
  S.open = id;
  if (known && !S.bills.some(b => b.id === id)) S.extra[id] = known;
  if (DEMO && !S.bills.some(b => b.id === id) && !S.xh[id]) { S.xh[id] = D.hearings.filter(h => h.bill_id === id); D.outcomes.filter(o => o.bill_id === id).forEach(o => { S.outcomes[o.hearing_id] = o; }); }
  if (!DEMO && !S.bills.some(b => b.id === id) && !S.xh[id]) {
    const [h, o] = await Promise.all([S.supa.from('public_all_hearings').select('*').eq('bill_id', id), S.supa.from('public_hearing_outcomes').select('*').eq('bill_id', id)]);
    S.xh[id] = h.data || []; (o.data || []).forEach(x => { S.outcomes[x.hearing_id] = x; });
  }
  const b = findBill(id); if (b) history.replaceState(null, '', '#bill=' + b.bill_number.replace(/\s/g, ''));
  render();
}
function closeBill() { S.open = null; history.replaceState(null, '', location.pathname + location.search); render(); }
async function openFromHash() {
  const m = /bill=([A-Za-z]+\s?\d+)/.exec(decodeURIComponent(location.hash));
  if (!m) return;
  const num = m[1].replace(/\s/g, '').toUpperCase();
  const local = S.bills.find(b => b.bill_number === num);
  if (local) { await openBill(local.id); return; }
  if (DEMO) { const b = D.bills.find(x => x.bill_number === num) || D.index.find(x => x.bill_number === num); if (b) await openBill(b.id, b); else toast(`No bill ${num} this session`, true); return; }
  const { data } = await S.supa.from('public_all_bills').select('*').eq('bill_number', num).limit(1);
  if (data?.[0]) await openBill(data[0].id, data[0]); else toast(`No bill ${num} this session`, true);
}

// ---------------- helpers ----------------
const bill = id => S.bills.find(b => b.id === id);
const findBill = id => bill(id) || (S.results || []).find(x => x.id === id) || (S.browse?.rows || []).find(x => x.id === id) || S.extra[id] || null;
const hearingsOf = b => [...S.hearings.filter(h => h.bill_id === b.id), ...(S.xh[b.id] || [])].sort((x, y) => x.scheduled_at.localeCompare(y.scheduled_at));
const isTriple = b => (b.origin_stops || 0) >= 3 || (b.second_stops || 0) >= 3;
function stopOf(b) {
  return billStop(b, { hearings: hearingsOf(b), outcomes: S.outcomes || {},
    deadlineFor: key => { const d = S.deadlines.filter(x => x.key === key).slice(-1)[0]; return d ? { label: d.label, date: d.deadline_date } : null; } });
}
function nextDeadline(b) { const st = stopOf(b); return st.phase === 'committee' && st.deadline && !st.deadline.missed ? st.deadline : null; }
const alive = b => !['dead', 'vetoed', 'enacted', 'governor'].includes(b.stage || '') && !/deferred|failed to pass/i.test(b.last_action || '');
const posCls = b => ({ support: 'pos-support', support_amend: 'pos-support', oppose: 'pos-oppose', neutral: 'pos-neutral' }[b.hiphi_position] || 'pos-none');
const watchBtn = b => `<button class="watchbtn ${S.watch.has(b.id) ? 'on' : ''}" data-watch="${b.id}">${S.watch.has(b.id) ? '★ Watching' : '☆ Watch'}</button>`;
// "First Lateral 2/20/26" -> a sentence a neighbour would understand.
function whyDead(b) {
  if (b.stage !== 'dead' && alive(b)) return '';
  const m = /^(.*?)\s+(\d+\/\d+\/\d+)$/.exec(b.died_deadline || '');
  if (m) return `Missed the ${m[1]} deadline on ${m[2]}${b.committee ? ` while waiting in ${esc(b.committee)}` : ''}.`;
  if (b.died_deadline) return `Missed the ${esc(b.died_deadline)} deadline.`;
  if (/deferred/i.test(b.last_action || '')) return 'Deferred by the committee, which ends it for the year.';
  if (/failed to pass/i.test(b.last_action || '')) return 'Failed a floor vote.';
  return b.stage === 'vetoed' ? 'Vetoed by the Governor.' : 'Did not advance.';
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
const chairOf = code => { const c = S.committees[String(code || '').split('/')[0]]; if (!c?.chair) return '';
  const last = c.chair.replace(/^(rep\.|sen\.|representative|senator)\s+/i, '').replace(/\s*(jr\.?|sr\.?|ii|iii|iv)$/i, '').trim().split(/\s+/).pop();
  const title = c.chamber === 'S' ? 'Sen.' : 'Rep.';
  return ` · Chair <a class="chairmail" href="mailto:${c.chamber === 'S' ? 'sen' : 'rep'}${esc(last.toLowerCase().replace(/[^a-z]/g, ''))}@capitol.hawaii.gov" onclick="event.stopPropagation()" title="Email the chair">${title} ${esc(last)}</a>`; };
const RAIL_SHORT = { introduced: 'Intro', first_triple: '1st Triple', first_lateral: '1st Lat', first_decking: '1st Deck', first_crossover: 'Cross',
  second_triple: '2nd Triple', second_lateral: '2nd Lat', second_decking: '2nd Deck', conference: 'Conf', governor: 'Gov', enacted: 'Law' };
// A triple-referred bill gets its Triple stop in that chamber, before Lateral.
const railFor = b => { const r = ['introduced']; if ((b.origin_stops || 0) >= 3) r.push('first_triple');
  r.push('first_lateral', 'first_decking', 'first_crossover'); if ((b.second_stops || 0) >= 3) r.push('second_triple');
  r.push('second_lateral', 'second_decking', 'conference', 'governor', 'enacted'); return r; };
function rail(b) {
  const r = railFor(b);
  let st = b.stage || 'introduced'; if (st === 'dead' && b.died_at_stage) st = b.died_at_stage;
  if (!alive(b) && st === 'introduced') st = r.includes('first_triple') ? 'first_triple' : 'first_lateral';   // died before its first hearing
  const alias = { second_crossover: 'conference', vetoed: 'governor', dead: 'introduced', first_triple: 'first_lateral', second_triple: 'second_lateral' };
  if (!r.includes(st)) st = alias[st] || 'introduced';
  const idx = Math.max(0, r.indexOf(st));
  const dead = !alive(b) && !['enacted', 'governor'].includes(b.stage || '');
  return `<div class="pv-rail">${r.map((s, i) => `<div class="pv-stop ${i < idx ? 'done' : ''} ${i === idx && !dead ? 'now' : (i === idx ? 'done' : '')}"><span class="sq"></span><span class="sl">${RAIL_SHORT[s]}</span></div>`).join('')}</div>`;
}
// Add-to-calendar: an .ics the phone opens in its own calendar, plus a Google
// Calendar link. One hour, room only, bill title in the description.
function calLinks(b, h) {
  const stamp = d => new Date(d).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const start = new Date(h.scheduled_at), end = new Date(start.getTime() + 3600e3);
  const title = `${billNum(b)} · ${h.committee} hearing`;
  const details = `${titleCase(b.title)}\nWritten testimony due ${h.testimony_deadline ? fmtDT(h.testimony_deadline) : '24 hours before'}.\n${b.state_url || ''}`;
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//HIPHI Bill Tracker//EN', 'BEGIN:VEVENT', `UID:${h.id}@hiphi-tracker`,
    `DTSTAMP:${stamp(Date.now())}`, `DTSTART:${stamp(start)}`, `DTEND:${stamp(end)}`, `SUMMARY:${title}`, `LOCATION:${clean(h.room)}`,
    `DESCRIPTION:${details.replace(/\n/g, '\\n')}`, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
  const g = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${stamp(start)}/${stamp(end)}&location=${encodeURIComponent(clean(h.room))}&details=${encodeURIComponent(details)}`;
  return `<span class="callinks"><a class="btn sm ghost" href="data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}" download="${esc(b.bill_number)}-${esc(h.committee)}.ics" onclick="event.stopPropagation()">＋ Calendar</a><a class="gcal" href="${g}" target="_blank" rel="noopener" onclick="event.stopPropagation()">Google</a></span>`;
}
const outcomeChip = h => { const o = S.outcomes[h.id]; return o?.outcome ? `<span class="chipx ${OUTCOME_CLS[o.outcome] || 'c-gray'}">${OUTCOME_LABEL[o.outcome] || o.outcome}</span>` : (new Date(h.scheduled_at) < Date.now() ? '<span class="chipx c-gray">no report yet</span>' : ''); };

// ---------------- render ----------------
function chrome(inner) {
  const who = DEMO ? `<span title="The real 2026 session, frozen at March 16. Nothing here is saved.">sandbox · March 16, 2026</span>`
    : S.session ? `<span>${esc(S.session.user.email)}</span><button data-nav="settings">Settings</button><button id="signout">Sign out</button>`
    : `<button data-nav="signin">Sign in</button>`;
  return `<div class="top pub"><span class="logo" data-nav="home" style="cursor:pointer"><span class="mark">☀</span>HIPHI Bill Tracker<small>watch</small></span>
      <span class="who"><button data-nav="help" title="Help and keyboard shortcuts (?)">Help</button>${who}</span></div>
    <div class="pubwrap">${inner}</div>`;
}
const resultRow = b => `
      <div class="row prow" data-open="${b.id}"><span class="bno">${esc(billNum(b))}</span>
        <span class="t">${esc(titleCase(b.title))}<small>${b.description || b.hiphi_summary ? esc(blurb(b, 120)) : ''}${b.hiphi_follows ? ' · HIPHI follows this bill' : ''}${(b.coalitions || []).length ? ' · ' + esc(b.coalitions.join(', ')) : ''}${b.watchers ? ` · ${b.watchers} watching` : ''}${!alive(b) ? ' · <span class="hot">did not advance</span>' : ''}</small></span>
        ${watchBtn(b)}</div>`;
function searchBox() {
  const chips = S.coalitions.length ? `<div class="browse">Browse HIPHI’s coalitions: ${S.coalitions.map(c => `<button class="fchip ${S.browse?.name === c.name ? 'on' : ''}" data-browse="${esc(c.name)}">${esc(c.name)} <span class="cnt">${c.bills}</span></button>`).join('')}${S.browse ? '<button class="fchip" data-browse="">✕ clear</button>' : ''}</div>` : '';
  return `<div class="search"><input type="search" id="q" placeholder="Search any Hawaiʻi bill by number (SB123) or words in the title…" value="${esc(S.q)}"></div>${chips}
    ${S.results ? `<div class="results">${S.results.length ? S.results.map(resultRow).join('') : '<div class="row" style="color:var(--muted)">No bill matches. Try the number, like HB1563, or a word from the title.</div>'}</div>` : ''}
    ${S.browse ? `<div class="panel"><div class="ph"><span>${esc(S.browse.name)} <span class="chipx c-gray">${S.browse.rows.length}</span></span><span class="psub">bills HIPHI works on with this coalition · press Watch to add one</span></div><div class="results" style="border:0;margin:0">${S.browse.rows.length ? S.browse.rows.map(resultRow).join('') : '<div class="row" style="color:var(--muted)">Nothing public in this coalition yet.</div>'}</div></div>` : ''}`;
}
function home() {
  const now = Date.now();
  if (!S.watch.size) return `
    <div class="pubhead"><h1>Watch the bills you care about</h1></div>
    ${searchBox()}
    <div class="hint"><b>How it works.</b> Search any bill in the ${S.deadlines[0]?.session_year || new Date().getFullYear()} Hawaiʻi Legislature, or browse a coalition, and press Watch. This page then shows you their hearings this week, where each one stands against the session's deadlines, and what changed in the last three days. Sign in with your email to keep your list on every device and get hearing alerts by email. HIPHI's positions appear on bills where we have published one.</div>`;
  const hUp = S.hearings.filter(h => h.status === 'scheduled' && new Date(h.scheduled_at) > now).sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
  const wk = now + 7 * 864e5;
  const mondayOf = t => { const d = new Date(hstDay(t) + 'T12:00:00-10:00'); return t - ((d.getUTCDay() + 6) % 7) * 864e5; };
  const off = S.weekOffset, wkStart = mondayOf(now + off * 7 * 864e5), wkEnd = wkStart + 7 * 864e5;   // always a Mon–Sun week, so paging never skips a day
  const week = S.hearings.filter(h => h.status !== 'cancelled' && new Date(h.scheduled_at) >= new Date(hstDay(wkStart) + 'T00:00:00-10:00') && new Date(h.scheduled_at) < new Date(hstDay(wkEnd) + 'T00:00:00-10:00'))
    .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
  const all7 = [...Array(7)].map((_, i) => hstDay(wkStart + i * 864e5));
  const isWeekend = d => [0, 6].includes(new Date(d + 'T12:00:00-10:00').getDay());
  const days = all7.filter(d => !isWeekend(d) || week.some(h => hstDay(h.scheduled_at) === d));
  const wkLabel = off === 0 ? 'This week' : off === 1 ? 'Next week' : off === -1 ? 'Last week' : 'Week of ' + fmtDate(hstDay(wkStart) + 'T12:00:00-10:00', { month: 'short' });
  const calRow = h => { const b = bill(h.bill_id); if (!b) return ''; const dueSoon = h.testimony_deadline && (new Date(h.testimony_deadline) - now) < 48 * 3600e3 && new Date(h.testimony_deadline) > now; const past = new Date(h.scheduled_at) < now; return `
    <div class="prow calrow ${posCls(b)}" data-open="${b.id}">
      <span class="caltime">${new Date(h.scheduled_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: HST })}</span>
      <div class="pmain"><b>${esc(billNum(b))}</b> <span class="cm">${esc(h.committee)} · ${esc(clean(h.room))}</span>${past ? `<div class="tagline">${outcomeChip(h)}</div>` : ''}
        <div class="pdesc">${esc(blurb(b, 96))}</div>
        <div class="psmall">${h.testimony_deadline && !past ? (inWhen(h.testimony_deadline) === 'passed' ? 'testimony deadline passed' : `written testimony due <b${dueSoon ? ' class="hot"' : ''}>${inWhen(h.testimony_deadline)}</b>`) : ''}</div></div>
      <div class="calbtns">${b.state_url && alive(b) && !past ? `<a class="btn sm ghost" href="${esc(b.state_url)}" target="_blank" rel="noopener" onclick="event.stopPropagation()">Submit testimony ↗</a>` : ''}${!past ? calLinks(b, h) : ''}</div>
    </div>`; };
  const calHtml = `<div class="calweek" style="--ndays:${days.length}">${days.map(d => { const hs = week.filter(h => hstDay(h.scheduled_at) === d); const dt = new Date(d + 'T12:00:00-10:00'); const isToday = d === hstDay(now), isPast = d < hstDay(now); return `
    <div class="calday${hs.length ? '' : ' nohear'}${isToday ? ' today' : ''}${isPast ? ' past' : ''}"><div class="calrail"><span class="dow">${dt.toLocaleDateString('en-US', { weekday: 'short', timeZone: HST })}</span><span class="dom">${dt.getDate()}</span>${isToday ? '<span class="tod">today</span>' : ''}${hs.length ? `<span class="cnt">${hs.length}</span>` : ''}</div>
      <div class="calbody">${hs.length ? hs.map(calRow).join('') : '<div class="calnone">no hearings</div>'}</div></div>`; }).join('')}</div>`;
  const calNav = `<span class="calnav"><button data-week="-1" title="Previous week (p)">‹</button>${off ? '<button data-week="0">Today</button>' : ''}<button data-week="1" title="Next week (n)">›</button></span>`;

  // board
  const cur = S.deadlines.find(d => new Date(d.deadline_date + 'T23:59:59-10:00') > now) || null;
  const cols = { a: [], b: [], c: [] };
  for (const b of S.bills.filter(alive)) { const st = stopOf(b); if (st.column) cols[st.column].push({ b, st, h: st.hearing, dl: st.deadline }); }
  const { a, b: bcol, c } = cols;
  a.sort((x, y) => (x.dl ? x.dl.days : 999) - (y.dl ? y.dl.days : 999)); bcol.sort((x, y) => x.h.scheduled_at.localeCompare(y.h.scheduled_at));
  const stopn = st => `<span class="stopn">${CHAMBER_NAME[st.chamber]}${st.stops ? ` · stop ${st.stop} of ${st.stops}` : ''}</span>`;
  const phaseLabel = st => st.phase === 'conference' ? 'Conference' : `${CHAMBER_NAME[st.chamber]} floor`;
  const chip = (b, cls, stop, l2) => `<div class="chip3 ${posCls(b)}" data-open="${b.id}"><span class="l1"><b>${esc(billNum(b))}</b><span class="cm">${cls}</span></span><span class="lstop">${stop}</span><span class="ldesc">${esc(blurb(b, 120))}</span><span class="l2">${l2}</span></div>`;
  const col = (key, rows, empty) => { const C = COLUMNS[key]; return `<div class="panel bcol bcol-${key}" id="pf-board-${key}"><div class="ph"><span>${C.icon} ${C.title} <span class="cnt">${rows.length}</span></span><span class="psub">${C.sub}</span></div>${rows.length ? `<div class="chips">${rows.join('')}</div>` : `<div class="pempty">${empty}</div>`}</div>`; };
  const dlDays = cur ? Math.ceil((new Date(cur.deadline_date + 'T23:59:59-10:00') - now) / 864e5) : null;
  const board = cur ? `
    <div class="dashhead boardhead"><h1>Where your bills stand</h1><span class="sub">Next deadline: <b>${esc(cur.label)}</b> · ${fmtDate(cur.deadline_date + 'T12:00:00-10:00')} · <b>${dlDays}d</b> away. A bill still in committee needs a hearing before its deadline or it dies.</span></div>
    <p class="boardhow">${BOARD_EXPLAINER}</p>
    <div class="board3">
      ${col('a', a.map(({ b, st, dl }) => { const sl = dl && st.committee ? lastSlotBefore(st.committee, dl.date, S.slots) : null; return chip(b, st.committee ? esc(st.committee) + chairOf(st.committee) : 'awaiting referral', stopn(st), (dl ? (dl.days <= 5 ? `<span class="hot">${esc(dl.label)} in ${dl.days}d</span>` : `${esc(dl.label)} in ${dl.days}d (${fmtDate(dl.date + 'T12:00:00-10:00')})`) : 'no deadline on the calendar') + (sl ? (now > sl.noticeBy ? ' · <span class="hot">notice window closed — only the chair can still schedule it</span>' : ` · last slot ${fmtDT(sl.at)} · notice by ${fmtDT(sl.noticeBy)}`) : '')); }), 'Every bill you watch has a hearing or is through committee.')}
      ${col('b', bcol.map(({ b, st, h }) => chip(b, esc(h.committee), stopn(st), st.hearingState === 'held' ? `held ${fmtDate(h.scheduled_at)} · waiting for the report` : fmtDT(h.scheduled_at) + (h.testimony_deadline && new Date(h.testimony_deadline) > now ? ` · testimony due ${inWhen(h.testimony_deadline)}` : ''))), 'No hearings on the books.')}
      ${col('c', c.map(({ b, st }) => chip(b, phaseLabel(st), `${st.stops ? `through ${st.stops} ${CHAMBER_NAME[st.chamber]} committee${st.stops === 1 ? '' : 's'}` : ''}${st.deadline && !st.deadline.missed ? ` · ${esc(st.deadline.label)} ${fmtDate(st.deadline.date + 'T12:00:00-10:00')}` : ''}`, esc((b.last_action || '').slice(0, 60)))), 'Nothing is through committee yet.')}
    </div>` : '';

  // feed + recent hearings (top dash, like the staff page)
  const recent = S.activity.filter(ev => now - new Date(ev.occurred_at) < 72 * 3600e3);
  const feed = `<div class="panel sec-feed" id="pf-recent"><div class="ph"><span>⚡ Last 72 hours <span class="chipx c-gray">${recent.length}</span></span><span class="psub">newest first</span></div>
    ${recent.length ? `<div class="tl72">${recent.slice(0, 20).map(ev => { const b = bill(ev.bill_id); return `<div class="tlrow ${/hearing/i.test(ev.title) ? 'notice' : /reading|passed|failed|vetoed|signed|act \d+/i.test(ev.title) ? 'vote' : 'ref'}" data-open="${b.id}"><span class="tldot"></span><span class="tlts">${esc(fmtDT(ev.occurred_at))}</span><div class="tltext"><b>${esc(billNum(b))}</b> ${esc(ev.title.slice(0, 100))}<span class="tltitle">${esc(blurb(b, 100))}</span></div></div>`; }).join('')}</div>` : '<div class="pempty">Nothing happened on your bills in the last three days.</div>'}</div>`;
  const recentH = S.hearings.filter(h => h.status !== 'cancelled' && new Date(h.scheduled_at) <= now && new Date(h.scheduled_at) > now - 7 * 864e5).sort((x, y) => y.scheduled_at.localeCompare(x.scheduled_at));
  const recentHearings = `<div class="panel" id="pf-outcomes"><div class="ph"><span>🏛 Recent hearings <span class="chipx c-gray">${recentH.length}</span></span><span class="psub">what the committee did</span></div>
    ${recentH.length ? recentH.slice(0, 10).map(h => { const b = bill(h.bill_id); if (!b) return ''; const o = S.outcomes[h.id]; return `<div class="prow ${posCls(b)}" data-open="${b.id}"><div class="pmain"><b>${esc(billNum(b))}</b> · ${esc(h.committee)} · ${fmtDT(h.scheduled_at)} ${outcomeChip(h)}<div class="pdesc">${o?.report ? esc(o.report.slice(0, 110)) : esc(blurb(b, 110))}</div></div></div>`; }).join('') : '<div class="pempty">No hearings on your bills in the last week.</div>'}</div>`;

  const due48 = hUp.filter(h => h.testimony_deadline && new Date(h.testimony_deadline) > now && new Date(h.testimony_deadline) - now < 48 * 3600e3).length;
  const liveBills = S.bills.filter(alive).sort((x, y) => x.bill_number.localeCompare(y.bill_number));
  const deadBills = S.bills.filter(b => !alive(b)).sort((x, y) => x.bill_number.localeCompare(y.bill_number));
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: HST });
  const strip = [`${S.watch.size} watched`, due48 ? `<a data-jump="pf-week" class="hot">${due48} testimony deadline${due48 === 1 ? '' : 's'} in 48h</a>` : null,
    `<a data-jump="pf-week">${week.length} hearing${week.length === 1 ? '' : 's'} this week</a>`, a.length ? `<a data-jump="pf-board-a">${a.length} need a hearing</a>` : null,
    recent.length ? `<a data-jump="pf-recent">${recent.length} action${recent.length === 1 ? '' : 's'} in 72h</a>` : null,
    cur ? `next deadline <b>${esc(cur.label)}</b> in ${dlDays}d` : null, S.user || DEMO ? null : '<a data-nav="signin">sign in</a> to keep this list everywhere'].filter(Boolean).join(' · ');
  const watchRow = b => `<div class="prow ${posCls(b)}" data-open="${b.id}"><div class="pmain"><b>${esc(billNum(b))}</b> <span class="chipx c-gray" title="${esc(STAGE_PLAIN[b.stage] || '')}">${STAGE_LABEL[b.stage] || 'Introduced'}</span>${b.hiphi_position ? ` <span class="chipx c-teal">HIPHI ${POS[b.hiphi_position] || ''}</span>` : ''}<div class="pdesc">${esc(blurb(b, 120))}</div>${!alive(b) ? `<div class="psmall">${whyDead(b)}</div>` : ''}</div>${watchBtn(b)}</div>`;
  return `
    <div class="pubhead"><h1>Your watchlist</h1><span class="sub">${today} · ${strip}</span></div>
    ${searchBox()}
    <div class="dash"><div>${feed}</div><div>${recentHearings}</div></div>
    <div class="panel sec-cal" id="pf-week"><div class="ph"><span>◷ ${wkLabel} ${calNav}</span><span class="psub">hearings on the bills you watch · add any to your calendar</span></div>${(week.length || off) ? calHtml : '<div class="pempty">No hearings on your bills in the next 7 days.</div>'}</div>
    ${board}
    <div class="panel" id="pf-list"><div class="ph"><span>★ Your watchlist</span><span class="psub">${liveBills.length} live · tap a bill for details</span></div>
      ${liveBills.map(watchRow).join('') || '<div class="pempty">None of your bills are still moving.</div>'}</div>
    ${deadBills.length ? `<details class="panel dead fold" id="pf-dead"><summary class="ph"><span>🪦 Did not advance <span class="chipx c-gray">${deadBills.length}</span></span><span class="psub">why each one stopped</span></summary>${deadBills.map(watchRow).join('')}</details>` : ''}`;
}
function testifyBox() {
  let seen = false; try { seen = localStorage.getItem('hiphi_testify_seen') === '1'; localStorage.setItem('hiphi_testify_seen', '1'); } catch { /* ignore */ }
  return `<details class="testify" ${seen ? '' : 'open'}><summary><b>How to testify</b> <span class="muted">— takes about five minutes</span></summary>
    <ol><li>Written testimony is due <b>24 hours before the hearing</b>. Late testimony is still posted but committees may not read it.</li>
    <li>Open the bill on the Capitol site and press <b>Submit Testimony</b>. You need a free capitol.hawaii.gov account (email and password).</li>
    <li>Choose the hearing, then upload a file or type into the box. Say who you are, the bill number, whether you <b>support</b> or <b>oppose</b>, and why in a few sentences. Personal stories carry weight.</li>
    <li>Tick “testify in person” or “remotely” if you want to speak; two minutes is typical.</li></ol></details>`;
}
function panelFor(b) {
  const hs = hearingsOf(b);
  const now = Date.now();
  const dl = alive(b) ? nextDeadline(b) : null;
  return `<div class="scrim" id="scrim"></div><div class="drawer"><div class="dhead"><button class="close" id="dclose" title="Close (Esc)">✕</button>
      <h2>${esc(b.bill_number.replace(/^(\D+)/, '$1 '))}${b.current_version ? ` <span class="chipx c-navy" title="The draft the bill is currently on">${esc(b.current_version)}</span>` : ''}</h2><div class="sub">${esc(titleCase(b.title))}</div>
      <div class="hchips">${b.hiphi_position ? `<span class="chipx c-teal">HIPHI ${POS[b.hiphi_position] || ''}</span>` : ''}${(b.coalitions || []).map(c => `<span class="chipx c-gray">${esc(c)}</span>`).join('')}<span class="chipx c-gray">${b.watchers || 0} watching</span>${watchBtn(b)}<button class="chipx tool" data-copylink="${b.id}" title="Copy a link to this bill (c)">🔗 Copy link</button></div></div>
    <div class="dbody">
      <div class="status"><div class="stagenow">${STAGE_LABEL[b.stage] || 'Introduced'}<span class="lastact">${esc(b.last_action || '')} <span class="when">${fmtDate(b.last_action_date, { year: '2-digit' })}</span></span></div>${rail(b)}
        <p class="plain">${esc(alive(b) ? stopOf(b).says : whyDead(b))}</p></div>
      ${b.hiphi_action ? `<div class="next"><span class="nk">ASK</span><div>${esc(b.hiphi_action)}</div></div>` : ''}
      ${b.sandbox_untracked ? '<p class="desc"><i>Sandbox: this bill is not on HIPHI’s list, so its history and hearings are not loaded here. In the live app every bill is complete.</i></p>' : ''}
      <div class="sec">Summary</div><p class="desc">${esc(b.hiphi_summary || b.description || 'No summary available yet.')}</p>
      <div class="sec">Details</div>
      <div class="kv"><span class="k">Committees</span><span>${esc((b.referrals || []).join(', ') || b.committee || '—')}</span></div>
      ${b.sponsors?.length ? `<div class="kv"><span class="k">Sponsors</span><span>${esc(b.sponsors.slice(0, 8).map(x => typeof x === 'string' ? x : x.n || x.name || '').filter(Boolean).join(', '))}</span></div>` : ''}
      ${b.companions?.length ? `<div class="kv"><span class="k">Companion</span><span>${esc(b.companions.join(', '))}</span></div>` : ''}
      ${b.current_version ? `<div class="kv"><span class="k">Version</span><span>${esc(b.current_version)} — the bill has been amended ${b.current_version.replace(/\D/g, '')} time${b.current_version.replace(/\D/g, '') === '1' ? '' : 's'} in the ${/^H/.test(b.current_version) ? 'House' : /^S/.test(b.current_version) ? 'Senate' : 'conference committee'}</span></div>` : ''}
      <div class="sec">Hearings</div>
      ${!alive(b) ? `<p class="desc"><i>This bill did not advance. Hearings listed below are historical.</i></p>` : ''}
      ${hs.length ? hs.map(h => { const past = new Date(h.scheduled_at) < now; return `<div class="prow"><div class="pmain"><b>${esc(h.committee)}</b> · ${fmtDT(h.scheduled_at)} · ${esc(clean(h.room))}${h.status !== 'scheduled' ? ` · ${esc(h.status)}` : ''} ${past ? outcomeChip(h) : ''}${chairOf(h.committee)}
        <div class="psmall">${h.testimony_deadline && !past ? 'written testimony due ' + fmtDT(h.testimony_deadline) : ''}${S.outcomes[h.id]?.report ? esc(S.outcomes[h.id].report.slice(0, 140)) : ''}${h.notice_url ? ` · <a href="${esc(h.notice_url)}" target="_blank" rel="noopener">notice ↗</a>` : ''}</div>
        ${!past && h.status === 'scheduled' ? `<div class="calbtns">${b.state_url && alive(b) ? `<a class="btn sm ghost" href="${esc(b.state_url)}" target="_blank" rel="noopener">Submit testimony ↗</a>` : ''}${calLinks(b, h)}</div>` : ''}</div></div>`; }).join('') : '<p class="desc"><i>No hearings on record.</i></p>'}
      ${alive(b) ? testifyBox() : ''}
      <p style="margin-top:12px">${b.state_url ? `<a class="btn sm ghost" href="${esc(b.state_url)}" target="_blank" rel="noopener">Capitol bill page ↗</a>` : ''}</p>
    </div></div>`;
}
function signin() {
  return `<div class="pubhead"><h1>Sign in</h1></div>
    <div class="signin">
      <p>Enter your email and we send a sign-in link. No password. Your watchlist follows you to any device, and you can turn on email alerts for hearings on your bills.</p>
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
function help() {
  const row = (k, v) => `<div class="krow"><kbd>${esc(k)}</kbd><span>${esc(v)}</span></div>`;
  const dls = S.deadlines.filter(d => new Date(d.deadline_date + 'T23:59:59-10:00') > Date.now());
  return `<div class="pubhead"><h1>Help</h1></div><div class="settings help pub">
    <section><h2>What this page does</h2>
      <p>Search any bill in the Hawaiʻi Legislature and press <b>Watch</b>. Your watchlist page then shows the week’s hearings on those bills (with an add-to-calendar button), where each bill stands against the session’s deadlines, what happened in the last 72 hours, and what each committee decided. Sign in with your email to keep the list on every device and get an email when a hearing is scheduled.</p>
      <p>Share a bill with a link like <code>${esc(location.origin + location.pathname)}#bill=HB1563</code>. It opens straight to that bill.</p></section>
    <section><h2>Stages, in plain language</h2>${Object.entries(STAGE_PLAIN).map(([k, v]) => `<div class="krow"><b>${esc(STAGE_LABEL[k])}</b><span>${esc(v)}</span></div>`).join('')}</section>
    <section><h2>Deadlines this session</h2>
      <p>Bills must clear each stage by the session calendar’s dates or they die. The board shows the deadline each bill is racing and the last regular committee meeting before it. Committees must post a hearing notice 48 hours ahead, so a bill without a notice two days before that last meeting is very likely done.</p>
      ${dls.length ? dls.map(d => `<div class="krow"><b>${esc(d.label)}</b><span>${fmtDate(d.deadline_date + 'T12:00:00-10:00', { weekday: 'short', month: 'short' })}</span></div>`).join('') : '<p class="muted">The session has ended; dates for the next session appear when the Legislature publishes them.</p>'}</section>
    <section><h2>How to testify</h2>${testifyBox().replace('<details class="testify"', '<details class="testify" open')}</section>
    <section><h2>Keyboard shortcuts</h2>${SHORTCUTS.map(([k, v]) => row(k, v)).join('')}<p class="muted" style="font-size:12px">Shortcuts are off while you are typing in a field.</p></section>
    <section><h2>Privacy</h2><p>Without an account, your watchlist lives only in this browser. With one, we keep your email address and the list of bills you watch, nothing else. HIPHI staff see how many people watch each bill, never who. Delete your account from Settings at any time; it removes everything immediately.</p></section>
    <section><h2>About</h2><p>Built by the Hawaiʻi Public Health Institute. Bill data comes from the Legislature’s public records and refreshes several times a day. Positions marked HIPHI are ours; everything else is the public record. Questions: <a href="mailto:info@hiphi.org">info@hiphi.org</a>.</p></section>
  </div>`;
}
function render() {
  const inner = S.view === 'signin' ? signin() : S.view === 'settings' && S.session ? settings() : S.view === 'help' ? help() : home();
  const b = S.open && findBill(S.open);
  $('#app').innerHTML = chrome(inner) + (b ? panelFor(b) : '');
  wire();
}
function wire() {
  document.querySelectorAll('[data-nav]').forEach(el => el.onclick = () => { S.view = el.dataset.nav; S.open = null; render(); window.scrollTo(0, 0); });
  $('#signout') && ($('#signout').onclick = async () => { await S.supa.auth.signOut(); S.view = 'home'; });
  if (DEMO && S.view === 'signin') { S.view = 'home'; toast('Sign-in is off in the sandbox'); render(); return; }
  const q = $('#q');
  if (q) { let t; q.oninput = () => { S.q = q.value; clearTimeout(t); t = setTimeout(async () => {
      if (S.q.trim().length < 2) { S.results = null; render(); return; }
      try { S.browse = null; S.results = await search(S.q.trim()); render(); const el = $('#q'); if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); } }
      catch (e) { toast(e.message, true); } }, 300); }; }
  document.querySelectorAll('[data-watch]').forEach(el => el.onclick = e => { e.stopPropagation(); toggleWatch(el.dataset.watch); });
  document.querySelectorAll('[data-open]').forEach(el => el.onclick = () => openBill(el.dataset.open));
  document.querySelectorAll('[data-browse]').forEach(el => el.onclick = async () => { if (!el.dataset.browse) { S.browse = null; render(); return; } try { await browseCoalition(el.dataset.browse); render(); } catch (e) { toast(e.message, true); } });
  document.querySelectorAll('[data-jump]').forEach(el => el.onclick = () => document.getElementById(el.dataset.jump)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  document.querySelectorAll('[data-copylink]').forEach(el => el.onclick = async e => { e.stopPropagation(); const b = findBill(el.dataset.copylink); if (!b) return;
    const url = `${location.origin}${location.pathname}#bill=${b.bill_number}`;
    try { await navigator.clipboard.writeText(url); toast('Link copied'); } catch { prompt('Copy this link', url); } });
  document.querySelectorAll('[data-week]').forEach(el => el.onclick = e => { e.stopPropagation(); const v = Number(el.dataset.week); S.weekOffset = v === 0 ? 0 : S.weekOffset + v; const y = window.scrollY; render(); window.scrollTo(0, y); });
  $('#scrim') && ($('#scrim').onclick = closeBill); $('#dclose') && ($('#dclose').onclick = closeBill);
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
// ---------------- keyboard ----------------
let pendingG = 0;
document.addEventListener('keydown', e => {
  const tag = (e.target.tagName || '').toLowerCase();
  const typing = tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable;
  if (e.key === 'Escape') {
    if (typing) { e.target.blur(); if (S.q) { S.q = ''; S.results = null; render(); } return; }
    if (S.open) { closeBill(); return; }
    if (S.results || S.browse) { S.q = ''; S.results = null; S.browse = null; render(); }
    return;
  }
  if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
  const k = e.key;
  if (k === '/') { e.preventDefault(); const q = $('#q'); if (q) { q.focus(); q.select(); } else { S.view = 'home'; render(); $('#q')?.focus(); } return; }
  if (k === '?') { e.preventDefault(); S.view = S.view === 'help' ? 'home' : 'help'; S.open = null; render(); return; }
  if (k === 'g') { pendingG = Date.now(); return; }
  if (pendingG && Date.now() - pendingG < 1200) { pendingG = 0; if (k === 'h') { S.view = 'home'; S.open = null; render(); } return; }
  if (k === 'n' || k === 'p') { const btn = document.querySelector(`[data-week="${k === 'n' ? 1 : -1}"]`); if (btn) btn.click(); return; }
  if (k === 'w') { const id = S.open || document.querySelector('.kfocus[data-open]')?.dataset.open; if (id) toggleWatch(id); return; }
  if (k === 'c' && S.open) { document.querySelector('[data-copylink]')?.click(); return; }
  if (k === 'j' || k === 'k') {
    const rows = [...document.querySelectorAll('.pubwrap [data-open]')]; if (!rows.length) return;
    e.preventDefault();
    const cur = rows.findIndex(r => r.classList.contains('kfocus'));
    const next = cur < 0 ? 0 : Math.min(rows.length - 1, Math.max(0, cur + (k === 'j' ? 1 : -1)));
    rows.forEach(r => r.classList.remove('kfocus')); rows[next].classList.add('kfocus');
    rows[next].scrollIntoView({ block: 'nearest', behavior: 'smooth' }); return;
  }
  if (k === 'Enter' || k === 'o') { const r = document.querySelector('.kfocus[data-open]'); if (r) { e.preventDefault(); openBill(r.dataset.open); } }
});
async function boot() {
  try { await loadUser(); await loadBills(); render(); await openFromHash(); }
  catch (e) { $('#app').innerHTML = `<div class="boot">Something went wrong: ${esc(e.message)}<br><br><button class="btn" onclick="location.reload()">Retry</button></div>`; }
}
window.addEventListener('hashchange', openFromHash);
init().then(boot);
