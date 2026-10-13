// Today (#/, plan 3.1): one list to clear, not a dashboard to read. Every bill appears once, in the group of its most
// urgent task, with one button that does the step (acts in place, with Undo) or opens the one place that needs a word.
// Built only from what the current app already loads, so nothing new is asked of the database:
//   - testimony drafts: renderPortfolio's waiting list (app.js 1438), with the two fixes the walkthrough asked for:
//     approvals never depend on the Mine/Team scope or on Monitor bills, and the approval toast is written from the
//     state the server returns;
//   - "situations" on live bills (app.js 1457): no draft yet, a draft for an older version, no public ask before a
//     strong-position hearing, a P1 with no hearing as its deadline nears;
//   - action alerts (alertsToReview, plus the author's own returned and approved emails), S.todos, S.followups;
//   - the Inbox's "Needs you" rows (inboxRows / inboxActs, app.js 2697): unread messages and mentions become Reply
//     tasks, testimony notices fold into the draft task they are about, anything else is a notice with Mark done.
// Official updates (Inbox > Updates) become "What changed since yesterday", a folded digest that counts as read.
//
// The manager's tools (assessment 9/19, fix 3), all from the same loaded data:
//   - "Hearings today": every hearing today on the bills in view, filed or not, with who is going;
//   - whose list: Mine, Team, or one teammate's (worked out the way their own Today would be, read-only);
//   - a message stays on Today until it is answered or marked done: opening it only marks it "Seen";
//   - on a wide screen, a side panel (this week, waiting on others, team load) and a Monday-to-Friday Week view.
//
// The 9/19 follow-ups Nate asked for:
//   - the urgency mark from the current app's left rail leads every card, because it is the fastest thing to scan;
//   - a session clock in the side panel whose last line ("3 with no hearing yet") is a button that opens those
//     bills as suggestions, because that count is work and not a statistic;
//   - a suggestion section under the dated work that is never dressed as a task: no countdown, no "due", never in
//     the badge, and three plain answers on every card (Done, Not now, Not this bill);
//   - a quick look (look.js) instead of a trip to the bill page, from the card's chevron or the o key;
//   - "Seen" follows the person in advocates.prefs rather than sitting in one browser.
//
// R-022 (9/21, Nate's answers to the staff review):
//   - Next deadline names its bills with no hearing and shows the deadline after it, each with its own button
//     (decision 3); asking a chair stays a dated task for P1 bills only (decision 2 was no);
//   - every testimony row says when the testimony is due, as a clock time, beside the hearing (B-6);
//   - hearings on Monitor bills fold away until "+N on bills you monitor" (decision 4, advocates.prefs.showMonitor);
//   - said once (A-14, A-20): the deadline in one place, one button and a "…" on a suggestion, chat as one quiet row;
//   - Team means the team: teammates' dated work grouped by person, one person picker, and Message / Give to… on
//     "Waiting on others", which a phone now shows too;
//   - Coalitions I support (advocates.prefs.coalitions, decision 7) adds that coalition's week to Mine, never the badge;
//   - catching up: since yesterday, your last visit or 7 days, with a search (decision 6);
//   - between sessions: the session's results and the January checklist.
//
// Staff v3 (R-264, Nate 12 Oct: "too dense of information on the page, there is too much going on at one time"):
//   - A person comes here to clear the day's steps, one at a time. On a laptop (1100px and wider) that is a list of one
//     line per item (the urgency mark, the bill, what to do, its one button) and the item you picked, in full, beside it:
//     the summary, when it is due, every button, its Also items and its hearing. The side column holds nothing else but
//     one line to the next deadline, which opens This week. A phone keeps the cards.
//   - said once (A-14): no instruction notes on the cards, a new hearing named once, no "Open bill" beside the bill line;
//   - filled buttons only for what is overdue or due today; Getting started under the first group; the email-paused
//     notice is for Emails and Session setup, not Today;
//   - "Hearings today" is one line above the list; Waiting on others a fold at the end; Team load a fold in Team only;
//   - Ahead and the Week view are one "This week": the grid on a laptop, the day-by-day list on a phone, then the
//     deadlines with every bill that has no hearing yet and the suggestions under the deadline they race. This week's
//     asks moved to Outreach > Emails (emails.js imports weekAsksHTML and wireWeekAsks from here).
import { S, DB, DEMO, SESSION_OVER, SESSION_YEAR, DEADLINES, esc, fmtDT, fmtDate, advocate, isMine, isMuted, capitolUrl, effStage, hooks, DEMO_ASOF, draftNotesOf } from './data.js';
import { sharePageUrl, liveAsk } from './model.js';   // this week's asks (R-132); the ask still showing (Z1-3)
import { plainAction, OUT_PLAIN as OUT, draftFor, alertsToReview, approves, canFirstApprove, canSecondApprove, alertTarget, billNum, blurb, roomShort, chairMail, attendees, streamOf, hearingAhead, stopOf, diedish, legislativeDay, hstDayOf, gateNeed, deadlineName, unslack, billById, personName, OUTCOME_LABEL, sessionClock, suggestions, suggState, setSugg, SUGGEST_CAP, whyDead } from './model.js';
import { icon, btn, iconBtn, chip, avatar, groupHead, segmented, empty, notice, toast, openSheet, closeSheet, pickerSheet, menuSheet, confirmSheet, field, keysOn, urgentMark, countdown } from './ui.js';
import { newSteps, markNewStep } from './help.js';
import { draftAsking, makeDraftNow } from './testimony.js';
import { openLook } from './look.js';
import { todayPrepNotice } from './prep.js';
import { sessionGates, lastSlotBefore, noticeByFor, billByNum } from './model.js';
import { dailyWord } from './composer.js';   // which 4:30 pm email a Send joins

const HR = 36e5, DAY = 864e5;
import { billRoute } from './model.js';
// The Hawaiʻi calendar day of a moment. Hawaiʻi keeps UTC-10 all year (no daylight saving), so this is hstDayOf() by
// arithmetic: the Intl version costs about 30 times more, and the week panels ask for hundreds of days per draw.
const hst = t => { const x = new Date(t).getTime(); return Number.isNaN(x) ? hstDayOf(t) : new Date(x - 10 * HR).toISOString().slice(0, 10); };
const first = id => (advocate(id)?.full_name || 'Someone').split(' ')[0];
const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;
const clip = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1).replace(/\s\S*$/, '') + '…' : s; };
const room = r => roomShort(r).replace(/\s*&.*$/, '').trim();
// v2 keeps its own browser keys (hiphi2_…, with _demo in the sandbox) so the two apps never overwrite each other.
const KEY = k => `hiphi2_${k}${DEMO ? '_demo' : ''}`;
const load = (k, d) => { try { return localStorage.getItem(KEY(k)) ?? d; } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem(KEY(k), v); } catch { /* private window: the choice lasts this visit */ } };
export const HOVER = () => { try { return matchMedia('(hover: hover) and (pointer: fine)').matches; } catch { return false; } };
const typing = t => t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
// ui.js closes a sheet with history.back(), which lands a moment later. Navigating or opening another sheet before it
// lands loses that entry (the address stops matching the screen and Back leaves the app), so steps taken from a menu
// or after a sheet closes wait for it.
export const afterBack = () => !history.state?.sheet ? Promise.resolve() : new Promise(res => { let done = false; const f = () => { if (done) return; done = true; removeEventListener('popstate', f); setTimeout(res, 0); }; addEventListener('popstate', f); setTimeout(f, 500); });
const later = fn => async () => { await afterBack(); return fn(); };
// Layouts. The frame redraws the page when the window crosses 900px or 1100px, so the HTML may differ per layout.
const mq = q => { try { return matchMedia(q).matches; } catch { return false; } };
const DESK = () => mq('(min-width: 900px)');    // the desktop frame: Today sets its own width (today.css)
// The frame's sidebar layout: the rows and the open item beside them (v3, R-264), and This week's five-day grid.
const WIDE = () => mq('(min-width: 1100px)');

// ---- time ----
// "today 1:10 PM", "tomorrow 9:00 AM", else "Wed 3/18, 1:10 PM": staff should never have to work out the weekday.
export function whenLine(iso) {
  const t = new Date(iso).getTime(), d = hst(t), now = Date.now();
  const time = new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'Pacific/Honolulu' });
  return d === hst(now) ? `today ${time}` : d === hst(now + DAY) ? `tomorrow ${time}` : fmtDT(iso);
}
export const hearingLine = h => h ? `${esc(h.committee)} ${whenLine(h.scheduled_at)}${h.room ? ' · ' + esc(room(h.room)) : ''}` : '';
// Written testimony is due 24 hours before the hearing unless the notice says otherwise (Hawaiʻi rule).
// "New hearing: PSM/EIG Mon 3/23. Make the draft." (X10-5): where a hearing with no draft is said once, in the words staff use.
export const hearingDay = h => new Date(h.scheduled_at).toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric', timeZone: 'Pacific/Honolulu' }).replace(',', '');
const newHearing = (h, c) => `New hearing: ${c} ${hearingDay(h)}. Make the draft.`;
export const testDue = h => h ? new Date(h.testimony_deadline || new Date(h.scheduled_at).getTime() - DAY).getTime() : null;
// A hearing set and no testimony draft yet (X10-5). v3 names the hearing once, in the task line: the reason line leaves
// it out, and the open item says "Make the testimony draft" over a hearing block of its own (`ps`). The note that
// explained how drafts get made, and the "Open bill" beside the bill line, went (R-264, A-14, P-4).
const noDraft = (b, h, who) => ({ kind: 'nodraft', key: `s:${b.id}:nd:${h.id}`, b, h, due: testDue(h), who, s: newHearing(h, esc(h.committee)), ps: 'Make the testimony draft',
  btns: [{ label: draftAsking(h) ? 'Making the draft…' : 'Make the draft now', act: 'draftnow' }] });
// Testimony whose written deadline has passed while its hearing has not begun is late testimony, still taken (A-5 as
// amended by R-250): amber "late testimony until 1:10 PM", not red "overdue". `until` is that hearing's start. The note
// for letter-writers is due when their testimony is (R-148), so it is late, not overdue, in the same window.
const untilOf = t => (TESTIMONY.has(t?.kind) || t?.kind === 'dnote') && t.h?.scheduled_at ? t.h.scheduled_at : null;
// One rounding for every countdown (R-152 C): down, never up, so a deadline is never later than it reads (R-022), and every
// screen says the same number. It rounded to the nearest here and down in ui.js: the same deadline read "5h left" on Today and "Due in 6 hours" in Review.
const span = ms => { const h = Math.abs(ms) / HR; return h < 1 ? `${Math.max(1, Math.floor(Math.abs(ms) / 6e4))}m` : h < 48 ? `${Math.floor(h)}h` : `${Math.floor(h / 24)} days`; };
// A countdown is always an icon and words (plan 4): normal, amber within 24 hours, red once overdue.
export function cd(due, how = 'left') {
  if (due == null) return '';
  const ms = due - Date.now(), tone = ms <= 0 ? 'late' : ms <= DAY ? 'soon' : '';
  const s = span(ms), long = s.replace(/^(\d+)h$/, (m, n) => plural(+n, 'hour')).replace(/^(\d+)m$/, (m, n) => plural(+n, 'minute'));
  const text = how === 'first' ? (ms <= 0 ? `first was due ${s} ago` : `first due in ${s}`)
    : how === 'due' ? (ms <= 0 ? `Was due ${long} ago` : `Due in ${long}`)
    : how === 'testimony' ? (ms <= 0 ? `Testimony was due ${s} ago` : `Testimony due in ${s}`)
    : ms <= 0 ? `${s} overdue` : `${s} left`;
  return `<span class="sv-count ${tone}">${icon(ms <= 0 ? 'circle-alert' : 'clock')}${text}</span>`;
}
const endOfToday = () => new Date(hst(Date.now()) + 'T23:59:59-10:00').getTime();
const weekEnd = now => { const noon = new Date(hst(now) + 'T12:00:00-10:00'); return hst(noon.getTime() + ((7 - noon.getUTCDay()) % 7) * DAY); };
// Items with no deadline (a reply, an email to approve, a follow-up with no date) belong to today.
function groupOf(due, now = Date.now()) {
  if (due == null) return 'today';
  if (due < now) return 'overdue';
  const d = hst(due);
  if (d === hst(now)) return 'today';
  if (d === hst(now + DAY)) return 'tomorrow';
  return d <= weekEnd(now) ? 'week' : 'later';
}
const GROUPS = [['overdue', 'Overdue'], ['today', 'Today'], ['tomorrow', 'Tomorrow'], ['week', 'Later this week'], ['later', 'Coming up']];
// Date-only fields (a to-do or follow-up "due 3/18") count as due at 5 PM that day, as the current app does.
const dateDue = d => d ? new Date(String(d).slice(0, 10) + 'T17:00:00-10:00').getTime() : null;
// Calendar days in Hawaiʻi time (no daylight saving, so noon plus whole days is always the right date).
const noonOf = day => new Date(day + 'T12:00:00-10:00').getTime();
const dayAdd = (day, n) => hst(noonOf(day) + n * DAY);
const mondayOf = t => { const day = hst(t); return dayAdd(day, -((new Date(noonOf(day)).getUTCDay() + 6) % 7)); };
const dayFmt = (day, o) => new Date(noonOf(day)).toLocaleDateString('en-US', { timeZone: 'Pacific/Honolulu', ...o });
const timeOf = iso => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'Pacific/Honolulu' });
// A clock time someone can act on, never a sum to do (B-6): "today 1:00 PM", "yesterday 1:10 PM", "Tue 1:00 PM" within
// six days either side, else "Tue 3/24, 1:00 PM".
function atLine(ms) {
  const d = hst(ms), t0 = hst(Date.now()), time = timeOf(new Date(ms).toISOString());
  if (d === t0) return `today ${time}`;
  if (d === dayAdd(t0, 1)) return `tomorrow ${time}`;
  if (d === dayAdd(t0, -1)) return `yesterday ${time}`;
  return Math.abs(noonOf(d) - noonOf(t0)) < 6.5 * DAY ? `${dayFmt(d, { weekday: 'short' })} ${time}` : fmtDT(new Date(ms).toISOString());
}
// "4:00 PM today", "4:00 PM tomorrow", "Mon 4:00 PM": a deadline in a sentence ("Write the public ask by …").
function byLine(ms) {
  const d = hst(ms), t0 = hst(Date.now()), time = timeOf(new Date(ms).toISOString());
  return d === t0 ? `${time} today` : d === dayAdd(t0, 1) ? `${time} tomorrow` : atLine(ms);
}
// The public ask is due at 4:00 PM Hawaiʻi time two calendar days before the hearing's date (Nate, R-025 answer 4), and
// never later than the last 4:00 PM at least twelve hours before written testimony closes (R-116: at CPN, 48 hours,
// the old rule fell after the deadline). Since R-101 an approved ask goes out in the next 4:30 pm email, so 4:00 PM
// leaves time to approve it.
const askDue = h => {
  const two = new Date(dayAdd(hst(new Date(h.scheduled_at).getTime()), -2) + 'T16:00:00-10:00').getTime();
  if (!h.testimony_deadline) return two;
  const cut = new Date(h.testimony_deadline).getTime() - 12 * HR, four = new Date(hst(cut) + 'T16:00:00-10:00').getTime();
  return Math.min(two, four <= cut ? four : four - DAY);
};
// "Testimony due Tue 1:00 PM" (R-022, B-6): Today files a card under the day its testimony is due, and the rows used to
// show only the hearing's time, a day later, so people had to work the deadline out for themselves.
const testDueText = due => `Testimony ${due <= Date.now() ? 'was due' : 'due'} ${atLine(due)}`;
// The same, toned like a countdown (amber within a day, red once late) where no urgency block already says so (A-5).
const dueChip = (due, text) => { const ms = due - Date.now(), tone = ms <= 0 ? 'late' : ms <= DAY ? 'soon' : '';
  return `<span class="sv-count ${tone}">${icon(ms <= 0 ? 'circle-alert' : 'clock')}${esc(text)}</span>`; };
// "Jess", "Jess or Jaylen", "Jess, Jaylen or Nate": whoever a step waits on, in words.
const names = ids => { const n = ids.map(first); return n.length > 2 ? n.slice(0, -1).join(', ') + ' or ' + n[n.length - 1] : n.join(' or '); };
// "Message James" opens the bill's chat with @James typed in (the bill page reads ?mention=), so a nudge is two taps.
const mentionHref = (b, ids) => `${billRoute(b, 'activity')}?mention=${ids.map(id => advocate(id)?.initials).filter(Boolean).join(',')}`;
const msgWho = ids => ids.length === 2 ? 'both' : ids.length > 2 ? 'all of them' : names(ids);
const msgBtn = (b, ids) => ({ label: `Message ${msgWho(ids)}`, href: mentionHref(b, ids), text: true });


// ---- the model ----
// When a bill has several tasks, the earliest one leads the card; on a tie, the step closest to the Capitol wins.
// The letter-writer tasks (R-148) are off Today until Nate's February check (R-266); the drafts notes on each bill's
// Public tab and the public warning work as before.
const DNOTE_ON = false;
const RANK = { file: 1, review: 2, review2: 2, revise: 3, submit: 4, write: 5, send: 6, fix: 7, email: 8, stale: 9, dnote: 9.5, ask: 10, chair: 11, nodraft: 12, reply: 13, todo: 14, followup: 15, notice: 16, wait: 30 };
const TESTIMONY = new Set(['file', 'review', 'review2', 'revise', 'submit', 'write', 'stale', 'nodraft', 'wait']);
const byBill = () => { const m = new Map(); for (const h of S.hearings || []) { if (!m.has(h.bill_id)) m.set(h.bill_id, []); m.get(h.bill_id).push(h); } return m; };
export function hearingFor(d, idx) {
  const now = Date.now(), list = idx ? idx.get(d.bill_id) || [] : (S.hearings || []).filter(h => h.bill_id === d.bill_id);
  return (d.hearing_id && (S.hearings || []).find(h => h.id === d.hearing_id))
    || list.filter(h => h.committee === d.committee && h.status !== 'cancelled' && new Date(h.scheduled_at) > now).sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))[0] || null;
}
// v4 (R-269): the to-do the database makes for each hearing of a strongly supported bill while email is paused, "Send the
// ask to HIPHI's list and partners for the HHS hearing 3/20" (migration 112), opens that hearing's share kit: Done alone
// was a dead end (B-3). The to-do keeps no hearing id, so its words name it: the committee and the date.
const ASK_TODO = /^Send the ask\b.*\bfor the (\S+) hearing (\d{1,2})\/(\d{1,2})\s*$/;
function askTodoHearing(b, title) {
  const m = ASK_TODO.exec(String(title || '')); if (!m) return null;
  const md = h => new Date(h.scheduled_at).toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', timeZone: 'Pacific/Honolulu' });
  const hs = (S.hearings || []).filter(h => h.bill_id === b.id && h.status !== 'cancelled');
  return hs.find(h => h.committee === m[1] && md(h) === `${+m[2]}/${+m[3]}`) || hearingAhead(b) || null;
}
// A draft whose hearing ended more than two days ago is moot here (filing or approving can no longer help); the bill
// page still shows it. Without this, an old unfiled draft would sit in Overdue forever.
const moot = h => !!h && new Date(h.scheduled_at).getTime() < Date.now() - 2 * DAY;
const reviewers = () => {
  // Name the reviewer who signs off most often first: that is who is likeliest to pick it up.
  const n = id => Object.values(S.drafts || {}).flat().filter(d => d.second_approved_by === id).length;
  const list = S.advocates.filter(a => a.is_reviewer && a.is_active !== false).sort((a, b) => n(b.id) - n(a.id) || a.full_name.localeCompare(b.full_name));
  return list.map(a => a.full_name.split(' ')[0]).join(' or ') || 'a second approver';   // v3's word for the role (R-264)
};
export const reviewerNames = reviewers;
const admins = (except = null) => S.advocates.filter(a => a.is_admin && a.is_active !== false && a.id !== except).map(a => a.full_name.split(' ')[0]).join(' or ');
// Everyone who can give the first approval, admins and approvers alike (R-103): "Sent to Nate for review" left out Kris (R-152 C).
export const approvers = (except = null) => S.advocates.filter(a => (a.is_admin || a.can_approve) && a.is_active !== false && a.id !== except).map(a => a.full_name.split(' ')[0]).join(' or ');
// Whoever can give a first approval or approve an email (098): admins and approvers (Kris).
const approverList = (except = null) => S.advocates.filter(a => approves(a) && a.id !== except).map(a => a.full_name.split(' ')[0]).join(' or ');
export const adminNames = admins;
// One name when there is exactly one other admin, else "an admin" ("Nate or Jess sent it back" reads wrong).
const oneAdmin = (except = null) => { const a = approverList(except); return a && !a.includes(' or ') ? a : 'an approver'; };
// Is this the bill's first testimony? Then a reviewer signs off too (the same test as testimony_transition).
export const needsSecond = d => d.status === 'second_review' || !!d.first_for_bill
  || (d.status === 'review' && !Object.values(S.drafts || {}).flat().some(x => x.bill_id === d.bill_id && x.id !== d.id && (['approved', 'filed'].includes(x.status) || x.second_approved_at)));

// The review queue (#/review): every draft waiting for my approval, then emails, whatever the scope and whatever the
// bill's position. Emails are never my own (alertsToReview leaves them out).
export function reviewQueue() {
  const me = S.me || {}, idx = byBill(), out = [];
  for (const d of Object.values(S.drafts || {}).flat()) {
    const h = hearingFor(d, idx);
    if (!((d.status === 'review' && canFirstApprove(me, d, h)) || (d.status === 'second_review' && canSecondApprove(me, d)))) continue;
    const b = billById(d.bill_id); if (!b || moot(h)) continue;
    out.push({ type: 'draft', key: String(d.id), d, b, h, due: testDue(h) });
  }
  out.sort((x, y) => (x.due ?? Infinity) - (y.due ?? Infinity) || (x.b.priority || 9) - (y.b.priority || 9) || x.b.bill_number.localeCompare(y.b.bill_number, 'en', { numeric: true }));
  for (const a of alertsToReview()) out.push({ type: 'email', key: 'email-' + a.id, a, b: a.bill_id ? billById(a.bill_id) : null, due: null });
  return out;
}

// Reply sentences quote the question when there is one: "Kevin asked: Who is attending?"
function replyLine(name, body, mention) {
  const txt = unslack(body), parts = txt.match(/[^.!?]+[.!?]*/g) || [txt];
  const q = [...parts].reverse().find(x => /\?\s*$/.test(x.trim()));
  if (q) return { s: `${esc(name)} asked: ${esc(clip(q.trim(), 90))}`, more: q.trim() !== txt };
  return { s: `${esc(name)} ${mention ? 'mentioned you' : 'wrote'}: ${esc(clip(txt, 70))}`, more: txt.length > 70 };
}
const lowerFirst = s => /^[A-Z][a-z]/.test(s) ? s[0].toLowerCase() + s.slice(1) : s;

// Sandbox only: demoInit builds the inbox for the admin it signs in as; after &as=KV it must be Kevin's inbox, or
// Kevin would be asked to reply to his own messages. Rebuilt once per person, with the sandbox's own builder.
export function sandboxInbox() {
  if (!DEMO || !S.buildDemoInbox || !S.me) return;
  const builtFor = S.tdInboxFor ?? (S.advocates.find(a => a.is_admin) || S.advocates[0])?.id;
  if (builtFor !== S.me.id) S.inbox = S.buildDemoInbox();
  S.tdInboxFor = S.me.id;
}

// ---- messages stay until they are dealt with (assessment 9/19) ----
// Tapping Reply used to mark the message read at once, so a question nobody answered left Today and the badge; and the
// bill's Activity tab marks the whole chat read the moment it opens (DB.markChatSeen). Now a message leaves Today only
// when I send a message on that bill afterwards, or choose Mark done. Until then it stays, quieter, with a "Seen" chip.
//   known: every message Today has shown as unread this visit, so a read that happens elsewhere does not remove it;
//   seen:  opened without an answer;   done: cleared with Mark done.
// Seen has to outlive the page, because a phone reloads Today when you come back to it and by then the server says
// "read". It used to live in this browser (today_kept_*), which meant a message seen on the laptop was loud again on
// the phone. It now lives in advocates.prefs.seen, merged through DB.patchPrefs — the same call the rest of v2 uses,
// so no new database call. Writes are batched: at most one a second, never one per render, and in the sandbox
// patchPrefs only touches S.me.prefs. Entries older than three weeks are dropped on the way in.
const seenPrefs = () => { const s = S.me?.prefs?.seen; return s && typeof s === 'object' && !Array.isArray(s) ? s : {}; };
function msgState() {
  if (S.tdMsg && S.tdMsg.for === S.me?.id) return S.tdMsg;
  const st = S.tdMsg = { for: S.me?.id, known: new Set(), seen: new Set(), done: new Set(), at: {} };
  const cut = Date.now() - 21 * DAY;
  for (const [k, at] of Object.entries(seenPrefs())) if (typeof at === 'number' && at > cut) { st.known.add(k); st.seen.add(k); st.at[k] = at; }
  return st;
}
let seenTimer = null, seenNext = null;
function seenFlush() { clearTimeout(seenTimer); seenTimer = null; const o = seenNext; seenNext = null; if (o) DB.patchPrefs({ seen: o }).catch(() => { /* it is only which messages you have glanced at */ }); }
function keepSeen() {
  const st = msgState(), o = {};
  for (const k of st.seen) if (!st.done.has(k)) o[k] = st.at[k] || Date.now();
  const now = seenNext || seenPrefs(), ks = Object.keys(o);
  if (ks.length === Object.keys(now).length && ks.every(k => now[k] === o[k])) return;   // nothing new to save
  seenNext = o; clearTimeout(seenTimer); seenTimer = setTimeout(seenFlush, 1000);
}
function markSeen(keys) { const st = msgState(); for (const k of keys || []) { st.known.add(k); st.seen.add(k); st.at[k] ??= Date.now(); } keepSeen(); }

