// Staff7 Calendar (R-398, rules S-19, S-20): the week's hearings, where our letters stand for them, and the Capitol's session deadlines, for Mine, a teammate or Everyone (look only).
// Two ways to read the same week: a List (the week day by day, the thing picked on the right) and a Week grid (laptop only: the same left header, the grid on the right). The address holds everything
// that changes the page (?who=, ?w= the Monday, ?view=week) so Back and a shared link open the same week.
// A sitting is every hearing row with one committee (its codes sorted, so WAM/CPN and CPN/WAM are one) and one start time; it is in a view when one of the set's alive bills is heard at it.
// A cancelled hearing, a dead bill's hearing and a repeated row (same bill, same time) are never drawn. Mine is the bills of my issues plus any bill I lead or follow, as Home's "next hearing" reads it.
// Nothing here writes anything.
import { S, isMine, SESSION_YEAR } from '../staff6/data.js';
import { billStep } from '../staff6/steps.js';
import { sittingDraft, roomName, streamOf, hearingAhead, billRef, lateLine } from '../staff6/model.js';
import { whereWords } from '../staff6/steps.js';
import { ic } from './icons7.js';
import { esc, plainBand } from './parts.js';
import { billName, billNo, cmteWords, dayTime, first } from './steps.js';
import { isAlive, isAtRisk } from './standing.js';
import { dateWords, whenWords, nameOf } from './words.js';
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
// Where a bill's letter stands for a hearing: the data layer's own state ({ key, label }), never the clock's
const stateOf = (h, b) => { try { const s = billStep(b, { viewer: S.me, d: sittingDraft(h, b.id) || null, h })?.state; if (s) return { key: s.key, label: s.label }; } catch { /* below */ } return { key: 'write', label: 'Not started' }; };
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
  const view = !phone && rt.q.get('view') === 'week' ? 'week' : 'list';
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

  // ---- addresses: who, week and view stay in the address; the defaults (Mine, this week, List) leave it clean
  const q = (x = {}) => { const p = new URLSearchParams(), w = x.w || wk, v = x.view || view, c = x.who === undefined ? who.code : x.who;
    if (c) p.set('who', c); if (w !== thisMon) p.set('w', w); if (v === 'week') p.set('view', 'week'); const s = p.toString(); return s ? `?${s}` : ''; };
  const href = (path = '', x) => `#/calendar${path}${q(x)}`;
  const sitHref = s => href(`/sitting/${enc(s.key)}`), tdHref = s => href(`/testimony/${enc(s.key)}`), dlHref = r => href(`/deadline/${enc(r.key)}`), weekHref = href('/week');
  const listHref = href('', { view: 'list' }), gridHref = href('', { view: 'week' });

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
  const header = `<header class="ihead"><div class="ihl"><h2 class="ihd" id="ihd">${esc(title)}</h2>${mate ? '<button class="btn text chg" type="button" id="whoChange" aria-controls="whoPick">Change</button>' : ''}${viewSwitch}</div>${whoSwitch}${weekNav}</header>`;

  // ---- the left column: the row you click is the row marked
  const sitRow = s => { const on = okPick && kind === 'sitting' && item.key === s.key;
    return `<li><a class="sr3 ir cal${on ? ' sel' : ''}"${on ? ' aria-current="true"' : ''} data-sit="${esc(s.key)}" href="${sitHref(s)}"><span class="imark" style="--ic:var(--act)" aria-hidden="true">${ic('calendar')}</span>`
      + `<span class="sv"><b>${esc(clock(s.t))} · ${esc(cmteWords(s.h.committee))}</b><span class="ir2">${esc(n(s.rows.length, 'bill', 'bills'))}</span></span></a></li>`; };
  const dueWord = t => t <= Date.now() ? 'Testimony was due' : 'Testimony due';
  const tdRow = (g, moved) => { const on = okPick && kind === 'testimony' && item.key === g.sit.key, i = infoOf(g);
    return `<li><a class="sr3 ir cal${on ? ' sel' : ''}"${on ? ' aria-current="true"' : ''} data-td="${esc(g.sit.key)}" href="${tdHref(g.sit)}"><span class="imark" style="--ic:var(--act)" aria-hidden="true">${ic('clock')}</span>`
      + `<span class="sv"><b>${dueWord(g.due)} <span class="nb">${esc(moved ? wdClock(g.due) : clock(g.due))}</span></b><span class="ir2 tdst st-${i.tone}${i.tone === 'late' ? ' risk' : ''}">${i.icon ? ic(i.icon) : ''}<span>${esc(i.line)}</span></span></span></a></li>`; };
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
  const notFound = () => `<div class="pn" data-notfound="1">${plainBand(`We could not find ${notFoundWhat}.`, 'It may have been renamed, or it is not on the practice copy.')}<div class="pbody"><p class="lead"><a class="btn text" href="${listHref}">Back to Calendar</a></p></div></div>`;
  const kv = rows => `<dl class="kv">${rows.filter(Boolean).map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${v}</dd></div>`).join('')}</dl>`;
  const line = (t, cls = '') => `<p class="${cls}">${t}</p>`;
  const stLine = i => `<p class="bst${i.tone === 'late' ? ' riskt' : ''}">${i.icon ? ic(i.icon) : ''}<span>${esc(i.what)}</span></p>`;
  const billHrefOf = (b, issue) => { const p = new URLSearchParams(); if (who.code) p.set('who', who.code); if (issue?.id != null) p.set('i', issue.id); const s = p.toString(); return `#/bill/${billRef(b).split('/').map(enc).join('/')}${s ? `?${s}` : ''}`; };
  const billLi = (b, issue, lines, move) => `<li class="brow" style="${tint(issue || {})}"><div class="bmain"><a class="bn2" href="${billHrefOf(b, issue)}">${esc(billName(b))}<span class="bno">${esc(billNo(b))}</span></a>${lines}${move}</div></li>`;
  const moveOf = (b, onlyRisk) => { const st = who.kind === 'mine' && (!onlyRisk || isAtRisk(b)) ? stepOn(open, b) : null; return st ? `<a class="btn quiet ymove" href="#/do/${enc(st.id)}">Your move · ${esc(st.verb)}</a>` : ''; };
  const backWeek = view === 'week' && !phone ? `<a class="crumb back2" id="backWeek" href="${gridHref}">${ic('chevron-left')}Back to the week</a>` : '';

  const sittingSheet = (s, tdPage) => {
    const h = s.h, dues = [...new Set(s.rows.map(r => Math.round(r.due)))], one = dues.length === 1, watch = streamOf(h), look = lookOnly ? `<span class="crumb">${esc(lookOnly)}</span>` : '';
    let out = `<div class="pn"><div class="hband neutral"><div class="ht">${backWeek}${look}<h1 tabindex="-1">${esc(cmteWords(h.committee))}</h1><p class="bsub">${esc(dateWords(s.day))} · ${esc(clock(s.t))}</p></div></div><div class="pbody">`;
    if (tdPage) out += `<div class="tdtop">${dueOf([s]).map(g => { const i = infoOf(g); return `<p class="lead tight tdl st-${i.tone}">${i.icon ? ic(i.icon) : ''}<span>${esc(`${dueWord(g.due)} ${dayTime(g.due)} · ${i.sum}`)}</span></p>`; }).join('')}</div>`;
    out += kv([['Where', esc(roomName(h.room) || 'No room is listed yet')],
      watch && http(watch.url) ? ['Watch', `<a class="lk" target="_blank" rel="noopener" href="${esc(watch.url)}">Watch it live</a>`] : null,
      http(h.notice_url) ? ['Notice', `<a class="lk" target="_blank" rel="noopener" href="${esc(h.notice_url)}">Read the notice</a>`] : null,
      one && !tdPage ? [dueWord(dues[0]), esc(dayTime(dues[0]))] : null]);
    out += `<h2 class="sh" id="ourBills">${s.rows.length === 1 ? 'Our bill' : `Our ${s.rows.length} bills`}</h2><ul class="brows">${s.rows.map(r => {
      const i = infoOf({ sit: s, due: Math.round(r.due), rows: [r] }), dueLine = one ? '' : line(esc(`${dueWord(r.due)} ${dayTime(r.due)}`), 'bst');
      return billLi(r.b, r.issue, `<p class="bmeta">${esc(posLine(r.b, r.issue, me))}</p>${dueLine}${stLine(i)}`, moveOf(r.b)); }).join('')}</ul>`;
    return out + '</div></div>';
  };
  const deadlineSheet = r => {
    const touched = (ses.touch.get(r.key) || []).slice().sort((p, q) => (isAtRisk(q) - isAtRisk(p)) || byNo(p, q)), issueOf = b => (ses.bills.find(x => x.b.id === b.id) || {}).issue;
    let out = `<div class="pn"><div class="hband neutral"><div class="ht">${backWeek}<span class="crumb">Capitol deadline</span><h1 tabindex="-1">${esc(nameOf(r.key, r.label))}</h1><p class="bsub">${esc(whenWords(r.date))}</p></div></div><div class="pbody">`;
    out += `<p class="lead tight" id="dlSays">${esc(r.says)}</p>${touched.length ? `<h2 class="sh" id="dlTouch">Touches ${esc(whose)}</h2>` : ''}`;
    out += touched.length ? `<ul class="brows">${touched.map(b => { const i = issueOf(b), hh = hearingAhead(b);
      const state = isAtRisk(b) ? `<p class="bst riskt">${ic('triangle-alert')}<span>At risk · needs a hearing</span></p>` : hh ? line(esc(`Hearing ${dayTime(hh.scheduled_at)}`), 'bst') : line(esc(whereWords(b, { deadline: false })), 'bst');
      return billLi(b, i, `<p class="bmeta">${esc(posLine(b, i, me))}</p>${state}`, moveOf(b, true)); }).join('')}</ul>` : `<p class="hint" id="dlNone">It touches none of ${esc(whose)}.</p>`;
    return out + '</div></div>';
  };
  // the week's summary: what needs the person (or the teammate, or anyone) this week, then the hearings that need nothing
  const weekSheet = () => {
    const now = Date.now(), need = [], calm = new Set();
    for (const s of weekSits) { let any = false; for (const r of s.rows) { const st = stateOf(r.h, r.b); if (s.t > now && st.key !== 'filed') { need.push({ s, r, st }); any = true; } } if (!any) calm.add(s.key); }
    need.sort((p, q) => p.r.due - q.r.due || p.s.t - q.s.t);
    const nm = need.length, allWrite = need.every(x => x.st.key === 'write'), f0 = need[0], who1 = who.kind === 'mine' ? '' : who.kind === 'all' ? 'Everyone has ' : `${first(who.person)} has `;
    const letters = `${n(nm, 'letter', 'letters')} ${allWrite ? 'still to write' : 'not filed yet'}`;
    const firstDue = nm ? ` · ${f0.r.due > now ? `the first due ${dayTime(f0.r.due)}` : `the first is ${lateLine(f0.s.t, { lower: true })}`}` : '';
    const nothing = who.kind === 'mine' ? 'Nothing needs you this week' : who.kind === 'all' ? 'Nothing is waiting this week' : `Nothing needs ${first(who.person)} this week`;
    const head = empty ? 'A quiet week' : nm ? `${who1}${letters}${firstDue}` : nothing;
    const k = calm.size, from = who.kind === 'mine' ? 'you' : who.kind === 'all' ? 'anyone' : first(who.person);
    const sub = empty ? (dls.length ? `${n(dls.length, 'Capitol deadline', 'Capitol deadlines')} this week.` : '') : k ? `${nm ? (k === 1 ? '1 other hearing needs' : `${k} other hearings need`) : (k === 1 ? '1 hearing needs' : `${k} hearings need`)} nothing from ${from}.` : '';
    const rows = nm ? `<h2 class="sh" id="stillOpen">Letters still open</h2><ul class="brows">${need.map(({ s, r, st }) => billLi(r.b, r.issue, `<p class="bmeta">${esc(posLine(r.b, r.issue, me))}</p>`
      + line(esc(`${st.label} · ${dueWord(r.due)} ${dayTime(r.due)} · hearing ${dayTime(s.t)}`), 'bst'), moveOf(r.b))).join('')}</ul>` : '';
    return `<div class="pn"><div class="ov"><div class="ovtop"><p class="ovdate">Week of ${esc(rangeOf(wk, addDays(wk, 4)))}${who.kind === 'mine' ? '' : ` · ${esc(whose)}`}${lookOnly ? ' · Look only' : ''}</p><h1 tabindex="-1">${esc(head)}</h1>${sub ? `<p class="ovsub">${esc(sub)}</p>` : ''}</div><div class="ovrest">${rows}</div></div></div>`;
  };
  // the grid: Monday to Friday (a weekend day only for a hearing or a deadline), deadlines at the top of their day, then hearings and testimony times in time order
  const gridSheet = () => {
    const names = s => { const nm = s.rows.map(r => billName(r.b)); return nm.slice(0, 3).map(x => `<span class="cgn nm" title="${esc(x)}">${esc(x)}</span>`).join('') + (nm.length > 3 ? `<span class="cgn">+${nm.length - 3} more</span>` : ''); };
    const cols = days.map(x => { const t = x.d === today;
      return `<section class="cgcol${t ? ' today' : ''}" aria-labelledby="g-${x.d}"><h3 class="cgd" id="g-${x.d}">${esc(fmt(x.d, { weekday: 'short' }))}<span>${esc(fmt(x.d, { month: 'short', day: 'numeric' }))}${t ? ' · today' : ''}</span></h3>`
        + x.dls.map(r => `<a class="cgc dl" data-dl="${esc(r.key)}" href="${dlHref(r)}">${ic('flag')}<span>${esc(r.label)}</span></a>`).join('')
        + x.items.map(y => { if (y.s) return `<a class="cgc sit" data-sit="${esc(y.s.key)}" href="${sitHref(y.s)}"><span class="cgt"><b class="nb">${esc(clock(y.s.t))}</b> · ${esc(cmteWords(y.s.h.committee))}</span>${names(y.s)}</a>`;
          const g = y.g, i = infoOf(g), moved = ymd(g.due) !== x.d;
          return `<a class="cgc td st-${i.tone}" data-td="${esc(g.sit.key)}" href="${tdHref(g.sit)}"><span class="cgt">${ic('clock')}${g.due <= Date.now() ? 'Was due' : 'Due'} <span class="nb">${esc(moved ? wdClock(g.due) : clock(g.due))}</span></span><span class="cgn tdst st-${i.tone}">${i.icon ? ic(i.icon) : ''}<span>${esc(i.line)}</span></span></a>`; }).join('')
        + (x.dls.length || x.items.length || empty ? '' : '<p class="hint nothing">Nothing scheduled</p>') + '</section>'; }).join('');
    return `<div class="pn"><div class="cg"><header class="cgh"><p class="ovdate">${esc(title)}${lookOnly ? ' · Look only' : ''}</p><h1 tabindex="-1">${esc(rangeOf(days[0].d, days[days.length - 1].d))}${wk === thisMon ? ' · this week' : ''}</h1></header><div class="cgrid" style="--cols:${days.length}">${cols}</div></div></div>`;
  };

  let sheet, label = 'Calendar';
  if (notFoundWhat) { sheet = notFound(); label = 'Not found'; }
  else if (grid && id === '') { sheet = gridSheet(); label = 'The week'; }
  else if (kind === 'sitting') { sheet = sittingSheet(item, false); label = 'Hearing'; }
  else if (kind === 'testimony') { sheet = sittingSheet(item, true); label = 'Testimony'; }
  else if (kind === 'deadline') { sheet = deadlineSheet(item); label = 'Deadline'; }
  else { sheet = weekSheet(); label = 'The week'; }
  return { who, door: 'calendar', backLabel: 'Calendar', col, sheet, picked: id !== '', label, back: listHref, bind: bindIssues, notFound: !okPick, wide: grid && id === '' && okPick, weekOf: { mon: wk, sits: weekSits, tds, dls } };
}
