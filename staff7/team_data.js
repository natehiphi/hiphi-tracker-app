// Staff7 Team, the data (R-398 piece 6): the two lists on #/team, one bill's facts for the sheet, and the one function that changes a lead.
// Pure functions over the data layer's own facts: nothing here draws. The only writes are setLead / undoLead (S.assignments and the S.leadChanges record, in memory: this is the practice copy) and tell / untell
// (a message on the bill, in memory). The live app's table, trigger and message are the database piece that waits for Nate's yes (R-398-team-build.md).
import { S, advocate, SESSION_YEAR } from '../staff6/data.js';
import { t6Fresh } from '../staff6/today.js';
import { hearingAhead, stopOf } from '../staff6/model.js';
import { stepsFor, pastDue, billName, billNo, posWords, left, cmteWords } from './steps.js';
import { hearTxt } from './issues.js';   // staff7's shared relative-day wording ("today 1:10 PM", "tomorrow 9:00 AM"), as the bill page and Issues use
import { isAlive, deadlineOf } from './standing.js';
import { dateWords } from './words.js';
import { testimonyDue } from './bill_words.js';
import { esc } from './parts.js';

const DAY = 864e5, HST = { timeZone: 'Pacific/Honolulu' };
export const LATE_CAP = 5, LEAD_CAP = 6;   // rows shown before "N more"
// one name for one person, everywhere on Team: the name as the team writes it ("May Rose")
export const pn = a => String(a?.full_name || 'Someone');
const live = id => !!id && advocate(id)?.is_active !== false;
export const people = () => (S.advocates || []).filter(a => a.is_active !== false);
const clock = t => new Date(t).toLocaleTimeString('en-US', { ...HST, hour: 'numeric', minute: '2-digit' });
const ymd = t => new Date(t).toLocaleDateString('en-CA', HST);

// ---------------------------------------------------------------------------------- issues and leads
// the bill's issue for a row: the first on it whose lead is still active (that person is who the bill would go to), else the first on it. Not tied to who is looking.
export function issueFor(b) {
  const ids = (S.billIssues || []).filter(x => x.bill_id === b.id).map(x => x.issue_id), all = ids.map(id => (S.issues || []).find(i => i.id === id)).filter(i => i && !i.archived_at);
  const i = all.find(x => live(x.owner_id)) || all[0];
  if (!i) return { id: null, name: 'No issue yet', icon: 'circle', cat: 'other', lead: null };
  const cat = /^[a-z-]+$/.test(i.category || '') ? i.category : 'other';
  return { id: i.id, name: i.name, icon: i.icon || (S.categories || []).find(c => c.key === i.category)?.icon || 'circle', cat, lead: live(i.owner_id) ? advocate(i.owner_id) : null };
}
// the one rule for "nobody leads this bill": a bill HIPHI takes a side on, tracked, this session, not stopped, with no active lead (noLeadBills, the bill page's door)
export const isNoLead = b => !!b && b.tracked !== false && !!b.position && b.position !== 'monitor' && (!b.session_year || +b.session_year === +SESSION_YEAR) && isAlive(b) && !hasLead(b);
export const hasLead = b => (S.assignments?.[b.id] || []).some(live);
export const ledBills = a => (S.bills || []).filter(b => b.tracked !== false && (S.assignments?.[b.id] || []).includes(a.id));   // the bills a person leads (the count the lists and the Give list say)
export const leadsOf = a => ledBills(a).length;
export const leadsWords = a => { const n = leadsOf(a); return n === 0 ? 'leads no bills' : `leads ${n} ${n === 1 ? 'bill' : 'bills'}`; };

