// Staff7 Issues (R-398, rules S-19, S-20): the door where awareness lives. The left is a list of issues (whose: Mine, a teammate's, Everyone's) in five groups for where each stands
// (At risk, Hearing scheduled, Cleared the deadline, Moving, Stopped this year), under a first row, The session; Everyone's and a teammate's list lead with At risk and then give a row for each
// topic, which opens its own list and its own page. The right is always the thing picked from it (never an unmarked summary): the session's next deadline and the bills it touches, a topic's
// week, an issue's sheet (its bills, each with one path drawing), or a bill's page (bill.js). Looking never changes anything: only an issue that is the viewer's own has links to its steps;
// someone else's issue, in a teammate's view or Everyone's, is look-only.
// Where an issue stands is decided in ONE place, issueState below (the groups, the second line of each row, the summary and the topic page all read it); standing.js still says At risk, Moving and
// Stopped for Home. Nothing here restates the Capitol's deadlines: words.js and the data layer's stopOf do.
import { S, advocate, myIssueIds, effStage, isMine, DEMO } from '../staff6/data.js';
import { hearingAhead, wantsHearing as wantsHearingOf, plainAction, stopOf, roomName, billByRef, billRef, isCarry, introYear, sittingDraft } from '../staff6/model.js';
import { whereWords, billStep } from '../staff6/steps.js';
import { CHAMBER_NAME, isOneChamber } from '../stops.js';
import { ic } from './icons7.js';
import { esc, btn, plainBand } from './parts.js';
import { billName, billNo, posWords, cmteWords, dayTime, first } from './steps.js';
import { myIssueStandings, billsOfIssue, issueStanding, billStanding, deadlineOf, isAtRisk, isAlive } from './standing.js';
import { withMe, sessionHTML } from './home.js';
import { dateWords, whenWords, sessionDates, touchMap, nextStop, whyWords, daysTo, dayName } from './words.js';
import { billPath, pathOf } from './path.js';
import { boxHTML, issueHits, mark } from './find.js';
import { testimonyDue, draftFor, letterState, testimonyWords, leadIds } from './bill_words.js';
import { billSheet, bindBill } from './bill.js';
export { testimonyDue };   // Calendar reads it from here

const enc = encodeURIComponent;
// What is open in the left column, kept across the minute's redraw in this visit only: the teammate picker, the "Moved" list, which groups were opened ("Show all N"), and when this person last looked.
export const ui = { pick: false, more: '', folds: {}, look: null, redraw: null };   // more: the view (its `who` code) whose "Moved" list was opened, kept across the minute's redraw

// "e-cigarettes", never "vape": the Legislature's own titles stay as written, but an issue's name is HIPHI's (CLAUDE.md R-158)
export const eCig = s => String(s || '').replace(/\bvap(?:e|es|ing)\b/gi, m => /^vap(es|ing)$/i.test(m) ? 'e-cigarettes' : 'e-cigarette');
const catOf = i => i && /^[a-z-]+$/.test(i.category || '') ? i.category : 'other';
export const iconOf = i => (i && i.icon) || (S.categories || []).find(c => c.key === i?.category)?.icon || 'circle';
export const tint = i => `--ic:var(--cat-${catOf(i)}, var(--cat-other))`;
const live = id => !!id && advocate(id)?.is_active !== false;
const n = (k, one, many) => `${k} ${k === 1 ? one : many}`;

// ---------------------------------------------------------------------------------- whose issues, and the address
// `?who=` is nothing (Mine), `all` (Everyone) or a teammate's initials. A value that is none of these is "bad": the sheet says so calmly.
// `?show=` narrows a list to one group (risk, hearing, cleared, moving, stopped) and `?topic=` keeps a topic's list beside an issue's sheet; both ride on the `who` object so every link keeps them.
export function whoOf(raw, me, people) {
  if (raw == null || raw === '') return { kind: 'mine', code: '' };
  const r = String(raw).slice(0, 40);
  if (r.toLowerCase() === 'all') return { kind: 'all', code: 'all' };
  const p = people.find(a => String(a.initials || '').toUpperCase() === r.toUpperCase());
  if (!p) return { bad: true, kind: 'mine', code: '' };
  if (me && p.id === me.id) return { kind: 'mine', code: '' };
  return { kind: 'person', code: p.initials, person: p };
}
const qs = (who, extra = {}) => { const q = new URLSearchParams(); if (who.code) q.set('who', who.code); if (who.topic) q.set('topic', who.topic); if (who.show) q.set('show', who.show); for (const [k, v] of Object.entries(extra)) if (v) q.set(k, v); const s = q.toString(); return s ? `?${s}` : ''; };
export const noTopic = who => ({ ...who, topic: '' });
export const issuesHref = who => `#/issues${qs(noTopic(who))}`;
const topicHref = (who, key) => `#/issues/topic/${enc(key)}${qs(noTopic(who))}`;
const listHref = who => who.topic ? topicHref(who, who.topic) : issuesHref(who);   // where "back" goes: the topic's list when an issue was opened from a topic
export const issueHref = (who, id) => `#/issue/${enc(id)}${qs(who)}`;
export const billHref = (who, b, issueId, from = '') => `#/bill/${billRef(b).split('/').map(enc).join('/')}${qs(who, { i: issueId, from })}`;   // `from`: 'calendar' or 'search', so the bill page can say where Back goes
const whoseWords = (who, me) => who.kind === 'mine' ? 'Your' : who.kind === 'all' ? 'Everyone’s' : `${first(who.person)}’s`;

// ---------------------------------------------------------------------------------- the set
// Every issue of the chosen set with its standing and the days left on its soonest at-risk bill: { issue, bills, standing, days }
export function setFor(who, me) {
  const rows = who.kind === 'all'
    ? (S.issues || []).filter(i => !i.archived_at).map(i => { const bills = billsOfIssue(i); return { issue: i, bills, standing: issueStanding(bills) }; }).filter(x => x.standing)
    : withMe(who.kind === 'person' ? who.person : me, myIssueStandings);
  return rows.map(x => { const ds = x.bills.filter(isAtRisk).map(b => deadlineOf(b).days); return { ...x, days: ds.length ? Math.min(...ds) : null }; });
}
const byName = (x, y) => eCig(x.issue.name).localeCompare(eCig(y.issue.name), 'en', { numeric: true });

// ---------------------------------------------------------------------------------- where an issue stands: five groups
// In order of how much they need a look. A bill is in exactly one; an issue takes the first of these that any of its ALIVE bills is in, and an issue with no alive bill is Stopped.
//   risk      the next deadline affects it and it has no hearing set (standing.js isAtRisk)
//   hearing   alive, not at risk, and a hearing is scheduled and has not started (the data layer's hearingAhead: not cancelled, not yet begun)
//   cleared   alive, no hearing set, and the session's next deadline is one this bill has already passed (clearedOf)
//   moving    alive and none of the above
//   stopped   did not advance this year
export const STATES = [['risk', 'At risk', 'at risk'], ['hearing', 'Hearing scheduled', 'with a hearing'], ['cleared', 'Cleared the deadline', 'cleared the deadline'], ['moving', 'Moving', 'moving'], ['stopped', 'Stopped this year', 'stopped']];
const STATE_KEYS = STATES.map(s => s[0]);

// The session's next deadline for ALL issues. No longer used for the lists (each list uses its own session, sessionOf, so it agrees with the session row above it); kept for search.
export function nextCtx() {
  const seen = new Set(), bills = [];
  for (const i of S.issues || []) if (!i.archived_at) for (const b of billsOfIssue(i)) if (!seen.has(b.id)) { seen.add(b.id); bills.push(b); }
  const rows = sessionDates(null), touch = touchMap(bills);
  return { rows, touch, next: nextStop(rows, touch) };
}

