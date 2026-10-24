// Team (#/team), Staff v6 (R-336; V6-SPEC section 6 "Team", V15, D2, D5; F72-F76): what is slipping and who is on what,
// for the leads (admins and second approvers: Nate, Jess, Jaylen). v5 spread this over Mine | Team, an "Everyone" menu,
// the hearings line and folds (assessment X1, X17, X24: Nate's own work and the team's in one list; Team one tap from
// Patti). Now its own place, open blocks in this order:
//   - Slipping: v5's logic (today5.js slipping), one button per row (your own step's button; a teammate's "Alert Kevin",
//     which says truthfully where the message went; Give to… on a row nobody holds), with Undo;
//   - Hearings at risk (D2): a working day or less from the day the notice must post, nobody has asked; no owner first;
//   - today's and tomorrow's hearings as a plain schedule (D5): time, room, "Going: Kris" / "Going: no one yet", no counts,
//     no colour, no to-do rows (R-276);
//   - Who is on what: one bar per person counting everything on their Today, support work included, so Patti, Saya and
//     Julie never read 0; a bar opens that person's list;
//   - by season: the 2027 issues (admins), the partners' groups (partner approvers), the bills with no owner.
// #/team?who=<id> is "See as teammate" for everyone (More tools links it): that person's Today, read-only, never in colour,
// worked out by today.js exactly as their own Today is. #/team?who=none lists the steps nobody holds yet ("Anyone can take
// these steps"). Someone who is not a lead and opens #/team gets the picker, never an error.
import { S, DB, SESSION_OVER, esc, advocate, hooks } from './data.js';
import { work, listHTML, t6Season, t6Groups, t6Fresh, T6REG, noOwnerBills, slipList, shareAsk, partnersLine } from './today.js';
import { billRoute, billById, whenAt, lateLine, roomName, diedish, wantsHearing, standingIn } from './model.js';
import { icon, btn, toast, pickerSheet, avatar } from './ui.js';
import { billStep, billRow, itemRow, rowButton, rowButtonOK, shownStatus, nameWords, numWords, sayWords, firstWords, orWords, dayWords, timeWords,
  committeeName, goingWords, askWords, nw, wireSteps, othersWords, NO_OWNER, takeFor } from './steps.js';
