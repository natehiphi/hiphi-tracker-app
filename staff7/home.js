// Staff7 Home (R-398, Nate 14 Nov): a to-do list on the left, and on the right, until a row is clicked, a calm overview of the person's situation.
// This module works out what Home holds (To do, Waiting on others, Suggested) and draws the left lists, the overview and the three small read-only sheets
// (a hearing today, a letter with someone else, a suggested step). Nothing here writes anything, and nothing leaves the app.
import { S, advocate, isMine, DEADLINES, DEMO } from '../staff6/data.js';
import { work } from '../staff6/today.js';
import { billStep } from '../staff6/steps.js';
import { attendees, roomName, sittingDraft } from '../staff6/model.js';
import { ic } from './icons7.js';
import { esc, btn, band, plainBand, fileRow, stepRow, toast } from './parts.js';
import { stepsFor, homeRows, laterRows, laterWords, dayTime, left, soonSoon, pastDue, cmteWords, hearingLine, billName, billNo, first, issueOf } from './steps.js';
import { myIssueStandings, tally, needsHearing, deadlineOf, isAmberRisk, riskDate, riskWhy } from './standing.js';
import { dateWords, sessionDates, touchMap } from './words.js';

const HST = { timeZone: 'Pacific/Honolulu' };
const DAY = 864e5;
const ymd = t => new Date(t).toLocaleDateString('en-CA', HST);
const clock = t => new Date(t).toLocaleTimeString('en-US', { ...HST, hour: 'numeric', minute: '2-digit' });
const sameDay = t => ymd(t) === ymd(Date.now());
export { dateWords };
// "by 2:00 PM" today, "by Wed 2:00 PM" after
const byWord = t => sameDay(t) ? clock(t) : dayTime(t);
// a day for a step that is not today: "Thu", or "Mar 25" when it is more than 6 days off
const shortDay = t => Math.abs(new Date(t).getTime() - Date.now()) > 6 * DAY ? new Date(t).toLocaleDateString('en-US', { ...HST, month: 'short', day: 'numeric' }) : new Date(t).toLocaleDateString('en-US', { ...HST, weekday: 'short' });
// a long name (a bill with no nickname is named by its title) is cut at a word, so a fact stays three lines at most
const brief = (t, n = 44) => { t = String(t); if (t.length <= n) return t; const c = t.slice(0, n).replace(/\s+\S*$/, ''); return (c || t.slice(0, n)).replace(/[,;:.]+$/, '') + '…'; };
const names = ids => ids.map(advocate).filter(Boolean).map(first);
// at most two names, then "or 2 more"
const orJoin = xs => xs.length < 3 ? xs.join(' or ') : `${xs[0]}, ${xs[1]} or ${xs.length - 2} more`;
const enc = encodeURIComponent;

// What is open in each collapsible, kept across redraws in this visit only. `laterOff` / `suggOff` is the page a person collapsed it on: the minute's redraw leaves it collapsed there.
export const ui = { later: false, sugg: false, laterOff: '', suggOff: '' };

// ---------------------------------------------------------------------------------- what Home holds
export const withMe = (me, fn) => { const prev = S.me; S.me = me; try { return fn(); } finally { S.me = prev; } };

