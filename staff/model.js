// HIPHI Staff v2: derived logic (no DOM writes). A VERBATIM copy of the current staff app's pure helpers (app.js at
// commit ac1acb7: filters and facets, deadlines and risk, drafts and their steps, legislators and stances, the weekly
// memo, people search and CSV, inbox rows, alert helpers), with `export` added and the two UI calls in loadTriage
// routed through hooks. v2's own logic (Today, review queue) lives in the screen modules that use it.
import { $, DB, DEADLINES, DEMO, S, SESSION_OVER, SESSION_YEAR, STAGE_LABEL, SUPABASE_KEY, SUPABASE_URL, advocate, billStop, effStage, esc, fmtDT, fmtDate, hearingStream, hooks, isMine } from './data.js';
import { CHAMBER_NAME } from '../stops.js';
export const POS_GROUP = { strongly_support: 'support', support: 'support', support_amend: 'support', strongly_oppose: 'oppose', oppose: 'oppose', neutral: 'neutral' };
export let FACTS = new Map();
export function factsOf(b) {
  let f = FACTS.get(b.id); if (f) return f;
  const now = Date.now(), dead = diedish(b), st = dead ? null : stopOf(b);
  f = { pri: b.priority || 0, pos: POS_GROUP[b.position] || 'monitor', posx: b.position || 'monitor', camps: S.billCampaigns[b.id] || [], triple: isTriple(b),
    lsts: (S.listBills || []).filter(x => x.bill_id === b.id).map(x => x.list_id),
    stand: dead ? 'dead' : st.column || (['governor', 'enacted'].includes(effStage(b)) ? 'done' : 'c'),
    risk: !!st && !SESSION_OVER && b.position !== 'monitor' && st.column === 'a' && !!st.deadline && !st.deadline.missed && st.deadline.days <= RISK_DAYS,
    hear: S.hearings.some(h => h.bill_id === b.id && h.status !== 'cancelled' && new Date(h.scheduled_at) > now && new Date(h.scheduled_at) - now < 7 * 864e5) };
  FACTS.set(b.id, f); return f;
}
export const facets = () => [
  { key: 'pris', label: 'Priority', opts: [[1, 'P1'], [2, 'P2'], [3, 'P3']], has: (f, v) => f.pri === v },
  // every position the team can take, strongest first (Nate, 9/18: Strongly support and Strongly oppose were missing)
  { key: 'poss', label: 'Our position', opts: [['strongly_support', 'Strongly support'], ['support', 'Support'], ['support_amend', 'Support with amendments'], ['strongly_oppose', 'Strongly oppose'], ['oppose', 'Oppose'], ['neutral', 'Comments'], ['monitor', 'Monitor']], has: (f, v) => f.posx === v },
  { key: 'stands', label: 'Where it stands', opts: [['a', 'Needs a hearing'], ['b', 'Hearing scheduled'], ['c', 'Through committee'], ['done', 'Governor or law'], ['dead', 'Did not advance']], has: (f, v) => f.stand === v },
  { key: 'camps', label: 'Coalition', opts: S.campaigns.map(c => [c.id, c.name]), has: (f, v) => f.camps.includes(v) },
  { key: 'lsts', label: 'List', opts: (S.lists || []).map(l => [l.id, l.title]), has: (f, v) => f.lsts.includes(v) },
];
export const FLAGS = [['riskF', 'At risk', 'no hearing yet and the deadline is a week away or less', f => f.risk], ['hearF', 'Hearing this week', 'a hearing in the next 7 days', f => f.hear], ['tripleF', 'Triple-referred', 'three committees in one chamber', f => f.triple],
  // Named for what stays, not what goes. Off by default: dead bills already sort to the bottom, so nothing vanishes unasked.
  ['aliveF', 'Still alive', 'leave out bills that died, were vetoed or missed a deadline', f => f.stand !== 'dead']];
export function passes(b, skip) {
  const f = factsOf(b);
  for (const g of facets()) if (g.key !== skip && S[g.key].size && ![...S[g.key]].some(v => g.has(f, v))) return false;
  for (const [k, , , test] of FLAGS) if (k !== skip && S[k] && !(k === 'aliveF' && S.view === 'dead') && !test(f)) return false;
  return !S.stageF || effStage(b) === S.stageF;
}
export const hearingAhead = b => S.hearings.filter(h => h.bill_id === b.id && h.status === 'scheduled' && new Date(h.scheduled_at) > Date.now()).sort((x, y) => x.scheduled_at.localeCompare(y.scheduled_at))[0];
export function lensBills(owner = S.owner) {
  let list = S.bills;
  if (owner === 'me' && S.me) list = list.filter(isMine);
  else if (owner && owner !== 'all' && owner !== 'me') list = list.filter(b => (S.assignments[b.id]||[]).includes(owner));
  if (S.q) { const q = S.q.toLowerCase(), qn = q.replace(/\s/g,'');
    list = list.filter(b => b.bill_number.toLowerCase().includes(qn) || (b.title||'').toLowerCase().includes(q)); }
  return list;
}
export const codesOf = code => String(code || '').split('/').map(c => c.trim()).filter(Boolean);
export const cmteName = code => codesOf(code).map(c => S.committees?.[c]?.name || c).join(' / ');
export const streamOf = h => hearingStream(h, S.committees?.[codesOf(h.committee)[0]]?.chamber);
export function deadlineCalendar() {
  return Object.entries(DEADLINES).flatMap(([phase, arr]) => arr.map(([label, date]) => ({ phase, label, date })))
    .sort((a, b) => a.date.localeCompare(b.date));
}
export function currentDeadline() {
  const now = Date.now();
  return deadlineCalendar().find(d => new Date(d.date + 'T23:59:59-10:00') > now) || null;
}
export function billDeadline(b) {
  return stopOf(b).deadline;
}
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

export const gateName = g => /^(first|second)_/.test(g.phase) && /^(Lateral|Decking|Triple filing)$/.test(g.label) ? `${g.phase.startsWith('first') ? 'First' : 'Second'} ${g.label.toLowerCase()}` : g.label;
export function sessionGates(list) {
  const now = Date.now(), endOf = d => new Date(d + 'T23:59:59-10:00').getTime();
  const live = list.filter(b => b.position !== 'monitor' && !diedish(b)).map(b => ({ b, st: stopOf(b) }));
  const dead = list.filter(b => diedish(b) && b.position !== 'monitor');
  const tag = g => { const d = new Date(g.date + 'T12:00:00-10:00'); return `${g.label} ${d.getUTCMonth() + 1}/${d.getUTCDate()}/${String(d.getUTCFullYear()).slice(2)}`; };
  let nextSeen = false;
  return deadlineCalendar().map(g => { const past = endOf(g.date) < now, next = !past && !nextSeen; if (next) nextSeen = true;
    const racing = past ? [] : live.filter(x => x.st.deadline && !x.st.deadline.missed && x.st.deadline.date === g.date);
    const noHearing = racing.filter(x => x.st.column === 'a');
    return { ...g, name: gateName(g), past, next, days: Math.floor((endOf(g.date) - now) / 864e5), racing, noHearing,
      p1: noHearing.filter(x => x.b.priority === 1).length, stopped: past ? dead.filter(b => b.died_deadline === tag(g)).length : 0 }; });
}
export const railFor = b => { const r = ['introduced']; if ((b.origin_stops || 0) >= 3) r.push('first_triple');
  r.push('first_lateral', 'first_decking', 'first_crossover'); if ((b.second_stops || 0) >= 3) r.push('second_triple');
  r.push('second_lateral', 'second_decking', 'second_crossover', 'governor', 'enacted'); return r; };
export const railIdx = (b, rail) => { let st = effStage(b);
  if (st === 'dead' && b.died_at_stage) st = b.died_at_stage;
  // Died before its first hearing: it was racing the Triple (or Lateral) date, so mark that stop.
  if (diedish(b) && st === 'introduced') st = rail.includes('first_triple') ? 'first_triple' : 'first_lateral';
  const alias = { conference: 'second_crossover', vetoed: 'governor', dead: 'introduced', first_triple: 'first_lateral', second_triple: 'second_lateral' };
  if (!rail.includes(st)) st = alias[st] || 'introduced';
  return Math.max(0, rail.indexOf(st)); };
