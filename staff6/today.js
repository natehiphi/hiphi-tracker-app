// Today (#/), Staff v6 (R-336; V6-SPEC section 6 "Today", V01, V14, V26, V29, V30, D1, D4, addendum 3, 7, F30, F48, F70).
// Nate: "far too overwhelming with too many things to do in too many places". v5's Today stacked four roles, six groups,
// two switches, a week grid, What changed and other people's steps in one page (assessment X1, X2, X3, X17: 70 controls and
// 2.2 screens for Nate, 26 labelled buttons on Patti's, mostly Lauren's steps). Today is now the person's own work, calm:
//   - one "Your next step" card (steps.js stepCard), the screen's ONLY filled button; when it is done the next slides in;
//   - Do today (overdue first, then by the time to act, a late step's by the time its late window closes), then Coming up
//     (every row: nothing a person must do is folded, rule 7.3), each own item its own row
//     (R-274), a name, the bill number small and one line (D15, D16: at most one tonal button, only on the viewer's own
//     step when it is due today, late, or a chair ask in its window);
//   - one line each for what is not the person's to do: Waiting on others (opens the list), leads' "7 slipping · Open
//     Team", a helper's "Lauren has 5 hearing asks this week · Offer to help" (D4), "11 more of your bills need a hearing"
//     (D1), a rallier's "This week's asks", bills with no owner, the partners' groups;
//   - a quiet Done today band with Undo;
//   - one season card (prep, sorting, hearings, conference, the governor), which on a hearing day is the person's sitting
//     as a hearingCard (F30); on a phone that day the big hearing cards come first, the person's own step inside its card
//     with the filled button (V14); each own step is said once on the page (A-14);
//   - Getting started right under the next step for new people, one line after a week (and on a phone), gone when done,
//     ticking from history (V29).
// Gone from Today, each to its one home: the Today | This week and Mine | Team switches (Hearings, Team, More tools ›
// Someone else's list), What changed (Inbox › Updates), reminder rows (V26: alerts live on the step), countdown tiles,
// codes in rows and "+N on this bill" (the open item's Also on this bill).
// The next step leads the work column at every width (the critic: one focal point read first, the same order on a laptop
// and a phone, A-13, P-2). On a laptop (1100px and wider) a picked row opens beside the list (billpane.js's open item,
// built here with the draft it is about) and nothing in the work column above the rows moves (B-4: the row stays under the
// pointer); before anything is picked that column holds Getting started, the season card and the one-line doors, and
// scrolls with the page (see sideOf). Below 1100px the item is its own page with Back (steps.js wireListDetail).
//
// v5's Today moved, whole, to today5.js: every export other screens import from './today.js' is re-exported below
// (review.js, bills.js, inbox.js, asks.js, legislators.js, profile.js and app.js still use them), and v5's This week still
// draws for the Hearings stub until HEARINGS replaces it (render() hands a route with place 'hearings' to v5).
import { S, DB, DEMO, SESSION_OVER, DEADLINE_ROWS, esc, advocate, isMine, hooks } from './data.js';
import v5, { todayItems, slipNow, slipWho } from './today5.js';
import { draftHearing, hearingAhead, diedish, stopOf, wantsHearing, whenAt, billRoute, billById, liveAsk, attendees, chairMail,
  legislativeDay, deadlineName, blurb, approves, canFirstApprove, filerOf, offTag, gateNeed, gateGloss, sessionClock } from './model.js';
import { icon, btn, toast, openSheet, closeSheet, pickerSheet, confirmSheet, docBtn, keysOn } from './ui.js';
import { billStep, stepCard, hearingCard, billRow, itemRow, rowButton, rowButtonOK, statusTile, status, shownStatus, nw,
  numWords, nameWords, sayWords, firstWords, orWords, dayWords, timeWords, committeeName, versionWords, deadlineWords,
  testimonyState, whoseStep, notFiled, wireListDetail, wireSteps, finish, helpersOf, actBy, takeFor } from './steps.js';
import { aboutBill, closeBtn } from './billpane.js';
import { plainCodes } from './terms.js';   // codes in a to-do's or a note's own words become plain words (D15, V05)
import { prepTaskOf, dueEnd as prepDue, issueHref, prepListHref } from './prep.js';
import { askTodoOf, askSummary, toAskWords } from './push.js';
import { isLead } from './more.js';
import { newSteps, markNewStep } from './help.js';
import { moveMe, notGoing, keepAskUp, seedMoved } from './moved.js';
import { pqItems, pqOthers, wantQueue, wantAsks, admitsPartners, approvesPartners, pqRow, pqItem, pqCard, wirePartner } from './partnerq.js';
import { dailyWord, HELD_NEXT } from './composer.js';
// OUTREACH's one rallier rule and due time, and the ask's one home (This week's asks), so Today and Outreach never disagree (V20).
import { rallierOf, askDueAt, askCardHref } from './asks.js';

// Every name other screens import from './today.js' (v5's today), unchanged.
export * from './today5.js';

const HR = 36e5, DAY = 864e5;
const HST = { timeZone: 'Pacific/Honolulu' };
const ms = t => t == null || t === '' ? null : typeof t === 'number' ? t : new Date(t).getTime();
const hday = t => new Date(t).toLocaleDateString('en-CA', HST);
const endOfDay = (t = Date.now()) => new Date(hday(t) + 'T23:59:59-10:00').getTime();
const live = id => { const a = id && advocate(id); return !!a && a.is_active !== false; };
const first = id => firstWords(id, { id: null });   // a name, never "you" (toasts and lines about someone else)
const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;
const lower = s => /^[A-Z][a-z]/.test(s || '') ? s[0].toLowerCase() + s.slice(1) : s;
const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;
const spaced = s => String(s || '').replace(/\b(HB|SB|HCR|SCR|HR|SR|GM)(\d)/g, '$1 $2');   // "HB1523" -> "HB 1523" (C-15)
const clip = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1).replace(/\s\S*$/, '') + '…' : s; };
const mq = q => { try { return matchMedia(q).matches; } catch { return false; } };
const WIDE = () => mq('(min-width: 1100px)');      // the list with the picked item beside it (V17)
const PHONE = () => mq('(max-width: 767px)');      // the phone frame (spec 3.2)
const HOVER = () => mq('(hover: hover) and (pointer: fine)');
const typing = t => t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
const owns = (id, b) => (S.assignments?.[b?.id] || []).includes(id);
const ownerOf = b => (S.assignments?.[b?.id] || []).find(live) || null;
const isPos = b => !!b && !!b.position && b.position !== 'monitor' && b.tracked !== false;
// Coming up shows every row: each is the person's own to-do, and nothing a person must do goes behind "Show more" (rule 7.3;
// the critic: Nate's HB 1886 draft and his follow-up with Lani sat behind an unlabelled fold). A fold would be Nate's call.
// Chair asks: a row when the notice must post within a week (a strong-support bill: two weeks, as v5's P1 rule), at most
// three; the rest are D1's one line, "11 more of your bills need a hearing · ask the first chair by Mon 3/23 · Hearings".
const ASK_ROWS = 3;

// ---- the season (V30, the critic's conference and governor clocks) ----
// prep: between sessions, October to the opening day (the 2027 issues, W4/W16) · opening: the weeks around the
// introduction cut-off (sorting new bills) · hearings: the session · conference: after the final decking, to sine die ·
// governor: after sine die, while bills wait for the governor (about 45 working days) · between: the summer.
function seasonOf(now = Date.now()) {
  const cal = (S.sessionCal || []).find(c => c.opening_day) || null;
  const rows = DEADLINE_ROWS || [];
  const sine = (rows.find(r => r.key === 'sine_die')?.deadline_date) || cal?.sine_die || null;
  const intro = rows.find(r => r.key === 'intro_cutoff')?.deadline_date || null;
  const fdeck = rows.find(r => r.key === 'final_decking')?.deadline_date || null;
  const day = hday(now), month = +day.slice(5, 7), ended = !!sine && day > String(sine).slice(0, 10);
  // After sine die the governor's clock runs (the practice copy's clock can pass sine die while its bills stay in March).
  if (ended && now < vetoDay(sine, 45)) return 'governor';
  if (SESSION_OVER || ended) return month >= 10 || month <= 1 ? 'prep' : 'between';
  if (intro) { const cut = ms(intro + 'T23:59:59-10:00'); if (now > cut - 18 * DAY && now < cut + 3 * DAY) return 'opening'; }
  if (fdeck && day > String(fdeck).slice(0, 10)) return 'conference';
  return 'hearings';
}
// The governor's clocks count working days after the session ends (weekends and the state's holidays in May and June out):
// the 35th is the last day to say which bills may be vetoed, the 45th the last to veto. Said "about", since the
// Legislature's own count is what binds (Help explains it).
function vetoDay(sine, n) {
  const off = y => [`${y}-05-${String(31 - ((new Date(`${y}-05-31T12:00:00Z`).getUTCDay() + 6) % 7)).padStart(2, '0')}`, `${y}-06-11`, `${y}-07-04`];
  const y = String(sine).slice(0, 4), skip = new Set(off(y));
  let k = 0, d = new Date(String(sine).slice(0, 10) + 'T12:00:00-10:00');
  while (k < n) { d = new Date(d.getTime() + DAY); const dow = d.getUTCDay(), s = d.toISOString().slice(0, 10); if (dow !== 0 && dow !== 6 && !skip.has(s)) k++; }
  return d.getTime();
}

// ---- the viewer's work: one list, worked out once a draw ----
// work(v) -> { own: [item], waiting: [line], nobody: Map(bill), asks: [{ b, by }], coal: Map(owner -> n), rally, hearings }
// An item: { key, kind, b?, d?, h?, s? (steps.js billStep), at (the time to act, or null), tone, rank, line, ... }.
// The testimony and chair-ask steps come from steps.js (whose step it is: W6's writer, the shared approval, the filer);
// to-dos, follow-ups, emails, questions and the moved-hearing questions come from v5's todayItems, the same data calls.
const MEMO = new Map(); let memoT = 0;
function memo(key, fn) {
  if (!memoT) memoT = setTimeout(() => { MEMO.clear(); memoT = 0; }, 0);
  if (!MEMO.has(key)) MEMO.set(key, fn());
  return MEMO.get(key);
}
export const work = (v = S.me) => memo('w:' + (v?.id || ''), () => build(v));
// The order inside a group: overdue first, then by the time to act, then "Did we file?", then what has no time. A late step
// (its on-time window passed, still accepted) sorts by the time its late window closes, so an on-time deadline that comes
// first is done first (the critic: SB 3025's file by 10:00 AM sat under HB 1562's late window to 1:10 PM).
// Late testimony the Capitol still takes comes straight after the overdue, before anything due on time (v5's "Late
// testimony, still open" group led Mine; Nate's walk: "Approve by today 11:00 AM" sat above the late "File · late, still
// accepted until 1:10 PM"), and inside it by the time its window closes.
const ORDER = { overdue: 0, late: 1, dated: 2, missed: 3, undated: 4 };
const RANK = { file: 1, approve: 2, second: 2, revise: 3, submit: 4, write: 5, nodraft: 6, stale: 7, chair: 8, followask: 8, rally: 9,
  reply: 10, email: 11, fix: 11, send: 11, partner: 12, todo: 13, followup: 14, moved: 15, askup: 15 };
function orderOf(it) { return it.tone === 'overdue' ? ORDER.overdue : it.tone === 'late' ? ORDER.late : it.kind === 'missed' ? ORDER.missed : it.at != null ? ORDER.dated : ORDER.undated; }
const byOrder = (x, y) => orderOf(x) - orderOf(y) || (x.at ?? Infinity) - (y.at ?? Infinity) || (RANK[x.kind] || 20) - (RANK[y.kind] || 20)
  || String(x.b?.bill_number || x.key).localeCompare(String(y.b?.bill_number || y.key), 'en', { numeric: true });

// The rallier and the ask's due time are asks.js's (OUTREACH): Saya on CTFH, else the coalition's owner, else the bill's
// (spec 6 W22, addendum 6); 4:00 PM two days before the hearing, never later than the last 4:00 PM at least 12 h before
// written testimony closes (settled, spec 2; R-025, R-116).
const coalIds = a => { const c = a?.prefs?.coalitions; return Array.isArray(c) ? c : []; };
const inCoal = (a, b) => { const ids = coalIds(a); return ids.length > 0 && (S.billCampaigns?.[b.id] || []).some(c => ids.includes(c)); };
const ASK_RX = /^Send the ask\b/i;
// The sitting a share to-do is about: its title ends "for the HHS/CPN hearing 3/20" (migration 112); else the bill's next one.
function shareHearing(b, t) {
  const m = /\bfor the (\S+) hearing (\d{1,2})\/(\d{1,2})\s*$/.exec(t?.title || ''), now = Date.now();
  const ahead = (S.hearings || []).filter(h => h.bill_id === b.id && h.status !== 'cancelled' && ms(h.scheduled_at) > now - 3 * HR).sort((x, y) => ms(x.scheduled_at) - ms(y.scheduled_at));
  return (m && ahead.find(h => new Date(h.scheduled_at).toLocaleDateString('en-US', { ...HST, month: 'numeric', day: 'numeric' }) === `${+m[2]}/${+m[3]}`)) || ahead[0] || null;
}

