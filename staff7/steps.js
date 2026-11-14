// Staff7 steps: works out, from the data layer's rows, which steps a person has (no screen is drawn here, no DOM is touched).
import { S, advocate, myIssueIds } from '../staff6/data.js';
import { cmteName, roomName, filerOf, wantsHearing, diedish, riskOf, sittingDraft, isDecision, canFirstApprove, billDeadline } from '../staff6/model.js';
import { testimonyState, whoseStep, fullName, numWords } from '../staff6/steps.js';

const HST = { timeZone: 'Pacific/Honolulu' };
const HOUR = 36e5, DAY = 864e5;

// ---- the words for times: "Wed 2:00 PM", and a countdown rounded DOWN (a day early is safe, R-022) ----
export const dayTime = t => `${new Date(t).toLocaleDateString('en-US', { ...HST, weekday: 'short' })} ${new Date(t).toLocaleTimeString('en-US', { ...HST, hour: 'numeric', minute: '2-digit' })}`;
export const dayOnly = t => new Date(t).toLocaleDateString('en-US', { ...HST, weekday: 'long' });
export const clockOnly = t => new Date(t).toLocaleTimeString('en-US', { ...HST, hour: 'numeric', minute: '2-digit' });
// model.js spanOf rounds hours to the NEAREST hour ("4h59m" reads "5 hours"); the design says rounded down, so this is its own.
export function left(t) {
  const ms = Math.abs(new Date(t).getTime() - Date.now()), h = ms / HOUR;
  const n = h < 1 ? Math.max(1, Math.floor(ms / 6e4)) : h < 48 ? Math.floor(h) : Math.floor(h / 24);
  const unit = h < 1 ? 'min' : h < 48 ? (n === 1 ? 'hour' : 'hours') : (n === 1 ? 'day' : 'days');
  return `${n} ${unit}`;
}
export const isLate = t => new Date(t).getTime() <= Date.now();
export const soonSoon = t => new Date(t).getTime() - Date.now() < DAY;   // amber only under 24 hours, or past it

// ---- names lead, numbers follow ----
const eCig = s => String(s || '').replace(/\bvap(?:e|es|ing)\b/gi, m => /^vap(es|ing)$/i.test(m) ? 'e-cigarettes' : 'e-cigarette');   // CLAUDE.md R-158; the Legislature's own titles stay as written
export const billName = b => eCig(fullName(b));
export const billNo = b => numWords(b);
export const first = a => String(a?.full_name || '').split(' ')[0] || 'Someone';

// ---- one issue per step: the person's own if the bill is on one, else the bill's first; its colour is its category's ----
export function issueOf(b) {
  const mine = myIssueIds(), ids = (S.billIssues || []).filter(x => x.bill_id === b.id).map(x => x.issue_id);
  const id = ids.find(i => mine.has(String(i))) ?? ids[0], i = (S.issues || []).find(x => x.id === id);
  return i ? { id: i.id, name: i.name, icon: i.icon || (S.categories || []).find(c => c.key === i.category)?.icon || 'circle', cat: i.category || 'other' } : { id: null, name: 'Testimony', icon: 'file-text', cat: 'other' };
}

// ---- who approves a letter this person sends ----
const rank = a => a.can_approve ? 0 : a.is_admin ? 1 : 2;   // the standing approvers first, a second approver standing in last
export function approversOf(d, h, me) {
  const as = { ...(d || {}), submitted_by: me?.id };
  const list = (S.advocates || []).filter(a => a.is_active !== false && a.id !== me?.id && canFirstApprove(a, as, h))
    .sort((x, y) => rank(x) - rank(y));
  return list.slice(0, 2);
}
export const orNames = as => as.length ? as.map(first).join(' or ') : 'An admin';

export const VERB = { write: 'Write testimony', resubmit: 'Resubmit testimony', approve: 'Approve testimony', second: 'Second look', file: 'File testimony', ask: 'Ask for a hearing' };
export const BUILT = new Set(['write', 'resubmit']);   // the kinds that have a page of their own in this piece