// ---- whose bills ----
const owns = (id, b) => (S.assignments[b.id] || []).includes(id);
const hasBill = (id, b) => owns(id, b) || (S.followersBy?.[b.id] || []).includes(id);
// The bills a view covers: mine (owned or followed, not muted), the whole team's, one teammate's, or the bills nobody
// owns ('none': Nate's R-025 answer 1, "No owner" as a real choice in the person picker).
const unowned = b => !(S.assignments[b.id] || []).length;
const billsOf = (scope, who) => scope === 'team' ? () => true : scope === 'none' ? unowned : scope === 'person' ? b => hasBill(who, b) : b => isMine(b);
const teammates = () => S.advocates.filter(a => a.is_active !== false);

// todayItems('mine' | 'team' | 'none' | 'person', who?) -> { groups: [{ id, title, cards, n }], cards, cluster, dueNow, late, tasks }
// Mine: my steps, plus what anyone can pick up on the bills I own or follow. Team: every bill, plus read-only rows for
// steps that wait on someone else. None: Team's steps on the bills nobody owns, and only those. Person: one teammate's
// list, worked out the way their own Today would be from what is loaded for everyone (drafts, to-dos, follow-ups,
// emails). Their inbox is theirs alone, so replies and notices are not in it, and every step is read-only: it is
// theirs to take.
export function todayItems(scope = 'mine', who = null) {
  const viewer = S.me, now = Date.now(), team = scope === 'team' || scope === 'none';
  const empty0 = { groups: [], cards: [], cluster: null, dueNow: 0, late: 0, tasks: [] };
  if (!viewer) return empty0;
  const me = scope === 'person' ? advocate(who) : viewer; if (!me) return empty0;
  const self = me.id === viewer.id;
  if (self) sandboxInbox();
  const isOwner = b => owns(me.id, b), mineBill = b => self ? isMine(b) : hasBill(me.id, b), muted = b => self && isMuted(b);
  const idx = byBill(), tasks = [], inScope = b => team || mineBill(b);
  const push = t => { t.rank = RANK[t.kind] || 20; tasks.push(t); };
  const own = b => (S.assignments[b.id] || [])[0] || null;
  const ids = pred => S.advocates.filter(a => a.is_active !== false && pred(a)).map(a => a.id);

  // ---- testimony drafts ----
  for (const d of Object.values(S.drafts || {}).flat()) {
    if (d.status === 'cancelled' || d.status === 'filed') continue;
    const b = billById(d.bill_id); if (!b) continue;
    const h = hearingFor(d, idx); if (moot(h)) continue;
    const due = testDue(h), c = esc(d.committee), subMe = !!d.submitted_by && d.submitted_by === me.id, ownMe = isOwner(b);
    const base = { b, d, h, due, key: `d:${d.id}` };
    // A step that waits on someone else (Team view, and the "Waiting on others" panel): `on` is who it waits on and
    // `ws` the short form ("Kevin: to file it") for a list that is already titled "Waiting on others".
    const wait = (whom, what, label, on) => push({ ...base, kind: 'wait', key: `w:${d.id}`, s: `Waiting for ${esc(whom)}${what.startsWith('to ') ? ' ' : ': '}${what}`, ws: `${esc(whom)}: ${what}`, chip: label, on });
    if (d.status === 'review' || d.status === 'second_review') {
      const two = d.status === 'second_review';
      if (two ? canSecondApprove(me, d) : canFirstApprove(me, d, h)) {   // approvals: never filtered by scope or Monitor
        const who = d.submitted_by ? (subMe ? (self ? 'your own' : 'their own') : `${esc(first(d.submitted_by))}’s`) : 'the';
        const at = two ? d.approved_at : d.submitted_at, h0 = at ? (now - new Date(at)) / HR : null;
        push({ ...base, kind: two ? 'review2' : 'review', who: 'yours', why: h0 == null ? '' : `${two ? 'Approved' : 'Sent'} ${h0 < 1 ? 'just now' : h0 < 48 ? Math.round(h0) + 'h ago' : Math.round(h0 / 24) + ' days ago'}`,
          s: two ? `Give the second approval on ${who} testimony` : `Review ${who} ${subMe || !d.submitted_by ? c + ' ' : ''}testimony`,
          btns: [{ label: 'Review', href: `#/review/${encodeURIComponent(d.id)}`, review: true }] });
      } else if (team) wait(two ? reviewers() : approverList(), two ? 'second approval' : 'approval', two ? '2nd approval' : 'In review', ids(a => two ? a.is_reviewer : approves(a)));
      continue;
    }
    // Monitor bills are watched, not worked: the draft made automatically from each hearing notice stays off Today
    // until someone touches it (submits it, or gets it back with a note); after that it is real work.
    if (b.position === 'monitor' && !d.submitted_at && !d.review_note) continue;
    const mine = (ownMe || subMe) && !muted(b), open = !own(b) && !d.submitted_by && inScope(b);
    if (d.status === 'approved') {
      // Past the written deadline with the hearing still to come, it is late testimony (R-250): the step says so, so the
      // amber mark beside it reads as time left to file late, not as how late it is (fresh-eyes review, R-264).
      const lt = due != null && due <= now && h && new Date(h.scheduled_at).getTime() > now ? 'late ' : '';
      if (mine || open) push({ ...base, kind: 'file', who: mine ? 'yours' : 'anyone', s: mine && self ? `File your ${lt}testimony at the Capitol` : `File the ${c} ${lt}testimony at the Capitol`,
        btns: [{ label: 'File at the Capitol', href: capitolUrl(b), ext: true }, { label: 'Mark filed', act: 'file' }] });
      else if (team) wait(first(d.submitted_by || own(b)), 'to file it', 'Approved', [d.submitted_by, own(b)]);   // either of them may file it
      continue;
    }
    // draft: sent back with a note, pulled back after submitting, or never submitted
    const k = d.review_note ? 'revise' : d.submitted_at ? 'submit' : 'write';
    if (mine || open || (k === 'revise' && subMe)) {
      const yours = mine && self ? 'your' : 'the', doc = d.doc_url ? { label: 'Open Doc', href: d.doc_url, ext: true } : null;
      // Who sent it back is not stored: an approved_by means it came back from second review, else from an admin.
      const asked = 'changes were asked for';   // the draft does not record who sent it back, so no name (it said "Nate asked" whoever had, R-152 C)
      push({ ...base, kind: k, who: mine ? 'yours' : 'anyone',
        s: k === 'write' ? `Write testimony for the ${c} hearing` : k === 'submit' ? `Submit ${yours} ${c} testimony for review` : `Revise ${yours} ${c} testimony${asked ? ': ' + esc(asked) : ''}`,
        q: k === 'revise' ? esc(d.review_note) : '',
        btns: k === 'submit' ? [{ label: 'Submit for review', act: 'submit' }, doc].filter(Boolean)
          : [doc, { label: k === 'revise' ? 'Resubmit' : 'Submit for review', act: 'submit' }].filter(Boolean) });
    } else if (team) wait(first(own(b) || d.submitted_by), k === 'revise' ? 'revising' : 'writing', k === 'revise' ? 'Sent back' : 'Draft', [own(b), d.submitted_by]);
  }

  // ---- situations: open to anyone, on live bills in scope (app.js 1457) ----
  for (const b of S.bills) {
    if (b.position === 'monitor' || !inScope(b)) continue;
    // X10-5 (R-180 wave 3): a hearing set for a bill with a position and no draft is work the day it is set, however far off it is
    // (the list below looks seven days ahead only). Past seven days it is this one card; inside seven days the loop below makes it.
    for (const h of (idx.get(b.id) || [])) {
      if (h.status === 'cancelled' || new Date(h.scheduled_at) - now < 7 * DAY || diedish(b)) continue;
      if (!draftFor(b.id, h.committee) && !S.failed?.('testimony drafts')) push(noDraft(b, h, isOwner(b) ? 'yours' : 'anyone'));
    }
    const ups = (idx.get(b.id) || []).filter(h => h.status !== 'cancelled' && new Date(h.scheduled_at) > now && new Date(h.scheduled_at) - now < 7 * DAY).sort((x, y) => x.scheduled_at.localeCompare(y.scheduled_at));
    if (!ups.length && b.priority !== 1) continue;
    if (diedish(b)) continue;
    const who = isOwner(b) ? 'yours' : 'anyone';
    // A new draft with a hearing coming and no note on what it changed (R-148): people who testified on an earlier draft
    // are told to read what changed before they send their letter again, so the note is due before testimony closes.
    // Also Claude's suggestion that a draft changes what people should say, waiting for staff's tick.
    // Off for now (R-266, Nate 10/12): back on Today only after his check in February.
    if (DNOTE_ON && ups.length && b.is_public && /^(HD|SD|CD|FD)\d+$/.test(b.current_version || '')) {
      const notes = draftNotesOf(b.id), n = notes && notes.find(x => x.version === b.current_version), v = esc(b.current_version);
      const to = `${billRoute(b, 'public')}?focus=drafts`;
      // v3 (R-264): the line says what to do and for whom, so the note that explained it on every card went (A-14, P-4).
      if (notes && !n) push({ kind: 'dnote', key: `s:${b.id}:dn:${b.current_version}`, b, h: ups[0], due: testDue(ups[0]), who, s: `Tell letter-writers what ${v} changed`,
        btns: [{ label: 'Write it', href: to }] });
      else if (n && n.changes_suggested && !n.changes_letters && n.written_by !== 'staff') push({ kind: 'dnote', key: `s:${b.id}:dt:${b.current_version}`, b, h: ups[0], due: testDue(ups[0]), who,
        s: `Check Claude’s warning to letter-writers about ${v}`,
        note: n.letter_note ? `Its advice to them: “${esc(n.letter_note)}”` : '', btns: [{ label: 'Check it', href: to }] });
    }
    for (const h of ups) {
      const dr = draftFor(b.id, h.committee), c = esc(h.committee);
      // The drafts read failed: the notice at the top says so, and no hearing is called draftless (R-152 B).
      if (!dr && !S.failed?.('testimony drafts')) push(noDraft(b, h, who));
      else if (dr && dr.status !== 'filed' && b.current_version && dr.version !== b.current_version) push({ kind: 'stale', key: `s:${b.id}:st:${dr.id}`, b, h, d: dr, due: testDue(h), who,
        s: `Check ${self && (isOwner(b) || dr.submitted_by === me.id) ? 'your' : 'the'} ${c} testimony: the bill is now ${esc(b.current_version)}`,
        note: `The draft was written for ${esc(dr.version || 'the introduced bill')}.`, btns: dr.doc_url ? [{ label: 'Open Doc', href: dr.doc_url, ext: true }] : [] });
      // An ask past its show-through date is no ask (Z1-3 part 4): the card asks for the next one.
      if (['strongly_support', 'strongly_oppose'].includes(b.position) && !liveAsk(b)) {
        const gone = String(b.public_action || '').trim() && b.public_action_until ? b.public_action_until : '';
        const d = hst(h.scheduled_at), when = d === hst(now) ? 'today’s' : d === hst(now + DAY) ? 'tomorrow’s' : new Date(h.scheduled_at).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'Pacific/Honolulu' }) + '’s';
        // Due at 4:00 PM two calendar days before the hearing, weekends included (Nate, R-025 answer 4): supporters need
        // the ask in time to testify, and written testimony closes a day before the hearing. It used to be due as the
        // hearing began, when it could no longer help anyone.
        const due = askDue(h), past = due <= now;
        const what = gone ? 'the next public ask' : 'the public ask';
        push({ kind: 'ask', key: `s:${b.id}:ask`, b, h, due, who, s: past ? `Write ${what} before ${when} hearing` : `Write ${what} by ${byLine(due)}`,
          wk: `Write ${what} for ${whoseDay(d, now)} ${c} hearing`,
          // v4 (R-269): straight to "The ask" on the Public tab (its field takes the focus), not the top of the tab.
          note: gone ? `The last ask showed through ${esc(fmtDate(gone + 'T12:00:00-10:00', { weekday: 'short' }))}.` : '', btns: [{ label: 'Write it', href: `${billRoute(b, 'public')}?focus=ask` }] });
      }
    }
    if (!ups.length && b.priority === 1) {
      const st = stopOf(b);
      if (st.column === 'a' && st.deadline && !st.deadline.missed && st.deadline.days <= 14 && st.committee) {
        const m = chairMail(st.committee), days = st.deadline.days, two = m && m.n > 1;
        const body = `Aloha ${m ? m.who : 'Chair'},\n\nThe Hawaiʻi Public Health Institute asks you to schedule a hearing on ${b.bill_number}${blurb(b, 120) ? ` (${blurb(b, 120)})` : ''} before the ${st.deadline.label} deadline on ${fmtDate(st.deadline.date)}.\n\nMahalo,\n${(viewer.full_name || '').split(' ')[0]}`;
        push({ kind: 'chair', key: `s:${b.id}:chair`, b, st, due: new Date(st.deadline.date + 'T23:59:59-10:00').getTime(), who,
          s: `Ask the chair${two ? 's' : ''} for a hearing: ${days <= 0 ? 'the deadline is today' : plural(days, 'day') + ' left'}`,
          why: `${esc(deadlineName(st.deadline))} ${fmtDate(st.deadline.date + 'T12:00:00-10:00', { weekday: 'short' }).replace(',', '')}: it must ${esc(gateNeed(st.deadline.label))}${m ? ' · ' + esc(m.who) : ''}`,
          btns: m ? [{ label: `Email the chair${two ? 's' : ''}`, href: `mailto:${m.email}?subject=${encodeURIComponent('Request for a hearing on ' + b.bill_number)}&body=${encodeURIComponent(body)}`, ext: true, mail: true }]
            : [{ label: 'Open bill', href: `${billRoute(b)}` }] });
      }
    }
  }

  // ---- action alerts (emails to supporters) ----
  const toReview = new Set((self ? alertsToReview() : (S.alerts || []).filter(a => a.status === 'submitted' && approves(me) && a.author_id !== me.id)).map(a => a.id));
  for (const a of S.alerts || []) {
    const b = a.bill_id ? billById(a.bill_id) : null, n = S.tdAud?.[a.id], tgt = esc(alertTarget(a)), base = { a, b, due: null, key: `a:${a.id}` };
    if (a.status === 'submitted' && toReview.has(a.id)) push({ ...base, kind: 'email', who: 'yours', s: `Approve ${esc(first(a.author_id))}’s email to ${n != null ? plural(n, 'supporter') : 'the followers of ' + tgt}`,
      why: `“${esc(clip(a.subject, 60))}”`, btns: [{ label: 'Review', href: `#/review/email-${a.id}`, review: true }] });
    else if (a.author_id === me.id && a.status === 'returned') push({ ...base, kind: 'fix', who: 'yours', s: `Fix ${self ? 'your' : 'the'} email: ${esc(oneAdmin(me.id))} sent it back`,
      q: esc(a.review_note || ''), why: `“${esc(clip(a.subject, 60))}”`, btns: [{ label: 'Edit email', href: `#/email/${a.id}` }] });
    else if (a.author_id === me.id && a.status === 'approved') push({ ...base, kind: 'send', who: 'yours', s: `Send ${self ? 'your' : 'the'} approved email to ${n != null ? plural(n, 'person', 'people') : 'the followers of ' + tgt}`,
      why: `“${esc(clip(a.subject, 60))}”`, btns: [{ label: 'Send', act: 'send' }] });
    else if (team && a.status === 'submitted') push({ ...base, kind: 'wait', key: `w:a${a.id}`, s: `Waiting for ${esc(oneAdmin(a.author_id))}: approval of ${esc(first(a.author_id))}’s email`, ws: `${esc(oneAdmin(a.author_id))}: approval of ${esc(first(a.author_id))}’s email`, chip: 'Email', on: ids(x => x.is_admin && x.id !== a.author_id) });
    else if (team && a.status === 'approved') push({ ...base, kind: 'wait', key: `w:a${a.id}`, s: `Waiting for ${esc(first(a.author_id))} to send the email`, ws: `${esc(first(a.author_id))}: to send the email`, chip: 'Email', on: [a.author_id] });
  }

  // ---- to-dos: mine, or unassigned on my bills; the team's show as waiting ----
  for (const [bid, arr] of Object.entries(S.todos || {})) for (const t of arr) {
    if (t.done) continue;
    const b = billById(bid); if (!b) continue;
    const mine = t.assignee_id === me.id || (!t.assignee_id && isOwner(b)), base = { b, t, due: dateDue(t.due_date), key: `td:${t.id}` };
    const kit = askTodoHearing(b, t.title);
    if (mine || (!t.assignee_id && inScope(b))) push({ ...base, kind: 'todo', who: mine ? 'yours' : 'anyone', s: esc(t.title),
      btns: [kit ? { label: 'Open the share kit', href: `#/hearing/${encodeURIComponent(kit.id)}?from=today&kit=1` } : null, { label: 'Done', act: 'todo' }].filter(Boolean) });
    else if (team && t.assignee_id) push({ ...base, kind: 'wait', key: `w:t${t.id}`, s: `Waiting for ${esc(first(t.assignee_id))}: ${esc(lowerFirst(t.title))}`, ws: `${esc(first(t.assignee_id))}: ${esc(lowerFirst(t.title))}`, chip: 'To do', on: [t.assignee_id] });
  }

  // ---- my follow-ups with supporters ----
  for (const f of S.followups || []) {
    if (f.done_at || f.advocate_id !== me.id) continue;
    const p = f.person || {}, name = p.name || (p.email ? personName(p) : 'a supporter');
    push({ kind: 'followup', key: `fu:${f.id}`, f, p, b: null, due: dateDue(f.due), who: 'yours', s: `Follow up with ${esc(name)}: ${esc(lowerFirst(f.what || ''))}`,
      btns: [{ label: 'Done', act: 'fu' }, p.phone ? { label: 'Call', href: `tel:${p.phone}`, ext: true, mail: true } : p.email ? { label: 'Email', href: `mailto:${p.email}`, ext: true, mail: true } : null].filter(Boolean) });
  }

  // ---- the inbox's "Needs you": replies and mentions, then notices (mine only: nobody else's inbox is loaded) ----
  const unread = self ? (S.inbox || []).filter(i => i.direct && i.unread) : [];
  const msgBy = new Map(), st = self ? msgState() : null;
  let changed = false;
  for (const i of self ? S.inbox || [] : []) {
    if (!i.direct || i.kind !== 'message' || !i.bill_id || !billById(i.bill_id)) continue;
    if (i.unread) st.known.add(i.key);
    if (st.done.has(i.key) || !(i.unread || st.known.has(i.key))) continue;   // cleared with Mark done, or read before this visit
    // Answered: I wrote on this bill after it arrived. That is the one way, besides Mark done, a message leaves Today.
    const at = new Date(i.at).getTime();
    if ((S.messages?.[i.bill_id] || []).some(m => m.advocate_id === me.id && new Date(m.created_at).getTime() > at)) { if (st.seen.delete(i.key)) changed = true; continue; }
    // Read during this visit without an answer (the bill's chat was opened some other way): that is Seen too.
    if (!i.unread && !st.seen.has(i.key)) { st.seen.add(i.key); st.at[i.key] ??= Date.now(); changed = true; }
    if (!msgBy.has(i.bill_id)) msgBy.set(i.bill_id, []); msgBy.get(i.bill_id).push(i);
  }
  if (changed) keepSeen();
  const mention = body => new RegExp(`@(${(me.initials || '').replace(/\W/g, '')}|${(me.full_name || '').split(' ')[0].replace(/\W/g, '')})\\b`, 'i').test(body || '');
  for (const [bid, list] of msgBy) {
    const b = billById(bid), latest = list.slice().sort((x, y) => String(y.at).localeCompare(String(x.at)))[0];
    const m = (S.messages?.[bid] || []).find(x => 'm:' + x.id === latest.key);
    if (m && m.advocate_id === me.id) continue;
    const name = m ? first(m.advocate_id) : String(latest.title || 'Someone').replace(/\s+wrote$/, '').split(' ')[0];
    const r = replyLine(name, latest.body || m?.body || '', mention(latest.body) && !isMine(b));
    // Seen: every message in it has been opened (here, or in the bill's chat) and none has been answered.
    const seen = list.every(i => !i.unread || st.seen.has(i.key));
    push({ kind: 'reply', key: `m:${bid}`, b, due: null, who: 'yours', s: r.s, q: r.more ? esc(unslack(latest.body || '')) : '', keys: list.map(i => i.key), from: name, seen,
      why: plural(list.length, seen ? 'message' : 'new message'), btns: [{ label: 'Reply', href: `${billRoute(b, 'activity')}?reply=1`, seen: true }] });
  }
  const testimonyBills = new Set(tasks.filter(t => t.b && TESTIMONY.has(t.kind)).map(t => t.b.id));
  for (const i of unread) {
    if (i.kind === 'message') continue;
    const b = i.bill_id ? billById(i.bill_id) : null;
    if (b && i.kind === 'testimony' && testimonyBills.has(b.id)) continue;   // the draft task above already says it
    if (b && i.kind === 'deadline' && testimonyBills.has(b.id)) continue;
    const tab = { chat: 'activity', timeline: 'activity' }[i.tab] || '';
    push({ kind: 'notice', key: `n:${i.key}`, i, b, due: null, who: 'yours', s: esc(clip(unslack(i.title), 110)), q: i.body ? esc(clip(unslack(i.body), 220)) : '',
      why: `${{ testimony: 'Testimony', deadline: 'Reminder', system: 'From the tracker', hearing: 'Hearing', status: 'Update' }[i.kind] || 'Notice'} · ${fmtDT(i.at)}`,
      btns: b ? [{ label: 'Open', href: `${billRoute(b)}${tab ? '/' + tab : ''}`, read: true }] : [{ label: 'Mark done', act: 'read' }] });
  }

  // A teammate's steps are theirs to take. On a bill the one thing to do about someone else's step is to ask them about
  // it, so the button is "Message Kevin" (R-022); "Open bill" said again what the bill line above it already does (A-14).
  if (!self) for (const t of tasks) { t.ro = true;
    t.btns = t.b ? [msgBtn(t.b, [me.id])] : t.kind === 'followup' ? [{ label: 'Open their page', href: `#/person/${t.f.person_id}`, text: true }] : t.a ? [{ label: 'Open the email', href: `#/email/${t.a.id}`, text: true }] : []; }

  // ---- cards: one per bill ----
  // Two or more approvals waiting for me become one "Start review" card (review mode walks through them). A
  // teammate's approvals stay one card per bill: review mode is only ever my own queue.
  if (scope === 'none') { const keep = tasks.filter(t => t.b && unowned(t.b)); tasks.length = 0; tasks.push(...keep); }
  const revs = tasks.filter(t => t.kind === 'review' || t.kind === 'review2');
  let cluster = null, list = tasks;
  if (revs.length >= 2 && self) { cluster = revs.sort((x, y) => (x.due ?? Infinity) - (y.due ?? Infinity) || (x.b.priority || 9) - (y.b.priority || 9)); list = tasks.filter(t => !revs.includes(t)); }
  const eff = t => t.due ?? endOfToday();
  const cmp = (x, y) => (x.kind === 'wait') - (y.kind === 'wait') || eff(x) - eff(y) || x.rank - y.rank;
  const byKey = new Map();
  for (const t of list) { const k = t.b ? 'b:' + t.b.id : t.key; if (!byKey.has(k)) byKey.set(k, { key: k, b: t.b, tasks: [] }); byKey.get(k).tasks.push(t); }
  const cards = [...byKey.values()].map(c => { c.tasks.sort(cmp); c.p = c.tasks[0]; c.due = c.p.due; c.group = groupOf(c.p.due, now); if (c.p.kind === 'nodraft' && !['overdue', 'today'].includes(c.group)) c.group = 'today'; /* a new hearing with no draft is work today, however far off the hearing is (X10-5) */ c.wait = c.p.kind === 'wait'; c.seen = !!c.p.seen; return c; });
  if (cluster) { const due = Math.min(...cluster.map(t => t.due ?? Infinity)); cards.push({ key: 'cluster', cluster, due: Number.isFinite(due) ? due : null, group: groupOf(Number.isFinite(due) ? due : null, now), tasks: cluster }); }
  // Within a group: the review cluster, then by time; a message already seen sits below the new ones; waiting rows last.
  const ord = (x, y) => !!y.cluster - !!x.cluster || x.wait - y.wait || eff(x.p || x) - eff(y.p || y) || (!!x.seen - !!y.seen) || ((x.b?.priority || 9) - (y.b?.priority || 9)) || String(x.b?.bill_number || x.key).localeCompare(String(y.b?.bill_number || y.key), 'en', { numeric: true });
  const weight = c => c.cluster ? c.cluster.length : c.wait ? 0 : 1;
  // "Overdue 5" for one overdue draft in a cluster of five was wrong (X10-6, P-5): in Overdue a review cluster counts only what is overdue.
  const cn = c => c.cluster ? (c.group === 'overdue' ? c.cluster.filter(t => t.due != null && t.due <= now).length || 1 : c.cluster.length) : 1;
  const groups = GROUPS.map(([id, title]) => { const cs = cards.filter(c => c.group === id).sort(ord); return { id, title, cards: cs, n: cs.reduce((s, c) => s + cn(c), 0) }; }).filter(g => g.cards.length);
  const dueNow = cards.filter(c => c.group === 'overdue' || c.group === 'today').reduce((s, c) => s + weight(c), 0);
  const late = cards.filter(c => c.group === 'overdue').reduce((s, c) => s + weight(c), 0);
  return { groups, cards, cluster, dueNow, late, tasks };
}