// ---------------------------------------------------------------------------------- 1. Late or due today: other people's steps
// The time a step is due, from the step's own state (steps.js, dueStrip): a step that is late or overdue is due at the Capitol's deadline that has passed (`due`), and `until` is when the Capitol still takes it
// (the hearing); any other step is due at the team's time to act (`at`). { t, until }
export const dueOf = s => {
  const past = s.late || s.act?.kind === 'overdue';
  return { t: (past ? s.due : s.at) ?? s.at ?? null, until: s.late ? s.until ?? null : null };
};
export const stepIsLate = (s, now) => { const t = dueOf(s).t; return pastDue(s) || (t != null && new Date(t).getTime() <= now); };
export const stepIsTeamLate = (s, now) => { const t = dueOf(s).t; return s.kind !== 'missed' && (pastDue(s) || (t != null && new Date(t).getTime() - now < DAY)); };
// every active person's steps as that person sees them on Home (steps.js stepsFor), each step once. `holder` is who has it: the bill's lead when they are among the holders, else the first; null for a step
// nobody holds (stepsFor's `orphan`: it only reaches the issue lead or the admins). The viewer's own steps, and a nobody-held step that reaches the viewer, are left out: those are on the viewer's Home.
export function lateSteps(me, now = Date.now()) {
  const byId = new Map();
  for (const a of people()) for (const s of stepsFor(a)) {
    const e = byId.get(s.id) || byId.set(s.id, { step: s, holders: [], orphan: !!s.orphan }).get(s.id);
    e.holders.push(a.id); if (!s.orphan) e.orphan = false;
  }
  t6Fresh();   // stepsFor leaves the current app's list worked out for the last person; the next reader asks for it again
  const rows = [];
  for (const e of byId.values()) {
    const s = e.step; if (!stepIsTeamLate(s, now) || e.holders.includes(me?.id)) continue;
    const owner = (S.assignments?.[s.bill.id] || []).find(id => e.holders.includes(id)), d = dueOf(s);
    const holder = e.orphan ? null : advocate(owner || e.holders[0]) || null;
    rows.push({ id: s.id, step: s, holder, late: stepIsLate(s, now), at: d.t != null ? new Date(d.t).getTime() : null, until: d.until != null ? new Date(d.until).getTime() : null });
  }
  return rows.sort((x, y) => (y.late - x.late) || (x.at ?? Infinity) - (y.at ?? Infinity) || x.id.localeCompare(y.id, 'en', { numeric: true }));
}
// "3 hours late" / "Past due" (a step with no time of its own) / "due 9:30 AM" (today) / "due Wed 9:30 AM"
export const lateWords = r => r.late ? (r.at != null ? `${left(r.at)} late` : 'Past due') : `due ${ymd(r.at) === ymd(Date.now()) ? clock(r.at) : hearTxt(r.at)}`;
// what was due and what still holds, as two sentences: "Testimony was due Mon 6:00 AM." "The Capitol still takes it until the hearing, Tue 10:00 AM."
export function whatParts(r) {
  const s = r.step, what = s.kind === 'ask' ? 'The ask' : 'Testimony', t = r.at != null ? `${what} ${r.late ? 'was' : 'is'} due ${hearTxt(r.at)}.` : `${what} is past due.`;
  if (r.until != null) {
    const hAt = s.hearing?.scheduled_at ? new Date(s.hearing.scheduled_at).getTime() : null;
    return [t, `The Capitol still takes it until ${hAt != null && Math.abs(hAt - r.until) < 6e4 ? 'the hearing, ' : ''}${hearTxt(r.until)}.`];
  }
  const due = s.due != null ? new Date(s.due).getTime() : null;
  return [t, !r.late && due != null && r.at != null && Math.abs(due - r.at) > 6e4 && due > Date.now() ? `The Capitol’s deadline is ${hearTxt(due)}.` : ''];
}
export const whatWords = r => whatParts(r).filter(Boolean).join(' ');
// the message the Tell button sends, as the viewer: what is late (or due), and what still holds
export const messageWords = r => [`${r.step.verb} for ${r.step.name} ${r.late ? 'was' : 'is'} due ${r.at != null ? hearTxt(r.at) : 'already'}.`, whatParts(r)[1]].filter(Boolean).join(' ');