function build(v) {
  const out = { own: [], waiting: [], nobody: new Map(), asks: [], coal: new Map(), rally: [], self: v?.id === S.me?.id };
  if (!v) return out;
  const now = Date.now(), self = out.self, add = it => out.own.push(it);
  const mineBill = b => self ? isMine(b) : owns(v.id, b) || (S.followersBy?.[b.id] || []).includes(v.id);
  const askRows = [];
  // A quick first look before the full step is worked out (Team draws every teammate's list): a bill can only be this
  // person's when they own it, sent its draft, help its coalition, approve, were given its chair ask, or may hand it.
  const approver = !!(v.is_admin || v.can_approve || v.is_reviewer);
  for (const b of S.bills || []) {
    if (b.tracked === false) continue;
    const mon = !isPos(b), mineB = owns(v.id, b) || inCoal(v, b), orphan = !ownerOf(b) && takeFor(b, v);
    const maybe = d => mineB || orphan || (d && (d.submitted_by === v.id || (approver && ['review', 'second_review'].includes(d.status))));
    if (!maybe(null) && !(S.drafts?.[b.id] || []).some(maybe) && askTodoOf(b)?.assignee_id !== v.id) continue;
    // ---- testimony: one item per draft (and per sitting with no draft yet), never "+N on this bill" ----
    const drafts = (S.drafts?.[b.id] || []).filter(d => d.status !== 'cancelled');
    for (const d of drafts) {
      if (d.status === 'filed' || !maybe(d) || notFiled(d, b)) continue;
      if (mon && !d.submitted_at && !d.review_note) continue;
      const h = draftHearing(d); if (!h) continue;
      if (h.status !== 'cancelled' && ms(h.scheduled_at) < now - 2 * DAY) continue;
      const s = billStep(b, { viewer: v, d, h }); if (!s || s.kind === 'filed' || s.kind === 'none') continue;
      testimony(out, b, d, h, s, v, owns(v.id, b) || d.submitted_by === v.id);
    }
    if (!mon && (mineB || orphan) && !diedish(b) && !S.failed?.('testimony drafts')) for (const h of S.hearings || []) {
      if (h.bill_id !== b.id || h.status === 'cancelled' || ms(h.scheduled_at) <= now) continue;
      if (drafts.some(d => d.committee === h.committee)) continue;
      const s = billStep(b, { viewer: v, d: null, h }); if (!s || s.kind === 'none') continue;
      testimony(out, b, null, h, s, v, owns(v.id, b));
    }
    // ---- getting a hearing (V13): the chair ask is the owner's, or whoever it was given to ----
    if (!wantsHearing(b) || mon || diedish(b)) continue;
    const c = billStep(b, { viewer: v, d: null, h: null });
    if (!c || c.kind !== 'chair') continue;
    const a = c.ask;
    if (c.you) {
      if ((a.key === 'ask' || a.key === 'giving') && a.by != null) askRows.push({ b, s: c, by: a.by });
      else if (a.key === 'waiting' && a.followUp) add({ key: `fu:${b.id}`, kind: 'followask', b, s: c, at: null, tone: 'neutral' });
      else if (a.key === 'waiting' && a.answer !== 'will_schedule') out.waiting.push({ key: `cw:${b.id}`, b, line: `${a.m ? a.m.who : 'The chair'}: no reply yet · asked ${dayWords(a.lastAt || a.at)}`, on: [] });
    } else if (c.nobody && c.takeFor) out.nobody.set(b.id, b);
    // A handed ask in askWords' own words ("Kris asks the chairs for you · by Mon 3/23"), as every screen says it (rule 6).
    else if (owns(v.id, b) && a.key === 'giving') out.waiting.push({ key: `cg:${b.id}`, b, line: a.words, on: [a.who] });
    // D4: a coalition helper's one line counts the owner's bills still to ask, never the helper's own rows: every one, as
    // the Get hearings tab counts them (the critic: the door's 11 in two weeks beside the tab's 15).
    else if (a.key === 'ask' && !owns(v.id, b) && inCoal(v, b)) {
      const o = ownerOf(b); if (o) { const e = out.coal.get(o) || { n: 0, by: Infinity }; e.n++; if (a.by != null) e.by = Math.min(e.by, a.by); out.coal.set(o, e); } }
  }
  // Chair-ask rows: those due within a week (two for a strong-support bill), soonest first, at most three; the rest are D1's line.
  askRows.sort((x, y) => x.by - y.by);
  for (const r of askRows) {
    // By calendar day, all day, so the window does not slide by the hour (Nate's walk: at 9:45 three "Email the chair"
    // rows for Tue 3/24 appeared that were not there at 8:00): on or before the same weekday next week.
    const near = r.by <= endOfDay(now + 7 * DAY) || (r.b.priority === 1 && r.by <= endOfDay(now + 14 * DAY)) || r.s.ask.key === 'giving';
    if (near && out.own.filter(i => i.kind === 'chair').length < ASK_ROWS) add({ key: `ca:${r.b.id}`, kind: 'chair', b: r.b, s: r.s, at: r.by, tone: shownStatus(r.s)?.tone || 'neutral' });
    else out.asks.push(r);
  }
  // ---- the public ask, the rallier's step two days before it is due (W22's fallback): a strong position's bill on the
  // public page. Every bill with a position (OUTREACH's ask, V20) put 7 rows on Nate's practice Today, most already late,
  // against spec 8's 1.2 screens; the others are on This week's asks (the rallier's door below), and widening it is Nate's
  // call (the integrator's report) ----
  for (const h of S.hearings || []) {
    const t = ms(h.scheduled_at); if (h.status === 'cancelled' || t <= now || t - now > 7 * DAY) continue;
    const b = billById(h.bill_id); if (!b || !['strongly_support', 'strongly_oppose'].includes(b.position) || !b.is_public || diedish(b) || b.tracked === false) continue;
    if (!rallierOf(b).includes(v.id)) continue;
    out.rally.push({ b, h });
    if (liveAsk(b) || out.own.some(i => i.kind === 'rally' && i.b.id === b.id)) continue;
    const due = askDueAt(h); if (now < due - 2 * DAY) continue;
    add({ key: `ra:${b.id}`, kind: 'rally', b, h, at: due, tone: due <= now ? 'overdue' : 'neutral', due });
  }
  // ---- v5's own items: to-dos, follow-ups, emails, questions, the moved hearings (the same data, v6 rows) ----
  let tasks = [];
  try { tasks = self ? todayItems('mine').tasks : todayItems('person', v.id).tasks; } catch (e) { console.error(e); }
  for (const t of tasks) {
    const tone = t.due != null && t.due <= now ? 'overdue' : 'neutral';
    if (t.kind === 'todo') {
      if (t.who !== 'yours' || (t.b && askTodoOf(t.b)?.id === t.t.id)) continue;   // a chair ask given to you is its chair row
      const share = !!t.b && ASK_RX.test(t.t.title || '');
      if (share) {
        // The database's share to-do (migration 112) goes to the bill's owner, but the public ask is the rallier's (11.6:
        // Saya on CTFH, else the coalition's owner): one act, one verb, one owner and one time (the critic: Kevin's "Send
        // the public ask · due today 5:00 PM" beside Saya's "Write the public ask · due tomorrow 4:00 PM"). Someone else
        // rallies: the owner reads it in Waiting on others, as hers, by OUTREACH's time. The viewer rallies: the to-do is
        // the rally row itself (its open item keeps Mark done), never a second row.
        // Folded only when the rallier has (or will have, two days before it is due) that rally row: a strong position on
        // a public bill with the sitting ahead (shareAsk). Otherwise the to-do stays its owner's own row at its own time,
        // in their Do today and in Slipping (R-274): on any other bill the rallier's Today never shows it.
        const sa = shareAsk(t);
        if (sa && !sa.rl.includes(v.id)) {
          out.waiting.push({ key: t.key, b: t.b, t: t.t, h: sa.h, line: `${shareWords(sa, v)}${sa.due != null ? ` · by ${whenAt(sa.due)}` : ''}`, on: sa.rl });
          continue;
        }
        if (sa) {
          const ra = out.own.find(i => i.kind === 'rally' && i.b.id === t.b.id);
          if (ra) { ra.t = t.t; continue; }
          add({ key: t.key, kind: 'todo', b: t.b, t: t.t, h: sa.h, at: sa.due, tone: sa.due != null && sa.due <= now ? 'overdue' : 'neutral', share: true });
          continue;
        }
        add({ key: t.key, kind: 'todo', b: t.b, t: t.t, h: shareHearing(t.b, t.t), at: t.due ?? null, tone, share: true });
        continue;
      }
      add({ key: t.key, kind: 'todo', b: t.b, t: t.t, at: t.due ?? null, tone, share: false });
    } else if (t.kind === 'followup') add({ key: t.key, kind: 'followup', f: t.f, p: t.p, at: t.due ?? null, tone });
    else if (t.kind === 'email' || t.kind === 'fix' || t.kind === 'send') add({ key: t.key, kind: t.kind, a: t.a, b: t.b || billById(t.a?.bill_id) || null, at: null, tone: 'neutral' });
    else if (t.kind === 'reply' && self) {
      // Questions addressed to the viewer and not yet answered (addendum 7); every other message lives in Inbox.
      const m = /^(.+?) asked: (.+)$/.exec(String(t.s || '').replace(/<[^>]+>/g, ''));
      if (m) add({ key: t.key, kind: 'reply', b: t.b, from: m[1], q: m[2], at: null, tone: 'neutral', keys: t.keys });
    } else if ((t.kind === 'moved' || t.kind === 'askup') && self) add({ key: t.key, kind: t.kind, b: t.b, h: t.h, old: t.old, task: t, at: t.due ?? null, tone: 'neutral' });
  }
  // ---- partner words to approve (R-328: Nate and Jess), one row each ----
  if (self && approvesPartners(v)) for (const p of pqItems()) add({ key: `pq:${p.kind}:${p.id}`, kind: 'partner', p, at: null, tone: 'neutral' });
  // ---- what waits on others: steps on the viewer's bills and drafts, to-dos given to someone, emails waiting ----
  for (const [bid, list] of Object.entries(S.todos || {})) { const b = billById(bid); if (!b || !owns(v.id, b)) continue;
    for (const t of list) if (!t.done && t.assignee_id && t.assignee_id !== v.id && live(t.assignee_id))
      out.waiting.push({ key: `wt:${t.id}`, b, t, line: `${first(t.assignee_id)}: ${lower(t.title)}`, on: [t.assignee_id] }); }
  for (const a of S.alerts || []) if (a.author_id === v.id && a.status === 'submitted')
    out.waiting.push({ key: `wa:${a.id}`, a, line: `Your email “${clip(spaced(a.subject), 40)}” · with an approver`, on: [] });
  // ---- the 2027 issues (W4, between sessions): the season card's, or the next step when nothing else is waiting ----
  const pt = SESSION_OVER ? prepTaskOf(v.id) : null;
  if (pt) out.prep = { key: `prep:${v.id}`, kind: 'prep', pt, at: prepDue(), tone: 'neutral' };
  out.own.sort(byOrder);
  // A bill with more than one sitting among the rows and lines says which on each, "for the Fri 3/20 hearing" (Nate's walk:
  // HB 2121's "Saya writes the public ask · by Sun 3/1" and "· by Tue 3/17" read as a contradiction; spec 7.2, A-14).
  const sits = new Map(), note = (b, h) => { if (b && h) { if (!sits.has(b.id)) sits.set(b.id, new Set()); sits.get(b.id).add(sitKey(h)); } };
  for (const it of out.own) note(it.b, it.h);
  for (const x of out.waiting) note(x.b, x.h);
  out.multi = new Set([...sits].filter(([, ks]) => ks.size > 1).map(([id]) => id));
  for (const x of out.waiting) if (x.b && x.h && out.multi.has(x.b.id)) x.line += `, ${forSit(x.h)}`;
  return out;
}
// Said as part of the line's last part (", for the Fri 3/20 hearing"), so a row still holds four facts (spec 8).
const forSit = h => `for the ${dayWords(h.scheduled_at)} hearing`;
const sitSuffix = (it, v) => it.b && it.h && work(v).multi?.has(it.b.id) ? `, ${forSit(it.h)}` : '';
// A hearing notice that posted in the last two days, for a draft not yet made: shown in Coming up whatever its due date,
// "New hearing Tue 3/17: make the draft · send by Sun 3/15" (Nate's walk: Kevin's three new notices sat behind "3 more
// later"; a writer starts the day the notice lands, spec 6 Testimony). The 7-day fold stays for everything else.
// (A notice dated after the clock has not landed: only the practice copy's clock, moved back with &asof, stands before
// notices its sittings already carry, and counting those put 34 drafts on Nate's opening-season Today.)
const newNotice = it => { const t = it.kind === 'nodraft' ? ms(it.h?.notice_posted_at) : null, now = Date.now(); return t != null && t <= now && now - t <= 2 * DAY; };
// A testimony step: the viewer's own (a row), nobody's (one line for whoever may hand it), or someone else's on the
// viewer's bill (Waiting on others). A draft written for an older version is the writer's row once it has left them.
function testimony(out, b, d, h, s, v, mine) {
  if (s.you) {
    out.own.push({ key: `t:${d ? d.id : 'h' + h.id}`, kind: s.kind, b, d, h, s, at: s.kind === 'missed' ? ms(h.scheduled_at) : s.act?.at ?? s.due ?? null,
      tone: s.kind === 'missed' ? 'neutral' : (shownStatus(s)?.tone || 'neutral') });
    return;
  }
  if (s.nobody) { if (s.takeFor) out.nobody.set(b.id, b); return; }
  const st = s.state;
  if (d && st?.stale && ['approve', 'second', 'file'].includes(st.key) && whoseStepWriter(d, b, v)) {
    out.own.push({ key: `st:${d.id}`, kind: 'stale', b, d, h, s, at: s.due, tone: 'neutral' });
  }
  if (mine && s.kind !== 'missed' && !out.waiting.some(w => w.key === `w:${b.id}:${d?.id}`))
    out.waiting.push({ key: `w:${b.id}:${d?.id}`, b, d, h, line: s.line, on: s.whose?.ids || [] });
}
const whoseStepWriter = (d, b, v) => d.submitted_by === v.id || (!d.submitted_by && owns(v.id, b));

// ---- the groups ----
// Coming up is the week ahead: every own row due in the next seven days is shown (rule 7.3; the critic: Nate's HB 1886 draft
// and his follow-up with Lani had sat behind "Show 2 more"). What is due later still is one labelled line under it, "31 more
// later · the first by Mon 2/2", that opens the list beside (laterItem): the opening weeks' practice clock put 34 drafts for
// February and March hearings on Nate's Today, four screens of rows nobody acts on yet. A moved hearing's question waits
// on the person now, whatever its date, so it is never "later"; nor is a chair-ask row, whose own window (build: a week,
// two for a strong-support bill, at most three rows) already decides when it shows.
const LATER_DAYS = 7;
function groupsOf(w) {
  const eod = endOfDay(), horizon = endOfDay(Date.now() + LATER_DAYS * DAY), today = [], soon = [], later = [], partner = [];
  // Partner words to approve have no deadline: their own small group after Coming up (R-328), never "Do today" or the badge.
  for (const it of w.own) (it.kind === 'partner' ? partner : (it.tone === 'overdue' || it.tone === 'late' || it.kind === 'missed' || it.at == null || it.at <= eod) ? today
    : it.at > horizon && !['moved', 'askup', 'chair', 'followask'].includes(it.kind) && !newNotice(it) ? later : soon).push(it);
  return { today, soon, later, horizon, partner, next: today[0] || soon[0] || partner[0] || later[0] || w.prep || null };
}
// The Today badge: what needs the viewer today (D3); `lateN` names the overdue count (the frame's words, A-5).
function badgeOf() {
  const w = work(), g = groupsOf(w);
  // Partner words to approve are the person's own rows, so they count in "needs you today" too (Nate's walk: November's
  // sidebar showed no count with 3 waiting); they keep their own group, since they have no deadline. Suggestions never count.
  const counted = [...g.today, ...g.partner];
  const lateN = counted.filter(i => i.tone === 'overdue').length;
  return { n: counted.length, late: lateN > 0, lateN };
}