// ---- What changed since yesterday: one line per bill, and opening it counts as read ----
// plainAction and the outcome wording moved to model.js (R-022), so the weekly memo can use them too.
// Catching up (decision 6): since yesterday (the default, reaching back over a weekend), since your last visit, or the
// last 7 days. Every update and message is kept on its row, so the search can find a word in any of them, not only in
// the one line shown (S.recentEvents holds eight days of the tracked bills).
export const SINCE = ['day', 'visit', 'week'];
export function digest(scope = 'mine', since = 'day') {
  const me = S.me, now = Date.now(); if (!me) return { label: 'yesterday', head: 'since yesterday', rows: [], keys: [], dayLabel: 'yesterday' };
  // "Since yesterday", reaching back over a weekend: on a Monday it covers Friday too.
  let back = 1; const dow = t => new Date(hst(t) + 'T12:00:00-10:00').getUTCDay();
  while ([0, 6].includes(dow(now - back * DAY)) && back < 3) back++;
  const dayStart = new Date(hst(now - back * DAY) + 'T00:00:00-10:00').getTime();
  const dayLabel = back === 1 ? 'yesterday' : new Date(now - back * DAY).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'Pacific/Honolulu' });
  // Your last visit: the moment the visit before this one began (app.js keeps it). A visit that began less than an hour
  // ago, or none known, says nothing new, so it reaches back a day like the default.
  const visit = S.sinceVisit && S.sinceVisit < now - HR ? S.sinceVisit : dayStart;
  const start = since === 'week' ? now - 7 * DAY : since === 'visit' ? visit : dayStart;
  const label = since === 'week' ? 'the last 7 days' : since === 'visit' ? `your last visit, ${atLine(visit)}` : dayLabel;
  const head = since === 'week' ? 'in the last 7 days' : `since ${label}`, from = since === 'visit' ? atLine(visit) : '';
  const want = b => b && (scope === 'team' ? b.position && b.position !== 'monitor' : isMine(b) && (b.position !== 'monitor' || S.follows?.has(b.id)));
  const by = new Map(), row = b => { let r = by.get(b.id); if (!r) by.set(b.id, r = { b, best: null, n: 0, msgs: 0, at: 0, items: [] }); return r; };
  const add = (b, text, rank, at) => { if (!want(b)) return; const r = row(b); r.n++; r.at = Math.max(r.at, at); r.items.push({ text, rank, at });
    if (!r.best || rank < r.best[1] || (rank === r.best[1] && at > r.best[2])) r.best = [text, rank, at]; };
  for (const e of S.recentEvents || []) { if (e.source && e.source !== 'auto') continue; const at = new Date(e.occurred_at).getTime(); if (at < start || at > now) continue;
    const [text, rank] = plainAction(e.title); add(billById(e.bill_id), text, rank, at); }
  for (const h of S.hearings || []) { const o = S.outcomes?.[h.id]; if (!o?.outcome) continue; const at = new Date(o.reported_at || h.scheduled_at).getTime(); if (at < start || at > now) continue;
    add(billById(h.bill_id), (OUT[o.outcome] || (c => `${o.outcome} in ${c}`))(h.committee), 0, at); }
  for (const [bid, msgs] of Object.entries(S.messages || {})) { const b = billById(bid), got = msgs.filter(m => m.advocate_id !== me.id && new Date(m.created_at).getTime() >= start && new Date(m.created_at).getTime() <= now);
    if (got.length && want(b)) { const r = row(b); r.msgs = got.length; r.at = Math.max(r.at, ...got.map(m => new Date(m.created_at).getTime()));
      for (const m of got) r.items.push({ msg: true, who: first(m.advocate_id), text: unslack(m.body), at: new Date(m.created_at).getTime() }); } }
  const rows = [...by.values()].sort((x, y) => (x.best ? x.best[1] : 9) - (y.best ? y.best[1] : 9) || (x.b.priority || 9) - (y.b.priority || 9) || y.at - x.at);
  return { label, head, from, dayLabel, rows, keys: (S.inbox || []).filter(i => !i.direct && i.unread).map(i => i.key) };
}
// The search: a bill number ("hb1780", "1780"), a nickname, or any word in the updates and messages. A row found by a
// word shows the line it was found in, so the answer to "where did I see that" is on screen.
const squash = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[ʻ‘’`]/g, '');
function digestFind(rows, q) {
  const w = squash(q).trim(); if (!w) return rows.map(r => ({ r, hit: null }));
  const n = w.replace(/\s+/g, '');
  return rows.map(r => {
    if (squash(r.b.bill_number).includes(n) || squash(r.b.nickname).includes(w) || squash(blurb(r.b, 200)).includes(w)) return { r, hit: null };
    const hit = r.items.filter(x => squash(x.text).includes(w)).sort((x, y) => !!x.msg - !!y.msg || y.at - x.at)[0];
    return hit ? { r, hit } : null;
  }).filter(Boolean);
}

// ---- rendering ----
// Whose list. v4 (R-269): Today always opens on Mine. Team is a look for this visit (S.tdScope) that lives in the
// address, #/?scope=team, so a Slack link can open it (B-10) and Back from a bill comes back to it. It used to be saved
// between visits: one look at Team opened the next morning on Team, which leaves out the viewer, so Kevin's own work
// and Jess's approvals were off screen. One teammate's list (S.tdWho) is a look inside Team, as before.
function scopeOf() {
  const team = S.route?.name === 'today' && S.route.q?.scope === 'team';
  S.tdScope = team ? 'team' : 'mine';
  if (!team || (S.tdWho && S.tdWho !== 'none' && (S.tdWho === S.me?.id || !teammates().some(a => a.id === S.tdWho)))) S.tdWho = null;
  return S.tdWho === 'none' ? 'none' : S.tdWho ? 'person' : S.tdScope;
}
const whoOf = () => scopeOf() === 'person' ? S.tdWho : null;
// The address of Today or This week (v4, R-269): the view, the week paged to and Team; Mine is plain #/.
function tdHref({ week = viewOf(S.route) === 'week', w = week ? weekOff(S.route) : 0, team = S.tdScope === 'team' } = {}) {
  const q = [week ? 'view=week' : '', week && w ? `w=${w}` : '', team ? 'scope=team' : ''].filter(Boolean).join('&');
  return '#/' + (q ? '?' + q : '');
}
// This week lives in the address (#/?view=week&w=1), so it can be linked and reloaded. v3 has one "This week" in place
// of Ahead and the Week view (R-264): an old ?view=ahead link from Slack lands on it too. A laptop gets the Monday-to-
// Friday grid and can page through weeks (w=); a phone gets the day-by-day list of the next seven days, which has no
// other week to page to, so w= means nothing there.
const viewOf = route => route?.q?.view === 'ahead' || route?.q?.view === 'week' ? 'week' : 'list';
const weekOff = route => WIDE() ? Math.max(-26, Math.min(26, parseInt(route?.q?.w, 10) || 0)) : 0;
// The heading says whose list it is ("your Today" is what the app calls the list elsewhere), and This week says it
// is the week (Nate, R-025 answer 3: it read "Today" over a whole week).
const weekWord = off => off === 0 ? 'this week' : off === 1 ? 'next week' : off === -1 ? 'last week' : `the week of ${dayFmt(dayAdd(mondayOf(Date.now()), off * 7), { month: 'short', day: 'numeric' })}`;
const heading = () => { const s = scopeOf();
  if (viewOf(S.route) === 'week') { const w = weekWord(weekOff(S.route)); return s === 'person' ? `${first(S.tdWho)}: ${w}` : s === 'team' ? `Team: ${w}` : s === 'none' ? `No owner: ${w}` : w[0].toUpperCase() + w.slice(1); }
  return s === 'person' ? `${first(S.tdWho)}’s Today` : s === 'team' ? 'Team Today' : s === 'none' ? 'Bills with no owner' : 'Today'; };
let LAST = new Map();   // key -> task for the list on screen, so a click finds the record its button was drawn from

// One toolbar: the heading (desktop; a phone has it in the frame's header) and the date; then Today | This week and
// whose list it is. The next deadline is said once, by the line beside the list and the deadlines under This week's
// grid, not here as well (A-14, R-022).
function toolbar(route) {
  const now = Date.now(), ld = SESSION_OVER ? null : legislativeDay(), scope = scopeOf(), who = scope === 'person' ? advocate(S.tdWho) : null;
  const week = viewOf(route) === 'week';
  const day = new Date(now).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'Pacific/Honolulu' });
  const a = [day, ld ? (ld.today ? `Day ${ld.day} of ${ld.of}` : `Recess · day ${ld.day} of ${ld.of}`) : SESSION_OVER ? 'Between sessions' : ''].filter(Boolean).join(' · ');
  // Mine | Team, and inside Team one person picker: Everyone, one teammate, or No owner (R-022, wave 3 #15; Nate's
  // R-025 answers 1 and 2). It used to read "Mine | Everyone" with a second "Everyone" picker beside it, and the Week
  // view had a row of owner chips as well; the list and This week now share this one picker.
  const none = scope === 'none';
  const seg = `<div class="sv-seg td-scope" role="group" aria-label="Whose tasks"><button type="button" data-seg="tdscope" data-val="mine" aria-pressed="${scope === 'mine'}">Mine</button><button type="button" data-seg="tdscope" data-val="team" aria-pressed="${scope !== 'mine'}">Team</button></div>`;
  const whoBtn = scope === 'mine' ? '' : `<div class="td-whorow"><button type="button" class="sv-pick td-whobtn" data-whopick aria-haspopup="dialog" aria-label="${esc(who ? `Showing ${who.full_name}’s ${week ? 'week' : 'list'}. Choose someone else` : none ? 'Showing the bills nobody owns. Choose someone' : 'Showing everyone. Choose one teammate')}">${who ? avatar(who, 24) : none ? avatar(null, 24) : icon('users')}<span>${who ? esc(who.full_name) : none ? 'No owner' : 'Everyone'}</span>${icon('chevron-down', { cls: 'chev' })}</button></div>`;
  return `<div class="td-sub"><div class="td-head"><h1 class="td-h1" tabindex="-1">${esc(heading())}</h1>
      <p class="td-date"><span>${esc(a)}</span></p></div>
    <div class="td-tools">${segmented('tdview', [['list', 'Today'], ['week', 'This week']], viewOf(route), 'Today or this week')}${seg}</div>${whoBtn}</div>`;
}
// At most one notice, most important first: the sync is stale (admins), new bills to sort in the opening weeks, then the
// issues' prep. "Email is paused" is said on Emails and Session setup, where it can be acted on: on Today and This week
// it led every admin's page all autumn, a sentence to read and nothing to do (R-264, P-4).
// Getting started (R-106, Nate 9/30): the five New here? steps from Help, on Today itself for a new teammate's first 45
// days (always in the sandbox), until all five are done or they hide it. One line that opens on demand, under the first
// group of work since v3, so it never pushes the day's work down (A-1). It replaced the old "New here? Read how the
// tracker works" notice, which the issue-prep notice could hide.
function startCard() {
  const me = S.me; if (!me || load('newhere_done', '')) return '';
  const age = me.created_at ? Date.now() - new Date(me.created_at).getTime() : Infinity;
  if (!DEMO && !(age < 45 * DAY)) return '';
  const steps = newSteps(), n = steps.filter(s => s.done).length; if (n === steps.length) return '';
  return `<details class="card td-start" data-tdstart${S.tdStartOpen ? ' open' : ''}><summary><span class="td-startt">${icon('sparkles')}<b>Getting started</b><span class="td-startn">${n} of ${steps.length} done</span></span><span class="st-meter" aria-hidden="true"><i style="width:${Math.round(n / steps.length * 100)}%"></i></span>${icon('chevron-down', { cls: 'td-startc' })}</summary>
    <div class="rows">${steps.map(s => `<a class="row st-newrow${s.done ? ' done' : ''}" href="${s.href}" data-tdfr="${s.k}"><span class="st-ric">${icon(s.done ? 'circle-check' : 'circle-dashed')}<span class="sr">${s.done ? 'Done:' : 'To do:'}</span></span><span class="body"><span class="title">${esc(s.title)}</span><span class="sub">${esc(s.sub)}</span></span>${icon('chevron-right', { cls: 'chev' })}</a>`).join('')}</div>
    <div class="td-startf">${btn('Hide this', { kind: 'text', sm: true, attrs: { 'data-newhere': '1' } })}</div></details>`;
}
function oneNotice() {
  const me = S.me || {};
  if (me.is_admin && !DEMO) {
    const lastOk = (S.syncRuns || []).find(r => r.ok)?.finished_at, failed = (S.syncRuns || [])[0]?.ok === false;
    const hrs = lastOk ? Math.round((Date.now() - new Date(lastOk)) / HR) : null;
    if (!SESSION_OVER && (failed || hrs == null || hrs > 36)) return notice('warn', 'triangle-alert', hrs == null ? 'The bill sync has not finished recently. Bills may be out of date.' : `The bill sync last finished ${hrs > 47 ? Math.round(hrs / 24) + ' days' : hrs + ' hours'} ago. Bills may be out of date.`, btn('Check', { kind: 'text', href: '#/setup/sync' }));
  }
  // Getting the issues ready for 2027 (R-088): an owner's issues left to do, or what is waiting for an admin to approve.
  const n = S.tdTriage?.suggested || S.tdTriage?.undecided;
  const sort = n ? notice('info', 'sparkles', `<b>${plural(n, 'new bill')} to sort.</b>`, btn('Sort new bills', { kind: 'secondary', href: '#/bills/new' })) : '';
  // Session work first (R-118): in the opening weeks and in session, new bills to sort take the slot; the issue prep
  // notice waits for a quiet day.
  if (sort && (openWeeks() || legislativeDay())) return sort;
  // The practice copy is frozen on a March day, when the 2027 issue prep (due 6 Nov) would long be done: its notice led every Today
  // there and taught the wrong order of work (R-152 D). Between sessions (&season=off) it is real and stays.
  const prep = DEMO && !SESSION_OVER ? '' : todayPrepNotice(); if (prep) return prep;
  return sort;   // Getting started is its own card now (startCard), not this one notice slot (R-106)
}
// The opening weeks around the introduction cutoff are when new bills need a decision (the same window as app.js 1633).
const openWeeks = () => { const c = (DEADLINES.introduced || [])[0]; if (!c) return false; const cut = new Date(c[1] + 'T23:59:59-10:00').getTime(), now = Date.now(); return now > cut - 18 * DAY && now < cut + 3 * DAY; };

// The reason line: whose it is, when the testimony is due, then the hearing ("Testimony due tomorrow 1:00 PM · EDU
// hearing Wed 3/18, 1:00 PM · Rm 229"). In Mine everything unlabelled is yours, so only "Open to anyone" is said.
// `mark` says the card already leads with the urgency block, so no countdown is repeated; a testimony step still says
// the clock time it is due (R-022, B-6), because the block says how long and nobody should have to work out when.
// A new hearing's card names the hearing in its task line, so this line leaves it out (R-264, A-14).
const tDue = t => TESTIMONY.has(t.kind) && !!t.h && t.due != null;
// Late testimony right now: the written deadline has passed and its hearing has not begun (A-5, R-250).
const lateNow = t => { const u = untilOf(t), now = Date.now(); return !!u && t.due != null && t.due <= now && new Date(u).getTime() > now; };
const dueIso = t => t.due == null ? null : new Date(t.due).toISOString();
function why(t, team, mark = false) {
  const who = t.kind === 'wait' ? '' : t.who === 'anyone' ? 'Open to anyone' : team && !['reply', 'notice', 'email', 'fix', 'send'].includes(t.kind) ? 'Yours' : '';
  const due = t.kind === 'chair' ? '' : tDue(t) ? (mark ? esc(testDueText(t.due)) : lateNow(t) ? countdown(dueIso(t), { until: untilOf(t) }) : dueChip(t.due, testDueText(t.due)))
    : t.due != null ? (mark ? '' : cd(t.due)) : (t.kind === 'todo' || t.kind === 'followup') ? 'No due date' : '';
  const parts = [who, ...String(t.why || '').split(' · '), due, ...(t.h && t.kind !== 'nodraft' ? [`${esc(t.h.committee)} hearing ${whenLine(t.h.scheduled_at)}`, t.h.room ? esc(room(t.h.room)) : ''] : [])].filter(Boolean);
  // Short parts never break inside ("Rm 225" stays together); a long one (two chairs' names) may wrap.
  // The dot stays with the part before it (a no-break space), so a wrapped line never starts with "·".
  return parts.map(x => `<span class="td-part${x.replace(/<[^>]+>/g, '').length > 28 ? ' long' : ''}">${x}</span>`).join(' · ');
}
// A bill is named by its nickname when HIPHI gave it one (every bill with a position has one), then the plain summary;
// a bill that is only monitored has just the summary. The number always shows, in front.
const SEEN = () => chip('Seen', '', 'eye');
const billName = (b, n = 140) => b.nickname ? `<b class="td-nick">${esc(b.nickname)}</b><span class="td-t td-t2">${esc(blurb(b, n))}</span>` : `<span class="td-t">${esc(blurb(b, n))}</span>`;
// `filled`: v3 fills a button only where the work is overdue or due today; tomorrow's and later get an outline, so the
// eye goes to what cannot wait (R-264, narrowing Nate's 9/20 amendment of A-3 on purpose).
function button(t, x, primary, filled = true) {
  const attrs = { 'data-k': t.key, ...(primary ? { 'data-primary': '1' } : {}), ...(x.act ? { 'data-act': x.act } : {}), ...(x.read ? { 'data-read': '1' } : {}), ...(x.seen ? { 'data-seen': '1' } : {}), ...(x.review ? { 'data-review': '1' } : {}) };
  // A message already seen is quieter: its Reply is an outline, so the new ones keep the one filled button.
  const kind = primary && !x.text ? (t.seen || !filled ? 'secondary' : 'primary') : 'text';
  if (x.href) return btn(esc(x.label), { kind, href: x.href, target: x.ext && !x.mail ? '_blank' : undefined, icon: kind === 'primary' ? x.icon : undefined, iconEnd: x.ext && !x.mail ? 'external-link' : undefined, attrs });
  return btn(esc(x.label), { kind, attrs });
}
// An "Also" row says when too: a testimony step by its clock time ("due Tue 1:00 PM", B-6), anything else by countdown.
const alsoDue = t => t.due == null ? '' : lateNow(t) ? countdown(dueIso(t), { until: untilOf(t) }) : tDue(t) ? dueChip(t.due, `${t.due <= Date.now() ? 'was due' : 'due'} ${atLine(t.due)}`) : cd(t.due);
function alsoRow(t, c) {
  const x = (t.btns || [])[0], inner = `<span class="td-also-t"><span class="td-also-l">Also:</span> ${t.s}</span>${t.seen ? SEEN() : ''}${alsoDue(t)}${icon(x && x.ext && !x.mail ? 'external-link' : 'chevron-right', { cls: 'chev' })}`;
  const bill = c.b ? `${billRoute(c.b)}` : '';
  if (t.kind === 'wait' || !x) return bill ? `<a class="td-also" href="${esc(bill)}">${inner}</a>` : `<div class="td-also">${inner}</div>`;
  if (x.href) return `<a class="td-also" href="${esc(x.href)}" data-k="${esc(t.key)}"${x.read ? ' data-read="1"' : ''}${x.seen ? ' data-seen="1"' : ''}${x.review ? ' data-review="1"' : ''}${x.ext && !x.mail ? ' target="_blank" rel="noopener"' : ''}>${inner}</a>`;
  return `<button type="button" class="td-also" data-also="${esc(t.key)}">${inner}</button>`;
}
// The urgency block that leads a card (ui.js urgentMark), the current app's left rail. The wrapper keeps its width
// even when there is nothing to say, so every sentence on the page starts on the same line down the list.
const urgBlock = (due, until = null) => `<span class="td-urg">${urgentMark(due == null ? null : new Date(due).toISOString(), { until })}</span>`;
const lookBtn = b => iconBtn('chevron-right', `Quick look at ${billNum(b)}`, { 'data-look': '1' }, 'td-look');
// Every card drawn, by the key its "…" button carries, so the menu opens on the card that was drawn: in Team the same
// bill can be on two people's lists with different steps (R-022).
let CARDS = new Map();
// o.gk: the group a card is drawn in (Team draws one group per person), so its keys stay unique on the page.
// o.msg: whose step it is, for "Message Jess or Jaylen" when a step belongs to more than one person.
// o.filled: false in Tomorrow and later (see button()).
function card(c, i, team, o = {}) {
  const filled = o.filled !== false;
  if (c.cluster) {
    const bills = [...new Set(c.cluster.map(t => billNum(t.b).split(' ')[0]))];
    return `<article class="td-card td-cluster" data-k="cluster" tabindex="-1" aria-labelledby="td-s${i}">
      ${urgBlock(c.due, untilOf(c.cluster[0]))}
      <p class="td-s" id="td-s${i}">${icon('clipboard-check')}Review ${plural(c.cluster.length, 'testimony draft')}</p>
      <p class="td-why">${esc([c.due != null ? `First ${lowerFirst(testDueText(c.due))}` : '', (late => late > 0 && late < c.cluster.length ? `${late} of ${c.cluster.length} overdue` : '')(c.cluster.filter(t => t.due != null && t.due <= Date.now()).length), 'Earliest first · ' + bills.slice(0, 6).join(', ') + (bills.length > 6 ? ` and ${bills.length - 6} more` : '')].filter(Boolean).join(' · '))}</p>
      <div class="td-acts">${btn('Start review', { kind: filled ? 'primary' : 'secondary', href: '#/review', attrs: { 'data-primary': '1', 'data-review': '1' } })}</div></article>`;
  }
  const p = c.p, b = c.b, also = c.tasks.slice(1), k = (o.gk ? o.gk + '~' : '') + c.key;
  CARDS.set(k, c);
  if (b && c.tasks.every(t => t.kind === 'reply')) return msgCard(c, i, k);
  const top = b ? `<a class="td-bill${b.nickname ? ' td-named' : ''}" href="${billRoute(b)}"><b class="td-num">${esc(billNum(b))}</b> ${b.priority === 1 ? '<span class="sv-p1">P1</span> ' : ''}${billName(b)}</a>`
    : p.kind === 'followup' ? `<a class="td-bill td-kind" href="#/person/${esc(p.f.person_id)}">${icon('user-round')}<span>Follow-up</span></a>`
    : p.a ? `<a class="td-bill td-kind" href="#/email/${esc(p.a.id)}">${icon('mail')}<span>Email to supporters</span></a>`
    : `<span class="td-bill td-kind">${icon('bell')}<span>From the tracker</span></span>`;
  const more = b || p.kind === 'followup' || p.a ? iconBtn('ellipsis', `More for ${b ? billNum(b) : 'this item'}`, { 'data-more': k }, 'td-more') : '';
  const acts = (o.msg && b ? [msgBtn(b, o.msg)] : p.btns || []).slice(0, 2).map((x, j) => button(p, x, j === 0, filled)).join('');
  const shown = also.slice(0, 2), rest = also.length - shown.length;
  // A row that waits on someone else is quiet by design, so it keeps its small countdown and gets no block.
  return `<article class="td-card${c.wait ? ' td-wait' : ''}${p.seen ? ' td-seen' : ''}" data-k="${esc(k)}"${b ? ` data-bill="${esc(b.id)}" data-num="${esc(b.bill_number)}"` : ''} tabindex="-1" aria-labelledby="td-s${i}">
    ${urgBlock(c.wait ? null : p.due, untilOf(p))}
    <div class="td-top">${top}${more}${b ? lookBtn(b) : ''}</div>
    <p class="td-s" id="td-s${i}">${p.s}</p>
    ${(() => { const w = why(p, team, !c.wait), lead = c.wait && p.chip ? chip(p.chip, '', 'hourglass') + ' ' : p.seen ? SEEN() + ' ' : ''; return w || lead ? `<p class="td-why">${lead}${w}</p>` : ''; })()}
    ${p.note ? `<p class="td-note">${p.note}</p>` : ''}
    ${p.q ? `<blockquote class="td-q">${p.q}</blockquote>` : ''}
    ${acts ? `<div class="td-acts">${acts}</div>` : ''}
    ${shown.map(t => alsoRow(t, c)).join('')}${rest > 0 && b ? `<a class="td-also" href="${billRoute(b)}"><span class="td-also-t">${plural(rest, 'more thing')} on this bill</span>${icon('chevron-right', { cls: 'chev' })}</a>` : ''}
  </article>`;
}
// A bill whose only item is chat is one quiet row, "2 new messages · Reply", not a card with an urgency column and a
// filled Reply button: a message is not a step with a deadline, and that button pulled the eye away from the real work
// (A-13, review 9/21). Its "…" keeps Mark done and Mark unread, the two ways a message leaves Today unanswered.
function msgCard(c, i, k) {
  const p = c.p, b = c.b;
  return `<article class="td-card td-msg${p.seen ? ' td-seen' : ''}" data-k="${esc(k)}" data-bill="${esc(b.id)}" data-num="${esc(b.bill_number)}" tabindex="-1" aria-labelledby="td-s${i}">
    <a class="td-msgl" href="${billRoute(b, 'activity')}?reply=1" data-k="${esc(p.key)}" data-seen="1" data-primary="1">
      <span class="td-msgt"><span class="td-msgb"><b class="td-num">${esc(billNum(b))}</b>${b.priority === 1 ? ' ' + P1 : ''} ${b.nickname ? `<b class="td-nick">${esc(b.nickname)}</b>` : `<span class="td-t">${esc(blurb(b, 80))}</span>`}</span>
        <span class="td-s" id="td-s${i}">${p.s}</span></span>
      <span class="td-msgc">${p.seen ? SEEN() : ''}${icon('message-circle')}<span>${esc(p.why)} · Reply</span></span></a>
    ${iconBtn('ellipsis', `More for ${billNum(b)}`, { 'data-more': k }, 'td-more')}</article>`;
}

// ---- v3 on a laptop (R-264): one line per item, and the item you picked, in full, beside the list ----
// Nate, 12 Oct: "too dense of information on the page, there is too much going on at one time". A row says only what
// tells one item from the next: how urgent, which bill, what to do ("+2" when the bill has more) and its one button.
// The rest of the old card (the summary, the times and rooms, the Also rows, Mark filed and the like) is in the open
// item beside the list, so there is one thing to read at a time.
// The open item is a card's key, remembered for the visit (B-6): back from a bill, the same one is open. On arrival the
// first row, the most urgent, is open; when the open one is done, the row that took its place opens (S.tdSel.i).
let ROWS = [], ROWOPT = new Map();   // the rows' keys in the order drawn (for j/k and the arrows), and each row's o
const kindOf = p => p.kind === 'followup' ? ['user-round', 'Follow-up'] : p.a ? ['mail', 'Email to supporters'] : ['bell', 'From the tracker'];
// A row is drawn unselected; render() marks the one open (markSel), because which one that is depends on every row.
// The row's text is one button (choosing it opens the item); the step's own button sits beside it, never inside it.
function row(c, filled, o = {}) {
  const k = c.cluster ? 'cluster' : (o.gk ? o.gk + '~' : '') + c.key, ek = esc(k);
  CARDS.set(k, c); ROWS.push(k); ROWOPT.set(k, o);
  const end = `<span class="td-rmark" aria-hidden="true">${icon('chevron-right')}</span>`;
  const sel = inner => `<button type="button" class="td-rsel" data-sel="${ek}" aria-current="false">${inner}</button>`;
  if (c.cluster) {
    const bills = [...new Set(c.cluster.map(t => billNum(t.b).split(' ')[0]))];
    return `<div data-k="${ek}" class="td-row td-rclu"${filled ? ' data-fill="1"' : ''}>${sel(`${urgBlock(c.due, untilOf(c.cluster[0]))}<span class="td-rmain"><span class="td-rs"><b>Review ${plural(c.cluster.length, 'testimony draft')}</b></span><span class="td-rn">${esc(bills.slice(0, 3).join(', '))}${bills.length > 3 ? ' …' : ''}</span></span>`)}
      <span class="td-ract">${btn('Start review', { kind: filled ? 'primary' : 'secondary', href: '#/review', attrs: { 'data-primary': '1', 'data-review': '1' } })}</span>${end}</div>`;
  }
  const p = c.p, b = c.b, n = c.tasks.length - 1;
  const name = b ? `<span class="td-rb"><b class="td-num">${esc(billNum(b))}</b>${b.priority === 1 ? P1 : ''}<span class="td-rn">${esc(b.nickname || blurb(b, 80))}</span></span>`
    : (([ic, w]) => `<span class="td-rb td-rkind">${icon(ic)}<span>${w}</span></span>`)(kindOf(p));
  // A teammate's step is theirs to take: its row has no button, and the open item offers "Message Kevin".
  const x = p.ro ? null : (p.btns || [])[0], fill = filled && p.kind !== 'reply' && !p.seen && x && !x.text;
  const what = `<span class="td-rs">${p.seen ? SEEN() + ' ' : ''}${rowWords(p, x)}</span>${n > 0 ? `<span class="td-rplus">+${n}<span class="td-rmore"> more</span><span class="sr"> on this ${b ? 'bill' : 'item'}</span></span>` : ''}`;
  return `<div data-k="${ek}" class="td-row${p.seen ? ' td-seen' : ''}"${fill ? ' data-fill="1"' : ''}${b ? ` data-bill="${esc(b.id)}" data-num="${esc(b.bill_number)}"` : ''}>${sel(`${urgBlock(p.due, untilOf(p))}<span class="td-rmain">${name}${what}</span>`)}
    <span class="td-ract">${x ? button(p, x, true, filled && p.kind !== 'reply') : ''}</span>${end}</div>`;
}
// A row says what its button does not (A-14): beside "File at the Capitol" or "Make the draft now" the step's own words
// repeat the button and crowded out the hearing's date ("New hearing: PSM/EIG Mon 3/2…", fresh-eyes review, R-264), so
// such a row names the hearing instead ("PSM/EIG hearing Mon 3/23, 3:00 PM"). A one-word button (Review, Write it, Open)
// keeps the step's words, which say what it is about. The open item always shows the step in full.
const SIG = w => w.toLowerCase().replace(/[^a-z]/g, '');
const SKIP = new Set(['the', 'at', 'it', 'now', 'a', 'to', 'your', 'on']);
function rowWords(p, x) {
  const words = x && !x.text ? String(x.label || '').split(/\s+/).map(SIG).filter(w => w && !SKIP.has(w)) : [];
  const said = String(p.s || '').replace(/<[^>]+>/g, ' ').toLowerCase();
  if (p.h && words.length >= 2 && words.every(w => said.includes(w))) return `${esc(p.h.committee)} hearing ${whenLine(p.h.scheduled_at)}`;
  return p.s;
}
// Which row is open: the one you chose, else the one now in its place; until you choose, the first (the list can
// still be filling in as the page loads, and the most urgent item is the one to open on arrival).
function pickSel() {
  if (!ROWS.length) return null;
  if (!S.tdSel?.picked) return ROWS[0];
  const k = S.tdSel.key; if (k && ROWS.includes(k)) return k;
  return ROWS[S.tdSel ? Math.min(Math.max(0, S.tdSel.i || 0), ROWS.length - 1) : 0];
}
const markSel = (html, k) => { const ek = esc(k); return html.replace(`<div data-k="${ek}" class="td-row`, `<div data-k="${ek}" class="td-row on`).replace(`data-sel="${ek}" aria-current="false"`, `data-sel="${ek}" aria-current="true"`); };
// The open row's own button is an outline: the open item beside it has the same step as its one filled button, and two
// filled buttons for one step side by side was the same thing said twice (A-3, A-14; fresh-eyes review).
function quietOpen(root) {
  root.querySelectorAll('.td-row[data-fill]').forEach(r => { const b = r.querySelector('.td-ract .btn'); if (!b) return; const on = r.classList.contains('on'); b.classList.toggle('primary', !on); b.classList.toggle('secondary', on); });
}
// The open item scrolls on its own when it is taller than the window: its foot ("Open the bill") then carries a shadow,
// so it is plain that there is more under it (B-7).
function paneFit(pane) {
  if (!pane) return;
  const more = () => pane.classList.toggle('more', pane.scrollHeight - pane.scrollTop - pane.clientHeight > 2);
  more(); if (!pane.dataset.fit) { pane.dataset.fit = '1'; pane.addEventListener('scroll', more, { passive: true }); }
}

// The open item. The bill (its number, its name as the heading, the plain summary), when it is due, the step with all
// of its buttons, its Also items, its hearing (where, when, who is going, I'm going), and "Open the bill". Secondary
// actions stay in the "…" (A-20); the one filled button is the step's own (A-3).
function paneDue(t) {
  if (t.kind === 'chair' || t.kind === 'wait') return '';
  if (lateNow(t)) return `${countdown(dueIso(t), { until: untilOf(t) })}<span class="td-pdw">${esc(testDueText(t.due))}</span>`;
  if (tDue(t)) return dueChip(t.due, testDueText(t.due));
  if (t.due != null) return cd(t.due, 'due');
  return t.kind === 'todo' || t.kind === 'followup' ? '<span class="td-pdw">No due date</span>' : '';
}
// Whose it is and why it came up ("Open to anyone · Sent 3h ago"); the due time and the hearing have places of their own.
const paneWhy = (t, ids) => [t.ro && ids?.length ? `${esc(names(ids))}’s to take` : t.ro && whoOf() ? `${esc(first(whoOf()))}’s to take` : t.who === 'anyone' ? 'Open to anyone' : '', ...String(t.why || '').split(' · ')]
  .filter(Boolean).map(x => `<span class="td-part${x.replace(/<[^>]+>/g, '').length > 28 ? ' long' : ''}">${x}</span>`).join(' · ');
// The hearing the item is about: its own, else the bill's next one (as the "…" menu has always chosen).
const paneHearingOf = c => c.tasks.map(t => t.h).find(x => x && new Date(x.scheduled_at) > Date.now() - 4 * HR) || (c.b ? hearingAhead(c.b) : null);
function paneHearing(c) {
  const h = paneHearingOf(c); if (!h) return '';
  const going = goingOf(goersAt(h)), mine = goingFor(h).going, isNew = c.p.kind === 'nodraft' && c.p.h?.id === h.id;
  return `<div class="td-psec td-phear"><h3 class="td-ph3">${isNew ? 'New hearing' : 'Hearing'}</h3>
    <a class="td-phl" href="#/hearing/${esc(h.id)}?from=today">${icon('landmark')}<span><b>${esc(h.committee)} ${esc(whenLine(h.scheduled_at))}</b>${h.room ? ` · ${esc(room(h.room))}` : ''}</span>${icon('chevron-right', { cls: 'chev' })}</a>
    <p class="td-pgo">${icon('users')}<span>${esc(going || 'Nobody from the team yet')}</span>${btn(mine ? 'I’m not going after all' : 'I’m going', { kind: 'text', attrs: { 'data-going': h.id } })}</p></div>`;
}
function paneAlso(c) {
  const also = c.tasks.slice(1); if (!also.length) return '';
  return `<div class="td-psec"><h3 class="td-ph3">Also on this ${c.b ? 'bill' : 'item'}</h3><ul class="td-palso">${also.map(t => {
    const acts = t.ro || t.kind === 'wait' ? '' : (t.btns || []).slice(0, 2).map(x => button(t, x, false)).join('');
    // the same deadline as the item's own step is said once, above (A-14; fresh-eyes review: "late testimony until 1:10 PM" twice)
    const same = t.due != null && t.due === c.p.due;
    return `<li><span class="td-pat">${t.s}</span><span class="td-pam">${t.seen ? SEEN() : ''}${same ? '' : alsoDue(t)}</span>${acts ? `<span class="td-pab">${acts}</span>` : ''}</li>`; }).join('')}</ul></div>`;
}
function paneCluster(c) {
  return `<div class="td-ptop"><p class="td-pnum td-rkind">${icon('clipboard-check')}<span>Review</span></p></div>
    <h2 class="td-pname" id="td-pane-h">${esc(plural(c.cluster.length, 'testimony draft'))} waiting for you</h2>
    <div class="td-pstep">${c.due != null ? `<p class="td-pdue">${lateNow(c.cluster[0]) ? `${countdown(dueIso(c.cluster[0]), { until: untilOf(c.cluster[0]) })}<span class="td-pdw">First ${esc(lowerFirst(testDueText(c.due)))}</span>` : dueChip(c.due, `First ${lowerFirst(testDueText(c.due))}`)}</p>` : ''}
      <div class="td-pacts">${btn('Start review', { href: '#/review', attrs: { 'data-review': '1' } })}</div></div>
    <div class="td-psec"><h3 class="td-ph3">Earliest first</h3><ul class="td-palso">${c.cluster.map(t => `<li><a class="td-pat" href="#/review/${encodeURIComponent(t.d.id)}" data-review="1"><b class="td-num">${esc(billNum(t.b))}</b> ${esc(t.b.nickname || blurb(t.b, 60))}</a><span class="td-pam">${alsoDue(t)}</span></li>`).join('')}</ul></div>`;
}
function paneHTML(k) {
  const c = CARDS.get(k); if (!c) return '';
  if (c.cluster) return paneCluster(c);
  const p = c.p, b = c.b, o = ROWOPT.get(k) || {}, kd = b ? null : kindOf(p);
  const more = b || p.kind === 'followup' || p.a ? iconBtn('ellipsis', `More for ${b ? billNum(b) : 'this item'}`, { 'data-more': k, 'data-pane': '1' }, 'td-more') : '';
  const top = `<div class="td-ptop">${b ? `<p class="td-pnum"><b class="td-num">${esc(billNum(b))}</b>${b.priority === 1 ? P1 : ''}</p>` : `<p class="td-pnum td-rkind">${icon(kd[0])}<span>${kd[1]}</span></p>`}${more}</div>
    ${b ? `<h2 class="td-pname" id="td-pane-h">${esc(b.nickname || blurb(b, 120))}</h2>${b.nickname && blurb(b, 400) ? `<p class="td-psum">${esc(blurb(b, 400))}</p>` : ''}` : ''}`;
  const acts = (o.msg && b ? [msgBtn(b, o.msg)] : p.btns || []).map((x, j) => button(p, x, j === 0)).join('');
  const due = paneDue(p), w = paneWhy(p, o.msg);
  const step = `<div class="td-pstep">${due ? `<p class="td-pdue">${due}</p>` : ''}
    <p class="td-ps"${b ? '' : ' id="td-pane-h"'}>${p.ps || p.s}</p>${w ? `<p class="td-pwhy">${w}</p>` : ''}
    ${p.note ? `<p class="td-note">${p.note}</p>` : ''}${p.q ? `<blockquote class="td-q td-pq">${p.q}</blockquote>` : ''}
    ${acts ? `<div class="td-pacts">${acts}</div>` : ''}</div>`;
  const open = b ? [billRoute(b), 'Open the bill'] : p.kind === 'followup' ? [`#/person/${p.f.person_id}`, 'Open their page'] : p.a ? [`#/email/${p.a.id}`, 'Open the email'] : null;
  return `${top}${step}${paneAlso(c)}${paneHearing(c)}${open ? `<a class="td-popen" href="${esc(open[0])}"><span>${open[1]}</span>${icon('arrow-right')}</a>` : ''}`;
}
// Choosing a row redraws only the open item, so j and k are instant and the list keeps its scroll and focus.
// The choice is kept first, even when the click also left the page (a row's Review goes to review mode), so the same
// item is open on the way back.
function select(k, { focus = false } = {}) {
  if (!CARDS.has(k)) return;
  S.tdSel = { key: k, i: ROWS.indexOf(k), picked: true };
  const root = document.querySelector('.td-root'), pane = root?.querySelector('#td-pane'); if (!pane) return;
  let el = null;
  root.querySelectorAll('.td-row').forEach(r => { const on = r.dataset.k === k; r.classList.toggle('on', on); r.querySelector('.td-rsel')?.setAttribute('aria-current', String(on)); if (on) el = r; });
  pane.innerHTML = paneHTML(k); pane.scrollTop = 0; wireControls(pane); quietOpen(root); paneFit(pane);
  if (el) { if (focus) el.querySelector('.td-rsel')?.focus({ preventScroll: true }); el.scrollIntoView({ block: 'nearest' }); }
}

