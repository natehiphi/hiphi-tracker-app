// Where a bill and an issue stand, in the three words Home and Issues use: At risk, Moving, Stopped (Nate, 13 and 14 Nov). Functions only: nothing here draws or writes,
// so the Issues tab reads the same rules. Everything is worked out from the data layer's own facts (the Capitol's stage and deadlines, the hearings on the calendar).
//   Alive      the bill has not stopped for the year (staff6/model.js diedish).
//   At risk    alive, HIPHI wants it heard, it has no hearing scheduled, and the date its hearing must happen by is 7 days off or less. It stays at risk until it HAS a hearing,
//              whether or not the chair was asked (Nate, 13 Nov, "Any bill at risk"): asking is a step to do, not a reason to feel safe.
//   Stopped    did not advance this year (diedish). Never the word dead.
//   Moving     alive and not at risk.
//   An issue   is At risk when any one of its bills is; else Moving when any bill is alive; else Stopped. An issue with no bills this session has no standing (null).
import { S, SESSION_YEAR, SESSION_OVER, myIssueIds } from '../staff6/data.js';
import { diedish, wantsHearing, hearingAhead, stopOf, RISK_DAYS } from '../staff6/model.js';

export const isAlive = b => !!b && !diedish(b);
// The date its hearing must happen by, while it still can: { label, date, days } from the Capitol's calendar, or null.
export function deadlineOf(b) {
  if (!b || SESSION_OVER || !isAlive(b) || !wantsHearing(b) || hearingAhead(b)) return null;
  const st = stopOf(b);
  return st.column === 'a' && st.deadline && !st.deadline.missed ? st.deadline : null;
}
// A bill that still needs a hearing before its next deadline (what Your bills counts).
export const needsHearing = b => !!deadlineOf(b);
export const isAtRisk = b => { const d = deadlineOf(b); return !!d && d.days <= RISK_DAYS; };
// 'risk' | 'moving' | 'stopped'
export const billStanding = b => !isAlive(b) ? 'stopped' : isAtRisk(b) ? 'risk' : 'moving';
export function issueStanding(bills) {
  if (!bills.length) return null;
  const k = bills.map(billStanding);
  return k.includes('risk') ? 'risk' : k.includes('moving') ? 'moving' : 'stopped';
}
// This session's tracked bills on an issue.
export const billsOfIssue = i => (S.billIssues || []).filter(x => x.issue_id === i.id).map(x => (S.bills || []).find(b => b.id === x.bill_id))
  .filter(b => b && b.tracked !== false && (!b.session_year || +b.session_year === +SESSION_YEAR));
// The issues the person owns, helps with or follows (data.js myIssueIds), each with its standing. Archived issues and issues with no bill this session are left out.
export function myIssueStandings() {
  const mine = myIssueIds();
  return (S.issues || []).filter(i => !i.archived_at && mine.has(String(i.id))).map(i => { const bills = billsOfIssue(i); return { issue: i, bills, standing: issueStanding(bills) }; }).filter(x => x.standing);
}
// { risk, moving, stopped } counts of a list of standings (strings, or objects with .standing)
export function tally(list) {
  const t = { risk: 0, moving: 0, stopped: 0 };
  for (const x of list) { const k = typeof x === 'string' ? x : x.standing; if (k in t) t[k]++; }
  return t;
}