export const DK_COMMITTEE = ['introduced','first_triple','first_lateral','first_decking',
  'second_triple','second_lateral','second_decking'];
export const DK_CROSSED = ['first_crossover','second_crossover','conference'];
export const dkOutcome = b => {
  const st = effStage(b);
  if (st === 'enacted') return 'law';
  if (st === 'vetoed') return 'vetoed';
  if (st === 'governor') return 'governor';
  if (st === 'dead' || /deferred|failed to pass/i.test(b.last_action || '')) return 'died';
  return null;                       // still somewhere in the process
};
export function legislativeDay(at = Date.now()) {
  const cal = (S.sessionCal || []).find(c => c.session_year === SESSION_YEAR); if (!cal || !cal.opening_day) return null;
  const off = new Set((cal.off_days || []).map(d => String(d).slice(0, 10)));
  const today = hstDayOf(at), end = cal.sine_die ? String(cal.sine_die).slice(0, 10) : null;
  if (today < String(cal.opening_day).slice(0, 10) || (end && today > end)) return null;
  let n = 0, total = 0, isDay = false;
  for (let d = new Date(String(cal.opening_day).slice(0, 10) + 'T12:00:00-10:00'); ; d.setUTCDate(d.getUTCDate() + 1)) {
    const k = d.toISOString().slice(0, 10); if (end ? k > end : total > 80) break;
    const dow = new Date(k + 'T12:00:00-10:00').getUTCDay(); const counts = dow !== 0 && dow !== 6 && !off.has(k);
    if (counts) { total++; if (k <= today) n++; if (k === today) isDay = true; }
    if (!end && total >= 60) break;
  }
  return { day: n, of: total, today: isDay, text: isDay ? `Legislative day ${n} of ${total}` : `Recess · ${n} of ${total} legislative days done` };
}
export const hstDayOf = t => new Date(t).toLocaleDateString('en-CA', { timeZone: 'Pacific/Honolulu' });
export const RADAR_DAYS = 14;
export const RADAR_STAGES = ['introduced','first_triple','first_lateral','first_decking',
                      'second_triple','second_lateral','second_decking'];
export function stopOf(b) {
  return billStop(b, { stage: effStage(b), hearings: S.hearings.filter(h => h.bill_id === b.id), outcomes: S.outcomes || {},
    deadlineFor: key => { const last = key === 'final_decking' ? (DEADLINES.conference || [])[0] : (DEADLINES[key] || []).slice(-1)[0]; return last ? { label: last[0], date: last[1] } : null; } });
}
export const RISK_DAYS = 7;
export const ATTEND_ASKS = false;   // "Someone needs to attend" rows in Action needed
export function riskOf(b) {
  if (SESSION_OVER || b.position === 'monitor' || diedish(b)) return null;
  const st = stopOf(b);
  return st.column === 'a' && st.deadline && !st.deadline.missed && st.deadline.days <= RISK_DAYS ? st : null;
}
export const atRisk = b => !!riskOf(b);
export const nextDeadline = b => { const st = stopOf(b); return st.phase === 'committee' && st.deadline && !st.deadline.missed ? st.deadline : null; };
export const isTriple = b => (b.origin_stops || 0) >= 3 || (b.second_stops || 0) >= 3;
export function whyDead(b) {
  const m = /^(.*?)\s+(\d+\/\d+\/\d+)$/.exec(b.died_deadline || '');
  if (m) return `Missed the ${esc(m[1])} deadline on ${m[2]}${b.committee ? ` while waiting in ${esc(b.committee)}` : ''}.`;
  if (b.died_deadline) return `Missed the ${esc(b.died_deadline)} deadline.`;
  if (/deferred/i.test(b.last_action || '')) return 'Deferred by the committee, which ends it for the year.';
  if (/failed to pass/i.test(b.last_action || '')) return 'Failed a floor vote.';
  return effStage(b) === 'vetoed' ? 'Vetoed by the Governor.' : 'Did not advance.';
}
export const diedish = b => { const st = effStage(b);
  if (st === 'dead' || st === 'vetoed') return true;
  if (S.hearings.some(h => h.bill_id === b.id && new Date(h.scheduled_at) > new Date())) return false;
  if (/deferred|failed to pass/i.test(b.last_action || '')) return true;
  return SESSION_OVER && !['enacted','governor'].includes(st); };
export const tierOf = b => {
  const p = b.position;
  if ((p === 'support' || p === 'oppose') && b.priority === 1) return 0;   // strongly
  if (p === 'strongly_support' || p === 'support' || p === 'support_amend' || p === 'strongly_oppose' || p === 'oppose' || p === 'neutral') return 1;
  return 2;                                                                 // monitor / unset
};
export const posLabel = b => {
  const strong = b.priority === 1 ? 'STRONGLY ' : '';
  return { strongly_support: 'STRONGLY SUPPORT', strongly_oppose: 'STRONGLY OPPOSE', support: strong + 'SUPPORT', support_amend: 'SUPPORT W/ AMENDMENTS',
    oppose: strong + 'OPPOSE', neutral: 'COMMENT', monitor: 'MONITOR' }[b.position] || 'MONITOR';
};
export const WORKFLOW_KINDS = [['chat', 'Someone wrote in the chat on a bill I own, follow or took part in'], ['draft_created', 'A draft was created for one of my bills'],
  ['review_requested', 'Someone submitted testimony for my approval'],
  ['second_review_requested', 'A first-time testimony needs my second approval'],
  ['approved', 'Testimony I submitted was approved'],
  ['changes_requested', 'A reviewer asked me for changes'],
  ['filed', 'Someone marked testimony filed']];
export const TEMPLATE_KINDS = [['hearing_alert', 'Hearing alert (per bill)'], ['hearing_rescheduled', 'Hearing moved'],
  ['hearing_cancelled', 'Hearing cancelled'], ['draft_thread', 'Draft ready (thread reply)'],
  ['reminder_morning', 'Reminder: morning of deadline'], ['reminder_before', 'Reminder: hours before'],
  ['reminder_after', 'Reminder: deadline passed'], ['daily_head', 'Daily list heading'], ['daily_empty', 'Daily list, nothing due']];