// "Hearings today: HHS 1:10 PM, Rm 225 · nobody from the team going yet" (R-264): the day's sittings still to come on the
// bills in view, one line above the list, each opening the hearing's own page. It replaced a panel with a box per bill.
function hearingsLine(scope, who) {
  const now = Date.now(), today = hst(now);
  const all = hearingsIn(today, today, scope, who).filter(x => (monOn() || !isMon(x.b)) && x.t >= now - 2 * HR);
  if (!all.length) return '';
  const sit = new Map(); for (const x of all) { const k = slotKey(x.h); if (!sit.has(k)) sit.set(k, []); sit.get(k).push(x); }
  const list = [...sit.values()], shown = list.slice(0, 2), more = list.length - shown.length;
  const one = l => { const h = l[0].h, going = goingOf(goersAt(h));
    return `<span class="td-hlone"><a href="#/hearing/${esc(h.id)}?from=today"><b>${esc(h.committee)} ${esc(timeOf(h.scheduled_at))}</b>${h.room ? `, ${esc(room(h.room))}` : ''}</a> · ${esc(going || 'nobody from the team going yet')}</span>`; };
  return `<p class="td-hline1">${icon('landmark')}<span class="td-hlt"><span>Hearings today:</span> ${shown.map(one).join('<span class="td-hlsep">; </span>')}${more ? ` <a href="#/?view=week">and ${more} more</a>` : ''}</span></p>`;
}
// "Next deadline Thu 3/19 · 3 bills with no hearing yet →": the session clock in one line, opening This week, where those
// bills are listed under their deadline. It names one deadline, the first that still has work: when every bill racing
// the nearest one has a hearing, the line is about the one after ("Mon 3/30 deadline · 16 bills…"), not both at once
// (fresh-eyes review). The count is said only because it is work (R-264 rule 4).
function deadlineLine(scope, who) {
  const c = sessionClock(clockBills(scope, who)); if (!c) return '';
  const t = c.then, g = c.noHearing.length || !t?.noHearing?.length ? c : t, n = g.noHearing.length;
  const head = g === c ? `Next deadline ${ckDay(c.date)}` : `${ckDay(t.date)} deadline`;
  const work = n ? `${plural(n, 'bill')} with no hearing yet` : g.racing ? 'every bill racing it has a hearing' : '';
  return `<a class="td-dline" href="#/?view=week">${icon('calendar-clock')}<span><b>${esc(head)}</b>${work ? ` · ${esc(work)}` : ''}</span>${icon('arrow-right', { cls: 'chev' })}</a>`;
}
function nextHearingText(scope, who) {
  const now = Date.now(), mine = billsOf(scope, who), ok = b => b && b.position && b.position !== 'monitor' && mine(b);
  const h = (S.hearings || []).filter(x => x.status !== 'cancelled' && new Date(x.scheduled_at) > now && ok(billById(x.bill_id))).sort((x, y) => x.scheduled_at.localeCompare(y.scheduled_at))[0];
  if (h) return `Next hearing: ${esc(whenLine(h.scheduled_at))} (${esc(billNum(billById(h.bill_id)))}, ${esc(h.committee)}).`;
  return SESSION_OVER ? 'Hearings return when the next session opens.' : scope === 'none' ? 'No hearings are scheduled on the bills nobody owns.' : `No hearings are scheduled on ${scope === 'team' ? 'the team’s' : scope === 'person' ? esc(first(who)) + '’s' : 'your'} bills yet.`;
}
// The small orange check: at most once a day, never under reduced motion.
function yay() {
  const day = hst(Date.now());
  if (S.tdYay === day) return `<span class="td-yay" aria-hidden="true">${icon('circle-check')}</span>`;
  if (S.tdYay === 'no') return '';
  let still = false; try { still = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { /* old browser */ }
  if (still || load('allclear', '') === day) { S.tdYay = 'no'; return ''; }
  S.tdYay = day; return `<span class="td-yay" aria-hidden="true">${icon('circle-check')}</span>`;
}

// ---- hearings: today's line and the week ----
// Every hearing between two Hawaiʻi days on the bills in view, earliest first. Bills heard together (same time,
// committee and room) stay next to each other; within one hearing the bills we have a position on come first.
function hearingsIn(d0, d1, scope, who) {
  const ok = billsOf(scope, who), t0 = new Date(d0 + 'T00:00:00-10:00').getTime(), t1 = new Date(d1 + 'T23:59:59.999-10:00').getTime(), out = [];
  for (const h of S.hearings || []) {
    if (h.status === 'cancelled') continue;
    const t = new Date(h.scheduled_at).getTime(); if (!(t >= t0 && t <= t1)) continue;
    const b = billById(h.bill_id); if (b && ok(b)) out.push({ h, b, t, day: hst(t) });
  }
  return out.sort((x, y) => x.t - y.t || String(x.h.committee).localeCompare(String(y.h.committee)) || (x.b.position === 'monitor') - (y.b.position === 'monitor') || x.b.bill_number.localeCompare(y.b.bill_number, 'en', { numeric: true }));
}
const draftOf = h => (S.drafts?.[h.bill_id] || []).find(d => d.hearing_id && d.hearing_id === h.id && d.status !== 'cancelled') || draftFor(h.bill_id, h.committee) || null;
// "Lauren is going", "You and Lauren are going": who is going to a hearing, you first; empty when nobody is. A sitting
// hears several bills and a person marks one of them, so the Week view passes everyone marked on any of its bills.
function goingOf(people) {
  const seen = new Set(), names = people.filter(a => a && !seen.has(a.id) && seen.add(a.id)).sort((x, y) => (y.id === S.me?.id) - (x.id === S.me?.id)).map(a => a.id === S.me?.id ? 'You' : a.full_name.split(' ')[0]);
  if (!names.length) return '';
  return `${names.length === 1 ? names[0] : names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1]} ${names.length === 1 && names[0] !== 'You' ? 'is' : 'are'} going`;
}
// A sitting is every hearing row with the same committee and start time (hearing.js sittingOf), and "going" is recorded
// on ONE of its rows, so ten bills in one sitting never send ten Slack messages: who is going is read across all of
// them, wherever Today or the Week says it (R-022).
const sittingRows = h => (S.hearings || []).filter(x => x.committee === h.committee && x.scheduled_at === h.scheduled_at);
const goersAt = h => sittingRows(h).flatMap(r => attendees(r));
// Going is to the sitting: you are marked on one of its rows, and "not going after all" takes you off every one.
const goingFor = h => { const mine = sittingRows(h).filter(r => (S.attend?.[r.id] || []).includes(S.me.id)); return { mine, going: mine.length > 0 }; };
async function toggleGoing(h) {
  const { mine, going } = goingFor(h);
  try {
    if (!going) await DB.attend(h.id, true); else for (const r of mine) await DB.attend(r.id, false);
    toast(!going ? `You’re going to the ${h.committee} hearing ${whenLine(h.scheduled_at)}.` : `Taken off the list for the ${h.committee} hearing.`, { ok: !going, undo: async () => { if (going) { for (const r of mine) await DB.attend(r.id, true); } else await DB.attend(h.id, false); redraw(); } });
    redraw();
  } catch (e) { toast(e, { err: true }); }
}
const P1 = '<span class="sv-p1">P1</span>';
// A titled white box (Getting ready for January, between sessions).
const panel = (id, ic, title, count, body, extra = '') => `<section class="td-panel td-p-${id}" aria-labelledby="td-p-${id}"><div class="td-ph"><h2 id="td-p-${id}">${icon(ic)}<span>${title}</span></h2>${extra}${count == null || count === '' ? '' : `<span class="n">${count}</span>`}</div>${body}</section>`;
const moreBtn = (key, open, n) => `<button type="button" class="td-pmore" data-fold="${key}" aria-expanded="${open}">${open ? 'Show fewer' : `Show all ${n}`}${icon(open ? 'chevron-up' : 'chevron-down')}</button>`;

// Hearings on Monitor bills fold away until asked for (decision 4): in the week of 16 March, 10 of the 15 bill hearings on
// Nate's list were on bills he only monitors, and they buried the five he works on. "+N on bills you monitor" brings
// them back, and the choice follows the person between laptop and phone (advocates.prefs.showMonitor, B-6).
const monOn = () => !!S.me?.prefs?.showMonitor;
const isMon = b => b?.position === 'monitor';
const monWho = (scope, who) => scope === 'team' ? 'the team monitors' : scope === 'person' ? `${first(who)} monitors` : 'you monitor';
const monTail = (scope, who) => scope === 'none' ? 'monitored bills nobody owns' : `bills ${monWho(scope, who)}`;
const monBtn = (n, scope, who, cls = 'td-pmore') => `<button type="button" class="${cls} td-monbtn" data-mon aria-pressed="${monOn()}">${icon(monOn() ? 'eye-off' : 'eye')}<span>${esc(monOn() ? `Hide the ${n} on ${monTail(scope, who)}` : `+${n} on ${monTail(scope, who)}`)}</span></button>`;

// ---- "Waiting on others": the quiet hourglass steps, summed up ----
// Mine or one person's list: the steps on their bills, their drafts and their emails that wait on somebody else, as a
// folded group at the end of the list at every width (R-022 on a phone; v3 on a laptop too, where it was a side panel:
// one side column, R-264). Team shows no such list: Team IS everyone's list, by person, so the same steps would be
// said twice (A-14).
function waitList(scope, who) {
  const mine = billsOf(scope, who), subj = scope === 'person' ? who : S.me.id;
  const ours = scope === 'none' ? t => !!t.b && mine(t.b) : t => (t.b && mine(t.b)) || t.d?.submitted_by === subj || t.a?.author_id === subj;
  return items('team').tasks.filter(t => t.kind === 'wait' && ours(t) && !(t.on || []).includes(subj))
    .sort((x, y) => (x.due ?? Infinity) - (y.due ?? Infinity) || x.rank - y.rank);
}
// A row names who it waits on and offers the two things you can do about someone else's step (A-20): ask them
// ("Message James" opens the bill's chat with @James typed in), or, for a to-do, give it to someone else. "Give to…"
// lists you first, as "take it over", so taking a to-do back is the same two taps (R-022, wave 3 #15).
let WAITS = new Map();
function waitRow(t) {
  WAITS.set(t.key, t);
  const said = String(t.ws || t.s || ''), at = id => { const i = said.indexOf(first(id)); return i < 0 ? 999 : i; };
  const on = [...new Set((t.on || []).filter(id => id && id !== S.me.id && advocate(id)))].sort((x, y) => at(x) - at(y));
  const href = t.b ? `${billRoute(t.b)}` : t.a ? `#/email/${t.a.id}` : '#/';
  const acts = [t.b && on.length ? `<a class="td-wact" href="${esc(mentionHref(t.b, on))}">${icon('message-square')}<span>Message ${esc(msgWho(on))}</span></a>` : '',
    t.t ? `<button type="button" class="td-wact" data-give="${esc(t.key)}" aria-haspopup="dialog">${icon('user-round-plus')}<span>Give to…</span></button>` : ''].join('');
  return `<div class="td-wrow"><a class="td-wmain" href="${esc(href)}"><span class="td-wt">${t.b ? `<b class="td-num">${esc(billNum(t.b))}</b> ` : ''}<span>${t.ws || t.s}</span></span>${t.due != null ? cd(t.due) : ''}</a>${acts ? `<div class="td-wacts">${acts}</div>` : ''}</div>`;
}
// Folded to one line until opened, under your own work, so it never pushes the list down.
function waitingGroup(scope, who) {
  const ws = waitList(scope, who); if (!ws.length) return '';
  const open = !!S.tdOpen?.waitg;
  return `<section class="td-group td-waitg" aria-labelledby="td-g-waitg"><h2 class="td-h">${groupHead(`${icon('hourglass', { cls: 'td-hic' })}Waiting on others`, ws.length, { fold: 'waitg', open, id: 'td-g-waitg' })}</h2>
    ${open ? `<div class="td-wlist">${ws.map(waitRow).join('')}</div>` : ''}</section>`;
}
// Give a to-do to someone, or take it over (DB.updateTodo). Someone else gets a Slack message from the database when a
// to-do is given to them (064), so the toast says so; Undo gives it back (B-5).
function giveTodo(t) {
  const b = t.b, td = t.t, prev = td.assignee_id || null;
  pickerSheet({ title: `Give “${esc(clip(td.title, 48))}” to`, value: prev || '',
    options: [[S.me.id, 'You', 'user-check', prev === S.me.id ? 'It is yours' : 'Take it over'],
      ...teammates().filter(a => a.id !== S.me.id).sort((x, y) => x.full_name.localeCompare(y.full_name)).map(a => [a.id, a.full_name, 'user-round', a.id === prev ? 'Has it now' : ''])],
    onPick: async id => {
      if (id === prev) return;
      try {
        await DB.updateTodo(b.id, td.id, { assignee_id: id });
        const back = async () => { await DB.updateTodo(b.id, td.id, { assignee_id: prev }); toast(prev ? `Back with ${first(prev)}.` : 'Put back.'); redraw(); };
        toast(id === S.me.id ? `It is yours now: ${clip(td.title, 60)}.` : `Given to ${first(id)}. ${first(id)} gets a Slack message.`, { ok: true, undo: back });
        redraw();
      } catch (e) { toast(e, { err: true }); }
    } });
}
// "Team load": open cards for each teammate, as their own Today would count them (a review cluster counts each draft).
const openCount = r => r.cards.reduce((s, c) => s + (c.wait ? 0 : c.cluster ? c.cluster.length : 1), 0);
function teamLoad() {
  return teammates().map(a => { const r = a.id === S.me.id ? items('mine') : items('person', a.id); return { a, n: openCount(r), late: r.late }; });
}
// One draw asks for the same lists many times (Team load, Team, Waiting on others, the week): each is worked out once.
let MEMO = new Map();
function items(scope, who = null) { const k = `${scope}:${who || ''}`; if (!MEMO.has(k)) MEMO.set(k, todayItems(scope, who)); return MEMO.get(k); }
// v3: Team load is a fold at the end of Team, and nowhere else (R-264): on Mine it was a panel of everyone's numbers
// beside your own work. A row picks that person's list in one click, as it did.
function loadGroup() {
  const rows = teamLoad().sort((x, y) => y.n - x.n || x.a.full_name.localeCompare(y.a.full_name)), who = whoOf(), scope = scopeOf(), open = !!S.tdOpen?.load;
  // The bills nobody owns get a row of their own at the foot, when they hold any open work (R-025 answer 1).
  const nr = items('none'), nn = openCount(nr), max = Math.max(1, nn, ...rows.map(x => x.n));
  const row = (id, av, label, n, late, on, title) => `<button type="button" class="td-load" data-who="${esc(id)}" aria-pressed="${on}" title="${esc(title)}">${av}<span class="td-ln"><span>${esc(label)}</span>${late ? `<span class="sv-count late">${icon('circle-alert')}${late} overdue</span>` : ''}</span><span class="td-lbar" aria-hidden="true"><i style="width:${Math.round(n / max * 100)}%"></i></span><span class="td-lc">${n}<span class="sr"> open</span></span></button>`;
  const body = `<div class="td-loads">${rows.map(({ a, n, late }) => { const me = a.id === S.me.id;
    return row(a.id, avatar(a, 24), me ? 'You' : a.full_name, n, late, me ? scope === 'mine' : who === a.id, me ? 'Show my list' : `Show ${a.full_name}’s list`); }).join('')}${nn ? row('none', avatar(null, 24), 'No owner', nn, nr.late, scope === 'none', 'Show the bills nobody owns') : ''}</div>`;
  return `<section class="td-group td-loadg" aria-labelledby="td-g-load"><h2 class="td-h">${groupHead(`${icon('users', { cls: 'td-hic' })}Team load`, open ? 'Open cards' : '', { fold: 'load', open, id: 'td-g-load' })}</h2>
    ${open ? `<div class="td-wlist">${body}</div>` : ''}</section>`;
}

// ---- the session clock (model.js sessionClock) ----
// The one portfolio number that earns a place on Today, as one line beside the list (deadlineLine) since v3; the bills
// racing it are listed under This week's grid. The five-bucket breakdown stays on Bills.
const clockBills = (scope, who) => S.bills.filter(billsOf(scope, who));
const whoseBills = (scope, who) => scope === 'person' ? `${first(who)}’s bills` : scope === 'team' ? 'the team’s bills' : scope === 'none' ? 'the bills nobody owns' : 'your bills';
const ckDay = d => new Date(d + 'T12:00:00-10:00').toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric', timeZone: 'Pacific/Honolulu' }).replace(',', '');   // "Thu 3/19"
const awayOf = days => days <= 0 ? 'today' : days === 1 ? 'tomorrow' : `${plural(days, 'day')} away`;

// ---- suggestions: good ways to spend an hour, never tasks (Nate, 9/19) ----
// Non-negotiables, all enforced here: at most SUGGEST_CAP, never in the badge or any due count, no urgency mark and
// none of the words due or overdue, the reason line printed as model.js wrote it, and three answers on every card.
let LASTSG = new Map();
// Done writes a line on the bill's timeline — but only once the Undo has lapsed. There is no call that takes an
// activity row back, and a step someone can undo must not leave one behind, so the write waits out the toast.
const LOGQ = new Map();
const logKey = (billId, log) => `${billId}|${log.type}|${log.title}`;
function queueLog(billId, log) {
  const k = logKey(billId, log); clearTimeout(LOGQ.get(k)?.t);
  LOGQ.set(k, { billId, log, t: setTimeout(() => { LOGQ.delete(k); DB.addActivity(billId, log.type, log.title).catch(() => {}); }, 10000) });
}
function cancelLog(billId, log) { if (!log) return; const k = logKey(billId, log), e = LOGQ.get(k); if (e) { clearTimeout(e.t); LOGQ.delete(k); } }
function flushLogs() { for (const [k, e] of [...LOGQ]) { clearTimeout(e.t); LOGQ.delete(k); DB.addActivity(e.billId, e.log.type, e.log.title).catch(() => {}); } }
// Leaving the page (a phone put away, a reload) settles both: what was seen, and any timeline line still waiting.
const settle = () => { seenFlush(); flushLogs(); };
addEventListener('pagehide', settle);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') settle(); });

// Since v3 the suggestions live on This week, not Today: Today is the list to clear (R-264). A chair ask races a
// deadline, so it is the row of its bill under that deadline, with the three answers in its "…"; every other suggestion
// follows the deadlines as "Also worth doing". Only on your own list: a teammate's answers are theirs to give, and Team
// is the team's dated work, where ideas for everyone's bills were noise (Nate, 9/21).
// A bill already on the list must never also be a suggestion: one with a card due today, and a P1 bill whose dated
// "Ask the chair" card is on the list, whenever it falls (the same step, twice; R-022). `gated`: the bills listed
// under a deadline, whose chair ask is their row's "…".
function suggestFor(scope, who, r, gated = new Set()) {
  if (scope !== 'mine' || SESSION_OVER) { LASTSG = new Map(); return { chair: new Map(), list: [] }; }
  const dated = new Set(r.cards.filter(c => c.b && (c.group === 'overdue' || c.group === 'today' || c.tasks.some(t => t.kind === 'chair'))).map(c => c.b.id));
  const all = suggestions(clockBills(scope, who), { cap: Infinity, skip: b => dated.has(b.id) });
  const isGated = s => s.kind === 'chair' && gated.has(s.b.id);
  const chair = new Map(all.filter(isGated).map(s => [s.b.id, s])), list = all.filter(s => !isGated(s)).slice(0, SUGGEST_CAP);
  LASTSG = new Map([...chair.values(), ...list].map(s => [s.key, s]));
  return { chair, list };
}
const POSITIONS = ['strongly_support', 'support', 'support_amend', 'strongly_oppose', 'oppose', 'neutral'];
// One button and a "…" (A-20, R-022): the three answers used to sit under every card as a row of their own, three
// more things to read on each of five cards. They are the "…" menu now, each with its Undo as before.
function sugCard(s, i) {
  const ext = !!s.act.ext, mail = /^mailto:/i.test(s.act.href || '');
  const more = iconBtn('ellipsis', `Done, not now or not this bill: ${billNum(s.b)}`, { 'data-sgmore': s.key, 'aria-haspopup': 'dialog' }, 'td-more');
  return `<article class="td-sg" data-sg="${esc(s.key)}" data-bill="${esc(s.b.id)}" aria-labelledby="td-sg${i}">
    <div class="td-top"><a class="td-bill${s.b.nickname ? ' td-named' : ''}" href="${billRoute(s.b)}"><b class="td-num">${esc(billNum(s.b))}</b> ${s.b.priority === 1 ? P1 + ' ' : ''}${billName(s.b)}</a>${more}${lookBtn(s.b)}</div>
    <p class="td-s" id="td-sg${i}">${esc(s.title)}</p>
    <p class="td-sgwhy">${esc(s.why)}</p>
    <div class="td-acts">${btn(esc(s.act.label), { kind: 'secondary', href: s.act.href, target: ext && !mail ? '_blank' : undefined, iconEnd: ext && !mail ? 'external-link' : undefined })}</div></article>`;
}
// "Also worth doing" under the deadlines. On a quiet day it is open; on a busy one a folded line, always one click away.
function suggestHtml(list, r) {
  if (!list.length) return '';
  const open = S.tdOpen ??= {}, quiet = r.dueNow <= 2, shown = quiet || !!open.sugg;
  const head = quiet ? groupHead('Also worth doing', '', { id: 'td-g-sugg' }) : groupHead('Also worth doing', list.length, { fold: 'sugg', open: shown, id: 'td-g-sugg' });
  return `<section class="td-group td-sugg" aria-labelledby="td-g-sugg"><h2 class="td-h">${head}</h2>
    ${shown ? `<div class="td-sglist">${list.map((s, i) => sugCard(s, i)).join('')}</div>` : ''}</section>`;
}
// The "…" on a suggestion: the three answers, each with its Undo (Nate, 9/19).
function sugMenu(key) {
  const s = LASTSG.get(key); if (!s) return;
  const num = billNum(s.b);
  menuSheet({ title: esc(clip(s.title, 60)), items: [
    { label: 'Done', icon: 'check', sub: s.log ? `Adds it to ${num}’s timeline` : 'It will not come up again', run: () => suggDo(key, 'done') },
    { label: 'Not now', icon: 'clock', sub: 'It comes back in two weeks', run: () => suggDo(key, 'later') },
    { label: 'Not this bill', icon: 'circle-x', sub: `Never suggest this for ${num} again`, run: () => suggDo(key, 'never') }] });
}
async function suggDo(key, state, el) {
  const s = LASTSG.get(key); if (!s) return;
  const before = { ...suggState() };
  S.tdRefocus = '[data-sgmore]';   // the answered one goes: the focus moves to the next one's "…"
  await busy(el, async () => {
    await setSugg(key, state);
    if (state === 'done' && s.log) queueLog(s.b.id, s.log);
    const msg = state === 'done' ? `Done: ${esc(clip(s.title, 60))}.${s.log ? ` Added to ${esc(billNum(s.b))}’s timeline.` : ''}`
      : state === 'later' ? 'Not now. It comes back in two weeks.'
      : `${esc(billNum(s.b))} will not be suggested for this again.`;
    toast(msg, { ok: state === 'done', undo: async () => { cancelLog(s.b.id, s.log); await DB.patchPrefs({ sugg: before }); redraw(); } });
    redraw();
  });
}

// ---- This week's grid (1100px and wider; the Week view until v3): what each day holds, in time order (R-025, 9/21) ----
// Nate: "many bills blend together; it is not clear what is a hearing and what is a testimony due date". Each testimony
// deadline used to show twice, on two days: as a step on the day it falls, and as "Testimony due in 28h" under the
// hearing, in the hearing's column, a day late. Now there are three kinds of thing, each with its own look and a title
// that says what it is (A-12, A-13, P-4), and each fact is said once, on its own day (A-14):
//   - "Testimony due": one card per sitting whose written testimony is due that day (24 hours before the hearing, the
//     Hawaiʻi rule, unless the notice says otherwise), with the bills still to get in and where each one stands;
//   - "Hearing": one grey block per sitting, on the day it is held: the bills heard, who is going, and the result;
//   - "Also to do": the day's other steps that have no time of their own (emails, follow-ups, to-dos, messages).
// Everything with a time runs in time order (Nate, 9/21); at the same minute a deadline comes first. Times are clock
// times: the column already says the day, and "28h left" made people work out which day it was. Initials only on
// Everyone: on Mine every bill is yours.
const slotKey = h => `${h.scheduled_at}|${h.committee}|${h.room || ''}`;
// A testimony step's state in a word and an icon, and how far behind it is (0 is furthest). Inside a "Testimony due"
// card "Approved" read as done, so an approved draft says what it still needs: "Ready to file" (review, 9/21). Each
// state has its own icon; "No draft yet" is not the dashed circle, which means "No owner". A step that waits on
// someone else (Everyone) keeps the hourglass, with its own word from t.chip.
const WK_STATE = { nodraft: ['No draft yet', 'file-text', 0], stale: ['Out of date', 'triangle-alert', 1], write: ['Draft', 'pencil', 2], submit: ['Draft', 'pencil', 2],
  revise: ['Sent back', 'undo-2', 3], review: ['To review', 'scan-eye', 4], review2: ['To approve', 'scan-eye', 4], file: ['Ready to file', 'clipboard-check', 6] };
const WK_WAIT = { Draft: ['Draft', 2], 'Sent back': ['Sent back', 3], 'In review': ['In review', 5], '2nd approval': ['2nd approval', 5], Approved: ['Ready to file', 6] };
const wkState = t => { if (t.kind !== 'wait') return WK_STATE[t.kind] || ['Open', 'circle-dot', 5]; const [w, n] = WK_WAIT[t.chip] || [t.chip || 'Waiting', 5]; return [w, 'hourglass', n]; };
const WK_ICON = { dnote: 'pencil', email: 'mail', fix: 'mail', send: 'send', followup: 'user-round', todo: 'list-todo', ask: 'megaphone', chair: 'mail', wait: 'hourglass', review: 'clipboard-check', review2: 'clipboard-check', nodraft: 'file-text', stale: 'triangle-alert', write: 'pencil', submit: 'pencil', revise: 'pencil', file: 'clipboard-check' };
// "today's", "tomorrow's", "Wed's": the hearing a deadline is for, said the way a person would.
const whoseDay = (day, now) => day === hst(now) ? 'today’s' : day === hst(now + DAY) ? 'tomorrow’s' : dayFmt(day, { weekday: 'short' }) + '’s';
// Only the public ask has a time of its own (its hearing's start); every other step without a testimony deadline is
// due on a day, or whenever, and goes under "Also to do".
const wkTimed = t => t.kind === 'ask' && !!t.b && t.due != null && t.due > Date.now();   // overdue: under "Also to do", marked overdue

// One week, day by day (Mon..Sun): the testimony deadlines (dl, one card per sitting), the sittings heard (hs) and the
// other steps. An open step sits on the day it is due; overdue and undated ones belong to today, as in the list, so
// nothing open is off the grid. The side panel's "This week" counts from this too.
// Hearings on Monitor bills are left out unless "+N on bills you monitor" is on (decision 4); wk.mon counts them either
// way, for that button. The side panel counts from here, so the two follow the same choice and still agree.
function weekOf(mon, scope, who, r) {
  const now = Date.now(), today = hst(now), ok = billsOf(scope, who), days = [0, 1, 2, 3, 4, 5, 6].map(i => dayAdd(mon, i)), showMon = monOn();
  const wk = new Map(days.map(d => [d, { dl: new Map(), hs: new Map(), other: [] }]));
  let monN = 0;
  for (const x of hearingsIn(mon, days[6], scope, who)) {
    if (isMon(x.b)) { monN++; if (!showMon) continue; }
    const hs = wk.get(x.day).hs, k = slotKey(x.h); if (!hs.has(k)) hs.set(k, []); hs.get(k).push(x);
  }
  wk.mon = monN;
  const card = (c, h) => { const k = slotKey(h); if (!c.dl.has(k)) c.dl.set(k, { h, due: testDue(h), rows: [], filed: 0 }); return c.dl.get(k); };
  for (const t of r.tasks) {
    const c = wk.get(t.due == null || t.due < now ? today : hst(t.due)); if (!c) continue;
    if (!(TESTIMONY.has(t.kind) && t.h && t.b)) { c.other.push(t); continue; }
    const g = card(c, t.h), st = wkState(t), ex = g.rows.find(x => x.b.id === t.b.id);
    if (!ex) g.rows.push({ b: t.b, st, t }); else if (st[2] < ex.st[2]) Object.assign(ex, { st, t });
  }
  // Every deadline in the week, not only those a step exists for yet. A "no draft" step is made only 7 days ahead, so
  // the Sunday deadline for a Monday hearing next week was nowhere on this week (R-025).
  for (const h of S.hearings || []) {
    if (h.status === 'cancelled') continue;
    const due = testDue(h), c = due > now ? wk.get(hst(due)) : null; if (!c) continue;
    const b = billById(h.bill_id); if (!b || b.position === 'monitor' || !ok(b) || diedish(b) || draftOf(h)) continue;
    const g = card(c, h); if (!g.rows.some(x => x.b.id === b.id)) g.rows.push({ b, st: WK_STATE.nodraft });
  }
  // How many more of each sitting's bills are already filed: a manager's "are we nearly there".
  const keys = new Set([...wk.values()].flatMap(c => [...c.dl.keys()])), filed = new Map();
  for (const h of S.hearings || []) { const k = slotKey(h), b = keys.has(k) && billById(h.bill_id); if (b && ok(b) && draftOf(h)?.status === 'filed') { if (!filed.has(k)) filed.set(k, new Set()); filed.get(k).add(b.id); } }
  for (const c of wk.values()) for (const [k, g] of c.dl) { const open = new Set(g.rows.map(x => x.b.id)); g.filed = [...(filed.get(k) || [])].filter(id => !open.has(id)).length; }
  return wk;
}

// One bill in a card or a block: the number (and P1) with the one fact that matters here, then its name on one line.
// The public's response under each bill ("6 follow · 2 emailed · 1 going · 1 shared") is the hearing page's, not the
// week's: four numbers under every bill that asked nothing of anyone (R-264).
function wkBill(b, right, owners) {
  const own = owners ? avatar(advocate((S.assignments[b.id] || [])[0]), 20) : '';
  return `<li><a class="wk-bill${b.position === 'monitor' ? ' wk-mon' : ''}" href="${billRoute(b)}"><span class="wk-b1"><b class="td-num">${esc(billNum(b))}</b>${b.priority === 1 ? P1 : ''}${right ? `<span class="wk-right">${right}</span>` : ''}</span><span class="wk-b2"><span class="wk-name">${esc(b.nickname || blurb(b, 80))}</span>${own}</span></a></li>`;
}
// "1:00 PM", or "Sun 3:00 PM" in the weekend column, which holds two days.
const wkWhen = (t, wkend) => (wkend ? dayFmt(hst(t), { weekday: 'short' }) + ' ' : '') + timeOf(new Date(t).toISOString());
function wkDeadline(g, owners, now, wkend) {
  // Past the written deadline but before the hearing begins, late testimony is still taken: amber, and it says until
  // when, not red "overdue" (A-5 as amended by R-250; v3, R-264).
  const ms = g.due - now, start = new Date(g.h.scheduled_at).getTime(), open = ms <= 0 && start > now, late = ms <= 0 && !open, soon = open || (!late && ms <= DAY), what = `for ${whoseDay(hst(start), now)} ${g.h.committee} hearing`;
  const head = open ? `Late testimony until ${timeOf(g.h.scheduled_at)}` : late ? 'Testimony\u00a0overdue' : `${wkWhen(g.due, wkend)} · Testimony\u00a0due`;
  const when = ms <= 0 ? `was due ${dayFmt(hst(g.due), { weekday: 'short' })} ${timeOf(new Date(g.due).toISOString())}` : hst(g.due) === hst(now) ? `in ${span(ms)}` : '';
  const rows = g.rows.sort((x, y) => x.st[2] - y.st[2] || x.b.bill_number.localeCompare(y.b.bill_number, 'en', { numeric: true }))
    .map(x => wkBill(x.b, `<span class="sr">Testimony: </span>${chip(x.st[0], '', x.st[1])}`, owners)).join('');
  return `<section class="wk-blk wk-dl${late ? ' late' : soon ? ' soon' : ''}" data-at="${g.due}" aria-label="${esc(`${head}${when ? ', ' + when : ''}, ${what}`)}">
    <p class="wk-bh">${icon(late ? 'circle-alert' : 'clock')}<b>${esc(head)}</b></p>
    <p class="wk-bs">${when ? `<span class="wk-when">${esc(when)}</span> · ` : ''}${esc(what)}</p>
    <ul class="wk-bills">${rows}</ul>${g.filed ? `<p class="wk-filed">${icon('check')}${esc(`${g.filed} more already filed`)}</p>` : ''}</section>`;
}
function wkHearing(list, owners, now, wkend) {
  const h = list[0].h, past = list[0].t < now - 2 * HR, when = wkWhen(list[0].t, wkend), monOnly = list.every(x => isMon(x.b));
  const rows = list.map(x => { const o = S.outcomes?.[x.h.id]?.outcome; return wkBill(x.b, past && o ? chip(OUTCOME_LABEL[o] || o) : '', owners); }).join('');
  // Every sitting opens its own page (R-022): the agenda, the members, and who from the team is going.
  const page = `<a class="wk-hpage" href="#/hearing/${esc(h.id)}?from=week">${icon('landmark')}<span>Open the hearing</span></a>`;
  // A hearing that is over needs nothing from anyone, so it keeps its place in the day as one quiet line that opens to
  // its bills and what happened to them. Drawn in full, the morning's hearings pushed the afternoon's overdue testimony
  // below the fold, and their pale boxes looked like deadline cards (review, 9/21). A sitting that hears only bills we
  // monitor, shown on request, folds the same way: it is there to be found, not to be worked (decision 4). The
  // committee and count sit on a line of their own, so the title never wraps around a dangling "·".
  if (past || monOnly) return `<details class="wk-blk wk-hr ${past ? 'wk-held' : 'wk-fold'}${monOnly ? ' wk-monh' : ''}" data-at="${list[0].t}"><summary>${icon('landmark')}<span class="wk-heldt"><b>${esc(when)} · Hearing${past ? '\u00a0held' : ''}</b><span class="wk-heldsub">${esc(`${h.committee} · ${plural(list.length, monOnly ? 'monitored bill' : 'bill')}`)}</span></span>${icon('chevron-down', { cls: 'chev' })}</summary><ul class="wk-bills">${rows}</ul>${page}</details>`;
  // Who is going, only when someone is (Nate, 9/21).
  const going = goingOf(goersAt(h));
  return `<section class="wk-blk wk-hr" data-at="${list[0].t}" aria-label="${esc(`Hearing, ${when}, ${h.committee}, ${room(h.room)}${going ? '. ' + going : ''}`)}">
    <p class="wk-bh">${icon('landmark')}<a class="wk-hl" href="#/hearing/${esc(h.id)}?from=week"><b>${esc(when)} · Hearing</b></a></p>
    <p class="wk-bs">${esc(h.committee)} · ${esc(room(h.room))}</p>${going ? `<p class="wk-bs wk-going">${icon('users')}<span>${esc(going)}</span></p>` : ''}
    <ul class="wk-bills">${rows}</ul></section>`;
}
// A step with a time of its own (the public ask, due when its hearing starts) takes its place in the day's order.
// Its own words there (t.wk) leave the time out: the line already starts with it.
const wkStep = (t, wkend) => `<a class="wk-oth wk-timed" data-at="${t.due}" href="${billRoute(t.b)}">${icon(WK_ICON[t.kind] || 'list-todo')}<span class="wk-ot"><b>${esc(wkWhen(t.due, wkend))}</b> · <b class="td-num">${esc(billNum(t.b))}</b> ${t.wk || t.s}</span></a>`;
// Everything else that day, one row per bill (the first step leads, the rest are counted). Messages are not calendar
// items: they fold into one row that opens the list, where they are answered (Nate, 9/21).
function wkAlso(all, now, wkend) {
  const msg = t => t.kind === 'reply' || t.kind === 'notice', msgs = all.filter(msg), per = new Map();
  for (const t of all) { if (msg(t)) continue; const k = t.b ? 'b' + t.b.id : t.key; if (!per.has(k)) per.set(k, []); per.get(k).push(t); }
  const rows = [...per.values()].map(g => {
    const t = g[0], more = g.length - 1, href = t.b ? `${billRoute(t.b)}` : t.kind === 'followup' ? `#/person/${t.f.person_id}` : t.a ? `#/email/${t.a.id}` : '';
    const late = t.due != null && t.due < now, day = wkend && t.due != null ? `<b>${esc(dayFmt(hst(t.due), { weekday: 'short' }))}</b> · ` : '';
    const inner = `${icon(WK_ICON[t.kind] || 'list-todo')}<span class="wk-ot">${day}${t.b ? `<b class="td-num">${esc(billNum(t.b))}</b> ` : ''}${t.s}${late ? (lateNow(t) ? ` <span class="sv-count soon">late testimony until ${esc(timeOf(untilOf(t)))}</span>` : ` <span class="sv-count late">overdue</span>`) : ''}${more ? ` <span class="wk-more">+${more} more</span>` : ''}</span>`;
    return `<li>${href ? `<a class="wk-oth${t.kind === 'wait' ? ' wk-q' : ''}" href="${esc(href)}">${inner}</a>` : `<div class="wk-oth">${inner}</div>`}</li>`;
  }).join('') + (msgs.length ? `<li><a class="wk-oth" href="#/">${icon('message-circle')}<span class="wk-ot">${esc(plural(msgs.length, 'message'))} to answer, in the list</span></a></li>` : '');
  return `<section class="wk-blk wk-also" aria-label="Also to do"><p class="wk-bh">${icon('list-todo')}<b>Also to do</b></p><ul class="wk-others">${rows}</ul></section>`;
}
function weekView(route, scope, who, r) {
  const now = Date.now(), today = hst(now), off = weekOff(route), mon = dayAdd(mondayOf(now), off * 7), wk = weekOf(mon, scope, who, r), days = [...wk.keys()];
  const owners = scope === 'team', all = [...wk.values()];
  const byDue = (x, y) => (x.kind === 'wait') - (y.kind === 'wait') || (x.due ?? Infinity) - (y.due ?? Infinity) || x.rank - y.rank;
  // A day's things with a time, in time order (at the same minute: the deadline, then the step, then the hearing),
  // then the steps with no time of their own. The weekend passes its two days together.
  const body = (cs, wkend) => {
    const other = cs.flatMap(c => c.other), rest = other.filter(t => !wkTimed(t)).sort(byDue);
    return [...cs.flatMap(c => [...c.dl.values()]).map(g => [g.due, 0, () => wkDeadline(g, owners, now, wkend)]),
      ...other.filter(wkTimed).map(t => [t.due, 1, () => wkStep(t, wkend)]),
      ...cs.flatMap(c => [...c.hs.values()]).map(l => [l[0].t, 2, () => wkHearing(l, owners, now, wkend)])]
      .sort((x, y) => x[0] - y[0] || x[1] - y[1]).map(x => x[2]()).join('') + (rest.length ? wkAlso(rest, now, wkend) : '');
  };
  const dayHtml = d => {
    const isToday = d === today, past = d < today, html = body([wk.get(d)], false);
    return `<section class="td-day wk-day${isToday ? ' today' : past ? ' past' : ''}" data-day="${d}" aria-labelledby="td-d-${d}"${isToday ? ' aria-current="date"' : ''}>
      <div class="td-dh"><h3 id="td-d-${d}">${esc(dayFmt(d, { weekday: 'short' }))} <span class="td-dom">${esc(dayFmt(d, { day: 'numeric' }))}</span></h3>${isToday ? '<span class="td-now">Today</span>' : ''}</div>
      <div class="wk-col">${html || `<p class="td-dnone">${past ? 'Nothing was scheduled.' : 'Nothing scheduled.'}</p>`}</div></section>`;
  };
  // Saturday and Sunday share one place, added only in a week that has something then, and never called Friday (bug 4,
  // 9/19). Each entry in it says its day.
  const we = [wk.get(days[5]), wk.get(days[6])], weN = we.reduce((n, c) => n + c.dl.size + c.hs.size + c.other.length, 0);
  const dayName = d => `${dayFmt(d, { weekday: 'short' })} ${dayFmt(d, { day: 'numeric' })}`;
  const weekend = () => `<section class="td-day wk-day td-wkend${days[6] < today ? ' past' : ''}" aria-labelledby="td-d-wkend">
      <div class="td-dh"><h3 id="td-d-wkend">Weekend</h3><p class="td-dsum">${esc(`${dayName(days[5])} – ${dayName(days[6])}`)}</p></div>
      <div class="wk-col">${body(we, true)}</div></section>`;
  const range = `${dayFmt(mon, { month: 'short', day: 'numeric' })} to ${dayFmt(days[4], dayFmt(mon, { month: 'short' }) === dayFmt(days[4], { month: 'short' }) ? { day: 'numeric' } : { month: 'short', day: 'numeric' })}`;
  // The owner chips that used to sit here are gone (Nate, R-025 answer 2: "remove the chips and keep the dropdown"):
  // the toolbar's one person picker, Team > Everyone, a teammate or No owner, narrows the week the same way.
  // The page's h1 names the week ("This week", "Team: next week"; Nate, R-025 answer 3), so the grid's own heading is
  // its dates: the name said once (A-14). The line that counted the week's hearings and bills went: the grid shows
  // each one, and a count of them asked nothing of anyone (R-264). This week's asks moved to Outreach > Emails.
  return `<div class="td-wnav"><h2 class="td-wtitle">${esc(range)}</h2>
      <div class="td-wbtns">${iconBtn('chevron-left', 'Previous week', { 'data-week': off - 1 })}${off ? btn('This week', { kind: 'text', attrs: { 'data-week': 0 } }) : ''}${iconBtn('chevron-right', 'Next week', { 'data-week': off + 1 })}</div>
      ${wk.mon ? monBtn(wk.mon, scope, who, 'td-wmon') : ''}</div>
    <div class="td-weekgrid${weN ? ' hasweekend' : ''}">${days.slice(0, 5).map(dayHtml).join('')}${weN ? weekend() : ''}</div>`;
}

// ---- "This week's asks" (R-132, the assessment's W5): the week's testimony deadlines on HIPHI's position bills, as text
// staff paste into the newsletter or a post. The same words as the hearing page's share kit (public_action, the deadline,
// the bill's share page), the link marked ?via=newsletter or ?via=social so arrivals from each are counted apart (R-113).
// Only bills with a position that are on the public page: the email rules (R-101) never ask the other side, and a
// monitored bill has no ask. Soonest deadline first; one line per bill for a post, a short paragraph for the newsletter.
const ASK_SAYS = { strongly_support: 'HIPHI strongly supports', support: 'HIPHI supports', support_amend: 'HIPHI supports with changes',
  strongly_oppose: 'HIPHI strongly opposes', oppose: 'HIPHI opposes', neutral: 'HIPHI is commenting' };   // the public page's words (pub/core.js POS_SAYS)
// X10-3 (R-180 wave 3): every bill on the public page with a position and a testimony deadline still open this week, whether or not
// HIPHI has filed its own testimony (the public's deadline does not move when HIPHI files, so the week's best ask was the one dropped),
// and the same whoever copies it, from Mine or Team (it no longer reads the week grid of one person's open rows).
function weekAsks() {
  const now = Date.now(), end = new Date(dayAdd(mondayOf(now), 7) + 'T00:00:00-10:00').getTime(), seen = new Map();
  for (const h of S.hearings) {
    if (h.status === 'cancelled') continue;
    const due = testDue(h), b = S.bills.find(x => x.id === h.bill_id);
    if (!b || isMon(b) || !b.position || !b.is_public || b.tracked === false || !(due > now) || due >= end) continue;
    if (!seen.has(b.id) || due < seen.get(b.id).due) seen.set(b.id, { b, h, due });
  }
  return [...seen.values()].sort((x, y) => x.due - y.due);
}
const askName = b => b.nickname ? `${b.nickname} (${billNum(b)})` : billNum(b);
const askLine = b => liveAsk(b).replace(/([^.!?])$/, '$1.') || `Please speak up on ${askName(b)}.`;   // an ask past its date is left out (Z1-3)
export function weekAsksText(items, kind) {
  const via = kind === 'social' ? 'social' : 'newsletter';
  if (kind === 'social') return items.map(x => { const link = `${sharePageUrl(x.b, 'testify')}?via=${via}`, due = `Testimony due ${fmtDT(x.due)}.`;
    let ask = askLine(x.b); const room = 280 - (askName(x.b).length + due.length + link.length + 6); if (ask.length > room) ask = ask.slice(0, Math.max(room - 1, 20)).replace(/\s+\S*$/, '') + '…';
    return `${askName(x.b)}: ${ask} ${due} ${link}`; }).join('\n\n');
  const head = `This week at the Legislature: ${items.length === 1 ? 'one bill on HIPHI’s issues needs' : `${items.length} bills on HIPHI’s issues need`} your voice. Each takes a few minutes.`;
  return head + '\n\n' + items.map(x => `${askName(x.b)} · ${ASK_SAYS[x.b.position] || 'HIPHI’s position'}\n${askLine(x.b)} Testimony is due ${fmtDT(x.due)}.\n${sharePageUrl(x.b, 'testify')}?via=${via}`).join('\n\n');
}
// Since v3 the card is on Outreach > Emails (R-264), not Today or This week: emails.js draws weekAsksHTML() and calls
// wireWeekAsks(root) on its own page. Folded to one line (R-152 C): open, it pushed the Week's first day from 348px to 616px down.
export function weekAsksHTML() {
  const items = weekAsks(); S.tdAsks = items;
  if (!items.length) return '';
  return `<details class="td-asks"><summary><h2 id="td-asks-h">This week’s asks, to paste into the newsletter or a post</h2><span class="td-asksn">${plural(items.length, 'bill')}</span>${icon('chevron-down', { cls: 'td-askchev' })}</summary><div class="td-askhd">
      <p class="small muted">Each bill’s ask, its deadline and its share page. Arrivals from the newsletter and from posts are counted apart.</p></div>
    <ol class="td-asklist">${items.map(x => `<li><b>${esc(billNum(x.b))}</b> <span>${esc(x.b.nickname || blurb(x.b, 80))}</span> <span class="muted">· ${esc(ASK_SAYS[x.b.position] || '')} · due ${esc(fmtDT(x.due))}</span></li>`).join('')}</ol>
    <div class="btnrow">${btn('Copy for the newsletter', { kind: 'secondary', sm: true, icon: 'copy', attrs: { 'data-wkasks': 'newsletter' } })}${btn('Copy for a post', { kind: 'secondary', sm: true, icon: 'copy', attrs: { 'data-wkasks': 'social' } })}</div>
  </details>`;
}
// Its two copy buttons, for whichever page draws the card.
export function wireWeekAsks(root) {
  root.querySelectorAll('[data-wkasks]').forEach(el => el.onclick = async () => {   // this week's asks (R-132)
    const text = weekAsksText(S.tdAsks || weekAsks(), el.dataset.wkasks);
    try { await navigator.clipboard.writeText(text); toast(el.dataset.wkasks === 'social' ? 'Copied: one short ask per bill, each under a post’s length. Paste, and change anything you like.' : 'Copied the week’s asks for the newsletter. Paste, and change anything you like.'); }
    catch { toast('Could not copy. Select the text in the list and copy it yourself.'); }
  });
}

// ---- Team: the team's work, by person (R-022, wave 3 #15) ----
// "Everyone" used to be your own cards plus unowned ones: on 16 March, 14 of Nate's 17 cards there were his own and
// none was a teammate's. Team is now everyone else's dated work, one group per person, the most pressing first, each
// card as that person's own Today draws it (read-only, with "Message Kevin"); your own cards are on Mine. A step two
// people can take (a second approval Jess or Jaylen may give) is one card under "Jess or Jaylen", not the same card
// twice (A-14). Bills with no owner are a group of their own, because otherwise nobody sees them (HB2300 was heard on
// 18 March with no owner). This week's dated work is drawn; the rest is counted, one click from that person's list.
function teamGroups() {
  const byLead = new Map(), me = S.me.id;
  for (const a of teammates()) {
    if (a.id === me) continue;
    for (const c of items('person', a.id).cards) {
      if (c.wait || c.cluster) continue;
      const e = byLead.get(c.p.key);
      if (e) e.ids.push(a.id); else byLead.set(c.p.key, { c, ids: [a.id] });
    }
  }
  const groups = new Map();
  for (const { c, ids } of byLead.values()) { const gk = ids.slice().sort().join('+'); if (!groups.has(gk)) groups.set(gk, { gk, ids, cards: [] }); groups.get(gk).cards.push(c); }
  const none = items('team').cards.filter(c => c.b && !c.wait && !c.cluster && !(S.assignments[c.b.id] || []).length && !isMine(c.b) && !byLead.has(c.p.key));
  if (none.length) groups.set('none', { gk: 'none', ids: [], cards: none, none: true });
  const eff = c => c?.due ?? Infinity;
  return [...groups.values()].map(g => {
    g.cards.sort((x, y) => eff(x) - eff(y) || x.p.rank - y.p.rank);
    g.week = g.cards.filter(c => c.due != null && c.group !== 'later'); g.late = g.cards.filter(c => c.group === 'overdue').length; return g;
  }).sort((x, y) => !x.week.length - !y.week.length || eff(x.week[0] || x.cards[0]) - eff(y.week[0] || y.cards[0]) || names(x.ids).localeCompare(names(y.ids)));
}
// `rows`: a laptop draws each person's work as one-line rows (R-264). How many each person has open is Team load's to
// say, in its fold at the end, not every group's heading as well (A-14).
function teamHtml(start, rows = false) {
  const gs = teamGroups(); let i = start;
  if (!gs.length) return `<div class="td-empty">${empty({ title: 'Nothing open on anyone’s list.', text: nextHearingText('team') })}</div>`;
  return gs.map((g, gi) => {
    const one = g.ids.length === 1 ? g.ids[0] : null, shown = g.week.slice(0, 5), rest = g.cards.length - shown.length;
    const who = g.none ? 'No owner yet' : g.ids.map(id => advocate(id).full_name).join(' or ');
    const av = g.none ? avatar(null, 28) : g.ids.map(id => avatar(advocate(id), 28)).join('');
    // The first group's heading takes the focus when this list is chosen (A-16).
    const top = gi === 0 ? ' data-top tabindex="-1"' : '';
    const pick = one || (g.none ? 'none' : null);
    const name = pick ? `<button type="button" class="td-pgname" data-who="${esc(pick)}" title="${esc(g.none ? 'Show only the bills nobody owns' : `Show ${who}’s list`)}">${av}<span>${esc(who)}</span></button>` : `<span class="td-pgname">${av}<span>${esc(who)}</span></span>`;
    const o = c => ({ gk: g.gk, msg: g.none ? null : g.ids, filled: c.group === 'overdue' || c.group === 'today' });
    const list = rows ? `<div class="td-rows">${shown.map(c => row(c, o(c).filled, o(c))).join('')}</div>` : `<div class="td-list">${shown.map(c => card(c, i++, false, o(c))).join('')}</div>`;
    const more = !rest ? '' : pick ? `<button type="button" class="td-pgmore" data-who="${esc(pick)}"><span>${esc(`${shown.length ? `${rest} more` : plural(rest, 'card')}, due later or with no date, ${g.none ? 'on the No owner list' : `on ${first(one)}’s list`}`)}</span>${icon('chevron-right', { cls: 'chev' })}</button>`
      : `<p class="td-pgmore">${esc(`${shown.length ? `${rest} more` : plural(rest, 'card')}, due later or with no date`)}</p>`;
    return `<section class="td-group td-pg" aria-labelledby="td-pg-${gi}"><div class="td-pgh"><h2 class="td-h td-pgt" id="td-pg-${gi}"${top}>${name}</h2></div>
      ${shown.length ? list : ''}${more}</section>`;
  }).join('');
}

// ---- Coalitions I support (R-022, wave 3 #18, decision 7) ----
// Support staff help across a coalition rather than own bills: Kris supports all of them, Saya CTFH
// (advocates.prefs.coalitions: 'all' or campaign ids). Their Mine gets that coalition's week: its hearings and who
// from the team is going, its bills racing the next deadline with no hearing, and to-dos nobody has taken. It is a view
// of other people's work, not work handed to them, so it never counts in the Today badge; and it is never hidden
// behind "All clear for today", which is what Kris saw in the busiest week of the session.
function coalPicked() {
  const c = S.me?.prefs?.coalitions;
  if (c === 'all') return { all: true, ids: new Set(S.campaigns.map(x => x.id)), names: [] };
  const ids = Array.isArray(c) ? c.filter(id => S.campaigns.some(x => x.id === id)) : [];
  return ids.length ? { all: false, ids: new Set(ids), names: ids.map(id => S.campaigns.find(x => x.id === id).name) } : null;
}
const dayWord = day => day === hst(Date.now()) ? 'Today' : day === dayAdd(hst(Date.now()), 1) ? 'Tomorrow' : dayFmt(day, { weekday: 'short' });
function coalSection(r) {
  const co = coalPicked(); if (!co) return '';
  const inC = b => (S.billCampaigns[b.id] || []).some(id => co.ids.has(id)), now = Date.now();
  // This week's sittings still to come, on the coalition's bills with a position (Monitor bills are watched, not worked).
  const hs = hearingsIn(hst(now), dayAdd(mondayOf(now), 6), 'team', null).filter(x => inC(x.b) && !isMon(x.b) && x.t >= now - 2 * HR);
  const sit = new Map(); for (const x of hs) { const k = slotKey(x.h); if (!sit.has(k)) sit.set(k, []); sit.get(k).push(x); }
  // The first deadline its bills race; when every bill racing that one already has a hearing, the deadline after, so
  // HEAL's Today names the same bills its coalition page lists under "Needs a hearing by Mon 3/30".
  const ck0 = sessionClock(S.bills.filter(inC)), ck = ck0 && !ck0.noHearing.length && ck0.then?.noHearing?.length ? ck0.then : ck0,
    racing = ck ? ck.noHearing : [];
  const todos = Object.entries(S.todos || {}).flatMap(([bid, arr]) => { const b = billById(bid); return b && inC(b) ? arr.filter(t => !t.done && !t.assignee_id).map(t => ({ b, t })) : []; })
    .sort((x, y) => String(x.t.due_date || '9').localeCompare(String(y.t.due_date || '9')));
  if (!sit.size && !racing.length && !todos.length) return '';
  const open = S.tdOpen ??= {}; open.coal ??= r.dueNow <= 2;   // open when your own day is light, as the suggestions are
  const title = co.all ? 'The team’s week' : `${co.names.join(' and ')} this week`;
  const count = [sit.size ? plural(sit.size, 'hearing') : '', racing.length ? `${plural(racing.length, 'bill')} still ${racing.length === 1 ? 'needs' : 'need'} a hearing` : '', todos.length ? plural(todos.length, 'open to-do') : ''].filter(Boolean).join(' · ');
  const owner = b => { const a = advocate((S.assignments[b.id] || [])[0]); return `${avatar(a, 20)}<span class="td-cown">${esc(a ? (a.id === S.me.id ? 'You' : first(a.id)) : 'No owner')}</span>`; };
  const sitRow = list => { const h = list[0].h, going = goingOf(goersAt(h));
    return `<a class="td-crow" href="#/hearing/${esc(h.id)}?from=today"><span class="td-ctime">${esc(dayWord(list[0].day))}<b>${esc(timeOf(h.scheduled_at))}</b></span>
      <span class="td-cbody"><span class="td-cbills">${list.map(x => `<b class="td-num">${esc(billNum(x.b))}</b> ${esc(x.b.nickname || blurb(x.b, 60))}`).join('<span class="td-csep">, </span>')}</span>
      <span class="td-cmeta">${esc(h.committee)} · ${esc(room(h.room))} · ${going ? esc(going) : `<span class="td-cnone">${icon('user-round-plus')}Nobody from the team yet</span>`}</span></span></a>`; };
  const raceRow = b => `<a class="td-crow td-crace" href="${billRoute(b)}"><span class="td-cbody"><span class="td-cbills"><b class="td-num">${esc(billNum(b))}</b>${b.priority === 1 ? P1 : ''} ${esc(b.nickname || blurb(b, 60))}</span></span><span class="td-cwho">${owner(b)}</span></a>`;
  const todoRow = ({ b, t }) => `<div class="td-crow td-ctodo"><a class="td-cbody" href="${billRoute(b)}"><span class="td-cbills"><b class="td-num">${esc(billNum(b))}</b> ${esc(t.title)}</span>${t.due_date ? `<span class="td-cmeta">${esc(`Due ${fmtDate(String(t.due_date).slice(0, 10), { weekday: 'short' }).replace(',', '')}`)}</span>` : ''}</a>${btn('Take it', { kind: 'secondary', attrs: { 'data-ctake': `${b.id}|${t.id}` } })}</div>`;
  const body = [sit.size ? `<h3 class="td-ch">${icon('landmark')}Hearings</h3><div class="td-crows">${[...sit.values()].map(sitRow).join('')}</div>` : '',
    racing.length ? `<h3 class="td-ch">${icon('circle-dashed')}${esc(`No hearing yet · ${ck.name} ${ckDay(ck.date)}`)}</h3><div class="td-crows">${racing.map(raceRow).join('')}</div>` : '',
    todos.length ? `<h3 class="td-ch">${icon('list-todo')}To-dos nobody has taken</h3><div class="td-crows">${todos.map(todoRow).join('')}</div>` : ''].join('');
  return `<section class="td-group td-coal" aria-labelledby="td-g-coal"><h2 class="td-h">${groupHead(`<span class="td-ght">${esc(title)}</span><span class="td-ghs">${esc(count)}</span>`, '', { fold: 'coal', open: open.coal, id: 'td-g-coal' })}</h2>
    ${open.coal ? `<div class="td-cbox">${body}</div>` : ''}</section>`;
}

// ---- Between sessions (R-022, wave 3 #22) ----
// After sine die there is nothing left to race, so Today says how the session ended for these bills, keeps any open
// to-dos, follow-ups and messages, and points at January. An empty list is not a failure then, and is never drawn as one.
const actOf = b => (/\bAct\s+(\d{1,3})\b/.exec(b.last_action || '') || [])[1] || '';
const thirdWed = y => { const dow = new Date(Date.UTC(y, 0, 1)).getUTCDay(); return `${y}-01-${String(1 + ((3 - dow + 7) % 7) + 14).padStart(2, '0')}`; };
function resultsHtml(scope, who) {
  const all = S.bills.filter(b => POSITIONS.includes(b.position)), own = all.filter(billsOf(scope, who));
  // Your own bills when you have any; otherwise the team's, so someone who owns none still sees how it went.
  const pool = scope !== 'team' && own.length ? own : all, whose = pool === all ? 'the team’s bills' : whoseBills(scope, who);
  if (!pool.length) return '';
  const law = pool.filter(b => effStage(b) === 'enacted' || actOf(b)), rest0 = pool.filter(b => !law.includes(b));
  const veto = rest0.filter(b => effStage(b) === 'vetoed' || /\bvetoed\b/i.test(b.last_action || '')), rest1 = rest0.filter(b => !veto.includes(b));
  const gov = rest1.filter(b => effStage(b) === 'governor'), died = rest1.filter(b => !gov.includes(b));
  const byNum = (x, y) => (x.priority || 9) - (y.priority || 9) || x.bill_number.localeCompare(y.bill_number, 'en', { numeric: true });
  const row = (b, extra = '') => `<a class="td-rrow" href="${billRoute(b)}"><b class="td-num">${esc(billNum(b))}</b>${actOf(b) ? `<span class="td-act">Act ${esc(actOf(b))}</span>` : ''}<span class="td-rname">${esc(b.nickname || blurb(b, 80))}</span>${extra}</a>`;
  const open = !!S.tdOpen?.died;
  const sum = [law.length ? `<b>${plural(law.length, 'bill')} became law</b>` : 'none became law', veto.length ? `${veto.length} vetoed` : '', gov.length ? `${gov.length} still with the Governor` : '', died.length ? `${died.length} did not pass` : ''].filter(Boolean).join(', ');
  return `<section class="td-group td-res" aria-labelledby="td-g-res"><h2 class="td-h">${groupHead(`How the ${SESSION_YEAR} session ended`, plural(pool.length, 'bill'), { id: 'td-g-res' })}</h2>
    <div class="td-cbox"><p class="td-rsum">For ${esc(whose)}: ${sum}.</p>
      ${law.length ? `<h3 class="td-ch td-chlaw">${icon('badge-check')}Became law</h3><div class="td-rrows">${law.sort(byNum).map(b => row(b)).join('')}</div>` : ''}
      ${veto.length ? `<h3 class="td-ch">${icon('circle-x')}Vetoed</h3><div class="td-rrows">${veto.sort(byNum).map(b => row(b)).join('')}</div>` : ''}
      ${gov.length ? `<h3 class="td-ch">${icon('landmark')}Still with the Governor</h3><div class="td-rrows">${gov.sort(byNum).map(b => row(b)).join('')}</div>` : ''}
      ${died.length ? `<button type="button" class="td-pgmore" data-fold="died" aria-expanded="${open}"><span>${esc(`${plural(died.length, 'bill')} did not pass`)}</span>${icon(open ? 'chevron-up' : 'chevron-down', { cls: 'chev' })}</button>
        ${open ? `<div class="td-rrows">${died.sort(byNum).map(b => row(b, `<span class="td-rwhy">${whyDead(b)}</span>`)).join('')}</div>` : ''}` : ''}</div></section>`;
}
// January: when the next session opens, and the one thing to check before it. Admins get Session setup, where the
// readiness list is; everyone else gets My settings, where they choose how the tracker reaches them. Help's "Getting
// ready for a new session" says what changes on opening day.
function janPanel() {
  const y = SESSION_YEAR + 1, cal = (S.sessionCal || []).find(c => c.session_year === y);
  const open = cal?.opening_day ? String(cal.opening_day).slice(0, 10) : thirdWed(y);
  const adm = admins(S.me.id);
  const body = `<div class="td-jan"><p>The ${y} session opens <b>${esc(dayFmt(open, { weekday: 'short', month: 'short', day: 'numeric' }))}</b>. <a href="#/help/session">What changes then</a></p>
    ${S.me.is_admin ? `<p class="td-janw">The readiness list says what the tracker still needs before then.</p>${btn('Check the session setup', { kind: 'secondary', href: '#/setup', icon: 'list-checks' })}`
      : `<p class="td-janw">${esc(adm ? `${adm} get${adm.includes(' or ') ? '' : 's'} the tracker ready for it.` : 'An admin gets the tracker ready for it.')} Before then, check how the tracker reaches you.</p>${btn('Check My settings', { kind: 'secondary', href: '#/me', icon: 'settings' })}`}</div>`;
  return panel('jan', 'calendar-check', 'Getting ready for January', '', body);
}

// ---- how fresh the Capitol data is (B-7) ----
// For everyone, not only admins (R-022). From 1100px the sidebar says it; a phone or a tablet has no sidebar, so it
// sits at the foot of Today (today.css hides this copy where the sidebar shows). Admins still get the warning notice.
function syncFoot() {
  if (DEMO) return `<p class="td-sync">${icon('refresh-cw')}<span>Sandbox data, as of ${new Date(DEMO_ASOF).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'Pacific/Honolulu' })}</span></p>`;
  const last = (S.syncRuns || []).find(r => r.ok)?.finished_at; if (!last) return '';
  const h = Math.floor((Date.now() - new Date(last).getTime()) / HR), stale = h >= 12;
  const ago = h < 1 ? 'less than an hour ago' : h < 48 ? `${plural(h, 'hour')} ago` : `${Math.floor(h / 24)} days ago`;
  return `<p class="td-sync${stale ? ' late' : ''}">${icon(stale ? 'circle-alert' : 'refresh-cw')}<span>Capitol data synced ${esc(ago)}</span></p>`;
}

// ---- What changed: one line per bill, and opening it counts as read ----
// Catching up (decision 6): since yesterday, since your last visit, or the last 7 days, and a search across the updates
// and the messages. It does not bring the old Inbox page back: it is the same folded line, reaching further.
const digRow = ({ r, hit }) => `<a class="row td-dr" href="${billRoute(r.b, 'activity')}"><span class="body"><span class="title"><b class="td-num">${esc(billNum(r.b))}</b> ${hit ? (hit.msg ? `${esc(hit.who)}: “${esc(clip(hit.text, 100))}”` : esc(hit.text)) : esc(r.best ? r.best[0] : 'New messages')}${!hit && r.n > 1 ? `<span class="td-more-n"> · ${plural(r.n - 1, 'more update')}</span>` : ''}</span></span>${r.msgs ? `<span class="end">${icon('message-square')}${plural(r.msgs, 'message')}</span>` : ''}</a>`;
function digRows(dg) {
  const q = S.tdDigQ || '', found = digestFind(dg.rows, q);
  if (!found.length) return { n: 0, html: `<p class="td-dnone2">${esc(q ? `Nothing ${dg.head} matches “${q}”.` : `Nothing changed on these bills ${dg.head}.`)}${S.tdSince !== 'week' ? ' Try the last 7 days.' : ''}</p>` };
  return { n: found.length, html: found.slice(0, 40).map(digRow).join('') + (found.length > 40 ? `<p class="td-dmore small muted">And ${found.length - 40} more bills. Each bill’s Activity tab has the full record.</p>` : '') };
}
const digCount = (dg, n) => (S.tdDigQ ? `${n} of ${plural(dg.rows.length, 'bill')}` : dg.rows.length ? plural(dg.rows.length, 'bill') : 'nothing new') + (dg.from && S.tdOpen?.digest ? ` since ${dg.from}` : '');
function digestSection(scope) {
  if (scope === 'person' || scope === 'none') return '';
  const since = SINCE.includes(S.tdSince) ? S.tdSince : 'day', dg = digest(scope, since), open = !!S.tdOpen?.digest;
  // Drawn when there is anything in the last week to catch up on, even if the day itself was quiet.
  if (!dg.rows.length && since === 'day' && !digest(scope, 'week').rows.length) return '';
  const { n, html } = digRows(dg);
  const seg = segmented('tdsince', [['day', dg.dayLabel === 'yesterday' ? 'Since yesterday' : `Since ${dg.dayLabel}`], ['visit', 'Since your last visit'], ['week', 'Last 7 days']], since, 'How far back');
  return `<section class="td-group td-dig" aria-labelledby="td-g-dig"><h2 class="td-h">${groupHead(open ? 'What changed' : `What changed ${esc(dg.head)}`, esc(digCount(dg, n)), { fold: 'digest', open, id: 'td-g-dig' })}</h2>
    ${open ? `<div class="td-digbar">${seg}<label class="td-digq">${icon('search')}<span class="sr">Search what changed</span><input type="search" id="td-digq" value="${esc(S.tdDigQ || '')}" placeholder="Bill, name or word" autocomplete="off" enterkeyhint="search"></label></div>
      <div class="rows td-digrows" id="td-digrows">${html}</div>
      <p class="td-dinbox">${icon('inbox')}<a href="#/inbox">Your Inbox</a><span> keeps all of it, read or not.</span></p>` : ''}</section>`;
}

// ---- This week (R-264): one place for what is coming, in place of Ahead (R-049) and the Week view (R-025) ----
// A person comes here to see what the week holds and what the next deadlines need. A laptop gets the Monday-to-Friday
// grid; a phone gets the day-by-day list Ahead had (hearings, and the hour written testimony closes). Under either: the
// deadlines in the next three weeks, each with every bill that still needs a hearing (P1 first, each with its committee,
// its chair, the last meeting before the deadline and when the notice must post, and one button to email the chair), the
// later ones folded to a line each, and then the other suggestions. Nothing here is "due": it is the work coming, not a
// task list (Today's promise stays a list you can clear). Kris and Saya own no bills, so for them it is their
// coalitions' bills, as their Today is.
const AH_DAYS = 21, AH_CAP = 7;
function aheadBills(scope, who) {
  const co = scope === 'mine' && !S.bills.some(isMine) ? coalPicked() : null;
  return co ? { list: S.bills.filter(b => (S.billCampaigns[b.id] || []).some(id => co.ids.has(id))), coal: co } : { list: clockBills(scope, who), coal: null };
}
const ahNames = bs => { const b = bs[0], more = bs.length - 1; return `<b class="td-num">${esc(billNum(b))}</b> ${esc(b.nickname || blurb(b, 60))}${more ? `<span class="muted"> and ${plural(more, 'other')}</span>` : ''}`; };
// The phone's week: the frame's header already says "This week", so the list has no heading of its own (A-14).
function aheadWeek(scope, who, coal) {
  const now = Date.now(), today = hst(now), end = dayAdd(today, 6), inC = b => !coal || (S.billCampaigns[b.id] || []).some(id => coal.ids.has(id));
  const hs = hearingsIn(today, end, coal ? 'team' : scope, coal ? null : who).filter(x => inC(x.b) && !isMon(x.b) && x.t >= now - 2 * HR);
  const sit = new Map(); for (const x of hs) { const k = slotKey(x.h); if (!sit.has(k)) sit.set(k, []); sit.get(k).push(x); }
  const ev = [];
  for (const list of sit.values()) {
    const h = list[0].h, due = testDue(h), open = list.filter(x => draftOf(x.h)?.status !== 'filed');
    ev.push({ day: list[0].day, at: list[0].t, kind: 'hearing', h, list });
    if (open.length && due > now && hst(due) <= end) ev.push({ day: hst(due), at: due, kind: 'due', h, list: open });
  }
  const days = [0, 1, 2, 3, 4, 5, 6].map(i => dayAdd(today, i)).filter(d => ev.some(e => e.day === d));
  const row = e => `<li class="ah-ev ah-${e.kind}${e.kind === 'due' && e.at - now <= DAY ? ' ah-soon' : ''}"><a href="#/hearing/${esc(e.h.id)}?from=week"><span class="ah-t">${esc(timeOf(new Date(e.at).toISOString()))}</span><span class="ah-k">${icon(e.kind === 'due' ? 'clock' : 'landmark')}${e.kind === 'due' ? `Testimony due · for the ${esc(e.h.committee)} hearing ${esc(dayFmt(hst(e.h.scheduled_at), { weekday: 'short', month: 'numeric', day: 'numeric' }).replace(',', ''))}` : `Hearing · ${esc(e.h.committee)}${e.h.room ? ' ' + esc(room(e.h.room)) : ''}`}</span><span class="ah-who">${ahNames(e.list.map(x => x.b))}</span></a></li>`;
  const body = days.length ? `<ol class="ah-days">${days.map(d => `<li class="ah-day"><h3 class="ah-dh">${esc(dayWord(d))} <span class="muted">${esc(dayFmt(d, { month: 'numeric', day: 'numeric' }))}</span></h3><ul class="ah-evs">${ev.filter(e => e.day === d).sort((a, b) => a.at - b.at || (a.kind === 'due' ? -1 : 1)).map(row).join('')}</ul></li>`).join('')}</ol>`
    : '<p class="ah-none">Nothing is scheduled in the next 7 days.</p>';
  return `<section class="ah-sec tw-days" aria-label="The next seven days">${body}</section>`;
}
// A bill with no hearing yet, under the deadline it races. `sg`: its chair-ask suggestion, whose three answers (Done,
// Not now, Not this bill) sit in the row's "…" (R-264); without one (answered, or not your list) the row is the fact alone.
function aheadRow(x, owners, sg = null) {
  const { b, st } = x, m = st.committee ? chairMail(st.committee) : null, nb = noticeByFor(st), ls = st.committee && st.deadline ? lastSlotBefore(st.committee, st.deadline.date, S.slots) : null, two = m && m.n > 1;
  const dayAt = d => new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric', timeZone: 'Pacific/Honolulu' }).replace(',', '');
  // The date that matters leads (when the chair must have posted a hearing), then who and where; and a bill whose companion is already
  // on a hearing says so, since the two usually share a nickname and one could be taken for the other (the fresh-eyes review, 10/6).
  const comp = (b.companions || []).map(n => billByNum(n, b.session_year)).find(x => x && (S.hearings || []).some(h => h.bill_id === x.id && h.status !== 'cancelled' && new Date(h.scheduled_at) > Date.now())),
    ch = comp && S.hearings.filter(h => h.bill_id === comp.id && h.status !== 'cancelled' && new Date(h.scheduled_at) > Date.now()).sort((p, q) => p.scheduled_at.localeCompare(q.scheduled_at))[0];
  const sub = [nb ? `a hearing must be posted by ${esc(dayAt(nb))}, ${esc(timeOf(nb.toISOString()))}` : '', st.committee ? esc(st.committee) : '', m ? esc(m.who) : '', ls ? `the committee’s last meeting is ${esc(dayAt(ls.at))}` : '', comp ? `its companion ${esc(comp.bill_number)} is heard ${esc(dayAt(ch.scheduled_at))}` : ''].filter(Boolean).map(p => `<span class="td-part">${p}</span>`).join(' · ');
  const body = `Aloha ${m ? m.who : 'Chair'},\n\nThe Hawaiʻi Public Health Institute asks you to schedule a hearing on ${b.bill_number}${blurb(b, 120) ? ` (${blurb(b, 120)})` : ''} before the ${st.deadline.label} deadline on ${fmtDate(st.deadline.date)}.\n\nMahalo,\n${((S.me || {}).full_name || '').split(' ')[0]}`;
  const own = owners ? avatar(advocate((S.assignments[b.id] || [])[0]), 20) : '';
  const more = sg ? iconBtn('ellipsis', `Done, not now or not this bill: ${billNum(b)}`, { 'data-sgmore': sg.key, 'aria-haspopup': 'dialog' }, 'td-more') : '';
  return `<li class="ah-row"><div class="ah-main"><a class="ah-bill" href="${billRoute(b)}"><b class="td-num">${esc(billNum(b))}</b>${b.priority === 1 ? P1 : ''} <span class="ah-nm">${esc(b.nickname || blurb(b, 80))}</span></a>${own}<p class="ah-sub">${sub}</p></div>
    <div class="ah-act">${m ? btn(`Email the chair${two ? 's' : ''}`, { kind: 'secondary', sm: true, icon: 'mail', href: `mailto:${m.email}?subject=${encodeURIComponent('Request for a hearing on ' + b.bill_number)}&body=${encodeURIComponent(body)}` }) : ''}${more}</div></li>`;
}
function aheadGate(g, lead, owners, chair) {
  const need = g.noHearing.slice().sort((x, y) => (y.b.priority === 1) - (x.b.priority === 1) || ((noticeByFor(x.st)?.getTime() ?? Infinity) - (noticeByFor(y.st)?.getTime() ?? Infinity)) || x.b.bill_number.localeCompare(y.b.bill_number, 'en', { numeric: true }));
  const sum = `${plural(g.racing.length, 'bill')} must ${gateNeed(g.label, g.racing.length)} by then${need.length ? `; ${need.length} ${need.length === 1 ? 'has' : 'have'} no hearing yet${g.p1 ? ` (${g.p1} P1)` : ''}` : '; every one has a hearing'}.`;
  const key = `ah${g.date}`, open = !!(S.tdOpen ??= {})[key], rows = open ? need : need.slice(0, AH_CAP);
  const list = need.length ? `<ul class="ah-rows">${rows.map(x => aheadRow(x, owners, chair.get(x.b.id))).join('')}</ul>${need.length > AH_CAP ? moreBtn(key, open, need.length) : ''}` : `<p class="ah-ok">${icon('check')}<span>${g.racing.length === 1 ? 'It has a hearing.' : 'Every one of them has a hearing.'}</span></p>`;
  const head = `<span class="ah-gd">${esc(ckDay(g.date))}</span><span class="ah-gn">${esc(g.name)}</span><span class="ah-gw muted">${esc(awayOf(g.days))}</span>`;
  if (lead) return `<section class="ah-gate" aria-label="${esc(`${ckDay(g.date)}, ${g.name}`)}"><h3 class="ah-gh">${head}</h3><p class="ah-gs">${esc(sum)}</p>${list}</section>`;
  return `<details class="ah-gate ah-later"><summary><span class="ah-gh">${head}</span><span class="ah-gc muted">${esc(need.length ? `${plural(need.length, 'bill')} with no hearing yet` : 'all have a hearing')}</span>${icon('chevron-down', { cls: 'ah-chev' })}</summary><p class="ah-gs">${esc(sum)}</p>${list}</details>`;
}
// Under the grid (or the phone's list): the deadlines, then "Also worth doing".
function weekBelow(scope, who, r) {
  if (SESSION_OVER) { LASTSG = new Map(); return `<section class="ah-sec"><p class="ah-none">The session is over, so there are no deadlines to race. The next one's calendar is loaded in December.</p></section>`; }
  const { list } = aheadBills(scope, who), owners = scope !== 'mine';
  const gates = sessionGates(list).filter(g => !g.past && g.racing.length && g.days <= AH_DAYS);
  const sg = suggestFor(scope, who, r, new Set(gates.flatMap(g => g.noHearing.map(x => x.b.id))));
  // The first deadline that still has a bill without a hearing is the open one; an earlier deadline whose bills all have one is a quiet line above it.
  const lead = gates.find(g => g.noHearing.length) || gates[0];
  const dl = `<section class="ah-sec" aria-labelledby="ah-dl"><div class="ah-hd"><h2 id="ah-dl">Deadlines</h2></div>${gates.length ? gates.map(g => aheadGate(g, g === lead, owners, sg.chair)).join('')
    : `<p class="ah-none">None of ${esc(whoseBills(scope, who))} races a deadline in the next three weeks.</p>`}</section>`;
  return dl + suggestHtml(sg.list, r);
}
function weekPage(route, scope, who, r) {
  const top = WIDE() ? weekView(route, scope, who, r) : aheadWeek(scope, who, aheadBills(scope, who).coal);
  // v4 (R-269): the foot's All tasks and Inbox went. Tasks retired (its rows are Today's and each bill's To do) and the
  // Inbox is in your menu: one way into each place (B-13).
  return `<div class="td-root td-weekroot">${toolbar(route)}${oneNotice()}${top}<div class="tw-below ah">${weekBelow(scope, who, r)}</div></div>`;
}

function render(route) {
  if (!S.me) return empty({ title: 'No staff record yet', text: 'You are signed in, but the tracker does not know who you are. Ask your admin to add you.' });
  MEMO = new Map(); CARDS = new Map(); WAITS = new Map(); ROWS = []; ROWOPT = new Map();
  const scope = scopeOf(), who = whoOf(), r = items(scope, who), name = who ? first(who) : '';
  LAST = new Map(r.tasks.map(t => [t.key, t]));
  // Async loads, each once: audience counts for the emails in the list, and the new-bill counts in the opening weeks.
  S.tdAud ??= {};
  for (const t of r.tasks) if (t.a && S.tdAud[t.a.id] === undefined) { S.tdAud[t.a.id] = null; DB.alertAudience(t.a.bill_id, t.a.list_id, t.a.segment_id).then(n => { S.tdAud[t.a.id] = n; if (S.route?.name === 'today') hooks.render(); }).catch(() => {}); }
  if (openWeeks() && !S.tdTriage && !S.tdTriageLoading) { S.tdTriageLoading = true; DB.triageCounts().then(c => { S.tdTriage = c || {}; if (S.route?.name === 'today') hooks.render(); }).catch(() => { S.tdTriage = {}; }); }
  if (viewOf(route) === 'week') return weekPage(route, scope, who, r);
  LASTSG = new Map();   // suggestions are This week's (R-264)
  const open = S.tdOpen ??= { later: false, digest: false };
  const off = SESSION_OVER, rows = WIDE();
  // Kris and Saya own no bills: beside "The team's week" their own "This week" (all zeros) and "None of your bills has
  // to be heard" contradicted the page (fresh-eyes review, 9/21), so the coalition's week stands in for both.
  const coal = scope === 'mine' && !off ? coalSection(r) : '', bare = !!coal && !S.bills.some(isMine);
  let i = 0, body;
  if (scope === 'team') body = teamHtml(0, rows) + loadGroup();
  else {
    // Mine and a teammate's list never hold "waiting" cards (todayItems makes those for Team only): what waits on
    // someone else is "Waiting on others", a folded group under the list.
    const groups = r.groups.map(g => { const cs = g.cards.filter(c => !c.wait); return { ...g, cards: cs, n: cs.reduce((s, c) => s + (c.cluster ? (g.id === 'overdue' ? c.cluster.filter(t => t.due != null && t.due <= Date.now()).length || 1 : c.cluster.length) : 1), 0) }; }).filter(g => g.cards.length);
    const clear = !groups.some(g => g.id === 'overdue' || g.id === 'today');
    const groupHtml = (g, gi) => {
      const fold = g.id === 'later', isOpen = !fold || open.later, filled = g.id === 'overdue' || g.id === 'today';
      const title = g.id === 'overdue' ? `${icon('circle-alert', { cls: 'td-late' })}Overdue` : esc(g.title);
      // Numbers only where they ask for action (R-264): Overdue and Today say how many; a fold says what it holds.
      const list = rows ? `<div class="td-rows">${g.cards.map(c => row(c, filled)).join('')}</div>` : `<div class="td-list">${g.cards.map(c => card(c, i++, false, { filled })).join('')}</div>`;
      return `<section class="td-group" aria-labelledby="td-g-${g.id}"><h2 class="td-h"${gi === 0 ? ' data-top tabindex="-1"' : ''}>${groupHead(title, filled || fold ? g.n : '', { fold: fold ? 'later' : undefined, open: isOpen, id: 'td-g-' + g.id })}</h2>
        ${isOpen ? list : ''}</section>`;
    };
    if (!groups.length) {
      // Nothing of your own. Between sessions that is normal, and a coalition's week is real content: either way the
      // page leads with what there is, never an "All clear" card and a button to go and find bills (R-022).
      body = (off ? `<p class="td-quiet" data-top tabindex="-1">${esc(who ? `Nothing is open on ${name}’s list.` : 'Nothing is open on your list.')}</p>`
        : coal ? `<p class="td-quiet" data-top tabindex="-1">${icon('circle-check')}<span>Nothing of your own is due today.</span></p>`
        : `<div class="td-empty" data-top tabindex="-1">${empty({ art: scope === 'mine' ? yay() : '', title: who ? `Nothing is waiting on ${esc(name)}.` : scope === 'none' ? 'Nothing is open on the bills nobody owns.' : 'All clear for today.', text: nextHearingText(scope, who), action: scope !== 'mine' ? btn('Back to my list', { kind: 'secondary', attrs: { 'data-seg': 'tdscope', 'data-val': 'mine' } }) : btn('See your bills', { href: '#/bills' }) })}</div>`) + startCard();
    } else body = (clear ? `<div class="td-clear">${scope === 'mine' ? yay() : ''}<div><p class="td-clear-t">${who ? `Nothing for ${esc(name)} today.` : scope === 'none' ? 'Nothing is due today on the bills nobody owns.' : 'All clear for today.'}</p><p class="small muted">${nextHearingText(scope, who)}</p></div></div>` : '')
      + groups.map((g, gi) => groupHtml(g, gi) + (gi === 0 ? startCard() : '')).join('');
    body += waitingGroup(scope, who) + coal;
  }
  // A teammate's list is for looking: say so once. It is the top of the list, so it takes the focus when this list is
  // chosen (A-16). How many cards it holds is Team load's to say (R-264).
  const note = who ? `<p class="td-whonote" data-top tabindex="-1">${icon('info')}<span>Messages sent to ${esc(name)} are not shown here.</span></p>`
    : scope === 'none' ? `<p class="td-whonote" data-top tabindex="-1">${icon('info')}<span>Anyone can take these steps. To give a bill an owner, use its “…” menu.</span></p>` : '';
  const digestHtml = digestSection(scope);
  const results = off ? resultsHtml(scope, who) : '', jan = off ? janPanel() : '';
  const hear = off ? '' : hearingsLine(scope, who), dl = bare || off ? '' : deadlineLine(scope, who);
  // A phone (and a tablet, below the sidebar layout) keeps the cards: your own work first, then what waits on others,
  // then the deadline line and catching up.
  if (!rows) return `<div class="td-root">${toolbar(route)}<div class="td-main">${note}${oneNotice()}${hear}${body}${results}${jan}${dl}${digestHtml}${syncFoot()}</div></div>`;
  // A laptop: the rows, and the open item beside them (R-264). With nothing to open, one column.
  let list = `${note}${oneNotice()}${hear}${body}${results}${jan}${digestHtml}`;
  const sel = pickSel();
  if (!sel) return `<div class="td-root td-desk td-v3">${toolbar(route)}<div class="td-main td-one">${list}${dl}</div></div>`;
  S.tdSel = { ...(S.tdSel || {}), key: sel, i: ROWS.indexOf(sel) };
  list = markSel(list, sel);
  return `<div class="td-root td-desk td-v3">${toolbar(route)}<div class="td-cols3"><div class="td-main">${list}</div>
    <aside class="td-side" aria-label="The item you picked"><section class="td-pane" id="td-pane" aria-labelledby="td-pane-h">${paneHTML(sel)}</section>${dl}</aside></div></div>`;
}

// ---- actions ----
const markNotices = b => { const keys = (S.inbox || []).filter(i => i.direct && i.unread && i.bill_id === b.id && i.kind !== 'message').map(i => i.key); if (keys.length) DB.inboxMark(keys).catch(() => {}); };
const redraw = () => { hooks.render(); };
async function busy(el, fn) { if (el) { el.setAttribute('aria-busy', 'true'); el.disabled = true; } try { await fn(); } catch (e) { toast(e, { err: true }); if (el && el.isConnected) { el.removeAttribute('aria-busy'); el.disabled = false; } } }

export function fileSheet(b, d, after = redraw) {
  openSheet({ title: `Filed ${esc(b.bill_number)} testimony for ${esc(d.committee)}?`, size: 'auto',
    body: field('td-furl', 'Capitol confirmation link (optional)', '<input id="td-furl" type="url" inputmode="url" autocomplete="off" placeholder="https://">', 'Paste the link from the confirmation email or page, if you have one.'),
    foot: `${btn('File at the Capitol', { kind: 'text', href: capitolUrl(b), target: '_blank', iconEnd: 'external-link' })}${btn('Mark filed', { attrs: { 'data-go': '1' } })}`,
    wire: dlg => {
      const go = dlg.querySelector('[data-go]'), inp = dlg.querySelector('#td-furl');
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); go.click(); } });
      go.onclick = () => busy(go, async () => {
        await DB.transition(b.id, d.id, 'file', null, inp.value.trim());
        closeSheet({ silent: true }); markNotices(b);
        toast(`Filed. ${b.bill_number} is done for ${d.committee}.`, { ok: true, undo: async () => { await DB.transition(b.id, d.id, 'unfile'); toast('Unfiled. It is back to approved.'); after(); } });
        after();
      });
    } });
}
async function run(t, act, el) {
  const b = t.b;
  switch (act) {
    case 'submit': return busy(el, async () => {
      await DB.transition(b.id, t.d.id, 'submit'); markNotices(b);
      const who = approvers(S.me.id);
      toast(who ? `Sent to ${who} for review.` : 'Sent for review. It is waiting in your review queue.', { ok: true, undo: async () => { await DB.transition(b.id, t.d.id, 'withdraw'); toast('Pulled back to draft.'); redraw(); } });
      redraw(); });
    case 'file': return fileSheet(b, t.d);
    case 'draftnow': return makeDraftNow(t.h);   // R-102
    case 'todo': return busy(el, async () => {
      await DB.updateTodo(b.id, t.t.id, { done: true });
      toast(`Done: ${clip(t.t.title, 60)}`, { ok: true, undo: async () => { await DB.updateTodo(b.id, t.t.id, { done: false }); redraw(); } }); redraw(); });
    case 'fu': return busy(el, async () => {
      const f = t.f; await DB.doneFollowup(f.id);
      // There is no "not done" call, so Undo adds the same follow-up back.
      toast('Follow-up done.', { ok: true, undo: async () => { await DB.addFollowup(f.person_id, f.advocate_id, f.what, f.due); redraw(); } }); redraw(); });
    case 'read': return busy(el, async () => {
      const keys = t.i ? [t.i.key] : t.keys || []; await DB.inboxMark(keys);
      toast('Marked done.', { undo: async () => { await DB.inboxUnmark(keys); redraw(); } }); redraw(); });
    case 'send': {
      // The composer's words (since R-101 Send joins the 4:30 pm email, from "HIPHI Bill Tracker", replies to the writer,
      // and can be taken back until then); this said "cannot be taken back" and named the writer's address (R-180).
      const a = t.a, n = S.tdAud?.[a.id], paused = S.emailCfg?.enabled === false, day = dailyWord();
      const ok = await confirmSheet({ title: `Send at 4:30 pm to ${n != null ? plural(n, 'person', 'people') : 'the followers'}?`, ok: 'Send at 4:30 pm',
        text: `${esc(a.subject)}<br><span class="small muted">${paused ? 'Email is paused, so it is held: it goes out in the first 4:30 pm email after an admin turns email on' : `It goes out ${day} at 4:30 pm`}, in each person’s one email of the day. You can take it back until then. Replies go to ${esc(advocate(a.author_id)?.email || 'the writer')}.</span>` });
      if (!ok) return;
      return busy(el, async () => { const r = await DB.alertStep(a.id, 'send'); toast(paused ? `Held while email is paused. It goes to ${plural(r?.recipients ?? n ?? 0, 'person', 'people')} in the first 4:30 pm email after email is turned on.` : `In ${day}’s 4:30 pm email to ${plural(r?.recipients ?? n ?? 0, 'person', 'people')}.`, { ok: true, undo: async () => { try { await DB.alertStep(a.id, 'unsend'); redraw(); toast('Taken back. It will not go out.'); } catch (e) { toast(e, { err: true }); } } }); redraw(); });
    }
  }
}
// Quick look (look.js): the bill's facts and its next step without leaving Today. The list it is given is every bill
// on the screen in the order they are drawn — task cards and suggestions alike — so j and k walk the page from inside
// the modal, and "Open full page" is still one click away.
function quickLook(el) {
  if (!el) return;
  const pairs = [...document.querySelectorAll('.td-root [data-bill]')].map(x => [x, billById(x.dataset.bill)]).filter(p => p[1]);
  const i = pairs.findIndex(p => p[0] === el);
  if (i < 0) { const b = billById(el.dataset.bill); return b && openLook(b, { list: pairs.map(p => p[1]), index: 0 }); }
  return openLook(pairs[i][1], { list: pairs.map(p => p[1]), index: i });
}
// An "Also" row whose step is a button (Mark filed, Submit for review, Done) has nowhere to go, so it offers the
// step itself. Without this the row threw: the menu it called was never written (bug found 9/19).
function alsoMenu(t) {
  const items = (t.btns || []).map(x => x.href
    ? { label: x.label, icon: x.ext && !x.mail ? 'external-link' : 'arrow-right', run: later(() => { if (x.ext && !x.mail) window.open(x.href, '_blank', 'noopener'); else if (x.mail) location.href = x.href; else S.go(x.href); }) }
    : { label: x.label, icon: 'check', run: later(() => run(t, x.act)) });
  if (items.length) menuSheet({ title: esc(clip(String(t.s).replace(/<[^>]+>/g, ''), 60)), items });
}
// The ⋯ menu on a card: the bill's everyday actions, in one place. From the open item (`pane`), "Open bill" and "I'm
// going" are left out: the item says both already, a step away (A-14).
function moreMenu(c, { pane = false } = {}) {
  const p = c.p, b = c.b, me = S.me;
  if (!b) {
    if (p.kind === 'followup') return menuSheet({ title: 'Follow-up', items: [
      { label: 'Open their page', icon: 'user-round', run: later(() => S.go(`#/person/${p.f.person_id}`)) },
      p.p.email ? { label: 'Email them', icon: 'mail', sub: p.p.email, run: () => { location.href = `mailto:${p.p.email}`; } } : null,
      p.p.phone ? { label: 'Call', icon: 'phone', sub: p.p.phone, run: () => { location.href = `tel:${p.p.phone}`; } } : null] });
    if (p.a) return menuSheet({ title: 'Email to supporters', items: [{ label: 'Open the email', icon: 'mail', run: later(() => S.go(`#/email/${p.a.id}`)) }] });
    return;
  }
  const num = billNum(b), h = paneHearingOf(c);
  const goers = h ? [...new Map(goersAt(h).map(a => [a.id, a])).values()] : [], going = h ? goingFor(h).going : false, others = goers.filter(a => a.id !== me.id).map(a => a.full_name.split(' ')[0]);
  const stream = h ? streamOf(h) : null, owner = (S.assignments[b.id] || [])[0] || null, ahead = hearingAhead(b), muted = isMuted(b);
  // Mark done clears what only needed reading: a notice, or a message that needs no reply. A message that was opened
  // and not answered stays on Today marked "Seen"; Mark unread makes it loud again.
  const notes = c.tasks.filter(t => t.kind === 'notice' || t.kind === 'reply'), reply = c.tasks.find(t => t.kind === 'reply');
  menuSheet({ title: esc(num), items: [
    pane ? null : { label: 'Open bill', icon: 'scroll-text', run: later(() => S.go(`${billRoute(b)}`)) },
    { label: 'Reply in chat', icon: 'message-square', run: later(() => { if (reply) markSeen(reply.keys); S.go(`${billRoute(b, 'activity')}?reply=1`); }) },
    h && !pane ? { label: going ? 'I’m not going after all' : 'I’m going to the hearing', icon: going ? 'user-round' : 'user-check', sub: `${h.committee} ${whenLine(h.scheduled_at)}${others.length ? ' · ' + others.join(', ') + (others.length === 1 ? ' is' : ' are') + ' going' : ''}`,
      run: () => toggleGoing(h) } : null,
    stream ? { label: 'Watch the hearing', icon: 'video', sub: stream.label + (stream.exact ? '' : ' · ' + stream.channel), run: () => { window.open(stream.url, '_blank', 'noopener'); } } : null,
    { label: 'Give to someone else', icon: 'user-plus', sub: owner ? `Now ${owner === me.id ? 'yours' : first(owner) + '’s'}` : 'No owner yet', run: later(() => pickerSheet({ title: `Give ${esc(num)} to`, value: owner || '',
      options: S.advocates.filter(a => a.is_active !== false).map(a => [a.id, a.id === me.id ? `${a.full_name} (you)` : a.full_name, 'user-round']),
      onPick: async id => { if (id === owner) return; try { await DB.setOwner(b.id, id); toast(id === me.id ? `${num} is yours now.` : `${num} is ${first(id)}’s now.`, { ok: true, undo: async () => { await DB.setOwner(b.id, owner); redraw(); } }); redraw(); } catch (e) { toast(e, { err: true }); } } })) },
    muted ? { label: 'Unmute this bill', icon: 'bell', run: async () => { try { await DB.mute(b.id, false); toast(`${num} is back on your Today.`); redraw(); } catch (e) { toast(e, { err: true }); } } }
      : { label: 'Mute this bill', icon: 'bell-off', disabled: !!ahead, reason: ahead ? `${num} has a hearing ${whenLine(ahead.scheduled_at)} (${ahead.committee}). You can mute it once that hearing is over.` : '',
        sub: 'Off your Today and no alerts until it gets a hearing', run: async () => { try { await DB.mute(b.id, true); toast(`Muted ${num}: off your Today and no alerts until it gets a hearing.`, { undo: async () => { await DB.mute(b.id, false); redraw(); } }); redraw(); } catch (e) { toast(e, { err: true }); } } },
    reply?.seen ? { label: 'Mark unread', icon: 'mail', sub: `Shows ${reply.from}’s message as new again`, run: () => msgUnread(reply) } : null,
    notes.length ? { label: 'Mark done', icon: 'check', sub: reply ? 'Clears the message without a reply' : 'Clears this notice', run: () => msgDone(notes) } : null,
  ] });
}
// The two ways a message leaves Today without an answer being sent: Mark done (with Undo), and back again: Mark unread.
async function msgDone(notes) {
  const st = msgState(), keys = notes.flatMap(t => t.keys || [t.i.key]), msgs = notes.filter(t => t.kind === 'reply').flatMap(t => t.keys);
  const wasUnread = keys.filter(k => (S.inbox || []).some(i => i.key === k && i.unread));
  try {
    await DB.inboxMark(keys); msgs.forEach(k => st.done.add(k)); keepSeen();
    toast('Marked done.', { undo: async () => { msgs.forEach(k => st.done.delete(k)); keepSeen(); await DB.inboxUnmark(wasUnread); redraw(); } }); redraw();
  } catch (e) { toast(e, { err: true }); }
}
async function msgUnread(t) {
  const st = msgState(), read = t.keys.filter(k => (S.inbox || []).some(i => i.key === k && !i.unread));
  t.keys.forEach(k => st.seen.delete(k)); keepSeen();
  try { if (read.length) await DB.inboxUnmark(read); toast('Marked unread.'); } catch (e) { toast(e, { err: true }); }
  redraw();
}
// One teammate's list. The picker shows each person's open cards, so a manager sees the load before choosing.
// Another list is other bills: the deadline clock's filter belonged to the list it was pressed on.
// Choosing a person in the List view takes you to the top of their list and puts the focus there (A-16): from Team
// load, a screen down the side panel, the list used to redraw under you and James's overdue card sat above the fold
// you were looking at, so it read as if he had nothing urgent (review, 9/21). The Week view's own person chips keep
// their place and their focus, as they were (R-025 is Nate's to decide).
function setWho(id, refocus) {
  S.tdCur = null; S.tdSel = null; S.tdTop = true;
  if (id === S.me?.id) { S.tdWho = null; S.tdScope = 'mine'; return S.go(tdHref({ team: false }), { replace: true }); }
  S.tdWho = S.tdWho === id ? null : id;   // the same person (or No owner) again: back to where you were
  hooks.render();
}
function pickWho() {
  const rows = teamLoad().filter(x => x.a.id !== S.me.id).sort((x, y) => x.a.full_name.localeCompare(y.a.full_name));
  const week = viewOf(S.route) === 'week', nr = items('none'), nn = openCount(nr);
  const cards = (n, late) => n ? `${plural(n, 'open card')}${late ? ` · ${late} overdue` : ''}` : 'Nothing open';
  pickerSheet({ title: week ? 'Whose week' : 'Whose list', value: scopeOf() === 'none' ? 'none' : whoOf() || 'all', help: 'Open cards for each teammate, counted the way their own Today counts them.',
    options: [['all', 'Everyone', 'users', week ? 'The whole team’s week' : 'Everyone’s work, by person'], ...rows.map(({ a, n, late }) => [a.id, a.full_name, 'user-round', cards(n, late)]),
      ['none', 'No owner', 'circle-dashed', `Bills nobody owns · ${cards(nn, nr.late)}`]],
    onPick: id => { S.tdWho = id === 'all' ? null : id; S.tdScope = 'team'; S.tdCur = null; S.tdSel = null; S.tdTop = true; S.go(tdHref({ team: true }), { replace: true, keepScroll: true }); } });
}
// A card's "…": the card drawn with that key (CARDS), which in Team can be the same bill in two people's groups.
const cardOf = k => CARDS.get(k) || items(scopeOf(), whoOf()).cards.find(x => x.key === k);
// A to-do nobody has taken, on a coalition's bill: take it (R-022). You gave it to yourself, so nobody is messaged.
async function takeTodo(billId, id, el) {
  const t = (S.todos[billId] || []).find(x => String(x.id) === String(id)); if (!t) return;
  await busy(el, async () => {
    await DB.updateTodo(billId, t.id, { assignee_id: S.me.id });
    toast(`It is yours now: ${clip(t.title, 60)}.`, { ok: true, undo: async () => { await DB.updateTodo(billId, t.id, { assignee_id: null }); toast('Put back for anyone to take.'); redraw(); } });
    redraw();
  });
}

