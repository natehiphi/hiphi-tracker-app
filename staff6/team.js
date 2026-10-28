// Team (#/team), Staff v6 (R-336; V6-SPEC section 6 "Team", V15, D2, D5; F72-F76): what is slipping and who is on what,
// for the leads (admins and second approvers: Nate, Jess, Jaylen). v5 spread this over Mine | Team, an "Everyone" menu,
// the hearings line and folds (assessment X1, X17, X24: Nate's own work and the team's in one list; Team one tap from
// Patti). Now its own place, open blocks in this order:
//   - Slipping: v5's logic (today5.js slipping), one button per row (your own step's button; a teammate's "Alert Kevin",
//     which says truthfully where the message went; Give to… on a row nobody holds), with Undo;
//   - Hearings at risk (D2): a working day or less from the day the notice must post, nobody has asked; no owner first;
//   - today's and tomorrow's hearings as a plain schedule (D5): time, room, "Going: Kris" / "Going: no one yet", no counts,
//     no colour, no to-do rows (R-276);
//   - No owner (R-352, B-14 on v6): a card, the soonest 3 with Give to… (Take it for a non-admin lead), then "All N bills
//     with no owner ›";
//   - Who is on what: one bar per person counting what they hold, each step once (their own steps, their chair asks, the
//     public asks they write); a helper with nothing of their own says whom they help ("helps HEAL"), never 0; read-only,
//     in the column beside the lists from 1360px with the Partners line under it (23 Oct's layout), one column below;
//   - by season: the 2027 issues (admins).
//   Slipping and Hearings at risk are one ranked list (top 3 shown) that leaves out the lead's own steps (their Today's,
//   R-352); the schedule is the one quiet line that opens in place.
// #/team?who=<id> is "See as teammate" for everyone (More tools links it): that person's Today, read-only, never in colour,
// worked out by today.js exactly as their own Today is. #/team?who=none lists the steps nobody holds yet ("Anyone can take
// these steps"). Someone who is not a lead and opens #/team gets the picker, never an error.
import { S, DB, SESSION_OVER, esc, advocate, hooks } from './data.js';
import { work, listHTML, t6Season, t6Groups, t6Fresh, T6REG, noOwnerBills, slipList, shareAsk, partnersLine } from './today.js';
import { billRoute, billById, lateLine, roomName, diedish, wantsHearing, standingIn, liveAsk } from './model.js';
import { icon, btn, toast, pickerSheet, avatar, faceLead } from './ui.js';
import { billStep, billRow, itemRow, rowButton, rowButtonOK, shownStatus, status, leftSoon, nameWords, numWords, sayWords, firstWords, orWords, dayWords, timeWords,
  committeeName, goingWords, askWords, nw, wireSteps, othersWords, NO_OWNER, takeFor } from './steps.js';
import { plainCodes } from './terms.js';
import { dropVerb, actIcon, jobKind } from './verbs.js';   // R-344: one verb per row (A-25); R-352: the kind of job's icon
import { isLead } from './more.js';
import { ownerProgress, BOARD_HREF, dueEnd as prepDue } from './prep.js';
import { pqItems, admitsPartners, wantQueue } from './partnerq.js';

