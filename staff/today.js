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
import { S, DB, DEMO, SESSION_OVER, DEADLINES, esc, fmtDT, fmtDate, advocate, isMine, isOwner, isMuted, capitolUrl, hooks } from './data.js';
import { draftFor, alertsToReview, alertTarget, billNum, blurb, roomShort, chairMail, attendees, streamOf, hearingAhead, stopOf, diedish, currentDeadline, gateName, legislativeDay, hstDayOf, unslack, billById, personName } from './model.js';
import { icon, btn, iconBtn, chip, groupHead, segmented, empty, notice, toast, openSheet, closeSheet, pickerSheet, menuSheet, confirmSheet, field } from './ui.js';

const HR = 36e5, DAY = 864e5;
const hst = t => hstDayOf(t);
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

// todayItems('mine' | 'team') -> { groups: [{ id, title, cards, n }], cards, cluster, dueNow, late }
// Mine: my steps, plus what anyone can pick up on the bills I own or follow. Team: every bill, plus read-only rows for
// steps that wait on someone else.
export function todayItems(scope = 'mine') {
  const me = S.me, now = Date.now(), team = scope === 'team';
  const empty0 = { groups: [], cards: [], cluster: null, dueNow: 0, late: 0, tasks: [] };
  if (!me) return empty0;
  sandboxInbox();
  const idx = byBill(), tasks = [], inScope = b => team || isMine(b);
  const push = t => { t.rank = RANK[t.kind] || 20; tasks.push(t); };
  const own = b => (S.assignments[b.id] || [])[0] || null;

  // ---- testimony drafts ----
  for (const d of Object.values(S.drafts || {}).flat()) {
    if (d.status === 'cancelled' || d.status === 'filed') continue;
    const b = billById(d.bill_id); if (!b) continue;
    const h = hearingFor(d, idx); if (moot(h)) continue;
    const due = testDue(h), c = esc(d.committee), subMe = !!d.submitted_by && d.submitted_by === me.id, ownMe = isOwner(b);
    const base = { b, d, h, due, key: `d:${d.id}` };
    if (d.status === 'review' || d.status === 'second_review') {
      const two = d.status === 'second_review';
      if (two ? me.is_reviewer : me.is_admin) {   // approvals: never filtered by scope or Monitor
        const who = d.submitted_by ? (subMe ? 'your own' : `${esc(first(d.submitted_by))}’s`) : 'the';
        const at = two ? d.approved_at : d.submitted_at, h0 = at ? (now - new Date(at)) / HR : null;
        push({ ...base, kind: two ? 'review2' : 'review', who: 'yours', why: h0 == null ? '' : `${two ? 'Approved' : 'Sent'} ${h0 < 1 ? 'just now' : h0 < 48 ? Math.round(h0) + 'h ago' : Math.round(h0 / 24) + ' days ago'}`,
          s: two ? `Give the second approval on ${who} testimony` : `Review ${who} ${subMe || !d.submitted_by ? c + ' ' : ''}testimony`,
          btns: [{ label: 'Review', href: `#/review/${encodeURIComponent(d.id)}`, review: true }] });
      } else if (team) push({ ...base, kind: 'wait', key: `w:${d.id}`, s: `Waiting for ${esc(two ? reviewers() : admins())}: ${two ? 'second approval' : 'approval'}`, chip: two ? '2nd approval' : 'In review' });
      continue;
    }
    // Monitor bills are watched, not worked: the draft made automatically from each hearing notice stays off Today
    // until someone touches it (submits it, or gets it back with a note); after that it is real work.
    if (b.position === 'monitor' && !d.submitted_at && !d.review_note) continue;
    const mine = (ownMe || subMe) && !isMuted(b), open = !own(b) && !d.submitted_by && inScope(b);
    if (d.status === 'approved') {
      if (mine || open) push({ ...base, kind: 'file', who: mine ? 'yours' : 'anyone', s: mine ? 'File your testimony at the Capitol' : `File the ${c} testimony at the Capitol`,
        btns: [{ label: 'Mark filed', act: 'file' }, { label: 'File at the Capitol', href: capitolUrl(b), ext: true }] });
      else if (team) push({ ...base, kind: 'wait', key: `w:${d.id}`, s: `Waiting for ${esc(first(d.submitted_by || own(b)))} to file it`, chip: 'Approved' });
      continue;
    }
    // draft: sent back with a note, pulled back after submitting, or never submitted
    const k = d.review_note ? 'revise' : d.submitted_at ? 'submit' : 'write';
    if (mine || open || (k === 'revise' && subMe)) {
      const yours = mine ? 'your' : 'the', doc = d.doc_url ? { label: 'Open Doc', href: d.doc_url, ext: true } : null;
      // Who sent it back is not stored: an approved_by means it came back from second review, else from an admin.
      const others = admins(me.id), asked = d.approved_by ? 'a reviewer asked for changes' : others && !others.includes(' or ') ? `${others} asked for changes` : '';
      push({ ...base, kind: k, who: mine ? 'yours' : 'anyone',
        s: k === 'write' ? `Write testimony for the ${c} hearing` : k === 'submit' ? `Submit ${yours} ${c} testimony for review` : `Revise ${yours} ${c} testimony${asked ? ': ' + esc(asked) : ''}`,
        q: k === 'revise' ? esc(d.review_note) : '',
        btns: k === 'submit' ? [{ label: 'Submit for review', act: 'submit' }, doc].filter(Boolean)
          : [doc, { label: k === 'revise' ? 'Resubmit' : 'Submit for review', act: 'submit' }].filter(Boolean) });
    } else if (team) push({ ...base, kind: 'wait', key: `w:${d.id}`, s: `Waiting for ${esc(first(own(b) || d.submitted_by))}: ${k === 'revise' ? 'revising' : 'writing'}`, chip: k === 'revise' ? 'Sent back' : 'Draft' });
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
        s: `Check ${isOwner(b) || dr.submitted_by === me.id ? 'your' : 'the'} ${c} testimony: the bill is now ${esc(b.current_version)}`,
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
        const body = `Aloha ${m ? m.who : 'Chair'},\n\nThe Hawaiʻi Public Health Institute asks you to schedule a hearing on ${b.bill_number}${blurb(b, 120) ? ` (${blurb(b, 120)})` : ''} before the ${st.deadline.label} deadline on ${fmtDate(st.deadline.date)}.\n\nMahalo,\n${(me.full_name || '').split(' ')[0]}`;
        push({ kind: 'chair', key: `s:${b.id}:chair`, b, st, due: new Date(st.deadline.date + 'T23:59:59-10:00').getTime(), who,
          s: `Ask the chair${two ? 's' : ''} for a hearing: ${days <= 0 ? 'the deadline is today' : plural(days, 'day') + ' left'}`,
          why: `${esc(st.deadline.label)} deadline ${fmtDate(st.deadline.date + 'T12:00:00-10:00', { weekday: 'short' }).replace(',', '')}${m ? ' · ' + esc(m.who) : ''}`,
          btns: m ? [{ label: `Email the chair${two ? 's' : ''}`, href: `mailto:${m.email}?subject=${encodeURIComponent('Request for a hearing on ' + b.bill_number)}&body=${encodeURIComponent(body)}`, ext: true, mail: true }]
            : [{ label: 'Open bill', href: `#/bill/${b.bill_number}` }] });
      }
    }
  }

  // ---- action alerts (emails to supporters) ----
  const toReview = new Set(alertsToReview().map(a => a.id));
  for (const a of S.alerts || []) {
    const b = a.bill_id ? billById(a.bill_id) : null, n = S.tdAud?.[a.id], tgt = esc(alertTarget(a)), base = { a, b, due: null, key: `a:${a.id}` };
    if (a.status === 'submitted' && toReview.has(a.id)) push({ ...base, kind: 'email', who: 'yours', s: `Approve ${esc(first(a.author_id))}’s email to ${n != null ? plural(n, 'supporter') : 'the followers of ' + tgt}`,
      why: `“${esc(clip(a.subject, 60))}”`, btns: [{ label: 'Review', href: `#/review/email-${a.id}`, review: true }] });
    else if (a.author_id === me.id && a.status === 'returned') push({ ...base, kind: 'fix', who: 'yours', s: `Fix your email: ${esc(oneAdmin(me.id))} sent it back`,
      q: esc(a.review_note || ''), why: `“${esc(clip(a.subject, 60))}”`, btns: [{ label: 'Edit email', href: `#/email/${a.id}` }] });
    else if (a.author_id === me.id && a.status === 'approved') push({ ...base, kind: 'send', who: 'yours', s: `Send your approved email to ${n != null ? plural(n, 'person', 'people') : 'the followers of ' + tgt}`,
      why: `“${esc(clip(a.subject, 60))}”`, btns: [{ label: 'Send', act: 'send' }] });
    else if (team && a.status === 'submitted') push({ ...base, kind: 'wait', key: `w:a${a.id}`, s: `Waiting for ${esc(oneAdmin(a.author_id))}: approval of ${esc(first(a.author_id))}’s email`, chip: 'Email' });
    else if (team && a.status === 'approved') push({ ...base, kind: 'wait', key: `w:a${a.id}`, s: `Waiting for ${esc(first(a.author_id))} to send the email`, chip: 'Email' });
  }

  // ---- to-dos: mine, or unassigned on my bills; the team's show as waiting ----
  for (const [bid, arr] of Object.entries(S.todos || {})) for (const t of arr) {
    if (t.done) continue;
    const b = billById(bid); if (!b) continue;
    const mine = t.assignee_id === me.id || (!t.assignee_id && isOwner(b)), base = { b, t, due: dateDue(t.due_date), key: `td:${t.id}` };
    if (mine || (!t.assignee_id && inScope(b))) push({ ...base, kind: 'todo', who: mine ? 'yours' : 'anyone', s: esc(t.title), btns: [{ label: 'Done', act: 'todo' }] });
    else if (team && t.assignee_id) push({ ...base, kind: 'wait', key: `w:t${t.id}`, s: `Waiting for ${esc(first(t.assignee_id))}: ${esc(lowerFirst(t.title))}`, chip: 'To do' });
  }

  // ---- my follow-ups with supporters ----
  for (const f of S.followups || []) {
    if (f.done_at || f.advocate_id !== me.id) continue;
    const p = f.person || {}, name = p.name || (p.email ? personName(p) : 'a supporter');
    push({ kind: 'followup', key: `fu:${f.id}`, f, p, b: null, due: dateDue(f.due), who: 'yours', s: `Follow up with ${esc(name)}: ${esc(lowerFirst(f.what || ''))}`,
      btns: [{ label: 'Done', act: 'fu' }, p.phone ? { label: 'Call', href: `tel:${p.phone}`, ext: true, mail: true } : p.email ? { label: 'Email', href: `mailto:${p.email}`, ext: true, mail: true } : null].filter(Boolean) });
  }

  // ---- the inbox's "Needs you": replies and mentions, then notices ----
  const unread = (S.inbox || []).filter(i => i.direct && i.unread);
  const msgBy = new Map();
  for (const i of unread) if (i.kind === 'message' && i.bill_id && billById(i.bill_id)) { if (!msgBy.has(i.bill_id)) msgBy.set(i.bill_id, []); msgBy.get(i.bill_id).push(i); }
  const mention = body => new RegExp(`@(${(me.initials || '').replace(/\W/g, '')}|${(me.full_name || '').split(' ')[0].replace(/\W/g, '')})\\b`, 'i').test(body || '');
  for (const [bid, list] of msgBy) {
    const b = billById(bid), latest = list.slice().sort((x, y) => String(y.at).localeCompare(String(x.at)))[0];
    const m = (S.messages?.[bid] || []).find(x => 'm:' + x.id === latest.key);
    if (m && m.advocate_id === me.id) continue;
    const name = m ? first(m.advocate_id) : String(latest.title || 'Someone').replace(/\s+wrote$/, '').split(' ')[0];
    const r = replyLine(name, latest.body || m?.body || '', mention(latest.body) && !isMine(b));
    push({ kind: 'reply', key: `m:${bid}`, b, due: null, who: 'yours', s: r.s, q: r.more ? esc(unslack(latest.body || '')) : '', keys: list.map(i => i.key), from: name,
      why: plural(list.length, 'new message'), btns: [{ label: 'Reply', href: `#/bill/${b.bill_number}/activity?reply=1`, read: true }] });
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

  // ---- cards: one per bill ----
  // Two or more approvals waiting for me become one "Start review" card (review mode walks through them).
  const revs = tasks.filter(t => t.kind === 'review' || t.kind === 'review2');
  let cluster = null, list = tasks;
  if (revs.length >= 2) { cluster = revs.sort((x, y) => (x.due ?? Infinity) - (y.due ?? Infinity) || (x.b.priority || 9) - (y.b.priority || 9)); list = tasks.filter(t => !revs.includes(t)); }
  const eff = t => t.due ?? endOfToday();
  const cmp = (x, y) => (x.kind === 'wait') - (y.kind === 'wait') || eff(x) - eff(y) || x.rank - y.rank;
  const byKey = new Map();
  for (const t of list) { const k = t.b ? 'b:' + t.b.id : t.key; if (!byKey.has(k)) byKey.set(k, { key: k, b: t.b, tasks: [] }); byKey.get(k).tasks.push(t); }
  const cards = [...byKey.values()].map(c => { c.tasks.sort(cmp); c.p = c.tasks[0]; c.due = c.p.due; c.group = groupOf(c.p.due, now); c.wait = c.p.kind === 'wait'; return c; });
  if (cluster) { const due = Math.min(...cluster.map(t => t.due ?? Infinity)); cards.push({ key: 'cluster', cluster, due: Number.isFinite(due) ? due : null, group: groupOf(Number.isFinite(due) ? due : null, now), tasks: cluster }); }
  const ord = (x, y) => !!y.cluster - !!x.cluster || x.wait - y.wait || eff(x.p || x) - eff(y.p || y) || ((x.b?.priority || 9) - (y.b?.priority || 9)) || String(x.b?.bill_number || x.key).localeCompare(String(y.b?.bill_number || y.key), 'en', { numeric: true });
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
const scopeOf = () => (S.tdScope ??= load('today_scope', 'mine') === 'team' ? 'team' : 'mine');
let LAST = new Map();   // key -> task for the list on screen, so a click finds the record its button was drawn from

function subline() {
  const now = Date.now(), ld = legislativeDay(), g = currentDeadline();
  const day = new Date(now).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'Pacific/Honolulu' });
  const a = [day, ld ? (ld.today ? `Day ${ld.day} of ${ld.of}` : `Recess · day ${ld.day} of ${ld.of}`) : SESSION_OVER ? 'Between sessions' : ''].filter(Boolean).join(' · ');
  const when = g ? new Date(g.date + 'T12:00:00-10:00').toLocaleDateString('en-US', { weekday: 'short', month: 'numeric', day: 'numeric', timeZone: 'Pacific/Honolulu' }).replace(',', '') : '';
  return `<div class="td-sub"><p class="td-date"><span>${esc(a)}</span>${g ? `<span class="td-dl"><span class="td-sep" aria-hidden="true">·</span>Deadline ${esc(when)}: ${esc(gateName(g).replace(/^First /, '1st ').replace(/^Second /, '2nd '))}</span>` : ''}</p>
    ${segmented('tdscope', [['mine', 'Mine'], ['team', 'Team']], scopeOf(), 'Whose tasks')}</div>`;
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
function why(t, team) {
  const who = t.kind === 'wait' ? '' : t.who === 'anyone' ? 'Open to anyone' : team && !['reply', 'notice', 'email', 'fix', 'send'].includes(t.kind) ? 'Yours' : '';
  const due = t.kind === 'chair' ? '' : t.due != null ? cd(t.due) : (t.kind === 'todo' || t.kind === 'followup') ? 'No due date' : '';
  const parts = [who, ...String(t.why || '').split(' · '), due, ...(t.h ? [`${esc(t.h.committee)} ${whenLine(t.h.scheduled_at)}`, t.h.room ? esc(room(t.h.room)) : ''] : [])].filter(Boolean);
  // Short parts never break inside ("Rm 225" stays together); a long one (two chairs' names) may wrap.
  return parts.map(x => `<span class="td-part${x.replace(/<[^>]+>/g, '').length > 28 ? ' long' : ''}">${x}</span>`).join(' · ');
}
function button(t, x, primary) {
  const attrs = { 'data-k': t.key, ...(primary ? { 'data-primary': '1' } : {}), ...(x.act ? { 'data-act': x.act } : {}), ...(x.read ? { 'data-read': '1' } : {}), ...(x.review ? { 'data-review': '1' } : {}) };
  const kind = primary && !x.text ? 'primary' : 'text';
  if (x.href) return btn(esc(x.label), { kind, href: x.href, target: x.ext && !x.mail ? '_blank' : undefined, icon: kind === 'primary' ? x.icon : undefined, iconEnd: x.ext && !x.mail ? 'external-link' : undefined, attrs });
  return btn(esc(x.label), { kind, attrs });
}
function alsoRow(t, c) {
  const x = (t.btns || [])[0], inner = `<span class="td-also-t"><span class="td-also-l">Also:</span> ${t.s}</span>${t.due != null ? cd(t.due) : ''}${icon(x && x.ext && !x.mail ? 'external-link' : 'chevron-right', { cls: 'chev' })}`;
  const bill = c.b ? `#/bill/${c.b.bill_number}` : '';
  if (t.kind === 'wait' || !x) return bill ? `<a class="td-also" href="${esc(bill)}">${inner}</a>` : `<div class="td-also">${inner}</div>`;
  if (x.href) return `<a class="td-also" href="${esc(x.href)}" data-k="${esc(t.key)}"${x.read ? ' data-read="1"' : ''}${x.review ? ' data-review="1"' : ''}${x.ext && !x.mail ? ' target="_blank" rel="noopener"' : ''}>${inner}</a>`;
  return `<button type="button" class="td-also" data-also="${esc(t.key)}">${inner}</button>`;
}
function card(c, i, team) {
  if (c.cluster) {
    const bills = [...new Set(c.cluster.map(t => billNum(t.b).split(' ')[0]))];
    return `<article class="td-card td-cluster" data-k="cluster" tabindex="-1" aria-labelledby="td-s${i}">
      <p class="td-s" id="td-s${i}">${icon('clipboard-check')}Review ${plural(c.cluster.length, 'testimony draft')}</p>
      <p class="td-why">${[c.due != null ? cd(c.due, 'first') : '', esc(bills.slice(0, 6).join(', ') + (bills.length > 6 ? ` and ${bills.length - 6} more` : ''))].filter(Boolean).join(' · ')}</p>
      <div class="td-acts">${btn('Start review', { href: '#/review', attrs: { 'data-primary': '1', 'data-review': '1' } })}</div></article>`;
  }
  const p = c.p, b = c.b, also = c.tasks.slice(1);
  const top = b ? `<a class="td-bill" href="#/bill/${esc(b.bill_number)}"><b class="td-num">${esc(billNum(b))}</b>${b.priority === 1 ? '<span class="sv-p1">P1</span>' : ''}<span class="td-t">${esc(blurb(b, 140))}</span></a>`
    : p.kind === 'followup' ? `<a class="td-bill td-kind" href="#/person/${esc(p.f.person_id)}">${icon('user-round')}<span>Follow-up</span></a>`
    : p.a ? `<a class="td-bill td-kind" href="#/email/${esc(p.a.id)}">${icon('mail')}<span>Email to supporters</span></a>`
    : `<span class="td-bill td-kind">${icon('bell')}<span>From the tracker</span></span>`;
  const more = b || p.kind === 'followup' || p.a ? iconBtn('ellipsis', `More for ${b ? billNum(b) : 'this item'}`, { 'data-more': c.key }, 'td-more') : '';
  const acts = (p.btns || []).slice(0, 2).map((x, j) => button(p, x, j === 0)).join('');
  const shown = also.slice(0, 2), rest = also.length - shown.length;
  return `<article class="td-card${c.wait ? ' td-wait' : ''}" data-k="${esc(c.key)}"${b ? ` data-bill="${esc(b.id)}" data-num="${esc(b.bill_number)}"` : ''} tabindex="-1" aria-labelledby="td-s${i}">
    <div class="td-top">${top}${more}</div>
    <p class="td-s" id="td-s${i}">${p.s}</p>
    ${(() => { const w = why(p, team); return w || (c.wait && p.chip) ? `<p class="td-why">${c.wait && p.chip ? chip(p.chip, '', 'hourglass') + ' ' : ''}${w}</p>` : ''; })()}
    ${p.note ? `<p class="td-note">${p.note}</p>` : ''}
    ${p.q ? `<blockquote class="td-q">${p.q}</blockquote>` : ''}
    ${acts ? `<div class="td-acts">${acts}</div>` : ''}
    ${shown.map(t => alsoRow(t, c)).join('')}${rest > 0 && b ? `<a class="td-also" href="#/bill/${esc(b.bill_number)}"><span class="td-also-t">${plural(rest, 'more thing')} on this bill</span>${icon('chevron-right', { cls: 'chev' })}</a>` : ''}
  </article>`;
}
function nextHearingText(scope) {
  const now = Date.now(), ok = b => b && b.position && b.position !== 'monitor' && (scope === 'team' || isMine(b));
  const h = (S.hearings || []).filter(x => x.status !== 'cancelled' && new Date(x.scheduled_at) > now && ok(billById(x.bill_id))).sort((x, y) => x.scheduled_at.localeCompare(y.scheduled_at))[0];
  if (h) return `Next hearing: ${esc(whenLine(h.scheduled_at))} (${esc(billNum(billById(h.bill_id)))}, ${esc(h.committee)}).`;
  return SESSION_OVER ? 'Hearings return when the next session opens.' : `No hearings are scheduled on ${scope === 'team' ? 'the team’s' : 'your'} bills yet.`;
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

function render() {
  if (!S.me) return empty({ title: 'No staff record yet', text: 'You are signed in, but the tracker does not know who you are. Ask your admin to add you.' });
  const scope = scopeOf(), r = todayItems(scope);
  LAST = new Map(r.tasks.map(t => [t.key, t]));
  // Async loads, each once: audience counts for the emails in the list, and the new-bill counts in the opening weeks.
  S.tdAud ??= {};
  for (const t of r.tasks) if (t.a && S.tdAud[t.a.id] === undefined) { S.tdAud[t.a.id] = null; DB.alertAudience(t.a.bill_id, t.a.list_id, t.a.segment_id).then(n => { S.tdAud[t.a.id] = n; if (S.route?.name === 'today') hooks.render(); }).catch(() => {}); }
  if (openWeeks() && !S.tdTriage && !S.tdTriageLoading) { S.tdTriageLoading = true; DB.triageCounts().then(c => { S.tdTriage = c || {}; if (S.route?.name === 'today') hooks.render(); }).catch(() => { S.tdTriage = {}; }); }
  const open = S.tdOpen ??= { later: false, digest: false };
  let i = 0;
  const top = r.groups.filter(g => g.id === 'overdue' || g.id === 'today');
  const clear = !top.length;
  const groupHtml = g => {
    const fold = g.id === 'later', isOpen = !fold || open.later;
    const title = g.id === 'overdue' ? `${icon('circle-alert', { cls: 'td-late' })}Overdue` : esc(g.title);
    return `<section class="td-group" aria-labelledby="td-g-${g.id}"><h2 class="td-h">${groupHead(title, g.n, { fold: fold ? 'later' : undefined, open: isOpen, id: 'td-g-' + g.id })}</h2>
      ${isOpen ? `<div class="td-list">${g.cards.map(c => card(c, i++, scope === 'team')).join('')}</div>` : ''}</section>`;
  };
  const dg = digest(scope), dgOpen = open.digest;
  const digestHtml = dg.rows.length ? `<section class="td-group td-dig" aria-labelledby="td-g-dig"><h2 class="td-h">${groupHead(`What changed since ${esc(dg.label)}`, plural(dg.rows.length, 'bill'), { fold: 'digest', open: dgOpen, id: 'td-g-dig' })}</h2>
    ${dgOpen ? `<div class="rows td-digrows">${dg.rows.slice(0, 40).map(x => `<a class="row td-dr" href="#/bill/${esc(x.b.bill_number)}/activity"><span class="body"><span class="title"><b class="td-num">${esc(billNum(x.b))}</b> ${esc(x.best ? x.best[0] : 'New messages')}${x.n > 1 ? `<span class="td-more-n"> · ${plural(x.n - 1, 'more update')}</span>` : ''}</span></span>${x.msgs ? `<span class="end">${icon('message-square')}${plural(x.msgs, 'message')}</span>` : ''}</a>`).join('')}${dg.rows.length > 40 ? `<p class="td-dmore small muted">And ${dg.rows.length - 40} more bills. Each bill’s Activity tab has the full record.</p>` : ''}</div>` : ''}</section>` : '';
  let body;
  if (!r.cards.length) body = `<div class="td-empty">${empty({ art: yay(), title: 'All clear for today.', text: nextHearingText(scope), action: btn('See your bills', { href: '#/bills' }) })}</div>`;
  else body = (clear ? `<div class="td-clear">${yay()}<div><p class="td-clear-t">All clear for today.</p><p class="small muted">${nextHearingText(scope)}</p></div></div>` : '') + r.groups.map(groupHtml).join('');
  return `<div class="td-root">${subline()}${oneNotice()}${body}${digestHtml}</div>`;
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
  // Mark done clears what only needed reading: a notice, or a message that needs no reply.
  const notes = c.tasks.filter(t => t.kind === 'notice' || t.kind === 'reply');
  menuSheet({ title: esc(num), items: [
    { label: 'Open bill', icon: 'scroll-text', run: later(() => S.go(`#/bill/${b.bill_number}`)) },
    { label: 'Reply in chat', icon: 'message-square', run: later(() => { const r = c.tasks.find(t => t.kind === 'reply'); if (r) DB.inboxMark(r.keys).catch(() => {}); S.go(`#/bill/${b.bill_number}/activity?reply=1`); }) },
    h ? { label: going ? 'I’m not going after all' : 'I’m going to the hearing', icon: going ? 'user-round' : 'user-check', sub: `${h.committee} ${whenLine(h.scheduled_at)}${others.length ? ' · ' + others.join(', ') + (others.length === 1 ? ' is' : ' are') + ' going' : ''}`,
      run: async () => { try { await DB.attend(h.id, !going); toast(!going ? `You’re going to the ${h.committee} hearing ${whenLine(h.scheduled_at)}.` : `Taken off the list for the ${h.committee} hearing.`, { ok: !going, undo: async () => { await DB.attend(h.id, going); redraw(); } }); redraw(); } catch (e) { toast(e, { err: true }); } } } : null,
    stream ? { label: 'Watch the hearing', icon: 'video', sub: stream.label + (stream.exact ? '' : ' · ' + stream.channel), run: () => { window.open(stream.url, '_blank', 'noopener'); } } : null,
    { label: 'Give to someone else', icon: 'user-plus', sub: owner ? `Now ${owner === me.id ? 'yours' : first(owner) + '’s'}` : 'No owner yet', run: later(() => pickerSheet({ title: `Give ${esc(num)} to`, value: owner || '',
      options: S.advocates.filter(a => a.is_active !== false).map(a => [a.id, a.id === me.id ? `${a.full_name} (you)` : a.full_name, 'user-round']),
      onPick: async id => { if (id === owner) return; try { await DB.setOwner(b.id, id); toast(id === me.id ? `${num} is yours now.` : `${num} is ${first(id)}’s now.`, { ok: true, undo: async () => { await DB.setOwner(b.id, owner); redraw(); } }); redraw(); } catch (e) { toast(e, { err: true }); } } })) },
    muted ? { label: 'Unmute this bill', icon: 'bell', run: async () => { try { await DB.mute(b.id, false); toast(`${num} is back on your Today.`); redraw(); } catch (e) { toast(e, { err: true }); } } }
      : { label: 'Mute this bill', icon: 'bell-off', disabled: !!ahead, reason: ahead ? `${num} has a hearing ${whenLine(ahead.scheduled_at)} (${ahead.committee}). You can mute it once that hearing is over.` : '',
        sub: 'Off your Today and no alerts until it gets a hearing', run: async () => { try { await DB.mute(b.id, true); toast(`Muted ${num}: off your Today and no alerts until it gets a hearing.`, { undo: async () => { await DB.mute(b.id, false); redraw(); } }); redraw(); } catch (e) { toast(e, { err: true }); } } },
    notes.length ? { label: 'Mark done', icon: 'check', sub: notes.some(t => t.kind === 'reply') ? 'Clears the message without a reply' : 'Clears this notice', run: async () => { const keys = notes.flatMap(t => t.keys || [t.i.key]); try { await DB.inboxMark(keys); toast('Marked done.', { undo: async () => { await DB.inboxUnmark(keys); redraw(); } }); redraw(); } catch (e) { toast(e, { err: true }); } } } : null,
  ] });
}
// An "Also" row whose step acts in place opens a small menu with that step's buttons, so nothing happens by surprise.
function alsoMenu(t) {
  const items = (t.btns || []).map(x => ({ label: x.label, icon: x.act === 'file' ? 'clipboard-check' : x.act === 'submit' ? 'send' : x.href ? (x.ext ? 'external-link' : 'chevron-right') : 'check',
    run: x.href && x.ext ? () => { if (x.mail) location.href = x.href; else window.open(x.href, '_blank', 'noopener'); } : later(() => x.href ? S.go(x.href) : run(t, x.act, null)) }));
  const tmp = document.createElement('div'); tmp.innerHTML = t.s;   // the sentence is stored as escaped HTML
  menuSheet({ title: esc(clip(tmp.textContent, 70)), items });
}

function wire(route, root) {
  const main = root.querySelector('.td-root'); if (!main) return;
  main.querySelectorAll('[data-seg="tdscope"]').forEach(el => el.onclick = () => { S.tdScope = el.dataset.val; save('today_scope', S.tdScope); hooks.render(); });
  main.querySelectorAll('[data-fold]').forEach(el => el.onclick = () => {
    const k = el.dataset.fold, open = S.tdOpen ??= {}; open[k] = !open[k];
    // Opening the digest is reading it: every official update it stands for counts as read.
    if (k === 'digest' && open[k]) { const keys = digest(scopeOf()).keys; if (keys.length) DB.inboxMark(keys).catch(() => {}); }
    hooks.render(); document.getElementById(k === 'digest' ? 'td-g-dig' : 'td-g-later')?.focus();
  });
  // Links that also clear an inbox item (Reply, Open), and links into review mode (start a fresh queue).
  main.querySelectorAll('[data-read]').forEach(el => el.addEventListener('click', () => { const t = LAST.get(el.dataset.k); const keys = t?.keys || (t?.i ? [t.i.key] : []); if (keys.length) DB.inboxMark(keys).catch(() => {}); }));
  // Into review mode: a fresh queue, and any Undo toast from this page goes (its step is now under review).
  main.querySelectorAll('[data-review]').forEach(el => el.addEventListener('click', () => { S.tdRev = null; const t = document.getElementById('toast'); if (t) t.innerHTML = ''; }));
  main.querySelectorAll('button[data-act]').forEach(el => el.onclick = () => { const t = LAST.get(el.dataset.k); if (t) { S.tdFocus = cardIndex(el); run(t, el.dataset.act, el); } });
  main.querySelectorAll('[data-also]').forEach(el => el.onclick = () => { const t = LAST.get(el.dataset.also); if (t) alsoMenu(t); });
  main.querySelectorAll('[data-more]').forEach(el => el.onclick = () => { const r = todayItems(scopeOf()), c = r.cards.find(x => x.key === el.dataset.more); if (c) moreMenu(c); });
  if (main.querySelector('.td-yay')) save('allclear', hst(Date.now()));
  main.querySelector('[data-newhere]')?.addEventListener('click', () => { save('newhere_done', '1'); hooks.render(); });
  // After an in-place step the card is gone; keyboard users land on the card that took its place.
  if (S.tdFocus != null) { const cards = main.querySelectorAll('.td-card'); const c = cards[Math.min(S.tdFocus, cards.length - 1)]; S.tdFocus = null; if (c && (document.activeElement === document.body || !document.activeElement)) c.focus({ preventScroll: true }); }
}
const cardIndex = el => { const c = el.closest('.td-card'); return c ? [...document.querySelectorAll('.td-root .td-card')].indexOf(c) : null; };

// Desktop keys (listed in Help, never shown or bound on touch screens): j/k move between cards, Enter runs the
// card's button, o opens the bill.
document.addEventListener('keydown', e => {
  if (S.route?.name !== 'today' || !HOVER() || e.metaKey || e.ctrlKey || e.altKey || typing(e.target) || document.querySelector('dialog[open]')) return;
  const cards = [...document.querySelectorAll('.td-root .td-card')]; if (!cards.length) return;
  const cur = document.activeElement?.closest?.('.td-card'), i = cards.indexOf(cur);
  if (e.key === 'j' || e.key === 'k') {
    e.preventDefault();
    const n = cards[e.key === 'j' ? Math.min(cards.length - 1, i + 1) : Math.max(0, i < 0 ? 0 : i - 1)];
    n.focus({ preventScroll: true }); n.scrollIntoView({ block: 'nearest' });
  } else if (e.key === 'Enter' && cur && document.activeElement === cur) { e.preventDefault(); cur.querySelector('[data-primary]')?.click(); }
  else if (e.key === 'o' && cur) { const num = cur.dataset.num; if (num) { e.preventDefault(); S.go(`#/bill/${num}`); } }
});

export default {
  tab: 'today',
  title: () => 'Today',
  // The Today tab's badge: my items overdue or due today; red when any is overdue.
  badge() { try { const r = todayItems('mine'); return { n: r.dueNow, late: r.late > 0 }; } catch (e) { console.error(e); return { n: 0, late: false }; } },
  render, wire,
};