// The controls inside one part of the page. The open item is redrawn alone when another row is chosen (select), so its
// controls are wired here as well as with the page.
function wireControls(el) {
  // Choosing a row opens it beside the list; its own button (beside the row's text, not inside it) still does the step.
  el.querySelectorAll('.td-row').forEach(r => r.addEventListener('click', () => { if (r.dataset.k !== S.tdSel?.key) select(r.dataset.k); }));
  el.querySelectorAll('[data-sel]').forEach(b => b.addEventListener('focus', () => { S.tdInList = true; }));
  // Opening a message does not clear it any more: it is marked Seen and stays until it is answered or marked done.
  el.querySelectorAll('[data-seen]').forEach(x => x.addEventListener('click', () => { const t = LAST.get(x.dataset.k); if (t?.keys) markSeen(t.keys); }));
  // A notice only needs reading, so opening what it is about clears it.
  el.querySelectorAll('[data-read]').forEach(x => x.addEventListener('click', () => { const t = LAST.get(x.dataset.k); const keys = t?.i ? [t.i.key] : []; if (keys.length) DB.inboxMark(keys).catch(() => {}); }));
  // Into review mode: a fresh queue, and any Undo toast from this page goes (its step is now under review).
  el.querySelectorAll('[data-review]').forEach(x => x.addEventListener('click', () => { S.tdRev = null; const t = document.getElementById('toast'); if (t) t.innerHTML = ''; }));
  el.querySelectorAll('button[data-act]').forEach(x => x.onclick = () => { const t = LAST.get(x.dataset.k); if (t) run(t, x.dataset.act, x); });
  el.querySelectorAll('[data-also]').forEach(x => x.onclick = () => { const t = LAST.get(x.dataset.also); if (t) alsoMenu(t); });
  el.querySelectorAll('[data-look]').forEach(x => x.onclick = () => quickLook(x.closest('[data-bill]')));
  el.querySelectorAll('[data-more]').forEach(x => x.onclick = () => { const c = cardOf(x.dataset.more); if (c) moreMenu(c, { pane: !!x.dataset.pane }); });
  el.querySelectorAll('[data-going]').forEach(x => x.onclick = () => { const h = (S.hearings || []).find(y => String(y.id) === x.dataset.going); if (h) { S.tdRefocus = '#td-pane [data-going]'; toggleGoing(h); } });
}
function wire(route, root) {
  const main = root.querySelector('.td-root'); if (!main) return;
  // Mine or Team, for this visit: the address says which (v4, R-269), replaced in place so Back still leaves Today.
  main.querySelectorAll('[data-seg="tdscope"]').forEach(el => el.onclick = () => { S.tdWho = null; S.tdScope = el.dataset.val; S.tdCur = null; S.tdSel = null; S.tdRefocus = `.td-scope [data-val="${S.tdScope}"]`; S.go(tdHref({ team: S.tdScope === 'team' }), { replace: true, keepScroll: true }); });
  // Today or This week swaps the page in place (no new history entry: Back still leaves Today, as it always has).
  main.querySelectorAll('[data-seg="tdview"]').forEach(el => el.onclick = () => { S.tdRefocus = `[data-seg="tdview"][data-val="${el.dataset.val}"]`; S.go(tdHref({ week: el.dataset.val === 'week', w: 0 }), { replace: true }); });
  main.querySelectorAll('[data-week]').forEach(el => el.onclick = () => { const w = +el.dataset.week || 0; S.tdRefocus = `[aria-label="${el.getAttribute('aria-label') || 'Next week'}"]`; S.go(tdHref({ week: true, w }), { replace: true, keepScroll: true }); });
  main.querySelector('[data-whopick]')?.addEventListener('click', pickWho);
  main.querySelectorAll('[data-who]').forEach(el => el.onclick = () => setWho(el.dataset.who, `[data-who="${el.dataset.who}"]`));
  main.querySelectorAll('[data-fold]').forEach(el => el.onclick = () => {
    const k = el.dataset.fold, open = S.tdOpen ??= {}; open[k] = !open[k];
    // Opening the digest is reading it: every official update it stands for counts as read.
    if (k === 'digest' && open[k]) { const keys = digest(scopeOf()).keys; if (keys.length) DB.inboxMark(keys).catch(() => {}); }
    S.tdRefocus = `[data-fold="${k}"]`; hooks.render();
  });
  // "+N on bills you monitor" (decision 4): the choice follows the person (advocates.prefs), so it holds on the phone
  // too. The focus stays on the button, whose words have just changed to say what pressing it again does.
  main.querySelectorAll('[data-mon]').forEach(el => el.onclick = async () => {
    const on = !monOn();
    try { await DB.patchPrefs({ showMonitor: on }); } catch (e) { toast(e, { err: true }); return; }
    S.tdRefocus = el.closest('.td-wnav') ? '.td-wnav [data-mon]' : '[data-mon]'; hooks.render();
  });
  wireControls(main); quietOpen(main); paneFit(main.querySelector('#td-pane'));
  // The open item's links are wired by the frame when the page is drawn, but not after select() redraws it: route
  // those the same way (a link the frame already handled is marked defaultPrevented and left alone).
  main.querySelector('#td-pane')?.addEventListener('click', e => { const a = e.target.closest('a[href^="#/"]'); if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey) return; e.preventDefault(); S.go(a.getAttribute('href')); });
  main.querySelectorAll('[data-sgmore]').forEach(el => el.onclick = () => sugMenu(el.dataset.sgmore));
  main.querySelectorAll('[data-give]').forEach(el => el.onclick = () => { const t = WAITS.get(el.dataset.give); if (t) giveTodo(t); });
  main.querySelectorAll('[data-ctake]').forEach(el => el.onclick = () => { const [b, id] = el.dataset.ctake.split('|'); takeTodo(b, id, el); });
  // Catching up: how far back, and the search. The search redraws only the rows (and the count), so the field keeps
  // its focus and the caret while you type.
  main.querySelectorAll('[data-seg="tdsince"]').forEach(el => el.onclick = () => { S.tdSince = el.dataset.val; S.tdRefocus = `[data-seg="tdsince"][data-val="${el.dataset.val}"]`; hooks.render(); });
  const dq = main.querySelector('#td-digq');
  if (dq) {
    dq.addEventListener('input', () => {
      S.tdDigQ = dq.value;
      const dg = digest(scopeOf(), SINCE.includes(S.tdSince) ? S.tdSince : 'day'), { n, html } = digRows(dg), box = main.querySelector('#td-digrows'), cnt = main.querySelector('#td-g-dig .n');
      if (box) box.innerHTML = html; if (cnt) cnt.textContent = digCount(dg, n);
    });
    dq.addEventListener('keydown', e => { if (e.key === 'Escape' && dq.value) { e.stopPropagation(); dq.value = ''; dq.dispatchEvent(new Event('input')); } });
    // Rows drawn after the page (a search) are not wired by the frame; route them the same way.
    main.querySelector('#td-digrows')?.addEventListener('click', e => { const a = e.target.closest('a[href^="#/"]'); if (!a || e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey) return; e.preventDefault(); S.go(a.getAttribute('href')); });
  }
  if (main.querySelector('.td-yay')) save('allclear', hst(Date.now()));
  main.querySelector('[data-newhere]')?.addEventListener('click', () => { save('newhere_done', '1'); hooks.render(); });
  main.querySelector('[data-tdstart]')?.addEventListener('toggle', e => { S.tdStartOpen = e.target.open; });
  main.querySelectorAll('[data-tdfr]').forEach(a => a.addEventListener('click', () => markNewStep({ [a.dataset.tdfr]: 1 })));
  // Keep the place. A control that redrew the page gets its focus back. Otherwise the card (or row) j/k or a click was
  // last on does: after a step redraws the list, and after a trip to a bill and back, the next j goes on from there,
  // not from the top (assessment 9/19). When it is gone, the one that took its place is next.
  const idle = !document.activeElement || document.activeElement === document.body || document.activeElement.id === 'main';
  if (S.tdTop) {
    // A person was chosen: the top of their list, and the focus on it (its first heading, or the note that says whose
    // list this is).
    S.tdTop = false; S.tdRefocus = null; window.scrollTo(0, 0);
    (main.querySelector('[data-top]') || main.querySelector('.td-h1'))?.focus({ preventScroll: true });
  } else if (S.tdRefocus) { const el = main.querySelector(S.tdRefocus); S.tdRefocus = null; el?.focus({ preventScroll: true }); }
  else if (S.tdInList && idle && !document.querySelector('dialog[open]') && main.querySelector('.td-row.on')) main.querySelector('.td-row.on .td-rsel')?.focus({ preventScroll: true });
  else if (S.tdCur && idle && !document.querySelector('dialog[open]')) { const cards = [...main.querySelectorAll('.td-card')], c = cards.find(x => x.dataset.k === S.tdCur.key) || cards[Math.min(S.tdCur.i, cards.length - 1)]; c?.focus({ preventScroll: true }); }
}
// The card that last had the focus (its key, and its position for when it is gone). Focus inside a sheet does not count;
// focus that moves to another part of the page (the toolbar, the side panel, search) gives the place up. On a laptop the
// open row is remembered by select(); here it is only noted whether the person is working in the list and its item.
document.addEventListener('focusin', e => {
  if (S.route?.name !== 'today' || !e.target?.closest || e.target.closest('dialog')) return;
  const c = e.target.closest('.td-root .td-card');
  if (c) S.tdCur = { key: c.dataset.k, i: [...document.querySelectorAll('.td-root .td-card')].indexOf(c) };
  else if (e.target.id !== 'main') S.tdCur = null;
  if (e.target.id !== 'main') S.tdInList = !!e.target.closest('.td-root .td-rows, .td-root #td-pane');
});

