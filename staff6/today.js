// Today (#/), Staff v6 (R-336; V6-SPEC section 6 "Today", V01, V14, V26, V29, V30, D1, D4, addendum 3, 7, F30, F48, F70).
// Nate: "far too overwhelming with too many things to do in too many places". v5's Today stacked four roles, six groups,
// two switches, a week grid, What changed and other people's steps in one page (assessment X1, X2, X3, X17: 70 controls and
// 2.2 screens for Nate, 26 labelled buttons on Patti's, mostly Lauren's steps). Today is now the person's own work, calm:
//   - one "Your next step" card (steps.js stepCard), the screen's ONLY filled button; when it is done the next slides in;
//   - Do today (late first), then Coming up (every row up to eight; only a longer list folds), each own item its own row
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
// On a laptop (1100px and wider) a picked row opens beside the list (billpane.js's open item, built here with the draft it
// is about); before anything is picked that column holds the next step on a busy day, the season card and the one-line
// doors, and scrolls with the page (see sideOf). Below 1100px the item is its own page with Back (steps.js wireListDetail).
//
// v5's Today moved, whole, to today5.js: every export other screens import from './today.js' is re-exported below
// (review.js, bills.js, inbox.js, asks.js, legislators.js, profile.js and app.js still use them), and v5's This week still
// draws for the Hearings stub until HEARINGS replaces it (render() hands a route with place 'hearings' to v5).
import { S, DB, DEMO, SESSION_OVER, DEADLINE_ROWS, esc, advocate, isMine, hooks } from './data.js';
import v5, { todayItems, slipNow, slipWho } from './today5.js';
import { draftHearing, hearingAhead, diedish, stopOf, wantsHearing, whenAt, billRoute, billById, liveAsk, attendees, chairMail,
  legislativeDay, deadlineName, blurb, approves, canFirstApprove, filerOf, offTag } from './model.js';
import { icon, btn, toast, openSheet, closeSheet, pickerSheet, confirmSheet, docBtn, keysOn } from './ui.js';
import { billStep, stepCard, hearingCard, billRow, itemRow, rowButton, rowButtonOK, statusTile, status, shownStatus, nw,
  numWords, nameWords, sayWords, firstWords, orWords, dayWords, timeWords, committeeName, versionWords, deadlineWords,
  testimonyState, whoseStep, notFiled, wireListDetail, wireSteps, finish, helpersOf, actBy, takeFor } from './steps.js';
import { aboutBill, closeBtn } from './billpane.js';
import { plainCodes } from './terms.js';   // codes in a to-do's or a note's own words become plain words (D15, V05)
import { prepTaskOf, dueEnd as prepDue, issueHref, prepListHref } from './prep.js';
import { askTodoOf } from './push.js';
import { isLead } from './more.js';
import { newSteps, markNewStep } from './help.js';
import { moveMe, notGoing, keepAskUp, seedMoved } from './moved.js';
import { pqItems, pqOthers, wantQueue, wantAsks, admitsPartners, approvesPartners, pqRow, pqItem, pqCard, wirePartner } from './partnerq.js';
import { dailyWord } from './composer.js';

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
// Coming up shows every row up to eight; only a longer list folds, behind "Show all 12 coming up", and never to hide one
// or two rows (rule 3: nothing a person must do behind "Show more"; the fresh-eyes critic: Nate's laptop hid two of his own
// steps and Kevin's 320px fold took the room of the row it hid). Rows due today are never folded.
const SOON_SHOWN = 8;
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
// The order inside a group: late or overdue first, then "Did we file?", then by the time to act, then what has no time.
const ORDER = { overdue: 0, late: 1, missed: 2, dated: 3, undated: 4 };
const RANK = { file: 1, approve: 2, second: 2, revise: 3, submit: 4, write: 5, nodraft: 6, stale: 7, chair: 8, followask: 8, rally: 9,
  reply: 10, email: 11, fix: 11, send: 11, partner: 12, todo: 13, followup: 14, moved: 15, askup: 15 };
function orderOf(it) { return it.tone === 'overdue' ? ORDER.overdue : it.tone === 'late' ? ORDER.late : it.kind === 'missed' ? ORDER.missed : it.at != null ? ORDER.dated : ORDER.undated; }
const byOrder = (x, y) => orderOf(x) - orderOf(y) || (x.at ?? Infinity) - (y.at ?? Infinity) || (RANK[x.kind] || 20) - (RANK[y.kind] || 20)
  || String(x.b?.bill_number || x.key).localeCompare(String(y.b?.bill_number || y.key), 'en', { numeric: true });