import { plainCodes } from './terms.js';
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
const mq = q => { try { return matchMedia(q).matches; } catch { return false; } };
// A phone (a touch screen under 768px, or any screen under 480px) folds Who is on what and the no-owner list into one line
// each; a laptop zoomed to 200% (640px, a mouse) keeps them open, so zooming loses nothing (spec 7.10).
const PHONE = () => mq('(max-width: 767px) and (pointer: coarse)') || mq('(max-width: 479px)');
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
// A testimony step's time is steps.js actBy's, the hand-on time every other screen gives (Today, Testimony, Hearings and
// Review say "Approve by today 11:00 AM"; Team had said the Capitol's 3:00 PM: rule 6, spec 5).
const actTime = a => !a || a.kind === 'none' ? '' : a.kind === 'hand' ? `by ${a.time}` : a.kind === 'now' ? `due ${a.time}` : a.kind === 'late' ? lateLine(a.until, { lower: true }) : `was due ${a.time}`;
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
    // Testimony nobody holds (today.js slipList): "No owner yet · file by tomorrow 11:00 AM".
    if (r.nob) { const s = r.nob;
      return { key: r.key, b: r.b, p: null, s, ids: [], mine: false, line: [NO_OWNER, lc(s.act.words)].join(' · '), over: s.act.kind === 'overdue', lateOk: s.act.kind === 'late', at: s.act.at }; }
    // A share to-do is the rallier's public ask, by OUTREACH's time, only where the rallier has that row (today.js shareAsk;
    // spec 11.6): said and alerted as theirs. Anywhere else it is its owner's own to-do, in its own words and time.
    const sh = shareAsk(r.p), p = sh ? { ...r.p, due: sh.due ?? r.p.due } : r.p, b = r.b, ids = sh?.rl.length ? sh.rl : r.ids || [];
    const s = (p.d || p.h) && ['file', 'review', 'review2', 'revise', 'submit', 'write', 'nodraft', 'stale'].includes(p.kind) ? billStep(b, { viewer: S.me, d: p.d || null, h: p.h || null }) : null;
    const mine = ids.includes(me), solo = ids.length === 1;
    const who = !ids.length ? NO_OWNER : mine && solo ? 'You' : cap(orWords(ids, S.me));
    if (s && s.state && s.act) {
      const over = s.act.kind === 'overdue', lateOk = s.act.kind === 'late';
      const line = [over ? `Overdue since ${whenAt(s.act.due)}` : '', stepWords(s)].filter(Boolean).join(' · ');
      return { key: 'sl:' + (p.key || b.id), b, p, s, ids, mine, line, what: STEP_NAME[s.kind] ? lc(STEP_NAME[s.kind]) + ` on ${numWords(b)}` : strip(p.s), over, lateOk, at: s.act.at ?? p.due };
    }
    // Anything else keeps v5's own words, codes made plain: its time first, so a two-line row never cuts it (the critic's 6).
    // Overdue says so first, in words, with its date (addendum 4).
    const over = p.due != null && p.due <= now;
    const what = sh ? `${who}: write the public ask${sh.h ? ` for the ${dayWords(sh.h.scheduled_at)} hearing` : ''}` : `${who}: ${strip(plainCodes(esc(strip(p.s))))}`;
    const line = [over ? `Overdue since ${whenAt(p.due)}` : p.due != null ? cap(`due ${whenAt(p.due)}`) : '', what].filter(Boolean).join(' · ');
    return { key: 'sl:' + (p.key || b.id), b, p, s: null, ids, mine, line, what: sh ? `write the public ask for ${numWords(b)}` : strip(p.s), over, lateOk: false, at: p.due ?? Infinity };
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
  return itemRow({ key: x.key, name: nameWords(x.b), num: numWords(x.b), line: nw(esc(x.line)), icon: x.over ? 'circle-alert' : 'clock', tone: x.over ? 'overdue' : late ? 'late' : '', href: billRoute(x.b), button, cls: wideCls(button) });
}
// A long button ("Alert Lauren and Patti", "Alerted 9:00 AM · Undo") goes under the row's line below 1440px (css .tm6-wide),
// so the name and its time never break onto lines of their own; a short one stays beside the words. Below 600px every
// row's button goes under its words (steps.css, A-8).
const wideCls = html => strip(html).length > 14 ? 'tm6-r tm6-wide' : 'tm6-r';
// The rows in their three kinds, each kind under its small heading once more than one is on the list; the late ones always
// say "Late, still accepted" over them (v5's group).
function slipRows(rows) {
  // (the overdue rows lead under Slipping's own heading: each says "Overdue since …" in its own words and colour)
  const late = rows.filter(x => !x.over && x.lateOk), kinds = [['over', '', rows.filter(x => x.over)], ['late', 'Late, still accepted', late], ['due', late.length ? 'Due within a day' : '', rows.filter(x => !x.over && !x.lateOk)]].filter(k => k[2].length);
  return kinds.map(([k, t, xs]) => `${t ? `<h3 class="tm6-slipsub" id="tm6-ss-${k}">${esc(t)}</h3>` : ''}<div class="v6-list" role="list"${t ? ` aria-labelledby="tm6-ss-${k}"` : ''}>${xs.map(slipRow).join('')}</div>`).join('');
}
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
// "James owns it · ask Rep. Hashem and Rep. Belatti by Tue 3/17" (the critic: "James's · ask…" read as a fragment).
function riskRow(x) {
  const key = 'ar:' + x.b.id, chair = x.a.m ? x.a.m.who : 'the chair';
  let button;
  if (!x.owner) button = noOwnBtn(x.b);
  else if (x.owner === S.me?.id) button = rowButton(billStep(x.b, { viewer: S.me, d: null, h: null }));
  else { ALERTS.set(key, { b: x.b, ids: [x.owner], what: `the hearing notice must post by ${dayWords(x.a.by)} and nobody has asked ${chair} yet` }); button = alertBtn(key, [x.owner]); }
  return itemRow({ key, name: nameWords(x.b), num: numWords(x.b), line: nw(esc(`${!x.owner ? NO_OWNER : x.owner === S.me?.id ? 'You own it' : `${first(x.owner)} owns it`} · ask ${chair} by ${dayWords(x.a.by)}`)), href: billRoute(x.b), button, cls: wideCls(button) });
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
// Each says its step and its one time to act, as Slipping does ("File by tomorrow 11:00 AM", spec 5 actBy); the list's
// title says no one holds it.
const nobodyLine = s => s?.state && s.act?.words && !['missed', 'filed'].includes(s.state.key) && !s.off ? (s.kind === 'nodraft' ? `Make the draft · ${lc(s.act.words)}` : s.act.words) : unheld(s);
const nobodyRow = x => billRow(x.b, { viewer: S.me, step: { ...x.s, mine: false }, line: nw(esc(nobodyLine(x.s))), button: noOwnBtn(x.b), cls: 'tm6-r' });

// ---- Who is on what: everything on each person's Today, support work included ----
// The people with nothing open are one line, "Everyone else: nothing open" (spec 0: less on every screen; between sessions
// 12 rows read 0).
function loads() {
  // Their own steps, plus what they help others with: a coalition's hearing asks (D4) and the public asks they rally (W22),
  // so a helper's bar is never an empty 0 while they carry a coalition's week (V15).
  const helpN = w => [...w.coal.values()].reduce((s, e) => s + e.n, 0) + new Set(w.rally.map(x => x.b.id)).size;
  return teammates().map(a => { const w = work(a); return { a, n: w.own.length + helpN(w) }; }).sort((x, y) => y.n - x.n || x.a.full_name.localeCompare(y.a.full_name));
}
function loadHTML(rows = loads()) {
  const none = nobodySteps().length, busy = rows.filter(r => r.n > 0), idle = rows.length - busy.length, max = Math.max(1, none, ...rows.map(r => r.n));
  const bar = (href, av, name, n, title) => `<a class="tm6-load" href="${esc(href)}" aria-label="${esc(`${title}: ${n}`)}">${av}<span class="tm6-ln">${esc(name)}</span><span class="tm6-bar" aria-hidden="true"><i style="width:${Math.round(n / max * 100)}%"></i></span><span class="tm6-n" aria-hidden="true">${n}</span></a>`;
  return `<div class="tm6-loads">${busy.map(({ a, n }) => bar(`#/team?who=${encodeURIComponent(a.id)}`, avatar(a, 28), a.id === S.me?.id ? 'You' : a.full_name, n, a.id === S.me?.id ? 'Your list' : `${a.full_name}’s list`)).join('')}
    ${none ? bar('#/team?who=none', avatar(null, 28), 'No owner', none, 'Bills with no owner') : ''}
    ${idle ? `<p class="tm6-idle">${icon('circle-check')}<span>${busy.length || none ? 'Everyone else' : 'Everyone'}: nothing open</span></p>` : ''}</div>`;
}

// ---- the seasonal blocks ----
// Bills with a position and no owner (W42): the first few, soonest step first, each with Give to… (admins) or Take it, and
// the full list.
function noOwner() {
  const list = nobodySteps(); if (!list.length) return '';
  return block('noown', 'Bills with no owner', `<p class="tm6-sub">${plural(list.length, 'bill with a position has', 'bills with a position have')} no owner.</p>
      <div class="v6-list" role="list">${list.slice(0, 3).map(nobodyRow).join('')}</div>
      ${list.length > 3 ? door('#/team?who=none', 'user-round', `<b>All ${list.length} bills with no owner</b>`) : ''}`);
}
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
        ${behind.length ? `<div class="v6-list" role="list">${behind.slice(0, 5).map(o => itemRow({ key: 'pr:' + o.id, name: advocate(o.id)?.full_name || 'Someone', num: '', line: esc(`${o.done} of ${plural(o.total, 'issue')} ready`), href: `${BOARD_HREF}&who=${encodeURIComponent(o.id)}` })).join('')}</div>` : ''}
        ${door(BOARD_HREF, 'clipboard-list', '<b>Open the prep board</b>')}`);
}
// The partners' one line, today.js's (the same parts and words as Today's door).
function partnersHTML() {
  if (!admitsPartners(S.me)) return '';
  wantQueue();
  const l = partnersLine(S.me); return l ? `<nav class="t6-doors" data-block="partners" aria-label="Partners">${l}</nav>` : '';
}