// ---------------------------------------------------------------------------------- 2. No lead yet
const ts = d => new Date(String(d).slice(0, 10) + 'T12:00:00-10:00').getTime();
// the date a bill is waiting on: its hearing, else the day its hearing must happen by, else the deadline the Capitol's calendar gives
export function nextOf(b) {
  const h = hearingAhead(b);
  if (h) return { kind: 'hearing', t: new Date(h.scheduled_at).getTime(), h, words: `hearing ${hearTxt(h.scheduled_at)}` };
  const dl = deadlineOf(b);
  if (dl) return { kind: 'by', t: ts(dl.date), h: null, words: `needs a hearing by ${dateWords(String(dl.date).slice(0, 10))}` };
  const st = stopOf(b), d = st?.deadline && !st.deadline.missed ? st.deadline : null;
  if (d) return { kind: 'by', t: ts(d.date), h: null, words: `due by ${dateWords(String(d.date).slice(0, 10))}` };
  return { kind: 'none', t: Infinity, h: null, words: 'no hearing or deadline yet' };
}
// a bill HIPHI takes a side on (any position but Monitor), tracked, this session, not stopped, with no active lead
export function noLeadBills() {
  return (S.bills || []).filter(isNoLead)
    .map(b => ({ b, id: b.id, name: billName(b), no: billNo(b), issue: issueFor(b), next: nextOf(b) }))
    .sort((x, y) => x.next.t - y.next.t || String(x.b.bill_number).localeCompare(String(y.b.bill_number), 'en', { numeric: true }));
}

// one bill as a table row of Team (the same shape noLeadBills gives)
export const rowOf = b => ({ b, id: b.id, name: billName(b), no: billNo(b), issue: issueFor(b), next: nextOf(b) });
export const sortRows = rows => rows.sort((x, y) => x.next.t - y.next.t || String(x.b.bill_number).localeCompare(String(y.b.bill_number), 'en', { numeric: true }));

// ---------------------------------------------------------------------------------- one bill's facts, for the sheets
export function billFacts(b) {
  const nx = nextOf(b), iss = issueFor(b), h = nx.h;
  const stands = (() => { // "In the Senate. Hearing Wed 1:00 PM, Senate Education, Room 229."
    const chamber = /^S/i.test(String(b.bill_number)) ? 'Senate' : 'House', parts = [];
    if (h) { parts.push(`Hearing ${hearTxt(h.scheduled_at)}`, cmteWords(h.committee)); } else if (nx.kind === 'by') parts.push(nx.words.charAt(0).toUpperCase() + nx.words.slice(1)); else parts.push('Waiting for a hearing');
    return `${h ? `In the ${chamber}. ` : ''}${parts.filter(Boolean).join(', ')}.`;
  })();
  const next = h ? `Write testimony, due ${hearTxt(testimonyDue(h))}.` : nx.kind === 'by' ? `Ask for a hearing by ${dateWords(String(deadlineOf(b)?.date || stopOf(b)?.deadline?.date || '').slice(0, 10))}.` : '';
  return { pos: posWords(b), issue: iss, hearing: h ? hearTxt(h.scheduled_at) : '', stands, next, nx };
}
// the words a new lead is sent, and what the old lead is sent (the drawing team_message.png)
// who looks the change over: an admin other than the one who changed it, Nate first
export function overseer(me) {
  const ad = people().filter(a => a.is_admin && a.id !== me?.id);
  return ad.find(a => a.initials === 'NT') || ad[0] || null;
}

// ---------------------------------------------------------------------------------- the record, and the one function that changes a lead
// Every take or give is one record: who, which bill, who led before, who leads now, when. `group` and `approved_*` are for the admin's step and the many-at-once view (later parts).
let seq = 0;
export function setLead(billId, toId, { group = null } = {}) {
  S.leadChanges ??= [];
  const from = [...(S.assignments?.[billId] || [])];
  S.assignments ??= {}; S.assignments[billId] = [toId];   // the practice copy: the same shape DB.setOwner keeps in memory (staff6/data.js)
  const rec = { id: `lc-${Date.now().toString(36)}-${++seq}`, bill_id: billId, from, to: toId, by: S.me?.id || null, at: new Date().toISOString(), group, approved_by: null, approved_at: null };
  S.leadChanges.push(rec);
  return rec;
}
// Many bills at once: one record for each bill that changes, all sharing one `group` id. A bill the person already leads alone is left as it is. Returns { group, recs }.
export function setLeads(billIds, toId) {
  const group = `g-${Date.now().toString(36)}-${++seq}`, recs = [];
  for (const id of billIds) { const cur = S.assignments?.[id] || []; if (cur.length === 1 && cur[0] === toId) continue; recs.push(setLead(id, toId, { group })); }
  return { group, recs };
}
export const undoLeads = recs => recs.forEach(undoLead);
export function undoLead(rec) {
  const i = (S.leadChanges || []).findIndex(r => r.id === rec.id); if (i < 0) return false;
  S.leadChanges.splice(i, 1);
  if (S.assignments) S.assignments[rec.bill_id] = [...rec.from];
  return true;
}