// A hearing today of a bill the person leads or follows (Honolulu's day, not cancelled), one per hearing, in time order.
export function hearingsToday(me) {
  return withMe(me, () => (S.hearings || []).filter(h => h.status !== 'cancelled' && sameDay(h.scheduled_at)).map(h => ({ h, b: (S.bills || []).find(x => x.id === h.bill_id) }))
    .filter(x => x.b && x.b.tracked !== false && isMine(x.b)).sort((x, y) => x.h.scheduled_at.localeCompare(y.h.scheduled_at) || String(x.b.bill_number).localeCompare(String(y.b.bill_number), 'en', { numeric: true }))
    .map(({ h, b }) => ({ id: String(h.id), h, b, name: billName(b), no: billNo(b), at: new Date(h.scheduled_at).getTime() })));
}
// The next hearing still to come of a bill the person leads or follows, after today: a hearing today is already a To do row, so the fact never says it twice.
export function nextHearing(me) {
  return withMe(me, () => (S.hearings || []).filter(h => h.status === 'scheduled' && new Date(h.scheduled_at).getTime() > Date.now() && !sameDay(h.scheduled_at)).sort((x, y) => x.scheduled_at.localeCompare(y.scheduled_at))
    .map(h => ({ h, b: (S.bills || []).find(x => x.id === h.bill_id) })).find(x => x.b && x.b.tracked !== false && isMine(x.b)) || null);
}
// My letters, and anything else of mine, that sit with someone else (work(me).waiting, the letters with an approver first).
export function waitingFor(me) {
  const rows = [];
  withMe(me, () => { for (const x of work(me).waiting || []) {
    if (/^w:/.test(x.key) && x.b && x.h) {
      const s = billStep(x.b, { viewer: me, d: x.d || null, h: x.h }), ids = (x.on || []).filter(id => id !== me.id), who = names(ids), at = s?.act?.at ?? s?.due ?? null;
      rows.push({ id: x.key, kind: 'letter', b: x.b, h: x.h, d: x.d || null, name: billName(x.b), no: billNo(x.b), who: who.length ? orJoin(who) : '', second: x.d?.status === 'second_review', at, with: ids });
    } else if (/^wa:/.test(x.key) && x.a) {
      rows.push({ id: x.key, kind: 'email', b: null, name: String(x.a.subject || 'Your email').replace(/\s+/g, ' ').trim().slice(0, 48), no: '', who: '', second: false, at: null, with: [] });
    }
  } });
  return rows.sort((x, y) => (x.at ?? Infinity) - (y.at ?? Infinity));
}
// "Waiting on Jaylen or Jess to approve", "... for a second look", and when it is needed: "needed in 1 hour". Amber only under 24 hours, the same rule as To do.
const waitWho = w => w.who ? `Waiting on ${w.who} ${w.second ? 'for a second look' : 'to approve'}` : w.second ? 'Waiting for a second look' : 'Waiting for an approver';
const waitNeed = w => w.at == null ? '' : new Date(w.at).getTime() > Date.now() ? `needed in ${left(w.at)}` : `needed ${left(w.at)} ago`;
export const waitText = w => `${waitWho(w)}${w.at != null ? ` · ${waitNeed(w)}` : ''}`;
const waitHTML = w => `${esc(waitWho(w))}${w.at != null ? ` <span class="sep" aria-hidden="true">·</span> <span class="wneed${soonSoon(w.at) ? ' soon' : ''}">${soonSoon(w.at) ? ic('clock') : ''}${esc(waitNeed(w))}</span>` : ''}`;

// Steps that have no page in the new app yet: follow-ups, replies and the public ask. Each says what it is; the current app does it for now.
export function suggestedFor(me) {
  const out = [];
  withMe(me, () => { for (const it of work(me).own) {
    if (it.kind === 'followask' && it.b) {
      const m = it.s?.ask?.m, who = m?.who || 'The chair', many = (m?.n || 1) > 1 || / and /.test(who);   // two chairs have not answered: "have", "the chairs"
      out.push({ id: it.key, kind: 'followask', verb: `Follow up with the chair${many ? 's' : ''}`, b: it.b, text: `${who} ${many ? 'have' : 'has'} not answered your ask for a hearing yet. A short second note often gets it scheduled.` });
    }
    else if (it.kind === 'followup') { const p = it.p || {}, nm = p.name || p.email || 'a supporter'; out.push({ id: it.key, kind: 'followup', verb: `Follow up with ${nm}`, b: null, text: it.f?.what ? String(it.f.what) : 'You said you would follow up.', at: it.at }); }
    else if (it.kind === 'reply' && it.b) out.push({ id: it.key, kind: 'reply', verb: `Reply to ${it.from || 'a teammate'}`, b: it.b, text: `${it.from || 'A teammate'} asked: ${it.q || ''}` });
    else if (it.kind === 'rally' && it.b) out.push({ id: it.key, kind: 'rally', verb: 'Write the public ask', b: it.b, h: it.h, at: it.at, text: `${billName(it.b)} has a hearing${it.h ? ` ${dayTime(it.h.scheduled_at)}` : ''}. The public ask asks supporters to testify or show up.` });
  } });
  return out.map(x => ({ ...x, name: x.b ? billName(x.b) : '', no: x.b ? billNo(x.b) : '' }));
}