// Has this alive bill already passed the deadline of `row`? 'yes', 'no' (the deadline is not one of its steps, or it has not got there) or 'unknown' (the data cannot say).
// The data layer's stopOf names the deadline each bill races NEXT (its deadlineKey) and the order of a bill's road is fixed, so a bill that is racing a LATER gate has passed this one, provided
// this gate is one of its steps: the second chamber's gates depend on how many committees the bill was sent to there (Triple filing: three or more; Lateral: two or more; Decking: any).
const RANK = { first_triple: 1, first_lateral: 2, first_decking: 3, first_crossover: 4, second_triple: 5, second_lateral: 6, second_decking: 7, second_crossover: 8, conference: 9 };
const GATE = k => k === 'first_triple_senate' ? 'first_triple' : k === 'final_decking' || k === 'fiscal' ? 'conference' : k;
const secondCmtes = (b, st) => {   // how many committees the bill was sent to in the second chamber
  if (st.leg === 'second') return st.stops;
  const refs = Array.isArray(b.referrals) ? b.referrals : [], o = Math.min(b.origin_stops || 0, refs.length);
  return o ? refs.length - o : 0;
};
export function clearedOf(b, row) {
  if (!row || !b || !isAlive(b)) return 'no';
  const k = row.key, st = stopOf(b);
  if (k === 'governor' || GATE(st.deadlineKey) === k) return 'no';   // the last day is nobody's "cleared"; racing it is the opposite
  const here = RANK[GATE(st.deadlineKey)] ?? (['governor', 'law', 'ballot'].includes(st.phase) ? 9.5 : null);
  if (RANK[k] == null || here == null) return 'unknown';
  if (k === 'first_crossover') return isOneChamber(b) || st.leg === 'first' ? 'no' : 'yes';
  if (k === 'conference') return here > RANK.conference ? 'yes' : 'no';
  if (st.leg === 'first') return 'no';   // still in its first chamber: the second chamber's gates are not its steps yet
  const c = secondCmtes(b, st);
  if (!c) return 'unknown';   // sent on, but the referral list does not say to how many committees
  return c < (k === 'second_triple' ? 3 : k === 'second_lateral' ? 2 : 1) ? 'no' : here > RANK[k] ? 'yes' : 'no';
}
const ymdHST = t => new Date(t).toLocaleDateString('en-CA', { timeZone: 'Pacific/Honolulu' });
const numOf = b => String(b.bill_number).replace(/\s/g, '');
const byNum = (x, y) => numOf(x).localeCompare(numOf(y), 'en', { numeric: true });
function billState(b, nx) {
  if (!isAlive(b)) return { b, state: 'stopped' };
  const dl = deadlineOf(b);
  if (isAtRisk(b)) return { b, state: 'risk', dl, at: dl.date };
  const h = hearingAhead(b);
  if (h) return { b, state: 'hearing', h, at: new Date(h.scheduled_at).getTime() };
  const c = nx && nx.next ? clearedOf(b, nx.next.row) : 'no';
  return { b, state: c === 'yes' ? 'cleared' : 'moving', unknown: c === 'unknown', row: nx?.next?.row };
}
const recent = (x, y) => String(y.b.last_action_date || '').localeCompare(String(x.b.last_action_date || '')) || byNum(x.b, y.b);
// The one function the groups, the rows' second lines, the summary and the topic page all read: { state, bill (the one that gave the issue its state), at (when: a deadline date or a hearing's time), dl, h, row, unknown }
export function issueState(bills, nx) {
  if (!bills || !bills.length) return null;
  const per = bills.map(b => billState(b, nx));
  const k = STATE_KEYS.find(s => per.some(p => p.state === s)), hit = per.filter(p => p.state === k);
  const best = k === 'risk' ? hit.sort((x, y) => x.at.localeCompare(y.at) || byNum(x.b, y.b))[0]
    : k === 'hearing' ? hit.sort((x, y) => x.at - y.at || byNum(x.b, y.b))[0]
    : k === 'cleared' ? hit.sort((x, y) => (nextWhere(y.b) ? 1 : 0) - (nextWhere(x.b) ? 1 : 0) || recent(x, y))[0]
    : k === 'stopped' ? hit.sort((x, y) => pathOf(y.b).i - pathOf(x.b).i || recent(x, y))[0] : hit.sort(recent)[0];
  return { ...best, bill: best.b, state: k, unknowns: per.filter(p => p.unknown).length };
}
// the committee a cleared bill goes to next, when the data says: the one it now waits in
function nextWhere(b) { const st = stopOf(b); return st.phase === 'committee' && st.committee ? st.committee : ''; }
// The words for the one thing worth knowing about the issue, taken from the bill that gave it its state: { text, risk, icon } or null. Nothing here repeats the group's heading.
const clockOf0 = t => new Date(t).toLocaleTimeString('en-US', { timeZone: 'Pacific/Honolulu', hour: 'numeric', minute: '2-digit' });
export const hearTxt = t => { const d = daysTo(ymdHST(t)); return d === 0 ? `today ${clockOf0(t)}` : d === 1 ? `tomorrow ${clockOf0(t)}` : dayTime(t); };
const relWords = d => { const k = daysTo(d); return k <= 0 ? 'today' : k === 1 ? 'tomorrow' : `in ${k} days`; };
const COMMITTEE_PHASES = { floor: 'Ready for the floor vote', conference: 'In conference', governor: 'With the Governor', law: 'Signed into law', ballot: 'Going to the voters' };
function movingWords(b) {
  const st = stopOf(b); let t;
  if (st.phase === 'committee' && st.committee) {
    const codes = String(st.committee).split('/').map(c => c.trim()).filter(Boolean);
    t = codes.length > 1 ? `In ${codes.length} ${CHAMBER_NAME[st.chamber] || ''} committees`.replace('  ', ' ') : `In ${cmteWords(codes[0])}`;
  } else t = COMMITTEE_PHASES[st.phase] || whereWords(b, { deadline: false });
  return st.deadline && !st.deadline.missed ? `${t} · has until ${dateWords(st.deadline.date)}` : t;
}
function secondOf(st, nx) {
  const b = st.bill;
  if (st.state === 'risk') return { text: `Needs a hearing by ${dateWords(st.dl.date).split(',')[0]} · ${relWords(st.dl.date)}`, risk: true, icon: 'triangle-alert' };
  if (st.state === 'hearing') {
    const r = nx && nx.next ? nx.next.row : null, before = r && (nx.touch.get(r.key) || []).some(y => y.id === b.id) && ymdHST(st.h.scheduled_at) < r.date;
    return { text: `Hearing ${hearTxt(st.h.scheduled_at)}${before ? ` · before ${dayName(r.date)}’s deadline` : ''}` };
  }
  if (st.state === 'cleared') { const c = nextWhere(b); return { text: c ? `Next: ${cmteWords(c)}` : whereWords(b, { deadline: false }) }; }
  if (st.state === 'moving') return { text: movingWords(b) };
  const p = pathOf(b); return { text: p.i >= 1 ? `Stopped at ${p.label}` : 'Stopped this year' };
}
// The issues of a set with their state: { issue, bills, standing, days, k (the group's key), st (issueState), second }
export function statesFor(set, nx) {
  return set.map(x => { const st = issueState(x.bills, nx); return { ...x, k: st.state, st, second: secondOf(st, nx) }; });
}
const whenKey = x => x.k === 'risk' ? x.st.at : x.k === 'hearing' ? x.st.at : null;
const inGroup = (rows, k) => rows.filter(x => x.k === k).sort((x, y) => { const a = whenKey(x), c = whenKey(y); return a == null ? byName(x, y) : (k === 'risk' ? a.localeCompare(c) : a - c) || byName(x, y); });