// ---------------------------------------------------------------------------------- Tell: a message on the bill that names the person who holds the step. Once per step.
export const told = new Map();   // step id -> { at, msgId, billId, to }   (this visit only; undone, it is forgotten)
export function tell(r, me = S.me) {
  if (!r.holder || told.has(r.id)) return null;
  const m = { id: 'tm-' + Date.now().toString(36) + '-' + (++seq), bill_id: r.step.bill.id, advocate_id: me?.id, body: `@${pn(r.holder)} ${messageWords(r)}`, created_at: new Date().toISOString(), to: r.holder.id };
  (S.messages ??= {})[m.bill_id] ??= []; S.messages[m.bill_id].push(m);
  told.set(r.id, { at: m.created_at, msgId: m.id, billId: m.bill_id, to: r.holder.id });
  return m;
}
export function untell(stepId) {
  const t = told.get(stepId); if (!t) return false;
  S.messages[t.billId] = (S.messages[t.billId] || []).filter(m => m.id !== t.msgId); told.delete(stepId); return true;
}
export const clockWords = clock;
// the same name written twice (an issue called what its bill is called): the issue name is left off
export const sameNick = (name, issue) => !!issue?.name && String(name).replace(/\s+/g, ' ').trim().toLowerCase() === String(issue.name).replace(/\s+/g, ' ').trim().toLowerCase();

// ---------------------------------------------------------------------------------- the message (team_message.png): the new lead, and each old lead who loses a bill
// recs: the records of one change (one bill, or a group). One message per person: "Kris gave you X HB 1780. Next: Write testimony, due Tue 1:00 PM." / "Patrick gave X HB 1671 to May Rose. You no longer lead it."
// A group lists its bills in one message to each person. Nothing is sent on the practice copy; the pages show these words. Returns [{ who, text }], the new lead first (nobody is told about their own take).
const ref = b => `${billName(b)} ${billNo(b)}`;
const listOf = bs => bs.length <= 3 ? bs.map(ref).join(', ').replace(/, ([^,]*)$/, bs.length > 1 ? ' and $1' : ', $1') : `${bs.slice(0, 3).map(ref).join(', ')} and ${bs.length - 3} more`;
export function leadMessages(recs) {
  const out = [], bill = id => (S.bills || []).find(b => b.id === id);
  if (!recs.length) return out;
  const by = advocate(recs[0].by), to = advocate(recs[0].to), bs = recs.map(r => bill(r.bill_id)).filter(Boolean), took = !!by && !!to && by.id === to.id;
  if (!by || !to || !bs.length) return out;
  if (!took) out.push({ who: to, text: bs.length === 1 ? `${pn(by)} gave you ${ref(bs[0])}.${billFacts(bs[0]).next ? ` Next: ${billFacts(bs[0]).next}` : ''}` : `${pn(by)} gave you ${bs.length} bills: ${listOf(bs)}.` });
  const old = new Map();
  for (const r of recs) for (const id of r.from || []) if (id !== to.id && id !== by.id) { const b = bill(r.bill_id); if (b) (old.get(id) || old.set(id, []).get(id)).push(b); }
  for (const [id, list] of old) { const a = advocate(id); if (!a) continue;
    out.push({ who: a, text: list.length === 1 ? `${pn(by)} ${took ? 'took' : `gave`} ${ref(list[0])}${took ? '' : ` to ${pn(to)}`}. You no longer lead it.` : `${pn(by)} ${took ? 'took' : 'gave'} ${list.length} of your bills${took ? '' : ` to ${pn(to)}`}: ${listOf(list)}. You no longer lead them.` }); }
  return out;
}
// when a change is put back, in plain words: the person who lost the bills is told, and so is the maker (never about bills the maker loses, never a message to the admin who put it back)
const listPB = bs => bs.length <= 3 ? bs.map(ref).join(', ').replace(/, ([^,]*)$/, bs.length > 1 ? ' and $1' : ', $1') : `${bs.slice(0, 2).map(ref).join(', ')} and ${bs.length - 2} more`;
export function putBackMessages(recs, by) {
  const out = [], bill = id => (S.bills || []).find(b => b.id === id), bs = recs.map(r => bill(r.bill_id)).filter(Boolean), to = advocate(recs[0]?.to), maker = advocate(recs[0]?.by);
  if (!bs.length || !to) return out;
  const n = bs.length, one = n === 1, took = !!maker && maker.id === to.id;
  if (!by || to.id !== by.id) out.push({ who: to, text: `${pn(by)} put back ${one ? 'the bill' : `the ${n} bills`} ${took ? 'you took' : `${pn(maker)} gave you`} (${listPB(bs)}). You no longer lead ${one ? 'it' : 'them'}.` });
  if (maker && !took && (!by || maker.id !== by.id)) {
    const olds = [...new Set(recs.flatMap(r => (r.from || []).filter(id => id !== to.id)))], earlier = olds.length === 1 ? advocate(olds[0]) : null, nobody = !olds.length;
    out.push({ who: maker, text: `${pn(by)} put back your change: ${listPB(bs)} ${nobody ? `${one ? 'has' : 'have'} no lead again` : earlier ? `${one ? 'is' : 'are'} ${pn(earlier)}’s again` : `went back to ${one ? 'its' : 'their'} earlier ${one ? 'lead' : 'leads'}`}.` });
  }
  return out;
}
export const messageBoxHTML = msgs => msgs.length ? `<div class="slackbox">${msgs.map(m => `<p class="sl">In Slack, to ${esc(pn(m.who))}</p><p>${esc(m.text)}</p>`).join('')}<p class="sl note">On the practice copy nothing is sent.</p></div>` : '';