const HR = 36e5, DAY = 864e5, HST = { timeZone: 'Pacific/Honolulu' };
const ms = t => t == null ? null : typeof t === 'number' ? t : new Date(t).getTime();
const hday = t => new Date(t).toLocaleDateString('en-CA', HST);
const live = id => { const a = id && advocate(id); return !!a && a.is_active !== false; };
const first = id => firstWords(id, { id: null });
const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;
const lc = s => s ? s[0].toLowerCase() + s.slice(1) : s;
const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;
const strip = s => String(s || '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&[a-z#0-9]+;/g, ' ').replace(/\s+/g, ' ').trim();
const teammates = () => (S.advocates || []).filter(a => a.is_active !== false);
const ownerOf = b => (S.assignments?.[b?.id] || []).find(live) || null;
const isPos = b => !!b && !!b.position && b.position !== 'monitor' && b.tracked !== false;
const redraw = () => hooks.render();
const prepSeason = () => SESSION_OVER && t6Season() === 'prep';
// Working days from now to a moment (weekends out): "a working day or less from notice" (D2).
function workDaysTo(t) {
  let n = 0; const end = hday(t);
  for (let d = Date.now(); hday(d) < end; d += DAY) { const dow = new Date(hday(d + DAY) + 'T12:00:00-10:00').getUTCDay(); if (dow !== 0 && dow !== 6) n++; }
  return n;
}

// ---- who the tracker can reach, so "Alert" says where the message went (X24: "Alert James" claimed Slack delivery) ----
// Admins can ask (backend 154 team_reach); anyone else reads the linked Slack account on the person's record.
function reachOf(id) {
  if (S.tmReach === undefined && S.me?.is_admin) {
    S.tmReach = null;
    DB.teamReach().then(rows => { S.tmReach = Object.fromEntries((rows || []).map(r => [r.advocate_id, r.reach])); if (S.route?.name === 'team') redraw(); }).catch(() => { S.tmReach = {}; });
  }
  const r = S.tmReach?.[id]; if (r && r !== 'unknown') return r;
  return advocate(id)?.slack_user_id ? 'slack' : 'unknown';
}
function reachWords(ids, b) {
  const slack = ids.filter(id => reachOf(id) === 'slack'), mail = ids.filter(id => reachOf(id) === 'email'), app = ids.filter(id => !slack.includes(id) && !mail.includes(id));
  const parts = [slack.length ? `${orWords(slack, null, { and: true })} ${slack.length > 1 ? 'get' : 'gets'} it in Slack` : '', mail.length ? `${orWords(mail, null, { and: true })} ${mail.length > 1 ? 'get' : 'gets'} it by email` : '',
    app.length ? `${orWords(app, null, { and: true })} ${app.length > 1 ? 'see' : 'sees'} it in the app’s Inbox (Slack has not found ${app.length > 1 ? 'them' : first(app[0])} yet)` : ''].filter(Boolean);
  return `Alert posted in the Team talk on ${numWords(b)}. ${cap(parts.join('; '))}.`;
}
// "Alert Kevin": a one-line message on the bill with @Kevin, with Undo (v5's W42 nudge, R-330), saying where it went. Once
// sent, the row says so in place of the button, "Alerted 9:00 AM · Undo", so nobody alerts twice (A-16).
const ALERTS = new Map();
S.tmAlerted ??= new Map();   // row key -> { at, m }: kept for the visit, across redraws
async function alertThem(el, key) {
  const x = ALERTS.get(key); if (!x) return;
  if (el) { el.setAttribute('aria-busy', 'true'); el.disabled = true; }
  try {
    const m = await DB.sendMessage(x.b.id, `${x.ids.map(id => '@' + first(id)).join(' ')} From Team: ${x.what}. Can you get it in?`);
    S.tmAlerted.set(key, { at: Date.now(), m });
    toast(reachWords(x.ids, x.b), { ok: true, undo: () => unalert(key) });
    redraw();
  } catch (e) { toast(e, { err: true }); if (el?.isConnected) { el.removeAttribute('aria-busy'); el.disabled = false; } }
}
async function unalert(key) {
  const a = S.tmAlerted.get(key); if (!a) return;
  try { await DB.deleteMessage(a.m); S.tmAlerted.delete(key); redraw(); toast('Alert taken back.'); } catch (e) { toast(e, { err: true }); }
}
// The button names whom the alert reaches ("Alert Lauren and Patti"), never "Alert them" (the critic's 7).
const alertBtn = (key, ids) => { const a = S.tmAlerted.get(key);
  if (a) return `<span class="tm6-alerted">${icon('check')}<span>Alerted ${esc(timeWords(a.at))}</span></span>${btn('Undo', { kind: 'text', sm: true, attrs: { 'data-tmundo': key, 'aria-label': `Undo the alert to ${orWords(ids, null, { and: true })}` } })}`;
  return btn(`Alert ${orWords(ids, null, { and: true })}`, { kind: 'secondary', sm: true, icon: 'bell', attrs: { 'data-tmalert': key } }); };
const giveBtn = b => btn('Give to…', { kind: 'secondary', sm: true, icon: 'user-round', attrs: { 'data-v6act': 'giveto', 'data-v6b': b.id, 'aria-haspopup': 'dialog' } });
// On a list of bills with no owner, each row's "no one holds it" is said once, by the list's own title (one word, "no
// owner", for one fact: the critic's 9; steps.js's row words are asked to change as a shared change).
const unheld = s => cap(String(s?.line || '').replace(new RegExp(`^${NO_OWNER} · `, 'i'), '').replace(/ · no one holds it/i, '').replace(/^no one holds it · /i, ''));
const takeBtn = b => btn('Take it', { kind: 'secondary', sm: true, icon: 'user-round', attrs: { 'data-v6act': 'take', 'data-v6b': b.id } });
// A bill nobody holds has the same button on every Team list for the same person (B-14): an admin hands it (Give to…),
// anyone else takes it (an issue's owner, a lead covering it).
const noOwnBtn = b => S.me?.is_admin ? giveBtn(b) : takeBtn(b);

// ---- Slipping (v5's logic): one row per step, said in v6's words ----
// A teammate's step says the team's time, "by …" (steps.js actBy's hand-on time, the one Today, Testimony and Hearings give;
// the Capitol's own time is in the open item). Late, overdue and due today say steps.js status()'s one wording for that
// state (R-352 wave 2: "Late, still accepted until 1:10 PM today", "2 days overdue", "Due today 10:00 AM, in 59 min").
const actTime = a => !a || a.kind === 'none' ? '' : a.kind === 'hand' ? `by ${a.time}${leftSoon(a.at)}` : a.kind === 'late' ? lateLine(a.until, { lower: true })
  : a.kind === 'overdue' ? lc(status({ due: a.due }).words) : lc(status({ due: a.at }).words);
// R-352 (A-18 on v6): Team's list mixes kinds of job, so each row's line carries one small neutral icon for its kind (the
// job's own icon, verbs.js), except where its time is the news: overdue (the alert), late (the alarm clock) and due today
// (the clock), by A-5 on v6. The face before the name says whose it is.
const kindIcon = k => { const j = jobKind(k); return j === 'none' ? 'list-checks' : actIcon(j); };
// The step's name, for a bill's second row in the list (HB 1523's to-do and its approval read as one row twice).
const STEP_NAME = { approve: 'Approve testimony', second: 'Second look', file: 'File testimony', revise: 'Revise testimony', submit: 'Send testimony for approval',
  write: 'Send testimony for approval', nodraft: 'Make the draft', stale: 'Check the testimony' };
// Someone's step in one phrase (steps.js othersWords, spec 5): "Lauren or Patti revises it", "Second look from Jaylen or
// Jess", "No owner yet"; the viewer's own step is its own words ("File · late, still accepted until 1:10 PM today"), a
// second approver standing in says for whom (F44).
function stepWords(s) {
  if (s.you) {
    if (s.kind === 'approve' && s.d?.status === 'review' && standingIn(S.me, s.h)) {
      const main = (s.whose?.ids || []).filter(id => id !== S.me?.id && (S.advocates || []).some(a => a.id === id && (a.is_admin || a.can_approve)));
      return `Standing in${main.length ? ` for ${orWords(main, null)}` : ''} · ${lc(s.act?.words || '')}`;
    }
    return s.line;
  }
  return [othersWords(s), actTime(s.act)].filter(Boolean).join(' · ');
}
function slipping() {
  let sl; try { sl = slipList(); } catch (e) { console.error(e); return []; }
  const me = S.me?.id, now = Date.now();
  const out = sl.rows.filter(r => r.b && (r.p || r.nob)).map(r => {
    // Testimony nobody holds (today.js slipList): the row's own words, "No owner yet · due tomorrow 1:00 PM", the time
    // Testimony and Bills give the same bill (the fresh-eyes check: Team's "file by tomorrow 11:00 AM" beside their 1:00 PM
    // read as two deadlines; the filer's earlier time is in the open item). Sorted still by the time to act.
    if (r.nob) { const s = r.nob;
      return { key: r.key, b: r.b, p: null, s, ids: [], mine: false, line: s.line || [NO_OWNER, lc(s.act.words)].join(' · '), kic: kindIcon(s.kind), today: s.status?.tone === 'today', over: s.act.kind === 'overdue', lateOk: s.act.kind === 'late', at: s.act.at }; }
    // A share to-do is the rallier's public ask, by OUTREACH's time, only where the rallier has that row (today.js shareAsk;
    // spec 11.6): said and alerted as theirs. Anywhere else it is its owner's own to-do, in its own words and time.
    const sh = shareAsk(r.p), p = sh ? { ...r.p, due: sh.due ?? r.p.due } : r.p, b = r.b, ids = sh?.rl.length ? sh.rl : r.ids || [];
    const s = (p.d || p.h) && ['file', 'review', 'review2', 'revise', 'submit', 'write', 'nodraft', 'stale'].includes(p.kind) ? billStep(b, { viewer: S.me, d: p.d || null, h: p.h || null }) : null;
    const mine = ids.includes(me), solo = ids.length === 1;
    const who = !ids.length ? NO_OWNER : mine && solo ? 'You' : cap(orWords(ids, S.me));
    if (s && s.state && s.act) {
      const over = s.act.kind === 'overdue', lateOk = s.act.kind === 'late';
      const line = stepWords(s);
      return { key: 'sl:' + (p.key || b.id), b, p, s, ids, mine, line, kic: kindIcon(s.kind), today: s.status?.tone === 'today', what: STEP_NAME[s.kind] ? lc(STEP_NAME[s.kind]) + ` on ${numWords(b)}` : strip(p.s), over, lateOk, at: s.act.at ?? p.due };
    }
    // Anything else keeps v5's own words, codes made plain: its time first, so a two-line row never cuts it (the critic's 6).
    // Overdue says so first, in words, with its date (addendum 4).
    const over = p.due != null && p.due <= now;
    // R-344 rule 4 (A-25): the row's face says whose it is and its Alert button names them, so a teammate's name is not said
    // a third time before the task ("James: Ask the chair's office…" is now James's face, the task, "Alert James"). Your
    // own and an unheld one keep their word ("You:", "No owner yet:"), which the face alone cannot say to a screen reader.
    const task = sh ? `write the public ask${sh.h ? ` for the ${dayWords(sh.h.scheduled_at)} hearing` : ''}` : strip(plainCodes(esc(strip(p.s))));
    const named = ids.length && !(mine && solo) && ids.some(id => id !== me);
    const what = named ? cap(task) : `${who}: ${task}`;
    const st = p.due != null ? status({ due: p.due }) : null;
    const line = [st ? st.words : '', what].filter(Boolean).join(' · ');
    return { key: 'sl:' + (p.key || b.id), b, p, s: null, ids, mine, line, kic: sh ? actIcon('ask') : kindIcon(p.kind), today: st?.tone === 'today', what: sh ? `write the public ask for ${numWords(b)}` : strip(p.s), over, lateOk: false, at: p.due ?? Infinity };
  });
  // Overdue first, then late testimony the Capitol still takes, then by the time to act (v5's "Late testimony, still open"
  // led its Slipping; Nate's walk: at noon two late filings sat below steps due at 2 and 3 PM).
  const rank = x => x.over ? 0 : x.lateOk ? 1 : 2;
  out.sort((x, y) => rank(x) - rank(y) || (x.at ?? Infinity) - (y.at ?? Infinity));
  // A bill's second row starts with its step's name, so a to-do and an approval on HB 1523 never read as one row twice.
  const seen = new Set();
  for (const x of out) {
    if (seen.has(x.b.id)) x.line = x.s?.state ? [STEP_NAME[x.s.kind] || x.s.state.word, x.s.you ? actTime(x.s.act) : x.line].filter(Boolean).join(' · ') : `To-do · ${x.line}`;
    seen.add(x.b.id);
  }
  return out;
}
function slipRow(x) {
  const others = x.ids.filter(id => id !== S.me?.id);
  let button = '';
  if (x.mine && x.s && rowButtonOK(x.s)) button = rowButton(x.s);
  else if (!x.ids.length) button = noOwnBtn(x.b);
  else if (others.length) { ALERTS.set(x.key, { b: x.b, ids: others, what: x.what }); button = alertBtn(x.key, others); }
  // Someone else's late step is said in words with its clock, never in colour (D3): "late, still accepted until". The
  // viewer's own late step (or one on their own bill) keeps its amber, by steps.js's one rule (shownStatus), as on Today,
  // Bills and Hearings (the critic: HB 1562's "late, still accepted" was amber there and grey here, A-5). The overdue step
  // is red with its word and date, which is what a lead opens Team to find (addendum 4).
  const late = !x.over && x.lateOk && shownStatus(x.s)?.tone === 'late';
  // R-344 rule 4: the face of whoever holds the step leads the row (a dashed circle when nobody does), so "whose" reads
  // before a word does; the line keeps its words.
  // R-344 (A-25): beside the step's own button ("File") the line drops the verb, "Late, still accepted until…", as Testimony
  // and Today say it; late wears the alarm clock, its own picture (verbs.js), and anything else the clock.
  const line = button && x.mine && x.s?.act?.verb ? dropVerb(x.line, x.s.act.verb) : x.line;
  return itemRow({ key: x.key, name: nameWords(x.b), num: numWords(x.b), line: nw(esc(line)), icon: x.over ? 'circle-alert' : x.lateOk ? 'alarm-clock' : x.today ? 'clock' : x.kic || 'clock', tone: x.over ? 'overdue' : late ? 'late' : '', href: billRoute(x.b), button, cls: wideCls(button) + ' v6-face-row', lead: faceLead(x.ids) });
}
// A long button ("Alert Lauren and Patti", "Alerted 9:00 AM · Undo") goes under the row's line below 1440px (css .tm6-wide),
// so the name and its time never break onto lines of their own; a short one stays beside the words. Below 600px every
// row's button goes under its words (steps.css, A-8).
const wideCls = html => strip(html).length > 14 ? 'tm6-r tm6-wide' : 'tm6-r';
// Between sessions the team's one deadline is the 2027 issues: due within a day, it is said in Slipping in soft words, no
// red (a prep date is "Still to finish", spec 6 My issues; Nate's walk: on 5 Nov "Nothing is slipping" with 91 of 91 to
// finish the next day).
function prepSlip() {
  if (!prepSeason()) return '';
  const pr = ownerProgress(), left = pr.reduce((n, o) => n + o.total - o.done, 0); if (!left) return '';
  const due = prepDue(), past = due < Date.now(); if (!past && hday(due) > hday(Date.now() + DAY)) return '';
  return `<nav class="t6-doors tm6-prepslip" aria-label="Issues for 2027">${door(BOARD_HREF, 'clipboard-list', `<b>${esc(plural(left, 'issue'))} for 2027 still to finish</b>${past ? '' : ` · due ${esc(dayWords(due))}`}`)}</nav>`;
}

// ---- Hearings at risk (D2): a working day or less from the notice, nobody has asked; no owner first ----
function atRisk() {
  const out = [], now = Date.now();
  for (const b of S.bills || []) {
    if (!isPos(b) || !wantsHearing(b) || diedish(b)) continue;
    const a = askWords(b, { viewer: S.me }); if (!a || a.key !== 'ask' || a.by == null || a.by < now || workDaysTo(a.by) > 1) continue;
    out.push({ b, a, owner: ownerOf(b) });
  }
  return out.sort((x, y) => !!x.owner - !!y.owner || x.a.by - y.a.by);
}
// "Hearing at risk: ask Rep. Hashem and Rep. Belatti by Tue 3/17 · James owns it": its kind first, as the ranked list's
// other rows say theirs, in two parts (a row is a name and one short line, at most 4 facts; the critic: "James's · ask…"
// read as a fragment).
function riskRow(x) {
  const key = 'ar:' + x.b.id, chair = x.a.m ? x.a.m.who : 'the chair';
  let button;
  if (!x.owner) button = noOwnBtn(x.b);
  else if (x.owner === S.me?.id) button = rowButton(billStep(x.b, { viewer: S.me, d: null, h: null }));
  else { ALERTS.set(key, { b: x.b, ids: [x.owner], what: `the hearing notice must post by ${dayWords(x.a.by)} and nobody has asked ${chair} yet` }); button = alertBtn(key, [x.owner]); }
  // R-344 (A-25): the owner's face leads the row and "Alert James" names them, so "· James owns it" goes; yours and an
  // unowned one keep their words.
  const whose = !x.owner ? NO_OWNER : x.owner === S.me?.id ? 'You own it' : '';
  return itemRow({ key, name: nameWords(x.b), num: numWords(x.b), line: nw(esc(`Hearing at risk: ask ${chair} by ${dayWords(x.a.by)}${whose ? ` · ${whose}` : ''}`)), icon: actIcon('chair'), href: billRoute(x.b), button, cls: wideCls(button) + ' v6-face-row', lead: faceLead(x.owner ? [x.owner] : []) });
}

// ---- today's and tomorrow's hearings (D5): a plain schedule ----
function schedule() {
  const now = Date.now(), days = [hday(now), hday(now + DAY)], seen = new Map();
  for (const h of S.hearings || []) {
    if (h.status === 'cancelled' || !days.includes(hday(ms(h.scheduled_at))) || ms(h.scheduled_at) < now - 2 * HR) continue;
    if (!isPos(billById(h.bill_id))) continue;
    const k = `${h.committee}|${h.scheduled_at}`; if (!seen.has(k)) seen.set(k, h);
  }
  const list = [...seen.values()].sort((x, y) => ms(x.scheduled_at) - ms(y.scheduled_at));
  return days.map((d, i) => ({ label: i ? 'Tomorrow' : 'Today', rows: list.filter(h => hday(ms(h.scheduled_at)) === d) }));
}
// The time, room and who is going always on the second line, so the schedule reads down one edge (the critic: the time sat
// beside some committee names and under others, as each name's length wrapped it).
const sitRow = h => itemRow({ key: 'h:' + h.id, name: committeeName(h.committee) || h.committee, num: '',
  line: nw(esc([timeWords(h.scheduled_at), h.room ? roomName(h.room) : '', goingWords(h, { viewer: S.me })].filter(Boolean).join(' · '))), href: `#/hearing/${encodeURIComponent(h.id)}?from=team` });

// ---- bills with no owner (who=none, the No owner bar, the block, Today's line: one count, one word) ----
// today.js noOwnerBills: a position, alive, nobody owns it. Each with its current step, soonest first (by billStep's due),
// the same order in the block's preview and the full list (Nate's walk: the preview's three were the priority order, and
// HB 2300's filing due tomorrow came only after "All 10").
function nobodySteps() {
  return noOwnerBills().map(b => ({ b, s: billStep(b, { viewer: S.me }) })).filter(x => x.s)
    .sort((x, y) => (x.s.due ?? Infinity) - (y.s.due ?? Infinity) || String(x.b.bill_number).localeCompare(String(y.b.bill_number), 'en', { numeric: true }));
}
// Each says its step and the one time every screen gives it ("File testimony · due tomorrow 1:00 PM", the deadline Slipping,
// Testimony and Bills say for a step nobody holds; the filer's earlier time is in the open item); the list's title says no
// one holds it.
const NOBODY_STEP = { nodraft: 'Make the draft', write: 'Send testimony for approval', submit: 'Send testimony for approval', revise: 'Resubmit testimony',
  approve: 'Approve testimony', second: 'Second look', file: 'File testimony' };
const nobodyLine = s => { const u = unheld(s);
  if (!s?.state || !NOBODY_STEP[s.kind] || ['missed', 'filed'].includes(s.state.key) || s.off) return u;
  return `${NOBODY_STEP[s.kind]} · ${s.kind === 'nodraft' && /^due /i.test(u) ? 'testimony ' : ''}${lc(u)}`; };
const nobodyRow = (x, { button = noOwnBtn(x.b) } = {}) => billRow(x.b, { viewer: S.me, step: { ...x.s, mine: false }, line: nw(esc(nobodyLine(x.s))), button, cls: 'tm6-r' });

// ---- Who is on what: everything each person holds, each step counted once ----
// The people with nothing open are one line, "Everyone else: nothing open" (spec 0: less on every screen; between sessions
// 12 rows read 0).
// Each step counts once, on the person who holds it (A-14, B-7; the fresh-eyes check: Patti, who owns nothing, read 16 from
// Lauren's 15 unasked chair asks, while Lauren, with 17 chair asks of her own, read 1): their own steps (what they write,
// approve or were given), their chair asks past Today's three rows (D1's line), and the public asks they still have to
// write this week. A coalition helper with nothing of their own is never an empty 0: the row says whom they help, in
// words ("helps HEAL"), not as a number (V15).
const campName = id => (S.campaigns || []).find(c => c.id === id)?.name || '';
function helpsWords(a) {
  const c = a?.prefs?.coalitions;
  if (c === 'all') return 'helps every coalition';
  const names = (Array.isArray(c) ? c : []).map(campName).filter(Boolean);
  return names.length ? `helps ${names.length > 2 ? `${names.slice(0, 2).join(', ')} and ${names.length - 2} more` : names.join(' and ')}` : '';
}
function loads() {
  return teammates().map(a => { const w = work(a), onToday = new Set(w.own.filter(i => i.kind === 'rally' || (i.kind === 'todo' && i.share)).map(i => i.b?.id));
    const rally = new Set(w.rally.filter(x => !liveAsk(x.b) && !onToday.has(x.b.id)).map(x => x.b.id)).size;
    const n = w.own.length + w.asks.length + rally;
    return { a, n, helps: n ? '' : helpsWords(a) }; }).sort((x, y) => y.n - x.n || !!y.helps - !!x.helps || x.a.full_name.localeCompare(y.a.full_name));
}
// R-352 (Nate's 23 Oct layout): read-only, faces and how many each carries, in the column beside the lists from 1360px. Each
// bar was a link to that person's list: 11 controls past A-2's 12 on v6, so a teammate's list is opened from More tools'
// "See a teammate's list" (and that page's "See someone else").
function loadHTML(rows = loads()) {
  // (no No owner bar: Team's own No owner card says it and opens it; A-14)
  const busy = rows.filter(r => r.n > 0 || r.helps), idle = rows.length - busy.length, max = Math.max(1, ...rows.map(r => r.n));
  const bar = (av, name, n, helps = '') => helps
    ? `<li class="tm6-load tm6-helps">${av}<span class="tm6-ln">${esc(name)}</span><span class="tm6-hw">${esc(helps)}</span></li>`
    : `<li class="tm6-load"><span class="sr">${esc(`${name}: ${plural(n, 'step')}`)}</span>${av}<span class="tm6-ln" aria-hidden="true">${esc(name)}</span><span class="tm6-bar" aria-hidden="true"><i style="width:${Math.round(n / max * 100)}%"></i></span><span class="tm6-n" aria-hidden="true">${n}</span></li>`;
  return `<ul class="tm6-loads" role="list">${busy.map(({ a, n, helps }) => bar(avatar(a, 28, { deco: true }), a.id === S.me?.id ? 'You' : a.full_name, n, helps)).join('')}
    ${idle ? `<li class="tm6-idle">${icon('circle-check')}<span>${busy.length ? 'Everyone else' : 'Everyone'}: nothing open</span></li>` : ''}</ul>`;
}

// ---- the seasonal blocks ----
const block = (id, title, body, { count = '' } = {}) => `<section class="tm6-block" data-block="${esc(id)}" aria-labelledby="tm6-${esc(id)}"><h2 class="tm6-h" id="tm6-${esc(id)}">${esc(title)}${count !== '' ? ` <span class="tm6-c">${esc(count)}</span>` : ''}</h2>${body}</section>`;
const quiet = (ic, text) => `<p class="t6-quiet">${icon(ic)}<span>${esc(text)}</span></p>`;
const door = (href, ic, html) => `<a class="t6-line" href="${esc(href)}">${icon(ic)}<span class="t6-lt">${html}</span>${icon('chevron-right', { cls: 't6-chev' })}</a>`;
// The 2027 issues: admins only (W4); a prep date passed is "still to finish", never red (V30). First on the page between
// sessions, when it is the team's one job (Nate's walk: it sat under 12 rows of 0 with the left column empty).
function prepBlock() {
  const v = S.me; if (!v?.is_admin || !prepSeason()) return '';
  const pr = ownerProgress(); if (!pr.length) return '';
  const done = pr.reduce((s, o) => s + o.done, 0), all = pr.reduce((s, o) => s + o.total, 0), behind = pr.filter(o => o.done < o.total);
  return block('prep', 'Issues for 2027', `<p class="tm6-sub">${done} of ${plural(all, 'issue')} ready across the team. Admins see this.</p>
        ${behind.length ? `<div class="v6-list" role="list">${behind.slice(0, 5).map(o => itemRow({ key: 'pr:' + o.id, name: advocate(o.id)?.full_name || 'Someone', num: '', line: esc(`${o.done} of ${plural(o.total, 'issue')} ready`), href: `${BOARD_HREF}&who=${encodeURIComponent(o.id)}`, cls: 'v6-face-row', lead: faceLead(o.id) })).join('')}</div>` : ''}
        ${door(BOARD_HREF, 'clipboard-list', '<b>Open the prep board</b>')}`);
}
// The partners' one line, today.js's (the same parts and words as Today's door).
function partnersHTML() {
  if (!admitsPartners(S.me)) return '';
  wantQueue();
  return partnersLine(S.me) || '';
}

// ---- the pages ----
// Nate's walk 4 (R-336, Team): "It's still too crowded. This needs to be more calm and roomy. I'm not sure where I'm
// supposed to look." His pick, "One list, top 3": one reading column (A-13, one focal point). Slipping and Hearings at risk
// are one ranked list (overdue, then late but still accepted, then a hearing a working day from its notice with nobody
// asking, then what is due within a day), its three most urgent rows shown with their one action each, and "See all N"
// opening the rest in place. R-352: the bills with no owner a card under it, Who is on what beside it (see teamPage).
const TOP = 3;
const RANK = { over: 0, late: 1, risk: 2, due: 3 };
const kindOf = x => x.risk ? 'risk' : x.over ? 'over' : x.lateOk ? 'late' : 'due';
// The ranked list: Slipping's rows (today.js slipList, the count Today's "N slipping" line gives) and the hearings at risk.
function ranked(sl, risk) {
  const rows = [...sl, ...risk.map(r => ({ ...r, risk: true, key: 'ar:' + r.b.id, at: r.a.by }))];
  // a stable sort: inside each kind the order slipping() and atRisk() already give (by the time to act; no owner first)
  return rows.map((x, i) => [x, i]).sort(([x, i], [y, j]) => RANK[kindOf(x)] - RANK[kindOf(y)] || i - j).map(([x]) => x);
}
const anyRow = x => x.risk ? riskRow(x) : slipRow(x);
// One card, the same in both states: "See all" appends the rest under the same three, so no row moves or changes its words
// (the critic: the list jumped into four headed cards when opened). Each row's line says its kind ("Overdue since…",
// "late, still accepted until…", "Hearing at risk ·…", a clock and its time).
const rankedHTML = (rows, all) => `<div class="v6-list" role="list">${(all ? rows : rows.slice(0, TOP)).map(anyRow).join('')}</div>`;
// One quiet line that opens its list in place: a <details> whose summary is a door line (its state kept across redraws).
S.tmOpen ??= {};
const fold = (id, ic, html, body) => `<details class="tm6-fold" data-block="${esc(id)}" data-tmfold="${esc(id)}"${S.tmOpen[id] ? ' open' : ''}><summary class="t6-line">${icon(ic)}<span class="t6-lt">${html}</span>${icon('chevron-down', { cls: 't6-chev' })}</summary><div class="tm6-foldin">${body}</div></details>`;
// "2 today, 4 tomorrow · no one going yet": the sittings the fold opens, and whether anyone is down to go.
function schedLine(sch) {
  const [t, m] = sch.map(d => d.rows.length), all = sch.flatMap(d => d.rows), alone = all.filter(h => /no one/i.test(goingWords(h, { viewer: S.me }))).length;
  const when = [t ? `${t} today` : '', m ? `${m} tomorrow` : ''].filter(Boolean).join(', ');
  return `<b>${all.length === 1 ? 'Hearing' : 'Hearings'}</b> · ${esc(when)}${alone ? ` · ${alone === all.length ? 'no one going yet' : `${alone} with no one going`}` : ''}`;
}
// R-352 (Nate 27 Oct): the lead's own steps are the hero of their Today, so Slipping leaves them out and says so in one quiet
// line; the bills with no owner are a card of their own, the soonest 3 with Give to… (B-14 on v6: a lead's jobs are never
// folded); Who is on what and the Partners line sit in the column beside from 1360px, as 23 Oct had it, one column below.
const mineRow = x => x.risk ? x.owner === S.me?.id : !!x.mine;
function teamPage() {
  ALERTS.clear(); reachOf(null);   // who Slack can reach, asked once (admins), so an Alert's words are right the first time
  const off = SESSION_OVER;
  const sl = slipping(), risk = off ? [] : atRisk(), sch = off ? [] : schedule(), prep = prepSlip();
  const ranked0 = ranked(sl, risk), rows = ranked0.filter(x => !mineRow(x)), mine = ranked0.length - rows.length;
  const all = !!S.tmSlipAll || rows.length <= TOP, n = rows.length + (prep ? 1 : 0);
  const more = rows.length > TOP ? btn(S.tmSlipAll ? 'Show fewer' : `See all ${rows.length}`, { kind: 'text', icon: S.tmSlipAll ? 'chevron-up' : 'chevron-down', attrs: { 'data-tmslipall': '1', 'aria-expanded': String(!!S.tmSlipAll) } }) : '';
  // Said first, under the heading, in plain words, not a link: Today is the sidebar's first place, with its count.
  const yours = mine ? `<p class="tm6-sub tm6-yours">${esc(mine === 1 ? 'Your own one is on your Today, not here.' : `Your own ${mine} are on your Today, not here.`)}</p>` : '';
  const foot = more ? `<p class="tm6-more">${more}</p>` : '';
  const slip = block('slip', 'Slipping', n ? `${yours}${prep}${rows.length ? rankedHTML(rows, all) : ''}${foot}`
    : `${yours}${quiet('circle-check', off ? 'Nothing is slipping: nothing late or due within a day.' : 'Nothing is slipping: nothing late or due within a day, and every hearing a day from its notice has an ask.')}`, { count: n || '' });
  // No owner: the soonest 3 not already drawn in Slipping above (a bill is said once on the page, A-14), each with its one
  // button, then the whole list.
  const nob = nobodySteps(), shown = new Set((all ? rows : rows.slice(0, TOP)).map(x => x.b?.id));
  const nob3 = nob.filter(x => !shown.has(x.b.id)).slice(0, TOP);
  const noown = nob.length ? block('noown', 'No owner', `<p class="tm6-sub">Bills with a position that nobody holds yet, soonest first.</p>
      ${nob3.length ? `<div class="v6-list" role="list">${nob3.map(x => nobodyRow(x)).join('')}</div>` : ''}
      <p class="tm6-all"><a href="#/team?who=none">All ${esc(plural(nob.length, 'bill'))} with no owner<span aria-hidden="true">&nbsp;›</span></a></p>`, { count: nob.length }) : '';
  const hear = off ? '' : `<div class="t6-doors tm6-lines" role="group" aria-label="Hearings">${sch.some(d => d.rows.length)
    ? fold('sched', 'calendar-days', schedLine(sch), sch.map(d => d.rows.length ? `<h3 class="tm6-day">${d.label}</h3><div class="v6-list" role="list">${d.rows.map(sitRow).join('')}</div>` : '').join(''))
    : quiet('calendar-days', 'No hearings on our bills today or tomorrow.')}</div>`;
  const people = loads(), busy = people.filter(r => r.n > 0).length;
  const who = block('who', 'Who is on what', `<p class="tm6-sub">${esc(busy ? `${plural(busy, 'person', 'people')} with open steps, chair asks included.` : 'Nothing open on the team.')}</p>${loadHTML(people)}`);
  const partners = partnersHTML();
  return `<div class="tm6-root tm6-page">
    <header class="t6-head"><h1 class="v6-ptitle sv-h1" id="tm6-h1" tabindex="-1">Team</h1><p class="t6-date">${esc(new Date().toLocaleDateString('en-US', { ...HST, weekday: 'short', month: 'short', day: 'numeric' }))}</p></header>
    <div class="tm6-cols"><div class="tm6-main">${prepBlock()}${slip}${hear}${noown}</div>
    <aside class="tm6-side" aria-label="The team">${who}${partners ? `<nav class="t6-doors tm6-lines" aria-label="Partners">${partners}</nav>` : ''}</aside></div></div>`;
}
// The way back above the title (B-4; the sitting page opened from Team has one): Team for a lead, More tools for anyone else.
const backLink = () => { const b = isLead() ? { href: '#/team', label: 'Team' } : { href: '#/tools', label: 'More tools' };
  return `<a class="tm6-back" href="${b.href}">${icon('chevron-left')}<span>${esc(b.label)}</span></a>`; };
// A teammate's Today, read-only (F76): their next step and groups as their own Today draws them, no buttons, no colour.
function asTeammate(id) {
  if (id === 'none') {
    const list = nobodySteps();
    return `<div class="tm6-root">${backLink()}<header class="t6-head"><h1 class="v6-ptitle sv-h1" id="tm6-h1" tabindex="-1">No owner</h1></header>
      <p class="tm6-note">${icon('info')}<span>${esc(`${plural(list.length, 'bill with a position has', 'bills with a position have')} no owner. Anyone can take one.`)}</span>${pickBtn()}</p>
      ${list.length ? `<div class="v6-list" role="list">${list.slice(0, 40).map(nobodyRow).join('')}</div>${list.length > 40 ? quiet('info', `The first 40 of ${list.length}, soonest first.`) : ''}` : quiet('circle-check', 'Every bill with a position has an owner.')}</div>`;
  }
  const a = advocate(id); T6REG.clear();
  const L = listHTML(a, { ro: true }), w = L.w;
  return `<div class="tm6-root">${backLink()}<header class="t6-head tm6-whohead">${avatar(a, 40)}<h1 class="v6-ptitle sv-h1" id="tm6-h1" tabindex="-1">${esc(first(a.id))}’s list</h1></header>
    <p class="tm6-note">${icon('eye')}<span>${esc(`${first(a.id)}’s Today, to read while you cover for them. Their messages are not shown.`)}</span>${pickBtn()}</p>
    <div class="t6-col tm6-ro">${L.html}${w.waiting.length ? quiet('hourglass', `${plural(w.waiting.length, 'step')} on ${first(a.id)}’s bills ${w.waiting.length === 1 ? 'waits' : 'wait'} on someone else.`) : ''}</div></div>`;
}
const pickBtn = () => btn('See someone else', { kind: 'text', sm: true, icon: 'scan-eye', attrs: { 'data-tmpick': '1', 'aria-haspopup': 'dialog' } });
// Not a lead: the picker, as a page (More tools › See a teammate's list lands here too).
function pickerPage() {
  // Each person's count for today, in place of one line repeated under every name (the critic's 12).
  const today = a => { try { return t6Groups(work(a)).today.length; } catch { return 0; } };
  const rows = teammates().filter(a => a.id !== S.me?.id).sort((x, y) => x.full_name.localeCompare(y.full_name))
    .map(a => { const n = today(a); return itemRow({ key: a.id, name: a.full_name, num: '', line: esc(n ? `${plural(n, 'thing')} to do today` : 'Nothing to do today'), href: `#/team?who=${encodeURIComponent(a.id)}`, cls: 'v6-face-row', lead: faceLead(a) }); }).join('');
  return `<div class="tm6-root"><header class="t6-head"><h1 class="v6-ptitle sv-h1" id="tm6-h1" tabindex="-1">A teammate’s list</h1></header>
    <p class="tm6-note">${icon('info')}<span>Read anyone’s Today while you cover for them. Their messages are only theirs, so these counts leave them out. Team, with what is slipping, is for admins and second approvers.</span></p>
    <div class="v6-list" role="list">${rows}${itemRow({ key: 'none', name: 'No owner', num: '', line: esc(`${plural(noOwnerBills().length, 'bill')} with a position and no owner`), href: '#/team?who=none', cls: 'v6-face-row', lead: faceLead([]) })}</div></div>`;
}

function render(route) {
  if (!S.me) return '<div class="tm6-root"><h1 class="v6-ptitle">Team</h1></div>';
  t6Fresh();
  // The partners' queue is asked for before the bars are counted (its arrival draws Team again).
  if (admitsPartners()) wantQueue();
  const who = route?.who || '';
  if (who && (who === 'none' || advocate(who))) return asTeammate(who);
  return isLead() ? teamPage() : pickerPage();
}
function wire(route, root) {
  const main = root.querySelector('.tm6-root'); if (!main) return;
  wireSteps(main, { after: redraw });
  main.querySelectorAll('[data-tmalert]').forEach(b => b.onclick = () => alertThem(b, b.dataset.tmalert));
  main.querySelectorAll('[data-tmundo]').forEach(b => b.onclick = () => unalert(b.dataset.tmundo));
  main.querySelector('[data-tmslipall]')?.addEventListener('click', () => { S.tmSlipAll = !S.tmSlipAll; redraw(); });
  main.querySelectorAll('[data-tmfold]').forEach(d => d.addEventListener('toggle', () => { S.tmOpen[d.dataset.tmfold] = d.open; }));
  main.querySelector('[data-tmpick]')?.addEventListener('click', () => pickerSheet({ title: 'See a teammate’s list', value: route?.who || '',
    options: [...teammates().filter(a => a.id !== S.me?.id).sort((x, y) => x.full_name.localeCompare(y.full_name)).map(a => [a.id, a.full_name, 'user-round', '']), ['none', 'No owner', 'user-round', 'Bills with no owner']],
    onPick: id => S.go(`#/team?who=${encodeURIComponent(id)}`) }));
}
const titleOf = route => route?.who === 'none' ? 'No owner' : route?.who && advocate(route.who) ? `${first(route.who)}’s list` : isLead() ? 'Team' : 'A teammate’s list';

// What Team's Slipping heading counts (its ranked rows plus the 2027 prep line), so Today's door says the same number.
// R-352: the lead's own rows are on their Today, not Team's list, so they are not in this count either.
export function teamSlipCount() {
  const off = SESSION_OVER;
  return ranked(slipping(), off ? [] : atRisk()).filter(x => !mineRow(x)).length + (prepSlip() ? 1 : 0);
}
export default {
  tab: 'team',
  title: titleOf,
  // A teammate's list goes back to Team for a lead, to More tools for anyone else (the door they came by).
  back: route => route?.who ? (isLead() ? { href: '#/team', label: 'Team' } : { href: '#/tools', label: 'More tools' }) : null,
  render, wire,
};