// The bills of the person's that are about to stop (standing.js: alive, want a hearing, none scheduled, 7 days or less), soonest first, and the steps that hold them.
export function riskFor(me, steps) {
  const bills = withMe(me, () => (S.bills || []).filter(b => b.tracked !== false && isMine(b) && isAmberRisk(b)))
    .sort((x, y) => riskDate(x).localeCompare(riskDate(y)) || String(x.bill_number).localeCompare(String(y.bill_number), 'en', { numeric: true }));
  const holds = s => (s.members ? s.members.map(x => x.bill) : [s.bill]).filter(b => bills.some(r => r.id === b.id));
  const held = steps.filter(s => s.kind === 'ask' && holds(s).length).sort((x, y) => (x.at ?? Infinity) - (y.at ?? Infinity));
  const step = held[0] || null;
  const bill = step ? holds(step)[0] : bills[0] || null;
  return { bills, step, bill, ids: new Set(steps.filter(s => s.kind === 'ask' && holds(s).length).map(s => s.id)) };
}

// Everything Home draws, for one person. `open` is their steps not yet finished in this visit.
export function homeModel(me, open) {
  const steps = open || stepsFor(me), hs = hearingsToday(me);
  const pd = x => x.type === 'step' && pastDue(x.s) ? 1 : 0;
  const todo = [...homeRows(steps).map(s => ({ type: 'step', s, t: s.at })), ...hs.map(hr => ({ type: 'hearing', hr, t: hr.at }))].sort((x, y) => (pd(y) - pd(x)) || (x.t ?? Infinity) - (y.t ?? Infinity));
  return { me, steps, todo, later: laterRows(steps), hearings: hs, waiting: waitingFor(me), suggested: suggestedFor(me), risk: riskFor(me, steps) };
}

// ---------------------------------------------------------------------------------- the left lists
const todoRow = (x, cur, m) => {
  if (x.type === 'step') return stepRow(x.s, cur === '#/do/' + enc(x.s.id), { risk: m.risk.ids.has(x.s.id) });
  const { hr } = x, href = `#/hearing/${enc(hr.id)}`, sel = cur === href;
  return `<li><a class="sr3${sel ? ' sel' : ''}"${sel ? ' aria-current="true"' : ''} href="${href}">${ic('calendar')}<span class="sv"><b>Hearing today</b> <span class="sep" aria-hidden="true">·</span> ${esc(hr.name)}&nbsp;<span class="no">${esc(hr.no)}</span></span><span class="stm">${esc(clock(hr.at))}</span></a></li>`;
};
const quietRow = (href, sel, icon, line1, no, line2html) => `<li><a class="sr3 q${sel ? ' sel' : ''}"${sel ? ' aria-current="true"' : ''} href="${href}">${ic(icon)}<span class="sv"><span class="q1">${line1}${no ? `&nbsp;<span class="no">${esc(no)}</span>` : ''}</span>${line2html ? `<span class="q2">${line2html}</span>` : ''}</span></a></li>`;
const toggle = (id, listId, open, words) => `<button class="btn text qt" type="button" id="${id}" aria-expanded="${open}" aria-controls="${listId}">${esc(words)}${ic('chevron-down')}</button>`;

