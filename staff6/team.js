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
import { slipNow } from './today5.js';
import { work, listHTML, t6Season, t6Groups, t6Fresh, T6REG, noOwnerBills } from './today.js';
import { billRoute, billById, whenAt, lateLine, roomName, diedish, wantsHearing } from './model.js';
import { icon, btn, toast, pickerSheet, avatar } from './ui.js';
import { billStep, billRow, itemRow, rowButton, rowButtonOK, nameWords, numWords, sayWords, firstWords, orWords, dayWords, timeWords,
  committeeName, goingWords, askWords, nw, wireSteps } from './steps.js';
import { plainCodes } from './terms.js';
import { isLead } from './more.js';
import { ownerProgress, BOARD_HREF } from './prep.js';
import { pqItems, pqOthers, admitsPartners, wantQueue } from './partnerq.js';

const HR = 36e5, DAY = 864e5, HST = { timeZone: 'Pacific/Honolulu' };
const ms = t => t == null ? null : typeof t === 'number' ? t : new Date(t).getTime();
const hday = t => new Date(t).toLocaleDateString('en-CA', HST);
const live = id => { const a = id && advocate(id); return !!a && a.is_active !== false; };
const first = id => firstWords(id, { id: null });
const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;
const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`;
const strip = s => String(s || '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&[a-z#0-9]+;/g, ' ').replace(/\s+/g, ' ').trim();
const teammates = () => (S.advocates || []).filter(a => a.is_active !== false);
const ownerOf = b => (S.assignments?.[b?.id] || []).find(live) || null;
const isPos = b => !!b && !!b.position && b.position !== 'monitor' && b.tracked !== false;
const redraw = () => hooks.render();
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
// "Alert Kevin": a one-line message on the bill with @Kevin, with Undo (v5's W42 nudge, R-330), saying where it went.
const ALERTS = new Map();
async function alertThem(el, key) {
  const x = ALERTS.get(key); if (!x) return;
  if (el) { el.setAttribute('aria-busy', 'true'); el.disabled = true; }
  try {
    const m = await DB.sendMessage(x.b.id, `${x.ids.map(id => '@' + first(id)).join(' ')} From Team: ${x.what}. Can you get it in?`);
    toast(reachWords(x.ids, x.b), { ok: true, undo: async () => { await DB.deleteMessage(m); redraw(); } });
    redraw();
  } catch (e) { toast(e, { err: true }); if (el?.isConnected) { el.removeAttribute('aria-busy'); el.disabled = false; } }
}
// The button names whom the alert reaches ("Alert Lauren and Patti"), never "Alert them" (the critic's 7).
const alertBtn = (key, ids) => btn(`Alert ${orWords(ids, null, { and: true })}`, { kind: 'secondary', sm: true, icon: 'bell', attrs: { 'data-tmalert': key } });
const giveBtn = b => btn('Give to…', { kind: 'secondary', sm: true, icon: 'user-round', attrs: { 'data-v6act': 'giveto', 'data-v6b': b.id, 'aria-haspopup': 'dialog' } });
// On a list of bills with no owner, each row's "no one holds it" is said once, by the list's own title (one word, "no
// owner", for one fact: the critic's 9; steps.js's row words are asked to change as a shared change).
const unheld = s => cap(String(s?.line || '').replace(/ · no one holds it/i, '').replace(/^no one holds it · /i, ''));
const takeBtn = b => btn('Take it', { kind: 'secondary', sm: true, icon: 'user-round', attrs: { 'data-v6act': 'take', 'data-v6b': b.id } });

// ---- Slipping (v5's logic): one row per step, said in v6's words ----
const VERB = { approve: ['approve', 'approves'], second: ['approve', 'approves'], file: ['file', 'files'], nodraft: ['make the draft', 'makes the draft'],
  revise: ['resubmit', 'resubmits'], submit: ['send it for approval', 'sends it for approval'], write: ['send it for approval', 'sends it for approval'] };
function slipping() {
  let sl; try { sl = slipNow(); } catch (e) { console.error(e); return []; }
  const me = S.me?.id, now = Date.now();
  return sl.rows.filter(r => r.p && r.b).map(r => {
    const p = r.p, b = r.b, ids = r.ids || [];
    // A testimony step reads as steps.js says it; anything else keeps v5's own words, with codes made plain.
    const s = (p.d || p.h) && ['file', 'review', 'review2', 'revise', 'submit', 'write', 'nodraft', 'stale'].includes(p.kind) ? billStep(b, { viewer: S.me, d: p.d || null, h: p.h || null }) : null;
    const mine = ids.includes(me), solo = ids.length === 1;
    const who = !ids.length ? 'No owner' : mine && solo ? 'You' : orWords(ids, S.me).replace(/^./, c => c.toUpperCase());
    const late = p.due != null && p.due <= now, until = !!(s && p.h && ms(p.h.scheduled_at) > now && VERB[s.kind]);
    // Overdue: still to do and its own deadline passed, with nothing still taking it (addendum 4; v5's one red tile). It
    // says so first, in words, with its date: "Overdue since Sat 3/14 · James: Ask the chair's office…" (the critic's 7).
    const over = late && !until;
    const when = p.due == null || over ? '' : late ? lateLine(p.h.scheduled_at, { lower: true }) : `due ${whenAt(p.due)}`;
    const v = s && VERB[s.kind], what = v ? `${who} ${!ids.length || (mine && solo) || ids.length > 1 ? v[0] : v[1]}` : `${who}: ${strip(plainCodes(esc(strip(p.s))))}`;
    // A step's line is short ("Kevin resubmits · due today 2:00 PM"); a to-do's is free text, so its time comes first and
    // is never the part a two-line row cuts (the critic's 6).
    const line = v ? [over ? `Overdue since ${whenAt(p.due)}` : '', what, when] : [over ? `Overdue since ${whenAt(p.due)}` : cap(when), what];
    return { key: 'sl:' + (p.key || b.id), b, p, s, ids, mine, line: line.filter(Boolean).join(' · '), what: strip(p.s), late, over };
  }).sort((x, y) => y.over - x.over);
}
function slipRow(x) {
  const others = x.ids.filter(id => id !== S.me?.id);
  let button = '';
  if (x.mine && x.s && rowButtonOK(x.s)) button = rowButton(x.s);
  else if (!x.ids.length) button = giveBtn(x.b);
  else if (others.length) { ALERTS.set(x.key, { b: x.b, ids: others, what: x.what }); button = alertBtn(x.key, others); }
  // Someone else's late step is said in words with its clock, never in colour (D3): "late, still accepted until". The one
  // exception is the overdue step, red with its word and date, which is what a lead opens Team to find (addendum 4).
  return itemRow({ key: x.key, name: nameWords(x.b), num: numWords(x.b), line: nw(esc(x.line)), icon: x.over ? 'circle-alert' : 'clock', tone: x.over ? 'overdue' : '', href: billRoute(x.b), button });
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
function riskRow(x) {
  const key = 'ar:' + x.b.id, chair = x.a.m ? x.a.m.who : 'the chair';
  let button;
  if (!x.owner) button = giveBtn(x.b);
  else if (x.owner === S.me?.id) button = rowButton(billStep(x.b, { viewer: S.me, d: null, h: null }));
  else { ALERTS.set(key, { b: x.b, ids: [x.owner], what: `the hearing notice must post by ${dayWords(x.a.by)} and nobody has asked ${chair} yet` }); button = alertBtn(key, [x.owner]); }
  return itemRow({ key, name: nameWords(x.b), num: numWords(x.b), line: nw(esc(`${!x.owner ? 'No owner' : x.owner === S.me?.id ? 'Yours' : `${first(x.owner)}’s`} · ask ${chair} by ${dayWords(x.a.by)}`)), href: billRoute(x.b), button });
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
const sitRow = h => itemRow({ key: 'h:' + h.id, name: committeeName(h.committee) || h.committee, num: timeWords(h.scheduled_at),
  line: nw(esc([h.room ? roomName(h.room) : '', goingWords(h, { viewer: S.me })].filter(Boolean).join(' · '))), href: `#/hearing/${encodeURIComponent(h.id)}?from=team` });

