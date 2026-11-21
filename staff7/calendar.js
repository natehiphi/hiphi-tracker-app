// Staff7 Calendar (R-398, rules S-19, S-20): the week's hearings, where our letters stand for them, and the Capitol's session deadlines, for Mine, a teammate or Everyone (look only).
// Two ways to read the same week: the Week grid (the default on a laptop) and a List (the week day by day, the thing picked on the right). The phone is the List only. The address holds everything
// that changes the page (?who=, ?w= the Monday, ?view=list; the Week grid is the clean address) so Back and a shared link open the same week.
// In the Week grid a picked hearing, testimony time or deadline opens beside its own day (one narrow paper with that day's column, the sheet in all the rest of the width); the List keeps its left column.
// A sitting is every hearing row with one committee (its codes sorted, so WAM/CPN and CPN/WAM are one) and one start time; it is in a view when one of the set's alive bills is heard at it.
// A cancelled hearing, a dead bill's hearing and a repeated row (same bill, same time) are never drawn. Mine is the bills of my issues plus any bill I lead or follow, as Home's "next hearing" reads it.
// Nothing here writes anything.
import { S, isMine, SESSION_YEAR } from '../staff6/data.js';
import { goingIds, goingNames, changeGoing } from './do_file.js';
import { holdFor } from './do_check.js';   // a testimony held for a position change: its own step is Check your testimony, never File testimony
import { roomName, streamOf, hearingAhead, billRef, lateLine } from '../staff6/model.js';
import { whereWords, actBy } from '../staff6/steps.js';
import { ic } from './icons7.js';
import { esc, plainBand, keepWords, btn, toast } from './parts.js';
import { billName, billNo, cmteWords, dayTime, first, LABEL } from './steps.js';
import { isAlive, isAtRisk } from './standing.js';
import { dateWords, whenWords, nameOf, daysTo } from './words.js';
import { boxHTML } from './find.js';
import { cap, testimonyWords, draftFor, letterState } from './bill_words.js';
import { whoOf, setFor, sessionOf, posLine, stepOn, testimonyDue, tint, bindIssues, ui } from './issues.js';

const enc = encodeURIComponent;
const HST = { timeZone: 'Pacific/Honolulu' };
const DAY = 864e5;
const ymd = t => new Date(t).toLocaleDateString('en-CA', HST);
const noon = d => new Date(d + 'T12:00:00-10:00').getTime();
const addDays = (d, k) => ymd(noon(d) + k * DAY);
const dow = d => new Date(noon(d)).getUTCDay();   // 0 Sunday
const mondayOf = d => addDays(d, -((dow(d) + 6) % 7));
const clock = t => new Date(t).toLocaleTimeString('en-US', { ...HST, hour: 'numeric', minute: '2-digit' }).replace(/[  ]/g, ' ');
const fmt = (d, o) => new Date(noon(d)).toLocaleDateString('en-US', { ...HST, ...o });
const num = b => String(b.bill_number).replace(/\s/g, '');
const byNo = (x, y) => num(x).localeCompare(num(y), 'en', { numeric: true });
const n = (k, one, many) => `${k} ${k === 1 ? one : many}`;
const validDay = d => /^\d{4}-\d{2}-\d{2}$/.test(d || '') && !Number.isNaN(noon(d)) && ymd(noon(d)) === d;
const wdClock = t => `${new Date(t).toLocaleDateString('en-US', { ...HST, weekday: 'short' })} ${clock(t)}`;   // "Sun 3:00 PM"
const http = u => /^https?:\/\//i.test(String(u || '').trim());
// "Mar 16 – 20", or "Mar 30 – Apr 3" when it crosses a month
const rangeOf = (a, z) => { const x = fmt(a, { month: 'short', day: 'numeric' }); return a === z ? x : fmt(a, { month: 'short' }) === fmt(z, { month: 'short' }) ? `${x} – ${fmt(z, { day: 'numeric' })}` : `${x} – ${fmt(z, { month: 'short', day: 'numeric' })}`; };
// one committee and one instant: a joint hearing listed as WAM/CPN and as CPN/WAM is the same sitting
const sitKey = h => `${String(h.committee || '').split('/').map(c => c.trim()).filter(Boolean).sort().join('/')}|${new Date(h.scheduled_at).toISOString()}`;
// a testimony time that falls on a weekend is shown on the Monday it serves
const shown = d => dow(d) === 6 ? addDays(d, 2) : dow(d) === 0 ? addDays(d, 1) : d;

// ---------------------------------------------------------------------------------- the set: my issues' bills plus any bill I lead or follow
function withLeads(set, who, me) {
  if (who.kind === 'all') return set;
  const p = who.kind === 'person' ? who.person : me; if (!p) return set;
  const have = new Set(set.flatMap(x => x.bills.map(b => b.id))), prev = [S.me, S.follows], extra = [];
  try {
    S.me = p; if (p !== prev[0]) S.follows = new Set(Object.entries(S.followersBy || {}).filter(([, ids]) => ids.includes(p.id)).map(([id]) => id));
    for (const b of S.bills || []) if (b.tracked !== false && (!b.session_year || +b.session_year === +SESSION_YEAR) && !have.has(b.id) && isMine(b)) extra.push(b);
  } finally { [S.me, S.follows] = prev; }
  const by = new Map();
  for (const b of extra) {
    const link = (S.billIssues || []).find(x => x.bill_id === b.id && (S.issues || []).some(i => i.id === x.issue_id && !i.archived_at));
    const issue = link ? S.issues.find(i => i.id === link.issue_id) : { id: null, name: '' }, k = String(issue.id);
    if (!by.has(k)) by.set(k, { issue, bills: [], standing: null }); by.get(k).bills.push(b);
  }
  return [...set, ...by.values()];
}