// ---- rows ----
const REG = new Map();   // the items drawn this draw, by key (a button or a picked row finds its record here)
// A row for one item: the name, the bill number small, one line (D15). `ro`: a teammate's list, read-only and never in colour.
// Below 600px every row's button goes under its words (steps.css, A-8: one layout for every row on one screen; a short
// button beside the words had squeezed them into a narrow column beside rows whose button sat below).
function rowOf(it, { ro = false, v = S.me } = {}) {
  REG.set(it.key, it);
  const pick = it.key, b = it.b, sx = sitSuffix(it, v);
  if (it.s && b && ['chair', 'followask', 'stale'].indexOf(it.kind) < 0) {
    const s0 = ro ? { ...it.s, mine: false } : it.s;
    const s = newNotice(it) ? { ...s0, line: `New hearing ${dayWords(it.h.scheduled_at)}: make the draft · send by ${dayWords(s0.act?.at ?? s0.due)}` } : sx ? { ...s0, line: s0.line + sx } : s0;
    // The second look says its state word on the row (spec 5's five words): "Second look · approve by tomorrow 10:00 AM".
    if (s.state?.key === 'second' && s.you && !ro && s.act?.words) {
      const st = shownStatus(s), hushed = st !== s.status, tone = st.tone;
      return itemRow({ key: b.id, name: nameWords(b), num: numWords(b), line: nw(esc(`Second look · ${lower(s.act.words)}${sx}`)), tone, icon: tone !== 'neutral' ? st.icon : st.soon || hushed ? 'clock' : '',
        bold: !!st.soon, href: billRoute(b), pick, button: rowButtonOK(s) ? rowButton(s) : '' });
    }
    return billRow(b, { viewer: v, step: s, pick, button: ro ? false : undefined });
  }
  // A chair ask given to the viewer reads like every other chair ask, "Ask the chair by Mon 3/23" (C-15: one name per act;
  // the critic: Kris's "You are asking · by Mon 3/23" beside Kevin's "Ask the chair by Wed 3/25"); its open item says who gave it.
  if (it.kind === 'chair') { const a = it.s.ask, given = !ro && it.s.you && a.key === 'giving' && a.by != null;
    return billRow(b, { viewer: v, step: ro ? { ...it.s, mine: false } : it.s, pick, button: ro ? false : rowButton(it.s), ...(given ? { line: nw(esc(`Ask the chair by ${dayWords(a.by)}`)) } : {}) }); }
  // The asker's follow-up: the row's button is the step itself, "Follow up", the same button and sheet as Get hearings'
  // (push.js's listener, chairask.js followSheet): the mail again, or what the chair said, so sending the follow-up and
  // recording the reply are each two clicks from Today (spec 8; the critic: the row offered only They replied, A-12, D16).
  if (it.kind === 'followask') { const code = it.s.ask.code;
    return billRow(b, { viewer: v, step: it.s, pick, button: ro ? false : btn('Follow up', { kind: 'secondary', sm: true, icon: 'clock', attrs: { 'data-hgact': 'follow', 'data-hgb': b.id, 'data-hgcode': code, 'aria-haspopup': 'dialog', 'aria-label': `Follow up: ${sayWords(b)}` } }) }); }
  if (it.kind === 'stale') return billRow(b, { viewer: v, step: it.s, pick, button: false, line: nw(esc(`Check your testimony: the bill is now ${versionWords(b.current_version)}`)) });
  // Partner words say only what and what is new: the group's heading says "to approve" (fewer words per row).
  const r = it.kind === 'partner' ? pqRow(it.p, { short: true }) : miniOf(it, v), due = dueTone(it, ro);
  return itemRow({ key: it.key, name: r.name, num: r.num, line: nw(plainCodes(esc(r.line + sx))), tone: due.tone, icon: due.icon, bold: due.bold, href: r.href, pick: r.pick === false ? undefined : pick,
    button: ro ? '' : r.rowBtn && (it.tone === 'overdue' || it.at == null || it.at <= endOfDay()) ? r.rowBtn : '', cls: `t6-k-${it.kind}` });
}
// A to-do's or a follow-up's line colour: red only once its date has passed, for the viewer's own (D3).
function dueTone(it, ro) {
  if (it.at == null) return { tone: '', icon: '', bold: false };
  const st = status({ due: it.at, kind: it.kind === 'rally' ? 'ask' : it.kind });
  if (ro || st.tone === 'neutral') return { tone: '', icon: st.soon ? 'clock' : '', bold: !ro && st.soon };
  return { tone: st.tone, icon: st.icon, bold: false };
}
// The words of an item that is not a testimony step: its name, number, line, where its row goes, its row button and the
// buttons of its card (first one filled where the card holds the screen's filled button).
// A to-do's or a follow-up's own words are free text of any length, so their line says the time first ("Due today 5:00 PM ·
// Send the public ask…"): the time is never the part a narrow row cuts (the critic: R-277 W-1, A-24).
function miniOf(it, v = S.me) {
  const b = it.b, when = it.at != null ? actBy({ kind: 'due', due: it.at, verb: 'Due' }).words : '';
  switch (it.kind) {
    case 'todo': {
      // The database's share to-do ("Send the ask to HIPHI's list and partners for the HHS/CPN hearing 3/20", migration 112)
      // is the rallier's public ask, said with the rally row's one verb and its hearing by day: "Write the public ask for
      // the Fri 3/20 hearing" (C-15, spec 8: one name per act). Its row's button is the step itself, Open the ask card; Mark
      // done is in the open item, so nobody ticks it without doing it (the critic: "✓ Done" read as a finished tag). An
      // ordinary to-do's button says what it does, "Mark done", with no check mark (a check means done, D3).
      const title = it.share ? `Write the public ask for the ${it.h ? dayWords(it.h.scheduled_at) : 'next'} hearing` : it.t.title;
      const doneBtn = (k = 'secondary') => btn('Mark done', { kind: k, sm: k !== 'primary', attrs: { 'data-t6act': 'todo', 'data-t6k': it.key } });
      const card = askCardHref(b), askBtn = (k = 'secondary') => btn(card ? 'Open the ask card' : 'Write the public ask', { kind: k, sm: k !== 'primary', icon: k === 'primary' ? 'megaphone' : '', href: card || `${billRoute(b, 'public')}?focus=ask` });
      return { name: nameWords(b), num: numWords(b), line: [when, clip(title, 64)].filter(Boolean).join(' · '), href: billRoute(b), what: title,
        rowBtn: it.share ? askBtn() : doneBtn(), buttons: k => [it.share ? askBtn(k) : doneBtn(k), it.share ? doneBtn(k === 'primary' ? 'secondary' : 'text') : '',
          // Give to… lives in the open item; the next-step card keeps to the step itself (V01: the first screen stays small)
          k === 'primary' ? '' : btn('Give to…', { kind: 'text', icon: 'user-round', attrs: { 'data-t6act': 'give', 'data-t6k': it.key, 'aria-haspopup': 'dialog' } })] };
    }
    case 'followup': {
      const p = it.p || {}, name = p.name || p.email || 'A supporter', reach = p.phone ? btn('Call', { kind: 'text', icon: 'phone', href: `tel:${p.phone}` }) : p.email ? btn('Email', { kind: 'text', icon: 'mail', href: `mailto:${p.email}` }) : '';
      const doneBtn = (k = 'secondary') => btn('Mark done', { kind: k, sm: k !== 'primary', attrs: { 'data-t6act': 'fu', 'data-t6k': it.key } });
      // The row says the verb and the day, and the first few words of what about; the rest is in the open item (fewer
      // words per row: Nate's Today was 335 words against 250).
      const fu = it.at != null ? actBy({ kind: 'due', due: it.at, verb: 'Follow up' }).words : 'Follow up';
      return { name, num: '', line: [fu, it.f.what ? clip(it.f.what, 34) : ''].filter(Boolean).join(' · '), href: `#/person/${encodeURIComponent(it.f.person_id)}`, what: `Follow up with ${name}`,
        sub: it.f.what || '', rowBtn: doneBtn(), buttons: k => [doneBtn(k), reach, btn('Open their page', { kind: 'text', href: `#/person/${encodeURIComponent(it.f.person_id)}` })] };
    }
    // A supporter email is named by its bill, nickname first and the number after (R-271, D15), as everywhere else on the
    // screen; its subject ("Testify on HB1523 this week") is said once, in the card and the open item (the critic: the same
    // bill under two names). Its Review is the same tonal button as an approval's (rowButton), no icon.
    case 'email': {
      const n = S.tdAud?.[it.a.id], who = first(it.a.author_id), subj = spaced(it.a.subject), aud = `${who}’s email to ${n != null ? plural(n, 'supporter') : 'its supporters'}`;
      const go = (k = 'secondary') => btn('Review', { kind: k, sm: k !== 'primary', href: `#/review/email-${it.a.id}` });
      return { name: b ? nameWords(b) : clip(subj, 60) || 'An email to supporters', num: b ? numWords(b) : '', line: `Approve ${aud}`, href: `#/review/email-${it.a.id}`, pick: false,
        what: `Approve ${aud}`, sub: b && subj ? `“${clip(subj, 120)}”` : '', rowBtn: go(), buttons: k => [go(k)] };
    }
    case 'fix': return { name: b ? nameWords(b) : clip(spaced(it.a.subject), 60) || 'Your email', num: b ? numWords(b) : '', line: 'Your email was sent back · fix it and send it again', href: `#/email/${it.a.id}`, pick: false, what: 'Fix your email',
      sub: b && it.a.subject ? `“${clip(spaced(it.a.subject), 120)}”` : '',
      rowBtn: btn('Edit', { kind: 'secondary', sm: true, href: `#/email/${it.a.id}` }), buttons: k => [btn('Edit the email', { kind: k, icon: 'pencil', href: `#/email/${it.a.id}` })] };
    case 'send': return { name: b ? nameWords(b) : clip(spaced(it.a.subject), 60) || 'Your email', num: b ? numWords(b) : '', line: 'Your email is approved · send it at 4:30 PM', href: `#/email/${it.a.id}`, what: 'Send your approved email',
      rowBtn: btn('Send', { kind: 'secondary', sm: true, icon: 'send', attrs: { 'data-t6act': 'send', 'data-t6k': it.key } }), buttons: k => [btn('Send at 4:30 PM', { kind: k, icon: 'send', attrs: { 'data-t6act': 'send', 'data-t6k': it.key } }), btn('Open the email', { kind: 'text', href: `#/email/${it.a.id}` })] };
    case 'reply': {
      const href = `${billRoute(b, 'talk')}?reply=1`;
      return { name: nameWords(b), num: numWords(b), line: `Reply to ${it.from} · ${clip(it.q, 70)}`, href, pick: false, what: `Reply to ${it.from}`, sub: `“${clip(it.q, 160)}”`,
        buttons: k => [btn('Reply', { kind: k, icon: 'message-square', href })] };
    }
    case 'rally': {
      // The ask is written on its card in This week's asks (OUTREACH, V20), which also copies it out; the bill's Public tab
      // only when the bill has no card this week.
      const card = askCardHref(b), write = card || `${billRoute(b, 'public')}?focus=ask`, by = actBy({ kind: 'due', due: it.due, verb: 'Write the public ask' }).words, label = card ? 'Open the ask card' : 'Write the public ask';
      // The database's share to-do on the same bill is this act (build): its Mark done sits in the open item.
      const done = it.t ? k => btn('Mark done', { kind: k, sm: true, attrs: { 'data-t6act': 'todo', 'data-t6k': it.key } }) : null;
      return { name: nameWords(b), num: numWords(b), line: by, href: write, what: 'Write the public ask', sub: `For the ${committeeName(it.h.committee) || it.h.committee} hearing ${whenAt(it.h.scheduled_at)}.`,
        rowBtn: btn(label, { kind: 'secondary', sm: true, href: write }), buttons: k => [btn(label, { kind: k, icon: k === 'primary' ? 'megaphone' : '', href: write }), done && k !== 'primary' ? done('text') : ''] };
    }
    case 'moved': return { name: nameWords(b), num: numWords(b), line: `Your ${committeeName(it.h.committee) || it.h.committee} hearing moved to ${whenAt(it.h.scheduled_at)} · still going?`, href: billRoute(b), what: 'Your hearing moved: still going?',
      rowBtn: btn('Yes, move me', { kind: 'secondary', sm: true, attrs: { 'data-t6act': 'moveme', 'data-t6k': it.key } }),
      buttons: k => [btn('Yes, move me', { kind: k, attrs: { 'data-t6act': 'moveme', 'data-t6k': it.key } }), btn('No', { kind: 'text', attrs: { 'data-t6act': 'notgoing', 'data-t6k': it.key } })] };
    case 'askup': return { name: nameWords(b), num: numWords(b), line: `The hearing moved: keep the public ask up until ${dayWords(it.h.scheduled_at)}?`, href: billRoute(b), what: 'Keep the public ask up?',
      rowBtn: btn('Keep it up', { kind: 'secondary', sm: true, attrs: { 'data-t6act': 'askup', 'data-t6k': it.key } }), buttons: k => [btn(`Keep it up until ${dayWords(it.h.scheduled_at)}`, { kind: k, attrs: { 'data-t6act': 'askup', 'data-t6k': it.key } })] };
    case 'partner': return pqRow(it.p);
    case 'prep': {
      const pt = it.pt, left = pt.total - pt.ready, href = pt.back.length ? issueHref(pt.back[0], 'prep') : issueHref(pt.next, 'prep'), list = prepListHref();
      const label = pt.back.length ? 'Open what came back' : left ? 'Open the next one' : 'See the list';
      // A prep date that has passed is "Still to finish", never red (spec 6, My issues; V30).
      const when = prepDue() < Date.now() ? 'still to finish' : `due ${dayWords(prepDue())}`;
      return { name: pt.own ? 'Your issues for 2027' : `Helping ${pt.owners.map(a => first(a.id)).join(' and ')}`, num: '', line: `${pt.ready} of ${plural(pt.total, 'issue')} ready · ${when}`, href, pick: false,
        what: pt.own ? 'Get your issues ready for 2027' : `${helpWords(pt)} ready`, sub: `${pt.ready} of ${plural(pt.total, 'issue')} ready.${pt.back.length ? ` ${first(pt.back[0].prep_by)} sent back ${pt.back[0].name}.` : pt.next ? ` Next: ${pt.next.name}.` : ''}`,
        buttons: k => [btn(label, { kind: k, icon: 'arrow-right', href }), btn('See the list', { kind: 'text', href: list })] };
    }
  }
  return { name: it.key, num: '', line: '', href: '#/', buttons: () => [] };
}

// A helper's part of the 2027 prep, about the issues, not the person: "Help Rick get 2 issues ready" (Nate's walk: "Help
// Rick get their issues ready" read oddly about one named person). The issues still to finish that they help on.
const helpWords = pt => `Help ${pt.owners.map(a => first(a.id)).join(' and ')} get ${plural(Math.max(1, pt.total - pt.ready), 'issue')}`;