// The rallier, without a migration (spec 6 W22, addendum 6): Saya on CTFH, else the coalition's owner, else the bill's.
function rallierOf(b) {
  const cs = (S.billCampaigns?.[b.id] || []).map(id => (S.campaigns || []).find(c => c.id === id)).filter(Boolean);
  if (cs.some(c => c.name === 'CTFH')) { const sy = (S.advocates || []).find(a => a.initials === 'SY' && a.is_active !== false); if (sy) return sy.id; }
  const co = cs.find(c => live(c.owner_id)); return co ? co.owner_id : ownerOf(b);
}
// The public ask is due 4:00 PM two days before the hearing, never later than the last 4:00 PM at least 12 h before written
// testimony closes (settled, spec 2; R-025, R-116).
function askDue(h) {
  const d2 = hday(ms(h.scheduled_at) - 2 * DAY), two = ms(d2 + 'T16:00:00-10:00');
  if (!h.testimony_deadline) return two;
  const cut = ms(h.testimony_deadline) - 12 * HR, four = ms(hday(cut) + 'T16:00:00-10:00');
  return Math.min(two, four <= cut ? four : four - DAY);
}
const coalIds = a => { const c = a?.prefs?.coalitions; return Array.isArray(c) ? c : []; };
const inCoal = (a, b) => { const ids = coalIds(a); return ids.length > 0 && (S.billCampaigns?.[b.id] || []).some(c => ids.includes(c)); };
const ASK_RX = /^Send the ask\b/i;

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
    else if (owns(v.id, b) && a.key === 'giving') out.waiting.push({ key: `cg:${b.id}`, b, line: `${cap(firstWords(a.who, v))} is asking ${a.m ? a.m.who : 'the chair'}`, on: [a.who] });
    // D4: a coalition helper's one line counts the owner's asks due this week, never the helper's own rows.
    // The next two weeks of the owner's asks: one line, never the owner's rows (D4).
    else if (a.key === 'ask' && a.by != null && a.by - now <= 14 * DAY && !owns(v.id, b) && inCoal(v, b)) {
      const o = ownerOf(b); if (o) { const e = out.coal.get(o) || { n: 0, by: Infinity }; e.n++; e.by = Math.min(e.by, a.by); out.coal.set(o, e); } }
  }
  // Chair-ask rows: those due within a week (two for a strong-support bill), soonest first, at most three; the rest are D1's line.
  askRows.sort((x, y) => x.by - y.by);
  for (const r of askRows) {
    const left = r.by - now, near = left <= 7 * DAY || (r.b.priority === 1 && left <= 14 * DAY) || r.s.ask.key === 'giving';
    if (near && out.own.filter(i => i.kind === 'chair').length < ASK_ROWS) add({ key: `ca:${r.b.id}`, kind: 'chair', b: r.b, s: r.s, at: r.by, tone: shownStatus(r.s)?.tone || 'neutral' });
    else out.asks.push(r);
  }
  // ---- the public ask, the rallier's step two days before it is due (W22's fallback) ----
  for (const h of S.hearings || []) {
    const t = ms(h.scheduled_at); if (h.status === 'cancelled' || t <= now || t - now > 7 * DAY) continue;
    const b = billById(h.bill_id); if (!b || !['strongly_support', 'strongly_oppose'].includes(b.position) || diedish(b) || b.tracked === false) continue;
    if (rallierOf(b) !== v.id) continue;
    out.rally.push({ b, h });
    if (liveAsk(b) || out.own.some(i => i.kind === 'rally' && i.b.id === b.id)) continue;
    const due = askDue(h); if (now < due - 2 * DAY) continue;
    add({ key: `ra:${b.id}`, kind: 'rally', b, h, at: due, tone: due <= now ? 'overdue' : 'neutral', due });
  }
  // ---- v5's own items: to-dos, follow-ups, emails, questions, the moved hearings (the same data, v6 rows) ----
  let tasks = [];
  try { tasks = self ? todayItems('mine').tasks : todayItems('person', v.id).tasks; } catch (e) { console.error(e); }
  for (const t of tasks) {
    const tone = t.due != null && t.due <= now ? 'overdue' : 'neutral';
    if (t.kind === 'todo') {
      if (t.who !== 'yours' || (t.b && askTodoOf(t.b)?.id === t.t.id)) continue;   // a chair ask given to you is its chair row
      add({ key: t.key, kind: 'todo', b: t.b, t: t.t, at: t.due ?? null, tone, share: ASK_RX.test(t.t.title || '') });
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
    out.waiting.push({ key: `wa:${a.id}`, a, line: `Your email “${clip(a.subject, 40)}” · with an approver`, on: [] });
  // ---- the 2027 issues (W4, between sessions): the season card's, or the next step when nothing else is waiting ----
  const pt = SESSION_OVER ? prepTaskOf(v.id) : null;
  if (pt) out.prep = { key: `prep:${v.id}`, kind: 'prep', pt, at: prepDue(), tone: 'neutral' };
  out.own.sort(byOrder);
  return out;
}
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
    out.waiting.push({ key: `w:${b.id}:${d?.id}`, b, d, line: s.line, on: s.whose?.ids || [] });
}
const whoseStepWriter = (d, b, v) => d.submitted_by === v.id || (!d.submitted_by && owns(v.id, b));

// ---- the groups ----
function groupsOf(w) {
  const eod = endOfDay(), today = [], soon = [], partner = [];
  // Partner words to approve have no deadline: their own small group after Coming up (R-328), never "Do today" or the badge.
  for (const it of w.own) (it.kind === 'partner' ? partner : (it.tone === 'overdue' || it.tone === 'late' || it.kind === 'missed' || it.at == null || it.at <= eod) ? today : soon).push(it);
  return { today, soon, partner, next: today[0] || soon[0] || partner[0] || w.prep || null };
}
// The Today badge: what needs the viewer today (D3); `lateN` names the overdue count (the frame's words, A-5).
function badgeOf() {
  const w = work(), g = groupsOf(w);
  const counted = g.today;   // partner words have no deadline and sit in their own group (v5 left them out of the badge too)
  const lateN = counted.filter(i => i.tone === 'overdue').length;
  return { n: counted.length, late: lateN > 0, lateN };
}