// ---------------------------------------------------------------------------------- what the week holds, for a set
function sittingsOf(ses) {
  const byId = new Map(ses.bills.filter(x => isAlive(x.b)).map(x => [x.b.id, x])), seen = new Set(), by = new Map();
  for (const h of S.hearings || []) {
    const x = byId.get(h.bill_id), t = new Date(h.scheduled_at).getTime();
    if (!x || h.status === 'cancelled' || Number.isNaN(t)) continue;
    const dup = h.bill_id + '|' + new Date(t).toISOString(); if (seen.has(dup)) continue; seen.add(dup);
    const k = sitKey(h); if (!by.has(k)) by.set(k, { key: k, h, t, day: ymd(t), rows: [] });
    by.get(k).rows.push({ h, b: x.b, issue: x.issue, due: testimonyDue(h) });
  }
  for (const s of by.values()) s.rows.sort((p, q) => byNo(p.b, q.b));
  return [...by.values()].sort((p, q) => p.t - q.t || String(p.h.committee).localeCompare(String(q.h.committee)));
}
// Testimony times: one per sitting and due time (the bills of a sitting almost always share one)
function dueOf(sits) {
  const out = [];
  for (const s of sits) { const g = new Map(); for (const r of s.rows) { const k = Math.round(r.due); if (!g.has(k)) g.set(k, { sit: s, due: k, rows: [] }); g.get(k).rows.push(r); } out.push(...g.values()); }
  return out.sort((p, q) => p.due - q.due || p.sit.t - q.sit.t);
}
// The one word for one state in staff7: "second look" (the step's name), never the data layer's older "second review"
const words = l => String(l || '').replace(/second review/gi, m => m[0] === 'S' ? 'Second look' : 'second look');
// Where a bill's letter stands for a hearing: the data layer's own state ({ key, label, back (sent back to fix), fresh (not started) }), never the clock's
const stateOf = (h, b) => { const s = letterState(h, b); return { key: s.key, label: words(s.label || 'Not started'), back: s.back, fresh: s.fresh }; };
// a sentence about the letter itself
const letterWords = st => cap(testimonyWords(st));   // the one wording, bill_words.js; a sentence about the testimony itself starts with a capital
// How a testimony time reads, by where the letters stand: all filed (neutral, a check); not filed with the hearing still ahead and the time gone (amber: late, still accepted); not filed and the
// hearing gone (neutral: Missed); else neutral, the state in words. `what` is for one bill, `sum` for the sitting's bills, `line` the row's second line.
function infoOf(g, now = Date.now()) {
  const st = g.rows.map(r => stateOf(r.h, r.b)), k = st.length, filed = st.filter(x => x.key === 'filed').length, all = filed === k, ahead = g.sit.t > now, gone = g.due <= now;
  const tone = all ? 'done' : !ahead ? 'missed' : gone ? 'late' : 'plain';
  const what = st[0].key === 'filed' ? 'Filed' : tone === 'missed' ? 'Missed' : tone === 'late' ? lateLine(g.sit.t) : st[0].label;
  const part = all ? 'all filed' : filed ? `${filed} of ${k} filed` : '';
  const tail = !all && tone === 'late' ? lateLine(g.sit.t) : !all && tone === 'missed' ? 'Missed' : !part ? 'not filed yet' : '';
  const sum = k === 1 ? `1 bill · ${what}` : `${k} bills · ${[part, tail].filter(Boolean).join(' · ')}`;
  const line = k === 1 ? `${billName(g.rows[0].b)} · ${what}` : sum;
  return { tone, what, sum, line, icon: tone === 'done' ? 'check' : tone === 'late' ? 'triangle-alert' : '' };
}