// ---- the card and the open item ----
// "Your next step": the step card with the screen's one filled button (V11). Testimony and chair asks are steps.js's card;
// everything else is drawn in the same card so it reads the same (V07).
function nextCard(it, v = S.me, id = 't6-next-h') {
  if (!it) return '';
  REG.set(it.key, it);
  // compact: the Write, Approve, File track, who files it and who is going are said in the open item and on the bill (V01).
  if (it.s && it.b && it.kind !== 'stale') return shared(stepCard(it.b, { viewer: v, where: 'today', d: it.kind === 'chair' || it.kind === 'followask' ? null : it.d ?? null, h: it.kind === 'chair' || it.kind === 'followask' ? null : it.h ?? null, primary: true, id, from: 'today', compact: true }), it, v);
  if (it.kind === 'partner') return pqCard(it.p, { id });
  return miniCard(it, { primary: true, v, id });
}
// A writing step more than one person holds (W6's fallback: the draft's writer, else the coalition's helpers) says so on
// its card, "Shared with Lauren: whoever does it first", so neither waits for the other nor both revise one Doc (the
// critic: SB 3234's resubmit was the filled next step on Patti's and Lauren's Today, neither saying the other might).
// Once one sends it, it leaves the other's Today, as every done step does.
function sharedWords(it, v = S.me) {
  const wh = it?.s?.whose; if (!wh || !wh.you || wh.role !== 'write' || (wh.ids || []).length < 2) return '';
  return `Shared with ${orWords(wh.ids.filter(id => id !== v.id), v, { and: true })}: whoever does it first`;
}
function shared(html, it, v = S.me) {
  const words = sharedWords(it, v); if (!words) return html;
  const note = `<p class="t6-shared">${icon('users')}<span>${esc(words)}</span></p>`;
  // (the meta line holds spans only, so its first </div> is its own)
  return /<div class="v6-step-meta">/.test(html) ? html.replace(/(<div class="v6-step-meta">[\s\S]*?<\/div>)/, `$1${note}`) : html.replace(/(<h3 class="v6-step-what"[\s\S]*?<\/h3>)/, `$1${note}`);
}
function miniCard(it, { primary = true, v = S.me, id = 't6-next-h' } = {}) {
  if (it.kind === 'stale') {
    const d = it.d, b = it.b;
    return `<section class="v6-step own named w-today t6-mini" aria-labelledby="${id}">
      <p class="v6-step-bill"><span class="v6-step-bn">${esc(nameWords(b))}</span> <span class="v6-row-num">${esc(numWords(b))}</span></p>
      <h3 class="v6-step-what" id="${id}">Check your testimony against the new version</h3>
      <p class="v6-step-when">${esc(`The bill is now ${versionWords(b.current_version)}; your testimony was written for ${versionWords(d.version)}. It is ${lower(testimonyState(d, b)?.word || 'with an approver')}.`)}</p>
      ${d.doc_url ? `<div class="v6-step-acts">${docBtn(d.doc_url, { kind: primary ? 'primary' : 'secondary' })}</div>` : ''}</section>`;
  }
  const r = miniOf(it, v), k = primary ? 'primary' : 'secondary';
  // The 2027 issues are due on a day, and a passed day is "Still to finish", never red (V30).
  const tile = it.kind === 'prep' ? statusTile({ tone: 'neutral', icon: 'calendar', words: it.at < Date.now() ? 'Still to finish' : `Due ${dayWords(it.at)}` })
    : it.at != null ? statusTile(it.tone === 'overdue' ? status({ due: it.at, kind: it.kind }) : { tone: 'neutral', icon: 'calendar', words: actBy({ kind: 'due', due: it.at, verb: 'Due' }).words }) : '';
  return `<section class="v6-step own named w-today t6-mini" aria-labelledby="${id}">
    <p class="v6-step-bill"><span class="v6-step-bn">${esc(r.name)}</span>${r.num ? ` <span class="v6-row-num">${esc(r.num)}</span>` : ''}</p>
    <h3 class="v6-step-what" id="${id}">${nw(esc(r.what || r.line))}</h3>
    ${tile ? `<div class="v6-step-meta">${tile}</div>` : ''}
    ${r.sub ? `<p class="v6-step-when">${nw(esc(r.sub))}</p>` : ''}
    <div class="v6-step-acts">${r.buttons(k).filter(Boolean).join('')}</div></section>`;
}
// The open item beside the list (or its own page below 1100px): billpane.js's open item, drawn here with the draft or
// sitting the row is about (openItem takes the bill only; see the report's shared change), with the bill's other own
// items folded under "Also on this bill · 2" (spec 5: in place of "+N on this bill"). Each is also its own row in the list,
// so the fold hides nothing a person must do, and the item ends near its step card: open beside a laptop's list it fits
// the window (the critic: Also on this bill sat cut at the foot of the sticky panel and looked empty).
function itemFor(key, v = S.me) {
  const it = REG.get(key); if (!it) return '';
  const close = closeBtn();
  if (it.kind === 'partner') return pqItem(it.p, { close });
  if (!it.b || !(it.s || it.kind === 'todo' || it.kind === 'rally' || it.kind === 'moved' || it.kind === 'askup')) {
    const r = miniOf(it, v);
    return `<div class="v6-item t6-item" data-v6item="${esc(it.key)}"><div class="v6-item-top"><p class="v6-item-num">${esc(r.num || '')}</p>${r.href && r.href !== '#/' ? `<a class="v6-item-open" href="${esc(r.href)}"><span>${it.kind === 'followup' ? 'Open their page' : 'Open it'}</span>${icon('arrow-right')}</a>` : ''}${close}</div>
      <h2 class="v6-item-name" id="v6-item-h" tabindex="-1">${esc(r.name)}</h2>${miniCard(it, { primary: false, v, id: 't6-item-h3' })}</div>`;
  }
  const b = it.b, sum = b.nickname ? blurb(b, 240) : '';
  const card = it.s && it.kind !== 'stale' ? shared(stepCard(b, { viewer: v, where: 'pane', d: it.kind === 'chair' || it.kind === 'followask' ? null : it.d ?? null, h: it.kind === 'chair' || it.kind === 'followask' ? null : it.h ?? null, primary: false, named: false, from: 'today' }), it, v)
    : miniCard(it, { primary: false, v, id: 't6-item-h3' });
  // By key: work() draws fresh items each tick, so the item itself is never the same object (the critic: every open item
  // listed its own step again under "Also on this bill").
  const alsoL = work(v).own.filter(x => x.key !== it.key && x.b && x.b.id === b.id), also = alsoL.map(x => `<li class="v6-also-item"><span class="v6-also-t">${nw(esc(lineOf(x, v)))}</span></li>`).join('');
  const shown = it.s?.h && it.kind !== 'chair', facts = aboutBill(b, { hearing: !shown });
  return `<div class="v6-item t6-item" data-v6item="${esc(b.id)}">
    <div class="v6-item-top"><p class="v6-item-num">${esc(numWords(b))}</p><a class="v6-item-open" href="${esc(billRoute(b))}" data-bill="${esc(b.id)}"><span>Open the bill</span>${icon('arrow-right')}</a>${close}</div>
    <h2 class="v6-item-name" id="v6-item-h" tabindex="-1">${esc(nameWords(b, 160))}</h2>
    ${sum ? `<p class="v6-item-sum">${esc(sum)}</p>` : ''}${card}
    ${also || facts ? `<div class="v6-item-doors">${also ? `<details class="v6-item-det t6-also"><summary class="v6-item-door">${icon('list')}<span>Also on this bill · ${alsoL.length}</span>${icon('chevron-down')}</summary><ul class="v6-also-list">${also}</ul></details>` : ''}${facts ? `<details class="v6-item-det"${S.v6About?.[b.id] ? ' open' : ''} data-v6about="${esc(b.id)}"><summary class="v6-item-door">${icon('info')}<span>About this bill</span>${icon('chevron-down')}</summary><div class="v6-item-about">${facts}</div></details>` : ''}</div>` : ''}
  </div>`;
}
const lineOf = (it, v) => (it.s && !['followask', 'stale'].includes(it.kind) ? it.s.line : it.kind === 'followask' ? it.s.line : it.kind === 'stale' ? `Check your testimony: the bill is now ${versionWords(it.b.current_version)}` : miniOf(it, v).line) + sitSuffix(it, v);

// ---- the one-line doors (each one labelled control, never a list of other people's steps: D4, V15) ----
const lineA = (href, ic, html, { cls = '', attrs = '' } = {}) => `<a class="t6-line${cls ? ' ' + cls : ''}" href="${esc(href)}"${attrs}>${icon(ic)}<span class="t6-lt">${html}</span>${icon('chevron-right', { cls: 't6-chev' })}</a>`;
const lineB = (data, ic, html) => `<button type="button" class="t6-line" ${data} aria-haspopup="dialog">${icon(ic)}<span class="t6-lt">${html}</span>${icon('chevron-right', { cls: 't6-chev' })}</button>`;
// A share to-do (migration 112, the bill owner's) is the rallier's public ask (11.6): { h, rl (the ralliers), due (OUTREACH's
// time) }, or null for any other task. Team and the slipping count say it as the rallier's, by that time (one owner and one
// time for one act, as on Today: the critic's Kevin and Saya).
// It is folded into the rallier's row only when the rallier has that row (build: a strong position on a public bill, the
// sitting ahead); on any other bill it is null, the owner's own to-do at its own time (R-274), so Today, Team, Slipping and
// the bill page never hand it to someone whose Today will not show it.
const rallies = (b, h) => !!b && !!h && ['strongly_support', 'strongly_oppose'].includes(b.position) && !!b.is_public && !diedish(b)
  && b.tracked !== false && h.status !== 'cancelled' && ms(h.scheduled_at) > Date.now();
export function shareAsk(t) {
  if (!t || t.kind !== 'todo' || !t.b || !ASK_RX.test(t.t?.title || '')) return null;
  const h = shareHearing(t.b, t.t), rl = rallierOf(t.b).filter(live);
  if (!rl.length || !rallies(t.b, h)) return null;
  return { h, rl, due: askDueAt(h) };
}
// "Saya writes the public ask" (the rally row's one verb, C-15), from the reader's side ("You write the public ask").
export const shareWords = (sa, v = S.me) => `${cap(orWords(sa.rl, v))} ${sa.rl.length > 1 || sa.rl.includes(v?.id) ? 'write' : 'writes'} the public ask`;
// The bill page's line for a share to-do (F115): said as Today and Team say it, with whose to-do it is ("Saya writes the
// public ask · by tomorrow 4:00 PM (Kevin's to-do)"), or null when the to-do is its owner's own (not folded).
export function shareTodoWords(b, t, v = S.me) {
  const sa = shareAsk({ kind: 'todo', b, t, due: null }); if (!sa) return null;
  const by = t.assignee_id && !sa.rl.includes(t.assignee_id) ? (t.assignee_id === v?.id ? 'your to-do' : `${first(t.assignee_id)}’s to-do`) : '';
  return { title: shareWords(sa, v), when: sa.due != null ? `by ${whenAt(sa.due)}` : '', by, due: sa.due, mine: sa.rl.includes(v?.id) };
}
// v5's Slipping (today5.js), with a public ask counted only once its own time is a day or less away (v5's slipping window),
// so Today's line and Team's block count the same rows. Plus the testimony nobody holds whose time to act is today or
// tomorrow (Nate's walk: HB 2300's approved testimony, to file by tomorrow 11:00 AM, was on no one's Today and not here):
// a row with no one on it (`nob`, its billStep), "No owner yet · file by tomorrow 11:00 AM", Give to… or Take it.
export function slipList() {
  const sl = slipNow(), now = Date.now();
  const rows = sl.rows.map(r => {
    const tasks = (r.tasks || [r.p]).filter(t => { const a = shareAsk(t); return !a || a.due == null || a.due - now <= DAY; });
    return tasks.length ? (tasks[0] === r.p ? r : { ...r, tasks, p: tasks[0], due: tasks[0].due }) : null;
  }).filter(Boolean);
  const held = new Set(rows.filter(r => r.b && !(r.ids || []).length).map(r => r.b.id)), eot = endOfDay(now + DAY);
  for (const b of noOwnerBills()) {
    if (held.has(b.id)) continue;
    const s = billStep(b, { viewer: S.me });
    if (!s?.state || !s.nobody || s.act?.at == null || s.act.at > eot) continue;
    rows.push({ key: 'sl:no:' + b.id, b, ids: [], tasks: [], p: null, nob: s, due: s.due, at: s.act.at });
  }
  return { ...sl, rows };
}
// Leads (admins and second approvers): v5's Slipping, as one line that opens Team. Red only when something on it is overdue.
function leadLine() {
  if (!isLead()) return '';
  let sl; try { sl = slipList(); } catch (e) { console.error(e); return ''; }
  const n = sl.rows.length; if (!n) return '';
  const now = Date.now(), over = sl.rows.filter(r => r.nob ? r.nob.act?.kind === 'overdue' : r.p && r.p.due != null && r.p.due <= now && !(r.p.h && ms(r.p.h.scheduled_at) > now && /file|review|revise|submit|write/.test(r.p.kind))).length;
  // Someone else's late step is said in words, never in colour (D3): the lead's own late work is on their own rows.
  return lineA('#/team', 'users', `<b>${n} slipping</b> on the team${over ? ` · ${over} overdue` : ''}`, { cls: 't6-lead' });
}
// Each door is one short line (integrator 23 Oct: "doors as short lines"): the subject and at most one more fact. A lead's
// slipping line is the first door, wherever the doors are (the side column from 1100px; after the lists while an item is
// open there, and below 1100px), never above the list: a row opened beside it never moves (the critic: B-4, A-24).
function doorLines(w, v = S.me, { coal = true, lead = '', leadShown = !!lead } = {}) {
  const out = lead ? [lead] : [];
  // An admin's one line when the bill sync has not finished in a day and a half (F65; live only, in plain words, D3).
  if (v.is_admin && v.id === S.me?.id && !DEMO && !SESSION_OVER) {
    const lastOk = (S.syncRuns || []).find(r => r.ok)?.finished_at, failed = (S.syncRuns || [])[0]?.ok === false, hrs = lastOk ? Math.round((Date.now() - ms(lastOk)) / HR) : null;
    if (failed || hrs == null || hrs > 36) out.push(lineA('#/setup/sync', 'refresh-cw', `<b>${hrs == null ? 'The bill sync has not finished recently' : `The bill sync last finished ${hrs > 47 ? Math.round(hrs / 24) + ' days' : hrs + ' hours'} ago`}</b> · Check it`));
  }
  if (w.waiting.length) out.push(lineA('#/', 'hourglass', `<b>Waiting on others</b> · ${w.waiting.length}`, { attrs: ' data-v6pick="waiting" data-t6wait' }));
  // D1: the bills still to ask that are not rows here, counted and said as Get hearings counts them for My bills ("17 of
  // your bills to ask": the tab, the line under This week and this door give one number for one pile, A-14; the critic:
  // "bills need a hearing", "hearing asks" and "to ask" were three numbers). The rows plus this door make the tab's count.
  // One count for the pile, Get hearings' own (push.js toAskWords: "20 to ask · first by Mon 3/23"), the same on Bills and
  // Hearings; said once on the page: the season card's deadline line says it when it is drawn (w.askSaid).
  const sm = (S.bills || []).some(b => owns(v.id, b)) ? mineAsks(v) : null;
  if (w.asks.length && !w.askSaid && sm?.toAsk) out.push(lineA('#/hearings/ask?scope=mine', 'landmark', boldLead(toAskWords(sm))));
  if (w.coal.size && coal) {
    const owners = [...w.coal.entries()].sort((x, y) => y[1].n - x[1].n), n = owners.reduce((s, [, e]) => s + e.n, 0);
    const who = orWords(owners.map(([id]) => id), v, { and: true });
    // D4's own words: "Lauren has 15 hearing asks · Offer to help", opening the coalition's Get hearings board (My
    // coalitions), where "I'll ask" takes one on. The count is every bill still to ask, so no "this week" (Nate's walk:
    // "Lauren's bills: 15 to ask" read as Patti's own backlog). A door, never the screen's filled button.
    out.push(lineA('#/hearings/ask?scope=coal', 'hand-heart', `<b>${esc(cap(who))} ${owners.length > 1 ? 'have' : 'has'} ${plural(n, 'hearing ask')}</b> · Offer to help`, { attrs: ` aria-label="${esc(`Offer to help ${who}: ${plural(n, 'hearing ask')}`)}"` }));
  }
  // This week's asks the viewer rallies that are still to write and not already a row here (Nate's walk: after Saya wrote
  // HB 2121's ask, "1 public ask" counted it, which read as one more to do); none left, no line.
  const rally = w.rally.filter((x, i, a) => a.findIndex(y => y.b.id === x.b.id) === i && !liveAsk(x.b) && !w.own.some(o => o.b?.id === x.b.id && (o.kind === 'rally' || o.share)))
    .sort((x, y) => askDueAt(x.h) - askDueAt(y.h));
  if (rally.length) out.push(lineA('#/outreach', 'megaphone', `<b>${plural(rally.length, 'public ask')} to write</b> · ${rally.length > 1 ? 'first ' : ''}by ${nw(esc(whenAt(askDueAt(rally[0].h))))}`));
  // Whoever may hand them (an admin, an issue's owner): the same count and word as Team's block and bar (noOwnerBills).
  // A lead reads the bills with no owner on Team (its own block, the slipping line's door just above), so the count is not a
  // second door to Team here; an issue's owner, who has no Team, keeps the line to My issues.
  const no = isLead(v) && leadShown ? [] : noOwnerBills(v);
  if (no.length) out.push(lineA(isLead(v) ? '#/team?who=none' : '#/my-issues', 'user-round', `<b>${plural(no.length, 'bill')} with no owner</b>`));
  if (admitsPartners(v)) {
    // The words to approve are this person's own rows here (Partner words to approve), so the line leaves them out.
    const pl = partnersLine(v, { words: false }); if (pl) out.push(pl);
    if (S.pqErr) out.push(`<p class="t6-quiet">${icon('circle-alert')}<span>The partners’ words did not load.</span>${btn('Try again', { kind: 'text', sm: true, attrs: { 'data-t6act': 'pqretry' } })}</p>`);
  }
  return out;
}
// The partners' one line on Today and on Team, built once so both say the same parts in the same words (rule 6; the critic:
// "1 group to approve, 1 to join" here beside Team's "1 group to approve · 1 group asks to join"). `words: false` leaves out
// the partners' words to approve where they are the person's own rows (Today).
export function partnersLine(v = S.me, { words = true } = {}) {
  if (!admitsPartners(v)) return '';
  const n = words && approvesPartners(v) ? pqItems().length : 0, o = pqOthers();
  const parts = [n ? `${plural(n, 'set')} of words to approve` : '', o.groups.length ? `${plural(o.groups.length, 'group')} to approve` : '',
    o.requests.length ? `${o.requests.length} asking to join` : ''].filter(Boolean);   // short: a door is one line (integrator)
  // With words to approve it opens Partners on them (#/partners?view=approve: the first set open beside the list), so
  // Team's "3 sets of words to approve" lands on what it counts.
  return parts.length ? lineA(n ? '#/partners?view=approve' : '#/partners', 'handshake', `<b>Partners</b> · ${esc(parts.join(' · '))}`) : '';
}