// The deadline the Capitol sets for written testimony; with none on file, the day before the hearing (as Staff v6 reads it).
const dueOf = h => h.testimony_deadline || new Date(new Date(h.scheduled_at).getTime() - DAY).toISOString();

function make(kind, b, h, d, extra = {}) {
  const dueAt = extra.dueAt || dueOf(h), iss = issueOf(b);
  return { id: `${kind === 'second' ? 'approve' : kind}-${String(b.bill_number).replace(/\s/g, '')}-${h ? h.id : 'ask'}`, kind, verb: VERB[kind], bill: b, hearing: h || null, draft: d || null,
    dueAt, issue: iss, name: billName(b), no: billNo(b), soon: soonSoon(dueAt), ...extra };
}

// stepsFor(person) -> that person's steps, soonest deadline first.
export function stepsFor(me) {
  if (!me) return [];
  const out = [], now = Date.now();
  for (const h of S.hearings || []) {
    if (h.status !== 'scheduled' || new Date(h.scheduled_at).getTime() <= now || isDecision(h)) continue;
    const b = (S.bills || []).find(x => x.id === h.bill_id);
    if (!b || !b.position || b.position === 'monitor' || !wantsHearing(b) || diedish(b)) continue;
    const d = sittingDraft(h, b.id), st = testimonyState(d, b, { h });
    if (!st || !whoseStep(d, b, { viewer: me, h }).ids.includes(me.id)) continue;
    if (st.key === 'write') out.push(make(st.sentBack ? 'resubmit' : 'write', b, h, d, { sentBack: d?.review_note || '' }));
    else if (st.key === 'approve' || st.key === 'second') { if (d.submitted_by !== me.id) out.push(make(st.key === 'second' ? 'second' : 'approve', b, h, d)); }
    else if (st.key === 'file') out.push(make('file', b, h, d));
  }
  // a bill of theirs with a committee deadline inside 7 days and no hearing
  for (const b of S.bills || []) {
    if (!(S.assignments?.[b.id] || []).includes(me.id)) continue;
    const r = riskOf(b); if (!r) continue;
    const dl = billDeadline(b); if (!dl || !dl.date) continue;
    out.push(make('ask', b, null, null, { dueAt: new Date(`${String(dl.date).slice(0, 10)}T23:59:59-10:00`).toISOString(), deadlineLabel: dl.label || '' }));
  }
  return out.sort((x, y) => new Date(x.dueAt) - new Date(y.dueAt) || x.id.localeCompare(y.id));
}

// Home's list: which steps it shows. For now, all of them; Home's final rule is settled separately and changes only this.
export const homeRows = steps => steps;

// A committee in words with its chamber in front ("House Judiciary & Hawaiian Affairs"); a joint hearing joins its committees with "and".
export function cmteWords(codes) {
  return String(codes || '').split('/').map(c => c.trim()).filter(Boolean).map(c => {
    const n = cmteName(c), ch = S.committees?.[c]?.chamber;
    return /^(House|Senate)\b/.test(n) || !ch ? n : `${ch === 'S' ? 'Senate' : 'House'} ${n}`;
  }).join(' and ');
}
export { filerOf };

// The hearing in words: "Hearing Thu 2:00 PM · House Health · Room 329".
export function hearingLine(h) {
  if (!h) return '';
  return ['Hearing ' + dayTime(h.scheduled_at), cmteWords(h.committee), roomName(h.room)].filter(Boolean).join(' · ');
}

// This week's steps (Monday to Sunday, Hawaiʻi time): one each, open or finished, so "1 of 5 done" is a true count.
export function weekBounds(t = Date.now()) {
  const ymd = new Date(t).toLocaleDateString('en-CA', HST), d0 = new Date(`${ymd}T00:00:00-10:00`).getTime();
  const dow = (new Date(`${ymd}T12:00:00-10:00`).getUTCDay() + 6) % 7;   // Monday 0
  return [d0 - dow * DAY, d0 + (7 - dow) * DAY];
}
export const inWeek = s => { const [, end] = weekBounds(); return new Date(s.dueAt).getTime() < end; };   // an overdue step is this week's too
export { advocate };