export function listsHTML(m, cur) {
  const onOv = /^#?\/?$/.test(cur);
  const inLater = m.later.some(s => cur === '#/do/' + enc(s.id)), inSugg = m.suggested.some(x => cur === '#/suggested/' + enc(x.id));
  if (inLater && ui.laterOff !== cur) ui.later = true;   // a later step that is open shows its row, unless the person collapsed the line on this very page
  if (inSugg && ui.suggOff !== cur) ui.sugg = true;
  const laterOpen = ui.later, suggOpen = ui.sugg, none = !m.todo.length;
  let h = `<ul class="srows3 ovl"><li><a class="ovr${onOv ? ' sel' : ''}"${onOv ? ' aria-current="page"' : ''} href="#/">${ic('house')}<span class="sv"><b>Overview</b></span></a></li></ul>`;
  h += `<section aria-labelledby="hs"><h2 class="lh" id="hs">To do</h2>`;
  if (!none) h += `<ul class="srows3">${m.todo.map(x => todoRow(x, cur, m)).join('')}</ul>`;
  if (m.later.length) h += `<p class="qline">${toggle('laterBtn', 'laterList', laterOpen, none ? `Nothing today · ${laterWords(m.later)}` : laterWords(m.later))}</p><div id="laterList"${laterOpen ? '' : ' hidden'}><p class="llab">Later</p><ul class="srows3">${m.later.map(s => stepRow(s, cur === '#/do/' + enc(s.id), { quiet: true, risk: m.risk.ids.has(s.id) })).join('')}</ul></div>`;
  else if (none) h += `<p class="calmnote">All clear</p>`;
  h += '</section>';
  if (m.waiting.length) h += `<section aria-labelledby="hw" class="qsec"><h2 class="lh" id="hw">Waiting on others</h2><ul class="srows3">${m.waiting.map(w =>
    quietRow(`#/waiting/${enc(w.id)}`, cur === `#/waiting/${enc(w.id)}`, 'hourglass', `<b>${esc(w.name)}</b>`, w.no, waitHTML(w))).join('')}</ul></section>`;
  if (m.suggested.length) h += `<section aria-labelledby="hg" class="qsec"><h2 class="lh" id="hg">Suggested</h2><p class="qline">${toggle('suggBtn', 'suggList', suggOpen, `${m.suggested.length} suggested ${m.suggested.length === 1 ? 'step' : 'steps'}`)}</p><ul class="srows3" id="suggList"${suggOpen ? '' : ' hidden'}>${m.suggested.map(x =>
    quietRow(`#/suggested/${enc(x.id)}`, cur === `#/suggested/${enc(x.id)}`, 'lightbulb', `<b>${esc(x.verb)}</b>${x.name ? ` <span class="sep" aria-hidden="true">·</span> ${esc(x.name)}` : ''}`, x.no, '')).join('')}</ul></section>`;
  return h;
}
// The two collapsibles open and close in place: nothing is drawn again, so nothing typed on the page is lost. A person's collapse is kept by the minute's redraw.
export function bindHome() {
  for (const [id, key, off] of [['laterBtn', 'later', 'laterOff'], ['suggBtn', 'sugg', 'suggOff']]) {
    const b = document.getElementById(id); if (!b) continue;
    b.addEventListener('click', () => { const list = document.getElementById(b.getAttribute('aria-controls')); ui[key] = list.hidden; ui[off] = ui[key] ? '' : location.hash; list.hidden = !list.hidden; b.setAttribute('aria-expanded', String(ui[key])); });
  }
}

// ---------------------------------------------------------------------------------- the overview
const PART = () => { const hr = +new Date().toLocaleTimeString('en-US', { ...HST, hour: 'numeric', hourCycle: 'h23' }) % 24; return hr < 12 ? 'morning' : hr < 17 ? 'afternoon' : 'evening'; };
const SUN = '<svg class="calm-pic" viewBox="0 0 96 48" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 40h88"/><path d="M26 40a22 22 0 0 1 44 0"/><path d="M48 6v6M20 16l4 4M76 16l-4 4"/></svg>';