// The next deadline that bills with no hearing yet are racing, from the viewer's own bills (Bills' Mine): sessionClock's.
function noHearingClock(v) {
  let c; try { c = sessionClock((S.bills || []).filter(b => b.tracked !== false && (v.id === S.me?.id ? isMine(b) : owns(v.id, b)))); } catch { return null; }
  return !c ? null : c.noHearing.length ? c : c.then && c.then.noHearing.length ? c.then : null;
}
// The viewer's own bills still to ask, worked out once a draw (Get hearings' My bills count).
const mineAsks = v => v.id === S.me?.id ? memo('asks:' + v.id, () => { try { return askSummary({ scope: 'mine', viewer: v }); } catch (e) { console.error(e); return null; } }) : null;
// "20 to ask · first by Mon 3/23" with its count part in ink ("<b>20 to ask</b> · …").
const boldLead = t => { const m = /^([^·;]+)([·;][\s\S]*)?$/.exec(t || ''); return m ? `<b>${esc(m[1].trim())}</b>${m[2] ? esc(m[2].startsWith(';') ? m[2] : ' ' + m[2]) : ''}` : esc(t); };
// Bills with a position and no owner: one count and one word, "no owner", on Today's line, Team's block, its bar and its
// list (the critic: Today's "9 bills no one holds" against Team's "10 bills have no owner" and a bar of 9). `v` narrows it
// to the bills that person may hand (an admin: all of them; an issue's owner: their issue's bills).
export function noOwnerBills(v = null) {
  if (SESSION_OVER) return [];
  return (S.bills || []).filter(b => isPos(b) && !diedish(b) && !ownerOf(b) && (!v || takeFor(b, v)))
    .sort((x, y) => (x.priority || 9) - (y.priority || 9) || String(x.bill_number).localeCompare(String(y.bill_number), 'en', { numeric: true }));
}