// ---- rows ----
const REG = new Map();   // the items drawn this draw, by key (a button or a picked row finds its record here)
// A row for one item: the name, the bill number small, one line (D15). `ro`: a teammate's list, read-only and never in colour.
function rowOf(it, { ro = false, v = S.me } = {}) {
  REG.set(it.key, it);
  const pick = it.key, b = it.b;
  if (it.s && b && ['chair', 'followask', 'stale'].indexOf(it.kind) < 0) {
    const s = ro ? { ...it.s, mine: false } : it.s;
    // The second look says its state word on the row (spec 5's five words): "Second look · approve by tomorrow 10:00 AM".
    if (s.state?.key === 'second' && s.you && !ro && s.act?.words) {
      const st = shownStatus(s), hushed = st !== s.status, tone = st.tone;
      return itemRow({ key: b.id, name: nameWords(b), num: numWords(b), line: nw(esc(`Second look · ${lower(s.act.words)}`)), tone, icon: tone !== 'neutral' ? st.icon : st.soon || hushed ? 'clock' : '',
        bold: !!st.soon, href: billRoute(b), pick, button: rowButtonOK(s) ? rowButton(s) : '' });
    }
    return billRow(b, { viewer: v, step: s, pick, button: ro ? false : undefined });
  }
  if (it.kind === 'chair') return billRow(b, { viewer: v, step: ro ? { ...it.s, mine: false } : it.s, pick, button: ro ? false : rowButton(it.s) });
  if (it.kind === 'followask') {
    const a = it.s.ask;
    return billRow(b, { viewer: v, step: it.s, pick, button: ro ? false : btn('They replied', { kind: 'secondary', sm: true, icon: 'message-square', attrs: { 'data-v6act': 'replied', 'data-v6b': b.id, 'data-v6code': a.code, 'aria-haspopup': 'dialog' } }) });
  }
  if (it.kind === 'stale') return billRow(b, { viewer: v, step: it.s, pick, button: false, line: nw(esc(`Check your testimony: the bill is now ${versionWords(b.current_version)}`)) });
  const r = miniOf(it, v), due = dueTone(it, ro);
  return itemRow({ key: it.key, name: r.name, num: r.num, line: nw(plainCodes(esc(r.line))), tone: due.tone, icon: due.icon, bold: due.bold, href: r.href, pick: r.pick === false ? undefined : pick,
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
      // says its hearing by day, without the code: "Send the public ask for the Fri 3/20 hearing".
      const m = /\bfor the (\S+) hearing (\d{1,2})\/(\d{1,2})\s*$/.exec(it.t.title || ''), sh = it.share && m ? (S.hearings || []).find(h => h.bill_id === b.id && h.status !== 'cancelled' && new Date(h.scheduled_at).toLocaleDateString('en-US', { ...HST, month: 'numeric', day: 'numeric' }) === `${+m[2]}/${+m[3]}`) : null;
      const title = it.share ? `Send the public ask for the ${sh ? dayWords(sh.scheduled_at) : m ? `${+m[2]}/${+m[3]}` : 'next'} hearing` : it.t.title;
      const doneBtn = (k = 'secondary') => btn(it.share ? 'Done' : 'Done', { kind: k, sm: k !== 'primary', icon: 'check', attrs: { 'data-t6act': 'todo', 'data-t6k': it.key } });
      return { name: nameWords(b), num: numWords(b), line: [when, clip(title, 96)].filter(Boolean).join(' · '), href: billRoute(b), what: title,
        rowBtn: doneBtn(), buttons: k => [it.share ? btn('Open this week’s asks', { kind: k, icon: 'megaphone', href: '#/outreach' }) : doneBtn(k), it.share ? doneBtn('secondary') : '',
          // Give to… lives in the open item; the next-step card keeps to the step itself (V01: the first screen stays small)
          k === 'primary' ? '' : btn('Give to…', { kind: 'text', icon: 'user-round', attrs: { 'data-t6act': 'give', 'data-t6k': it.key, 'aria-haspopup': 'dialog' } })] };
    }
    case 'followup': {
      const p = it.p || {}, name = p.name || p.email || 'A supporter', reach = p.phone ? btn('Call', { kind: 'text', icon: 'phone', href: `tel:${p.phone}` }) : p.email ? btn('Email', { kind: 'text', icon: 'mail', href: `mailto:${p.email}` }) : '';
      const doneBtn = (k = 'secondary') => btn('Done', { kind: k, sm: k !== 'primary', icon: 'check', attrs: { 'data-t6act': 'fu', 'data-t6k': it.key } });
      return { name, num: '', line: [when, it.f.what ? `Follow up: ${clip(it.f.what, 88)}` : 'Follow up'].filter(Boolean).join(' · '), href: `#/person/${encodeURIComponent(it.f.person_id)}`, what: `Follow up with ${name}`,
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
    case 'send': return { name: b ? nameWords(b) : clip(spaced(it.a.subject), 60) || 'Your email', num: b ? numWords(b) : '', line: 'Your email is approved · send it at 4:30 pm', href: `#/email/${it.a.id}`, what: 'Send your approved email',
      rowBtn: btn('Send', { kind: 'secondary', sm: true, icon: 'send', attrs: { 'data-t6act': 'send', 'data-t6k': it.key } }), buttons: k => [btn('Send at 4:30 pm', { kind: k, icon: 'send', attrs: { 'data-t6act': 'send', 'data-t6k': it.key } }), btn('Open the email', { kind: 'text', href: `#/email/${it.a.id}` })] };
    case 'reply': {
      const href = `${billRoute(b, 'talk')}?reply=1`;
      return { name: nameWords(b), num: numWords(b), line: `Reply to ${it.from} · ${clip(it.q, 70)}`, href, pick: false, what: `Reply to ${it.from}`, sub: `“${clip(it.q, 160)}”`,
        buttons: k => [btn('Reply', { kind: k, icon: 'message-square', href })] };
    }
    case 'rally': {
      const write = `${billRoute(b, 'public')}?focus=ask`, by = actBy({ kind: 'due', due: it.due, verb: 'Write the public ask' }).words;
      return { name: nameWords(b), num: numWords(b), line: by, href: write, what: 'Write the public ask', sub: `For the ${committeeName(it.h.committee) || it.h.committee} hearing ${whenAt(it.h.scheduled_at)}.`,
        rowBtn: btn('Write it', { kind: 'secondary', sm: true, href: write }), buttons: k => [btn('Write it', { kind: k, icon: 'pencil', href: write }), btn('Open this week’s asks', { kind: 'text', href: '#/outreach' })] };
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
        what: pt.own ? 'Get your issues ready for 2027' : `Help ${pt.owners.map(a => first(a.id)).join(' and ')} get their issues ready`, sub: `${pt.ready} of ${plural(pt.total, 'issue')} ready.${pt.back.length ? ` ${first(pt.back[0].prep_by)} sent back ${pt.back[0].name}.` : pt.next ? ` Next: ${pt.next.name}.` : ''}`,
        buttons: k => [btn(label, { kind: k, icon: 'arrow-right', href }), btn('See the list', { kind: 'text', href: list })] };
    }
  }
  return { name: it.key, num: '', line: '', href: '#/', buttons: () => [] };
}

// ---- the card and the open item ----
// "Your next step": the step card with the screen's one filled button (V11). Testimony and chair asks are steps.js's card;
// everything else is drawn in the same card so it reads the same (V07).
function nextCard(it, v = S.me, id = 't6-next-h') {
  if (!it) return '';
  REG.set(it.key, it);
  if (it.s && it.b && it.kind !== 'stale') return stepCard(it.b, { viewer: v, where: 'today', d: it.kind === 'chair' || it.kind === 'followask' ? null : it.d ?? null, h: it.kind === 'chair' || it.kind === 'followask' ? null : it.h ?? null, primary: true, id, from: 'today' });
  if (it.kind === 'partner') return pqCard(it.p, { id });
  return miniCard(it, { primary: true, v, id });
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
// items under "Also on this bill" (spec 5: in place of "+N on this bill").
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
  const card = it.s && it.kind !== 'stale' ? stepCard(b, { viewer: v, where: 'pane', d: it.kind === 'chair' || it.kind === 'followask' ? null : it.d ?? null, h: it.kind === 'chair' || it.kind === 'followask' ? null : it.h ?? null, primary: false, named: false, from: 'today' })
    : miniCard(it, { primary: false, v, id: 't6-item-h3' });
  // By key: work() draws fresh items each tick, so the item itself is never the same object (the critic: every open item
  // listed its own step again under "Also on this bill").
  const also = work(v).own.filter(x => x.key !== it.key && x.b && x.b.id === b.id).map(x => `<li class="v6-also-item"><span class="v6-also-t">${nw(esc(lineOf(x, v)))}</span></li>`).join('');
  const shown = it.s?.h && it.kind !== 'chair', facts = aboutBill(b, { hearing: !shown });
  return `<div class="v6-item t6-item" data-v6item="${esc(b.id)}">
    <div class="v6-item-top"><p class="v6-item-num">${esc(numWords(b))}</p><a class="v6-item-open" href="${esc(billRoute(b))}" data-bill="${esc(b.id)}"><span>Open the bill</span>${icon('arrow-right')}</a>${close}</div>
    <h2 class="v6-item-name" id="v6-item-h" tabindex="-1">${esc(nameWords(b, 160))}</h2>
    ${sum ? `<p class="v6-item-sum">${esc(sum)}</p>` : ''}${card}
    ${also ? `<section class="v6-also" aria-labelledby="v6-item-h-also"><h3 class="v6-also-h" id="v6-item-h-also">Also on this bill</h3><ul class="v6-also-list">${also}</ul></section>` : ''}
    ${facts ? `<div class="v6-item-doors"><details class="v6-item-det"${S.v6About?.[b.id] ? ' open' : ''} data-v6about="${esc(b.id)}"><summary class="v6-item-door">${icon('info')}<span>About this bill</span>${icon('chevron-down')}</summary><div class="v6-item-about">${facts}</div></details></div>` : ''}
  </div>`;
}
const lineOf = (it, v) => it.s && !['followask', 'stale'].includes(it.kind) ? it.s.line : it.kind === 'followask' ? it.s.line : it.kind === 'stale' ? `Check your testimony: the bill is now ${versionWords(it.b.current_version)}` : miniOf(it, v).line;

// ---- the one-line doors (each one labelled control, never a list of other people's steps: D4, V15) ----
const lineA = (href, ic, html, { cls = '', attrs = '' } = {}) => `<a class="t6-line${cls ? ' ' + cls : ''}" href="${esc(href)}"${attrs}>${icon(ic)}<span class="t6-lt">${html}</span>${icon('chevron-right', { cls: 't6-chev' })}</a>`;
const lineB = (data, ic, html) => `<button type="button" class="t6-line" ${data} aria-haspopup="dialog">${icon(ic)}<span class="t6-lt">${html}</span>${icon('chevron-right', { cls: 't6-chev' })}</button>`;
// Leads (admins and second approvers): v5's Slipping, as one line that opens Team. Red only when something on it is overdue.
function leadLine() {
  if (!isLead()) return '';
  let sl; try { sl = slipNow(); } catch (e) { console.error(e); return ''; }
  const n = sl.rows.length; if (!n) return '';
  const now = Date.now(), over = sl.rows.filter(r => r.p && r.p.due != null && r.p.due <= now && !(r.p.h && ms(r.p.h.scheduled_at) > now && /file|review|revise|submit|write/.test(r.p.kind))).length;
  // Someone else's late step is said in words, never in colour (D3): the lead's own late work is on their own rows.
  return lineA('#/team', 'users', `<b>${n} slipping</b> on the team${over ? `, ${over} overdue` : ''} · Open Team`, { cls: 't6-lead' });
}
function doorLines(w, v = S.me, { coal = true } = {}) {
  const out = [];
  // An admin's one line when the bill sync has not finished in a day and a half (F65; live only, in plain words, D3).
  if (v.is_admin && v.id === S.me?.id && !DEMO && !SESSION_OVER) {
    const lastOk = (S.syncRuns || []).find(r => r.ok)?.finished_at, failed = (S.syncRuns || [])[0]?.ok === false, hrs = lastOk ? Math.round((Date.now() - ms(lastOk)) / HR) : null;
    if (failed || hrs == null || hrs > 36) out.push(lineA('#/setup/sync', 'refresh-cw', `<b>${hrs == null ? 'The bill sync has not finished recently' : `The bill sync last finished ${hrs > 47 ? Math.round(hrs / 24) + ' days' : hrs + ' hours'} ago`}</b> · Check it`));
  }
  if (w.waiting.length) out.push(lineA('#/', 'hourglass', `<b>Waiting on others</b> · ${w.waiting.length}`, { attrs: ' data-v6pick="waiting" data-t6wait' }));
  // D1: the ask-by day in the row's own words ("Ask the chair by Mon 3/23"), not "first notice", which did not say what notice.
  if (w.asks.length) { const f = w.asks[0]; out.push(lineA('#/hearings/ask', 'landmark', `<b>${w.asks.length} ${w.own.some(i => i.kind === 'chair') ? 'more ' : ''}of your bills need a hearing</b> · ask the first chair by ${esc(dayWords(f.by))} · Hearings`)); }
  if (w.coal.size && coal) {
    const owners = [...w.coal.entries()].sort((x, y) => y[1].n - x[1].n), n = owners.reduce((s, [, e]) => s + e.n, 0), by = Math.min(...owners.map(([, e]) => e.by));
    const who = orWords(owners.map(([id]) => id), v, { and: true });
    out.push(lineA('#/hearings/ask', 'hand-heart', `<b>${esc(who)} ${owners.length > 1 ? 'have' : 'has'} ${n === 1 ? 'a hearing ask' : plural(n, 'hearing ask')} to make</b>, ${n === 1 ? 'by' : 'the first by'} ${esc(dayWords(by))} · Offer to help`));
  }
  const rally = w.rally.filter((x, i, a) => a.findIndex(y => y.b.id === x.b.id) === i);
  if (rally.length) out.push(lineA('#/outreach', 'megaphone', `<b>${plural(rally.length, 'public ask')} this week</b> · This week’s asks`));
  // Whoever may hand them (an admin, an issue's owner): the same count and word as Team's block and bar (noOwnerBills).
  const no = noOwnerBills(v);
  if (no.length) out.push(lineA(isLead(v) ? '#/team' : '#/my-issues', 'user-round', `<b>${plural(no.length, 'bill')} with no owner</b> · ${isLead(v) ? 'Team' : 'My issues'}`));
  if (admitsPartners(v)) {
    const o = pqOthers(), parts = [o.groups.length ? `${plural(o.groups.length, 'group')} to approve` : '', o.requests.length ? `${plural(o.requests.length, 'group')} ${o.requests.length === 1 ? 'asks' : 'ask'} to join` : ''].filter(Boolean);
    if (parts.length) out.push(lineA('#/partners', 'handshake', `<b>Partners</b> · ${esc(parts.join(' · '))}`));
    if (S.pqErr) out.push(`<p class="t6-quiet">${icon('circle-alert')}<span>The partners’ words did not load.</span>${btn('Try again', { kind: 'text', sm: true, attrs: { 'data-t6act': 'pqretry' } })}</p>`);
  }
  return out;
}

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
// is drawn elsewhere on the page; `lead`: the next step on a phone's hearing day, whose row moves first and carries the
// screen's one filled button, in its own colour when it is late (V14: the big card is that step's home that day; D3).
// Done on hearingCard's HTML here until steps.js takes { omit, lead } (asked as a shared change).
const LI = /<li class="v6-hcard-bill"><a class="v6-hcard-bl" href="([^"]*)"[\s\S]*?<\/li>/g;
function sittingCard(h, { v = S.me, big = false, id = '', drop = null, lead = null } = {}) {
  let html = hearingCard(h, { viewer: v, big, from: 'today', id });
  const hrefOf = b => esc(billRoute(b)), gone = new Set([...(drop || [])].map(id => billById(id)).filter(Boolean).map(hrefOf));
  const leadHref = lead?.b ? hrefOf(lead.b) : null, tone = lead?.s?.status?.tone;
  let leadLi = '';
  html = html.replace(LI, (li, href) => {
    if (href === leadHref && !leadLi) {
      leadLi = li.replace('class="v6-hcard-bill"', 'class="v6-hcard-bill t6-hc-lead"').replace(/class="btn secondary sm"/, 'class="btn primary"')
        .replace(/class="v6-row-line(?: t-\w+)?/, `class="v6-row-line${tone === 'late' || tone === 'overdue' ? ' t-' + tone : ''}`);
      return '';
    }
    return gone.has(href) ? '' : li;
  });
  if (leadLi) html = html.replace('<ul class="v6-hcard-bills">', `<ul class="v6-hcard-bills">${leadLi}`);
  // With no bill left to list, the card is the sitting itself: its time, room, who is going and the stream.
  if (/<ul class="v6-hcard-bills">\s*<\/ul>/.test(html)) html = html.replace(/<ul class="v6-hcard-bills">\s*<\/ul>/, '').replace('<span>Also heard: ', '<span>');
  return html;
}
function seasonBody(season, v, w, { skipH = null } = {}) {
  const now = Date.now(), p = (txt, ic = '') => `<p class="t6-sl">${ic ? icon(ic) : ''}<span>${txt}</span></p>`;
  if (season === 'prep' || season === 'between') {
    const pt = prepTaskOf(v.id), ended = endedLine();
    if (season === 'prep' && pt && !(w.prepIsNext)) {
      const left = pt.total - pt.ready, href = pt.back.length ? issueHref(pt.back[0], 'prep') : issueHref(pt.next, 'prep');
      const line = pt.own ? `${pt.ready} of ${plural(pt.total, 'issue')} ready${prepDue() < now ? ' · still to finish' : ` · due ${esc(dayWords(prepDue()))}`}` : `Help ${esc(pt.owners.map(a => first(a.id)).join(' and '))}: ${pt.ready} of ${pt.total} ready`;
      return { title: 'Getting ready for 2027', html: p(line, 'clipboard-list') + `<div class="t6-sacts">${btn(pt.back.length ? 'Open what came back' : left ? 'Open the next one' : 'See the list', { kind: 'secondary', href })}</div>${ended}` };
    }
    if (season === 'prep' && !pt && (S.issues || []).some(i => i.owner_id === v.id || (S.issueHelpers || []).some(h => h.issue_id === i.id && h.advocate_id === v.id)))
      return { title: 'Getting ready for 2027', html: p('Your part is done. Mahalo.', 'circle-check') + ended };
    return ended ? { title: 'Between sessions', html: ended } : null;
  }
  if (season === 'opening') {
    const sorts = v.is_admin || (S.bills || []).some(b => owns(v.id, b));
    const n = sorts ? S.tdTriage?.suggested || S.tdTriage?.undecided || 0 : 0;
    if (n) return { title: 'New bills to sort', html: p(`${plural(n, 'new bill')} to decide on: support, oppose, monitor or leave.`, 'sparkles') + `<div class="t6-sacts">${btn('Sort new bills', { kind: 'secondary', href: '#/bills/new' })}</div>` };
    return { title: 'The session opens', html: v.is_admin ? p('Check the session setup before the first hearings.', 'settings') + `<div class="t6-sacts">${btn('Open Session setup', { kind: 'secondary', href: '#/setup' })}</div>`
      : p('Check how the tracker reaches you before the first hearings.', 'bell') + `<div class="t6-sacts">${btn('Open My settings', { kind: 'secondary', href: '#/me' })}</div>` };
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
  const parts = [said ? '' : nh ? p(`Your next hearing: ${nw(esc(whenAt(nh.scheduled_at)))} · ${esc(committeeName(nh.committee) || nh.committee)}`, 'landmark') : p('No hearings on your bills this week.', 'landmark'),
    dl ? p(`Next deadline ${esc(dayWords(dl.date))}: bills ${esc(deadlineWords(dl.label, dl.date, { n: 2 }).replace(/ by .*$/, ''))}`, 'calendar') : ''];
  if (!parts.join('')) return null;
  return { title: 'This week', html: parts.join('') };   // Hearings is a place in the sidebar and the phone bar, always in sight
}
function nextHearing(v, w) {
  const now = Date.now(), wk = now + 7 * DAY;
  return (S.hearings || []).filter(h => { const t = ms(h.scheduled_at), b = billById(h.bill_id); return h.status !== 'cancelled' && t > now && t < wk && b && isPos(b) && (owns(v.id, b) || inCoal(v, b) || (S.attend?.[h.id] || []).includes(v.id) || w.own.some(i => i.h && i.h.id === h.id)); })
    .sort((x, y) => ms(x.scheduled_at) - ms(y.scheduled_at))[0] || null;
}
function nextDeadline(v) {
  const day = hday(Date.now());
  const r = (DEADLINE_ROWS || []).filter(x => !x.bills && String(x.deadline_date).slice(0, 10) >= day && x.key !== 'intro_cutoff').sort((a, b) => String(a.deadline_date).localeCompare(String(b.deadline_date)))[0];
  return r ? { label: r.label, date: String(r.deadline_date).slice(0, 10) } : null;
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
function startSteps(v = S.me) {
  const drafts = Object.values(S.drafts || {}).flat(), notes = [...(S.demoNotes || []), ...Object.values(S.legNotes || {}).flat()];
  const base = (() => { try { return newSteps(); } catch { return []; } })();
  const set = base.find(s => s.k === 'settings') || { k: 'settings', done: false, title: 'Choose how the tracker reaches you', href: '#/me' };
  const season = seasonOf(), ownsNone = !(S.bills || []).some(b => owns(v.id, b));
  const steps = [{ k: 'settings', done: !!set.done, title: 'Choose how the tracker reaches you', href: '#/me' }];
  if (season === 'prep' || season === 'between') {
    const pt = prepTaskOf(v.id);
    steps.push({ k: 'prep', done: !pt, title: 'Get your 2027 issue ready', href: pt ? issueHref(pt.back[0] || pt.next, 'prep') : prepListHref() });
    steps.push({ k: 'bills', done: !!base.find(s => s.k === 'bill')?.done, title: ownsNone ? 'Look over your coalition’s bills' : 'Look over your bills', href: '#/bills' });
  } else {
    // The person's real job, ticked when it has been done once (V29: from history, not from what is on screen).
    if (v.can_approve || v.is_reviewer || v.is_admin) steps.push({ k: 'job', done: drafts.some(d => d.approved_by === v.id || d.second_approved_by === v.id), title: 'Approve a testimony draft', href: '#/testimony?view=approve' });
    else if (ownsNone && coalIds(v).length) steps.push({ k: 'job', done: drafts.some(d => d.submitted_by === v.id && d.submitted_at), title: 'Send a testimony draft for approval', href: '#/testimony' });
    else steps.push({ k: 'job', done: notes.some(n => n.advocate_id === v.id && /^Asked for/.test(n.body || '')), title: 'Ask a chair for a hearing', href: '#/hearings/ask' });
    steps.push({ k: 'week', done: !!base.find(s => s.k === 'week')?.done || Object.values(S.attend || {}).some(ids => ids.includes(v.id)), title: 'See this week’s hearings', href: '#/hearings' });
  }
  return steps;
}
function startCard(v = S.me, { line = false, n: sfx = '' } = {}) {
  if (!v || v.id !== S.me?.id || v.prefs?.firstrun?.hidden) return '';
  const at = startedAt(v); if (at == null || Date.now() - at > 45 * DAY) return '';
  const steps = startSteps(v), n = steps.filter(s => s.done).length; if (n === steps.length) return '';
  // After a week it is one line, the way back to the list in Help (V29: it fades); the first week it is the short list. On a
  // phone it is always the one line (R-316 W7), so the work under it stays on the first screen.
  if (line || Date.now() - at > 7 * DAY) return `<nav class="t6-doors t6-startl" aria-label="Getting started"><a class="t6-line" href="#/help/new">${icon('sparkles')}<span class="t6-lt"><b>Getting started</b> · ${n} of ${steps.length} done</span>${icon('chevron-right', { cls: 't6-chev' })}</a></nav>`;
  return `<section class="t6-start" aria-labelledby="t6-start-h${sfx}"><h2 class="t6-starth" id="t6-start-h${sfx}">${icon('sparkles')}<span>Getting started</span> <span class="t6-startn">${n} of ${steps.length} done</span></h2>
    <ul class="t6-steps">${steps.map(s => `<li><a class="t6-stp${s.done ? ' done' : ''}" href="${esc(s.href)}" data-t6fr="${esc(s.k)}">${icon(s.done ? 'circle-check' : 'circle-dashed')}<span class="sr">${s.done ? 'Done: ' : 'To do: '}</span><span>${esc(s.title)}</span></a></li>`).join('')}</ul></section>`;
}

// ---- Done today (a quiet band, Undo on each) ----
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
  return out.sort((x, y) => y.at - x.at);
}
function doneBand(v = S.me) {
  const list = doneToday(v); if (!list.length) return '';
  const open = !!S.t6DoneOpen;
  return `<details class="t6-done"${open ? ' open' : ''} data-t6doneband><summary>${icon('circle-check')}<span><b>Done today</b> · ${list.length}</span>${icon('chevron-down', { cls: 't6-chev' })}</summary>
    <ul class="t6-donel">${list.map((x, i) => `<li><span>${esc(x.words)}</span>${btn('Undo', { kind: 'text', sm: true, icon: 'undo-2', attrs: { 'data-t6undo': String(i) } })}</li>`).join('')}</ul></details>`;
}

// ---- the page ----
function dateLine(bd) {
  const day = new Date().toLocaleDateString('en-US', { ...HST, weekday: 'short', month: 'short', day: 'numeric' });
  return `<p class="t6-date"><span>${esc(day)}</span>${bd.lateN ? `<span class="t6-over">${icon('circle-alert')}${bd.lateN} overdue</span>` : ''}</p>`;
}
const groupHTML = (id, title, rows, extra = '') => rows ? `<section class="t6-group" aria-labelledby="t6-g-${id}"><h2 class="t6-gh" id="t6-g-${id}">${esc(title)}</h2><div class="v6-list t6-list" role="list">${rows}</div>${extra}</section>` : '';

// The whole list for one viewer: the next step, Do today, Coming up. `ro` draws a teammate's list read-only (Team ›
// See as teammate): no buttons, no colour, no Done today, no doors but its own waiting count.
// The next step is worked out once, from everything the person has (the same step at every width: the critic's 4 and 11);
// `skip` only leaves rows out of the groups (a phone's hearing cards carry their own steps), never changes which is next.
export function listHTML(v = S.me, { ro = false, skip = null, soonN = SOON_SHOWN, hideHear = false } = {}) {
  const w = work(v), g0 = groupsOf(w), more = !!S.t6More, nx = g0.next;
  const keep = i => i !== nx && (!skip || !skip(i));
  const today = g0.today.filter(keep), soon = g0.soon.filter(keep), partner = g0.partner.filter(keep);
  // Fold only a long Coming up, and never to hide one or two rows (rule 3).
  const fold = !more && soon.length > soonN + 2, shown = fold ? soon.slice(0, soonN) : soon, rest = soon.length - shown.length;
  // `hideHear`: the next step's sitting is a card on the same page (a hearing day), so its card leaves out the hearing line.
  const nextH = (n = '') => nx ? `<section class="t6-next${hideHear ? ' t6-nohear' : ''}" aria-labelledby="t6-next-t${n}"><h2 class="t6-nexth" id="t6-next-t${n}">${ro ? `${esc(first(v.id))}’s next step` : 'Your next step'}</h2>${ro ? roCard(nx, v) : nextCard(nx, v, 't6-next-h' + n)}</section>`
    : clearCard(v, w, ro, n);
  const showMore = rest > 0 || (more && soon.length > soonN + 2) ? `<p class="t6-more">${btn(more ? 'Show fewer' : `Show all ${soon.length} coming up`, { kind: 'text', icon: more ? 'chevron-up' : 'chevron-down', attrs: { 'data-t6act': 'more', 'aria-expanded': String(more) } })}</p>` : '';
  const groups = `${groupHTML('today', 'Do today', today.map(i => rowOf(i, { ro, v })).join(''))}${groupHTML('soon', 'Coming up', shown.map(i => rowOf(i, { ro, v })).join(''), showMore)}${groupHTML('pq', 'Partner words to approve', partner.map(i => rowOf(i, { ro, v })).join(''))}`;
  return { w, g: { today, soon, partner, next: nx }, nextH, groups, html: nextH() + groups, rows: today.length + shown.length + partner.length + (rest > 0 ? 1 : 0) };
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
  // A coalition helper's quiet day says whose asks they could help with (D4), as the line it stands in for.
  const co = [...w.coal.entries()], coN = co.reduce((s, [, e]) => s + e.n, 0), coBy = co.length ? Math.min(...co.map(([, e]) => e.by)) : null;
  // (a sitting already drawn as its card on this page is not said again here: A-14)
  const onPage = !!nh && sittingsToday(v, w).some(h => sitKey(h) === sitKey(nh));
  const text = !ro && co.length ? `${orWords(co.map(([id]) => id), v, { and: true })} ${co.length > 1 ? 'have' : 'has'} ${coN === 1 ? 'a hearing ask' : plural(coN, 'hearing ask')} to make, ${coN === 1 ? 'by' : 'the first by'} ${dayWords(coBy)}. You can offer to help.`
    : nh && !onPage ? `Next hearing: ${whenAt(nh.scheduled_at)}, ${committeeName(nh.committee) || nh.committee}.` : SESSION_OVER ? 'Hearings return when the next session opens.' : '';
  // With nothing of their own, the one filled button is the most useful next place: the coalition's hearing asks for a
  // helper (D4), the next hearing, or Hearings.
  const go = ro ? '' : lost ? btn('Pick your coalition', { href: '#/my-issues/coalitions' }) : w.coal.size ? btn('Offer to help', { icon: 'hand-heart', href: '#/hearings/ask' })
    : nh ? btn('Open the hearing', { icon: 'landmark', href: `#/hearing/${encodeURIComponent(nh.id)}?from=today` })
    : ['conference', 'governor'].includes(seasonOf()) ? btn('Open your bills', { icon: 'file-text', href: '#/bills' }) : SESSION_OVER || seasonOf() === 'prep' || seasonOf() === 'between' ? '' : btn('Open Hearings', { icon: 'landmark', href: '#/hearings' });
  return `<section class="t6-clear" aria-labelledby="t6-clear-h${n}"><h2 class="t6-clh" id="t6-clear-h${n}">${ro ? `Nothing is waiting on ${esc(first(v.id))}.` : lost ? 'Pick the coalition you help on' : 'Nothing needs you today.'}</h2>
    ${lost ? '<p>Its hearings and testimony show here once you switch on I help on it.</p>' : text ? `<p>${nw(esc(text))}</p>` : ''}${go ? `<p class="t6-clgo">${go}</p>` : ''}</section>`;
}
// What a draw of Today is made of, worked out once (render, and the side column when a picked item closes).
// Each own step on today's sittings is said once (A-14; the critic's 3 and 4): on a phone's hearing day inside its big card
// (the next step's row first, with the screen's one filled button: V14); at other widths in the list and the next-step
// card, the sitting's card (the season card's slot, addendum 3) keeping the others' steps.
function plan(v = S.me) {
  const w = work(v), g = groupsOf(w), next = g.next, sits = sittingsToday(v, w), phone = PHONE();
  const onSit = new Set(sits.map(sitKey)), onCard = i => !!(i && i.b && i.h && isPos(i.b) && onSit.has(sitKey(i.h)));
  const phoneDay = phone && sits.length > 0, nextOnCard = phoneDay && onCard(next);
  const drop = h => new Set(w.own.filter(i => onCard(i) && sitKey(i.h) === sitKey(h)).map(i => i.b.id));
  // The sitting the next step (or, with nothing to do, the quiet card) already names, so the season card does not.
  const nh = next ? null : nextHearing(v, w), skipH = next?.h ? sitKey(next.h) : nh ? sitKey(nh) : null;
  const rows = [...g.today, ...g.soon, ...g.partner].filter(i => i !== next && !(phoneDay && onCard(i))).length;
  // From 1100px on a day with rows and no sitting, the next step (and Getting started under it) leads the side column beside
  // the list, so the lists start at the top of the first screen (spec 8: Kevin's chair ask, Email the chair, on his first
  // screen; the page near 1.2 screens). On a hearing day the side column is the person's sittings and the next step leads
  // the work column; on a quiet day (nothing to list) it leads the work column too.
  const sideNext = !!next && rows > 0 && !sits.length;
  return { w, g, next, sits, phone, phoneDay, onCard, nextOnCard, drop, skipH, rows, sideNext, hideHear: !!(next && onCard(next)) };
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
  const lines = doorLines(w, v, { coal: !!P.next || !w.coal.size }), lead = leadLine(), done = doneBand(v);
  // Getting started sits right under the next step (the critic's 11), as one line on a phone (R-316 W7); at the Capitol on
  // a phone's hearing day it is not the job, so it waits for the laptop.
  const start = phoneDay ? '' : startCard(v, { line: phone });
  const picked = S.v6ld?.today?.key ?? null, item = picked === 'waiting' ? waitingItem(v) : picked != null && REG.has(picked) ? itemFor(picked, v) : '';
  if (picked != null && !item) S.v6ld.today.key = null;
  // A phone's hearing day (V14): one big card per sitting first (time and room at a glance), the person's own step inside
  // it with the filled button; the next-step card only when the next step is not on a sitting.
  const big = phoneDay ? `<section class="t6-hday-ph" aria-label="Your hearings today">${sits.map((h, i) => sittingCard(h, { v, big: true, id: `t6-hcb-${i}`, lead: P.nextOnCard && sitKey(P.next.h) === sitKey(h) ? P.next : null })).join('')}</section>` : '';
  // Below 1100px (not a phone) a hearing day's sittings come right under the next step; from 1100px they are the side
  // column's season card. Any other season card closes the column below 1100px, beside the doors from 768px.
  const seasonCol = phone && sits.length ? '' : seasonCard(v, w, { where: 'col', hearings: sits, drop: P.drop, skipH: P.skipH });
  const seasonSide = seasonCard(v, w, { where: 'side', hearings: sits, drop: P.drop, skipH: P.skipH });
  const hday = !!sits.length && !phone, doors = doorsNav(lines);
  const edge = doors || (!hday && seasonCol) ? `<div class="t6-edges">${doors}${!hday && seasonCol ? `<div class="t6-colonly">${seasonCol}</div>` : ''}</div>` : '';
  // Nothing for the side column and nothing to list: one calm reading column (the side opens when a door does).
  const alone = !P.rows && !seasonSide && !doors, sideNext = P.sideNext;
  return `<div class="t6-root${phone ? ' ph' : ''}${!P.rows ? ' t6-solo' : ''}${alone ? ' t6-alone' : ''}${sideNext ? ' t6-sidenext' : ''}">
    <header class="t6-head"><h1 class="v6-ptitle sv-h1 t6-h1" id="t6-h1" tabindex="-1">Today</h1>${dateLine(bd)}</header>
    <div class="v6-ld t6-ld${item ? ' open' : ''}" data-v6ld="today">
      <div class="t6-col">
        ${big}${P.nextOnCard ? '' : `<div class="t6-nextcol">${L.nextH()}</div>`}${start ? `<div class="t6-startcol">${start}</div>` : ''}${lead ? `<nav class="t6-doors t6-leadl" aria-label="The team">${lead}</nav>` : ''}
        ${hday && seasonCol ? `<div class="t6-colonly">${seasonCol}</div>` : ''}${L.groups}${edge}${done}
      </div>
      <aside class="v6-ld-detail t6-aside" aria-label="${item ? 'The item you picked' : sideNext ? 'Your next step and season' : 'Your season'}">${item ? `<button type="button" class="v6-ld-back" data-v6ldback>${icon('chevron-left')}<span>Back to the list</span></button>${sideNext ? nextStrip(v) : ''}${item}`
        : sideOf({ next: sideNext ? L.nextH('-s') : '', start: sideNext && !phone ? startCard(v, { n: '-s' }) : '', season: seasonSide, doors, rows: P.rows })}</aside>
    </div></div>`;
}
// The side column from 1100px while no row is picked: on a busy day the next step (the screen's one filled button) with
// Getting started directly under it (the critic's 11), then the season card (on a hearing day, the person's sittings), the
// one-line doors and where a picked row opens. It scrolls with the page, so nothing in it is ever out of sight below its
// own end (the critic's 1: no inner scroll area, which a Mac draws with no scrollbar). A picked row takes the side
// column's place, sticky beside the list, under one line that keeps the next step in sight and brings it back (the
// critic's 2: the one urgent thing never leaves the screen); while it is open the doors close the work column instead
// (.t6-edges), so none of them is out of reach either. On a hearing day or a quiet day the next step leads the work
// column. Below 1100px the work column holds it all, the next step first, the doors after the lists, before Done today.
const doorsNav = lines => lines.length ? `<nav class="t6-doors" aria-label="More about your work">${lines.join('')}</nav>` : '';
const sideOf = ({ next = '', start = '', season = '', doors = '', rows = 0 }) => `${next}${start}${season}${doors}${rows ? `<p class="t6-pick">${icon('arrow-left')}<span>Pick a row to see its steps</span></p>` : ''}`;
function edgeHTML(v = S.me) {
  const P = plan(v), L = P.sideNext ? listHTML(v, { hideHear: P.hideHear }) : null;
  return sideOf({ next: L ? L.nextH('-s') : '', start: L && !P.phone ? startCard(v, { n: '-s' }) : '', season: seasonCard(v, P.w, { where: 'side', hearings: P.sits, drop: P.drop, skipH: P.skipH }),
    doors: doorsNav(doorLines(P.w, v, { coal: !!P.next || !P.w.coal.size })), rows: P.rows });
}
// While a picked row fills the side column on a busy day: the next step said in one line above it; a click closes the item
// and the full card is back (wireListDetail closes on [data-v6ldclose]).
function nextStrip(v = S.me) {
  const it = groupsOf(work(v)).next; if (!it) return '';
  REG.set(it.key, it);
  const r = it.kind === 'partner' ? { name: it.p.partner_name, line: 'Partner words to approve' } : it.b && it.s ? { name: nameWords(it.b), line: lineOf(it, v) } : miniOf(it, v);
  return `<button type="button" class="t6-nextstrip" data-v6ldclose>${icon('arrow-left')}<span><b>Your next step</b> · ${esc(r.name)} · ${nw(esc(r.line))}</span></button>`;
}
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
    keepDone(`Done: ${clip(it.t.title, 60)}`, undo); await finish(el); redraw();
    toast(`Done: ${clip(it.t.title, 60)}`, { ok: true, undo }); }); },
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
    const ok = await confirmSheet({ title: `Send at 4:30 pm to ${n != null ? plural(n, 'person', 'people') : 'the followers'}?`, ok: 'Send at 4:30 pm',
      text: `${esc(a.subject)}<br><span class="small muted">${paused ? 'Email is paused, so it is held: it goes out in the first 4:30 pm email after an admin turns email on' : `It goes out ${day} at 4:30 pm`}, in each person’s one email of the day. You can take it back until then.</span>` });
    if (!ok) return;
    await busy(el, async () => { const r = await DB.alertStep(a.id, 'send'); redraw();
      toast(paused ? `Held while email is paused. It goes to ${plural(r?.recipients ?? n ?? 0, 'person', 'people')} in the first 4:30 pm email after email is turned on.` : `In ${day}’s 4:30 pm email to ${plural(r?.recipients ?? n ?? 0, 'person', 'people')}.`,
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
    if (x.undo) return await x.undo();
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
const openItemHTML = (key, v = S.me) => key === 'waiting' ? waitingItem(v) : itemFor(key, v);

// One listener for Today's own buttons (steps.js handles the step cards' and rows' own buttons).
if (typeof document !== 'undefined') document.addEventListener('click', e => {
  const el = e.target?.closest?.('[data-t6act], [data-t6undo], [data-t6wait], [data-t6give]'); if (!el || !el.closest('.t6-root, .tm6-root, dialog')) return;
  // The side column's copy of a door that opens beside the work: the column's own copy does it (wireListDetail).
  if (el.dataset.t6wait !== undefined) { if (el.closest('.v6-ld-detail')) { e.preventDefault(); document.querySelector('.t6-col [data-v6pick="waiting"]')?.click(); } return; }
  if (el.dataset.t6give !== undefined) { e.preventDefault(); const x = work().waiting.find(y => y.key === el.dataset.t6give); if (x) ACTS.give(el, { b: x.b, t: x.t }); return; }
  if (el.dataset.t6undo !== undefined) { e.preventDefault(); return undoDone(+el.dataset.t6undo); }
  const act = el.dataset.t6act;
  if (act === 'more') { e.preventDefault(); S.t6More = !S.t6More; S.t6Refocus = '[data-t6act="more"]'; return redraw(); }
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

// Getting started's steps that tick when visited (both copies: the work column's and the side column's).
const wireStart = el => el.querySelectorAll('[data-t6fr]').forEach(a => a.addEventListener('click', () => { const k = a.dataset.t6fr; if (k === 'week' || k === 'moved' || k === 'bills') markNewStep({ [k === 'bills' ? 'bill' : k]: 1 }); }));
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
  wireListDetail(main, { id: 'today', open: key => { const html = openItemHTML(key); return html && main.classList.contains('t6-sidenext') ? nextStrip() + html : html; },
    // Closing the item puts the season card and the doors back in that column (wireListDetail draws its own hint there).
    onChange: key => { if (key == null && aside) { aside.innerHTML = edge(); aside.setAttribute('aria-label', main.classList.contains('t6-sidenext') ? 'Your next step and season' : 'Your season'); wirePartner(aside); wireStart(aside); } else if (aside) { aside.setAttribute('aria-label', 'The item you picked'); wirePartner(aside); } } });
  main.querySelector('[data-t6doneband]')?.addEventListener('toggle', e => { S.t6DoneOpen = e.target.open; });
  wireStart(main);
  if (S.t6Refocus) { const el = main.querySelector(S.t6Refocus); S.t6Refocus = null; el?.focus({ preventScroll: true }); }
}

export default {
  tab: 'today',
  title: () => 'Today',
  // The Hearings stub draws v5's This week through here (wide, as before); Today itself is the frame's default width.
  wide: () => S.route?.place === 'hearings' ? !!v5.wide?.() : false,
  badge() { try { return badgeOf(); } catch (e) { console.error(e); return { n: 0, late: false, lateN: 0 }; } },
  render, wire,
};
// For Team (team.js): the same model and rows, so "See as teammate" is the teammate's own Today, read-only.
// Team draws from the same model, so each of its draws starts from fresh work too (a memo kept from the draw before the
// partners' queue arrived counted Nate's bar without his partner words: the critic's 9).
export const t6Fresh = () => { MEMO.clear(); };
export { rowOf as t6Row, groupsOf as t6Groups, nextCard as t6Next, roCard as t6RoCard, sittingsToday as t6Sittings, seasonOf as t6Season, REG as T6REG };