// The answer to "am I on top of it?": a line, and a second line that says what is first (a link to it). Past due outranks a bill about to stop, which outranks everything else.
export function headline(m) {
  const hi = `Good ${PART()}, ${esc(first(m.me))}.`, n = m.todo.length;
  const to = x => x.type === 'step' ? { href: '#/do/' + enc(x.s.id), text: `${x.s.verb} · ${x.s.name}` } : { href: '#/hearing/' + enc(x.hr.id), text: `Hearing today · ${x.hr.name}` };
  const behind = m.todo.filter(x => x.type === 'step' && pastDue(x.s)), rk = m.risk;
  if (behind.length) return { calm: false, h1: `${hi} ${behind.length === 1 ? 'One step is' : `${behind.length} steps are`} past due.`, lead: 'First up: ', link: to(behind[0]) };
  if (rk.bills.length) {
    const k = rk.bills.length, st = rk.step, many = st?.members?.length > 1, vote = st?.ask?.decide, thing = vote ? 'a vote' : 'a hearing';
    const by = st && st.at != null ? byWord(st.at) : dateWords(riskDate(rk.bill));
    // an amber conference or vote bill (Nate, 18 Nov) has no hearing to ask for: say what it needs, in its own words
    const why = !st ? riskWhy(rk.bill) : '';
    const text = many ? `Ask for ${vote ? 'votes' : 'hearings'} on ${st.members.length} bills by ${by}, or they stop for the year.` : why ? `${billName(rk.bill)}: ${why}, or it stops for the year.` : `Ask for ${thing} on ${billName(rk.bill)} by ${by}, or it stops for the year.`;
    return { calm: false, risk: true, h1: `${hi} ${k === 1 ? 'One bill is' : `${k} bills are`} at risk.`, lead: '', link: st ? { href: '#/do/' + enc(st.id), text } : null, plain: st ? '' : text };
  }
  if (n) return { calm: false, h1: `${hi} You’re on top of it.`, lead: 'First up: ', link: to(m.todo[0]) };
  // a calm day: the next later step, named, so the line never repeats the next-hearing fact; no later step, no line
  const nx = [...m.later].sort((x, y) => (x.at ?? Infinity) - (y.at ?? Infinity))[0];
  return { calm: true, h1: `${hi} Nothing needs you today.`, lead: '', link: null, plain: nx ? `Your next step is ${nx.verb} on ${nx.name}${nx.at != null ? `, ${shortDay(nx.at)}` : ''}.` : '' };
}

// The session's dates as a line, with "you are here" between the last one that has passed and the next. The words and the stops are words.js's, the same for everyone: a stop that
// touches none of the bills in `touch` (a Map from touchMap, or none) is greyed, not removed.
export { sessionDates };
export function sessionHTML(extra, touch = null) {
  const rows = sessionDates(extra); if (rows.length < 2) return '';
  const today = ymd(Date.now()), n = rows.length, t = Date.now(), at = r => new Date(r.date + 'T12:00:00-10:00').getTime();
  const past = rows.map(r => r.date < today), next = past.findIndex(p => !p), i = next < 0 ? n - 1 : next - 1;   // the last date that has passed (-1 before the first)
  let p;   // where "you are here" sits, in column units, by real time between two stops, and never nearer than a fifth of a column to a stop's dot
  if (i < 0) p = 0.3 * (1 - Math.min(1, (at(rows[0]) - t) / (30 * DAY)));
  else if (next < 0) p = n - 0.3 + 0.3 * Math.min(1, (t - at(rows[n - 1])) / (30 * DAY));
  else p = i + 0.7 + 0.6 * Math.min(1, Math.max(0, (t - at(rows[i])) / (at(rows[next]) - at(rows[i]))));
  const pct = Math.min(98, Math.max(2, (p / n) * 100));
  const lbl = next < 0 ? 'The session has ended' : `${rows[next].label} is ${dateWords(rows[next].date)}`;
  const you = '<li class="you" aria-hidden="true"><i class="dot"></i><b>You are here</b></li>';
  return `<section class="sess" aria-labelledby="sesh"><h2 class="fl" id="sesh">The session</h2><div class="sdl" style="--n:${n}"><span class="here" style="left:${pct.toFixed(1)}%"><span>You are here</span><i></i></span>`
    + `<ol class="sd" aria-label="The session’s dates. You are here. ${esc(lbl)}.">${rows.map((r, k) => `${k === (next < 0 ? n : next) ? you : ''}<li class="${[past[k] ? 'past' : k === next ? 'next' : '', touch && !(touch.get(r.key) || []).length ? 'off' : ''].filter(Boolean).join(' ')}"><i class="dot" aria-hidden="true"></i><b>${esc(r.label)}</b><span>${esc(dateWords(r.date))}</span>${touch && !(touch.get(r.key) || []).length ? '<span class="sr">No bill here is waiting on it.</span>' : ''}</li>`).join('')}${next < 0 ? you : ''}</ol></div></section>`;
}