// ---------------------------------------------------------------------------------- topics
// An issue is in its own category and in any extra ones (S.issueCats); an issue with none is in "Other", the last topic.
const catKeys = () => (S.categories || []).map(c => c.key);
export function catsOf(i) {
  const ks = new Set(), all = catKeys();
  if (all.includes(i.category)) ks.add(i.category);
  for (const x of S.issueCats || []) if (String(x.issue_id) === String(i.id) && all.includes(x.category)) ks.add(x.category);
  return ks.size ? [...ks] : ['other'];
}
const topicsOf = rows => [...(S.categories || []).map(c => ({ key: c.key, name: c.name, icon: c.icon })), { key: 'other', name: 'Other', icon: 'layers' }]
  .map(t => ({ ...t, rows: rows.filter(x => catsOf(x.issue).includes(t.key)) })).filter(t => t.rows.length);
const tally = rows => { const t = { risk: 0, hearing: 0, cleared: 0, moving: 0, stopped: 0 }; for (const x of rows) t[x.k]++; return t; };

// ---------------------------------------------------------------------------------- what changed since this person last looked
const LOOK_KEY = 'hiphi7_looked_', DAY = 864e5;
// The time to count changes from: the stored time when it is within 7 days, else 3 days back
export const sinceFor = (stored, now) => { const t = Number(stored); return Number.isFinite(t) && t > 0 && t <= now && now - t <= 7 * DAY ? t : now - 3 * DAY; };
function saveLook() {
  const l = ui.look; if (!l) return; clearTimeout(l.t); l.t = 0;
  if (DEMO || l.saved || !l.drawn || !l.k) return;   // never on the practice copy; only when the Changed group was drawn in this visit; never without initials
  l.saved = true; try { localStorage.setItem(LOOK_KEY + l.k, String(Date.now())); } catch { /* the page still works without it */ }
}
// Read once when Issues opens (kept in `ui` for the visit, so the minute's redraw counts from the same time). `fallback`: counted from 3 days back, not from a stored time.
// Written when the person leaves Issues or after 10 seconds, but only once the Changed group has been drawn (markDrawn).
function lookState(me) {
  const k = String(me?.initials || '').toUpperCase();
  if (ui.look && ui.look.k === k) return ui.look;
  saveLook();
  const now = Date.now(); let stored = null;
  if (!DEMO && k) try { stored = localStorage.getItem(LOOK_KEY + k); } catch { /* none */ }
  const since = DEMO || !k ? now - 3 * DAY : sinceFor(stored, now);
  ui.look = { k, since, fallback: since === now - 3 * DAY, t: 0, saved: false, drawn: false };
  return ui.look;
}
function markDrawn() { const l = ui.look; if (!l || l.drawn) return; l.drawn = true; if (!DEMO && l.k && !l.t) l.t = setTimeout(saveLook, 10000); }
addEventListener('hashchange', () => { if (ui.look && !/^#\/(issues|issue|bill)(\/|\?|$)/.test(location.hash)) { saveLook(); ui.look = null; } });
addEventListener('pagehide', () => saveLook());

// Hearings and the Capitol's hearing notices are said under Next 7 days, so a "move" leaves them out (the session page's "Moved" list and this one share it)
const HEARING_ACT = /^(?:Hearing|Decision making) (?:set|moved|cancelled)|^Taken off|^Hearing notice/i;
const HEARING_RAW = /has scheduled a public hearing|to be heard by|will hold a public decision making|has rescheduled|deleted from the meeting|^Meeting scheduled on|hours? notice|day notice/i;
const isMove = b => !HEARING_ACT.test(plainAction(String(b.last_action || ''))[0]) && !HEARING_RAW.test(String(b.last_action || ''));
// issue id -> { at, text }: the latest of a hearing set, a letter sent back to the viewer, a bill that moved, since `since`
function changesFor(rows, open, since) {
  const now = Date.now(), sinceDay = ymdHST(since), today = ymdHST(now), out = new Map(), pri = { hearing: 3, letter: 2, move: 1 };
  const add = (id, at, text, kind) => { const c = out.get(id); if (!c || at > c.at || (at === c.at && pri[kind] > pri[c.kind])) out.set(id, { at, text, kind }); };
  for (const x of rows) {
    const id = String(x.issue.id);
    for (const b of x.bills) {
      if (isAlive(b)) for (const h of S.hearings || []) {
        const posted = h.notice_posted_at ? new Date(h.notice_posted_at).getTime() : NaN;
        if (h.bill_id === b.id && h.status === 'scheduled' && new Date(h.scheduled_at).getTime() > now && posted >= since && posted <= now) add(id, posted, `Hearing set for ${dayTime(h.scheduled_at)}`, 'hearing');
      }
      const d = String(b.last_action_date || '').slice(0, 10);
      if (d && d >= sinceDay && d <= today && isMove(b)) add(id, new Date(d + 'T12:00:00-10:00').getTime(), movedWords(b), 'move');
    }
  }
  for (const s of open || []) {
    const t = s.draft?.updated_at ? new Date(s.draft.updated_at).getTime() : NaN, id = String(s.issue?.id ?? '');
    if (s.sentBack && id && t >= since && t <= now && rows.some(x => String(x.issue.id) === id)) add(id, t, 'Testimony sent back to fix', 'letter');
  }
  return out;
}

// ---------------------------------------------------------------------------------- the session, for a set
// The session's rows, which of them touch the set's bills, and the next one that does
export function sessionOf(set) {
  const rows = sessionDates(null), bills = [], seen = new Set();
  for (const x of set) for (const b of x.bills) if (!seen.has(b.id)) { seen.add(b.id); bills.push({ b, issue: x.issue }); }
  const touch = touchMap(bills.map(x => x.b));
  return { rows, bills, touch, next: nextStop(rows, touch) };
}

// ---------------------------------------------------------------------------------- the left column
// Look-only depends on the issue, not the view: the viewer's own issues keep their links to their steps, anyone else's say "Look only".
const ownSet = me => new Set(withMe(me, () => [...myIssueIds()]).map(String));
const secHTML = s => s ? `<span class="ir2 one${s.risk ? ' risk' : ''}" title="${esc(s.text)}">${s.icon ? ic(s.icon) : ''}<span>${esc(s.text)}</span></span>` : '';
const newHTML = text => `<span class="ir2 one" title="${esc(text)}"><span class="vh">New: </span><span>${esc(text)}</span></span>`;
// the lead's initials at the right of a row, on Everyone and on a teammate's list (there, only when the lead is someone else)
function leadOf(i, who) {
  if (who.kind === 'mine' || !live(i.owner_id)) return '';
  const a = advocate(i.owner_id); if (!a?.initials || (who.kind === 'person' && a.id === who.person.id)) return '';
  return `<span class="person sm" role="img" aria-label="Led by ${esc(first(a))}">${esc(a.initials)}</span>`;
}
function row(x, who, openId, second, hid, fx, mk) {
  const i = x.issue, on = String(i.id) === openId, dead = x.k === 'stopped';
  const mark = dead ? '<span class="imark" style="--ic:var(--edge)" aria-hidden="true">' : `<span class="imark" style="${tint(i)}" aria-hidden="true">`;
  return `<li${fx ? ' class="fx"' : ''}${hid ? ' hidden' : ''}><a class="sr3 ir${on ? ' sel' : ''}${dead ? ' dead' : ''}"${on ? ' aria-current="true"' : ''} href="${issueHref(who, i.id)}">${mark}${ic(iconOf(i))}</span><span class="sv"><b>${mk ? mk(eCig(i.name)) : esc(eCig(i.name))}</b>${second}</span>${leadOf(i, who)}</a></li>`;
}
function sessionRow(who, ses, on) {
  const nx = ses.next, line = nx ? `${nx.row.label} · ${whenWords(nx.row.date)}` : 'The session has ended';
  return `<ul class="srows3 sessrow"><li><a class="sr3 ir${on ? ' sel' : ''}"${on ? ' aria-current="true"' : ''} id="sessionRow" href="#/issues/session${qs(who)}"><span class="imark" style="--ic:var(--act)" aria-hidden="true">${ic('flag')}</span><span class="sv"><b>The session</b><span class="ir2">${esc(line)}</span></span></a></li></ul>`;
}
// A group: its heading with the count of ALL its issues, its first `limit` rows, and a button for the rest. `shut`: only the heading and a button ("Stopped this year"). `all`: no fold (a narrowed list, a list in full).
// `held`: issues of the group that are drawn above, under Changed, and so not repeated: the group says how many.
const FOLD = 5;
function groupHTML(id, label, count, lis, vkey, { shut = false, all = false, limit = FOLD, held = 0 } = {}) {
  const key = `${vkey}|${id}`, open = !!ui.folds[key], hide = lis.length > 0 && (shut || (!all && lis.length > limit)), list = lis.map((li, k) => { const fx = !all && !shut && k >= limit; return li(fx && !open, fx); }).join('');
  const lid = `gl-${id}`, word = shut ? [`Show ${lis.length}`, 'Hide'] : [`Show all ${lis.length}`, 'Show fewer'];
  const ctl = hide ? `<p class="more gfold"><button class="sl sbtn" type="button" id="more-${id}" aria-expanded="${open}" aria-controls="${lid}" data-ifold="${esc(key)}" data-shut="${shut ? 1 : 0}" data-show="${esc(word[0])}" data-hide="${esc(word[1])}">${esc(open ? word[1] : word[0])}</button></p>` : '';
  const hid = id === 'changed' ? 'c-changed' : `g-${id}`;
  return `<section aria-labelledby="${hid}"><h3 class="glab" id="${hid}">${label} · ${count}</h3>${lis.length ? `<ul class="srows3" id="${lid}"${shut && !open ? ' hidden' : ''}>${list}</ul>` : ''}${ctl}${held ? `<p class="hint held">${held} more above, under Changed</p>` : ''}</section>`;
}
// The summary sentence: "26 issues: 1 at risk · 4 with a hearing · ..." Each count narrows the list to that group; the active one is marked, and pressing it again clears it.
function summaryHTML(t, total, who, hrefFor) {
  const parts = STATES.filter(([k]) => t[k]).map(([k, , w]) => `<a class="sl nw" id="sum-${k}" href="${hrefFor(who.show === k ? '' : k)}"${who.show === k ? ' aria-current="true"' : ''}>${t[k]} ${w}</a>`);
  return `<p class="summ" id="summ">${n(total, 'issue', 'issues')}${parts.length ? `: ${parts.join(' · ')}` : ''}</p>` + (who.show ? `<p class="summ"><a class="sl" id="showAll" href="${hrefFor('')}">Show all issues</a></p>` : '');
}
function column(who, set, people, me, openKey, ses, x) {
  const { rows, nx, changes, topic, topics } = x, mate = who.kind === 'person', vkey = `${who.code || 'mine'}|${topic ? topic.key : ''}`, q0 = x.q || '';
  const seg = (id, label, on, href) => `<a class="seg" id="${id}" href="${href}"${on ? ' aria-current="true"' : ''}>${label}</a>`;
  const pick = ui.pick || false;
  const mates = people.filter(a => (!me || a.id !== me.id) && a.is_active !== false).sort((p, q) => String(p.full_name).localeCompare(String(q.full_name), 'en'));
  let h = `<header class="ihead"><div class="ihl"><h2 class="ihd" id="ihd">${mate ? `${esc(first(who.person))}’s issues` : who.kind === 'all' ? 'Everyone’s issues' : 'Issues'}</h2>${mate ? '<button class="btn text chg" type="button" id="whoChange" aria-controls="whoPick">Change</button>' : ''}</div>`
    + `<div class="segs3" role="group" aria-label="Whose issues">${seg('whoMine', 'Mine', who.kind === 'mine' && !who.bad, '#/issues')}`
    + `<button class="seg" type="button" id="whoMate" aria-expanded="${pick}" aria-controls="whoPick"${mate ? ' aria-current="true"' : ''}>A teammate</button>${seg('whoAll', 'Everyone', who.kind === 'all', '#/issues?who=all')}</div>`
    + `<ul class="whopick" id="whoPick" aria-label="Which teammate"${pick ? '' : ' hidden'}>${mates.map(a =>
      `<li><a class="pk${mate && who.person.id === a.id ? ' on' : ''}" id="who-${esc(String(a.initials).replace(/[^A-Za-z0-9]/g, ''))}" href="#/issues?who=${enc(a.initials)}"${mate && who.person.id === a.id ? ' aria-current="true"' : ''}>${esc(a.full_name)}</a></li>`).join('')}</ul>`
    + `${boxHTML({ who: who.code, q: q0 })}</header>`;
  const t = tally(rows), hrefFor = k => topic ? topicHref({ ...who, show: k }, topic.key) : issuesHref({ ...who, show: k });
  const li = r => (hid, fx) => row(r, who, openKey.issue, r.second ? secHTML(r.second) : '', hid, fx);
  const labelOf = k => k === 'cleared' && nx && nx.next ? `Cleared ${dayName(nx.next.row.date)}’s deadline` : STATES.find(s => s[0] === k)[1];
  const lead = () => topic ? `<p class="trail" id="trail"><a class="sl" id="trailIssues" href="${issuesHref(who)}">Issues</a>${ic('chevron-right')}<span>${esc(topic.name)}</span></p>` : sessionRow(who, ses, openKey.session);
  // The list while words are typed: the same groups and rows, only the issues of THIS view that match (a topic's list: that topic), nothing folded; the summary becomes "3 of 26 issues match".
  // Drawn again in place on each key (find.js), never by render(). `ids`: the view's issues (the "Also found" issues are the others).
  const narrowed = q => {
    const hits = issueHits(rows.map(r => r.issue), q), have = new Set(hits.map(i => String(i.id))), mine = rows.filter(r => have.has(String(r.issue.id))), mk = s => mark(s, q);
    const sum = `<p class="summ" id="summ">${mine.length} of ${n(rows.length, 'issue', 'issues')} match “${esc(eCig(q))}”<span id="summAlso"></span> <button class="sl sbtn" type="button" id="findClear">Clear</button></p>`;
    const grps = STATES.map(([k]) => { const g = inGroup(mine, k); return g.length ? groupHTML(k, labelOf(k), g.length, g.map(r => (hid, fx) => row(r, who, openKey.issue, r.second ? secHTML(r.second) : '', hid, fx, mk)), vkey, { all: true }) : ''; }).join('');
    return { html: (topic ? lead() : '') + sum + (mine.length ? grps : `<p class="calmnote" id="findNone">No issue in this list matches “${esc(eCig(q))}”.</p>`), ids: new Set(rows.map(r => String(r.issue.id))) };
  };
  const plain = () => {
    let o = lead();
    if (!rows.length) return o + `<p class="calmnote">${topic ? 'No issues in this topic.' : who.kind === 'mine' ? 'You are not on an issue yet. Pick Everyone to look around.' : who.kind === 'all' ? 'No issue has a bill this session.' : `${esc(first(who.person))} is not on an issue yet.`}</p>`;
    o += summaryHTML(t, rows.length, who, hrefFor);
    const showChanged = !topic && !who.show && changes.length > 0, heldIds = new Set(showChanged ? changes.map(r => String(r.issue.id)) : []);
    const grp = (k, opts) => { const g = inGroup(rows, k), vis = g.filter(r => !heldIds.has(String(r.issue.id))); return g.length ? groupHTML(k, labelOf(k), g.length, vis.map(r => li(r)), vkey, { ...opts, held: g.length - vis.length }) : ''; };
    if (who.show) { const g = grp(who.show, { all: true }); return o + (g || '<p class="calmnote">No issues here.</p>'); }
    if (showChanged) o += groupHTML('changed', x.fallback ? 'Changed in the last 3 days' : 'Changed since you last looked', changes.length, changes.map(r => (hid, fx) => row(r, who, openKey.issue, newHTML(r.change.text), hid, fx)), vkey, { limit: who.kind === 'mine' ? 5 : 3 });
    if (topics) {   // Everyone's and a teammate's list: At risk in full, then a row for each topic
      o += grp('risk', { all: true });
      o += `<section aria-labelledby="topics-h"><h3 class="glab" id="topics-h">Topics</h3><ul class="srows3" id="topics">${topics.map(tp => topicRow(tp, who)).join('')}</ul></section>`;
    } else for (const [k] of STATES) o += grp(k, k === 'stopped' ? { shut: true } : {});
    return o;
  };
  ui.redraw = q => q ? narrowed(q) : { html: plain(), ids: new Set() };
  return h + `<div id="ilist">${q0 ? narrowed(q0).html : plain()}</div><div id="ialso" class="also"></div>`;
}
function topicRow(tp, who) {
  const t = tally(tp.rows), sep = '<span class="sep">·</span>';
  const parts = [`<span>${esc(n(tp.rows.length, 'issue', 'issues'))}</span>`, t.risk ? `<span class="tr risk">${ic('triangle-alert')}<span>${t.risk} at risk</span></span>` : '', t.hearing ? `<span>${t.hearing} with a hearing</span>` : ''].filter(Boolean);
  return `<li><a class="sr3 ir tp" id="topic-${esc(tp.key)}" href="${topicHref(who, tp.key)}"><span class="imark" style="--ic:var(--cat-${esc(tp.key)}, var(--cat-other))" aria-hidden="true">${ic(tp.icon)}</span>`
    + `<span class="sv"><b>${esc(tp.name)}</b><span class="ir2 one">${parts.join(sep)}</span></span><span class="go" aria-hidden="true">${ic('chevron-right')}</span></a></li>`;
}
// The picker and the folds open and close in place: nothing is drawn again, so focus and scroll stay. A choice is a link, so Back works. Choosing where you already are draws nothing, so each
// of these closes the picker itself.
export function bindFolds() {
  document.querySelectorAll('button[data-ifold]').forEach(f => f.addEventListener('click', () => {
    const on = f.getAttribute('aria-expanded') !== 'true', list = document.getElementById(f.getAttribute('aria-controls'));
    ui.folds[f.dataset.ifold] = on; f.setAttribute('aria-expanded', String(on)); f.textContent = on ? f.dataset.hide : f.dataset.show;
    if (list) { if (f.dataset.shut === '1') list.hidden = !on; else list.querySelectorAll('li.fx').forEach(l => { l.hidden = !on; }); }
  }));
}
export function bindIssues() {
  const mo = document.getElementById('sMore');
  if (mo) mo.addEventListener('click', () => { ui.more = mo.dataset.k; mo.closest('p').remove(); document.querySelectorAll('#sMoved li.mx').forEach(l => { l.hidden = false; }); });
  bindFolds();
  const b = document.getElementById('whoMate'), l = document.getElementById('whoPick'); if (!b || !l) return;
  const set = on => { ui.pick = on; l.hidden = !on; b.setAttribute('aria-expanded', String(on)); };
  b.addEventListener('click', () => set(l.hidden));
  l.addEventListener('click', e => { if (e.target.closest('a')) set(false); });
  document.getElementById('whoMine')?.addEventListener('click', () => set(false));
  document.getElementById('whoAll')?.addEventListener('click', () => set(false));
  document.getElementById('whoChange')?.addEventListener('click', () => { set(true); l.querySelector('a')?.focus(); });
}

// ---------------------------------------------------------------------------------- small parts
const hband = (i, title, sub, crumb, grey) => `<div class="hband" style="${grey ? '--ic:var(--edge)' : tint(i)}"><span class="imark big" aria-hidden="true">${ic(iconOf(i))}</span><div class="ht">${crumb || ''}<h1 tabindex="-1">${esc(title)}</h1>${sub ? `<p class="bsub">${sub}</p>` : ''}</div></div>`;
const notFound = (what, back) => `<div class="pn" data-notfound="1">${plainBand(`We could not find ${what}.`, 'It may have been renamed, or it is not on the practice copy.')}<div class="pbody"><p class="lead"><a class="btn text" href="${back}">Back to Issues</a></p></div></div>`;
const kv = rows => `<dl class="kv">${rows.filter(Boolean).map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${v}</dd></div>`).join('')}</dl>`;
// Said on an issue (or a bill) that is not the viewer's, and nowhere else
export const lookLine = who => who.kind === 'all' ? 'Everyone’s issues. Look only.' : who.kind === 'person' ? `${first(who.person)}’s issues. Look only.` : 'Look only.';

// HIPHI's position and who leads a bill: "Support w/ amendments · Kris leads", "No position yet · You lead"
function leadWords(b, issue, me) {
  const ids = leadIds(b, issue);
  if (!ids.length) return 'No lead yet';
  const names = ids.map(id => me && id === me.id ? 'You' : first(advocate(id)));
  const j = names.length < 3 ? names.join(' and ') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
  return names.length === 1 ? (names[0] === 'You' ? 'You lead' : `${names[0]} leads`) : `${j} lead`;
}
export const posLine = (b, issue, me) => `${posWords(b)} · ${leadWords(b, issue, me)}`;
// the step of the person's own that holds this bill, if any (a group ask holds several)
export const stepOn = (open, b) => (open || []).find(s => (s.members ? s.members.some(x => x.bill.id === b.id) : s.bill?.id === b.id)) || null;
// where an alive bill is, a few words: "in House Water & Land", "waiting for the floor vote"
export function whereShort(b) {
  if (!isAlive(b)) return 'did not advance';
  const st = stopOf(b);
  if (st.phase === 'committee') return st.committee ? `in ${cmteWords(String(st.committee).split('/')[0])}` : 'waiting for its committees';
  if (st.phase === 'floor') return 'waiting for the floor vote';
  if (st.phase === 'conference') return 'in conference';
  if (st.phase === 'governor') return 'with the Governor';
  if (st.phase === 'law') return 'signed into law';
  if (st.phase === 'ballot') return 'going to the voters';
  return whereWords(b, { deadline: false });
}
export const sameName = (b, issue) => !!issue && billName(b).trim().toLowerCase() === eCig(issue.name).trim().toLowerCase();

// ---------------------------------------------------------------------------------- an issue's sheet
const num = b => String(b.bill_number).replace(/\s/g, '');
const ordered = bills => bills.slice().sort((x, y) => (billStanding(x) === 'risk' ? 0 : 1) - (billStanding(y) === 'risk' ? 0 : 1) || num(x).localeCompare(num(y), 'en', { numeric: true }));
// `quiet`: the issue's banner already says where this bill stands (an issue with one bill, at risk), so the row does not say it again
function billRow(b, issue, who, me, open, shown, own, quiet) {
  const alive = isAlive(b), risk = isAtRisk(b), dl = deadlineOf(b), st = own ? stepOn(open, b) : null, same = sameName(b, issue);
  const status = !alive || quiet ? '' : risk ? `<p class="bst riskt">${ic('triangle-alert')}<span>At risk · no hearing yet</span></p>`
    : dl ? `<p class="bst">${esc(`Needs a hearing by ${whenWords(dl.date)}`)}</p>` : same ? '' : `<p class="bst">${esc(whereWords(b, { deadline: false }))}</p>`;
  const move = st && !shown.has(st.id) ? `<a class="btn quiet ymove" href="#/do/${enc(st.id)}">Your move · ${esc(st.verb)}</a>` : '';
  const title = same ? esc(`${billNo(b)} · ${whereShort(b)}`) : `${esc(billName(b))}<span class="bno">${esc(billNo(b))}</span>`;   // a bill named like its issue is named by its number and where it is
  return `<li class="brow${alive ? '' : ' dead'}" style="${tint(issue)}"><div class="bmain"><a class="bn2" href="${billHref(who, b, issue.id)}">${title}</a>`
    + `<p class="bmeta">${esc(posLine(b, issue, me))}</p>${status}${move}</div><div class="bpath">${billPath(b)}</div></li>`;
}
function issueSheet(x, who, me, open, own) {
  const i = x.issue, bills = ordered(x.bills), alive = bills.filter(isAlive), dead = bills.filter(b => !isAlive(b)), risky = alive.filter(isAtRisk), lo = !own;
  const sub = !x.bills.length ? 'No bill on it this session.' : !alive.length ? 'Stopped for this year' : alive.length === bills.length ? esc(n(bills.length, 'bill', 'bills')) : esc(`${alive.length} of ${bills.length} bills still alive`);
  const crumb = lo ? `<span class="crumb">${esc(lookLine(who))}</span>` : '';
  let h = `<div class="pn">${hband(i, eCig(i.name), sub, crumb, !alive.length)}<div class="pbody">`;
  const shown = new Set(), banner = new Set();
  for (const b of risky) {
    const dl = deadlineOf(b), st = own ? stepOn(open, b) : null, ask = st && st.kind === 'ask' && !shown.has(st.id) ? st : null;
    if (ask) shown.add(ask.id);
    banner.add(b.id);
    h += `<div class="strip risk">${ic('triangle-alert')}<div class="stx"><strong>${bills.length > 1 ? `${esc(billName(b))} needs` : 'Needs'} a hearing by ${esc(whenWords(dl.date))}</strong>`
      + `<span class="hl">${alive.length === 1 && bills.length > 1 ? 'It is the last bill alive for this issue. ' : ''}Without a hearing it stops for the year.</span></div>${ask ? `<a class="btn filled stbtn" href="#/do/${enc(ask.id)}">${esc(ask.verb)}</a>` : ''}</div>`;
  }
  const row1 = b => billRow(b, i, who, me, open, shown, own, bills.length === 1 && banner.has(b.id));
  if (alive.length) h += `<ul class="brows">${alive.map(row1).join('')}</ul>`;
  if (dead.length) h += `<h2 class="dh">Did not advance</h2><ul class="brows">${dead.map(row1).join('')}</ul>`;
  return h + `</div></div>`;
}

// ---------------------------------------------------------------------------------- the Capitol's words, kept short (the bill page itself is bill.js)
export const clean = t => String(t).replace(/\b[A-Z]{2,4}(?:\/[A-Z]{2,4})*\b/g, m => /^(HB|SB|HR|SR|HCR|SCR|PM|AM)$/.test(m) ? m : cmteWords(m));   // the Capitol's codes in words
// The bill's last action in plain words, without the date
function lastWords(b) {
  const t = String(b.last_action || '').trim();
  if (isCarry(b) && /^Carried over to/i.test(t)) return `Still alive from ${introYear(b)}`;
  return t ? clean(plainAction(t)[0]) : 'Introduced';
}
// ---------------------------------------------------------------------------------- the session's sheet: the answer first (what is at risk, what is coming), then the dates and the next deadline
const HST_TZ = { timeZone: 'Pacific/Honolulu' };
const ymdOf = t => new Date(t).toLocaleDateString('en-CA', HST_TZ);
// a time that never wraps inside ("Mon 9:30 AM")
const tm = t => hearTxt(t).replace(/[  ]/g, ' ');
const clockOf = t => new Date(t).toLocaleTimeString('en-US', { ...HST_TZ, hour: 'numeric', minute: '2-digit' }).replace(/[  ]/g, ' ');
const SHOW_MOVED = 5;
// "Referred to JDC, WAM, FIN" in words: "Sent to 3 Senate committees" (the full list stays on the bill page)
function movedWords(b) {
  const t = String(b.last_action || '').trim(), pl = t ? plainAction(t)[0] : '', m = /^Referred to (.+)$/.exec(pl);
  if (!m) return lastWords(b);
  const codes = m[1].split(/\s*[,/]\s*/).filter(Boolean), ch = CHAMBER_NAME[stopOf(b).chamber];
  return codes.length === 1 ? `Sent to ${cmteWords(codes[0])}` : `Sent to ${codes.length} ${ch ? ch + ' ' : ''}committees`;
}
// What the session holds for a set: the hearings of the next 7 days (Honolulu days 0 to 6, one per bill and time, alive bills only), the alive at-risk bills, and what moved in the last 7 days
function weekOf(ses) {
  const byId = new Map(ses.bills.filter(x => isAlive(x.b)).map(x => [x.b.id, x.b])), seen = new Set(), bills = ses.bills.map(x => x.b);
  const hearings = (S.hearings || []).filter(h => h.status === 'scheduled' && byId.has(h.bill_id) && daysTo(ymdOf(h.scheduled_at)) >= 0 && daysTo(ymdOf(h.scheduled_at)) <= 6 && !seen.has(h.bill_id + '|' + h.scheduled_at) && seen.add(h.bill_id + '|' + h.scheduled_at))
    .map(h => ({ h, b: byId.get(h.bill_id) })).sort((x, y) => new Date(x.h.scheduled_at) - new Date(y.h.scheduled_at) || num(x.b).localeCompare(num(y.b), 'en', { numeric: true }));
  const risk = bills.filter(b => isAlive(b) && isAtRisk(b)).sort((x, y) => deadlineOf(x).date.localeCompare(deadlineOf(y).date) || num(x).localeCompare(num(y), 'en', { numeric: true }));
  const moved = bills.filter(b => b.last_action_date && daysTo(b.last_action_date) >= -6 && daysTo(b.last_action_date) <= 0 && isMove(b))
    .sort((x, y) => String(y.last_action_date).localeCompare(String(x.last_action_date)) || num(x).localeCompare(num(y), 'en', { numeric: true }));
  return { hearings, risk, moved, alive: bills.filter(isAlive).length, total: bills.length };
}
function sessionSheet(who, set, me, ses) {
  const nx = ses.next, wk = weekOf(ses), mate = who.kind === 'person' ? who.person : null;
  const whose = who.kind === 'mine' ? 'your bills' : who.kind === 'all' ? 'everyone’s bills' : `${first(who.person)}’s bills`;
  const issueOfBill = b => (set.find(x => x.bills.some(y => y.id === b.id)) || {}).issue;
  // the lead's face: after the row's words, on Everyone; on a teammate's view only when the lead is someone else; none on Mine
  const face = b => {
    if (who.kind === 'mine') return '';
    const i = issueOfBill(b), id = [...(S.assignments?.[b.id] || []).filter(live), ...(live(i?.owner_id) ? [i.owner_id] : [])][0], a = id ? advocate(id) : null;
    return a?.initials && !(mate && a.id === mate.id) ? ` <span class="person sm" role="img" aria-label="Led by ${esc(first(a))}">${esc(a.initials)}</span>` : '';
  };
  // one bill, drawn like the left column's rows: its issue's mark, the name in ink with the number after it, then its lines of words (already escaped)
  const brow = (b, lines, extra = '') => { const i = issueOfBill(b) || {}; return `<li${extra}><a class="sr3 ir bl" href="${billHref(who, b, i.id)}"><span class="imark" style="${tint(i)}" aria-hidden="true">${ic(iconOf(i))}</span><span class="sv"><b>${esc(billName(b))}</b> <span class="no">${esc(billNo(b))}</span>${face(b)}${lines}</span></a></li>`; };
  const line = (t, cls = '', icon = '') => `<span class="ir2${cls ? ' ' + cls : ''}">${icon ? ic(icon) : ''}<span>${t}</span></span>`;
  const byNo = (x, y) => num(x).localeCompare(num(y), 'en', { numeric: true });

  // 1. the answer
  const hn = wk.hearings.length, riskN = wk.risk.length;
  const answer = `${riskN ? `${n(riskN, 'bill', 'bills')} at risk` : 'Nothing at risk'} · ${hn ? n(hn, 'hearing', 'hearings') : 'no hearings'} in the next 7 days`;
  const label = who.kind === 'mine' ? 'The session' : `The session · ${whose}`;
  const top = `<p class="ovdate">${esc(label)}</p><h1 tabindex="-1">${esc(answer)}</h1><p class="ovsub">${wk.total ? esc(`${wk.alive} of ${wk.total} bills still alive`) : 'No bills on these issues yet.'}</p>`;

  // 3. the next deadline and the bills it touches, each once, with their state for it
  let next = '';
  const touched = nx ? nx.touched.slice().sort((p, q) => (isAtRisk(q) - isAtRisk(p)) || byNo(p, q)) : [];
  if (nx) {
    const state = b => isAtRisk(b) ? line('At risk · needs a hearing', 'risk', 'triangle-alert') : hearingAhead(b) ? line(`Hearing ${esc(tm(hearingAhead(b).scheduled_at))}`) : line(esc(whereShort(b)));
    next = `<h2 class="sh" id="sNext">Next deadline: ${esc(nx.row.label)} · ${esc(whenWords(nx.row.date))}</h2><p class="lead tight">${esc(nx.row.says)}</p>`
      + (touched.length ? `<ul class="srows3 brs" id="sTouch">${touched.map(b => brow(b, state(b))).join('')}</ul>` : `<p class="hint">It touches none of ${esc(whose)}.</p>`);
  }
  const inTouch = new Set(touched.map(b => b.id)), also = wk.risk.filter(b => !inTouch.has(b.id));
  if (also.length) next += `<h2 class="sh" id="sAlso">Also at risk</h2><ul class="srows3 brs" id="sRisk">${also.map(b => brow(b, line(`Needs a hearing by ${esc(whenWords(deadlineOf(b).date))}`, 'risk', 'triangle-alert'))).join('')}</ul>`;

  // 4. the hearings, under their days
  let hear = `<h2 class="sh" id="sHearH">Next 7 days</h2>`;
  if (!hn) hear += `<p class="hint" id="sNoHear">No hearings for ${esc(whose)} in the next 7 days.</p>`;
  else {
    const days = []; for (const x of wk.hearings) { const d = ymdOf(x.h.scheduled_at), g = days[days.length - 1]; if (g && g.d === d) g.rows.push(x); else days.push({ d, rows: [x] }); }
    const now = Date.now();
    hear += `<div id="sHear">${days.map(g => `<h3 class="glab">${esc(dateWords(g.d))}</h3><ul class="srows3 brs">${g.rows.map(({ h, b }) => { const due = testimonyDue(h), late = due <= now;
      return brow(b, line(`<b class="when">${esc(clockOf(h.scheduled_at))}</b> · ${esc(cmteWords(h.committee))}`) + (late ? line(`Testimony was due ${esc(tm(due))}`, 'late', 'circle-alert') : line(`Testimony due ${esc(tm(due))}`)), ` data-h="1"`); }).join('')}</ul>`).join('')}</div>`;
  }

  // 5. what moved, five rows and a button for the rest
  let moved = '';
  if (wk.moved.length) {
    const key = who.code || 'mine', open = ui.more === key, rest = wk.moved.length - SHOW_MOVED;
    const row = (b, k) => brow(b, line(`${esc(movedWords(b))} · ${esc(dateWords(b.last_action_date))}`), k >= SHOW_MOVED ? ` class="mx"${open ? '' : ' hidden'}` : '');
    moved = `<h2 class="sh" id="sMovedH">Moved in the last 7 days</h2><ul class="srows3 brs" id="sMoved">${wk.moved.map(row).join('')}</ul>${rest > 0 && !open ? `<p class="more">${btn(`Show ${rest} more`, { kind: 'quiet', id: 'sMore', attrs: `data-k="${esc(key)}"` })}</p>` : ''}`;
  }
  return `<div class="pn"><div class="ov"><div class="ovtop">${top}</div><div class="ovrest">${sessionHTML(null, ses.touch).replace('<h2 class="fl" id="sesh">', '<h2 class="fl vh" id="sesh">')}${next}${hear}${moved}</div></div></div>`;
}

// ---------------------------------------------------------------------------------- a topic's page
// The topic's week, the next deadline against its bills, and who leads it. Letters are said in Calendar's own words (its hearing page's states), mapped from the data layer's own step state.
export const sitKeyOf = h => `${String(h.committee || '').split('/').map(c => c.trim()).filter(Boolean).sort().join('/')}|${new Date(h.scheduled_at).toISOString()}`;   // calendar.js sitKey: one committee and one instant
// One row for each issue and sitting: the hearings of the next 7 days (Honolulu days 0 to 6) of the topic's alive bills, by time
function weekHearings(rows) {
  const by = new Map();
  for (const x of rows) for (const b of x.bills) {
    if (!isAlive(b)) continue;
    for (const h of S.hearings || []) {
      if (h.bill_id !== b.id || h.status !== 'scheduled') continue;
      const d = daysTo(ymdOf(h.scheduled_at)); if (d < 0 || d > 6) continue;
      const k = `${x.issue.id}|${sitKeyOf(h)}`; if (!by.has(k)) by.set(k, { x, h, t: new Date(h.scheduled_at).getTime(), key: sitKeyOf(h), bills: [] });
      const e = by.get(k); if (!e.bills.some(y => y.b.id === b.id)) e.bills.push({ b, h });
    }
  }
  return [...by.values()].sort((p, q) => p.t - q.t || byName(p.x, q.x));
}
function topicSheet(who, tp, rows, nx) {
  const t = tally(rows), whose = who.kind === 'mine' ? 'your issues' : who.kind === 'all' ? 'everyone’s issues' : `${first(who.person)}’s issues`, wk = weekHearings(rows);
  const bills = [...new Map(rows.flatMap(x => x.bills).map(b => [b.id, b])).values()];
  const riskB = bills.filter(b => isAlive(b) && isAtRisk(b)).length, hn = wk.length, answer = `${riskB ? n(riskB, 'bill', 'bills') + ' at risk' : 'Nothing at risk'} · ${hn ? n(hn, 'hearing', 'hearings') : 'no hearings'} in the next 7 days`;
  const alive = rows.filter(x => x.k !== 'stopped').length;
  let h = `<div class="pn"><div class="ov"><div class="ovtop"><p class="ovdate" id="tKick">${esc(tp.name)} · ${esc(whose)}</p><h1 tabindex="-1">${esc(answer)}</h1><p class="ovsub" id="tSub">${esc(`${alive} of ${n(rows.length, 'issue', 'issues')} still alive · ${bills.filter(isAlive).length} of ${n(bills.length, 'bill', 'bills')}`)}</p></div><div class="ovrest">`;
  if (hn) h += `<h2 class="sh" id="tWeekH">Next 7 days</h2><ul class="trows" id="tWeek">${wk.map(e => {
    const i = e.x.issue, sts = e.bills.map(y => letterState(y.h, y.b)), filed = sts.filter(s => s.key === 'filed').length;
    const lw = sts.length === 1 ? testimonyWords(sts[0]) : filed === sts.length ? 'testimonies filed' : `${filed} of ${sts.length} testimonies filed`;
    const sit = `#/calendar/sitting/${enc(e.key)}${who.code ? `?who=${enc(who.code)}` : ''}`;
    return `<li class="twr"><span class="imark" style="${tint(i)}" aria-hidden="true">${ic(iconOf(i))}</span><div class="twt"><a class="lk twi" href="${issueHref(who, i.id)}">${esc(eCig(i.name))}</a><p class="twl"><a class="lk" href="${sit}">${esc(`Hearing ${hearTxt(e.h.scheduled_at)} · ${cmteWords(e.h.committee)}`)}</a> · ${esc(lw)}</p></div></li>`; }).join('')}</ul>`;
  const r = nx && nx.next ? nx.next.row : null;
  if (r) {
    const mine = new Set(bills.map(b => b.id)), racing = (nx.touch.get(r.key) || []).filter(b => mine.has(b.id));
    const risk = racing.filter(isAtRisk).length, heard = racing.filter(b => !isAtRisk(b) && hearingAhead(b)).length, rest = racing.filter(b => !isAtRisk(b) && !hearingAhead(b));
    const wait = rest.filter(b => wantsHearingOf(b)).length, no = rest.length - wait, cl = bills.filter(b => clearedOf(b, r) === 'yes').length, total = racing.length + cl, d = daysTo(r.date);
    const parts = [risk && `${risk} at risk`, heard && `${heard} with a hearing set`, wait && `${wait} waiting for a hearing`, no && `${no} not asking for one`, cl && `${cl} cleared`].filter(Boolean);
    if (total) h += `<h2 class="sh" id="tDlH">${esc(dayName(r.date))}’s deadline</h2><p class="lead tight" id="tDl">${esc(`${r.label} · ${d <= 0 ? 'today' : d === 1 ? 'tomorrow' : `in ${d} days`}. `)}${esc(`${total === 1 ? 'The one bill it affects' : `Of the ${total} bills it affects`}: ${parts.join(', ')}.`)}</p>`;
  }
  const leads = new Map();
  for (const x of rows) if (live(x.issue.owner_id)) { const a = advocate(x.issue.owner_id); if (a?.initials) leads.set(a.id, { a, c: (leads.get(a.id)?.c || 0) + 1 }); }
  const ls = [...leads.values()].sort((p, q) => q.c - p.c || first(p.a).localeCompare(first(q.a), 'en'));
  if (ls.length) h += `<h2 class="sh" id="tLeadH">Who leads</h2><p class="lead tight" id="tLeads">${ls.map(({ a, c }) => `<a class="lk" href="#/issues?who=${enc(a.initials)}">${esc(first(a))}</a> ${esc(n(c, 'issue', 'issues'))}`).join(' · ')}</p>`;
  return h + '</div></div></div>';
}

// ---------------------------------------------------------------------------------- put together
// rt: { r: 'issues' | 'issue' | 'bill', id, q: URLSearchParams }. Returns what the frame draws.
export function issuesModel({ me, open, rt, people }) {
  ui.redraw = null;
  const who0 = whoOf(rt.q.get('who'), me, people), showRaw = rt.q.get('show'), show = STATE_KEYS.includes(showRaw) ? showRaw : '';   // a show value that is none of the groups is ignored
  const base0 = who0.bad ? { kind: 'mine', code: '' } : who0, set = setFor(base0, me), ses = sessionOf(set), nx = ses, all = statesFor(set, nx), own = ownSet(me);
  const topicOK = k => !!k && /^[a-z-]+$/.test(k) && (catKeys().includes(k) || (k === 'other' && all.some(x => catsOf(x.issue).includes('other'))));
  const routeTopic = rt.r === 'issues' && /^topic\//.test(rt.id || '') ? rt.id.slice(6) : '', qTopic = rt.q.get('topic') || '';
  const tkey = routeTopic ? (topicOK(routeTopic) ? routeTopic : '') : rt.r !== 'issues' && topicOK(qTopic) ? qTopic : '';
  const who = { ...who0, show, topic: tkey }, tp = tkey ? { key: tkey, name: tkey === 'other' ? 'Other' : (S.categories || []).find(c => c.key === tkey).name } : null;
  const rows = tp ? all.filter(x => catsOf(x.issue).includes(tkey)) : all;
  const back = issuesHref(who.bad ? { code: '' } : who);
  let sheet, label = 'Issues', picked = true, openKey = { session: false, issue: '' }, bk = back, backLabel = '';
  const showSession = () => { openKey = { session: true, issue: '' }; sheet = sessionSheet(who, set, me, ses); label = 'The session'; };
  const showIssue = x => { openKey = { session: false, issue: String(x.issue.id) }; sheet = issueSheet(x, who, me, open, own.has(String(x.issue.id))); label = 'Issue'; };
  const gone = what => { sheet = notFound(what, back); label = 'Not found'; };
  if (who0.bad) gone('that list of issues');
  else if (rt.r === 'issues') {
    if (rt.id === 'session') showSession();
    else if (routeTopic) { if (tp) { picked = false; sheet = topicSheet(who, tp, rows, nx); label = 'Topic'; } else gone('that topic'); }
    else if (rt.id) gone('that part of Issues');
    else {   // the first row opens: an own at-risk issue when there is one, else the session. The address stays #/issues, and on a phone the list shows first
      picked = false;
      const risk = who.kind === 'mine' ? inGroup(all, 'risk')[0] : null;
      if (risk) showIssue(risk); else showSession();
    }
  } else if (rt.r === 'issue') {
    const i = rt.id ? (S.issues || []).find(x => String(x.id) === rt.id && !x.archived_at) : null;
    if (!i) gone('that issue');
    else { showIssue(all.find(y => String(y.issue.id) === String(i.id)) || { issue: i, bills: billsOfIssue(i), standing: issueStanding(billsOfIssue(i)) }); if (tp) { bk = listHref(who); backLabel = tp.name; } }
  } else {
    const b = rt.id && rt.id.length < 40 ? billByRef(rt.id) : null;
    if (!b || b.tracked === false) gone('that bill');
    else {
      const ids = (S.billIssues || []).filter(x => x.bill_id === b.id).map(x => String(x.issue_id)), want = rt.q.get('i') || '';
      const cand = (S.issues || []).filter(i => !i.archived_at && ids.includes(String(i.id)));
      const issue = cand.find(i => String(i.id) === want) || cand.find(i => set.some(y => String(y.issue.id) === String(i.id))) || cand[0];
      openKey = { session: false, issue: issue ? String(issue.id) : '' }; sheet = billSheet(b, issue || null, who, me, open, issue ? billsOfIssue(issue).filter(o => o.id !== b.id && isAlive(o)) : [], issue ? own.has(String(issue.id)) : isMine(b), { nx, from: rt.q.get('from') || '' }); label = 'Bill'; bk = '';   // its own back link, in the band, says where it goes
    }
  }
  // what changed since the person last looked, and the topics (Everyone's and a teammate's list, not narrowed): only on the list itself
  const flat = !!tp || !!show, look = lookState(me);
  const changes = flat || who0.bad ? [] : [...changesFor(all, open, look.since)].map(([id, change]) => ({ ...all.find(x => String(x.issue.id) === id), change })).sort((p, q) => q.change.at - p.change.at || byName(p, q));
  if (changes.length && rt.r === 'issues' && !rt.id) markDrawn();   // the Changed group is on the screen: from now on leaving Issues (or 10 seconds) says "looked"
  let topics = !who0.bad && who.kind !== 'mine' && !tp && !show ? topicsOf(all) : null;
  if (topics && topics.length < 2) topics = null;   // everything in one topic: the groups, flat, as Mine has them
  return { who, set, col: column(who, set, people, me, openKey, ses, { rows, nx, changes, topic: tp, topics, fallback: look.fallback, q: String(rt.q.get('q') || '').slice(0, 200) }), sheet, picked, label, back: bk, backLabel, bind: rt.r === 'bill' ? () => { bindIssues(); bindBill(); } : bindIssues, notFound: /data-notfound/.test(sheet) };
}
