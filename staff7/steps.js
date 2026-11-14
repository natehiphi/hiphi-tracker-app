// Staff7 steps: the testimony and hearing steps a person has, taken from the current app's own list (staff6/today.js work(me).own) so the two can never disagree. No DOM is drawn here.
import { S, advocate, SESSION_YEAR, POSITIONS } from '../staff6/data.js';
import { cmteName, roomName, lateLine } from '../staff6/model.js';
import { work, t6Fresh } from '../staff6/today.js';
import { fullName, numWords } from '../staff6/steps.js';
import { myIssueIds } from '../staff6/data.js';

const HST = { timeZone: 'Pacific/Honolulu' };
const HOUR = 36e5, DAY = 864e5;

// ---- the words for times: "Wed 2:00 PM" (with the date, "Wed, Mar 25 9:00 AM", when more than 6 days away) and a countdown rounded DOWN at every edge ----
export function dayTime(t) {
  const d = new Date(t), clock = d.toLocaleTimeString('en-US', { ...HST, hour: 'numeric', minute: '2-digit' });
  const day = d.toLocaleDateString('en-US', { ...HST, weekday: 'short' });
  if (Math.abs(d.getTime() - Date.now()) > 6 * DAY) return `${day}, ${d.toLocaleDateString('en-US', { ...HST, month: 'short', day: 'numeric' })} ${clock}`;
  return `${day} ${clock}`;
}
// model.js spanOf rounds hours to the NEAREST hour; the design says rounded down (a day early is safe, R-022), so this is its own.
export function left(t) {
  const ms = Math.abs(new Date(t).getTime() - Date.now());
  if (ms < 6e4) return 'under a minute';
  const h = ms / HOUR;
  const n = h < 1 ? Math.floor(ms / 6e4) : h < 48 ? Math.floor(h) : Math.floor(h / 24);
  const unit = h < 1 ? 'min' : h < 48 ? (n === 1 ? 'hour' : 'hours') : (n === 1 ? 'day' : 'days');
  return `${n} ${unit}`;
}
export const isLate = t => new Date(t).getTime() <= Date.now();
export const soonSoon = t => t != null && new Date(t).getTime() - Date.now() < DAY;   // amber only under 24 hours, or past it

// ---- names lead, numbers follow ----
const eCig = s => String(s || '').replace(/\bvap(?:e|es|ing)\b/gi, m => /^vap(es|ing)$/i.test(m) ? 'e-cigarettes' : 'e-cigarette');   // CLAUDE.md R-158; the Legislature's own titles stay as written
export const billName = b => eCig(fullName(b));
export const billNo = b => numWords(b);
export const first = a => String(a?.full_name || '').split(' ')[0] || 'Someone';
// HIPHI's position in the data layer's own words ("Support w/ amendments"), never collapsed
export const posWords = b => (POSITIONS.find(p => p[0] === b.position) || [])[1] || 'No position yet';

// ---- one issue per step: the person's own if the bill is on one, else the bill's first; its colour is its category's ----
export function issueOf(b) {
  const mine = myIssueIds(), ids = (S.billIssues || []).filter(x => x.bill_id === b.id).map(x => x.issue_id);
  const id = ids.find(i => mine.has(String(i))) ?? ids[0], i = (S.issues || []).find(x => x.id === id);
  const cat = i && /^[a-z-]+$/.test(i.category || '') ? i.category : 'other';
  return i ? { id: i.id, name: i.name, icon: i.icon || (S.categories || []).find(c => c.key === i.category)?.icon || 'circle', cat } : { id: null, name: 'Testimony', icon: 'file-text', cat: 'other' };
}

// ---- who approves a letter this person sends ----
const rank = a => a.can_approve ? 0 : a.is_admin ? 1 : 2;   // the standing approvers first, a second approver standing in last
export function approversOf(d, h, me) {
  const list = (S.advocates || []).filter(a => a.is_active !== false && a.id !== me?.id && (a.is_admin || a.can_approve || a.is_reviewer)).sort((x, y) => rank(x) - rank(y));
  const main = list.filter(a => rank(a) < 2);
  return (main.length ? main : list).slice(0, 2);
}
export const orNames = as => as.length ? as.map(first).join(' or ') : 'An admin';