// ---- the pages ----
const SLIP_SHOWN = 8;   // the whole of Slipping on Nate's first screen (staff6_people); the rest one labelled tap away
// Below 1100px the blocks are one column in this order: Slipping, Today and tomorrow, then the rest (css: .tm6-grid's
// `order`; Nate's walk: at 1024 the schedule was 2.5 screens down). On a phone Who is on what and Bills with no owner are
// one labelled line each that opens its list (spec 6 phone; 4.4 screens at 390 before).
function teamPage() {
  ALERTS.clear(); reachOf(null);   // who Slack can reach, asked once (admins), so an Alert's words are right the first time
  const off = SESSION_OVER, phone = PHONE();
  const sl = slipping(), risk = off ? [] : atRisk(), sch = schedule(), all = !!S.tmSlipAll, prep = prepSlip();
  const shown = all ? sl : sl.slice(0, SLIP_SHOWN);
  const slip = block('slip', 'Slipping', sl.length || prep ? `${prep}${sl.length ? slipRows(shown) : ''}${sl.length > SLIP_SHOWN ? `<p class="t6-more">${btn(all ? 'Show fewer' : `Show all ${sl.length}`, { kind: 'text', icon: all ? 'chevron-up' : 'chevron-down', attrs: { 'data-tmslipall': '1', 'aria-expanded': String(all) } })}</p>` : ''}`
    : quiet('circle-check', 'Nothing is slipping: nothing late or due within a day.'), { count: sl.length + (prep ? 1 : 0) || '' });
  // Between sessions there are no hearings to be at risk and none to schedule: the blocks are left out (spec 0).
  const riskB = off ? '' : block('risk', 'Hearings at risk', risk.length ? `<p class="tm6-sub">A working day or less until the notice must post, and nobody has asked the chair.</p><div class="v6-list" role="list">${risk.map(riskRow).join('')}</div>`
    : quiet('circle-check', 'No bill is a working day from its notice without an ask.'));
  const sched = off ? '' : block('sched', 'Today and tomorrow', sch.some(d => d.rows.length) ? sch.map(d => d.rows.length ? `<h3 class="tm6-day">${d.label}</h3><div class="v6-list" role="list">${d.rows.map(sitRow).join('')}</div>` : '').join('')
    : quiet('calendar', 'No hearings on our bills today or tomorrow.'));
  const rows = loads();
  const who = phone ? `<details class="tm6-fold t6-doors" data-block="who"${S.tmWhoOpen ? ' open' : ''} data-tmwho><summary class="t6-line">${icon('users')}<span class="t6-lt"><b>Who is on what</b> · ${plural(rows.length, 'person', 'people')}</span>${icon('chevron-down', { cls: 't6-chev' })}</summary><div class="tm6-foldin">${loadHTML(rows)}</div></details>`
    : block('who', 'Who is on what', `<p class="tm6-sub">Each person’s steps, with what they write, approve and ask for others.</p>${loadHTML(rows)}`);
  const nob = nobodySteps().length, noown = phone ? (nob ? `<nav class="t6-doors" data-block="noown" aria-label="Bills with no owner">${door('#/team?who=none', 'user-round', `<b>No owner</b> · ${plural(nob, 'bill')}`)}</nav>` : '') : noOwner();
  return `<div class="tm6-root${phone ? ' ph' : ''}">
    <header class="t6-head"><h1 class="v6-ptitle sv-h1" id="tm6-h1" tabindex="-1">Team</h1><p class="t6-date">${esc(new Date().toLocaleDateString('en-US', { ...HST, weekday: 'short', month: 'short', day: 'numeric' }))}</p></header>
    <div class="tm6-grid"><div class="tm6-main">${prepBlock()}${slip}${riskB}${noown}</div><div class="tm6-side">${sched}${who}${partnersHTML()}</div></div></div>`;
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
  return `<div class="tm6-root">${backLink()}<header class="t6-head"><h1 class="v6-ptitle sv-h1" id="tm6-h1" tabindex="-1">${esc(first(a.id))}’s list</h1></header>
    <p class="tm6-note">${icon('eye')}<span>${esc(`${first(a.id)}’s Today, to read while you cover for them. Their messages are not shown.`)}</span>${pickBtn()}</p>
    <div class="t6-col tm6-ro">${L.html}${w.waiting.length ? quiet('hourglass', `${plural(w.waiting.length, 'step')} on ${first(a.id)}’s bills ${w.waiting.length === 1 ? 'waits' : 'wait'} on someone else.`) : ''}</div></div>`;
}
const pickBtn = () => btn('See someone else', { kind: 'text', sm: true, icon: 'users-round', attrs: { 'data-tmpick': '1', 'aria-haspopup': 'dialog' } });
// Not a lead: the picker, as a page (More tools › See a teammate's list lands here too).
function pickerPage() {
  // Each person's count for today, in place of one line repeated under every name (the critic's 12).
  const today = a => { try { return t6Groups(work(a)).today.length; } catch { return 0; } };
  const rows = teammates().filter(a => a.id !== S.me?.id).sort((x, y) => x.full_name.localeCompare(y.full_name))
    .map(a => { const n = today(a); return itemRow({ key: a.id, name: a.full_name, num: '', line: esc(n ? `${plural(n, 'thing')} to do today` : 'Nothing to do today'), href: `#/team?who=${encodeURIComponent(a.id)}` }); }).join('');
  return `<div class="tm6-root"><header class="t6-head"><h1 class="v6-ptitle sv-h1" id="tm6-h1" tabindex="-1">A teammate’s list</h1></header>
    <p class="tm6-note">${icon('info')}<span>Read anyone’s Today while you cover for them. Their messages are only theirs, so these counts leave them out. Team, with what is slipping, is for admins and second approvers.</span></p>
    <div class="v6-list" role="list">${rows}${itemRow({ key: 'none', name: 'No owner', num: '', line: esc(`${plural(noOwnerBills().length, 'bill')} with a position and no owner`), href: '#/team?who=none' })}</div></div>`;
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
  main.querySelector('[data-tmwho]')?.addEventListener('toggle', e => { S.tmWhoOpen = e.target.open; });
  main.querySelector('[data-tmpick]')?.addEventListener('click', () => pickerSheet({ title: 'See a teammate’s list', value: route?.who || '',
    options: [...teammates().filter(a => a.id !== S.me?.id).sort((x, y) => x.full_name.localeCompare(y.full_name)).map(a => [a.id, a.full_name, 'user-round', '']), ['none', 'No owner', 'user-round', 'Bills with no owner']],
    onPick: id => S.go(`#/team?who=${encodeURIComponent(id)}`) }));
}
const titleOf = route => route?.who === 'none' ? 'No owner' : route?.who && advocate(route.who) ? `${first(route.who)}’s list` : isLead() ? 'Team' : 'A teammate’s list';

export default {
  tab: 'team',
  title: titleOf,
  // A teammate's list goes back to Team for a lead, to More tools for anyone else (the door they came by).
  back: route => route?.who ? (isLead() ? { href: '#/team', label: 'Team' } : { href: '#/tools', label: 'More tools' }) : null,
  render, wire,
};