// ---------------------------------------------------------------------------------- the admin's lead changes (do_leads.js, and the Home step)
// A change waits for a look while it has no approved_at and was not put back. A group is one change. Changes count before they are looked at; nothing is held.
export const isPending = r => !r.approved_at && !r.put_back_at;
export function pendingUnits() {
  const by = new Map();
  for (const r of S.leadChanges || []) { if (!isPending(r)) continue; const k = r.group || r.id; (by.get(k) || by.set(k, []).get(k)).push(r); }
  return [...by].map(([key, recs]) => ({ key, recs, at: Math.max(...recs.map(r => new Date(r.at).getTime())),
    unusual: recs.some(r => (r.from || []).some(id => id !== r.to)) }));   // taken or given away from an existing lead
}
export const approveRecs = (recs, me) => { const at = new Date().toISOString(); recs.forEach(r => { r.approved_by = me?.id || null; r.approved_at = at; }); };
export const unapproveRecs = recs => recs.forEach(r => { r.approved_by = null; r.approved_at = null; });
export function putBackRecs(recs, me) {   // restores each bill's earlier lead and marks the record put back (the record stays, so there is a trail)
  const at = new Date().toISOString();
  recs.forEach(r => { if (S.assignments) S.assignments[r.bill_id] = [...(r.from || [])]; r.put_back_at = at; r.put_back_by = me?.id || null; });
}
export const unputBackRecs = recs => recs.forEach(r => { if (S.assignments) S.assignments[r.bill_id] = [r.to]; r.put_back_at = null; r.put_back_by = null; });

// The two counts the Home line says ("Team: 4 late steps · 40 bills with no lead"): the Team page's own functions. Working out every person's steps is the slow part, so Home asks through a short memory
// (3 seconds, and any change of a lead or of who is active asks again at once).
let memo = { key: '', at: -1e9, v: null };
export function teamCounts(me) {
  const key = `${me?.id}|${JSON.stringify(S.assignments)}|${(S.advocates || []).map(a => a.is_active !== false ? 1 : 0).join('')}`, now = performance.now();
  if (memo.v && memo.key === key && now - memo.at < 3000) return memo.v;
  memo = { key, at: now, v: { late: lateSteps(me).length, noLead: noLeadBills().length } };
  return memo.v;
}