export const VERB = { write: 'Write testimony', resubmit: 'Resubmit testimony', approve: 'Approve testimony', second: 'Second look', file: 'File testimony', ask: 'Ask for a hearing', missed: 'Did we file?', stale: 'Check testimony' };
export const LABEL = { write: 'Send for approval', resubmit: 'Resubmit', approve: 'Approve', second: 'Second look', file: 'File', stale: 'Check it', missed: 'Did we file?' };
export const BUILT = new Set(['write', 'resubmit', 'approve', 'second']);   // the kinds that have a page of their own in this piece
const KIND = { nodraft: 'write', write: 'write', submit: 'write', revise: 'resubmit', approve: 'approve', second: 'second', file: 'file', missed: 'missed', stale: 'stale', chair: 'ask' };
const ORDER = { overdue: 0, late: 1, dated: 2, missed: 3, undated: 4 };   // the current app's order inside the list

// stepsFor(person) -> that person's testimony and hearing steps, in the current app's order. `at` is the TEAM's time to act
// (handTime, e.g. an approval by 11:00 AM for a 3:00 PM Capitol deadline); `due` is the Capitol's own deadline.
// Out of this slice, on purpose: follow-ups, replies, to-dos, public asks, emails and the other kinds in work(me).own.
export function stepsFor(me) {
  if (!me) return [];
  const prev = S.me; S.me = me;   // work() reads who is looking from S.me for "mine"
  t6Fresh();   // the current app's list is kept for one task; this asks for it worked out again from the data as it is now
  let own; try { own = work(me).own; } finally { S.me = prev; }
  const out = new Map();
  for (const it of own) {
    const kind = KIND[it.kind]; if (!kind || !it.s || !it.b) continue;
    const b = it.b, s = it.s, h = it.h || null, num = String(b.bill_number).replace(/\s/g, '');
    const id = kind === 'ask' ? `ask-${num}-${b.session_year || SESSION_YEAR}` : `t-${num}-${h?.id}`;
    if (out.has(id)) continue;
    let forWhom = '';
    if (kind === 'ask' && s.ask?.key === 'giving') { const o = (S.assignments?.[b.id] || []).map(advocate).find(a => a && a.id !== me.id); forWhom = o ? first(o) : ''; }
    const at = it.at ?? null, sentBack = it.d?.review_note || '';
    out.set(id, { id, kind, raw: it.kind, bill: b, hearing: h, draft: it.d || null, at, due: s.due ?? null, until: s.until ?? null, act: s.act || null, tone: it.tone || 'neutral', late: s.act?.kind === 'late',
      issue: issueOf(b), name: billName(b), no: billNo(b), forWhom, sentBack,
      verb: kind === 'ask' ? (forWhom ? `Ask the chairs for ${forWhom}` : VERB.ask) : VERB[kind] });
  }
  const ord = s => s.tone === 'overdue' ? ORDER.overdue : s.tone === 'late' ? ORDER.late : s.kind === 'missed' ? ORDER.missed : s.at != null ? ORDER.dated : ORDER.undated;
  return [...out.values()].sort((x, y) => ord(x) - ord(y) || (x.at ?? Infinity) - (y.at ?? Infinity) || x.id.localeCompare(y.id, 'en', { numeric: true }));
}

// Home's list: which steps it shows. For now, all of them; Home's final rule is settled separately and changes only this.
export const homeRows = steps => steps;

// A committee in words with its chamber in front ("House Judiciary & Hawaiian Affairs"); a joint hearing joins its committees with "with".
export function cmteWords(codes) {
  return String(codes || '').split('/').map(c => c.trim()).filter(Boolean).map(c => {
    const n = cmteName(c), ch = S.committees?.[c]?.chamber;
    return /^(House|Senate)\b/.test(n) || !ch ? n : `${ch === 'S' ? 'Senate' : 'House'} ${n}`;
  }).join(' with ');
}
// The hearing in words: "Hearing Thu 2:00 PM · House Health · Room 329".
export function hearingLine(h) {
  if (!h) return '';
  return ['Hearing ' + dayTime(h.scheduled_at), cmteWords(h.committee), roomName(h.room)].filter(Boolean).join(' · ');
}
export { lateLine };

// This week's steps (Monday to Sunday, Hawaiʻi time): one each, open or finished, so "1 of 5 done" is a true count.
export function weekBounds(t = Date.now()) {
  const ymd = new Date(t).toLocaleDateString('en-CA', HST), d0 = new Date(`${ymd}T00:00:00-10:00`).getTime();
  const dow = (new Date(`${ymd}T12:00:00-10:00`).getUTCDay() + 6) % 7;   // Monday 0
  return [d0 - dow * DAY, d0 + (7 - dow) * DAY];
}
export const inWeek = s => { const [, end] = weekBounds(); return s.at != null && new Date(s.at).getTime() < end; };   // an overdue step is this week's too
export { advocate };