// ---- bills with no owner (who=none, the No owner bar, the block, Today's line: one count, one word) ----
// today.js noOwnerBills: a position, alive, nobody owns it. Each with its current step, soonest first.
function nobodySteps() {
  return noOwnerBills().map(b => ({ b, s: billStep(b, { viewer: S.me }) })).filter(x => x.s)
    .sort((x, y) => (x.s.due ?? Infinity) - (y.s.due ?? Infinity));
}

// ---- Who is on what: everything on each person's Today, support work included ----
function loadHTML() {
  // Their own steps, plus what they help others with: a coalition's hearing asks (D4) and the public asks they rally (W22),
  // so a helper's bar is never an empty 0 while they carry a coalition's week (V15).
  const helpN = w => [...w.coal.values()].reduce((s, e) => s + e.n, 0) + new Set(w.rally.map(x => x.b.id)).size;
  const rows = teammates().map(a => { const w = work(a); return { a, n: w.own.length + helpN(w) }; }).sort((x, y) => y.n - x.n || x.a.full_name.localeCompare(y.a.full_name));
  const none = nobodySteps().length, max = Math.max(1, none, ...rows.map(r => r.n));
  const bar = (href, av, name, n, title) => `<a class="tm6-load" href="${esc(href)}" aria-label="${esc(`${title}: ${n}`)}">${av}<span class="tm6-ln">${esc(name)}</span><span class="tm6-bar" aria-hidden="true"><i style="width:${Math.round(n / max * 100)}%"></i></span><span class="tm6-n" aria-hidden="true">${n}</span></a>`;
  return `<div class="tm6-loads">${rows.map(({ a, n }) => bar(`#/team?who=${encodeURIComponent(a.id)}`, avatar(a, 28), a.id === S.me?.id ? 'You' : a.full_name, n, a.id === S.me?.id ? 'Your list' : `${a.full_name}’s list`)).join('')}
    ${none ? bar('#/team?who=none', avatar(null, 28), 'No owner', none, 'Bills with no owner') : ''}</div>`;
}

// ---- the seasonal blocks ----
// Bills with a position and no owner (W42): the first few, each with Give to… (admins) or Take it, and the full list.
function noOwner() {
  const out = [], v = S.me;
  {
    const unowned = noOwnerBills();
    if (unowned.length) out.push(block('noown', 'Bills with no owner', `<p class="tm6-sub">${plural(unowned.length, 'bill with a position has', 'bills with a position have')} no owner.</p>
      <div class="v6-list" role="list">${unowned.slice(0, 3).map(b => { const st = billStep(b, { viewer: v }); return billRow(b, { viewer: v, step: { ...st, mine: false }, line: nw(esc(unheld(st))), button: v?.is_admin ? giveBtn(b) : takeBtn(b) }); }).join('')}</div>
      ${unowned.length > 3 ? door('#/team?who=none', 'user-round', `<b>All ${unowned.length} bills with no owner</b>`) : ''}`));
  }
  return out.join('');
}
const block = (id, title, body, { count = '' } = {}) => `<section class="tm6-block" data-block="${esc(id)}" aria-labelledby="tm6-${esc(id)}"><h2 class="tm6-h" id="tm6-${esc(id)}">${esc(title)}${count !== '' ? ` <span class="tm6-c">${esc(count)}</span>` : ''}</h2>${body}</section>`;
const quiet = (ic, text) => `<p class="t6-quiet">${icon(ic)}<span>${esc(text)}</span></p>`;
const door = (href, ic, html) => `<a class="t6-line" href="${esc(href)}">${icon(ic)}<span class="t6-lt">${html}</span>${icon('chevron-right', { cls: 't6-chev' })}</a>`;
function seasonal({ side = true } = {}) {
  const out = [], v = S.me;
  if (!side) return noOwner();
  // The 2027 issues: admins only (W4); a prep date passed is "still to finish", never red (V30).
  if (v?.is_admin && SESSION_OVER && t6Season() === 'prep') {
    const pr = ownerProgress(); if (pr.length) {
      const done = pr.reduce((s, o) => s + o.done, 0), all = pr.reduce((s, o) => s + o.total, 0), behind = pr.filter(o => o.done < o.total);
      out.push(block('prep', 'Issues for 2027', `<p class="tm6-sub">${done} of ${plural(all, 'issue')} ready across the team. Admins see this.</p>
        ${behind.length ? `<div class="v6-list" role="list">${behind.slice(0, 5).map(o => itemRow({ key: 'pr:' + o.id, name: advocate(o.id)?.full_name || 'Someone', num: '', line: esc(`${o.done} of ${plural(o.total, 'issue')} ready`), href: `${BOARD_HREF}&who=${encodeURIComponent(o.id)}` })).join('')}</div>` : ''}
        ${door(BOARD_HREF, 'clipboard-list', '<b>Open the prep board</b>')}`));
    }
  }
  if (admitsPartners(v)) {
    wantQueue();
    const n = pqItems().length, o = pqOthers(), parts = [n ? `${plural(n, 'set', 'sets')} of words to approve` : '', o.groups.length ? `${plural(o.groups.length, 'group')} to approve` : '', o.requests.length ? `${plural(o.requests.length, 'group')} ${o.requests.length === 1 ? 'asks' : 'ask'} to join` : ''].filter(Boolean);
    if (parts.length) out.push(`<nav class="t6-doors" aria-label="Partners">${door('#/partners', 'handshake', `<b>Partners</b> · ${esc(parts.join(' · '))}`)}</nav>`);
  }
  return out.join('');
}

// ---- the pages ----
const SLIP_SHOWN = 8;   // the whole of Slipping on Nate's first screen (staff6_people); the rest one labelled tap away
function teamPage() {
  ALERTS.clear(); reachOf(null);   // who Slack can reach, asked once (admins), so an Alert's words are right the first time
  const sl = slipping(), risk = atRisk(), sch = schedule(), all = !!S.tmSlipAll;
  const slip = block('slip', 'Slipping', sl.length ? `<div class="v6-list" role="list">${(all ? sl : sl.slice(0, SLIP_SHOWN)).map(slipRow).join('')}</div>${sl.length > SLIP_SHOWN ? `<p class="t6-more">${btn(all ? 'Show fewer' : `Show all ${sl.length}`, { kind: 'text', icon: all ? 'chevron-up' : 'chevron-down', attrs: { 'data-tmslipall': '1', 'aria-expanded': String(all) } })}</p>` : ''}`
    : quiet('circle-check', 'Nothing is slipping: nothing late or due within a day.'), { count: sl.length || '' });
  const riskB = block('risk', 'Hearings at risk', risk.length ? `<p class="tm6-sub">A working day or less until the notice must post, and nobody has asked the chair.</p><div class="v6-list" role="list">${risk.map(riskRow).join('')}</div>`
    : quiet('circle-check', 'No bill is a working day from its notice without an ask.'));
  const sched = block('sched', 'Today and tomorrow', sch.some(d => d.rows.length) ? sch.map(d => d.rows.length ? `<h3 class="tm6-day">${d.label}</h3><div class="v6-list" role="list">${d.rows.map(sitRow).join('')}</div>` : '').join('')
    : quiet('calendar', SESSION_OVER ? 'No hearings between sessions.' : 'No hearings on our bills today or tomorrow.'));
  const who = block('who', 'Who is on what', `<p class="tm6-sub">Each person’s steps, with what they write, approve and ask for others.</p>${loadHTML()}`);
  return `<div class="tm6-root">
    <header class="t6-head"><h1 class="v6-ptitle sv-h1" id="tm6-h1" tabindex="-1">Team</h1><p class="t6-date">${esc(new Date().toLocaleDateString('en-US', { ...HST, weekday: 'short', month: 'short', day: 'numeric' }))}</p></header>
    <div class="tm6-grid"><div class="tm6-main">${slip}${riskB}${seasonal({ side: false })}</div><div class="tm6-side">${sched}${who}${seasonal()}</div></div></div>`;
}
// A teammate's Today, read-only (F76): their next step and groups as their own Today draws them, no buttons, no colour.
function asTeammate(id) {
  if (id === 'none') {
    const list = nobodySteps();
    return `<div class="tm6-root"><header class="t6-head"><h1 class="v6-ptitle sv-h1" id="tm6-h1" tabindex="-1">No owner</h1></header>
      <p class="tm6-note">${icon('info')}<span>${esc(`${plural(list.length, 'bill with a position has', 'bills with a position have')} no owner. Anyone can take one.`)}</span>${pickBtn()}</p>
      ${list.length ? `<div class="v6-list" role="list">${list.slice(0, 40).map(x => billRow(x.b, { viewer: S.me, step: { ...x.s, mine: false }, line: nw(esc(unheld(x.s))), button: takeBtn(x.b) })).join('')}</div>${list.length > 40 ? quiet('info', `The first 40 of ${list.length}, soonest first.`) : ''}` : quiet('circle-check', 'Every bill with a position has an owner.')}</div>`;
  }
  const a = advocate(id); T6REG.clear();
  const L = listHTML(a, { ro: true }), w = L.w;
  return `<div class="tm6-root"><header class="t6-head"><h1 class="v6-ptitle sv-h1" id="tm6-h1" tabindex="-1">${esc(first(a.id))}’s list</h1></header>
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
  main.querySelector('[data-tmslipall]')?.addEventListener('click', () => { S.tmSlipAll = !S.tmSlipAll; redraw(); });
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
