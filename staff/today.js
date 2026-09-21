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
import { S, DB, DEMO, SESSION_OVER, DEADLINES, esc, fmtDT, fmtDate, advocate, isMine, isMuted, capitolUrl, hooks } from './data.js';
import { draftFor, alertsToReview, alertTarget, billNum, blurb, roomShort, chairMail, attendees, streamOf, hearingAhead, stopOf, diedish, currentDeadline, gateName, legislativeDay, hstDayOf, unslack, billById, personName, OUTCOME_LABEL, sessionClock, suggestions, suggState, setSugg, SUGGEST_CAP } from './model.js';
import { icon, btn, iconBtn, chip, avatar, groupHead, segmented, empty, notice, toast, openSheet, closeSheet, pickerSheet, menuSheet, confirmSheet, field, keysOn, urgentMark } from './ui.js';
import { openLook } from './look.js';

const HR = 36e5, DAY = 864e5;
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
const DESK = () => mq('(min-width: 900px)');    // two columns: the list, and a side panel a manager scans
const WIDE = () => mq('(min-width: 1100px)');   // the frame's sidebar layout: the only place a five-day Week view fits

// ---- time ----
// "today 1:10 PM", "tomorrow 9:00 AM", else "Wed 3/18, 1:10 PM": staff should never have to work out the weekday.
export function whenLine(iso) {
  const t = new Date(iso).getTime(), d = hst(t), now = Date.now();
  const time = new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'Pacific/Honolulu' });
  return d === hst(now) ? `today ${time}` : d === hst(now + DAY) ? `tomorrow ${time}` : fmtDT(iso);
}
export const hearingLine = h => h ? `${esc(h.committee)} ${whenLine(h.scheduled_at)}${h.room ? ' · ' + esc(room(h.room)) : ''}` : '';
// Written testimony is due 24 hours before the hearing unless the notice says otherwise (Hawaiʻi rule).
export const testDue = h => h ? new Date(h.testimony_deadline || new Date(h.scheduled_at).getTime() - DAY).getTime() : null;
const span = ms => { const h = Math.abs(ms) / HR; return h < 1 ? `${Math.max(1, Math.round(Math.abs(ms) / 6e4))}m` : h < 48 ? `${Math.round(h)}h` : `${Math.round(h / 24)} days`; };
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

// ---- the model ----
// When a bill has several tasks, the earliest one leads the card; on a tie, the step closest to the Capitol wins.
const RANK = { file: 1, review: 2, review2: 2, revise: 3, submit: 4, write: 5, send: 6, fix: 7, email: 8, stale: 9, ask: 10, chair: 11, nodraft: 12, reply: 13, todo: 14, followup: 15, notice: 16, wait: 30 };
const TESTIMONY = new Set(['file', 'review', 'review2', 'revise', 'submit', 'write', 'stale', 'nodraft', 'wait']);
const byBill = () => { const m = new Map(); for (const h of S.hearings || []) { if (!m.has(h.bill_id)) m.set(h.bill_id, []); m.get(h.bill_id).push(h); } return m; };
export function hearingFor(d, idx) {
  const now = Date.now(), list = idx ? idx.get(d.bill_id) || [] : (S.hearings || []).filter(h => h.bill_id === d.bill_id);
  return (d.hearing_id && (S.hearings || []).find(h => h.id === d.hearing_id))
    || list.filter(h => h.committee === d.committee && h.status !== 'cancelled' && new Date(h.scheduled_at) > now).sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))[0] || null;
}
// A draft whose hearing ended more than two days ago is moot here (filing or approving can no longer help); the bill
// page still shows it. Without this, an old unfiled draft would sit in Overdue forever.
const moot = h => !!h && new Date(h.scheduled_at).getTime() < Date.now() - 2 * DAY;
const reviewers = () => {
  // Name the reviewer who signs off most often first: that is who is likeliest to pick it up.
  const n = id => Object.values(S.drafts || {}).flat().filter(d => d.second_approved_by === id).length;
  const list = S.advocates.filter(a => a.is_reviewer && a.is_active !== false).sort((a, b) => n(b.id) - n(a.id) || a.full_name.localeCompare(b.full_name));
  return list.map(a => a.full_name.split(' ')[0]).join(' or ') || 'a reviewer';
};
export const reviewerNames = reviewers;
const admins = (except = null) => S.advocates.filter(a => a.is_admin && a.is_active !== false && a.id !== except).map(a => a.full_name.split(' ')[0]).join(' or ');
export const adminNames = admins;
// One name when there is exactly one other admin, else "an admin" ("Nate or Jess sent it back" reads wrong).
const oneAdmin = (except = null) => { const a = admins(except); return a && !a.includes(' or ') ? a : 'an admin'; };
// Is this the bill's first testimony? Then a reviewer signs off too (the same test as testimony_transition).
export const needsSecond = d => d.status === 'second_review' || !!d.first_for_bill
  || (d.status === 'review' && !Object.values(S.drafts || {}).flat().some(x => x.bill_id === d.bill_id && x.id !== d.id && (['approved', 'filed'].includes(x.status) || x.second_approved_at)));