// ---------------------------------------------------------------------------------- the model
export function calendarModel({ me, open, rt, people, phone }) {
  const who = whoOf(rt.q.get('who'), me, people), mine = { kind: 'mine', code: '' }, useWho = who.bad ? mine : who;
  const set = withLeads(setFor(useWho, me), useWho, me), ses = sessionOf(set), sits = sittingsOf(ses), today = ymd(Date.now()), thisMon = mondayOf(today);
  const view = !phone && rt.q.get('view') !== 'list' ? 'week' : 'list';
  const id = rt.id || '', sitId = id.startsWith('sitting/') ? id.slice(8) : '', tdId = id.startsWith('testimony/') ? id.slice(10) : '', dlId = id.startsWith('deadline/') ? id.slice(9) : '';
  const pickSit = sitId || tdId ? sits.find(s => s.key === (sitId || tdId)) : null, pickTd = tdId && pickSit ? dueOf([pickSit])[0] : null;
  let wk = thisMon; const wq = rt.q.get('w');
  if (validDay(wq)) { const m = mondayOf(wq); if (Math.abs(noon(m) - noon(thisMon)) <= 60 * 7 * DAY) wk = m; }
  if (pickTd) wk = mondayOf(shown(ymd(pickTd.due))); else if (pickSit) wk = mondayOf(pickSit.day);   // a picked thing is always on the week the left shows
  const whose = who.kind === 'mine' ? 'your bills' : who.kind === 'all' ? 'everyone’s bills' : `${first(who.person)}’s bills`;
  const lastDay = addDays(wk, 6), inWeek = d => d >= wk && d <= lastDay;
  const weekSits = sits.filter(s => inWeek(s.day)), tds = dueOf(sits).filter(g => inWeek(shown(ymd(g.due)))), dls = ses.rows.filter(r => inWeek(r.date));
  const days = [0, 1, 2, 3, 4, 5, 6].map(i => addDays(wk, i)).map(d => {
    const sd = weekSits.filter(s => s.day === d), td = tds.filter(g => shown(ymd(g.due)) === d), dl = dls.filter(r => r.date === d);
    return { d, dls: dl, items: [...sd.map(s => ({ t: s.t, s })), ...td.map(g => ({ t: g.due, g }))].sort((p, q) => p.t - q.t || (p.s ? 0 : 1) - (q.s ? 0 : 1)) };
  }).filter((x, i) => i < 5 || x.dls.length || x.items.some(y => y.s));   // a weekend day only for a hearing or a deadline
  const empty = !weekSits.length && !tds.length;

  // ---- addresses: who, week and view stay in the address; the defaults (Mine, this week, the Week grid) leave it clean
  const q = (x = {}) => { const p = new URLSearchParams(), w = x.w || wk, v = x.view || view, c = x.who === undefined ? who.code : x.who;
    if (c) p.set('who', c); if (w !== thisMon) p.set('w', w); if (v === 'list' && !phone) p.set('view', 'list'); const s = p.toString(); return s ? `?${s}` : ''; };
  const href = (path = '', x) => `#/calendar${path}${q(x)}`;
  const sitHref = s => href(`/sitting/${enc(s.key)}`), tdHref = s => href(`/testimony/${enc(s.key)}`), dlHref = r => href(`/deadline/${enc(r.key)}`), weekHref = href('/week');
  const listHref = href('', { view: 'list' }), gridHref = href('', { view: 'week' }), hereHref = href('');

  // ---- what is picked: a sitting, its testimony, a deadline, the week's summary, or (nothing in the address) the next sitting from now, else the summary
  let kind = 'week', item = null, notFoundWhat = '';
  if (who.bad) notFoundWhat = 'that list';
  else if (id === '') { const next = wk === thisMon ? weekSits.find(s => s.t >= Date.now()) : weekSits[0]; if (next) { kind = 'sitting'; item = next; } }
  else if (id === 'week') kind = 'week';
  else if (sitId) { if (pickSit) { kind = 'sitting'; item = pickSit; } else notFoundWhat = 'that hearing'; }
  else if (tdId) { if (pickTd) { kind = 'testimony'; item = pickSit; } else notFoundWhat = 'that testimony time'; }
  else if (dlId) { const r = ses.rows.find(x => x.key === dlId); if (r) { kind = 'deadline'; item = r; } else notFoundWhat = 'that deadline'; }
  else notFoundWhat = 'that part of Calendar';
  const okPick = !notFoundWhat;

  // ---- the controls: the whose switch as Issues has it; the List | Week switch on the title line, last, in both views
  const seg = (sid, label, on, h) => `<a class="seg" id="${sid}" href="${h}"${on ? ' aria-current="true"' : ''}>${label}</a>`;
  const mate = who.kind === 'person', pickOpen = ui.pick || false;
  const mates = people.filter(a => (!me || a.id !== me.id) && a.is_active !== false).sort((p, r) => String(p.full_name).localeCompare(String(r.full_name), 'en'));
  const whoSwitch = `<div class="segs3" role="group" aria-label="Whose calendar">${seg('whoMine', 'Mine', who.kind === 'mine' && !who.bad, href('', { who: '' }))}`
    + `<button class="seg" type="button" id="whoMate" aria-expanded="${pickOpen}" aria-controls="whoPick"${mate ? ' aria-current="true"' : ''}>A teammate</button>${seg('whoAll', 'Everyone', who.kind === 'all', href('', { who: 'all' }))}</div>`
    + `<ul class="whopick" id="whoPick" aria-label="Which teammate"${pickOpen ? '' : ' hidden'}>${mates.map(a => `<li><a class="pk${mate && who.person.id === a.id ? ' on' : ''}" id="who-${esc(String(a.initials).replace(/[^A-Za-z0-9]/g, ''))}" href="${href('', { who: a.initials })}"${mate && who.person.id === a.id ? ' aria-current="true"' : ''}>${esc(a.full_name)}</a></li>`).join('')}</ul>`;
  const viewSwitch = phone ? '' : `<div class="segs3 vsw" role="group" aria-label="How to see the week">${seg('viewList', 'List', view === 'list', listHref)}${seg('viewWeek', 'Week', view === 'week', gridHref)}</div>`;
  const weekNav = `<div class="wknav"><a class="btn text" id="wkPrev" href="${href('', { w: addDays(wk, -7) })}">${ic('chevron-left')}Previous week</a>`
    + `${wk !== thisMon ? `<a class="btn text" id="wkNow" href="${href('', { w: thisMon })}">This week</a>` : ''}<a class="btn text" id="wkNext" href="${href('', { w: addDays(wk, 7) })}">Next week${ic('chevron-right')}</a></div>`;
  const title = mate ? `${first(who.person)}’s calendar` : who.kind === 'all' ? 'Everyone’s calendar' : 'Calendar';
  const lookOnly = who.kind === 'mine' ? '' : who.kind === 'all' ? 'Everyone’s calendar. Look only.' : `${first(who.person)}’s calendar. Look only.`;
  const header = `<header class="ihead"><div class="ihl"><h2 class="ihd" id="ihd">${esc(title)}</h2>${mate ? '<button class="btn text chg" type="button" id="whoChange" aria-controls="whoPick">Change</button>' : ''}${viewSwitch}</div>${whoSwitch}${boxHTML({ who: who.code })}${weekNav}</header>`;

  // ---- the left column: the row you click is the row marked
  const sitRow = s => { const on = okPick && kind === 'sitting' && item.key === s.key;
    return `<li><a class="sr3 ir cal${on ? ' sel' : ''}"${on ? ' aria-current="true"' : ''} data-sit="${esc(s.key)}" href="${sitHref(s)}"><span class="imark" style="--ic:var(--act)" aria-hidden="true">${ic('calendar')}</span>`
      + `<span class="sv"><b>${esc(clock(s.t))} · ${esc(cmteWords(s.h.committee))}</b><span class="ir2">${esc(n(s.rows.length, 'bill', 'bills'))}</span></span></a></li>`; };
  const dueWord = t => t <= Date.now() ? 'Testimony was due' : 'Testimony due';
  const tdRow = (g, moved) => { const on = okPick && kind === 'testimony' && item.key === g.sit.key, i = infoOf(g);
    return `<li><a class="sr3 ir cal${on ? ' sel' : ''}"${on ? ' aria-current="true"' : ''} data-td="${esc(g.sit.key)}" href="${tdHref(g.sit)}"><span class="imark" style="--ic:var(--act)" aria-hidden="true">${ic('clock')}</span>`
      + `<span class="sv"><b>${dueWord(g.due)} <span class="nb">${esc(moved ? wdClock(g.due) : clock(g.due))}</span></b><span class="ir2 tdst st-${i.tone}${i.tone === 'late' ? ' risk' : ''}">${i.icon ? ic(i.icon) : ''}<span>${keepWords(esc(i.line))}</span></span></span></a></li>`; };
  const dlRow = r => { const on = okPick && kind === 'deadline' && item.key === r.key;
    return `<li><a class="sr3 ir cal${on ? ' sel' : ''}"${on ? ' aria-current="true"' : ''} data-dl="${esc(r.key)}" href="${dlHref(r)}"><span class="imark" style="--ic:var(--act)" aria-hidden="true">${ic('flag')}</span><span class="sv"><b>${esc(r.label)}</b><span class="ir2">Capitol deadline</span></span></a></li>`; };
  const itemRow = (x, d) => x.s ? sitRow(x.s) : tdRow(x.g, ymd(x.g.due) !== d);
  const daysHTML = days.filter(x => !empty || x.dls.length).map(x => `<section aria-labelledby="d-${x.d}"><h3 class="glab" id="d-${x.d}">${esc(whenWords(x.d))}</h3>`
    + (x.dls.length || x.items.length ? `<ul class="srows3">${x.dls.map(dlRow).join('')}${x.items.map(y => itemRow(y, x.d)).join('')}</ul>` : '<p class="hint nothing">Nothing scheduled</p>') + '</section>').join('');
  const weekOn = okPick && kind === 'week';
  const weekRow = `<ul class="srows3 sessrow"><li><a class="sr3 ir${weekOn ? ' sel' : ''}"${weekOn ? ' aria-current="true"' : ''} id="weekRow" href="${weekHref}"><span class="imark" style="--ic:var(--act)" aria-hidden="true">${ic('calendar')}</span><span class="sv"><b>The week</b><span class="ir2">${esc(rangeOf(wk, addDays(wk, 4)))}${wk === thisMon ? ' · this week' : ''}</span></span></a></li></ul>`;
  const emptyLine = empty ? `<p class="calmnote" id="calEmpty">No hearings for ${esc(whose)} this week.</p>` : '';
  const grid = view === 'week' && !phone;
  const col = grid ? `${header}${emptyLine}` : `${header}${weekRow}${emptyLine}${daysHTML}`;

  // ---- the sheets
  const notFound = () => `<div class="pn" data-notfound="1">${plainBand(`We could not find ${notFoundWhat}.`, 'It may have been renamed, or it is not on the practice copy.')}<div class="pbody"><p class="lead"><a class="btn text" href="${hereHref}">Back to Calendar</a></p></div></div>`;
  const kv = rows => `<dl class="kv">${rows.filter(Boolean).map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${v}</dd></div>`).join('')}</dl>`;
  const line = (t, cls = '') => `<p class="${cls}">${t}</p>`;
  const stLine = (st, s, r, several) => { const now = Date.now(), late = s.t > now && r.due <= now && st.key !== 'filed';   // the late line: with one bill the readiness block says it, with several only the late bills carry it
    return `<p class="bst">${st.key === 'filed' ? ic('check') : ''}<span>${esc(letterWords(st))}</span></p>` + (late && several ? `<p class="bst riskt">${ic('triangle-alert')}<span>${esc(lateLine(s.t))}</span></p>` : ''); };
  const billHrefOf = (b, issue) => { const p = new URLSearchParams(); if (who.code) p.set('who', who.code); if (issue?.id != null) p.set('i', issue.id); p.set('from', 'calendar'); const s = p.toString(); return `#/bill/${billRef(b).split('/').map(enc).join('/')}${s ? `?${s}` : ''}`; };
  const billLi = (b, issue, lines, move, links = '') => `<li class="brow" style="${tint(issue || {})}"><div class="bmain"><a class="bn2" href="${billHrefOf(b, issue)}">${esc(billName(b))}<span class="bno">${esc(billNo(b))}</span></a>${lines}${links}${move}</div></li>`;
  // the viewer's step on a bill: for a held testimony, the check step (File testimony is held, so it is never offered)
  const stepHere = b => (open || []).find(s => s.kind === 'check' && s.bill?.id === b.id) || stepOn((open || []).filter(s => !(s.kind === 'file' && s.draft && holdFor(b, s.draft))), b);
  const moveOf = (b, onlyRisk, skipId) => { const st = who.kind === 'mine' && (!onlyRisk || isAtRisk(b)) ? stepHere(b) : null; return st && st.id !== skipId ? `<a class="btn quiet ymove" href="#/do/${enc(st.id)}">Your move · ${esc(st.verb)}</a>` : ''; };
  const issueHrefOf = issue => issue?.id != null ? `#/issue/${enc(issue.id)}${who.code ? `?who=${enc(who.code)}` : ''}` : '';
  const extLink = (url, label) => `<a class="bl" target="_blank" rel="noopener" href="${esc(url)}">${esc(label)}${ic('external-link')}</a>`;
  // one quiet row of links under a bill: its letter, its page here, its issue, the Capitol's page. They sit above the row's whole-row link.
  const linksRow = (b, issue, h) => { const d = h ? draftFor(h, b) : null, out = [];
    if (d && http(d.doc_url)) out.push(extLink(d.doc_url, 'Open the testimony'));
    out.push(`<a class="bl" href="${billHrefOf(b, issue)}">Bill page</a>`);
    if (issue?.id != null) out.push(`<a class="bl" href="${issueHrefOf(issue)}">Issue page</a>`);
    if (http(b.state_url)) out.push(extLink(b.state_url, 'On the Capitol site'));
    return `<p class="blinks">${out.join('')}</p>`; };

  // ---- a day's column, as the grid draws it; `pk` names the picked card (the day paper marks it)
  const nmsOf = s => { const nm = s.rows.map(r => billName(r.b)); return nm.slice(0, 3).map(x => `<span class="cgn nm" title="${esc(x)}">${esc(x)}</span>`).join('') + (nm.length > 3 ? `<span class="cgn">+${nm.length - 3} more</span>` : ''); };
  const colHTML = (x, pk, quiet) => { const t = x.d === today, cur = on => on ? ' aria-current="true"' : '';
    return `<section class="cgcol${t ? ' today' : ''}" aria-labelledby="g-${x.d}"><h3 class="cgd${quiet ? ' vh' : ''}" id="g-${x.d}">${esc(fmt(x.d, { weekday: 'short' }))}<span>${esc(fmt(x.d, { month: 'short', day: 'numeric' }))}${t ? ' · today' : ''}</span></h3>`
      + x.dls.map(r => `<a class="cgc dl"${cur(pk?.dl === r.key)} data-dl="${esc(r.key)}" href="${dlHref(r)}">${ic('flag')}<span>${esc(r.label)}</span></a>`).join('')
      + x.items.map(y => { if (y.s) return `<a class="cgc sit"${cur(pk?.sit === y.s.key)} data-sit="${esc(y.s.key)}" href="${sitHref(y.s)}"><span class="cgt"><b class="nb">${esc(clock(y.s.t))}</b> · ${esc(cmteWords(y.s.h.committee))}</span>${nmsOf(y.s)}</a>`;
        const g = y.g, i = infoOf(g), moved = ymd(g.due) !== x.d;
        return `<a class="cgc td st-${i.tone}"${cur(pk?.td === g.sit.key && pk.due === g.due)} data-td="${esc(g.sit.key)}" href="${tdHref(g.sit)}"><span class="cgt">${ic('clock')}${g.due <= Date.now() ? 'Was due' : 'Due'} <span class="nb">${esc(moved ? wdClock(g.due) : clock(g.due))}</span></span><span class="cgn tdst st-${i.tone}">${i.icon ? ic(i.icon) : ''}<span>${esc(i.line)}</span></span></a>`; }).join('')
      + (x.dls.length || x.items.length || empty ? '' : '<p class="hint nothing">Nothing scheduled</p>') + '</section>'; };

  // ---- Week view, something picked: the day it sits on in the grid, and the paper that holds that day
  const gridHome = grid && (id === '' || id === 'week') && okPick;
  let pickDay = null, pk = null;
  if (grid && okPick && !gridHome) {
    if (kind === 'sitting') { pickDay = item.day; pk = { sit: item.key }; }
    else if (kind === 'testimony') { pickDay = shown(ymd(pickTd.due)); pk = { td: item.key, due: pickTd.due }; }
    else if (kind === 'deadline') { pickDay = item.date; pk = { dl: item.key }; }
  }
  const dayPaper = () => { const i = days.findIndex(x => x.d === pickDay), x = days[i]; if (!x) return '';
    const has = z => z.dls.length || z.items.length, go = z => { const h0 = z.items.find(y => y.s); return h0 ? sitHref(h0.s) : z.dls.length ? dlHref(z.dls[0]) : tdHref(z.items[0].g.sit); };
    const prev = days.slice(0, i).reverse().find(has), next = days.slice(i + 1).find(has);
    const wd = z => fmt(z.d, { weekday: 'short' });
    const arrow = (z, label, icon, aid) => z ? `<a class="dpa" id="${aid}" aria-label="${label}, ${esc(dateWords(z.d))}" href="${go(z)}">${icon === 'chevron-left' ? ic(icon) : ''}<span>${esc(wd(z))}</span>${icon === 'chevron-right' ? ic(icon) : ''}</a>` : `<span class="dpa off" id="${aid}" role="link" aria-disabled="true" aria-label="${label}">${ic(icon)}</span>`;
    return `<aside class="dayp" aria-label="The day"><p class="dpk">Calendar</p><h2 class="dph" id="dayH">${esc(dateWords(x.d))}${x.d === today ? ' · today' : ''}</h2>`
      + `<div class="dpn">${arrow(prev, 'Earlier day', 'chevron-left', 'dayPrev')}${arrow(next, 'Later day', 'chevron-right', 'dayNext')}<a class="btn text" id="dayWeek" href="${gridHref}">Whole week</a></div>${colHTML(x, pk, true)}</aside>`; };
  const closeX = () => '';   // R-398 (Nate 20 Nov): the frame's top row has the Close X (and Back to Calendar) on every opened page
  const fact = (icon, html) => `<span class="fact">${ic(icon)}${html}</span>`;
  const band = (kicker, h1, facts) => `<div class="hband neutral cal"><div class="ht">${kicker}<h1 tabindex="-1">${esc(h1)}</h1><div class="facts">${facts}</div></div>${closeX()}</div>`;
  const rel = day => { const k = daysTo(day); return k < 0 ? `was ${dateWords(day)}` : k === 0 ? 'today' : k === 1 ? 'tomorrow' : `in ${k} days`; };
  const dayWord = t => { const k = daysTo(ymd(t)); return k === 0 ? `today ${clock(t)}` : k === 1 ? `tomorrow ${clock(t)}` : dayTime(t); };

  // ---- are we ready: the data layer's own letter states for the sitting's bills, never the clock alone
  const readyOf = (s, tdPage) => {
    const now = Date.now(), rows = s.rows.map(r => ({ r, st: stateOf(r.h, r.b) })), k = rows.length, un = rows.filter(x => x.st.key !== 'filed'), filed = k - un.length, ahead = s.t > now;
    let tone = 'plain', icon = '', head, say = '', late = false, cap2 = '';
    if (!un.length) { tone = 'done'; icon = 'check'; head = k === 1 ? 'Filed' : `All ${k} testimonies filed`; say = 'Nothing is needed for this hearing.'; }
    else if (!ahead) { tone = 'missed'; head = filed ? `${filed} of ${k} filed` : 'Missed'; say = filed ? 'The hearing has passed. The rest were not filed.' : 'The hearing has passed and no testimony was filed.'; }
    else {
      const first1 = Math.min(...un.map(x => x.r.due)), cat = x => x.st.key === 'write' && x.st.back ? 'back' : x.st.key, keys = [...new Set(un.map(cat))], c = un.length;
      const say1 = { write: `${n(c, 'testimony', 'testimonies')} still to write`, file: `${c === 1 ? '1 testimony is' : `${c} testimonies are`} ready to file`, held: `${n(c, 'testimony', 'testimonies')} held until ${c === 1 ? 'it is' : 'they are'} checked`, approve: `${n(c, 'testimony', 'testimonies')} waiting for approval`, second: `${n(c, 'testimony', 'testimonies')} waiting for a second look`, back: `${n(c, 'testimony', 'testimonies')} sent back to fix` };
      head = filed ? `${filed} of ${k} filed` : keys.length === 1 && say1[keys[0]] ? say1[keys[0]] : `${n(c, 'testimony', 'testimonies')} not filed yet`;
      if (first1 <= now) { late = true; tone = 'late'; icon = 'triangle-alert'; const nl = un.filter(x => x.r.due <= now).length; say = k === 1 ? `${lateLine(s.t)}.` : `${nl === k ? `All ${k}` : `${nl} of ${k}`} ${lateLine(s.t, { lower: true })}.`; }
      else {   // the team's time first, as the step's own due strip says it (actBy: the same function the File step uses), then the Capitol's deadline
        const row = un.find(x => x.r.due === first1), kind = row.st.key === 'held' ? 'file' : row.st.key, a = actBy({ kind, due: first1 }), L = LABEL[kind] || 'Due';
        say = a.kind === 'hand' ? `${L} by ${dayTime(a.at)}.` : `${L} now.`; cap2 = `The Capitol’s deadline is ${dayTime(first1)}.`; }
    }
    // the one step of the viewer's own, on their own calendar only; nobody else's calendar ever links to a step
    const mine = who.kind === 'mine' ? un.map(x => ({ x, st: stepHere(x.r.b) })).filter(z => z.st).sort((p, q) => p.x.r.due - q.x.r.due) : [];
    const go = mine[0]?.st || null; let extra = '';
    if (who.kind === 'mine' && un.length && !go && ahead) extra = un.some(x => x.st.key === 'approve' || x.st.key === 'second') ? ` It waits on someone else: ${[...new Set(un.filter(x => x.st.key === 'approve' || x.st.key === 'second').map(x => x.st.label.toLowerCase()))].join(', ')}.` : ' Nothing else is needed from you for this hearing.';
    return { tone, icon, head, say: say + extra, cap2, late, go };
  };
  const readyBlock = rd => `<section class="rdy t-${rd.tone}" aria-labelledby="rdyK"><h2 class="rdyk" id="rdyK">Are we ready?</h2><p class="rdyh">${rd.tone === 'done' ? ic('check') : ''}<span>${esc(rd.head)}</span></p>`
    + `<p class="rdys${rd.late ? ' riskt' : ''}">${rd.late ? ic('triangle-alert') : ''}<span>${esc(rd.say)}</span></p>${rd.cap2 ? `<p class="rdys">${esc(rd.cap2)}</p>` : ''}${rd.go ? `<a class="btn filled" id="rdyGo" href="#/do/${enc(rd.go.id)}">${esc(rd.go.verb)}</a>` : ''}</section>`;

  // ---- the right column: the other bills at this sitting, and the committee
  const legLink = l => http(l.capitol_url) ? `<a class="lk" target="_blank" rel="noopener" href="${esc(l.capitol_url)}">${esc(l.name)}</a>` : esc(l.name);
  const cmteOf = code => { const c = S.committees?.[code]; if (!c) return null;
    const ms = (S.committeeMembers || []).filter(m => m.committee === code).map(m => ({ role: m.role, l: (S.legislators || []).find(l => l.id === m.legislator_id) })).filter(x => x.l);
    const chairs = ms.filter(x => x.role === 'chair'), vices = ms.filter(x => x.role === 'vice_chair'), rest = ms.filter(x => x.role !== 'chair' && x.role !== 'vice_chair');
    return { code, name: cmteWords(code), chairs, vices, rest, count: ms.length }; };
  const nameList = nm => nm.length > 1 ? `${nm.slice(0, -1).join(', ')} and ${nm[nm.length - 1]}` : nm[0] || '';
  const nbn = x => `<span class="nb">${esc(x)}</span>`;
  const foldOf = (key, title, sum, body) => `<section class="fold"><h2 class="fh"><button class="fbtn" type="button" id="fbtn-${key}" data-fold="${key}" aria-expanded="false" aria-controls="fold-${key}"><span class="ft">${esc(title)}</span><span class="fs">${sum}</span>${ic('chevron-down')}</button></h2><div class="fbody" id="fold-${key}" hidden>${body}</div></section>`;

  // "Who is going" (R-398 gap A): the same attendance the File testimony step reads. Buttons only on a hearing page of the viewer's own calendar; an admin may also add a teammate (DB.attend takes who).
  const goingBlock = h => {
    const pickOpen = ui.goPick === String(h.id);
    const ids = goingIds(h), mine = ids.includes(S.me?.id), names = goingNames(ids) || 'Nobody yet';
    if (lookOnly) return `<div class="going" id="going"><div class="gwho"><span class="gk">Who is going</span><b>${esc(names)}</b></div></div>`;
    const staff = (S.advocates || []).filter(a => a.is_active !== false || ids.includes(a.id)).sort((x, y) => (x.id === S.me?.id ? -1 : y.id === S.me?.id ? 1 : 0) || String(x.full_name).localeCompare(String(y.full_name)));
    const add = S.me?.is_admin ? btn('Add a teammate', { kind: 'quiet', id: 'goAdd', attrs: `aria-expanded="${pickOpen}" aria-controls="goPick"` }) : '';
    return `<div class="going" id="going" data-h="${esc(String(h.id))}"><div class="gorow"><div class="gwho"><span class="gk">Who is going</span><b>${esc(names)}</b></div>`
      + `<div class="gact">${btn(mine ? 'Not going' : 'I’m going', { kind: 'quiet', id: 'goBtn' })}${add}</div></div>`
      + (add ? `<div class="gpick" id="goPick" role="group" aria-label="Who is going?"${pickOpen ? '' : ' hidden'}><p class="panx"><b>Who is going?</b><button class="xbtn sm" type="button" id="goPickX" aria-label="Close the list of teammates">${ic('x')}</button></p>`
        + `<ul class="whopick">${staff.map(a => `<li><button class="btn quiet pk${ids.includes(a.id) ? ' on' : ''}" type="button" data-who="${esc(String(a.id))}" aria-pressed="${ids.includes(a.id)}">${ids.includes(a.id) ? ic('check') : ''}${esc(a.id === S.me?.id ? `${a.full_name} (you)` : a.full_name)}</button></li>`).join('') || '<li class="hint">There is no one on the team yet.</li>'}</ul></div>` : '') + '</div>';
  };
  const sittingSheet = (s, tdPage) => {
    const h = s.h, watch = streamOf(h), rd = readyOf(s, tdPage), dues = [...new Set(s.rows.map(r => Math.round(r.due)))], one = dues.length === 1, pt = tdPage ? dueOf([s])[0] : null;
    const kicker = `<p class="crumb kick">${tdPage ? `Testimony · ${pt.due <= Date.now() ? 'was due' : 'due'} ${esc(dayWord(pt.due))}` : `Hearing · ${esc(rel(s.day))}`}${lookOnly ? ` · ${esc(lookOnly)}` : ''}</p>`;
    const facts = fact('clock', `<span>${tdPage ? 'Hearing ' : ''}${esc(dateWords(s.day))} · ${esc(clock(s.t))}</span>`) + fact('map-pin', `<span>${esc(roomName(h.room) || 'No room is listed yet')}</span>`)
      + (watch && http(watch.url) ? fact('video', extLink(watch.url, 'Watch it live').replace('class="bl"', 'class="lk"')) : '') + (http(h.notice_url) ? fact('file-text', extLink(h.notice_url, 'Hearing notice').replace('class="bl"', 'class="lk"')) : '');
    const several = s.rows.length > 1;
    const our = `<h2 class="sh" id="ourBills">${s.rows.length === 1 ? 'Our bill' : `Our ${s.rows.length} bills`}</h2><ul class="brows">${s.rows.map(r => {
      const st = stateOf(r.h, r.b), dueLine = one ? '' : line(esc(`${dueWord(r.due)} ${dayTime(r.due)}`), 'bst');
      return billLi(r.b, r.issue, `<p class="bmeta">${esc(posLine(r.b, r.issue, me))}</p>${dueLine}${stLine(st, s, r, several)}`, moveOf(r.b, false, rd.go?.id), linksRow(r.b, r.issue, r.h)); }).join('')}</ul>`;
    // the notice's own address when the hearing row holds one; else the first listed bill's Capitol page (where the notice is posted); else no row at all
    const sUrl = s.rows[0]?.b.state_url, ag = (what, url) => `<section class="fold agenda"><h2 class="fh"><span class="ft">The agenda</span></h2><p class="agl">${what[0]}<a class="lk" target="_blank" rel="noopener" href="${esc(url)}">${what[1]}${ic('external-link')}</a></p></section>`;
    const agenda = http(h.notice_url) ? ag(['The full agenda is on the ', 'hearing notice'], h.notice_url) : http(sUrl) ? ag(['The hearing notice is on the ', 'bill’s Capitol page'], sUrl) : '';
    let right = agenda;
    const cms = [...new Set(String(h.committee || '').split('/').map(c => c.trim()).filter(Boolean))].map(cmteOf).filter(Boolean);
    if (cms.length) right += foldOf('cmte', 'The committee', (() => { const ch = [...new Set(cms.flatMap(c => c.chairs.map(x => x.l.name)))]; return ch.length ? `${ch.length > 1 ? 'Chairs' : 'Chair'} ${nameList(ch.map(nbn))}${cms.length === 1 ? ` · ${n(cms[0].count, 'member', 'members')}` : ''}` : cms.length === 1 ? n(cms[0].count, 'member', 'members') : ''; })(),
      cms.map(c => `<div class="cm"><h3 class="cmn">${esc(c.name)}</h3><ul class="cmr">${[...c.chairs.map(x => ['Chair', x.l]), ...c.vices.map(x => ['Vice chair', x.l])].map(([r, l]) => `<li><span class="cmrole">${r}</span><span class="cmwho">${legLink(l)}</span><span class="cmroom">${l.room ? `<span>Room ${esc(l.room)}</span>` : ''}${l.phone ? `<span>${esc(l.phone)}</span>` : ''}</span></li>`).join('')}</ul>`
        + (c.rest.length ? `<p class="cmem"><span class="cmlab">Members</span> ${c.rest.map(x => legLink(x.l)).join(', ')}</p>` : '') + '</div>').join(''));
    return `<div class="pn">${band(kicker, cmteWords(h.committee), facts)}<div class="pbody cal"><div class="cq"><div class="cols"><div class="cl">${readyBlock(rd)}${goingBlock(h)}${our}</div>${right ? `<div class="cr">${right}</div>` : ''}</div></div></div></div>`;
  };
  const deadlineSheet = r => {
    const touched = (ses.touch.get(r.key) || []).slice().sort((p, q) => (isAtRisk(q) - isAtRisk(p)) || byNo(p, q)), issueOf = b => (ses.bills.find(x => x.b.id === b.id) || {}).issue;
    let out = `<div class="pn">${band('<p class="crumb kick"><span>Capitol deadline</span></p>', nameOf(r.key, r.label), fact('calendar', `<span>${esc(dateWords(r.date))}${daysTo(r.date) < 0 ? '' : ` · ${daysTo(r.date) === 0 ? 'today' : daysTo(r.date) === 1 ? 'tomorrow' : `in ${daysTo(r.date)} days`}`}</span>`))}<div class="pbody cal">`;
    out += `<p class="lead tight" id="dlSays">${esc(r.says)}</p>${touched.length ? `<h2 class="sh" id="dlTouch">${esc(who.kind === 'mine' ? 'Your bills it affects' : who.kind === 'all' ? 'Everyone’s bills it affects' : `${first(who.person)}’s bills it affects`)}</h2>` : ''}`;
    out += touched.length ? `<ul class="brows">${touched.map(b => { const i = issueOf(b), hh = hearingAhead(b);
      const state = isAtRisk(b) ? `<p class="bst riskt">${ic('triangle-alert')}<span>At risk · needs a hearing</span></p>` : hh ? (sits.some(x => x.key === sitKey(hh)) ? `<p class="bst"><a class="hl" href="${sitHref({ key: sitKey(hh) })}">${esc(`Hearing ${dayTime(hh.scheduled_at)}`)}</a></p>` : line(esc(`Hearing ${dayTime(hh.scheduled_at)}`), 'bst')) : line(esc(whereWords(b, { deadline: false })), 'bst');
      return billLi(b, i, `<p class="bmeta">${esc(posLine(b, i, me))}</p>${state}`, moveOf(b, true), linksRow(b, i, null)); }).join('')}</ul>` : `<p class="hint" id="dlNone">It touches none of ${esc(whose)}.</p>`;
    return out + '</div></div>';
  };
  // the week's summary: what needs the person (or the teammate, or anyone) this week, then the hearings that need nothing
  const weekSheet = () => {
    const now = Date.now(), need = [], calm = new Set();
    for (const s of weekSits) { let any = false; for (const r of s.rows) { const st = stateOf(r.h, r.b); if (s.t > now && st.key !== 'filed') { need.push({ s, r, st }); any = true; } } if (!any) calm.add(s.key); }
    need.sort((p, q) => p.r.due - q.r.due || p.s.t - q.s.t);
    const nm = need.length, allWrite = need.every(x => x.st.key === 'write'), f0 = need[0], who1 = who.kind === 'mine' ? '' : who.kind === 'all' ? 'Everyone has ' : `${first(who.person)} has `;
    const letters = `${n(nm, 'testimony', 'testimonies')} ${allWrite ? 'still to write' : 'not filed yet'}`;
    const firstDue = nm ? ` · ${f0.r.due > now ? `the first due ${dayTime(f0.r.due)}` : `the first is ${lateLine(f0.s.t, { lower: true })}`}` : '';
    const nothing = who.kind === 'mine' ? 'Nothing needs you this week' : who.kind === 'all' ? 'Nothing is waiting this week' : `Nothing needs ${first(who.person)} this week`;
    const head = empty ? 'A quiet week' : nm ? `${who1}${letters}${firstDue}` : nothing;
    const k = calm.size, from = who.kind === 'mine' ? 'you' : who.kind === 'all' ? 'anyone' : first(who.person);
    const sub = empty ? (dls.length ? `${n(dls.length, 'Capitol deadline', 'Capitol deadlines')} this week.` : '') : k ? `${nm ? (k === 1 ? '1 other hearing needs' : `${k} other hearings need`) : (k === 1 ? '1 hearing needs' : `${k} hearings need`)} nothing from ${from}.` : '';
    const rows = nm ? `<h2 class="sh" id="stillOpen">Testimony still open</h2><ul class="brows">${need.map(({ s, r, st }) => billLi(r.b, r.issue, `<p class="bmeta">${esc(posLine(r.b, r.issue, me))}</p>`
      + line(esc(`${st.label} · ${dueWord(r.due)} ${dayTime(r.due)} · hearing ${dayTime(s.t)}`), 'bst'), moveOf(r.b))).join('')}</ul>` : '';
    return `<div class="pn"><div class="ov"><div class="ovtop"><p class="ovdate">Week of ${esc(rangeOf(wk, addDays(wk, 4)))}${who.kind === 'mine' ? '' : ` · ${esc(whose)}`}${lookOnly ? ' · Look only' : ''}</p><h1 tabindex="-1">${esc(head)}</h1>${sub ? `<p class="ovsub">${esc(sub)}</p>` : ''}</div><div class="ovrest">${rows}</div></div></div>`;
  };
  // the grid: Monday to Friday (a weekend day only for a hearing or a deadline), deadlines at the top of their day, then hearings and testimony times in time order
  const gridSheet = () => `<div class="pn"><div class="cg"><header class="cgh"><p class="ovdate">${esc(title)}${lookOnly ? ' · Look only' : ''}</p><h1 tabindex="-1">${esc(rangeOf(days[0].d, days[days.length - 1].d))}${wk === thisMon ? ' · this week' : ''}</h1></header><div class="cgrid" style="--cols:${days.length}">${days.map(x => colHTML(x, null)).join('')}</div></div></div>`;

  let sheet, label = 'Calendar';
  if (notFoundWhat) { sheet = notFound(); label = 'Not found'; }
  else if (gridHome) { sheet = gridSheet(); label = 'The week'; }
  else if (kind === 'sitting') { sheet = sittingSheet(item, false); label = 'Hearing'; }
  else if (kind === 'testimony') { sheet = sittingSheet(item, true); label = 'Testimony'; }
  else if (kind === 'deadline') { sheet = deadlineSheet(item); label = 'Deadline'; }
  else { sheet = weekSheet(); label = 'The week'; }
  if (pickDay && !notFoundWhat) { const dp = dayPaper(); if (dp) sheet = `<div class="split">${dp}<div class="sheetp">${sheet}</div></div>`; }
  return { who, door: 'calendar', backLabel: 'Calendar', col, sheet, picked: id !== '' && !gridHome, label, back: hereHref, bind: bindCal, notFound: !okPick, wide: grid && okPick, split: !!pickDay, weekOf: { mon: wk, sits: weekSits, tds, dls } };
}