// Desktop keys (listed in Help, never shown or bound on touch screens, and off when My settings says so). On a laptop's
// list: j/k, or the arrow keys once you are in the list, open the next or previous item; Enter on a row does its step
// (or opens the bill when it has no button of its own); o takes a quick look at the bill. With cards (a narrower
// window): j/k move between cards, Enter runs the card's button, o takes a quick look. None changes anything by itself.
document.addEventListener('keydown', e => {
  if (S.route?.name !== 'today' || !HOVER() || !keysOn() || e.metaKey || e.ctrlKey || e.altKey || typing(e.target) || document.querySelector('dialog[open]')) return;
  const rows = [...document.querySelectorAll('.td-root .td-row')];
  if (rows.length) {
    const inList = !!document.activeElement?.closest?.('.td-root .td-rows'), onSel = !!document.activeElement?.closest?.('.td-rsel');
    const at = rows.findIndex(r => r.dataset.k === S.tdSel?.key), cur = rows[at];
    const down = e.key === 'j' || (inList && e.key === 'ArrowDown'), up = e.key === 'k' || (inList && e.key === 'ArrowUp');
    if (down || up) {
      e.preventDefault();
      const n = rows[at < 0 ? 0 : Math.max(0, Math.min(rows.length - 1, at + (down ? 1 : -1)))];
      select(n.dataset.k, { focus: true });
    } else if (e.key === 'Enter' && onSel && cur) {
      e.preventDefault();
      const b = cur.querySelector('.td-ract [data-primary]'), bill = cur.dataset.bill && billById(cur.dataset.bill);
      if (b) b.click(); else if (bill) S.go(billRoute(bill));
    } else if (e.key === 'o' && cur?.dataset.bill) { e.preventDefault(); quickLook(cur); }
    return;
  }
  const cards = [...document.querySelectorAll('.td-root .td-card')]; if (!cards.length) return;
  const cur = document.activeElement?.closest?.('.td-card');
  if (e.key === 'j' || e.key === 'k') {
    e.preventDefault();
    // No card has the focus (a click on the page background): go on from the remembered one. Half a step stands for
    // "between two cards", where a card that has gone used to be: j takes the one after, k the one before.
    let i = cards.indexOf(cur);
    if (i < 0 && S.tdCur) { const at = cards.findIndex(c => c.dataset.k === S.tdCur.key); i = at >= 0 ? at : Math.min(S.tdCur.i, cards.length) - .5; }
    const n = cards[e.key === 'j' ? Math.min(cards.length - 1, Math.floor(i + 1)) : Math.max(0, Math.ceil(i - 1))];
    n.focus({ preventScroll: true }); n.scrollIntoView({ block: 'nearest' });
  } else if (e.key === 'Enter' && cur && document.activeElement === cur) { e.preventDefault(); cur.querySelector('[data-primary]')?.click(); }
  else if (e.key === 'o' && cur) { if (cur.dataset.bill) { e.preventDefault(); quickLook(cur); } }
});

export default {
  tab: 'today',
  // The heading says whose list it is: "Today", "Team Today", "Kevin’s Today" (a phone shows it in the frame's header).
  title: () => heading(),
  // Today asks the frame for the whole window on every desktop width and then sets its own width in today.css: a
  // 1056px page as before up to 1600px, and a wider one above that, where a 1120px frame left 300px of dead gutter
  // on each side of a 1920px screen. It is done in CSS rather than here because the frame only redraws the page at
  // 900 and 1100px, so a JavaScript test for 1600 would be stale the moment the window was resized.
  wide: () => DESK(),
  // The Today tab's badge: my items overdue or due today; red when any is overdue.
  badge() { try { const r = todayItems('mine'); return { n: r.dueNow, late: r.late > 0 }; } catch (e) { console.error(e); return { n: 0, late: false }; } },
  render, wire,
};