// The review queue (#/review): every draft waiting for my approval, then emails, whatever the scope and whatever the
// bill's position. Emails are never my own (alertsToReview leaves them out).
export function reviewQueue() {
  const me = S.me || {}, idx = byBill(), out = [];
  for (const d of Object.values(S.drafts || {}).flat()) {
    if (!((d.status === 'review' && me.is_admin) || (d.status === 'second_review' && me.is_reviewer))) continue;
    const b = billById(d.bill_id), h = hearingFor(d, idx); if (!b || moot(h)) continue;
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
function sandboxInbox() {
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
// The bills a view covers: mine (owned or followed, not muted), the whole team's, or one teammate's.
const billsOf = (scope, who) => scope === 'team' ? () => true : scope === 'person' ? b => hasBill(who, b) : b => isMine(b);
const teammates = () => S.advocates.filter(a => a.is_active !== false);

// todayItems('mine' | 'team' | 'person', who?) -> { groups: [{ id, title, cards, n }], cards, cluster, dueNow, late, tasks }
// Mine: my steps, plus what anyone can pick up on the bills I own or follow. Team: every bill, plus read-only rows for
// steps that wait on someone else. Person: one teammate's list, worked out the way their own Today would be from what
// is loaded for everyone (drafts, to-dos, follow-ups, emails). Their inbox is theirs alone, so replies and notices are
// not in it, and every step is read-only: it is theirs to take.
export function todayItems(scope = 'mine', who = null) {
  const viewer = S.me, now = Date.now(), team = scope === 'team';
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
      if (two ? me.is_reviewer : me.is_admin) {   // approvals: never filtered by scope or Monitor
        const who = d.submitted_by ? (subMe ? (self ? 'your own' : 'their own') : `${esc(first(d.submitted_by))}’s`) : 'the';
        const at = two ? d.approved_at : d.submitted_at, h0 = at ? (now - new Date(at)) / HR : null;
        push({ ...base, kind: two ? 'review2' : 'review', who: 'yours', why: h0 == null ? '' : `${two ? 'Approved' : 'Sent'} ${h0 < 1 ? 'just now' : h0 < 48 ? Math.round(h0) + 'h ago' : Math.round(h0 / 24) + ' days ago'}`,
          s: two ? `Give the second approval on ${who} testimony` : `Review ${who} ${subMe || !d.submitted_by ? c + ' ' : ''}testimony`,
          btns: [{ label: 'Review', href: `#/review/${encodeURIComponent(d.id)}`, review: true }] });
      } else if (team) wait(two ? reviewers() : admins(), two ? 'second approval' : 'approval', two ? '2nd approval' : 'In review', ids(a => two ? a.is_reviewer : a.is_admin));
      continue;
    }
    // Monitor bills are watched, not worked: the draft made automatically from each hearing notice stays off Today
    // until someone touches it (submits it, or gets it back with a note); after that it is real work.
    if (b.position === 'monitor' && !d.submitted_at && !d.review_note) continue;
    const mine = (ownMe || subMe) && !muted(b), open = !own(b) && !d.submitted_by && inScope(b);
    if (d.status === 'approved') {
      if (mine || open) push({ ...base, kind: 'file', who: mine ? 'yours' : 'anyone', s: mine && self ? 'File your testimony at the Capitol' : `File the ${c} testimony at the Capitol`,
        btns: [{ label: 'File at the Capitol', href: capitolUrl(b), ext: true }, { label: 'Mark filed', act: 'file' }] });
      else if (team) wait(first(d.submitted_by || own(b)), 'to file it', 'Approved', [d.submitted_by, own(b)]);   // either of them may file it
      continue;
    }
    // draft: sent back with a note, pulled back after submitting, or never submitted
    const k = d.review_note ? 'revise' : d.submitted_at ? 'submit' : 'write';
    if (mine || open || (k === 'revise' && subMe)) {
      const yours = mine && self ? 'your' : 'the', doc = d.doc_url ? { label: 'Open Doc', href: d.doc_url, ext: true } : null;
      // Who sent it back is not stored: an approved_by means it came back from second review, else from an admin.
      const others = admins(me.id), asked = d.approved_by ? 'a reviewer asked for changes' : others && !others.includes(' or ') ? `${others} asked for changes` : '';
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
    const ups = (idx.get(b.id) || []).filter(h => h.status !== 'cancelled' && new Date(h.scheduled_at) > now && new Date(h.scheduled_at) - now < 7 * DAY).sort((x, y) => x.scheduled_at.localeCompare(y.scheduled_at));
    if (!ups.length && b.priority !== 1) continue;
    if (diedish(b)) continue;
    const who = isOwner(b) ? 'yours' : 'anyone';
    for (const h of ups) {
      const dr = draftFor(b.id, h.committee), c = esc(h.committee);
      if (!dr) push({ kind: 'nodraft', key: `s:${b.id}:nd:${h.id}`, b, h, due: testDue(h), who, s: `No testimony draft yet for the ${c} hearing`,
        note: `It is made from the hearing notice within the hour. If it has not appeared, ${S.me.is_admin ? 'check that the notice email arrived' : 'tell ' + esc(oneAdmin())}.`, btns: [{ label: 'Open bill', href: `#/bill/${b.bill_number}`, text: true }] });
      else if (dr.status !== 'filed' && b.current_version && dr.version !== b.current_version) push({ kind: 'stale', key: `s:${b.id}:st:${dr.id}`, b, h, d: dr, due: testDue(h), who,
        s: `Check ${self && (isOwner(b) || dr.submitted_by === me.id) ? 'your' : 'the'} ${c} testimony: the bill is now ${esc(b.current_version)}`,
        note: `The draft was written for ${esc(dr.version || 'the introduced bill')}.`, btns: dr.doc_url ? [{ label: 'Open Doc', href: dr.doc_url, ext: true }] : [] });
      if (['strongly_support', 'strongly_oppose'].includes(b.position) && !(b.public_action || '').trim()) {
        const d = hst(h.scheduled_at), when = d === hst(now) ? 'today’s' : d === hst(now + DAY) ? 'tomorrow’s' : new Date(h.scheduled_at).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'Pacific/Honolulu' }) + '’s';
        push({ kind: 'ask', key: `s:${b.id}:ask`, b, h, due: new Date(h.scheduled_at).getTime(), who, s: `Write the public ask before ${when} hearing`,
          note: 'Until then the public page shows supporters only the official title.', btns: [{ label: 'Write it', href: `#/bill/${b.bill_number}/public` }] });
      }
    }
    if (!ups.length && b.priority === 1) {
      const st = stopOf(b);
      if (st.column === 'a' && st.deadline && !st.deadline.missed && st.deadline.days <= 14 && st.committee) {
        const m = chairMail(st.committee), days = st.deadline.days, two = m && m.n > 1;
        const body = `Aloha ${m ? m.who : 'Chair'},\n\nThe Hawaiʻi Public Health Institute asks you to schedule a hearing on ${b.bill_number}${blurb(b, 120) ? ` (${blurb(b, 120)})` : ''} before the ${st.deadline.label} deadline on ${fmtDate(st.deadline.date)}.\n\nMahalo,\n${(viewer.full_name || '').split(' ')[0]}`;
        push({ kind: 'chair', key: `s:${b.id}:chair`, b, st, due: new Date(st.deadline.date + 'T23:59:59-10:00').getTime(), who,
          s: `Ask the chair${two ? 's' : ''} for a hearing: ${days <= 0 ? 'the deadline is today' : plural(days, 'day') + ' left'}`,
          why: `${esc(st.deadline.label)} deadline ${fmtDate(st.deadline.date + 'T12:00:00-10:00', { weekday: 'short' }).replace(',', '')}${m ? ' · ' + esc(m.who) : ''}`,
          btns: m ? [{ label: `Email the chair${two ? 's' : ''}`, href: `mailto:${m.email}?subject=${encodeURIComponent('Request for a hearing on ' + b.bill_number)}&body=${encodeURIComponent(body)}`, ext: true, mail: true }]
            : [{ label: 'Open bill', href: `#/bill/${b.bill_number}` }] });
      }
    }
  }

  // ---- action alerts (emails to supporters) ----
  const toReview = new Set((self ? alertsToReview() : (S.alerts || []).filter(a => a.status === 'submitted' && me.is_admin && a.author_id !== me.id)).map(a => a.id));
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
    if (mine || (!t.assignee_id && inScope(b))) push({ ...base, kind: 'todo', who: mine ? 'yours' : 'anyone', s: esc(t.title), btns: [{ label: 'Done', act: 'todo' }] });
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
      why: plural(list.length, seen ? 'message' : 'new message'), btns: [{ label: 'Reply', href: `#/bill/${b.bill_number}/activity?reply=1`, seen: true }] });
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
      btns: b ? [{ label: 'Open', href: `#/bill/${b.bill_number}${tab ? '/' + tab : ''}`, read: true }] : [{ label: 'Mark done', act: 'read' }] });
  }

  // A teammate's steps are theirs to take: the buttons only open the thing the step is about.
  if (!self) for (const t of tasks) { t.ro = true;
    t.btns = t.b ? [{ label: 'Open bill', href: `#/bill/${t.b.bill_number}`, text: true }] : t.kind === 'followup' ? [{ label: 'Open their page', href: `#/person/${t.f.person_id}`, text: true }] : t.a ? [{ label: 'Open the email', href: `#/email/${t.a.id}`, text: true }] : []; }

  // ---- cards: one per bill ----
  // Two or more approvals waiting for me become one "Start review" card (review mode walks through them). A
  // teammate's approvals stay one card per bill: review mode is only ever my own queue.
  const revs = tasks.filter(t => t.kind === 'review' || t.kind === 'review2');
  let cluster = null, list = tasks;
  if (revs.length >= 2 && self) { cluster = revs.sort((x, y) => (x.due ?? Infinity) - (y.due ?? Infinity) || (x.b.priority || 9) - (y.b.priority || 9)); list = tasks.filter(t => !revs.includes(t)); }
  const eff = t => t.due ?? endOfToday();
  const cmp = (x, y) => (x.kind === 'wait') - (y.kind === 'wait') || eff(x) - eff(y) || x.rank - y.rank;
  const byKey = new Map();
  for (const t of list) { const k = t.b ? 'b:' + t.b.id : t.key; if (!byKey.has(k)) byKey.set(k, { key: k, b: t.b, tasks: [] }); byKey.get(k).tasks.push(t); }
  const cards = [...byKey.values()].map(c => { c.tasks.sort(cmp); c.p = c.tasks[0]; c.due = c.p.due; c.group = groupOf(c.p.due, now); c.wait = c.p.kind === 'wait'; c.seen = !!c.p.seen; return c; });
  if (cluster) { const due = Math.min(...cluster.map(t => t.due ?? Infinity)); cards.push({ key: 'cluster', cluster, due: Number.isFinite(due) ? due : null, group: groupOf(Number.isFinite(due) ? due : null, now), tasks: cluster }); }
  // Within a group: the review cluster, then by time; a message already seen sits below the new ones; waiting rows last.
  const ord = (x, y) => !!y.cluster - !!x.cluster || x.wait - y.wait || eff(x.p || x) - eff(y.p || y) || (!!x.seen - !!y.seen) || ((x.b?.priority || 9) - (y.b?.priority || 9)) || String(x.b?.bill_number || x.key).localeCompare(String(y.b?.bill_number || y.key), 'en', { numeric: true });
  const weight = c => c.cluster ? c.cluster.length : c.wait ? 0 : 1;
  const groups = GROUPS.map(([id, title]) => { const cs = cards.filter(c => c.group === id).sort(ord); return { id, title, cards: cs, n: cs.reduce((s, c) => s + (c.cluster ? c.cluster.length : 1), 0) }; }).filter(g => g.cards.length);
  const dueNow = cards.filter(c => c.group === 'overdue' || c.group === 'today').reduce((s, c) => s + weight(c), 0);
  const late = cards.filter(c => c.group === 'overdue').reduce((s, c) => s + weight(c), 0);
  return { groups, cards, cluster, dueNow, late, tasks };
}

// ---- What changed since yesterday: one line per bill, and opening it counts as read ----
const OUT = { passed: c => `Passed ${c}`, passed_amended: c => `Passed ${c} with amendments`, deferred: c => `Deferred by ${c}`, recommitted: c => `Sent back to ${c}` };
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
  return [clip(s.replace(/\.$/, ''), 90), 5];
}
export function digest(scope = 'mine') {
  const me = S.me, now = Date.now(); if (!me) return { label: 'yesterday', rows: [], keys: [] };
  // "Since yesterday", reaching back over a weekend: on a Monday it covers Friday too.
  let back = 1; const dow = t => new Date(hst(t) + 'T12:00:00-10:00').getUTCDay();
  while ([0, 6].includes(dow(now - back * DAY)) && back < 3) back++;
  const start = new Date(hst(now - back * DAY) + 'T00:00:00-10:00').getTime();
  const label = back === 1 ? 'yesterday' : new Date(now - back * DAY).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'Pacific/Honolulu' });
  const want = b => b && (scope === 'team' ? b.position && b.position !== 'monitor' : isMine(b) && (b.position !== 'monitor' || S.follows?.has(b.id)));
  const by = new Map(), add = (b, text, rank, at) => { if (!want(b)) return; const r = by.get(b.id) || { b, best: null, n: 0, msgs: 0, at: 0 }; r.n++; r.at = Math.max(r.at, at);
    if (!r.best || rank < r.best[1] || (rank === r.best[1] && at > r.best[2])) r.best = [text, rank, at]; by.set(b.id, r); };
  for (const e of S.recentEvents || []) { if (e.source && e.source !== 'auto') continue; const at = new Date(e.occurred_at).getTime(); if (at < start || at > now) continue;
    const [text, rank] = plainAction(e.title); add(billById(e.bill_id), text, rank, at); }
  for (const h of S.hearings || []) { const o = S.outcomes?.[h.id]; if (!o?.outcome) continue; const at = new Date(o.reported_at || h.scheduled_at).getTime(); if (at < start || at > now) continue;
    add(billById(h.bill_id), (OUT[o.outcome] || (c => `${o.outcome} in ${c}`))(h.committee), 0, at); }
  for (const [bid, msgs] of Object.entries(S.messages || {})) { const b = billById(bid), n = msgs.filter(m => m.advocate_id !== me.id && new Date(m.created_at).getTime() >= start).length;
    if (n && want(b)) { const r = by.get(bid) || { b, best: null, n: 0, msgs: 0, at: 0 }; r.msgs = n; r.at = Math.max(r.at, ...msgs.map(m => new Date(m.created_at).getTime())); by.set(bid, r); } }
  const rows = [...by.values()].sort((x, y) => (x.best ? x.best[1] : 9) - (y.best ? y.best[1] : 9) || (x.b.priority || 9) - (y.b.priority || 9) || y.at - x.at);
  return { label, rows, keys: (S.inbox || []).filter(i => !i.direct && i.unread).map(i => i.key) };
}