export const TOKENS = '{{bill}} {{title}} {{position}} {{priority}} {{owner}} {{committee}} {{hearing}} {{room}} {{deadline}} {{deadline_time}} {{hours}} {{status}} {{draft}} {{tracker}} {{pdf}} {{days}} {{date}}';
export const INTERESTS = [['testify', 'Would testify in person'], ['story', 'Has a story to share'], ['quote', 'May be quoted'], ['host', 'Could host or help at an event'], ['volunteer', 'Wants to volunteer']];
export const ISLANDS = ['Oʻahu', 'Maui', 'Hawaiʻi', 'Kauaʻi'];
export const personName = p => p.name || p.email.split('@')[0];
export const whereOf = p => [p.island, p.senate_district ? `SD ${p.senate_district}` : '', p.house_district ? `HD ${p.house_district}` : ''].filter(Boolean).join(' · ');
export const sortPeople = (rows, by) => rows.slice().sort((a, b) => by === 'score' ? (b.score || 0) - (a.score || 0) : by === 'newest' ? String(b.created_at).localeCompare(String(a.created_at)) : by === 'name' ? personName(a).localeCompare(personName(b)) : String(b.last_active || '').localeCompare(String(a.last_active || '')));
export function parsePeopleCSV(text) {
  const lines = []; let cur = [], field = '', inQ = false;
  for (let i = 0; i < text.length; i++) { const c = text[i];
    if (inQ) { if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; } else field += c; }
    else if (c === '"') inQ = true; else if (c === ',') { cur.push(field); field = ''; } else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; cur.push(field); lines.push(cur); cur = []; field = ''; } else field += c; }
  if (field || cur.length) { cur.push(field); lines.push(cur); }
  const head = (lines.shift() || []).map(h => h.trim().toLowerCase());
  const col = (...names) => head.findIndex(h => names.some(n => h === n || h.includes(n)));
  const ci = { email: col('email', 'e-mail'), name: col('full name', 'name'), first: col('first'), last: col('last', 'surname'), phone: col('phone', 'mobile', 'cell'), tags: col('tags', 'groups', 'labels'), interests: col('interests'), optin: col('opt', 'subscribed', 'action alerts', 'consent', 'status') };
  const yes = x => /^(yes|true|1|subscribed|opted?[ -]?in|active)$/i.test(String(x || '').trim());
  const rows = [];
  for (const l of lines) { if (ci.email < 0) break; const email = (l[ci.email] || '').trim(); if (!email.includes('@')) continue;
    const name = ci.name >= 0 && !(ci.name === ci.first) ? (l[ci.name] || '').trim() : [l[ci.first], l[ci.last]].filter(Boolean).join(' ').trim();
    rows.push({ email, name: name || null, phone: ci.phone >= 0 ? (l[ci.phone] || '').trim() || null : null,
      tags: ci.tags >= 0 ? (l[ci.tags] || '').split(/[;,|]/).map(x => x.trim()).filter(Boolean) : [], interests: ci.interests >= 0 ? (l[ci.interests] || '').split(/[;,|]/).map(x => x.trim().toLowerCase()).filter(x => INTERESTS.some(([k]) => k === x)) : [],
      action_alerts: ci.optin >= 0 ? yes(l[ci.optin]) : null }); }
  return { rows, cols: head };
}
export function exportPeopleCSV(rows) {
  const q = x => `"${String(x ?? '').replace(/"/g, '""')}"`;
  const head = ['name', 'email', 'phone', 'island', 'senate_district', 'house_district', 'account', 'action_alerts', 'bills_followed', 'actions', 'emails_sent', 'emails_opened', 'tags', 'interests', 'last_active', 'engagement'];
  const lines = [head.join(',')].concat(rows.map(p => [p.name, p.email, p.phone, p.island, p.senate_district, p.house_district, p.has_account ? 'yes' : 'no', p.action_optin ? 'yes' : 'no', (p.bill_ids || []).map(id => billById(id)?.bill_number || '').filter(Boolean).join(' '), p.actions, p.emails_sent, p.emails_opened, (p.tags || []).join('; '), (p.interests || []).join('; '), p.last_active ? String(p.last_active).slice(0, 10) : '', p.score].map(q).join(',')));
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + lines.join('\n')], { type: 'text/csv' })); a.download = `hiphi-people-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
}

export function parseTrackerCsv(text) {
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
export const unslack = t => String(t || '').replace(/<([^|>]+)\|([^>]+)>/g, '$2').replace(/<([^>]+)>/g, '$1').replace(/[*_]/g, '').replace(/\s+/g, ' ').trim();
export const billById = id => S.bills.find(b => b.id === id);
export const inboxCount = () => (S.inbox || []).filter(i => i.direct && i.unread).length;
export function inboxRows() {
  const v = S.inboxView ??= { tab: 'needs', kind: '', unreadOnly: false, sort: 'new', q: '', group: true };
  let rows = (S.inbox || []).filter(i => v.tab === 'all' || (v.tab === 'needs' ? i.direct : !i.direct));
  if (v.kind) rows = rows.filter(i => i.kind === v.kind);
  if (v.unreadOnly) rows = rows.filter(i => i.unread);
  if (v.q.trim()) { const q = v.q.trim().toLowerCase(); rows = rows.filter(i => [i.bill_number, i.title, i.body].join(' ').toLowerCase().includes(q)); }
  const cmp = v.sort === 'pri' ? (x, y) => (x.priority || 9) - (y.priority || 9) || String(y.at).localeCompare(String(x.at))
    : v.sort === 'bill' ? (x, y) => String(x.bill_number || 'zzz').localeCompare(String(y.bill_number || 'zzz'), 'en', { numeric: true }) || String(y.at).localeCompare(String(x.at))
    : (x, y) => (y.unread - x.unread) || String(y.at).localeCompare(String(x.at));
  return rows.sort(cmp);
}
// ---- the weekly memo (memo.js). Two audiences (R-022, wave 3 #19). The team's keeps where our testimony stands, in
// plain words. The partners' can go to a coalition as it is: HIPHI's position on every line, the Capitol's steps in
// plain words (plainAction, never its raw sentence cut mid-name), the coalition's public name, a link to each bill's
// public page and the public ask - and nothing internal (no testimony steps, owners or priorities).
// "At risk" is riskOf() (RISK_DAYS, 7 days), the same as Bills and Today; it used to mean 14 days here. The bills
// racing the deadline after it have their own heading, named for its day ("Needs a hearing by Mon 3/30").
const MEMO_SAYS = { strongly_support: 'HIPHI strongly supports', support: 'HIPHI supports', support_amend: 'HIPHI supports with changes',
  strongly_oppose: 'HIPHI strongly opposes', oppose: 'HIPHI opposes', neutral: 'HIPHI is commenting' };   // the public page's words (pub/core.js POS_SAYS)
const MEMO_TESTIMONY = { draft: 'being written', review: 'waiting for approval', second_review: 'waiting for a second approval', approved: 'approved, not filed yet', filed: 'filed' };
const memoDay = d => fmtDate(d, { weekday: 'short' }).replace(',', '');   // "Mon 3/30"
// The Capitol's step in plain words. The vote count goes first: it is where the old memo cut a name in half at 140
// characters ("…Representative(s) Garrett, Am"). A sentence plainAction has no words for is kept whole when short, or
// cut at a word.
function memoStep(t) {
  const s = String(t || '').replace(/\s+/g, ' ').replace(/[.;]?\s*(The votes were|\bAyes?[,:(]|\bAye\(s\)).*$/i, '').trim().replace(/\.$/, '');
  if (/Passed Final Reading/i.test(s)) return /amend/i.test(s) ? 'Passed final reading, amended' : 'Passed final reading';
  const [p] = plainAction(s);
  if (p !== s && !p.endsWith('…')) return p;
  return s.length <= 140 ? s : s.slice(0, 139).replace(/\s\S*$/, '').replace(/[,;:]$/, '') + '…';
}
export function memoData() {
  const v = S.memoView ??= { who: 'me', coalition: '', audience: 'team' }, partners = v.audience === 'partners', now = Date.now(), wk = 7 * 864e5;
  // The team's memo is about the reader's bills, the ones they own or follow ("Everyone" is one choice away). A partner
  // memo is about the coalition, whoever owns the bills, and only the ones where HIPHI has taken a position.
  const mine = !partners && v.who === 'me';
  const inScope = b => (partners ? !!MEMO_SAYS[b.position] : b.position !== 'monitor') && (!mine || isMine(b)) && (!v.coalition || (S.billCampaigns[b.id] || []).includes(v.coalition));
  const bills = S.bills.filter(inScope).sort((a, b) => (a.priority || 9) - (b.priority || 9) || a.bill_number.localeCompare(b.bill_number, 'en', { numeric: true }));
  const live = bills.filter(b => !diedish(b)), ids = new Set(bills.map(b => b.id));
  const short = b => { if (b.nickname) return b.nickname;   // the memo names a bill the way the team does
    const t = blurb(b, 400).replace(/[.…]+$/, ''); if (t.length <= 85) return t; const cut = t.slice(0, 85); return cut.slice(0, cut.lastIndexOf(' ')).replace(/[,;:]$/, '').replace(/\s+(a|an|the|of|to|for|and|or|in|on|as|by|with|that)$/i, '') + '…'; };
  // One line of the memo: the bill, HIPHI's position, then what the section says about it. A partner's line links the
  // bill's public page, where the bill is on it.
  const line = (b, text) => ({ num: billNum(b).replace(/^(\D+)/, '$1 '), name: short(b), text: `${MEMO_SAYS[b.position] ? MEMO_SAYS[b.position] + '. ' : ''}${text}`,
    href: partners && b.is_public && b.tracked !== false ? `${PUBLIC_APP()}#/bill/${b.bill_number.replace(/\s/g, '')}` : '' });
  const more = (n, what = 'more') => n > 0 ? [`…and ${n} ${what}.`] : [];
  const when = x => x.days <= 0 ? 'today' : x.days === 1 ? 'tomorrow' : `${x.days} days`;
  const monday = (() => { const d = new Date(hstDayOf(now) + 'T12:00:00-10:00'); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7)); return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'Pacific/Honolulu' }); })();
  const coal = v.coalition ? S.campaigns.find(c => c.id === v.coalition) : null, coalName = coal ? coal.public_name || coal.name : '';
  const clock = sessionClock(bills), g = sessionGates(bills).find(x => !x.past);
  const title = `${coal ? coalName + ': w' : 'W'}eek of ${monday}${g ? `, ${g.days <= 0 ? g.name + ' is today' : `${when(g)} to ${g.name.toLowerCase()}`}` : ''}`;
  const ld = legislativeDay(), p1 = bills.filter(b => b.priority === 1).length;
  // The next two deadlines, as Bills shows them (decision 3).
  const race = (x, then) => `${x.racing}${then ? '' : ' must clear committee'} by ${x.name.toLowerCase()} on ${memoDay(x.date)}${x.noHearing.length ? ` (${x.noHearing.length} with no hearing yet)` : ''}`;
  const races = clock && clock.racing ? ` ${race(clock)}${clock.then ? `, and ${race(clock.then, true)}` : ''}.` : '';
  const who = partners ? `HIPHI has a position on ${bills.length} bill${bills.length === 1 ? '' : 's'}${coal ? ` in ${coalName}` : ''}` : `${v.who === 'me' ? 'You own or follow' : 'We have a position on'} ${bills.length} bill${bills.length === 1 ? '' : 's'}${p1 ? ` (${p1} top priority)` : ''}`;
  const intro = `${ld ? ld.text + '. ' : ''}${who}: ${live.length} still moving, ${bills.length - live.length} finished for the year.${races}`;
  const sections = [];
  // hearings in the next seven days. The team reads where our testimony stands; partners read when theirs is due.
  const hs = S.hearings.filter(h => ids.has(h.bill_id) && h.status !== 'cancelled' && new Date(h.scheduled_at) > now && new Date(h.scheduled_at) - now < wk).sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
  if (hs.length) sections.push(['Hearings this week', hs.map(h => { const b = billById(h.bill_id), d = draftFor(b.id, h.committee), open = h.testimony_deadline && new Date(h.testimony_deadline) > now;
    const at = `${h.committee} hearing ${fmtDT(h.scheduled_at)}${h.room ? ', ' + roomShortMemo(h.room) : ''}.`;
    if (partners) return line(b, `${at}${open ? ` Written testimony is due ${fmtDT(h.testimony_deadline)}.` : ''}`);
    return line(b, `${at} ${d ? `Our testimony is ${MEMO_TESTIMONY[d.status] || 'started'}` : 'No testimony started yet'}${(!d || !['filed', 'approved'].includes(d.status)) && open ? `, due ${fmtDT(h.testimony_deadline)}` : ''}.`); })]);
  // moved in the last seven days
  const sig = /pass(ed)? (second|third|final) reading|recommend(s|ed)? (that the measure be )?pass|reported from|transmitted to|received from|conference committee|enrolled|governor|became law|act \d+/i;
  const moved = live.filter(b => b.last_action_date && now - new Date(b.last_action_date + 'T12:00:00-10:00') < wk && sig.test(b.last_action || ''));
  if (moved.length) sections.push(['Moving', moved.slice(0, 12).map(b => line(b, `${memoStep(b.last_action)} (${fmtDate(b.last_action_date)}).`)).concat(more(moved.length - 12))]);
  // no hearing yet: at risk (riskOf, a week or less), then the bills racing the next deadline after that
  const waiting = live.map(b => ({ b, st: stopOf(b) })).filter(x => x.st.column === 'a' && x.st.deadline && !x.st.deadline.missed && !SESSION_OVER);
  const where = st => st.committee ? `Waiting in ${st.committee}` : `Waiting for a ${CHAMBER_NAME[st.chamber] || 'committee'} referral`;
  const risk = waiting.filter(x => riskOf(x.b)).sort((x, y) => x.st.deadline.days - y.st.deadline.days || (x.b.priority || 9) - (y.b.priority || 9));
  if (risk.length) sections.push(['At risk: no hearing yet', risk.slice(0, 12).map(({ b, st }) => line(b, `${where(st)}; needs a hearing by ${memoDay(st.deadline.date)} (${when(st.deadline)}).`)).concat(more(risk.length - 12, 'more in the same position'))]);
  const later = waiting.filter(x => !riskOf(x.b)), next = later.map(x => x.st.deadline.date).sort()[0];
  const racing = later.filter(x => x.st.deadline.date === next).sort((x, y) => (x.b.priority || 9) - (y.b.priority || 9) || x.b.bill_number.localeCompare(y.b.bill_number, 'en', { numeric: true }));
  if (racing.length) sections.push([`Needs a hearing by ${memoDay(next)}`, racing.slice(0, 12).map(({ b, st }) => line(b, `${where(st)}.`)).concat(more(racing.length - 12, 'more in the same position'))]);
  // stopped in the last seven days
  const died = bills.filter(b => { if (!diedish(b) || !b.died_deadline) return false; const m = /(\d+)\/(\d+)\/(\d+)$/.exec(b.died_deadline); if (!m) return false; const t = new Date(`20${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}T23:59:59-10:00`).getTime(); return now - t < wk && now >= t; });
  if (died.length) sections.push(['Did not advance this week', died.slice(0, 12).map(b => line(b, whyDead(b).replace(/<[^>]+>/g, '').replace(/&amp;/g, '&'))).concat(more(died.length - 12))]);
  // what supporters (and partners) can do: the ask on each bill's public page
  const today = hstDayOf(now), asks = live.filter(b => b.public_action && (DEMO || !b.public_action_until || b.public_action_until >= today));
  if (asks.length) sections.push(['How you can help', asks.slice(0, 8).map(b => ({ ...line(b, b.public_action.replace(/\s+/g, ' ').trim()), text: b.public_action.replace(/\s+/g, ' ').trim() }))]);
  // The foot points a partner at the coalition's own public page (a coalition's slug opens it, pub/find.js).
  const foot = partners && coal?.slug ? { text: `Every ${coalName} bill, with hearing dates and how to testify:`, href: `${PUBLIC_APP()}#/issue/${encodeURIComponent(coal.slug)}` }
    : { text: 'Every bill, with hearing dates and how to testify:', href: PUBLIC_APP() };
  return { title, intro, sections, foot, partners, empty: !sections.length };
}
export const roomShortMemo = r => String(r || '').replace(/Conference Room/i, 'Rm').replace(/\s*&.*$/, '').trim();
// Both copies come from the same lines. In plain text a partner's link goes on its own line under the bill; for email
// the bill number is the link. A line is an object; "…and 3 more" is a plain string.
const memoLineText = i => typeof i === 'string' ? '• ' + i : `• ${i.num} (${i.name}): ${i.text}${i.href ? `\n  ${i.href}` : ''}`;
const memoLineHTML = i => typeof i === 'string' ? `<li>${esc(i)}</li>`
  : `<li>${i.href ? `<a href="${esc(i.href)}" target="_blank" rel="noopener"><b>${esc(i.num)}</b></a>` : `<b>${esc(i.num)}</b>`} (${esc(i.name)}): ${esc(i.text)}</li>`;