// The overview in two parts (the greeting, then the facts and the session): one page on a laptop, and on a phone the lists come between them.
export function overviewParts(m) {
  const me = m.me, hl = headline(m), hr = nextHearing(me), standings = myIssueStandings(), tl = tally(standings);
  const day = new Date().toLocaleDateString('en-US', { ...HST, weekday: 'long', month: 'long', day: 'numeric' });
  const chev = ic('chevron-right', 'fchev');
  const fact = (href, label, v, mute, sub, vc = '') => `<a class="fact" href="${href}"><span class="fl">${label}</span><span class="fv${mute ? ' mutedv' : ''}${vc}">${v}</span><span class="fs">${sub}</span><span class="fgo">${chev}</span></a>`;
  // the three quiet facts: none repeats the To do list
  const f1 = hr ? fact('#/calendar', 'Your next hearing', esc(dayTime(hr.h.scheduled_at)), false, `${esc(brief(billName(hr.b)))} · ${esc(cmteWords(hr.h.committee))}`)
    : fact('#/calendar', 'Your next hearing', 'None after today', true, 'Nothing else on the calendar yet.');
  const need = withMe(me, () => (S.bills || []).filter(b => b.tracked !== false && isMine(b) && needsHearing(b)));
  const soon = need.map(b => deadlineOf(b)).sort((x, y) => x.date.localeCompare(y.date))[0];
  const f2 = need.length ? fact('#/issues', 'Your bills', `${need.length} ${need.length === 1 ? 'needs' : 'need'} a hearing`, false, `before ${esc(dateWords(soon.date))}`)
    : fact('#/issues', 'Your bills', 'All have a hearing or are past it', true, '');
  const bits = [];
  if (tl.risk) bits.push(['risk', `${ic('triangle-alert')}${tl.risk} at risk`]);
  if (tl.moving) bits.push(['', `${tl.moving} not at risk`]);
  if (tl.stopped) bits.push(['', `${tl.stopped} stopped`]);
  const parts = bits.map(([c, t], i) => `<span${c ? ` class="${c}"` : ''}>${t}${i < bits.length - 1 ? '<span class="dotsep" aria-hidden="true"> ·</span>' : ''}</span>`);
  const f3 = parts.length ? fact('#/issues', 'Your issues', parts.join(' '), false, '', ' iss') : fact('#/issues', 'Your issues', 'None followed yet', true, '');
  const sub = hl.link ? `<p class="ovsub">${esc(hl.lead)}<a class="ovlink" href="${hl.link.href}">${esc(hl.link.text)}</a></p>` : hl.plain ? `<p class="ovsub">${esc(hl.plain)}</p>` : '';
  const top = `<div class="ovtop"><p class="ovdate">${esc(day)}</p><div class="ovhd">${hl.calm ? SUN : ''}<div><h1 tabindex="-1">${hl.h1}</h1>${sub}</div></div></div>`;
  const rest = `<div class="ovrest"><div class="facts">${f1}${f2}${f3}</div>${sessionHTML(soon, touchMap(withMe(me, () => (S.bills || []).filter(b => b.tracked !== false && isMine(b)))))}</div>`;
  return { top, rest };
}
export function overviewSheet(m) { const { top, rest } = overviewParts(m); return `<div class="pn"><div class="ov">${top}${rest}</div></div>`; }