// ---- the season card (V30; F30 on a hearing day; F70 between sessions) ----
// The person's sittings today: a bill they own, follow, write, approve or file on, a sitting they are going to, or (a
// coalition helper) their coalition's bills. Kris helps on every coalition as an approver ('all'), so hers are her own.
function sittingsToday(v = S.me, w = work(v)) {
  const now = Date.now(), day = hday(now), seen = new Map();
  const stepBills = new Set(w.own.filter(i => i.b && i.h).map(i => `${i.b.id}|${i.h.committee}|${i.h.scheduled_at}`));
  for (const h of S.hearings || []) {
    if (h.status === 'cancelled' || hday(ms(h.scheduled_at)) !== day || ms(h.scheduled_at) < now - 3 * HR) continue;
    const b = billById(h.bill_id); if (!b || b.tracked === false) continue;
    const k = `${h.committee}|${h.scheduled_at}`;
    // A sitting with only bills we monitor is not the person's hearing day, unless they are going to it.
    const mine = (S.attend?.[h.id] || []).includes(v.id) || stepBills.has(`${b.id}|${h.committee}|${h.scheduled_at}`) || (isPos(b) && (owns(v.id, b) || inCoal(v, b) || (v.id === S.me?.id && S.follows?.has(b.id))));
    if (mine && !seen.has(k)) seen.set(k, h);
  }
  return [...seen.values()].sort((x, y) => ms(x.scheduled_at) - ms(y.scheduled_at));
}
// `drop(h)`: the bills on a sitting whose own step the page draws elsewhere (the next-step card, the list's rows), left out of
// its card; `skipH`: the sitting the next-step card (or the quiet day's card) already names, so "Your next hearing" is not
// said again under it (A-14; the critic: the same hearing twice, one card above the other).
function seasonCard(v = S.me, w = work(v), { where = 'col', hearings = null, drop = null, skipH = null } = {}) {
  w.prepIsNext = !!w.prep && groupsOf(w).next === w.prep;
  const sits = hearings ?? sittingsToday(v, w), id = `t6-season-${where}`;
  if (sits.length) return `<section class="t6-season t6-hday" aria-labelledby="${id}"><h2 class="t6-sh" id="${id}">${sits.length > 1 ? 'Your hearings today' : 'Your hearing today'}</h2>
    ${sits.map((h, i) => sittingCard(h, { v, id: `t6-hc-${where}-${i}`, drop: drop ? drop(h) : null })).join('')}</section>`;
  const season = seasonOf(), body = seasonBody(season, v, w, { skipH });
  if (!body) return '';
  return `<section class="t6-season" aria-labelledby="${id}"><h2 class="t6-sh" id="${id}">${esc(body.title)}</h2>${body.html}</section>`;
}
const sitKey = h => `${h.committee}|${h.scheduled_at}`;
// A sitting's card with each of the viewer's own steps said once (A-14; the critic's 3 and 4). `drop`: bill ids whose step
// is drawn elsewhere on the page; `lead`: the next step when it is on this sitting, whose row moves first and carries the
// screen's one filled button, in its own colour when it is late (V14: on a hearing day the card is that step's home, at
// every width: the critic's 4 and 11, one next-step rule for laptop and phone; D3). `own`: bill ids whose step is the
// viewer's, kept in sight; on a phone's big card (`big`) everyone else's rows fold into one "Team testimony · 3" line
// (spec 6, Today on a phone on a hearing day: "others' revisions folded"), so Kris's Friday is one screen and a half.
// Done on hearingCard's HTML here until steps.js takes { omit, lead, fold } (asked as a shared change).
const LI = /<li class="v6-hcard-bill"><a class="v6-hcard-bl" href="([^"]*)"[\s\S]*?<\/li>/g;
// The bills on a sitting that are the viewer's in any way: owned, written (sent for approval), filed, approved, or whose
// step is theirs now. On a phone's big card these are never folded (Nate's walk: Lauren's own HB 1523, which Patti files,
// sat under "Team testimony" with its "late, still accepted" hidden on the day it mattered; rule 7.3).
function theirsOn(h, v) {
  const out = new Set();
  for (const r of S.hearings || []) {
    if (r.committee !== h.committee || r.scheduled_at !== h.scheduled_at) continue;
    const b = billById(r.bill_id); if (!b) continue;
    const ds = (S.drafts?.[b.id] || []).filter(d => d.committee === h.committee && d.status !== 'cancelled');
    if (owns(v.id, b) || ds.some(d => d.submitted_by === v.id || filerOf(d) === v.id || d.approved_by === v.id || d.second_approved_by === v.id || whoseStep(d, b, { viewer: v, h: r }).you)) out.add(b.id);
  }
  return out;
}
function sittingCard(h, { v = S.me, big = false, id = '', drop = null, lead = null, own = null } = {}) {
  // No "Watch it live" here: a detail of the sitting (its page and Hearings › This week keep it), so Today keeps to the
  // person's own work (integrator: trim what is not the person's own row; Nate's Today was 32 controls against 30).
  let html = hearingCard(h, { viewer: v, big, from: 'today', id, watchLink: false });
  const hrefOf = b => esc(billRoute(b)), ids = x => new Set([...(x || [])].map(i => billById(i)).filter(Boolean).map(hrefOf));
  const gone = ids(drop), mine = ids(own ? [...own, ...theirsOn(h, v)] : null);
  const leadHref = lead?.b ? hrefOf(lead.b) : null, tone = lead?.s?.status?.tone;
  let leadLi = '';
  const team = [];
  html = html.replace(LI, (li, href) => {
    if (href === leadHref && !leadLi) {
      leadLi = li.replace('class="v6-hcard-bill"', 'class="v6-hcard-bill t6-hc-lead"').replace(/class="btn secondary sm"/, 'class="btn primary"')
        .replace(/class="v6-row-line(?: t-\w+)?/, `class="v6-row-line${tone === 'late' || tone === 'overdue' ? ' t-' + tone : ''}`);
      // A writing step two people hold says so here too, as on the step card (sharedWords).
      const sw = sharedWords(lead, v); if (sw) leadLi = leadLi.replace('</a>', `<span class="t6-shared">${icon('users')}<span>${esc(sw)}</span></span></a>`);
      return '';
    }
    if (gone.has(href)) return '';
    if (big && own && !mine.has(href)) { team.push(li); return ''; }
    return li;
  });
  if (leadLi) html = html.replace('<ul class="v6-hcard-bills">', `<ul class="v6-hcard-bills">${leadLi}`);
  // The team's rows, folded under one line that still says how many (nothing of the viewer's own is in it: rule 3).
  const fold = team.length ? `<details class="t6-hcteam"><summary>${icon('users')}<span><b>Other team testimony</b> · ${team.length}</span>${icon('chevron-down', { cls: 't6-chev' })}</summary><ul class="v6-hcard-bills">${team.join('')}</ul></details>` : '';
  // With no bill left to list, the card is the sitting itself: its time, room, who is going and the stream.
  if (/<ul class="v6-hcard-bills">\s*<\/ul>/.test(html)) html = html.replace(/<ul class="v6-hcard-bills">\s*<\/ul>/, fold ? '<!--t6fold-->' : '').replace('<span>Also heard: ', '<span>');
  else if (fold) html = html.replace(/(<ul class="v6-hcard-bills">[\s\S]*?<\/ul>)/, '$1<!--t6fold-->');
  return fold ? html.replace('<!--t6fold-->', fold) : html;
}
function seasonBody(season, v, w, { skipH = null } = {}) {
  const now = Date.now(), p = (txt, ic = '') => `<p class="t6-sl">${ic ? icon(ic) : ''}<span>${txt}</span></p>`;
  if (season === 'prep' || season === 'between') {
    const pt = prepTaskOf(v.id), ended = endedLine();
    if (season === 'prep' && pt && !(w.prepIsNext)) {
      const left = pt.total - pt.ready, href = pt.back.length ? issueHref(pt.back[0], 'prep') : issueHref(pt.next, 'prep');
      const line = pt.own ? `${pt.ready} of ${plural(pt.total, 'issue')} ready${prepDue() < now ? ' · still to finish' : ` · due ${esc(dayWords(prepDue()))}`}` : `${esc(helpWords(pt))} ready${prepDue() < now ? ' · still to finish' : ` · due ${esc(dayWords(prepDue()))}`}`;
      return { title: 'Getting ready for 2027', html: lineA(href, 'clipboard-list', `<b>${pt.back.length ? 'Open what came back' : left ? 'Open the next one' : 'See the list'}</b> · ${line}`) + `${setupLine(v)}${ended}` };
    }
    if (season === 'prep' && !pt && (S.issues || []).some(i => i.owner_id === v.id || (S.issueHelpers || []).some(h => h.issue_id === i.id && h.advocate_id === v.id)))
      return { title: 'Getting ready for 2027', html: p('Your part is done. Mahalo.', 'circle-check') + setupLine(v) + ended };
    const su = season === 'prep' ? setupLine(v) : '';
    return ended || su ? { title: season === 'prep' ? 'Getting ready for 2027' : 'Between sessions', html: su + ended } : null;
  }
  if (season === 'opening') {
    const sorts = v.is_admin || (S.bills || []).some(b => owns(v.id, b));
    const n = sorts ? S.tdTriage?.suggested || S.tdTriage?.undecided || 0 : 0;
    // Each a one-line door, its subject first (integrator: the season card compact; a sentence and a button under it took two
    // rows for one link).
    if (n) return { title: 'New bills to sort', html: lineA('#/bills/new', 'sparkles', `<b>Sort new bills</b> · ${plural(n, 'new bill')} to decide on`) };
    return { title: 'The session opens', html: v.is_admin ? lineA('#/setup', 'settings', '<b>Session setup</b> · check it before the first hearings')
      : lineA('#/me', 'bell', '<b>My settings</b> · check how the tracker reaches you before the first hearings') };
  }
  if (season === 'conference') {
    const mine = (S.bills || []).filter(b => (owns(v.id, b) || inCoal(v, b)) && stopOf(b).phase === 'conference' && !diedish(b));
    const fd = (DEADLINE_ROWS || []).find(r => r.key === 'final_decking')?.deadline_date;
    return { title: 'Bills in conference', html: p(mine.length ? `${plural(mine.length, 'of your bills is', 'of your bills are')} in conference${fd ? ` · the House and Senate must agree by ${esc(dayWords(fd))}` : ''}.` : 'The House and Senate are working out their differences in conference.', 'users')
      + lineA('#/inbox?view=updates', 'users', '<b>Who the conferees are</b> · the Capitol’s notice is in Inbox › Updates') };
  }
  if (season === 'governor') {
    const sine = (DEADLINE_ROWS || []).find(r => r.key === 'sine_die')?.deadline_date;
    const mine = (S.bills || []).filter(b => (owns(v.id, b) || inCoal(v, b)) && ['governor', 'law'].includes(stopOf(b).phase));
    return { title: 'With the governor', html: p(`${mine.length ? `${plural(mine.length, 'of your bills went', 'of your bills went')} to the governor. ` : ''}${sine ? `The governor names the bills that may be vetoed by about ${esc(dayWords(vetoDay(sine, 35)))}.` : ''}`, 'landmark') };
  }
  // Hearings, February to April: the person's next hearing and the next deadline, in words (V05).
  const nh = nextHearing(v, w), dl = nextDeadline(v), said = !!nh && skipH === sitKey(nh);
  // The deadline line leads with the number that needs action, the bills still to ask, in Get hearings' words, and opens
  // Get hearings (B-3; Nate's walk: Kevin's "6 of your bills must reach their last committee" beside Bills' 3 and Get
  // hearings' 3, with no link). With nothing to ask it is the deadline itself, in words.
  // (for someone who owns bills; a helper's are D4's line) The deadline's count is Bills' own: the bills with no hearing yet
  // racing the next deadline that leaves any (model.js sessionClock, Bills' banner), so the two screens say one thing.
  const ownsAny = (S.bills || []).some(b => owns(v.id, b)), sm = ownsAny ? mineAsks(v) : null, ck = sm?.toAsk ? noHearingClock(v) : null;
  const askT = !sm?.toAsk ? '' : ck ? toAskWords(sm, { dlN: ck.noHearing.length, dlDay: dayWords(ck.date) }) : toAskWords(sm);
  if (askT) w.askSaid = true;
  const parts = [said ? '' : nh ? p(`Your next hearing: ${nw(esc(whenAt(nh.scheduled_at)))} · ${esc(committeeName(nh.committee) || nh.committee)}`, 'landmark') : noHearingLine(v, w, p),
    askT ? lineA('#/hearings/ask?scope=mine', 'calendar', nw(boldLead(askT))) : dl ? p(`Next deadline ${nw(esc(dayWords(dl.date)))}: ${esc(dl.words)}`, 'calendar') : ''];
  if (!parts.join('')) return null;
  return { title: 'This week', html: parts.join('') };   // Hearings is a place in the sidebar and the phone bar, always in sight
}
// A week with no hearing on the person's own bills, said truthfully (Nate's worst case is the hidden one): a helper's
// coalition hearings counted as theirs ("3 hearings on your coalitions' bills this week · Hearings"; Kris owns none but
// approves for several), and a sitting on a bill only monitored named by its day and time ("No hearings on HIAPA bills we
// support or oppose · 1 on a bill we monitor: Wed 3/18, 2:00 PM"; Julie's said "No hearings" while SB 3142 was heard).
function noHearingLine(v, w, p) {
  const now = Date.now(), wk = now + 7 * DAY, ownsAny = (S.bills || []).some(b => owns(v.id, b)), all = v.prefs?.coalitions === 'all';
  const names = (S.campaigns || []).filter(c => coalIds(v).includes(c.id)).map(c => c.name);
  const onCo = b => all ? (S.billCampaigns?.[b.id] || []).length > 0 : inCoal(v, b);
  const whose = b => owns(v.id, b) || (!ownsAny && onCo(b));
  const pos = new Map(), mon = new Map();
  for (const h of S.hearings || []) {
    const t = ms(h.scheduled_at), b = billById(h.bill_id);
    if (h.status === 'cancelled' || t <= now || t >= wk || !b || b.tracked === false || diedish(b) || !whose(b)) continue;
    (isPos(b) ? pos : mon).set(sitKey(h), { h, b });
  }
  for (const k of pos.keys()) mon.delete(k);
  if (!ownsAny && pos.size) return lineA('#/hearings/week?scope=coal', 'landmark', `<b>${plural(pos.size, 'hearing')} on your coalitions’ bills this week</b> · Hearings`);
  const label = ownsAny ? 'your bills' : names.length ? `${names.join(' and ')} bills` : 'your coalitions’ bills';
  const m = [...mon.values()].sort((x, y) => ms(x.h.scheduled_at) - ms(y.h.scheduled_at));
  if (!m.length) return !ownsAny && !names.length && !all ? '' : p(`No hearings on ${esc(label)} this week.`, 'landmark');
  const at = ms(m[0].h.scheduled_at), when = `${dayWords(at)}, ${timeWords(at)}`;
  return lineA(`#/hearing/${encodeURIComponent(m[0].h.id)}?from=today`, 'landmark', `<b>No hearings on ${esc(label)} we support or oppose</b> · ${esc(m.length === 1 ? '1 on a bill we monitor' : `${m.length} on bills we monitor, the first`)}: ${nw(esc(when))}`);
}
// Between sessions, an admin's one line for Session setup's checklist (Nate's walk: November's Today said nothing while
// it read "Not ready yet · 1 blocking problem"), in its own words, opening it. Read once a visit.
function setupLine(v) {
  if (!v?.is_admin || v.id !== S.me?.id) return '';
  if (S.t6Ready === undefined) { S.t6Ready = null; DB.readiness().then(r => { S.t6Ready = r || []; if (S.route?.name === 'today') hooks.render(); }).catch(() => { S.t6Ready = []; }); return ''; }
  const rows = (S.t6Ready || []).filter(r => !r.waiting);
  const bad = rows.filter(r => r.level === 'block' && r.ok === false).length, todo = rows.filter(r => r.level === 'manual' && !r.ok).length;
  if (!bad && !todo) return '';
  return lineA('#/setup', 'settings', `<b>Session setup:</b> ${esc([bad ? `${bad} blocking` : '', todo ? `${todo} to tick off` : ''].filter(Boolean).join(', '))} · Open`);
}
function nextHearing(v, w) {
  const now = Date.now(), wk = now + 7 * DAY;
  return (S.hearings || []).filter(h => { const t = ms(h.scheduled_at), b = billById(h.bill_id); return h.status !== 'cancelled' && t > now && t < wk && b && isPos(b) && (owns(v.id, b) || inCoal(v, b) || (S.attend?.[h.id] || []).includes(v.id) || w.own.some(i => i.h && i.h.id === h.id)); })
    .sort((x, y) => ms(x.scheduled_at) - ms(y.scheduled_at))[0] || null;
}
// The next Capitol deadline that one of the person's own bills (theirs, or their coalitions') is racing, with how many:
// "Next deadline Mon 3/30: 2 of your bills must reach their last committee". Triple filing binds only bills sent to three
// committees, so a date is never said as if every bill faced it (the critic: every Today said "bills must clear their
// first committee" by Triple filing, against terms.js and Hearings, P-4, C-10). With none of theirs racing one, the next
// date on the calendar with whom it binds, in Hearings' own words ("bills with 3 or more committees clear the first").
function nextDeadline(v) {
  const day = hday(Date.now()), own = (S.bills || []).some(b => owns(v.id, b)), by = new Map();
  for (const b of S.bills || []) {
    if (!isPos(b) || diedish(b) || !(owns(v.id, b) || inCoal(v, b) || (v.id === S.me?.id && isMine(b)))) continue;
    const d = stopOf(b).deadline; if (!d || d.missed || !d.date || String(d.date).slice(0, 10) < day) continue;
    const k = `${String(d.date).slice(0, 10)}|${d.label}`, e = by.get(k) || { label: d.label, date: String(d.date).slice(0, 10), n: 0 }; e.n++; by.set(k, e);
  }
  const e = [...by.values()].sort((x, y) => x.date.localeCompare(y.date) || y.n - x.n)[0];
  if (e) return { ...e, words: /sine die/i.test(e.label) ? 'the session ends' : `${e.n} of ${own ? 'your' : 'your coalition’s'} bills must ${gateNeed(e.label, e.n)}` };
  const r = (DEADLINE_ROWS || []).filter(x => !x.bills && String(x.deadline_date).slice(0, 10) >= day && x.key !== 'intro_cutoff').sort((a, b) => String(a.deadline_date).localeCompare(String(b.deadline_date)))[0];
  return r ? { label: r.label, date: String(r.deadline_date).slice(0, 10), words: gateGloss(r.label) || r.label } : null;
}
// F70: how the last session ended, one line that opens Bills grouped by where they stand.
function endedLine() {
  const yr = (S.bills || [])[0]?.session_year;
  const law = (S.bills || []).filter(b => isPos(b) && stopOf(b).phase === 'law').length;
  if (!law) return '';
  return lineA('#/bills', 'scroll-text', `<b>How the ${esc(yr || 'last')} session ended</b> · ${plural(law, 'of our bills became', 'of our bills became')} law`);
}

// ---- Getting started (V29): new people only, ticking from history, the season's job ----
// The practice copy treats Patti, Julie, Kris and Saya as new (the cold test's people and the assessment's V29 four);
// live, the first 45 days from a person's first sign-in (v5's rule, today5.js startDay). A short list for the first week,
// then one line, gone when every step is done or hidden.
const NEW_IN_DEMO = new Set(['PH', 'JMM', 'KR', 'SY']);
function startedAt(me) {
  if (me.prefs?.started_at) return ms(me.prefs.started_at);
  if (DEMO) return NEW_IN_DEMO.has(me.initials) ? Date.now() : Date.now() - 90 * DAY;
  return null;
}
// The one list is Help's (help.js newSteps: by season and by role, each ticking from what the person has done, the look-only
// ones from the frame's 'v6:route'), so Today and Help say the same steps and the same count (A-14, one source).
function startSteps() { try { return newSteps(); } catch (e) { console.error(e); return []; } }
function startCard(v = S.me, { line = false, bare = false, n: sfx = '' } = {}) {
  if (!v || v.id !== S.me?.id || v.prefs?.firstrun?.hidden) return '';
  const at = startedAt(v); if (at == null || Date.now() - at > 45 * DAY) return '';
  const steps = startSteps(), n = steps.filter(s => s.done).length; if (!steps.length || n === steps.length) return '';
  // After a week it is one line, the way back to the list in Help (V29: it fades); the first week it is the short list: the
  // first three steps still to do, one a line, under "<done> of <total> done" (Help's own count), and the whole list in
  // Help. In the work column it is always the one line (R-316 W7), so the work under it stays on the first screen.
  const a = `<a class="t6-line t6-startln" href="#/help/new">${icon('sparkles')}<span class="t6-lt"><b>Getting started</b> · ${n} of ${steps.length} done</span>${icon('chevron-right', { cls: 't6-chev' })}</a>`;
  if (bare) return a;   // the line alone, the first of the doors (render: nothing listed between it and the next step)
  if (line || Date.now() - at > 7 * DAY) return `<nav class="t6-doors t6-startl" aria-label="Getting started">${a}</nav>`;
  return `<section class="t6-start" aria-labelledby="t6-start-h${sfx}"><h2 class="t6-starth" id="t6-start-h${sfx}">${icon('sparkles')}<span>Getting started</span> <span class="t6-startn">${n} of ${steps.length} done</span></h2>
    <ul class="t6-steps">${steps.filter(s => !s.done).slice(0, 3).map(s => `<li><a class="t6-stp" href="${esc(s.href)}"${s.ext ? ' target="_blank" rel="noopener"' : ''}>${icon('circle-dashed')}<span class="sr">To do: </span><span>${esc(s.title)}</span></a></li>`).join('')}</ul>
    ${steps.length - n > 3 ? `<a class="t6-startall" href="#/help/new">See all ${steps.length} in Help</a>` : ''}</section>`;
}

// ---- Done today (a quiet band, Undo on each) ----
// Each Undo is the toast's Undo (A-16: one look for one act): a tonal pill saying only "Undo", named for screen readers.
// From the drafts' own times (filed, approved, sent for approval today by this person), plus what was done from Today
// this visit (to-dos, follow-ups, the moved-hearing questions), each with its Undo.
const DONE = [];   // { at, words, undo }
function doneToday(v = S.me) {
  const day = hday(Date.now()), out = [];
  for (const d of Object.values(S.drafts || {}).flat()) {
    const b = billById(d.bill_id); if (!b) continue;
    if (d.status === 'filed' && d.filed_by === v.id && d.filed_at && hday(ms(d.filed_at)) === day)
      out.push({ at: ms(d.filed_at), words: `Filed: ${sayWords(b)}`, act: 'unfile', b, d });
    else if (['second_review', 'approved'].includes(d.status) && d.approved_by === v.id && d.approved_at && hday(ms(d.approved_at)) === day && !d.second_approved_by)
      out.push({ at: ms(d.approved_at), words: `Approved: ${sayWords(b)}`, act: 'unapprove', b, d });
    else if (d.status === 'approved' && d.second_approved_by === v.id && d.second_approved_at && hday(ms(d.second_approved_at)) === day)
      out.push({ at: ms(d.second_approved_at), words: `Second look given: ${sayWords(b)}`, act: 'unapprove', b, d });
    else if (d.status === 'review' && d.submitted_by === v.id && d.submitted_at && hday(ms(d.submitted_at)) === day)
      out.push({ at: ms(d.submitted_at), words: `Sent for approval: ${sayWords(b)}`, act: 'withdraw', b, d });
  }
  for (const x of DONE) if (hday(x.at) === day) out.push(x);
  // Approvals made on Today's partner words and in Review's supporter emails (partnerq.js, review.js keep S.v6Done), each
  // with its own Undo, so the Undo outlives the toast (Nate's walk: "Done today · 1" listed only the testimony; B-5).
  for (const x of S.v6Done || []) if (x.by === v.id && hday(x.at) === day) out.push(x);
  return out.sort((x, y) => y.at - x.at);
}
function doneBand(v = S.me) {
  const list = doneToday(v); if (!list.length) return '';
  const open = !!S.t6DoneOpen;
  return `<details class="t6-done"${open ? ' open' : ''} data-t6doneband><summary>${icon('circle-check')}<span><b>Done today</b> · ${list.length}</span>${icon('chevron-down', { cls: 't6-chev' })}</summary>
    <ul class="t6-donel">${list.map((x, i) => `<li><span>${esc(x.words)}</span>${btn('Undo', { kind: 'secondary', sm: true, attrs: { 'data-t6undo': String(i), 'aria-label': `Undo: ${x.words}` } })}</li>`).join('')}</ul></details>`;
}

// ---- the page ----
function dateLine(bd) {
  const day = new Date().toLocaleDateString('en-US', { ...HST, weekday: 'short', month: 'short', day: 'numeric' });
  return `<p class="t6-date${bd.lateN ? '' : ' t6-nolate'}"><span class="t6-day">${esc(day)}</span>${bd.lateN ? `<span class="t6-over">${icon('circle-alert')}${bd.lateN} overdue</span>` : ''}</p>`;
}
const groupHTML = (id, title, rows, extra = '') => rows ? `<section class="t6-group" aria-labelledby="t6-g-${id}"><h2 class="t6-gh" id="t6-g-${id}">${esc(title)}</h2><div class="v6-list t6-list" role="list">${rows}</div>${extra}</section>` : '';

// The whole list for one viewer: the next step, Do today, Coming up. `ro` draws a teammate's list read-only (Team ›
// See as teammate): no buttons, no colour, no Done today, no doors but its own waiting count.
// The next step is worked out once, from everything the person has (the same step at every width: the critic's 4 and 11);
// `skip` only leaves rows out of the groups (a phone's hearing cards carry their own steps), never changes which is next.
export function listHTML(v = S.me, { ro = false, skip = null, hideHear = false } = {}) {
  const w = work(v), g0 = groupsOf(w), nx = g0.next;
  const keep = i => i !== nx && (!skip || !skip(i));
  const today = g0.today.filter(keep), soon = g0.soon.filter(keep), partner = g0.partner.filter(keep), later = g0.later.filter(keep);
  // The line for what is due after the week ahead (groupsOf): its count and its first day, opening the list beside (a teammate's
  // read-only list says it in words only).
  const laterL = later.length ? (ro ? `<p class="t6-quiet t6-later">${icon('calendar-clock')}<span>${esc(`${plural(later.length, 'more', 'more')} later · the first by ${dayWords(later[0].at)}`)}</span></p>`
    : `<nav class="t6-doors t6-later" aria-label="Later">${lineA('#/', 'calendar-clock', `<b>${later.length} more later</b> · the first by ${esc(dayWords(later[0].at))}`, { attrs: ' data-v6pick="later"' })}</nav>`) : '';
  // `hideHear`: the next step's sitting is a card on the same page (a hearing day), so its card leaves out the hearing line.
  const nextH = (n = '') => nx ? `<section class="t6-next${hideHear ? ' t6-nohear' : ''}" aria-labelledby="t6-next-t${n}"><h2 class="t6-nexth" id="t6-next-t${n}">${ro ? `${esc(first(v.id))}’s next step` : 'Your next step'}</h2>${ro ? roCard(nx, v) : nextCard(nx, v, 't6-next-h' + n)}</section>`
    : clearCard(v, w, ro, n);
  const groups = `${groupHTML('today', 'Do today', today.map(i => rowOf(i, { ro, v })).join(''))}${soon.length ? groupHTML('soon', 'Coming up', soon.map(i => rowOf(i, { ro, v })).join(''), laterL) : laterL}${groupHTML('pq', 'Partner words to approve', partner.map(i => rowOf(i, { ro, v })).join(''))}`;
  return { w, g: { today, soon, later, partner, next: nx }, nextH, groups, html: nextH() + groups, rows: today.length + soon.length + partner.length + (later.length ? 1 : 0) };
}
// A teammate's next step, read-only: the step card as Team draws it (no buttons, where 'team'), or the item's words.
function roCard(it, v) {
  REG.set(it.key, it);
  // Said from the reader's side ("Kevin revises the testimony"), with no buttons (where 'team').
  if (it.s && it.b && it.kind !== 'stale') return stepCard(it.b, { viewer: S.me, where: 'team', d: it.kind === 'chair' || it.kind === 'followask' ? null : it.d ?? null, h: it.kind === 'chair' || it.kind === 'followask' ? null : it.h ?? null, primary: false, id: 't6-next-h' });
  const r = it.kind === 'partner' ? { name: it.p.partner_name, num: '', line: 'Partner words to approve' } : miniOf(it, v);
  return `<section class="v6-step others named w-team t6-mini" aria-labelledby="t6-next-h"><p class="v6-step-bill"><span class="v6-step-bn">${esc(r.name)}</span>${r.num ? ` <span class="v6-row-num">${esc(r.num)}</span>` : ''}</p><h3 class="v6-step-what" id="t6-next-h">${nw(esc(r.line))}</h3></section>`;
}
// Nothing of the person's own (F67): a calm sentence, the next hearing, and for someone with no bills and no coalition,
// where to pick one. Never "All clear" over work.
function clearCard(v, w, ro, n = '') {
  const nh = nextHearing(v, w);
  const lost = !ro && !(S.bills || []).some(b => isMine(b)) && !coalIds(v).length && v.prefs?.coalitions !== 'all';
  // (a sitting already drawn as its card on this page is not said again here: A-14)
  const onPage = !!nh && sittingsToday(v, w).some(h => sitKey(h) === sitKey(nh));
  // The next hearing for everyone, a helper too (Nate's walk: Saya's quiet day dropped "Your next hearing" from the season
  // card, guessing this card said it, while it said "Kevin's bills: 2 to ask"). A helper's D4 line is a door under the
  // lists ("Kevin has 2 hearing asks · Offer to help"), never this card's filled button (D4).
  const text = nh && !onPage ? `Next hearing: ${whenAt(nh.scheduled_at)}, ${committeeName(nh.committee) || nh.committee}.` : SESSION_OVER ? 'Hearings return when the next session opens.' : '';
  // With nothing of their own, the one filled button is the next hearing, or Hearings; a helper with the coalition's asks
  // to help with has none (the door is the way, and "Open Get hearings" named a place, not a step).
  const go = ro ? '' : lost ? btn('Pick your coalition', { href: '#/my-issues/coalitions' })
    : nh && !onPage ? btn('Open the hearing', { icon: 'landmark', href: `#/hearing/${encodeURIComponent(nh.id)}?from=today` }) : w.coal.size ? ''
    : ['conference', 'governor'].includes(seasonOf()) ? btn('Open your bills', { icon: 'file-text', href: '#/bills' }) : SESSION_OVER || seasonOf() === 'prep' || seasonOf() === 'between' ? '' : btn('Open Hearings', { icon: 'landmark', href: '#/hearings' });
  return `<section class="t6-clear" aria-labelledby="t6-clear-h${n}"><h2 class="t6-clh" id="t6-clear-h${n}">${ro ? `Nothing is waiting on ${esc(first(v.id))}.` : lost ? 'Pick the coalition you help on' : 'Nothing needs you today.'}</h2>
    ${lost ? '<p>Its hearings and testimony show here once you switch on I help on it.</p>' : text ? `<p>${nw(esc(text))}</p>` : ''}${go ? `<p class="t6-clgo">${go}</p>` : ''}</section>`;
}
// What a draw of Today is made of, worked out once (render, and the side column when a picked item closes).
// Each own step on today's sittings is said once (A-14; the critic's 3 and 4). When the next step is on one of today's
// sittings, that sitting's card is the next step, at every width (the critic's 4 and 11: one next-step rule for laptop and
// phone): its row first with the screen's one filled button, the card's time, room and I'm going around it, under "Your
// next step" (a phone's big card has no heading: its time leads the screen). The person's other own steps on a sitting
// are their rows in the list (a phone keeps them inside the big card, where the team's rows fold).
function plan(v = S.me) {
  const w = work(v), g = groupsOf(w), next = g.next, sits = sittingsToday(v, w), phone = PHONE();
  const onSit = new Set(sits.map(sitKey)), onCard = i => !!(i && i.b && i.h && isPos(i.b) && onSit.has(sitKey(i.h)));
  const phoneDay = phone && sits.length > 0;
  // Only when the card can carry the step's own button (D16), so the filled button is never lost.
  const nextSit = onCard(next) && next.s && rowButtonOK(next.s) ? sits.find(h => sitKey(h) === sitKey(next.h)) || null : null;
  const drop = h => new Set(w.own.filter(i => onCard(i) && sitKey(i.h) === sitKey(h)).map(i => i.b.id));
  // The sitting the next step (or, with nothing to do, the quiet card) already names, so the season card does not.
  const nh = next ? null : nextHearing(v, w), skipH = next?.h ? sitKey(next.h) : nh ? sitKey(nh) : null;
  const rows = [...g.today, ...g.soon, ...g.partner].filter(i => i !== next && !(phoneDay && onCard(i))).length + (g.later.some(i => i !== next) ? 1 : 0);
  // The next step leads the work column at every width, read first, the same order on a laptop and a phone (the critic:
  // A-13, P-2; from 1100px it had sat in the side column under a quiet label, read after "Do today"). On a hearing day the
  // person's other sittings are the side column's season card from 1100px.
  const others = nextSit ? sits.filter(h => h !== nextSit) : sits;
  return { w, g, next, sits, others, phone, phoneDay, onCard, nextSit, nextOnCard: !!nextSit, drop, skipH, rows, hideHear: !!(next && onCard(next)) };
}
// "Your next step": the step card, or on a hearing day the sitting's card with the step's row leading it.
function nextSec(P, L, n = '', v = S.me) {
  if (!P.nextSit) return L.nextH(n);
  return `<section class="t6-next t6-nextsit" aria-labelledby="t6-next-t${n}"><h2 class="t6-nexth" id="t6-next-t${n}">Your next step</h2>${sittingCard(P.nextSit, { v, id: `t6-hcn${n}`, lead: P.next, drop: P.drop(P.nextSit) })}</section>`;
}
function render(route) {
  // v5's This week, under the Hearings stub, until HEARINGS replaces hearings.js (FRAME's stub hands it here).
  if (route?.place === 'hearings' || route?.q?.view === 'week' || route?.q?.view === 'ahead') return v5.render(route);
  const v = S.me;
  if (!v) return `<div class="t6-root"><h1 class="v6-ptitle">Today</h1><p class="t6-quiet">You are signed in, but the tracker does not know who you are. Ask your admin to add you.</p></div>`;
  MEMO.clear(); REG.clear(); seedMoved();
  loads();
  const bd = badgeOf(), P = plan(v), { w, sits, phone, phoneDay } = P;
  const L = listHTML(v, { skip: phoneDay ? P.onCard : null, hideHear: P.hideHear });
  const coal = true, lead = leadLine(), done = doneBand(v);
  // Getting started sits right under the next step (the critic's 11) as one line below 1100px (R-316 W7: its list pushed a
  // 1024 laptop's lists a sixth of a screen down; the line opens it in Help); from 1100px its short list leads the side
  // column (sideHTML) and the line is not drawn, so the rows start where they always do. At the Capitol on a phone's
  // hearing day it is not the job: it waits.
  // With nothing listed under the next step, its line is the first of the doors, which then follow the next step at once
  // (one card fewer: Patti's 1024 Today was 1.38 screens against 1.2).
  const startIn = !phoneDay && !P.rows ? startCard(v, { bare: true }) : '';
  const start = phoneDay || startIn ? '' : startCard(v, { line: true });
  const picked = S.v6ld?.today?.key ?? null, item = picked === 'waiting' ? waitingItem(v) : picked === 'later' ? laterItem(v) : picked != null && REG.has(picked) ? itemFor(picked, v) : '';
  if (picked != null && !item) S.v6ld.today.key = null;
  // A phone's hearing day (V14): one big card per sitting first (time and room at a glance), the person's own step inside
  // it with the filled button, the team's rows folded; the next-step card only when the next step is not on a sitting.
  const big = phoneDay ? `<section class="t6-hday-ph" aria-label="Your hearings today">${sits.map((h, i) => sittingCard(h, { v, big: true, id: `t6-hcb-${i}`, lead: P.nextSit === h ? P.next : null, own: P.drop(h) })).join('')}</section>` : '';
  // Below 1100px (not a phone) the day's other sittings come right under the next step; from 1100px they are in the side
  // column. Any other season card closes the column below 1100px, beside the doors from 768px.
  const seasonCol = phone && sits.length ? '' : seasonCard(v, w, { where: 'col', hearings: P.others, drop: P.drop, skipH: P.skipH });
  // On a phone a lead's slipping line comes right under the next step, on the first screen (v5 had it there; Nate's walk:
  // it was the last thing on a 3.3-screen Today), not among the doors after the lists.
  const leadPh = phone && lead ? `<nav class="t6-doors t6-leadph" aria-label="The team">${lead}</nav>` : '';
  const hday = P.others.length > 0 && !phone, doors = doorsNav([...(startIn ? [startIn] : []), ...doorLines(w, v, { coal, lead: phone ? '' : lead, leadShown: !!lead })]);
  const edge = doors || (!hday && seasonCol) ? `<div class="t6-edges">${doors}${!hday && seasonCol ? `<div class="t6-colonly">${seasonCol}</div>` : ''}</div>` : '';
  // Nothing for the side column and nothing to list: one calm reading column (the side opens when a door does).
  const side = sideHTML(v, P), alone = !P.rows && !/t6-season|t6-doors|t6-start/.test(side);
  return `<div class="t6-root${phone ? ' ph' : ''}${!P.rows ? ' t6-solo' : ''}${alone ? ' t6-alone' : ''}">
    <header class="t6-head"><h1 class="v6-ptitle sv-h1 t6-h1" id="t6-h1" tabindex="-1">Today</h1>${dateLine(bd)}</header>
    <div class="v6-ld t6-ld${item ? ' open' : ''}" data-v6ld="today">
      <div class="t6-col">
        ${big}${phoneDay && P.nextSit ? '' : `<div class="t6-nextcol">${nextSec(P, L, '', v)}</div>`}${leadPh}${start ? `<div class="t6-startcol">${start}</div>` : ''}
        ${L.groups}${hday && seasonCol ? `<div class="t6-colonly">${seasonCol}</div>` : ''}${edge}${done}
      </div>
      <aside class="v6-ld-detail t6-aside" aria-label="${item ? 'The item you picked' : 'Your season'}">${item ? `<button type="button" class="v6-ld-back" data-v6ldback>${icon('chevron-left')}<span>Back to the list</span></button>${item}`
        : side}</aside>
    </div></div>`;
}
// The side column from 1100px while no row is picked: Getting started's short list for new people, the season card (on a
// hearing day, the person's other sittings), the one-line doors (a lead's slipping line first) and where a picked row
// opens. It scrolls with the page, so nothing in it is ever out of sight below its own end (the critic's 1: no inner scroll
// area, which a Mac draws with no scrollbar). A picked row takes the side column's place, sticky beside the list; the
// work column above the rows never changes (the next step stays where it is, first), and while the item is open the doors
// close the work column, after the lists (.t6-edges), so none of them is out of reach and no row moves (the critic: the
// slipping line had jumped in above the list and slid the clicked row from under the pointer, B-4, A-24). Below 1100px
// the work column holds it all: the next step first, the doors after the lists, before Done today.
const doorsNav = lines => lines.length ? `<nav class="t6-doors" aria-label="More about your work">${lines.join('')}</nav>` : '';
// The hint ("Pick one to see its steps", listDetail's own words) only while the column has nothing else in it, which is
// when it waits for a pick (Nate's walk: after an Undo it stood under Getting started and the season card).
const sideOf = ({ start = '', season = '', doors = '', rows = 0 }) => `${start}${season}${doors}${rows && !start && !season && !doors ? `<p class="t6-pick">${icon('arrow-left')}<span>Pick one to see its steps</span></p>` : ''}`;
function sideHTML(v, P) {
  return sideOf({ start: P.phone ? '' : startCard(v, { n: '-s' }),
    season: seasonCard(v, P.w, { where: 'side', hearings: P.others, drop: P.drop, skipH: P.skipH }),
    doors: doorsNav(doorLines(P.w, v, { coal: true, lead: leadLine() })), rows: P.rows });
}
const edgeHTML = (v = S.me) => sideHTML(v, plan(v));
// Other people's testimony due today on the person's sittings is said on the big cards themselves (each bill's state and
// who does it, from steps.js), so the v5 list "Team testimony due today (N)" is not drawn again under them (A-14).
// The reads Today waits on, each asked once: the partners' queue, the opening weeks' new-bill counts, email audiences.
function loads() {
  if (admitsPartners()) { wantQueue(); if (pqItems().some(it => it.kind === 'bill' && it.live?.ask)) wantAsks(); }
  if (seasonOf() === 'opening' && !S.tdTriage && !S.tdTriageLoading) { S.tdTriageLoading = true; DB.triageCounts().then(c => { S.tdTriage = c || {}; if (S.route?.name === 'today') hooks.render(); }).catch(() => { S.tdTriage = {}; }); }
  S.tdAud ??= {};
  for (const a of S.alerts || []) if (a.status === 'submitted' && S.tdAud[a.id] === undefined) { S.tdAud[a.id] = null; DB.alertAudience(a.bill_id, a.list_id, a.segment_id).then(n => { S.tdAud[a.id] = n; if (S.route?.name === 'today') hooks.render(); }).catch(() => {}); }
}

// ---- actions (each with Undo, as v5's: B-5, P2) ----
const redraw = () => hooks.render();
async function busy(el, fn) { if (el) { el.setAttribute('aria-busy', 'true'); el.disabled = true; } try { await fn(); } catch (e) { toast(e, { err: true }); if (el?.isConnected) { el.removeAttribute('aria-busy'); el.disabled = false; } } }
const keepDone = (words, undo) => { DONE.push({ at: Date.now(), words, undo }); };
const ACTS = {
  async todo(el, it) { await busy(el, async () => {
    await DB.updateTodo(it.b.id, it.t.id, { done: true });
    const undo = async () => { await DB.updateTodo(it.b.id, it.t.id, { done: false }); drop(undo); redraw(); };
    const words = it.share || it.kind === 'rally' ? `Public ask written: ${sayWords(it.b)}` : `Done: ${clip(it.t.title, 60)}`;
    keepDone(words, undo); await finish(el); redraw();
    toast(words, { ok: true, undo }); }); },
  async fu(el, it) { await busy(el, async () => {
    const f = it.f; await DB.doneFollowup(f.id);
    // There is no "not done" call, so Undo adds the same follow-up back (v5's way).
    const undo = async () => { await DB.addFollowup(f.person_id, f.advocate_id, f.what, f.due); drop(undo); redraw(); };
    keepDone(`Followed up: ${it.p?.name || 'a supporter'}`, undo); await finish(el); redraw();
    toast('Follow-up done.', { ok: true, undo }); }); },
  give(el, it) {
    const td = it.t, prev = td.assignee_id || null;
    pickerSheet({ title: `Give “${esc(clip(td.title, 48))}” to`, value: prev || '',
      options: (S.advocates || []).filter(a => a.is_active !== false).sort((x, y) => (y.id === S.me.id) - (x.id === S.me.id) || x.full_name.localeCompare(y.full_name)).map(a => [a.id, a.id === S.me.id ? 'You' : a.full_name, 'user-round', a.id === prev ? 'Has it now' : '']),
      onPick: async id => { if (id === prev) return;
        try { await DB.updateTodo(it.b.id, td.id, { assignee_id: id }); redraw();
          toast(id === S.me.id ? 'It is yours.' : `Given to ${first(id)}. ${first(id)} sees it on Today and gets a Slack message if the tracker can reach them.`, { ok: true, undo: async () => { await DB.updateTodo(it.b.id, td.id, { assignee_id: prev }); redraw(); } }); }
        catch (e) { toast(e, { err: true }); } } });
  },
  async send(el, it) {
    const a = it.a, n = S.tdAud?.[a.id], paused = S.emailCfg?.enabled === false, day = dailyWord();
    const ok = await confirmSheet({ title: `Send at 4:30 PM to ${n != null ? plural(n, 'person', 'people') : 'the followers'}?`, ok: 'Send at 4:30 PM',
      text: `${esc(a.subject)}<br><span class="small muted">${paused ? `Email is paused, so it is held while email is paused: ${HELD_NEXT}` : `It goes out ${day} at 4:30 PM`}, in each person’s one email of the day. You can take it back until then.</span>` });
    if (!ok) return;
    await busy(el, async () => { const r = await DB.alertStep(a.id, 'send'); redraw();
      toast(paused ? `Held while email is paused. It goes to ${plural(r?.recipients ?? n ?? 0, 'person', 'people')} in the first 4:30 PM email after email is turned on.` : `In ${day}’s 4:30 PM email to ${plural(r?.recipients ?? n ?? 0, 'person', 'people')}.`,
        { ok: true, undo: async () => { try { await DB.alertStep(a.id, 'unsend'); redraw(); toast('Taken back. It will not go out.'); } catch (e) { toast(e, { err: true }); } } }); });
  },
  async moveme(el, it) { await busy(el, () => moveMe(it.task, { toast, redraw })); },
  async notgoing(el, it) { await busy(el, () => notGoing(it.task, { toast, redraw })); },
  async askup(el, it) { await busy(el, () => keepAskUp(it.task, { toast, redraw })); },
};
const drop = undo => { const i = DONE.findIndex(x => x.undo === undo); if (i >= 0) DONE.splice(i, 1); };
// Undo from the Done today band: a draft's step goes back the way Review and the step card's Undo take it.
async function undoDone(i) {
  const x = doneToday()[i]; if (!x) return;
  try {
    if (x.undo) { await x.undo(); if (S.v6Done) S.v6Done = S.v6Done.filter(y => y !== x); return redraw(); }
    if (x.act === 'unfile') { await DB.transition(x.b.id, x.d.id, 'unfile'); toast('Filing undone. It is approved and ready to file again.'); }
    else if (x.act === 'unapprove') { await DB.transition(x.b.id, x.d.id, 'unapprove'); toast('Approval undone. It is waiting for approval again.'); }
    else if (x.act === 'withdraw') { await DB.transition(x.b.id, x.d.id, 'withdraw'); toast('Pulled back to draft. It is yours to send again.'); }
    redraw();
  } catch (e) { toast(e, { err: true }); }
}
// Waiting on others (F58): the list opens beside the work (its own page below 1100px), each row with Message (the bill's
// Team talk with @them typed in) or Give to… on a to-do. Nothing in it is the viewer's to do, so it is never a group.
function waitingItem(v = S.me) {
  const w = work(v), rows = w.waiting.map(x => {
    const ids = (x.on || []).filter(id => id && id !== v.id && live(id));
    const msg = x.b && ids.length ? btn(`Message ${orWords(ids, null, { and: true })}`, { kind: 'text', sm: true, icon: 'message-square', href: `${billRoute(x.b, 'talk')}?mention=${ids.map(id => advocate(id)?.initials).filter(Boolean).join(',')}` }) : '';
    const give = x.t ? btn('Give to…', { kind: 'text', sm: true, attrs: { 'data-t6give': x.key, 'aria-haspopup': 'dialog' } }) : '';
    return `<li class="t6-wrow"><a class="t6-wmain" href="${esc(x.b ? billRoute(x.b) : x.a ? `#/email/${x.a.id}` : '#/')}">${x.b ? `<span class="t6-wname">${esc(nameWords(x.b))} <span class="v6-row-num">${esc(numWords(x.b))}</span></span>` : ''}<span class="t6-wline">${nw(plainCodes(esc(x.line)))}</span></a>${msg || give ? `<span class="t6-wacts">${msg}${give}</span>` : ''}</li>`;
  }).join('');
  return `<div class="v6-item t6-item" data-v6item="waiting"><div class="v6-item-top"><p class="v6-item-num">On your bills and drafts</p>${closeBtn()}</div>
    <h2 class="v6-item-name" id="v6-item-h" tabindex="-1">Waiting on others</h2>
    <p class="t6-wsub">Someone else takes each of these next. Nothing here is yours to do.</p>
    ${rows ? `<ul class="t6-wlist">${rows}</ul>` : '<p class="t6-quiet">Nothing is waiting on anyone.</p>'}</div>`;
}
// Later (groupsOf): the person's own steps due after the week ahead, each a link to its home, opened from the line under
// Coming up. Nothing here is due this week; each moves into Coming up seven days before it is due.
function laterItem(v = S.me) {
  const g = groupsOf(work(v)); if (!g.later.length) return '';
  const rows = g.later.map(it => { REG.set(it.key, it); const r = it.s && it.b ? null : miniOf(it, v), href = it.b ? billRoute(it.b) : r?.href || '#/';
    return `<li class="t6-wrow"><a class="t6-wmain" href="${esc(href)}"><span class="t6-wname">${esc(it.b ? nameWords(it.b) : r.name)}${it.b ? ` <span class="v6-row-num">${esc(numWords(it.b))}</span>` : ''}</span><span class="t6-wline">${nw(plainCodes(esc(lineOf(it, v))))}</span></a></li>`; }).join('');
  return `<div class="v6-item t6-item" data-v6item="later"><div class="v6-item-top"><p class="v6-item-num">Yours, after the week ahead</p>${closeBtn()}</div>
    <h2 class="v6-item-name" id="v6-item-h" tabindex="-1">Later</h2>
    <p class="t6-wsub">Due after ${esc(dayWords(g.horizon))}. Each moves into Coming up a week before it is due.</p>
    <ul class="t6-wlist">${rows}</ul></div>`;
}
const openItemHTML = (key, v = S.me) => key === 'waiting' ? waitingItem(v) : key === 'later' ? laterItem(v) : itemFor(key, v);

// One listener for Today's own buttons (steps.js handles the step cards' and rows' own buttons).
if (typeof document !== 'undefined') document.addEventListener('click', e => {
  const el = e.target?.closest?.('[data-t6act], [data-t6undo], [data-t6wait], [data-t6give]'); if (!el || !el.closest('.t6-root, .tm6-root, dialog')) return;
  // The side column's copy of a door that opens beside the work: the column's own copy does it (wireListDetail).
  if (el.dataset.t6wait !== undefined) { if (el.closest('.v6-ld-detail')) { e.preventDefault(); document.querySelector('.t6-col [data-v6pick="waiting"]')?.click(); } return; }
  if (el.dataset.t6give !== undefined) { e.preventDefault(); const x = work().waiting.find(y => y.key === el.dataset.t6give); if (x) ACTS.give(el, { b: x.b, t: x.t }); return; }
  if (el.dataset.t6undo !== undefined) { e.preventDefault(); return undoDone(+el.dataset.t6undo); }
  const act = el.dataset.t6act;
  if (act === 'hidestart') { e.preventDefault(); markNewStep({ hidden: 1 }); return redraw(); }
  if (act === 'pqretry') { e.preventDefault(); return wantQueue({ force: true }); }
  const it = REG.get(el.dataset.t6k), fn = ACTS[act]; if (!it || !fn) return;
  e.preventDefault(); fn(el, it);
});
// Keys (F69; desktop only, off when My settings says so): j/k or the arrows move through the rows and, on a laptop, the
// open item follows; Enter does the row's own step when it has one; o opens the item; Esc closes it.
if (typeof document !== 'undefined') document.addEventListener('keydown', e => {
  if (S.route?.name !== 'today' || S.route?.place || !document.querySelector('.t6-root') || !HOVER() || !keysOn() || e.metaKey || e.ctrlKey || e.altKey || typing(e.target) || document.querySelector('dialog[open]')) return;
  const rows = [...document.querySelectorAll('.t6-root .t6-col .v6-row-main')]; if (!rows.length) return;
  const at = rows.indexOf(document.activeElement), inList = at >= 0;
  const down = e.key === 'j' || (inList && e.key === 'ArrowDown'), up = e.key === 'k' || (inList && e.key === 'ArrowUp');
  if (down || up) {
    e.preventDefault();
    const n = rows[at < 0 ? 0 : Math.max(0, Math.min(rows.length - 1, at + (down ? 1 : -1)))];
    n.focus(); n.scrollIntoView({ block: 'nearest' });
    if (WIDE() && n.dataset.v6pick != null) n.click();
  } else if (e.key === 'Enter' && inList) {
    const own = rows[at].closest('.v6-row')?.querySelector('.v6-row-act .btn');
    if (own) { e.preventDefault(); own.click(); }
  } else if (e.key === 'o' && inList) { e.preventDefault(); rows[at].click(); }
  else if (e.key === 'Escape' && document.querySelector('.t6-ld.open')) { e.preventDefault(); history.back(); }
});

// From 1100px, while nothing is picked: when the side column would run on alone below the lists, its season card (never a
// hearing day's sittings) moves under the lists, so the page is only as long as it needs to be (spec 8: 1.2 screens;
// Kris's and Kevin's laptops were a third of a screen of side column below a short list). Measured after drawing, since
// the two columns' heights depend on the words; drawn again whenever the side column is.
function balance(main) {
  main.querySelectorAll('.t6-col > .t6-moved').forEach(x => x.remove());
  if (!WIDE() || main.querySelector('.t6-ld.open')) return;
  const col = main.querySelector('.t6-col'), side = main.querySelector('.t6-aside'), card = side?.querySelector(':scope > .t6-season:not(.t6-hday)');
  if (!col || !card) return;
  const c = col.getBoundingClientRect().height, s = side.getBoundingClientRect().height, h = card.getBoundingClientRect().height + 24;
  if (c + h >= s) return;   // moving it would not shorten the page
  card.classList.add('t6-moved');
  col.insertBefore(card, col.querySelector(':scope > .t6-done'));
}
function wire(route, root) {
  if (route?.place === 'hearings' || route?.q?.view === 'week' || route?.q?.view === 'ahead') return v5.wire(route, root);
  const main = root.querySelector('.t6-root'); if (!main) return;
  wireSteps(main, { after: redraw });
  wirePartner(main);
  // The frame routes every a[href^="#/"] itself (app.js wireFrame, wired after this), which would open the bill instead of
  // the item beside the list. A picked row's address keeps the page's own path, so the frame leaves it to wireListDetail and
  // a Cmd-click still opens the bill in a new tab (shared change asked: wireFrame skips a[data-v6pick]).
  const own = () => main.querySelectorAll('a[data-v6pick][href^="#/"]').forEach(a => a.setAttribute('href', location.pathname + location.search + a.getAttribute('href')));
  own();
  const aside = main.querySelector('.t6-aside');
  const edge = () => edgeHTML();
  wireListDetail(main, { id: 'today', open: key => openItemHTML(key),
    // Closing the item puts Getting started, the season card and the doors back in that column (wireListDetail draws its
    // own hint there).
    onChange: key => { if (key == null && aside) { aside.innerHTML = edge(); aside.setAttribute('aria-label', 'Your season'); wirePartner(aside); balance(main); } else if (aside) { aside.setAttribute('aria-label', 'The item you picked'); wirePartner(aside); } } });
  main.querySelector('[data-t6doneband]')?.addEventListener('toggle', e => { S.t6DoneOpen = e.target.open; });
  balance(main);
  if (S.t6Refocus) { const el = main.querySelector(S.t6Refocus); S.t6Refocus = null; el?.focus({ preventScroll: true }); }
}

export default {
  tab: 'today',
  title: () => 'Today',
  // The Hearings stub draws v5's This week through here (wide, as before); Today itself is the frame's default width.
  wide: () => S.route?.place === 'hearings' ? !!v5.wide?.() : false,
  // The partners' words to approve count in Today's number, so their queue is asked for from the first page drawn, not only
  // when Today is opened (the sidebar said 6 on Partners and 9 on Today for the same morning).
  badge() { try { wantQueue(); return badgeOf(); } catch (e) { console.error(e); return { n: 0, late: false, lateN: 0 }; } },
  render, wire,
};
// For Team (team.js): the same model and rows, so "See as teammate" is the teammate's own Today, read-only.
// Team draws from the same model, so each of its draws starts from fresh work too (a memo kept from the draw before the
// partners' queue arrived counted Nate's bar without his partner words: the critic's 9).
export const t6Fresh = () => { MEMO.clear(); };
export { rowOf as t6Row, groupsOf as t6Groups, nextCard as t6Next, roCard as t6RoCard, sittingsToday as t6Sittings, seasonOf as t6Season, REG as T6REG };