// ---- rendering ----
// Whose list. Mine and Team are remembered between visits, as before. One teammate's list is a look, not a setting:
// it lasts for this visit only (S.tdWho), so nobody opens the app tomorrow on Kevin's list by mistake.
function scopeOf() {
  S.tdScope ??= load('today_scope', 'mine') === 'team' ? 'team' : 'mine';
  if (S.tdWho && (S.tdWho === S.me?.id || !teammates().some(a => a.id === S.tdWho))) S.tdWho = null;
  return S.tdWho ? 'person' : S.tdScope;
}
const whoOf = () => scopeOf() === 'person' ? S.tdWho : null;
// The Week view lives in the address (#/?view=week&w=1), so it can be linked and reloaded; it only exists on a wide
// screen, and a phone that opens the link gets the list.
const viewOf = route => WIDE() && route?.q?.view === 'week' ? 'week' : 'list';
const weekOff = route => Math.max(-26, Math.min(26, parseInt(route?.q?.w, 10) || 0));
// The heading says whose list it is ("your Today" is what the app calls the list elsewhere).
const heading = () => { const s = scopeOf(); return s === 'person' ? `${first(S.tdWho)}’s Today` : s === 'team' ? 'Team Today' : 'Today'; };
let LAST = new Map();   // key -> task for the list on screen, so a click finds the record its button was drawn from

// One toolbar: the heading (desktop; a phone has it in the frame's header), the date and the next deadline, then the
// layout switch (wide screens) and whose list it is.
function toolbar(route) {
  const now = Date.now(), ld = legislativeDay(), g = currentDeadline(), scope = scopeOf(), who = scope === 'person' ? advocate(S.tdWho) : null;
  const day = new Date(now).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'Pacific/Honolulu' });
  const a = [day, ld ? (ld.today ? `Day ${ld.day} of ${ld.of}` : `Recess · day ${ld.day} of ${ld.of}`) : SESSION_OVER ? 'Between sessions' : ''].filter(Boolean).join(' · ');
  const when = g ? new Date(g.date + 'T12:00:00-10:00').toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric', timeZone: 'Pacific/Honolulu' }).replace(',', '') : '';
  // Mine | Team stays as it was. Inside Team, a picker narrows the list to one teammate ("Everyone" by default), so a
  // phone's toolbar keeps its width and the choice sits where the long list is. On a wide screen the side panel's
  // Team load does the same with one click, from any list.
  const seg = `<div class="sv-seg td-scope" role="group" aria-label="Whose tasks"><button type="button" data-seg="tdscope" data-val="mine" aria-pressed="${scope === 'mine'}">Mine</button><button type="button" data-seg="tdscope" data-val="team" aria-pressed="${scope !== 'mine'}">Everyone</button></div>`;
  const whoBtn = scope === 'mine' ? '' : `<div class="td-whorow"><button type="button" class="sv-pick td-whobtn" data-whopick aria-haspopup="dialog" aria-label="${esc(who ? `Showing ${who.full_name}’s list. Choose someone else` : 'Showing everyone. Choose one teammate')}">${who ? avatar(who, 24) : icon('users')}<span>${who ? esc(who.full_name) : 'Everyone'}</span>${icon('chevron-down', { cls: 'chev' })}</button></div>`;
  return `<div class="td-sub"><div class="td-head"><h1 class="td-h1">${esc(heading())}</h1>
      <p class="td-date"><span>${esc(a)}</span>${g ? `<span class="td-dl"><span class="td-sep" aria-hidden="true">·</span>Deadline ${esc(when)}: ${esc(gateName(g).replace(/^First /, '1st ').replace(/^Second /, '2nd '))}</span>` : ''}</p></div>
    <div class="td-tools">${WIDE() ? segmented('tdview', [['list', 'List'], ['week', 'Week']], viewOf(route), 'Layout') : ''}${seg}</div>${whoBtn}</div>`;
}
// At most one notice, most important first: the sync is stale or email is paused (admins), then the new-bill season.
function oneNotice() {
  const me = S.me || {};
  if (me.is_admin && !DEMO) {
    const lastOk = (S.syncRuns || []).find(r => r.ok)?.finished_at, failed = (S.syncRuns || [])[0]?.ok === false;
    const hrs = lastOk ? Math.round((Date.now() - new Date(lastOk)) / HR) : null;
    if (!SESSION_OVER && (failed || hrs == null || hrs > 36)) return notice('warn', 'triangle-alert', hrs == null ? 'The bill sync has not finished recently. Bills may be out of date.' : `The bill sync last finished ${hrs > 47 ? Math.round(hrs / 24) + ' days' : hrs + ' hours'} ago. Bills may be out of date.`, btn('Check', { kind: 'text', href: '#/setup/sync' }));
  }
  if (me.is_admin && S.emailCfg?.enabled === false) return notice('info', 'mail', 'Email is paused. You can write and approve; nothing sends.', btn('Turn on', { kind: 'text', href: '#/setup/email' }));
  if (S.tdTriage?.suggested || S.tdTriage?.undecided) { const n = S.tdTriage.suggested || S.tdTriage.undecided;
    return notice('info', 'sparkles', `<b>${plural(n, 'new bill')} to sort.</b>`, btn('Sort new bills', { kind: 'secondary', href: '#/bills/new' })); }
  // Getting started moved to Help; for the first 45 days a single row points there until it is dismissed.
  const age = me.created_at ? Date.now() - new Date(me.created_at).getTime() : Infinity;
  if (age < 45 * DAY && !load('newhere_done', '')) return notice('info', 'circle-help', 'New here? Read how the tracker works.', `${btn('Read it', { kind: 'text', href: '#/help' })}${iconBtn('x', 'Dismiss', { 'data-newhere': '1' })}`);
  return '';
}
// The opening weeks around the introduction cutoff are when new bills need a decision (the same window as app.js 1633).
const openWeeks = () => { const c = (DEADLINES.introduced || [])[0]; if (!c) return false; const cut = new Date(c[1] + 'T23:59:59-10:00').getTime(), now = Date.now(); return now > cut - 18 * DAY && now < cut + 3 * DAY; };