export const memoText = m => [m.title.toUpperCase(), '', m.intro, ...m.sections.flatMap(([h, items]) => ['', h.toUpperCase(), ...items.map(memoLineText)]), '', `${m.foot.text} ${m.foot.href}`].join('\n');
export const memoHTML = m => `<h2>${esc(m.title)}</h2><p>${esc(m.intro)}</p>${m.sections.map(([h, items]) => `<h3>${esc(h)}</h3><ul>${items.map(memoLineHTML).join('')}</ul>`).join('')}<p>${esc(m.foot.text)} <a href="${esc(m.foot.href)}" target="_blank" rel="noopener">${esc(m.foot.href)}</a></p>`;
export const STANCES = [['yes', 'Yes', 'st-yes'], ['leaning_yes', 'Leaning yes', 'st-lean'], ['unknown', 'Unknown', 'st-unk'], ['leaning_no', 'Leaning no', 'st-leanno'], ['no', 'No', 'st-no']];
export const plain = t => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[ʻ‘’`]/g, '').toLowerCase();
export const legById = id => (S.legislators || []).find(l => l.id === Number(id));
export const legTitle = l => l.chamber === 'S' ? 'Sen.' : 'Rep.';
export const legsOf = code => { const cs = codesOf(code), rank = { chair: 0, vice_chair: 1, member: 2 }, by = new Map();
  for (const m of S.committeeMembers || []) { if (!cs.includes(m.committee)) continue; const l = legById(m.legislator_id); if (!l) continue;
    const x = by.get(l.id); if (!x) { by.set(l.id, { ...m, l, roles: { [m.committee]: m.role } }); continue; }
    x.roles[m.committee] = m.role; if (rank[m.role] < rank[x.role]) { x.role = m.role; x.committee = m.committee; } }
  return [...by.values()].sort((a, b) => rank[a.role] - rank[b.role] || cs.indexOf(a.committee) - cs.indexOf(b.committee) || a.l.sort_name.localeCompare(b.l.sort_name)); };
export const stanceOf = (billId, legId) => (S.stances || []).find(x => x.bill_id === billId && x.legislator_id === legId) || { stance: 'unknown', note: null, contact_id: null };
export const legsForSponsors = b => { const out = []; for (const sp of b.sponsors || []) { const raw = String(sp.n || sp.name || sp).replace(/\(.*?\)/g, '').trim(); if (!raw) continue;
  const key = raw.toLowerCase().replace(/[^a-z ]/g, '').trim(); const hit = (S.legislators || []).find(l => { const sn = l.sort_name.toLowerCase().split(',')[0].replace(/[^a-z ]/g, '').trim(); return sn === key || key.endsWith(' ' + sn) || key === sn.split(' ').pop(); });
  if (hit && !out.some(x => x.id === hit.id)) out.push(hit); } return out; };
export const legPhoto = (l, cls = 'lphoto') => l.photo_url ? `<img class="${cls}" src="${esc(l.photo_url)}" alt="" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'${cls} none',textContent:'${esc((l.name || '?')[0])}'}))">` : `<span class="${cls} none">${esc((l.name || '?')[0])}</span>`;
export const looksLikeAddress = q => /\d/.test(q) && q.trim().length >= 3;
export async function supaAnon() { if (S.supa) return S.supa; if (!S.supaAnon) { const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'); S.supaAnon = createClient(SUPABASE_URL, SUPABASE_KEY); } return S.supaAnon; }
export async function geoSuggest(q) { const { data, error } = await (await supaAnon()).rpc('address_suggest', { q, n: 8 }); if (error) throw error; return data || []; }
export async function geoDistricts(pt) { if (pt.sd && pt.hd) return { found: true, senate: pt.sd, house: pt.hd }; const { data } = await (await supaAnon()).rpc('districts_at', { lat: pt.lat, lon: pt.lon }); const d = data?.[0]; return { found: !!(d?.sd || d?.hd), senate: d?.sd, house: d?.hd }; }
export const ALERT_STATUS = { draft: ['Draft', 'c-gray'], returned: ['Sent back', 'c-red'], submitted: ['Waiting for approval', 'c-gold'], approved: ['Approved, not sent', 'c-teal'], sent: ['Sent', 'c-green'] };
export const alertsToReview = () => (S.alerts || []).filter(a => a.status === 'submitted' && S.me?.is_admin && a.author_id !== S.me?.id);
export const alertTarget = a => a.bill_id ? (billById(a.bill_id) ? billNum(billById(a.bill_id)) : 'a bill') : a.list_id ? ((S.lists || []).find(l => l.id === a.list_id)?.title || 'a list') : ((S.segments || []).find(x => x.id === a.segment_id)?.name || 'a segment');
export const RTE_TAGS = { P: 'p', DIV: 'p', BR: 'br', B: 'b', STRONG: 'b', I: 'i', EM: 'i', U: 'u', A: 'a', UL: 'ul', OL: 'ol', LI: 'li', H1: 'h3', H2: 'h3', H3: 'h3', H4: 'h3', BLOCKQUOTE: 'blockquote' };
export const escT = s => String(s ?? '').replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
export function cleanHTML(html) {
  const doc = new DOMParser().parseFromString(`<body>${html || ''}</body>`, 'text/html');
  const walk = node => { let out = '';
    for (const n of node.childNodes) {
      if (n.nodeType === 3) { out += escT(n.nodeValue); continue; }
      if (n.nodeType !== 1 || n.tagName === 'SCRIPT' || n.tagName === 'STYLE') continue;
      const t = RTE_TAGS[n.tagName], inner = walk(n);
      if (!t) { out += inner; continue; }                                   // span, font, table cells…: keep the text only
      if (t === 'br') { out += '<br>'; continue; }
      if (t === 'a') { const href = (n.getAttribute('href') || '').trim(); out += /^(https?:\/\/|mailto:)/i.test(href) ? `<a href="${escT(href).replace(/"/g, '&quot;')}">${inner}</a>` : inner; continue; }
      if (['p', 'h3', 'blockquote', 'li'].includes(t) && !inner.replace(/<br>|&nbsp;|\s/g, '')) continue;   // empty blocks add nothing in email
      if (t === 'p' && /^<(p|ul|ol|h3|blockquote)>/.test(inner)) { out += inner; continue; }                 // nested wrappers from paste
      out += `<${t}>${inner}</${t}>`;
    }
    return out; };
  return walk(doc.body).replace(/(<br>)+$/, '');
}
export function htmlToText(html) {
  const doc = new DOMParser().parseFromString(`<body>${html || ''}</body>`, 'text/html');
  const walk = node => { let out = '';
    for (const n of node.childNodes) {
      if (n.nodeType === 3) { out += n.nodeValue.replace(/\s+/g, ' '); continue; }
      if (n.nodeType !== 1) continue;
      const tag = n.tagName;
      if (tag === 'BR') { out += '\n'; continue; }
      if (tag === 'A') { const href = n.getAttribute('href') || '', t = walk(n).trim(); out += t && t !== href ? `${t} (${href})` : (t || href); continue; }
      if (tag === 'LI') { out += (n.parentNode.tagName === 'OL' ? `${[...n.parentNode.children].indexOf(n) + 1}. ` : '• ') + walk(n).trim() + '\n'; continue; }
      if (['P', 'H3', 'BLOCKQUOTE', 'UL', 'OL', 'DIV'].includes(tag)) { out += walk(n).replace(/^\n+|\n+$/g, '') + '\n\n'; continue; }
      out += walk(n);
    }
    return out; };
  return walk(doc.body).replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}
export const textToHtml = text => String(text || '').trim().split(/\n{2,}/).map(par => `<p>${escT(par).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>').replace(/\n/g, '<br>')}</p>`).join('');
export function alertTemplate(b, l, sg) {
  const who = S.me?.full_name?.split(' ')[0] || 'HIPHI';
  if (sg) return { subject: `A quick favour from HIPHI`, body: `Aloha,\n\n[What is happening and what would help, in a few sentences. Say which bill, the deadline, and the one thing to do.]\n\nMahalo,\n${who}` };
  if (b) { const h = S.hearings.filter(x => x.bill_id === b.id && x.status !== 'cancelled' && new Date(x.scheduled_at) > Date.now()).sort((x, y) => x.scheduled_at.localeCompare(y.scheduled_at))[0];
    return { subject: `${billNum(b).replace(/^(\D+)/, '$1 ')}: ${h ? `hearing ${fmtDT(h.scheduled_at)} — please testify` : 'a quick favour'}`,
      body: `Aloha,\n\nYou follow ${billNum(b).replace(/^(\D+)/, '$1 ')}, ${blurb(b, 160)}\n\n${h ? `It will be heard by ${h.committee} on ${fmtDT(h.scheduled_at)}${h.room ? ' in ' + roomShort(h.room) : ''}.${h.testimony_deadline ? ` Written testimony is due ${fmtDT(h.testimony_deadline)}.` : ''}\n\n` : ''}${(b.public_action || '').trim() ? b.public_action.trim() + '\n\n' : 'Here is what would help: [the ask, in one or two sentences]\n\n'}Two sentences in your own words are enough. The link below opens the bill with a five-minute way to testify.\n\nMahalo,\n${who}` }; }
  return { subject: `${l.title}: a quick favour from HIPHI`, body: `Aloha,\n\nYou follow HIPHI’s ${l.title} list.\n\n[What is happening and what would help, in a few sentences.]\n\nMahalo,\n${who}` };
}
export const PUBLIC_APP = () => new URL('track.html', location.href).href.split('?')[0];
export async function loadTriage() {
  S.triage ??= { camp: null, matchedOnly: true, rows: null, counts: null, focus: 0, last: null };
  try {
    const [rows, counts] = await Promise.all([DB.triageQueue(S.triage.camp, S.triage.matchedOnly), DB.triageCounts()]);
    S.triage.rows = rows; S.triage.counts = counts; S.triage.focus = Math.min(S.triage.focus, Math.max(0, rows.length - 1));
  } catch (e) { S.triage.rows = []; hooks.toast('Could not load the triage queue: ' + e.message, true); }
  if (S.view === 'triage' || S.view === 'add') { const q = $('#addq'), val = q?.value || '', pos = q?.selectionStart; hooks.render(); const n = $('#addq'); if (n && val) { n.value = val; n.setSelectionRange(pos, pos); } }
}
export const triageSeen = () => { if (S.triageFirstVisit) return false; try { return !!localStorage.getItem('hiphi_triage_seen'); } catch { return true; } };
export const titleCaseHI = t => String(t || '').replace(/^RELATING TO /i, 'Relating to ').replace(/\b([A-Z]{2,})\b/g, w => w.charAt(0) + w.slice(1).toLowerCase()).replace(/\bHawaii\b/g, 'Hawaiʻi');
export const hiToday = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Pacific/Honolulu' });
export function pubStateCls(b) {
  if (!b.tracked || !b.is_public) return 'pubstate off';
  if (!b.public_summary) return 'pubstate warn';
  if (b.public_action && (!b.public_action_until || b.public_action_until < hiToday()))
    return 'pubstate warn';
  return 'pubstate live';
}
export function pubStateText(b) {
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

export const DRAFT_LABEL = { draft: 'Draft', review: 'In review', second_review: 'Needs 2nd approval',
  approved: 'Approved', filed: 'Filed', cancelled: 'Hearing cancelled' };
export const DRAFT_TAG = { draft: 'a', review: 'w', second_review: 'w', approved: 'g', filed: 't', cancelled: 'a' };
export const dWhen = iso => iso ? new Date(iso).toLocaleString('en-US', { timeZone: 'Pacific/Honolulu',
  weekday: 'short', month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';
export const nameOf = id => advocate(id)?.full_name || 'someone';
export const listNames = (pred, sep) => S.advocates.filter(a => pred(a) && a.is_active !== false)
  .map(a => a.full_name).join(sep) || 'an admin';
export function draftWho(d) {
  switch (d.status) {
    case 'review': return `Sent by ${nameOf(d.submitted_by)} ${dWhen(d.submitted_at)} \u00b7 waiting for ${listNames(a => a.is_admin, ' or ')}`;
    case 'second_review': return `Approved by ${nameOf(d.approved_by)} \u00b7 first testimony on this bill, needs ${listNames(a => a.is_reviewer, ' or ')}`;
    case 'approved': return `Approved by ${nameOf(d.second_approved_by || d.approved_by)} ${dWhen(d.second_approved_at || d.approved_at)} \u00b7 file it at the Capitol, then mark it filed`;
    case 'filed': return `Filed by ${nameOf(d.filed_by)} ${dWhen(d.filed_at)}`;
    case 'draft': return d.submitted_at ? 'Back to draft' : 'Write it in the Doc, then submit for review';
    default: return '';
  }
}
export function draftActions(d) {
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
export const inWhen = iso => { const ms = new Date(iso) - Date.now(); if (ms <= 0) return 'passed';   // callers say "deadline passed"
  const h = Math.floor(ms / 36e5); return h < 48 ? `in ${h}h` : `in ${Math.floor(ms / 864e5)}d`; };   // never rounded up (R-022)
export const blurb = (b, n = 90) => { const t = (b.public_summary || b.description || b.title || '').replace(/\s+/g, ' ').trim();
  return t.length > n ? t.slice(0, n - 1).replace(/\s\S*$/, '') + '…' : t; };
export const priCls = b => b.priority === 1 ? ' p3' : '';   // class name kept; P1 rows are double height
export const byPri = (x, y) => (x.b.priority || 9) - (y.b.priority || 9);
export const billNum = b => b.bill_number + (b.current_version ? ' ' + b.current_version : '');
export const roomShort = r => (r || 'room TBD').replace(/\s*via videoconference/i, '').replace(/^Conference Room\s+/i, 'Rm ');
export function chairMail(code) {
  // The committee roster knows who chairs it; the last word of the name broke on two-word surnames
  // ("San Buenaventura", "Dela Cruz") and sent email to an address that does not exist (9/19).
  const out = codesOf(code).map(k => S.committees?.[k]).filter(c => c?.chair).map(c => {
    const m = (S.committeeMembers || []).find(x => x.committee === c.code && x.role === 'chair'), lg = m && (S.legislators || []).find(l => l.id === m.legislator_id);
    const clean = c.chair.replace(/^(rep\.|sen\.|representative|senator)\s+/i, '').replace(/\s*(jr\.?|sr\.?|ii|iii|iv)$/i, '').trim();
    const surname = lg?.sort_name ? lg.sort_name.split(',')[0] : clean.split(/\s+/).pop();
    const last = surname.toLowerCase().replace(/[^a-z]/g, '');
    return { name: c.chair, last: surname, title: c.chamber === 'S' ? 'Sen.' : 'Rep.', email: lg?.email || `${c.chamber === 'S' ? 'sen' : 'rep'}${last}@capitol.hawaii.gov` }; });
  if (!out.length) return null;
  return { ...out[0], n: out.length, email: out.map(x => x.email).join(','), who: out.map(x => `${x.title} ${x.last}`).join(' and ') };
}
export const attendees = h => (S.attend?.[h.id] || []).map(advocate).filter(Boolean);
export const OUTCOME_LABEL = { passed: 'Passed', passed_amended: 'Passed with amendments', deferred: 'Deferred', recommitted: 'Recommitted' };
export const DRAFT_RANK = { approved: 5, second_review: 4, review: 3, draft: 2, filed: 1 };
export const unreadCount = b => (S.messages?.[b.id] || []).filter(m => m.advocate_id !== S.me?.id && (!S.chatSeen?.[b.id] || m.created_at > S.chatSeen[b.id])).length;
export function draftFor(billId, committee) {
  return (S.drafts[billId] || []).find(d => d.committee === committee && d.status !== 'cancelled');
}
export const STAGE_GLOSS = {
  introduced: 'Introduced. Waiting for its committee referrals and a first hearing.',
  first_triple: 'Triple filing: a bill sent to three or more committees has to clear its first one by this date, or it is dead.',
  first_lateral: 'Lateral: the bill has to reach its last committee in the chamber it started in by this date.',
  first_decking: 'Decking: the bill has to be filed for its final floor vote in the first chamber by this date.',
  first_crossover: 'Crossover: bills that passed their first chamber move to the other one. Anything left behind is dead.',
  second_triple: 'Triple filing in the second chamber: clear the first of three or more committees by this date.',
  second_lateral: 'Lateral in the second chamber: reach the last committee by this date.',
  second_decking: 'Decking in the second chamber: filed for the final floor vote by this date.',
  second_crossover: 'Cross back: a bill the second chamber amended returns to where it started, to agree or disagree.',
  conference: 'Conference: House and Senate negotiators settle the differences between the two versions.',
  governor: 'Passed both chambers. The Governor signs it, vetoes it, or lets it become law without a signature.',
  enacted: 'It is law.',
};
export const glossStage = s => { const d = (DEADLINES[s] || []).map(([l, dt]) => `${l} ${fmtDate(dt + 'T12:00:00-10:00', { weekday: 'short', month: 'short' })}`).join(', '); return `${STAGE_GLOSS[s] || ''}${d ? ` Deadline: ${d}.` : ''}`; };
export const glossCommittee = code => String(code || '').split('/').map(c => { const k = S.committees?.[c.trim()]; return k ? `${c.trim()}: ${k.name}${k.chair ? ` · chair ${k.chair}` : ''}` : ''; }).filter(Boolean).join(' — ');
export function nextStageLabel(b) {
  if (diedish(b)) return null;
  const rail = railFor(b), idx = railIdx(b, rail);
  const s = rail[idx + 1];
  return s ? (STAGE_LABEL[s] || s) : null;
}

export const SMALL_WORDS = new Set(['a', 'an', 'and', 'as', 'at', 'by', 'for', 'from', 'in', 'into', 'of', 'on', 'or', 'the', 'to', 'with']);
export const titleCaseSmart = t => t !== t.toUpperCase() ? t : t.toLowerCase().replace(/[a-z][a-z'’]*/g, (w, i) => i > 0 && SMALL_WORDS.has(w) ? w : w.charAt(0).toUpperCase() + w.slice(1)).replace(/\bHawaii\b/g, 'Hawaiʻi');
export const titleCaseTitle = t => t === t.toUpperCase() ? t.charAt(0) + t.slice(1).toLowerCase().replace(/\bhawaii\b/gi, 'Hawaii') : t;
export const DRAFT_STEPS = [['draft', 'Write'], ['review', 'Review'], ['approved', 'Approve'], ['filed', 'File']];
export const sponsorName = n => String(n || '').toLowerCase().replace(/(^|[\s\-'.(])([a-z])/g, (m, a, c) => a + c.toUpperCase());

// ============================================================================
// The session clock and the suggestion feed (Nate, 9/19)
// ============================================================================

// The next deadline these bills are racing, and how they stand against it. This is the only portfolio number that
// earns a place on Today: "2 have no hearing yet" is not a statistic, it is the work. The full five-bucket
// breakdown stays on Bills, where every count is one click from the rows it describes.
// It also carries the deadline after (`then`, decision 3 of R-022): in the week of 16 March the nearest deadline bound 4
// team bills and the next one 51, 37 of them with no hearing, so the nearest alone hid the bigger job.
export function sessionClock(list) {
  if (SESSION_OVER) return null;
  const ahead = sessionGates(list).filter(g => !g.past);
  const i = ahead.findIndex(x => x.racing.length), g = i >= 0 ? ahead[i] : ahead[0];
  if (!g) return null;
  const g2 = ahead.slice((i >= 0 ? i : 0) + 1).find(x => x.racing.length) || null;
  const shape = x => ({ name: x.name, label: x.label, date: x.date, days: x.days, racing: x.racing.length, p1: x.p1,
    noHearing: x.noHearing.map(y => y.b) });
  return { ...shape(g), then: g2 ? shape(g2) : null };
}
// When the notice for a bill's last chance must go up: a committee must post a hearing 48 hours ahead (Help), so a
// bill that dies Thursday really has until the notice for its committee's last slot, often Tuesday (R-022).
export function noticeByFor(st) {
  if (!st?.committee || !st.deadline?.date) return null;
  const ls = lastSlotBefore(st.committee, st.deadline.date, S.slots);
  return ls && ls.noticeBy > Date.now() - 864e5 ? ls.noticeBy : null;
}

// ---- suggestions ----
// Today's promise is a list you can clear, so a suggestion must never look like a task that is due. These are
// generated from a bill's own pathway, capped, kept out of the badge count, and every one of them can be done,
// put off for a fortnight, or refused for that bill for good. Each carries the reason it was raised: the app does
// not know whether Kevin already called the chair, and saying what it does know is how someone spots that.
export const SUGGEST_CAP = 5;
const SUG_RANK = { chair: 1, summary: 2, thank: 3, position: 4, update: 5 };
const wk = 7 * 864e5;

export const suggState = () => (S.me?.prefs?.sugg) || {};
// 'done' and 'never' are permanent for that key; 'later' lapses after a fortnight so a bill that really does need
// attention comes back rather than disappearing for the session.
export function suggHidden(key) {
  const s = suggState()[key];
  if (!s) return false;
  if (s.state === 'later') return Date.now() - (s.at || 0) < 14 * 864e5;
  return true;
}
export async function setSugg(key, state) {
  const sugg = { ...suggState(), [key]: { state, at: Date.now() } };
  await DB.patchPrefs({ sugg });
}

// A favourable committee report in the last week: the moment a thank-you actually lands.
const PASSED = /recommend(s|ed)? (that the measure be )?pass|passed with amendments|pass(ed)? second reading|reported from/i;

export function suggestions(bills, { cap = SUGGEST_CAP, skip = () => false } = {}) {
  if (SESSION_OVER) return [];
  const now = Date.now(), out = [];
  const add = s => { if (!suggHidden(s.key) && !skip(s.b)) out.push({ ...s, rank: SUG_RANK[s.kind] || 9 }); };
  for (const b of bills) {
    if (diedish(b) || b.position === 'monitor') continue;
    const st = stopOf(b), ahead = hearingAhead(b), name = b.nickname || blurb(b, 60);

    // 1. Waiting in committee with a deadline in sight and nobody has asked for a hearing.
    if (!ahead && st.column === 'a' && st.committee && st.deadline && !st.deadline.missed) {
      const m = chairMail(st.committee), two = m && m.n > 1;
      add({ kind: 'chair', key: `sg:chair:${b.id}:${st.deadline.date}`, b,
        title: `Ask the chair${two ? 's' : ''} of ${st.committee} for a hearing`,
        why: `No hearing yet · ${st.deadline.label} deadline ${fmtDate(st.deadline.date)}, ${st.deadline.days <= 0 ? 'today' : st.deadline.days + ' days'}${noticeByFor(st) ? ` · the notice has to post by ${fmtDate(noticeByFor(st), { weekday: 'short' }).replace(',', '')}` : ''}${m ? ` · ${m.who}` : ''}`,
        urgent: st.deadline.days <= RISK_DAYS,
        act: m ? { label: `Email the chair${two ? 's' : ''}`, href: `mailto:${m.email}?subject=${encodeURIComponent('Request for a hearing on ' + b.bill_number)}&body=${encodeURIComponent(`Aloha ${m.who},\n\nThe Hawaiʻi Public Health Institute asks you to schedule a hearing on ${b.bill_number}${name ? ` (${name})` : ''} before the ${st.deadline.label} deadline on ${fmtDate(st.deadline.date)}.\n\nMahalo,\n${(S.me?.full_name || '').split(' ')[0]}`)}`, ext: true }
          : { label: 'Open the bill', href: `#/bill/${b.bill_number}` },
        log: { type: 'meeting', title: `Asked ${m ? m.who : 'the chair'} for a hearing` } });
    }

    // 2. Public, but the public page can only show the Capitol's own title. 69 of 248 position bills were in this
    //    state when the nicknames were loaded; that backlog was filled on 9/19, so the rule now fires only on a
    //    bill made public before anyone has written its summary - which is exactly when it should.
    if (b.is_public && !String(b.public_summary || '').trim()) {
      add({ kind: 'summary', key: `sg:sum:${b.id}`, b, title: 'Write a plain summary for the public page',
        why: 'The public page shows supporters only the official title',
        act: { label: 'Write it', href: `#/bill/${b.bill_number}/public` },
        log: null });
    }

    // 3. A committee just sent it on. Thanking the chair is the cheapest relationship work there is.
    if (b.last_action_date && now - new Date(b.last_action_date + 'T12:00:00-10:00') < wk && PASSED.test(b.last_action || '')) {
      // Name the committee that actually moved it, from the Capitol's own sentence ("The committee(s) on HHS
      // recommend(s)…"). Without a code we cannot say whose chair to thank, so the suggestion is not made.
      const mv = /committee\(?s?\)? on ([A-Z][A-Z/]*)/.exec(b.last_action || '');
      const prev = mv && chairMail(mv[1]);
      if (prev) add({ kind: 'thank', key: `sg:thx:${b.id}:${b.last_action_date}`, b,
        title: `Thank ${prev.who} for moving it`,
        // The Capitol's sentence, cut at the end of a clause rather than mid-word ("…The votes were").
        why: `${fmtDate(b.last_action_date)}: ${(t => t.length <= 96 ? t : t.slice(0, 96).replace(/[\s,.;:]+\S*$/, '') + '…')(String(b.last_action || '').replace(/\s+/g, ' ').replace(/\.\s+The votes were.*$/i, '.').trim())}`,
        act: { label: 'Send a thank you', href: `mailto:${prev.email}?subject=${encodeURIComponent('Mahalo for hearing ' + b.bill_number)}`, ext: true },
        log: { type: 'meeting', title: `Thanked ${prev.who}` } });
    }

    // 4. Tracked, moving, and the team has never said where it stands.
    if (!b.position && b.tracked) {
      add({ kind: 'position', key: `sg:pos:${b.id}`, b, title: 'Decide where the team stands',
        why: 'Tracked, but it has no position, so it is in nobody\'s list and no supporter sees it',
        act: { label: 'Open the bill', href: `#/bill/${b.bill_number}` }, log: null });
    }

    // 5. A hearing far enough ahead to be worth telling supporters about. Only when email is switched on: while it
    //    is paused there is nothing to draft towards.
    if (ahead && S.emailCfg?.enabled !== false && b.is_public && String(b.public_action || '').trim()) {
      const days = (new Date(ahead.scheduled_at) - now) / 864e5;
      if (days >= 5 && days <= 21 && !(S.alerts || []).some(a => a.bill_id === b.id && a.status !== 'cancelled'))
        add({ kind: 'update', key: `sg:upd:${b.id}:${ahead.id}`, b, title: 'Tell supporters the hearing is coming',
          why: `${ahead.committee} hearing ${fmtDate(ahead.scheduled_at)} · ${Math.round(days)} days · no alert drafted`,
          act: { label: 'Draft the email', href: '#/email/new' },
          log: { type: 'coalition', title: 'Drafted a supporter update' } });
    }
  }
  // Best first inside each kind, then one kind after another. Sorting by kind alone filled the whole feed with
  // chair emails (23 bills were waiting on a hearing when this was first run), which is a firehose, not a
  // suggestion. Urgency decides the order inside a kind: a deadline three days away comes before one three weeks
  // away. When one kind really is all there is, the round robin gives up and fills the page from it.
  const urgency = s => s.kind === 'chair' ? (stopOf(s.b).deadline?.days ?? 999) : 500;
  const best = out.sort((a, c) => urgency(a) - urgency(c) || (a.b.priority || 9) - (c.b.priority || 9)
    || a.b.bill_number.localeCompare(c.b.bill_number, 'en', { numeric: true }));
  const byKind = new Map();
  for (const s of best) { if (!byKind.has(s.kind)) byKind.set(s.kind, []); byKind.get(s.kind).push(s); }
  const kinds = [...byKind.keys()].sort((a, c) => (SUG_RANK[a] || 9) - (SUG_RANK[c] || 9));
  const seen = new Set(), picked = [], cursor = new Map(), taken = new Map(), PER_KIND = 2;
  let moved = true;
  while (picked.length < cap && moved) {
    moved = false;
    for (const k of kinds) {
      if (picked.length >= cap || (taken.get(k) || 0) >= PER_KIND) continue;
      const arr = byKind.get(k); let i = cursor.get(k) || 0;
      while (i < arr.length && seen.has(arr[i].b.id)) i++;
      cursor.set(k, i + 1);
      if (i >= arr.length) continue;
      seen.add(arr[i].b.id); picked.push(arr[i]); taken.set(k, (taken.get(k) || 0) + 1); moved = true;
    }
  }
  for (const k of kinds) for (const s of byKind.get(k)) {
    if (picked.length >= cap) break;
    if (!seen.has(s.b.id)) { seen.add(s.b.id); picked.push(s); }
  }
  return picked;
}

// ---- the Capitol's actions in plain words (moved from today.js, R-022: Today's "what changed" and the weekly memo
// both use it) ----
const clipPlain = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1).replace(/\s\S*$/, '') + '…' : s; };
export const OUT_PLAIN = { passed: c => `Passed ${c}`, passed_amended: c => `Passed ${c} with amendments`, deferred: c => `Deferred by ${c}`, recommitted: c => `Sent back to ${c}` };
export function plainAction(t) {
  const s = String(t || '').replace(/\s+/g, ' ').trim(), cm = x => String(x).replace(/\s+/g, '').replace(/,/g, '/');
  let m;
  if ((m = /committee(?:\(s\))? on\s+([A-Z/, ]+?)\s+recommend(?:s|\(s\))? that the measure be PASSED, WITH AMENDMENTS/i.exec(s))) return [`Passed ${cm(m[1])} with amendments`, 1];
  if ((m = /committee(?:\(s\))? on\s+([A-Z/, ]+?)\s+recommend(?:s|\(s\))? that the measure be PASSED/i.exec(s))) return [`Passed ${cm(m[1])}`, 1];
  if ((m = /committee(?:\(s\))? on\s+([A-Z/, ]+?)\s+deferred/i.exec(s))) return [`Deferred by ${cm(m[1])}`, 1];
  if ((m = /(?:on\s+([A-Z/, ]+?)\s+has scheduled a public hearing on|to be heard by\s+([A-Z/, ]+?)\s+on\s+\w+,)\s*(\d\d)-(\d\d)-(\d\d)\s+(\d{1,2}:\d\d\s*[AP]M)/i.exec(s))) {
    const wd = new Date(`20${m[5]}-${m[3]}-${m[4]}T12:00:00-10:00`).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'Pacific/Honolulu' });
    return [`Hearing set: ${cm(m[1] || m[2])} ${wd} ${+m[3]}/${+m[4]}, ${m[6].replace(/\s*([AP]M)/i, ' $1')}`, 2]; }
  if ((m = /on\s+([A-Z/, ]+?)\s+will hold a public decision making on\s*(\d\d)-(\d\d)/i.exec(s))) return [`Decision making set: ${cm(m[1])} ${+m[2]}/${+m[3]}`, 2];
  if (/transmitted to (the )?governor/i.test(s)) return ['Sent to the Governor', 1];
  if (/veto/i.test(s)) return ['Vetoed', 1];
  if ((m = /\bAct\s+(\d{2,3})\b/.exec(s))) return [`Became law: Act ${m[1]}`, 1];
  if (/Passed Third Reading/i.test(s)) return [/amended/i.test(s) ? 'Passed third reading, amended' : 'Passed third reading', 1];
  if ((m = /Reported from\s+([A-Z/]+)/i.exec(s))) return [`Reported out of ${m[1]}`, 2];
  if (/Passed Second Reading/i.test(s)) return [/amended/i.test(s) ? 'Passed second reading, amended' : 'Passed second reading', 3];
  if ((m = /Received from (House|Senate)/i.exec(s))) return [`Arrived from the ${m[1]}`, 3];
  if ((m = /referred to (?:the committee\(s\) on\s+)?([A-Z]{2,4}(?:\s*[,/]\s*[A-Z]{2,4})*)/i.exec(s))) return [`Referred to ${m[1].replace(/\s*,\s*/g, ', ')}`, 4];
  if (/conferee/i.test(s)) return ['Conference committee named', 3];
  if (/carried over/i.test(s)) return ['Carried over to the next session', 5];
  if (/hours? notice|day notice/i.test(s)) return ['Hearing notice posted', 6];
  return [clipPlain(s.replace(/\.$/, ''), 90), 5];
}

// A bill number typed into a search (HB1523, "hb 1523", or just 1523 when only one tracked bill has it) opens the bill:
// B-2's budget is two steps from a number in hand to its page, and a results page in between made it four (R-022).
export function exactBill(q) {
  const t = String(q || '').trim().toUpperCase().replace(/\s+/g, '');
  let m = /^(HB|SB|HR|SR|HCR|SCR|GM)(\d{1,4})$/.exec(t);
  if (m) return S.bills.find(b => b.bill_number.replace(/\s/g, '').toUpperCase() === m[1] + m[2]) || null;
  if ((m = /^(\d{1,4})$/.exec(t))) { const hits = S.bills.filter(b => b.bill_number.replace(/\D/g, '') === m[1]); return hits.length === 1 ? hits[0] : null; }
  return null;
}