// ---------------------------------------------------------------------------------- the small read-only sheets
const kv = rows => `<dl class="kv">${rows.filter(Boolean).map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${v}</dd></div>`).join('')}</dl>`;
const TEST_WORDS = { draft: 'Being written', review: 'With an approver', second_review: 'Waiting for a second look', approved: 'Approved, ready to file', filed: 'Filed' };
export function hearingSheet(m, id) {
  const hr = m.hearings.find(x => x.id === id); if (!hr) return '';
  const { h, b } = hr, d = sittingDraft(h, b.id), same = m.hearings.filter(x => x.h.committee === h.committee && x.h.scheduled_at === h.scheduled_at && x.id !== id);
  const step = m.steps.find(s => s.hearing?.id === h.id && s.bill.id === b.id), going = attendees(h).map(first);
  const t = hr.at, when = `${dayTime(t)} · ${t > Date.now() ? `in ${left(t)}` : `${left(t)} ago`}`;
  return `<div class="pn">${band(issueOf(b), 'Hearing today', billName(b), billNo(b))}<div class="pbody">`
    + kv([['When', esc(when)], ['Where', esc(roomName(h.room) || 'No room is listed yet.')], ['Committee', esc(cmteWords(h.committee))],
      same.length ? ['Also on your bills', same.map(x => `${esc(x.name)}<span class="no"> ${esc(x.no)}</span>`).join('<br>')] : null,
      ['Our testimony', `${esc(d ? TEST_WORDS[d.status] || 'In progress' : 'Not started')}${step ? ` · <a class="btn text" href="#/do/${encodeURIComponent(step.id)}">Open the step</a>` : ''}`],
      ['Going', esc(going.length ? going.join(', ') : 'No one is marked as going yet.')]])
    + `</div></div>`;
}
export function waitingSheet(m, id) {
  const w = m.waiting.find(x => x.id === id); if (!w) return '';
  const url = w.d && String(w.d.doc_url || '').startsWith('https://docs.google.com/') ? w.d.doc_url : '';
  const doc = !w.d ? '' : !url ? fileRow(`Testimony to ${cmteWords(w.h?.committee)}`, 'The testimony’s link is missing.', '')
    : fileRow(`Testimony to ${cmteWords(w.h?.committee)}`, '', DEMO ? btn('Open the testimony', { kind: 'quiet', id: 'openDoc' }) : `<a class="btn quiet" id="openDoc" href="${esc(url)}" target="_blank" rel="noopener">Open the testimony</a>`);
  return `<div class="pn">${w.b ? band(issueOf(w.b), 'Waiting on others', w.name, w.no) : plainBand('Waiting on others', w.name)}<div class="pbody"><p class="lead">${esc(waitText(w))}</p>`
    + (w.h ? `<p class="hint hl0">${esc(hearingLine(w.h))}</p>` : '') + `<p class="lead mid">Nothing for you to do. It comes back to you if it needs you.</p>${doc}</div></div>`;
}
export function suggestedSheet(m, id, as) {
  const x = m.suggested.find(y => y.id === id); if (!x) return '';
  const href = `index.html?demo=1${as ? `&as=${encodeURIComponent(as)}` : ''}`;   // the current staff app's practice copy, in this tab
  return `<div class="pn">${x.b ? band(issueOf(x.b), x.verb, x.name, x.no) : plainBand(x.verb, '')}<div class="pbody"><p class="lead">${esc(x.text)}</p>`
    + `<p class="lead tight">This step does not have a page in the new app yet.</p><p class="lead">${btn('For now, do this in the current staff app', { kind: 'text', href })}</p></div></div>`;
}
export const bindWaiting = () => { const o = document.getElementById('openDoc'); if (o && DEMO) o.addEventListener('click', () => toast('In the practice copy the testimony does not open.')); };