// The reason line: whose it is, the countdown, then where ("Yours · 4h left · HHS today 1:10 PM · Rm 225").
// In Mine everything unlabelled is yours, so only "Open to anyone" is said; Team says "Yours" too.
// `mark` says the card already leads with the urgency block, so the countdown is left out rather than said twice.
function why(t, team, mark = false) {
  const who = t.kind === 'wait' ? '' : t.who === 'anyone' ? 'Open to anyone' : team && !['reply', 'notice', 'email', 'fix', 'send'].includes(t.kind) ? 'Yours' : '';
  const due = t.kind === 'chair' ? '' : t.due != null ? (mark ? '' : cd(t.due)) : (t.kind === 'todo' || t.kind === 'followup') ? 'No due date' : '';
  const parts = [who, ...String(t.why || '').split(' · '), due, ...(t.h ? [`${esc(t.h.committee)} ${whenLine(t.h.scheduled_at)}`, t.h.room ? esc(room(t.h.room)) : ''] : [])].filter(Boolean);
  // Short parts never break inside ("Rm 225" stays together); a long one (two chairs' names) may wrap.
  return parts.map(x => `<span class="td-part${x.replace(/<[^>]+>/g, '').length > 28 ? ' long' : ''}">${x}</span>`).join(' · ');
}
// A bill is named by its nickname when HIPHI gave it one (every bill with a position has one), then the plain summary;
// a bill that is only monitored has just the summary. The number always shows, in front.
const SEEN = () => chip('Seen', '', 'eye');
const billName = (b, n = 140) => b.nickname ? `<b class="td-nick">${esc(b.nickname)}</b><span class="td-t td-t2">${esc(blurb(b, n))}</span>` : `<span class="td-t">${esc(blurb(b, n))}</span>`;
function button(t, x, primary) {
  const attrs = { 'data-k': t.key, ...(primary ? { 'data-primary': '1' } : {}), ...(x.act ? { 'data-act': x.act } : {}), ...(x.read ? { 'data-read': '1' } : {}), ...(x.seen ? { 'data-seen': '1' } : {}), ...(x.review ? { 'data-review': '1' } : {}) };
  // A message already seen is quieter: its Reply is an outline, so the new ones keep the one filled button.
  const kind = primary && !x.text ? (t.seen ? 'secondary' : 'primary') : 'text';
  if (x.href) return btn(esc(x.label), { kind, href: x.href, target: x.ext && !x.mail ? '_blank' : undefined, icon: kind === 'primary' ? x.icon : undefined, iconEnd: x.ext && !x.mail ? 'external-link' : undefined, attrs });
  return btn(esc(x.label), { kind, attrs });
}
function alsoRow(t, c) {
  const x = (t.btns || [])[0], inner = `<span class="td-also-t"><span class="td-also-l">Also:</span> ${t.s}</span>${t.seen ? SEEN() : ''}${t.due != null ? cd(t.due) : ''}${icon(x && x.ext && !x.mail ? 'external-link' : 'chevron-right', { cls: 'chev' })}`;
  const bill = c.b ? `#/bill/${c.b.bill_number}` : '';
  if (t.kind === 'wait' || !x) return bill ? `<a class="td-also" href="${esc(bill)}">${inner}</a>` : `<div class="td-also">${inner}</div>`;
  if (x.href) return `<a class="td-also" href="${esc(x.href)}" data-k="${esc(t.key)}"${x.read ? ' data-read="1"' : ''}${x.seen ? ' data-seen="1"' : ''}${x.review ? ' data-review="1"' : ''}${x.ext && !x.mail ? ' target="_blank" rel="noopener"' : ''}>${inner}</a>`;
  return `<button type="button" class="td-also" data-also="${esc(t.key)}">${inner}</button>`;
}
// The urgency block that leads a card (ui.js urgentMark), the current app's left rail. The wrapper keeps its width
// even when there is nothing to say, so every sentence on the page starts on the same line down the list.
const urgBlock = due => `<span class="td-urg">${urgentMark(due == null ? null : new Date(due).toISOString())}</span>`;
const lookBtn = b => iconBtn('chevron-right', `Quick look at ${billNum(b)}`, { 'data-look': '1' }, 'td-look');
function card(c, i, team) {
  if (c.cluster) {
    const bills = [...new Set(c.cluster.map(t => billNum(t.b).split(' ')[0]))];
    return `<article class="td-card td-cluster" data-k="cluster" tabindex="-1" aria-labelledby="td-s${i}">
      ${urgBlock(c.due)}
      <p class="td-s" id="td-s${i}">${icon('clipboard-check')}Review ${plural(c.cluster.length, 'testimony draft')}</p>
      <p class="td-why">${esc('Earliest first · ' + bills.slice(0, 6).join(', ') + (bills.length > 6 ? ` and ${bills.length - 6} more` : ''))}</p>
      <div class="td-acts">${btn('Start review', { href: '#/review', attrs: { 'data-primary': '1', 'data-review': '1' } })}</div></article>`;
  }
  const p = c.p, b = c.b, also = c.tasks.slice(1);
  const top = b ? `<a class="td-bill${b.nickname ? ' td-named' : ''}" href="#/bill/${esc(b.bill_number)}"><b class="td-num">${esc(billNum(b))}</b> ${b.priority === 1 ? '<span class="sv-p1">P1</span> ' : ''}${billName(b)}</a>`
    : p.kind === 'followup' ? `<a class="td-bill td-kind" href="#/person/${esc(p.f.person_id)}">${icon('user-round')}<span>Follow-up</span></a>`
    : p.a ? `<a class="td-bill td-kind" href="#/email/${esc(p.a.id)}">${icon('mail')}<span>Email to supporters</span></a>`
    : `<span class="td-bill td-kind">${icon('bell')}<span>From the tracker</span></span>`;
  const more = b || p.kind === 'followup' || p.a ? iconBtn('ellipsis', `More for ${b ? billNum(b) : 'this item'}`, { 'data-more': c.key }, 'td-more') : '';
  const acts = (p.btns || []).slice(0, 2).map((x, j) => button(p, x, j === 0)).join('');
  const shown = also.slice(0, 2), rest = also.length - shown.length;
  // A row that waits on someone else is quiet by design, so it keeps its small countdown and gets no block.
  return `<article class="td-card${c.wait ? ' td-wait' : ''}${p.seen ? ' td-seen' : ''}" data-k="${esc(c.key)}"${b ? ` data-bill="${esc(b.id)}" data-num="${esc(b.bill_number)}"` : ''} tabindex="-1" aria-labelledby="td-s${i}">
    ${urgBlock(c.wait ? null : p.due)}
    <div class="td-top">${top}${more}${b ? lookBtn(b) : ''}</div>
    <p class="td-s" id="td-s${i}">${p.s}</p>
    ${(() => { const w = why(p, team, !c.wait), lead = c.wait && p.chip ? chip(p.chip, '', 'hourglass') + ' ' : p.seen ? SEEN() + ' ' : ''; return w || lead ? `<p class="td-why">${lead}${w}</p>` : ''; })()}
    ${p.note ? `<p class="td-note">${p.note}</p>` : ''}
    ${p.q ? `<blockquote class="td-q">${p.q}</blockquote>` : ''}
    ${acts ? `<div class="td-acts">${acts}</div>` : ''}
    ${shown.map(t => alsoRow(t, c)).join('')}${rest > 0 && b ? `<a class="td-also" href="#/bill/${esc(b.bill_number)}"><span class="td-also-t">${plural(rest, 'more thing')} on this bill</span>${icon('chevron-right', { cls: 'chev' })}</a>` : ''}
  </article>`;
}
function nextHearingText(scope, who) {
  const now = Date.now(), mine = billsOf(scope, who), ok = b => b && b.position && b.position !== 'monitor' && mine(b);
  const h = (S.hearings || []).filter(x => x.status !== 'cancelled' && new Date(x.scheduled_at) > now && ok(billById(x.bill_id))).sort((x, y) => x.scheduled_at.localeCompare(y.scheduled_at))[0];
  if (h) return `Next hearing: ${esc(whenLine(h.scheduled_at))} (${esc(billNum(billById(h.bill_id)))}, ${esc(h.committee)}).`;
  return SESSION_OVER ? 'Hearings return when the next session opens.' : `No hearings are scheduled on ${scope === 'team' ? 'the team’s' : scope === 'person' ? esc(first(who)) + '’s' : 'your'} bills yet.`;
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

// ---- hearings: today's strip and the week ----
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
// The testimony for one hearing, and its state in a word and an icon (never colour alone).
const draftOf = h => (S.drafts?.[h.bill_id] || []).find(d => d.hearing_id && d.hearing_id === h.id && d.status !== 'cancelled') || draftFor(h.bill_id, h.committee) || null;
const T_STATE = { filed: ['Filed', 'ok', 'check'], approved: ['Approved', '', 'clipboard-check'], second_review: ['In review', '', 'hourglass'], review: ['In review', '', 'hourglass'], draft: ['Draft', '', 'pencil'] };
const stateChip = d => { const [l, tone, ic] = (d && T_STATE[d.status]) || ['No draft', '', 'circle-dashed']; return chip(l, tone, ic); };
// "Lauren is going", "You and Lauren are going": who is going to a hearing, you first; empty when nobody is. A sitting
// hears several bills and a person marks one of them, so the Week view passes everyone marked on any of its bills.
function goingOf(people) {
  const seen = new Set(), names = people.filter(a => a && !seen.has(a.id) && seen.add(a.id)).sort((x, y) => (y.id === S.me?.id) - (x.id === S.me?.id)).map(a => a.id === S.me?.id ? 'You' : a.full_name.split(' ')[0]);
  if (!names.length) return '';
  return `${names.length === 1 ? names[0] : names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1]} ${names.length === 1 && names[0] !== 'You' ? 'is' : 'are'} going`;
}
const goingLine = h => goingOf(attendees(h)) || 'No one yet';
const P1 = '<span class="sv-p1">P1</span>';
const shortName = (b, n = 80) => b.nickname ? `<b class="td-nick">${esc(b.nickname)}</b>` : `<span class="td-t">${esc(blurb(b, n))}</span>`;
// One side-panel look (and the same box for the strip on a phone): a titled white box with a count.
const panel = (id, ic, title, count, body, extra = '') => `<section class="td-panel td-p-${id}" aria-labelledby="td-p-${id}"><div class="td-ph"><h2 id="td-p-${id}">${icon(ic)}<span>${title}</span></h2>${extra}${count == null || count === '' ? '' : `<span class="n">${count}</span>`}</div>${body}</section>`;
const moreBtn = (key, open, n) => `<button type="button" class="td-pmore" data-fold="${key}" aria-expanded="${open}">${open ? 'Show fewer' : `Show all ${n}`}${icon(open ? 'chevron-up' : 'chevron-down')}</button>`;

// "Hearings today": every hearing today on the bills in view, whether or not the testimony is filed (a filed hearing
// used to vanish from Today, and with it who is going). Nothing today: no strip at all, never an empty box.
function hearingRow({ h, b, t }) {
  const o = S.outcomes?.[h.id]?.outcome, past = t < Date.now() - 2 * HR;
  return `<a class="td-hrow${past ? ' past' : ''}" href="#/bill/${esc(b.bill_number)}">
    <span class="td-htime">${esc(timeOf(h.scheduled_at))}</span>
    <span class="td-hbody"><span class="td-hbill${b.nickname ? '' : ' td-clamp'}"><b class="td-num">${esc(billNum(b))}</b>${b.priority === 1 ? P1 : ''} ${shortName(b)}</span>
      <span class="td-hline"><span class="td-hmeta">${esc(h.committee)} · ${esc(room(h.room))} · ${esc(o ? OUTCOME_LABEL[o] || o : goingLine(h))}</span><span class="sr">Testimony: </span>${stateChip(draftOf(h))}</span></span></a>`;
}
function hearingsToday(scope, who, cap) {
  const today = hst(Date.now()), hs = hearingsIn(today, today, scope, who);
  if (!hs.length) return '';
  const fold = hs.length > cap + 1, open = !fold || !!S.tdOpen?.hear;
  // Folded, the few rows shown are the ones still to come (late in a busy day the morning's hearings would fill them).
  const ahead = hs.filter(x => x.t >= Date.now() - 2 * HR), few = (ahead.length ? ahead : hs).slice(0, cap);
  return panel('hear', 'landmark', 'Hearings today', hs.length, `<div class="td-hrows">${(open ? hs : few).map(hearingRow).join('')}</div>${fold ? moreBtn('hear', open, hs.length) : ''}`);
}

// ---- the side panel (900px and wider): what a manager scans while the list is worked ----
// "This week": for each working day, the hearings (sittings, not bills: Wednesday used to say 9 above two hearings)
// and the bills whose testimony is still due that day, counted from weekOf exactly as the Week view draws them, so the
// two never disagree (R-025). A weekend row only when it has something.
function weekPanel(scope, who, r) {
  const now = Date.now(), today = hst(now), mon = mondayOf(now), week = weekOf(mon, scope, who, r), days = [...week.keys()];
  const count = d => { const c = week.get(d); return [c.hs.size, [...c.dl.values()].reduce((n, g) => n + g.rows.length, 0)]; };
  const rows = days.slice(0, 5).map(d => ({ d, label: `${dayFmt(d, { weekday: 'short' })} ${dayFmt(d, { day: 'numeric' })}`, n: count(d) }));
  const wk = [5, 6].map(i => count(days[i])).reduce((a, x) => [a[0] + x[0], a[1] + x[1]], [0, 0]);
  if (wk[0] || wk[1]) rows.push({ d: days[5], label: 'Weekend', n: wk, wkend: true });
  const num = n => n ? `<b>${n}</b>` : '<span class="muted">0</span>';
  const body = `<table class="td-wk"><thead><tr><th scope="col">Day</th><th scope="col" class="num">Hearings</th><th scope="col" class="num">Testimony due</th></tr></thead><tbody>${rows.map(x => {
    const isToday = !x.wkend && x.d === today, past = !x.wkend && x.d < today;
    return `<tr class="${isToday ? 'today' : past ? 'past' : ''}"${isToday ? ' aria-current="date"' : ''}><th scope="row">${esc(x.label)}${isToday ? ' <span class="td-now">Today</span>' : ''}</th><td class="num">${num(x.n[0])}</td><td class="num">${num(x.n[1])}</td></tr>`; }).join('')}</tbody></table>`;
  return panel('week', 'calendar-days', 'This week', '', body, WIDE() ? `<a class="td-plink" href="#/?view=week">Week view</a>` : '');
}
// "Waiting on others": the quiet hourglass steps, summed up. Team: all of them. Mine or one person's: the ones on
// their bills, their drafts and their emails that wait on somebody else.
function waitingPanel(scope, who, r) {
  const tr = scope === 'team' ? r : todayItems('team'), mine = billsOf(scope, who), subj = scope === 'person' ? who : S.me.id;
  const ws = tr.tasks.filter(t => t.kind === 'wait' && (scope === 'team' || (((t.b && mine(t.b)) || t.d?.submitted_by === subj || t.a?.author_id === subj) && !(t.on || []).includes(subj))))
    .sort((x, y) => (x.due ?? Infinity) - (y.due ?? Infinity) || x.rank - y.rank);
  if (!ws.length) return '';
  const cap = 5, fold = ws.length > cap + 1, open = !fold || !!S.tdOpen?.waits;
  const row = t => `<a class="td-wrow" href="${t.b ? `#/bill/${esc(t.b.bill_number)}` : t.a ? `#/email/${esc(t.a.id)}` : '#/'}"><span class="td-wt">${t.b ? `<b class="td-num">${esc(billNum(t.b))}</b> ` : ''}<span>${t.ws || t.s}</span></span>${t.due != null ? cd(t.due) : ''}</a>`;
  return panel('waits', 'hourglass', 'Waiting on others', ws.length, `<div class="td-wrows">${(open ? ws : ws.slice(0, cap)).map(row).join('')}</div>${fold ? moreBtn('waits', open, ws.length) : ''}`);
}
// "Team load": open cards for each teammate, as their own Today would count them (a review cluster counts each draft).
const openCount = r => r.cards.reduce((s, c) => s + (c.wait ? 0 : c.cluster ? c.cluster.length : 1), 0);
function teamLoad() {
  return teammates().map(a => { const r = a.id === S.me.id ? todayItems('mine') : todayItems('person', a.id); return { a, n: openCount(r), late: r.late }; });
}
function loadPanel() {
  const rows = teamLoad().sort((x, y) => y.n - x.n || x.a.full_name.localeCompare(y.a.full_name)), max = Math.max(1, ...rows.map(x => x.n)), who = whoOf(), scope = scopeOf();
  const body = `<div class="td-loads">${rows.map(({ a, n, late }) => { const me = a.id === S.me.id, on = me ? scope === 'mine' : who === a.id;
    return `<button type="button" class="td-load" data-who="${esc(a.id)}" aria-pressed="${on}" title="${esc(me ? 'Show my list' : `Show ${a.full_name}’s list`)}">${avatar(a, 24)}<span class="td-ln"><span>${esc(me ? 'You' : a.full_name)}</span>${late ? `<span class="sv-count late">${icon('circle-alert')}${late} overdue</span>` : ''}</span><span class="td-lbar" aria-hidden="true"><i style="width:${Math.round(n / max * 100)}%"></i></span><span class="td-lc">${n}<span class="sr"> open</span></span></button>`; }).join('')}</div>`;
  return panel('load', 'users', 'Team load', '', body, '<span class="td-phint">Open cards</span>');
}

// ---- the session clock (model.js sessionClock) ----
// The one portfolio number that earns a place on Today. The last line is not a statistic: bills with no hearing as
// a deadline closes are the work, so it is a button that opens them as suggestions in the list (Nate, 9/19). The
// five-bucket breakdown stays on Bills. Off-season sessionClock() returns null and the panel is not drawn at all.
const clockBills = (scope, who) => S.bills.filter(billsOf(scope, who));
// When none of the bills in view races any deadline still ahead, sessionClock() falls back to the next one on the
// calendar with nothing racing it. That used to read "0 bills must be heard by then. Every one of them has a hearing."
const whoseBills = (scope, who) => scope === 'person' ? `${first(who)}’s bills` : scope === 'team' ? 'the team’s bills' : 'your bills';
const ckDay = d => new Date(d + 'T12:00:00-10:00').toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric', timeZone: 'Pacific/Honolulu' }).replace(',', '');   // "Thu 3/19"
function clockPanel(scope, who) {
  const c = sessionClock(clockBills(scope, who));
  if (!c) return '';
  const when = ckDay(c.date);
  const away = c.days <= 0 ? 'today' : c.days === 1 ? 'tomorrow' : `${plural(c.days, 'day')} away`;
  const n = c.noHearing.length, on = !!S.tdOpen?.sugg && S.tdSuggOnly === 'clock';
  const heard = c.racing === 1 ? 'It has a hearing.' : c.racing === 2 ? 'Both have a hearing.' : 'Every one of them has a hearing.';
  const body = `<div class="td-ck">
    <p class="td-ckwhen"><b>${esc(when)}</b><span>${esc(away)}</span></p>
    <p class="td-cklab">${esc(c.name)}</p>
    <p class="td-ckn">${esc(c.racing ? `${plural(c.racing, 'bill')} must be heard by then.` : `None of ${whoseBills(scope, who)} has to be heard by then.`)}</p>
    ${n ? `<button type="button" class="td-ckwork" data-clockwork aria-expanded="${on}">${icon('circle-dashed')}<span class="td-ckwt"><b>${esc(plural(n, 'bill'))} with no hearing yet</b><span>${esc(c.p1 ? `${c.p1} of them P1 · ` : '')}Show what could be done</span></span>${icon('chevron-right', { cls: 'chev' })}</button>`
      : c.racing ? `<p class="td-ckok">${icon('check')}<span>${heard}</span></p>` : ''}
  </div>`;
  return panel('clock', 'calendar-clock', 'Next deadline', '', body);
}
// The side panel is written as two rails. Below 1600px today.css drops the rails (display:contents) and the panels
// stack in one column as they always did; above it they become two columns, so the week sits beside the list rather
// than a screen's length below it. Only the near rail's first panel is sticky (.sv-stick): on a narrower screen the
// two rails stack, and a second sticky panel would slide over the first.
const stick = html => html.replace('class="td-panel', 'class="td-panel sv-stick');
const rail = (sticky, ...panels) => { const list = panels.filter(Boolean); return list.length ? `<div class="td-rail">${sticky ? stick(list[0]) : list[0]}${list.slice(1).join('')}</div>` : ''; };

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

// The clock's button filters the section to the bills it counted (`only`). Uncapped first, so the note can say which
// of them are not shown and why; model.js makes at most one suggestion per bill, so a card is a bill.
function suggestFor(scope, who, r) {
  const clock = S.tdSuggOnly === 'clock' ? sessionClock(clockBills(scope, who)) : null;
  const only = clock?.noHearing.length ? clock.noHearing : null;
  // A bill with a dated card today is already on the list; it must never also be a suggestion.
  const dated = new Set(r.cards.filter(c => c.b && (c.group === 'overdue' || c.group === 'today')).map(c => c.b.id));
  const all = suggestions(only || clockBills(scope, who), { cap: only ? Infinity : SUGGEST_CAP, skip: b => dated.has(b.id) });
  return { only, clock, dated, all, list: all.slice(0, SUGGEST_CAP) };
}
// "HB1", "HB1 and HB2", "HB1, HB2 and HB3", "HB1, HB2 and 4 others".
const billList = bs => { const ns = bs.map(billNum); return ns.length > 3 ? `${ns.slice(0, 2).join(', ')} and ${ns.length - 2} others` : ns.join(', ').replace(/, ([^,]+)$/, ' and $1'); };
// On a teammate's list the cards are read-only (ro): Done, Not now and Not this bill are theirs to answer, and they
// would be written into your own settings besides. The step's own button only opens something, so it stays.
function sugCard(s, i, ro = false) {
  const ext = !!s.act.ext, mail = /^mailto:/i.test(s.act.href || '');
  return `<article class="td-sg${ro ? ' td-sgro' : ''}" data-sg="${esc(s.key)}" data-bill="${esc(s.b.id)}" aria-labelledby="td-sg${i}">
    <div class="td-top"><a class="td-bill${s.b.nickname ? ' td-named' : ''}" href="#/bill/${esc(s.b.bill_number)}"><b class="td-num">${esc(billNum(s.b))}</b> ${s.b.priority === 1 ? P1 + ' ' : ''}${billName(s.b)}</a>${lookBtn(s.b)}</div>
    <p class="td-s" id="td-sg${i}">${esc(s.title)}</p>
    <p class="td-sgwhy">${esc(s.why)}</p>
    <div class="td-acts">${btn(esc(s.act.label), { kind: 'secondary', href: s.act.href, target: ext && !mail ? '_blank' : undefined, iconEnd: ext && !mail ? 'external-link' : undefined })}</div>
    ${ro ? '' : `<div class="td-sgctl" role="group" aria-label="${esc('What to do with this suggestion for ' + billNum(s.b))}">
      <button type="button" data-sgdo="done" data-sgk="${esc(s.key)}">${icon('check')}<span>Done</span></button>
      <button type="button" data-sgdo="later" data-sgk="${esc(s.key)}">${icon('clock')}<span>Not now</span></button>
      <button type="button" data-sgdo="never" data-sgk="${esc(s.key)}">${icon('circle-x')}<span>Not this bill</span></button>
    </div>`}</article>`;
}
function suggestHtml(scope, who, r) {
  const { only, clock, dated, all, list } = suggestFor(scope, who, r), ro = !!who;
  // A teammate's list has no suggestions of its own (see render); only the clock's button, pressed on purpose, shows
  // theirs. If its bills have all been heard since, there is nothing to show.
  if (ro && !only) { LASTSG = new Map(); return ''; }
  LASTSG = new Map(ro ? [] : list.map(s => [s.key, s]));
  if (!list.length && !only) return '';
  const open = S.tdOpen ??= {};
  // On a quiet day the section is the point of the page, so it is open and says so. On a busy one it is a quiet
  // line under the work, folded, but always one click away: nothing here is ever hidden behind a busy day.
  const quiet = r.dueNow <= 2, shown = quiet || !!open.sugg;
  // Opened from the clock, the section takes the button's own words and count. On a quiet day the cards it shows can
  // be the very ones that were already there, and a heading that stayed the same made the tap look dead (9/21).
  const title = only ? 'No hearing yet' : quiet ? 'Nothing urgent — good ways to spend an hour' : 'Also worth doing', n = only ? only.length : list.length;
  const head = quiet ? groupHead(esc(title), only ? n : '', { id: 'td-g-sugg' }) : groupHead(esc(title), n, { fold: 'sugg', open: shown, id: 'td-g-sugg' });
  // Every bill the button counted is accounted for: a card, already on today's list, or nothing to suggest now.
  const onList = only ? only.filter(b => dated.has(b.id)) : [], withSugg = new Set(all.map(s => s.b.id));
  const nothing = only ? only.filter(b => !dated.has(b.id) && !withSugg.has(b.id)) : [];
  const why = only ? [`${only.length === 1 ? 'It has' : 'Each has'} to be heard by ${ckDay(clock.date)}.`,
    onList.length ? `${billList(onList)} ${onList.length === 1 ? 'is' : 'are'} on today’s list above.` : '',
    nothing.length ? `Nothing to suggest on ${billList(nothing)} right now.` : '',
    all.length > list.length ? `Showing ${list.length} of ${all.length}.` : ''].filter(Boolean).join(' ') : '';
  const note = only
    ? `<p class="td-sgnote">${icon('circle-dashed')}<span>${esc(why)}</span>${ro ? '' : btn('Show all suggestions', { kind: 'text', attrs: { 'data-sgall': '1' } })}</p>`
    : `<p class="td-sgnote"><span>Nothing here is on the clock. Each one says why it came up, so you can wave it off if it is already in hand.</span></p>`;
  const body = list.map((s, i) => sugCard(s, i, ro)).join('');
  return `<section class="td-group td-sugg" aria-labelledby="td-g-sugg"><h2 class="td-h">${head}</h2>
    ${shown ? `<div class="td-sglist">${note}${body}</div>` : ''}</section>`;
}
async function suggDo(key, state, el) {
  const s = LASTSG.get(key); if (!s) return;
  const before = { ...suggState() };
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

// ---- the Week view (1100px and wider only): what each day holds, in time order (R-025, 9/21) ----
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
const WK_ICON = { email: 'mail', fix: 'mail', send: 'send', followup: 'user-round', todo: 'list-todo', ask: 'megaphone', chair: 'mail', wait: 'hourglass', review: 'clipboard-check', review2: 'clipboard-check', nodraft: 'file-text', stale: 'triangle-alert', write: 'pencil', submit: 'pencil', revise: 'pencil', file: 'clipboard-check' };
// "today's", "tomorrow's", "Wed's": the hearing a deadline is for, said the way a person would.
const whoseDay = (day, now) => day === hst(now) ? 'today’s' : day === hst(now + DAY) ? 'tomorrow’s' : dayFmt(day, { weekday: 'short' }) + '’s';
// Only the public ask has a time of its own (its hearing's start); every other step without a testimony deadline is
// due on a day, or whenever, and goes under "Also to do".
const wkTimed = t => t.kind === 'ask' && !!t.b && t.due != null;

// One week, day by day (Mon..Sun): the testimony deadlines (dl, one card per sitting), the sittings heard (hs) and the
// other steps. An open step sits on the day it is due; overdue and undated ones belong to today, as in the list, so
// nothing open is off the grid. The side panel's "This week" counts from this too.
function weekOf(mon, scope, who, r) {
  const now = Date.now(), today = hst(now), ok = billsOf(scope, who), days = [0, 1, 2, 3, 4, 5, 6].map(i => dayAdd(mon, i));
  const wk = new Map(days.map(d => [d, { dl: new Map(), hs: new Map(), other: [] }]));
  for (const x of hearingsIn(mon, days[6], scope, who)) { const hs = wk.get(x.day).hs, k = slotKey(x.h); if (!hs.has(k)) hs.set(k, []); hs.get(k).push(x); }
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
function wkBill(b, right, owners) {
  const own = owners ? avatar(advocate((S.assignments[b.id] || [])[0]), 20) : '';
  return `<li><a class="wk-bill${b.position === 'monitor' ? ' wk-mon' : ''}" href="#/bill/${esc(b.bill_number)}"><span class="wk-b1"><b class="td-num">${esc(billNum(b))}</b>${b.priority === 1 ? P1 : ''}${right ? `<span class="wk-right">${right}</span>` : ''}</span><span class="wk-b2"><span class="wk-name">${esc(b.nickname || blurb(b, 80))}</span>${own}</span></a></li>`;
}
// "1:00 PM", or "Sun 3:00 PM" in the weekend column, which holds two days.
const wkWhen = (t, wkend) => (wkend ? dayFmt(hst(t), { weekday: 'short' }) + ' ' : '') + timeOf(new Date(t).toISOString());
function wkDeadline(g, owners, now, wkend) {
  const ms = g.due - now, late = ms <= 0, soon = !late && ms <= DAY, what = `for ${whoseDay(hst(new Date(g.h.scheduled_at).getTime()), now)} ${g.h.committee} hearing`;
  const head = late ? 'Testimony\u00a0overdue' : `${wkWhen(g.due, wkend)} · Testimony\u00a0due`;
  const when = late ? `was due ${dayFmt(hst(g.due), { weekday: 'short' })} ${timeOf(new Date(g.due).toISOString())}` : hst(g.due) === hst(now) ? `in ${span(ms)}` : '';
  const rows = g.rows.sort((x, y) => x.st[2] - y.st[2] || x.b.bill_number.localeCompare(y.b.bill_number, 'en', { numeric: true }))
    .map(x => wkBill(x.b, `<span class="sr">Testimony: </span>${chip(x.st[0], '', x.st[1])}`, owners)).join('');
  return `<section class="wk-blk wk-dl${late ? ' late' : soon ? ' soon' : ''}" data-at="${g.due}" aria-label="${esc(`${head}${when ? ', ' + when : ''}, ${what}`)}">
    <p class="wk-bh">${icon(late ? 'circle-alert' : 'clock')}<b>${esc(head)}</b></p>
    <p class="wk-bs">${when ? `<span class="wk-when">${esc(when)}</span> · ` : ''}${esc(what)}</p>
    <ul class="wk-bills">${rows}</ul>${g.filed ? `<p class="wk-filed">${icon('check')}${esc(`${g.filed} more already filed`)}</p>` : ''}</section>`;
}
function wkHearing(list, owners, now, wkend) {
  const h = list[0].h, past = list[0].t < now - 2 * HR, when = wkWhen(list[0].t, wkend);
  const rows = list.map(x => { const o = S.outcomes?.[x.h.id]?.outcome; return wkBill(x.b, past && o ? chip(OUTCOME_LABEL[o] || o) : '', owners); }).join('');
  // A hearing that is over needs nothing from anyone, so it keeps its place in the day as one quiet line that opens to
  // its bills and what happened to them. Drawn in full, the morning's hearings pushed the afternoon's overdue testimony
  // below the fold, and their pale boxes looked like deadline cards (review, 9/21).
  if (past) return `<details class="wk-blk wk-hr wk-held" data-at="${list[0].t}"><summary>${icon('landmark')}<span class="wk-heldt"><b>${esc(when)} · Hearing\u00a0held</b> · ${esc(h.committee)} · ${esc(plural(list.length, 'bill'))}</span>${icon('chevron-down', { cls: 'chev' })}</summary><ul class="wk-bills">${rows}</ul></details>`;
  // Who is going, only when someone is (Nate, 9/21).
  const going = goingOf(list.flatMap(x => attendees(x.h)));
  return `<section class="wk-blk wk-hr" data-at="${list[0].t}" aria-label="${esc(`Hearing, ${when}, ${h.committee}, ${room(h.room)}${going ? '. ' + going : ''}`)}">
    <p class="wk-bh">${icon('landmark')}<b>${esc(when)} · Hearing</b></p>
    <p class="wk-bs">${esc(h.committee)} · ${esc(room(h.room))}</p>${going ? `<p class="wk-bs wk-going">${icon('users')}<span>${esc(going)}</span></p>` : ''}
    <ul class="wk-bills">${rows}</ul></section>`;
}
// A step with a time of its own (the public ask, due when its hearing starts) takes its place in the day's order.
const wkStep = (t, wkend) => `<a class="wk-oth wk-timed" data-at="${t.due}" href="#/bill/${esc(t.b.bill_number)}">${icon(WK_ICON[t.kind] || 'list-todo')}<span class="wk-ot"><b>${esc(wkWhen(t.due, wkend))}</b> · <b class="td-num">${esc(billNum(t.b))}</b> ${t.s}</span></a>`;
// Everything else that day, one row per bill (the first step leads, the rest are counted). Messages are not calendar
// items: they fold into one row that opens the list, where they are answered (Nate, 9/21).
function wkAlso(all, now, wkend) {
  const msg = t => t.kind === 'reply' || t.kind === 'notice', msgs = all.filter(msg), per = new Map();
  for (const t of all) { if (msg(t)) continue; const k = t.b ? 'b' + t.b.id : t.key; if (!per.has(k)) per.set(k, []); per.get(k).push(t); }
  const rows = [...per.values()].map(g => {
    const t = g[0], more = g.length - 1, href = t.b ? `#/bill/${t.b.bill_number}` : t.kind === 'followup' ? `#/person/${t.f.person_id}` : t.a ? `#/email/${t.a.id}` : '';
    const late = t.due != null && t.due < now, day = wkend && t.due != null ? `<b>${esc(dayFmt(hst(t.due), { weekday: 'short' }))}</b> · ` : '';
    const inner = `${icon(WK_ICON[t.kind] || 'list-todo')}<span class="wk-ot">${day}${t.b ? `<b class="td-num">${esc(billNum(t.b))}</b> ` : ''}${t.s}${late ? ` <span class="sv-count late">overdue</span>` : ''}${more ? ` <span class="wk-more">+${more} more</span>` : ''}</span>`;
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
  const label = off === 0 ? 'This week' : off === 1 ? 'Next week' : off === -1 ? 'Last week' : `Week of ${dayFmt(mon, { month: 'short', day: 'numeric' })}`;
  const range = `${dayFmt(mon, { month: 'short', day: 'numeric' })} to ${dayFmt(days[4], dayFmt(mon, { month: 'short' }) === dayFmt(days[4], { month: 'short' }) ? { day: 'numeric' } : { month: 'short', day: 'numeric' })}`;
  // Team: how the week's bills heard fall across owners, and one click to see only that person's week.
  const heard = all.flatMap(c => [...c.hs.values()].flat());
  let byWho = '';
  if (scope === 'team' && heard.length) {
    const n = new Map(); for (const x of heard) { const o = (S.assignments[x.b.id] || [])[0] || ''; n.set(o, (n.get(o) || 0) + 1); }
    byWho = `<div class="td-wwho" role="group" aria-label="Bills heard this week, by owner"><span class="td-wwlab">Bills heard, by owner</span>${[...n.entries()].filter(([id]) => id && advocate(id)).sort((x, y) => y[1] - x[1]).map(([id, k]) => `<button type="button" class="td-wchip" data-who="${esc(id)}" title="${esc(id === S.me.id ? 'Show my week' : `Show ${advocate(id).full_name}’s week`)}">${avatar(advocate(id), 20)}<span>${esc(id === S.me.id ? 'You' : first(id))}</span><b>${k}</b></button>`).join('')}${n.get('') ? `<span class="td-wchip td-wnone">${avatar(null, 20)}<span>No owner</span><b>${n.get('')}</b></span>` : ''}</div>`;
  }
  // The week's line names what it counts: sittings and the bills in them, and the bills whose testimony is still due.
  const nSit = all.reduce((n, c) => n + c.hs.size, 0), nDue = all.reduce((n, c) => n + [...c.dl.values()].reduce((m, g) => m + g.rows.length, 0), 0);
  const sum = [nSit ? `${plural(nSit, 'hearing')} (${plural(heard.length, 'bill')})` : 'No hearings', nDue ? `testimony due for ${plural(nDue, 'bill')}` : ''].filter(Boolean).join(' · ');
  return `<div class="td-wnav"><h2 class="td-wtitle">${esc(label)}${Math.abs(off) > 1 ? '' : `<span class="td-wrange">${esc(range)}</span>`}</h2>
      <div class="td-wbtns">${iconBtn('chevron-left', 'Previous week', { 'data-week': off - 1 })}${off ? btn('This week', { kind: 'text', attrs: { 'data-week': 0 } }) : ''}${iconBtn('chevron-right', 'Next week', { 'data-week': off + 1 })}</div>
      <p class="td-wsum">${esc(sum)}</p></div>
    ${byWho}<div class="td-weekgrid${weN ? ' hasweekend' : ''}">${days.slice(0, 5).map(dayHtml).join('')}${weN ? weekend() : ''}</div>`;
}

function render(route) {
  if (!S.me) return empty({ title: 'No staff record yet', text: 'You are signed in, but the tracker does not know who you are. Ask your admin to add you.' });
  const scope = scopeOf(), who = whoOf(), desk = DESK(), r = todayItems(scope, who), name = who ? first(who) : '';
  LAST = new Map(r.tasks.map(t => [t.key, t]));
  // Async loads, each once: audience counts for the emails in the list, and the new-bill counts in the opening weeks.
  S.tdAud ??= {};
  for (const t of r.tasks) if (t.a && S.tdAud[t.a.id] === undefined) { S.tdAud[t.a.id] = null; DB.alertAudience(t.a.bill_id, t.a.list_id, t.a.segment_id).then(n => { S.tdAud[t.a.id] = n; if (S.route?.name === 'today') hooks.render(); }).catch(() => {}); }
  if (openWeeks() && !S.tdTriage && !S.tdTriageLoading) { S.tdTriageLoading = true; DB.triageCounts().then(c => { S.tdTriage = c || {}; if (S.route?.name === 'today') hooks.render(); }).catch(() => { S.tdTriage = {}; }); }
  if (viewOf(route) === 'week') return `<div class="td-root td-weekroot">${toolbar(route)}${oneNotice()}${weekView(route, scope, who, r)}</div>`;
  const open = S.tdOpen ??= { later: false, digest: false };
  // Beside a side panel the quiet "waiting" cards live in it ("Waiting on others"), so the list is only what someone
  // in view can act on. A phone has no panel and keeps them in the Team list, as before.
  const count = cs => cs.reduce((s, c) => s + (c.cluster ? c.cluster.length : 1), 0);
  const groups = desk ? r.groups.map(g => { const cs = g.cards.filter(c => !c.wait); return { ...g, cards: cs, n: count(cs) }; }).filter(g => g.cards.length) : r.groups;
  let i = 0;
  const clear = !groups.some(g => g.id === 'overdue' || g.id === 'today');
  const groupHtml = g => {
    const fold = g.id === 'later', isOpen = !fold || open.later;
    const title = g.id === 'overdue' ? `${icon('circle-alert', { cls: 'td-late' })}Overdue` : esc(g.title);
    return `<section class="td-group" aria-labelledby="td-g-${g.id}"><h2 class="td-h">${groupHead(title, g.n, { fold: fold ? 'later' : undefined, open: isOpen, id: 'td-g-' + g.id })}</h2>
      ${isOpen ? `<div class="td-list">${g.cards.map(c => card(c, i++, scope === 'team')).join('')}</div>` : ''}</section>`;
  };
  const dg = scope === 'person' ? { rows: [] } : digest(scope), dgOpen = open.digest;
  const digestHtml = dg.rows.length ? `<section class="td-group td-dig" aria-labelledby="td-g-dig"><h2 class="td-h">${groupHead(`What changed since ${esc(dg.label)}`, plural(dg.rows.length, 'bill'), { fold: 'digest', open: dgOpen, id: 'td-g-dig' })}</h2>
    ${dgOpen ? `<div class="rows td-digrows">${dg.rows.slice(0, 40).map(x => `<a class="row td-dr" href="#/bill/${esc(x.b.bill_number)}/activity"><span class="body"><span class="title"><b class="td-num">${esc(billNum(x.b))}</b> ${esc(x.best ? x.best[0] : 'New messages')}${x.n > 1 ? `<span class="td-more-n"> · ${plural(x.n - 1, 'more update')}</span>` : ''}</span></span>${x.msgs ? `<span class="end">${icon('message-square')}${plural(x.msgs, 'message')}</span>` : ''}</a>`).join('')}${dg.rows.length > 40 ? `<p class="td-dmore small muted">And ${dg.rows.length - 40} more bills. Each bill’s Activity tab has the full record.</p>` : ''}</div>` : ''}</section>` : '';
  // A teammate's list is for looking: say so once, and say what it cannot include.
  const note = who ? `<p class="td-whonote">${icon('info')}<span>${esc(name)} has ${plural(openCount(r), 'open card')}. They are ${esc(name)}’s to take, so the buttons here only open things. Messages and notices sent to ${esc(name)} are not shown.</span></p>` : '';
  const allClear = who ? `Nothing is waiting on ${esc(name)}.` : 'All clear for today.';
  let body;
  if (!groups.length) body = `<div class="td-empty">${empty({ art: who ? '' : yay(), title: allClear, text: nextHearingText(scope, who), action: who ? btn('Back to my list', { kind: 'secondary', attrs: { 'data-seg': 'tdscope', 'data-val': 'mine' } }) : btn(scope === 'team' ? 'See all bills' : 'See your bills', { href: '#/bills' }) })}</div>`;
  else body = (clear ? `<div class="td-clear">${who ? '' : yay()}<div><p class="td-clear-t">${who ? `Nothing for ${esc(name)} today.` : 'All clear for today.'}</p><p class="small muted">${nextHearingText(scope, who)}</p></div></div>` : '') + groups.map(groupHtml).join('');
  // Suggestions sit under the dated work and above the digest, and only for your own list: nobody should be handed
  // ideas for someone else's bills from a screen that is read-only. The one exception is asked for: the deadline
  // clock's button on a teammate's list shows their bills with no hearing yet, read-only. Without it the button was
  // drawn there and did nothing when pressed (Nate, 9/21).
  const sugg = who && S.tdSuggOnly !== 'clock' ? (LASTSG = new Map(), '') : suggestHtml(scope, who, r);
  // A phone has no rail, and the list has to start above the fold: the subline already names the next deadline, so
  // the clock sits under the work, right where the button it carries opens the suggestions.
  if (!desk) return `<div class="td-root">${toolbar(route)}${note}${oneNotice()}${hearingsToday(scope, who, 3)}${body}${clockPanel(scope, who)}${sugg}${digestHtml}</div>`;
  // Two rails: the near one is what is happening now, the far one is the week and the team. Below 1600px today.css
  // flattens them back into one column, so the order down the page is the same.
  return `<div class="td-root td-desk">${toolbar(route)}<div class="sv-cols td-cols"><div class="td-main">${note}${oneNotice()}${body}${sugg}${digestHtml}</div>
    <aside class="sv-aside td-aside" aria-label="At a glance">${rail(true, clockPanel(scope, who), hearingsToday(scope, who, 5))}${rail(false, weekPanel(scope, who, r), waitingPanel(scope, who, r), loadPanel())}</aside></div></div>`;
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
      const who = admins(S.me.id);
      toast(who ? `Sent to ${who} for review.` : 'Sent for review. It is waiting in your review queue.', { ok: true, undo: async () => { await DB.transition(b.id, t.d.id, 'withdraw'); toast('Pulled back to draft.'); redraw(); } });
      redraw(); });
    case 'file': return fileSheet(b, t.d);
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
      const a = t.a, n = S.tdAud?.[a.id], paused = S.emailCfg?.enabled === false;
      const ok = await confirmSheet({ title: `Send to ${n != null ? plural(n, 'person', 'people') : 'the followers'}?`, ok: 'Send',
        text: `${esc(a.subject)}<br><span class="small muted">It goes out from ${esc(advocate(a.author_id)?.email || 'your address')} and cannot be taken back.${paused ? ' Email is paused, so nothing leaves until an admin turns it back on.' : ''}</span>` });
      if (!ok) return;
      return busy(el, async () => { const r = await DB.alertStep(a.id, 'send'); toast(`Sent to ${plural(r?.recipients ?? n ?? 0, 'person', 'people')}.`, { ok: true }); redraw(); });
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
// The ⋯ menu on a card: the bill's everyday actions, in one place.
function moreMenu(c) {
  const p = c.p, b = c.b, me = S.me;
  if (!b) {
    if (p.kind === 'followup') return menuSheet({ title: 'Follow-up', items: [
      { label: 'Open their page', icon: 'user-round', run: later(() => S.go(`#/person/${p.f.person_id}`)) },
      p.p.email ? { label: 'Email them', icon: 'mail', sub: p.p.email, run: () => { location.href = `mailto:${p.p.email}`; } } : null,
      p.p.phone ? { label: 'Call', icon: 'phone', sub: p.p.phone, run: () => { location.href = `tel:${p.p.phone}`; } } : null] });
    if (p.a) return menuSheet({ title: 'Email to supporters', items: [{ label: 'Open the email', icon: 'mail', run: later(() => S.go(`#/email/${p.a.id}`)) }] });
    return;
  }
  const num = billNum(b), h = c.tasks.map(t => t.h).find(x => x && new Date(x.scheduled_at) > Date.now() - 4 * HR) || hearingAhead(b);
  const going = h && attendees(h).some(a => a.id === me.id), others = h ? attendees(h).filter(a => a.id !== me.id).map(a => a.full_name.split(' ')[0]) : [];
  const stream = h ? streamOf(h) : null, owner = (S.assignments[b.id] || [])[0] || null, ahead = hearingAhead(b), muted = isMuted(b);
  // Mark done clears what only needed reading: a notice, or a message that needs no reply. A message that was opened
  // and not answered stays on Today marked "Seen"; Mark unread makes it loud again.
  const notes = c.tasks.filter(t => t.kind === 'notice' || t.kind === 'reply'), reply = c.tasks.find(t => t.kind === 'reply');
  menuSheet({ title: esc(num), items: [
    { label: 'Open bill', icon: 'scroll-text', run: later(() => S.go(`#/bill/${b.bill_number}`)) },
    { label: 'Reply in chat', icon: 'message-square', run: later(() => { if (reply) markSeen(reply.keys); S.go(`#/bill/${b.bill_number}/activity?reply=1`); }) },
    h ? { label: going ? 'I’m not going after all' : 'I’m going to the hearing', icon: going ? 'user-round' : 'user-check', sub: `${h.committee} ${whenLine(h.scheduled_at)}${others.length ? ' · ' + others.join(', ') + (others.length === 1 ? ' is' : ' are') + ' going' : ''}`,
      run: async () => { try { await DB.attend(h.id, !going); toast(!going ? `You’re going to the ${h.committee} hearing ${whenLine(h.scheduled_at)}.` : `Taken off the list for the ${h.committee} hearing.`, { ok: !going, undo: async () => { await DB.attend(h.id, going); redraw(); } }); redraw(); } catch (e) { toast(e, { err: true }); } } } : null,
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
function setWho(id, refocus) {
  if (id === S.me?.id) { S.tdWho = null; S.tdScope = 'mine'; save('today_scope', 'mine'); }
  else S.tdWho = whoOf() === id ? null : id;   // the same person again: back to where you were
  S.tdCur = null; S.tdSuggOnly = null; S.tdRefocus = refocus || '[data-whopick]'; hooks.render();
}
function pickWho() {
  const rows = teamLoad().filter(x => x.a.id !== S.me.id).sort((x, y) => x.a.full_name.localeCompare(y.a.full_name));
  pickerSheet({ title: 'Whose list', value: whoOf() || 'all', help: 'Open cards for each teammate, counted the way their own Today counts them.',
    options: [['all', 'Everyone', 'users', 'The whole team’s list'], ...rows.map(({ a, n, late }) => [a.id, a.full_name, 'user-round', n ? `${plural(n, 'open card')}${late ? ` · ${late} overdue` : ''}` : 'Nothing open'])],
    onPick: id => { if (id === 'all') { S.tdWho = null; S.tdScope = 'team'; save('today_scope', 'team'); } else S.tdWho = id; S.tdCur = null; S.tdSuggOnly = null; S.tdRefocus = '[data-whopick]'; hooks.render(); } });
}

function wire(route, root) {
  const main = root.querySelector('.td-root'); if (!main) return;
  main.querySelectorAll('[data-seg="tdscope"]').forEach(el => el.onclick = () => { S.tdWho = null; S.tdScope = el.dataset.val; save('today_scope', S.tdScope); S.tdCur = null; S.tdSuggOnly = null; S.tdRefocus = `.td-scope [data-val="${S.tdScope}"]`; hooks.render(); });
  // List or Week swaps the page in place (no new history entry: Back still leaves Today, as it always has).
  main.querySelectorAll('[data-seg="tdview"]').forEach(el => el.onclick = () => { S.tdRefocus = `[data-seg="tdview"][data-val="${el.dataset.val}"]`; S.go(el.dataset.val === 'week' ? '#/?view=week' : '#/', { replace: true }); });
  main.querySelectorAll('[data-week]').forEach(el => el.onclick = () => { const w = +el.dataset.week || 0; S.tdRefocus = `[aria-label="${el.getAttribute('aria-label') || 'Next week'}"]`; S.go(`#/?view=week${w ? '&w=' + w : ''}`, { replace: true, keepScroll: true }); });
  main.querySelector('[data-whopick]')?.addEventListener('click', pickWho);
  main.querySelectorAll('[data-who]').forEach(el => el.onclick = () => setWho(el.dataset.who, `[data-who="${el.dataset.who}"]`));
  main.querySelectorAll('[data-fold]').forEach(el => el.onclick = () => {
    const k = el.dataset.fold, open = S.tdOpen ??= {}; open[k] = !open[k];
    // Opening the digest is reading it: every official update it stands for counts as read.
    if (k === 'digest' && open[k]) { const keys = digest(scopeOf()).keys; if (keys.length) DB.inboxMark(keys).catch(() => {}); }
    if (k === 'sugg' && !open[k]) S.tdSuggOnly = null;   // folding it away also drops the deadline clock's filter
    S.tdRefocus = `[data-fold="${k}"]`; hooks.render();
  });
  // Opening a message does not clear it any more: it is marked Seen and stays until it is answered or marked done.
  main.querySelectorAll('[data-seen]').forEach(el => el.addEventListener('click', () => { const t = LAST.get(el.dataset.k); if (t?.keys) markSeen(t.keys); }));
  // A notice only needs reading, so opening what it is about clears it.
  main.querySelectorAll('[data-read]').forEach(el => el.addEventListener('click', () => { const t = LAST.get(el.dataset.k); const keys = t?.i ? [t.i.key] : []; if (keys.length) DB.inboxMark(keys).catch(() => {}); }));
  // Into review mode: a fresh queue, and any Undo toast from this page goes (its step is now under review).
  main.querySelectorAll('[data-review]').forEach(el => el.addEventListener('click', () => { S.tdRev = null; const t = document.getElementById('toast'); if (t) t.innerHTML = ''; }));
  main.querySelectorAll('button[data-act]').forEach(el => el.onclick = () => { const t = LAST.get(el.dataset.k); if (t) run(t, el.dataset.act, el); });
  main.querySelectorAll('[data-also]').forEach(el => el.onclick = () => { const t = LAST.get(el.dataset.also); if (t) alsoMenu(t); });
  main.querySelectorAll('[data-look]').forEach(el => el.onclick = () => quickLook(el.closest('[data-bill]')));
  // The deadline clock's last line is the work it names: it opens those bills as suggestions, here, not a filtered
  // Bills screen (Nate, 9/19). Pressing it again closes them. Opening takes the focus and the view to what it opened:
  // on a desktop that is in the other column, often a screen further down, and it has to be unmistakable that the
  // press did something (DESIGN.md A-16). Closing leaves the focus on the button, where the person still is.
  main.querySelector('[data-clockwork]')?.addEventListener('click', () => {
    const open = S.tdOpen ??= {}, on = !!open.sugg && S.tdSuggOnly === 'clock';
    S.tdSuggOnly = on ? null : 'clock'; open.sugg = !on;
    if (on) { S.tdRefocus = '[data-clockwork]'; hooks.render(); return; }
    hooks.render();
    const sec = document.querySelector('.td-sugg'), h = document.getElementById('td-g-sugg');
    if (!sec) return;
    if (h && h.tagName !== 'BUTTON') h.tabIndex = -1;   // a quiet day's heading is not a button; it still takes the focus
    h?.focus({ preventScroll: true });
    sec.scrollIntoView({ block: 'start', behavior: mq('(prefers-reduced-motion: reduce)') ? 'auto' : 'smooth' });
  });
  main.querySelector('[data-sgall]')?.addEventListener('click', () => { S.tdSuggOnly = null; S.tdRefocus = '.td-sugg .td-bill'; hooks.render(); });
  main.querySelectorAll('[data-sgdo]').forEach(el => el.onclick = () => suggDo(el.dataset.sgk, el.dataset.sgdo, el));
  main.querySelectorAll('[data-more]').forEach(el => el.onclick = () => { const r = todayItems(scopeOf(), whoOf()), c = r.cards.find(x => x.key === el.dataset.more); if (c) moreMenu(c); });
  if (main.querySelector('.td-yay')) save('allclear', hst(Date.now()));
  main.querySelector('[data-newhere]')?.addEventListener('click', () => { save('newhere_done', '1'); hooks.render(); });
  // Keep the place. A control that redrew the page gets its focus back. Otherwise the card j/k (or a click) was last on
  // does: after a step redraws the list, and after a trip to a bill and back, the next j goes on from there, not from
  // the top (assessment 9/19). When that card is gone, the one that took its place is next.
  const idle = !document.activeElement || document.activeElement === document.body || document.activeElement.id === 'main';
  if (S.tdRefocus) { const el = main.querySelector(S.tdRefocus); S.tdRefocus = null; el?.focus({ preventScroll: true }); }
  else if (S.tdCur && idle && !document.querySelector('dialog[open]')) { const cards = [...main.querySelectorAll('.td-card')], c = cards.find(x => x.dataset.k === S.tdCur.key) || cards[Math.min(S.tdCur.i, cards.length - 1)]; c?.focus({ preventScroll: true }); }
}
// The card that last had the focus (its key, and its position for when it is gone). Focus inside a sheet does not count;
// focus that moves to another part of the page (the toolbar, the side panel, search) gives the place up.
document.addEventListener('focusin', e => {
  if (S.route?.name !== 'today' || !e.target?.closest || e.target.closest('dialog')) return;
  const c = e.target.closest('.td-root .td-card');
  if (c) S.tdCur = { key: c.dataset.k, i: [...document.querySelectorAll('.td-root .td-card')].indexOf(c) };
  else if (e.target.id !== 'main') S.tdCur = null;
});

// Desktop keys (listed in Help, never shown or bound on touch screens, and off when My settings says so): j/k move
// between cards, Enter runs the card's button, o takes a quick look at the bill (the modal's Open full page still
// goes to the page). None of them changes anything by itself.
document.addEventListener('keydown', e => {
  if (S.route?.name !== 'today' || !HOVER() || !keysOn() || e.metaKey || e.ctrlKey || e.altKey || typing(e.target) || document.querySelector('dialog[open]')) return;
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