// Binding: the teammate picker as Issues has it; the two folds (open by default only when the sheet has two columns, then kept in ui so the minute's redraw does not close them); the day paper's and the sheet's scroll kept across that redraw.
const WIDE = 760;   // the width, in pixels, at which the hearing sheet has two columns (the same number as its @container rule in app.css)
const hearingOf = id => (S.hearings || []).find(x => String(x.id) === String(id));
const redraw = () => window.__staff7Render && window.__staff7Render({ tick: true });
// Escape closes the teammate picker first (the page's own Escape would otherwise leave the page).
addEventListener('keydown', e => {
  const p = document.getElementById('goPick');
  if (e.key === 'Escape' && p && !p.hidden) { e.preventDefault(); e.stopPropagation(); p.hidden = true; ui.goPick = null; const a = document.getElementById('goAdd'); a?.setAttribute('aria-expanded', 'false'); a?.focus(); }
}, true);
function bindGoing() {
  const box = document.getElementById('going'), h = box && hearingOf(box.dataset.h); if (!h) return;
  const fail = e => toast((e && e.message) || 'It did not go. Try again.');
  document.getElementById('goBtn')?.addEventListener('click', () => changeGoing(h, !goingIds(h).includes(S.me.id), S.me.id, redraw).catch(fail));
  const add = document.getElementById('goAdd'), pick = document.getElementById('goPick'); if (!add || !pick) return;
  const set = on => { ui.goPick = on ? String(h.id) : null; pick.hidden = !on; add.setAttribute('aria-expanded', String(on)); if (on) pick.querySelector('button.pk')?.focus(); else add.focus(); };
  add.addEventListener('click', () => set(pick.hidden));
  document.getElementById('goPickX').addEventListener('click', () => set(false));
  // each name is a toggle: pressed = going; pressing again takes them off (a toast with Undo either way). The list stays open and keeps the focus on the name pressed.
  pick.querySelectorAll('[data-who]').forEach(b => b.addEventListener('click', () => { const who = b.dataset.who, on = b.getAttribute('aria-pressed') !== 'true';
    changeGoing(h, on, who, () => { redraw(); setTimeout(() => document.querySelector(`#goPick [data-who="${CSS.escape(who)}"]`)?.focus(), 0); }).catch(fail); }));
}
function bindCal() {
  bindIssues(); bindGoing();
  const cq = document.querySelector('.cq'), wide = !!cq && cq.clientWidth >= WIDE; ui.folds = ui.folds || {};
  const def = ui.foldDef && ui.foldDef.h === location.hash ? ui.foldDef : (ui.foldDef = { h: location.hash, v: {} });   // the width decides a fold only when the page is first drawn: dragging the list's width and a redraw never open or close one nobody pressed
  document.querySelectorAll('.fbtn').forEach(b => {
    const k = b.dataset.fold, body = document.getElementById(b.getAttribute('aria-controls')), set = on => { b.setAttribute('aria-expanded', String(on)); body.hidden = !on; };
    if (!(k in def.v)) def.v[k] = wide;
    set(k in ui.folds ? ui.folds[k] : def.v[k]); b.addEventListener('click', () => { const on = b.getAttribute('aria-expanded') !== 'true'; ui.folds[k] = on; set(on); });   // only a press is remembered: the default follows the sheet's width
  });
  const keep = ui.calScroll && ui.calScroll.h === location.hash ? ui.calScroll : { h: location.hash, y: {} }; ui.calScroll = keep;
  document.querySelectorAll('.dayp, .sheetp').forEach(e => { const c = e.classList[0]; if (keep.y[c]) e.scrollTop = keep.y[c]; e.addEventListener('scroll', () => { keep.y[c] = e.scrollTop; }, { passive: true }); });
}
